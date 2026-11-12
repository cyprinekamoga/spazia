/**
 * What search engines and link previews see for a public listing: title,
 * description, canonical address, image and structured data (schema.org).
 *
 * Used in two places that must agree: the edge function that adds these tags
 * to /annons before it is served (netlify/edge-functions/listing-page.ts), and
 * the listing page in the browser, which sets the same title and description.
 *
 * No runtime imports, so the edge function (Deno) can load this file as is.
 * The fee comes from the caller; a unit test checks the edge function's copy
 * against src/content/pricing.ts and that every category has a name here.
 */

export type SeoLang = "sv" | "en";

/** What people search for: the service, not the thing stored ("Däckförvaring", not "Däck"). */
export const SEO_CATEGORY_NAMES: Record<string, { sv: string; en: string }> = {
  tyres: { sv: "Däckförvaring", en: "Tyre storage" },
  skis: { sv: "Förvaring av skidor", en: "Ski storage" },
  snowmobile: { sv: "Förvaring av skoter och släp", en: "Snowmobile and trailer storage" },
  bikes: { sv: "Cykelförvaring", en: "Bike storage" },
  boxes: { sv: "Förvaring av lådor och möbler", en: "Storage for boxes and furniture" },
  car: { sv: "Bilplats inomhus", en: "Indoor car space" },
  parking: { sv: "Parkering", en: "Parking" },
};

export interface SeoListing {
  id: string;
  title: string;
  description: string;
  city: string;
  area_name: string;
  size_m2: number | null;
  updated_at?: string | null;
  listing_spaces: { category: string; capacity?: number; host_price_month: number | null; hourly_price?: number | null }[];
  listing_photos: { path: string; position: number }[];
}

export interface SeoOptions {
  lang: SeoLang;
  appUrl: string;
  /** The Supabase project URL (photos are served from its Storage). */
  storageUrl: string;
  /** Renter service fee, e.g. 0.15. */
  serviceFee: number;
  rating?: { average: number; count: number } | null;
}

export interface ListingSeo {
  title: string;
  description: string;
  canonical: string;
  alternates: Record<SeoLang, string>;
  image: string | null;
  jsonLd: Record<string, unknown>;
}

/** Same whole-number rounding as the database (private.renter_price) and src/lib/app/model.ts. */
export function renterPriceFor(hostPrice: number, serviceFee: number): number {
  return Math.round((hostPrice * Math.round((1 + serviceFee) * 100)) / 100);
}

/** Lowest renter price: monthly if offered, otherwise hourly. */
export function lowestPrice(spaces: SeoListing["listing_spaces"], serviceFee: number): { amount: number; per: "month" | "hour" } | null {
  const monthly = spaces.filter((s) => s.host_price_month).map((s) => renterPriceFor(s.host_price_month!, serviceFee));
  if (monthly.length) return { amount: Math.min(...monthly), per: "month" };
  const hourly = spaces.filter((s) => s.hourly_price).map((s) => renterPriceFor(s.hourly_price!, serviceFee));
  return hourly.length ? { amount: Math.min(...hourly), per: "hour" } : null;
}

export function listingPath(id: string, lang: SeoLang = "sv"): string {
  return `/annons?id=${id}${lang === "en" ? "&lang=en" : ""}`;
}

export function photoPublicUrl(storageUrl: string, path: string): string {
  return `${storageUrl}/storage/v1/object/public/listing-photos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Cut at a word boundary and add "…" when longer than max. */
export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).replace(/[\s,.;:–-]+\S*$/, "")}…`;
}

const kr = (n: number, lang: SeoLang) => new Intl.NumberFormat(lang === "sv" ? "sv-SE" : "en-GB").format(n);

