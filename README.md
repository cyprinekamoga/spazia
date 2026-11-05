# Spazia

Förvaring och parkering hos grannen. A peer-to-peer storage and parking marketplace for all of Sweden, opening city by city. It starts with **Fas 0**: a validation site that collects host and renter interest.

**All of Sweden:** Spazia is open everywhere in Sweden. There are no inspection visits: hosts are verified with BankID and photograph their own space for the listing.

Research and the phased plan are in [`docs/research-och-plan.md`](docs/research-och-plan.md).

## What is in Fas 0

- **Swedish site at `/`, English at `/en`**, with hreflang links between them.
- **Pages:**
  - Start
  - Bli värd, with an earnings calculator and a host form
  - Hitta förvaring, with the renter form and a price comparison
  - Trygghet
  - Om oss
  - Integritetspolicy
- **SEO landing pages:**
  - One per storage type, including parking (`/forvaring/dackforvaring`, `/forvaring/parkering` …). The short address `/parkering` redirects to the parking page.
  - One per featured city (`/stad/goteborg`, `/stad/lulea` …).
  - The old Luleå district pages (`/omrade/*`, `/en/area/*`) redirect to the Luleå city page (see `netlify.toml`).
- **Location search** in the home page hero: the visitor types a town and lands on the renter form with the town filled in.
- **Town field** in both forms: free text with suggestions. The town is tidied before it is stored ("lulea" becomes "Luleå"), so the admin page can count sign-ups per town.
- **Price comparison for renters** on the find page and every category page: pick what to store and for how long, and see the price next to a tyre hotel or a storage company. The competitor prices and their sources are in `src/content/market-prices.ts`; check them now and then.
- **Guides** at `/guider` and `/en/guides`: tyre storage costs, renting out your garage, tax, and summer storage for students. Text and sources are in `src/content/guides.ts`.
- **Admin page** at `/admin` (password protected):
  - **Översikt:** sign-ups per town, per storage type and per source.
  - **Anmälningar:** every sign-up with all answers, a status (Ny, Kontaktad, Publicerad, Matchad, Inte aktuell) and notes. You can also call, email, download a CSV or delete a sign-up (GDPR). Links in the team emails open the right sign-up.
  - **Mejla en stad:** email everyone in a town, e.g. "there are hosts near you now", in Swedish and English, with their name and town filled in. People already emailed about the same town are skipped.
- **Lead capture:** forms go to Netlify Forms by default, or to Supabase once it is configured (see below). Every lead stores its UTM source, campaign, referrer and landing page.
- **Meta Pixel:** loads only after cookie consent and fires a `Lead` event (`content_category: host | renter`) on each successful form.
- **Fully static:** `next build` exports plain HTML to `out/`.
- **Mobile first:**
  - Full-bleed photo heroes with the text at thumb height.
  - Swipeable category and season rows.
  - Step timelines.
  - A sticky action bar on phones. It hides while the form is on screen and shows the live calculator estimate on the host page.
  - Tap targets of at least 44 px.
  - Responsive WebP photos, so a phone downloads about 600 KB of images for the whole home page.

## Develop

```bash
npm install
```

```bash
npm run dev        # http://localhost:3000
```

```bash
npm run build      # static export to ./out
```

```bash
npm run lint && npm run typecheck
```

## Brand

| What | Details |
|---|---|
| Logo | Vector recreation of the Spazia mark (house, shield, keyhole; teal `#3f7c86` → slate `#243848`). The "Spazia" wordmark is Poppins SemiBold converted to outlines. Lives in `src/components/Logo.tsx` + `logoPaths.ts`; favicon in `src/app/icon.svg`. |
| Fonts | Two contrasting families. **Finlandica** by Helsinki Type Studio (free, SIL Open Font License) for all text and interface. **Fraunces**, an editorial serif, for headlines only. To use the studio's paid Allee instead, add its `@font-face` and put it first in `--font-sans` in `src/app/globals.css`. |
| Colours | Taken from the logo. Tokens are in `src/app/globals.css` (`--color-brand`, `--color-night` …). |

## Avoiding the "template look"

These are deliberate choices; please keep them:

- Never use one font for everything.
- Keep a real size and weight contrast between headlines and text.
- No middle-dot metadata (`a · b · c`).
- No arrows after every link or button.
- No tracked capital labels.
- No italic serif words inside sans headlines.
- Tabular figures are used only where numbers line up (the calculator and the price list).

## Photos

