-- Emails about requests and bookings, and cancellation rules for hourly parking.
--
-- Emails: every new request, parking booking, answer and cancellation queues a
-- row in private.notifications. The database then POSTs {id, token} to the
-- site's /api/notify function (pg_net). The function trades the one-time
-- token for the details (claim_notification), sends the email over SMTP and
-- reports back (finish_notification). Nothing secret travels: the token only
-- works once, for one email. A job every 10 minutes resends what wasn't sent.
--
-- The address of the function is in private.settings ('notify_url'). While it
-- is not set, emails wait in the queue (for up to a day).

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists private.settings (
  key    text primary key,
  value  text not null
);
revoke all on private.settings from public, anon, authenticated;

-- Who cancelled, when and why.
alter table public.requests
  add column if not exists cancelled_by uuid references public.profiles (id) on delete set null,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text not null default '' check (char_length(cancel_reason) <= 500);

create table if not exists private.notifications (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests (id) on delete cascade,
  kind        text not null check (kind in (
                'request_new', 'parking_booked', 'request_accepted', 'request_declined',
                'cancelled_by_renter', 'cancelled_by_host')),
  recipient   uuid not null references public.profiles (id) on delete cascade,
  prev_status text,
  token       text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  sent_at     timestamptz,
  attempts    int not null default 0
);
create index if not exists notifications_unsent_idx on private.notifications (created_at) where sent_at is null;
revoke all on private.notifications from public, anon, authenticated;

-- POST one notification to the site. Does nothing while notify_url is unset.
create or replace function private.post_notification(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  url text := (select value from private.settings where key = 'notify_url');
  n private.notifications;
begin
  if url is null or url = '' then return; end if;
  update private.notifications set attempts = attempts + 1 where id = p_id returning * into n;
  if n.id is null then return; end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('id', n.id, 'token', n.token),
    headers := jsonb_build_object('content-type', 'application/json'),
    timeout_milliseconds := 15000
  );
end;
$$;

-- Queue an email when a request is created or changes status.
create or replace function private.requests_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  k text;
  who uuid;
  nid uuid;
begin
  if tg_op = 'INSERT' then
    if new.kind = 'month' and new.status = 'pending' then
      k := 'request_new'; who := new.host_id;
    elsif new.kind = 'hour' and new.status = 'accepted' then
      k := 'parking_booked'; who := new.host_id;
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' and old.status = 'pending' then
      k := 'request_accepted'; who := new.renter_id;
    elsif new.status = 'declined' then
      k := 'request_declined'; who := new.renter_id;
    elsif new.status = 'cancelled' then
      if new.cancelled_by = new.host_id then
        k := 'cancelled_by_host'; who := new.renter_id;
      else
        k := 'cancelled_by_renter'; who := new.host_id;
      end if;
    end if;
  end if;

  if k is not null then
    insert into private.notifications (request_id, kind, recipient, prev_status)
    values (new.id, k, who, case when tg_op = 'UPDATE' then old.status::text end)
    returning id into nid;
    perform private.post_notification(nid);
  end if;
  return new;
end;
$$;

drop trigger if exists requests_notify on public.requests;
create trigger requests_notify
  after insert or update of status on public.requests
  for each row execute function private.requests_notify();

revoke all on function private.post_notification(uuid) from public, anon, authenticated;
revoke all on function private.requests_notify() from public, anon, authenticated;

