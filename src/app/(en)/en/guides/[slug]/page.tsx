import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuideBySlug, guides } from "@/content/guides";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { guidePath } from "@/lib/routes";
import { GuideView } from "@/views/GuideViews";

const lang: Lang = "en";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug[lang] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuideBySlug((await params).slug, lang);
  if (!guide) return {};
  return buildMetadata({
    lang,
    paths: { sv: guidePath(guide.slug, "sv"), en: guidePath(guide.slug, "en") },
    title: guide.title[lang],
    description: guide.description[lang],
  });
}

export default async function Page({ params }: Props) {
  const guide = getGuideBySlug((await params).slug, lang);
  if (!guide) notFound();
  return <GuideView lang={lang} guide={guide} />;
}
