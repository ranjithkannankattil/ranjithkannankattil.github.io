/* Radio Velvet for Alexa: the parts that don't talk to Alexa (station matching, lists, tokens).
   Kept apart so tests can run them without an Echo. */
"use strict";

const ONES = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** "Club F.M. ninety four point three" -> "club fm 94.3" */
function norm(s) {
  let t = String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/\+/g, " plus ")
    .replace(/\b([a-z])\.(?=[a-z]\.)/g, "$1").replace(/\b([a-z])\.(?=\s|$)/g, "$1")   // f.m. -> fm
    .replace(/[^a-z0-9.\s]/g, " ").replace(/\s+/g, " ").trim();
  // spoken numbers -> digits
  const w = t.split(" "), out = [];
  for (let i = 0; i < w.length; i++) {
    let n = null, j = i;
    if (w[j] in TENS) { n = TENS[w[j]]; j++; if (w[j] in ONES && ONES[w[j]] < 10) { n += ONES[w[j]]; j++; } }
    else if (w[j] in ONES) {
      n = ONES[w[j]]; j++;
      if (w[j] === "hundred") { n *= 100; j++; if (w[j] in TENS) { n += TENS[w[j]]; j++; if (w[j] in ONES && ONES[w[j]] < 10) { n += ONES[w[j]]; j++; } } else if (w[j] in ONES) { n += ONES[w[j]]; j++; } }
      else if (n < 10 && w[j] in ONES && ONES[w[j]] < 10) {               // "one oh four" -> 104
        let digits = String(n); while (w[j] in ONES && ONES[w[j]] < 10) { digits += ONES[w[j]]; j++; }
        n = Number(digits);
      }
    }
    if (n === null) { out.push(w[i]); continue; }
    let num = String(n);
    if (w[j] === "point" && w[j + 1] in ONES && ONES[w[j + 1]] < 10) {
      j++; num += "."; while (w[j] in ONES && ONES[w[j]] < 10) { num += ONES[w[j]]; j++; }
    }
    out.push(num); i = j - 1;
  }
  let r = out.join(" ").replace(/\s+/g, " ").trim();
  r = r.replace(/\b(?:[a-z] )+[a-z]\b/g, (m) => m.replace(/ /g, ""));          // "k s chitra" -> "ks chitra", "a i r" -> "air"
  r = r.replace(/\ball india radio\b|\bakashvani\b|\baakashvani\b/g, "air");
  r = r.replace(/\bf m\b/g, "fm").replace(/(?<!\d)\.|\.(?!\d)/g, " ").replace(/\s+/g, " ").trim();
  return r;
}

const FREQ = /\b\d{2,3}(\.\d{1,2})?\b/g;
function variants(name) {
  const a = norm(name), v = new Set([a]);
  const nofreq = a.replace(FREQ, " ").replace(/\s+/g, " ").trim(); if (nofreq.length >= 3) v.add(nofreq);
  for (const x of [...v]) {
    const y = x.replace(/^radio /, ""); if (y.length >= 3 && y !== "fm") v.add(y);
    const z = x.replace(/ (fm|radio)$/, ""); if (z.length >= 3) v.add(z);
    const w = x.replace(/^the /, "").replace(/ station$/, ""); if (w.length >= 3) v.add(w);
  }
  // a leftover like "radio" or "fm" alone would match everything: keep variants with a real word or a number
  const keep = [...v].filter((x) => x.split(" ").some((t) => !GENERIC.has(t)));
  return keep.length ? keep : [a];                     // "Music FM" is all generic words: its full name still counts
}
const GENERIC = new Set(["radio", "fm", "am", "air", "online", "live", "music", "hits", "the", "station", "channel", "tv", "news",
  "digital", "hd", "web", "stream", "and", "of", "in"]);

