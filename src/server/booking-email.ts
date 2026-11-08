/**
 * Emails about requests and bookings in the app (new request, parking
 * booking, answer, cancellation). Pure function: it only builds the message
 * from the details the database hands over (public.claim_notification).
 *
 * Only relative imports: the function bundler does not know the "@/" alias.
 */
import { getCategory, type CategoryId } from "../content/categories";
import { FEES } from "../content/pricing";
import { buttonHtml, escapeHtml, htmlLayout, htmlTable, paragraphsHtml } from "../lib/lead-emails";
import type { OutgoingMail } from "./mailer";

export type NotificationKind =
  | "request_new"
  | "parking_booked"
  | "request_accepted"
  | "request_declined"
  | "cancelled_by_renter"
  | "cancelled_by_host";

export interface NotificationItem {
  category: CategoryId;
  quantity: number;
  host_price_month: number | null;
  hourly_price: number | null;
  daily_max: number | null;
}

export interface NotificationPayload {
  kind: NotificationKind;
  prev_status: string | null;
  role: "host" | "renter";
  to_email: string | null;
  to_name: string | null;
  other_name: string | null;
  request_id: string;
  request_kind: "month" | "hour";
  start_date: string;
  end_date: string | null;
  start_at: string | null;
  end_at: string | null;
  host_total: number | null;
  message: string;
  expires_at: string;
  decline_reason: string;
  cancel_reason: string;
  listing_title: string;
  listing_city: string;
  listing_area: string;
  items: NotificationItem[];
}

const TIME_ZONE = "Europe/Stockholm";

/** What the host receives (Spazia's host fee deducted), same rounding as the app. */
const hostPayout = (price: number) => Math.round(price * (1 - FEES.hostFee));

const kr = (amount: number) => `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(amount)} kr`;

