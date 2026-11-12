/**
 * Errors from people's browsers in the app (src/components/app/ErrorReporter.tsx).
 *
 *   POST /api/client-error   { message, stack, url, lang }
 *
 * Throttled per error and per day (src/server/client-errors.ts) and emailed
 * to the team. Nothing personal is stored: no IP address, no user id.
 */
import type { Config } from "@netlify/functions";
import { site } from "../../src/lib/site";
import { errorEmailText, fingerprint, isNoise, shouldSend } from "../../src/server/client-errors";
import { readJson, str } from "../../src/server/http";
import { sendMail, teamAddress } from "../../src/server/mailer";

const ALLOWED = [site.appUrl, "http://localhost:3001"];

export default async function clientError(req: Request): Promise<Response> {
  const origin = req.headers.get("origin") ?? "";
  const cors = { "access-control-allow-origin": ALLOWED.includes(origin) ? origin : site.appUrl, vary: "origin" };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type" } });
  }
  if (req.method !== "POST" || !ALLOWED.includes(origin)) return new Response(null, { status: 403, headers: cors });
  const body = await readJson(req);
  const e = {
    message: str(body?.message, 500),
    stack: str(body?.stack, 4000),
    url: str(body?.url, 500).replace(/[?#].*$/, ""),
    lang: str(body?.lang, 5),
    userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  };
  if (!e.message || isNoise(e)) return new Response(null, { status: 204, headers: cors });
  try {
    const { send, count } = await shouldSend(fingerprint(e));
    if (send) {
      const text = errorEmailText(e, count);
      const html = `<pre style="font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`;
      await sendMail({ to: teamAddress(), subject: `[Spazia] Fel i appen: ${e.message.slice(0, 80)}`, text, html });
    }
  } catch (err) {
    console.error("client-error:", err);
  }
  return new Response(null, { status: 204, headers: cors });
}

export const config: Config = { path: "/api/client-error" };
