/**
 * Limits guessing of the admin password: after MAX_FAILURES wrong passwords
 * within WINDOW, logins pause until the window has passed. Counted for the
 * whole site, not per visitor, so spreading the guesses over many addresses
 * doesn't help. The count lives in Netlify Blobs (EU).
 *
 * Only relative imports: the function bundler does not know the "@/" alias.
 */
import { getStore, type Store } from "@netlify/blobs";
import { env } from "./env";

export const WINDOW = 15 * 60 * 1000;
export const MAX_FAILURES = 10;
const KEY = "failures";

export interface Attempts {
  failures: number;
  since: number;
}

/** Locked: too many failures in the current window. */
export function isLocked(a: Attempts | null, now: number): boolean {
  return Boolean(a && now - a.since < WINDOW && a.failures >= MAX_FAILURES);
}

/** The count after one more failure (a new window starts when the old one has passed). */
export function afterFailure(a: Attempts | null, now: number): Attempts {
  return !a || now - a.since >= WINDOW ? { failures: 1, since: now } : { failures: a.failures + 1, since: a.since };
}

let cached: Store | null = null;
function store(): Store {
  if (!cached) {
    const region = env("BLOBS_REGION") || "eu-central-1";
    cached = getStore({ name: "spazia-admin-login", consistency: "strong", ...(region === "none" ? {} : { region: region as "eu-central-1" }) });
  }
  return cached;
}

export async function loginLocked(now = Date.now()): Promise<boolean> {
  return isLocked((await store().get(KEY, { type: "json" })) as Attempts | null, now);
}

export async function recordFailure(now = Date.now()): Promise<void> {
  const s = store();
  await s.setJSON(KEY, afterFailure((await s.get(KEY, { type: "json" })) as Attempts | null, now));
}

export async function clearFailures(): Promise<void> {
  await store().delete(KEY);
}
