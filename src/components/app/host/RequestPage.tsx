"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, FileText, Hourglass, MessageSquare, X } from "lucide-react";
import { useState } from "react";
import { appText } from "@/content/app";
import { getCategory } from "@/content/categories";
import { fill } from "@/lib/i18n";
import { fetchCounterpartPrivate, fetchRequest } from "@/lib/app/data";
import { effectiveStatus, formatDay, formatKr, formatMoment, hostCanCancel, hostPayout, periodText, requestIncome, timeLeft, todayIso } from "@/lib/app/model";
import { fetchPaymentSetup, fetchRequestPayments, type Payment, type PaymentSetup } from "@/lib/app/payments";
import { useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner, useAppSession } from "../AppShell";
import { HandoverSection } from "../Handovers";
import { RenterRating, ReviewSection } from "../Reviews";
import { Avatar } from "./RequestCard";

const t = appText.request;

function memberSince(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(new Date(iso));
}

export function RequestPage() {
  const uid = useAppSession().user.id;
  const id = useSearchParams().get("id") ?? "";
  const { data: r, loading, reload } = useLoad(async () => {
    const req = await fetchRequest(id);
    // The renter's phone is readable once the request is accepted (and paid, with payments).
    const phone = req?.status === "accepted" ? ((await fetchCounterpartPrivate(req.renter_id))?.phone ?? "") : "";
    const [payments, setup] = await Promise.all([
      req?.payment_required ? fetchRequestPayments(req.id) : Promise.resolve([] as Payment[]),
      req?.payment_required ? fetchPaymentSetup().catch(() => null) : Promise.resolve(null as PaymentSetup | null),
    ]);
    return req ? { ...req, renterPhone: phone, payments, setup } : null;
  }, id);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string; payouts?: boolean } | null>(null);
  const [now] = useState(() => Date.now());

  if (loading) return <Spinner />;
  if (!r) return <p className="text-muted">{appText.common.error}</p>;

  const status = effectiveStatus(r, now);
  const name = r.renter?.first_name || "–";

  async function respond(accept: boolean) {
    setBusy(true);
    setMessage(null);
    const res = await supabase().rpc("respond_to_request", { p_request: id, p_accept: accept, p_reason: accept ? "" : reason });
    setBusy(false);
    setDeclining(false);
    if (res.error) {
      const payouts = /payouts_required/.test(res.error.message);
      setMessage({
        tone: "error",
        text: payouts ? appText.payments.payoutsRequired : /no_capacity/.test(res.error.message) ? t.noCapacity : appText.common.error,
        payouts,
      });
    } else if (res.data === "expired") {
      setMessage({ tone: "error", text: t.expired });
    } else if (res.data === "accepted") {
      setMessage({ tone: "ok", text: fill(t.accepted, { name }) });
    }
    await reload();
  }

  async function cancel() {
    setBusy(true);
    setMessage(null);
    const res = await supabase().rpc("cancel_request", { p_request: id, p_reason: cancelReason });
    setBusy(false);
    setCancelling(false);
    if (res.error) setMessage({ tone: "error", text: /already_started/.test(res.error.message) ? t.tooLateHost : appText.common.error });
    await reload();
  }

  async function endRental() {
    const last = r!.paid_through ?? todayIso();
    if (!window.confirm(r!.payment_required ? fill(appText.payments.endConfirm, { date: formatDay(last, true) }) : appText.payments.endConfirmToday)) return;
    setBusy(true);
    setMessage(null);
    const res = await supabase().rpc("end_rental", { p_request: id });
    setBusy(false);
    if (res.error) setMessage({ tone: "error", text: appText.common.error });
    await reload();
  }

  const isHour = r.kind === "hour";
  // A paid monthly rental that has started is ended at the end of the paid period, not cancelled.
  const endInstead = !isHour && Boolean(r.payment_required) && status === "accepted" && todayIso() >= r.start_date;
  const ending = Boolean(r.ended_at && r.end_date);
  const payoutsMissing = Boolean(r.payment_required && r.setup?.enabled && !r.setup.payouts?.details_submitted);
  const paidPayments = r.payments.filter((p) => p.status === "paid" && !p.refund_requested_at);
  const nextShare = paidPayments.find((p) => !p.transferred_at) ?? paidPayments[paidPayments.length - 1];
  const canCancel = hostCanCancel({ ...r, status }, now) && !endInstead;
  // A pending request that was withdrawn got responded_at and cancelled_at in the same moment.
  const withdrawn = r.cancelled_by === r.renter_id && r.responded_at != null && r.cancelled_at != null && Date.parse(r.responded_at) === Date.parse(r.cancelled_at);
  const cancelledText =
    r.cancelled_by === r.host_id
      ? t.cancelledByYou
      : withdrawn
        ? fill(t.cancelledWithdrawn, { name })
        : r.cancelled_by === r.renter_id
          ? fill(t.cancelledByRenter, { name })
          : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link prefetch={false} href="/vard" className="flex min-h-11 w-fit items-center gap-1.5 font-semibold text-night">
        <ArrowLeft size={18} aria-hidden="true" />
        {appText.nav.today}
      </Link>

      <div className="mt-3 flex items-center gap-4">
        <Avatar name={name} url={r.renter?.avatar_url} size={64} />
        <div>
          <h1 className="text-[1.9rem] leading-tight text-night">{fill(t.from, { name })}</h1>
          {r.renter && <p className="text-muted">{fill(t.memberSince, { date: memberSince(r.renter.created_at) })}</p>}
          <RenterRating renterId={r.renter_id} />
        </div>
      </div>
      {r.renter?.about && <p className="mt-4 leading-relaxed text-ink/90">{r.renter.about}</p>}

      <div className="mt-6 card divide-y divide-line">
        <div className="p-4">
          <p className="text-sm font-semibold text-muted">{t.listing}</p>
          <p className="font-semibold text-night">{r.listing?.title}</p>
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold text-muted">{r.kind === "hour" ? t.bookedWhat : t.wants}</p>
          <ul className="mt-1 space-y-1">
            {r.request_items.map((i) => {
              const c = getCategory(i.category);
              return (
                <li key={i.category} className="flex justify-between gap-3 text-night">
                  <span>
                    {i.quantity} {i.quantity === 1 ? c.unit.sv : c.unitPlural.sv} ({c.name.sv.toLowerCase()})
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-muted">
                    {i.host_price_month != null ? `${formatKr(hostPayout(i.host_price_month) * i.quantity)} kr/mån` : i.hourly_price != null ? `${formatKr(hostPayout(i.hourly_price) * i.quantity)} kr/tim` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        {r.renterPhone && (
          <div className="p-4">
            <p className="text-sm font-semibold text-muted">{appText.menu.phone}</p>
            <a href={`tel:${r.renterPhone.replace(/\s/g, "")}`} className="font-semibold text-brand underline underline-offset-4">
              {r.renterPhone}
            </a>
          </div>
        )}
        <div className="p-4">
          <p className="text-sm font-semibold text-muted">{t.period}</p>
          <p className="text-night">{periodText(r, appText.common.untilFurtherNotice)}</p>
        </div>
        {r.message && (
          <div className="p-4">
            <p className="text-sm font-semibold text-muted">{t.message}</p>
            <p className="mt-1 leading-relaxed whitespace-pre-line text-ink">{r.message}</p>
          </div>
        )}
        <div className="p-4">
          <p className="text-lg font-bold text-night">
            {r.kind === "hour" ? fill(t.priceTotal, { amount: formatKr(hostPayout(r.host_total ?? 0)) }) : fill(t.price, { amount: formatKr(requestIncome(r.request_items)) })}
          </p>
          {r.kind === "hour" && <p className="text-sm text-muted">{t.directBooking}</p>}
        </div>
      </div>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-5 rounded-xl p-4 text-[0.95rem] font-medium ${message.tone === "error" ? "bg-[#fef3f2] text-[#b42318]" : "bg-[#e7f4ec] text-pine"}`}>
          {message.text}
          {message.payouts && (
            <Link prefetch={false} href="/vard/utbetalningar" className="ml-1 font-semibold underline underline-offset-4">
              {appText.payments.hostBannerCta}
            </Link>
          )}
        </p>
      )}

      {status === "pending" && payoutsMissing && !message && (
        <p className="mt-5 rounded-xl bg-[#fff6e5] p-4 text-[0.95rem] text-night">
          {appText.payments.payoutsRequired}{" "}
          <Link prefetch={false} href="/vard/utbetalningar" className="font-semibold underline underline-offset-4">
            {appText.payments.hostBannerCta}
          </Link>
        </p>
      )}

      {r.payment_required && status === "accepted" && (
        <div className="mt-5 rounded-xl bg-frost/70 p-4 text-[0.95rem] text-ink">
          <p className="font-semibold text-night">{r.paid_through || isHour ? appText.payments.renterPaid : appText.payments.awaitingPayment}</p>
          {nextShare && (
            <p className="mt-1">
              {fill(appText.payments.hostShare, {
                amount: formatKr(nextShare.host_amount),
                date: formatMoment(Date.parse(nextShare.transfer_due_at) > now ? nextShare.transfer_due_at : now),
              })}
            </p>
          )}
          {ending && r.end_date && <p className="mt-1">{fill(appText.payments.ending, { date: formatDay(r.end_date, true) })}</p>}
        </div>
      )}

      {status === "accepted" && !isHour && (!r.payment_required || r.paid_through) && (
        <div className="mt-6">
          <HandoverSection requestId={r.id} uid={uid} hostId={r.host_id} names={{ host: appText.handover.youObject, renter: name }} />
        </div>
      )}
      {status === "accepted" && (
        <div className="mt-6">
          <ReviewSection requestId={r.id} otherName={name} role="host" />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {status === "pending" && !declining && (
          <>
            <p className="flex items-center gap-1.5 font-semibold text-[#8a5a00]">
              <Hourglass size={17} aria-hidden="true" />
              {fill(appText.today.answerWithin, { time: timeLeft(r.expires_at, now) })}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={busy} onClick={() => respond(true)} className="btn btn-primary">
                <Check size={18} aria-hidden="true" />
                {t.accept}
              </button>
              <button type="button" disabled={busy} onClick={() => setDeclining(true)} className="btn btn-secondary">
                <X size={18} aria-hidden="true" />
                {t.decline}
              </button>
            </div>
            <p className="text-sm text-muted">
              {appText.agreement.hostNote}{" "}
              <Link prefetch={false} href={`/vard/avtal?id=${r.id}`} className="font-semibold text-brand underline-offset-2 hover:underline">
                {appText.agreement.read}
              </Link>
            </p>
          </>
        )}
        {status === "pending" && declining && (
          <div className="card p-4">
            <label htmlFor="decline-reason" className="field-label">
              {t.declineReason}
            </label>
            <textarea id="decline-reason" className="field-input resize-y" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={() => respond(false)} className="btn btn-primary">
                {t.declineConfirm}
              </button>
              <button type="button" onClick={() => setDeclining(false)} className="btn btn-secondary">
                {appText.common.cancel}
              </button>
            </div>
          </div>
        )}
        {status !== "pending" && (
          <p className="font-semibold text-night">
            Status: {r.kind === "hour" && status === "accepted" ? "Bokad" : appText.requestStatus[status]}
            {status === "declined" && r.decline_reason ? ` (${r.decline_reason})` : ""}
            {status === "cancelled" && cancelledText ? ` · ${cancelledText}` : ""}
          </p>
        )}
        {status === "cancelled" && r.cancel_reason && r.cancelled_by !== r.host_id && (
          <p className="leading-relaxed text-ink">
            <span className="font-semibold">{t.message}: </span>
            {r.cancel_reason}
          </p>
        )}
        {cancelling && canCancel && (
          <div className="card p-4">
            <p className="font-bold text-night">{t.cancelTitle}</p>
            <p className="mt-1 text-[0.95rem] text-muted">{isHour ? t.cancelHourNote : fill(t.cancelNote, { name })}</p>
            {isHour && <p className="mt-1 text-[0.95rem] text-muted">{fill(t.cancelNote, { name })}</p>}
            <label htmlFor="cancel-reason" className="field-label mt-3">
              {fill(t.cancelReason, { name })}
            </label>
            <textarea
              id="cancel-reason"
              className="field-input resize-y"
              rows={3}
              maxLength={500}
              placeholder={t.cancelReasonPlaceholder}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={busy} onClick={cancel} className="btn bg-[#b42318] text-white hover:bg-[#912018]">
                {t.cancelConfirm}
              </button>
              <button type="button" onClick={() => setCancelling(false)} className="btn btn-secondary">
                {t.keep}
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link prefetch={false} href={`/vard/meddelanden?id=${r.conversation_id}`} className="btn btn-secondary">
            <MessageSquare size={18} aria-hidden="true" />
            {t.message_renter}
          </Link>
          <Link prefetch={false} href={`/vard/avtal?id=${r.id}`} className="btn btn-secondary">
            <FileText size={18} aria-hidden="true" />
            {appText.agreement.link}
          </Link>
          {endInstead && !ending && (
            <button type="button" disabled={busy} onClick={endRental} className="btn text-[#b42318] hover:bg-[#fef3f2]">
              {appText.payments.endRentalHost}
            </button>
          )}
          {canCancel && !cancelling && (
            <button type="button" disabled={busy} onClick={() => setCancelling(true)} className="btn text-[#b42318] hover:bg-[#fef3f2]">
              {t.cancel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
