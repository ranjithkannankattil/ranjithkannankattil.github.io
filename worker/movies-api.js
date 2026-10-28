// Cloudflare Worker: the data side of ranjithkb.com/movies.html.
// It holds the TMDB and OMDb keys (as secrets, never in the public repo), corrects misspelt
// searches, builds the "similar films" rows and caches everything at Cloudflare's edge.
// Visitors' browsers only ever talk to this Worker, so TMDB and OMDb never see who is looking.
//
// Secrets (Workers → movies-api → Settings → Variables and Secrets):
//   TMDB_KEY  a TMDB "API Key" (v3, 32 characters) or "API Read Access Token" (v4, long)
//   OMDB_KEY  an OMDb API key (free tier: 1,000 requests a day; answers are cached for a week)
//
// Routes (all GET, all JSON except /img):
//   /search?q=intersteller            films + people, spell-corrected when needed
//   /movie/{id}                       one film, every rating, cast, crew, streaming, rows to show
//   /row/{id}/{kind}?lang=ml&page=1   one row of related films (kind: more, thread, thrill, genre,
//                                     world, language, era, franchise, remakes)
//   /person/{id}?role=cast|crew|director|writer|composer|dop   a person and their films
//   /home?region=IT                   rows for the opening page
//   /match?imdb=tt0816692 | ?title=Interstellar&year=2014      one film id, for CSV imports
//   /lite/{id}                        the small film summary saved with each logged watch
//   /img/{size}/{file}                TMDB poster/photo, proxied so visitors' IPs stay here

const ALLOW = ["https://ranjithkb.com", "https://www.ranjithkb.com", "http://localhost:8765", "http://127.0.0.1:8765"];
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const DAY = 86400;

// TMDB plot keywords that say nothing about the story
const BORING_KW = new Set([
  "duringcreditsstinger", "aftercreditsstinger", "woman director", "based on novel or book", "sequel",
  "remake", "biography", "based on true story", "based on comic", "3d", "imax", "anime", "live action",
  "independent film", "black and white", "silent film", "short film", "lgbt", "musical", "christmas",
  "based on play or musical", "duringcreditsstinger", "female protagonist", "male protagonist", "new york city",
  "los angeles, california", "london, england", "paris, france", "1970s", "1980s", "1990s", "2000s", "1960s",
  "1950s", "1940s", "19th century", "20th century", "21st century", "based on short story", "based on video game",
  "based on tv series", "superhero", "marvel cinematic universe (mcu)", "dc extended universe (dceu)"
]);
// keywords that carry a film's mood and intensity: used by the "Same thrill" row
const MOOD_KW = /psychological|suspense|twist|slow burn|tense|dark|mind ?bend|paranoi|claustrophob|cat and mouse|neo-noir|noir|haunt|dread|survival|heist|revenge|serial killer|conspiracy|mystery|whodunit|gritty|violent|disturbing|feel.?good|heartwarming|bittersweet|melancholy|tragic|coming of age|absurd|satire|dark comedy|black comedy|thought provoking|surreal|nonlinear|time loop|dystopi|post-apocalyptic|crime boss|gangster|investigation|manhunt|hostage|chase|fight|martial arts|kidnapping|family drama|romantic/i;

const LANGS = { en: "English", ml: "Malayalam", hi: "Hindi", ta: "Tamil", te: "Telugu", kn: "Kannada", bn: "Bengali", mr: "Marathi", ko: "Korean", ja: "Japanese", zh: "Chinese", cn: "Cantonese", it: "Italian", fr: "French", es: "Spanish", de: "German", pt: "Portuguese", ru: "Russian", tr: "Turkish", fa: "Persian", ar: "Arabic", sv: "Swedish", da: "Danish", no: "Norwegian", pl: "Polish", th: "Thai", id: "Indonesian", nl: "Dutch", el: "Greek", he: "Hebrew", hu: "Hungarian", cs: "Czech", fi: "Finnish", ro: "Romanian", uk: "Ukrainian", tl: "Tagalog", ur: "Urdu", pa: "Punjabi", gu: "Gujarati", si: "Sinhala", vi: "Vietnamese", ms: "Malay" };

// ---------------------------------------------------------------- text matching

