/**
 * Bookkeeping (bokföring) helpers for the admin page. Pure functions: VAT
 * templates that turn "an amount and what it was" into voucher lines, the
 * groupings of the income statement and balance sheet, the basis for the NE
 * appendix, and the SIE 4 export file. The database (supabase/migrations/
 * 20261114020000_bookkeeping.sql) keeps the vouchers and checks every rule.
 */

export interface VoucherLine {
  account: number;
  /** Kronor: debit positive, credit negative. */
  amount: number;
  vat_box?: string | null;
  note?: string;
}

export interface Account {
  number: number;
  name: string;
  vat_box: string | null;
  active: boolean;
  used?: boolean;
}

export interface Balance {
  number: number;
  name: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

export const r2 = (n: number) => Math.round(n * 100) / 100;

const krFormat = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 1 234,50 */
export const kr = (n: number) => krFormat.format(r2(n) === 0 ? 0 : r2(n));

/* ---------- VAT templates ---------- */

export type TemplateId =
  | "purchase25"
  | "purchase12"
  | "purchase6"
  | "purchase0"
  | "eu_service"
  | "non_eu_service"
  | "sale25"
  | "withdrawal"
  | "deposit"
  | "vat_payment"
  | "free";

export interface Template {
  id: TemplateId;
  label: string;
  hint: string;
  /** Which account the user picks: a cost, an income, or none (fixed accounts). */
  pick: "cost" | "income" | null;
  defaultAccount?: number;
  /** Where the money came from or went to. */
  payLabel: string;
  payDefault: number;
}

export const TEMPLATES: Template[] = [
  { id: "purchase25", label: "Inköp med 25 % moms", hint: "Det mesta: material, programvara, telefon, tjänster från svenska företag.", pick: "cost", defaultAccount: 6110, payLabel: "Betalt från", payDefault: 1930 },
  { id: "purchase12", label: "Inköp med 12 % moms", hint: "Till exempel hotell och livsmedel.", pick: "cost", defaultAccount: 5800, payLabel: "Betalt från", payDefault: 1930 },
  { id: "purchase6", label: "Inköp med 6 % moms", hint: "Till exempel resor med tåg eller buss, böcker och tidningar.", pick: "cost", defaultAccount: 5800, payLabel: "Betalt från", payDefault: 1930 },
  { id: "purchase0", label: "Inköp utan moms", hint: "Till exempel försäkring, bankavgifter, porto och föreningsavgifter.", pick: "cost", defaultAccount: 6570, payLabel: "Betalt från", payDefault: 1930 },
  { id: "eu_service", label: "Tjänst från företag i annat EU-land", hint: "Omvänd moms, till exempel Google, Meta, Netlify (EU) eller Stripe. Fakturan saknar svensk moms.", pick: "cost", defaultAccount: 5910, payLabel: "Betalt från", payDefault: 1930 },
  { id: "non_eu_service", label: "Tjänst från företag utanför EU", hint: "Omvänd moms, till exempel amerikanska tjänster som fakturerar från USA.", pick: "cost", defaultAccount: 6540, payLabel: "Betalt från", payDefault: 1930 },
  { id: "sale25", label: "Försäljning med 25 % moms", hint: "Försäljning som inte går via Stripe (Stripe bokförs automatiskt).", pick: "income", defaultAccount: 3041, payLabel: "Betalt till", payDefault: 1930 },
  { id: "withdrawal", label: "Eget uttag", hint: "Pengar du för över från företaget till dig själv.", pick: null, payLabel: "Från", payDefault: 1930 },
  { id: "deposit", label: "Egen insättning", hint: "Pengar du sätter in i företaget.", pick: null, payLabel: "Till", payDefault: 1930 },
  { id: "vat_payment", label: "Betalning av moms", hint: "När du betalar momsen till Skatteverket (eller får tillbaka).", pick: null, payLabel: "Betalt från", payDefault: 1930 },
  { id: "free", label: "Fri kontering", hint: "Skriv raderna själv: debet och kredit måste bli lika.", pick: null, payLabel: "", payDefault: 1930 },
];

export const PAY_ACCOUNTS: { number: number; label: string }[] = [
  { number: 1930, label: "Företagskontot (1930)" },
  { number: 2018, label: "Privat, jag betalade själv (2018)" },
  { number: 1580, label: "Stripe-saldot (1580)" },
  { number: 1630, label: "Skattekontot (1630)" },
  { number: 1910, label: "Kassa (1910)" },
];

/** VAT inside an amount that includes VAT at the rate (e.g. 25 → a fifth). */
export const vatIncluded = (gross: number, rate: number) => r2((gross * rate) / (100 + rate));

/**
 * The lines for a template. gross: the amount paid or received, VAT included
 * (a positive number; for vat_payment negative means money back).
 */
export function templateLines(id: TemplateId, gross: number, account: number, pay: number): VoucherLine[] {
  const g = r2(gross);
  if (!(Math.abs(g) > 0)) return [];
  const purchase = (rate: number): VoucherLine[] => {
    const vat = vatIncluded(g, rate);
    return [{ account, amount: r2(g - vat) }, ...(vat ? [{ account: 2641, amount: vat }] : []), { account: pay, amount: -g }];
  };
  const reverse = (box: string): VoucherLine[] => {
    const vat = r2(g * 0.25);
    return [
      { account, amount: g, vat_box: box },
      { account: 2645, amount: vat },
      { account: 2614, amount: -vat },
      { account: pay, amount: -g },
    ];
  };
  switch (id) {
    case "purchase25":
      return purchase(25);
    case "purchase12":
      return purchase(12);
    case "purchase6":
      return purchase(6);
    case "purchase0":
      return [{ account, amount: g }, { account: pay, amount: -g }];
    case "eu_service":
      return reverse("21");
    case "non_eu_service":
      return reverse("22");
    case "sale25": {
      const vat = vatIncluded(g, 25);
      return [{ account: pay, amount: g }, { account, amount: -r2(g - vat) }, { account: 2611, amount: -vat }];
    }
    case "withdrawal":
      return [{ account: 2013, amount: g }, { account: pay, amount: -g }];
    case "deposit":
      return [{ account: pay, amount: g }, { account: 2018, amount: -g }];
    case "vat_payment":
      return [{ account: 2650, amount: g }, { account: pay, amount: -g }];
    case "free":
      return [];
  }
}

export const lineSum = (lines: VoucherLine[]) => r2(lines.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : 0), 0));

