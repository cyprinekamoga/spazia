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
  host_price_month: number;
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
  host_price_month: number;
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
  request_items: RequestItem[];
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
  return Math.round(hostPrice * (1 + FEES.renterServiceFee));
}

/** What the host receives per unit and month (Spazia's fee deducted). */
export function hostPayout(hostPrice: number): number {
  return Math.round(hostPrice * (1 - FEES.hostFee));
}

/** A host price that gives renters our guide price, rounded to 5 kr. */
export function suggestedHostPrice(category: CategoryId): number {
  return Math.max(10, Math.round(getCategory(category).price / (1 + FEES.renterServiceFee) / 5) * 5);
}

/** Host's monthly income from a request, after Spazia's fee. */
export function requestIncome(items: RequestItem[]): number {
  return items.reduce((sum, i) => sum + hostPayout(i.host_price_month) * i.quantity, 0);
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
  return items.reduce((sum, i) => sum + renterPrice(i.host_price_month) * i.quantity, 0);
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
