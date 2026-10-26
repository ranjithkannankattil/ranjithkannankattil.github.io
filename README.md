# Radio app (ranjithkb.com)

Native Android and iOS wrapper for https://ranjithkb.com/radio.html, built with Capacitor 8.
The app loads the live page, so station and design changes on the website show up in the app
without rebuilding.

What the app adds over the browser:
- Keeps playing with the screen off or the app in the background.
- Notification, lock-screen, Bluetooth, headset and car controls (play/pause, next/previous station).
- Back button on Android sends the app to the background instead of closing it.

## Android
Every push to this branch builds `Radio.apk` in GitHub Actions (Actions tab -> latest run -> Artifacts).
Repo secrets `RADIO_KEYSTORE_B64` and `RADIO_KEYSTORE_PASSWORD` are set (26 Oct 2026), so every build is signed
with the same key and new APKs install over old ones.

Native code: `android/app/src/main/java/com/ranjithkb/radio/` (RadioMediaPlugin + RadioMediaService).
`www/app-bridge.js` is injected into the page on Android only and maps `navigator.mediaSession` to the
native plugin.

## iOS
Open `ios/App/App.xcodeproj` in Xcode, pick your Team under Signing & Capabilities, choose your iPhone, Run.
Background audio is enabled (UIBackgroundModes = audio, AVAudioSession .playback); lock-screen controls
come from the page's own Media Session code.

## Changing things
`npm install && npx cap sync` after editing `capacitor.config.json` or `www/`.

## Releasing a new version
Edit `release-notes.json`: bump `version` and list what changed for `android` and `ios`.
Every push builds the APK and publishes GitHub release `radio-app-v<version>` with the notes and
release date/time; the Radio page's download card shows them. For iOS, also set MARKETING_VERSION
in `ios/App/App.xcodeproj/project.pbxproj` to the same version.