/* ---------- Statements ---------- */

export interface Group {
  label: string;
  from: number;
  to: number;
}

export const RESULT_GROUPS: Group[] = [
  { label: "Nettoomsättning", from: 3000, to: 3799 },
  { label: "Övriga rörelseintäkter", from: 3800, to: 3999 },
  { label: "Varor, material och tjänster", from: 4000, to: 4999 },
  { label: "Övriga externa kostnader", from: 5000, to: 6999 },
  { label: "Personalkostnader", from: 7000, to: 7699 },
  { label: "Av- och nedskrivningar", from: 7700, to: 7899 },
  { label: "Övriga rörelsekostnader", from: 7900, to: 7999 },
  { label: "Finansiella poster", from: 8000, to: 8799 },
  { label: "Bokslutsdispositioner", from: 8800, to: 8899 },
  { label: "Skatter", from: 8900, to: 8989 },
];

export const ASSET_GROUPS: Group[] = [
  { label: "Anläggningstillgångar", from: 1000, to: 1399 },
  { label: "Varulager", from: 1400, to: 1499 },
  { label: "Kortfristiga fordringar", from: 1500, to: 1899 },
  { label: "Kassa och bank", from: 1900, to: 1999 },
];

export const EQUITY_GROUPS: Group[] = [
  { label: "Eget kapital", from: 2000, to: 2099 },
  { label: "Obeskattade reserver", from: 2100, to: 2199 },
  { label: "Avsättningar", from: 2200, to: 2299 },
  { label: "Långfristiga skulder", from: 2300, to: 2399 },
  { label: "Kortfristiga skulder", from: 2400, to: 2999 },
];

export interface GroupTotal {
  label: string;
  total: number;
  accounts: { number: number; name: string; amount: number }[];
}

