/**
 * Time helpers for visit slots. Slots are stored in UTC and always shown in
 * Swedish time, whatever the time zone of the visitor's phone. Used by the
 * Netlify Functions too, so only relative imports.
 */
export const TIME_ZONE = "Europe/Stockholm";

type Lang = "sv" | "en";

const locale = (lang: Lang) => (lang === "sv" ? "sv-SE" : "en-GB");

/** "tisdag 12 november kl. 17:00" / "Tuesday 12 November, 17:00" */
export function formatSlot(startIso: string, lang: Lang): string {
  const d = new Date(startIso);
  const day = new Intl.DateTimeFormat(locale(lang), { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(d);
  return lang === "sv" ? `${day} kl. ${formatTime(startIso, lang)}` : `${day}, ${formatTime(startIso, lang)}`;
}

/** "17:00" */
export function formatTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/** "tisdag 12 november" — the heading slots are grouped under. */
export function formatDay(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

/** "2026-11-12" in Swedish time, for grouping. */
export function stockholmDate(iso: string): string {
  const p = parts(new Date(iso));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parts(d: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, Number(x.value)]),
  );
  return values as { year: number; month: number; day: number; hour: number; minute: number };
}

/** Milliseconds Stockholm is ahead of UTC at this moment (3 600 000 or 7 200 000). */
function offsetAt(ms: number): number {
  const p = parts(new Date(ms));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60000) * 60000;
}

/** Swedish wall-clock time ("2026-11-12", "17:00") → UTC ISO string. */
export function stockholmToUtc(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  let utc = wall - offsetAt(wall);
  // Around a daylight-saving change the offset can differ at the result; correct once.
  utc = wall - offsetAt(utc);
  return new Date(utc).toISOString();
}

/** Basic iCalendar UTC timestamp, e.g. 20261112T160000Z. */
export function icsTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
