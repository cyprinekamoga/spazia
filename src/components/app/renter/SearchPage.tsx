"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, SearchX } from "lucide-react";
import { useState, type FormEvent } from "react";
import { categoryIcons } from "@/components/Icons";
import { appText } from "@/content/app";
import { categories, type CategoryId } from "@/content/categories";
import { fill } from "@/lib/i18n";
import { searchListings, type SearchResult } from "@/lib/app/data";
import { formatKr, renterPrice } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { site } from "@/lib/site";
import { Spinner, useOptionalSession } from "../AppShell";
import { CoverPhoto } from "../ui";

const t = appText.search;

function ResultCard({ listing }: { listing: SearchResult }) {
  const place = [listing.area_name, listing.city].filter(Boolean).join(", ");
  const type = listing.space_type ? appText.spaceTypes[listing.space_type] : "";
  const from = listing.listing_spaces.length ? Math.min(...listing.listing_spaces.map((s) => renterPrice(s.host_price_month))) : null;
  return (
    <Link prefetch={false} href={`/annons?id=${listing.id}`} className="group block">
      <CoverPhoto photos={listing.listing_photos} className="aspect-[4/3] w-full rounded-2xl transition-opacity group-hover:opacity-90" />
      <span className="mt-2.5 block font-bold text-night">{listing.title || appText.listings.untitled}</span>
      <span className="block text-[0.95rem] text-muted">{[type, place].filter(Boolean).join(" i ")}</span>
      {from !== null && <span className="mt-1 block font-semibold text-night">{fill(t.from, { price: formatKr(from) })}</span>}
    </Link>
  );
}

export function SearchPage() {
  const uid = useOptionalSession()?.user.id ?? "";
  const params = useSearchParams();
  const router = useRouter();
  const place = params.get("ort") ?? "";
  const typ = params.get("typ");
  const category = (categories.find((c) => c.id === typ)?.id ?? null) as CategoryId | null;
  const [input, setInput] = useState(place);
  const { data, loading, error } = useLoad(() => searchListings({ place, category, exclude: uid }), `${uid}|${place}|${category ?? ""}`);

  function go(nextPlace: string, nextCategory: CategoryId | null) {
    const q = new URLSearchParams();
    if (nextPlace.trim()) q.set("ort", nextPlace.trim());
    if (nextCategory) q.set("typ", nextCategory);
    const qs = q.toString();
    router.replace(qs ? `/sok?${qs}` : "/sok");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    go(input, category);
  }

  const results = data ?? [];
  const count = results.length === 1 ? t.countOne : fill(t.countMany, { count: results.length });

  return (
    <div>
      <h1 className="text-[2rem] leading-tight text-night">{t.title}</h1>

      <form onSubmit={submit} className="mt-4 flex items-center gap-2 rounded-full border border-line bg-paper p-1.5 pl-4 shadow-sm focus-within:border-night/40">
        <MapPin size={20} className="shrink-0 text-brand" aria-hidden="true" />
        <label htmlFor="search-place" className="sr-only">
          {t.where}
        </label>
        <input
          id="search-place"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={appText.renterHome.wherePlaceholder}
          autoComplete="address-level2"
          className="min-w-0 flex-1 bg-transparent py-2 text-[1.05rem] placeholder:text-muted focus:outline-none"
        />
        <button type="submit" className="btn btn-primary shrink-0 !px-5">
          {t.submit}
        </button>
      </form>

      <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap" aria-label={t.what}>
          <li>
            <button
              type="button"
              aria-pressed={category === null}
              onClick={() => go(place, null)}
              className="flex min-h-11 items-center rounded-full border border-line bg-paper px-4 text-[0.95rem] font-semibold text-ink aria-pressed:border-night aria-pressed:bg-night aria-pressed:text-white"
            >
              {t.all}
            </button>
          </li>
          {categories.map((c) => {
            const Icon = categoryIcons[c.id];
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={category === c.id}
                  onClick={() => go(place, category === c.id ? null : c.id)}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper px-3.5 text-[0.95rem] font-semibold whitespace-nowrap text-ink aria-pressed:border-night aria-pressed:bg-night aria-pressed:text-white"
                >
                  <Icon size={18} aria-hidden="true" />
                  {c.name.sv}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="mt-6 text-muted">{appText.common.error}</p>
      ) : results.length === 0 ? (
        <div className="mt-8 card flex flex-col items-start gap-3 p-6">
          <SearchX size={28} className="text-brand" aria-hidden="true" />
          <p className="text-lg font-semibold text-night">{t.empty}</p>
          <p className="text-muted">{t.emptyHint}</p>
          <a href={`${site.url}/hitta-forvaring${place ? `?ort=${encodeURIComponent(place)}` : ""}#anmalan`} className="btn btn-primary mt-1">
            {t.emptyCta}
          </a>
        </div>
      ) : (
        <>
          <p className="mt-6 font-semibold text-muted" aria-live="polite">
            {count}
            {place ? ` ${fill(t.in, { place })}` : ""}
          </p>
          <ul className="mt-3 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((l) => (
              <li key={l.id}>
                <ResultCard listing={l} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
