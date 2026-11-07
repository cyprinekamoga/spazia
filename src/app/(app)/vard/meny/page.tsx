import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/AppShell";
import { MenuPage } from "@/components/app/MenuPage";

export const metadata: Metadata = { title: "Meny" };

export default function Page() {
  return (
    <HostShell>
      <Suspense fallback={<Spinner />}>
        <MenuPage mode="host" />
      </Suspense>
    </HostShell>
  );
}
