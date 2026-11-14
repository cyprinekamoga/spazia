/**
 * Automatic bookkeeping of Stripe's balance transactions (the money that moves
 * through Spazia's Stripe balance). Pure: builds the voucher for one
 * transaction, so it can be tested without Stripe or the database. The worker
 * books it with private.acc_book (series S).
 *
 * How a card payment is booked (kontantmetoden, Spazia acts in the host's name):
 *   1580 Stripe-saldo         + what the renter paid
 *   2890 Skuld till värdar    - the host's share (paid out after the period)
 *   3041 Försäljning tjänster - Spazia's fees without VAT (renter's fee, host's
 *                               fee and Spazia Skydd), VAT return box 05
 *   2611 Utgående moms 25 %   - the VAT in Spazia's fees (box 10)
 * Stripe's own fee is a bank cost (6570), booked as a service bought from
 * another EU country with reverse charge (boxes 21, 30, 48) unless the setting
 * acc_stripe_fee_reverse_charge is 'false'.
 */

export const ACCOUNTS = {
  stripe: 1580,
  bank: 1930,
  hosts: 2890,
  sales: 3041,
  vatOut: 2611,
  vatIn: 2641,
  reverseOut: 2614,
  reverseIn: 2645,
  fees: 6570,
} as const;

export interface BalanceTxn {
  id: string;
  type: string;
  /** Öre, signed: money into Spazia's balance is positive. */
  amount: number;
  /** Stripe's fee on this transaction, öre (positive). */
  fee: number;
  fee_details: { type: string; amount: number }[];
  /** Unix seconds. */
  created: number;
  description: string | null;
}

/** The Spazia payment behind a charge or refund (kronor, VAT included). */
export interface PaymentSplit {
  amount: number;
  host_amount: number;
  label: string;
}

export interface Line {
  account: number;
  /** Kronor, debit positive, credit negative. */
  amount: number;
  vat_box?: string;
  note?: string;
}

export interface VoucherDraft {
  date: string;
  description: string;
  lines: Line[];
}

export type Booking = { kind: "book"; voucher: VoucherDraft } | { kind: "wait" } | { kind: "manual"; reason: string };

const CHARGES = new Set(["charge", "payment"]);
const REFUNDS = new Set(["refund", "payment_refund"]);
const FEES = new Set(["stripe_fee", "stripe_fx_fee", "tax_fee"]);

/** The date in Sweden, as YYYY-MM-DD. */
export function swedishDate(unix: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(unix * 1000));
}

/** Lines in öre → kronor, dropping zero lines. */
function toKronor(lines: { account: number; ore: number; vat_box?: string; note?: string }[]): Line[] {
  return lines
    .filter((l) => l.ore !== 0)
    .map((l) => ({ account: l.account, amount: l.ore / 100, ...(l.vat_box ? { vat_box: l.vat_box } : {}), ...(l.note ? { note: l.note } : {}) }));
}

/** VAT inside an amount that includes 25 % VAT. */
const vatIn25 = (ore: number) => Math.round(ore / 5);

/** Stripe's fee: a cost paid out of the Stripe balance (öre lines). */
function feeLines(feeOre: number, taxOre: number, reverseCharge: boolean) {
  if (feeOre <= 0) return [];
  const net = feeOre - taxOre;
  const reverse = reverseCharge ? Math.round(net / 4) : 0;
  return [
    { account: ACCOUNTS.fees, ore: net, vat_box: reverseCharge ? "21" : undefined, note: "Stripes avgift" },
    { account: ACCOUNTS.vatIn, ore: taxOre },
    { account: ACCOUNTS.reverseIn, ore: reverse },
    { account: ACCOUNTS.reverseOut, ore: -reverse },
    { account: ACCOUNTS.stripe, ore: -feeOre },
  ];
}

function feeOf(t: BalanceTxn): { fee: number; tax: number } {
  const tax = t.fee_details.filter((d) => d.type === "tax").reduce((s, d) => s + d.amount, 0);
  return { fee: t.fee, tax };
}

