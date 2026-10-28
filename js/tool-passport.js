/* ============================================================
   TOOL — Passport photo maker  (productivity/passport.html)
   Work in millimetres of the finished photo. The source image is
   placed by (cx, cy) = where its centre lands in the frame (mm),
   s = mm per source pixel and a small tilt. Every output — the
   stage, the single photo, the print sheet — is drawn from that.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var IN = 25.4;
  var store = {
    get: function (k) { try { return localStorage.getItem('pp:' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('pp:' + k, v); } catch (e) { /* private mode */ } }
  };

  // ---------- documents (head = chin to top of head, mm) ----------
  var PRESETS = [
    { id: 'uk', name: 'UK passport', w: 35, h: 45, head: [29, 34], px: [600, 750], note: 'Online applications want at least 600 × 750 pixels.' },
    { id: 'schengen', name: 'Schengen visa / EU passport (Italy, Germany, France…)', w: 35, h: 45, head: [32, 36], px: [827, 1063] },
    { id: 'in-pp', name: 'India passport', w: 35, h: 45, head: [32, 36], px: [413, 531], note: 'Passport Seva: 4.5 × 3.5 cm, white background, face filling most of the frame.' },
    { id: 'in-visa', name: 'India visa / OCI (2 × 2 in)', w: 51, h: 51, head: [25, 35], px: [600, 600], note: 'Online OCI and e-visa uploads are square, between 200 and 1500 pixels.' },
    { id: 'us', name: 'US passport / visa (2 × 2 in)', w: 51, h: 51, head: [25, 35], px: [600, 600], note: 'Head 1 to 1⅜ in. Digital: 600 to 1200 pixels square.' },
    { id: 'ca', name: 'Canada passport', w: 50, h: 70, head: [31, 36], px: [591, 827] },
    { id: 'cn', name: 'China visa', w: 33, h: 48, head: [28, 33], px: [354, 472], note: 'Online visa form wants 354 × 472 pixels, under 120 KB.' },
    { id: 'au', name: 'Australia passport', w: 35, h: 45, head: [32, 36], px: [827, 1063] },
    { id: 'jp', name: 'Japan passport', w: 35, h: 45, head: [32, 36], px: [827, 1063] },
    { id: 'kr', name: 'South Korea passport / visa', w: 35, h: 45, head: [32, 36], px: [827, 1063] },
    { id: 'custom', name: 'Custom size…', w: 35, h: 45, head: [32, 36], px: [827, 1063] }
  ];
  var PAPERS = [
    { id: 'kodak', name: 'Kodak Mini 2 Retro (P210R) — 2.1 × 3.4 in', w: 2.1 * IN, h: 3.4 * IN, m: 0, g: 1 },
    { id: '4x6', name: '4 × 6 in photo (10 × 15 cm)', w: 4 * IN, h: 6 * IN, m: 2, g: 2 },
    { id: '35x5', name: '3.5 × 5 in photo (9 × 13 cm)', w: 3.5 * IN, h: 5 * IN, m: 2, g: 2 },
    { id: '5x7', name: '5 × 7 in photo (13 × 18 cm)', w: 5 * IN, h: 7 * IN, m: 3, g: 2 },
    { id: 'a6', name: 'A6 (105 × 148 mm)', w: 105, h: 148, m: 4, g: 2 },
    { id: 'a5', name: 'A5 (148 × 210 mm)', w: 148, h: 210, m: 5, g: 2 },
    { id: 'a4', name: 'A4 (210 × 297 mm)', w: 210, h: 297, m: 6, g: 3 },
    { id: 'letter', name: 'US Letter (8.5 × 11 in)', w: 8.5 * IN, h: 11 * IN, m: 6, g: 3 },
    { id: 'cmm', name: 'Custom size in mm…', w: 100, h: 150, m: 2, g: 2 },
    { id: 'cpx', name: 'Custom size in pixels…', w: 1200, h: 1800, m: 0, g: 1, px: true }
  ];

  // ---------- state ----------
  var img = null, iw = 0, ih = 0;
  var T = { cx: 0, cy: 0, s: 1, a: 0 };
  var P = PRESETS[0];
  var marking = 0, marks = [];

  function frame() {
    if (P.id !== 'custom') return { w: P.w, h: P.h, head: P.head };
    var w = +$('cW').value || 35, h = +$('cH').value || 45, hd = +$('cHead').value || h * 0.75;
    return { w: w, h: h, head: [hd - 1.5, hd + 1.5] };
  }
  function chinY(f) { var mid = (f.head[0] + f.head[1]) / 2; return (f.h - mid) * 0.4 + mid; }

  // ---------- presets + papers ----------
  $('preset').innerHTML = PRESETS.map(function (p) { return '<option value="' + p.id + '">' + p.name + (p.id === 'custom' ? '' : ' — ' + p.w + ' × ' + p.h + ' mm') + '</option>'; }).join('');
  $('paper').innerHTML = PAPERS.map(function (p) { return '<option value="' + p.id + '">' + p.name + '</option>'; }).join('');
  function setPreset(id, keepPx) {
    P = PRESETS.filter(function (p) { return p.id === id; })[0] || PRESETS[0];
    $('preset').value = P.id; $('customBox').hidden = P.id !== 'custom';
    var f = frame();
    $('spec').innerHTML = '<b>' + f.w + ' × ' + f.h + ' mm</b> · head ' + f.head[0] + '–' + f.head[1] + ' mm, chin to crown' + (P.note ? ' · ' + P.note : '');
    if (!keepPx) { $('pxW').value = P.px[0]; $('pxH').value = P.px[1]; }
    store.set('preset', P.id);
    if (img) fitDefault(); else layoutStage();
    update();
  }
  $('preset').onchange = function () { setPreset(this.value); };
  ['cW', 'cH', 'cHead'].forEach(function (id) { $(id).addEventListener('input', function () { setPreset('custom', true); }); });
  function setPaper(id, keepVals) {
    var p = PAPERS.filter(function (x) { return x.id === id; })[0] || PAPERS[0];
    $('paper').value = p.id;
    $('paperCustom').hidden = !(p.id === 'cmm' || p.id === 'cpx');
    $('pUnit').textContent = $('pUnit2').textContent = p.px ? 'px' : 'mm';
    if (!keepVals) {
      $('margin').value = p.m; $('gap').value = p.g;
      if (p.id === 'cmm' || p.id === 'cpx') { $('pW').value = +(store.get('p' + p.id + 'w')) || p.w; $('pH').value = +(store.get('p' + p.id + 'h')) || p.h; }
    }
    store.set('paper', p.id);
    updateSheet();
  }
  $('paper').onchange = function () { setPaper(this.value); };
  ['pW', 'pH'].forEach(function (id) { $(id).addEventListener('input', function () { store.set('p' + $('paper').value + id.slice(1).toLowerCase(), this.value); updateSheet(); }); });
  ['margin', 'gap', 'copies', 'sheetDpi', 'cutLines', 'allowRot'].forEach(function (id) { $(id).addEventListener('input', function () { if (id === 'sheetDpi') store.set(id, this.value); updateSheet(); }); });
  document.querySelectorAll('input[name=single]').forEach(function (r) { r.onchange = function () { $('pxBox').hidden = single() !== 'px'; store.set('single', single()); updateSingle(); }; });
  ['pxW', 'pxH', 'maxKB'].forEach(function (id) { $(id).addEventListener('input', function () { if (id === 'maxKB') store.set('maxKB', this.value); updateSingle(); }); });
  function single() { return (document.querySelector('input[name=single]:checked') || {}).value || '300'; }

  // ---------- loading a photo ----------
  var stage = $('stage'), cv = $('photoCv'), svg = $('guides');
  stage.addEventListener('click', function (e) { if (!img && e.target.id !== 'fileIn') $('fileIn').click(); });
  $('fileIn').onchange = function () { if (this.files[0]) openFile(this.files[0]); this.value = ''; };
  $('newPhoto').onclick = function () { $('fileIn').click(); };
  ['dragenter', 'dragover'].forEach(function (t) { stage.addEventListener(t, function (e) { e.preventDefault(); stage.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { stage.addEventListener(t, function () { stage.classList.remove('over'); }); });
  stage.addEventListener('drop', function (e) { e.preventDefault(); var f = e.dataTransfer.files[0]; if (f) openFile(f); });
  document.addEventListener('paste', function (e) { var f = [].slice.call((e.clipboardData && e.clipboardData.files) || []).filter(function (x) { return /^image\//.test(x.type); })[0]; if (f) { e.preventDefault(); openFile(f); } });
  function openFile(f) {
    var p = window.createImageBitmap ? createImageBitmap(f, { imageOrientation: 'from-image' }).catch(function () { return viaImg(f); }) : viaImg(f);
    p.then(function (b) {
      img = b; iw = b.width; ih = b.height;
      $('empty').hidden = true; $('ctl').hidden = false; stage.classList.add('has');
      ['dlSingle', 'dlSheet', 'dlPdf'].forEach(function (id) { $(id).disabled = false; });
      fitDefault();
    }).catch(function () { alert('This browser can’t open that image. Try a JPG or PNG.'); });
  }
  function viaImg(f) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = URL.createObjectURL(f); }); }

  function coverScale() { var f = frame(); return Math.max(f.w / iw, f.h / ih); }
  function fitDefault() {
    var f = frame();
    // a typical selfie: face about a third of the picture's height, a little above centre
    T.a = 0; T.s = coverScale() * 1.6; T.cx = f.w / 2; T.cy = f.h * 0.62;
    $('tilt').value = 0; marks = []; marking = 0;
    layoutStage(); syncZoom(); update();
  }
  $('resetBtn').onclick = function () { $('bri').value = $('con').value = $('sat').value = 100; fitDefault(); };

  // ---------- stage geometry ----------
  var view = { k: 1, ox: 0, oy: 0, W: 0, H: 0 }; // css px per mm, frame offset
  function layoutStage() {
    var f = frame(), W = Math.min(stage.parentNode.clientWidth || 420, 460), pad = 0.22;
    var k = W / (f.w * (1 + 2 * pad)), H = Math.min(W * 1.35, f.h * k * (1 + 2 * pad));
    k = Math.min(k, H / (f.h * (1 + 2 * pad)));
    view = { k: k, W: W, H: Math.round(f.h * k * (1 + 2 * pad)), ox: (W - f.w * k) / 2, oy: f.h * k * pad };
    stage.style.width = W + 'px'; stage.style.height = view.H + 'px';
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(view.H * dpr); cv.style.width = W + 'px'; cv.style.height = view.H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + view.H); svg.style.width = W + 'px'; svg.style.height = view.H + 'px';
    drawStage();
  }
  addEventListener('resize', function () { clearTimeout(layoutStage.t); layoutStage.t = setTimeout(layoutStage, 120); });

  function filterStr() { return 'brightness(' + $('bri').value + '%) contrast(' + $('con').value + '%) saturate(' + $('sat').value + '%)'; }
  function placeImage(ctx, k, ox, oy) {
    ctx.save(); ctx.translate(ox + T.cx * k, oy + T.cy * k); ctx.rotate(T.a); ctx.scale(T.s * k, T.s * k);
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih); ctx.restore();
  }
  function drawStage() {
    var dpr = cv.width / view.W, x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
    cv.style.filter = filterStr();
    if (img) { x.scale(dpr, dpr); placeImage(x, view.k, view.ox, view.oy); }
    drawGuides();
  }
  function drawGuides() {
    var f = frame(), k = view.k, ox = view.ox, oy = view.oy, W = view.W, H = view.H, fw = f.w * k, fh = f.h * k;
    var cy = oy + chinY(f) * k, top1 = cy - f.head[1] * k, top0 = cy - f.head[0] * k, mid = (f.head[0] + f.head[1]) / 2 * k;
    var on = $('showGuides').checked && img;
    var s = '<defs><mask id="ppHole"><rect width="' + W + '" height="' + H + '" fill="#fff"/><rect x="' + ox + '" y="' + oy + '" width="' + fw + '" height="' + fh + '" fill="#000"/></mask></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="rgba(20,20,24,' + (img ? .55 : 0) + ')" mask="url(#ppHole)"/>' +
      '<rect x="' + ox + '" y="' + oy + '" width="' + fw + '" height="' + fh + '" fill="none" stroke="#fff" stroke-width="1.5"/>';
    if (on) {
      s += '<rect x="' + ox + '" y="' + top1 + '" width="' + fw + '" height="' + (top0 - top1) + '" fill="rgba(92,77,125,.22)"/>' +
        '<line x1="' + ox + '" x2="' + (ox + fw) + '" y1="' + top1 + '" y2="' + top1 + '" class="g"/><line x1="' + ox + '" x2="' + (ox + fw) + '" y1="' + top0 + '" y2="' + top0 + '" class="g"/>' +
        '<line x1="' + ox + '" x2="' + (ox + fw) + '" y1="' + cy + '" y2="' + cy + '" class="g chin"/>' +
        '<line x1="' + (ox + fw / 2) + '" x2="' + (ox + fw / 2) + '" y1="' + oy + '" y2="' + (oy + fh) + '" class="g c"/>' +
        '<ellipse cx="' + (ox + fw / 2) + '" cy="' + (cy - mid / 2) + '" rx="' + (mid * 0.36) + '" ry="' + (mid / 2) + '" class="g o"/>' +
        '<text x="' + (ox + fw - 5) + '" y="' + (top1 + (top0 - top1) / 2 + 4) + '" text-anchor="end" class="gt">top of head</text>' +
        '<text x="' + (ox + fw - 5) + '" y="' + (cy - 5) + '" text-anchor="end" class="gt">chin</text>';
    }
    marks.forEach(function (m, i) { var p = imgToStage(m); s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="6" class="mk"/><text x="' + (p.x + 10) + '" y="' + (p.y + 4) + '" class="gt mk-t">' + (i ? 'top' : 'chin') + '</text>'; });
    svg.innerHTML = s;
  }
  $('showGuides').onchange = drawGuides;

  // stage px ↔ image px
  function stageToImg(px, py) {
    var mx = (px - view.ox) / view.k - T.cx, my = (py - view.oy) / view.k - T.cy, c = Math.cos(-T.a), s = Math.sin(-T.a);
    return { x: (c * mx - s * my) / T.s + iw / 2, y: (s * mx + c * my) / T.s + ih / 2 };
  }
  function imgToStage(p) {
    var ux = (p.x - iw / 2) * T.s, uy = (p.y - ih / 2) * T.s, c = Math.cos(T.a), s = Math.sin(T.a);
    return { x: view.ox + (T.cx + c * ux - s * uy) * view.k, y: view.oy + (T.cy + s * ux + c * uy) * view.k };
  }

  // ---------- moving, zooming, tilting ----------
  var ptrs = {}, pinch = null;
  stage.addEventListener('pointerdown', function (e) {
    if (!img) return;
    var r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (marking) { marks.push(stageToImg(px, py)); marking++; if (marking > 2) finishMarks(); else showTip('Now tap the top of your head — include the hair.'); drawGuides(); return; }
    stage.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: px, y: py };
    var ids = Object.keys(ptrs);
    if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: T.s }; }
  });
  stage.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    var r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, last = ptrs[e.pointerId];
    var ids = Object.keys(ptrs);
    if (ids.length === 2 && pinch) {
      ptrs[e.pointerId] = { x: px, y: py };
      var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo(pinch.s * d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    T.cx += (px - last.x) / view.k; T.cy += (py - last.y) / view.k;
    ptrs[e.pointerId] = { x: px, y: py }; drawStage(); queueOut();
  });
  ['pointerup', 'pointercancel'].forEach(function (t) { stage.addEventListener(t, function (e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch = null; }); });
  stage.addEventListener('wheel', function (e) {
    if (!img) return; e.preventDefault();
    var r = stage.getBoundingClientRect();
    zoomTo(T.s * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  stage.addEventListener('keydown', function (e) {
    if (!img) return;
    var st = e.shiftKey ? 1 : 0.2, mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
    if (mv) { e.preventDefault(); T.cx += mv[0]; T.cy += mv[1]; drawStage(); queueOut(); }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(T.s * 1.04); }
    if (e.key === '-') { e.preventDefault(); zoomTo(T.s / 1.04); }
  });
  function zoomTo(s, px, py) {
    var lo = coverScale() * 0.4, hi = coverScale() * 12; s = Math.max(lo, Math.min(hi, s));
    if (px === undefined) { px = view.ox + frame().w * view.k / 2; py = view.oy + frame().h * view.k / 2; }
    var fx = (px - view.ox) / view.k, fy = (py - view.oy) / view.k, r = s / T.s;
    T.cx = fx + (T.cx - fx) * r; T.cy = fy + (T.cy - fy) * r; T.s = s;
    syncZoom(); drawStage(); queueOut();
  }
  function syncZoom() {
    if (!img) return;
    var lo = Math.log(coverScale() * 0.4), hi = Math.log(coverScale() * 12);
    $('zoom').value = Math.round((Math.log(T.s) - lo) / (hi - lo) * 1000);
  }
  $('zoom').addEventListener('input', function () {
    var lo = Math.log(coverScale() * 0.4), hi = Math.log(coverScale() * 12);
    zoomTo(Math.exp(lo + (hi - lo) * this.value / 1000));
  });
  $('tilt').addEventListener('input', function () {
    var f = frame(), fx = f.w / 2, fy = chinY(f) - (f.head[0] + f.head[1]) / 4;
    var na = this.value / 10 * Math.PI / 180, d = na - T.a, c = Math.cos(d), s = Math.sin(d);
    var dx = T.cx - fx, dy = T.cy - fy; T.cx = fx + c * dx - s * dy; T.cy = fy + s * dx + c * dy; T.a = na;
    $('tiltV').textContent = (this.value / 10).toFixed(1).replace('.0', '') + '°';
    drawStage(); queueOut();
  });
  ['bri', 'con', 'sat'].forEach(function (id) { $(id).addEventListener('input', function () { drawStage(); queueOut(); }); });

  // ---------- "line up for me" ----------
  $('autoBtn').onclick = function () {
    if (marking) { marking = 0; marks = []; showTip(''); drawGuides(); this.textContent = 'Line up for me'; return; }
    marking = 1; marks = []; this.textContent = 'Cancel'; showTip('Tap the bottom of your chin.'); stage.focus();
  };
  function showTip(t) { $('markTip').textContent = t; $('markTip').hidden = !t; stage.classList.toggle('marking', !!t); }
  function finishMarks() {
    marking = 0; $('autoBtn').textContent = 'Line up for me'; showTip('');
    var chin = marks[0], top = marks[1], dx = chin.x - top.x, dy = chin.y - top.y, d = Math.hypot(dx, dy);
    if (d < 10 || dy <= 0) { marks = []; drawGuides(); alert('Tap the chin first, then the top of the head above it.'); return; }
    var f = frame(), head = (f.head[0] + f.head[1]) / 2;
    T.a = Math.max(-0.26, Math.min(0.26, Math.atan2(dx, dy)));
    T.s = head / d;
    var ux = (chin.x - iw / 2) * T.s, uy = (chin.y - ih / 2) * T.s, c = Math.cos(T.a), s = Math.sin(T.a);
    T.cx = f.w / 2 - (c * ux - s * uy); T.cy = chinY(f) - (s * ux + c * uy);
    $('tilt').value = Math.round(T.a * 180 / Math.PI * 10); $('tiltV').textContent = (T.a * 180 / Math.PI).toFixed(1).replace('.0', '') + '°';
    setTimeout(function () { marks = []; drawGuides(); }, 1400);
    syncZoom(); drawStage(); queueOut();
  }

  // ---------- rendering the finished photo ----------
  var hasCtxFilter = (function () { try { var c = document.createElement('canvas').getContext('2d'); return typeof c.filter === 'string' && c.filter === 'none'; } catch (e) { return false; } })();
  function renderPhoto(pw, ph) {
    var f = frame(), c = document.createElement('canvas'); c.width = pw; c.height = ph;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, pw, ph);
    // match the height; extra width (an online form with a different shape) widens around the same face
    var k = ph / f.h, ox = (pw - f.w * k) / 2;
    x.imageSmoothingQuality = 'high';
    if (hasCtxFilter) x.filter = filterStr();
    placeImage(x, k, ox, 0);
    x.filter = 'none';
    if (!hasCtxFilter && ($('bri').value != 100 || $('con').value != 100 || $('sat').value != 100)) manualFilter(x, pw, ph);
    return c;
  }
  function manualFilter(x, w, h) {
    var d = x.getImageData(0, 0, w, h), a = d.data, b = $('bri').value / 100, ct = $('con').value / 100, st = $('sat').value / 100;
    for (var i = 0; i < a.length; i += 4) {
      var r = a[i] * b, g = a[i + 1] * b, bl = a[i + 2] * b;
      r = (r - 128) * ct + 128; g = (g - 128) * ct + 128; bl = (bl - 128) * ct + 128;
      var l = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      a[i] = l + (r - l) * st; a[i + 1] = l + (g - l) * st; a[i + 2] = l + (bl - l) * st;
    }
    x.putImageData(d, 0, 0);
  }
  function singleSize() {
    var f = frame(), m = single();
    if (m === 'px') return [Math.max(50, +$('pxW').value || P.px[0]), Math.max(50, +$('pxH').value || P.px[1])];
    var dpi = +m; return [Math.round(f.w / IN * dpi), Math.round(f.h / IN * dpi)];
  }
  function toJpeg(c, q) { return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', q); }); }
  // smallest loss of quality that stays under the limit; shrinks the pixels only if it must and may
  function underLimit(c, kb, canShrink) {
    if (!kb) return toJpeg(c, 0.95).then(function (b) { return { blob: b, c: c, q: 0.95 }; });
    var lim = kb * 1024;
    var search = function (cc) {
      var lo = 0.3, hi = 0.97, best = null, n = 0;
      var step = function () {
        if (n++ > 7) return Promise.resolve(best);
        var q = (lo + hi) / 2;
        return toJpeg(cc, q).then(function (b) { if (b.size <= lim) { best = { blob: b, c: cc, q: q }; lo = q; } else hi = q; return step(); });
      };
      return toJpeg(cc, 0.97).then(function (b) { return b.size <= lim ? { blob: b, c: cc, q: 0.97 } : step(); });
    };
    return search(c).then(function (r) {
      if (r || !canShrink || c.width < 200) return r || toJpeg(c, 0.3).then(function (b) { return { blob: b, c: c, q: 0.3, over: true }; });
      var s = document.createElement('canvas'); s.width = Math.round(c.width * 0.85); s.height = Math.round(c.height * 0.85);
      s.getContext('2d').drawImage(c, 0, 0, s.width, s.height);
      return underLimit(s, kb, true);
    });
  }
  // write the print resolution into the JPEG so printers and apps know its real size
  function withDpi(blob, dpi) {
    return blob.arrayBuffer().then(function (ab) {
      var u = new Uint8Array(ab);
      if (u[2] === 0xFF && u[3] === 0xE0 && u[6] === 0x4A && u[7] === 0x46) { // JFIF APP0
        u[13] = 1; u[14] = dpi >> 8; u[15] = dpi & 255; u[16] = dpi >> 8; u[17] = dpi & 255;
      }
      return new Blob([u], { type: 'image/jpeg' });
    });
  }
  function save(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
  function baseName() { return 'photo-' + P.id + '-' + frame().w + 'x' + frame().h + 'mm'; }

  var outT;
  function queueOut() { clearTimeout(outT); outT = setTimeout(update, 220); }
  function update() { updateSingle(); updateSheet(); }
  function updateSingle() {
    var s = singleSize(), f = frame(), m = single();
    var shape = m === 'px' && Math.abs(s[0] / s[1] - f.w / f.h) > 0.01 ? ' · wider or narrower than the printed shape, so the edges are filled out' : '';
    $('singleSum').textContent = s[0] + ' × ' + s[1] + ' px' + (m !== 'px' ? ' · prints at ' + f.w + ' × ' + f.h + ' mm' : '') + shape;
  }
  $('dlSingle').onclick = function () {
    if (!img) return;
    var s = singleSize(), c = renderPhoto(s[0], s[1]), lim = +$('maxKB').value || 0, btn = this;
    btn.disabled = true;
    underLimit(c, lim, single() !== 'px').then(function (r) {
      var dpi = single() === 'px' ? 300 : +single();
      return withDpi(r.blob, dpi).then(function (b) {
        save(b, baseName() + '.jpg');
        $('singleSum').textContent = 'Saved ' + r.c.width + ' × ' + r.c.height + ' px, ' + kb(b.size) + (r.over ? ' — still over ' + lim + ' KB at the lowest quality; try fewer pixels' : lim ? ' (quality ' + Math.round(r.q * 100) + '%)' : '');
      });
    }).then(function () { btn.disabled = false; });
  };

  // ---------- print sheet ----------
  function paperMM() {
    var p = PAPERS.filter(function (x) { return x.id === $('paper').value; })[0] || PAPERS[0], dpi = +$('sheetDpi').value;
    if (p.id === 'cpx') { var w = +$('pW').value || p.w, h = +$('pH').value || p.h; return { w: w / dpi * IN, h: h / dpi * IN, pxW: w, pxH: h, p: p }; }
    if (p.id === 'cmm') return { w: +$('pW').value || p.w, h: +$('pH').value || p.h, p: p };
    return { w: p.w, h: p.h, p: p };
  }
  function grid(W, H, w, h, g) { var c = Math.max(0, Math.floor((W + g) / (w + g))), r = Math.max(0, Math.floor((H + g) / (h + g))); return { c: c, r: r, n: c * r, w: c ? c * w + (c - 1) * g : 0, h: r ? r * h + (r - 1) * g : 0 }; }
  function pack(W, H, w, h, g, rot) {
    var best = [];
    var tryOne = function (aw, ah, turned) { // main grid in one orientation, leftover strips in the other
      var out = [], m = grid(W, H, aw, ah, g), bw = turned ? w : h, bh = turned ? h : w;
      for (var r = 0; r < m.r; r++) for (var c = 0; c < m.c; c++) out.push({ x: c * (aw + g), y: r * (ah + g), w: aw, h: ah, rot: turned });
      if (rot && m.n) {
        var right = grid(W - m.w - g, H, bw, bh, g);
        for (var r2 = 0; r2 < right.r; r2++) for (var c2 = 0; c2 < right.c; c2++) out.push({ x: m.w + g + c2 * (bw + g), y: r2 * (bh + g), w: bw, h: bh, rot: !turned });
        var below = grid(m.w, H - m.h - g, bw, bh, g);
        for (var r3 = 0; r3 < below.r; r3++) for (var c3 = 0; c3 < below.c; c3++) out.push({ x: c3 * (bw + g), y: m.h + g + r3 * (bh + g), w: bw, h: bh, rot: !turned });
      }
      if (out.length > best.length) best = out;
    };
    tryOne(w, h, false);
    if (rot) tryOne(h, w, true);
    return best;
  }
  function layout() {
    var f = frame(), pm = paperMM(), m = Math.max(0, +$('margin').value || 0), g = Math.max(0, +$('gap').value || 0);
    var W = pm.w - 2 * m, H = pm.h - 2 * m;
    var spots = pack(W, H, f.w, f.h, g, $('allowRot').checked);
    var want = +$('copies').value; if (want) spots = spots.slice(0, want);
    // centre what was placed
    var maxX = 0, maxY = 0; spots.forEach(function (s) { maxX = Math.max(maxX, s.x + s.w); maxY = Math.max(maxY, s.y + s.h); });
    var dx = m + (W - maxX) / 2, dy = m + (H - maxY) / 2;
    spots.forEach(function (s) { s.x += dx; s.y += dy; });
    return { pm: pm, spots: spots, fits: pack(W, H, f.w, f.h, g, $('allowRot').checked).length };
  }
  function drawSheet(c, L, k, photo) {
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    L.spots.forEach(function (s) {
      var X = s.x * k, Y = s.y * k, w = s.w * k, h = s.h * k;
      if (photo) {
        if (s.rot) { x.save(); x.translate(X + w, Y); x.rotate(Math.PI / 2); x.drawImage(photo, 0, 0, h, w); x.restore(); }
        else x.drawImage(photo, X, Y, w, h);
      } else { x.fillStyle = '#E7E2D6'; x.fillRect(X, Y, w, h); }
      if ($('cutLines').checked) { x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = Math.max(1, k * 0.12); x.strokeRect(X, Y, w, h); }
    });
  }
  var sheetT;
  function updateSheet() {
    clearTimeout(sheetT); sheetT = setTimeout(function () {
      var L = layout(), pm = L.pm, dpi = +$('sheetDpi').value;
      // copies menu tracks how many fit
      var sel = $('copies'), cur = sel.value, opts = '<option value="0">As many as fit (' + L.fits + ')</option>';
      for (var i = 1; i < L.fits; i++) opts += '<option value="' + i + '">' + i + '</option>';
      sel.innerHTML = opts; sel.value = +cur < L.fits ? cur : '0';
      var c = $('sheetCv'), maxW = Math.min(300, c.parentNode.clientWidth || 300), k = Math.min(maxW / pm.w, 360 / pm.h);
      c.width = Math.round(pm.w * k * 2); c.height = Math.round(pm.h * k * 2); c.style.width = Math.round(pm.w * k) + 'px'; c.style.height = Math.round(pm.h * k) + 'px';
      var photo = img ? renderPhoto(Math.round(frame().w * k * 4), Math.round(frame().h * k * 4)) : null;
      drawSheet(c, L, k * 2, photo);
      var px = pm.pxW ? [pm.pxW, pm.pxH] : [Math.round(pm.w / IN * dpi), Math.round(pm.h / IN * dpi)];
      $('sheetSum').innerHTML = L.spots.length ? '<b>' + L.spots.length + ' photo' + (L.spots.length > 1 ? 's' : '') + '</b> on ' + pm.w.toFixed(1).replace('.0', '') + ' × ' + pm.h.toFixed(1).replace('.0', '') + ' mm · ' + px[0] + ' × ' + px[1] + ' px at ' + dpi + ' dpi' +
        (L.spots.some(function (s) { return s.rot; }) ? ' · some turned sideways to fit' : '') : 'No copy fits on this paper with these margins.';
    }, 60);
  }
  function sheetCanvas() {
    var L = layout(), pm = L.pm, dpi = +$('sheetDpi').value, k = dpi / IN;
    var c = document.createElement('canvas');
    c.width = pm.pxW || Math.round(pm.w * k); c.height = pm.pxH || Math.round(pm.h * k);
    var photo = renderPhoto(Math.round(frame().w * k), Math.round(frame().h * k));
    drawSheet(c, L, k, photo);
    return { c: c, L: L, dpi: dpi };
  }
  $('dlSheet').onclick = function () {
    if (!img) return;
    var r = sheetCanvas();
    if (!r.L.spots.length) return;
    toJpeg(r.c, 0.95).then(function (b) { return withDpi(b, r.dpi); }).then(function (b) { save(b, baseName() + '-sheet-' + $('paper').value + '.jpg'); });
  };
  $('dlPdf').onclick = function () {
    if (!img) return;
    var btn = this; btn.disabled = true;
    var go = function () {
      var r = sheetCanvas(), pm = r.L.pm;
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: [pm.w, pm.h], orientation: pm.w > pm.h ? 'landscape' : 'portrait' });
      doc.addImage(r.c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pm.w, pm.h, undefined, 'NONE');
      doc.setProperties({ title: 'Passport photos — ' + P.name });
      doc.save(baseName() + '-sheet-' + $('paper').value + '.pdf');
      btn.disabled = false;
    };
    if (window.jspdf) go();
    else { var s = document.createElement('script'); s.src = '../js/vendor/jspdf-2.5.2.min.js'; s.onload = go; s.onerror = function () { btn.disabled = false; alert('Couldn’t load the PDF maker.'); }; document.head.appendChild(s); }
  };

  // ---------- start ----------
  var sv = store.get('single'); if (sv) { var r = document.querySelector('input[name=single][value="' + sv + '"]'); if (r) { r.checked = true; $('pxBox').hidden = sv !== 'px'; } }
  if (store.get('maxKB')) $('maxKB').value = store.get('maxKB');
  if (store.get('sheetDpi')) $('sheetDpi').value = store.get('sheetDpi');
  setPaper(store.get('paper') || 'kodak');
  setPreset(store.get('preset') || 'uk');
  window.__pp = { open: openFile, layout: layout, T: T, mark: function (a, b) { marks = [a, b]; finishMarks(); } };
})();
