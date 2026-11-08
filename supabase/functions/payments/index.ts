/**
 * Payments API for the app (signed-in users). POST { action, ... }:
 *
 *   connect     host: start or continue Stripe onboarding → { url }
 *   dashboard   host: Stripe's own payout overview       → { url }
 *   sync        host: refresh payout status after onboarding → { ok }
 *   card        renter: save a card in Stripe Checkout   → { url }   { returnTo }
 *   card_done   renter: after returning from Checkout   → { ok }    { session }
 *   pay         renter: pay a booking or a month         → { url }   { payment }
 *   pay_done    renter: after returning from Checkout   → { paid }  { payment }
 *
 * Secrets: STRIPE_SECRET_KEY. Optional: APP_URL (default https://app.spazia.se).
 */
import { createClient } from "../_shared/deps.ts";
import { APP_URL, ore, sql, stripe } from "../_shared/config.ts";
import { cors, json, readJson, UUID_RE } from "../_shared/http.ts";
import { ensureCustomer, getUser, paymentSucceeded, saveCard, syncAccount, type UserRow } from "../_shared/payments.ts";

class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function signedInUser(req: Request): Promise<UserRow> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "login_required");
  const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "login_required");
  const user = await getUser(data.user.id);
  if (!user) throw new HttpError(401, "login_required");
  return user;
}

async function paymentsOn(): Promise<boolean> {
  const [row] = await sql<{ on: boolean }[]>`select private.payments_on() as on`;
  return row?.on ?? false;
}

/** Only paths inside the app, e.g. "/kund/skicka?id=…". */
function appPath(value: unknown, fallback: string): string {
  return typeof value === "string" && /^\/[a-z0-9/_\-?=&.%]*$/i.test(value) && !value.startsWith("//") ? value : fallback;
}

function withParam(path: string, param: string): string {
  return `${APP_URL}${path}${path.includes("?") ? "&" : "?"}${param}`;
}

/* ---------- Hosts ---------- */

async function connect(user: UserRow): Promise<{ url: string }> {
  const [tax] = await sql<{ full_name: string; street_address: string; postal_code: string; city: string }[]>`
    select full_name, street_address, postal_code, city from public.host_tax_info where user_id = ${user.id}`;
  if (!tax) throw new HttpError(400, "tax_info_required");
  const s = stripe();
  let [acct] = await sql<{ account_id: string }[]>`select account_id from private.stripe_accounts where user_id = ${user.id}`;
  if (!acct) {
    const [first, ...rest] = tax.full_name.trim().split(/\s+/);
    const account = await s.accounts.create(
      {
        type: "express",
        country: "SE",
        email: user.email ?? undefined,
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        business_profile: {
          product_description: "Uthyrning av förvaring och parkering via Spazia",
          url: "https://spazia.se",
        },
        individual: {
          first_name: first,
          last_name: rest.join(" ") || undefined,
          email: user.email ?? undefined,
          address: { line1: tax.street_address, postal_code: tax.postal_code.replace(/\s/g, ""), city: tax.city, country: "SE" },
        },
        settings: { payouts: { schedule: { interval: "weekly", weekly_anchor: "monday" } } },
        metadata: { user_id: user.id },
      },
      { idempotencyKey: `account-${user.id}` },
    );
    await sql`insert into private.stripe_accounts (user_id, account_id) values (${user.id}, ${account.id})
              on conflict (user_id) do nothing`;
    [acct] = await sql<{ account_id: string }[]>`select account_id from private.stripe_accounts where user_id = ${user.id}`;
  }
  const link = await s.accountLinks.create({
    account: acct.account_id,
    type: "account_onboarding",
    refresh_url: `${APP_URL}/vard/utbetalningar?stripe=igen`,
    return_url: `${APP_URL}/vard/utbetalningar?stripe=klar`,
    collection_options: { fields: "eventually_due" },
  });
  return { url: link.url };
}

async function dashboard(user: UserRow): Promise<{ url: string }> {
  const [acct] = await sql<{ account_id: string; details_submitted: boolean }[]>`
    select account_id, details_submitted from private.stripe_accounts where user_id = ${user.id}`;
  if (!acct?.details_submitted) throw new HttpError(400, "not_connected");
  const link = await stripe().accounts.createLoginLink(acct.account_id);
  return { url: link.url };
}

async function sync(user: UserRow): Promise<{ ok: true }> {
  const [acct] = await sql<{ account_id: string }[]>`select account_id from private.stripe_accounts where user_id = ${user.id}`;
  if (acct) await syncAccount(await stripe().accounts.retrieve(acct.account_id));
  return { ok: true };
}

/* ---------- Renters ---------- */

async function card(user: UserRow, body: Record<string, unknown>): Promise<{ url: string }> {
  const customer = await ensureCustomer(user);
  const back = appPath(body.returnTo, "/kund/meny");
  const session = await stripe().checkout.sessions.create({
    mode: "setup",
    currency: "sek",
    customer,
    locale: "sv",
    success_url: withParam(back, "kort={CHECKOUT_SESSION_ID}"),
    cancel_url: `${APP_URL}${back}`,
    metadata: { user_id: user.id, purpose: "card" },
  });
  return { url: session.url! };
}

