import { assert, assertEquals } from "jsr:@std/assert@1";
import { ACCOUNTS, bookTxn, swedishDate, type BalanceTxn, type Booking, type Line } from "./bookkeeping.ts";

const NOW = Date.UTC(2026, 10, 14, 12) / 1000;
const opts = { reverseCharge: true, now: NOW };
const txn = (t: Partial<BalanceTxn>): BalanceTxn => ({
  id: "txn_1",
  type: "charge",
  amount: 0,
  fee: 0,
  fee_details: [],
  created: NOW - 3 * 86400,
  description: null,
  ...t,
});
const lines = (b: Booking): Line[] => {
  assert(b.kind === "book", `expected a voucher, got ${JSON.stringify(b)}`);
  return b.voucher.lines;
};
const on = (ls: Line[], account: number) => ls.filter((l) => l.account === account).reduce((s, l) => s + l.amount, 0);
const balanced = (ls: Line[]) => assertEquals(Math.round(ls.reduce((s, l) => s + l.amount * 100, 0)), 0);

Deno.test("card payment: host's share, Spazia's fees with VAT, Stripe's fee with reverse charge", () => {
  // The live test: 58 kr paid, the host gets 48 kr, Stripe took 1.69 kr.
  const ls = lines(bookTxn(txn({ amount: 5800, fee: 169 }), { amount: 58, host_amount: 48, label: "Förvaring" }, opts));
  balanced(ls);
  assertEquals(on(ls, ACCOUNTS.stripe), 58 - 1.69);
  assertEquals(on(ls, ACCOUNTS.hosts), -48);
  assertEquals(on(ls, ACCOUNTS.sales), -8);
  assertEquals(on(ls, ACCOUNTS.vatOut), -2);
  assertEquals(on(ls, ACCOUNTS.fees), 1.69);
  assertEquals(on(ls, ACCOUNTS.reverseIn), 0.42);
  assertEquals(on(ls, ACCOUNTS.reverseOut), -0.42);
  assertEquals(ls.find((l) => l.account === ACCOUNTS.fees)?.vat_box, "21");
});

Deno.test("card payment without reverse charge on Stripe's fee", () => {
  const ls = lines(bookTxn(txn({ amount: 5800, fee: 169 }), { amount: 58, host_amount: 48, label: "x" }, { ...opts, reverseCharge: false }));
  balanced(ls);
  assertEquals(on(ls, ACCOUNTS.reverseIn), 0);
  assertEquals(ls.find((l) => l.account === ACCOUNTS.fees)?.vat_box, undefined);
});

Deno.test("refund: everything reversed in the same shares", () => {
  const ls = lines(bookTxn(txn({ type: "refund", amount: -5800 }), { amount: 58, host_amount: 48, label: "Förvaring" }, opts));
  balanced(ls);
  assertEquals(on(ls, ACCOUNTS.stripe), -58);
  assertEquals(on(ls, ACCOUNTS.hosts), 48);
  assertEquals(on(ls, ACCOUNTS.sales), 8);
  assertEquals(on(ls, ACCOUNTS.vatOut), 2);
});

Deno.test("partial refund is split pro rata", () => {
  const ls = lines(bookTxn(txn({ type: "refund", amount: -2900 }), { amount: 58, host_amount: 48, label: "x" }, opts));
  balanced(ls);
  assertEquals(on(ls, ACCOUNTS.hosts), 24);
  assertEquals(on(ls, ACCOUNTS.sales) + on(ls, ACCOUNTS.vatOut), 5);
});

Deno.test("transfer to a host, its reversal, payout to the bank, Stripe's own fees", () => {
  let ls = lines(bookTxn(txn({ type: "transfer", amount: -4800 }), null, opts));
  assertEquals(on(ls, ACCOUNTS.hosts), 48);
  assertEquals(on(ls, ACCOUNTS.stripe), -48);
  ls = lines(bookTxn(txn({ type: "transfer_refund", amount: 4800 }), null, opts));
  assertEquals(on(ls, ACCOUNTS.hosts), -48);
  ls = lines(bookTxn(txn({ type: "payout", amount: -10000 }), null, opts));
  assertEquals(on(ls, ACCOUNTS.bank), 100);
  assertEquals(on(ls, ACCOUNTS.stripe), -100);
  ls = lines(bookTxn(txn({ type: "stripe_fee", amount: -400, description: "Billing" }), null, opts));
  balanced(ls);
  assertEquals(on(ls, ACCOUNTS.fees), 4);
  assertEquals(on(ls, ACCOUNTS.stripe), -4);
});

Deno.test("a payment not recorded yet waits a day, then goes to manual booking", () => {
  assertEquals(bookTxn(txn({ amount: 5800, created: NOW - 600 }), null, opts).kind, "wait");
  assertEquals(bookTxn(txn({ amount: 5800 }), null, opts), { kind: "manual", reason: "no_payment" });
  assertEquals(bookTxn(txn({ amount: 9900 }), { amount: 58, host_amount: 48, label: "x" }, opts), { kind: "manual", reason: "amount_mismatch" });
  assertEquals(bookTxn(txn({ type: "adjustment", amount: -1500 }), null, opts), { kind: "manual", reason: "type:adjustment" });
});

Deno.test("dates are Swedish", () => {
  // 23:30 UTC on 31 Dec is already 1 Jan in Sweden.
  assertEquals(swedishDate(Date.UTC(2026, 11, 31, 23, 30) / 1000), "2027-01-01");
});
