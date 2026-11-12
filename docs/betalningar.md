# Betalningar med Stripe

Hyresgäster betalar med kort, Apple Pay eller Google Pay. Spazia tar emot betalningen via Stripe Connect och för över värdens del ett dygn efter att uthyrningen har börjat. Stripe betalar ut till värdens bankkonto varje måndag. Spazia behåller 15 % från hyresgästen och 5 % från värden, och står för Stripes avgifter.

Allt är byggt men avstängt tills stegen nedan är klara. Gör allt i **testläge** först.

## 1. Stripe-kontot

Skapa kontot på [dashboard.stripe.com/register](https://dashboard.stripe.com/register) med **Sverige** som land. Gör sedan en testmiljö: klicka på kontonamnet uppe till vänster → *Switch to sandbox* → *Create sandbox*, ge den ett namn (till exempel ”Spazia test”) och låt *Copy live account to sandbox* vara på. Testmiljön går att använda innan kontot är aktiverat för riktiga betalningar.

Testmiljön jag skapade med Stripes CLI under bygget är amerikansk och kan inte testa svenska värdkonton eller svensk moms. Den behöver inte tas över, den försvinner av sig själv den 15 november.

I Stripes Dashboard (först i sandboxen, sedan skarpt):

1. **Konto:** Sverige, enskild firma, ert organisationsnummer och företagets bankkonto.
2. **Connect:** *Connect → Get started → Marketplace*. Värdarnas konton skapas med Accounts v2 (Express-dashboard, Spazia står för avgifter och risk). Bekräfta ansvaret för negativa saldon när Stripe frågar.
3. **Utbetalningar till värdar:** *Connect → Settings → Payouts*: veckovis, måndagar.
4. **Betalsätt:** *Settings → Payment methods*. Kort är på från början. Slå på Apple Pay och Google Pay. Koden väljer inga betalsätt själv, så det som är påslaget här visas.
5. **Billing (månadshyran):** *Settings → Billing → Subscriptions and emails*:
   - *Smart Retries* på, försök i upp till **1 vecka**.
   - Om alla försök misslyckas: **avsluta prenumerationen** (*Cancel the subscription*). Då avslutas hyran efter den sista betalda dagen och båda får mejl.
   - Mejla kunden vid misslyckad betalning, med länk till fakturasidan.
6. **Kvitton:** *Settings → Customer emails*: kvitton för lyckade betalningar och återbetalningar.
7. **Utseende:** *Settings → Branding*: logga och färg (#2F6B75). Syns på betalsidan, fakturor och i värdarnas Stripe-sidor.
8. **Moms:** se avsnittet *Moms* nedan. Stripe Tax slås på när den svenska momsregistreringen ligger i Stripe.

## 2. Nycklar och webhooks

Klistra aldrig in nycklarna i en chatt. De läggs bara i [Supabase → Edge Functions → Secrets](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/functions/secrets).

1. **Begränsad nyckel** (`rk_…`), inte en med full åtkomst: *Developers → API keys → Create secret key*, välj egna rättigheter (*custom permissions*) och ge den de här, inget mer:
   - *Write:* Customers, Payment Methods, Payment Intents, Checkout Sessions, Products, Prices, Subscriptions, Subscription Schedules, Invoices, Invoice Items, Credit Notes, Refunds, Transfers, Accounts (Connect), Account Links, Login Links
   - *Read:* Setup Intents, Charges, Events, Invoice Payments (om den finns som egen rad)
   Transfers och Connect markeras som *Elevated risk*. Det stämmer: nyckeln ska kunna föra över pengar till värdarna. Lägg in nyckeln som `STRIPE_SECRET_KEY`. Saknas en rättighet svarar Stripe med 403, och felet syns under nyckelns *View request logs*. Testa därför allt i sandboxen först.
2. **Webhook för betalningar** (*Developers → Webhooks → Create an event destination*, *Your account*, *Snapshot*, API-version `2026-10-28.endive`):
   - URL: `https://mtyhnfsceahvovauckkj.supabase.co/functions/v1/stripe-webhook`
   - Händelser: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.created`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`, `radar.early_fraud_warning.created`
   - Signing secret (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`
3. **Webhook för värdarnas konton** (*Create an event destination*, **Your account**, payload *Thin*, samma URL). Välj *Your account* och inte *Connected accounts*: Stripe skickar v2-händelser om värdkonton till plattformens eget konto.
   - Händelser: `v2.core.account[configuration.recipient].capability_status_updated`, `v2.core.account[requirements].updated`, `v2.core.account.updated`
   - Signing secret → `STRIPE_CONNECT_WEBHOOK_SECRET`

## 3. Slå på

Säg till när nycklarna ligger i Supabase. Då:

1. driftsätts de tre funktionerna (`payments`, `stripe-webhook`, `payments-worker`)
2. slås betalningarna på i databasen:

```sql
insert into private.settings (key, value) values
  ('payments_url', 'https://mtyhnfsceahvovauckkj.supabase.co/functions/v1'),
  ('payments_enabled', 'true')
on conflict (key) do update set value = excluded.value;
```

3. testar vi hela flödet med Stripes testkort: `4242 4242 4242 4242` (godkänns), `4000 0025 0000 3155` (kräver bekräftelse från banken) och `4000 0000 0000 0341` (sparas men nekas vid månadsdragning).

Stäng av igen med `update private.settings set value = 'false' where key = 'payments_enabled';`. Appen fungerar då som innan, utan betalning.

**Testläge.** Med `payments_enabled = 'test'` gäller betalningarna bara konton vars mejladresser står i `payments_test_users` (kommaseparerade). Alla andra använder appen som innan. Så kan hela flödet testas i Stripes sandbox medan riktiga användare inte märker något:

```sql
insert into private.settings (key, value) values
  ('payments_enabled', 'test'),
  ('payments_test_users', 'testvard@example.com,testkund@example.com')
on conflict (key) do update set value = excluded.value;
```

## 4. Skarpt läge

Skapa en begränsad nyckel och samma två webhooks i skarpt läge, och byt de tre hemligheterna i Supabase. Inget annat behöver ändras.

## Så fungerar det

| | Förvaring per månad | Parkering per timme |
|---|---|---|
| Hyresgästen | Sparar ett kort innan förfrågan skickas | Betalar i Stripe Checkout när hen bokar |
| Första dragningen | När värden godkänner: en faktura som dras från det sparade kortet | Direkt i Stripe Checkout, platsen hålls i 30 minuter |
| Följande månader | Stripe Billing: ett betalschema som börjar när månad 2 börjar och drar samma datum varje månad. Med slutdatum dras sista månaden per dag, sedan slutar det. Varje månad blir en faktura | – |
| Misslyckad betalning | Första månaden: mejl med länk till fakturasidan, 48 timmar. Senare månader: Stripe försöker igen i en vecka och hyresgästen kan betala på fakturasidan, annars avslutas hyran efter sista betalda dagen | Platsen släpps |
| Avsluta | Före start: allt tillbaka och betalschemat stoppas. Efter start: hyran slutar när den betalda perioden är slut, inga fler dragningar | Gratis fram till 1 timme före start |
| Värden får betalt | Ett dygn efter att varje månad börjar, utbetalning på måndagar | Ett dygn efter start, utbetalning på måndagar |
| Tvist eller bedrägerivarning | Värdens del hålls kvar tills det är utrett | Samma |

Värdar fyller i namn, personnummer och adress under *Meny → Utbetalningar* och kopplar sedan sitt bankkonto hos Stripe. Utan kopplat bankkonto kan de inte godkänna förfrågningar, och deras parkeringar går inte att boka. Ett värdkonto är redo för pengar när Stripe har aktiverat förmågan att ta emot överföringar (`stripe_transfers`).

## Moms

Spazia är momsregistrerat och tar ut 25 % moms på sina egna avgifter, inte på hyran. Priserna ändras inte, eftersom momsen ingår i avgiften. Be er redovisningskonsult bekräfta upplägget innan ni går skarpt.

- **Hyran** förmedlas i värdens namn och för värdens räkning. Att hyra ut förvaringsutrymme räknas som momsfri uthyrning av fastighet, och privata värdar som hyr ut parkering ligger normalt under momsgränsen på 120 000 kr om året. Spazia tar därför ingen moms på hyran (Stripes skattekod `txcd_00000000`, ej skattepliktig).
- **Spazias serviceavgift** (15 % från hyresgästen) är Spazias egen tjänst: 25 % moms ingår (skattekod `txcd_20030000`).
- **Värdens avgift** (5 %) dras från överföringen till värden. Momsen på den (20 % av avgiften, alltså 25 % ovanpå) bokförs av er. Stripe räknar inte ut den, eftersom den inte står på någon faktura. Underlaget finns i `fees_withheld` i `private.dac7_report`.
- **Ingen skatt dras** från utbetalningarna. Värdarna deklarerar själva sina hyresintäkter, och Spazia lämnar kontrolluppgift (se *Skatteverket* nedan). En värd som själv är momsregistrerad (till exempel ett företag som hyr ut parkering) ansvarar för sin egen moms.

Varje betalning har två rader: *Hyra till värden* och *Spazias serviceavgift*. Exempel: två däcksatser à 90 kr ger 208 kr i månaden, alltså 180 kr hyra (ingen moms) och 28 kr avgift, varav 5,60 kr moms. Fakturorna har sidfoten ”Hyran förmedlas i värdens namn och för värdens räkning. Moms tas ut på Spazias serviceavgift.” Den kan ändras med hemligheten `INVOICE_FOOTER`.

Slå på Stripe Tax så här (först i sandboxen):

1. *Settings → Business → Tax details* (eller fakturainställningarna): lägg in Spazias momsregistreringsnummer, så att det syns på fakturor och kvitton.
2. *Tax → Settings*: huvudkontorets adress.
3. *Tax → Registrations*: lägg till Sverige. Registrera er hos Skatteverket först. Stripe registrerar inte åt er.
4. Slå på i databasen:

```sql
insert into private.settings (key, value) values ('stripe_tax', 'on')
on conflict (key) do update set value = excluded.value;
```

Därefter räknar Stripe ut momsen på varje ny faktura, Checkout-betalning och nytt månadsschema. Gör det innan ni tar emot skarpa betalningar: månadsscheman som skapats innan dess fortsätter utan momsuträkning. Slå inte på `stripe_tax` innan registreringen finns. Då räknar Stripe ingen moms alls, utan att säga till. Stripe Tax kostar en avgift per transaktion, se Stripes prislista.

Återbetalningar av fakturor görs med kreditnotor, så att momsen också krediteras.

## Spazia Skydd (tillval för hyresgäster)

Hyresgäster kan lägga till Spazia Skydd när de skickar en förfrågan om förvaring per månad. Det kostar 5 % av månadspriset, dras som en egen rad (*Spazia Skydd*) på varje månadsfaktura och går till Spazia, inte till värden. Skadeanmälningar görs i appen på bokningen och mejlas till teamet (`public.protection_claims`).

**Avstängt från början.** Innan det slås på:

1. **Juridiken.** Att ta betalt för att ersätta andras skador kan räknas som försäkring, och det kräver tillstånd från Finansinspektionen eller en försäkringspartner som står för skyddet (Spazia blir då förmedlare). Bekräfta upplägget med en jurist eller försäkringsbolag.
2. **Momsen.** Skyddet räknas nu som Spazias egen tjänst med 25 % moms (`TAX_CODES.protection` i `supabase/functions/_shared/payments.ts`). Är det en försäkring via en partner är det momsfritt: ändra skattekoden innan ni slår på det.
3. **Villkoren.** Avsnittet *Spazia Skydd* i användarvillkoren beskriver vad som ersätts och undantagen. Gå igenom dem med partnern.

Slå på, och ändra andel och högsta belopp per uthyrning vid behov:

```sql
update private.settings set value = 'true' where key = 'protection_enabled';
update private.settings set value = '0.05' where key = 'protection_rate';   -- 5 %
update private.settings set value = '10000' where key = 'protection_cap';   -- kr per uthyrning
```

Andelen sparas på förfrågan när hyresgästen väljer skyddet, så en ändring påverkar bara nya förfrågningar.

## Skatteverket (DAC7)

Spazia är en plattformsoperatör och måste lämna kontrolluppgifter om värdarnas hyresintäkter (KU93, uthyrning av fast egendom) till Skatteverket senast den 31 januari varje år.

1. Anmäl Spazia som rapporteringsskyldig plattformsoperatör hos Skatteverket innan första rapporteringen ([Skatteverket: digitala plattformar](https://www.skatteverket.se/plattformsekonomi)).
2. Underlaget per värd, plats och kvartal finns i databasen:

```sql
select * from private.dac7_report where year = 2027 order by full_name, quarter;
```

## Var koden finns

- Databasen: `supabase/migrations/20261110000000_payments.sql`, `20261111000000_payments_billing.sql` och `20261112*_payments_vat*.sql` (momsuppdelningen)
- Stripe-funktionerna: `supabase/functions/` (betalschemat byggs i `_shared/schedule.ts`)
- Appen: `src/lib/app/payments.ts`, `src/components/app/host/PayoutsPage.tsx`, `src/components/app/renter/CardSection.tsx`, `src/components/app/renter/PaymentPanel.tsx`
