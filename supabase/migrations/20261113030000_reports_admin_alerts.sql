-- Reports, admin tools and alerts to the team.
--
-- Alerts: private.raise_alert() queues an email to the team (MAIL_TO) that the
-- site's /api/notify function sends, like the booking emails (one-time token).
-- Repeated alerts with the same key are sent at most once per throttle window.
--
-- Reports (EU Digital Services Act, notice and action): signed-in users can
-- report a listing, a user or a message. The team gets an alert and handles
-- the report in the app's admin page.
--
-- Admin: accounts listed in private.admins can use the admin functions below
-- (bookings, payments, listings, users, reports, and actions on them).
-- Every action is logged in private.admin_log.

-- Alerts -----------------------------------------------------------------------
create table if not exists private.team_alerts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  dedupe_key  text,
  subject     text not null,
  body        text not null,
  token       text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  sent_at     timestamptz,
  attempts    int not null default 0
);
create index if not exists team_alerts_unsent_idx on private.team_alerts (created_at) where sent_at is null;
create index if not exists team_alerts_key_idx on private.team_alerts (dedupe_key, created_at desc);
revoke all on private.team_alerts from public, anon, authenticated;

create or replace function private.post_team_alert(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  url text := (select value from private.settings where key = 'notify_url');
  a private.team_alerts;
begin
  if url is null or url = '' then return; end if;
  update private.team_alerts set attempts = attempts + 1 where id = p_id returning * into a;
  if a.id is null then return; end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('alert', a.id, 'token', a.token),
    headers := jsonb_build_object('content-type', 'application/json'),
    timeout_milliseconds := 15000
  );
end;
$$;
revoke all on function private.post_team_alert(uuid) from public, anon, authenticated;

-- Queue an alert. Same key within the throttle window: counted, not sent again.
create or replace function private.raise_alert(p_kind text, p_subject text, p_body text, p_key text default null, p_throttle interval default interval '1 hour')
returns void language plpgsql security definer set search_path = '' as $$
declare
  aid uuid;
begin
  if p_key is not null and exists (select 1 from private.team_alerts
                                    where dedupe_key = p_key and created_at > now() - p_throttle) then
    return;
  end if;
  insert into private.team_alerts (kind, dedupe_key, subject, body)
  values (p_kind, p_key, left(p_subject, 200), left(p_body, 8000))
  returning id into aid;
  perform private.post_team_alert(aid);
end;
$$;
revoke all on function private.raise_alert(text, text, text, text, interval) from public, anon, authenticated;

