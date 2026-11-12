-- Discount codes, invites and company details for invoices.
--
-- Discount codes take a share off Spazia's service fee in the first month of
-- a monthly rental. The host's rent is never touched: the fee line on the
-- invoice is what is left after the rent (and Spazia Skydd), so a lower
-- amount means a lower fee line.
--
-- Invites: every user has a personal code. A new customer who uses it gets
-- the referral discount on their first month (50 % of the fee to start
-- with); once that month is paid, the inviter gets a personal code for a
-- first month without service fee on their next rental.
--
-- Company details: a renter can have invoices made out to a company.

create table if not exists private.discount_codes (
  code         text primary key check (code ~ '^[A-Z0-9-]{3,24}$'),
  percent_off  int not null check (percent_off between 1 and 100),
  kind         text not null default 'campaign' check (kind in ('campaign', 'referral_reward')),
  owner_id     uuid references public.profiles (id) on delete cascade,
  max_uses     int check (max_uses is null or max_uses > 0),
  uses         int not null default 0,
  valid_until  timestamptz,
  active       boolean not null default true,
  note         text not null default '',
  created_at   timestamptz not null default now()
);

alter table public.profiles add column if not exists referral_code text unique
  check (referral_code is null or referral_code ~ '^[A-Z0-9]{6,12}$');

alter table public.requests
  add column if not exists discount_code text,
  add column if not exists discount_percent int check (discount_percent is null or discount_percent between 1 and 100),
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;

alter table public.profile_private
  add column if not exists company_name text not null default '' check (char_length(company_name) <= 120),
  add column if not exists company_org_number text not null default '' check (company_org_number = '' or company_org_number ~ '^[0-9]{6}-?[0-9]{4}$'),
  add column if not exists company_vat_number text not null default '' check (company_vat_number = '' or company_vat_number ~ '^SE[0-9]{12}$');

insert into private.settings (key, value) values ('referral_percent', '50'), ('referral_reward_percent', '100')
on conflict (key) do nothing;

-- The signed-in user's invite code, made on first use.
create or replace function public.my_referral_code()
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  c text;
begin
  if me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select referral_code into c from public.profiles where id = me;
  while c is null loop
    c := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1IL', ''), 1, 7));
    if char_length(c) < 6 or exists (select 1 from public.profiles where referral_code = c)
       or exists (select 1 from private.discount_codes where code = c) then
      c := null;
    else
      update public.profiles set referral_code = c where id = me;
    end if;
  end loop;
  return c;
end;
$$;
revoke all on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated;

-- What a code gives this user, without using it: { percent, kind } or an error.
create or replace function private.discount_for(p_user uuid, p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  d private.discount_codes;
  inviter uuid;
begin
  if v_code = '' then return jsonb_build_object('error', 'invalid_code'); end if;
  select * into d from private.discount_codes where discount_codes.code = v_code;
  if d.code is not null then
    if not d.active or (d.valid_until is not null and d.valid_until < now())
       or (d.max_uses is not null and d.uses >= d.max_uses)
       or (d.owner_id is not null and d.owner_id <> p_user) then
      return jsonb_build_object('error', 'invalid_code');
    end if;
    return jsonb_build_object('percent', d.percent_off, 'kind', d.kind, 'code', d.code);
  end if;
  select id into inviter from public.profiles where referral_code = v_code;
  if inviter is null or inviter = p_user then return jsonb_build_object('error', 'invalid_code'); end if;
  -- Invites are for new customers: no rental accepted before.
  if exists (select 1 from public.requests where renter_id = p_user and status = 'accepted') then
    return jsonb_build_object('error', 'not_new_customer');
  end if;
  return jsonb_build_object('percent', private.setting('referral_percent')::int, 'kind', 'referral', 'code', v_code, 'inviter', inviter);
end;
$$;

create or replace function public.check_discount_code(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.discount_for((select auth.uid()), p_code) - 'inviter';
$$;
revoke all on function public.check_discount_code(text) from public, anon;
grant execute on function public.check_discount_code(text) to authenticated;

-- The renter adds a code to a request while it waits for the host.
create or replace function public.apply_discount_code(p_request uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  r public.requests;
  d jsonb;
begin
  select * into r from public.requests
   where id = p_request and renter_id = me and status = 'pending' and kind = 'month' for update;
  if r.id is null then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if r.discount_code is not null then raise exception 'already_applied' using errcode = 'P0001'; end if;
  d := private.discount_for(me, p_code);
  if d ? 'error' then raise exception '%', d->>'error' using errcode = 'P0001'; end if;
  update public.requests
     set discount_code = d->>'code', discount_percent = (d->>'percent')::int,
         referred_by = case when d->>'kind' = 'referral' then (d->>'inviter')::uuid end
   where id = r.id;
  update private.discount_codes set uses = uses + 1 where code = d->>'code';
  return d - 'inviter';
end;
$$;
revoke all on function public.apply_discount_code(uuid, text) from public, anon;
grant execute on function public.apply_discount_code(uuid, text) to authenticated;

-- My personal codes (invite rewards) that can still be used.
create or replace function public.my_discount_codes()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'percent', percent_off, 'valid_until', valid_until) order by created_at desc), '[]'::jsonb)
    from private.discount_codes
   where owner_id = (select auth.uid()) and active and (max_uses is null or uses < max_uses)
     and (valid_until is null or valid_until > now());
