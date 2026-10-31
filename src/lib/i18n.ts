export type Lang = "sv" | "en";

export const LANGS: Lang[] = ["sv", "en"];

/** A value that exists in every supported language. */
export type L10n<T = string> = Record<Lang, T>;

/** Replace `{name}` placeholders in a string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

const numberFormats: L10n<Intl.NumberFormat> = {
  sv: new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }),
  en: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }),
};

export function formatNumber(value: number, lang: Lang): string {
  return numberFormats[lang].format(value);
}
