// Inside the Android Radio app: when a newer version of the app has been released, show a
// banner with the new version, what's new and an Update button (downloads the new APK in the
// browser). Versions come from the app's GitHub releases (radio-app-v<version>). Checked at
// most once every 6 hours; "Later" hides it until the next version.
(function () {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform() || !C.getPlatform || C.getPlatform() !== "android") return;

  const API = "https://api.github.com/repos/ranjithkannankattil/ranjithkannankattil.github.io/releases?per_page=30";
  const APK = "https://github.com/ranjithkannankattil/ranjithkannankattil.github.io/releases/latest/download/Radio.apk";
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  const parts = (v) => String(v || "0").split(".").map((x) => parseInt(x, 10) || 0);
  const newer = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

  async function installed() {
    try { const r = await C.nativePromise("RadioMedia", "getInfo", {}); if (r && r.version) return r.version; } catch { /* apps before 1.1.0 */ }
    return "1.0";   // apps before 1.1.0 can't report their version
  }
  async function latest() {
    const c = store.get("kb-app-latest");
    if (c && Date.now() - c.t < 6 * 3600e3) return c.info;
    const rels = await fetch(API, { headers: { Accept: "application/vnd.github+json" } }).then((r) => (r.ok ? r.json() : []));
    const r = (rels || []).filter((x) => /^radio-app-v/.test(x.tag_name || "") && !x.draft)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];
    if (!r) return null;
    const notes = String(r.body || "").split(/\r?\n/).filter((l) => /^\s*-\s+/.test(l)).map((l) => l.replace(/^\s*-\s+/, "").trim());
    const asset = (r.assets || []).find((a) => /\.apk$/i.test(a.name));
    const info = { version: r.tag_name.replace(/^radio-app-v/, ""), date: (asset && asset.updated_at) || r.published_at, notes };
    store.set("kb-app-latest", { info, t: Date.now() });
    return info;
  }
  const when = (iso) => { try { return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome", timeZoneName: "short" }); } catch { return ""; } };

  function banner(have, info) {
    const box = document.createElement("aside");
    box.className = "app-update";
    box.setAttribute("role", "status");
    const h = document.createElement("p"); h.className = "au-title";
    h.textContent = `New version of the Radio app: ${info.version}`;
    const sub = document.createElement("p"); sub.className = "au-sub";
    sub.textContent = `${have === "1.0" ? "You have an older version." : `You have ${have}.`}${info.date ? ` Released ${when(info.date)}.` : ""}`;
    box.append(h, sub);
    if (info.notes.length) {
      const ul = document.createElement("ul");
      for (const n of info.notes) { const li = document.createElement("li"); li.textContent = n; ul.append(li); }
      box.append(ul);
    }
    const tip = document.createElement("p"); tip.className = "au-tip";
    tip.textContent = "Tap Update, open the downloaded file and install. If Android says the app isn't installed, uninstall this Radio app first, then install the new one.";
    const row = document.createElement("div"); row.className = "au-row";
    const go = document.createElement("a"); go.className = "au-go"; go.href = APK; go.textContent = "Update"; go.rel = "noopener";
    const later = document.createElement("button"); later.className = "au-later"; later.type = "button"; later.textContent = "Later";
    later.onclick = () => { store.set("kb-app-skip", info.version); box.remove(); };
    row.append(go, later);
    box.append(tip, row);
    const main = document.querySelector("main");
    (main || document.body).prepend(box);
  }

  (async () => {
    try {
      const [have, info] = await Promise.all([installed(), latest()]);
      if (!info || !newer(info.version, have)) return;
      if (store.get("kb-app-skip") === info.version) return;
      banner(have, info);
    } catch { /* offline: try next time */ }
  })();
})();
