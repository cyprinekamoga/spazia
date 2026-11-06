"use client";

/* eslint-disable @next/next/no-img-element -- profile photos come from Google or Supabase Storage */
import Link from "next/link";
import { Hourglass } from "lucide-react";
import { appText } from "@/content/app";
import { getCategory } from "@/content/categories";
import { fill } from "@/lib/i18n";
import type { HostRequest } from "@/lib/app/data";
import { effectiveStatus, formatPeriod, timeLeft, type RequestItem } from "@/lib/app/model";

/** "2 däcksatser, 4 skidpaket" */
export function itemsText(items: RequestItem[]): string {
  return items
    .map((i) => {
      const c = getCategory(i.category);
      return `${i.quantity} ${i.quantity === 1 ? c.unit.sv : c.unitPlural.sv}`;
    })
    .join(", ");
}

export function Avatar({ name, url, size = 44 }: { name: string; url: string | null | undefined; size?: number }) {
  return url ? (
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand" style={{ width: size, height: size }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-[#fff6e5] text-[#8a5a00]",
  accepted: "bg-[#e7f4ec] text-pine",
  declined: "bg-frost text-muted",
  cancelled: "bg-frost text-muted",
  expired: "bg-frost text-muted",
};

export function RequestCard({ request, now }: { request: HostRequest; now: number }) {
  const status = effectiveStatus(request, now);
  const name = request.renter?.first_name || "–";
  return (
    <Link prefetch={false} href={`/vard/forfragan?id=${request.id}`} className="card flex items-start gap-3 p-4 transition-colors hover:border-night/30">
      <Avatar name={name} url={request.renter?.avatar_url} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="font-bold text-night">{name}</span>
          {status === "pending" ? (
            <span className="flex items-center gap-1 text-sm font-semibold text-[#8a5a00]">
              <Hourglass size={15} aria-hidden="true" />
              {fill(appText.today.answerWithin, { time: timeLeft(request.expires_at, now) })}
            </span>
          ) : (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[status]}`}>{appText.requestStatus[status]}</span>
          )}
        </span>
        <span className="mt-0.5 block text-[0.95rem] text-ink">{itemsText(request.request_items)}</span>
        <span className="block text-sm text-muted">{formatPeriod(request.start_date, request.end_date, appText.common.untilFurtherNotice)}</span>
        {request.listing && <span className="block truncate text-sm text-muted">{request.listing.title}</span>}
      </span>
    </Link>
  );
}
