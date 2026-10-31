import Link from "next/link";
import { areas } from "@/content/areas";
import { categories } from "@/content/categories";
import type { Dictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { areaPath, categoryPath, pagePath } from "@/lib/routes";
import { site } from "@/lib/site";
import { CookieSettingsLink } from "./CookieConsent";
import { Logo } from "./Logo";

export function Footer({ lang, t }: { lang: Lang; t: Dictionary }) {
  const linkClass = "text-frost-2 transition-colors hover:text-white";
  return (
    <footer className="bg-night text-frost-2">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href={pagePath("home", lang)} aria-label="Spazia">
            <Logo inverted />
          </Link>
          <p className="mt-4 max-w-xs text-[0.95rem] leading-relaxed">{t.footer.tagline}</p>
          <p className="mt-4 text-[0.95rem]">
            <a href={`mailto:${site.email}`} className="font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
              {site.email}
            </a>
          </p>
        </div>

        <nav aria-label={t.footer.storage}>
          <h2 className="font-sans text-sm font-semibold tracking-wide text-white uppercase">{t.footer.storage}</h2>
          <ul className="mt-4 space-y-2.5 text-[0.95rem]">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={categoryPath(c.slug, lang)} className={linkClass}>
                  {c.name[lang]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t.footer.areas}>
          <h2 className="font-sans text-sm font-semibold tracking-wide text-white uppercase">{t.footer.areas}</h2>
          <ul className="mt-4 space-y-2.5 text-[0.95rem]">
            {areas.map((a) => (
              <li key={a.id}>
                <Link href={areaPath(a.slug, lang)} className={linkClass}>
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t.footer.company}>
          <h2 className="font-sans text-sm font-semibold tracking-wide text-white uppercase">{t.footer.company}</h2>
          <ul className="mt-4 space-y-2.5 text-[0.95rem]">
            <li>
              <Link href={pagePath("find", lang)} className={linkClass}>
                {t.nav.find}
              </Link>
            </li>
            <li>
              <Link href={pagePath("host", lang)} className={linkClass}>
                {t.nav.host}
              </Link>
            </li>
            <li>
              <Link href={pagePath("trust", lang)} className={linkClass}>
                {t.nav.trust}
              </Link>
            </li>
            <li>
              <Link href={pagePath("about", lang)} className={linkClass}>
                {t.nav.about}
              </Link>
            </li>
            <li>
              <Link href={pagePath("privacy", lang)} className={linkClass}>
                {t.footer.privacy}
              </Link>
            </li>
            <li>
              <CookieSettingsLink label={t.footer.cookies} className={linkClass} />
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-sm text-frost-2/80 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 {site.legalName}. {t.footer.rights}
          </p>
          <p>{t.common.launchBadge}</p>
        </div>
      </div>
    </footer>
  );
}
