/**
 * Does the payment work the database has queued: first-month charges, Stripe
 * subscription schedules for the months after, transfers to hosts and refunds. Called by the database (private.kick_payments) every
 * 10 minutes and right after something changes, with a one-time token.
 * Deployed without JWT check; the token is the check.
 */
import { ore, sql, stripe } from "../_shared/config.ts";
import { ensureCustomer, getUser, paymentFailed, paymentSucceeded, storageProduct } from "../_shared/payments.ts";
import { scheduleParams, type SchedulePlan } from "../_shared/schedule.ts";

const BATCH = 25;

async function validToken(token: unknown): Promise<boolean> {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false;
  const rows = await sql`delete from private.worker_tokens where token = ${token} and created_at > now() - interval '15 minutes' returning 1`;
  return rows.length === 1;
}

/** The first month: charge the saved card without the renter present. Later months are Stripe Billing's. */
async function charge(): Promise<number> {
  const due = await sql<{ id: string; request_id: string; amount: number; attempts: number; customer_id: string | null; payment_method: string | null; title: string; period_start: string; period_end: string }[]>`
    update public.payments p
       set status = 'processing', attempts = p.attempts + 1, due_at = now()
      from public.requests r, public.listings l
     where p.id in (
             select p2.id from public.payments p2 join public.requests r2 on r2.id = p2.request_id
              where p2.status = 'due' and p2.due_at <= now() and p2.attempts < 3 and p2.stripe_invoice is null
                and r2.kind = 'month' and r2.status = 'accepted'
              order by p2.due_at limit ${BATCH} for update of p2 skip locked)
       and r.id = p.request_id and l.id = r.listing_id
    returning p.id, p.request_id, p.amount, p.attempts,
              (select c.customer_id from private.stripe_customers c where c.user_id = p.renter_id) as customer_id,
              (select c.payment_method from private.stripe_customers c where c.user_id = p.renter_id) as payment_method,
              l.title, p.period_start::text as period_start, p.period_end::text as period_end`;
  for (const p of due) {
    if (!p.customer_id || !p.payment_method) {
      await paymentFailed(p.id, "no_card");
      continue;
    }
    const what = `Förvaring: ${p.title} (${p.period_start} – ${p.period_end})`;
    try {
      const pi = await stripe().paymentIntents.create(
        {
          amount: ore(p.amount),
          currency: "sek",
          customer: p.customer_id,
          payment_method: p.payment_method,
          off_session: true,
          confirm: true,
          description: what,
          transfer_group: p.request_id,
          metadata: { payment_id: p.id, request_id: p.request_id, off_session: "true" },
        },
        { idempotencyKey: `charge-${p.id}-${p.attempts}` },
      );
      if (pi.status === "succeeded") await paymentSucceeded(p.id, pi);
      else if (pi.status !== "processing") await paymentFailed(p.id, pi.status);
    } catch (err) {
      // Declined, or the bank wants the renter to confirm (3-D Secure): the renter gets a link.
      const e = err as { code?: string; decline_code?: string; message?: string };
      await paymentFailed(p.id, e.decline_code ?? e.code ?? e.message ?? "failed");
    }
  }
  return due.length;
}

/** The host's share, 24 hours after the period starts. Stripe pays it out on Mondays. */
async function transfer(): Promise<number> {
  const due = await sql<{ id: string; request_id: string; host_amount: number; stripe_charge: string | null; account_id: string }[]>`
    select p.id, p.request_id, p.host_amount, p.stripe_charge, a.account_id
      from public.payments p
      join private.stripe_accounts a on a.user_id = p.host_id and a.transfers_active
     where p.status = 'paid' and p.transfer_due_at <= now() and p.stripe_transfer is null
       and p.refund_requested_at is null and p.disputed_at is null and p.host_amount > 0
     order by p.transfer_due_at limit ${BATCH}`;
  for (const p of due) {
    try {
      const t = await stripe().transfers.create(
        {
          amount: ore(p.host_amount),
          currency: "sek",
          destination: p.account_id,
          transfer_group: p.request_id,
          ...(p.stripe_charge ? { source_transaction: p.stripe_charge } : {}),
          metadata: { payment_id: p.id, request_id: p.request_id },
        },
        { idempotencyKey: `transfer-${p.id}` },
      );
      await sql`update public.payments set stripe_transfer = ${t.id}, transferred_at = now() where id = ${p.id}`;
    } catch (err) {
      console.error("payments-worker: transfer", p.id, err);
    }
  }
  return due.length;
}

