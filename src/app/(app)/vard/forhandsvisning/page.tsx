import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/HostShell";
import { ListingPreviewPage } from "@/components/app/host/ListingPreviewPage";

export const metadata: Metadata = { title: "Förhandsvisning" };

export default function Page() {
  return (
    <HostShell bare>
      <Suspense fallback={<Spinner />}>
        <ListingPreviewPage />
      </Suspense>
    </HostShell>
  );
}
