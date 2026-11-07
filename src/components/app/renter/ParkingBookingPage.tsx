"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Minus, Plus, Zap } from "lucide-react";
import { useState, type FormEvent } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { fetchBlocks, fetchListingBundle, fetchMyProfile } from "@/lib/app/data";
import { formatDay, formatKr, hourLabel, hoursText, renterHourlyTotal, renterPrice, TIME_ZONE, type ListingBlock, type ListingSpace } from "@/lib/app/model";
import { must, useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner, useAppSession } from "../AppShell";
import { CoverPhoto } from "../ui";

const t = appText.parkingForm;
type ErrorCode = keyof typeof t.errors;
const HOUR = 3_600_000;

/** Today's date and the current hour in Swedish time. */
function swedishNow(): { date: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** A local wall time as a number (ms, UTC-based) so hours can be counted without time zones. */
function wall(date: string, hour: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, hour);
}

function wallParts(ms: number): { date: string; hour: number; isoDay: number } {
  const d = new Date(ms);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours(), isoDay: ((d.getUTCDay() + 6) % 7) + 1 };
}

/** "2026-11-12 14:00:00", the local time the database expects. */
function wallText(ms: number): string {
  const p = wallParts(ms);
  return `${p.date} ${hourLabel(p.hour)}:00`;
}

/** Why the chosen hours can't be booked, checked before asking the database (which checks the same). */
function problem(space: ListingSpace, blocks: ListingBlock[], startMs: number, endMs: number, nowMs: number): ErrorCode | null {
  if (!(endMs > startMs) || startMs < nowMs) return "bad_times";
  if ((endMs - startMs) / HOUR > 720) return "bad_times";
  const days = space.hourly_days ?? [1, 2, 3, 4, 5, 6, 7];
  for (let ms = startMs; ms < endMs; ms += HOUR) {
    const p = wallParts(ms);
    if (!days.includes(p.isoDay) || p.hour < (space.hourly_from ?? 0) || p.hour >= (space.hourly_to ?? 24)) return "outside_hours";
    if (blocks.some((b) => p.date >= b.start_date && p.date <= b.end_date)) return "blocked";
  }
  return null;
}

function HourSelect({ id, value, onChange }: { id: string; value: number; onChange: (h: number) => void }) {
  return (
    <select id={id} className="field-input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>
          {hourLabel(h)}
        </option>
      ))}
    </select>
  );
}

