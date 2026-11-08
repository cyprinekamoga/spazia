-- Payments with Stripe Connect ("separate charges and transfers").
--
-- Renters pay Spazia by card (Apple Pay and Google Pay included). The host's
-- share is transferred to the host's Stripe account 24 hours after the rental
-- or booking starts, and Stripe pays it out to the host's bank every Monday.
-- Spazia keeps the difference (15 % from the renter, 5 % from the host) and
-- pays Stripe's fees out of it.
--
--  * Hourly parking: the booking is held for 30 minutes while the renter pays
--    in Stripe Checkout. Paid in time: it becomes a booking. Not paid: released.
--  * Monthly storage: the renter saves a card before sending a request. When
--    the host accepts, the first month is charged; then the same date every
--    month until the rental ends. A failed charge gives the renter a link to
--    pay: 48 hours for the first month, 7 days for later months.
--  * Ending a monthly rental that has started takes effect when the paid
--    period ends (end_rental). Cancelling before the start refunds in full.
--  * Hourly cancellations follow the rules in cancel_request; a free
--    cancellation is refunded in full.
--
-- Everything that talks to Stripe runs in the Edge Functions (supabase/functions).
-- The database queues the work and kicks the worker through pg_net.
--
-- Off until private.settings has 'payments_enabled' = 'true' (and
-- 'payments_url' = https://<project>.supabase.co/functions/v1).

-- Settings ---------------------------------------------------------------------
create or replace function private.setting(p_key text)
returns text language sql stable security definer set search_path = '' as $$
  select value from private.settings where key = p_key;
$$;

create or replace function private.payments_on()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select value from private.settings where key = 'payments_enabled'), 'false') = 'true';
$$;

revoke all on function private.setting(text) from public, anon, authenticated;
revoke all on function private.payments_on() from public, anon, authenticated;

create or replace function public.payments_config()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('enabled', private.payments_on());
$$;
revoke all on function public.payments_config() from public;
grant execute on function public.payments_config() to anon, authenticated;

-- Stripe ids (never writable by users) -----------------------------------------
create table if not exists private.stripe_customers (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  customer_id     text not null unique,
  payment_method  text,
  card_brand      text,
  card_last4      text,
  card_exp        text,
  updated_at      timestamptz not null default now()
);

create table if not exists private.stripe_accounts (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  account_id         text not null unique,
  details_submitted  boolean not null default false,
  transfers_active   boolean not null default false,
  payouts_enabled    boolean not null default false,
  requirements_due   text[] not null default '{}',
  updated_at         timestamptz not null default now()
);
revoke all on private.stripe_customers from public, anon, authenticated;
revoke all on private.stripe_accounts from public, anon, authenticated;

-- What a host must give for Skatteverket's platform reporting (DAC7, KU93).
-- Only the host can read or change it.
create table if not exists public.host_tax_info (
  user_id          uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  personal_number  text not null check (personal_number ~ '^(19|20)[0-9]{10}$'),
  full_name        text not null check (char_length(full_name) between 2 and 120),
  street_address   text not null check (char_length(street_address) between 2 and 200),
  postal_code      text not null check (postal_code ~ '^[0-9]{3} ?[0-9]{2}$'),
  city             text not null check (char_length(city) between 1 and 80),
  updated_at       timestamptz not null default now()
);
alter table public.host_tax_info enable row level security;
drop policy if exists "own tax info" on public.host_tax_info;
create policy "own tax info" on public.host_tax_info for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.host_tax_info from anon;
grant select, insert, update, delete on public.host_tax_info to authenticated;

