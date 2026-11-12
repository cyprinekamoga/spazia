-- Favourites are private; blocking stops messages and new requests both
-- ways; chat photos are only for the two people in the conversation; the
-- price hint needs three other listings.
begin;

select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.renter', tests.new_user('renter@example.com', 'Rolf')::text, true);
select set_config('t.stranger', tests.new_user('stranger@example.com', 'Sven')::text, true);
select set_config('t.listing', tests.new_listing(current_setting('t.host')::uuid, 'Uppsala', 100)::text, true);
select set_config('t.req', tests.new_request(current_setting('t.listing')::uuid, current_setting('t.renter')::uuid)::text, true);
select set_config('t.conv', (select conversation_id::text from public.requests where id = current_setting('t.req')::uuid), true);
-- (Messages written together with a new request make no email: make the request older.)
update public.requests set created_at = now() - interval '1 hour' where id = current_setting('t.req')::uuid;

set local role authenticated;

-- Favourites: own rows only.
do $$ begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  insert into public.favourites (listing_id) values (current_setting('t.listing')::uuid);
  perform tests.ok((select count(*) from public.favourites) = 1, 'renter sees own favourite');
  perform tests.act_as(current_setting('t.stranger')::uuid);
  perform tests.ok((select count(*) from public.favourites) = 0, 'others do not');
end $$;

-- Photos: a path in the conversation's folder, uploaded by one of its people.
do $$
declare path text := current_setting('t.conv') || '/' || gen_random_uuid() || '.jpg';
begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  insert into storage.objects (bucket_id, name) values ('chat-photos', path);
  insert into public.messages (conversation_id, sender_id, kind, body) values (current_setting('t.conv')::uuid, current_setting('t.renter')::uuid, 'image', path);
  perform tests.act_as(current_setting('t.host')::uuid);
  perform tests.ok((select count(*) from storage.objects where bucket_id = 'chat-photos') = 1, 'host can open the photo');
  perform tests.act_as(current_setting('t.stranger')::uuid);
  perform tests.ok((select count(*) from storage.objects where bucket_id = 'chat-photos') = 0, 'a stranger cannot');
  begin
    insert into storage.objects (bucket_id, name) values ('chat-photos', current_setting('t.conv') || '/' || gen_random_uuid() || '.jpg');
    perform tests.ok(false, 'stranger must not upload into the conversation');
  exception when insufficient_privilege then null; end;
  -- An image message must point into its own conversation's folder.
  perform tests.act_as(current_setting('t.renter')::uuid);
  begin
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (current_setting('t.conv')::uuid, current_setting('t.renter')::uuid, 'image', gen_random_uuid() || '/' || gen_random_uuid() || '.jpg');
    perform tests.ok(false, 'foreign path must be refused');
  exception when check_violation then null; end;
end $$;

-- The photo makes a message email, shown as a photo.
reset role;
update private.notifications set send_after = now() where kind = 'new_message';
do $$
declare
  n private.notifications;
  p jsonb;
begin
  select * into n from private.notifications where kind = 'new_message' and recipient = current_setting('t.host')::uuid;
  perform tests.ok(n.id is not null, 'photo queued a message email');
  p := public.claim_notification(n.id, n.token);
  perform tests.ok(p->'unread'->0->>'body' = '[image]', 'listed as a photo: ' || coalesce((p->'unread')::text, 'null'));
end $$;

-- Blocking: the host blocks the renter.
set local role authenticated;
do $$ begin
  perform tests.act_as(current_setting('t.host')::uuid);
  insert into public.user_blocks (blocked_id) values (current_setting('t.renter')::uuid);
  perform tests.ok(public.conversation_blocked(current_setting('t.conv')::uuid), 'host sees the block');
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform tests.ok(public.conversation_blocked(current_setting('t.conv')::uuid), 'renter sees it too');
  perform tests.ok((select count(*) from public.user_blocks) = 0, 'but not who blocked whom');
  begin
    insert into public.messages (conversation_id, sender_id, body) values (current_setting('t.conv')::uuid, current_setting('t.renter')::uuid, 'Hallå?');
    perform tests.ok(false, 'blocked: no message');
  exception when raise_exception then perform tests.ok(sqlerrm = 'blocked', sqlerrm); end;
end $$;
reset role;
do $$ begin
  begin
    perform tests.new_request(current_setting('t.listing')::uuid, current_setting('t.renter')::uuid, 'pending', current_date + 60);
    perform tests.ok(false, 'blocked: no new request');
  exception when raise_exception then perform tests.ok(sqlerrm = 'blocked', sqlerrm); end;
  perform tests.ok(exists (select 1 from public.requests where id = current_setting('t.req')::uuid), 'the existing request stays');
end $$;
-- Unblocked: messages work again.
set local role authenticated;
do $$ begin
  perform tests.act_as(current_setting('t.host')::uuid);
  delete from public.user_blocks where blocked_id = current_setting('t.renter')::uuid;
  insert into public.messages (conversation_id, sender_id, body) values (current_setting('t.conv')::uuid, current_setting('t.host')::uuid, 'Hej igen');
end $$;

-- Price hint: nothing with fewer than three other listings; own listings never count.
do $$
declare h jsonb;
begin
  perform tests.act_as(current_setting('t.stranger')::uuid);
  perform tests.ok(public.price_hint('Uppsala', 'boxes') is null, 'one listing: no hint');
end $$;
reset role;
select tests.new_listing(tests.new_user('h2@example.com'), 'Uppsala', 80);
select tests.new_listing(tests.new_user('h3@example.com'), 'uppsala ', 120);
set local role authenticated;
do $$
declare h jsonb;
begin
  perform tests.act_as(current_setting('t.stranger')::uuid);
  h := public.price_hint('Uppsala', 'boxes');
  perform tests.ok((h->>'count')::int = 3 and (h->>'low')::int = 80 and (h->>'median')::int = 100 and (h->>'high')::int = 120, 'hint: ' || coalesce(h::text, 'null'));
  perform tests.act_as(current_setting('t.host')::uuid);
  perform tests.ok(public.price_hint('Uppsala', 'boxes') is null, 'the host''s own listing is left out (two others)');
end $$;

rollback;
