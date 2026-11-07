"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { categoryIcons } from "@/components/Icons";
import { appText } from "@/content/app";
import { getCategory } from "@/content/categories";
import { fill } from "@/lib/i18n";
import { fetchAvailability, fetchBlocks, fetchListingBundle, fetchMyOpenRequest, fetchMyProfile } from "@/lib/app/data";
import { addDays, formatDay, formatKr, minEndDate, renterMonthly, renterPrice, todayIso, type ListingBlock } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner, useAppSession } from "../AppShell";
import { CoverPhoto } from "../ui";

const t = appText.requestForm;
type ErrorCode = keyof typeof t.errors;

function inBlock(day: string, blocks: ListingBlock[]): boolean {
  return blocks.some((b) => day >= b.start_date && day <= b.end_date);
}

function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={`Färre, ${label}`}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-night hover:border-night disabled:opacity-30"
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <span className="w-8 text-center text-lg font-bold text-night tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Fler, ${label}`}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-night hover:border-night disabled:opacity-30"
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export function RequestFormPage() {
  const uid = useAppSession().user.id;
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const today = todayIso();

  const base = useLoad(async () => {
    const [bundle, blocks, me, open] = await Promise.all([fetchListingBundle(id), fetchBlocks(id), fetchMyProfile(uid), fetchMyOpenRequest(id, uid)]);
    return { bundle, blocks, me, open };
  }, `${id}:${uid}`);

  const [start, setStart] = useState(() => addDays(todayIso(), 1));
  const [openEnded, setOpenEnded] = useState(true);
  const [end, setEnd] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endDate = openEnded ? null : end || null;
  const avail = useLoad(() => (id && start >= today ? fetchAvailability(id, start, endDate) : Promise.resolve([])), `${id}|${start}|${endDate ?? ""}`);

  if (base.loading) return <Spinner />;
  const bundle = base.data?.bundle;
  const back = (
    <Link prefetch={false} href={`/annons?id=${id}`} className="flex min-h-11 w-fit items-center gap-1.5 font-semibold text-night">
      <ArrowLeft size={18} aria-hidden="true" />
      {appText.renterListing.back}
    </Link>
  );
  if (!bundle || bundle.listing.status !== "published" || bundle.listing.host_id === uid) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
        {back}
        <p className="mt-6 text-lg text-muted">{bundle?.listing.host_id === uid ? appText.renterListing.own : appText.renterListing.unavailable}</p>
      </div>
    );
  }
  const open = base.data?.open;
  if (open) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
        {back}
        <p className="mt-6 text-lg text-ink">{appText.renterListing.existing}</p>
        <Link prefetch={false} href={`/kund/bokning?id=${open.id}`} className="btn btn-primary mt-4">
          {appText.renterListing.seeRequest}
        </Link>
      </div>
    );
  }

  const { listing, photos, host } = bundle;
  // Monthly requests cover the spaces with a monthly price (hourly-only parking is booked elsewhere).
  const spaces = bundle.spaces.flatMap((sp) => (sp.host_price_month != null ? [{ ...sp, host_price_month: sp.host_price_month }] : []));
  const blocks = (base.data?.blocks ?? []).filter((b) => b.end_date >= today);
  const needName = !base.data?.me.profile?.first_name;
  const hostName = host?.first_name || appText.booking.host;
  const minEnd = minEndDate(start, listing.min_period);
  const available = (category: string) => avail.data?.find((a) => a.category === category)?.available ?? spaces.find((s) => s.category === category)?.capacity ?? 0;
  const chosen = spaces.map((s) => ({ category: s.category, quantity: Math.min(qty[s.category] ?? 0, available(s.category)), host_price_month: s.host_price_month })).filter((i) => i.quantity > 0);
  const total = renterMonthly(chosen);

  // Problems with the dates, shown under the date fields (the database checks the same).
  const dateProblem: ErrorCode | null =
    start < today || (endDate !== null && endDate < start)
      ? "bad_dates"
      : endDate !== null && endDate < minEnd
        ? "too_short"
        : inBlock(start, blocks) || (endDate !== null && inBlock(endDate, blocks))
          ? "blocked"
          : null;
  const needsEnd = !openEnded && !end;
  const canSend = !busy && !dateProblem && !needsEnd && chosen.length > 0 && (!needName || firstName.trim().length > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setError(null);
    const db = supabase();
    if (needName) {
      const res = await db.from("profiles").update({ first_name: firstName.trim() }).eq("id", uid);
      if (res.error) {
        setBusy(false);
        setError(appText.common.error);
        return;
      }
    }
    const res = await db.rpc("create_request", {
      p_listing: listing.id,
      p_start: start,
      p_end: endDate,
      p_items: chosen.map((i) => ({ category: i.category, quantity: i.quantity })),
      p_message: message.trim(),
    });
    if (res.error) {
      const code = (Object.keys(t.errors) as ErrorCode[]).find((k) => res.error.message.includes(k));
      setError(code ? t.errors[code] : appText.common.error);
      setBusy(false);
      await avail.reload();
      return;
    }
    router.replace(`/kund/bokning?id=${res.data as string}&skickad=1`);
  }

  const place = [listing.area_name, listing.city].filter(Boolean).join(", ");

  const summary = (
    <div className="card space-y-4 p-5">
      <div className="flex gap-3">
        <CoverPhoto photos={photos} className="h-16 w-16 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="truncate font-bold text-night">{listing.title}</p>
          <p className="truncate text-sm text-muted">{place}</p>
        </div>
      </div>
      <div className="border-t border-line pt-4">
        <h2 className="text-lg font-bold text-night">{t.summary}</h2>
        {chosen.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t.pickOne}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {chosen.map((i) => {
              const c = getCategory(i.category);
              return (
                <li key={i.category} className="flex justify-between gap-3 text-[0.95rem] text-ink">
                  <span>
                    {i.quantity} {i.quantity === 1 ? c.unit.sv : c.unitPlural.sv}
                  </span>
                  <span className="shrink-0 whitespace-nowrap">{formatKr(renterPrice(i.host_price_month) * i.quantity)} kr/mån</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 flex justify-between gap-3 border-t border-line pt-3 font-bold text-night">
          <span>{t.perMonth}</span>
          <span className="whitespace-nowrap">{formatKr(total)} kr</span>
        </p>
        <p className="mt-1 text-sm text-muted">{t.includesFee}</p>
      </div>
      <p className="rounded-xl bg-frost/70 p-3 text-sm text-ink">{t.noPayment}</p>
      {error && (
        <p role="alert" className="rounded-xl bg-[#fef3f2] p-3 text-[0.95rem] font-medium text-[#b42318]">
          {error}
        </p>
      )}
      <button type="submit" disabled={!canSend} className="btn btn-primary w-full">
        {busy ? t.sending : t.send}
      </button>
    </div>
  );

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl px-4 pt-4 pb-16 sm:px-6">
      {back}
      <h1 className="mt-2 text-[2rem] leading-tight text-night">{t.title}</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-8">
          <section className="card space-y-5 p-5">
            <h2 className="text-xl font-bold text-night">{t.when}</h2>
            <div>
              <label htmlFor="start" className="field-label">
                {t.start}
              </label>
              <input id="start" type="date" className="field-input" min={today} value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <fieldset>
              <legend className="field-label">{t.howLong}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: true, label: t.untilFurther, hint: t.untilFurtherHint },
                  { value: false, label: t.toDate, hint: "" },
                ].map((o) => (
                  <label
                    key={String(o.value)}
                    className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3.5 ${openEnded === o.value ? "border-night bg-frost/50" : "border-line bg-paper"}`}
                  >
                    <input type="radio" name="how-long" className="mt-1 accent-[var(--color-brand)]" checked={openEnded === o.value} onChange={() => setOpenEnded(o.value)} />
                    <span>
                      <span className="block font-semibold text-night">{o.label}</span>
                      {o.hint && <span className="block text-sm text-muted">{o.hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {!openEnded && (
              <div>
                <label htmlFor="end" className="field-label">
                  {t.end}
                </label>
                <input id="end" type="date" className="field-input" min={minEnd} value={end} onChange={(e) => setEnd(e.target.value)} required />
              </div>
            )}
            {listing.min_period !== "none" && <p className="text-sm text-muted">{fill(t.minPeriod, { period: appText.minPeriod[listing.min_period].toLowerCase() })}</p>}
            {blocks.length > 0 && (
              <p className="text-sm text-muted">
                {fill(t.closed, {
                  periods: blocks.map((b) => (b.start_date === b.end_date ? formatDay(b.start_date) : `${formatDay(b.start_date)} – ${formatDay(b.end_date)}`)).join(", "),
                })}
              </p>
            )}
            {dateProblem && (
              <p role="alert" className="text-[0.95rem] font-medium text-[#b42318]">
                {t.errors[dateProblem]}
              </p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-xl font-bold text-night">{t.what}</h2>
            <ul className="mt-3 divide-y divide-line">
              {spaces.map((s) => {
                const c = getCategory(s.category);
                const Icon = categoryIcons[s.category];
                const free = available(s.category);
                const value = Math.min(qty[s.category] ?? 0, free);
                return (
                  <li key={s.category} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon size={24} className="shrink-0 text-brand" />
                      <span>
                        <span className="block font-semibold text-night">{c.name.sv}</span>
                        <span className="block text-sm text-muted">{fill(t.perUnit, { price: formatKr(renterPrice(s.host_price_month)), unit: c.unit.sv })}</span>
                        <span className={`block text-sm font-semibold ${free > 0 ? "text-pine" : "text-[#b42318]"}`}>{free > 0 ? fill(t.available, { count: free }) : t.full}</span>
                      </span>
                    </span>
                    <Stepper value={value} max={free} label={c.name.sv} onChange={(n) => setQty({ ...qty, [s.category]: n })} />
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card space-y-4 p-5">
            <div>
              <h2 className="text-xl font-bold text-night">{fill(t.message, { name: hostName })}</h2>
              <p className="mt-1 text-sm text-muted">{t.messageHint}</p>
            </div>
            <label htmlFor="message" className="sr-only">
              {fill(t.message, { name: hostName })}
            </label>
            <textarea id="message" rows={4} maxLength={1000} className="field-input resize-y" placeholder={t.messagePlaceholder} value={message} onChange={(e) => setMessage(e.target.value)} />
            {needName && (
              <div>
                <label htmlFor="first-name" className="field-label">
                  {t.firstName}
                </label>
                <input id="first-name" className="field-input" autoComplete="given-name" maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                <p className="mt-1.5 text-sm text-muted">{t.firstNameHint}</p>
              </div>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-6">{summary}</aside>
      </div>
    </form>
  );
}
