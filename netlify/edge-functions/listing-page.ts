/**
 * /annons on app.spazia.se: the page itself is the app's static shell, which
 * loads the listing in the browser. Before it is served, this adds what
 * search engines and link previews need: title, description, canonical
 * address (sv/en), image and structured data. Unknown or unpublished listings
 * get status 404 and "noindex".
 *
 * Cached on Netlify's CDN per listing (10 minutes, then refreshed in the
 * background), so the function rarely runs and the database is rarely asked.
 */
import { listingSeo, seoHeadTags, type SeoLang, type SeoListing } from "../../src/lib/listing-seo.ts";
import { APP_URL, isAppHost, publicGet, SERVICE_FEE, supabaseUrl, UUID, type EdgeContext } from "../lib/listing-shared.ts";

const SELECT =
  "id,title,description,city,area_name,size_m2,updated_at,listing_spaces(category,capacity,host_price_month,hourly_price),listing_photos(path,position)";

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function cached(headers: Headers, seconds: number) {
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  headers.set("netlify-cdn-cache-control", `public, durable, s-maxage=${seconds}, stale-while-revalidate=86400`);
  headers.set("netlify-vary", "query=id|lang");
}

export default async function listingPage(req: Request, context: EdgeContext): Promise<Response> {
  const url = new URL(req.url);
  const res = await context.next();
  if (!isAppHost(url.host) || !res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return res;

  const id = url.searchParams.get("id") ?? "";
  const lang: SeoLang = url.searchParams.get("lang") === "en" ? "en" : "sv";
  const html = await res.text();
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  headers.delete("etag");

  const notFound = () => {
    cached(headers, 300);
    return new Response(html.replace("</head>", `<meta name="robots" content="noindex"></head>`), { status: UUID.test(id) ? 404 : 200, headers });
  };
  if (!UUID.test(id)) return notFound();

  let listing: SeoListing | undefined;
  let rating: { average: number; count: number } | null = null;
  try {
    const [rows, ratings] = await Promise.all([
      publicGet<SeoListing[]>(`/rest/v1/listings?id=eq.${id}&status=eq.published&select=${SELECT}`),
      publicGet<{ average: number; count: number }[]>(`/rest/v1/rpc/listing_ratings`, { method: "POST", body: JSON.stringify({ p_listings: [id] }) }).catch(() => []),
    ]);
    listing = rows[0];
    rating = ratings[0] ? { average: Number(ratings[0].average), count: Number(ratings[0].count) } : null;
  } catch (err) {
    // The database is slow or down: serve the page as it is (the browser loads the listing itself), uncached.
    console.error("listing-page:", err);
    return new Response(html, { status: 200, headers });
  }
  if (!listing) return notFound();

  const seo = listingSeo(listing, { lang, appUrl: APP_URL, storageUrl: supabaseUrl(), serviceFee: SERVICE_FEE, rating });
  const out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeText(seo.title)}</title>`)
    .replace(/<html lang="[a-z]+"/, `<html lang="${lang}"`)
    .replace("</head>", `${seoHeadTags(seo, lang)}</head>`);
  cached(headers, 600);
  return new Response(out, { status: 200, headers });
}

export const config = { path: "/annons", cache: "manual" };
