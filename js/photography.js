// Photo viewer: tap a frame to open it large (in colour), arrows/swipe to move, Esc to close.
// Each .ph-set is a series; the viewer moves within the series you opened. Links: #tenby-4, #florence-12
// (a bare #12 still means Florence, for links shared before there were several series).
(function () {
  const figs = [...document.querySelectorAll(".ph")];
  const lb = document.getElementById("lb"), img = document.getElementById("lbImg");
  const no = document.getElementById("lbNo"), cap = document.getElementById("lbCap"), bw = document.getElementById("lbBw");
  if (!lb || !figs.length) return;
  let i = 0;
  const setOf = (f) => f.closest(".ph-set");
  const members = (f) => figs.filter((g) => setOf(g) === setOf(f));
  const setName = (f) => { const t = setOf(f) && setOf(f).querySelector(".ph-set-title"); return t ? t.textContent.trim() : ""; };
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
    history.replaceState(null, "", "#" + (set && set.id ? set.id + "-" : "") + (j + 1));
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
    const set = document.getElementById(m[1] || "florence");
    const list = set ? figs.filter((g) => setOf(g) === set) : [];
    const n = parseInt(m[2], 10);
    if (n >= 1 && n <= list.length) open(figs.indexOf(list[n - 1]));
  }
})();
