"use client";

import { Check, Copy, Share2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { getDictionary } from "@/content";
import { cities, townKey } from "@/content/cities";
import { fill, type Lang } from "@/lib/i18n";
import { cityPath, pagePath } from "@/lib/routes";
import { site } from "@/lib/site";
import { INVITE_PARAM } from "@/lib/tracking";

export interface WaitlistInfo {
  found: boolean;
  kind?: "host" | "renter";
  town?: string;
  position?: number | null;
  townTotal?: number | null;
  invited?: number;
}

/**
 * Fetch a sign-up's place in the queue. Right after the form is sent the
 * sign-up is still on its way (Netlify stores it a moment later), so it asks
 * again a few times before giving up.
 */
export function useWaitlist(ref: string | null, tries = 8): { info: WaitlistInfo | null; done: boolean } {
  const [info, setInfo] = useState<WaitlistInfo | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const ask = async (left: number) => {
      try {
        const res = await fetch(`/api/waitlist?ref=${encodeURIComponent(ref)}`, { cache: "no-store" });
        const data = (await res.json()) as WaitlistInfo;
        if (cancelled) return;
        if (data.found || left <= 1) {
          setInfo(data);
          setDone(true);
          return;
        }
      } catch {
        if (cancelled) return;
        if (left <= 1) {
          setDone(true);
          return;
        }
      }
      timer = setTimeout(() => ask(left - 1), 1500);
    };
    ask(tries);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ref, tries]);
  return { info, done };
}

/** Invite link: the town's page if we have one, otherwise the home page. */
export function inviteUrl(ref: string, town: string, lang: Lang): string {
  const city = cities.find((c) => townKey(c.name) === townKey(town));
  const path = city ? cityPath(city.slug, lang) : pagePath("home", lang);
  return `${site.url}${path === "/" ? "/" : path}?${INVITE_PARAM}=${ref.slice(0, 8).toLowerCase()}`;
}

/** Place in the queue, the town's count and an invite link to share. */
export function WaitlistBox({ lang, leadRef, kind, town, tries }: { lang: Lang; leadRef: string; kind: "host" | "renter"; town: string; tries?: number }) {
  const w = getDictionary(lang).forms.waitlist;
  const { info, done } = useWaitlist(leadRef, tries);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const shownTown = info?.town || town;
  const url = inviteUrl(leadRef, shownTown, lang);
  const text = shownTown ? fill(w.shareText, { town: shownTown }) : w.shareTextNoTown;

  // navigator.share only exists in the browser (mostly on phones).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  async function share() {
    try {
      await navigator.share({ title: "Spazia", text, url });
    } catch {
      /* closed the share sheet */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(w.copy, url);
    }
  }

  const position = info?.found && info.position ? fill((info.kind ?? kind) === "host" ? w.placeHost : w.placeRenter, { position: info.position, town: shownTown }) : null;
  const invited = info?.invited ?? 0;

  return (
    <div className="mx-auto mt-6 max-w-md space-y-4 text-left">
      <div className="rounded-2xl bg-frost/70 p-4" aria-live="polite">
        {position ? (
          <p className="text-lg font-bold text-night">{position}</p>
        ) : (
          <p className="text-muted">{done ? w.later : w.loading}</p>
        )}
        {info?.found && info.townTotal != null && info.townTotal >= 3 && shownTown && (
          <p className="mt-1 text-[0.95rem] text-muted">{fill(w.signedUp, { count: info.townTotal, town: shownTown })}</p>
        )}
        {invited > 0 && <p className="mt-1 text-[0.95rem] font-semibold text-pine">{invited === 1 ? w.invitedOne : fill(w.invitedMany, { count: invited })}</p>}
      </div>

      <div className="rounded-2xl border border-line p-4">
        <p className="flex items-center gap-2 font-bold text-night">
          <Users size={19} className="text-brand" aria-hidden="true" />
          {w.inviteTitle}
        </p>
        <p className="mt-1 leading-relaxed text-muted">{shownTown ? fill(w.inviteText, { town: shownTown }) : w.inviteTextNoTown}</p>
        <p className="mt-3 truncate rounded-lg bg-snow px-3 py-2 font-mono text-sm text-ink" title={url}>
          {url.replace(/^https:\/\//, "")}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {canShare && (
            <button type="button" onClick={share} className="btn btn-primary">
              <Share2 size={18} aria-hidden="true" />
              {w.share}
            </button>
          )}
          <button type="button" onClick={copy} className={`btn ${canShare ? "btn-secondary" : "btn-primary"}`}>
            {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            <span aria-live="polite">{copied ? w.copied : w.copy}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
