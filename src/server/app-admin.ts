/**
 * Access to the sign-ups API (/api/admin) from the app's admin page
 * (app.spazia.se/admin): the request carries the admin's Supabase login token,
 * and the database decides (public.admin_check: on the admin list, with the
 * two-factor code when that is required). No password or cookie.
 *
 * Only relative imports: the function bundler does not know the "@/" alias.
 */
import { site } from "../lib/site";

const ALLOWED_ORIGINS = [site.appUrl, "http://localhost:3001"];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return { "access-control-allow-origin": ALLOWED_ORIGINS.includes(origin) ? origin : site.appUrl, vary: "origin" };
}

export function bearerToken(req: Request): string | null {
  const match = (req.headers.get("authorization") ?? "").match(/^Bearer\s+([A-Za-z0-9._-]{20,4096})$/);
  return match ? match[1] : null;
}

/** True when the token belongs to an admin with the access the database requires. */
export async function isAppAdmin(req: Request, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const token = bearerToken(req);
  if (!token) return false;
  const res = await fetchImpl(`${site.appSupabaseUrl}/rest/v1/rpc/admin_check`, {
    method: "POST",
    headers: { apikey: site.appSupabaseKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: "{}",
  });
  if (!res.ok) return false;
  return (await res.json()) === true;
}
