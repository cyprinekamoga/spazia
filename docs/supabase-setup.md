# Slå på inloggningen (Supabase och Google)

Appen på app.spazia.se (inloggning, sök, hyresgäst- och värdläget) använder Supabase-projektet **spazia** (`mtyhnfsceahvovauckkj`, region Stockholm). Databasen, åtkomstreglerna och bildlagringen är redan på plats. Det här är stegen som bara ni kan göra, eftersom de kräver inloggning i Supabase och Google.

Gör steg 1–3 först. Steg 4 (Google) kan göras när som helst. Tills dess visar knappen "Fortsätt med Google" att Google inte är påslaget än.

## 1. Adresser (Supabase)

[Authentication → URL Configuration](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/auth/url-configuration)

- **Site URL:** `https://app.spazia.se` (appen ligger där, se [app-subdomain.md](app-subdomain.md))
- **Redirect URLs**, lägg till:
  - `https://app.spazia.se/**`
  - `https://spazia.se/**`
  - `https://*--spazia-app.netlify.app/**` (förhandsversioner av appen hos Netlify)

## 2. Mejl via Strato (Supabase)

Utan eget mejlkonto kommer mejlen från "Supabase Auth" och når bara medlemmar i ert Supabase-team. Med Strato kommer de från "Spazia" och når alla.

[Authentication → Emails → SMTP Settings](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/auth/smtp). Slå på *Enable custom SMTP*:

| Fält | Värde |
|---|---|
| Sender email | `info@nordvra.se` (eller en `@spazia.se`-adress när den finns) |
| Sender name | `Spazia` |
| Host | `smtp.strato.de` |
| Port | `465` |
| Username | `info@nordvra.se` |
| Password | lösenordet till mejlkontot (skriv in det själv) |

Höj sedan gränsen i [Authentication → Rate Limits](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/auth/rate-limits), till exempel till 60 mejl i timmen.

## 3. Mejlmall med kod (Supabase)

Supabases standardmallar har bara en länk och ingen kod. Koden kommer med först när mallen innehåller `{{ .Token }}`.

Nya användare får mallen **Confirm signup**. Den som redan har ett konto får **Magic Link**. Ändra därför båda i [Authentication → Emails → Templates](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/auth/templates):

- **Subject:** `Din kod till Spazia: {{ .Token }}`
- **Body:** klistra in innehållet i [`email-templates/login.html`](email-templates/login.html).

## 4. Logga in med Google

