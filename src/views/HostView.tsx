import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { getDictionary } from "@/content";
import { HostCalculator } from "@/components/HostCalculator";
import { HostForm } from "@/components/forms/HostForm";
import { Faq, PageHero, Section, SectionHeading } from "@/components/sections";
import type { Lang } from "@/lib/i18n";
import { skatteverketRentalUrl } from "@/lib/site";

export function HostView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.hostPage;

  return (
    <>
      <PageHero eyebrow={p.eyebrow} title={p.title} lead={p.lead}>
        <a href="#anmalan" className="btn btn-primary">
          {p.ctaForm}
          <ArrowRight size={18} aria-hidden="true" />
        </a>
        <a href="#kalkylator" className="btn btn-on-dark">
          {p.ctaCalc}
        </a>
      </PageHero>

      <Section id="kalkylator">
        <SectionHeading title={t.calculator.title} lead={t.calculator.lead} />
        <div className="mt-10">
          <HostCalculator lang={lang} t={t} formHref="#anmalan" />
        </div>
      </Section>

      <Section tone="paper">
        <SectionHeading title={p.benefitsTitle} />
        <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {p.benefits.map((b) => (
            <div key={b.title} className="flex gap-4">
              <BadgeCheck size={26} className="mt-0.5 shrink-0 text-pine" aria-hidden="true" />
              <div>
                <h3 className="text-lg font-bold text-night">{b.title}</h3>
                <p className="mt-1.5 leading-relaxed text-muted">{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading title={p.stepsTitle} />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {p.steps.map((s, i) => (
            <li key={s.title} className="card p-6">
              <span className="font-display flex h-10 w-10 items-center justify-center rounded-full bg-night text-lg font-bold text-glow">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold text-night">{s.title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="frost">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading title={p.requirementsTitle} />
            <dl className="mt-8 space-y-5">
              {p.requirements.map((r) => (
                <div key={r.title} className="card flex gap-4 p-5">
                  <dt className="w-28 shrink-0 font-bold text-night">{r.title}</dt>
                  <dd className="leading-relaxed text-muted">{r.text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <SectionHeading title={p.taxTitle} />
            <div className="card mt-8 p-6">
              <p className="leading-relaxed text-ink">{p.taxText}</p>
              <a
                href={skatteverketRentalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 font-semibold text-night underline decoration-ember-soft decoration-2 underline-offset-4"
              >
                {p.taxLink}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </Section>

      <Section id="anmalan" tone="paper">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionHeading title={p.formTitle} lead={p.formLead} />
          </div>
          <HostForm lang={lang} t={t} />
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading title={p.faqTitle} />
          <Faq items={t.faq.host} />
        </div>
        <p className="mt-10 text-center text-muted">
          <Link href="#anmalan" className="btn btn-primary">
            {p.ctaForm}
          </Link>
        </p>
      </Section>
    </>
  );
}
