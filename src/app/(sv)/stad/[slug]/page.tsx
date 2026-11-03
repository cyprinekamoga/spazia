import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content";
import { cities, getCity } from "@/content/cities";
import { fill, type Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { cityPath } from "@/lib/routes";
import { CityView } from "@/views/LandingViews";

const lang: Lang = "sv";
const t = getDictionary(lang);

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return cities.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = getCity((await params).slug);
  if (!city) return {};
  return buildMetadata({
    lang,
    paths: { sv: cityPath(city.slug, "sv"), en: cityPath(city.slug, "en") },
    title: fill(t.cityPage.title, { name: city.name }),
    description: fill(t.cityPage.metaDescription, { name: city.name }),
  });
}

export default async function Page({ params }: Props) {
  const city = getCity((await params).slug);
  if (!city) notFound();
  return <CityView lang={lang} city={city} />;
}
