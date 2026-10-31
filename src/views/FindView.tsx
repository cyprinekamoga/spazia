import { ArrowRight, GraduationCap } from "lucide-react";
import { getDictionary } from "@/content";
import { categories } from "@/content/categories";
import { renterPrice } from "@/content/pricing";
import { RenterForm } from "@/components/forms/RenterForm";
import { categoryIcons } from "@/components/Icons";
import { Faq, PageHero, Section, SectionHeading } from "@/components/sections";
import { formatNumber, type Lang } from "@/lib/i18n";

export function FindView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.findPage;

  return (
    <>
      <PageHero eyebrow={p.eyebrow} title={p.title} lead={p.lead}>
        <a href="#anmalan" className="btn btn-primary">
          {p.formTitle}
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </PageHero>

      <Section id="anmalan">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.7fr]">
          <div className="space-y-6">
            <SectionHeading title={p.formTitle} lead={p.formLead} />

            <div className="card p-5">
              <h3 className="text-lg font-bold text-night">{p.pricesTitle}</h3>
              <p className="mt-1 text-sm text-muted">{p.pricesLead}</p>
              <ul className="mt-4 divide-y divide-line">
                {categories.map((c) => {
                  const Icon = categoryIcons[c.id];
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-[0.95rem]">
                      <span className="flex items-center gap-2.5">
                        <Icon size={18} className="text-ember" />
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

            <div className="rounded-2xl bg-night p-5 text-white">
              <div className="flex items-center gap-2.5">
                <GraduationCap size={22} className="text-glow" aria-hidden="true" />
                <h3 className="text-lg font-bold">{p.studentTitle}</h3>
              </div>
              <p className="mt-2 leading-relaxed text-frost-2">{p.studentText}</p>
            </div>
          </div>

          <RenterForm lang={lang} t={t} />
        </div>
      </Section>

      <Section tone="paper">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading title={p.faqTitle} />
          <Faq items={t.faq.general.slice(1)} />
        </div>
      </Section>
    </>
  );
}
