import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { pagePaths } from "@/lib/routes";
import { FindView } from "@/views/FindView";

const lang: Lang = "sv";
const t = getDictionary(lang);

export const metadata: Metadata = buildMetadata({
  lang,
  paths: pagePaths.find,
  title: t.findPage.metaTitle,
  description: t.findPage.metaDescription,
});

export default function Page() {
  return <FindView lang={lang} />;
}
