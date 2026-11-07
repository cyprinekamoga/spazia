"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { LogoMark } from "@/components/Logo";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { useSession } from "@/lib/app/session";
import { site } from "@/lib/site";
import { supabase } from "@/lib/supabase";

const t = appText.login;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Only allow redirects inside the site (no "//evil.com"). */
export function safeNext(value: string | null, fallback = "/konto"): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

type Providers = { google: boolean; apple: boolean };

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.1 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5zM14.18 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23z" />
    </svg>
  );
}

export function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const session = useSession();
  const [providers, setProviders] = useState<Providers>({ google: true, apple: false });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"start" | "sent">("start");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Already logged in (or just came back from Google / the email link): go on.
  useEffect(() => {
    if (session.status === "signedIn") router.replace(next);
  }, [session.status, next, router]);

  // Which social logins are switched on in Supabase.
  useEffect(() => {
    fetch(`${site.appSupabaseUrl}/auth/v1/settings`, { headers: { apikey: site.appSupabaseKey } })
      .then((r) => r.json())
      .then((s: { external?: Record<string, boolean> }) => setProviders({ google: Boolean(s.external?.google), apple: Boolean(s.external?.apple) }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const redirectTo = () => `${window.location.origin}/logga-in?next=${encodeURIComponent(next)}`;

  async function social(provider: "google" | "apple") {
    setError(null);
    if (!providers[provider]) {
      setError(fill(t.errors.provider, { provider: provider === "google" ? "Google" : "Apple" }));
      return;
    }
    setBusy(true);
    const { error: err } = await supabase().auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (err) {
      setBusy(false);
      setError(t.errors.generic);
    }
  }

  async function sendEmail(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) {
      setError(t.errors.email);
      return;
    }
    setBusy(true);
    const { error: err } = await supabase().auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
    setBusy(false);
    if (err) {
      setError(err.status === 429 ? t.errors.rate : t.errors.generic);
      return;
    }
    setEmail(address);
    setStep("sent");
    setCooldown(60);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase().auth.verifyOtp({ email, token: code.replace(/\s/g, ""), type: "email" });
    setBusy(false);
    if (err) setError(t.errors.code);
  }

  return (
    <main className="flex min-h-dvh items-start justify-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-10 sm:items-center sm:pt-10">
      <div className="w-full max-w-sm">
        <a href={site.url} aria-label="Spazia" className="mx-auto block w-fit">
          <LogoMark className="h-14 w-auto" id="login-logo" />
        </a>

        {step === "start" ? (
          <>
            <h1 className="mt-6 text-center text-[2rem] leading-tight text-night">{t.title}</h1>
            <p className="mt-2 text-center text-muted">{t.lead}</p>
            <div className="mt-8 space-y-3">
              <button type="button" onClick={() => social("google")} disabled={busy} className="btn w-full border-[1.5px] border-line bg-paper text-night hover:border-night">
                <GoogleIcon />
                {t.google}
              </button>
              {providers.apple && (
                <button type="button" onClick={() => social("apple")} disabled={busy} className="btn w-full bg-black text-white hover:bg-night">
                  <AppleIcon />
                  {t.apple}
                </button>
              )}
            </div>
            <div className="my-6 flex items-center gap-3 text-sm text-muted">
              <span className="h-px flex-1 bg-line" />
              {t.or}
              <span className="h-px flex-1 bg-line" />
            </div>
            <form onSubmit={sendEmail} noValidate className="space-y-3">
              <label htmlFor="login-email" className="field-label">
                {t.email}
              </label>
              <input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="field-input"
                placeholder={t.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error === t.errors.email ? true : undefined}
              />
              <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}
                {t.emailButton}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-center text-[2rem] leading-tight text-night">{t.sentTitle}</h1>
            <p className="mt-3 text-center leading-relaxed text-muted">{fill(t.sentText, { email })}</p>
            <form onSubmit={verify} noValidate className="mt-8 space-y-3">
              <label htmlFor="login-code" className="field-label">
                {t.code}
              </label>
              <input
                id="login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="field-input text-center text-2xl tracking-[0.3em]"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
              />
              <button type="submit" className="btn btn-primary w-full" disabled={busy || code.replace(/\s/g, "").length < 6}>
                {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                {t.codeButton}
              </button>
            </form>
            <div className="mt-5 flex flex-col items-center gap-1 text-[0.95rem]">
              <button type="button" className="min-h-11 font-semibold text-night underline underline-offset-4 disabled:text-muted disabled:no-underline" disabled={cooldown > 0 || busy} onClick={() => sendEmail()}>
                {cooldown > 0 ? fill(t.resendIn, { seconds: cooldown }) : t.resend}
              </button>
              <button type="button" className="min-h-11 text-muted underline underline-offset-4" onClick={() => { setStep("start"); setCode(""); setError(null); }}>
                {t.otherEmail}
              </button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-[#fef3f2] p-4 text-[0.95rem] font-medium text-[#b42318]">
            {error}
          </p>
        )}

        <p className="mt-8 text-center text-sm leading-relaxed text-muted">
          {t.terms}{" "}
          <a href={`${site.url}/integritetspolicy`} className="underline underline-offset-4">
            {t.termsLink}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
