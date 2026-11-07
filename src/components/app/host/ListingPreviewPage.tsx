"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { appText } from "@/content/app";
import { fetchListingBundle } from "@/lib/app/data";
import { useLoad } from "@/lib/app/session";
import { ListingView } from "../ListingView";
import { Spinner } from "../AppShell";

/** The host's own listing, shown the way renters will see it. */
export function ListingPreviewPage() {
  const id = useSearchParams().get("id") ?? "";
  const { data, loading } = useLoad(() => fetchListingBundle(id), id);

  if (loading) return <Spinner />;
  if (!data) return <p className="p-6 text-muted">{appText.common.error}</p>;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link prefetch={false} href="/vard/annonser" className="flex min-h-11 items-center gap-1.5 font-semibold text-night">
          <ArrowLeft size={18} aria-hidden="true" />
          {appText.listings.title}
        </Link>
        <Link prefetch={false} href={`/vard/annons?id=${id}&steg=review`} className="btn btn-secondary !py-2 text-sm">
          <Pencil size={16} aria-hidden="true" />
          {appText.listings.edit}
        </Link>
      </div>
      <ListingView listing={data.listing} spaces={data.spaces} photos={data.photos} host={data.host} preview />
    </div>
  );
}
