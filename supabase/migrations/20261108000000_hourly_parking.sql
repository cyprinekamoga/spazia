-- Hourly parking. A host can let a parking space by the hour: a price per hour,
-- a cap per 24 hours, and the days and hours it can be booked. Hourly bookings
-- are made directly (no request); monthly rentals still go through requests.
-- Times are Swedish local time (Europe/Stockholm), whole hours only.

-- Spaces: monthly price becomes optional for parking that is only let by the hour.
alter table public.listing_spaces
  alter column host_price_month drop not null,
  add column hourly_price int check (hourly_price between 1 and 1000),
  add column daily_max int check (daily_max between 1 and 24000),
  add column hourly_from int not null default 0 check (hourly_from between 0 and 23),
  add column hourly_to int not null default 24 check (hourly_to between 1 and 24),
  add column hourly_days int[] not null default '{1,2,3,4,5,6,7}',
  add constraint listing_spaces_has_price check (host_price_month is not null or hourly_price is not null),
  add constraint listing_spaces_hourly_parking_only check (hourly_price is null or category = 'parking'),
  add constraint listing_spaces_hourly_window check (hourly_to > hourly_from),
  add constraint listing_spaces_daily_max_needs_hourly check (daily_max is null or hourly_price is not null),
  add constraint listing_spaces_hourly_days_valid check (hourly_days <@ '{1,2,3,4,5,6,7}'::int[] and cardinality(hourly_days) > 0);

-- Requests: kind 'hour' is a direct hourly booking with exact times and a total price.
alter table public.requests
  add column kind text not null default 'month' check (kind in ('month', 'hour')),
  add column start_at timestamptz,
  add column end_at timestamptz,
  add column host_total int check (host_total >= 0),
  add constraint requests_hour_has_times check (
    kind = 'month' or (start_at is not null and end_at is not null and end_at > start_at and host_total is not null)
  );
create index requests_listing_hour_idx on public.requests (listing_id, start_at) where kind = 'hour';

alter table public.request_items
  alter column host_price_month drop not null,
  add column hourly_price int,
  add column daily_max int,
  add constraint request_items_has_price check (host_price_month is not null or hourly_price is not null);

-- The host's price for a number of hours: per hour, but at most daily_max per 24 hours.
create or replace function private.parking_host_total(p_hours int, p_hourly int, p_daily_max int, p_quantity int default 1)
returns int language sql immutable set search_path = '' as $$
  select (
      (p_hours / 24) * least(24 * p_hourly, coalesce(p_daily_max, 24 * p_hourly))
    + least((p_hours % 24) * p_hourly, coalesce(p_daily_max, (p_hours % 24) * p_hourly))
  ) * greatest(1, p_quantity);
$$;

-- Free parking units in every hour of [p_start, p_end): the smallest number over those hours.
-- Monthly rentals take a unit for whole days, hourly bookings for their hours.
create or replace function private.parking_free_units(p_listing uuid, p_start timestamptz, p_end timestamptz)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(min(s.capacity
      - coalesce((select sum(i.quantity) from public.requests r join public.request_items i on i.request_id = r.id
                   where r.listing_id = p_listing and r.status = 'accepted' and r.kind = 'month' and i.category = 'parking'
                     and r.start_date <= (h.slot at time zone 'Europe/Stockholm')::date
                     and coalesce(r.end_date, 'infinity'::date) >= (h.slot at time zone 'Europe/Stockholm')::date), 0)
      - coalesce((select sum(i.quantity) from public.requests r join public.request_items i on i.request_id = r.id
                   where r.listing_id = p_listing and r.status = 'accepted' and r.kind = 'hour' and i.category = 'parking'
                     and r.start_at <= h.slot and r.end_at > h.slot), 0)
    ), 0)::int
  from public.listing_spaces s
  cross join generate_series(p_start, p_end - interval '1 hour', interval '1 hour') as h(slot)
  where s.listing_id = p_listing and s.category = 'parking';
$$;

revoke all on function private.parking_host_total(int, int, int, int) from public, anon, authenticated;
revoke all on function private.parking_free_units(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Free parking units for a period in local time (for the booking form).
create or replace function public.parking_availability(p_listing uuid, p_start timestamp, p_end timestamp)
returns int language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.listings l where l.id = p_listing and (l.status = 'published' or l.host_id = (select auth.uid())))
    then private.parking_free_units(p_listing, p_start at time zone 'Europe/Stockholm', p_end at time zone 'Europe/Stockholm')
    else 0
  end;
$$;

