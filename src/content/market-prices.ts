import type { L10n } from "@/lib/i18n";

/**
 * What the alternatives cost, used by the renter price comparison and the
 * guides. Keep the sources and the "checked" month up to date: comparative
 * advertising must be accurate and verifiable (Marknadsföringslagen).
 */
export interface PriceSource {
  name: string;
  url: string;
  note: L10n;
}

export const marketPrices = {
  checked: { sv: "november 2026", en: "November 2026" } as L10n,

  /** Tyre hotel at a workshop: storage for one season (≈ 6 months) including one wheel change. */
  tyreHotel: {
    min: 970,
    max: 1700,
    sources: [
      {
        name: "Vianor",
        url: "https://vianor.se/dackverkstad/dackhotell/",
        note: { sv: "från 970 kr per säsong med hjulskifte", en: "from SEK 970 per season with a wheel change" },
      },
      {
        name: "Gummiverkstad.se",
        url: "https://www.gummiverkstad.se/dack/praktiska-guider/dackhotell/",
        note: {
          sv: "Däckia-verkstäder i Göteborg och Stockholm, 1 495–1 695 kr per säsong med hjulskifte",
          en: "Däckia workshops in Gothenburg and Stockholm, SEK 1,495–1,695 per season with a wheel change",
        },
      },
    ] satisfies PriceSource[],
  },

  /** Self-storage companies, per m² and month. */
  selfStorage: {
    minPerM2: 150,
    maxPerM2: 400,
    sources: [
      {
        name: "Offerta",
        url: "https://offerta.se/guider/flytt-och-transport/vad-kostar-magasinering",
        note: {
          sv: "150–400 kr per m² och månad, september 2026",
          en: "SEK 150–400 per m² and month, September 2026",
        },
      },
    ] satisfies PriceSource[],
  },
};

/** Tyre hotels charge per season (about six months), even for a shorter stay. */
export function tyreSeasons(months: number): number {
  return Math.max(1, Math.ceil(months / 6));
}
