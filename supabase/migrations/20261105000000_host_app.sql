-- Spazia app, part 1: accounts, listings, photos, calendar, requests and messages.
--
-- Visibility rules (Row Level Security):
--  * Published listings, their spaces, photos and blocked dates are public.
--  * The street address and access instructions are only shown to the host
--    and to renters whose request the host has accepted.
--  * Requests and messages are only visible to the host and the renter.
--  * Requests change status only through the functions at the end
--    (respond_to_request, cancel_request), never by direct updates.

-- Profiles ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null default '' check (char_length(first_name) <= 60),
  about       text not null default '' check (char_length(about) <= 1000),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 500),
  created_at  timestamptz not null default now()
);

create table public.profile_private (
  id          uuid primary key references public.profiles (id) on delete cascade,
  last_name   text not null default '' check (char_length(last_name) <= 80),
  phone       text not null default '' check (char_length(phone) <= 40),
  updated_at  timestamptz not null default now()
);

-- A profile is created for every new account (Google, Apple or email).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(meta ->> 'full_name', meta ->> 'name', '');
begin
  insert into public.profiles (id, first_name, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(meta ->> 'given_name', ''), split_part(full_name, ' ', 1), ''), 60),
    left(nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture', ''), ''), 500)
  );
  insert into public.profile_private (id, last_name)
  values (new.id, left(coalesce(nullif(meta ->> 'family_name', ''), nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), ''), ''), 80));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Listings ---------------------------------------------------------------------
create type public.listing_status as enum ('draft', 'published', 'paused');

