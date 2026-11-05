/**
 * API for the admin page (/admin). Everything except login requires the
 * session cookie; everything that changes data must come from our own page.
 *
 *   POST   /api/admin/login              { password }
 *   POST   /api/admin/logout
 *   GET    /api/admin/data               all sign-ups
 *   PATCH  /api/admin/leads/<id>         { status?, notes? }
 *   DELETE /api/admin/leads/<id>         delete everything about a lead
 *   POST   /api/admin/mail               { ids, subject: {sv,en}, body: {sv,en}, tag }
 *
 * Set ADMIN_PASSWORD in Netlify (Project configuration → Environment
 * variables, scope Functions) and redeploy.
 */
import type { Config } from "@netlify/functions";
import { adminPassword, checkPassword, clearSessionCookie, createSessionCookie, isLoggedIn } from "../../src/server/auth";
import { campaignEmail } from "../../src/server/campaign-email";
import { deleteLead, getLead, isValidId, LEAD_STATUSES, listLeads, recordMailing, updateMeta, type LeadStatus } from "../../src/server/db";
import { error, isSameOriginJson, json, readJson, sleep, str } from "../../src/server/http";
import { mailConfigured, sendMail, teamAddress } from "../../src/server/mailer";

const MAX_MAIL_BATCH = 20;

async function login(req: Request): Promise<Response> {
  if (!adminPassword()) return error(503, "not_configured");
  const body = await readJson(req);
  if (!checkPassword(body?.password)) {
    await sleep(1500); // slows down guessing
    return error(401, "wrong_password");
  }
  return json({ ok: true }, 200, { "set-cookie": createSessionCookie() });
}

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
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/admin/, "").replace(/\/+$/, "") || "/";
  const method = req.method;

  try {
    if (method !== "GET" && !isSameOriginJson(req)) return error(403, "forbidden");
    if (method === "POST" && path === "/login") return await login(req);
    if (method === "POST" && path === "/logout") return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });

    if (!adminPassword()) return error(503, "not_configured");
    if (!isLoggedIn(req)) return error(401, "login_required");

    if (method === "GET" && path === "/data") return await data();
    if (method === "POST" && path === "/mail") return await mail(req);

    const [, resource, id] = path.split("/");
    if (resource === "leads" && isValidId(id)) {
      if (method === "PATCH") return await patchLead(req, id);
      if (method === "DELETE") {
        await deleteLead(id);
        return json({ ok: true });
      }
    }
    return error(404, "not_found");
  } catch (err) {
    console.error("admin:", err);
    return error(500, "server_error");
  }
};

export default admin;

export const config: Config = {
  path: "/api/admin/*",
};
