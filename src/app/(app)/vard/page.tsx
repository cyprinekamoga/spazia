import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/AppShell";
import { TodayPage } from "@/components/app/host/TodayPage";

export const metadata: Metadata = { title: "Idag" };

export default function Page() {
  return (
    <HostShell>
      <Suspense fallback={<Spinner />}>
        <TodayPage />
      </Suspense>
    </HostShell>
  );
}
