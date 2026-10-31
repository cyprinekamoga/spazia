import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getCategoryBySlug } from "@/content/categories";
import { fill, type Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { categoryPath } from "@/lib/routes";
import { CategoryView } from "@/views/LandingViews";

const lang: Lang = "en";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug[lang] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = getCategoryBySlug((await params).slug, lang);
  if (!category) return {};
  return buildMetadata({
    lang,
    paths: { sv: categoryPath(category.slug, "sv"), en: categoryPath(category.slug, "en") },
    title: category.metaTitle[lang],
    description: fill(category.metaDescription[lang], { price: category.price }),
  });
}

export default async function Page({ params }: Props) {
  const category = getCategoryBySlug((await params).slug, lang);
  if (!category) notFound();
  return <CategoryView lang={lang} category={category} />;
}
