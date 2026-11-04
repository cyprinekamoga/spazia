/**
 * Leads, visit slots and bookings, stored in Netlify Blobs (EU region).
 *
 * Keys in the "spazia" store:
 *   lead/<id>          the registration, written once by the form function
 *   meta/<id>          status, notes and emails sent (written from admin)
 *   slot/<id>          a visit time the team has opened
 *   booking/<slotId>   who booked the slot (created atomically, so a slot
 *                      can never be booked twice)
 *   lead-booking/<id>  which slot a lead has booked
 *
 * Only relative imports: the function bundler does not know the "@/" alias.
 */
import { getStore, type Store } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { detectKind, type LeadKind } from "../lib/lead-emails";
import { env } from "./env";

export type { LeadKind };
export type LeadStatus = "new" | "contacted" | "visited" | "listed" | "matched" | "declined";
export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "visited", "listed", "matched", "declined"];

export interface Lead {
  id: string;
  kind: LeadKind;
  createdAt: string;
  data: Record<string, string>;
}

export interface LeadMeta {
  status: LeadStatus;
  notes: string;
  updatedAt: string | null;
  mailings: { at: string; subject: string; tag: string }[];
}

export interface Slot {
  id: string;
  start: string;
  end: string;
  createdAt: string;
}

export interface Booking {
  slotId: string;
  leadId: string;
  address: string;
  phone: string;
  note: string;
  bookedAt: string;
}

