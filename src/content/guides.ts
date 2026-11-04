import { formatNumber, type L10n, type Lang } from "@/lib/i18n";
import { categories, exampleGarageIncome, getCategory, type CategoryId } from "./categories";
import { marketPrices } from "./market-prices";
import type { PhotoKey } from "./photos";

/**
 * Guides (/guider, /en/guides). Each guide is a list of blocks per language.
 *
 * Links inside text use [label](target). Targets: a full URL, page:<key>
 * (e.g. page:host#kalkylator), guide:<id> or category:<id>. They are turned
 * into the right path for the language when the page is rendered.
 */
export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "note"; text: string };

export type GuideId = "tyre-cost" | "rent-out-garage" | "tax" | "student-summer";

export interface Guide {
  id: GuideId;
  slug: L10n;
  photo: PhotoKey;
  audience: "renter" | "host";
  /** Shown on this category's page as further reading. */
  categories: CategoryId[];
  published: string;
  updated: string;
  title: L10n;
  description: L10n;
  body: L10n<GuideBlock[]>;
  sources: { name: string; url: string }[];
}

const kr = (n: number, lang: Lang) => formatNumber(n, lang);
const price = (id: CategoryId) => getCategory(id).price;
const tyreSeason = price("tyres") * 6;
const { tyreHotel, selfStorage } = marketPrices;