// lowercase, accents off, "&" as "and", punctuation and leading articles out
export function norm(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/['’`]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    .replace(/^(the|a|an|il|la|le|lo|les|el|los|las|der|die|das) /, "").replace(/\s+/g, " ");
}
function bigrams(s) { const t = ` ${s} `, m = new Map(); for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; }
function dice(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b); let both = 0, na = 0, nb = 0;
  for (const v of A.values()) na += v;
  for (const [g, v] of B) { nb += v; if (A.has(g)) both += Math.min(v, A.get(g)); }
  return (2 * both) / (na + nb);
}
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 12) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// how well what was typed matches one title, 0..1 (prefix typing counts as a strong match)
export function sim(q, title) {
  const a = norm(q), b = norm(title);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.startsWith(a) && a.length >= 3) return 0.9 + 0.1 * (a.length / b.length);
  const d = dice(a, b);
  const l = 1 - lev(a, b) / Math.max(a.length, b.length);
  // word-level: every typed word close to some title word
  const qw = a.split(" "), tw = b.split(" ");
  const words = qw.reduce((s, w) => s + Math.max(...tw.map((x) => (x === w ? 1 : x.startsWith(w) ? 0.9 : dice(w, x)))), 0) / qw.length;
  return Math.max(d, l, words * 0.95);
}

// ---------------------------------------------------------------- plumbing

function corsFor(req) {
  const origin = req.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": ALLOW.includes(origin) ? origin : ALLOW[0], "Vary": "Origin" };
}
const json = (data, cors, ttl = 0, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": ttl ? `public, max-age=${Math.min(ttl, 3600)}` : "no-store" }
});

let ENV = {};
async function tmdb(path, params = {}, ttl = DAY) {
  const u = new URL(TMDB + path);
  const key = ENV.TMDB_KEY || "";
  const headers = { accept: "application/json" };
  if (key.length > 40) headers.Authorization = `Bearer ${key}`; else u.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  // cache key leaves the secret out
  const ck = new Request("https://cache.movies/tmdb" + path + "?" + [...u.searchParams].filter(([k]) => k !== "api_key").map(([k, v]) => `${k}=${v}`).sort().join("&"));
  const cache = globalThis.caches ? caches.default : null;
  if (cache) { const hit = await cache.match(ck); if (hit) return hit.json(); }
  const r = await fetch(u, { headers });
  if (!r.ok) { if (r.status === 404) return null; throw new Error(`TMDB ${r.status}`); }
  const data = await r.json();
  if (cache) ENV.ctx?.waitUntil(cache.put(ck, new Response(JSON.stringify(data), { headers: { "Cache-Control": `max-age=${ttl}` } })));
  return data;
}
async function cached(name, ttl, make) {
  const cache = globalThis.caches ? caches.default : null;
  const ck = new Request("https://cache.movies/" + encodeURIComponent(name));
  if (cache) { const hit = await cache.match(ck); if (hit) return hit.json(); }
  const data = await make();
  if (cache && data) ENV.ctx?.waitUntil(cache.put(ck, new Response(JSON.stringify(data), { headers: { "Cache-Control": `max-age=${ttl}` } })));
  return data;
}

const year = (d) => (d ? Number(String(d).slice(0, 4)) || null : null);
// the compact film card every row uses
const card = (m) => ({ id: m.id, t: m.title || m.name, ot: m.original_title && m.original_title !== m.title ? m.original_title : undefined, y: year(m.release_date), l: m.original_language, p: m.poster_path || null, v: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null, n: m.vote_count || 0, pop: m.popularity || 0 });
const dedupe = (list, skip) => { const seen = new Set(skip ? [skip] : []); return list.filter((m) => m && !seen.has(m.id) && seen.add(m.id)); };

// ---------------------------------------------------------------- search

