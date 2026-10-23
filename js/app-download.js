// Android app download card on the Radio page: shows the card (not on iPhone/iPad or inside
// the app) and counts downloads. The only thing stored is one number (Firestore:
// stats/downloads.apk) — nothing about who downloaded.
(function () {
  const card = document.getElementById("radioApp");
  if (!card) return;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (window.Capacitor || ios) return;
  card.hidden = false;

  const KEY = "AIzaSyDGsaqqamWbS6RCtyU9v54o-oqZqYzdDEo";
  const API = "https://firestore.googleapis.com/v1/projects/ranjithkb-radio/databases/(default)/documents";
  const DOC = "projects/ranjithkb-radio/databases/(default)/documents/stats/downloads";
  const out = document.getElementById("raCount");
  let total = 0;

  const show = (n) => {
    total = Number(n) || 0;
    if (!out || !total) return;
    out.textContent = `Downloaded ${total.toLocaleString("en-GB")} ${total === 1 ? "time" : "times"}`;
    out.hidden = false;
  };

  fetch(`${API}/stats/downloads?key=${KEY}`).then((r) => (r.ok ? r.json() : null))
    .then((d) => show(d && d.fields && d.fields.apk && d.fields.apk.integerValue)).catch(() => {});

  const btn = card.querySelector(".ra-btn");
  if (btn) btn.addEventListener("click", () => {
    show(total + 1);
    const body = JSON.stringify({ writes: [{ transform: { document: DOC, fieldTransforms: [{ fieldPath: "apk", increment: { integerValue: "1" } }] } }] });
    const url = `${API}:commit?key=${KEY}`;
    // keepalive so the count still lands while the browser starts the download
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  });
})();
