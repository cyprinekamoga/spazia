"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { kr, periodLabel, type Account } from "@/lib/app/bookkeeping";
import { formatMoment } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { Spinner } from "../../AppShell";
import { Accounts } from "./Accounts";
import { Reports } from "./Reports";
import { acc, DataTable, ErrorLine, Money, Note, errorText } from "./shared";
import { Vat, YearEnd } from "./VatYear";
import { VoucherForm, type Prefill } from "./VoucherForm";
import { Vouchers } from "./Vouchers";

/**
 * Bokföring: Spazia's own bookkeeping in the admin page (team only, Swedish).
 * Card payments through Stripe are booked automatically; everything else is
 * booked here with its receipt. See docs/bokforing.md.
 */

type View = "overview" | "vouchers" | "new" | "reports" | "vat" | "year" | "accounts";

interface Overview {
  year: number;
  method: string;
  vat_period: string;
  current_period: string;
  vouchers: number;
  income: number;
  costs: number;
  stripe_balance: number;
  bank: number;
  host_liability: number;
  vat_account: number;
  missing_attachments: number;
  unbooked: number;
  stripe_synced_at: string | null;
  closed: boolean;
}

interface Unbooked {
  txn_id: string;
  kind: string;
  amount: number;
  occurred_at: string;
  description: string;
  detail: { reason?: string; fee?: number; source?: string | null };
}

const KINDS: Record<string, string> = {
  charge: "Kortbetalning",
  payment: "Betalning",
  refund: "Återbetalning",
  payment_refund: "Återbetalning",
  adjustment: "Justering (t.ex. tvist)",
  transfer: "Överföring till värd",
  payout: "Utbetalning till banken",
  stripe_fee: "Stripe-avgift",
};

const REASONS: Record<string, string> = {
  no_payment: "hittar ingen bokning i Spazia som hör till betalningen",
  amount_mismatch: "beloppet stämmer inte med bokningen",
};

function reasonText(reason: string | undefined): string {
  if (!reason) return "";
  if (REASONS[reason]) return REASONS[reason];
  if (reason.startsWith("type:")) return "den här sortens transaktion bokförs inte automatiskt";
  return reason;
}

