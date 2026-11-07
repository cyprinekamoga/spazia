import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/AppShell";
import { ListingsPage } from "@/components/app/host/ListingsPage";

export const metadata: Metadata = { title: "Annonser" };

export default function Page() {
  return (
    <HostShell>
      <Suspense fallback={<Spinner />}>
        <ListingsPage />
      </Suspense>
    </HostShell>
  );
}
