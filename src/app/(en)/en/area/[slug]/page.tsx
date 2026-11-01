import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content";
import { areas, getArea } from "@/content/areas";
import { fill, type Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { areaPath } from "@/lib/routes";
import { AreaView } from "@/views/LandingViews";

const lang: Lang = "en";
const t = getDictionary(lang);

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return areas.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const area = getArea((await params).slug);
  if (!area) return {};
  return buildMetadata({
    lang,
    paths: { sv: areaPath(area.slug, "sv"), en: areaPath(area.slug, "en") },
    title: `${fill(t.areaPage.titleRenter, { name: area.name, in: lang === "sv" ? area.prep : "in" })}, Luleå`,
    description: `${area.intro[lang]} ${area.renterPitch[lang]}`,
  });
}

export default async function Page({ params }: Props) {
  const area = getArea((await params).slug);
  if (!area) notFound();
  return <AreaView lang={lang} area={area} />;
}