create table public.listings (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references public.profiles (id) on delete cascade,
  status        public.listing_status not null default 'draft',
  space_type    text check (space_type in ('garage', 'carport', 'driveway', 'basement', 'outbuilding', 'attic', 'barn', 'other')),
  title         text not null default '' check (char_length(title) <= 80),
  description   text not null default '' check (char_length(description) <= 2000),
  city          text not null default '' check (char_length(city) <= 80),
  area_name     text not null default '' check (char_length(area_name) <= 80),
  size_m2       numeric(6, 1) check (size_m2 is null or (size_m2 > 0 and size_m2 <= 10000)),
  heated        text check (heated in ('yes', 'frostfree', 'no')),
  features      text[] not null default '{}' check (
                  features <@ array['lockable', 'lighting', 'power', 'engine_heater', 'alarm', 'ground_floor', 'drive_up']
                ),
  access        text check (access in ('anytime', 'by_appointment', 'set_times')),
  access_notes  text not null default '' check (char_length(access_notes) <= 500),
  min_period    text not null default 'none' check (min_period in ('none', 'week', 'month')),
  rules         text not null default '' check (char_length(rules) <= 1000),
  wizard_step   int not null default 1 check (wizard_step between 1 and 20),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index listings_host_idx on public.listings (host_id);
create index listings_public_idx on public.listings (status, city);

-- The exact address: only for the host and accepted renters.
create table public.listing_private (
  listing_id           uuid primary key references public.listings (id) on delete cascade,
  street_address       text not null default '' check (char_length(street_address) <= 200),
  postal_code          text not null default '' check (char_length(postal_code) <= 12),
  access_instructions  text not null default '' check (char_length(access_instructions) <= 1000)
);

-- What the space takes: e.g. 10 sets of tyres at 105 kr each per month.
-- host_price_month is the host's own price; the renter pays a service fee on top.
create table public.listing_spaces (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.listings (id) on delete cascade,
  category          text not null check (category in ('tyres', 'skis', 'snowmobile', 'bikes', 'boxes', 'car', 'parking')),
  capacity          int not null check (capacity between 1 and 200),
  host_price_month  int not null check (host_price_month between 10 and 100000),
  unique (listing_id, category)
);

create table public.listing_photos (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings (id) on delete cascade,
  path        text not null check (char_length(path) <= 300),
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index listing_photos_listing_idx on public.listing_photos (listing_id, position);

-- Days the host has closed in the calendar.
create table public.listing_blocks (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings (id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  note        text not null default '' check (char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index listing_blocks_listing_idx on public.listing_blocks (listing_id, start_date);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();

-- Conversations, requests, messages ------------------------------------------
create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references public.listings (id) on delete cascade,
  host_id          uuid not null references public.profiles (id) on delete cascade,
  renter_id        uuid not null references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now(),
  unique (listing_id, renter_id),
  check (host_id <> renter_id)
);
create index conversations_host_idx on public.conversations (host_id, last_message_at desc);
create index conversations_renter_idx on public.conversations (renter_id, last_message_at desc);

create type public.request_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'expired');

-- A renter asks to store something; the host accepts or declines within 24 hours.
-- end_date null means "until further notice".
create table public.requests (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references public.listings (id) on delete cascade,
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  host_id          uuid not null references public.profiles (id) on delete cascade,
  renter_id        uuid not null references public.profiles (id) on delete cascade,
  start_date       date not null,
  end_date         date,
  message          text not null default '' check (char_length(message) <= 1000),
  status           public.request_status not null default 'pending',
  decline_reason   text not null default '' check (char_length(decline_reason) <= 500),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '24 hours',
  responded_at     timestamptz,
  check (end_date is null or end_date >= start_date)
);
create index requests_host_idx on public.requests (host_id, status, start_date);
create index requests_renter_idx on public.requests (renter_id, status);
create index requests_listing_idx on public.requests (listing_id, status);

-- What the request covers, with the price at the time of asking.
create table public.request_items (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.requests (id) on delete cascade,
  category          text not null check (category in ('tyres', 'skis', 'snowmobile', 'bikes', 'boxes', 'car', 'parking')),
  quantity          int not null check (quantity between 1 and 200),
  host_price_month  int not null check (host_price_month between 10 and 100000),
  unique (request_id, category)
);

-- kind 'text' is a normal message; 'event' records things like an accepted request.
create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  kind             text not null default 'text' check (kind in ('text', 'event')),
  body             text not null check (char_length(body) between 1 and 2000),
  created_at       timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.conversation_reads (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  last_read_at     timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create or replace function public.bump_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_bump after insert on public.messages
  for each row execute function public.bump_conversation();

-- Helpers for the access rules (security definer avoids recursive RLS checks) ---
create or replace function public.owns_listing(p_listing uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listings where id = p_listing and host_id = (select auth.uid()));
$$;

create or replace function public.listing_visible(p_listing uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings l
     where l.id = p_listing
       and (l.status = 'published'
            or l.host_id = (select auth.uid())
            or exists (select 1 from public.requests r where r.listing_id = l.id and r.renter_id = (select auth.uid())))
  );
$$;

create or replace function public.in_conversation(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
     where c.id = p_conversation and (select auth.uid()) in (c.host_id, c.renter_id)
  );
$$;

create or replace function public.has_accepted_request(p_listing uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r
     where r.listing_id = p_listing and r.renter_id = (select auth.uid()) and r.status = 'accepted'
  );
$$;

-- Row Level Security ------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.profile_private    enable row level security;
alter table public.listings           enable row level security;
alter table public.listing_private    enable row level security;
alter table public.listing_spaces     enable row level security;
alter table public.listing_photos     enable row level security;
alter table public.listing_blocks     enable row level security;
alter table public.conversations      enable row level security;
alter table public.requests           enable row level security;
alter table public.request_items      enable row level security;
alter table public.messages           enable row level security;
alter table public.conversation_reads enable row level security;

-- Profiles: first name, about and photo are public; you edit your own.
create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "read own private profile" on public.profile_private for select to authenticated
  using (id = (select auth.uid()));
create policy "edit own private profile" on public.profile_private for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Listings
create policy "published or own listings" on public.listings for select to anon, authenticated
  using (status = 'published' or host_id = (select auth.uid())
         or exists (select 1 from public.requests r where r.listing_id = listings.id and r.renter_id = (select auth.uid())));
create policy "create own listing" on public.listings for insert to authenticated
  with check (host_id = (select auth.uid()) and status = 'draft');
create policy "edit own listing" on public.listings for update to authenticated
  using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));
-- Only drafts can be deleted; a published listing is paused instead, so renters keep their history.
create policy "delete own draft" on public.listings for delete to authenticated
  using (host_id = (select auth.uid()) and status = 'draft'
         and not exists (select 1 from public.requests r where r.listing_id = listings.id));

create policy "address for host and accepted renters" on public.listing_private for select to authenticated
  using (public.owns_listing(listing_id) or public.has_accepted_request(listing_id));
create policy "host writes address" on public.listing_private for insert to authenticated
  with check (public.owns_listing(listing_id));
create policy "host edits address" on public.listing_private for update to authenticated
  using (public.owns_listing(listing_id)) with check (public.owns_listing(listing_id));

create policy "spaces of visible listings" on public.listing_spaces for select to anon, authenticated
  using (public.listing_visible(listing_id));
create policy "host manages spaces" on public.listing_spaces for all to authenticated
  using (public.owns_listing(listing_id)) with check (public.owns_listing(listing_id));

create policy "photos of visible listings" on public.listing_photos for select to anon, authenticated
  using (public.listing_visible(listing_id));
create policy "host manages photos" on public.listing_photos for all to authenticated
  using (public.owns_listing(listing_id)) with check (public.owns_listing(listing_id));

create policy "blocks of visible listings" on public.listing_blocks for select to anon, authenticated
  using (public.listing_visible(listing_id));
create policy "host manages blocks" on public.listing_blocks for all to authenticated
  using (public.owns_listing(listing_id)) with check (public.owns_listing(listing_id));

-- Conversations and messages: only the two people in them.
create policy "own conversations" on public.conversations for select to authenticated
  using ((select auth.uid()) in (host_id, renter_id));
create policy "renter starts conversation" on public.conversations for insert to authenticated
  with check (
    renter_id = (select auth.uid())
    and exists (select 1 from public.listings l where l.id = listing_id and l.host_id = conversations.host_id and l.status = 'published')
  );

create policy "own messages" on public.messages for select to authenticated
  using (public.in_conversation(conversation_id));
create policy "send message" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and kind = 'text' and public.in_conversation(conversation_id));

create policy "own read markers" on public.conversation_reads for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.in_conversation(conversation_id));

