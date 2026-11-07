"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftRight, CalendarDays, House, Loader2, Menu, MessageSquare, Search, Tickets, Warehouse, type LucideIcon } from "lucide-react";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogoMark } from "@/components/Logo";
import { appText } from "@/content/app";
import type { AppMode } from "@/lib/app/model";
import { MODE_HOME, rememberMode } from "@/lib/app/mode";
import { useSession } from "@/lib/app/session";
import { site } from "@/lib/site";

const t = appText.nav;

type Tab = { href: string; label: string; icon: LucideIcon; also?: string[] };

const TABS: Record<AppMode, Tab[]> = {
  host: [
    { href: "/vard", label: t.today, icon: House, also: ["/vard/forfragan"] },
    { href: "/vard/annonser", label: t.listings, icon: Warehouse, also: ["/vard/annons", "/vard/forhandsvisning"] },
    { href: "/vard/kalender", label: t.calendar, icon: CalendarDays },
    { href: "/vard/meddelanden", label: t.messages, icon: MessageSquare },
    { href: "/vard/meny", label: t.menu, icon: Menu },
  ],
  renter: [
    { href: "/kund", label: t.home, icon: House },
    { href: "/sok", label: t.search, icon: Search, also: ["/annons", "/kund/skicka"] },
    { href: "/kund/bokningar", label: t.bookings, icon: Tickets, also: ["/kund/bokning"] },
    { href: "/kund/meddelanden", label: t.messages, icon: MessageSquare },
    { href: "/kund/meny", label: t.menu, icon: Menu },
  ],
};

const SessionContext = createContext<Session | null>(null);

/** The logged-in user's session inside the app. */
export function useAppSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useAppSession outside AppShell");
  return s;
}

/** The session on pages that are open to everyone (null when not logged in). */
export function useOptionalSession(): Session | null {
  return useContext(SessionContext);
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label={appText.common.loading}>
      <Loader2 size={28} className="animate-spin text-brand" aria-hidden="true" />
    </div>
  );
}

function isActive(pathname: string, tab: Tab): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === tab.href || tab.also?.some((a) => p === a || p.startsWith(`${a}/`))) return true;
  // The mode's home tab matches only itself; other tabs also match their sub-pages.
  return tab.href !== MODE_HOME.host && tab.href !== MODE_HOME.renter && p.startsWith(`${tab.href}/`);
}

/** "Byt till värdläge" / "Byt till hyresgästläge" */
export function ModeSwitchLink({ mode, className = "" }: { mode: AppMode; className?: string }) {
  const other: AppMode = mode === "host" ? "renter" : "host";
  return (
    <Link prefetch={false} href={MODE_HOME[other]} className={className}>
      <ArrowLeftRight size={16} aria-hidden="true" />
      <span className="sm:hidden">{other === "host" ? t.toHostShort : t.toRenterShort}</span>
      <span className="hidden sm:inline">{other === "host" ? t.toHost : t.toRenter}</span>
    </Link>
  );
}

/** Header for visitors who aren't logged in, on the pages open to everyone. */
function PublicHeader() {
  const here = typeof window === "undefined" ? "/sok" : `${window.location.pathname}${window.location.search}`;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-snow/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href={site.url} className="flex items-center" aria-label="Spazia">
          <LogoMark className="h-8 w-auto" id="public-logo" />
        </a>
        <nav aria-label="Spazia" className="flex items-center gap-1 sm:gap-2">
          <a href={`${site.url}/bli-vard`} className="hidden min-h-11 items-center rounded-full px-3.5 text-[0.95rem] font-semibold text-muted hover:bg-frost hover:text-night sm:flex">
            {t.rentOut}
          </a>
          <Link prefetch={false} href={`/logga-in?next=${encodeURIComponent(here)}`} className="btn btn-primary !min-h-11 !py-2 text-[0.95rem]">
            {t.login}
          </Link>
        </nav>
      </div>
    </header>
  );
}

/**
 * Frame for every app page: requires a login and shows the tabs for the mode
 * (bottom bar on phones, top bar on larger screens). `bare` hides the frame,
 * for full-screen pages such as the listing wizard or a listing. `open` pages
 * (search, listings) are also shown to visitors who aren't logged in.
 */
export function AppShell({ mode, children, bare = false, open = false }: { mode: AppMode; children: ReactNode; bare?: boolean; open?: boolean }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const tabs = TABS[mode];
  const label = mode === "host" ? t.hostingFor : t.renting;

  useEffect(() => {
    if (session.status === "signedOut" && !open) {
      const here = `${window.location.pathname}${window.location.search}`;
      router.replace(`/logga-in?next=${encodeURIComponent(here)}`);
    }
  }, [session.status, router, open]);

  useEffect(() => {
    if (session.status === "signedIn") rememberMode(mode);
  }, [mode, session.status]);

  if (session.status === "signedOut" && open) {
    return (
      <SessionContext.Provider value={null}>
        {!bare && <PublicHeader />}
        {bare ? children : <main className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6">{children}</main>}
      </SessionContext.Provider>
    );
  }
  if (session.status !== "signedIn") return <Spinner />;

  if (bare) return <SessionContext.Provider value={session.session}>{children}</SessionContext.Provider>;

  return (
    <SessionContext.Provider value={session.session}>
      <header className="sticky top-0 z-30 border-b border-line bg-snow/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link prefetch={false} href={MODE_HOME[mode]} className="flex items-center gap-2" aria-label="Spazia">
            <LogoMark className="h-8 w-auto" id="app-logo" />
            {mode === "host" && <span className="text-sm font-semibold text-muted">{t.hostingFor}</span>}
          </Link>
          <div className="flex items-center gap-2">
            <nav aria-label={label} className="hidden md:block">
              <ul className="flex items-center gap-1">
                {tabs.map((tab) => (
                  <li key={tab.href}>
                    <Link
                      prefetch={false}
                      href={tab.href}
                      aria-current={isActive(pathname, tab) ? "page" : undefined}
                      className="flex min-h-11 items-center rounded-full px-3.5 text-[0.95rem] font-semibold text-muted transition-colors hover:bg-frost hover:text-night aria-[current=page]:bg-frost aria-[current=page]:text-night"
                    >
                      {tab.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <ModeSwitchLink
              mode={mode}
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 text-sm font-semibold text-night transition-colors hover:border-night md:ml-2"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 md:pb-16">{children}</main>

      <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(pathname, tab);
            return (
              <li key={tab.href}>
                <Link
                  prefetch={false}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.72rem] font-semibold ${active ? "text-brand" : "text-muted"}`}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </SessionContext.Provider>
  );
}

export function HostShell(props: { children: ReactNode; bare?: boolean }) {
  return <AppShell mode="host" {...props} />;
}

export function RenterShell(props: { children: ReactNode; bare?: boolean; open?: boolean }) {
  return <AppShell mode="renter" {...props} />;
}
