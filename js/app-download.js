// Android app download card on the Radio page. Shows the card (not on iPhone/iPad or inside
// the app) and the download total. The APK is a GitHub release asset, so GitHub does the
// counting; this page only reads the public total. Nothing about visitors is stored here.
(function () {
  const card = document.getElementById("radioApp");
  if (!card) return;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (window.Capacitor || ios) return;
  card.hidden = false;

  const out = document.getElementById("raCount");
  const API = "https://api.github.com/repos/ranjithkannankattil/ranjithkannankattil.github.io/releases?per_page=100";
  let total = 0;
  const show = (n) => {
    total = n;
    if (!out || !total) return;
    out.textContent = `Downloaded ${total.toLocaleString("en-GB")} ${total === 1 ? "time" : "times"}`;
    out.hidden = false;
  };

  // GitHub allows 60 unauthenticated reads an hour per visitor; keep the total for 10 minutes.
  const CK = "kb-apk-count";
  try {
    const c = JSON.parse(sessionStorage.getItem(CK) || "null");
    if (c && Date.now() - c.t < 600000) { show(c.n); wire(); return; }
  } catch { /* storage blocked */ }

  fetch(API, { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : []))
    .then((rels) => {
      let n = 0;
      for (const rel of rels || []) {
        if (!String(rel.tag_name || "").startsWith("radio-app-")) continue;
        for (const a of rel.assets || []) if (/\.apk$/i.test(a.name)) n += a.download_count || 0;
      }
      try { sessionStorage.setItem(CK, JSON.stringify({ n, t: Date.now() })); } catch { /* ignore */ }
      show(n);
    })
    .catch(() => {});
  wire();

  function wire() {
    const btn = card.querySelector(".ra-btn");
    if (btn) btn.addEventListener("click", () => { show(total + 1); try { sessionStorage.removeItem(CK); } catch { /* ignore */ } }, { once: true });
  }
})();