async function cardDone(user: UserRow, body: Record<string, unknown>): Promise<{ ok: boolean }> {
  const id = typeof body.session === "string" ? body.session : "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw new HttpError(400, "bad_request");
  const session = await stripe().checkout.sessions.retrieve(id, { expand: ["setup_intent"] });
  if (session.metadata?.user_id !== user.id || session.mode !== "setup") throw new HttpError(404, "not_found");
  const si = session.setup_intent;
  const pm = si && typeof si !== "string" ? si.payment_method : null;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (si && typeof si !== "string" && si.status === "succeeded" && pm && customer) {
    await saveCard(customer, typeof pm === "string" ? pm : pm.id);
    return { ok: true };
  }
  return { ok: false };
}

interface PaymentRow {
  id: string;
  request_id: string;
  renter_id: string;
  status: string;
  amount: number;
  pay_by: Date;
  period_start: string;
  period_end: string;
  kind: "month" | "hour";
  request_status: string;
  title: string;
  stripe_checkout_session: string | null;
}

async function loadPayment(user: UserRow, value: unknown): Promise<PaymentRow> {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new HttpError(400, "bad_request");
  const [p] = await sql<PaymentRow[]>`
    select p.id, p.request_id, p.renter_id, p.status::text as status, p.amount, p.pay_by,
           p.period_start::text as period_start, p.period_end::text as period_end,
           r.kind, r.status::text as request_status, l.title, p.stripe_checkout_session
      from public.payments p
      join public.requests r on r.id = p.request_id
      join public.listings l on l.id = r.listing_id
     where p.id = ${value}`;
  if (!p || p.renter_id !== user.id) throw new HttpError(404, "not_found");
  return p;
}

async function pay(user: UserRow, body: Record<string, unknown>): Promise<{ url: string }> {
  const p = await loadPayment(user, body.payment);
  if (!["due", "failed"].includes(p.status)) throw new HttpError(409, "not_payable");
  if (p.kind === "hour" && (p.request_status !== "pending" || new Date(p.pay_by) <= new Date())) throw new HttpError(409, "expired");
  if (p.kind === "month" && p.request_status !== "accepted") throw new HttpError(409, "not_payable");

  // Stripe Checkout lasts at least 30 minutes: keep the parking hold that long.
  const expiresAt = new Date(Math.max(new Date(p.pay_by).getTime(), Date.now() + 31 * 60_000));
  if (p.kind === "hour") {
    await sql`update public.payments set pay_by = ${expiresAt} where id = ${p.id}`;
    await sql`update public.requests set expires_at = ${expiresAt} where id = ${p.request_id} and status = 'pending'`;
  }

  const customer = await ensureCustomer(user);
  const what = p.kind === "hour" ? `Parkering: ${p.title}` : `Förvaring: ${p.title} (${p.period_start} – ${p.period_end})`;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer,
    locale: "sv",
    client_reference_id: p.id,
    line_items: [{ quantity: 1, price_data: { currency: "sek", unit_amount: ore(p.amount), product_data: { name: what } } }],
    payment_intent_data: {
      setup_future_usage: "off_session",
      transfer_group: p.request_id,
      description: what,
      metadata: { payment_id: p.id, request_id: p.request_id },
    },
    metadata: { payment_id: p.id, purpose: "payment" },
    expires_at: Math.floor((p.kind === "hour" ? expiresAt.getTime() : Date.now() + 23 * 3600_000) / 1000),
    success_url: `${APP_URL}/kund/bokning?id=${p.request_id}&betald=${p.id}`,
    cancel_url: `${APP_URL}/kund/bokning?id=${p.request_id}`,
  });
  await sql`update public.payments set stripe_checkout_session = ${session.id} where id = ${p.id}`;
  return { url: session.url! };
}

async function payDone(user: UserRow, body: Record<string, unknown>): Promise<{ paid: boolean }> {
  const p = await loadPayment(user, body.payment);
  if (p.status === "paid") return { paid: true };
  if (!p.stripe_checkout_session) return { paid: false };
  const session = await stripe().checkout.sessions.retrieve(p.stripe_checkout_session, { expand: ["payment_intent"] });
  const pi = session.payment_intent;
  if (session.payment_status === "paid" && pi && typeof pi !== "string" && pi.metadata?.payment_id === p.id) {
    await paymentSucceeded(p.id, pi);
    return { paid: true };
  }
  return { paid: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
  try {
    if (!(await paymentsOn())) throw new HttpError(503, "payments_off");
    const user = await signedInUser(req);
    const body = await readJson(req);
    switch (body.action) {
      case "connect":
        return json(req, await connect(user));
      case "dashboard":
        return json(req, await dashboard(user));
      case "sync":
        return json(req, await sync(user));
      case "card":
        return json(req, await card(user, body));
      case "card_done":
        return json(req, await cardDone(user, body));
      case "pay":
        return json(req, await pay(user, body));
      case "pay_done":
        return json(req, await payDone(user, body));
      default:
        throw new HttpError(400, "unknown_action");
    }
  } catch (err) {
    if (err instanceof HttpError) return json(req, { error: err.code }, err.status);
    console.error("payments:", err);
    return json(req, { error: "server_error" }, 500);
  }
});
