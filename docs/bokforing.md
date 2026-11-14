# Bokföring i Spazia (systemdokumentation)

Spazias egen bokföring finns i appen under **Admin → Bokföring** (app.spazia.se/admin). Bara konton i Spazias team (`private.admins`) kommer åt den. Det här dokumentet beskriver hur systemet fungerar, så som bokföringslagen kräver (systemdokumentation och behandlingshistorik).

## Grundinställningar

| | |
|---|---|
| Företag | Spazia, enskild firma (org.nr = personnummer, se `src/lib/site.ts`) |
| Räkenskapsår | Kalenderår |
| Metod | Kontantmetoden: affärshändelser bokförs när pengarna kommer in eller går ut. Obetalda fakturor bokförs vid årets slut. |
| Moms | Redovisas per kvartal (`private.settings` `acc_vat_period`: `quarter`, `month` eller `year`) |
| Kontoplan | BAS. Konton läggs till under Kontoplan. |
| Valuta | SEK |

## Var bokföringen finns

- **Databasen** (Supabase, Stockholm): tabellerna `private.acc_*` i migreringen `supabase/migrations/20261114020000_bookkeeping.sql`. Appen når dem bara via funktionerna `public.acc_*`, som alla kontrollerar att användaren är med i teamet.
- **Underlag** (kvitton, fakturor): lagringsbehållaren `bookkeeping`, en mapp per verifikation. Bara teamet kan läsa och lägga till filer. Filer kan inte ändras eller tas bort.
- **Skärmarna:** `src/components/app/admin/bookkeeping/` och hjälpfunktionerna i `src/lib/app/bookkeeping.ts`.

## Verifikationer

Varje verifikation har ett nummer i en obruten serie per år, ett datum, en text, minst två rader med konto och belopp (debet plus, kredit minus) och, för manuella verifikationer, underlaget som fil.

| Serie | Vad |
|---|---|
| A | Manuella verifikationer och rättelser |
| S | Stripe, bokförs automatiskt |
| M | Momsredovisning (avräkning mot 2650) |
| B | Bokslut och ingående balans |

**Regler som databasen kontrollerar:**

- Debet och kredit måste vara lika stora, och kontona måste finnas och vara aktiva.
- Numret sätts av databasen (nästa lediga i serien), så serien får inga luckor.
- En verifikation kan inte ändras eller tas bort, inte heller dess rader eller underlag (`private.acc_immutable`). Fel rättas med en ny verifikation som bokar tillbaka allt och hänvisar till den felaktiga (knappen Rätta). Det rätta bokförs sedan som en ny verifikation.
- Inget kan dateras i en momsperiod som är redovisad eller ett år som är stängt. En manuell verifikation kan inte dateras i framtiden.
- Varje verifikation sparar vem som bokförde den och när (behandlingshistorik). Moms- och bokslutsåtgärder loggas också i `private.admin_log`.

**Mallar:** Ny verifikation räknar fram raderna utifrån belopp inklusive moms: inköp med 25, 12 eller 6 % moms, inköp utan moms, tjänster från andra EU-länder och från länder utanför EU (omvänd skattskyldighet), försäljning, eget uttag, egen insättning och betalning av moms. Med Fri kontering skrivs raderna för hand. Det som betalats privat bokförs mot 2018 (egen insättning).

## Automatisk bokföring från Stripe

Jobbet `payments-worker` hämtar en gång i timmen Stripes saldotransaktioner (två dygn bakåt, så inget missas) och bokför varje transaktion en gång i serie S. Reglerna finns i `supabase/functions/_shared/bookkeeping.ts` och testas i `bookkeeping.test.ts`.

Spazia tar emot hyran i värdens namn och för värdens räkning. Hyran är därför inte Spazias intäkt, utan en skuld till värden tills den betalas ut.

