"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CircleCheck, Clock3, Hourglass, KeyRound, MapPin, MessageSquare, Phone } from "lucide-react";
import { useState, type ReactNode } from "react";
import { appText } from "@/content/app";
import { getCategory } from "@/content/categories";
import { fill } from "@/lib/i18n";
import { fetchCounterpartPrivate, fetchListingPrivate, fetchRenterRequest } from "@/lib/app/data";
import { effectiveStatus, formatKr, formatPeriod, renterMonthly, renterPrice, timeLeft } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner } from "../AppShell";
import { Avatar, CoverPhoto } from "../ui";

const t = appText.booking;

function memberSince(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(new Date(iso));
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
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const justSent = params.get("skickad") === "1";
  const { data, loading, reload } = useLoad(async () => {
    const r = await fetchRenterRequest(id);
    if (!r || r.status !== "accepted") return { r, priv: null, hostPriv: null };
    const [priv, hostPriv] = await Promise.all([fetchListingPrivate(r.listing_id), fetchCounterpartPrivate(r.host_id)]);
    return { r, priv, hostPriv };
  }, id);
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (loading) return <Spinner />;
  const r = data?.r;
  if (!r) return <p className="text-muted">{appText.common.error}</p>;

  const status = effectiveStatus(r, now);
  const hostName = r.host?.first_name || t.host;
  const l = r.listing;
  const place = [l?.area_name, l?.city].filter(Boolean).join(", ");
  const priv = data?.priv;
  const address = priv ? [priv.street_address, [priv.postal_code, l?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";

  async function cancel(confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setFailed(false);
    const res = await supabase().rpc("cancel_request", { p_request: r!.id });
    setBusy(false);
    if (res.error) setFailed(true);
    await reload();
  }

  const banner: Record<typeof status, { tone: "wait" | "ok" | "off"; text: string }> = {
    pending: { tone: "wait", text: fill(t.pending, { name: hostName }) },
    accepted: { tone: "ok", text: t.accepted },
    declined: { tone: "off", text: fill(t.declined, { name: hostName }) },
    cancelled: { tone: "off", text: t.cancelled },
    expired: { tone: "off", text: t.expired },
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
        {status === "pending" && (
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-[#8a5a00]">
            <Hourglass size={17} aria-hidden="true" />
            {fill(t.answerWithin, { time: timeLeft(r.expires_at, now) })}
          </p>
        )}
        {status === "declined" && r.decline_reason && (
          <p className="mt-2">
            <span className="font-semibold">{t.reason}: </span>
            {r.decline_reason}
          </p>
        )}
        {(status === "declined" || status === "expired" || status === "cancelled") && (
          <Link prefetch={false} href="/kund/sok" className="btn btn-primary mt-4">
            {t.findOther}
          </Link>
        )}
      </div>

      {l && (
        <Link prefetch={false} href={`/kund/annons?id=${l.id}`} className="card flex items-center gap-3 p-3 hover:border-night/30">
          <CoverPhoto photos={l.listing_photos} className="h-16 w-16 shrink-0 rounded-xl" />
          <span className="min-w-0">
            <span className="block truncate font-bold text-night">{l.title}</span>
            <span className="block truncate text-sm text-muted">{place}</span>
            <span className="block text-sm font-semibold text-brand">{t.seeListing}</span>
          </span>
        </Link>
      )}

      {status === "accepted" ? (
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
        status === "pending" && (
          <p className="flex gap-2 rounded-2xl bg-frost/70 p-4 text-[0.95rem] text-ink">
            <KeyRound size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            {t.addressLater}
          </p>
        )
      )}

      <div className="card divide-y divide-line">
        <div className="p-4">
          <p className="text-sm font-semibold text-muted">{t.wants}</p>
          <ul className="mt-1 space-y-1">
            {r.request_items.map((i) => {
              const c = getCategory(i.category);
              return (
                <li key={i.category} className="flex justify-between gap-3 text-night">
                  <span>
                    {i.quantity} {i.quantity === 1 ? c.unit.sv : c.unitPlural.sv} ({c.name.sv.toLowerCase()})
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-muted">{formatKr(renterPrice(i.host_price_month) * i.quantity)} kr/mån</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold text-muted">{t.period}</p>
          <p className="text-night">{formatPeriod(r.start_date, r.end_date, appText.common.untilFurtherNotice)}</p>
        </div>
        <div className="p-4">
          <p className="text-lg font-bold text-night">{fill(t.perMonth, { amount: formatKr(renterMonthly(r.request_items)) })}</p>
          <p className="text-sm text-muted">{appText.requestForm.includesFee}</p>
        </div>
      </div>

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
          <Link prefetch={false} href={`/kund/meddelanden?id=${r.conversation_id}`} className="btn btn-secondary">
            <MessageSquare size={18} aria-hidden="true" />
            {t.messageHost}
          </Link>
        </div>
      )}

      {failed && (
        <p role="alert" className="rounded-xl bg-[#fef3f2] p-4 text-[0.95rem] font-medium text-[#b42318]">
          {appText.common.error}
        </p>
      )}

      {status === "pending" && (
        <button type="button" disabled={busy} onClick={() => cancel(t.withdrawConfirm)} className="btn text-[#b42318] hover:bg-[#fef3f2]">
          {t.withdraw}
        </button>
      )}
      {status === "accepted" && (
        <button type="button" disabled={busy} onClick={() => cancel(t.cancelConfirm)} className="btn text-[#b42318] hover:bg-[#fef3f2]">
          {t.cancel}
        </button>
      )}
    </div>
  );
}
