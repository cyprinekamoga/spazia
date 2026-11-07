"use client";

/* eslint-disable @next/next/no-img-element -- photos come from Supabase Storage, not the build */
import Link from "next/link";
import { CalendarClock, Clock3, DoorOpen, KeyRound, Ruler, ShieldCheck, Thermometer } from "lucide-react";
import type { ReactNode } from "react";
import { categoryIcons } from "@/components/Icons";
import { appText } from "@/content/app";
import { getCategory } from "@/content/categories";
import { fill } from "@/lib/i18n";
import { formatKr, fromPrice, hoursText, renterPrice, type Listing, type ListingPhoto, type ListingSpace, type Profile } from "@/lib/app/model";
import { photoUrl } from "@/lib/supabase";

const t = appText;

function memberSince(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(new Date(iso));
}

/** Grid layout by number of photos (1–5). */
const GRID: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-[2fr_1fr] sm:grid-rows-2",
  4: "sm:grid-cols-[2fr_1fr_1fr] sm:grid-rows-2 [&>img:nth-child(4)]:col-span-2",
  5: "sm:grid-cols-4 sm:grid-rows-2",
};

function Gallery({ photos, title }: { photos: ListingPhoto[]; title: string }) {
  if (photos.length === 0) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-frost text-muted sm:aspect-[16/7]">Inga bilder än</div>;
  }
  const urls = photos.map((p) => photoUrl(p.path));
  return (
    <>
      {/* Phones: swipe through full-width photos */}
      <div className="-mx-4 flex snap-x snap-mandatory overflow-x-auto sm:hidden" style={{ scrollbarWidth: "none" }}>
        {urls.map((u, i) => (
          <div key={u} className="relative w-full shrink-0 snap-center">
            <img src={u} alt={i === 0 ? title : ""} className="aspect-[4/3] w-full object-cover" />
            <span className="absolute right-3 bottom-3 rounded-full bg-night/75 px-2.5 py-1 text-xs font-semibold text-white">
              {i + 1} / {urls.length}
            </span>
          </div>
        ))}
      </div>
      {/* Larger screens: one large photo and the next ones beside it */}
      <div className={`hidden gap-2 overflow-hidden rounded-2xl sm:grid sm:aspect-[16/7] ${GRID[Math.min(urls.length, 5)]}`}>
        {urls.slice(0, 5).map((u, i) => (
          <img key={u} src={u} alt={i === 0 ? title : ""} className={`h-full min-h-0 w-full object-cover ${i === 0 && urls.length >= 3 ? "row-span-2" : ""} ${i === 0 && urls.length >= 5 ? "col-span-2" : ""}`} />
        ))}
      </div>
    </>
  );
}

export type ListingAction = { href: string; label: string };

/**
 * What the booking card and the phone bar offer: "Skicka förfrågan" and/or
 * "Boka parkering", or a note instead. The first action is the main one.
 */
function Actions({ preview, actions, previewLabels, notice, compact = false }: { preview: boolean; actions: ListingAction[]; previewLabels: string[]; notice?: ReactNode; compact?: boolean }) {
  const box = compact ? "flex shrink-0 flex-col items-stretch gap-1.5" : "mt-4 flex flex-col gap-2";
  if (preview) {
    return (
      <div className={box}>
        {previewLabels.map((label, i) => (
          <button key={label} type="button" className={`btn ${i === 0 ? "btn-primary" : "btn-secondary"} ${compact ? "!min-h-10 !py-2" : "w-full"}`} disabled>
            {label}
          </button>
        ))}
      </div>
    );
  }
  if (actions.length) {
    return (
      <div className={box}>
        {actions.map((a, i) => (
          <Link key={a.href} prefetch={false} href={a.href} className={`btn ${i === 0 ? "btn-primary" : "btn-secondary"} ${compact ? (actions.length > 1 ? "!min-h-10 !py-2 text-[0.95rem]" : "") : "w-full"}`}>
            {a.label}
          </Link>
        ))}
      </div>
    );
  }
  return notice ? <div className={compact ? "text-right text-sm" : "mt-4 text-[0.95rem]"}>{notice}</div> : null;
}

/**
 * A listing as renters see it. In `preview` mode (the host's own view) the
 * buttons are disabled; otherwise `actions` link to the request form and/or
 * the hourly parking booking, or `notice` explains why there are none.
 */
