import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { pagePaths } from "@/lib/routes";
import { HomeView } from "@/views/HomeView";

const lang: Lang = "sv";
const t = getDictionary(lang);

export const metadata: Metadata = buildMetadata({
  lang,
  paths: pagePaths.home,
  title: t.meta.homeTitle,
  description: t.meta.homeDescription,
  absoluteTitle: true,
});

export default function Page() {
  return <HomeView lang={lang} />;
}
