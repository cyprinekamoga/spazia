import { getCategory, type CategoryId } from "@/content/categories";
import { FEES } from "@/content/pricing";

/* ---------- Rows (mirror supabase/migrations/20261105000000_host_app.sql) ---------- */

export type SpaceType = "garage" | "carport" | "driveway" | "basement" | "outbuilding" | "attic" | "barn" | "other";
export type Heated = "yes" | "frostfree" | "no";
export type Feature = "lockable" | "lighting" | "power" | "engine_heater" | "alarm" | "ground_floor" | "drive_up";
export type Access = "anytime" | "by_appointment" | "set_times";
export type MinPeriod = "none" | "week" | "month";
export type ListingStatus = "draft" | "published" | "paused";
export type RequestStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export const SPACE_TYPES: SpaceType[] = ["garage", "carport", "driveway", "basement", "outbuilding", "attic", "barn", "other"];
export const FEATURES: Feature[] = ["lockable", "lighting", "power", "engine_heater", "alarm", "ground_floor", "drive_up"];
export const ACCESS: Access[] = ["anytime", "by_appointment", "set_times"];
export const MIN_PERIODS: MinPeriod[] = ["none", "week", "month"];

export interface Profile {
  id: string;
  first_name: string;
  about: string;
  avatar_url: string | null;
  created_at: string;
}

export interface ProfilePrivate {
  id: string;
  last_name: string;
  phone: string;
}

