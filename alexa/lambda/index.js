/* Radio Velvet for Alexa.
   "Alexa, open Radio Velvet" · "Alexa, ask Radio Velvet to play Radio Mango" · "… to play Malayalam radio" ·
   "… to play the Velvet Selection" · then "Alexa, next / previous / pause / resume / what's playing".
   Stations come from the live site (js/alexa-stations.json), refreshed every hour; nothing about the listener is stored. */
"use strict";
const Alexa = require("ask-sdk-core");
const https = require("https");
const { Radio, makeToken, readToken } = require("./radio-core");

const SITE = "https://ranjithkb.com";
const ART = `${SITE}/assets/icons/radio-velvet-512.png`;
const PICKS = "https://firestore.googleapis.com/v1/projects/ranjithkb-radio/databases/(default)/documents/picks/ranjith";
const HOUR = 3600e3;

// ---------------------------------------------------------------- data (cached between requests while warm)
function getJson(url, ms = 4000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "RadioVelvetAlexa/1.0" }, timeout: ms }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`${url} ${res.statusCode}`)); }
      let b = ""; res.setEncoding("utf8"); res.on("data", (c) => (b += c)); res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.on("timeout", () => req.destroy(new Error("timeout"))); req.on("error", reject);
  });
}
const cache = { radio: null, at: 0, picks: null, picksAt: 0 };
let loader = getJson;                                   // tests swap this
async function radio() {
  if (cache.radio && Date.now() - cache.at < HOUR) return cache.radio;
  try {
    const [data, stats] = await Promise.all([loader(`${SITE}/js/alexa-stations.json`), loader(`${SITE}/js/station-stats.json`).catch(() => ({}))]);
    cache.radio = new Radio(data, stats); cache.at = Date.now();
  } catch (e) { if (!cache.radio) throw e; console.log("keeping the old list:", e.message); }
  return cache.radio;
}
async function picks() {
  if (cache.picks && Date.now() - cache.picksAt < 10 * 60e3) return cache.picks;
  try {
    const j = await loader(PICKS);
    const v = (((j.fields || {}).favs || {}).arrayValue || {}).values || [];
    cache.picks = v.map((x) => x.stringValue).filter((k) => k && k.includes(":")); cache.picksAt = Date.now();
  } catch (e) { cache.picks = cache.picks || []; }
  return cache.picks;
}

// ---------------------------------------------------------------- helpers
const nowToken = (h) => {
  const ap = h.requestEnvelope.context && h.requestEnvelope.context.AudioPlayer;
  return readToken(ap && ap.token);
};
function play(h, R, list, st, { si = 0, skips = 0, speak = "", behavior = "REPLACE_ALL", prev } = {}) {
  const url = st.u[Math.min(si, st.u.length - 1)];
  const token = makeToken(list, st.key, si, skips);
  const rb = h.responseBuilder;
  if (speak) rb.speak(speak);
  rb.addAudioPlayerPlayDirective(behavior, url, token, 0, prev, {
    title: st.n, subtitle: list === "picks" ? "Radio Velvet · Velvet Selection" : `Radio Velvet · ${R.langName(st.c)}`,
    art: new Alexa.ImageHelper().addImageInstance(ART).getImage(),
    backgroundImage: new Alexa.ImageHelper().addImageInstance(ART).getImage(),
  });
  return rb.withShouldEndSession(true).getResponse();
}
const geoNote = (st) => (st.g ? ` It may only play in ${st.g === "AE" ? "the U.A.E." : st.g === "US" ? "the U.S." : st.g === "GB" ? "the U.K." : st.g}.` : "");
const say = (s) => String(s).replace(/&/g, " and ").replace(/[<>]/g, " ");
const HELP = "You can say a station, like: play Radio Mango. Or a language, like: play Malayalam radio. Or say: play the Velvet Selection. While it plays, say Alexa, next, or Alexa, previous, to change station.";
const slotOf = (h, name) => {
  const s = Alexa.getSlot(h.requestEnvelope, name);
  if (!s) return { raw: "", id: null };
  const r = (((s.resolutions || {}).resolutionsPerAuthority || [])[0]) || {};
  const id = r.status && r.status.code === "ER_SUCCESS_MATCH" && r.values && r.values[0] ? r.values[0].value.id : null;
  return { raw: s.value || "", id };
};
const isIntent = (...names) => (h) => Alexa.getRequestType(h.requestEnvelope) === "IntentRequest" && names.includes(Alexa.getIntentName(h.requestEnvelope));
const isType = (...types) => (h) => types.includes(Alexa.getRequestType(h.requestEnvelope));

async function startLanguage(h, R, col, intro = true) {
  const st = R.ranked(col)[0];
  if (!st) return h.responseBuilder.speak(`I don't have ${say(R.langName(col))} stations that play on Alexa yet.`).reprompt(HELP).getResponse();
  return play(h, R, col, st, { speak: intro ? `${say(R.langName(col))} radio. Here's ${say(st.n)}.` : `${say(st.n)}.` });
}

