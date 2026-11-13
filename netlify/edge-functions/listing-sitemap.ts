/**
 * https://app.spazia.se/sitemap-annonser.xml: every published listing, in
 * Swedish with the English version as an alternate. Listed in the app's
 * robots.txt. Cached on the CDN for an hour.
 */
import { listingPath } from "../../src/lib/listing-seo.ts";
import { APP_URL, isAppHost, publicGet, type EdgeContext } from "../lib/listing-shared.ts";

export default async function listingSitemap(req: Request, context: EdgeContext): Promise<Response> {
  if (!isAppHost(new URL(req.url).host)) return context.next();
  let rows: { id: string; updated_at: string | null }[];
  try {
    rows = await publicGet(`/rest/v1/listings?status=eq.published&select=id,updated_at&order=published_at.desc&limit=10000`, {}, 5000);
  } catch (err) {
    console.error("listing-sitemap:", err);
    return new Response("unavailable", { status: 503, headers: { "retry-after": "600" } });
  }
  const urls = rows.map((r) => {
    const sv = `${APP_URL}${listingPath(r.id, "sv")}`.replace(/&/g, "&amp;");
    const en = `${APP_URL}${listingPath(r.id, "en")}`.replace(/&/g, "&amp;");
    const lastmod = r.updated_at ? `<lastmod>${r.updated_at.slice(0, 10)}</lastmod>` : "";
    return `<url><loc>${sv}</loc>${lastmod}<xhtml:link rel="alternate" hreflang="sv" href="${sv}"/><xhtml:link rel="alternate" hreflang="en" href="${en}"/></url>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export const config = { path: "/sitemap-annonser.xml", cache: "manual" };
