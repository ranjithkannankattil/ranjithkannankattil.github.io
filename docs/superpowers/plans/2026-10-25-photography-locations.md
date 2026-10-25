# Photography by Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single Photography page with location cards → location pages → visit (month) pages, each shareable.

**Architecture:** One data file (`scripts/photos.json`) describes places, visits and photos. A Python build script validates it and writes static pages under `photography/`, preview images under `assets/og/`, and sitemap entries. The existing grid and viewer CSS/JS are reused, extended for cards, visit headings, share buttons and the new hash forms. `photography.html` becomes a forwarder for old links.

**Tech Stack:** Python 3 + Pillow (build, images), pytest; vanilla HTML/CSS/JS; Playwright (browser checks).

**Spec:** `docs/superpowers/specs/2026-10-25-photography-locations-design.md`

## Global Constraints

- Addresses: `/photography/`, `/photography/<place>/`, `/photography/<place>/<yyyy-mm>/`; photo hash `#<n>` on visit pages, `#v<yyyy-mm>-<n>` on location pages.
- Generated pages use root-absolute paths (`/css/...`, `/js/...`, `/assets/...`); the site is served at the domain root.
- People rule: no close portraits of recognisable strangers; captions describe the scene, never the person. Florence drops "Portrait, Florence" (DSC05418) and "Soldiers on duty" (DSC05443).
- New web images: `<place>-<yyyy-mm>-<nn>-<w>.webp`, 800 px preview + full up to 1600 px, WebP quality 70, no EXIF/GPS, white print border trimmed.
- Places at launch: Swansea (Wales, 2026-05, 26), Milan (Italy, 2026-04, 10), Florence (Italy, 2026-04, 18), Gower (Wales, 2026-06, 7), Tenby (Wales, 2026-08, 19). Cards ordered by latest visit, newest first.
- Copy: card line `"<n> visit(s) · <n> photos · <Month YYYY>"`; visit heading `"<Month YYYY> · <n> photos"`; visit page title `"<Place> · <Month YYYY>"`; share fallback status `"Link copied"`.
- Phone controls and other pages unaffected; health check (axe WCAG 2 A/AA, broken links, phone overflow) clean on all new pages.
- Commits: author Claude, both attribution lines; `git pull --rebase` before push.

## Review Focus

1. An old Florence link `photography.html#12` after two Florence photos were removed: must land on the same photo (renumbered), not a neighbour. Task 2 test `old_links_follow_removed_photos`.
2. A visit page opened with `#99`: page shows normally, no viewer, no error. Task 3 check `out of range hash`.
3. A place with two visits: the location page shows both, newest first, and the viewer never crosses from one visit into the other. Task 3 check `viewer stays in visit` (uses a test fixture with two visits).
4. Captions with apostrophes/ampersands (e.g. "Worm's Head", "Food & Drink") render as text and in `alt`/`aria-label` without breaking HTML. Task 2 test `captions_are_escaped`.
5. Clipboard blocked and no `navigator.share`: Share shows the address instead of failing silently. Task 3 check `share fallback shows address`.

---

### Task 1: Photo data and validation

**Files:**
- Create: `scripts/photos.json`, `scripts/photo_data.py`, `scripts/prep_photos.py`, `scripts/test_build_photos.py`
- Create: new web images `assets/photos/web/{swansea-2026-05,milan-2026-04}-NN-{800,full}.webp`

**Interfaces:**
- Produces: `load(path: str) -> dict`; `validate(data: dict, root: Path) -> list[str]` (empty = valid); `month_label("2026-05") -> "May 2026"`.
- Data shape: `{"places":[{"id","name","country","key":"<file stem>","visits":[{"month":"yyyy-mm","photos":[{"stem","full","w","h","caption","camera","size":"s6|s3|s2","tall":bool,"old":"<old set>-<n>"|null}]}]}]}`; preview file is `<stem>-800.webp`, full is the `full` filename.
- `prep_photos.py <place> <yyyy-mm> <original>...` writes the web images (trim border, 800 + ≤1600, q70) and prints JSON photo stubs.

