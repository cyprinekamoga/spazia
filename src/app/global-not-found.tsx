import "@fontsource-variable/finlandica/wght.css";
import "@fontsource-variable/fraunces/opsz.css";
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { sv } from "@/content/sv";
import { en } from "@/content/en";

export const metadata: Metadata = {
  title: "404 | Spazia",
  robots: { index: false },
};

/** Shown for any URL that matches no page (the site has two root layouts). */
export default function GlobalNotFound() {
  return (
    <html lang="sv">
      <body className="flex min-h-dvh items-center justify-center bg-snow p-6">
        <main className="w-full max-w-lg text-center">
          <Link prefetch={false} href="/" aria-label="Spazia" className="inline-block">
            <LogoMark className="mx-auto h-16 w-auto" id="logo-404" />
          </Link>
          <p className="font-display mt-6 text-6xl font-extrabold text-night">404</p>
          <h1 className="mt-4 text-2xl font-bold text-night">{sv.notFound.title}</h1>
          <p className="mt-2 text-muted">{sv.notFound.text}</p>
          <p className="mt-1 text-muted" lang="en">
            {en.notFound.title}. {en.notFound.text}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link prefetch={false} href="/" className="btn btn-primary">
              {sv.notFound.home}
            </Link>
            <Link prefetch={false} href="/en" className="btn btn-secondary" lang="en">
              {en.notFound.home}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
