import Link from "next/link";
import { Mail } from "lucide-react";
import { getDictionary } from "@/content";
import { photos } from "@/content/photos";
import { MobileActionBar } from "@/components/MobileActionBar";
import { CheckList, FinalCta, PhotoHero, Section } from "@/components/sections";
import { fill, type Lang } from "@/lib/i18n";
import { pagePath } from "@/lib/routes";
import { site } from "@/lib/site";

function DefaultActionBar({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  return (
    <MobileActionBar
      primary={{ href: pagePath("find", lang), label: t.actionBar.find }}
      secondary={{ href: pagePath("host", lang), label: t.actionBar.host }}
    />
  );
}

export function TrustView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.trustPage;
  return (
    <>
      <PhotoHero photo="keys" lang={lang} eyebrow={<span className="eyebrow !text-glow">{p.eyebrow}</span>} title={p.title} lead={p.lead} />
      <Section>
        <div className="mx-auto max-w-3xl space-y-3 sm:space-y-4">
          {p.sections.map((s, i) => (
            <article key={s.title} className="card p-5 sm:p-8">
              <div className="flex items-start gap-3.5 sm:gap-4">
                <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine-soft font-bold text-pine">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl leading-snug text-night sm:text-2xl">{s.title}</h2>
                  <p className="mt-2 leading-relaxed text-ink sm:mt-3">{s.text}</p>
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
      <DefaultActionBar lang={lang} />
    </>
  );
}

export function AboutView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.aboutPage;
  const credits = Object.values(photos);
  return (
    <>
      <PhotoHero
        photo="lulea-sunset"
        lang={lang}
        eyebrow={<span className="eyebrow !text-glow">{p.eyebrow}</span>}
        title={p.title}
        lead={p.paragraphs[0]}
      />
      <Section>
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.6fr_1fr] lg:gap-10">
          <div className="prose-spazia text-[1.05rem] leading-relaxed text-ink sm:text-lg">
            {p.paragraphs.slice(1).map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
          <aside className="card h-fit p-5 sm:p-6">
            <h2 className="text-xl text-night">{p.contactTitle}</h2>
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
      <Section id="bildkallor">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl text-night">{p.creditsTitle}</h2>
          <p className="mt-2 text-muted">{p.creditsText}</p>
          <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-[0.95rem] sm:grid-cols-2">
            {credits.map((c) => (
              <li key={c.key}>
                <a
                  href={c.credit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center text-ink underline decoration-line underline-offset-4 hover:decoration-night"
                >
                  {c.alt[lang]} – {c.credit.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Section>
      <DefaultActionBar lang={lang} />
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
        <h1 className="text-[2.25rem] leading-tight text-night sm:text-5xl">{p.title}</h1>
        <p className="mt-3 text-muted">{p.updated}</p>
        <div className="mt-8 space-y-7 sm:mt-10 sm:space-y-8">
          {[...p.sections, ...(site.plausibleDomain ? [p.analytics] : [])].map((s) => (
            <section key={s.title}>
              <h2 className="text-xl text-night sm:text-2xl">{s.title}</h2>
              <p className="mt-2 leading-relaxed text-ink sm:mt-3">{fill(s.text, { legal, email: site.email })}</p>
            </section>
          ))}
        </div>
        <p className="mt-12">
          <Link prefetch={false} href={pagePath("home", lang)} className="inline-flex min-h-11 items-center font-semibold text-night underline underline-offset-4">
            ← {t.notFound.home}
          </Link>
        </p>
      </article>
    </Section>
  );
}
