"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatDay, formatTime, stockholmDate, stockholmToUtc } from "@/lib/time";
import { api, type AdminData, type AdminSlot } from "./api";

/** Add days to a YYYY-MM-DD date (calendar arithmetic, no time zones involved). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function hhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function SlotsTab({ data, onChange }: { data: AdminData; onChange: () => Promise<void> }) {
  const today = stockholmDate(new Date(data.now).toISOString());
  const [date, setDate] = useState(() => addDays(today, 1));
  const [from, setFrom] = useState("17:00");
  const [to, setTo] = useState("19:00");
  const [length, setLength] = useState(60);
  const [weeks, setWeeks] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const planned = useMemo(() => {
    const out: { start: string; end: string }[] = [];
    if (!date || minutes(to) <= minutes(from)) return out;
    for (let w = 0; w < weeks; w++) {
      const day = addDays(date, w * 7);
      for (let m = minutes(from); m + length <= minutes(to); m += length) {
        out.push({ start: stockholmToUtc(day, hhmm(m)), end: stockholmToUtc(day, hhmm(m + length)) });
      }
    }
    return out.filter((s) => Date.parse(s.start) > data.now);
  }, [date, from, to, length, weeks, data.now]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (planned.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      await api("/slots", { method: "POST", body: { slots: planned } });
      setMessage(`${planned.length} tider tillagda.`);
      await onChange();
    } catch {
      setMessage("Kunde inte lägga till tiderna.");
    }
    setBusy(false);
  }

  const now = data.now;
  const upcoming = data.slots.filter((s) => Date.parse(s.end) > now);
  const past = data.slots.filter((s) => Date.parse(s.end) <= now).reverse();

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      <form onSubmit={add} className="card h-fit space-y-4 p-5">
        <h2 className="text-2xl text-night">Lägg till tider</h2>
        <p className="text-sm leading-relaxed text-muted">Värdar i Luleå kan boka de här tiderna direkt efter anmälan och via länken i bekräftelsemejlet. Tiderna är i svensk tid.</p>
        <div>
          <label htmlFor="slot-date" className="field-label">
            Datum
          </label>
          <input id="slot-date" type="date" className="field-input" value={date} min={today} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="slot-from" className="field-label">
              Från
            </label>
            <input id="slot-from" type="time" className="field-input" value={from} step={900} onChange={(e) => setFrom(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="slot-to" className="field-label">
              Till
            </label>
            <input id="slot-to" type="time" className="field-input" value={to} step={900} onChange={(e) => setTo(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="slot-length" className="field-label">
              Per besök
            </label>
            <select id="slot-length" className="field-input" value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {[30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="slot-weeks" className="field-label">
              Upprepa
            </label>
            <select id="slot-weeks" className="field-input" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              <option value={1}>En gång</option>
              {[2, 3, 4, 6, 8].map((w) => (
                <option key={w} value={w}>
                  {w} veckor
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={busy || planned.length === 0}>
          {planned.length === 0 ? "Inga tider att lägga till" : `Lägg till ${planned.length} ${planned.length === 1 ? "tid" : "tider"}`}
        </button>
        {message && (
          <p className="text-sm font-medium text-night" role="status">
            {message}
          </p>
        )}
      </form>

      <div>
        <h2 className="text-2xl text-night">Kommande tider</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-muted">Inga tider än. Lägg till några så kan värdarna i Luleå boka besök själva.</p>
        ) : (
          <SlotList slots={upcoming} onChange={onChange} />
        )}
        {past.length > 0 && (
          <details className="mt-8">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold text-night">Tidigare tider (30 dagar)</summary>
            <SlotList slots={past} onChange={onChange} past />
          </details>
        )}
      </div>
    </div>
  );
}

function SlotList({ slots, onChange, past = false }: { slots: AdminSlot[]; onChange: () => Promise<void>; past?: boolean }) {
  const groups = new Map<string, AdminSlot[]>();
  for (const s of slots) {
    const key = stockholmDate(s.start);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  async function remove(s: AdminSlot) {
    const text = s.booking
      ? `Tiden är bokad av ${s.booking.name}. Ta bort den ändå? ${s.booking.name} får ett mejl om att välja en ny tid.`
      : "Ta bort den här tiden?";
    if (!window.confirm(text)) return;
    await api(`/slots/${encodeURIComponent(s.id)}?notify=1`, { method: "DELETE" });
    await onChange();
  }

  return (
    <div className="mt-3 space-y-4">
      {[...groups.values()].map((day) => (
        <div key={day[0].id}>
          <p className="text-sm font-semibold text-muted first-letter:uppercase">{formatDay(day[0].start, "sv")}</p>
          <ul className="mt-1.5 divide-y divide-line rounded-2xl border border-line bg-paper">
            {day.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="font-semibold text-night">
                    {formatTime(s.start, "sv")}–{formatTime(s.end, "sv")}
                  </span>
                  {s.booking ? (
                    <span className="block text-[0.95rem] text-ink">
                      <span className="font-semibold text-pine">Bokad</span> av {s.booking.name}, {s.booking.address}, {s.booking.phone}
                      {s.booking.note ? <span className="block text-muted">{s.booking.note}</span> : null}
                    </span>
                  ) : (
                    <span className="block text-[0.95rem] text-muted">Ledig</span>
                  )}
                </span>
                {!past && (
                  <button type="button" className="self-start text-sm font-semibold text-[#b42318] underline underline-offset-4 sm:self-center" onClick={() => remove(s)}>
                    {s.booking ? "Avboka och ta bort" : "Ta bort"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