-- The signed-in user's payment setup, for the app.
create or replace function public.my_payment_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'enabled', private.payments_on(),
    'card', (select jsonb_build_object('brand', c.card_brand, 'last4', c.card_last4, 'exp', c.card_exp)
               from private.stripe_customers c
              where c.user_id = (select auth.uid()) and c.payment_method is not null),
    'payouts', (select jsonb_build_object('details_submitted', a.details_submitted, 'transfers_active', a.transfers_active,
                                          'payouts_enabled', a.payouts_enabled, 'requirements_due', a.requirements_due)
                  from private.stripe_accounts a where a.user_id = (select auth.uid())),
    'tax_info', exists (select 1 from public.host_tax_info t where t.user_id = (select auth.uid()))
  );
$$;
revoke all on function public.my_payment_status() from public, anon;
grant execute on function public.my_payment_status() to authenticated;

-- Requests ---------------------------------------------------------------------
alter table public.requests
  add column if not exists payment_required boolean not null default false,
  add column if not exists paid_through date,
  add column if not exists ended_by uuid references public.profiles (id) on delete set null,
  add column if not exists ended_at timestamptz;

-- Payments ---------------------------------------------------------------------
do $$ begin
  create type public.payment_status as enum ('due', 'processing', 'paid', 'failed', 'refunded', 'cancelled');
exception when duplicate_object then null; end $$;

-- One row per charge: an hourly booking, or one month of a monthly rental.
-- Amounts in whole kronor: amount is what the renter pays, host_amount what the host gets.
create table if not exists public.payments (
  id                     uuid primary key default gen_random_uuid(),
  request_id             uuid not null references public.requests (id) on delete cascade,
  renter_id              uuid not null references public.profiles (id) on delete cascade,
  host_id                uuid not null references public.profiles (id) on delete cascade,
  period_index           int not null default 0,
  period_start           date not null,
  period_end             date not null,
  amount                 int not null check (amount >= 0),
  host_amount            int not null check (host_amount >= 0 and host_amount <= amount),
  status                 public.payment_status not null default 'due',
  due_at                 timestamptz not null default now(),
  pay_by                 timestamptz not null,
  transfer_due_at        timestamptz not null,
  paid_at                timestamptz,
  transferred_at         timestamptz,
  refund_requested_at    timestamptz,
  refunded_at            timestamptz,
  refund_amount          int not null default 0,
  failure                text not null default '',
  attempts               int not null default 0,
  stripe_checkout_session text,
  stripe_payment_intent  text unique,
  stripe_charge          text,
  stripe_transfer        text,
  stripe_refund          text,
  created_at             timestamptz not null default now(),
  unique (request_id, period_index),
  check (period_end >= period_start)
);
create index if not exists payments_renter_idx on public.payments (renter_id, created_at desc);
create index if not exists payments_host_idx on public.payments (host_id, created_at desc);
create index if not exists payments_work_idx on public.payments (status, due_at);
alter table public.payments enable row level security;
drop policy if exists "parties read payments" on public.payments;
create policy "parties read payments" on public.payments for select to authenticated
  using ((select auth.uid()) in (renter_id, host_id));
revoke all on public.payments from anon;
revoke insert, update, delete on public.payments from authenticated;
grant select on public.payments to authenticated;

-- Same rounding as the app (src/lib/app/model.ts): whole kronor, halves up.
create or replace function private.renter_price(p int)
returns int language sql immutable set search_path = '' as $$ select round(p * 115 / 100.0)::int $$;
create or replace function private.host_payout(p int)
returns int language sql immutable set search_path = '' as $$ select round(p * 95 / 100.0)::int $$;
revoke all on function private.renter_price(int) from public, anon, authenticated;
revoke all on function private.host_payout(int) from public, anon, authenticated;

-- Today in Sweden.
create or replace function private.today()
returns date language sql stable set search_path = '' as $$ select (now() at time zone 'Europe/Stockholm')::date $$;

