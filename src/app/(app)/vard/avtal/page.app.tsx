import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/AppShell";
import { AgreementPage } from "@/components/app/Agreement";

export const metadata: Metadata = { title: "Hyresavtal" };

export default function Page() {
  return (
    <HostShell>
      <Suspense fallback={<Spinner />}>
        <AgreementPage mode="host" />
      </Suspense>
    </HostShell>
  );
}
