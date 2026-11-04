import type { L10n } from "@/lib/i18n";
import type { PhotoKey } from "./photos";
import { hostPayout, roundForDisplay } from "./pricing";

export type CategoryId = "tyres" | "skis" | "snowmobile" | "bikes" | "boxes" | "car" | "parking";

export interface Category {
  id: CategoryId;
  slug: L10n;
  name: L10n;
  /** One-line description used on cards. */
  short: L10n;
  /** Unit the price refers to, singular and plural. */
  unit: L10n;
  unitPlural: L10n;
  photo: PhotoKey;
  /** Renter price per unit and month (SEK, service fee included), unheated. */
  price: number;
  /** Whether heated space commands a higher price for this category. */
  heatedMatters: boolean;
  /** Upper bound in the host calculator. */
  maxUnits: number;
  season: L10n;
  intro: L10n;
  points: L10n<string[]>;
  metaTitle: L10n;
  /** May contain {price}. */
  metaDescription: L10n;
}

export const categories: Category[] = [
  {
    id: "tyres",
    photo: "tyres",
    slug: { sv: "dackforvaring", en: "tyre-storage" },
    name: { sv: "Däck", en: "Tyres" },
    short: {
      sv: "Sommar- eller vinterdäck, med eller utan fälg.",
      en: "Summer or winter tyres, with or without rims.",
    },
    unit: { sv: "däcksats", en: "set of tyres" },
    unitPlural: { sv: "däcksatser", en: "sets of tyres" },
    price: 120,
    heatedMatters: false,
    maxUnits: 20,
    season: { sv: "Okt–nov och apr–maj", en: "Oct–Nov and Apr–May" },
    intro: {
      sv: "Två uppsättningar däck tar mycket plats i en lägenhet, och däckhotellen hos verkstäderna kostar ofta mer än man tror. Med Spazia förvarar du däcken torrt och låst hos en villaägare i närheten och hämtar dem när det är dags att byta.",
      en: "Two sets of tyres take up a lot of room in a flat, and workshop tyre hotels often cost more than you would expect. With Spazia your tyres are stored dry and locked with a homeowner nearby, and you collect them when it is time to switch.",
    },
    points: {
      sv: [
        "Torrt och låst – däck mår bäst svalt och mörkt",
        "Förvara hela säsongen och säg upp när däcken åker på",
        "Hämta och lämna på tider ni bokar i förväg",
      ],
      en: [
        "Dry and locked – tyres keep best somewhere cool and dark",
        "Store them all season and cancel when they go back on",
        "Drop off and collect at times you book in advance",
      ],
    },
    metaTitle: {
      sv: "Däckförvaring – förvara däcken hos en granne",
      en: "Tyre storage – store your tyres with a neighbour",
    },
    metaDescription: {
      sv: "Förvara sommar- eller vinterdäck torrt och låst hos en verifierad villaägare nära dig. Från ca {price} kr/mån, utan bindningstid.",
      en: "Store summer or winter tyres dry and locked with a verified homeowner near you. From about SEK {price}/month, cancel any month.",
    },
  },
  {
    id: "skis",
    photo: "skis",
    slug: { sv: "skidforvaring", en: "ski-storage" },
    name: { sv: "Skidor & snowboard", en: "Skis & snowboards" },
    short: {
      sv: "Utförs- och längdskidor, brädor, pjäxor och hjälmar.",
      en: "Alpine and cross-country skis, boards, boots and helmets.",
    },
    unit: { sv: "skidpaket", en: "ski set" },
    unitPlural: { sv: "skidpaket", en: "ski sets" },
    price: 70,
    heatedMatters: false,
    maxUnits: 12,
    season: { sv: "Apr–nov", en: "Apr–Nov" },
    intro: {
      sv: "Skidutrustningen används bara halva året. Resten av tiden kan den stå torrt hos en granne i stället för att ta plats i hallen eller på balkongen.",
      en: "Ski gear only gets used half the year. The rest of the time it can sit dry at a neighbour's instead of filling up your hallway or balcony.",
    },
    points: {
      sv: [
        "Plats för skidor eller bräda, pjäxor, stavar och hjälm",
        "Torr förvaring skyddar stålkanter och bindningar",
        "Perfekt för den som bor trångt eller i studentkorridor",
      ],
      en: [
        "Room for skis or a board, boots, poles and a helmet",
        "Dry storage protects edges and bindings",
        "Ideal if you live in a small flat or student corridor",
      ],
    },
    metaTitle: {
      sv: "Skidförvaring – förvara skidor och snowboard hos en granne",
      en: "Ski storage – store skis and snowboards with a neighbour",
    },
    metaDescription: {
      sv: "Förvara skidor, snowboard och pjäxor torrt hos en verifierad granne. Från ca {price} kr/mån, utan bindningstid.",
      en: "Store skis, snowboards and boots dry with a verified neighbour. From about SEK {price}/month, cancel any month.",
    },
  },
  {
    id: "snowmobile",
    photo: "snowmobile",
    slug: { sv: "skoterforvaring", en: "snowmobile-storage" },
    name: { sv: "Skoter & släp", en: "Snowmobiles & trailers" },
    short: {
      sv: "Fordonsplats i garage, lada eller uthus.",
      en: "Vehicle space in a garage, barn or outbuilding.",
    },
    unit: { sv: "fordonsplats", en: "vehicle space" },
    unitPlural: { sv: "fordonsplatser", en: "vehicle spaces" },
    price: 450,
    heatedMatters: true,
    maxUnits: 4,
    season: { sv: "Hela året", en: "All year" },
    intro: {
      sv: "En skoter, ett släp eller en fyrhjuling behöver en plats som är både stor och låst. Många villaägare och gårdar har just det: ett garage, en lada eller ett uthus där ett fordon får plats.",
      en: "A snowmobile, trailer or quad bike needs a space that is both large and lockable. Many homeowners and farms have exactly that: a garage, barn or outbuilding with room for a vehicle.",
    },
    points: {
      sv: [
        "Inomhusplats – uppvärmd eller kall",
        "Sommarförvaring för skotern, vinterförvaring för släpet",
        "Värden bestämmer om fordon får stå där och på vilka villkor",
      ],
      en: [
        "Indoor space – heated or unheated",
        "Summer storage for the snowmobile, winter storage for the trailer",
        "The host decides whether vehicles are allowed and on what terms",
      ],
    },
    metaTitle: {
      sv: "Skoterförvaring – inomhusplats för skoter och släp",
      en: "Snowmobile storage – indoor space for snowmobiles and trailers",
    },
    metaDescription: {
      sv: "Hyr en låst inomhusplats för skoter, släp eller fyrhjuling hos en verifierad värd. Från ca {price} kr/mån.",
      en: "Rent a locked indoor space for a snowmobile, trailer or quad with a verified host. From about SEK {price}/month.",
    },
  },
  {
    id: "bikes",
    photo: "bikes",
    slug: { sv: "cykelforvaring", en: "bike-storage" },
    name: { sv: "Cyklar", en: "Bikes" },
    short: {
      sv: "Vintervila för cyklar som inte ska ut i snön.",
      en: "A winter home for bikes that should stay out of the snow.",
    },
    unit: { sv: "cykel", en: "bike" },
    unitPlural: { sv: "cyklar", en: "bikes" },
    price: 90,
    heatedMatters: false,
    maxUnits: 10,
    season: { sv: "Okt–apr", en: "Oct–Apr" },
    intro: {
      sv: "Salt och snö är tufft för en cykel som står ute hela vintern. Ställ in den torrt hos en granne från oktober till april och få tillbaka den i samma skick till våren.",
      en: "Salt and snow are hard on a bike left outside all winter. Keep it dry at a neighbour's from October to April and get it back in the same condition in spring.",
    },
    points: {
      sv: [
        "Skyddad mot salt, snö och stöld",
        "Plats för vanliga cyklar, elcyklar och barncyklar",
        "Hämta den när snön har smält",
      ],
      en: [
        "Protected from salt, snow and theft",
        "Room for regular bikes, e-bikes and children's bikes",
        "Collect it when the snow has melted",
      ],
    },
    metaTitle: {
      sv: "Cykelförvaring – vinterförvara cykeln hos en granne",
      en: "Bike storage – keep your bike with a neighbour over winter",
    },
    metaDescription: {
      sv: "Vinterförvara cykeln torrt och låst hos en verifierad granne. Från ca {price} kr/mån, utan bindningstid.",
      en: "Store your bike dry and locked over winter with a verified neighbour. From about SEK {price}/month, cancel any month.",
    },
  },
  {
    id: "boxes",
    photo: "boxes",
    slug: { sv: "magasinering", en: "boxes-and-furniture" },
    name: { sv: "Flyttlådor & möbler", en: "Boxes & furniture" },
    short: {
      sv: "Sommarförvaring för studenter och plats mellan två flyttar.",
      en: "Summer storage for students and space between moves.",
    },
    unit: { sv: "m²", en: "m²" },
    unitPlural: { sv: "m²", en: "m²" },
    price: 150,
    heatedMatters: true,
    maxUnits: 30,
    season: { sv: "Jun–aug och vid flytt", en: "Jun–Aug and when moving" },
    intro: {
      sv: "Ska du hem över sommaren, på utbyte eller mellan två lägenheter? Låt lådorna och möblerna stå kvar där du bor. Du betalar per kvadratmeter, bara för den plats du faktiskt använder.",
      en: "Going home for the summer, on exchange, or between flats? Leave your boxes and furniture where you live. You pay per square metre, only for the space you actually use.",
    },
    points: {
      sv: [
        "Betala per kvadratmeter golvyta",
        "Uppvärmd plats för sådant som inte tål kyla",
        "Billigare än att hyra ett helt förråd",
      ],
      en: [
        "Pay per square metre of floor space",
        "Heated space for things that don't like the cold",
        "Cheaper than renting a whole storage unit",
      ],
    },
    metaTitle: {
      sv: "Magasinering – förvara flyttlådor och möbler hos en granne",
      en: "Boxes and furniture – storage with a neighbour",
    },
    metaDescription: {
      sv: "Förvara flyttlådor och möbler hos en verifierad granne. Perfekt för studenter över sommaren. Från ca {price} kr/m² och månad.",
      en: "Store boxes and furniture with a verified neighbour. Ideal for students over the summer. From about SEK {price} per m² per month.",
    },
  },
  {
    id: "car",
    photo: "car",
    slug: { sv: "bilforvaring-inomhus", en: "indoor-car-storage" },
    name: { sv: "Bil inomhus", en: "Indoor car space" },
    short: {
      sv: "Garageplats för sommarbil, vinterbil eller motorcykel.",
      en: "Garage space for a summer car, winter car or motorbike.",
    },
    unit: { sv: "bilplats", en: "car space" },
    unitPlural: { sv: "bilplatser", en: "car spaces" },
    price: 800,
    heatedMatters: true,
    maxUnits: 3,
    season: { sv: "Hela året", en: "All year" },
    intro: {
      sv: "Sommarbilen behöver ett vinterhem, och ibland behövs en varm garageplats när det är som kallast. Hyr en plats i ett garage i stället för att låta bilen stå ute i snön.",
      en: "A summer car needs somewhere to spend the winter, and sometimes you just need a warm garage when it is at its coldest. Rent a garage space instead of leaving the car out in the snow.",
    },
    points: {
      sv: [
        "Uppvärmd eller kall garageplats",
        "Bra för sommarbilar, motorcyklar och veteranfordon",
        "Avtalet reglerar tillträde och försäkring av fordonet",
      ],
      en: [
        "Heated or unheated garage space",
        "Good for summer cars, motorbikes and classic vehicles",
        "The agreement covers access and vehicle insurance",
      ],
    },
    metaTitle: {
      sv: "Bilförvaring inomhus – hyr en garageplats hos en granne",
      en: "Indoor car storage – rent a garage space from a neighbour",
    },
    metaDescription: {
      sv: "Hyr en garageplats för sommarbil, motorcykel eller vardagsbil hos en verifierad villaägare. Från ca {price} kr/mån.",
      en: "Rent a garage space for a summer car, motorbike or everyday car with a verified homeowner. From about SEK {price}/month.",
    },
  },
  {
    id: "parking",
    photo: "parking",
    slug: { sv: "parkering", en: "parking" },
    name: { sv: "Parkering", en: "Parking" },
    short: {
      sv: "En p-plats på uppfarten, gårdsplanen eller under carporten.",
      en: "A parking space on a driveway, in a yard or under a carport.",
    },
    unit: { sv: "p-plats", en: "parking space" },
    unitPlural: { sv: "p-platser", en: "parking spaces" },
    price: 350,
    heatedMatters: false,
    maxUnits: 4,
    season: { sv: "Hela året", en: "All year" },
    intro: {
      sv: "I många hyreshus går p-platserna först till de boende i området, och nära jobbet eller campus kan det vara ont om platser. Många villaägare har plats för en bil till på uppfarten eller gårdsplanen. Hyr den månadsvis, med eller utan motorvärmaruttag.",
      en: "In many apartment buildings, parking spaces go to residents of the area first, and spaces near work or campus can be hard to find. Many homeowners have room for one more car on their driveway or yard. Rent it by the month, with or without an engine heater socket.",
    },
    points: {
      sv: [
        "Månadsvis och utan bindningstid",
        "Fråga efter motorvärmaruttag inför de kallaste månaderna",
        "Plats för husvagn, husbil eller släp om värden har utrymme",
      ],
      en: [
        "Monthly, with no long-term commitment",
        "Ask for an engine heater socket before the coldest months",
        "Room for a caravan, motorhome or trailer if the host has space",
      ],
    },
    metaTitle: {
      sv: "Parkering – hyr en p-plats hos en granne",
      en: "Parking – rent a space from a neighbour",
    },
    metaDescription: {
      sv: "Hyr en p-plats på en uppfart eller gårdsplan hos en verifierad villaägare. Från ca {price} kr/mån, med eller utan motorvärmaruttag.",
      en: "Rent a parking space on a driveway or yard from a verified homeowner. From about SEK {price}/month, with or without an engine heater socket.",
    },
  },
];

export function getCategoryBySlug(slug: string, lang: "sv" | "en"): Category | undefined {
  return categories.find((c) => c.slug[lang] === slug);
}

export function getCategory(id: CategoryId): Category {
  const found = categories.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category ${id}`);
  return found;
}

/** What a host gets per month for half a double garage (10 tyre sets, 4 ski sets, 1 snowmobile). */
export function exampleGarageIncome(): number {
  const units: Partial<Record<CategoryId, number>> = { tyres: 10, skis: 4, snowmobile: 1 };
  const total = categories.reduce((sum, c) => sum + hostPayout(c.price) * (units[c.id] ?? 0), 0);
  return roundForDisplay(total);
}