-- The payment for month k of a monthly rental (k = 0 is the first). The last month
-- of a rental with an end date is charged per day. Returns null past the end date.
create or replace function private.create_period_payment(p_request uuid, p_index int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  ps date;
  natural_end date;
  pe date;
  full_amount int;
  full_host int;
  pay int;
  host int;
  pid uuid;
begin
  select * into r from public.requests where id = p_request;
  ps := (r.start_date + make_interval(months => p_index))::date;
  natural_end := (r.start_date + make_interval(months => p_index + 1))::date - 1;
  if r.end_date is not null and ps > r.end_date then return null; end if;
  pe := least(natural_end, coalesce(r.end_date, natural_end));
  select coalesce(sum(private.renter_price(i.host_price_month) * i.quantity), 0),
         coalesce(sum(private.host_payout(i.host_price_month) * i.quantity), 0)
    into full_amount, full_host
    from public.request_items i
   where i.request_id = r.id and i.host_price_month is not null;
  if pe < natural_end then
    pay := round(full_amount * (pe - ps + 1)::numeric / (natural_end - ps + 1));
    host := least(pay, round(full_host * (pe - ps + 1)::numeric / (natural_end - ps + 1))::int);
  else
    pay := full_amount;
    host := full_host;
  end if;
  insert into public.payments (request_id, renter_id, host_id, period_index, period_start, period_end,
                               amount, host_amount, due_at, pay_by, transfer_due_at)
  values (r.id, r.renter_id, r.host_id, p_index, ps, pe, pay, host, now(),
          now() + case when p_index = 0 then interval '48 hours' else interval '7 days' end,
          (ps::timestamp at time zone 'Europe/Stockholm') + interval '24 hours')
  on conflict (request_id, period_index) do nothing
  returning id into pid;
  return pid;
end;
$$;
revoke all on function private.create_period_payment(uuid, int) from public, anon, authenticated;

-- Worker kick ------------------------------------------------------------------
-- The worker (Edge Function payments-worker) charges, transfers and refunds.
-- It is called with a one-time token that it checks against this table.
create table if not exists private.worker_tokens (
  token       text primary key default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at  timestamptz not null default now()
);
revoke all on private.worker_tokens from public, anon, authenticated;

create or replace function private.kick_payments()
returns void language plpgsql security definer set search_path = '' as $$
declare
  url text := private.setting('payments_url');
  t text;
begin
  if url is null or url = '' or not private.payments_on() then return; end if;
  delete from private.worker_tokens where created_at < now() - interval '1 hour';
  insert into private.worker_tokens default values returning token into t;
  perform net.http_post(
    url := url || '/payments-worker',
    body := jsonb_build_object('token', t),
    headers := jsonb_build_object('content-type', 'application/json'),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function private.kick_payments() from public, anon, authenticated;

-- Emails -----------------------------------------------------------------------
alter table private.notifications drop constraint if exists notifications_kind_check;
alter table private.notifications add constraint notifications_kind_check check (kind in (
  'request_new', 'parking_booked', 'request_accepted', 'request_declined',
  'cancelled_by_renter', 'cancelled_by_host',
  'payment_failed', 'payment_lapsed', 'rental_ending'));

create or replace function private.queue_notification(p_request uuid, p_kind text, p_recipient uuid, p_prev text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  nid uuid;
begin
  insert into private.notifications (request_id, kind, recipient, prev_status)
  values (p_request, p_kind, p_recipient, p_prev)
  returning id into nid;
  perform private.post_notification(nid);
end;
$$;
revoke all on function private.queue_notification(uuid, text, uuid, text) from public, anon, authenticated;

create or replace function private.requests_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'month' and new.status = 'pending' then
      perform private.queue_notification(new.id, 'request_new', new.host_id);
    elsif new.kind = 'hour' and new.status = 'accepted' then
      perform private.queue_notification(new.id, 'parking_booked', new.host_id);
    end if;
    return new;
  end if;
  if new.status is not distinct from old.status then return new; end if;

  -- A parking hold that wasn't paid: the host never saw it.
  if new.kind = 'hour' and old.status = 'pending' and new.status in ('expired', 'cancelled') then return new; end if;

  if new.status = 'accepted' and old.status = 'pending' then
    if new.kind = 'hour' then
      perform private.queue_notification(new.id, 'parking_booked', new.host_id);
    else
      perform private.queue_notification(new.id, 'request_accepted', new.renter_id);
    end if;
  elsif new.status = 'declined' then
    perform private.queue_notification(new.id, 'request_declined', new.renter_id);
  elsif new.status = 'cancelled' then
    if new.cancelled_by is null then
      -- Cancelled by the system because the payment never came.
      perform private.queue_notification(new.id, 'payment_lapsed', new.renter_id, old.status::text);
      perform private.queue_notification(new.id, 'payment_lapsed', new.host_id, old.status::text);
    elsif new.cancelled_by = new.host_id then
      perform private.queue_notification(new.id, 'cancelled_by_host', new.renter_id, old.status::text);
    else
      perform private.queue_notification(new.id, 'cancelled_by_renter', new.host_id, old.status::text);
    end if;
  end if;
  return new;
end;
$$;

-- The email gets the latest payment and the end date too.
create or replace function public.claim_notification(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  n private.notifications;
  r public.requests;
  l public.listings;
  pay public.payments;
  other uuid;
begin
  update private.notifications
     set claimed_at = now()
   where id = p_id and token = p_token and sent_at is null
     and (claimed_at is null or claimed_at < now() - interval '10 minutes')
     and created_at > now() - interval '1 day'
  returning * into n;
  if n.id is null then return null; end if;

  select * into r from public.requests where id = n.request_id;
  select * into l from public.listings where id = r.listing_id;
  select * into pay from public.payments where request_id = r.id order by period_index desc limit 1;
  other := case when n.recipient = r.host_id then r.renter_id else r.host_id end;

  return jsonb_build_object(
    'kind', n.kind,
    'prev_status', n.prev_status,
    'role', case when n.recipient = r.host_id then 'host' else 'renter' end,
    'to_email', (select u.email from auth.users u where u.id = n.recipient),
    'to_name', (select p.first_name from public.profiles p where p.id = n.recipient),
    'other_name', (select p.first_name from public.profiles p where p.id = other),
    'request_id', r.id,
    'request_kind', r.kind,
    'start_date', r.start_date,
    'end_date', r.end_date,
    'start_at', r.start_at,
    'end_at', r.end_at,
    'host_total', r.host_total,
    'message', r.message,
    'expires_at', r.expires_at,
    'decline_reason', r.decline_reason,
    'cancel_reason', r.cancel_reason,
    'listing_title', l.title,
    'listing_city', l.city,
    'listing_area', l.area_name,
    'payment', case when pay.id is null then null else jsonb_build_object(
      'amount', pay.amount, 'host_amount', pay.host_amount, 'status', pay.status,
      'period_start', pay.period_start, 'period_end', pay.period_end, 'pay_by', pay.pay_by, 'failure', pay.failure) end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'category', i.category, 'quantity', i.quantity, 'host_price_month', i.host_price_month,
               'hourly_price', i.hourly_price, 'daily_max', i.daily_max) order by i.category)
        from public.request_items i where i.request_id = r.id), '[]'::jsonb)
  );
