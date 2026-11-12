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
 * Text at the bottom of every Stripe invoice. Spazia acts in the host's name:
 * the rent is the host's and carries no VAT from Spazia; Spazia's fee includes
 * 25 % VAT. Spazia's VAT number is added to invoices in Stripe's Dashboard.
 * Override with INVOICE_FOOTER.
 */
export const INVOICE_FOOTER =
  Deno.env.get("INVOICE_FOOTER") ?? "Hyran förmedlas i värdens namn och för värdens räkning. Moms tas ut på Spazias serviceavgift.";

/** Stripe tax codes (from Stripe's list, https://docs.stripe.com/tax/tax-codes). */
export const TAX_CODES = {
  /** The host's rent, passed on in the host's name: no VAT from Spazia. */
  rent: "txcd_00000000",
  /** Spazia's service fee: General – Services, 25 % VAT. */
  fee: "txcd_20030000",
  /**
   * Spazia Skydd, the optional add-on. Treated as Spazia's own service (25 %
   * VAT) for now. If it becomes insurance sold through a licensed partner,
   * it is VAT-exempt instead: change this before switching it on.
   */
  protection: "txcd_20030000",
};

/**
 * Whether Stripe Tax should calculate VAT. Off until 'stripe_tax' = 'on' in
 * private.settings, which is set once the Swedish VAT registration is in Stripe
 * (without a registration Stripe would silently charge no VAT).
 */
export async function taxOn(): Promise<boolean> {
  const [row] = await sql<{ on: boolean }[]>`select coalesce(private.setting('stripe_tax'), 'off') = 'on' as on`;
  return row?.on ?? false;
}

/** automatic_tax for Checkout, invoices and subscriptions: Spazia's own registration. */
export async function automaticTax(): Promise<{ enabled: true; liability: { type: "self" } } | undefined> {
  return (await taxOn()) ? { enabled: true, liability: { type: "self" } } : undefined;
}

export async function getUser(userId: string): Promise<UserRow | null> {
  const [row] = await sql<UserRow[]>`
    select u.id, u.email, coalesce(p.first_name, '') as first_name
      from auth.users u left join public.profiles p on p.id = u.id
     where u.id = ${userId}`;
  return row ?? null;
}

/** The renter's Stripe customer, created the first time it's needed. */
interface Company {
  company_name: string;
  company_org_number: string;
  company_vat_number: string;
}

async function companyOf(userId: string): Promise<Company | null> {
  const [row] = await sql<Company[]>`
    select company_name, company_org_number, company_vat_number from public.profile_private where id = ${userId}`;
  return row && row.company_name.trim() ? row : null;
}

/** Name and invoice fields: the company's when the renter has invoices made out to one. */
function invoiceIdentity(user: UserRow, company: Company | null) {
  return {
    name: company?.company_name.trim() || user.first_name || undefined,
    invoice_settings: {
      footer: INVOICE_FOOTER,
      custom_fields: company?.company_org_number ? [{ name: "Org.nr", value: company.company_org_number }] : [],
    },
  };
}

export async function ensureCustomer(user: UserRow): Promise<string> {
  const [existing] = await sql<{ customer_id: string }[]>`select customer_id from private.stripe_customers where user_id = ${user.id}`;
  if (existing) return existing.customer_id;
  const company = await companyOf(user.id);
  const identity = invoiceIdentity(user, company);
  const customer = await stripe().customers.create(
    {
      email: user.email ?? undefined,
      name: identity.name,
      metadata: { user_id: user.id },
      preferred_locales: ["sv"],
      // Renters rent space in Sweden; Stripe Tax needs at least the country.
      address: { country: "SE" },
      invoice_settings: identity.invoice_settings,
      ...(company?.company_vat_number ? { tax_id_data: [{ type: "eu_vat" as const, value: company.company_vat_number }] } : {}),
    },
    { idempotencyKey: `customer-${user.id}` },
  );
  await sql`insert into private.stripe_customers (user_id, customer_id) values (${user.id}, ${customer.id})
            on conflict (user_id) do nothing`;
  const [row] = await sql<{ customer_id: string }[]>`select customer_id from private.stripe_customers where user_id = ${user.id}`;
  return row.customer_id;
}

/**
 * After the renter changed their company details: update the Stripe customer
 * (name, org number on invoices, VAT number). Nothing to do before the first
 * payment; the customer is created with the details then.
 */
export async function syncCustomerDetails(user: UserRow): Promise<void> {
  const [existing] = await sql<{ customer_id: string }[]>`select customer_id from private.stripe_customers where user_id = ${user.id}`;
  if (!existing) return;
  const s = stripe();
  const company = await companyOf(user.id);
  const identity = invoiceIdentity(user, company);
  await s.customers.update(existing.customer_id, { name: identity.name ?? "", invoice_settings: identity.invoice_settings });
  const wanted = company?.company_vat_number || null;
  const current = await s.customers.listTaxIds(existing.customer_id, { limit: 10 });
  for (const t of current.data) if (t.value !== wanted) await s.customers.deleteTaxId(existing.customer_id, t.id);
  if (wanted && !current.data.some((t) => t.value === wanted)) {
    await s.customers.createTaxId(existing.customer_id, { type: "eu_vat", value: wanted });
  }
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

/** A product created once and remembered in private.settings. */
async function product(key: string, name: string, taxCode: string): Promise<string> {
  const [row] = await sql<{ value: string }[]>`select value from private.settings where key = ${key}`;
  if (row) return row.value;
  const created = await stripe().products.create({ name, tax_code: taxCode }, { idempotencyKey: `spazia-${key}` });
  await sql`insert into private.settings (key, value) values (${key}, ${created.id})
            on conflict (key) do update set value = excluded.value`;
  return created.id;
}

/** The parts of a monthly invoice: the host's rent, Spazia's fee and (if chosen) Spazia Skydd. */
export async function storageProducts(): Promise<{ rent: string; fee: string; protection: string }> {
  return {
    rent: await product("stripe_product_rent", "Hyra till värden", TAX_CODES.rent),
    fee: await product("stripe_product_fee", "Spazias serviceavgift", TAX_CODES.fee),
    protection: await product("stripe_product_protection", "Spazia Skydd", TAX_CODES.protection),
  };
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

/** The PaymentIntent that paid an invoice (null if paid outside Stripe). */
export async function invoiceIntent(invoiceId: string): Promise<Stripe.PaymentIntent | null> {
  const payments = await stripe().invoicePayments.list({ invoice: invoiceId, expand: ["data.payment.payment_intent"] });
  const pi = payments.data.find((p) => p.status === "paid")?.payment.payment_intent;
  return pi && typeof pi !== "string" ? pi : null;
}

/** A one-off invoice (a first month) was paid: by the saved card or on the invoice page. */
export async function invoicePaid(paymentId: string, invoiceId: string): Promise<void> {
  const pi = await invoiceIntent(invoiceId);
  if (pi) await paymentSucceeded(paymentId, pi);
  else await sql`select private.payment_succeeded(${paymentId}::uuid, null, null)`;
}

export async function paymentFailed(paymentId: string, reason: string): Promise<void> {
  await sql`select private.payment_failed(${paymentId}::uuid, ${reason})`;
}
