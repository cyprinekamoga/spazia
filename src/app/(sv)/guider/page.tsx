import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { pagePaths } from "@/lib/routes";
import { GuideIndexView } from "@/views/GuideViews";

const lang: Lang = "sv";
const t = getDictionary(lang);

export const metadata: Metadata = buildMetadata({
  lang,
  paths: pagePaths.guides,
  title: t.guidesPage.metaTitle,
  description: t.guidesPage.metaDescription,
});

export default function Page() {
  return <GuideIndexView lang={lang} />;
}
