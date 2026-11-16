"use client";

import type { ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { hostSignupUrl } from "@/lib/site";
import { trackLead } from "@/lib/tracking";

/**
 * "Jag har plats över" / "Lägg upp din plats": to account creation in the app.
 * The click counts as a host lead for the Meta Pixel and Plausible, since the
 * sign-up itself happens on app.spazia.se, where neither runs.
 */
export function HostSignupLink({ lang, className, children }: { lang: Lang; className?: string; children: ReactNode }) {
  return (
    <a href={hostSignupUrl(lang)} className={className} onClick={() => trackLead("host")}>
      {children}
    </a>
  );
}
