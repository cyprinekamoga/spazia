"use client";

import { ChevronDown, Download, Mail, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import { formatSlot } from "@/lib/time";
import {
  api,
  areaName,
  describeLead,
  download,
  formatDate,
  leadsCsv,
  STATUS_LABELS,
  statusesFor,
  summaryOf,
  townOf,
  type AdminData,
  type AdminLead,
  type LeadStatus,
} from "./api";

export function LeadsTab({ data, focusLead, onChange }: { data: AdminData; focusLead: string | null; onChange: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "host" | "renter">("all");
  const [town, setTown] = useState("all");
  const [status, setStatus] = useState<"all" | LeadStatus>("all");
  const [only, setOnly] = useState<string | null>(focusLead);

  const towns = useMemo(() => [...new Set(data.leads.map(townOf))].sort((a, b) => a.localeCompare(b, "sv")), [data.leads]);

  const filtered = data.leads.filter((l) => {
    if (only) return l.id === only;
    if (kind !== "all" && l.kind !== kind) return false;
    if (town !== "all" && townOf(l) !== town) return false;
    if (status !== "all" && l.meta.status !== status) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = [l.data.first_name, l.data.email, l.data.phone, l.data.city, l.meta.notes].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      {only ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-muted">Visar en anmälan från en länk.</p>
          <button type="button" className="btn btn-secondary !py-2" onClick={() => setOnly(null)}>
            Visa alla
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
          <div className="col-span-2 lg:col-span-1">
            <label htmlFor="lead-search" className="field-label">
              Sök
            </label>
            <input id="lead-search" className="field-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Namn, e-post, telefon …" />
          </div>
          <Select id="lead-kind" label="Typ" value={kind} onChange={(v) => setKind(v as typeof kind)} options={[["all", "Alla"], ["host", "Värdar"], ["renter", "Hyresgäster"]]} />
          <Select id="lead-town" label="Ort" value={town} onChange={setTown} options={[["all", "Alla orter"], ...towns.map((t) => [t, t] as [string, string])]} />
          <Select
            id="lead-status"
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[["all", "Alla"], ...(Object.entries(STATUS_LABELS) as [string, string][])]}
          />
          <button type="button" className="btn btn-secondary self-end" onClick={() => download(`spazia-anmalningar-${new Date().toISOString().slice(0, 10)}.csv`, leadsCsv(filtered))}>
            <Download size={17} aria-hidden="true" />
            CSV
          </button>
        </div>
      )}

      <p className="mt-5 text-sm font-semibold text-muted">
        {filtered.length} av {data.leads.length}
      </p>
      <ul className="mt-2 space-y-2.5">
        {filtered.map((l) => (
          <li key={l.id}>
            <LeadCard lead={l} startOpen={l.id === only} onChange={onChange} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Select({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function LeadCard({ lead, startOpen, onChange }: { lead: AdminLead; startOpen: boolean; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(startOpen);
  const [status, setStatus] = useState(lead.meta.status);
  const [notes, setNotes] = useState(lead.meta.notes);
  const [saving, setSaving] = useState<string | null>(null);
  const d = lead.data;
  const town = townOf(lead);

  async function save(change: { status?: LeadStatus; notes?: string }) {
    setSaving("Sparar …");
    try {
      await api(`/leads/${lead.id}`, { method: "PATCH", body: change });
      setSaving("Sparat");
      setTimeout(() => setSaving(null), 1500);
    } catch {
      setSaving("Kunde inte spara");
    }
  }

  async function cancelVisit() {
    if (!window.confirm(`Avboka besöket för ${d.first_name}? Värden får ett mejl om att välja en ny tid.`)) return;
    await api(`/bookings/${lead.id}?notify=1`, { method: "DELETE" });
    await onChange();
  }

  async function remove() {
    if (!window.confirm(`Radera ${d.first_name ?? "anmälan"} permanent? Det går inte att ångra. Anmälan finns kvar i Netlify Forms och behöver raderas där också.`)) return;
    await api(`/leads/${lead.id}`, { method: "DELETE" });
    await onChange();
  }

  return (
    <div className="card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <ChevronDown size={20} className={`mt-1 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-lg font-bold text-night">{d.first_name || "–"}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${lead.kind === "host" ? "bg-brand-soft text-brand" : "bg-frost text-night"}`}>
                {lead.kind === "host" ? "Värd" : "Hyresgäst"}
              </span>
              {lead.booking && <span className="rounded-full bg-[#e7f4ec] px-2.5 py-0.5 text-xs font-semibold text-pine">Besök bokat</span>}
            </span>
            <span className="mt-0.5 block text-[0.95rem] text-ink">
              {town}
              {d.area ? `, ${areaName(d.area)}` : ""}
            </span>
            <span className="block truncate text-sm text-muted">{summaryOf(lead)}</span>
            <span className="block text-sm text-muted">{formatDate(lead.createdAt)}</span>
          </span>
        </button>
        <div className="flex items-center gap-2 sm:shrink-0">
          <label htmlFor={`status-${lead.id}`} className="sr-only">
            Status
          </label>
          <select
            id={`status-${lead.id}`}
            className="field-input !w-auto !py-2"
            value={status}
            onChange={(e) => {
              const next = e.target.value as LeadStatus;
              setStatus(next);
              void save({ status: next });
            }}
          >
            {statusesFor(lead.kind).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {d.phone && (
            <a href={`tel:${d.phone.replace(/[^\d+]/g, "")}`} className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-night hover:border-night" aria-label={`Ring ${d.first_name}`}>
              <Phone size={18} aria-hidden="true" />
            </a>
          )}
          {d.email && (
            <a href={`mailto:${d.email}`} className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-night hover:border-night" aria-label={`Mejla ${d.first_name}`}>
              <Mail size={18} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
      {saving && <p className="-mt-2 px-4 pb-2 text-sm text-muted" role="status">{saving}</p>}

      {open && (
        <div className="grid gap-6 border-t border-line p-4 lg:grid-cols-2">
          <div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.95rem]">
              <dt className="text-muted">E-post</dt>
              <dd className="break-all text-ink">{d.email}</dd>
              {d.phone && (
                <>
                  <dt className="text-muted">Telefon</dt>
                  <dd className="text-ink">{d.phone}</dd>
                </>
              )}
              {describeLead(lead).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-words text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {lead.meta.mailings.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-muted">Mejl från admin</p>
                <ul className="mt-1 text-sm text-ink">
                  {lead.meta.mailings.map((m) => (
                    <li key={m.at}>
                      {formatDate(m.at)}: {m.subject}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {lead.booking && (
              <div className="rounded-xl bg-[#e7f4ec] p-4">
                <p className="font-bold text-night first-letter:uppercase">{formatSlot(lead.booking.start, "sv")}</p>
                <p className="text-[0.95rem] text-ink">{lead.booking.address}</p>
                <p className="text-[0.95rem] text-ink">{lead.booking.phone}</p>
                {lead.booking.note && <p className="mt-1 text-[0.95rem] text-muted">{lead.booking.note}</p>}
                <button type="button" className="mt-3 text-sm font-semibold text-[#b42318] underline underline-offset-4" onClick={cancelVisit}>
                  Avboka besöket
                </button>
              </div>
            )}
            <div>
              <label htmlFor={`notes-${lead.id}`} className="field-label">
                Anteckningar
              </label>
              <textarea
                id={`notes-${lead.id}`}
                className="field-input resize-y"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => notes !== lead.meta.notes && save({ notes })}
                placeholder="T.ex. ringde 4/11, vill ha besök på helgen"
              />
              <p className="mt-1 text-sm text-muted">Sparas när du lämnar fältet.</p>
            </div>
            <button type="button" className="text-sm font-semibold text-[#b42318] underline underline-offset-4" onClick={remove}>
              Radera anmälan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