Allt i Google görs i [Google Auth Platform](https://console.cloud.google.com/auth/overview).

1. Skapa ett projekt, till exempel "Spazia", och klicka *Get started*:
   - App name: `Spazia`.
   - Support email: `info@nordvra.se`.
   - Audience: *External*.
   - Contact information: `info@nordvra.se`.
2. [Branding](https://console.cloud.google.com/auth/branding):
   - Lägg till `spazia.se` under *Authorized domains*.
   - Home page: `https://spazia.se`.
   - Privacy policy: `https://spazia.se/integritetspolicy`.
3. [Data Access](https://console.cloud.google.com/auth/scopes): lägg till `openid`, `.../auth/userinfo.email` och `.../auth/userinfo.profile`. Lägg inte till fler, för då kräver Google en granskning.
4. [Clients → Create client](https://console.cloud.google.com/auth/clients/create). Välj typen *Web application*:
   - Authorized JavaScript origins: `https://spazia.se`
   - Authorized redirect URIs: `https://mtyhnfsceahvovauckkj.supabase.co/auth/v1/callback`
5. Kopiera *Client ID* och *Client secret*.
6. [Audience](https://console.cloud.google.com/auth/audience): klicka *Publish app*. Annars kan bara testanvändare som ni har lagt till logga in.
7. I Supabase: [Authentication → Sign In / Providers → Google](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/auth/providers?provider=Google). Slå på Google och klistra in de två värdena.

Knappen på sajten märker själv att Google är påslaget. Ingen ny driftsättning behövs.

Googles inloggningsruta visar `mtyhnfsceahvovauckkj.supabase.co` tills Google har godkänt namnet och loggan. Det ansöker ni om under [Verification](https://console.cloud.google.com/auth/verification), och det tar några arbetsdagar. Ett alternativ är en egen domän i Supabase, till exempel `auth.spazia.se`, men den kostar extra och kräver en betalplan.

## 5. Apple

Koden är klar: knappen "Fortsätt med Apple" dyker upp på inloggningssidan av sig själv när Apple är påslaget i Supabase. Det som behövs är ett Apple Developer-konto (99 USD per år) och de här stegen, ungefär 30 minuter.

**Medlemskap.** Gå med i [Apple Developer Program](https://developer.apple.com/programs/enroll/). Som organisation visas "Spazia" för användarna, men Apple kräver då ett D-U-N-S-nummer för bolaget (gratis, tar några dagar). Som privatperson går det fortare, men då visas ditt namn.

Allt nedan görs under [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).

1. **Team ID.** Står uppe till höger (tio tecken, till exempel `AB12CD34EF`). Skriv upp det.
2. **App ID.** *Identifiers → +* → *App IDs* → *App*. Beskrivning `Spazia`, Bundle ID (Explicit) `se.spazia.app`. Bocka i *Sign in with Apple* under Capabilities. Lämna fältet för server-notiser tomt. *Continue → Register*.
3. **Services ID.** *Identifiers → +* → *Services IDs*. Beskrivning `Spazia webb`, identifier `se.spazia.web`. *Register*. Öppna det igen, bocka i *Sign in with Apple* och klicka *Configure*:
   - Primary App ID: `se.spazia.app`
   - Domains and Subdomains: `mtyhnfsceahvovauckkj.supabase.co`
   - Return URLs: `https://mtyhnfsceahvovauckkj.supabase.co/auth/v1/callback`

   *Next → Done → Continue → Save*.
4. **Nyckel.** [Keys → +](https://developer.apple.com/account/resources/authkeys/list). Namn `Spazia inloggning`, bocka i *Sign in with Apple*, *Configure* → välj `se.spazia.app`. *Register* och ladda ner filen `AuthKey_XXXXXXXXXX.p8`. Den kan bara laddas ner en gång: spara den säkert (inte i git, inte i chatten). Skriv upp *Key ID*.
5. **Mejl till dolda adresser.** Användare kan välja att dölja sin e-post, och då får vi en adress som slutar på `@privaterelay.appleid.com`. För att våra mejl ska komma fram dit: [Services → Sign in with Apple for Email Communication → Configure](https://developer.apple.com/account/resources/services/list). Lägg till domänen `spazia.se` och de adresser vi skickar från (samma som `MAIL_FROM`/`SMTP_USER` i Netlify och avsändaren för inloggningskoder i Supabase). Domänen behöver SPF, vilket Strato redan har satt upp om mejlen kommer fram i dag.
6. **Hemlig nyckel till Supabase.** Öppna [Supabases guide för Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple#configuration-web-oauth) i Chrome eller Firefox (inte Safari) och använd verktyget längst ned i avsnittet *Configuration*. Fyll i Team ID, Services ID (`se.spazia.web`), Key ID och välj `.p8`-filen. Verktyget körs i webbläsaren och ingenting skickas iväg. Kopiera nyckeln det ger.
7. **Slå på i Supabase.** [Authentication → Sign In / Providers → Apple](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/auth/providers?provider=Apple). Slå på Apple. Client IDs: `se.spazia.web`. Secret Key: nyckeln från steg 6. *Save*.

Klart. Ladda om inloggningssidan i appen, så syns Apple-knappen. Ingen ny driftsättning behövs.

> **Var sjätte månad:** Apple godtar den hemliga nyckeln i högst sex månader. Lägg in en återkommande påminnelse i kalendern och gör om steg 6 och 7 med samma `.p8`-fil. Annars slutar Apple-inloggningen att fungera utan förvarning. Tappar ni `.p8`-filen, återkalla den under Keys och gör en ny (steg 4).

Apple skickar inte användarens namn till Supabase. Den som loggar in med Apple fyller i sitt förnamn i appen, precis som med e-postkod.

## 6. Mejl om förfrågningar och bokningar

Värden får ett mejl vid varje ny förfrågan och parkeringsbokning, och båda parter får mejl när en förfrågan besvaras eller något avbokas. Databasen köar mejlen (`private.notifications`) och skickar dem till funktionen `/api/notify` på spazia.se, som mejlar via Strato precis som väntelistan.

Adressen till funktionen ligger i databasen. Så länge den saknas väntar mejlen i kön, i högst ett dygn. Den sätts en gång, efter att sajten med funktionen är publicerad:

```sql
insert into private.settings (key, value) values ('notify_url', 'https://spazia.se/api/notify')
on conflict (key) do update set value = excluded.value;
```

Ett jobb i databasen (`spazia-retry-notifications`) försöker igen var tionde minut med mejl som inte gick iväg, högst fem gånger.

## Bra att veta

- **nordvra är pausat.** Gratisplanen tillåter två aktiva projekt, så nordvra pausades för att Spazia skulle få plats. Det går att starta igen i Supabase, men då måste ett annat projekt pausas, eller så behöver ni Pro-planen.
- **Databasens ändringar** ligger i `supabase/migrations/`, från `20261105000000_host_app.sql` och framåt.
- **Värdens förslagspris:** en värd skriver sitt eget pris. Hyresgästen betalar 15 % serviceavgift ovanpå, och Spazia drar 5 % från utbetalningen (`src/content/pricing.ts`).
