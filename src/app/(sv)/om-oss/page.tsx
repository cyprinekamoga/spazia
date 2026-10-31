import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { pagePaths } from "@/lib/routes";
import { AboutView } from "@/views/InfoViews";

const lang: Lang = "sv";
const t = getDictionary(lang);

export const metadata: Metadata = buildMetadata({
  lang,
  paths: pagePaths.about,
  title: t.aboutPage.metaTitle,
  description: t.aboutPage.metaDescription,
});

export default function Page() {
  return <AboutView lang={lang} />;
}
