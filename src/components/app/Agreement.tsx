"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CircleCheck, FileText, Printer } from "lucide-react";
import { useState } from "react";
import { AGREEMENT_VERSION, agreementSections, type AgreementData, type AgreementListing } from "@/content/agreement";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { fetchCounterpartPrivate, fetchListingAddress, fetchListingBundle, fetchMyProfile } from "@/lib/app/data";
import { formatMoment, type AgreementSnapshot, type AppMode, type Listing, type Profile, type RequestRow } from "@/lib/app/model";
import { must, useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner, useAppSession } from "./AppShell";

const t = appText.agreement;

/** The agreement's text: numbered sections. */
export function AgreementDocument({ data, version }: { data: AgreementData; version: string }) {
  return (
    <article className="space-y-5 text-[0.95rem] leading-relaxed text-ink">
      <p className="text-sm text-muted">{fill(t.version, { version })}</p>
      {agreementSections(data).map((s) => (
        <section key={s.title}>
          <h3 className="font-bold text-night">{s.title}</h3>
          {s.paragraphs.map((p) => (
            <p key={p} className="mt-1">
              {p}
            </p>
          ))}
          {s.bullets && s.bullets.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}

/** "I accept the rental agreement", with the agreement one tap away. */
export function AgreementConsent({ data, checked, onChange }: { data: AgreementData; checked: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-line p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#2F6B75]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="text-[0.95rem] text-ink">{t.consent}</span>
      </label>
      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand" aria-expanded={open}>
        <FileText size={16} aria-hidden="true" />
        {open ? t.hide : t.read}
      </button>
      {open && (
        <div className="mt-2 max-h-96 overflow-y-auto rounded-lg bg-frost/50 p-3">
          <AgreementDocument data={data} version={AGREEMENT_VERSION} />
        </div>
      )}
    </div>
  );
}

function listingFields(l: Pick<Listing, keyof AgreementListing>): AgreementListing {
  return {
    title: l.title,
    space_type: l.space_type,
    city: l.city,
    area_name: l.area_name,
    size_m2: l.size_m2,
    heated: l.heated,
    features: l.features ?? [],
    access: l.access,
    access_notes: l.access_notes ?? "",
    min_period: l.min_period ?? "none",
    rules: l.rules ?? "",
  };
}

function snapshotListing(l: AgreementSnapshot["listing"]): AgreementListing {
  return {
    title: l.title,
    space_type: l.space_type,
    city: l.city,
    area_name: l.area_name,
    size_m2: l.size_m2,
    heated: l.heated,
    features: l.features ?? [],
    access: l.access,
    access_notes: l.access_notes ?? "",
    min_period: l.min_period ?? "none",
    rules: l.rules ?? "",
  };
}

function fullName(first: string | null | undefined, last: string | null | undefined, fallback: string): string {
  return [first, last].filter(Boolean).join(" ") || fallback;
}

/** The agreement for one request or booking, for either side. */
export function AgreementPage({ mode }: { mode: AppMode }) {
  const id = useSearchParams().get("id") ?? "";
  const session = useAppSession();
  const uid = session.user.id;
  const { data, loading, reload } = useLoad(async () => {
    const r = must(
      await supabase()
        .from("requests")
        .select(
          "*, request_items(category, quantity, host_price_month, hourly_price, daily_max), host:profiles!requests_host_id_fkey(first_name), renter:profiles!requests_renter_id_fkey(first_name)",
        )
        .eq("id", id)
        .maybeSingle(),
    ) as (RequestRow & { host: Pick<Profile, "first_name"> | null; renter: Pick<Profile, "first_name"> | null }) | null;
    if (!r || (r.host_id !== uid && r.renter_id !== uid)) return null;
    const accepted = r.status === "accepted";
    const [bundle, priv, other, me] = await Promise.all([
      r.agreement ? Promise.resolve(null) : fetchListingBundle(r.listing_id),
      accepted ? fetchListingAddress(r.listing_id).catch(() => null) : Promise.resolve(null),
      accepted ? fetchCounterpartPrivate(uid === r.host_id ? r.renter_id : r.host_id).catch(() => null) : Promise.resolve(null),
      fetchMyProfile(uid),
    ]);
    return { r, bundle, priv, other, me };
  }, id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = mode === "host" ? `/vard/forfragan?id=${id}` : `/kund/bokning?id=${id}`;

  if (loading) return <Spinner />;
  if (!data) return <p className="text-muted">{t.notFound}</p>;
  const { r, bundle, priv, other, me } = data;
  const isHost = uid === r.host_id;
  const snap = r.agreement ?? null;
  const hostFirst = snap?.host_first_name || r.host?.first_name || "";
  const renterFirst = snap?.renter_first_name || r.renter?.first_name || "";
  const myLast = me.priv?.last_name ?? null;
  const otherLast = other?.last_name ?? null;
  const hostName = fullName(hostFirst, isHost ? myLast : otherLast, t.hostFallback);
  const renterName = fullName(renterFirst, isHost ? otherLast : myLast, t.renterFallback);

  const listing: AgreementListing | null = snap ? snapshotListing(snap.listing) : bundle ? listingFields(bundle.listing) : null;
  if (!listing) return <p className="text-muted">{t.notFound}</p>;
  const doc: AgreementData = {
    kind: (snap?.kind ?? r.kind ?? "month") as "month" | "hour",
    hostName,
    renterName,
    listing,
    address: priv ? [priv.street_address, [priv.postal_code, listing.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : null,
    items: (snap?.items ?? r.request_items).map((i) => ({ category: i.category, quantity: i.quantity, host_price_month: i.host_price_month, hourly_price: i.hourly_price ?? null, daily_max: i.daily_max ?? null })),
    start_date: snap?.start_date ?? r.start_date,
    end_date: snap ? snap.end_date : r.end_date,
    start_at: snap?.start_at ?? r.start_at ?? null,
    end_at: snap?.end_at ?? r.end_at ?? null,
    paymentRequired: Boolean(snap?.payment_required ?? r.payment_required),
  };
  const version = r.agreement_version ?? AGREEMENT_VERSION;
  const open = r.status === "pending" || r.status === "accepted";

  async function agree() {
    setBusy(true);
    setError(null);
    const res = await supabase().rpc("agree_to_rental", { p_request: r.id, p_version: AGREEMENT_VERSION });
    setBusy(false);
    if (res.error) setError(appText.common.error);
    else await reload();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-16 sm:px-6 print:max-w-none print:p-0">
      <Link prefetch={false} href={back} className="flex min-h-11 w-fit items-center gap-1.5 font-semibold text-night print:hidden">
        <ArrowLeft size={18} aria-hidden="true" />
        {appText.common.back}
      </Link>
      <h1 className="mt-2 text-[2rem] leading-tight text-night">{t.title}</h1>

      <div className="card mt-4 space-y-1.5 p-4 text-[0.95rem]">
        {r.renter_agreed_at ? (
          <p className="flex items-start gap-2 text-night">
            <CircleCheck size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            {fill(t.renterAgreed, { name: renterName, time: formatMoment(r.renter_agreed_at) })}
          </p>
        ) : (
          <p className="text-muted">{t.renterNotYet}</p>
        )}
        {r.host_agreed_at ? (
          <p className="flex items-start gap-2 text-night">
            <CircleCheck size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            {fill(r.kind === "hour" ? t.hostDirect : t.hostAgreed, { name: hostName, time: formatMoment(r.host_agreed_at) })}
          </p>
        ) : (
          <p className="text-muted">{r.status === "pending" ? t.draft : t.hostNotYet}</p>
        )}
        {snap && <p className="pt-1 text-sm text-muted">{t.frozen}</p>}
      </div>

      {!isHost && !r.renter_agreed_at && open && (
        <div className="mt-4 print:hidden">
          <button type="button" disabled={busy} onClick={agree} className="btn btn-primary">
            {busy ? t.agreeing : t.agree}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-sm font-medium text-[#b42318]">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="card mt-6 p-5">
        <AgreementDocument data={doc} version={version} />
      </div>

      <button type="button" onClick={() => window.print()} className="btn btn-secondary mt-4 print:hidden">
        <Printer size={18} aria-hidden="true" />
        {t.print}
      </button>
    </div>
  );
}

/** Data for a request that hasn't been sent yet (the request form's preview). */
export function draftAgreement(args: {
  kind: "month" | "hour";
  listing: Listing;
  hostName: string;
  renterName: string;
  items: AgreementData["items"];
  start_date: string;
  end_date: string | null;
  start_at?: string | null;
  end_at?: string | null;
  paymentRequired: boolean;
}): AgreementData {
  return {
    kind: args.kind,
    hostName: args.hostName,
    renterName: args.renterName,
    listing: listingFields(args.listing),
    address: null,
    items: args.items,
    start_date: args.start_date,
    end_date: args.end_date,
    start_at: args.start_at ?? null,
    end_at: args.end_at ?? null,
    paymentRequired: args.paymentRequired,
  };
}

