-- The website's sign-ups API (/api/admin, the "Leads" tab in the app's admin
-- page) asks the database whether a login may see them: on the admin list,
-- with the two-factor code when that is required (private.is_admin).
create or replace function public.admin_check()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin();
$$;
revoke all on function public.admin_check() from public, anon;
grant execute on function public.admin_check() to authenticated;
