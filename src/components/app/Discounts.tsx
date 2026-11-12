"use client";

import { Building2, Check, Copy, Gift, Share2, Tag, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { appText } from "@/content/app";
import { appLocale } from "@/lib/app/lang";
import { paymentsCall } from "@/lib/app/payments";
import { must, useLoad } from "@/lib/app/session";
import { fill } from "@/lib/i18n";
import { site } from "@/lib/site";
import { supabase } from "@/lib/supabase";

const REF_KEY = "spazia-ref";

/** An invite link (?ref=CODE) is remembered in this browser until it is used. */
export function rememberReferral(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Za-z0-9]{6,12}$/.test(ref)) window.localStorage.setItem(REF_KEY, ref.toUpperCase());
  } catch {
    // Storage blocked: the code can still be typed in.
  }
}

function storedReferral(): string {
  try {
    return window.localStorage.getItem(REF_KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetReferral(code: string): void {
  try {
    if (window.localStorage.getItem(REF_KEY) === code) window.localStorage.removeItem(REF_KEY);
  } catch {
    // Nothing to forget.
  }
}

export interface AppliedDiscount {
  code: string;
  percent: number;
}

type CheckResult = { percent?: number; code?: string; error?: string };

/**
 * "Have a discount code?" on the request form. Checks the code (without
 * using it); the form applies it to the request once it is sent. An invite
 * code from a link is filled in and checked by itself.
 */
export function DiscountField({ value, onChange }: { value: AppliedDiscount | null; onChange: (d: AppliedDiscount | null) => void }) {
  const t = appText.discount;
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(raw: string, quiet = false) {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase().rpc("check_discount_code", { p_code: c });
    setBusy(false);
    const res = (data ?? {}) as CheckResult;
    if (err || res.error || !res.percent || !res.code) {
      if (!quiet) setError(t.errors[(res.error as keyof typeof t.errors) ?? "invalid_code"] ?? t.errors.invalid_code);
      return;
    }
    onChange({ code: res.code, percent: res.percent });
  }

  // An invite link: fill in the code and check it once.
  useEffect(() => {
    const ref = storedReferral();
    if (!ref || value) return;
    let active = true;
    supabase()
      .rpc("check_discount_code", { p_code: ref })
      .then(({ data }) => {
        const res = (data ?? {}) as CheckResult;
        if (active && res.percent && res.code) onChange({ code: res.code, percent: res.percent });
      });
    return () => {
      active = false;
    };
    // Once, on the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (value) {
    return (
      <p className="flex items-center justify-between gap-3 rounded-xl bg-pine-soft p-3 text-[0.95rem] font-medium text-pine">
        <span className="flex items-center gap-2">
          <Tag size={18} aria-hidden="true" />
          <span>
            <span className="font-bold">{value.code}</span>: {fill(t.applied, { percent: value.percent })}
          </span>
        </span>
        <button type="button" onClick={() => onChange(null)} aria-label={t.remove} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/60">
          <X size={18} aria-hidden="true" />
        </button>
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand underline-offset-4 hover:underline">
        <Tag size={16} aria-hidden="true" />
        {t.toggle}
      </button>
    );
  }
  return (
    <div>
      <label htmlFor="discount-code" className="field-label">
        {t.label}
      </label>
      <div className="flex gap-2">
        <input
          id="discount-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void check(code);
            }
          }}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="field-input uppercase"
        />
        <button type="button" disabled={busy || !code.trim()} onClick={() => check(code)} className="btn btn-secondary shrink-0">
          {t.apply}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-[#b42318]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Menu → Invite friends: the personal link, and reward codes earned. */
export function InviteSection({ uid }: { uid: string }) {
  const t = appText.invite;
  const data = useLoad(async () => {
    const db = supabase();
    const [code, codes, config] = await Promise.all([db.rpc("my_referral_code"), db.rpc("my_discount_codes"), db.rpc("payments_config")]);
    return {
      code: must(code) as string,
      codes: (codes.data ?? []) as { code: string; percent: number; valid_until: string | null }[],
      enabled: Boolean((config.data as { enabled?: boolean } | null)?.enabled),
      percent: Number((config.data as { referral_percent?: number } | null)?.referral_percent ?? 50),
    };
  }, `invite-${uid}`);
  const [copied, setCopied] = useState(false);
  // Discounts only mean something when payments are on.
  if (data.loading || !data.data?.enabled) return null;
  const link = `${site.appUrl}/?ref=${data.data.code}`;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(appLocale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "–");

  return (
    <section className="card p-5" aria-labelledby="invite-title">
      <h2 id="invite-title" className="flex items-center gap-2 text-xl font-bold text-night">
        <Gift size={20} className="text-brand" aria-hidden="true" />
        {t.title}
      </h2>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{fill(t.text, { percent: data.data.percent })}</p>
      <p className="mt-3 rounded-xl bg-frost px-3 py-2.5 font-mono text-sm break-all text-night">{link}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              // Clipboard blocked: the link is on screen to copy by hand.
            }
          }}
          className="btn btn-secondary"
        >
          {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          {copied ? t.copied : t.copy}
        </button>
        {canShare && (
          <button type="button" onClick={() => navigator.share({ text: t.shareText, url: link }).catch(() => {})} className="btn btn-secondary">
            <Share2 size={18} aria-hidden="true" />
            {t.share}
          </button>
        )}
      </div>
      {data.data.codes.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="font-bold text-night">{t.codes}</h3>
          <ul className="mt-1 space-y-1">
            {data.data.codes.map((c) => (
              <li key={c.code} className="text-[0.95rem] text-ink">
                <span className="font-mono font-bold">{c.code}</span> · {fill(t.codeLine, { percent: c.percent, date: date(c.valid_until) })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Menu → Invoices to a company (renters). */
export function CompanySection({ uid }: { uid: string }) {
  const t = appText.company;
  const loaded = useLoad(async () => {
    const row = must(
      await supabase().from("profile_private").select("company_name, company_org_number, company_vat_number").eq("id", uid).maybeSingle(),
    ) as { company_name: string; company_org_number: string; company_vat_number: string } | null;
    return row ?? { company_name: "", company_org_number: "", company_vat_number: "" };
  }, `company-${uid}`);
  const [form, setForm] = useState<{ company_name: string; company_org_number: string; company_vat_number: string } | null>(null);
  const [errors, setErrors] = useState<{ org?: string; vat?: string }>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  if (loaded.loading || !loaded.data) return null;
  const f = form ?? loaded.data;
  const hasCompany = Boolean(loaded.data.company_name);

  async function save(next: typeof f, message: string) {
    setBusy(true);
    setFailed(false);
    setNote(null);
    const res = await supabase().from("profile_private").update(next).eq("id", uid);
    if (res.error) {
      setFailed(true);
    } else {
      // Update the payment provider's customer too (ignored when payments are off).
      await paymentsCall("billing").catch(() => {});
      setNote(message);
      setForm(null);
      await loaded.reload();
    }
    setBusy(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const org = f.company_org_number.replace(/\s/g, "");
    const vat = f.company_vat_number.replace(/\s/g, "").toUpperCase();
    const found = {
      org: /^\d{6}-?\d{4}$/.test(org) ? undefined : t.invalidOrg,
      vat: !vat || /^SE\d{12}$/.test(vat) ? undefined : t.invalidVat,
    };
    setErrors(found);
    if (!f.company_name.trim() || found.org || found.vat) return;
    void save({ company_name: f.company_name.trim(), company_org_number: org.length === 10 ? `${org.slice(0, 6)}-${org.slice(6)}` : org, company_vat_number: vat }, t.saved);
  }

  return (
    <section className="card p-5" aria-labelledby="company-title">
      <h2 id="company-title" className="flex items-center gap-2 text-xl font-bold text-night">
        <Building2 size={20} className="text-brand" aria-hidden="true" />
        {t.title}
      </h2>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{t.text}</p>
      <form onSubmit={submit} noValidate className="mt-3 space-y-3">
        <div>
          <label htmlFor="company-name" className="field-label">
            {t.name}
          </label>
          <input id="company-name" className="field-input" autoComplete="organization" value={f.company_name} onChange={(e) => setForm({ ...f, company_name: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="company-org" className="field-label">
              {t.org}
            </label>
            <input id="company-org" className="field-input" inputMode="numeric" value={f.company_org_number} onChange={(e) => setForm({ ...f, company_org_number: e.target.value })} aria-invalid={errors.org ? true : undefined} />
            {errors.org && <p className="mt-1 text-sm font-medium text-[#b42318]">{errors.org}</p>}
          </div>
          <div>
            <label htmlFor="company-vat" className="field-label">
              {t.vat}
            </label>
            <input id="company-vat" className="field-input uppercase" placeholder={t.vatHint} value={f.company_vat_number} onChange={(e) => setForm({ ...f, company_vat_number: e.target.value })} aria-invalid={errors.vat ? true : undefined} />
            {errors.vat && <p className="mt-1 text-sm font-medium text-[#b42318]">{errors.vat}</p>}
          </div>
        </div>
        {failed && (
          <p role="alert" className="text-sm font-medium text-[#b42318]">
            {appText.common.error}
          </p>
        )}
        {note && (
          <p role="status" className="text-sm font-medium text-pine">
            {note}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy || !f.company_name.trim()} className="btn btn-primary">
            {t.save}
          </button>
          {hasCompany && (
            <button type="button" disabled={busy} onClick={() => save({ company_name: "", company_org_number: "", company_vat_number: "" }, t.removed)} className="btn btn-secondary">
              {t.remove}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
