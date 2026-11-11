-- Test mode for payments. payments_enabled can now be:
--   'false' (default)  payments off for everyone
--   'test'             payments on only for the accounts listed in payments_test_users
--                      (comma-separated emails), so the whole flow can be tested in
--                      Stripe's sandbox without changing anything for real users
--   'true'             payments on for everyone
--
-- In test mode the database's own jobs (cron, the payments worker, the Stripe
-- functions) also see payments as on. They only act on requests created with
-- payment_required, and only test accounts' requests get that.

create or replace function private.payments_on_for(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case coalesce(private.setting('payments_enabled'), 'false')
           when 'true' then true
           when 'test' then p_user is not null and exists (
             select 1 from auth.users u
              where u.id = p_user
                and lower(u.email) = any (string_to_array(lower(replace(coalesce(private.setting('payments_test_users'), ''), ' ', '')), ',')))
           else false
         end;
$$;
revoke all on function private.payments_on_for(uuid) from public, anon, authenticated;

create or replace function private.payments_on()
returns boolean language sql stable security definer set search_path = '' as $$
  select case
           when coalesce(private.setting('payments_enabled'), 'false') <> 'test' then private.payments_on_for(null)
           -- No API request behind the call: cron, the worker or a Stripe function.
           when nullif(current_setting('request.jwt.claims', true), '') is null then true
           else private.payments_on_for((select auth.uid()))
         end;
$$;
revoke all on function private.payments_on() from public, anon, authenticated;
