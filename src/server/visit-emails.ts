/**
 * Emails about visits (booked, changed, cancelled) and the admin page's
 * "email a city" messages. Pure functions: they only build the messages.
 */
import { areas } from "../content/areas";
import { sv } from "../content/sv";
import {
  bookingUrl,
  buttonHtml,
  escapeHtml,
  htmlLayout,
  htmlTable,
  labelValue,
  paragraphsHtml,
} from "../lib/lead-emails";
import { formatSlot, icsTime } from "../lib/time";
import type { Booking, Lead, Slot } from "./db";
import type { OutgoingMail } from "./mailer";

type Lang = "sv" | "en";

const langOf = (lead: Lead): Lang => (lead.data.lang === "en" ? "en" : "sv");
const nameOf = (lead: Lead) => lead.data.first_name || "–";

function areaName(slug: string | undefined): string {
  if (!slug) return "";
  return areas.find((a) => a.slug === slug)?.name ?? (slug === "other" ? "Annat område" : slug);
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Calendar file so the host can add the visit to their phone's calendar. */
export function visitIcs(slot: Slot, booking: Booking, lang: Lang, cancelled = false): string {
  const summary = lang === "sv" ? "Spazia besöker ditt utrymme" : "Spazia visits your space";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Spazia//Besok//SV",
    `METHOD:${cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${slot.id}-${booking.leadId}@spazia.se`,
    `DTSTAMP:${icsTime(new Date().toISOString())}`,
    `DTSTART:${icsTime(slot.start)}`,
    `DTEND:${icsTime(slot.end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape(booking.address)}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

const copy = {
  sv: {
    bookedSubject: (when: string) => `Besök bokat ${when}`,
    booked: (name: string, when: string) => [
      `Hej ${name}!`,
      `Tack! Vi kommer och tittar på ditt utrymme ${when}. Besöket tar ungefär en halvtimme och är gratis.`,
      "Vi kontrollerar att utrymmet är torrt och går att låsa, tipsar om hur mycket plats du kan hyra ut och tar bilderna till annonsen.",
    ],
    details: "Det här har du bokat:",
    when: "Tid",
    address: "Adress",
    phone: "Telefon",
    change: "Behöver du byta tid eller avboka? Gör det här:",
    changeButton: "Byt tid eller avboka",
    cancelledSubject: "Ditt besök är avbokat",
    cancelled: (name: string, when: string) => [`Hej ${name}!`, `Besöket ${when} är avbokat.`],
    rebookSubject: "Vi behöver boka om ditt besök",
    rebook: (name: string, when: string) => [
      `Hej ${name}!`,
      `Tyvärr kan vi inte komma ${when} som planerat. Förlåt för krånglet.`,
    ],
    bookAgain: "Välj en ny tid här, eller svara på mejlet så hjälper vi dig:",
    bookAgainButton: "Välj en ny tid",
    signoff: "Hälsningar\nSpazia",
    footer: "Du får det här mejlet för att du bokade ett besök på spazia.se. Svara på mejlet om du har frågor.",
  },
  en: {
    bookedSubject: (when: string) => `Visit booked for ${when}`,
    booked: (name: string, when: string) => [
      `Hi ${name},`,
      `Thank you! We'll come and look at your space on ${when}. The visit takes about half an hour and is free.`,
      "We check that the space is dry and can be locked, suggest how much you can rent out and take the photos for your listing.",
    ],
    details: "Your booking:",
    when: "Time",
    address: "Address",
    phone: "Phone",
    change: "Need to change the time or cancel? Do it here:",
    changeButton: "Change or cancel",
    cancelledSubject: "Your visit is cancelled",
    cancelled: (name: string, when: string) => [`Hi ${name},`, `The visit on ${when} is cancelled.`],
    rebookSubject: "We need to rebook your visit",
    rebook: (name: string, when: string) => [
      `Hi ${name},`,
      `Unfortunately we can't come on ${when} as planned. Sorry for the trouble.`,
    ],
    bookAgain: "Pick a new time here, or reply to this email and we'll help you:",
    bookAgainButton: "Pick a new time",
    signoff: "Best wishes\nSpazia",
    footer: "You are receiving this because you booked a visit on spazia.se. Reply to this email if you have any questions.",
  },
};

function signoffHtml(signoff: string): string {
  return `<p style="margin:0;font-size:16px;line-height:1.55">${escapeHtml(signoff).replace("\n", "<br>")}<br><a href="https://spazia.se" style="color:#2f6b75">spazia.se</a></p>`;
}