/** Fields we keep from a form submission. Anything else (IP, user agent …) is dropped. */
const LEAD_FIELDS = [
  "ref", "first_name", "email", "phone", "city", "area", "lang",
  "space_type", "heated", "engine_heater", "size", "accepts",
  "items", "quantity", "start", "duration", "occupation", "has_bankid",
  "message", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer", "landing_page",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidId(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

let cached: Store | null = null;

function store(): Store {
  if (!cached) {
    // Personal data stays in the EU. BLOBS_REGION=none is only for local tests.
    const region = env("BLOBS_REGION") || "eu-central-1";
    cached = getStore({
      name: "spazia",
      consistency: "strong",
      ...(region === "none" ? {} : { region: region as "eu-central-1" }),
    });
  }
  return cached;
}

/** For tests: forget the store so a new environment is picked up. */
export function resetStoreForTests() {
  cached = null;
}

async function getJSON<T>(key: string): Promise<T | null> {
  return (await store().get(key, { type: "json" })) as T | null;
}

async function keys(prefix: string): Promise<string[]> {
  const { blobs } = await store().list({ prefix });
  return blobs.map((b) => b.key);
}

/** Run async work over a list with limited parallelism. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/* ---------- Leads ---------- */


/** Store a form submission. Returns the lead (or the existing one if this id was already stored). */
export async function saveLead(raw: Record<string, string | undefined>): Promise<Lead | null> {
  const kind = detectKind(raw);
  if (!kind) return null;
  const data: Record<string, string> = {};
  for (const field of LEAD_FIELDS) {
    const value = (raw[field] ?? "").toString().trim().slice(0, field === "message" ? 1000 : 300);
    if (value) data[field] = value;
  }
  const id = isValidId(data.ref) ? data.ref.toLowerCase() : randomUUID();
  const lead: Lead = { id, kind, createdAt: new Date().toISOString(), data };
  const { modified } = await store().setJSON(`lead/${id}`, lead, { onlyIfNew: true });
  if (!modified) return (await getLead(id)) ?? lead;
  return lead;
}

export function getLead(id: string): Promise<Lead | null> {
  return getJSON<Lead>(`lead/${id}`);
}

export async function getMeta(id: string): Promise<LeadMeta> {
  return (await getJSON<LeadMeta>(`meta/${id}`)) ?? { status: "new", notes: "", updatedAt: null, mailings: [] };
}

export async function updateMeta(id: string, change: Partial<Pick<LeadMeta, "status" | "notes">>): Promise<LeadMeta> {
  const meta = await getMeta(id);
  if (change.status && LEAD_STATUSES.includes(change.status)) meta.status = change.status;
  if (typeof change.notes === "string") meta.notes = change.notes.slice(0, 4000);
  meta.updatedAt = new Date().toISOString();
  await store().setJSON(`meta/${id}`, meta);
  return meta;
}

export async function recordMailing(id: string, mailing: { subject: string; tag: string }): Promise<void> {
  const meta = await getMeta(id);
  meta.mailings = [...meta.mailings, { at: new Date().toISOString(), ...mailing }].slice(-50);
  await store().setJSON(`meta/${id}`, meta);
}

/** Delete everything about a lead (GDPR request). */
export async function deleteLead(id: string): Promise<void> {
  await cancelBooking(id);
  await store().delete(`lead/${id}`);
  await store().delete(`meta/${id}`);
}

export interface LeadRow extends Lead {
  meta: LeadMeta;
  booking: (Booking & { start: string; end: string }) | null;
}

export async function listLeads(): Promise<LeadRow[]> {
  const ids = (await keys("lead/")).map((k) => k.slice("lead/".length));
  const rows = await mapLimit(ids, 25, async (id) => {
    const [lead, meta, booking] = await Promise.all([getLead(id), getMeta(id), bookingForLead(id)]);
    return lead ? { ...lead, meta, booking } : null;
  });
  return rows.filter((r): r is LeadRow => r !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ---------- Slots ---------- */

export async function listSlots(): Promise<Slot[]> {
  const slotKeys = await keys("slot/");
  const slots = await mapLimit(slotKeys, 25, (k) => getJSON<Slot>(k));
  return slots.filter((s): s is Slot => s !== null).sort((a, b) => a.start.localeCompare(b.start));
}

export function getSlot(id: string): Promise<Slot | null> {
  return getJSON<Slot>(`slot/${id}`);
}

export async function createSlots(input: { start: string; end: string }[]): Promise<Slot[]> {
  const created: Slot[] = [];
  for (const s of input) {
    const id = `${s.start.replace(/[-:.]/g, "").slice(0, 13)}-${randomUUID().slice(0, 8)}`;
    const slot: Slot = { id, start: s.start, end: s.end, createdAt: new Date().toISOString() };
    await store().setJSON(`slot/${id}`, slot);
    created.push(slot);
  }
  return created;
}

export async function deleteSlot(id: string): Promise<void> {
  const booking = await getBooking(id);
  if (booking) await cancelBooking(booking.leadId);
  await store().delete(`slot/${id}`);
}

/* ---------- Bookings ---------- */

export function getBooking(slotId: string): Promise<Booking | null> {
  return getJSON<Booking>(`booking/${slotId}`);
}

export async function bookingForLead(leadId: string): Promise<(Booking & { start: string; end: string }) | null> {
  const ref = await getJSON<{ slotId: string }>(`lead-booking/${leadId}`);
  if (!ref) return null;
  const [booking, slot] = await Promise.all([getBooking(ref.slotId), getSlot(ref.slotId)]);
  if (!booking || !slot || booking.leadId !== leadId) return null;
  return { ...booking, start: slot.start, end: slot.end };
}

/**
 * Book a slot for a lead. The slot is claimed with a create-only write, so
 * two people can never get the same time. A lead that already had a time
 * gets the old one released.
 */
export async function bookSlot(
  leadId: string,
  slotId: string,
  details: { address: string; phone: string; note: string },
): Promise<{ ok: true; booking: Booking; previous: Booking | null } | { ok: false; reason: "taken" }> {
  const booking: Booking = { slotId, leadId, ...details, bookedAt: new Date().toISOString() };
  const existing = await getBooking(slotId);
  if (existing && existing.leadId === leadId) {
    // Same lead, same time: just update the details.
    await store().setJSON(`booking/${slotId}`, booking);
    return { ok: true, booking, previous: null };
  }
  const { modified } = await store().setJSON(`booking/${slotId}`, booking, { onlyIfNew: true });
  if (!modified) return { ok: false, reason: "taken" };
  // Belt and braces: read the claim back after a moment. If two requests
  // ever both got through, only the one whose write is stored keeps the time.
  await new Promise((resolve) => setTimeout(resolve, 300));
  const stored = await getBooking(slotId);
  if (stored?.leadId !== leadId) return { ok: false, reason: "taken" };

  const previousRef = await getJSON<{ slotId: string }>(`lead-booking/${leadId}`);
  await store().setJSON(`lead-booking/${leadId}`, { slotId });
  let previous: Booking | null = null;
  if (previousRef && previousRef.slotId !== slotId) {
    previous = await getBooking(previousRef.slotId);
    if (previous?.leadId === leadId) await store().delete(`booking/${previousRef.slotId}`);
  }
  return { ok: true, booking, previous };
}

/** Cancel a lead's booking. Returns the cancelled booking with its time, if there was one. */
export async function cancelBooking(leadId: string): Promise<(Booking & { start: string; end: string }) | null> {
  const current = await bookingForLead(leadId);
  const ref = await getJSON<{ slotId: string }>(`lead-booking/${leadId}`);
  if (ref) {
    const booking = await getBooking(ref.slotId);
    if (booking?.leadId === leadId) await store().delete(`booking/${ref.slotId}`);
    await store().delete(`lead-booking/${leadId}`);
  }
  return current;
}

/** Free slots a host can pick: in the future (at least 2 hours ahead) and within 60 days. */
export async function freeSlots(now = Date.now()): Promise<Slot[]> {
  const slots = await listSlots();
  const upcoming = slots.filter((s) => {
    const t = Date.parse(s.start);
    return t > now + 2 * 3600_000 && t < now + 60 * 86400_000;
  });
  const taken = await mapLimit(upcoming, 25, (s) => getBooking(s.id));
  return upcoming.filter((_, i) => taken[i] === null);
}