async function wikiSuggest(q) {
  return cached("wiki:" + norm(q), 7 * DAY, async () => {
    const u = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srinfo=suggestion&srlimit=6&srprop=&format=json&origin=*`;
    try {
      const r = await fetch(u, { headers: { "User-Agent": "ranjithkb.com movie finder (hello@ranjithkb.com)" } });
      if (!r.ok) return { s: null, titles: [] };
      const d = await r.json();
      const titles = (d.query?.search || []).map((x) => x.title);
      return { s: d.query?.searchinfo?.suggestion || null, titles };
    } catch { return { s: null, titles: [] }; }
  });
}
// "Interstellar (film)" → "Interstellar"; "Drishyam (2013 film)" → title + year
function cleanWikiTitle(t) {
  const m = String(t).match(/^(.*?)\s*\((?:(\d{4}) )?(?:[\w\s-]*film|[\w\s-]*movie)\)$/i);
  return m ? { q: m[1], y: m[2] ? Number(m[2]) : null, film: true } : { q: t, y: null, film: false };
}
function scoreMovie(q, m) {
  const s = Math.max(sim(q, m.title), sim(q, m.original_title || ""), ...(m._alt || []).map((a) => sim(q, a)));
  const popular = Math.min(1, Math.log10(1 + (m.vote_count || 0)) / 4);  // 10,000 votes → 1
  return s * 0.8 + popular * 0.2;
}

export async function search(q, opts = {}) {
  q = String(q || "").trim().slice(0, 120);
  if (q.length < 2) return { q, movies: [], people: [] };
  let yr = null;
  const ym = q.match(/^(.*\S)\s+\(?((?:19|20)\d{2})\)?$/);
  let base = q;
  if (ym) { base = ym[1]; yr = Number(ym[2]); }

  const [mv, pp] = await Promise.all([
    tmdb("/search/movie", { query: base, include_adult: false, year: yr || undefined }, DAY),
    tmdb("/search/person", { query: base, include_adult: false }, DAY),
  ]);
  let movies = (mv?.results || []).map((m) => ({ ...m, _s: scoreMovie(base, m) }));
  let people = (pp?.results || []).filter((p) => p.known_for_department).map((p) => ({ ...p, _s: sim(base, p.name) * 0.8 + Math.min(1, (p.popularity || 0) / 30) * 0.2 }));

  const best = Math.max(0, ...movies.map((m) => sim(base, m.title)), ...movies.map((m) => sim(base, m.original_title || "")));
  const bestP = Math.max(0, ...people.map((p) => sim(base, p.name)));
  let corrected = null;

  // weak matches: ask Wikipedia how it would spell it, then search again with that
  if (opts.correct !== false && Math.max(best, bestP) < 0.86) {
    const w = await wikiSuggest(base);
    const tries = [];
    if (w.s && norm(w.s) !== norm(base)) tries.push({ q: w.s, y: null, film: false });
    for (const t of w.titles.slice(0, 4)) { const c = cleanWikiTitle(t); if (sim(base, c.q) > 0.5) tries.push(c); }
    const seen = new Set([norm(base)]);
    const uniq = tries.filter((t) => { const k = norm(t.q) + (t.y || ""); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3);
    const extra = await Promise.all(uniq.map(async (t) => {
      const [m2, p2] = await Promise.all([
        tmdb("/search/movie", { query: t.q, include_adult: false, year: t.y || yr || undefined }, DAY),
        t.film ? null : tmdb("/search/person", { query: t.q, include_adult: false }, DAY),
      ]);
      return { t, m: m2?.results || [], p: p2?.results || [] };
    }));
    let bestFix = null, bestFixScore = Math.max(best, bestP);
    for (const e of extra) {
      for (const m of e.m) {
        const s = Math.max(sim(e.t.q, m.title), sim(e.t.q, m.original_title || ""));
        const typed = Math.max(sim(base, m.title), sim(base, m.original_title || ""));
        const yearBonus = e.t.y && year(m.release_date) === e.t.y ? 0.05 : 0;
        // must match the corrected spelling closely and still resemble what was typed
        if (s >= 0.9 && typed >= 0.45) {
          movies.push({ ...m, _s: scoreMovie(e.t.q, m) + yearBonus });
          if (s + yearBonus > bestFixScore) { bestFixScore = s + yearBonus; bestFix = m.title; }
        }
      }
      for (const p of e.p) {
        const s = sim(e.t.q, p.name);
        if (s >= 0.9 && p.known_for_department) {
          people.push({ ...p, _s: s * 0.8 + Math.min(1, (p.popularity || 0) / 30) * 0.2 });
          if (s > bestFixScore) { bestFixScore = s; bestFix = p.name; }
        }
      }
    }
    if (bestFix && norm(bestFix) !== norm(base)) corrected = bestFix;
  }

  movies = dedupe(movies.sort((a, b) => b._s - a._s)).slice(0, 20);
  people = dedupe(people.sort((a, b) => b._s - a._s)).slice(0, 6);
  // a person whose name matches beats films that only half match
  const topPerson = people[0] && sim(corrected || base, people[0].name) >= 0.9;
  return {
    q, corrected,
    personFirst: !!topPerson && (!movies[0] || sim(corrected || base, movies[0].title) < sim(corrected || base, people[0].name)),
    movies: movies.map((m) => ({ ...card(m), s: Math.round(m._s * 100) / 100 })),
    people: people.map((p) => ({ id: p.id, name: p.name, dept: p.known_for_department, p: p.profile_path || null, known: (p.known_for || []).filter((k) => k.media_type === "movie").slice(0, 3).map((k) => k.title) })),
  };
}

// ---------------------------------------------------------------- film

async function omdb(imdb) {
  if (!imdb || !ENV.OMDB_KEY) return null;
  return cached("omdb:" + imdb, 7 * DAY, async () => {
    try {
      const r = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(imdb)}&apikey=${encodeURIComponent(ENV.OMDB_KEY)}&tomatoes=true`);
      if (!r.ok) return null;
      const d = await r.json();
      if (d.Response === "False") return null;
      const by = (src) => (d.Ratings || []).find((x) => x.Source === src)?.Value || null;
      const num = (s) => { const n = parseFloat(String(s || "").replace(/,/g, "")); return isFinite(n) ? n : null; };
      return {
        imdb: num(d.imdbRating) ? { v: num(d.imdbRating), n: num(d.imdbVotes) } : null,
        rt: by("Rotten Tomatoes") ? num(by("Rotten Tomatoes")) : null,
        mc: num(d.Metascore),
        awards: d.Awards && d.Awards !== "N/A" ? d.Awards : null,
        boxOffice: d.BoxOffice && d.BoxOffice !== "N/A" ? d.BoxOffice : null,
      };
    } catch { return null; }
  });
}

