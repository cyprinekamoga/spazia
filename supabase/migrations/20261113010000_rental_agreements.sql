-- Rental agreement. Every request or parking booking is one agreement between
-- host and renter, on Spazia's standard terms (src/content/agreement.ts, by
-- version). The renter accepts it when sending the request or booking
-- (agree_to_rental). The host accepts it by approving the request, or, for
-- hourly parking, by letting the space be booked directly. When both have
-- accepted, the details of the deal are frozen in agreement, so later edits to
-- the listing don't change what was agreed. Address and last names are not
-- frozen here: the app shows them under the usual rules (after payment).

alter table public.requests
  add column if not exists agreement_version text,
  add column if not exists renter_agreed_at timestamptz,
  add column if not exists host_agreed_at timestamptz,
  add column if not exists agreement jsonb;

-- What was agreed: the deal as it stood when the host accepted.
create or replace function private.agreement_snapshot(p_request uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'kind', r.kind,
    'start_date', r.start_date,
    'end_date', r.end_date,
    'start_at', r.start_at,
    'end_at', r.end_at,
    'host_total', r.host_total,
    'payment_required', r.payment_required,
    'host_first_name', (select p.first_name from public.profiles p where p.id = r.host_id),
    'renter_first_name', (select p.first_name from public.profiles p where p.id = r.renter_id),
    'listing', jsonb_build_object(
      'title', l.title, 'space_type', l.space_type, 'city', l.city, 'area_name', l.area_name,
      'size_m2', l.size_m2, 'heated', l.heated, 'features', l.features,
      'access', l.access, 'access_notes', l.access_notes, 'min_period', l.min_period, 'rules', l.rules),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'category', i.category, 'quantity', i.quantity,
               'host_price_month', i.host_price_month, 'hourly_price', i.hourly_price, 'daily_max', i.daily_max,
               'renter_price_month', case when i.host_price_month is null then null else private.renter_price(i.host_price_month) end)
             order by i.category)
        from public.request_items i where i.request_id = r.id), '[]'::jsonb)
  )
  from public.requests r join public.listings l on l.id = r.listing_id
  where r.id = p_request;
$$;
revoke all on function private.agreement_snapshot(uuid) from public, anon, authenticated;

-- The host accepts the agreement when the request is accepted (or the parking booking confirmed).
create or replace function private.requests_agreement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.host_agreed_at := coalesce(new.host_agreed_at, now());
    new.agreement := coalesce(new.agreement, private.agreement_snapshot(new.id));
  end if;
  return new;
end;
$$;
revoke all on function private.requests_agreement() from public, anon, authenticated;

drop trigger if exists requests_agreement on public.requests;
create trigger requests_agreement before update of status on public.requests
  for each row execute function private.requests_agreement();

-- The renter accepts the agreement (version from the app) for their request.
create or replace function public.agree_to_rental(p_request uuid, p_version text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
begin
  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'bad_request' using errcode = 'P0001';
  end if;
  select * into r from public.requests where id = p_request for update;
  if r.id is null or r.renter_id <> (select auth.uid()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status not in ('pending', 'accepted') then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
  if r.renter_agreed_at is null then
    update public.requests
       set renter_agreed_at = now(), agreement_version = p_version
     where id = r.id
    returning renter_agreed_at into r.renter_agreed_at;
  end if;
  return r.renter_agreed_at;
end;
$$;
revoke all on function public.agree_to_rental(uuid, text) from public, anon;
grant execute on function public.agree_to_rental(uuid, text) to authenticated;
