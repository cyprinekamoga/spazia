/**
 * Spazia's rental agreement between host and renter. One agreement per request
 * or parking booking, built from the deal's details. When the terms change,
 * bump AGREEMENT_VERSION: the version the renter accepted is stored with the
 * request (public.requests.agreement_version), and the deal's details are
 * frozen when the host accepts (public.requests.agreement).
 */
import { appText } from "./app";
import { getCategory, type CategoryId } from "./categories";
import { appLang } from "@/lib/app/lang";
import { bookingHours, formatDay, formatKr, formatTimeRange, renterHourlyTotal, renterPrice } from "@/lib/app/model";

export const AGREEMENT_VERSION = "2026-11-14";

export interface AgreementItem {
  category: CategoryId;
  quantity: number;
  host_price_month: number | null;
  hourly_price: number | null;
  daily_max: number | null;
}

export interface AgreementListing {
  title: string;
  space_type: string | null;
  city: string;
  area_name: string;
  size_m2: number | null;
  heated: string | null;
  features: string[];
  access: string | null;
  access_notes: string;
  min_period: string;
  rules: string;
}

export interface AgreementData {
  kind: "month" | "hour";
  hostName: string;
  renterName: string;
  listing: AgreementListing;
  /** Street address, once the app may show it. */
  address: string | null;
  items: AgreementItem[];
  start_date: string;
  end_date: string | null;
  start_at: string | null;
  end_at: string | null;
  paymentRequired: boolean;
}

export interface AgreementSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

const s = appText;

function units(i: AgreementItem): string {
  const c = getCategory(i.category);
  return `${i.quantity} ${i.quantity === 1 ? c.unit.sv : c.unitPlural.sv}`;
}

/** The agreement in the app's language (English is a translation; the Swedish text applies). */
export function agreementSections(d: AgreementData): AgreementSection[] {
  return appLang === "en" ? englishSections(d) : swedishSections(d);
}

