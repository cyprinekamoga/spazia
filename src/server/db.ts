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
import { tidyTown } from "../content/cities";
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
}

export interface LeadMeta {
  status: LeadStatus;
  notes: string;
  updatedAt: string | null;
  mailings: { at: string; subject: string; tag: string }[];
}

/** Fields we keep from a form submission. Anything else (IP, user agent …) is dropped. */
const LEAD_FIELDS = [
  "ref", "first_name", "email", "phone", "city", "lang",
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