export interface Listing {
  id: string;
  host_id: string;
  status: ListingStatus;
  space_type: SpaceType | null;
  title: string;
  description: string;
  city: string;
  area_name: string;
  size_m2: number | null;
  heated: Heated | null;
  features: Feature[];
  access: Access | null;
  access_notes: string;
  min_period: MinPeriod;
  rules: string;
  wizard_step: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface ListingPrivate {
  listing_id: string;
  street_address: string;
  postal_code: string;
  access_instructions: string;
}

export interface ListingSpace {
  id: string;
  listing_id: string;
  category: CategoryId;
  capacity: number;
  /** Null when a parking space is only let by the hour. */
  host_price_month: number | null;
  /** Parking only: host price per hour, and the most it costs per 24 hours. */
  hourly_price?: number | null;
  daily_max?: number | null;
  /** Bookable hours each day (local time, 0–24) and weekdays (1 = Monday). */
  hourly_from?: number;
  hourly_to?: number;
  hourly_days?: number[];
}

export interface ListingPhoto {
  id: string;
  listing_id: string;
  path: string;
  position: number;
}

export interface ListingBlock {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  note: string;
}

export interface RequestItem {
  category: CategoryId;
  quantity: number;
  host_price_month: number | null;
  hourly_price?: number | null;
  daily_max?: number | null;
}

export interface RequestRow {
  id: string;
  listing_id: string;
  conversation_id: string;
  host_id: string;
  renter_id: string;
  start_date: string;
  end_date: string | null;
  message: string;
  status: RequestStatus;
  decline_reason: string;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  /** "month": a request for a period; "hour": a direct hourly parking booking. */
  kind?: "month" | "hour";
  start_at?: string | null;
  end_at?: string | null;
  /** Hourly bookings: the host's price for the whole booking, before fees. */
  host_total?: number | null;
  /** Who cancelled (host or renter), when, and the message they left. */
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string;
  /** Payments: whether this rental is paid through Spazia, and up to which day. */
  payment_required?: boolean;
  paid_through?: string | null;
  ended_by?: string | null;
  ended_at?: string | null;
  /** Rental agreement: the version the renter accepted, when each side accepted, and the frozen deal. */
  agreement_version?: string | null;
  renter_agreed_at?: string | null;
  host_agreed_at?: string | null;
  agreement?: AgreementSnapshot | null;
  request_items: RequestItem[];
}

/** The deal as it stood when the host accepted (private.agreement_snapshot). */
export interface AgreementSnapshot {
  kind: "month" | "hour";
  start_date: string;
  end_date: string | null;
  start_at: string | null;
  end_at: string | null;
  payment_required: boolean | null;
  host_first_name: string | null;
  renter_first_name: string | null;
  listing: {
    title: string;
    space_type: string | null;
    city: string;
    area_name: string;
    size_m2: number | null;
    heated: string | null;
    features: string[] | null;
    access: string | null;
    access_notes: string | null;
    min_period: string | null;
    rules: string | null;
  };
  items: { category: CategoryId; quantity: number; host_price_month: number | null; hourly_price: number | null; daily_max: number | null }[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: "text" | "event";
  body: string;
  created_at: string;
}

/* ---------- Money ---------- */

/** What the renter pays per unit and month for a host price (service fee on top). */
export function renterPrice(hostPrice: number): number {
  // Whole-number maths, so it rounds exactly like the database (private.renter_price).
  return Math.round((hostPrice * Math.round((1 + FEES.renterServiceFee) * 100)) / 100);
}

/** What the host receives per unit and month (Spazia's fee deducted). */
export function hostPayout(hostPrice: number): number {
  return Math.round((hostPrice * Math.round((1 - FEES.hostFee) * 100)) / 100);
}

/** A host price that gives renters our guide price, rounded to 5 kr. */
export function suggestedHostPrice(category: CategoryId): number {
  return Math.max(10, Math.round(getCategory(category).price / (1 + FEES.renterServiceFee) / 5) * 5);
}

/** Host's monthly income from a request, after Spazia's fee (hourly items count 0). */
export function requestIncome(items: RequestItem[]): number {
  return items.reduce((sum, i) => sum + (i.host_price_month ? hostPayout(i.host_price_month) * i.quantity : 0), 0);
}

export function formatKr(amount: number): string {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(amount);
}

/* ---------- Dates (date-only strings, YYYY-MM-DD) ---------- */

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDay(iso: string, withYear = false): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatPeriod(start: string, end: string | null, untilFurtherNotice: string): string {
  return end ? `${formatDay(start)} – ${formatDay(end, true)}` : `${formatDay(start)} – ${untilFurtherNotice}`;
}

export function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`));
}

/** "23 h" or "45 min" left until a timestamp. */
export function timeLeft(isoTimestamp: string, now = Date.now()): string {
  const ms = Date.parse(isoTimestamp) - now;
  if (ms <= 0) return "0 min";
  const hours = Math.floor(ms / 3600_000);
  return hours >= 1 ? `${hours} h` : `${Math.max(1, Math.round(ms / 60_000))} min`;
}

/** A pending request past its 24 hours counts as expired, even before the database says so. */
/* ---------- Cancelling (the database enforces the same rules) ---------- */

/** Hourly parking: the renter can cancel free of charge until this many hours before the start. */
export const FREE_CANCEL_HOURS = 1;

type CancelFields = Pick<RequestRow, "status" | "kind" | "start_at">;

/** When the renter's free cancellation ends (ms), for hourly bookings. */
export function renterCancelDeadline(r: Pick<RequestRow, "start_at">): number | null {
  return r.start_at ? Date.parse(r.start_at) - FREE_CANCEL_HOURS * 3_600_000 : null;
}

/** Whether the renter can still cancel: monthly any time while active, hourly until 1 hour before the start. */
export function renterCanCancel(r: CancelFields, now = Date.now()): boolean {
  if (r.status !== "pending" && r.status !== "accepted") return false;
  if (r.kind !== "hour") return true;
  const deadline = renterCancelDeadline(r);
  return deadline !== null && now <= deadline;
}

/** Whether the host can still cancel: monthly any time while accepted, hourly until the start. */
export function hostCanCancel(r: CancelFields, now = Date.now()): boolean {
  if (r.status !== "accepted") return false;
  return r.kind !== "hour" || (r.start_at != null && now < Date.parse(r.start_at));
}

/** Clock time in Swedish time, e.g. "tis 10 nov. 07:00". */
export function formatMoment(iso: string | number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function effectiveStatus(r: Pick<RequestRow, "status" | "expires_at">, now = Date.now()): RequestStatus {
  return r.status === "pending" && Date.parse(r.expires_at) < now ? "expired" : r.status;
}

/** Whether two date ranges overlap (end null = open-ended). */
export function overlaps(aStart: string, aEnd: string | null, bStart: string, bEnd: string | null): boolean {
  return aStart <= (bEnd ?? "9999-12-31") && (aEnd ?? "9999-12-31") >= bStart;
}

/* ---------- Renter side ---------- */

export type AppMode = "host" | "renter";

/** What the renter pays per month for a request (service fee included). */
export function renterMonthly(items: Pick<RequestItem, "quantity" | "host_price_month">[]): number {
  return items.reduce((sum, i) => sum + (i.host_price_month ? renterPrice(i.host_price_month) * i.quantity : 0), 0);
}

/* ---------- Hourly parking (mirrors private.parking_host_total) ---------- */

export const TIME_ZONE = "Europe/Stockholm";

/** The host's price for a number of hours: per hour, but at most daily_max per 24 hours. */
export function hourlyHostTotal(hours: number, hourly: number, dailyMax: number | null | undefined, quantity = 1): number {
  const cap = (h: number) => Math.min(h * hourly, dailyMax ?? h * hourly);
  return (Math.floor(hours / 24) * cap(24) + cap(hours % 24)) * Math.max(1, quantity);
}

/**
 * What the renter pays for hours of parking: the same rule on the prices the
 * renter sees (per hour and per day, service fee included), so the total adds up.
 */
export function renterHourlyTotal(hours: number, hourly: number, dailyMax: number | null | undefined, quantity = 1): number {
  return hourlyHostTotal(hours, renterPrice(hourly), dailyMax != null ? renterPrice(dailyMax) : null, quantity);
}

/** Whole hours in an hourly booking. */
export function bookingHours(r: Pick<RequestRow, "start_at" | "end_at">): number {
  return r.start_at && r.end_at ? Math.round((Date.parse(r.end_at) - Date.parse(r.start_at)) / 3_600_000) : 0;
}

/** "14:00" style hour label (24 = midnight at the end of the day). */
export function hourLabel(h: number): string {
  return `${String(h % 24).padStart(2, "0")}:00`;
}

/** Bookable hours as text: "Dygnet runt, alla dagar" or "Mån–fre 07:00–18:00". */
export function hoursText(space: Pick<ListingSpace, "hourly_from" | "hourly_to" | "hourly_days">): string {
  const from = space.hourly_from ?? 0;
  const to = space.hourly_to ?? 24;
  const days = [...(space.hourly_days ?? [1, 2, 3, 4, 5, 6, 7])].sort();
  const names = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"];
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const dayText =
    days.length === 7 ? "alla dagar" : contiguous && days.length > 2 ? `${names[days[0] - 1]}–${names[days[days.length - 1] - 1]}` : days.map((d) => names[d - 1]).join(", ");
  const timeText = from === 0 && to === 24 ? "dygnet runt" : `${hourLabel(from)}–${hourLabel(to)}`;
  const text = `${timeText}, ${dayText}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "12 nov. 14:00–17:00" or "12 nov. 14:00 – 14 nov. 10:00", in Swedish time. */
export function formatTimeRange(startIso: string, endIso: string): string {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay = day.format(s) === day.format(new Date(e.getTime() - 1000));
  return sameDay ? `${day.format(s)} ${time.format(s)}–${time.format(e)}` : `${day.format(s)} ${time.format(s)} – ${day.format(e)} ${time.format(e)}`;
}

/** Period text for any request: dates for monthly, times for hourly bookings. */
export function periodText(r: Pick<RequestRow, "start_date" | "end_date" | "kind" | "start_at" | "end_at">, untilFurtherNotice: string): string {
  return r.kind === "hour" && r.start_at && r.end_at ? formatTimeRange(r.start_at, r.end_at) : formatPeriod(r.start_date, r.end_date, untilFurtherNotice);
}

/** Lowest price a renter sees for a listing: monthly if offered, otherwise hourly. */
export function fromPrice(spaces: Pick<ListingSpace, "host_price_month" | "hourly_price">[]): { amount: number; per: "month" | "hour" } | null {
  const monthly = spaces.filter((s) => s.host_price_month).map((s) => renterPrice(s.host_price_month!));
  if (monthly.length) return { amount: Math.min(...monthly), per: "month" };
  const hourly = spaces.filter((s) => s.hourly_price).map((s) => renterPrice(s.hourly_price!));
  return hourly.length ? { amount: Math.min(...hourly), per: "hour" } : null;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Earliest end date the host accepts for a start date (mirrors create_request). */
export function minEndDate(start: string, minPeriod: MinPeriod): string {
  if (minPeriod === "week") return addDays(start, 6);
  if (minPeriod === "month") {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return addDays(d.toISOString().slice(0, 10), -1);
  }
  return start;
}

/** A rental is current from its start until its end (or forever). */
export function isCurrent(r: Pick<RequestRow, "start_date" | "end_date">, today: string): boolean {
  return r.start_date <= today && (r.end_date === null || r.end_date >= today);
}

/** Whether an accepted rental or booking is still running or ahead. */
export function isActive(r: Pick<RequestRow, "end_date" | "kind" | "end_at">, today: string, now = Date.now()): boolean {
  if (r.kind === "hour" && r.end_at) return Date.parse(r.end_at) > now;
  return r.end_date === null || r.end_date >= today;
}
