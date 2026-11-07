"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, House, LogOut, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { must, useLoad, useSession } from "@/lib/app/session";
import { effectiveStatus, todayIso, type AppMode, type RequestRow } from "@/lib/app/model";
import { lastMode, MODE_HOME } from "@/lib/app/mode";
import { site } from "@/lib/site";
import { supabase } from "@/lib/supabase";
import { Spinner } from "./AppShell";

const t = appText.chooser;

type Overview = {
  name: string;
  requests: Pick<RequestRow, "id" | "host_id" | "renter_id" | "status" | "expires_at" | "start_date" | "end_date">[];
};

function ModeCard({
  href,
  icon: Icon,
  title,
  text,
  note,
  last,
}: {
  href: string;
  icon: typeof House;
  title: string;
  text: string;
  note: string | null;
  last: boolean;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className={`card group flex items-center gap-4 p-5 transition-colors hover:border-night/40 sm:p-6 ${last ? "border-brand/60 ring-1 ring-brand/30" : ""}`}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Icon size={28} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xl font-bold text-night">{title}</span>
          {last && <span className="rounded-full bg-frost px-2 py-0.5 text-xs font-semibold text-muted">{t.lastUsed}</span>}
        </span>
        <span className="mt-1 block leading-snug text-muted">{text}</span>
        {note && <span className="mt-2 block text-sm font-semibold text-[#8a5a00]">{note}</span>}
      </span>
      <ChevronRight size={22} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function Chooser({ uid }: { uid: string }) {
  const router = useRouter();
  const [last, setLast] = useState<AppMode | null>(null);
  const [now] = useState(() => Date.now());
  const { data, loading } = useLoad(async (): Promise<Overview> => {
    const db = supabase();
    const [profile, requests] = await Promise.all([
      db.from("profiles").select("first_name").eq("id", uid).maybeSingle(),
      db.from("requests").select("id, host_id, renter_id, status, expires_at, start_date, end_date").or(`host_id.eq.${uid},renter_id.eq.${uid}`),
    ]);
    return {
      name: (must(profile) as { first_name: string } | null)?.first_name ?? "",
      requests: must(requests) as Overview["requests"],
    };
  }, uid);

  // Read after mount: the remembered mode only exists in this browser.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLast(lastMode()), []);

  async function logout() {
    await supabase().auth.signOut();
    router.replace("/sok");
  }

  if (loading) return <Spinner />;
  const requests = data?.requests ?? [];
  const today = todayIso();
  const hostPending = requests.filter((r) => r.host_id === uid && effectiveStatus(r, now) === "pending").length;
  const mine = requests.filter((r) => r.renter_id === uid);
  const renterActive = mine.filter((r) => r.status === "accepted" && (r.end_date === null || r.end_date >= today)).length;
  const renterWaiting = mine.some((r) => effectiveStatus(r, now) === "pending");

  const renterNote = renterActive > 0 ? (renterActive === 1 ? t.renterActiveOne : fill(t.renterActiveMany, { count: renterActive })) : renterWaiting ? t.renterPending : null;
  const hostNote = hostPending > 0 ? (hostPending === 1 ? t.hostPendingOne : fill(t.hostPendingMany, { count: hostPending })) : null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-[2.2rem] leading-tight text-night">{data?.name ? fill(t.greeting, { name: data.name }) : t.greetingNoName}</h1>
      <p className="mt-1 text-lg text-muted">{t.lead}</p>
      <div className="mt-6 space-y-3">
        <ModeCard href={MODE_HOME.renter} icon={Search} title={t.renter.title} text={t.renter.text} note={renterNote} last={last === "renter"} />
        <ModeCard href={MODE_HOME.host} icon={House} title={t.host.title} text={t.host.text} note={hostNote} last={last === "host"} />
      </div>
      <p className="mt-5 text-sm text-muted">{t.switchLater}</p>
      <button type="button" onClick={logout} className="mt-8 flex min-h-11 items-center gap-2 font-semibold text-muted hover:text-night">
        <LogOut size={18} aria-hidden="true" />
        {t.logout}
      </button>
    </div>
  );
}

/** After login: choose between renting a space and hosting. */
export function ModeChooser() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.status === "signedOut") router.replace("/logga-in");
  }, [session.status, router]);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-xl items-center px-4 sm:px-6">
        <a href={site.url} aria-label="Spazia">
          <LogoMark className="h-9 w-auto" id="chooser-logo" />
        </a>
      </header>
      <main className="px-4 pt-6 pb-16 sm:px-6 sm:pt-12">{session.status === "signedIn" ? <Chooser uid={session.session.user.id} /> : <Spinner />}</main>
    </div>
  );
}
