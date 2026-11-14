-- Bookkeeping (bokföring) for Spazia, in the team's admin page.
--
-- Built for a sole trader (enskild firma) with calendar financial years, the
-- cash method (kontantmetoden) and VAT reported per quarter (a setting).
--
-- Rules from the Swedish Bookkeeping Act (bokföringslagen) this follows:
--  * Every business event is a voucher (verifikation) with a number in an
--    unbroken series per year, a date, a text, the amounts on BAS accounts and,
--    for manual vouchers, the underlying document (photo or PDF) attached.
--  * Vouchers are permanent: they can't be changed or deleted, only corrected
--    by a new voucher that refers to the old one (rättelse).
--  * Who booked what and when is kept (created_by, created_at).
--  * Once a VAT period has been settled, or a year closed, nothing more can be
--    dated in it.
--  * Everything can be exported as SIE 4 for an accountant or Skatteverket.
--
-- Everything is in the private schema and reached only through functions that
-- check private.require_admin(). Card payments through Stripe are booked
-- automatically by payments-worker (source 'stripe').

-- Accounts (BAS chart). vat_box: the VAT return box a line on the account
-- counts towards by default (e.g. 05 for sales at 25 %).
create table if not exists private.acc_accounts (
  number      int primary key check (number between 1000 and 9999),
  name        text not null check (char_length(name) between 1 and 100),
  vat_box     text check (vat_box ~ '^[0-9]{2}$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists private.acc_years (
  year       int primary key check (year between 2000 and 2200),
  closed_at  timestamptz,
  closed_by  uuid
);

-- Series: A manual, S Stripe (automatic), M VAT settlement, B year-end.
create table if not exists private.acc_vouchers (
  id               uuid primary key default gen_random_uuid(),
  year             int not null references private.acc_years (year),
  series           text not null check (series in ('A', 'S', 'M', 'B')),
  number           int not null check (number > 0),
  date             date not null,
  description      text not null check (char_length(description) between 1 and 300),
  source           text not null check (source in ('manual', 'stripe', 'vat', 'closing', 'opening')),
  source_ref       text unique,
  corrects         uuid references private.acc_vouchers (id),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  created_by_email text not null default '',
  unique (year, series, number),
  check (extract(year from date)::int = year)
);
create index if not exists acc_vouchers_date_idx on private.acc_vouchers (date);

-- One line per account: amount is positive for debit, negative for credit.
create table if not exists private.acc_lines (
  id          bigserial primary key,
  voucher_id  uuid not null references private.acc_vouchers (id),
  position    int not null,
  account     int not null references private.acc_accounts (number),
  amount      numeric(14, 2) not null check (amount <> 0),
  vat_box     text check (vat_box ~ '^[0-9]{2}$'),
  note        text not null default '' check (char_length(note) <= 200),
  unique (voucher_id, position)
);
create index if not exists acc_lines_account_idx on private.acc_lines (account);

-- Receipts and other documents behind a voucher (storage bucket 'bookkeeping').
create table if not exists private.acc_attachments (
  id           uuid primary key default gen_random_uuid(),
  voucher_id   uuid not null references private.acc_vouchers (id),
  path         text not null unique,
  file_name    text not null check (char_length(file_name) between 1 and 200),
  content_type text not null default '',
  size         int not null default 0,
  uploaded_at  timestamptz not null default now(),
  uploaded_by  uuid
);
create index if not exists acc_attachments_voucher_idx on private.acc_attachments (voucher_id);

-- VAT periods that have been settled (momsavräkning booked).
create table if not exists private.acc_vat_periods (
  period      text primary key,
  settled_at  timestamptz not null default now(),
  voucher_id  uuid references private.acc_vouchers (id),
  settled_by  uuid
);

-- Stripe transactions the automatic booking couldn't handle: booked by hand.
create table if not exists private.acc_unbooked (
  txn_id           text primary key,
  kind             text not null,
  amount           numeric(14, 2) not null,
  occurred_at      timestamptz not null,
  description      text not null default '',
  detail           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  resolved_voucher uuid references private.acc_vouchers (id),
  resolved_note    text not null default ''
);

revoke all on private.acc_accounts, private.acc_years, private.acc_vouchers, private.acc_lines,
  private.acc_attachments, private.acc_vat_periods, private.acc_unbooked from public, anon, authenticated;
revoke all on sequence private.acc_lines_id_seq from public, anon, authenticated;

-- Vouchers, their lines and attachments are permanent.
create or replace function private.acc_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'bookkeeping_immutable' using errcode = 'P0001',
    hint = 'Vouchers are corrected with a new correcting voucher, never changed or deleted.';
end;
$$;
drop trigger if exists acc_vouchers_immutable on private.acc_vouchers;
create trigger acc_vouchers_immutable before update or delete on private.acc_vouchers
  for each row execute function private.acc_immutable();
drop trigger if exists acc_lines_immutable on private.acc_lines;
create trigger acc_lines_immutable before update or delete on private.acc_lines
  for each row execute function private.acc_immutable();
drop trigger if exists acc_attachments_immutable on private.acc_attachments;
create trigger acc_attachments_immutable before update or delete on private.acc_attachments
  for each row execute function private.acc_immutable();

insert into private.settings (key, value) values
  ('acc_vat_period', 'quarter'),
  ('acc_method', 'kontant'),
  ('acc_stripe_fee_reverse_charge', 'true'),
  ('acc_stripe_cursor', '0')
on conflict (key) do nothing;

-- The BAS accounts a small service company needs; more can be added in the app.
insert into private.acc_accounts (number, name, vat_box) values
  (1220, 'Inventarier och verktyg', null),
  (1229, 'Ackumulerade avskrivningar på inventarier och verktyg', null),
  (1510, 'Kundfordringar', null),
  (1580, 'Stripe-saldo (fordran på Stripe)', null),
  (1630, 'Skattekonto', null),
  (1650, 'Momsfordran', null),
  (1680, 'Andra kortfristiga fordringar', null),
  (1790, 'Övriga förutbetalda kostnader och upplupna intäkter', null),
  (1910, 'Kassa', null),
  (1930, 'Företagskonto', null),
  (2010, 'Eget kapital', null),
  (2013, 'Övriga egna uttag', null),
  (2017, 'Årets kapitaltillskott', null),
  (2018, 'Övriga egna insättningar', null),
  (2019, 'Årets resultat', null),
  (2440, 'Leverantörsskulder', null),
  (2611, 'Utgående moms på försäljning inom Sverige, 25 %', null),
  (2614, 'Utgående moms omvänd skattskyldighet, 25 %', null),
  (2615, 'Utgående moms import av varor, 25 %', null),
  (2621, 'Utgående moms på försäljning inom Sverige, 12 %', null),
  (2631, 'Utgående moms på försäljning inom Sverige, 6 %', null),
  (2640, 'Ingående moms', null),
  (2641, 'Debiterad ingående moms', null),
  (2645, 'Beräknad ingående moms på förvärv från utlandet', null),
  (2650, 'Redovisningskonto för moms', null),
  (2890, 'Skuld till värdar (förmedlad hyra)', null),
  (2990, 'Övriga upplupna kostnader och förutbetalda intäkter', null),
  (3041, 'Försäljning tjänster, 25 % moms', '05'),
  (3740, 'Öres- och kronutjämning', null),
  (3990, 'Övriga ersättningar och intäkter', null),
  (5010, 'Lokalhyra', null),
  (5410, 'Förbrukningsinventarier', null),
  (5420, 'Programvaror', null),
  (5460, 'Förbrukningsmaterial', null),
  (5611, 'Drivmedel för personbilar', null),
  (5800, 'Resekostnader', null),
  (5910, 'Annonsering', null),
  (5930, 'Reklamtrycksaker och direktreklam', null),
  (6071, 'Representation, avdragsgill', null),
  (6072, 'Representation, ej avdragsgill', null),
  (6110, 'Kontorsmateriel', null),
  (6211, 'Fast telefoni', null),
  (6212, 'Mobiltelefon', null),
  (6230, 'Datakommunikation', null),
  (6250, 'Postbefordran', null),
  (6310, 'Företagsförsäkringar', null),
  (6530, 'Redovisningstjänster', null),
  (6540, 'IT-tjänster', null),
  (6550, 'Konsultarvoden', null),
  (6570, 'Bankkostnader', null),
  (6590, 'Övriga externa tjänster', null),
  (6970, 'Tidningar, tidskrifter och facklitteratur', null),
  (6981, 'Föreningsavgifter, avdragsgilla', null),
  (6982, 'Föreningsavgifter, ej avdragsgilla', null),
  (6991, 'Övriga externa kostnader, avdragsgilla', null),
  (6992, 'Övriga externa kostnader, ej avdragsgilla', null),
  (7832, 'Avskrivningar på inventarier och verktyg', null),
  (8310, 'Ränteintäkter från omsättningstillgångar', null),
  (8410, 'Räntekostnader för långfristiga skulder', null),
  (8420, 'Räntekostnader för kortfristiga skulder', null),
  (8999, 'Årets resultat', null)
on conflict (number) do nothing;

-- VAT periods ------------------------------------------------------------------

-- The VAT period a date falls in: '2026-Q4' (quarter), '2026-11' (month) or '2026' (year).
create or replace function private.acc_period_of(p_date date)
returns text language sql stable security definer set search_path = '' as $$
  select case coalesce(private.setting('acc_vat_period'), 'quarter')
           when 'month' then to_char(p_date, 'YYYY-MM')
           when 'year' then to_char(p_date, 'YYYY')
           else to_char(p_date, 'YYYY') || '-Q' || extract(quarter from p_date)::int
         end;
$$;

create or replace function private.acc_period_bounds(p_period text, out from_date date, out to_date date)
returns record language plpgsql immutable set search_path = '' as $$
begin
  if p_period ~ '^[0-9]{4}-Q[1-4]$' then
    from_date := make_date(left(p_period, 4)::int, (right(p_period, 1)::int - 1) * 3 + 1, 1);
    to_date := (from_date + interval '3 months')::date - 1;
  elsif p_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    from_date := make_date(left(p_period, 4)::int, right(p_period, 2)::int, 1);
    to_date := (from_date + interval '1 month')::date - 1;
  elsif p_period ~ '^[0-9]{4}$' then
    from_date := make_date(p_period::int, 1, 1);
    to_date := make_date(p_period::int, 12, 31);
  else
    raise exception 'bad_period' using errcode = 'P0001';
  end if;
end;
$$;

-- Can something be booked on this date? Not in a closed year, and (except for
-- year-end entries, which touch no VAT accounts) not in a settled VAT period.
create or replace function private.acc_date_open(p_date date, p_source text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from private.acc_years y where y.year = extract(year from p_date)::int and y.closed_at is not null)
     and (p_source in ('closing', 'opening')
          or not exists (select 1 from private.acc_vat_periods v where v.period = private.acc_period_of(p_date)));
$$;

-- The first date from p_date on that is open (late automatic bookings move there).
create or replace function private.acc_first_open_date(p_date date)
returns date language plpgsql stable security definer set search_path = '' as $$
declare
  d date := p_date;
  k int := 0;
begin
  while not private.acc_date_open(d, 'stripe') loop
    d := (private.acc_period_bounds(private.acc_period_of(d))).to_date + 1;
    k := k + 1;
    if k > 400 then raise exception 'no_open_period' using errcode = 'P0001'; end if;
  end loop;
  return d;
end;
$$;

create or replace function private.acc_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Stockholm')::date;
$$;

-- Booking -----------------------------------------------------------------------

-- Book one voucher. p_lines: [{account, amount (debit +, credit -), vat_box?, note?}].
-- With p_source_ref, booking the same thing twice returns the first voucher.
-- p_shift moves a date in a locked period to the first open date (automatic bookings).
create or replace function private.acc_book(
  p_date date, p_description text, p_lines jsonb, p_series text, p_source text,
  p_source_ref text default null, p_corrects uuid default null,
  p_user uuid default null, p_user_email text default '', p_shift boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d date := p_date;
  y int;
  n int;
  vid uuid;
  total numeric := 0;
  l jsonb;
  acct int;
  amt numeric;
  descr text := btrim(coalesce(p_description, ''));
begin
  if p_source_ref is not null then
    select id into vid from private.acc_vouchers where source_ref = p_source_ref;
    if vid is not null then return vid; end if;
  end if;
  if d is null then raise exception 'date_required' using errcode = 'P0001'; end if;
  if descr = '' then raise exception 'description_required' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'two_lines_required' using errcode = 'P0001';
  end if;
  for l in select e from jsonb_array_elements(p_lines) e loop
    acct := (l->>'account')::int;
    amt := round((l->>'amount')::numeric, 2);
    if amt is null or amt = 0 then raise exception 'zero_amount' using errcode = 'P0001'; end if;
    if not exists (select 1 from private.acc_accounts a where a.number = acct and a.active) then
      raise exception 'unknown_account' using errcode = 'P0001', detail = coalesce(acct::text, '');
    end if;
    if coalesce(l->>'vat_box', '') <> '' and l->>'vat_box' !~ '^[0-9]{2}$' then
      raise exception 'bad_vat_box' using errcode = 'P0001';
    end if;
    total := total + amt;
  end loop;
  if total <> 0 then raise exception 'unbalanced' using errcode = 'P0001', detail = total::text; end if;

  if p_shift then
    d := private.acc_first_open_date(d);
  elsif not private.acc_date_open(d, p_source) then
    raise exception 'period_locked' using errcode = 'P0001';
  end if;
  if p_source = 'manual' and d > private.acc_today() then raise exception 'future_date' using errcode = 'P0001'; end if;

  y := extract(year from d)::int;
  insert into private.acc_years (year) values (y) on conflict (year) do nothing;
  -- Unbroken numbering per year and series.
  perform pg_advisory_xact_lock(hashtext('acc_voucher:' || y || ':' || p_series));
  select coalesce(max(number), 0) + 1 into n from private.acc_vouchers where year = y and series = p_series;

  insert into private.acc_vouchers (year, series, number, date, description, source, source_ref, corrects, created_by, created_by_email)
  values (y, p_series, n, d,
          left(case when d <> p_date then descr || ' (avser ' || p_date || ')' else descr end, 300),
          p_source, p_source_ref, p_corrects, p_user, coalesce(p_user_email, ''))
  returning id into vid;

  insert into private.acc_lines (voucher_id, position, account, amount, vat_box, note)
  select vid, e.ord, (e.v->>'account')::int, round((e.v->>'amount')::numeric, 2),
         coalesce(nullif(e.v->>'vat_box', ''), a.vat_box), left(coalesce(e.v->>'note', ''), 200)
    from jsonb_array_elements(p_lines) with ordinality as e(v, ord)
    join private.acc_accounts a on a.number = (e.v->>'account')::int;
  return vid;
end;
$$;
revoke all on function private.acc_book(date, text, jsonb, text, text, text, uuid, uuid, text, boolean) from public, anon, authenticated;

create or replace function private.acc_label(v private.acc_vouchers)
returns text language sql immutable set search_path = '' as $$
  select v.series || v.number;
$$;

create or replace function private.acc_me_email()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select email from auth.users where id = (select auth.uid())), '');
$$;

