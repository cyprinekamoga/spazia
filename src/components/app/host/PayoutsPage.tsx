"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CircleCheck, ExternalLink, Hourglass, Landmark } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { formatKr } from "@/lib/app/model";
import {
  fetchHostPayments,
  fetchPaymentSetup,
  fetchTaxInfo,
  formatPersonalNumber,
  goToStripe,
  normalizePersonalNumber,
  paymentsCall,
  saveTaxInfo,
  type HostTaxInfo,
} from "@/lib/app/payments";
import { useLoad } from "@/lib/app/session";
import { Spinner, useAppSession } from "../AppShell";

const t = appText.payments;

const day = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "short" }).format(new Date(iso));

const EMPTY: HostTaxInfo = { full_name: "", personal_number: "", street_address: "", postal_code: "", city: "" };

function TaxForm({ uid, initial, onSaved }: { uid: string; initial: HostTaxInfo | null; onSaved: () => void }) {
  const [form, setForm] = useState<HostTaxInfo>(initial ? { ...initial, personal_number: formatPersonalNumber(initial.personal_number) } : EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof HostTaxInfo, string>>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const pnr = normalizePersonalNumber(form.personal_number);
    const postal = form.postal_code.replace(/\s/g, "");
    const found: typeof errors = {
      full_name: form.full_name.trim().length >= 2 ? undefined : t.required,
      personal_number: pnr ? undefined : t.personalNumberInvalid,
      street_address: form.street_address.trim().length >= 2 ? undefined : t.required,
      postal_code: /^\d{5}$/.test(postal) ? undefined : t.postalCodeInvalid,
      city: form.city.trim() ? undefined : t.required,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setBusy(true);
    setFailed(false);
    try {
      await saveTaxInfo(uid, {
        full_name: form.full_name.trim(),
        personal_number: pnr!,
        street_address: form.street_address.trim(),
        postal_code: `${postal.slice(0, 3)} ${postal.slice(3)}`,
        city: form.city.trim(),
      });
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof HostTaxInfo, label: string, props: Record<string, string> = {}) => (
    <div>
      <label htmlFor={`tax-${key}`} className="field-label">
        {label}
      </label>
      <input
        id={`tax-${key}`}
        className="field-input"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `tax-${key}-error` : undefined}
        {...props}
      />
      {errors[key] && (
        <p id={`tax-${key}-error`} className="mt-1.5 text-sm font-medium text-[#b42318]">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("full_name", t.fullName, { autoComplete: "name" })}
        {field("personal_number", t.personalNumber, { inputMode: "numeric", placeholder: t.personalNumberHint, autoComplete: "off" })}
        {field("street_address", t.street, { autoComplete: "street-address" })}
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          {field("postal_code", t.postalCode, { inputMode: "numeric", autoComplete: "postal-code" })}
          {field("city", t.city, { autoComplete: "address-level2" })}
        </div>
      </div>
      {failed && (
        <p role="alert" className="rounded-xl bg-[#fef3f2] p-3 text-[0.95rem] font-medium text-[#b42318]">
          {appText.common.error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn btn-primary">
        {t.saveTax}
      </button>
    </form>
  );
}

export function PayoutsPage() {
  const uid = useAppSession().user.id;
  const params = useSearchParams();
  const router = useRouter();
  const fromStripe = params.get("stripe");
  const [syncing, setSyncing] = useState(Boolean(fromStripe));
  const { data, loading, reload } = useLoad(
    async () => {
      const [setup, tax, payments] = await Promise.all([fetchPaymentSetup(), fetchTaxInfo(uid), fetchHostPayments(uid)]);
      return { setup, tax, payments };
    },
    uid,
  );
  const [editingTax, setEditingTax] = useState(false);
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Back from Stripe: fetch the account's status right away (the webhook can lag).
  useEffect(() => {
    if (!fromStripe) return;
    paymentsCall("sync")
      .catch(() => {})
      .finally(async () => {
        await reload();
        setSyncing(false);
        router.replace("/vard/utbetalningar");
      });
  }, [fromStripe, reload, router]);

  async function stripeAction(action: "connect" | "dashboard") {
    setBusy(true);
    setError(false);
    try {
      await goToStripe(action);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  if (loading || !data) return <Spinner />;
  const { setup, tax, payments } = data;
  const payouts = setup.payouts;
  const upcoming = payments.filter((p) => !p.transferred_at && !p.refund_requested_at);
  const done = payments.filter((p) => p.transferred_at);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link prefetch={false} href="/vard/meny" className="flex min-h-11 w-fit items-center gap-1.5 font-semibold text-night">
        <ArrowLeft size={18} aria-hidden="true" />
        {appText.menu.title}
      </Link>
      <h1 className="text-[2rem] leading-tight text-night">{t.payoutsTitle}</h1>
      <p className="leading-relaxed text-muted">{setup.enabled ? t.payoutsLead : t.off}</p>

      <section className="card p-5">
        <h2 className="text-xl font-bold text-night">{t.taxTitle}</h2>
        <p className="mt-1 leading-relaxed text-muted">{t.taxText}</p>
        {tax && !editingTax ? (
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <p className="leading-relaxed text-ink">
              <span className="font-semibold">{tax.full_name}</span>, {formatPersonalNumber(tax.personal_number).replace(/\d{4}$/, "••••")}
              <br />
              {tax.street_address}, {tax.postal_code} {tax.city}
            </p>
            <button type="button" onClick={() => setEditingTax(true)} className="btn btn-secondary !min-h-10 !py-1.5">
              {t.changeTax}
            </button>
          </div>
        ) : (
          <TaxForm
            uid={uid}
            initial={tax}
            onSaved={async () => {
              setEditingTax(false);
              await reload();
            }}
          />
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-bold text-night">{t.bankTitle}</h2>
        {syncing ? (
          <p className="mt-2 text-muted">{t.syncing}</p>
        ) : payouts?.payouts_enabled ? (
          <>
            <p className="mt-2 flex items-start gap-2 font-semibold text-pine">
              <CircleCheck size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              {t.bankReady}
            </p>
            <button type="button" disabled={busy} onClick={() => stripeAction("dashboard")} className="btn btn-secondary mt-4">
              <ExternalLink size={18} aria-hidden="true" />
              {t.bankDashboard}
            </button>
          </>
        ) : payouts?.details_submitted ? (
          <>
            <p className="mt-2 flex items-start gap-2 text-ink">
              <Hourglass size={19} className="mt-0.5 shrink-0 text-[#8a5a00]" aria-hidden="true" />
              {payouts.requirements_due.length ? t.bankMissing : t.bankPending}
            </p>
            {payouts.requirements_due.length > 0 && (
              <button type="button" disabled={busy} onClick={() => stripeAction("connect")} className="btn btn-primary mt-4">
                {t.bankContinue}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="mt-1 leading-relaxed text-muted">{t.bankText}</p>
            {!setup.enabled ? null : tax ? (
              <button type="button" disabled={busy} onClick={() => stripeAction("connect")} className="btn btn-primary mt-4">
                <Landmark size={18} aria-hidden="true" />
                {payouts ? t.bankContinue : t.bankStart}
              </button>
            ) : (
              <p className="mt-3 text-sm font-semibold text-[#8a5a00]">{t.needTaxFirst}</p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-[#fef3f2] p-3 text-[0.95rem] font-medium text-[#b42318]">
            {appText.common.error}
          </p>
        )}
      </section>

      {setup.enabled && (
        <section className="card p-5">
          <h2 className="text-xl font-bold text-night">{t.upcoming}</h2>
          {upcoming.length === 0 && done.length === 0 && <p className="mt-2 text-muted">{t.none}</p>}
          <ul className="mt-3 divide-y divide-line">
            {upcoming.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-night">{p.listing_title}</span>
                  <span className="text-sm text-muted">{fill(t.transferOn, { date: day(Date.parse(p.transfer_due_at) > now ? p.transfer_due_at : new Date(now).toISOString()) })}</span>
                </span>
                <span className="shrink-0 font-bold text-night">{formatKr(p.host_amount)} kr</span>
              </li>
            ))}
          </ul>
          {done.length > 0 && (
            <>
              <h3 className="mt-4 font-bold text-night">{t.paidOut}</h3>
              <ul className="mt-2 divide-y divide-line">
                {done.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{p.listing_title}</span>
                      <span className="text-sm text-muted">{fill(t.transferredOn, { date: day(p.transferred_at!) })}</span>
                    </span>
                    <span className="shrink-0 text-ink">{formatKr(p.host_amount)} kr</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
