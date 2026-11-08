import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content";
import { getUniversity, universities } from "@/content/universities";
import { fill, type Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { universityPath } from "@/lib/routes";
import { UniversityView } from "@/views/StudentViews";

const lang: Lang = "en";
const t = getDictionary(lang);

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return universities.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const u = getUniversity((await params).slug);
  if (!u) return {};
  return buildMetadata({
    lang,
    paths: { sv: universityPath(u.slug, "sv"), en: universityPath(u.slug, "en") },
    title: fill(t.studentPage.uniTitle, { name: u.short }),
    description: fill(t.studentPage.uniMetaDescription, { name: u.name[lang], campus: u.campuses[0] }),
  });
}

export default async function Page({ params }: Props) {
  const u = getUniversity((await params).slug);
  if (!u) notFound();
  return <UniversityView lang={lang} university={u} />;
}
