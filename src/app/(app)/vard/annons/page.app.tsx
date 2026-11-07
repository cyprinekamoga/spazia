import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/AppShell";
import { ListingWizard } from "@/components/app/host/ListingWizard";

export const metadata: Metadata = { title: "Annons" };

export default function Page() {
  return (
    <HostShell bare>
      <Suspense fallback={<Spinner />}>
        <ListingWizard />
      </Suspense>
    </HostShell>
  );
}
