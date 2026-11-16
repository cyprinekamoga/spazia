import { describe, expect, it } from "vitest";
import { afterFailure, isLocked, MAX_FAILURES, WINDOW } from "./login-throttle";

describe("admin login throttle", () => {
  it("locks after too many wrong passwords and opens again after the window", () => {
    let a = null as ReturnType<typeof afterFailure> | null;
    for (let i = 0; i < MAX_FAILURES - 1; i++) a = afterFailure(a, 1000 + i);
    expect(isLocked(a, 2000)).toBe(false);
    a = afterFailure(a, 2000);
    expect(isLocked(a, 2001)).toBe(true);
    expect(isLocked(a, 1000 + WINDOW + 1)).toBe(false);
    expect(afterFailure(a, 1000 + WINDOW + 1)).toEqual({ failures: 1, since: 1000 + WINDOW + 1 });
  });
});
