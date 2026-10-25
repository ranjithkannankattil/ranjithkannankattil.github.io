// Writings archive: list, search, filters. Reads window.POST_INDEX (js/posts-index.js);
// full text for searching is fetched only when someone types (posts/search.json).
(function () {
  const P = [...window.POST_INDEX].sort((a, b) => (b.d + b.s).localeCompare(a.d + a.s));   // newest first
  const $ = (id) => document.getElementById(id);
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const FORM = { "ഗദ്യം": "Prose", "കവിത": "Poem" };
  const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmt = (d) => `${+d.slice(8, 10)} ${MONTH[+d.slice(5, 7) - 1]}`;
  const link = (p) => `writing-post.html?slug=${encodeURIComponent(p.s)}`;
  const formOf = (p) => (p.tags || []).map((t) => FORM[t]).find(Boolean) || "";

  let query = "", tag = "", form = "", fullText = null, loadingText = false;


  // ---- today's pick (same for everyone on a given day), and "another one"
  function showPick(p) {
    $("pick").hidden = false;
    const a = $("pickTitle"); a.href = link(p); a.textContent = p.t;
    $("pickEx").textContent = p.x;
    $("pickEx").hidden = !p.x;
    $("pickMeta").textContent = [fmt(p.d) + " " + p.d.slice(0, 4), formOf(p), `${p.m} min read`].filter(Boolean).join(" · ");
  }
  const day = Math.floor(Date.now() / 864e5);
  showPick(P[(day * 2654435761 >>> 0) % P.length]);
  $("random-post").onclick = (e) => { e.preventDefault(); showPick(P[Math.floor(Math.random() * P.length)]); };

  // ---- filters
  for (const [v, label] of [["", "All"], ["Prose", "Prose"], ["Poem", "Poems"]]) {
    const b = el("button", "seg", label);
    b.onclick = () => { form = v; render(); };
    b.dataset.v = v;
    $("forms").append(b);
  }
  const counts = {};
  P.forEach((p) => p.tags.forEach((t) => { if (!FORM[t]) counts[t] = (counts[t] || 0) + 1; }));
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([t, n]) => {
    const b = el("button", "chip-btn");
    b.append(document.createTextNode(t));
    b.dataset.tag = t;
    b.onclick = () => { tag = tag === t ? "" : t; render(); };
    $("popular-tags").append(b);
  });

  async function needText() {
    if (fullText || loadingText) return;
    loadingText = true;
    try {
      const rows = await (await fetch("posts/search.json")).json();
      fullText = Object.fromEntries(rows);
    } catch { fullText = {}; }
    loadingText = false;
    render();
  }

  function matches(p) {
    if (tag && !p.tags.includes(tag)) return false;
    if (form && formOf(p) !== form) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    if ((p.t + " " + p.te + " " + p.tags.join(" ") + " " + p.x).toLowerCase().includes(q)) return true;
    return !!(fullText && fullText[p.f] && fullText[p.f].includes(q));
  }

  function render() {
    const list = P.filter(matches);
    document.querySelectorAll("#forms .seg").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === form));
    document.querySelectorAll("#popular-tags .chip-btn").forEach((b) => b.classList.toggle("active", b.dataset.tag === tag));
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (tag) params.set("tag", tag);
    if (form) params.set("form", form);
    history.replaceState(null, "", params.toString() ? "?" + params : location.pathname);

    const filtered = query || tag || form;
    $("result-count").textContent = filtered
      ? `${list.length} found${query && !fullText ? " · searching the full text…" : ""}`
      : "";
    $("pick").hidden = !!filtered;

    const byYear = {};
    list.forEach((p) => (byYear[p.d.slice(0, 4)] = byYear[p.d.slice(0, 4)] || []).push(p));
    const ys = Object.keys(byYear).sort((a, b) => b - a);

    const yn = $("years");
    yn.innerHTML = "";
    for (const y of ys) {
      const a = el("a", null, y);
      a.href = "#y" + y;
      yn.append(a);
    }

    const box = $("archive");
    box.innerHTML = "";
    if (!list.length) { box.append(el("p", "wr-none", "Nothing matches. Try another word, or clear the filters.")); return; }
    for (const y of ys) {
      const g = el("section", "year-group");
      g.id = "y" + y;
      const h = el("h2"); h.append(document.createTextNode(y));
      g.append(h);
      const ul = el("ul", "entry-list");
      for (const p of byYear[y]) {
        const li = el("li", "entry");
        li.append(el("time", null, fmt(p.d)));
        const body = el("div", "e-body");
        const a = el("a", "title");
        a.href = link(p);
        a.textContent = p.t;
        if (p.te) a.append(el("span", "en", " — " + p.te));
        body.append(a);
        if (p.x) body.append(el("p", "e-ex", p.x));
        li.append(body);
        const m = el("div", "e-meta");
        const f = formOf(p);
        if (f) m.append(el("span", "form-badge", f));
        m.append(el("span", null, `${p.m} min`));
        li.append(m);
        ul.append(li);
      }
      g.append(ul);
      box.append(g);
    }
  }

  let t = null;
  $("search-input").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => { query = e.target.value.trim(); if (query.length > 1) needText(); render(); }, 120);
  });

  const u = new URLSearchParams(location.search);
  query = u.get("q") || ""; tag = u.get("tag") || ""; form = u.get("form") || "";
  $("search-input").value = query;
  if (query) needText();
  render();
})();
