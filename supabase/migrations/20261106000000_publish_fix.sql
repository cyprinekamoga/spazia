-- publish_listing: build the list of missing parts with array_append
-- ("missing || 'photos'" was read as an array literal and failed).
create or replace function public.publish_listing(p_listing uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  missing text[] := '{}';
begin
  select * into l from public.listings where id = p_listing and host_id = (select auth.uid());
  if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if l.space_type is null then missing := array_append(missing, 'space_type'); end if;
  if l.city = '' then missing := array_append(missing, 'city'); end if;
  if char_length(l.title) < 5 then missing := array_append(missing, 'title'); end if;
  if not exists (select 1 from public.listing_spaces where listing_id = l.id) then missing := array_append(missing, 'spaces'); end if;
  if not exists (select 1 from public.listing_photos where listing_id = l.id) then missing := array_append(missing, 'photos'); end if;
  if not exists (select 1 from public.listing_private where listing_id = l.id and street_address <> '') then missing := array_append(missing, 'address'); end if;
  if l.access is null then missing := array_append(missing, 'access'); end if;
  if cardinality(missing) > 0 then
    raise exception 'incomplete: %', array_to_string(missing, ',') using errcode = 'P0001';
  end if;
  update public.listings set status = 'published', published_at = coalesce(published_at, now()) where id = l.id;
  return 'published';
end;
$$;
