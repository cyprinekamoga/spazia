import { describe, expect, it } from "vitest";
import { errorEmailText, fingerprint, isNoise } from "./client-errors";

describe("browser error reports", () => {
  it("ignores noise that isn't ours", () => {
    expect(isNoise({ message: "ResizeObserver loop completed with undelivered notifications.", stack: "" })).toBe(true);
    expect(isNoise({ message: "x is undefined", stack: "at chrome-extension://abc/content.js:1:2" })).toBe(true);
    expect(isNoise({ message: "Failed to fetch", stack: "" })).toBe(true);
    expect(isNoise({ message: "Cannot read properties of undefined (reading 'filter')", stack: "at a (app.js:1:2)" })).toBe(false);
  });

  it("groups the same error across builds, ids and numbers", () => {
    const a = fingerprint({ message: "Listing 3f2a1b4c-1111-4111-8111-111111111111 not found (404)", stack: "TypeError\n    at load (https://app.spazia.se/_next/chunk.js?v=1:10:20)" });
    const b = fingerprint({ message: "Listing 9e8d7c6b-2222-4222-8222-222222222222 not found (500)", stack: "TypeError\n    at load (https://app.spazia.se/_next/chunk.js?v=2:99:7)" });
    const c = fingerprint({ message: "Something else", stack: "" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("writes a readable email", () => {
    const text = errorEmailText({ message: "Boom", stack: "at x", url: "https://app.spazia.se/sok", userAgent: "UA", lang: "sv" }, 3);
    expect(text).toContain("har hänt 3 gånger");
    expect(text).toContain("Sida: https://app.spazia.se/sok");
  });
});
