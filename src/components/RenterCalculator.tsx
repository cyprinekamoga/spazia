"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Dictionary } from "@/content";
import { categories, type CategoryId } from "@/content/categories";
import { marketPrices, tyreSeasons } from "@/content/market-prices";
import { renterPrice, roundForDisplay } from "@/content/pricing";
import { fill, formatNumber, type Lang } from "@/lib/i18n";
import { categoryIcons } from "./Icons";

type Counts = Record<CategoryId, number>;

const empty: Counts = { tyres: 0, skis: 0, snowmobile: 0, bikes: 0, boxes: 0, car: 0, parking: 0 };
const periods = [1, 3, 6, 12] as const;
type Period = (typeof periods)[number];

/** How many units a renter can pick per category. */
const renterMax: Counts = { tyres: 4, skis: 6, snowmobile: 2, bikes: 6, boxes: 20, car: 2, parking: 2 };

/**
 * Renter price estimate with a comparison against tyre hotels and storage
 * companies (where there are prices to compare with).
 */
export function RenterCalculator({
  lang,
  t,
  formHref,
  initial = { tyres: 1 },
  initialMonths = 6,
}: {
  lang: Lang;
  t: Dictionary;
  formHref: string;
  initial?: Partial<Counts>;
  initialMonths?: Period;
}) {
  const [counts, setCounts] = useState<Counts>({ ...empty, ...initial });
  const [months, setMonths] = useState<Period>(initialMonths);
  const [heated, setHeated] = useState(false);
  const c = t.renterCalc;
  const kr = (n: number) => formatNumber(n, lang);
  const monthsText = (n: number) => (n === 1 ? c.monthsWord.one : c.monthsWord.other);

  const priceOf = (id: CategoryId) => {
    const cat = categories.find((x) => x.id === id)!;
    return renterPrice(cat.price, heated, cat.heatedMatters);
  };

  const monthly = useMemo(
    () => roundForDisplay(categories.reduce((sum, cat) => sum + renterPrice(cat.price, heated, cat.heatedMatters) * counts[cat.id], 0)),
    [counts, heated],
  );

  const change = (id: CategoryId, delta: number) =>
    setCounts((prev) => ({ ...prev, [id]: Math.min(renterMax[id], Math.max(0, prev[id] + delta)) }));

  const tyres = counts.tyres;
  const seasons = tyreSeasons(months);
  const m2 = counts.boxes;
  const tyreCategory = categories.find((x) => x.id === "tyres")!;
  const others = (["skis", "snowmobile", "bikes", "car", "parking"] as CategoryId[]).some((id) => counts[id] > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <div className="card p-4 sm:p-6">
        <ul className="divide-y divide-line">
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.id];
            const n = counts[cat.id];
            return (
              <li key={cat.id} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-night">{cat.name[lang]}</span>
                    <span className="block text-sm text-muted">
                      {kr(priceOf(cat.id))} {t.common.perMonth} / {cat.unit[lang]}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => change(cat.id, -1)}
                    disabled={n === 0}
                    aria-label={fill(t.calculator.decrease, { unit: cat.unitPlural[lang] })}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-night transition-colors hover:border-night disabled:opacity-35 disabled:hover:border-line"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <output aria-live="polite" className="w-8 text-center text-lg font-semibold tabular-nums">
                    {n}
                  </output>
                  <button
                    type="button"
                    onClick={() => change(cat.id, 1)}
                    disabled={n >= renterMax[cat.id]}
                    aria-label={fill(t.calculator.increase, { unit: cat.unitPlural[lang] })}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-night transition-colors hover:border-night disabled:opacity-35 disabled:hover:border-line"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-muted">{c.periodLabel}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {periods.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={months === p}
                onClick={() => setMonths(p)}
                className="min-h-10 rounded-full border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-night/40 aria-pressed:border-night aria-pressed:bg-night aria-pressed:text-white"
              >
                {c.periods[String(p) as keyof typeof c.periods]}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-frost/50 p-4">
          <input
            type="checkbox"
            checked={heated}
            onChange={(e) => setHeated(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-[#2f6b75]"
          />
          <span>
            <span className="block font-semibold text-night">{c.heatedLabel}</span>
            <span className="block text-sm text-muted">{c.heatedHint}</span>
          </span>
        </label>
      </div>

      <div className="relative overflow-hidden rounded-[1.25rem] bg-night p-6 text-white sm:p-8 lg:sticky lg:top-24 lg:self-start">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-brand-bright/30 blur-3xl" />
        <div className="relative" aria-live="polite">
          <p className="text-frost-2">{c.resultLabel}</p>
          {monthly > 0 ? (
            <>
              <p className="font-display mt-1 text-5xl font-bold tracking-tight text-glow tabular-nums sm:text-6xl">
                {kr(monthly)}
                <span className="ml-2 text-xl font-semibold text-white">{c.perMonth}</span>
              </p>
              <p className="mt-2 text-lg text-frost">
                {fill(c.total, { amount: kr(monthly * months), months, monthsWord: monthsText(months) })}
              </p>

              {(tyres > 0 || m2 > 0) && (
                <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
                  <p className="text-sm font-semibold text-frost">{c.compareTitle}</p>
                  {tyres > 0 && (
                    <CompareBlock
                      title={`${fill(c.tyresRow, {
                        count: tyres,
                        unit: tyres === 1 ? tyreCategory.unit[lang] : tyreCategory.unitPlural[lang],
                      })}, ${fill(seasons === 1 ? c.tyreSeasons : c.tyreSeasonsPlural, { seasons })}`}
                      rows={[
                        [c.spaziaTyres, `${kr(priceOf("tyres") * tyres * months)} kr`, true],
                        [
                          c.tyreHotel,
                          `${kr(marketPrices.tyreHotel.min * tyres * seasons)}–${kr(marketPrices.tyreHotel.max * tyres * seasons)} kr`,
                          false,
                        ],
                      ]}
                    />
                  )}
                  {m2 > 0 && (
                    <CompareBlock
                      title={`${fill(c.storageRow, { count: m2 })}, ${months} ${monthsText(months)}`}
                      rows={[
                        [heated ? c.spaziaStorageHeated : c.spaziaStorage, `${kr(roundForDisplay(priceOf("boxes") * m2 * months))} kr`, true],
                        [
                          c.storageCompany,
                          `${kr(marketPrices.selfStorage.minPerM2 * m2 * months)}–${kr(marketPrices.selfStorage.maxPerM2 * m2 * months)} kr`,
                          false,
                        ],
                      ]}
                      note={heated ? undefined : c.heatedCompareNote}
                    />
                  )}
                </div>
              )}
              {others && <p className="mt-4 text-sm leading-relaxed text-frost-2">{c.noCompare}</p>}
            </>
          ) : (
            <p className="mt-2 text-lg text-frost">{c.empty}</p>
          )}

          <Link prefetch={false} href={formHref} className="btn btn-primary mt-6 w-full">
            {c.cta}
          </Link>

          {(tyres > 0 || m2 > 0) && (
            <div className="mt-5 text-xs leading-relaxed text-frost-2">
              <p>{fill(c.sourcesLabel, { checked: marketPrices.checked[lang] })}</p>
              <ul className="mt-1 space-y-0.5">
                {[...(tyres > 0 ? marketPrices.tyreHotel.sources : []), ...(m2 > 0 ? marketPrices.selfStorage.sources : [])].map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-2 hover:decoration-white">
                      {s.name}
                    </a>
                    : {s.note[lang]}
                  </li>
                ))}
              </ul>
              <p className="mt-1">{c.sourcesNote}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareBlock({ title, rows, note }: { title: string; rows: [string, string, boolean][]; note?: string }) {
  return (
    <div>
      <p className="text-sm text-frost-2">{title}</p>
      <dl className="mt-1.5 space-y-1">
        {rows.map(([label, value, ours]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className={ours ? "font-semibold text-white" : "text-frost"}>{label}</dt>
            <dd className={`shrink-0 tabular-nums ${ours ? "font-bold text-glow" : "text-frost"}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-1.5 text-xs leading-relaxed text-frost-2">{note}</p>}
    </div>
  );
}