export function ListingView({
  listing,
  spaces,
  photos,
  host,
  preview = false,
  actions = [],
  notice,
}: {
  listing: Listing;
  spaces: ListingSpace[];
  photos: ListingPhoto[];
  host: Profile | null;
  preview?: boolean;
  actions?: ListingAction[];
  notice?: ReactNode;
}) {
  const place = [listing.area_name, listing.city].filter(Boolean).join(", ");
  const type = listing.space_type ? t.spaceTypes[listing.space_type] : "";
  const from = fromPrice(spaces);
  const per = from?.per === "hour" ? "tim" : "mån";
  const previewLabels = [
    ...(spaces.some((s) => s.host_price_month) ? [t.renterListing.request] : []),
    ...(spaces.some((s) => s.hourly_price) ? [t.renterListing.bookParking] : []),
  ];
  const facts = [
    listing.size_m2 ? { icon: Ruler, text: `${formatKr(Number(listing.size_m2))} m²` } : null,
    listing.heated ? { icon: Thermometer, text: t.heated[listing.heated] } : null,
    listing.access ? { icon: DoorOpen, text: t.access[listing.access] } : null,
    { icon: CalendarClock, text: t.minPeriod[listing.min_period] },
  ].filter(Boolean) as { icon: typeof Ruler; text: string }[];

  return (
    <article className="pb-24">
      <Gallery photos={photos} title={listing.title} />

      <div className="mt-5 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div>
          <h1 className="text-[2rem] leading-tight text-night sm:text-4xl">{listing.title || appText.listings.untitled}</h1>
          <p className="mt-1.5 text-lg text-muted">{[type, place].filter(Boolean).join(" i ")}</p>

          <ul className="mt-5 flex flex-wrap gap-2">
            {facts.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.text} className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[0.95rem] text-ink">
                  <Icon size={17} className="text-brand" aria-hidden="true" />
                  {f.text}
                </li>
              );
            })}
          </ul>

          {host && (
            <div className="mt-6 flex items-center gap-3 border-y border-line py-5">
              {host.avatar_url ? (
                <img src={host.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-lg font-bold text-brand">{(host.first_name || "?").slice(0, 1)}</span>
              )}
              <div>
                <p className="font-semibold text-night">Värd: {host.first_name || "–"}</p>
                <p className="text-sm text-muted">{fill(appText.request.memberSince, { date: memberSince(host.created_at) })}</p>
              </div>
            </div>
          )}

          <section className="mt-6">
            <h2 className="text-2xl text-night">Det här får plats</h2>
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-paper">
              {spaces.map((s) => {
                const c = getCategory(s.category);
                const Icon = categoryIcons[s.category];
                return (
                  <li key={s.category} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-3">
                      <Icon size={22} className="text-brand" />
                      <span>
                        <span className="block font-semibold text-night">{c.name.sv}</span>
                        <span className="block text-sm text-muted">
                          {s.capacity} {s.capacity === 1 ? c.unit.sv : c.unitPlural.sv}
                        </span>
                        {s.hourly_price != null && <span className="block text-sm text-muted">{fill(t.renterListing.bookable, { hours: hoursText(s) })}</span>}
                      </span>
                    </span>
                    <span className="text-right">
                      {s.host_price_month != null && (
                        <>
                          <span className="block font-bold text-night">{formatKr(renterPrice(s.host_price_month))} kr</span>
                          <span className="block text-sm text-muted">per {c.unit.sv} och månad</span>
                        </>
                      )}
                      {s.hourly_price != null && (
                        <>
                          <span className={`block font-bold text-night ${s.host_price_month != null ? "mt-1.5" : ""}`}>{formatKr(renterPrice(s.hourly_price))} kr</span>
                          <span className="block text-sm text-muted">{t.renterListing.perHour}</span>
                          {s.daily_max != null && <span className="block text-sm text-muted">{fill(t.renterListing.maxPerDay, { price: formatKr(renterPrice(s.daily_max)) })}</span>}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {listing.features.length > 0 && (
            <section className="mt-8">
              <h2 className="text-2xl text-night">Det här finns</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {listing.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-ink">
                    <ShieldCheck size={18} className="text-pine" aria-hidden="true" />
                    {t.features[f]}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {listing.description && (
            <section className="mt-8">
              <h2 className="text-2xl text-night">Om utrymmet</h2>
              <p className="mt-3 leading-relaxed whitespace-pre-line text-ink/90">{listing.description}</p>
            </section>
          )}

          {listing.access && (
            <section className="mt-8">
              <h2 className="text-2xl text-night">Tillgång</h2>
              <p className="mt-3 flex items-start gap-2 text-ink">
                <Clock3 size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  {t.access[listing.access]}
                  {listing.access_notes ? `. ${listing.access_notes}` : ""}
                </span>
              </p>
            </section>
          )}

          {listing.rules && (
            <section className="mt-8">
              <h2 className="text-2xl text-night">Regler</h2>
              <p className="mt-3 leading-relaxed whitespace-pre-line text-ink/90">{listing.rules}</p>
            </section>
          )}

          <section className="mt-8 rounded-2xl bg-frost/70 p-5">
            <h2 className="text-xl font-bold text-night">Bra att veta</h2>
            <ul className="mt-3 space-y-2 text-[0.97rem] text-ink">
              <li className="flex gap-2">
                <Clock3 size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                Du skickar en förfrågan, och värden svarar inom 24 timmar.
              </li>
              <li className="flex gap-2">
                <KeyRound size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                Den exakta adressen och hur du kommer in får du när värden har godkänt.
              </li>
              <li className="flex gap-2">
                <CalendarClock size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                Hyr några dagar, veckor eller månader, eller tills vidare.
              </li>
            </ul>
          </section>
        </div>

        {/* Larger screens: booking card beside the text */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-line bg-paper p-5 shadow-sm">
            {from !== null && (
              <p className="text-night">
                <span className="text-sm text-muted">från </span>
                <span className="text-2xl font-bold">{formatKr(from.amount)} kr</span>
                <span className="text-muted"> / {per}</span>
              </p>
            )}
            <Actions preview={preview} actions={actions} previewLabels={previewLabels} notice={notice} />
            {preview && <p className="mt-2 text-center text-sm text-muted">Förhandsvisning</p>}
          </div>
        </aside>
      </div>

      {/* Phones: price and request button fixed at the bottom */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-night">
            {from !== null && (
              <>
                <span className="text-sm text-muted">från </span>
                <span className="text-lg font-bold">{formatKr(from.amount)} kr</span>
                <span className="text-sm text-muted"> / {per}</span>
              </>
            )}
            {preview && <span className="block text-xs text-muted">Förhandsvisning</span>}
          </p>
          <Actions preview={preview} actions={actions} previewLabels={previewLabels} notice={notice} compact />
        </div>
      </div>
    </article>
  );
}