/** Movement in the period (debit − credit) per group. */
function grouped(balances: Balance[], groups: Group[], value: (b: Balance) => number, sign: number): GroupTotal[] {
  return groups
    .map((g) => {
      const accounts = balances
        .filter((b) => b.number >= g.from && b.number <= g.to)
        .map((b) => ({ number: b.number, name: b.name, amount: r2(sign * value(b)) }))
        .filter((a) => a.amount !== 0);
      return { label: g.label, total: r2(accounts.reduce((s, a) => s + a.amount, 0)), accounts };
    })
    .filter((g) => g.accounts.length > 0);
}

/**
 * Income statement for a period: income positive, costs negative, and the
 * result (the closing entry on 8999 is left out).
 */
export function incomeStatement(balances: Balance[]): { groups: GroupTotal[]; result: number } {
  const groups = grouped(balances, RESULT_GROUPS, (b) => b.debit - b.credit, -1);
  return { groups, result: r2(groups.reduce((s, g) => s + g.total, 0)) };
}

/**
 * Balance sheet at the end of the period. If the year's result isn't booked
 * yet (year not closed), it is shown under equity so the sheet balances.
 */
export function balanceSheet(balances: Balance[], unbookedResult: number) {
  const assets = grouped(balances, ASSET_GROUPS, (b) => b.closing, 1);
  const equity = grouped(balances, EQUITY_GROUPS, (b) => b.closing, -1);
  if (unbookedResult !== 0) {
    const eq = equity.find((g) => g.label === "Eget kapital");
    const row = { number: 0, name: "Årets resultat (ej bokfört än)", amount: r2(unbookedResult) };
    if (eq) {
      eq.accounts.push(row);
      eq.total = r2(eq.total + row.amount);
    } else {
      equity.unshift({ label: "Eget kapital", total: row.amount, accounts: [row] });
    }
  }
  const totalAssets = r2(assets.reduce((s, g) => s + g.total, 0));
  const totalEquity = r2(equity.reduce((s, g) => s + g.total, 0));
  return { assets, equity, totalAssets, totalEquity };
}

/** Movement for a range of accounts in the period (debit − credit). */
const movement = (balances: Balance[], from: number, to: number) =>
  r2(balances.filter((b) => b.number >= from && b.number <= to).reduce((s, b) => s + b.debit - b.credit, 0));
const closingOf = (balances: Balance[], from: number, to: number) =>
  r2(balances.filter((b) => b.number >= from && b.number <= to).reduce((s, b) => s + b.closing, 0));

/**
 * Basis for the NE appendix (sole trader's tax return), from a full year's
 * balances. Income and costs as positive numbers. A basis to check, not a
 * finished return: tax adjustments come on top.
 */
