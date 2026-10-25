# Photography by location — design

Date: 2026-10-25 · Status: design approved in chat ("Yes pl."), awaiting review of this document

## Why

The Photography page is one long page of series. As places are added it gets longer, and a
link can only point at the whole page. Ranjith wants a page per place and per visit, so he can
share "Swansea" or just "Swansea, May 2026" and people see only those photos.

## Decisions (from the conversation)

- The Photography page becomes **location cards**, each with its key photo as the background.
- A card opens the **location page**: every visit to that place, grouped by **month and year**,
  newest first.
- Each visit has its own **visit page** with only its photos.
- Location pages and visit pages each have a **Share** button and their own address.
- **People:** only crowd and scene photos are published. A photo where one recognisable stranger
  is the clear subject (a close street portrait) is left out. Captions describe the scene, never
  the person. This also removes two existing Florence photos ("Portrait, Florence", "Soldiers on
  duty").
- Old links (`photography.html`, `photography.html#tenby-4`, `#12`) keep working.

## Addresses

| Page | Address |
|---|---|
| Location cards | `/photography/` |
| A location | `/photography/<place>/` (e.g. `/photography/swansea/`) |
| A visit | `/photography/<place>/<yyyy-mm>/` (e.g. `/photography/swansea/2026-05/`) |
| A photo | the page address plus `#<n>` (visit page) or `#v<yyyy-mm>-<n>` (location page) |

Every page is a real static page, so a shared link previews with that place's key photo and a
title like "Swansea · May 2026 — Photography".

`photography.html` becomes a small forwarding page: `#tenby-4` → `/photography/tenby/2026-08/#4`,
a bare `#12` (old Florence links) → `/photography/florence/2026-04/#12` (renumbered to match the
new order), no hash → `/photography/`. A plain link fallback is shown if scripts are off.

## Places at launch

| Place | Country | Visit | Photos | Camera |
|---|---|---|---|---|
| Swansea | Wales | May 2026 | 26 | Sony ZV-E10, iPhone 15 |
| Milan | Italy | April 2026 | 10 | Sony ZV-E10 |
| Florence | Italy | April 2026 | 18 | Sony ZV-E10 |
| Gower | Wales | June 2026 | 7 | iPhone 15 |
| Tenby | Wales | August 2026 | 19 | Sony ZV-E10 |

Cards are ordered by latest visit, newest first.

## Pages

- **Location cards:** a grid; each card is a link with the key photo filling it (cropped to a
  wide frame), a dark gradient for legibility, the place name, country, and
  "1 visit · 26 photos · May 2026". Phones: one column.
- **Location page:** title, country, Share; then each visit as a section headed
  "May 2026 · 26 photos" (heading links to the visit page) with its own small Share link, then
  the photo grid. Camera(s) noted per visit.
- **Visit page:** "Swansea · May 2026", a back link to Swansea, Share, the camera line, the grid.
- **Grid and viewer:** the current grid (wide / half / third tiles, upright photos in an upright
  frame) and the current full-size viewer (arrows, swipe, Esc, B&W toggle). The viewer moves
  within one visit.
- **Share:** `navigator.share({title, url})` where available, otherwise copy the address and show
  "Link copied".
- Same site header and footer as other pages; Photography is the active tab. Every page that
  links to Photography is updated to `/photography/`.

## Data and build

- One data file, `scripts/photos.json`: places (id, name, country, key photo) → visits
  (`yyyy-mm`) → photos (file stem, caption, camera, optional `tall`/size, width/height).
- `scripts/build_photos.py` reads it and writes every page above, a 1200×630 preview image per
  location and visit (`assets/og/photo-<place>[-<yyyy-mm>].jpg`), and the sitemap entries. It
  fails if a referenced image is missing, an id repeats, a month is malformed, or a key photo is
  not in that place.
- Web images stay in `assets/photos/web/` (800 px preview plus up to 1600 px full). New photos
  are named `<place>-<yyyy-mm>-<nn>-<w>.webp`, made from the originals at quality 70 with no
  location data.
- Adding photos later = add entries to `photos.json`, make the web images, run the build.

## Errors and edge cases

- Unknown or old hash on `photography.html` → `/photography/`.
- A visit hash out of range → page opens normally, no viewer.
- No `navigator.share` and clipboard blocked → show the address to copy.

## Testing

- `scripts/test_build_photos.py` (pytest): data validation errors, page count, addresses, the
  forwarding map for old links, sitemap entries, every image referenced exists.
- `scripts/check_photography.mjs` (Playwright): cards link correctly; location page shows all
  visits; visit page shows only its photos; viewer opens from `#n` and stays in the visit; Share
  copies the right address; old `photography.html#tenby-4` lands on Tenby photo 4; phone layout
  fits (no sideways scroll).
- The site health check (axe contrast/labels, broken links, phone overflow) on all new pages.

## Out of scope

Maps, per-photo pages, EXIF display, comments or likes on photos, an upload tool.
