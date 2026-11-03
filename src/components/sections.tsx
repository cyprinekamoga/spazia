import Link from "next/link";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { Dictionary } from "@/content";
import { areas, type Area } from "@/content/areas";
import { categories, type Category } from "@/content/categories";
import { cities } from "@/content/cities";
import type { PhotoKey } from "@/content/photos";
import { hostPayout, roundForDisplay } from "@/content/pricing";
import { fill, formatNumber, type Lang } from "@/lib/i18n";
import { areaPath, categoryPath, cityPath, pagePath, RENTER_PARAMS } from "@/lib/routes";
import { seasonIcons, trustIcons, whyIcons } from "./Icons";
import { Photo } from "./Photo";

/* ---------- Layout helpers ---------- */

export function Section({
  children,
  className = "",
  id,
  tone = "snow",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "snow" | "paper" | "night" | "frost";
}) {
  const tones = {
    snow: "bg-snow",
    paper: "bg-paper",
    night: "bg-night text-white",
    frost: "bg-frost/70",
  };
  return (
    <section id={id} className={`${tones[tone]} py-12 sm:py-20 ${className}`}>
      <div className="container-page">{children}</div>
    </section>
  );
}

export function SectionHeading({
  title,
  lead,
  eyebrow,
  align = "left",
  onDark = false,
}: {
  title: string;
  lead?: string;
  eyebrow?: string;
  align?: "left" | "center";
  onDark?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      {eyebrow && <span className={`eyebrow ${onDark ? "!text-glow" : ""}`}>{eyebrow}</span>}
      <h2 className={`mt-1 text-[2.1rem] leading-[1.08] sm:text-5xl ${onDark ? "text-white" : "text-night"}`}>{title}</h2>
      {lead && (
        <p className={`mt-3 max-w-xl text-lg leading-relaxed sm:mt-4 ${onDark ? "text-frost-2" : "text-muted"}`}>{lead}</p>
      )}
    </div>
  );
}

/**
 * Full-bleed photo hero. On phones the text sits at the bottom of a tall
 * photo (thumb-friendly); on larger screens it is vertically centred.
 */
