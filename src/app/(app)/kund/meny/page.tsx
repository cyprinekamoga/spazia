import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { MenuPage } from "@/components/app/MenuPage";

export const metadata: Metadata = { title: "Meny" };

export default function Page() {
  return (
    <RenterShell>
      <Suspense fallback={<Spinner />}>
        <MenuPage mode="renter" />
      </Suspense>
    </RenterShell>
  );
}
