# ranjithkb.com — notes for Claude

Ranjith Kannankattil's personal "master site": writing, photography, publications, and a set of
everyday tools (Radio, Movies, Trip planner, Workbench tools, an expat guide for Milan).
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
- The site is English-only — no translated pages. One exception he asked for: the Internship finder has an
  in-page EN | മലയാളം | हिंदी switch (students are its audience).
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
- Several workflows commit to `main` on a schedule (stream checks, cinema, scholarships). Always
  `git fetch` + rebase before pushing, and never hand-edit generated files mid-run.
- Commit messages: plain English, say what changed for a visitor and why.
- Explain things to him in plain words; he isn't a developer and often works from his phone.

## Radio (radio.html, js/radio.js, js/stations/*.js)
- The page is branded **Radio Velvet** like the app: section accent is the app's plum (#6B2D5C), the
  Android app card sits at the top with details folded under "About the app". Menu label stays "Radio".
- **Primary audience: Keralites** — in Kerala, the Gulf and the diaspora. Malayalam comes first everywhere
  (default language, top of lists, Spin's default, first in quality checks), Gulf Malayalam stations matter as
  much as Kerala ones, and streams must play from India, the Gulf and Europe, not just the US.
- **radio.ranjithkb.com** is a Cloudflare redirect rule (proxied A record 192.0.2.1) to `ranjithkb.com/radio.html`.
- Stations that stream only inside one country carry `"geo": "AE"` (etc.): the page and app say "Only plays in …",
  and `check_streams.py` skips them (its US servers can't judge them).
- ~5,300 stations in 70+ languages, one file per collection in `js/stations/`, list of collections in
  `js/collections.js`. Favourites are stored as `"<collection>:<station id>"` in `mr-favs2`, in his
  chosen order, and synced to Firestore when signed in (`js/radio-sync.js`).
- Every hour `scripts/recheck_offline.py` (recheck-offline-stations.yml) re-tests only the Malayalam stations marked
  not working and switches back on any that play again; it never marks a station as not working.
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

## Radio Velvet — the Android app (branch `radio-native`)
- Native Kotlin + Jetpack Compose + Media3 app named **Radio Velvet** ("Elegant sounds, always free"),
  app id `com.ranjithkb.radio` (it replaced the old Capacitor wrapper in place, versionCode 2000+run).
  Reads stations from the live site, plays in a MediaLibraryService (lock screen, calls, Android Auto),
  live song info (ICY) + iTunes cover art, shareable song card, Google sign-in via `auth-app.html`
  → Firebase REST, favourites synced with `users/{uid}` like the website.
- Every push to `radio-native` builds and publishes release `radio-app-v<APP_VERSION>` (version in
  `.github/workflows/build-native.yml`, notes written there), signed with the permanent key in repo
  secrets `RADIO_KEYSTORE_B64` / `RADIO_KEYSTORE_PASSWORD`. Bump `APP_VERSION` for each release.
  The Radio page's download card, the old app's update banner and the app's own Info/Update banner
  all read those releases.
- **Google Play**: app "Radio Velvet" (`com.ranjithkb.radio`) in Play Console, signed with the same key (Play app signing,
  existing key uploaded). Closed tests: **Alpha** (email list "Velvet testers", friends) and **Early access** (Google Group
  `radio-velvet-testers@googlegroups.com`, anyone can join; joined from the Radio page's Info → app card, the
  `.ra-play` box). Every build on `radio-native` uploads the Play bundle via `scripts/play_upload.py` (secret
  `PLAY_SERVICE_ACCOUNT`, service account play-uploader@ranjithkb-radio, testing-track rights only) to all closed tracks;
  Google reviews each release. The .aab is no longer attached to public releases (phones can't install it).
- **In-app notes**: the app (2.3.5+) shows messages from `radio-notes.json` on the site (id, to web/play/all, times,
  until, title, text, button, link; `whatsapp:<text>` opens a chat with him). His WhatsApp number comes only from the
  private build secret `RADIO_WA_NUMBER`; never put it in code or on the site.
- Old Capacitor wrapper: branch `radio-app` (don't push there — it would publish a 1.x release).
  iPhone: still that wrapper, installed from his Mac with Xcode (free Apple ID, re-run every 7 days);
  no iPhone app for other people — the site says so.

## Scholarship finder (productivity/scholarships.html, js/scholarships-data.js)
Runs without the owner on GitHub. Don't add scheduled Claude tasks: he doesn't want to spend Claude tokens.
`scripts/check_scholarships.py` runs daily and writes `js/scholarships-status.json`; the page shows when
each official page was last read and flags a card if its page changed after the record's `checked` date.
`scripts/refresh_scholarships.py` then asks Gemini (the free `GEMINI_API_KEY`, no page cap;
it stops for the day if the free limit is hit) for new deadlines. A date is used only if its exact quote is on the page and it's in the future.
Dates only: amounts and rules change when he asks.
Pages that block GitHub are retried, tried with curl, then read by Gemini's URL tool (`via: gemini` in the watch file;
those are compared by dates only and never auto-update deadlines). Every Monday `discover-scholarships.yml` runs
`scripts/discover_scholarships.py`: Gemini + Google Search suggests missing scholarships, the official page is read
from GitHub, and a card goes **straight onto the page** (he chose this) only if the page quotes that Indians can apply
and quotes every date. Max 5 a week; such cards carry `found:` and show an "Added by the weekly search" note. If the free limit is hit, move the job to every 3 days,
as he suggested. Keep the disclaimer at the top of the page.

## Milan expat guide (expat/milan/, built by scripts/build_expat.py)
Edit the content in `scripts/expat/milan/<topic>.html`, then run `python3 scripts/build_expat.py` and commit both.
The Milan hub shows public holidays for the next 12 months from `scripts/expat/milan/holidays.json`; a small
script on the page redraws the list from today, so it rolls forward on its own. On the 1st of each month
`check-expat-sources.yml` runs `scripts/check_expat_sources.py`: it re-reads every source (topic links plus
`sources.html`, where `<li data-topics>` says which topics a source backs), lets Gemini (free key, no Claude)
fix only figures/dates whose new value is quoted on the source page, checks the holiday list, moves the
"Checked <month>" line on and opens a GitHub issue for anything a person must look at. Don't add a scheduled
Claude task for it.

## News (archived)
Archived by the owner: unlinked, `noindex`, and `build-news.yml` runs by hand only. `news.html` is a short
note; the full page is saved at `docs/archived/news-page.html` and the code is still in the repo.

## Internship finder (productivity/internships.html, js/tool-internships.js)
Runs entirely in the visitor's browser on **the student's own** free Gemini key (AI Studio); nothing goes
to the site or to Claude, and there is no scheduled job. Course + university → Gemini reads the syllabus
(Google Search grounding, or an uploaded PDF / typed subjects) → editable profile → ~16/40/90 grounded
searches in the order state govt → central govt → PSUs → private, ~8 a minute, saved after every step
(continues the next day when the free search limit runs out; falls back to knowledge-only "leads"
marked "check page"). A result is "Found on this page" only if its link's domain is one of the search's
grounding sources. Built-in official starting points: `js/internships-data.js`. Text in three languages:
`js/internships-i18n.js` (add a language by copying the `en` block). Saving: browser, backup file via the
share sheet, a self-updating file on laptops (File System Access), and a restore link whose data sits in
the `#` fragment. The key is never in backups or links. Test without a key: `internships.html?mock=1`.
He doesn't want his Google account involved (no Google sign-in / Drive API).

## Adding a Workbench tool
See "Adding a productivity tool" in README.md (registry in `js/tools.js`, page in `productivity/`,
`js/tool-<id>.js` + `css/tool-<id>.css`, nav entry, link-preview card, sitemap).
