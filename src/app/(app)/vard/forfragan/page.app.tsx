import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/AppShell";
import { RequestPage } from "@/components/app/host/RequestPage";

export const metadata: Metadata = { title: "Förfrågan" };

export default function Page() {
  return (
    <HostShell>
      <Suspense fallback={<Spinner />}>
        <RequestPage />
      </Suspense>
    </HostShell>
  );
}
