import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { mySpotPaths } from "@/lib/routes";
import { MySpotView } from "@/views/InfoViews";

const lang: Lang = "sv";
const t = getDictionary(lang);

export const metadata: Metadata = {
  ...buildMetadata({ lang, paths: mySpotPaths, title: t.mySpotPage.metaTitle, description: t.mySpotPage.lead }),
  // Personal page: keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <MySpotView lang={lang} />;
}