- [ ] **Step 1: Failing tests** — `test_valid_site_data` (the real `photos.json` validates with no errors, 5 places, counts 26/10/18/7/19); `test_missing_image_reported`; `test_duplicate_place_reported`; `test_bad_month_reported` ("2026-5"); `test_key_photo_must_belong_to_place`; `test_month_label` ("2026-04" → "April 2026").
- [ ] **Step 2: Run** `cd scripts && python3 -m pytest test_build_photos.py -q` → fails (module missing).
- [ ] **Step 3: Implement** `photo_data.py`; run `prep_photos.py` for Swansea (26, order chosen for flow, key = Sail Bridge wide shot) and Milan (10, key = butterfly sculpture wide shot); write `photos.json` with existing Tenby/Gower/Florence entries (Florence order kept minus DSC05418/DSC05443; `old` set to the original `florence-<n>`/`tenby-<n>`/`gower-<n>`).
- [ ] **Step 4: Run** the tests → pass.
- [ ] **Step 5: Commit** — `"Photography: photo data and validation"`.

### Task 2: Page builder

**Files:**
- Create: `scripts/build_photos.py`; extend `scripts/test_build_photos.py`
- Generated: `photography/index.html`, `photography/<place>/index.html`, `photography/<place>/<yyyy-mm>/index.html`, `assets/og/photo-<place>.jpg`, `assets/og/photo-<place>-<yyyy-mm>.jpg`, `js/photo-links.js` (old-link map), sitemap entries

**Interfaces:**
- Consumes: Task 1 `load`, `validate`, `month_label`.
- Produces: `build(data: dict, root: Path) -> list[Path]` (files written); `old_links(data: dict) -> dict[str, str]` (`"tenby-4"` → `"/photography/tenby/2026-08/#4"`, `"florence-12"`, bare `"12"` → Florence); pages carry `<section class="ph-set" id="v<yyyy-mm>">`, `.ph` figures identical to today's markup, `<button class="ph-share" data-url data-title>`, `<a class="pl-card">` cards.

- [ ] **Step 1: Failing tests** — `test_builds_every_page` (1 + 5 + 5 pages exist); `test_visit_page_has_only_its_photos`; `test_location_page_newest_visit_first` (fixture with 2 visits); `test_cards_sorted_by_latest_visit` (Tenby first … Florence/Milan last); `test_og_image_1200x630`; `test_page_titles_and_og_url`; `test_sitemap_lists_new_pages_not_old`; `old_links_follow_removed_photos` (old `florence-12` → the new index of the same stem); `captions_are_escaped`.
- [ ] **Step 2: Run** → fail.
- [ ] **Step 3: Implement** with string templates (site header/footer copied from current page, root-absolute paths, Photography active); preview images = key photo centre-cropped to 1200×630, JPEG q82.
- [ ] **Step 4: Run** → pass; run the build for real.
- [ ] **Step 5: Commit** — `"Photography: build location and visit pages"`.

### Task 3: Cards, share and viewer in the browser

**Files:**
- Modify: `css/photography.css` (cards, visit heads, share), `js/photography.js` (hash forms, per-visit viewer, share)
- Create: `scripts/check_photography.mjs`

**Interfaces:**
- Consumes: Task 2 markup.
- Produces: viewer opens from `#<n>` (single set) or `#v<yyyy-mm>-<n>`; `.ph-share` uses `navigator.share` else clipboard + status "Link copied" else shows the address.

- [ ] **Step 1: Failing checks** — `cards link to places`; `location page shows all visits`; `visit page only its photos`; `hash opens viewer`; `viewer stays in visit`; `out of range hash`; `share copies link`; `share fallback shows address`; `phone fits` (390 px, no sideways scroll, cards one column).
- [ ] **Step 2: Run** (serve repo on :8766) → fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → pass; screenshots at 390 and 1280 looked at.
- [ ] **Step 5: Commit** — `"Photography: cards, sharing and per-visit viewer"`.

### Task 4: Wire into the site and publish

**Files:**
- Modify: `photography.html` (forwarder using `js/photo-links.js`, plain link fallback), all pages/`js/nav.js`/`sw.js`/`index.html` links `photography.html` → `/photography/` (relative pages use `photography/`)
- Remove: old Florence web files for DSC05418/DSC05443 are kept on disk only if referenced (they are not → delete)

- [ ] **Step 1: Failing check** — add `old link forwards` (`/photography.html#tenby-4` → `/photography/tenby/2026-08/#4` with viewer on photo 4; `/photography.html` → `/photography/`) to `check_photography.mjs`; run → fail.
- [ ] **Step 2: Implement**; run all checks → pass; site health check on the new pages → clean.
- [ ] **Step 3: Commit and push**; wait for Pages deploy; load `https://ranjithkb.com/photography/` live and confirm cards render.