function certification(rd) {
  for (const c of ["IT", "GB", "IN", "US"]) {
    const r = (rd?.results || []).find((x) => x.iso_3166_1 === c);
    const cert = r?.release_dates?.map((x) => x.certification).find(Boolean);
    if (cert) return { c, cert };
  }
  return null;
}
function providers(wp) {
  const out = {};
  for (const c of ["IT", "GB", "IN", "US"]) {
    const r = wp?.results?.[c];
    if (!r) continue;
    const pick = (a) => (a || []).slice(0, 8).map((x) => ({ name: x.provider_name, logo: x.logo_path }));
    out[c] = { link: r.link, stream: pick(r.flatrate), free: pick([...(r.free || []), ...(r.ads || [])]), rent: pick(r.rent), buy: pick(r.buy) };
  }
  return out;
}

async function movieBase(id) {
  return tmdb(`/movie/${id}`, { append_to_response: "credits,keywords,videos,release_dates,watch/providers,external_ids,alternative_titles", language: "en-US" }, DAY);
}

export async function movie(id) {
  const m = await movieBase(id);
  if (!m) return null;
  const crew = m.credits?.crew || [];
  const people = (job) => dedupe(crew.filter((c) => (Array.isArray(job) ? job.includes(c.job) : c.job === job)).map((c) => ({ id: c.id, name: c.name })));
  const imdb = m.imdb_id || m.external_ids?.imdb_id || null;
  const om = await omdb(imdb);
  const vids = (m.videos?.results || []).filter((v) => v.site === "YouTube");
  const trailer = vids.find((v) => v.type === "Trailer" && v.official) || vids.find((v) => v.type === "Trailer") || vids[0];
  const kws = (m.keywords?.keywords || []).filter((k) => !BORING_KW.has(k.name.toLowerCase())).map((k) => ({ id: k.id, name: k.name }));
  const directors = people("Director");
  const cast = (m.credits?.cast || []).slice(0, 15).map((c) => ({ id: c.id, name: c.name, char: c.character, p: c.profile_path || null }));
  // which rows the page should ask for, in order (rows with nothing to show are left out)
  const rows = [{ kind: "more", title: "More like this" }, { kind: "thread", title: "Same thread", sub: kws.slice(0, 3).map((k) => k.name).join(" · ") }];
  rows.push({ kind: "thrill", title: "Same thrill" });
  if (m.belongs_to_collection) rows.push({ kind: "franchise", title: m.belongs_to_collection.name.replace(/ Collection$/, " films") });
  for (const d of directors.slice(0, 2)) rows.push({ kind: "person", id: d.id, role: "director", title: `Directed by ${d.name}` });
  for (const c of cast.slice(0, 3)) rows.push({ kind: "person", id: c.id, role: "cast", title: `With ${c.name}` });
  rows.push({ kind: "world", title: "World cinema, same thread" });
  rows.push({ kind: "language", title: `More in ${LANGS[m.original_language] || m.original_language}` });
  rows.push({ kind: "genre", title: `Best of ${(m.genres || []).slice(0, 2).map((g) => g.name).join(" & ") || "the genre"}` });
  rows.push({ kind: "era", title: `Same genre, ${(year(m.release_date) || 2000) - 5}–${(year(m.release_date) || 2000) + 5}` });
  rows.push({ kind: "remakes", title: "Remakes & namesakes" });
  const extraCrew = [["writer", "Written by", ["Screenplay", "Writer", "Story", "Novel", "Author"]], ["composer", "Music by", ["Original Music Composer", "Music", "Music Director"]], ["dop", "Shot by", ["Director of Photography", "Cinematography"]]];
  for (const [role, label, jobs] of extraCrew) for (const p of people(jobs).filter((p) => !directors.some((d) => d.id === p.id)).slice(0, 1)) rows.push({ kind: "person", id: p.id, role, title: `${label} ${p.name}`, crew: true });

  return {
    id: m.id, imdb, title: m.title, original: m.original_title !== m.title ? m.original_title : null,
    year: year(m.release_date), date: m.release_date || null, runtime: m.runtime || null,
    olang: m.original_language, langName: LANGS[m.original_language] || m.original_language,
    langs: (m.spoken_languages || []).map((l) => l.english_name),
    countries: (m.production_countries || []).map((c) => c.name),
    genres: (m.genres || []).map((g) => ({ id: g.id, name: g.name })),
    cert: certification(m.release_dates),
    tagline: m.tagline || null, overview: m.overview || null,
    poster: m.poster_path || null, backdrop: m.backdrop_path || null,
    directors, writers: people(["Screenplay", "Writer", "Story", "Novel", "Author"]).slice(0, 4),
    composer: people(["Original Music Composer", "Music", "Music Director"]).slice(0, 2),
    dop: people(["Director of Photography", "Cinematography"]).slice(0, 2),
    cast, keywords: kws.slice(0, 20),
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    collection: m.belongs_to_collection ? { id: m.belongs_to_collection.id, name: m.belongs_to_collection.name } : null,
    budget: m.budget || null, revenue: m.revenue || null, boxOffice: om?.boxOffice || null, awards: om?.awards || null,
    homepage: m.homepage || null,
    ratings: { imdb: om?.imdb || null, rt: om?.rt ?? null, mc: om?.mc ?? null, tmdb: m.vote_average ? { v: Math.round(m.vote_average * 10) / 10, n: m.vote_count } : null },
    links: {
      imdb: imdb ? `https://www.imdb.com/title/${imdb}/` : null,
      letterboxd: `https://letterboxd.com/tmdb/${m.id}/`,
      tmdb: `https://www.themoviedb.org/movie/${m.id}`,
      rt: `https://www.rottentomatoes.com/search?search=${encodeURIComponent(m.title)}`,
      mc: `https://www.metacritic.com/search/${encodeURIComponent(m.title)}/?category=2`,
    },
    providers: providers(m["watch/providers"]),
    rows,
  };
}

