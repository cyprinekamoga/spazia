import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { RenterListingPage } from "@/components/app/renter/ListingPage";

export const metadata: Metadata = { title: "Annons" };

export default function Page() {
  return (
    <RenterShell bare>
      <Suspense fallback={<Spinner />}>
        <RenterListingPage />
      </Suspense>
    </RenterShell>
  );
}
