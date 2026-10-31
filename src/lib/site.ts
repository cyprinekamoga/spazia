export const site = {
  name: "Spazia",
  url: "https://spazia.se",
  email: "hej@spazia.se",
  city: "Luleå",
  /** Shown in the privacy policy. Fill in once the company is registered. */
  legalName: "Spazia",
  orgNumber: "" as string,
  /** Optional integrations – set as environment variables in Netlify. */
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
};

export const skatteverketRentalUrl =
  "https://www.skatteverket.se/privat/fastigheterochbostad/inkomsterfranbostad/hyrautprivatbostadbostadsrattsmahusochhyresratt.4.233f91f71260075abe8800033479.html";