function swedishSections(d: AgreementData): AgreementSection[] {
  const l = d.listing;
  const isHour = d.kind === "hour";
  const where = [l.area_name, l.city].filter(Boolean).join(", ");
  const spaceType = l.space_type ? (s.spaceTypes as Record<string, string>)[l.space_type] ?? "" : "";
  const heated = l.heated ? (s.heated as Record<string, string>)[l.heated] ?? "" : "";
  const features = l.features.map((f) => (s.features as Record<string, string>)[f]).filter(Boolean);
  const access = l.access ? (s.access as Record<string, string>)[l.access] ?? "" : "";

  const sections: AgreementSection[] = [];

  sections.push({
    title: "1. Parter",
    paragraphs: [
      `Värd: ${d.hostName}. Hyresgäst: ${d.renterName}. Kontaktuppgifterna finns i Spazias app.`,
      "Avtalet gäller mellan värden och hyresgästen. Spazia förmedlar avtalet och tar emot betalningen i värdens namn och för värdens räkning, men är inte part i hyresförhållandet.",
    ],
  });

  sections.push({
    title: "2. Utrymmet",
    paragraphs: [
      [`${l.title}${spaceType ? ` (${spaceType.toLowerCase()})` : ""}${where ? `, ${where}` : ""}.`, l.size_m2 ? `Cirka ${String(l.size_m2).replace(".", ",")} m².` : "", heated ? `${heated}.` : ""]
        .filter(Boolean)
        .join(" "),
      d.address ? `Adress: ${d.address}.` : "Adressen visas i appen när bokningen är klar.",
      ...(features.length ? [`Utrustning: ${features.join(", ").toLowerCase()}.`] : []),
    ],
  });

  if (isHour) {
    const qty = d.items[0]?.quantity ?? 1;
    sections.push({
      title: "3. Vad avtalet gäller",
      paragraphs: [`${qty === 1 ? "En parkeringsplats" : `${qty} parkeringsplatser`} för ${qty === 1 ? "ett fordon" : "lika många fordon"}, på den plats värden anvisar.`],
    });
  } else {
    sections.push({
      title: "3. Vad som förvaras",
      paragraphs: ["Hyresgästen får förvara följande. Annat bara om värden har godkänt det i appen."],
      bullets: d.items.map(units),
    });
  }

  sections.push({
    title: "4. Hyrestid",
    paragraphs: [
      isHour && d.start_at && d.end_at
        ? `${formatTimeRange(d.start_at, d.end_at)} (svensk tid).`
        : d.end_date
          ? `Från och med ${formatDay(d.start_date, true)} till och med ${formatDay(d.end_date, true)}.`
          : `Från och med ${formatDay(d.start_date, true)}, tills vidare.`,
    ],
  });

  if (isHour) {
    const item = d.items[0];
    const hours = bookingHours({ start_at: d.start_at, end_at: d.end_at });
    const total = item?.hourly_price ? renterHourlyTotal(hours, item.hourly_price, item.daily_max, item.quantity) : 0;
    sections.push({
      title: "5. Pris och betalning",
      paragraphs: [
        `Hyresgästen betalar ${formatKr(total)} kr för hela bokningen, inklusive Spazias serviceavgift (moms ingår i avgiften, inte i hyran).`,
        d.paymentRequired
          ? "Beloppet betalas med kort via Spazia när bokningen görs. Värden får sin del från Spazia ett dygn efter att bokningen har slutat."
          : "Värd och hyresgäst gör upp om betalningen direkt med varandra.",
      ],
    });
  } else {
    const total = d.items.reduce((sum, i) => sum + (i.host_price_month ? renterPrice(i.host_price_month) * i.quantity : 0), 0);
    const rent = d.items.reduce((sum, i) => sum + (i.host_price_month ?? 0) * i.quantity, 0);
    sections.push({
      title: "5. Pris och betalning",
      paragraphs: [
        `Hyresgästen betalar ${formatKr(total)} kr per månad. Av det är ${formatKr(rent)} kr hyra till värden och ${formatKr(total - rent)} kr Spazias serviceavgift (moms ingår i avgiften, inte i hyran).`,
        d.paymentRequired
          ? "Första månaden betalas med kort via Spazia när värden har godkänt förfrågan, och sedan samma datum varje månad. Har hyran ett slutdatum betalas den sista månaden per dag. Värden får sin del för varje månad från Spazia ett dygn efter att månaden är slut. Betala aldrig vid sidan av Spazia."
          : "Värd och hyresgäst gör upp om betalningen direkt med varandra.",
      ],
    });
  }

  sections.push({
    title: "6. Tillträde",
    paragraphs: [
      isHour
        ? "Hyresgästen får använda platsen under den bokade tiden och ska flytta fordonet senast när bokningen slutar."
        : `Tillträde: ${access ? access.toLowerCase() : "enligt överenskommelse"}. Hyresgästen lämnar och hämtar sina saker på de tider som gäller, och vid ”efter överenskommelse” bestämmer ni tid i appen.`,
      ...(l.access_notes.trim() ? [`Värdens anvisningar: ${l.access_notes.trim()}`] : []),
    ],
  });

  sections.push({
    title: isHour ? "7. Avbokning" : "7. Uppsägning och avbokning",
    paragraphs: isHour
      ? [
          "Hyresgästen kan avboka utan kostnad fram till en timme före start, och får då tillbaka hela beloppet. Efter det går bokningen inte att avboka.",
          "Om platsen inte går att använda kan värden avboka före start. Hyresgästen får då tillbaka hela beloppet.",
        ]
      : [
          "Båda kan avsluta hyran i appen. Hyran gäller då till och med den sista dag som redan är betald, och inga fler betalningar dras. Det finns ingen bindningstid.",
          "Avbokas hyran innan den har börjat får hyresgästen tillbaka hela beloppet.",
          ...(l.min_period === "week" ? ["Värdens kortaste hyrestid är en vecka."] : l.min_period === "month" ? ["Värdens kortaste hyrestid är en månad."] : []),
          "Hyresgästen ska hämta sina saker senast sista dagen. Saker som lämnas kvar efter det ska hyresgästen hämta så snart som möjligt efter påminnelse i appen.",
        ],
  });

  sections.push({
    title: "8. Ansvar",
    paragraphs: [],
    bullets: [
      "Värden ansvarar för att utrymmet är i det skick annonsen beskriver och för att hyresgästen får tillträde enligt avtalet.",
      isHour
        ? "Hyresgästen ansvarar för sitt fordon och för skador som hyresgästen orsakar på platsen eller fastigheten."
        : "Hyresgästen ansvarar för sina saker och för skador som hyresgästen orsakar på utrymmet. Kontrollera att hemförsäkringen gäller för saker som förvaras utanför hemmet.",
      "Spazia förvarar inga saker och äger inga utrymmen, och ansvarar inte för skador på eller förlust av saker, fordon eller utrymmen, utom när skadan beror på att Spazia har varit vårdslöst.",
    ],
  });

  sections.push(
    isHour
      ? {
          title: "9. Användning",
          paragraphs: ["Platsen får bara användas för parkering av fordonet. Ingen förvaring, inga reparationer och inget som läcker olja eller bränsle."],
        }
      : {
          title: "9. Det här får inte förvaras",
          paragraphs: [],
          bullets: [
            "brandfarligt, som bensin i dunkar, gasol, färg och lösningsmedel",
            "livsmedel och annat som drar till sig skadedjur",
            "djur och växter",
            "vapen, ammunition och allt som är olagligt",
            "kontanter, smycken och andra värdesaker",
          ],
        },
  );

  if (!isHour) {
    sections.push({
      title: "10. Inventarielista",
      paragraphs: [
        "Vid inlämning och vid hämtning fotograferar den som lämnar eller hämtar sakerna i appen, och den andra bekräftar listan. Listan med bilder hör till avtalet.",
      ],
    });
  }

  if (l.rules.trim()) {
    sections.push({ title: `${isHour ? 10 : 11}. Värdens regler`, paragraphs: [l.rules.trim()] });
  }

  sections.push({
    title: "Övrigt",
    paragraphs: [
      "Spazias användarvillkor gäller också. Vid frågor eller om något går fel: skriv först till varandra i appen. Löser det sig inte, kontakta Spazia. Svensk lag gäller för avtalet.",
    ],
  });

  return sections;
}

