/**
 * Does the payment work the database has queued: monthly charges, transfers
 * to hosts and refunds. Called by the database (private.kick_payments) every
 * 10 minutes and right after something changes, with a one-time token.
 * Deployed without JWT check; the token is the check.
 */
import { ore, sql, stripe } from "../_shared/config.ts";
import { paymentFailed, paymentSucceeded } from "../_shared/payments.ts";

const BATCH = 25;

async function validToken(token: unknown): Promise<boolean> {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false;
  const rows = await sql`delete from private.worker_tokens where token = ${token} and created_at > now() - interval '15 minutes' returning 1`;
  return rows.length === 1;
}

/** Monthly rent: charge the saved card without the renter present. */
async function charge(): Promise<number> {
  const due = await sql<{ id: string; request_id: string; amount: number; attempts: number; customer_id: string | null; payment_method: string | null; title: string; period_start: string; period_end: string }[]>`
    update public.payments p
       set status = 'processing', attempts = p.attempts + 1, due_at = now()
      from public.requests r, public.listings l
     where p.id in (
             select p2.id from public.payments p2 join public.requests r2 on r2.id = p2.request_id
              where p2.status = 'due' and p2.due_at <= now() and p2.attempts < 3
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
       and p.refund_requested_at is null and p.host_amount > 0
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
    const done = { refunds: await refund(), charges: await charge(), transfers: await transfer() };
    return new Response(JSON.stringify(done), { headers: { "content-type": "application/json" } });
  } catch (err) {
    console.error("payments-worker:", err);
    return new Response("error", { status: 500 });
  }
});
