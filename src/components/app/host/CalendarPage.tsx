"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { appText } from "@/content/app";
import { getCategory } from "@/content/categories";
import { fill } from "@/lib/i18n";
import { fetchBlocks, fetchHostRequests, fetchListingBundle, fetchMyListings } from "@/lib/app/data";
import { formatDay, formatMonthYear, formatPeriod, overlaps, todayIso } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner, useHostSession } from "../HostShell";
import { itemsText } from "./RequestCard";

const t = appText.calendar;

function addMonths(monthIso: string, delta: number): string {
  const d = new Date(`${monthIso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta, 1);
  return d.toISOString().slice(0, 10);
}

function daysOfMonth(monthIso: string): string[] {
  const d = new Date(`${monthIso}T00:00:00Z`);
  const days: string[] = [];
  while (d.getUTCMonth() === new Date(`${monthIso}T00:00:00Z`).getUTCMonth()) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/** Monday = 0 */
function weekdayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function CalendarPage() {
  const uid = useHostSession().user.id;
  const params = useSearchParams();
  const listingsLoad = useLoad(() => fetchMyListings(uid), uid);
  const listings = (listingsLoad.data ?? []).filter((l) => l.status !== "draft");
  const [chosen, setChosen] = useState<string | null>(params.get("annons"));
  const listingId = chosen ?? listings[0]?.id ?? "";

  const detail = useLoad(async () => {
    if (!listingId) return null;
    const [bundle, blocks, requests] = await Promise.all([fetchListingBundle(listingId), fetchBlocks(listingId), fetchHostRequests(uid)]);
    return { bundle, blocks, requests: requests.filter((r) => r.listing_id === listingId && r.status === "accepted") };
  }, `${uid}:${listingId}`);

  const [month, setMonth] = useState(() => `${todayIso().slice(0, 7)}-01`);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => daysOfMonth(month), [month]);
  const monthEnd = days[days.length - 1];

  if (listingsLoad.loading) return <Spinner />;
  if (listings.length === 0) {
    return (
      <div>
        <h1 className="text-[2rem] leading-tight text-night">{t.title}</h1>
        <p className="mt-3 text-muted">{t.noListings}</p>
        <Link prefetch={false} href="/vard/annons" className="btn btn-primary mt-5">
          {appText.listings.create}
        </Link>
      </div>
    );
  }

  const data = detail.data;
  const spaces = data?.bundle?.spaces ?? [];
  const blocks = data?.blocks ?? [];
  const bookings = data?.requests ?? [];

  const blockedOn = (day: string) => blocks.find((b) => b.start_date <= day && b.end_date >= day);
  const bookingsOn = (day: string) => bookings.filter((r) => overlaps(r.start_date, r.end_date, day, day));
  /** "none", "partly" or "full": full only when every kind of space is taken that day. */
  const load = (day: string): "none" | "partly" | "full" => {
    const on = bookingsOn(day);
    if (on.length === 0 || spaces.length === 0) return "none";
    const allFull = spaces.every((s) => on.reduce((sum, r) => sum + (r.request_items.find((i) => i.category === s.category)?.quantity ?? 0), 0) >= s.capacity);
    return allFull ? "full" : "partly";
  };

  const rangeStart = start && end ? (start <= end ? start : end) : start;
  const rangeEnd = start && end ? (start <= end ? end : start) : start;
  const inRange = (day: string) => rangeStart !== null && rangeEnd !== null && day >= rangeStart && day <= rangeEnd;

  function tap(day: string) {
    if (!start || end) {
      setStart(day);
      setEnd(null);
    } else {
      setEnd(day);
    }
  }

  async function closeDays() {
    if (!rangeStart || !rangeEnd) return;
    setBusy(true);
    await supabase().from("listing_blocks").insert({ listing_id: listingId, start_date: rangeStart, end_date: rangeEnd, note: note.trim() });
    setStart(null);
    setEnd(null);
    setNote("");
    await detail.reload();
    setBusy(false);
  }

  async function reopen(blockId: string) {
    setBusy(true);
    await supabase().from("listing_blocks").delete().eq("id", blockId);
    await detail.reload();
    setBusy(false);
  }

  const selectedDay = rangeStart && rangeStart === rangeEnd ? rangeStart : null;
  const monthBookings = bookings.filter((r) => overlaps(r.start_date, r.end_date, month, monthEnd));
  const monthBlocks = blocks.filter((b) => b.end_date >= todayIso());

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[2rem] leading-tight text-night">{t.title}</h1>
        {listings.length > 1 && (
          <div>
            <label htmlFor="cal-listing" className="sr-only">
              {t.listing}
            </label>
            <select id="cal-listing" className="field-input !w-auto" value={listingId} onChange={(e) => { setChosen(e.target.value); setStart(null); setEnd(null); }}>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title || appText.listings.untitled}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between lg:max-w-[30rem]">
        <button type="button" aria-label="Föregående månad" onClick={() => setMonth(addMonths(month, -1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-line hover:border-night">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h2 className="text-xl font-bold text-night first-letter:uppercase">{formatMonthYear(month)}</h2>
        <button type="button" aria-label="Nästa månad" onClick={() => setMonth(addMonths(month, 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-line hover:border-night">
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {detail.loading ? (
        <Spinner />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,30rem)_1fr] lg:items-start lg:gap-10">
          <div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
            {t.weekdays.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: weekdayIndex(days[0]) }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const blocked = blockedOn(day);
              const share = blocked ? "none" : load(day);
              const isToday = day === todayIso();
              const selected = inRange(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => tap(day)}
                  aria-pressed={selected}
                  aria-label={`${formatDay(day)}${blocked ? `, ${t.blocked}` : ""}`}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-[0.95rem] font-semibold transition-colors ${
                    selected ? "border-night bg-night text-white" : blocked ? "border-line bg-[repeating-linear-gradient(135deg,#eef2f4,#eef2f4_6px,#dfe5e8_6px,#dfe5e8_12px)] text-muted" : share === "full" ? "border-brand bg-brand text-white" : share === "partly" ? "border-brand/50 bg-brand-soft text-night" : "border-line bg-paper text-night hover:border-night/40"
                  } ${isToday && !selected ? "ring-2 ring-glow" : ""}`}
                >
                  {Number(day.slice(8))}
                  {blocked && <Lock size={11} className="absolute bottom-1" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted">{t.selectHint}</p>
          </div>
          <div className="lg:mt-4">

          {rangeStart && (
            <div className="mt-4 card space-y-3 p-4 lg:mt-0">
              <p className="font-bold text-night">{rangeStart === rangeEnd ? formatDay(rangeStart, true) : `${formatDay(rangeStart)} – ${formatDay(rangeEnd!, true)}`}</p>
              {selectedDay && spaces.length > 0 && (
                <ul className="text-[0.95rem] text-ink">
                  {spaces.map((s) => {
                    const c = getCategory(s.category);
                    const used = bookingsOn(selectedDay).reduce((sum, r) => sum + (r.request_items.find((i) => i.category === s.category)?.quantity ?? 0), 0);
                    return (
                      <li key={s.category}>
                        {c.name.sv}: {fill(t.booked, { booked: used, capacity: s.capacity, unit: s.capacity === 1 ? c.unit.sv : c.unitPlural.sv })}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div>
                <label htmlFor="block-note" className="field-label">
                  {t.closeNote}
                </label>
                <input id="block-note" className="field-input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={closeDays} className="btn btn-primary">
                  <Lock size={16} aria-hidden="true" />
                  {t.close}
                </button>
                <button type="button" onClick={() => { setStart(null); setEnd(null); }} className="btn btn-secondary">
                  {appText.common.cancel}
                </button>
              </div>
            </div>
          )}

          <section className="mt-8">
            <h2 className="text-2xl text-night">{t.bookingsTitle}</h2>
            {monthBookings.length === 0 ? (
              <p className="mt-2 text-muted">{t.noBookings}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {monthBookings.map((r) => (
                  <li key={r.id}>
                    <Link prefetch={false} href={`/vard/forfragan?id=${r.id}`} className="card block p-4 hover:border-night/30">
                      <span className="block font-bold text-night">{r.renter?.first_name || "–"}</span>
                      <span className="block text-[0.95rem] text-ink">{itemsText(r.request_items)}</span>
                      <span className="block text-sm text-muted">{formatPeriod(r.start_date, r.end_date, appText.common.untilFurtherNotice)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-2xl text-night">{t.blocksTitle}</h2>
            {monthBlocks.length === 0 ? (
              <p className="mt-2 text-muted">{t.noBlocks}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {monthBlocks.map((b) => (
                  <li key={b.id} className="card flex items-center justify-between gap-3 p-4">
                    <span>
                      <span className="block font-semibold text-night">{b.start_date === b.end_date ? formatDay(b.start_date, true) : `${formatDay(b.start_date)} – ${formatDay(b.end_date, true)}`}</span>
                      {b.note && <span className="block text-sm text-muted">{b.note}</span>}
                    </span>
                    <button type="button" disabled={busy} onClick={() => reopen(b.id)} className="min-h-11 px-2 text-sm font-semibold text-night underline underline-offset-4">
                      {t.reopen}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </div>
        </div>
      )}
    </div>
  );
}
