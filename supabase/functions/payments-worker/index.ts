/**
 * Does the payment work the database has queued: first-month charges (Stripe
 * invoices), Stripe subscription schedules for the months after, transfers to
 * hosts, refunds and voiding invoices for cancelled months. Called by the
 * database (private.kick_payments) every 10 minutes and right after something
 * changes, with a one-time token.
 * Deployed without JWT check; the token is the check.
 */
import type { Stripe } from "../_shared/deps.ts";
import { alertTeam, ore, sql, stripe } from "../_shared/config.ts";
import { automaticTax, ensureCustomer, getUser, invoicePaid, paymentFailed, storageProducts, TAX_CODES } from "../_shared/payments.ts";
import { scheduleParams, type SchedulePlan } from "../_shared/schedule.ts";
import { bookTxn, type PaymentSplit } from "../_shared/bookkeeping.ts";

type JsonValue = Parameters<typeof sql.json>[0];

const BATCH = 25;

async function validToken(token: unknown): Promise<boolean> {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false;
  const rows = await sql`delete from private.worker_tokens where token = ${token} and created_at > now() - interval '15 minutes' returning 1`;
  return rows.length === 1;
}

interface ChargeRow {
  id: string;
  request_id: string;
  amount: number;
  base_amount: number | null;
  protection_amount: number;
  attempts: number;
  stripe_invoice: string | null;
  customer_id: string | null;
  payment_method: string | null;
  title: string;
  host_name: string;
  period_start: string;
  period_end: string;
}

/** A draft invoice for the first month: the host's rent and Spazia's fee, VAT included. */
async function createInvoice(p: ChargeRow, tax: Awaited<ReturnType<typeof automaticTax>>): Promise<Stripe.Invoice> {
  const s = stripe();
  const rent = Math.min(p.base_amount ?? p.amount, p.amount);
  const protection = Math.max(0, Math.min(p.protection_amount ?? 0, p.amount - rent));
  const period = `${p.period_start} – ${p.period_end}`;
  const key = `${p.id}-${p.attempts}`;
  const invoice = await s.invoices.create(
    {
      customer: p.customer_id!,
      currency: "sek",
      collection_method: "charge_automatically",
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      default_payment_method: p.payment_method!,
      description: `Förvaring: ${p.title}${p.host_name ? `, värd: ${p.host_name}` : ""} (${period})`,
      metadata: { payment_id: p.id, request_id: p.request_id },
      ...(tax ? { automatic_tax: tax } : {}),
    },
    { idempotencyKey: `invoice-${key}` },
  );
  // Remember it at once, so a run that stops half-way doesn't create another.
  await sql`update public.payments set stripe_invoice = ${invoice.id!} where id = ${p.id}`;
  const item = (kr: number, description: string, taxCode: string, part: string) =>
    s.invoiceItems.create(
      { customer: p.customer_id!, invoice: invoice.id!, currency: "sek", amount: ore(kr), description, tax_code: taxCode, tax_behavior: "inclusive" },
      { idempotencyKey: `invoice-${part}-${key}` },
    );
  if (rent > 0) await item(rent, `Hyra till värden${p.host_name ? ` ${p.host_name}` : ""}, ${period}`, TAX_CODES.rent, "rent");
  if (p.amount - rent - protection > 0) await item(p.amount - rent - protection, "Spazias serviceavgift", TAX_CODES.fee, "fee");
  if (protection > 0) await item(protection, "Spazia Skydd", TAX_CODES.protection, "protection");
  return await s.invoices.retrieve(invoice.id!);
}

/**
 * The first month: a Stripe invoice with two lines (the host's rent and
 * Spazia's fee, VAT included), charged to the saved card without the renter
 * present. If the card fails, the renter pays on the invoice's page.
 * Later months are Stripe Billing's (subscription schedule).
 */