create or replace function public.claim_team_alert(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a private.team_alerts;
begin
  update private.team_alerts
     set claimed_at = now()
   where id = p_id and token = p_token and sent_at is null
     and (claimed_at is null or claimed_at < now() - interval '10 minutes')
     and created_at > now() - interval '2 days'
  returning * into a;
  if a.id is null then return null; end if;
  return jsonb_build_object('kind', a.kind, 'subject', a.subject, 'body', a.body, 'created_at', a.created_at);
end;
$$;

create or replace function public.finish_team_alert(p_id uuid, p_token text, p_sent boolean)
returns void language sql security definer set search_path = '' as $$
  update private.team_alerts
     set sent_at = case when p_sent then now() end,
         claimed_at = case when p_sent then claimed_at end
   where id = p_id and token = p_token and sent_at is null;
$$;
revoke all on function public.claim_team_alert(uuid, text) from public;
revoke all on function public.finish_team_alert(uuid, text, boolean) from public;
grant execute on function public.claim_team_alert(uuid, text) to anon, authenticated;
grant execute on function public.finish_team_alert(uuid, text, boolean) to anon, authenticated;

-- The resend job also resends alerts.
create or replace function private.retry_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare
  nid uuid;
begin
  update private.notifications n
     set sent_at = now(), skipped = true
   where n.kind = 'new_message' and n.sent_at is null and n.send_after <= now()
     and not exists (
       select 1 from public.messages m
        where m.conversation_id = n.conversation_id and m.kind = 'text' and m.sender_id <> n.recipient
          and m.created_at > coalesce((select r.last_read_at from public.conversation_reads r
                                        where r.conversation_id = n.conversation_id and r.user_id = n.recipient), '-infinity'));

  for nid in select id from private.notifications
              where sent_at is null and attempts < 5
                and send_after <= now()
                and created_at > now() - interval '1 day'
                and (kind = 'new_message' or created_at < now() - interval '2 minutes')
                and (claimed_at is null or claimed_at < now() - interval '10 minutes')
              order by created_at limit 50 loop
    perform private.post_notification(nid);
  end loop;

  for nid in select id from private.team_alerts
              where sent_at is null and attempts < 5
                and created_at > now() - interval '2 days'
                and created_at < now() - interval '2 minutes'
                and (claimed_at is null or claimed_at < now() - interval '10 minutes')
              order by created_at limit 20 loop
    perform private.post_team_alert(nid);
  end loop;
end;
$$;
revoke all on function private.retry_notifications() from public, anon, authenticated;

-- Hourly health check: problems nobody would otherwise notice.
create or replace function private.health_check()
returns void language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  select count(*) into n from private.notifications
   where sent_at is null and attempts >= 5 and created_at > now() - interval '1 day';
  if n > 0 then
    perform private.raise_alert('emails_failing', format('%s mejl till användare gick inte att skicka', n),
      'Mejl om förfrågningar, bokningar eller meddelanden har misslyckats fem gånger. Kontrollera SMTP-inställningarna i Netlify och funktionsloggen för /api/notify.',
      'emails_failing', interval '6 hours');
  end if;

  select count(*) into n from private.notifications
   where sent_at is null and created_at < now() - interval '1 hour' and created_at > now() - interval '1 day'
     and send_after < now() - interval '1 hour';
  if n > 0 and coalesce(private.setting('notify_url'), '') <> '' then
    perform private.raise_alert('emails_stuck', format('%s mejl väntar på att skickas', n),
      'Mejl har väntat i kön i mer än en timme. Kontrollera att /api/notify svarar och att notify_url stämmer.',
      'emails_stuck', interval '6 hours');
  end if;

  select count(*) into n from public.payments where status = 'processing' and due_at < now() - interval '2 hours';
  if n > 0 then
    perform private.raise_alert('payments_stuck', format('%s betalningar har fastnat', n),
      'Betalningar har stått som "dras nu" i mer än två timmar. Kontrollera loggen för payments-worker i Supabase.',
      'payments_stuck', interval '6 hours');
  end if;

  select count(*) into n from public.payments
   where status = 'paid' and stripe_transfer is null and refund_requested_at is null and disputed_at is null
     and host_amount > 0 and transfer_due_at < now() - interval '1 day';
  if n > 0 then
    perform private.raise_alert('transfers_late', format('%s utbetalningar till värdar är försenade', n),
      'Värdens del borde ha förts över för mer än ett dygn sedan. Vanligaste orsaken: värden har inte kopplat sitt bankkonto klart hos Stripe. Se Betalningar i adminsidan.',
      'transfers_late', interval '24 hours');
  end if;

  select count(*) into n from public.payments where disputed_at > now() - interval '1 hour';
  if n > 0 then
    perform private.raise_alert('disputes', format('%s ny tvist eller bedrägerivarning', n),
      'Stripe har rapporterat en tvist eller en bedrägerivarning. Värdens del hålls kvar. Svara på tvisten i Stripes Dashboard.',
      'disputes', interval '1 hour');
  end if;
end;
$$;
revoke all on function private.health_check() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'spazia-health';
select cron.schedule('spazia-health', '17 * * * *', 'select private.health_check()');

-- Admins -----------------------------------------------------------------------
create table if not exists private.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on private.admins from public, anon, authenticated;

create table if not exists private.admin_log (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid,
  action     text not null,
  target     text not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
revoke all on private.admin_log from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.admins where user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create or replace function public.am_i_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin();
$$;
revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

create or replace function private.require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end;
$$;
revoke all on function private.require_admin() from public, anon, authenticated;

create or replace function private.log_admin(p_action text, p_target text, p_note text)
returns void language sql security definer set search_path = '' as $$
  insert into private.admin_log (admin_id, action, target, note) values ((select auth.uid()), p_action, p_target, left(coalesce(p_note, ''), 1000));
$$;
revoke all on function private.log_admin(text, text, text) from public, anon, authenticated;

-- Reports ----------------------------------------------------------------------
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  target_kind  text not null check (target_kind in ('listing', 'user', 'message')),
  target_id    uuid not null,
  reason       text not null check (reason in ('illegal', 'fraud', 'unsafe', 'wrong_info', 'harassment', 'other')),
  details      text not null default '' check (char_length(details) <= 2000),
  created_at   timestamptz not null default now(),
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution   text not null default '' check (char_length(resolution) <= 2000),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id) on delete set null
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create or replace function public.report_content(p_kind text, p_target uuid, p_reason text, p_details text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  rid uuid;
  what text;
begin
  if me is null then raise exception 'login_required' using errcode = '42501'; end if;
  if p_reason not in ('illegal', 'fraud', 'unsafe', 'wrong_info', 'harassment', 'other') then
    raise exception 'bad_request' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;

  if p_kind = 'listing' then
    select format('annonsen ”%s” (%s)', l.title, l.city) into what from public.listings l
     where l.id = p_target and (l.status = 'published' or exists (
       select 1 from public.requests r where r.listing_id = l.id and r.renter_id = me));
  elsif p_kind = 'user' then
    select format('användaren %s', coalesce(nullif(p.first_name, ''), 'utan namn')) into what from public.profiles p
     where p.id = p_target and p.id <> me and (
       exists (select 1 from public.conversations c where (c.host_id = me and c.renter_id = p.id) or (c.renter_id = me and c.host_id = p.id))
       or exists (select 1 from public.listings l where l.host_id = p.id and l.status = 'published'));
  elsif p_kind = 'message' then
    select format('ett meddelande från %s', coalesce(nullif(p.first_name, ''), 'okänd')) into what
      from public.messages m join public.conversations c on c.id = m.conversation_id
      join public.profiles p on p.id = m.sender_id
     where m.id = p_target and m.sender_id <> me and me in (c.host_id, c.renter_id);
  end if;
  if what is null then raise exception 'not_found' using errcode = 'P0002'; end if;

  insert into public.reports (reporter_id, target_kind, target_id, reason, details)
  values (me, p_kind, p_target, p_reason, left(trim(coalesce(p_details, '')), 2000))
  returning id into rid;

  perform private.raise_alert('report', format('Ny anmälan: %s', what),
    format(E'%s har anmält %s.\n\nSkäl: %s\n\n%s\n\nHantera anmälan i adminsidan i appen: https://app.spazia.se/admin',
      coalesce((select nullif(first_name, '') from public.profiles where id = me), 'En användare'), what, p_reason,
      coalesce(nullif(trim(p_details), ''), '(ingen beskrivning)')));
  return rid;
end;
$$;
revoke all on function public.report_content(text, uuid, text, text) from public, anon;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

-- Admin: lists -----------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_week', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'listings_published', (select count(*) from public.listings where status = 'published'),
    'requests_pending', (select count(*) from public.requests where status = 'pending' and kind = 'month' and expires_at > now()),
    'rentals_active', (select count(*) from public.requests where status = 'accepted' and (kind = 'hour' and end_at > now() or kind = 'month' and (end_date is null or end_date >= private.today()))),
    'paid_month', (select coalesce(sum(amount), 0) from public.payments where status = 'paid' and paid_at > date_trunc('month', now())),
    'fees_month', (select coalesce(sum(amount - host_amount), 0) from public.payments where status = 'paid' and paid_at > date_trunc('month', now())),
    'payments_failed', (select count(*) from public.payments where status = 'failed'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'payments_mode', coalesce(private.setting('payments_enabled'), 'false')
  );
end;
$$;

create or replace function public.admin_bookings(p_search text default '', p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  q text := '%' || coalesce(trim(p_search), '') || '%';
begin
  perform private.require_admin();
  return coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
    select r.id, r.kind, r.status, r.created_at, r.start_date, r.end_date, r.start_at, r.end_at,
           r.payment_required, r.paid_through, r.renter_agreed_at, r.host_agreed_at,
           l.id as listing_id, l.title, l.city,
           hu.email as host_email, hp.first_name as host_name,
           ru.email as renter_email, rp.first_name as renter_name,
           (select coalesce(sum(p.amount), 0) from public.payments p where p.request_id = r.id and p.status = 'paid') as paid_total
      from public.requests r
      join public.listings l on l.id = r.listing_id
      left join auth.users hu on hu.id = r.host_id left join public.profiles hp on hp.id = r.host_id
      left join auth.users ru on ru.id = r.renter_id left join public.profiles rp on rp.id = r.renter_id
     where l.title ilike q or l.city ilike q or hu.email ilike q or ru.email ilike q or r.id::text ilike q
     order by r.created_at desc limit least(greatest(p_limit, 1), 500)) x), '[]'::jsonb);
