-- The host is paid for a period once it is over, not when it starts:
--   monthly: a day after the month (or the last, shorter period) has ended,
--   hourly parking: a day after the booking has ended.
-- The day in between leaves room to report a problem before the money moves.
-- Stripe then pays out to the host's bank on its usual schedule (Mondays).
--
-- Set on every new payment by a trigger, so the first month, the months after
-- (from invoices) and parking bookings all follow the same rule.

create or replace function private.payout_time(p_request uuid, p_period_end date)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select case
           when r.kind = 'hour' then r.end_at + interval '24 hours'
           else ((p_period_end + 1)::timestamp at time zone 'Europe/Stockholm') + interval '24 hours'
         end
    from public.requests r
   where r.id = p_request;
$$;
revoke all on function private.payout_time(uuid, date) from public, anon, authenticated;

create or replace function private.set_payout_time()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.transfer_due_at := coalesce(private.payout_time(new.request_id, new.period_end), new.transfer_due_at);
  return new;
end;
$$;
revoke all on function private.set_payout_time() from public, anon, authenticated;

drop trigger if exists payments_payout_after_period on public.payments;
create trigger payments_payout_after_period before insert on public.payments
  for each row execute function private.set_payout_time();

-- Payments not yet passed on to the host follow the new rule too.
update public.payments p
   set transfer_due_at = private.payout_time(p.request_id, p.period_end)
 where p.stripe_transfer is null and p.transferred_at is null;