// the summary saved with each logged watch, so the dashboard never needs to call back
export async function lite(id, withRatings) {
  const m = await movieBase(id);
  if (!m) return null;
  const crew = m.credits?.crew || [];
  const imdb = m.imdb_id || m.external_ids?.imdb_id || null;
  const om = withRatings ? await omdb(imdb) : null;
  return {
    id: m.id, imdb, t: m.title, ot: m.original_title !== m.title ? m.original_title : null, y: year(m.release_date),
    rt: m.runtime || null, l: m.original_language, g: (m.genres || []).map((g) => g.name),
    c: (m.production_countries || []).map((c) => c.name),
    d: dedupe(crew.filter((c) => c.job === "Director").map((c) => ({ id: c.id, name: c.name }))).slice(0, 3),
    a: (m.credits?.cast || []).slice(0, 6).map((c) => ({ id: c.id, name: c.name })),
    p: m.poster_path || null,
    iv: om?.imdb?.v ?? null, tv: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null,
  };
}

// ---------------------------------------------------------------- rows of related films

const FLOOR = 50;
async function discover(params, pages = 1) {
  const res = await Promise.all(Array.from({ length: pages }, (_, i) => tmdb("/discover/movie", { include_adult: false, "vote_count.gte": FLOOR, ...params, page: (params.page || 1) + i }, DAY)));
  return res.flatMap((r) => r?.results || []);
}

