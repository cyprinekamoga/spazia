-- Four small features:
--   favourites   renters save listings (a heart)
--   user_blocks  anyone can block another user: no more messages or new
--                requests between the two (existing bookings stay)
--   photos in chat  messages of kind 'image', the photo in a private bucket
--                that only the two people in the conversation can open
--   price_hint   what other hosts in the same town charge (shown in the
--                listing wizard), only when at least three listings exist

-- Favourites -----------------------------------------------------------------
create table if not exists public.favourites (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.favourites enable row level security;
drop policy if exists "own favourites" on public.favourites;
create policy "own favourites" on public.favourites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.favourites from anon;
grant select, insert, delete on public.favourites to authenticated;

-- Blocking ---------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists "own blocks" on public.user_blocks;
create policy "own blocks" on public.user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
revoke all on public.user_blocks from anon;
grant select, insert, delete on public.user_blocks to authenticated;

-- Either way round.
create or replace function private.blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks
                  where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- Has the other person in this conversation been blocked by me, or blocked me?
create or replace function public.conversation_blocked(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversations c
                  where c.id = p_conversation and (select auth.uid()) in (c.host_id, c.renter_id)
                    and private.blocked_between(c.host_id, c.renter_id));
$$;
grant execute on function public.conversation_blocked(uuid) to authenticated;

create or replace function private.messages_block_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
begin
  if new.kind = 'event' then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  if private.blocked_between(c.host_id, c.renter_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_block_check on public.messages;
create trigger messages_block_check before insert on public.messages
  for each row execute function private.messages_block_check();

create or replace function private.requests_block_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.blocked_between(new.host_id, new.renter_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists requests_block_check on public.requests;
create trigger requests_block_check before insert on public.requests
  for each row execute function private.requests_block_check();

-- Photos in chat ---------------------------------------------------------------
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'event', 'image'));

-- An image message's body is the photo's path: <conversation id>/<file>.jpg
alter table public.messages drop constraint if exists messages_image_path;
alter table public.messages add constraint messages_image_path
  check (kind <> 'image' or body ~ ('^' || conversation_id::text || '/[0-9a-f-]{36}\.jpg$'));

drop policy if exists "send message" on public.messages;
create policy "send message" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and kind in ('text', 'image') and private.in_conversation(conversation_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-photos', 'chat-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- The first folder is the conversation: only its two people can upload or open.
create or replace function private.chat_photo_allowed(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_name))[1] ~ '^[0-9a-f-]{36}$'
     and private.in_conversation(((storage.foldername(p_name))[1])::uuid);
$$;
drop policy if exists "conversation reads chat photos" on storage.objects;
create policy "conversation reads chat photos" on storage.objects for select to authenticated
  using (bucket_id = 'chat-photos' and private.chat_photo_allowed(name));
drop policy if exists "conversation uploads chat photos" on storage.objects;
create policy "conversation uploads chat photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-photos' and private.chat_photo_allowed(name));

-- A photo also counts as a new message for the email (it shows as "Sent a photo").
create or replace function private.messages_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  who uuid;
  req uuid;
  last_sent timestamptz;
begin
  if new.kind not in ('text', 'image') then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  if c.id is null then return new; end if;
  who := case when new.sender_id = c.host_id then c.renter_id else c.host_id end;

  if exists (select 1 from public.requests r
              where r.conversation_id = c.id and (r.created_at = now() or r.responded_at = now())) then
    return new;
  end if;
  if exists (select 1 from private.notifications
              where kind = 'new_message' and conversation_id = c.id and recipient = who and sent_at is null) then
    return new;
  end if;
  select id into req from public.requests where conversation_id = c.id order by created_at desc limit 1;
  if req is null then return new; end if;

  select max(sent_at) into last_sent from private.notifications
   where kind = 'new_message' and conversation_id = c.id and recipient = who and not skipped;

  insert into private.notifications (request_id, kind, recipient, conversation_id, send_after)
  values (req, 'new_message', who, c.id,
          greatest(now() + interval '10 minutes', coalesce(last_sent + interval '1 hour', now())));
  return new;
end;
$$;

-- The message email lists photos too (as "[image]", which the email shows as
-- "sent a photo"), and a photo alone is not skipped as "nothing unread".
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
      from (select case when m.kind = 'image' then '[image]' else m.body end as body, m.created_at from public.messages m
             where m.conversation_id = n.conversation_id and m.kind in ('text', 'image') and m.sender_id <> n.recipient
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
        where m.conversation_id = n.conversation_id and m.kind in ('text', 'image') and m.sender_id <> n.recipient
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

-- Price hint -------------------------------------------------------------------
-- Lowest, middle and highest host price per unit and month for a type of
-- space in a town, from other hosts' published listings. Nothing below three
-- listings, so no single host's price can be read off.
create or replace function public.price_hint(p_city text, p_category text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with prices as (
    select s.host_price_month as p
      from public.listing_spaces s
      join public.listings l on l.id = s.listing_id
     where l.status = 'published' and s.category = p_category and s.host_price_month is not null
       and lower(btrim(l.city)) = lower(btrim(p_city))
       and l.host_id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid))
  select case when count(*) >= 3 then jsonb_build_object(
           'count', count(*),
           'low', percentile_disc(0.25) within group (order by p),
           'median', percentile_disc(0.5) within group (order by p),
           'high', percentile_disc(0.75) within group (order by p)) end
    from prices;
$$;
revoke all on function public.price_hint(text, text) from public;
grant execute on function public.price_hint(text, text) to authenticated;
