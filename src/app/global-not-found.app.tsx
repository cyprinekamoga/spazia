import "@fontsource-variable/finlandica/wght.css";
import "@fontsource-variable/fraunces/opsz.css";
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { sv } from "@/content/sv";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "404 | Spazia",
  robots: { index: false },
};

/** Any address on app.spazia.se that matches no page. */
export default function GlobalNotFound() {
  return (
    <html lang="sv">
      <body className="flex min-h-dvh items-center justify-center bg-snow p-6">
        <main className="w-full max-w-lg text-center">
          <a href={site.url} aria-label="Spazia" className="inline-block">
            <LogoMark className="mx-auto h-16 w-auto" id="logo-404" />
          </a>
          <p className="font-display mt-6 text-6xl font-extrabold text-night">404</p>
          <h1 className="mt-4 text-2xl font-bold text-night">{sv.notFound.title}</h1>
          <p className="mt-2 text-muted">{sv.notFound.text}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link prefetch={false} href="/sok" className="btn btn-primary">
              Hitta plats
            </Link>
            <a href={site.url} className="btn btn-secondary">
              {sv.notFound.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
