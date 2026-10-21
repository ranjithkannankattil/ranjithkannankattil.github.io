// Photo viewer: tap a frame to open it large (in colour), arrows/swipe to move, Esc to close.
(function () {
  const figs = [...document.querySelectorAll(".ph")];
  const lb = document.getElementById("lb"), img = document.getElementById("lbImg");
  const no = document.getElementById("lbNo"), cap = document.getElementById("lbCap"), bw = document.getElementById("lbBw");
  if (!lb || !figs.length) return;
  let i = 0;
  const caption = (f) => f.querySelector("figcaption").lastChild.textContent.trim();
  const preload = (k) => { const f = figs[(k + figs.length) % figs.length]; const x = new Image(); x.src = f.dataset.full; };

  function show(k) {
    i = (k + figs.length) % figs.length;
    const f = figs[i];
    img.style.opacity = 0;
    img.onload = () => (img.style.opacity = 1);
    img.src = f.dataset.full;
    img.alt = caption(f);
    no.textContent = `${String(i + 1).padStart(2, "0")} / ${figs.length}`;
    cap.textContent = caption(f);
    history.replaceState(null, "", "#" + (i + 1));
    preload(i + 1); preload(i - 1);
  }
  function open(k) { show(k); if (!lb.open) lb.showModal(); document.body.style.overflow = "hidden"; }
  function close() { lb.close(); }
  lb.addEventListener("close", () => { document.body.style.overflow = ""; history.replaceState(null, "", location.pathname); figs[i].querySelector("button").focus({ preventScroll: true }); });

  figs.forEach((f, k) => f.querySelector(".ph-open").addEventListener("click", () => open(k)));
  document.getElementById("lbPrev").onclick = () => show(i - 1);
  document.getElementById("lbNext").onclick = () => show(i + 1);
  document.getElementById("lbClose").onclick = close;
  bw.onclick = () => { const on = !lb.classList.contains("bw"); lb.classList.toggle("bw", on); bw.setAttribute("aria-pressed", on); };
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(i + 1);
    if (e.key === "ArrowLeft") show(i - 1);
  });
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target.id === "lbStage") close(); });

  // swipe
  let x0 = null;
  const stage = document.getElementById("lbStage");
  stage.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  stage.addEventListener("pointerup", (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { e.stopPropagation(); show(i + (dx < 0 ? 1 : -1)); }
  });

  const h = parseInt(location.hash.slice(1), 10);
  if (h >= 1 && h <= figs.length) open(h - 1);
})();
