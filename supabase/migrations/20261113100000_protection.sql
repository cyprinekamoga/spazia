-- Spazia Skydd: an optional add-on a renter can choose for a monthly rental.
-- It costs a share of the monthly price (5 % to start with) and is charged as
-- its own line on every monthly invoice. The host's share is not affected.
--
-- Switched off until the legal side is settled (an insurance partner, or a
-- confirmed guarantee set-up): private.settings protection_enabled = 'true'.
-- The rate is copied onto the request when chosen, so a later change of rate
-- never changes a running rental.

alter table public.requests add column if not exists protection_rate numeric(4, 3)
  check (protection_rate is null or (protection_rate > 0 and protection_rate < 1));
alter table public.payments add column if not exists protection_amount int not null default 0 check (protection_amount >= 0);

insert into private.settings (key, value) values
  ('protection_enabled', 'false'),
  ('protection_rate', '0.05'),
  ('protection_cap', '10000')
on conflict (key) do nothing;

create or replace function private.protection_offer()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when private.setting('protection_enabled') = 'true' then
    jsonb_build_object('rate', private.setting('protection_rate')::numeric, 'cap', private.setting('protection_cap')::int)
  end;
$$;

-- The app's payment settings now also say whether the add-on is offered.
create or replace function public.payments_config()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('enabled', private.payments_on(),
                            'protection', case when private.payments_on() then private.protection_offer() end);
$$;
grant execute on function public.payments_config() to anon, authenticated;

