/**
 * API for the sign-ups, used by the "Leads" tab in the app's admin page
 * (app.spazia.se/admin). Every request carries the admin's Supabase login
 * token, and the database decides whether it is enough (on the admin list,
 * with the two-factor code when that is required); see src/server/app-admin.ts.
 * The token can't be sent by another site's form, so there is no cookie and
 * no password.
 *
 *   GET    /api/admin/data               all sign-ups
 *   PATCH  /api/admin/leads/<id>         { status?, notes? }
 *   DELETE /api/admin/leads/<id>         delete everything about a lead
 *   POST   /api/admin/mail               { ids, subject: {sv,en}, body: {sv,en}, tag }
 */
import type { Config } from "@netlify/functions";
import { corsHeaders, isAppAdmin } from "../../src/server/app-admin";
import { campaignEmail } from "../../src/server/campaign-email";
import { deleteLead, getLead, isValidId, LEAD_STATUSES, listLeads, rebuildStats, recordMailing, updateMeta, type LeadStatus } from "../../src/server/db";
import { error, json, readJson, str } from "../../src/server/http";
import { mailConfigured, sendMail, teamAddress } from "../../src/server/mailer";

const MAX_MAIL_BATCH = 20;

async function data(): Promise<Response> {
  return json({ leads: await listLeads(), mailConfigured: mailConfigured(), now: Date.now() });
}

async function patchLead(req: Request, id: string): Promise<Response> {
  const body = await readJson(req);
  if (!body) return error(400, "bad_request");
  if (!(await getLead(id))) return error(404, "not_found");
  const status = typeof body.status === "string" && LEAD_STATUSES.includes(body.status as LeadStatus) ? (body.status as LeadStatus) : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  return json({ meta: await updateMeta(id, { status, notes }) });
}

async function mail(req: Request): Promise<Response> {
  if (!mailConfigured()) return error(503, "mail_not_configured");
  const body = await readJson(req);
  const ids = Array.isArray(body?.ids) ? (body.ids as unknown[]).filter(isValidId) : [];
  const subject = body?.subject as { sv?: unknown; en?: unknown } | undefined;
  const text = body?.body as { sv?: unknown; en?: unknown } | undefined;
  const s = { sv: str(subject?.sv, 200), en: str(subject?.en, 200) };
  const b = { sv: str(text?.sv, 5000), en: str(text?.en, 5000) };
  const tag = str(body?.tag, 80);
  if (ids.length === 0 || ids.length > MAX_MAIL_BATCH || !s.sv || !b.sv) return error(400, "bad_request");

  const sent: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    const lead = await getLead(id);
    if (!lead?.data.email) {
      failed.push(id);
      continue;
    }
    const message = campaignEmail(lead, s, b, teamAddress());
    if (await sendMail(message)) {
      await recordMailing(id, { subject: message.subject, tag });
      sent.push(id);
    } else {
      failed.push(id);
    }
  }
  return json({ sent, failed });
}

const admin = async (req: Request): Promise<Response> => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...cors, "access-control-allow-methods": "GET, POST, PATCH, DELETE", "access-control-allow-headers": "authorization, content-type", "access-control-max-age": "600" },
    });
  }
  const res = await handle(req);
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
};

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/admin/, "").replace(/\/+$/, "") || "/";
  const method = req.method;

  try {
    if (!(await isAppAdmin(req))) return error(401, "login_required");

    if (method === "GET" && path === "/data") return await data();
    if (method === "POST" && path === "/mail") return await mail(req);

    const [, resource, id] = path.split("/");
    if (resource === "leads" && isValidId(id)) {
      if (method === "PATCH") return await patchLead(req, id);
      if (method === "DELETE") {
        await deleteLead(id);
        await rebuildStats().catch((err) => console.error("waitlist: could not recount:", err));
        return json({ ok: true });
      }
    }
    return error(404, "not_found");
  } catch (err) {
    console.error("admin:", err);
    return error(500, "server_error");
  }
}

export default admin;

export const config: Config = {
  path: "/api/admin/*",
};