- **Licence:** all photos are from [Unsplash](https://unsplash.com/license), free for commercial use. Credits are listed on the About page (`/om-oss#bildkallor`).
- **Captions and credits:** in `src/content/photos.ts`.
- **Replace a photo** (e.g. with your own pictures from inspections):
  1. Put a JPG with the same name in `photos-src/` (git-ignored).
  2. Run the command below. It writes WebP files in five sizes to `public/images/` and updates `src/content/photo-manifest.json`.
  3. Update the credit in `src/content/photos.ts`.

```bash
npm run images
```

## Where to change things

| What | File |
|---|---|
| All Swedish copy | `src/content/sv.ts` |
| All English copy (same shape) | `src/content/en.ts` |
| Storage types, guide prices, units, SEO texts | `src/content/categories.ts` |
| Featured cities (each gets a page) and town suggestions | `src/content/cities.ts` |
| Fees (15 % renter / 5 % host) and heated premium | `src/content/pricing.ts` |
| Contact email, company name, org.nr | `src/lib/site.ts` |
| URLs per language | `src/lib/routes.ts` |

When you add a category, city or area, its pages, footer links, form options and sitemap entries are generated automatically.

**Adding a city page:** add the city to `src/content/cities.ts` with a short intro and a photo.

## Environment variables

Set these in Netlify under *Project configuration → Environment variables*. See `.env.example`. Changes take effect on the next deploy.

| Variable | Effect |
|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | Overrides the Meta Pixel ID (default `2604701499980220` in `src/lib/site.ts`). The pixel loads only after cookie consent. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Turns on cookie-free visitor statistics (Plausible). Also adds a paragraph about it to the privacy policy. |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Google Search Console verification code ("HTML tag" method). |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sends leads to Supabase instead of Netlify Forms. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_TO` | Emails on every registration (see below). All are set in Netlify for Strato except `SMTP_PASS`, which only the mailbox owner should enter. |
| `ADMIN_PASSWORD` | Password for `/admin`. Mark it as secret. Changing it logs everyone out. Without it, the admin page says it isn't switched on. |

## Emails on every registration

`netlify/functions/lead-emails.mts` runs for every verified Netlify Forms submission and sends:

1. **A notification to the team** (`MAIL_TO`, default info@nordvra.se). It is in Swedish, contains all answers, the town and the ad source, and *Reply-to* is the person who registered.
2. **A confirmation to the person** in their language, with what they sent. *Reply-to* is the team address. Turn it off with `MAIL_CONFIRMATION=off`.

The email text lives in `src/lib/lead-emails.ts`. The function uses SMTP, so it works with any email service. Common settings:

| Service | `SMTP_HOST` | `SMTP_PORT` | `SMTP_USER` / `SMTP_PASS` |
|---|---|---|---|
| **Strato** (used now) | `smtp.strato.de` | 465 | the address and the mailbox password |
| Google Workspace | `smtp.gmail.com` | 465 | the address and an *app password* |
| Microsoft 365 | `smtp.office365.com` | 587 | the address and its password (SMTP AUTH must be enabled for the mailbox) |
| Loopia | `mailcluster.loopia.se` | 587 | the address and its password |
| One.com | `send.one.com` | 465 | the address and its password |
| Brevo | `smtp-relay.brevo.com` | 587 | SMTP login and SMTP key from Brevo |
| Resend | `smtp.resend.com` | 465 | `resend` and an API key |

Without SMTP settings the function only logs a warning. Submissions are still stored in Netlify Forms. The emails are only sent when leads go through Netlify Forms (not when Supabase is configured).

## Google Search Console

1. In [Search Console](https://search.google.com/search-console), add a property for `spazia.se`.
2. Verify it, in one of two ways:
   - **Domain** property: add the TXT record Google gives you at your DNS provider.
   - **URL prefix** property: choose *HTML tag* and put the `content` value in `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
3. Under *Sitemaps*, submit `https://spazia.se/sitemap.xml`.

## Where the data lives

- **Netlify Forms** keeps every submission, as before (`host-lead`, `renter-lead`).
- **Netlify Blobs** (store `spazia`, EU region `eu-central-1`) holds what the admin page needs:
  - the sign-ups (written by `netlify/functions/lead-emails.mts`)
  - status, notes and emails sent

  You can browse it in Netlify under *Data & Storage → Blobs*. The code is in `src/server/`.
- Sign-ups made before the admin page existed are only in Netlify Forms.

The two functions are:
- `lead-emails` (runs on every form submission)
- `admin` (`/api/admin/*`, needs the admin login)

## Leads: Netlify Forms → Supabase

**Netlify Forms (default):** submissions appear in the Netlify dashboard under *Forms* (`host-lead`, `renter-lead`). The `city` column shows the town; you can download the submissions as CSV to count them per town. The hidden form definitions live in `public/__forms.html`; keep them in sync if you add fields.

**Supabase:**

1. Create a project in region `eu-north-1` (Stockholm).
2. Run the files in `supabase/migrations/` in order, either in the SQL editor or with `supabase db push`. The migrations create `host_leads`, `renter_leads`, a `lead_summary` view (leads per day and source) and a `city_demand` view (hosts and renters per town). With Row Level Security, the public key can only **insert**; it cannot read, update or delete.
3. Set the two Supabase env vars in Netlify and redeploy. The `status` and `notes` columns are for your own follow-up in the dashboard.

## Campaign links

Tag every ad and post so you can see which channel brings hosts and renters:

```
https://spazia.se/bli-vard?utm_source=facebook&utm_medium=paid&utm_campaign=villaagare-okt26
https://spazia.se/hitta-forvaring?vad=tyres&utm_source=blocket&utm_medium=listing&utm_campaign=dack-okt26
https://spazia.se/en/find-storage?vad=boxes&utm_source=campus&utm_medium=poster&utm_campaign=ltu-sommar
https://spazia.se/parkering?utm_source=facebook&utm_medium=paid&utm_campaign=parkering-nov26
https://spazia.se/hitta-forvaring?ort=Uppsala&vad=boxes&utm_source=instagram&utm_medium=paid&utm_campaign=uppsala-flytt
```

`?vad=<tyres|skis|snowmobile|bikes|boxes|car|parking>` and `?ort=<town>` pre-fill the renter form. `?ort=` also pre-fills the host form.

## Before launch – fill in

- [x] Contact address: info@nordvra.se (in `src/lib/site.ts`).
- [x] Point the `spazia.se` DNS to Netlify.
- [ ] Org.nr in `src/lib/site.ts`. It is shown in the privacy policy.
- [ ] SMTP settings in Netlify, so the registration emails are sent.
- [ ] Plausible account, then set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=spazia.se`.
- [ ] Google Search Console verification and sitemap.
- [ ] Swap stock photos for your own pictures (see *Photos*).
- [ ] Have the copy about tax, insurance and the standard agreement reviewed.
