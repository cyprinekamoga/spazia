import type { Metadata } from "next";
import { Suspense } from "react";
import { HostShell, Spinner } from "@/components/app/AppShell";
import { MessagesPage } from "@/components/app/MessagesPage";

export const metadata: Metadata = { title: "Meddelanden" };

export default function Page() {
  return (
    <HostShell>
      <Suspense fallback={<Spinner />}>
        <MessagesPage mode="host" />
      </Suspense>
    </HostShell>
  );
}
