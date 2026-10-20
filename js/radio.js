(() => {
  const COLS = window.RADIO_COLLECTIONS;
  const GROUPS = ["English", "India & South Asia", "Africa", "Europe & Asia"];
  const REGIONS = new Set(["uk", "us", "canada", "anz", "world"]);   // shown via the station's country instead
  const byCol = Object.fromEntries(COLS.map((c) => [c.id, c]));

  const $ = (s) => document.querySelector(s);
  const grid = $("#grid"), chips = $("#chips"), q = $("#q"), audio = $("#audio");
  const player = $("#player"), playBtn = $("#playBtn"), npFav = $("#npFav");

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  // favourites are stored as "collection:station" so ids never clash between collections
  let favs = new Set(store.get("mr-favs2", (store.get("mr-favs", []) || []).map((id) => "malayalam:" + id)));
  let col = null;              // current collection object
  let S = [], byId = {};       // its stations
  let cat = "all";
  let show = "all";            // all | live | down — set by the dashboard tiles
  let current = null, currentCol = null, hls = null, tryIndex = 0, failTimer = null;

  const key = (s, c = col) => `${c.id}:${s.id}`;
  const isCur = (s) => current && currentCol === col.id && current.id === s.id;

  function initials(name) {
    const w = name.replace(/^(AIR|Radio|BBC)\s+/i, "").split(/[\s.\-–|:]+/).filter((x) => /[\p{L}\p{N}]/u.test(x));
    if (!w.length) return "♪";
    const a = [...w[0]], b = w[1] ? [...w[1]] : [];
    return (b.length ? a[0] + b[0] : a.slice(0, 2).join("")).toUpperCase();
  }

  // ---------------------------------------------------------- collection picker
  function renderPicker() {
    const nav = $("#collections");
    nav.innerHTML = "";
    for (const g of GROUPS) {
      const items = COLS.filter((c) => c.group === g);
      if (!items.length) continue;
      const row = document.createElement("div");
      row.className = "col-row";
      row.innerHTML = `<span class="col-group">${g}</span><span class="col-items"></span>`;
      const box = row.querySelector(".col-items");
      for (const c of items) {
        const b = document.createElement("button");
        b.textContent = c.name;
        if (c.native && c.native !== c.name) b.title = c.native;
        b.setAttribute("aria-pressed", col && col.id === c.id);
        b.onclick = () => openCollection(c.id, true);
        box.append(b);
      }
      nav.append(row);
    }
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const el = document.createElement("script");
      el.src = src; el.onload = res; el.onerror = rej;
      document.body.appendChild(el);
    });
  }

  async function openCollection(id, user) {
    const c = byCol[id] || byCol.malayalam;
    col = c; cat = "all"; show = "all";
    store.set("mr-col", c.id);
    const url = new URL(location.href);
    url.searchParams.set("c", c.id);
    history.replaceState(null, "", url);
    renderPicker();
    $("#colName").textContent = c.name;
    $("#colNative").textContent = c.native && c.native !== c.name ? c.native : "";
    $("#colIntro").textContent = c.intro;
    grid.innerHTML = ""; $("#count").textContent = "Loading…";
    // the station file changes after every check, so fetch a fresh copy each hour
    const stamp = new Date().toISOString().slice(0, 10) + "-" + Math.floor(Date.now() / 36e5);
    window.STATIONS = null; window.STATIONS_CHECKED = null;
    try { await loadScript(`js/stations/${c.id}.js?d=${stamp}`); } catch { /* shown as empty */ }
    if (col !== c) return;   // user switched again while loading
    S = window.STATIONS || [];
    byId = Object.fromEntries(S.map((s) => [s.id, s]));
    renderStats(); renderChips(); render();
    if (user) $("#colName").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---------------------------------------------------------- lists
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
  }

  function render() {
    const term = q.value.trim().toLowerCase();
    const list = S.filter((s) =>
      (cat === "all" || (cat === "fav" ? favs.has(key(s)) : s.category === cat)) &&
      (show === "all" || (show === "down") === !!s.offline) &&
      (!term || s.name.toLowerCase().includes(term))
    );
    // stations that failed the latest check go to the bottom (order otherwise kept)
    list.sort((a, b) => (a.offline ? 1 : 0) - (b.offline ? 1 : 0));
    grid.innerHTML = "";
    for (const s of list) {
      const li = document.createElement("li");
      li.className = "radio-card" + (isCur(s) ? " on" : "") + (s.offline ? " off" : "");
      li.dataset.id = s.id;
      const sub = s.offline ? "Not working today"
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
      li.querySelector(".hit").onclick = () => (isCur(s) ? toggle() : play(s));
      li.querySelector(".fav").onclick = (e) => { e.stopPropagation(); toggleFav(key(s)); };
      grid.append(li);
    }
    $("#count").textContent = `${list.length} station${list.length === 1 ? "" : "s"}` +
      (show === "live" ? " · live now" : show === "down" ? " · not working today" : "");
    $("#empty").hidden = list.length > 0;
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

  function toggleFav(k) {
    favs.has(k) ? favs.delete(k) : favs.add(k);
    store.set("mr-favs2", [...favs]);
    renderChips(); render(); syncPlayer();
  }

  // ---------------------------------------------------------- player
  function status(t) { $("#npStatus").textContent = t; }
  function setState(st) {
    player.classList.toggle("playing", st === "playing");
    player.classList.toggle("loading", st === "loading");
    playBtn.setAttribute("aria-label", st === "playing" ? "Pause" : "Play");
  }
  function syncPlayer() {
    if (!current) return;
    npFav.setAttribute("aria-pressed", favs.has(`${currentCol}:${current.id}`));
    document.querySelectorAll(".radio-card").forEach((c) =>
      c.classList.toggle("on", currentCol === col.id && c.dataset.id === current.id));
  }
  function showNowPlaying(s, cId) {
    player.hidden = false;
    $("#npName").textContent = s.name;
    $("#npTile").textContent = initials(s.name);
    $("#npCol").textContent = byCol[cId] ? byCol[cId].name : "";
  }

  function teardown() {
    clearTimeout(failTimer);
    if (hls) { hls.destroy(); hls = null; }
    audio.pause(); audio.removeAttribute("src"); audio.load();
  }

  function play(s) {
    current = s; currentCol = col.id; tryIndex = 0;
    store.set("mr-last2", { c: col.id, s });
    showNowPlaying(s, col.id);
    syncPlayer();
    document.title = `▶ ${s.name} — Radio`;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: s.name, artist: `${col.name} radio · ranjithkb.com` });
    }
    attempt();
  }

  function attempt() {
    teardown();
    const s = current, url = s.streams[tryIndex];
    if (!url) { setState("idle"); status("Offline — try another station"); markErr(s.id); return; }
    setState("loading");
    status(s.streams.length > 1 ? `Connecting · source ${tryIndex + 1}/${s.streams.length}` : "Connecting");
    failTimer = setTimeout(next, 12000);
    const isHls = /\.m3u8(\?|$)/i.test(url);
    // hls.js first: the browser's own HLS player can't read some playlists (e.g. Akashvani).
    // Native HLS is only used where hls.js can't run (iPhone Safari).
    if (isHls && window.Hls?.isSupported()) {
      hls = new Hls({ lowLatencyMode: false });
      hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) next(); });
      hls.loadSource(url); hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, () => audio.play().catch(next));
    } else {
      audio.src = url;
      audio.play().catch((e) => { if (e.name !== "AbortError") next(); });
    }
  }
  function next() { if (!current) return; tryIndex++; attempt(); }
  function markErr(id) { if (currentCol === col.id) document.querySelector(`.radio-card[data-id="${CSS.escape(id)}"]`)?.classList.add("err"); }

  function toggle() {
    if (!current) return;
    if (audio.paused) attempt(); else { teardown(); setState("idle"); status("Paused"); }
  }

  audio.addEventListener("playing", () => { clearTimeout(failTimer); setState("playing"); status("Live"); });
  audio.addEventListener("waiting", () => { if (!audio.paused) { setState("loading"); status("Buffering"); } });
  audio.addEventListener("error", () => { if (current && audio.getAttribute("src")) next(); });

  playBtn.onclick = toggle;
  npFav.onclick = () => current && toggleFav(`${currentCol}:${current.id}`);
  const vol = $("#vol");
  vol.value = store.get("mr-vol", 1); audio.volume = vol.value;
  vol.oninput = () => { audio.volume = vol.value; store.set("mr-vol", +vol.value); };
  q.oninput = render;
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target === document.body) { e.preventDefault(); toggle(); }
    if (e.key === "/" && e.target !== q) { e.preventDefault(); q.focus(); }
  });
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
  }

  // ---------------------------------------------------------- start
  const last = store.get("mr-last2", null);
  if (last && last.s && last.s.streams) {
    current = last.s; currentCol = last.c;
    showNowPlaying(current, currentCol);
    status("Tap play to resume");
  }
  const want = new URLSearchParams(location.search).get("c") || store.get("mr-col", "malayalam");
  openCollection(byCol[want] ? want : "malayalam", false);
})();