end;
$$;

create or replace function public.admin_payments(p_search text default '', p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  q text := '%' || coalesce(trim(p_search), '') || '%';
begin
  perform private.require_admin();
  return coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
    select p.id, p.request_id, p.status, p.created_at, p.period_start, p.period_end, p.amount, p.base_amount, p.host_amount,
           p.paid_at, p.transfer_due_at, p.transferred_at, p.refund_requested_at, p.refunded_at, p.refund_amount,
           p.disputed_at, p.failure, p.attempts, p.stripe_payment_intent, p.stripe_invoice, p.stripe_transfer,
           l.title, ru.email as renter_email, hu.email as host_email
      from public.payments p
      join public.requests r on r.id = p.request_id
      join public.listings l on l.id = r.listing_id
      left join auth.users ru on ru.id = p.renter_id
      left join auth.users hu on hu.id = p.host_id
     where l.title ilike q or ru.email ilike q or hu.email ilike q or p.id::text ilike q or p.status::text ilike q
     order by p.created_at desc limit least(greatest(p_limit, 1), 500)) x), '[]'::jsonb);
end;
$$;

create or replace function public.admin_listings(p_search text default '', p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  q text := '%' || coalesce(trim(p_search), '') || '%';
begin
  perform private.require_admin();
  return coalesce((select jsonb_agg(row_to_json(x) order by x.updated_at desc) from (
    select l.id, l.title, l.city, l.area_name, l.status, l.created_at, l.updated_at, l.published_at,
           u.email as host_email, pr.first_name as host_name,
           (select count(*) from public.reports rp where rp.target_kind = 'listing' and rp.target_id = l.id and rp.status = 'open') as open_reports,
           (select count(*) from public.requests r where r.listing_id = l.id and r.status = 'accepted') as accepted_requests
      from public.listings l
      left join auth.users u on u.id = l.host_id left join public.profiles pr on pr.id = l.host_id
     where l.title ilike q or l.city ilike q or u.email ilike q or l.id::text ilike q
     order by l.updated_at desc limit least(greatest(p_limit, 1), 500)) x), '[]'::jsonb);
end;
$$;

create or replace function public.admin_users(p_search text default '', p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  q text := '%' || coalesce(trim(p_search), '') || '%';
begin
  perform private.require_admin();
  return coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
    select u.id, u.email, u.created_at, u.last_sign_in_at,
           (u.banned_until is not null and u.banned_until > now()) as blocked,
           p.first_name,
           exists (select 1 from private.admins a where a.user_id = u.id) as admin,
           (select count(*) from public.listings l where l.host_id = u.id) as listings,
           (select count(*) from public.requests r where r.renter_id = u.id) as requests,
           (select a.transfers_active from private.stripe_accounts a where a.user_id = u.id) as payouts_ready,
           (select count(*) from public.reports rp where rp.target_kind = 'user' and rp.target_id = u.id and rp.status = 'open') as open_reports
      from auth.users u left join public.profiles p on p.id = u.id
     where u.email ilike q or p.first_name ilike q or u.id::text ilike q
     order by u.created_at desc limit least(greatest(p_limit, 1), 500)) x), '[]'::jsonb);
