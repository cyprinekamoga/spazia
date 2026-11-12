/**
 * After `next build`: tidy the exports. The landing site's photos and its
 * Netlify Forms page belong to spazia.se only; the service worker, the app
 * manifest and its icons belong to app.spazia.se only.
 */
import { rmSync, writeFileSync } from "node:fs";
import { buildTarget } from "./target.mjs";

if (buildTarget() === "app") {
  rmSync("out/images", { recursive: true, force: true });
  rmSync("out/__forms.html", { force: true });
  rmSync("out/og.jpg", { force: true });
  // Only public listings are for search engines (plus the scripts and styles
  // they need to render them). Everything else is behind a login.
  writeFileSync(
    "out/robots.txt",
    [
      "User-agent: *",
      "Allow: /annons",
      "Allow: /_next/",
      "Allow: /app-icons/",
      "Disallow: /",
      "",
      "Sitemap: https://app.spazia.se/sitemap-annonser.xml",
      "",
    ].join("\n"),
  );
  console.log("postbuild: app export tidied (no landing photos or forms, robots.txt allows listings only)");
} else {
  rmSync("out/sw.js", { force: true });
  rmSync("out/app.webmanifest", { force: true });
  rmSync("out/app-icons", { recursive: true, force: true });
  console.log("postbuild: site export tidied (no app service worker, manifest or icons)");
}
