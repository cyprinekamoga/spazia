import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/HostShell";
import { MenuPage } from "@/components/app/host/MenuPage";

export const metadata: Metadata = { title: "Meny" };

export default function Page() {
  return (
    <HostShell>
      <Suspense fallback={<Spinner />}>
        <MenuPage />
      </Suspense>
    </HostShell>
  );
}
