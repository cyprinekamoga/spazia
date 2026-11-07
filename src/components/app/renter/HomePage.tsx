"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPin } from "lucide-react";
import { useState, type FormEvent } from "react";
import { categoryIcons } from "@/components/Icons";
import { appText } from "@/content/app";
import { categories } from "@/content/categories";
import { fill } from "@/lib/i18n";
import { fetchMyProfile, fetchRenterRequests } from "@/lib/app/data";
import { effectiveStatus, isActive, isCurrent, todayIso } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { Spinner, useAppSession } from "../AppShell";
import { BookingCard } from "./BookingCard";

const t = appText.renterHome;

/** Search box with the categories as shortcuts. */
export function SearchHero() {
  const router = useRouter();
  const [place, setPlace] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = place.trim();
    router.push(q ? `/sok?ort=${encodeURIComponent(q)}` : "/sok");
  }

  return (
    <section className="rounded-3xl bg-night px-5 py-6 text-white sm:px-8 sm:py-8">
      <h2 className="text-2xl text-white sm:text-3xl">{t.searchTitle}</h2>
      <form onSubmit={submit} className="mt-4 flex items-center gap-2 rounded-full bg-paper p-1.5 pl-4 text-ink">
        <MapPin size={20} className="shrink-0 text-brand" aria-hidden="true" />
        <label htmlFor="home-place" className="sr-only">
          {appText.search.where}
        </label>
        <input
          id="home-place"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder={t.wherePlaceholder}
          autoComplete="address-level2"
          className="min-w-0 flex-1 bg-transparent py-2 text-[1.05rem] placeholder:text-muted focus:outline-none"
        />
        <button type="submit" className="btn btn-primary shrink-0 !px-5">
          {t.find}
        </button>
      </form>
      <p className="mt-5 text-sm font-semibold text-frost-2">{t.categories}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {categories.map((c) => {
          const Icon = categoryIcons[c.id];
          return (
            <li key={c.id}>
              <Link
                prefetch={false}
                href={`/sok?typ=${c.id}`}
                className="flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-3.5 text-[0.95rem] font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
              >
                <Icon size={18} aria-hidden="true" />
                {c.name.sv}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl text-night">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function RenterHomePage() {
  const uid = useAppSession().user.id;
  const { data, loading, error } = useLoad(async () => {
    const [me, requests] = await Promise.all([fetchMyProfile(uid), fetchRenterRequests(uid)]);
    return { me, requests };
  }, uid);
  const [now] = useState(() => Date.now());

  if (loading) return <Spinner />;
  if (error || !data) return <p className="text-muted">{appText.common.error}</p>;

  const { me, requests } = data;
  const today = todayIso();
  const pending = requests.filter((r) => effectiveStatus(r, now) === "pending");
  const accepted = requests.filter((r) => r.status === "accepted" && isActive(r, today, now));
  const current = accepted.filter((r) => isCurrent(r, today));
  const upcoming = accepted.filter((r) => r.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const name = me.profile?.first_name;
  const todo = [
    !me.profile?.avatar_url ? t.addPhoto : null,
    !me.profile?.about ? t.addAbout : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-9">
      <h1 className="text-[2.2rem] leading-tight text-night">{name ? fill(appText.today.greeting, { name }) : appText.today.greetingNoName}</h1>

      <SearchHero />

      {pending.length > 0 && (
        <Section title={t.waiting}>
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.id}>
                <BookingCard request={r} now={now} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {current.length > 0 && (
        <Section title={t.current}>
          <ul className="space-y-2">
            {current.map((r) => (
              <li key={r.id}>
                <BookingCard request={r} now={now} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title={t.upcoming}>
          <ul className="space-y-2">
            {upcoming.map((r) => (
              <li key={r.id}>
                <BookingCard request={r} now={now} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {requests.length === 0 && (
        <Section title={t.howTitle}>
          <p className="leading-relaxed text-muted">{t.empty}</p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {t.how.map((step, i) => (
              <li key={step} className="card flex gap-3 p-4 sm:block">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night font-display text-lg font-bold text-glow">{i + 1}</span>
                <span className="block leading-snug text-ink sm:mt-3">{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {todo.length > 0 && requests.length > 0 && (
        <Section title={appText.today.todo}>
          <ul className="space-y-2">
            {todo.map((item) => (
              <li key={item}>
                <Link prefetch={false} href="/kund/meny" className="card flex min-h-14 items-center justify-between gap-3 px-4 py-3 font-semibold text-night hover:border-night/30">
                  {item}
                  <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
