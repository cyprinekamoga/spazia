// Prints the posters in posters.html to out/: one A4 PDF per poster (for the
// printer), a PDF with all three, and a PNG of each at 300 dpi (to preview or
// send to a print shop).
//   node marketing/posters/render.mjs
// Needs Playwright with Chromium (preinstalled in Claude's cloud sessions).
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, ".."); // marketing/: posters use ../ads/assets for fonts and logos
const TYPES = { ".html": "text/html", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".js": "text/javascript" };
const POSTERS = ["host", "renter", "tabs"];

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/posters/posters.html`;

const settle = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
  });

const browser = await chromium.launch();
await mkdir(join(here, "out"), { recursive: true });
// A4 at 96 css px per inch is 793.7 × 1122.5 px; 3.125× gives 300 dpi.
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 3.125 });
for (const p of POSTERS) {
  await page.goto(`${base}?p=${p}`);
  await settle(page);
  await page.pdf({ path: join(here, "out", `spazia-affisch-${p}-A4.pdf`), format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.locator(".poster").screenshot({ path: join(here, "out", `spazia-affisch-${p}-A4.png`) });
  console.log("wrote", p);
}
await page.goto(base);
await settle(page);
await page.addStyleTag({ content: "body.gallery{display:block;padding:0;background:#fff} body.gallery .poster{margin:0}" });
await page.pdf({ path: join(here, "out", "spazia-affischer-alla-A4.pdf"), format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
console.log("wrote all");
await browser.close();
server.close();