function lev(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

function score(q, v) {
  if (q === v) return 100;
  const min = Math.min(q.length, v.length);
  if (min >= 4 && (v.startsWith(q + " ") || q.startsWith(v + " "))) return 86;
  const qt = new Set(q.split(" ")), vt = new Set(v.split(" "));
  let common = 0; for (const t of qt) if (vt.has(t)) common++;
  const jac = common / (qt.size + vt.size - common);
  const mx = Math.max(q.length, v.length);
  if (Math.abs(q.length - v.length) > 0.4 * mx) return jac * 80;   // too different in length to be a near-spelling
  if (!common && q[0] !== v[0] && q.slice(-2) !== v.slice(-2)) return 0;   // no shared word, start or ending: not this one
  const sim = 1 - lev(q, v) / mx;
  return Math.max(jac * 80, sim * 84);
}

/** Data as published in js/alexa-stations.json, plus this week's minutes (js/station-stats.json). */
class Radio {
  constructor(data, stats) {
    this.langs = data.langs || [];
    this.st = (data.st || []).map((s, i) => ({ ...s, key: `${s.c}:${s.id}`, i, v: variants(s.n) }));
    this.byKey = new Map(this.st.map((s) => [s.key, s]));
    this.byCol = new Map();
    for (const s of this.st) { if (!this.byCol.has(s.c)) this.byCol.set(s.c, []); this.byCol.get(s.c).push(s); }
    this.week = (stats && stats.week) || {};
    this.langVariants = this.langs.map((l) => ({ id: l.id, v: [norm(l.n), norm(l.n.replace(/\(.*\)/, ""))] }));
  }
  station(key) { return this.byKey.get(key) || null; }
  langName(id) { const l = this.langs.find((x) => x.id === id); return l ? l.n : id; }
  minutes(key) { return Number(this.week[key] || 0); }

  /** A spoken language name -> collection id, or null. */
  findLanguage(spoken) {
    const q = norm(spoken).replace(/ (radio|stations?|songs|music)$/, "").trim();
    if (!q) return null;
    if (q === "english") return this.byCol.has("english-music") ? "english-music" : null;
    let best = null, bs = 0;
    for (const l of this.langVariants) for (const v of l.v) { const s = score(q, v); if (s > bs) { bs = s; best = l.id; } }
    return bs >= 80 ? best : null;
  }

  /** A spoken station name -> the best station, preferring [prefer] (a language), then stations people play more. */
  findStation(spoken, prefer = "malayalam") {
    const q = norm(spoken).replace(/^(the|a) /, "").replace(/ (station|channel|please)$/, "").trim();
    if (q.length < 2) return null;
    let best = null, bs = 0;
    for (const s of this.st) {
      let sc = 0; for (const v of s.v) { const x = score(q, v); if (x > sc) sc = x; }
      if (sc < 50) continue;
      sc += (s.c === prefer ? 6 : 0) + Math.min(4, Math.log10(1 + this.minutes(s.key))) - (s.g ? 3 : 0);
      if (sc > bs) { bs = sc; best = s; }
    }
    return bs >= 62 ? best : null;
  }

  /** The stations of one language, most heard this week first; country-locked ones last. */
  ranked(col) {
    const l = (this.byCol.get(col) || []).slice();
    return l.sort((a, b) => (a.g ? 1 : 0) - (b.g ? 1 : 0) || this.minutes(b.key) - this.minutes(a.key) || a.i - b.i);
  }

  /** The list next/previous move through: a language (site order) or the Velvet Selection (his order). */
  list(listId, picks) {
    if (listId === "picks") return (picks || []).map((k) => this.byKey.get(k)).filter(Boolean);
    return this.byCol.get(listId) || [];
  }

  /** Next (+1) or previous (-1) station in a list, wrapping, skipping country-locked ones. */
  step(listId, key, dir, picks) {
    const l = this.list(listId, picks);
    if (!l.length) return null;
    let i = l.findIndex((s) => s.key === key);
    if (i < 0) i = dir > 0 ? -1 : 0;
    for (let n = 1; n <= l.length; n++) {
      const s = l[(i + dir * n + l.length * n) % l.length];
      if (!s.g || l.length === 1) return s;
    }
    return l[(i + dir + l.length) % l.length];
  }
}

/** What the Echo remembers about what's playing: list ~ station ~ stream number ~ skips ~ a time (keeps tokens unique). */
function makeToken(list, key, si = 0, skips = 0) { return [list, key, si, skips, Date.now().toString(36)].join("~"); }
function readToken(t) {
  const p = String(t || "").split("~");
  if (p.length < 4 || !p[1].includes(":")) return null;
  return { list: p[0], key: p[1], si: Number(p[2]) || 0, skips: Number(p[3]) || 0 };
}

module.exports = { norm, variants, score, lev, Radio, makeToken, readToken };
