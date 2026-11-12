"use client";

import { ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { appText } from "@/content/app";
import { formatKr } from "@/lib/app/model";
import { protectionAmount, type ProtectionOffer } from "@/lib/app/payments";
import { fill } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const t = appText.protection;

/** The checkbox on the request form: "Add Spazia Skydd (+12 kr/month)". */
export function ProtectionOption({ offer, monthly, checked, onChange }: { offer: ProtectionOffer; monthly: number; checked: boolean; onChange: (on: boolean) => void }) {
  const extra = protectionAmount(monthly, offer.rate);
  return (
    <label htmlFor="protection" className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 ${checked ? "border-brand bg-brand-soft" : "border-line bg-paper"}`}>
      <input id="protection" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-brand)]" />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center justify-between gap-x-3 font-bold text-night">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={18} className="text-brand" aria-hidden="true" />
            {t.add}
          </span>
          {monthly > 0 && <span className="whitespace-nowrap">{fill(t.price, { amount: formatKr(extra) })}</span>}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-ink">
          {fill(t.text, { cap: formatKr(offer.cap), percent: Math.round(offer.rate * 100) })}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted">{t.excludes}</span>
      </span>
    </label>
  );
}

/** On the renter's booking: what is covered, and a form to report damage. */
export function ProtectionPanel({ requestId, cap, canClaim }: { requestId: string; cap: number | null; canClaim: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim().length < 10) {
      setError(t.claimTooShort);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase().rpc("submit_protection_claim", {
      p_request: requestId,
      p_description: text.trim(),
      p_amount: amount ? Math.max(1, Math.round(Number(amount))) : null,
    });
    setBusy(false);
    if (err) setError(appText.common.error);
    else setSent(true);
  }

  return (
    <section className="card p-5" aria-labelledby="protection-title">
      <h2 id="protection-title" className="flex items-center gap-2 text-xl font-bold text-night">
        <ShieldCheck size={20} className="text-brand" aria-hidden="true" />
        {t.title}
      </h2>
      <p className="mt-1 leading-relaxed text-ink">{cap ? fill(t.included, { cap: formatKr(cap) }) : t.line}</p>
      {canClaim &&
        (sent ? (
          <p role="status" className="mt-3 rounded-xl bg-pine-soft p-3 font-medium text-pine">
            {t.claimSent}
          </p>
        ) : !open ? (
          <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary mt-3">
            {t.claimTitle}
          </button>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <p className="text-sm leading-relaxed text-muted">{t.claimText}</p>
            <div>
              <label htmlFor="claim-text" className="field-label">
                {t.claimDescription}
              </label>
              <textarea id="claim-text" rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} className="field-input resize-y" />
            </div>
            <div>
              <label htmlFor="claim-amount" className="field-label">
                {t.claimAmount}
              </label>
              <input id="claim-amount" type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input max-w-[12rem]" />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-[#b42318]">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={busy} className="btn btn-primary">
                {t.claimSend}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
                {appText.common.cancel}
              </button>
            </div>
          </form>
        ))}
    </section>
  );
}
