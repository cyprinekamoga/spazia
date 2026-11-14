-- Bookkeeping: team only, unbroken numbering, balanced and permanent vouchers,
-- corrections, the VAT return, settling a period, receipts, and closing a year.
begin;

select set_config('t.admin', tests.new_user('team@example.com', 'Team')::text, true);
select set_config('t.user', tests.new_user('user@example.com', 'Ulla')::text, true);
insert into private.admins (user_id) values (current_setting('t.admin')::uuid);

set local role authenticated;

-- Not for ordinary accounts.
do $$ begin
  perform tests.act_as(current_setting('t.user')::uuid);
  begin
    perform public.acc_vouchers(2026);
    perform tests.ok(false, 'a normal user must not read the books');
  exception when insufficient_privilege then null; end;
  begin
    perform public.acc_create_voucher(date '2026-07-01', 'Försök', '[{"account":1930,"amount":1},{"account":3041,"amount":-1}]');
    perform tests.ok(false, 'a normal user must not book');
  exception when insufficient_privilege then null; end;
end $$;

-- Q3 2026: a sale, a service from another EU country, a purchase with VAT.
do $$
declare v jsonb;
begin
  perform tests.act_as(current_setting('t.admin')::uuid);
  v := public.acc_create_voucher(date '2026-07-02', 'Försäljning konsulttjänst',
         '[{"account":1930,"amount":1250},{"account":3041,"amount":-1000},{"account":2611,"amount":-250}]');
  perform tests.ok(v->>'label' = 'A1', 'first voucher is A1, got ' || (v->>'label'));
  perform set_config('t.sale', v->>'id', false);
  v := public.acc_create_voucher(date '2026-07-10', 'Annonser Meta (Irland)',
         '[{"account":5910,"amount":100,"vat_box":"21"},{"account":2645,"amount":25},{"account":2614,"amount":-25},{"account":1930,"amount":-100}]');
  perform tests.ok(v->>'label' = 'A2', 'second voucher is A2');
  v := public.acc_create_voucher(date '2026-08-05', 'Kontorsmaterial',
         '[{"account":6110,"amount":100},{"account":2641,"amount":25},{"account":1930,"amount":-125}]');
  perform tests.ok(v->>'label' = 'A3', 'third voucher is A3');
end $$;

-- Rejected: unbalanced, unknown account, one line, a date in the future.
do $$
declare
  bad text[] := array[
    '[{"account":1930,"amount":10},{"account":3041,"amount":-9}]',
    '[{"account":1931,"amount":10},{"account":3041,"amount":-10}]',
    '[{"account":1930,"amount":10}]'];
  expect text[] := array['unbalanced', 'unknown_account', 'two_lines_required'];
  i int;
begin
  perform tests.act_as(current_setting('t.admin')::uuid);
  for i in 1..3 loop
    begin
      perform public.acc_create_voucher(date '2026-07-15', 'Fel', bad[i]::jsonb);
      perform tests.ok(false, 'must reject: ' || expect[i]);
    exception when raise_exception then
      perform tests.ok(sqlerrm = expect[i], 'expected ' || expect[i] || ', got ' || sqlerrm);
    end;
  end loop;
  begin
    perform public.acc_create_voucher(private.acc_today() + 1, 'Framtid', '[{"account":1930,"amount":1},{"account":3041,"amount":-1}]');
    perform tests.ok(false, 'must reject a future date');
  exception when raise_exception then
    perform tests.ok(sqlerrm = 'future_date', 'future_date, got ' || sqlerrm);
  end;
end $$;

reset role;
-- Vouchers can't be changed or deleted, not even by the database owner.
do $$ begin
  begin
    update private.acc_vouchers set description = 'Ändrad' where id = current_setting('t.sale')::uuid;
    perform tests.ok(false, 'update must fail');
  exception when raise_exception then perform tests.ok(sqlerrm = 'bookkeeping_immutable', 'update blocked'); end;
  begin
    delete from private.acc_lines where voucher_id = current_setting('t.sale')::uuid;
    perform tests.ok(false, 'delete must fail');
  exception when raise_exception then perform tests.ok(sqlerrm = 'bookkeeping_immutable', 'delete blocked'); end;
end $$;
set local role authenticated;

