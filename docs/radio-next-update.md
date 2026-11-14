# Radio Velvet: plan for the next update

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
