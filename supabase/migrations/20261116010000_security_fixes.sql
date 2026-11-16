-- Security fixes from the November 2026 review.
--
-- 1. Listings: a host could publish straight through the API (an update of
--    status), skipping publish_listing's checks, and could undo a pause by the
--    team. Now only publish_listing publishes, and it refuses a listing the
--    team has taken down (taken_down_at). Hosts can still pause and edit their
--    listings directly; published_at and taken_down_at are kept as they were.
-- 2. Profiles: a user could change their own referral code, created_at and
--    deleted_at, and everyone's referral code could be read. Now only first
--    name, about, photo and language can be changed, and the referral code is
--    only read through my_referral_code().
-- 3. Contact details and access instructions: a former renter could read them
--    for ever after the rental ended. Now for 14 days after the end date.

-- 1. Listings ----------------------------------------------------------------
alter table public.listings add column if not exists taken_down_at timestamptz;

-- Direct writes from the app (role authenticated); the database's own
-- functions run as their owner and are not affected.
create or replace function private.listings_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'INSERT' then
    new.published_at := null;
    new.taken_down_at := null;
    return new;
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    raise exception 'use_publish_listing' using errcode = 'P0001';
  end if;
  new.published_at := old.published_at;
  new.taken_down_at := old.taken_down_at;
  new.created_at := old.created_at;
  return new;
end;
$$;
revoke all on function private.listings_guard() from public, anon, authenticated;

drop trigger if exists listings_guard on public.listings;
create trigger listings_guard before insert or update on public.listings
  for each row execute function private.listings_guard();

-- Copied from 20261106000000_publish_fix.sql, plus the taken-down check.
create or replace function public.publish_listing(p_listing uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  missing text[] := '{}';
begin
  select * into l from public.listings where id = p_listing and host_id = (select auth.uid());
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

-- Copied from 20261113030000_reports_admin_alerts.sql: pausing marks the
-- listing as taken down, publishing again clears the mark.
create or replace function public.admin_set_listing_status(p_listing uuid, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_status not in ('published', 'paused') then raise exception 'bad_request' using errcode = 'P0001'; end if;
  update public.listings
     set status = p_status::public.listing_status,
         published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
         taken_down_at = case when p_status = 'paused' then now() end
   where id = p_listing;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform private.log_admin('listing_' || p_status, p_listing::text, p_note);
end;
$$;

-- 2. Profiles ----------------------------------------------------------------
revoke select, update on public.profiles from anon, authenticated;
grant select (id, first_name, about, avatar_url, created_at, lang, deleted_at) on public.profiles to anon, authenticated;
grant update (first_name, about, avatar_url, lang) on public.profiles to authenticated;

-- 3. Former renters ----------------------------------------------------------
-- Copied from 20261110000000_payments.sql, plus: the rental hasn't ended more
-- than 14 days ago (end_date is the last day; null = still running).
create or replace function private.has_accepted_request(p_listing uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r
     where r.listing_id = p_listing and r.renter_id = (select auth.uid()) and r.status = 'accepted'
       and (not r.payment_required or r.paid_through is not null)
       and (r.end_date is null or r.end_date >= current_date - 14)
  );
$$;
create or replace function private.shares_accepted_request(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r
     where r.status = 'accepted'
       and (not r.payment_required or r.paid_through is not null)
       and (r.end_date is null or r.end_date >= current_date - 14)
       and ((r.host_id = p_other and r.renter_id = (select auth.uid()))
         or (r.renter_id = p_other and r.host_id = (select auth.uid())))
  );
$$;
