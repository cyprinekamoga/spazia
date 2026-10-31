import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { pagePaths } from "@/lib/routes";
import { TrustView } from "@/views/InfoViews";

const lang: Lang = "en";
const t = getDictionary(lang);

export const metadata: Metadata = buildMetadata({
  lang,
  paths: pagePaths.trust,
  title: t.trustPage.metaTitle,
  description: t.trustPage.metaDescription,
});

export default function Page() {
  return <TrustView lang={lang} />;
}
