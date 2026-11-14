-- The address shows once the host accepts; how to get in and the phone number
-- wait for the first payment when the booking is paid through Spazia.
begin;

select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.renter', tests.new_user('renter@example.com', 'Rolf')::text, true);
select set_config('t.other', tests.new_user('other@example.com', 'Olle')::text, true);
select set_config('t.listing', tests.new_listing(current_setting('t.host')::uuid)::text, true);
update public.listing_private set access_instructions = 'Kod 1234' where listing_id = current_setting('t.listing')::uuid;
update public.profile_private set phone = '070-123 45 67' where id = current_setting('t.host')::uuid;
select set_config('t.req', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.renter')::uuid)::text, true);
update public.requests set payment_required = true where id = current_setting('t.req')::uuid;

set local role authenticated;

-- Pending: nothing for the renter; the host always sees the address.
do $$ begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform tests.ok(public.listing_address(current_setting('t.listing')::uuid) is null, 'pending: no address');
  perform tests.act_as(current_setting('t.host')::uuid);
  perform tests.ok(public.listing_address(current_setting('t.listing')::uuid)->>'street_address' = 'Gatan 1', 'host sees the address');
end $$;

reset role;
update public.requests set status = 'accepted' where id = current_setting('t.req')::uuid;
set local role authenticated;

-- Accepted, not paid: the address, but not how to get in or the phone number.
do $$ begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform tests.ok(public.listing_address(current_setting('t.listing')::uuid)->>'street_address' = 'Gatan 1', 'accepted unpaid: address');
  perform tests.ok(not exists (select 1 from public.listing_private where listing_id = current_setting('t.listing')::uuid), 'accepted unpaid: no access instructions');
  perform tests.ok(not exists (select 1 from public.profile_private where id = current_setting('t.host')::uuid), 'accepted unpaid: no host phone');
  perform tests.act_as(current_setting('t.other')::uuid);
  perform tests.ok(public.listing_address(current_setting('t.listing')::uuid) is null, 'someone else: no address');
end $$;

reset role;
update public.requests set paid_through = start_date + 30 where id = current_setting('t.req')::uuid;
set local role authenticated;

-- Paid: how to get in and the phone number too.
do $$ begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform tests.ok((select access_instructions from public.listing_private where listing_id = current_setting('t.listing')::uuid) = 'Kod 1234', 'paid: access instructions');
  perform tests.ok((select phone from public.profile_private where id = current_setting('t.host')::uuid) = '070-123 45 67', 'paid: host phone');
end $$;

-- Not signed in: nothing.
do $$ begin
  perform tests.act_as(null);
  perform tests.ok(public.listing_address(current_setting('t.listing')::uuid) is null, 'no login: no address');
end $$;

rollback;