/** Book a parking space by the hour. The booking is confirmed straight away. */
export function ParkingBookingPage() {
  const uid = useAppSession().user.id;
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [now] = useState(swedishNow);
  const base = useLoad(async () => {
    const [bundle, blocks, me] = await Promise.all([fetchListingBundle(id), fetchBlocks(id), fetchMyProfile(uid)]);
    return { bundle, blocks, me };
  }, `${id}:${uid}`);

  const startHour0 = (now.hour + 1) % 24;
  const startDate0 = now.hour === 23 ? wallParts(wall(now.date, 24)).date : now.date;
  const [startDate, setStartDate] = useState(startDate0);
  const [startHour, setStartHour] = useState(startHour0);
  const [endDate, setEndDate] = useState(() => wallParts(wall(startDate0, startHour0 + 2)).date);
  const [endHour, setEndHour] = useState((startHour0 + 2) % 24);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startMs = wall(startDate, startHour);
  const endMs = wall(endDate, endHour);
  const free = useLoad(async () => {
    if (!id || !(endMs > startMs)) return 0;
    return must(await supabase().rpc("parking_availability", { p_listing: id, p_start: wallText(startMs), p_end: wallText(endMs) })) as number;
  }, `${id}|${startMs}|${endMs}`);

  if (base.loading) return <Spinner />;
  const bundle = base.data?.bundle;
  const space = bundle?.spaces.find((s) => s.category === "parking" && s.hourly_price != null);
  const back = (
    <Link prefetch={false} href={`/annons?id=${id}`} className="flex min-h-11 w-fit items-center gap-1.5 font-semibold text-night">
      <ArrowLeft size={18} aria-hidden="true" />
      {appText.renterListing.back}
    </Link>
  );
  if (!bundle || !space || bundle.listing.status !== "published" || bundle.listing.host_id === uid) {
    const why = !bundle || bundle.listing.status !== "published" ? t.errors.not_found : bundle.listing.host_id === uid ? t.errors.own_listing : t.errors.no_hourly;
    return (
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
        {back}
        <p className="mt-6 text-lg text-muted">{why}</p>
      </div>
    );
  }

  const { listing, photos, host } = bundle;
  const blocks = (base.data?.blocks ?? []).filter((b) => b.end_date >= now.date);
  const needName = !base.data?.me.profile?.first_name;
  const hostName = host?.first_name || appText.booking.host;
  const hours = Math.round((endMs - startMs) / HOUR);
  const timeProblem = problem(space, blocks, startMs, endMs, wall(now.date, now.hour));
  const freeNow = free.data ?? 0;
  const quantity = Math.max(1, Math.min(qty, Math.max(1, freeNow)));
  const renterTotal = hours > 0 ? renterHourlyTotal(hours, space.hourly_price!, space.daily_max, quantity) : 0;
  const full = !timeProblem && !free.loading && freeNow < 1;
  const canBook = !busy && !timeProblem && !full && hours >= 1 && (!needName || firstName.trim().length > 0);
  const place = [listing.area_name, listing.city].filter(Boolean).join(", ");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canBook) return;
    setBusy(true);
    setError(null);
    const db = supabase();
    if (needName) {
      const res = await db.from("profiles").update({ first_name: firstName.trim() }).eq("id", uid);
      if (res.error) {
        setBusy(false);
        setError(appText.common.error);
        return;
      }
    }
    const res = await db.rpc("book_parking", { p_listing: listing.id, p_start: wallText(startMs), p_end: wallText(endMs), p_quantity: quantity, p_message: message.trim() });
    if (res.error) {
      const code = (Object.keys(t.errors) as ErrorCode[]).find((k) => res.error.message.includes(k));
      setError(code ? t.errors[code] : appText.common.error);
      setBusy(false);
      await free.reload();
      return;
    }
    router.replace(`/kund/bokning?id=${res.data as string}`);
  }

  const renterHourly = renterPrice(space.hourly_price!);
  const priceLine =
    space.daily_max != null
      ? fill(t.price, { price: formatKr(renterHourly), max: formatKr(renterPrice(space.daily_max)) })
      : fill(t.priceNoMax, { price: formatKr(renterHourly) });

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl px-4 pt-4 pb-16 sm:px-6">
      {back}
      <h1 className="mt-2 text-[2rem] leading-tight text-night">{t.title}</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-8">
          <section className="card space-y-5 p-5">
            <h2 className="text-xl font-bold text-night">{t.when}</h2>
            <fieldset>
              <legend className="field-label">{t.from}</legend>
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <label htmlFor="start-date" className="sr-only">
                  {`${t.from}, ${t.date}`}
                </label>
                <input id="start-date" type="date" className="field-input" min={now.date} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                <label htmlFor="start-hour" className="sr-only">
                  {`${t.from}, ${t.time}`}
                </label>
                <HourSelect id="start-hour" value={startHour} onChange={setStartHour} />
              </div>
            </fieldset>
            <fieldset>
              <legend className="field-label">{t.to}</legend>
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <label htmlFor="end-date" className="sr-only">
                  {`${t.to}, ${t.date}`}
                </label>
                <input id="end-date" type="date" className="field-input" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                <label htmlFor="end-hour" className="sr-only">
                  {`${t.to}, ${t.time}`}
                </label>
                <HourSelect id="end-hour" value={endHour} onChange={setEndHour} />
              </div>
            </fieldset>
            {hours >= 1 && <p className="font-semibold text-night">{hours === 1 ? t.oneHour : fill(t.hours, { count: hours })}</p>}
            <p className="text-sm text-muted">{fill(t.bookable, { hours: hoursText(space) })}</p>
            {blocks.length > 0 && (
              <p className="text-sm text-muted">
                {fill(t.closed, {
                  periods: blocks.map((b) => (b.start_date === b.end_date ? formatDay(b.start_date) : `${formatDay(b.start_date)} – ${formatDay(b.end_date)}`)).join(", "),
                })}
              </p>
            )}
            {timeProblem ? (
              <p role="alert" className="text-[0.95rem] font-medium text-[#b42318]">
                {t.errors[timeProblem]}
              </p>
            ) : (
              !free.loading && <p className={`text-sm font-semibold ${freeNow > 0 ? "text-pine" : "text-[#b42318]"}`}>{freeNow > 0 ? fill(t.free, { count: freeNow }) : t.full}</p>
            )}
          </section>

          {space.capacity > 1 && (
            <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <h2 className="text-xl font-bold text-night">{t.spots}</h2>
              <div className="flex items-center gap-1" role="group" aria-label={t.spots}>
                <button type="button" onClick={() => setQty(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label={`Färre, ${t.spots}`} className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-night hover:border-night disabled:opacity-30">
                  <Minus size={18} aria-hidden="true" />
                </button>
                <span className="w-8 text-center text-lg font-bold text-night tabular-nums">{quantity}</span>
                <button type="button" onClick={() => setQty(Math.min(Math.max(1, freeNow), quantity + 1))} disabled={quantity >= freeNow} aria-label={`Fler, ${t.spots}`} className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-night hover:border-night disabled:opacity-30">
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
            </section>
          )}

          <section className="card space-y-4 p-5">
            <label htmlFor="message" className="block text-xl font-bold text-night">
              {fill(t.message, { name: hostName })}
            </label>
            <textarea id="message" rows={3} maxLength={1000} className="field-input resize-y" placeholder={t.messagePlaceholder} value={message} onChange={(e) => setMessage(e.target.value)} />
            {needName && (
              <div>
                <label htmlFor="first-name" className="field-label">
                  {t.firstName}
                </label>
                <input id="first-name" className="field-input" autoComplete="given-name" maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-6">
          <div className="card space-y-4 p-5">
            <div className="flex gap-3">
              <CoverPhoto photos={photos} className="h-16 w-16 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <p className="truncate font-bold text-night">{listing.title}</p>
                <p className="truncate text-sm text-muted">{place}</p>
              </div>
            </div>
            <div className="border-t border-line pt-4">
              <h2 className="text-lg font-bold text-night">{t.summary}</h2>
              <p className="mt-2 text-[0.95rem] text-ink">{priceLine}</p>
              {hours >= 1 && (
                <p className="text-[0.95rem] text-muted">
                  {hours === 1 ? t.oneHour : fill(t.hours, { count: hours })}
                  {quantity > 1 ? `, ${quantity} ${t.spots.toLowerCase()}` : ""}
                </p>
              )}
              <p className="mt-3 flex justify-between gap-3 border-t border-line pt-3 font-bold text-night">
                <span>{t.total}</span>
                <span className="whitespace-nowrap">{formatKr(renterTotal)} kr</span>
              </p>
              <p className="mt-1 text-sm text-muted">{t.includesFee}</p>
            </div>
            <p className="flex gap-2 rounded-xl bg-frost/70 p-3 text-sm text-ink">
              <Zap size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              {t.instant}
            </p>
            <p className="text-sm text-muted">{t.noPayment}</p>
            {error && (
              <p role="alert" className="rounded-xl bg-[#fef3f2] p-3 text-[0.95rem] font-medium text-[#b42318]">
                {error}
              </p>
            )}
            <button type="submit" disabled={!canBook} className="btn btn-primary w-full">
              {busy ? t.booking : t.book}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
