"use client";

import Link from "next/link";
import { Hourglass } from "lucide-react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import type { RenterRequest } from "@/lib/app/data";
import { effectiveStatus, formatPeriod, timeLeft } from "@/lib/app/model";
import { CoverPhoto, itemsText, StatusChip } from "../ui";

/** One of the renter's requests or rentals, with the listing's cover photo. */
export function BookingCard({ request, now }: { request: RenterRequest; now: number }) {
  const status = effectiveStatus(request, now);
  const l = request.listing;
  const place = [l?.area_name, l?.city].filter(Boolean).join(", ");
  return (
    <Link prefetch={false} href={`/kund/bokning?id=${request.id}`} className="card flex gap-3 p-3 transition-colors hover:border-night/30 sm:gap-4">
      <CoverPhoto photos={l?.listing_photos} className="h-20 w-20 shrink-0 rounded-xl sm:h-24 sm:w-24" />
      <span className="min-w-0 flex-1 py-0.5">
        <span className="block truncate font-bold text-night">{l?.title || appText.listings.untitled}</span>
        {place && <span className="block truncate text-sm text-muted">{place}</span>}
        <span className="mt-1 block text-[0.95rem] text-ink">{itemsText(request.request_items)}</span>
        <span className="block text-sm text-muted">{formatPeriod(request.start_date, request.end_date, appText.common.untilFurtherNotice)}</span>
        <span className="mt-1.5 block">
          {status === "pending" ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#8a5a00]">
              <Hourglass size={15} aria-hidden="true" />
              {fill(appText.booking.answerWithin, { time: timeLeft(request.expires_at, now) })}
            </span>
          ) : (
            <StatusChip status={status} />
          )}
        </span>
      </span>
    </Link>
  );
}
