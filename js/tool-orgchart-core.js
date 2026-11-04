/* ============================================================
   TOOL — Org chart generator: everything that isn't the screen.
   A chart = {
     v, title, page, arrange, corners,
     fields: [{id, name, align:'l|c|r', bold}],     the rows of text in a box
     people: [{id, parent, dotted, vals:{fieldId:text}, style:{fill,border,text},
               line:{dash,color,width}, parentText, dottedText, unsure}],
     box:{fill,border,text}, levels:[{fill,border,text}], line:{dash,color,width}
   }
   fit(chart) lays the chart out on the chosen page; the preview, the
   PowerPoint and the Word picture all draw from that one result, so what
   you see is what you download. Office files are written by hand with
   JSZip so PowerPoint gets real shapes and attached connectors.
   ============================================================ */
window.OrgCore = (function () {
  'use strict';
  var PAGES = {
    ppt169: { label: 'Widescreen (16:9)', group: 'PowerPoint', kind: 'pptx', w: 960, h: 540, m: 22 },
    ppt43: { label: 'Standard (4:3)', group: 'PowerPoint', kind: 'pptx', w: 720, h: 540, m: 20 },
    a4l: { label: 'A4 landscape', group: 'Word', kind: 'docx', w: 841.89, h: 595.28, m: 36 },
    a4p: { label: 'A4 portrait', group: 'Word', kind: 'docx', w: 595.28, h: 841.89, m: 36 },
    img169: { label: 'Widescreen (16:9)', group: 'Image', kind: 'png', w: 960, h: 540, m: 22 },
    img43: { label: 'Standard (4:3)', group: 'Image', kind: 'png', w: 720, h: 540, m: 20 },
    imga4l: { label: 'A4 landscape', group: 'Image', kind: 'png', w: 841.89, h: 595.28, m: 24 },
    imga4p: { label: 'A4 portrait', group: 'Image', kind: 'png', w: 595.28, h: 841.89, m: 24 }
  };
  // k = how wide the font runs compared with Arial, so sizes stay right on devices without it
  var FONTS = {
    'Arial': { k: 1, css: "Arial, Helvetica, 'Liberation Sans', sans-serif" },
    'Calibri': { k: 0.95, css: "Calibri, Carlito, Arial, sans-serif" },
    'Aptos': { k: 1.02, css: "Aptos, Calibri, Carlito, Arial, sans-serif" },
    'Segoe UI': { k: 1.02, css: "'Segoe UI', Arial, sans-serif" },
    'Tahoma': { k: 1.02, css: "Tahoma, Verdana, Arial, sans-serif" },
    'Trebuchet MS': { k: 1.02, css: "'Trebuchet MS', Arial, sans-serif" },
    'Verdana': { k: 1.18, css: "Verdana, Arial, sans-serif" },
    'Cambria': { k: 1, css: "Cambria, Caladea, Georgia, serif" },
    'Georgia': { k: 1.08, css: "Georgia, 'Liberation Serif', serif" },
    'Times New Roman': { k: 0.94, css: "'Times New Roman', Times, 'Liberation Serif', serif" },
    'Courier New': { k: 1.25, css: "'Courier New', Courier, 'Liberation Mono', monospace" }
  };
  var SIZES = { s: 0.85, m: 1, l: 1.2, xl: 1.45 };
  var MAX_PT = 16, MIN_PT = 8, NS = 'https://ranjithkb.com/orgchart';
  var LH = 1.2, PADX = 0.55, PADY = 0.42;
  var HEX = /^#[0-9A-Fa-f]{6}$/;
  var uid = function () { return Math.random().toString(36).slice(2, 9); };

  // ---------- text measuring (per em, in Arial, like the export) ----------
  var ctx = null, cache = {};
  function em(s, bold) {
    var k = (bold ? 'b' : 'n') + s;
    if (cache[k] != null) return cache[k];
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = (bold ? 'bold ' : '') + '100px Arial, "Liberation Sans", Helvetica, sans-serif';
    return (cache[k] = ctx.measureText(s).width / 100 * 1.04);
  }
  function wrap(text, width, bold) {
    var words = String(text).trim().split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (cur && em(t, bold) > width) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------- hierarchy ----------
  function forest(chart) {
    var by = {}, kids = {}, roots = [], depth = {}, inLoop = {};
    chart.people.forEach(function (p) { by[p.id] = p; kids[p.id] = []; });
    chart.people.forEach(function (p) {
      var seen = {}, c = p;
      while (c && c.parent && by[c.parent]) {
        if (seen[c.id]) { inLoop[p.id] = true; break; }
        seen[c.id] = 1; c = by[c.parent];
      }
    });
    chart.people.forEach(function (p) {
      if (p.parent && by[p.parent] && !inLoop[p.id]) kids[p.parent].push(p.id); else roots.push(p.id);
    });
    (function walk(ids, d) { ids.forEach(function (i) { depth[i] = d; walk(kids[i], d + 1); }); })(roots, 0);
    return { by: by, kids: kids, roots: roots, depth: depth, inLoop: inLoop };
  }

  // Boxes chosen to sit together in a column or matrix: siblings sharing p.grp, in table order
  function blocksOf(chart, t) {
    var by = {}, items = {};
    chart.people.forEach(function (p) {
      if (p.grp && t.by[p.parent] && !t.inLoop[p.id]) { var k = p.parent + '|' + p.grp; (by[k] = by[k] || []).push(p); }
    });
    Object.keys(t.kids).forEach(function (id) {
      var done = {}, list = [];
      t.kids[id].forEach(function (c) {
        var p = t.by[c], k = p.grp ? id + '|' + p.grp : null;
        if (k && by[k] && by[k].length > 1) {
          if (!done[k]) { done[k] = 1; list.push({ block: by[k].map(function (x) { return x.id; }), cols: Math.max(1, by[k][0].cols || 1) }); }
        } else list.push({ id: c });
      });
      items[id] = list;
    });
    return items;
  }

  // Lay out in "em" units. D = each box's width and height. mode: wide | stack1 | stack2
  // (the last level hangs down in one or two columns). Rows line up by depth.
  function arrange(t, D, items, hg, vg, mode) {
    var pos = {}, IND = 1.1, SG = 0.5, RG = 1, BUS = 0.5, stackOf = {}, size = {}, lvl = {};
    Object.keys(D).forEach(function (i) { var d = t.depth[i] || 0; lvl[d] = Math.max(lvl[d] || 0, D[i].h); });
    function isStack(id) {
      var k = t.kids[id];
      return mode !== 'wide' && k.length >= 2 && items[id].length === k.length && k.every(function (c) { return !t.kids[c].length; });
    }
    function widest(ids) { return ids.reduce(function (m, i) { return Math.max(m, D[i].w); }, 0); }
    function sumH(ids, step) { return ids.reduce(function (m, i) { return m + D[i].h + step; }, 0); }
    function blockSize(b) {
      var ms = b.block.map(measure), c = Math.min(b.cols, ms.length), rows = Math.ceil(ms.length / c), colW = [], rowH = [];
      ms.forEach(function (m, i) { var j = i % c, r = Math.floor(i / c); colW[j] = Math.max(colW[j] || 0, m.w); rowH[r] = Math.max(rowH[r] || 0, m.h); });
      var xs = [], x = 0; colW.forEach(function (w, j) { xs[j] = x; x += w + hg; });
      var side = c === 1, sp, w;
      if (side) { sp = 0; w = IND + colW[0]; } else { var g = Math.floor(c / 2) - 1; sp = xs[g] + colW[g] + hg / 2; w = x - hg; }
      var gap = side ? SG : RG, h = rowH.reduce(function (m, v) { return m + v; }, 0) + gap * (rows - 1);
      b.m = { ms: ms, c: c, colW: colW, rowH: rowH, xs: xs, side: side, gap: gap };
      return { w: w, a: sp, h: h };
    }
    function measure(id) {
      var k = t.kids[id], s, pw = D[id].w, ph = lvl[t.depth[id] || 0];
      if (!k.length) s = { w: pw, a: pw / 2, h: D[id].h };
      else if (isStack(id)) {
        stackOf[id] = mode;
        if (mode === 'stack1') {
          var mw = widest(k);
          s = { w: Math.max(pw, pw / 2 + IND + mw), a: pw / 2, h: D[id].h + vg * 0.75 + sumH(k, SG) };
        } else {
          var L = k.filter(function (_, i) { return i % 2 === 0; }), R = k.filter(function (_, i) { return i % 2 === 1; });
          var a = Math.max(widest(L) + IND, pw / 2);
          s = { w: a + Math.max(widest(R) + IND, pw / 2), a: a, h: D[id].h + vg * 0.75 + Math.max(sumH(L, SG), sumH(R, SG)) };
        }
      } else {
        var sum = 0, first = 0, last = 0, tall = 0, n = items[id].length;
        items[id].forEach(function (it, i) {
          var m = it.block ? blockSize(it) : measure(it.id);
          it.s = m;
          if (i === 0) first = sum + m.a;
          if (i === n - 1) last = sum + m.a;
          sum += m.w + (i < n - 1 ? hg : 0); tall = Math.max(tall, m.h);
        });
        var c0 = (first + last) / 2, shift = Math.max(0, pw / 2 - c0);
        s = { w: Math.max(sum + shift, c0 + shift + pw / 2), a: c0 + shift, shift: shift, h: ph + vg + tall };
      }
      size[id] = s; return s;
    }
    function placeBlock(b, left, top) {
      var m = b.m, sp = left + b.s.a, y = top;
      b.block.forEach(function (c, i) {
        var j = i % m.c, r = Math.floor(i / m.c);
        if (j === 0 && r) y += m.rowH[r - 1] + m.gap;
        var cell = left + m.xs[j], mm = m.ms[i];
        if (m.side) place(c, sp + IND, y); // whole team stays right of the line, so it never crosses a box
        else place(c, cell + (m.colW[j] - mm.w) / 2, y);
        pos[c].blk = { spine: sp, bus: y - BUS, side: m.side, top: top };
      });
    }
    function place(id, left, top) {
      var s = size[id], k = t.kids[id], cx = left + s.a, h = D[id].h;
      pos[id] = { x: cx - D[id].w / 2, y: top };
      if (!k.length) return;
      var y0 = top + h + vg * 0.75;
      if (stackOf[id] === 'stack1') {
        k.forEach(function (c) { pos[c] = { x: cx + IND, y: y0, side: 'r' }; y0 += D[c].h + SG; });
      } else if (stackOf[id]) {
        var yl = y0, yr = y0;
        k.forEach(function (c, i) {
          if (i % 2) { pos[c] = { x: cx + IND, y: yr, side: 'r' }; yr += D[c].h + SG; }
          else { pos[c] = { x: cx - IND - D[c].w, y: yl, side: 'l' }; yl += D[c].h + SG; }
        });
      } else {
        var x = left + (s.shift || 0), yk = top + lvl[t.depth[id] || 0] + vg;
        items[id].forEach(function (it) {
          if (it.block) placeBlock(it, x, yk); else place(it.id, x, yk);
          x += it.s.w + hg;
        });
      }
    }
    var x = 0;
    t.roots.forEach(function (r) { measure(r); place(r, x, 0); x += size[r].w + hg * 1.5; });
    var maxX = 0, maxY = 0, minX = 0;
    Object.keys(pos).forEach(function (i) {
      maxX = Math.max(maxX, pos[i].x + D[i].w); maxY = Math.max(maxY, pos[i].y + D[i].h); minX = Math.min(minX, pos[i].x);
    });
    return { pos: pos, stack: stackOf, ext: { w: maxX - minX, h: maxY, x0: minX } };
  }

  // Rows of text grouped into lines: a row marked "same line" joins the one above (up to three on a line).
  // Two on a line sit left and right; three sit left, centre and right.
  function lineGroups(chart) {
    var g = [];
    chart.fields.forEach(function (fd) {
      if (fd.join && g.length && g[g.length - 1].length < 3) g[g.length - 1].push(fd); else g.push([fd]);
    });
    return g;
  }
  function fieldLines(chart, p) {
    var out = [];
    lineGroups(chart).forEach(function (fs) {
      var pos = fs.length === 1 ? [fs[0].align] : fs.length === 2 ? ['l', 'r'] : ['l', 'c', 'r'], size = 0, cells = [];
      fs.forEach(function (fd, i) {
        var v = String(p.vals[fd.id] || '').trim(); size = Math.max(size, SIZES[fd.size] || 1);
        if (v) cells.push({ t: v, pos: pos[i], bold: !!fd.bold, italic: !!fd.italic, underline: !!fd.underline, fd: fd });
      });
      if (cells.length) out.push({ cells: cells, size: size, multi: fs.length > 1, slots: fs.length });
    });
    return out;
  }
  function splitWidth(l, k) { // width a shared line needs, in em, at this font
    var w = function (c) { return c ? em(c.t, c.bold) * k * l.size : 0; }, by = function (q) { return l.cells.filter(function (c) { return c.pos === q; })[0]; };
    var a = w(by('l')), b = w(by('c')), c = w(by('r'));
    return Math.max(a + b + c + 2 * l.size, 2 * Math.max(a, c) + b + (b ? 2 : 1) * l.size);
  }

  function styleOf(chart, p, d) {
    var lv = chart.levels[d] || {}, s = p.style || {}, f2 = s.fill2 || lv.fill2 || chart.box.fill2;
    return {
      fill2: f2 && f2 !== 'none' ? f2 : null,
      fill: s.fill || lv.fill || chart.box.fill,
      border: s.border || lv.border || chart.box.border,
      text: s.text || lv.text || chart.box.text
    };
  }

  // Fit the whole chart on the page: tries box widths and arrangements, keeps the largest readable text.
  function fit(chart) {
    var page = PAGES[chart.page] || PAGES.ppt169, t = forest(chart);
    var titleH = chart.title ? 34 : 0;
    var aw = page.w - 2 * page.m - 4, ah = page.h - 2 * page.m - titleH - 4; // 4 pt spare keeps edge borders inside the page
    var res = { page: page, nodes: [], edges: [], f: MAX_PT, tooSmall: false, title: chart.title || '', tree: t };
    if (!chart.people.length) return res;

    var longestWord = 3, k = (FONTS[chart.font] || FONTS.Arial).k, linesOf = {};
    chart.people.forEach(function (p) {
      var ls = fieldLines(chart, p); linesOf[p.id] = ls;
      ls.forEach(function (l) {
        if (l.multi) longestWord = Math.max(longestWord, splitWidth(l, k));
        else String(l.cells[0].t).split(/\s+/).forEach(function (w) { longestWord = Math.max(longestWord, em(w, l.cells[0].bold) * k * l.size); });
      });
    });
    var minW = longestWord + 2 * PADX + 0.1;
    var widths = [7, 8.5, 10, 12, 14, 17, 20, 25].map(function (w) { return Math.max(w, minW); })
      .filter(function (w, i, a) { return a.indexOf(w) === i; });
    var modes = chart.arrange === 'auto' || !chart.arrange ? ['wide', 'stack1', 'stack2'] : [chart.arrange];
    var best = null, HG = 0.8, VG = 1.7;
    // Box sizes for one base width: resized boxes scale from the base, but never below their own text.
    var items = blocksOf(chart, t), ownMin = {};
    chart.people.forEach(function (p) {
      var m = 3;
      linesOf[p.id].forEach(function (l) {
        if (l.multi) m = Math.max(m, splitWidth(l, k));
        else String(l.cells[0].t).split(/\s+/).forEach(function (w) { m = Math.max(m, em(w, l.cells[0].bold) * k * l.size); });
      });
      ownMin[p.id] = m + 2 * PADX + 0.1;
    });
    function dims(W) {
      var D = {}, base = 0, any = 0;
      chart.people.forEach(function (p) {
        var w = Math.max(W * (p.sw || 1), ownMin[p.id]), inner = w - 2 * PADX, c = 0;
        linesOf[p.id].forEach(function (l) { c += l.size * (l.multi ? 1 : wrap(l.cells[0].t, inner / (k * l.size), l.cells[0].bold).length); });
        var nat = Math.max(1, c) * LH + 2 * PADY;
        D[p.id] = { w: w, h: nat };
        any = Math.max(any, nat);
        if (!p.sh || p.sh === 1) base = Math.max(base, nat);
      });
      base = base || any;
      chart.people.forEach(function (p) { D[p.id].h = Math.max(D[p.id].h, base * (p.sh || 1)); });
      return D;
    }
    widths.forEach(function (W) {
      var D = dims(W);
      modes.forEach(function (m) {
        var L = arrange(t, D, items, HG, VG, m);
        var f = Math.min(aw / L.ext.w, ah / L.ext.h), used = Math.min(f, MAX_PT);
        var fill = (L.ext.w * used * L.ext.h * used) / (aw * ah);
        var score = used * (1 + 0.25 * fill) - (m === 'wide' ? 0 : 0.02);
        if (!best || score > best.score) best = { score: score, W: W, D: D, m: m, f: used };
      });
    });
    // Spread the spare room into the gaps so the chart fills the page, then settle the final size.
    var f = best.f, leaves = 0, rows = 0;
    Object.keys(t.kids).forEach(function (i) { if (!t.kids[i].length) leaves++; rows = Math.max(rows, t.depth[i] || 0); });
    var L0 = arrange(t, best.D, items, HG, VG, best.m);
    var hg = Math.min(3.2, HG + Math.max(0, aw / f - L0.ext.w) / Math.max(1, leaves - 1));
    var vg = Math.min(9, VG + Math.max(0, ah / f - L0.ext.h) / Math.max(1, rows));
    var L = arrange(t, best.D, items, hg, vg, best.m);
    f = Math.min(f, aw / L.ext.w, ah / L.ext.h);
    res.f = Math.floor(f * 10) / 10; f = res.f;
    res.tooSmall = f < MIN_PT; res.mode = best.m;

    var ox = page.m + 2 + (aw - L.ext.w * f) / 2 - L.ext.x0 * f;
    var oy = page.m + 2 + titleH + (ah - L.ext.h * f) / 2;
    var map = {};
    chart.people.forEach(function (p) {
      var q = L.pos[p.id]; if (!q) return;
      var dd = best.D[p.id], inner = dd.w - 2 * PADX, bw = dd.w * f, bh = dd.h * f;
      var d = t.depth[p.id] || 0, st = styleOf(chart, p, d), lines = [];
      var paras = linesOf[p.id];
      paras.forEach(function (l) {
        if (l.multi) { lines.push(l); return; }
        var c = l.cells[0];
        wrap(c.t, inner / (k * l.size), c.bold).forEach(function (s) {
          lines.push({ size: l.size, cells: [{ t: s, pos: c.pos, bold: c.bold, italic: c.italic, underline: c.underline }] });
        });
      });
      var n = { id: p.id, x: ox + q.x * f, y: oy + q.y * f, w: bw, h: bh, depth: d, lines: lines, paras: paras, side: q.side, blk: q.blk ? { spine: ox + q.blk.spine * f, bus: oy + q.blk.bus * f, side: q.blk.side, top: oy + q.blk.top * f } : null, fill2: st.fill2, fill: st.fill, border: st.border, text: st.text };
      map[p.id] = n; res.nodes.push(n);
    });
    var lineOf = function (p) {
      var a = chart.line, b = p.line || {};
      return { dash: b.dash || a.dash, color: b.color || a.color, width: b.width || a.width };
    };
    chart.people.forEach(function (p) {
      var c = map[p.id], par = !t.inLoop[p.id] && map[p.parent];
      if (c && par) {
        var px = par.x + par.w / 2, py = par.y + par.h, cx = c.x + c.w / 2, cy = c.y, st = lineOf(p), e;
        if (c.blk) {
          var b = c.blk, sp = b.spine, mid = py + (b.top - py) / 2, same = Math.abs(sp - px) < 0.5, ey2 = c.y + c.h / 2;
          var dx = Math.abs(cx - px) < 1 ? 1 : cx - px, dxs = Math.abs(c.x - px) < 1 ? 1 : c.x - px;
          if (b.side) {
            e = same
              ? { type: 'bent2', from: par.id, to: c.id, sf: 2, st: 1, pts: [[px, py], [px, ey2], [c.x, ey2]] }
              : { type: 'bent4', from: par.id, to: c.id, sf: 2, st: 1, pts: [[px, py], [px, mid], [sp, mid], [sp, ey2], [c.x, ey2]], adj: [(mid - py) / (ey2 - py), (sp - px) / dxs] };
          } else {
            e = same
              ? { type: 'bent3', from: par.id, to: c.id, sf: 2, st: 0, pts: [[px, py], [px, b.bus], [cx, b.bus], [cx, cy]], adj: [(b.bus - py) / (cy - py)] }
              : { type: 'bent5', from: par.id, to: c.id, sf: 2, st: 0, pts: [[px, py], [px, mid], [sp, mid], [sp, b.bus], [cx, b.bus], [cx, cy]], adj: [(mid - py) / (cy - py), (sp - px) / dx, (b.bus - py) / (cy - py)] };
          }
        } else if (c.side) {
          var ey = c.y + c.h / 2, ex = c.side === 'r' ? c.x : c.x + c.w;
          e = { type: 'bent2', from: par.id, to: c.id, sf: 2, st: c.side === 'r' ? 1 : 3, pts: [[px, py], [px, ey], [ex, ey]] };
        } else if (Math.abs(px - cx) < 0.5) {
          e = { type: 'straight', from: par.id, to: c.id, sf: 2, st: 0, pts: [[px, py], [px, cy]] };
        } else {
          var by = py + (cy - py) / 2;
          e = { type: 'bent3', from: par.id, to: c.id, sf: 2, st: 0, pts: [[px, py], [px, by], [cx, by], [cx, cy]] };
        }
        e.kind = 'tree'; e.dash = st.dash; e.color = st.color; e.width = st.width; e.person = p.id;
        res.edges.push(e);
      }
      var dm = map[p.dotted];
      if (c && dm && dm !== c) {
        var sa = sites(dm), sb = sites(c), bi = 0, bj = 0, bd = 1e12;
        // shortest join that doesn't run behind another box
        sa.forEach(function (a, i) { sb.forEach(function (b, j) {
          var dd = Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2), hits = 0;
          res.nodes.forEach(function (n) { if (crosses(a, b, n)) hits++; });
          dd += hits * 1e7;
          if (dd < bd) { bd = dd; bi = i; bj = j; }
        }); });
        var ls = lineOf(p);
        res.edges.push({ type: 'straight', kind: 'dotted', from: dm.id, to: c.id, sf: bi, st: bj, pts: [sa[bi], sb[bj]], dash: 'dash', color: ls.color, width: ls.width, person: p.id });
      }
    });
    return res;
  }
  function crosses(a, b, n) { // does the line a-b pass through box n (touching its edge doesn't count)?
    for (var t = 0.02; t < 1; t += 0.02) {
      var x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      if (x > n.x + 1 && x < n.x + n.w - 1 && y > n.y + 1 && y < n.y + n.h - 1) return true;
    }
    return false;
  }
  function sites(n) { return [[n.x + n.w / 2, n.y], [n.x, n.y + n.h / 2], [n.x + n.w / 2, n.y + n.h], [n.x + n.w, n.y + n.h / 2]]; }

  // ---------- SVG (preview and the Word picture) ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function dashArray(w) { return (w * 4) + ' ' + (w * 3); }
  function toSvg(r, chart, opt) {
    opt = opt || {};
    var SVGFONT = (FONTS[chart.font] || FONTS.Arial).css;
    var p = r.page, vb = opt.inner ? [p.m, p.m, p.w - 2 * p.m, p.h - 2 * p.m] : [0, 0, p.w, p.h];
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '"' +
      (opt.px ? ' width="' + opt.px + '" height="' + Math.round(opt.px * vb[3] / vb[2]) + '"' : '') +
      ' font-family="' + SVGFONT + '" role="img" aria-label="Org chart">'];
    var grads = r.nodes.filter(function (n) { return n.fill2; });
    if (grads.length) {
      var ver = chart.gradDir === 'v';
      o.push('<defs>' + grads.map(function (n, i) {
        n.gid = 'ocg' + i;
        return '<linearGradient id="ocg' + i + '" x1="0" y1="0" x2="' + (ver ? 0 : 1) + '" y2="' + (ver ? 1 : 0) + '"><stop offset="0" stop-color="' + n.fill + '"/><stop offset="1" stop-color="' + n.fill2 + '"/></linearGradient>';
      }).join('') + '</defs>');
    }
    o.push('<rect x="' + vb[0] + '" y="' + vb[1] + '" width="' + vb[2] + '" height="' + vb[3] + '" fill="#FFFFFF"/>');
    if (r.title) o.push('<text x="' + (p.w / 2) + '" y="' + (p.m + 18) + '" text-anchor="middle" font-size="18" font-weight="bold" fill="#1B1B1F">' + esc(r.title) + '</text>');
    r.edges.forEach(function (e) {
      var d = e.pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(2) + ' ' + q[1].toFixed(2); }).join('');
      o.push('<path d="' + d + '" fill="none" stroke="' + e.color + '" stroke-width="' + e.width + '"' +
        (e.dash === 'dash' ? ' stroke-dasharray="' + dashArray(e.width) + '"' : '') + '/>');
      if (opt.live) o.push('<path class="oc-hit" data-line="' + e.person + '" d="' + d + '" fill="none" stroke="transparent" stroke-width="10"/>');
    });
    var rad = chart.corners === 'round' ? Math.min(8, r.f * 0.6) : 0;
    r.nodes.forEach(function (n) {
      o.push('<g' + (opt.live ? ' class="oc-box" data-id="' + n.id + '"' : '') + '>');
      o.push('<rect x="' + n.x.toFixed(2) + '" y="' + n.y.toFixed(2) + '" width="' + n.w.toFixed(2) + '" height="' + n.h.toFixed(2) + '"' + (rad ? ' rx="' + rad + '"' : '') + ' fill="' + (n.fill2 ? 'url(#' + n.gid + ')' : n.fill) + '" stroke="' + n.border + '" stroke-width="1"/>');
      var total = n.lines.reduce(function (m, l) { return m + l.size * r.f * LH; }, 0), y = n.y + (n.h - total) / 2, pad = PADX * r.f;
      n.lines.forEach(function (l) {
        var fs = r.f * l.size, lh = fs * LH, base = y + lh * 0.8;
        l.cells.forEach(function (c) {
          var x = c.pos === 'l' ? n.x + pad : c.pos === 'r' ? n.x + n.w - pad : n.x + n.w / 2;
          o.push('<text x="' + x.toFixed(2) + '" y="' + base.toFixed(2) + '" font-size="' + fs.toFixed(2) + '" fill="' + n.text + '"' +
            (c.bold ? ' font-weight="bold"' : '') + (c.italic ? ' font-style="italic"' : '') + (c.underline ? ' text-decoration="underline"' : '') +
            ' text-anchor="' + (c.pos === 'l' ? 'start' : c.pos === 'r' ? 'end' : 'middle') + '">' + esc(c.t) + '</text>');
        });
        y += lh;
      });
      o.push('</g>');
    });
    o.push('</svg>');
    return o.join('');
  }

  // ---------- writing Office files ----------
  var X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  function xe(s) {
    return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  var E = function (pt) { return Math.round(pt * 12700); };
  var RGB = function (c) { return String(c).replace('#', '').toUpperCase(); };
  function savedXml(chart) { return X + '<orgchart xmlns="' + NS + '">' + xe(JSON.stringify(chart)) + '</orgchart>'; }
  function coreProps(title) {
    return X + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xe(title || 'Org chart') + '</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().slice(0, 19) + 'Z</dcterms:created></cp:coreProperties>';
  }
  var THEME = X + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Org chart"><a:themeElements><a:clrScheme name="Org chart"><a:dk1><a:srgbClr val="1B1B1F"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="2E4374"/></a:dk2><a:lt2><a:srgbClr val="F0EDE6"/></a:lt2><a:accent1><a:srgbClr val="5C4D7D"/></a:accent1><a:accent2><a:srgbClr val="2E4374"/></a:accent2><a:accent3><a:srgbClr val="2F6B4F"/></a:accent3><a:accent4><a:srgbClr val="B8860B"/></a:accent4><a:accent5><a:srgbClr val="1F6F78"/></a:accent5><a:accent6><a:srgbClr val="A33A2C"/></a:accent6><a:hlink><a:srgbClr val="2E4374"/></a:hlink><a:folHlink><a:srgbClr val="5C4D7D"/></a:folHlink></a:clrScheme><a:fontScheme name="Org chart"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
  var EMPTY_TREE = '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  var PNS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  var RT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  var rels = function (arr) {
    return X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      arr.map(function (r, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="' + (r[0].indexOf('http') === 0 ? r[0] : RT + r[0]) + '" Target="' + r[1] + '"/>'; }).join('') + '</Relationships>';
  };

  function connectorXml(e, id, ids) {
    var a = e.pts[0], b = e.pts[e.pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], xf, geom;
    if (e.type === 'straight') {
      var fx = dx < 0 ? ' flipH="1"' : '', fy = dy < 0 ? ' flipV="1"' : '';
      xf = '<a:xfrm' + fx + fy + '><a:off x="' + E(Math.min(a[0], b[0])) + '" y="' + E(Math.min(a[1], b[1])) + '"/><a:ext cx="' + E(Math.abs(dx)) + '" cy="' + E(Math.abs(dy)) + '"/></a:xfrm>';
      geom = 'straightConnector1';
    } else {
      // vertical-first elbows are PowerPoint's elbow turned a quarter: rot 90° = runs to the left, 270° + flip = to the right
      var cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, l = Math.abs(dy), s = Math.max(Math.abs(dx), /bent[45]/.test(e.type) ? 1 : 0);
      var attr = dx < 0 ? ' rot="5400000"' : ' rot="16200000" flipH="1"';
      xf = '<a:xfrm' + attr + '><a:off x="' + E(cx - l / 2) + '" y="' + E(cy - s / 2) + '"/><a:ext cx="' + E(l) + '" cy="' + E(s) + '"/></a:xfrm>';
      geom = { bent2: 'bentConnector2', bent3: 'bentConnector3', bent4: 'bentConnector4', bent5: 'bentConnector5' }[e.type];
    }
    var adj = e.adj || (geom === 'bentConnector3' ? [0.5] : []);
    var av = adj.length ? '<a:avLst>' + adj.map(function (v, i) { return '<a:gd name="adj' + (i + 1) + '" fmla="val ' + Math.round(v * 100000) + '"/>'; }).join('') + '</a:avLst>' : '<a:avLst/>';
    return '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="' + id + '" name="' + (e.kind === 'dotted' ? 'Dotted line ' : 'Reporting line ') + id + '"/><p:cNvCxnSpPr>' +
      '<a:stCxn id="' + ids[e.from] + '" idx="' + e.sf + '"/><a:endCxn id="' + ids[e.to] + '" idx="' + e.st + '"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr>' +
      '<p:spPr>' + xf + '<a:prstGeom prst="' + geom + '">' + av + '</a:prstGeom><a:ln w="' + E(e.width) + '"><a:solidFill><a:srgbClr val="' + RGB(e.color) + '"/></a:solidFill><a:prstDash val="' + (e.dash === 'dash' ? 'dash' : 'solid') + '"/></a:ln></p:spPr></p:cxnSp>';
  }
  function boxXml(n, id, r, chart) {
    var FONT = chart.font || 'Arial', inset = E(PADX * r.f * 0.8), insetY = E(PADY * r.f * 0.5), width = E(n.w) - 2 * inset;
    var rPr = function (c, sz) {
      return '<a:rPr lang="en-GB" sz="' + sz + '" b="' + (c.bold ? 1 : 0) + '" i="' + (c.italic ? 1 : 0) + '"' + (c.underline ? ' u="sng"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + RGB(n.text) + '"/></a:solidFill><a:latin typeface="' + xe(FONT) + '"/><a:cs typeface="' + xe(FONT) + '"/></a:rPr>';
    };
    var run = function (c, sz, t) { return '<a:r>' + rPr(c, sz) + '<a:t>' + xe(t) + '</a:t></a:r>'; };
    var sz0 = Math.max(100, Math.round(r.f * 100));
    var paras = n.paras.map(function (l) {
      var sz = Math.max(100, Math.round(r.f * l.size * 100));
      if (!l.multi) {
        var c = l.cells[0];
        return '<a:p><a:pPr algn="' + (c.pos === 'l' ? 'l' : c.pos === 'r' ? 'r' : 'ctr') + '"/>' + run(c, sz, c.t) + '</a:p>';
      }
      // a shared line is one paragraph with tab stops, so it stays editable text
      var order = l.slots === 2 ? ['l', 'r'] : ['l', 'c', 'r'], rEdge = width - 12700, runs = '';
      var tabs = (l.slots === 3 ? '<a:tab pos="' + Math.round(width / 2) + '" algn="ctr"/>' : '') + '<a:tab pos="' + rEdge + '" algn="r"/>';
      order.forEach(function (q, i) {
        var c = l.cells.filter(function (x) { return x.pos === q; })[0], any = c || l.cells[0];
        if (i) runs += run(any, sz, '\t');
        if (c) runs += run(c, sz, c.t);
      });
      return '<a:p><a:pPr algn="l"><a:tabLst>' + tabs + '</a:tabLst></a:pPr>' + runs + '</a:p>';
    }).join('') || '<a:p><a:endParaRPr lang="en-GB" sz="' + sz0 + '"/></a:p>';
    var fillXml = n.fill2
      ? '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="' + RGB(n.fill) + '"/></a:gs><a:gs pos="100000"><a:srgbClr val="' + RGB(n.fill2) + '"/></a:gs></a:gsLst><a:lin ang="' + (chart.gradDir === 'v' ? 5400000 : 0) + '" scaled="0"/></a:gradFill>'
      : '<a:solidFill><a:srgbClr val="' + RGB(n.fill) + '"/></a:solidFill>';
    return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="oc:' + xe(n.id) + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + E(n.x) + '" y="' + E(n.y) + '"/><a:ext cx="' + E(n.w) + '" cy="' + E(n.h) + '"/></a:xfrm>' +
      '<a:prstGeom prst="' + (chart.corners === 'round' ? 'roundRect' : 'rect') + '"><a:avLst/></a:prstGeom>' + fillXml + '<a:ln w="12700"><a:solidFill><a:srgbClr val="' + RGB(n.border) + '"/></a:solidFill></a:ln></p:spPr>' +
      '<p:txBody><a:bodyPr wrap="square" lIns="' + inset + '" tIns="' + insetY + '" rIns="' + inset + '" bIns="' + insetY + '" rtlCol="0" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/>' + paras + '</p:txBody></p:sp>';
  }
  function buildPptx(chart, r) {
    var p = r.page, z = new window.JSZip(), id = 2, ids = {}, shapes = [], cx = E(p.w), cy = E(p.h), FONT = xe(chart.font || 'Arial');
    r.nodes.forEach(function (n) { ids[n.id] = id++; });
    if (r.title) {
      shapes.push('<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Chart title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + E(p.m) + '" y="' + E(p.m - 4) + '"/><a:ext cx="' + E(p.w - 2 * p.m) + '" cy="' + E(30) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-GB" sz="1800" b="1" dirty="0"><a:solidFill><a:srgbClr val="1B1B1F"/></a:solidFill><a:latin typeface="' + FONT + '"/><a:cs typeface="' + FONT + '"/></a:rPr><a:t>' + xe(r.title) + '</a:t></a:r></a:p></p:txBody></p:sp>');
      id++;
    }
    r.edges.forEach(function (e) { shapes.push(connectorXml(e, id++, ids)); });
    r.nodes.forEach(function (n) { shapes.push(boxXml(n, ids[n.id], r, chart)); });

    z.file('[Content_Types].xml', X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    z.file('_rels/.rels', rels([['officeDocument', 'ppt/presentation.xml'], ['http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml']]));
    z.file('docProps/core.xml', coreProps(chart.title));
    z.file('ppt/presentation.xml', X + '<p:presentation ' + PNS + ' saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="' + cx + '" cy="' + cy + '"' + (chart.page === 'ppt43' ? ' type="screen4x3"' : '') + '/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>');
    z.file('ppt/_rels/presentation.xml.rels', rels([['slideMaster', 'slideMasters/slideMaster1.xml'], ['slide', 'slides/slide1.xml'], ['theme', 'theme/theme1.xml'], ['customXml', '../customXml/item1.xml']]));
    z.file('customXml/item1.xml', savedXml(chart));
    z.file('ppt/theme/theme1.xml', THEME);
    z.file('ppt/slideMasters/slideMaster1.xml', X + '<p:sldMaster ' + PNS + '>' + EMPTY_TREE + '</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>');
    z.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['slideLayout', '../slideLayouts/slideLayout1.xml'], ['theme', '../theme/theme1.xml']]));
    z.file('ppt/slideLayouts/slideLayout1.xml', X + '<p:sldLayout ' + PNS + ' type="blank" preserve="1">' + EMPTY_TREE.replace('<p:cSld>', '<p:cSld name="Blank">') + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');
    z.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['slideMaster', '../slideMasters/slideMaster1.xml']]));
    z.file('ppt/slides/slide1.xml', X + '<p:sld ' + PNS + '>' + EMPTY_TREE + shapes.join('') + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>');
    z.file('ppt/slides/_rels/slide1.xml.rels', rels([['slideLayout', '../slideLayouts/slideLayout1.xml']]));
    return z.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }

  function buildDocx(chart, r, pngBlob) {
    var p = r.page, z = new window.JSZip(), tw = function (pt) { return Math.round(pt * 20); };
    var w = p.w - 2 * p.m, h = p.h - 2 * p.m, k = (h - 6) / h; // a whisker short so Word keeps it on one page
    var cx = E(w * k), cy = E(h * k), landscape = p.w > p.h;
    var alt = xe('Org chart' + (chart.title ? ': ' + chart.title : ''));
    z.file('[Content_Types].xml', X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    z.file('_rels/.rels', rels([['officeDocument', 'word/document.xml'], ['http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml']]));
    z.file('docProps/core.xml', coreProps(chart.title));
    z.file('customXml/item1.xml', savedXml(chart));
    z.file('word/media/orgchart.png', pngBlob);
    z.file('word/_rels/document.xml.rels', rels([['image', 'media/orgchart.png'], ['customXml', '../customXml/item1.xml']]));
    z.file('word/document.xml', X + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="1" name="Org chart" descr="' + alt + '"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="orgchart.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:sectPr><w:pgSz w:w="' + tw(p.w) + '" w:h="' + tw(p.h) + '"' + (landscape ? ' w:orient="landscape"' : '') + '/><w:pgMar w:top="' + tw(p.m) + '" w:right="' + tw(p.m) + '" w:bottom="' + tw(p.m) + '" w:left="' + tw(p.m) + '" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>');
    return z.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // ---------- reading older PowerPoint and Word charts ----------
  var kidsOf = function (n, name) { return Array.prototype.filter.call(n.children || [], function (c) { return !name || c.localName === name; }); };
  var kid = function (n, name) { return n ? kidsOf(n, name)[0] : null; };
  var deep = function (n, name) { return n ? Array.prototype.slice.call(n.getElementsByTagNameNS('*', name)) : []; };
  var parse = function (s) { return new DOMParser().parseFromString(s, 'application/xml'); };

  function hexLum(hex, mod, off) {
    var n = parseInt(hex, 16), rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { return v / 255; });
    var mx = Math.max.apply(0, rgb), mn = Math.min.apply(0, rgb), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === rgb[0] ? ((rgb[1] - rgb[2]) / d + 6) % 6 : mx === rgb[1] ? (rgb[2] - rgb[0]) / d + 2 : (rgb[0] - rgb[1]) / d + 4;
    }
    l = Math.min(1, l * mod + off);
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2;
    var o = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6];
    return o.map(function (v) { var q = Math.round((v + m) * 255).toString(16); return q.length < 2 ? '0' + q : q; }).join('');
  }
  function themeColours(xml) {
    var map = {}; if (!xml) return map;
    var cs = deep(parse(xml), 'clrScheme')[0]; if (!cs) return map;
    kidsOf(cs).forEach(function (c) {
      var v = c.firstElementChild; if (v) map[c.localName] = (v.getAttribute('val') && v.localName === 'srgbClr') ? v.getAttribute('val') : (v.getAttribute('lastClr') || '000000');
    });
    map.tx1 = map.dk1; map.bg1 = map.lt1; map.tx2 = map.dk2; map.bg2 = map.lt2;
    return map;
  }
  function colourIn(node, theme) { // node holds a srgbClr / schemeClr child
    if (!node) return null;
    var c = kid(node, 'srgbClr') || kid(node, 'schemeClr'), hex;
    if (!c) return null;
    hex = c.localName === 'srgbClr' ? c.getAttribute('val') : theme[c.getAttribute('val')];
    if (!hex) return null;
    var mod = kid(c, 'lumMod'), off = kid(c, 'lumOff');
    if (mod || off) hex = hexLum(hex, mod ? +mod.getAttribute('val') / 100000 : 1, off ? +off.getAttribute('val') / 100000 : 0);
    return '#' + hex.toUpperCase();
  }
  function shapeInfo(sp, theme) {
    var pr = kid(sp, 'spPr'), style = kid(sp, 'style'), geo = pr && kid(pr, 'prstGeom'), ln = pr && kid(pr, 'ln'), out = {};
    out.geom = geo ? geo.getAttribute('prst') : '';
    var nf = pr && kid(pr, 'noFill'), sf = pr && kid(pr, 'solidFill');
    var gf = pr && kid(pr, 'gradFill');
    if (gf) {
      var stops = deep(gf, 'gs').sort(function (a, b) { return +a.getAttribute('pos') - +b.getAttribute('pos'); });
      if (stops.length) { out.fill = colourIn(stops[0], theme); out.fill2 = colourIn(stops[stops.length - 1], theme); }
    } else if (sf) out.fill = colourIn(sf, theme);
    else if (!nf && style && kid(style, 'fillRef') && +kid(style, 'fillRef').getAttribute('idx') > 0) out.fill = colourIn(kid(style, 'fillRef'), theme);
    var lnOff = ln && kid(ln, 'noFill');
    if (ln && kid(ln, 'solidFill')) out.border = colourIn(kid(ln, 'solidFill'), theme);
    else if (!lnOff && style && kid(style, 'lnRef') && +kid(style, 'lnRef').getAttribute('idx') > 0) out.border = colourIn(kid(style, 'lnRef'), theme);
    out.dash = !!(ln && kid(ln, 'prstDash') && kid(ln, 'prstDash').getAttribute('val') !== 'solid') || !!(ln && kid(ln, 'custDash'));
    if (ln && ln.getAttribute('w')) out.width = Math.round(+ln.getAttribute('w') / 12700 * 4) / 4;
    var body = kid(sp, 'txBody') || (kid(sp, 'txbx') && kid(kid(sp, 'txbx'), 'txbxContent'));
    out.paras = []; out.alignments = [];
    if (body) kidsOf(body, 'p').forEach(function (p) {
      var text = deep(p, 't').map(function (t) { return t.textContent; }).join('').trim();
      if (!text) return;
      var pPr = kid(p, 'pPr'), al = pPr && (pPr.getAttribute('algn') || (kid(pPr, 'jc') && (kid(pPr, 'jc').getAttributeNS('*', 'val') || kid(pPr, 'jc').getAttribute('w:val'))));
      out.paras.push(text); out.alignments.push(al === 'l' || al === 'left' || al === 'start' ? 'l' : al === 'r' || al === 'right' || al === 'end' ? 'r' : 'c');
    });
    if (body && !out.text) {
      var rp = deep(body, 'rPr')[0], f = rp && kid(rp, 'solidFill');
      if (f) out.text = colourIn(f, theme);
      else {
        var wc = deep(body, 'color')[0], v = wc && (wc.getAttribute('w:val') || wc.getAttribute('val'));
        if (v && /^[0-9a-f]{6}$/i.test(v)) out.text = '#' + v.toUpperCase();
        else if (style && kid(style, 'fontRef')) out.text = colourIn(kid(style, 'fontRef'), theme);
      }
    }
    return out;
  }
  // Point on the page for a group's child coordinates
  var IDENT = { sx: 1, sy: 1, ox: 0, oy: 0 };
  function apply(tf, x, y) { return [tf.ox + x * tf.sx, tf.oy + y * tf.sy]; }
  function childTf(tf, xfrm) {
    var off = kid(xfrm, 'off'), ext = kid(xfrm, 'ext'), co = kid(xfrm, 'chOff'), ce = kid(xfrm, 'chExt');
    if (!off || !ext || !co || !ce) return tf;
    var sx = (+ce.getAttribute('cx')) ? +ext.getAttribute('cx') / +ce.getAttribute('cx') : 1;
    var sy = (+ce.getAttribute('cy')) ? +ext.getAttribute('cy') / +ce.getAttribute('cy') : 1;
    var o = apply(tf, +off.getAttribute('x'), +off.getAttribute('y'));
    return { sx: tf.sx * sx, sy: tf.sy * sy, ox: o[0] - +co.getAttribute('x') * tf.sx * sx, oy: o[1] - +co.getAttribute('y') * tf.sy * sy };
  }
  // Every shape's rectangle and, for lines, the path it follows on the page
  function geometry(sp, tf, base) {
    var pr = kid(sp, 'spPr'), x = pr && kid(pr, 'xfrm');
    if (!x || !kid(x, 'off') || !kid(x, 'ext')) return base ? { x: base.x, y: base.y, w: base.w, h: base.h, rot: 0 } : null;
    var off = kid(x, 'off'), ext = kid(x, 'ext');
    var a = apply(tf, +off.getAttribute('x'), +off.getAttribute('y'));
    var g = { x: a[0], y: a[1], w: +ext.getAttribute('cx') * tf.sx, h: +ext.getAttribute('cy') * tf.sy, rot: +(x.getAttribute('rot') || 0) / 60000 % 360, fh: x.getAttribute('flipH') === '1', fv: x.getAttribute('flipV') === '1' };
    if (base) { g.x += base.x; g.y += base.y; }
    return g;
  }
  function linePath(g, geom, adj) {
    var w = g.w, h = g.h, pts;
    if (geom === 'bentConnector2') pts = [[0, 0], [w, 0], [w, h]];
    else if (geom === 'bentConnector3') pts = [[0, 0], [w * adj, 0], [w * adj, h], [w, h]];
    else if (/^bentConnector/.test(geom)) pts = [[0, 0], [w / 2, 0], [w / 2, h], [w, h]];
    else pts = [[0, 0], [w, h]];
    var cx = g.x + w / 2, cy = g.y + h / 2, r = g.rot * Math.PI / 180;
    return pts.map(function (q) {
      var dx = (g.fh ? w - q[0] : q[0]) - w / 2, dy = (g.fv ? h - q[1] : q[1]) - h / 2;
      return [cx + dx * Math.cos(r) - dy * Math.sin(r), cy + dx * Math.sin(r) + dy * Math.cos(r)];
    });
  }
  function collect(root, theme, tf, shapes, lines, base) {
    kidsOf(root).forEach(function (n) {
      var nm = n.localName;
      if (nm === 'grpSp' || nm === 'wgp') {
        var gp = kid(n, 'grpSpPr'), x = gp && kid(gp, 'xfrm');
        collect(n, theme, x ? childTf(tf, x) : tf, shapes, lines, base);
      } else if (nm === 'sp' || nm === 'cxnSp' || nm === 'wsp') {
        var g = geometry(n, tf, base); if (!g) return;
        var info = shapeInfo(n, theme);
        var nv = kid(n, 'nvSpPr') || kid(n, 'nvCxnSpPr');
        var cNv = nv ? kid(nv, 'cNvPr') : kid(n, 'cNvPr');
        var isCxn = nm === 'cxnSp' || !!kid(n, 'cNvCnPr') || /^(line|straightConnector|bentConnector|curvedConnector)/.test(info.geom);
        if (isCxn) {
          var cn = deep(n, 'stCxn')[0], ce = deep(n, 'endCxn')[0];
          var geo = kid(kid(n, 'spPr'), 'prstGeom'), gd = geo && deep(geo, 'gd')[0], m = gd && /val (-?\d+)/.exec(gd.getAttribute('fmla') || '');
          lines.push({ pts: linePath(g, info.geom, m ? +m[1] / 100000 : 0.5), dash: info.dash, color: info.border, width: info.width, st: cn && cn.getAttribute('id'), en: ce && ce.getAttribute('id') });
        } else {
          var cpr = nv && kid(nv, 'cNvSpPr'), ph = nv && deep(nv, 'ph')[0];
          var bodyPr = kid(n, 'cNvSpPr');
          shapes.push({
            sid: cNv && cNv.getAttribute('id'), name: cNv && cNv.getAttribute('name'), x: g.x, y: g.y, w: g.w, h: g.h,
            info: info, loose: !!(cpr && cpr.getAttribute('txBox') === '1') || !!(bodyPr && bodyPr.getAttribute('txBox') === '1'), ph: ph ? (ph.getAttribute('type') || 'body') : ''
          });
        }
      } else if (nm !== 'grpSpPr' && nm !== 'nvGrpSpPr' && nm !== 'bg') {
        // Word wraps drawings in layers (mc:AlternateContent, canvases); pptx frames are handled elsewhere
        if (nm === 'Fallback' || nm === 'graphicFrame' || nm === 'pic') return;
        collect(n, theme, tf, shapes, lines, base);
      }
    });
  }

  function smartArt(xml) {
    var d = parse(xml), pts = {}, order = [], kidsMap = {};
    deep(d, 'pt').forEach(function (p) {
      var t = p.getAttribute('type') || 'node', id = p.getAttribute('modelId');
      if (t === 'node' || t === 'asst' || t === 'doc') {
        var paras = deep(p, 'p').map(function (q) { return deep(q, 't').map(function (x) { return x.textContent; }).join('').trim(); }).filter(Boolean);
        pts[id] = { id: id, type: t, paras: paras };
        if (t !== 'doc') order.push(id);
      }
    });
    var par = {};
    deep(d, 'cxn').forEach(function (c) {
      var t = c.getAttribute('type') || 'parOf';
      if (t !== 'parOf') return;
      var a = c.getAttribute('srcId'), b = c.getAttribute('destId');
      if (pts[a] && pts[b]) { par[b] = a; (kidsMap[a] = kidsMap[a] || []).push(b); }
    });
    return order.map(function (id) {
      var p = par[id];
      return { key: id, paras: pts[id].paras, alignments: pts[id].paras.map(function () { return 'c'; }), info: {}, parent: p && pts[p].type !== 'doc' ? p : null };
    });
  }

  // Turn shapes and lines into people: who touches which line decides who reports to whom.
  function inferTree(shapes, lines, dims) {
    var notes = [], title = '';
    var tol = Math.max(dims.w, dims.h) * 0.012;
    shapes = shapes.filter(function (s) { return s.w > 0 && s.h > 0; });
    shapes.forEach(function (s) { if (s.ph === 'title' || s.ph === 'ctrTitle') title = s.info.paras.join(' '); });
    var solid = function (s) { return s.info.fill || s.info.border; };
    var boxes = shapes.filter(function (s) { return !s.ph && !(s.loose && !solid(s)) && (s.info.paras.length || solid(s)); });
    // a big background panel behind the chart isn't a box
    boxes = boxes.filter(function (b) {
      return boxes.filter(function (o) { return o !== b && o.x >= b.x - 1 && o.y >= b.y - 1 && o.x + o.w <= b.x + b.w + 1 && o.y + o.h <= b.y + b.h + 1; }).length < 2;
    });
    // text boxes laid over a rectangle count as that rectangle's text
    shapes.filter(function (s) { return boxes.indexOf(s) < 0 && s.info.paras.length && !s.ph; }).forEach(function (s) {
      var cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      var host = boxes.filter(function (b) { return cx > b.x && cx < b.x + b.w && cy > b.y && cy < b.y + b.h; })[0];
      if (host) { host.info.paras = host.info.paras.concat(s.info.paras); host.info.alignments = host.info.alignments.concat(s.info.alignments); }
      else if (!title && s.y < dims.h * 0.2) title = s.info.paras.join(' ');
    });
    var touches = function (pt, b) { return pt[0] >= b.x - tol && pt[0] <= b.x + b.w + tol && pt[1] >= b.y - tol && pt[1] <= b.y + b.h + tol; };
    var segDist = function (p, a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
      return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    };
    var joined = function (a, b) {
      var ends = function (l) { return [l.pts[0], l.pts[l.pts.length - 1]]; };
      var near = function (pt, l) { for (var i = 0; i + 1 < l.pts.length; i++) if (segDist(pt, l.pts[i], l.pts[i + 1]) <= tol) return true; return false; };
      return ends(a).some(function (p) { return near(p, b); }) || ends(b).some(function (p) { return near(p, a); });
    };
    // loose lines that touch each other form one reporting group (a bus with drops)
    var group = lines.map(function (_, i) { return i; });
    var find = function (i) { while (group[i] !== i) i = group[i] = group[group[i]]; return i; };
    var free = lines.map(function (l, i) { return !(l.st && l.en) ? i : -1; }).filter(function (i) { return i >= 0; });
    free.forEach(function (i, a) { free.slice(a + 1).forEach(function (j) { if (lines[i].dash === lines[j].dash && joined(lines[i], lines[j])) group[find(i)] = find(j); }); });
    var comps = {};
    lines.forEach(function (l, i) { (comps[find(i)] = comps[find(i)] || []).push(l); });
    boxes.forEach(function (b, i) { b.key = 'b' + i; b.parent = null; b.dotted = null; });
    var bySid = {}; boxes.forEach(function (b) { if (b.sid) bySid[b.sid] = b; });
    Object.keys(comps).forEach(function (k) {
      var ls = comps[k], hit = [];
      ls.forEach(function (l) {
        var add = function (b) { if (b && hit.indexOf(b) < 0) hit.push(b); };
        add(bySid[l.st]); add(bySid[l.en]);
        [l.pts[0], l.pts[l.pts.length - 1]].forEach(function (p, e) {
          if ((e === 0 && l.st && bySid[l.st]) || (e === 1 && l.en && bySid[l.en])) return;
          boxes.forEach(function (b) { if (touches(p, b)) add(b); });
        });
      });
      if (hit.length < 2) return;
      hit.sort(function (a, b) { return a.y - b.y; });
      var top = hit[0], dash = ls[0].dash, unsure = hit.length > 2 && Math.abs(hit[1].y - top.y) < tol && Math.abs(hit[1].h - top.h) < tol;
      hit.slice(1).forEach(function (c) {
        if (dash && hit.length >= 2) { if (!c.dotted) c.dotted = top.key; return; }
        if (c.parent) { c.unsure = true; return; }
        c.parent = top.key; if (unsure) c.unsure = true; c.lineStyle = ls[0];
      });
    });
    // anyone still unattached (and not the top of the chart) gets their nearest box above, flagged
    var topY = boxes.reduce(function (m, b) { return Math.min(m, b.y); }, 1e15);
    var hasChild = {}; boxes.forEach(function (b) { if (b.parent) hasChild[b.parent] = 1; });
    var tops = boxes.filter(function (b) { return !b.parent && (Math.abs(b.y - topY) < tol || hasChild[b.key]); });
    boxes.forEach(function (b) {
      if (b.parent || b === tops[0]) return;
      var above = boxes.filter(function (o) { return o !== b && o.y + o.h <= b.y + tol; });
      if (!above.length) return;
      above.sort(function (p, q) {
        var dy = (b.y - p.y) - (b.y - q.y); if (Math.abs(dy) > tol) return dy;
        return Math.abs(p.x + p.w / 2 - b.x - b.w / 2) - Math.abs(q.x + q.w / 2 - b.x - b.w / 2);
      });
      b.parent = above[0].key; b.unsure = true;
    });
    // read boxes in chart order, top to bottom then left to right
    boxes.sort(function (a, b) { return Math.abs(a.y - b.y) > tol ? a.y - b.y : a.x - b.x; });
    return { boxes: boxes, title: title, notes: notes };
  }

  function toChart(tree, title, base) {
    var maxRows = tree.reduce(function (m, b) { return Math.max(m, b.paras ? b.paras.length : b.info.paras.length); }, 1);
    maxRows = Math.min(maxRows, 8);
    var defaults = ['Name', 'Job title', 'Department', 'Location'];
    var fields = [];
    for (var i = 0; i < maxRows; i++) fields.push({ id: uid(), name: defaults[i] || 'Row ' + (i + 1), align: 'c', bold: i === 0 });
    var aligns = fields.map(function () { return {}; }), ids = {};
    tree.forEach(function (b) { ids[b.key] = uid(); });
    var people = tree.map(function (b) {
      var paras = b.paras || b.info.paras, als = b.alignments || b.info.alignments, vals = {};
      paras.forEach(function (t, i) {
        t = String(t).replace(/\t+/g, ' ');
        var j = Math.min(i, fields.length - 1), fid = fields[j].id;
        vals[fid] = vals[fid] ? vals[fid] + ' ' + t : t;
        aligns[j][als[i] || 'c'] = (aligns[j][als[i] || 'c'] || 0) + 1;
      });
      var inf = b.info || {}, style = {};
      if (inf.fill) style.fill = inf.fill; if (inf.fill2 && inf.fill2 !== inf.fill) style.fill2 = inf.fill2; if (inf.border) style.border = inf.border; if (inf.text) style.text = inf.text;
      var p = { id: ids[b.key], parent: b.parent ? ids[b.parent] : null, dotted: b.dotted ? ids[b.dotted] : null, vals: vals, style: style };
      if (b.unsure) p.unsure = true;
      if (b.lineStyle && (b.lineStyle.color || b.lineStyle.dash)) p.line = { color: b.lineStyle.color || undefined, width: b.lineStyle.width || undefined };
      return p;
    });
    fields.forEach(function (f, i) {
      var a = aligns[i]; f.align = Object.keys(a).sort(function (x, y) { return a[y] - a[x]; })[0] || 'c';
    });
    var c = base();
    var round = tree.filter(function (b) { return b.info && b.info.geom === 'roundRect'; }).length;
    if (round > tree.length / 2) c.corners = 'round';
    c.title = title || ''; c.fields = fields; c.people = people; c.levels = [];
    return c;
  }

  // Open a .pptx/.docx: returns {saved:chart} for files made here, else {slides:[…]} to review.
  function readOffice(buf, ext, base) {
    return window.JSZip.loadAsync(buf).then(function (z) {
      var names = Object.keys(z.files), rd = function (n) { return z.file(n) ? z.file(n).async('string') : Promise.resolve(''); };
      var custom = names.filter(function (n) { return /^customXml\/[^/]*\.xml$/.test(n) && !/props/i.test(n); });
      return Promise.all(custom.map(rd)).then(function (xs) {
        var hit = xs.filter(function (x) { return x.indexOf(NS) >= 0; })[0], saved = null;
        if (hit) { try { saved = JSON.parse(parse(hit).documentElement.textContent); } catch (e) { saved = null; } }
        var themeName = names.filter(function (n) { return /theme\/theme\d*\.xml$/.test(n); })[0];
        return rd(themeName || '').then(function (tx) {
          var theme = themeColours(tx);
          var parts = names.filter(function (n) { return ext === 'pptx' ? /^ppt\/slides\/slide\d+\.xml$/.test(n) : n === 'word/document.xml'; })
            .sort(function (a, b) { return (+(/(\d+)\.xml$/.exec(a) || [0, 0])[1]) - (+(/(\d+)\.xml$/.exec(b) || [0, 0])[1]); });
          return Promise.all(parts.map(function (n, idx) { return readPart(z, n, ext, theme, idx); })).then(function (slides) {
            return { saved: saved, slides: slides.map(function (s) { s.chart = s.tree.length ? toChart(s.tree, s.title, base) : null; return s; }).filter(function (s) { return s.tree.length || saved; }) };
          });
        });
      });
    });
  }
  function readPart(z, name, ext, theme, idx) {
    var dir = name.replace(/[^/]+$/, ''), relName = dir + '_rels/' + name.replace(/^.*\//, '') + '.rels';
    return z.file(name).async('string').then(function (xml) {
      var doc = parse(xml), shapes = [], lines = [], dims = { w: 12192000, h: 6858000 };
      var relP = z.file(relName) ? z.file(relName).async('string') : Promise.resolve('');
      return relP.then(function (rx) {
        var rel = {};
        if (rx) deep(parse(rx), 'Relationship').forEach(function (r) { rel[r.getAttribute('Id')] = r.getAttribute('Target'); });
        var dgm = deep(doc, 'relIds')[0];
        if (dgm) {
          var dm = dgm.getAttribute('r:dm') || dgm.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'dm');
          var path = rel[dm] ? (dir + rel[dm]).replace(/[^/]+\/\.\.\//, '') : null;
          if (path && z.file(path)) return z.file(path).async('string').then(function (d) {
            return { label: (ext === 'pptx' ? 'Slide ' : 'Page ') + (idx + 1), tree: smartArt(d), title: '', flavour: 'SmartArt' };
          });
        }
        if (ext === 'pptx') {
          var tree = deep(doc, 'spTree')[0];
          if (tree) collect(tree, theme, IDENT, shapes, lines, null);
        } else {
          deep(doc, 'anchor').concat(deep(doc, 'inline')).forEach(function (a) {
            var pos = { x: 0, y: 0, w: 0, h: 0 }, ex = kid(a, 'extent'), ph = kid(a, 'positionH'), pv = kid(a, 'positionV');
            if (ex) { pos.w = +ex.getAttribute('cx'); pos.h = +ex.getAttribute('cy'); }
            var off = function (q) { var o = q && kid(q, 'posOffset'); return o ? +o.textContent : 0; };
            pos.x = off(ph); pos.y = off(pv);
            var data = deep(a, 'graphicData')[0]; if (!data) return;
            var one = data.firstElementChild; if (!one) return;
            if (one.localName === 'wsp') {
              // a stand-alone Word shape takes its place from the anchor
              collectOne(one, theme, shapes, lines, pos);
            } else collect(one.localName === 'wgp' ? data : one, theme, IDENT, shapes, lines, pos);
          });
          dims = shapes.concat(lines.map(function (l) { return { x: l.pts[0][0], y: l.pts[0][1], w: 0, h: 0 }; })).reduce(function (m, s) { return { w: Math.max(m.w, s.x + s.w), h: Math.max(m.h, s.y + s.h) }; }, { w: 1, h: 1 });
        }
        var t = inferTree(shapes, lines, dims);
        return { label: (ext === 'pptx' ? 'Slide ' : 'Page ') + (idx + 1), tree: t.boxes, title: t.title, flavour: 'shapes', raw: shapes };
      });
    });
  }
  function collectOne(wsp, theme, shapes, lines, pos) {
    var holder = wsp.ownerDocument.createElement('x'); holder.appendChild(wsp.cloneNode(true));
    collect(holder, theme, IDENT, shapes, lines, pos);
  }

  return { PAGES: PAGES, FONTS: FONTS, fieldLines: fieldLines, MIN_PT: MIN_PT, HEX: HEX, uid: uid, forest: forest, fit: fit, toSvg: toSvg, buildPptx: buildPptx, buildDocx: buildDocx, readOffice: readOffice };
})();
