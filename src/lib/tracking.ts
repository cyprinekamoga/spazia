"use client";

/**
 * First-touch attribution: remember which ad/link brought the visitor, so it
 * can be stored with the lead. Kept in sessionStorage only.
 */
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const STORAGE_KEY = "spazia-attribution";
/** ?inbjudan=<code>: someone's invite link. Remembered separately (the last one wins). */
export const INVITE_PARAM = "inbjudan";
const INVITE_KEY = "spazia-invite";
const INVITE_RE = /^[0-9a-f]{8}$/;

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
  if (!storage) return;
  const params = new URLSearchParams(window.location.search);
  const invite = (params.get(INVITE_PARAM) ?? "").toLowerCase();
  if (INVITE_RE.test(invite)) {
    try {
      storage.setItem(INVITE_KEY, invite);
    } catch {
      /* optional */
    }
  }
  if (storage.getItem(STORAGE_KEY)) return;
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

/** The invite code from someone's invite link, if the visitor came through one. */
export function getInvite(): string | null {
  try {
    const value = safeSession()?.getItem(INVITE_KEY) ?? "";
    return INVITE_RE.test(value) ? value : null;
  } catch {
    return null;
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

export function trackLead(kind: "host" | "renter" | "org"): void {
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
