import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { pagePaths } from "@/lib/routes";
import { PrivacyView } from "@/views/InfoViews";

const lang: Lang = "sv";
const t = getDictionary(lang);

export const metadata: Metadata = buildMetadata({
  lang,
  paths: pagePaths.privacy,
  title: t.privacyPage.metaTitle,
  description: t.privacyPage.metaDescription,
});

export default function Page() {
  return <PrivacyView lang={lang} />;
}
