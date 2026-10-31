import type { MetadataRoute } from "next";
import { absoluteUrl, allRoutes } from "@/lib/routes";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-10-31");
  return allRoutes().flatMap((paths) =>
    (["sv", "en"] as const).map((lang) => ({
      url: absoluteUrl(paths[lang]),
      lastModified,
      alternates: {
        languages: { "sv-SE": absoluteUrl(paths.sv), en: absoluteUrl(paths.en) },
      },
    })),
  );
}
