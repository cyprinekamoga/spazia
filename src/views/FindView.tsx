import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { getDictionary } from "@/content";
import { categories } from "@/content/categories";
import { getGuide } from "@/content/guides";
import { guidePath } from "@/lib/routes";
import { renterPrice } from "@/content/pricing";
import { MobileActionBar } from "@/components/MobileActionBar";
import { RenterCalculator } from "@/components/RenterCalculator";
import { RenterSignupLink } from "@/components/HostSignupLink";
import { categoryIcons } from "@/components/Icons";
import { Faq, PhotoHero, Section, SectionHeading } from "@/components/sections";
import { formatNumber, type Lang } from "@/lib/i18n";
import { appSearchUrl, renterSignupUrl } from "@/lib/site";

export function FindView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.findPage;

  return (
    <>
      <PhotoHero
        photo="moving"
        lang={lang}
        eyebrow={<span className="eyebrow !text-glow">{p.eyebrow}</span>}
        title={p.title}
        lead={p.lead}
      >
        <RenterSignupLink lang={lang} className="btn btn-light">
          {p.ctaSignup}
        </RenterSignupLink>
        <a href={appSearchUrl()} className="btn btn-on-dark">
          {t.common.seeSpaces}
        </a>
      </PhotoHero>

      <Section id="anmalan">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          {/* Phones: heading and button → prices → student tip. Desktop: how it works left, prices and student tip right. */}
          <div className="order-1">
            <SectionHeading title={p.formTitle} lead={p.formLead} />
            <ol className="mt-6 space-y-3">
              {p.steps.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-night text-base font-bold text-glow">{i + 1}</span>
                  <span className="leading-snug text-ink">{step}</span>
                </li>
              ))}
            </ol>
            <RenterSignupLink lang={lang} className="btn btn-primary mt-6">
              {p.ctaSignup}
            </RenterSignupLink>
          </div>
          <div className="contents lg:block lg:space-y-6">

          <div className="card order-3 p-5">
            <h3 className="text-lg text-night">{p.pricesTitle}</h3>
            <p className="mt-1 text-sm text-muted">{p.pricesLead}</p>
            <ul className="mt-3 divide-y divide-line">
              {categories.map((c) => {
                const Icon = categoryIcons[c.id];
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-[0.95rem]">
                    <span className="flex items-center gap-2.5">
                      <Icon size={18} className="text-brand" />
                      <span className="font-medium text-night">{c.name[lang]}</span>
                    </span>
                    <span className="text-right text-muted tabular-nums">
                      <span className="font-semibold text-night">
                        {formatNumber(renterPrice(c.price, false, c.heatedMatters), lang)} {t.common.currency}
                      </span>{" "}
                      / {c.unit[lang]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-sm text-muted">{p.heatedNote}</p>
          </div>

          <div className="order-4 rounded-2xl bg-night p-5 text-white">
            <div className="flex items-center gap-2.5">
              <GraduationCap size={22} className="text-glow" aria-hidden="true" />
              <h3 className="text-lg text-white">{p.studentTitle}</h3>
            </div>
            <p className="mt-2 leading-relaxed text-frost-2">{p.studentText}</p>
            <Link
              prefetch={false}
              href={guidePath(getGuide("student-summer").slug, lang)}
              className="mt-3 inline-flex min-h-11 items-center font-semibold text-white underline decoration-glow decoration-2 underline-offset-4 hover:decoration-white"
            >
              {getGuide("student-summer").title[lang]}
            </Link>
          </div>
          </div>
        </div>
      </Section>

      <Section tone="paper" id="pris">
        <SectionHeading title={t.renterCalc.title} lead={t.renterCalc.lead} />
        <div className="mt-7 sm:mt-10">
          <RenterCalculator lang={lang} t={t} formHref={renterSignupUrl(lang)} />
        </div>
      </Section>

      <Section>
        <div className="grid gap-7 lg:grid-cols-[1fr_1.6fr] lg:gap-10">
          <SectionHeading title={p.faqTitle} />
          <Faq items={t.faq.general.slice(1)} />
        </div>
      </Section>

      <MobileActionBar primary={{ href: renterSignupUrl(lang), label: t.actionBar.renterForm, track: "renter" }} />
    </>
  );
}
