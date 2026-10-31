import { areas } from "@/content/areas";
import { categories } from "@/content/categories";
import type { L10n, Lang } from "./i18n";
import { site } from "./site";

export type PageKey = "home" | "host" | "find" | "trust" | "about" | "privacy";

export const pagePaths: Record<PageKey, L10n> = {
  home: { sv: "/", en: "/en" },
  host: { sv: "/bli-vard", en: "/en/become-a-host" },
  find: { sv: "/hitta-forvaring", en: "/en/find-storage" },
  trust: { sv: "/trygghet", en: "/en/trust-and-safety" },
  about: { sv: "/om-oss", en: "/en/about" },
  privacy: { sv: "/integritetspolicy", en: "/en/privacy" },
};

/** Query parameters that pre-fill the renter form (from category and area pages). */
export const RENTER_PARAMS = { item: "vad", area: "omrade" } as const;

const categoryBase: L10n = { sv: "/forvaring", en: "/en/storage" };
const areaBase: L10n = { sv: "/omrade", en: "/en/area" };

export function pagePath(page: PageKey, lang: Lang): string {
  return pagePaths[page][lang];
}

export function categoryPath(slug: L10n, lang: Lang): string {
  return `${categoryBase[lang]}/${slug[lang]}`;
}

export function areaPath(slug: string, lang: Lang): string {
  return `${areaBase[lang]}/${slug}`;
}

/** Every page on the site, with its path in both languages. */
export function allRoutes(): L10n[] {
  return [
    ...Object.values(pagePaths),
    ...categories.map((c) => ({ sv: categoryPath(c.slug, "sv"), en: categoryPath(c.slug, "en") })),
    ...areas.map((a) => ({ sv: areaPath(a.slug, "sv"), en: areaPath(a.slug, "en") })),
  ];
}

function normalize(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** The same page in the other language (falls back to that language's home page). */
export function translatePath(pathname: string, target: Lang): string {
  const current = normalize(pathname);
  const match = allRoutes().find((r) => r.sv === current || r.en === current);
  return match ? match[target] : pagePaths.home[target];
}

export function absoluteUrl(path: string): string {
  return path === "/" ? site.url : `${site.url}${path}`;
}

/** Canonical + hreflang alternates for a page's metadata. */
export function alternates(paths: L10n, lang: Lang) {
  return {
    canonical: absoluteUrl(paths[lang]),
    languages: {
      "sv-SE": absoluteUrl(paths.sv),
      en: absoluteUrl(paths.en),
      "x-default": absoluteUrl(paths.sv),
    },
  };
}
