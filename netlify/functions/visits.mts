/**
 * Visit booking for hosts in Luleå (public API, used by /boka-besok and the
 * host form's thank-you screen).
 *
 *   GET  /api/visits?ref=<lead id>   free times + the host's current booking
 *   POST /api/visits/book            { ref, slotId, address, phone, note }
 *   POST /api/visits/cancel          { ref }
 *
 * The lead id is a random UUID that only the host has (from the form or the
 * link in their confirmation email), so it works like a private link.
 */
import type { Config } from "@netlify/functions";
import { isLulea } from "../../src/content/cities";
import { bookingForLead, bookSlot, cancelBooking, freeSlots, getLead, getSlot, isValidId, type Lead } from "../../src/server/db";
import { siteUrl } from "../../src/server/env";
import { error, isSameOriginJson, json, readJson, str } from "../../src/server/http";
import { sendMail, teamAddress } from "../../src/server/mailer";
import { hostBookedEmail, hostCancelledEmail, teamVisitEmail } from "../../src/server/visit-emails";

const PHONE_RE = /^[+\d][\d\s()-]{5,24}$/;

function canBook(lead: Lead): boolean {
  return lead.kind === "host" && isLulea(lead.data.city ?? (lead.data.area ? "Luleå" : ""));
}

async function loadLead(ref: unknown): Promise<Lead | Response> {
  if (!isValidId(ref)) return error(400, "bad_ref");
  const lead = await getLead(ref.toLowerCase());
  // The form function may still be storing a brand-new lead: the page retries on 404.
  if (!lead) return error(404, "unknown_ref");
  return lead;
}

async function status(req: Request): Promise<Response> {
  const lead = await loadLead(new URL(req.url).searchParams.get("ref"));
  if (lead instanceof Response) return lead;
  if (!canBook(lead)) return json({ available: false, name: lead.data.first_name ?? "", slots: [], booking: null });
  const [slots, booking] = await Promise.all([freeSlots(), bookingForLead(lead.id)]);
  return json({
    available: true,
    name: lead.data.first_name ?? "",
    phone: lead.data.phone ?? "",
    slots: slots.map(({ id, start, end }) => ({ id, start, end })),
    booking: booking && {
      slotId: booking.slotId,
      start: booking.start,
      end: booking.end,
      address: booking.address,
      phone: booking.phone,
      note: booking.note,
    },
  });
}

async function book(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body) return error(400, "bad_request");
  const lead = await loadLead(body.ref);
  if (lead instanceof Response) return lead;
  if (!canBook(lead)) return error(403, "not_available");

  const slotId = str(body.slotId, 80);
  const address = str(body.address, 200);
  const phone = str(body.phone, 40);
  const note = str(body.note, 500);
  if (address.length < 4) return error(400, "address");
  if (!PHONE_RE.test(phone)) return error(400, "phone");

  const slot = slotId ? await getSlot(slotId) : null;
  if (!slot || Date.parse(slot.start) < Date.now() + 2 * 3600_000) return error(409, "slot_gone");

  const result = await bookSlot(lead.id, slot.id, { address, phone, note });
  if (!result.ok) return error(409, "slot_taken");

  const previousSlot = result.previous ? await getSlot(result.previous.slotId) : null;
  const site = siteUrl();
  const team = teamAddress();
  if (lead.data.email) await sendMail(hostBookedEmail(lead, result.booking, slot, site, team));
  await sendMail(teamVisitEmail("booked", lead, slot, result.booking, site, team, previousSlot));

  return json({
    booking: { slotId: slot.id, start: slot.start, end: slot.end, address, phone, note },
  });
}

async function cancel(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body) return error(400, "bad_request");
  const lead = await loadLead(body.ref);
  if (lead instanceof Response) return lead;
  const cancelled = await cancelBooking(lead.id);
  if (cancelled) {
    const slot = { id: cancelled.slotId, start: cancelled.start, end: cancelled.end, createdAt: "" };
    const site = siteUrl();
    const team = teamAddress();
    if (lead.data.email) await sendMail(hostCancelledEmail(lead, slot, site, team, false));
    await sendMail(teamVisitEmail("cancelled", lead, slot, cancelled, site, team));
  }
  return json({ ok: true });
}

const visits = async (req: Request): Promise<Response> => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  try {
    if (req.method === "GET" && path === "/api/visits") return await status(req);
    if (req.method === "POST" && (path === "/api/visits/book" || path === "/api/visits/cancel")) {
      if (!isSameOriginJson(req)) return error(403, "forbidden");
      return path.endsWith("/book") ? await book(req) : await cancel(req);
    }
    return error(404, "not_found");
  } catch (err) {
    console.error("visits:", err);
    return error(500, "server_error");
  }
};

export default visits;

export const config: Config = {
  path: ["/api/visits", "/api/visits/*"],
};
