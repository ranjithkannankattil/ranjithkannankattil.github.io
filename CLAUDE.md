# ranjithkb.com — notes for Claude

Ranjith Kannankattil's personal "master site": writing, photography, publications, and a set of
everyday tools (Radio, News, Movies, Trip planner, Workbench tools, an expat guide for Milan).
Plain HTML/CSS/JS served by GitHub Pages from `main` (no build step); custom domain ranjithkb.com
(DNS on Cloudflare, registered at Namecheap). README.md has the file-by-file structure.

## Rules the owner has set (don't break these)
- **No personal email or phone anywhere** on the site or in public repo files. The only contact is
  `hello@ranjithkb.com` (Cloudflare Email Routing).
- **CV page stays hidden** (unlinked from nav and Home, `noindex`) until he asks to bring it back.
  Its wording stays neutral ("international experience", "right to work in India and the UK").
- **Keep the existing design system**: tokens in `css/style.css`, one accent colour per section via
  `[data-section]`, fonts Space Grotesk / Source Serif 4 / IBM Plex Mono / Manjari (Malayalam),
  the ◆ diamond divider. Don't introduce new visual styles for one page.
- Menu groups are **Hello · Words & Pictures · Daily Life · Workbench** (`js/nav.js`).
- **Photography**: photos are in colour (no grayscale); only crowd/scene shots, no close street
  portraits where a recognisable stranger is the subject.
- **Writings**: never state how many pieces he wrote or over which years; keep descriptions generic.
  Blog version of a post is canonical over the Facebook copy.
- **Copyheart**: his own work is free to copy (say so for his work only, not everything on the site).
- The site is English-only — no translated pages.
- **All media goes to Cloudflare R2**, served from `https://media.ranjithkb.com/` — photos, book
  PDFs, link-preview cards, audio, video and any other new images or files. Never commit media to
  the repo for the site to serve. To add some: commit it under `media-incoming/<path>`; the
  "Media upload" workflow copies it to R2 at the same `<path>` and removes it from the repo, then
  link to `https://media.ranjithkb.com/<path>`. (Small UI icons and favicons in `assets/icons/` stay.)

## How to work here
- His main phone is a **Pixel 10a** (Chrome/Brave and the Radio Android app); he also uses an
  iPhone 15 (Brave/Safari, iPhone Radio app). Test every UI change at phone width (412 px, 390 px
  and 360 px) with touch, as well as desktop. Buttons ≥ 44 px, nothing
  hidden under the floating scroll arrows (`.scroll-nav`) or the Radio player bar.
- **Cache-busting**: when you change a CSS/JS file, bump its `?v=N` in every HTML page that loads it.
  `sw.js` is an offline cache — don't let it cache large or frequently-changing files.
- Pages deploys in about a minute after a push; phones may hold the old version up to ~10 minutes.
- Several workflows commit to `main` on a schedule (stream checks, news, cinema). Always
  `git fetch` + rebase before pushing, and never hand-edit generated files mid-run.
- Commit messages: plain English, say what changed for a visitor and why.
- Explain things to him in plain words; he isn't a developer and often works from his phone.

## Radio (radio.html, js/radio.js, js/stations/*.js)
- ~2,200 stations in 70+ languages, one file per collection in `js/stations/`, list of collections in
  `js/collections.js`. Favourites are stored as `"<collection>:<station id>"` in `mr-favs2`, in his
  chosen order, and synced to Firestore when signed in (`js/radio-sync.js`).
- `scripts/check_streams.py` tests every stream twice a day (GitHub Actions) and
  `scripts/discover_stations.py` adds new ones. **The check runs from US servers**: US broadcasters
  that stream only to US listeners (iHeart, StreamTheWorld, StreamOn, cdnstream1, SecureNet) pass the
  check but are silent in Europe/India. Prefer stations that stream worldwide.
- Phone behaviour that took real-device debugging to get right — don't regress it:
  media-session "pause" must only pause and "play" only play (never a toggle — iOS sends "pause"
  when a call starts); pauses the page didn't make are held, never auto-reconnected over a call;
  lock-screen seek arrows change station.
- Sign-in uses Firebase (project `ranjithkb-radio`). Inside the apps it goes through
  `auth-app.html` (Apple sign-in sheet / Chrome Custom Tab) because Google blocks sign-in in an
  app's built-in browser. `firestore.rules` changes must also be published by hand in the Firebase
  console; tests in `scripts/rules-test/` run on push.

## Radio apps (branch `radio-app`)
- Capacitor 8 wrapper that loads the live radio.html; Android APK + iOS Xcode project.
- Version and "what's new" live in `release-notes.json`; every push to `radio-app` builds the APK,
  publishes GitHub release `radio-app-v<version>` (signed with the permanent key in repo secrets
  `RADIO_KEYSTORE_B64` / `RADIO_KEYSTORE_PASSWORD`) and compiles the iOS app on macOS as a check.
  The Radio page's download card and in-app update banner read those releases.
- iPhone app: free Apple ID, installed from his Mac with Xcode (re-run every 7 days); there is no
  iPhone app for other people — the site says so.

## Scholarship finder (productivity/scholarships.html, js/scholarships-data.js)
Each record links its official page and has a `checked` date. `scripts/check_scholarships.py` runs
daily (GitHub Actions) and opens a "Scholarship pages to review" issue when a page's dates or rules
change; it never edits the list. After reviewing, update the record and its `checked` date by hand.

## Adding a Workbench tool
See "Adding a productivity tool" in README.md (registry in `js/tools.js`, page in `productivity/`,
`js/tool-<id>.js` + `css/tool-<id>.css`, nav entry, link-preview card, sitemap).
