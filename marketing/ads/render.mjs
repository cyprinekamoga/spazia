// Renders the image ads in ads.html to PNG files in out/.
//   node marketing/ads/render.mjs            all ads, both sizes
//   node marketing/ads/render.mjs host       one ad
// Needs Playwright with Chromium (preinstalled in Claude's cloud sessions; elsewhere: npx playwright install chromium).
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = dirname(fileURLToPath(import.meta.url));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };

/** Serve this folder over http (Chromium won't load fonts from file:// pages). */
export async function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    try {
      const body = await readFile(join(root, path || "ads.html"));
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

/** Wait until fonts and images are ready. */
export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.argv[2];
  const ads = ["tyres", "host", "prices"].filter((a) => !only || a === only);
  const { server, base } = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await mkdir(join(root, "out"), { recursive: true });
  for (const ad of ads) {
    for (const size of ["feed", "story"]) {
      await page.goto(`${base}/ads.html?ad=${ad}&size=${size}`);
      await settle(page);
      const file = join(root, "out", `spazia-${ad}-${size === "feed" ? "feed-1080x1350" : "story-1080x1920"}.png`);
      await page.locator("#ad").screenshot({ path: file });
      console.log("wrote", file);
    }
  }
  await browser.close();
  server.close();
}