async function charge(): Promise<number> {
  const due = await sql<ChargeRow[]>`
    update public.payments p
       set status = 'processing', attempts = p.attempts + 1, due_at = now()
      from public.requests r, public.listings l
     where p.id in (
             select p2.id from public.payments p2 join public.requests r2 on r2.id = p2.request_id
              where p2.status = 'due' and p2.due_at <= now() and p2.attempts < 3 and p2.period_index = 0
                and r2.kind = 'month' and r2.status = 'accepted'
              order by p2.due_at limit ${BATCH} for update of p2 skip locked)
       and r.id = p.request_id and l.id = r.listing_id
    returning p.id, p.request_id, p.amount, p.base_amount, p.protection_amount, p.attempts, p.stripe_invoice,
              (select c.customer_id from private.stripe_customers c where c.user_id = p.renter_id) as customer_id,
              (select c.payment_method from private.stripe_customers c where c.user_id = p.renter_id) as payment_method,
              l.title, coalesce((select pr.first_name from public.profiles pr where pr.id = p.host_id), '') as host_name,
              p.period_start::text as period_start, p.period_end::text as period_end`;
  if (due.length === 0) return 0;
  const s = stripe();
  const tax = await automaticTax();
  for (const p of due) {
    if (!p.customer_id || !p.payment_method) {
      await paymentFailed(p.id, "no_card");
      continue;
    }
    let invoiceId = p.stripe_invoice;
    try {
      // An invoice from an earlier run that stopped half-way is reused.
      let invoice: Stripe.Invoice | null = invoiceId ? await s.invoices.retrieve(invoiceId) : null;
      if (invoice?.status === "paid") {
        await invoicePaid(p.id, invoice.id!);
        continue;
      }
      if (!invoice || invoice.status === "void" || invoice.status === "uncollectible") {
        invoice = await createInvoice(p, tax);
        invoiceId = invoice.id!;
      }
      if (invoice.status === "draft") invoice = await s.invoices.finalizeInvoice(invoice.id!);
      await sql`update public.payments set stripe_invoice = ${invoice.id!}, hosted_invoice_url = ${invoice.hosted_invoice_url ?? null} where id = ${p.id}`;
      const paid = await s.invoices.pay(invoice.id!, { off_session: true });
      if (paid.status === "paid") await invoicePaid(p.id, paid.id!);
    } catch (err) {
      // Declined, or the bank wants the renter to confirm (3-D Secure): the renter
      // is emailed a link to the invoice page (hosted_invoice_url).
      const e = err as { type?: string; code?: string; decline_code?: string; message?: string };
      if (e.type !== "StripeCardError") {
        console.error("payments-worker: charge", p.id, err);
        await alertTeam("worker_charge", "En första månadsbetalning gick inte att dra (inte ett kortfel)", err);
      }
      // An unfinished draft is removed; the renter can then pay in Checkout instead.
      if (invoiceId) {
        const draft = await s.invoices.retrieve(invoiceId).catch(() => null);
        if (draft?.status === "draft") {
          await s.invoices.del(invoiceId).catch((delErr) => console.error("payments-worker: delete draft", invoiceId, delErr));
          await sql`update public.payments set stripe_invoice = null, hosted_invoice_url = null where id = ${p.id} and stripe_invoice = ${invoiceId}`;
        }
      }
      await paymentFailed(p.id, e.decline_code ?? e.code ?? e.message ?? "failed");
    }
  }
  return due.length;
}

/** The host's share, a day after the period it pays for has ended (transfer_due_at). Stripe pays it out on Mondays. */
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
      await alertTeam("worker_transfer", "En överföring till en värd misslyckades", err);
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
            products: await storageProducts(),
            requestId: r.id,
            now: Math.floor(Date.now() / 1000),
            automaticTax: await automaticTax(),
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
      await alertTeam("worker_schedule", "Ett betalschema för månadshyra gick inte att skapa eller stoppa", err);
    }
  }
  return due.length;
}

/**
 * Invoices still open for months that were cancelled (the first month wasn't
 * paid in time, or the rental ended): void them, so they can't be paid.
 */
async function voidInvoices(): Promise<number> {
  const due = await sql<{ id: string; stripe_invoice: string }[]>`
    select id, stripe_invoice from public.payments
     where status = 'cancelled' and stripe_invoice is not null and hosted_invoice_url is not null
     limit ${BATCH}`;
  const s = stripe();
  for (const p of due) {
    try {
      const invoice = await s.invoices.retrieve(p.stripe_invoice);
      if (invoice.status === "open") await s.invoices.voidInvoice(p.stripe_invoice, {}, { idempotencyKey: `void-${p.id}` });
      // Paid at the last moment: the webhook records it and the database refunds it.
      await sql`update public.payments set hosted_invoice_url = null where id = ${p.id}`;
    } catch (err) {
      console.error("payments-worker: void", p.id, err);
      await alertTeam("worker_void", "En faktura för en avbokad månad gick inte att makulera", err);
    }
  }
  return due.length;
}

