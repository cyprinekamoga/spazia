-- Helpers for the SQL tests (supabase/tests/*.test.sql). Applied after the
-- migrations, locally and in CI only.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'not ok: %', p_msg; end if;
end $$;

-- An account (the sign-up trigger creates its profile).
create or replace function tests.new_user(p_email text, p_name text default 'Test') returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (v, p_email, jsonb_build_object('full_name', p_name));
  update public.profiles set first_name = p_name where id = v;
  insert into public.profile_private (id) values (v) on conflict do nothing;
  return v;
end $$;

-- Act as a signed-in user (null: no user) for the rest of the transaction.
create or replace function tests.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    case when p_user is null then '' else jsonb_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
$$;

create or replace function tests.new_listing(p_host uuid, p_city text default 'Uppsala', p_price int default 100,
                                             p_category text default 'boxes', p_status text default 'published')
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.listings (host_id, status, title, description, city, area_name, size_m2, published_at)
  values (p_host, p_status::public.listing_status, 'Förråd i ' || p_city, 'Torrt och låst.', p_city, 'Centrum', 8,
          case when p_status = 'published' then now() end)
  returning id into v;
  insert into public.listing_private (listing_id, street_address, postal_code) values (v, 'Gatan 1', '123 45');
  insert into public.listing_spaces (listing_id, category, capacity, host_price_month) values (v, p_category, 5, p_price);
  return v;
end $$;

-- A monthly request (pending unless told otherwise).
create or replace function tests.new_request(p_listing uuid, p_renter uuid, p_status text default 'pending',
                                             p_start date default current_date + 7, p_end date default null)
returns uuid language plpgsql as $$
declare
  v uuid;
  conv uuid;
  host uuid := (select host_id from public.listings where id = p_listing);
begin
  insert into public.conversations (listing_id, host_id, renter_id) values (p_listing, host, p_renter)
  on conflict do nothing returning id into conv;
  if conv is null then
    select id into conv from public.conversations where listing_id = p_listing and renter_id = p_renter;
  end if;
  insert into public.requests (listing_id, conversation_id, host_id, renter_id, start_date, end_date, status, expires_at)
  values (p_listing, conv, host, p_renter, p_start, p_end, p_status::public.request_status, now() + interval '2 days')
  returning id into v;
  insert into public.request_items (request_id, category, quantity, host_price_month)
  select v, s.category, 1, s.host_price_month from public.listing_spaces s where s.listing_id = p_listing limit 1;
  return v;
end $$;
