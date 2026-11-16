"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { fetchHostRequests, fetchMyListings, fetchMyProfile } from "@/lib/app/data";
import { effectiveStatus, formatKr, requestIncome, todayIso } from "@/lib/app/model";
import { fetchHostPayments, fetchPaymentSetup } from "@/lib/app/payments";
import { useLoad } from "@/lib/app/session";
import { Spinner, useAppSession } from "../AppShell";
import { RequestCard } from "./RequestCard";

const t = appText.today;

function Todo({ href, children }: { href: string; children: string }) {
  return (
    <li>
      <Link prefetch={false} href={href} className="card flex min-h-14 items-center justify-between gap-3 px-4 py-3 font-semibold text-night hover:border-night/30">
        {children}
        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function TodayPage() {
  const uid = useAppSession().user.id;
  const { data, loading, error } = useLoad(async () => {
    const [me, listings, requests, pay, payments] = await Promise.all([
      fetchMyProfile(uid),
      fetchMyListings(uid),
      fetchHostRequests(uid),
      fetchPaymentSetup().catch(() => null),
      fetchHostPayments(uid).catch(() => []),
    ]);
    return { me, listings, requests, pay, payments };
  }, uid);
  // The time the page was loaded: used for "answer within" and expiry.
  const [now] = useState(() => Date.now());

  if (loading) return <Spinner />;
  if (error || !data) return <p className="text-muted">{appText.common.error}</p>;

  const { me, listings, requests } = data;
  const today = todayIso();
  const pending = requests.filter((r) => effectiveStatus(r, now) === "pending");
  const accepted = requests.filter((r) => r.status === "accepted");
  const current = accepted.filter((r) => r.start_date <= today && (r.end_date === null || r.end_date >= today));
  const upcoming = accepted.filter((r) => r.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const income = current.reduce((sum, r) => sum + requestIncome(r.request_items), 0);
  const drafts = listings.filter((l) => l.status === "draft");
  const name = me.profile?.first_name;
  // Payout details (name, personal number, bank account) are asked for only once
  // there is money waiting: after the first paid rental, not when signing up.
  const waiting = data.payments.filter((p) => !p.transferred_at && !p.refund_requested_at).reduce((sum, p) => sum + p.host_amount, 0);
  const needsPayouts = Boolean(data.pay?.enabled && !data.pay.payouts?.details_submitted && waiting > 0);
  // Phone number and photo can wait until the first rental, too.
  const hasRented = requests.some((r) => r.status === "accepted");
  const todos = drafts.length > 0 || (hasRented && (!me.priv?.phone || !me.profile?.avatar_url));

  return (
    <div className="space-y-9">
      <h1 className="text-[2.2rem] leading-tight text-night">{name ? fill(t.greeting, { name }) : t.greetingNoName}</h1>

      {needsPayouts && (
        <section className="rounded-2xl bg-night p-5 text-white">
          <p className="text-2xl font-bold">{fill(appText.payments.payoutWaiting, { amount: formatKr(waiting) })}</p>
          <p className="mt-1.5 leading-relaxed text-frost-2">{appText.payments.payoutWaitingText}</p>
          <Link prefetch={false} href="/vard/utbetalningar" className="btn btn-light mt-4">
            {appText.payments.hostBannerCta}
          </Link>
        </section>
      )}

      {listings.length === 0 && (
        <Link prefetch={false} href="/vard/annons" className="btn btn-primary">
          {t.createFirst}
        </Link>
      )}

      {todos && (
        <section>
          <h2 className="text-2xl text-night">{t.todo}</h2>
          <ul className="mt-3 space-y-2">
            {drafts.map((d) => (
              <Todo key={d.id} href={`/vard/annons?id=${d.id}`}>
                {fill(t.finishListing, { title: d.title || appText.listings.untitled })}
              </Todo>
            ))}
            {hasRented && !me.priv?.phone && <Todo href="/vard/meny">{t.addPhone}</Todo>}
            {hasRented && !me.profile?.avatar_url && <Todo href="/vard/meny">{t.addPhoto}</Todo>}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-2xl text-night">{t.requests}</h2>
        {pending.length === 0 ? (
          <p className="mt-2 leading-relaxed text-muted">{t.noRequests}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pending.map((r) => (
              <li key={r.id}>
                <RequestCard request={r} now={now} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {income > 0 && (
        <section className="rounded-2xl bg-night p-5 text-white">
          <p className="text-2xl font-bold">{fill(t.income, { amount: formatKr(income) })}</p>
          <p className="mt-1 text-sm text-frost-2">{t.incomeHint}</p>
        </section>
      )}

      <section>
        <h2 className="text-2xl text-night">{t.current}</h2>
        {current.length === 0 ? (
          <p className="mt-2 text-muted">{t.nothingCurrent}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {current.map((r) => (
              <li key={r.id}>
                <RequestCard request={r} now={now} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-2xl text-night">{t.upcoming}</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-muted">{t.nothingUpcoming}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((r) => (
              <li key={r.id}>
                <RequestCard request={r} now={now} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
