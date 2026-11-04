/** Small helpers shared by the API functions. */

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function error(status: number, code: string): Response {
  return json({ error: code }, status);
}

/**
 * Requests that change something must come from our own pages: same origin
 * and a JSON body (a plain cross-site form cannot send that).
 */
export function isSameOriginJson(req: Request): boolean {
  const origin = req.headers.get("origin");
  const ownOrigin = new URL(req.url).origin;
  const contentType = req.headers.get("content-type") ?? "";
  return origin === ownOrigin && contentType.startsWith("application/json");
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
