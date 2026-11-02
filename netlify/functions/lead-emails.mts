/**
 * Sends two emails for every verified form submission (Netlify Forms):
 *  1. a notification to the Spazia team (MAIL_TO, default info@nordvra.se)
 *  2. a confirmation to the person who registered
 *
 * Works with any email service that offers SMTP. Environment variables
 * (Netlify → Project configuration → Environment variables, scope "Functions"):
 *
 *   SMTP_HOST      e.g. smtp.gmail.com, smtp.office365.com, mailcluster.loopia.se
 *   SMTP_PORT      465 (SSL) or 587 (STARTTLS)
 *   SMTP_USER      usually the full email address
 *   SMTP_PASS      password or app password – mark as secret
 *   MAIL_FROM      sender, e.g. "Spazia <info@nordvra.se>" (defaults to SMTP_USER)
 *   MAIL_TO        who gets the notifications (defaults to info@nordvra.se)
 *   MAIL_CONFIRMATION  set to "off" to stop confirmation emails
 *
 * Netlify only runs this for submissions that passed its spam filter and the
 * honeypot, so bots do not trigger emails.
 */
import type { FormSubmittedEvent } from "@netlify/functions";
import nodemailer from "nodemailer";
import { buildLeadEmails } from "../../src/lib/lead-emails";

function env(key: string): string {
  const fromNetlify = typeof Netlify !== "undefined" ? Netlify.env.get(key) : undefined;
  return (fromNetlify ?? process.env[key] ?? "").trim();
}

function createTransport() {
  if (env("MAIL_DRY_RUN") === "1") {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  const host = env("SMTP_HOST");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  if (!host || !user || !pass) return null;
  const port = Number(env("SMTP_PORT") || 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
  });
}

export async function handleSubmission(data: Record<string, string>) {
  const teamAddress = env("MAIL_TO") || "info@nordvra.se";
  const emails = buildLeadEmails(data, { teamAddress });
  if (!emails) {
    console.log("lead-emails: not a Spazia lead form, skipping");
    return [];
  }

  const transport = createTransport();
  if (!transport) {
    console.warn("lead-emails: SMTP_HOST/SMTP_USER/SMTP_PASS not set – no emails sent");
    return [];
  }

  const from = env("MAIL_FROM") || `Spazia <${env("SMTP_USER") || teamAddress}>`;
  const messages = [emails.team];
  if (emails.confirmation && env("MAIL_CONFIRMATION") !== "off") messages.push(emails.confirmation);

  const results = [];
  for (const message of messages) {
    try {
      const info = await transport.sendMail({ from, ...message });
      console.log(`lead-emails: sent "${message.subject}"`);
      results.push(info);
    } catch (error) {
      // Log and carry on: a failing confirmation must not stop the team notification.
      console.error(`lead-emails: could not send "${message.subject}":`, error);
    }
  }
  return results;
}

const leadEmails = {
  async formSubmitted(event: FormSubmittedEvent) {
    await handleSubmission(event.data);
  },
};

export default leadEmails;
