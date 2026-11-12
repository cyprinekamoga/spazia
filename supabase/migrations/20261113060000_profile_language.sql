-- The app in English: each user's language, so emails can follow it.
-- Set by the app (language switch, and on start when it differs).

alter table public.profiles
  add column if not exists lang text not null default 'sv' check (lang in ('sv', 'en'));

-- Emails get the recipient's language.
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
