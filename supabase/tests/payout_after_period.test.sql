-- The host's share is due a day after the period it pays for has ended.
begin;

select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.renter', tests.new_user('renter@example.com', 'Rolf')::text, true);
select set_config('t.listing', tests.new_listing(current_setting('t.host')::uuid)::text, true);

-- Monthly, from 15 Jan: the first period runs to 14 Feb, so the share is due 16 Feb 00:00 in Stockholm.
select set_config('t.month', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.renter')::uuid, 'accepted', date '2027-01-15')::text, true);
update public.requests set payment_required = true where id = current_setting('t.month')::uuid;
select set_config('t.p0', private.create_period_payment(current_setting('t.month')::uuid, 0)::text, true);
select set_config('t.p1', private.create_period_payment(current_setting('t.month')::uuid, 1)::text, true);

do $$
declare p public.payments;
begin
  select * into p from public.payments where id = current_setting('t.p0')::uuid;
  perform tests.ok(p.period_end = date '2027-02-14', 'first period ends 14 Feb, got ' || p.period_end);
  perform tests.ok(p.transfer_due_at = timestamptz '2027-02-16 00:00 Europe/Stockholm', 'month 1 paid out 16 Feb, got ' || p.transfer_due_at);
  select * into p from public.payments where id = current_setting('t.p1')::uuid;
  perform tests.ok(p.transfer_due_at = timestamptz '2027-03-16 00:00 Europe/Stockholm', 'month 2 paid out 16 Mar, got ' || p.transfer_due_at);
end $$;

-- A rental with an end date: the last, shorter period is paid out after its own end.
select set_config('t.short', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.renter')::uuid, 'accepted', date '2027-01-15', date '2027-01-31')::text, true);
update public.requests set payment_required = true where id = current_setting('t.short')::uuid;
select set_config('t.ps', private.create_period_payment(current_setting('t.short')::uuid, 0)::text, true);
do $$
declare due timestamptz;
begin
  select transfer_due_at into due from public.payments where id = current_setting('t.ps')::uuid;
  perform tests.ok(due = timestamptz '2027-02-02 00:00 Europe/Stockholm', 'short rental paid out 2 Feb, got ' || due);
end $$;

-- Hourly parking: a day after the booking ends.
select set_config('t.hour', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.renter')::uuid, 'accepted', date '2027-01-15', date '2027-01-15')::text, true);
update public.requests set kind = 'hour', payment_required = true, host_total = 100,
       start_at = timestamptz '2027-01-15 08:00 Europe/Stockholm', end_at = timestamptz '2027-01-15 17:00 Europe/Stockholm'
 where id = current_setting('t.hour')::uuid;
insert into public.payments (request_id, renter_id, host_id, period_index, period_start, period_end, amount, host_amount, due_at, pay_by, transfer_due_at)
select r.id, r.renter_id, r.host_id, 0, r.start_date, r.end_date, 100, 80, now(), now() + interval '30 minutes', r.start_at + interval '24 hours'
  from public.requests r where r.id = current_setting('t.hour')::uuid;
do $$
declare due timestamptz;
begin
  select transfer_due_at into due from public.payments where request_id = current_setting('t.hour')::uuid;
  perform tests.ok(due = timestamptz '2027-01-16 17:00 Europe/Stockholm', 'parking paid out a day after it ends, got ' || due);
end $$;

rollback;
