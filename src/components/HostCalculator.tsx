"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Dictionary } from "@/content";
import { categories, type CategoryId } from "@/content/categories";
import { hostPayout, renterPrice, roundForDisplay } from "@/content/pricing";
import { fill, formatNumber, type Lang } from "@/lib/i18n";
import { categoryIcons } from "./Icons";
import { publishEstimate } from "./MobileActionBar";

type Counts = Record<CategoryId, number>;

const empty: Counts = { tyres: 0, skis: 0, snowmobile: 0, bikes: 0, boxes: 0, car: 0, parking: 0 };

const presets: { key: keyof Dictionary["calculator"]["presets"]; counts: Partial<Counts>; heated?: boolean }[] = [
  { key: "corner", counts: { tyres: 6, bikes: 2 } },
  { key: "halfDouble", counts: { tyres: 10, skis: 4, snowmobile: 1 } },
  { key: "carSpace", counts: { car: 1 }, heated: true },
  { key: "basement", counts: { boxes: 6 }, heated: true },
  { key: "driveway", counts: { parking: 2 } },
];

export function HostCalculator({ lang, t, formHref }: { lang: Lang; t: Dictionary; formHref: string }) {
  const [counts, setCounts] = useState<Counts>({ ...empty, ...presets[1].counts });
  const [heated, setHeated] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>("halfDouble");

  const { hostTotal, renterTotal } = useMemo(() => {
    let host = 0;
    let renter = 0;
    for (const c of categories) {
      const price = renterPrice(c.price, heated, c.heatedMatters);
      renter += price * counts[c.id];
      host += hostPayout(price) * counts[c.id];
    }
    return { hostTotal: roundForDisplay(host), renterTotal: roundForDisplay(renter) };
  }, [counts, heated]);

  // Share the estimate with the sticky action bar on phones.
  useEffect(() => {
    publishEstimate(hostTotal > 0 ? formatNumber(hostTotal, lang) : null);
  }, [hostTotal, lang]);

  const change = (id: CategoryId, delta: number, max: number) => {
    setActivePreset(null);
    setCounts((prev) => ({ ...prev, [id]: Math.min(max, Math.max(0, prev[id] + delta)) }));
  };

  const applyPreset = (p: (typeof presets)[number]) => {
    setCounts({ ...empty, ...p.counts });
    setHeated(Boolean(p.heated));
    setActivePreset(p.key);
  };

  const c = t.calculator;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <div className="card p-4 sm:p-6">
        <p className="text-sm font-semibold text-muted">{c.presetsLabel}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={activePreset === p.key}
              onClick={() => applyPreset(p)}
              className="min-h-10 rounded-full border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-night/40 aria-pressed:border-night aria-pressed:bg-night aria-pressed:text-white"
            >
              {c.presets[p.key]}
            </button>
          ))}
        </div>

        <ul className="mt-6 divide-y divide-line">
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.id];
            const n = counts[cat.id];
            const unitLabel = cat.unitPlural[lang];
            return (
              <li key={cat.id} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-night">{cat.name[lang]}</span>
                    <span className="block text-sm text-muted">
                      {formatNumber(Math.round(hostPayout(renterPrice(cat.price, heated, cat.heatedMatters))), lang)}{" "}
                      {t.common.perMonth} / {cat.unit[lang]}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => change(cat.id, -1, cat.maxUnits)}
                    disabled={n === 0}
                    aria-label={fill(c.decrease, { unit: unitLabel })}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-night transition-colors hover:border-night disabled:opacity-35 disabled:hover:border-line"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <output aria-live="polite" className="w-8 text-center text-lg font-semibold tabular-nums">
                    {n}
                  </output>
                  <button
                    type="button"
                    onClick={() => change(cat.id, 1, cat.maxUnits)}
                    disabled={n >= cat.maxUnits}
                    aria-label={fill(c.increase, { unit: unitLabel })}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-night transition-colors hover:border-night disabled:opacity-35 disabled:hover:border-line"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-frost/50 p-4">
          <input
            type="checkbox"
            checked={heated}
            onChange={(e) => {
              setHeated(e.target.checked);
              setActivePreset(null);
            }}
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
          {hostTotal > 0 ? (
            <>
              <p className="font-display mt-1 text-5xl font-bold tracking-tight text-glow tabular-nums sm:text-6xl">
                {formatNumber(hostTotal, lang)}
                <span className="ml-2 text-xl font-semibold text-white">{t.common.perMonth}</span>
              </p>
              <p className="mt-2 text-lg text-frost">
                {fill(c.perYear, { amount: formatNumber(hostTotal * 12, lang) })}
              </p>
              <p className="mt-5 text-sm leading-relaxed text-frost-2">
                {fill(c.renterPays, { amount: formatNumber(renterTotal, lang) })}
              </p>
            </>
          ) : (
            <p className="mt-2 text-lg text-frost">{c.empty}</p>
          )}
          <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-relaxed text-frost-2">{c.feeNote}</p>
          <Link prefetch={false} href={formHref} className="btn btn-primary mt-6 w-full">
            {c.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
