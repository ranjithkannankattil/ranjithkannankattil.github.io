# Radio Velvet: plan for the next update

## Next version after 2.9.0 (his call, 21 Nov 2026): **fluid UI**
He wants the next app version to be about a fluid UI: smooth, natural movement everywhere (screen changes, lists,
the player opening and closing, tabs, sheets), no jumps or sudden redraws. Ask him for the moments that feel stiff
today before building; show before/after recordings.
- Kathakali padam email: still needs a To address. News channels email: in his Gmail drafts, Bcc to 7 channels.

### 2.10 design, agreed with him 22 Nov 2026 — build by the end of that week when he says go
Canvas (9 boards, his reference): https://claude.ai/artifact/535HNVDHW8vb649BfDGzGe
His reason: the app looks like one long list; in Settings you can't tell what is a setting.
- **One look per kind of item**, used everywhere: opens a page = card with icon, current value in grey, ›;
  on/off = same card with a switch (whole card toggles); pick one of 2–3 = pill inside the card; do it now =
  filled accent button (max one per screen); just information = small grey text, no card; station = bigger card,
  name + line under it, inline ♡, round play button (no initials or logo), playing one glows in the accent colour.
- **Colours always come from the chosen theme** (15 themes, light + dark); mockups are drawn in Velvet light.
  Use the **new logo** (gold V with signal rings, `ic_logo_mark.xml` / site `assets/icons/radio-velvet-*.png`),
  tinted to the theme. `drawable-nodpi/velvet_logo.png` is the OLD logo: don't use it; remove it in 2.10.
