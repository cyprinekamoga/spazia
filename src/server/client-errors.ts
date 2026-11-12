/**
 * Errors from people's browsers in the app, sent to the team by email:
 * at most once a day per distinct error, and at most 20 emails a day in all,
 * so a broken release can never flood the inbox. The counts live in Netlify
 * Blobs (EU).
 *
 * Only relative imports: the function bundler does not know the "@/" alias.
 */
import { getStore, type Store } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { env } from "./env";

export interface ClientError {
  message: string;
  stack: string;
  url: string;
  userAgent: string;
  lang: string;
}

const DAY = 24 * 60 * 60 * 1000;
export const DAILY_CAP = 20;

/** Noise that is not ours to fix: browser extensions, a known harmless resize warning, aborted loads. */
export function isNoise(e: Pick<ClientError, "message" | "stack">): boolean {
  const text = `${e.message}\n${e.stack}`;
  return (
    /chrome-extension:|moz-extension:|safari-extension:|webkit-masked-url:/.test(text) ||
    /ResizeObserver loop/.test(e.message) ||
    /^(Script error\.?|AbortError|Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?)$/i.test(e.message.trim()) ||
    /^The user aborted a request/.test(e.message)
  );
}

/** One fingerprint per error: the message without numbers and ids, and the first line of the stack. */
export function fingerprint(e: Pick<ClientError, "message" | "stack">): string {
  const message = e.message.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<id>").replace(/\d+/g, "<n>").slice(0, 300);
  const top = (e.stack.split("\n").find((l) => /at |@/.test(l)) ?? "").replace(/:\d+:\d+/g, "").replace(/\?[^)\s]*/g, "").trim().slice(0, 300);
  return createHash("sha256").update(`${message}\n${top}`).digest("hex").slice(0, 32);
}

let cached: Store | null = null;
function store(): Store {
  if (!cached) {
    const region = env("BLOBS_REGION") || "eu-central-1";
    cached = getStore({ name: "spazia-client-errors", consistency: "strong", ...(region === "none" ? {} : { region: region as "eu-central-1" }) });
  }
  return cached;
}

/**
 * Should this error be emailed now? Records it either way (count per
 * fingerprint), and says yes only for the first of the day within the cap.
 */
export async function shouldSend(fp: string, now = Date.now()): Promise<{ send: boolean; count: number }> {
  const s = store();
  const key = `fp/${fp}`;
  const seen = (await s.get(key, { type: "json" })) as { lastSent: number; count: number } | null;
  const count = (seen?.count ?? 0) + 1;
  const due = !seen || now - seen.lastSent > DAY;
  let send = false;
  if (due) {
    const dayKey = `day/${new Date(now).toISOString().slice(0, 10)}`;
    const sentToday = Number((await s.get(dayKey)) ?? 0);
    if (sentToday < DAILY_CAP) {
      send = true;
      await s.set(dayKey, String(sentToday + 1));
    }
  }
  await s.setJSON(key, { lastSent: send ? now : (seen?.lastSent ?? 0), count });
  return { send, count };
}

export function errorEmailText(e: ClientError, count: number): string {
  return [
    `Ett fel i appen hos en användare${count > 1 ? ` (har hänt ${count} gånger)` : ""}.`,
    "",
    `Fel: ${e.message}`,
    `Sida: ${e.url}`,
    `Webbläsare: ${e.userAgent}`,
    `Språk: ${e.lang}`,
    "",
    e.stack || "(ingen stack)",
    "",
    "Samma fel mejlas högst en gång per dygn.",
  ].join("\n");
}
