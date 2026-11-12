/**
 * The public key the app needs to subscribe a device to push notifications.
 *
 *   GET /api/push-key   → { key }
 *
 * The key pair is created on first use and kept in Netlify Blobs
 * (src/server/push.ts); only the public half is ever sent out.
 */
import type { Config } from "@netlify/functions";
import { site } from "../../src/lib/site";
import { vapidKeys } from "../../src/server/push";

const ALLOWED = [site.appUrl, "http://localhost:3001"];

export default async function pushKey(req: Request): Promise<Response> {
  const origin = req.headers.get("origin") ?? "";
  const cors = { "access-control-allow-origin": ALLOWED.includes(origin) ? origin : site.appUrl, vary: "origin" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET" } });
  if (req.method !== "GET") return new Response("method not allowed", { status: 405, headers: cors });
  try {
    const { publicKey } = await vapidKeys();
    return new Response(JSON.stringify({ key: publicKey }), {
      headers: { ...cors, "content-type": "application/json", "cache-control": "public, max-age=3600" },
    });
  } catch (err) {
    console.error("push-key:", err);
    return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: { ...cors, "content-type": "application/json" } });
  }
}

export const config: Config = { path: "/api/push-key" };
