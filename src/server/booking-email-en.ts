/**
 * The booking emails in English, for users who use the app in English
 * (profiles.lang = 'en'). Same cases and details as the Swedish ones in
 * ./booking-email.ts. Only relative imports (the function bundler doesn't
 * know the "@/" alias).
 */
import { getCategory } from "../content/categories";
import { FEES } from "../content/pricing";
import type { Draft, NotificationItem, NotificationPayload } from "./booking-email";

const TIME_ZONE = "Europe/Stockholm";
const hostPayout = (price: number) => Math.round((price * Math.round((1 - FEES.hostFee) * 100)) / 100);
const kr = (amount: number) => `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(amount)} kr`;

function day(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

function timeRange(startIso: string, endIso: string): string {
  const d = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay = d.format(s) === d.format(new Date(e.getTime() - 1000));
  return sameDay ? `${d.format(s)}, ${t.format(s)}–${t.format(e)}` : `${d.format(s)} ${t.format(s)} – ${d.format(e)} ${t.format(e)}`;
}

function deadline(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function itemsText(items: NotificationItem[]): string {
  return items.map((i) => `${i.quantity} ${i.quantity === 1 ? getCategory(i.category).unit.en : getCategory(i.category).unitPlural.en}`).join(", ");
}

function period(p: NotificationPayload): string {
  if (p.request_kind === "hour" && p.start_at && p.end_at) return timeRange(p.start_at, p.end_at);
  return p.end_date ? `${day(p.start_date)} – ${day(p.end_date)}` : `From ${day(p.start_date)}, until further notice`;
}

function place(p: NotificationPayload): string {
  const where = [p.listing_area, p.listing_city].filter(Boolean).join(", ");
  return where ? `${p.listing_title} (${where})` : p.listing_title;
}

function monthlyIncome(items: NotificationItem[]): number {
  return items.reduce((sum, i) => sum + (i.host_price_month ? hostPayout(i.host_price_month) * i.quantity : 0), 0);
}

export const FOOTER_EN = "You're getting this email because you have an account with Spazia. Questions? Reply to this email and we'll help.";

/** The email's content in English, or null for kinds that have none. */
export function englishDraft(p: NotificationPayload, links: { host: string; renter: string; search: string; appUrl: string }): Draft | null {
  const name = p.other_name || (p.role === "host" ? "The renter" : "The host");
  const hello = p.to_name ? `Hi ${p.to_name}!` : "Hi!";
  const isHour = p.request_kind === "hour";
  const message: [string, string][] = p.message.trim() ? [["Message", p.message.trim()]] : [];

  switch (p.kind) {
    case "request_new":
      return {
        subject: `New request from ${name}: answer by ${deadline(p.expires_at)}`,
        intro: [hello, `${name} would like to rent space from you in “${p.listing_title}”.`],
        rows: [["What", itemsText(p.items)], ["Period", period(p)], ["You get", `${kr(monthlyIncome(p.items))}/month`], ...message],
        after: [`Answer by ${deadline(p.expires_at)}. Otherwise the request expires and ${name} will look for another space.`],
        button: { href: links.host, label: "Answer the request" },
      };
    case "parking_booked": {
      const qty = p.items[0]?.quantity ?? 1;
      return {
        subject: `New parking booking: ${period(p)}`,
        intro: [hello, `${name} has booked ${qty === 1 ? "a parking space" : `${qty} parking spaces`} in “${p.listing_title}”. The booking is confirmed right away.`],
        rows: [["Time", period(p)], ["Number", String(qty)], ["You get", kr(hostPayout(p.host_total ?? 0))], ...message],
        after: [`Can't the space be used? Cancel in the app before the start time and ${name} is told straight away.`],
        button: { href: links.host, label: "View the booking" },
      };
    }
    case "request_accepted":
      return {
        subject: `${name} has accepted your request`,
        intro: [
          hello,
          p.payment && p.payment.status !== "paid"
            ? `${name} has accepted your request for “${p.listing_title}”. You can now see the address in the app. How to get in and ${name}'s phone number are shown there once the first payment has gone through.`
            : `${name} has accepted your request for “${p.listing_title}”. You can now see the address, how to get in and ${name}'s phone number in the app.`,
        ],
        rows: [["Place", place(p)], ["What", itemsText(p.items)], ["Period", period(p)]],
        button: { href: links.renter, label: "View the booking" },
      };
    case "request_declined":
      return {
        subject: `Answer to your request for “${p.listing_title}”`,
        intro: [hello, `Unfortunately ${name} can't take your request for “${p.listing_title}”.`],
        rows: [["Period", period(p)], ...(p.decline_reason.trim() ? ([["Reason", p.decline_reason.trim()]] as [string, string][]) : [])],
        after: ["There are more spaces to rent. Search again and you may find one nearby."],
        button: { href: links.search, label: "Find another space" },
      };
    case "cancelled_by_renter": {
      const withdrawn = p.prev_status === "pending";
      return {
        subject: withdrawn ? `${name} has withdrawn the request` : isHour ? `${name} has cancelled the parking` : `${name} has cancelled`,
        intro: [
          hello,
          withdrawn
            ? `${name} has withdrawn the request for “${p.listing_title}”. You don't need to do anything.`
            : `${name} has cancelled ${isHour ? "the parking" : "the storage"} in “${p.listing_title}”. The space is free again for others.`,
        ],
        rows: [[isHour ? "Time" : "Period", period(p)], ["What", itemsText(p.items)], ...(p.cancel_reason.trim() ? ([["Message", p.cancel_reason.trim()]] as [string, string][]) : [])],
        button: { href: links.host, label: "View in the app" },
      };
    }
    case "cancelled_by_host":
      return {
        subject: isHour ? `Your parking in “${p.listing_title}” is cancelled` : `Your storage in “${p.listing_title}” is cancelled`,
        intro: [hello, `Unfortunately ${name} has cancelled ${isHour ? "your parking" : "your storage"} in “${p.listing_title}”.`],
        rows: [[isHour ? "Time" : "Period", period(p)], ...(p.cancel_reason.trim() ? ([["Reason", p.cancel_reason.trim()]] as [string, string][]) : [])],
        after: ["Do search for another space nearby. Get in touch if you need help."],
        button: { href: links.search, label: "Find another space" },
      };
    case "payment_failed": {
      const pay = p.payment;
      const first = !pay || pay.period_start === p.start_date;
      return {
        subject: `The payment for “${p.listing_title}” didn't go through`,
        intro: [
          hello,
          `We couldn't charge ${pay ? kr(pay.amount) : "the rent"} to your card${pay ? ` for ${day(pay.period_start)} – ${day(pay.period_end)}` : ""}. The card may have expired, there may not be enough money, or your bank may want you to confirm the payment.`,
        ],
        rows: [["Place", place(p)], ...(pay ? ([["To pay", kr(pay.amount)], ["Pay by", deadline(pay.pay_by)]] as [string, string][]) : [])],
        after: [first ? "If you don't pay in time, the rental is cancelled." : "If you don't pay in time, the rental ends after the last paid day."],
        button: { href: links.renter, label: "Pay now" },
      };
    }
    case "payment_lapsed": {
      const first = !p.payment || p.payment.period_start === p.start_date;
      const end = p.end_date ? day(p.end_date) : "";
      return p.role === "renter"
        ? {
            subject: first ? `The booking of “${p.listing_title}” was cancelled` : `The rental of “${p.listing_title}” is ending`,
            intro: [
              hello,
              first
                ? "The payment for the first month didn't come in on time, so the booking has been cancelled. You haven't paid anything."
                : `The payment for next month didn't come in on time, so the rental ends ${end}. Pick up your things by then, or contact ${name} in the app.`,
            ],
            rows: [["Place", place(p)]],
            button: { href: first ? links.search : links.renter, label: first ? "Find another space" : "View in the app" },
          }
        : {
            subject: first ? `${name} didn't pay, the booking was cancelled` : `${name} didn't pay, the rental is ending`,
            intro: [
              hello,
              first
                ? `${name} never paid the first month for “${p.listing_title}”, so the booking has been cancelled. The space is free again.`
                : `${name} didn't pay next month for “${p.listing_title}”, so the rental ends ${end}. You are paid for the time until then.`,
            ],
            rows: [["What", itemsText(p.items)]],
            button: { href: links.host, label: "View in the app" },
          };
    }
    case "rental_ending": {
      const end = p.end_date ? day(p.end_date) : "";
      const reason: [string, string][] = p.cancel_reason.trim() ? [["Message", p.cancel_reason.trim()]] : [];
      return p.role === "host"
        ? {
            subject: `${name} is ending the rental of “${p.listing_title}”`,
            intro: [hello, `${name} has ended the rental. The last day is ${end}, and no more payments are made after that. The space is free for others after that.`],
            rows: [["What", itemsText(p.items)], ["Last day", end], ...reason],
            button: { href: links.host, label: "View in the app" },
          }
        : {
            subject: `${name} is ending the rental of “${p.listing_title}”`,
            intro: [hello, `${name} has ended the rental. The last day is ${end}, and no more payments are made after that. Pick up your things by then.`],
            rows: [["Place", place(p)], ["Last day", end], ...reason],
            button: { href: links.renter, label: "View in the app" },
          };
    }
    case "new_message": {
      const unread = (p.unread ?? []).filter((m) => m.body.trim());
      if (unread.length === 0) return null;
      const time = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const area = p.role === "host" ? "vard" : "kund";
      return {
        subject: unread.length === 1 ? `New message from ${name}` : `${unread.length} new messages from ${name}`,
        intro: [hello, `${name} has written to you about “${p.listing_title}”.`],
        rows: unread.map((m) => [time.format(new Date(m.created_at)), m.body === "[image]" ? "Sent a photo" : m.body.length > 600 ? `${m.body.slice(0, 600)} …` : m.body] as [string, string]),
        after: [`Reply in the app so you both see the whole conversation in one place. Replies to this email go to Spazia, not to ${name}.`],
        button: { href: `${links.appUrl}/${area}/meddelanden${p.conversation_id ? `?id=${p.conversation_id}` : ""}`, label: "Reply in the app" },
      };
    }
    case "handover_new": {
      const what = p.prev_status === "pickup" ? "pickup" : "drop-off";
      return {
        subject: `${name} has recorded the ${what}: please confirm the list`,
        intro: [hello, `${name} has listed and photographed the things at the ${what} for “${p.listing_title}”. Look through the list and photos in the app and confirm that it matches, or write what doesn't.`],
        rows: [["Place", place(p)], ["Period", period(p)]],
        after: ["The list is part of the rental agreement. Confirm it soon, while you both remember how things looked."],
        button: { href: p.role === "host" ? links.host : links.renter, label: "View the list" },
      };
    }
    case "handover_answered": {
      const ok = p.prev_status === "ok";
      return {
        subject: ok ? `${name} has confirmed the list` : `${name} says the list doesn't match`,
        intro: [
          hello,
          ok
            ? `${name} has confirmed the inventory list for “${p.listing_title}”. It is now part of the rental agreement.`
            : `${name} says the inventory list for “${p.listing_title}” doesn't match, and has written what differs in the app. Talk it through there and correct the list.`,
        ],
        rows: [["Place", place(p)]],
        button: { href: p.role === "host" ? links.host : links.renter, label: "View in the app" },
      };
    }
    case "review_invite":
      return {
        subject: p.role === "host" ? `How was it letting space to ${name}?` : `How was it renting from ${name}?`,
        intro: [
          hello,
          p.role === "host"
            ? `Please leave a short review of ${name}. It helps other hosts, and your review is shown only once ${name} has left theirs, or in 14 days.`
            : `Please leave a short review of ${name} and “${p.listing_title}”. It helps others looking for space, and your review is shown only once ${name} has left theirs, or in 14 days.`,
        ],
        rows: [["Place", place(p)], ["Period", period(p)]],
        button: { href: p.role === "host" ? links.host : links.renter, label: "Leave a review" },
      };
    case "payout_setup": {
      const share = p.payment ? kr(p.payment.host_amount) : null;
      const reminder = p.prev_status === "reminder";
      return {
        subject: reminder
          ? `Your money is waiting${share ? `: ${share}` : ""}. Add your bank account`
          : `${name} has paid${share ? `, ${share} for you` : ""}. Add your bank account`,
        intro: [
          hello,
          reminder
            ? `The rent for “${p.listing_title}” is ready to be paid out, but we have no bank account to send it to.`
            : `${name} has paid for “${p.listing_title}”. We pay out your share the day after the period ends.`,
        ],
        rows: [["Place", place(p)], [p.request_kind === "hour" ? "Time" : "Period", period(p)], ...(share ? ([["Your share", share]] as [string, string][]) : [])],
        after: [
          "To pay it out we need your name, Swedish personal identity number and a bank account. It takes a couple of minutes and you only do it once. Our payment partner Stripe checks your identity, as the law requires.",
        ],
        button: { href: `${links.appUrl}/vard/utbetalningar`, label: "Add bank account" },
      };
    }
    default:
      return null;
  }
}
