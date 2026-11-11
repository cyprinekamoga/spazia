-- VAT. Spazia is VAT-registered and charges 25 % VAT on its own fees only.
-- The rent is passed on to the host, in the host's name, and Spazia charges no
-- VAT on it (storage is property letting; private hosts are normally below the
-- VAT threshold). So every charge is split in two:
--   base_amount            the host's rent (the host's price, before Spazia's 5 %)
--   amount - base_amount   Spazia's service fee (VAT included)
-- Prices to renters are unchanged: the VAT is included in Spazia's fee.
-- Stripe Tax calculates the VAT once private.settings has 'stripe_tax' = 'on',
-- which should only be set after the Swedish VAT registration is added in Stripe.

alter table public.payments
  add column if not exists base_amount int check (base_amount is null or base_amount >= 0);

-- period_amounts gets the rent part too (the out-parameters change, so drop first).
drop function if exists private.period_amounts(uuid, int);
create function private.period_amounts(
  p_request uuid, p_index int,
  out ps date, out pe date, out natural_end date,
  out full_amount int, out full_host int, out full_base int,
  out amount int, out host_amount int, out base int)
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.requests;
  share numeric;
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
    into full_amount, full_host, full_base
    from public.request_items i
   where i.request_id = r.id and i.host_price_month is not null;
  if pe < natural_end then
    share := (pe - ps + 1)::numeric / (natural_end - ps + 1);
    amount := round(full_amount * share);
    host_amount := least(amount, round(full_host * share)::int);
    base := least(amount, round(full_base * share)::int);
  else
    amount := full_amount;
    host_amount := full_host;
    base := full_base;
  end if;
end;
$$;
revoke all on function private.period_amounts(uuid, int) from public, anon, authenticated;

-- Every new payment gets its rent part: the host's total for parking, the month's rent otherwise.
create or replace function private.payments_set_base()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  k text;
begin
  if new.base_amount is null then
    select kind into k from public.requests where id = new.request_id;
    if k = 'hour' then
      new.base_amount := least(new.amount, (select coalesce(host_total, 0) from public.requests where id = new.request_id));
    else
      select least(new.amount, a.base) into new.base_amount from private.period_amounts(new.request_id, new.period_index) a;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.payments_set_base() from public, anon, authenticated;
drop trigger if exists payments_set_base on public.payments;
create trigger payments_set_base before insert on public.payments
  for each row execute function private.payments_set_base();

-- The schedule plan also says how much of each month is rent, and who the host is.
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
    'months', case when r.end_date is null then null else full_months end,
    'last', last_amount,
    'last_base', last_base,
    'title', (select l.title from public.listings l where l.id = r.listing_id),
    'host_name', (select p.first_name from public.profiles p where p.id = r.host_id)
  );
end;
$$;