-- The site's function trades {id, token} for the email's details, once.
-- A claim that wasn't finished within 10 minutes can be claimed again.
create or replace function public.claim_notification(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  n private.notifications;
  r public.requests;
  l public.listings;
  other uuid;
begin
  update private.notifications
     set claimed_at = now()
   where id = p_id and token = p_token and sent_at is null
     and (claimed_at is null or claimed_at < now() - interval '10 minutes')
     and created_at > now() - interval '1 day'
  returning * into n;
  if n.id is null then return null; end if;

  select * into r from public.requests where id = n.request_id;
  select * into l from public.listings where id = r.listing_id;
  other := case when n.recipient = r.host_id then r.renter_id else r.host_id end;

  return jsonb_build_object(
    'kind', n.kind,
    'prev_status', n.prev_status,
    'role', case when n.recipient = r.host_id then 'host' else 'renter' end,
    'to_email', (select u.email from auth.users u where u.id = n.recipient),
    'to_name', (select p.first_name from public.profiles p where p.id = n.recipient),
    'other_name', (select p.first_name from public.profiles p where p.id = other),
    'request_id', r.id,
    'request_kind', r.kind,
    'start_date', r.start_date,
    'end_date', r.end_date,
    'start_at', r.start_at,
    'end_at', r.end_at,
    'host_total', r.host_total,
    'message', r.message,
    'expires_at', r.expires_at,
    'decline_reason', r.decline_reason,
    'cancel_reason', r.cancel_reason,
    'listing_title', l.title,
    'listing_city', l.city,
    'listing_area', l.area_name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'category', i.category, 'quantity', i.quantity, 'host_price_month', i.host_price_month,
               'hourly_price', i.hourly_price, 'daily_max', i.daily_max) order by i.category)
        from public.request_items i where i.request_id = r.id), '[]'::jsonb)
  );
end;
$$;

-- The function reports whether the email went out. If not, it is released for a retry.
create or replace function public.finish_notification(p_id uuid, p_token text, p_sent boolean)
returns void language sql security definer set search_path = '' as $$
  update private.notifications
     set sent_at = case when p_sent then now() end,
         claimed_at = case when p_sent then claimed_at end
   where id = p_id and token = p_token and sent_at is null;
$$;

revoke all on function public.claim_notification(uuid, text) from public;
revoke all on function public.finish_notification(uuid, text, boolean) from public;
grant execute on function public.claim_notification(uuid, text) to anon, authenticated;
grant execute on function public.finish_notification(uuid, text, boolean) to anon, authenticated;

-- Resend what wasn't sent: up to 5 tries, within a day.
create or replace function private.retry_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare
  nid uuid;
begin
  for nid in select id from private.notifications
              where sent_at is null and attempts < 5
                and created_at > now() - interval '1 day'
                and created_at < now() - interval '2 minutes'
                and (claimed_at is null or claimed_at < now() - interval '10 minutes')
              order by created_at limit 50 loop
    perform private.post_notification(nid);
  end loop;
end;
$$;
revoke all on function private.retry_notifications() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'spazia-retry-notifications';
select cron.schedule('spazia-retry-notifications', '*/10 * * * *', 'select private.retry_notifications()');

-- Cancelling ------------------------------------------------------------------
-- Monthly rentals: either side can cancel a pending or accepted request, as before.
-- Hourly parking:
--   * the renter can cancel free of charge until 1 hour before the start
--   * the host can cancel until the start (the renter is emailed)
--   * nobody can cancel once the booking has started
drop function if exists public.cancel_request(uuid);
create or replace function public.cancel_request(p_request uuid, p_reason text default '')
returns public.request_status
language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  me uuid := (select auth.uid());
  reason text := left(trim(coalesce(p_reason, '')), 500);
begin
  select * into r from public.requests where id = p_request for update;
  if r.id is null or me is null or me not in (r.host_id, r.renter_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status not in ('pending', 'accepted') then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  if r.kind = 'hour' then
    if now() >= r.start_at then
      raise exception 'already_started' using errcode = 'P0001';
    end if;
    if me = r.renter_id and now() > r.start_at - interval '1 hour' then
      raise exception 'too_late' using errcode = 'P0001';
    end if;
  end if;

  update public.requests
     set status = 'cancelled', responded_at = coalesce(responded_at, now()),
         cancelled_by = me, cancelled_at = now(), cancel_reason = reason
   where id = r.id;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (r.conversation_id, me, 'event', 'request_cancelled');
  if reason <> '' then
    insert into public.messages (conversation_id, sender_id, body, created_at)
    values (r.conversation_id, me, reason, clock_timestamp());
  end if;
  return 'cancelled';
end;
$$;

revoke all on function public.cancel_request(uuid, text) from public, anon;
grant execute on function public.cancel_request(uuid, text) to authenticated;
