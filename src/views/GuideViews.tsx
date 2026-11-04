import Link from "next/link";
import type { ReactNode } from "react";
import { getDictionary } from "@/content";
import { getCategory, type CategoryId } from "@/content/categories";
import { getGuide, guides, readingMinutes, type Guide, type GuideBlock, type GuideId } from "@/content/guides";
import { photoData } from "@/content/photos";
import { Photo } from "@/components/Photo";
import { PhotoHero, Section, SectionHeading } from "@/components/sections";
import { fill, type Lang } from "@/lib/i18n";
import { absoluteUrl, categoryPath, guidePath, pagePath, type PageKey } from "@/lib/routes";
import { site } from "@/lib/site";

/* ---------- Text with [label](target) links ---------- */

function resolveTarget(target: string, lang: Lang): { href: string; external: boolean } {
  if (/^https?:\/\//.test(target)) return { href: target, external: true };
  const [kind, rest] = target.split(":");
  const [id, hash] = rest.split("#");
  const suffix = hash ? `#${hash}` : "";
  if (kind === "page") return { href: pagePath(id as PageKey, lang) + suffix, external: false };
  if (kind === "guide") return { href: guidePath(getGuide(id as GuideId).slug, lang) + suffix, external: false };
  if (kind === "category") return { href: categoryPath(getCategory(id as CategoryId).slug, lang) + suffix, external: false };
  throw new Error(`Unknown link target: ${target}`);
}

const linkClass = "font-semibold text-night underline decoration-brand-bright decoration-2 underline-offset-4 hover:decoration-night";

function RichText({ text, lang }: { text: string; lang: Lang }) {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const { href, external } = resolveTarget(match[2], lang);
    parts.push(
      external ? (
        <a key={match.index} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {match[1]}
        </a>
      ) : (
        <Link key={match.index} prefetch={false} href={href} className={linkClass}>
          {match[1]}
        </Link>
      ),
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Block({ block, lang }: { block: GuideBlock; lang: Lang }) {
  switch (block.type) {
    case "h2":
      return <h2 className="mt-10 text-[1.7rem] leading-tight text-night sm:text-3xl">{block.text}</h2>;
    case "p":
      return (
        <p className="mt-4 text-[1.06rem] leading-relaxed text-ink/90">
          <RichText text={block.text} lang={lang} />
        </p>
      );
    case "ul":
    case "ol": {
      const List = block.type === "ul" ? "ul" : "ol";
      return (
        <List className={`mt-4 space-y-2.5 pl-6 text-[1.06rem] leading-relaxed text-ink/90 ${block.type === "ul" ? "list-disc" : "list-decimal"} marker:text-brand`}>
          {block.items.map((item) => (
            <li key={item} className="pl-1">
              <RichText text={item} lang={lang} />
            </li>
          ))}
        </List>
      );
    }
    case "table":
      return (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full min-w-[20rem] border-collapse text-left text-[0.97rem]">
            <thead>
              <tr className="border-b border-line">
                {block.head.map((h, i) => (
                  <th key={i} scope="col" className="px-4 py-3 font-semibold text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {block.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row" className="px-4 py-3 font-semibold text-night">
                        {cell}
                      </th>
                    ) : (
                      <td key={i} className="px-4 py-3 text-ink tabular-nums">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return <p className="mt-8 rounded-2xl bg-frost/70 p-5 text-[0.97rem] leading-relaxed text-ink/90">{block.text}</p>;
  }
}

/* ---------- Cards ---------- */

function formatDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "sv" ? "sv-SE" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

function GuideCard({ guide, lang }: { guide: Guide; lang: Lang }) {
  const t = getDictionary(lang);
  return (
    <Link
      prefetch={false}
      href={guidePath(guide.slug, lang)}
      className="group card flex h-full flex-col overflow-hidden transition-colors hover:border-night/30"
    >
      <Photo name={guide.photo} lang={lang} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="h-44 w-full" decorative />
      <span className="flex flex-1 flex-col p-5">
        <span className="text-xl leading-snug font-bold text-night group-hover:underline group-hover:decoration-brand-bright group-hover:underline-offset-4">
          {guide.title[lang]}
        </span>
        <span className="mt-2 flex-1 leading-relaxed text-muted">{guide.description[lang]}</span>
        <span className="mt-4 text-sm font-medium text-muted">
          {fill(t.guidesPage.readTime, { minutes: readingMinutes(guide, lang) })}
        </span>
      </span>
    </Link>
  );
}

export function GuideGrid({ lang, items }: { lang: Lang; items: Guide[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((g) => (
        <li key={g.id}>
          <GuideCard guide={g} lang={lang} />
        </li>
      ))}
    </ul>
  );
}

/** Small "Read more" list for category and host pages. */
export function RelatedGuides({ lang, items }: { lang: Lang; items: Guide[] }) {
  const t = getDictionary(lang);
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="text-2xl text-night">{t.guidesPage.relatedTitle}</h2>
      <ul className="mt-4 space-y-2">
        {items.map((g) => (
          <li key={g.id}>
            <Link prefetch={false} href={guidePath(g.slug, lang)} className={`inline-flex min-h-11 items-center text-lg ${linkClass}`}>
              {g.title[lang]}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Pages ---------- */

export function GuideIndexView({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const p = t.guidesPage;
  return (
    <>
      <PhotoHero photo="garage-field" lang={lang} eyebrow={<span className="eyebrow !text-glow">{p.eyebrow}</span>} title={p.title} lead={p.lead} />
      <Section>
        <SectionHeading title={p.forRenters} />
        <div className="mt-6">
          <GuideGrid lang={lang} items={guides.filter((g) => g.audience === "renter")} />
        </div>
      </Section>
      <Section tone="paper">
        <SectionHeading title={p.forHosts} />
        <div className="mt-6">
          <GuideGrid lang={lang} items={guides.filter((g) => g.audience === "host")} />
        </div>
      </Section>
    </>
  );
}

export function GuideView({ lang, guide }: { lang: Lang; guide: Guide }) {
  const t = getDictionary(lang);
  const p = t.guidesPage;
  const forHost = guide.audience === "host";
  const ctaHref = `${pagePath(forHost ? "host" : "find", lang)}#anmalan`;
  const photo = photoData(guide.photo);
  const largest = photo.widths[photo.widths.length - 1];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title[lang],
      description: guide.description[lang],
      inLanguage: lang === "sv" ? "sv-SE" : "en",
      datePublished: guide.published,
      dateModified: guide.updated,
      image: absoluteUrl(`/images/${guide.photo}-${largest}.webp`),
      mainEntityOfPage: absoluteUrl(guidePath(guide.slug, lang)),
      author: { "@type": "Organization", name: site.name, url: site.url },
      publisher: { "@type": "Organization", name: site.name, url: site.url, logo: { "@type": "ImageObject", url: `${site.url}/icon.svg` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: site.name, item: absoluteUrl(pagePath("home", lang)) },
        { "@type": "ListItem", position: 2, name: p.title, item: absoluteUrl(pagePath("guides", lang)) },
        { "@type": "ListItem", position: 3, name: guide.title[lang], item: absoluteUrl(guidePath(guide.slug, lang)) },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PhotoHero
        photo={guide.photo}
        lang={lang}
        eyebrow={
          <Link prefetch={false} href={pagePath("guides", lang)} className="eyebrow inline-flex min-h-11 items-center !text-glow hover:underline hover:underline-offset-4">
            {p.eyebrow}
          </Link>
        }
        title={guide.title[lang]}
        lead={guide.description[lang]}
      />

      <Section>
        <article className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-muted">{fill(p.updated, { date: formatDate(guide.updated, lang) })}</p>
          <p className="text-sm font-medium text-muted">{fill(p.readTime, { minutes: readingMinutes(guide, lang) })}</p>
          <div className="mt-2">
            {guide.body[lang].map((block, i) => (
              <Block key={i} block={block} lang={lang} />
            ))}
          </div>

          {guide.sources.length > 0 && (
            <div className="mt-10 border-t border-line pt-6">
              <h2 className="text-lg font-bold text-night">{p.sourcesTitle}</h2>
              <ul className="mt-1 text-[0.97rem]">
                {guide.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-muted underline decoration-line underline-offset-4 hover:text-night hover:decoration-night">
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10 rounded-[1.25rem] bg-night p-6 text-white sm:p-8">
            <h2 className="text-2xl text-white">{forHost ? p.ctaHostTitle : p.ctaFindTitle}</h2>
            <p className="mt-2 leading-relaxed text-frost-2">{forHost ? p.ctaHostText : p.ctaFindText}</p>
            <Link prefetch={false} href={ctaHref} className="btn btn-light mt-5">
              {forHost ? t.hero.ctaHost : t.hero.ctaFind}
            </Link>
          </div>
        </article>
      </Section>

      <Section tone="paper">
        <SectionHeading title={p.otherGuides} />
        <div className="mt-6">
          <GuideGrid lang={lang} items={guides.filter((g) => g.id !== guide.id)} />
        </div>
      </Section>
    </>
  );
}
