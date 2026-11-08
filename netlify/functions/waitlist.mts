/**
 * Public waitlist numbers for the site.
 *
 *   GET /api/waitlist?ref=<id>    one sign-up's place in line, its town's count
 *                                 and how many signed up with its invite link
 *   GET /api/waitlist/demand      sign-ups per town (towns with at least 3)
 *
 * Only numbers and town names, never names or contact details. The id is the
 * random id the browser created for the sign-up (also in the confirmation
 * email), so nobody can look up someone else's place by guessing.
 */
import type { Config } from "@netlify/functions";
import { getLead, getStats, inviteCode, isValidId } from "../../src/server/db";
import { error, json } from "../../src/server/http";
import { townKey } from "../../src/content/cities";

const MIN_TOWN_COUNT = 3;

export default async function waitlist(req: Request): Promise<Response> {
  if (req.method !== "GET") return error(405, "method_not_allowed");
  const url = new URL(req.url);

  try {
    if (url.pathname.replace(/\/$/, "").endsWith("/demand")) {
      const stats = await getStats();
      const towns = Object.values(stats.towns)
        .map((t) => ({ name: t.name, hosts: t.host, renters: t.renter, total: t.host + t.renter }))
        .filter((t) => t.total >= MIN_TOWN_COUNT)
        .sort((a, b) => b.total - a.total);
      return json({ towns }, 200, { "cache-control": "public, max-age=300" });
    }

    const ref = (url.searchParams.get("ref") ?? "").toLowerCase();
    if (!isValidId(ref)) return error(400, "bad_request");
    const lead = await getLead(ref);
    if (!lead || (lead.kind !== "host" && lead.kind !== "renter")) return json({ found: false });
    const stats = await getStats();
    const town = stats.towns[townKey(lead.data.city ?? "")];
    const code = inviteCode(lead.id);
    return json({
      found: true,
      kind: lead.kind,
      town: lead.data.city ?? "",
      position: lead.position ?? null,
      townTotal: town ? town.host + town.renter : null,
      invited: stats.invites[code] ?? 0,
      code,
      lang: lead.data.lang === "en" ? "en" : "sv",
    });
  } catch (err) {
    console.error("waitlist:", err);
    return error(500, "server_error");
  }
}

export const config: Config = { path: ["/api/waitlist", "/api/waitlist/demand"] };
