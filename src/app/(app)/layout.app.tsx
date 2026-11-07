import "@fontsource-variable/finlandica/wght.css";
import "@fontsource-variable/fraunces/opsz.css";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Spazia", template: "%s | Spazia" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f6f8f9", viewportFit: "cover" };

/** The logged-in app: no marketing header, cookie banner or tracking. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-dvh bg-snow text-ink">{children}</body>
    </html>
  );
}
