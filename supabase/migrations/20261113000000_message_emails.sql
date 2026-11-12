-- Emails about new chat messages.
--
-- When someone writes in a conversation, the other person gets an email if they
-- haven't read it within 10 minutes. At most one such email per conversation and
-- person per hour; later messages in that hour are included in the next one.
-- The email is queued like the booking emails (private.notifications) but waits
-- until send_after, and is dropped if the message has been read by then.

alter table private.notifications
  add column if not exists conversation_id uuid references public.conversations (id) on delete cascade,
  add column if not exists send_after timestamptz not null default now(),
  add column if not exists skipped boolean not null default false;

alter table private.notifications drop constraint if exists notifications_kind_check;
alter table private.notifications add constraint notifications_kind_check check (kind in (
  'request_new', 'parking_booked', 'request_accepted', 'request_declined',
  'cancelled_by_renter', 'cancelled_by_host',
  'payment_failed', 'payment_lapsed', 'rental_ending', 'new_message'));

create index if not exists notifications_message_idx
  on private.notifications (conversation_id, recipient, created_at desc) where kind = 'new_message';

-- Queue a message email for the other person in the conversation.
create or replace function private.messages_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  who uuid;
  req uuid;
  last_sent timestamptz;
begin
  if new.kind <> 'text' then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  if c.id is null then return new; end if;
  who := case when new.sender_id = c.host_id then c.renter_id else c.host_id end;

  -- Written together with a new request or parking booking: that email already shows it.
  if exists (select 1 from public.requests r
              where r.conversation_id = c.id and (r.created_at = now() or r.responded_at = now())) then
    return new;
  end if;

  -- One waiting email per conversation and person is enough: it shows every unread message.
  if exists (select 1 from private.notifications
              where kind = 'new_message' and conversation_id = c.id and recipient = who and sent_at is null) then
    return new;
  end if;

  -- The conversation's latest request: the email needs one for its place details.
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
revoke all on function private.messages_notify() from public, anon, authenticated;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function private.messages_notify();

-- Send what is due. Message emails whose messages have been read are dropped.
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
end;
$$;
revoke all on function private.retry_notifications() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'spazia-retry-notifications';
select cron.schedule('spazia-retry-notifications', '*/5 * * * *', 'select private.retry_notifications()');

-- The email's details, plus the unread messages for message emails.
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
