"use client";

import { Download, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { appText } from "@/content/app";
import { appLocale } from "@/lib/app/lang";
import { formatKr } from "@/lib/app/model";
import { fetchHostEarnings, type Earning } from "@/lib/app/payments";
import { useLoad } from "@/lib/app/session";
import { fill } from "@/lib/i18n";

const t = appText.payments;
const TZ = "Europe/Stockholm";

/** One money movement: a transfer to the host, or a refund taken back from them. */
interface Entry {
  at: string;
  amount: number;
  reversal: boolean;
  earning: Earning;
}

const yearOf = (iso: string) => Number(new Intl.DateTimeFormat("en", { timeZone: TZ, year: "numeric" }).format(new Date(iso)));
const monthOf = (iso: string) => Number(new Intl.DateTimeFormat("en", { timeZone: TZ, month: "numeric" }).format(new Date(iso))) - 1;
const isoDay = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date(iso));

function entriesOf(earnings: Earning[]): Entry[] {
  const out: Entry[] = [];
  for (const e of earnings) {
    out.push({ at: e.transferred_at, amount: e.host_amount, reversal: false, earning: e });
    // A refund after the payout takes the host's part back (a transfer reversal).
    if (e.refunded_at) out.push({ at: e.refunded_at, amount: -e.host_amount, reversal: true, earning: e });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

function csv(year: number, entries: Entry[], total: number): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: (string | number)[][] = [
    [t.csvDate, t.csvType, t.csvListing, t.csvPeriod, t.csvAmount],
    ...entries.map((e) => [
      isoDay(e.at),
      e.reversal ? t.csvReversal : t.csvTransfer,
      e.earning.listing_title,
      `${e.earning.period_start} – ${e.earning.period_end}`,
      e.amount,
    ]),
    [t.csvTotal, "", "", String(year), total],
  ];
  // Semicolons and a BOM, so Excel set to Swedish opens it in columns with å, ä and ö intact.
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

/** The host's rental income per year, for the tax return. */
export function YearSummary({ uid }: { uid: string }) {
  const { data } = useLoad(() => fetchHostEarnings(uid), uid);
  const entries = useMemo(() => entriesOf(data ?? []), [data]);
  const years = useMemo(() => {
    const found = new Set(entries.map((e) => yearOf(e.at)));
    found.add(yearOf(new Date().toISOString()));
    return [...found].sort((a, b) => b - a);
  }, [entries]);
  const [picked, setPicked] = useState<number | null>(null);
  const year = picked ?? years[0];

  if (!data || data.length === 0) return null;

  const inYear = entries.filter((e) => yearOf(e.at) === year);
  const total = inYear.reduce((sum, e) => sum + e.amount, 0);
  const reversed = -inYear.filter((e) => e.reversal).reduce((sum, e) => sum + e.amount, 0);
  const payments = inYear.filter((e) => !e.reversal).length;
  const rentals = new Set(inYear.filter((e) => !e.reversal).map((e) => e.earning.request_id)).size;
  const months = Array.from({ length: 12 }, (_, m) => inYear.filter((e) => monthOf(e.at) === m).reduce((sum, e) => sum + e.amount, 0));
  const monthName = (m: number) => new Intl.DateTimeFormat(appLocale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, m, 15)));

  function download() {
    const blob = new Blob([csv(year, inYear, total)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fill(t.csvFile, { year: String(year) });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="card p-5" aria-labelledby="year-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="year-title" className="text-xl font-bold text-night">
          {t.yearTitle}
        </h2>
        {years.length > 1 && (
          <select aria-label={t.yearLabel} value={year} onChange={(e) => setPicked(Number(e.target.value))} className="field-input !w-auto !py-1.5">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="mt-1 leading-relaxed text-muted">{t.yearLead}</p>

      {inYear.length === 0 ? (
        <p className="mt-3 text-ink">{fill(t.yearNone, { year: String(year) })}</p>
      ) : (
        <>
          <div className="mt-4 rounded-2xl bg-brand-soft p-4">
            <p className="text-sm font-semibold text-muted">{fill(t.yearTotal, { year: String(year) })}</p>
            <p className="mt-0.5 text-[2rem] font-bold leading-tight text-night">{formatKr(total)} kr</p>
            <p className="mt-1 text-sm text-muted">{fill(t.yearCounts, { payments: String(payments), rentals: String(rentals) })}</p>
            {reversed > 0 && (
              <p className="mt-1 text-sm text-muted">
                {t.yearReversed}: −{formatKr(reversed)} kr
              </p>
            )}
          </div>
          <h3 className="mt-4 font-bold text-night">{t.yearMonths}</h3>
          <ul className="mt-1 divide-y divide-line">
            {months.map((amount, m) =>
              amount === 0 && !inYear.some((e) => monthOf(e.at) === m) ? null : (
                <li key={m} className="flex items-center justify-between gap-3 py-2">
                  <span className="capitalize text-ink">{monthName(m)}</span>
                  <span className="font-semibold text-night">{formatKr(amount)} kr</span>
                </li>
              ),
            )}
          </ul>
          <button type="button" onClick={download} className="btn btn-secondary mt-4">
            <Download size={18} aria-hidden="true" />
            {t.yearDownload}
          </button>
        </>
      )}
      <p className="mt-4 text-sm leading-relaxed text-muted">{t.yearTax}</p>
      <a href={t.yearGuideUrl} target="_blank" rel="noopener" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand underline-offset-4 hover:underline">
        {t.yearGuide}
        <ExternalLink size={15} aria-hidden="true" />
      </a>
    </section>
  );
}
