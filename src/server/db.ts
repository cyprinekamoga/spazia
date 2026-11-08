/**
 * Sign-ups for the admin page, stored in Netlify Blobs (EU region).
 *
 * Keys in the "spazia" store:
 *   lead/<id>   the registration, written once by the form function
 *   meta/<id>   status, notes and emails sent (written from admin)
 *
 * Only relative imports: the function bundler does not know the "@/" alias.
 */
import { getStore, type Store } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { tidyTown, townKey } from "../content/cities";
import { detectKind, type LeadKind } from "../lib/lead-emails";
import { env } from "./env";

export type { LeadKind };
export type LeadStatus = "new" | "contacted" | "listed" | "matched" | "declined";
export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "listed", "matched", "declined"];

export interface Lead {
  id: string;
  kind: LeadKind;
  createdAt: string;
  data: Record<string, string>;
  /** Place in line among sign-ups of the same kind in the same town (hosts and renters only). */
  position?: number;
}

export interface LeadMeta {
  status: LeadStatus;
  notes: string;
  updatedAt: string | null;
  mailings: { at: string; subject: string; tag: string }[];
}

/** Fields we keep from a form submission. Anything else (IP, user agent …) is dropped. */
const LEAD_FIELDS = [
  "ref", "first_name", "email", "phone", "city", "lang", "invited_by",
  "org_name", "org_type", "org_need",
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
  if (data.city) data.city = tidyTown(data.city);
  if (data.invited_by && !INVITE_RE.test(data.invited_by)) delete data.invited_by;
  const id = isValidId(data.ref) ? data.ref.toLowerCase() : randomUUID();
  const lead: Lead = { id, kind, createdAt: new Date().toISOString(), data };
  const { modified } = await store().setJSON(`lead/${id}`, lead, { onlyIfNew: true });
  if (!modified) return (await getLead(id)) ?? lead;
  // Count it on the waitlist. A failure here must not lose the lead or its emails.
  try {
    const position = await countLead(lead);
    if (position) {
      lead.position = position;
      await store().setJSON(`lead/${id}`, lead);
    }
  } catch (err) {
    console.error("waitlist: could not count the lead:", err);
  }
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
  await store().delete(`lead/${id}`);
  await store().delete(`meta/${id}`);
}

export interface LeadRow extends Lead {
  meta: LeadMeta;
}

export async function listLeads(): Promise<LeadRow[]> {
  const ids = (await keys("lead/")).map((k) => k.slice("lead/".length));
  const rows = await mapLimit(ids, 25, async (id) => {
    const [lead, meta] = await Promise.all([getLead(id), getMeta(id)]);
    return lead ? { ...lead, meta } : null;
  });
  return rows.filter((r): r is LeadRow => r !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ---------- Waitlist: places in line, invites and sign-ups per town ---------- */

/**
 * One small document with the counts, so the public endpoints never have to
 * read every lead. Updated with a compare-and-swap on each new lead.
 */
export interface WaitlistStats {
  /** By townKey: the town's name and sign-ups per kind. */
  towns: Record<string, { name: string; host: number; renter: number }>;
  /** Invite code → number of people who signed up with it. */
  invites: Record<string, number>;
  /** Invite code → lead id, to show who invited whom. */
  codes: Record<string, string>;
  updatedAt: string;
}

const STATS_KEY = "stats/waitlist";
const INVITE_RE = /^[0-9a-f]{8}$/;

/** A lead's invite code: the first 8 characters of its id. */
export function inviteCode(id: string): string {
  return id.slice(0, 8).toLowerCase();
}

function addToStats(stats: WaitlistStats, lead: Lead): number | null {
  stats.codes[inviteCode(lead.id)] = lead.id;
  const inviter = lead.data.invited_by;
  if (inviter && inviter !== inviteCode(lead.id) && stats.codes[inviter]) {
    stats.invites[inviter] = (stats.invites[inviter] ?? 0) + 1;
  }
  if (lead.kind !== "host" && lead.kind !== "renter") return null;
  const key = townKey(lead.data.city ?? "");
  if (!key) return null;
  const town = (stats.towns[key] ??= { name: lead.data.city, host: 0, renter: 0 });
  town[lead.kind] += 1;
  return town[lead.kind];
}

/** Rebuild the counts from all stored leads (first run, or after cleaning up). */
async function buildStats(): Promise<{ stats: WaitlistStats; positions: Map<string, number> }> {
  const leads = (await listLeads()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const stats: WaitlistStats = { towns: {}, invites: {}, codes: {}, updatedAt: new Date().toISOString() };
  const positions = new Map<string, number>();
  for (const lead of leads) {
    const position = addToStats(stats, lead);
    if (position) positions.set(lead.id, position);
  }
  return { stats, positions };
}

/** Count a newly stored lead. Returns its place in line in its town, if it has one. */
async function countLead(lead: Lead): Promise<number | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await store().getWithMetadata(STATS_KEY, { type: "json" });
    if (!current) {
      // First time: build from everything stored, which already includes this lead.
      const { stats, positions } = await buildStats();
      const { modified } = await store().setJSON(STATS_KEY, stats, { onlyIfNew: true });
      if (modified) return positions.get(lead.id) ?? null;
      continue;
    }
    const stats = current.data as WaitlistStats;
    stats.codes ??= {};
    const position = addToStats(stats, lead);
    stats.updatedAt = new Date().toISOString();
    const { modified } = await store().setJSON(STATS_KEY, stats, { onlyIfMatch: current.etag });
    if (modified) return position;
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 200));
  }
  throw new Error("waitlist stats: too many concurrent updates");
}

export async function getStats(): Promise<WaitlistStats> {
  const stats = await getJSON<WaitlistStats>(STATS_KEY);
  if (stats) return stats;
  const built = (await buildStats()).stats;
  await store().setJSON(STATS_KEY, built, { onlyIfNew: true });
  return built;
}

/** Recount everything, e.g. after leads were deleted on the admin page. */
export async function rebuildStats(): Promise<void> {
  await store().setJSON(STATS_KEY, (await buildStats()).stats);
}

/** The person who owns an invite code, if any. */
export async function inviterOf(code: string | undefined): Promise<Lead | null> {
  if (!code || !INVITE_RE.test(code)) return null;
  const id = (await getStats()).codes[code];
  return id ? getLead(id) : null;
}