export function PhotoHero({
  photo,
  lang,
  eyebrow,
  title,
  lead,
  children,
  size = "page",
  imageClassName = "",
}: {
  photo: PhotoKey;
  lang: Lang;
  eyebrow?: ReactNode;
  title: string;
  lead?: string;
  children?: ReactNode;
  size?: "home" | "page";
  /** Extra classes for the photo, e.g. to shift it up on phones. */
  imageClassName?: string;
}) {
  const heights =
    size === "home"
      ? "min-h-[calc(100svh-3.5rem)] max-h-[54rem] sm:min-h-[36rem] lg:min-h-[40rem]"
      : "min-h-[30rem] sm:min-h-[26rem] lg:min-h-[30rem]";
  return (
    <section className={`relative isolate flex overflow-hidden bg-night text-white ${heights}`}>
      <Photo name={photo} lang={lang} sizes="100vw" priority className={`absolute inset-0 -z-20 h-full w-full ${imageClassName}`} />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-night from-30% via-night/60 via-60% to-night/0 sm:bg-gradient-to-r sm:from-night/90 sm:from-0% sm:via-night/55 sm:to-night/5"
      />
      <div className={`container-page flex w-full flex-col justify-end pb-8 sm:justify-center sm:py-16 ${size === "home" ? "pt-12" : "pt-24"}`}>
        <div className="max-w-2xl">
          {eyebrow && <div className="mb-3">{eyebrow}</div>}
          <h1 className={`${size === "home" ? "text-[2.9rem] sm:text-6xl lg:text-7xl" : "text-[2.4rem] sm:text-5xl lg:text-6xl"} leading-[1.02] text-white`}>
            {title}
          </h1>
          {lead && <p className="mt-4 max-w-xl text-lg leading-relaxed text-frost">{lead}</p>}
          {children && <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/* ---------- Categories ---------- */

export function priceLabel(category: Category, lang: Lang, t: Dictionary) {
  return `${t.common.from} ${formatNumber(category.price, lang)} ${t.common.perMonth}`;
}

/** "120 kr" in Swedish, "SEK 120" in English. */
export function money(amount: number, lang: Lang) {
  return lang === "sv" ? `${formatNumber(amount, lang)} kr` : `SEK ${formatNumber(amount, lang)}`;
}

export function CategoryCard({
  category,
  lang,
  t,
  wide = false,
}: {
  category: Category;
  lang: Lang;
  t: Dictionary;
  /** Full-width, side-by-side layout on desktop (used for a lone last card). */
  wide?: boolean;
}) {
  return (
    <Link prefetch={false}
      href={categoryPath(category.slug, lang)}
      className={`group card flex h-full flex-col overflow-hidden transition-[border-color,box-shadow] hover:border-night/25 hover:shadow-[0_14px_30px_-20px_rgb(29_51_64/0.6)] ${wide ? "lg:flex-row" : ""}`}
    >
      <div className={`relative aspect-[4/3] overflow-hidden ${wide ? "lg:aspect-auto lg:min-h-72 lg:w-1/2" : ""}`}>
        <Photo
          name={category.photo}
          lang={lang}
          sizes={wide ? "(min-width: 1024px) 560px, (min-width: 640px) 46vw, 78vw" : "(min-width: 1024px) 360px, (min-width: 640px) 46vw, 78vw"}
          className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className={`flex flex-1 flex-col p-4 sm:p-5 ${wide ? "lg:justify-center lg:p-10" : ""}`}>
        <h3 className="text-[1.2rem] text-night group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
          {category.name[lang]}
        </h3>
        <p className={`mt-1 leading-snug text-muted ${wide ? "lg:flex-none lg:text-lg" : "flex-1"}`}>{category.short[lang]}</p>
        <div className="mt-4 border-t border-line pt-3">
          <p className="leading-tight">
            <span className="text-muted">{t.common.from} </span>
            <span className="text-[1.4rem] font-bold text-night">{money(category.price, lang)}</span>
          </p>
          <p className="text-[0.95rem] text-muted">{fill(t.categoriesSection.perUnit, { unit: category.unit[lang] })}</p>
        </div>
      </div>
    </Link>
  );
}

/** Swipe row on phones, grid from lg. */
export function CategoryGrid({ lang, t, exclude }: { lang: Lang; t: Dictionary; exclude?: string }) {
  const list = categories.filter((c) => c.id !== exclude);
  // With three columns, a lone card on the last row is shown full width instead.
  const loneLast = list.length % 3 === 1;
  return (
    <ul className="swipe-row lg:mx-0 lg:grid lg:grid-flow-row lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:px-0">
      {list.map((c, i) => {
        const wide = loneLast && i === list.length - 1;
        return (
          <li key={c.id} className={wide ? "lg:col-span-3" : undefined}>
            <CategoryCard category={c} lang={lang} t={t} wide={wide} />
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Why / Seasons ---------- */

export function WhyGrid({ t }: { t: Dictionary }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-4 lg:gap-x-8">
      {t.why.items.map((item, i) => {
        const Icon = whyIcons[i];
        return (
          <div key={item.title}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand sm:h-11 sm:w-11">
              <Icon size={20} aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-lg text-night">{item.title}</h3>
            <p className="mt-1 text-[0.95rem] leading-snug text-muted sm:text-base sm:leading-relaxed">{item.text}</p>
          </div>
        );
      })}
    </div>
  );
}

export function SeasonsGrid({ t }: { t: Dictionary }) {
  return (
    <ul className="swipe-row md:mx-0 md:grid md:grid-flow-row md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0">
      {t.seasons.items.map((s, i) => {
        const Icon = seasonIcons[i];
        return (
          <li key={s.name} className="rounded-2xl border border-white/10 bg-night-2 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <Icon size={22} className="text-glow" aria-hidden="true" />
                <h3 className="text-xl text-white">{s.name}</h3>
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-frost">{s.months}</span>
            </div>
            <p className="mt-3 leading-relaxed text-frost-2">{s.text}</p>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Host teaser ---------- */

/** Example used in the teaser – matches the "half a double garage" calculator preset. */
export function exampleGarageIncome(): number {
  const units: Partial<Record<Category["id"], number>> = { tyres: 10, skis: 4, snowmobile: 1 };
  const total = categories.reduce((sum, c) => sum + hostPayout(c.price) * (units[c.id] ?? 0), 0);
  return roundForDisplay(total);
}

export function HostTeaser({ lang, t }: { lang: Lang; t: Dictionary }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-night text-white lg:grid lg:grid-cols-2">
      <div className="relative aspect-[4/3] lg:order-2 lg:aspect-auto">
        <Photo name="house-harads" lang={lang} sizes="(min-width: 1024px) 50vw, 100vw" className="absolute inset-0 h-full w-full" />
        <div className="absolute bottom-3 left-3 rounded-2xl bg-paper px-4 py-3 text-night shadow-lg">
          <p className="text-xs font-semibold text-muted">{t.calculator.resultLabel}</p>
          <p className="font-display text-2xl font-bold">
            {formatNumber(exampleGarageIncome(), lang)} <span className="font-sans text-sm font-semibold text-muted">{t.common.perMonth}</span>
          </p>
        </div>
      </div>
      <div className="px-5 py-7 sm:px-10 sm:py-12">
        <span className="eyebrow !text-glow">{t.hostTeaser.eyebrow}</span>
        <h2 className="mt-1 text-[2.1rem] leading-[1.08] text-white sm:text-5xl">{t.hostTeaser.title}</h2>
        <p className="mt-3 text-lg leading-relaxed text-frost-2">
          {fill(t.hostTeaser.lead, { amount: formatNumber(exampleGarageIncome(), lang) })}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link prefetch={false} href={`${pagePath("host", lang)}#kalkylator`} className="btn btn-light">
            {t.hostTeaser.cta}
          </Link>
          <Link prefetch={false} href={`${pagePath("host", lang)}#anmalan`} className="btn btn-on-dark">
            {t.hostPage.ctaForm}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- Trust ---------- */

/** Compact rows on phones, cards from sm. */
export function TrustGrid({ t }: { t: Dictionary }) {
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-paper sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:border-0 sm:bg-transparent lg:grid-cols-3">
      {t.trust.items.map((item) => {
        const Icon = trustIcons[item.icon];
        return (
          <li key={item.title} className="flex gap-4 p-4 sm:card sm:block sm:p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pine-soft text-pine sm:h-11 sm:w-11">
              <Icon size={21} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base text-night sm:mt-4 sm:text-lg">{item.title}</h3>
              <p className="mt-0.5 text-[0.95rem] leading-snug text-muted sm:mt-2 sm:text-base sm:leading-relaxed">{item.text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Areas ---------- */

export function AreaChips({
  lang,
  t,
  exclude,
  showFocus = true,
}: {
  lang: Lang;
  t: Dictionary;
  exclude?: string;
  showFocus?: boolean;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
      {areas
        .filter((a) => a.id !== exclude)
        .map((a: Area) => (
          <li key={a.id}>
            <Link prefetch={false}
              href={areaPath(a.slug, lang)}
              className="group card flex h-full items-center justify-between gap-2 px-4 py-3.5 transition-colors hover:border-night/30 sm:px-5 sm:py-4"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-night sm:text-lg">{a.name}</span>
                {showFocus && (
                  <span className={`block text-[0.8rem] font-medium sm:text-sm ${a.focus === "host" ? "text-brand" : "text-pine"}`}>
                    {a.focus === "host" ? t.areasSection.hostFocus : t.areasSection.renterFocus}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
    </ul>
  );
}

/* ---------- Cities ---------- */

/** Links to every city page, with its status (first city or waitlist). */
export function CityChips({ lang, t, exclude }: { lang: Lang; t: Dictionary; exclude?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      {cities
        .filter((c) => c.id !== exclude)
        .map((c) => (
          <li key={c.id}>
            <Link prefetch={false}
              href={cityPath(c.slug, lang)}
              className="card flex h-full flex-col justify-center px-4 py-3.5 transition-colors hover:border-night/30 sm:px-5 sm:py-4"
            >
              <span className="block font-semibold text-night sm:text-lg">{c.name}</span>
              <span className={`block text-[0.8rem] font-medium sm:text-sm ${c.status === "first" ? "text-pine" : "text-muted"}`}>
                {c.status === "first" ? t.cityPage.statusFirst : t.citiesSection.waitlist}
              </span>
            </Link>
          </li>
        ))}
    </ul>
  );
}

/** Home page block: Luleå first (with its districts), then the waitlist cities. */
export function CitiesSection({ lang, t }: { lang: Lang; t: Dictionary }) {
  const first = cities.find((c) => c.status === "first");
  const s = t.citiesSection;
  return (
    <>
      <SectionHeading title={s.title} lead={s.lead} />
      {first && (
        <div className="mt-7 grid overflow-hidden rounded-[1.25rem] bg-night text-white sm:mt-10 md:grid-cols-[1fr_1.3fr]">
          <Photo name={first.photo} lang={lang} sizes="(min-width: 768px) 40vw, 100vw" className="h-44 w-full sm:h-56 md:h-full" />
          <div className="p-5 sm:p-8">
            <p className="text-sm font-semibold text-glow">{s.first}</p>
            <h3 className="mt-1 text-3xl text-white sm:text-4xl">
              <Link prefetch={false} href={cityPath(first.slug, lang)} className="hover:underline hover:decoration-glow hover:underline-offset-6">
                {first.name}
              </Link>
            </h3>
            <p className="mt-2 leading-relaxed text-frost-2">{s.firstText}</p>
            <p className="mt-5 text-sm font-semibold text-frost">{s.districts}</p>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {areas.map((a) => (
                <li key={a.id}>
                  <Link prefetch={false}
                    href={areaPath(a.slug, lang)}
                    className="flex min-h-11 items-center rounded-full border border-white/25 px-4 py-2 text-[0.95rem] font-semibold text-white transition-colors hover:border-white/60"
                  >
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="mt-6">
        <CityChips lang={lang} t={t} exclude={first?.id} />
      </div>
      <p className="mt-6 max-w-xl leading-relaxed text-muted">
        {s.missing}{" "}
        <Link prefetch={false}
          href={`${pagePath("find", lang)}#anmalan`}
          className="font-semibold text-night underline decoration-brand-bright decoration-2 underline-offset-4 hover:decoration-night"
        >
          {s.missingCta}
        </Link>
      </p>
    </>
  );
}

/** Pre-filled form link for a town, e.g. /hitta-forvaring?ort=Göteborg#anmalan. */
export function townFormHref(page: "find" | "host", town: string, lang: Lang): string {
  return `${pagePath(page, lang)}?${RENTER_PARAMS.town}=${encodeURIComponent(town)}#anmalan`;
}

/* ---------- FAQ ---------- */

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-paper">
      {items.map((item) => (
        <details key={item.q} className="group px-4 sm:px-6">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold text-night [&::-webkit-details-marker]:hidden">
            {item.q}
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-frost text-night transition-transform group-open:rotate-45"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 1v12M1 7h12" />
              </svg>
            </span>
          </summary>
          <p className="-mt-1 pb-5 leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/* ---------- Final CTA ---------- */

export function FinalCta({ lang, t }: { lang: Lang; t: Dictionary }) {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl bg-night px-5 py-10 text-center text-white sm:px-10 sm:py-14">
      <Photo name="garage-field" lang={lang} sizes="100vw" decorative className="absolute inset-0 -z-20 h-full w-full opacity-35" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-night/40 to-night/90" />
      <h2 className="text-[2.1rem] leading-[1.08] sm:text-5xl">{t.finalCta.title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-frost">{t.finalCta.lead}</p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link prefetch={false} href={pagePath("find", lang)} className="btn btn-light">
          {t.hero.ctaFind}
        </Link>
        <Link prefetch={false} href={pagePath("host", lang)} className="btn btn-on-dark">
          {t.hero.ctaHost}
        </Link>
      </div>
    </div>
  );
}

/* ---------- Small bits ---------- */

export function CheckList({ items, onDark = false }: { items: string[]; onDark?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${onDark ? "bg-white/10 text-glow" : "bg-pine-soft text-pine"}`}
          >
            <Check size={15} strokeWidth={3} aria-hidden="true" />
          </span>
          <span className={`leading-relaxed ${onDark ? "text-frost" : "text-ink"}`}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export { StepList } from "./StepList";
