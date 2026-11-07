import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/__forms.html", "/admin", "/api/", "/vard", "/kund", "/konto", "/logga-in"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
