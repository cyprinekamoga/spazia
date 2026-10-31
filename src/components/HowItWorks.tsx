"use client";

import { useId, useState } from "react";
import type { Dictionary } from "@/content";
import { StepList } from "./StepList";

export function HowItWorks({ t, initial = "renter" }: { t: Dictionary; initial?: "renter" | "host" }) {
  const [tab, setTab] = useState<"renter" | "host">(initial);
  const id = useId();
  const steps = tab === "renter" ? t.how.renterSteps : t.how.hostSteps;
  const tabs = [
    { key: "renter" as const, label: t.how.tabRenter },
    { key: "host" as const, label: t.how.tabHost },
  ];

  return (
    <div>
      <div role="tablist" aria-label={t.how.title} className="inline-flex rounded-full border border-line bg-paper p-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            id={`${id}-${tb.key}`}
            aria-selected={tab === tb.key}
            aria-controls={`${id}-panel`}
            tabIndex={tab === tb.key ? 0 : -1}
            onClick={() => setTab(tb.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const next = tab === "renter" ? "host" : "renter";
                setTab(next);
                document.getElementById(`${id}-${next}`)?.focus();
              }
            }}
            className="min-h-11 rounded-full px-4 py-2 text-[0.95rem] font-semibold text-muted transition-colors aria-selected:bg-night aria-selected:text-white sm:px-5"
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="mt-7">
        <StepList steps={steps} />
      </div>
    </div>
  );
}
