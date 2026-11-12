-- Inventory list with photos at drop-off and pickup (storage rentals).
--
-- Whoever hands over the things (normally the renter) lists them and adds
-- photos in the app; the other person confirms the list or says it doesn't
-- match. One drop-off and one pickup per rental. Photos are private: only the
-- host and the renter of that rental can see them (bucket handover-photos,
-- files under <request id>/<handover id>/).

create table if not exists public.handovers (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.requests (id) on delete cascade,
  kind          text not null check (kind in ('dropoff', 'pickup')),
  created_by    uuid not null references public.profiles (id) on delete cascade,
  items         text not null default '' check (char_length(items) <= 4000),
  photos        text[] not null default '{}' check (cardinality(photos) <= 30),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  confirmed_by  uuid references public.profiles (id) on delete set null,
  confirmed_at  timestamptz,
  matches       boolean,
  response_note text not null default '' check (char_length(response_note) <= 1000),
  unique (request_id, kind)
);
alter table public.handovers enable row level security;
drop policy if exists "parties read handovers" on public.handovers;
create policy "parties read handovers" on public.handovers for select to authenticated
  using (exists (select 1 from public.requests r
                  where r.id = request_id and (select auth.uid()) in (r.host_id, r.renter_id)));
revoke all on public.handovers from anon;
revoke insert, update, delete on public.handovers from authenticated;
grant select on public.handovers to authenticated;

-- Event messages in the conversation and an email to the other person.
alter table private.notifications drop constraint if exists notifications_kind_check;
alter table private.notifications add constraint notifications_kind_check check (kind in (
  'request_new', 'parking_booked', 'request_accepted', 'request_declined',
  'cancelled_by_renter', 'cancelled_by_host',
  'payment_failed', 'payment_lapsed', 'rental_ending', 'new_message',
  'handover_new', 'handover_answered'));

-- Record (or, until it is confirmed, redo) the drop-off or pickup list.
create or replace function public.save_handover(p_request uuid, p_kind text, p_items text, p_photos text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  me uuid := (select auth.uid());
  h public.handovers;
  other uuid;
  photo text;
begin
  select * into r from public.requests where id = p_request;
  if r.id is null or me is null or me not in (r.host_id, r.renter_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.kind <> 'month' or r.status <> 'accepted' then raise exception 'not_active' using errcode = 'P0001'; end if;
  if p_kind not in ('dropoff', 'pickup') then raise exception 'bad_request' using errcode = 'P0001'; end if;
  if trim(coalesce(p_items, '')) = '' and coalesce(cardinality(p_photos), 0) = 0 then
    raise exception 'empty' using errcode = 'P0001';
  end if;
  -- Photos must be this rental's files.
  foreach photo in array coalesce(p_photos, '{}') loop
    if photo !~ ('^' || r.id::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$') then
      raise exception 'bad_photo' using errcode = 'P0001';
    end if;
  end loop;
  if p_kind = 'pickup' and not exists (select 1 from public.handovers where request_id = r.id and kind = 'dropoff') then
    raise exception 'no_dropoff' using errcode = 'P0001';
  end if;

  select * into h from public.handovers where request_id = r.id and kind = p_kind for update;
  if h.id is not null and (h.confirmed_at is not null or h.created_by <> me) then
    raise exception 'already_recorded' using errcode = 'P0001';
  end if;

  if h.id is null then
    insert into public.handovers (request_id, kind, created_by, items, photos)
    values (r.id, p_kind, me, left(trim(coalesce(p_items, '')), 4000), coalesce(p_photos, '{}'))
    returning * into h;
  else
    update public.handovers
       set items = left(trim(coalesce(p_items, '')), 4000), photos = coalesce(p_photos, '{}'), updated_at = now(),
           matches = null, response_note = ''
     where id = h.id returning * into h;
  end if;

  other := case when me = r.host_id then r.renter_id else r.host_id end;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (r.conversation_id, me, 'event', 'handover_' || p_kind);
  perform private.queue_notification(r.id, 'handover_new', other, p_kind);
  return h.id;
end;
$$;
revoke all on function public.save_handover(uuid, text, text, text[]) from public, anon;
grant execute on function public.save_handover(uuid, text, text, text[]) to authenticated;

-- The other person confirms the list, or says what doesn't match.
create or replace function public.answer_handover(p_handover uuid, p_matches boolean, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  h public.handovers;
  r public.requests;
  me uuid := (select auth.uid());
begin
  select * into h from public.handovers where id = p_handover for update;
  if h.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into r from public.requests where id = h.request_id;
  if me is null or me not in (r.host_id, r.renter_id) or me = h.created_by then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if h.confirmed_at is not null then raise exception 'already_answered' using errcode = 'P0001'; end if;
  if not p_matches and trim(coalesce(p_note, '')) = '' then raise exception 'note_required' using errcode = 'P0001'; end if;

  update public.handovers
     set matches = p_matches,
         response_note = left(trim(coalesce(p_note, '')), 1000),
         confirmed_by = case when p_matches then me end,
         confirmed_at = case when p_matches then now() end
   where id = h.id;

  insert into public.messages (conversation_id, sender_id, kind, body)
  values (r.conversation_id, me, 'event', case when p_matches then 'handover_confirmed' else 'handover_disputed' end);
  if coalesce(trim(p_note), '') <> '' then
    insert into public.messages (conversation_id, sender_id, body, created_at)
    values (r.conversation_id, me, left(trim(p_note), 2000), clock_timestamp());
  end if;
  perform private.queue_notification(r.id, 'handover_answered', h.created_by, case when p_matches then 'ok' else 'mismatch' end);
end;
$$;
revoke all on function public.answer_handover(uuid, boolean, text) from public, anon;
grant execute on function public.answer_handover(uuid, boolean, text) to authenticated;

-- Private photo storage for the two parties.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('handover-photos', 'handover-photos', false, 6291456, array['image/jpeg'])
on conflict (id) do nothing;

create or replace function private.is_request_party(p_request text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.requests r
                  where r.id::text = p_request and (select auth.uid()) in (r.host_id, r.renter_id));
$$;
revoke all on function private.is_request_party(text) from public, anon;
grant execute on function private.is_request_party(text) to authenticated;

drop policy if exists "parties read handover photos" on storage.objects;
create policy "parties read handover photos" on storage.objects for select to authenticated
  using (bucket_id = 'handover-photos' and private.is_request_party((storage.foldername(name))[1]));
drop policy if exists "parties upload handover photos" on storage.objects;
create policy "parties upload handover photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'handover-photos' and private.is_request_party((storage.foldername(name))[1]));
drop policy if exists "uploader deletes handover photos" on storage.objects;
create policy "uploader deletes handover photos" on storage.objects for delete to authenticated
  using (bucket_id = 'handover-photos' and owner_id = (select auth.uid())::text
         and not exists (select 1 from public.handovers h where h.confirmed_at is not null and name = any (h.photos)));
