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

/**
 * Tell the team that something failed (an email via private.raise_alert,
 * at most once an hour per key). Never throws.
 */
export async function alertTeam(key: string, subject: string, err: unknown): Promise<void> {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  try {
    await sql`select private.raise_alert('function_error', ${subject}, ${`${subject}\n\n${detail.slice(0, 2000)}\n\nSe loggen för funktionen i Supabase (Edge Functions → Logs).`}, ${key}, interval '1 hour')`;
  } catch (e) {
    console.error("alertTeam failed", e);
  }
}

/** Kronor → öre, as Stripe wants amounts. */
export const ore = (kr: number) => Math.round(kr * 100);
