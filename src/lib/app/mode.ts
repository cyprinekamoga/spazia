"use client";

import type { AppMode } from "./model";

const KEY = "spazia-mode";

/** Remember which side of the app was used last (only a convenience). */
export function rememberMode(mode: AppMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Private mode or blocked storage: nothing to remember.
  }
}

export function lastMode(): AppMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "host" || v === "renter" ? v : null;
  } catch {
    return null;
  }
}

export const MODE_HOME: Record<AppMode, string> = { host: "/vard", renter: "/kund" };
