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
  // The app's pages load their content in the browser: nothing to index yet.
  writeFileSync("out/robots.txt", "User-agent: *\nDisallow: /\n");
  console.log("postbuild: app export tidied (no landing photos or forms, robots.txt disallows all)");
} else {
  rmSync("out/sw.js", { force: true });
  rmSync("out/app.webmanifest", { force: true });
  rmSync("out/app-icons", { recursive: true, force: true });
  console.log("postbuild: site export tidied (no app service worker, manifest or icons)");
}
