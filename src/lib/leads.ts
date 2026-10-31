import { site } from "./site";

export type LeadKind = "host" | "renter";

type LeadValue = string | string[] | boolean | null;
export type LeadPayload = Record<string, LeadValue>;

const TABLES: Record<LeadKind, string> = {
  host: "host_leads",
  renter: "renter_leads",
};

/** Netlify Forms names – must match the hidden forms in public/__forms.html. */
export const NETLIFY_FORM_NAMES: Record<LeadKind, string> = {
  host: "host-lead",
  renter: "renter-lead",
};

export const usesSupabase = Boolean(site.supabaseUrl && site.supabaseKey);

/**
 * Store a lead. Uses Supabase when it is configured (env vars), otherwise
 * Netlify Forms, so the site works on Netlify without any backend set up.
 */
export async function submitLead(kind: LeadKind, payload: LeadPayload): Promise<void> {
  if (usesSupabase) {
    await submitToSupabase(kind, payload);
  } else {
    await submitToNetlify(kind, payload);
  }
}

async function submitToSupabase(kind: LeadKind, payload: LeadPayload): Promise<void> {
  const res = await fetch(`${site.supabaseUrl}/rest/v1/${TABLES[kind]}`, {
    method: "POST",
    headers: {
      apikey: site.supabaseKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Supabase insert failed: ${res.status}`);
  }
}

async function submitToNetlify(kind: LeadKind, payload: LeadPayload): Promise<void> {
  const body = new URLSearchParams();
  body.set("form-name", NETLIFY_FORM_NAMES[kind]);
  for (const [key, value] of Object.entries(payload)) {
    if (value === null) continue;
    body.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  const res = await fetch("/__forms.html", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Netlify form submission failed: ${res.status}`);
  }
}
