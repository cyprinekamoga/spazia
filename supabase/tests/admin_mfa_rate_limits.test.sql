-- Two-factor for admins, and the spam limits.
begin;

select set_config('t.admin', tests.new_user('admin@example.com', 'Ada')::text, true);
select set_config('t.user', tests.new_user('user@example.com', 'Ulf')::text, true);
insert into private.admins (user_id) values (current_setting('t.admin')::uuid);

-- 1. Two-factor ---------------------------------------------------------------
set local role authenticated;
do $$ begin
  -- Not required yet: an admin without a code still works (the app asks for one anyway).
  perform tests.act_as(current_setting('t.admin')::uuid);
  perform tests.ok(public.am_i_admin(), 'member');
  perform public.admin_overview();
  -- Not an admin: refused.
  perform tests.act_as(current_setting('t.user')::uuid);
  perform tests.ok(not public.am_i_admin(), 'not a member');
  begin
    perform public.admin_overview();
    perform tests.ok(false, 'non-admin must be refused');
  exception when insufficient_privilege then perform tests.ok(sqlerrm = 'forbidden', sqlerrm); end;
end $$;
reset role;

update private.settings set value = 'true' where key = 'admin_mfa_required';
set local role authenticated;
do $$ begin
  -- Required: without a code (aal1) the admin page still opens, but admin data is refused.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('t.admin'), 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform tests.ok(public.am_i_admin(), 'still a member without the code');
  perform tests.ok(not private.is_admin(), 'no admin rights (storage) without the code');
  begin
    perform public.admin_overview();
    perform tests.ok(false, 'admin data must need the code');
  exception when insufficient_privilege then perform tests.ok(sqlerrm = 'mfa_required', sqlerrm); end;
  begin
    perform public.acc_years();
    perform tests.ok(false, 'bookkeeping must need the code');
  exception when insufficient_privilege then perform tests.ok(sqlerrm = 'mfa_required', sqlerrm); end;
  -- With the code (aal2): allowed.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('t.admin'), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform public.admin_overview();
  perform tests.ok(private.is_admin(), 'admin rights with the code');
end $$;
reset role;

-- 2. Spam limits --------------------------------------------------------------
select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.listing', tests.new_listing(current_setting('t.host')::uuid)::text, true);
select set_config('t.req', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.user')::uuid)::text, true);

do $$
declare
  conv uuid := (select conversation_id from public.requests where id = current_setting('t.req')::uuid);
  i int;
begin
  -- 40 messages in ten minutes are fine; the 41st is refused. Events from the system don't count.
  for i in 1..40 loop
    insert into public.messages (conversation_id, sender_id, body) values (conv, current_setting('t.user')::uuid, 'hej ' || i);
  end loop;
  insert into public.messages (conversation_id, sender_id, kind, body) values (conv, current_setting('t.user')::uuid, 'event', 'request_accepted');
  begin
    insert into public.messages (conversation_id, sender_id, body) values (conv, current_setting('t.user')::uuid, 'en till');
    perform tests.ok(false, '41st message must be refused');
  exception when raise_exception then perform tests.ok(sqlerrm = 'rate_limited', sqlerrm); end;
  -- The other person can still write.
  insert into public.messages (conversation_id, sender_id, body) values (conv, current_setting('t.host')::uuid, 'svar');

  -- 15 requests a day (one exists already); the 16th is refused.
  for i in 1..14 loop
    perform tests.new_request(current_setting('t.listing')::uuid, current_setting('t.user')::uuid);
  end loop;
  begin
    perform tests.new_request(current_setting('t.listing')::uuid, current_setting('t.user')::uuid);
    perform tests.ok(false, '16th request must be refused');
  exception when raise_exception then perform tests.ok(sqlerrm = 'rate_limited', sqlerrm); end;
end $$;

rollback;
