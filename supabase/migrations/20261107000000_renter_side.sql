-- Renter side: free places for a period, stricter requests, and phone numbers
-- shared between host and renter once a request is accepted.

-- Free units per category on a listing for a period (end null = open-ended).
create or replace function public.listing_availability(p_listing uuid, p_start date, p_end date default null)
returns table (category text, capacity int, available int)
language sql stable security definer set search_path = '' as $$
  select s.category, s.capacity,
         greatest(0, s.capacity - private.booked_units(s.listing_id, s.category, p_start, p_end))::int
    from public.listing_spaces s
    join public.listings l on l.id = s.listing_id
   where s.listing_id = p_listing
     and (l.status = 'published' or l.host_id = (select auth.uid()))
   order by s.category;
$$;
revoke all on function public.listing_availability(uuid, date, date) from public, anon;
grant execute on function public.listing_availability(uuid, date, date) to authenticated;

-- A renter asks to store items. Checks the host's shortest rental, closed days,
-- free places and that the renter has no other open request on the listing.
create or replace function public.create_request(
  p_listing uuid, p_start date, p_end date, p_items jsonb, p_message text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  conv uuid;
  req uuid;
  item jsonb;
  space public.listing_spaces;
  qty int;
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'login_required' using errcode = '42501'; end if;
  select * into l from public.listings where id = p_listing and status = 'published';
  if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if l.host_id = me then raise exception 'own_listing' using errcode = 'P0001'; end if;
  if p_start is null or p_start < current_date or (p_end is not null and p_end < p_start) then
    raise exception 'bad_dates' using errcode = 'P0001';
  end if;
  -- Open-ended requests always meet the shortest rental time.
  if p_end is not null and (
       (l.min_period = 'week' and p_end < p_start + 6)
    or (l.min_period = 'month' and p_end < (p_start + interval '1 month')::date - 1)) then
    raise exception 'too_short' using errcode = 'P0001';
  end if;
  -- Drop-off and pick-up can't fall on days the host has closed.
  if exists (select 1 from public.listing_blocks b
              where b.listing_id = l.id
                and (p_start between b.start_date and b.end_date
                     or (p_end is not null and p_end between b.start_date and b.end_date))) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.requests r
              where r.listing_id = l.id and r.renter_id = me
                and r.status = 'pending' and r.expires_at > now()) then
    raise exception 'already_pending' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no_items' using errcode = 'P0001';
  end if;

  insert into public.conversations (listing_id, host_id, renter_id)
  values (l.id, l.host_id, me)
  on conflict (listing_id, renter_id) do update set last_message_at = now()
  returning id into conv;

  insert into public.requests (listing_id, conversation_id, host_id, renter_id, start_date, end_date, message)
  values (l.id, conv, l.host_id, me, p_start, p_end, left(coalesce(p_message, ''), 1000))
  returning id into req;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into space from public.listing_spaces where listing_id = l.id and category = item ->> 'category';
    if space.id is null then raise exception 'bad_category' using errcode = 'P0001'; end if;
    qty := greatest(1, coalesce((item ->> 'quantity')::int, 1));
    if qty > space.capacity - private.booked_units(l.id, space.category, p_start, p_end) then
      raise exception 'no_capacity' using errcode = 'P0001';
    end if;
    insert into public.request_items (request_id, category, quantity, host_price_month)
    values (req, space.category, qty, space.host_price_month);
  end loop;

  if coalesce(p_message, '') <> '' then
    insert into public.messages (conversation_id, sender_id, body) values (conv, me, left(p_message, 2000));
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body) values (conv, me, 'event', 'request_sent');
  return req;
end;
$$;

-- Host and renter see each other's phone (and last name) once a request is accepted.
create or replace function private.shares_accepted_request(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r
     where r.status = 'accepted'
       and ((r.host_id = p_other and r.renter_id = (select auth.uid()))
         or (r.renter_id = p_other and r.host_id = (select auth.uid())))
  );
$$;
revoke all on function private.shares_accepted_request(uuid) from public, anon;
grant execute on function private.shares_accepted_request(uuid) to authenticated;

create policy "counterpart after acceptance" on public.profile_private for select to authenticated
  using (private.shares_accepted_request(id));
