/**
 * Monthly rent from the second month on, as a Stripe subscription schedule.
 * Pure: builds the parameters from the plan the database works out
 * (private.schedule_plan), so it can be tested without Deno.
 *
 * Every month has two lines, VAT included: the host's rent (no VAT from
 * Spazia, passed on in the host's name) and Spazia's service fee (25 % VAT),
 * plus a third for Spazia Skydd when the renter chose it.
 */
import type { Stripe } from "./deps.ts";

export interface SchedulePlan {
  /** When month 2 starts: midnight in Sweden, Unix seconds. */
  start: number;
  start_date: string;
  /** Renter's price for a full month, and the rent part of it, in kronor. */
  monthly: number;
  monthly_base: number;
  /** Full months to charge after the first (null: until further notice). */
  months: number | null;
  /** The last month of a rental with an end date, charged by the day (kronor), or null. */
  last: number | null;
  last_base: number | null;
  /** Spazia Skydd's part of a full month and of the last month (0 or missing: not chosen). */
  monthly_protection?: number | null;
  last_protection?: number | null;
  title: string;
  host_name: string | null;
}

const ore = (kr: number) => Math.round(kr * 100);

export function scheduleParams(
  plan: SchedulePlan,
  opts: {
    customer: string;
    paymentMethod: string | null;
    products: { rent: string; fee: string; protection?: string };
    requestId: string;
    now: number;
    automaticTax?: { enabled: true; liability: { type: "self" } };
  },
): Stripe.SubscriptionScheduleCreateParams | null {
  const price = (product: string, kr: number) => ({
    currency: "sek",
    product,
    unit_amount: ore(kr),
    tax_behavior: "inclusive" as const,
    recurring: { interval: "month" as const },
  });
  // Rent, Spazia's fee and (if chosen) Spazia Skydd for one month.
  const items = (total: number, rent: number, protection = 0) => {
    const base = Math.min(rent, total);
    const prot = opts.products.protection ? Math.max(0, Math.min(protection, total - base)) : 0;
    return [
      ...(base > 0 ? [{ price_data: price(opts.products.rent, base) }] : []),
      ...(total - base - prot > 0 ? [{ price_data: price(opts.products.fee, total - base - prot) }] : []),
      ...(prot > 0 ? [{ price_data: price(opts.products.protection!, prot) }] : []),
    ];
  };
  const metadata = { request_id: opts.requestId };
  const phases: Stripe.SubscriptionScheduleCreateParams.Phase[] = [];

  if (plan.months === null) {
    phases.push({ items: items(plan.monthly, plan.monthly_base, plan.monthly_protection ?? 0), metadata });
  } else {
    if (plan.months > 0)
      phases.push({ items: items(plan.monthly, plan.monthly_base, plan.monthly_protection ?? 0), duration: { interval: "month", interval_count: plan.months }, metadata });
    if (plan.last) phases.push({ items: items(plan.last, plan.last_base ?? 0, plan.last_protection ?? 0), duration: { interval: "month", interval_count: 1 }, metadata });
  }
  if (phases.length === 0 || phases.some((p) => p.items.length === 0)) return null;

  return {
    customer: opts.customer,
    // Month 2 normally starts in the future; if it has already started, bill it now.
    start_date: plan.start > opts.now + 60 ? plan.start : "now",
    end_behavior: plan.months === null ? "release" : "cancel",
    phases,
    default_settings: {
      collection_method: "charge_automatically",
      description: `Förvaring: ${plan.title}${plan.host_name ? `, värd: ${plan.host_name}` : ""}`,
      ...(opts.paymentMethod ? { default_payment_method: opts.paymentMethod } : {}),
      ...(opts.automaticTax ? { automatic_tax: opts.automaticTax } : {}),
    },
    metadata,
  };
}
