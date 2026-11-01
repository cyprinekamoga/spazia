"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";


export const ESTIMATE_EVENT = "spazia:estimate";

/* The host calculator publishes its latest estimate here; the bar reads it. */
type EstimateWindow = Window & { __spaziaEstimate?: string | null };

export function publishEstimate(value: string | null) {
  (window as EstimateWindow).__spaziaEstimate = value;
  window.dispatchEvent(new Event(ESTIMATE_EVENT));
}

function subscribeEstimate(onChange: () => void) {
  window.addEventListener(ESTIMATE_EVENT, onChange);
  return () => window.removeEventListener(ESTIMATE_EVENT, onChange);
}

type Action = { href: string; label: string };

/**
 * Sticky call-to-action bar for phones. It slides in once the visitor has
 * scrolled past the hero, and hides while the form it points to is on screen
 * (so it never covers the fields). Hidden from md and up.
 */
export function MobileActionBar({
  primary,
  secondary,
  hideWhenVisibleId,
  estimateLabel,
  perMonth,
}: {
  primary: Action;
  secondary?: Action;
  /** id of a section (e.g. the form) – the bar hides while it is visible. */
  hideWhenVisibleId?: string;
  /** Show the live host estimate from the calculator next to the button. */
  estimateLabel?: string;
  perMonth?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [targetVisible, setTargetVisible] = useState(false);
  const estimate = useSyncExternalStore(
    subscribeEstimate,
    () => (window as EstimateWindow).__spaziaEstimate ?? null,
    () => null,
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.55);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    let observer: IntersectionObserver | undefined;
    const target = hideWhenVisibleId ? document.getElementById(hideWhenVisibleId) : null;
    if (target) {
      observer = new IntersectionObserver(([entry]) => setTargetVisible(entry.isIntersecting), {
        rootMargin: "0px 0px -20% 0px",
      });
      observer.observe(target);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [hideWhenVisibleId]);

  const visible = scrolled && !targetVisible;

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pt-3 shadow-[0_-8px_30px_-12px_rgb(29_51_64/0.35)] backdrop-blur transition-transform duration-300 md:hidden ${
        visible ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-2">
        {estimateLabel && estimate ? (
          <p className="min-w-0 flex-1 leading-tight">
            <span className="block text-xs text-muted">{estimateLabel}</span>
            <span className="font-display text-xl font-bold text-night tabular-nums">
              {estimate} <span className="font-sans text-sm font-semibold text-muted">{perMonth}</span>
            </span>
          </p>
        ) : (
          secondary && (
            <Link prefetch={false} href={secondary.href} tabIndex={visible ? 0 : -1} className="btn btn-secondary flex-1 !px-3 !py-3 text-[0.95rem]">
              {secondary.label}
            </Link>
          )
        )}
        <Link prefetch={false}
          href={primary.href}
          tabIndex={visible ? 0 : -1}
          className={`btn btn-primary !py-3 text-[0.95rem] ${secondary || estimateLabel ? "flex-1 !px-3" : "w-full"}`}
        >
          {primary.label}
        </Link>
      </div>
    </div>
  );
}
