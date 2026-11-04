"use client";

import { useSyncExternalStore } from "react";
import type { Dictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { useQueryString } from "./forms/useLeadForm";
import { VisitBooking } from "./VisitBooking";

const noopSubscribe = () => () => {};

/** Booking page body: the private id comes from ?ref= in the email link. */
export function VisitBookingPage({ lang, t }: { lang: Lang; t: Dictionary }) {
  const ref = useQueryString().get("ref");
  // The query string only exists in the browser: render nothing on the server and during hydration.
  const inBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return <div className="card p-5 sm:p-8">{inBrowser && <VisitBooking key={ref ?? "none"} lang={lang} t={t} leadRef={ref} />}</div>;
}
