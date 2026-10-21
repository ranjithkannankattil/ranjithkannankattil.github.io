// Visitor counter for the footer. Counts each browser once per day and shows the total.
// The only thing stored anywhere is that single number (Firestore: stats/site.visits);
// the "counted today" mark stays in this browser's local storage.
(function () {
  const el = document.getElementById("visits");
  if (!el) return;
  const KEY = "AIzaSyDGsaqqamWbS6RCtyU9v54o-oqZqYzdDEo";
  const DOC = "projects/ranjithkb-radio/databases/(default)/documents/stats/site";
  const API = "https://firestore.googleapis.com/v1/";
  const today = new Date().toISOString().slice(0, 10);
  let counted = false;
  try { counted = localStorage.getItem("kb-counted") === today; } catch { /* private mode: count, don't remember */ }

  const show = (n) => {
    if (!n) return;
    n = Number(n);
    el.textContent = `${n.toLocaleString("en-GB")} ${n === 1 ? "visit" : "visits"}`;
    el.title = "Each browser is counted once a day. Nothing about you is stored — see Privacy.";
    el.hidden = false;
  };
  const read = () =>
    fetch(`${API}${DOC}?key=${KEY}`).then((r) => (r.ok ? r.json() : null))
      .then((d) => show(d && d.fields && d.fields.visits && d.fields.visits.integerValue)).catch(() => {});

  if (counted) { read(); return; }
  fetch(`${API}projects/ranjithkb-radio/databases/(default)/documents:commit?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ writes: [{ transform: { document: DOC, fieldTransforms: [{ fieldPath: "visits", increment: { integerValue: "1" } }] } }] }),
  }).then((r) => {
    if (r.ok) { try { localStorage.setItem("kb-counted", today); } catch { /* ignore */ } }
  }).catch(() => {}).finally(read);
})();
