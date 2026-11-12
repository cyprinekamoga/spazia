"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { appLang } from "@/lib/app/lang";

const noop = () => () => {};

/**
 * The app's pages are built ahead of time in Swedish; in the browser the app
 * may run in English. Render nothing until we are in the browser (the server
 * snapshot is false, the browser's true), so the built HTML and the first
 * render always match, then show the app in the chosen language.
 */
export function AppLanguageGate({ children }: { children: ReactNode }) {
  const inBrowser = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  useEffect(() => {
    document.documentElement.lang = appLang;
  }, []);
  return inBrowser ? children : <div aria-busy="true" className="min-h-dvh" />;
}
