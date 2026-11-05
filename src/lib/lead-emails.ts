/**
 * Builds the two emails sent for every registration:
 *  - a notification to the Spazia team (always in Swedish)
 *  - a confirmation to the person who registered (in their language)
 *
 * Used by netlify/functions/lead-emails.mts. Pure functions, no I/O, so they
 * can be tested locally. Only relative imports – the function bundler does
 * not know the "@/" alias.
 */
import { categories } from "../content/categories";
import { tidyTown } from "../content/cities";
import { en } from "../content/en";
import { sv } from "../content/sv";

export type LeadKind = "host" | "renter";

export interface MailMessage {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

type Data = Record<string, string | undefined>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Which form a submission came from. */
export function detectKind(data: Data): LeadKind | null {
  const formName = data["form-name"] ?? data.form_name;
  if (formName === "host-lead" || data.space_type) return "host";
  if (formName === "renter-lead" || data.items) return "renter";
  return null;
}

/* ---------- value → readable label ---------- */

function oneLine(value: string | undefined, max = 200): string {
  return (value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

/** The town the person typed, in its usual spelling. */
function townOf(data: Data): string {
  const town = oneLine(data.city, 80);
  return town ? tidyTown(town) : "";
}

function categoryList(value: string | undefined, lang: "sv" | "en"): string {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((id) => categories.find((c) => c.id === id)?.name[lang] ?? id)
    .join(", ");
}

function pick(record: Record<string, string>, value: string | undefined): string {
  if (!value) return "";
  return record[value] ?? value;
}

/** Rows of [label, value] describing the submission, in the given language. */
function describe(kind: LeadKind, data: Data, lang: "sv" | "en"): [string, string][] {
  const t = lang === "sv" ? sv : en;
  const f = t.forms;
  const town = townOf(data);
  const rows: [string, string][] =
    kind === "host"
      ? [
          [f.town, town],
          [f.host.spaceType, pick(f.host.spaceTypes, data.space_type)],
          [f.host.heated, pick(f.host.heatedOptions, data.heated)],
          [f.host.engineHeater, pick(f.host.engineHeaterOptions, data.engine_heater)],
          [f.host.size, pick(f.host.sizes, data.size)],
          [f.host.accepts, categoryList(data.accepts, lang)],
        ]
      : [
          [f.renter.items, categoryList(data.items, lang)],
          [f.renter.quantity, oneLine(data.quantity)],
          [f.town, town],
          [f.renter.start, pick(f.renter.starts, data.start)],
          [f.renter.duration, pick(f.renter.durations, data.duration)],
          [f.renter.engineHeater, pick(f.renter.engineHeaterOptions, data.engine_heater)],
          [f.renter.heated, pick(f.renter.heatedOptions, data.heated)],
          [f.renter.occupation, pick(f.renter.occupations, data.occupation)],
          [f.renter.bankid, pick(f.renter.bankidOptions, data.has_bankid)],
        ];
  return rows.filter(([, v]) => v !== "");
}

/* ---------- rendering ---------- */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Område: Porsön", but "Vad vill du förvara? Däck" for labels that are questions. */
export function labelValue(label: string, value: string): string {
  return /[?…]$/.test(label) ? `${label} ${value}` : `${label}: ${value}`;
}

export function htmlTable(rows: [string, string][]): string {
  const cells = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#586670;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td>` +
        `<td style="padding:6px 0;color:#1e2a31;font-weight:600;word-break:break-word;overflow-wrap:anywhere">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" style="border-collapse:collapse;font-size:15px;line-height:1.4">${cells}</table>`;
}

export function htmlLayout(body: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f6f8f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e2a31">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe5e8;border-radius:16px;padding:28px 24px">
<p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#2f6b75">Spazia</p>
${body}
</div>
<p style="max-width:560px;margin:16px auto 0;font-size:13px;line-height:1.5;color:#586670;text-align:center">${footer}</p>
</body></html>`;
}

export function paragraphsHtml(paragraphs: string[]): string {
  return paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55">${escapeHtml(p)}</p>`)
    .join("");
}

/** A button-style link for HTML emails. */
export function buttonHtml(href: string, label: string): string {
  return `<p style="margin:6px 0 18px"><a href="${escapeHtml(href)}" style="display:inline-block;background:#2f6b75;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:12px 20px;border-radius:999px">${escapeHtml(label)}</a></p>`;
}

/* ---------- the two emails ---------- */

const confirmationCopy = {
  sv: {
    host: {
      subject: "Tack för din anmälan till Spazia",
      intro: (name: string) => [
        `Hej ${name}!`,
        "Tack för att du vill hyra ut plats via Spazia. Vi hör av oss inom några dagar och hjälper dig att komma igång med annonsen. Det är gratis, och du förbinder dig inte till något.",
      ],
    },
    renter: {
      subject: "Vi letar plats åt dig",
      intro: (name: string, town: string) => [
        `Hej ${name}!`,
        `Tack för din förfrågan. Vi letar efter en verifierad värd ${town ? `i ${town}` : "nära dig"} och hör av oss så snart vi har hittat en.`,
      ],
    },
    summary: "Det här skickade du:",
    outro: "Har du frågor? Svara bara på det här mejlet.",
    signoff: "Hälsningar\nSpazia",
    footer: "Du får det här mejlet för att du anmälde dig på spazia.se. Var det inte du? Svara på mejlet så raderar vi uppgifterna.",
  },
  en: {
    host: {
      subject: "Thanks for registering with Spazia",
      intro: (name: string) => [
        `Hi ${name},`,
        "Thanks for wanting to rent out space through Spazia. We'll get in touch within a few days and help you get your listing started. It's free, and you're not committing to anything.",
      ],
    },
    renter: {
      subject: "We're looking for space for you",
      intro: (name: string, town: string) => [
        `Hi ${name},`,
        `Thanks for your request. We're looking for a verified host ${town ? `in ${town}` : "near you"} and will get in touch as soon as we've found one.`,
      ],
    },
    summary: "What you sent us:",
    outro: "Questions? Just reply to this email.",
    signoff: "Best wishes\nSpazia",
    footer: "You are receiving this because you registered on spazia.se. Wasn't you? Reply and we will delete your details.",
  },
};

export function buildLeadEmails(
  data: Data,
  opts: { teamAddress: string; leadId?: string; siteUrl?: string },
): { kind: LeadKind; team: MailMessage; confirmation: MailMessage | null } | null {
  const kind = detectKind(data);
  if (!kind) return null;

  const name = oneLine(data.first_name, 80) || "–";
  const email = oneLine(data.email, 200).toLowerCase();
  const validEmail = EMAIL_RE.test(email);
  const lang: "sv" | "en" = data.lang === "en" ? "en" : "sv";
  const town = townOf(data);

  /* Team notification – Swedish, reply goes straight to the person. */
  const teamRows: [string, string][] = [
    ["Namn", name],
    ["E-post", email],
    ["Telefon", oneLine(data.phone)],
    ...describe(kind, data, "sv"),
    ["Meddelande", oneLine(data.message, 1000)],
    ["Språk", lang === "sv" ? "Svenska" : "Engelska"],
    ["Källa", [data.utm_source, data.utm_medium, data.utm_campaign].filter(Boolean).join(" / ") || "Direkt"],
    ["Första sida", oneLine(data.landing_page)],
    ["Kom från", oneLine(data.referrer)],
  ].filter(([, v]) => v !== "") as [string, string][];

  const where = town || "ort saknas";
  const teamSubject =
    kind === "host"
      ? `Ny värd: ${name}, ${where} (${pick(sv.forms.host.spaceTypes, data.space_type).toLowerCase()})`
      : `Ny hyresgäst: ${name}, ${categoryList(data.items, "sv").toLowerCase()} (${where})`;

  const siteUrl = opts.siteUrl ?? "https://spazia.se";
  const adminUrl = opts.leadId ? `${siteUrl}/admin#lead=${opts.leadId}` : "";
  const adminLine = adminUrl ? `\n\nÖppna i admin: ${adminUrl}` : "";
  const adminHtml = adminUrl ? buttonHtml(adminUrl, "Öppna i admin") : "";

  const team: MailMessage = {
    to: opts.teamAddress,
    replyTo: validEmail ? email : undefined,
    subject: oneLine(teamSubject, 180),
    text: `${kind === "host" ? "Ny värd" : "Ny hyresgäst"} på spazia.se\n\n${teamRows
      .map(([k, v]) => labelValue(k, v))
      .join("\n")}\n\nSvara på mejlet för att kontakta ${name} direkt.${adminLine}`,
    html: htmlLayout(
      `<p style="margin:0 0 16px;font-size:18px;font-weight:700">${
        kind === "host" ? "Ny värd" : "Ny hyresgäst"
      }</p>${htmlTable(teamRows)}<p style="margin:18px 0 0;font-size:15px;color:#586670">Svara på mejlet för att kontakta ${escapeHtml(
        name,
      )} direkt.</p><div style="margin-top:16px">${adminHtml}</div>`,
      "Skickat automatiskt från formuläret på spazia.se",
    ),
  };

  /* Confirmation to the person who registered. */
  let confirmation: MailMessage | null = null;
  if (validEmail) {
    const c = confirmationCopy[lang];
    const intro = c[kind].intro(name, town);
    const rows = describe(kind, data, lang);
    confirmation = {
      to: email,
      replyTo: opts.teamAddress,
      subject: c[kind].subject,
      text: `${intro.join("\n\n")}\n\n${c.summary}\n${rows.map(([k, v]) => labelValue(k, v)).join("\n")}\n\n${c.outro}\n\n${c.signoff}\nspazia.se\n\n${c.footer}`,
      html: htmlLayout(
        `${paragraphsHtml(intro)}<p style="margin:18px 0 8px;font-size:15px;font-weight:700">${escapeHtml(c.summary)}</p>${htmlTable(
          rows,
        )}<div style="margin-top:20px">${paragraphsHtml([c.outro])}</div><p style="margin:0;font-size:16px;line-height:1.55">${escapeHtml(
          c.signoff,
        ).replace("\n", "<br>")}<br><a href="https://spazia.se" style="color:#2f6b75">spazia.se</a></p>`,
        escapeHtml(c.footer),
      ),
    };
  }

  return { kind, team, confirmation };
}
