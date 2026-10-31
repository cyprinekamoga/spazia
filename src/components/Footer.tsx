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
  const linkClass = "inline-flex min-h-10 items-center text-frost-2 transition-colors hover:text-white";
  return (
    <footer className="bg-night text-frost-2">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-12 sm:py-14 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 lg:col-span-1">
          <Link prefetch={false} href={pagePath("home", lang)} aria-label="Spazia">
            <Logo tone="white" id="logo-footer" className="h-9 w-auto" />
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
          <ul className="mt-4 text-[0.95rem]">
            {categories.map((c) => (
              <li key={c.id}>
                <Link prefetch={false} href={categoryPath(c.slug, lang)} className={linkClass}>
                  {c.name[lang]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t.footer.areas}>
          <h2 className="font-sans text-sm font-semibold tracking-wide text-white uppercase">{t.footer.areas}</h2>
          <ul className="mt-4 text-[0.95rem]">
            {areas.map((a) => (
              <li key={a.id}>
                <Link prefetch={false} href={areaPath(a.slug, lang)} className={linkClass}>
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t.footer.company} className="col-span-2 sm:col-span-1">
          <h2 className="font-sans text-sm font-semibold tracking-wide text-white uppercase">{t.footer.company}</h2>
          <ul className="mt-4 text-[0.95rem]">
            <li>
              <Link prefetch={false} href={pagePath("find", lang)} className={linkClass}>
                {t.nav.find}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href={pagePath("host", lang)} className={linkClass}>
                {t.nav.host}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href={pagePath("trust", lang)} className={linkClass}>
                {t.nav.trust}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href={pagePath("about", lang)} className={linkClass}>
                {t.nav.about}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href={pagePath("privacy", lang)} className={linkClass}>
                {t.footer.privacy}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href={`${pagePath("about", lang)}#bildkallor`} className={linkClass}>
                {t.footer.credits}
              </Link>
            </li>
            <li>
              <CookieSettingsLink label={t.footer.cookies} className={linkClass} />
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page pb-action-bar flex flex-col gap-2 pt-6 text-sm text-frost-2/80 sm:flex-row sm:items-center sm:justify-between md:pb-6">
          <p>
            © 2026 {site.legalName}. {t.footer.rights}
          </p>
          <p>{t.common.launchBadge}</p>
        </div>
      </div>
    </footer>
  );
}
