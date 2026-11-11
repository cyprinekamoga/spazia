# Betalningar med Stripe

Hyresgäster betalar med kort, Apple Pay eller Google Pay. Spazia tar emot betalningen via Stripe Connect och för över värdens del ett dygn efter att uthyrningen har börjat. Stripe betalar ut till värdens bankkonto varje måndag. Spazia behåller 15 % från hyresgästen och 5 % från värden, och står för Stripes avgifter.

Allt är byggt men avstängt tills stegen nedan är klara. Gör allt i **testläge** först.

## 1. Stripe-kontot

Det finns redan en **testmiljö (sandbox)** som jag skapade med Stripes CLI. Den går ut efter 7 dagar om den inte tas över: öppna länken du fick i chatten (eller kör `stripe sandboxes claim`) och logga in eller skapa ert Stripe-konto. Alternativt skapar ni kontot direkt på [stripe.com](https://stripe.com) och gör en egen sandbox under *Developers → Sandboxes*.

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
8. **Moms:** Spazia är inte momsregistrerat, så Stripe Tax är **avstängt** och ingen moms läggs på. Varje faktura får texten ”Momsbefriad. Spazia omfattas av undantaget från mervärdesskatt för små företag.” Be er redovisningskonsult bekräfta formuleringen. Den kan ändras med hemligheten `INVOICE_FOOTER`. Se *Moms senare* nedan.

## 2. Nycklar och webhooks

Klistra aldrig in nycklarna i en chatt. De läggs bara i [Supabase → Edge Functions → Secrets](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/functions/secrets).

1. **Begränsad nyckel** (`rk_…`), inte den hemliga (`sk_…`): *Developers → API keys → Create restricted key* med de här rättigheterna, och inget mer:
   - *Write:* Customers, Payment Methods, PaymentIntents, Checkout Sessions, Products, Prices, Subscriptions, Subscription Schedules, Refunds, Transfers, Connect: Accounts, Account Links, Login Links
   - *Read:* SetupIntents, Charges, Invoices, Events
   Lägg in den som `STRIPE_SECRET_KEY`. Saknas en rättighet svarar Stripe med 403. Testa därför allt i sandboxen först.
2. **Webhook för ert konto** (*Developers → Webhooks → Add destination*, *Your account*, *Snapshot*):
   - URL: `https://mtyhnfsceahvovauckkj.supabase.co/functions/v1/stripe-webhook`
   - Händelser: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`, `radar.early_fraud_warning.created`
   - Signing secret (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`
3. **Webhook för värdarnas konton** (*Add destination*, *Connected accounts*, payload *Thin*, samma URL):
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

## 4. Skarpt läge

Skapa en begränsad nyckel och samma två webhooks i skarpt läge, och byt de tre hemligheterna i Supabase. Inget annat behöver ändras.

## Så fungerar det

| | Förvaring per månad | Parkering per timme |
|---|---|---|
| Hyresgästen | Sparar ett kort innan förfrågan skickas | Betalar i Stripe Checkout när hen bokar |
| Första dragningen | När värden godkänner, som en engångsbetalning | Direkt, platsen hålls i 30 minuter |
| Följande månader | Stripe Billing: ett betalschema som börjar när månad 2 börjar och drar samma datum varje månad. Med slutdatum dras sista månaden per dag, sedan slutar det. Varje månad blir en faktura | – |
| Misslyckad betalning | Första månaden: mejl med betallänk, 48 timmar. Senare månader: Stripe försöker igen i en vecka och hyresgästen kan betala på fakturasidan, annars avslutas hyran efter sista betalda dagen | Platsen släpps |
| Avsluta | Före start: allt tillbaka och betalschemat stoppas. Efter start: hyran slutar när den betalda perioden är slut, inga fler dragningar | Gratis fram till 1 timme före start |
| Värden får betalt | Ett dygn efter att varje månad börjar, utbetalning på måndagar | Ett dygn efter start, utbetalning på måndagar |
| Tvist eller bedrägerivarning | Värdens del hålls kvar tills det är utrett | Samma |

Värdar fyller i namn, personnummer och adress under *Meny → Utbetalningar* och kopplar sedan sitt bankkonto hos Stripe. Utan kopplat bankkonto kan de inte godkänna förfrågningar, och deras parkeringar går inte att boka. Ett värdkonto är redo för pengar när Stripe har aktiverat förmågan att ta emot överföringar (`stripe_transfers`).

## Moms senare

När Spazia passerar momsgränsen och blir momsregistrerat:

1. *Tax → Settings*: lägg in huvudkontorets adress.
2. *Tax → Locations*: lägg till den svenska momsregistreringen (registrera först hos Skatteverket, Stripe registrerar inte åt er i Sverige).
3. Bestäm med er redovisningskonsult vad som är momspliktigt: Spazias avgift, värdarnas hyra och parkering kan behandlas olika. Då delas varje betalning upp i värdens del och Spazias avgift, med rätt skattekod på var och en, och `automatic_tax` slås på med Spazia som ansvarig. Priserna kan fortsätta visas inklusive moms.

Slå inte på Stripe Tax innan registreringen finns. Då räknar Stripe ingen moms alls, utan att säga till.

## Skatteverket (DAC7)

Spazia är en plattformsoperatör och måste lämna kontrolluppgifter om värdarnas hyresintäkter (KU93, uthyrning av fast egendom) till Skatteverket senast den 31 januari varje år.

1. Anmäl Spazia som rapporteringsskyldig plattformsoperatör hos Skatteverket innan första rapporteringen ([Skatteverket: digitala plattformar](https://www.skatteverket.se/plattformsekonomi)).
2. Underlaget per värd, plats och kvartal finns i databasen:

```sql
select * from private.dac7_report where year = 2027 order by full_name, quarter;
```

## Var koden finns

- Databasen: `supabase/migrations/20261110000000_payments.sql` och `20261111000000_payments_billing.sql`
- Stripe-funktionerna: `supabase/functions/` (betalschemat byggs i `_shared/schedule.ts`)
- Appen: `src/lib/app/payments.ts`, `src/components/app/host/PayoutsPage.tsx`, `src/components/app/renter/CardSection.tsx`, `src/components/app/renter/PaymentPanel.tsx`
