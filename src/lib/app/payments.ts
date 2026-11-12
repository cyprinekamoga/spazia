"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { must } from "./session";

export interface PaymentSetup {
  enabled: boolean;
  card: { brand: string; last4: string | null; exp: string | null } | null;
  payouts: { details_submitted: boolean; transfers_active: boolean; payouts_enabled: boolean; requirements_due: string[] } | null;
  tax_info: boolean;
}

export type PaymentStatus = "due" | "processing" | "paid" | "failed" | "refunded" | "cancelled";

export interface Payment {
  id: string;
  request_id: string;
  renter_id: string;
  host_id: string;
  period_index: number;
  period_start: string;
  period_end: string;
  amount: number;
  host_amount: number;
  status: PaymentStatus;
  pay_by: string;
  transfer_due_at: string;
  paid_at: string | null;
  transferred_at: string | null;
  refund_requested_at: string | null;
  refunded_at: string | null;
  refund_amount: number;
  failure: string;
}

export interface HostTaxInfo {
  personal_number: string;
  full_name: string;
  street_address: string;
  postal_code: string;
  city: string;
}

/** Whether payments are switched on (works without login too). */
export async function fetchPaymentsEnabled(): Promise<boolean> {
  const { data } = await supabase().rpc("payments_config");
  return Boolean((data as { enabled?: boolean } | null)?.enabled);
}

/** The signed-in user's card, payout account and tax details. */
export async function fetchPaymentSetup(): Promise<PaymentSetup> {
  return must(await supabase().rpc("my_payment_status")) as PaymentSetup;
}

export async function fetchTaxInfo(uid: string): Promise<HostTaxInfo | null> {
  return must(await supabase().from("host_tax_info").select("personal_number, full_name, street_address, postal_code, city").eq("user_id", uid).maybeSingle()) as HostTaxInfo | null;
}

export async function saveTaxInfo(uid: string, info: HostTaxInfo): Promise<void> {
  must(await supabase().from("host_tax_info").upsert({ user_id: uid, ...info, updated_at: new Date().toISOString() }));
}

export async function fetchRequestPayments(requestId: string): Promise<Payment[]> {
  return must(await supabase().from("payments").select("*").eq("request_id", requestId).order("period_index")) as Payment[];
}

export async function fetchHostPayments(uid: string): Promise<(Payment & { listing_title: string })[]> {
  const rows = must(
    await supabase()
      .from("payments")
      .select("*, request:requests(listing:listings(title))")
      .eq("host_id", uid)
      .in("status", ["paid"])
      .order("transfer_due_at", { ascending: false })
      .limit(100),
  ) as (Payment & { request: { listing: { title: string } | null } | null })[];
  return rows.map((r) => ({ ...r, listing_title: r.request?.listing?.title ?? "" }));
}

export interface Earning {
  id: string;
  request_id: string;
  host_amount: number;
  period_start: string;
  period_end: string;
  transferred_at: string;
  refunded_at: string | null;
  listing_title: string;
}

/** Everything transferred to the host (for the yearly summary), newest first. */
export async function fetchHostEarnings(uid: string): Promise<Earning[]> {
  const rows = must(
    await supabase()
      .from("payments")
      .select("id, request_id, host_amount, period_start, period_end, transferred_at, refunded_at, request:requests(listing:listings(title))")
      .eq("host_id", uid)
      .not("transferred_at", "is", null)
      .order("transferred_at", { ascending: false })
      .limit(5000),
  ) as unknown as (Omit<Earning, "listing_title"> & { request: { listing: { title: string } | null } | null })[];
  return rows.map(({ request, ...r }) => ({ ...r, listing_title: request?.listing?.title ?? "" }));
}

export class PaymentsError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Call the payments Edge Function. Throws PaymentsError with the server's code. */
export async function paymentsCall<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase().functions.invoke("payments", { body: { action, ...body } });
  if (error) {
    let code = "server_error";
    if (error instanceof FunctionsHttpError) {
      try {
        code = ((await error.context.json()) as { error?: string }).error ?? code;
      } catch {
        /* not JSON */
      }
    }
    throw new PaymentsError(code);
  }
  return data as T;
}

/** Go to a Stripe page (Checkout, onboarding or the payout dashboard). */
export async function goToStripe(action: string, body: Record<string, unknown> = {}): Promise<void> {
  const { url } = await paymentsCall<{ url: string }>(action, body);
  window.location.assign(url);
}

/**
 * Swedish personal identity number → 12 digits (ÅÅÅÅMMDDNNNN), or null if it
 * isn't valid. Accepts 10 or 12 digits, with or without "-" (or "+" for 100+).
 */
export function normalizePersonalNumber(input: string): string | null {
  const raw = input.trim();
  const plus = raw.includes("+");
  const digits = raw.replace(/[^0-9]/g, "");
  let full: string;
  if (digits.length === 12) full = digits;
  else if (digits.length === 10) {
    const yy = Number(digits.slice(0, 2));
    const now = new Date().getFullYear();
    let century = Math.floor(now / 100) * 100;
    if (century + yy > now) century -= 100;
    if (plus) century -= 100;
    full = `${century + yy}`.padStart(4, "0") + digits.slice(2);
  } else return null;
  if (!/^(19|20)\d{10}$/.test(full)) return null;
  const month = Number(full.slice(4, 6));
  const day = Number(full.slice(6, 8));
  // Coordination numbers add 60 to the day.
  if (month < 1 || month > 12 || !((day >= 1 && day <= 31) || (day >= 61 && day <= 91))) return null;
  // Luhn check on the last 10 digits.
  const ten = full.slice(2);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let n = Number(ten[i]) * (i % 2 === 0 ? 2 : 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0 ? full : null;
}

export function formatPersonalNumber(full: string): string {
  return full.length === 12 ? `${full.slice(0, 8)}-${full.slice(8)}` : full;
}

/** "Visa", "Mastercard" … for card brands from Stripe. */
export function cardBrand(brand: string): string {
  const names: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", maestro: "Maestro" };
  return names[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}
