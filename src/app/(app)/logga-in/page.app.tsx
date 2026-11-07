import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/components/app/LoginPage";

export const metadata: Metadata = { title: "Logga in" };

export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
