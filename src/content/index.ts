import type { Lang } from "@/lib/i18n";
import { en } from "./en";
import { sv, type Dictionary } from "./sv";

const dictionaries: Record<Lang, Dictionary> = { sv, en };

export function getDictionary(lang: Lang): Dictionary {
  return dictionaries[lang];
}

export type { Dictionary };
