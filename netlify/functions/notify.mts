/**
 * Emails about requests and bookings in the app.
 *
 *   POST /api/notify   { id, token }
 *
 * Called by the app's database (pg_net) when a request or booking is created,
 * answered or cancelled. The one-time token is traded for the email's details
 * (public.claim_notification), the email goes out over SMTP like the
 * waitlist emails, and the database is told whether it was sent
 * (public.finish_notification). A token that was already used gives nothing,
 * so calling this again never sends the same email twice.
 *
 * Needs the same SMTP settings as lead-emails. The address of this function
 * is stored in the database (private.settings, key 'notify_url').
 */
import type { Config } from "@netlify/functions";
import { site } from "../../src/lib/site";
import { buildBookingEmail, type NotificationPayload } from "../../src/server/booking-email";
import { error, json, readJson, str } from "../../src/server/http";
import { sendMail, teamAddress } from "../../src/server/mailer";
import { env } from "../../src/server/env";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[0-9a-f]{64}$/;

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${site.appSupabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: site.appSupabaseKey, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export default async function notify(req: Request): Promise<Response> {
  if (req.method !== "POST") return error(405, "method_not_allowed");
  const body = await readJson(req);
  const id = str(body?.id, 40);
  const token = str(body?.token, 80);
  if (!UUID_RE.test(id) || !TOKEN_RE.test(token)) return error(400, "bad_request");

  let payload: NotificationPayload | null;
  try {
    payload = await rpc<NotificationPayload | null>("claim_notification", { p_id: id, p_token: token });
  } catch (err) {
    console.error("notify: could not claim", err);
    return error(502, "claim_failed");
  }
  // Unknown, already sent or too old: nothing to do.
  if (!payload) return json({ ok: true, skipped: true });

  const appUrl = env("APP_URL") || site.appUrl;
  const mail = buildBookingEmail(payload, { appUrl, team: teamAddress() });
  // No address (e.g. a deleted account): mark it as done.
  const sent = mail ? await sendMail(mail) : true;
  try {
    await rpc("finish_notification", { p_id: id, p_token: token, p_sent: sent });
  } catch (err) {
    console.error("notify: could not report back", err);
  }
  return sent ? json({ ok: true }) : error(502, "mail_failed");
}

export const config: Config = { path: "/api/notify" };
