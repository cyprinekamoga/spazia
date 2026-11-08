import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { pagePaths } from "@/lib/routes";
import { OrgView } from "@/views/OrgView";

const lang: Lang = "en";
const t = getDictionary(lang);

export const metadata: Metadata = buildMetadata({
  lang,
  paths: pagePaths.organisations,
  title: t.orgPage.metaTitle,
  description: t.orgPage.metaDescription,
});

export default function Page() {
  return <OrgView lang={lang} />;
}
