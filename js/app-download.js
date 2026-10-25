// Android app download card on the Radio page. Shows the card (not on iPhone/iPad or inside
// the app) with the latest version, its release date and time, what's new, and the download
// total. All of it comes from the app's GitHub releases (radio-app-v<version>); GitHub does the
// counting, this page only reads the public numbers. Nothing about visitors is stored here.
(function () {
  const card = document.getElementById("radioApp");
  if (!card) return;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (window.Capacitor || ios) return;
  card.hidden = false;

  const $ = (id) => document.getElementById(id);
  const API = "https://api.github.com/repos/ranjithkannankattil/ranjithkannankattil.github.io/releases?per_page=100";
  let total = 0;

  const showCount = (n) => {
    total = n;
    const out = $("raCount");
    if (!out || !total) return;
    out.textContent = `Downloaded ${total.toLocaleString("en-GB")} ${total === 1 ? "time" : "times"}`;
    out.hidden = false;
  };
  const when = (iso) => {
    try {
      return new Date(iso).toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        timeZone: "Europe/Rome", timeZoneName: "short",
      });
    } catch { return ""; }
  };
  const showInfo = (info) => {
    if (!info || !info.version) return;
    const v = $("raVer");
    v.textContent = `Version ${info.version}${info.date ? ` · released ${when(info.date)}` : ""}`;
    v.hidden = false;
    if (info.notes && info.notes.length) {
      const ul = $("raNewList");
      ul.textContent = "";
      for (const n of info.notes) { const li = document.createElement("li"); li.textContent = n; ul.append(li); }
      $("raNew").hidden = false;
    }
  };
  const show = (d) => { showInfo(d.info); showCount(d.n); };

  // latest app release: version from the tag, bullet lines after "What's new:" as the notes
  function latest(rels) {
    const apps = (rels || []).filter((r) => /^radio-app-v/.test(r.tag_name || "") && !r.draft);
    apps.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    const r = apps[0];
    if (!r) return null;
    const body = String(r.body || "");
    const notes = body.split(/\r?\n/).filter((l) => /^\s*-\s+/.test(l)).map((l) => l.replace(/^\s*-\s+/, "").trim());
    const asset = (r.assets || []).find((a) => /\.apk$/i.test(a.name));
    return {
      version: r.tag_name.replace(/^radio-app-v/, ""),
      date: (asset && asset.updated_at) || r.published_at,
      notes,
    };
  }

  // GitHub allows 60 unauthenticated reads an hour per visitor; keep the answer for 10 minutes.
  const CK = "kb-apk-info";
  try {
    const c = JSON.parse(sessionStorage.getItem(CK) || "null");
    if (c && Date.now() - c.t < 600000) { show(c); wire(); return; }
  } catch { /* storage blocked */ }

  fetch(API, { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : []))
    .then((rels) => {
      let n = 0;
      for (const rel of rels || []) {
        if (!String(rel.tag_name || "").startsWith("radio-app-")) continue;
        for (const a of rel.assets || []) if (/\.apk$/i.test(a.name)) n += a.download_count || 0;
      }
      const d = { n, info: latest(rels), t: Date.now() };
      try { sessionStorage.setItem(CK, JSON.stringify(d)); } catch { /* ignore */ }
      show(d);
    })
    .catch(() => {});
  wire();

  function wire() {
    const btn = card.querySelector(".ra-btn");
    if (btn) btn.addEventListener("click", () => { showCount(total + 1); try { sessionStorage.removeItem(CK); } catch { /* ignore */ } }, { once: true });
  }
})();
