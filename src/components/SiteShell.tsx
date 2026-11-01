import "@fontsource-variable/finlandica/wght.css";
import "@fontsource-variable/fraunces/opsz.css";
import "@/app/globals.css";
import type { ReactNode } from "react";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { site } from "@/lib/site";
import { CookieConsent } from "./CookieConsent";
import { Footer } from "./Footer";
import { Header } from "./Header";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  email: site.email,
  logo: `${site.url}/icon.svg`,
  areaServed: { "@type": "City", name: "Luleå" },
};

/** The <html> document shared by the Swedish and English root layouts. */
export function SiteShell({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = getDictionary(lang);
  return (
    <html lang={lang}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-night px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t.common.skipToContent}
        </a>
        <Header lang={lang} t={t} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer lang={lang} t={t} />
        <CookieConsent lang={lang} t={t} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
