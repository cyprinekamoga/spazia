-- Two-factor login for admins, and limits against spam.

-- 1. Admins: two-factor (an authenticator app) ---------------------------------
-- Admin rights (admin_* and acc_* functions, the bookkeeping files) need a
-- two-factor code in the current login (aal2 in the token) once
-- admin_mfa_required is 'true'. The admin page asks for the code, or sets up
-- the authenticator app the first time; the setting is switched on when that
-- version of the app is live, so nobody is locked out in between.
insert into private.settings (key, value) values ('admin_mfa_required', 'false') on conflict (key) do nothing;

-- On the admin list at all (used to show the admin page).
create or replace function private.is_admin_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.admins where user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin_member() from public, anon, authenticated;

create or replace function private.admin_mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.setting('admin_mfa_required'), 'false') <> 'true'
      or coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;
revoke all on function private.admin_mfa_ok() from public, anon, authenticated;

-- Admin rights: on the list, and with two-factor when it is required.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin_member() and private.admin_mfa_ok();
$$;

create or replace function private.require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin_member() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not private.admin_mfa_ok() then raise exception 'mfa_required' using errcode = '42501'; end if;
end;
$$;
revoke all on function private.require_admin() from public, anon, authenticated;

-- The admin page shows itself to members and then asks for the code.
create or replace function public.am_i_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin_member();
$$;

-- 2. Spam limits --------------------------------------------------------------
-- Far above normal use (a few messages an hour, a request a day); they stop
-- scripts and floods, not people. The app shows 'rate_limited' as "wait a bit".
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);
create index if not exists conversations_renter_idx on public.conversations (renter_id, created_at desc);
create index if not exists requests_renter_created_idx on public.requests (renter_id, created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);

create or replace function private.rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if tg_table_name = 'messages' then
    if new.kind not in ('text', 'image') or new.sender_id is null then return new; end if;
    select count(*) into n from public.messages
     where sender_id = new.sender_id and kind in ('text', 'image') and created_at > now() - interval '10 minutes';
    if n >= 40 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
    select count(*) into n from public.messages
     where sender_id = new.sender_id and kind in ('text', 'image') and created_at > now() - interval '1 day';
    if n >= 400 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'conversations' then
    select count(*) into n from public.conversations where renter_id = new.renter_id and created_at > now() - interval '1 day';
    if n >= 20 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'requests' then
    select count(*) into n from public.requests where renter_id = new.renter_id and created_at > now() - interval '1 day';
    if n >= 15 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
    if new.kind = 'hour' and new.status = 'pending' then
      select count(*) into n from public.requests where renter_id = new.renter_id and kind = 'hour' and status = 'pending';
      if n >= 5 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
    end if;
  elsif tg_table_name = 'reports' then
    select count(*) into n from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day';
    if n >= 20 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.rate_limit() from public, anon, authenticated;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit before insert on public.messages for each row execute function private.rate_limit();
drop trigger if exists conversations_rate_limit on public.conversations;
create trigger conversations_rate_limit before insert on public.conversations for each row execute function private.rate_limit();
drop trigger if exists requests_rate_limit on public.requests;
create trigger requests_rate_limit before insert on public.requests for each row execute function private.rate_limit();
drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit before insert on public.reports for each row execute function private.rate_limit();
