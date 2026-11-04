/** Read an environment variable inside a Netlify Function (or plain Node in tests). */
export function env(key: string): string {
  const netlify = (globalThis as { Netlify?: { env: { get(key: string): string | undefined } } }).Netlify;
  const value = netlify?.env.get(key) ?? process.env[key] ?? "";
  return value.trim();
}

/** Public address of the site, used in links in emails. */
export function siteUrl(): string {
  return env("SITE_URL") || "https://spazia.se";
}
