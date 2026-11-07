# Slå på inloggningen (Supabase och Google)

Appen (`/logga-in` och värdläget på `/vard`) använder Supabase-projektet **spazia** (`mtyhnfsceahvovauckkj`, region Stockholm). Databasen, åtkomstreglerna och bildlagringen är redan på plats. Det här är stegen som bara ni kan göra, eftersom de kräver inloggning i Supabase och Google.

Gör steg 1–3 först. Steg 4 (Google) kan göras när som helst. Tills dess visar knappen "Fortsätt med Google" att Google inte är påslaget än.

## 1. Adresser (Supabase)

[Authentication → URL Configuration](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/auth/url-configuration)

- **Site URL:** `https://spazia.se`
- **Redirect URLs**, lägg till:
  - `https://spazia.se/**`
  - `https://*--spazia.netlify.app/**` (förhandsversioner hos Netlify)

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

## 5. Apple (senare)

Kräver ett Apple Developer-konto (cirka 99 USD per år).

1. Skapa ett *Services ID* och en *Sign in with Apple*-nyckel hos Apple.
2. Slå på Apple i *Authentication → Sign In / Providers → Apple*.

Knappen "Fortsätt med Apple" dyker upp på inloggningssidan av sig själv när Apple är påslaget.

## Bra att veta

- **nordvra är pausat.** Gratisplanen tillåter två aktiva projekt, så nordvra pausades för att Spazia skulle få plats. Det går att starta igen i Supabase, men då måste ett annat projekt pausas, eller så behöver ni Pro-planen.
- **Databasens ändringar** ligger i `supabase/migrations/`, från `20261105000000_host_app.sql` och framåt.
- **Värdens förslagspris:** en värd skriver sitt eget pris. Hyresgästen betalar 15 % serviceavgift ovanpå, och Spazia drar 5 % från utbetalningen (`src/content/pricing.ts`).
