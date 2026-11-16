-- Hosts can delete any of their listings, not only drafts.
--
-- Everything that refers to a listing (requests and their payments, reviews,
-- conversations) is deleted with it, so a listing with any history is not
-- deleted but hidden (deleted_at): it leaves the host's list and can't be
-- published again, while receipts, payouts, agreements and messages keep
-- working. A listing without history is deleted for good.
--
-- Rentals that are going on or coming up (and parking bookings being paid)
-- must end first, so nobody loses a space they have paid for. Unanswered
-- requests are declined, and the renters get the usual email.

alter table public.listings add column if not exists deleted_at timestamptz;

-- Copied from 20261116010000_security_fixes.sql: deleted_at is also kept as it was.
create or replace function private.listings_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'INSERT' then
    new.published_at := null;
    new.taken_down_at := null;
    new.deleted_at := null;
    return new;
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    raise exception 'use_publish_listing' using errcode = 'P0001';
  end if;
  new.published_at := old.published_at;
  new.taken_down_at := old.taken_down_at;
  new.deleted_at := old.deleted_at;
  new.created_at := old.created_at;
  return new;
end;
$$;
revoke all on function private.listings_guard() from public, anon, authenticated;

-- Copied from 20261116010000_security_fixes.sql: a deleted listing can't be published.
create or replace function public.publish_listing(p_listing uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  missing text[] := '{}';
begin
  select * into l from public.listings where id = p_listing and host_id = (select auth.uid()) and deleted_at is null;
  if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if l.taken_down_at is not null then raise exception 'taken_down' using errcode = 'P0001'; end if;
  if l.space_type is null then missing := array_append(missing, 'space_type'); end if;
  if l.city = '' then missing := array_append(missing, 'city'); end if;
  if char_length(l.title) < 5 then missing := array_append(missing, 'title'); end if;
  if not exists (select 1 from public.listing_spaces where listing_id = l.id) then missing := array_append(missing, 'spaces'); end if;
  if not exists (select 1 from public.listing_photos where listing_id = l.id) then missing := array_append(missing, 'photos'); end if;
  if not exists (select 1 from public.listing_private where listing_id = l.id and street_address <> '') then missing := array_append(missing, 'address'); end if;
  if l.access is null then missing := array_append(missing, 'access'); end if;
  if cardinality(missing) > 0 then
    raise exception 'incomplete: %', array_to_string(missing, ',') using errcode = 'P0001';
  end if;
  update public.listings set status = 'published', published_at = coalesce(published_at, now()) where id = l.id;
  return 'published';
end;
$$;

-- Returns 'deleted' (gone for good: the app then removes the photo files) or
-- 'archived' (hidden, kept for the history).
create or replace function public.delete_listing(p_listing uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  r public.requests;
begin
  select * into l from public.listings
   where id = p_listing and host_id = (select auth.uid()) and deleted_at is null
   for update;
  if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;

  if exists (select 1 from public.requests q
              where q.listing_id = l.id
                and ((q.status = 'accepted' and q.kind = 'month' and (q.end_date is null or q.end_date >= current_date))
                  or (q.status = 'accepted' and q.kind = 'hour' and q.end_at > now())
                  or (q.status = 'pending' and q.kind = 'hour'))) then
    raise exception 'active_rentals' using errcode = 'P0001';
  end if;

  for r in select * from public.requests where listing_id = l.id and status = 'pending' and kind = 'month' for update loop
    if r.expires_at < now() then
      update public.requests set status = 'expired' where id = r.id;
    else
      update public.requests
         set status = 'declined', responded_at = now(), decline_reason = 'Värden har tagit bort annonsen.'
       where id = r.id;
      insert into public.messages (conversation_id, sender_id, kind, body)
      values (r.conversation_id, r.host_id, 'event', 'request_declined');
    end if;
  end loop;

  if not exists (select 1 from public.requests where listing_id = l.id)
     and not exists (select 1 from public.conversations where listing_id = l.id) then
    delete from public.listings where id = l.id;
    return 'deleted';
  end if;

  update public.listings set status = 'paused', deleted_at = now() where id = l.id;
  delete from public.favourites where listing_id = l.id;
  return 'archived';
end;
$$;
revoke all on function public.delete_listing(uuid) from public, anon;
grant execute on function public.delete_listing(uuid) to authenticated;