function OverviewView({ year, onBook, onGo }: { year: number; onBook: (p: Prefill) => void; onGo: (v: View) => void }) {
  const o = useLoad(() => acc<Overview>("acc_overview", { p_year: year }), `acc-overview-${year}`);
  const u = useLoad(() => acc<Unbooked[]>("acc_unbooked"), `acc-unbooked-${year}`);
  const [error, setError] = useState<string | null>(null);
  if (o.loading) return <Spinner />;
  if (!o.data) return <ErrorLine text={o.error ? errorText(new Error(o.error)) : "Något gick fel."} />;
  const d = o.data;
  const cards: [string, number][] = [
    ["Intäkter", d.income],
    ["Kostnader", -d.costs],
    ["Resultat hittills", d.income - d.costs],
    ["Företagskontot (1930)", d.bank],
    ["Stripe-saldot (1580)", d.stripe_balance],
    ["Skuld till värdar (2890)", d.host_liability],
  ];

  async function dismiss(t: Unbooked) {
    const note = window.prompt("Varför behöver den inte bokföras? (sparas)", "");
    if (note === null) return;
    try {
      await acc("acc_resolve_unbooked", { p_txn: t.txn_id, p_voucher: null, p_note: note });
      await u.reload();
      await o.reload();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-[0.95rem] text-ink">
        Enskild firma · kalenderår · {d.method === "kontant" ? "kontantmetoden" : d.method} · moms per {d.vat_period === "quarter" ? "kvartal" : d.vat_period === "month" ? "månad" : "år"} · nu: {periodLabel(d.current_period)}
        {d.closed ? " · året är stängt" : ""}
      </p>
      <dl className="grid gap-3 sm:grid-cols-3">
        {cards.map(([k, v]) => (
          <div key={k} className="card p-4">
            <dt className="text-sm font-semibold text-muted">{k}</dt>
            <dd className="mt-1 text-xl font-bold text-night">
              <Money value={v} /> kr
            </dd>
          </div>
        ))}
      </dl>
      {d.vat_account !== 0 && (
        <Note tone="warn">
          Redovisad moms som inte är betald än (2650): {kr(d.vat_account)} kr. Bokför betalningen med mallen ”Betalning av moms” när den är gjord.
        </Note>
      )}
      {d.missing_attachments > 0 && (
        <Note tone="warn">
          {d.missing_attachments} {d.missing_attachments === 1 ? "verifikation saknar" : "verifikationer saknar"} underlag.{" "}
          <button type="button" className="font-semibold underline" onClick={() => onGo("vouchers")}>
            Visa verifikationerna
          </button>
        </Note>
      )}
      <p className="text-sm text-muted">
        Stripe bokförs automatiskt varje timme{d.stripe_synced_at ? `, senast ${formatMoment(d.stripe_synced_at)}` : " (inte körd än)"}. {d.vouchers} verifikationer {year}.
      </p>

      <section className="space-y-2">
        <h3 className="text-xl font-bold text-night">Att bokföra</h3>
        {u.loading ? (
          <Spinner />
        ) : (u.data ?? []).length === 0 ? (
          <p className="text-[0.95rem] text-muted">Inget som väntar. Alla Stripe-transaktioner är bokförda.</p>
        ) : (
          <>
            <p className="text-[0.95rem] text-muted">Stripe-transaktioner som inte kunde bokföras automatiskt. Bokför dem för hand (Stripe-saldot 1580 är förifyllt) eller markera dem som hanterade.</p>
            <DataTable
              head={["Datum", "Vad", "Belopp", "Varför", ""]}
              align={["left", "left", "right", "left", "left"]}
              rows={(u.data ?? []).map((t) => [
                t.occurred_at.slice(0, 10),
                <span key="k">
                  {KINDS[t.kind] ?? t.kind}
                  <span className="block text-xs text-muted">{t.txn_id}</span>
                </span>,
                <Money key="m" value={t.amount} />,
                <span key="r" className="text-muted">
                  {reasonText(t.detail.reason)}
                </span>,
                <span key="a" className="flex flex-wrap gap-2">
                  <button type="button" className="text-sm font-semibold text-brand underline-offset-4 hover:underline" onClick={() => onBook({ date: t.occurred_at.slice(0, 10), description: `${KINDS[t.kind] ?? t.kind} (Stripe ${t.txn_id})`, amount: t.amount, unbookedTxn: t.txn_id })}>
                    Bokför
                  </button>
                  <button type="button" className="text-sm font-semibold text-muted underline-offset-4 hover:underline" onClick={() => dismiss(t)}>
                    Hanterad
                  </button>
                </span>,
              ])}
            />
          </>
        )}
      </section>
      <ErrorLine text={error} />
      <button
        type="button"
        onClick={() => {
          void o.reload();
          void u.reload();
        }}
        className="btn btn-secondary"
      >
        <RefreshCw size={16} aria-hidden="true" />
        Uppdatera
      </button>
    </div>
  );
}

export function Bookkeeping() {
  const thisYear = Number(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric" }).format(new Date()));
  const [year, setYear] = useState(thisYear);
  const [view, setView] = useState<View>("overview");
  const [openId, setOpenId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Prefill | undefined>(undefined);
  const [saved, setSaved] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const accounts = useLoad(() => acc<Account[]>("acc_accounts"), "acc-accounts");
  const years = useLoad(() => acc<{ year: number; closed_at: string | null }[]>("acc_years"), `acc-years-${formKey}`);

  const yearList = Array.from(new Set([thisYear, ...(years.data ?? []).map((y) => y.year)])).sort((a, b) => b - a);
  const closed = Boolean((years.data ?? []).find((y) => y.year === year)?.closed_at);

  const views: [View, string][] = [
    ["overview", "Översikt"],
    ["vouchers", "Verifikationer"],
    ["new", "Ny verifikation"],
    ["reports", "Rapporter"],
    ["vat", "Moms"],
    ["year", "Bokslut och export"],
    ["accounts", "Kontoplan"],
  ];

  function go(v: View) {
    setView(v);
    setSaved(null);
    if (v !== "vouchers") setOpenId(null);
    if (v === "new") {
      setPrefill(undefined);
      setFormKey((k) => k + 1);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="acc-year" className="text-[0.95rem] font-semibold text-night">
          Räkenskapsår
        </label>
        <select id="acc-year" className="field-input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {yearList.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <nav aria-label="Bokföring" className="-mx-4 overflow-x-auto px-4 print:hidden">
        <ul className="flex gap-1">
          {views.map(([id, label]) => (
            <li key={id}>
              <button type="button" onClick={() => go(id)} aria-current={view === id ? "page" : undefined} className="flex min-h-11 items-center rounded-full border border-line px-3.5 text-[0.95rem] font-semibold whitespace-nowrap text-muted hover:bg-frost hover:text-night aria-[current=page]:bg-night aria-[current=page]:text-white">
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {accounts.loading ? (
        <Spinner />
      ) : (
        <div>
          {view === "overview" && (
            <OverviewView
              year={year}
              onGo={go}
              onBook={(p) => {
                setPrefill(p);
                setFormKey((k) => k + 1);
                setView("new");
              }}
            />
          )}
          {view === "vouchers" && <Vouchers year={year} openId={openId} onOpen={setOpenId} />}
          {view === "new" && (
            <div className="space-y-3">
              {saved && <Note tone="good">{saved}</Note>}
              <VoucherForm
                key={formKey}
                accounts={accounts.data ?? []}
                prefill={prefill}
                onSaved={(label, id) => {
                  setSaved(`Bokförd som ${label}.`);
                  setPrefill(undefined);
                  setFormKey((k) => k + 1);
                  setOpenId(id);
                }}
              />
            </div>
          )}
          {view === "reports" && <Reports year={year} closed={closed} />}
          {view === "vat" && <Vat year={year} />}
          {view === "year" && <YearEnd year={year} closed={closed} onChanged={() => setFormKey((k) => k + 1)} />}
          {view === "accounts" && <Accounts accounts={accounts.data ?? []} onChanged={accounts.reload} />}
        </div>
      )}
    </div>
  );
}
