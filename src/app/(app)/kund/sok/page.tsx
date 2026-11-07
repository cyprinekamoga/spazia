import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { SearchPage } from "@/components/app/renter/SearchPage";

export const metadata: Metadata = { title: "Hitta plats" };

export default function Page() {
  return (
    <RenterShell>
      <Suspense fallback={<Spinner />}>
        <SearchPage />
      </Suspense>
    </RenterShell>
  );
}