export async function row(id, kind, opts = {}) {
  const m = await movieBase(id);
  if (!m) return null;
  const lang = opts.lang && opts.lang !== "all" ? opts.lang : undefined;
  const page = Math.max(1, Math.min(5, Number(opts.page) || 1));
  const g = (m.genres || []).map((x) => x.id);
  const kws = (m.keywords?.keywords || []).filter((k) => !BORING_KW.has(k.name.toLowerCase()));
  const yr = year(m.release_date) || 2000;
  const keepLang = (list) => (lang ? list.filter((x) => x.original_language === lang) : list);
  let list = [];

  if (kind === "more") {
    const [rec, simi] = await Promise.all([tmdb(`/movie/${id}/recommendations`, { page }), tmdb(`/movie/${id}/similar`, { page })]);
    // recommendations first (what people who liked it also liked), then similar titles
    list = keepLang([...(rec?.results || []), ...(simi?.results || [])]);
    if (lang && list.length < 8) list = list.concat(await discover({ with_genres: g.slice(0, 2).join(","), with_original_language: lang, sort_by: "vote_count.desc", page }));
  } else if (kind === "thread") {
    if (!kws.length) return { kind, items: [] };
    const top = kws.slice(0, 4).map((k) => k.id).join("|");
    list = await discover({ with_keywords: top, with_original_language: lang, sort_by: "vote_count.desc", page }, 2);
    // films sharing two keywords rank above films sharing one: ask again with the top two together
    if (kws.length >= 2) {
      const both = await discover({ with_keywords: `${kws[0].id},${kws[1].id}`, with_original_language: lang, sort_by: "vote_count.desc", "vote_count.gte": 20 });
      list = [...both, ...list];
    }
  } else if (kind === "thrill") {
    const mood = kws.filter((k) => MOOD_KW.test(k.name)).slice(0, 3).map((k) => k.id);
    const params = { with_genres: g.slice(0, 2).join(","), with_original_language: lang, sort_by: "vote_average.desc", "vote_count.gte": lang ? 60 : 300, page };
    list = mood.length ? await discover({ ...params, with_keywords: mood.join("|") }, 2) : [];
    if (list.length < 10) list = list.concat(await discover(params, 2));
  } else if (kind === "genre") {
    list = await discover({ with_genres: g.slice(0, 2).join(","), with_original_language: lang, sort_by: "vote_average.desc", "vote_count.gte": lang ? 100 : 1500, page }, 2);
  } else if (kind === "world") {
    const top = kws.slice(0, 4).map((k) => k.id).join("|");
    const base = { with_genres: g[0], sort_by: "vote_count.desc", page };
    const parts = await Promise.all([
      top ? discover({ ...base, with_keywords: top, with_original_language: lang }, 3) : [],
      discover({ ...base, with_genres: g.slice(0, 2).join(","), with_original_language: lang }, 2),
    ]);
    list = parts.flat().filter((x) => x.original_language !== m.original_language || lang);
  } else if (kind === "language") {
    list = await discover({ with_genres: g.slice(0, 1).join(","), with_original_language: lang || m.original_language, sort_by: "vote_count.desc", "vote_count.gte": 20, page }, 2);
    if (list.length < 8) list = list.concat(await discover({ with_original_language: lang || m.original_language, sort_by: "vote_count.desc", "vote_count.gte": 20, page }));
  } else if (kind === "era") {
    list = await discover({ with_genres: g.slice(0, 1).join(","), with_original_language: lang, "primary_release_date.gte": `${yr - 5}-01-01`, "primary_release_date.lte": `${yr + 5}-12-31`, sort_by: "vote_count.desc", page }, 2);
  } else if (kind === "franchise") {
    if (!m.belongs_to_collection) return { kind, items: [] };
    const c = await tmdb(`/collection/${m.belongs_to_collection.id}`);
    list = (c?.parts || []).sort((a, b) => String(a.release_date || "9").localeCompare(String(b.release_date || "9")));
    return { kind, items: dedupe(list.map(card), Number(id)), ordered: true };
  } else if (kind === "remakes") {
    const names = [...new Set([m.title, m.original_title].filter(Boolean))];
    const res = await Promise.all(names.map((n) => tmdb("/search/movie", { query: n, include_adult: false })));
    const tn = norm(m.title), on = norm(m.original_title);
    list = keepLang(res.flatMap((r) => r?.results || []).filter((x) => {
      const s = Math.max(sim(tn, x.title), sim(on, x.original_title || ""), sim(tn, x.original_title || ""), sim(on, x.title));
      return s >= 0.85;
    })).sort((a, b) => String(a.release_date || "").localeCompare(String(b.release_date || "")));
    return { kind, items: dedupe(list.map(card), Number(id)), ordered: true };
  } else {
    return null;
  }
  return { kind, items: dedupe(list.map(card), Number(id)).slice(0, 30) };
}

