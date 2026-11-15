-- Spazia Skydd: off by default; when on, the renter can add it to a pending
-- monthly request, it is charged on top (own part of every month), the host's
-- share is untouched, and claims reach the team.
begin;

select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.renter', tests.new_user('renter@example.com', 'Rolf')::text, true);
select set_config('t.listing', tests.new_listing(current_setting('t.host')::uuid, 'Uppsala', 200)::text, true);
select set_config('t.req', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.renter')::uuid)::text, true);
insert into private.settings (key, value) values ('payments_enabled', 'true') on conflict (key) do update set value = 'true';

-- Off by default: not offered, and cannot be chosen.
set local role authenticated;
do $$ begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform tests.ok(public.payments_config()->'protection' = 'null'::jsonb, 'not offered by default: ' || public.payments_config()::text);
  begin
    perform public.set_request_protection(current_setting('t.req')::uuid, true);
    perform tests.ok(false, 'must refuse while switched off');
  exception when raise_exception then perform tests.ok(sqlerrm = 'protection_unavailable', sqlerrm); end;
end $$;
reset role;

update private.settings set value = 'true' where key = 'protection_enabled';
set local role authenticated;
do $$ begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform tests.ok((public.payments_config()->'protection'->>'rate')::numeric = 0.05 and (public.payments_config()->'protection'->>'cap')::int = 10000, 'offered: 5 %, up to 10 000 kr');
  -- The host cannot choose it for the renter.
  perform tests.act_as(current_setting('t.host')::uuid);
  begin
    perform public.set_request_protection(current_setting('t.req')::uuid, true);
    perform tests.ok(false, 'host must not set it');
  exception when raise_exception then perform tests.ok(sqlerrm = 'not_allowed', sqlerrm); end;
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform public.set_request_protection(current_setting('t.req')::uuid, true);
end $$;
reset role;

-- A later change of rate does not change this rental.
update private.settings set value = '0.10' where key = 'protection_rate';
do $$
declare a record;
begin
  perform tests.ok((select protection_rate = 0.05 from public.requests where id = current_setting('t.req')::uuid), 'rate copied onto the request');
  -- Host price 200 → renter 220; protection 5 % of 220 = 11; total 231. Host still gets 190.
  select * into a from private.period_amounts(current_setting('t.req')::uuid, 0);
  perform tests.ok(a.amount = 231 and a.protection = 11 and a.base = 200 and a.host_amount = 190,
                   format('month amounts: amount %s, protection %s, base %s, host %s', a.amount, a.protection, a.base, a.host_amount));
  perform tests.ok((private.schedule_plan(current_setting('t.req')::uuid)->>'monthly_protection')::int = 11, 'monthly plan has the add-on');
end $$;

-- A shorter last month: everything prorated.
update public.requests set end_date = start_date + 44 where id = current_setting('t.req')::uuid;
do $$
declare a record;
begin
  select * into a from private.period_amounts(current_setting('t.req')::uuid, 1);
  perform tests.ok(a.pe < a.natural_end and a.protection < 11 and a.protection > 0 and a.amount = round(220 * (a.pe - a.ps + 1)::numeric / (a.natural_end - a.ps + 1)) + a.protection,
                   format('prorated: amount %s, protection %s', a.amount, a.protection));
end $$;

-- The payment row carries it.
do $$
declare pid uuid;
begin
  pid := private.create_period_payment(current_setting('t.req')::uuid, 0);
  perform tests.ok((select protection_amount = 11 and amount = 231 from public.payments where id = pid), 'payment has the protection part');
end $$;

-- Claims: only the renter, only with protection, only once accepted; the team is told.
update public.requests set status = 'accepted' where id = current_setting('t.req')::uuid;
set local role authenticated;
do $$
declare cid uuid;
begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  cid := public.submit_protection_claim(current_setting('t.req')::uuid, 'Vattenskada på två flyttkartonger med kläder.', 1500);
  perform tests.ok((select count(*) from public.protection_claims) = 1, 'renter sees the claim');
  perform tests.act_as(current_setting('t.host')::uuid);
  perform tests.ok((select count(*) from public.protection_claims) = 0, 'host does not see it');
  begin
    perform public.submit_protection_claim(current_setting('t.req')::uuid, 'Försöker anmäla som värd.', null);
    perform tests.ok(false, 'host cannot claim');
  exception when raise_exception then perform tests.ok(sqlerrm = 'not_allowed', sqlerrm); end;
end $$;
reset role;
do $$ begin
  perform tests.ok(exists (select 1 from private.team_alerts where kind = 'protection_claim' and body like '%1500 kr%'), 'team alerted');
end $$;

-- Without the add-on there is nothing extra.
select set_config('t.req2', tests.new_request(current_setting('t.listing')::uuid, tests.new_user('r2@example.com', 'Ruth'))::text, true);
do $$
declare a record;
begin
  select * into a from private.period_amounts(current_setting('t.req2')::uuid, 0);
  perform tests.ok(a.amount = 220 and a.protection = 0, 'no add-on: 220 kr');
end $$;

rollback;