-- The app's functions (team only) ------------------------------------------------

create or replace function public.acc_create_voucher(p_date date, p_description text, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  vid uuid;
  v private.acc_vouchers;
begin
  perform private.require_admin();
  vid := private.acc_book(p_date, p_description, p_lines, 'A', 'manual', null, null, (select auth.uid()), private.acc_me_email());
  select * into v from private.acc_vouchers where id = vid;
  return jsonb_build_object('id', v.id, 'label', private.acc_label(v), 'date', v.date);
end;
$$;

-- Correct a voucher: a new voucher with every line reversed, referring to the old one.
create or replace function public.acc_correct_voucher(p_voucher uuid, p_date date, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o private.acc_vouchers;
  vid uuid;
  v private.acc_vouchers;
  lines jsonb;
begin
  perform private.require_admin();
  select * into o from private.acc_vouchers where id = p_voucher;
  if o.id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  if exists (select 1 from private.acc_vouchers where corrects = o.id) then raise exception 'already_corrected' using errcode = 'P0001'; end if;
  if o.source in ('vat', 'closing', 'opening') then raise exception 'not_correctable' using errcode = 'P0001'; end if;
  select jsonb_agg(jsonb_build_object('account', l.account, 'amount', -l.amount, 'vat_box', l.vat_box, 'note', l.note) order by l.position)
    into lines from private.acc_lines l where l.voucher_id = o.id;
  vid := private.acc_book(coalesce(p_date, private.acc_today()),
                          'Rättelse av ' || private.acc_label(o) || ': ' || btrim(coalesce(p_reason, '')),
                          lines, 'A', 'manual', null, o.id, (select auth.uid()), private.acc_me_email());
  select * into v from private.acc_vouchers where id = vid;
  return jsonb_build_object('id', v.id, 'label', private.acc_label(v), 'date', v.date);
end;
$$;

create or replace function public.acc_add_attachment(p_voucher uuid, p_path text, p_name text, p_type text, p_size int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  aid uuid;
begin
  perform private.require_admin();
  if not exists (select 1 from private.acc_vouchers where id = p_voucher) then raise exception 'not_found' using errcode = 'P0001'; end if;
  if split_part(p_path, '/', 1) <> p_voucher::text then raise exception 'bad_path' using errcode = 'P0001'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'bookkeeping' and name = p_path) then
    raise exception 'file_missing' using errcode = 'P0001';
  end if;
  insert into private.acc_attachments (voucher_id, path, file_name, content_type, size, uploaded_by)
  values (p_voucher, p_path, left(coalesce(nullif(btrim(p_name), ''), 'underlag'), 200), left(coalesce(p_type, ''), 100), greatest(coalesce(p_size, 0), 0), (select auth.uid()))
  returning id into aid;
  return aid;
end;
$$;

create or replace function public.acc_accounts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('number', a.number, 'name', a.name, 'vat_box', a.vat_box, 'active', a.active,
                                                       'used', exists (select 1 from private.acc_lines l where l.account = a.number))
                                    order by a.number)
                     from private.acc_accounts a), '[]'::jsonb);
