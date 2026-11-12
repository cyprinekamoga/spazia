"use client";

import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { appText } from "@/content/app";
import { fetchFavourites, setFavourite } from "@/lib/app/data";
import { useLoad } from "@/lib/app/session";
import { fill } from "@/lib/i18n";
import { CoverPhoto } from "./ui";

const t = appText.favourites;

/**
 * The heart. Works inside a card link (it doesn't follow the link). Logged-out
 * visitors are sent to log in and come back to the listing.
 */
export function FavouriteButton({
  uid,
  listingId,
  title,
  saved,
  onChange,
  overlay = false,
}: {
  uid: string;
  listingId: string;
  title: string;
  saved: boolean;
  onChange?: (on: boolean) => void;
  overlay?: boolean;
}) {
  const [on, setOn] = useState(saved);
  const [busy, setBusy] = useState(false);
  const style = overlay
    ? "flex h-10 w-10 items-center justify-center rounded-full bg-paper/90 shadow-sm backdrop-blur hover:bg-paper"
    : "flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper hover:border-night";
  const label = fill(on ? t.unsave : t.save, { title: title || appText.listings.untitled });
  const icon = <Heart size={20} aria-hidden="true" className={on ? "fill-[#d92d20] text-[#d92d20]" : "text-night"} />;

  if (!uid) {
    return (
      <Link prefetch={false} href={`/logga-in?next=${encodeURIComponent(`/annons?id=${listingId}`)}`} aria-label={label} className={style} onClick={(e) => e.stopPropagation()}>
        {icon}
      </Link>
    );
  }

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !on;
    setOn(next);
    setBusy(true);
    try {
      await setFavourite(listingId, next);
      onChange?.(next);
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} aria-label={label} className={style}>
      {icon}
    </button>
  );
}

/** Menu → Saved spaces. */
export function SavedSection({ uid }: { uid: string }) {
  const saved = useLoad(fetchFavourites, `favourites-${uid}`);
  if (saved.loading) return null;
  const list = saved.data ?? [];
  return (
    <section className="card p-5" aria-labelledby="saved-title">
      <h2 id="saved-title" className="flex items-center gap-2 text-xl font-bold text-night">
        <Heart size={20} className="text-brand" aria-hidden="true" />
        {t.title}
      </h2>
      {list.length === 0 ? (
        <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{t.none}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {list.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2.5">
              <Link prefetch={false} href={`/annons?id=${l.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <CoverPhoto photos={l.listing_photos} className="h-12 w-12 shrink-0 rounded-xl" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-night">{l.title || appText.listings.untitled}</span>
                  <span className="block truncate text-sm text-muted">
                    {l.status === "published" ? [l.area_name, l.city].filter(Boolean).join(", ") : t.unavailable}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                aria-label={fill(t.unsave, { title: l.title || appText.listings.untitled })}
                onClick={async () => {
                  await setFavourite(l.id, false).catch(() => {});
                  await saved.reload();
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-frost hover:text-[#b42318]"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
