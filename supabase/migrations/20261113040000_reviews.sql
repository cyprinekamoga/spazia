-- Reviews after a rental. The renter reviews the host and the space, the host
-- reviews the renter: 1–5 stars and an optional text. A review is published
-- when both have written theirs, or 14 days after the first one, so nobody
-- answers in kind. You can review a monthly rental a week after it started
-- (or when it has ended), an hourly booking once it is over, and up to 60
-- days after that.

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.requests (id) on delete cascade,
  listing_id    uuid not null references public.listings (id) on delete cascade,
  author_id     uuid not null references public.profiles (id) on delete cascade,
  subject_id    uuid not null references public.profiles (id) on delete cascade,
  author_role   text not null check (author_role in ('renter', 'host')),
  rating        int not null check (rating between 1 and 5),
  body          text not null default '' check (char_length(body) <= 1000),
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  unique (request_id, author_id)
);
create index if not exists reviews_listing_idx on public.reviews (listing_id, published_at desc) where author_role = 'renter';
create index if not exists reviews_subject_idx on public.reviews (subject_id, published_at desc);
alter table public.reviews enable row level security;
-- Read directly: your own reviews, and published reviews about you. Everyone
-- else sees reviews only through the functions below (first names, no ids).
drop policy if exists "published or own reviews" on public.reviews;
drop policy if exists "own reviews" on public.reviews;
create policy "own reviews" on public.reviews for select to authenticated
  using (author_id = (select auth.uid()) or (subject_id = (select auth.uid()) and published_at is not null));
revoke all on public.reviews from anon;
revoke insert, update, delete on public.reviews from authenticated;
grant select on public.reviews to authenticated;

-- From when (and until when) a rental can be reviewed.
create or replace function private.review_window(r public.requests)
returns tstzrange language sql stable set search_path = '' as $$
  select case
    when r.status <> 'accepted' then null
    when r.kind = 'hour' then tstzrange(r.end_at, r.end_at + interval '60 days')
    else tstzrange(
      least((r.start_date + 7)::timestamp at time zone 'Europe/Stockholm',
            coalesce(r.end_date + 1, r.start_date + 7)::timestamp at time zone 'Europe/Stockholm'),
      (coalesce(r.end_date, 'infinity'::date) + 60)::timestamp at time zone 'Europe/Stockholm')
  end;
$$;
revoke all on function private.review_window(public.requests) from public, anon, authenticated;

create or replace function public.submit_review(p_request uuid, p_rating int, p_body text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  me uuid := (select auth.uid());
  w tstzrange;
  rid uuid;
  other uuid;
begin
  select * into r from public.requests where id = p_request;
  if r.id is null or me is null or me not in (r.host_id, r.renter_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'bad_rating' using errcode = 'P0001'; end if;
  w := private.review_window(r);
  if w is null or not (now() <@ w) then raise exception 'not_yet' using errcode = 'P0001'; end if;
  if exists (select 1 from public.reviews where request_id = r.id and author_id = me) then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;
  other := case when me = r.host_id then r.renter_id else r.host_id end;

  insert into public.reviews (request_id, listing_id, author_id, subject_id, author_role, rating, body)
  values (r.id, r.listing_id, me, other, case when me = r.host_id then 'host' else 'renter' end,
          p_rating, left(trim(coalesce(p_body, '')), 1000))
  returning id into rid;

  -- Both have reviewed: publish both.
  if exists (select 1 from public.reviews where request_id = r.id and author_id = other) then
    update public.reviews set published_at = now() where request_id = r.id and published_at is null;
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body) values (r.conversation_id, me, 'event', 'review_left');
  return rid;
end;
$$;
revoke all on function public.submit_review(uuid, int, text) from public, anon;
grant execute on function public.submit_review(uuid, int, text) to authenticated;

-- What the app needs for one rental: may I review, have I, has the other.
create or replace function public.review_state(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r public.requests;
  me uuid := (select auth.uid());
  w tstzrange;
  mine public.reviews;
  theirs public.reviews;
begin
  select * into r from public.requests where id = p_request;
  if r.id is null or me is null or me not in (r.host_id, r.renter_id) then return null; end if;
  w := private.review_window(r);
  select * into mine from public.reviews where request_id = r.id and author_id = me;
  select * into theirs from public.reviews where request_id = r.id and author_id <> me;
  return jsonb_build_object(
    'opens_at', lower(w),
    'closes_at', upper(w),
    'can_review', w is not null and now() <@ w and mine.id is null,
    'mine', case when mine.id is null then null else jsonb_build_object('rating', mine.rating, 'body', mine.body, 'created_at', mine.created_at, 'published_at', mine.published_at) end,
    'theirs_written', theirs.id is not null,
    'theirs', case when theirs.id is null or theirs.published_at is null then null else jsonb_build_object('rating', theirs.rating, 'body', theirs.body, 'published_at', theirs.published_at) end
  );
end;
$$;
revoke all on function public.review_state(uuid) from public, anon;
grant execute on function public.review_state(uuid) to authenticated;

-- Published reviews of a listing (by renters), with the average.
create or replace function public.listing_reviews(p_listing uuid, p_limit int default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'count', (select count(*) from public.reviews where listing_id = p_listing and author_role = 'renter' and published_at is not null),
    'average', (select round(avg(rating)::numeric, 1) from public.reviews where listing_id = p_listing and author_role = 'renter' and published_at is not null),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('rating', v.rating, 'body', v.body, 'published_at', v.published_at, 'author', v.first_name) order by v.published_at desc)
        from (select rv.rating, rv.body, rv.published_at, p.first_name
                from public.reviews rv left join public.profiles p on p.id = rv.author_id
               where rv.listing_id = p_listing and rv.author_role = 'renter' and rv.published_at is not null
               order by rv.published_at desc limit least(greatest(p_limit, 1), 100)) v), '[]'::jsonb)
  );
