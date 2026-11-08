# Betalningar med Stripe

Hyresgäster betalar med kort, Apple Pay eller Google Pay. Spazia tar emot betalningen via Stripe Connect och för över värdens del ett dygn efter att uthyrningen har börjat. Stripe betalar ut till värdens bankkonto varje måndag. Spazia behåller 15 % från hyresgästen och 5 % från värden, och står för Stripes avgifter.

Allt är byggt men avstängt tills stegen nedan är klara. Gör allt i **testläge** först.

## 1. Stripe-kontot

1. Skapa ett konto på [stripe.com](https://stripe.com): Sverige, enskild firma, ert organisationsnummer och företagets bankkonto.
2. **Connect:** välj *Connect → Get started → Marketplace* och kontotypen *Express*. Fyll i plattformsprofilen (vad Spazia gör, att värdarna är privatpersoner som hyr ut förvaring och parkering).
3. **Betalsätt:** *Settings → Payment methods*. Kort är på från början. Slå på Apple Pay och Google Pay.
4. **Kvitton:** *Settings → Customer emails*. Slå på mejl för lyckade betalningar och återbetalningar, så får hyresgästen kvitto från Stripe.
5. **Utseende:** *Settings → Branding*. Lägg in logga och färg (#2F6B75). Det syns på betalsidan och i värdarnas Stripe-sidor.

## 2. Nycklar och webhooks (testläge)

Klistra aldrig in nycklarna i en chatt. De läggs bara i Supabase.

1. **Hemlig nyckel:** *Developers → API keys → Secret key* (börjar med `sk_test_`). Lägg in den i [Supabase → Edge Functions → Secrets](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/functions/secrets) som `STRIPE_SECRET_KEY`.
2. **Webhook för ert konto:** *Developers → Webhooks → Add endpoint*
   - URL: `https://mtyhnfsceahvovauckkj.supabase.co/functions/v1/stripe-webhook`
   - Händelser: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Kopiera *Signing secret* (`whsec_…`) till Supabase som `STRIPE_WEBHOOK_SECRET`.
3. **Webhook för värdarnas konton:** lägg till en endpoint till med samma URL, men välj *Events on Connected accounts*.
   - Händelse: `account.updated`
   - Kopiera dess signing secret till Supabase som `STRIPE_CONNECT_WEBHOOK_SECRET`.

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

3. testar vi hela flödet med Stripes testkort `4242 4242 4242 4242` (valfritt datum framåt, valfri CVC) och kortet som kräver BankID-liknande bekräftelse, `4000 0025 0000 3155`.

Stäng av igen med `update private.settings set value = 'false' where key = 'payments_enabled';`. Appen fungerar då som innan, utan betalning.

## 4. Skarpt läge

Byt till de skarpa nycklarna (`sk_live_…`), skapa samma två webhooks i skarpt läge och byt de tre hemligheterna i Supabase. Inget annat behöver ändras.

## Så fungerar det

| | Förvaring per månad | Parkering per timme |
|---|---|---|
| Hyresgästen | Sparar ett kort innan förfrågan skickas | Betalar när hen bokar |
| Dragning | När värden godkänner, sedan samma datum varje månad | Direkt, platsen hålls i 30 minuter |
| Misslyckad betalning | Mejl med betallänk. 48 timmar för första månaden, 7 dagar för senare månader | Platsen släpps |
| Avsluta | Före start: allt tillbaka. Efter start: hyran slutar när den betalda perioden är slut | Gratis fram till 1 timme före start |
| Värden får betalt | Ett dygn efter att månaden börjar, utbetalning på måndagar | Ett dygn efter start, utbetalning på måndagar |

Värdar fyller i namn, personnummer och adress under *Meny → Utbetalningar* och kopplar sedan sitt bankkonto hos Stripe. Utan kopplat bankkonto kan de inte godkänna förfrågningar, och deras parkeringar går inte att boka.

## Skatteverket (DAC7)

Spazia är en plattformsoperatör och måste lämna kontrolluppgifter om värdarnas hyresintäkter (KU93, uthyrning av fast egendom) till Skatteverket senast den 31 januari varje år.

1. Anmäl Spazia som rapporteringsskyldig plattformsoperatör hos Skatteverket innan första rapporteringen ([Skatteverket: digitala plattformar](https://www.skatteverket.se/plattformsekonomi)).
2. Underlaget per värd, plats och kvartal finns i databasen:

```sql
select * from private.dac7_report where year = 2027 order by full_name, quarter;
```

## Var koden finns

- Databasen: `supabase/migrations/20261110000000_payments.sql`
- Stripe-funktionerna: `supabase/functions/`
- Appen: `src/lib/app/payments.ts`, `src/components/app/host/PayoutsPage.tsx`, `src/components/app/renter/CardSection.tsx`, `src/components/app/renter/PaymentPanel.tsx`
