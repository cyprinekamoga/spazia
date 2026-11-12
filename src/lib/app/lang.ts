/**
 * The app's language: Swedish or English. Chosen once when the app starts:
 * a ?lang= in the address (public listing pages link both versions), else the
 * user's choice saved in this browser, else the browser's language. Search
 * engine crawlers get Swedish, the canonical version of listing pages. Changing it reloads the app. While the static pages are built
 * (no browser), it is Swedish; the app shows nothing until it runs in the
 * browser, so the two never mix (AppLanguageGate).
 */
export type AppLang = "sv" | "en";

const KEY = "spazia-lang";

const CRAWLER = /bot|crawler|spider|slurp|facebookexternalhit|embedly|preview/i;

function detect(): AppLang {
  if (typeof window === "undefined") return "sv";
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (fromUrl === "sv" || fromUrl === "en") return fromUrl;
  if (CRAWLER.test(navigator.userAgent)) return "sv";
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "sv" || saved === "en") return saved;
  } catch {
    // Storage blocked: fall back to the browser's language.
  }
  const langs = [...(navigator.languages ?? []), navigator.language].filter(Boolean).map((l) => l.toLowerCase());
  // Swedish if the browser lists Swedish (or Norwegian/Danish, which read Swedish), otherwise English.
  return langs.some((l) => l.startsWith("sv") || l.startsWith("nb") || l.startsWith("no") || l.startsWith("da")) || langs.length === 0 ? "sv" : "en";
}

export const appLang: AppLang = detect();

/** Locale for dates and numbers. */
export const appLocale = appLang === "sv" ? "sv-SE" : "en-GB";

/** Pick the text in the app's language from a { sv, en } pair. */
export function L<T>(text: { sv: T; en: T }): T {
  return text[appLang];
}

export function setAppLang(lang: AppLang): void {
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    // Can't remember it; the reload below still applies the browser default.
  }
  // A ?lang= in the address would win over the new choice: drop it.
  const url = new URL(window.location.href);
  if (url.searchParams.has("lang")) {
    url.searchParams.delete("lang");
    window.location.replace(url.toString());
  } else {
    window.location.reload();
  }
}
