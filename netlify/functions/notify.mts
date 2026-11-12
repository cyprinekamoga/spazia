/**
 * Emails about requests and bookings in the app, and alerts to the team.
 *
 *   POST /api/notify   { id, token }        an email to a user (claim_notification),
 *                                           including saved-search matches
 *   POST /api/notify   { alert, token }     an alert to the team (claim_team_alert)
 *   POST /api/notify   { announce, token }  a newly published listing: email the
 *                                           waitlist in its town (claim_listing_announcement)
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
import { townKey } from "../../src/content/cities";
import { searchMatchEmail, waitlistListingEmail, type AnnouncedListing, type SearchMatchPayload } from "../../src/server/alert-email";
import { buildBookingEmail, type NotificationPayload } from "../../src/server/booking-email";
import { listLeads, recordMailing } from "../../src/server/db";
import { error, json, readJson, str } from "../../src/server/http";
import { sendMail, teamAddress, type OutgoingMail } from "../../src/server/mailer";
import { sendPush, type PushMessage } from "../../src/server/push";
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

/** A short push version of an email: its subject, the first real line, and where its button goes. */
function pushMessage(mail: OutgoingMail, appUrl: string, tag: string): PushMessage {
  const lines = mail.text.split("\n\n").map((l) => l.trim()).filter(Boolean);
  const first = (lines[1] ?? "").split("\n")[0];
  const body = first.length <= 180 ? first : `${first.slice(0, 178).replace(/\s+\S*$/, "")} …`;
  const button = /https:\/\/\S+/.exec(lines.find((l) => l.includes(appUrl)) ?? "");
  const url = button ? button[0].replace(appUrl, "") || "/" : "/";
  return { title: mail.subject, body, url, tag };
}

/** An alert to the team (MAIL_TO): reports, failing emails, stuck payments. */
async function teamAlert(id: string, token: string): Promise<Response> {
  let alert: { kind: string; subject: string; body: string } | null;
  try {
    alert = await rpc<typeof alert>("claim_team_alert", { p_id: id, p_token: token });
  } catch (err) {
    console.error("notify: could not claim alert", err);
    return error(502, "claim_failed");
  }
  if (!alert) return json({ ok: true, skipped: true });
  const text = `${alert.body}\n\n– Spazia (automatiskt meddelande)`;
  const sent = await sendMail({
    to: teamAddress(),
    subject: `[Spazia] ${alert.subject}`,
    text,
    html: `<pre style="font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`,
  });
  try {
    await rpc("finish_team_alert", { p_id: id, p_token: token, p_sent: sent });
  } catch (err) {
    console.error("notify: could not report back", err);
  }
  return sent ? json({ ok: true }) : error(502, "mail_failed");
}

/** Waitlist emails a lead gets at most once a week. */
const WAITLIST_TAG = "listing-alert";
const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * A listing was published: email the renters on the waitlist in its town.
 * Sends for about seven seconds; if people are left, it reports "not done" and
 * the database calls again a few minutes later (the mailing log stops repeats).
 */
async function announceListing(id: string, token: string): Promise<Response> {
  let listing: AnnouncedListing | null;
  try {
    listing = await rpc<AnnouncedListing | null>("claim_listing_announcement", { p_id: id, p_token: token });
  } catch (err) {
    console.error("notify: could not claim announcement", err);
    return error(502, "claim_failed");
  }
  if (!listing) return json({ ok: true, skipped: true });

  const appUrl = env("APP_URL") || site.appUrl;
  const team = teamAddress();
  const town = townKey(listing.city);
  const since = Date.now() - WEEK;
  const started = Date.now();
  let queue: Awaited<ReturnType<typeof listLeads>> = [];
  try {
    queue = (await listLeads()).filter(
      (l) =>
        l.kind === "renter" &&
        l.data.email &&
        townKey(l.data.city ?? "") === town &&
        l.meta.status !== "declined" &&
        l.meta.status !== "matched" &&
        !l.meta.mailings.some((m) => m.tag === WAITLIST_TAG && Date.parse(m.at) > since),
    );
  } catch (err) {
    console.error("notify: could not read the waitlist", err);
  }

  let sent = 0;
  let failed = 0;
  while (queue.length && Date.now() - started < 7000) {
    const batch = queue.splice(0, 4);
    await Promise.all(
      batch.map(async (lead) => {
        const mail = waitlistListingEmail(lead, listing!, { appUrl, team });
        if (!mail) return;
        if (await sendMail(mail)) {
          sent++;
          await recordMailing(lead.id, { subject: mail.subject, tag: WAITLIST_TAG }).catch((err) => console.error("notify: record mailing", err));
        } else failed++;
      }),
    );
  }
  const done = queue.length === 0;
  try {
    await rpc("finish_listing_announcement", { p_id: id, p_token: token, p_sent: done });
  } catch (err) {
    console.error("notify: could not report back", err);
  }
  return json({ ok: true, sent, failed, remaining: queue.length });
}

export default async function notify(req: Request): Promise<Response> {
  if (req.method !== "POST") return error(405, "method_not_allowed");
  const body = await readJson(req);
  const alertId = str(body?.alert, 40);
  if (alertId) {
    const token = str(body?.token, 80);
    if (!UUID_RE.test(alertId) || !TOKEN_RE.test(token)) return error(400, "bad_request");
    return teamAlert(alertId, token);
  }
  const announceId = str(body?.announce, 40);
  if (announceId) {
    const token = str(body?.token, 80);
    if (!UUID_RE.test(announceId) || !TOKEN_RE.test(token)) return error(400, "bad_request");
    return announceListing(announceId, token);
  }
  const id = str(body?.id, 40);
  const token = str(body?.token, 80);
  if (!UUID_RE.test(id) || !TOKEN_RE.test(token)) return error(400, "bad_request");

  let payload: NotificationPayload | SearchMatchPayload | null;
  try {
    payload = await rpc<NotificationPayload | SearchMatchPayload | null>("claim_notification", { p_id: id, p_token: token });
  } catch (err) {
    console.error("notify: could not claim", err);
    return error(502, "claim_failed");
  }
  // Unknown, already sent or too old: nothing to do.
  if (!payload) return json({ ok: true, skipped: true });

  const appUrl = env("APP_URL") || site.appUrl;
  const mail =
    payload.kind === "search_match" ? searchMatchEmail(payload, { appUrl, team: teamAddress() }) : buildBookingEmail(payload, { appUrl, team: teamAddress() });
  const tag = payload.kind === "search_match" ? `search-${payload.alert.id}` : `${payload.kind}-${payload.request_id}`;
  // No address (e.g. a deleted account): mark it as done.
  const sent = mail ? await sendMail(mail) : true;

  // The same news as a push notification on the user's devices (if they turned it on).
  if (mail && sent && payload.push?.length) {
    const message = pushMessage(mail, appUrl, tag);
    const { gone } = await sendPush(payload.push, message, teamAddress());
    if (gone.length) await rpc("drop_push_subscriptions", { p_id: id, p_token: token, p_endpoints: gone }).catch((err) => console.error("notify: drop push", err));
  }
  try {
    await rpc("finish_notification", { p_id: id, p_token: token, p_sent: sent });
  } catch (err) {
    console.error("notify: could not report back", err);
  }
  return sent ? json({ ok: true }) : error(502, "mail_failed");
}

export const config: Config = { path: "/api/notify" };