-- A correction reverses every line and refers to the original; only once.
do $$
declare
  v jsonb;
  d jsonb;
begin
  perform tests.act_as(current_setting('t.admin')::uuid);
  v := public.acc_create_voucher(date '2026-08-20', 'Felbokad', '[{"account":6110,"amount":40},{"account":1930,"amount":-40}]');
  d := public.acc_correct_voucher((v->>'id')::uuid, date '2026-08-21', 'Fel konto');
  perform tests.ok(d->>'label' = 'A5', 'correction is A5, got ' || (d->>'label'));
  d := public.acc_voucher((d->>'id')::uuid);
  perform tests.ok((d->'lines'->0->>'amount')::numeric = -40 and (d->'lines'->1->>'amount')::numeric = 40, 'lines reversed: ' || (d->'lines')::text);
  perform tests.ok(d->'corrects'->>'label' = 'A4', 'refers to A4');
  begin
    perform public.acc_correct_voucher((v->>'id')::uuid, date '2026-08-22', 'Igen');
    perform tests.ok(false, 'second correction must fail');
  exception when raise_exception then perform tests.ok(sqlerrm = 'already_corrected', 'already_corrected'); end;
end $$;

-- The VAT return for Q3: base and VAT boxes, and what to pay (49).
do $$
declare
  r jsonb;
  b jsonb;
begin
  perform tests.act_as(current_setting('t.admin')::uuid);
  r := public.acc_vat_report('2026-Q3');
  b := r->'boxes';
  perform tests.ok((b->>'05')::numeric = 1000, '05 = 1000: ' || b::text);
  perform tests.ok((b->>'10')::numeric = 250, '10 = 250');
  perform tests.ok((b->>'21')::numeric = 100, '21 = 100');
  perform tests.ok((b->>'30')::numeric = 25, '30 = 25');
  perform tests.ok((b->>'48')::numeric = 50, '48 = 50');
  perform tests.ok((b->>'49')::numeric = 225, '49 = 225');
end $$;

-- A receipt must exist in storage, in the voucher's own folder.
reset role;
insert into storage.buckets (id, name) values ('bookkeeping', 'bookkeeping') on conflict do nothing;
insert into storage.objects (bucket_id, name) values ('bookkeeping', current_setting('t.sale') || '/kvitto.pdf');
set local role authenticated;
do $$ begin
  perform tests.act_as(current_setting('t.admin')::uuid);
  perform public.acc_add_attachment(current_setting('t.sale')::uuid, current_setting('t.sale') || '/kvitto.pdf', 'kvitto.pdf', 'application/pdf', 1000);
  perform tests.ok(jsonb_array_length(public.acc_voucher(current_setting('t.sale')::uuid)->'attachments') = 1, 'receipt attached');
  begin
    perform public.acc_add_attachment(current_setting('t.sale')::uuid, current_setting('t.sale') || '/saknas.pdf', 'saknas.pdf', 'application/pdf', 1);
    perform tests.ok(false, 'a missing file must fail');
  exception when raise_exception then perform tests.ok(sqlerrm = 'file_missing', 'file_missing'); end;
end $$;

-- Settling Q3: the VAT accounts go to 2650, and Q3 is locked.
do $$
declare
  s jsonb;
begin
  perform tests.act_as(current_setting('t.admin')::uuid);
  s := public.acc_vat_settle('2026-Q3');
  perform tests.ok((s->>'payable')::numeric = 225 and s->'voucher'->>'label' = 'M1', 'settled: ' || s::text);
  perform tests.ok((public.acc_vat_report('2026-Q3')->'boxes'->>'49')::numeric = 225, 'report unchanged after settling');
  begin
    perform public.acc_create_voucher(date '2026-09-01', 'För sent', '[{"account":6110,"amount":10},{"account":1930,"amount":-10}]');
    perform tests.ok(false, 'a settled period must be locked');
  exception when raise_exception then perform tests.ok(sqlerrm = 'period_locked', 'period_locked'); end;
  begin
    perform public.acc_vat_settle('2026-Q3');
    perform tests.ok(false, 'settling twice must fail');
  exception when raise_exception then perform tests.ok(sqlerrm = 'already_settled', 'already_settled'); end;
end $$;

