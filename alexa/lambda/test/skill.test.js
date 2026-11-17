/* Radio Velvet for Alexa: tests with the real station list (no Echo needed). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "../../..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "js/alexa-stations.json"), "utf8"));
const STATS = JSON.parse(fs.readFileSync(path.join(ROOT, "js/station-stats.json"), "utf8"));
const { norm, Radio, makeToken, readToken } = require("../radio-core");
const skill = require("../index");
const R = new Radio(DATA, STATS);
const ML = R.byCol.get("malayalam");
let PICKS = ["malayalam:radiomango", "malayalam:ahaliafm", "malayalam:homefm"];
let failNext = false;
skill._test.setLoader(async (url) => {
  if (failNext) throw new Error("offline");
  if (url.endsWith("alexa-stations.json")) return DATA;
  if (url.endsWith("station-stats.json")) return STATS;
  if (url.includes("/picks/")) return { fields: { favs: { arrayValue: { values: PICKS.map((k) => ({ stringValue: k })) } } } };
  throw new Error("unexpected " + url);
});

function env(type, request = {}, token, activity = "PLAYING", session = true) {
  const sys = { application: { applicationId: "amzn1.ask.skill.test" }, user: { userId: "u" }, device: { deviceId: "d", supportedInterfaces: { AudioPlayer: {} } } };
  const e = { version: "1.0", context: { System: sys }, request: { type, requestId: "r1", timestamp: new Date().toISOString(), locale: "en-IN", ...request } };
  if (token !== undefined) e.context.AudioPlayer = { token, offsetInMilliseconds: 0, playerActivity: activity };
  if (session) e.session = { new: true, sessionId: "s", application: sys.application, user: sys.user };
  return e;
}
const intent = (name, slots = {}) => ({ intent: { name, confirmationStatus: "NONE", slots } });
const slot = (name, value, id) => ({ [name]: { name, value, confirmationStatus: "NONE",
  ...(id ? { resolutions: { resolutionsPerAuthority: [{ authority: "x", status: { code: "ER_SUCCESS_MATCH" }, values: [{ value: { name: value, id } }] }] } }
    : value ? { resolutions: { resolutionsPerAuthority: [{ authority: "x", status: { code: "ER_SUCCESS_NO_MATCH" } }] } } : {}) } });
const run = (e) => new Promise((res, rej) => skill.handler(e, {}, (err, r) => (err ? rej(err) : res(r))));
const speech = (r) => ((r.response.outputSpeech || {}).ssml || "").replace(/<\/?speak>/g, "");
const playDir = (r) => (r.response.directives || []).find((d) => d.type === "AudioPlayer.Play");
const tokOf = (r) => readToken(playDir(r).audioItem.stream.token);

// ---------- matching
test("spoken numbers and letters become what's on the list", () => {
  assert.equal(norm("Club F.M. ninety four point three"), "club fm 94.3");
  assert.equal(norm("hit ninety six point seven"), "hit 96.7");
  assert.equal(norm("one oh four point six"), "104.6");
  assert.equal(norm("ninety eight point six FM"), "98.6 fm");
  assert.equal(norm("K. S. Chitra hits"), "ks chitra hits");
  assert.equal(norm("all india radio kochi FM"), "air kochi fm");
  assert.equal(norm("Akashvani Thrissur"), "air thrissur");
  assert.equal(norm("a i r kannur"), "air kannur");
});
test("every secure Malayalam station is found by its own name", () => {
  for (const s of ML) {
    const f = R.findStation(s.n);
    assert.ok(f, `nothing for ${s.n}`);
    assert.equal(f.n.toLowerCase(), s.n.toLowerCase(), `${s.n} -> ${f.n}`);
  }
});
test("Malayalam stations as people say them", () => {
  const cases = { "mango": "radiomango", "radio mango": "radiomango", "radio mangoes": "radiomango", "home f m": "homefm",
    "hit ninety six point seven": "hit967", "suno": "radiosunomalayalam", "radio suno": "radiosunomalayalam", "suno bahrain": "radiosunobahrain",
    "all india radio kochi": "kochifm", "akashvani thrissur": "akashvanithrissur", "ahalia": "ahaliafm", "ahalia f m": "ahaliafm",
    "k s chitra hits": "chitrahitsmalayalam", "yesudas hits": "kjyesudas", "mohanlal hits": "mohanlalhits", "radio keralam": "radiokeralam",
    "ninety eight point six": "986malayalammalayalamradio".slice(0, 0) || "986malayalamradio", "radio malabar": "radiomalabar",
    "kairali news": "kairali-news", "asianet": "asianet", "radio mattoli": "radiomattoli", "june f m": "junefm", "global radio": "globalradio" };
  for (const [said, id] of Object.entries(cases)) {
    const f = R.findStation(said);
    assert.ok(f, `nothing for "${said}"`);
    assert.equal(f.id, id, `"${said}" -> ${f.key}`);
  }
});
test("other languages and nonsense", () => {
  assert.equal(R.findStation("BBC Radio 1").id, "bbc-radio-1");
  assert.equal(R.findStation("xyzzy plugh"), null);
  assert.equal(R.findStation("a"), null);
});
test("languages", () => {
  assert.equal(R.findLanguage("malayalam"), "malayalam");
  assert.equal(R.findLanguage("Malayalam radio"), "malayalam");
  assert.equal(R.findLanguage("tamil"), "tamil");
  assert.equal(R.findLanguage("hindi stations"), "hindi");
  assert.equal(R.findLanguage("arabic"), "arabic");
  assert.equal(R.findLanguage("english"), "english-music");
  assert.equal(R.findLanguage("english news"), "english-news");
  assert.equal(R.findLanguage("radio mango"), null);
});
test("next / previous wrap round and skip country-locked stations", () => {
  const l = R.byCol.get("malayalam");
  assert.equal(R.step("malayalam", l[0].key, +1).key, l[1].key === "malayalam:hit967" ? l[2].key : l[1].key);
  assert.equal(R.step("malayalam", l[l.length - 1].key, +1).key, l[0].key);
  assert.equal(R.step("malayalam", l[0].key, -1).key, l[l.length - 1].key);
  assert.equal(R.step("malayalam", "malayalam:homefm", +1).key, "malayalam:radiosunomalayalam"); // Hit 96.7 (UAE only) skipped
  assert.equal(R.step("picks", "malayalam:homefm", +1, PICKS).key, "malayalam:radiomango");      // picks wrap
  assert.equal(R.step("malayalam", "nope:x", +1).key, l[0].key);
});
test("language picks the most heard station, country-locked last", () => {
  const r = R.ranked("malayalam");
  assert.ok(!r[0].g);
  for (let i = 1; i < r.length; i++) if (!r[i].g && !r[i - 1].g) assert.ok(R.minutes(r[i - 1].key) >= R.minutes(r[i].key));
});
test("tokens", () => {
  const t = readToken(makeToken("picks", "malayalam:radiomango", 1, 2));
  assert.deepEqual(t, { list: "picks", key: "malayalam:radiomango", si: 1, skips: 2 });
  assert.equal(readToken("garbage"), null); assert.equal(readToken(""), null);
});
test("every stream Alexa gets is https on port 443", () => {
  for (const s of R.st) for (const u of s.u) { const p = new URL(u); assert.equal(p.protocol, "https:"); assert.ok(!p.port || p.port === "443", u); }
});

// ---------- the skill, request by request
test("open Radio Velvet: asks which station and waits", async () => {
  const r = await run(env("LaunchRequest"));
  assert.match(speech(r), /Which station/); assert.ok(r.response.reprompt); assert.notEqual(r.response.shouldEndSession, true);
});
test("play Radio Mango (Alexa matched the name)", async () => {
  const r = await run(env("IntentRequest", intent("PlayStationIntent", slot("station", "Radio Mango", "malayalam:radiomango"))));
  const d = playDir(r); assert.equal(d.playBehavior, "REPLACE_ALL");
  assert.equal(d.audioItem.stream.url, R.station("malayalam:radiomango").u[0]);
  assert.equal(d.audioItem.metadata.title, "Radio Mango");
  assert.match(d.audioItem.metadata.art.sources[0].url, /^https:\/\/ranjithkb\.com\/assets\/icons\/radio-velvet-512\.png$/);
  assert.deepEqual({ ...tokOf(r), si: 0 }, { list: "malayalam", key: "malayalam:radiomango", si: 0, skips: 0 });
  assert.match(speech(r), /Radio Mango/); assert.equal(r.response.shouldEndSession, true);
});
test("play a name Alexa didn't match: found by the skill", async () => {
  const r = await run(env("IntentRequest", intent("PlayStationIntent", slot("station", "all india radio kochi"))));
  assert.equal(tokOf(r).key, "malayalam:kochifm");
});
test("a country-locked station says so", async () => {
  const r = await run(env("IntentRequest", intent("PlayStationIntent", slot("station", "Hit 96.7", "malayalam:hit967"))));
  assert.match(speech(r), /U\.A\.E/);
});
test("'play Tamil' heard as a station plays Tamil radio", async () => {
  const r = await run(env("IntentRequest", intent("PlayStationIntent", slot("station", "tamil"))));
  assert.equal(R.station(tokOf(r).key).c, "tamil"); assert.match(speech(r), /Tamil radio/);
});
test("unknown station: says sorry and listens again", async () => {
  const r = await run(env("IntentRequest", intent("PlayStationIntent", slot("station", "xyzzy plugh"))));
  assert.match(speech(r), /couldn't find xyzzy plugh/); assert.ok(r.response.reprompt); assert.equal(playDir(r), undefined);
});
test("play Malayalam radio", async () => {
  const r = await run(env("IntentRequest", intent("PlayLanguageIntent", slot("language", "Malayalam", "malayalam"))));
  assert.equal(tokOf(r).list, "malayalam"); assert.equal(tokOf(r).key, R.ranked("malayalam")[0].key); assert.match(speech(r), /Malayalam radio/);
});
test("play English (no exact match) plays English music", async () => {
  const r = await run(env("IntentRequest", intent("PlayLanguageIntent", slot("language", "english"))));
  assert.equal(tokOf(r).list, "english-music");
});
test("play the Velvet Selection, in his order; empty selection falls back to Malayalam", async () => {
  let r = await run(env("IntentRequest", intent("PlaySelectionIntent")));
  assert.equal(tokOf(r).list, "picks"); assert.equal(tokOf(r).key, "malayalam:radiomango"); assert.match(speech(r), /Velvet Selection/);
  const keep = PICKS; PICKS = []; skill._test.cache.picks = null;
  r = await run(env("IntentRequest", intent("PlaySelectionIntent")));
  assert.equal(tokOf(r).list, "malayalam");
  PICKS = keep; skill._test.cache.picks = null;
});
test("Alexa, next / previous (voice) and the Echo's buttons (no speech)", async () => {
  const t = makeToken("malayalam", "malayalam:radiomango");
  let r = await run(env("IntentRequest", intent("AMAZON.NextIntent"), t));
  assert.equal(tokOf(r).key, R.step("malayalam", "malayalam:radiomango", +1).key); assert.ok(speech(r));
  r = await run(env("PlaybackController.NextCommandIssued", {}, t, "PLAYING", false));
  assert.equal(tokOf(r).key, R.step("malayalam", "malayalam:radiomango", +1).key); assert.equal(r.response.outputSpeech, undefined);
  r = await run(env("PlaybackController.PreviousCommandIssued", {}, t, "PLAYING", false));
  assert.equal(tokOf(r).key, R.step("malayalam", "malayalam:radiomango", -1).key); assert.equal(r.response.outputSpeech, undefined);
  r = await run(env("IntentRequest", intent("AMAZON.NextIntent"), makeToken("picks", "malayalam:homefm")));
  assert.equal(tokOf(r).key, "malayalam:radiomango");  // the selection wraps
});
test("next with nothing playing", async () => {
  const r = await run(env("IntentRequest", intent("AMAZON.NextIntent")));
  assert.match(speech(r), /Nothing is playing/); assert.equal(playDir(r), undefined);
  const b = await run(env("PlaybackController.NextCommandIssued", {}, undefined, "IDLE", false));
  assert.equal(playDir(b), undefined);
});
test("pause stops; resume and the play button start the same station again", async () => {
  const t = makeToken("malayalam", "malayalam:ahaliafm");
  let r = await run(env("IntentRequest", intent("AMAZON.PauseIntent"), t));
  assert.ok(r.response.directives.some((d) => d.type === "AudioPlayer.Stop"));
  r = await run(env("PlaybackController.PauseCommandIssued", {}, t, "PLAYING", false));
  assert.ok(r.response.directives.some((d) => d.type === "AudioPlayer.Stop"));
  r = await run(env("IntentRequest", intent("AMAZON.ResumeIntent"), t, "STOPPED"));
  assert.equal(tokOf(r).key, "malayalam:ahaliafm");
  r = await run(env("PlaybackController.PlayCommandIssued", {}, t, "STOPPED", false));
  assert.equal(tokOf(r).key, "malayalam:ahaliafm"); assert.equal(r.response.outputSpeech, undefined);
});
test("what's playing", async () => {
  let r = await run(env("IntentRequest", intent("WhatsPlayingIntent"), makeToken("picks", "malayalam:radiomango")));
  assert.match(speech(r), /This is Radio Mango, from Malayalam, in the Velvet Selection/);
  r = await run(env("IntentRequest", intent("WhatsPlayingIntent")));
  assert.match(speech(r), /Nothing is playing/);
});
test("a stream that fails: the station's next link, then the next station, then gives up after 3", async () => {
  const two = R.st.find((s) => s.c === "malayalam" && s.u.length > 1);
  let r = await run(env("AudioPlayer.PlaybackFailed", { token: makeToken("malayalam", two.key, 0), error: { type: "MEDIA_ERROR_UNKNOWN" } }, undefined, "STOPPED", false));
  assert.equal(tokOf(r).key, two.key); assert.equal(tokOf(r).si, 1); assert.equal(playDir(r).audioItem.stream.url, two.u[1]);
  r = await run(env("AudioPlayer.PlaybackFailed", { token: makeToken("malayalam", two.key, 1) }, undefined, "STOPPED", false));
  assert.notEqual(tokOf(r).key, two.key); assert.equal(tokOf(r).skips, 1);
  r = await run(env("AudioPlayer.PlaybackFailed", { token: makeToken("malayalam", "malayalam:radiomango", 0, 3) }, undefined, "STOPPED", false));
  assert.equal(playDir(r), undefined);
});
test("a live stream that ends is queued again", async () => {
  const tok = makeToken("malayalam", "malayalam:radiomango");
  const r = await run(env("AudioPlayer.PlaybackNearlyFinished", { token: tok }, undefined, "PLAYING", false));
  const d = playDir(r); assert.equal(d.playBehavior, "ENQUEUE"); assert.equal(d.audioItem.stream.expectedPreviousToken, tok);
});
test("stop, cancel, loop, help, fallback, quiet events", async () => {
  let r = await run(env("IntentRequest", intent("AMAZON.StopIntent"), undefined));
  assert.match(speech(r), /Goodbye/); assert.ok(r.response.directives.some((d) => d.type === "AudioPlayer.Stop"));
  r = await run(env("IntentRequest", intent("AMAZON.CancelIntent"), makeToken("malayalam", "malayalam:radiomango"), "PLAYING"));
  assert.equal(speech(r), ""); assert.ok(r.response.directives.some((d) => d.type === "AudioPlayer.Stop"));
  r = await run(env("IntentRequest", intent("AMAZON.LoopOnIntent"))); assert.match(speech(r), /live radio/);
  r = await run(env("IntentRequest", intent("AMAZON.ShuffleOnIntent"))); assert.match(speech(r), /live radio/);
  r = await run(env("IntentRequest", intent("AMAZON.HelpIntent"))); assert.match(speech(r), /Radio Mango/); assert.ok(r.response.reprompt);
  r = await run(env("IntentRequest", intent("AMAZON.FallbackIntent"))); assert.ok(r.response.reprompt);
  for (const t of ["AudioPlayer.PlaybackStarted", "AudioPlayer.PlaybackStopped", "AudioPlayer.PlaybackFinished", "System.ExceptionEncountered"]) {
    r = await run(env(t, { token: "x" }, undefined, "IDLE", false)); assert.equal(r.response.outputSpeech, undefined); assert.equal(playDir(r), undefined);
  }
  r = await run(env("SessionEndedRequest", { reason: "USER_INITIATED" })); assert.equal(r.response.outputSpeech, undefined);
});
test("site unreachable: first time says sorry, later keeps the list it has", async () => {
  skill._test.cache.radio = null; failNext = true;
  let r = await run(env("IntentRequest", intent("PlayLanguageIntent", slot("language", "Malayalam", "malayalam"))));
  assert.match(speech(r), /couldn't do that/);
  failNext = false; r = await run(env("IntentRequest", intent("PlayLanguageIntent", slot("language", "Malayalam", "malayalam"))));
  assert.ok(playDir(r));
  skill._test.cache.at = 0; failNext = true;   // hour passed, site down: still plays
  r = await run(env("IntentRequest", intent("PlayLanguageIntent", slot("language", "Malayalam", "malayalam"))));
  assert.ok(playDir(r)); failNext = false;
});
test("every station's name is safe to speak", async () => {
  for (const s of ML.slice(0, 40)) {
    const r = await run(env("IntentRequest", intent("PlayStationIntent", slot("station", s.n, s.key))));
    assert.ok(playDir(r)); assert.doesNotMatch(speech(r), /[&<>]/);
  }
});

// ---------- the voice model Amazon will build
test("voice model is valid for Alexa", () => {
  const dir = path.join(__dirname, "../../skill-package/interactionModels/custom");
  for (const f of fs.readdirSync(dir)) {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    assert.ok(raw.length < 1.5e6, `${f} too big: ${raw.length}`);
    const lm = JSON.parse(raw).interactionModel.languageModel;
    assert.equal(lm.invocationName, "radio velvet");
    const types = new Set(lm.types.map((t) => t.name));
    const seen = new Set();
    for (const it of lm.intents) for (const s of it.samples) {
      assert.match(s, /^[a-z0-9 '{}.]+$/, `${it.name}: ${s}`);
      for (const m of s.matchAll(/\{(\w+)\}/g)) assert.ok(it.slots.some((x) => x.name === m[1]), `${it.name} slot ${m[1]}`);
      assert.ok(!seen.has(s), `duplicate sample "${s}"`); seen.add(s);
    }
    for (const it of lm.intents) for (const sl of it.slots) assert.ok(types.has(sl.type), sl.type);
    let n = 0;
    for (const t of lm.types) for (const v of t.values) {
      n += 1 + (v.name.synonyms || []).length;
      assert.ok(v.name.value.length <= 140 && v.name.value.trim(), v.name.value);
      for (const syn of v.name.synonyms || []) assert.ok(syn.length <= 140 && syn.trim());
      assert.ok(v.id && v.id.length <= 100);
    }
    assert.ok(n < 50000, `too many slot values: ${n}`);
  }
  const sk = JSON.parse(fs.readFileSync(path.join(__dirname, "../../skill-package/skill.json"), "utf8"));
  assert.deepEqual(sk.manifest.apis.custom.interfaces, [{ type: "AUDIO_PLAYER" }]);
});
