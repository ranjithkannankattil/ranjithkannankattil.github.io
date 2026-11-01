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
    q: "", lang: store.get("cn-lang") || "en", when: "up", docs: {}, failed: false, day: null,
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
    // the days on offer: MYmovies' today plus what the cinemas sell ahead on their own sites
    const dayList = [{ date: doc.date, films: doc.films || [] }, ...(doc.upcoming || [])].filter((d) => d.date >= now.date || d.date === doc.date);
    if (!state.day || !dayList.some((d) => d.date === state.day)) state.day = dayList.some((d) => d.date === now.date) ? now.date : doc.date;
    const sel_ = dayList.find((d) => d.date === state.day);
    const isToday = state.day === now.date;
    const ahead = state.day !== doc.date;
    renderDays(dayList, now);
    $("#whenGroup").hidden = !isToday;
    status.innerHTML = ahead
      ? `<span class="dot"></span>${day(state.day)} · from the cinemas' own ticket sites · updated ${clock(doc.updatedAt)}`
      : `<span class="dot${isToday ? "" : " stale"}"></span>${isToday ? `Today, ${day(doc.date)}` : `Listings for ${day(doc.date)} · today's are on the way`} · updated ${clock(doc.updatedAt)}`;

    const all = sel_.films || [];
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

    const aheadNote = ahead
      ? `<p class="cn-ahead">Later days list only the cinemas that sell ahead on their own ticket sites${doc.ahead && doc.ahead.length ? ` (${doc.ahead.map(esc).join(", ")})` : ""}. Cinemas such as UCI, The Space and Beltrade post their times on the day, and most cinemas publish the next week's programme on Wednesday or Thursday, so check back.</p>`
      : "";
    if (!rows.length) {
      const hidden = all.length - films.length;
      if (ahead && !state.q) {
        list.innerHTML = aheadNote + `<div class="cn-empty"><b>Nothing published yet for ${esc(day(state.day))}</b>No ${state.lang === "en" ? "English-language " : ""}original-version shows are on the cinemas' sites for that day yet.${hidden && state.lang === "en" ? ` ${hidden} film${hidden > 1 ? "s" : ""} in other languages hidden.` : ""}</div>`;
        return;
      }
      const why = state.q ? `Nothing matches “${esc(state.q)}”. Try fewer letters or another spelling.`
        : isToday && state.when === "up" && films.length ? `Today's ${state.lang === "en" ? "English " : ""}screenings in ${esc(name)} have all started. Switch to “All today” to see them.`
        : `No ${state.lang === "en" ? "English-language " : ""}original-version screenings listed in ${esc(name)} today.`;
      list.innerHTML = `<div class="cn-empty"><b>Nothing to show</b>${why}${hidden && state.lang === "en" ? ` ${hidden} film${hidden > 1 ? "s" : ""} in other languages hidden.` : ""}</div>`;
      return;
    }

    list.innerHTML = aheadNote + rows.map(({ f, shows, next }) => card(f, shows, next, isToday, name)).join("");
  }

  function renderDays(dayList, now) {
    const box = $("#days");
    if (dayList.length < 2) { box.hidden = true; return; }
    box.hidden = false;
    const tomorrow = (() => { const d = new Date(now.date + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
    box.innerHTML = dayList.map((d) => {
      const n = (d.films || []).filter((f) => state.lang === "all" || f.en).length;
      const wd = (() => { try { return new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" }); } catch { return ""; } })();
      const dn = Number(d.date.slice(8, 10));
      const label = d.date === now.date ? "Today" : d.date === tomorrow ? "Tomorrow" : wd;
      return `<button type="button" role="tab" data-day="${d.date}" aria-selected="${d.date === state.day}" class="${n ? "" : "none"}"><span class="d">${label}</span><span class="n">${label === wd ? dn + " · " : ""}${n} film${n === 1 ? "" : "s"}</span></button>`;
    }).join("");
    const on = box.querySelector('[aria-selected="true"]');
    if (on && (on.offsetLeft < box.scrollLeft || on.offsetLeft + on.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollLeft = on.offsetLeft - 8;
  }

  const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const longDate = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };
  const fkey = (f) => f.url || f.t;

  function chip(s, x, f, isNext) {
    const end = f.dur ? "–" + hm(mins(x.t) + f.dur) : "";
    const hall = s.halls && s.halls[x.t] ? `<span class="hall">${esc(s.halls[x.t])}</span>` : "";
    const when = `<span class="when">${esc(x.t)}${end}</span>`;
    const nx = isNext ? `<span class="nx">next</span>` : "";
    if (x.past) return `<span class="cn-t past" title="Already started">${when}${hall}</span>`;
    const deep = s.links && s.links[x.t];
    const href = deep || s.book || s.mm;
    if (!href) return `<span class="cn-t site">${nx}${when}${hall}<span class="act">Box office</span></span>`;
    const act = deep ? "Book this show ›" : s.book ? "Cinema site ↗" : "Listing ↗";
    const tip = deep ? `Book the ${x.t} show of ${f.t} at ${s.cinema}` : `Open ${s.cinema}'s site, then pick ${f.t} at ${x.t}`;
    return `<a class="cn-t ${deep ? "deep" : "site"}" href="${esc(href)}" target="_blank" rel="noopener" title="${esc(tip)}">${nx}${when}${hall}<span class="act">${act}</span></a>`;
  }

  function venue(s, f, next, isToday, city) {
    const chips = s.times.map((x) => chip(s, x, f, isToday && !x.past && mins(x.t) === next)).join("");
    const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent((/cinema/i.test(s.cinema) ? "" : "Cinema ") + s.cinema + ", " + city);
    const links = [`<a href="${maps}" target="_blank" rel="noopener">Map ↗</a>`];
    if (s.mm && s.mm !== s.book) links.push(`<a href="${esc(s.mm)}" target="_blank" rel="noopener">All times ↗</a>`);
    const price = s.price ? `<span class="cn-price">Full price €${s.price.toFixed(2)}</span>` : "";
    const openTimes = s.times.filter((x) => !x.past);
    const anyDeep = openTimes.some((x) => s.links && s.links[x.t]);
    let note = "";
    if (openTimes.length && !anyDeep) {
      note = s.book
        ? `No direct booking for this cinema. Tap a time to open ${esc(s.cinema)}’s own site, then pick ${esc(f.t)} there.`
        : s.mm ? `No direct booking for this cinema. Tap a time to see ${esc(s.cinema)}’s listing on MYmovies; tickets are sold at the box office.`
          : `No online booking found for this cinema. Tickets are sold at the box office.`;
    }
    return `<div class="cn-venue"><div class="cn-vname">${hl(s.cinema, state.q)}${price}<span class="cn-vlinks">${links.join("")}</span></div>
      ${note ? `<div class="cn-hint">${note}</div>` : ""}<div class="cn-times">${chips}</div></div>`;
  }

  function extras(f) {
    const out = [];
    const r = f.ratings || {};
    const rt = [];
    if (r.imdb) rt.push(`<a href="${esc(f.imdbUrl || "#")}" target="_blank" rel="noopener"><b>IMDb</b> ${r.imdb.v.toFixed(1)}</a>`);
    if (r.rt != null) rt.push(`<a href="${esc(f.rtUrl || "#")}" target="_blank" rel="noopener"><b>Rotten Tomatoes</b> ${r.rt}%</a>`);
    const mv = f.tmdb ? `../movies.html#/m/${encodeURIComponent(f.tmdb)}` : `../movies.html#/s/${encodeURIComponent(f.t)}`;
    rt.push(`<a class="cn-mv" href="${mv}" target="_blank" rel="noopener"${f.tmdb || f.tmdb === 0 ? "" : ` data-t="${esc(f.t)}" data-y="${esc(f.y || "")}"`} title="Cast, all ratings, trailer and similar films">Movies page ↗</a>`);
    out.push(`<div class="cn-rate">${rt.join("")}</div>`);
    const today = romeNow().date;
    if (f.stream && f.stream.on.length) {
      const on = esc(f.stream.on.join(", "));
      out.push(`<div class="cn-ott">Streaming in Italy on ${f.stream.link ? `<a href="${esc(f.stream.link)}" target="_blank" rel="noopener">${on}</a>` : on}</div>`);
    } else if (f.ott && f.ott.date) {
      const where = f.ott.where === "IT" ? "in Italy" : f.ott.where === "US" ? "in the US" : "in the UK";
      out.push(`<div class="cn-ott">${f.ott.date > today ? "On streaming " + where + " from" : "Released for streaming " + where + " on"} ${esc(longDate(f.ott.date))}</div>`);
    }
    return out.join("");
  }

  function card(f, shows, next, isToday, city) {
    const venues = shows.map((s) => venue(s, f, next, isToday, city)).join("");
    const meta = [f.lang, f.y, (f.country || []).join(" / "), f.dur ? f.dur + " min" : "", f.dir ? "dir. " + f.dir : ""].filter(Boolean).map(esc).join(" · ");
    const ttl = f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${hl(f.t, state.q)}</a>` : hl(f.t, state.q);
    const it = f.it && norm(f.it) !== norm(f.t) ? `<div class="cn-it">In Italy: ${hl(f.it, state.q)}</div>` : "";
    const poster = f.poster ? `<img class="cn-poster" src="${esc(f.poster)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : "";
    const k = fkey(f);
    const plot = f.syn ? `<details class="cn-plot" data-k="${esc(k)}"${openPlots.has(k) ? " open" : ""}><summary>Plot</summary><p>${esc(f.syn)}</p></details>` : "";
    return `<article class="cn-film"><div class="cn-stub"><span>${esc(f.en ? "English" : f.lang && f.lang !== "Original language" ? f.lang : "VO")}</span></div><div class="cn-body">
      <div class="cn-top">${poster}<div class="cn-info">
        <h2 class="cn-ttl">${ttl}</h2>${it}<div class="cn-meta">${meta}</div>
        ${f.cast && f.cast.length ? `<div class="cn-cast">With ${hl(f.cast.join(", "), state.q)}</div>` : ""}
        ${extras(f)}${plot}
      </div></div>
      <div class="cn-venues">${venues}</div></div></article>`;
  }

  // keep opened plots open when the list redraws (every minute, and on new listings)
  const openPlots = new Set();
  document.getElementById("list").addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.matches || !d.matches("details.cn-plot")) return;
    if (d.open) openPlots.add(d.dataset.k); else openPlots.delete(d.dataset.k);
  }, true);

  // A film without a TMDB id in the listings yet: look it up on the Movies service when tapped,
  // so the link still opens the film's own page (falls back to a title search).
  document.getElementById("list").addEventListener("click", (e) => {
    const a = e.target.closest("a.cn-mv[data-t]");
    if (!a) return;
    e.preventDefault();
    const win = window.open("", "_blank");
    const go = (url) => { if (win) { win.opener = null; win.location.href = url; } else location.href = url; };
    const api = window.MOVIES_API || "https://movies-api.ranjeethkkb.workers.dev";
    fetch(`${api}/match?title=${encodeURIComponent(a.dataset.t)}&year=${encodeURIComponent(a.dataset.y)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => go(m && m.id ? `../movies.html#/m/${m.id}` : a.href))
      .catch(() => go(a.href));
  });

  /* ---------- controls ---------- */
  $("#days").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-day]");
    if (!b) return;
    state.day = b.dataset.day;
    render();
    $("#list").scrollIntoView({ block: "nearest" });
  });
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
