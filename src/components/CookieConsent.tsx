"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Dictionary } from "@/content";
import type { Lang } from "@/lib/i18n";
import { pagePath } from "@/lib/routes";
import { site } from "@/lib/site";
import {
  captureAttribution,
  CONSENT_EVENT,
  OPEN_CONSENT_EVENT,
  readConsent,
  writeConsent,
  type Consent,
} from "@/lib/tracking";

const pixelEnabled = Boolean(site.metaPixelId);

/**
 * Cookie banner + Meta Pixel. The banner only appears when a pixel is
 * configured (otherwise the site sets no non-essential cookies at all), and
 * the pixel only loads after the visitor chooses "Accept all".
 */
function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function CookieConsent({ lang, t }: { lang: Lang; t: Dictionary }) {
  // "pending" while pre-rendering, so the banner never flashes in static HTML.
  const consent = useSyncExternalStore<Consent | null | "pending">(subscribeConsent, readConsent, () => "pending");
  const [reopened, setReopened] = useState(false);
  const showBanner = consent === null || reopened;

  useEffect(() => {
    captureAttribution();
    const onOpen = () => setReopened(true);
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onOpen);
  }, []);

  const choose = (value: Consent) => {
    const previous = consent;
    writeConsent(value);
    setReopened(false);
    // Withdrawing consent after the pixel loaded: reload so it is gone.
    if (value === "necessary" && previous === "all") window.location.reload();
  };

  if (!pixelEnabled) return null;

  return (
    <>
      {consent === "all" && <MetaPixel pixelId={site.metaPixelId} />}
      {showBanner && (
        <div
          role="region"
          aria-label="Cookies"
          className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-line bg-paper p-4 shadow-[0_10px_40px_-10px_rgb(14_27_51/0.35)] sm:flex-row sm:items-center sm:gap-5 sm:p-5">
            <p className="text-[0.95rem] leading-relaxed text-ink">
              {t.cookie.text}{" "}
              <Link href={pagePath("privacy", lang)} className="font-medium underline underline-offset-4">
                {t.cookie.readMore}
              </Link>
            </p>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn btn-secondary !px-4 !py-2.5 text-sm" onClick={() => choose("necessary")}>
                {t.cookie.necessary}
              </button>
              <button type="button" className="btn btn-primary !px-4 !py-2.5 text-sm" onClick={() => choose("all")}>
                {t.cookie.accept}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const firstRender = useRef(true);

  // The base snippet tracks the first PageView; track client-side navigations here.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    fbq?.("track", "PageView");
  }, [pathname]);

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(pixelId)});fbq('track','PageView');`}
    </Script>
  );
}

export function CookieSettingsLink({ label, className }: { label: string; className?: string }) {
  if (!pixelEnabled) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
    >
      {label}
    </button>
  );
}
