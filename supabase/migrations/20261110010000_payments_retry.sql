-- A monthly charge interrupted half-way (the worker sets due_at when it starts)
-- goes back in the queue after an hour, unless Stripe already reported it.
create or replace function private.reset_stuck_charges()
returns void language sql security definer set search_path = '' as $$
  update public.payments set status = 'due'
   where status = 'processing' and due_at < now() - interval '1 hour' and stripe_payment_intent is null;
$$;
revoke all on function private.reset_stuck_charges() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'spazia-payments';
select cron.schedule('spazia-payments', '*/10 * * * *',
  'select private.reset_stuck_charges(); select private.payments_housekeeping(); select private.kick_payments();');
