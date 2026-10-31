import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { getDictionary } from "@/content";
import { categories } from "@/content/categories";
import { HeroIllustration } from "@/components/HeroIllustration";
import { HowItWorks } from "@/components/HowItWorks";
import { categoryIcons } from "@/components/Icons";
import {
  AreaChips,
  CategoryGrid,
  Faq,
  FinalCta,
  HostTeaser,
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
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-glow/30 blur-3xl"
        />
        <div className="container-page relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-night">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember-soft opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ember-soft" />
              </span>
              {t.common.launchBadge}
            </span>
            <h1 className="mt-5 text-[2.6rem] leading-[1.05] font-extrabold text-night sm:text-6xl">{t.hero.title}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t.hero.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={findPath} className="btn btn-primary">
                {t.hero.ctaFind}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href={pagePath("host", lang)} className="btn btn-secondary">
                {t.hero.ctaHost}
              </Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem] font-medium text-ink/80">
              {t.hero.trustline.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check size={17} strokeWidth={3} className="text-pine" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[28px] shadow-[0_30px_60px_-30px_rgb(14_27_51/0.6)]">
              <HeroIllustration title={t.hero.illustrationAlt} />
            </div>
          </div>
        </div>

        {/* Quick picker */}
        <div className="container-page relative pb-14">
          <div className="card p-4 sm:p-5">
            <p className="px-1 text-sm font-semibold text-muted">{t.hero.chipsLabel}</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {categories.map((c) => {
                const Icon = categoryIcons[c.id];
                return (
                  <li key={c.id}>
                    <Link
                      href={`${findPath}?${RENTER_PARAMS.item}=${c.id}#anmalan`}
                      className="flex h-full items-center gap-2.5 rounded-xl border border-line px-3 py-3 font-semibold text-night transition-colors hover:border-night/40 hover:bg-snow"
                    >
                      <Icon size={22} className="shrink-0 text-ember" />
                      <span className="text-[0.95rem] leading-tight">{c.name[lang]}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <Section tone="paper">
        <SectionHeading title={t.how.title} />
        <div className="mt-8">
          <HowItWorks t={t} />
        </div>
      </Section>

      <Section>
        <SectionHeading title={t.categoriesSection.title} lead={t.categoriesSection.lead} />
        <div className="mt-10">
          <CategoryGrid lang={lang} t={t} />
        </div>
      </Section>

      <Section tone="paper">
        <SectionHeading title={t.why.title} />
        <div className="mt-10">
          <WhyGrid t={t} />
        </div>
      </Section>

      <Section tone="night">
        <SectionHeading title={t.seasons.title} lead={t.seasons.lead} onDark />
        <div className="mt-10">
          <SeasonsGrid t={t} />
        </div>
      </Section>

      <Section>
        <HostTeaser lang={lang} t={t} />
      </Section>

      <Section tone="frost">
        <SectionHeading title={t.trust.title} lead={t.trust.lead} />
        <div className="mt-10">
          <TrustGrid t={t} />
        </div>
        <Link
          href={pagePath("trust", lang)}
          className="mt-8 inline-flex items-center gap-2 font-semibold text-night underline decoration-ember-soft decoration-2 underline-offset-6 hover:decoration-night"
        >
          {t.trust.link}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </Section>

      <Section>
        <SectionHeading title={t.areasSection.title} lead={t.areasSection.lead} />
        <div className="mt-10">
          <AreaChips lang={lang} t={t} />
        </div>
      </Section>

      <Section tone="paper">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading title={t.faq.title} />
          <Faq items={t.faq.general} />
        </div>
      </Section>

      <Section>
        <FinalCta lang={lang} t={t} />
      </Section>
    </>
  );
}
