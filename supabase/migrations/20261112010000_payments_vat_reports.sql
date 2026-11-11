-- Follow-up to the VAT split (20261112000000_payments_vat.sql).

-- Stripe's amount for a month is what the renter actually pays; the rent part can't be more.
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

  update public.payments
     set stripe_invoice = coalesce(stripe_invoice, p_invoice),
         hosted_invoice_url = coalesce(p_hosted_url, hosted_invoice_url),
         amount = coalesce(p_amount, amount),
         host_amount = least(host_amount, coalesce(p_amount, amount)),
         base_amount = least(base_amount, coalesce(p_amount, amount))
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
revoke all on function private.record_invoice(text, text, text, date, int, boolean, text, text, text, text) from public, anon, authenticated;

-- DAC7 (KU93) per host, listing and quarter. The consideration is the host's rent
-- (what the renter paid in the host's name); Spazia's 5 % is a fee withheld from
-- the host. The renter's service fee is Spazia's own income, not the host's, and
-- is shown only for reconciliation.
drop view if exists private.dac7_report;
create view private.dac7_report as
select extract(year from p.paid_at at time zone 'Europe/Stockholm')::int as year,
       extract(quarter from p.paid_at at time zone 'Europe/Stockholm')::int as quarter,
       p.host_id,
       t.personal_number, t.full_name, t.street_address, t.postal_code, t.city,
       a.account_id as stripe_account,
       l.id as listing_id, lp.street_address as listing_address, lp.postal_code as listing_postal_code, l.city as listing_city,
       count(*) as rentals,
       sum(p.period_end - p.period_start + 1) as days_rented,
       sum(coalesce(p.base_amount, p.host_amount)) as consideration,
       sum(coalesce(p.base_amount, p.host_amount) - p.host_amount) as fees_withheld,
       sum(p.host_amount) as paid_to_host,
       sum(p.amount - coalesce(p.base_amount, p.host_amount)) as renter_service_fees
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
