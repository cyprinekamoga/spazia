"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type AdminData } from "./api";
import { LeadsTab } from "./LeadsTab";
import { MailTab } from "./MailTab";
import { OverviewTab } from "./OverviewTab";

type Tab = "overview" | "leads" | "mail";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Översikt" },
  { id: "leads", label: "Lista" },
  { id: "mail", label: "Mejla en stad" },
];

type State = { phase: "loading" } | { phase: "denied" } | { phase: "ready"; data: AdminData } | { phase: "error" };

/** Lead id from a link like /admin#lead=<id> (used in the team emails). */
function leadFromHash(): string | null {
  const match = window.location.hash.match(/lead=([0-9a-f-]{36})/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Sign-ups from spazia.se (waitlist, hosts and organisations), stored with the
 * website in Netlify Blobs. Shown in the app's admin page; the website's API
 * checks the admin's login (and two-factor code) with Supabase.
 */
export function LeadsAdmin() {
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
      setState(err instanceof ApiError && (err.status === 401 || err.status === 403) ? { phase: "denied" } : { phase: "error" });
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

  if (state.phase === "loading") return <Loader2 className="mx-auto mt-10 animate-spin text-brand" size={28} aria-label="Laddar" />;
  if (state.phase === "denied") {
    return <p className="mt-6 text-muted">Ingen behörighet. Logga ut och in igen, och ange koden från autentiseringsappen.</p>;
  }
  if (state.phase === "error") {
    return (
      <div className="mt-6">
        <p className="text-muted">Kunde inte hämta anmälningarna. Försök igen om en stund.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={refresh}>
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2 border-b border-line">
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
        <button type="button" onClick={refresh} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-night hover:bg-frost" aria-label="Uppdatera">
          <RefreshCw size={19} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
        </button>
      </div>
      <div className="pt-6">
        {tab === "overview" && <OverviewTab data={state.data} />}
        {tab === "leads" && <LeadsTab data={state.data} focusLead={focusLead} onChange={load} />}
        {tab === "mail" && <MailTab data={state.data} onChange={load} />}
      </div>
    </div>
  );
}
