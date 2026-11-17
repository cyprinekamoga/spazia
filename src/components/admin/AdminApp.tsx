"use client";

import { useEffect } from "react";
import { site } from "@/lib/site";

/**
 * spazia.se/admin: the sign-ups are now a tab in the app's admin page
 * (app.spazia.se/admin, login with two-factor code), so this forwards there,
 * keeping a #lead=… from the team emails.
 */
export function AdminApp() {
  const target = `${site.appUrl}/admin`;
  useEffect(() => {
    window.location.replace(`${target}${window.location.hash}`);
  }, [target]);
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-center text-muted">
        Admin finns nu på{" "}
        <a href={target} className="font-semibold text-night underline underline-offset-4">
          app.spazia.se/admin
        </a>
        .
      </p>
    </main>
  );
}
