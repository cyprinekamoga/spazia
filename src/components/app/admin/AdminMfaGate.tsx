"use client";

/* eslint-disable @next/next/no-img-element -- the QR code is an SVG data URL from Supabase */
import { ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Spinner } from "../AppShell";

type State =
  | { step: "loading" }
  | { step: "ok"; warning?: string }
  | { step: "verify"; factorId: string }
  | { step: "enroll"; factorId: string; qr: string; secret: string }
  | { step: "error"; text: string };

/**
 * Two-factor login for the admin page: the first time, set up an
 * authenticator app (Google Authenticator, Microsoft Authenticator, 1Password
 * …) with a QR code; after that, a six-digit code once per login. The database
 * refuses admin data without it once admin_mfa_required is on.
 */
export function AdminMfaGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ step: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const set = (s: State) => !cancelled && setState(s);
    (async () => {
      const mfa = supabase().auth.mfa;
      const level = await mfa.getAuthenticatorAssuranceLevel();
      if (level.data?.currentLevel === "aal2") return set({ step: "ok" });
      const factors = await mfa.listFactors();
      const verified = factors.data?.totp?.[0];
      if (verified) return set({ step: "verify", factorId: verified.id });
      // Leftovers from a setup that wasn't finished.
      for (const f of factors.data?.all ?? []) {
        if (f.status === "unverified") await mfa.unenroll({ factorId: f.id });
      }
      const enrolled = await mfa.enroll({ factorType: "totp", friendlyName: "Spazia admin", issuer: "Spazia" });
      if (enrolled.error || !enrolled.data) {
        // Two-factor can't be set up (switched off in Supabase?). While the database doesn't require it
        // yet, let the admin in with a warning rather than locking them out.
        const probe = await supabase().rpc("admin_log_entries", { p_limit: 1 });
        if (!probe.error) return set({ step: "ok", warning: enrolled.error?.message ?? "okänt fel" });
        return set({ step: "error", text: enrolled.error?.message ?? "" });
      }
      set({ step: "enroll", factorId: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
    })().catch((err: unknown) => set({ step: "error", text: err instanceof Error ? err.message : String(err) }));
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (state.step !== "verify" && state.step !== "enroll") return;
    setBusy(true);
    setWrong(false);
    const res = await supabase().auth.mfa.challengeAndVerify({ factorId: state.factorId, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (res.error) {
      setWrong(true);
      return;
    }
    setState({ step: "ok" });
  }

  if (state.step === "ok") {
    return (
      <>
        {state.warning && (
          <p role="alert" className="mx-auto mt-4 max-w-6xl rounded-xl bg-[#fff6e5] p-4 text-[0.95rem] text-night sm:mx-6 xl:mx-auto">
            Tvåstegsverifieringen gick inte att starta ({state.warning}). Slå på TOTP i Supabase under Authentication → Multi-Factor och ladda om sidan.
          </p>
        )}
        {children}
      </>
    );
  }
  if (state.step === "loading") return <Spinner />;

  return (
    <div className="mx-auto max-w-md px-4 pt-10 pb-16 sm:px-6">
      <ShieldCheck size={36} className="text-brand" aria-hidden="true" />
      <h1 className="mt-3 text-[2rem] leading-tight text-night">Tvåstegsverifiering</h1>
      {state.step === "error" ? (
        <>
          <p className="mt-3 leading-relaxed text-muted">
            Tvåstegsverifieringen gick inte att starta. Kontrollera att TOTP är påslaget i Supabase under Authentication → Multi-Factor, och ladda om sidan.
          </p>
          {state.text && <p className="mt-2 text-sm text-muted">({state.text})</p>}
        </>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-4">
          {state.step === "enroll" ? (
            <>
              <p className="leading-relaxed text-muted">
                Adminsidan skyddas med en kod från en autentiseringsapp, till exempel Google Authenticator, Microsoft Authenticator eller 1Password. Skanna QR-koden med appen och skriv in koden som visas.
              </p>
              <img src={state.qr} alt="QR-kod för autentiseringsappen" className="h-48 w-48 rounded-xl border border-line bg-white p-2" />
              <p className="text-sm leading-relaxed text-muted">
                Går det inte att skanna? Skriv in den här nyckeln i appen: <code className="break-all font-mono text-ink">{state.secret}</code>
              </p>
            </>
          ) : (
            <p className="leading-relaxed text-muted">Skriv in den sexsiffriga koden från din autentiseringsapp.</p>
          )}
          <div>
            <label htmlFor="mfa-code" className="field-label">
              Kod
            </label>
            <input
              id="mfa-code"
              className="field-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-invalid={wrong || undefined}
              aria-describedby={wrong ? "mfa-wrong" : undefined}
              autoFocus
            />
            {wrong && (
              <p id="mfa-wrong" role="alert" className="mt-1.5 text-sm font-medium text-[#b42318]">
                Koden stämde inte. Vänta på nästa kod och försök igen.
              </p>
            )}
          </div>
          <button type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6} className="btn btn-primary">
            Fortsätt
          </button>
        </form>
      )}
    </div>
  );
}