/**
 * The voucher for one balance transaction, or: wait (the payment it belongs to
 * isn't recorded yet), or manual (book it by hand, with the reason).
 */
export function bookTxn(t: BalanceTxn, split: PaymentSplit | null, opts: { reverseCharge: boolean; now: number }): Booking {
  const date = swedishDate(t.created);
  const recent = opts.now - t.created < 24 * 3600;
  const { fee, tax } = feeOf(t);
  const book = (description: string, lines: { account: number; ore: number; vat_box?: string; note?: string }[]): Booking => {
    const sum = lines.reduce((s, l) => s + l.ore, 0);
    if (sum !== 0) return { kind: "manual", reason: `unbalanced:${sum}` };
    return { kind: "book", voucher: { date, description: description.slice(0, 280), lines: toKronor(lines) } };
  };

  if (CHARGES.has(t.type)) {
    if (!split) return recent ? { kind: "wait" } : { kind: "manual", reason: "no_payment" };
    const gross = t.amount;
    if (Math.abs(gross - Math.round(split.amount * 100)) > 100) return { kind: "manual", reason: "amount_mismatch" };
    const host = Math.min(Math.round(split.host_amount * 100), gross);
    const spazia = gross - host;
    const vat = vatIn25(spazia);
    return book(`Kortbetalning: ${split.label}`, [
      { account: ACCOUNTS.stripe, ore: gross },
      { account: ACCOUNTS.hosts, ore: -host, note: "Värdens del" },
      { account: ACCOUNTS.sales, ore: -(spazia - vat), note: "Spazias avgifter" },
      { account: ACCOUNTS.vatOut, ore: -vat },
      ...feeLines(fee, tax, opts.reverseCharge),
    ]);
  }

  if (REFUNDS.has(t.type)) {
    if (!split) return recent ? { kind: "wait" } : { kind: "manual", reason: "no_payment" };
    const refunded = -t.amount;
    const total = Math.round(split.amount * 100);
    if (refunded <= 0 || total <= 0 || refunded > total + 100) return { kind: "manual", reason: "amount_mismatch" };
    const host = Math.min(Math.round((Math.round(split.host_amount * 100) * refunded) / total), refunded);
    const spazia = refunded - host;
    const vat = vatIn25(spazia);
    return book(`Återbetalning: ${split.label}`, [
      { account: ACCOUNTS.hosts, ore: host, note: "Värdens del" },
      { account: ACCOUNTS.sales, ore: spazia - vat, note: "Spazias avgifter" },
      { account: ACCOUNTS.vatOut, ore: vat },
      { account: ACCOUNTS.stripe, ore: -refunded },
      ...feeLines(fee, tax, opts.reverseCharge),
    ]);
  }

  if (t.type === "transfer" && t.amount < 0) {
    return book("Överföring till värd", [
      { account: ACCOUNTS.hosts, ore: -t.amount },
      { account: ACCOUNTS.stripe, ore: t.amount },
    ]);
  }
  if (["transfer_cancel", "transfer_failure", "transfer_refund"].includes(t.type) && t.amount > 0) {
    return book("Överföring till värd tillbaka", [
      { account: ACCOUNTS.stripe, ore: t.amount },
      { account: ACCOUNTS.hosts, ore: -t.amount },
    ]);
  }
  if (t.type === "payout" && t.amount < 0) {
    return book("Utbetalning från Stripe till företagskontot", [
      { account: ACCOUNTS.bank, ore: -t.amount },
      { account: ACCOUNTS.stripe, ore: t.amount },
    ]);
  }
  if (["payout_cancel", "payout_failure"].includes(t.type) && t.amount > 0) {
    return book("Utbetalning från Stripe stoppad", [
      { account: ACCOUNTS.stripe, ore: t.amount },
      { account: ACCOUNTS.bank, ore: -t.amount },
    ]);
  }
  if (FEES.has(t.type) && t.amount < 0) {
    const lines = feeLines(-t.amount, tax, opts.reverseCharge);
    return book(`Stripe-avgift: ${t.description ?? t.type}`, lines);
  }
  return { kind: "manual", reason: `type:${t.type}` };
}