- **Settings**: groups Language (English / Malayalam / Hindi — written in English, never in Malayalam script),
  Look (theme, player look, text, visualiser), Favourites (List/Tiles), Sound, Data and playback (**Data saver
  lives here only**, with this month's data), and at the bottom **App version**: app icon, "Radio Velvet 2.10.0 ·
  Up to date · checked <time>", What's new, Check for updates; when newer exists the top turns accent "2.11 is
  ready" + Update (Play users → Play; website users → download). Holding the version line opens PlayLog.
- **You** (was Info): profile, "Your listening" three numbers (tap → Your listening), card Settings / **Alarms
  (kept separate, not in Settings)** / Quick tour, Share Radio Velvet, Help and about. No version footer.
- **Stations**: header = logo + RADIO VELVET (text centred on the V), search, settings. Row 1 scrolls sideways
  with a soft fade at the right: ★ Velvet Selection chip (logo + small gold star), pinned languages, "All 70+".
  Row 2 is a **sentence filter**: "All kinds from UAE · most heard first" — dotted-underlined words open short
  sheets (kind; "Where from?" with station counts; order: Most heard, Best rated, A to Z, Light on data);
  tapping a choice applies at once, no Apply button. "All kinds" includes **TV channels** (stations with `"tv": true`),
  and station cards show a small TV tag. Both rows fold away on scroll down.
- **Languages sheet** (All 70+): search, your languages first then A–Z with letter jump. Each language has a
  **Pin** button. "Pinned to your row" list with filled pins + drag handles; Malayalam is pinned by default
  ("Pinned for you at the start") but can be unpinned/moved like any other; Undo after unpin; unpin all →
  row keeps Selection + All 70+. Unpinned pick = dashed chip with a small pin inside (gone when another is
  picked); first time a hint "Tap the pin to keep Portuguese here".
- **Small player keeps all today's buttons**: tap to open player, play/pause, ♡, previous, next, sleep timer,
  cast (and close when stopped).
- **Your listening** page: Week / Month / Year / All time, big total card with day bars, totals (since start,
  stations heard, usual time, data this month), month-by-month bars (tap a month), top stations, language
  split. Personal minutes kept on the phone from 2.10 (history starts then), synced to users/{uid} when signed in.
  **Share** button → card image in the current theme (Post 1080×1350 / Story 1080×1920), switches Show the
  hours / Show station names, Save image / Share… (Android share sheet).
- **Owner page** (website, hidden, noindex, only his Google sign-in): hours with change vs previous period,
  hours-per-day chart (7 d / 30 d / 12 m / All), top stations, languages, Kerala vs Gulf stations, ratings,
  requests waiting, Share button. Built nightly by the existing stats job from `listens/` (no Claude, nothing
  new collected). It can't count people or their countries; that would need a new anonymous ID (ask first).
- Motion: rows lift under the finger, pages slide in with the icon travelling to the title, switches spring,
  pills glide, lists fade in row by row, numbers count up, chart bars grow.
- **Station's own logo everywhere** (asked 23 Nov 2026, for Radio Utsav): stations listed in `everywhere` in
  `js/station-logos.json` show their logo in the small player, the big player and as the cover for every
  song (instead of iTunes art) and on share cards; other stations keep logos on Android Auto only. Radio Utsav's only
  stream is http (`http://82.145.63.6:6094/mp=/stream`), which the app and the https website can't play, so it stays
  hidden until there is an https link (ask the station, or pass it through a small Cloudflare proxy if he agrees).
- **Bug (tester, 24 Nov 2026): Android Auto next / previous in Favourites plays Velvet Selection stations.**
  Cause found: `PlaybackService.onGetChildren` stores one sibling list per station id (`siblings[mediaId]`); a station in
  both Favourites and Velvet Selection (or a language) gets whichever list the car loaded last, and the car loads
  every tab. Fix: give car items a list-scoped id (e.g. `favs/<key>`, `picks/<key>`, `col|x/<key>`), strip the prefix
  wherever the station key is read (Listen, CarArt, ratings, saved queue, alarm backups), and add a test that taps a
  favourite after loading Velvet Selection and checks next / previous stay in Favourites.
- **Tester suggestion (24 Nov 2026): add your own station.** "Add a station" (stream link + name, optional language
  and logo), kept private on that phone and synced with the account when signed in (`users/{uid}`), shown under
  Favourites with a "Yours" mark, playable in the car too; a quick check that the link plays before saving; an
  optional "Also suggest it for everyone" that sends it to Request a station.
- **Feedback in Settings** (asked 24 Nov 2026), a group above App version: Suggest a station (link or just a name →
  Firestore `requests`, as today), Request a feature, Send a thank-you note (both a short form → a new owner-only
  `feedback` collection with kind feature/thanks, optional email for a reply, one a minute; rules + rules tests), and
  Rate on Google Play (opens the Play listing). You loses Request a station / Write to us (now only in Feedback);
  its last group becomes "About" with About Radio Velvet. Show feedback and thanks on the owner page.
- **Google Play rating prompt**: already in Play builds (`Review.kt` + `ReviewRule`, once, after 4 days and 3 h of
  listening). Change to **2 days and about 2 hours** as he asked; still once, never after a crash; Google decides
  whether its sheet actually shows. Update the LogicTest cases.
- **FAQ for listeners** (asked 24 Nov 2026), one set of answers used in both places: a section on the Radio page
  (folded questions, linkable as radio.html#faq, after "About the app") and in the app as Settings → Help → FAQ
  (searchable, works offline). Draft text (he is reviewing it): https://claude.ai/artifact/YCK9DKeDNNRAkkqeHDwAAT
  Added 24 Nov 2026: a search box at the top (matches questions and answers as you type, in the chosen language);
  every question has its own stable link (`radio.html#faq-<slug>`, and the app opens the same question from that
  link); FAQ in English, Malayalam and Hindi (app follows the app language; the website gets a language switch on
  the FAQ only — he asked for it, an exception to the English-only site rule); a "hobby project, run in spare time,
  replies can take a while" note in Getting started and Contact; step-by-step setup for Android phone, Android
  Auto, Android TV, iPhone/iPad (Add to Home Screen), CarPlay (no app: start on the phone, sound via the car),
  computer and watches; the Quick tour; Malayalam-first default and how others pin their own language first.
  His answers: no ads of our own stays true; Suggest a station on both the website and the app; no promised
  time for removal requests. Keep the text in one file on the site (e.g. `radio-faq.json`, English plus the app's
  Malayalam and Hindi) so the app and the page read the same words. Plain words, short answers. Questions to cover:
  - Getting started: what Radio Velvet is; is it free (yes, no ads from us; some stations play their own ads);
    Android app vs website; iPhone (no app yet, use the website); Android TV; Android Auto; is there a Garmin app
    (not possible to play on the watch; phone controls work).
  - Finding stations: languages and pinning; Velvet Selection; the sentence filter (kind, place, order);
    Most heard / Top rated; the TV tag; "Only plays in …"; why a station is missing and how to suggest one;
    adding your own private station.
  - Playing: a station won't play / keeps reconnecting; why some stations stop outside their country; song names
    and covers (from the station / iTunes, may be wrong); Data saver and how much data an hour uses;
    sleep timer; equaliser; carry on after videos; playing in the car (next / previous follow the list you
    started from); casting to a TV or speaker.
  - Alarms: how they work, what happens if the station is down (backups, then the alarm sound), battery settings
    that can stop alarms on some phones, Stop / Snooze.
  - Favourites and account: saving favourites, tiles vs list, signing in with Google to sync phone and website,
    what is stored, deleting your account and data.
  - Look and language: colour themes, player looks, text size, app language (English / Malayalam / Hindi).
  - Privacy: what is counted (anonymous minutes per station; nothing about you), crash reports, your listening
    page stays on the phone unless signed in, link to the privacy page.
  - Help: Feedback (suggest a station, request a feature, thank-you note), Rate on Google Play, updates and
    What's new, joining the Early access test, contact hello@ranjithkb.com.
  - For stations: how to get listed, using your own logo, asking to be removed.
- **Sort Velvet Selection** (asked 24 Nov 2026), in the app and on the Radio page: the order word in the sentence
  filter also works on Velvet Selection. Choices: **Velvet's order** (default: the order of his own favourites,
  which is what becomes Velvet Selection), **Most heard** = of all time (`total` in js/station-stats.json; he dropped
  "this week" on 24 Nov 2026: one Most heard everywhere, website done, app in 2.10 for every list), Top rated, A to Z, Light on data. The kind and
  place words narrow Velvet Selection the same way. Each listener's choice is remembered; it never changes his order.
- **Bug (his report, 24 Nov 2026): the radio keeps playing when Android Auto disconnects** (it should pause, like a
  car radio switching off). Today only `setHandleAudioBecomingNoisy(true)` pauses it, and leaving Android Auto
  (cable or wireless projection) doesn't always send that "noisy" signal; or a pause happens and the
  resume-after-other-apps helper starts it again. His PlayLog from the next disconnect tells which. Fix both ways:
  watch the car connection (androidx.car.app `CarConnection`: projection → not connected) and pause with
  PlayLog.who = "Android Auto disconnected"; that pause cancels the resume helper and reconnecting, like any pause.
  Device test with a fake disconnect; he checks in the car.
  Second tester (Anoop, 25 Nov 2026): car on Bluetooth + Android Auto; on leaving the car the Bluetooth drops and
  the radio carries on (or starts) on the phone speaker, even in a meeting. So also: when the sound moves from a
  car / Bluetooth device to the phone speaker, stay paused (AudioDeviceCallback: car/BT output removed → pause), and
  ignore a "play" that arrives in the first ~10 s after that disconnect (some cars send one as they disconnect).
  The PlayLog of a tester shows which of these it is.
- **Even volume between stations** (tester suggestion, 25 Nov 2026: "each station has a different volume; keep it
  the same when changing station"). Settings → Sound → **Even volume** (on by default, can be switched off). Two parts:
  1. Each station's usual loudness is measured by the twice-daily stream check (a 20-second sample, ffmpeg's
     EBU R128 loudness meter) and saved as `"lufs"` per stream in the station files; the app starts each station
     at the gain that brings it to about −16 LUFS, so the jump is gone the moment you switch (limited to ±10 dB).
  2. While playing, a gentle audio step in the player (next to the visualiser's) evens out slow drifts over
     several seconds, with a limiter so loud songs never clip; never fast enough to "pump" music.
  App only: the website can't change the volume of most stations' streams (browsers block it for other sites'
  audio). Test: switching between a quiet and a loud station stays within about 2 dB; he checks by ear in the car.
- **Bug (tester, 25 Nov 2026): Favourites can't be seen on wide, short screens** (landscape phones and Android car
  stereos running the phone app). Cause found: in `FavouritesTab` (MainActivity.kt) the Recently played strip
  (`RecentStrip`, about 170 dp: label + 96 dp tiles + names) and the "N favourites / Reorder" row sit in a fixed
  `Column` above the list, so on a screen ~400 dp tall, with the player bar and bottom tabs, nothing is left for
  the favourites. Fix: make the strip and that row the first items of the favourites list, so they scroll away;
  on short screens (height < 480 dp) show Recently played as one slim row of small chips (or folded behind a
  "Recently played ›" line); and in landscape use a side rail instead of bottom tabs and a slimmer player bar so
  lists get the height. Screen tests at 800×400 and 1280×480 (car stereo sizes), plus phone landscape.
- **Station rows and the player** (agreed 26 Nov 2026): no two-letter badge on station rows; the ♡ sits inline
  next to the play button. No logo in station rows at all, even for stations that gave us one (he said so 26 Nov). In the big player the ♡
  sits beside the station name, within thumb reach, in every player look (not tucked in a corner or menu).
  **Row size** in Settings → Look: Compact · **Comfortable (default)** · Expanded. Compact = one-line rows, tighter
  gaps (good for car stereos and small screens); Expanded = larger text and touch targets with the song now playing.
- **Changed 27 Nov 2026 (his decisions, replacing earlier ones):** station rows show the station's own **logo when it has
  one**, else two letters on a soft tile (earlier: no logos or badges at all) and **only the ♡** (the round play button from the canvas is dropped; tapping the card
  plays). The **player bar is about half height** (picture, station, song, play/pause; like JioSaavn), with every other
  control in the big player. **Tags by name** in the kind picker ("By name": Retro, 60s–2000s, Melody, Hits, Instrumental,
  Kids). "Play the last station on opening" also fires when he comes back to the app after 20 s away (Back only sends the
  app to the background now). Favourites as tiles also apply in Android Auto (26 Nov).
- **Tester suggestions (26 Nov 2026), for more room in landscape / the car:** "Add your own station" is a small + next
  to Settings at the top (used by few, so not in the Favourites list); the sign-in note above Favourites has a ✕ that
  hides it for the rest of the day. Built 26 Nov on `radio-native-dev`.
- **Tester suggestion (26 Nov 2026): play the last station on opening** (on/off, off at the start; Settings → Data and
  playback). Opening the app on the phone starts the last station unless something is playing or an alarm/link opened it;
  opening Radio Velvet in Android Auto does the same once per drive, only when no other app is playing. Built 26 Nov on
  `radio-native-dev`. (Android Auto's own "Start music automatically" setting also works with Radio Velvet.)
- **Decided 26 Nov 2026: all new design only** (he chose the full change: no switch back to today's design).
  Building started 26 Nov on `radio-native-dev`.
- Also in 2.10 (from earlier): bugs (radio turning itself on + Auto artwork flicker, Connecting… timeout,
  widget doesn't open the app, three looks ignore the colour theme, text shifts between looks, remaining
  translations), the share card drawn from the current player look, browse by country. Spotify-in-car
  focus bug: recorded only, he said don't solve now.


**Status 14 Nov:** everything below except the tip jar / Buy Me a Coffee (19, 22) is built: website live, app in the Dev build (2.5.0-dev) waiting for his test before Play.

Collected from Ranjith and testers. Build when he says "go".

## Part 1: App (needs a new app version, goes to Google Play review)
1. **Car resumes the last station** (Android Auto, Bluetooth play button), like Spotify. Started: saved as a git stash on `radio-native` ("next update: resume last station in car"); still needs the media-button receiver.
2. **Android TV**: show on the TV home screen (banner) and work with the remote. Ask testers what exactly fails.
3. **Cast button** on the mini player and big player, full-size slot (fat-finger friendly): Chromecast / Google TV / Nest via Media3 Cast.
4. **App doesn't close on Samsung Galaxy A14**: make Close (✕) and swiping the app away stop playback and remove the notification. Must not change how it behaves on other phones: only an explicit close (✕, or swiping the app away while paused) stops it; playing in the background, calls, lock screen and Android Auto stay exactly as now. Test on a Samsung-like setup before release.
5. **A–Z sorting** in every list except Favourites (Favourites keep his own order).

## Part 2: New look (app and website player, so both match)
6. **New design** from the "Radio Velvet layouts" design canvas (claude.ai artifact GbuV8QUWSLtjs3UfdT26fg). Theme colours only (cream, velvet plum, gold), as elegant as a fashion house, and easy to read for older listeners.
   - Big player: no empty space at the bottom, controls spread evenly; light version in light mode, dark plum + gold in dark mode (testers' complaints about the always-dark big player and the empty bottom).
   - Search screen: "← Search" title row, full-width soft search field with a gold underline, recent searches and suggestions.
   - Still to choose: plain A vs Maison vs Maison easy-to-read; whether to drop the extra close/collapse buttons; the mini player's buttons.

## Part 3: Stations (website + app, no app update needed)
7. **Tidy station names** in every list: split "FM" off a joined name and write it as FM ("radiofm" → "Radio FM", "Hitfm" → "Hit FM"), capitalise the first letter of each word, turn ALL-CAPS and all-lowercase names into normal case, remove stray spaces and symbols. Keep real brand spellings (BBC, iHeart, KISS, AIR, numbers like 104.6). Show him a before/after list before changing, and make `discover_stations.py` tidy new names the same way.
8. **Radio Macfast 90.4 (Changanassery)**: find a working online stream and add to Malayalam.
9. **Radio Mango**: current one is Radio Mango Kochi; find the other Radio Mango streams (other Kerala cities, Gulf/online) and add them with clear names.
10. **Suryan FM 93.5 (Tamil, Chennai, Sun Network)**: the "Sooriyan FM" we have is the Sri Lankan station; find a working stream for India's Suryan FM and add it (keep the Sri Lankan one, name both clearly). Prefer an official stream.
11. **Hello FM 106.4 (Tamil)**: no public stream found yet; add if someone sends a working link.
12. **Mazhavil FM**: listed but hidden (old stream dead, website down on 12 Nov, no public link). Add the new link if the station or a listener sends one.
13. **Radio Lemon Bengaluru, Europe, Africa, Australia**: not playing on 12 Nov, even on their own site. Bengaluru is listed as offline and comes back by itself; add the others once they play. Check whether our "Radio Mate" (stream named "lemonaustralia") is really Radio Lemon Australia.

## Part 4: Most heard and Top rated (app + website)
15. **Anonymous minutes per station**: website counting live since 14 Nov (listens/<day>/s/<collection:station>); app to add whole minutes to a per-station count (no user link); new Firestore
    rule allows only small increments; privacy page gets one line.
16. **Nightly GitHub job** (no Claude) totals listening (this week + all time) and ratings (average, count) into one small
    file on the site, e.g. `js/station-stats.json`; app and page read that file, not the database.
17. **Sort button replaces A–Z** in the category row: Usual order · A–Z · Most heard · Top rated (remembered; Favourites
    keep his order). Most heard shows "1,240 hrs this week"; Top rated shows "★ 4.6 · 38 ratings", ranks only stations
    with 3+ ratings. Optional gold ◆ on the top 3 most heard per language. Waiting for his two choices: ◆ yes/no,
    this week vs all time.
18. **Resume after other apps' videos** (asked 13 Nov): when another app takes the sound (e.g. a Facebook video), resume
    once it has been quiet a few seconds, only within 10 minutes, never during calls or after his own pause.

19. **Buy me a coffee** (app + website, asked 14 Nov): a gentle, optional support link saying the app is free but
    building and running it takes time and effort. Needs his Buy Me a Coffee (or similar) page link first.

## Part 5: Settings, on demand (asked 14 Nov) — defaults stay exactly as now
20. **Settings page** (⚙ in the header or under Info), app + website:
    - Theme: Follow phone (default) / Light / Dark, plus colour palettes, each in light and dark (shown on the design
      canvas, "Settings · colour themes"): Malayalam names with the script beside them (Manjari) and the English meaning in brackets for foreigners, e.g. "Kadal കടൽ (Sea)": Elegant — Velvet
      (default), Nilavu നിലാവ് (navy), Kaavu കാവ് (green), Mashi മഷി (black), Kasavu കസവ്; Vibrant — Ila
      ഇല, Sandhya സന്ധ്യ, Kadal കടൽ, Maambazham മാമ്പഴം, Peeli പീലി. All of them are kept (his call, 14 Nov), plus Subtle — Manju മഞ്ഞ് (Mist), Chandanam ചന്ദനം
      (Sandalwood), Aambal ആമ്പൽ (Water lily), Kaayal കായൽ (Backwaters), Mazha മഴ (Rain).
    - Text size: Normal / Large / Extra large (scales everything evenly; for older listeners).
    - Font: Jost (default) / Classic serif (Cormorant) / Phone's own font.
    - Station list spacing: Compact (default, now) / Comfortable / Spacious (row height and gaps only).
21. **Equaliser (app only)**: off by default; presets Normal, Voice & news, Bass boost, Music, Classical, Small speaker, plus
    5-band sliders; remembered; works over Bluetooth/car. Not on the website: browsers can't process other sites' streams.
23. **Visualiser** (Settings, off by default; asked 14 Nov): animated sound bars / waves / circle in the big player, in the
    chosen theme's colours (like Windows Media Player). App: real music-driven, from the player's own audio (Media3
    TeeAudioProcessor + FFT) — no microphone permission. Website: most streams don't allow browsers to read the sound,
    so the web version is a gentle animation that follows play/pause, not the music (say so).
22. **Tip jar / support** (asked 14 Nov): Play app = Google Play in-app tips (€1.99 / €4.99 / €9.99, UPI in India); website
    and website APK = Buy Me a Coffee. Waiting for him: Play payments profile, Buy Me a Coffee page link.

## Part 6: Big-app features (chosen 14 Nov)
24. **Car / Bluetooth / Android Auto next & previous fixed** (on radio-native-dev): "previous" used to restart the same
    station after 3 s (music rule); now both always change station and wrap round. CarPlay (iPhone wrapper) code
    already maps next/previous and ±10 s to station changes; not testable without a car.
25. **Alarm clock**: wake up to a chosen station (or the last one) at a set time, days of the week, gentle fade-in;
    survives restarts; app only (Android exact alarms).
26. **Home-screen widget**: station, song, play/pause, previous/next; themed.
27. **Request a station** button (app + website): name, city/country, link if known → saved for him (Firestore
    `requests`, owner-only read) instead of WhatsApp messages.
28. **Crash reports** (Firebase Crashlytics, project ranjithkb-radio): which phone and why when the app crashes; privacy
    page line.
29. **"Rate us" prompt**: Google Play's own in-app review sheet, shown once after a few days of happy listening (Play
    version only; Google decides if it actually appears).

## Done on 12 Nov (live already)
- Malayalam FM 104.6 (NZ), Planet FM 104.6 (NZ), Naadan Chaaya Radio (Ireland), Radio Lemon New Zealand added; Radio Lemon UK and Nammude UK named clearly (Nammude UK has a backup stream); Radio Lemon Bengaluru listed (offline for now).

## Next version (after 2.6.0): tabs and bottom bar — his ideas, Nov 2026
His choice (17 Nov): keep the bottom bar, highlight the chosen tab with the soft pill (2A), and replace "Velvet Selection" with the Velvet logo that has a star in it — he picked B, the big star (a star replaces the antenna dot and inner wave).
   First-timers (his correction, 19 Nov): a helper tour of the WHOLE app on first launch, not just the star — 8 steps, each
   dimming the screen and ringing one part: 1 Welcome (Show me / No thanks) · 2 ★ Velvet Selection · 3 language tabs and ⇅ sort ·
   4 ♡ favourites · 5 search and ⚙ Settings (themes, fonts, equaliser, visualiser, radio looks, alarm) · 6 the player bar (tap
   to open, swipe to change station) · 7 the big player (swipe the cover for radio looks, knobs, share / sleep / cast) ·
   8 Stations / Favourites / Info. Skip at any step; shown once; replay from Info → Quick tour. Designs: canvas "Tour_1…8".
   Inside the star tab the list is headed "Velvet Selection"; long-press shows the name; TalkBack reads it.
1. "Velvet Selection" tab is too long: 1A gold star only, or 1B the Velvet logo (TalkBack still says "Velvet Selection").
2. Bottom bar: make the chosen tab stand out — 2A soft pill, 2B filled in plum, 2C gold edge with a light gold fill.
3. Or drop the bottom bar: ♥ Favourites becomes the first top tab, Info becomes ⓘ in the header; one more station row fits.
   (The "Favourites 3" chip under the tabs stays: favourites in that language; the ♥ tab is all favourites.)

4. **Several alarms** (tester's idea, 19 Nov): one for workdays, one for the weekend, more if wanted — each with its own
   time, days, station, fade-in, volume, an optional name and an on/off switch. Quick repeat choices: Workdays · Weekend ·
   Every day · Once (days still tappable, e.g. a Fri–Sat weekend in Saudi). The list shows the next alarm. The current single
   alarm becomes the first one, so nobody loses theirs. Designs: canvas "Alarms_list" / "Alarms_edit".

5. **Alarm safety net** (his question, 19 Nov: "what if the station isn't working?"). Today: the phone's alarm sound only
   after the fade + 5 s (over a minute of silence with a 1-minute fade) and it stops after 2 minutes; no backup links or
   station. Plan: the station's other links first; then a backup station ("If it doesn't play": default = most-played
   working favourite, or any station, or "Phone alarm sound"); the phone's alarm sound at the latest 20 s after the alarm
   time no matter what (no internet, Wi-Fi off); keeps ringing until stopped (max 10 min) with Stop / Snooze 10 min on the
   lock screen; a quiet stream check 2 minutes before the alarm swaps to the backup if the station is down. Device tests
   for dead stream, no internet, slow station, Stop. Offered to him as a small update on its own after 2.6.0 is approved.

## Already built and tested on Dev (radio-native-dev), waiting for the next release
- Knobs turn like real ones: follow the finger round the knob (not only straight swipes), move with the finger between
  steps, a soft click at each step, bigger touch areas; a tap only counts on the knob's left / right third.
- Swipe the cover (or a radio, away from its knobs) to flip between the player looks: Standard and the six radios;
  the look's name shows for a moment. (His idea; the bottom bar's swipe still changes station.)
- "Reset knobs" under the hi-fi receiver and the digital tuner: bass / mid / treble back to flat; volume and station untouched.
- Tests: LogicTest + ScreensTest all pass; device tests 26/26 (incl. turning round, fast spin, shaky finger, swipe never
  from a knob, bottom-bar swipe, reset).

## Released in 2.7.0 (sent to Google 19 Nov 2026)
Everything above: star tab, soft pill, tour, several alarms, safety net, and the Dev items. Next ideas go below.

## Feedback for the next revision
- **TVS iQube (EV scooter) doesn't see Radio Velvet as a music player** (tester, 19 Nov 2026). The TVS Connect app only
  shows controls for well-known apps (Amazon Music, Spotify, YouTube Music; not even YouTube forks): it seems to pick apps by
  name, which only TVS can change. Radio Velvet already plays through Android's standard music controls (lock screen,
  Bluetooth, Android Auto). Ideas: ask TVS to add `com.ranjithkb.radio`; check whether the scooter's Bluetooth/helmet
  controls work anyway; TVS showed Android Auto for the top iQube at EICMA 2026 (Radio Velvet already works in Android Auto).
- **Data saver** (his idea, 20 Nov 2026: for sailors and remote villages on satellite or 2G). Not started; build when he says.
  Settings → Data saver: Off / On / Only on mobile data (website also follows the browser's Save-Data). When on: play
  each station's lightest link (the nightly stream check records every link's bitrate), cap HLS (Akashvani) to its lowest
  level, skip song covers and song look-ups, keep a longer buffer for patchy signal, show "32 kbps · ~15 MB/hour" on rows
  and a "Lightest first" sort, and show data used this month in Info. Measured 19 Nov: most stations use ~58 MB/hour,
  Akashvani 38–53, high-quality ones ~86.
- **Kathakali padam station**: email drafted to kathakalipadam.com (in his Gmail drafts) with free ways to start a radio;
  add their station when they send a stream link.
- **Smoother player-look swipe** (his ask, 20 Nov 2026): swiping the cover to change the player look (Standard ↔ the six
  era radios) should feel smooth and fluid: the current look follows the finger and slides out while the next slides in
  (like turning a page), springs back if the swipe is short, with no jump or flash and a gentle settle; the look name
  shows during the slide. Not started; build when he says.
- **Tidier Info tab** (his ask, 20 Nov 2026: "looks cluttered"). Today it's seven blocks of paragraphs and plain text
  links. Proposed: (1) a header card: logo, version, "Up to date" or the update button; (2) Your listening; (3) one
  account row ("Signed in as …" ›, with sign out / delete inside); (4) one list of rows with icons, like Settings:
  Settings, Alarms, Request a station, Quick tour, Share the app, Write to us; (5) "About" rows that open their own
  short page: What the app can do (the "good to know" lines), How stations are checked, Privacy policy, Credits, Radio
  on ranjithkb.com. Same look as the Settings page. Show him a mock-up first; build when he says.
- **App in Malayalam and Hindi** (his asks, 20 Nov 2026). Settings → App language: English (default), മലയാളം or हिन्दी, also offered in the
  phone's own Settings → Apps → Radio Velvet → Language (Android 13+). Every word the app shows: tabs, buttons, Settings,
  Info, the tour, alarms, notifications, lock-screen and Android Auto labels, messages. Natural, everyday Malayalam (not
  stiff official words), in Manjari; Hindi the same way: simple everyday Hindi, not heavy Sanskrit words, in a clean
  Devanagari font. Station and song names stay as they are. App only: the website stays English-only.
  Word list with his choices: docs/radio-malayalam-words.md (Station = നിലയം, Font = ഫോണ്ട്).
  He reviews the Malayalam wording, and someone fluent checks the Hindi, before release. Not started; build when he says.
