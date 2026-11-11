-- Monthly rent through Stripe Billing.
--
-- The first month is still a one-off charge when the host accepts (saved card,
-- or Checkout if that fails). Once it is paid, the worker creates a Stripe
-- subscription schedule that starts when the second month starts and charges
-- the same date every month. A rental with an end date gets its last month
-- charged by the day, then the schedule stops. Stripe retries failed charges
-- and keeps the renter informed; the webhook records every invoice here
-- (record_invoice), and the host's share still moves 24 hours after each month
-- starts, as before. If Stripe gives up on a payment, the rental ends after
-- the last paid day (subscription_ended).

alter table public.requests
  add column if not exists stripe_schedule text unique,
  add column if not exists stripe_subscription text unique,
  add column if not exists stripe_sync_needed boolean not null default false;

alter table public.payments
  add column if not exists stripe_invoice text unique,
  add column if not exists hosted_invoice_url text,
  add column if not exists disputed_at timestamptz;

-- Month k of a monthly rental (k = 0 is the first): its dates and amounts.
-- ps is null past the end date. The last month of a rental with an end date is by the day.
create or replace function private.period_amounts(
  p_request uuid, p_index int,
  out ps date, out pe date, out natural_end date,
  out full_amount int, out full_host int, out amount int, out host_amount int)
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.requests;
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
         coalesce(sum(private.host_payout(i.host_price_month) * i.quantity), 0)
    into full_amount, full_host
    from public.request_items i
   where i.request_id = r.id and i.host_price_month is not null;
  if pe < natural_end then
    amount := round(full_amount * (pe - ps + 1)::numeric / (natural_end - ps + 1));
    host_amount := least(amount, round(full_host * (pe - ps + 1)::numeric / (natural_end - ps + 1))::int);
  else
    amount := full_amount;
    host_amount := full_host;
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
                               amount, host_amount, due_at, pay_by, transfer_due_at)
  values (r.id, r.renter_id, r.host_id, p_index, a.ps, a.pe, a.amount, a.host_amount, now(),
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

-- What the subscription schedule should charge after the first month, or null
-- when the rental ends within the first month. Amounts in kronor; start as a
-- Unix timestamp (midnight in Sweden). months is null for open-ended rentals.
create or replace function private.schedule_plan(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r public.requests;
  first record;
  a record;
  k int;
  full_months int := 0;
  last_amount int;
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
        exit;
      end if;
      full_months := full_months + 1;
    end loop;
  end if;
  return jsonb_build_object(
    'start', extract(epoch from (first.ps::timestamp at time zone 'Europe/Stockholm'))::bigint,
    'start_date', first.ps,
    'monthly', first.full_amount,
    'months', case when r.end_date is null then null else full_months end,
    'last', last_amount,
    'title', (select l.title from public.listings l where l.id = r.listing_id)
  );
end;
$$;
revoke all on function private.schedule_plan(uuid) from public, anon, authenticated;

-- After the first month is paid, the worker sets up the subscription schedule.
create or replace function private.payment_succeeded(p_payment uuid, p_intent text, p_charge text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  r public.requests;
begin
  select * into p from public.payments where id = p_payment for update;
  if p.id is null or p.status in ('paid', 'refunded') then return; end if;
  update public.payments
     set status = 'paid', paid_at = now(), failure = '',
         stripe_payment_intent = coalesce(p_intent, stripe_payment_intent),
         stripe_charge = coalesce(p_charge, stripe_charge)
   where id = p.id;

  select * into r from public.requests where id = p.request_id for update;

  -- Paid after the booking was released or cancelled: give the money back.
  if r.status not in ('pending', 'accepted') or (r.kind = 'hour' and r.status = 'pending' and r.expires_at < now() - interval '5 minutes') then
    update public.payments set refund_requested_at = now(), refund_amount = amount where id = p.id;
    if r.status = 'pending' then update public.requests set status = 'expired' where id = r.id; end if;
    perform private.kick_payments();
    return;
  end if;

  update public.requests set paid_through = greatest(coalesce(paid_through, p.period_end), p.period_end) where id = r.id;

  if r.kind = 'hour' and r.status = 'pending' then
    update public.requests set status = 'accepted', responded_at = now() where id = r.id;
    insert into public.messages (conversation_id, sender_id, kind, body) values (r.conversation_id, r.renter_id, 'event', 'parking_booked');
    if coalesce(r.message, '') <> '' then
      insert into public.messages (conversation_id, sender_id, body, created_at)
      values (r.conversation_id, r.renter_id, left(r.message, 2000), clock_timestamp());
    end if;
  end if;

  if r.kind = 'month' and r.payment_required and p.period_index = 0 and r.stripe_schedule is null then
    update public.requests set stripe_sync_needed = true where id = r.id;
    perform private.kick_payments();
  end if;
end;
$$;

-- Cancelling or ending a rental also stops the subscription (the worker does it).
create or replace function private.settle_cancellation(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
begin
  select * into r from public.requests where id = p_request;
  update public.payments set status = 'cancelled'
   where request_id = r.id and status in ('due', 'failed', 'processing');
  update public.payments
     set refund_requested_at = now(), refund_amount = amount
   where request_id = r.id and status = 'paid' and refund_requested_at is null
     and (case when r.kind = 'hour' then now() < r.start_at else private.today() < period_start end);
  update public.requests set stripe_sync_needed = true where id = r.id and stripe_schedule is not null;
  perform private.kick_payments();
end;
$$;

create or replace function public.end_rental(p_request uuid, p_reason text default '')
returns date
language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  me uuid := (select auth.uid());
  reason text := left(trim(coalesce(p_reason, '')), 500);
  last_day date;
begin
  select * into r from public.requests where id = p_request for update;
  if r.id is null or me is null or me not in (r.host_id, r.renter_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.kind <> 'month' or r.status <> 'accepted' then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  if private.today() < r.start_date then
    raise exception 'not_started' using errcode = 'P0001';
  end if;
  last_day := case when r.payment_required then greatest(coalesce(r.paid_through, private.today()), private.today()) else private.today() end;
  if r.end_date is not null and r.end_date <= last_day then
    raise exception 'already_ending' using errcode = 'P0001';
  end if;

  update public.requests
     set end_date = last_day, ended_by = me, ended_at = now(), cancel_reason = reason,
         stripe_sync_needed = (stripe_schedule is not null)
   where id = r.id;
  update public.payments set status = 'cancelled'
   where request_id = r.id and status in ('due', 'failed') and period_start > last_day;

  insert into public.messages (conversation_id, sender_id, kind, body)
  values (r.conversation_id, me, 'event', 'rental_ending');
  if reason <> '' then
    insert into public.messages (conversation_id, sender_id, body, created_at)
    values (r.conversation_id, me, reason, clock_timestamp());
  end if;
  perform private.queue_notification(r.id, 'rental_ending', case when me = r.host_id then r.renter_id else r.host_id end);
  perform private.kick_payments();
  return last_day;
end;
$$;

-- A subscription invoice from Stripe (month 2 onwards), paid or failed.
create or replace function private.record_invoice(
  p_schedule text, p_subscription text, p_invoice text, p_period_start date, p_amount int,
  p_paid boolean, p_intent text, p_charge text, p_hosted_url text, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  k int;
  pid uuid;
begin
  select * into r from public.requests
   where (p_schedule is not null and stripe_schedule = p_schedule)
      or (p_subscription is not null and stripe_subscription = p_subscription)
   limit 1;
  if r.id is null then return; end if;
  if r.stripe_subscription is null and p_subscription is not null then
    update public.requests set stripe_subscription = p_subscription where id = r.id;
  end if;

  -- The month that starts closest to the invoice's period (time zones can shift it a day).
  select g into k from generate_series(1, 600) g
   order by abs((r.start_date + make_interval(months => g))::date - p_period_start)
   limit 1;
  pid := private.create_period_payment(r.id, k);
  if pid is null then return; end if;

  -- Stripe's amount is what the renter actually pays for this month.
  update public.payments
     set stripe_invoice = coalesce(stripe_invoice, p_invoice),
         hosted_invoice_url = coalesce(p_hosted_url, hosted_invoice_url),
         amount = coalesce(p_amount, amount),
         host_amount = least(host_amount, coalesce(p_amount, amount))
   where id = pid;

  if p_paid then
    perform private.payment_succeeded(pid, p_intent, p_charge);
  else
    -- Stripe retries for about a week; the renter can pay on the invoice page meanwhile.
    update public.payments set pay_by = greatest(pay_by, now() + interval '7 days') where id = pid;
    perform private.payment_failed(pid, p_reason);
  end if;
end;
$$;

-- Stripe ended the subscription. If it was because the renter didn't pay, the
-- rental ends after the last paid day and both are told.
create or replace function private.subscription_ended(p_schedule text, p_subscription text, p_unpaid boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  last_day date;
begin
  select * into r from public.requests
   where (p_schedule is not null and stripe_schedule = p_schedule)
      or (p_subscription is not null and stripe_subscription = p_subscription)
   limit 1 for update;
  if r.id is null or r.status <> 'accepted' or r.ended_at is not null or not p_unpaid then return; end if;
  last_day := greatest(coalesce(r.paid_through, r.start_date), r.start_date);
  update public.requests set end_date = last_day, ended_at = now(), ended_by = null where id = r.id;
  update public.payments set status = 'cancelled'
   where request_id = r.id and status in ('due', 'failed', 'processing') and period_start > last_day;
  insert into public.messages (conversation_id, sender_id, kind, body) values (r.conversation_id, r.renter_id, 'event', 'payment_lapsed');
  perform private.queue_notification(r.id, 'payment_lapsed', r.renter_id, 'accepted');
  perform private.queue_notification(r.id, 'payment_lapsed', r.host_id, 'accepted');
end;
$$;

revoke all on function private.record_invoice(text, text, text, date, int, boolean, text, text, text, text) from public, anon, authenticated;
revoke all on function private.subscription_ended(text, text, boolean) from public, anon, authenticated;

-- Housekeeping: months 2 onwards are Stripe's job now (the subscription schedule).
-- The database only handles the first month and parking holds.
create or replace function private.payments_housekeeping()
returns void language plpgsql security definer set search_path = '' as $$
declare
  rec record;
begin
  if not private.payments_on() then return; end if;

  -- Parking holds that weren't paid in time are released.
  update public.payments p set status = 'cancelled'
    from public.requests r
   where r.id = p.request_id and r.kind = 'hour' and r.status = 'pending' and r.expires_at < now()
     and p.status in ('due', 'failed');
  update public.requests set status = 'expired'
   where kind = 'hour' and status = 'pending' and payment_required and expires_at < now() - interval '5 minutes';

  -- First month never paid: the rental is cancelled (both get an email).
  for rec in select r.id, p.id as payment_id from public.requests r
               join public.payments p on p.request_id = r.id and p.period_index = 0
              where r.kind = 'month' and r.status = 'accepted' and r.payment_required
                and p.status in ('due', 'failed') and p.pay_by < now() loop
    update public.payments set status = 'cancelled' where id = rec.payment_id;
    update public.requests set status = 'cancelled', cancelled_by = null, cancelled_at = now() where id = rec.id;
  end loop;

  -- A schedule that failed to be created is retried.
  update public.requests set stripe_sync_needed = true
   where kind = 'month' and status = 'accepted' and payment_required and paid_through is not null
     and stripe_schedule is null and not stripe_sync_needed
     and (end_date is null or end_date > paid_through);
end;
$$;

-- Disputed payments are not passed on to the host until the dispute is settled.
create or replace function private.payment_disputed(p_charge text)
returns void language sql security definer set search_path = '' as $$
  update public.payments set disputed_at = coalesce(disputed_at, now()) where stripe_charge = p_charge;
$$;
revoke all on function private.payment_disputed(text) from public, anon, authenticated;
