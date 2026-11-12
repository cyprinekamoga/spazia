"use client";

import { useEffect } from "react";
import { appLang } from "@/lib/app/lang";
import { site } from "@/lib/site";

/**
 * Sends errors from this browser to the team (/api/client-error on
 * spazia.se), so we hear about crashes nobody reports. At most five per page
 * load; the server throttles further. The address is sent without its query
 * (no ids or codes), and nothing about the user.
 */
export function ErrorReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    let sent = 0;
    const report = (message: string, stack: string) => {
      if (sent >= 5 || !message) return;
      sent++;
      const body = JSON.stringify({ message: message.slice(0, 500), stack: stack.slice(0, 4000), url: window.location.origin + window.location.pathname, lang: appLang });
      fetch(`${site.url}/api/client-error`, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    };
    const onError = (e: ErrorEvent) => report(e.message || String(e.error ?? ""), e.error instanceof Error ? (e.error.stack ?? "") : `${e.filename}:${e.lineno}:${e.colno}`);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(r instanceof Error ? r.message : String(r), r instanceof Error ? (r.stack ?? "") : "");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
