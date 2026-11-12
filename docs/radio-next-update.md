# Radio Velvet: list for the next update

Collected from Ranjith and testers. Build when he says "go".

## App
1. **Car resumes the last station** (Android Auto, Bluetooth play button), like Spotify. Started (saved as a git stash on `radio-native`: "next update: resume last station in car").
2. **Android TV**: show on the TV home screen (banner) and work with the remote. Ask testers what exactly fails.
3. **Cast button** on the mini player, full-size slot (fat-finger friendly): Chromecast / Google TV / Nest via Media3 Cast.
4. **App doesn't close on Samsung Galaxy A14**: make Close (✕) and swiping the app away stop playback and remove the notification. Must not change how it behaves on other phones: only an explicit close (✕, or swiping the app away while paused) stops it; playing in the background, calls, lock screen and Android Auto stay exactly as now. Test on a Samsung-like setup before release.
5. **A–Z sorting** in every list except Favourites (Favourites keep his own order).
6. **Full player: too much empty space at the bottom**: tighten the layout so controls sit lower / content is centred.
7. **Dark background even in light mode**: full player is always dark plum; give it a light version in light mode Confirmed: testers mean the big player screen.

## Stations (website + app, no app update needed)
8. **Radio Macfast 90.4 (Changanassery)**: find a working online stream and add to Malayalam.
9. **Radio Mango**: current one is Radio Mango Kochi; find the other Radio Mango streams (other Kerala cities, Gulf/online) and add them with clear names.
10. **Suryan FM 93.5 (Tamil, Chennai, Sun Network)**: a tester asked for it. The "Sooriyan FM" we have is the Sri Lankan station; find a working stream for India's Suryan FM 93.5 and add it (keep the Sri Lankan one, name both clearly). Prefer an official stream; unofficial re-streams stop working.
11. **Hello FM 106.4 (Tamil)**: no public stream found yet (12 Nov); add if someone sends a working link.
12. **New look: layout A (chosen 12 Nov)** from the "Radio Velvet layouts" design canvas (claude.ai artifact GbuV8QUWSLtjs3UfdT26fg): theme colours only (cream, velvet plum, gold); soft-plum station tiles with plum initials, the playing one solid plum with a small equaliser; header with logo + dark-mode button; big rounded search; gold Velvet Selection chip + language chips; All · FM · Akashvani · Online tabs with an A–Z button; mini player as one dark card with six equal 44 px+ buttons (♡, sleep, share, cast, ⏮, ⏭); big player spread evenly (no empty bottom) with Share · Spotify · Sleep · Cast as four big buttons, light version in light mode and dark plum + gold play in dark mode. Apply to the website player too so both match.
