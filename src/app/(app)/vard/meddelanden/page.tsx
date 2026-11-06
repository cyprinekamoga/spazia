import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/HostShell";
import { MessagesPage } from "@/components/app/host/MessagesPage";

export const metadata: Metadata = { title: "Meddelanden" };

export default function Page() {
  return (
    <HostShell>
      <Suspense fallback={<Spinner />}>
        <MessagesPage />
      </Suspense>
    </HostShell>
  );
}
