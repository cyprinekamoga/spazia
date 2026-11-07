"use client";

/* eslint-disable @next/next/no-img-element -- photos come from Google or Supabase Storage */
import { ImageOff } from "lucide-react";
import { appText } from "@/content/app";
import { getCategory } from "@/content/categories";
import type { RequestItem, RequestStatus } from "@/lib/app/model";
import { photoUrl } from "@/lib/supabase";

/** "2 däcksatser, 4 skidpaket" */
export function itemsText(items: Pick<RequestItem, "category" | "quantity">[]): string {
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

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: "bg-[#fff6e5] text-[#8a5a00]",
  accepted: "bg-[#e7f4ec] text-pine",
  declined: "bg-frost text-muted",
  cancelled: "bg-frost text-muted",
  expired: "bg-frost text-muted",
};

/** Status label; an accepted hourly parking booking reads "Bokad". */
export function StatusChip({ status, kind }: { status: RequestStatus; kind?: "month" | "hour" }) {
  const label = kind === "hour" && status === "accepted" ? "Bokad" : appText.requestStatus[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${STATUS_STYLE[status]}`}>{label}</span>;
}

/** The first photo of a listing (by position), or a quiet placeholder. */
export function CoverPhoto({ photos, className = "" }: { photos: { path: string; position: number }[] | undefined; className?: string }) {
  const first = [...(photos ?? [])].sort((a, b) => a.position - b.position)[0];
  return first ? (
    <img src={photoUrl(first.path)} alt="" loading="lazy" className={`object-cover ${className}`} />
  ) : (
    <span className={`flex items-center justify-center bg-frost text-muted ${className}`}>
      <ImageOff size={22} aria-hidden="true" />
    </span>
  );
}
