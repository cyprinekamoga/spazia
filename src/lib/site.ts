/** Read a public build-time variable, treating an empty string as "not set". */
function env(value: string | undefined, fallback = ""): string {
  return value && value.trim() !== "" ? value.trim() : fallback;
}

export const site = {
  name: "Spazia",
  url: "https://spazia.se",
  /** The app (login, search, listings, both dashboards) runs on its own subdomain and Netlify project. */
  appUrl: env(process.env.NEXT_PUBLIC_APP_URL, "https://app.spazia.se"),
  /** Shown on the site and used as reply-to address in emails. */
  email: "info@nordvra.se",
  /**
   * The business behind Spazia: shown in the terms and the privacy policy (both
   * linked from every page's footer), as e-handelslagen requires once payments
   * are taken. Not in the footer itself, by choice.
   */
  legalName: "Spazia",
  orgNumber: "20061129-9595" as string,
  /** Postal address, one line. Shown only when filled in. */
  address: "Vänortsvägen 70, 977 55 Luleå" as string,

  /* Integrations. Public IDs, so they can live in the code; each can be
     overridden with an environment variable in Netlify. */

  /**
   * The app (accounts, listings, requests). Public values: the publishable
   * key only allows what the database's access rules allow.
   */
  appSupabaseUrl: env(process.env.NEXT_PUBLIC_APP_SUPABASE_URL, "https://mtyhnfsceahvovauckkj.supabase.co"),
  appSupabaseKey: env(process.env.NEXT_PUBLIC_APP_SUPABASE_KEY, "sb_publishable_nsP78clPf6bC9c3IWh3B3g__3BwGF23"),

  /** Leads go to Supabase when both are set, otherwise to Netlify Forms. */
  supabaseUrl: env(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: env(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  /** Meta Pixel – only loads after the visitor accepts cookies. */
  metaPixelId: env(process.env.NEXT_PUBLIC_META_PIXEL_ID, "2604701499980220"),
  /** Cookie-free visitor statistics (plausible.io). Set to "spazia.se" once the site is added there. */
  plausibleDomain: env(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN),
  /** Google Search Console "HTML tag" verification code (only the content value). */
  googleSiteVerification: env(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION),
};

export const skatteverketRentalUrl =
  "https://www.skatteverket.se/privat/fastigheterochbostad/inkomsterfranbostad/hyrautprivatbostadbostadsrattsmahusochhyresratt.4.233f91f71260075abe8800033479.html";

/**
 * Where "Jag har plats över" and "Lägg upp din plats" lead: create an account in
 * the app (Google or email), then straight on to a new listing. No form first;
 * payout details are asked for after the first paid rental.
 */
export function hostSignupUrl(lang: "sv" | "en" = "sv"): string {
  return `${site.appUrl}/logga-in?next=${encodeURIComponent("/vard/annons")}&lang=${lang}`;
}

/**
 * Where "Jag behöver förvaring" and the other renter buttons lead: create an
 * account in the app, then on to the search (town and type filled in). There
 * is no form on the website; finding nothing in the app shows a form to watch
 * the town.
 */
export function renterSignupUrl(lang: "sv" | "en" = "sv", { place, category }: { place?: string; category?: string } = {}): string {
  const q = new URLSearchParams();
  if (place) q.set("ort", place);
  if (category) q.set("typ", category);
  const next = `/sok${q.toString() ? `?${q}` : ""}`;
  return `${site.appUrl}/logga-in?next=${encodeURIComponent(next)}&lang=${lang}`;
}

/** The app's public search, e.g. https://app.spazia.se/sok?ort=Göteborg&typ=tyres */
export function appSearchUrl({ place, category }: { place?: string; category?: string } = {}): string {
  const q = new URLSearchParams();
  if (place) q.set("ort", place);
  if (category) q.set("typ", category);
  const qs = q.toString();
  return `${site.appUrl}/sok${qs ? `?${qs}` : ""}`;
}
