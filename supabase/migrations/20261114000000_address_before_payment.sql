-- The exact address can be shown as soon as the host accepts a request.
-- How to get in, and the other person's phone number and last name, still
-- wait for the first payment when the booking is paid through Spazia
-- (listing_private and profile_private keep their rules for that).
--
-- listing_private holds both the address and the access instructions, so the
-- address alone is handed out here: to the host, and to a renter with an
-- accepted request for the listing, paid or not.

create or replace function public.listing_address(p_listing uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('street_address', lp.street_address, 'postal_code', lp.postal_code)
    from public.listing_private lp
   where lp.listing_id = p_listing
     and (private.owns_listing(p_listing)
          or exists (select 1 from public.requests r
                      where r.listing_id = p_listing and r.renter_id = (select auth.uid()) and r.status = 'accepted'));
$$;
revoke all on function public.listing_address(uuid) from public, anon;
grant execute on function public.listing_address(uuid) to authenticated;
