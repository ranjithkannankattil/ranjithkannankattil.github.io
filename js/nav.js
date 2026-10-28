// Header navigation: Home plus two small menus (Creative, Tools), shared by every page.
// Each page keeps <nav class="tabs" data-root="" data-active="writings"></nav>;
// data-root is the path back to the site root ("" or "../"), data-active the current page.
(function () {
  // Productivity tools, listed straight in the Tools menu. Keep in step with js/tools.js.
  const PRODUCTIVITY = [
    { id: "meeting", label: "Meeting time finder", href: "productivity/meeting.html" },
    { id: "timeline", label: "Timeline & Gantt", href: "productivity/timeline.html" },
    { id: "raci", label: "RACI matrix", href: "productivity/raci.html" },
    { id: "pdf", label: "PDF toolkit", href: "productivity/pdf.html" },
    { id: "passport", label: "Passport photo maker", href: "productivity/passport.html" },
    { id: "units", label: "Oil & gas units", href: "productivity/units.html" },
    { id: "map", label: "Map colourer", href: "productivity/map.html" },
    { id: "keyboard", label: "Malayalam keyboard", href: "productivity/keyboard.html" },
  ];
  // which productivity tool is open, if any (from <main data-tool="…">)
  const toolHere = (document.querySelector("main[data-tool]") || {}).dataset?.tool;

  const NAV = [
    { id: "home", label: "Home", href: "index.html" },
    { label: "Creative", items: [
      { id: "writings", label: "Writings", desc: "Malayalam prose and poetry", href: "writings.html" },
      { id: "photography", label: "Photography", desc: "Street photography", href: "photography/" },
      { id: "publications", label: "Publications", desc: "Three books and a paper", href: "publications.html" },
      { id: "padolpathi", label: "Padolpathi", desc: "Where Malayalam words come from", href: "padolpathi/" },
    ] },
    { label: "Tools", items: [
      { id: "radio", label: "Radio", desc: "2,200 live stations in 70+ languages", href: "radio.html" },
      { id: "news", label: "News", desc: "Trusted papers, world to your town", href: "news.html" },
      { id: "trip", label: "Trip planner", desc: "Day-by-day walking plans, anywhere", href: "trip.html" },
    ], sub: { id: "productivity", label: "Productivity", href: "productivity/", items: PRODUCTIVITY } },
  ];

  document.querySelectorAll("nav.tabs[data-active]").forEach((nav) => {
    const root = nav.dataset.root || "";
    const active = nav.dataset.active;
    nav.innerHTML = "";
    for (const entry of NAV) {
      if (!entry.items) {
        const a = document.createElement("a");
        a.href = root + entry.href; a.textContent = entry.label;
        if (entry.id === active) { a.className = "active"; a.setAttribute("aria-current", "page"); }
        nav.append(a);
        continue;
      }
      const here = entry.items.find((i) => i.id === active) || (entry.sub && entry.sub.id === active ? entry.sub : null);
      const d = document.createElement("details");
      d.className = "nav-group" + (here ? " active" : "");
      const s = document.createElement("summary");
      s.innerHTML = `<span></span><span class="caret" aria-hidden="true">▾</span>`;
      s.firstChild.textContent = entry.label;
      if (here) s.title = `${entry.label}: ${here.label}`;
      const menu = document.createElement("div");
      menu.className = "nav-menu";
      for (const it of entry.items) {
        const a = document.createElement("a");
        a.href = root + it.href;
        a.innerHTML = "<b></b><small></small>";
        a.firstChild.textContent = it.label;
        a.lastChild.textContent = it.desc;
        if (it.id === active) { a.className = "current"; a.setAttribute("aria-current", "page"); }
        menu.append(a);
      }
      if (entry.sub) {
        // a second column listing every productivity tool by name
        menu.classList.add("has-sub");
        const col = document.createElement("div");
        col.className = "nav-sub";
        const h = document.createElement("a");
        h.href = root + entry.sub.href; h.className = "nav-sub-h" + (active === entry.sub.id && !toolHere ? " current" : "");
        h.innerHTML = "<b></b><small>All tools →</small>"; h.firstChild.textContent = entry.sub.label;
        col.append(h);
        for (const it of entry.sub.items) {
          const a = document.createElement("a");
          a.href = root + it.href; a.textContent = it.label;
          if (it.id === toolHere) { a.className = "current"; a.setAttribute("aria-current", "page"); }
          col.append(a);
        }
        const apps = document.createElement("div");
        apps.className = "nav-apps";
        apps.append(...menu.children);
        menu.append(apps, col);
      }
      d.append(s, menu);
      nav.append(d);
    }
    // only one menu open at a time; close on outside click / Escape; open on hover with a mouse
    const groups = [...nav.querySelectorAll(".nav-group")];
    groups.forEach((g) => {
      g.addEventListener("toggle", () => { if (g.open) groups.forEach((o) => o !== g && (o.open = false)); });
      if (matchMedia("(hover: hover)").matches) {
        let t;
        g.addEventListener("mouseenter", () => { clearTimeout(t); g.open = true; });
        g.addEventListener("mouseleave", () => { t = setTimeout(() => (g.open = false), 180); });
      }
    });
    document.addEventListener("click", (e) => { if (!nav.contains(e.target)) groups.forEach((g) => (g.open = false)); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") groups.forEach((g) => (g.open = false)); });
  });
  // Floating "top / bottom" buttons on every long page.
  // Up appears once you've scrolled down a little; down hides near the end of the page.
  // Sits above any bar pinned to the bottom of the screen (e.g. the radio player).
  (function scrollButtons() {
    const box = document.createElement("div");
    box.className = "scroll-nav"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Page scroll");
    box.innerHTML =
      '<button type="button" class="sn-btn sn-up" aria-label="Back to top" title="Back to top"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14l6-6 6 6"/></svg></button>' +
      '<button type="button" class="sn-btn sn-down" aria-label="Go to bottom" title="Go to bottom"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10l6 6 6-6"/></svg></button>';
    document.body.append(box);
    const up = box.querySelector(".sn-up"), down = box.querySelector(".sn-down");
    const calm = matchMedia("(prefers-reduced-motion: reduce)");
    const go = (top) => window.scrollTo({ top, behavior: calm.matches ? "auto" : "smooth" });
    up.onclick = () => go(0);
    down.onclick = () => go(document.documentElement.scrollHeight);
    const bars = () => [...document.querySelectorAll(".radio-player")];
    let raf = 0;
    function update() {
      raf = 0;
      const doc = document.documentElement, vh = window.innerHeight, y = window.scrollY;
      const long = doc.scrollHeight > vh * 1.6;
      up.classList.toggle("on", long && y > Math.min(600, vh * 0.6));
      down.classList.toggle("on", long && doc.scrollHeight - (y + vh) > Math.min(600, vh * 0.6));
      let lift = 0;
      bars().forEach((b) => { if (!b.hidden && getComputedStyle(b).display !== "none") lift = Math.max(lift, b.getBoundingClientRect().height); });
      box.style.setProperty("--sn-lift", lift + "px");
    }
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    new ResizeObserver(queue).observe(document.body);                       // content loading in later
    bars().forEach((b) => new MutationObserver(queue).observe(b, { attributes: true, attributeFilter: ["hidden", "style", "class"] }));
    update();
  })();

  // offline shell + "Add to Home Screen" (see /sw.js)
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
})();
