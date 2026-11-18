# Notice-board posters (anslagstavlor)

Three A4 posters with QR codes, for notice boards at ICA, Coop, libraries, laundry rooms, community halls and student housing.

## The files (`out/`)

| File | Who it's for | Where to put it up |
|---|---|---|
| `spazia-affisch-host-A4.pdf` | **Hosts**: "Har du plats över? Låt den tjäna pengar." ca 450 kr a month, 3 steps | Villa and terraced-house areas, garage areas, hardware stores, ICA/Coop near houses |
| `spazia-affisch-renter-A4.pdf` | **Renters**: "Sommardäcken i hallen igen?" prices for tyres, storage, parking, bikes | Apartment buildings (laundry rooms, entrances), student housing, campus |
| `spazia-affisch-tabs-A4.pdf` | **Both**, with 8 tear-off strips at the bottom | Shared boards: ICA, Coop, libraries, community halls, Pressbyrån |
| `spazia-affischer-alla-A4.pdf` | All three in one file | Print a stack at once |
| `*.png` | The same posters as images (300 dpi) | Preview, or send to a print shop |
| `spazia-affischer-oversikt.jpg` | All three side by side, small | A quick look on the phone |

## QR codes

| Code | Opens |
|---|---|
| Host poster, big code | `https://spazia.se/bli-vard?utm_source=affisch&utm_medium=qr` (the host page, with the button to create an account) |
| Renter and tear-off posters, big code | `https://spazia.se/?utm_source=affisch&utm_medium=qr` |
| Small code on every poster | `https://www.instagram.com/_spazia_/` |

The `utm_source=affisch` part shows visits from the posters as their own source in the statistics, so you can see whether they work. The codes are in `qr/` as SVG (sharp at any size). All six were checked by decoding them from the finished posters.

## Printing

- Print at **100 % / "Actual size"**, not "Fit to page". Text and codes keep 10 mm from the edges, so a normal office or home printer works. The photo runs to the edge; a white margin from the printer is fine.
- Colour makes a big difference on a busy board. Thicker paper (120–160 g) stays flat and lasts longer.
- A3 works too: print the PDF at 141 % or choose A3 at the print shop. The QR codes get easier to scan from a distance.
- Tear-off poster: cut along the dashed lines between the strips with scissors, up to the line across, so people can tear one off.

## Putting them up

- Ask the store or the housing association first. Many boards are only for local notices and remove ads without permission. "A local service for neighbours" usually goes down well.
- Put them at eye level, where people wait (laundry room, entrance, by the tills).
- Check after a couple of weeks: replace torn posters and strips, and count the poster visits in the statistics.

## Changing a text or price

Edit `posters.html` and run `node marketing/posters/render.mjs` from the repository root (needs Playwright with Chromium). Open `posters.html?p=host` (or `renter`, `tabs`) in a browser to see one poster; with no `?p=` all three show side by side.

The texts follow the same rules as the ads (`marketing/ads/README.md`): prices are guide prices with "ca", the host decides the price, no promises of BankID or damage protection, and no made-up reviews. The 450 kr: 8 tyre sets × 65 kr, minus the 10 % renter fee and the 5 % host fee. Photos are from Unsplash (free for commercial use, including print).
