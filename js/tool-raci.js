/* ============================================================
   TOOL — RACI matrix builder  (productivity/raci.html)
   A matrix = { id, name, mode, roles:[{id,name}], rows:[{id,type,name,cells:{roleId:'AR'}}] }
   Cells hold the letters in a fixed order (A, R, S, C, I), so
   "A/R" is stored as "AR". Saved per matrix in localStorage
   (rc:list + rc:m:<id>). Exports draw from the same data.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LIBS = { exceljs: '../js/vendor/exceljs-4.4.0.min.js', jspdf: '../js/vendor/jspdf-2.5.2.min.js' };
  var ORDER = 'ARSCI';
  var LETTERS = {
    R: { name: 'Responsible', desc: 'Does the work. At least one per deliverable.' },
    A: { name: 'Accountable', desc: 'Owns the outcome and signs it off. Exactly one per deliverable.' },
    S: { name: 'Support', desc: 'Helps the responsible party with resources or effort.' },
    C: { name: 'Consulted', desc: 'Asked for input before the work is done — two-way.' },
    I: { name: 'Informed', desc: 'Kept up to date on progress or decisions — one-way.' }
  };
  // fixed colours for exports (the page uses CSS variables)
  var XC = {
    A: { bg: '1B1B1F', fg: 'FFFFFF' }, R: { bg: '5C4D7D', fg: 'FFFFFF' }, AR: { bg: '3E3459', fg: 'FFFFFF' },
    S: { bg: 'E9D9A8', fg: '5A4507' }, C: { bg: 'D5E8DC', fg: '1F5139' }, I: { bg: 'E7E2D6', fg: '4A4A4C' }
  };
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var norm = function (s) { return ORDER.split('').filter(function (c) { return String(s || '').toUpperCase().indexOf(c) >= 0; }).join(''); };
  var label = function (v) { return v === 'AR' ? 'A/R' : v.split('').join('/'); };
  var colourKey = function (v) { return v === 'AR' ? 'AR' : v.charAt(0); };

  var store = {
    get: function (k) { try { return localStorage.getItem('rc:' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('rc:' + k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem('rc:' + k); } catch (e) { /* private mode */ } }
  };

  // ---------- templates ----------
  function build(name, roles, rows, mode) {
    var rs = roles.map(function (n) { return { id: uid(), name: n }; });
    return {
      id: uid(), name: name, mode: mode || 'RACI', roles: rs,
      rows: rows.map(function (r) {
        if (typeof r === 'string') return { id: uid(), type: 'head', name: r, cells: {} };
        var cells = {};
        r[1].split(' ').forEach(function (v, i) { if (v && v !== '-' && rs[i]) cells[rs[i].id] = norm(v); });
        return { id: uid(), type: 'task', name: r[0], cells: cells };
      })
    };
  }
  var TEMPLATES = [
    { name: 'EPC project', desc: 'Definition, tendering and execution on a capital project', make: function () {
      return build('EPC project responsibilities',
        ['Project manager', 'Project engineer', 'Engineering lead', 'Procurement', 'Construction manager', 'HSE', 'Project controls', 'Client'],
        ['Definition',
          ['Project execution plan', 'A R C C C C C I'],
          ['Basis of design', 'A C R - C C - C'],
          ['Management of change (MoC)', 'A R C C C C C I'],
          ['Risk register', 'A C C C C C R I'],
          'Tendering',
          ['Scope of work and specifications', 'A R C C C C - I'],
          ['Bidder list and tender issue', 'A C - R - - - I'],
          ['Technical bid evaluation', 'C A R I C C - -'],
          ['Commercial evaluation', 'A I - R - - C -'],
          ['Contract award', 'A C - R - - C C'],
          'Execution',
          ['Integrated schedule', 'A C C C C - R I'],
          ['Temporary site facilities', 'C A C C R C - I'],
          ['Site HSE plan', 'A I I I C R I I'],
          ['Monthly progress report', 'A C C C C C R I']
        ]);
    } },
    { name: 'Software rollout', desc: 'From scope to go-live for a business system', make: function () {
      return build('Software rollout',
        ['Sponsor', 'Product owner', 'Tech lead', 'Developers', 'QA', 'Operations', 'End users'],
        [['Business case', 'A R C - - - C'], ['Requirements', 'C A C I I I C'], ['Architecture', 'I C A C - C -'],
          ['Build', 'I C A R C - -'], ['Testing', 'I C C S A C C'], ['Training', 'I A - - - R I'], ['Go-live decision', 'A R C I C C I']], 'RASCI');
    } },
    { name: 'Blank', desc: 'Three roles, four deliverables', make: function () {
      return build('New matrix', ['Role 1', 'Role 2', 'Role 3'], [['Deliverable 1', '- - -'], ['Deliverable 2', '- - -'], ['Deliverable 3', '- - -'], ['Deliverable 4', '- - -']]);
    } }
  ];

  // ---------- load ----------
  var list = []; try { list = JSON.parse(store.get('list') || '[]'); } catch (e) { list = []; }
  var M = null;
  function load(id) { try { return JSON.parse(store.get('m:' + id)); } catch (e) { return null; } }
  function save() {
    M.updated = Date.now();
    var ok = store.set('m:' + M.id, JSON.stringify(M));
    if (list.indexOf(M.id) < 0) { list.unshift(M.id); store.set('list', JSON.stringify(list)); }
    store.set('cur', M.id);
    var s = $('saved'); s.textContent = ok ? 'Saved' : 'Not saved — browser storage is off';
    clearTimeout(save.t); save.t = setTimeout(function () { s.textContent = ok ? 'Saved in this browser' : s.textContent; }, 900);
  }
  function open(m) { M = m; if (!M.mode) M.mode = 'RACI'; save(); renderAll(); }

  // ---------- grid ----------
  var grid = $('grid'), focusRole = '';
  function checkRow(r) {
    if (r.type !== 'task') return null;
    var a = 0, rr = 0;
    M.roles.forEach(function (ro) { var v = r.cells[ro.id] || ''; if (v.indexOf('A') >= 0) a++; if (v.indexOf('R') >= 0) rr++; });
    if (!a && !rr) return { bad: true, t: 'Unassigned' };
    if (a === 0) return { bad: true, t: 'No A' };
    if (a > 1) return { bad: true, t: a + ' A’s' };
    if (rr === 0) return { bad: true, t: 'No R' };
    return { bad: false, t: 'OK' };
  }

  function renderGrid() {
    var cols = M.roles.length;
    var h = '<thead><tr><th class="rc-c0" scope="col"><span class="rc-th-k">Deliverable</span></th>' +
      M.roles.map(function (ro, i) {
        return '<th scope="col" class="rc-role' + (focusRole === ro.id ? ' focus' : '') + '" data-role="' + ro.id + '">' +
          '<textarea rows="2" class="rc-rname" data-rname="' + ro.id + '" aria-label="Role ' + (i + 1) + ' name" spellcheck="false">' + esc(ro.name) + '</textarea>' +
          '<span class="rc-rtools">' +
          '<button type="button" data-rmove="-1" data-r="' + ro.id + '" aria-label="Move ' + esc(ro.name) + ' left"' + (i === 0 ? ' disabled' : '') + '>‹</button>' +
          '<button type="button" data-rmove="1" data-r="' + ro.id + '" aria-label="Move ' + esc(ro.name) + ' right"' + (i === cols - 1 ? ' disabled' : '') + '>›</button>' +
          '<button type="button" data-rdel="' + ro.id + '" aria-label="Delete role ' + esc(ro.name) + '">✕</button></span></th>';
      }).join('') + '<th class="rc-chk" scope="col"><span class="rc-th-k">Check</span></th><th class="rc-x" aria-label="Row actions"></th></tr></thead><tbody>';
    var n = 0;
    M.rows.forEach(function (r, ri) {
      if (r.type === 'head') {
        h += '<tr class="rc-head" data-row="' + r.id + '"><th colspan="' + (cols + 2) + '" scope="rowgroup"><div class="rc-in">' +
          '<span class="rc-drag" data-drag aria-hidden="true">⋮⋮</span>' +
          '<input class="rc-tname rc-hname" data-tname="' + r.id + '" value="' + esc(r.name) + '" aria-label="Section name" spellcheck="false"></div></th>' +
          '<td class="rc-x"><button type="button" data-del="' + r.id + '" aria-label="Delete section">✕</button></td></tr>';
        return;
      }
      n++;
      var c = checkRow(r);
      h += '<tr data-row="' + r.id + '"><th class="rc-c0" scope="row"><div class="rc-in"><span class="rc-drag" data-drag aria-hidden="true">⋮⋮</span><span class="rc-no">' + n + '</span>' +
        '<input class="rc-tname" data-tname="' + r.id + '" value="' + esc(r.name) + '" aria-label="Deliverable ' + n + '" spellcheck="false"></div></th>' +
        M.roles.map(function (ro, ci) {
          var v = r.cells[ro.id] || '';
          return '<td class="' + (focusRole === ro.id ? 'focus' : '') + '"><button type="button" class="rc-cell" data-cell data-r="' + ri + '" data-c="' + ci + '" data-v="' + v + '"' +
            ' aria-label="' + esc(ro.name) + ', ' + esc(r.name) + ': ' + (v ? v.split('').map(function (l) { return LETTERS[l].name; }).join(' and ') : 'none') + '">' + (v ? label(v) : '') + '</button></td>';
        }).join('') +
        '<td class="rc-chk"><span class="' + (c.bad ? 'bad' : 'ok') + '">' + c.t + '</span></td>' +
        '<td class="rc-x"><button type="button" data-del="' + r.id + '" aria-label="Delete deliverable">✕</button></td></tr>';
    });
    h += '</tbody><tfoot><tr><th class="rc-c0" scope="row"><span class="rc-th-k">Load</span></th>' + M.roles.map(function (ro) {
      var k = { A: 0, R: 0, S: 0, C: 0, I: 0 };
      M.rows.forEach(function (r) { (r.cells[ro.id] || '').split('').forEach(function (l) { if (k[l] !== undefined) k[l]++; }); });
      var parts = ['A', 'R'].concat(M.mode === 'RASCI' ? ['S'] : []).concat(['C', 'I']).filter(function (l) { return k[l]; });
      return '<td class="rc-load">' + (parts.length ? parts.map(function (l) { return '<span data-v="' + l + '">' + k[l] + l + '</span>'; }).join('') : '<span class="none">—</span>') + '</td>';
    }).join('') + '<td></td><td></td></tr></tfoot>';
    grid.innerHTML = h;
    grid.classList.toggle('rasci', M.mode === 'RASCI');
    document.body.classList.toggle('rc-rasci', M.mode === 'RASCI');
  }

  function renderSide() {
    // focus selector
    var fs = $('focusRole');
    fs.innerHTML = '<option value="">Everyone</option>' + M.roles.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + '</option>'; }).join('');
    if (!M.roles.some(function (r) { return r.id === focusRole; })) focusRole = '';
    fs.value = focusRole;
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === M.mode); b.setAttribute('aria-pressed', b.dataset.mode === M.mode); });
    var keys = M.mode === 'RASCI' ? 'RASCI' : 'RACI';
    $('key').innerHTML = keys.split('').map(function (l) { return '<div><dt><span class="rc-chip" data-v="' + l + '">' + l + '</span>' + LETTERS[l].name + '</dt><dd>' + LETTERS[l].desc + '</dd></div>'; }).join('') +
      '<div><dt><span class="rc-chip" data-v="AR">A/R</span>Both</dt><dd>Does the work and owns it — common for a single-person deliverable.</dd></div>';
    renderByRole();
  }
  function renderByRole() {
    $('byRole').innerHTML = M.roles.filter(function (ro) { return !focusRole || ro.id === focusRole; }).map(function (ro) {
      var own = [], does = [], other = [];
      M.rows.forEach(function (r) {
        if (r.type !== 'task') return;
        var v = r.cells[ro.id] || '';
        if (v.indexOf('A') >= 0) own.push(r.name); else if (v.indexOf('R') >= 0 || v.indexOf('S') >= 0) does.push(r.name); else if (v) other.push(r.name);
      });
      var li = function (k, arr) { return arr.length ? '<p><b>' + k + '</b> ' + arr.map(esc).join(' · ') + '</p>' : ''; };
      return '<div class="rc-role-card"><h3>' + esc(ro.name) + '</h3>' +
        (own.length + does.length + other.length ? li('Owns', own) + li('Does', does) + li('Consulted / informed on', other) : '<p class="none">Nothing assigned yet.</p>') + '</div>';
    }).join('');
  }
  function renderAll() { $('mname').value = M.name; renderGrid(); renderSide(); renderOpen(); }
  function refreshRow(ri) {
    var r = M.rows[ri], tr = grid.querySelector('tr[data-row="' + r.id + '"]'); if (!tr) return;
    var c = checkRow(r); var s = tr.querySelector('.rc-chk span'); s.className = c.bad ? 'bad' : 'ok'; s.textContent = c.t;
    renderGridFoot(); renderByRole();   // footer counts and the by-role list are cheap to redraw
  }
  function renderGridFoot() {
    var cells = grid.querySelectorAll('tfoot .rc-load');
    M.roles.forEach(function (ro, i) {
      var k = { A: 0, R: 0, S: 0, C: 0, I: 0 };
      M.rows.forEach(function (r) { (r.cells[ro.id] || '').split('').forEach(function (l) { if (k[l] !== undefined) k[l]++; }); });
      var parts = ['A', 'R'].concat(M.mode === 'RASCI' ? ['S'] : []).concat(['C', 'I']).filter(function (l) { return k[l]; });
      if (cells[i]) cells[i].innerHTML = parts.length ? parts.map(function (l) { return '<span data-v="' + l + '">' + k[l] + l + '</span>'; }).join('') : '<span class="none">—</span>';
    });
  }

  // ---------- cell editing ----------
  function cycle() { return M.mode === 'RASCI' ? ['', 'R', 'A', 'AR', 'S', 'C', 'I'] : ['', 'R', 'A', 'AR', 'C', 'I']; }
  function setCell(btn, v) {
    var ri = +btn.dataset.r, ci = +btn.dataset.c, r = M.rows[ri], ro = M.roles[ci];
    if (v) r.cells[ro.id] = v; else delete r.cells[ro.id];
    btn.dataset.v = v; btn.textContent = v ? label(v) : '';
    btn.setAttribute('aria-label', ro.name + ', ' + r.name + ': ' + (v ? v.split('').map(function (l) { return LETTERS[l].name; }).join(' and ') : 'none'));
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    save(); refreshRow(ri);
  }
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cell]');
    if (b) {
      var cyc = cycle(), i = cyc.indexOf(b.dataset.v || '');
      setCell(b, cyc[(i + 1) % cyc.length]); return;
    }
    var d = e.target.closest('[data-del]');
    if (d) { var idx = M.rows.findIndex(function (r) { return r.id === d.dataset.del; }); var gone = M.rows.splice(idx, 1)[0]; save(); renderGrid(); renderByRole(); toast('Deleted “' + (gone.name || 'row') + '”', function () { M.rows.splice(idx, 0, gone); save(); renderGrid(); renderByRole(); }); return; }
    var rd = e.target.closest('[data-rdel]');
    if (rd) {
      var ci = M.roles.findIndex(function (r) { return r.id === rd.dataset.rdel; }); var role = M.roles.splice(ci, 1)[0];
      save(); renderGrid(); renderSide();
      toast('Deleted role “' + role.name + '”', function () { M.roles.splice(ci, 0, role); save(); renderGrid(); renderSide(); }); return;
    }
    var rm = e.target.closest('[data-rmove]');
    if (rm) {
      var at = M.roles.findIndex(function (r) { return r.id === rm.dataset.r; }), to = at + (+rm.dataset.rmove);
      if (to < 0 || to >= M.roles.length) return;
      var x = M.roles.splice(at, 1)[0]; M.roles.splice(to, 0, x); save(); renderGrid(); renderSide();
      var nb = grid.querySelector('[data-rmove="' + rm.dataset.rmove + '"][data-r="' + x.id + '"]'); if (nb && !nb.disabled) nb.focus();
    }
  });
  grid.addEventListener('contextmenu', function (e) {
    var b = e.target.closest('[data-cell]'); if (!b) return;
    e.preventDefault(); setCell(b, '');
  });
  grid.addEventListener('keydown', function (e) {
    var b = e.target.closest('[data-cell]');
    var t = e.target.closest('[data-tname]');
    if (t && e.key === 'Enter') {
      e.preventDefault();
      var idx = M.rows.findIndex(function (r) { return r.id === t.dataset.tname; });
      var nr = { id: uid(), type: 'task', name: '', cells: {} };
      M.rows.splice(idx + 1, 0, nr); save(); renderGrid(); renderByRole();
      grid.querySelector('[data-tname="' + nr.id + '"]').focus(); return;
    }
    if (t && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      var all = [].slice.call(grid.querySelectorAll('[data-tname]')), k = all.indexOf(t) + (e.key === 'ArrowDown' ? 1 : -1);
      if (all[k]) { e.preventDefault(); all[k].focus(); } return;
    }
    if (t && e.key === 'ArrowRight' && t.selectionStart === t.value.length) {
      var f = t.closest('tr').querySelector('[data-cell]'); if (f) { e.preventDefault(); f.focus(); } return;
    }
    if (!b) return;
    var key = e.key.toUpperCase();
    if (/^[ARCIS]$/.test(key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (key === 'S' && M.mode !== 'RASCI') { M.mode = 'RASCI'; save(); renderSide(); grid.classList.add('rasci'); document.body.classList.add('rc-rasci'); }
      var cur = b.dataset.v || '', fresh = Date.now() - (b._typed || 0) < 900;
      var nv = fresh ? norm(cur.indexOf(key) >= 0 ? cur.replace(key, '') : cur + key) : key;
      b._typed = Date.now(); e.preventDefault(); setCell(b, nv); return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '-') { e.preventDefault(); setCell(b, ''); return; }
    var mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (e.key === 'Enter') mv = [1, 0];
    if (mv) {
      e.preventDefault();
      var r = +b.dataset.r, c = +b.dataset.c;
      if (mv[1] === -1 && c === 0) { var tn = b.closest('tr').querySelector('[data-tname]'); if (tn) tn.focus(); return; }
      var cells = [].slice.call(grid.querySelectorAll('[data-cell][data-c="' + (c + mv[1]) + '"]'));
      if (mv[0]) {
        var rows = cells.map(function (x) { return +x.dataset.r; });
        var pos = rows.indexOf(r) + mv[0]; if (cells[pos]) cells[pos].focus();
      } else { var same = grid.querySelector('[data-cell][data-r="' + r + '"][data-c="' + (c + mv[1]) + '"]'); if (same) same.focus(); }
    }
  });
  grid.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.tname) { var r = M.rows.find(function (x) { return x.id === t.dataset.tname; }); r.name = t.value; save(); renderByRole(); }
    if (t.dataset.rname) { var ro = M.roles.find(function (x) { return x.id === t.dataset.rname; }); ro.name = t.value.replace(/\n/g, ' '); save(); renderByRole(); var o = $('focusRole').querySelector('option[value="' + ro.id + '"]'); if (o) o.textContent = ro.name; }
  });
  grid.addEventListener('keydown', function (e) { if (e.target.dataset.rname && e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });

  // ---------- drag to reorder rows (pointer events, so it works with a finger too) ----------
  grid.addEventListener('pointerdown', function (e) {
    var hdl = e.target.closest('[data-drag]'); if (!hdl) return;
    e.preventDefault();
    var tr = hdl.closest('tr'), id = tr.dataset.row, rows = [].slice.call(grid.tBodies[0].rows);
    var from = rows.indexOf(tr), to = from;
    tr.classList.add('dragging');
    var line = document.createElement('div'); line.className = 'rc-dropline'; $('scroll').appendChild(line);
    var place = function (y) {
      to = rows.length;
      for (var i = 0; i < rows.length; i++) { var bx = rows[i].getBoundingClientRect(); if (y < bx.top + bx.height / 2) { to = i; break; } }
      var ref = rows[Math.min(to, rows.length - 1)].getBoundingClientRect(), sb = $('scroll').getBoundingClientRect();
      line.style.top = ((to < rows.length ? ref.top : ref.bottom) - sb.top + $('scroll').scrollTop - 1) + 'px';
    };
    place(e.clientY);
    var move = function (ev) { place(ev.clientY); };
    var up = function () {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      line.remove(); tr.classList.remove('dragging');
      if (to > from) to--;
      if (to !== from) { var x = M.rows.splice(from, 1)[0]; M.rows.splice(to, 0, x); save(); renderGrid(); renderByRole(); }
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });

  // ---------- toolbar ----------
  $('mname').addEventListener('input', function () { M.name = this.value; save(); renderOpen(); });
  $('addRow').onclick = function () {
    var nr = { id: uid(), type: 'task', name: '', cells: {} }; M.rows.push(nr); save(); renderGrid(); renderByRole();
    grid.querySelector('[data-tname="' + nr.id + '"]').focus();
  };
  $('addHead').onclick = function () {
    var nr = { id: uid(), type: 'head', name: 'New section', cells: {} }; M.rows.push(nr); save(); renderGrid();
    var i = grid.querySelector('[data-tname="' + nr.id + '"]'); i.focus(); i.select();
  };
  $('addRole').onclick = function () {
    if (M.roles.length >= 30) return toast('Thirty roles is the limit here.');
    var ro = { id: uid(), name: 'Role ' + (M.roles.length + 1) }; M.roles.push(ro); save(); renderGrid(); renderSide();
    var t = grid.querySelector('[data-rname="' + ro.id + '"]'); t.focus(); t.select();
    $('scroll').scrollLeft = $('scroll').scrollWidth;
  };
  document.querySelectorAll('[data-mode]').forEach(function (b) {
    b.onclick = function () {
      if (M.mode === b.dataset.mode) return;
      if (b.dataset.mode === 'RACI' && M.rows.some(function (r) { return Object.keys(r.cells).some(function (k) { return r.cells[k].indexOf('S') >= 0; }); })) {
        M.rows.forEach(function (r) { Object.keys(r.cells).forEach(function (k) { var v = r.cells[k].replace('S', ''); if (v) r.cells[k] = v; else delete r.cells[k]; }); });
        toast('Support (S) entries removed.');
      }
      M.mode = b.dataset.mode; save(); renderGrid(); renderSide();
    };
  });
  $('focusRole').onchange = function () {
    focusRole = this.value;
    grid.querySelectorAll('.focus').forEach(function (x) { x.classList.remove('focus'); });
    grid.classList.toggle('has-focus', !!focusRole);
    if (focusRole) {
      var ci = M.roles.findIndex(function (r) { return r.id === focusRole; });
      grid.querySelectorAll('thead th.rc-role')[ci].classList.add('focus');
      grid.querySelectorAll('[data-cell][data-c="' + ci + '"]').forEach(function (b) { b.parentNode.classList.add('focus'); });
      var th = grid.querySelectorAll('thead th.rc-role')[ci]; th.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    renderByRole();
  };

  // matrices menu
  function renderOpen() {
    var mats = list.map(load).filter(Boolean);
    $('openPop').innerHTML = '<div class="tl-mh">Start from</div>' + TEMPLATES.map(function (t, i) {
      return '<button class="tl-mi" type="button" data-tpl="' + i + '"><b>' + t.name + '</b><span>' + t.desc + '</span></button>';
    }).join('') + '<hr><div class="tl-mh">Saved in this browser</div>' + (mats.length ? mats.map(function (m) {
      var rows = m.rows.filter(function (r) { return r.type === 'task'; }).length;
      return '<div class="tl-my"><button class="tl-mi' + (m.id === M.id ? ' cur' : '') + '" type="button" data-open="' + m.id + '"><b>' + esc(m.name || 'Untitled') + '</b><span>' + rows + ' deliverables · ' + m.roles.length + ' roles</span></button>' +
        '<button class="x" type="button" data-kill="' + m.id + '" aria-label="Delete ' + esc(m.name) + '">✕</button></div>';
    }).join('') : '<p class="tl-none">Nothing yet.</p>') + '<hr><button class="tl-mi" type="button" id="dupBtn"><b>Duplicate this matrix</b><span>Keep the original as it is</span></button>';
  }
  $('openPop').addEventListener('click', function (e) {
    var t = e.target.closest('[data-tpl]'), o = e.target.closest('[data-open]'), k = e.target.closest('[data-kill]');
    if (t) { closeMenus(); open(TEMPLATES[+t.dataset.tpl].make()); }
    else if (o) { closeMenus(); var m = load(o.dataset.open); if (m) open(m); }
    else if (k) {
      var id = k.dataset.kill, gone = load(id);
      list = list.filter(function (x) { return x !== id; }); store.set('list', JSON.stringify(list)); store.del('m:' + id);
      if (id === M.id) { var next = list.map(load).filter(Boolean)[0]; open(next || TEMPLATES[2].make()); } else renderOpen();
      toast('Deleted “' + (gone && gone.name) + '”', function () { store.set('m:' + id, JSON.stringify(gone)); list.unshift(id); store.set('list', JSON.stringify(list)); renderOpen(); });
    } else if (e.target.closest('#dupBtn')) {
      closeMenus(); var c = JSON.parse(JSON.stringify(M)); c.id = uid(); c.name = M.name + ' (copy)'; open(c);
    }
  });
  function closeMenus() { document.querySelectorAll('.rc details[open]').forEach(function (d) { d.open = false; }); }
  document.addEventListener('click', function (e) { document.querySelectorAll('.rc details[open]').forEach(function (d) { if (!d.contains(e.target)) d.open = false; }); });

  // ---------- toast ----------
  var toastEl;
  function toast(msg, undo) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'tl-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = '<span></span>' + (undo ? '<button type="button">Undo</button>' : '');
    toastEl.firstChild.textContent = msg; toastEl.hidden = false;
    if (undo) toastEl.querySelector('button').onclick = function () { toastEl.hidden = true; undo(); };
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.hidden = true; }, undo ? 6000 : 3000);
  }

  // ---------- import ----------
  function fromTable(rows, name) {
    rows = rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
    if (rows.length < 2) return null;
    var head = rows[0].map(function (c) { return String(c).trim(); });
    var drop = /^(check|status|#|no\.?)$/i;
    var roleCols = []; head.forEach(function (h, i) { if (i > 0 && h && !drop.test(h)) roleCols.push(i); });
    if (!roleCols.length) return null;
    var m = { id: uid(), name: name || 'Imported matrix', mode: 'RACI', roles: roleCols.map(function (i) { return { id: uid(), name: head[i] }; }), rows: [] };
    rows.slice(1).forEach(function (r) {
      var nm = String(r[0] || '').trim(), cells = {}, any = false;
      roleCols.forEach(function (ci, k) { var v = norm(String(r[ci] || '').replace(/[^ARCIS]/gi, '')); if (v) { cells[m.roles[k].id] = v; any = true; if (v.indexOf('S') >= 0) m.mode = 'RASCI'; } });
      if (/^load$/i.test(nm)) return;
      m.rows.push({ id: uid(), type: any ? 'task' : 'head', name: nm, cells: cells });
    });
    return m;
  }
  function parseDelim(text) {
    var tab = text.indexOf('\t') >= 0, d = tab ? '\t' : (text.split('\n')[0].split(';').length > text.split('\n')[0].split(',').length ? ';' : ',');
    var out = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    row.push(cell); out.push(row);
    return out;
  }
  $('pasteOpen').onclick = function () { closeMenus(); $('pasteTx').value = ''; $('pasteDlg').showModal(); };
  $('pasteCancel').onclick = function () { $('pasteDlg').close(); };
  $('pasteNew').onclick = function () {
    var m = fromTable(parseDelim($('pasteTx').value));
    if (!m) { toast('I couldn’t find role names in the first row and deliverables under them.'); return; }
    $('pasteDlg').close(); open(m);
  };
  $('csvIn').onchange = function () {
    var f = this.files[0]; if (!f) return; closeMenus();
    f.text().then(function (t) {
      var m = fromTable(parseDelim(t.replace(/^﻿/, '')), f.name.replace(/\.[^.]+$/, ''));
      if (!m) toast('That file doesn’t look like a RACI grid.'); else open(m);
    });
    this.value = '';
  };

  // ---------- share link (deflate + base64url in the #) ----------
  function compact() { return { n: M.name, m: M.mode, r: M.roles.map(function (r) { return r.name; }), d: M.rows.map(function (r) { return r.type === 'head' ? [r.name] : [r.name, M.roles.map(function (ro) { return r.cells[ro.id] || ''; }).join(',')]; }) }; }
  function expand(c) {
    var m = { id: uid(), name: c.n, mode: c.m || 'RACI', roles: c.r.map(function (n) { return { id: uid(), name: n }; }), rows: [] };
    c.d.forEach(function (r) {
      if (r.length === 1) { m.rows.push({ id: uid(), type: 'head', name: r[0], cells: {} }); return; }
      var cells = {}; r[1].split(',').forEach(function (v, i) { if (v && m.roles[i]) cells[m.roles[i].id] = norm(v); });
      m.rows.push({ id: uid(), type: 'task', name: r[0], cells: cells });
    });
    return m;
  }
  var b64 = function (bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var unb64 = function (s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  function pack(obj) {
    var data = new TextEncoder().encode(JSON.stringify(obj));
    if (!window.CompressionStream) return Promise.resolve('j' + b64(data));
    return new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return 'z' + b64(new Uint8Array(b)); });
  }
  function unpack(s) {
    var bytes = unb64(s.slice(1));
    if (s[0] === 'j') return Promise.resolve(JSON.parse(new TextDecoder().decode(bytes)));
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text().then(JSON.parse);
  }
  $('shareLink').onclick = function () {
    closeMenus();
    pack(compact()).then(function (p) {
      var url = location.origin + location.pathname + '#m=' + p;
      var done = function () { toast('Link copied — anyone who opens it gets their own copy of this matrix.'); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, function () { prompt('Copy this link', url); });
      else prompt('Copy this link', url);
    });
  };

  // ---------- exports ----------
  function loadLib(src, test) {
    if (test()) return Promise.resolve();
    return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('Could not load ' + src)); }; document.head.appendChild(s); });
  }
  var fileName = function (ext) { return (M.name || 'raci').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) + '.' + ext; };
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  document.querySelectorAll('[data-out]').forEach(function (b) {
    b.onclick = function () {
      closeMenus();
      var k = b.dataset.out;
      var run = { csv: outCSV, png: outPNG, xlsx: outXLSX, pdf: outPDF }[k];
      Promise.resolve().then(run).catch(function (e) { toast('Download failed: ' + e.message); });
    };
  });

  function outCSV() {
    var q = function (s) { s = String(s == null ? '' : s); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var lines = [['Deliverable'].concat(M.roles.map(function (r) { return r.name; })).concat(['Check']).map(q).join(',')];
    M.rows.forEach(function (r) {
      if (r.type === 'head') { lines.push(q(r.name)); return; }
      lines.push([r.name].concat(M.roles.map(function (ro) { return r.cells[ro.id] ? label(r.cells[ro.id]) : ''; })).concat([checkRow(r).t]).map(q).join(','));
    });
    download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), fileName('csv'));
  }

  // one layout for PNG and PDF: sizes in "units" scaled to the target
  function layout(ctx, unit) {
    var font = function (w, s) { return w + ' ' + (s * unit) + 'px "Space Grotesk", Helvetica, Arial, sans-serif'; };
    ctx.font = font('500', 11);
    var c0 = 150;
    M.rows.forEach(function (r) { c0 = Math.max(c0, ctx.measureText(r.name).width / unit + 40); });
    c0 = Math.min(c0, 320);
    var cw = 74, chk = 70, rh = 24, hh = 56, title = 46, keyH = 40;
    return { font: font, c0: c0, cw: cw, chk: chk, rh: rh, hh: hh, title: title, keyH: keyH, w: c0 + cw * M.roles.length + chk };
  }
  function wrap(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines.slice(0, 3);
  }
  function clip(ctx, text, maxW) { text = String(text); if (ctx.measureText(text).width <= maxW) return text; while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1); return text + '…'; }
  function drawSheet(ctx, rows, L, u, page) {
    var x0 = 0, y = 0, X = function (v) { return v * u; };
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, X(L.w + 40), 99999);
    var pad = 20; ctx.save(); ctx.translate(X(pad), X(pad));
    ctx.fillStyle = '#1B1B1F'; ctx.font = L.font('600', 18); ctx.textBaseline = 'alphabetic';
    ctx.fillText(M.name || 'RACI matrix', 0, X(20));
    ctx.font = L.font('400', 9); ctx.fillStyle = '#4A4A4C';
    ctx.fillText((M.mode === 'RASCI' ? 'RASCI' : 'RACI') + ' matrix · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + (page ? ' · page ' + page : ''), 0, X(34));
    y = L.title;
    // header
    ctx.fillStyle = '#F0EDE6'; ctx.fillRect(0, X(y), X(L.w), X(L.hh));
    ctx.fillStyle = '#1B1B1F'; ctx.font = L.font('600', 9.5); ctx.textBaseline = 'middle';
    ctx.fillText('Deliverable', X(8), X(y + L.hh - 12));
    M.roles.forEach(function (ro, i) {
      var cx = L.c0 + i * L.cw, lines = wrap(ctx, ro.name, X(L.cw - 8));
      lines.forEach(function (ln, k) { ctx.textAlign = 'center'; ctx.fillText(ln, X(cx + L.cw / 2), X(y + L.hh - 12 - (lines.length - 1 - k) * 11)); });
    });
    ctx.textAlign = 'center'; ctx.fillText('Check', X(L.c0 + M.roles.length * L.cw + L.chk / 2), X(y + L.hh - 12)); ctx.textAlign = 'left';
    y += L.hh;
    var n = 0;
    rows.forEach(function (r) {
      if (r.type === 'head') {
        ctx.fillStyle = '#E7E2EF'; ctx.fillRect(0, X(y), X(L.w), X(L.rh));
        ctx.fillStyle = '#3E3459'; ctx.font = L.font('600', 10); ctx.fillText(clip(ctx, r.name.toUpperCase(), X(L.w - 16)), X(8), X(y + L.rh / 2));
      } else {
        n = r._n;
        ctx.fillStyle = '#4A4A4C'; ctx.font = L.font('500', 8.5); ctx.fillText(String(n), X(8), X(y + L.rh / 2));
        ctx.fillStyle = '#1B1B1F'; ctx.font = L.font('500', 10); ctx.fillText(clip(ctx, r.name, X(L.c0 - 34)), X(26), X(y + L.rh / 2));
        M.roles.forEach(function (ro, i) {
          var v = r.cells[ro.id]; if (!v) return;
          var c = XC[colourKey(v)], cx = L.c0 + i * L.cw;
          ctx.fillStyle = '#' + c.bg; ctx.fillRect(X(cx + 3), X(y + 3), X(L.cw - 6), X(L.rh - 6));
          ctx.fillStyle = '#' + c.fg; ctx.font = L.font('600', 10); ctx.textAlign = 'center'; ctx.fillText(label(v), X(cx + L.cw / 2), X(y + L.rh / 2)); ctx.textAlign = 'left';
        });
        var ck = checkRow(r);
        ctx.fillStyle = ck.bad ? '#C2463D' : '#2F6B4F'; ctx.font = L.font('500', 8.5); ctx.textAlign = 'center';
        ctx.fillText(ck.t, X(L.c0 + M.roles.length * L.cw + L.chk / 2), X(y + L.rh / 2)); ctx.textAlign = 'left';
      }
      ctx.strokeStyle = '#C9C2B4'; ctx.lineWidth = X(0.6); ctx.beginPath(); ctx.moveTo(0, X(y + L.rh)); ctx.lineTo(X(L.w), X(y + L.rh)); ctx.stroke();
      y += L.rh;
    });
    // column rules
    ctx.strokeStyle = '#C9C2B4'; ctx.lineWidth = X(0.6);
    for (var i = 0; i <= M.roles.length + 1; i++) { var cx = L.c0 + i * L.cw; ctx.beginPath(); ctx.moveTo(X(cx), X(L.title)); ctx.lineTo(X(cx), X(y)); ctx.stroke(); }
    ctx.strokeStyle = '#1B1B1F'; ctx.lineWidth = X(1); ctx.strokeRect(0, X(L.title), X(L.w), X(y - L.title));
    // key
    y += 16; var kx = 0; ctx.font = L.font('500', 9);
    var keys = (M.mode === 'RASCI' ? ['R', 'A', 'AR', 'S', 'C', 'I'] : ['R', 'A', 'AR', 'C', 'I']);
    keys.forEach(function (k) {
      var c = XC[k], nm = k === 'AR' ? 'Accountable and responsible' : LETTERS[k].name;
      ctx.fillStyle = '#' + c.bg; ctx.fillRect(X(kx), X(y), X(26), X(16));
      ctx.fillStyle = '#' + c.fg; ctx.textAlign = 'center'; ctx.fillText(label(k), X(kx + 13), X(y + 8)); ctx.textAlign = 'left';
      ctx.fillStyle = '#1B1B1F'; ctx.fillText(nm, X(kx + 32), X(y + 8));
      kx += 32 + ctx.measureText(nm).width / u + 18;
    });
    ctx.restore();
    return y + 16 + pad * 2;
  }
  function numberRows() { var n = 0; M.rows.forEach(function (r) { if (r.type === 'task') r._n = ++n; }); }
  function cleanRows() { M.rows.forEach(function (r) { delete r._n; }); }

  function outPNG() {
    numberRows();
    var u = 2, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    var L = layout(ctx, u);
    var H = L.title + L.hh + M.rows.length * L.rh + 16 + 16 + 40 + 40;
    cv.width = Math.ceil((L.w + 40) * u); cv.height = Math.ceil(H * u);
    ctx = cv.getContext('2d'); L = layout(ctx, u);
    drawSheet(ctx, M.rows, L, u);
    cleanRows();
    cv.toBlob(function (b) { download(b, fileName('png')); }, 'image/png');
  }

  function outPDF() {
    return loadLib(LIBS.jspdf, function () { return window.jspdf; }).then(function () {
      numberRows();
      var probe = document.createElement('canvas').getContext('2d'), L0 = layout(probe, 1);
      var wide = L0.w + 40 > 800; // A3 when the roles don't fit A4 landscape
      var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: wide ? 'a3' : 'a4' });
      var pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      var u = 3, scale = Math.min(1, (pw - 40) / (L0.w + 40));
      var perPage = Math.max(5, Math.floor(((ph - 30) / scale - (L0.title + L0.hh + 80)) / L0.rh));
      var pages = []; for (var i = 0; i < M.rows.length; i += perPage) pages.push(M.rows.slice(i, i + perPage));
      if (!pages.length) pages.push([]);
      pages.forEach(function (rows, pi) {
        var cv = document.createElement('canvas'), ctx = cv.getContext('2d'), L = layout(ctx, u);
        var H = L.title + L.hh + rows.length * L.rh + 80 + 40;
        cv.width = Math.ceil((L.w + 40) * u); cv.height = Math.ceil(H * u);
        ctx = cv.getContext('2d'); L = layout(ctx, u);
        var used = drawSheet(ctx, rows, L, u, pages.length > 1 ? (pi + 1) + ' of ' + pages.length : '');
        if (pi) doc.addPage();
        var img = cv.toDataURL('image/png');
        doc.addImage(img, 'PNG', 20, 15, (L.w + 40) * scale, H * scale, undefined, 'FAST');
      });
      cleanRows();
      doc.setProperties({ title: M.name || 'RACI matrix' });
      doc.save(fileName('pdf'));
    });
  }

  function outXLSX() {
    return loadLib(LIBS.exceljs, function () { return window.ExcelJS; }).then(function () {
      var wb = new window.ExcelJS.Workbook(); wb.creator = 'ranjithkb.com RACI builder';
      var ws = wb.addWorksheet('RACI', { views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
      var nR = M.roles.length;
      ws.getColumn(1).width = 5; ws.getColumn(2).width = 42;
      for (var i = 0; i < nR; i++) ws.getColumn(3 + i).width = 13;
      ws.getColumn(3 + nR).width = 12;
      var tcell = ws.getCell(1, 1); tcell.value = M.name || 'RACI matrix'; tcell.font = { bold: true, size: 14 };
      ws.getCell(2, 1).value = (M.mode === 'RASCI' ? 'RASCI' : 'RACI') + ' matrix — exactly one A and at least one R per deliverable'; ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF4A4A4C' }, size: 9 };
      var hdr = ws.getRow(3); hdr.height = 34;
      hdr.getCell(1).value = '#'; hdr.getCell(2).value = 'Deliverable';
      M.roles.forEach(function (ro, i) { hdr.getCell(3 + i).value = ro.name; });
      hdr.getCell(3 + nR).value = 'Check';
      for (var c = 1; c <= 3 + nR; c++) {
        var hc = hdr.getCell(c);
        hc.font = { bold: true, color: { argb: 'FFFFFFFF' } }; hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B1B1F' } };
        hc.alignment = { vertical: 'middle', horizontal: c > 2 ? 'center' : 'left', wrapText: true };
      }
      var line = 4, n = 0, border = { style: 'thin', color: { argb: 'FFC9C2B4' } };
      var colL = function (i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
      var firstRole = colL(2), lastRole = colL(1 + nR);
      M.rows.forEach(function (r) {
        var row = ws.getRow(line);
        if (r.type === 'head') {
          row.getCell(2).value = r.name; ws.mergeCells(line, 2, line, 3 + nR);
          row.getCell(2).font = { bold: true, color: { argb: 'FF3E3459' } };
          for (var c2 = 1; c2 <= 3 + nR; c2++) row.getCell(c2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E2EF' } };
        } else {
          row.getCell(1).value = ++n; row.getCell(2).value = r.name;
          M.roles.forEach(function (ro, i) {
            var v = r.cells[ro.id] || '', cell = row.getCell(3 + i);
            cell.value = v ? label(v) : null; cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: border, left: border, bottom: border, right: border };
          });
          // a live check: re-counts if the letters are edited in Excel
          var rng = firstRole + line + ':' + lastRole + line;
          row.getCell(3 + nR).value = { formula: 'IF(COUNTIF(' + rng + ',"*A*")=0,"No A",IF(COUNTIF(' + rng + ',"*A*")>1,COUNTIF(' + rng + ',"*A*")&" A\'s",IF(COUNTIF(' + rng + ',"*R*")=0,"No R","OK")))', result: checkRow(r).t };
          row.getCell(3 + nR).alignment = { horizontal: 'center' };
        }
        row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
        line++;
      });
      // colour by letter with conditional formats, so edits in Excel recolour too
      if (line > 4 && nR) {
        var ref = firstRole + '4:' + lastRole + (line - 1), top = firstRole + '4';
        var rule = function (formula, k, p) { return { type: 'expression', priority: p, formulae: [formula], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF' + XC[k].bg } }, font: { bold: true, color: { argb: 'FF' + XC[k].fg } } } }; };
        ws.addConditionalFormatting({ ref: ref, rules: [
          rule('AND(ISNUMBER(SEARCH("A",' + top + ')),ISNUMBER(SEARCH("R",' + top + ')))', 'AR', 1),
          rule('ISNUMBER(SEARCH("A",' + top + '))', 'A', 2), rule('ISNUMBER(SEARCH("R",' + top + '))', 'R', 3),
          rule('ISNUMBER(SEARCH("S",' + top + '))', 'S', 4), rule('ISNUMBER(SEARCH("C",' + top + '))', 'C', 5), rule('ISNUMBER(SEARCH("I",' + top + '))', 'I', 6)
        ] });
        var chk = colL(2 + nR) + '4:' + colL(2 + nR) + (line - 1);
        ws.addConditionalFormatting({ ref: chk, rules: [{ type: 'expression', priority: 7, formulae: ['AND(' + colL(2 + nR) + '4<>"OK",' + colL(2 + nR) + '4<>"")'], style: { font: { bold: true, color: { argb: 'FFC2463D' } } } }] });
        // load per role
        var lr = ws.getRow(line + 1); lr.getCell(2).value = 'Load (A / R count)'; lr.getCell(2).font = { bold: true };
        M.roles.forEach(function (ro, i) {
          var col = colL(2 + i), rg = col + '4:' + col + (line - 1);
          lr.getCell(3 + i).value = { formula: 'COUNTIF(' + rg + ',"*A*")&" A / "&COUNTIF(' + rg + ',"*R*")&" R"' };
          lr.getCell(3 + i).alignment = { horizontal: 'center' }; lr.getCell(3 + i).font = { size: 9, color: { argb: 'FF4A4A4C' } };
        });
      }
      var kw = wb.addWorksheet('Key');
      kw.getColumn(1).width = 8; kw.getColumn(2).width = 16; kw.getColumn(3).width = 70;
      kw.addRow(['Letter', 'Meaning', 'What it means']).font = { bold: true };
      (M.mode === 'RASCI' ? 'RASCI' : 'RACI').split('').concat(['AR']).forEach(function (k) {
        var rw = kw.addRow([label(k), k === 'AR' ? 'Both' : LETTERS[k].name, k === 'AR' ? 'Does the work and owns it.' : LETTERS[k].desc]);
        rw.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + XC[k].bg } };
        rw.getCell(1).font = { bold: true, color: { argb: 'FF' + XC[k].fg } }; rw.getCell(1).alignment = { horizontal: 'center' };
      });
      return wb.xlsx.writeBuffer().then(function (buf) {
        download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName('xlsx'));
      });
    });
  }

  // ---------- start ----------
  function start() {
    var h = location.hash.match(/[#&]m=([A-Za-z0-9_-]+)/);
    if (h) {
      unpack(h[1]).then(function (c) {
        history.replaceState(null, '', location.pathname);
        open(expand(c)); toast('Opened the shared matrix — saved as your own copy.');
      }).catch(function () { boot(); toast('That share link looks damaged.'); });
      return;
    }
    boot();
  }
  function boot() {
    var cur = store.get('cur'), m = cur && load(cur);
    if (!m) { var first = list.map(load).filter(Boolean)[0]; m = first || TEMPLATES[0].make(); }
    open(m);
  }
  start();
})();
