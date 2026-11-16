-- A host doesn't need payout details (a connected Stripe account) to accept a
-- paid request or to take a parking booking; the money waits for them instead.
begin;

insert into private.settings (key, value) values ('payments_enabled', 'true') on conflict (key) do update set value = 'true';
select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.renter', tests.new_user('renter@example.com', 'Rolf')::text, true);
select set_config('t.listing', tests.new_listing(current_setting('t.host')::uuid, 'Luleå', 100)::text, true);
select set_config('t.req', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.renter')::uuid)::text, true);
update public.requests set payment_required = true where id = current_setting('t.req')::uuid;

-- A parking space by the hour on the same listing, open around the clock.
insert into public.listing_spaces (listing_id, category, capacity, hourly_price, hourly_days, hourly_from, hourly_to)
values (current_setting('t.listing')::uuid, 'parking', 2, 20, '{1,2,3,4,5,6,7}', 0, 24);

do $$ begin
  perform tests.ok(not exists (select 1 from private.stripe_accounts where user_id = current_setting('t.host')::uuid), 'host has no payout account');
end $$;

-- The host accepts the monthly request: allowed, and the first month is due from the renter.
set local role authenticated;
do $$
declare res public.request_status;
begin
  perform tests.act_as(current_setting('t.host')::uuid);
  res := public.respond_to_request(current_setting('t.req')::uuid, true);
  perform tests.ok(res = 'accepted', 'accepted without payout details, got ' || res);
end $$;
reset role;
do $$ begin
  perform tests.ok(exists (select 1 from public.payments where request_id = current_setting('t.req')::uuid and period_index = 0 and stripe_transfer is null),
                   'first month created, nothing transferred');
end $$;

-- A renter books parking with the same host: allowed, as a 30-minute hold to pay.
set local role authenticated;
do $$
declare
  req uuid;
  start_local timestamp := date_trunc('day', now() at time zone 'Europe/Stockholm') + interval '2 days 10 hours';
begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  req := public.book_parking(current_setting('t.listing')::uuid, start_local, start_local + interval '3 hours');
  perform set_config('t.park', req::text, true);
end $$;
reset role;
do $$ begin
  perform tests.ok(exists (select 1 from public.requests where id = current_setting('t.park')::uuid and status = 'pending' and kind = 'hour'),
                   'parking hold created without payout details');
  perform tests.ok(exists (select 1 from public.payments where request_id = current_setting('t.park')::uuid), 'parking payment created');
end $$;

-- The renter pays the first month: the host is emailed an hour later to add payout details.
update public.payments set status = 'paid' where request_id = current_setting('t.req')::uuid and period_index = 0;
do $$
declare n private.notifications;
begin
  select * into n from private.notifications where recipient = current_setting('t.host')::uuid and kind = 'payout_setup';
  perform tests.ok(n.id is not null and n.prev_status = 'paid' and n.request_id = current_setting('t.req')::uuid, 'payout_setup queued for the host');
  perform tests.ok(n.send_after > now() + interval '50 minutes', 'sent about an hour later, not with the booking email');
end $$;

-- The parking payment right after: no second email the same week.
update public.payments set status = 'paid' where request_id = current_setting('t.park')::uuid;
do $$ begin
  perform tests.ok((select count(*) from private.notifications where recipient = current_setting('t.host')::uuid and kind = 'payout_setup') = 1,
                   'at most one payout_setup email a week');
end $$;

-- A week later the share is due but can't be paid out: a reminder, and no "transfers late" alert to the team.
update private.notifications set created_at = now() - interval '8 days' where recipient = current_setting('t.host')::uuid and kind = 'payout_setup';
update public.payments set transfer_due_at = now() - interval '2 days' where request_id = current_setting('t.req')::uuid;
select private.payout_setup_reminders();
select private.health_check();
do $$ begin
  perform tests.ok(exists (select 1 from private.notifications where recipient = current_setting('t.host')::uuid and kind = 'payout_setup'
                             and prev_status = 'reminder' and created_at > now() - interval '1 minute'), 'weekly reminder while the money waits');
  perform tests.ok(not exists (select 1 from private.team_alerts where kind = 'transfers_late'), 'no team alert for a host without payout details');
end $$;

-- Once the host has sent in their details: no more emails, and a late transfer is a real problem again.
insert into private.stripe_accounts (user_id, account_id, details_submitted) values (current_setting('t.host')::uuid, 'acct_test', true);
delete from private.notifications where recipient = current_setting('t.host')::uuid and kind = 'payout_setup';
select private.payout_setup_reminders();
select private.health_check();
do $$ begin
  perform tests.ok(not exists (select 1 from private.notifications where recipient = current_setting('t.host')::uuid and kind = 'payout_setup'),
                   'no reminder once the host has payout details');
  perform tests.ok(exists (select 1 from private.team_alerts where kind = 'transfers_late'), 'late transfer alert for a host with payout details');
end $$;

rollback;
