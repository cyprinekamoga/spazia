"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellPlus, BellRing, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appText } from "@/content/app";
import { categories, type CategoryId } from "@/content/categories";
import { L } from "@/lib/app/lang";
import { deleteAlert, fetchAlerts, saveAlert } from "@/lib/app/data";
import { useLoad } from "@/lib/app/session";
import { fill } from "@/lib/i18n";

const t = appText.alerts;

/** "Bevaka Uppsala" on the search page. Logged-out visitors log in first and come back. */
export function AlertButton({ uid, place, category, maxPrice, primary = false }: { uid: string; place: string; category: CategoryId | null; maxPrice: number | null; primary?: boolean }) {
  const alerts = useLoad(async () => (uid ? fetchAlerts() : []), `alerts-${uid}`);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = fill(t.watch, { place });
  const style = primary ? "btn btn-primary" : "btn btn-secondary !min-h-10 !py-1.5";

  if (!uid) {
    const here = typeof window === "undefined" ? "/sok" : `${window.location.pathname}${window.location.search}`;
    return (
      <Link prefetch={false} href={`/logga-in?next=${encodeURIComponent(here)}`} className={style}>
        <BellPlus size={18} aria-hidden="true" />
        {label}
      </Link>
    );
  }
  const key = place.trim().toLowerCase();
  const watching = (alerts.data ?? []).some((a) => a.place.toLowerCase() === key && (a.category ?? null) === category);

  async function watch() {
    setBusy(true);
    setError(null);
    try {
      await saveAlert({ place: place.trim(), category, max_price: maxPrice });
      setNote(fill(t.saved, { place }));
      await alerts.reload();
    } catch (e) {
      setError((e as Error).message === "too_many_alerts" ? t.tooMany : appText.common.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {watching ? (
        <p className="flex min-h-10 items-center gap-2 font-semibold text-pine">
          <BellRing size={18} aria-hidden="true" />
          {fill(t.watching, { place })}
        </p>
      ) : (
        <button type="button" onClick={watch} disabled={busy || alerts.loading} className={style}>
          <BellPlus size={18} aria-hidden="true" />
          {label}
        </button>
      )}
      {note && (
        <p role="status" className="text-sm text-pine">
          {note}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-[#b42318]">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Shown when a search finds nothing: say where and what you need, and get an
 * email when a space turns up (a search alert). Without an account, the
 * button goes to sign-up and back here, and the alert is saved on return
 * (bevaka=1 in the address).
 */
export function WatchForm({
  uid,
  place,
  category,
  maxPrice,
  autoSave = false,
}: {
  uid: string;
  place: string;
  category: CategoryId | null;
  maxPrice: number | null;
  autoSave?: boolean;
}) {
  const router = useRouter();
  const [town, setTown] = useState(place);
  const [cat, setCat] = useState<CategoryId | "">(category ?? "");
  const [max, setMax] = useState(maxPrice ? String(maxPrice) : "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  async function save(alert: { place: string; category: CategoryId | null; max_price: number | null }) {
    if (alert.place.length < 2) {
      setError(t.needTown);
      return;
    }
    if (!uid) {
      const q = new URLSearchParams({ ort: alert.place, bevaka: "1" });
      if (alert.category) q.set("typ", alert.category);
      if (alert.max_price) q.set("pris", String(alert.max_price));
      router.push(`/logga-in?next=${encodeURIComponent(`/sok?${q}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveAlert(alert);
      setDone(fill(t.saved, { place: alert.place }));
    } catch (e) {
      setError((e as Error).message === "too_many_alerts" ? t.tooMany : appText.common.error);
    } finally {
      setBusy(false);
    }
  }

  // Back from sign-up with bevaka=1: save the alert they asked for.
  useEffect(() => {
    if (!autoSave || !uid || !place || autoRan.current) return;
    autoRan.current = true;
    void save({ place, category, max_price: maxPrice });
    const url = new URL(window.location.href);
    url.searchParams.delete("bevaka");
    router.replace(`${url.pathname}${url.search}`);
    // Runs once, when the account is there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, uid, place]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Math.round(Number(max));
    void save({ place: town.trim(), category: cat || null, max_price: n > 0 ? n : null });
  }

  if (done) {
    return (
      <p role="status" className="flex items-start gap-2 font-semibold text-pine">
        <BellRing size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        {done}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="w-full space-y-3">
      <div>
        <h2 className="text-lg font-bold text-night">{t.formTitle}</h2>
        <p className="mt-0.5 text-muted">{t.formLead}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="watch-town" className="field-label">
            {t.town}
          </label>
          <input id="watch-town" className="field-input" value={town} onChange={(e) => setTown(e.target.value)} autoComplete="address-level2" />
        </div>
        <div>
          <label htmlFor="watch-what" className="field-label">
            {t.what}
          </label>
          <select id="watch-what" className="field-input" value={cat} onChange={(e) => setCat(e.target.value as CategoryId | "")}>
            <option value="">{t.allTypes}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {L(c.name)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="watch-max" className="field-label">
            {t.maxPriceLabel}
          </label>
          <input id="watch-max" className="field-input" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-[#b42318]">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn btn-primary">
        <BellPlus size={18} aria-hidden="true" />
        {uid ? t.formSave : t.formSignup}
      </button>
    </form>
  );
}

/** Menu → Alerts: the saved searches, each with a remove button. */
export function AlertsSection({ uid }: { uid: string }) {
  const alerts = useLoad(fetchAlerts, `alerts-${uid}`);
  const [busy, setBusy] = useState<string | null>(null);
  if (alerts.loading) return null;
  const list = alerts.data ?? [];

  return (
    <section className="card p-5" aria-labelledby="alerts-title">
      <h2 id="alerts-title" className="flex items-center gap-2 text-xl font-bold text-night">
        <BellRing size={20} className="text-brand" aria-hidden="true" />
        {t.title}
      </h2>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{list.length ? t.text : t.none}</p>
      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {list.map((a) => {
            const cat = a.category ? categories.find((c) => c.id === a.category) : null;
            const q = new URLSearchParams({ ort: a.place, ...(a.category ? { typ: a.category } : {}), ...(a.max_price ? { pris: String(a.max_price) } : {}) });
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <Link prefetch={false} href={`/sok?${q}`} className="min-w-0">
                  <span className="block truncate font-semibold text-night">{a.place}</span>
                  <span className="text-sm text-muted">
                    {[cat ? L(cat.name) : t.allTypes, a.max_price ? fill(t.maxPrice, { price: a.max_price }) : ""].filter(Boolean).join(" · ")}
                  </span>
                </Link>
                <button
                  type="button"
                  disabled={busy === a.id}
                  aria-label={fill(t.remove, { place: a.place })}
                  onClick={async () => {
                    setBusy(a.id);
                    try {
                      await deleteAlert(a.id);
                      await alerts.reload();
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-frost hover:text-[#b42318]"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
