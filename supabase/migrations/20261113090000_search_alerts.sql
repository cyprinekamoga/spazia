-- Search alerts ("Bevaka"): a renter saves a place (and optionally a type
-- and a highest monthly price); when a matching listing is published they get
-- one email and push notification listing what is new since the last one
-- (at most one every 20 hours, up to five listings).
--
-- Waitlist: the first time a listing is published, /api/notify is asked to
-- email the people on the spazia.se waitlist in that town (they live in
-- Netlify Blobs, not here). The function keeps it to one email a week each.

create table if not exists public.search_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place         text not null check (char_length(btrim(place)) between 2 and 60),
  category      text check (category is null or category in ('tyres', 'skis', 'snowmobile', 'bikes', 'boxes', 'car', 'parking')),
  max_price     int check (max_price is null or max_price between 1 and 1000000),
  created_at    timestamptz not null default now(),
  last_sent_at  timestamptz
);
create unique index if not exists search_alerts_unique on public.search_alerts (user_id, lower(btrim(place)), coalesce(category, ''));
alter table public.search_alerts enable row level security;
drop policy if exists "own search alerts" on public.search_alerts;
create policy "own search alerts" on public.search_alerts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.search_alerts from anon;
grant select, insert, delete on public.search_alerts to authenticated;

-- Ten saved searches per person is plenty.
create or replace function private.search_alerts_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.search_alerts where user_id = new.user_id) >= 10 then
    raise exception 'too_many_alerts' using errcode = 'P0001';
  end if;
  new.place := btrim(new.place);
  return new;
end;
$$;
drop trigger if exists search_alerts_limit on public.search_alerts;
create trigger search_alerts_limit before insert on public.search_alerts
  for each row execute function private.search_alerts_limit();

-- "Göteborg" matches the city Göteborg, "Majorna" the area Majorna.
create or replace function private.place_matches(p_place text, p_city text, p_area text)
returns boolean language sql immutable set search_path = '' as $$
  select position(lower(btrim(p_place)) in lower(coalesce(p_city, ''))) > 0
      or position(lower(btrim(p_place)) in lower(coalesce(p_area, ''))) > 0;
$$;

-- The notification queue also carries search matches (no request).
alter table private.notifications alter column request_id drop not null;
alter table private.notifications add column if not exists alert_id uuid references public.search_alerts (id) on delete cascade;
alter table private.notifications drop constraint if exists notifications_kind_check;
alter table private.notifications add constraint notifications_kind_check check (kind in (
  'request_new', 'parking_booked', 'request_accepted', 'request_declined', 'cancelled_by_renter', 'cancelled_by_host',
  'payment_failed', 'payment_lapsed', 'rental_ending', 'new_message', 'handover_new', 'handover_answered', 'review_invite',
  'search_match'));
alter table private.notifications drop constraint if exists notifications_subject_check;
alter table private.notifications add constraint notifications_subject_check
  check (case when kind = 'search_match' then alert_id is not null else request_id is not null end);
create index if not exists notifications_alert_idx on private.notifications (alert_id) where alert_id is not null;

-- Waitlist announcements, one per listing (its first publication).
create table if not exists private.listing_announcements (
  listing_id  uuid primary key references public.listings (id) on delete cascade,
  token       text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at  timestamptz not null default now(),
  send_after  timestamptz not null default now(),
  claimed_at  timestamptz,
  sent_at     timestamptz,
  attempts    int not null default 0,
  skipped     boolean not null default false
);

create or replace function private.post_listing_announcement(p_listing uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  url text := (select value from private.settings where key = 'notify_url');
  a private.listing_announcements;
begin
  if url is null or url = '' then return; end if;
  update private.listing_announcements set attempts = attempts + 1 where listing_id = p_listing returning * into a;
  if a.listing_id is null then return; end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('announce', a.listing_id, 'token', a.token),
    headers := jsonb_build_object('content-type', 'application/json'),
    timeout_milliseconds := 30000
  );
end;
$$;

