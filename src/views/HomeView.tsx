import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { getDictionary } from "@/content";
import { categories } from "@/content/categories";
import { HowItWorks } from "@/components/HowItWorks";
import { categoryIcons } from "@/components/Icons";
import { MobileActionBar } from "@/components/MobileActionBar";
import {
  AreaChips,
  CategoryGrid,
  Faq,
  FinalCta,
  HostTeaser,
  PhotoHero,
  Section,
  SectionHeading,
  SeasonsGrid,
  TrustGrid,
  WhyGrid,
} from "@/components/sections";
import type { Lang } from "@/lib/i18n";
import { pagePath, RENTER_PARAMS } from "@/lib/routes";

export function HomeView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const findPath = pagePath("find", lang);

  return (
    <>
      <PhotoHero
        photo="garage-night"
        lang={lang}
        size="home"
        imageClassName="max-sm:-translate-y-[17%]"
        title={t.hero.title}
        lead={t.hero.lead}
        eyebrow={
          <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-glow opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-glow" />
            </span>
            {t.common.launchBadge}
          </span>
        }
      >
        <Link prefetch={false} href={findPath} className="btn btn-light">
          {t.hero.ctaFind}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link prefetch={false} href={pagePath("host", lang)} className="btn btn-on-dark">
          {t.hero.ctaHost}
        </Link>
      </PhotoHero>

      {/* Trust line + quick picker */}
      <section className="border-b border-line bg-paper">
        <div className="container-page py-5 sm:py-7">
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.9rem] font-medium text-ink/80">
            {t.hero.trustline.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check size={16} strokeWidth={3} className="text-pine" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm font-semibold text-muted">{t.hero.chipsLabel}</p>
          <ul className="swipe-row mt-2.5 !auto-cols-max lg:mx-0 lg:flex lg:flex-wrap lg:gap-2 lg:overflow-visible lg:px-0">
            {categories.map((c) => {
              const Icon = categoryIcons[c.id];
              return (
                <li key={c.id}>
                  <Link prefetch={false}
                    href={`${findPath}?${RENTER_PARAMS.item}=${c.id}#anmalan`}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-snow px-4 py-2.5 font-semibold whitespace-nowrap text-night transition-colors hover:border-night/40"
                  >
                    <Icon size={19} className="shrink-0 text-brand" />
                    <span className="text-[0.95rem]">{c.name[lang]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <Section>
        <SectionHeading title={t.how.title} />
        <div className="mt-6 sm:mt-8">
          <HowItWorks t={t} />
        </div>
      </Section>

      <Section tone="paper">
        <SectionHeading title={t.categoriesSection.title} lead={t.categoriesSection.lead} />
        <div className="mt-7 sm:mt-10">
          <CategoryGrid lang={lang} t={t} />
        </div>
      </Section>

      <Section>
        <SectionHeading title={t.why.title} />
        <div className="mt-7 sm:mt-10">
          <WhyGrid t={t} />
        </div>
      </Section>

      <Section tone="night">
        <SectionHeading title={t.seasons.title} lead={t.seasons.lead} onDark />
        <div className="mt-7 sm:mt-10">
          <SeasonsGrid t={t} />
        </div>
      </Section>

      <Section>
        <HostTeaser lang={lang} t={t} />
      </Section>

      <Section tone="frost">
        <SectionHeading title={t.trust.title} lead={t.trust.lead} />
        <div className="mt-7 sm:mt-10">
          <TrustGrid t={t} />
        </div>
        <Link prefetch={false}
          href={pagePath("trust", lang)}
          className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-night underline decoration-brand-bright decoration-2 underline-offset-6 hover:decoration-night"
        >
          {t.trust.link}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </Section>

      <Section>
        <SectionHeading title={t.areasSection.title} lead={t.areasSection.lead} />
        <div className="mt-7 sm:mt-10">
          <AreaChips lang={lang} t={t} />
        </div>
      </Section>

      <Section tone="paper">
        <div className="grid gap-7 lg:grid-cols-[1fr_1.6fr] lg:gap-10">
          <SectionHeading title={t.faq.title} />
          <Faq items={t.faq.general} />
        </div>
      </Section>

      <Section>
        <FinalCta lang={lang} t={t} />
      </Section>

      <MobileActionBar
        primary={{ href: findPath, label: t.actionBar.find }}
        secondary={{ href: pagePath("host", lang), label: t.actionBar.host }}
      />
    </>
  );
}
