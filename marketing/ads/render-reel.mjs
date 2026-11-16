// Renders reel.html to out/spazia-reel-1080x1920.mp4 (H.264, 30 fps, no sound).
//   node marketing/ads/render-reel.mjs            the whole video
//   node marketing/ads/render-reel.mjs --stills   a few frames as JPG, to check the layout quickly
// Needs Playwright with Chromium and ffmpeg.
import { createRequire } from "node:module";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { serve, settle } from "./render.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const stills = process.argv.includes("--stills");

const { server, base } = await serve();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`${base}/reel.html?capture`);
await settle(page);
const duration = await page.evaluate(() => window.DURATION);
const reel = page.locator("#reel");
await mkdir(join(root, "out"), { recursive: true });

if (stills) {
  for (const t of [1.5, 4.5, 8.5, 11.8, 14.5]) {
    await page.evaluate((x) => window.render(x), t);
    const file = join(root, "out", `reel-still-${String(t).replace(".", "_")}.jpg`);
    await reel.screenshot({ path: file, type: "jpeg", quality: 85 });
    console.log("wrote", file);
  }
} else {
  const frames = await mkdtemp(join(tmpdir(), "spazia-reel-"));
  const total = Math.round(duration * FPS);
  for (let i = 0; i < total; i++) {
    await page.evaluate((x) => window.render(x), i / FPS);
    await reel.screenshot({ path: join(frames, `f${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 95 });
    if (i % 90 === 0) console.log(`frame ${i}/${total}`);
  }
  const out = join(root, "out", "spazia-reel-1080x1920.mp4");
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", String(FPS), "-i", join(frames, "f%04d.jpg"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  await rm(frames, { recursive: true, force: true });
  console.log("wrote", out);
}
await browser.close();
server.close();
