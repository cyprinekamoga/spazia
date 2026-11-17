import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { getDictionary, type Dictionary } from "@/content";
import { getCategory } from "@/content/categories";
import { getCity } from "@/content/cities";
import { studentCategories, universities, type University } from "@/content/universities";
import { categoryIcons } from "@/components/Icons";
import { MobileActionBar } from "@/components/MobileActionBar";
import { CheckList, FinalCta, PhotoHero, priceLabel, Section, SectionHeading } from "@/components/sections";
import { fill, type Lang } from "@/lib/i18n";
import { cityPath, pagePath, universityPath } from "@/lib/routes";
import { appSearchUrl, renterSignupUrl } from "@/lib/site";

/** Create an account in the app and search for box storage, with the town filled in. */
function findHref(lang: Lang, town?: string): string {
  return renterSignupUrl(lang, { place: town, category: "boxes" });
}

function StudentPrices({ lang, t }: { lang: Lang; t: Dictionary }) {
  const p = t.studentPage;
  return (
    <>
      <SectionHeading title={p.pricesTitle} lead={p.pricesLead} />
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 lg:grid-cols-4 lg:gap-4">
        {studentCategories.map((id) => {
          const c = getCategory(id);
          const Icon = categoryIcons[id];
          return (
            <li key={id} className="card p-4 sm:p-5">
              <Icon size={24} className="text-brand" aria-hidden="true" />
              <p className="mt-2 font-semibold text-night">{c.name[lang]}</p>
              <p className="mt-0.5 text-lg font-bold text-night">{priceLabel(c, lang, t)}</p>
              <p className="text-sm text-muted">
                {t.categoriesSection.per} {c.unit[lang]}
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function UniversityList({ lang, exclude }: { lang: Lang; exclude?: string }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {universities
        .filter((u) => u.slug !== exclude)
        .map((u) => (
          <li key={u.slug}>
            <Link prefetch={false} href={universityPath(u.slug, lang)} className="card flex min-h-16 items-center justify-between gap-3 p-4 hover:border-night/30">
              <span className="min-w-0">
                <span className="block font-bold text-night">{u.name[lang]}</span>
                <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                  <MapPin size={14} aria-hidden="true" />
                  {u.town}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
    </ul>
  );
}

/** /student: storage for students, with a page per university. */
export function StudentsView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.studentPage;
  return (
    <>
      <PhotoHero photo="boxes" lang={lang} eyebrow={<span className="eyebrow !text-glow">{p.eyebrow}</span>} title={p.title} lead={p.lead}>
        {lang === "sv" ? (
          <a href={appSearchUrl({ category: "boxes" })} className="btn btn-light">
            {t.common.seeSpaces}
          </a>
        ) : null}
        <Link prefetch={false} href={findHref(lang)} className={lang === "sv" ? "btn btn-on-dark" : "btn btn-light"}>
          {p.signUp}
        </Link>
      </PhotoHero>

      <Section>
        <div className="grid gap-7 lg:grid-cols-[1fr_1.4fr] lg:gap-10">
          <SectionHeading title={p.whyTitle} />
          <CheckList items={p.why} />
        </div>
      </Section>

      <Section tone="paper">
        <StudentPrices lang={lang} t={t} />
      </Section>

      <Section>
        <SectionHeading title={p.listTitle} />
        <div className="mt-6 sm:mt-8">
          <UniversityList lang={lang} />
        </div>
        <div className="mt-10 rounded-[1.25rem] bg-frost/70 p-5 sm:p-8">
          <h2 className="text-2xl text-night">{p.otherTitle}</h2>
          <p className="mt-2 leading-relaxed text-muted">{p.otherText}</p>
          {lang === "sv" ? (
            <a href={appSearchUrl()} className="btn btn-primary mt-5">
              {p.searchCta}
            </a>
          ) : (
            <Link prefetch={false} href={findHref(lang)} className="btn btn-primary mt-5">
              {p.searchCta}
            </Link>
          )}
        </div>
      </Section>

      <Section tone="paper">
        <FinalCta lang={lang} t={t} />
      </Section>

      <MobileActionBar primary={{ href: findHref(lang), label: t.actionBar.find, track: "renter" }} secondary={{ href: pagePath("host", lang), label: t.actionBar.host }} />
    </>
  );
}

/** /student/<university>: the same offer, for one university and its town. */
export function UniversityView({ lang, university: u }: { lang: Lang; university: University }) {
  const t = getDictionary(lang);
  const p = t.studentPage;
  const city = getCity(u.citySlug);
  const cityName = city?.name ?? u.town;
  const signUp = findHref(lang, u.town);

  return (
    <>
      <PhotoHero
        photo={u.photo}
        lang={lang}
        eyebrow={<span className="eyebrow !text-glow">{u.short}</span>}
        title={fill(p.uniTitle, { name: u.name[lang] })}
        lead={u.intro[lang]}
      >
        {lang === "sv" && (
          <a href={appSearchUrl({ place: u.town })} className="btn btn-light">
            {fill(p.seeSpaces, { city: u.town })}
          </a>
        )}
        <Link prefetch={false} href={signUp} className={lang === "sv" ? "btn btn-on-dark" : "btn btn-light"}>
          {p.signUp}
        </Link>
      </PhotoHero>

      <Section>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <div className="card p-5 sm:p-8">
            <h2 className="text-2xl leading-snug text-night">{p.campusesTitle}</h2>
            <ul className="mt-4 space-y-2.5">
              {u.campuses.map((campus) => (
                <li key={campus} className="flex items-start gap-2.5 text-ink">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                  {campus}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5 sm:p-8">
            <h2 className="mb-4 text-2xl leading-snug text-night">{fill(p.tipsTitle, { city: u.town })}</h2>
            <CheckList items={u.tips[lang]} />
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <div className="grid gap-7 lg:grid-cols-[1fr_1.4fr] lg:gap-10">
          <SectionHeading title={p.whyTitle} />
          <CheckList items={p.why} />
        </div>
        <div className="mt-12">
          <StudentPrices lang={lang} t={t} />
        </div>
      </Section>

      <Section>
        {city && (
          <Link prefetch={false} href={cityPath(city.slug, lang)} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-night underline underline-offset-4">
            {fill(p.cityLink, { city: cityName })}
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        )}
        <h2 className="mt-8 text-2xl text-night">{p.allUniversities}</h2>
        <div className="mt-5">
          <UniversityList lang={lang} exclude={u.slug} />
        </div>
      </Section>

      <MobileActionBar primary={{ href: signUp, label: t.actionBar.find }} secondary={{ href: pagePath("host", lang), label: t.actionBar.host }} />
    </>
  );
}