export const guides: Guide[] = [
  {
    id: "tyre-cost",
    slug: { sv: "vad-kostar-dackforvaring", en: "tyre-storage-cost" },
    photo: "tyres",
    audience: "renter",
    categories: ["tyres"],
    published: "2026-11-04",
    updated: "2026-11-04",
    title: {
      sv: "Vad kostar däckförvaring? Däckhotell, hemma eller hos en granne",
      en: "What does tyre storage cost? Tyre hotel, at home or with a neighbour",
    },
    description: {
      sv: "Vad det kostar att förvara däcken på däckhotell, hemma eller hos en granne, och hur du förvarar dem rätt.",
      en: "What it costs to store your tyres at a tyre hotel, at home or with a neighbour, and how to store them properly.",
    },
    body: {
      sv: [
        {
          type: "p",
          text: "De flesta bilägare i Sverige byter däck två gånger om året. Varje gång ska fyra hjul få plats någonstans i ett halvår. Du har tre alternativ: däckhotell hos en verkstad, förvaring hemma eller hos någon annan.",
        },
        { type: "h2", text: "När byter man däck?" },
        {
          type: "p",
          text: "Det är krav på vinterdäck för personbilar från 1 december till 31 mars när det är vinterväglag. Dubbdäck får du använda från 1 oktober till 15 april, och även före och efter det om det är eller väntas bli vinterväglag. I norra Sverige byter många redan i oktober, och sommardäcken kommer ofta inte på förrän i maj.",
        },
        { type: "h2", text: "Däckhotell: bekvämt men dyrast" },
        {
          type: "p",
          text: `På ett däckhotell byter verkstaden hjulen, tvättar dem och förvarar dem till nästa säsong. Varje verkstad sätter sitt eget pris. Vianor tar från ${kr(tyreHotel.min, "sv")} kr per säsong, och hos Däckias verkstäder i Göteborg och Stockholm kostar det 1 495–1 695 kr per säsong, i båda fallen med hjulskifte. Har du stora fälgar kostar det ofta mer.`,
        },
        {
          type: "p",
          text: `Med två säsonger om året blir det ungefär ${kr(tyreHotel.min * 2, "sv")}–${kr(tyreHotel.max * 2, "sv")} kr per år och bil.`,
        },
        { type: "h2", text: "Hemma: gratis, om du har plats" },
        {
          type: "p",
          text: "Har du ett garage, ett förråd eller en torr källare är det billigast att förvara däcken själv. Staplade tar fyra hjul mindre än en kvadratmeter golvyta, men de är tunga att bära.",
        },
        {
          type: "p",
          text: "Bor du i lägenhet är det svårare. Källarförrådet är ofta för litet, och i trapphuset får däcken inte stå av brandskäl.",
        },
        { type: "h2", text: "Hos en granne: billigare än däckhotell" },
        {
          type: "p",
          text: `Med Spazia förvarar du däcken i en villaägares garage eller förråd nära dig. Riktpriset i Luleå är omkring ${price("tyres")} kr i månaden per däcksats, alltså cirka ${kr(tyreSeason, "sv")} kr för en säsong på sex månader. Hjulskifte ingår inte, så du byter själv eller låter en verkstad göra det. Räkna på ditt eget behov i [priskalkylatorn](page:find#pris).`,
        },
        {
          type: "table",
          head: ["", "Per säsong", "Hjulskifte"],
          rows: [
            ["Däckhotell", `ca ${kr(tyreHotel.min, "sv")}–${kr(tyreHotel.max, "sv")} kr`, "Ingår"],
            ["Hos en granne via Spazia", `ca ${kr(tyreSeason, "sv")} kr`, "Ingår inte"],
            ["Hemma", "0 kr", "Gör det själv"],
          ],
        },
        { type: "h2", text: "Så förvarar du däcken rätt" },
        {
          type: "ul",
          items: [
            "Tvätta däcken och låt dem torka innan du ställer undan dem.",
            "Märk varje hjul med var det satt, till exempel VF för vänster fram, så att du kan rotera dem nästa gång.",
            "Förvara dem mörkt, svalt och torrt, och inte nära elmotorer eller annat som avger ozon.",
            "Hjul med fälg kan ligga staplade eller hänga på krokar. Däck utan fälg ska stå upp och vridas då och då.",
            "Mät mönsterdjupet innan du lägger undan dem, så att du hinner köpa nya i tid.",
          ],
        },
      ],
      en: [
        {
          type: "p",
          text: "Most drivers in Sweden change tyres twice a year. Each time, four wheels need somewhere to stay for half a year. You have three options: a tyre hotel at a workshop, storing them at home, or with someone else.",
        },
        { type: "h2", text: "When do you change tyres?" },
        {
          type: "p",
          text: "Winter tyres are required on cars from 1 December to 31 March when there are winter road conditions. Studded tyres are allowed from 1 October to 15 April, and before and after that if there are or are expected to be winter conditions. In northern Sweden many people change as early as October, and summer tyres often don't go back on until May.",
        },
        { type: "h2", text: "Tyre hotel: convenient but the most expensive" },
        {
          type: "p",
          text: `At a tyre hotel the workshop changes the wheels, washes them and stores them until next season. Each workshop sets its own price. Vianor charges from SEK ${kr(tyreHotel.min, "en")} per season, and Däckia workshops in Gothenburg and Stockholm charge SEK 1,495–1,695 per season, both including a wheel change. Large rims often cost more.`,
        },
        {
          type: "p",
          text: `With two seasons a year, that comes to roughly SEK ${kr(tyreHotel.min * 2, "en")}–${kr(tyreHotel.max * 2, "en")} per year and car.`,
        },
        { type: "h2", text: "At home: free, if you have room" },
        {
          type: "p",
          text: "If you have a garage, a storeroom or a dry basement, storing the tyres yourself is cheapest. Stacked, four wheels take up less than a square metre of floor, but they are heavy to carry.",
        },
        {
          type: "p",
          text: "In a flat it's harder. The basement storeroom is often too small, and tyres aren't allowed in the stairwell for fire safety reasons.",
        },
        { type: "h2", text: "With a neighbour: cheaper than a tyre hotel" },
        {
          type: "p",
          text: `With Spazia you store your tyres in a homeowner's garage or storeroom near you. The guide price in Luleå is about SEK ${price("tyres")} a month per set, so around SEK ${kr(tyreSeason, "en")} for a six-month season. A wheel change isn't included: you change them yourself or have a workshop do it. Work out your own cost in the [price calculator](page:find#pris).`,
        },
        {
          type: "table",
          head: ["", "Per season", "Wheel change"],
          rows: [
            ["Tyre hotel", `about SEK ${kr(tyreHotel.min, "en")}–${kr(tyreHotel.max, "en")}`, "Included"],
            ["With a neighbour through Spazia", `about SEK ${kr(tyreSeason, "en")}`, "Not included"],
            ["At home", "SEK 0", "Do it yourself"],
          ],
        },
        { type: "h2", text: "How to store tyres properly" },
        {
          type: "ul",
          items: [
            "Wash the tyres and let them dry before you put them away.",
            "Mark each wheel with where it was fitted, for example FL for front left, so you can rotate them next time.",
            "Keep them dark, cool and dry, and away from electric motors or anything else that gives off ozone.",
            "Wheels on rims can be stacked or hung on hooks. Tyres without rims should stand upright and be turned now and then.",
            "Check the tread depth before you put them away, so you have time to buy new ones.",
          ],
        },
      ],
    },
    sources: [
      { name: "Transportstyrelsen: Vinterdäck", url: "https://www.transportstyrelsen.se/vinterdack" },
      ...tyreHotel.sources.map((s) => ({ name: s.name, url: s.url })),
    ],
  },

  {
    id: "rent-out-garage",
    slug: { sv: "hyra-ut-garage", en: "rent-out-your-garage" },
    photo: "garage-clutter",
    audience: "host",
    categories: ["tyres", "skis", "snowmobile", "car", "parking"],
    published: "2026-11-04",
    updated: "2026-11-04",
    title: {
      sv: "Hyra ut garaget: så mycket kan du tjäna och så går det till",
      en: "Renting out your garage: what you can earn and how it works",
    },
    description: {
      sv: "Vad du kan tjäna på att hyra ut plats i garaget, källaren eller på uppfarten, vad som fungerar bäst och vad du ska tänka på.",
      en: "What you can earn by renting out space in your garage, basement or driveway, what works best and what to think about.",
    },
    body: {
      sv: [
        {
          type: "p",
          text: "Många garage står halvtomma. Bilen står ute, och längs väggarna finns plats för däck, skidor eller en skoter. Den platsen kan ge en extra inkomst, utan att du behöver hyra ut hela garaget.",
        },
        { type: "h2", text: "Vad kan du tjäna?" },
        {
          type: "p",
          text: "Det beror på vad du har plats för. Så här ser våra riktpriser i Luleå ut, alltså vad hyresgästen betalar per månad inklusive serviceavgift:",
        },
        {
          type: "table",
          head: ["Förvaring", "Per månad"],
          rows: categories.map((c) => [c.name.sv, `ca ${kr(c.price, "sv")} kr per ${c.unit.sv}`]),
        },
        {
          type: "p",
          text: `Ett halvt dubbelgarage med tio däcksatser, fyra skidpaket och en skoter kan ge omkring ${kr(exampleGarageIncome(), "sv")} kr i månaden till dig efter Spazias avgift. Räkna på ditt eget utrymme i [kalkylatorn](page:host#kalkylator).`,
        },
        { type: "h2", text: "Vad fungerar bäst att hyra ut?" },
        {
          type: "ul",
          items: [
            "Däck och skidor: små, lätta att hantera och hämtas bara ett par gånger om året.",
            "Skoter, släp eller sommarbil: ger mest per plats, men kräver en port som går att köra in genom.",
            "Flyttlådor och möbler: passar en torr källare eller ett uthus, och hyresgästen kommer sällan.",
            "Parkering på uppfarten: ingen behöver gå in i något utrymme alls.",
          ],
        },
        { type: "h2", text: "Så går det till med Spazia" },
        {
          type: "ol",
          items: [
            "Du anmäler ditt utrymme. Det är gratis och inte bindande.",
            "Vi besöker utrymmet, hjälper dig att räkna ut hur mycket plats du kan hyra ut och tar bilderna till annonsen. Just nu gör vi besök i Luleå.",
            "Du bestämmer vad du tar emot och när hyresgästerna får komma.",
            "Hyresgästen verifieras med BankID, ni skriver ett standardavtal och hyran betalas automatiskt varje månad.",
          ],
        },
        { type: "h2", text: "Det här ska du tänka på" },
        {
          type: "ul",
          items: [
            "Bestäm i förväg vilka tider hyresgästen får komma, till exempel helger, så slipper du överraskningar.",
            "Brandfarliga saker som bensin i dunkar, gasol, färg och lösningsmedel får inte förvaras hos dig via Spazia.",
            "Prata med ditt försäkringsbolag om att du hyr ut plats. Hyresgästens saker försäkras normalt av hyresgästens egen hemförsäkring.",
            "Hyran är en inkomst, men för de flesta som hyr ut en del av sin villa blir det ingen skatt. Läs mer i [guiden om skatt](guide:tax).",
          ],
        },
      ],
      en: [
        {
          type: "p",
          text: "Lots of garages are half empty. The car is parked outside, and along the walls there's room for tyres, skis or a snowmobile. That space can bring in extra income without renting out the whole garage.",
        },
        { type: "h2", text: "What can you earn?" },
        {
          type: "p",
          text: "It depends on what you have room for. These are our guide prices in Luleå, what the renter pays per month including the service fee:",
        },
        {
          type: "table",
          head: ["Storage", "Per month"],
          rows: categories.map((c) => [c.name.en, `about SEK ${kr(c.price, "en")} per ${c.unit.en}`]),
        },
        {
          type: "p",
          text: `Half a double garage with ten sets of tyres, four ski sets and a snowmobile can bring you about SEK ${kr(exampleGarageIncome(), "en")} a month after Spazia's fee. Work out your own space in the [calculator](page:host#kalkylator).`,
        },
        { type: "h2", text: "What works best to rent out?" },
        {
          type: "ul",
          items: [
            "Tyres and skis: small, easy to handle and only collected a couple of times a year.",
            "Snowmobiles, trailers or summer cars: earn the most per space, but need a door you can drive through.",
            "Boxes and furniture: suit a dry basement or outbuilding, and the renter rarely comes by.",
            "Parking on your driveway: nobody needs to go into any space at all.",
          ],
        },
        { type: "h2", text: "How it works with Spazia" },
        {
          type: "ol",
          items: [
            "You register your space. It's free and non-binding.",
            "We visit the space, help you work out how much you can rent out and take the photos for the listing. Right now we visit in Luleå.",
            "You decide what you accept and when renters can come.",
            "The renter is verified with BankID, you sign a standard agreement and the rent is paid automatically every month.",
          ],
        },
        { type: "h2", text: "Things to think about" },
        {
          type: "ul",
          items: [
            "Decide in advance when renters can come, for example at weekends, so there are no surprises.",
            "Flammable things such as petrol in cans, LPG, paint and solvents may not be stored with you through Spazia.",
            "Tell your insurance company that you rent out space. The renter's things are normally covered by the renter's own home insurance.",
            "The rent is income, but most people who rent out part of their house pay no tax on it. Read more in the [tax guide](guide:tax).",
          ],
        },
      ],
    },
    sources: [],
  },

  {
    id: "tax",
    slug: { sv: "skatt-hyra-ut-garage", en: "tax-renting-out-a-garage" },
    photo: "keys",
    audience: "host",
    categories: ["parking"],
    published: "2026-11-04",
    updated: "2026-11-04",
    title: {
      sv: "Skatt när du hyr ut garage, förråd eller p-plats",
      en: "Tax when you rent out a garage, storeroom or parking space",
    },
    description: {
      sv: "Så beskattas hyran när du hyr ut plats i din villa, bostadsrätt eller på uppfarten, och varför de flesta inte betalar någon skatt alls.",
      en: "How rent is taxed when you rent out space in your house, flat or driveway in Sweden, and why most people pay no tax at all.",
    },
    body: {
      sv: [
        {
          type: "p",
          text: "Hyr du ut plats som privatperson, till exempel en del av garaget till din villa, räknas hyran som inkomst av kapital. Men tack vare schablonavdraget betalar de flesta som hyr ut i liten skala ingen skatt alls.",
        },
        { type: "h2", text: "Schablonavdraget: 40 000 kr per år" },
        {
          type: "p",
          text: "När du hyr ut din privatbostad, eller en del av den, får du dra av 40 000 kr per år. Avdraget gäller per bostad och år, och äger ni bostaden tillsammans delar ni på det efter ägarandel.",
        },
        {
          type: "p",
          text: "Äger du ett småhus, till exempel en villa, eller en ägarlägenhet får du dessutom dra av 20 procent av hyresintäkten. Bor du i bostadsrätt drar du i stället av den del av avgiften som hör till det du hyr ut.",
        },
        { type: "h2", text: "Gäller det garage och parkering?" },
        {
          type: "p",
          text: "Ja, om garaget eller parkeringsplatsen ingår i din privatbostad, till exempel ett garage eller en uppfart på villatomten. Då gäller samma avdrag som ovan.",
        },
        {
          type: "p",
          text: "Hör platsen inte till din bostad, till exempel en p-plats som du hyr separat, får du inte göra schablonavdraget och inte dra av den hyra du själv betalar. Då får du bara dra av direkta kostnader, som annonsering.",
        },
        { type: "h2", text: "Ett räkneexempel" },
        {
          type: "p",
          text: "Du hyr ut halva dubbelgaraget till din villa och får 1 000 kr i månaden, alltså 12 000 kr per år.",
        },
        {
          type: "table",
          head: ["", "Kr per år"],
          rows: [
            ["Hyresintäkt", "12 000"],
            ["Schablonavdrag", "−40 000"],
            ["Avdrag 20 % för småhus", "−2 400"],
            ["Överskott att skatta för", "0"],
          ],
        },
        {
          type: "p",
          text: "För ett småhus blir det ett överskott först när hyran för bostaden blir högre än 50 000 kr per år. Överskottet beskattas med 30 procent.",
        },
        {
          type: "p",
          text: "Tänk på att du bara får ett schablonavdrag per bostad, även om du har flera hyresintäkter från den. Hyr du till exempel också ut ett rum eller hela huset under sommaren räknas allt ihop.",
        },
        { type: "h2", text: "Hur deklarerar man?" },
        {
          type: "p",
          text: "Blir det inget överskott efter avdragen ska du inte redovisa uthyrningen i deklarationen. Blir det ett överskott redovisar du det som inkomst av kapital. Skatteverkets blankett Uthyrning m.m. (SKV 2199) hjälper dig att räkna.",
        },
        { type: "h2", text: "Plattformar rapporterar till Skatteverket" },
        {
          type: "p",
          text: "Sedan 2023 ska digitala plattformar som förmedlar uthyrning lämna uppgifter till Skatteverket om vilka som hyr ut och vad de har fått betalt. Reglerna kommer från EU och kallas DAC7. När Spazia börjar ta emot betalningar kommer vi att rapportera på samma sätt, och därför ber vi värdar om personnummer och adress när avtalet skrivs.",
        },
        {
          type: "note",
          text: "Det här är en översikt, inte skatterådgivning. Reglerna kan ändras och din situation kan skilja sig. Kontrollera alltid med Skatteverket vad som gäller för dig.",
        },
      ],
      en: [
        {
          type: "p",
          text: "If you rent out space as a private person in Sweden, for example part of the garage that belongs to your house, the rent counts as capital income. But thanks to the standard deduction, most people who rent out on a small scale pay no tax at all.",
        },
        { type: "h2", text: "The standard deduction: SEK 40,000 a year" },
        {
          type: "p",
          text: "When you rent out your private home, or part of it, you can deduct SEK 40,000 a year. The deduction applies per home and year, and if you own the home together you split it by ownership share.",
        },
        {
          type: "p",
          text: "If you own a house or an owner-occupied flat (ägarlägenhet), you can also deduct 20 percent of the rental income. In a tenant-owned flat (bostadsrätt), you instead deduct the part of the monthly fee that belongs to what you rent out.",
        },
        { type: "h2", text: "Does it apply to garages and parking?" },
        {
          type: "p",
          text: "Yes, if the garage or parking space is part of your private home, for example a garage or driveway on your house plot. Then the same deductions apply.",
        },
        {
          type: "p",
          text: "If the space isn't part of your home, for example a parking space you rent separately, you can't use the standard deduction or deduct the rent you pay yourself. You can only deduct direct costs, such as advertising.",
        },
        { type: "h2", text: "An example" },
        {
          type: "p",
          text: "You rent out half of the double garage at your house and get SEK 1,000 a month, so SEK 12,000 a year.",
        },
        {
          type: "table",
          head: ["", "SEK per year"],
          rows: [
            ["Rental income", "12,000"],
            ["Standard deduction", "−40,000"],
            ["20% deduction for a house", "−2,400"],
            ["Taxable surplus", "0"],
          ],
        },
        {
          type: "p",
          text: "For a house, there is only a surplus once the rent for the home goes above SEK 50,000 a year. The surplus is taxed at 30 percent.",
        },
        {
          type: "p",
          text: "Remember that you only get one standard deduction per home, even if you have several rental incomes from it. If you also rent out a room or the whole house over the summer, for example, it all counts together.",
        },
        { type: "h2", text: "How do you declare it?" },
        {
          type: "p",
          text: "If there is no surplus after the deductions, you don't report the rental in your tax return. If there is a surplus, you report it as capital income. The Swedish Tax Agency's form Uthyrning m.m. (SKV 2199) helps you work it out.",
        },
        { type: "h2", text: "Platforms report to the Swedish Tax Agency" },
        {
          type: "p",
          text: "Since 2023, digital platforms that arrange rentals must report to the Swedish Tax Agency who rents out and how much they were paid. The rules come from the EU and are called DAC7. When Spazia starts taking payments we will report in the same way, which is why we ask hosts for their personal identity number and address when the agreement is signed.",
        },
        {
          type: "note",
          text: "This is an overview, not tax advice. The rules can change and your situation may differ. Always check with the Swedish Tax Agency (Skatteverket) what applies to you.",
        },
      ],
    },
    sources: [
      { name: "Skatteverket: Hyra ut privatbostad", url: "https://skatteverket.se/hyrautbostad" },
      { name: "Skatteverket: Digitala plattformar (DAC7)", url: "https://skatteverket.se/plattformsekonomi" },
    ],
  },

  {
    id: "student-summer",
    slug: { sv: "sommarforvaring-for-studenter", en: "summer-storage-for-students" },
    photo: "boxes",
    audience: "renter",
    categories: ["boxes", "bikes"],
    published: "2026-11-04",
    updated: "2026-11-04",
    title: {
      sv: "Sommarförvaring för studenter: slipp frakta hem allt",
      en: "Summer storage for students: no need to take it all home",
    },
    description: {
      sv: "Var du kan lämna lådor, möbler och cykeln över sommaren när du flyttar ur studentrummet, vad det kostar och hur du packar.",
      en: "Where to leave your boxes, furniture and bike over the summer when you move out of student housing, what it costs and how to pack.",
    },
    body: {
      sv: [
        {
          type: "p",
          text: "När vårterminen tar slut flyttar många studenter ur rummet eller korridoren och tillbaka in i augusti. Att frakta hem allt är dyrt och krångligt, särskilt om du bor långt bort eller kommer från ett annat land. Ett alternativ är att låta sakerna stå kvar i studentstaden.",
        },
        { type: "h2", text: "Hur mycket plats behöver du?" },
        {
          type: "p",
          text: "För de flesta handlar det om några flyttlådor, en cykel och kanske en byrå eller en säng. Det får ofta plats på en till två kvadratmeter.",
        },
        { type: "h2", text: "Vad kostar det?" },
        {
          type: "p",
          text: `Hos förrådsföretagen kostar magasinering ofta ${selfStorage.minPerM2}–${selfStorage.maxPerM2} kr per kvadratmeter och månad, och ett litet förråd på 1–3 m² ofta 300–1 200 kr i månaden. Hos en granne via Spazia är riktpriset i Luleå omkring ${price("boxes")} kr per kvadratmeter och ${price("bikes")} kr per cykel i månaden.`,
        },
        {
          type: "table",
          head: ["Juni–augusti", "Spazia", "Förrådsföretag"],
          rows: [
            [
              "2 m² lådor och möbler",
              `ca ${kr(price("boxes") * 2 * 3, "sv")} kr`,
              `ca ${kr(selfStorage.minPerM2 * 2 * 3, "sv")}–${kr(selfStorage.maxPerM2 * 2 * 3, "sv")} kr`,
            ],
            ["En cykel", `ca ${kr(price("bikes") * 3, "sv")} kr`, "Ingår i förrådet"],
          ],
        },
        {
          type: "p",
          text: "På sommaren behöver förvaringen inte vara uppvärmd, så ett vanligt torrt garage räcker.",
        },
        { type: "h2", text: "Saknar du svenskt BankID?" },
        {
          type: "p",
          text: "Många internationella studenter har inget svenskt BankID. Hos Spazia kan du verifiera dig med Freja eID och ditt pass i stället.",
        },
        { type: "h2", text: "Så packar du inför sommaren" },
        {
          type: "ul",
          items: [
            "Använd lådor av samma storlek, så går de att stapla.",
            "Skriv innehållet på lådans sida, inte bara på locket.",
            "Fotografera sakerna innan du lämnar dem. Bilderna blir din inventarielista.",
            "Lämna inte mat, växter eller något annat som kan börja lukta.",
            "Tvätta och torka textilier innan du packar dem, så att de inte möglar.",
            "Ta med pass, värdesaker och elektronik som du behöver under sommaren.",
          ],
        },
        { type: "h2", text: "Var ute i god tid" },
        {
          type: "p",
          text: "Efterfrågan är störst i slutet av maj och början av juni, när alla flyttar samtidigt. Anmäl intresse redan nu, så hör vi av oss när vi öppnar i din studentstad.",
        },
      ],
      en: [
        {
          type: "p",
          text: "When the spring term ends, lots of students move out of their room or corridor and back in again in August. Taking everything home is expensive and a hassle, especially if you live far away or come from another country. Another option is to leave your things in the city where you study.",
        },
        { type: "h2", text: "How much space do you need?" },
        {
          type: "p",
          text: "For most people it's a few moving boxes, a bike and maybe a chest of drawers or a bed. That often fits in one or two square metres.",
        },
        { type: "h2", text: "What does it cost?" },
        {
          type: "p",
          text: `Storage companies often charge SEK ${selfStorage.minPerM2}–${selfStorage.maxPerM2} per square metre and month, and a small unit of 1–3 m² often costs SEK 300–1,200 a month. With a neighbour through Spazia, the guide price in Luleå is about SEK ${price("boxes")} per square metre and SEK ${price("bikes")} per bike a month.`,
        },
        {
          type: "table",
          head: ["June–August", "Spazia", "Storage company"],
          rows: [
            [
              "2 m² of boxes and furniture",
              `about SEK ${kr(price("boxes") * 2 * 3, "en")}`,
              `about SEK ${kr(selfStorage.minPerM2 * 2 * 3, "en")}–${kr(selfStorage.maxPerM2 * 2 * 3, "en")}`,
            ],
            ["One bike", `about SEK ${kr(price("bikes") * 3, "en")}`, "Fits in the unit"],
          ],
        },
        {
          type: "p",
          text: "In summer, storage doesn't need to be heated, so an ordinary dry garage is fine.",
        },
        { type: "h2", text: "No Swedish BankID?" },
        {
          type: "p",
          text: "Many international students don't have a Swedish BankID. With Spazia you can verify yourself with Freja eID and your passport instead.",
        },
        { type: "h2", text: "How to pack for the summer" },
        {
          type: "ul",
          items: [
            "Use boxes of the same size so they stack.",
            "Write the contents on the side of the box, not just the lid.",
            "Take photos of your things before you leave them. The photos become your inventory list.",
            "Don't leave food, plants or anything else that can start to smell.",
            "Wash and dry textiles before you pack them, so they don't go mouldy.",
            "Take your passport, valuables and any electronics you need over the summer.",
          ],
        },
        { type: "h2", text: "Plan ahead" },
        {
          type: "p",
          text: "Demand peaks at the end of May and the start of June, when everyone moves at the same time. Register your interest now and we'll get in touch when we open in your city.",
        },
      ],
    },
    sources: selfStorage.sources.map((s) => ({ name: s.name, url: s.url })),
  },
];

export function getGuideBySlug(slug: string, lang: Lang): Guide | undefined {
  return guides.find((g) => g.slug[lang] === slug);
}

export function getGuide(id: GuideId): Guide {
  return guides.find((g) => g.id === id)!;
}

/** Rough reading time in minutes (200 words a minute). */
export function readingMinutes(guide: Guide, lang: Lang): number {
  const words = guide.body[lang]
    .flatMap((b) => (b.type === "table" ? [...b.head, ...b.rows.flat()] : "items" in b ? b.items : [b.text]))
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
