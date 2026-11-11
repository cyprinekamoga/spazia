/**
 * Stripe → Spazia, at https://<project>.supabase.co/functions/v1/stripe-webhook.
 * Two destinations in Stripe (Developers → Webhooks / Event destinations):
 *
 *  1. Your account, snapshot events, API version 2026-10-28.endive (signing secret: STRIPE_WEBHOOK_SECRET):
 *     checkout.session.completed, checkout.session.async_payment_succeeded,
 *     payment_intent.succeeded, payment_intent.payment_failed,
 *     invoice.created, invoice.paid, invoice.payment_failed, customer.subscription.deleted,
 *     charge.refunded, charge.dispute.created, radar.early_fraud_warning.created
 *  2. Your account, thin v2 events about hosts' accounts (signing secret: STRIPE_CONNECT_WEBHOOK_SECRET).
 *     v2 events for connected accounts are sent to the platform's own account scope:
 *     v2.core.account[configuration.recipient].capability_status_updated,
 *     v2.core.account[requirements].updated, v2.core.account.updated
 *
 * Deployed without JWT check (Stripe signs instead). Every handler is safe to
 * run twice: Stripe retries, and the app also checks payments itself when the
 * renter comes back from Checkout.
 */
import { Stripe } from "../_shared/deps.ts";
import { sql, stripe } from "../_shared/config.ts";
import { ACCOUNT_INCLUDE, chargeId, invoicePaid, paymentFailed, paymentSucceeded, saveCard, syncAccount } from "../_shared/payments.ts";

const cryptoProvider = Stripe.createSubtleCryptoProvider();
const id = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));
const swedishDate = (unix: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date(unix * 1000));

/** A subscription invoice (month 2 onwards): find the rental through the subscription's schedule. */
async function recordInvoice(invoice: Stripe.Invoice, paid: boolean): Promise<void> {
  const subscriptionId = id(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId || !invoice.id) return;
  const s = stripe();
  const subscription = await s.subscriptions.retrieve(subscriptionId);
  const line = invoice.lines.data[0];
  if (!line) return;
  // The charge behind the invoice, to tie the host's transfer to it.
  let intent: string | null = null;
  let charge: string | null = null;
  if (paid) {
    const payments = await s.invoicePayments.list({ invoice: invoice.id, expand: ["data.payment.payment_intent"] });
    const pi = payments.data.find((p) => p.status === "paid")?.payment.payment_intent;
    if (pi && typeof pi !== "string") {
      intent = pi.id;
      charge = chargeId(pi);
    }
  }
  const reason = paid ? "" : (invoice.last_finalization_error?.code ?? "payment_failed");
  await sql`select private.record_invoice(
    ${id(subscription.schedule)}, ${subscription.id}, ${invoice.id}, ${swedishDate(line.period.start)}::date,
    ${Math.round((invoice.amount_paid || invoice.amount_due) / 100)}, ${paid}, ${intent}, ${charge},
    ${invoice.hosted_invoice_url ?? null}, ${reason})`;
}

