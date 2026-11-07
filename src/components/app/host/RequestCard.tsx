"use client";

import Link from "next/link";
import { Hourglass } from "lucide-react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import type { HostRequest } from "@/lib/app/data";
import { effectiveStatus, periodText, timeLeft } from "@/lib/app/model";
import { Avatar, itemsText, StatusChip } from "../ui";

export { Avatar, itemsText };

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
            <StatusChip status={status} kind={request.kind} />
          )}
        </span>
        <span className="mt-0.5 block text-[0.95rem] text-ink">{itemsText(request.request_items)}</span>
        <span className="block text-sm text-muted">{periodText(request, appText.common.untilFurtherNotice)}</span>
        {request.listing && <span className="block truncate text-sm text-muted">{request.listing.title}</span>}
      </span>
    </Link>
  );
}
