"use client";

/**
 * First-touch attribution: remember which ad/link brought the visitor, so it
 * can be stored with the lead. Kept in sessionStorage only.
 */
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const STORAGE_KEY = "spazia-attribution";

export type Attribution = Partial<Record<(typeof UTM_KEYS)[number] | "referrer" | "landing_page", string>>;

function safeSession(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function captureAttribution(): void {
  const storage = safeSession();
  if (!storage || storage.getItem(STORAGE_KEY)) return;
  const params = new URLSearchParams(window.location.search);
  const data: Attribution = {
    landing_page: window.location.pathname,
    referrer: document.referrer || undefined,
  };
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) data[key] = value.slice(0, 200);
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked – attribution is optional */
  }
}

export function getAttribution(): Attribution {
  const storage = safeSession();
  try {
    return storage ? (JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}") as Attribution) : {};
  } catch {
    return {};
  }
}

/* ---------- Cookie consent ---------- */

export type Consent = "all" | "necessary";
const CONSENT_KEY = "spazia-consent";
export const CONSENT_EVENT = "spazia:consent";
export const OPEN_CONSENT_EVENT = "spazia:open-consent";

export function readConsent(): Consent | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "all" || value === "necessary" ? value : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

/* ---------- Meta Pixel ---------- */

type Fbq = (...args: unknown[]) => void;

type Plausible = (event: string, options?: { props?: Record<string, string> }) => void;

export function trackLead(kind: "host" | "renter"): void {
  const w = window as unknown as { fbq?: Fbq; plausible?: Plausible };
  // Meta Pixel – only present after the visitor accepted cookies.
  if (typeof w.fbq === "function") {
    w.fbq("track", "Lead", { content_category: kind });
  }
  // Plausible (cookie-free) – goal "Lead" with property "type".
  if (typeof w.plausible === "function") {
    w.plausible("Lead", { props: { type: kind } });
  }
}

/** A host booked an inspection visit (Meta standard event "Schedule"). */
export function trackVisitBooked(): void {
  const w = window as unknown as { fbq?: Fbq; plausible?: Plausible };
  if (typeof w.fbq === "function") w.fbq("track", "Schedule");
  if (typeof w.plausible === "function") w.plausible("Visit booked");
}
