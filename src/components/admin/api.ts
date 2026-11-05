import { categories } from "@/content/categories";
import { tidyTown } from "@/content/cities";
import { sv } from "@/content/sv";

/* ---------- Types (mirror src/server/db.ts) ---------- */

export type LeadStatus = "new" | "contacted" | "listed" | "matched" | "declined";

export interface AdminLead {
  id: string;
  kind: "host" | "renter";
  createdAt: string;
  data: Record<string, string>;
  meta: { status: LeadStatus; notes: string; updatedAt: string | null; mailings: { at: string; subject: string; tag: string }[] };
}

export interface AdminData {
  leads: AdminLead[];
  mailConfigured: boolean;
  /** Server time when the data was loaded (keeps rendering pure). */
  now: number;
}

/* ---------- API ---------- */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function api<T = Record<string, unknown>>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? "GET";
  const res = await fetch(`/api/admin${path}`, {
    method,
    cache: "no-store",
    headers: method === "GET" ? undefined : { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
  });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw new ApiError(res.status, String(json.error ?? res.status));
  return json as T;
}

/* ---------- Labels ---------- */

const host = sv.forms.host;
const renter = sv.forms.renter;

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Ny",
  contacted: "Kontaktad",
  listed: "Publicerad",
  matched: "Matchad",
  declined: "Inte aktuell",
};

export function statusesFor(kind: AdminLead["kind"]): LeadStatus[] {
  return kind === "host" ? ["new", "contacted", "listed", "declined"] : ["new", "contacted", "matched", "declined"];
}

function pick(record: Record<string, string>, value: string | undefined): string {
  return value ? (record[value] ?? value) : "";
}

function categoryNames(value: string | undefined): string {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((id) => categories.find((c) => c.id === id)?.name.sv ?? id)
    .join(", ");
}

/** Town of a lead, in its usual spelling. */
export function townOf(lead: AdminLead): string {
  return lead.data.city ? tidyTown(lead.data.city) : "(ingen ort)";
}

/** All answers as label/value rows, in Swedish. */
export function describeLead(lead: AdminLead): [string, string][] {
  const d = lead.data;
  const rows: [string, string][] =
    lead.kind === "host"
      ? [
          ["Typ av utrymme", pick(host.spaceTypes, d.space_type)],
          ["Uppvärmt", pick(host.heatedOptions, d.heated)],
          ["Motorvärmaruttag", pick(host.engineHeaterOptions, d.engine_heater)],
          ["Storlek", pick(host.sizes, d.size)],
          ["Tar emot", categoryNames(d.accepts)],
        ]
      : [
          ["Vill förvara", categoryNames(d.items)],
          ["Mängd", d.quantity ?? ""],
          ["När", pick(renter.starts, d.start)],
          ["Hur länge", pick(renter.durations, d.duration)],
          ["Uppvärmt", pick(renter.heatedOptions, d.heated)],
          ["Motorvärmaruttag", pick(renter.engineHeaterOptions, d.engine_heater)],
          ["Sysselsättning", pick(renter.occupations, d.occupation)],
          ["Har BankID", pick(renter.bankidOptions, d.has_bankid)],
        ];
  return [
    ...rows,
    ["Meddelande", d.message ?? ""],
    ["Språk", d.lang === "en" ? "Engelska" : "Svenska"],
    ["Källa", [d.utm_source, d.utm_medium, d.utm_campaign].filter(Boolean).join(" / ") || "Direkt"],
    ["Första sida", d.landing_page ?? ""],
    ["Kom från", d.referrer ?? ""],
  ].filter(([, v]) => v !== "") as [string, string][];
}

/** Short one-line summary for the list. */
export function summaryOf(lead: AdminLead): string {
  const d = lead.data;
  return lead.kind === "host"
    ? [pick(host.spaceTypes, d.space_type), categoryNames(d.accepts)].filter(Boolean).join(": ")
    : [categoryNames(d.items), pick(renter.starts, d.start)].filter(Boolean).join(", ");
}

/* ---------- Dates ---------- */

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/* ---------- CSV ---------- */

function csvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Semicolon-separated with BOM, so Swedish Excel opens it correctly. */
export function leadsCsv(leads: AdminLead[]): string {
  const head = [
    "Datum", "Typ", "Namn", "E-post", "Telefon", "Ort", "Status", "Anteckningar",
    "Typ av utrymme", "Tar emot", "Storlek", "Vill förvara", "Mängd", "När", "Hur länge", "Uppvärmt", "Motorvärmaruttag",
    "Sysselsättning", "BankID", "Meddelande", "Språk", "utm_source", "utm_medium", "utm_campaign", "Första sida",
  ];
  const rows = leads.map((l) => {
    const d = l.data;
    return [
      formatDate(l.createdAt), l.kind === "host" ? "Värd" : "Hyresgäst", d.first_name ?? "", d.email ?? "", d.phone ?? "",
      townOf(l), STATUS_LABELS[l.meta.status], l.meta.notes,
      pick(host.spaceTypes, d.space_type), categoryNames(d.accepts), pick(host.sizes, d.size), categoryNames(d.items), d.quantity ?? "",
      pick(renter.starts, d.start), pick(renter.durations, d.duration), d.heated ?? "", d.engine_heater ?? "",
      pick(renter.occupations, d.occupation), d.has_bankid ?? "", d.message ?? "", d.lang ?? "",
      d.utm_source ?? "", d.utm_medium ?? "", d.utm_campaign ?? "", d.landing_page ?? "",
    ];
  });
  return "﻿" + [head, ...rows].map((r) => r.map((c) => csvCell(String(c))).join(";")).join("\r\n");
}

export function download(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
