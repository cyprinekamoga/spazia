import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { AdminPage } from "@/components/app/admin/AdminPage";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <AppShell mode="host" bare>
      <AdminPage />
    </AppShell>
  );
}
