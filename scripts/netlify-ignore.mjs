/**
 * Netlify "ignore" check: skip a build when nothing that project uses changed,
 * so a change to the app doesn't rebuild the landing site and the other way round.
 * Exit 0 = skip the build, exit 1 = build.
 */
import { execSync } from "node:child_process";
import { buildTarget } from "./target.mjs";

const target = buildTarget();
const from = process.env.CACHED_COMMIT_REF;
const to = process.env.COMMIT_REF;

/** Only used by the app (app.spazia.se). */
const APP_ONLY = [/^src\/app\/\(app\)\//, /^src\/app\/[^/]+\.app\.tsx?$/, /^src\/components\/app\//, /^src\/lib\/app\//, /^src\/content\/app\.ts$/, /^supabase\//];
/** Only used by the landing site (spazia.se). */
const SITE_ONLY = [
  /^src\/app\/\((sv|en|admin)\)\//,
  /^src\/app\/(robots|sitemap|global-not-found)\.tsx?$/,
  /^src\/views\//,
  /^src\/components\/(admin|forms)\//,
  /^src\/server\//,
  /^src\/content\/(sv|en|guides|market-prices|cities)\.ts$/,
  /^netlify\/functions\//,
  /^public\/photos\//,
];
/** Used by neither build. */
const NEITHER = [/^docs\//, /\.md$/, /^\.github\//, /^scripts\/(build-images|netlify-ignore)\.mjs$/];

function build(reason) {
  console.log(`[${target}] build: ${reason}`);
  process.exit(1);
}

if (!from || !to || from === to) build("no earlier deploy to compare with");
let files;
try {
  files = execSync(`git diff --name-only ${from} ${to}`, { encoding: "utf8" }).split("\n").filter(Boolean);
} catch {
  build("could not compare commits");
}
const other = target === "app" ? SITE_ONLY : APP_ONLY;
const relevant = files.filter((f) => !NEITHER.some((r) => r.test(f)) && !other.some((r) => r.test(f)));
if (relevant.length > 0) build(`${relevant.length} changed file(s), e.g. ${relevant.slice(0, 3).join(", ")}`);
console.log(`[${target}] skip: none of the ${files.length} changed file(s) are used by this project`);
process.exit(0);
