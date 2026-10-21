// Trip planner. Everything runs in the visitor's browser against open data:
//   Photon (place search) · Wikidata (places, fame, websites) · Wikipedia (descriptions)
//   OpenStreetMap via Overpass (opening hours, when it answers) · OSRM foot routing (walking paths)
//   Open-Meteo (weather, sunset) · CARTO/OSM map tiles. Nothing is stored on a server.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

  // ------------------------------------------------------------------ settings
  const WALK = {            // per-leg walking limit (m) and rough daily total (m)
    light: { leg: 900, day: 5500, label: "a little walking" },
    moderate: { leg: 1600, day: 10000, label: "some walking" },
    lots: { leg: 2600, day: 16000, label: "lots of walking" },
  };
  const PACE = { relaxed: { stops: 4, f: 1.25 }, balanced: { stops: 6, f: 1 }, packed: { stops: 8, f: .8 } };
  const CATS = {
    museum: { label: "Museum", rx: /museum|gallery|art collection|glyptotheque|exhibition|kunsthalle|pinacoteca/i, indoor: 1 },
    religious: { label: "Church / temple", rx: /church|cathedral|basilica|chapel|temple|mosque|synagogue|abbey|monastery|baptistery|shrine|convent|pagoda|gurdwara|kovil|kshetram/i, indoor: 1 },
    parks: { label: "Park / garden", rx: /\bpark\b|garden|botanical|arboretum/i },
    nature: { label: "View / nature", rx: /viewpoint|lookout|belvedere|hill|mountain|\blake\b|waterfall|beach|nature reserve|forest|cliff|cave|valley|bay|lagoon|promenade|riverfront|backwater/i },
    markets: { label: "Market / shopping", rx: /market|bazaar|shopping|food hall|souk|arcade|mall\b/i },
    culture: { label: "Theatre / music", rx: /theatre|theater|opera|concert hall|arts venue|music venue|arena|stadium|cinema/i, indoor: 1 },
    family: { label: "Family", rx: /\bzoo\b|aquarium|amusement park|theme park|planetarium|science centre|science center|water park|children/i },
    history: { label: "Landmark", rx: /palace|palazzo|castle|fort\b|fortress|tower|bridge|monument|memorial|square|plaza|piazza|fountain|statue|archaeolog|ruin|gate|city wall|amphitheatre|loggia|old town|mausoleum|landmark|villa|lighthouse|historic|heritage|harbour|harbor|pier|dock|cemetery|obelisk|column|arch\b|colonnade/i },
  };
  const ORDER = ["religious", "parks", "museum", "family", "culture", "markets", "nature", "history"];
  const EXCLUDE = /\b(city|town|village|comune|municipality|province|region|state|country|county|administrative|district|neighbou?rhood|ward|council|siege|revolt|conspiracy|battle|war|university|college|school|institute|library|archives|society|academy|hospital|company|business|enterprise|organi[sz]ation|railway station|metro station|bus station|airport|human|painting|fresco|artwork|cycle of frescoes|sacristy|studiolo|pharmacy|drugstore|sport|championship|record group|event|election|treaty|diocese|archdiocese|parish\b|constituency|electoral|office|embassy|consulate|hotel|restaurant|road|highway|railway line|river|tributary|watercourse|mountain range|ecumenical|island|islands|archipelago|islet|metropolitan city|consortium|peninsula|cape|strait|sea|gulf)\b/i;
  const ARTWORK = /sculpture|painting|fresco|artwork|mosaic|altarpiece|tapestry/i;
  const STATION_RX = /railway station|train station|metro station|subway station|underground station|tram stop|bus station|light rail station|station\b|terminus|interchange/i;

  // ------------------------------------------------------------------ helpers
  const toRad = (d) => d * Math.PI / 180;
  function dist(a, b) {   // metres
    const R = 6371000, dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const walkMin = (m) => Math.max(1, Math.round(m * 1.3 / 75));         // street factor 1.3, 4.5 km/h
  const fmtT = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
  const fmtDur = (m) => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? " " + (m % 60) + " min" : ""}`;
  const fmtKm = (m) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
  const ll = (p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
  const gmaps = {
    place: (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name ? p.name + " " + (state.city ? state.city.name : "") : ll(p))}`,
    dir: (a, b, mode) => `https://www.google.com/maps/dir/?api=1&origin=${ll(a)}&destination=${ll(b)}&travelmode=${mode}`,
    route: (pts, mode) => {
      const o = pts[0], d = pts[pts.length - 1], w = pts.slice(1, -1).slice(0, 9);
      return `https://www.google.com/maps/dir/?api=1&origin=${ll(o)}&destination=${ll(d)}${w.length ? "&waypoints=" + w.map(ll).join("%7C") : ""}&travelmode=${mode}`;
    },
    near: (q, p) => `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${p.lat},${p.lon},17z`,
  };
  const minutes = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  async function getJSON(url, opt = {}, ms = 20000) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(url, { ...opt, signal: c.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }

  // ------------------------------------------------------------------ form state
  const state = { dest: null, from: null, base: null, city: null };
  const opts = { days: "1", mode: "pt", walk: "moderate", pace: "balanced", likes: ["must", "museum", "history"] };
  Object.assign(opts, store.get("trip-opts", {}));

  document.querySelectorAll(".chips").forEach((box) => {
    const name = box.dataset.name, multi = box.classList.contains("multi");
    const sync = () => box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", multi ? opts[name].includes(b.dataset.v) : opts[name] === b.dataset.v));
    box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      if (multi) opts[name] = opts[name].includes(b.dataset.v) ? opts[name].filter((x) => x !== b.dataset.v) : [...opts[name], b.dataset.v];
      else opts[name] = b.dataset.v;
      sync(); store.set("trip-opts", opts);
    }));
    sync();
  });
  const tomorrow = new Date(Date.now() + 864e5);
  $("date").value = tomorrow.toISOString().slice(0, 10);

  // place search with suggestions (Photon)
  function suggest(input, box, key, near) {
    let t = null, seq = 0;
    input.addEventListener("input", () => {
      state[key] = null;
      clearTimeout(t);
      const q = input.value.trim();
      if (q.length < 3) { box.hidden = true; return; }
      t = setTimeout(async () => {
        const my = ++seq;
        let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`;
        const c = near && near();
        if (c) url += `&lat=${c.lat}&lon=${c.lon}`;
        try {
          const j = await getJSON(url, {}, 8000);
          if (my !== seq) return;
          box.innerHTML = "";
          for (const f of j.features) {
            const p = f.properties, [lon, lat] = f.geometry.coordinates;
            const b = el("button", "s");
            b.type = "button";
            b.append(el("b", null, p.name || p.street || q), el("span", null, [p.city !== p.name ? p.city : "", p.state, p.country].filter(Boolean).join(", ")));
            b.onclick = () => {
              state[key] = { name: p.name || q, lat, lon, cc: (p.countrycode || "").toLowerCase(), country: p.country || "", kind: p.osm_value, extent: p.extent };
              input.value = [p.name, p.city && p.city !== p.name ? p.city : "", p.country].filter(Boolean).join(", ");
              box.hidden = true;
            };
            box.append(b);
          }
          box.hidden = !j.features.length;
        } catch { box.hidden = true; }
      }, 280);
    });
    input.addEventListener("blur", () => setTimeout(() => (box.hidden = true), 200));
  }
  suggest($("dest"), $("destSugg"), "dest");
  suggest($("from"), $("fromSugg"), "from");
  suggest($("base"), $("baseSugg"), "base", () => state.dest);
  suggest($("end"), $("endSugg"), "end", () => state.dest);

  async function resolve(key, input, near) {
    if (state[key] || !input.value.trim()) return state[key];
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(input.value.trim())}&limit=1&lang=en`;
    if (near) url += `&lat=${near.lat}&lon=${near.lon}`;
    const j = await getJSON(url, {}, 10000);
    const f = j.features[0];
    if (!f) return null;
    const p = f.properties, [lon, lat] = f.geometry.coordinates;
    state[key] = { name: p.name || input.value, lat, lon, cc: (p.countrycode || "").toLowerCase(), country: p.country || "", kind: p.osm_value, extent: p.extent };
    return state[key];
  }

  // ------------------------------------------------------------------ data
  async function sparql(q) {
    const j = await getJSON("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: { Accept: "application/sparql-results+json" } }, 45000);
    return j.results.bindings;
  }
  async function placesAround(c, km) {
    const rows = await sparql(`SELECT ?item ?itemLabel ?itemDescription ?lat ?lon ?sl ?wiki (SAMPLE(?img) AS ?image) (SAMPLE(?site) AS ?website) (GROUP_CONCAT(DISTINCT ?typeLabel; separator="|") AS ?types) WHERE {
      SERVICE wikibase:around { ?item wdt:P625 ?c . bd:serviceParam wikibase:center "Point(${c.lon} ${c.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${km}" . }
      ?item wikibase:sitelinks ?sl . FILTER(?sl >= 4)
      ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")
      OPTIONAL { ?item wdt:P18 ?img } OPTIONAL { ?item wdt:P856 ?site }
      OPTIONAL { ?wa schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?wiki }
      BIND(geof:latitude(?c) AS ?lat) BIND(geof:longitude(?c) AS ?lon)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
    } GROUP BY ?item ?itemLabel ?itemDescription ?lat ?lon ?sl ?wiki ORDER BY DESC(?sl) LIMIT 500`);
    const seen = new Map();
    for (const r of rows) {
      const id = r.item.value.split("/").pop();
      if (seen.has(id)) continue;
      const types = r.types.value;
      const name = r.itemLabel.value;
      if (/^Q\d+$/.test(name)) continue;
      seen.set(id, {
        id, name, desc: r.itemDescription ? r.itemDescription.value : "", lat: +r.lat.value, lon: +r.lon.value, sl: +r.sl.value,
        types, wiki: r.wiki ? r.wiki.value : "", image: r.image ? r.image.value : "", website: r.website ? r.website.value : "",
      });
    }
    return [...seen.values()];
  }
  // ---- regions, islands, countries: tour mode
  const AREA_KINDS = /^(state|region|province|county|island|archipelago|country|islands|district)$/i;
  function isArea(d) {
    if (AREA_KINDS.test(d.kind || "")) return true;
    const e = d.extent;
    return !!(e && e.length === 4 && dist({ lat: e[1], lon: e[0] }, { lat: e[3], lon: e[2] }) > 60000);
  }
  async function placesInArea(d) {
    let w, n, e, sth;
    if (d.extent && d.extent.length === 4) [w, n, e, sth] = d.extent;
    else { w = d.lon - 1; e = d.lon + 1; n = d.lat + .7; sth = d.lat - .7; }
    const diag = dist({ lat: n, lon: w }, { lat: sth, lon: e });
    const minSl = diag > 400000 ? 22 : diag > 200000 ? 18 : diag > 100000 ? 14 : 12;
    const rows = await sparql(`SELECT ?item ?itemLabel ?itemDescription ?lat ?lon ?sl ?wiki ?town ?townLabel (SAMPLE(?img) AS ?image) (SAMPLE(?site) AS ?website) (GROUP_CONCAT(DISTINCT ?typeLabel; separator="|") AS ?types) WHERE {
      SERVICE wikibase:box { ?item wdt:P625 ?c . bd:serviceParam wikibase:cornerWest "Point(${w} ${sth})"^^geo:wktLiteral . bd:serviceParam wikibase:cornerEast "Point(${e} ${n})"^^geo:wktLiteral . }
      ?item wikibase:sitelinks ?sl . FILTER(?sl >= ${minSl})
      FILTER NOT EXISTS { ?item wdt:P31 ?settle . VALUES ?settle { wd:Q747074 wd:Q515 wd:Q1549591 wd:Q3957 wd:Q532 wd:Q5119 wd:Q15284 wd:Q486972 wd:Q18415311 wd:Q15110 wd:Q15089 wd:Q23442 wd:Q33837 wd:Q1710033 wd:Q21518270 wd:Q2074737 wd:Q1637706 wd:Q123705 wd:Q484170 wd:Q1093829 wd:Q8502 wd:Q6465 wd:Q107425 } }
      ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")
      OPTIONAL { ?item wdt:P131 ?town }
      OPTIONAL { ?item wdt:P18 ?img } OPTIONAL { ?item wdt:P856 ?site }
      OPTIONAL { ?wa schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?wiki }
      BIND(geof:latitude(?c) AS ?lat) BIND(geof:longitude(?c) AS ?lon)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
    } GROUP BY ?item ?itemLabel ?itemDescription ?lat ?lon ?sl ?wiki ?town ?townLabel ORDER BY DESC(?sl) LIMIT 1500`);
    const seen = new Map();
    for (const r of rows) {
      const id = r.item.value.split("/").pop();
      if (seen.has(id) || /^Q\d+$/.test(r.itemLabel.value)) continue;
      seen.set(id, { id, name: r.itemLabel.value, desc: r.itemDescription ? r.itemDescription.value : "", lat: +r.lat.value, lon: +r.lon.value, sl: +r.sl.value,
        types: r.types.value, wiki: r.wiki ? r.wiki.value : "", image: r.image ? r.image.value : "", website: r.website ? r.website.value : "",
        town: r.townLabel && !/^Q\d+$/.test(r.townLabel.value) ? r.townLabel.value : "", townId: r.town ? r.town.value.split("/").pop() : "" });
    }
    return [...seen.values()];
  }
  async function areaQid(d) {
    const s = await getJSON(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(d.name)}&language=en&type=item&limit=1&format=json&origin=*`, {}, 8000);
    return s.search && s.search[0] && s.search[0].id;
  }
  // plan B for big areas: the area's biggest towns, then the sights around each
  async function placesByTowns(d) {
    const qid = await areaQid(d);
    if (!qid) return [];
    const tw = await sparql(`SELECT ?t ?tLabel ?lat ?lon ?pop WHERE { ?t wdt:P131+ wd:${qid} ; wdt:P1082 ?pop ; wdt:P625 ?c . ?t wdt:P31/wdt:P279* wd:Q486972 .
      BIND(geof:latitude(?c) AS ?lat) BIND(geof:longitude(?c) AS ?lon) SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". } } ORDER BY DESC(?pop) LIMIT 14`);
    const list = tw.map((r) => ({ id: r.t.value.split("/").pop(), name: r.tLabel.value, lat: +r.lat.value, lon: +r.lon.value }));
    const res = await Promise.all(list.map((t) => placesAround(t, 4).then((ps) => ps.map((p) => ({ ...p, town: t.name, townId: t.id }))).catch(() => [])));
    const seen = new Map();
    for (const p of res.flat()) if (!seen.has(p.id)) seen.set(p.id, p);
    return [...seen.values()];
  }
  async function insideArea(d, places) {          // keep only places that Wikidata puts inside the area (not across the strait)
    try {
      const qid = await areaQid(d);
      if (!qid) return places;
      const ok = new Set();
      for (let i = 0; i < places.length; i += 150) {
        const rows = await sparql(`SELECT ?item WHERE { VALUES ?item { ${places.slice(i, i + 150).map((p) => "wd:" + p.id).join(" ")} } ?item wdt:P131+ wd:${qid} . }`);
        rows.forEach((r) => ok.add(r.item.value.split("/").pop()));
      }
      return ok.size >= 5 ? places.filter((p) => ok.has(p.id)) : places;
    } catch { return places; }
  }
  const NOT_TOWN = /province|metropolitan|region|consortium|county|district|department|\bitaly\b|\bsicily\b|islands?$|archipelago|municipality of|comprensorio/i;
  function towns(places) {                       // group sights by town; tiny groups join a big neighbour within 6 km
    const by = new Map(), loose = [];
    for (const p of places) {
      if (!p.town || NOT_TOWN.test(p.town)) { loose.push(p); continue; }   // only tagged with a province: placed by distance below
      const k = p.townId || p.id; if (!by.has(k)) by.set(k, { key: k, name: p.town, places: [] }); by.get(k).places.push(p);
    }
    for (const p of loose) {
      let best = null, bd = 15000;
      for (const t of by.values()) { const d = dist(p, t.places[0]); if (d < bd) { bd = d; best = t; } }
      if (best) best.places.push(p);
    }
    let list = [...by.values()].map((t) => ({ ...t, lat: t.places.reduce((a, p) => a + p.lat, 0) / t.places.length, lon: t.places.reduce((a, p) => a + p.lon, 0) / t.places.length, score: t.places.reduce((a, p) => a + p.score, 0) }));
    list.sort((a, b) => b.score - a.score);
    const out = [];
    for (const t of list) {
      const host = out.find((o) => dist(o, t) < (t.places.length <= 2 ? 12000 : 6000));
      if (host) { host.places.push(...t.places); host.score += t.score; } else out.push(t);
    }
    out.forEach((t) => t.places.sort((a, b) => b.score - a.score));
    return out;
  }
  function allocateDays(tlist, days, perDay) {   // each day goes to the town where one more day adds the most
    // a day in a town with only one or two sights is worth much less than a full day somewhere rich
    const gain = (t, k) => { const g = t.places.slice(perDay * k, perDay * (k + 1)); return g.reduce((a, p) => a + p.score, 0) * (k ? .8 : 1) * Math.min(1, (g.length / Math.min(perDay, 4)) ** 1.5); };
    const alloc = new Map();
    for (let d = 0; d < days; d++) {
      let best = null, bg = -1;
      for (const t of tlist.slice(0, 30)) { const g = gain(t, alloc.get(t) || 0); if (g > bg) { bg = g; best = t; } }
      if (!best || bg <= 0) break;
      alloc.set(best, (alloc.get(best) || 0) + 1);
    }
    return [...alloc.entries()].map(([t, n]) => ({ ...t, days: n }));
  }
  function orderTowns(ts, from, to) {
    const start = from ? [...ts].sort((a, b) => dist(from, a) - dist(from, b))[0] : ts[0];
    const rest = ts.filter((t) => t !== start);
    return [start, ...orderRoute(start, rest, to || null)];
  }
  function hop(a, b) {                            // town-to-town travel estimate
    const d = dist(a, b);
    if (opts.mode === "car") return { type: "car", m: d * 1.3, min: Math.round(10 + d * 1.3 / 1000 / (d > 30000 ? 70 : 45) * 60) };
    return { type: "pt", m: d * 1.4, min: Math.round(20 + d * 1.4 / 1000 / 50 * 60) };
  }

  function classify(p) {
    // judge each "instance of" type on its own: Palazzo Vecchio is a city hall *and* a museum
    const types = p.types.split("|");
    if (types.some((t) => ARTWORK.test(t) || /^statue$|cultural property/i.test(t) && ARTWORK.test(p.types)) && !types.some((t) => /fountain|monument|memorial|square/i.test(t))) return null;
    for (const k of ORDER) for (const t of types) if (!EXCLUDE.test(t) && !STATION_RX.test(t) && CATS[k].rx.test(t)) return k;
    return null;
  }
  async function stationsAround(c, km) {
    try {
      const rows = await sparql(`SELECT ?item ?itemLabel ?lat ?lon ?sl (GROUP_CONCAT(DISTINCT ?tl; separator="|") AS ?types) WHERE {
        SERVICE wikibase:around { ?item wdt:P625 ?c . bd:serviceParam wikibase:center "Point(${c.lon} ${c.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${km}" . }
        ?item wdt:P31 ?t . ?t rdfs:label ?tl . FILTER(LANG(?tl) = "en")
        FILTER(REGEX(?tl, "station|tram stop|terminus|interchange|bus stop", "i"))
        OPTIONAL { ?item wikibase:sitelinks ?sl }
        BIND(geof:latitude(?c) AS ?lat) BIND(geof:longitude(?c) AS ?lon)
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
      } GROUP BY ?item ?itemLabel ?lat ?lon ?sl LIMIT 400`);
      const out = new Map();
      for (const r of rows) {
        const id = r.item.value.split("/").pop();
        if (out.has(id) || /^Q\d+$/.test(r.itemLabel.value) || /fire station|police station|power station|filling|petrol|research station|weather|radio|television|space/i.test(r.types.value)) continue;
        out.set(id, { id, name: r.itemLabel.value, lat: +r.lat.value, lon: +r.lon.value, sl: r.sl ? +r.sl.value : 0, types: r.types.value,
          kind: /tram/i.test(r.types.value) ? "tram" : /metro|subway|underground|rapid transit/i.test(r.types.value) ? "metro" : /bus/i.test(r.types.value) ? "bus" : "train" });
      }
      return [...out.values()];
    } catch { return []; }
  }
  async function hoursFor(places, c, km) {      // OpenStreetMap opening hours, matched by Wikidata id (best effort)
    const ids = places.map((p) => p.id);
    if (!ids.length) return {};
    const q = `[out:json][timeout:25];(nwr["wikidata"~"^(${ids.join("|")})$"]["opening_hours"](around:${Math.round(km * 1000)},${c.lat},${c.lon}););out tags;`;
    for (const host of ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter"]) {
      try {
        const j = await getJSON(host, { method: "POST", body: "data=" + encodeURIComponent(q) }, 16000);
        const map = {};
        for (const e of j.elements || []) {
          const t = e.tags || {};
          if (t.wikidata && (t.opening_hours || t.fee || t.website || t.charge)) {
            map[t.wikidata] = Object.assign(map[t.wikidata] || {}, { oh: t.opening_hours || (map[t.wikidata] || {}).oh, fee: t.fee || t.charge, website: t.website || t["contact:website"] });
          }
        }
        return map;
      } catch { /* try the next server */ }
    }
    return null;
  }
  async function weather(c, date, days) {
    try {
      const start = new Date(date), today = new Date(new Date().toISOString().slice(0, 10));
      const diff = Math.round((start - today) / 864e5);
      if (diff < 0 || diff > 15) return null;
      const end = new Date(start.getTime() + (Math.ceil(days) - 1) * 864e5).toISOString().slice(0, 10);
      const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&start_date=${date}&end_date=${end}`, {}, 10000);
      return j.daily.time.map((t, i) => ({ date: t, code: j.daily.weathercode[i], hi: j.daily.temperature_2m_max[i], lo: j.daily.temperature_2m_min[i], rain: j.daily.precipitation_probability_max[i], sunrise: j.daily.sunrise[i], sunset: j.daily.sunset[i] }));
    } catch { return null; }
  }
  const WX = (c) => c === 0 ? ["☀", "Clear"] : c <= 2 ? ["🌤", "Mostly sunny"] : c === 3 ? ["☁", "Cloudy"] : c <= 48 ? ["🌫", "Fog"] : c <= 57 ? ["🌦", "Drizzle"] : c <= 67 ? ["🌧", "Rain"] : c <= 77 ? ["🌨", "Snow"] : c <= 82 ? ["🌧", "Showers"] : ["⛈", "Thunderstorms"];
  const summaries = {};
  async function wikiSummary(title) {
    if (!title) return null;
    if (summaries[title]) return summaries[title];
    try {
      const j = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, {}, 8000);
      summaries[title] = { text: j.extract, thumb: j.thumbnail ? j.thumbnail.source : "", url: j.content_urls ? j.content_urls.desktop.page : "" };
    } catch { summaries[title] = null; }
    return summaries[title];
  }

  // OpenStreetMap opening_hours: the common forms (days + times, "off", 24/7); anything else -> "check"
  const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  function openOn(oh, date) {
    if (!oh) return { s: "unknown" };
    const s = oh.trim();
    if (s === "24/7") return { s: "open", txt: "Open 24 hours" };
    const wd = (date.getDay() + 6) % 7;
    let res = null;
    for (const raw of s.split(";")) {
      let r = raw.trim();
      if (!r) continue;
      if (/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week|easter|sunrise|sunset)\b/i.test(r)) return { s: "unknown", raw: s };
      r = r.replace(/\bPH\b\s*,?/g, "").replace(/,\s*PH\b/g, "").trim();
      if (!r) continue;
      let days = [0, 1, 2, 3, 4, 5, 6], rest = r;
      const m = r.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s*(.*)$/);
      if (m) {
        days = [];
        for (const part of m[1].split(",")) {
          const [a, b] = part.split("-").map((x) => DAYS.indexOf(x.trim()));
          if (b == null || b < 0) days.push(a); else for (let k = a; ; k = (k + 1) % 7) { days.push(k); if (k === b) break; }
        }
        rest = m[2].trim();
      }
      if (!days.includes(wd)) continue;
      if (/^(off|closed)$/i.test(rest)) { res = { s: "closed" }; continue; }
      const times = [...rest.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)].map((t) => [+t[1] * 60 + +t[2], +t[3] * 60 + +t[4]]);
      if (!times.length) return { s: "unknown", raw: s };
      res = { s: "open", ranges: times, txt: "Open " + times.map(([a, b]) => `${fmtT(a)}–${fmtT(b)}`).join(", ") };
    }
    return res || (/(Mo|Tu|We|Th|Fr|Sa|Su)/.test(s) ? { s: "closed" } : { s: "unknown", raw: s });
  }

  // ------------------------------------------------------------------ planning
  function visitMinutes(p) {
    const f = PACE[opts.pace].f;
    let m;
    switch (p.cat) {
      case "museum": m = p.sl > 50 ? 150 : p.sl > 20 ? 90 : 60; break;
      case "religious": m = p.sl > 60 ? 75 : p.sl > 35 ? 45 : 25; break;
      case "family": m = 150; break;
      case "parks": m = p.sl > 25 ? 75 : 40; break;
      case "nature": m = 35; break;
      case "markets": m = 45; break;
      case "culture": m = 20; break;
      default: m = p.sl > 40 ? 35 : 20;
    }
    if (/museum/i.test(p.types) && p.cat !== "museum" && p.sl > 30) m = Math.max(m, 75);   // palaces, towers etc. with a museum inside
    return Math.round(m * f / 5) * 5;
  }
  function scoreOf(p, likes) {
    let s = Math.log2(p.sl + 2);
    const liked = likes.includes(p.cat) || (p.cat === "parks" && likes.includes("nature")) || (p.cat === "nature" && likes.includes("parks"));
    if (liked) s *= 1.7;
    else if (!likes.includes("must")) s *= .45;
    if (likes.includes("gems") && p.sl >= 6 && p.sl <= 25) s *= 1.6;
    return s;
  }
  function kmeans(pts, k) {
    if (k <= 1) return [pts];
    const sorted = [...pts].sort((a, b) => b.score - a.score);
    const cent = [sorted[0]];
    while (cent.length < k) {                         // farthest-point seeding, weighted by score
      let best = null, bd = -1;
      for (const p of sorted.slice(0, Math.max(k * 4, 20))) {
        const d = Math.min(...cent.map((c) => dist(c, p))) * Math.sqrt(p.score);
        if (d > bd) { bd = d; best = p; }
      }
      cent.push(best);
    }
    let C = cent.map((c) => ({ lat: c.lat, lon: c.lon }));
    let groups = [];
    for (let it = 0; it < 12; it++) {
      groups = C.map(() => []);
      for (const p of pts) { let bi = 0, bd = Infinity; C.forEach((c, i) => { const d = dist(c, p); if (d < bd) { bd = d; bi = i; } }); groups[bi].push(p); }
      C = groups.map((g, i) => g.length ? { lat: g.reduce((a, p) => a + p.lat * p.score, 0) / g.reduce((a, p) => a + p.score, 0), lon: g.reduce((a, p) => a + p.lon * p.score, 0) / g.reduce((a, p) => a + p.score, 0) } : C[i]);
    }
    return groups;
  }
  // even out the days: a thin day takes the nearest places from overfull days (by score-weighted time)
  function balance(groups, perDay) {
    if (groups.length < 2) return groups;
    const cen = (g) => g.length ? { lat: g.reduce((a, p) => a + p.lat, 0) / g.length, lon: g.reduce((a, p) => a + p.lon, 0) / g.length } : null;
    const weight = (g) => g.reduce((a, p) => a + p.score, 0);
    const total = groups.reduce((a, g) => a + weight(g), 0), fair = total / groups.length;
    for (let it = 0; it < 80; it++) {
      const w = groups.map(weight);
      const thin = w.indexOf(Math.min(...w));
      if (w[thin] >= fair * .7 && groups[thin].length >= Math.min(perDay, 3)) break;
      const c = cen(groups[thin]) || cen(groups[w.indexOf(Math.max(...w))]);
      let best = null, bg = -1, bd = Infinity;
      groups.forEach((g, gi) => {
        if (gi === thin || w[gi] <= fair || g.length <= 2) return;
        for (const p of g) { const d = dist(c, p) / Math.sqrt(p.score); if (d < bd) { bd = d; best = p; bg = gi; } }
      });
      if (!best) break;
      groups[bg] = groups[bg].filter((x) => x !== best);
      groups[thin].push(best);
    }
    groups.forEach((g) => g.sort((a, b) => b.score - a.score));
    return groups;
  }

  function orderRoute(start, stops, end) {             // nearest neighbour, then 2-opt
    let rest = [...stops], route = [], cur = start;
    while (rest.length) { rest.sort((a, b) => dist(cur, a) - dist(cur, b)); cur = rest.shift(); route.push(cur); }
    const len = (r) => { let s = 0, p = start; for (const q of r) { s += dist(p, q); p = q; } return s + (end ? dist(p, end) : 0); };
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < route.length - 1; i++) for (let j = i + 1; j < route.length; j++) {
        const r2 = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)];
        if (len(r2) + 1 < len(route)) { route = r2; improved = true; }
      }
    }
    return route;
  }
  const nearestHub = (p, hubs, max = 1500) => {
    let best = null, bd = Infinity;
    for (const h of hubs) {
      const real = dist(p, h);
      if (real > max) continue;
      const d = real - Math.log2(h.sl + 2) * 40 - (h.kind === "train" || h.kind === "metro" ? 150 : 0);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  };

  // the trip's last leg: walk if it's close, otherwise transport even on a walking trip
  const isAirport = (p) => /aerodrome|airport/i.test(p.kind || "") || /airport|aeroporto|aéroport|flughafen|aeropuerto|aeroporto/i.test(p.name || "");
  const endBuffer = (p) => isAirport(p) ? 120 : /station|bahnhof|stazione|gare|estación/i.test((p.name || "") + (p.kind || "")) ? 20 : 10;
  function endLeg(a, b) {
    const d = dist(a, b);
    if (d <= WALK[opts.walk].leg) return { type: "walk", m: d, min: walkMin(d) };
    if (opts.mode === "car") return { type: "car", m: d, min: Math.round(6 + d / 1000 * (d > 8000 ? 1.4 : 2.4)) };
    return { type: "pt", m: d, min: Math.round(10 + d / 1000 * (d > 8000 ? 1.8 : 3.2)) };
  }

  function legBetween(a, b) {
    const d = dist(a, b), w = WALK[opts.walk];
    if (opts.mode === "walk" || d <= w.leg) return { type: "walk", m: d, min: walkMin(d) };
    if (opts.mode === "car") return { type: "car", m: d, min: Math.round(8 + d / 1000 * 2.6) };   // incl. parking
    return { type: "pt", m: d, min: Math.round(9 + d / 1000 * 3.2) };                            // wait + ride + walk to stop
  }

  function buildDay(cluster, date, idx, ctx) {
    const trav = ctx.travel && ctx.travel[idx];
    const t0 = minutes($("t0").value || "09:00") + (trav ? trav.min : 0), t1 = minutes($("t1").value || "18:00");
    let dayEnd = opts.days === "0.5" ? Math.min(t1, t0 + 270) : t1;
    const hubs = ctx.hubsFor ? ctx.hubsFor[idx] || [] : ctx.hubs;
    const tripEnd = ctx.end && idx === ctx.lastIdx ? ctx.end : null;     // the last day heads for where the trip ends
    const centre = { lat: cluster.reduce((a, p) => a + p.lat, 0) / cluster.length, lon: cluster.reduce((a, p) => a + p.lon, 0) / cluster.length };
    const base = ctx.base && (!ctx.tour || dist(ctx.base, centre) < 20000) ? ctx.base : null;
    // where the day starts and ends: your base if it's close, otherwise the main stop near this part of town
    const startHub = base && dist(base, centre) < WALK[opts.walk].leg * 1.6 ? base : (opts.mode === "car" ? null : nearestHub(cluster.sort((a, b) => dist(base || centre, a) - dist(base || centre, b))[0], hubs, 1800));
    const start = startHub || base || { ...centre, name: ctx.townOf && ctx.townOf[idx] ? `${ctx.townOf[idx]} — town centre` : `${ctx.city} — centre of this area` };
    // walking order from the start; the finish is whatever stop is near the last sight (not the other way round)
    const towards = tripEnd && dist(tripEnd, centre) < 15000 ? tripEnd : base && base !== start ? base : null;
    let stops = orderRoute(start, cluster.filter((p) => p !== start), towards);
    let endLegEst = 10;
    if (tripEnd) {
      endLegEst = endLeg(centre, tripEnd).min;
      if (ctx.endBy != null) dayEnd = Math.min(dayEnd, ctx.endBy - endLegEst - endBuffer(tripEnd));
    }

    // timeline, dropping the weakest stops that don't fit (they become "if you have time")
    const wd = new Date(date + "T12:00");
    let keep = [...stops];
    for (let tries = 0; tries < 30; tries++) {
      let t = t0, ok = true, lunchDone = !$("lunch").checked, prev = start;
      for (const p of keep) {
        const leg = legBetween(prev, p);
        t += leg.min;
        if (!lunchDone && t >= 12 * 60 + 30) { t += 60; lunchDone = true; }
        const h = openOn(p.oh, wd);
        if (h.s === "open" && h.ranges) { const r = h.ranges.find(([a, b]) => b > t + 15); if (r && r[0] > t) t = r[0]; }
        t += visitMinutes(p);
        prev = p;
      }
      t += tripEnd ? 0 : 10;
      if (t > dayEnd + (tripEnd ? 0 : 10) && keep.length > 1) {
        const weakest = [...keep].sort((a, b) => (a.forced ? 1e9 : a.score) - (b.forced ? 1e9 : b.score))[0];
        if (weakest.forced) break;
        keep = keep.filter((x) => x !== weakest);
        ok = false;
      }
      if (ok) break;
    }
    keep = orderRoute(start, keep, towards);
    const lastStop = keep[keep.length - 1] || start;
    const lastHub = tripEnd || opts.mode === "car" ? null : (base && dist(lastStop, base) < WALK[opts.walk].leg ? null : nearestHub(lastStop, hubs, 900));
    const extra = stops.filter((p) => !keep.includes(p)).sort((a, b) => b.score - a.score);

    // final schedule
    const items = [];
    let t = t0, prev = start, walked = 0, lunchDone = !$("lunch").checked;
    if (trav) items.push({ kind: "travel", at: t0 - trav.min, trav, to: start });
    items.push({ kind: "start", at: t, place: start, hub: startHub && startHub !== base ? startHub : null, isBase: start === base });
    for (const p of keep) {
      const leg = legBetween(prev, p);
      items.push({ kind: "leg", from: prev, to: p, leg, at: t });
      if (leg.type === "walk") walked += leg.m;
      t += leg.min;
      if (!lunchDone && t >= 12 * 60 + 30) { items.push({ kind: "lunch", at: t, near: prev === start ? p : prev }); t += 60; lunchDone = true; }
      const h = openOn(p.oh, wd);
      let wait = 0;
      if (h.s === "open" && h.ranges) { const r = h.ranges.find(([a, b]) => b > t + 15); if (r && r[0] > t) { wait = r[0] - t; t = r[0]; } }
      const dur = visitMinutes(p);
      const closesTooSoon = h.s === "open" && h.ranges && !h.ranges.some(([a, b]) => a <= t && b >= t + Math.min(dur, 45));
      items.push({ kind: "stop", at: t, end: t + dur, place: p, hours: h, wait, warn: h.s === "closed" ? "closed" : closesTooSoon ? "hours" : "" });
      t += dur;
      prev = p;
    }
    if (tripEnd) {
      const leg = endLeg(prev, tripEnd);
      items.push({ kind: "leg", from: prev, to: tripEnd, leg, at: t });
      if (leg.type === "walk") walked += leg.m;
      t += leg.min;
      items.push({ kind: "end", at: t, place: tripEnd, tripEnd: true, by: ctx.endBy, late: ctx.endBy != null && t > ctx.endBy - endBuffer(tripEnd) });
    } else if (lastHub || base) {
      const endP = lastHub || base;
      const leg = legBetween(prev, endP);
      items.push({ kind: "leg", from: prev, to: endP, leg, at: t });
      if (leg.type === "walk") walked += leg.m;
      t += leg.min;
      items.push({ kind: "end", at: t, place: endP, isBase: endP === base });
    } else if (opts.mode !== "car" && start !== prev) {
      items.push({ kind: "end", at: t, place: prev, last: true, back: start });
    }
    if (ctx.tour && ctx.sleep && ctx.sleep[idx]) items.push({ kind: "sleep", at: t, town: ctx.sleep[idx] });
    return { idx, date, start, items, stops: keep, extra, walked, endAt: t, centre, town: ctx.townOf ? ctx.townOf[idx] : null };
  }

  // ------------------------------------------------------------------ main
  let MAP = null, layer = null, plan = null, current = 0;
  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("go");
    btn.disabled = true;
    const say = (t) => ($("status").textContent = t);
    try {
      say("Finding the place…");
      const dest = await resolve("dest", $("dest"));
      if (!dest) { say("Couldn't find that place — try the city name."); return; }
      const [from, base, end] = await Promise.all([resolve("from", $("from")).catch(() => null), resolve("base", $("base"), dest).catch(() => null), resolve("end", $("end"), dest).catch(() => null)]);
      const days = Math.max(1, Math.ceil(+opts.days));
      const likes = opts.likes.length ? opts.likes : ["must"];
      const centre = base && dist(base, dest) < 15000 ? { lat: (base.lat + dest.lat * 2) / 3, lon: (base.lon + dest.lon * 2) / 3 } : dest;
      const km = opts.mode === "car" ? Math.min(12 + days * 8, 50) : opts.mode === "pt" ? Math.min(3.5 + days * 1.6, 12) : Math.min(2.2 + days * .7, 5);
      state.city = dest;

      const tour = isArea(dest) && days >= 1;
      say(tour ? `Looking across ${dest.name} for the best places…` : "Looking up what's worth seeing…");
      const [raw, hubs, wx] = await Promise.all([tour ? placesInArea(dest).then((r) => r.length >= 15 ? r : placesByTowns(dest)).catch(() => placesByTowns(dest)) : placesAround(centre, km), tour ? Promise.resolve([]) : stationsAround(centre, km + 1), weather(dest, $("date").value, +opts.days)]);
      const all = tour ? await insideArea(dest, raw) : raw;
      let cands = all.map((p) => ({ ...p, cat: classify(p) })).filter((p) => p.cat && !/\b(former|demolished|defunct|destroyed|closed)\b/i.test(p.desc + "|" + p.types));
      if (!cands.length) { say("Wikidata knows of no sights around here yet — try a nearby bigger town."); return; }
      cands.forEach((p) => (p.score = scoreOf(p, likes)));
      // stadiums only for people who asked for shows and matches
      cands.forEach((p) => { if (/stadium|arena|venue/i.test(p.types) && !likes.includes("culture")) p.score *= .35; });
      // a very wet trip leans indoors (multi-day trips also swap the wettest day, below)
      const wetDays = wx ? wx.filter((w) => w.rain >= 70).length : 0;
      if (wx && wetDays && wetDays >= Math.ceil(wx.length / 2)) cands.forEach((p) => { p.score *= CATS[p.cat].indoor ? 1.5 : .6; });
      cands.sort((a, b) => b.score - a.score);
      // drop near-duplicates (a church and its own bell tower etc.)
      const picked = [];
      for (const p of cands) if (!picked.some((q) => dist(p, q) < 60 && (q.name.includes(p.name) || p.name.includes(q.name) || q.cat === p.cat))) picked.push(p);
      const perDay = Math.round(PACE[opts.pace].stops * (opts.days === "0.5" ? .55 : 1));
      const pool = picked.slice(0, Math.ceil(perDay * days * 1.5) + 3);

      say("Putting the days together…");
      let groups, tourInfo = null;
      if (tour) {
        // which towns, how many days each, in what order, and how you get between them
        const allTowns = towns(picked);
        const tl = allocateDays(allTowns, days, perDay);
        if (/debug/.test(location.search)) window.__tripDebug = { raw: raw.length, inside: all.length, cands: cands.length, picked: picked.slice(0, 40).map((p) => `${p.name} [${p.cat}] ${p.town} sl=${p.sl}`),
          towns: allTowns.slice(0, 15).map((t) => `${t.name}: ${t.places.length} places, score ${t.score.toFixed(1)}`), chosen: tl.map((t) => `${t.name}×${t.days}`) };
        const startNear = base || (from && dist(from, dest) < 300000 ? from : null);
        const ordered = orderTowns(tl, startNear, end);
        groups = []; const townOf = [], hubsFor = [], travel = [], sleep = [];
        const hubLists = await Promise.all(ordered.map((t) => opts.mode === "car" ? Promise.resolve([]) : stationsAround(t, 4)));
        ordered.forEach((t, ti) => {
          const parts = t.days > 1 ? balance(kmeans(t.places.slice(0, perDay * t.days + 4), t.days), perDay) : [t.places.slice(0, perDay + 3)];
          parts.forEach((g, k) => {
            const i = groups.length;
            groups.push(g); townOf.push(t.name); hubsFor.push(hubLists[ti]);
            if (i > 0 && k === 0) { const prev = ordered[ti - 1]; travel[i] = { from: prev, to: t, fromName: prev.name, toName: t.name, ...hop(prev, t) }; }
            sleep[i] = t.name;
          });
        });
        sleep[groups.length - 1] = null;
        tourInfo = { ordered, townOf, hubsFor, travel, sleep };
      } else {
        groups = balance(kmeans(pool, days), perDay);
        groups.sort((a, b) => b.reduce((s, p) => s + p.score, 0) - a.reduce((s, p) => s + p.score, 0));   // best day first
      }
      const dayDates = groups.map((_, i) => new Date(new Date($("date").value + "T12:00").getTime() + i * 864e5).toISOString().slice(0, 10));
      // a museum-heavy cluster suits the rainiest day (city trips only: on a tour the order follows the road)
      if (!tour && wx && groups.length > 1) {
        const indoor = (g) => g.filter((p) => CATS[p.cat].indoor).length / Math.max(1, g.length);
        const byRain = dayDates.map((d, i) => [i, (wx.find((w) => w.date === d) || {}).rain || 0]).sort((a, b) => b[1] - a[1]);
        const byIndoor = groups.map((g, i) => [i, indoor(g)]).sort((a, b) => b[1] - a[1]);
        if (byRain[0][1] >= 60) { const g2 = [...groups]; groups[byRain[0][0]] = g2[byIndoor[0][0]]; groups[byIndoor[0][0]] = g2[byRain[0][0]]; }
      }
      const ctx = { hubs, base, city: dest.name, tour, ...(tourInfo || {}), end, endBy: end && $("endBy").value ? minutes($("endBy").value) : null, lastIdx: groups.length - 1 };
      // your changes: places added to a day (+ Add) and places removed (Remove); kept in the share link
      const edits = pendingEdits || { add: {}, rm: [] };
      pendingEdits = null;
      const byId = Object.fromEntries(picked.map((p) => [p.id, p]));
      const make = (hrsOk) => {
        const out = groups.map((g, i) => {
          const forced = Object.entries(edits.add).filter(([, d]) => d === i).map(([id]) => byId[id]).filter(Boolean);
          const rest = g.filter((p) => !edits.rm.includes(p.id) && !(p.id in edits.add));
          picked.forEach((p) => (p.forced = p.id in edits.add));
          const list = [...forced, ...rest.slice(0, Math.max(0, perDay + 3 - forced.length))];
          return list.length ? buildDay(list, dayDates[i], i, ctx) : null;
        }).filter(Boolean);
        const leftovers = picked.filter((p) => !out.some((d) => d.stops.includes(p)) && !edits.rm.includes(p.id)).slice(0, 40);
        plan = { dest, from, base, end, endBy: ctx.endBy, days: out, wx, hubs, leftovers, likes, km, hrsOk, edits, byId, tour: tourInfo,
          replan() { const keep = current; make(plan.hrsOk); writeHash(); render(); showDay(Math.min(keep, plan.days.length - 1)); } };
      };
      make(null);
      writeHash();
      say("");
      $("out").hidden = false;
      render();
      $("out").scrollIntoView({ behavior: "smooth", block: "start" });
      // opening hours from OpenStreetMap arrive later; re-time the days when they do
      const token = (window.__tripRun = (window.__tripRun || 0) + 1);
      hoursFor((tour ? groups.flat() : pool).slice(0, 45), centre, tour ? 150 : km).then((hrs) => {
        if (token !== window.__tripRun) return;
        if (hrs) for (const p of pool) { const h = hrs[p.id]; if (h) { p.oh = h.oh; p.fee = h.fee; p.website = p.website || h.website; } }
        const keepDay = current;
        make(hrs ? true : false);
        render();
        if (keepDay) showDay(Math.min(keepDay, plan.days.length - 1));
      });
    } catch (err) {
      say("Something didn't answer (" + (err.message || err) + "). Try again in a moment.");
    } finally { btn.disabled = false; }
  });

  // ------------------------------------------------------------------ rendering
  const TRAINS = { it: [["Trenitalia", "https://www.trenitalia.com"], ["Italo", "https://www.italotreno.com"]], fr: [["SNCF Connect", "https://www.sncf-connect.com"]], de: [["Deutsche Bahn", "https://www.bahn.de"]],
    gb: [["National Rail", "https://www.nationalrail.co.uk"]], es: [["Renfe", "https://www.renfe.com"]], ch: [["SBB", "https://www.sbb.ch"]], nl: [["NS", "https://www.ns.nl"]], at: [["ÖBB", "https://www.oebb.at"]],
    be: [["SNCB", "https://www.belgiantrain.be"]], in: [["IRCTC", "https://www.irctc.co.in"], ["redBus (buses)", "https://www.redbus.in"]], us: [["Amtrak", "https://www.amtrak.com"]], pt: [["CP", "https://www.cp.pt"]],
    jp: [["JR (Japan Rail Pass info)", "https://japanrailpass.net"]], cn: [["12306 (China Railway)", "https://www.12306.cn"]], kr: [["Korail", "https://www.letskorail.com"]] };
  function linkA(text, href, cls) { const a = el("a", cls, text); a.href = href; a.target = "_blank"; a.rel = "noopener"; return a; }

  function render() {
    const { dest, from, days, wx } = plan;
    const sum = $("sum");
    sum.innerHTML = "";
    const h = el("div", "s-main");
    h.append(el("h2", null, plan.tour ? `${dest.name} — a ${days.length}-day tour` : dest.name));
    if (plan.tour) h.append(el("p", "route", plan.tour.ordered.map((t) => t.days > 1 ? `${t.name} (${t.days} days)` : t.name).join("  →  ")));
    h.append(el("p", null, `${days.length === 1 && opts.days === "0.5" ? "Half a day" : days.length + (days.length === 1 ? " day" : " days")} from ${new Date($("date").value + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · ${({ walk: "on foot", pt: "on foot with buses, trams and metro", car: "by car" })[opts.mode]} · ${WALK[opts.walk].label} · ${days.reduce((a, d) => a + d.stops.length, 0)} places`));
    const act = el("div", "s-act");
    const share = el("button", "btn", "Share this plan");
    share.onclick = async () => { try { if (navigator.share) await navigator.share({ title: `Trip: ${dest.name}`, url: location.href }); else { await navigator.clipboard.writeText(location.href); share.textContent = "Link copied"; } } catch {} };
    const print = el("button", "btn", "Print / PDF"); print.onclick = () => window.print();
    const edit = el("button", "btn", "Change details"); edit.onclick = () => $("form").scrollIntoView({ behavior: "smooth" });
    act.append(share, print, edit);
    sum.append(h, act);

    // cards: weather, getting there, getting around
    const cards = $("cards");
    cards.innerHTML = "";
    if (wx) {
      const c = el("section", "card wx");
      c.append(el("h3", null, "Weather"));
      const row = el("div", "wx-row");
      for (const w of wx) {
        const [ic, txt] = WX(w.code);
        const d = el("div", "wx-d" + (w.rain >= 60 ? " wet" : ""));
        d.append(el("span", "dd", new Date(w.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })), el("span", "ic", ic),
          el("span", "tt", `${Math.round(w.hi)}° / ${Math.round(w.lo)}°`), el("span", "rr", `${txt} · rain ${w.rain ?? "–"}%`), el("span", "ss", `Sunset ${w.sunset.slice(11, 16)}`));
        row.append(d);
      }
      c.append(row);
      if (wx.some((w) => w.rain >= 60)) c.append(el("p", "hint", "Rain is likely on the shaded day — that day leans on indoor places, and each day has a rainy-day swap below."));
      cards.append(c);
    } else {
      const c = el("section", "card wx");
      c.append(el("h3", null, "Weather"), el("p", "hint", "The forecast appears when your date is within the next 16 days."));
      cards.append(c);
    }
    const g = el("section", "card");
    g.append(el("h3", null, from ? `Getting there from ${from.name}` : "Getting there"));
    const gl = el("div", "links");
    if (from) {
      gl.append(linkA("All the ways (Rome2rio) ↗", `https://www.rome2rio.com/s/${encodeURIComponent(from.name)}/${encodeURIComponent(dest.name)}`),
        linkA("Public transport (Google Maps) ↗", gmaps.dir(from, plan.days[0].start, "transit")),
        linkA("Driving ↗", gmaps.dir(from, plan.days[0].start, "driving")));
      if (dist(from, dest) > 250000) gl.append(linkA("Flights (Google Flights) ↗", `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${from.name} to ${dest.name}`)}`));
    } else gl.append(el("span", "hint", "Add where you're coming from to get train, flight and route links."));
    for (const [n, u] of TRAINS[dest.cc] || [["Trainline", "https://www.thetrainline.com"]]) gl.append(linkA(`${n} — tickets ↗`, u));
    if (plan.end) {
      gl.append(el("span", "hint", `Trip ends at ${plan.end.name}${plan.endBy != null ? ", by " + fmtT(plan.endBy) : ""}.`));
      if (from) gl.append(linkA(`Home from ${plan.end.name} (Rome2rio) ↗`, `https://www.rome2rio.com/s/${encodeURIComponent(plan.end.name)}/${encodeURIComponent(from.name)}`));
    }
    g.append(gl);
    cards.append(g);
    const a = el("section", "card");
    a.append(el("h3", null, "Getting around"));
    const al = el("div", "links");
    if (opts.mode === "pt") {
      al.append(el("p", "hint", "Each day starts and ends at a station or stop. The bus, tram or metro legs open in Google Maps with live times. Many cities sell day passes, and some accept contactless cards on board, so check before buying single tickets."),
        linkA(`${dest.name} public transport tickets ↗`, `https://www.google.com/search?q=${encodeURIComponent(dest.name + " public transport tickets day pass official")}`));
    } else if (opts.mode === "car") {
      al.append(el("p", "hint", "Driving legs open in Google Maps. Old town centres often have restricted traffic zones (ZTL in Italy, for example) and you can be fined for driving in. Park at the edge and walk."),
        linkA(`Parking in ${dest.name} ↗`, gmaps.near("parking", dest)), linkA("Traffic-zone rules ↗", `https://www.google.com/search?q=${encodeURIComponent(dest.name + " limited traffic zone rules tourists")}`));
    } else {
      al.append(el("p", "hint", `All on foot. Each day is kept within ${fmtKm(WALK[opts.walk].leg)} between stops where possible. Wear comfortable shoes and carry water.`));
    }
    a.append(al);
    cards.append(a);

    // day tabs
    const nav = $("days");
    nav.innerHTML = "";
    days.forEach((d, i) => {
      const b = el("button", null);
      b.append(el("b", null, days.length === 1 ? "Your day" : `Day ${i + 1}${d.town ? " · " + d.town : ""}`), el("span", null, new Date(d.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })));
      b.onclick = () => showDay(i);
      nav.append(b);
    });
    showDay(0);
  }

  function iconFor(n, cls) { return L.divIcon({ className: "pin " + cls, html: `<span>${n}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }); }

  async function showDay(i) {
    current = i;
    document.querySelectorAll("#days button").forEach((b, k) => b.setAttribute("aria-pressed", k === i));
    const d = plan.days[i];
    const box = $("plan");
    box.innerHTML = "";
    const wx = plan.wx && plan.wx.find((w) => w.date === d.date);

    // day header
    const hd = el("div", "d-head");
    hd.append(el("h3", null, new Date(d.date + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })));
    const facts = [`${d.stops.length} places`, `about ${fmtKm(d.walked)} on foot`, `${fmtT(d.items[0].at)}–${fmtT(d.endAt)}`];
    if (wx) facts.push(`${WX(wx.code)[0]} ${Math.round(wx.hi)}°, rain ${wx.rain}%`);
    hd.append(el("p", null, facts.join(" · ")));
    const pts = [d.start, ...d.stops, ...(d.items.at(-1).kind === "end" && !d.items.at(-1).last ? [d.items.at(-1).place] : [])];
    const gm = el("div", "links");
    for (let k = 0; k < pts.length - 1; k += 10) gm.append(linkA(pts.length > 11 ? `Open route in Google Maps (part ${k / 10 + 1}) ↗` : "Open the whole day in Google Maps ↗", gmaps.route(pts.slice(k, k + 11), opts.mode === "car" ? "driving" : "walking"), "primary"));
    hd.append(gm);
    const nEd = Object.keys(plan.edits.add).length + plan.edits.rm.length;
    if (nEd) {
      const u = el("div", "edits");
      u.append(el("span", null, `${nEd} change${nEd > 1 ? "s" : ""} of yours — the times below are re-worked around them.`));
      const undo = el("button", "edit", "Undo all");
      undo.type = "button";
      undo.onclick = () => { plan.edits.add = {}; plan.edits.rm = []; plan.replan(); };
      u.append(undo);
      hd.append(u);
    }
    box.append(hd);

    // timeline
    const ol = el("ol", "tl");
    let n = 0;
    for (const it of d.items) {
      if (it.kind === "start" || it.kind === "end") {
        const li = el("li", "tl-hub");
        const label = it.tripEnd ? (it.place.name || "Trip ends") : it.last ? "Finish here" : it.isBase ? (plan.base ? plan.base.name : "Start") : it.place.name || "Start";
        const kind = it.tripEnd ? ("where your trip ends" + (it.by != null ? ` · be there by ${fmtT(it.by)}` + (isAirport(it.place) ? " (2 hours before a flight)" : "") : "")) : it.last ? `no station close by — ${it.back.name ? "back to " + it.back.name : "head back"} by bus/tram or on foot` : it.isBase ? "your base" : it.place.kind ? ({ train: "railway station", metro: "metro station", tram: "tram stop", bus: "bus station" })[it.place.kind] : "start";
        li.append(el("span", "time", fmtT(it.at)));
        const b = el("div", "body");
        b.append(el("div", "k", it.kind === "start" ? "Start" : it.tripEnd ? "Trip ends" : "Finish"), el("div", "name", label), el("div", "sub", kind));
        if (it.late) b.append(el("div", "hrs closed", `Tight: you'd arrive about ${fmtT(it.at)}. Drop the last stop, or leave earlier.`));
        const ls = el("div", "links");
        ls.append(linkA("Map ↗", gmaps.place(it.place)));
        if (it.last) ls.append(linkA(`Route back ↗`, gmaps.dir(it.place, plan.base || it.back, "transit")));
        if (it.kind === "end" && plan.base && !it.isBase && !it.last && !it.tripEnd) ls.append(linkA(`Back to ${plan.base.name} ↗`, gmaps.dir(it.place, plan.base, opts.mode === "car" ? "driving" : "transit")));
        if (it.kind === "start" && plan.base && !it.isBase) ls.append(linkA(`From ${plan.base.name} ↗`, gmaps.dir(plan.base, it.place, opts.mode === "car" ? "driving" : "transit")));
        b.append(ls);
        li.append(b);
        ol.append(li);
      } else if (it.kind === "leg") {
        const li = el("li", "tl-leg " + it.leg.type);
        const what = it.leg.type === "walk" ? `Walk ${fmtDur(it.leg.min)} · ${fmtKm(it.leg.m * 1.25)}` : it.leg.type === "pt" ? `Bus / tram / metro · about ${fmtDur(it.leg.min)}` : `Drive · about ${fmtDur(it.leg.min)}, then park`;
        li.append(el("span", "time", ""));
        const b = el("div", "body");
        b.append(el("span", "what", what), linkA(it.leg.type === "walk" ? "Directions ↗" : "Live route ↗", gmaps.dir(it.from, it.to, it.leg.type === "walk" ? "walking" : it.leg.type === "pt" ? "transit" : "driving")));
        if (it.leg.type === "car") b.append(linkA("Parking nearby ↗", gmaps.near("parking", it.to)));
        li.append(b);
        ol.append(li);
      } else if (it.kind === "travel") {
        const li = el("li", "tl-travel " + it.trav.type);
        li.append(el("span", "time", fmtT(it.at)));
        const b = el("div", "body");
        b.append(el("div", "k", "Travel"), el("div", "name", `${it.trav.fromName} → ${it.trav.toName}`),
          el("div", "sub", `about ${fmtKm(it.trav.m)} · ${fmtDur(it.trav.min)} ${it.trav.type === "car" ? "by car" : "by train or bus"}`));
        const ls = el("div", "links");
        ls.append(linkA(it.trav.type === "car" ? "Driving route ↗" : "Trains & buses (Google Maps) ↗", gmaps.dir(it.trav.from, it.to, it.trav.type === "car" ? "driving" : "transit")));
        if (it.trav.type !== "car") for (const [n, u] of TRAINS[plan.dest.cc] || [["Trainline", "https://www.thetrainline.com"]]) ls.append(linkA(`${n} ↗`, u));
        ls.append(linkA("All options (Rome2rio) ↗", `https://www.rome2rio.com/s/${encodeURIComponent(it.trav.fromName + ", " + plan.dest.name)}/${encodeURIComponent(it.trav.toName + ", " + plan.dest.name)}`));
        b.append(ls);
        li.append(b);
        ol.append(li);
      } else if (it.kind === "sleep") {
        const li = el("li", "tl-sleep");
        li.append(el("span", "time", ""));
        const b = el("div", "body");
        b.append(el("div", "k", "Overnight"), el("div", "name", `Stay in ${it.town}`));
        const ls = el("div", "links");
        ls.append(linkA("Places to stay ↗", `https://www.google.com/travel/hotels/${encodeURIComponent(it.town + ", " + plan.dest.name)}`), linkA("Dinner nearby ↗", gmaps.near("restaurants", d.stops[d.stops.length - 1] || d.start)));
        b.append(ls);
        li.append(b);
        ol.append(li);
      } else if (it.kind === "lunch") {
        const li = el("li", "tl-lunch");
        li.append(el("span", "time", fmtT(it.at)));
        const b = el("div", "body");
        b.append(el("div", "name", "Lunch break · about an hour"), linkA("Places to eat nearby ↗", gmaps.near("restaurants", it.near)));
        li.append(b);
        ol.append(li);
      } else {
        n++;
        const p = it.place;
        const li = el("li", "tl-stop" + (it.warn ? " warn" : ""));
        li.dataset.n = n;
        li.append(el("span", "time", `${fmtT(it.at)}\n${fmtT(it.end)}`));
        const b = el("div", "body");
        const top = el("div", "top");
        const num = el("span", "num", n);
        const nm = el("div", "name");
        nm.append(document.createTextNode(p.name));
        top.append(num, nm);
        b.append(top);
        b.append(el("div", "sub", [CATS[p.cat].label, fmtDur(it.end - it.at), p.fee === "yes" ? "ticket needed" : p.fee === "no" ? "free" : ""].filter(Boolean).join(" · ")));
        const hrs = el("div", "hrs " + it.hours.s);
        hrs.textContent = it.hours.s === "open" ? it.hours.txt + " on this day" + (it.wait ? ` — opens at ${fmtT(it.at)}, so the plan waits` : "") :
          it.hours.s === "closed" ? "Closed on this day, according to OpenStreetMap. Swap it with one of the alternatives below." : plan.hrsOk ? "Opening hours not listed. Check before you go." : plan.hrsOk === null ? "Checking opening hours…" : "Opening hours couldn't be checked right now (the map data server is busy).";
        if (it.warn === "hours") hrs.textContent += " It may close before you're done here.";
        b.append(hrs);
        const desc = el("p", "desc", p.desc ? p.desc.charAt(0).toUpperCase() + p.desc.slice(1) + "." : "");
        b.append(desc);
        const ls = el("div", "links");
        if (p.website) ls.append(linkA("Official site ↗", p.website));
        ls.append(linkA("Tickets & hours ↗", `https://www.google.com/search?q=${encodeURIComponent(`"${p.name}" ${plan.dest.name} official tickets opening hours`)}`));
        if (p.wiki) ls.append(linkA("Wikipedia ↗", `https://en.wikipedia.org/wiki/${encodeURIComponent(p.wiki.replace(/ /g, "_"))}`));
        ls.append(linkA("Map ↗", gmaps.place(p)));
        const rm = el("button", "edit rm", "Remove");
        rm.type = "button";
        rm.title = "Take this out and re-time the day";
        rm.onclick = () => { delete plan.edits.add[p.id]; if (!plan.edits.rm.includes(p.id)) plan.edits.rm.push(p.id); plan.replan(); };
        ls.append(rm);
        if (p.forced) top.append(el("span", "added", "added by you"));
        b.append(ls);
        li.append(b);
        const fig = el("div", "thumb");
        li.append(fig);
        ol.append(li);
        if (p.wiki) wikiSummary(p.wiki).then((s) => {
          if (!s) return;
          if (s.text) desc.textContent = s.text.length > 280 ? s.text.slice(0, 280).replace(/\s+\S*$/, "") + "…" : s.text;
          if (s.thumb) { const im = el("img"); im.src = s.thumb; im.alt = ""; im.loading = "lazy"; fig.append(im); }
        });
      }
    }
    box.append(ol);

    // scenarios
    const sc = el("section", "scen");
    sc.append(el("h3", null, "If plans change"), el("p", "sc-hint", "Tap + Add to fit a place into this day; the order and times are worked out again. Remove takes a stop out."));
    const near = (pred, k = 3) => plan.leftovers.concat(d.extra).filter((p) => !plan.tour || dist(d.centre, p) < 15000).filter(pred).sort((a, b) => dist(d.centre, a) - dist(d.centre, b)).slice(0, k);
    const blocks = [];
    const rainy = near((p) => CATS[p.cat].indoor && !/stadium|arena/i.test(p.types) && !d.stops.includes(p));
    const outdoor = d.stops.filter((p) => !CATS[p.cat].indoor);
    if (rainy.length) blocks.push(["If it rains", `Swap ${outdoor.slice(0, 2).map((p) => p.name).join(" and ") || "the outdoor stops"} for something indoors:`, rainy]);
    const must = [...d.stops].sort((a, b) => b.sl - a.sl).slice(0, 3);
    blocks.push(["Short on time", "If you only have a couple of hours, do these three:", must]);
    const views = near((p) => p.cat === "nature" || p.cat === "parks" || /tower|bridge|square|piazza|viewpoint/i.test(p.types), 3);
    if (views.length) blocks.push(["Evening", wx ? `Sunset is at ${wx.sunset.slice(11, 16)}. Good places to end the day:` : "Good places to end the day:", views]);
    if (d.extra.length) blocks.push(["If you have more time", "Nearby, and worth it:", d.extra.slice(0, 4)]);
    const closed = d.items.filter((x) => x.kind === "stop" && x.warn === "closed");
    if (closed.length) blocks.push(["Closed on this day", `${closed.map((x) => x.place.name).join(", ")} ${closed.length > 1 ? "are" : "is"} listed as closed. Go another day, or try:`, near((p) => !d.stops.includes(p) && p.cat === closed[0].place.cat, 3)]);
    for (const [t, s, list] of blocks) {
      const c = el("div", "sc");
      c.append(el("h4", null, t), el("p", null, s));
      const ul = el("ul");
      for (const p of list) {
        const li = el("li");
        const inDay = d.stops.includes(p);
        if (!inDay) {
          const add = el("button", "edit add", "+ Add");
          add.type = "button";
          add.title = "Add to this day and re-time it";
          add.onclick = () => { plan.edits.add[p.id] = d.idx; plan.edits.rm = plan.edits.rm.filter((x) => x !== p.id); plan.replan(); };
          li.append(add);
        }
        li.append(linkA(p.name, gmaps.place(p)), el("span", null, ` · ${CATS[p.cat].label}${inDay ? " · already in today's plan" : dist(d.centre, p) > 0 ? " · " + fmtKm(dist(d.centre, p)) + " from the day's centre" : ""}`));
        ul.append(li);
      }
      c.append(ul);
      sc.append(c);
    }
    box.append(sc);

    drawMap(d);
  }

  async function drawMap(d) {
    if (!window.L) return;
    if (!MAP) {
      MAP = L.map("map", { scrollWheelZoom: false, zoomControl: true });
      const Refresh = L.Control.extend({
        options: { position: "topright" },
        onAdd() {
          const b = L.DomUtil.create("button", "map-refresh");
          b.type = "button"; b.title = "Refresh the map"; b.setAttribute("aria-label", "Refresh the map");
          b.innerHTML = "↻";
          L.DomEvent.disableClickPropagation(b);
          b.onclick = () => { b.classList.add("spin"); MAP.invalidateSize(); drawMap(plan.days[current]).finally(() => setTimeout(() => b.classList.remove("spin"), 300)); };
          return b;
        },
      });
      new Refresh().addTo(MAP);
      // redraw whenever the box changes size (shown, rotated phone, window resized)
      let rz = null;
      new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { MAP.invalidateSize(); if (MAP.__fit) MAP.fitBounds(MAP.__fit, { padding: [30, 30], maxZoom: 16 }); }, 120); }).observe($("map"));
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") MAP.invalidateSize(); });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(MAP);
    }
    if (layer) layer.remove();
    layer = L.layerGroup().addTo(MAP);
    const pts = [];
    let n = 0;
    for (const it of d.items) {
      if (it.kind === "stop") {
        n++;
        const m = L.marker([it.place.lat, it.place.lon], { icon: iconFor(n, it.warn ? "warn" : "") }).addTo(layer);
        m.bindPopup(`<b>${n}. ${it.place.name.replace(/</g, "&lt;")}</b><br>${fmtT(it.at)}–${fmtT(it.end)}`);
        const k = n;
        m.on("click", () => document.querySelector(`.tl-stop[data-n="${k}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
        pts.push([it.place.lat, it.place.lon]);
      } else if ((it.kind === "start" || it.kind === "end") && !it.last) {
        L.marker([it.place.lat, it.place.lon], { icon: iconFor(it.kind === "start" ? "S" : "F", "hub") }).addTo(layer).bindPopup(`<b>${it.kind === "start" ? "Start" : "Finish"}</b><br>${(it.place.name || "").replace(/</g, "&lt;")}`);
        pts.push([it.place.lat, it.place.lon]);
      }
    }
    MAP.invalidateSize();
    MAP.__fit = pts.length ? pts : null;
    if (pts.length) MAP.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
    setTimeout(() => { MAP.invalidateSize(); if (pts.length) MAP.fitBounds(pts, { padding: [30, 30], maxZoom: 16 }); }, 120);
    // walking paths along real streets for the walking legs; straight dashed lines for rides
    const legs = d.items.filter((x) => x.kind === "leg");
    for (const it of legs) {
      if (it.leg.type !== "walk") {
        L.polyline([[it.from.lat, it.from.lon], [it.to.lat, it.to.lon]], { color: "#7a7a7a", weight: 3, dashArray: "6 8", opacity: .9 }).addTo(layer);
      }
    }
    const walkLegs = legs.filter((x) => x.leg.type === "walk");
    const myLayer = layer, color = getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#1F6F78";
    // consecutive walking legs become one stretch = one routing request (the free server dislikes bursts)
    const chains = [];
    for (const it of legs) {
      if (it.leg.type !== "walk") { chains.push(null); continue; }
      const last = chains[chains.length - 1];
      if (last) last.push(it.to); else chains.push([it.from, it.to]);
    }
    for (const ch of chains.filter(Boolean)) {
      if (layer !== myLayer) return;
      try {
        const j = await getJSON(`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${ch.map((p) => `${p.lon},${p.lat}`).join(";")}?overview=full&geometries=geojson`, {}, 12000);
        const g = j.routes && j.routes[0];
        if (g && layer === myLayer) { L.geoJSON(g.geometry, { style: { color, weight: 4, opacity: .85 } }).addTo(myLayer); continue; }
      } catch { /* straight lines instead */ }
      if (layer === myLayer) L.polyline(ch.map((p) => [p.lat, p.lon]), { color, weight: 3, opacity: .6, dashArray: "2 6" }).addTo(myLayer);
    }
  }

  // ------------------------------------------------------------------ shared links: #d=Florence&dt=…
  let lastHash = "", pendingEdits = null;
  function writeHash() {
    const q = { d: $("dest").value, f: $("from").value, b: $("base").value, e: $("end").value, eb: $("endBy").value, dt: $("date").value,
      ...Object.fromEntries(Object.entries(opts).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v])), t0: $("t0").value, t1: $("t1").value, l: $("lunch").checked ? 1 : 0 };
    const ed = plan && plan.edits;
    if (ed && Object.keys(ed.add).length) q.a = Object.entries(ed.add).map(([id, d]) => `${id}.${d}`).join(",");
    if (ed && ed.rm.length) q.x = ed.rm.join(",");
    lastHash = "#" + new URLSearchParams(q);
    history.replaceState(null, "", lastHash);
  }
  function fromHash() {
    if (location.hash === lastHash) return;
    lastHash = location.hash;
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.get("d")) return;
    state.dest = state.from = state.base = state.end = null;
    $("dest").value = h.get("d"); $("from").value = h.get("f") || ""; $("base").value = h.get("b") || "";
    $("end").value = h.get("e") || ""; $("endBy").value = h.get("eb") || "";
    pendingEdits = { add: Object.fromEntries((h.get("a") || "").split(",").filter(Boolean).map((x) => { const [id, d] = x.split("."); return [id, +d]; })), rm: (h.get("x") || "").split(",").filter(Boolean) };
    if (h.get("dt")) $("date").value = h.get("dt");
    for (const k of ["days", "mode", "walk", "pace"]) if (h.get(k)) opts[k] = h.get(k);
    if (h.get("likes")) opts.likes = h.get("likes").split(",");
    if (h.get("t0")) $("t0").value = h.get("t0");
    if (h.get("t1")) $("t1").value = h.get("t1");
    $("lunch").checked = h.get("l") !== "0";
    document.querySelectorAll(".chips").forEach((box) => { const nm = box.dataset.name, multi = box.classList.contains("multi"); box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", multi ? opts[nm].includes(b.dataset.v) : opts[nm] === b.dataset.v)); });
    setTimeout(() => $("form").requestSubmit(), 50);
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