-- The renter turns the add-on on or off while the request waits for the host.
create or replace function public.set_request_protection(p_request uuid, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  offer jsonb := private.protection_offer();
begin
  if p_on and offer is null then raise exception 'protection_unavailable' using errcode = 'P0001'; end if;
  update public.requests
     set protection_rate = case when p_on then (offer->>'rate')::numeric end
   where id = p_request and renter_id = (select auth.uid()) and status = 'pending' and kind = 'month';
  if not found then raise exception 'not_allowed' using errcode = 'P0001'; end if;
end;
$$;
revoke all on function public.set_request_protection(uuid, boolean) from public, anon;
grant execute on function public.set_request_protection(uuid, boolean) to authenticated;

-- Month amounts gain the add-on (included in amount and full_amount, so the
-- total charged is always amount; the rent part stays base).
drop function if exists private.period_amounts(uuid, int);
create function private.period_amounts(
  p_request uuid, p_index int,
  out ps date, out pe date, out natural_end date,
  out full_amount int, out full_host int, out full_base int, out full_protection int,
  out amount int, out host_amount int, out base int, out protection int)
returns record language plpgsql stable security definer set search_path = '' as $$
declare
  r public.requests;
  share numeric;
  priced int;
begin
  select * into r from public.requests where id = p_request;
  ps := (r.start_date + make_interval(months => p_index))::date;
  natural_end := (r.start_date + make_interval(months => p_index + 1))::date - 1;
  if r.end_date is not null and ps > r.end_date then
    ps := null;
    return;
  end if;
  pe := least(natural_end, coalesce(r.end_date, natural_end));
  select coalesce(sum(private.renter_price(i.host_price_month) * i.quantity), 0),
         coalesce(sum(private.host_payout(i.host_price_month) * i.quantity), 0),
         coalesce(sum(i.host_price_month * i.quantity), 0)
    into priced, full_host, full_base
    from public.request_items i
   where i.request_id = r.id and i.host_price_month is not null;
  full_protection := case when r.protection_rate is null then 0 else round(priced * r.protection_rate)::int end;
  full_amount := priced + full_protection;
  if pe < natural_end then
    share := (pe - ps + 1)::numeric / (natural_end - ps + 1);
    protection := round(full_protection * share)::int;
    amount := round(priced * share)::int + protection;
    host_amount := least(amount, round(full_host * share)::int);
    base := least(amount, round(full_base * share)::int);
  else
    protection := full_protection;
    amount := full_amount;
    host_amount := full_host;
    base := full_base;
  end if;
end;
$$;
revoke all on function private.period_amounts(uuid, int) from public, anon, authenticated;

create or replace function private.create_period_payment(p_request uuid, p_index int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  a record;
  pid uuid;
begin
  select * into r from public.requests where id = p_request;
  select * into a from private.period_amounts(p_request, p_index);
  if a.ps is null then return null; end if;
  insert into public.payments (request_id, renter_id, host_id, period_index, period_start, period_end,
                               amount, host_amount, protection_amount, due_at, pay_by, transfer_due_at)
  values (r.id, r.renter_id, r.host_id, p_index, a.ps, a.pe, a.amount, a.host_amount, a.protection, now(),
          now() + case when p_index = 0 then interval '48 hours' else interval '7 days' end,
          (a.ps::timestamp at time zone 'Europe/Stockholm') + interval '24 hours')
  on conflict (request_id, period_index) do nothing
  returning id into pid;
  if pid is null then
    select id into pid from public.payments where request_id = r.id and period_index = p_index;
  end if;
  return pid;
end;
$$;

create or replace function private.schedule_plan(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r public.requests;
  first record;
  a record;
  k int;
  full_months int := 0;
  last_amount int;
  last_base int;
  last_protection int;
begin
  select * into r from public.requests where id = p_request;
  select * into first from private.period_amounts(p_request, 1);
  if first.ps is null then return null; end if;
  if r.end_date is not null then
    for k in 1..600 loop
      select * into a from private.period_amounts(p_request, k);
      exit when a.ps is null;
      if a.pe < a.natural_end then
        last_amount := a.amount;
        last_base := a.base;
        last_protection := a.protection;
        exit;
      end if;
      full_months := full_months + 1;
    end loop;
  end if;
  return jsonb_build_object(
    'start', extract(epoch from (first.ps::timestamp at time zone 'Europe/Stockholm'))::bigint,
    'start_date', first.ps,
    'monthly', first.full_amount,
    'monthly_base', first.full_base,
    'monthly_protection', first.full_protection,
    'months', case when r.end_date is null then null else full_months end,
    'last', last_amount,
    'last_base', last_base,
    'last_protection', last_protection,
    'title', (select l.title from public.listings l where l.id = r.listing_id),
    'host_name', (select p.first_name from public.profiles p where p.id = r.host_id)
  );
end;
$$;

-- Damage reports under Spazia Skydd: stored, and the team is emailed.
create table if not exists public.protection_claims (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests (id) on delete cascade,
  renter_id   uuid not null references public.profiles (id) on delete cascade,
  description text not null check (char_length(description) between 10 and 4000),
  amount      int check (amount is null or amount between 1 and 1000000),
  status      text not null default 'open' check (status in ('open', 'approved', 'declined')),
  created_at  timestamptz not null default now()
);
alter table public.protection_claims enable row level security;
drop policy if exists "renter reads own claims" on public.protection_claims;
create policy "renter reads own claims" on public.protection_claims for select to authenticated
  using (renter_id = (select auth.uid()));
revoke all on public.protection_claims from anon;
grant select on public.protection_claims to authenticated;

create or replace function public.submit_protection_claim(p_request uuid, p_description text, p_amount int default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  cid uuid;
begin
  select * into r from public.requests
   where id = p_request and renter_id = (select auth.uid()) and protection_rate is not null and status = 'accepted';
  if r.id is null then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_description, ''))) < 10 then raise exception 'too_short' using errcode = 'P0001'; end if;
  insert into public.protection_claims (request_id, renter_id, description, amount)
  values (r.id, r.renter_id, left(btrim(p_description), 4000), p_amount)
  returning id into cid;
  perform private.raise_alert(
    'protection_claim',
    'Ny skadeanmälan (Spazia Skydd)',
    format(E'En hyresgäst har anmält skada eller förlust under Spazia Skydd.\n\nBokning: %s\nBelopp: %s\n\n%s\n\nInlämningslistan med bilder finns på bokningen i appen. Svara hyresgästen inom några dagar.',
           r.id, coalesce(p_amount::text || ' kr', 'inte angivet'), left(btrim(p_description), 4000)),
    'protection_claim:' || cid::text,
    interval '1 minute');
  return cid;
end;
$$;
revoke all on function public.submit_protection_claim(uuid, text, int) from public, anon;
grant execute on function public.submit_protection_claim(uuid, text, int) to authenticated;