/** Refunds the database asked for (cancellations before the start, late payments). */
async function refund(): Promise<number> {
  const due = await sql<{ id: string; refund_amount: number; host_amount: number; stripe_payment_intent: string | null; stripe_transfer: string | null; stripe_invoice: string | null }[]>`
    select id, refund_amount, host_amount, stripe_payment_intent, stripe_transfer, stripe_invoice
      from public.payments
     where status = 'paid' and refund_requested_at is not null and refunded_at is null
     order by refund_requested_at limit ${BATCH}`;
  for (const p of due) {
    if (!p.stripe_payment_intent && !p.stripe_invoice) continue;
    try {
      const s = stripe();
      if (p.stripe_transfer) {
        await s.transfers.createReversal(p.stripe_transfer, { amount: ore(p.host_amount) }, { idempotencyKey: `reverse-${p.id}` });
      }
      let refundId: string;
      if (p.stripe_invoice) {
        // Invoices are refunded with a credit note that credits every line in full (rent,
        // Spazia's fee, Spazia Skydd), so Stripe Tax reverses the VAT on the fee as well.
        // A credit note with only a total reverses no VAT. Refunds are always for the whole
        // payment; the preview gives the exact total to refund.
        const items = await s.invoices.listLineItems(p.stripe_invoice, { limit: 100 });
        const lines = items.data.map((l) => ({ type: "invoice_line_item" as const, invoice_line_item: l.id!, quantity: l.quantity ?? 1 }));
        const preview = await s.creditNotes.preview({ invoice: p.stripe_invoice, lines });
        const note = await s.creditNotes.create(
          { invoice: p.stripe_invoice, lines, refund_amount: preview.total, reason: "order_change", metadata: { payment_id: p.id } },
          { idempotencyKey: `credit-note-lines-${p.id}` },
        );
        refundId = note.id;
        if (preview.total !== ore(p.refund_amount)) {
          console.warn(`payments-worker: refund ${p.id} credited ${preview.total / 100} kr, asked ${p.refund_amount} kr`);
        }
      } else {
        const r = await s.refunds.create(
          { payment_intent: p.stripe_payment_intent!, amount: ore(p.refund_amount), metadata: { payment_id: p.id } },
          { idempotencyKey: `refund-${p.id}` },
        );
        refundId = r.id;
      }
      await sql`update public.payments set status = 'refunded', refunded_at = now(), stripe_refund = ${refundId} where id = ${p.id}`;
    } catch (err) {
      console.error("payments-worker: refund", p.id, err);
      await alertTeam("worker_refund", "En återbetalning misslyckades", err);
    }
  }
  return due.length;
}

/** The card charge a balance transaction belongs to (a payment, or the payment a refund is for). */
function chargeOf(t: Stripe.BalanceTransaction): string | null {
  const src = t.source;
  if (!src) return null;
  if (typeof src === "string") return /^(ch|py)_/.test(src) ? src : null;
  if (src.object === "charge") return src.id;
  if (src.object === "refund") {
    const c = (src as Stripe.Refund).charge;
    return typeof c === "string" ? c : (c?.id ?? null);
  }
  return null;
}

/**
 * Bookkeeping: book what moved through Spazia's Stripe balance (card payments,
 * refunds, transfers to hosts, payouts to the bank, Stripe's fees) as vouchers
 * in series S. Once an hour; it looks back two days so nothing is missed, and
 * each transaction is booked once (source_ref). What can't be booked safely
 * goes to the "to book" list in the admin page.
 */
