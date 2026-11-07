import Link from "next/link";
import { appSearchUrl } from "@/lib/site";
import { CalendarDays, Tag } from "lucide-react";
import { getDictionary } from "@/content";
import type { Category } from "@/content/categories";
import type { City } from "@/content/cities";
import { guides } from "@/content/guides";
import { MobileActionBar } from "@/components/MobileActionBar";
import { RenterCalculator } from "@/components/RenterCalculator";
import {
  CategoryGrid,
  CheckList,
  CityChips,
  Faq,
  HostTeaser,
  PhotoHero,
  priceLabel,
  Section,
  SectionHeading,
  townFormHref,
  TrustGrid,
} from "@/components/sections";
import { fill, type Lang } from "@/lib/i18n";
import { pagePath, RENTER_PARAMS } from "@/lib/routes";
import { RelatedGuides } from "@/views/GuideViews";

/** SEO landing page per storage type, e.g. /forvaring/dackforvaring. */
export function CategoryView({ lang, category }: { lang: Lang; category: Category }) {
  const t = getDictionary(lang);
  const p = t.categoryPage;
  const findHref = `${pagePath("find", lang)}?${RENTER_PARAMS.item}=${category.id}#anmalan`;

  return (
    <>
      <PhotoHero
        photo={category.photo}
        lang={lang}
        eyebrow={<span className="eyebrow !text-glow">{p.eyebrow}</span>}
        title={category.metaTitle[lang].split(" – ")[0]}
        lead={category.intro[lang]}
      >
        {lang === "sv" && (
          <a href={appSearchUrl({ category: category.id })} className="btn btn-light">
            {t.common.seeSpaces}
          </a>
        )}
        <Link prefetch={false} href={findHref} className={lang === "sv" ? "btn btn-on-dark" : "btn btn-light"}>
          {p.ctaFind}
        </Link>
      </PhotoHero>

      <Section>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:gap-8">
          <div className="grid grid-cols-2 gap-3 lg:order-2 lg:grid-cols-1 lg:content-start lg:gap-4">
            <div className="card p-4 sm:p-6">
              <Tag size={20} className="text-brand" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-muted">{p.priceLabel}</p>
              <p className="mt-0.5 text-lg leading-tight font-bold text-night sm:text-2xl">{priceLabel(category, lang, t)}</p>
              <p className="text-sm text-muted sm:text-base">
                {t.categoriesSection.per} {category.unit[lang]}
              </p>
            </div>
            <div className="card p-4 sm:p-6">
              <CalendarDays size={20} className="text-brand" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-muted">{p.seasonLabel}</p>
              <p className="mt-0.5 text-lg leading-tight font-bold text-night sm:text-2xl">{category.season[lang]}</p>
            </div>
            <Link prefetch={false} href={findHref} className="btn btn-primary col-span-2 hidden lg:col-span-1 lg:flex">
              {p.ctaFind}
            </Link>
          </div>
          <div className="card p-5 sm:p-8">
            <h2 className="text-2xl text-night">{category.name[lang]}</h2>
            <p className="mt-1.5 leading-relaxed text-muted">{category.short[lang]}</p>
            <div className="mt-5">
              <CheckList items={category.points[lang]} />
            </div>
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <SectionHeading title={t.renterCalc.title} lead={t.renterCalc.lead} />
        <div className="mt-7 sm:mt-10">
          <RenterCalculator
            lang={lang}
            t={t}
            formHref={findHref}
            initial={{ [category.id]: category.id === "boxes" ? 4 : 1 }}
            initialMonths={category.id === "boxes" ? 3 : 6}
          />
        </div>
      </Section>

      <Section tone="frost">
        <SectionHeading title={t.trust.title} />
        <div className="mt-7 sm:mt-10">
          <TrustGrid t={t} />
        </div>
      </Section>

      <Section>
        <HostTeaser lang={lang} t={t} />
      </Section>

      <Section tone="paper">
        <SectionHeading title={p.otherTitle} />
        <div className="mt-7">
          <CategoryGrid lang={lang} t={t} exclude={category.id} />
        </div>
        <h2 className="mt-12 text-2xl text-night">{p.areasTitle}</h2>
        <div className="mt-5">
          <CityChips lang={lang} />
        </div>
        <div className="mt-12">
          <RelatedGuides lang={lang} items={guides.filter((g) => g.categories.includes(category.id))} />
        </div>
      </Section>

      <MobileActionBar primary={{ href: findHref, label: t.actionBar.renterForm }} />
    </>
  );
}

/** Page per city, e.g. /stad/goteborg. */
export function CityView({ lang, city }: { lang: Lang; city: City }) {
  const t = getDictionary(lang);
  const p = t.cityPage;
  const findHref = townFormHref("find", city.name, lang);
  const hostHref = townFormHref("host", city.name, lang);
  const vars = { name: city.name };

  return (
    <>
      <PhotoHero
        photo={city.photo}
        lang={lang}
        eyebrow={<span className="eyebrow !text-glow">{t.common.launchBadge}</span>}
        title={fill(p.title, vars)}
        lead={city.intro[lang]}
      >
        {lang === "sv" ? (
          <a href={appSearchUrl({ place: city.name })} className="btn btn-light">
            {fill(p.seeSpaces, vars)}
          </a>
        ) : (
          <Link prefetch={false} href={findHref} className="btn btn-light">
            {fill(p.renterCta, vars)}
          </Link>
        )}
        <Link prefetch={false} href={hostHref} className="btn btn-on-dark">
          {fill(p.hostCta, vars)}
        </Link>
      </PhotoHero>

      <Section>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <div className="card flex flex-col p-5 sm:p-8">
            <h2 className="text-2xl leading-snug text-night">{fill(p.renterTitle, vars)}</h2>
            <p className="mt-2 flex-1 leading-relaxed text-muted">{fill(p.renterText, vars)}</p>
            <Link prefetch={false} href={findHref} className="btn btn-primary mt-5 sm:self-start">
              {t.hero.ctaFind}
            </Link>
          </div>
          <div className="flex flex-col rounded-[1.25rem] bg-night p-5 text-white sm:p-8">
            <h2 className="text-2xl leading-snug">{fill(p.hostTitle, vars)}</h2>
            <p className="mt-2 flex-1 leading-relaxed text-frost-2">{p.hostText}</p>
            <Link prefetch={false} href={hostHref} className="btn btn-light mt-5 sm:self-start">
              {t.hero.ctaHost}
            </Link>
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <SectionHeading title={p.categoriesTitle} lead={t.categoriesSection.lead} />
        <div className="mt-7 sm:mt-10">
          <CategoryGrid lang={lang} t={t} />
        </div>
      </Section>

      <Section tone="frost">
        <SectionHeading title={t.trust.title} lead={t.trust.lead} />
        <div className="mt-7 sm:mt-10">
          <TrustGrid t={t} />
        </div>
      </Section>

      <Section>
        <div className="grid gap-7 lg:grid-cols-[1fr_1.6fr] lg:gap-10">
          <SectionHeading title={t.faq.title} />
          <Faq items={t.faq.general.slice(0, 6)} />
        </div>
        <h2 className="mt-12 text-2xl text-night">{p.otherCities}</h2>
        <div className="mt-5">
          <CityChips lang={lang} exclude={city.id} />
        </div>
      </Section>

      <MobileActionBar primary={{ href: findHref, label: t.actionBar.find }} secondary={{ href: hostHref, label: t.actionBar.host }} />
    </>
  );
}
