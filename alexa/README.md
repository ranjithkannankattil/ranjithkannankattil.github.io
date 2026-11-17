# Radio Velvet for Alexa

"Alexa, open Radio Velvet" · "Alexa, ask Radio Velvet to play Radio Mango" · "… to play Malayalam radio" ·
"… to play the Velvet Selection" · then "Alexa, next", "previous", "pause", "resume", "what's playing".

- `lambda/` — the skill's code (Node.js, Alexa-hosted). `radio-core.js` matches spoken names, `index.js` answers Alexa.
  Tests: `cd lambda && npm install && npm test`.
- `skill-package/` — the skill's details and voice model (one per English locale). The voice model's station and
  language names are written by `scripts/build_alexa_stations.py`; don't edit those by hand.
- `model-template.json` — the phrases (edit here, then run the build script).
- Stations: the skill reads `https://ranjithkb.com/js/alexa-stations.json` every hour (stations with secure streams,
  which is all Alexa can play), so new stations work without redeploying. The GitHub job "Radio Velvet for Alexa"
  rebuilds it after each stream check and test-plays the Malayalam streams.
- Velvet Selection: read from the same place as the site and app (Firestore `picks/ranjith`).
- Echo Show screens show the Radio Velvet icon only; station logos are for Android Auto only.
