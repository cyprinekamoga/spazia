/**
 * Shared by the listing edge functions (Deno on Netlify's edge). Only
 * explicit .ts imports: Deno needs the extension.
 */

/** Renter service fee. Must match FEES.renterServiceFee in src/content/pricing.ts (a unit test checks). */
export const SERVICE_FEE = 0.15;

/** Public values (the same as in src/lib/site.ts); can be overridden in Netlify. */
const DEFAULT_SUPABASE_URL = "https://mtyhnfsceahvovauckkj.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_nsP78clPf6bC9c3IWh3B3g__3BwGF23";
export const APP_URL = "https://app.spazia.se";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

function envVar(name: string): string | undefined {
  try {
    return typeof Netlify !== "undefined" ? Netlify.env.get(name) || undefined : undefined;
  } catch {
    return undefined;
  }
}

export const supabaseUrl = () => envVar("NEXT_PUBLIC_APP_SUPABASE_URL") ?? DEFAULT_SUPABASE_URL;
const supabaseKey = () => envVar("NEXT_PUBLIC_APP_SUPABASE_KEY") ?? DEFAULT_SUPABASE_KEY;

/** Only the app project serves listings; on spazia.se these functions step aside. */
export function isAppHost(host: string): boolean {
  const h = host.split(":")[0];
  return h === "app.spazia.se" || h.includes("spazia-app") || h === "localhost" || h === "127.0.0.1";
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A read through the public API (only what the access rules show anyone). Throws on errors and timeouts. */
export async function publicGet<T>(path: string, init: RequestInit = {}, timeoutMs = 3000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${supabaseUrl()}${path}`, {
      ...init,
      headers: { apikey: supabaseKey(), "content-type": "application/json", ...(init.headers ?? {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`supabase ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface EdgeContext {
  next: () => Promise<Response>;
}
