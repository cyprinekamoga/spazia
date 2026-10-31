"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Globe, Menu, X } from "lucide-react";
import type { Dictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { pagePath, translatePath } from "@/lib/routes";
import { Logo } from "./Logo";

export function Header({ lang, t }: { lang: Lang; t: Dictionary }) {
  const pathname = usePathname() ?? "/";
  // The menu remembers which page it was opened on, so it closes by itself
  // when the visitor navigates.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const other: Lang = lang === "sv" ? "en" : "sv";
  const switchHref = translatePath(pathname, other);

  const links = [
    { href: pagePath("find", lang), label: t.nav.find },
    { href: pagePath("host", lang), label: t.nav.host },
    { href: pagePath("trust", lang), label: t.nav.trust },
    { href: pagePath("about", lang), label: t.nav.about },
  ];

  const isActive = (href: string) => pathname.replace(/\/$/, "") === href;

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-snow/95 backdrop-blur">
      <div className="container-page flex h-14 items-center justify-between gap-4 sm:h-16">
        <Link prefetch={false} href={pagePath("home", lang)} className="flex h-11 shrink-0 items-center" aria-label="Spazia">
          <Logo id="logo-header" className="h-7 w-auto sm:h-8" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={t.common.menu}>
          {links.map((l) => (
            <Link prefetch={false}
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className="rounded-full px-3 py-2 text-[0.95rem] font-medium text-ink/80 transition-colors hover:bg-frost/70 hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-brand-bright aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={switchHref}
            hrefLang={other}
            lang={other}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink/80 hover:bg-frost/70 hover:text-ink"
            aria-label={t.common.switchLanguageLabel}
          >
            <Globe size={16} aria-hidden="true" />
            {t.common.switchLanguage}
          </a>
          <Link prefetch={false} href={pagePath("host", lang)} className="btn btn-primary !px-4 !py-2.5 text-[0.95rem]">
            {t.nav.hostCta}
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-frost/70 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t.common.close : t.common.menu}
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-line bg-snow md:hidden">
          <nav className="container-page flex flex-col py-3" aria-label={t.common.menu}>
            {links.map((l) => (
              <Link prefetch={false}
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className="flex min-h-12 items-center rounded-xl px-3 text-lg font-medium text-ink hover:bg-frost/70 aria-[current=page]:bg-frost/70"
              >
                {l.label}
              </Link>
            ))}
            <a
              href={switchHref}
              hrefLang={other}
              lang={other}
              className="mt-1 inline-flex items-center gap-2 rounded-xl px-3 py-3 text-base font-medium text-ink/80 hover:bg-frost/70"
            >
              <Globe size={18} aria-hidden="true" />
              {t.common.switchLanguage}
            </a>
            <Link prefetch={false} href={pagePath("host", lang)} className="btn btn-primary mt-3 w-full">
              {t.nav.hostCta}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
