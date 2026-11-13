(() => {
  const COLS = window.RADIO_COLLECTIONS;
  const GROUPS = ["English", "India & South Asia", "Africa", "Europe", "Middle East & Central Asia", "East & Southeast Asia", "Americas"];
  const REGIONS = new Set(["uk", "us", "canada", "anz", "world"]);   // shown via the station's country instead
  const byCol = Object.fromEntries(COLS.map((c) => [c.id, c]));

  const $ = (s) => document.querySelector(s);
  const grid = $("#grid"), chips = $("#chips"), q = $("#q"), audio = $("#audio");
  const player = $("#player"), playBtn = $("#playBtn"), npFav = $("#npFav");
  let lastSwitch = 0;   // when the station last changed (a cast speaker sometimes lets go then)

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  // favourites are stored as "collection:station" so ids never clash between collections
  let favs = new Set(store.get("mr-favs2", (store.get("mr-favs", []) || []).map((id) => "malayalam:" + id)));
  let col = null;              // current collection object
  let S = [], byId = {};       // its stations
  let cat = "all";
  let view = "col";            // col: one language's stations | favs: favourites from every language
  let show = "all";            // all | live | down — set by the dashboard tiles
  let current = null, currentCol = null, hls = null, tryIndex = 0, failTimer = null;

  // stations in Velvet Selection / Every station carry their own language in _c
  const key = (s, c = col) => `${s._c || c.id}:${s.id}`;
  const isCur = (s) => current && currentCol === (s._c || col.id) && current.id === s.id;
  // two lists that aren't one language: the developer's picks, and every station of every language
  const PSEUDO = {
    picks: { id: "picks", name: "Velvet Selection", native: "", cats: [], group: "",
      intro: "Hand-picked by the developer, from every language." },
    all: { id: "all", name: "Every station", native: "", cats: [], group: "",
      intro: "Every station in every language, in one list. Search to find one fast." }
  };
  const isPseudo = (id) => id === "picks" || id === "all";

  function initials(name) {
    const w = name.replace(/^(AIR|Radio|BBC)\s+/i, "").split(/[\s.\-–|:]+/).filter((x) => /[\p{L}\p{N}]/u.test(x));
    if (!w.length) return "♪";
    const a = [...w[0]], b = w[1] ? [...w[1]] : [];
    return (b.length ? a[0] + b[0] : a.slice(0, 2).join("")).toUpperCase();
  }

  // ---------------------------------------------------------- language bar
  // The page opens on your default language (Malayalam unless you change it);
  // the chips show your default plus the languages you used recently.
  const getDefault = () => (byCol[store.get("mr-default", "malayalam")] ? store.get("mr-default", "malayalam") : "malayalam");
  let recent = (store.get("mr-recent", []) || []).filter((id) => byCol[id]);

  // Quick buttons: ★ Velvet Selection, your pinned languages (your order, always shown), recent ones, 🎲 Spin.
  // Press and hold a language to pin, move or remove it.
  let pinned = store.get("mr-pinned", []).filter((id) => byCol[id]);
  function renderBar() {
    const def = getDefault();
    $("#langCur").textContent = col.name;
    $("#langNative").textContent = col.native && col.native !== col.name ? col.native : "";
    const quick = [...pinned, ...[def, ...recent].filter((id) => !pinned.includes(id) && byCol[id])];
    const box = $("#langQuick");
    box.innerHTML = "";
    renderTabs();
    const vs = document.createElement("button");
    vs.className = "lq lq-vs"; vs.setAttribute("aria-pressed", view === "col" && col.id === "picks");
    vs.innerHTML = '<span class="star" aria-hidden="true">★</span><span>Velvet Selection</span>';
    vs.onclick = () => openCollection("picks", true);
    box.append(vs);
    for (const id of [...new Set(quick)].slice(0, 9)) {
      const c = byCol[id];
      const b = document.createElement("button");
      b.className = "lq";
      b.setAttribute("aria-pressed", view === "col" && id === col.id);
      b.innerHTML = (pinned.includes(id) ? '<span class="pin" aria-label="Pinned">📌</span>' : id === def ? '<span class="star" aria-label="Default">★</span>' : "") + "<span></span>";
      b.lastChild.textContent = c.name;
      b.title = "Press and hold to pin, move or remove";
      let t = null, long = false;
      b.addEventListener("pointerdown", () => { long = false; t = setTimeout(() => { long = true; langMenu(id, b); }, 550); });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => clearTimeout(t)));
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); clearTimeout(t); long = true; langMenu(id, b); });
      b.onclick = () => { if (long) { long = false; return; } openCollection(id, true); };
      box.append(b);
    }
    const sp = document.createElement("button");
    sp.className = "lq lq-spin"; sp.innerHTML = '<span aria-hidden="true">🎲</span><span>Spin</span>';
    sp.title = "A random station from this list — press and hold for anywhere in the world";
    let st = null, slong = false;
    sp.addEventListener("pointerdown", () => { slong = false; st = setTimeout(() => { slong = true; spin(true); }, 550); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => sp.addEventListener(ev, () => clearTimeout(st)));
    sp.addEventListener("contextmenu", (e) => { e.preventDefault(); });
    sp.onclick = () => { if (slong) { slong = false; return; } spin(false); };
    box.append(sp);
    const isDef = col.id === def;
    $("#defBtn").hidden = isPseudo(col.id);
    const d = $("#defBtn");
    d.classList.toggle("is-default", isDef);
    d.textContent = isDef ? "★ Opens by default" : `☆ Make ${col.name} my default`;
    d.title = isDef ? "This page opens on this language" : "Open the Radio page on this language next time";
  }

  // All languages: Malayalam, the English lists, Every station, then the rest by region — each with its station count
  const counts = {};
  let countsLoading = false;
  async function loadCounts() {
    if (countsLoading) return; countsLoading = true;
    await Promise.all(COLS.map(async (c) => { const l = await stationsOf(c.id);
      if (Array.isArray(l)) counts[c.id] = l.filter((x) => !x.hidden).length; }));
    if (!$("#langPanel").hidden) renderLangList();
  }
  function renderLangList() {
    const term = $("#langQ").value.trim().toLowerCase();
    const list = $("#langList");
    list.innerHTML = "";
    let first = null;
    const match = (c) => !term || (c.name + " " + (c.native || "")).toLowerCase().includes(term);
    const btn = (c, row) => {
      const b = document.createElement("button");
      b.className = "li";
      b.setAttribute("aria-pressed", c.id === col.id);
      b.innerHTML = "<span></span><small></small>";
      b.firstChild.textContent = c.name;
      const n = c.id === "all" ? Object.values(counts).reduce((a, x) => a + x, 0) : counts[c.id];
      b.lastChild.textContent = [c.native && c.native !== c.name ? c.native : "", n ? n.toLocaleString() + " stations" : ""].filter(Boolean).join(" · ");
      b.onclick = () => { closePanel(); openCollection(c.id, true); };
      row.append(b);
      first = first || c;
    };
    const section = (title, items) => {
      if (!items.length) return;
      const h = document.createElement("div"); h.className = "lg"; h.textContent = title; list.append(h);
      const row = document.createElement("div"); row.className = "li-row"; list.append(row);
      items.forEach((c) => btn(c, row));
    };
    const top = [byCol.malayalam, ...COLS.filter((c) => c.group === "English")].filter(Boolean);
    section("Malayalam & English", top.filter(match));
    if (!term || "every station all".includes(term)) section("All languages together", [PSEUDO.all]);
    for (const g of GROUPS) section(g, COLS.filter((c) => c.group === g && !top.includes(c) && match(c)));
    if (!first) list.innerHTML = '<p class="li-none">No language matches.</p>';
    return first;
  }

  function openPanel() {
    $("#langPanel").hidden = false;
    $("#langBtn").setAttribute("aria-expanded", "true");
    $("#langQ").value = "";
    renderLangList();
    loadCounts();
    $("#langQ").focus();
  }
  function closePanel() {
    $("#langPanel").hidden = true;
    $("#langBtn").setAttribute("aria-expanded", "false");
  }
  $("#langBtn").onclick = () => ($("#langPanel").hidden ? openPanel() : closePanel());
  $("#langQ").oninput = renderLangList;
  $("#langQ").onkeydown = (e) => {
    if (e.key === "Enter") { const f = renderLangList(); if (f) { closePanel(); openCollection(f.id, true); } }
    if (e.key === "Escape") { closePanel(); $("#langBtn").focus(); }
  };
  document.addEventListener("click", (e) => {
    if (!$("#langPanel").hidden && !e.target.closest(".lang-pick")) closePanel();
  });
  $("#defBtn").onclick = () => {
    store.set("mr-default", col.id); renderBar();
    window.dispatchEvent(new CustomEvent("radio:local-change", { detail: { favs: [...favs], def: col.id } }));
  };

  function loadScript(src) {
    return new Promise((res, rej) => {
      const el = document.createElement("script");
      el.src = src; el.onload = res; el.onerror = rej;
      document.body.appendChild(el);
    });
  }

  async function openPseudo(id, user) {
    const c = PSEUDO[id];
    col = c; cat = "all"; show = "all";
    setView("col");
    const url = new URL(location.href);
    url.searchParams.set("c", c.id);
    history.replaceState(null, "", url);
    renderBar();
    $("#colName").textContent = c.name; $("#colNative").textContent = ""; $("#colIntro").textContent = c.intro;
    grid.innerHTML = ""; $("#count").textContent = "Loading…";
    let list = [];
    if (id === "picks") {
      let keys = [];
      try {
        const r = await fetch(`https://firestore.googleapis.com/v1/projects/ranjithkb-radio/databases/(default)/documents/picks/ranjith?key=${window.FIREBASE_CONFIG ? window.FIREBASE_CONFIG.apiKey : ""}`);
        const j = r.ok ? await r.json() : {};
        keys = ((((j.fields || {}).favs || {}).arrayValue || {}).values || []).map((v) => v.stringValue).filter((k) => k && k.includes(":"));
      } catch { /* shown as empty */ }
      const need = [...new Set(keys.map((k) => splitKey(k)[0]))].filter((x) => byCol[x]);
      await Promise.all(need.map((x) => stationsOf(x)));
      list = keys.map((k) => { const [cc, sid] = splitKey(k); const l = cache[cc];
        const st = Array.isArray(l) ? l.find((x) => x.id === sid) : null; return st ? { ...st, _c: cc } : null; }).filter(Boolean);
      c.intro = list.length ? PSEUDO.picks.intro : "The Velvet Selection is coming soon.";
      $("#colIntro").textContent = c.intro;
    } else {
      const ids = ["malayalam", ...COLS.map((x) => x.id).filter((x) => x !== "malayalam")];
      const lists = await Promise.all(ids.map((x) => stationsOf(x)));
      ids.forEach((x, i) => { if (Array.isArray(lists[i])) list.push(...lists[i].map((st) => ({ ...st, _c: x }))); });
    }
    if (col !== c) return;
    S = list.filter((st) => !st.hidden); byId = {};
    renderStats(); renderChips(); render();
    if (user) $(".radio-bar").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // the small menu on a held language button
  function langMenu(id, anchor) {
    document.querySelector(".lq-menu")?.remove();
    const m = document.createElement("div");
    m.className = "lq-menu"; m.setAttribute("role", "menu");
    const i = pinned.indexOf(id), isPin = i >= 0;
    const items = [[isPin ? "Unpin" : "📌 Pin — always keep it here", () => { pinned = isPin ? pinned.filter((x) => x !== id) : [...pinned, id]; }]];
    if (isPin && i > 0) items.push(["◀ Move left", () => { pinned.splice(i, 1); pinned.splice(i - 1, 0, id); }]);
    if (isPin && i < pinned.length - 1) items.push(["Move right ▶", () => { pinned.splice(i, 1); pinned.splice(i + 1, 0, id); }]);
    items.push(["✕ Remove from this row", () => { pinned = pinned.filter((x) => x !== id); recent = recent.filter((x) => x !== id); store.set("mr-recent", recent); }]);
    const h = document.createElement("b"); h.textContent = byCol[id].name; m.append(h);
    for (const [label, fn] of items) {
      const b = document.createElement("button"); b.setAttribute("role", "menuitem"); b.textContent = label;
      b.onclick = (e) => { e.stopPropagation(); fn(); store.set("mr-pinned", pinned); m.remove(); renderBar(); };
      m.append(b);
    }
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + "px";
    m.style.top = (r.bottom + scrollY + 6) + "px";
    setTimeout(() => document.addEventListener("click", () => m.remove(), { once: true }), 0);
  }
  // 🎲 a random working station from the list on screen, or (held) from anywhere in the world
  async function spin(world) {
    if (world) {
      const c = COLS[Math.floor(Math.random() * COLS.length)];
      const l = (await stationsOf(c.id) || []).filter((x) => !x.offline && !x.hidden && !x.geo);
      if (!l.length) return spin(true);
      const st = { ...l[Math.floor(Math.random() * l.length)], _c: c.id };
      notice(`Spinning the world: ${c.name}`, 4000);
      play(st, [st], c.id);
      return;
    }
    const pool = (view === "favs" ? favStations() : visibleList()).filter((x) => !x.offline && !x.gone && !x.loading && !x.geo);
    if (!pool.length) return;
    const st = pool[Math.floor(Math.random() * pool.length)];
    play(st, pool, st._c || col.id);
  }

  async function openCollection(id, user) {
    if (isPseudo(id)) return openPseudo(id, user);
    const c = byCol[id] || byCol.malayalam;
    col = c; cat = "all"; show = "all";
    setView("col");
    recent = [c.id, ...recent.filter((x) => x !== c.id)].slice(0, 8);
    store.set("mr-recent", recent);
    const url = new URL(location.href);
    url.searchParams.set("c", c.id);
    history.replaceState(null, "", url);
    renderBar();
    $("#colName").textContent = c.name;
    $("#colNative").textContent = c.native && c.native !== c.name ? c.native : "";
    $("#colIntro").textContent = c.intro;
    grid.innerHTML = ""; $("#count").textContent = "Loading…";
    // the station file changes after every check, so fetch a fresh copy each hour
    const stamp = new Date().toISOString().slice(0, 10) + "-" + Math.floor(Date.now() / 36e5);
    window.STATIONS = null; window.STATIONS_CHECKED = null;
    try { await loadScript(`js/stations/${c.id}.js?d=${stamp}`); } catch { /* shown as empty */ }
    if (col !== c) return;   // user switched again while loading
    // stations that failed 20 checks in a row are hidden; the check keeps testing them and un-hides any that come back
    S = (window.STATIONS || []).filter((s) => !s.hidden);
    byId = Object.fromEntries(S.map((s) => [s.id, s]));
    renderStats(); renderChips(); render();
    if (user) $(".radio-bar").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---------------------------------------------------------- lists
  // Stations that stream only inside one country (station "geo": country code)
  const GEO = { AE: "the UAE", QA: "Qatar", BH: "Bahrain", OM: "Oman", SA: "Saudi Arabia", KW: "Kuwait", IN: "India", US: "the USA", GB: "the UK" };
  function geoNote(c) { return "Only plays in " + (GEO[c] || c); }
  function catLabel(k) { return (col.cats.find((x) => x[0] === k) || [k, k])[1]; }

  function renderChips() {
    chips.innerHTML = "";
    const myFavs = S.filter((s) => favs.has(key(s))).length;
    const list = [["all", "All", S.length], ["fav", "Favourites", myFavs],
      ...col.cats.map(([k, l]) => [k, l, S.filter((s) => s.category === k).length])];
    for (const [k, l, n] of list) {
      if (k !== "all" && !n && cat !== k) continue;
      if (list.filter((x) => x[0] !== "all" && x[0] !== "fav" && x[2]).length < 2 && k !== "all" && k !== "fav") continue;
      const b = document.createElement("button");
      b.setAttribute("aria-pressed", cat === k);
      b.innerHTML = `${l}<span class="n">${n}</span>`;
      b.onclick = () => { cat = k; renderChips(); render(); };
      chips.append(b);
    }
    // A–Z: alphabetical order in every list except the Velvet Selection (hand-picked order); remembered
    if (col.id !== "picks") {
      const az = document.createElement("button");
      az.className = "az"; az.setAttribute("aria-pressed", sortAZ);
      az.setAttribute("aria-label", sortAZ ? "Show in the usual order" : "Sort A to Z");
      az.textContent = (sortAZ ? "✓ " : "") + "A–Z";
      az.onclick = () => { sortAZ = !sortAZ; try { localStorage.setItem("mr-az", sortAZ ? "1" : "0"); } catch { /* fine */ } renderChips(); render(); };
      chips.append(az);
    }
  }
  let sortAZ = (() => { try { return localStorage.getItem("mr-az") !== "0"; } catch { return true; } })();
  const byName = (a, b) => a.name.replace(/^[("' ]+/, "").localeCompare(b.name.replace(/^[("' ]+/, ""), undefined, { sensitivity: "base" });

  function visibleList() {
    const term = q.value.trim().toLowerCase();
    const list = S.filter((s) =>
      (cat === "all" || (cat === "fav" ? favs.has(key(s)) : s.category === cat)) &&
      (show === "all" || (show === "down") === !!s.offline) &&
      (!term || s.name.toLowerCase().includes(term))
    );
    if (sortAZ && col.id !== "picks") list.sort(byName);
    // stations that failed the latest check go to the bottom (order otherwise kept)
    list.sort((a, b) => (a.offline ? 1 : 0) - (b.offline ? 1 : 0));
    return list;
  }

  function render() {
    if (view === "favs") { renderFavs(); return; }
    const list = visibleList();
    grid.innerHTML = "";
    for (const s of list) grid.append(card(s, list));
    $("#count").textContent = `${list.length} station${list.length === 1 ? "" : "s"}` +
      (show === "live" ? " · live now" : show === "down" ? " · not working today" : "");
    $("#empty").hidden = list.length > 0;
    otherLanguages(list.length);
  }

  // Search looks in every language, like the app: matches from the other languages follow this list's own
  let everyLoaded = null;
  async function otherLanguages(here) {
    const term = q.value.trim().toLowerCase();
    if (term.length < 2 || col.id === "all" || view === "favs") return;
    if (!everyLoaded) {
      everyLoaded = Promise.all(COLS.map((c) => stationsOf(c.id)));
      await everyLoaded;
      if (q.value.trim().toLowerCase() === term) render();
      return;
    }
    const lists = await everyLoaded;
    const more = [];
    COLS.forEach((c, i) => {
      if (c.id === col.id || !Array.isArray(lists[i])) return;
      for (const st of lists[i]) if (!st.hidden && st.name.toLowerCase().includes(term)) more.push({ ...st, _c: c.id });
    });
    more.sort((a, b) => (a.offline ? 1 : 0) - (b.offline ? 1 : 0) || (b.name.toLowerCase().startsWith(term) ? 1 : 0) - (a.name.toLowerCase().startsWith(term) ? 1 : 0) || byName(a, b));
    const shown = more.slice(0, 80);
    if (!shown.length || q.value.trim().toLowerCase() !== term) return;
    const h = document.createElement("li");
    h.className = "radio-more";
    h.textContent = here ? "In other languages" : "Found in other languages";
    grid.append(h);
    for (const s of shown) grid.append(card(s, shown));
    $("#empty").hidden = true;
    $("#count").textContent = `${here} here · ${more.length} in other languages`;
  }

  function card(s, list) {
      const li = document.createElement("li");
      li.className = "radio-card" + (isCur(s) ? " on" : "") + (s.offline ? " off" : "");
      li.dataset.id = s.id;
      if (s._c) li.dataset.c = s._c;
      const isNew = s.added && (Date.now() - Date.parse(s.added)) < 21 * 864e5;
      const sub = s.offline ? "Not working today"
        : s._c ? [byCol[s._c] ? byCol[s._c].name : "", s.geo ? geoNote(s.geo) : ""].filter(Boolean).join(" · ")
        : s.geo ? [catLabel(s.category), geoNote(s.geo)].join(" · ")
        : [REGIONS.has(s.category) ? "" : catLabel(s.category),
           s.freq || s.where || (s.streams.length > 1 ? s.streams.length + " sources" : "Live")].filter(Boolean).join(" · ");
      li.innerHTML = `
        <button class="hit" aria-label="Play ${s.name}">
          <span class="tile">${initials(s.name)}<span class="pl"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg></span></span>
          <span class="txt"><div class="nm"></div><div class="sub"></div></span>
        </button>
        <button class="fav" aria-label="Favourite" aria-pressed="${favs.has(key(s))}"><svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"/></svg></button>`;
      li.querySelector(".nm").textContent = s.name;      // names come from a public directory: never as HTML
      li.querySelector(".sub").textContent = sub;
      if (isNew && !s.offline) li.querySelector(".nm").insertAdjacentHTML("beforeend", ' <span class="new-tag">New</span>');
      li.querySelector(".hit").onclick = () => (isCur(s) ? toggle() : play(s, list));
      li.querySelector(".fav").onclick = (e) => { e.stopPropagation(); toggleFav(key(s), s); };
      return li;
  }

  function renderStats() {
    const down = S.filter((s) => s.offline).length;
    $("#stTotal").textContent = S.length;
    $("#stLive").textContent = S.length - down;
    $("#stDown").textContent = down;
    const c = window.STATIONS_CHECKED;
    $("#stWhen").textContent = c
      ? new Date(c).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : "–";
    $("#stWhen").title = "Every station is tested twice a day, at 6:15 am and 7:05 pm India time";
    document.querySelectorAll(".radio-stats .stat[data-status]").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.status === show);
      b.onclick = () => { show = b.dataset.status === show ? "all" : b.dataset.status; renderStats(); render(); };
    });
  }

  function toggleFav(k, s) {
    if (favs.has(k)) favs.delete(k);
    else { favs.add(k); if (s) remember(k, s); }   // new favourites go to the end of your order
    store.set("mr-favs2", [...favs]);
    renderBar(); renderChips(); render(); syncPlayer();
    // js/radio-sync.js saves this to the visitor's account when they are signed in
    window.dispatchEvent(new CustomEvent("radio:local-change", { detail: { favs: [...favs], def: getDefault() } }));
  }

  // favourites / default coming back from the visitor's account (js/radio-sync.js)
  window.addEventListener("radio:remote-change", (e) => {
    const { favs: f, def } = e.detail || {};
    if (Array.isArray(f)) { favs = new Set(f); store.set("mr-favs2", f); }
    if (def && byCol[def]) store.set("mr-default", def);
    if (col) { renderBar(); renderChips(); render(); syncPlayer(); }
  });
  window.RadioApp = { getFavs: () => [...favs], getDefault: () => getDefault() };

  // ---------------------------------------------------------- favourites, every language
  // The Favourites chip opens one list of every favourite station, in your own order (the
  // order of mr-favs2, which is also what's saved to your account). "Reorder" lets you drag
  // or move stations up and down and remove them. Station details come from each language's
  // station file; a small copy kept with each favourite shows the list straight away.
  let favInfo = store.get("mr-favinfo", {});
  let favEdit = false, favUndo = null, favUndoTimer = null, favLoaded = false;
  const cache = {};          // collection id -> its stations (loaded on demand)
  function remember(k, s) {
    favInfo[k] = { id: s.id, name: s.name, streams: s.streams, category: s.category };
    store.set("mr-favinfo", favInfo);
  }
  async function stationsOf(cId) {
    if (col && col.id === cId && S.length) return S;
    if (cache[cId]) return cache[cId];
    const stamp = new Date().toISOString().slice(0, 10) + "-" + Math.floor(Date.now() / 36e5);
    cache[cId] = fetch(`js/stations/${cId}.js?d=${stamp}`).then((r) => (r.ok ? r.text() : ""))
      .then((t) => { const m = t.match(/window\.STATIONS\s*=\s*(\[[\s\S]*?\]);\s*window\.STATIONS_CHECKED/); return m ? JSON.parse(m[1]) : []; })
      // keep the finished list (not the download) so the Velvet Selection and Favourites can look stations up
      .then((list) => { cache[cId] = list; return list; })
      .catch(() => { delete cache[cId]; return null; });
    return cache[cId];
  }
  const splitKey = (k) => { const i = k.indexOf(":"); return [k.slice(0, i), k.slice(i + 1)]; };
  // your favourites as stations, in your order; _c is the station's language
  function favStations() {
    return [...favs].map((k) => {
      const [c, id] = splitKey(k);
      const s = (cache[c] && Array.isArray(cache[c]) && cache[c].find((x) => x.id === id)) ||
                (col && col.id === c && byId[id]) || favInfo[k];
      if (!byCol[c]) return null;
      if (s) return { ...s, _c: c, _k: k };
      return favLoaded ? { id, name: id, streams: [], _c: c, _k: k, gone: true }
                       : { id, name: id, streams: [], _c: c, _k: k, loading: true };
    }).filter(Boolean);
  }
  async function loadFavDetails() {
    const need = [...new Set([...favs].map((k) => splitKey(k)[0]).filter((c) => byCol[c]))];
    const lists = await Promise.all(need.map(async (c) => [c, await stationsOf(c)]));
    let changed = false;
    for (const [c, list] of lists) {
      if (!Array.isArray(list)) continue;
      cache[c] = list;
      for (const k of favs) {
        const [fc, id] = splitKey(k);
        if (fc !== c) continue;
        const s = list.find((x) => x.id === id);
        if (s) { favInfo[k] = { id: s.id, name: s.name, streams: s.streams, category: s.category }; changed = true; }
      }
    }
    if (changed) store.set("mr-favinfo", favInfo);
    favLoaded = lists.every(([, l]) => Array.isArray(l));   // a failed load isn't "no longer listed"
  }
  // Stations | Favourites tabs at the top of the page. In Favourites the language picker,
  // recently played, status tiles and filters are hidden (see body.fav-view in radio.css).
  function setView(v) {
    view = v;
    $("#favTools").hidden = v !== "favs";
    document.body.classList.toggle("fav-view", v === "favs");
    document.body.classList.toggle("info-view", v === "info");
    $("#infoView").hidden = v !== "info";
    if (v !== "favs") document.body.classList.remove("fav-editing");
    renderTabs();
  }
  function renderTabs() {
    const a = $("#tabStations"), f = $("#tabFavs");
    if (!a || !f) return;
    a.setAttribute("aria-selected", view === "col");
    f.setAttribute("aria-selected", view === "favs");
    $("#tabInfo").setAttribute("aria-selected", view === "info");
    $("#favN").textContent = favs.size;
    a.querySelector(".lang").textContent = col ? col.name : "";
  }
  async function openFavs(user) {
    setView("favs");
    favEdit = false;
    const url = new URL(location.href);
    url.searchParams.set("c", "favs");
    history.replaceState(null, "", url);
    renderBar();
    $("#colName").textContent = "Favourites";
    $("#colNative").textContent = "";
    $("#colIntro").textContent = "Your favourite stations from every language, in your own order. Tap Edit to change the order or remove stations.";
    renderFavs();
    if (user) $("#radioTabs").scrollIntoView({ behavior: "smooth", block: "start" });
    await loadFavDetails();
    if (view === "favs") renderFavs();
  }
  function saveOrder(keys) {
    favs = new Set(keys);
    store.set("mr-favs2", keys);
    renderBar();
    window.dispatchEvent(new CustomEvent("radio:local-change", { detail: { favs: keys, def: getDefault() } }));
  }
  function moveFav(k, to) {
    const keys = [...favs].filter((x) => x !== k);
    keys.splice(Math.max(0, Math.min(to, keys.length)), 0, k);
    saveOrder(keys);
    renderFavs();
    const row = grid.querySelector(`[data-k="${CSS.escape(k)}"]`);
    if (row) {
      row.classList.add("moved"); setTimeout(() => row.classList.remove("moved"), 900);
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
  function removeFav(k) {
    const keys = [...favs];
    const at = keys.indexOf(k);
    if (at < 0) return;
    const name = (favStations().find((x) => x._k === k) || {}).name || "Station";
    saveOrder(keys.filter((x) => x !== k));
    favUndo = { k, at, name };
    clearTimeout(favUndoTimer);
    favUndoTimer = setTimeout(() => { favUndo = null; if (view === "favs") renderFavs(); }, 8000);
    renderFavs(); syncPlayer();
  }
  function undoRemove() {
    if (!favUndo) return;
    const keys = [...favs].filter((x) => x !== favUndo.k);
    keys.splice(favUndo.at, 0, favUndo.k);
    favUndo = null; clearTimeout(favUndoTimer);
    saveOrder(keys); renderFavs(); syncPlayer();
  }

  function renderFavs() {
    const term = q.value.trim().toLowerCase();
    const all = favStations();
    const list = all.filter((s) => !term || s.name.toLowerCase().includes(term));
    grid.innerHTML = "";
    grid.classList.toggle("fav-edit", favEdit);
    document.body.classList.toggle("fav-editing", favEdit && view === "favs");
    $("#favEdit").textContent = favEdit ? "Done" : "Edit order / remove";
    $("#favHelp").hidden = !favEdit;
    $("#favEdit").setAttribute("aria-pressed", favEdit);
    $("#favEdit").hidden = all.length < 1;
    list.forEach((s, i) => {
      const li = document.createElement("li");
      const cur = current && currentCol === s._c && current.id === s.id;
      li.className = "radio-card fav-card" + (cur ? " on" : "") + (s.offline || s.gone || s.hidden ? " off" : "");
      li.dataset.id = s.id; li.dataset.c = s._c; li.dataset.k = s._k;
      const sub = [byCol[s._c].name, s.loading ? "Loading…" : s.gone ? "No longer listed" : s.offline || s.hidden ? "Not working today" : ""].filter(Boolean).join(" · ");
      if (favEdit) {
        const pos = all.indexOf(s);
        li.innerHTML = `
          <div class="er-top">
            <button class="handle" title="Drag to move"><svg viewBox="0 0 24 24"><path d="M9 5h2v2H9zm4 0h2v2h-2zM9 11h2v2H9zm4 0h2v2h-2zM9 17h2v2H9zm4 0h2v2h-2z"/></svg></button>
            <span class="pos-no"></span>
            <span class="txt"><div class="nm"></div><div class="sub"></div></span>
          </div>
          <div class="er-btns">
            <button class="up">↑ Up</button>
            <button class="down">↓ Down</button>
            <label class="pos"><span class="vh">Position</span><select></select></label>
            <button class="rm">Remove</button>
          </div>`;
        li.querySelector(".nm").textContent = s.name;
        li.querySelector(".sub").textContent = sub;
        li.querySelector(".pos-no").textContent = pos + 1;
        const up = li.querySelector(".up"), down = li.querySelector(".down"), sel = li.querySelector("select");
        up.disabled = pos === 0 || !!term; down.disabled = pos === all.length - 1 || !!term;
        up.setAttribute("aria-label", `Move ${s.name} up`); down.setAttribute("aria-label", `Move ${s.name} down`);
        sel.setAttribute("aria-label", `Position of ${s.name}`);
        sel.disabled = !!term || all.length < 2;
        for (let n = 1; n <= all.length; n++) {
          const o = document.createElement("option");
          o.value = n - 1; o.textContent = `No. ${n}`;
          if (n - 1 === pos) o.selected = true;
          sel.append(o);
        }
        up.onclick = () => moveFav(s._k, pos - 1);
        down.onclick = () => moveFav(s._k, pos + 1);
        sel.onchange = () => moveFav(s._k, +sel.value);
        li.querySelector(".rm").setAttribute("aria-label", `Remove ${s.name} from favourites`);
        li.querySelector(".rm").onclick = () => removeFav(s._k);
        li.querySelector(".handle").setAttribute("aria-label", `Move ${s.name}: drag, or use arrow keys`);
        li.querySelector(".handle").onkeydown = (e) => {
          if (e.key === "ArrowUp" && pos > 0) { e.preventDefault(); moveFav(s._k, pos - 1); }
          if (e.key === "ArrowDown" && pos < all.length - 1) { e.preventDefault(); moveFav(s._k, pos + 1); }
        };
        if (!term) dragSort(li.querySelector(".handle"), li);
      } else {
        li.innerHTML = `
          <button class="hit">
            <span class="tile">${initials(s.name)}<span class="pl"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg></span></span>
            <span class="txt"><div class="nm"></div><div class="sub"></div></span>
          </button>
          <button class="fav" aria-label="Remove from favourites" aria-pressed="true"><svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"/></svg></button>`;
        li.querySelector(".hit").setAttribute("aria-label", `Play ${s.name} (${byCol[s._c].name})`);
        li.querySelector(".nm").textContent = s.name;
        li.querySelector(".sub").textContent = sub;
        li.querySelector(".hit").onclick = () => {
          if (cur) { toggle(); return; }
          if (s.loading) return;
          if (s.gone || !s.streams || !s.streams.length) { notice("That station isn't listed any more", 5000); return; }
          play(s, list.filter((x) => !x.gone && !x.loading), s._c);
        };
        li.querySelector(".fav").onclick = (e) => { e.stopPropagation(); removeFav(s._k); };
      }
      grid.append(li);
    });
    const c = $("#count");
    c.textContent = all.length
      ? `${all.length} favourite${all.length === 1 ? "" : "s"} in ${new Set(all.map((x) => x._c)).size} language${new Set(all.map((x) => x._c)).size === 1 ? "" : "s"}` + (term ? ` · ${list.length} match` : "")
      : "";
    if (favUndo) {
      const u = document.createElement("span");
      u.className = "fav-undo";
      u.append(document.createTextNode(` · Removed ${favUndo.name} `));
      const b = document.createElement("button"); b.textContent = "Undo"; b.onclick = undoRemove;
      u.append(b);
      c.append(u);
    }
    const empty = $("#empty");
    empty.textContent = all.length ? "No favourites match." : "No favourites yet. Tap the ♥ on any station, in any language, to add it here.";
    empty.hidden = list.length > 0;
  }

  // drag a favourite by its handle (mouse, touch or pen); the order is saved on release
  function dragSort(handle, li) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      li.classList.add("dragging");
      // follow the pointer on the whole page: moving the card in the list would drop a capture
      const move = (ev) => {
        ev.preventDefault();
        const others = [...grid.children].filter((x) => x !== li);
        const after = others.find((x) => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
        if (after) { if (li.nextSibling !== after) grid.insertBefore(li, after); } else if (grid.lastChild !== li) grid.append(li);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        li.classList.remove("dragging");
        const keys = [...grid.children].map((x) => x.dataset.k).filter(Boolean);
        if (keys.join("|") !== [...favs].join("|")) saveOrder(keys);
        renderFavs();
      };
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    });
  }
  $("#favEdit").onclick = () => { favEdit = !favEdit; renderFavs(); };
  $("#tabStations").onclick = () => { if (view !== "col") openCollection(col ? col.id : getDefault(), false); };
  $("#tabFavs").onclick = () => { if (view !== "favs") openFavs(true); };
  // Info: your listening time, your account, the Android app and a few notes
  $("#tabInfo").onclick = () => {
    if (view === "info") return;
    setView("info");
    const url = new URL(location.href); url.searchParams.set("c", "info"); history.replaceState(null, "", url);
    if (window.RadioListen) window.RadioListen.paint();
    $("#infoView").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // on phones the tab bar is fixed at the bottom: keep the player bar exactly on top of it
  { const tabs = $("#radioTabs"); const fit = () => { const fixed = getComputedStyle(tabs).position === "fixed";
      document.body.style.setProperty("--tabs-h", fixed ? tabs.offsetHeight + "px" : "0px"); };
    new ResizeObserver(fit).observe(tabs); addEventListener("resize", fit); fit(); }
  // the account box, the app card and the sign-in note live in Info
  { const iv = $("#infoView"), acct = $("#acct"), app = $("#radioApp"), note = $("#acctNote");
    if (acct) $("#ivAcct").append(acct);
    if (app) { const sec = document.createElement("div"); sec.className = "iv-sec"; sec.innerHTML = '<h2 class="iv-h">The Android app</h2>'; sec.append(app); iv.append(sec); }
    if (note) $("#ivAcct").append(note); }

  // ---------------------------------------------------------- sharing
  const shareUrl = (cId, s) => `${location.origin}/radio.html?c=${cId}&s=${encodeURIComponent(s.id)}`;
  async function shareStation(s, cId) {
    const url = shareUrl(cId, s);
    if (navigator.share) {
      try { await navigator.share({ title: s.name, text: `${s.name} on ranjithkb.com radio`, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; /* otherwise fall back to copying */ }
    }
    try { await navigator.clipboard.writeText(url); notice("Link copied", 4000); }
    catch { notice(`Copy this link: ${url}`, 10000); }
  }
  // a message in the player bar when it is showing, otherwise in a note above the station list
  function notice(t, hold) {
    if (!player.hidden) { status(t, hold); return; }
    let n = $("#radioNote");
    if (!n) {
      n = document.createElement("p");
      n.id = "radioNote"; n.className = "radio-msg"; n.setAttribute("role", "status");
      grid.before(n);
    }
    n.textContent = t; n.hidden = false;
    clearTimeout(notice.t);
    notice.t = setTimeout(() => { n.hidden = true; }, hold || 5000);
  }

  // ---------------------------------------------------------- station panel: rate, comment, share
  // Tapping the station in the player bar opens it. Ratings come from js/radio-ratings.js
  // (window.RadioRatings); if that can't load, the panel says so and sharing still works.
  const SP = $("#stPanel"), SB = $("#stBack"), stars = [...document.querySelectorAll("#stStars [data-v]")];
  let RR = window.RadioRatings || null, rrFailed = false, pTok = 0, pKey = "", pStars = null, pLast = null, pBusy = false;
  window.addEventListener("radio:ratings-ready", () => { RR = window.RadioRatings; if (panelOpen()) loadPanel(); });
  window.addEventListener("radio:ratings-failed", () => { rrFailed = true; if (panelOpen()) loadPanel(); });
  window.addEventListener("radio:ratings-account", () => { if (panelOpen()) loadPanel(); });
  const panelOpen = () => SP && !SP.hidden;
  const LABEL = { waiting: "Waiting for approval", approved: "Published", rejected: "Not published" };

  function avgText({ count, avg }) {
    if (!count) return "Not rated yet";
    if (avg == null || count < 3) return `${count} rating${count > 1 ? "s" : ""} so far`;
    return `★ ${avg.toFixed(1)} · ${count} ratings`;
  }
  function setStars(v) {
    pStars = v;
    stars.forEach((b) => {
      const n = +b.dataset.v;
      b.setAttribute("aria-checked", String(n === v));
      b.classList.toggle("lit", v != null && n <= v);
      b.tabIndex = n === (v || 1) ? 0 : -1;
    });
  }
  function usable(on) {
    stars.forEach((b) => { b.disabled = !on; });
    $("#stText").disabled = !on; $("#stSend").disabled = !on;
  }
  const tsMs = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : typeof t === "number" ? t : Date.parse(t) || 0);
  function addComments(list) {
    const ul = $("#stList");
    for (const c of list) {
      const li = document.createElement("li");
      const meta = document.createElement("span");
      meta.className = "st-meta";
      const st = document.createElement("span");
      st.className = "st-mini"; st.textContent = "★".repeat(c.stars) + "☆".repeat(5 - c.stars);
      st.setAttribute("aria-label", `${c.stars} of 5 stars`);
      const d = document.createElement("span");
      d.textContent = new Date(tsMs(c.ts)).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      meta.append(st, d);
      const t = document.createElement("p");
      t.textContent = c.text;
      li.append(meta, t);
      ul.append(li);
    }
    if (list.length) pLast = list[list.length - 1].ts;
  }

  function openStationPanel() {
    if (!current || !SP) return;
    $("#stName").textContent = current.name;
    SP.hidden = false; SB.hidden = false;
    placePanel();
    loadPanel();
    $("#stClose").focus({ preventScroll: true });
  }
  function closeStationPanel() {
    if (!panelOpen()) return;
    SP.hidden = true; SB.hidden = true; pTok++;
    $("#npName").focus({ preventScroll: true });
  }
  // on wider screens the card sits just above the player bar
  function placePanel() { if (panelOpen()) SP.style.setProperty("--bar", `${player.offsetHeight}px`); }

  async function loadPanel() {
    if (!current) return;
    const tok = ++pTok;
    pKey = `${currentCol}~${current.id}`;
    $("#stName").textContent = current.name;
    $("#stSaved").textContent = ""; $("#stNote").textContent = ""; $("#stState").textContent = "";
    $("#stText").value = ""; $("#stCount").textContent = "0/300";
    $("#stList").innerHTML = ""; $("#stMore").hidden = true; pLast = null;
    setStars(null);
    if (!RR) {
      usable(false);
      $("#stAvg").textContent = rrFailed ? "Ratings unavailable right now" : "Loading ratings…";
      return;
    }
    usable(true);
    $("#stAvg").textContent = "Loading ratings…";
    try {
      // reading needs no account; one is made only when the visitor rates or comments
      const [sum, mine, list] = await Promise.all([RR.summary(pKey), RR.mine(pKey), RR.approved(pKey, { limit: 5 })]);
      if (tok !== pTok) return;
      $("#stAvg").textContent = avgText(sum);
      setStars(mine.stars);
      if (mine.comment) {
        $("#stText").value = mine.comment.text;
        $("#stCount").textContent = `${mine.comment.text.length}/300`;
        $("#stState").textContent = LABEL[mine.comment.status] || "";
      }
      addComments(list);
      $("#stMore").hidden = list.length < 5;
      $(".st-say").classList.toggle("empty", !list.length);
    } catch (e) {
      if (tok !== pTok) return;
      console.warn("Ratings unavailable:", e);
      $("#stAvg").textContent = "Ratings unavailable right now";
      usable(false);
    }
  }

  async function saveStars(v) {
    if (!RR || pBusy) return;
    const before = pStars, tok = pTok;
    pBusy = true; setStars(v); $("#stSaved").textContent = "Saving…";
    try {
      await RR.rate(pKey, v);
      if (tok === pTok) $("#stSaved").textContent = "Saved ✓";
    } catch (e) {
      if (tok !== pTok) return;
      setStars(before);
      $("#stSaved").textContent = e && e.code === "too-fast" ? "Slow down a little — try again in a few seconds."
        : e && e.code === "unavailable" ? "Ratings unavailable right now" : "Couldn't save — try again.";
    } finally { pBusy = false; }
  }

  if (SP) {
    stars.forEach((b, i) => {
      b.onclick = () => saveStars(+b.dataset.v);
      b.onkeydown = (e) => {
        const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = stars[(i + d + stars.length) % stars.length];
        stars.forEach((x) => { x.tabIndex = x === n ? 0 : -1; });
        n.focus();
      };
    });
    $("#stText").oninput = () => { $("#stCount").textContent = `${$("#stText").value.length}/300`; };
    $("#stSend").onclick = async () => {
      const text = $("#stText").value.trim();
      if (!text || !RR) return;
      if (pStars == null) { $("#stNote").textContent = "Choose a star rating first."; return; }
      const tok = pTok;
      $("#stSend").disabled = true;
      try {
        await RR.comment(pKey, pStars, text);
        if (tok !== pTok) return;
        $("#stNote").textContent = "Thanks — your comment will appear once it's approved.";
        $("#stState").textContent = LABEL.waiting;
      } catch (e) {
        if (tok !== pTok) return;
        $("#stNote").textContent = e && e.code === "too-fast" ? "Slow down a little — try again in a few seconds."
          : e && e.code === "unavailable" ? "Ratings unavailable right now" : "Couldn't send — try again.";
      }
      finally { $("#stSend").disabled = false; }
    };
    $("#stMore").onclick = async () => {
      if (!RR) return;
      const tok = pTok;
      try {
        const more = await RR.approved(pKey, { after: pLast, limit: 10 });
        if (tok !== pTok) return;
        addComments(more);
        $("#stMore").hidden = more.length < 10;
      } catch { $("#stMore").hidden = true; }
    };
    $("#stShare").onclick = () => current && shareStation(current, currentCol);
    $("#stPlay").onclick = () => playBtn.click();
    $("#stClose").onclick = closeStationPanel;
    SB.onclick = closeStationPanel;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen()) closeStationPanel(); });
    window.addEventListener("resize", placePanel);
    for (const el of [$("#npTile"), $("#npName")]) {
      el.setAttribute("role", "button"); el.tabIndex = 0;
      el.title = "Rate, comment or share this station";
      el.onclick = openStationPanel;
      el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStationPanel(); } };
    }
  }

  // open a shared station: its language, shown in the player bar ready to play, panel open
  async function openStation(cId, sid) {
    if (!col || col.id !== cId || !S.length) await openCollection(cId, false);
    if (col.id !== cId) return;   // the visitor picked another language meanwhile
    const s = byId[sid];
    if (!s) { notice("That station isn't available any more", 6000); return; }
    teardown(); setState("idle");
    current = s; currentCol = cId; queue = visibleList();
    store.set("mr-last2", { c: cId, s }); store.set("mr-closed", false);
    showNowPlaying(s, cId);
    syncPlayer();
    status("Tap play to start");
    openStationPanel();
  }
  window.RadioApp.share = () => current && shareStation(current, currentCol);
  window.RadioApp.now = () => current && { key: `${currentCol}:${current.id}`, name: current.name };
  { const strip = $("#raStrip"); if (strip) strip.onclick = (e) => { e.preventDefault(); $("#tabInfo").click(); }; }
  window.RadioApp.openStation = openStation;

  // ---------------------------------------------------------- player
  // a held message (e.g. about casting) is not overwritten by connection updates for a few seconds
  let holdUntil = 0;
  function status(t, hold) {
    if (!hold && Date.now() < holdUntil) return;
    holdUntil = hold ? Date.now() + hold : 0;
    $("#npStatus").textContent = t;
  }
  function setState(st) {
    player.classList.toggle("playing", st === "playing");
    player.classList.toggle("loading", st === "loading");
    playBtn.setAttribute("aria-label", st === "playing" ? "Pause" : "Play");
    const sp = document.getElementById("stPlay"); if (sp) sp.setAttribute("aria-label", st === "playing" ? "Pause" : "Play");
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = st === "idle" ? "paused" : "playing";
  }
  function syncPlayer() {
    if (!current) return;
    npFav.setAttribute("aria-pressed", favs.has(`${currentCol}:${current.id}`));
    document.querySelectorAll(".rp").forEach((b, i) => { const x = store.get("mr-played", [])[i]; b.classList.toggle("on", !!x && x.c === currentCol && x.s.id === current.id); });
    document.querySelectorAll(".radio-card").forEach((c) =>
      c.classList.toggle("on", (c.dataset.c || col.id) === currentCol && c.dataset.id === current.id));
  }
  function showNowPlaying(s, cId) {
    player.hidden = false;
    $("#npName").textContent = s.name;
    $("#npTile").textContent = initials(s.name);
    $("#npCol").textContent = byCol[cId] ? byCol[cId].name : "";
    if (panelOpen() && pKey !== `${cId}~${s.id}`) loadPanel();
  }

  let ownPauseAt = 0, interruptTimer = null;  // see the "pause" listener further down
  let interruptedAt = 0;                      // set while held paused: only play restarts it
  let callHeldAt = 0;                         // set while paused by a call: comes back when it ends
  function teardown() {
    clearTimeout(failTimer); clearTimeout(stallTimer); clearTimeout(retryTimer);
    if (hls) { hls.destroy(); hls = null; }
    ownPauseAt = Date.now();          // pauses right after this are ours, not a phone call
    audio.pause(); audio.removeAttribute("src"); audio.load();
  }

  // Next / previous: steps through the list on screen when the station was picked
  // (same collection, filter and search), skipping stations marked not working.
  let queue = [];
  // Hands-free: from a favourite, Next / Previous stay among this language's favourites;
  // a change made with car / headphone / lock-screen buttons is spoken.
  let sayNames = store.get("mr-say", true);
  function speak(t) {
    if (!sayNames || !("speechSynthesis" in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.rate = 1.05; speechSynthesis.speak(u); } catch { /* no voice */ }
  }
  function skip(dir, spoken) {
    if (!current) return;
    let list = queue.length ? queue : (currentCol === col.id && view === "col" ? visibleList() : []);
    const cOf = (x) => x._c || currentCol;
    const isNow = (x) => x.id === current.id && cOf(x) === currentCol;
    const mixed = list.some((x) => x._c && x._c !== currentCol);   // the all-languages favourites list
    if (!mixed) {
      const pool = currentCol === col.id ? S : list;
      const favList = pool.filter((x) => favs.has(`${currentCol}:${x.id}`));
      if (favs.has(`${currentCol}:${current.id}`) && favList.length >= 2) list = favList;
    }
    const live = list.filter((x) => !x.offline || isNow(x));
    if (live.length < 2) { status("No other station in this list"); return; }
    let i = live.findIndex(isNow);
    if (i < 0) i = dir > 0 ? -1 : 0;
    const s = live[(i + dir + live.length) % live.length];
    play(s, list, cOf(s), dir);
    if (spoken) speak(s.name);
  }

  // square artwork for car screens and lock screens: the station's initials on the accent colour
  function artwork(s) {
    try {
      const c = document.createElement("canvas"); c.width = c.height = 512;
      const g = c.getContext("2d");
      g.fillStyle = getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#2F6B4F";
      g.fillRect(0, 0, 512, 512);
      g.fillStyle = "#F0EDE6"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = "600 190px 'Space Grotesk', sans-serif";
      g.fillText(initials(s.name), 256, 270);
      return [{ src: c.toDataURL("image/png"), sizes: "512x512", type: "image/png" }];
    } catch { return []; }
  }

  // ---- staying on air: reconnect after drop-outs (tunnels, patchy signal), and when a station
  // reached with Next/Previous is dead, carry on to the following one
  const vol = $("#vol");
  let wants = false, everPlayed = false, retries = 0, stallTimer = null, retryTimer = null, skipDir = 0, autoSkips = 0;

  function play(s, list, cId = s._c || col.id, dir = 0) {
    queue = list || (cId === (col && col.id) ? visibleList() : [s]);
    current = s; currentCol = cId; tryIndex = 0; lastSwitch = Date.now();
    everPlayed = false; retries = 0; skipDir = dir;
    if (!dir) autoSkips = 0;
    store.set("mr-last2", { c: cId, s }); store.set("mr-closed", false);
    showNowPlaying(s, cId);
    syncPlayer();
    document.title = `▶ ${s.name} — Radio`;
    if ("mediaSession" in navigator) {
      const cn = byCol[cId] ? byCol[cId].name : "";
      navigator.mediaSession.metadata = new MediaMetadata({ title: s.name, artist: `${cn} radio`, album: "ranjithkb.com", artwork: artwork(s) });
    }
    attempt();
  }

  function reconnect(why) {
    if (!wants || !current) return;
    clearTimeout(stallTimer); clearTimeout(retryTimer);
    if (!navigator.onLine) { setState("loading"); status("No signal — will reconnect"); return; }
    if (retries >= 4) { retries = 0; nextSource(); return; }
    const wait = [1500, 3000, 6000, 12000][retries++];
    setState("loading"); status(why || "Reconnecting");
    retryTimer = setTimeout(attempt, wait);
  }
  window.addEventListener("online", () => { if (wants && current && audio.paused) { retries = 0; attempt(); } });
  window.addEventListener("offline", () => { if (wants) { setState("loading"); status("No signal — will reconnect"); } });

  function attempt() {
    teardown();
    wants = true;
    interruptedAt = 0; callHeldAt = 0;
    const s = current, url = s.streams[tryIndex];
    if (!url) {
      if (everPlayed) { tryIndex = 0; everPlayed = false; reconnect("Reconnecting"); return; }  // was on air: start over
      setState("idle"); status(s.geo ? geoNote(s.geo) + " — it won't play from here" : "Offline — try another station"); markErr(s.id);
      if (skipDir && autoSkips < 6) { autoSkips++; status("Offline — trying the next one"); setTimeout(() => skip(skipDir), 700); }
      else wants = false;
      return;
    }
    setState("loading");
    status(s.streams.length > 1 ? `Connecting · source ${tryIndex + 1}/${s.streams.length}` : "Connecting");
    failTimer = setTimeout(nextSource, 12000);
    const isHls = /\.m3u8(\?|$)/i.test(url);
    // hls.js first: the browser's own HLS player can't read some playlists (e.g. Akashvani).
    // Native HLS is only used where hls.js can't run (iPhone Safari).
    if (isHls && window.Hls?.isSupported()) {
      hls = new Hls({ lowLatencyMode: false });
      hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) nextSource(); });
      hls.loadSource(url); hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, () => audio.play().catch(nextSource));
    } else {
      audio.src = url;
      audio.play().catch((e) => { if (e.name !== "AbortError") nextSource(); });
    }
  }
  function nextSource() { if (!current) return; tryIndex++; retries = 0; attempt(); }
  function markErr(id) { if (currentCol === col.id) document.querySelector(`.radio-card[data-id="${CSS.escape(id)}"]`)?.classList.add("err"); }

  function toggle() {
    if (!current) return;
    interruptedAt = 0; callHeldAt = 0;
    if (audio.paused) { retries = 0; attempt(); } else { wants = false; teardown(); setState("idle"); status("Paused"); }
  }

  audio.addEventListener("playing", () => {
    if (holdPaused()) return;
    clearTimeout(failTimer); clearTimeout(stallTimer); clearTimeout(interruptTimer);
    if (!everPlayed) rememberStation(currentCol, current);
    everPlayed = true; retries = 0; autoSkips = 0; skipDir = 0;
    setState("playing"); status(sleepAt ? sleepLabel() : "Live");
  });
  const stalled = () => {
    if (audio.paused || !wants) return;
    setState("loading"); status("Buffering");
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => reconnect("Signal lost — reconnecting"), 10000);
  };
  // Paused by something other than this page: a phone or WhatsApp call, Siri, an alarm,
  // headphones pulled out, another app taking the audio. From then on only the listener
  // (play on the page or the lock screen) starts it again, so it never plays over a call.
  // A real drop-out reports an error or the stream ending and is still a reconnect.
  audio.addEventListener("pause", () => {
    if (Date.now() - ownPauseAt < 1000) return;
    if (!wants || !current) return;
    clearTimeout(interruptTimer);
    interruptTimer = setTimeout(() => {
      if (!audio.paused || audio.error || audio.ended || !wants) return;
      wants = false;
      interruptedAt = Date.now();
      clearTimeout(failTimer); clearTimeout(stallTimer); clearTimeout(retryTimer);
      setState("idle"); status("Paused");
    }, 400);
  });
  // The iPhone app (Capacitor) passes on iOS's call messages, which browsers never get:
  // "radio:interruption-began" when a call takes the audio, "radio:interruption-ended" when
  // iOS says the app may resume. In Brave/Safari these events simply never arrive.
  window.addEventListener("radio:interruption-began", () => {
    if (!wants || !current) return;
    wants = false; interruptedAt = callHeldAt = Date.now();
    clearTimeout(interruptTimer); clearTimeout(failTimer); clearTimeout(stallTimer); clearTimeout(retryTimer);
    ownPauseAt = Date.now(); audio.pause();
    setState("idle"); status("Paused for a call");
  });
  window.addEventListener("radio:interruption-ended", () => resumeAfterCall());
  // After a call: come back on air (a fresh connection, so it plays live) when iOS sends
  // "play", restarts the audio itself, or when the listener returns to the page.
  const CALL_WINDOW = 60 * 60 * 1000;
  function resumeAfterCall() {
    if (!callHeldAt || !current) return;
    const fresh = Date.now() - callHeldAt < CALL_WINDOW;
    callHeldAt = 0; interruptedAt = 0;
    if (!fresh) { ownPauseAt = Date.now(); audio.pause(); setState("idle"); status("Paused"); return; }
    retries = 0; tryIndex = 0; attempt();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && callHeldAt) setTimeout(() => {
      if (document.visibilityState === "visible") resumeAfterCall();
    }, 800);
  });
  // Something other than this page started the audio while it was held: pause it again.
  const holdPaused = () => {
    if (wants || !interruptedAt) return false;
    if (callHeldAt) { resumeAfterCall(); return true; }
    ownPauseAt = Date.now(); audio.pause();
    setState("idle"); status("Paused");
    return true;
  };
  audio.addEventListener("play", holdPaused);
  audio.addEventListener("waiting", stalled);
  audio.addEventListener("stalled", stalled);
  audio.addEventListener("ended", () => { if (wants) reconnect(); });   // a live stream should never end
  audio.addEventListener("error", () => {
    if (!current || !audio.getAttribute("src")) return;
    if (everPlayed) reconnect(); else nextSource();
  });

  // ---- sleep timer: tap the Sleep button, pick how long; the radio fades out over the last
  // 20 seconds and stops. The button shows the time left (e.g. "28 min").
  let sleepAt = 0, sleepTick = null, sleepPick = 0;
  // ---- play on a speaker or TV: Remote Playback (Chrome → Chromecast / Nest) or AirPlay (Safari)
  const castBtn = $("#castBtn"), castLab = $("#castLab");
  let casting = false;
  function castState(on, label) {
    casting = on;
    castBtn.classList.toggle("on", on);
    castBtn.setAttribute("aria-pressed", on);
    castLab.textContent = label || "";      // icon only; a word only while connecting
    castLab.hidden = !label;
    castBtn.setAttribute("aria-label", on ? "Casting to a speaker or TV. Tap to change or stop." : "Play on a speaker or TV");
    castBtn.title = on ? "Playing on a speaker or TV. Tap to change or stop." : "Play on a speaker or TV";
  }
  // The button is always offered, so the feature can be found; what it does depends on the browser.
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const safari = /^((?!CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Android).)*Safari/i.test(navigator.userAgent);
  castBtn.hidden = false;
  if (audio.remote && audio.remote.prompt && !iOS) {
    const r = audio.remote;
    r.addEventListener("connecting", () => castState(false, "Connecting…"));
    r.addEventListener("connect", () => castState(true));
    r.addEventListener("disconnect", () => {
      const was = casting;
      castState(false);
      if (was && Date.now() - lastSwitch < 8000) status("The speaker let go when the station changed. Tap cast again.", 6000);
    });
    castBtn.onclick = () => r.prompt().catch((e) => {
      if (e.name === "NotSupportedError") status("This station can't be cast. Try another, or a Bluetooth speaker.", 6000);
      else if (e.name === "NotFoundError") status("No speaker or TV found on this Wi-Fi.", 6000);
    });
  } else if (audio.webkitShowPlaybackTargetPicker && (safari || !iOS)) {
    audio.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", () => castState(!!audio.webkitCurrentPlaybackTargetIsWireless));
    castBtn.onclick = () => audio.webkitShowPlaybackTargetPicker();
  } else if (iOS) {
    // other iPhone browsers: the picker may or may not respond, so try it and explain the sure way
    castBtn.onclick = () => { if (audio.webkitShowPlaybackTargetPicker) { try { audio.webkitShowPlaybackTargetPicker(); } catch (e) { /* not offered here */ } } status("On iPhone: open Control Center, tap the AirPlay icon on the music card and pick your speaker or TV.", 9000); };
  } else {
    castBtn.onclick = () => status("This browser can't cast. Use its own menu (Chrome: ⋮ → Cast), or pair a Bluetooth speaker.", 9000);
  }

  const sleepBtn = $("#sleepBtn"), sleepMenu = $("#sleepMenu"), sleepLab = $("#sleepLab");
  const minsLeft = () => Math.max(1, Math.ceil((sleepAt - Date.now()) / 60000));
  const nice = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? " " + (m % 60) + " min" : ""}` : `${m} min`);
  function sleepLabel() { return `Live · stops in ${nice(minsLeft())}`; }
  const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  function paintSleep() {
    const on = !!sleepAt, m = on ? minsLeft() : 0;
    sleepBtn.classList.toggle("on", on);
    sleepLab.textContent = on ? (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}` : `${m} min`) : "Sleep";   // short on the button; full in aria-label
    sleepBtn.setAttribute("aria-label", on ? `Sleep timer on: radio stops in ${nice(m)}, at ${clock(sleepAt)}. Tap to change.` : "Sleep timer: off. Choose when the radio stops.");
    sleepBtn.title = on ? `Radio stops at ${clock(sleepAt)}` : "Sleep timer: stop the radio after a set time";
    $("#sleepNow").textContent = on ? `On — the radio fades out and stops at ${clock(sleepAt)} (${nice(m)} from now).` : "Off. The radio keeps playing until you stop it.";
    $("#sleepOff").hidden = !on;
    sleepMenu.querySelectorAll("[data-min]").forEach((b) => b.setAttribute("aria-pressed", on && +b.dataset.min === sleepPick));
  }
  function setSleep(mins) {
    clearInterval(sleepTick);
    sleepAt = mins ? Date.now() + mins * 60000 : 0; sleepPick = mins;
    audio.volume = vol.value;
    paintSleep();
    if (!mins) { if (!audio.paused) status("Live"); return; }
    if (!audio.paused) status(sleepLabel());
    let lastMin = minsLeft();
    sleepTick = setInterval(() => {
      const left = sleepAt - Date.now();
      if (left <= 0) {
        clearInterval(sleepTick); sleepAt = 0; sleepPick = 0;
        if (!audio.paused) toggle();
        audio.volume = vol.value; status("Stopped by sleep timer");
        paintSleep();
        return;
      }
      if (left < 20000) audio.volume = vol.value * (left / 20000);
      if (minsLeft() !== lastMin) { lastMin = minsLeft(); paintSleep(); if (!audio.paused) status(sleepLabel()); }
    }, 1000);
  }
  function openSleep(open) {
    sleepMenu.hidden = !open; sleepBtn.setAttribute("aria-expanded", open);
    if (open) { paintSleep(); (sleepMenu.querySelector('[aria-pressed="true"]') || sleepMenu.querySelector("[data-min]")).focus(); }
  }
  sleepBtn.onclick = (e) => { e.stopPropagation(); openSleep(sleepMenu.hidden); };
  sleepMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    const b = e.target.closest("[data-min]");
    if (b) { setSleep(+b.dataset.min); openSleep(false); sleepBtn.focus(); }
    if (e.target.id === "sleepOff") { setSleep(0); openSleep(false); sleepBtn.focus(); }
  });
  document.addEventListener("click", () => { if (!sleepMenu.hidden) openSleep(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sleepMenu.hidden) { openSleep(false); sleepBtn.focus(); } });
  paintSleep();
  // custom sleep length (5 minutes to 4 hours)
  const sc = document.getElementById("sleepCustom"), scLab = document.getElementById("sleepCustomLab");
  if (sc) {
    const show = () => { scLab.textContent = nice(+sc.value); };
    sc.oninput = show; show();
    sc.onclick = (e) => e.stopPropagation();
    document.getElementById("sleepCustomGo").onclick = (e) => { e.stopPropagation(); setSleep(+sc.value); openSleep(false); sleepBtn.focus(); };
  }
  // ⌄ fold the player to one slim row (keeps playing); ⌃ brings the buttons back
  const smallBtn = document.getElementById("smallBtn");
  const setSmall = (v) => { player.classList.toggle("small", v); smallBtn.setAttribute("aria-pressed", v);
    smallBtn.setAttribute("aria-label", v ? "Show all player buttons" : "Make the player smaller"); store.set("mr-small", v); placePanel(); };
  setSmall(store.get("mr-small", false));
  smallBtn.onclick = () => setSmall(!player.classList.contains("small"));
  document.getElementById("npShare").onclick = () => { if (current) shareStation(current, currentCol); };

  // close: stop the stream, cancel any sleep timer, hide the bar (and don't bring it back on the next visit)
  const pageTitle = document.title.replace(/^▶ .*? — /, "");
  function closePlayer() {
    wants = false; interruptedAt = 0; callHeldAt = 0; teardown(); if (sleepAt) setSleep(0); setState("idle");
    openSleep(false); closeStationPanel();
    current = null; currentCol = null;
    document.querySelectorAll(".radio-card.on, .rp.on").forEach((el) => el.classList.remove("on"));
    player.hidden = true;
    document.title = pageTitle;
    if ("mediaSession" in navigator) { navigator.mediaSession.metadata = null; try { navigator.mediaSession.playbackState = "none"; } catch { /* older browsers */ } }
    store.set("mr-closed", true);
  }
  $("#closeBtn").onclick = closePlayer;

  playBtn.onclick = toggle;
  $("#prevBtn").onclick = () => skip(-1);
  $("#nextBtn").onclick = () => skip(1);
  npFav.onclick = () => current && toggleFav(`${currentCol}:${current.id}`, current);
  vol.value = store.get("mr-vol", 1); audio.volume = vol.value;
  vol.oninput = () => { audio.volume = vol.value; store.set("mr-vol", +vol.value); };
  q.oninput = render;
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target === document.body) { e.preventDefault(); toggle(); }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.target === document.body && current) { e.preventDefault(); skip(e.key === "ArrowRight" ? 1 : -1); }
    if (e.key === "/" && e.target !== q) { e.preventDefault(); q.focus(); }
  });
  if ("mediaSession" in navigator) {
    // Never a toggle: when a call starts, iOS has already silenced the audio and then sends
    // "pause" — a toggle saw "paused" and started the station again over the call.
    const sysPause = () => {
      // iOS silences the audio *before* sending "pause" for a call; the listener's own pause
      // (lock screen, headphones button) arrives while it is still playing.
      const byCall = wants && audio.paused;
      if (!current) return;
      if (!wants && callHeldAt) return;              // already held for a call (iPhone app told us first)
      wants = false; interruptedAt = Date.now();     // held: nothing but play restarts it
      callHeldAt = byCall ? Date.now() : 0;
      teardown(); setState("idle"); status(byCall ? "Paused for a call" : "Paused");
    };
    navigator.mediaSession.setActionHandler("play", () => {
      if (!current || (!audio.paused && wants)) return;
      interruptedAt = 0; retries = 0; attempt();
    });
    navigator.mediaSession.setActionHandler("pause", sysPause);
    // steering-wheel / Bluetooth / lock-screen buttons
    for (const [a, d] of [["nexttrack", 1], ["previoustrack", -1]]) {
      try { navigator.mediaSession.setActionHandler(a, () => skip(d, true)); } catch { /* not supported */ }
    }
    // some cars only send seek buttons, and iPhones show "10 s" arrows on the lock screen for
    // web radio whatever the page asks for: either way they change station.
    for (const [a, d] of [["seekforward", 1], ["seekbackward", -1]]) {
      try { navigator.mediaSession.setActionHandler(a, () => skip(d, true)); } catch { /* not supported */ }
    }
    try { navigator.mediaSession.setActionHandler("stop", sysPause); } catch { /* not supported */ }
  }

  // ---- recently played, across languages
  function rememberStation(cId, s) {
    const list = store.get("mr-played", []).filter((x) => !(x.c === cId && x.s.id === s.id));
    list.unshift({ c: cId, s: { id: s.id, name: s.name, streams: s.streams, category: s.category } });
    store.set("mr-played", list.slice(0, 10));
    renderRecent();
  }
  function renderRecent() {
    const box = $("#recentRow");
    if (!box) return;
    const list = store.get("mr-played", []).filter((x) => byCol[x.c] && x.s && x.s.streams);
    box.hidden = !list.length;
    const row = box.querySelector(".rp-list");
    row.innerHTML = "";
    for (const { c, s } of list.slice(0, 8)) {
      const b = document.createElement("button");
      b.className = "rp" + (current && currentCol === c && current.id === s.id ? " on" : "");
      b.innerHTML = '<span class="t"></span><span class="x"><span class="n"></span><span class="l"></span></span>';
      b.querySelector(".t").textContent = initials(s.name);
      b.querySelector(".n").textContent = s.name;
      b.querySelector(".l").textContent = byCol[c].name;
      b.onclick = () => {
        if (current && currentCol === c && current.id === s.id) { toggle(); return; }
        const fresh = c === col.id && byId[s.id] ? byId[s.id] : s;   // latest streams when that list is open
        play(fresh, c === col.id ? null : [fresh], c);
      };
      row.append(b);
    }
  }

  const sayBox = $("#sayNames");
  if (sayBox) {
    sayBox.checked = sayNames;
    sayBox.onchange = () => { sayNames = sayBox.checked; store.set("mr-say", sayNames); if (!sayNames && "speechSynthesis" in window) speechSynthesis.cancel(); };
  }

  // ---------------------------------------------------------- start
  const last = store.get("mr-last2", null);
  if (last && last.s && last.s.streams && !store.get("mr-closed", false)) {
    current = last.s; currentCol = last.c;
    showNowPlaying(current, currentCol);
    status("Tap play to resume");
  }
  renderRecent();
  // a shared link (?c=hindi) wins; otherwise open on the default language
  // a station link (?c=hindi&s=<id>) also shows that station ready to play
  const params = new URLSearchParams(location.search);
  const want = params.get("c") || getDefault(), sid = params.get("s");
  const startCol = (byCol[want] || (isPseudo(want) && !sid)) ? want : byCol[getDefault()] ? getDefault() : "malayalam";
  const opening = openCollection(startCol, false);
  if (want === "favs" && !sid) opening.then(() => openFavs(false));
  if (want === "info" && !sid) opening.then(() => $("#tabInfo").click());
  if (sid) {
    opening.then(() => openStation(startCol, sid)).finally(() => {
      const url = new URL(location.href); url.searchParams.delete("s"); history.replaceState(null, "", url);
    });
  }
})();