async function bookkeeping(): Promise<number> {
  const [state] = await sql<{ at: string | null; cursor: string | null; rc: string | null }[]>`
    select private.setting('acc_stripe_synced_at') as at, private.setting('acc_stripe_cursor') as cursor,
           private.setting('acc_stripe_fee_reverse_charge') as rc`;
  if (state?.at && Date.now() - Date.parse(state.at) < 50 * 60_000) return 0;
  const cursor = Number(state?.cursor ?? 0) || 0;
  const txns: Stripe.BalanceTransaction[] = [];
  for await (const t of stripe().balanceTransactions.list({ created: { gte: Math.max(0, cursor - 2 * 86400) }, limit: 100, expand: ["data.source"] })) {
    txns.push(t);
    if (txns.length >= 2000) break;
  }
  txns.sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
  const now = Math.floor(Date.now() / 1000);
  let booked = 0;
  let newest = cursor;
  for (const t of txns) {
    newest = Math.max(newest, t.created);
    const ref = `stripe:${t.id}`;
    const seen = await sql`select 1 from private.acc_vouchers where source_ref = ${ref}
                           union all select 1 from private.acc_unbooked where txn_id = ${t.id} limit 1`;
    if (seen.length > 0) continue;
    try {
      const charge = chargeOf(t);
      const [split] = charge
        ? await sql<PaymentSplit[]>`
            select p.amount, p.host_amount,
                   case when r.kind = 'hour' then 'Parkering, ' else 'Förvaring, ' end || l.title || ' (' || p.period_start ||
                   case when p.period_end <> p.period_start then ' – ' || p.period_end else '' end || ')' as label
              from public.payments p join public.requests r on r.id = p.request_id join public.listings l on l.id = r.listing_id
             where p.stripe_charge = ${charge} limit 1`
        : [];
      const result = bookTxn(
        {
          id: t.id,
          type: t.type,
          amount: t.amount,
          fee: t.fee,
          fee_details: t.fee_details.map((d) => ({ type: d.type, amount: d.amount })),
          created: t.created,
          description: t.description,
        },
        split ?? null,
        { reverseCharge: state?.rc !== "false", now },
      );
      if (result.kind === "book") {
        // sql.json: a JSON value as such (a JSON string would be encoded once more).
        await sql`select private.acc_book(${result.voucher.date}::date, ${result.voucher.description}, ${sql.json(result.voucher.lines as unknown as JsonValue)},
                                          'S', 'stripe', ${ref}, null, null, 'Stripe (automatiskt)', true)`;
        booked++;
      } else if (result.kind === "manual") {
        const source = typeof t.source === "string" ? t.source : (t.source?.id ?? null);
        await sql`insert into private.acc_unbooked (txn_id, kind, amount, occurred_at, description, detail)
                  values (${t.id}, ${t.type}, ${t.amount / 100}, to_timestamp(${t.created}), ${t.description ?? ""},
                          ${sql.json({ reason: result.reason, fee: t.fee / 100, source, charge })})
                  on conflict (txn_id) do nothing`;
      }
    } catch (err) {
      console.error("payments-worker: bookkeeping", t.id, err);
      await alertTeam("worker_bookkeeping", "En Stripe-transaktion gick inte att bokföra", err);
    }
  }
  await sql`insert into private.settings (key, value)
            values ('acc_stripe_cursor', ${String(newest)}), ('acc_stripe_synced_at', ${new Date().toISOString()})
            on conflict (key) do update set value = excluded.value`;
  return booked;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const body = await req.json().catch(() => ({}));
  if (!(await validToken((body as { token?: unknown }).token))) return new Response("forbidden", { status: 403 });
  try {
    const done = {
      refunds: await refund(),
      voided: await voidInvoices(),
      charges: await charge(),
      schedules: await syncSchedules(),
      transfers: await transfer(),
      // Last, and never in the way of the payments themselves.
      booked: await bookkeeping().catch(async (err) => {
        console.error("payments-worker: bookkeeping", err);
        await alertTeam("worker_bookkeeping", "Bokföringen av Stripe-transaktioner kraschade", err);
        return 0;
      }),
    };
    return new Response(JSON.stringify(done), { headers: { "content-type": "application/json" } });
  } catch (err) {
    console.error("payments-worker:", err);
    await alertTeam("worker_failed", "Betalningsjobbet (payments-worker) kraschade", err);
    return new Response("error", { status: 500 });
  }
});