function englishUnits(i: AgreementItem): string {
  const c = getCategory(i.category);
  return `${i.quantity} ${i.quantity === 1 ? c.unit.en : c.unitPlural.en}`;
}

function englishSections(d: AgreementData): AgreementSection[] {
  const l = d.listing;
  const isHour = d.kind === "hour";
  const where = [l.area_name, l.city].filter(Boolean).join(", ");
  const spaceType = l.space_type ? (s.spaceTypes as Record<string, string>)[l.space_type] ?? "" : "";
  const heated = l.heated ? (s.heated as Record<string, string>)[l.heated] ?? "" : "";
  const features = l.features.map((f) => (s.features as Record<string, string>)[f]).filter(Boolean);
  const access = l.access ? (s.access as Record<string, string>)[l.access] ?? "" : "";
  const sections: AgreementSection[] = [];

  sections.push({
    title: "About this translation",
    paragraphs: ["This is an English translation of Spazia's rental agreement. If the Swedish and English texts differ, the Swedish text applies."],
  });

  sections.push({
    title: "1. Parties",
    paragraphs: [
      `Host: ${d.hostName}. Renter: ${d.renterName}. Contact details are in Spazia's app.`,
      "The agreement is between the host and the renter. Spazia arranges the agreement and collects the payment in the host's name and on the host's behalf, but is not a party to the rental.",
    ],
  });

  sections.push({
    title: "2. The space",
    paragraphs: [
      [`${l.title}${spaceType ? ` (${spaceType.toLowerCase()})` : ""}${where ? `, ${where}` : ""}.`, l.size_m2 ? `About ${l.size_m2} m².` : "", heated ? `${heated}.` : ""]
        .filter(Boolean)
        .join(" "),
      d.address ? `Address: ${d.address}.` : "The address is shown in the app once the booking is confirmed.",
      ...(features.length ? [`Facilities: ${features.join(", ").toLowerCase()}.`] : []),
    ],
  });

  if (isHour) {
    const qty = d.items[0]?.quantity ?? 1;
    sections.push({
      title: "3. What the agreement covers",
      paragraphs: [`${qty === 1 ? "One parking space" : `${qty} parking spaces`} for ${qty === 1 ? "one vehicle" : "as many vehicles"}, in the spot the host shows.`],
    });
  } else {
    sections.push({
      title: "3. What is stored",
      paragraphs: ["The renter may store the following. Anything else only if the host has approved it in the app."],
      bullets: d.items.map(englishUnits),
    });
  }

  sections.push({
    title: "4. Rental period",
    paragraphs: [
      isHour && d.start_at && d.end_at
        ? `${formatTimeRange(d.start_at, d.end_at)} (Swedish time).`
        : d.end_date
          ? `From ${formatDay(d.start_date, true)} up to and including ${formatDay(d.end_date, true)}.`
          : `From ${formatDay(d.start_date, true)}, until further notice.`,
    ],
  });

  if (isHour) {
    const item = d.items[0];
    const hours = bookingHours({ start_at: d.start_at, end_at: d.end_at });
    const total = item?.hourly_price ? renterHourlyTotal(hours, item.hourly_price, item.daily_max, item.quantity) : 0;
    sections.push({
      title: "5. Price and payment",
      paragraphs: [
        `The renter pays ${formatKr(total)} kr for the whole booking, including Spazia's service fee (VAT is included in the fee, not in the rent).`,
        d.paymentRequired
          ? "The amount is paid by card through Spazia when booking. The host receives their share from Spazia one day after the booking has ended."
          : "Host and renter settle payment directly with each other.",
      ],
    });
  } else {
    const total = d.items.reduce((sum, i) => sum + (i.host_price_month ? renterPrice(i.host_price_month) * i.quantity : 0), 0);
    const rent = d.items.reduce((sum, i) => sum + (i.host_price_month ?? 0) * i.quantity, 0);
    sections.push({
      title: "5. Price and payment",
      paragraphs: [
        `The renter pays ${formatKr(total)} kr per month. Of that, ${formatKr(rent)} kr is rent to the host and ${formatKr(total - rent)} kr is Spazia's service fee (VAT is included in the fee, not in the rent).`,
        d.paymentRequired
          ? "The first month is paid by card through Spazia when the host has accepted the request, and then on the same date every month. If the rental has an end date, the last month is charged per day. The host receives their share for each month from Spazia one day after the month has ended. Never pay outside Spazia."
          : "Host and renter settle payment directly with each other.",
      ],
    });
  }

  sections.push({
    title: "6. Access",
    paragraphs: [
      isHour
        ? "The renter may use the space during the booked time and must move the vehicle by the time the booking ends."
        : `Access: ${access ? access.toLowerCase() : "by agreement"}. The renter drops off and picks up their things at the times that apply, and for “by appointment” you agree on a time in the app.`,
      ...(l.access_notes.trim() ? [`The host's instructions: ${l.access_notes.trim()}`] : []),
    ],
  });

  sections.push({
    title: isHour ? "7. Cancellation" : "7. Ending and cancellation",
    paragraphs: isHour
      ? [
          "The renter can cancel free of charge until one hour before the start and then gets the full amount back. After that the booking can't be cancelled.",
          "If the space can't be used, the host can cancel before the start. The renter then gets the full amount back.",
        ]
      : [
          "Either party can end the rental in the app. The rental then runs up to and including the last day that is already paid, and no more payments are taken. There is no minimum term.",
          "If the rental is cancelled before it has started, the renter gets the full amount back.",
          ...(l.min_period === "week" ? ["The host's shortest rental is one week."] : l.min_period === "month" ? ["The host's shortest rental is one month."] : []),
          "The renter must pick up their things by the last day. Things left after that must be picked up as soon as possible after a reminder in the app.",
        ],
  });

  sections.push({
    title: "8. Responsibility",
    paragraphs: [],
    bullets: [
      "The host is responsible for the space being in the condition the listing describes and for the renter getting access as agreed.",
      isHour
        ? "The renter is responsible for their vehicle and for any damage the renter causes to the space or the property."
        : "The renter is responsible for their things and for any damage the renter causes to the space. Check that your home insurance covers things stored away from home.",
      "Spazia stores nothing and owns no spaces, and is not liable for damage to or loss of things, vehicles or spaces, unless the damage is caused by Spazia's negligence.",
    ],
  });

  sections.push(
    isHour
      ? {
          title: "9. Use",
          paragraphs: ["The space may only be used for parking the vehicle. No storage, no repairs and nothing that leaks oil or fuel."],
        }
      : {
          title: "9. What may not be stored",
          paragraphs: [],
          bullets: [
            "anything flammable, such as petrol in cans, gas bottles, paint and solvents",
            "food and anything else that attracts pests",
            "animals and plants",
            "weapons, ammunition and anything illegal",
            "cash, jewellery and other valuables",
          ],
        },
  );

  if (!isHour) {
    sections.push({
      title: "10. Inventory list",
      paragraphs: ["At drop-off and at pickup, the person dropping off or picking up photographs the things in the app, and the other person confirms the list. The list with photos is part of the agreement."],
    });
  }

  if (l.rules.trim()) {
    sections.push({ title: `${isHour ? 10 : 11}. The host's rules`, paragraphs: [l.rules.trim()] });
  }

  sections.push({
    title: "Other",
    paragraphs: ["Spazia's terms of use also apply. If you have questions or something goes wrong: first write to each other in the app. If that doesn't solve it, contact Spazia. Swedish law applies to the agreement."],
  });

  return sections;
}
