"use client";

import Link from "next/link";
import { AlertTriangle, CircleCheck, CreditCard, Hourglass, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { formatDay, formatKr, formatMoment, type RequestStatus } from "@/lib/app/model";
import { goToStripe, paymentsCall, type Payment } from "@/lib/app/payments";
import type { RenterRequest } from "@/lib/app/data";

const t = appText.payments;

function PayButton({ payment, label }: { payment: Payment; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pay() {
    setBusy(true);
    setError(null);
    try {
      await goToStripe("pay", { payment: payment.id });
    } catch (err) {
      setError((err as { code?: string }).code === "expired" ? t.expired : appText.common.error);
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" disabled={busy} onClick={pay} className="btn btn-primary mt-3">
        <CreditCard size={18} aria-hidden="true" />
        {busy ? t.redirecting : (label ?? fill(t.pay, { amount: formatKr(payment.amount) }))}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[0.95rem] font-medium text-[#b42318]">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Payment state of a booking for the renter: pay a parking hold, a failed
 * month, or see what has been paid. Also confirms the payment when the renter
 * comes back from Stripe Checkout (?betald=<payment>).
 */
export function PaymentPanel({ r, status, payments, onChange }: { r: RenterRequest; status: RequestStatus; payments: Payment[]; onChange: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const started = useRef(false);

  // Back from Checkout: confirm with Stripe straight away (the webhook may lag), then reload.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("betald");
    if (!paid || started.current) return;
    started.current = true;
    setConfirming(true);
    (async () => {
      for (let i = 0; i < 5; i++) {
        try {
          const res = await paymentsCall<{ paid: boolean }>("pay_done", { payment: paid });
          if (res.paid) break;
        } catch {
          /* try again */
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      params.delete("betald");
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      await onChange();
      setConfirming(false);
    })();
  }, [onChange]);

  if (!r.payment_required) return null;
  if (confirming) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-2xl bg-frost/70 p-4 font-semibold text-night">
        <Hourglass size={18} className="text-brand" aria-hidden="true" />
        {t.confirming}
      </p>
    );
  }

  const latest = payments[payments.length - 1];
  const refunded = payments.filter((p) => p.refund_requested_at);
  const isHour = r.kind === "hour";

  return (
    <div className="space-y-3">
      {isHour && status === "pending" && latest && (
        <div className="rounded-2xl border border-[#f2d49b] bg-[#fff6e5] p-4">
          <p className="font-bold text-night">{t.holdTitle}</p>
          <p className="mt-1 text-ink">{fill(t.holdText, { time: formatMoment(r.expires_at) })}</p>
          <PayButton payment={latest} />
        </div>
      )}

      {isHour && status === "expired" && (
        <div className="rounded-2xl bg-frost p-4">
          <p className="text-ink">{t.holdExpired}</p>
          {r.listing && (
            <Link prefetch={false} href={`/kund/parkera?id=${r.listing.id}`} className="btn btn-secondary mt-3">
              {appText.parkingForm.title}
            </Link>
          )}
        </div>
      )}

      {!isHour && status === "accepted" && latest?.status === "failed" && (
        <div className="rounded-2xl border border-[#f4c7c3] bg-[#fef3f2] p-4">
          <p className="flex items-center gap-2 font-bold text-[#b42318]">
            <AlertTriangle size={18} aria-hidden="true" />
            {t.failedTitle}
          </p>
          <p className="mt-1 text-ink">{fill(latest.period_index === 0 ? t.failedFirst : t.failedLater, { time: formatMoment(latest.pay_by) })}</p>
          <PayButton payment={latest} />
        </div>
      )}

      {!isHour && status === "accepted" && !r.paid_through && latest && latest.status !== "failed" && (
        <p className="flex gap-2 rounded-2xl bg-frost/70 p-4 text-ink">
          <Hourglass size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          {t.firstCharging}
        </p>
      )}

      {!isHour && status === "accepted" && r.paid_through && (
        <p className="flex gap-2 rounded-2xl bg-[#e7f4ec] p-4 font-medium text-pine">
          <CircleCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {fill(t.paidThrough, { date: formatDay(r.paid_through, true) })}
            {r.end_date && r.ended_at ? ` ${fill(t.ending, { date: formatDay(r.end_date, true) })}` : ""}
          </span>
        </p>
      )}

      {refunded.length > 0 && (
        <p className="flex gap-2 rounded-2xl bg-frost/70 p-4 text-ink">
          <RotateCcw size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          {t.refund}
        </p>
      )}

      {payments.some((p) => p.status !== "cancelled") && (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold text-night">{t.history}</summary>
          <ul className="mt-2 divide-y divide-line">
            {payments
              .filter((p) => p.status !== "cancelled")
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-[0.95rem]">
                  <span className="text-ink">{isHour ? formatDay(p.period_start, true) : `${formatDay(p.period_start)} – ${formatDay(p.period_end, true)}`}</span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold text-night">{formatKr(p.amount)} kr</span>
                    <span className="block text-xs text-muted">{t.statuses[p.status]}</span>
                  </span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