// ---------------------------------------------------------------- handlers
const Launch = {
  canHandle: isType("LaunchRequest"),
  handle(h) {
    return h.responseBuilder.speak("Radio Velvet. Which station would you like? Say a name, like Radio Mango, or a language, like Malayalam.")
      .reprompt("Say a station, or a language like Malayalam.").getResponse();
  },
};

const PlayStation = {
  canHandle: isIntent("PlayStationIntent"),
  async handle(h) {
    const R = await radio();
    const { raw, id } = slotOf(h, "station");
    const cur = nowToken(h);
    let st = id ? R.station(id) : null;
    if (!st && raw) {
      const col = R.findLanguage(raw);                  // "play Tamil" lands here too
      if (col) return startLanguage(h, R, col);
      st = R.findStation(raw, cur ? (R.station(cur.key) || {}).c || "malayalam" : "malayalam");
    }
    if (!st) {
      return h.responseBuilder.speak(raw ? `Sorry, I couldn't find ${say(raw)}. Try another name, or a language like Malayalam.` : "Which station?")
        .reprompt("Say a station name, or a language like Malayalam.").getResponse();
    }
    return play(h, R, st.c, st, { speak: `${say(st.n)}.${geoNote(st)}` });
  },
};

const PlayLanguage = {
  canHandle: isIntent("PlayLanguageIntent"),
  async handle(h) {
    const R = await radio();
    const { raw, id } = slotOf(h, "language");
    const col = (id && R.byCol.has(id)) ? id : R.findLanguage(raw);
    if (!col) {
      const st = raw ? R.findStation(raw) : null;      // "play Mango" can land here
      if (st) return play(h, R, st.c, st, { speak: `${say(st.n)}.${geoNote(st)}` });
      return h.responseBuilder.speak(`Sorry, I don't have ${raw ? say(raw) + " " : "that "}radio. Try Malayalam, Tamil, Hindi, Arabic or English.`)
        .reprompt("Which language?").getResponse();
    }
    return startLanguage(h, R, col);
  },
};

const PlaySelection = {
  canHandle: isIntent("PlaySelectionIntent"),
  async handle(h) {
    const R = await radio();
    const P = await picks();
    const st = R.list("picks", P)[0];
    if (!st) return startLanguage(h, R, "malayalam");
    return play(h, R, "picks", st, { speak: `The Velvet Selection. Here's ${say(st.n)}.` });
  },
};

const WhatsPlaying = {
  canHandle: isIntent("WhatsPlayingIntent"),
  async handle(h) {
    const R = await radio();
    const t = nowToken(h); const st = t && R.station(t.key);
    const ap = h.requestEnvelope.context && h.requestEnvelope.context.AudioPlayer;
    if (!st) return h.responseBuilder.speak("Nothing is playing right now. Say a station, or a language like Malayalam.").reprompt(HELP).getResponse();
    const on = ap && ap.playerActivity === "PLAYING";
    return h.responseBuilder.speak(`${on ? "This is" : "Last playing was"} ${say(st.n)}, from ${say(R.langName(st.c))}${t.list === "picks" ? ", in the Velvet Selection" : ""}.`)
      .withShouldEndSession(true).getResponse();
  },
};

/** next / previous: from a voice request (may speak) or an Echo button (must not speak). */
async function move(h, dir, spoken) {
  const R = await radio();
  const t = nowToken(h);
  if (!t) {
    if (spoken) return h.responseBuilder.speak("Nothing is playing. Say a station, or a language like Malayalam.").reprompt(HELP).getResponse();
    return h.responseBuilder.getResponse();
  }
  const P = t.list === "picks" ? await picks() : null;
  const st = R.step(t.list, t.key, dir, P) || R.station(t.key);
  if (!st) return h.responseBuilder.getResponse();
  return play(h, R, t.list, st, { speak: spoken ? `${say(st.n)}.` : "" });
}
const Next = { canHandle: isIntent("AMAZON.NextIntent"), handle: (h) => move(h, +1, true) };
const Prev = { canHandle: isIntent("AMAZON.PreviousIntent"), handle: (h) => move(h, -1, true) };
const NextButton = { canHandle: isType("PlaybackController.NextCommandIssued"), handle: (h) => move(h, +1, false) };
const PrevButton = { canHandle: isType("PlaybackController.PreviousCommandIssued"), handle: (h) => move(h, -1, false) };

