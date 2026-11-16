import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext (where to go after login)", () => {
  it("keeps paths inside the app", () => {
    expect(safeNext("/vard/annons")).toBe("/vard/annons");
    expect(safeNext("/kund/bokning?id=1#x")).toBe("/kund/bokning?id=1#x");
  });

  it("refuses anything that leads to another site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "/ /evil.com", "https://evil.com", "evil.com", "/%0d/evil.com", "", null]) {
      const out = safeNext(bad);
      expect(new URL(out, "https://app.spazia.se").origin, String(bad)).toBe("https://app.spazia.se");
    }
    expect(safeNext("/\\evil.com")).toBe("/konto");
  });
});
