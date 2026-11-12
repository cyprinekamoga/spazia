-- Discount codes and invites: the first month's service fee shrinks, the host's
-- rent never does; invites are for new customers; a paid first month
-- rewards the inviter with a personal code.
begin;

select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.inviter', tests.new_user('inviter@example.com', 'Ida')::text, true);
select set_config('t.renter', tests.new_user('renter@example.com', 'Rolf')::text, true);
select set_config('t.listing', tests.new_listing(current_setting('t.host')::uuid, 'Uppsala', 200)::text, true);
select set_config('t.req', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.renter')::uuid)::text, true);
insert into private.discount_codes (code, percent_off, max_uses) values ('HOST20', 20, 1);

set local role authenticated;
do $$
declare d jsonb; inv text;
begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform tests.ok(public.check_discount_code('nope')->>'error' = 'invalid_code', 'unknown code');
  perform tests.ok((public.check_discount_code(' host20 ')->>'percent')::int = 20, 'campaign code, any case');
  -- The inviter's code.
  perform tests.act_as(current_setting('t.inviter')::uuid);
  inv := public.my_referral_code();
  perform tests.ok(inv ~ '^[A-Z0-9]{6,12}$' and public.my_referral_code() = inv, 'stable invite code: ' || inv);
  perform tests.ok(public.check_discount_code(inv)->>'error' = 'invalid_code', 'own invite code does not work');
  perform set_config('t.inv', inv, true);
  perform tests.act_as(current_setting('t.renter')::uuid);
  d := public.check_discount_code(inv);
  perform tests.ok((d->>'percent')::int = 50 and d->>'kind' = 'referral' and not d ? 'inviter', 'invite: 50 %, inviter not revealed: ' || d::text);
  d := public.apply_discount_code(current_setting('t.req')::uuid, inv);
  begin
    perform public.apply_discount_code(current_setting('t.req')::uuid, 'HOST20');
    perform tests.ok(false, 'only one code per request');
  exception when raise_exception then perform tests.ok(sqlerrm = 'already_applied', sqlerrm); end;
end $$;
reset role;

-- Host price 200: renter 230, fee 30; 50 % off the fee → 215 in month one, host untouched.
do $$
declare a record; b record;
begin
  select * into a from private.period_amounts(current_setting('t.req')::uuid, 0);
  perform tests.ok(a.amount = 215 and a.discount = 15 and a.base = 200 and a.host_amount = 190,
                   format('month one: %s (discount %s, rent %s, host %s)', a.amount, a.discount, a.base, a.host_amount));
  select * into b from private.period_amounts(current_setting('t.req')::uuid, 1);
  perform tests.ok(b.amount = 230 and b.discount = 0, 'month two at full price');
  perform tests.ok((private.schedule_plan(current_setting('t.req')::uuid)->>'monthly')::int = 230, 'monthly plan at full price');
end $$;

-- The first month is paid: the inviter gets a personal reward code (once).
update public.requests set status = 'accepted' where id = current_setting('t.req')::uuid;
select private.create_period_payment(current_setting('t.req')::uuid, 0);
update public.payments set status = 'paid', paid_at = now() where request_id = current_setting('t.req')::uuid and period_index = 0;
do $$ begin
  perform tests.ok((select count(*) from private.discount_codes where kind = 'referral_reward' and owner_id = current_setting('t.inviter')::uuid and percent_off = 100) = 1, 'inviter rewarded');
end $$;
set local role authenticated;
do $$
declare codes jsonb; reward text;
begin
  perform tests.act_as(current_setting('t.inviter')::uuid);
  codes := public.my_discount_codes();
  perform tests.ok(jsonb_array_length(codes) = 1, 'inviter sees the reward: ' || codes::text);
  reward := codes->0->>'code';
  perform set_config('t.reward', reward, true);
  perform tests.ok((public.check_discount_code(reward)->>'percent')::int = 100, 'reward works for the inviter');
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform tests.ok(public.check_discount_code(reward)->>'error' = 'invalid_code', 'but not for anyone else');
  -- The renter is no longer a new customer: invites stop working for them.
  perform tests.ok(public.check_discount_code(current_setting('t.inv'))->>'error' = 'not_new_customer', 'invite only for new customers');
end $$;
reset role;

-- A campaign code used up.
select set_config('t.r2', tests.new_user('r2@example.com', 'Ruth')::text, true);
select set_config('t.req2', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.r2')::uuid)::text, true);
select set_config('t.r3', tests.new_user('r3@example.com', 'Rut')::text, true);
select set_config('t.req3', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.r3')::uuid)::text, true);
set local role authenticated;
do $$ begin
  perform tests.act_as(current_setting('t.r2')::uuid);
  perform public.apply_discount_code(current_setting('t.req2')::uuid, 'host20');
  perform tests.act_as(current_setting('t.r3')::uuid);
  begin
    perform public.apply_discount_code(current_setting('t.req3')::uuid, 'HOST20');
    perform tests.ok(false, 'used-up code must fail');
  exception when raise_exception then perform tests.ok(sqlerrm = 'invalid_code', sqlerrm); end;
  -- Company details on own private profile.
  update public.profile_private set company_name = 'Rut AB', company_org_number = '556677-8899', company_vat_number = 'SE556677889901' where id = current_setting('t.r3')::uuid;
  perform tests.ok((select company_name = 'Rut AB' from public.profile_private where id = current_setting('t.r3')::uuid), 'company details saved');
end $$;
reset role;
do $$
declare a record;
begin
  select * into a from private.period_amounts(current_setting('t.req2')::uuid, 0);
  perform tests.ok(a.amount = 224 and a.discount = 6, format('20 %% of the 30 kr fee: %s', a.amount));
end $$;

rollback;