const ROLE_JOBS = {
  director: ["Director"], writer: ["Screenplay", "Writer", "Story", "Novel", "Author"],
  composer: ["Original Music Composer", "Music", "Music Director"], dop: ["Director of Photography", "Cinematography"],
};
export async function person(id, role) {
  const p = await tmdb(`/person/${id}`, { append_to_response: "movie_credits" }, DAY);
  if (!p) return null;
  const dept = p.known_for_department;
  const r = role || (dept === "Acting" ? "cast" : dept === "Directing" ? "director" : dept === "Writing" ? "writer" : dept === "Sound" ? "composer" : dept === "Camera" ? "dop" : "cast");
  const cast = (p.movie_credits?.cast || []).map((c) => ({ ...card(c), as: c.character || null }));
  const crewAll = p.movie_credits?.crew || [];
  const crewFor = (jobs) => dedupe(crewAll.filter((c) => jobs.includes(c.job)).map((c) => ({ ...card(c), as: c.job })));
  const byNewest = (a, b) => (b.y || 9999) - (a.y || 9999);
  const groups = {
    cast: dedupe(cast).sort(byNewest),
    director: crewFor(ROLE_JOBS.director).sort(byNewest),
    writer: crewFor(ROLE_JOBS.writer).sort(byNewest),
    composer: crewFor(ROLE_JOBS.composer).sort(byNewest),
    dop: crewFor(ROLE_JOBS.dop).sort(byNewest),
  };
  return {
    id: p.id, name: p.name, dept, role: r, bio: p.biography || null, born: p.birthday || null, died: p.deathday || null,
    place: p.place_of_birth || null, p: p.profile_path || null, imdb: p.imdb_id || null,
    counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
    films: groups,
    items: groups[r] && groups[r].length ? groups[r] : groups.cast,
  };
}

export async function home(region = "IT") {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * DAY * 1000).toISOString().slice(0, 10);
  const recent = { "primary_release_date.gte": yearAgo, "primary_release_date.lte": today, sort_by: "popularity.desc", "vote_count.gte": 10 };
  const [trend, ml, hi, ko, world, playing] = await Promise.all([
    tmdb("/trending/movie/week", {}, 6 * 3600),
    discover({ ...recent, with_original_language: "ml" }),
    discover({ ...recent, with_original_language: "hi" }),
    discover({ with_original_language: "ko", sort_by: "vote_average.desc", "vote_count.gte": 800 }),
    discover({ without_original_language: "en", sort_by: "vote_average.desc", "vote_count.gte": 3000 }),
    tmdb("/movie/now_playing", { region }, 6 * 3600),
  ]);
  return {
    rows: [
      { kind: "trending", title: "Trending this week", items: (trend?.results || []).map(card) },
      { kind: "cinemas", title: `In cinemas (${region})`, items: (playing?.results || []).map(card) },
      { kind: "ml", title: "New in Malayalam", items: ml.map(card), lang: "ml" },
      { kind: "hi", title: "New in Hindi", items: hi.map(card), lang: "hi" },
      { kind: "ko", title: "Korean favourites", items: ko.map(card), lang: "ko" },
      { kind: "world", title: "World cinema classics", items: world.filter((x) => x.original_language !== "en").map(card) },
    ].filter((r) => r.items.length),
  };
}

