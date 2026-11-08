"use client";

import { getDictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { useQueryString } from "./useLeadForm";
import { useWaitlist, WaitlistBox } from "./WaitlistBox";

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /min-plats?id=…: the link in the sign-up email. */
export function MySpot({ lang }: { lang: Lang }) {
  const p = getDictionary(lang).mySpotPage;
  const id = useQueryString().get("id") ?? "";
  const valid = ID_RE.test(id);
  const { info, done } = useWaitlist(valid ? id.toLowerCase() : null, 1);

  if (!valid || (done && !info?.found)) return <p className="mt-6 rounded-2xl bg-frost/70 p-4 text-ink">{p.notFound}</p>;
  if (!info?.found || !info.kind) return <p className="mt-6 text-muted">{p.loading}</p>;
  return <WaitlistBox lang={lang} leadRef={id.toLowerCase()} kind={info.kind} town={info.town ?? ""} tries={1} />;
}
