import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { getDictionary } from "@/content";
import { HostCalculator } from "@/components/HostCalculator";
import { MobileActionBar } from "@/components/MobileActionBar";
import { Photo } from "@/components/Photo";
import { HostForm } from "@/components/forms/HostForm";
import { Faq, PhotoHero, Section, SectionHeading, StepList } from "@/components/sections";
import type { Lang } from "@/lib/i18n";
import { skatteverketRentalUrl } from "@/lib/site";

export function HostView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.hostPage;

  return (
    <>
      <PhotoHero
        photo="house-harads"
        lang={lang}
        eyebrow={<span className="eyebrow !text-glow">{p.eyebrow}</span>}
        title={p.title}
        lead={p.lead}
      >
        <a href="#anmalan" className="btn btn-light">
          {p.ctaForm}
        </a>
        <a href="#kalkylator" className="btn btn-on-dark">
          {p.ctaCalc}
        </a>
      </PhotoHero>

      <Section id="kalkylator">
        <SectionHeading title={t.calculator.title} lead={t.calculator.lead} />
        <div className="mt-7 sm:mt-10">
          <HostCalculator lang={lang} t={t} formHref="#anmalan" />
        </div>
      </Section>

      <Section tone="paper">
        <SectionHeading title={p.benefitsTitle} />
        <ul className="mt-7 grid gap-x-8 gap-y-6 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
          {p.benefits.map((b) => (
            <li key={b.title} className="flex gap-3.5">
              <BadgeCheck size={24} className="mt-0.5 shrink-0 text-pine" aria-hidden="true" />
              <div>
                <h3 className="text-lg text-night">{b.title}</h3>
                <p className="mt-1 leading-relaxed text-muted">{b.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <SectionHeading title={p.stepsTitle} />
        <div className="mt-7 sm:mt-10">
          <StepList steps={p.steps} columns={4} />
        </div>
      </Section>

      <Section tone="frost">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading title={p.requirementsTitle} />
            <div className="relative mt-6 aspect-[16/10] overflow-hidden rounded-2xl">
              <Photo name="garage-clutter" lang={lang} sizes="(min-width: 1024px) 560px, 100vw" className="h-full w-full" />
            </div>
            <dl className="mt-4 divide-y divide-line rounded-2xl border border-line bg-paper">
              {p.requirements.map((r) => (
                <div key={r.title} className="flex gap-4 p-4">
                  <dt className="w-24 shrink-0 font-semibold text-night">{r.title}</dt>
                  <dd className="leading-snug text-muted">{r.text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <SectionHeading title={p.taxTitle} />
            <div className="card mt-6 p-5 sm:p-6">
              <p className="leading-relaxed text-ink">{p.taxText}</p>
              <a
                href={skatteverketRentalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-night underline decoration-brand-bright decoration-2 underline-offset-4"
              >
                {p.taxLink}
              </a>
            </div>
          </div>
        </div>
      </Section>

      <Section id="anmalan" tone="paper">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr] lg:gap-10">
          <SectionHeading title={p.formTitle} lead={p.formLead} />
          <HostForm lang={lang} t={t} />
        </div>
      </Section>

      <Section>
        <div className="grid gap-7 lg:grid-cols-[1fr_1.6fr] lg:gap-10">
          <SectionHeading title={p.faqTitle} />
          <Faq items={t.faq.host} />
        </div>
        <p className="mt-8 hidden text-center md:block">
          <Link prefetch={false} href="#anmalan" className="btn btn-primary">
            {p.ctaForm}
          </Link>
        </p>
      </Section>

      <MobileActionBar
        primary={{ href: "#anmalan", label: t.actionBar.hostForm }}
        hideWhenVisibleId="anmalan"
        estimateLabel={t.actionBar.estimate}
        perMonth={t.common.perMonth}
      />
    </>
  );
}
