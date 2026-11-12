-- Account deletion: blocked while something is open; deleted outright without
-- history; anonymised and locked with history, keeping the other party's records.
begin;

select set_config('t.fresh', tests.new_user('fresh@example.com', 'Fresh')::text, true);
select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.renter', tests.new_user('renter@example.com', 'Rolf')::text, true);
select set_config('t.booked', tests.new_listing(current_setting('t.host')::uuid)::text, true);
select set_config('t.unbooked', tests.new_listing(current_setting('t.host')::uuid, 'Umeå')::text, true);
insert into auth.identities (provider_id, user_id, provider, email) values ('g-1', current_setting('t.host')::uuid, 'google', 'host@example.com');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (current_setting('t.host')::uuid, 'https://push.example/1', 'k', 'a');
insert into private.stripe_accounts (user_id, account_id) values (current_setting('t.host')::uuid, 'acct_test_1');
-- A pending request blocks both parties.
select set_config('t.req', tests.new_request(current_setting('t.booked')::uuid, current_setting('t.renter')::uuid)::text, true);

set local role authenticated;

-- Not signed in.
do $$ begin
  perform tests.act_as(null);
  begin
    perform public.account_deletion_status();
    perform tests.ok(false, 'status without login must fail');
  exception when insufficient_privilege then null; end;
end $$;

-- A fresh account is deleted outright.
do $$
declare s jsonb;
begin
  perform tests.act_as(current_setting('t.fresh')::uuid);
  s := public.account_deletion_status();
  perform tests.ok(s->>'mode' = 'delete' and (s->>'ok')::boolean, 'fresh account: delete, ok ' || s::text);
  perform tests.ok(public.delete_my_account() = 'deleted', 'fresh account deleted');
end $$;

-- The host is blocked by the pending request.
do $$
declare s jsonb;
begin
  perform tests.act_as(current_setting('t.host')::uuid);
  s := public.account_deletion_status();
  perform tests.ok(s->>'mode' = 'anonymise' and not (s->>'ok')::boolean and (s->'blockers'->>'pending_requests')::int = 1, 'host blocked by pending: ' || s::text);
  begin
    perform public.delete_my_account();
    perform tests.ok(false, 'delete must refuse while a request is pending');
  exception when raise_exception then
    perform tests.ok(sqlerrm = 'account_busy', 'refused with account_busy, got ' || sqlerrm);
  end;
end $$;

reset role;
-- Accepted and running: still blocked (as an active rental).
update public.requests set status = 'accepted', start_date = current_date - 30 where id = current_setting('t.req')::uuid;
set local role authenticated;
do $$
declare s jsonb;
begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  s := public.account_deletion_status();
  perform tests.ok((s->'blockers'->>'active_rentals')::int = 1 and not (s->>'ok')::boolean, 'renter blocked by active rental: ' || s::text);
end $$;

reset role;
-- Ended, but a payment is still on its way to the host: blocked.
update public.requests set end_date = current_date - 1 where id = current_setting('t.req')::uuid;
insert into public.payments (request_id, renter_id, host_id, period_start, period_end, amount, host_amount, status, pay_by, transfer_due_at, paid_at)
values (current_setting('t.req')::uuid, current_setting('t.renter')::uuid, current_setting('t.host')::uuid,
        current_date - 30, current_date - 1, 115, 95, 'paid', now() - interval '30 days', now() + interval '1 day', now() - interval '29 days');
set local role authenticated;
do $$
declare s jsonb;
begin
  perform tests.act_as(current_setting('t.host')::uuid);
  s := public.account_deletion_status();
  perform tests.ok((s->'blockers'->>'open_payments')::int = 1 and (s->'blockers'->>'active_rentals')::int = 0, 'host blocked by payout: ' || s::text);
end $$;

reset role;
update public.payments set transferred_at = now() where request_id = current_setting('t.req')::uuid;
set local role authenticated;

-- Now the host can go: anonymised.
do $$
declare s jsonb;
begin
  perform tests.act_as(current_setting('t.host')::uuid);
  s := public.account_deletion_status();
  perform tests.ok((s->>'ok')::boolean and s->>'mode' = 'anonymise', 'host may delete: ' || s::text);
  perform tests.ok(public.delete_my_account() = 'anonymised', 'host anonymised');
end $$;

reset role;
do $$
declare
  host uuid := current_setting('t.host')::uuid;
  u auth.users;
begin
  select * into u from auth.users where id = host;
  perform tests.ok(u.id is not null and u.email is null and u.banned_until = 'infinity' and u.raw_user_meta_data = '{}'::jsonb, 'login removed and locked');
  perform tests.ok(not exists (select 1 from auth.identities where user_id = host), 'Google link removed');
  perform tests.ok((select first_name = '' and deleted_at is not null from public.profiles where id = host), 'profile anonymised');
  perform tests.ok(not exists (select 1 from public.listings where id = current_setting('t.unbooked')::uuid), 'unbooked listing deleted');
  perform tests.ok((select status = 'paused' from public.listings where id = current_setting('t.booked')::uuid), 'booked listing kept, paused');
  perform tests.ok(exists (select 1 from public.requests where id = current_setting('t.req')::uuid), 'the renter''s booking is kept');
  perform tests.ok(exists (select 1 from public.payments where request_id = current_setting('t.req')::uuid), 'payment records kept');
  perform tests.ok(not exists (select 1 from public.push_subscriptions where user_id = host), 'push devices removed');
  perform tests.ok(exists (select 1 from private.team_alerts where kind = 'account_deleted' and body like '%acct_test_1%'), 'team told to close the Stripe account');
  perform tests.ok((select first_name = 'Rolf' from public.profiles where id = current_setting('t.renter')::uuid), 'renter untouched');
  perform tests.ok(not exists (select 1 from auth.users where id = current_setting('t.fresh')::uuid), 'fresh account gone');
end $$;

rollback;
