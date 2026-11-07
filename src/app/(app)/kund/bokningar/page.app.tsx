import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { BookingsPage } from "@/components/app/renter/BookingsPage";

export const metadata: Metadata = { title: "Bokningar" };

export default function Page() {
  return (
    <RenterShell>
      <Suspense fallback={<Spinner />}>
        <BookingsPage />
      </Suspense>
    </RenterShell>
  );
}