end;
$$;

create or replace function public.admin_reports(p_open_only boolean default true)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
    select rp.id, rp.target_kind, rp.target_id, rp.reason, rp.details, rp.created_at, rp.status, rp.resolution, rp.resolved_at,
           u.email as reporter_email, pr.first_name as reporter_name,
           case rp.target_kind
             when 'listing' then (select format('%s (%s)', l.title, l.city) from public.listings l where l.id = rp.target_id)
             when 'user' then (select coalesce(tu.email, '') from auth.users tu where tu.id = rp.target_id)
             when 'message' then (select left(m.body, 300) from public.messages m where m.id = rp.target_id)
           end as target_text,
           case rp.target_kind
             when 'listing' then (select tu.email from public.listings l join auth.users tu on tu.id = l.host_id where l.id = rp.target_id)
             when 'user' then (select tu.email from auth.users tu where tu.id = rp.target_id)
             when 'message' then (select tu.email from public.messages m join auth.users tu on tu.id = m.sender_id where m.id = rp.target_id)
           end as target_owner_email,
           case rp.target_kind
             when 'listing' then (select l.host_id from public.listings l where l.id = rp.target_id)
             when 'user' then rp.target_id
             when 'message' then (select m.sender_id from public.messages m where m.id = rp.target_id)
           end as target_owner_id
      from public.reports rp
      left join auth.users u on u.id = rp.reporter_id left join public.profiles pr on pr.id = rp.reporter_id
     where not p_open_only or rp.status = 'open'
     order by rp.created_at desc limit 300) x), '[]'::jsonb);
