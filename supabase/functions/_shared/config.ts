import { postgres, Stripe } from "./deps.ts";

/** Where the app runs (links in Stripe's pages back to the app). */
export const APP_URL = (Deno.env.get("APP_URL") ?? "https://app.spazia.se").replace(/\/$/, "");

/** Pages the app may ask Stripe to return to (open-redirect protection). */
export const ALLOWED_ORIGINS = [APP_URL, "http://localhost:3001"];

let stripeClient: Stripe | null = null;

/** Stripe client. STRIPE_SECRET_KEY is set in Supabase → Edge Functions → Secrets. */
export function stripe(): Stripe {
  if (!stripeClient) {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 });
  }
  return stripeClient;
}

/** Direct database connection (the functions run as the database owner). */
export const sql = postgres(Deno.env.get("SUPABASE_DB_URL") ?? "", { prepare: false, max: 3, idle_timeout: 20 });

/** Kronor → öre, as Stripe wants amounts. */
export const ore = (kr: number) => Math.round(kr * 100);
