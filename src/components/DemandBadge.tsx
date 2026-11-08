"use client";

import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { getDictionary } from "@/content";
import { townKey } from "@/content/cities";
import { fill, type Lang } from "@/lib/i18n";

type Town = { name: string; total: number };

/**
 * "42 har anmält sig i Göteborg": shows that others are already waiting.
 * Nothing is shown until a town has at least a few sign-ups.
 */
export function DemandBadge({ lang, town, className = "" }: { lang: Lang; town: string; className?: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/waitlist/demand")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { towns?: Town[] } | null) => {
        const match = data?.towns?.find((t) => townKey(t.name) === townKey(town));
        if (!cancelled && match) setCount(match.total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [town]);

  if (count === null) return null;
  return (
    <p className={`inline-flex items-center gap-2 rounded-full bg-pine-soft px-3.5 py-1.5 font-semibold text-pine ${className}`}>
      <Users size={17} aria-hidden="true" />
      {fill(getDictionary(lang).cityPage.signedUp, { count, name: town })}
    </p>
  );
}