-- Requests: readable by both sides; created and changed only through functions.
create policy "own requests" on public.requests for select to authenticated
  using ((select auth.uid()) in (host_id, renter_id));
create policy "own request items" on public.request_items for select to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and (select auth.uid()) in (r.host_id, r.renter_id)));

-- Functions -------------------------------------------------------------------

-- Units of one category already promised on a listing in a date range.
create or replace function public.booked_units(p_listing uuid, p_category text, p_start date, p_end date, p_except uuid default null)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(i.quantity), 0)::int
    from public.requests r
    join public.request_items i on i.request_id = r.id
   where r.listing_id = p_listing
     and i.category = p_category
     and r.status = 'accepted'
     and r.id is distinct from p_except
     and r.start_date <= coalesce(p_end, 'infinity'::date)
     and coalesce(r.end_date, 'infinity'::date) >= p_start;
$$;

-- The host accepts or declines a pending request (within 24 hours).
create or replace function public.respond_to_request(p_request uuid, p_accept boolean, p_reason text default '')
returns public.request_status
language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  item record;
  free int;
begin
  select * into r from public.requests where id = p_request for update;
  if r.id is null or r.host_id <> (select auth.uid()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  if r.expires_at < now() then
    -- Too late to answer: record it as expired (no exception, so the update is kept).
    update public.requests set status = 'expired' where id = r.id;
    return 'expired';
  end if;

  if p_accept then
    for item in select i.category, i.quantity, s.capacity
                  from public.request_items i
                  left join public.listing_spaces s on s.listing_id = r.listing_id and s.category = i.category
                 where i.request_id = r.id loop
      free := coalesce(item.capacity, 0) - public.booked_units(r.listing_id, item.category, r.start_date, r.end_date, r.id);
      if item.quantity > free then
        raise exception 'no_capacity' using errcode = 'P0001';
      end if;
    end loop;
    update public.requests set status = 'accepted', responded_at = now() where id = r.id;
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (r.conversation_id, r.host_id, 'event', 'request_accepted');
    return 'accepted';
  else
    update public.requests
       set status = 'declined', responded_at = now(), decline_reason = left(coalesce(p_reason, ''), 500)
     where id = r.id;
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (r.conversation_id, r.host_id, 'event', 'request_declined');
    return 'declined';
  end if;
end;
$$;

-- Either side can cancel a pending or accepted request.
create or replace function public.cancel_request(p_request uuid)
returns public.request_status
language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
begin
  select * into r from public.requests where id = p_request for update;
  if r.id is null or (select auth.uid()) not in (r.host_id, r.renter_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status not in ('pending', 'accepted') then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  update public.requests set status = 'cancelled', responded_at = coalesce(responded_at, now()) where id = r.id;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (r.conversation_id, (select auth.uid()), 'event', 'request_cancelled');
  return 'cancelled';
end;
$$;

-- A renter asks to store items (used by the renter side).
create or replace function public.create_request(
  p_listing uuid, p_start date, p_end date, p_items jsonb, p_message text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  conv uuid;
  req uuid;
  item jsonb;
  space public.listing_spaces;
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'login_required' using errcode = '42501'; end if;
  select * into l from public.listings where id = p_listing and status = 'published';
  if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if l.host_id = me then raise exception 'own_listing' using errcode = 'P0001'; end if;
  if p_start < current_date or (p_end is not null and p_end < p_start) then
    raise exception 'bad_dates' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no_items' using errcode = 'P0001';
  end if;

  insert into public.conversations (listing_id, host_id, renter_id)
  values (l.id, l.host_id, me)
  on conflict (listing_id, renter_id) do update set last_message_at = now()
  returning id into conv;

  insert into public.requests (listing_id, conversation_id, host_id, renter_id, start_date, end_date, message)
  values (l.id, conv, l.host_id, me, p_start, p_end, left(coalesce(p_message, ''), 1000))
  returning id into req;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into space from public.listing_spaces where listing_id = l.id and category = item ->> 'category';
    if space.id is null then raise exception 'bad_category' using errcode = 'P0001'; end if;
    insert into public.request_items (request_id, category, quantity, host_price_month)
    values (req, space.category, greatest(1, (item ->> 'quantity')::int), space.host_price_month);
  end loop;

  if coalesce(p_message, '') <> '' then
    insert into public.messages (conversation_id, sender_id, body) values (conv, me, left(p_message, 2000));
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body) values (conv, me, 'event', 'request_sent');
  return req;
end;
$$;

-- Publish a listing once it has what renters need to decide.
create or replace function public.publish_listing(p_listing uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  missing text[] := '{}';
begin
  select * into l from public.listings where id = p_listing and host_id = (select auth.uid());
  if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if l.space_type is null then missing := missing || 'space_type'; end if;
  if l.city = '' then missing := missing || 'city'; end if;
  if char_length(l.title) < 5 then missing := missing || 'title'; end if;
  if not exists (select 1 from public.listing_spaces where listing_id = l.id) then missing := missing || 'spaces'; end if;
  if not exists (select 1 from public.listing_photos where listing_id = l.id) then missing := missing || 'photos'; end if;
  if not exists (select 1 from public.listing_private where listing_id = l.id and street_address <> '') then missing := missing || 'address'; end if;
  if l.access is null then missing := missing || 'access'; end if;
  if array_length(missing, 1) > 0 then
    raise exception 'incomplete: %', array_to_string(missing, ',') using errcode = 'P0001';
  end if;
  update public.listings set status = 'published', published_at = coalesce(published_at, now()) where id = l.id;
  return 'published';
end;
$$;

revoke all on function public.respond_to_request(uuid, boolean, text) from public, anon;
revoke all on function public.cancel_request(uuid) from public, anon;
revoke all on function public.create_request(uuid, date, date, jsonb, text) from public, anon;
revoke all on function public.publish_listing(uuid) from public, anon;
revoke all on function public.booked_units(uuid, text, date, date, uuid) from public, anon;
grant execute on function public.respond_to_request(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_request(uuid) to authenticated;
grant execute on function public.create_request(uuid, date, date, jsonb, text) to authenticated;
grant execute on function public.publish_listing(uuid) to authenticated;
grant execute on function public.booked_units(uuid, text, date, date, uuid) to authenticated;

-- Photo storage -----------------------------------------------------------------
-- Public bucket: listing photos are meant to be seen. Files live under
-- <user id>/<listing id>/<file>, and only that user can add, change or delete them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "read own photo files" on storage.objects for select to authenticated
  using (bucket_id in ('listing-photos', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-photos', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "update own photos" on storage.objects for update to authenticated
  using (bucket_id in ('listing-photos', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-photos', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
