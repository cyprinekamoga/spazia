# Slå på inloggningen (Supabase och Google)

Appen (`/logga-in` och värdläget på `/vard`) använder Supabase-projektet **spazia** (`mtyhnfsceahvovauckkj`, region Stockholm). Databasen, åtkomstreglerna och bildlagringen är redan på plats. Det här är stegen som bara ni kan göra, eftersom de kräver inloggning i Supabase och Google.

Gör steg 1–3 innan sajten driftsätts. Steg 4 (Google) kan göras när som helst. Tills dess visar knappen "Fortsätt med Google" att Google inte är påslaget än.

## 1. Adresser (Supabase)

*Authentication → URL Configuration*

- **Site URL:** `https://spazia.se`
- **Redirect URLs**, lägg till:
  - `https://spazia.se/**`
  - `https://*--spazia.netlify.app/**` (förhandsversioner hos Netlify)

## 2. Mejl via Strato (Supabase)

Supabases egen mejltjänst skickar bara till medlemmar i ert Supabase-team och bara ett par mejl i timmen. Riktiga användare behöver ert eget mejlkonto.

*Authentication → Emails → SMTP Settings → Enable custom SMTP*

| Fält | Värde |
|---|---|
| Sender email | `info@nordvra.se` (eller en `@spazia.se`-adress när den finns) |
| Sender name | `Spazia` |
| Host | `smtp.strato.de` |
| Port | `465` |
| Username | `info@nordvra.se` |
| Password | lösenordet till mejlkontot (skriv in det själv) |

Höj sedan gränsen för antal mejl i *Authentication → Rate Limits*, till exempel 60 i timmen.

## 3. Mejlmall med kod (Supabase)

Inloggningssidan låter användaren antingen klicka på länken i mejlet eller skriva in en sexsiffrig kod. Koden är smidigast på mobilen, men den kommer bara med om mallen innehåller `{{ .Token }}`.

*Authentication → Emails → Templates*. Ändra både **Magic Link** och **Confirm signup**:

- **Subject:** `Din kod till Spazia: {{ .Token }}`
- **Body:** klistra in innehållet i [`email-templates/login.html`](email-templates/login.html).

## 4. Logga in med Google

1. Öppna [Google Cloud Console](https://console.cloud.google.com/) och skapa ett projekt, till exempel "Spazia".
2. *APIs & Services → OAuth consent screen*:
   - Välj *External*.
   - Appnamn: `Spazia`.
   - Supportmejl: `info@nordvra.se`.
   - Domän: `spazia.se`.
   - Integritetspolicy: `https://spazia.se/integritetspolicy`.
3. *Credentials → Create credentials → OAuth client ID*. Välj typen *Web application*:
   - Authorized JavaScript origins: `https://spazia.se`
   - Authorized redirect URIs: `https://mtyhnfsceahvovauckkj.supabase.co/auth/v1/callback`
4. Kopiera *Client ID* och *Client secret*.
5. I Supabase: *Authentication → Sign In / Providers → Google*. Slå på Google och klistra in de två värdena.

Knappen på sajten märker själv att Google är påslaget. Ingen ny driftsättning behövs.

## 5. Apple (senare)

Kräver ett Apple Developer-konto (cirka 99 USD per år).

1. Skapa ett *Services ID* och en *Sign in with Apple*-nyckel hos Apple.
2. Slå på Apple i *Authentication → Sign In / Providers → Apple*.

Knappen "Fortsätt med Apple" dyker upp på inloggningssidan av sig själv när Apple är påslaget.

## Bra att veta

- **nordvra är pausat.** Gratisplanen tillåter två aktiva projekt, så nordvra pausades för att Spazia skulle få plats. Det går att starta igen i Supabase, men då måste ett annat projekt pausas, eller så behöver ni Pro-planen.
- **Databasens ändringar** ligger i `supabase/migrations/`, från `20261105000000_host_app.sql` och framåt.
- **Värdens förslagspris:** en värd skriver sitt eget pris. Hyresgästen betalar 15 % serviceavgift ovanpå, och Spazia drar 5 % från utbetalningen (`src/content/pricing.ts`).