end;
$$;

-- Payment results (called by the Edge Functions) -------------------------------
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
    -- The hold becomes a booking.
    update public.requests set status = 'accepted', responded_at = now() where id = r.id;
    insert into public.messages (conversation_id, sender_id, kind, body) values (r.conversation_id, r.renter_id, 'event', 'parking_booked');
    if coalesce(r.message, '') <> '' then
      insert into public.messages (conversation_id, sender_id, body, created_at)
      values (r.conversation_id, r.renter_id, left(r.message, 2000), clock_timestamp());
    end if;
  end if;
end;
$$;

create or replace function private.payment_failed(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
begin
  update public.payments set status = 'failed', failure = left(coalesce(p_reason, ''), 300)
   where id = p_payment and status in ('due', 'processing')
  returning * into p;
  if p.id is null then return; end if;
  -- Hourly bookings are paid in Checkout, where the renter sees the error directly.
  if (select kind from public.requests where id = p.request_id) = 'month' then
    perform private.queue_notification(p.request_id, 'payment_failed', p.renter_id);
  end if;
end;
$$;

-- Cancel what hasn't been charged; refund what was paid for a period that hasn't started.
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
  perform private.kick_payments();
end;
$$;

revoke all on function private.payment_succeeded(uuid, text, text) from public, anon, authenticated;
revoke all on function private.payment_failed(uuid, text) from public, anon, authenticated;
revoke all on function private.settle_cancellation(uuid) from public, anon, authenticated;

-- Address, access and phone only once the booking is paid (when payment applies).
create or replace function private.has_accepted_request(p_listing uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r
     where r.listing_id = p_listing and r.renter_id = (select auth.uid()) and r.status = 'accepted'
       and (not r.payment_required or r.paid_through is not null)
  );
$$;

create or replace function private.shares_accepted_request(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r
     where r.status = 'accepted'
       and (not r.payment_required or r.paid_through is not null)
       and ((r.host_id = p_other and r.renter_id = (select auth.uid()))
         or (r.renter_id = p_other and r.host_id = (select auth.uid())))
  );
$$;

-- Unpaid parking holds take a space while they last.
create or replace function private.parking_free_units(p_listing uuid, p_start timestamptz, p_end timestamptz)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(min(s.capacity
      - coalesce((select sum(i.quantity) from public.requests r join public.request_items i on i.request_id = r.id
                   where r.listing_id = p_listing and r.status = 'accepted' and r.kind = 'month' and i.category = 'parking'
                     and r.start_date <= (h.slot at time zone 'Europe/Stockholm')::date
                     and coalesce(r.end_date, 'infinity'::date) >= (h.slot at time zone 'Europe/Stockholm')::date), 0)
      - coalesce((select sum(i.quantity) from public.requests r join public.request_items i on i.request_id = r.id
                   where r.listing_id = p_listing and r.kind = 'hour' and i.category = 'parking'
                     and (r.status = 'accepted' or (r.status = 'pending' and r.expires_at > now()))
                     and r.start_at <= h.slot and r.end_at > h.slot), 0)
    ), 0)::int
  from public.listing_spaces s
  cross join generate_series(p_start, p_end - interval '1 hour', interval '1 hour') as h(slot)
  where s.listing_id = p_listing and s.category = 'parking';
$$;

-- Hourly parking: with payments on, the booking is a 30-minute hold until paid.
create or replace function public.book_parking(
  p_listing uuid, p_start timestamp, p_end timestamp, p_quantity int default 1, p_message text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  sp public.listing_spaces;
  me uuid := (select auth.uid());
  qty int := greatest(1, coalesce(p_quantity, 1));
  pay boolean := private.payments_on();
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
  if pay and not exists (select 1 from private.stripe_accounts a where a.user_id = l.host_id and a.details_submitted) then
    raise exception 'host_not_ready' using errcode = 'P0001';
  end if;

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

  perform pg_advisory_xact_lock(hashtext(l.id::text));

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
                               status, kind, start_at, end_at, host_total, expires_at, responded_at, payment_required)
  values (l.id, conv, l.host_id, me, (s at time zone 'Europe/Stockholm')::date,
          ((e - interval '1 second') at time zone 'Europe/Stockholm')::date, left(coalesce(p_message, ''), 1000),
          case when pay then 'pending'::public.request_status else 'accepted'::public.request_status end,
          'hour', s, e, total,
          case when pay then now() + interval '30 minutes' else now() end,
          case when pay then null else now() end,
          pay)
  returning id into req;

  insert into public.request_items (request_id, category, quantity, host_price_month, hourly_price, daily_max)
  values (req, 'parking', qty, null, sp.hourly_price, sp.daily_max);

  if pay then
    insert into public.payments (request_id, renter_id, host_id, period_index, period_start, period_end,
                                 amount, host_amount, due_at, pay_by, transfer_due_at)
    values (req, me, l.host_id, 0, (s at time zone 'Europe/Stockholm')::date,
            ((e - interval '1 second') at time zone 'Europe/Stockholm')::date,
            private.parking_host_total(hours, private.renter_price(sp.hourly_price),
                                       case when sp.daily_max is null then null else private.renter_price(sp.daily_max) end, qty),
            private.host_payout(total), now(), now() + interval '30 minutes', s + interval '24 hours');
  else
    insert into public.messages (conversation_id, sender_id, kind, body) values (conv, me, 'event', 'parking_booked');
    if coalesce(p_message, '') <> '' then
      insert into public.messages (conversation_id, sender_id, body, created_at)
      values (conv, me, left(p_message, 2000), clock_timestamp());
    end if;
  end if;
  return req;
end;
$$;

-- Monthly requests: with payments on, the renter needs a saved card first.
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
  pay boolean := private.payments_on();
begin
  if me is null then raise exception 'login_required' using errcode = '42501'; end if;
  select * into l from public.listings where id = p_listing and status = 'published';
  if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if l.host_id = me then raise exception 'own_listing' using errcode = 'P0001'; end if;
  if pay and not exists (select 1 from private.stripe_customers c where c.user_id = me and c.payment_method is not null) then
    raise exception 'card_required' using errcode = 'P0001';
  end if;
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

  insert into public.requests (listing_id, conversation_id, host_id, renter_id, start_date, end_date, message, payment_required)
  values (l.id, conv, l.host_id, me, p_start, p_end, left(coalesce(p_message, ''), 1000), pay)
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

-- Accepting a paid request needs the host's payouts set up, and charges the first month.
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
  -- Parking holds are paid, not answered.
  if r.status <> 'pending' or r.kind = 'hour' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  if r.expires_at < now() then
    update public.requests set status = 'expired' where id = r.id;
    return 'expired';
  end if;

  if p_accept then
    if r.payment_required and not exists (select 1 from private.stripe_accounts a where a.user_id = r.host_id and a.details_submitted) then
      raise exception 'payouts_required' using errcode = 'P0001';
    end if;
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
    if r.payment_required then
      perform private.create_period_payment(r.id, 0);
      perform private.kick_payments();
    end if;
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

-- Cancelling: as before, plus refunds. A paid monthly rental that has started is
-- ended with end_rental instead, at the end of the paid period.
create or replace function public.cancel_request(p_request uuid, p_reason text default '')
returns public.request_status
language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  me uuid := (select auth.uid());
  reason text := left(trim(coalesce(p_reason, '')), 500);
begin
  select * into r from public.requests where id = p_request for update;
  if r.id is null or me is null or me not in (r.host_id, r.renter_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status not in ('pending', 'accepted') then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  if r.kind = 'hour' and r.status = 'accepted' then
    if now() >= r.start_at then
      raise exception 'already_started' using errcode = 'P0001';
    end if;
    if me = r.renter_id and now() > r.start_at - interval '1 hour' then
      raise exception 'too_late' using errcode = 'P0001';
    end if;
  end if;
  if r.kind = 'month' and r.status = 'accepted' and r.payment_required and private.today() >= r.start_date then
    raise exception 'already_started' using errcode = 'P0001';
  end if;

  update public.requests
     set status = 'cancelled', responded_at = coalesce(responded_at, now()),
         cancelled_by = me, cancelled_at = now(), cancel_reason = reason
   where id = r.id;
  -- An unpaid parking hold leaves no trace in the conversation.
  if not (r.kind = 'hour' and r.status = 'pending') then
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (r.conversation_id, me, 'event', 'request_cancelled');
    if reason <> '' then
      insert into public.messages (conversation_id, sender_id, body, created_at)
      values (r.conversation_id, me, reason, clock_timestamp());
    end if;
  end if;
  if r.payment_required then
    perform private.settle_cancellation(r.id);
  end if;
  return 'cancelled';
end;
$$;

-- End a monthly rental that has started. With payments it ends when the paid
-- period ends (no more charges); without, it ends today. Returns the last day.
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
     set end_date = last_day, ended_by = me, ended_at = now(), cancel_reason = reason
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
  return last_day;
end;
$$;
revoke all on function public.end_rental(uuid, text) from public, anon;
grant execute on function public.end_rental(uuid, text) to authenticated;

-- Housekeeping every 10 minutes (no Stripe calls) --------------------------------
create or replace function private.payments_housekeeping()
returns void language plpgsql security definer set search_path = '' as $$
declare
  rec record;
  next_index int;
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

  -- A later month never paid: the rental ends after the last paid day.
  for rec in select r.id, r.renter_id, r.host_id, r.paid_through, r.conversation_id, p.id as payment_id
               from public.requests r
               join public.payments p on p.request_id = r.id and p.period_index > 0
              where r.kind = 'month' and r.status = 'accepted' and r.payment_required
                and p.status in ('due', 'failed') and p.pay_by < now() loop
    update public.payments set status = 'cancelled' where id = rec.payment_id;
    update public.requests set end_date = rec.paid_through, ended_at = now(), ended_by = null where id = rec.id;
    insert into public.messages (conversation_id, sender_id, kind, body) values (rec.conversation_id, rec.renter_id, 'event', 'payment_lapsed');
    perform private.queue_notification(rec.id, 'payment_lapsed', rec.renter_id, 'accepted');
    perform private.queue_notification(rec.id, 'payment_lapsed', rec.host_id, 'accepted');
  end loop;

  -- Next month's payment, on the day it starts.
  for rec in select r.id from public.requests r
              where r.kind = 'month' and r.status = 'accepted' and r.payment_required
                and r.paid_through is not null and r.paid_through < private.today()
                and (r.end_date is null or r.paid_through < r.end_date)
                and not exists (select 1 from public.payments p where p.request_id = r.id and p.status in ('due', 'processing', 'failed')) loop
    select coalesce(max(period_index), -1) + 1 into next_index from public.payments where request_id = rec.id;
    perform private.create_period_payment(rec.id, next_index);
  end loop;
end;
$$;
revoke all on function private.payments_housekeeping() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'spazia-payments';
select cron.schedule('spazia-payments', '*/10 * * * *', 'select private.payments_housekeeping(); select private.kick_payments();');

-- Skatteverket (DAC7, KU93): what each host earned per listing and quarter --------
create or replace view private.dac7_report as
select extract(year from p.paid_at at time zone 'Europe/Stockholm')::int as year,
       extract(quarter from p.paid_at at time zone 'Europe/Stockholm')::int as quarter,
       p.host_id,
       t.personal_number, t.full_name, t.street_address, t.postal_code, t.city,
       a.account_id as stripe_account,
       l.id as listing_id, lp.street_address as listing_address, lp.postal_code as listing_postal_code, l.city as listing_city,
       count(*) as rentals,
       sum(p.period_end - p.period_start + 1) as days_rented,
       sum(p.host_amount) as paid_to_host,
       sum(p.amount - p.host_amount) as spazia_fees
  from public.payments p
  join public.requests r on r.id = p.request_id
  join public.listings l on l.id = r.listing_id
  left join public.listing_private lp on lp.listing_id = l.id
  left join public.host_tax_info t on t.user_id = p.host_id
  left join private.stripe_accounts a on a.user_id = p.host_id
 where p.status = 'paid'
 group by 1, 2, p.host_id, t.personal_number, t.full_name, t.street_address, t.postal_code, t.city, a.account_id,
          l.id, lp.street_address, lp.postal_code, l.city;
revoke all on private.dac7_report from public, anon, authenticated;
