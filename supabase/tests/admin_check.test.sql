-- admin_check: what the website's sign-ups API relies on.
begin;

select set_config('t.admin', tests.new_user('admin@example.com', 'Ada')::text, true);
select set_config('t.user', tests.new_user('user@example.com', 'Ulf')::text, true);
insert into private.admins (user_id) values (current_setting('t.admin')::uuid);
update private.settings set value = 'true' where key = 'admin_mfa_required';

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('t.user'), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform tests.ok(not public.admin_check(), 'not an admin');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('t.admin'), 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform tests.ok(not public.admin_check(), 'admin without the two-factor code');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('t.admin'), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform tests.ok(public.admin_check(), 'admin with the code');
end $$;
reset role;

do $$ begin
  perform tests.ok(not has_function_privilege('anon', 'public.admin_check()', 'EXECUTE'), 'not callable without a login');
end $$;

rollback;
