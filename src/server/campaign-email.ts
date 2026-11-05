/**
 * The admin page's "email a city" message. Pure function: it only builds
 * the message.
 */
import { escapeHtml, htmlLayout } from "../lib/lead-emails";
import type { Lead } from "./db";
import type { OutgoingMail } from "./mailer";

type Lang = "sv" | "en";

const langOf = (lead: Lead): Lang => (lead.data.lang === "en" ? "en" : "sv");
const nameOf = (lead: Lead) => lead.data.first_name || "–";

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
