-- Hosts no longer need to connect a bank account (Stripe onboarding, with the
-- ID check) before they can accept a request or take a parking booking. People
-- give up when a sign-up starts with forms, so the app asks for the details once
-- there is money to pay out: after the first paid rental.
--
-- Nothing else changes for the money: the renter pays Spazia as before, and the
-- host's share is transferred a day after the period ends (payout_time), but
-- only to a connected account (payments-worker joins stripe_accounts on
-- transfers_active). Until the host has connected one, the share waits and goes
-- out on the worker's next run after they do.
--
-- Both functions are copied from 20261110000000_payments.sql with only the
-- check removed: 'payouts_required' in respond_to_request and 'host_not_ready'
-- in book_parking.

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

-- Asking for the payout details --------------------------------------------------
-- 'payout_setup' emails the host when money comes in for them and they haven't
-- connected a bank account: an hour after a renter's payment goes through (so it
-- doesn't arrive together with the booking email), and once a week while a share
-- is ready to pay out but has nowhere to go (prev_status 'reminder').
alter table private.notifications drop constraint if exists notifications_kind_check;
alter table private.notifications add constraint notifications_kind_check check (kind in (
  'request_new', 'parking_booked', 'request_accepted', 'request_declined', 'cancelled_by_renter', 'cancelled_by_host',
  'payment_failed', 'payment_lapsed', 'rental_ending', 'new_message', 'handover_new', 'handover_answered', 'review_invite',
  'search_match', 'payout_setup'));

/** True when the host has started payouts with Stripe (details sent in; Stripe may still be checking them). */
create or replace function private.host_has_payouts(p_host uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.stripe_accounts a where a.user_id = p_host and a.details_submitted);
$$;
revoke all on function private.host_has_payouts(uuid) from public, anon, authenticated;

/** Queue a payout_setup email, at most one per host a week. */
create or replace function private.queue_payout_setup(p_request uuid, p_host uuid, p_kind text, p_send_after timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.host_has_payouts(p_host) then return; end if;
  if exists (select 1 from private.notifications n
              where n.recipient = p_host and n.kind = 'payout_setup' and n.created_at > now() - interval '7 days') then
    return;
  end if;
  insert into private.notifications (request_id, kind, recipient, prev_status, send_after)
  values (p_request, 'payout_setup', p_host, p_kind, p_send_after);
end;
$$;
revoke all on function private.queue_payout_setup(uuid, uuid, text, timestamptz) from public, anon, authenticated;

create or replace function private.payments_payout_setup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.host_amount > 0 then
    -- Sent by private.retry_notifications once send_after has passed.
    perform private.queue_payout_setup(new.request_id, new.host_id, 'paid', now() + interval '1 hour');
  end if;
  return new;
end;
$$;
revoke all on function private.payments_payout_setup() from public, anon, authenticated;

drop trigger if exists payments_payout_setup on public.payments;
create trigger payments_payout_setup
  after update of status on public.payments
  for each row when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function private.payments_payout_setup();

-- Daily: shares that are due but can't be paid out because the host has no bank account.
create or replace function private.payout_setup_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare
  x record;
begin
  for x in select distinct on (p.host_id) p.host_id, p.request_id
             from public.payments p
            where p.status = 'paid' and p.stripe_transfer is null and p.transfer_due_at <= now()
              and p.refund_requested_at is null and p.disputed_at is null and p.host_amount > 0
              and not private.host_has_payouts(p.host_id)
            order by p.host_id, p.transfer_due_at
            limit 200 loop
    perform private.queue_payout_setup(x.request_id, x.host_id, 'reminder', now());
  end loop;
end;
$$;
revoke all on function private.payout_setup_reminders() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'spazia-payout-setup';
select cron.schedule('spazia-payout-setup', '41 9 * * *', 'select private.payout_setup_reminders()');

-- The health check's "transfers late" alert only counts hosts who have sent in
-- their payout details: waiting for a host who hasn't is now normal, and they get
-- their own reminders. Copied from 20261113030000_reports_admin_alerts.sql.
create or replace function private.health_check()
returns void language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  select count(*) into n from private.notifications
   where sent_at is null and attempts >= 5 and created_at > now() - interval '1 day';
  if n > 0 then
    perform private.raise_alert('emails_failing', format('%s mejl till användare gick inte att skicka', n),
      'Mejl om förfrågningar, bokningar eller meddelanden har misslyckats fem gånger. Kontrollera SMTP-inställningarna i Netlify och funktionsloggen för /api/notify.',
      'emails_failing', interval '6 hours');
  end if;

  select count(*) into n from private.notifications
   where sent_at is null and created_at < now() - interval '1 hour' and created_at > now() - interval '1 day'
     and send_after < now() - interval '1 hour';
  if n > 0 and coalesce(private.setting('notify_url'), '') <> '' then
    perform private.raise_alert('emails_stuck', format('%s mejl väntar på att skickas', n),
      'Mejl har väntat i kön i mer än en timme. Kontrollera att /api/notify svarar och att notify_url stämmer.',
      'emails_stuck', interval '6 hours');
  end if;

  select count(*) into n from public.payments where status = 'processing' and due_at < now() - interval '2 hours';
  if n > 0 then
    perform private.raise_alert('payments_stuck', format('%s betalningar har fastnat', n),
      'Betalningar har stått som "dras nu" i mer än två timmar. Kontrollera loggen för payments-worker i Supabase.',
      'payments_stuck', interval '6 hours');
  end if;

  select count(*) into n from public.payments
   where status = 'paid' and stripe_transfer is null and refund_requested_at is null and disputed_at is null
     and host_amount > 0 and transfer_due_at < now() - interval '1 day'
     and private.host_has_payouts(host_id);
  if n > 0 then
    perform private.raise_alert('transfers_late', format('%s utbetalningar till värdar är försenade', n),
      'Värdens del borde ha förts över för mer än ett dygn sedan, och värden har skickat in sina uppgifter till Stripe. Kanske granskar Stripe fortfarande kontot, eller så saknas något. Se Betalningar i adminsidan. (Värdar som inte har lagt till något bankkonto får egna påminnelser och räknas inte här.)',
      'transfers_late', interval '24 hours');
  end if;

  select count(*) into n from public.payments where disputed_at > now() - interval '1 hour';
  if n > 0 then
    perform private.raise_alert('disputes', format('%s ny tvist eller bedrägerivarning', n),
      'Stripe har rapporterat en tvist eller en bedrägerivarning. Värdens del hålls kvar. Svara på tvisten i Stripes Dashboard.',
      'disputes', interval '1 hour');
  end if;
end;
$$;
revoke all on function private.health_check() from public, anon, authenticated;
