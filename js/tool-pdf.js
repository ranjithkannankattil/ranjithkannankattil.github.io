/* ============================================================
   TOOL — PDF toolkit  (productivity/pdf.html)
   Sources are the files added; pages[] is the output order, each
   page pointing back at a source page (or a photo, or a blank).
   PDF.js draws thumbnails and previews; pdf-lib writes the result.
   Placed items (signatures, text, dates) are stored per page as
   images in fractions of the page as seen, so they survive rotation.
   Nothing leaves the browser.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var VENDOR = '../js/vendor/';
  var COLORS = ['#5C4D7D', '#A8522E', '#1F6F78', '#B8860B', '#2F6B4F', '#A33A2C', '#3B5A7A', '#6B2740'];
  var A4 = [595.28, 841.89], LETTER = [612, 792];

  var sources = [];   // {id, name, kind:'pdf'|'img', bytes, pdfjs, count, color, encrypted, password, img:{w,h,bytes,type}}
  var pages = [];     // {uid, src, idx, rot, sel, w, h, kind:'pdf'|'img'|'blank'}
  var placed = {};    // uid -> [{id, fx, fy, fw, fh, png (dataURL), ar, text?, kind}]
  var signature = null; // {png, ar}
  var lastClick = -1;
  var uid = function () { return Math.random().toString(36).slice(2, 10); };

  // ---------- libraries (loaded on first use) ----------
  var libs = {};
  function load(src, test) {
    if (test()) return Promise.resolve();
    if (libs[src]) return libs[src];
    return (libs[src] = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = VENDOR + src; s.onload = ok; s.onerror = function () { no(new Error('could not load ' + src)); };
      document.head.appendChild(s);
    }));
  }
  function pdfjs() {
    return load('pdfjs-3.11.174.min.js', function () { return window.pdfjsLib; }).then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = VENDOR + 'pdfjs-3.11.174.worker.min.js';
      return window.pdfjsLib;
    });
  }
  function pdflib() { return load('pdf-lib-1.17.1.min.js', function () { return window.PDFLib; }).then(function () { return window.PDFLib; }); }

  // ---------- adding files ----------
  var drop = $('drop'), fileIn = $('fileIn');
  drop.addEventListener('click', function (e) { if (e.target !== fileIn) fileIn.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
  fileIn.addEventListener('change', function () { addFiles(fileIn.files); fileIn.value = ''; });
  ['dragenter', 'dragover'].forEach(function (t) { document.addEventListener(t, function (e) { if (hasFiles(e)) { e.preventDefault(); document.body.classList.add('pk-dragging'); } }); });
  ['dragleave', 'drop'].forEach(function (t) { document.addEventListener(t, function (e) { if (t === 'dragleave' && e.relatedTarget) return; document.body.classList.remove('pk-dragging'); }); });
  document.addEventListener('drop', function (e) { if (hasFiles(e)) { e.preventDefault(); addFiles(e.dataTransfer.files); } });
  function hasFiles(e) { return e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  document.addEventListener('paste', function (e) {
    var fs = [].slice.call((e.clipboardData && e.clipboardData.files) || []);
    if (fs.length) { e.preventDefault(); addFiles(fs); }
  });

  function addFiles(list) {
    var fs = [].slice.call(list || []);
    if (!fs.length) return;
    status('Reading ' + fs.length + (fs.length === 1 ? ' file…' : ' files…'));
    fs.reduce(function (p, f) { return p.then(function () { return addOne(f); }); }, Promise.resolve())
      .then(function () { status(''); render(); })
      .catch(function (e) { status(''); render(); toast(e.message || String(e)); });
  }
  function addOne(f) {
    var isPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
    var isImg = /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(f.name);
    if (!isPdf && !isImg) { toast('Skipped ' + f.name + ' — not a PDF or an image.'); return Promise.resolve(); }
    return f.arrayBuffer().then(function (buf) {
      var src = { id: uid(), name: f.name, kind: isPdf ? 'pdf' : 'img', bytes: new Uint8Array(buf), color: COLORS[sources.length % COLORS.length] };
      if (isPdf) return openPdf(src).then(function () { pushSource(src); });
      return openImage(src, f).then(function () { pushSource(src); });
    });
  }
  function openPdf(src, pw) {
    return pdfjs().then(function (lib) {
      var task = lib.getDocument({ data: src.bytes.slice(), isEvalSupported: false, password: pw || undefined });
      return task.promise.then(function (doc) {
        src.pdfjs = doc; src.count = doc.numPages; if (pw) { src.encrypted = true; src.password = pw; }
        // is it encrypted for pdf-lib's purposes? (owner-password files open in PDF.js without a prompt)
        return doc.getMetadata().catch(function () { return {}; }).then(function () {
          var head = new TextDecoder('latin1').decode(src.bytes.subarray(Math.max(0, src.bytes.length - 4096)));
          var any = new TextDecoder('latin1').decode(src.bytes.subarray(0, Math.min(src.bytes.length, 2e6)));
          if (/\/Encrypt\s/.test(head) || /\/Encrypt\s*\d+\s+\d+\s+R/.test(any)) src.encrypted = true;
          var sizes = [];
          var next = function (i) {
            if (i > doc.numPages) return sizes;
            return doc.getPage(i).then(function (pg) { var v = pg.getViewport({ scale: 1 }); sizes.push([v.width, v.height]); return next(i + 1); });
          };
          return next(1).then(function (s) { src.sizes = s; });
        });
      }, function (err) {
        if (err && err.name === 'PasswordException') {
          var p = prompt((pw ? 'Wrong password. ' : '') + '“' + src.name + '” is password-protected. Password:');
          if (p === null) throw new Error('Skipped ' + src.name + ' (no password).');
          return openPdf(src, p);
        }
        throw new Error('Couldn’t open ' + src.name + ' — it may be damaged.');
      });
    });
  }
  function openImage(src, f) {
    return decodeImage(new Blob([src.bytes], { type: f.type || 'image/jpeg' })).then(function (bmp) {
      // keep JPEG/PNG bytes as they are; anything else is re-encoded as JPEG
      var t = (f.type || '').toLowerCase();
      if (t === 'image/jpeg' || t === 'image/png') { src.img = { w: bmp.width, h: bmp.height, type: t === 'image/png' ? 'png' : 'jpg', bytes: src.bytes }; src.bmp = bmp; return; }
      var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0);
      return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.92); }).then(function (b) { return b.arrayBuffer(); }).then(function (ab) {
        src.img = { w: bmp.width, h: bmp.height, type: 'jpg', bytes: new Uint8Array(ab) }; src.bmp = bmp;
      });
    }, function () { throw new Error('This browser can’t read ' + f.name + '. Try saving it as JPG first.'); });
  }
  function decodeImage(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob, { imageOrientation: 'from-image' }).catch(function () { return viaImg(blob); });
    return viaImg(blob);
  }
  function viaImg(blob) {
    return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = URL.createObjectURL(blob); });
  }
  function pushSource(src) {
    sources.push(src);
    if (src.kind === 'pdf') for (var i = 0; i < src.count; i++) pages.push({ uid: uid(), src: src.id, idx: i, rot: 0, kind: 'pdf', w: src.sizes[i][0], h: src.sizes[i][1] });
    else pages.push({ uid: uid(), src: src.id, idx: 0, rot: 0, kind: 'img', w: src.img.w, h: src.img.h });
    if (!$('outName').value) $('outName').value = src.name.replace(/\.[^.]+$/, '') + (sources.length > 1 ? '' : '');
    if (sources.length === 2 && $('outName').value === sources[0].name.replace(/\.[^.]+$/, '')) $('outName').value = 'Combined';
  }
  var srcOf = function (id) { for (var i = 0; i < sources.length; i++) if (sources[i].id === id) return sources[i]; return null; };

  // ---------- render ----------
  var grid = $('grid');
  function render() {
    var any = pages.length > 0 || sources.length > 0;
    $('work').hidden = !any;
    drop.classList.toggle('small', any);
    renderFiles(); renderGrid(); renderSel(); renderPlaced();
    $('goBtn').disabled = !pages.length;
  }
  function renderFiles() {
    $('files').innerHTML = sources.map(function (s) {
      var n = pages.filter(function (p) { return p.src === s.id; }).length;
      return '<span class="pk-file" style="--c:' + s.color + '"><i></i><b title="' + esc(s.name) + '">' + esc(s.name) + '</b><em>' +
        (s.kind === 'pdf' ? n + ' of ' + s.count + ' pages' : 'photo') + (s.encrypted ? ' · locked' : '') + '</em>' +
        '<button type="button" data-rmsrc="' + s.id + '" aria-label="Remove ' + esc(s.name) + '">✕</button></span>';
    }).join('') + '<button type="button" class="pk-add" id="addMore">+ Add files</button>';
  }
  $('files').addEventListener('click', function (e) {
    if (e.target.id === 'addMore') { fileIn.click(); return; }
    var b = e.target.closest('[data-rmsrc]'); if (!b) return;
    var id = b.dataset.rmsrc, keepS = sources.slice(), keepP = pages.slice();
    sources = sources.filter(function (s) { return s.id !== id; });
    pages = pages.filter(function (p) { return p.src !== id; });
    render();
    toast('Removed ' + (srcOf.call ? '' : '') + 'a file', function () { sources = keepS; pages = keepP; render(); });
  });

  var thumbs = {}; // "src:idx" -> dataURL
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); drawThumb(e.target); } });
  }, { rootMargin: '300px' }) : null;

  function renderGrid() {
    grid.innerHTML = pages.map(function (p, i) {
      var s = srcOf(p.src), side = (p.rot % 180) ? [p.h, p.w] : [p.w, p.h];
      var ar = side[0] / side[1], marks = (placed[p.uid] || []).length;
      return '<div class="pk-page' + (p.sel ? ' sel' : '') + '" role="option" aria-selected="' + !!p.sel + '" tabindex="' + (i === 0 ? 0 : -1) + '" data-i="' + i + '" style="--c:' + (s ? s.color : '#999') + '">' +
        '<div class="pk-thumb" style="aspect-ratio:' + ar.toFixed(4) + '"><div class="pk-rot" style="--r:' + p.rot + 'deg;--s:' + ((p.rot % 180) ? (1 / ar).toFixed(4) : 1) + ';--ar:' + (p.w / p.h).toFixed(4) + '" data-thumb="' + (p.kind === 'blank' ? '' : p.src + ':' + p.idx) + '">' +
        (p.kind === 'blank' ? '<span class="pk-blank">Blank</span>' : '') + '</div>' +
        (marks ? '<span class="pk-mark" title="' + marks + ' placed item' + (marks > 1 ? 's' : '') + '">✎ ' + marks + '</span>' : '') + '</div>' +
        '<div class="pk-cap"><b>' + (i + 1) + '</b><span>' + (p.kind === 'blank' ? 'blank' : p.kind === 'img' ? 'photo' : 'p. ' + (p.idx + 1)) + '</span>' +
        '<button type="button" class="pk-pb" data-act="rot" aria-label="Rotate page ' + (i + 1) + '">⟳</button>' +
        '<button type="button" class="pk-pb" data-act="del" aria-label="Delete page ' + (i + 1) + '">✕</button></div></div>';
    }).join('');
    grid.querySelectorAll('[data-thumb]').forEach(function (el) {
      var k = el.dataset.thumb; if (!k) return;
      if (thumbs[k]) setThumb(el, thumbs[k]); else if (io) io.observe(el); else drawThumb(el);
    });
  }
  function setThumb(el, url) { el.style.backgroundImage = 'url(' + url + ')'; el.classList.add('has'); }
  var drawing = {};
  function drawThumb(el) {
    var k = el.dataset.thumb; if (!k) return;
    if (thumbs[k]) { setThumb(el, thumbs[k]); return; }
    if (drawing[k]) { drawing[k].then(function () { if (thumbs[k]) setThumb(el, thumbs[k]); }); return; }
    var parts = k.split(':'), s = srcOf(parts[0]); if (!s) return;
    drawing[k] = rasterize(s, +parts[1], 240).then(function (c) {
      thumbs[k] = c.toDataURL('image/jpeg', 0.8);
      grid.querySelectorAll('[data-thumb="' + k + '"]').forEach(function (x) { setThumb(x, thumbs[k]); });
    }).catch(function () { /* leave it grey */ });
  }
  // draw one source page to a canvas `width` px wide (at the source's own rotation)
  function rasterize(s, idx, width, height) {
    if (s.kind === 'img') {
      var c = document.createElement('canvas'), sc = width / s.img.w;
      c.width = Math.round(width); c.height = Math.round(height || s.img.h * sc);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(s.bmp, 0, 0, c.width, c.height);
      return Promise.resolve(c);
    }
    return s.pdfjs.getPage(idx + 1).then(function (pg) {
      var v1 = pg.getViewport({ scale: 1 }), v = pg.getViewport({ scale: width / v1.width });
      var c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      return pg.render({ canvasContext: x, viewport: v, intent: 'print' }).promise.then(function () { return c; });
    });
  }

  // ---------- selection ----------
  function renderSel() {
    var n = pages.filter(function (p) { return p.sel; }).length;
    $('selCount').textContent = pages.length ? (n ? n + ' of ' + pages.length + ' selected' : pages.length + ' pages') : '';
    ['rotL', 'rotR', 'dupBtn', 'delBtn'].forEach(function (id) { $(id).title = $(id).title.replace(/ — .*$/, ''); });
    $('extractBtn').disabled = !n;
    $('delBtn').textContent = n ? 'Delete ' + n : 'Delete';
    $('goBtn').textContent = splitMode() === 'one' ? 'Download PDF' : 'Download files';
  }
  function targets() { var s = pages.filter(function (p) { return p.sel; }); return s.length ? s : pages; }
  function select(i, e) {
    var p = pages[i]; if (!p) return;
    if (e && e.shiftKey && lastClick >= 0) {
      var a = Math.min(lastClick, i), b = Math.max(lastClick, i);
      for (var k = a; k <= b; k++) pages[k].sel = true;
    } else if (e && (e.metaKey || e.ctrlKey)) p.sel = !p.sel;
    else p.sel = !p.sel;
    lastClick = i;
    syncSel();
  }
  function syncSel() {
    grid.querySelectorAll('.pk-page').forEach(function (el) { var p = pages[+el.dataset.i]; el.classList.toggle('sel', !!p.sel); el.setAttribute('aria-selected', !!p.sel); });
    renderSel();
  }
  $('selAll').onclick = function () { pages.forEach(function (p) { p.sel = true; }); syncSel(); };
  $('selNone').onclick = function () { pages.forEach(function (p) { p.sel = false; }); syncSel(); };
  $('rangeIn').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return; e.preventDefault();
    var set = parseRange(this.value, pages.length);
    if (!set) { toast('Use page numbers like 1-3, 7, 10-'); return; }
    pages.forEach(function (p, i) { p.sel = set.has(i); }); syncSel();
  });
  function parseRange(s, max) {
    s = s.trim(); if (!s) return null;
    var out = new Set(), ok = true;
    s.split(/[,;\s]+/).filter(Boolean).forEach(function (part) {
      var m = part.match(/^(\d*)\s*[-–]\s*(\d*)$/), n = part.match(/^\d+$/);
      if (n) { var v = +part; if (v >= 1 && v <= max) out.add(v - 1); }
      else if (m && (m[1] || m[2])) { var a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : max; for (var k = Math.max(1, a); k <= Math.min(max, b); k++) out.add(k - 1); }
      else if (/^odd$/i.test(part)) { for (var o = 0; o < max; o += 2) out.add(o); }
      else if (/^even$/i.test(part)) { for (var ev = 1; ev < max; ev += 2) out.add(ev); }
      else ok = false;
    });
    return ok && out.size ? out : null;
  }

  // ---------- page operations ----------
  function snapshot() { return { pages: pages.map(function (p) { return Object.assign({}, p); }), placed: JSON.parse(JSON.stringify(placed)) }; }
  function restore(s) { pages = s.pages; placed = s.placed; render(); }
  function rotate(list, d) { list.forEach(function (p) { p.rot = ((p.rot + d) % 360 + 360) % 360; }); renderGrid(); }
  $('rotL').onclick = function () { rotate(targets(), -90); };
  $('rotR').onclick = function () { rotate(targets(), 90); };
  $('dupBtn').onclick = function () {
    var sel = pages.filter(function (p) { return p.sel; }); if (!sel.length) { toast('Select the pages to duplicate first.'); return; }
    var last = pages.indexOf(sel[sel.length - 1]);
    var copies = sel.map(function (p) { var c = Object.assign({}, p, { uid: uid(), sel: false }); if (placed[p.uid]) placed[c.uid] = JSON.parse(JSON.stringify(placed[p.uid])); return c; });
    pages.splice.apply(pages, [last + 1, 0].concat(copies)); render();
  };
  $('blankBtn').onclick = function () {
    var sel = pages.filter(function (p) { return p.sel; }), at = sel.length ? pages.indexOf(sel[sel.length - 1]) + 1 : pages.length;
    var ref = pages[at - 1] || pages[0], w = ref ? ((ref.rot % 180) ? ref.h : ref.w) : A4[0], h = ref ? ((ref.rot % 180) ? ref.w : ref.h) : A4[1];
    if (ref && ref.kind === 'img') { w = A4[0]; h = A4[1]; }
    pages.splice(at, 0, { uid: uid(), src: null, idx: 0, rot: 0, kind: 'blank', w: w, h: h }); render();
  };
  function del(list) {
    if (!list.length) return;
    var snap = snapshot(), ids = new Set(list.map(function (p) { return p.uid; }));
    pages = pages.filter(function (p) { return !ids.has(p.uid); });
    ids.forEach(function (id) { delete placed[id]; });
    render();
    toast('Deleted ' + list.length + (list.length === 1 ? ' page' : ' pages'), function () { restore(snap); });
  }
  $('delBtn').onclick = function () { var sel = pages.filter(function (p) { return p.sel; }); if (!sel.length) { toast('Select the pages to delete first.'); return; } del(sel); };
  $('extractBtn').onclick = function () {
    var sel = pages.filter(function (p) { return p.sel; }); if (!sel.length) return;
    build(sel).then(function (bytes) { save(bytes, fileBase() + ' (pages ' + rangeText(sel) + ').pdf'); });
  };
  function rangeText(sel) {
    var idx = sel.map(function (p) { return pages.indexOf(p) + 1; }), out = [], a = idx[0], b = a;
    for (var i = 1; i <= idx.length; i++) { if (idx[i] === b + 1) b = idx[i]; else { out.push(a === b ? a : a + '-' + b); a = b = idx[i]; } }
    return out.join(',');
  }

  grid.addEventListener('click', function (e) {
    var card = e.target.closest('.pk-page'); if (!card || dragged) return;
    var i = +card.dataset.i, act = e.target.closest('[data-act]');
    if (act) { e.stopPropagation(); if (act.dataset.act === 'rot') rotate([pages[i]], 90); else del([pages[i]]); return; }
    select(i, e);
  });
  grid.addEventListener('dblclick', function (e) {
    var card = e.target.closest('.pk-page'); if (!card) return;
    openPlace(+card.dataset.i);
  });
  grid.addEventListener('keydown', function (e) {
    var card = e.target.closest('.pk-page'); if (!card) return;
    var i = +card.dataset.i, cols = Math.max(1, Math.round(grid.clientWidth / card.offsetWidth));
    var mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
    if (mv) {
      e.preventDefault(); var j = Math.max(0, Math.min(pages.length - 1, i + mv));
      if (e.altKey) { var x = pages.splice(i, 1)[0]; pages.splice(j, 0, x); renderGrid(); }
      focusCard(j); return;
    }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); select(i, e); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); var sel = pages.filter(function (p) { return p.sel; }); del(sel.length ? sel : [pages[i]]); focusCard(Math.min(i, pages.length - 1)); return; }
    if (e.key.toLowerCase() === 'r') { e.preventDefault(); var t = pages.filter(function (p) { return p.sel; }); rotate(t.length ? t : [pages[i]], e.shiftKey ? -90 : 90); focusCard(i); return; }
    if (e.key.toLowerCase() === 'a' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('selAll').click(); }
  });
  function focusCard(j) {
    grid.querySelectorAll('.pk-page').forEach(function (el, k) { el.tabIndex = k === j ? 0 : -1; if (k === j) el.focus(); });
  }

  // drag to reorder: mouse/pen at once, a finger after a short press (so the page still scrolls)
  var dragged = false;
  grid.addEventListener('pointerdown', function (e) {
    var card = e.target.closest('.pk-page'); if (!card || e.target.closest('[data-act]') || e.button > 0) return;
    var i = +card.dataset.i, x0 = e.clientX, y0 = e.clientY, started = false, timer = null, ghost, line, to = i;
    var group = pages[i].sel ? pages.filter(function (p) { return p.sel; }) : [pages[i]];
    var begin = function () {
      started = true; dragged = true;
      ghost = card.cloneNode(true); ghost.className = 'pk-page pk-ghost'; ghost.style.width = card.offsetWidth + 'px';
      if (group.length > 1) { var badge = document.createElement('span'); badge.className = 'pk-ghost-n'; badge.textContent = group.length; ghost.appendChild(badge); }
      document.body.appendChild(ghost);
      line = document.createElement('div'); line.className = 'pk-dropline'; grid.appendChild(line);
      grid.classList.add('dragging');
      group.forEach(function (p) { var el = grid.querySelector('.pk-page[data-i="' + pages.indexOf(p) + '"]'); if (el) el.classList.add('moving'); });
    };
    var place = function (cx, cy) {
      ghost.style.transform = 'translate(' + (cx - ghost.offsetWidth / 2) + 'px,' + (cy - 40) + 'px)';
      var cards = [].slice.call(grid.querySelectorAll('.pk-page')), best = 0, bd = Infinity, after = false;
      cards.forEach(function (c, k) { var r = c.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2, d = Math.hypot(cx - mx, (cy - my) * 1.5); if (d < bd) { bd = d; best = k; after = cx > mx; } });
      to = best + (after ? 1 : 0);
      var ref = cards[Math.min(best, cards.length - 1)].getBoundingClientRect(), g = grid.getBoundingClientRect();
      line.style.left = ((after ? ref.right + 4 : ref.left - 6) - g.left) + 'px'; line.style.top = (ref.top - g.top) + 'px'; line.style.height = ref.height + 'px';
      var edge = 60; if (cy < edge) scrollBy(0, -12); else if (cy > innerHeight - edge) scrollBy(0, 12);
    };
    var move = function (ev) {
      if (!started) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) { if (e.pointerType === 'touch') { clearTimeout(timer); cleanup(); return; } begin(); } else return;
      }
      ev.preventDefault(); place(ev.clientX, ev.clientY);
    };
    var cleanup = function () {
      clearTimeout(timer);
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    };
    var up = function () {
      cleanup();
      if (!started) return;
      ghost.remove(); line.remove(); grid.classList.remove('dragging');
      var ids = new Set(group.map(function (p) { return p.uid; }));
      var before = pages.slice(0, to).filter(function (p) { return !ids.has(p.uid); }).length;
      var rest = pages.filter(function (p) { return !ids.has(p.uid); });
      rest.splice.apply(rest, [before, 0].concat(group));
      pages = rest; renderGrid();
      setTimeout(function () { dragged = false; }, 0);
    };
    if (e.pointerType === 'touch') timer = setTimeout(function () { begin(); place(x0, y0); if (navigator.vibrate) navigator.vibrate(15); }, 380);
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  grid.addEventListener('contextmenu', function (e) { if (e.target.closest('.pk-page') && dragged) e.preventDefault(); });

  // ---------- options ----------
  function splitMode() { return (document.querySelector('input[name=split]:checked') || {}).value || 'one'; }
  function compMode() { return (document.querySelector('input[name=comp]:checked') || {}).value || 'none'; }
  document.querySelectorAll('input[name=split]').forEach(function (r) { r.onchange = function () { $('splitNRow').hidden = splitMode() !== 'n'; renderSel(); }; });
  document.querySelectorAll('input[name=comp]').forEach(function (r) {
    r.onchange = function () {
      $('compNote').textContent = { none: 'Pages are copied exactly; text stays selectable.', mid: 'Pages redrawn as pictures at 150 dpi — good for scans and photos; text becomes unselectable.', max: 'Pages redrawn at 100 dpi, stronger compression — smallest file, softer text.' }[compMode()];
    };
  });
  ['numOn', 'wmOn'].forEach(function (id) {
    var cb = $(id), det = cb.closest('details');
    cb.addEventListener('click', function (e) { e.stopPropagation(); });
    cb.addEventListener('change', function () { if (cb.checked) det.open = true; });
    det.querySelectorAll('input:not([type=checkbox]), select').forEach(function (x) { x.addEventListener('input', function () { cb.checked = true; }); });
  });
  function fileBase() { return ($('outName').value || 'document').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '').trim() || 'document'; }

  // ---------- build ----------
  var NUM_FMT = {
    n: function (i) { return String(i); }, page: function (i) { return 'Page ' + i; },
    of: function (i, n) { return 'Page ' + i + ' of ' + n; }, slash: function (i, n) { return i + ' / ' + n; }
  };
  function build(list, onProgress) {
    var comp = compMode(), dpi = comp === 'max' ? 100 : 150, q = comp === 'max' ? 0.55 : 0.72;
    return pdflib().then(function (L) {
      return L.PDFDocument.create().then(function (out) {
        var cache = {};
        var getLib = function (s) {
          if (!cache[s.id]) cache[s.id] = L.PDFDocument.load(s.bytes, { ignoreEncryption: true, updateMetadata: false });
          return cache[s.id];
        };
        var fit = $('imgFit').value;
        var step = function (k) {
          if (k >= list.length) return Promise.resolve();
          if (onProgress) onProgress(k, list.length);
          var p = list[k], s = srcOf(p.src);
          var job;
          if (ocrOn() && p.kind !== 'blank') {
            job = (p.kind === 'pdf' && !s.encrypted ? hasText(s, p.idx) : Promise.resolve(false)).then(function (has) {
              if (has) return normalPage();
              if (onProgress) onProgress(k, list.length, 'Reading page ' + (k + 1) + ' of ' + list.length + '…');
              return ocrWorker().then(function (w) { return ocrPage(L, out, p, s, comp === 'none' ? 200 : dpi, comp === 'none' ? 0.85 : q, fit, w); });
            });
          } else job = normalPage();
          function normalPage() {
          var job;
          if (p.kind === 'blank') {
            job = Promise.resolve(out.addPage([p.w, p.h]));
          } else if (comp !== 'none' || (s && s.encrypted)) {
            job = rasterPage(L, out, p, s, comp === 'none' ? 200 : dpi, comp === 'none' ? 0.9 : q, fit);
          } else if (p.kind === 'img') {
            job = imagePage(L, out, p, s, fit);
          } else {
            job = getLib(s).then(function (doc) {
              return out.copyPages(doc, [p.idx]).then(function (cp) {
                var pg = out.addPage(cp[0]);
                pg.setRotation(L.degrees(((pg.getRotation().angle + p.rot) % 360 + 360) % 360));
                return pg;
              });
            });
          }
          return job;
          }
          return job.then(function (pg) { pg.__uid = p.uid; return step(k + 1); });
        };
        return step(0).then(function () { return stamp(L, out, list); }).then(function () {
          if ($('stripMeta').checked) { out.setAuthor(''); out.setCreator(''); out.setProducer(''); out.setKeywords([]); out.setSubject(''); }
          else { out.setProducer('ranjithkb.com PDF toolkit (pdf-lib)'); }
          out.setTitle(fileBase());
          return out.save({ useObjectStreams: true });
        });
      });
    });
  }
  function pageBoxFor(fit, w, h) {
    if (fit === 'native') return [w * 0.75, h * 0.75]; // 96 px per inch → points
    var box = fit === 'letter' ? LETTER : A4;
    return w > h ? [box[1], box[0]] : box.slice();
  }
  function imagePage(L, out, p, s, fit) {
    var emb = s.img.type === 'png' ? out.embedPng(s.img.bytes) : out.embedJpg(s.img.bytes);
    return emb.then(function (img) {
      var box = pageBoxFor(fit, s.img.w, s.img.h), m = fit === 'native' ? 0 : 28;
      var sc = Math.min((box[0] - 2 * m) / s.img.w, (box[1] - 2 * m) / s.img.h), w = s.img.w * sc, h = s.img.h * sc;
      var pg = out.addPage(box);
      pg.drawImage(img, { x: (box[0] - w) / 2, y: (box[1] - h) / 2, width: w, height: h });
      if (p.rot) pg.setRotation(L.degrees(p.rot));
      return pg;
    });
  }
  // redraw a page as a JPEG (compression, or locked PDFs pdf-lib can't copy)
  function rasterPage(L, out, p, s, dpi, q, fit) {
    var wPt = p.w, hPt = p.h; // as seen, before our rotation
    if (p.kind === 'img') { var b = pageBoxFor(fit, s.img.w, s.img.h); wPt = b[0]; hPt = b[1]; }
    var px = Math.min(4000, wPt / 72 * dpi);
    var job = p.kind === 'img' ? imageOnCanvas(s, wPt, hPt, px, fit) : rasterize(s, p.idx, px);
    return job.then(function (c) {
      return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', q); }).then(function (bl) { return bl.arrayBuffer(); });
    }).then(function (ab) { return out.embedJpg(new Uint8Array(ab)); }).then(function (img) {
      var pg = out.addPage([wPt, hPt]);
      pg.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
      if (p.rot) pg.setRotation(L.degrees(p.rot));
      return pg;
    });
  }
  function imageOnCanvas(s, wPt, hPt, px, fit) {
    var c = document.createElement('canvas'), k = px / wPt; c.width = Math.round(wPt * k); c.height = Math.round(hPt * k);
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    var m = fit === 'native' ? 0 : 28 * k, sc = Math.min((c.width - 2 * m) / s.img.w, (c.height - 2 * m) / s.img.h);
    var w = s.img.w * sc, h = s.img.h * sc; x.drawImage(s.bmp, (c.width - w) / 2, (c.height - h) / 2, w, h);
    return Promise.resolve(c);
  }

  // page space helpers: a point given in the page "as seen" (origin bottom-left) → PDF user space
  function viewOf(pg) {
    var cb = pg.getCropBox(), r = ((pg.getRotation().angle % 360) + 360) % 360;
    return { x: cb.x, y: cb.y, w: cb.width, h: cb.height, r: r, W: r % 180 ? cb.height : cb.width, H: r % 180 ? cb.width : cb.height };
  }
  function toUser(v, vx, vy) {
    var x, y;
    if (v.r === 0) { x = vx; y = vy; }
    else if (v.r === 90) { x = v.w - vy; y = vx; }
    else if (v.r === 180) { x = v.w - vx; y = v.h - vy; }
    else { x = vy; y = v.h - vx; }
    return { x: x + v.x, y: y + v.y };
  }

  function stamp(L, out, list) {
    var pgs = out.getPages(), N = pgs.length;
    var wantNum = $('numOn').checked, wantWm = $('wmOn').checked && $('wmText').value.trim();
    var hasPlaced = list.some(function (p) { return (placed[p.uid] || []).length; });
    if (!wantNum && !wantWm && !hasPlaced) return Promise.resolve();
    return out.embedFont(L.StandardFonts.Helvetica).then(function (font) {
      return out.embedFont(L.StandardFonts.HelveticaBold).then(function (bold) {
        var imgCache = {};
        var embed = function (png) { if (!imgCache[png]) imgCache[png] = out.embedPng(png); return imgCache[png]; };
        var start = +$('numStart').value || 1, skip = $('numSkip').checked, size = Math.max(6, Math.min(36, +$('numSize').value || 10));
        var fmt = NUM_FMT[$('numFmt').value] || NUM_FMT.n, pos = $('numPos').value;
        var counted = N - (skip ? 1 : 0);
        var jobs = pgs.map(function (pg, i) {
          var v = viewOf(pg), deg = L.degrees(v.r);
          // watermark
          if (wantWm) {
            var txt = $('wmText').value.trim(), ang = +$('wmAng').value;
            var fs = Math.min(v.W, v.H) / Math.max(4, txt.length * 0.55) , tw = bold.widthOfTextAtSize(txt, fs);
            fs = Math.min(fs, (Math.hypot(v.W, v.H) * 0.7) / (tw / fs)); tw = bold.widthOfTextAtSize(txt, fs);
            var a = ang * Math.PI / 180, cx = v.W / 2, cy = v.H / 2;
            var sx = cx - Math.cos(a) * tw / 2 + Math.sin(a) * fs * 0.35, sy = cy - Math.sin(a) * tw / 2 - Math.cos(a) * fs * 0.35;
            var u = toUser(v, sx, sy), col = { grey: [0.45, 0.45, 0.45], red: [0.78, 0.16, 0.14], blue: [0.12, 0.25, 0.6] }[$('wmCol').value];
            pg.drawText(txt, { x: u.x, y: u.y, size: fs, font: bold, color: L.rgb(col[0], col[1], col[2]), opacity: (+$('wmOp').value) / 100, rotate: L.degrees(v.r + ang) });
          }
          // page numbers
          if (wantNum && !(skip && i === 0)) {
            var n = start + i - (skip ? 1 : 0), label = fmt(n, counted + start - 1);
            var w = font.widthOfTextAtSize(label, size), m = Math.max(18, Math.min(v.W, v.H) * 0.045);
            var vx = pos[1] === 'c' ? (v.W - w) / 2 : pos[1] === 'r' ? v.W - m - w : m;
            var vy = pos[0] === 'b' ? m * 0.9 : v.H - m * 0.9 - size * 0.7;
            var un = toUser(v, vx, vy);
            pg.drawText(label, { x: un.x, y: un.y, size: size, font: font, color: L.rgb(0.2, 0.2, 0.22), rotate: deg });
          }
          // placed items
          var items = placed[pg.__uid] || [];
          return items.reduce(function (pr, it) {
            return pr.then(function () {
              return embed(it.png).then(function (img) {
                var w2 = it.fw * v.W, h2 = it.fh * v.H, bx = it.fx * v.W, by = v.H - (it.fy * v.H) - h2;
                var ui = toUser(v, bx, by);
                pg.drawImage(img, { x: ui.x, y: ui.y, width: w2, height: h2, rotate: deg });
              });
            });
          }, Promise.resolve());
        });
        return Promise.all(jobs);
      });
    });
  }

  // ---------- text recognition (Tesseract.js, on the device) ----------
  var TESS = VENDOR + 'tesseract-5.1.1/';
  var ocr = { w: null, lang: '', ready: null };
  function ocrOn() { return $('ocrOn').checked; }
  function latinOnly() { return !/mal|hin/.test($('ocrLang').value); }
  function abs(u) { return new URL(u, location.href).href; }
  function ocrWorker() {
    var lang = $('ocrLang').value;
    if (ocr.w && ocr.lang === lang) return ocr.ready;
    var old = ocr.w; ocr.w = null; if (old) old.terminate();
    ocr.lang = lang;
    ocr.ready = load('tesseract-5.1.1/tesseract.min.js', function () { return window.Tesseract; }).then(function () {
      status('Loading the text reader (first time only)…');
      return window.Tesseract.createWorker(lang.split('+'), 1, {
        workerPath: abs(TESS + 'worker.min.js'), corePath: abs(TESS), langPath: abs(TESS + 'lang'), gzip: true,
        logger: function (m) { if (m.status === 'loading language traineddata' || m.status === 'loading tesseract core') status('Loading the text reader… ' + Math.round((m.progress || 0) * 100) + '%'); }
      });
    }).then(function (w) { ocr.w = w; status(''); return w; }, function (e) { ocr.w = null; ocr.lang = ''; status(''); throw new Error('the text reader could not start (' + (e.message || e) + ')'); });
    return ocr.ready;
  }
  function hasText(s, idx) {
    return s.pdfjs.getPage(idx + 1).then(function (pg) { return pg.getTextContent(); })
      .then(function (tc) { return tc.items.map(function (i) { return i.str; }).join('').replace(/\s+/g, '').length > 25; })
      .catch(function () { return false; });
  }
  function nativeText(s, idx) {
    return s.pdfjs.getPage(idx + 1).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
      return tc.items.map(function (i) { return i.str + (i.hasEOL ? '\n' : ' '); }).join('').replace(/[ \t]+\n/g, '\n').trim();
    });
  }
  // the page as seen — the user's rotation baked in, so the text reads upright for recognition
  function seenCanvas(p, s, dpi, fit) {
    var wPt = p.w, hPt = p.h;
    if (p.kind === 'img') { var b = pageBoxFor(fit, s.img.w, s.img.h); wPt = b[0]; hPt = b[1]; }
    var px = Math.min(3400, wPt / 72 * dpi);
    var job = p.kind === 'img' ? imageOnCanvas(s, wPt, hPt, px, fit) : rasterize(s, p.idx, px);
    return job.then(function (c) {
      var r = ((p.rot % 360) + 360) % 360; if (!r) return { c: c, w: wPt, h: hPt };
      var o = document.createElement('canvas'), side = r % 180;
      o.width = side ? c.height : c.width; o.height = side ? c.width : c.height;
      var x = o.getContext('2d'); x.translate(o.width / 2, o.height / 2); x.rotate(r * Math.PI / 180); x.drawImage(c, -c.width / 2, -c.height / 2);
      return { c: o, w: side ? hPt : wPt, h: side ? wPt : hPt };
    });
  }
  var WINANSI = /[^\x20-\x7E\xA0-\xFF–—‘’“”•€]/g;
  function ocrPage(L, out, p, s, dpi, q, fit, worker) {
    var seen;
    return seenCanvas(p, s, Math.max(dpi, 200), fit).then(function (v) {
      seen = v; return worker.recognize(v.c);
    }).then(function (res) {
      var data = res.data;
      return new Promise(function (ok) { seen.c.toBlob(ok, 'image/jpeg', q); }).then(function (bl) { return bl.arrayBuffer(); })
        .then(function (ab) { return out.embedJpg(new Uint8Array(ab)); })
        .then(function (img) {
          var pg = out.addPage([seen.w, seen.h]);
          pg.drawImage(img, { x: 0, y: 0, width: seen.w, height: seen.h });
          pg.__ocrText = data.text || '';
          if (!latinOnly() || !data.words || !data.words.length) return pg;
          return (out.__ocrFont || (out.__ocrFont = out.embedFont(L.StandardFonts.Helvetica))).then(function (font) {
            var cw = seen.c.width, ch = seen.c.height, kx = seen.w / cw, ky = seen.h / ch;
            pg.pushOperators(L.pushGraphicsState(), L.setTextRenderingMode(L.TextRenderingMode.Invisible));
            data.words.forEach(function (wd) {
              if (wd.confidence < 25) return;
              var t = String(wd.text || '').replace(WINANSI, '').trim(); if (!t) return;
              var b = wd.bbox, wPt = (b.x1 - b.x0) * kx, hPt = (b.y1 - b.y0) * ky, unit = font.widthOfTextAtSize(t, 1);
              if (!unit || wPt <= 0 || hPt <= 0) return;
              var size = Math.min(hPt * 1.25, wPt / unit); if (size < 2) return;
              try { pg.drawText(t + ' ', { x: b.x0 * kx, y: seen.h - b.y1 * ky + hPt * 0.18, size: size, font: font }); } catch (e) { /* a glyph Helvetica can't encode */ }
            });
            pg.pushOperators(L.popGraphicsState());
            return pg;
          });
        });
    });
  }
  $('ocrOn').addEventListener('change', function () { if (this.checked) ocrWorker().catch(function (e) { toast(e.message); }); });
  $('ocrLang').addEventListener('change', function () {
    $('ocrOn').checked = true;
    $('ocrNote').hidden = latinOnly();
  });
  $('ocrNote').hidden = true;
  $('ocrTxt').onclick = function () {
    if (!pages.length) { toast('Add a PDF or photo first.'); return; }
    var btn = this, label = btn.textContent, parts = [], fit = $('imgFit').value;
    btn.disabled = true;
    var step = function (k) {
      if (k >= pages.length) return Promise.resolve();
      var p = pages[k], s = srcOf(p.src); btn.textContent = 'Page ' + (k + 1) + ' of ' + pages.length + '…';
      if (p.kind === 'blank') { parts.push(''); return step(k + 1); }
      var job = (p.kind === 'pdf' && !s.encrypted ? hasText(s, p.idx) : Promise.resolve(false)).then(function (has) {
        if (has) return nativeText(s, p.idx);
        return ocrWorker().then(function (w) { return seenCanvas(p, s, 220, fit).then(function (v) { return w.recognize(v.c); }); }).then(function (r) { return (r.data.text || '').trim(); });
      });
      return job.then(function (t) { parts.push(t); return step(k + 1); });
    };
    step(0).then(function () {
      var txt = parts.map(function (t, i) { return '— Page ' + (i + 1) + ' —\n' + t; }).join('\n\n') + '\n';
      save(new Blob([txt], { type: 'text/plain;charset=utf-8' }), fileBase() + '.txt');
      $('result').innerHTML = 'Saved the text of <b>' + pages.length + ' page' + (pages.length > 1 ? 's' : '') + '</b> · ' + txt.replace(/\s+/g, ' ').split(' ').length + ' words';
    }).catch(function (e) { $('result').textContent = 'Couldn’t read the text: ' + (e.message || e); })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  };

  // ---------- download ----------
  function save(bytes, name) {
    var blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'application/pdf' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return blob.size;
  }
  var inSize = function () { return sources.reduce(function (t, s) { return t + s.bytes.length; }, 0); };
  function mb(n) { return n > 1e6 ? (n / 1048576).toFixed(n > 1e7 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  $('goBtn').onclick = function () {
    if (!pages.length) return;
    var btn = this, mode = splitMode(), groups = [];
    if (mode === 'one') groups = [{ name: fileBase() + '.pdf', pages: pages }];
    else if (mode === 'page') groups = pages.map(function (p, i) { return { name: fileBase() + ' - p' + pad(i + 1, pages.length) + '.pdf', pages: [p] }; });
    else if (mode === 'n') { var n = Math.max(1, +$('splitN').value || 1); for (var i = 0; i < pages.length; i += n) groups.push({ name: fileBase() + ' - part ' + (groups.length + 1) + '.pdf', pages: pages.slice(i, i + n) }); }
    else {
      var bySrc = {};
      pages.forEach(function (p) { var k = p.src || 'blank'; (bySrc[k] = bySrc[k] || []).push(p); });
      Object.keys(bySrc).forEach(function (k) { var s = srcOf(k); groups.push({ name: (s ? s.name.replace(/\.[^.]+$/, '') : 'blank pages') + '.pdf', pages: bySrc[k] }); });
    }
    btn.disabled = true; var label = btn.textContent;
    var t0 = Date.now(), total = pages.length, doneP = 0, files = [];
    var run = function (k) {
      if (k >= groups.length) return Promise.resolve();
      return build(groups[k].pages, function (j, n, msg) { btn.textContent = msg || ('Working… ' + Math.round((doneP + j) / total * 100) + '%'); }).then(function (bytes) {
        doneP += groups[k].pages.length; files.push({ name: groups[k].name, bytes: bytes }); return run(k + 1);
      });
    };
    run(0).then(function () {
      var size;
      if (files.length === 1) size = save(files[0].bytes, files[0].name);
      else size = save(zip(files), fileBase() + ' (' + files.length + ' files).zip');
      var was = inSize();
      $('result').innerHTML = (files.length === 1 ? 'Saved <b>' + esc(files[0].name) + '</b>' : 'Saved <b>' + files.length + ' PDFs</b> in a zip') +
        ' · ' + mb(size) + (was && compMode() !== 'none' ? ' (from ' + mb(was) + ', ' + Math.round((1 - size / was) * 100) + '% smaller)' : '') +
        ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s';
    }).catch(function (e) {
      console.error(e);
      $('result').textContent = 'That didn’t work: ' + (e.message || e) + '. Try “Smaller” under Size, which redraws pages and gets round most damaged files.';
    }).then(function () { btn.disabled = false; btn.textContent = label; });
  };
  function pad(i, n) { var w = String(n).length; return (Array(w).join('0') + i).slice(-w); }

  // a minimal ZIP writer (stored, no compression — PDFs are compressed already)
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0, d = new Date();
    var dosT = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosD = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var used = {};
    files.forEach(function (f) {
      var nm = f.name; while (used[nm]) nm = nm.replace(/(\.pdf)$/i, ' (2)$1'); used[nm] = 1;
      var name = enc.encode(nm), data = f.bytes, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosT, true); h.setUint16(12, dosD, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosT, true); c.setUint16(14, dosD, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (t, x) { return t + x.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
  }

  // ---------- signature maker ----------
  var pad2 = $('pad'), pctx = pad2.getContext('2d'), ink = '#111111', strokes = [], curStroke = null, stab = 'draw', uploaded = null;
  var FONTS = [{ f: "'Caveat', cursive", n: 'Caveat' }, { f: "'Dancing Script', cursive", n: 'Dancing Script' }, { f: "'Homemade Apple', cursive", n: 'Homemade Apple' }, { f: "'Source Serif 4', serif", i: true, n: 'Serif italic' }];
  var font = 0;
  $('signBtn').onclick = function () { strokes = []; redrawPad(); $('signDlg').showModal(); };
  $('signCancel').onclick = function () { $('signDlg').close(); };
  document.querySelectorAll('[data-stab]').forEach(function (b) {
    b.onclick = function () {
      stab = b.dataset.stab;
      document.querySelectorAll('[data-stab]').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      document.querySelectorAll('.pk-stab').forEach(function (p) { p.hidden = p.dataset.pane !== stab; });
      if (stab === 'type') { renderFonts(); $('sigType').focus(); }
    };
  });
  document.querySelectorAll('.pk-ink').forEach(function (b) {
    b.style.background = b.dataset.ink;
    b.onclick = function () { ink = b.dataset.ink; document.querySelectorAll('.pk-ink').forEach(function (x) { x.classList.toggle('on', x === b); }); strokes.forEach(function (s) { s.c = ink; }); redrawPad(); renderFonts(); };
  });
  $('padClear').onclick = function () { strokes = []; redrawPad(); };
  function padPt(e) { var r = pad2.getBoundingClientRect(); return { x: (e.clientX - r.left) * pad2.width / r.width, y: (e.clientY - r.top) * pad2.height / r.height, p: e.pressure || 0.5 }; }
  pad2.addEventListener('pointerdown', function (e) { e.preventDefault(); pad2.setPointerCapture(e.pointerId); curStroke = { c: ink, pts: [padPt(e)] }; strokes.push(curStroke); });
  pad2.addEventListener('pointermove', function (e) { if (!curStroke) return; var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; evs.forEach(function (x) { curStroke.pts.push(padPt(x)); }); redrawPad(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { pad2.addEventListener(t, function () { curStroke = null; }); });
  function redrawPad() {
    pctx.clearRect(0, 0, pad2.width, pad2.height);
    pctx.strokeStyle = '#C9C2B4'; pctx.lineWidth = 2; pctx.setLineDash([8, 8]);
    pctx.beginPath(); pctx.moveTo(60, pad2.height * 0.72); pctx.lineTo(pad2.width - 60, pad2.height * 0.72); pctx.stroke(); pctx.setLineDash([]);
    strokes.forEach(function (s) { drawStroke(pctx, s, 1); });
  }
  function drawStroke(x, s, k) {
    x.strokeStyle = s.c; x.lineCap = 'round'; x.lineJoin = 'round';
    var p = s.pts; if (p.length === 1) { x.fillStyle = s.c; x.beginPath(); x.arc(p[0].x * k, p[0].y * k, 3.5 * k, 0, 7); x.fill(); return; }
    for (var i = 1; i < p.length; i++) {
      var a = p[i - 1], b = p[i], v = Math.hypot(b.x - a.x, b.y - a.y);
      x.lineWidth = Math.max(2.2, Math.min(7, 7 - v * 0.12)) * k;
      x.beginPath(); x.moveTo(a.x * k, a.y * k);
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; x.quadraticCurveTo(a.x * k, a.y * k, mx * k, my * k); x.lineTo(b.x * k, b.y * k); x.stroke();
    }
  }
  redrawPad();
  function renderFonts() {
    var t = $('sigType').value || 'Your name';
    $('sigFonts').innerHTML = FONTS.map(function (f, i) {
      return '<button type="button" class="pk-font' + (i === font ? ' on' : '') + '" data-font="' + i + '" style="font-family:' + f.f + ';' + (f.i ? 'font-style:italic;' : '') + 'color:' + ink + '">' + esc(t) + '</button>';
    }).join('');
  }
  $('sigType').addEventListener('input', renderFonts);
  $('sigFonts').addEventListener('click', function (e) { var b = e.target.closest('[data-font]'); if (!b) return; font = +b.dataset.font; renderFonts(); });
  $('sigFile').onchange = function () {
    var f = this.files[0]; if (!f) return;
    decodeImage(f).then(function (bmp) {
      var c = $('sigPrev'), sc = Math.min(1, 1600 / bmp.width); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      var x = c.getContext('2d'); x.drawImage(bmp, 0, 0, c.width, c.height);
      var d = x.getImageData(0, 0, c.width, c.height), a = d.data;
      // white paper → transparent; ink keeps its colour, a little darker
      for (var i = 0; i < a.length; i += 4) {
        var l = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        var alpha = l > 200 ? 0 : l < 120 ? 255 : Math.round((200 - l) / 80 * 255);
        a[i + 3] = alpha; a[i] *= 0.7; a[i + 1] *= 0.7; a[i + 2] *= 0.7;
      }
      x.putImageData(d, 0, 0); c.hidden = false; uploaded = c;
    }).catch(function () { toast('Couldn’t read that image.'); });
  };
  $('signSave').onclick = function () {
    // a typed signature needs its handwriting font loaded before it is drawn
    if (stab === 'type' && document.fonts && document.fonts.load && !this._fontReady) {
      var btn = this, fam = FONTS[font].f.split(',')[0];
      document.fonts.load('140px ' + fam, $('sigType').value || 'a').catch(function () {}).then(function () { btn._fontReady = true; btn.click(); btn._fontReady = false; });
      return;
    }
    var c;
    if (stab === 'draw') { if (!strokes.length) { toast('Sign in the box first.'); return; } c = document.createElement('canvas'); c.width = pad2.width; c.height = pad2.height; strokes.forEach(function (s) { drawStroke(c.getContext('2d'), s, 1); }); }
    else if (stab === 'type') { var t = $('sigType').value.trim(); if (!t) { toast('Type your name first.'); return; } c = textCanvas(t, FONTS[font].f, FONTS[font].i, ink, 140); }
    else { if (!uploaded) { toast('Choose a photo of your signature.'); return; } c = uploaded; }
    var tc = trim(c); if (!tc) { toast('Nothing to use.'); return; }
    signature = { png: tc.toDataURL('image/png'), ar: tc.width / tc.height };
    $('signDlg').close();
    $('signBtn').textContent = 'New signature';
    toast('Signature ready — now place it on a page.');
    if (pages.length) openPlace(firstSel());
  };
  function textCanvas(t, fam, ital, color, px) {
    var c = document.createElement('canvas'), x = c.getContext('2d'), f = (ital ? 'italic ' : '') + px + 'px ' + fam;
    x.font = f; var w = Math.ceil(x.measureText(t).width) + px; c.width = w; c.height = Math.ceil(px * 1.6);
    x = c.getContext('2d'); x.font = f; x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(t, px / 2, c.height / 2);
    return c;
  }
  function trim(c) {
    var x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data, x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (var y = 0; y < c.height; y++) for (var xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    var m = 6, o = document.createElement('canvas'); o.width = x1 - x0 + 1 + 2 * m; o.height = y1 - y0 + 1 + 2 * m;
    o.getContext('2d').drawImage(c, x0 - m, y0 - m, o.width, o.height, 0, 0, o.width, o.height);
    return o;
  }

  // ---------- placing items on a page ----------
  var placeAt = 0, stageW = 0, stageH = 0;
  function firstSel() { for (var i = 0; i < pages.length; i++) if (pages[i].sel) return i; return 0; }
  $('placeBtn').onclick = function () { if (!pages.length) { toast('Add a PDF first.'); return; } openPlace(firstSel()); };
  $('placePrev').onclick = function () { if (placeAt > 0) openPlace(placeAt - 1); };
  $('placeNext').onclick = function () { if (placeAt < pages.length - 1) openPlace(placeAt + 1); };
  $('placeDone').onclick = function () { $('placeDlg').close(); };
  $('placeDlg').addEventListener('close', function () { renderGrid(); renderPlaced(); });
  function openPlace(i) {
    placeAt = i; var p = pages[i]; if (!p) return;
    var dlg = $('placeDlg'); if (!dlg.open) dlg.showModal();
    $('placeNo').textContent = (i + 1) + ' of ' + pages.length;
    $('placePrev').disabled = i === 0; $('placeNext').disabled = i === pages.length - 1;
    var seenW = (p.rot % 180) ? p.h : p.w, seenH = (p.rot % 180) ? p.w : p.h;
    var maxW = Math.min(760, innerWidth - 64), maxH = innerHeight - 260;
    var k = Math.min(maxW / seenW, maxH / seenH); stageW = Math.round(seenW * k); stageH = Math.round(seenH * k);
    var stage = $('stage'), cv = $('stageCv');
    stage.style.width = stageW + 'px'; stage.style.height = stageH + 'px';
    cv.width = stageW * 2; cv.height = stageH * 2; cv.style.width = stageW + 'px'; cv.style.height = stageH + 'px';
    var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
    if (p.kind !== 'blank') {
      var s = srcOf(p.src);
      var job = p.kind === 'img' ? imageOnCanvas(s, pageBoxFor($('imgFit').value, s.img.w, s.img.h)[0], pageBoxFor($('imgFit').value, s.img.w, s.img.h)[1], ((p.rot % 180) ? stageH : stageW) * 2, $('imgFit').value) : rasterize(s, p.idx, ((p.rot % 180) ? stageH : stageW) * 2);
      job.then(function (c) {
        if (placeAt !== i) return;
        x.save(); x.translate(cv.width / 2, cv.height / 2); x.rotate(p.rot * Math.PI / 180);
        var dw = (p.rot % 180) ? cv.height : cv.width, dh = (p.rot % 180) ? cv.width : cv.height;
        x.drawImage(c, -dw / 2, -dh / 2, dw, dh); x.restore();
      });
    }
    drawItems();
  }
  function itemsHere() { var u = pages[placeAt].uid; return (placed[u] = placed[u] || []); }
  function drawItems() {
    var list = itemsHere();
    $('items').innerHTML = list.map(function (it) {
      return '<div class="pk-item" data-it="' + it.id + '" style="left:' + it.fx * 100 + '%;top:' + it.fy * 100 + '%;width:' + it.fw * 100 + '%;height:' + it.fh * 100 + '%" tabindex="0" aria-label="' + (it.kind === 'sig' ? 'Signature' : 'Text: ' + esc(it.text || '')) + '">' +
        '<img src="' + it.png + '" alt="" draggable="false"><button type="button" class="pk-item-x" data-x="' + it.id + '" aria-label="Remove">✕</button><span class="pk-item-h" data-h></span></div>';
    }).join('');
  }
  function addItem(png, ar, kind, text, wFrac) {
    var p = pages[placeAt], seenW = (p.rot % 180) ? p.h : p.w, seenH = (p.rot % 180) ? p.w : p.h;
    var fw = wFrac, fh = fw * seenW / ar / seenH;
    itemsHere().push({ id: uid(), fx: 0.5 - fw / 2, fy: 0.62, fw: fw, fh: fh, png: png, ar: ar, kind: kind, text: text });
    drawItems();
  }
  $('addSig').onclick = function () {
    if (!signature) { $('placeDlg').close(); $('signBtn').click(); return; }
    addItem(signature.png, signature.ar, 'sig', '', 0.28);
  };
  function textItem(t) { var c = trim(textCanvas(t, 'Helvetica, Arial, sans-serif', false, '#111111', 64)); return { png: c.toDataURL('image/png'), ar: c.width / c.height }; }
  $('addText').onclick = function () { var t = prompt('Text to place (a name, a reference, initials):', ''); if (!t) return; var ti = textItem(t); addItem(ti.png, ti.ar, 'text', t, Math.min(0.5, 0.018 * t.length + 0.04)); };
  $('addDate').onclick = function () { var t = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); var ti = textItem(t); addItem(ti.png, ti.ar, 'text', t, 0.2); };
  $('addTick').onclick = function () { var ti = textItem('✓'); addItem(ti.png, ti.ar, 'text', '✓', 0.035); };
  $('items').addEventListener('click', function (e) {
    var x = e.target.closest('[data-x]'); if (!x) return;
    var u = pages[placeAt].uid; placed[u] = itemsHere().filter(function (it) { return it.id !== x.dataset.x; }); drawItems();
  });
  $('items').addEventListener('dblclick', function (e) {
    var el = e.target.closest('[data-it]'); if (!el) return;
    var it = itemsHere().filter(function (i) { return i.id === el.dataset.it; })[0]; if (!it || it.kind !== 'text' || it.text === '✓') return;
    var t = prompt('Change the text:', it.text); if (!t) return;
    var ti = textItem(t), h = it.fh; it.text = t; it.png = ti.png; it.ar = ti.ar;
    var p = pages[placeAt], seenW = (p.rot % 180) ? p.h : p.w, seenH = (p.rot % 180) ? p.w : p.h;
    it.fw = h * seenH * ti.ar / seenW; drawItems();
  });
  $('items').addEventListener('pointerdown', function (e) {
    var el = e.target.closest('[data-it]'); if (!el || e.target.closest('[data-x]')) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    var it = itemsHere().filter(function (i) { return i.id === el.dataset.it; })[0], resize = !!e.target.closest('[data-h]');
    var x0 = e.clientX, y0 = e.clientY, o = { fx: it.fx, fy: it.fy, fw: it.fw, fh: it.fh };
    var move = function (ev) {
      var dx = (ev.clientX - x0) / stageW, dy = (ev.clientY - y0) / stageH;
      if (resize) {
        var nw = Math.max(0.02, Math.min(1 - o.fx, o.fw + dx)), k = nw / o.fw;
        if (o.fy + o.fh * k > 1) { k = (1 - o.fy) / o.fh; nw = o.fw * k; }
        it.fw = nw; it.fh = o.fh * k;
      } else { it.fx = Math.max(0, Math.min(1 - it.fw, o.fx + dx)); it.fy = Math.max(0, Math.min(1 - it.fh, o.fy + dy)); }
      el.style.left = it.fx * 100 + '%'; el.style.top = it.fy * 100 + '%'; el.style.width = it.fw * 100 + '%'; el.style.height = it.fh * 100 + '%';
    };
    var up = function () { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
  $('items').addEventListener('keydown', function (e) {
    var el = e.target.closest('[data-it]'); if (!el) return;
    var it = itemsHere().filter(function (i) { return i.id === el.dataset.it; })[0], st = e.shiftKey ? 0.02 : 0.004;
    var mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
    if (mv) { e.preventDefault(); it.fx = Math.max(0, Math.min(1 - it.fw, it.fx + mv[0])); it.fy = Math.max(0, Math.min(1 - it.fh, it.fy + mv[1])); el.style.left = it.fx * 100 + '%'; el.style.top = it.fy * 100 + '%'; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); var u = pages[placeAt].uid; placed[u] = itemsHere().filter(function (i) { return i !== it; }); drawItems(); }
  });
  function renderPlaced() {
    var rows = [];
    pages.forEach(function (p, i) { var n = (placed[p.uid] || []).length; if (n) rows.push('<li><button type="button" data-goto="' + i + '">Page ' + (i + 1) + '</button> · ' + n + ' item' + (n > 1 ? 's' : '') + '</li>'); });
    $('placedList').innerHTML = rows.join('');
  }
  $('placedList').addEventListener('click', function (e) { var b = e.target.closest('[data-goto]'); if (b) openPlace(+b.dataset.goto); });

  // ---------- bits ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function status(t) { $('result').textContent = t; }
  var toastEl;
  function toast(msg, undo) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'tl-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = '<span></span>' + (undo ? '<button type="button">Undo</button>' : '');
    toastEl.firstChild.textContent = msg; toastEl.hidden = false;
    if (undo) toastEl.querySelector('button').onclick = function () { toastEl.hidden = true; undo(); };
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.hidden = true; }, undo ? 6000 : 3500);
  }
  // warm the libraries once the page is idle, so the first file opens quickly
  (window.requestIdleCallback || setTimeout)(function () { pdfjs().catch(function () {}); });
  render();
  // test hook for the site's own checks
  window.__pk = { addFiles: addFiles, pages: function () { return pages; }, build: build };
})();
