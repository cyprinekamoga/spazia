import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { pagePaths } from "@/lib/routes";
import { HostView } from "@/views/HostView";

const lang: Lang = "sv";
const t = getDictionary(lang);

export const metadata: Metadata = buildMetadata({
  lang,
  paths: pagePaths.host,
  title: t.hostPage.metaTitle,
  description: t.hostPage.metaDescription,
});

export default function Page() {
  return <HostView lang={lang} />;
}