end;
$$;

-- Add an account, or rename / switch one on or off (the number never changes).
create or replace function public.acc_save_account(p_number int, p_name text, p_vat_box text, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  insert into private.acc_accounts (number, name, vat_box, active)
  values (p_number, btrim(p_name), nullif(btrim(coalesce(p_vat_box, '')), ''), coalesce(p_active, true))
  on conflict (number) do update set name = excluded.name, vat_box = excluded.vat_box, active = excluded.active;
  perform private.log_admin('acc_account', p_number::text, p_name);
end;
$$;

create or replace function public.acc_vouchers(p_year int, p_search text default '', p_limit int default 100, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  q text := lower(btrim(coalesce(p_search, '')));
begin
  perform private.require_admin();
  return coalesce((
    select jsonb_agg(item order by item->>'date' desc, item->>'series' desc, (item->>'number')::int desc)
      from (
        select jsonb_build_object(
                 'id', v.id, 'label', private.acc_label(v), 'series', v.series, 'number', v.number, 'date', v.date,
                 'description', v.description, 'source', v.source, 'created_at', v.created_at,
                 'total', (select coalesce(sum(l.amount), 0) from private.acc_lines l where l.voucher_id = v.id and l.amount > 0),
                 'accounts', (select string_agg(distinct l.account::text, ', ') from private.acc_lines l where l.voucher_id = v.id),
                 'attachments', (select count(*) from private.acc_attachments a where a.voucher_id = v.id),
                 'corrected_by', (select private.acc_label(c) from private.acc_vouchers c where c.corrects = v.id limit 1),
                 'corrects', (select private.acc_label(o) from private.acc_vouchers o where o.id = v.corrects)) as item
          from private.acc_vouchers v
         where v.year = p_year
           and (q = '' or lower(v.description) like '%' || q || '%' or lower(private.acc_label(v)) = q
                or exists (select 1 from private.acc_lines l where l.voucher_id = v.id and l.account::text = q))
         order by v.date desc, v.series desc, v.number desc
         limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0)
      ) x), '[]'::jsonb);
end;
$$;

create or replace function public.acc_voucher(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v private.acc_vouchers;
begin
  perform private.require_admin();
  select * into v from private.acc_vouchers where id = p_id;
  if v.id is null then return null; end if;
  return jsonb_build_object(
    'id', v.id, 'label', private.acc_label(v), 'date', v.date, 'description', v.description, 'source', v.source,
    'source_ref', v.source_ref, 'created_at', v.created_at, 'created_by_email', v.created_by_email,
    'corrects', (select jsonb_build_object('id', o.id, 'label', private.acc_label(o)) from private.acc_vouchers o where o.id = v.corrects),
    'corrected_by', (select jsonb_build_object('id', c.id, 'label', private.acc_label(c)) from private.acc_vouchers c where c.corrects = v.id limit 1),
    'lines', (select jsonb_agg(jsonb_build_object('account', l.account, 'name', a.name, 'amount', l.amount, 'vat_box', l.vat_box, 'note', l.note) order by l.position)
                from private.acc_lines l join private.acc_accounts a on a.number = l.account where l.voucher_id = v.id),
    'attachments', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'path', t.path, 'file_name', t.file_name, 'content_type', t.content_type, 'uploaded_at', t.uploaded_at) order by t.uploaded_at)
                               from private.acc_attachments t where t.voucher_id = v.id), '[]'::jsonb));
