// Photography pages (built by scripts/build_photos.py).
// Viewer: tap a frame to open it large (in colour), arrows/swipe to move, Esc to close. Each .ph-set
// is one visit; the viewer moves within it. Links: #4 on a month page, #v2026-05-4 on a place page.
// Share buttons (.ph-share) use the phone's share sheet, or copy the link.
(function () {
  const msg = document.getElementById("phMsg");
  let msgTimer = 0;
  function say(t, ms) {
    if (!msg) return;
    msg.textContent = t; msg.hidden = false;
    clearTimeout(msgTimer); msgTimer = setTimeout(() => { msg.hidden = true; }, ms || 3000);
  }
  document.querySelectorAll(".ph-share").forEach((b) => b.addEventListener("click", async () => {
    const url = b.dataset.url, title = b.dataset.title;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); say("Link copied"); }
    catch { say(`Copy this link: ${url}`, 10000); }
  }));

  const figs = [...document.querySelectorAll(".ph")];
  const lb = document.getElementById("lb"), img = document.getElementById("lbImg");
  const no = document.getElementById("lbNo"), cap = document.getElementById("lbCap"), bw = document.getElementById("lbBw");
  if (!lb || !figs.length) return;
  let i = 0;
  const setOf = (f) => f.closest(".ph-set");
  const members = (f) => figs.filter((g) => setOf(g) === setOf(f));
  const sets = [...document.querySelectorAll(".ph-set")];
  const single = !!document.querySelector(".ph-one");   // a month page: one visit, plain #n links
  const setName = (f) => (single ? "" : (setOf(f) && setOf(f).dataset.name) || "");
  const caption = (f) => f.querySelector("figcaption").lastChild.textContent.trim();
  const step = (d) => { const m = members(figs[i]), j = m.indexOf(figs[i]); return figs.indexOf(m[(j + d + m.length) % m.length]); };
  const preload = (k) => { const x = new Image(); x.src = figs[k].dataset.full; };

  function show(k) {
    i = k;
    const f = figs[i], m = members(f), j = m.indexOf(f), set = setOf(f);
    img.style.opacity = 0;
    img.onload = () => (img.style.opacity = 1);
    img.src = f.dataset.full;
    img.alt = caption(f);
    no.textContent = (setName(f) ? setName(f) + " · " : "") + `${String(j + 1).padStart(2, "0")} / ${m.length}`;
    cap.textContent = caption(f);
    lb.classList.toggle("bw", bw.getAttribute("aria-pressed") === "true");
    history.replaceState(null, "", "#" + (!single && set && set.id ? set.id + "-" : "") + (j + 1));
    preload(step(1)); preload(step(-1));
  }
  function open(k) { show(k); if (!lb.open) lb.showModal(); document.body.style.overflow = "hidden"; }
  function close() { lb.close(); }
  lb.addEventListener("close", () => { document.body.style.overflow = ""; history.replaceState(null, "", location.pathname); figs[i].querySelector("button").focus({ preventScroll: true }); });

  figs.forEach((f, k) => f.querySelector(".ph-open").addEventListener("click", () => open(k)));
  document.getElementById("lbPrev").onclick = () => show(step(-1));
  document.getElementById("lbNext").onclick = () => show(step(1));
  document.getElementById("lbClose").onclick = close;
  bw.onclick = () => { const on = !lb.classList.contains("bw"); lb.classList.toggle("bw", on); bw.setAttribute("aria-pressed", on); };
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(step(1));
    if (e.key === "ArrowLeft") show(step(-1));
  });
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target.id === "lbStage") close(); });

  // swipe
  let x0 = null;
  const stage = document.getElementById("lbStage");
  stage.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  stage.addEventListener("pointerup", (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { e.stopPropagation(); show(step(dx < 0 ? 1 : -1)); }
  });

  const m = location.hash.match(/^#(?:([a-z][\w-]*?)-)?(\d+)$/);
  if (m) {
    const set = m[1] ? document.getElementById(m[1]) : sets[0];
    const list = set ? figs.filter((g) => setOf(g) === set) : [];
    const n = parseInt(m[2], 10);
    if (n >= 1 && n <= list.length) open(figs.indexOf(list[n - 1]));
  }
})();
