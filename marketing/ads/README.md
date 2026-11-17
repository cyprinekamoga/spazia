# Ad campaign: Luleå, winter 2026

First paid campaign on Instagram and Facebook. It focuses on **hosts**, because renters need spaces to find, plus a smaller campaign for **tyres** while the summer tyres are fresh off the cars.

## Before you start

1. **Fix the fee in the database.** The site says 10 %, but the database still charges 15 %. Run the three lines in Supabase → SQL Editor (they're in `supabase/migrations/20261115000000_service_fee_10.sql`). Otherwise the first bookings from the ads will cost more than the price shown.
2. Connect the Instagram account to a Meta Business account (business.facebook.com) and add a payment method.
3. The Meta Pixel is already on spazia.se. It only counts visitors who accept cookies, so Meta will report fewer leads than really came in. The real number is in Spazia's admin (see "Measuring").

## The files (`out/`)

| File | Use |
|---|---|
| `spazia-host-feed-1080x1350.png` | Host ad, Instagram/Facebook feed |
| `spazia-host-story-1080x1920.png` | Host ad, Stories and Reels |
| `spazia-tyres-feed-1080x1350.png` | Tyre ad, feed |
| `spazia-tyres-story-1080x1920.png` | Tyre ad, Stories and Reels |
| `spazia-prices-feed-1080x1350.png` | Price list: a regular post to pin on the profile, or a carousel card |
| `spazia-prices-story-1080x1920.png` | Price list for Stories (save it as a highlight) |
| `spazia-reel-1080x1920.mp4` | 15-second Reel, no sound. Post it as a Reel with music from Instagram's library, then boost it |

To change a text or price: edit `ads.html` or `reel.html` and run `node marketing/ads/render.mjs` (images) or `node marketing/ads/render-reel.mjs` (video). Both need Playwright with Chromium; the video also needs ffmpeg.

## Campaign 1: Hosts in Luleå (most of the budget)

| Setting | Value |
|---|---|
| Objective | Traffic, optimised for landing page views. Switch to Leads once there are ~20 leads a week, so Meta has enough data to learn from |
| Location | Luleå + 15 km, "people living in this location" |
| Age | 25–65, no interests (let Meta find the audience) |
| Placements | Advantage+ placements. Use "customise asset per placement": the feed image for Feeds, the story image for Stories and Reels |
| Budget | 75 kr a day for 7 days (about 525 kr) |
| Link | `https://spazia.se/bli-vard` (the host page: calculator, how it works, and the button to create an account) |
| URL parameters | `utm_source=meta&utm_medium=paid&utm_campaign=vardar-lulea&utm_content={{ad.name}}` |
| Button | "Läs mer" |

**Primary text, version A** (test against version B):
> Har du ett garage, en källare eller ett förråd med plats över? Hyr ut ett hörn till en granne i Luleå. 8 däcksatser à 65 kr i månaden ger dig ca 450 kr, efter Spazias avgifter. Du sätter priset och godkänner varje hyresgäst.

**Primary text, version B:**
> Ett tomt hörn i garaget kan bli ca 450 kr i månaden. Gratis att annonsera, betalning och hyresavtal sköts i appen och du godkänner varje hyresgäst.

**Headline:** Tjäna pengar på ditt tomma utrymme
**Description:** Gratis att annonsera

## Campaign 2: Tyre storage in Luleå

| Setting | Value |
|---|---|
| Objective | Traffic, optimised for landing page views |
| Location, age, placements | As campaign 1 (age 20–65) |
| Budget | 50 kr a day for 7 days (about 350 kr) |
| Link | `https://spazia.se/forvaring/dackforvaring` (price, a calculator comparing with a tyre hotel, and the button "Jag behöver förvaring", which leads to creating an account and searching in the app) |
| URL parameters | `utm_source=meta&utm_medium=paid&utm_campaign=dack-lulea&utm_content={{ad.name}}` |
| Button | "Läs mer" |

There are few spaces in Luleå so far. Visitors who find nothing in the app see a form to watch Luleå ("Bevaka"), and get an email when a space there is published. There are no forms on the website any more. Those leads are also the best argument when you talk to new hosts.

**Primary text, version A:**
> Sommardäcken i hallen igen? Förvara dem hos en granne i Luleå för ca 65 kr i månaden, ca 390 kr för hela vintern. Hämta dem när du vill. Ingen bindningstid.

**Primary text, version B:**
> Byter du hjul själv? Då behöver du inte betala för ett däckhotell. Förvara däcken hos en granne i Luleå för ca 65 kr i månaden.

**Headline:** Däckförvaring hos grannar i Luleå
**Description:** Ingen bindningstid

## Organic posts (free)

**Reel caption:**
> Grejer som tar plats hemma? Din granne kanske har plats över 🏠 Och har du själv ett tomt garage kan du tjäna pengar på det. Länk i bion 👆
> #luleå #förvaring #däckförvaring #garage #hyraut #extrainkomst

**Price list caption:**
> Vad kostar det att förvara saker hos en granne i Luleå? Däck ca 65 kr, flyttlådor ca 115 kr per m², p-plats ca 280 kr i månaden. Värden sätter priset och det finns ingen bindningstid. Länk i bion 👆

## Measuring

- **Renters:** the website has no forms any more. A click on "Jag behöver förvaring" or "Skapa konto och sök" counts as a *Lead* (type renter) for the Meta Pixel and Plausible; the accounts and their alerts are in the app admin. Earlier waitlist sign-ups are under Leads, with the campaign in the "Källa" column.
- **Hosts:** the "Jag har plats över" / "Lägg upp din plats" buttons go straight to creating an account in the app, with no form on the site. A click counts as a *Lead* for the Meta Pixel and Plausible. The sign-ups themselves are in the admin page under Users and Listings.
- **Ads Manager:** after 3–4 days, look at click-through rate and cost per landing page view for each ad. Pause the weaker version (A or B) and keep the better one.
- **What counts as success:** for the host campaign, the number of new hosts who publish a space. For the tyre campaign, new accounts that search or save an alert.
- Sign-ups in the app (app.spazia.se) aren't sent to Meta, only the click to sign up. That could be added later, so Meta can optimise for real sign-ups.

## Rules for the texts

- Prices are guide prices from `src/content/categories.ts`; always write "ca" and keep "Värden sätter priset" or "Du sätter priset" where the price is the point.
- The 450 kr: 8 sets × 65 kr, minus the 10 % renter fee (59 kr per set to the host) and the 5 % host fee (56 kr) ≈ 450 kr.
- Compare with tyre hotels only by saying what each price includes (a tyre hotel includes the wheel change). Swedish marketing law requires a fair comparison.
- Don't promise BankID or damage protection until they are live.