export function neBasis(balances: Balance[]) {
  const R1 = -movement(balances, 3000, 3699);
  const R2 = -movement(balances, 3700, 3999);
  const R4 = -movement(balances, 8000, 8399);
  const R5 = movement(balances, 4000, 4999);
  const R6 = r2(movement(balances, 5000, 6999) + movement(balances, 7900, 7999));
  const R7 = movement(balances, 7000, 7699);
  const R8 = movement(balances, 8400, 8799);
  const R9 = movement(balances, 7820, 7829);
  const R10 = r2(movement(balances, 7700, 7819) + movement(balances, 7830, 7899));
  const R11 = r2(R1 + R2 + R4 - R5 - R6 - R7 - R8 - R9 - R10);
  const result = [
    { box: "R1", label: "Försäljning och utfört arbete samt varu- och tjänsteuttag (momspliktiga)", amount: R1 },
    { box: "R2", label: "Momsfria intäkter", amount: R2 },
    { box: "R3", label: "Bil- och bostadsförmån m.m.", amount: 0 },
    { box: "R4", label: "Ränteintäkter m.m.", amount: R4 },
    { box: "R5", label: "Varor, material och tjänster", amount: R5 },
    { box: "R6", label: "Övriga externa kostnader", amount: R6 },
    { box: "R7", label: "Anställd personal", amount: R7 },
    { box: "R8", label: "Räntekostnader m.m.", amount: R8 },
    { box: "R9", label: "Av- och nedskrivningar av byggnader och markanläggningar", amount: R9 },
    { box: "R10", label: "Av- och nedskrivningar av maskiner, inventarier och immateriella tillgångar", amount: R10 },
    { box: "R11", label: "Bokfört resultat", amount: R11 },
  ];
  const balance = [
    { label: "Immateriella anläggningstillgångar", amount: closingOf(balances, 1000, 1099) },
    { label: "Byggnader och markanläggningar", amount: closingOf(balances, 1100, 1199) },
    { label: "Maskiner och inventarier", amount: closingOf(balances, 1200, 1299) },
    { label: "Övriga anläggningstillgångar", amount: closingOf(balances, 1300, 1399) },
    { label: "Varulager", amount: closingOf(balances, 1400, 1499) },
    { label: "Kundfordringar", amount: closingOf(balances, 1500, 1599) },
    { label: "Övriga fordringar", amount: closingOf(balances, 1600, 1899) },
    { label: "Kassa och bank", amount: closingOf(balances, 1900, 1999) },
    { label: "Eget kapital", amount: -closingOf(balances, 2000, 2099) },
    { label: "Obeskattade reserver", amount: -closingOf(balances, 2100, 2199) },
    { label: "Avsättningar", amount: -closingOf(balances, 2200, 2299) },
    { label: "Låneskulder", amount: -closingOf(balances, 2300, 2399) },
    { label: "Skatteskulder", amount: -r2(closingOf(balances, 2500, 2599) + closingOf(balances, 2600, 2699)) },
    { label: "Leverantörsskulder", amount: -closingOf(balances, 2400, 2499) },
    { label: "Övriga skulder", amount: -r2(closingOf(balances, 2700, 2999)) },
  ];
  return { result, balance };
}

/* ---------- VAT return boxes ---------- */

export const VAT_BOXES: Record<string, string> = {
  "05": "Momspliktig försäljning som inte ingår i ruta 06, 07 eller 08",
  "06": "Momspliktiga uttag",
  "07": "Beskattningsunderlag vid vinstmarginalbeskattning",
  "08": "Hyresinkomster vid frivillig skattskyldighet",
  "10": "Utgående moms 25 %",
  "11": "Utgående moms 12 %",
  "12": "Utgående moms 6 %",
  "20": "Inköp av varor från ett annat EU-land",
  "21": "Inköp av tjänster från ett annat EU-land enligt huvudregeln",
  "22": "Inköp av tjänster från ett land utanför EU",
  "23": "Inköp av varor i Sverige som köparen är skattskyldig för",
  "24": "Övriga inköp av tjänster",
  "30": "Utgående moms 25 % på inköp i rutorna 20–24",
  "31": "Utgående moms 12 % på inköp i rutorna 20–24",
  "32": "Utgående moms 6 % på inköp i rutorna 20–24",
  "35": "Försäljning av varor till ett annat EU-land",
  "36": "Försäljning av varor utanför EU",
  "39": "Försäljning av tjänster till näringsidkare i ett annat EU-land",
  "40": "Övrig försäljning av tjänster omsatta utomlands",
  "41": "Försäljning när köparen är skattskyldig i Sverige",
  "42": "Övrig försäljning m.m.",
  "48": "Ingående moms att dra av",
  "49": "Moms att betala eller få tillbaka",
  "50": "Beskattningsunderlag vid import",
  "60": "Utgående moms 25 % på import",
  "61": "Utgående moms 12 % på import",
  "62": "Utgående moms 6 % på import",
};

/* ---------- Periods ---------- */

export function periodLabel(period: string): string {
  const q = /^(\d{4})-Q([1-4])$/.exec(period);
  if (q) return `Kvartal ${q[2]} ${q[1]} (${["jan–mar", "apr–jun", "jul–sep", "okt–dec"][Number(q[2]) - 1]})`;
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return `${new Intl.DateTimeFormat("sv-SE", { month: "long" }).format(new Date(Number(m[1]), Number(m[2]) - 1, 1))} ${m[1]}`;
  return `Helår ${period}`;
}