-- On publication: queue the matching saved searches, and (first time only) the waitlist.
-- Fifteen minutes' grace, so the host can fix a typo or a photo first.
create or replace function private.listings_published()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then return null; end if;

  insert into private.notifications (kind, recipient, alert_id, send_after)
  select 'search_match', a.user_id, a.id,
         greatest(now() + interval '15 minutes', coalesce(a.last_sent_at + interval '20 hours', now()))
    from public.search_alerts a
    join public.profiles p on p.id = a.user_id and p.deleted_at is null
   where a.user_id <> new.host_id
     and private.place_matches(a.place, new.city, new.area_name)
     and not exists (select 1 from private.notifications n where n.alert_id = a.id and n.sent_at is null);

  if tg_op = 'INSERT' or old.published_at is null then
    insert into private.listing_announcements (listing_id, send_after)
    values (new.id, now() + interval '15 minutes')
    on conflict (listing_id) do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists listings_published on public.listings;
create trigger listings_published after insert or update of status on public.listings
  for each row execute function private.listings_published();

-- A deleted (anonymised) account's saved searches go with it.
create or replace function private.profiles_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.search_alerts where user_id = new.id;
  return null;
end;
$$;
drop trigger if exists profiles_deleted on public.profiles;
create trigger profiles_deleted after update of deleted_at on public.profiles
  for each row when (new.deleted_at is not null and old.deleted_at is null)
  execute function private.profiles_deleted();

create or replace function public.claim_notification(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  n private.notifications;
  r public.requests;
  l public.listings;
  pay public.payments;
  other uuid;
  unread jsonb;
  a public.search_alerts;
  found jsonb;
begin
  update private.notifications
     set claimed_at = now()
   where id = p_id and token = p_token and sent_at is null and send_after <= now()
     and (claimed_at is null or claimed_at < now() - interval '10 minutes')
     and created_at > now() - interval '1 day'
  returning * into n;
  if n.id is null then return null; end if;

  -- A saved search: the listings published since the last email (up to five).
  if n.kind = 'search_match' then
    select * into a from public.search_alerts where id = n.alert_id;
    select coalesce(jsonb_agg(to_jsonb(x) - 'published_at' order by x.published_at desc), '[]'::jsonb) into found
      from (select li.id, li.title, li.city, li.area_name, li.size_m2, li.published_at,
                   (select min(private.renter_price(s.host_price_month)) from public.listing_spaces s
                     where s.listing_id = li.id and s.host_price_month is not null and (a.category is null or s.category = a.category)) as price_month,
                   (select min(private.renter_price(s.hourly_price)) from public.listing_spaces s
                     where s.listing_id = li.id and s.hourly_price is not null and (a.category is null or s.category = a.category)) as price_hour
              from public.listings li
             where a.id is not null and li.status = 'published' and li.host_id <> a.user_id
               and li.published_at > coalesce(a.last_sent_at, a.created_at)
               and private.place_matches(a.place, li.city, li.area_name)
               and (a.category is null or exists (select 1 from public.listing_spaces s where s.listing_id = li.id and s.category = a.category))
               and (a.max_price is null or exists (
                     select 1 from public.listing_spaces s
                      where s.listing_id = li.id and (a.category is null or s.category = a.category)
                        and s.host_price_month is not null and private.renter_price(s.host_price_month) <= a.max_price))
             order by li.published_at desc
             limit 5) x;
    if jsonb_array_length(found) = 0 then
      update private.notifications set sent_at = now(), skipped = true where id = n.id;
      return null;
    end if;
    return jsonb_build_object(
      'kind', 'search_match',
      'request_id', null,
      'to_email', (select u.email from auth.users u where u.id = n.recipient),
      'to_name', (select p.first_name from public.profiles p where p.id = n.recipient),
      'lang', (select p.lang from public.profiles p where p.id = n.recipient),
      'push', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                          from public.push_subscriptions s where s.user_id = n.recipient), '[]'::jsonb),
      'alert', jsonb_build_object('id', a.id, 'place', a.place, 'category', a.category, 'max_price', a.max_price),
      'listings', found);
  end if;

  select * into r from public.requests where id = n.request_id;
  select * into l from public.listings where id = r.listing_id;
  select * into pay from public.payments where request_id = r.id order by period_index desc limit 1;
  other := case when n.recipient = r.host_id then r.renter_id else r.host_id end;

  if n.kind = 'new_message' then
    select coalesce(jsonb_agg(jsonb_build_object('body', m.body, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
      into unread
      from (select m.body, m.created_at from public.messages m
             where m.conversation_id = n.conversation_id and m.kind = 'text' and m.sender_id <> n.recipient
               and m.created_at > coalesce((select cr.last_read_at from public.conversation_reads cr
                                             where cr.conversation_id = n.conversation_id and cr.user_id = n.recipient), '-infinity')
             order by m.created_at desc limit 5) m;
  end if;

  return jsonb_build_object(
    'kind', n.kind,
    'prev_status', n.prev_status,
    'role', case when n.recipient = r.host_id then 'host' else 'renter' end,
    'to_email', (select u.email from auth.users u where u.id = n.recipient),
    'to_name', (select p.first_name from public.profiles p where p.id = n.recipient),
    'lang', (select p.lang from public.profiles p where p.id = n.recipient),
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
    'conversation_id', n.conversation_id,
    'unread', unread,
    'push', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                        from public.push_subscriptions s where s.user_id = n.recipient), '[]'::jsonb),
    'payment', case when pay.id is null then null else jsonb_build_object(
      'amount', pay.amount, 'host_amount', pay.host_amount, 'status', pay.status,
      'period_start', pay.period_start, 'period_end', pay.period_end, 'pay_by', pay.pay_by, 'failure', pay.failure) end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'category', i.category, 'quantity', i.quantity, 'host_price_month', i.host_price_month,
               'hourly_price', i.hourly_price, 'daily_max', i.daily_max) order by i.category)
        from public.request_items i where i.request_id = r.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.claim_notification(uuid, text) from public;
