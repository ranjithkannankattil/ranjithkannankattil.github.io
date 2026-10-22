// One piece of writing: reads the small index (js/posts-index.js) and fetches only this post's text.
(async function () {
  const main = document.getElementById("post-main");
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const FORM = { "ഗദ്യം": "Prose", "കവിത": "Poem" };
  const SRC = { blogspot: "Blog", facebook: "Facebook" };
  const link = (p) => `writing-post.html?slug=${encodeURIComponent(p.s)}`;

  const chrono = window.POST_INDEX;          // oldest → newest
  const slug = new URLSearchParams(location.search).get("slug");
  const i = chrono.findIndex((p) => p.s === slug);
  const p = chrono[i];
  if (!p) {
    main.innerHTML = '<p class="post-missing">That piece isn\'t here. <a href="writings.html">Back to the archive</a>.</p>';
    return;
  }
  document.title = `${p.t} — Writings — Ranjith`;
  // per-post search and share details (the static ones in the page are generic)
  const url = `https://ranjithkb.com/${link(p)}`;
  const setMeta = (attr, key, val) => {
    let m = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, key); document.head.append(m); }
    m.content = val;
  };
  const desc = p.x || p.te || p.t;
  setMeta("name", "description", desc);
  setMeta("property", "og:title", p.t);
  setMeta("property", "og:description", desc);
  setMeta("property", "og:url", url);
  const canon = document.createElement("link");
  canon.rel = "canonical"; canon.href = url;
  document.head.append(canon);
  const form = (p.tags || []).map((t) => FORM[t]).find(Boolean) || "";
  const [y, m, d] = p.d.split("-");

  // header first, so the page has shape while the text loads
  const head = el("header", "post-head");
  const meta = el("div", "post-meta");
  meta.append(el("span", null, `${+d} ${MONTH[+m - 1]} ${y}`));
  if (form) meta.append(el("span", "form-badge", form));
  meta.append(el("span", null, `${p.m} min read`));
  if (SRC[p.src]) meta.append(el("span", null, "First on " + SRC[p.src]));
  head.append(meta);
  const h1 = el("h1", "post-title", p.t);
  head.append(h1);
  if (p.te) head.append(el("p", "post-en", p.te));
  const tools = el("div", "post-tools");
  const minus = el("button", null, "A−"), plus = el("button", null, "A+"), share = el("button", null, "Share");
  minus.setAttribute("aria-label", "Smaller text"); plus.setAttribute("aria-label", "Larger text");
  tools.append(minus, plus, share);
  if (p.u) { const o = el("a", null, "Original ↗"); o.href = p.u; o.target = "_blank"; o.rel = "noopener"; tools.append(o); }
  head.append(tools);
  const body = el("div", "post-body" + (form === "Poem" || p.v ? " poem" : ""));
  body.lang = "ml";
  body.append(el("p", "loading", "…"));
  main.replaceChildren(head, body);

  // text size, remembered
  const KEY = "wr-size";
  let size = 1;
  try { size = +localStorage.getItem(KEY) || 1; } catch {}
  const setSize = (v) => { size = Math.min(1.5, Math.max(.85, v)); body.style.fontSize = size + "em"; try { localStorage.setItem(KEY, size); } catch {} };
  setSize(size);
  minus.onclick = () => setSize(size - .1);
  plus.onclick = () => setSize(size + .1);
  share.onclick = async () => {
    const data = { title: p.t, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(location.href); share.textContent = "Link copied"; setTimeout(() => (share.textContent = "Share"), 1800); }
    } catch { /* cancelled */ }
  };

  try {
    const r = await fetch(`posts/${p.f}.json`);
    const data = await r.json();
    body.replaceChildren(...data.body.map((line) => el("p", null, line)));
  } catch {
    body.replaceChildren(el("p", "loading", "Couldn't load this piece — check your connection and reload."));
  }

  // earlier / later, and a few related pieces
  const prev = chrono[i - 1], next = chrono[i + 1];
  const nav = el("nav", "post-nav");
  for (const [q, dir, cls] of [[prev, "← Earlier", "prev"], [next, "Later →", "next"]]) {
    const a = el("a", cls);
    if (q) { a.href = link(q); a.append(el("span", "dir", dir), el("span", "t", q.t)); } else a.style.visibility = "hidden";
    nav.append(a);
  }
  const tags = (p.tags || []).filter((t) => !FORM[t]);
  const related = chrono.filter((q) => q.s !== p.s && q.tags.some((t) => tags.includes(t)))
    .sort((a, b) => Math.abs(new Date(a.d) - new Date(p.d)) - Math.abs(new Date(b.d) - new Date(p.d))).slice(0, 4);
  const tail = [nav];
  if (related.length) {
    const rel = el("section", "post-related");
    rel.append(el("div", "k", "Also about " + tags.slice(0, 2).join(", ")));
    for (const q of related) {
      const a = el("a"); a.href = link(q);
      a.append(el("span", "t", q.t), el("span", "x", q.x));
      rel.append(a);
    }
    tail.push(rel);
  }
  const back = el("p", "post-back"); const b = el("a", null, "← All writings"); b.href = "writings.html"; back.append(b);
  tail.push(back);
  main.append(...tail);

  // reading progress
  const bar = el("div", "read-bar"); document.body.append(bar);
  const onScroll = () => {
    const r = body.getBoundingClientRect();
    const total = r.height - window.innerHeight * .6;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, -r.top / Math.max(total, 1)))})`;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