-- Book a parking space by the hour, directly. p_start and p_end are local times on whole hours.
create or replace function public.book_parking(
  p_listing uuid, p_start timestamp, p_end timestamp, p_quantity int default 1, p_message text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  sp public.listing_spaces;
  me uuid := (select auth.uid());
  qty int := greatest(1, coalesce(p_quantity, 1));
  s timestamptz;
  e timestamptz;
  hours int;
  slot timestamptz;
  loc timestamp;
  conv uuid;
  req uuid;
  total int;
begin
  if me is null then raise exception 'login_required' using errcode = '42501'; end if;
  select * into l from public.listings where id = p_listing and status = 'published';
  if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if l.host_id = me then raise exception 'own_listing' using errcode = 'P0001'; end if;
  select * into sp from public.listing_spaces where listing_id = l.id and category = 'parking';
  if sp.id is null or sp.hourly_price is null then raise exception 'no_hourly' using errcode = 'P0001'; end if;

  -- Whole hours, at least one, from the current hour, at most 30 days.
  if p_start is null or p_end is null or date_trunc('hour', p_start) <> p_start or date_trunc('hour', p_end) <> p_end then
    raise exception 'bad_times' using errcode = 'P0001';
  end if;
  s := p_start at time zone 'Europe/Stockholm';
  e := p_end at time zone 'Europe/Stockholm';
  hours := round(extract(epoch from (e - s)) / 3600)::int;
  if hours < 1 or hours > 720 or s < date_trunc('hour', now()) then
    raise exception 'bad_times' using errcode = 'P0001';
  end if;
  if qty > sp.capacity then raise exception 'no_capacity' using errcode = 'P0001'; end if;

  -- One booking at a time per listing, so two people can't take the last space at once.
  perform pg_advisory_xact_lock(hashtext(l.id::text));

  -- Every hour must be one the host lets, on a day that isn't closed.
  for slot in select generate_series(s, e - interval '1 hour', interval '1 hour') loop
    loc := slot at time zone 'Europe/Stockholm';
    if not (extract(isodow from loc)::int = any (sp.hourly_days))
       or extract(hour from loc) < sp.hourly_from or extract(hour from loc) >= sp.hourly_to then
      raise exception 'outside_hours' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.listing_blocks b where b.listing_id = l.id and loc::date between b.start_date and b.end_date) then
      raise exception 'blocked' using errcode = 'P0001';
    end if;
  end loop;
  if private.parking_free_units(l.id, s, e) < qty then
    raise exception 'no_capacity' using errcode = 'P0001';
  end if;

  total := private.parking_host_total(hours, sp.hourly_price, sp.daily_max, qty);

  insert into public.conversations (listing_id, host_id, renter_id)
  values (l.id, l.host_id, me)
  on conflict (listing_id, renter_id) do update set last_message_at = now()
  returning id into conv;

  insert into public.requests (listing_id, conversation_id, host_id, renter_id, start_date, end_date, message,
                               status, kind, start_at, end_at, host_total, expires_at, responded_at)
  values (l.id, conv, l.host_id, me, (s at time zone 'Europe/Stockholm')::date,
          ((e - interval '1 second') at time zone 'Europe/Stockholm')::date, left(coalesce(p_message, ''), 1000),
          'accepted', 'hour', s, e, total, now(), now())
  returning id into req;

  insert into public.request_items (request_id, category, quantity, host_price_month, hourly_price, daily_max)
  values (req, 'parking', qty, null, sp.hourly_price, sp.daily_max);

  insert into public.messages (conversation_id, sender_id, kind, body) values (conv, me, 'event', 'parking_booked');
  if coalesce(p_message, '') <> '' then
    insert into public.messages (conversation_id, sender_id, body, created_at)
    values (conv, me, left(p_message, 2000), clock_timestamp());
  end if;
  return req;
end;
$$;

revoke all on function public.parking_availability(uuid, timestamp, timestamp) from public, anon;
revoke all on function public.book_parking(uuid, timestamp, timestamp, int, text) from public, anon;
grant execute on function public.parking_availability(uuid, timestamp, timestamp) to authenticated;
grant execute on function public.book_parking(uuid, timestamp, timestamp, int, text) to authenticated;

-- Monthly requests only for spaces that have a monthly price.
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
  if p_end is not null and (
       (l.min_period = 'week' and p_end < p_start + 6)
    or (l.min_period = 'month' and p_end < (p_start + interval '1 month')::date - 1)) then
    raise exception 'too_short' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.listing_blocks b
              where b.listing_id = l.id
                and (p_start between b.start_date and b.end_date
                     or (p_end is not null and p_end between b.start_date and b.end_date))) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.requests r
              where r.listing_id = l.id and r.renter_id = me and r.kind = 'month'
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
    if space.id is null or space.host_price_month is null then raise exception 'bad_category' using errcode = 'P0001'; end if;
    qty := greatest(1, coalesce((item ->> 'quantity')::int, 1));
    if qty > space.capacity - private.booked_units(l.id, space.category, p_start, p_end) then
      raise exception 'no_capacity' using errcode = 'P0001';
    end if;
    insert into public.request_items (request_id, category, quantity, host_price_month)
    values (req, space.category, qty, space.host_price_month);
  end loop;

  insert into public.messages (conversation_id, sender_id, kind, body) values (conv, me, 'event', 'request_sent');
  if coalesce(p_message, '') <> '' then
    insert into public.messages (conversation_id, sender_id, body, created_at)
    values (conv, me, left(p_message, 2000), clock_timestamp());
  end if;
  return req;
end;
$$;
