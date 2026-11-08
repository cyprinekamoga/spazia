import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { pagePaths } from "@/lib/routes";
import { TermsView } from "@/views/InfoViews";

const lang: Lang = "sv";
const t = getDictionary(lang);

export const metadata: Metadata = buildMetadata({
  lang,
  paths: pagePaths.terms,
  title: t.termsPage.metaTitle,
  description: t.termsPage.metaDescription,
});

export default function Page() {
  return <TermsView lang={lang} />;
}
