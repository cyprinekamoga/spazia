/**
 * Operations shared by the payment functions. The database decides what is
 * owed and when (supabase/migrations/2026111*_payments*.sql); these functions
 * talk to Stripe and record the result.
 */
import type { Stripe } from "./deps.ts";
import { sql, stripe } from "./config.ts";

export interface UserRow {
  id: string;
  email: string | null;
  first_name: string;
}

/**
 * Text at the bottom of every Stripe invoice and receipt. Spazia is below the
 * VAT threshold, so no VAT is charged. Override with INVOICE_FOOTER.
 */
export const INVOICE_FOOTER = Deno.env.get("INVOICE_FOOTER") ?? "Momsbefriad. Spazia omfattas av undantaget från mervärdesskatt för små företag.";

export async function getUser(userId: string): Promise<UserRow | null> {
  const [row] = await sql<UserRow[]>`
    select u.id, u.email, coalesce(p.first_name, '') as first_name
      from auth.users u left join public.profiles p on p.id = u.id
     where u.id = ${userId}`;
  return row ?? null;
}

/** The renter's Stripe customer, created the first time it's needed. */
export async function ensureCustomer(user: UserRow): Promise<string> {
  const [existing] = await sql<{ customer_id: string }[]>`select customer_id from private.stripe_customers where user_id = ${user.id}`;
  if (existing) return existing.customer_id;
  const customer = await stripe().customers.create(
    {
      email: user.email ?? undefined,
      name: user.first_name || undefined,
      metadata: { user_id: user.id },
      preferred_locales: ["sv"],
      invoice_settings: { footer: INVOICE_FOOTER },
    },
    { idempotencyKey: `customer-${user.id}` },
  );
  await sql`insert into private.stripe_customers (user_id, customer_id) values (${user.id}, ${customer.id})
            on conflict (user_id) do nothing`;
  const [row] = await sql<{ customer_id: string }[]>`select customer_id from private.stripe_customers where user_id = ${user.id}`;
  return row.customer_id;
}

/** Remember a card for later charges, and make it the customer's default. */
export async function saveCard(customerId: string, paymentMethodId: string): Promise<void> {
  const s = stripe();
  const pm = await s.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer && pm.customer !== customerId) return;
  if (!pm.customer) await s.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await s.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
  const card = pm.card;
  await sql`update private.stripe_customers
               set payment_method = ${paymentMethodId},
                   card_brand = ${card?.brand ?? pm.type},
                   card_last4 = ${card?.last4 ?? null},
                   card_exp = ${card ? `${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}` : null},
                   updated_at = now()
             where customer_id = ${customerId}`;
}

/** The fields we read from a host's connected account (Accounts v2). */
export const ACCOUNT_INCLUDE: ("configuration.recipient" | "requirements")[] = ["configuration.recipient", "requirements"];

/**
 * Copy a host's connected account state from Stripe (Accounts v2).
 * Ready for money = the stripe_transfers capability is active.
 */
export async function syncAccount(account: Stripe.V2.Core.Account): Promise<void> {
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance;
  const transfers = balance?.stripe_transfers?.status;
  const payouts = balance?.payouts?.status;
  const due = (account.requirements?.entries ?? [])
    .filter((e) => e.awaiting_action_from === "user" && e.minimum_deadline?.status !== "eventually_due")
    .map((e) => e.description ?? "")
    .filter(Boolean);
  await sql`update private.stripe_accounts
               set details_submitted = ${transfers === "active" || transfers === "pending"},
                   transfers_active = ${transfers === "active"},
                   payouts_enabled = ${payouts === "active" || (payouts === undefined && transfers === "active")},
                   requirements_due = ${due},
                   updated_at = now()
             where account_id = ${account.id}`;
}

/** The product all monthly storage invoices are for (created once). */
export async function storageProduct(): Promise<string> {
  const [row] = await sql<{ value: string }[]>`select value from private.settings where key = 'stripe_storage_product'`;
  if (row) return row.value;
  const product = await stripe().products.create(
    { name: "Förvaring via Spazia", description: "Månadshyra för förvaring hos en värd via Spazia." },
    { idempotencyKey: "spazia-storage-product" },
  );
  await sql`insert into private.settings (key, value) values ('stripe_storage_product', ${product.id})
            on conflict (key) do update set value = excluded.value`;
  return product.id;
}

/** The charge behind a PaymentIntent (needed to tie the transfer to it). */
export function chargeId(pi: Stripe.PaymentIntent): string | null {
  const c = pi.latest_charge;
  return typeof c === "string" ? c : (c?.id ?? null);
}

export async function paymentSucceeded(paymentId: string, pi: Stripe.PaymentIntent): Promise<void> {
  await sql`select private.payment_succeeded(${paymentId}::uuid, ${pi.id}, ${chargeId(pi)})`;
  // Keep the card for next month if the customer has none yet.
  const customer = typeof pi.customer === "string" ? pi.customer : pi.customer?.id;
  const pm = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id;
  if (customer && pm) {
    const [row] = await sql<{ payment_method: string | null }[]>`select payment_method from private.stripe_customers where customer_id = ${customer}`;
    if (row && !row.payment_method) await saveCard(customer, pm).catch((err) => console.error("saveCard", err));
  }
}

export async function paymentFailed(paymentId: string, reason: string): Promise<void> {
  await sql`select private.payment_failed(${paymentId}::uuid, ${reason})`;
}
