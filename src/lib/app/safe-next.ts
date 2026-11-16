/**
 * Only allow redirects inside the app: a path like "/vard/annons". Not
 * "//evil.com" or "/\evil.com" (browsers read a backslash as a slash), nor
 * anything else that resolves to another site.
 */
export function safeNext(value: string | null, fallback = "/konto"): string {
  if (!value || !value.startsWith("/") || /[\\\s]/.test(value) || value.startsWith("//")) return fallback;
  try {
    const base = "https://app.invalid";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
