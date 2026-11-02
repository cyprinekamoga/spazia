-- Parking as a new category.
--  * hosts can offer a driveway/yard or carport space
--  * "heated" no longer applies to outdoor spaces, so it becomes optional
--  * both forms can say whether an engine heater socket is available/needed

-- Host leads -----------------------------------------------------------------
alter table public.host_leads drop constraint if exists host_leads_space_type_check;
alter table public.host_leads add constraint host_leads_space_type_check
  check (space_type in ('garage', 'carport', 'driveway', 'basement', 'outbuilding', 'attic', 'barn', 'other'));

alter table public.host_leads alter column heated drop not null;

alter table public.host_leads drop constraint if exists host_leads_accepts_check;
alter table public.host_leads add constraint host_leads_accepts_check check (
  cardinality(accepts) between 1 and 7
  and accepts <@ array['tyres', 'skis', 'snowmobile', 'bikes', 'boxes', 'car', 'parking']
);

alter table public.host_leads add column if not exists engine_heater text
  check (engine_heater in ('yes', 'no'));

-- Renter leads ---------------------------------------------------------------
alter table public.renter_leads drop constraint if exists renter_leads_items_check;
alter table public.renter_leads add constraint renter_leads_items_check check (
  cardinality(items) between 1 and 7
  and items <@ array['tyres', 'skis', 'snowmobile', 'bikes', 'boxes', 'car', 'parking']
);

alter table public.renter_leads add column if not exists engine_heater text
  check (engine_heater in ('yes', 'no', 'any'));

-- The website (anon key) may insert the new column too.
grant insert (engine_heater) on public.host_leads to anon;
grant insert (engine_heater) on public.renter_leads to anon;
