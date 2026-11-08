import type { L10n } from "@/lib/i18n";
import type { CategoryId } from "./categories";
import type { PhotoKey } from "./photos";

/** A university with its own page under /student (sv) and /en/students (en). */
export interface University {
  slug: string;
  name: L10n;
  /** Short name used in text, e.g. "LTU". */
  short: string;
  /** City page slug (src/content/cities.ts) and the town to search in the app. */
  citySlug: string;
  town: string;
  campuses: string[];
  photo: PhotoKey;
  intro: L10n;
  tips: { sv: string[]; en: string[] };
}

/** What students store most, in the order shown on the student pages. */
export const studentCategories: CategoryId[] = ["boxes", "bikes", "skis", "tyres"];

export const universities: University[] = [
  {
    slug: "ltu",
    name: { sv: "Luleå tekniska universitet", en: "Luleå University of Technology" },
    short: "LTU",
    citySlug: "lulea",
    town: "Luleå",
    campuses: ["Campus Luleå (Porsön)", "Campus Skellefteå", "Campus Kiruna", "Campus Piteå"],
    photo: "lulea-sunset",
    intro: {
      sv: "LTU lockar studenter från hela Sverige och från andra länder till Luleå. Många flyttar söderut över sommaren eller åker på utbyte, och då är det skönt att slippa släpa med sig vinterkläder, skidor och flyttlådor.",
      en: "LTU draws students to Luleå from all over Sweden and abroad. Many head south for the summer or leave for an exchange, and it helps not to drag winter clothes, skis and boxes along.",
    },
    tips: {
      sv: [
        "Vinterutrustning tar plats. Förvara skidor, pjäxor och vinterdäck hos en granne i stället för i korridoren.",
        "Flyttar du hem över sommaren? Boka plats i god tid före terminsslutet i juni, då vill många förvara samtidigt.",
      ],
      en: [
        "Winter gear takes up space. Keep skis, boots and winter tyres with a neighbour instead of in your corridor.",
        "Going home for the summer? Book space well before the end of term in June, when many people need storage at once.",
      ],
    },
  },
  {
    slug: "umu",
    name: { sv: "Umeå universitet", en: "Umeå University" },
    short: "UmU",
    citySlug: "umea",
    town: "Umeå",
    campuses: ["Campus Umeå", "Umeå konstnärliga campus"],
    photo: "bikes",
    intro: {
      sv: "Umeå är en av Sveriges stora studentstäder, och många av studenterna kommer från andra delar av landet. När vårterminen tar slut flyttar många hem eller sommarjobbar på annan ort, men vill ha kvar sina saker i Umeå till hösten.",
      en: "Umeå is one of Sweden's big student cities, and many students come from other parts of the country. When the spring term ends, many go home or work elsewhere for the summer, but want to keep their things in Umeå until autumn.",
    },
    tips: {
      sv: [
        "Cykeln mår bättre i ett torrt förråd än i ett cykelställ under snön. Förvara den hos en granne över vintern.",
        "Ska du bara vara borta över sommaren? Hyr en månad i taget, så betalar du inte för mer än du behöver.",
      ],
      en: [
        "Your bike is better off in a dry storeroom than in a bike rack under the snow. Store it with a neighbour over the winter.",
        "Only away for the summer? Rent a month at a time, so you don't pay for more than you need.",
      ],
    },
  },
  {
    slug: "uu",
    name: { sv: "Uppsala universitet", en: "Uppsala University" },
    short: "UU",
    citySlug: "uppsala",
    town: "Uppsala",
    campuses: ["Engelska parken", "Ekonomikum", "Blåsenhus", "Ångströmlaboratoriet", "BMC", "Campus Gotland"],
    photo: "boxes",
    intro: {
      sv: "I Uppsala byter många studenter boende mellan terminerna, och korridorsrummen har sällan plats för mer än det nödvändigaste. Förvara det du inte behöver just nu hos en granne, i stället för att betala för ett helt förråd.",
      en: "In Uppsala many students move between terms, and corridor rooms rarely have space for more than the essentials. Store what you don't need right now with a neighbour, instead of paying for a whole storage unit.",
    },
    tips: {
      sv: [
        "Mellan två kontrakt? Förvara flyttlådorna några veckor eller månader, tills nästa rum är klart.",
        "Pluggar du på Campus Gotland? Sök på Visby, så ser du platser där.",
      ],
      en: [
        "Between two leases? Store your boxes for a few weeks or months until your next room is ready.",
        "Studying at Campus Gotland? Search for Visby to see spaces there.",
      ],
    },
  },
  {
    slug: "lu",
    name: { sv: "Lunds universitet", en: "Lund University" },
    short: "LU",
    citySlug: "lund",
    town: "Lund",
    campuses: ["LTH", "Centrala Lund och Universitetsplatsen", "Helgonabacken", "Campus Helsingborg"],
    photo: "bikes",
    intro: {
      sv: "Lund är en av Sveriges största studentstäder, med många internationella studenter och utbytesstudenter som stannar en eller två terminer. Den som åker iväg en termin vill sällan betala för ett rum som står tomt.",
      en: "Lund is one of Sweden's largest student cities, with many international and exchange students who stay for one or two terms. If you leave for a term, you rarely want to pay for a room that stands empty.",
    },
    tips: {
      sv: [
        "Åker du på utbyte? Förvara cykeln och flyttlådorna hos en granne och säg upp rummet under tiden.",
        "Läser du på Campus Helsingborg? Sök på Helsingborg, så ser du platser där.",
      ],
      en: [
        "Leaving for an exchange? Store your bike and boxes with a neighbour and give up your room while you're away.",
        "Studying at Campus Helsingborg? Search for Helsingborg to see spaces there.",
      ],
    },
  },
  {
    slug: "kth",
    name: { sv: "KTH Kungliga Tekniska högskolan", en: "KTH Royal Institute of Technology" },
    short: "KTH",
    citySlug: "stockholm",
    town: "Stockholm",
    campuses: ["Campus Valhallavägen", "Campus Flemingsberg", "Campus Kista", "Campus Södertälje"],
    photo: "moving",
    intro: {
      sv: "I Stockholm är studentrummen små och förråden få, och förvaringsföretagen tar bra betalt. Hos en granne betalar du bara för det du faktiskt förvarar, till exempel några flyttlådor och en cykel.",
      en: "In Stockholm student rooms are small, storage units are scarce and storage companies charge a lot. With a neighbour you only pay for what you actually store, for example a few boxes and a bike.",
    },
    tips: {
      sv: [
        "Bor du i andra hand? Då ingår sällan något förråd. Förvara det du inte får plats med hos en granne.",
        "Pluggar du i Södertälje eller Flemingsberg? Sök på den orten, så slipper du åka genom hela stan.",
      ],
      en: [
        "Subletting? A storage unit is rarely included. Store what doesn't fit with a neighbour.",
        "Studying in Södertälje or Flemingsberg? Search for that town so you don't have to cross the whole city.",
      ],
    },
  },
  {
    slug: "su",
    name: { sv: "Stockholms universitet", en: "Stockholm University" },
    short: "SU",
    citySlug: "stockholm",
    town: "Stockholm",
    campuses: ["Frescati", "Albano", "Kräftriket"],
    photo: "boxes",
    intro: {
      sv: "Många studenter vid Stockholms universitet bor i korridor eller i andra hand, ofta utan eget förråd, och flyttar flera gånger under studietiden. Förvara sakerna mellan flyttarna hos en granne.",
      en: "Many students at Stockholm University live in corridors or sublets, often without a storage unit of their own, and move several times while studying. Store your things between moves with a neighbour.",
    },
    tips: {
      sv: [
        "Flyttar du mellan andrahandskontrakt? Hyr plats några månader i stället för att binda dig till ett helt förråd.",
        "Sök på Stockholm, och titta på platser längs tunnelbanan nära Universitetet.",
      ],
      en: [
        "Moving between sublets? Rent space for a few months instead of committing to a whole storage unit.",
        "Search for Stockholm and look at spaces along the metro near Universitetet station.",
      ],
    },
  },
  {
    slug: "chalmers",
    name: { sv: "Chalmers tekniska högskola", en: "Chalmers University of Technology" },
    short: "Chalmers",
    citySlug: "goteborg",
    town: "Göteborg",
    campuses: ["Campus Johanneberg", "Campus Lindholmen"],
    photo: "garage-field",
    intro: {
      sv: "Chalmers har studenter från hela landet, och när vårterminen slutar i juni är det många som tömmer sina rum för sommarjobb eller praktik på annan ort. Saker som ska tillbaka till Göteborg i augusti kan stå hos en granne under tiden.",
      en: "Chalmers has students from all over the country, and when the spring term ends in June, many empty their rooms for summer jobs or internships elsewhere. Things that are coming back to Göteborg in August can stay with a neighbour meanwhile.",
    },
    tips: {
      sv: [
        "Sommarjobb på annan ort? Förvara flyttlådorna i Göteborg tills du kommer tillbaka.",
        "Pluggar du på Lindholmen? Leta efter platser på Hisingen, så har du nära till dem.",
      ],
      en: [
        "Summer job somewhere else? Keep your boxes in Göteborg until you're back.",
        "Studying at Lindholmen? Look for spaces on Hisingen so they're close by.",
      ],
    },
  },
  {
    slug: "gu",
    name: { sv: "Göteborgs universitet", en: "University of Gothenburg" },
    short: "GU",
    citySlug: "goteborg",
    town: "Göteborg",
    campuses: ["Humanisten (Näckrosen)", "Handelshögskolan", "Medicinareberget"],
    photo: "moving",
    intro: {
      sv: "Göteborgs universitet är ett av Sveriges största lärosäten, och många studenter bor i studentbostäder eller i andra hand där förrådet är litet eller saknas. Förvara det du inte får plats med hos en granne.",
      en: "The University of Gothenburg is one of Sweden's largest universities, and many students live in student housing or sublets where the storage unit is small or missing. Store what doesn't fit with a neighbour.",
    },
    tips: {
      sv: [
        "Åker du på utbyte en termin? Förvara sakerna och lämna rummet, så slipper du betala hyra för det.",
        "Har du cykel? Förvara den inomhus över vintern, så håller den längre.",
      ],
      en: [
        "Leaving for an exchange term? Store your things and give up your room, so you don't pay rent for it.",
        "Got a bike? Keep it indoors over the winter and it lasts longer.",
      ],
    },
  },
  {
    slug: "liu",
    name: { sv: "Linköpings universitet", en: "Linköping University" },
    short: "LiU",
    citySlug: "linkoping",
    town: "Linköping",
    campuses: ["Campus Valla", "Campus US", "Campus Norrköping"],
    photo: "garage-clutter",
    intro: {
      sv: "LiU har studenter i både Linköping och Norrköping, och många flyttar mellan städerna eller hem över sommaren. Förvara det du inte behöver just nu hos en granne nära campus.",
      en: "LiU has students in both Linköping and Norrköping, and many move between the cities or go home for the summer. Store what you don't need right now with a neighbour near campus.",
    },
    tips: {
      sv: [
        "Pluggar du på Campus Norrköping? Sök på Norrköping, så ser du platser där.",
        "Över sommaren tömmer många sina rum i Ryd och runt Valla. Boka plats i god tid före juni.",
      ],
      en: [
        "Studying at Campus Norrköping? Search for Norrköping to see spaces there.",
        "Over the summer, many empty their rooms in Ryd and around Valla. Book space well before June.",
      ],
    },
  },
];

export function getUniversity(slug: string): University | undefined {
  return universities.find((u) => u.slug === slug);
}
