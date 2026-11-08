import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/AppShell";
import { PayoutsPage } from "@/components/app/host/PayoutsPage";

export const metadata: Metadata = { title: "Utbetalningar" };

export default function Page() {
  return (
    <HostShell>
      <Suspense fallback={<Spinner />}>
        <PayoutsPage />
      </Suspense>
    </HostShell>
  );
}
