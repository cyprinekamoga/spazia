"use client";

import { Bell, BellOff, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { appText } from "@/content/app";
import { site } from "@/lib/site";
import { supabase } from "@/lib/supabase";

const t = appText.push;

type State = "loading" | "unsupported" | "ios" | "off" | "on" | "denied";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Push notifications on this device, and "Install the app" where the browser offers it. */
export function PushSection({ uid }: { uid: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    let active = true;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let next: State;
      if (!supported) next = isIos() ? "ios" : "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else next = (await currentSubscription()) ? "on" : "off";
      if (active) setState(next);
    })();
    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const res = await fetch(`${site.url}/api/push-key`);
      const { key } = (await res.json()) as { key?: string };
      if (!key) throw new Error("no key");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const db = supabase();
      await db.from("push_subscriptions").delete().eq("endpoint", json.endpoint);
      const saved = await db.from("push_subscriptions").insert({
        user_id: uid,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 300),
      });
      if (saved.error) throw new Error(saved.error.message);
      setState("on");
    } catch (e) {
      console.error(e);
      setError(appText.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await supabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError(appText.common.error);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  return (
    <section className="card p-5" aria-labelledby="push-title">
      <h2 id="push-title" className="flex items-center gap-2 text-xl font-bold text-night">
        <Bell size={20} className="text-brand" aria-hidden="true" />
        {t.title}
      </h2>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{t.text}</p>
      {state === "on" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-night">{t.on}</p>
          <button type="button" disabled={busy} onClick={disable} className="btn btn-secondary">
            <BellOff size={18} aria-hidden="true" />
            {busy ? t.working : t.disable}
          </button>
        </div>
      )}
      {state === "off" && (
        <button type="button" disabled={busy} onClick={enable} className="btn btn-primary mt-3">
          <Bell size={18} aria-hidden="true" />
          {busy ? t.working : t.enable}
        </button>
      )}
      {state === "denied" && <p className="mt-3 text-[0.95rem] text-[#8a5a00]">{t.denied}</p>}
      {state === "ios" && <p className="mt-3 text-[0.95rem] text-ink">{t.iosHint}</p>}
      {state === "unsupported" && <p className="mt-3 text-[0.95rem] text-muted">{t.unsupported}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-[#b42318]">
          {error}
        </p>
      )}
      {install && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[0.95rem] text-muted">{t.installText}</p>
          <button
            type="button"
            onClick={async () => {
              await install.prompt();
              setInstall(null);
            }}
            className="btn btn-secondary mt-2"
          >
            <Download size={18} aria-hidden="true" />
            {t.install}
          </button>
        </div>
      )}
    </section>
  );
}
