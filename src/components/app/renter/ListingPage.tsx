"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { appText } from "@/content/app";
import { fetchListingBundle, fetchMyOpenRequest } from "@/lib/app/data";
import { useLoad } from "@/lib/app/session";
import { ListingView } from "../ListingView";
import { Spinner, useAppSession } from "../AppShell";

const t = appText.renterListing;

/** A listing as a renter sees it, with "Skicka förfrågan". */
export function RenterListingPage() {
  const uid = useAppSession().user.id;
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { data, loading } = useLoad(async () => {
    const [bundle, open] = await Promise.all([fetchListingBundle(id), fetchMyOpenRequest(id, uid)]);
    return { bundle, open };
  }, `${id}:${uid}`);

  function back() {
    if (window.history.length > 1) router.back();
    else router.push("/kund/sok");
  }

  const backButton = (
    <button type="button" onClick={back} className="flex min-h-11 items-center gap-1.5 font-semibold text-night">
      <ArrowLeft size={18} aria-hidden="true" />
      {t.back}
    </button>
  );

  if (loading) return <Spinner />;
  const bundle = data?.bundle;
  if (!bundle) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
        {backButton}
        <p className="mt-6 text-lg text-muted">{t.unavailable}</p>
        <Link prefetch={false} href="/kund/sok" className="btn btn-primary mt-4">
          {appText.booking.findOther}
        </Link>
      </div>
    );
  }

  const { listing } = bundle;
  const open = data?.open ?? null;
  const own = listing.host_id === uid;
  const unavailable = listing.status !== "published";
  const action = !own && !unavailable && !open ? { href: `/kund/skicka?id=${listing.id}`, label: t.request } : null;
  const notice = own ? (
    <p className="text-muted">{t.own}</p>
  ) : open ? (
    <p className="text-ink">
      {t.existing}{" "}
      <Link prefetch={false} href={`/kund/bokning?id=${open.id}`} className="font-semibold text-brand underline underline-offset-4">
        {t.seeRequest}
      </Link>
    </p>
  ) : unavailable ? (
    <p className="text-muted">{t.unavailable}</p>
  ) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
      <div className="mb-4">{backButton}</div>
      <ListingView listing={listing} spaces={bundle.spaces} photos={bundle.photos} host={bundle.host} action={action} notice={notice} />
    </div>
  );
}
