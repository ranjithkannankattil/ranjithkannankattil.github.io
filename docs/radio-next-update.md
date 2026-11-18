# Radio Velvet: plan for the next update

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
