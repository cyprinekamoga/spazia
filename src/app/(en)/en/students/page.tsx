import type { Metadata } from "next";
import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { pagePaths } from "@/lib/routes";
import { StudentsView } from "@/views/StudentViews";

const lang: Lang = "en";
const t = getDictionary(lang);

export const metadata: Metadata = buildMetadata({
  lang,
  paths: pagePaths.students,
  title: t.studentPage.metaTitle,
  description: t.studentPage.metaDescription,
});

export default function Page() {
  return <StudentsView lang={lang} />;
}