end;
$$;

-- Reports -----------------------------------------------------------------------

-- Per account: opening balance, debit and credit in the period, closing balance.
-- Balance accounts (1000-2999) open with everything before p_from; result accounts
-- (3000-9999) with what is before p_from in the same year.
create or replace function public.acc_balances(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  year_start date := make_date(extract(year from p_from)::int, 1, 1);
begin
  perform private.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('number', s.account, 'name', a.name, 'opening', s.opening, 'debit', s.debit,
                                        'credit', s.credit, 'closing', s.opening + s.debit - s.credit) order by s.account)
      from (
        select l.account,
               coalesce(sum(l.amount) filter (where v.date < p_from and (l.account < 3000 or v.date >= year_start)), 0) as opening,
               coalesce(sum(l.amount) filter (where v.date between p_from and p_to and l.amount > 0), 0) as debit,
               coalesce(-sum(l.amount) filter (where v.date between p_from and p_to and l.amount < 0), 0) as credit
          from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
         where v.date <= p_to
         group by l.account
      ) s join private.acc_accounts a on a.number = s.account
     where s.opening <> 0 or s.debit <> 0 or s.credit <> 0), '[]'::jsonb);
end;
$$;

-- General journal (grundbok): vouchers in order, with their lines.
create or replace function public.acc_journal(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', v.id, 'label', private.acc_label(v), 'date', v.date, 'description', v.description, 'source', v.source,
             'created_at', v.created_at,
             'lines', (select jsonb_agg(jsonb_build_object('account', l.account, 'name', a.name, 'amount', l.amount, 'vat_box', l.vat_box, 'note', l.note) order by l.position)
                         from private.acc_lines l join private.acc_accounts a on a.number = l.account where l.voucher_id = v.id))
           order by v.date, v.series, v.number)
      from private.acc_vouchers v where v.date between p_from and p_to), '[]'::jsonb);
