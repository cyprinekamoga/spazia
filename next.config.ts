import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * One codebase, two Netlify projects:
 * - "site": the landing pages on spazia.se (page.tsx, layout.tsx, ...)
 * - "app":  the app on app.spazia.se (page.app.tsx, layout.app.tsx, ...)
 * Each build only sees its own route files, so a problem in one can't break
 * the other, and each deploys on its own.
 */
// Same rule as scripts/target.mjs (used by the Netlify ignore check).
const target =
  process.env.SPAZIA_TARGET === "app" || process.env.SPAZIA_TARGET === "site"
    ? process.env.SPAZIA_TARGET
    : (process.env.SITE_NAME ?? "").startsWith("spazia-app")
      ? "app"
      : "site";

export default function config(phase: string): NextConfig {
  return {
    // Static HTML export – served by Netlify from /out.
    output: "export",
    images: { unoptimized: true },
    pageExtensions: target === "app" ? ["app.tsx", "app.ts"] : ["tsx", "ts"],
    // Separate folders so both dev servers can run side by side. Builds keep the
    // default, because a static export is written to distDir when it is set.
    distDir:
      phase === PHASE_DEVELOPMENT_SERVER && target === "app"
        ? ".next-app"
        : ".next",
    experimental: {
      // Needed because the site has two root layouts (sv + en).
      globalNotFound: true,
    },
  };
}
