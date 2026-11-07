import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { RenterHomePage } from "@/components/app/renter/HomePage";

export const metadata: Metadata = { title: "Hem" };

export default function Page() {
  return (
    <RenterShell>
      <Suspense fallback={<Spinner />}>
        <RenterHomePage />
      </Suspense>
    </RenterShell>
  );
}