function day(iso: string): string {
  // Date-only strings are calendar days: format them at noon UTC so no time zone moves them.
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

function timeRange(startIso: string, endIso: string): string {
  const d = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
  const t = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay = d.format(s) === d.format(new Date(e.getTime() - 1000));
  return sameDay ? `${d.format(s)} kl. ${t.format(s)}–${t.format(e)}` : `${d.format(s)} kl. ${t.format(s)} – ${d.format(e)} kl. ${t.format(e)}`;
}

function deadline(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function itemsText(items: NotificationItem[]): string {
  return items
    .map((i) => {
      const c = getCategory(i.category);
      return `${i.quantity} ${i.quantity === 1 ? c.unit.sv : c.unitPlural.sv}`;
    })
    .join(", ");
}

function period(p: NotificationPayload): string {
  if (p.request_kind === "hour" && p.start_at && p.end_at) return timeRange(p.start_at, p.end_at);
  return p.end_date ? `${day(p.start_date)} – ${day(p.end_date)}` : `Från ${day(p.start_date)}, tills vidare`;
}

function place(p: NotificationPayload): string {
  const where = [p.listing_area, p.listing_city].filter(Boolean).join(", ");
  return where ? `${p.listing_title} (${where})` : p.listing_title;
}

function monthlyIncome(items: NotificationItem[]): number {
  return items.reduce((sum, i) => sum + (i.host_price_month ? hostPayout(i.host_price_month) * i.quantity : 0), 0);
}

const FOOTER = "Du får det här mejlet för att du har ett konto på Spazia. Frågor? Svara på mejlet, så hjälper vi dig.";

interface Draft {
  subject: string;
  intro: string[];
  rows: [string, string][];
  after?: string[];
  button: { href: string; label: string };
}

/** Build the email, or null when there is nobody to send it to. */
export function buildBookingEmail(p: NotificationPayload, opts: { appUrl: string; team: string }): OutgoingMail | null {
  if (!p.to_email) return null;
  const name = p.other_name || (p.role === "host" ? "Hyresgästen" : "Värden");
  const hello = p.to_name ? `Hej ${p.to_name}!` : "Hej!";
  const hostLink = `${opts.appUrl}/vard/forfragan?id=${p.request_id}`;
  const renterLink = `${opts.appUrl}/kund/bokning?id=${p.request_id}`;
  const searchLink = `${opts.appUrl}/sok${p.listing_city ? `?ort=${encodeURIComponent(p.listing_city)}` : ""}`;
  const isHour = p.request_kind === "hour";
  const message: [string, string][] = p.message.trim() ? [["Meddelande", p.message.trim()]] : [];

  let d: Draft;
  switch (p.kind) {
    case "request_new":
      d = {
        subject: `Ny förfrågan från ${name}: svara senast ${deadline(p.expires_at)}`,
        intro: [hello, `${name} vill hyra plats hos dig i ”${p.listing_title}”.`],
        rows: [["Vad", itemsText(p.items)], ["Period", period(p)], ["Du får", `${kr(monthlyIncome(p.items))}/mån`], ...message],
        after: [`Svara senast ${deadline(p.expires_at)}. Annars går förfrågan ut och ${name} får söka en annan plats.`],
        button: { href: hostLink, label: "Svara på förfrågan" },
      };
      break;
    case "parking_booked": {
      const qty = p.items[0]?.quantity ?? 1;
      d = {
        subject: `Ny parkeringsbokning: ${period(p)}`,
        intro: [hello, `${name} har bokat ${qty === 1 ? "en parkeringsplats" : `${qty} parkeringsplatser`} i ”${p.listing_title}”. Bokningen gäller direkt.`],
        rows: [["Tid", period(p)], ["Antal", String(qty)], ["Du får", kr(hostPayout(p.host_total ?? 0))], ...message],
        after: [`Går platsen inte att använda? Avboka i appen före starttiden, så får ${name} besked direkt.`],
        button: { href: hostLink, label: "Visa bokningen" },
      };
      break;
    }
    case "request_accepted":
      d = {
        subject: `${name} har godkänt din förfrågan`,
        intro: [hello, `${name} har godkänt din förfrågan om ”${p.listing_title}”. Nu ser du adressen, hur du kommer in och ${name}s telefonnummer i appen.`],
        rows: [["Plats", place(p)], ["Vad", itemsText(p.items)], ["Period", period(p)]],
        button: { href: renterLink, label: "Visa bokningen" },
      };
      break;
    case "request_declined":
      d = {
        subject: `Svar på din förfrågan om ”${p.listing_title}”`,
        intro: [hello, `${name} kan tyvärr inte ta emot din förfrågan om ”${p.listing_title}”.`],
        rows: [["Period", period(p)], ...(p.decline_reason.trim() ? ([["Anledning", p.decline_reason.trim()]] as [string, string][]) : [])],
        after: ["Det finns fler platser att hyra. Sök igen, så hittar du kanske en i närheten."],
        button: { href: searchLink, label: "Hitta en annan plats" },
      };
      break;
    case "cancelled_by_renter": {
      const withdrawn = p.prev_status === "pending";
      d = {
        subject: withdrawn ? `${name} har dragit tillbaka sin förfrågan` : isHour ? `${name} har avbokat parkeringen` : `${name} har avbokat`,
        intro: [
          hello,
          withdrawn
            ? `${name} har dragit tillbaka sin förfrågan om ”${p.listing_title}”. Du behöver inte göra något.`
            : `${name} har avbokat ${isHour ? "sin parkering" : "sin förvaring"} i ”${p.listing_title}”. Platsen är ledig igen för andra.`,
        ],
        rows: [[isHour ? "Tid" : "Period", period(p)], ["Vad", itemsText(p.items)], ...(p.cancel_reason.trim() ? ([["Meddelande", p.cancel_reason.trim()]] as [string, string][]) : [])],
        button: { href: hostLink, label: "Visa i appen" },
      };
      break;
    }
    case "cancelled_by_host":
      d = {
        subject: isHour ? `Din parkering i ”${p.listing_title}” är avbokad` : `Din förvaring i ”${p.listing_title}” är avbokad`,
        intro: [hello, `${name} har tyvärr avbokat ${isHour ? "din parkering" : "din förvaring"} i ”${p.listing_title}”.`],
        rows: [[isHour ? "Tid" : "Period", period(p)], ...(p.cancel_reason.trim() ? ([["Anledning", p.cancel_reason.trim()]] as [string, string][]) : [])],
        after: ["Sök gärna en annan plats i närheten. Hör av dig om du behöver hjälp."],
        button: { href: searchLink, label: "Hitta en annan plats" },
      };
      break;
    default:
      return null;
  }

  const text = [
    ...d.intro,
    d.rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    ...(d.after ?? []),
    `${d.button.label}: ${d.button.href}`,
    FOOTER,
  ].join("\n\n");

  const html = htmlLayout(
    paragraphsHtml(d.intro) +
      `<div style="margin:4px 0 18px">${htmlTable(d.rows)}</div>` +
      paragraphsHtml(d.after ?? []) +
      buttonHtml(d.button.href, d.button.label),
    escapeHtml(FOOTER),
  );

  return { to: p.to_email, replyTo: opts.team, subject: d.subject, text, html };
}
