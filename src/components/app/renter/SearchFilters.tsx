"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { appText } from "@/content/app";
import { NO_FILTERS, type SearchFilters } from "@/lib/app/data";
import { FEATURES, type Feature } from "@/lib/app/model";
import { fill } from "@/lib/i18n";

const t = appText.search;

export type SortKey = "newest" | "price" | "size" | "near";
export const SORT_KEYS: SortKey[] = ["newest", "price", "size", "near"];
const SIZES = [5, 10, 20, 40];

/** Filters and sort order live in the address, so a search can be shared or bookmarked. */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const num = (k: string) => {
    const n = Number(params.get(k));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const features = (params.get("egenskaper") ?? "").split(",").filter((f): f is Feature => (FEATURES as string[]).includes(f));
  return { maxPrice: num("pris"), minSize: num("m2"), heated: params.get("varme") === "1", anytime: params.get("dygnet") === "1", features };
}

export function filtersToParams(f: SearchFilters, q: URLSearchParams): void {
  for (const k of ["pris", "m2", "varme", "dygnet", "egenskaper"]) q.delete(k);
  if (f.maxPrice) q.set("pris", String(f.maxPrice));
  if (f.minSize) q.set("m2", String(f.minSize));
  if (f.heated) q.set("varme", "1");
  if (f.anytime) q.set("dygnet", "1");
  if (f.features.length) q.set("egenskaper", f.features.join(","));
}

export function activeFilterCount(f: SearchFilters): number {
  return (f.maxPrice ? 1 : 0) + (f.minSize ? 1 : 0) + (f.heated ? 1 : 0) + (f.anytime ? 1 : 0) + f.features.length;
}

export const filterKey = (f: SearchFilters) => JSON.stringify(f);

/** The "Filter" button and its panel. Changes apply when "Show spaces" is pressed. */
export function FilterPanel({ value, onApply }: { value: SearchFilters; onApply: (f: SearchFilters) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(value);
  const count = activeFilterCount(value);

  function toggle(feature: Feature) {
    setDraft((d) => ({ ...d, features: d.features.includes(feature) ? d.features.filter((x) => x !== feature) : [...d.features, feature] }));
  }

  const check = (checked: boolean, onChange: () => void, label: string, id: string) => (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-[0.95rem] text-ink">
      <input id={id} type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5 shrink-0 accent-[var(--color-brand)]" />
      {label}
    </label>
  );

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="search-filters"
        onClick={() => {
          setDraft(value);
          setOpen(!open);
        }}
        className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-[0.95rem] font-semibold ${count ? "border-night bg-night text-white" : "border-line bg-paper text-ink"}`}
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        {count ? fill(t.filtersActive, { count }) : t.filters}
      </button>
      {open && (
        <div id="search-filters" className="card mt-3 w-full basis-full p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-night">{t.filters}</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label={appText.common.close} className="-m-2 flex h-11 w-11 items-center justify-center text-muted">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="filter-price" className="field-label">
                {t.maxPrice}
              </label>
              <div className="relative">
                <input
                  id="filter-price"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={10}
                  value={draft.maxPrice ?? ""}
                  placeholder={t.maxPricePlaceholder}
                  onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null })}
                  className="field-input pr-12"
                />
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted">kr</span>
              </div>
            </div>
            <div>
              <label htmlFor="filter-size" className="field-label">
                {t.minSize}
              </label>
              <select
                id="filter-size"
                value={draft.minSize ?? ""}
                onChange={(e) => setDraft({ ...draft, minSize: e.target.value ? Number(e.target.value) : null })}
                className="field-input"
              >
                <option value="">{t.anySize}</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {fill(t.sizeOption, { size: s })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 grid sm:grid-cols-2">
            {check(draft.heated, () => setDraft({ ...draft, heated: !draft.heated }), t.heatedOnly, "filter-heated")}
            {check(draft.anytime, () => setDraft({ ...draft, anytime: !draft.anytime }), t.anytimeOnly, "filter-anytime")}
          </div>
          <fieldset className="mt-3">
            <legend className="field-label">{t.features}</legend>
            <div className="grid sm:grid-cols-2">{FEATURES.map((f) => check(draft.features.includes(f), () => toggle(f), appText.features[f], `filter-${f}`))}</div>
          </fieldset>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
              className="btn btn-primary"
            >
              {t.showResults}
            </button>
            {activeFilterCount(draft) > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDraft(NO_FILTERS);
                  onApply(NO_FILTERS);
                  setOpen(false);
                }}
                className="btn btn-secondary"
              >
                {t.clear}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
