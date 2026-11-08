import { Building2, GraduationCap, Landmark, Store } from "lucide-react";
import { getDictionary } from "@/content";
import { OrgForm } from "@/components/forms/OrgForm";
import { PhotoHero, Section, SectionHeading } from "@/components/sections";
import type { Lang } from "@/lib/i18n";

const ICONS = [Building2, GraduationCap, Store, Landmark];

/** /organisationer: housing companies, student unions, businesses and associations. */
export function OrgView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.orgPage;
  return (
    <>
      <PhotoHero photo="garage-field" lang={lang} eyebrow={<span className="eyebrow !text-glow">{p.eyebrow}</span>} title={p.title} lead={p.lead}>
        <a href="#kontakt" className="btn btn-light">
          {p.formTitle}
        </a>
      </PhotoHero>

      <Section>
        <ul className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {p.audiences.map((a, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <li key={a.title} className="card p-5 sm:p-8">
                <Icon size={26} className="text-brand" aria-hidden="true" />
                <h2 className="mt-3 text-xl leading-snug text-night sm:text-2xl">{a.title}</h2>
                <p className="mt-2 leading-relaxed text-muted">{a.text}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section tone="paper">
        <SectionHeading title={p.howTitle} />
        <ol className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
          {p.how.map((step, i) => (
            <li key={step} className="card flex gap-3 p-4 sm:block sm:p-6">
              <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night text-lg font-bold text-glow">{i + 1}</span>
              <span className="block leading-snug text-ink sm:mt-3">{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="kontakt">
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={p.formTitle} lead={p.formLead} />
          <div className="mt-6 sm:mt-8">
            <OrgForm lang={lang} t={t} />
          </div>
        </div>
      </Section>
    </>
  );
}