async function handleSnapshot(event: Stripe.Event): Promise<void> {
  const s = stripe();
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const customer = id(session.customer);
      if (session.mode === "setup" && session.setup_intent && customer) {
        const si = await s.setupIntents.retrieve(id(session.setup_intent)!);
        const pm = id(si.payment_method);
        if (si.status === "succeeded" && pm) await saveCard(customer, pm);
      } else if (session.mode === "payment" && session.payment_status === "paid" && session.metadata?.payment_id && session.payment_intent) {
        const pi = await s.paymentIntents.retrieve(id(session.payment_intent)!);
        await paymentSucceeded(session.metadata.payment_id, pi);
      }
      return;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      if (pi.metadata?.payment_id) await paymentSucceeded(pi.metadata.payment_id, pi);
      return;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      // Failed attempts inside Checkout can be retried on the spot; only off-session charges are recorded.
      if (pi.metadata?.payment_id && pi.metadata?.off_session === "true") {
        await paymentFailed(pi.metadata.payment_id, pi.last_payment_error?.code ?? pi.last_payment_error?.message ?? "failed");
      }
      return;
    }
    case "invoice.created": {
      // Monthly invoices name the place and the host, like the first month's.
      const invoice = event.data.object;
      const subscriptionId = id(invoice.parent?.subscription_details?.subscription);
      if (invoice.id && invoice.status === "draft" && subscriptionId && !invoice.description) {
        const sub = await s.subscriptions.retrieve(subscriptionId);
        if (sub.description) await s.invoices.update(invoice.id, { description: sub.description });
      }
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      if (invoice.parent?.subscription_details?.subscription) {
        await recordInvoice(invoice, true);
      } else if (invoice.id) {
        // A first month, charged by payments-worker or paid on the invoice page.
        const [p] = await sql<{ id: string }[]>`
          select id from public.payments
           where stripe_invoice = ${invoice.id}
              or (stripe_invoice is null and id::text = ${invoice.metadata?.payment_id ?? ""})
           limit 1`;
        if (p) await invoicePaid(p.id, invoice.id);
      }
      return;
    }
    case "invoice.payment_failed":
      await recordInvoice(event.data.object, false);
      return;
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const unpaid = sub.cancellation_details?.reason === "payment_failed";
      await sql`select private.subscription_ended(${id(sub.schedule)}, ${sub.id}, ${unpaid})`;
      return;
    }
    case "charge.refunded": {
      // Refunds made in Stripe's Dashboard too.
      const charge = event.data.object;
      if (charge.refunded) {
        await sql`update public.payments set status = 'refunded', refunded_at = coalesce(refunded_at, now()),
                         refund_amount = greatest(refund_amount, amount)
                   where stripe_charge = ${charge.id} and status = 'paid'`;
      }
      return;
    }
    case "charge.dispute.created": {
      const charge = id(event.data.object.charge);
      if (charge) await sql`select private.payment_disputed(${charge})`;
      console.warn(`stripe-webhook: dispute on ${charge}; the host's share is held`);
      return;
    }
    case "radar.early_fraud_warning.created": {
      const charge = id(event.data.object.charge);
      if (charge) await sql`select private.payment_disputed(${charge})`;
      console.warn(`stripe-webhook: early fraud warning on ${charge}; the host's share is held`);
      return;
    }
  }
}

/** Thin v2 events about hosts' connected accounts: fetch the account and copy its state. */
async function handleThin(notification: Stripe.V2.Core.EventNotification): Promise<void> {
  if (!notification.type.startsWith("v2.core.account") || !("related_object" in notification)) return;
  const accountId = (notification.related_object as { id?: string } | null)?.id;
  if (!accountId) return;
  await syncAccount(await stripe().v2.core.accounts.retrieve(accountId, { include: ACCOUNT_INCLUDE }));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const signature = req.headers.get("stripe-signature");
  const snapshotSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const thinSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");
  if (!signature || (!snapshotSecret && !thinSecret)) return new Response("not configured", { status: 400 });
  const body = await req.text();
  let kind: string | undefined;
  try {
    kind = (JSON.parse(body) as { object?: string }).object;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  try {
    if (kind === "v2.core.event") {
      if (!thinSecret) return new Response("not configured", { status: 400 });
      const notification = await stripe().parseEventNotificationAsync(body, signature, thinSecret, undefined, cryptoProvider);
      await handleThin(notification);
    } else {
      if (!snapshotSecret) return new Response("not configured", { status: 400 });
      let event: Stripe.Event;
      try {
        event = await stripe().webhooks.constructEventAsync(body, signature, snapshotSecret, undefined, cryptoProvider);
      } catch (err) {
        console.error("stripe-webhook: bad signature", err);
        return new Response("bad signature", { status: 400 });
      }
      await handleSnapshot(event);
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "content-type": "application/json" } });
  } catch (err) {
    if (err instanceof Error && /signature/i.test(err.message)) return new Response("bad signature", { status: 400 });
    // 500 makes Stripe retry later.
    console.error("stripe-webhook: failed", err);
    return new Response("error", { status: 500 });
  }
});