$$;
revoke all on function public.my_discount_codes() from public, anon;
grant execute on function public.my_discount_codes() to authenticated;

-- First month with a discount: the fee part shrinks by the percentage.
-- (Only period 0; month two onwards is billed at the normal price.)
drop function if exists private.period_amounts(uuid, int);
create function private.period_amounts(
  p_request uuid, p_index int,
  out ps date, out pe date, out natural_end date,
  out full_amount int, out full_host int, out full_base int, out full_protection int,
  out amount int, out host_amount int, out base int, out protection int, out discount int)
returns record language plpgsql stable security definer set search_path = '' as $$
declare
  r public.requests;
  share numeric;
  priced int;
  fee int;
begin
  select * into r from public.requests where id = p_request;
  ps := (r.start_date + make_interval(months => p_index))::date;
  natural_end := (r.start_date + make_interval(months => p_index + 1))::date - 1;
  if r.end_date is not null and ps > r.end_date then
    ps := null;
    return;
  end if;
  pe := least(natural_end, coalesce(r.end_date, natural_end));
  select coalesce(sum(private.renter_price(i.host_price_month) * i.quantity), 0),
         coalesce(sum(private.host_payout(i.host_price_month) * i.quantity), 0),
         coalesce(sum(i.host_price_month * i.quantity), 0)
    into priced, full_host, full_base
    from public.request_items i
   where i.request_id = r.id and i.host_price_month is not null;
  full_protection := case when r.protection_rate is null then 0 else round(priced * r.protection_rate)::int end;
  full_amount := priced + full_protection;
  if pe < natural_end then
    share := (pe - ps + 1)::numeric / (natural_end - ps + 1);
    protection := round(full_protection * share)::int;
    amount := round(priced * share)::int + protection;
    host_amount := least(amount, round(full_host * share)::int);
    base := least(amount, round(full_base * share)::int);
  else
    protection := full_protection;
    amount := full_amount;
    host_amount := full_host;
    base := full_base;
  end if;
  discount := 0;
  if p_index = 0 and r.discount_percent is not null then
    fee := greatest(0, amount - base - protection);
    discount := round(fee * r.discount_percent / 100.0)::int;
    amount := amount - discount;
  end if;
end;
$$;
revoke all on function private.period_amounts(uuid, int) from public, anon, authenticated;

-- An invited customer's first month is paid: thank the inviter with a code.
create or replace function private.referral_reward()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
  c text;
begin
  if new.status <> 'paid' or old.status = 'paid' or new.period_index <> 0 then return new; end if;
  select * into r from public.requests where id = new.request_id;
  if r.referred_by is null then return new; end if;
  -- One reward per invited customer.
  if exists (select 1 from private.discount_codes where note = 'referral:' || r.renter_id::text) then return new; end if;
  loop
    c := 'TACK-' || upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=0O1IL', ''), 1, 5));
    exit when char_length(c) = 10 and not exists (select 1 from private.discount_codes where code = c);
  end loop;
  insert into private.discount_codes (code, percent_off, kind, owner_id, max_uses, valid_until, note)
  values (c, private.setting('referral_reward_percent')::int, 'referral_reward', r.referred_by, 1, now() + interval '1 year',
          'referral:' || r.renter_id::text);
  return new;
end;
$$;
drop trigger if exists payments_referral_reward on public.payments;
create trigger payments_referral_reward after update of status on public.payments
  for each row execute function private.referral_reward();

-- Admins create campaign codes from the admin page.
create or replace function public.admin_create_discount_code(p_code text, p_percent int, p_max_uses int default null,
                                                             p_valid_until timestamptz default null, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  insert into private.discount_codes (code, percent_off, max_uses, valid_until, note)
  values (upper(btrim(p_code)), p_percent, p_max_uses, p_valid_until, left(coalesce(p_note, ''), 200));
  perform private.log_admin('discount_code', upper(btrim(p_code)), p_note);
end;
$$;
create or replace function public.admin_discount_codes()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from private.discount_codes d where d.kind = 'campaign'), '[]'::jsonb);
end;
$$;
create or replace function public.admin_set_discount_code_active(p_code text, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update private.discount_codes set active = p_active where code = upper(btrim(p_code));
  perform private.log_admin(case when p_active then 'discount_code_on' else 'discount_code_off' end, upper(btrim(p_code)), '');
end;
$$;
revoke all on function public.admin_create_discount_code(text, int, int, timestamptz, text) from public, anon;
revoke all on function public.admin_discount_codes() from public, anon;
revoke all on function public.admin_set_discount_code_active(text, boolean) from public, anon;
grant execute on function public.admin_create_discount_code(text, int, int, timestamptz, text) to authenticated;
grant execute on function public.admin_discount_codes() to authenticated;
grant execute on function public.admin_set_discount_code_active(text, boolean) to authenticated;

-- The app's payment settings also say what an invite gives.
create or replace function public.payments_config()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('enabled', private.payments_on(),
                            'protection', case when private.payments_on() then private.protection_offer() end,
                            'referral_percent', private.setting('referral_percent')::int);
$$;
grant execute on function public.payments_config() to anon, authenticated;