// one film id for a row of an imported CSV
export async function match({ imdb, title, year: yr }) {
  if (imdb && /^tt\d+$/.test(imdb)) {
    const f = await tmdb(`/find/${imdb}`, { external_source: "imdb_id" }, 30 * DAY);
    const m = f?.movie_results?.[0];
    if (m) return { id: m.id, t: m.title, y: year(m.release_date), how: "imdb" };
  }
  if (!title) return null;
  const y = Number(yr) || undefined;
  const tryYear = async (yy) => (await tmdb("/search/movie", { query: title, include_adult: false, year: yy }, 30 * DAY))?.results || [];
  let list = await tryYear(y);
  if (!list.length && y) list = [...(await tryYear(y - 1)), ...(await tryYear(y + 1))];
  if (!list.length) list = await tryYear(undefined);
  const scored = list.map((m) => ({ m, s: Math.max(sim(title, m.title), sim(title, m.original_title || "")) - (y && year(m.release_date) && year(m.release_date) !== y ? 0.08 * Math.min(3, Math.abs(year(m.release_date) - y)) : 0) }))
    .sort((a, b) => b.s - a.s || (b.m.vote_count || 0) - (a.m.vote_count || 0));
  const top = scored[0];
  if (!top || top.s < 0.7) return null;
  return { id: top.m.id, t: top.m.title, y: year(top.m.release_date), how: "title", s: Math.round(top.s * 100) / 100 };
}

// ---------------------------------------------------------------- entry point

const SIZES = new Set(["w92", "w154", "w185", "w342", "w500", "w780", "w1280", "h632", "original"]);

export default {
  async fetch(req, env, ctx) {
    ENV = { ...env, ctx };
    const cors = corsFor(req);
    if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400" } });
    if (req.method !== "GET") return json({ error: "GET only" }, cors, 0, 405);
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const qp = (k) => url.searchParams.get(k);

    try {
      // posters and photos: proxied and cached for a month
      if (parts[0] === "img" && SIZES.has(parts[1]) && /^[A-Za-z0-9_-]+\.(jpg|png|svg)$/.test(parts[2] || "")) {
        const src = `${IMG}/${parts[1]}/${parts[2]}`;
        const r = await fetch(src, { cf: { cacheTtl: 30 * DAY, cacheEverything: true } });
        if (!r.ok) return new Response("", { status: r.status, headers: cors });
        return new Response(r.body, { headers: { ...cors, "Content-Type": r.headers.get("Content-Type") || "image/jpeg", "Cache-Control": "public, max-age=2592000, immutable" } });
      }
      if (!env.TMDB_KEY) return json({ error: "TMDB_KEY secret is not set on the Worker" }, cors, 0, 500);
      const id = parts[1] && /^\d+$/.test(parts[1]) ? Number(parts[1]) : null;

      if (parts[0] === "search") return json(await search(qp("q") || "", { correct: qp("exact") !== "1" }), cors, 3600);
      if (parts[0] === "movie" && id) { const d = await movie(id); return d ? json(d, cors, 3600) : json({ error: "not found" }, cors, 0, 404); }
      if (parts[0] === "lite" && id) { const d = await lite(id, qp("r") === "1"); return d ? json(d, cors, 3600) : json({ error: "not found" }, cors, 0, 404); }
      if (parts[0] === "row" && id && parts[2]) { const d = await row(id, parts[2], { lang: qp("lang"), page: qp("page") }); return d ? json(d, cors, 3600) : json({ error: "unknown row" }, cors, 0, 404); }
      if (parts[0] === "person" && id) { const d = await person(id, qp("role")); return d ? json(d, cors, 3600) : json({ error: "not found" }, cors, 0, 404); }
      if (parts[0] === "home") return json(await home((qp("region") || "IT").toUpperCase().slice(0, 2)), cors, 3600);
      if (parts[0] === "match") return json(await match({ imdb: qp("imdb"), title: qp("title"), year: qp("year") }), cors, 3600);
      if (parts.length === 0) return json({ ok: true, service: "ranjithkb.com movies api" }, cors);
      return json({ error: "unknown route" }, cors, 0, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, cors, 0, 502);
    }
  },
};