async function resume(h, spoken) {
  const R = await radio();
  const t = nowToken(h); const st = t && R.station(t.key);
  if (!st) {
    if (spoken) return h.responseBuilder.speak("Which station? Say a name, or a language like Malayalam.").reprompt(HELP).getResponse();
    return h.responseBuilder.getResponse();
  }
  return play(h, R, t.list, st, { si: t.si });   // live radio: start from now, not from where it paused
}
const Resume = { canHandle: isIntent("AMAZON.ResumeIntent", "AMAZON.StartOverIntent"), handle: (h) => resume(h, true) };
const PlayButton = { canHandle: isType("PlaybackController.PlayCommandIssued"), handle: (h) => resume(h, false) };

const Pause = {
  canHandle: (h) => isIntent("AMAZON.PauseIntent")(h) || isType("PlaybackController.PauseCommandIssued")(h),
  handle: (h) => h.responseBuilder.addAudioPlayerStopDirective().getResponse(),
};
const StopCancel = {
  canHandle: isIntent("AMAZON.StopIntent", "AMAZON.CancelIntent", "AMAZON.NavigateHomeIntent"),
  handle(h) {
    const ap = h.requestEnvelope.context && h.requestEnvelope.context.AudioPlayer;
    const rb = h.responseBuilder.addAudioPlayerStopDirective();
    if (!(ap && ap.playerActivity === "PLAYING")) rb.speak("Goodbye.");
    return rb.withShouldEndSession(true).getResponse();
  },
};
const NotForRadio = {
  canHandle: isIntent("AMAZON.LoopOnIntent", "AMAZON.LoopOffIntent", "AMAZON.ShuffleOnIntent", "AMAZON.ShuffleOffIntent", "AMAZON.RepeatIntent"),
  handle: (h) => h.responseBuilder.speak("That doesn't work on live radio. Say next or previous to change station.").withShouldEndSession(true).getResponse(),
};
const Help = { canHandle: isIntent("AMAZON.HelpIntent"), handle: (h) => h.responseBuilder.speak(HELP).reprompt("Which station would you like?").getResponse() };
const Fallback = {
  canHandle: isIntent("AMAZON.FallbackIntent"),
  handle: (h) => h.responseBuilder.speak("Sorry, I didn't catch that. Say a station, like Radio Mango, or a language, like Malayalam.").reprompt("Which station?").getResponse(),
};

// ---- the Echo tells the skill how playback is going
const Quiet = { canHandle: isType("AudioPlayer.PlaybackStarted", "AudioPlayer.PlaybackStopped", "AudioPlayer.PlaybackFinished", "SessionEndedRequest", "System.ExceptionEncountered"),
  handle: (h) => h.responseBuilder.getResponse() };
const NearlyFinished = {      // a live stream that ends (some servers cut after hours): queue the same station again
  canHandle: isType("AudioPlayer.PlaybackNearlyFinished"),
  async handle(h) {
    const R = await radio();
    const tok = h.requestEnvelope.request.token; const t = readToken(tok); const st = t && R.station(t.key);
    if (!st) return h.responseBuilder.getResponse();
    return play(h, R, t.list, st, { si: t.si, behavior: "ENQUEUE", prev: tok });
  },
};
const Failed = {              // a stream that won't play: its next link, then the next station (at most 3 skips)
  canHandle: isType("AudioPlayer.PlaybackFailed"),
  async handle(h) {
    const R = await radio();
    const t = readToken(h.requestEnvelope.request.token); const st = t && R.station(t.key);
    console.log("playback failed", t && t.key, JSON.stringify(h.requestEnvelope.request.error || {}));
    if (!st) return h.responseBuilder.getResponse();
    if (t.si + 1 < st.u.length) return play(h, R, t.list, st, { si: t.si + 1, skips: t.skips });
    if (t.skips >= 3) return h.responseBuilder.getResponse();
    const P = t.list === "picks" ? await picks() : null;
    const nx = R.step(t.list, t.key, +1, P);
    if (!nx || nx.key === st.key) return h.responseBuilder.getResponse();
    return play(h, R, t.list, nx, { skips: t.skips + 1 });
  },
};

const Errors = {
  canHandle: () => true,
  handle(h, err) {
    console.log("error", err && err.stack);
    const type = Alexa.getRequestType(h.requestEnvelope);
    if (type.startsWith("AudioPlayer.") || type.startsWith("PlaybackController.")) return h.responseBuilder.getResponse();
    return h.responseBuilder.speak("Sorry, Radio Velvet couldn't do that just now. Please try again.").getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(Launch, PlayStation, PlayLanguage, PlaySelection, WhatsPlaying, Next, Prev, NextButton, PrevButton,
    Resume, PlayButton, Pause, StopCancel, NotForRadio, Help, Fallback, NearlyFinished, Failed, Quiet)
  .addErrorHandlers(Errors)
  .withCustomUserAgent("radio-velvet/1.0")
  .lambda();

// for tests
exports._test = { setLoader: (f) => { loader = f; cache.radio = null; cache.picks = null; }, cache };
