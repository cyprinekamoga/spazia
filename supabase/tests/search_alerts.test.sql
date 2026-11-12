-- Search alerts: a published listing queues one email per matching saved
-- search; the email lists what is new since the last one; the first
-- publication also queues the waitlist announcement.
begin;

select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.renter', tests.new_user('renter@example.com', 'Rolf')::text, true);
select set_config('t.other', tests.new_user('other@example.com', 'Olle')::text, true);

-- Renter: Uppsala, boxes, at most 150 kr. Other: Umeå (should not match).
set local role authenticated;
select tests.act_as(current_setting('t.renter')::uuid);
insert into public.search_alerts (place, category, max_price) values (' uppsala ', 'boxes', 150);
-- Own alerts only.
select tests.act_as(current_setting('t.other')::uuid);
insert into public.search_alerts (place) values ('Umeå');
do $$ begin
  perform tests.ok((select count(*) from public.search_alerts) = 1, 'others'' alerts are not visible');
end $$;
reset role;
-- (Everything in this test happens at the same instant: make the alerts older.)
update public.search_alerts set created_at = now() - interval '1 day';

-- A draft listing in Uppsala: nothing queued yet.
select set_config('t.l1', tests.new_listing(current_setting('t.host')::uuid, 'Uppsala', 100, 'boxes', 'draft')::text, true);
do $$ begin
  perform tests.ok(not exists (select 1 from private.notifications where kind = 'search_match'), 'drafts queue nothing');
end $$;

-- Published: one email for the renter, none for Umeå, and a waitlist announcement.
update public.listings set status = 'published', published_at = now() where id = current_setting('t.l1')::uuid;
do $$ begin
  perform tests.ok((select count(*) from private.notifications where kind = 'search_match' and recipient = current_setting('t.renter')::uuid) = 1, 'renter queued');
  perform tests.ok(not exists (select 1 from private.notifications where kind = 'search_match' and recipient = current_setting('t.other')::uuid), 'Umeå alert not queued');
  perform tests.ok(exists (select 1 from private.listing_announcements where listing_id = current_setting('t.l1')::uuid and send_after > now()), 'waitlist queued with grace period');
end $$;

-- A second listing the same day joins the waiting email (no second one). Too expensive ones are left out of it.
select set_config('t.l2', tests.new_listing(current_setting('t.host')::uuid, 'Uppsala', 200, 'boxes')::text, true);
select set_config('t.l3', tests.new_listing(current_setting('t.host')::uuid, 'Uppsala', 120, 'boxes')::text, true);
do $$ begin
  perform tests.ok((select count(*) from private.notifications where kind = 'search_match' and recipient = current_setting('t.renter')::uuid) = 1, 'still one waiting email');
end $$;

-- Claim it (as /api/notify does, once due).
update private.notifications set send_after = now() where kind = 'search_match';
do $$
declare
  n private.notifications;
  p jsonb;
begin
  select * into n from private.notifications where kind = 'search_match' and recipient = current_setting('t.renter')::uuid;
  p := public.claim_notification(n.id, n.token);
  perform tests.ok(p->>'kind' = 'search_match' and p->>'to_email' = 'renter@example.com', 'payload for the renter: ' || coalesce(p::text, 'null'));
  perform tests.ok(jsonb_array_length(p->'listings') = 2, 'two matching listings (200 kr host price is 230 kr: too much): ' || (p->'listings')::text);
  perform tests.ok((select array_agg((e->>'price_month')::int order by (e->>'price_month')::int) from jsonb_array_elements(p->'listings') e) = array[115, 138],
                   'renter prices with the service fee (100 → 115, 120 → 138)');
  perform tests.ok(p->'alert'->>'place' = 'uppsala', 'place trimmed');
  perform public.finish_notification(n.id, n.token, true);
  perform tests.ok((select last_sent_at is not null from public.search_alerts where id = n.alert_id), 'new-since mark moved');
end $$;

-- The next listing waits until 20 hours after the last email.
select set_config('t.l4', tests.new_listing(current_setting('t.host')::uuid, 'Uppsala', 90, 'boxes')::text, true);
do $$ begin
  perform tests.ok((select send_after > now() + interval '19 hours' from private.notifications
                     where kind = 'search_match' and sent_at is null), 'next email spaced out');
end $$;

-- If nothing new matches when it is due, it is skipped (not sent).
update public.listings set status = 'paused' where id = current_setting('t.l4')::uuid;
update private.notifications set send_after = now() where kind = 'search_match' and sent_at is null;
do $$
declare n private.notifications;
begin
  select * into n from private.notifications where kind = 'search_match' and sent_at is null;
  perform tests.ok(public.claim_notification(n.id, n.token) is null, 'nothing new: no email');
  perform tests.ok((select skipped and sent_at is not null from private.notifications where id = n.id), 'marked as skipped');
end $$;

-- Re-publishing a paused listing does not announce it to the waitlist again.
update public.listings set status = 'published' where id = current_setting('t.l4')::uuid;
do $$ begin
  perform tests.ok((select count(*) from private.listing_announcements where listing_id = current_setting('t.l4')::uuid) = 1, 'one announcement per listing');
end $$;

-- The announcement: claimable once due, then done.
update private.listing_announcements set send_after = now() where listing_id = current_setting('t.l1')::uuid;
do $$
declare
  a private.listing_announcements;
  p jsonb;
begin
  select * into a from private.listing_announcements where listing_id = current_setting('t.l1')::uuid;
  p := public.claim_listing_announcement(a.listing_id, a.token);
  perform tests.ok(p->>'city' = 'Uppsala' and (p->>'price_month')::int = 115 and p->'categories' = '["boxes"]'::jsonb, 'announcement payload: ' || coalesce(p::text, 'null'));
  perform public.finish_listing_announcement(a.listing_id, a.token, true);
  perform tests.ok(public.claim_listing_announcement(a.listing_id, a.token) is null, 'used token gives nothing');
end $$;

-- Ten alerts at most; deleting the account removes them.
set local role authenticated;
select tests.act_as(current_setting('t.other')::uuid);
do $$ begin
  for i in 1..9 loop insert into public.search_alerts (place) values ('Ort ' || i); end loop;
  begin
    insert into public.search_alerts (place) values ('Ort 10');
    perform tests.ok(false, 'eleventh alert must be refused');
  exception when raise_exception then perform tests.ok(sqlerrm = 'too_many_alerts', sqlerrm); end;
end $$;
reset role;
update public.profiles set deleted_at = now() where id = current_setting('t.other')::uuid;
do $$ begin
  perform tests.ok(not exists (select 1 from public.search_alerts where user_id = current_setting('t.other')::uuid), 'alerts removed with the account');
end $$;

rollback;
