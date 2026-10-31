import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";
import type { Dictionary } from "@/content";
import { areas, type Area } from "@/content/areas";
import { categories, type Category } from "@/content/categories";
import { hostPayout, roundForDisplay } from "@/content/pricing";
import { fill, formatNumber, type Lang } from "@/lib/i18n";
import { areaPath, categoryPath, pagePath } from "@/lib/routes";
import { categoryIcons, seasonIcons, trustIcons, whyIcons } from "./Icons";

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
    frost: "bg-frost/60",
  };
  return (
    <section id={id} className={`${tones[tone]} py-16 sm:py-20 ${className}`}>
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
      <h2 className={`mt-2 text-3xl font-bold sm:text-4xl ${onDark ? "text-white" : "text-night"}`}>{title}</h2>
      {lead && (
        <p className={`mt-4 text-lg leading-relaxed ${onDark ? "text-frost-2" : "text-muted"}`}>{lead}</p>
      )}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-night text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[-10%] h-80 w-[60%] rounded-full bg-[#3ee6b0]/15 blur-3xl"
      />
      <div className="container-page relative py-14 sm:py-20">
        <span className="eyebrow !text-glow">{eyebrow}</span>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-frost-2">{lead}</p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}

/* ---------- Categories ---------- */

export function priceLabel(category: Category, lang: Lang, t: Dictionary) {
  return `${t.common.from} ${formatNumber(category.price, lang)} ${t.common.perMonth}`;
}

export function CategoryCard({ category, lang, t }: { category: Category; lang: Lang; t: Dictionary }) {
  const Icon = categoryIcons[category.id];
  return (
    <Link
      href={categoryPath(category.slug, lang)}
      className="group card flex h-full flex-col p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-night/30 hover:shadow-[0_12px_30px_-18px_rgb(14_27_51/0.5)]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-glow-soft text-ember">
        <Icon size={26} />
      </span>
      <h3 className="mt-4 text-xl font-bold text-night">{category.name[lang]}</h3>
      <p className="mt-1.5 flex-1 text-[0.95rem] leading-relaxed text-muted">{category.short[lang]}</p>
      <p className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4 text-[0.95rem]">
        <span>
          <span className="font-semibold text-night">{priceLabel(category, lang, t)}</span>
          <span className="text-muted">
            {" "}
            · {t.categoriesSection.per} {category.unit[lang]}
          </span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-ember transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </p>
    </Link>
  );
}

export function CategoryGrid({
  lang,
  t,
  exclude,
}: {
  lang: Lang;
  t: Dictionary;
  exclude?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories
        .filter((c) => c.id !== exclude)
        .map((c) => (
          <CategoryCard key={c.id} category={c} lang={lang} t={t} />
        ))}
    </div>
  );
}

/* ---------- Why / Seasons ---------- */

export function WhyGrid({ t }: { t: Dictionary }) {
  return (
    <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {t.why.items.map((item, i) => {
        const Icon = whyIcons[i];
        return (
          <div key={item.title}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-night text-glow">
              <Icon size={22} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-xl font-bold text-night">{item.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{item.text}</p>
          </div>
        );
      })}
    </div>
  );
}

export function SeasonsGrid({ t }: { t: Dictionary }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {t.seasons.items.map((s, i) => {
        const Icon = seasonIcons[i];
        return (
          <div key={s.name} className="rounded-2xl border border-white/10 bg-night-2 p-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <Icon size={22} className="text-glow" aria-hidden="true" />
                <h3 className="text-xl font-bold text-white">{s.name}</h3>
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-frost">{s.months}</span>
            </div>
            <p className="mt-4 leading-relaxed text-frost-2">{s.text}</p>
          </div>
        );
      })}
    </div>
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
    <div className="relative overflow-hidden rounded-3xl bg-night px-6 py-10 text-white sm:px-10 sm:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -bottom-24 h-72 w-72 rounded-full bg-[#3ee6b0]/15 blur-3xl" />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <span className="eyebrow !text-glow">{t.hostTeaser.eyebrow}</span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t.hostTeaser.title}</h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-frost-2">
            {fill(t.hostTeaser.lead, { amount: formatNumber(exampleGarageIncome(), lang) })}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
          <Link href={`${pagePath("host", lang)}#kalkylator`} className="btn btn-primary">
            {t.hostTeaser.cta}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link href={`${pagePath("host", lang)}#anmalan`} className="btn btn-on-dark">
            {t.hostPage.ctaForm}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- Trust ---------- */

export function TrustGrid({ t }: { t: Dictionary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {t.trust.items.map((item) => {
        const Icon = trustIcons[item.icon];
        return (
          <div key={item.title} className="card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-pine-soft text-pine">
              <Icon size={22} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-night">{item.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{item.text}</p>
          </div>
        );
      })}
    </div>
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
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {areas
        .filter((a) => a.id !== exclude)
        .map((a: Area) => (
          <li key={a.id}>
            <Link
              href={areaPath(a.slug, lang)}
              className="group card flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-night/30"
            >
              <span>
                <span className="block text-lg font-bold text-night">{a.name}</span>
                {showFocus && (
                  <span className={`text-sm font-medium ${a.focus === "host" ? "text-ember" : "text-pine"}`}>
                    {a.focus === "host" ? t.areasSection.hostFocus : t.areasSection.renterFocus}
                  </span>
                )}
              </span>
              <ArrowRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
    </ul>
  );
}

/* ---------- FAQ ---------- */

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-paper">
      {items.map((item) => (
        <details key={item.q} className="group px-5 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-[1.05rem] font-semibold text-night [&::-webkit-details-marker]:hidden">
            {item.q}
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-frost/70 text-night transition-transform group-open:rotate-45"
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
    <div className="card relative overflow-hidden px-6 py-12 text-center sm:px-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-2/3 rounded-full bg-glow/30 blur-3xl" />
      <div className="relative">
        <h2 className="text-3xl font-bold text-night sm:text-4xl">{t.finalCta.title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted">{t.finalCta.lead}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={pagePath("find", lang)} className="btn btn-primary">
            {t.hero.ctaFind}
          </Link>
          <Link href={pagePath("host", lang)} className="btn btn-secondary">
            {t.hero.ctaHost}
          </Link>
        </div>
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
