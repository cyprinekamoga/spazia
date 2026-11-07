"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { lastMode, MODE_HOME } from "@/lib/app/mode";
import { useSession } from "@/lib/app/session";
import { Spinner } from "./AppShell";

/** app.spazia.se/: logged in → the side used last (or the chooser); otherwise the public search. */
export function AppStart() {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session.status === "loading") return;
    if (session.status === "signedOut") {
      router.replace("/sok");
      return;
    }
    const mode = lastMode();
    router.replace(mode ? MODE_HOME[mode] : "/konto");
  }, [session.status, router]);
  return <Spinner />;
}