end;
$$;

-- General ledger (huvudbok) for one account: opening balance and every line.
create or replace function public.acc_ledger(p_account int, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  year_start date := make_date(extract(year from p_from)::int, 1, 1);
  opening numeric;
begin
  perform private.require_admin();
  select coalesce(sum(l.amount), 0) into opening
    from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
   where l.account = p_account and v.date < p_from and (p_account < 3000 or v.date >= year_start);
  return jsonb_build_object(
    'account', p_account,
    'name', (select name from private.acc_accounts where number = p_account),
    'opening', opening,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object('voucher_id', v.id, 'label', private.acc_label(v), 'date', v.date,
                                          'description', v.description, 'amount', l.amount, 'note', l.note)
                       order by v.date, v.series, v.number, l.position)
        from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
       where l.account = p_account and v.date between p_from and p_to), '[]'::jsonb));
end;
$$;

-- The VAT return (momsdeklaration) for a period. Base amounts come from the
-- lines' VAT boxes, VAT amounts from the VAT accounts. The settlement voucher
-- itself is left out. Amounts to file are whole kronor (rounded down).
create or replace function private.acc_vat_figures(p_period text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  b record;
  exact jsonb := '{}'::jsonb;
  filed jsonb := '{}'::jsonb;
  k text;
  val numeric;
  out_vat numeric := 0;
  in_vat numeric := 0;
begin
  select * into b from private.acc_period_bounds(p_period);
  for k, val in
    with lines as (
      select l.account, l.amount, l.vat_box
        from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
       where v.date between b.from_date and b.to_date and v.source <> 'vat'
    )
    -- Sales and other base amounts: credit counts as positive.
    select vat_box, -sum(amount) from lines
     where vat_box in ('05', '06', '07', '08', '35', '36', '37', '38', '39', '40', '41', '42') group by vat_box
    union all
    -- Purchases with reverse charge and imports: debit counts as positive.
    select vat_box, sum(amount) from lines
     where vat_box in ('20', '21', '22', '23', '24', '50') group by vat_box
    union all
    -- VAT amounts from the accounts.
    select box, sum(sign * amount) from (
      select case
               when account between 2610 and 2613 then '10'
               when account = 2614 then '30'
               when account = 2615 then '60'
               when account between 2620 and 2623 then '11'
               when account = 2624 then '31'
               when account = 2625 then '61'
               when account between 2630 and 2633 then '12'
               when account = 2634 then '32'
               when account = 2635 then '62'
               when account between 2640 and 2649 then '48'
             end as box,
             case when account between 2640 and 2649 then 1 else -1 end as sign,
             amount
        from lines where account between 2610 and 2649
    ) t where box is not null group by box
  loop
    exact := exact || jsonb_build_object(k, round(val, 2));
    filed := filed || jsonb_build_object(k, trunc(val));
  end loop;
  select coalesce(sum((filed->>x)::numeric), 0) into out_vat from unnest(array['10', '11', '12', '30', '31', '32', '60', '61', '62']) x;
  in_vat := coalesce((filed->>'48')::numeric, 0);
  filed := filed || jsonb_build_object('49', out_vat - in_vat);
  return jsonb_build_object('period', p_period, 'from', b.from_date, 'to', b.to_date, 'exact', exact, 'boxes', filed);
end;
$$;

create or replace function public.acc_vat_report(p_period text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  s private.acc_vat_periods;
begin
  perform private.require_admin();
  select * into s from private.acc_vat_periods where period = p_period;
  return private.acc_vat_figures(p_period) || jsonb_build_object(
    'settled_at', s.settled_at,
    'voucher', (select jsonb_build_object('id', v.id, 'label', private.acc_label(v)) from private.acc_vouchers v where v.id = s.voucher_id));
end;
$$;

-- The VAT periods of a year with their status.
create or replace function public.acc_vat_periods(p_year int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  kind text := coalesce(private.setting('acc_vat_period'), 'quarter');
begin
  perform private.require_admin();
  return (
    select jsonb_agg(jsonb_build_object('period', p, 'settled', exists (select 1 from private.acc_vat_periods v where v.period = p),
                                        'to', (private.acc_period_bounds(p)).to_date) order by p)
      from (
        select case kind when 'month' then p_year || '-' || lpad(m::text, 2, '0') when 'year' then p_year::text else p_year || '-Q' || m end as p
          from generate_series(1, case kind when 'month' then 12 when 'year' then 1 else 4 end) m
      ) x);
end;
$$;

-- Settle a VAT period: move the VAT accounts to 2650 (what is owed to or from
-- Skatteverket), round to whole kronor on 3740, and lock the period.
create or replace function public.acc_vat_settle(p_period text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b record;
  fig jsonb;
  lines jsonb := '[]'::jsonb;
  r record;
  sum_bal numeric := 0;
  payable numeric;
  diff numeric;
  vid uuid;
  v private.acc_vouchers;
begin
  perform private.require_admin();
  select * into b from private.acc_period_bounds(p_period);
  if p_period <> private.acc_period_of(b.from_date) then raise exception 'bad_period' using errcode = 'P0001'; end if;
  if exists (select 1 from private.acc_vat_periods where period = p_period) then raise exception 'already_settled' using errcode = 'P0001'; end if;
  if b.to_date >= private.acc_today() then raise exception 'period_not_over' using errcode = 'P0001'; end if;
  -- Earlier periods first.
  if exists (
    select 1 from private.acc_lines l join private.acc_vouchers vv on vv.id = l.voucher_id
     where l.account between 2610 and 2649 and vv.date < b.from_date and vv.source <> 'vat'
       and not exists (select 1 from private.acc_vat_periods p where p.period = private.acc_period_of(vv.date))
  ) then raise exception 'earlier_period_open' using errcode = 'P0001'; end if;

  fig := private.acc_vat_figures(p_period);
  for r in
    select l.account, sum(l.amount) as bal
      from private.acc_lines l join private.acc_vouchers vv on vv.id = l.voucher_id
     where l.account between 2610 and 2649 and vv.date between b.from_date and b.to_date and vv.source <> 'vat'
     group by l.account having sum(l.amount) <> 0 order by l.account
  loop
    lines := lines || jsonb_build_object('account', r.account, 'amount', -r.bal);
    sum_bal := sum_bal + r.bal;
  end loop;
  payable := (fig->'boxes'->>'49')::numeric;
  if jsonb_array_length(lines) > 0 then
    if payable <> 0 then lines := lines || jsonb_build_object('account', 2650, 'amount', -payable); end if;
    diff := sum_bal + payable;
    if diff <> 0 then lines := lines || jsonb_build_object('account', 3740, 'amount', diff, 'note', 'Avrundning till hela kronor'); end if;
    vid := private.acc_book(b.to_date, 'Momsredovisning ' || p_period, lines, 'M', 'vat', 'vat:' || p_period, null,
                            (select auth.uid()), private.acc_me_email());
  end if;
  insert into private.acc_vat_periods (period, voucher_id, settled_by) values (p_period, vid, (select auth.uid()));
  perform private.log_admin('acc_vat_settle', p_period, coalesce(payable::text, '0'));
  select * into v from private.acc_vouchers where id = vid;
  return jsonb_build_object('period', p_period, 'payable', payable, 'voucher', case when vid is null then null else jsonb_build_object('id', v.id, 'label', private.acc_label(v)) end);
end;
$$;

-- Close a year: book the year's result on 2019 (31 Dec), lock the year, and open
-- the next by moving 2013, 2017, 2018 and 2019 to equity (2010) on 1 Jan.
create or replace function public.acc_close_year(p_year int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  res numeric;
  closing uuid;
  opening uuid;
  lines jsonb := '[]'::jsonb;
  r record;
  moved numeric := 0;
begin
  perform private.require_admin();
  if exists (select 1 from private.acc_years where year = p_year and closed_at is not null) then raise exception 'already_closed' using errcode = 'P0001'; end if;
  if make_date(p_year, 12, 31) >= private.acc_today() then raise exception 'year_not_over' using errcode = 'P0001'; end if;
  if exists (select 1 from private.acc_years y where y.year < p_year and y.closed_at is null
                and exists (select 1 from private.acc_vouchers v where v.year = y.year)) then
    raise exception 'earlier_year_open' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
     where v.year = p_year and l.account between 2610 and 2649 and v.source <> 'vat'
       and not exists (select 1 from private.acc_vat_periods p where p.period = private.acc_period_of(v.date))
  ) then raise exception 'vat_not_settled' using errcode = 'P0001'; end if;

  insert into private.acc_years (year) values (p_year) on conflict (year) do nothing;
  select coalesce(sum(l.amount), 0) into res
    from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
   where v.year = p_year and l.account between 3000 and 8989;
  if res <> 0 then
    closing := private.acc_book(make_date(p_year, 12, 31), 'Årets resultat ' || p_year,
                                jsonb_build_array(jsonb_build_object('account', 8999, 'amount', -res),
                                                  jsonb_build_object('account', 2019, 'amount', res)),
                                'B', 'closing', 'closing:' || p_year, null, (select auth.uid()), private.acc_me_email());
  end if;
  update private.acc_years set closed_at = now(), closed_by = (select auth.uid()) where year = p_year;

  for r in
    select l.account, sum(l.amount) as bal
      from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
     where l.account in (2013, 2017, 2018, 2019) and v.date <= make_date(p_year, 12, 31)
     group by l.account having sum(l.amount) <> 0 order by l.account
  loop
    lines := lines || jsonb_build_object('account', r.account, 'amount', -r.bal);
    moved := moved + r.bal;
  end loop;
  if jsonb_array_length(lines) > 0 then
    lines := lines || jsonb_build_object('account', 2010, 'amount', moved);
    opening := private.acc_book(make_date(p_year + 1, 1, 1), 'Ingående balans ' || (p_year + 1) || ': föregående års resultat och privata poster till eget kapital',
                                lines, 'B', 'opening', 'opening:' || (p_year + 1), null, (select auth.uid()), private.acc_me_email());
  end if;
  perform private.log_admin('acc_close_year', p_year::text, res::text);
  return jsonb_build_object('year', p_year, 'result', -res, 'closing', closing, 'opening', opening);
end;
$$;

create or replace function public.acc_years()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('year', y.year, 'closed_at', y.closed_at) order by y.year desc) from private.acc_years y), '[]'::jsonb);
end;
$$;

-- Everything an SIE 4 export of a year needs.
create or replace function public.acc_sie(p_year int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  y_from date := make_date(p_year, 1, 1);
  y_to date := make_date(p_year, 12, 31);
begin
  perform private.require_admin();
  return jsonb_build_object(
    'year', p_year,
    'closed', exists (select 1 from private.acc_years where year = p_year and closed_at is not null),
    'accounts', (select jsonb_agg(jsonb_build_object('number', a.number, 'name', a.name) order by a.number) from private.acc_accounts a),
    'opening', coalesce((select jsonb_object_agg(account, bal) from (
        select l.account, sum(l.amount) as bal from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
         where l.account < 3000 and v.date < y_from group by l.account having sum(l.amount) <> 0) t), '{}'::jsonb),
    'closing', coalesce((select jsonb_object_agg(account, bal) from (
        select l.account, sum(l.amount) as bal from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
         where l.account < 3000 and v.date <= y_to group by l.account having sum(l.amount) <> 0) t), '{}'::jsonb),
    'result', coalesce((select jsonb_object_agg(account, bal) from (
        select l.account, sum(l.amount) as bal from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
         where l.account >= 3000 and v.date between y_from and y_to group by l.account having sum(l.amount) <> 0) t), '{}'::jsonb),
    'vouchers', public.acc_journal(y_from, y_to));
end;
$$;

-- Stripe transactions waiting to be booked by hand.
create or replace function public.acc_unbooked()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((select jsonb_agg(to_jsonb(u) order by u.occurred_at) from private.acc_unbooked u where u.resolved_at is null), '[]'::jsonb);
end;
$$;

create or replace function public.acc_resolve_unbooked(p_txn text, p_voucher uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_voucher is not null and not exists (select 1 from private.acc_vouchers where id = p_voucher) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update private.acc_unbooked set resolved_at = now(), resolved_voucher = p_voucher, resolved_note = left(coalesce(p_note, ''), 300)
   where txn_id = p_txn and resolved_at is null;
  perform private.log_admin('acc_unbooked', p_txn, p_note);
end;
$$;

-- Key figures for the overview.
create or replace function public.acc_overview(p_year int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  y_from date := make_date(p_year, 1, 1);
  y_to date := make_date(p_year, 12, 31);
  bal jsonb;
begin
  perform private.require_admin();
  select coalesce(jsonb_object_agg(account, total), '{}'::jsonb) into bal from (
    select l.account, sum(l.amount) as total from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
     where l.account in (1580, 1930, 2650, 2890) and v.date <= least(y_to, private.acc_today()) group by l.account) t;
  return jsonb_build_object(
    'year', p_year,
    'method', coalesce(private.setting('acc_method'), 'kontant'),
    'vat_period', coalesce(private.setting('acc_vat_period'), 'quarter'),
    'current_period', private.acc_period_of(private.acc_today()),
    'vouchers', (select count(*) from private.acc_vouchers where year = p_year),
    'income', (select coalesce(-sum(l.amount), 0) from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
                where v.date between y_from and y_to and l.account between 3000 and 3999),
    'costs', (select coalesce(sum(l.amount), 0) from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
               where v.date between y_from and y_to and l.account between 4000 and 8989 and v.source <> 'closing'),
    'stripe_balance', coalesce((bal->>'1580')::numeric, 0),
    'bank', coalesce((bal->>'1930')::numeric, 0),
    'host_liability', -coalesce((bal->>'2890')::numeric, 0),
    'vat_account', -coalesce((bal->>'2650')::numeric, 0),
    'missing_attachments', (select count(*) from private.acc_vouchers v
                             where v.year = p_year and v.source = 'manual' and v.corrects is null
                               and not exists (select 1 from private.acc_attachments a where a.voucher_id = v.id)
                               and not exists (select 1 from private.acc_vouchers c where c.corrects = v.id)),
    'unbooked', (select count(*) from private.acc_unbooked where resolved_at is null),
    'stripe_synced_at', private.setting('acc_stripe_synced_at'),
    'closed', exists (select 1 from private.acc_years where year = p_year and closed_at is not null));
end;
$$;

-- Team only.
do $$
declare
  f text;
begin
  foreach f in array array[
    'acc_create_voucher(date, text, jsonb)', 'acc_correct_voucher(uuid, date, text)',
    'acc_add_attachment(uuid, text, text, text, int)', 'acc_accounts()', 'acc_save_account(int, text, text, boolean)',
    'acc_vouchers(int, text, int, int)', 'acc_voucher(uuid)', 'acc_balances(date, date)', 'acc_journal(date, date)',
    'acc_ledger(int, date, date)', 'acc_vat_report(text)', 'acc_vat_periods(int)', 'acc_vat_settle(text)',
    'acc_close_year(int)', 'acc_years()', 'acc_sie(int)', 'acc_unbooked()', 'acc_resolve_unbooked(text, uuid, text)',
    'acc_overview(int)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'acc_period_of(date)', 'acc_period_bounds(text)', 'acc_date_open(date, text)', 'acc_first_open_date(date)',
    'acc_label(private.acc_vouchers)', 'acc_me_email()', 'acc_vat_figures(text)', 'acc_immutable()']
  loop
    execute format('revoke all on function private.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Receipts and documents: a private bucket only the team can read and add to.
-- Files are never changed or removed (no update or delete policy).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bookkeeping', 'bookkeeping', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;
drop policy if exists "team reads bookkeeping files" on storage.objects;
create policy "team reads bookkeeping files" on storage.objects for select to authenticated
  using (bucket_id = 'bookkeeping' and private.is_admin());
drop policy if exists "team adds bookkeeping files" on storage.objects;
create policy "team adds bookkeeping files" on storage.objects for insert to authenticated
  with check (bucket_id = 'bookkeeping' and private.is_admin());
