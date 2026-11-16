-- The fixes from the security review: publishing only through publish_listing,
-- a takedown sticks, locked profile columns, and former renters lose access.
begin;

select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.renter', tests.new_user('renter@example.com', 'Rolf')::text, true);
select set_config('t.admin', tests.new_user('admin@example.com', 'Ada')::text, true);
insert into private.admins (user_id) values (current_setting('t.admin')::uuid);
select set_config('t.draft', tests.new_listing(current_setting('t.host')::uuid, 'Luleå', 100, 'boxes', 'draft')::text, true);
select set_config('t.live', tests.new_listing(current_setting('t.host')::uuid, 'Luleå', 100)::text, true);
update public.listings set space_type = 'garage', access = 'anytime', title = 'Garage i Luleå'
 where id in (current_setting('t.draft')::uuid, current_setting('t.live')::uuid);
insert into public.listing_photos (listing_id, path, position)
select id, host_id || '/x.jpg', 0 from public.listings where id in (current_setting('t.draft')::uuid, current_setting('t.live')::uuid);

-- 1. The host can't publish directly or move the publish date; pausing still works.
set local role authenticated;
do $$
declare before timestamptz;
begin
  perform tests.act_as(current_setting('t.host')::uuid);
  begin
    update public.listings set status = 'published' where id = current_setting('t.draft')::uuid;
    perform tests.ok(false, 'direct publish must be refused');
  exception when raise_exception then perform tests.ok(sqlerrm = 'use_publish_listing', sqlerrm); end;
  select published_at into before from public.listings where id = current_setting('t.live')::uuid;
  update public.listings set published_at = now() + interval '1 year', title = 'Nytt namn' where id = current_setting('t.live')::uuid;
  perform tests.ok((select published_at = before and title = 'Nytt namn' from public.listings where id = current_setting('t.live')::uuid),
                   'published_at kept, other edits saved');
  update public.listings set status = 'paused' where id = current_setting('t.live')::uuid;
  perform tests.ok((select status = 'paused' from public.listings where id = current_setting('t.live')::uuid), 'host can pause');
  perform tests.ok(public.publish_listing(current_setting('t.live')::uuid) = 'published', 'and publish again through publish_listing');
end $$;

-- A takedown by the team sticks.
do $$ begin
  perform tests.act_as(current_setting('t.admin')::uuid);
  perform public.admin_set_listing_status(current_setting('t.live')::uuid, 'paused', 'reported');
  perform tests.act_as(current_setting('t.host')::uuid);
  begin
    perform public.publish_listing(current_setting('t.live')::uuid);
    perform tests.ok(false, 'publish after a takedown must be refused');
  exception when raise_exception then perform tests.ok(sqlerrm = 'taken_down', sqlerrm); end;
  begin
    update public.listings set status = 'published', taken_down_at = null where id = current_setting('t.live')::uuid;
    perform tests.ok(false, 'direct publish after a takedown must be refused');
  exception when raise_exception then perform tests.ok(sqlerrm = 'use_publish_listing', sqlerrm); end;
  update public.listings set taken_down_at = null where id = current_setting('t.live')::uuid;
  perform tests.ok((select taken_down_at is not null from public.listings where id = current_setting('t.live')::uuid), 'host cannot clear the mark');
  -- The team publishes it again: the mark goes.
  perform tests.act_as(current_setting('t.admin')::uuid);
  perform public.admin_set_listing_status(current_setting('t.live')::uuid, 'published', 'ok');
  perform tests.ok((select taken_down_at is null and status = 'published' from public.listings where id = current_setting('t.live')::uuid), 'republished by the team');
end $$;

-- 2. Profiles: only name, about, photo and language; referral codes are private.
do $$ begin
  perform tests.act_as(current_setting('t.host')::uuid);
  update public.profiles set first_name = 'Hanna B', lang = 'en' where id = current_setting('t.host')::uuid;
  perform tests.ok((select first_name = 'Hanna B' from public.profiles where id = current_setting('t.host')::uuid), 'name can be changed');
  begin
    update public.profiles set referral_code = 'GRATIS1' where id = current_setting('t.host')::uuid;
    perform tests.ok(false, 'referral code must not be writable');
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set deleted_at = null where id = current_setting('t.host')::uuid;
    perform tests.ok(false, 'deleted_at must not be writable');
  exception when insufficient_privilege then null; end;
  begin
    perform referral_code from public.profiles where id = current_setting('t.renter')::uuid;
    perform tests.ok(false, 'referral codes must not be readable');
  exception when insufficient_privilege then null; end;
  perform tests.ok(public.my_referral_code() ~ '^[A-Z0-9]{6,12}$', 'own code still comes from my_referral_code');
end $$;
reset role;

-- 3. A former renter keeps contact details and access instructions for 14 days after the end, not for ever.
update public.listing_private set access_instructions = 'Koden är 1234' where listing_id = current_setting('t.live')::uuid;
insert into public.profile_private (id, phone) values (current_setting('t.host')::uuid, '0701234567')
  on conflict (id) do update set phone = excluded.phone;
select set_config('t.req', tests.new_request(current_setting('t.live')::uuid, current_setting('t.renter')::uuid, 'accepted',
                                              current_date - 60, current_date - 5)::text, true);
set local role authenticated;
do $$ begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform tests.ok((select count(*) from public.listing_private where listing_id = current_setting('t.live')::uuid) = 1, 'ended 5 days ago: still visible');
  perform tests.ok((select count(*) from public.profile_private where id = current_setting('t.host')::uuid) = 1, 'host phone still visible');
end $$;
reset role;
update public.requests set end_date = current_date - 30 where id = current_setting('t.req')::uuid;
set local role authenticated;
do $$ begin
  perform tests.act_as(current_setting('t.renter')::uuid);
  perform tests.ok((select count(*) from public.listing_private where listing_id = current_setting('t.live')::uuid) = 0, 'ended 30 days ago: hidden');
  perform tests.ok((select count(*) from public.profile_private where id = current_setting('t.host')::uuid) = 0, 'host phone hidden');
end $$;
reset role;

rollback;
