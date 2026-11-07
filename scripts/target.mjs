/**
 * Which part of Spazia a build is for: "site" (spazia.se) or "app" (app.spazia.se).
 * Set SPAZIA_TARGET, or let Netlify's project name decide ("spazia-app" builds the app).
 */
export function buildTarget() {
  const explicit = process.env.SPAZIA_TARGET;
  if (explicit === "app" || explicit === "site") return explicit;
  return (process.env.SITE_NAME ?? "").startsWith("spazia-app") ? "app" : "site";
}