export function listingSeo(l: SeoListing, o: SeoOptions): ListingSeo {
  const sv = o.lang === "sv";
  const place = l.area_name && l.area_name !== l.city ? `${l.area_name}, ${l.city}` : l.city;
  const cats = ([...new Set(l.listing_spaces.map((s) => s.category))].map((c) => SEO_CATEGORY_NAMES[c]?.[o.lang]).filter(Boolean) as string[]).map((name, i) =>
    i === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1),
  );
  const catText = cats.length ? cats.join(sv ? " och " : " and ") : sv ? "Förvaring" : "Storage";
  const price = lowestPrice(l.listing_spaces, o.serviceFee);
  const priceText = price
    ? sv
      ? `Från ${kr(price.amount, "sv")} kr/${price.per === "month" ? "mån" : "tim"}`
      : `From ${kr(price.amount, "en")} kr/${price.per === "month" ? "month" : "hour"}`
    : "";
  const sizeText = l.size_m2 ? `${kr(Number(l.size_m2), o.lang)} m²` : "";

  const titleBase = l.title.trim() || (sv ? `${catText} att hyra` : `${catText} for rent`);
  const title = `${titleBase.toLowerCase().includes(l.city.toLowerCase()) ? titleBase : `${titleBase}, ${l.city}`} | Spazia`;

  const lead = sv ? `${catText} att hyra i ${place}.` : `${catText} for rent in ${place}.`;
  const facts = [priceText, sizeText].filter(Boolean).join(", ");
  const description = clip([lead, facts && `${facts}.`, l.description].filter(Boolean).join(" "), 158);

  const canonical = `${o.appUrl}${listingPath(l.id, o.lang)}`;
  const alternates = { sv: `${o.appUrl}${listingPath(l.id, "sv")}`, en: `${o.appUrl}${listingPath(l.id, "en")}` };
  const photos = [...l.listing_photos].sort((a, b) => a.position - b.position).map((p) => photoPublicUrl(o.storageUrl, p.path));

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: titleBase,
    description: clip(l.description || lead, 500),
    url: canonical,
    category: catText,
    brand: { "@type": "Brand", name: "Spazia" },
    ...(photos.length ? { image: photos.slice(0, 6) } : {}),
    ...(price
      ? {
          offers: {
            "@type": "Offer",
            url: canonical,
            price: price.amount,
            priceCurrency: "SEK",
            availability: "https://schema.org/InStock",
            businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: price.amount,
              priceCurrency: "SEK",
              unitCode: price.per === "month" ? "MON" : "HUR",
            },
            areaServed: { "@type": "City", name: l.city },
          },
        }
      : {}),
    ...(o.rating && o.rating.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: o.rating.average, reviewCount: o.rating.count, bestRating: 5, worstRating: 1 } }
      : {}),
  };

  return { title, description, canonical, alternates, image: photos[0] ?? null, jsonLd };
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The tags to add to <head>. JSON-LD is escaped so it cannot close the script tag. */
export function seoHeadTags(seo: ListingSeo, lang: SeoLang): string {
  const tags = [
    `<meta name="description" content="${escapeAttr(seo.description)}">`,
    `<link rel="canonical" href="${escapeAttr(seo.canonical)}">`,
    `<link rel="alternate" hreflang="sv" href="${escapeAttr(seo.alternates.sv)}">`,
    `<link rel="alternate" hreflang="en" href="${escapeAttr(seo.alternates.en)}">`,
    `<link rel="alternate" hreflang="x-default" href="${escapeAttr(seo.alternates.sv)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Spazia">`,
    `<meta property="og:locale" content="${lang === "sv" ? "sv_SE" : "en_GB"}">`,
    `<meta property="og:title" content="${escapeAttr(seo.title)}">`,
    `<meta property="og:description" content="${escapeAttr(seo.description)}">`,
    `<meta property="og:url" content="${escapeAttr(seo.canonical)}">`,
    ...(seo.image ? [`<meta property="og:image" content="${escapeAttr(seo.image)}">`, `<meta name="twitter:card" content="summary_large_image">`] : []),
    `<script type="application/ld+json">${JSON.stringify(seo.jsonLd).replace(/</g, "\\u003c")}</script>`,
  ];
  return tags.join("");
}
