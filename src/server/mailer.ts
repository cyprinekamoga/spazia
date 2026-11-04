/**
 * Sends email over SMTP (Strato today, any SMTP service works). Settings in
 * Netlify environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * MAIL_FROM, MAIL_TO. MAIL_DRY_RUN=1 logs the messages instead (tests).
 */
import nodemailer, { type Transporter } from "nodemailer";
import type { MailMessage } from "../lib/lead-emails";
import { env } from "./env";

export interface OutgoingMail extends MailMessage {
  icalEvent?: { method: string; filename: string; content: string };
}

export function teamAddress(): string {
  return env("MAIL_TO") || "info@nordvra.se";
}

let transport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  if (env("MAIL_DRY_RUN") === "1") {
    transport = nodemailer.createTransport({ jsonTransport: true });
    return transport;
  }
  const host = env("SMTP_HOST");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  if (!host || !user || !pass) {
    transport = null;
    return null;
  }
  const port = Number(env("SMTP_PORT") || 587);
  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 1,
  });
  return transport;
}

/** For tests: pick up changed environment variables. */
export function resetMailerForTests() {
  transport = undefined;
}

export function mailConfigured(): boolean {
  return getTransport() !== null;
}

/** Send one email. Returns false (and logs) instead of throwing. */
export async function sendMail(message: OutgoingMail): Promise<boolean> {
  const t = getTransport();
  if (!t) {
    console.warn(`mail: SMTP not configured, not sending "${message.subject}"`);
    return false;
  }
  const from = env("MAIL_FROM") || `Spazia <${env("SMTP_USER") || teamAddress()}>`;
  try {
    const info = await t.sendMail({ from, ...message });
    if (env("MAIL_DRY_RUN") === "1") (globalThis as { __sentMail?: unknown[] }).__sentMail?.push(JSON.parse(String(info.message)));
    console.log(`mail: sent "${message.subject}"`);
    return true;
  } catch (err) {
    console.error(`mail: could not send "${message.subject}":`, err);
    return false;
  }
}