end;
$$;

create or replace function public.admin_log_entries(p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
    select g.created_at, g.action, g.target, g.note, u.email as admin_email
      from private.admin_log g left join auth.users u on u.id = g.admin_id
     order by g.created_at desc limit least(greatest(p_limit, 1), 500)) x), '[]'::jsonb);
end;
$$;

-- Admin: actions ---------------------------------------------------------------
create or replace function public.admin_set_listing_status(p_listing uuid, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_status not in ('published', 'paused') then raise exception 'bad_request' using errcode = 'P0001'; end if;
  update public.listings
     set status = p_status::public.listing_status,
         published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_listing;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform private.log_admin('listing_' || p_status, p_listing::text, p_note);
end;
$$;

create or replace function public.admin_refund_payment(p_payment uuid, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.payments
     set refund_requested_at = now(), refund_amount = amount
   where id = p_payment and status = 'paid' and refund_requested_at is null;
  if not found then raise exception 'not_refundable' using errcode = 'P0001'; end if;
  perform private.log_admin('refund', p_payment::text, p_note);
  perform private.kick_payments();
end;
$$;

-- Blocking stops the account from signing in (and its tokens from being renewed)
-- and pauses its listings.
create or replace function public.admin_set_blocked(p_user uuid, p_blocked boolean, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_user = (select auth.uid()) then raise exception 'not_yourself' using errcode = 'P0001'; end if;
  update auth.users set banned_until = case when p_blocked then 'infinity'::timestamptz end where id = p_user;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_blocked then
    update public.listings set status = 'paused' where host_id = p_user and status = 'published';
    delete from auth.refresh_tokens where user_id = p_user::text;
  end if;
  perform private.log_admin(case when p_blocked then 'block_user' else 'unblock_user' end, p_user::text, p_note);
end;
$$;

create or replace function public.admin_resolve_report(p_report uuid, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_status not in ('resolved', 'dismissed', 'open') then raise exception 'bad_request' using errcode = 'P0001'; end if;
  update public.reports
     set status = p_status, resolution = left(coalesce(p_note, ''), 2000),
         resolved_at = case when p_status = 'open' then null else now() end,
         resolved_by = case when p_status = 'open' then null else (select auth.uid()) end
   where id = p_report;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform private.log_admin('report_' || p_status, p_report::text, p_note);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_overview()', 'admin_bookings(text, int)', 'admin_payments(text, int)', 'admin_listings(text, int)',
    'admin_users(text, int)', 'admin_reports(boolean)', 'admin_log_entries(int)',
    'admin_set_listing_status(uuid, text, text)', 'admin_refund_payment(uuid, text)',
    'admin_set_blocked(uuid, boolean, text)', 'admin_resolve_report(uuid, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