| Transaktion | Debet | Kredit |
|---|---|---|
| Kortbetalning | 1580 Stripe-saldo (hela beloppet) | 2890 Skuld till värdar (värdens del), 3041 Spazias avgifter utan moms (ruta 05), 2611 moms 25 % (ruta 10) |
| Stripes avgift på betalningen | 6570 Bankkostnader (ruta 21), 2645 (ruta 48) | 1580, 2614 (ruta 30) |
| Återbetalning | 2890, 3041, 2611 i samma proportioner | 1580 |
| Överföring till värd | 2890 | 1580 |
| Överföring tillbaka från värd | 1580 | 2890 |
| Utbetalning till företagskontot | 1930 | 1580 |
| Stripes övriga avgifter (Billing, Tax m.m.) | 6570 (+ omvänd moms) | 1580 |

Spazias avgifter är hyresgästens serviceavgift (15 %), värdens avgift (5 %) och eventuellt Spazia Skydd. Allt det är Spazias intäkt med 25 % moms. Värdens avgift ingår alltså också, och momsen på den redovisas här.

Stripes avgifter bokförs som tjänster köpta från ett annat EU-land med omvänd skattskyldighet (Stripe Payments Europe, Irland). Om redovisningskonsulten bedömer att betalningsavgifterna är momsfria, sätt `acc_stripe_fee_reverse_charge` till `false`. Momsen att betala påverkas inte, eftersom den omvända momsen dras av i samma period. Bara rutorna 21, 30 och 48 ändras.

Det som inte går att bokföra säkert (en betalning som inte hör till någon bokning, tvister, justeringar och andra ovanliga transaktioner) hamnar under **Att bokföra** i översikten. Där bokförs de för hand, eller markeras som hanterade med en förklaring.

## Moms

Under Moms visas momsdeklarationens rutor för varje period. Underlagsbeloppen kommer från radernas momsruta, och momsbeloppen från momskontona (2610–2649). När perioden är slut och deklarationen lämnad trycker du **Bokför momsredovisningen och lås perioden**. Då:

1. förs momskontona över till 2650, och avrundningen till hela kronor bokförs på 3740 (serie M),
2. låses perioden, så att inget mer kan dateras i den.

Betalningen till skattekontot bokförs med mallen Betalning av moms (2650 mot 1930 eller 1630).

## Bokslut

Efter årets slut, när momsen för årets alla perioder är redovisad, trycker du **Stäng året** under Bokslut och export:

1. Årets resultat bokförs den 31 december: 8999 mot 2019 (serie B).
2. Året låses.
3. Den 1 januari nästa år förs 2013, 2017, 2018 och 2019 över till eget kapital (2010).

Avskrivningar, periodiseringar och obetalda fakturor (kontantmetoden) bokförs innan året stängs. Underlaget för NE-bilagan (R1–R11 och balansräkningen) visas på samma sida och förs in i inkomstdeklarationen. Skattemässiga justeringar görs där.

## Export och arkivering

- **SIE 4:** Bokslut och export → Ladda ner SIE-fil. Filen innehåller kontoplan, ingående och utgående balanser, resultat och alla verifikationer, i teckenkodningen PC8. Den kan läsas av redovisningsbyråer, Skatteverket och andra bokföringsprogram.
- **Arkivering:** bokföringen och underlagen ska sparas i sju år efter årets slut. De ligger kvar i Supabase. Spara dessutom varje års SIE-fil och en utskrift (PDF) av grundbok, huvudbok, resultat- och balansräkning utanför systemet.
- **Säkerhetskopior:** lita inte bara på Supabase. Vilka säkerhetskopior som finns beror på planen, och gratisplanen har inga dagliga kopior som går att återställa själv. Ladda därför ner SIE-filen efter varje momsperiod, och kopiera underlagen i behållaren `bookkeeping` en gång om året.

## Att tänka på

- Bokföringen följer reglerna ovan, men låt gärna en redovisningskonsult gå igenom kontoplanen, momsen och det första bokslutet.
- Bokför löpande: kontanta affärshändelser senast nästa arbetsdag, övriga senast månaden efter.
