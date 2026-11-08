/**
 * Stripe → Spazia. Two endpoints in Stripe (Developers → Webhooks), both to
 *   https://<project>.supabase.co/functions/v1/stripe-webhook
 *  - events from your account: checkout.session.completed,
 *    payment_intent.succeeded, payment_intent.payment_failed
 *    → its signing secret as STRIPE_WEBHOOK_SECRET
 *  - events from connected accounts: account.updated
 *    → its signing secret as STRIPE_CONNECT_WEBHOOK_SECRET
 * Deployed without JWT check (Stripe signs instead).
 *
 * Every handler is safe to run twice: Stripe retries, and the app also checks
 * payments itself when the renter comes back from Checkout.
 */
import { Stripe } from "../_shared/deps.ts";
import { stripe } from "../_shared/config.ts";
import { paymentFailed, paymentSucceeded, saveCard, syncAccount } from "../_shared/payments.ts";

export const EVENTS = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "account.updated",
];

const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function handle(event: Stripe.Event): Promise<void> {
  const s = stripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (session.mode === "setup" && session.setup_intent && customer) {
        const si = await s.setupIntents.retrieve(typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent.id);
        const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
        if (si.status === "succeeded" && pm) await saveCard(customer, pm);
      } else if (session.mode === "payment" && session.payment_status === "paid" && session.metadata?.payment_id && session.payment_intent) {
        const pi = await s.paymentIntents.retrieve(typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id);
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
    case "account.updated":
      await syncAccount(event.data.object);
      return;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const secrets = [Deno.env.get("STRIPE_WEBHOOK_SECRET"), Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET")].filter((s): s is string => Boolean(s));
  const signature = req.headers.get("stripe-signature");
  if (secrets.length === 0 || !signature) return new Response("not configured", { status: 400 });
  const body = await req.text();
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = await stripe().webhooks.constructEventAsync(body, signature, secret, undefined, cryptoProvider);
      break;
    } catch {
      /* try the other endpoint's secret */
    }
  }
  if (!event) {
    console.error("stripe-webhook: bad signature");
    return new Response("bad signature", { status: 400 });
  }
  try {
    await handle(event);
    return new Response(JSON.stringify({ received: true }), { headers: { "content-type": "application/json" } });
  } catch (err) {
    // 500 makes Stripe retry later.
    console.error(`stripe-webhook: ${event.type} failed`, err);
    return new Response("error", { status: 500 });
  }
});
