import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { RenterListingPage } from "@/components/app/renter/ListingPage";

// Public listings may be indexed (the rest of the app may not). The edge
// function netlify/edge-functions/listing-page.ts adds each listing's title,
// description and structured data, and "noindex" for unknown listings.
export const metadata: Metadata = { title: "Annons", robots: { index: true, follow: true } };

export default function Page() {
  return (
    <RenterShell bare open>
      <Suspense fallback={<Spinner />}>
        <RenterListingPage />
      </Suspense>
    </RenterShell>
  );
}
