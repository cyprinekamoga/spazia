import type { Metadata } from "next";
import { getDictionary } from "@/content";
import { Section } from "@/components/sections";
import { VisitBookingPage } from "@/components/VisitBookingPage";
import type { Lang } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { bookingPaths } from "@/lib/routes";

const lang: Lang = "sv";
const t = getDictionary(lang);

export const metadata: Metadata = {
  ...buildMetadata({ lang, paths: bookingPaths, title: t.visitBooking.metaTitle, description: t.visitBooking.lead }),
  // A private page reached from the confirmation email.
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Section>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[2.4rem] leading-[1.05] text-night sm:text-5xl">{t.visitBooking.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">{t.visitBooking.lead}</p>
        <div className="mt-8">
          <VisitBookingPage lang={lang} t={t} />
        </div>
      </div>
    </Section>
  );
}
