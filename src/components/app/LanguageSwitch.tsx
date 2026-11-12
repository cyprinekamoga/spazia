"use client";

import { Languages } from "lucide-react";
import { appText } from "@/content/app";
import { appLang, setAppLang, type AppLang } from "@/lib/app/lang";
import { supabase } from "@/lib/supabase";

const OPTIONS: { lang: AppLang; label: string }[] = [
  { lang: "sv", label: "Svenska" },
  { lang: "en", label: "English" },
];

/** Svenska / English. Saved in this browser and on the profile (for emails), then the app reloads. */
export function LanguageSwitch({ uid, className = "" }: { uid?: string | null; className?: string }) {
  async function choose(lang: AppLang) {
    if (lang === appLang) return;
    if (uid) await supabase().from("profiles").update({ lang }).eq("id", uid);
    setAppLang(lang);
  }
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Languages size={18} className="text-brand" aria-hidden="true" />
      <span className="sr-only">{appText.ui.language}</span>
      <div className="flex rounded-full border border-line bg-paper p-1" role="group" aria-label={appText.ui.language}>
        {OPTIONS.map((o) => (
          <button
            key={o.lang}
            type="button"
            lang={o.lang}
            aria-pressed={appLang === o.lang}
            onClick={() => choose(o.lang)}
            className="flex min-h-9 items-center rounded-full px-3 text-sm font-semibold text-muted aria-pressed:bg-night aria-pressed:text-white"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
