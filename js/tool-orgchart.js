/* ============================================================
   TOOL — Org chart generator  (productivity/orgchart.html)
   The screen: table, text rows, styling, uploads and downloads.
   Layout and the Office files live in tool-orgchart-core.js.
   Nothing leaves the browser; the working chart is kept in
   localStorage (oc:current).
   ============================================================ */
(function () {
  'use strict';
  var O = window.OrgCore, $ = function (id) { return document.getElementById(id); };
  var LIBS = { exceljs: '../js/vendor/exceljs-4.4.0.min.js', jszip: '../js/vendor/jszip-3.10.1.min.js' };
  var SW = ['#FFFFFF', '#F0EDE6', '#E7E2D6', '#EDEAF4', '#DCE6F2', '#D5E8DC', '#FBE5D6', '#E9D9A8', '#5C4D7D', '#2E4374', '#2F6B4F', '#1F6F78', '#A33A2C', '#B8860B', '#6B2740', '#1B1B1F'];
  var loaded = {};
  function load(src) {
    return loaded[src] || (loaded[src] = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { delete loaded[src]; no(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    }));
  }
  var uid = O.uid;
  // colour columns in the table and the Excel template
  var COLS = [{ k: 'fill', h: 'Box colour' }, { k: 'fill2', h: 'Gradient to' }, { k: 'text', h: 'Text colour' }];
  var colCtx = null;
  function parseColour(v) { // #RRGGBB, RRGGBB, #RGB or a colour name such as "navy"
    v = String(v || '').trim(); if (!v) return null;
    if (/^[0-9a-f]{6}$/i.test(v) || /^[0-9a-f]{3}$/i.test(v)) v = '#' + v;
    colCtx = colCtx || document.createElement('canvas').getContext('2d');
    colCtx.fillStyle = '#010203'; colCtx.fillStyle = v; var a = colCtx.fillStyle;
    colCtx.fillStyle = '#FEFDFC'; colCtx.fillStyle = v; var b = colCtx.fillStyle;
    return a === b && /^#[0-9a-f]{6}$/i.test(a) ? a.toUpperCase() : null;
  }
  function setColour(p, key, v) {
    v = String(v || '').trim();
    if (p.badColour) { delete p.badColour[key]; if (!Object.keys(p.badColour).length) delete p.badColour; }
    if (!v) { delete p.style[key]; return; }
    if (/^none$/i.test(v)) { if (key === 'fill2') p.style.fill2 = 'none'; else delete p.style[key]; return; }
    var c = parseColour(v);
    if (c) { p.style[key] = c; return; }
    delete p.style[key]; p.badColour = p.badColour || {}; p.badColour[key] = v;
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var store = {
    get: function (k) { try { return localStorage.getItem('oc:' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('oc:' + k, v); return true; } catch (e) { return false; } }
  };

  // ---------- chart data ----------
  var SAMPLE_TITLE = 'Project team';
  function base() {
    return {
      v: 1, title: '', page: 'ppt169', arrange: 'auto', corners: 'square', font: 'Arial', gradDir: 'h',
      fields: [{ id: uid(), name: 'Name', align: 'c', bold: true }, { id: uid(), name: 'Job title', align: 'c', bold: false }, { id: uid(), name: 'Location', align: 'c', bold: false }],
      people: [], box: { fill: '#EDEAF4', border: '#5C4D7D', text: '#1B1B1F' }, levels: [],
      line: { dash: 'solid', color: '#5C4D7D', width: 1.25 }
    };
  }
  function sample() {
    var c = base(), f = c.fields, ids = {};
    c.fields = f = [f[0], f[1], { id: uid(), name: 'Employee or contractor', align: 'l', bold: false, size: 's' }, { id: uid(), name: 'Home country', align: 'r', bold: false, size: 's', join: true }];
    var add = function (key, n, j, t, h, boss, dot) {
      var v = {}; v[f[0].id] = n; v[f[1].id] = j; v[f[2].id] = t; v[f[3].id] = h;
      ids[key] = uid(); c.people.push({ id: ids[key], parent: boss ? ids[boss] : null, dotted: dot ? ids[dot] : null, vals: v, style: {} });
    };
    add('a', 'Anna Rossi', 'Project Director', 'Employee', 'Italy');
    add('b', 'Mark Lee', 'Engineering Manager', 'Employee', 'USA', 'a');
    add('c', 'Priya Nair', 'Construction Manager', 'Employee', 'India', 'a');
    add('d', 'Tom Evans', 'Project Controls Lead', 'Contractor', 'UK', 'a');
    add('e', 'Sara Conti', 'Process Lead', 'Employee', 'Italy', 'b');
    add('f', 'Ken Park', 'Piping Lead', 'Contractor', 'Korea', 'b');
    add('g', 'Luís Matos', 'Site Manager', 'Employee', 'Mozambique', 'c');
    add('h', 'Asha Menon', 'Marine Lead', 'Contractor', 'India', 'c', 'd');
    add('i', 'Ben Clark', 'Planner', 'Employee', 'UK', 'd');
    add('j', 'Mei Lin', 'Cost Engineer', 'Contractor', 'China', 'd');
    c.title = SAMPLE_TITLE; c.levels = shades('#5C4D7D', 3);
    return c;
  }
  function textOn(hex) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1B1B1F' : '#FFFFFF';
  }
  function mix(hex, t) { // towards white
    var n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { var x = Math.round(v + (255 - v) * t).toString(16); return x.length < 2 ? '0' + x : x; });
    return '#' + c.join('').toUpperCase();
  }
  function shades(hex, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var f = mix(hex, n > 1 ? Math.min(0.86, i * (0.86 / (n - 1))) : 0);
      out.push({ fill: f, border: hex, text: textOn(f) });
    }
    return out;
  }
  function normalise(c) {
    var d = base(), col = function (v, alt) { return O.HEX.test(v) ? v : alt; };
    var st = function (s) { var o = {}; s = s || {}; ['fill', 'border', 'text', 'fill2'].forEach(function (k) { if (O.HEX.test(s[k])) o[k] = s[k]; }); if (s.fill2 === 'none') o.fill2 = 'none'; return o; };
    var ln = function (s, whole) {
      var o = {}; s = s || {};
      if (s.dash === 'dash' || s.dash === 'solid') o.dash = s.dash;
      if (O.HEX.test(s.color)) o.color = s.color;
      if (+s.width > 0 && +s.width <= 12) o.width = +s.width;
      return whole ? { dash: o.dash || 'solid', color: o.color || '#5C4D7D', width: o.width || 1.25 } : o;
    };
    c = c && typeof c === 'object' ? c : {};
    var fields = (Array.isArray(c.fields) ? c.fields : d.fields).slice(0, 30).map(function (f) {
      return { id: String(f.id || uid()), name: String(f.name || 'Row'), align: /^[lcr]$/.test(f.align) ? f.align : 'c', bold: !!f.bold, italic: !!f.italic, underline: !!f.underline, size: /^(s|m|l|xl)$/.test(f.size) ? f.size : 'm', join: !!f.join };
    });
    if (!fields.length) fields = d.fields;
    fields[0].join = false;
    var people = (Array.isArray(c.people) ? c.people : []).slice(0, 3000).map(function (p) {
      var v = {}; fields.forEach(function (f) { if (p.vals && p.vals[f.id] != null) v[f.id] = String(p.vals[f.id]); });
      var o = { id: String(p.id || uid()), parent: p.parent ? String(p.parent) : null, dotted: p.dotted ? String(p.dotted) : null, vals: v, style: st(p.style) };
      var l = ln(p.line); if (Object.keys(l).length) o.line = l;
      if (p.parentText) o.parentText = String(p.parentText);
      if (p.dottedText) o.dottedText = String(p.dottedText);
      if (p.unsure) o.unsure = true;
      if (p.badColour && typeof p.badColour === 'object') { var bc = {}; Object.keys(p.badColour).forEach(function (k) { if (COLS.some(function (c) { return c.k === k; })) bc[k] = String(p.badColour[k]); }); if (Object.keys(bc).length) o.badColour = bc; }
      return o;
    });
    var bx = c.box || {};
    return {
      v: 1, title: String(c.title || ''), page: O.PAGES[c.page] ? c.page : 'ppt169',
      arrange: /^(auto|wide|stack1|stack2)$/.test(c.arrange) ? c.arrange : 'auto',
      corners: c.corners === 'round' ? 'round' : 'square', fields: fields, people: people,
      font: O.FONTS[c.font] ? c.font : 'Arial', gradDir: c.gradDir === 'v' ? 'v' : 'h',
      box: Object.assign(st(bx), { fill: col(bx.fill, d.box.fill), border: col(bx.border, d.box.border), text: col(bx.text, d.box.text) }),
      levels: (Array.isArray(c.levels) ? c.levels : []).slice(0, 30).map(st), line: ln(c.line, true)
    };
  }

  var chart, undoStack = [], redoStack = [], lastJson = '';
  var sel = { type: 'all', ids: [] }, many = false, painter = null, zoom = 1, last = null;

  // ---------- names and references ----------
  var nameOf = function (p) { var f = chart.fields[0]; return String((p.vals[f.id] || '')).trim(); };
  function nameCounts() { var c = {}; chart.people.forEach(function (p) { var k = nameOf(p).toLowerCase(); if (k) c[k] = (c[k] || 0) + 1; }); return c; }
  function secondOf(p) { for (var i = 1; i < chart.fields.length; i++) { var v = String(p.vals[chart.fields[i].id] || '').trim(); if (v) return v; } return ''; }
  function labelOf(p, counts) {
    var n = nameOf(p); counts = counts || nameCounts();
    if (!n) return '';
    if (counts[n.toLowerCase()] > 1 && secondOf(p)) return n + ' (' + secondOf(p) + ')';
    return n;
  }
  function resolve(text, self) {
    var t = String(text || '').trim().toLowerCase(); if (!t) return { id: null };
    var c = nameCounts(), exact = chart.people.filter(function (p) { return p.id !== self && labelOf(p, c).toLowerCase() === t; });
    if (exact.length === 1) return { id: exact[0].id };
    var same = chart.people.filter(function (p) { return p.id !== self && nameOf(p).toLowerCase() === t; });
    if (same.length === 1) return { id: same[0].id };
    return { id: null, text: String(text).trim(), many: same.length > 1 };
  }
  function byId(id) { for (var i = 0; i < chart.people.length; i++) if (chart.people[i].id === id) return chart.people[i]; return null; }
  function issues() {
    var t = O.forest(chart), c = nameCounts(), out = {};
    var add = function (id, msg, hard) { (out[id] = out[id] || []).push({ m: msg, hard: hard }); };
    var soft = /^(vacant|tbc|tbd|open|open role|to be confirmed|to be hired)$/i;
    chart.people.forEach(function (p) {
      var n = nameOf(p);
      if (!n) add(p.id, 'This box has no ' + chart.fields[0].name.toLowerCase() + '.', false);
      if (p.parentText) add(p.id, (resolve(p.parentText, p.id).many ? '“' + p.parentText + '” matches more than one person — pick one.' : '“' + p.parentText + '” isn’t in the list.'), true);
      if (p.dottedText) add(p.id, 'Dotted line: “' + p.dottedText + '” isn’t in the list.', true);
      if (t.inLoop[p.id]) add(p.id, 'Reporting loop — this person ends up reporting to themselves.', true);
      if (p.badColour) Object.keys(p.badColour).forEach(function (k) { add(p.id, '“' + p.badColour[k] + '” isn’t a colour. Use a code like #5C4D7D.', true); });
      if (p.unsure) add(p.id, 'Manager is a best guess from the old chart — please check.', true);
      if (n && c[n.toLowerCase()] > 1 && !soft.test(n)) add(p.id, 'Same name as someone else.', false);
    });
    return out;
  }

  // ---------- history + saving ----------
  function snapshot() { return JSON.stringify(chart); }
  function commit() {
    var j = snapshot(); if (j === lastJson) return;
    undoStack.push(lastJson); if (undoStack.length > 80) undoStack.shift();
    redoStack = []; lastJson = j;
    var ok = store.set('current', j);
    $('saved').textContent = ok ? 'Saved in this browser' : 'Not saved — browser storage is off';
    syncUndo();
  }
  var commitT;
  function commitSoon() { clearTimeout(commitT); commitT = setTimeout(commit, 500); }
  function syncUndo() { $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length; }
  function restore(j) { chart = normalise(JSON.parse(j)); lastJson = j; store.set('current', j); sel = { type: 'all', ids: [] }; renderAll(); syncUndo(); }
  function replace(c) { commit(); chart = normalise(c); sel = { type: 'all', ids: [] }; renderAll(); commit(); }

  // ---------- text rows ----------
  function renderFields() {
    $('fields').innerHTML = chart.fields.map(function (f, i) {
      var locked = !!f.join && i > 0, seg = ['l', 'c', 'r'].map(function (a) {
        return '<button type="button" class="tl-btn' + (f.align === a && !locked ? ' on' : '') + '" data-falign="' + a + '" aria-pressed="' + (f.align === a) + '"' + (locked ? ' disabled' : '') + '>' + { l: 'Left', c: 'Centre', r: 'Right' }[a] + '</button>';
      }).join('');
      var style = [['bold', 'B', 'Bold'], ['italic', 'I', 'Italic'], ['underline', 'U', 'Underline']].map(function (x) {
        return '<button type="button" class="tl-btn oc-fmt ' + x[0] + (f[x[0]] ? ' on' : '') + '" data-ffmt="' + x[0] + '" aria-pressed="' + !!f[x[0]] + '" aria-label="' + x[2] + '">' + x[1] + '</button>';
      }).join('');
      var size = '<select class="oc-fsize" data-fsize aria-label="Text size of this row">' + [['s', 'Small'], ['m', 'Normal'], ['l', 'Large'], ['xl', 'Extra large']].map(function (x) { return '<option value="' + x[0] + '"' + (f.size === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>';
      return '<li data-f="' + f.id + '"><span class="oc-fno">' + (i + 1) + '</span>' +
        '<input class="oc-fname" value="' + esc(f.name) + '" aria-label="Name of row ' + (i + 1) + '">' +
        '<span class="tl-grp">' + seg + '</span><span class="tl-grp">' + style + '</span>' + size +
        '<button type="button" class="tl-btn' + (f.join ? ' on' : '') + '" data-fjoin aria-pressed="' + !!f.join + '" title="Puts this next to the row above: two sit left and right, three sit left, centre and right"' + (i ? '' : ' disabled') + '>Same line as above</button>' +
        '<span class="tl-grp"><button type="button" class="tl-btn ico" data-fmove="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="tl-btn ico" data-fmove="1" aria-label="Move down"' + (i < chart.fields.length - 1 ? '' : ' disabled') + '>↓</button></span>' +
        '<button type="button" class="tl-btn ico" data-fdel aria-label="Remove row"' + (chart.fields.length > 1 ? '' : ' disabled') + '>×</button></li>';
    }).join('');
  }
  $('fields').addEventListener('input', function (e) {
    if (!e.target.classList.contains('oc-fname')) return;
    var f = chart.fields.filter(function (x) { return x.id === e.target.closest('li').dataset.f; })[0];
    f.name = e.target.value;
    var th = document.querySelector('#table thead th[data-fh="' + f.id + '"]');
    if (th) th.textContent = f.name;
    document.querySelectorAll('#table td[data-fd="' + f.id + '"]').forEach(function (td) { td.dataset.label = f.name; var inp = td.querySelector('input'); if (inp) inp.setAttribute('aria-label', f.name); });
    commitSoon();
  });
  $('fields').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var li = b.closest('li'), i = chart.fields.findIndex(function (x) { return x.id === li.dataset.f; }), f = chart.fields[i];
    if (b.dataset.falign) f.align = b.dataset.falign;
    else if (b.dataset.ffmt) f[b.dataset.ffmt] = !f[b.dataset.ffmt];
    else if ('fjoin' in b.dataset) f.join = !f.join;
    else if (b.dataset.fmove) { var j = i + (+b.dataset.fmove); chart.fields.splice(j, 0, chart.fields.splice(i, 1)[0]); }
    else if ('fdel' in b.dataset) {
      var used = chart.people.some(function (p) { return p.vals[f.id]; });
      chart.fields.splice(i, 1); chart.people.forEach(function (p) { delete p.vals[f.id]; });
      if (used) toast('Removed “' + f.name + '”. Undo brings it back.');
    }
    chart.fields[0].join = false;
    renderFields(); renderTable(); draw(); commit();
  });
  $('fields').addEventListener('change', function (e) {
    if (!('fsize' in e.target.dataset)) return;
    var f = chart.fields.filter(function (x) { return x.id === e.target.closest('li').dataset.f; })[0];
    f.size = e.target.value; draw(); commit();
  });
  $('addField').addEventListener('click', function () {
    var names = ['Department', 'Location', 'Employee or contractor', 'Home country', 'Host country', 'Company', 'Phone', 'Email'], have = chart.fields.map(function (f) { return f.name.toLowerCase(); });
    var n = names.filter(function (x) { return have.indexOf(x.toLowerCase()) < 0; })[0] || 'Row ' + (chart.fields.length + 1);
    chart.fields.push({ id: uid(), name: n, align: 'c', bold: false, size: 'm' });
    renderFields(); renderTable(); draw(); commit();
    var all = $('fields').querySelectorAll('.oc-fname'); all[all.length - 1].select();
  });

  // ---------- table ----------
  function renderNames() {
    var c = nameCounts();
    $('names').innerHTML = chart.people.map(function (p) { var l = labelOf(p, c); return l ? '<option value="' + esc(l) + '">' : ''; }).join('');
  }
  function renderTable() {
    var c = nameCounts(), T = $('table');
    var head = '<thead><tr><th class="oc-n">#</th>' + chart.fields.map(function (f) { return '<th data-fh="' + f.id + '">' + esc(f.name) + '</th>'; }).join('') + '<th>Reports to</th><th>Dotted line to</th>' + COLS.map(function (x) { return '<th>' + x.h + '</th>'; }).join('') + '<th class="oc-act"><span class="sr">Actions</span></th></tr></thead>';
    var body = chart.people.map(function (p, i) {
      var par = byId(p.parent), dot = byId(p.dotted);
      return '<tr data-p="' + p.id + '"><td class="oc-n">' + (i + 1) + '</td>' + chart.fields.map(function (f) {
        return '<td data-label="' + esc(f.name) + '" data-fd="' + f.id + '"><input data-k="' + f.id + '" aria-label="' + esc(f.name) + '" value="' + esc(p.vals[f.id] || '') + '"></td>';
      }).join('') +
        '<td data-label="Reports to"><input data-k="parent" list="names" aria-label="Reports to" placeholder="Nobody (top)" autocomplete="off" value="' + esc(p.parentText || (par ? labelOf(par, c) : '')) + '"></td>' +
        '<td data-label="Dotted line to"><input data-k="dotted" list="names" aria-label="Dotted line to" placeholder="—" autocomplete="off" value="' + esc(p.dottedText || (dot ? labelOf(dot, c) : '')) + '"></td>' +
        COLS.map(function (x) {
          var bad = p.badColour && p.badColour[x.k], v = bad || (p.style[x.k] || '');
          return '<td data-label="' + x.h + '"><input class="oc-col" data-c="' + x.k + '" aria-label="' + x.h + ' code, such as #5C4D7D" placeholder="—" autocomplete="off" spellcheck="false" value="' + esc(v) + '"' + (O.HEX.test(v) ? ' style="box-shadow:inset 6px 0 0 ' + v + '"' : '') + '></td>';
        }).join('') +
        '<td class="oc-act"><button type="button" class="oc-ab" data-rep aria-label="Add someone reporting to this person" title="Add a report">+</button><button type="button" class="oc-ab" data-mv="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="oc-ab" data-mv="1" aria-label="Move down"' + (i < chart.people.length - 1 ? '' : ' disabled') + '>↓</button><button type="button" class="oc-ab del" data-del aria-label="Delete this person">×</button></td></tr>';
    }).join('');
    T.innerHTML = head + '<tbody>' + (body || '<tr class="oc-empty"><td colspan="' + (chart.fields.length + 7) + '">Nobody yet. Add a person, or upload the Excel template.</td></tr>') + '</tbody>';
    renderNames(); refreshIssues();
  }
  function refreshIssues() {
    var iss = issues(), hard = 0, soft = 0;
    document.querySelectorAll('#table tbody tr[data-p]').forEach(function (tr) {
      var list = iss[tr.dataset.p] || [], old = tr.querySelector('.oc-err');
      if (old) old.remove();
      tr.classList.toggle('bad', list.some(function (x) { return x.hard; }));
      tr.classList.toggle('warn', !!list.length && !list.some(function (x) { return x.hard; }));
      if (list.length) {
        var d = document.createElement('div'); d.className = 'oc-err';
        d.textContent = list.map(function (x) { return x.m; }).join(' ');
        tr.querySelector('input[data-k="parent"]').parentNode.appendChild(d);
      }
    });
    Object.keys(iss).forEach(function (k) { iss[k].forEach(function (x) { if (x.hard) hard++; else soft++; }); });
    var el = $('issues');
    el.hidden = !hard && !soft;
    el.className = 'oc-issues' + (hard ? ' bad' : '');
    el.innerHTML = hard ? '<b>' + hard + (hard === 1 ? ' row needs' : ' rows need') + ' fixing.</b> They’re marked in the table.' + (soft ? ' Also ' + soft + ' to look at.' : '') : '<b>' + soft + ' to look at</b> in the table, nothing blocking.';
  }
  function syncRefs() {
    var c = nameCounts();
    chart.people.forEach(function (p) {
      var tr = document.querySelector('#table tr[data-p="' + p.id + '"]'); if (!tr) return;
      var a = tr.querySelector('[data-k="parent"]'), b = tr.querySelector('[data-k="dotted"]'), par = byId(p.parent), dot = byId(p.dotted);
      if (a !== document.activeElement) a.value = p.parentText || (par ? labelOf(par, c) : '');
      if (b !== document.activeElement) b.value = p.dottedText || (dot ? labelOf(dot, c) : '');
    });
    renderNames(); refreshIssues();
  }
  function retry() { // a name typed later can settle an earlier "not found"
    chart.people.forEach(function (p) {
      if (p.parentText) { var r = resolve(p.parentText, p.id); if (r.id) { p.parent = r.id; delete p.parentText; } }
      if (p.dottedText) { var d = resolve(p.dottedText, p.id); if (d.id) { p.dotted = d.id; delete p.dottedText; } }
    });
  }
  function setRef(p, key, value) {
    var r = resolve(value, p.id), txt = key === 'parent' ? 'parentText' : 'dottedText';
    p[key] = r.id; if (r.text) p[txt] = r.text; else delete p[txt];
    if (key === 'parent') delete p.unsure;
  }
  $('table').addEventListener('input', function (e) {
    if (e.target.dataset.c) {
      setColour(byId(e.target.closest('tr').dataset.p), e.target.dataset.c, e.target.value);
      e.target.style.boxShadow = parseColour(e.target.value) ? 'inset 6px 0 0 ' + parseColour(e.target.value) : '';
      refreshIssues(); draw(); commitSoon(); return;
    }
    var k = e.target.dataset.k; if (!k) return;
    var p = byId(e.target.closest('tr').dataset.p);
    if (k === 'parent' || k === 'dotted') { setRef(p, k, e.target.value); }
    else { if (e.target.value) p.vals[k] = e.target.value; else delete p.vals[k]; retry(); }
    syncRefs(); draw(); commitSoon();
  });
  $('table').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !(e.target.dataset.k || e.target.dataset.c)) return;
    e.preventDefault();
    var tr = e.target.closest('tr'), k = e.target.dataset.k, nx = tr.nextElementSibling;
    if (!nx) { addPerson(); nx = $('table').querySelector('tbody tr:last-child'); }
    var t = nx.querySelector(k ? '[data-k="' + k + '"]' : '[data-c="' + e.target.dataset.c + '"]'); if (t) t.focus();
  });
  $('table').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var id = b.closest('tr').dataset.p, i = chart.people.findIndex(function (p) { return p.id === id; }), p = chart.people[i];
    if ('rep' in b.dataset) { addPerson(p.id, i + 1); return; }
    if (b.dataset.mv) { var j = i + (+b.dataset.mv); chart.people.splice(j, 0, chart.people.splice(i, 1)[0]); }
    else if ('del' in b.dataset) {
      chart.people.forEach(function (q) { if (q.parent === id) q.parent = p.parent; if (q.dotted === id) q.dotted = null; });
      chart.people.splice(i, 1); sel.ids = sel.ids.filter(function (x) { return x !== id; });
    }
    renderTable(); draw(); commit();
  });
  function addPerson(parent, at) {
    if (parent === undefined) {
      var lastP = chart.people[chart.people.length - 1];
      parent = lastP ? (lastP.parent || lastP.id) : null;
    }
    var p = { id: uid(), parent: parent, dotted: null, vals: {}, style: {} };
    if (at == null) chart.people.push(p); else chart.people.splice(at, 0, p);
    renderTable(); draw(); commit();
    var tr = document.querySelector('#table tr[data-p="' + p.id + '"]');
    if (tr) { tr.querySelector('input').focus(); }
  }
  $('addPerson').addEventListener('click', function () { addPerson(); });

  // ---------- drawing ----------
  var drawT;
  function draw() { clearTimeout(drawT); drawT = setTimeout(drawNow, 60); }
  function drawNow() {
    last = O.fit(chart);
    var st = $('stage');
    st.style.width = (zoom * 100) + '%';
    st.classList.toggle('zoomed', zoom > 1);
    st.style.setProperty('--ar', (last.page.w / last.page.h).toFixed(4));
    st.innerHTML = chart.people.length ? O.toSvg(last, chart, { live: true }) : '<p class="oc-blank">Your chart appears here.</p>';
    markSel();
    var p = last.page;
    $('pageNote').textContent = chart.people.length ? 'Text size ' + last.f + ' pt · ' + p.group + ' ' + p.label : p.group + ' ' + p.label;
    var w = $('smallWarn');
    w.hidden = !last.tooSmall;
    if (last.tooSmall) w.innerHTML = smallText();
    renderLevels();
  }
  function smallText() {
    var tips = [];
    if (chart.arrange !== 'auto') tips.push('set Arrangement to Automatic');
    if (chart.page === 'a4p') tips.push('try A4 landscape');
    if (chart.page === 'ppt43') tips.push('try Widescreen');
    if (chart.fields.length > 2) tips.push('remove a row of text');
    tips.push('or make one chart for each team');
    return '<b>Text would be ' + last.f + ' pt, which is hard to read.</b> To make it bigger: ' + tips.join(', ') + '.';
  }
  function markSel() {
    var ids = selectedIds();
    document.querySelectorAll('#stage .oc-box').forEach(function (g) { g.classList.toggle('sel', sel.type !== 'all' && ids.indexOf(g.dataset.id) >= 0); });
    var s = $('scopeName'), n = ids.length;
    s.textContent = sel.type === 'all' ? 'The whole chart' : sel.type === 'level' ? 'Level ' + (sel.level + 1) + ' (' + n + (n === 1 ? ' box)' : ' boxes)') : n + (n === 1 ? ' selected box' : ' selected boxes');
    $('scopeLine').textContent = sel.type === 'all' ? 'All reporting lines' : 'The lines above ' + (n === 1 ? 'that box' : 'those boxes');
    document.querySelectorAll('#levels button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.lv === 'all' ? sel.type === 'all' : sel.type === 'level' && +b.dataset.lv === sel.level);
    });
  }
  function selectedIds() {
    if (sel.type === 'ids') return sel.ids.slice();
    if (sel.type === 'level') { var d = O.forest(chart).depth; return chart.people.filter(function (p) { return d[p.id] === sel.level; }).map(function (p) { return p.id; }); }
    return chart.people.map(function (p) { return p.id; });
  }
  function renderLevels() {
    var depth = O.forest(chart).depth, mx = -1;
    Object.keys(depth).forEach(function (k) { mx = Math.max(mx, depth[k]); });
    var h = '<button type="button" class="tl-btn" data-lv="all">Whole chart</button>';
    for (var i = 0; i <= Math.min(mx, 11); i++) h += '<button type="button" class="tl-btn" data-lv="' + i + '">Level ' + (i + 1) + '</button>';
    if ($('levels').innerHTML !== h) $('levels').innerHTML = h;
    if (sel.type === 'level' && sel.level > mx) sel = { type: 'all', ids: [] };
    markSel();
  }
  $('levels').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    sel = b.dataset.lv === 'all' ? { type: 'all', ids: [] } : { type: 'level', level: +b.dataset.lv, ids: [] };
    markSel();
  });
  function pick(id, add) {
    if (painter) { var p = byId(id); p.style = JSON.parse(JSON.stringify(painter)); renderTable(); draw(); commit(); return; }
    var cur = sel.type === 'ids' ? sel.ids : [];
    if (add || many) {
      var i = cur.indexOf(id); if (i >= 0) cur.splice(i, 1); else cur.push(id);
      sel = cur.length ? { type: 'ids', ids: cur } : { type: 'all', ids: [] };
    } else sel = (cur.length === 1 && cur[0] === id) ? { type: 'all', ids: [] } : { type: 'ids', ids: [id] };
    markSel();
  }
  $('stage').addEventListener('click', function (e) {
    var g = e.target.closest('.oc-box'), l = e.target.closest('[data-line]');
    if (g) pick(g.dataset.id, e.ctrlKey || e.metaKey || e.shiftKey);
    else if (l) pick(l.dataset.line, e.ctrlKey || e.metaKey || e.shiftKey);
    else if (!many && !painter) { sel = { type: 'all', ids: [] }; markSel(); }
  });
  $('many').addEventListener('click', function () { many = !many; this.classList.toggle('on', many); this.setAttribute('aria-pressed', many); });

  // ---------- colours and lines ----------
  function swatches(el, key) {
    el.innerHTML = SW.map(function (c) {
      return '<button type="button" class="oc-sw" style="background:' + c + '" data-c="' + c + '" aria-label="' + c + '"></button>';
    }).join('') + (key === 'fill2' ? '<button type="button" class="oc-sw oc-none" data-c="none" aria-label="No gradient" title="No gradient"></button>' : '') + '<label class="oc-sw oc-custom" title="Any colour"><span class="sr">Any colour</span><input type="color" value="#5C4D7D"></label>';
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (b) paint(key, b.dataset.c); });
    el.querySelector('input').addEventListener('change', function () { paint(key, this.value.toUpperCase()); });
  }
  function paint(key, c) {
    var pair = key === 'fill';
    if (key === 'line') { setLine('color', c); return; }
    if (key === 'fill2' && c === 'none' && sel.type === 'all') {
      delete chart.box.fill2; chart.levels.forEach(function (l) { delete l.fill2; }); chart.people.forEach(function (p) { delete p.style.fill2; });
      renderTable(); draw(); commit(); return;
    }
    if (sel.type === 'all') {
      chart.box[key] = c; if (pair) chart.box.text = textOn(c);
      chart.levels.forEach(function (l) { delete l[key]; if (pair) delete l.text; });
      chart.people.forEach(function (p) { delete p.style[key]; if (pair) delete p.style.text; });
    } else if (sel.type === 'level') {
      var l = chart.levels[sel.level] = chart.levels[sel.level] || {};
      for (var i = 0; i < sel.level; i++) chart.levels[i] = chart.levels[i] || {};
      l[key] = c; if (pair) l.text = textOn(c);
      selectedIds().forEach(function (id) { var p = byId(id); delete p.style[key]; if (pair) delete p.style.text; });
    } else selectedIds().forEach(function (id) { var p = byId(id); p.style[key] = c; if (pair) p.style.text = textOn(c); });
    renderTable(); draw(); commit();
  }
  function setLine(k, v) {
    if (sel.type === 'all') { chart.line[k] = v; chart.people.forEach(function (p) { if (p.line) { delete p.line[k]; if (!Object.keys(p.line).length) delete p.line; } }); }
    else selectedIds().forEach(function (id) { var p = byId(id); p.line = p.line || {}; p.line[k] = v; });
    syncLine(); draw(); commit();
  }
  function syncLine() {
    var d = chart.line.dash;
    document.querySelectorAll('[data-dash]').forEach(function (b) { b.classList.toggle('on', sel.type === 'all' && b.dataset.dash === d); });
    $('lineW').value = String(chart.line.width);
    document.querySelectorAll('[data-corner]').forEach(function (b) { b.classList.toggle('on', b.dataset.corner === chart.corners); b.setAttribute('aria-pressed', b.dataset.corner === chart.corners); });
    document.querySelectorAll('[data-gdir]').forEach(function (b) { b.classList.toggle('on', b.dataset.gdir === chart.gradDir); });
    $('font').value = chart.font;
  }
  document.querySelectorAll('[data-dash]').forEach(function (b) { b.addEventListener('click', function () { setLine('dash', b.dataset.dash); }); });
  $('lineW').addEventListener('change', function () { setLine('width', +this.value); });
  document.querySelectorAll('[data-corner]').forEach(function (b) { b.addEventListener('click', function () { chart.corners = b.dataset.corner; syncLine(); draw(); commit(); }); });
  document.querySelectorAll('[data-gdir]').forEach(function (b) { b.addEventListener('click', function () { chart.gradDir = b.dataset.gdir; syncLine(); draw(); commit(); }); });
  $('font').addEventListener('change', function () { chart.font = this.value; draw(); commit(); });
  $('shade').addEventListener('click', function () {
    var depth = O.forest(chart).depth, mx = 0;
    Object.keys(depth).forEach(function (k) { mx = Math.max(mx, depth[k]); });
    chart.levels = shades($('shadeBase').value.toUpperCase(), mx + 1);
    chart.people.forEach(function (p) { p.style = {}; delete p.badColour; });
    renderTable(); draw(); commit();
  });
  $('resetLook').addEventListener('click', function () {
    var d = base(); chart.box = d.box; chart.levels = []; chart.line = d.line;
    chart.people.forEach(function (p) { p.style = {}; delete p.line; delete p.badColour; });
    renderTable(); syncLine(); draw(); commit(); toast('Colours and lines reset. Undo brings them back.');
  });
  $('painter').addEventListener('click', function () {
    if (painter) { stopPaint(); return; }
    var id = sel.type === 'ids' ? sel.ids[0] : null;
    if (!id) { toast('First tap the box whose look you want to copy.'); return; }
    var p = byId(id), d = O.forest(chart).depth[id], lv = chart.levels[d] || {}, s = p.style;
    painter = { fill2: s.fill2 || lv.fill2 || chart.box.fill2 || 'none', fill: s.fill || lv.fill || chart.box.fill, border: s.border || lv.border || chart.box.border, text: s.text || lv.text || chart.box.text };
    this.classList.add('on'); this.textContent = 'Stop copying';
    $('stage').classList.add('painting');
    toast('Now tap the boxes that should look the same.');
  });
  function stopPaint() { painter = null; var b = $('painter'); b.classList.remove('on'); b.textContent = 'Copy format'; $('stage').classList.remove('painting'); }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && painter) stopPaint();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
  });

  // ---------- page and arrangement ----------
  function syncPage() {
    $('page').value = chart.page; $('arrange').value = chart.arrange;
    if ($('title') !== document.activeElement) $('title').value = chart.title;
    if ($('dlTitle') !== document.activeElement) $('dlTitle').value = chart.title;
  }
  $('page').addEventListener('change', function () { chart.page = this.value; draw(); commit(); });
  $('arrange').addEventListener('change', function () { chart.arrange = this.value; draw(); commit(); });
  ['title', 'dlTitle'].forEach(function (id) {
    $(id).addEventListener('input', function () { chart.title = this.value; syncPage(); draw(); commitSoon(); });
  });
  $('titleClear').addEventListener('click', function () { chart.title = ''; syncPage(); draw(); commit(); $('title').focus(); });
  document.querySelectorAll('[data-zoom]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.dataset.zoom; zoom = v === 'fit' ? 1 : Math.max(1, Math.min(5, zoom * (+v)));
      $('stage').style.width = (zoom * 100) + '%';
      $('stage').classList.toggle('zoomed', zoom > 1);
    });
  });

  function doUndo() { commit(); if (!undoStack.length) return; redoStack.push(lastJson); restore(undoStack.pop()); }
  function doRedo() { if (!redoStack.length) return; undoStack.push(lastJson); restore(redoStack.pop()); }
  $('undo').addEventListener('click', doUndo);
  $('redo').addEventListener('click', doRedo);

  // ---------- menus ----------
  function closeMenus() { document.querySelectorAll('.oc details.tl-menu[open]').forEach(function (d) { d.open = false; }); }
  document.addEventListener('click', function (e) { document.querySelectorAll('.oc details.tl-menu[open]').forEach(function (d) { if (!d.contains(e.target)) d.open = false; }); });
  $('newBlank').addEventListener('click', function () {
    closeMenus();
    var c = base(); c.fields = chart.fields; c.people = []; c.page = chart.page;
    replace(c); addPerson(null);
  });
  $('newSample').addEventListener('click', function () { closeMenus(); replace(sample()); });
  var toastT;
  function toast(m) { var t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3800); }
  function saveBlob(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  var fileBase = function () { return (chart.title || 'Org chart').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Org chart'; };
  $('saveFile').addEventListener('click', function () {
    closeMenus();
    saveBlob(new Blob([JSON.stringify(chart, null, 1)], { type: 'application/json' }), fileBase() + '.orgchart.json');
  });

  // ---------- Excel template ----------
  var isReports = function (h) { return /^(reports?\s*to|manager|line manager|reporting to)\b/i.test(h); };
  var isDotted = function (h) { return /^dotted(\s*line)?(\s*to)?/i.test(h); };
  var colourKey = function (h) {
    h = String(h).trim();
    if (/^(box\s*)?colou?r(\s*code)?$|^box\s*shade$/i.test(h)) return 'fill';
    if (/^gradient(\s*to)?$|^(box\s*)?colou?r\s*2$/i.test(h)) return 'fill2';
    if (/^text\s*colou?r(\s*code)?$/i.test(h)) return 'text';
    return null;
  };
  function sampleValue(f, i) {
    var map = { 'job title': 'Project Director', title: 'Project Director', role: 'Project Director', department: 'Projects', location: 'Milan', company: 'Your company', phone: '+00 000 000', email: 'name@example.com' };
    if (i === 0) return 'Example: Anna Rossi';
    return map[f.name.trim().toLowerCase()] || 'Your ' + f.name.toLowerCase();
  }
  function template(withData) {
    closeMenus();
    return load(LIBS.exceljs).then(function () {
      var wb = new window.ExcelJS.Workbook(), ws = wb.addWorksheet('Org chart', { views: [{ state: 'frozen', ySplit: 1 }] });
      var heads = chart.fields.map(function (f) { return f.name; }).concat(['Reports to', 'Dotted line to'], COLS.map(function (x) { return x.h; })), n = heads.length, nf = chart.fields.length, c = nameCounts();
      ws.addRow(heads);
      ws.getRow(1).eachCell(function (cell) {
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5C4D7D' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
      ws.getRow(1).height = 24;
      heads.forEach(function (h, i) { ws.getColumn(i + 1).width = i >= nf + 2 ? 14 : i >= nf ? 24 : Math.max(20, h.length + 4); });
      if (withData) {
        chart.people.forEach(function (p) {
          var par = byId(p.parent), dot = byId(p.dotted);
          var row = ws.addRow(chart.fields.map(function (f) { return p.vals[f.id] || ''; }).concat([p.parentText || (par ? labelOf(par, c) : ''), p.dottedText || (dot ? labelOf(dot, c) : '')], COLS.map(function (x) { return (p.badColour && p.badColour[x.k]) || p.style[x.k] || ''; })));
          COLS.forEach(function (x, i) {
            if (O.HEX.test(p.style[x.k])) row.getCell(nf + 3 + i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + p.style[x.k].slice(1) } };
          });
        });
      } else {
        var r = ws.addRow(chart.fields.map(sampleValue).concat(['', '', '#5C4D7D', '', '#FFFFFF']));
        r.font = { italic: true, color: { argb: 'FF7A7A80' } };
      }
      var col = function (i) { return String.fromCharCode(65 + i); };
      if (n <= 26) {
        var v = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: ["'Org chart'!$A$2:$A$1000"] };
        ws.dataValidations.add(col(nf) + '2:' + col(nf + 1) + '1000', v);
      }
      var h = wb.addWorksheet('Instructions');
      h.getColumn(1).width = 92;
      ['How to use this template', '',
        '1. One row on the "Org chart" sheet is one box on the chart.',
        '2. The first columns are the rows of text in each box. Leave a cell empty and that line is left out of the box.',
        '3. In "Reports to", type the manager\'s ' + chart.fields[0].name.toLowerCase() + ' exactly as it appears in the first column. Leave it empty for the person at the top.',
        '4. "Dotted line to" is optional. It draws a second, dashed line to another manager.',
        '5. Two people with the same name? Write the manager as: Name (' + (chart.fields[1] ? chart.fields[1].name.toLowerCase() : 'second column') + ').',
        '6. Box colour, Gradient to and Text colour are optional. Type a colour code such as #5C4D7D, or just fill the Box colour cell with a colour. Use Gradient to when a box should fade into a second colour, for example someone moving between locations. Empty cells keep the colour set on the site; type none to clear one.',
        '7. Rows that start with "Example:" are ignored, so you can delete the sample or leave it.',
        '8. Upload this file on the Org chart generator at ranjithkb.com. Fonts, line styles and the chart title are set there, and are kept if you upload an updated copy.',
        '', 'Want another column? Add the row in the tool and download the template again, or add a column and it becomes a new row of text.'
      ].forEach(function (t, i) { var r = h.addRow([t]); r.alignment = { wrapText: true }; r.font = { name: 'Arial', bold: i === 0, size: i === 0 ? 14 : 11 }; });
      return wb.xlsx.writeBuffer();
    }).then(function (buf) {
      saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), withData ? fileBase() + ' - data.xlsx' : 'Org chart template.xlsx');
    }).catch(function (e) { toast('Couldn’t make the template: ' + e.message); });
  }
  $('tplBlank').addEventListener('click', function () { template(false); });
  $('tplData').addEventListener('click', function () { template(true); });

  // rows = [[header…],[cell…]…]. Replaces the people, keeping looks for names it recognises.
  function fromGrid(rows) {
    rows = rows.map(function (r) { return r.map(function (c) { return String(c == null ? '' : c).trim(); }); });
    var head = rows.shift() || [];
    var rIdx = head.findIndex(isReports), dIdx = head.findIndex(isDotted);
    if (rIdx < 0) return { error: 'I couldn’t find a “Reports to” column. Download the template and use its first row as headings.' };
    var fields = [], map = [], colIdx = {};
    head.forEach(function (h, i) {
      if (i === rIdx || i === dIdx || !h) return;
      var ck = colourKey(h);
      if (ck) { colIdx[ck] = i; return; }
      var old = chart.fields.filter(function (f) { return f.name.toLowerCase() === h.toLowerCase(); })[0];
      var f = old ? JSON.parse(JSON.stringify(old)) : { id: uid(), name: h, align: 'c', bold: !fields.length };
      f.name = h;
      fields.push(f); map.push({ i: i, f: f });
    });
    if (!fields.length) return { error: 'There are no text columns in that sheet.' };
    var oldC = nameCounts(), keep = {};
    chart.people.forEach(function (p) { keep[labelOf(p, oldC).toLowerCase()] = p; });
    var c = JSON.parse(JSON.stringify(chart)), first = fields[0];
    c.fields = fields;
    if (c.title === SAMPLE_TITLE) c.title = ''; // the sample's title shouldn't land on someone's real chart
    var raw = [];
    c.people = [];
    rows.forEach(function (r) {
      if (!r.some(Boolean) || /^example:/i.test(r[map[0].i] || '')) return;
      var vals = {}; map.forEach(function (m) { if (r[m.i]) vals[m.f.id] = r[m.i]; });
      var was = keep[String(vals[first.id] || '').toLowerCase()];
      var p = { id: uid(), parent: null, dotted: null, vals: vals, style: was ? was.style : {} };
      if (was && was.line) p.line = was.line;
      var cols = {}; Object.keys(colIdx).forEach(function (k) { if (r[colIdx[k]]) cols[k] = r[colIdx[k]]; });
      c.people.push(p); raw.push({ p: p, rep: r[rIdx] || '', dot: dIdx >= 0 ? r[dIdx] || '' : '', cols: cols });
    });
    if (!c.people.length) return { error: 'That sheet has no people in it yet.' };
    return { chart: c, raw: raw };
  }
  function applyGrid(res) {
    if (res.error) { showReview({ text: res.error }); return; }
    var n = res.raw.length;
    replaceWith(res.chart, function () {
      res.raw.forEach(function (x) {
        var p = byId(x.p.id);
        if (x.rep) setRef(p, 'parent', x.rep);
        if (x.dot) setRef(p, 'dotted', x.dot);
        Object.keys(x.cols).forEach(function (k) { setColour(p, k, x.cols[k]); });
      });
    });
    toast(n + (n === 1 ? ' person' : ' people') + ' loaded. Undo goes back.');
  }
  function replaceWith(c, then) { commit(); chart = normalise(c); sel = { type: 'all', ids: [] }; if (then) then(); renderAll(); commit(); }

  function csvRows(t) {
    var sep = t.indexOf('\t') >= 0 ? '\t' : ',', rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"' && !cur) q = true;
      else if (c === sep) { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  // ---------- uploads ----------
  function showReview(o) {
    var d = $('revDlg');
    $('revText').textContent = o.text || '';
    $('revList').innerHTML = (o.list || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    $('revList').hidden = !(o.list || []).length;
    var sl = $('revSlide');
    sl.parentNode.hidden = !(o.slides && o.slides.length > 1);
    if (o.slides) sl.innerHTML = o.slides.map(function (s, i) { return '<option value="' + i + '">' + esc(s.label + ' · ' + s.tree.length + ' boxes') + '</option>'; }).join('');
    $('revUse').hidden = !o.use;
    revUse = o.use || null;
    $('revCancel').textContent = o.use ? 'Cancel' : 'Close';
    if (d.showModal) d.showModal();
  }
  var revUse = null;
  $('revUse').addEventListener('click', function () { var f = revUse; $('revDlg').close(); if (f) f(); });
  $('revCancel').addEventListener('click', function () { $('revDlg').close(); });
  function reviewSlide(slides, i) {
    var s = slides[i], c = s.chart, unsure = c.people.filter(function (p) { return p.unsure; });
    var edges = c.people.filter(function (p) { return p.parent; }).length;
    var f = c.fields[0], list = unsure.slice(0, 12).map(function (p) { return (p.vals[f.id] || 'A box with no text') + ': manager is a best guess'; });
    if (unsure.length > 12) list.push('and ' + (unsure.length - 12) + ' more');
    return {
      text: 'Found ' + c.people.length + (c.people.length === 1 ? ' box, ' : ' boxes, ') + edges + (edges === 1 ? ' reporting line and ' : ' reporting lines and ') + c.fields.length + (c.fields.length === 1 ? ' row' : ' rows') + ' of text' + (s.flavour === 'SmartArt' ? ' in a SmartArt chart' : '') + '. ' +
        (unsure.length ? unsure.length + (unsure.length === 1 ? ' needs' : ' need') + ' checking, and will be marked in the table.' : 'Nothing looks unclear.') + ' This replaces the chart on screen; Undo brings it back.',
      list: list, slides: slides, use: function () { var k = +$('revSlide').value || 0; replace(slides[k].chart); toast('Loaded. Check the reporting lines in the table.'); }
    };
  }
  function savedEdits(c, slides) {
    // text retyped inside PowerPoint after export comes back with the chart
    var note = '', changed = 0, odd = 0, seen = {};
    var raw = (slides[0] && slides[0].raw) || [];
    raw.forEach(function (s) {
      var m = /^oc:(.+)$/.exec(s.name || ''); if (!m) return;
      seen[m[1]] = 1;
      var p = c.people.filter(function (x) { return x.id === m[1]; })[0]; if (!p) { odd++; return; }
      var lines = O.fieldLines(c, p), now = s.info.paras.map(function (t) { return t.split(/\t+/).map(function (x) { return x.trim(); }).filter(Boolean); });
      var same = lines.length === now.length && lines.every(function (l, i) { return l.cells.length === now[i].length; });
      if (!same) { if (lines.map(function (l) { return l.cells.map(function (x) { return x.t; }).join('|'); }).join('/') !== now.map(function (l) { return l.join('|'); }).join('/')) odd++; return; }
      lines.forEach(function (l, i) { l.cells.forEach(function (x, j) { if (x.t !== now[i][j]) { p.vals[x.fd.id] = now[i][j]; changed++; } }); });
    });
    if (raw.length && c.people.some(function (p) { return !seen[p.id]; })) odd++;
    if (changed) note = 'Picked up ' + changed + ' text change' + (changed === 1 ? '' : 's') + ' made in PowerPoint. ';
    if (odd) note += 'Some boxes were changed in PowerPoint in a way I can’t follow, so those come back as they left this tool.';
    return note;
  }
  function openFile(file) {
    var ext = (/\.([a-z0-9]+)$/i.exec(file.name) || [0, ''])[1].toLowerCase();
    var fail = function (e) { showReview({ text: 'I couldn’t read that file. ' + (e && e.message ? e.message : '') }); };
    if (ext === 'json') {
      file.text().then(function (t) {
        var c = JSON.parse(t);
        if (!c || !Array.isArray(c.people) || !Array.isArray(c.fields)) throw new Error('It isn’t a saved chart from this tool.');
        replace(c); toast('Chart restored.');
      }).catch(fail);
    } else if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
      file.text().then(function (t) { applyGrid(fromGrid(csvRows(t))); }).catch(fail);
    } else if (ext === 'xlsx') {
      load(LIBS.exceljs).then(function () { return file.arrayBuffer(); }).then(function (buf) {
        var wb = new window.ExcelJS.Workbook();
        return wb.xlsx.load(buf).then(function () {
          var ws = wb.getWorksheet('Org chart') || wb.worksheets[0], rows = [];
          var keys = {};
          ws.eachRow({ includeEmpty: false }, function (r) {
            var a = [];
            for (var i = 1; i <= ws.columnCount; i++) {
              var cell = r.getCell(i), t = cell.text;
              if (!rows.length) keys[i] = colourKey(t);
              // a cell simply filled with a colour counts as that colour
              else if (!t && keys[i] && cell.fill && cell.fill.fgColor && /^[0-9A-F]{8}$/i.test(cell.fill.fgColor.argb || '')) t = '#' + cell.fill.fgColor.argb.slice(2);
              a.push(t);
            }
            rows.push(a);
          });
          applyGrid(fromGrid(rows));
        });
      }).catch(fail);
    } else if (ext === 'pptx' || ext === 'docx') {
      load(LIBS.jszip).then(function () { return file.arrayBuffer(); }).then(function (buf) { return O.readOffice(buf, ext, base); }).then(function (res) {
        if (res.saved) {
          var c = normalise(res.saved), note = ext === 'pptx' ? savedEdits(c, res.slides) : '';
          replace(c); toast(note || 'Chart restored, ready to edit.');
          return;
        }
        var slides = res.slides.filter(function (s) { return s.chart; }).sort(function (a, b) { return b.tree.length - a.tree.length; });
        if (!slides.length) {
          showReview({ text: 'I couldn’t find any chart boxes in that file. Charts pasted as a picture can’t be read yet: type them into the table or the Excel template instead.' });
          return;
        }
        showReview(reviewSlide(slides, 0));
      }).catch(fail);
    } else if (/^(pdf|png|jpe?g|webp|gif|heic)$/.test(ext)) {
      showReview({ text: 'Pictures and PDFs of charts can’t be read yet, because they hold no real boxes or lines. Please type the chart into the table, or use the Excel template.' });
    } else if (ext === 'ppt' || ext === 'doc' || ext === 'xls') {
      showReview({ text: 'That’s an older Office format. Open it in Office and save it as ' + { ppt: '.pptx', doc: '.docx', xls: '.xlsx' }[ext] + ', then upload that.' });
    } else showReview({ text: 'I can read .xlsx, .csv, .pptx, .docx and saved chart files.' });
  }
  $('fileIn').addEventListener('change', function () { var f = this.files[0]; this.value = ''; closeMenus(); if (f) openFile(f); });
  var drop = document.querySelector('.oc');
  ['dragover', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { if (e.dataTransfer && e.dataTransfer.types && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) e.preventDefault(); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) openFile(f); });

  // paste
  $('pasteOpen').addEventListener('click', function () { closeMenus(); $('pasteTx').value = ''; $('pasteDlg').showModal(); });
  $('pasteCancel').addEventListener('click', function () { $('pasteDlg').close(); });
  $('pasteGo').addEventListener('click', function () {
    var rows = csvRows($('pasteTx').value.trim()); $('pasteDlg').close();
    if (!rows.length) return;
    if (rows[0].some(function (h) { return isReports(h.trim()); })) { applyGrid(fromGrid(rows)); return; }
    var added = 0, later = [];
    rows.forEach(function (r) {
      if (!r.some(function (x) { return x.trim(); })) return;
      var p = { id: uid(), parent: null, dotted: null, vals: {}, style: {} };
      chart.fields.forEach(function (f, i) { var v = (r[i] || '').trim(); if (v) p.vals[f.id] = v; });
      chart.people.push(p); added++;
      later.push({ p: p, rep: (r[chart.fields.length] || '').trim(), dot: (r[chart.fields.length + 1] || '').trim() });
      COLS.forEach(function (x, i) { var v = (r[chart.fields.length + 2 + i] || '').trim(); if (v) setColour(p, x.k, v); });
    });
    later.forEach(function (x) { if (x.rep) setRef(x.p, 'parent', x.rep); if (x.dot) setRef(x.p, 'dotted', x.dot); });
    renderTable(); draw(); commit(); toast(added + ' added to the table.');
  });

  // ---------- download ----------
  function renderDl() {
    var groups = ['PowerPoint', 'Word'], P = O.PAGES;
    $('dlOpts').innerHTML = groups.map(function (g) {
      return '<fieldset><legend>' + g + '</legend>' + Object.keys(P).filter(function (k) { return P[k].group === g; }).map(function (k) {
        return '<label class="oc-radio"><input type="radio" name="dlp" value="' + k + '"' + (chart.page === k ? ' checked' : '') + '><span>' + P[k].label + '</span></label>';
      }).join('') + '</fieldset>';
    }).join('');
    syncDl();
  }
  function syncDl() {
    drawNowQuiet();
    var p = last.page, n = $('dlNote');
    n.innerHTML = (p.kind === 'pptx' ? 'Boxes and lines stay editable in PowerPoint, and lines stay attached when you move a box.' : 'The chart goes in as a sharp picture that fills the page. Upload this file here to edit it again.') +
      (last.tooSmall ? '<span class="oc-warnline">' + smallText() + '</span>' : '<span class="oc-okline">Text will be ' + last.f + ' pt on this page.</span>');
  }
  function drawNowQuiet() { clearTimeout(drawT); drawNow(); }
  $('dlOpts').addEventListener('change', function (e) { chart.page = e.target.value; syncPage(); syncDl(); commit(); });
  $('download').addEventListener('click', function () {
    if (!chart.people.length) { toast('Add at least one person first.'); return; }
    renderDl(); $('dlDlg').showModal();
  });
  $('dlCancel').addEventListener('click', function () { $('dlDlg').close(); });
  function svgToPng(r) {
    return new Promise(function (ok, no) {
      var px = Math.round((r.page.w - 2 * r.page.m) * 4.2);
      var svg = O.toSvg(r, chart, { inner: true, px: px }), img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = img.naturalWidth || px; c.height = img.naturalHeight || Math.round(px * (r.page.h - 2 * r.page.m) / (r.page.w - 2 * r.page.m));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { if (b) ok(b); else no(new Error('The picture could not be made.')); }, 'image/png');
      };
      img.onerror = function () { no(new Error('The picture could not be made.')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  $('dlGo').addEventListener('click', function () {
    var b = this, r = O.fit(chart), kind = r.page.kind;
    b.disabled = true; b.textContent = 'Making…';
    load(LIBS.jszip).then(function () {
      if (kind === 'pptx') return O.buildPptx(chart, r);
      return svgToPng(r).then(function (png) { return O.buildDocx(chart, r, png); });
    }).then(function (blob) {
      saveBlob(blob, fileBase() + '.' + kind); $('dlDlg').close();
    }).catch(function (e) { toast('Download failed: ' + e.message); }).then(function () { b.disabled = false; b.textContent = 'Download'; });
  });

  // ---------- settings tabs ----------
  document.querySelectorAll('[data-lt]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-lt]').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
      document.querySelectorAll('[data-ls]').forEach(function (x) { x.hidden = x.dataset.ls !== b.dataset.lt; });
    });
  });

  // ---------- phone tabs ----------
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.dataset.tab); });
  });
  function setTab(t) {
    document.querySelector('.oc').dataset.show = t;
    document.querySelectorAll('[data-tab]').forEach(function (b) { var on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  }

  function renderAll() { syncPage(); renderFields(); renderTable(); syncLine(); stopPaint(); drawNowQuiet(); }

  // ---------- start ----------
  (function init() {
    Object.keys(O.PAGES).forEach(function (k) {
      var p = O.PAGES[k], o = document.createElement('option'); o.value = k; o.textContent = p.group + ' · ' + p.label; $('page').appendChild(o);
    });
    Object.keys(O.FONTS).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = k; $('font').appendChild(o); });
    swatches($('swFill'), 'fill'); swatches($('swFill2'), 'fill2'); swatches($('swBorder'), 'border'); swatches($('swText'), 'text'); swatches($('swLine'), 'line');
    var saved = store.get('current'), c = null;
    if (saved) { try { c = normalise(JSON.parse(saved)); } catch (e) { c = null; } }
    chart = c || normalise(sample());
    lastJson = snapshot();
    $('saved').textContent = c ? 'Saved in this browser' : 'Sample chart';
    setTab('people'); renderAll(); syncUndo();
    window.addEventListener('beforeunload', commit);
  })();
})();
