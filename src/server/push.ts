/**
 * Web push for the app (app.spazia.se). The VAPID key pair that signs our
 * push messages is created by the server on first use and kept in Netlify
 * Blobs (EU), so nobody has to generate or paste a secret; only the public
 * key leaves the server (/api/push-key).
 *
 * Only relative imports: the function bundler does not know the "@/" alias.
 */
import { getStore, type Store } from "@netlify/blobs";
import webpush from "web-push";
import { env } from "./env";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

const KEY = "vapid-keys";
let cachedStore: Store | null = null;
let cachedKeys: VapidKeys | null = null;

function store(): Store {
  if (!cachedStore) {
    const region = env("BLOBS_REGION") || "eu-central-1";
    cachedStore = getStore({ name: "spazia-push", consistency: "strong", ...(region === "none" ? {} : { region: region as "eu-central-1" }) });
  }
  return cachedStore;
}

/** The key pair, created once (if two requests race, the first one written wins). */
export async function vapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys;
  const s = store();
  let keys = (await s.get(KEY, { type: "json" })) as VapidKeys | null;
  if (!keys) {
    await s.setJSON(KEY, webpush.generateVAPIDKeys(), { onlyIfNew: true });
    keys = (await s.get(KEY, { type: "json" })) as VapidKeys | null;
  }
  if (!keys) throw new Error("no VAPID keys");
  cachedKeys = keys;
  return keys;
}

/**
 * Send one message to each of a user's devices. Returns the endpoints the
 * push service says are gone (to forget them). Never throws.
 */
export async function sendPush(targets: PushTarget[], message: PushMessage, contact: string): Promise<{ sent: number; gone: string[] }> {
  if (targets.length === 0) return { sent: 0, gone: [] };
  let keys: VapidKeys;
  try {
    keys = await vapidKeys();
  } catch (err) {
    console.error("push: no keys", err);
    return { sent: 0, gone: [] };
  }
  const payload = JSON.stringify(message);
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, {
          vapidDetails: { subject: `mailto:${contact}`, publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 60 * 60 * 24,
          urgency: "normal",
        });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(t.endpoint);
        else console.error("push: send failed", status, err);
      }
    }),
  );
  return { sent, gone };
}
