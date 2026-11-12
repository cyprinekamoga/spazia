"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { appText } from "@/content/app";
import { FEES } from "@/content/pricing";
import { appLang } from "@/lib/app/lang";
import { listingSeo } from "@/lib/listing-seo";
import { site } from "@/lib/site";
import { fetchListingBundle, fetchMyOpenRequest } from "@/lib/app/data";
import { useLoad } from "@/lib/app/session";
import { ListingView } from "../ListingView";
import { ReportButton } from "../Report";
import { ListingReviewsSection } from "../Reviews";
import { Spinner, useOptionalSession } from "../AppShell";

const t = appText.renterListing;

/**
 * A listing with "Skicka förfrågan". Open to everyone: visitors who aren't
 * logged in are asked to log in first and then land on the request form.
 */
export function RenterListingPage() {
  const uid = useOptionalSession()?.user.id ?? null;
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { data, loading } = useLoad(async () => {
    const [bundle, open] = await Promise.all([fetchListingBundle(id), uid ? fetchMyOpenRequest(id, uid) : Promise.resolve(null)]);
    return { bundle, open };
  }, `${id}:${uid ?? ""}`);

  // The same title and description the edge function serves to search engines
  // (they read the page after it has run in the browser).
  useEffect(() => {
    const b = data?.bundle;
    if (!b || b.listing.status !== "published") return;
    const seo = listingSeo(
      { ...b.listing, listing_spaces: b.spaces, listing_photos: b.photos },
      { lang: appLang, appUrl: site.appUrl, storageUrl: site.appSupabaseUrl, serviceFee: FEES.renterServiceFee },
    );
    document.title = seo.title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = seo.description;
  }, [data]);

  function back() {
    if (window.history.length > 1) router.back();
    else router.push("/sok");
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
        <Link prefetch={false} href="/sok" className="btn btn-primary mt-4">
          {appText.booking.findOther}
        </Link>
      </div>
    );
  }

  const { listing } = bundle;
  const open = data?.open ?? null;
  const own = listing.host_id === uid;
  const unavailable = listing.status !== "published";
  // Visitors who aren't logged in log in first and then land on the form.
  const withLogin = (path: string) => (uid ? path : `/logga-in?next=${encodeURIComponent(path)}`);
  const canAct = !own && !unavailable;
  const actions = [
    ...(canAct && !open && bundle.spaces.some((s) => s.host_price_month != null) ? [{ href: withLogin(`/kund/skicka?id=${listing.id}`), label: t.request }] : []),
    ...(canAct && bundle.spaces.some((s) => s.hourly_price != null) ? [{ href: withLogin(`/kund/parkera?id=${listing.id}`), label: t.bookParking }] : []),
  ];
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
      <ListingView listing={listing} spaces={bundle.spaces} photos={bundle.photos} host={bundle.host} actions={actions} notice={notice} />
      <ListingReviewsSection listingId={listing.id} />
      {uid && !own && (
        <div className="mt-8 border-t border-line pt-4">
          <ReportButton kind="listing" targetId={listing.id} label={appText.report.listing} />
        </div>
      )}
    </div>
  );
}
