"use client";

import { L, appLocale } from "@/lib/app/lang";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CircleCheck, Clock3, FileText, Hourglass, KeyRound, MapPin, MessageSquare, Phone } from "lucide-react";
import { useState, type ReactNode } from "react";
import { appText } from "@/content/app";
import { getCategory } from "@/content/categories";
import { fill } from "@/lib/i18n";
import { fetchCounterpartPrivate, fetchListingPrivate, fetchRenterRequest } from "@/lib/app/data";
import { bookingHours, effectiveStatus, formatDay, formatKr, formatMoment, periodText, renterCancelDeadline, renterCanCancel, renterHourlyTotal, renterMonthly, renterPrice, timeLeft, todayIso } from "@/lib/app/model";
import { fetchProtectionOffer, fetchRequestPayments, protectionAmount, type Payment } from "@/lib/app/payments";
import { useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner, useAppSession } from "../AppShell";
import { HandoverSection } from "../Handovers";
import { ReviewSection } from "../Reviews";
import { Avatar, CoverPhoto } from "../ui";
import { PaymentPanel } from "./PaymentPanel";
import { ProtectionPanel } from "../Protection";

const t = appText.booking;

function memberSince(iso: string): string {
  return new Intl.DateTimeFormat(appLocale, { month: "long", year: "numeric" }).format(new Date(iso));
}

function Row({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 p-4">
      <Icon size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <div className="text-night">{children}</div>
      </div>
    </div>
  );
}

