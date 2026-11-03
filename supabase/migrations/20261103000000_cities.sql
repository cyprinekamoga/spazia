-- Sweden, city by city.
--  * every lead has a town (free text, e.g. "Göteborg"); earlier leads were all Luleå
--  * the Luleå district (area) is only asked for in Luleå, so it becomes optional
--  * city_demand shows where people are waiting, to decide which city opens next

-- Host leads -----------------------------------------------------------------
alter table public.host_leads add column if not exists city text not null default 'Luleå'
  check (char_length(city) between 1 and 80);
alter table public.host_leads alter column city drop default;
alter table public.host_leads alter column area drop not null;

-- Renter leads ---------------------------------------------------------------
alter table public.renter_leads add column if not exists city text not null default 'Luleå'
  check (char_length(city) between 1 and 80);
alter table public.renter_leads alter column city drop default;
alter table public.renter_leads alter column area drop not null;

-- The website (anon key) may insert the new column too.
grant insert (city) on public.host_leads to anon;
grant insert (city) on public.renter_leads to anon;

-- Waiting list per town: hosts and renters, newest registration first.
create or replace view public.city_demand
with (security_invoker = true) as
  select initcap(lower(trim(city))) as city,
         count(*) filter (where kind = 'host') as hosts,
         count(*) filter (where kind = 'renter') as renters,
         count(*) as total,
         max(created_at) as latest
    from (
      select city, created_at, 'host' as kind from public.host_leads
      union all
      select city, created_at, 'renter' from public.renter_leads
    ) leads
   group by 1
   order by total desc, latest desc;

revoke all on public.city_demand from anon, authenticated;
