"use client";

import { Flag } from "lucide-react";
import { useState, type FormEvent } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { site } from "@/lib/site";
import { supabase } from "@/lib/supabase";

const t = appText.report;
type Reason = keyof typeof t.reasons;
const REASONS = Object.keys(t.reasons) as Reason[];

/**
 * "Report" link that opens a short form (EU Digital Services Act: notice and
 * action). The team gets an email and handles it in the admin page.
 */
export function ReportButton({ kind, targetId, label }: { kind: "listing" | "user" | "message"; targetId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    setError(null);
    const res = await supabase().rpc("report_content", { p_kind: kind, p_target: targetId, p_reason: reason, p_details: details.trim() });
    setBusy(false);
    if (res.error) {
      setError(/too_many|rate_limited/.test(res.error.message) ? fill(t.tooMany, { email: site.email }) : /login_required/.test(res.error.message) ? t.loginFirst : appText.common.error);
      return;
    }
    setDone(true);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-night">
        <Flag size={15} aria-hidden="true" />
        {label}
      </button>
    );
  }

  if (done) {
    return (
      <p role="status" className="rounded-xl bg-frost/70 p-3 text-[0.95rem] text-ink">
        {t.sent}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="card p-4">
      <h2 className="text-lg font-bold text-night">{t.title}</h2>
      <p className="mt-1 text-sm text-muted">{t.lead}</p>
      <fieldset className="mt-3">
        <legend className="field-label">{t.reason}</legend>
        <div className="space-y-1">
          {REASONS.map((r) => (
            <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-frost/60">
              <input type="radio" name={`reason-${targetId}`} value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-[#2F6B75]" />
              <span className="text-[0.95rem] text-ink">{t.reasons[r]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`details-${targetId}`} className="field-label mt-3">
        {t.details}
      </label>
      <textarea id={`details-${targetId}`} className="field-input resize-y" rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
      <p className="mt-2 text-sm text-muted">{t.emergency}</p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-[#b42318]">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy || !reason} className="btn btn-primary">
          {busy ? t.sending : t.send}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          {appText.common.cancel}
        </button>
      </div>
    </form>
  );
}
