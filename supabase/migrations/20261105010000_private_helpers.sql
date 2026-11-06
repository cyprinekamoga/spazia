-- Keep internal helper functions out of the public API.
-- The access rules still use them, but they can no longer be called as /rpc/...

create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.owns_listing(uuid) set schema private;
alter function public.listing_visible(uuid) set schema private;
alter function public.in_conversation(uuid) set schema private;
alter function public.has_accepted_request(uuid) set schema private;
alter function public.booked_units(uuid, text, date, date, uuid) set schema private;

grant execute on function private.owns_listing(uuid) to anon, authenticated;
grant execute on function private.listing_visible(uuid) to anon, authenticated;
grant execute on function private.in_conversation(uuid) to authenticated;
grant execute on function private.has_accepted_request(uuid) to authenticated;
revoke all on function private.booked_units(uuid, text, date, date, uuid) from public, anon, authenticated;

-- Trigger functions are never called directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.bump_conversation() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- respond_to_request referred to booked_units by its old name.
create or replace function public.respond_to_request(p_request uuid, p_accept boolean, p_reason text default '')
returns public.request_status
language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  item record;
  free int;
begin
  select * into r from public.requests where id = p_request for update;
  if r.id is null or r.host_id <> (select auth.uid()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  if r.expires_at < now() then
    -- Too late to answer: record it as expired (no exception, so the update is kept).
    update public.requests set status = 'expired' where id = r.id;
    return 'expired';
  end if;

  if p_accept then
    for item in select i.category, i.quantity, s.capacity
                  from public.request_items i
                  left join public.listing_spaces s on s.listing_id = r.listing_id and s.category = i.category
                 where i.request_id = r.id loop
      free := coalesce(item.capacity, 0) - private.booked_units(r.listing_id, item.category, r.start_date, r.end_date, r.id);
      if item.quantity > free then
        raise exception 'no_capacity' using errcode = 'P0001';
      end if;
    end loop;
    update public.requests set status = 'accepted', responded_at = now() where id = r.id;
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (r.conversation_id, r.host_id, 'event', 'request_accepted');
    return 'accepted';
  else
    update public.requests
       set status = 'declined', responded_at = now(), decline_reason = left(coalesce(p_reason, ''), 500)
     where id = r.id;
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (r.conversation_id, r.host_id, 'event', 'request_declined');
    return 'declined';
  end if;
end;
$$;
