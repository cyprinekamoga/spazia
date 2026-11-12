"use client";
/* eslint-disable @next/next/no-img-element -- photos come from Supabase Storage, not the build */

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { FEES } from "@/content/pricing";
import type { Lang } from "@/lib/i18n";
import { listingPath, lowestPrice, photoPublicUrl, SEO_CATEGORY_NAMES, type SeoListing } from "@/lib/listing-seo";
import { appSearchUrl, site } from "@/lib/site";

const TEXT = {
  sv: { title: "Lediga platser i {name}", all: "Se alla platser i {name}", month: "kr/mån", hour: "kr/tim", from: "Från" },
  en: { title: "Spaces available in {name}", all: "See all spaces in {name}", month: "kr/month", hour: "kr/hour", from: "From" },
};

type Row = Pick<SeoListing, "id" | "title" | "city" | "area_name" | "size_m2" | "listing_spaces" | "listing_photos">;

/**
 * The newest published listings in a city, linking to the app. Loaded in the
 * browser (the site is static); shows nothing until there are listings.
 */
export function CityListings({ city, lang }: { city: string; lang: Lang }) {
  const [rows, setRows] = useState<Row[]>([]);
  const t = TEXT[lang];

  useEffect(() => {
    const ctrl = new AbortController();
    const select = "id,title,city,area_name,size_m2,listing_spaces(category,host_price_month,hourly_price),listing_photos(path,position)";
    const q = `status=eq.published&city=ilike.${encodeURIComponent(city)}&select=${select}&order=published_at.desc&limit=6`;
    fetch(`${site.appSupabaseUrl}/rest/v1/listings?${q}`, { headers: { apikey: site.appSupabaseKey }, signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Row[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [city]);

  if (rows.length === 0) return null;
  const fill = (s: string) => s.replace("{name}", city);

  return (
    <section className="container-page pt-10 sm:pt-14" aria-labelledby="city-listings">
      <h2 id="city-listings" className="text-[1.75rem] leading-tight text-night sm:text-4xl">
        {fill(t.title)}
      </h2>
      <ul className="mt-5 grid gap-3 sm:mt-7 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {rows.map((l) => {
          const photo = [...l.listing_photos].sort((a, b) => a.position - b.position)[0];
          const price = lowestPrice(l.listing_spaces, FEES.renterServiceFee);
          const cats = [...new Set(l.listing_spaces.map((s) => SEO_CATEGORY_NAMES[s.category]?.[lang]).filter(Boolean))].join(" · ");
          return (
            <li key={l.id}>
              <a href={`${site.appUrl}${listingPath(l.id, lang)}`} className="card group block overflow-hidden">
                {photo ? (
                  <img src={photoPublicUrl(site.appSupabaseUrl, photo.path)} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="aspect-[4/3] w-full bg-frost" />
                )}
                <div className="p-4">
                  <p className="text-sm font-semibold text-brand">{cats}</p>
                  <h3 className="mt-0.5 font-bold leading-snug text-night group-hover:underline">{l.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {[l.area_name, l.size_m2 ? `${new Intl.NumberFormat(lang === "sv" ? "sv-SE" : "en-GB").format(Number(l.size_m2))} m²` : ""].filter(Boolean).join(" · ")}
                  </p>
                  {price && (
                    <p className="mt-2 font-bold text-night">
                      {t.from} {new Intl.NumberFormat(lang === "sv" ? "sv-SE" : "en-GB").format(price.amount)} {price.per === "month" ? t.month : t.hour}
                    </p>
                  )}
                </div>
              </a>
            </li>
          );
        })}
      </ul>
      <a href={appSearchUrl({ place: city })} className="mt-5 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand underline-offset-4 hover:underline">
        {fill(t.all)}
        <ArrowRight size={18} aria-hidden="true" />
      </a>
    </section>
  );
}
