import type { Metadata } from "next";
import { Suspense } from "react";
import { RenterShell, Spinner } from "@/components/app/AppShell";
import { ParkingBookingPage } from "@/components/app/renter/ParkingBookingPage";

export const metadata: Metadata = { title: "Boka parkering" };

export default function Page() {
  return (
    <RenterShell bare>
      <Suspense fallback={<Spinner />}>
        <ParkingBookingPage />
      </Suspense>
    </RenterShell>
  );
}
