"use client";

import { L } from "@/lib/app/lang";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { List, Map as MapIcon, MapPin, SearchX } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { categoryIcons } from "@/components/Icons";
import { appText } from "@/content/app";
import { categories, type CategoryId } from "@/content/categories";
import { fill } from "@/lib/i18n";
import { searchListings, type SearchResult } from "@/lib/app/data";
import { formatKr, fromPrice } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { site } from "@/lib/site";
import { Spinner, useOptionalSession } from "../AppShell";
import { CoverPhoto } from "../ui";
import { supabase } from "@/lib/supabase";
import { RatingBadge } from "../Reviews";
import { AlertButton } from "../SearchAlerts";
import { activeFilterCount, FilterPanel, filterKey, filtersFromParams, filtersToParams, SORT_KEYS, type SortKey } from "./SearchFilters";
import type { SearchFilters } from "@/lib/app/data";

// The map library is large: load it only when the map is shown, in the browser.
const SearchMap = dynamic(() => import("./SearchMap").then((m) => m.SearchMap), { ssr: false, loading: () => <Spinner /> });

const t = appText.search;

/** Kilometres between two points (good enough for "≈ 3 km"). */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function sortResults(rows: SearchResult[], sort: SortKey, here: { lat: number; lng: number } | null): (SearchResult & { distance?: number })[] {
  const list = rows.map((r) => ({
    ...r,
    distance: here && r.approx_lat != null && r.approx_lng != null ? km(here, { lat: r.approx_lat, lng: r.approx_lng }) : undefined,
  }));
  const price = (r: SearchResult) => {
    const p = fromPrice(r.listing_spaces);
    // Monthly prices first, by amount; hourly-only parking after them.
    return p ? (p.per === "month" ? p.amount : 1e9 + p.amount) : Infinity;
  };
  if (sort === "price") list.sort((a, b) => price(a) - price(b));
  else if (sort === "size") list.sort((a, b) => (b.size_m2 ?? -1) - (a.size_m2 ?? -1));
  else if (sort === "near" && here) list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  return list;
}