$$;
revoke all on function public.listing_reviews(uuid, int) from public;
grant execute on function public.listing_reviews(uuid, int) to anon, authenticated;

-- A renter's rating from hosts, for a host who has a request from that renter.
create or replace function public.renter_rating(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not exists (select 1 from public.requests q where q.host_id = (select auth.uid()) and q.renter_id = p_user) then null else
  jsonb_build_object(
    'count', count(*),
    'average', round(avg(rating)::numeric, 1),
    'latest', (select jsonb_agg(jsonb_build_object('rating', x.rating, 'body', x.body, 'published_at', x.published_at) order by x.published_at desc)
                 from (select rating, body, published_at from public.reviews
                        where subject_id = p_user and author_role = 'host' and published_at is not null
                        order by published_at desc limit 3) x)) end
  from public.reviews where subject_id = p_user and author_role = 'host' and published_at is not null;
$$;
revoke all on function public.renter_rating(uuid) from public, anon;
grant execute on function public.renter_rating(uuid) to authenticated;

-- Ratings for search results.
create or replace function public.listing_ratings(p_listings uuid[])
returns table (listing_id uuid, average numeric, count bigint) language sql stable security definer set search_path = '' as $$
  select listing_id, round(avg(rating)::numeric, 1), count(*)
    from public.reviews
   where listing_id = any (p_listings) and author_role = 'renter' and published_at is not null
   group by listing_id;
$$;
revoke all on function public.listing_ratings(uuid[]) from public;
grant execute on function public.listing_ratings(uuid[]) to anon, authenticated;

-- Emails: invite both to review when a rental can be reviewed, and publish
-- one-sided reviews after 14 days.
alter table private.notifications drop constraint if exists notifications_kind_check;
alter table private.notifications add constraint notifications_kind_check check (kind in (
  'request_new', 'parking_booked', 'request_accepted', 'request_declined',
  'cancelled_by_renter', 'cancelled_by_host',
  'payment_failed', 'payment_lapsed', 'rental_ending', 'new_message',
  'handover_new', 'handover_answered', 'review_invite'));

alter table public.requests add column if not exists review_invited_at timestamptz;

create or replace function private.reviews_daily()
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
begin
  update public.reviews v set published_at = now()
   where v.published_at is null and v.created_at < now() - interval '14 days';

  for r in select * from public.requests q
            where q.status = 'accepted' and q.review_invited_at is null
              and lower(private.review_window(q)) <= now()
              and lower(private.review_window(q)) > now() - interval '7 days'
            limit 200 loop
    update public.requests set review_invited_at = now() where id = r.id;
    if not exists (select 1 from public.reviews where request_id = r.id and author_id = r.renter_id) then
      perform private.queue_notification(r.id, 'review_invite', r.renter_id);
    end if;
    if not exists (select 1 from public.reviews where request_id = r.id and author_id = r.host_id) then
      perform private.queue_notification(r.id, 'review_invite', r.host_id);
    end if;
  end loop;
end;
$$;
revoke all on function private.reviews_daily() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'spazia-reviews';
select cron.schedule('spazia-reviews', '23 8 * * *', 'select private.reviews_daily()');
