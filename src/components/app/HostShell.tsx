"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, House, Loader2, Menu, MessageSquare, Warehouse } from "lucide-react";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogoMark } from "@/components/Logo";
import { appText } from "@/content/app";
import { useSession } from "@/lib/app/session";

const t = appText.nav;

const TABS = [
  { href: "/vard", label: t.today, icon: House },
  { href: "/vard/annonser", label: t.listings, icon: Warehouse },
  { href: "/vard/kalender", label: t.calendar, icon: CalendarDays },
  { href: "/vard/meddelanden", label: t.messages, icon: MessageSquare },
  { href: "/vard/meny", label: t.menu, icon: Menu },
];

const SessionContext = createContext<Session | null>(null);

/** The logged-in user's session inside the host app. */
export function useHostSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useHostSession outside HostShell");
  return s;
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label={appText.common.loading}>
      <Loader2 size={28} className="animate-spin text-brand" aria-hidden="true" />
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (href === "/vard") return p === "/vard" || p === "/vard/forfragan";
  if (href === "/vard/annonser") return p.startsWith("/vard/annons") || p === "/vard/forhandsvisning";
  return p.startsWith(href);
}

/**
 * Frame for every host page: requires a login, shows the tabs (bottom bar on
 * phones, top bar on larger screens). `bare` hides the tabs (listing wizard).
 */
export function HostShell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session.status === "signedOut") {
      const here = `${window.location.pathname}${window.location.search}`;
      router.replace(`/logga-in?next=${encodeURIComponent(here)}`);
    }
  }, [session.status, router]);

  if (session.status !== "signedIn") return <Spinner />;

  if (bare) return <SessionContext.Provider value={session.session}>{children}</SessionContext.Provider>;

  return (
    <SessionContext.Provider value={session.session}>
      <header className="sticky top-0 z-30 border-b border-line bg-snow/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link prefetch={false} href="/vard" className="flex items-center gap-2" aria-label="Spazia">
            <LogoMark className="h-8 w-auto" id="host-logo" />
            <span className="text-sm font-semibold text-muted">{t.hostingFor}</span>
          </Link>
          <nav aria-label={t.hostingFor} className="hidden md:block">
            <ul className="flex items-center gap-1">
              {TABS.map((tab) => (
                <li key={tab.href}>
                  <Link
                    prefetch={false}
                    href={tab.href}
                    aria-current={isActive(pathname, tab.href) ? "page" : undefined}
                    className="flex min-h-11 items-center rounded-full px-3.5 text-[0.95rem] font-semibold text-muted transition-colors hover:bg-frost hover:text-night aria-[current=page]:bg-frost aria-[current=page]:text-night"
                  >
                    {tab.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 md:pb-16">{children}</main>

      <nav aria-label={t.hostingFor} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(pathname, tab.href);
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