/**
 * Monthly rentals: set up the Stripe subscription schedule once the first month
 * is paid, and stop it when the rental is cancelled or ended.
 */
async function syncSchedules(): Promise<number> {
  const due = await sql<{ id: string; renter_id: string; status: string; paid_through: string | null; end_date: string | null; ended_at: Date | null; stripe_schedule: string | null }[]>`
    select id, renter_id, status::text as status, paid_through::text as paid_through, end_date::text as end_date, ended_at, stripe_schedule
      from public.requests
     where stripe_sync_needed and kind = 'month'
     order by created_at limit ${BATCH}`;
  const s = stripe();
  for (const r of due) {
    try {
      const active = r.status === "accepted" && r.paid_through && !r.ended_at && (!r.end_date || r.end_date > r.paid_through);
      if (!r.stripe_schedule && active) {
        const [{ plan }] = await sql<{ plan: SchedulePlan | null }[]>`select private.schedule_plan(${r.id}::uuid) as plan`;
        const user = await getUser(r.renter_id);
        if (plan && user) {
          const customer = await ensureCustomer(user);
          const [card] = await sql<{ payment_method: string | null }[]>`select payment_method from private.stripe_customers where user_id = ${r.renter_id}`;
          const params = scheduleParams(plan, {
            customer,
            paymentMethod: card?.payment_method ?? null,
            product: await storageProduct(),
            requestId: r.id,
            now: Math.floor(Date.now() / 1000),
          });
          if (params) {
            const schedule = await s.subscriptionSchedules.create(params, { idempotencyKey: `schedule-${r.id}` });
            await sql`update public.requests set stripe_schedule = ${schedule.id} where id = ${r.id}`;
          }
        }
      } else if (r.stripe_schedule && !active) {
        // Cancelled before the start, or ended: no more monthly charges after the paid period.
        const schedule = await s.subscriptionSchedules.retrieve(r.stripe_schedule);
        if (schedule.status === "not_started") {
          await s.subscriptionSchedules.cancel(schedule.id);
        } else {
          const subscription = typeof schedule.subscription === "string" ? schedule.subscription : schedule.subscription?.id;
          if (schedule.status === "active") await s.subscriptionSchedules.release(schedule.id);
          if (subscription) {
            const sub = await s.subscriptions.retrieve(subscription);
            if (sub.status !== "canceled") {
              if (r.status === "cancelled") await s.subscriptions.cancel(sub.id);
              else await s.subscriptions.update(sub.id, { cancel_at_period_end: true });
            }
          }
        }
      }
      await sql`update public.requests set stripe_sync_needed = false where id = ${r.id}`;
    } catch (err) {
      console.error("payments-worker: schedule", r.id, err);
    }
  }
  return due.length;
}

/** Refunds the database asked for (cancellations before the start, late payments). */
async function refund(): Promise<number> {
  const due = await sql<{ id: string; refund_amount: number; host_amount: number; stripe_payment_intent: string | null; stripe_transfer: string | null }[]>`
    select id, refund_amount, host_amount, stripe_payment_intent, stripe_transfer
      from public.payments
     where status = 'paid' and refund_requested_at is not null and refunded_at is null
     order by refund_requested_at limit ${BATCH}`;
  for (const p of due) {
    if (!p.stripe_payment_intent) continue;
    try {
      const s = stripe();
      if (p.stripe_transfer) {
        await s.transfers.createReversal(p.stripe_transfer, { amount: ore(p.host_amount) }, { idempotencyKey: `reverse-${p.id}` });
      }
      const r = await s.refunds.create(
        { payment_intent: p.stripe_payment_intent, amount: ore(p.refund_amount), metadata: { payment_id: p.id } },
        { idempotencyKey: `refund-${p.id}` },
      );
      await sql`update public.payments set status = 'refunded', refunded_at = now(), stripe_refund = ${r.id} where id = ${p.id}`;
    } catch (err) {
      console.error("payments-worker: refund", p.id, err);
    }
  }
  return due.length;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const body = await req.json().catch(() => ({}));
  if (!(await validToken((body as { token?: unknown }).token))) return new Response("forbidden", { status: 403 });
  try {
    const done = { refunds: await refund(), charges: await charge(), schedules: await syncSchedules(), transfers: await transfer() };
    return new Response(JSON.stringify(done), { headers: { "content-type": "application/json" } });
  } catch (err) {
    console.error("payments-worker:", err);
    return new Response("error", { status: 500 });
  }
});