reset role;
do $$
declare bal numeric;
begin
  select sum(l.amount) into bal from private.acc_lines l where l.account between 2610 and 2649;
  perform tests.ok(bal = 0, 'VAT accounts zero after settling, got ' || bal);
  select sum(l.amount) into bal from private.acc_lines l where l.account = 2650;
  perform tests.ok(bal = -225, '2650 owes 225, got ' || bal);
end $$;

-- An automatic booking dated in a locked period moves to the first open day.
do $$
declare
  vid uuid;
  v private.acc_vouchers;
begin
  vid := private.acc_book(date '2026-09-15', 'Stripe sent', '[{"account":1580,"amount":10},{"account":3041,"amount":-10}]',
                          'S', 'stripe', 'txn_late', null, null, 'Stripe', true);
  select * into v from private.acc_vouchers where id = vid;
  perform tests.ok(v.date = date '2026-10-01', 'moved to 1 Oct, got ' || v.date);
  perform tests.ok(v.description like '%(avser 2026-09-15)', 'says the real date: ' || v.description);
  perform tests.ok(private.acc_book(date '2026-09-15', 'Stripe sent', '[{"account":1580,"amount":10},{"account":3041,"amount":-10}]',
                                    'S', 'stripe', 'txn_late', null, null, 'Stripe', true) = vid, 'same Stripe transaction books once');
end $$;

-- 2025: income without VAT and a private withdrawal, then the year is closed.
do $$ begin
  perform private.acc_book(date '2025-06-01', 'Ersättning', '[{"account":1930,"amount":500},{"account":3990,"amount":-500}]', 'A', 'manual');
  perform private.acc_book(date '2025-06-02', 'Eget uttag', '[{"account":2013,"amount":100},{"account":1930,"amount":-100}]', 'A', 'manual');
end $$;
set local role authenticated;
do $$
declare
  c jsonb;
begin
  perform tests.act_as(current_setting('t.admin')::uuid);
  begin
    perform public.acc_close_year(2026);
    perform tests.ok(false, 'a running year must not close');
  exception when raise_exception then perform tests.ok(sqlerrm = 'year_not_over', 'year_not_over'); end;
  c := public.acc_close_year(2025);
  perform tests.ok((c->>'result')::numeric = 500, 'result 500: ' || c::text);
  begin
    perform public.acc_create_voucher(date '2025-12-01', 'Efter bokslut', '[{"account":6110,"amount":10},{"account":1930,"amount":-10}]');
    perform tests.ok(false, 'a closed year must be locked');
  exception when raise_exception then perform tests.ok(sqlerrm = 'period_locked', 'closed year locked'); end;
end $$;

reset role;
do $$
declare bal numeric;
begin
  select sum(l.amount) into bal from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
   where v.year = 2025 and l.account between 3000 and 8999;
  perform tests.ok(bal = 0, 'result accounts closed against 8999');
  -- 1 Jan 2026: 2013 (100) and 2019 (-500) to equity: 2010 gets -400.
  select sum(l.amount) into bal from private.acc_lines l join private.acc_vouchers v on v.id = l.voucher_id
   where v.source = 'opening' and l.account = 2010;
  perform tests.ok(bal = -400, 'equity -400 on 1 Jan, got ' || bal);
end $$;
set local role authenticated;

-- Reports: balances and the SIE data.
do $$
declare
  b jsonb;
  s jsonb;
  bank numeric;
begin
  perform tests.act_as(current_setting('t.admin')::uuid);
  b := public.acc_balances(date '2026-01-01', date '2026-12-31');
  select (x->>'closing')::numeric into bank from jsonb_array_elements(b) x where (x->>'number')::int = 1930;
  -- 2025: +500 -100; 2026: +1250 -100 -125 -40 +40.
  perform tests.ok(bank = 1425, 'bank 1425, got ' || bank);
  select (x->>'opening')::numeric into bank from jsonb_array_elements(b) x where (x->>'number')::int = 1930;
  perform tests.ok(bank = 400, 'bank opens 2026 at 400, got ' || bank);
  s := public.acc_sie(2026);
  perform tests.ok(jsonb_array_length(s->'vouchers') = 8, 'SIE has the 8 vouchers of 2026, got ' || jsonb_array_length(s->'vouchers'));
  perform tests.ok((s->'opening'->>'1930')::numeric = 400, 'SIE opening balance');
end $$;

rollback;