function ResultCard({ listing, rating, distance }: { listing: SearchResult; rating?: { average: number; count: number }; distance?: number }) {
  const place = [listing.area_name, listing.city].filter(Boolean).join(", ");
  const type = listing.space_type ? appText.spaceTypes[listing.space_type] : "";
  const from = fromPrice(listing.listing_spaces);
  return (
    <Link prefetch={false} href={`/annons?id=${listing.id}`} className="group block">
      <CoverPhoto photos={listing.listing_photos} className="aspect-[4/3] w-full rounded-2xl transition-opacity group-hover:opacity-90" />
      <span className="mt-2.5 flex items-start justify-between gap-2">
        <span className="font-bold text-night">{listing.title || appText.listings.untitled}</span>
        {rating && <RatingBadge average={rating.average} count={rating.count} />}
      </span>
      <span className="block text-[0.95rem] text-muted">{[type, place].filter(Boolean).join(" i ")}</span>
      {from !== null && <span className="mt-1 block font-semibold text-night">{fill(from.per === "hour" ? t.fromHour : t.from, { price: formatKr(from.amount) })}</span>}
      {distance !== undefined && <span className="block text-sm text-muted">{fill(t.distance, { km: distance < 10 ? distance.toFixed(1).replace(".", L({ sv: ",", en: "." })) : Math.round(distance) })}</span>}
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
  const filters = filtersFromParams(params);
  const sortParam = params.get("sort");
  const sort: SortKey = (SORT_KEYS as string[]).includes(sortParam ?? "") ? (sortParam as SortKey) : "newest";
  const [input, setInput] = useState(place);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const { data, loading, error } = useLoad(
    () => searchListings({ place, category, exclude: uid, filters }),
    `${uid}|${place}|${category ?? ""}|${filterKey(filters)}`,
  );

  /** Change place, type, filters or sort; everything else in the address is kept. */
  function go(next: { place?: string; category?: CategoryId | null; filters?: SearchFilters; sort?: SortKey }) {
    const q = new URLSearchParams(params.toString());
    const nextPlace = (next.place ?? place).trim();
    const nextCategory = next.category === undefined ? category : next.category;
    if (nextPlace) q.set("ort", nextPlace);
    else q.delete("ort");
    if (nextCategory) q.set("typ", nextCategory);
    else q.delete("typ");
    if (next.filters) filtersToParams(next.filters, q);
    const nextSort = next.sort ?? sort;
    if (nextSort === "newest") q.delete("sort");
    else q.set("sort", nextSort);
    const qs = q.toString();
    router.replace(qs ? `/sok?${qs}` : "/sok");
  }

  function chooseSort(next: SortKey) {
    go({ sort: next });
    if (next !== "near" || here) return;
    if (!("geolocation" in navigator)) {
      setLocating("denied");
      return;
    }
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating("idle");
      },
      () => setLocating("denied"),
      { maximumAge: 10 * 60 * 1000, timeout: 15000 },
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    go({ place: input });
  }

  const results = useMemo(() => sortResults(data ?? [], sort, here), [data, sort, here]);
  const filtered = activeFilterCount(filters) > 0;
  const ratings = useLoad(async () => {
    if (!results.length) return {} as Record<string, { average: number; count: number }>;
    const res = await supabase().rpc("listing_ratings", { p_listings: results.map((r) => r.id) });
    return Object.fromEntries(((res.data ?? []) as { listing_id: string; average: number; count: number }[]).map((r) => [r.listing_id, r]));
  }, `ratings-${results.map((r) => r.id).sort().join(",")}`);
  const count = results.length === 1 ? t.countOne : fill(t.countMany, { count: results.length });
  const showMap = params.get("vy") === "karta";
  function setView(map: boolean) {
    const q = new URLSearchParams(params.toString());
    if (map) q.set("vy", "karta");
    else q.delete("vy");
    router.replace(`/sok${q.toString() ? `?${q}` : ""}`);
  }

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
              onClick={() => go({ category: null })}
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
                  onClick={() => go({ category: category === c.id ? null : c.id })}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper px-3.5 text-[0.95rem] font-semibold whitespace-nowrap text-ink aria-pressed:border-night aria-pressed:bg-night aria-pressed:text-white"
                >
                  <Icon size={18} aria-hidden="true" />
                  {L(c.name)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterPanel key={filterKey(filters)} value={filters} onApply={(f) => go({ filters: f })} />
        <label htmlFor="search-sort" className="sr-only">
          {t.sort}
        </label>
        <select
          id="search-sort"
          value={sort}
          onChange={(e) => chooseSort(e.target.value as SortKey)}
          className="field-input !min-h-11 !w-auto !rounded-full !py-1.5 !pr-9 text-[0.95rem] font-semibold"
        >
          <option value="newest">{t.sortNewest}</option>
          <option value="price">{t.sortPrice}</option>
          <option value="size">{t.sortSize}</option>
          <option value="near">{t.sortNear}</option>
        </select>
      </div>
      {sort === "near" && locating === "busy" && <p className="mt-2 text-sm text-muted">{t.locating}</p>}
      {sort === "near" && locating === "denied" && (
        <p role="alert" className="mt-2 text-sm text-[#8a5a00]">
          {t.locationDenied}
        </p>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="mt-6 text-muted">{appText.common.error}</p>
      ) : results.length === 0 && filtered ? (
        <div className="mt-8 card flex flex-col items-start gap-3 p-6">
          <SearchX size={28} className="text-brand" aria-hidden="true" />
          <p className="text-lg font-semibold text-night">{t.noMatch}</p>
          <div className="mt-1 flex flex-wrap items-start gap-3">
            <button type="button" onClick={() => go({ filters: { maxPrice: null, minSize: null, heated: false, anytime: false, features: [] } })} className="btn btn-secondary">
              {t.clear}
            </button>
            {place && <AlertButton uid={uid} place={place} category={category} maxPrice={filters.maxPrice} primary />}
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="mt-8 card flex flex-col items-start gap-3 p-6">
          <SearchX size={28} className="text-brand" aria-hidden="true" />
          <p className="text-lg font-semibold text-night">{t.empty}</p>
          {place ? (
            <>
              <p className="text-muted">{appText.alerts.text}</p>
              <AlertButton uid={uid} place={place} category={category} maxPrice={filters.maxPrice} primary />
            </>
          ) : (
            <>
              <p className="text-muted">{t.emptyHint}</p>
              <a href={`${site.url}/hitta-forvaring#anmalan`} className="btn btn-primary mt-1">
                {t.emptyCta}
              </a>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="font-semibold text-muted" aria-live="polite">
              {count}
              {place ? ` ${fill(t.in, { place })}` : ""}
            </p>
            <div className="flex rounded-full border border-line bg-paper p-1" role="group">
              {[false, true].map((m) => (
                <button
                  key={String(m)}
                  type="button"
                  aria-pressed={showMap === m}
                  onClick={() => setView(m)}
                  className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted aria-pressed:bg-night aria-pressed:text-white"
                >
                  {m ? <MapIcon size={16} aria-hidden="true" /> : <List size={16} aria-hidden="true" />}
                  {m ? t.showMap : t.showList}
                </button>
              ))}
            </div>
          </div>
          {place && (
            <div className="mt-3">
              <AlertButton uid={uid} place={place} category={category} maxPrice={filters.maxPrice} />
            </div>
          )}
          {showMap ? (
            <div className="mt-3">
              <SearchMap listings={results} />
            </div>
          ) : (
            <ul className="mt-3 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((l) => (
                <li key={l.id}>
                  <ResultCard listing={l} rating={ratings.data?.[l.id]} distance={sort === "near" ? l.distance : undefined} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
