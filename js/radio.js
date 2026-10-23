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

  // ---------------------------------------------------------- language bar
  // The page opens on your default language (Malayalam unless you change it);
  // the chips show your default plus the languages you used recently.
  const getDefault = () => (byCol[store.get("mr-default", "malayalam")] ? store.get("mr-default", "malayalam") : "malayalam");
  let recent = (store.get("mr-recent", []) || []).filter((id) => byCol[id]);

  function renderBar() {
    const def = getDefault();
    $("#langCur").textContent = col.name;
    $("#langNative").textContent = col.native && col.native !== col.name ? col.native : "";
    // quick chips: default first, then recent ones
    const quick = [def, ...recent.filter((id) => id !== def)].slice(0, 7);
    const box = $("#langQuick");
    box.innerHTML = "";
    for (const id of quick) {
      const c = byCol[id];
      const b = document.createElement("button");
      b.className = "lq";
      b.setAttribute("aria-pressed", id === col.id);
      b.innerHTML = (id === def ? '<span class="star" aria-label="Default">★</span>' : "") + "<span></span>";
      b.lastChild.textContent = c.name;
      b.onclick = () => openCollection(id, true);
      box.append(b);
    }
    const isDef = col.id === def;
    const d = $("#defBtn");
    d.classList.toggle("is-default", isDef);
    d.textContent = isDef ? "★ Opens by default" : `☆ Make ${col.name} my default`;
    d.title = isDef ? "This page opens on this language" : "Open the Radio page on this language next time";
  }

  function renderLangList() {
    const term = $("#langQ").value.trim().toLowerCase();
    const list = $("#langList");
    list.innerHTML = "";
    let first = null;
    for (const g of GROUPS) {
      const items = COLS.filter((c) => c.group === g &&
        (!term || (c.name + " " + (c.native || "")).toLowerCase().includes(term)));
      if (!items.length) continue;
      const h = document.createElement("div");
      h.className = "lg"; h.textContent = g;
      list.append(h);
      const row = document.createElement("div");
      row.className = "li-row";
      for (const c of items) {
        const b = document.createElement("button");
        b.className = "li";
        b.setAttribute("aria-pressed", c.id === col.id);
        b.innerHTML = "<span></span><small></small>";
        b.firstChild.textContent = c.name;
        b.lastChild.textContent = c.native && c.native !== c.name ? c.native : "";
        b.onclick = () => { closePanel(); openCollection(c.id, true); };
        row.append(b);
        first = first || c;
      }
      list.append(row);
    }
    if (!first) list.innerHTML = '<p class="li-none">No language matches.</p>';
    return first;
  }

  function openPanel() {
    $("#langPanel").hidden = false;
    $("#langBtn").setAttribute("aria-expanded", "true");
    $("#langQ").value = "";
    renderLangList();
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

  async function openCollection(id, user) {
    const c = byCol[id] || byCol.malayalam;
    col = c; cat = "all"; show = "all";
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

  function visibleList() {
    const term = q.value.trim().toLowerCase();
    const list = S.filter((s) =>
      (cat === "all" || (cat === "fav" ? favs.has(key(s)) : s.category === cat)) &&
      (show === "all" || (show === "down") === !!s.offline) &&
      (!term || s.name.toLowerCase().includes(term))
    );
    // stations that failed the latest check go to the bottom (order otherwise kept)
    list.sort((a, b) => (a.offline ? 1 : 0) - (b.offline ? 1 : 0));
    return list;
  }

  function render() {
    const list = visibleList();
    grid.innerHTML = "";
    for (const s of list) {
      const li = document.createElement("li");
      li.className = "radio-card" + (isCur(s) ? " on" : "") + (s.offline ? " off" : "");
      li.dataset.id = s.id;
      const isNew = s.added && (Date.now() - Date.parse(s.added)) < 21 * 864e5;
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
      if (isNew && !s.offline) li.querySelector(".nm").insertAdjacentHTML("beforeend", ' <span class="new-tag">New</span>');
      li.querySelector(".hit").onclick = () => (isCur(s) ? toggle() : play(s, list));
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
      n.id = "radioNote"; n.className = "radio-note"; n.setAttribute("role", "status");
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
      c.classList.toggle("on", currentCol === col.id && c.dataset.id === current.id));
  }
  function showNowPlaying(s, cId) {
    player.hidden = false;
    $("#npName").textContent = s.name;
    $("#npTile").textContent = initials(s.name);
    $("#npCol").textContent = byCol[cId] ? byCol[cId].name : "";
    if (panelOpen() && pKey !== `${cId}~${s.id}`) loadPanel();
  }

  function teardown() {
    clearTimeout(failTimer); clearTimeout(stallTimer); clearTimeout(retryTimer);
    if (hls) { hls.destroy(); hls = null; }
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
    let list = queue.length ? queue : (currentCol === col.id ? visibleList() : []);
    const pool = currentCol === col.id ? S : list;
    const favList = pool.filter((x) => favs.has(`${currentCol}:${x.id}`));
    if (favs.has(`${currentCol}:${current.id}`) && favList.length >= 2) list = favList;
    const live = list.filter((x) => !x.offline || x.id === current.id);
    if (live.length < 2) { status("No other station in this list"); return; }
    let i = live.findIndex((x) => x.id === current.id);
    if (i < 0) i = dir > 0 ? -1 : 0;
    const s = live[(i + dir + live.length) % live.length];
    play(s, list, currentCol, dir);
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

  function play(s, list, cId = col.id, dir = 0) {
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
    const s = current, url = s.streams[tryIndex];
    if (!url) {
      if (everPlayed) { tryIndex = 0; everPlayed = false; reconnect("Reconnecting"); return; }  // was on air: start over
      setState("idle"); status("Offline — try another station"); markErr(s.id);
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
    if (audio.paused) { retries = 0; attempt(); } else { wants = false; teardown(); setState("idle"); status("Paused"); }
  }

  audio.addEventListener("playing", () => {
    clearTimeout(failTimer); clearTimeout(stallTimer);
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

  // close: stop the stream, cancel any sleep timer, hide the bar (and don't bring it back on the next visit)
  const pageTitle = document.title.replace(/^▶ .*? — /, "");
  function closePlayer() {
    wants = false; teardown(); if (sleepAt) setSleep(0); setState("idle");
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
  npFav.onclick = () => current && toggleFav(`${currentCol}:${current.id}`);
  vol.value = store.get("mr-vol", 1); audio.volume = vol.value;
  vol.oninput = () => { audio.volume = vol.value; store.set("mr-vol", +vol.value); };
  q.oninput = render;
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target === document.body) { e.preventDefault(); toggle(); }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.target === document.body && current) { e.preventDefault(); skip(e.key === "ArrowRight" ? 1 : -1); }
    if (e.key === "/" && e.target !== q) { e.preventDefault(); q.focus(); }
  });
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    // steering-wheel / Bluetooth / lock-screen buttons
    for (const [a, d] of [["nexttrack", 1], ["previoustrack", -1]]) {
      try { navigator.mediaSession.setActionHandler(a, () => skip(d, true)); } catch { /* not supported */ }
    }
    // some cars only send seek buttons: treat them as next / previous too
    for (const [a, d] of [["seekforward", 1], ["seekbackward", -1]]) {
      try { navigator.mediaSession.setActionHandler(a, () => skip(d, true)); } catch { /* not supported */ }
    }
    try { navigator.mediaSession.setActionHandler("stop", () => { if (current && !audio.paused) toggle(); }); } catch { /* not supported */ }
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
  const startCol = byCol[want] ? want : "malayalam";
  const opening = openCollection(startCol, false);
  if (sid) {
    opening.then(() => openStation(startCol, sid)).finally(() => {
      const url = new URL(location.href); url.searchParams.delete("s"); history.replaceState(null, "", url);
    });
  }
})();
