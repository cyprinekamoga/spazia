-- Deleting listings: gone for good without history, hidden with history,
-- refused while a rental is going on.
begin;

select set_config('t.host', tests.new_user('host@example.com', 'Hanna')::text, true);
select set_config('t.renter', tests.new_user('renter@example.com', 'Rolf')::text, true);
select set_config('t.other', tests.new_user('other@example.com', 'Olle')::text, true);
select set_config('t.empty', tests.new_listing(current_setting('t.host')::uuid, 'Luleå')::text, true);
select set_config('t.history', tests.new_listing(current_setting('t.host')::uuid, 'Luleå')::text, true);
select set_config('t.busy', tests.new_listing(current_setting('t.host')::uuid, 'Luleå')::text, true);
-- History: a rental that ended last month, and a request nobody has answered.
select tests.new_request(current_setting('t.history')::uuid, current_setting('t.renter')::uuid, 'accepted', current_date - 90, current_date - 30);
select set_config('t.pending', tests.new_request(current_setting('t.history')::uuid, current_setting('t.other')::uuid)::text, true);
-- Busy: a rental going on now.
select tests.new_request(current_setting('t.busy')::uuid, current_setting('t.renter')::uuid, 'accepted', current_date - 10);

set local role authenticated;
do $$
declare res text;
begin
  -- Someone else's listing: not found.
  perform tests.act_as(current_setting('t.renter')::uuid);
  begin
    perform public.delete_listing(current_setting('t.empty')::uuid);
    perform tests.ok(false, 'must not delete another host''s listing');
  exception when no_data_found then null; end;

  perform tests.act_as(current_setting('t.host')::uuid);
  res := public.delete_listing(current_setting('t.empty')::uuid);
  perform tests.ok(res = 'deleted', 'no history: deleted, got ' || res);

  res := public.delete_listing(current_setting('t.history')::uuid);
  perform tests.ok(res = 'archived', 'with history: archived, got ' || res);

  begin
    perform public.delete_listing(current_setting('t.busy')::uuid);
    perform tests.ok(false, 'must refuse while a rental is going on');
  exception when raise_exception then perform tests.ok(sqlerrm = 'active_rentals', sqlerrm); end;

  -- An archived listing can't be published again or deleted twice, and the host can't clear the mark.
  begin
    perform public.publish_listing(current_setting('t.history')::uuid);
    perform tests.ok(false, 'archived listing must not be published');
  exception when no_data_found then null; end;
  update public.listings set deleted_at = null where id = current_setting('t.history')::uuid;
end $$;
reset role;

do $$ begin
  perform tests.ok(not exists (select 1 from public.listings where id = current_setting('t.empty')::uuid), 'empty listing gone');
  perform tests.ok((select status = 'paused' and deleted_at is not null from public.listings where id = current_setting('t.history')::uuid),
                   'archived listing hidden and kept, mark still set');
  perform tests.ok(exists (select 1 from public.requests where listing_id = current_setting('t.history')::uuid and status = 'accepted'),
                   'past rental kept');
  perform tests.ok((select status = 'declined' from public.requests where id = current_setting('t.pending')::uuid), 'unanswered request declined');
  perform tests.ok(exists (select 1 from private.notifications where request_id = current_setting('t.pending')::uuid and kind = 'request_declined'),
                   'renter is emailed');
  perform tests.ok((select status = 'published' and deleted_at is null from public.listings where id = current_setting('t.busy')::uuid), 'busy listing untouched');
end $$;

rollback;
