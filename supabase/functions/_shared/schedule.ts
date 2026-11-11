/**
 * Monthly rent from the second month on, as a Stripe subscription schedule.
 * Pure: builds the parameters from the plan the database works out
 * (private.schedule_plan), so it can be tested without Deno.
 */
import type { Stripe } from "./deps.ts";

export interface SchedulePlan {
  /** When month 2 starts: midnight in Sweden, Unix seconds. */
  start: number;
  start_date: string;
  /** Renter's price for a full month, in kronor. */
  monthly: number;
  /** Full months to charge after the first (null: until further notice). */
  months: number | null;
  /** The last month of a rental with an end date, charged by the day (kronor), or null. */
  last: number | null;
  title: string;
}

const ore = (kr: number) => Math.round(kr * 100);

export function scheduleParams(
  plan: SchedulePlan,
  opts: { customer: string; paymentMethod: string | null; product: string; requestId: string; now: number },
): Stripe.SubscriptionScheduleCreateParams | null {
  const price = (kr: number) => ({ currency: "sek", product: opts.product, unit_amount: ore(kr), recurring: { interval: "month" as const } });
  const metadata = { request_id: opts.requestId };
  const phases: Stripe.SubscriptionScheduleCreateParams.Phase[] = [];

  if (plan.months === null) {
    phases.push({ items: [{ price_data: price(plan.monthly) }], metadata });
  } else {
    if (plan.months > 0) phases.push({ items: [{ price_data: price(plan.monthly) }], duration: { interval: "month", interval_count: plan.months }, metadata });
    if (plan.last) phases.push({ items: [{ price_data: price(plan.last) }], duration: { interval: "month", interval_count: 1 }, metadata });
  }
  if (phases.length === 0) return null;

  return {
    customer: opts.customer,
    // Month 2 normally starts in the future; if it has already started, bill it now.
    start_date: plan.start > opts.now + 60 ? plan.start : "now",
    end_behavior: plan.months === null ? "release" : "cancel",
    phases,
    default_settings: {
      collection_method: "charge_automatically",
      description: `Förvaring: ${plan.title}`,
      ...(opts.paymentMethod ? { default_payment_method: opts.paymentMethod } : {}),
    },
    metadata,
  };
}
