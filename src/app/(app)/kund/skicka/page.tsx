import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { RequestFormPage } from "@/components/app/renter/RequestFormPage";

export const metadata: Metadata = { title: "Skicka förfrågan" };

export default function Page() {
  return (
    <RenterShell bare>
      <Suspense fallback={<Spinner />}>
        <RequestFormPage />
      </Suspense>
    </RenterShell>
  );
}
