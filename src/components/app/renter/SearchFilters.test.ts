import { describe, expect, it } from "vitest";
import { activeFilterCount, filtersFromParams, filtersToParams } from "./SearchFilters";

describe("search filters in the address", () => {
  it("round-trips", () => {
    const f = { maxPrice: 200, minSize: 10, heated: true, anytime: true, features: ["lockable" as const, "power" as const] };
    const q = new URLSearchParams("ort=Uppsala&sort=price");
    filtersToParams(f, q);
    expect(q.toString()).toBe("ort=Uppsala&sort=price&pris=200&m2=10&varme=1&dygnet=1&egenskaper=lockable%2Cpower");
    expect(filtersFromParams(q)).toEqual(f);
    expect(activeFilterCount(f)).toBe(6);
  });

  it("ignores rubbish", () => {
    expect(filtersFromParams(new URLSearchParams("pris=-5&m2=abc&egenskaper=lockable,hack&varme=yes"))).toEqual({
      maxPrice: null,
      minSize: null,
      heated: false,
      anytime: false,
      features: ["lockable"],
    });
  });
});
