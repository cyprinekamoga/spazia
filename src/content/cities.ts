import type { L10n } from "@/lib/i18n";
import type { PhotoKey } from "./photos";

/**
 * Spazia opens city by city. Luleå is first (spaces are visited and
 * published there); every other city has a waitlist until enough people
 * have registered. Add a city here and its page, footer link and sitemap
 * entry appear automatically.
 */
export interface City {
  id: string;
  slug: string;
  name: string;
  /** "first": open/launching now. "waitlist": registrations only. */
  status: "first" | "waitlist";
  photo: PhotoKey;
  intro: L10n;
}

export const cities: City[] = [
  {
    id: "lulea",
    slug: "lulea",
    name: "Luleå",
    status: "first",
    photo: "lulea-sunset",
    intro: {
      sv: "Luleå är först ut. Här besöker vi varje utrymme innan det publiceras, och vi startar under vintern 2026/27 i bland annat Gammelstad, Bergnäset och Sunderbyn.",
      en: "Luleå comes first. Here we visit every space before it is listed, and we launch during winter 2026/27 in areas such as Gammelstad, Bergnäset and Sunderbyn.",
    },
  },
  {
    id: "stockholm",
    slug: "stockholm",
    name: "Stockholm",
    status: "waitlist",
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
    status: "waitlist",
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
    status: "waitlist",
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
    status: "waitlist",
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
    status: "waitlist",
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
    status: "waitlist",
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
    status: "waitlist",
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
    status: "waitlist",
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
    status: "waitlist",
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
    status: "waitlist",
    photo: "bikes",
    intro: {
      sv: "Studentstaden Lund med Lunds universitet. Varje sommar behöver studenter plats för lådor, möbler och cyklar.",
      en: "The student city of Lund with Lund University. Every summer, students need space for boxes, furniture and bikes.",
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

export function isLulea(value: string | undefined | null): boolean {
  return townKey(value ?? "") === "lulea";
}
