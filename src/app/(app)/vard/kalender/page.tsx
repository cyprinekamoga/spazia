import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/HostShell";
import { CalendarPage } from "@/components/app/host/CalendarPage";

export const metadata: Metadata = { title: "Kalender" };

export default function Page() {
  return (
    <HostShell>
      <Suspense fallback={<Spinner />}>
        <CalendarPage />
      </Suspense>
    </HostShell>
  );
}