export function BookingPage() {
  const uid = useAppSession().user.id;
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const justSent = params.get("skickad") === "1";
  const { data, loading, reload } = useLoad(async () => {
    const r = await fetchRenterRequest(id);
    const payments: Payment[] = r?.payment_required ? await fetchRequestPayments(r.id) : [];
    const offer = r?.protection_rate ? await fetchProtectionOffer() : null;
    if (!r || r.status !== "accepted") return { r, priv: null, hostPriv: null, payments, offer };
    const [priv, hostPriv] = await Promise.all([fetchListingPrivate(r.listing_id), fetchCounterpartPrivate(r.host_id)]);
    return { r, priv, hostPriv, payments, offer };
  }, id);
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (loading) return <Spinner />;
  const r = data?.r;
  if (!r) return <p className="text-muted">{appText.common.error}</p>;

  const status = effectiveStatus(r, now);
  const hourlyItem = r.request_items.find((i) => i.hourly_price != null);
  const hostName = r.host?.first_name || t.host;
  const l = r.listing;
  const place = [l?.area_name, l?.city].filter(Boolean).join(", ");
  const priv = data?.priv;
  const address = priv ? [priv.street_address, [priv.postal_code, l?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";

  async function cancel(confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setFailed(null);
    const res = await supabase().rpc("cancel_request", { p_request: r!.id });
    setBusy(false);
    if (res.error) setFailed(/too_late|already_started/.test(res.error.message) ? t.tooLateError : appText.common.error);
    await reload();
  }

  async function endRental() {
    const last = r!.paid_through ?? todayIso();
    if (!window.confirm(r!.payment_required ? fill(appText.payments.endConfirm, { date: formatDay(last, true) }) : appText.payments.endConfirmToday)) return;
    setBusy(true);
    setFailed(null);
    const res = await supabase().rpc("end_rental", { p_request: r!.id });
    setBusy(false);
    if (res.error) setFailed(appText.common.error);
    await reload();
  }

  const isHour = r.kind === "hour";
  // A parking booking that is being paid, and a paid monthly rental that has started (ended, not cancelled).
  const isHold = isHour && r.payment_required && (status === "pending" || status === "expired");
  const endInstead = !isHour && r.payment_required && status === "accepted" && todayIso() >= r.start_date;
  const ending = Boolean(r.ended_at && r.end_date);
  const unpaid = r.payment_required && status === "accepted" && !r.paid_through;
  const canCancel = renterCanCancel({ ...r, status }, now) && !isHold && !endInstead;
  const deadline = isHour ? renterCancelDeadline(r) : null;
  const notStarted = !isHour || (r.start_at != null && now < Date.parse(r.start_at));
  const cancelledText = r.cancelled_by && r.cancelled_by === r.host_id ? fill(t.cancelledByHost, { name: hostName }) : r.cancelled_by ? t.cancelledByYou : t.cancelled;

  const banner: Record<typeof status, { tone: "wait" | "ok" | "off"; text: string }> = {
    pending: { tone: "wait", text: isHold ? appText.payments.holdTitle : fill(t.pending, { name: hostName }) },
    accepted: { tone: "ok", text: unpaid ? appText.payments.acceptedUnpaid : r.kind === "hour" ? t.booked : t.accepted },
    declined: { tone: "off", text: fill(t.declined, { name: hostName }) },
    cancelled: { tone: "off", text: cancelledText },
    expired: { tone: "off", text: isHold ? appText.payments.holdExpired : t.expired },
  };
  const b = banner[status];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link prefetch={false} href="/kund/bokningar" className="flex min-h-11 w-fit items-center gap-1.5 font-semibold text-night">
        <ArrowLeft size={18} aria-hidden="true" />
        {appText.bookings.title}
      </Link>

      {justSent && status === "pending" && (
        <p role="status" className="flex gap-2 rounded-2xl bg-[#e7f4ec] p-4 font-medium text-pine">
          <CircleCheck size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          {fill(t.sent, { name: hostName })}
        </p>
      )}

      <div className={`rounded-2xl p-5 ${b.tone === "ok" ? "bg-night text-white" : b.tone === "wait" ? "bg-[#fff6e5] text-night" : "bg-frost text-night"}`}>
        <p className="text-xl font-bold">{b.text}</p>
        {status === "pending" && !isHold && (
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-[#8a5a00]">
            <Hourglass size={17} aria-hidden="true" />
            {fill(t.answerWithin, { time: timeLeft(r.expires_at, now) })}
          </p>
        )}
        {status === "cancelled" && r.cancelled_by === r.host_id && r.cancel_reason && (
          <p className="mt-2">
            <span className="font-semibold">{t.reason}: </span>
            {r.cancel_reason}
          </p>
        )}
        {status === "accepted" && isHour && deadline !== null && notStarted && (
          <p className="mt-2 text-white/85">{canCancel ? fill(t.freeCancelUntil, { time: formatMoment(deadline) }) : fill(t.tooLate, { name: hostName })}</p>
        )}
        {status === "declined" && r.decline_reason && (
          <p className="mt-2">
            <span className="font-semibold">{t.reason}: </span>
            {r.decline_reason}
          </p>
        )}
        {(status === "declined" || (status === "expired" && !isHold) || status === "cancelled") && (
          <Link prefetch={false} href="/sok" className="btn btn-primary mt-4">
            {t.findOther}
          </Link>
        )}
      </div>

      <PaymentPanel r={r} status={status} payments={data?.payments ?? []} onChange={reload} />

      {l && (
        <Link prefetch={false} href={`/annons?id=${l.id}`} className="card flex items-center gap-3 p-3 hover:border-night/30">
          <CoverPhoto photos={l.listing_photos} className="h-16 w-16 shrink-0 rounded-xl" />
          <span className="min-w-0">
            <span className="block truncate font-bold text-night">{l.title}</span>
            <span className="block truncate text-sm text-muted">{place}</span>
            <span className="block text-sm font-semibold text-brand">{t.seeListing}</span>
          </span>
        </Link>
      )}

      {status === "accepted" && !unpaid ? (
        <div className="card divide-y divide-line">
          <Row icon={MapPin} label={t.address}>
            <p className="font-semibold">{address || place}</p>
            {address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm font-semibold text-brand underline underline-offset-4"
              >
                {t.map}
              </a>
            )}
          </Row>
          {priv?.access_instructions && (
            <Row icon={KeyRound} label={t.access}>
              <p className="leading-relaxed whitespace-pre-line">{priv.access_instructions}</p>
            </Row>
          )}
          {l?.access && (
            <Row icon={Clock3} label={t.accessHours}>
              {appText.access[l.access]}
              {l.access_notes ? `. ${l.access_notes}` : ""}
            </Row>
          )}
          {data?.hostPriv?.phone && (
            <Row icon={Phone} label={fill(t.hostPhone, { name: hostName })}>
              <a href={`tel:${data.hostPriv.phone.replace(/\s/g, "")}`} className="font-semibold text-brand underline underline-offset-4">
                {data.hostPriv.phone}
              </a>
            </Row>
          )}
        </div>
      ) : (
        status === "pending" && !isHold && (
          <p className="flex gap-2 rounded-2xl bg-frost/70 p-4 text-[0.95rem] text-ink">
            <KeyRound size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            {t.addressLater}
          </p>
        )
      )}

      <div className="card divide-y divide-line">
        <div className="p-4">
          <p className="text-sm font-semibold text-muted">{r.kind === "hour" ? t.bookedWhat : t.wants}</p>
          <ul className="mt-1 space-y-1">
            {r.request_items.map((i) => {
              const c = getCategory(i.category);
              return (
                <li key={i.category} className="flex justify-between gap-3 text-night">
                  <span>
                    {i.quantity} {i.quantity === 1 ? L(c.unit) : L(c.unitPlural)} ({L(c.name).toLowerCase()})
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-muted">
                    {i.host_price_month != null
                      ? `${formatKr(renterPrice(i.host_price_month) * i.quantity)} kr/mån`
                      : i.hourly_price != null
                        ? fill(t.hourlyPrice, { price: formatKr(renterPrice(i.hourly_price) * i.quantity) })
                        : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold text-muted">{t.period}</p>
          <p className="text-night">{periodText(r, appText.common.untilFurtherNotice)}</p>
        </div>
        <div className="p-4">
          <p className="text-lg font-bold text-night">{r.kind === "hour" ? fill(t.total, { amount: formatKr(hourlyItem ? renterHourlyTotal(bookingHours(r), hourlyItem.hourly_price!, hourlyItem.daily_max, hourlyItem.quantity) : 0) }) : fill(t.perMonth, { amount: formatKr(renterMonthly(r.request_items) + protectionAmount(renterMonthly(r.request_items), r.protection_rate)) })}</p>
          <p className="text-sm text-muted">{appText.requestForm.includesFee}</p>
        </div>
      </div>

      {status === "accepted" && !unpaid && r.kind !== "hour" && (
        <HandoverSection requestId={r.id} uid={uid} hostId={r.host_id} names={{ host: hostName, renter: appText.handover.youObject }} />
      )}
      {r.protection_rate && r.kind === "month" && (status === "accepted" || status === "pending") && (
        <ProtectionPanel requestId={r.id} cap={data?.offer?.cap ?? null} canClaim={status === "accepted" && !unpaid} />
      )}
      {status === "accepted" && <ReviewSection requestId={r.id} otherName={hostName} role="renter" />}

      {r.host && (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={hostName} url={r.host.avatar_url} size={52} />
            <div>
              <p className="font-bold text-night">
                {t.host}: {hostName}
              </p>
              <p className="text-sm text-muted">{fill(appText.request.memberSince, { date: memberSince(r.host.created_at) })}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link prefetch={false} href={`/kund/meddelanden?id=${r.conversation_id}`} className="btn btn-secondary">
              <MessageSquare size={18} aria-hidden="true" />
              {t.messageHost}
            </Link>
            <Link prefetch={false} href={`/kund/avtal?id=${r.id}`} className="btn btn-secondary">
              <FileText size={18} aria-hidden="true" />
              {appText.agreement.link}
            </Link>
          </div>
        </div>
      )}

      {failed && (
        <p role="alert" className="rounded-xl bg-[#fef3f2] p-4 text-[0.95rem] font-medium text-[#b42318]">
          {failed}
        </p>
      )}

      {status === "pending" && !isHold && (
        <button type="button" disabled={busy} onClick={() => cancel(t.withdrawConfirm)} className="btn text-[#b42318] hover:bg-[#fef3f2]">
          {t.withdraw}
        </button>
      )}
      {endInstead && !ending && (
        <button type="button" disabled={busy} onClick={endRental} className="btn text-[#b42318] hover:bg-[#fef3f2]">
          {appText.payments.endRental}
        </button>
      )}
      {status === "accepted" && canCancel && (
        <button type="button" disabled={busy} onClick={() => cancel(isHour ? t.cancelParkingConfirm : t.cancelConfirm)} className="btn text-[#b42318] hover:bg-[#fef3f2]">
          {t.cancel}
        </button>
      )}
    </div>
  );
}
