/* ============================================================
   TOOL — Timeline & Gantt  (productivity/timeline.html)
   One model (P), one SVG renderer shared by the screen and every
   export, and an editable task list beside it. Dates are whole days
   since 1970-01-01 (UTC) so daylight saving never nudges a bar.
   Excel and PDF libraries load only when someone downloads.
   ============================================================ */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DAY = 864e5, ROW = 32, HEAD = 48;
  const PAL = ['#5C4D7D', '#2E6FAD', '#1F8A70', '#C98A1B', '#C2463D', '#2B8FA3', '#8E5BB5', '#6B7A2E', '#C25E8A', '#5F6B7A'];
  const SHAPES = ['diamond', 'circle', 'triangle', 'star', 'flag'];
  const MON = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
  const ZOOM = { day: 28, week: 10, month: 3.3, quarter: 1.05, year: 0.32 };
  const LIBS = { exceljs: '../js/vendor/exceljs-4.4.0.min.js', jspdf: '../js/vendor/jspdf-2.5.2.min.js' };
  const PAPER = { a4: [297, 210], a3: [420, 297], letter: [279.4, 215.9], tabloid: [431.8, 279.4] };
  const DEF_OPT = { deps: true, crit: false, prog: true, labels: true, today: true, wkend: true, work: false, auto: true, bar: 'solid' };
  const BARS = ['solid', 'outline', 'striped', 'thin', 'arrow'];
  const BAR_NAME = { solid: 'Solid', outline: 'Outline', striped: 'Striped', thin: 'Thin line', arrow: 'Arrow' };
  // link kinds: which end of the predecessor drives which end of this row
  const KINDS = ['FS', 'SS', 'FF', 'SF'];
  const KIND_TXT = { FS: 'starts after it finishes', SS: 'starts when it starts', FF: 'finishes when it finishes', SF: 'finishes when it starts' };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const f1 = (n) => Math.round(n * 10) / 10;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  /* ---------------- dates ---------------- */
  const ymd = (y, m, d) => Date.UTC(y, m, d) / DAY;
  const iso2n = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? ymd(+m[1], m[2] - 1, +m[3]) : null; };
  const n2iso = (n) => (n == null ? '' : new Date(n * DAY).toISOString().slice(0, 10));
  const parts = (n) => { const d = new Date(n * DAY); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };
  const today = () => { const t = new Date(); return ymd(t.getFullYear(), t.getMonth(), t.getDate()); };
  const dow = (n) => (((n + 3) % 7) + 7) % 7;            // 0 = Monday (1 Jan 1970 was a Thursday)
  const weekend = (n) => dow(n) > 4;
  const fmtD = (n, year) => { if (n == null) return ''; const [y, m, d] = parts(n); return d + ' ' + MON[m] + (year ? ' ' + y : ''); };
  const fmtRange = (s, e) => {
    if (s == null) return '';
    if (e == null || e === s) return fmtD(s, true);
    return fmtD(s, parts(s)[0] !== parts(e)[0]) + ' – ' + fmtD(e, true);
  };
  const work = () => P.opt.work;
  function days(s, e) {
    if (s == null || e == null) return null;
    if (!work()) return e - s + 1;
    const w = Math.floor((e - s + 1) / 7); let n = w * 5;
    for (let d = s + w * 7; d <= e; d++) if (!weekend(d)) n++;
    return n;
  }
  function endFor(s, n) {
    n = Math.max(1, Math.round(n));
    if (!work()) return s + n - 1;
    let d = s, c = weekend(s) ? 0 : 1;
    while (c < n) { d++; if (!weekend(d)) c++; }
    return d;
  }
  const nextWork = (d) => { while (work() && weekend(d)) d++; return d; };

  /* ---------------- model ---------------- */
  let P, pid, sel = null, undoS = [], redoS = [], last = '';
  let S = null;            // structure: byId, idx, par (task → phase), kids, gi (phase order)
  let V = [], RG = [0, 1], lastPpd = null;
  const xopt = { paper: 'a4', dates: true, owner: false, done: false };

  const blank = (title) => ({ title: title || 'Untitled timeline', opt: { ...DEF_OPT }, ppd: ZOOM.week, rows: [] });
  const mk = (t, n, s, e, x) => ({ id: uid(), t, n: n || '', s: s ?? null, e: t === 'ms' ? (s ?? null) : (e ?? null), p: 0, o: '', c: null, dep: [], ...(x || {}) });

  function struct() {
    const byId = new Map(), idx = new Map(), par = new Map(), kids = new Map(), gi = new Map();
    let g = null, k = 0;
    P.rows.forEach((r, i) => {
      byId.set(r.id, r); idx.set(r.id, i);
      if (r.t === 'group') { g = r; kids.set(r.id, []); gi.set(r.id, k++); }
      else if (g) { par.set(r.id, g); kids.get(g.id).push(r); }
    });
    S = { byId, idx, par, kids, gi };
  }
  function eff(r) {        // phases summarise their tasks
    if (r.t !== 'group') return r;
    let s = null, e = null, w = 0, pw = 0;
    for (const k of S.kids.get(r.id) || []) {
      if (k.s == null) continue;
      const ke = k.e ?? k.s;
      s = s == null ? k.s : Math.min(s, k.s); e = e == null ? ke : Math.max(e, ke);
      if (k.t === 'task') { const d = ke - k.s + 1; w += d; pw += d * (k.p || 0); }
    }
    return { s, e, p: w ? Math.round(pw / w) : 0 };
  }
  function colour(r) {
    if (r.c) return r.c;
    const g = r.t === 'group' ? r : S.par.get(r.id);
    if (g) return g.c || PAL[S.gi.get(g.id) % PAL.length];
    return PAL[0];
  }
  function visible() {
    const out = []; let hide = false;
    P.rows.forEach((r, i) => {
      if (r.t === 'group') { hide = !!r.col; out.push({ r, i, lvl: 0 }); }
      else if (!(hide && S.par.has(r.id))) out.push({ r, i, lvl: S.par.has(r.id) ? 1 : 0 });
    });
    return out;
  }
  function bounds() {
    let a = null, b = null;
    for (const r of P.rows) {
      if (r.t === 'group' || r.s == null) continue;
      const e = r.e ?? r.s;
      a = a == null ? r.s : Math.min(a, r.s); b = b == null ? e : Math.max(b, e);
    }
    return a == null ? null : [a, b];
  }
  const counts = () => { let t = 0, m = 0, g = 0; for (const r of P.rows) r.t === 'task' ? t++ : r.t === 'ms' ? m++ : g++; return { t, m, g }; };

  // does a (transitively) come after b?
  function dependsOn(a, b, seen = new Set()) {
    if (a === b) return true;
    if (seen.has(a.id)) return false; seen.add(a.id);
    for (const d of a.dep || []) { const p = S.byId.get(d.id); if (p && dependsOn(p, b, seen)) return true; }
    if (a.t === 'group') for (const k of S.kids.get(a.id) || []) if (dependsOn(k, b, seen)) return true;
    return false;
  }

  // move k days, counting only Mon–Fri when the timeline counts working days
  function addW(n, k) {
    if (!work() || !k) return n + k;
    let d = n, c = Math.abs(k); const st = Math.sign(k);
    while (c > 0) { d += st; if (!weekend(d)) c--; }
    return d;
  }
  // earliest start for row r that respects link d ({ id, k: FS|SS|FF|SF, l: lag in days })
  function linkStart(r, d) {
    const p = S.byId.get(d.id); if (!p) return null;
    const E = eff(p); if (E.s == null || r.s == null) return null;
    const ps = E.s, pe = p.t === 'ms' ? E.s : E.e, l = d.l || 0, span = (r.e ?? r.s) - r.s;
    switch (d.k) {
      case 'SS': { const n = addW(ps, l); return r.t === 'ms' ? n : nextWork(n); }
      case 'FF': return addW(pe, l) - span;
      case 'SF': return addW(ps, l) - span;
      default: { const n = addW(pe, (p.t === 'ms' || r.t === 'ms' ? 0 : 1) + l); return r.t === 'ms' ? n : nextWork(n); }
    }
  }
  // "3, 5SS+2, 7FF-1, 4FS+1w" -> [{ n, k, l }]
  function parseDeps(txt) {
    const out = [], rx = /(\d+)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+(?:[.,]\d+)?)\s*(e?days?|e?d|w|wks?|weeks?|ew)?)?/gi;
    let m;
    while ((m = rx.exec(String(txt || '')))) {
      let l = m[3] ? (m[3] === '-' ? -1 : 1) * parseFloat(m[4].replace(',', '.')) : 0;
      if (m[5] && /w/i.test(m[5])) l *= work() ? 5 : 7;
      out.push({ n: +m[1], k: (m[2] || 'FS').toUpperCase(), l: Math.round(l) });
    }
    return out;
  }
  function depsText(r) {
    return (r.dep || []).map((d) => {
      if (!S.idx.has(d.id)) return null;
      const k = d.k !== 'FS' || d.l ? d.k : '';
      return S.idx.get(d.id) + 1 + k + (d.l ? (d.l > 0 ? '+' : '') + d.l : '');
    }).filter(Boolean).join(', ');
  }
  const lagTxt = (l) => (l ? ` ${l > 0 ? '+' : '−'}${Math.abs(l)} ${work() ? 'working ' : ''}day${Math.abs(l) === 1 ? '' : 's'}` : '');

  // push rows later so each respects its links
  function schedule(force) {
    if (!P.opt.auto && !force) return;
    struct();
    for (let pass = 0; pass < P.rows.length + 1; pass++) {
      let moved = false;
      for (const r of P.rows) {
        if (r.t === 'group' || r.s == null || !r.dep || !r.dep.length) continue;
        let need = -Infinity;
        for (const d of r.dep) { const n = linkStart(r, d); if (n != null) need = Math.max(need, n); }
        if (need === -Infinity) continue;
        if (need > r.s) { const k = need - r.s; r.s += k; if (r.e != null) r.e += k; moved = true; }
      }
      if (!moved) break;
    }
  }

  function critical() {
    const set = new Set();
    if (!P.opt.crit) return set;
    const b = bounds(); if (!b) return set;
    const items = P.rows.filter((r) => r.t !== 'group' && r.s != null);
    for (const r of items) if ((r.e ?? r.s) === b[1]) set.add(r.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of items) {
        if (!set.has(r.id)) continue;
        for (const d of r.dep || []) {
          const p = S.byId.get(d.id);
          if (!p || set.has(p.id) || p.t === 'group' || p.s == null) continue;
          const n = linkStart(r, d);
          if (n != null && n >= r.s) { set.add(p.id); grew = true; }      // no slack on this link
        }
      }
    }
    return set;
  }

  /* ---------------- scale ---------------- */
  const tiers = (ppd) => (ppd >= 16 ? ['day', 'month'] : ppd >= 4 ? ['week', 'month'] : ppd >= 1.2 ? ['month', 'year'] : ppd >= 0.35 ? ['quarter', 'year'] : ['year', 'decade']);
  function startU(n, u) {
    const [y, m] = parts(n);
    switch (u) {
      case 'day': return n;
      case 'week': return n - dow(n);
      case 'month': return ymd(y, m, 1);
      case 'quarter': return ymd(y, m - (m % 3), 1);
      case 'year': return ymd(y, 0, 1);
      default: return ymd(y - (y % 10), 0, 1);
    }
  }
  function nextU(n, u) {
    const [y, m] = parts(n);
    switch (u) {
      case 'day': return n + 1;
      case 'week': return n + 7;
      case 'month': return ymd(y, m + 1, 1);
      case 'quarter': return ymd(y, m + 3, 1);
      case 'year': return ymd(y + 1, 0, 1);
      default: return ymd(y + 10, 0, 1);
    }
  }
  function lowLabel(t, u, w) {
    const [y, m, d] = parts(t);
    switch (u) {
      case 'day': return w >= 14 ? String(d) : '';
      case 'week': return w >= 60 ? d + ' ' + MON[m] : w >= 22 ? String(d) : '';
      case 'month': return w >= 32 ? MON[m] : w >= 11 ? MON[m][0] : '';
      case 'quarter': return w >= 22 ? 'Q' + (m / 3 + 1) : '';
      case 'year': return w >= 34 ? String(y) : w >= 22 ? "'" + String(y).slice(2) : '';
    }
    return '';
  }
  function topLabel(t, u, w) {
    const [y, m] = parts(t);
    if (u === 'month') return w >= 66 ? MON[m] + ' ' + y : MON[m];
    if (u === 'year') return String(y);
    return y + 's';
  }

  /* ---------------- text measuring ---------------- */
  const mctx = document.createElement('canvas').getContext('2d');
  const mcache = new Map();
  const F_LAB = '500 12px "Space Grotesk", Arial, sans-serif', F_GLAB = '600 12px "Space Grotesk", Arial, sans-serif', F_MONO = '400 10.5px "IBM Plex Mono", monospace';
  function tw(text, font) {
    const k = font + '|' + text; let w = mcache.get(k);
    if (w == null) { mctx.font = font; w = mctx.measureText(text).width; mcache.set(k, w); }
    return w;
  }
  function fit(text, font, w) {
    text = String(text || '');
    if (tw(text, font) <= w) return text;
    while (text && tw(text + '…', font) > w) text = text.slice(0, -1);
    return text + '…';
  }
  function labelParts(r) {
    const E = eff(r);
    if (r.t === 'ms') return [r.n, fmtD(E.s)];
    if (!P.opt.prog) return [r.n, ''];
    return [r.n, (r.t === 'task' ? r.p : E.p) ? (r.t === 'task' ? r.p : E.p) + '%' : ''];
  }
  const labelW = (r) => { const [a, b] = labelParts(r); return tw(a || '', r.t === 'group' ? F_GLAB : F_LAB) + (b ? tw(b, F_MONO) + 8 : 0); };

  function range(ppd, minW, rowsV) {
    const b = bounds() || [today() - 7, today() + 45];
    const lo = tiers(ppd)[0];
    const x0 = startU(b[0] - Math.ceil(30 / ppd), lo);
    let x1 = b[1] + 1 + Math.ceil(30 / ppd);
    if (P.opt.labels && rowsV) for (const v of rowsV) {
      const E = eff(v.r); if (E.s == null) continue;
      const end = (v.r.t === 'ms' ? E.s + 1 : E.e + 1) + Math.ceil((labelW(v.r) + 30) / ppd);
      if (end > x1) x1 = end;
    }
    if (minW) x1 = Math.max(x1, x0 + Math.ceil(minW / ppd));
    return [x0, x1];
  }

  /* ---------------- the chart (screen and exports) ---------------- */
  function shape(k, cx, cy, r, c, crit) {
    const a = `fill="${c}"${crit ? ' class="crit"' : ''}`;
    cx = f1(cx); cy = f1(cy);
    switch (k) {
      case 'circle': return `<circle cx="${cx}" cy="${cy}" r="${r - 1.5}" ${a}/>`;
      case 'triangle': return `<path d="M${cx} ${cy - r}L${f1(cx + r)} ${f1(cy + r * 0.8)}H${f1(cx - r)}Z" ${a}/>`;
      case 'star': {
        let d = '';
        for (let i = 0; i < 10; i++) { const g = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.46 : r + 1; d += (i ? 'L' : 'M') + f1(cx + rr * Math.cos(g)) + ' ' + f1(cy + rr * Math.sin(g)); }
        return `<path d="${d}Z" ${a}/>`;
      }
      case 'flag': return `<path d="M${cx - 1} ${cy - r}h2v${2 * r}h-2z" ${a}/><path d="M${cx + 1} ${cy - r}L${cx + r + 5} ${f1(cy - r / 2 + 1)}L${cx + 1} ${cy + 2}z" ${a}/>`;
      default: return `<path d="M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z" ${a}/>`;
    }
  }

  function chart(rowsV, o) {
    const { x0, x1, ppd, print } = o;
    const W = Math.round((x1 - x0) * ppd), H = HEAD + rowsV.length * ROW;
    const X = (n) => f1((n - x0) * ppd);
    const [lo, hi] = tiers(ppd);
    const mx = ppd >= 6 ? ppd / 2 : 0;
    const crit = critical();
    const at = new Map(); rowsV.forEach((v, i) => at.set(v.r.id, i));
    const out = [`<defs><marker id="ar" viewBox="0 0 6 6" refX="5.5" refY="3" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto"><path class="arw" d="M0 0L6 3L0 6z"/></marker><marker id="arc" viewBox="0 0 6 6" refX="5.5" refY="3" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto"><path class="arw c" d="M0 0L6 3L0 6z"/></marker></defs>`];
    out.push(`<rect class="bg" width="${W}" height="${H}"/>`);
    rowsV.forEach((v, i) => {
      const y = HEAD + i * ROW;
      if (v.r.t === 'group') out.push(`<rect class="band" y="${y}" width="${W}" height="${ROW}"/>`);
      if (!print && v.r.id === sel) out.push(`<rect class="selr" y="${y}" width="${W}" height="${ROW}"/>`);
    });
    if (P.opt.wkend && ppd >= 4) {
      let d = '';
      for (let n = x0 - 1; n < x1; n++) if (dow(n) === 5) d += `M${X(n)} ${HEAD}h${f1(2 * ppd)}V${H}h${f1(-2 * ppd)}Z`;
      if (d) out.push(`<path class="we" d="${d}"/>`);
    }
    // body grid
    let gl = '', gm = '', hl = '', ll = '';
    const txt = [];
    for (let t = startU(x0, hi); t < x1; t = nextU(t, hi)) {
      const a = X(t), b = X(nextU(t, hi)), xa = Math.max(a, 0), xb = Math.min(b, W);
      if (a > 0) { gm += `M${a} ${HEAD}V${H}`; hl += `M${a} 0V${HEAD}`; }
      if (xb - xa > 28) txt.push(`<text class="hy" x="${f1(xa + 6)}" y="17" data-a="${f1(xa)}" data-b="${f1(xb)}">${esc(topLabel(t, hi, b - a))}</text>`);
    }
    for (let t = startU(x0, lo); t < x1; t = nextU(t, lo)) {
      const a = X(t), b = X(nextU(t, lo)), w = b - a;
      if (a > 0) { gl += `M${a} ${HEAD}V${H}`; ll += `M${a} 24V${HEAD}`; }
      const lab = lowLabel(t, lo, w);
      if (lab && a + w / 2 > 0 && a + w / 2 < W) txt.push(`<text class="hx${lo === 'day' && weekend(t) ? ' wk' : ''}" x="${f1(a + w / 2)}" y="40" text-anchor="middle">${lab}</text>`);
    }
    out.push(`<path class="gl" d="${gl}"/><path class="gm" d="${gm}"/>`);
    let rl = ''; for (let i = 1; i <= rowsV.length; i++) rl += `M0 ${HEAD + i * ROW - 0.5}H${W}`;
    out.push(`<path class="rl" d="${rl}"/>`);

    const td = today(); let tx = null;
    if (P.opt.today && td >= x0 && td < x1) { tx = f1(X(td) + ppd / 2); out.push(`<path class="td" d="M${tx} ${HEAD}V${H}"/>`); }

    // dependencies
    if (P.opt.deps) for (const v of rowsV) {
      const r = v.r; if (r.t === 'group' || r.s == null || !r.dep || !r.dep.length) continue;
      const si = at.get(r.id);
      for (const ln of r.dep) {
        let p = S.byId.get(ln.id); if (!p) continue;
        let pi = at.get(ln.id);
        if (pi == null) { const g = S.par.get(ln.id); if (!g) continue; p = g; pi = at.get(g.id); }
        const E = eff(p); if (E.s == null || pi == null) continue;
        // leave from under the predecessor (labels sit to its right): its end for F…, its start for S…;
        // arrive at this row's start for …S, or its end for …F
        const k = ln.k || 'FS', fromEnd = k[0] === 'F', toEnd = k[1] === 'F';
        const down = si > pi, sy = HEAD + si * ROW + ROW / 2, mid = sy + (down ? -ROW / 2 : ROW / 2);
        const ex = p.t === 'ms' ? f1(X(E.s) + mx)
          : fromEnd ? (p.t === 'group' ? f1(X(E.e + 1) - 4) : f1(Math.max(X(E.s) + 3, X(E.e + 1) - 5)))
            : (p.t === 'group' ? f1(X(E.s) + 4) : f1(Math.min(X(E.e + 1) - 3, X(E.s) + 5)));
        const ey = HEAD + pi * ROW + (p.t === 'ms' ? (down ? ROW / 2 + 8 : ROW / 2 - 8) : p.t === 'group' ? (down ? 22 : 11) : down ? 25 : 7);
        let d;
        if (!toEnd) {
          const sx = r.t === 'ms' ? f1(X(r.s) + mx - 9) : X(r.s);
          d = sx >= ex + 6 ? `M${ex} ${ey}V${sy}H${f1(sx - 1)}` : `M${ex} ${ey}V${mid}H${f1(sx - 10)}V${sy}H${f1(sx - 1)}`;
        } else {
          const tx = r.t === 'ms' ? f1(X(r.s) + mx + 9) : X((r.e ?? r.s) + 1);
          d = tx <= ex - 6 ? `M${ex} ${ey}V${sy}H${f1(tx + 1)}` : `M${ex} ${ey}V${mid}H${f1(tx + 10)}V${sy}H${f1(tx + 1)}`;
        }
        const c = crit.has(r.id) && crit.has(p.id);
        out.push(`<path class="dep${c ? ' c' : ''}" d="${d}" marker-end="url(#${c ? 'arc' : 'ar'})"/>`);
      }
    }

    // bars
    const stripes = new Set();
    rowsV.forEach((v, i) => {
      const r = v.r, E = eff(r); if (E.s == null) return;
      const y = HEAD + i * ROW, c = colour(r), cr = crit.has(r.id), on = !print && r.id === sel ? ' on' : '';
      let lx;
      if (r.t === 'ms') {
        const cx = X(E.s) + mx, cy = y + ROW / 2;
        out.push(`<g class="bar ms${on}" data-id="${r.id}">${shape(r.sh, cx, cy, 8, c, cr)}${print ? '' : `<rect class="hit" x="${f1(cx - 11)}" y="${y + 4}" width="22" height="${ROW - 8}"/><circle class="cn" cx="${f1(cx + 14)}" cy="${cy}" r="4.2"/>`}</g>`);
        lx = cx + (print ? 14 : 22);
      } else if (r.t === 'group') {
        const x = X(E.s), w = Math.max(X(E.e + 1) - x, 3), by = y + 11;
        out.push(`<g class="bar grp${on}" data-id="${r.id}"><path fill="${c}" d="M${x} ${by}H${f1(x + w)}V${by + 11}L${f1(x + w - 5)} ${by + 6}H${f1(x + 5)}L${x} ${by + 11}Z"/>${print ? '' : `<rect class="hit" x="${x}" y="${y + 6}" width="${f1(w)}" height="${ROW - 12}"/>`}</g>`);
        lx = x + w + 8;
      } else {
        const bs = BARS.includes(r.bs) ? r.bs : P.opt.bar || 'solid';
        const x = X(E.s), w = Math.max(X(E.e + 1) - x, 3), thin = bs === 'thin';
        const by = thin ? y + 13 : y + 7, bh = thin ? 6 : 18, hy = y + 7, hh = 18;
        const pw = P.opt.prog ? f1((w * clamp(r.p || 0, 0, 100)) / 100) : w;
        const ccl = cr ? ' class="crit"' : '', tint = P.opt.prog ? 0.28 : 1;
        let g = `<g class="bar task${on}" data-id="${r.id}">`;
        if (bs === 'arrow') {
          const tp = Math.min(9, w / 2), body = `M${x} ${by}H${f1(x + w - tp)}L${f1(x + w)} ${by + bh / 2}L${f1(x + w - tp)} ${by + bh}H${x}Z`;
          g += `<clipPath id="k${r.id}"><path d="${body}"/></clipPath><path d="${body}" fill="${c}" fill-opacity="${tint}" stroke="${c}" stroke-opacity=".75"${ccl}/>`;
          if (P.opt.prog && pw > 0) g += `<rect x="${x}" y="${by}" width="${pw}" height="${bh}" fill="${c}" clip-path="url(#k${r.id})"/>`;
        } else {
          if (bs === 'striped') stripes.add(c);
          const fill = bs === 'outline' ? `fill="${c}" fill-opacity=".07"` : bs === 'striped' ? `fill="url(#st${c.slice(1)})"` : `fill="${c}" fill-opacity="${tint}"`;
          g += `<rect x="${f1(x + 0.5)}" y="${by + 0.5}" width="${f1(w - 1)}" height="${bh - 1}" rx="3" ${fill} stroke="${c}" stroke-opacity="${bs === 'outline' ? 1 : 0.75}" stroke-width="${bs === 'outline' ? 1.5 : 1}"${ccl}/>`;
          if (P.opt.prog && pw > 0) g += `<rect x="${x}" y="${by}" width="${pw}" height="${bh}" rx="3" fill="${c}"/>`;
        }
        if (!print) {
          const hw = Math.min(7, w / 4);
          g += `<rect class="hit mv" x="${x}" y="${hy}" width="${f1(w)}" height="${hh}"/>`;
          g += `<rect class="hit rz l" x="${f1(x - 3)}" y="${hy}" width="${f1(hw + 3)}" height="${hh}"/><rect class="hit rz r" x="${f1(x + w - hw)}" y="${hy}" width="${f1(hw + 3)}" height="${hh}"/>`;
          if (P.opt.prog) g += `<path class="ph" d="M${f1(x + pw)} ${by + bh - 2}l4.5 6.5h-9z"/>`;
          g += `<circle class="cn s" cx="${f1(x - 8)}" cy="${hy + hh / 2}" r="4.2"/><circle class="cn" cx="${f1(x + w + 8)}" cy="${hy + hh / 2}" r="4.2"/>`;
        }
        out.push(g + '</g>');
        lx = x + w + (print ? 8 : 17);
      }
      if (P.opt.labels) {
        const [a, b] = labelParts(r);
        out.push(`<text class="${r.t === 'group' ? 'gbl' : 'bl'}" x="${f1(lx)}" y="${y + 20}">${esc(a)}${b ? `<tspan class="pl" dx="8">${esc(b)}</tspan>` : ''}</text>`);
      }
    });

    for (const c of stripes) out.push(`<pattern id="st${c.slice(1)}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${c}" fill-opacity=".1"/><rect width="2.4" height="6" fill="${c}" fill-opacity=".6"/></pattern>`);
    // header on top
    out.push(`<rect class="hd" width="${W}" height="${HEAD}"/><path class="gm" d="${hl}"/><path class="gl" d="${ll}"/><path class="hb" d="M0 24.5H${W}M0 ${HEAD - 0.5}H${W}"/>`, ...txt);
    if (tx != null) out.push(`<path class="tdm" d="M${f1(tx - 5)} ${HEAD - 7}h10l-5 7z"/>`);
    return { W, H, svg: out.join('') };
  }

  /* ---------------- screen render ---------------- */
  const chartEl = $('chart');
  function drawChart(fix) {
    const R = $('right');
    const keep = !fix && lastPpd === P.ppd && RG[1] > RG[0] ? RG[0] + R.scrollLeft / P.ppd : null;
    V = visible();
    const prev = RG;
    RG = range(P.ppd, R.clientWidth, V);
    if (fix) RG = [prev[0], Math.max(prev[1], RG[1])];
    const c = chart(V, { x0: RG[0], x1: RG[1], ppd: P.ppd });
    $('chart').innerHTML = `<svg width="${c.W}" height="${c.H}" viewBox="0 0 ${c.W} ${c.H}" role="img" aria-label="Gantt chart">${c.svg}</svg>`;
    lastPpd = P.ppd;
    if (keep != null) R.scrollLeft = (keep - RG[0]) * P.ppd;
    $('empty').hidden = V.length > 0;
    stick();
  }
  // keep the month / year names in view while the chart scrolls sideways
  function stick() {
    const sl = $('right').scrollLeft;
    chartEl.querySelectorAll('text.hy').forEach((t) => {
      const a = +t.dataset.a, b = +t.dataset.b, w = t.getComputedTextLength ? t.getComputedTextLength() : 60;
      t.setAttribute('x', f1(clamp(sl + 6, a + 6, Math.max(a + 6, b - w - 6))));
      t.style.opacity = b - Math.max(a, sl) < w + 10 ? 0 : 1;
    });
  }

  function rowHTML(v, crit) {
    const r = v.r, E = eff(r), g = r.t === 'group', ms = r.t === 'ms', c = colour(r);
    const dep = depsText(r);
    const cls = ['tr', r.t, r.id === sel ? 'sel' : '', v.lvl ? 'kid' : '', crit.has(r.id) ? 'critr' : ''].filter(Boolean).join(' ');
    let h = `<div class="${cls}" data-id="${r.id}"><span class="c-no" title="Drag to reorder · click for details">${v.i + 1}</span><span class="c-name">`;
    if (g) h += `<button class="tw" aria-label="${r.col ? 'Show' : 'Hide'} its tasks" aria-expanded="${!r.col}">${r.col ? '▸' : '▾'}</button>`;
    h += `<button class="sw${ms ? ' msw' : ''}" style="--c:${c}" aria-label="Colour" title="Colour${ms ? ' and symbol' : ''}"></button><input data-f="n" value="${esc(r.n)}" aria-label="Name" placeholder="${g ? 'Phase name' : ms ? 'Milestone' : 'Task name'}" spellcheck="false"></span>`;
    if (g) {
      const d = days(E.s, E.e);
      h += `<span class="ro">${fmtD(E.s, true)}</span><span class="ro">${fmtD(E.e, true)}</span><span class="ro num">${d ?? ''}</span><span class="ro num">${E.s != null ? E.p + '%' : ''}</span><span></span><span></span>`;
    } else {
      h += `<input type="date" data-f="s" value="${n2iso(r.s)}" aria-label="${ms ? 'Date' : 'Start'}">`;
      h += ms ? `<span class="ro">—</span><span class="ro num" title="Milestone">◆</span><span></span>`
        : `<input type="date" data-f="e" value="${n2iso(r.e)}" aria-label="End"><input type="number" data-f="d" min="1" value="${days(r.s, r.e) ?? ''}" aria-label="${work() ? 'Working days' : 'Days'}"><input type="number" data-f="p" min="0" max="100" step="5" value="${r.p || 0}" aria-label="Done %">`;
      h += `<input data-f="o" value="${esc(r.o)}" aria-label="Owner" placeholder="—"><input data-f="dep" value="${dep}" aria-label="Linked to rows" placeholder="—" title="Rows this one is linked to: 3 = after row 3 finishes, 3SS = starts with it, 3FF = finishes with it, 3SF; add a lag like 3+2 or 3SS-1">`;
    }
    return h + `<button class="more" aria-label="Row actions" title="Insert, duplicate, change type… (or right-click)">⋯</button></div>`;
  }

  function renderTable() {
    const ae = document.activeElement; let keep = null;
    if (ae && ae.dataset && ae.dataset.f && ae.closest('#tb')) keep = { id: ae.closest('.tr').dataset.id, f: ae.dataset.f, a: ae.selectionStart, b: ae.selectionEnd };
    const crit = critical();
    $('tb').innerHTML = V.map((v) => rowHTML(v, crit)).join('');
    if (keep) {
      const el = $('tb').querySelector(`.tr[data-id="${keep.id}"] [data-f="${keep.f}"]`);
      if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(keep.a, keep.b); } catch (e) { /* date/number inputs */ } }
    }
  }

  // which columns the list shows (a per-browser preference)
  const COLS = [['s', 116, 3], ['e', 116, 4], ['d', 50, 5], ['p', 52, 6], ['o', 96, 7], ['dep', 62, 8]];
  let shown = { s: true, e: true, d: true, p: false, o: false, dep: false };
  function applyCols() {
    const g = $('grid'), w = ['36px', 'minmax(150px,1fr)'];
    let min = 36 + 150 + 28;
    for (const [k, px, n] of COLS) { g.classList.toggle('h' + n, !shown[k]); if (shown[k]) { w.push(px + 'px'); min += px; } }
    w.push('28px');
    g.style.setProperty('--cols-d', w.join(' ')); g.style.setProperty('--minw-d', min + 'px');
    document.querySelectorAll('[data-col]').forEach((i) => { i.checked = !!shown[i.dataset.col]; });
  }
  document.querySelectorAll('[data-col]').forEach((i) => i.addEventListener('change', () => { shown[i.dataset.col] = i.checked; store.set('cols', JSON.stringify(shown)); applyCols(); }));

  function toolbar() {
    $('undo').disabled = !undoS.length; $('redo').disabled = !redoS.length;
    document.querySelectorAll('#zoom [data-z]').forEach((b) => b.classList.toggle('on', b.dataset.z !== 'fit' && Math.abs(Math.log(P.ppd / ZOOM[b.dataset.z])) < 0.2));
    document.querySelectorAll('[data-opt]').forEach((i) => { i.checked = !!P.opt[i.dataset.opt]; });
    $('barAll').innerHTML = barsHTML(P.opt.bar, false);
    if (document.activeElement !== $('pname')) $('pname').value = P.title;
    const n = counts();
    $('saved').textContent = [plural(n.t, 'task'), plural(n.m, 'milestone')].join(' · ') + ' · saved in this browser';
    document.title = (P.title ? P.title + ' — ' : '') + 'Timeline & Gantt — Ranjith Kannankattil';
  }

  function renderAll() { struct(); drawChart(); renderTable(); toolbar(); }

  /* ---------------- history + storage ---------------- */
  const store = {
    get(k) { try { return localStorage.getItem('tl:' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('tl:' + k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem('tl:' + k); } catch (e) { /* private mode */ } },
  };
  const myList = () => { try { return JSON.parse(store.get('list')) || {}; } catch (e) { return {}; } };
  function save() {
    const L = myList(); L[pid] = { t: P.title, u: Date.now() };
    const ok = store.set('p:' + pid, JSON.stringify(P));
    store.set('list', JSON.stringify(L)); store.set('cur', pid);
    if (!ok) $('saved').textContent = 'Not saved — this browser is blocking storage. Download a timeline file to keep it.';
  }
  let st = null;
  const saveSoon = () => { clearTimeout(st); st = setTimeout(save, 250); };
  function commit() {
    const s = JSON.stringify(P);
    if (s === last) return;
    undoS.push(last); if (undoS.length > 150) undoS.shift();
    redoS = []; last = s; saveSoon();
  }
  const quiet = () => { last = JSON.stringify(P); saveSoon(); };
  function undo() { if (!undoS.length) return; redoS.push(last); last = undoS.pop(); P = JSON.parse(last); sel = null; renderAll(); saveSoon(); }
  function redo() { if (!redoS.length) return; undoS.push(last); last = redoS.pop(); P = JSON.parse(last); sel = null; renderAll(); saveSoon(); }

  function normalise(p) {
    p = p && typeof p === 'object' ? p : blank();
    p.title = String(p.title || 'Untitled timeline');
    p.opt = { ...DEF_OPT, ...(p.opt || {}) };
    p.ppd = clamp(+p.ppd || ZOOM.week, 0.15, 60);
    const ids = new Set();
    p.rows = (Array.isArray(p.rows) ? p.rows : []).filter((r) => r && typeof r === 'object').map((r) => {
      const t = r.t === 'group' || r.t === 'ms' ? r.t : 'task';
      const num = (v) => (v == null || v === '' ? null : typeof v === 'number' ? Math.round(v) : iso2n(String(v)));
      let s = num(r.s), e = num(r.e);
      if (t === 'ms') e = s; else if (s != null && (e == null || e < s)) e = s;
      let id = String(r.id || uid()); while (ids.has(id)) id = uid(); ids.add(id);
      const c = /^#[0-9a-f]{6}$/i.test(r.c || '') ? r.c : null;
      const dep = (Array.isArray(r.dep) ? r.dep : []).map((d) => (typeof d === 'string' || typeof d === 'number' ? { id: String(d), k: 'FS', l: 0 }
        : d && d.id != null ? { id: String(d.id), k: KINDS.includes(d.k) ? d.k : 'FS', l: Math.round(+d.l || 0) } : null)).filter(Boolean);
      return { id, t, n: String(r.n ?? ''), s, e, p: clamp(Math.round(+r.p || 0), 0, 100), o: String(r.o || ''), c, dep, sh: SHAPES.includes(r.sh) ? r.sh : undefined, bs: BARS.includes(r.bs) ? r.bs : undefined, nt: r.nt ? String(r.nt) : undefined, col: !!r.col };
    });
    const all = new Set(p.rows.map((r) => r.id));
    p.rows.forEach((r) => { r.dep = r.dep.filter((d) => all.has(d.id) && d.id !== r.id); });
    if (!BARS.includes(p.opt.bar)) p.opt.bar = 'solid';
    return p;
  }

  function openProject(p, id, opts = {}) {
    P = normalise(p); pid = id || uid(); sel = null; undoS = []; redoS = []; last = JSON.stringify(P); lastPpd = null;
    struct();
    if (opts.fit) fitZoom(true); else renderAll();
    if (!opts.fit) { const b = bounds(); $('right').scrollLeft = b ? Math.max(0, (b[0] - RG[0]) * P.ppd - 30) : 0; }
    save();
  }

  /* ---------------- templates ---------------- */
  // [type, name, start offset (days), length (days), owner, after (indexes), symbol]
  const TPL = {
    sample: { title: 'Website relaunch', blurb: 'A worked example, already under way', base: -21, live: true, rows: [
      ['g', 'Discovery'], ['t', 'Stakeholder interviews', 0, 8, 'Anna'], ['t', 'Analytics & content audit', 2, 10, 'Ravi'], ['m', 'Brief signed off', 12, 0, '', [1, 2]],
      ['g', 'Design'], ['t', 'Information architecture', 13, 7, 'Mia', [3]], ['t', 'Visual design', 20, 15, 'Mia', [5]], ['t', 'Prototype & user testing', 27, 12, 'Leo', [5]], ['m', 'Design freeze', 39, 0, '', [6, 7]],
      ['g', 'Build'], ['t', 'Front-end build', 35, 24, 'Ravi', [5]], ['t', 'CMS & content migration', 40, 19, 'Sara'], ['t', 'QA & accessibility', 59, 10, 'Leo', [10, 11]],
      ['g', 'Launch'], ['t', 'Launch campaign', 55, 20, 'Anna'], ['m', 'Go live', 69, 0, '', [12], 'star'], ['t', 'Post-launch review', 70, 5, 'Anna', [15]],
    ] },
    product: { title: 'Product launch', blurb: 'Research to launch day and after', rows: [
      ['g', 'Research'], ['t', 'Market research', 0, 10, 'Priya'], ['t', 'Customer interviews', 4, 12, 'Tom'], ['m', 'Concept approved', 16, 0, '', [1, 2], 'flag'],
      ['g', 'Development'], ['t', 'Prototype', 17, 20, 'Engineering', [3]], ['t', 'Testing & iteration', 37, 15, 'QA', [5]], ['t', 'Manufacturing readiness', 45, 15, 'Operations'], ['m', 'Ready to ship', 60, 0, '', [6, 7]],
      ['g', 'Go to market'], ['t', 'Pricing & positioning', 30, 10, 'Priya'], ['t', 'Marketing campaign', 48, 20, 'Tom'], ['t', 'Sales training', 58, 6, 'Sales'], ['m', 'Launch day', 68, 0, '', [8, 11, 12], 'star'],
      ['g', 'After launch'], ['t', 'Customer feedback', 69, 21, 'Priya', [13]], ['m', 'Launch review', 90, 0, '', [15]],
    ] },
    engineering: { title: 'Engineering project', blurb: 'Concept and FEED through to handover', rows: [
      ['g', 'Concept & FEED'], ['t', 'Concept select', 0, 45, 'Client'], ['t', 'Front-end engineering design', 45, 120, 'Engineering', [1]], ['m', 'Final investment decision', 168, 0, 'Client', [2], 'flag'],
      ['g', 'Detailed engineering'], ['t', 'Detailed design', 169, 180, 'Engineering', [3]], ['m', 'Drawings issued for construction', 300, 0, 'Engineering'],
      ['g', 'Procurement'], ['t', 'Long-lead equipment', 175, 270, 'Procurement', [3]], ['t', 'Bulk materials', 260, 150, 'Procurement'],
      ['g', 'Construction'], ['t', 'Site preparation', 230, 60, 'Construction'], ['t', 'Installation', 301, 210, 'Construction', [6]], ['m', 'Mechanical completion', 515, 0, '', [8, 12]],
      ['g', 'Commissioning'], ['t', 'Pre-commissioning', 480, 40, 'Commissioning'], ['t', 'Commissioning & start-up', 516, 45, 'Commissioning', [13]], ['m', 'Handover', 561, 0, 'Client', [16], 'star'],
    ] },
    event: { title: 'Conference', blurb: 'Venue, programme, promotion, the day', rows: [
      ['g', 'Plan'], ['t', 'Goals, audience & budget', 0, 5, 'Lead'], ['t', 'Venue shortlist & visits', 5, 10, 'Lead', [1]], ['m', 'Venue booked', 15, 0, '', [2], 'flag'],
      ['g', 'Organise'], ['t', 'Speakers & programme', 16, 25, 'Programme', [3]], ['t', 'Catering, AV & suppliers', 20, 25, 'Operations'], ['t', 'Registration open', 30, 36, 'Operations'],
      ['g', 'Promote'], ['t', 'Announcement & invitations', 30, 5, 'Comms'], ['t', 'Social media & newsletters', 35, 30, 'Comms', [9]],
      ['g', 'The event'], ['m', 'Event day', 66, 0, '', [5, 6, 7, 10], 'star'],
      ['g', 'Wrap up'], ['t', 'Thank-yous & survey', 67, 5, 'Comms', [12]], ['t', 'Report & lessons learned', 70, 8, 'Lead'],
    ] },
    research: { title: 'Research paper', blurb: 'Reading, study, writing, submission', rows: [
      ['g', 'Groundwork'], ['t', 'Literature review', 0, 35, 'Me'], ['t', 'Research question & method', 21, 21, 'Me'], ['m', 'Proposal approved', 45, 0, 'Supervisor', [2], 'flag'],
      ['g', 'Study'], ['t', 'Ethics & set-up', 46, 14, 'Me', [3]], ['t', 'Data collection', 60, 60, 'Me', [5]], ['t', 'Analysis', 110, 35, 'Me'],
      ['g', 'Writing'], ['t', 'First draft', 135, 45, 'Me'], ['t', 'Supervisor review', 180, 14, 'Supervisor', [9]], ['t', 'Revisions', 194, 14, 'Me', [10]], ['m', 'Submission', 208, 0, '', [11], 'star'],
    ] },
  };
  function fromTpl(k) {
    const T = TPL[k], t0 = today(), M = t0 - dow(t0) + (T.base ?? 7), p = blank(T.title), made = [];
    for (const x of T.rows) {
      const [t, n, s, d, o, , sh] = x;
      const r = t === 'g' ? mk('group', n) : t === 'm' ? mk('ms', n, M + s, M + s, sh ? { sh } : null) : mk('task', n, M + s, M + s + d - 1);
      if (o) r.o = o;
      made.push(r); p.rows.push(r);
    }
    T.rows.forEach((x, i) => { if (x[5]) made[i].dep = x[5].map((j) => ({ id: made[j].id, k: 'FS', l: 0 })); });
    if (T.live) for (const r of p.rows) if (r.t === 'task') r.p = clamp(Math.round(((t0 - r.s + 1) / (r.e - r.s + 1)) * 20) * 5, 0, 100);
    return p;
  }

  /* ---------------- editing ---------------- */
  const rowOf = (el) => { const t = el && el.closest && el.closest('.tr'); return t ? S.byId.get(t.dataset.id) : null; };
  function selectRow(id) {
    if (sel === id) return;
    sel = id;
    $('tb').querySelectorAll('.tr').forEach((t) => t.classList.toggle('sel', t.dataset.id === id));
    drawChart();
  }
  function focusName(id, all) {
    const el = $('tb').querySelector(`.tr[data-id="${id}"] [data-f="n"]`);
    if (el) { el.focus(); if (all) el.select(); }
  }
  function ensureVisible(r) {
    const E = eff(r); if (E.s == null) return;
    const R = $('right'), x = (E.s - RG[0]) * P.ppd;
    if (x < R.scrollLeft + 10 || x > R.scrollLeft + R.clientWidth - 80) R.scrollLeft = Math.max(0, x - 80);
  }

  function setDeps(r, val) { setLinks(r, parseDeps(val).map((x) => ({ p: P.rows[x.n - 1], n: x.n, k: x.k, l: x.l }))); }
  function setLinks(r, list) {        // list: [{ p: row, n: row number, k, l }]
    const keep = r.dep; r.dep = [];
    const ok = [], bad = [];
    for (const x of list) {
      const p = x.p;
      if (!p || p === r || p === S.par.get(r.id) || dependsOn(p, r)) { bad.push(x.n); continue; }
      const i = ok.findIndex((d) => d.id === p.id);
      const d = { id: p.id, k: KINDS.includes(x.k) ? x.k : 'FS', l: Math.round(+x.l || 0) };
      if (i >= 0) ok[i] = d; else ok.push(d);
    }
    r.dep = ok;
    if (bad.length) toast(`Skipped row ${bad.join(', ')} — it would make a loop or doesn't exist.`);
    return keep;
  }

  function edit(r, f, val) {
    if (f === 'n') r.n = val;
    else if (f === 's') {
      const n = iso2n(val);
      if (n == null) { r.s = null; r.e = null; }
      else if (r.t === 'ms') { r.s = n; r.e = n; }
      else { const d = r.s != null && r.e != null ? days(r.s, r.e) : 5; r.s = n; r.e = endFor(n, d); }
    } else if (f === 'e') {
      const n = iso2n(val); if (n == null) return renderAll();
      if (r.s == null) r.s = n - 4;
      r.e = n; if (r.s > n) r.s = n;
    } else if (f === 'd') {
      const d = parseInt(val, 10); if (!(d > 0)) return renderAll();
      if (r.s == null) r.s = nextWork(today());
      r.e = endFor(r.s, d);
    } else if (f === 'p') r.p = clamp(Math.round(+val || 0), 0, 100);
    else if (f === 'o') r.o = val.trim();
    else if (f === 'dep') setDeps(r, val);
    schedule(); commit(); renderAll();
  }

  function add(t, after, opt = {}) {
    struct();
    const ref = after || (sel && S.byId.get(sel)) || null;
    let at = P.rows.length, prevEnd = null;
    if (ref && opt.above) {
      at = S.idx.get(ref.id);
      const E = eff(ref); prevEnd = E.s != null ? E.s - 1 : null;
    } else if (ref) {
      const i = S.idx.get(ref.id);
      const g = ref.t === 'group' ? ref : S.par.get(ref.id);
      at = t === 'group' && g ? S.idx.get(g.id) + 1 + S.kids.get(g.id).length : i + 1;
      if (ref.t === 'group' && ref.col && t !== 'group') at = i + 1 + S.kids.get(ref.id).length;
      const E = eff(ref); prevEnd = E.e ?? E.s;
    } else { const b = bounds(); prevEnd = b ? b[1] : null; }
    const s0 = nextWork(prevEnd != null ? prevEnd + 1 : today());
    const rows = t === 'group' ? [mk('group', 'New phase'), mk('task', 'First task', s0, endFor(s0, 5))]
      : t === 'ms' ? [mk('ms', 'Milestone', opt.above && prevEnd != null ? prevEnd + 1 : prevEnd ?? today())]
        : [mk('task', 'New task', s0, endFor(s0, 5))];
    P.rows.splice(at, 0, ...rows);
    sel = rows[0].id;
    commit(); renderAll();
    ensureVisible(rows[0]);
    focusName(rows[0].id, true);
  }

  function block(r) { const i = S.idx.get(r.id); return [i, r.t === 'group' ? 1 + S.kids.get(r.id).length : 1]; }
  function deleteRow(r) {
    if (!r) return;
    struct();
    const [i, n] = block(r);
    const gone = new Set(P.rows.slice(i, i + n).map((x) => x.id));
    P.rows.splice(i, n);
    P.rows.forEach((x) => { x.dep = (x.dep || []).filter((d) => !gone.has(d.id)); });
    if (gone.has(sel)) sel = null;
    commit(); renderAll();
    toast(`Deleted “${r.n || 'untitled'}”${n > 1 ? ` and its ${plural(n - 1, 'row')}` : ''}.`, 'Undo', undo);
  }
  function moveBlock(r, target) {      // target: index in P.rows to insert before
    const [i, n] = block(r);
    if (target >= i && target <= i + n) return false;
    const blk = P.rows.splice(i, n);
    if (target > i) target -= n;
    P.rows.splice(target, 0, ...blk);
    return true;
  }
  function moveRow(r, dir) {
    struct();
    const [i, n] = block(r);
    let target;
    if (dir < 0) {
      if (i === 0) return;
      const prev = P.rows[i - 1];
      if (r.t === 'group') { const g = prev.t === 'group' ? prev : S.par.get(prev.id); target = g ? S.idx.get(g.id) : i - 1; }
      else target = i - 1;
    } else {
      if (i + n >= P.rows.length) return;
      const next = P.rows[i + n];
      target = r.t === 'group' ? i + n + block(next)[1] : i + n + 1;
      if (r.t !== 'group' && next.t === 'group' && next.col) target = i + n + 1 + S.kids.get(next.id).length;
    }
    if (moveBlock(r, target)) { commit(); renderAll(); focusName(r.id); }
  }

  // a new task straight after r; whatever followed r now follows the new task (and moves later)
  function insertInSequence(r) {
    struct();
    const before = new Map(P.rows.map((x) => [x.id, x.s]));
    const s0 = nextWork((r.t === 'group' ? eff(r).e : r.e ?? r.s) + (r.t === 'ms' ? 0 : 1));
    const n = mk('task', 'New task', s0, endFor(s0, 5), { dep: [{ id: r.id, k: 'FS', l: 0 }] });
    let relinked = 0;
    for (const x of P.rows) x.dep = (x.dep || []).map((d) => (d.id === r.id && d.k === 'FS' ? (relinked++, { ...d, id: n.id }) : d));
    const [i, len] = block(r);
    P.rows.splice(r.t === 'group' ? i + len : i + 1, 0, n);
    schedule(true);
    const moved = P.rows.filter((x) => before.has(x.id) && x.s !== before.get(x.id)).length;
    sel = n.id; commit(); renderAll(); ensureVisible(n); focusName(n.id, true);
    toast(relinked ? `Inserted after “${r.n || 'untitled'}”; ${plural(relinked, 'linked task')} now follow${relinked === 1 ? 's' : ''} it${moved ? `, ${moved} moved later` : ''}.` : `Inserted after “${r.n || 'untitled'}” and linked to it.`, 'Undo', undo);
  }
  function duplicate(r) {
    if (!r) return;
    struct();
    const [i, n] = block(r), map = new Map();
    const copies = P.rows.slice(i, i + n).map((x) => { const c = JSON.parse(JSON.stringify(x)); c.id = uid(); map.set(x.id, c.id); return c; });
    copies.forEach((c) => { c.dep = c.dep.map((d) => (map.has(d.id) ? { ...d, id: map.get(d.id) } : d)); });
    P.rows.splice(i + n, 0, ...copies);
    sel = copies[0].id; commit(); renderAll(); focusName(sel, true);
    toast(`Duplicated “${r.n || 'untitled'}”${n > 1 ? ` with its ${plural(n - 1, 'row')}` : ''} — type to rename it.`, 'Undo', undo);
  }
  function convert(r, t) {
    if (!r || r.t === t) return;
    struct();
    if (r.t === 'group') { const E = eff(r); r.s = E.s ?? nextWork(today()); r.e = E.e ?? endFor(r.s, 5); }
    if (t === 'ms') r.e = r.s;
    else if (t === 'task' && r.t === 'ms') r.e = r.s != null ? endFor(r.s, 5) : null;
    if (t === 'group') { r.dep = []; r.col = false; }
    r.t = t;
  }

  /* ---------------- row menu (⋯ button or right-click) ---------------- */
  const barIcon = (k) => {
    const b = { solid: '<rect x="2" y="3" width="24" height="8" rx="2"/>', outline: '<rect x="2.75" y="3.75" width="22.5" height="6.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      striped: '<rect x="2.75" y="3.75" width="22.5" height="6.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 11L11 3M11 11L16 3M16 11L21 3" stroke="currentColor" stroke-width="1.4"/>',
      thin: '<rect x="2" y="5.5" width="24" height="3" rx="1.5"/>', arrow: '<path d="M2 3H20L26 7L20 11H2Z"/>' }[k];
    return `<svg viewBox="0 0 28 14" aria-hidden="true" fill="currentColor">${b}</svg>`;
  };
  const barsHTML = (cur, auto) => (auto ? `<button type="button" data-bs="" class="${cur ? '' : 'on'} txt" title="Use the timeline's bar style">Auto</button>` : '') +
    BARS.map((k) => `<button type="button" data-bs="${k}" class="${cur === k ? 'on' : ''}" title="${BAR_NAME[k]}" aria-label="${BAR_NAME[k]} bar">${barIcon(k)}</button>`).join('');
  let menuRow = null;
  function openMenu(r, x, y) {
    if (!r) return;
    closePop(); selectRow(r.id); menuRow = r;
    const m = $('menu'), t = r.t, kbd = (k) => `<kbd>${k}</kbd>`;
    m.innerHTML = `<div class="rm-h">Row ${S.idx.get(r.id) + 1} · ${esc(r.n || 'Untitled')}</div>
      <button data-act="below">Insert task below ${kbd('Enter')}</button>
      <button data-act="above">Insert task above</button>
      ${t !== 'group' ? `<button data-act="seq">Insert in sequence<span>after this; what followed it moves later</span></button>` : ''}
      <button data-act="ms">Insert milestone below</button>
      <button data-act="group">Insert phase below</button>
      <button data-act="dup">Duplicate${t === 'group' ? ' phase and its tasks' : ''} ${kbd('Ctrl D')}</button>
      <hr>
      <div class="rm-row"><span>Type</span><div class="tl-seg mini">${[['task', 'Task'], ['ms', 'Milestone'], ['group', 'Phase']].map(([k, l]) => `<button type="button" data-type="${k}" class="${t === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${t === 'task' ? `<div class="rm-row"><span>Bar</span><div class="tl-bars">${barsHTML(r.bs, true)}</div></div>` : ''}
      ${t === 'ms' ? `<div class="rm-row"><span>Symbol</span><div class="tl-shapes">${shapesHTML(r.sh)}</div></div>` : ''}
      <div class="rm-row"><span>Colour</span><div class="tl-pal">${palHTML(r.c, 'Automatic')}</div></div>
      <hr>
      <button data-act="edit">All details… ${kbd('double-click')}</button>
      <button data-act="del" class="danger">Delete${t === 'group' ? ' phase and its tasks' : ''} ${kbd('Del')}</button>`;
    m.hidden = false;
    m.style.left = Math.max(8, Math.min(x, innerWidth - m.offsetWidth - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(y, innerHeight - m.offsetHeight - 8)) + 'px';
    const f = m.querySelector('button'); if (f) f.focus({ preventScroll: true });
  }
  const closeMenu = () => { $('menu').hidden = true; menuRow = null; };
  $('menu').addEventListener('click', (e) => {
    const b = e.target.closest('button'); const r = menuRow; if (!b || !r) return;
    const a = b.dataset.act;
    if (a) {
      closeMenu();
      if (a === 'below') add('task', r);
      else if (a === 'above') add('task', r, { above: true });
      else if (a === 'seq') insertInSequence(r);
      else if (a === 'ms') add('ms', r);
      else if (a === 'group') add('group', r);
      else if (a === 'dup') duplicate(r);
      else if (a === 'edit') openEditor(r);
      else if (a === 'del') deleteRow(r);
      return;
    }
    if (b.dataset.type) { convert(r, b.dataset.type); schedule(); }
    else if ('bs' in b.dataset) r.bs = b.dataset.bs || undefined;
    else if (b.dataset.sh) r.sh = b.dataset.sh === 'diamond' ? undefined : b.dataset.sh;
    else if ('c' in b.dataset) r.c = b.dataset.c || null;
    else return;
    commit(); renderAll(); openMenu(r, parseFloat($('menu').style.left), parseFloat($('menu').style.top));
  });
  $('menu').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const bs = [...$('menu').querySelectorAll('button[data-act]')], i = bs.indexOf(document.activeElement);
    const j = (i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs[j].focus(); e.preventDefault();
  });

  /* ---------------- task list events ---------------- */
  const tb = $('tb');
  tb.addEventListener('input', (e) => {
    if (e.target.dataset.f !== 'n') return;
    const r = rowOf(e.target); if (!r) return;
    r.n = e.target.value; drawChart();
  });
  tb.addEventListener('change', (e) => { const f = e.target.dataset.f, r = rowOf(e.target); if (r && f) edit(r, f, e.target.value); });
  tb.addEventListener('focusin', (e) => { const r = rowOf(e.target); if (r) selectRow(r.id); });
  tb.addEventListener('keydown', (e) => {
    const f = e.target.dataset.f; if (!f) return;
    const r = rowOf(e.target); if (!r) return;
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      if (f === 'n') { r.n = e.target.value; add(r.t === 'ms' ? 'ms' : 'task', r); }
      else e.target.blur();
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault(); if (f === 'n') r.n = e.target.value; moveRow(r, e.key === 'ArrowUp' ? -1 : 1);
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && ['n', 'o', 'dep'].includes(f)) {
      const rows = [...tb.querySelectorAll('.tr')], k = rows.findIndex((x) => x.dataset.id === r.id) + (e.key === 'ArrowUp' ? -1 : 1);
      const el = rows[k] && rows[k].querySelector(`[data-f="${f}"]`);
      if (el) { e.preventDefault(); el.focus(); }
    } else if (e.key === 'Escape') e.target.blur();
  });
  tb.addEventListener('click', (e) => {
    const r = rowOf(e.target); if (!r) return;
    if (e.target.closest('.tw')) { r.col = !r.col; quiet(); renderAll(); return; }
    if (e.target.closest('.sw')) { openPop(r, e.target.closest('.sw')); return; }
    if (e.target.closest('.more')) { const b = e.target.closest('.more').getBoundingClientRect(); openMenu(r, b.right - 250, b.bottom + 4); return; }
    selectRow(r.id);
  });
  tb.addEventListener('contextmenu', (e) => { const r = rowOf(e.target); if (!r || e.target.closest('input')) return; e.preventDefault(); openMenu(r, e.clientX, e.clientY); });

  // drag a row number to reorder; a plain click opens the details
  let rdrag = null;
  tb.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.c-no'); if (!h || e.button !== 0) return;
    const r = rowOf(h);
    rdrag = { r, y0: e.clientY, moved: false, id: e.pointerId, el: h.closest('.tr') };
    h.setPointerCapture(e.pointerId); e.preventDefault();
  });
  tb.addEventListener('pointermove', (e) => {
    if (!rdrag) return;
    if (!rdrag.moved && Math.abs(e.clientY - rdrag.y0) < 4) return;
    rdrag.moved = true; rdrag.el.classList.add('lifted');
    const top = tb.getBoundingClientRect().top;
    rdrag.t = clamp(Math.round((e.clientY - top) / ROW), 0, V.length);
    const d = $('drop'); d.hidden = false; d.style.top = HEAD + rdrag.t * ROW - 1 + 'px';
  });
  const endRowDrag = () => {
    if (!rdrag) return;
    const d = rdrag; rdrag = null; $('drop').hidden = true; d.el.classList.remove('lifted');
    if (!d.moved) { openEditor(d.r); return; }
    struct();
    let target = d.t < V.length ? V[d.t].i : P.rows.length;
    if (d.r.t === 'group' && d.t < V.length) { const g = S.par.get(V[d.t].r.id); if (g) target = S.idx.get(g.id); }
    if (moveBlock(d.r, target)) { commit(); renderAll(); }
  };
  tb.addEventListener('pointerup', endRowDrag);
  tb.addEventListener('pointercancel', () => { if (rdrag) { rdrag.moved = false; $('drop').hidden = true; rdrag.el.classList.remove('lifted'); rdrag = null; } });

  /* ---------------- chart interaction ---------------- */
  let drag = null, raf = 0;
  const ptr = (e) => { const b = chartEl.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  const dayAt = (x) => Math.floor(x / P.ppd + RG[0]);
  const rowAtY = (y) => { const i = Math.floor((y - HEAD) / ROW); return i >= 0 && i < V.length ? V[i] : null; };
  const redraw = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; drawChart(true); }); };

  chartEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const p = ptr(e); hideTip();
    const g = e.target.closest('.bar'), v = rowAtY(p.y);
    let mode = null, r = null;
    if (g) {
      r = S.byId.get(g.dataset.id); const cl = e.target.classList;
      mode = cl.contains('cn') ? 'link' : cl.contains('ph') ? 'prog' : cl.contains('l') ? 'left' : cl.contains('r') ? 'right' : 'move';
    } else if (v && v.r.t !== 'group' && v.r.s == null) { r = v.r; mode = 'new'; }
    else if (p.y > HEAD && v) { r = v.r; mode = 'pan'; }
    else return;
    const touch = e.pointerType === 'touch';
    const wasSel = r && sel === r.id;
    if (touch && mode !== 'link' && mode !== 'prog') {         // touch: tap to select, tap again for details; the page scrolls as usual
      drag = { mode: 'tap', r, wasSel, x0: p.x, y0: p.y };
      return;
    }
    drag = { mode, r, wasSel, x0: p.x, y0: p.y, sl: $('right').scrollLeft, snap: P.rows.map((x) => [x.s, x.e, x.p]), day0: dayAt(p.x), cx0: e.clientX, moved: false };
    if (mode === 'link') { const c = e.target; drag.x0 = +c.getAttribute('cx'); drag.y0 = +c.getAttribute('cy'); drag.from = c.classList.contains('s') ? 'S' : 'F'; }
    chartEl.setPointerCapture(e.pointerId);
    if (mode !== 'pan') chartEl.classList.add('dragging');
    e.preventDefault();
  });
  chartEl.addEventListener('pointermove', (e) => {
    const p = ptr(e);
    if (!drag) return hover(e, p);
    if (drag.mode === 'tap') { if (Math.abs(p.x - drag.x0) > 8 || Math.abs(p.y - drag.y0) > 8) drag = null; return; }
    const dx = p.x - drag.x0;
    if (!drag.moved && Math.abs(dx) < 3 && Math.abs(p.y - drag.y0) < 3) return;
    drag.moved = true;
    if (drag.mode === 'pan') { $('right').scrollLeft = drag.sl - (e.clientX - drag.cx0); return; }
    if (drag.mode === 'link') return linkLine(p);
    P.rows.forEach((x, i) => { [x.s, x.e, x.p] = drag.snap[i]; });      // start from the original every frame
    const r = drag.r, dd = Math.round(dx / P.ppd);
    switch (drag.mode) {
      case 'move':
        if (r.t === 'group') S.kids.get(r.id).forEach((k) => { if (k.s != null) { k.s += dd; k.e = (k.e ?? k.s - dd) + dd; } });
        else { r.s += dd; r.e += dd; }
        break;
      case 'left': r.s = Math.min(r.s + dd, r.e); break;
      case 'right': r.e = Math.max(r.e + dd, r.s); break;
      case 'prog': { const x = (r.s - RG[0]) * P.ppd, w = (r.e - r.s + 1) * P.ppd; r.p = clamp(Math.round(((p.x - x) / w) * 20) * 5, 0, 100); break; }
      case 'new': { const d = dayAt(p.x); r.s = Math.min(drag.day0, d); r.e = Math.max(drag.day0, d); break; }
    }
    schedule();
    redraw(); tip(r, p);
  });
  chartEl.addEventListener('pointerup', (e) => endDrag(e, false));
  chartEl.addEventListener('pointercancel', (e) => endDrag(e, true));
  chartEl.addEventListener('lostpointercapture', () => chartEl.classList.remove('dragging'));
  function endDrag(e, cancel) {
    chartEl.classList.remove('dragging');
    if (!drag) return;
    const d = drag; drag = null;
    if (d.mode === 'tap') { if (cancel || !d.r) return; if (d.wasSel) openEditor(d.r); else selectRow(d.r.id); return; }
    if (d.mode === 'link') {
      const l = chartEl.querySelector('.lnk'); if (l) l.remove();
      if (cancel || !d.moved) return;
      const q = ptr(e), v = rowAtY(q.y);
      if (v && v.r !== d.r) {
        const E = eff(v.r), mid = E.s == null ? 0 : ((E.s + (E.e ?? E.s) + 1) / 2 - RG[0]) * P.ppd;
        const to = v.r.t === 'ms' || q.x < mid ? 'S' : 'F';
        linkTo(d.r, v.r, d.from + to);
      }
      return;
    }
    if (cancel || !d.moved) {
      P.rows.forEach((x, i) => { [x.s, x.e, x.p] = d.snap[i]; });
      hideTip();
      if (!cancel && d.r) selectRow(d.r.id);
      return;
    }
    if (d.mode === 'pan') return;
    hideTip();
    sel = d.r.id; commit(); renderAll();
  }
  chartEl.addEventListener('dblclick', (e) => {
    const g = e.target.closest('.bar');
    const r = g ? S.byId.get(g.dataset.id) : (rowAtY(ptr(e).y) || {}).r;
    if (r) openEditor(r);
  });
  chartEl.addEventListener('pointerleave', () => { if (!drag) hideTip(); });
  chartEl.addEventListener('contextmenu', (e) => {
    const g = e.target.closest('.bar'), r = g ? S.byId.get(g.dataset.id) : (rowAtY(ptr(e).y) || {}).r;
    if (!r) return;
    e.preventDefault(); hideTip(); openMenu(r, e.clientX, e.clientY);
  });

  function linkLine(p) {
    const svg = chartEl.querySelector('svg'); if (!svg) return;
    let l = svg.querySelector('.lnk');
    if (!l) { l = document.createElementNS('http://www.w3.org/2000/svg', 'path'); l.setAttribute('class', 'lnk'); svg.append(l); }
    l.setAttribute('d', `M${drag.x0} ${drag.y0}L${f1(p.x)} ${f1(p.y)}`);
  }
  function linkTo(pred, succ, k = 'FS') {
    if (succ === pred) return;
    if (succ.t === 'group') return toast('Link to a task or milestone rather than a phase.');
    const had = succ.dep.find((d) => d.id === pred.id);
    if (had && had.k === k) return toast('Those two are already linked that way.');
    if (!had && (pred === S.par.get(succ.id) || dependsOn(pred, succ))) return toast('That link would make a loop.');
    if (had) had.k = k; else succ.dep.push({ id: pred.id, k, l: 0 });
    schedule(); sel = succ.id; commit(); renderAll();
    toast(`“${succ.n || 'untitled'}” ${KIND_TXT[k]} — “${pred.n || 'untitled'}”.`, 'Undo', undo);
  }

  function hover(e, p) {
    const g = e.target.closest && e.target.closest('.bar');
    if (!g) return hideTip();
    tip(S.byId.get(g.dataset.id), p);
  }
  function tip(r, p) {
    if (!r) return;
    const E = eff(r), t = $('tip'), d = days(E.s, E.e);
    let h = `<b>${esc(r.n || 'Untitled')}</b><br><span class="m">`;
    h += r.t === 'ms' ? 'Milestone · ' + fmtD(E.s, true) : `${fmtRange(E.s, E.e)} · ${d} ${work() ? 'working ' : ''}day${d === 1 ? '' : 's'}`;
    if (r.t !== 'ms' && P.opt.prog) h += ` · ${E.p || 0}% done`;
    h += '</span>';
    if (r.o) h += `<br>${esc(r.o)}`;
    for (const d of (r.dep || []).slice(0, 4)) { const p = S.byId.get(d.id); if (p) h += `<br><span class="m">${KIND_TXT[d.k]}${lagTxt(d.l)}: ${S.idx.get(p.id) + 1} ${esc(p.n)}</span>`; }
    if (r.nt) h += `<br><i>${esc(r.nt)}</i>`;
    t.innerHTML = h; t.hidden = false;
    const R = $('right'), w = t.offsetWidth;
    t.style.left = Math.max(R.scrollLeft + 6, Math.min(p.x + 14, R.scrollLeft + R.clientWidth - w - 8)) + 'px';
    t.style.top = (p.y + 18 + t.offsetHeight > chartEl.offsetHeight ? p.y - t.offsetHeight - 12 : p.y + 18) + 'px';
  }
  const hideTip = () => { $('tip').hidden = true; };

  /* ---------------- zoom, scroll, splitter ---------------- */
  function setZoom(ppd, day, px) {
    const R = $('right');
    if (day == null) { px = R.clientWidth / 2; day = RG[0] + (R.scrollLeft + px) / P.ppd; }
    P.ppd = clamp(ppd, 0.15, 60);
    drawChart();
    R.scrollLeft = (day - RG[0]) * P.ppd - px;
    toolbar(); saveSoon();
  }
  function fitZoom(top) {
    const b = bounds(), R = $('right');
    if (!b) { renderAll(); return; }
    let room = 0; struct();
    for (const r of P.rows) { const E = eff(r); if (E.s != null && (E.e ?? E.s) >= b[1] - 2) room = Math.max(room, labelW(r) + 40); }
    let ppd = (R.clientWidth - 60 - room) / (b[1] - b[0] + 1);
    for (let k = 0; k < 4; k++) {          // the scale changes with zoom, so settle it
      P.ppd = clamp(ppd, 0.15, 60);
      const [x0, x1] = range(P.ppd, 0, visible());
      const w = (x1 - x0) * P.ppd;
      if (w <= R.clientWidth + 2) break;
      ppd = P.ppd * (R.clientWidth / w);
    }
    if (top && P.ppd < 2.5) P.ppd = R.clientWidth < 500 ? ZOOM.week : ZOOM.month;
    lastPpd = null; renderAll();
    R.scrollLeft = 0;
    if (!top) saveSoon();
  }
  $('zoom').addEventListener('click', (e) => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    if (b.dataset.z === 'fit') fitZoom(); else setZoom(ZOOM[b.dataset.z]);
  });
  $('right').addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const R = $('right'), px = e.clientX - R.getBoundingClientRect().left;
    setZoom(P.ppd * Math.exp(-e.deltaY * 0.0022), RG[0] + (R.scrollLeft + px) / P.ppd, px);
  }, { passive: false });
  function goToday() {
    const t = today(), R = $('right');
    if (t < RG[0] || t >= RG[1]) {
      const b = bounds();
      toast(b && t < b[0] ? `Today is before this plan — it starts ${fmtD(b[0], true)}.` : 'Today is after the end of this plan.');
      return;
    }
    R.scrollTo({ left: Math.max(0, (t - RG[0]) * P.ppd - R.clientWidth * 0.3), behavior: 'smooth' });
  }
  $('todayBtn').onclick = goToday;

  (function splitter() {
    const grid = $('grid'), sp = $('split');
    const saved = store.get('lw'); if (saved) grid.style.setProperty('--lw', saved);
    // screen readers hear the list's width as a percentage of the tool
    const tell = () => { sp.setAttribute('aria-valuenow', String(Math.round(100 * $('left').offsetWidth / Math.max(1, grid.clientWidth)))); };
    sp.setAttribute('aria-valuemin', '0'); sp.setAttribute('aria-valuemax', '100'); tell();
    new ResizeObserver(tell).observe($('left'));
    let x0 = null, w0 = 0;
    sp.addEventListener('pointerdown', (e) => { x0 = e.clientX; w0 = $('left').offsetWidth; sp.setPointerCapture(e.pointerId); e.preventDefault(); });
    sp.addEventListener('pointermove', (e) => {
      if (x0 == null) return;
      const w = clamp(w0 + e.clientX - x0, 90, grid.clientWidth - 160);
      grid.style.setProperty('--lw', w + 'px');
    });
    const done = () => { if (x0 == null) return; x0 = null; store.set('lw', grid.style.getPropertyValue('--lw')); drawChart(); };
    sp.addEventListener('pointerup', done); sp.addEventListener('pointercancel', done);
    sp.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const w = clamp($('left').offsetWidth + (e.key === 'ArrowLeft' ? -40 : 40), 90, grid.clientWidth - 160);
      grid.style.setProperty('--lw', w + 'px'); store.set('lw', w + 'px'); drawChart(); e.preventDefault();
    });
  })();
  $('right').addEventListener('scroll', () => { hideTip(); stick(); }, { passive: true });
  let rz = 0;
  new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => P && drawChart()); }).observe($('right'));

  /* ---------------- colour + symbol popover ---------------- */
  const shapeIcon = (k) => `<svg viewBox="0 0 20 20" aria-hidden="true">${shape(k, 9, 10, 7, 'currentColor')}</svg>`;
  function palHTML(cur, auto) {
    return `<button type="button" class="auto${cur ? '' : ' on'}" data-c="" title="${auto}">Auto</button>` +
      PAL.map((c) => `<button type="button" data-c="${c}" style="--c:${c}" class="${cur === c ? 'on' : ''}" aria-label="Colour ${c}"></button>`).join('');
  }
  const shapesHTML = (cur) => SHAPES.map((k) => `<button type="button" data-sh="${k}" class="${(cur || 'diamond') === k ? 'on' : ''}" title="${k[0].toUpperCase() + k.slice(1)}">${shapeIcon(k)}</button>`).join('');
  let popRow = null;
  function openPop(r, btn) {
    popRow = r;
    const pop = $('pop');
    pop.innerHTML = `<div class="tl-pal">${palHTML(r.c, r.t === 'group' ? 'Next colour in the palette' : 'Same as its phase')}</div>` + (r.t === 'ms' ? `<div class="tl-shapes">${shapesHTML(r.sh)}</div>` : '');
    pop.hidden = false;
    const b = btn.getBoundingClientRect();
    pop.style.left = Math.min(b.left, innerWidth - pop.offsetWidth - 10) + 'px';
    pop.style.top = (b.bottom + 8 + pop.offsetHeight > innerHeight ? b.top - pop.offsetHeight - 8 : b.bottom + 8) + 'px';
  }
  const closePop = () => { $('pop').hidden = true; popRow = null; };
  $('pop').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !popRow) return;
    if ('c' in b.dataset) popRow.c = b.dataset.c || null;
    if (b.dataset.sh) popRow.sh = b.dataset.sh === 'diamond' ? undefined : b.dataset.sh;
    commit(); renderAll(); closePop();
  });

  /* ---------------- details dialog ---------------- */
  let edRow = null, edC = null, edSh = null, edBs = null;
  const ed = $('ed');
  function openEditor(r) {
    if (!r) return;
    struct(); edRow = r; edC = r.c; edSh = r.sh; edBs = r.bs;
    selectRow(r.id);
    const E = eff(r);
    $('edH').textContent = r.t === 'group' ? 'Phase' : r.t === 'ms' ? 'Milestone' : 'Task';
    $('edN').value = r.n; $('edT').value = r.t; $('edO').value = r.o || '';
    $('edS').value = n2iso(r.t === 'group' ? E.s : r.s); $('edE').value = n2iso(r.t === 'group' ? E.e : r.e);
    $('edD').value = r.t === 'task' ? days(r.s, r.e) ?? '' : '';
    $('edDL').textContent = work() ? 'Work days' : 'Days';
    $('edP').value = r.p || 0; $('edPV').textContent = (r.p || 0) + '%'; $('edP').style.setProperty('--p', (r.p || 0) + '%');
    $('edDeps').innerHTML = ''; (r.dep || []).forEach((d) => addLinkRow(d));
    $('edBs').innerHTML = barsHTML(edBs, true);
    $('edNt').value = r.nt || '';
    $('edC').innerHTML = palHTML(edC, 'Automatic'); $('edSh').innerHTML = shapesHTML(edSh);
    edType(r.t);
    ed.showModal();
    setTimeout(() => $('edN').focus(), 30);
  }
  function edType(t) {
    ed.dataset.t = t;
    $('edSL').textContent = t === 'ms' ? 'Date' : 'Start';
    const E = edRow && edRow.t === 'group' ? eff(edRow) : null;
    $('edSum').textContent = t === 'group'
      ? (E && E.s != null ? `${fmtRange(E.s, E.e)} · ${days(E.s, E.e)} days · ${E.p}% done — worked out from its tasks.` : 'A phase spans the tasks listed under it.')
      : '';
    $('edSum').hidden = t !== 'group';
  }
  $('edT').onchange = () => edType($('edT').value);
  $('edS').onchange = () => { const s = iso2n($('edS').value), d = +$('edD').value || 5; if (s != null && $('edT').value === 'task') $('edE').value = n2iso(endFor(s, d)); };
  $('edE').onchange = () => { const s = iso2n($('edS').value), e = iso2n($('edE').value); if (s != null && e != null && e >= s) $('edD').value = days(s, e); };
  $('edD').oninput = () => { const s = iso2n($('edS').value), d = parseInt($('edD').value, 10); if (s != null && d > 0) $('edE').value = n2iso(endFor(s, d)); };
  $('edP').oninput = () => { $('edPV').textContent = $('edP').value + '%'; $('edP').style.setProperty('--p', $('edP').value + '%'); };
  $('edC').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; edC = b.dataset.c || null; $('edC').innerHTML = palHTML(edC, 'Automatic'); };
  $('edSh').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; edSh = b.dataset.sh === 'diamond' ? undefined : b.dataset.sh; $('edSh').innerHTML = shapesHTML(edSh); };
  function addLinkRow(d) {
    const me = edRow, opts = P.rows.map((x, i) => (x === me || x === S.par.get(me.id) ? '' : `<option value="${x.id}"${d && d.id === x.id ? ' selected' : ''}>${i + 1} · ${esc((x.n || 'Untitled').slice(0, 40))}${x.t === 'group' ? ' (phase)' : ''}</option>`)).join('');
    const div = document.createElement('div'); div.className = 'ed-link';
    div.innerHTML = `<select class="lp" aria-label="Linked row">${d ? '' : '<option value="">Choose a row…</option>'}${opts}</select>
      <select class="lk" aria-label="How they are linked">${KINDS.map((k) => `<option value="${k}"${(d ? d.k : 'FS') === k ? ' selected' : ''}>${k} · ${KIND_TXT[k].replace('it', 'that')}</option>`).join('')}</select>
      <label class="ll"><input type="number" step="1" value="${d ? d.l || 0 : 0}" aria-label="Lag in days"><span>d lag</span></label>
      <button type="button" class="x" aria-label="Remove link">×</button>`;
    $('edDeps').append(div);
  }
  $('edDepAdd').onclick = () => { addLinkRow(null); $('edDeps').lastElementChild.querySelector('select').focus(); };
  $('edDeps').onclick = (e) => { const x = e.target.closest('.x'); if (x) x.closest('.ed-link').remove(); };
  $('edBs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; edBs = b.dataset.bs || undefined; $('edBs').innerHTML = barsHTML(edBs, true); };
  $('edCancel').onclick = () => ed.close();
  $('edDel').onclick = () => { ed.close(); deleteRow(edRow); };
  $('edForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = edRow, t = $('edT').value;
    if (r.t === 'group' && t !== 'group') { const E = eff(r); r.s = E.s ?? nextWork(today()); r.e = E.e ?? endFor(r.s, 5); }
    r.n = $('edN').value.trim(); r.o = $('edO').value.trim(); r.nt = $('edNt').value.trim() || undefined; r.c = edC; r.sh = edSh; r.bs = edBs;
    if (t !== 'group') {
      let s = iso2n($('edS').value), en = iso2n($('edE').value);
      if (t === 'ms') { if (s == null) s = r.s ?? today(); en = s; }
      else {
        if (s == null && en != null) s = en;
        if (s != null && en == null) en = endFor(s, +$('edD').value || 5);
        if (s != null && en < s) en = s;
      }
      r.s = s; r.e = en;
      r.p = t === 'task' ? +$('edP').value : 0;
      setLinks(r, [...$('edDeps').querySelectorAll('.ed-link')].map((el) => {
        const p = S.byId.get(el.querySelector('.lp').value);
        return { p, n: p ? S.idx.get(p.id) + 1 : '?', k: el.querySelector('.lk').value, l: +el.querySelector('.ll input').value || 0 };
      }).filter((x) => x.p));
    } else r.dep = [];
    r.t = t;
    ed.close();
    schedule(); commit(); renderAll();
  });

  /* ---------------- menus, toolbar ---------------- */
  $('addT').onclick = () => add('task');
  $('addM').onclick = () => add('ms');
  $('addG').onclick = () => add('group');
  $('undo').onclick = undo; $('redo').onclick = redo;
  $('pname').addEventListener('input', () => { P.title = $('pname').value; document.title = P.title + ' — Timeline & Gantt'; saveSoon(); });
  $('pname').addEventListener('change', () => { P.title = $('pname').value.trim() || 'Untitled timeline'; commit(); toolbar(); });
  $('pname').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  $('barAll').onclick = (e) => {
    const b = e.target.closest('[data-bs]'); if (!b) return;
    P.opt.bar = b.dataset.bs; P.rows.forEach((r) => { delete r.bs; });
    commit(); renderAll();
  };
  document.querySelectorAll('[data-opt]').forEach((i) => i.addEventListener('change', () => {
    P.opt[i.dataset.opt] = i.checked;
    if (i.dataset.opt === 'auto' && i.checked) schedule();
    commit(); renderAll();
  }));

  document.querySelectorAll('.tl-menu').forEach((d) => d.addEventListener('toggle', () => {
    if (!d.open) return;
    document.querySelectorAll('.tl-menu[open]').forEach((o) => { if (o !== d) o.open = false; });
    if (d.id === 'openMenu') fillOpen();
  }));
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.tl-menu[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; });
    if (!$('pop').hidden && !e.target.closest('#pop, .sw')) closePop();
    if (!$('menu').hidden && !e.target.closest('#menu, .more')) closeMenu();
  });
  window.addEventListener('scroll', () => { closeMenu(); closePop(); }, { passive: true });
  const closeMenus = () => document.querySelectorAll('.tl-menu[open]').forEach((d) => { d.open = false; });

  $('tplList').innerHTML = Object.entries(TPL).map(([k, t]) => `<button class="tl-mi" data-tpl="${k}"><b>${esc(t.title)}</b><span>${esc(t.blurb)}</span></button>`).join('');
  $('tplList').onclick = (e) => { const b = e.target.closest('[data-tpl]'); if (!b) return; closeMenus(); openProject(fromTpl(b.dataset.tpl), null, { fit: true }); toast(`Started “${TPL[b.dataset.tpl].title}” — make it yours.`); };
  $('newBtn').onclick = () => { closeMenus(); save(); openProject(blank(), null); add('task'); };
  $('dupBtn').onclick = () => {
    closeMenus(); save();
    const copy = JSON.parse(JSON.stringify(P)); copy.title = P.title + ' (copy)';
    openProject(copy, null); toast(`Made “${copy.title}”. The original is still under File → Your timelines.`);
  };
  $('clearBtn').onclick = () => {
    closeMenus();
    if (!P.rows.length) return toast('This timeline is already empty.');
    const n = P.rows.length; P.rows = []; sel = null; commit(); renderAll();
    toast(`Cleared ${plural(n, 'row')}.`, 'Undo', undo);
  };
  let clearArm = 0;
  $('clearAll').onclick = (e) => {
    e.stopPropagation();
    const L = myList(), ids = Object.keys(L);
    if (!ids.length) return;
    if (Date.now() - clearArm > 4000) { clearArm = Date.now(); $('clearAll').textContent = `Click again to remove all ${ids.length}`; setTimeout(() => { $('clearAll').textContent = 'Remove all'; }, 4000); return; }
    clearArm = 0; $('clearAll').textContent = 'Remove all';
    const backup = ids.map((k) => [k, store.get('p:' + k)]);
    ids.forEach((k) => store.del('p:' + k)); store.set('list', '{}');
    closeMenus(); openProject(blank(), null);
    toast(`Removed ${plural(ids.length, 'timeline')} from this browser.`, 'Undo', () => {
      backup.forEach(([k, v]) => { if (v) store.set('p:' + k, v); }); store.set('list', JSON.stringify(L));
      const first = ids[0]; try { openProject(JSON.parse(store.get('p:' + first)), first); } catch (err) { /* nothing to reopen */ }
    });
  };
  function fillOpen() {
    const L = Object.entries(myList()).sort((a, b) => b[1].u - a[1].u);
    $('myList').innerHTML = L.length ? L.map(([k, v]) => `<div class="tl-my"><button class="tl-mi${k === pid ? ' cur' : ''}" data-open="${k}"><b>${esc(v.t || 'Untitled')}</b><span>Edited ${new Date(v.u).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span></button><button class="x" data-rm="${k}" aria-label="Remove ${esc(v.t)}" title="Remove from this browser">×</button></div>`).join('')
      : '<p class="tl-none">None yet.</p>';
  }
  $('myList').onclick = (e) => {
    const o = e.target.closest('[data-open]'), rm = e.target.closest('[data-rm]');
    if (o) {
      closeMenus();
      if (o.dataset.open === pid) return;
      save();
      try { openProject(JSON.parse(store.get('p:' + o.dataset.open)), o.dataset.open); } catch (err) { toast('That timeline could not be read.'); }
    } else if (rm) {
      const k = rm.dataset.rm, L = myList(), keepP = store.get('p:' + k), keepL = L[k];
      delete L[k]; store.set('list', JSON.stringify(L)); store.del('p:' + k);
      if (k === pid) { const next = Object.keys(L)[0]; if (next) openProject(JSON.parse(store.get('p:' + next)), next); else openProject(fromTpl('sample'), null, { fit: true }); }
      fillOpen();
      toast(`Removed “${keepL.t || 'Untitled'}” from this browser.`, 'Undo', () => { const L2 = myList(); L2[k] = keepL; store.set('list', JSON.stringify(L2)); store.set('p:' + k, keepP); fillOpen(); });
    }
  };
  $('fileBtn').onclick = () => $('file').click();
  $('file').onchange = async () => {
    const f = $('file').files[0]; $('file').value = ''; closeMenus();
    if (f) await importFile(f);
  };
  $('pasteBtn').onclick = () => { closeMenus(); $('pasteTx').value = ''; $('pasteDlg').showModal(); };
  $('pasteCancel').onclick = () => $('pasteDlg').close();
  $('pasteAdd').onclick = () => doPaste(false);
  $('pasteNew').onclick = () => doPaste(true);
  document.querySelector('.tl-empty').onclick = (e) => {
    const b = e.target.closest('[data-empty]'); if (!b) return; e.stopPropagation();
    if (b.dataset.empty === 'task') add('task');
    else if (b.dataset.empty === 'paste') $('pasteBtn').click();
    else { $('openMenu').open = true; }
  };

  // downloads
  document.querySelectorAll('#paper [data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === xopt.paper));
  $('paper').onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; xopt.paper = b.dataset.v; store.set('paper', b.dataset.v); document.querySelectorAll('#paper [data-v]').forEach((x) => x.classList.toggle('on', x === b)); };
  document.querySelectorAll('[data-xc]').forEach((i) => i.addEventListener('change', () => { xopt[i.dataset.xc] = i.checked; store.set('xc', JSON.stringify({ dates: xopt.dates, owner: xopt.owner, done: xopt.done })); }));
  $('dlBtns').onclick = async (e) => {
    const b = e.target.closest('[data-dl]'); if (!b) return;
    struct();
    if (!P.rows.length) return toast('Add a task first.');
    b.classList.add('busy');
    try {
      const k = b.dataset.dl;
      if (k === 'xlsx') await toXLSX();
      else if (k === 'pdf') await toPDF();
      else if (k === 'png') await toImage('png');
      else if (k === 'svg') await toImage('svg');
      else if (k === 'msp') download(new Blob([toMSP()], { type: 'application/xml' }), fileName() + '.xml');
      else if (k === 'csv') download(new Blob(['﻿' + toCSV()], { type: 'text/csv;charset=utf-8' }), fileName() + '.csv');
      else download(new Blob([JSON.stringify(fileJSON(), null, 1)], { type: 'application/json' }), fileName() + '.timeline.json');
      closeMenus();
    } catch (err) {
      console.error(err);
      toast(/load/i.test(err.message) ? 'Could not load the exporter — check the connection and try again.' : 'That download failed: ' + err.message);
    } finally { b.classList.remove('busy'); }
  };

  $('share').onclick = async () => {
    const code = await pack(fileJSON());
    const url = location.origin + location.pathname + '#t=' + code;
    let copied = false;
    try {
      await Promise.race([navigator.clipboard.writeText(url), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 1500))]);
      copied = true;
    } catch (e) { /* no clipboard permission */ }
    if (!copied) { history.replaceState(null, '', '#t=' + code); }
    toast(copied ? 'Link copied. The timeline travels inside the link — no one else can change your copy.' : 'Link is in the address bar — copy it from there.');
  };

  // keyboard
  document.addEventListener('keydown', (e) => {
    const inField = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z' && !inField) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y' && !inField) { e.preventDefault(); redo(); return; }
    if (mod && k === 'd' && sel && !document.querySelector('dialog[open]')) { e.preventDefault(); duplicate(S.byId.get(sel)); return; }
    if (inField || mod || e.altKey || document.querySelector('dialog[open]')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); deleteRow(S.byId.get(sel)); }
    else if (e.key === 'Enter' && sel) { e.preventDefault(); openEditor(S.byId.get(sel)); }
    else if (e.key === 'Insert') { e.preventDefault(); add('task'); }
    else if (e.key === 'ContextMenu' && sel) { e.preventDefault(); const el = tb.querySelector(`.tr[data-id="${sel}"] .more`); if (el) el.click(); }
    else if (e.key === '+' || e.key === '=') setZoom(P.ppd * 1.4);
    else if (e.key === '-' || e.key === '_') setZoom(P.ppd / 1.4);
    else if (k === 't') goToday();
    else if (k === 'f') fitZoom();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!V.length) return;
      const i = V.findIndex((v) => v.r.id === sel), j = clamp(i < 0 ? 0 : i + (e.key === 'ArrowDown' ? 1 : -1), 0, V.length - 1);
      e.preventDefault(); selectRow(V[j].r.id); ensureVisible(V[j].r);
    } else if (e.key === 'Escape') { closeMenus(); closePop(); closeMenu(); if (sel) { sel = null; renderAll(); } }
  });

  /* ---------------- toast ---------------- */
  let tt = null;
  function toast(msg, act, fn) {
    const t = $('toast');
    t.innerHTML = `<span>${esc(msg)}</span>` + (act ? `<button type="button">${esc(act)}</button>` : '');
    t.hidden = false;
    if (act) t.querySelector('button').onclick = () => { t.hidden = true; fn(); };
    clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, act ? 6500 : 3800);
  }

  /* ---------------- files: helpers ---------------- */
  const loaded = {};
  function need(k) {
    if (!loaded[k]) loaded[k] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = LIBS[k];
      s.onload = res; s.onerror = () => { loaded[k] = null; rej(new Error('Could not load ' + k)); };
      document.head.append(s);
    });
    return loaded[k];
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const fileName = () => (P.title || 'timeline').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'timeline';
  function fileJSON() {
    return { app: 'ranjithkb-timeline', v: 1, title: P.title, opt: P.opt, ppd: P.ppd, rows: P.rows.map((r) => {
      const o = { id: r.id, t: r.t, n: r.n };
      if (r.t !== 'group') { o.s = n2iso(r.s) || undefined; if (r.t === 'task') o.e = n2iso(r.e) || undefined; }
      if (r.p) o.p = r.p; if (r.o) o.o = r.o; if (r.c) o.c = r.c;
      if (r.dep && r.dep.length) o.dep = r.dep.map((d) => (d.k === 'FS' && !d.l ? d.id : d));
      if (r.sh) o.sh = r.sh; if (r.bs) o.bs = r.bs; if (r.nt) o.nt = r.nt; if (r.col) o.col = true;
      return o;
    }) };
  }
  const b64u = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = (s) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function pack(obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    if (window.CompressionStream) {
      const z = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
      return 'z' + b64u(new Uint8Array(z));
    }
    return 'j' + b64u(raw);
  }
  async function unpack(code) {
    const bytes = unb64u(code.slice(1));
    if (code[0] === 'z') return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text());
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  /* ---------------- import ---------------- */
  async function importFile(f) {
    const name = f.name.replace(/\.(timeline\.)?(json|xlsx|xls|csv|tsv|txt|xml|mpp)$/i, '');
    try {
      if (/\.json$/i.test(f.name)) {
        const o = JSON.parse(await f.text());
        if (!o || !Array.isArray(o.rows)) throw new Error('not a timeline file');
        openProject(o, null, { fit: true }); toast(`Opened “${P.title}”.`); return;
      }
      if (/\.mpp$/i.test(f.name)) return toast('.mpp files are locked to Microsoft Project — in Project, use File → Save As → XML, then open that here.');
      if (/\.xml$/i.test(f.name)) { fromMSP(await f.text(), name); return; }
      let aoa;
      if (/\.xlsx$/i.test(f.name)) aoa = await readXLSX(await f.arrayBuffer());
      else if (/\.xls$/i.test(f.name)) return toast('Old .xls files can’t be read here — save it as .xlsx or CSV first.');
      else aoa = parseDelimited(await f.text());
      fromTable(aoa, true, name);
    } catch (err) { console.error(err); toast('Could not read that file: ' + err.message); }
  }
  // Microsoft Project XML (also written by Primavera P6, ProjectLibre, GanttProject and others)
  function fromMSP(xml, name) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('that XML could not be read');
    const kid = (el, tag) => { for (const c of el.children) if (c.localName === tag) return c.textContent.trim(); return ''; };
    const root = doc.documentElement;
    const tasks = [...doc.getElementsByTagName('Task')].filter((t) => t.parentElement && t.parentElement.localName === 'Tasks');
    if (!tasks.length) throw new Error('no tasks found — is it a Microsoft Project XML file?');
    const day = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}))?/.exec(v || ''); return m ? [ymd(+m[1], m[2] - 1, +m[3]), +(m[4] || 12)] : [null, 0]; };
    const byUid = new Map(), out = [], links = [];
    for (const t of tasks) {
      const nm = kid(t, 'Name'), lvl = +kid(t, 'OutlineLevel') || 0;
      if (!nm || lvl === 0 || kid(t, 'IsNull') === '1') continue;
      const sum = kid(t, 'Summary') === '1', ms = kid(t, 'Milestone') === '1';
      const [s] = day(kid(t, 'Start')); let [e, eh] = day(kid(t, 'Finish'));
      if (e != null && s != null && e > s && eh <= 8) e -= 1;        // a finish at 08:00 means the day before
      const r = sum ? mk('group', nm) : ms ? mk('ms', nm, s, s) : mk('task', nm, s, e ?? s);
      const pc = +kid(t, 'PercentComplete'); if (!sum && pc) r.p = clamp(Math.round(pc), 0, 100);
      const nt = kid(t, 'Notes'); if (nt) r.nt = nt.slice(0, 600);
      byUid.set(kid(t, 'UID'), r); out.push(r);
      for (const pl of t.children) if (pl.localName === 'PredecessorLink') links.push([r, kid(pl, 'PredecessorUID'), kid(pl, 'Type'), +kid(pl, 'LinkLag') || 0, +kid(pl, 'LagFormat') || 7]);
    }
    for (const [r, u, ty, lag, fmt] of links) {
      const p = byUid.get(u); if (!p || p === r || r.t === 'group') continue;
      const k = { 0: 'FF', 1: 'FS', 2: 'SF', 3: 'SS' }[ty] || 'FS';
      const per = [4, 6, 8, 10, 12, 36, 38, 40].includes(fmt) ? 14400 : 4800;      // tenths of a minute per (elapsed) day
      r.dep.push({ id: p.id, k, l: Math.round(lag / per) });
    }
    if (!out.length) throw new Error('found no named tasks');
    const p = blank(kid(root, 'Title') || kid(root, 'Name').replace(/\.xml$/i, '') || name);
    p.opt.work = true;                                                  // Project counts working days
    p.rows = out;
    openProject(p, null, { fit: true });
    toast(`Opened ${plural(out.length, 'row')} from Microsoft Project. Use ⋯ on any row (or right-click) to insert activities in between.`);
  }
  function toMSP() {
    struct();
    const x = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const dt = (n, h) => n2iso(n) + 'T' + h + ':00:00';
    const wd = (s, e) => { let n = 0; for (let d = s; d <= e; d++) if (!weekend(d)) n++; return Math.max(n, 1); };
    const b = bounds() || [today(), today()];
    const uidOf = new Map(P.rows.map((r, i) => [r.id, i + 1]));
    let gno = 0, kno = 0, top = 0;
    const rows = P.rows.map((r, i) => {
      const E = eff(r), lvl = S.par.has(r.id) ? 2 : 1;
      if (r.t === 'group') { gno = ++top; kno = 0; } else if (lvl === 1) { top++; }
      const num = r.t === 'group' || lvl === 1 ? String(top) : gno + '.' + ++kno;
      const s = E.s ?? b[0], e = r.t === 'ms' ? s : E.e ?? s;
      const dur = r.t === 'ms' ? 0 : wd(s, e) * 8;
      let t = `<Task><UID>${i + 1}</UID><ID>${i + 1}</ID><Name>${x(r.n || 'Untitled')}</Name><Type>1</Type><IsNull>0</IsNull><WBS>${num}</WBS><OutlineNumber>${num}</OutlineNumber><OutlineLevel>${lvl}</OutlineLevel>`;
      t += `<Start>${dt(s, '08')}</Start><Finish>${dt(e, r.t === 'ms' ? '08' : '17')}</Finish><Duration>PT${dur}H0M0S</Duration><DurationFormat>7</DurationFormat>`;
      t += `<Milestone>${r.t === 'ms' ? 1 : 0}</Milestone><Summary>${r.t === 'group' ? 1 : 0}</Summary><PercentComplete>${r.t === 'ms' ? 0 : E.p || 0}</PercentComplete>`;
      if (r.t !== 'group' && !(r.dep || []).length) t += `<ConstraintType>4</ConstraintType><ConstraintDate>${dt(s, '08')}</ConstraintDate>`;
      if (r.nt) t += `<Notes>${x(r.nt)}</Notes>`;
      for (const d of r.dep || []) if (uidOf.has(d.id)) t += `<PredecessorLink><PredecessorUID>${uidOf.get(d.id)}</PredecessorUID><Type>${{ FF: 0, FS: 1, SF: 2, SS: 3 }[d.k]}</Type><CrossProject>0</CrossProject><LinkLag>${(d.l || 0) * 4800}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`;
      return t + '</Task>';
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Project xmlns="http://schemas.microsoft.com/project"><SaveVersion>14</SaveVersion><Name>${x(fileName())}.xml</Name><Title>${x(P.title)}</Title><ScheduleFromStart>1</ScheduleFromStart><StartDate>${dt(b[0], '08')}</StartDate><FinishDate>${dt(b[1], '17')}</FinishDate><MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>2400</MinutesPerWeek><DaysPerMonth>20</DaysPerMonth><Tasks>\n${rows.join('\n')}\n</Tasks></Project>`;
  }
  async function readXLSX(buf) {
    await need('exceljs');
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Tasks') || wb.worksheets[0];
    const val = (v) => {
      if (v == null) return '';
      if (v instanceof Date) return v;
      if (typeof v === 'object') {
        if ('result' in v) return val(v.result);
        if (v.richText) return v.richText.map((t) => t.text).join('');
        if ('text' in v) return v.text;
        return '';
      }
      return v;
    };
    const aoa = [];
    ws.eachRow({ includeEmpty: false }, (row) => { const vals = []; row.eachCell({ includeEmpty: true }, (c, col) => { vals[col - 1] = val(c.value); }); aoa.push(Array.from(vals, (x) => (x === undefined ? '' : x))); });
    return aoa;
  }
  function parseDelimited(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0];
    const delim = first.includes('\t') ? '\t' : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim()));
  }
  const HDR = [
    ['no', /^(#|no\.?|id|row|wbs|ref)$/i], ['t', /^(type|kind|item type)$/i], ['g', /^(phase|group|section|stage|stream|workstream|category|epic|swim ?lane|lane)$/i],
    ['n', /^(task|tasks|name|task name|activity|title|item|description|work ?item|deliverable|step|milestone|what)$/i],
    ['s', /^(start|begin|from|start ?date|planned start|baseline start|begins|date)$/i], ['e', /^(end|finish|due|to|end ?date|finish ?date|due ?date|deadline|planned (end|finish)|ends)$/i],
    ['d', /^(duration|dur|days|length|work ?days|duration \(days\))$/i], ['p', /(done|complete|progress|%)/i],
    ['o', /^(owner|resource|resources|assigned( to)?|assignee|who|lead|responsible|person)$/i], ['dep', /^(after|depends( on)?|predecessors?|dependenc(y|ies)|follows|comes after)$/i],
    ['c', /^colou?r$/i], ['nt', /^(notes?|comments?|remarks?)$/i],
  ];
  function mapHeader(row) {
    const col = {}; let n = 0;
    row.forEach((h, i) => {
      h = String(h ?? '').trim(); if (!h) return;
      for (const [k, rx] of HDR) if (col[k] == null && rx.test(h)) { col[k] = i; n++; break; }
    });
    return n >= 2 && (col.n != null || col.s != null) ? col : null;
  }
  function fromTable(aoa, asNew, name) {
    if (!aoa.length) return toast('Nothing to import.');
    let col = null, h = -1;
    for (let i = 0; i < Math.min(6, aoa.length); i++) { const c = mapHeader(aoa[i]); if (c) { col = c; h = i; break; } }
    if (!col) col = { n: 0, s: 1, e: 2, d: 3 };
    if (col.n == null) col.n = col.s === 0 ? 1 : 0;
    const data = aoa.slice(h + 1);
    // day-first or month-first?
    let dmy = !/^en-US/i.test(navigator.language || '');
    for (const r of data) for (const k of ['s', 'e']) {
      const m = /^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\s*$/.exec(String(r[col[k]] ?? ''));
      if (m) { if (+m[1] > 12) dmy = true; else if (+m[2] > 12) dmy = false; }
    }
    const date = (v) => {
      if (v == null || v === '') return null;
      if (v instanceof Date) return isNaN(v) ? null : ymd(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
      if (typeof v === 'number') return v > 20000 && v < 80000 ? Math.round(v) - 25569 : null;
      const s = String(v).trim();
      let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return ymd(+m[1], m[2] - 1, +m[3]);
      m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s);
      if (m) { let y = +m[3]; if (y < 100) y += 2000; return dmy ? ymd(y, m[2] - 1, +m[1]) : ymd(y, m[1] - 1, +m[2]); }
      if (/^\d{5}(\.\d+)?$/.test(s)) return date(+s);
      const t = Date.parse(s); if (!isNaN(t)) { const d = new Date(t); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); }
      return null;
    };
    const num = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
    const pvals = col.p != null ? data.map((r) => r[col.p]).filter((v) => typeof v === 'number') : [];
    const frac = pvals.length > 0 && pvals.every((v) => v <= 1);
    const typ = (v) => { v = String(v ?? ''); return /phase|group|summary|section|stage|heading|epic/i.test(v) ? 'group' : /mile|◆|^ms$/i.test(v) ? 'ms' : /task|activity|bar/i.test(v) ? 'task' : null; };

    const out = [], refs = new Map(), rawDeps = [];
    let phase = null;
    data.forEach((vals, k) => {
      const nm = String(vals[col.n] ?? '').trim(); if (!nm) return;
      if (col.g != null) {
        const ph = String(vals[col.g] ?? '').trim();
        if (ph && ph !== phase) { out.push(mk('group', ph)); phase = ph; }
      }
      let s = date(vals[col.s]), e = date(vals[col.e]);
      const d = col.d != null ? num(vals[col.d]) : null;
      let t = col.t != null ? typ(vals[col.t]) : null;
      if (!t) t = s == null && e == null ? 'pending' : d === 0 || (s != null && e == null && d == null) || (s == null && e != null && d == null) ? 'ms' : 'task';
      if (t === 'ms') { s = s ?? e; e = s; if (s == null) t = 'pending'; }
      if (t === 'task') {
        if (s == null && e != null) s = d ? e - Math.round(d) + 1 : e;
        if (s != null && e == null) e = d ? s + Math.round(d) - 1 : s;
        if (s != null && e < s) e = s;
      }
      const r = mk(t === 'pending' ? 'task' : t, nm, s, e);
      r._pending = t === 'pending';
      if (col.p != null) { let p = vals[col.p]; p = typeof p === 'number' ? (frac ? p * 100 : p) : num(String(p).replace('%', '')); r.p = clamp(Math.round(p || 0), 0, 100); }
      if (col.o != null) r.o = String(vals[col.o] ?? '').trim();
      if (col.c != null && /^#?[0-9a-f]{6}$/i.test(String(vals[col.c]).trim())) r.c = '#' + String(vals[col.c]).trim().replace('#', '').toUpperCase();
      if (col.nt != null && String(vals[col.nt] ?? '').trim()) r.nt = String(vals[col.nt]).trim();
      const key = col.no != null && num(vals[col.no]) != null ? num(vals[col.no]) : k + 1;
      refs.set(key, r);
      if (col.dep != null) rawDeps.push([r, String(vals[col.dep] ?? '')]);
      out.push(r);
    });
    // an undated row followed by dated rows is a heading
    out.forEach((r, i) => {
      if (!r._pending) return;
      const nx = out[i + 1];
      if (col.t == null && col.g == null && nx && nx.s != null) { r.t = 'group'; r.s = r.e = null; }
      delete r._pending;
    });
    for (const [r, txt] of rawDeps) {
      r.dep = [];
      for (const x of parseDeps(txt)) { const p = refs.get(x.n); if (p && p !== r && !r.dep.some((d) => d.id === p.id)) r.dep.push({ id: p.id, k: x.k, l: x.l }); }
    }
    if (!out.length) return toast('Found no rows with a task name.');
    const dated = out.filter((r) => r.s != null).length;
    if (asNew) { const p = blank(name || 'Imported timeline'); p.rows = out; openProject(p, null, { fit: true }); }
    else { P.rows.push(...out); commit(); fitZoom(); }
    toast(`Brought in ${plural(out.length, 'row')}${dated < out.length ? ` (${out.length - dated} without dates — drag across the chart to give them some)` : ''}.`);
  }
  function doPaste(asNew) {
    const tx = $('pasteTx').value;
    if (!tx.trim()) return;
    $('pasteDlg').close();
    fromTable(parseDelimited(tx), asNew, 'Pasted timeline');
  }

  /* ---------------- export: table rows ---------------- */
  function tableRows() {
    return P.rows.map((r, i) => {
      const E = eff(r);
      return {
        no: i + 1, name: r.n, type: r.t === 'group' ? 'Phase' : r.t === 'ms' ? 'Milestone' : 'Task',
        s: E.s, e: r.t === 'ms' ? E.s : E.e, d: r.t === 'ms' ? 0 : days(E.s, E.e), p: r.t === 'ms' ? null : E.p || 0,
        o: r.o || '', dep: depsText(r), c: colour(r), nt: r.nt || '', lvl: S.par.has(r.id) ? 1 : 0,
      };
    });
  }
  function toCSV() {
    struct();
    const q = (v) => { v = String(v ?? ''); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const lines = [['#', 'Name', 'Type', 'Start', 'End', work() ? 'Working days' : 'Days', 'Done %', 'Owner', 'After', 'Colour', 'Notes'].join(',')];
    for (const t of tableRows()) lines.push([t.no, t.name, t.type, n2iso(t.s), n2iso(t.e), t.d ?? '', t.p ?? '', t.o, t.dep, t.c, t.nt].map(q).join(','));
    return lines.join('\r\n');
  }

  /* ---------------- export: Excel (live Gantt) ---------------- */
  const colL = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const argb = (hex) => 'FF' + hex.slice(1).toUpperCase();
  const tint = (hex, a) => 'FF' + [1, 3, 5].map((i) => Math.round(255 - (255 - parseInt(hex.slice(i, i + 2), 16)) * a).toString(16).padStart(2, '0')).join('').toUpperCase();
  const xdate = (n) => new Date(n * DAY);
  async function toXLSX() {
    await need('exceljs');
    struct();
    const b = bounds(); if (!b) throw new Error('add dates to at least one task first');
    const span = b[1] - b[0] + 1;
    const unit = span <= 150 ? 'day' : span <= 7 * 150 ? 'week' : 'month';
    const ticks = []; for (let t = startU(b[0], unit); t <= b[1]; t = nextU(t, unit)) ticks.push(t);
    const T0 = 9, LAST = colL(T0 + ticks.length - 1), TL = colL(T0), R0 = 4, RN = R0 + P.rows.length - 1;
    const rows = tableRows();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Timeline · ranjithkb.com'; wb.created = new Date(); wb.title = P.title;
    const thin = { style: 'thin', color: { argb: 'FFE3DED5' } };
    const font = { name: 'Calibri', size: 10, color: { argb: 'FF1B1B1F' } };

    const ws = wb.addWorksheet('Gantt', {
      views: [{ state: 'frozen', xSplit: 8, ySplit: 3, showGridLines: false }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: xopt.paper === 'a3' ? 8 : xopt.paper === 'letter' ? 1 : xopt.paper === 'tabloid' ? 3 : 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }, printTitlesRow: '1:3' },
      properties: { defaultRowHeight: 18 },
    });
    ws.columns = [{ width: 5 }, { width: 36 }, { width: 14 }, { width: 11.5 }, { width: 11.5 }, { width: 7 }, { width: 7 }, { width: 3, hidden: true },
      ...ticks.map(() => ({ width: unit === 'day' ? 3.4 : unit === 'week' ? 6.2 : 6.5 }))];
    ws.getCell('A1').value = P.title; ws.getCell('A1').font = { ...font, size: 15, bold: true };
    ws.getRow(1).height = 26;
    ws.getCell('B2').value = 'Change Start, End or Done and the bars redraw. Red column: today.';
    ws.getCell('B2').font = { ...font, size: 8.5, italic: true, color: { argb: 'FF7A7A80' } };
    // top tier
    const topU = unit === 'month' ? 'year' : 'month';
    for (let i = 0; i < ticks.length;) {
      const k = startU(ticks[i], topU); let j = i;
      while (j + 1 < ticks.length && startU(ticks[j + 1], topU) === k) j++;
      const c = ws.getCell(2, T0 + i);
      c.value = topU === 'year' ? String(parts(k)[0]) : MON[parts(k)[1]] + ' ' + parts(k)[0];
      c.font = { ...font, size: 9, bold: true }; c.alignment = { horizontal: 'left', vertical: 'middle' };
      c.border = { left: { style: 'thin', color: { argb: 'FFB9B2A6' } } };
      if (j > i) ws.mergeCells(2, T0 + i, 2, T0 + j);
      i = j + 1;
    }
    // headings
    ['#', 'Task', 'Owner', 'Start', 'End', work() ? 'Work d.' : 'Days', 'Done', 'key'].forEach((h, k) => {
      const c = ws.getCell(3, k + 1); c.value = h;
      c.font = { ...font, size: 8.5, bold: true, color: { argb: 'FF55555A' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1EEE8' } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFB9B2A6' } } };
      c.alignment = { vertical: 'middle', horizontal: k >= 3 ? 'center' : 'left' };
    });
    ticks.forEach((t, k) => {
      const c = ws.getCell(3, T0 + k); c.value = xdate(t);
      c.numFmt = unit === 'day' ? 'd' : unit === 'week' ? 'd mmm' : 'mmm';
      c.font = { ...font, size: unit === 'day' ? 8 : 7.5, color: { argb: 'FF55555A' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1EEE8' } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFB9B2A6' } } };
    });
    ws.getRow(3).height = 20;

    const keys = [], keyOf = (hex) => { let k = keys.indexOf(hex); if (k < 0) { keys.push(hex); k = keys.length - 1; } return k + 1; };
    const cEnd = (L) => (unit === 'day' ? `${L}$3` : unit === 'week' ? `${L}$3+6` : `EOMONTH(${L}$3,0)`);
    rows.forEach((t, i) => {
      const R = R0 + i, row = ws.getRow(R), r = P.rows[i], g = r.t === 'group';
      row.height = 19;
      row.getCell(1).value = t.no;
      row.getCell(2).value = t.name;
      row.getCell(3).value = t.o;
      if (g) {
        const kids = S.kids.get(r.id);
        if (kids.length && t.s != null) {
          const a = R + 1, z = R + kids.length;
          row.getCell(4).value = { formula: `MIN(D${a}:D${z})`, result: xdate(t.s) };
          row.getCell(5).value = { formula: `MAX(E${a}:E${z})`, result: xdate(t.e) };
          row.getCell(7).value = { formula: `IFERROR(SUMPRODUCT((E${a}:E${z}-D${a}:D${z}+1)*G${a}:G${z}*(H${a}:H${z}>0))/SUMPRODUCT((E${a}:E${z}-D${a}:D${z}+1)*(H${a}:H${z}>0)),0)`, result: (t.p || 0) / 100 };
        }
      } else if (t.s != null) {
        row.getCell(4).value = xdate(t.s);
        row.getCell(5).value = r.t === 'ms' ? { formula: `D${R}`, result: xdate(t.s) } : xdate(t.e);
        if (r.t === 'task') row.getCell(7).value = (t.p || 0) / 100;
      }
      if (t.s != null && r.t !== 'ms') row.getCell(6).value = { formula: work() ? `NETWORKDAYS(D${R},E${R})` : `E${R}-D${R}+1`, result: t.d };
      row.getCell(8).value = t.s == null || r.t === 'ms' ? 0 : keyOf(t.c);
      for (let k = 1; k <= 8; k++) {
        const c = row.getCell(k);
        c.font = { ...font, bold: g, color: { argb: k === 1 ? 'FF8A8A90' : 'FF1B1B1F' } };
        c.alignment = { vertical: 'middle', horizontal: k >= 4 ? 'center' : 'left', indent: k === 2 && t.lvl ? 1 : 0 };
        c.border = { bottom: thin };
        if (g) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F0F7' } };
      }
      row.getCell(4).numFmt = row.getCell(5).numFmt = 'd mmm yy';
      row.getCell(7).numFmt = '0%';
      for (let k = 0; k < ticks.length; k++) {
        const c = row.getCell(T0 + k), L = colL(T0 + k);
        c.border = { bottom: thin, right: thin };
        if (r.t === 'ms' && t.s != null) {
          c.value = { formula: `IF(AND(${L}$3<=$D${R},${cEnd(L)}>=$D${R}),"◆","")`, result: ticks[k] <= t.s && (k + 1 >= ticks.length || ticks[k + 1] > t.s) ? '◆' : '' };
          c.font = { name: 'Calibri', size: 12, bold: true, color: { argb: argb(t.c) } };
          c.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }
    });
    // the bars are conditional formats, so they follow the dates
    const ref = `${TL}${R0}:${LAST}${RN}`, over = `${TL}$3<=$E${R0},${cEnd(TL)}>=$D${R0}`;
    const rules = []; let pr = 1;
    const fill = (a) => ({ fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: a } } });
    keys.forEach((hex, k) => rules.push({ type: 'expression', priority: pr++, formulae: [`AND($H${R0}=${k + 1},${over},${TL}$3<$D${R0}+($E${R0}-$D${R0}+1)*$G${R0})`], style: fill(argb(hex)) }));
    keys.forEach((hex, k) => rules.push({ type: 'expression', priority: pr++, formulae: [`AND($H${R0}=${k + 1},${over})`], style: fill(tint(hex, 0.3)) }));
    rules.push({ type: 'expression', priority: pr++, formulae: [`AND(${TL}$3<=TODAY(),${cEnd(TL)}>=TODAY())`], style: fill('FFF8DEDA') });
    if (unit === 'day') rules.push({ type: 'expression', priority: pr++, formulae: [`WEEKDAY(${TL}$3,2)>5`], style: fill('FFF4F2EE') });
    ws.addConditionalFormatting({ ref, rules });
    ws.addConditionalFormatting({ ref: `${TL}3:${LAST}3`, rules: [{ type: 'expression', priority: pr++, formulae: [`AND(${TL}$3<=TODAY(),${cEnd(TL)}>=TODAY())`], style: { ...fill('FFC2463D'), font: { color: { argb: 'FFFFFFFF' }, bold: true } } }] });

    // a plain list, also what this tool reads back in
    const wt = wb.addWorksheet('Tasks', { views: [{ state: 'frozen', ySplit: 1 }] });
    wt.columns = [{ header: '#', width: 5 }, { header: 'Name', width: 40 }, { header: 'Type', width: 11 }, { header: 'Start', width: 13 }, { header: 'End', width: 13 }, { header: work() ? 'Working days' : 'Days', width: 9 },
      { header: 'Done %', width: 8 }, { header: 'Owner', width: 16 }, { header: 'After', width: 10 }, { header: 'Colour', width: 10 }, { header: 'Notes', width: 44 }];
    rows.forEach((t) => {
      const row = wt.addRow([t.no, t.name, t.type, t.s != null ? xdate(t.s) : null, t.e != null ? xdate(t.e) : null, t.d, t.p, t.o, t.dep, t.c, t.nt]);
      row.getCell(4).numFmt = row.getCell(5).numFmt = 'd mmm yyyy';
      row.getCell(2).alignment = { indent: t.lvl };
      if (t.type === 'Phase') row.font = { bold: true };
    });
    const hr = wt.getRow(1); hr.font = { bold: true }; hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1EEE8' } };
    wt.autoFilter = { from: 'A1', to: 'K1' };

    const buf = await wb.xlsx.writeBuffer();
    download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName() + '.xlsx');
  }

  /* ---------------- export: PDF / PNG / SVG ---------------- */
  const PRINT_CSS = `.bg{fill:#fff}.hd{fill:#F4F2EE}.hb{stroke:#CFC9BE;fill:none}.gl{stroke:#ECE9E3;fill:none}.gm{stroke:#DCD7CD;fill:none}.rl{stroke:#EEEBE5;fill:none}.we{fill:#F6F4F0}.band{fill:#F2EFF7}
.hx{font:400 10px 'IBM Plex Mono',monospace;fill:#6B6B70}.hx.wk{fill:#ABABB0}.hy{font:500 10.5px 'IBM Plex Mono',monospace;fill:#1B1B1F;letter-spacing:.04em}
.td{stroke:#C2463D;stroke-width:1.5}.tdm{fill:#C2463D}.dep{fill:none;stroke:#8A8A90;stroke-width:1.2}.dep.c{stroke:#C2463D}.arw{fill:#8A8A90}.arw.c{fill:#C2463D}
.bl,.tt{font:500 12px 'Space Grotesk',Arial,sans-serif;fill:#1B1B1F}.gbl,.tg{font:600 12px 'Space Grotesk',Arial,sans-serif;fill:#1B1B1F}.pl{font:400 10px 'IBM Plex Mono',monospace;fill:#6B6B70}.crit{stroke:#C2463D;stroke-width:2}
.xt{font:600 22px 'Space Grotesk',Arial,sans-serif;fill:#1B1B1F}.xs,.xf{font:400 10.5px 'IBM Plex Mono',monospace;fill:#6B6B70}.th{font:500 9.5px 'IBM Plex Mono',monospace;fill:#6B6B70;letter-spacing:.08em}
.tm{font:400 10.5px 'IBM Plex Mono',monospace;fill:#55555A}.tn{font:400 10px 'IBM Plex Mono',monospace;fill:#9A9AA0}.fr{fill:none;stroke:#CFC9BE}.acc{fill:#5C4D7D}`;

  function tableCols(rowsV) {
    let nw = 60;
    for (const v of rowsV) nw = Math.max(nw, tw(v.r.n || '', v.r.t === 'group' ? F_GLAB : F_LAB) + (v.lvl ? 12 : 0));
    const cols = [{ k: 'no', w: 30, h: '#' }, { k: 'n', w: Math.min(290, nw + 22), h: 'TASK' }];
    if (xopt.dates) cols.push({ k: 's', w: 84, h: 'START' }, { k: 'e', w: 84, h: 'END' });
    if (xopt.owner) { let ow = 50; for (const v of rowsV) ow = Math.max(ow, tw(v.r.o || '', F_MONO)); cols.push({ k: 'o', w: Math.min(150, ow + 20), h: 'OWNER' }); }
    if (xopt.done) cols.push({ k: 'p', w: 48, h: 'DONE' });
    return cols;
  }
  function exportDoc(rowsV, o) {
    const pad = 28, TH = 66, FH = 34;
    const cols = o.cols, TW = cols.reduce((a, c) => a + c.w, 0);
    const ch = chart(rowsV, { ...o, print: true });
    const W = pad * 2 + TW + ch.W, H = pad * 2 + TH + ch.H + FH;
    const b = bounds(), n = counts();
    const sub = [b ? fmtRange(b[0], b[1]) : '', plural(n.t, 'task'), plural(n.m, 'milestone')].filter(Boolean).join('  ·  ');
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>/*FONTS*/${PRINT_CSS}</style><rect width="${W}" height="${H}" fill="#fff"/>`;
    s += `<rect class="acc" x="${pad}" y="${pad}" width="28" height="3"/><text class="xt" x="${pad}" y="${pad + 30}">${esc(P.title)}</text><text class="xs" x="${pad}" y="${pad + 50}">${esc(sub)}</text>`;
    // table
    let t = `<rect class="hd" width="${TW}" height="${HEAD}"/><path class="hb" d="M0 ${HEAD - 0.5}H${TW}"/>`;
    let x = 0;
    for (const c of cols) { t += `<text class="th" x="${c.k === 'no' ? x + c.w / 2 : x + 8}" y="${HEAD - 14}"${c.k === 'no' ? ' text-anchor="middle"' : ''}>${c.h}</text>`; x += c.w; }
    rowsV.forEach((v, i) => {
      const r = v.r, E = eff(r), y = HEAD + i * ROW;
      if (r.t === 'group') t += `<rect class="band" y="${y}" width="${TW}" height="${ROW}"/>`;
      t += `<path class="rl" d="M0 ${y + ROW - 0.5}H${TW}"/>`;
      let cx = 0;
      for (const c of cols) {
        const ty = y + 20;
        if (c.k === 'no') t += `<text class="tn" x="${cx + c.w / 2}" y="${ty}" text-anchor="middle">${v.i + 1}</text>`;
        else if (c.k === 'n') {
          const ind = v.lvl ? 12 : 0, f = r.t === 'group' ? F_GLAB : F_LAB;
          t += `<rect x="${cx + 8 + ind}" y="${y + 11}" width="9" height="9" rx="1.5" fill="${colour(r)}"${r.t === 'ms' ? ` transform="rotate(45 ${cx + 12.5 + ind} ${y + 15.5})"` : ''}/>`;
          t += `<text class="${r.t === 'group' ? 'tg' : 'tt'}" x="${cx + 24 + ind}" y="${ty}">${esc(fit(r.n, f, c.w - 30 - ind))}</text>`;
        } else if (c.k === 's') t += `<text class="tm" x="${cx + 8}" y="${ty}">${fmtD(E.s, true)}</text>`;
        else if (c.k === 'e') t += `<text class="tm" x="${cx + 8}" y="${ty}">${r.t === 'ms' ? '' : fmtD(E.e, true)}</text>`;
        else if (c.k === 'o') t += `<text class="tm" x="${cx + 8}" y="${ty}">${esc(fit(r.o, F_MONO, c.w - 14))}</text>`;
        else if (c.k === 'p') t += `<text class="tm" x="${cx + c.w - 8}" y="${ty}" text-anchor="end">${r.t === 'ms' || E.s == null ? '' : (E.p || 0) + '%'}</text>`;
        cx += c.w;
      }
    });
    const top = pad + TH;
    s += `<g transform="translate(${pad},${top})">${t}</g><g transform="translate(${pad + TW},${top})">${ch.svg}</g>`;
    s += `<rect class="fr" x="${pad + 0.5}" y="${top + 0.5}" width="${TW + ch.W - 1}" height="${ch.H - 1}"/><path class="hb" d="M${pad + TW + 0.5} ${top}V${top + ch.H}"/>`;
    const legend = [P.opt.today ? `Red line: today, ${fmtD(today(), true)}` : '', P.opt.crit ? 'Outlined in red: critical path' : '', P.opt.prog ? 'Solid part of a bar: done' : ''].filter(Boolean).join('   ·   ');
    s += `<text class="xf" x="${pad}" y="${H - pad + 6}">${esc(legend)}</text><text class="xf" x="${W - pad}" y="${H - pad + 6}" text-anchor="end">${o.pages > 1 ? `Page ${o.page} of ${o.pages}   ·   ` : ''}Made with ranjithkb.com/productivity/timeline</text>`;
    return { svg: s + '</svg>', W, H };
  }
  let fontCache = new Map();
  async function withFonts(svg) {
    const chars = [...new Set(svg.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;|&#\d+;/g, ' ') + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789%·–… ')].sort().join('');
    if (!fontCache.has(chars)) fontCache.set(chars, (async () => {
      try {
        const css = await (await fetch('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&family=IBM+Plex+Mono:wght@400;500&display=block&text=' + encodeURIComponent(chars))).text();
        let out = css;
        for (const u of new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))) {
          const blob = await (await fetch(u)).blob();
          const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
          out = out.split(u).join(data);
        }
        return out;
      } catch (e) { return ''; }
    })());
    return svg.replace('/*FONTS*/', await fontCache.get(chars));
  }
  async function raster(svg, W, H, scale) {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = new Image(); img.src = url;
      await img.decode();
      await new Promise((r) => setTimeout(r, 60));
      const c = document.createElement('canvas');
      c.width = Math.round(W * scale); c.height = Math.round(H * scale);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }
  async function toImage(kind) {
    struct();
    const rowsV = visible();
    const [x0, x1] = range(P.ppd, 0, rowsV);
    const d = exportDoc(rowsV, { x0, x1, ppd: P.ppd, cols: tableCols(rowsV), page: 1, pages: 1 });
    const svg = await withFonts(d.svg);
    if (kind === 'svg') return download(new Blob([svg], { type: 'image/svg+xml' }), fileName() + '.svg');
    const scale = Math.max(1, Math.min(2, 14000 / d.W, 14000 / d.H, Math.sqrt(100e6 / (d.W * d.H))));
    const c = await raster(svg, d.W, d.H, scale);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    download(blob, fileName() + '.png');
  }
  async function toPDF() {
    await need('jspdf');
    struct();
    const [pw, ph] = PAPER[xopt.paper];
    const VW = Math.round(pw * 4.8), VH = (VW * ph) / pw;
    const rowsV = visible(), cols = tableCols(rowsV), TW = cols.reduce((a, c) => a + c.w, 0);
    const avail = VW - 56 - TW;
    const b = bounds() || [today(), today() + 30];
    let ppd = avail / (b[1] - b[0] + 1);
    for (let k = 0; k < 6; k++) {
      const [x0, x1] = range(ppd, 0, rowsV), w = (x1 - x0) * ppd;
      if (w <= avail + 1) break;
      ppd *= avail / w;
    }
    const [x0] = range(ppd, 0, rowsV), x1 = x0 + avail / ppd;
    const per = Math.max(4, Math.floor((VH - 56 - 66 - 34 - HEAD) / ROW));
    const chunks = []; for (let i = 0; i < Math.max(1, rowsV.length); i += per) chunks.push(rowsV.slice(i, i + per));
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: xopt.paper });
    doc.setProperties({ title: P.title, creator: 'ranjithkb.com timeline' });
    for (let i = 0; i < chunks.length; i++) {
      const d = exportDoc(chunks[i], { x0, x1, ppd, cols, page: i + 1, pages: chunks.length });
      const c = await raster(await withFonts(d.svg), d.W, d.H, 2);
      if (i) doc.addPage(xopt.paper, 'landscape');
      const w = pw, h = Math.min(ph, (d.H * pw) / d.W);
      doc.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, w, h, undefined, 'FAST');
    }
    doc.save(fileName() + '.pdf');
  }

  /* ---------------- start ---------------- */
  try { Object.assign(shown, JSON.parse(store.get('cols')) || {}); } catch (e) { /* default */ }
  applyCols();
  try { const pp = store.get('paper'); if (PAPER[pp]) xopt.paper = pp; else if (/^en-(US|CA)/.test(navigator.language || '')) xopt.paper = 'letter'; } catch (e) { /* ignore */ }
  try { Object.assign(xopt, JSON.parse(store.get('xc')) || {}); } catch (e) { /* ignore */ }
  document.querySelectorAll('#paper [data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === xopt.paper));
  document.querySelectorAll('[data-xc]').forEach((i) => { i.checked = !!xopt[i.dataset.xc]; });

  async function start() {
    const h = /^#t=([\w-]+)$/.exec(location.hash);
    if (h) {
      try {
        const o = await unpack(h[1]);
        history.replaceState(null, '', location.pathname);
        openProject(o, null, { fit: true });
        toast(`Opened a shared timeline: “${P.title}”. It is now saved as your own copy.`);
        return;
      } catch (e) { toast('That shared link could not be read.'); }
    }
    const cur = store.get('cur');
    let p = null;
    try { p = cur && JSON.parse(store.get('p:' + cur)); } catch (e) { p = null; }
    if (p) openProject(p, cur);
    else openProject(fromTpl('sample'), null, { fit: true });
  }
  window.addEventListener('pagehide', () => { if (P) save(); });
  window.addEventListener('hashchange', () => { if (/^#t=/.test(location.hash)) start(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { mcache.clear(); if (P) drawChart(); });
  start();
  if (/[?&]debug\b/.test(location.search)) window.__tl = { get P() { return P; }, renderAll, fromTable, toXLSX, toPDF, toImage, parseDelimited, exportDoc, visible, range, tableCols, withFonts };
})();
