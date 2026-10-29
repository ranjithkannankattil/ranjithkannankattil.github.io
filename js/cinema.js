// English OV cinema finder (expats/cinema.html). Listings are built by
// .github/workflows/build-cinema.yml (scripts/build_cinema.py) and published to the cinema-data branch.
(function () {
  const BASE = "https://raw.githubusercontent.com/ranjithkannankattil/ranjithkannankattil.github.io/cinema-data/";
  const CITIES = [["milano", "Milano"], ["roma", "Roma"], ["torino", "Torino"], ["bologna", "Bologna"], ["firenze", "Firenze"],
    ["napoli", "Napoli"], ["genova", "Genova"], ["venezia", "Venezia"], ["padova", "Padova"], ["verona", "Verona"],
    ["bergamo", "Bergamo"], ["brescia", "Brescia"], ["monza", "Monza"], ["pisa", "Pisa"], ["trieste", "Trieste"]];
  // Where to buy when a listing has no per-screening link. Keys are normalised cinema names.
  const BOOK = {
    "anteo palazzo del cinema": "https://anteo.spaziocinema.18tickets.it/",
    "citylife anteo": "https://www.spaziocinema.info/",
    "ariosto spaziocinema": "https://www.spaziocinema.info/",
    "uci cinemas bicocca": "https://ucicinemas.it/cinema/lombardia/milano/uci-cinemas-bicocca-milano/",
    "colosseo": "http://www.ilregnodelcinema.com/colosseo",
    "cineteca arlecchino": "https://www.cinetecamilano.it/",
    "cineteca milano mic": "https://www.cinetecamilano.it/",
  };

  const $ = (s) => document.querySelector(s);
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  const fromHash = (location.hash || "").slice(1);
  const state = {
    city: CITIES.some((c) => c[0] === fromHash) ? fromHash : store.get("cn-city") || "milano",
    q: "", lang: store.get("cn-lang") || "en", when: "up", docs: {}, failed: false,
  };

  const sel = $("#city");
  for (const [id, name] of CITIES) { const o = document.createElement("option"); o.value = id; o.textContent = name; sel.appendChild(o); }
  sel.value = state.city;

  /* ---------- fuzzy search: typos, prefixes and out-of-order words ---------- */
  const norm = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let p = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const c = [i]; let m = i;
      for (let j = 1; j <= b.length; j++) { c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); m = Math.min(m, c[j]); }
      if (m > max) return max + 1; p = c;
    }
    return p[b.length];
  }
  function tokScore(tok, words, full) {
    if (full.includes(tok)) return tok.length > 2 ? 3 : 2;
    let best = 0;
    for (const w of words) {
      if (w.startsWith(tok)) return 2.5;
      const max = tok.length <= 4 ? 1 : tok.length <= 9 ? 2 : 3;
      const d = Math.min(lev(tok, w, max), lev(tok, w.slice(0, tok.length + 1), max));
      if (d <= max) best = Math.max(best, 1.6 - d * 0.4);
    }
    // last resort: letters in order inside one word, e.g. "trnspttng" → trainspotting
    if (!best && tok.length >= 4) {
      for (const w of words) {
        if (w.length > tok.length * 1.7 || w[0] !== tok[0]) continue;
        let i = 0; for (const ch of w) { if (ch === tok[i]) i++; if (i === tok.length) return 0.8; }
      }
    }
    return best;
  }
  function score(f, q) {
    const toks = norm(q).split(" ").filter(Boolean);
    if (!toks.length) return 1;
    const full = norm([f.t, f.it, f.dir, (f.cast || []).join(" "), (f.shows || []).map((s) => s.cinema).join(" "), f.lang].join(" "));
    const words = full.split(" ");
    let total = 0;
    for (const t of toks) { const s = tokScore(t, words, full); if (!s) return 0; total += s; }
    if (norm(f.t + " " + (f.it || "")).includes(norm(q))) total += 4;
    return total;
  }

  /* ---------- time ---------- */
  function romeNow() {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const g = (k) => p.find((x) => x.type === k).value;
    return { date: `${g("year")}-${g("month")}-${g("day")}`, mins: (+g("hour") % 24) * 60 + +g("minute") };
  }
  const mins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const day = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); } catch { return d; } };
  const clock = (iso) => { try { return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  const esc = (s) => (s ?? "").toString().replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function hl(text, q) {
    let out = esc(text);
    for (const t of norm(q).split(" ").filter((t) => t.length > 1)) out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
    return out;
  }

  /* ---------- data ---------- */
  async function load(city, fresh) {
    const bust = fresh ? `?t=${Date.now()}` : `?h=${Math.floor(Date.now() / 600000)}`;
    const r = await fetch(BASE + city + ".json" + bust, { cache: fresh ? "no-store" : "default" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  async function show(city, fresh) {
    try {
      const doc = await load(city, fresh);
      state.docs[city] = doc || { missing: true };
      state.failed = false;
    } catch { state.failed = true; }
    render();
  }

  /* ---------- render ---------- */
  function render() {
    const doc = state.docs[state.city];
    const name = CITIES.find((c) => c[0] === state.city)[1];
    const list = $("#list"), status = $("#status");
    const now = romeNow();
    if (!doc) {
      status.textContent = state.failed ? "Couldn't reach the listings. Check your connection; the page retries every few minutes." : "Loading today's listings…";
      if (state.failed) list.innerHTML = `<div class="cn-empty"><b>Listings unavailable</b>The page will try again shortly.</div>`;
      return;
    }
    if (doc.missing) {
      status.textContent = "";
      list.innerHTML = `<div class="cn-empty"><b>No listings for ${esc(name)} yet</b>They appear after the next scheduled update.</div>`;
      return;
    }
    const isToday = doc.date === now.date;
    status.innerHTML = `<span class="dot${isToday ? "" : " stale"}"></span>${isToday ? `Today, ${day(doc.date)}` : `Listings for ${day(doc.date)} · today's are on the way`} · updated ${clock(doc.updatedAt)}`;

    const all = doc.films || [];
    const films = all.filter((f) => state.lang === "all" || f.en);
    const rows = films.map((f) => {
      const shows = (f.shows || []).map((s) => {
        const times = (s.times || []).slice().sort().map((t) => ({ t, past: isToday && mins(t) < now.mins - 10 }));
        const deep = !!(s.links && Object.keys(s.links).length);
        return { ...s, times, deep, book: s.book || BOOK[norm(s.cinema)] };
      }).filter((s) => state.when === "all" || !isToday || s.times.some((x) => !x.past));
      const up = shows.flatMap((s) => s.times.filter((x) => !x.past).map((x) => mins(x.t)));
      return { f, shows, next: up.length ? Math.min(...up) : 9999, score: score(f, state.q) };
    }).filter((r) => r.score > 0 && r.shows.length);
    rows.sort((a, b) => (state.q ? b.score - a.score : 0) || a.next - b.next || a.f.t.localeCompare(b.f.t));

    if (!rows.length) {
      const hidden = all.length - films.length;
      const why = state.q ? `Nothing matches “${esc(state.q)}”. Try fewer letters or another spelling.`
        : isToday && state.when === "up" && films.length ? `Today's ${state.lang === "en" ? "English " : ""}screenings in ${esc(name)} have all started. Switch to “All today” to see them.`
        : `No ${state.lang === "en" ? "English-language " : ""}original-version screenings listed in ${esc(name)} today.`;
      list.innerHTML = `<div class="cn-empty"><b>Nothing to show</b>${why}${hidden && state.lang === "en" ? ` ${hidden} film${hidden > 1 ? "s" : ""} in other languages hidden.` : ""}</div>`;
      return;
    }

    list.innerHTML = rows.map(({ f, shows, next }) => {
      const venues = shows.map((s) => {
        const chips = s.times.map((x) => {
          let cls = "cn-t" + (x.past ? " past" : isToday && mins(x.t) === next ? " next" : "");
          const href = x.past ? null : (s.links && s.links[x.t]) || s.book || s.mm;
          return href
            ? `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener" title="Book the ${esc(x.t)} screening at ${esc(s.cinema)}">${esc(x.t)}</a>`
            : `<span class="${cls}">${esc(x.t)}</span>`;
        }).join("");
        const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent((/cinema/i.test(s.cinema) ? "" : "Cinema ") + s.cinema + ", " + name);
        const links = [];
        if (!s.deep && s.book) links.push(`<a class="book" href="${esc(s.book)}" target="_blank" rel="noopener">Book tickets ↗</a>`);
        links.push(`<a href="${maps}" target="_blank" rel="noopener">Map ↗</a>`);
        if (s.mm && s.mm !== s.book) links.push(`<a href="${esc(s.mm)}" target="_blank" rel="noopener">All times ↗</a>`);
        const hint = s.deep ? `<div class="cn-hint">Tap a time to book that screening.</div>` : s.book ? "" : `<div class="cn-hint">Tickets at the box office or from the cinema's listing.</div>`;
        return `<div class="cn-venue"><div class="cn-vname">${hl(s.cinema, state.q)}<span class="cn-vlinks">${links.join("")}</span></div><div class="cn-times">${chips}</div>${hint}</div>`;
      }).join("");
      const meta = [f.lang, f.y, (f.country || []).join(" / "), f.dur ? f.dur + " min" : "", f.dir ? "dir. " + f.dir : ""].filter(Boolean).map(esc).join(" · ");
      const ttl = f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${hl(f.t, state.q)}</a>` : hl(f.t, state.q);
      const it = f.it && norm(f.it) !== norm(f.t) ? `<div class="cn-it">In Italy: ${hl(f.it, state.q)}</div>` : "";
      return `<article class="cn-film"><div class="cn-stub"><span>${esc(f.en ? "English" : f.lang && f.lang !== "Original language" ? f.lang : "VO")}</span></div><div class="cn-body">
        <h2 class="cn-ttl">${ttl}</h2>${it}<div class="cn-meta">${meta}</div>
        ${f.cast && f.cast.length ? `<div class="cn-cast">With ${hl(f.cast.join(", "), state.q)}</div>` : ""}
        <div class="cn-venues">${venues}</div></div></article>`;
    }).join("");
  }

  /* ---------- controls ---------- */
  sel.addEventListener("change", () => {
    state.city = sel.value; store.set("cn-city", state.city);
    history.replaceState(null, "", "#" + state.city);
    if (state.docs[state.city]) render(); else { render(); show(state.city); }
  });
  let qt;
  $("#q").addEventListener("input", (e) => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value; render(); }, 90); });
  function seg(a, b, key, va, vb, keep) {
    const set = (v) => {
      state[key] = v;
      $(a).setAttribute("aria-pressed", String(v === va)); $(b).setAttribute("aria-pressed", String(v === vb));
      if (keep) store.set(keep, v);
      render();
    };
    $(a).addEventListener("click", () => set(va)); $(b).addEventListener("click", () => set(vb));
    if (state[key] === vb) { $(a).setAttribute("aria-pressed", "false"); $(b).setAttribute("aria-pressed", "true"); }
  }
  seg("#langEn", "#langAll", "lang", "en", "all", "cn-lang");
  seg("#whenUp", "#whenAll", "when", "up", "all");

  // keep it live: past/next times follow the clock, and new listings are picked up while the page is open
  setInterval(render, 60000);
  setInterval(() => { if (!document.hidden) show(state.city, true); }, 10 * 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) show(state.city, true); });

  show(state.city);
})();
