// Listening time on the Radio page. Counted only while a station is actually playing.
// Kept in this browser (mr-listen); when signed in, saved per device to the account (js/radio-sync.js)
// so the app and the website add up. Whole minutes also go to one anonymous total that holds
// nothing but the number (Firestore stats/listening).
(() => {
  const audio = document.getElementById("audio");
  if (!audio) return;
  const KEY = (window.FIREBASE_CONFIG || {}).apiKey || "";
  const STATS = "https://firestore.googleapis.com/v1/projects/ranjithkb-radio/databases/(default)/documents/stats/listening";
  const get = () => { try { return JSON.parse(localStorage.getItem("mr-listen")) || {}; } catch { return {}; } };
  const put = (v) => { try { localStorage.setItem("mr-listen", JSON.stringify(v)); } catch {} };
  const weekKey = () => { const d = new Date(), j = new Date(d.getFullYear(), 0, 1);
    return d.getFullYear() + "-" + Math.ceil(((d - j) / 864e5 + j.getDay() + 1) / 7); };
  let L = get();
  if (!L.device) { L.device = "w" + Math.random().toString(36).slice(2, 12); put(L); }
  let mark = 0, who = null, account = null, everyone = null;

  function add() {
    if (!mark || !who) return;
    const now = Date.now(), ms = Math.min(120000, Math.max(0, now - mark)); mark = now;
    if (!ms) return;
    L = get();
    L.total = (L.total || 0) + ms;
    const wk = weekKey(); L.week = (L.weekKey === wk ? L.week || 0 : 0) + ms; L.weekKey = wk;
    L.top = L.top || {}; const t = L.top[who.key] || { n: who.name, ms: 0 }; t.n = who.name; t.ms += ms; L.top[who.key] = t;
    L.pending = (L.pending || 0) + ms;
    put(L);
  }
  const now = () => (window.RadioApp && window.RadioApp.now) ? window.RadioApp.now() : null;
  audio.addEventListener("playing", () => { add(); who = now(); mark = Date.now(); });
  ["pause", "ended", "emptied", "error"].forEach((ev) => audio.addEventListener(ev, () => { add(); mark = 0; }));
  window.addEventListener("pagehide", add);

  async function flushEveryone() {
    L = get(); const min = Math.floor((L.pending || 0) / 60000);
    if (min < 5 || !KEY) return;
    const n = Math.min(30, min);
    try {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/ranjithkb-radio/databases/(default)/documents:commit?key=${KEY}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ writes: [{ transform: { document: "projects/ranjithkb-radio/databases/(default)/documents/stats/listening",
          fieldTransforms: [{ fieldPath: "minutes", increment: { integerValue: String(n) } }] } }] }) });
      if (r.ok) { L = get(); L.pending = Math.max(0, (L.pending || 0) - n * 60000); put(L); }
    } catch { /* next time */ }
  }
  function save() {
    L = get();
    const top = Object.fromEntries(Object.entries(L.top || {}).sort((a, b) => b[1].ms - a[1].ms).slice(0, 10));
    window.dispatchEvent(new CustomEvent("radio:listen-save", { detail: { device: L.device,
      data: { total: L.total || 0, weekKey: weekKey(), week: L.weekKey === weekKey() ? L.week || 0 : 0, top } } }));
  }
  setInterval(() => { if (mark) { add(); mark = Date.now(); } flushEveryone(); }, 60000);
  setInterval(save, 5 * 60000);
  window.addEventListener("radio:listen-account", (e) => { account = e.detail || {}; paint(); });

  const hm = (ms) => { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  async function paint() {
    const $ = (id) => document.getElementById(id);
    if (!$("lsTotal")) return;
    add(); if (mark) mark = Date.now();
    L = get();
    let total = L.total || 0, week = L.weekKey === weekKey() ? L.week || 0 : 0, tops = [L.top || {}], many = false;
    if (account && Object.keys(account).length) {
      many = true; total = 0; week = 0; tops = [];
      const mine = { total: L.total || 0, weekKey: weekKey(), week, top: L.top || {} };
      const all = { ...account, [L.device]: mine };
      for (const d of Object.values(all)) { total += d.total || 0; if (d.weekKey === weekKey()) week += d.week || 0; tops.push(d.top || {}); }
    }
    const sum = {};
    tops.forEach((t) => Object.entries(t).forEach(([k, v]) => { sum[k] = { n: v.n || k, ms: (sum[k] ? sum[k].ms : 0) + (v.ms || 0) }; }));
    $("lsTotal").textContent = total < 60000 ? "Nothing yet — your listening time starts counting now." : `You've listened for ${hm(total)}`;
    $("lsWeek").textContent = total < 60000 ? "" : `This week: ${hm(week)} · ${many ? "all your devices" : "in this browser"}`;
    const ol = $("lsTop"); ol.innerHTML = "";
    Object.values(sum).sort((a, b) => b.ms - a.ms).slice(0, 5).filter((x) => x.ms >= 60000).forEach((x) => {
      const li = document.createElement("li"); li.textContent = `${x.n} · ${hm(x.ms)}`; ol.append(li); });
    if (everyone === null && KEY) {
      try { const r = await fetch(`${STATS}?key=${KEY}`); if (r.ok) { const j = await r.json(); everyone = +(((j.fields || {}).minutes || {}).integerValue || 0); } } catch { /* offline */ }
    }
    if (everyone) { $("lsAll").hidden = false; $("lsAll").textContent = `Listeners have enjoyed ${Math.floor(everyone / 60).toLocaleString()} hours of radio on Radio Velvet.`; }
  }
  window.RadioListen = { paint, save };
})();