grant execute on function public.claim_notification(uuid, text) to anon, authenticated;

-- A sent search email moves the "new since" mark to when it was put together.
create or replace function public.finish_notification(p_id uuid, p_token text, p_sent boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n private.notifications;
begin
  update private.notifications
     set sent_at = case when p_sent then now() end,
         claimed_at = case when p_sent then claimed_at end
   where id = p_id and token = p_token and sent_at is null
  returning * into n;
  if p_sent and n.alert_id is not null then
    update public.search_alerts set last_sent_at = coalesce(n.claimed_at, now()) where id = n.alert_id;
  end if;
end;
$$;
revoke all on function public.finish_notification(uuid, text, boolean) from public;
grant execute on function public.finish_notification(uuid, text, boolean) to anon, authenticated;

-- /api/notify trades the one-time token for the listing; null when already
-- done, or when the listing is no longer published (then it is marked done).
create or replace function public.claim_listing_announcement(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a private.listing_announcements;
  l public.listings;
begin
  update private.listing_announcements
     set claimed_at = now()
   where listing_id = p_id and token = p_token and sent_at is null and send_after <= now()
     and (claimed_at is null or claimed_at < now() - interval '10 minutes')
     and created_at > now() - interval '2 days'
  returning * into a;
  if a.listing_id is null then return null; end if;
  select * into l from public.listings where id = a.listing_id and status = 'published';
  if l.id is null then
    update private.listing_announcements set sent_at = now(), skipped = true where listing_id = a.listing_id;
    return null;
  end if;
  return jsonb_build_object(
    'id', l.id, 'title', l.title, 'city', l.city, 'area_name', l.area_name, 'size_m2', l.size_m2,
    'price_month', (select min(private.renter_price(s.host_price_month)) from public.listing_spaces s where s.listing_id = l.id and s.host_price_month is not null),
    'price_hour', (select min(private.renter_price(s.hourly_price)) from public.listing_spaces s where s.listing_id = l.id and s.hourly_price is not null),
    'categories', coalesce((select jsonb_agg(distinct s.category) from public.listing_spaces s where s.listing_id = l.id), '[]'::jsonb));
end;
$$;

create or replace function public.finish_listing_announcement(p_id uuid, p_token text, p_sent boolean)
returns void language sql security definer set search_path = '' as $$
  update private.listing_announcements
     set sent_at = case when p_sent then now() end,
         claimed_at = case when p_sent then claimed_at end
   where listing_id = p_id and token = p_token and sent_at is null;
$$;
revoke all on function public.claim_listing_announcement(uuid, text) from public;
revoke all on function public.finish_listing_announcement(uuid, text, boolean) from public;
grant execute on function public.claim_listing_announcement(uuid, text) to anon, authenticated;
grant execute on function public.finish_listing_announcement(uuid, text, boolean) to anon, authenticated;

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
                and (kind in ('new_message', 'search_match') or created_at < now() - interval '2 minutes')
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

  for nid in select listing_id from private.listing_announcements
              where sent_at is null and attempts < 5
                and send_after <= now()
                and created_at > now() - interval '2 days'
                and (claimed_at is null or claimed_at < now() - interval '10 minutes')
              order by created_at limit 10 loop
    perform private.post_listing_announcement(nid);
  end loop;
end;
$$;
