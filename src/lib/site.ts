/** Read a public build-time variable, treating an empty string as "not set". */
function env(value: string | undefined, fallback = ""): string {
  return value && value.trim() !== "" ? value.trim() : fallback;
}

export const site = {
  name: "Spazia",
  url: "https://spazia.se",
  /** Shown on the site and used as reply-to address in emails. */
  email: "info@nordvra.se",
  city: "Luleå",
  /** Shown in the privacy policy. Add the org.nr once the company is registered. */
  legalName: "Spazia",
  orgNumber: "" as string,

  /* Integrations. Public IDs, so they can live in the code; each can be
     overridden with an environment variable in Netlify. */

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
