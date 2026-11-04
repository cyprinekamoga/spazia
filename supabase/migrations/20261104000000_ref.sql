-- Every registration now carries a random id (ref) created in the browser.
-- It links the lead to its visit booking and to the admin page.
alter table public.host_leads add column if not exists ref uuid unique;
alter table public.renter_leads add column if not exists ref uuid unique;

grant insert (ref) on public.host_leads to anon;
grant insert (ref) on public.renter_leads to anon;
