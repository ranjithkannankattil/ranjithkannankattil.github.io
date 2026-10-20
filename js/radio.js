(() => {
  const CATS = [
    ["all", "All"], ["fav", "Favourites"], ["air", "Akashvani"], ["fm", "FM"],
    ["online", "Online"], ["artist", "Artists"], ["devotional", "Devotional"]
  ];
  const LABEL = { air: "Akashvani", fm: "FM", online: "Online", artist: "Artist", devotional: "Devotional" };
  
  const $ = (s) => document.querySelector(s);
  const grid = $("#grid"), chips = $("#chips"), q = $("#q"), audio = $("#audio");
  const player = $("#player"), playBtn = $("#playBtn"), npFav = $("#npFav");

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  let favs = new Set(store.get("mr-favs", []));
  let cat = store.get("mr-cat", "all");
  let current = null, hls = null, tryIndex = 0, failTimer = null;

  const S = window.STATIONS;
  const byId = Object.fromEntries(S.map((s) => [s.id, s]));

  function initials(name) {
    const w = name.replace(/^(AIR|Radio)\s+/i, "").split(/[\s.]+/).filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
  }

  function renderChips() {
    chips.innerHTML = "";
    for (const [k, l] of CATS) {
      const n = k === "all" ? S.length : k === "fav" ? favs.size : S.filter((s) => s.category === k).length;
      if (k === "fav" && !n && cat !== "fav") continue;
      const b = document.createElement("button");
      b.setAttribute("aria-pressed", cat === k);
      b.innerHTML = `${l}<span class="n">${n}</span>`;
      b.onclick = () => { cat = k; store.set("mr-cat", k); renderChips(); render(); };
      chips.append(b);
    }
  }

  function render() {
    const term = q.value.trim().toLowerCase();
    const list = S.filter((s) =>
      (cat === "all" || (cat === "fav" ? favs.has(s.id) : s.category === cat)) &&
      (!term || s.name.toLowerCase().includes(term))
    );
    // stations that failed today's check go to the bottom (order otherwise kept)
    list.sort((a, b) => (a.offline ? 1 : 0) - (b.offline ? 1 : 0));
    grid.innerHTML = "";
    for (const s of list) {
      const li = document.createElement("li");
      li.className = "radio-card" + (current?.id === s.id ? " on" : "") + (s.offline ? " off" : "");
      li.dataset.id = s.id;
      li.innerHTML = `
        <button class="hit" aria-label="Play ${s.name}">
          <span class="tile">${initials(s.name)}<span class="pl"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg></span></span>
          <span class="txt"><div class="nm">${s.name}</div><div class="sub">${LABEL[s.category]} · ${s.offline ? "Not working today" : s.freq || (s.streams.length > 1 ? s.streams.length + " sources" : "Live")}</div></span>
        </button>
        <button class="fav" aria-label="Favourite" aria-pressed="${favs.has(s.id)}"><svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"/></svg></button>`;
      li.querySelector(".hit").onclick = () => (current?.id === s.id ? toggle() : play(s));
      li.querySelector(".fav").onclick = (e) => { e.stopPropagation(); toggleFav(s.id); };
      grid.append(li);
    }
    $("#count").textContent = `${list.length} station${list.length === 1 ? "" : "s"}`;
    $("#empty").hidden = list.length > 0;
  }

  function toggleFav(id) {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set("mr-favs", [...favs]);
    renderChips(); render(); syncPlayer();
  }

  function status(t) { $("#npStatus").textContent = t; }
  function setState(st) {
    player.classList.toggle("playing", st === "playing");
    player.classList.toggle("loading", st === "loading");
    playBtn.setAttribute("aria-label", st === "playing" ? "Pause" : "Play");
  }
  function syncPlayer() {
    if (!current) return;
    npFav.setAttribute("aria-pressed", favs.has(current.id));
    document.querySelectorAll(".radio-card").forEach((c) => c.classList.toggle("on", c.dataset.id === current.id));
  }

  function teardown() {
    clearTimeout(failTimer);
    if (hls) { hls.destroy(); hls = null; }
    audio.pause(); audio.removeAttribute("src"); audio.load();
  }

  function play(s) {
    current = s; tryIndex = 0;
    store.set("mr-last", s.id);
    player.hidden = false;
    $("#npName").textContent = s.name;
    const t = $("#npTile"); t.textContent = initials(s.name);
    syncPlayer();
    document.title = `▶ ${s.name} — Radio`;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: s.name, artist: "ranjithkb.com · Radio" });
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
    // hls.js first: the browser's own HLS player can't read some Akashvani playlists.
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
  function markErr(id) { document.querySelector(`.radio-card[data-id="${id}"]`)?.classList.add("err"); }

  function toggle() {
    if (!current) return;
    if (audio.paused) attempt(); else { teardown(); setState("idle"); status("Paused"); }
  }

  audio.addEventListener("playing", () => { clearTimeout(failTimer); setState("playing"); status("Live"); });
  audio.addEventListener("waiting", () => { if (!audio.paused) { setState("loading"); status("Buffering"); } });
  audio.addEventListener("error", () => { if (current && audio.getAttribute("src")) next(); });

  playBtn.onclick = toggle;
  npFav.onclick = () => current && toggleFav(current.id);
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

  if (cat === "fav" && !favs.size) cat = "all";
  renderChips(); render();
  const last = byId[store.get("mr-last", "")];
  if (last) {
    current = last; player.hidden = false;
    $("#npName").textContent = last.name;
    const t = $("#npTile"); t.textContent = initials(last.name);
    status("Tap play to resume"); syncPlayer();
  }
})();
