import { describe, expect, it, vi } from "vitest";
import { bearerToken, corsHeaders, isAppAdmin } from "./app-admin";

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.signature-part";
const req = (headers: Record<string, string> = {}) => new Request("https://spazia.se/api/admin/data", { headers });

describe("access to the sign-ups API", () => {
  it("needs a login token", async () => {
    expect(bearerToken(req())).toBeNull();
    expect(bearerToken(req({ authorization: "Basic abc" }))).toBeNull();
    expect(await isAppAdmin(req())).toBe(false);
  });

  it("asks the database with the token and trusts only a plain true", async () => {
    const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
    const yes = answer(true);
    expect(await isAppAdmin(req({ authorization: `Bearer ${TOKEN}` }), yes as unknown as typeof fetch)).toBe(true);
    const call = yes.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toMatch(/\/rest\/v1\/rpc\/admin_check$/);
    expect((call[1].headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
    expect(await isAppAdmin(req({ authorization: `Bearer ${TOKEN}` }), answer(false) as unknown as typeof fetch)).toBe(false);
    expect(await isAppAdmin(req({ authorization: `Bearer ${TOKEN}` }), answer({ message: "JWT expired" }, 401) as unknown as typeof fetch)).toBe(false);
  });

  it("lets only the app read the answers in a browser", () => {
    expect(corsHeaders(req({ origin: "https://app.spazia.se" }))["access-control-allow-origin"]).toBe("https://app.spazia.se");
    expect(corsHeaders(req({ origin: "https://evil.example" }))["access-control-allow-origin"]).toBe("https://app.spazia.se");
  });
});
