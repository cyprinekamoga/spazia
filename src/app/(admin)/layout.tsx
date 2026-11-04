import "@fontsource-variable/finlandica/wght.css";
import "@fontsource-variable/fraunces/opsz.css";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin | Spazia",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f6f8f9" };

/** The team's admin page: no site header, cookie banner or tracking. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-dvh bg-snow text-ink">{children}</body>
    </html>
  );
}
