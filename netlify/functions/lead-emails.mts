/**
 * Runs for every verified form submission (Netlify Forms):
 *  1. stores the lead in Netlify Blobs, where the admin page reads it
 *  2. emails the Spazia team (MAIL_TO, default info@nordvra.se)
 *  3. emails a confirmation to the person who registered; hosts in Luleå
 *     also get a link to book the visit
 *
 * SMTP settings (Netlify → Project configuration → Environment variables):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (secret), MAIL_FROM, MAIL_TO,
 *   MAIL_CONFIRMATION=off to stop confirmation emails.
 *
 * Netlify only runs this for submissions that passed its spam filter and the
 * honeypot, so bots do not trigger anything.
 */
import type { FormSubmittedEvent } from "@netlify/functions";
import { buildLeadEmails } from "../../src/lib/lead-emails";
import { saveLead } from "../../src/server/db";
import { env, siteUrl } from "../../src/server/env";
import { sendMail, teamAddress } from "../../src/server/mailer";

export async function handleSubmission(data: Record<string, string>) {
  // Store first: the emails link to the stored lead.
  let leadId: string | undefined;
  try {
    const lead = await saveLead(data);
    leadId = lead?.id;
  } catch (err) {
    // Netlify Forms still has the submission, so carry on with the emails.
    console.error("lead-emails: could not store the lead:", err);
  }

  const emails = buildLeadEmails(data, { teamAddress: teamAddress(), leadId, siteUrl: siteUrl() });
  if (!emails) {
    console.log("lead-emails: not a Spazia lead form, skipping");
    return [];
  }

  const messages = [emails.team];
  if (emails.confirmation && env("MAIL_CONFIRMATION") !== "off") messages.push(emails.confirmation);
  const results: boolean[] = [];
  for (const message of messages) {
    // A failing confirmation must not stop the team notification (sendMail logs and returns false).
    results.push(await sendMail(message));
  }
  return results;
}

const leadEmails = {
  async formSubmitted(event: FormSubmittedEvent) {
    await handleSubmission(event.data);
  },
};

export default leadEmails;
