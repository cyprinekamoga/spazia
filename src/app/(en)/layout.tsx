import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/SiteShell";
import { getDictionary } from "@/content";
import { site } from "@/lib/site";

const t = getDictionary("en");

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: t.meta.homeTitle, template: t.meta.titleTemplate },
  description: t.meta.homeDescription,
  applicationName: site.name,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f8f9",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <SiteShell lang="en">{children}</SiteShell>;
}
