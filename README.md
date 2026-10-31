# Spazia

Förvaring hos grannen i Luleå. A peer-to-peer storage marketplace, starting with **Fas 0**: a validation site that collects host and renter interest for the launch campaign.

Research and the phased plan are in [`docs/research-och-plan.md`](docs/research-och-plan.md).

## What is in Fas 0

- **Swedish site at `/`, English at `/en`**, with hreflang links between them.
- **Pages:**
  - Start
  - Bli värd, with an earnings calculator and a host form
  - Hitta förvaring, with a renter waitlist form
  - Trygghet
  - Om oss
  - Integritetspolicy
- **SEO landing pages:** one per storage type (`/forvaring/dackforvaring` …) and one per area (`/omrade/gammelstad` …).
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
| Fonts | The same pairing as Neighbor: an editorial serif for headings and **Inter** for text. Neighbor's heading font, GT Ultra, is a paid font (Grilli Type), so the site uses **Fraunces**, a free look-alike, via `@fontsource-variable/fraunces`. If you buy a GT Ultra licence, add its `@font-face` and put it first in `--font-display` in `src/app/globals.css`. |
| Colours | Taken from the logo. Tokens are in `src/app/globals.css` (`--color-brand`, `--color-night` …). |

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
| Areas | `src/content/areas.ts` |
| Fees (15 % renter / 5 % host) and heated premium | `src/content/pricing.ts` |
| Contact email, company name, org.nr | `src/lib/site.ts` |
| URLs per language | `src/lib/routes.ts` |

When you add a category or area, its pages, footer links, form options and sitemap entries are generated automatically.

## Environment variables

Set these in Netlify under *Project configuration → Environment variables*. All are optional; see `.env.example`.

| Variable | Effect |
|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | Enables the cookie banner and the Meta Pixel |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sends leads to Supabase instead of Netlify Forms |

## Leads: Netlify Forms → Supabase

**Netlify Forms (default):** submissions appear in the Netlify dashboard under *Forms* (`host-lead`, `renter-lead`). The hidden form definitions live in `public/__forms.html`; keep them in sync if you add fields.

**Supabase:**

1. Create a project in region `eu-north-1` (Stockholm).
2. Run `supabase/migrations/20261031000000_lead_tables.sql`, either in the SQL editor or with `supabase db push`. The migration creates `host_leads`, `renter_leads` and a `lead_summary` view. With Row Level Security, the public key can only **insert**; it cannot read, update or delete.
3. Set the two Supabase env vars in Netlify and redeploy. The `status` and `notes` columns are for your own follow-up in the dashboard.

## Campaign links

Tag every ad and post so you can see which channel brings hosts and renters:

```
https://spazia.se/bli-vard?utm_source=facebook&utm_medium=paid&utm_campaign=villaagare-okt26
https://spazia.se/hitta-forvaring?vad=tyres&utm_source=blocket&utm_medium=listing&utm_campaign=dack-okt26
https://spazia.se/en/find-storage?vad=boxes&utm_source=campus&utm_medium=poster&utm_campaign=ltu-sommar
```

`?vad=<tyres|skis|snowmobile|bikes|boxes|car>` and `?omrade=<area slug>` pre-fill the renter form.

## Before launch – fill in

- [ ] Company name and org.nr in `src/lib/site.ts`. They are shown in the privacy policy.
- [ ] Set up the `hej@spazia.se` mailbox, or change the address in `src/lib/site.ts`.
- [ ] Point the `spazia.se` DNS to Netlify.
- [ ] Swap stock photos for your own pictures of Luleå garages after the first inspections (see *Photos*).
- [ ] Have the copy about tax, insurance and the standard agreement reviewed.
