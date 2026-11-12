-- Approximate position of a listing for the search map. The app looks up the
-- postal code (not the street) when the host saves the address. The position
-- is rounded to two decimals (about a kilometre), so the map shows the area,
-- never the house; the address is shown only after booking, as before.

alter table public.listings
  add column if not exists approx_lat double precision check (approx_lat is null or approx_lat between 55 and 69.5),
  add column if not exists approx_lng double precision check (approx_lng is null or approx_lng between 10.5 and 24.5);

create or replace function private.round_listing_position()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.approx_lat := round(new.approx_lat::numeric, 2)::double precision;
  new.approx_lng := round(new.approx_lng::numeric, 2)::double precision;
  return new;
end;
$$;
revoke all on function private.round_listing_position() from public, anon, authenticated;

drop trigger if exists listings_round_position on public.listings;
create trigger listings_round_position before insert or update of approx_lat, approx_lng on public.listings
  for each row execute function private.round_listing_position();
