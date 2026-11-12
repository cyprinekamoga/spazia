-- Push notifications. The app (installed or in the browser) can subscribe
-- this device; every email about a booking or a message is then also sent as
-- a push notification by /api/notify. Subscriptions that the push service
-- says are gone are removed.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint    text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  user_agent  text not null default '' check (char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
grant select, insert, delete on public.push_subscriptions to authenticated;

-- /api/notify drops subscriptions the push service rejected (gone or expired),
-- with the same one-time token as the notification.
create or replace function public.drop_push_subscriptions(p_id uuid, p_token text, p_endpoints text[])
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions s
   using private.notifications n
   where n.id = p_id and n.token = p_token and s.user_id = n.recipient and s.endpoint = any (p_endpoints);
$$;
revoke all on function public.drop_push_subscriptions(uuid, text, text[]) from public;
grant execute on function public.drop_push_subscriptions(uuid, text, text[]) to anon, authenticated;

-- The email details also carry the recipient's push subscriptions.
create or replace function public.claim_notification(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  n private.notifications;
  r public.requests;
  l public.listings;
  pay public.payments;
  other uuid;
  unread jsonb;
begin
  update private.notifications
     set claimed_at = now()
   where id = p_id and token = p_token and sent_at is null and send_after <= now()
     and (claimed_at is null or claimed_at < now() - interval '10 minutes')
     and created_at > now() - interval '1 day'
  returning * into n;
  if n.id is null then return null; end if;

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
