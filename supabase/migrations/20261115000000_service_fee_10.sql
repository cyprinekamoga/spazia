-- Spazia's service fee for renters goes from 15 % to 10 % (the host fee stays
-- 5 %). The renter's price is the host's price plus the fee, worked out here
-- for every payment, search result and email, with the same rounding as the
-- app (src/lib/app/model.ts, FEES in src/content/pricing.ts): whole kronor,
-- halves up. Payments already created keep their amounts.
create or replace function private.renter_price(p int)
returns int language sql immutable set search_path = '' as $$ select round(p * 110 / 100.0)::int $$;
revoke all on function private.renter_price(int) from public, anon, authenticated;
