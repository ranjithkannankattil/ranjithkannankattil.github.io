// Radio Velvet settings on the website (same choices as the app): colour theme (15, each light and dark),
// light / dark / follow the phone, text size, station spacing, the visualiser, and "Request a station".
// Stored on this device only (localStorage "rv-settings"). The defaults leave the page exactly as it was.
(() => {
  const THEMES = [
    // id, name, Malayalam, English, group, bg, ink, soft, accent, bar, barInk, highlight
    ["velvet", "Velvet", "", "Velvet", "Elegant", "#F0EDE6", "#2A1424", "#6A6266", "#6B2D5C", "#2A1424", "#F1E9EE", "#C9A86A"],
    ["nilavu", "Nilavu", "നിലാവ്", "Moonlight", "Elegant", "#EEF0F4", "#14203A", "#5E6577", "#2B4C8C", "#14203A", "#EEF0F4", "#D8C29A"],
    ["kaavu", "Kaavu", "കാവ്", "Sacred grove", "Elegant", "#EEF2EC", "#12321F", "#5B6A60", "#1F6B45", "#12321F", "#EEF2EC", "#C9A86A"],
    ["mashi", "Mashi", "മഷി", "Ink", "Elegant", "#F5F3EE", "#111111", "#5F5F5F", "#111111", "#111111", "#F5F3EE", "#C9A86A"],
    ["kasavu", "Kasavu", "കസവ്", "Golden border", "Elegant", "#FBF7EC", "#3A2E1A", "#6E6452", "#9A6B16", "#FBF7EC", "#3A2E1A", "#C99A2E"],
    ["manju", "Manju", "മഞ്ഞ്", "Mist", "Subtle", "#F1F3F4", "#2E3A40", "#6B767B", "#5D7480", "#DDE3E6", "#2E3A40", "#8FA6B2"],
    ["chandanam", "Chandanam", "ചന്ദനം", "Sandalwood", "Subtle", "#F6F0E7", "#3E3226", "#7A6D5E", "#9C7A57", "#E9DDCC", "#3E3226", "#B89470"],
    ["aambal", "Aambal", "ആമ്പൽ", "Water lily", "Subtle", "#F7F1F3", "#3D2A33", "#7A6A71", "#A0687F", "#EBDDE3", "#3D2A33", "#C79AAE"],
    ["kaayal", "Kaayal", "കായൽ", "Backwaters", "Subtle", "#EFF4F2", "#22372F", "#66776F", "#4F7F6E", "#DCE7E2", "#22372F", "#86A99B"],
    ["mazha", "Mazha", "മഴ", "Rain", "Subtle", "#F0F1F3", "#262B33", "#6B707A", "#5A6372", "#DADDE3", "#262B33", "#8C95A6"],
    ["ila", "Ila", "ഇല", "Leaf", "Vibrant", "#F2F8EE", "#123B1C", "#4E6B55", "#1E9E45", "#1E9E45", "#FFFFFF", "#FFC21A"],
    ["sandhya", "Sandhya", "സന്ധ്യ", "Dusk", "Vibrant", "#FFF3EF", "#3B1220", "#7A5560", "#E8454F", "#C2185B", "#FFFFFF", "#FFB347"],
    ["kadal", "Kadal", "കടൽ", "Sea", "Vibrant", "#EEF9F9", "#0B3440", "#4E6E75", "#0FA3A8", "#0B6E8A", "#FFFFFF", "#FFD43B"],
    ["maambazham", "Maambazham", "മാമ്പഴം", "Ripe mango", "Vibrant", "#FFF8E6", "#3D2400", "#7A6440", "#F08A00", "#F2A900", "#3D2400", "#D9480F"],
    ["peeli", "Peeli", "പീലി", "Peacock feather", "Vibrant", "#EEF5F8", "#0D2340", "#566577", "#0E7C86", "#1B3A8C", "#FFFFFF", "#2EC4B6"],
  ].map(([id, name, ml, en, group, bg, ink, soft, accent, bar, barInk, hi]) => ({ id, name, ml, en, group, bg, ink, soft, accent, bar, barInk, hi }));

  // ---- colour maths (the same as the app's Palettes, so both look alike)
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const toHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const lum = (c) => { const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const W = [1, 1, 1], K = [0, 0, 0];
  function palette(t, dark) {
    const bg = hex(t.bg), ink = hex(t.ink), soft = hex(t.soft), acc = hex(t.accent), barInk = hex(t.barInk), hi = hex(t.hi);
    let bar = hex(t.bar);
    for (let i = 1; contrast(barInk, bar) < 4.5 && i <= 20; i++) bar = mix(hex(t.bar), lum(barInk) > 0.5 ? K : W, i / 20);
    if (!dark) {
      let accText = acc;
      for (let i = 1; contrast(accText, bg) < 4.5 && i <= 10; i++) accText = mix(acc, ink, i / 10);
      return { paper: bg, paper2: mix(bg, ink, 0.06), ink, inkSoft: mix(soft, ink, 0.35), accent: accText, accentSoft: mix(bg, acc, 0.12),
        line: mix(bg, ink, 0.18), bar, barInk, barSoft: mix(barInk, bar, 0.3), gold: hi, tile: mix(bar, barInk, 0.12) };
    }
    const base = hex("#0D0C0D"), paper = mix(base, acc, 0.10);
    return { paper, paper2: mix(base, acc, 0.20), ink: mix(W, acc, 0.06), inkSoft: mix(hex("#C4C4C4"), acc, 0.12),
      accent: mix(acc, W, 0.55), accentSoft: mix(base, acc, 0.28), line: mix(base, acc, 0.30), bar: mix(base, acc, 0.18),
      barInk: mix(W, acc, 0.06), barSoft: mix(hex("#B4B4B4"), acc, 0.15), gold: hi, tile: mix(base, acc, 0.30) };
  }

  // ---- settings
  const DEF = { theme: "velvet", mode: "phone", text: 0, spacing: 0, viz: "off" };
  let S = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem("rv-settings") || "{}") }; } catch { return { ...DEF }; } })();
  if (!THEMES.some((t) => t.id === S.theme)) S.theme = "velvet";
  if (!["phone", "light", "dark"].includes(S.mode)) S.mode = "phone";
  S.text = [0, 1, 2].includes(S.text) ? S.text : 0; S.spacing = [0, 1, 2].includes(S.spacing) ? S.spacing : 0;
  if (!["bars", "waves", "circle", "off"].includes(S.viz)) S.viz = "off";
  const save = () => { try { localStorage.setItem("rv-settings", JSON.stringify(S)); } catch { /* private window: this visit only */ } };

  const sysDark = matchMedia("(prefers-color-scheme: dark)");
  const VARS = ["--paper", "--paper-2", "--ink", "--ink-soft", "--line", "--accent", "--accent-soft",
    "--rv-bar", "--rv-bar-ink", "--rv-bar-soft", "--rv-gold", "--rv-tile", "--rv-viz"];
  // the site's own colours for the Velvet theme (light and dark), so forcing light or dark matches the rest of the site
  const SITE = {
    light: { "--paper": "#F0EDE6", "--paper-2": "#E7E2D6", "--ink": "#1B1B1F", "--ink-soft": "#4A4A4C", "--line": "#C9C2B4", "--accent": "#6B2D5C", "--accent-soft": "#EEDFE8" },
    dark: { "--paper": "#141417", "--paper-2": "#1F1F24", "--ink": "#ECE8DF", "--ink-soft": "#A8A49A", "--line": "#35353C", "--accent": "#D9A0C9", "--accent-soft": "#2E1C29" },
  };
  function apply() {
    const b = document.body, st = b.style;
    const dark = S.mode === "dark" || (S.mode === "phone" && sysDark.matches);
    VARS.forEach((v) => st.removeProperty(v));
    st.removeProperty("color-scheme");
    if (S.theme === "velvet") {
      if (S.mode !== "phone") { Object.entries(SITE[dark ? "dark" : "light"]).forEach(([k, v]) => st.setProperty(k, v)); st.setProperty("color-scheme", dark ? "dark" : "light"); }
    } else {
      const p = palette(THEMES.find((t) => t.id === S.theme), dark);
      const set = { "--paper": p.paper, "--paper-2": p.paper2, "--ink": p.ink, "--ink-soft": p.inkSoft, "--line": p.line, "--accent": p.accent,
        "--accent-soft": p.accentSoft, "--rv-bar": p.bar, "--rv-bar-ink": p.barInk, "--rv-bar-soft": p.barSoft, "--rv-gold": p.gold, "--rv-tile": p.tile,
        "--rv-viz": mix(p.barInk, hex(THEMES.find((t) => t.id === S.theme).accent), 0.3) };
      Object.entries(set).forEach(([k, v]) => st.setProperty(k, toHex(v)));
      st.setProperty("color-scheme", dark ? "dark" : "light");
    }
    b.dataset.rvTheme = S.theme; b.dataset.rvDark = dark ? "1" : "0";
    b.dataset.rvSpace = String(S.spacing);
    document.documentElement.style.fontSize = S.text ? (S.text === 1 ? "115%" : "130%") : "";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(b).getPropertyValue("--paper").trim() || meta.content;
    viz.style(S.viz);
    paintPreviews();
  }
  sysDark.addEventListener("change", () => { if (S.mode === "phone") apply(); });

  // ---- visualiser: a gentle animation that follows play / pause (browsers can't read most stations' sound)
  const viz = (() => {
    let cv = null, raf = 0, style = "off", t = 0, lv = new Array(32).fill(0.04), last = 0;
    const audio = document.getElementById("audio");
    const playing = () => audio && !audio.paused && !audio.ended && audio.readyState > 2;
    function frame(now) {
      raf = 0;
      if (!cv || style === "off") return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now; t += dt;
      const on = playing();
      const W = cv.clientWidth, H = cv.clientHeight, dpr = devicePixelRatio || 1;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const cs = getComputedStyle(cv);
      const fg = cs.getPropertyValue("--rv-viz").trim() || "#D9A9CB", gold = cs.getPropertyValue("--rv-gold").trim() || "#C9A86A";
      lv = lv.map((v, i) => { const target = on ? (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.1 + i * 0.45)) * (0.6 + 0.4 * Math.cos(t * 1.3 + i * 0.17))) * (1 - i / 51) : 0.04;
        return v + (target - v) * (on ? 0.35 : 0.08); });
      if (style === "bars") {
        const w = W / lv.length;
        lv.forEach((v, i) => { g.fillStyle = i % 7 === 3 ? gold : fg; g.globalAlpha = 0.55 + 0.45 * v; const h = H * (0.08 + 0.92 * v); g.fillRect(i * w + w * 0.19, H - h, w * 0.62, h); });
      } else if (style === "waves") {
        [[1, 0, fg, 2], [0.6, 1.6, gold, 1.3]].forEach(([sc, ph, c, lw]) => {
          g.beginPath(); g.strokeStyle = c; g.lineWidth = lw; g.globalAlpha = 0.9;
          for (let s = 0; s <= 96; s++) { const x = W * s / 96, a = lv[Math.floor(s * 31 / 96)] * H * 0.42 * sc, y = H / 2 + a * Math.sin(s / 96 * Math.PI * 6 + t * 2.4 + ph);
            s ? g.lineTo(x, y) : g.moveTo(x, y); }
          g.stroke(); });
      } else {
        const cx = W / 2, cy = H / 2, r0 = Math.min(W, H) * 0.28, n = 64;
        g.lineWidth = 2; g.lineCap = "round";
        for (let k = 0; k < n; k++) { const v = lv[k % 32], a = k / n * Math.PI * 2 - Math.PI / 2, r1 = r0 + v * Math.min(W, H) * 0.2;
          g.strokeStyle = k % 8 === 3 ? gold : fg; g.globalAlpha = 0.5 + 0.5 * v; g.beginPath(); g.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)); g.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)); g.stroke(); }
      }
      g.globalAlpha = 1;
      if (!document.hidden) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && cv && style !== "off" && !document.hidden) raf = requestAnimationFrame(frame); };
    document.addEventListener("visibilitychange", kick);
    return {
      style(s) {
        style = s;
        const player = document.getElementById("player");
        if (!player) return;
        if (s === "off") { if (cv) { cv.remove(); cv = null; } return; }
        if (!cv) { cv = document.createElement("canvas"); cv.className = "rv-viz"; cv.setAttribute("aria-hidden", "true"); player.prepend(cv); }
        cv.dataset.style = s; last = 0; kick();
      },
    };
  })();

  // ---- the Settings panel and the request form, inside Info
  const info = document.getElementById("infoView");
  function radios(name, opts, cur, on) {
    const box = document.createElement("div"); box.className = "rv-seg"; box.setAttribute("role", "radiogroup");
    opts.forEach(([v, label]) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label;
      b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(v === cur));
      b.onclick = () => { on(v); box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b))); };
      box.append(b);
    });
    box.setAttribute("aria-label", name);
    return box;
  }
  /** Colour the little preview boxes for light or dark, whichever is showing now. */
  function paintPreviews(root) {
    const dark = S.mode === "dark" || (S.mode === "phone" && sysDark.matches);
    (root || document).querySelectorAll(".rv-theme[data-theme]").forEach((b) => {
      const t = THEMES.find((x) => x.id === b.dataset.theme), p = palette(t, dark), c = (v) => toHex(v);
      const goldOnBar = contrast(p.gold, p.bar) >= 2.6 ? p.gold : p.barInk;
      const set = (sel, prop, v) => b.querySelectorAll(sel).forEach((e) => { e.style[prop] = c(v); });
      set(".pv", "background", p.paper); set(".pv", "borderColor", p.line);
      set(".pv-h i", "background", dark ? p.gold : p.ink); set(".pv-h b", "background", p.ink); set(".pv-tab", "background", p.accent);
      set(".pv-r i", "background", p.ink); set(".pv-r.on i", "background", p.accent); set(".pv-r b", "background", p.inkSoft);
      set(".pv-r", "borderColor", p.line); set(".pv-r.on u", "background", p.gold); set(".pv-r s", "borderColor", p.inkSoft);
      set(".pv-r.on s", "background", p.accent);
      set(".pv-bar", "background", p.bar); set(".pv-bar i", "background", goldOnBar); set(".pv-bar b", "background", p.barInk);
      set(".pv-bar s", "borderColor", goldOnBar);
    });
  }

  function settingsSection() {
    const sec = document.createElement("div"); sec.className = "iv-sec rv-settings"; sec.id = "settings";
    sec.innerHTML = '<h2 class="iv-h">Settings</h2><p class="iv-sub">Saved on this device. The app has the same choices.</p>';
    const row = (label, el) => { const d = document.createElement("div"); d.className = "rv-row"; const h = document.createElement("h3"); h.textContent = label; d.append(h, el); sec.append(d); };
    row("Appearance", radios("Appearance", [["phone", "Phone"], ["light", "Light"], ["dark", "Dark"]], S.mode, (v) => { S.mode = v; save(); apply(); }));
    const grid = document.createElement("div"); grid.className = "rv-themes"; grid.setAttribute("role", "radiogroup"); grid.setAttribute("aria-label", "Colour theme");
    let group = "";
    THEMES.forEach((t) => {
      if (t.group !== group) { group = t.group; const g = document.createElement("p"); g.className = "rv-group"; g.textContent = group; grid.append(g); }
      const b = document.createElement("button"); b.type = "button"; b.className = "rv-theme"; b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(t.id === S.theme));
      // a tiny version of the page in this theme: header, three stations (one playing), the player bar
      b.innerHTML = '<span class="pv" aria-hidden="true"><span class="pv-h"><i></i><b></b></span><span class="pv-tab"></span>' +
        '<span class="pv-r on"><u></u><i></i><b></b><s></s></span><span class="pv-r"><u></u><i></i><b></b><s></s></span><span class="pv-r"><u></u><i></i><b></b><s></s></span>' +
        '<span class="pv-bar"><i></i><b></b><s></s></span></span><span class="nm"></span><span class="ml" lang="ml"></span><span class="en"></span>';
      b.dataset.theme = t.id;
      b.querySelector(".nm").textContent = t.name; b.querySelector(".ml").textContent = t.ml; b.querySelector(".en").textContent = t.en !== t.name ? `(${t.en})` : "";
      b.onclick = () => { S.theme = t.id; save(); apply(); grid.querySelectorAll(".rv-theme").forEach((x) => x.setAttribute("aria-checked", String(x === b))); };
      grid.append(b);
    });
    paintPreviews(grid);
    row("Colour theme", grid);
    row("Text size", radios("Text size", [[0, "Normal"], [1, "Large"], [2, "Extra large"]], S.text, (v) => { S.text = v; save(); apply(); }));
    row("Station list", radios("Station list spacing", [[0, "Compact"], [1, "Comfortable"], [2, "Spacious"]], S.spacing, (v) => { S.spacing = v; save(); apply(); }));
    const vz = document.createElement("div");
    vz.append(radios("Visualiser", [["bars", "Bars"], ["waves", "Waves"], ["circle", "Circle"], ["off", "Off"]], S.viz, (v) => { S.viz = v; save(); apply(); }));
    const note = document.createElement("p"); note.className = "iv-sub";
    note.textContent = "Shown in the player. On the website it's a gentle animation that follows play and pause: most stations don't let browsers read their sound. In the app it moves with the music.";
    vz.append(note);
    row("Visualiser", vz);
    const p = document.createElement("p"); p.className = "iv-sub";
    p.textContent = "Equaliser and alarm are in the Android app. The website keeps its own fonts.";
    sec.append(p);
    const reset = document.createElement("button"); reset.type = "button"; reset.className = "rv-link"; reset.textContent = "Reset to the original look";
    reset.onclick = () => { S = { ...DEF }; save(); apply(); sec.replaceWith(settingsSection()); };
    sec.append(reset);
    return sec;
  }

  function requestSection() {
    const sec = document.createElement("div"); sec.className = "iv-sec rv-request"; sec.id = "request";
    sec.innerHTML = `<h2 class="iv-h">Request a station</h2>
      <p>Missing a station you love? Tell us and we'll try to add it.</p>
      <form novalidate>
        <label><span>Station name</span><input name="name" maxlength="80" required placeholder="e.g. Radio Macfast 90.4" autocomplete="off"></label>
        <label><span>City / country</span><input name="place" maxlength="80" placeholder="e.g. Changanassery, Kerala" autocomplete="off"></label>
        <label><span>Link (if you know it)</span><input name="link" maxlength="300" type="url" inputmode="url" placeholder="https://…" autocomplete="off"></label>
        <label><span>Anything else</span><textarea name="note" maxlength="300" rows="2" placeholder="e.g. it plays old film songs"></textarea></label>
        <button type="submit">Send request</button>
        <p class="iv-sub">Only Ranjith reads requests. No name or email needed.</p>
        <p class="rv-msg" role="status" aria-live="polite"></p>
      </form>`;
    const f = sec.querySelector("form"), msg = sec.querySelector(".rv-msg"), btn = f.querySelector("button");
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f).entries());
      if (String(v.name || "").trim().length < 2) { msg.textContent = "Please type the station's name."; f.name.focus(); return; }
      const R = window.RadioRatings;
      if (!R || !R.request) { msg.textContent = "Couldn't connect. Please try again in a moment."; return; }
      btn.disabled = true; btn.textContent = "Sending…"; msg.textContent = "";
      try {
        await R.request({ name: v.name, place: v.place, link: v.link, note: v.note });
        f.reset(); msg.textContent = "◆ Thank you! Sent. New stations usually appear within a few days.";
      } catch (err) {
        msg.textContent = err && err.code === "too-fast" ? "Please wait a minute before sending another." : "Couldn't send. Check the internet and try again.";
      } finally { btn.disabled = false; btn.textContent = "Send request"; }
    };
    return sec;
  }

  if (info) {
    const credits = [...info.querySelectorAll(".iv-sec")].pop();
    info.insertBefore(settingsSection(), credits);
    info.insertBefore(requestSection(), credits);
  }
  // the ⚙ button by the title opens Info at Settings
  const head = document.querySelector(".radio-head");
  if (head) {
    const b = document.createElement("button"); b.type = "button"; b.className = "rv-gear"; b.setAttribute("aria-label", "Settings: colours, text size, visualiser");
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg><span>Settings</span>';
    b.onclick = () => { const t = document.getElementById("tabInfo"); if (t) t.click(); setTimeout(() => { const s = document.getElementById("settings"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); };
    head.append(b);
  }
  apply();
  window.RadioSettings = { THEMES, palette: (id, dark) => palette(THEMES.find((t) => t.id === id), dark), contrast: (a, b) => contrast(hex(a), hex(b)), get: () => ({ ...S }) };
})();
