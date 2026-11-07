"use client";

import Link from "next/link";
import { useState } from "react";
import { appText } from "@/content/app";
import { fetchRenterRequests } from "@/lib/app/data";
import { effectiveStatus, todayIso } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { Spinner, useAppSession } from "../AppShell";
import { BookingCard } from "./BookingCard";

const t = appText.bookings;

export function BookingsPage() {
  const uid = useAppSession().user.id;
  const { data, loading, error } = useLoad(() => fetchRenterRequests(uid), uid);
  const [now] = useState(() => Date.now());

  if (loading) return <Spinner />;
  if (error || !data) return <p className="text-muted">{appText.common.error}</p>;

  const today = todayIso();
  const active = data
    .filter((r) => r.status === "accepted" && (r.end_date === null || r.end_date >= today))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const pending = data.filter((r) => effectiveStatus(r, now) === "pending");
  const past = data.filter((r) => !active.includes(r) && !pending.includes(r));

  const groups = [
    { title: t.active, list: active },
    { title: t.pending, list: pending },
    { title: t.past, list: past },
  ].filter((g) => g.list.length > 0);

  return (
    <div className="space-y-9">
      <h1 className="text-[2rem] leading-tight text-night">{t.title}</h1>
      {groups.length === 0 ? (
        <div>
          <p className="text-muted">{t.empty}</p>
          <Link prefetch={false} href="/sok" className="btn btn-primary mt-4">
            {t.find}
          </Link>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.title}>
            <h2 className="text-2xl text-night">{g.title}</h2>
            <ul className="mt-3 grid gap-2 lg:grid-cols-2">
              {g.list.map((r) => (
                <li key={r.id}>
                  <BookingCard request={r} now={now} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
