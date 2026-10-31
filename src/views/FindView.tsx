import { ArrowRight, GraduationCap } from "lucide-react";
import { getDictionary } from "@/content";
import { categories } from "@/content/categories";
import { renterPrice } from "@/content/pricing";
import { MobileActionBar } from "@/components/MobileActionBar";
import { RenterForm } from "@/components/forms/RenterForm";
import { categoryIcons } from "@/components/Icons";
import { Faq, PhotoHero, Section, SectionHeading } from "@/components/sections";
import { formatNumber, type Lang } from "@/lib/i18n";

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
        <a href="#anmalan" className="btn btn-light">
          {p.formTitle}
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </PhotoHero>

      <Section id="anmalan">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.7fr] lg:gap-10">
          {/* Phones: heading → form → prices → student tip. Desktop: info left, form right. */}
          <div className="order-2 lg:col-start-2 lg:row-start-1">
            <RenterForm lang={lang} t={t} />
          </div>
          <div className="contents lg:col-start-1 lg:row-start-1 lg:block lg:space-y-6">
          <div className="order-1">
            <SectionHeading title={p.formTitle} lead={p.formLead} />
          </div>

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
                    <span className="text-right text-muted">
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
          </div>
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <div className="grid gap-7 lg:grid-cols-[1fr_1.6fr] lg:gap-10">
          <SectionHeading title={p.faqTitle} />
          <Faq items={t.faq.general.slice(1)} />
        </div>
      </Section>

      <MobileActionBar primary={{ href: "#anmalan", label: t.actionBar.renterForm }} hideWhenVisibleId="anmalan" />
    </>
  );
}
