import type { L10n } from "@/lib/i18n";
import type { PhotoKey } from "./photos";

/**
 * Cities with their own page. Spazia works all over Sweden; these are the
 * cities we feature. Add a city here and its page, footer link and sitemap
 * entry appear automatically.
 */
export interface City {
  id: string;
  slug: string;
  name: string;
  photo: PhotoKey;
  intro: L10n;
}

export const cities: City[] = [
  {
    id: "stockholm",
    slug: "stockholm",
    name: "Stockholm",
    photo: "moving",
    intro: {
      sv: "I Stockholm är lägenhetsförråden ofta små och det kan vara lång kö till en p-plats. Samtidigt har villorna i förorterna garage, källare och uppfarter med plats över.",
      en: "In Stockholm, flat storerooms are often small and the queue for a parking space can be long. Meanwhile, houses in the suburbs have garages, basements and driveways with room to spare.",
    },
  },
  {
    id: "goteborg",
    slug: "goteborg",
    name: "Göteborg",
    photo: "garage-field",
    intro: {
      sv: "Sveriges näst största stad, med tusentals studenter vid Göteborgs universitet och Chalmers, och villaområden med garage runt om stan.",
      en: "Sweden's second-largest city, with thousands of students at the University of Gothenburg and Chalmers, and residential areas full of garages around town.",
    },
  },
  {
    id: "malmo",
    slug: "malmo",
    name: "Malmö",
    photo: "bikes",
    intro: {
      sv: "Sveriges tredje största stad. Vintrarna är milda, men däcken, cyklarna och flyttlådorna behöver plats ändå, och många villor har garage med plats över.",
      en: "Sweden's third-largest city. The winters are mild, but tyres, bikes and moving boxes still need space, and many houses have garages with room to spare.",
    },
  },
  {
    id: "uppsala",
    slug: "uppsala",
    name: "Uppsala",
    photo: "boxes",
    intro: {
      sv: "En av Sveriges största studentstäder. Varje sommar flyttar studenter vid Uppsala universitet ut, och lådorna och cyklarna behöver ett ställe att stå.",
      en: "One of Sweden's biggest student cities. Every summer, students at Uppsala University move out, and their boxes and bikes need somewhere to go.",
    },
  },
  {
    id: "linkoping",
    slug: "linkoping",
    name: "Linköping",
    photo: "garage-clutter",
    intro: {
      sv: "Universitetsstad med Linköpings universitet och gott om villaområden med garage, källare och uppfarter.",
      en: "A university city with Linköping University and plenty of residential areas with garages, basements and driveways.",
    },
  },
  {
    id: "orebro",
    slug: "orebro",
    name: "Örebro",
    photo: "keys",
    intro: {
      sv: "Mitt i Sverige, med Örebro universitet och många villor med garage och uppfarter.",
      en: "In the middle of Sweden, with Örebro University and many houses with garages and driveways.",
    },
  },
  {
    id: "vasteras",
    slug: "vasteras",
    name: "Västerås",
    photo: "car",
    intro: {
      sv: "Mälarstad med Mälardalens universitet och stora villaområden där garage och förråd ofta har plats över.",
      en: "A city on Lake Mälaren with Mälardalen University and large residential areas where garages and storerooms often have room to spare.",
    },
  },
  {
    id: "jonkoping",
    slug: "jonkoping",
    name: "Jönköping",
    photo: "parking",
    intro: {
      sv: "Jönköping University lockar studenter från hela världen, och runt Vättern finns gott om villor med garage.",
      en: "Jönköping University attracts students from all over the world, and around Lake Vättern there are plenty of houses with garages.",
    },
  },
  {
    id: "umea",
    slug: "umea",
    name: "Umeå",
    photo: "tyres",
    intro: {
      sv: "Norrlands största stad och en stor studentstad med Umeå universitet. Vintrarna är långa, så däck, skidor och skotrar behöver plats.",
      en: "Norrland's largest city and a big student city with Umeå University. The winters are long, so tyres, skis and snowmobiles need space.",
    },
  },
  {
    id: "lund",
    slug: "lund",
    name: "Lund",
    photo: "bikes",
    intro: {
      sv: "Studentstaden Lund med Lunds universitet. Varje sommar behöver studenter plats för lådor, möbler och cyklar.",
      en: "The student city of Lund with Lund University. Every summer, students need space for boxes, furniture and bikes.",
    },
  },
  {
    id: "lulea",
    slug: "lulea",
    name: "Luleå",
    photo: "lulea-sunset",
    intro: {
      sv: "Vintrarna är långa i Luleå, så däck, skidor och skotrar behöver plats halva året. Samtidigt studerar tusentals vid Luleå tekniska universitet, och villaområdena runt stan har gott om garage.",
      en: "Winters are long in Luleå, so tyres, skis and snowmobiles need space half the year. Meanwhile thousands study at Luleå University of Technology, and the residential areas around town have plenty of garages.",
    },
  },
];

/**
 * Suggestions for the town field. Visitors can type any town; these are
 * only offered as autocomplete.
 */
export const townSuggestions: string[] = [
  ...cities.map((c) => c.name),
  "Boden",
  "Piteå",
  "Skellefteå",
  "Kiruna",
  "Gällivare",
  "Östersund",
  "Sundsvall",
  "Härnösand",
  "Örnsköldsvik",
  "Gävle",
  "Falun",
  "Borlänge",
  "Karlstad",
  "Eskilstuna",
  "Nyköping",
  "Södertälje",
  "Norrköping",
  "Kalmar",
  "Växjö",
  "Karlskrona",
  "Kristianstad",
  "Helsingborg",
  "Halmstad",
  "Borås",
  "Trollhättan",
  "Uddevalla",
  "Skövde",
  "Visby",
];

export function getCity(slug: string): City | undefined {
  return cities.find((c) => c.slug === slug);
}

/** Simplify a typed town name for comparison ("Luleå", "lulea " → "lulea"). */
export function townKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+kommun$/, "");
}

/**
 * Tidy a typed town before it is stored: known towns get their usual
 * spelling ("lulea" → "Luleå"), others a capital first letter.
 */
const englishNames: Record<string, string> = { gothenburg: "Göteborg" };

export function tidyTown(value: string): string {
  const town = value.trim().replace(/\s+/g, " ");
  const english = englishNames[townKey(town)];
  if (english) return english;
  const known = townSuggestions.find((t) => townKey(t) === townKey(town));
  if (known) return known;
  return town.charAt(0).toLocaleUpperCase("sv-SE") + town.slice(1);
}
