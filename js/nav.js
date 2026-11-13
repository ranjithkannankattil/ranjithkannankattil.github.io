// Header navigation: Hello plus three menus (Words & Pictures, Daily Life, Workbench), shared by every page.
// Each page keeps <nav class="tabs" data-root="" data-active="writings"></nav>;
// data-root is the path back to the site root ("" or "../"), data-active the current page.
(function () {
  // Workbench (productivity) tools, the Workbench menu. Keep in step with js/tools.js.
  const PRODUCTIVITY = [
    { id: "meeting", label: "Meeting time finder", desc: "Time zones and working hours", href: "productivity/meeting.html" },
    { id: "timeline", label: "Timeline & Gantt", desc: "Plans to Excel, PDF or image", href: "productivity/timeline.html" },
    { id: "raci", label: "RACI matrix", desc: "Who does what, at a glance", href: "productivity/raci.html" },
    { id: "orgchart", label: "Org chart generator", desc: "Table to PowerPoint or Word", href: "productivity/orgchart.html" },
    { id: "pdf", label: "PDF toolkit", desc: "Merge, split, sign, OCR", href: "productivity/pdf.html" },
    { id: "passport", label: "Passport photo maker", desc: "Visa photos and print sheets", href: "productivity/passport.html" },
    { id: "units", label: "Oil & gas units", desc: "LNG, gas, oil and energy", href: "productivity/units.html" },
    { id: "map", label: "Map colourer", desc: "Colour countries and regions", href: "productivity/map.html" },
    { id: "keyboard", label: "Malayalam keyboard", desc: "Malayalam typing on iPhone", href: "productivity/keyboard.html" },
    { id: "scholarships", label: "Scholarship finder", desc: "Study abroad funding for Indians", href: "productivity/scholarships.html" },
    { id: "internships", label: "Internship finder", desc: "Govt, PSU and private, by your course", href: "productivity/internships.html" },
  ];
  // which productivity tool is open, if any (from <main data-tool="…">)
  const toolHere = (document.querySelector("main[data-tool]") || {}).dataset?.tool;

  const NAV = [
    { id: "home", label: "Hello", href: "index.html" },
    { label: "Words & Pictures", items: [
      { id: "writings", label: "Writings", desc: "Malayalam prose and poetry", href: "writings.html" },
      { id: "photography", label: "Photography", desc: "Street photography", href: "photography/" },
      { id: "publications", label: "Publications", desc: "Three books and a paper", href: "publications.html" },
      { id: "padolpathi", label: "Padolpathi", desc: "Where Malayalam words come from", href: "padolpathi/" },
    ] },
    { label: "Daily Life", items: [
      { id: "radio", label: "Radio", desc: "5,000+ live stations in 70+ languages", href: "radio.html" },
      { id: "trip", label: "Trip planner", desc: "Day-by-day walking plans, anywhere", href: "trip.html" },
      { id: "expat", label: "Expat Life Saver", desc: "City guides: permits, homes, health, people", href: "expat/" },
      { id: "movies", label: "Movies", desc: "Any film, every rating, what to watch next", href: "movies.html" },
      { id: "cinema", label: "English Cinema in Italy", desc: "Original-version films, times and booking", href: "expats/cinema.html" },
    ] },
    { label: "Workbench", hub: { id: "productivity", label: "All workbench tools →", href: "productivity/" }, items: PRODUCTIVITY },
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
      const here = entry.items.find((i) => i.id === active || (entry.hub && i.id === toolHere)) || (entry.hub && entry.hub.id === active ? entry.hub : null);
      const d = document.createElement("details");
      d.className = "nav-group" + (here ? " active" : "");
      const s = document.createElement("summary");
      s.innerHTML = `<span></span><span class="caret" aria-hidden="true">▾</span>`;
      s.firstChild.textContent = entry.label;
      if (here) s.title = `${entry.label}: ${here.label}`;
      const menu = document.createElement("div");
      menu.className = "nav-menu" + (entry.hub ? " nav-menu-2" : "");
      if (entry.hub) {
        const h = document.createElement("a");
        h.href = root + entry.hub.href; h.className = "nav-hub" + (active === entry.hub.id && !toolHere ? " current" : "");
        h.textContent = entry.hub.label;
        menu.append(h);
      }
      for (const it of entry.items) {
        const a = document.createElement("a");
        a.href = root + it.href;
        a.innerHTML = "<b></b><small></small>";
        a.firstChild.textContent = it.label;
        a.lastChild.textContent = it.desc || "";
        if (it.id === active || (entry.hub && it.id === toolHere)) { a.className = "current"; a.setAttribute("aria-current", "page"); }
        menu.append(a);
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
  // Phones: one "Menu" button that opens a full-screen panel listing every section at once
  // (the dropdowns are hidden under 600px by css/style.css). Built from the same NAV list.
  (function mobileMenu() {
    const nav = document.querySelector("nav.tabs[data-active]");
    if (!nav) return;
    const root = nav.dataset.root || "";
    const active = nav.dataset.active;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "mnav-btn";
    btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "mnav");
    btn.innerHTML = '<span class="mnav-bars" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span>';
    nav.append(btn);

    const sheet = document.createElement("div");
    sheet.id = "mnav"; sheet.className = "mnav"; sheet.hidden = true;
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Site menu");
    const link = (href, label, desc, cls) => {
      const a = document.createElement("a");
      a.href = root + href; a.className = cls || "";
      a.innerHTML = "<b></b>" + (desc ? "<small></small>" : "");
      a.firstChild.textContent = label;
      if (desc) a.lastChild.textContent = desc;
      return a;
    };
    const head = document.createElement("div");
    head.className = "mnav-head";
    head.innerHTML = '<span>Ranjith Kannankattil</span><button type="button" class="mnav-close" aria-label="Close menu">✕</button>';
    sheet.append(head);
    const body = document.createElement("div");
    body.className = "mnav-body";
    const homeA = link("index.html", "Hello", "", "mnav-home");
    if (active === "home") homeA.setAttribute("aria-current", "page");
    body.append(homeA);
    const section = (title, items, grid) => {
      const s = document.createElement("section");
      s.className = "mnav-sec" + (grid ? " mnav-grid" : "");
      const h = document.createElement("h2"); h.textContent = title; s.append(h);
      const list = document.createElement("div"); list.className = "mnav-list";
      items.forEach((it) => {
        const a = link(it.href, it.label, grid ? "" : it.desc);
        if (it.id === active || it.id === toolHere) a.setAttribute("aria-current", "page");
        list.append(a);
      });
      s.append(list);
      return s;
    };
    NAV.filter((e) => e.items).forEach((e) => {
      const sec = section(e.label, e.items, true);
      if (e.hub) {
        const all = link(e.hub.href, e.hub.label, "", "mnav-all");
        if (active === e.hub.id && !toolHere) all.setAttribute("aria-current", "page");
        sec.querySelector("h2").after(all);
      }
      body.append(sec);
    });
    sheet.append(body);
    document.body.append(sheet);

    const open = (yes) => {
      sheet.hidden = !yes;
      btn.setAttribute("aria-expanded", String(yes));
      document.documentElement.classList.toggle("mnav-open", yes);
      if (yes) { sheet.scrollTop = 0; (sheet.querySelector('[aria-current="page"]') || sheet.querySelector(".mnav-close")).focus({ preventScroll: true }); }
      else btn.focus({ preventScroll: true });
    };
    btn.addEventListener("click", () => open(true));
    sheet.querySelector(".mnav-close").addEventListener("click", () => open(false));
    sheet.addEventListener("click", (e) => { if (e.target.closest("a")) open(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) open(false); });
    addEventListener("pageshow", () => { if (!sheet.hidden) open(false); });   // back button from a page opened via the menu
  })();

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
    const bars = () => [...document.querySelectorAll(".radio-player, .radio-tabs")];
    let raf = 0;
    function update() {
      raf = 0;
      const doc = document.documentElement, vh = window.innerHeight, y = window.scrollY;
      const long = doc.scrollHeight > vh * 1.6;
      up.classList.toggle("on", long && y > Math.min(600, vh * 0.6));
      down.classList.toggle("on", long && doc.scrollHeight - (y + vh) > Math.min(600, vh * 0.6));
      let lift = 0;
      // keep clear of anything fixed to the bottom (the Radio player bar and, on phones, its tab bar)
      bars().forEach((b) => { const cs = getComputedStyle(b); if (!b.hidden && cs.display !== "none" && cs.position === "fixed") lift = Math.max(lift, vh - b.getBoundingClientRect().top); });
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
