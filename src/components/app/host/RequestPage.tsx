"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Hourglass, MessageSquare, X } from "lucide-react";
import { useState } from "react";
import { appText } from "@/content/app";
import { getCategory } from "@/content/categories";
import { fill } from "@/lib/i18n";
import { fetchCounterpartPrivate, fetchRequest } from "@/lib/app/data";
import { effectiveStatus, formatKr, formatPeriod, hostPayout, requestIncome, timeLeft } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner } from "../AppShell";
import { Avatar } from "./RequestCard";

const t = appText.request;

function memberSince(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(new Date(iso));
}

export function RequestPage() {
  const id = useSearchParams().get("id") ?? "";
  const { data: r, loading, reload } = useLoad(async () => {
    const req = await fetchRequest(id);
    // The renter's phone is readable once the request is accepted.
    const phone = req?.status === "accepted" ? ((await fetchCounterpartPrivate(req.renter_id))?.phone ?? "") : "";
    return req ? { ...req, renterPhone: phone } : null;
  }, id);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
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
      setMessage({ tone: "error", text: /no_capacity/.test(res.error.message) ? t.noCapacity : appText.common.error });
    } else if (res.data === "expired") {
      setMessage({ tone: "error", text: t.expired });
    } else if (res.data === "accepted") {
      setMessage({ tone: "ok", text: fill(t.accepted, { name }) });
    }
    await reload();
  }

  async function cancel() {
    if (!window.confirm(t.cancelConfirm)) return;
    setBusy(true);
    const res = await supabase().rpc("cancel_request", { p_request: id });
    setBusy(false);
    if (res.error) setMessage({ tone: "error", text: appText.common.error });
    await reload();
  }

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
        </div>
      </div>
      {r.renter?.about && <p className="mt-4 leading-relaxed text-ink/90">{r.renter.about}</p>}

      <div className="mt-6 card divide-y divide-line">
        <div className="p-4">
          <p className="text-sm font-semibold text-muted">{t.listing}</p>
          <p className="font-semibold text-night">{r.listing?.title}</p>
        </div>
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
                  <span className="shrink-0 whitespace-nowrap text-muted">{formatKr(hostPayout(i.host_price_month) * i.quantity)} kr/mån</span>
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
          <p className="text-night">{formatPeriod(r.start_date, r.end_date, appText.common.untilFurtherNotice)}</p>
        </div>
        {r.message && (
          <div className="p-4">
            <p className="text-sm font-semibold text-muted">{t.message}</p>
            <p className="mt-1 leading-relaxed whitespace-pre-line text-ink">{r.message}</p>
          </div>
        )}
        <div className="p-4">
          <p className="text-lg font-bold text-night">{fill(t.price, { amount: formatKr(requestIncome(r.request_items)) })}</p>
        </div>
      </div>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-5 rounded-xl p-4 text-[0.95rem] font-medium ${message.tone === "error" ? "bg-[#fef3f2] text-[#b42318]" : "bg-[#e7f4ec] text-pine"}`}>
          {message.text}
        </p>
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
            Status: {appText.requestStatus[status]}
            {status === "declined" && r.decline_reason ? ` (${r.decline_reason})` : ""}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link prefetch={false} href={`/vard/meddelanden?id=${r.conversation_id}`} className="btn btn-secondary">
            <MessageSquare size={18} aria-hidden="true" />
            {t.message_renter}
          </Link>
          {status === "accepted" && (
            <button type="button" disabled={busy} onClick={cancel} className="btn text-[#b42318] hover:bg-[#fef3f2]">
              {t.cancel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
