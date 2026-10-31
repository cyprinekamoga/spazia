-- Spazia – interest registrations from the Phase 0 landing site.
--
-- The website inserts rows with the public (publishable/anon) key. Row Level
-- Security allows anonymous INSERT only: nobody can read, update or delete
-- leads with the public key. Read them in the Supabase dashboard (or with the
-- service role key from a trusted environment).

create table if not exists public.host_leads (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  first_name   text not null check (char_length(first_name) between 1 and 200),
  email        text not null check (char_length(email) between 3 and 200 and email like '%@%'),
  phone        text check (char_length(phone) <= 200),
  area         text not null check (char_length(area) <= 50),
  space_type   text not null check (space_type in ('garage', 'basement', 'outbuilding', 'attic', 'barn', 'other')),
  heated       text not null check (heated in ('yes', 'frostfree', 'no')),
  size         text not null check (size in ('xs', 's', 'm', 'l')),
  accepts      text[] not null default '{}' check (
                 cardinality(accepts) between 1 and 6
                 and accepts <@ array['tyres', 'skis', 'snowmobile', 'bikes', 'boxes', 'car']
               ),
  message      text check (char_length(message) <= 1000),
  consent      boolean not null check (consent),
  lang         text check (lang in ('sv', 'en')),
  utm_source   text check (char_length(utm_source) <= 200),
  utm_medium   text check (char_length(utm_medium) <= 200),
  utm_campaign text check (char_length(utm_campaign) <= 200),
  utm_content  text check (char_length(utm_content) <= 200),
  utm_term     text check (char_length(utm_term) <= 200),
  referrer     text check (char_length(referrer) <= 1000),
  landing_page text check (char_length(landing_page) <= 500),
  -- Internal follow-up (edited in the dashboard, never by the website)
  status       text not null default 'new' check (status in ('new', 'contacted', 'visit_booked', 'inspected', 'listed', 'rejected')),
  notes        text
);

create table if not exists public.renter_leads (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  first_name   text not null check (char_length(first_name) between 1 and 200),
  email        text not null check (char_length(email) between 3 and 200 and email like '%@%'),
  phone        text check (char_length(phone) <= 200),
  items        text[] not null default '{}' check (
                 cardinality(items) between 1 and 6
                 and items <@ array['tyres', 'skis', 'snowmobile', 'bikes', 'boxes', 'car']
               ),
  quantity     text check (char_length(quantity) <= 200),
  area         text not null check (char_length(area) <= 50),
  start        text not null check (start in ('asap', 'month', 'spring', 'summer', 'unsure')),
  duration     text not null check (duration in ('short', 'season', 'long', 'unsure')),
  heated       text check (heated in ('yes', 'no', 'any')),
  occupation   text check (occupation in ('student', 'working', 'other')),
  has_bankid   text check (has_bankid in ('yes', 'no')),
  message      text check (char_length(message) <= 1000),
  consent      boolean not null check (consent),
  lang         text check (lang in ('sv', 'en')),
  utm_source   text check (char_length(utm_source) <= 200),
  utm_medium   text check (char_length(utm_medium) <= 200),
  utm_campaign text check (char_length(utm_campaign) <= 200),
  utm_content  text check (char_length(utm_content) <= 200),
  utm_term     text check (char_length(utm_term) <= 200),
  referrer     text check (char_length(referrer) <= 1000),
  landing_page text check (char_length(landing_page) <= 500),
  status       text not null default 'new' check (status in ('new', 'contacted', 'matched', 'rejected')),
  notes        text
);

create index if not exists host_leads_created_at_idx on public.host_leads (created_at desc);
create index if not exists renter_leads_created_at_idx on public.renter_leads (created_at desc);

alter table public.host_leads enable row level security;
alter table public.renter_leads enable row level security;

-- The public key may only insert, and never set the internal columns.
revoke all on public.host_leads from anon, authenticated;
revoke all on public.renter_leads from anon, authenticated;

grant insert (
  first_name, email, phone, area, space_type, heated, size, accepts, message, consent, lang,
  utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_page
) on public.host_leads to anon;

grant insert (
  first_name, email, phone, items, quantity, area, start, duration, heated, occupation, has_bankid,
  message, consent, lang, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_page
) on public.renter_leads to anon;

drop policy if exists "Website can register host interest" on public.host_leads;
create policy "Website can register host interest"
  on public.host_leads for insert to anon
  with check (consent);

drop policy if exists "Website can register renter interest" on public.renter_leads;
create policy "Website can register renter interest"
  on public.renter_leads for insert to anon
  with check (consent);

-- Handy overview for the validation phase: leads per day, source and type.
create or replace view public.lead_summary
with (security_invoker = true) as
  select date_trunc('day', created_at)::date as day, 'host' as kind,
         coalesce(utm_source, '(direct)') as source, coalesce(utm_campaign, '') as campaign,
         count(*) as leads
    from public.host_leads group by 1, 2, 3, 4
  union all
  select date_trunc('day', created_at)::date, 'renter',
         coalesce(utm_source, '(direct)'), coalesce(utm_campaign, ''), count(*)
    from public.renter_leads group by 1, 2, 3, 4;

revoke all on public.lead_summary from anon, authenticated;
