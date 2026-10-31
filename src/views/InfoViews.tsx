import Link from "next/link";
import { Mail } from "lucide-react";
import { getDictionary } from "@/content";
import { CheckList, FinalCta, PageHero, Section } from "@/components/sections";
import { fill, type Lang } from "@/lib/i18n";
import { pagePath } from "@/lib/routes";
import { site } from "@/lib/site";

export function TrustView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.trustPage;
  return (
    <>
      <PageHero eyebrow={p.eyebrow} title={p.title} lead={p.lead} />
      <Section>
        <div className="mx-auto max-w-3xl space-y-4">
          {p.sections.map((s, i) => (
            <article key={s.title} className="card p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine-soft font-bold text-pine">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold text-night">{s.title}</h2>
                  <p className="mt-3 leading-relaxed text-ink">{s.text}</p>
                  {s.bullets.length > 0 && (
                    <div className="mt-4">
                      <CheckList items={s.bullets} />
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>
      <Section tone="paper">
        <FinalCta lang={lang} t={t} />
      </Section>
    </>
  );
}

export function AboutView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.aboutPage;
  return (
    <>
      <PageHero eyebrow={p.eyebrow} title={p.title} lead={p.paragraphs[0]} />
      <Section>
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div className="prose-spazia text-lg leading-relaxed text-ink">
            {p.paragraphs.slice(1).map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
          <aside className="card h-fit p-6">
            <h2 className="text-xl font-bold text-night">{p.contactTitle}</h2>
            <p className="mt-2 leading-relaxed text-muted">{p.contactText}</p>
            <a href={`mailto:${site.email}`} className="btn btn-primary mt-5 w-full">
              <Mail size={18} aria-hidden="true" />
              {site.email}
            </a>
          </aside>
        </div>
      </Section>
      <Section tone="paper">
        <FinalCta lang={lang} t={t} />
      </Section>
    </>
  );
}

export function PrivacyView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.privacyPage;
  const legal = site.orgNumber ? `${site.legalName} (org.nr ${site.orgNumber})` : site.legalName;
  return (
    <Section>
      <article className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold text-night sm:text-5xl">{p.title}</h1>
        <p className="mt-3 text-muted">{p.updated}</p>
        <div className="mt-10 space-y-8">
          {p.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-2xl font-bold text-night">{s.title}</h2>
              <p className="mt-3 leading-relaxed text-ink">{fill(s.text, { legal, email: site.email })}</p>
            </section>
          ))}
        </div>
        <p className="mt-12">
          <Link href={pagePath("home", lang)} className="font-semibold text-night underline underline-offset-4">
            ← {t.notFound.home}
          </Link>
        </p>
      </article>
    </Section>
  );
}
