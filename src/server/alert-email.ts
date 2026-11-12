/**
 * Emails about new listings: a renter's saved search ("Bevaka") found
 * something, or a town on the waitlist got its first listings. Pure
 * functions: they only build the messages.
 *
 * Only relative imports: the function bundler does not know the "@/" alias.
 */
import { escapeHtml, htmlLayout, paragraphsHtml, buttonHtml } from "../lib/lead-emails";
import { listingPath } from "../lib/listing-seo";
import type { Lead } from "./db";
import type { OutgoingMail } from "./mailer";

type Lang = "sv" | "en";

export interface AlertListing {
  id: string;
  title: string;
  city: string;
  area_name: string;
  size_m2: number | null;
  price_month: number | null;
  price_hour: number | null;
}

export interface SearchMatchPayload {
  kind: "search_match";
  to_email: string | null;
  to_name: string | null;
  lang?: Lang | null;
  push?: { endpoint: string; p256dh: string; auth: string }[] | null;
  alert: { id: string; place: string; category: string | null; max_price: number | null };
  listings: AlertListing[];
}

const fmt = (n: number, lang: Lang) => new Intl.NumberFormat(lang === "sv" ? "sv-SE" : "en-GB", { maximumFractionDigits: 1 }).format(n);

function priceText(l: AlertListing, lang: Lang): string {
  if (l.price_month) return lang === "sv" ? `från ${fmt(l.price_month, lang)} kr/mån` : `from ${fmt(l.price_month, lang)} kr/month`;
  if (l.price_hour) return lang === "sv" ? `från ${fmt(l.price_hour, lang)} kr/tim` : `from ${fmt(l.price_hour, lang)} kr/hour`;
  return "";
}

const titleOf = (l: AlertListing, lang: Lang) => l.title || (lang === "sv" ? "Plats" : "Space");

/** "Porsön, Luleå · 10 m² · från 58 kr/mån" */
function details(l: AlertListing, lang: Lang): string {
  const where = [l.area_name, l.city].filter(Boolean).join(", ");
  const size = l.size_m2 ? `${fmt(Number(l.size_m2), lang)} m²` : "";
  return [where, size, priceText(l, lang)].filter(Boolean).join(" · ");
}

/** The listings as a text list and as HTML links. */
function listingBlock(listings: AlertListing[], appUrl: string, lang: Lang): { text: string; html: string } {
  const url = (l: AlertListing) => `${appUrl}${listingPath(l.id, lang)}`;
  return {
    text: listings.map((l) => `• ${titleOf(l, lang)} · ${details(l, lang)}\n  ${url(l)}`).join("\n"),
    html:
      `<ul style="margin:0 0 18px;padding:0;list-style:none">` +
      listings
        .map(
          (l) =>
            `<li style="margin:0 0 12px;padding:12px 14px;border:1px solid #dfe5e8;border-radius:12px">` +
            `<a href="${escapeHtml(url(l))}" style="color:#2f6b75;font-weight:700;font-size:16px;text-decoration:none">${escapeHtml(titleOf(l, lang))}</a>` +
            `<br><span style="color:#586670;font-size:14px">${escapeHtml(details(l, lang))}</span></li>`,
        )
        .join("") +
      `</ul>`,
  };
}

const ACCOUNT_FOOTER = {
  sv: "Du får det här mejlet för att du bevakar en ort på Spazia. Ta bort bevakningen i appen under Meny → Bevakningar.",
  en: "You're getting this email because you're watching a place on Spazia. Remove the alert in the app under Menu → Alerts.",
};