/* ---------- SIE 4 ---------- */

export interface SieData {
  year: number;
  accounts: { number: number; name: string }[];
  opening: Record<string, number>;
  closing: Record<string, number>;
  result: Record<string, number>;
  vouchers: { label: string; date: string; description: string; created_at: string; lines: { account: number; amount: number; note: string }[] }[];
}

const sieText = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n\t]+/g, " ")}"`;
const sieDate = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const sieAmount = (n: number) => r2(n).toFixed(2);

/** A 12-digit personal or org number (YYYYMMDD-NNNN) as the 10 digits SIE wants. */
export function sieOrgNumber(org: string): string {
  const digits = org.replace(/\D/g, "");
  const ten = digits.length === 12 ? digits.slice(2) : digits;
  return ten.length === 10 ? `${ten.slice(0, 6)}-${ten.slice(6)}` : org;
}

/** The SIE 4 file for a year, as text (encode with toCp437 before saving). */
export function sieFile(d: SieData, company: { name: string; orgNumber: string }, generated: string): string {
  const out: string[] = [
    "#FLAGGA 0",
    "#FORMAT PC8",
    "#SIETYP 4",
    `#PROGRAM ${sieText("Spazia bokföring")} 1.0`,
    `#GEN ${sieDate(generated)}`,
    `#FNAMN ${sieText(company.name)}`,
    `#ORGNR ${sieOrgNumber(company.orgNumber)}`,
    `#RAR 0 ${d.year}0101 ${d.year}1231`,
    "#KPTYP BAS2014",
    "#VALUTA SEK",
  ];
  for (const a of d.accounts) out.push(`#KONTO ${a.number} ${sieText(a.name)}`);
  const byNumber = (o: Record<string, number>) => Object.entries(o).sort(([a], [b]) => Number(a) - Number(b));
  for (const [acc, v] of byNumber(d.opening)) out.push(`#IB 0 ${acc} ${sieAmount(v)}`);
  for (const [acc, v] of byNumber(d.closing)) out.push(`#UB 0 ${acc} ${sieAmount(v)}`);
  for (const [acc, v] of byNumber(d.result)) out.push(`#RES 0 ${acc} ${sieAmount(v)}`);
  for (const v of d.vouchers) {
    const m = /^([A-Z])(\d+)$/.exec(v.label);
    if (!m) continue;
    out.push(`#VER ${m[1]} ${m[2]} ${sieDate(v.date)} ${sieText(v.description)} ${sieDate(v.created_at)}`);
    out.push("{");
    for (const l of v.lines) out.push(`   #TRANS ${l.account} {} ${sieAmount(l.amount)}${l.note ? ` "" ${sieText(l.note)}` : ""}`);
    out.push("}");
  }
  return out.join("\r\n") + "\r\n";
}

const CP437: Record<string, number> = {
  Ç: 0x80, ü: 0x81, é: 0x82, â: 0x83, ä: 0x84, à: 0x85, å: 0x86, ç: 0x87, ê: 0x88, ë: 0x89, è: 0x8a, ï: 0x8b, î: 0x8c, ì: 0x8d,
  Ä: 0x8e, Å: 0x8f, É: 0x90, æ: 0x91, Æ: 0x92, ô: 0x93, ö: 0x94, ò: 0x95, û: 0x96, ù: 0x97, ÿ: 0x98, Ö: 0x99, Ü: 0x9a, á: 0xa0,
  í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5,
};

/** Text → IBM PC 8-bit (code page 437), the encoding SIE files use. */
export function toCp437(text: string): Uint8Array<ArrayBuffer> {
  const chars = Array.from(text.replace(/[–—]/g, "-").replace(/[’‘]/g, "'").replace(/[”“]/g, '"').replace(/\u00a0/g, " "));
  const out = new Uint8Array(new ArrayBuffer(chars.length));
  chars.forEach((ch, i) => {
    const code = ch.charCodeAt(0);
    out[i] = code < 0x80 ? code : (CP437[ch] ?? 0x3f);
  });
  return out;
}
