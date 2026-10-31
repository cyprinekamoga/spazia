import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { L10n, Lang } from "./i18n";
import { absoluteUrl, alternates } from "./routes";
import { site } from "./site";

export function buildMetadata({
  lang,
  paths,
  title,
  description,
  absoluteTitle = false,
}: {
  lang: Lang;
  paths: L10n;
  title: string;
  description: string;
  /** Use the title as-is, without the " · Spazia" suffix. */
  absoluteTitle?: boolean;
}): Metadata {
  const t = getDictionary(lang);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: alternates(paths, lang),
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: t.meta.locale,
      url: absoluteUrl(paths[lang]),
      title,
      description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: t.hero.illustrationAlt }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og.jpg"] },
  };
}
