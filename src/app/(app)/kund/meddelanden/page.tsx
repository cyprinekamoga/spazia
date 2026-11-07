import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { MessagesPage } from "@/components/app/MessagesPage";

export const metadata: Metadata = { title: "Meddelanden" };

export default function Page() {
  return (
    <RenterShell>
      <Suspense fallback={<Spinner />}>
        <MessagesPage mode="renter" />
      </Suspense>
    </RenterShell>
  );
}
