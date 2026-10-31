import Link from "next/link";
import { ArrowRight, CalendarDays, Tag } from "lucide-react";
import { getDictionary } from "@/content";
import type { Area } from "@/content/areas";
import type { Category } from "@/content/categories";
import { categoryIcons } from "@/components/Icons";
import {
  AreaChips,
  CategoryGrid,
  CheckList,
  Faq,
  HostTeaser,
  PageHero,
  priceLabel,
  Section,
  SectionHeading,
  TrustGrid,
} from "@/components/sections";
import { fill, type Lang } from "@/lib/i18n";
import { pagePath, RENTER_PARAMS } from "@/lib/routes";

/** SEO landing page per storage type, e.g. /forvaring/dackforvaring. */
export function CategoryView({ lang, category }: { lang: Lang; category: Category }) {
  const t = getDictionary(lang);
  const p = t.categoryPage;
  const Icon = categoryIcons[category.id];
  const findHref = `${pagePath("find", lang)}?${RENTER_PARAMS.item}=${category.id}#anmalan`;

  return (
    <>
      <PageHero eyebrow={p.eyebrow} title={category.metaTitle[lang].split(" – ")[0]} lead={category.intro[lang]}>
        <Link href={findHref} className="btn btn-primary">
          {p.ctaFind}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </PageHero>

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="card p-6 sm:p-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-glow-soft text-ember">
              <Icon size={30} />
            </span>
            <h2 className="mt-5 text-2xl font-bold text-night">{category.name[lang]}</h2>
            <p className="mt-2 leading-relaxed text-muted">{category.short[lang]}</p>
            <div className="mt-6">
              <CheckList items={category.points[lang]} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="card flex items-start gap-4 p-6">
              <Tag size={22} className="mt-1 shrink-0 text-ember" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-muted">{p.priceLabel}</p>
                <p className="mt-1 text-2xl font-bold text-night">{priceLabel(category, lang, t)}</p>
                <p className="text-muted">
                  {t.categoriesSection.per} {category.unit[lang]}
                </p>
              </div>
            </div>
            <div className="card flex items-start gap-4 p-6">
              <CalendarDays size={22} className="mt-1 shrink-0 text-ember" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-muted">{p.seasonLabel}</p>
                <p className="mt-1 text-2xl font-bold text-night">{category.season[lang]}</p>
              </div>
            </div>
            <Link href={findHref} className="btn btn-primary w-full">
              {p.ctaFind}
            </Link>
          </div>
        </div>
      </Section>

      <Section tone="frost">
        <SectionHeading title={t.trust.title} />
        <div className="mt-10">
          <TrustGrid t={t} />
        </div>
      </Section>

      <Section>
        <HostTeaser lang={lang} t={t} />
      </Section>

      <Section tone="paper">
        <SectionHeading title={p.otherTitle} />
        <div className="mt-8">
          <CategoryGrid lang={lang} t={t} exclude={category.id} />
        </div>
        <h2 className="mt-14 text-2xl font-bold text-night">{p.areasTitle}</h2>
        <div className="mt-6">
          <AreaChips lang={lang} t={t} showFocus={false} />
        </div>
      </Section>
    </>
  );
}

/** SEO landing page per area, e.g. /omrade/gammelstad. */
export function AreaView({ lang, area }: { lang: Lang; area: Area }) {
  const t = getDictionary(lang);
  const p = t.areaPage;
  const findHref = `${pagePath("find", lang)}?${RENTER_PARAMS.area}=${area.slug}#anmalan`;
  const hostHref = `${pagePath("host", lang)}#anmalan`;

  const renterCard = (
    <div className="card flex flex-col p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-night">{fill(p.renterTitle, { name: area.name })}</h2>
      <p className="mt-3 flex-1 leading-relaxed text-muted">{area.renterPitch[lang]}</p>
      <Link href={findHref} className="btn btn-primary mt-6 self-start">
        {t.hero.ctaFind}
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  );
  const hostCard = (
    <div className="flex flex-col rounded-[1.25rem] bg-night p-6 text-white sm:p-8">
      <h2 className="text-2xl font-bold">{fill(p.hostTitle, { name: area.name })}</h2>
      <p className="mt-3 flex-1 leading-relaxed text-frost-2">{area.hostPitch[lang]}</p>
      <Link href={hostHref} className="btn btn-primary mt-6 self-start">
        {t.hero.ctaHost}
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  );

  return (
    <>
      <PageHero eyebrow={`${p.eyebrow} · Luleå`} title={fill(p.titleRenter, { name: area.name })} lead={area.intro[lang]} />

      <Section>
        <div className="grid gap-4 md:grid-cols-2">
          {area.focus === "host" ? (
            <>
              {hostCard}
              {renterCard}
            </>
          ) : (
            <>
              {renterCard}
              {hostCard}
            </>
          )}
        </div>
      </Section>

      <Section tone="paper">
        <SectionHeading title={p.categoriesTitle} lead={t.categoriesSection.lead} />
        <div className="mt-10">
          <CategoryGrid lang={lang} t={t} />
        </div>
      </Section>

      <Section tone="frost">
        <SectionHeading title={t.trust.title} />
        <div className="mt-10">
          <TrustGrid t={t} />
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading title={t.faq.title} />
          <Faq items={t.faq.general.slice(2, 7)} />
        </div>
        <h2 className="mt-16 text-2xl font-bold text-night">{p.otherAreas}</h2>
        <div className="mt-6">
          <AreaChips lang={lang} t={t} exclude={area.id} />
        </div>
      </Section>
    </>
  );
}
