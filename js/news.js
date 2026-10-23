// News: trusted papers by place and language. Data is rebuilt every two hours by
// .github/workflows/build-news.yml and published to the news-data branch.
(function () {
  const BASE = "https://raw.githubusercontent.com/ranjithkannankattil/ranjithkannankattil.github.io/news-data/";
  const PER = 8;
  const DEFAULT_PINS = ["world", "thrissur", "kodungallur", "bengaluru", "swansea", "london", "milan", "qingdao", "qidong"];
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  let index = null, byId = {}, kids = {};
  let place = store.get("news-place", "world");
  let langs = store.get("news-langs", ["en", "ml"]);
  let pins = store.get("news-pins", DEFAULT_PINS);
  let showOther = store.get("news-other", false);
  let data = null, nextTimer = null, lastLoad = 0, topic = "";
  const open = new Set();

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmtTime = (ts) => new Date(ts * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  function ago(ts) {
    const s = Date.now() / 1000 - ts;
    if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), "minute");
    if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
    return rtf.format(-Math.round(s / 86400), "day");
  }
  const path = (id) => { const out = []; for (let p = byId[id]; p; p = byId[p.parent]) out.unshift(p); return out; };

  async function getJSON(name, fresh) {
    const r = await fetch(BASE + name + (fresh ? `?t=${Date.now()}` : `?h=${Math.floor(Date.now() / 600000)}`), { cache: fresh ? "no-store" : "default" });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  // ---------- place picker ----------
  function renderBar() {
    const p = byId[place];
    const trail = path(place).slice(0, -1).map((x) => x.name);
    $("placePath").textContent = trail.length ? trail.join(" › ") + " ›" : "Place";
    $("placeCur").textContent = p.name;
    $("placeNative").textContent = p.native && p.native !== p.name ? p.native : "";
    const pinsEl = $("pins");
    pinsEl.innerHTML = "";
    for (const id of pins) {
      if (!byId[id]) continue;
      const b = el("button", "pin", byId[id].name);
      b.setAttribute("aria-pressed", id === place);
      b.onclick = () => go(id);
      pinsEl.append(b);
    }
    const pinned = pins.includes(place);
    $("pinBtn").textContent = pinned ? "✓ In your places" : "+ Add to your places";
    $("pinBtn").classList.toggle("on", pinned);
    $("pinBtn").title = pinned ? "Click to remove from your places" : "";
  }
  $("pinBtn").onclick = () => {
    pins = pins.includes(place) ? pins.filter((x) => x !== place) : [...pins, place];
    store.set("news-pins", pins);
    renderBar();
  };

  function renderPlaceList(q) {
    const list = $("placeList");
    list.innerHTML = "";
    q = (q || "").trim().toLowerCase();
    const match = (p) => !q || p.name.toLowerCase().includes(q) || (p.native || "").toLowerCase().includes(q);
    const addBtn = (row, p, depth) => {
      const b = el("button", "pl d" + depth);
      b.append(el("span", null, p.name));
      if (p.native && p.native !== p.name) b.append(el("small", null, p.native));
      b.setAttribute("aria-pressed", p.id === place);
      b.onclick = () => { closePanel(); go(p.id); };
      row.append(b);
    };
    const world = byId.world;
    if (match(world)) { const row = el("div", "pl-row"); addBtn(row, world, 0); list.append(row); }
    let shown = 0;
    for (const c of kids.world || []) {
      const all = [c];
      const walk = (id) => (kids[id] || []).forEach((k) => { all.push(k); walk(k.id); });
      walk(c.id);
      const hits = all.filter(match);
      if (!hits.length) continue;
      shown += hits.length;
      list.append(el("div", "pl-g", c.name + (c.native && c.native !== c.name ? "  ·  " + c.native : "")));
      const row = el("div", "pl-row");
      for (const p of (q ? hits : all)) addBtn(row, p, p.kind === "country" ? 1 : p.kind === "region" ? 2 : 3);
      list.append(row);
    }
    if (q && !shown && !match(world)) list.append(el("p", "pl-none", "No place by that name yet — it can be added."));
  }
  function openPanel() { $("placePanel").hidden = false; $("placeBtn").setAttribute("aria-expanded", "true"); $("placeQ").value = ""; renderPlaceList(""); $("placeQ").focus(); }
  function closePanel() { $("placePanel").hidden = true; $("placeBtn").setAttribute("aria-expanded", "false"); }
  $("placeBtn").onclick = () => ($("placePanel").hidden ? openPanel() : closePanel());
  $("placeQ").oninput = (e) => renderPlaceList(e.target.value);
  $("placeQ").onkeydown = (e) => {
    if (e.key === "Enter") { const b = $("placeList").querySelector("button"); if (b) b.click(); }
    if (e.key === "Escape") closePanel();
  };
  document.addEventListener("click", (e) => { if (!e.target.closest(".place-pick")) closePanel(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

  // ---------- languages ----------
  function renderLangs() {
    const box = $("langs");
    box.innerHTML = "";
    const here = byId[place].langs;
    const order = [...here, ...Object.keys(index.langs).filter((l) => !here.includes(l))];
    for (const l of order) {
      const L = index.langs[l];
      const b = el("button", "lg-chip" + (here.includes(l) ? "" : " none"));
      b.lang = l;
      b.textContent = L.native === L.name ? L.name : L.native;
      b.title = L.name + (here.includes(l) ? "" : ` — no ${L.name} papers cover ${byId[place].name}`);
      b.setAttribute("aria-pressed", langs.includes(l));
      b.onclick = () => {
        langs = langs.includes(l) ? langs.filter((x) => x !== l) : [...langs, l];
        store.set("news-langs", langs);
        renderLangs();
        renderStories();
      };
      box.append(b);
    }
  }

  function renderSub() {
    const nav = $("subplaces");
    nav.innerHTML = "";
    const p = byId[place];
    const ch = kids[place] || [];
    if (p.parent) {
      const up = el("button", "up", "↑ " + byId[p.parent].name);
      up.onclick = () => go(p.parent);
      nav.append(up);
    }
    if (ch.length) {
      nav.append(el("span", "k", p.kind === "world" ? "Countries" : "Within " + p.name));
      for (const c of ch) { const b = el("button", "sp", c.name); b.onclick = () => go(c.id); nav.append(b); }
    }
  }

  // ---------- stories ----------
  function storyEl(s, lead, other) {
    const a = el("article", "story" + (lead ? " lead" : ""));
    const h = el("h3");
    const link = el("a", null, s.t);
    link.href = s.u; link.target = "_blank"; link.rel = "noopener";
    h.append(link);
    a.append(h);
    if (s.s) a.append(el("p", "sum", s.s));
    const m = el("div", "meta");
    m.append(el("span", "src", s.src || "Unknown"));
    m.append(el("span", null, ago(s.ts)));
    if (other) m.append(el("span", "other", "Other outlet"));
    if (s.ai) m.append(el("span", "ai", "AI summary"));
    if (s.live) m.append(el("span", "ai", "Just in"));
    a.append(m);
    return a;
  }

  function renderTopics() {
    const nav = $("topics");
    nav.innerHTML = "";
    const has = data && data.topics && index.topics;
    nav.hidden = !has;
    if (!has) { topic = ""; return; }
    if (topic && !data.topics[topic]) topic = "";
    for (const [id, name] of [["", "Top stories"], ...index.topics]) {
      if (id && !data.topics[id]) continue;
      const b = el("button", null, name);
      b.setAttribute("aria-pressed", id === topic);
      b.onclick = () => { topic = id; renderTopics(); renderStories(); };
      nav.append(b);
    }
  }

  function renderStories() {
    const box = $("stories");
    box.innerHTML = "";
    if (!data) return;
    const p = byId[place];
    const picked = langs.length ? langs : ["en"];
    let chosen = picked.filter((l) => p.langs.includes(l));
    const missing = picked.filter((l) => !p.langs.includes(l));
    const fallback = !chosen.length;
    if (fallback) chosen = [p.langs[0]];
    box.classList.toggle("multi", chosen.length > 1);
    const local = p.kind === "region" || p.kind === "city";
    $("otherWrap").hidden = !local;
    if (missing.length || fallback) {
      const n = el("div", "lang-note");
      const names = (ls) => ls.map((x) => index.langs[x].name).join(", ");
      n.append(document.createTextNode(fallback
        ? `None of your languages (${names(picked)}) cover ${p.name}, so here is ${index.langs[chosen[0]].name}. `
        : `${names(missing)} ${missing.length > 1 ? "papers aren't" : "papers aren't"} followed for ${p.name}. `));
      const add = p.langs.filter((x) => !langs.includes(x));
      for (const x of add) {
        const b = el("button", "add-lang", "+ " + index.langs[x].name);
        b.onclick = () => { langs = [...langs, x]; store.set("news-langs", langs); renderLangs(); renderStories(); };
        n.append(b);
      }
      box.append(n);
    }
    for (const l of chosen) {
      const L = index.langs[l];
      const sec = el("section", "lang-sec");
      sec.lang = l;
      const T = topic && data.topics && data.topics[topic];
      let list = T ? T[l] || [] : (data.news && data.news[l]) || [];
      let others = !T && local && showOther ? (data.other && data.other[l]) || [] : [];
      const items = [...list.map((s) => [s, false]), ...others.map((s) => [s, true])].sort((a, b) => b[0].ts - a[0].ts);
      const head = el("div", "sec-head");
      head.append(el("h2", null, L.name), el("span", "n", items.length ? `${items.length} ${items.length === 1 ? "story" : "stories"}` : ""));
      sec.append(head);
      const dg = !T && data.digest && data.digest[l];
      if (dg && dg.b && dg.b.length) {
        const d = el("div", "digest");
        d.append(el("div", "dk", `${p.name} in brief`));
        const ul = el("ul");
        for (const b of dg.b) ul.append(el("li", null, b));
        d.append(ul, el("div", "dn", "AI summary of the stories below — check the papers for detail"));
        sec.append(d);
      }
      if (!items.length) {
        const n = el("p", "empty", `No ${L.name} stories about ${p.name} from the trusted papers in the last ${p.kind === "city" ? "week" : "few days"}.`);
        if (local && !showOther && (data.other && data.other[l] || []).length) n.textContent += ` ${data.other[l].length} from other local outlets — switch them on above.`;
        sec.append(n);
      } else {
        const key = place + ":" + l + ":" + topic;
        const lim = open.has(key) ? items.length : PER;
        items.slice(0, lim).forEach(([s, o], i) => sec.append(storyEl(s, i === 0, o)));
        if (items.length > lim) {
          const more = el("button", "more", `Show ${items.length - lim} more`);
          more.onclick = () => { open.add(key); renderStories(); };
          sec.append(more);
        }
      }
      // a quiet place: the district's (or region's) stories, clearly labelled as not its own
      const ar = !T && local && data.around && data.around.news && data.around.news[l];
      if (ar && ar.length) {
        const from = byId[data.around.from];
        const d = el("div", "around");
        d.append(el("div", "around-k", `Around ${p.name} — from ${from ? from.name : data.around.from}`));
        ar.forEach((s) => d.append(storyEl(s, false, false)));
        sec.append(d);
      }
      box.append(sec);
    }
    renderSources(chosen);
  }

  function renderSources(chosen) {
    const body = $("sourcesBody");
    body.innerHTML = "";
    for (const l of chosen) {
      const d = el("div", "src-l");
      d.lang = l;
      d.append(el("b", null, index.langs[l].name + " — "), document.createTextNode((index.outlets[l] || []).join(", ")));
      body.append(d);
    }
  }

  function renderWhen(msg) {
    if (!data) return;
    const next = data.updated + index.every;
    const late = Date.now() / 1000 > next + 1800;
    $("edWhen").textContent = msg || `Edition of ${fmtTime(data.updated)} · next ${late ? "due any minute" : "around " + fmtTime(next + 600)}`;
  }

  // ---------- loading ----------
  async function load(fresh) {
    try {
      if (fresh || !index) {
        index = await getJSON("index.json", fresh);
        byId = {}; kids = {};
        for (const p of index.places) { byId[p.id] = p; if (p.parent) (kids[p.parent] = kids[p.parent] || []).push(p); }
      }
      if (!byId[place]) place = "world";
      const before = data && data.id === place ? data.updated : 0;
      data = await getJSON(`p/${place}.json`, fresh);
      lastLoad = Date.now();
      renderBar(); renderLangs(); renderSub(); renderTopics(); renderStories();
      renderWhen();
      schedule();
      return before && data.updated > before ? "new" : before ? "same" : "first";
    } catch (e) {
      $("edWhen").textContent = "Couldn't load the news just now — try Refresh in a moment.";
      return "error";
    }
  }

  function go(id) {
    place = id;
    store.set("news-place", id);
    history.replaceState(null, "", "?p=" + id);
    data = null;
    $("stories").innerHTML = "";
    renderBar(); renderLangs(); renderSub();
    load(false);
    window.scrollTo({ top: Math.min(window.scrollY, document.querySelector(".news-bar").offsetTop - 20), behavior: "smooth" });
  }

  // automatic refresh: shortly after the next edition is due
  function schedule() {
    clearTimeout(nextTimer);
    const due = (data.updated + index.every + 900) * 1000 - Date.now();
    nextTimer = setTimeout(() => load(true), Math.max(due, 10 * 60 * 1000));
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && data && Date.now() - lastLoad > 15 * 60 * 1000 && Date.now() / 1000 > data.updated + index.every) load(true);
  });

  // instant refresh through the Cloudflare Worker (worker/news-live.js), when one is set up
  async function live() {
    if (!index || !index.live || !data) return 0;
    try {
      const want = (langs.length ? langs : ["en"]).filter((l) => byId[place].langs.includes(l));
      const r = await fetch(`${index.live}?p=${encodeURIComponent(place)}&l=${want.join(",")}`);
      if (!r.ok) return 0;
      const d = await r.json();
      const key = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 80);
      let added = 0;
      for (const [l, list] of Object.entries(d.news || {})) {
        const have = new Set(((data.news || {})[l] || []).map((s) => key(s.t)));
        const fresh = list.filter((s) => !have.has(key(s.t)) && s.ts > data.updated - 3600).map((s) => ({ ...s, live: 1 }));
        if (fresh.length) { data.news[l] = [...fresh, ...(data.news[l] || [])]; added += fresh.length; }
      }
      if (added) renderStories();
      return added;
    } catch { return 0; }
  }

  $("refresh").onclick = async () => {
    const btn = $("refresh");
    btn.classList.add("spin"); btn.disabled = true;
    const r = await load(true);
    const extra = await live();
    if (extra) { btn.classList.remove("spin"); btn.disabled = false; renderWhen(`${extra} new ${extra === 1 ? "story" : "stories"} since the ${fmtTime(data.updated)} edition`); return; }
    btn.classList.remove("spin"); btn.disabled = false;
    if (r === "new") renderWhen(`New edition loaded · ${fmtTime(data.updated)}`);
    else if (r === "same") renderWhen(`Up to date — edition of ${fmtTime(data.updated)}; the next one is due around ${fmtTime(data.updated + index.every + 600)}`);
  };

  $("otherTog").checked = showOther;
  $("otherTog").onchange = (e) => { showOther = e.target.checked; store.set("news-other", showOther); renderStories(); };

  const qp = new URLSearchParams(location.search).get("p");
  if (qp) place = qp;
  load(false);
})();
