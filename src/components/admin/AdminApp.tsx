"use client";

import { Loader2, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { LogoMark } from "@/components/Logo";
import { api, ApiError, type AdminData } from "./api";
import { LeadsTab } from "./LeadsTab";
import { MailTab } from "./MailTab";
import { OverviewTab } from "./OverviewTab";
import { SlotsTab } from "./SlotsTab";

type Tab = "overview" | "leads" | "slots" | "mail";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Översikt" },
  { id: "leads", label: "Anmälningar" },
  { id: "slots", label: "Besökstider" },
  { id: "mail", label: "Mejla en stad" },
];

type State =
  | { phase: "loading" }
  | { phase: "login"; error?: string }
  | { phase: "notConfigured" }
  | { phase: "ready"; data: AdminData }
  | { phase: "error"; message: string };

/** Lead id from a link like /admin#lead=<id> (used in the team emails). */
function leadFromHash(): string | null {
  const match = window.location.hash.match(/lead=([0-9a-f-]{36})/i);
  return match ? match[1].toLowerCase() : null;
}

export function AdminApp() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [tab, setTab] = useState<Tab>("overview");
  const [focusLead, setFocusLead] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hashHandled = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api<AdminData>("/data");
      setState({ phase: "ready", data });
      // Deep link from a team email (/admin#lead=…): open that lead once.
      const id = hashHandled.current ? null : leadFromHash();
      hashHandled.current = true;
      if (id) {
        setFocusLead(id);
        setTab("leads");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setState({ phase: "login" });
      else if (err instanceof ApiError && err.status === 503) setState({ phase: "notConfigured" });
      else setState({ phase: "error", message: "Kunde inte hämta data. Försök igen om en stund." });
    }
  }, []);

  useEffect(() => {
    // Loading from the API on mount; state is only set after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function logout() {
    await api("/logout", { method: "POST" }).catch(() => {});
    setState({ phase: "login" });
  }

  if (state.phase === "loading") {
    return (
      <Centered>
        <Loader2 className="mx-auto animate-spin text-brand" size={28} aria-label="Laddar" />
      </Centered>
    );
  }
  if (state.phase === "login") return <Login error={state.error} onDone={load} />;
  if (state.phase === "notConfigured") {
    return (
      <Centered>
        <h1 className="text-2xl text-night">Admin är inte påslaget än</h1>
        <p className="mt-3 leading-relaxed text-muted">
          Lägg till miljövariabeln <code className="rounded bg-frost px-1.5 py-0.5">ADMIN_PASSWORD</code> i Netlify (Project configuration,
          Environment variables) och gör en ny deploy.
        </p>
      </Centered>
    );
  }
  if (state.phase === "error") {
    return (
      <Centered>
        <p className="text-muted">{state.message}</p>
        <button type="button" className="btn btn-primary mt-4" onClick={refresh}>
          Försök igen
        </button>
      </Centered>
    );
  }

  const { data } = state;
  return (
    <div className="pb-16">
      <header className="sticky top-0 z-20 border-b border-line bg-snow/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link prefetch={false} href="/" className="flex items-center gap-2" aria-label="Till spazia.se">
            <LogoMark className="h-8 w-auto" id="admin-logo" />
            <span className="text-lg font-bold text-night">Admin</span>
          </Link>
          <div className="flex items-center gap-1">
            <button type="button" onClick={refresh} className="flex h-11 w-11 items-center justify-center rounded-full text-night hover:bg-frost" aria-label="Uppdatera">
              <RefreshCw size={19} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            </button>
            <button type="button" onClick={logout} className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-night hover:bg-frost">
              <LogOut size={17} aria-hidden="true" />
              Logga ut
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-6xl px-2 sm:px-4" aria-label="Admin">
          <ul className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className="min-h-11 border-b-[3px] border-transparent px-3 text-[0.95rem] font-semibold whitespace-nowrap text-muted aria-[current=page]:border-brand aria-[current=page]:text-night"
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        {tab === "overview" && <OverviewTab data={data} />}
        {tab === "leads" && <LeadsTab data={data} focusLead={focusLead} onChange={load} />}
        {tab === "slots" && <SlotsTab data={data} onChange={load} />}
        {tab === "mail" && <MailTab data={data} onChange={load} />}
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">{children}</div>
    </main>
  );
}

function Login({ error, onDone }: { error?: string; onDone: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(error ?? "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/login", { method: "POST", body: { password } });
      await onDone();
    } catch (err) {
      setBusy(false);
      setMessage(err instanceof ApiError && err.status === 401 ? "Fel lösenord." : "Kunde inte logga in. Försök igen.");
    }
  }

  return (
    <Centered>
      <LogoMark className="mx-auto h-14 w-auto" id="admin-login-logo" />
      <h1 className="mt-4 text-3xl text-night">Spazia admin</h1>
      <form onSubmit={submit} className="mt-6 space-y-3 text-left">
        <label htmlFor="admin-password" className="field-label">
          Lösenord
        </label>
        <input
          id="admin-password"
          type="password"
          className="field-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          autoFocus
        />
        {message && (
          <p role="alert" className="text-sm font-medium text-[#b42318]">
            {message}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !password}>
          {busy ? "Loggar in …" : "Logga in"}
        </button>
      </form>
    </Centered>
  );
}
