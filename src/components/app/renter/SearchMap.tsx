"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { appText } from "@/content/app";
import { townCentre } from "@/content/town-centres";
import { fill } from "@/lib/i18n";
import { formatKr, fromPrice } from "@/lib/app/model";
import type { SearchResult } from "@/lib/app/data";

/** Free vector map tiles from OpenStreetMap data (no key; attribution is in the style). */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

type Point = { listing: SearchResult; lng: number; lat: number; approximate: boolean };

function points(listings: SearchResult[]): Point[] {
  const seen = new Map<string, number>();
  return listings.flatMap((l) => {
    const own = l.approx_lat != null && l.approx_lng != null ? ([l.approx_lat, l.approx_lng] as [number, number]) : null;
    const centre = own ?? townCentre(l.city ?? "");
    if (!centre) return [];
    // Listings on the same spot are fanned out a little so each can be tapped.
    const key = `${centre[0]},${centre[1]}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const angle = n * 2.4;
    const r = n === 0 ? 0 : 0.004 * Math.sqrt(n);
    return [{ listing: l, lat: centre[0] + r * Math.cos(angle), lng: centre[1] + r * Math.sin(angle) * 2, approximate: !own }];
  });
}

/**
 * Map of search results. Positions are approximate (about a kilometre), so
 * the map shows areas, never addresses. MapLibre is loaded only when the map
 * is opened.
 */
export function SearchMap({ listings }: { listings: SearchResult[] }) {
  const box = useRef<HTMLDivElement>(null);
  const t = appText.search;

  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !box.current) return;
      const pts = points(listings);
      map = new maplibregl.Map({
        container: box.current,
        style: STYLE_URL,
        center: pts[0] ? [pts[0].lng, pts[0].lat] : [16.5, 62.5],
        zoom: pts[0] ? 10 : 3.6,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      for (const p of pts) {
        const from = fromPrice(p.listing.listing_spaces);
        const el = document.createElement("a");
        el.href = `/annons?id=${p.listing.id}`;
        el.className = "rounded-full border border-night/20 bg-paper px-2.5 py-1 text-sm font-bold text-night shadow-md hover:bg-night hover:text-paper";
        el.textContent = from ? `${formatKr(from.amount)} kr` : "•";
        el.setAttribute("aria-label", `${p.listing.title || appText.listings.untitled}${from ? `, ${fill(from.per === "hour" ? t.fromHour : t.from, { price: formatKr(from.amount) })}` : ""}`);
        new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
      }
      if (pts.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        for (const p of pts) bounds.extend([p.lng, p.lat]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 0 });
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [listings, t]);

  const missing = listings.length - points(listings).length;
  return (
    <div>
      <div ref={box} className="h-[60vh] min-h-[360px] w-full overflow-hidden rounded-2xl border border-line" />
      <p className="mt-2 text-sm text-muted">
        {t.mapNote}
        {missing > 0 ? ` ${fill(t.mapMissing, { count: String(missing) })}` : ""}
      </p>
    </div>
  );
}
