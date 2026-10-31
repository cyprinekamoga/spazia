/**
 * Turn the original photos in photos-src/ into responsive WebP files in
 * public/images/ and write their sizes + dominant colour to
 * src/content/photo-manifest.json.
 *
 *   npm run images
 *
 * To replace a photo (e.g. with your own pictures of Luleå garages), drop a
 * JPG with the same name into photos-src/ and run the command again.
 * photos-src/ is git-ignored – only the optimised files are committed.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const srcDir = path.join(root, "photos-src");
const outDir = path.join(root, "public", "images");
const manifestPath = path.join(root, "src", "content", "photo-manifest.json");

/** Widths that cover phones (1x–3x) up to large desktop heroes. */
const WIDTHS = [480, 640, 960, 1280, 1800];
const QUALITY = 68;

await fs.mkdir(outDir, { recursive: true });
const files = (await fs.readdir(srcDir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const manifest = {};

for (const file of files) {
  const key = file.replace(/\.[^.]+$/, "");
  const input = sharp(path.join(srcDir, file)).rotate();
  const meta = await input.metadata();
  const { dominant } = await input.stats();
  const widths = WIDTHS.filter((w) => w < meta.width);
  widths.push(Math.min(meta.width, WIDTHS.at(-1)));
  const unique = [...new Set(widths)].sort((a, b) => a - b);

  for (const w of unique) {
    await sharp(path.join(srcDir, file))
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(path.join(outDir, `${key}-${w}.webp`));
  }
  const hex = `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  manifest[key] = { width: meta.width, height: meta.height, widths: unique, color: hex };
  console.log(`${key}: ${unique.join(", ")}`);
}

await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nWrote ${Object.keys(manifest).length} photos to public/images and ${path.relative(root, manifestPath)}`);
