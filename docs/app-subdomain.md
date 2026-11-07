# Appen på app.spazia.se

Sajten är uppdelad i två Netlify-projekt som byggs från samma kod:

| Projekt | Adress | Innehåll |
|---|---|---|
| `spazia` | spazia.se | Landningssidorna, guiderna, formulären och admin |
| `spazia-app` | app.spazia.se | Inloggning, sök, annonser, hyresgäst- och värdläget |

Varje projekt bygger och driftsätter för sig. Ett fel i appen kan alltså inte ta ner landningssidan. Projekten hoppar dessutom över bygget när inget de använder har ändrats (`scripts/netlify-ignore.mjs`), så en ändring i appen bygger bara om appen.

I koden:
- **Landningssidornas filer** heter `page.tsx` och `layout.tsx`.
- **Appens filer** heter `page.app.tsx` och `layout.app.tsx` (i `src/app/(app)/`).
- **Vilket projekt som byggs** bestämmer `next.config.ts` utifrån projektnamnet eller `SPAZIA_TARGET=app`.

Lokalt körs landningssidan med `npm run dev` (port 3000) och appen med `npm run dev:app` (port 3001).

## Engångsinställningar

### 1. Koppla projektet till GitHub (Netlify)

Projektet `spazia-app` finns redan och har variabeln `SPAZIA_TARGET=app`.

1. Öppna [spazia-app i Netlify](https://app.netlify.com/projects/spazia-app).
2. Gå till *Project configuration → Build & deploy → Continuous deployment* och välj *Link repository*.
3. Välj GitHub och `cyprinekamoga/spazia`.
4. Välj grenen `claude/cool-newton-ho1izp` som *Branch to deploy*.

Byggkommandot och mappen läses från `netlify.toml`, så resten kan lämnas som det är.

### 2. Domänen app.spazia.se (Netlify och Strato)

1. I `spazia-app`: *Domain management → Add a domain* och skriv `app.spazia.se`.
2. Hos Strato: gå till domänen spazia.se, skapa subdomänen `app` och ge den en **CNAME**-post som pekar på `spazia-app.netlify.app`.
3. Vänta tills Netlify har bekräftat domänen och skapat HTTPS-certifikatet. Det brukar ta från några minuter upp till en timme.

### 3. Inloggningen (Supabase)

[Authentication → URL Configuration](https://supabase.com/dashboard/project/mtyhnfsceahvovauckkj/auth/url-configuration):

- **Site URL:** `https://app.spazia.se`
- **Redirect URLs**, lägg till `https://app.spazia.se/**`. Behåll de gamla.

Google behöver inga ändringar, eftersom inloggningen går via Supabase.

### 4. Publicera

Push:a koden. Sedan:
- spazia.se länkar "Logga in" och sökningen till app.spazia.se.
- Gamla adresser som `spazia.se/vard` och `spazia.se/logga-in` skickas vidare till app.spazia.se.
