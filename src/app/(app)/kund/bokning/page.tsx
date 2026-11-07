import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { BookingPage } from "@/components/app/renter/BookingPage";

export const metadata: Metadata = { title: "Bokning" };

export default function Page() {
  return (
    <RenterShell>
      <Suspense fallback={<Spinner />}>
        <BookingPage />
      </Suspense>
    </RenterShell>
  );
}
