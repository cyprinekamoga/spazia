import type { L10n } from "@/lib/i18n";
import type { PhotoKey } from "./photos";

export type AreaId = "gammelstad" | "bergnaset" | "sunderbyn" | "porson" | "bjorkskatan" | "centrum";

export interface Area {
  id: AreaId;
  slug: string;
  name: string;
  /**
   * "host": mostly houses with garages – we mainly recruit hosts here.
   * "renter": mostly flats and students – we mainly find renters here.
   */
  focus: "host" | "renter";
  /** Hero photo – generic Norrbotten/Luleå scenery, not the area itself. */
  photo: PhotoKey;
  intro: L10n;
  renterPitch: L10n;
  hostPitch: L10n;
}

export const areas: Area[] = [
  {
    id: "gammelstad",
    photo: "house-harads",
    slug: "gammelstad",
    name: "Gammelstad",
    focus: "host",
    intro: {
      sv: "Gammelstad, med kyrkstaden som är ett av Unescos världsarv, har gott om villor och gårdar med garage och uthus.",
      en: "Gammelstad, home to the UNESCO World Heritage church town, has plenty of houses and farms with garages and outbuildings.",
    },
    renterPitch: {
      sv: "Bor du i Gammelstad eller pendlar du förbi? Förvara däck och säsongsprylar nära hemmet.",
      en: "Live in Gammelstad or commute past it? Store tyres and seasonal gear close to home.",
    },
    hostPitch: {
      sv: "Har du ett garage, uthus eller en lada med plats över i Gammelstad? Vi söker värdar i området.",
      en: "Do you have a garage, outbuilding or barn with spare room in Gammelstad? We are looking for hosts in the area.",
    },
  },
  {
    id: "bergnaset",
    photo: "garage-field",
    slug: "bergnaset",
    name: "Bergnäset",
    focus: "host",
    intro: {
      sv: "Bergnäset ligger på andra sidan Luleälven, en kort bit från centrum, med många villor och radhus.",
      en: "Bergnäset sits on the other side of the Lule River, a short trip from the city centre, with many detached and terraced houses.",
    },
    renterPitch: {
      sv: "Behöver du plats på Bergnäset eller i närheten? Här finns garage och källare med plats över.",
      en: "Need space in or near Bergnäset? There are garages and basements with room to spare.",
    },
    hostPitch: {
      sv: "Bor du i villa eller radhus på Bergnäset? Ditt garage eller förråd kan bli en extra inkomst i vinter.",
      en: "Live in a house on Bergnäset? Your garage or storeroom could earn you extra income this winter.",
    },
  },
  {
    id: "sunderbyn",
    photo: "house-harads",
    slug: "sunderbyn",
    name: "Sunderbyn",
    focus: "host",
    intro: {
      sv: "Sunderbyn ligger mellan Luleå och Boden, nära Sunderby sjukhus. Här finns villor, gårdar och gott om garage.",
      en: "Sunderbyn lies between Luleå and Boden, near Sunderby Hospital. It has houses, farms and plenty of garages.",
    },
    renterPitch: {
      sv: "Jobbar du på sjukhuset eller pendlar mellan Luleå och Boden? Förvara prylarna längs vägen.",
      en: "Work at the hospital or commute between Luleå and Boden? Store your things along the way.",
    },
    hostPitch: {
      sv: "Har du gård, garage eller uthus i Sunderbyn? Här finns plats för både däck och fordon.",
      en: "Have a farm, garage or outbuilding in Sunderbyn? There is room for both tyres and vehicles.",
    },
  },
  {
    id: "porson",
    photo: "lulea-sunset",
    slug: "porson",
    name: "Porsön",
    focus: "renter",
    intro: {
      sv: "På Porsön ligger Luleå tekniska universitet och många studentbostäder – där behovet av förvaring är som störst.",
      en: "Porsön is home to Luleå University of Technology and lots of student housing – where storage is needed most.",
    },
    renterPitch: {
      sv: "Student vid LTU? Lämna lådorna, cykeln och skidorna hos en granne i stället för att trängas i korridoren.",
      en: "Studying at LTU? Leave your boxes, bike and skis with a neighbour instead of cramming them into your corridor room.",
    },
    hostPitch: {
      sv: "Bor du i villa nära Porsön? Studenterna behöver plats nära campus, särskilt över sommaren.",
      en: "Live in a house near Porsön? Students need space close to campus, especially over the summer.",
    },
  },
  {
    id: "bjorkskatan",
    photo: "garage-night",
    slug: "bjorkskatan",
    name: "Björkskatan",
    focus: "renter",
    intro: {
      sv: "Björkskatan är ett av Luleås större bostadsområden, med många hyreslägenheter där förrådet sällan räcker till.",
      en: "Björkskatan is one of Luleå's larger residential areas, with many rental flats where the storeroom is rarely big enough.",
    },
    renterPitch: {
      sv: "Är lägenhetsförrådet fullt? Hyr plats för däck, cyklar och skidor hos en granne.",
      en: "Flat storeroom full? Rent space for tyres, bikes and skis with a neighbour.",
    },
    hostPitch: {
      sv: "Har du ett garage eller förråd med plats över i närheten av Björkskatan? Grannarna i lägenheterna behöver plats.",
      en: "Have a garage or storeroom with spare room near Björkskatan? Neighbours in the flats need space.",
    },
  },
  {
    id: "centrum",
    photo: "lulea-sunset",
    slug: "centrum",
    name: "Centrum",
    focus: "renter",
    intro: {
      sv: "I centrum bor många i lägenhet, och kön till extra förråd är ofta lång.",
      en: "Many people in the city centre live in flats, and the queue for an extra storeroom is often long.",
    },
    renterPitch: {
      sv: "Bor du centralt men har ont om plats? Förvara säsongsprylarna en kort bit bort.",
      en: "Live centrally but short on space? Store your seasonal gear a short trip away.",
    },
    hostPitch: {
      sv: "Har du ett garage eller en källare i centrala Luleå? Det finns många som söker plats nära stan.",
      en: "Have a garage or basement in central Luleå? Lots of people are looking for space close to town.",
    },
  },
];

export function getArea(slug: string): Area | undefined {
  return areas.find((a) => a.slug === slug);
}