/** A saved search found new listings. */
export function searchMatchEmail(p: SearchMatchPayload, opts: { appUrl: string; team: string }): OutgoingMail | null {
  if (!p.to_email || p.listings.length === 0) return null;
  const lang: Lang = p.lang === "en" ? "en" : "sv";
  const place = p.alert.place;
  const n = p.listings.length;
  const hello = p.to_name ? (lang === "sv" ? `Hej ${p.to_name}!` : `Hi ${p.to_name}!`) : lang === "sv" ? "Hej!" : "Hi!";
  const subject =
    lang === "sv"
      ? n === 1
        ? `Ny plats i ${place}: ${p.listings[0].title || "se annonsen"}`
        : `${n} nya platser i ${place}`
      : n === 1
        ? `New space in ${place}: ${p.listings[0].title || "see the listing"}`
        : `${n} new spaces in ${place}`;
  const lead =
    lang === "sv"
      ? n === 1
        ? `En ny plats som matchar din bevakning av ${place} har just lagts upp.`
        : `${n} nya platser som matchar din bevakning av ${place} har just lagts upp.`
      : n === 1
        ? `A new space matching your alert for ${place} has just been listed.`
        : `${n} new spaces matching your alert for ${place} have just been listed.`;
  const after = lang === "sv" ? "Lediga platser brukar gå fort, så skicka en förfrågan om något passar." : "Free spaces tend to go quickly, so send a request if one suits you.";
  const search = `${opts.appUrl}/sok?ort=${encodeURIComponent(place)}${p.alert.category ? `&typ=${p.alert.category}` : ""}`;
  const button = lang === "sv" ? `Se alla platser i ${place}` : `See all spaces in ${place}`;
  const block = listingBlock(p.listings, opts.appUrl, lang);
  const footer = ACCOUNT_FOOTER[lang];
  return {
    to: p.to_email,
    replyTo: opts.team,
    subject,
    // The push notification takes the second paragraph's first line and the first app link.
    text: [hello, lead, block.text, after, `${button}: ${search}`, footer].join("\n\n"),
    html: htmlLayout(paragraphsHtml([hello, lead]) + block.html + paragraphsHtml([after]) + buttonHtml(search, button), escapeHtml(footer)),
  };
}

export interface AnnouncedListing extends AlertListing {
  categories: string[];
}

const WAITLIST_FOOTER = {
  sv: "Du får det här mejlet för att du anmälde intresse på spazia.se. Vill du inte få fler mejl från oss? Svara på mejlet, så tar vi bort dig.",
  en: "You're receiving this because you registered your interest on spazia.se. Don't want any more emails from us? Reply and we'll remove you.",
};

/** Someone on the waitlist: a listing has been published in their town. */
export function waitlistListingEmail(lead: Lead, l: AnnouncedListing, opts: { appUrl: string; team: string }): OutgoingMail | null {
  const to = lead.data.email;
  if (!to) return null;
  const lang: Lang = lead.data.lang === "en" ? "en" : "sv";
  const town = l.city;
  const name = lead.data.first_name;
  const hello = name ? (lang === "sv" ? `Hej ${name}!` : `Hi ${name}!`) : lang === "sv" ? "Hej!" : "Hi!";
  const subject = lang === "sv" ? `Nu finns det plats i ${town} på Spazia` : `There's now space in ${town} on Spazia`;
  const intro =
    lang === "sv"
      ? `Du anmälde intresse för förvaring i ${town}. Nu har en ny plats lagts upp där:`
      : `You registered your interest in storage in ${town}. A new space has just been listed there:`;
  const after =
    lang === "sv"
      ? `Logga in med Google eller din e-post och skicka en förfrågan direkt i appen. Vill du få besked så fort fler platser dyker upp? Tryck på Bevaka ${town} när du söker.`
      : `Log in with Google or your email and send a request straight in the app. Want to hear as soon as more spaces come up? Tap Watch ${town} when you search.`;
  const block = listingBlock([l], opts.appUrl, lang);
  const button = lang === "sv" ? "Se platsen" : "See the space";
  const href = `${opts.appUrl}${listingPath(l.id, lang)}`;
  const footer = WAITLIST_FOOTER[lang];
  return {
    to,
    replyTo: opts.team,
    subject,
    text: [hello, intro, block.text, after, `${button}: ${href}`, footer].join("\n\n"),
    html: htmlLayout(paragraphsHtml([hello, intro]) + block.html + paragraphsHtml([after]) + buttonHtml(href, button), escapeHtml(footer)),
  };
}