export function hostBookedEmail(lead: Lead, booking: Booking, slot: Slot, site: string, team: string): OutgoingMail {
  const lang = langOf(lead);
  const c = copy[lang];
  const when = formatSlot(slot.start, lang);
  const intro = c.booked(nameOf(lead), when);
  const rows: [string, string][] = [
    [c.when, when],
    [c.address, booking.address],
    [c.phone, booking.phone],
  ];
  const link = bookingUrl(site, lead.id, lang);
  return {
    to: lead.data.email,
    replyTo: team,
    subject: c.bookedSubject(when),
    text: `${intro.join("\n\n")}\n\n${c.details}\n${rows.map(([k, v]) => labelValue(k, v)).join("\n")}\n\n${c.change}\n${link}\n\n${c.signoff}\nspazia.se\n\n${c.footer}`,
    html: htmlLayout(
      `${paragraphsHtml(intro)}<p style="margin:18px 0 8px;font-size:15px;font-weight:700">${escapeHtml(c.details)}</p>${htmlTable(rows)}<div style="margin-top:20px">${paragraphsHtml([c.change])}${buttonHtml(link, c.changeButton)}</div>${signoffHtml(c.signoff)}`,
      escapeHtml(c.footer),
    ),
    icalEvent: { method: "PUBLISH", filename: "spazia-besok.ics", content: visitIcs(slot, booking, lang) },
  };
}

export function hostCancelledEmail(lead: Lead, slot: Slot, site: string, team: string, byTeam: boolean): OutgoingMail {
  const lang = langOf(lead);
  const c = copy[lang];
  const when = formatSlot(slot.start, lang);
  const intro = byTeam ? c.rebook(nameOf(lead), when) : c.cancelled(nameOf(lead), when);
  const link = bookingUrl(site, lead.id, lang);
  return {
    to: lead.data.email,
    replyTo: team,
    subject: byTeam ? c.rebookSubject : c.cancelledSubject,
    text: `${intro.join("\n\n")}\n\n${c.bookAgain}\n${link}\n\n${c.signoff}\nspazia.se\n\n${c.footer}`,
    html: htmlLayout(
      `${paragraphsHtml(intro)}${paragraphsHtml([c.bookAgain])}${buttonHtml(link, c.bookAgainButton)}${signoffHtml(c.signoff)}`,
      escapeHtml(c.footer),
    ),
  };
}

/** To the team, always in Swedish. */
export function teamVisitEmail(
  event: "booked" | "cancelled",
  lead: Lead,
  slot: Slot,
  booking: Booking | null,
  site: string,
  team: string,
  previous?: Slot | null,
): OutgoingMail {
  const name = nameOf(lead);
  const when = formatSlot(slot.start, "sv");
  const area = areaName(lead.data.area);
  const rows: [string, string][] = (
    [
      ["Tid", when],
      ["Tidigare tid", previous ? formatSlot(previous.start, "sv") : ""],
      ["Namn", name],
      ["Telefon", booking?.phone ?? lead.data.phone ?? ""],
      ["E-post", lead.data.email ?? ""],
      ["Adress", booking?.address ?? ""],
      ["Område", area],
      ["Typ av utrymme", lead.data.space_type ? sv.forms.host.spaceTypes[lead.data.space_type as keyof typeof sv.forms.host.spaceTypes] ?? lead.data.space_type : ""],
      ["Meddelande", booking?.note ?? ""],
    ] as [string, string][]
  ).filter(([, v]) => v !== "");
  const title = event === "booked" ? (previous ? "Besök ombokat" : "Besök bokat") : "Besök avbokat";
  const adminUrl = `${site}/admin#lead=${lead.id}`;
  return {
    to: team,
    replyTo: lead.data.email,
    subject: `${title}: ${name}, ${when}${area ? `, ${area}` : ""}`,
    text: `${title}\n\n${rows.map(([k, v]) => labelValue(k, v)).join("\n")}\n\nÖppna i admin: ${adminUrl}`,
    html: htmlLayout(
      `<p style="margin:0 0 16px;font-size:18px;font-weight:700">${escapeHtml(title)}</p>${htmlTable(rows)}<div style="margin-top:16px">${buttonHtml(adminUrl, "Öppna i admin")}</div>`,
      "Skickat automatiskt från spazia.se",
    ),
    ...(event === "booked" && booking
      ? { icalEvent: { method: "PUBLISH", filename: "besok.ics", content: visitIcs(slot, booking, "sv") } }
      : {}),
  };
}

/**
 * A message written on the admin page, e.g. "we're opening in Umeå".
 * {namn}/{name} and {ort}/{town} are replaced per person.
 */
export function campaignEmail(lead: Lead, subject: { sv: string; en: string }, body: { sv: string; en: string }, team: string): OutgoingMail {
  const lang: Lang = langOf(lead) === "en" && body.en.trim() && subject.en.trim() ? "en" : "sv";
  const fillIn = (text: string) =>
    text
      .replace(/\{(namn|name)\}/g, nameOf(lead))
      .replace(/\{(ort|town)\}/g, lead.data.city || (lang === "sv" ? "din stad" : "your city"));
  const paragraphs = fillIn(body[lang]).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const footer =
    lang === "sv"
      ? "Du får det här mejlet för att du anmälde intresse på spazia.se. Vill du inte få fler mejl från oss? Svara på mejlet, så tar vi bort dig."
      : "You are receiving this because you registered your interest on spazia.se. Don't want any more emails from us? Reply and we'll remove you.";
  return {
    to: lead.data.email,
    replyTo: team,
    subject: fillIn(subject[lang]),
    text: `${paragraphs.join("\n\n")}\n\n${footer}`,
    html: htmlLayout(
      paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join(""),
      escapeHtml(footer),
    ),
  };
}
