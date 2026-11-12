import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { AgreementPage } from "@/components/app/Agreement";

export const metadata: Metadata = { title: "Hyresavtal" };

export default function Page() {
  return (
    <RenterShell>
      <Suspense fallback={<Spinner />}>
        <AgreementPage mode="renter" />
      </Suspense>
    </RenterShell>
  );
}
