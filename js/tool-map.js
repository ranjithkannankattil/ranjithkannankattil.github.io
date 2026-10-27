/* ============================================================
   TOOL — Map colourer  (productivity/map.html)
   World view (countries) and a drill-down view per country
   (states / provinces). Boundaries: Natural Earth, India's point
   of view — Jammu & Kashmir and Ladakh in full (incl. Gilgit-
   Baltistan, Aksai Chin and Siachen), Arunachal Pradesh in India.
   Data: assets/maps/world.json, world-lo.json, a1/<ISO3>.json
   Everything runs in the browser; maps are saved to localStorage.
   ============================================================ */
(function () {
  'use strict';
  if (!window.d3 || !window.topojson) return;

  var BASE = '../assets/maps/';
  var KEY = 'rkb.mapcolour.v1';
  var W = 960, H = 600;
  var PALETTE = ['#5C4D7D', '#C2463D', '#2F6B4F', '#D49A2A', '#1F6F78', '#A8522E', '#3B5A7A', '#B0557A', '#6E8B3D', '#4A4A4C'];
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- state ---------- */
  var DEF_STYLE = {
    projWorld: 'globe', projCountry: 'fit',
    others: 'none',          // none | land  (fill for uncoloured places)
    borders: 'all',          // all | outline | none
    outlineColoured: true,
    neighbours: false,
    borderColor: '#8C8577', landColor: '#E4DED2',
    ocean: false, oceanColor: '#DCE5EA',
    graticule: false, labels: false, legend: true
  };
  var S = load();
  function blankView() {
    return { groups: [{ id: 'g1', color: PALETTE[0], label: '', ids: [] }], active: 'g1' };
  }
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!s || !s.views) s = { title: '', views: {}, style: {} };
    s.style = Object.assign({}, DEF_STYLE, s.style || {});
    return s;
  }
  var saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(S)); $('mcSaved').textContent = 'Saved in this browser'; } catch (e) {}
    }, 250);
  }
  function view() { if (!S.views[cur]) S.views[cur] = blankView(); return S.views[cur]; }
  function groupOf(id) {
    var gs = view().groups;
    for (var i = 0; i < gs.length; i++) if (gs[i].ids.indexOf(id) >= 0) return gs[i];
    return null;
  }
  var ERASE = '__erase';
  function activeGroup() {
    var v = view();
    if (v.active === ERASE) return null;
    return v.groups.filter(function (g) { return g.id === v.active; })[0] || v.groups[0];
  }

  /* ---------- data ---------- */
  var cache = {};
  function getJSON(path) {
    if (!cache[path]) cache[path] = fetch(BASE + path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    return cache[path];
  }
  function unpack(topo) {
    var obj = topo.objects[Object.keys(topo.objects)[0]];
    var feats = topojson.feature(topo, obj).features, seen = {};
    feats.forEach(function (f) {
      var id = f.properties.id || f.properties.name;
      if (seen[id]) id = id + '~' + f.properties.name;
      seen[id] = 1; f.id = id;
    });
    return {
      feats: feats,
      inner: topojson.mesh(topo, obj, function (a, b) { return a !== b; }),
      outer: topojson.mesh(topo, obj, function (a, b) { return a === b; })
    };
  }
  var world = null, worldLo = null, sub = null, subIndex = {}, names = {};
  var cur = 'world';

  /* ---------- svg ---------- */
  var svg = d3.select('#mcMap').attr('viewBox', '0 0 ' + W + ' ' + H);
  var gOcean = svg.append('path').attr('class', 'mc-ocean');
  var gGrat = svg.append('path').attr('class', 'mc-grat').attr('fill', 'none');
  var gZoom = svg.append('g');
  var gNb = gZoom.append('g').attr('class', 'mc-nb');
  var gPlaces = gZoom.append('g').attr('class', 'mc-places');
  var pInner = gZoom.append('path').attr('fill', 'none').attr('class', 'mc-mesh');
  var pOuter = gZoom.append('path').attr('fill', 'none').attr('class', 'mc-mesh');
  var gHi = gZoom.append('g').attr('class', 'mc-hi');
  var gLabels = svg.append('g').attr('class', 'mc-labels');
  var gTitle = svg.append('text').attr('class', 'mc-title');
  var gLegend = svg.append('g').attr('class', 'mc-legend');

  var proj, path, rot = [-20, -15], baseScale = 1, zt = d3.zoomIdentity, isGlobe = false, last = null;
  var FONT = "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif";

  function feats() { return cur === 'world' ? world.feats : sub.feats; }
  function projKind() { return cur === 'world' ? S.style.projWorld : S.style.projCountry; }

  function setupProjection() {
    var k = projKind(), pad = 18, fc = { type: 'FeatureCollection', features: feats() };
    isGlobe = k === 'globe';
    zt = d3.zoomIdentity; last = null;
    if (cur === 'world') {
      if (k === 'globe') { proj = d3.geoOrthographic().rotate(rot).translate([W / 2, H / 2]).scale(H / 2 - pad); }
      else if (k === 'mercator') {
        proj = d3.geoMercator().fitExtent([[pad, pad], [W - pad, H - pad]], { type: 'FeatureCollection', features: world.feats.filter(function (f) { return f.id !== 'ATA'; }) });
      } else {
        proj = (k === 'natural' ? d3.geoNaturalEarth1() : d3.geoEqualEarth()).fitExtent([[pad, pad], [W - pad, H - pad]], { type: 'Sphere' });
      }
    } else {
      var c = d3.geoCentroid(fc);
      if (k === 'globe') {
        rot = [-c[0], -c[1]];
        proj = d3.geoOrthographic().rotate(rot).translate([W / 2, H / 2]).scale(H / 2 - pad);
      } else if (k === 'mercator') {
        proj = d3.geoMercator().fitExtent([[pad, pad + 30], [W - pad, H - pad]], fc);
      } else {
        proj = d3.geoAzimuthalEqualArea().rotate([-c[0], -c[1]]).clipAngle(150).fitExtent([[pad, pad + 30], [W - pad, H - pad]], fc);
      }
    }
    baseScale = proj.scale();
    path = d3.geoPath(proj);
    zoom.transform(svg, d3.zoomIdentity);
  }

  /* ---------- drawing ---------- */
  function fillFor(f) {
    var g = groupOf(f.id);
    if (g) return g.color;
    return S.style.others === 'land' ? S.style.landColor : 'transparent';
  }
  function draw(lo) {
    var st = S.style, useLo = lo && cur === 'world' && worldLo;
    var data = useLo ? worldLo : (cur === 'world' ? world : sub);
    var sphere = { type: 'Sphere' };
    var flatT = isGlobe ? null : zt;
    gZoom.attr('transform', flatT ? flatT.toString() : null);
    var sw = 1 / (flatT ? flatT.k : 1);

    gOcean.attr('d', st.ocean ? path(sphere) : null)
      .attr('fill', st.ocean ? st.oceanColor : 'none')
      .attr('transform', flatT ? flatT.toString() : null);
    gGrat.attr('d', st.graticule ? path(d3.geoGraticule10()) : null)
      .attr('stroke', st.borderColor).attr('stroke-opacity', .35).attr('stroke-width', .5)
      .attr('transform', flatT ? flatT.toString() : null).attr('vector-effect', 'non-scaling-stroke');

    // neighbouring countries as faint context in a country view
    var nb = (cur !== 'world' && st.neighbours && world) ? (useLo ? worldLo : world).feats.filter(function (f) { return f.id !== cur; }) : [];
    var nsel = gNb.selectAll('path').data(nb, function (f) { return f.id; });
    nsel.exit().remove();
    nsel.enter().append('path').merge(nsel)
      .attr('d', path).attr('fill', st.others === 'land' ? st.landColor : 'none').attr('fill-opacity', .45)
      .attr('stroke', st.borderColor).attr('stroke-opacity', .45).attr('stroke-width', .5 * sw);

    var sel = gPlaces.selectAll('path').data(data.feats, function (f) { return f.id; });
    sel.exit().remove();
    sel.enter().append('path')
      .on('click', function (ev, f) { if (mode !== 'brush') toggle(f.id); })
      .on('mousemove', function (ev, f) { tip(ev, f); })
      .on('mouseleave', function () { tipEl.hidden = true; })
      .merge(sel)
      .attr('d', path)
      .attr('stroke-width', .6 * sw);

    paintFills();
    pInner.attr('d', st.borders === 'all' ? path(data.inner) : null).attr('stroke', st.borderColor).attr('stroke-width', .5 * sw);
    pOuter.attr('d', st.borders !== 'none' ? path(data.outer) : null).attr('stroke', st.borderColor).attr('stroke-width', .7 * sw);
    if (!lo) { drawLabels(); drawLegend(); drawTitle(); }
    else gLabels.selectAll('*').remove();
  }

  function paintFills() {
    var st = S.style;
    gPlaces.selectAll('path')
      .attr('fill', fillFor)
      .attr('stroke', function (f) { return st.outlineColoured && groupOf(f.id) ? st.borderColor : 'none'; });
    var a = activeGroup();
    $('mcWrap').style.setProperty('--paint', a ? a.color : 'transparent');
    $('mcWrap').classList.toggle('is-erase', !a);
  }
  function visible(f) {
    if (!isGlobe) return true;
    var c = d3.geoCentroid(f), r = proj.rotate();
    return d3.geoDistance(c, [-r[0], -r[1]]) < Math.PI / 2 - .05;
  }
  function drawLabels() {
    var list = S.style.labels ? feats().filter(function (f) { return groupOf(f.id) && visible(f); }) : [];
    var sel = gLabels.selectAll('text').data(list, function (f) { return f.id; });
    sel.exit().remove();
    sel.enter().append('text').merge(sel)
      .attr('transform', function (f) {
        var p = path.centroid(f);
        if (!isGlobe) p = zt.apply(p);
        return isFinite(p[0]) ? 'translate(' + p[0] + ',' + p[1] + ')' : 'translate(-999,-999)';
      })
      .attr('text-anchor', 'middle').attr('dy', '.35em')
      .attr('font-family', FONT).attr('font-size', 11).attr('font-weight', 600)
      .attr('fill', '#1B1B1F').attr('stroke', '#ffffff').attr('stroke-width', 3).attr('stroke-opacity', .75).attr('paint-order', 'stroke')
      .text(function (f) { return f.properties.name; });
  }
  function drawTitle() {
    var t = S.title.trim();
    gTitle.attr('x', 20).attr('y', 34).attr('font-family', FONT).attr('font-size', 22).attr('font-weight', 600)
      .attr('fill', '#1B1B1F').text(t);
  }
  function drawLegend() {
    gLegend.selectAll('*').remove();
    if (!S.style.legend) return;
    var gs = view().groups.filter(function (g) { return g.ids.length && g.label.trim(); });
    if (!gs.length) return;
    var y0 = H - 20 - gs.length * 20, ink = '#1B1B1F';
    gs.forEach(function (g, i) {
      var y = y0 + i * 20;
      gLegend.append('rect').attr('x', 20).attr('y', y).attr('width', 14).attr('height', 14).attr('fill', g.color)
        .attr('stroke', S.style.borderColor).attr('stroke-width', .6);
      gLegend.append('text').attr('x', 42).attr('y', y + 11.5).attr('font-family', FONT).attr('font-size', 13)
        .attr('fill', ink).text(g.label.trim() + ' (' + g.ids.length + ')');
    });
  }
  function getVar(n, d) { var v = getComputedStyle(document.body).getPropertyValue(n).trim(); return v || d; }

  /* ---------- tooltip ---------- */
  var tipEl = $('mcTip');
  function tip(ev, f) {
    var g = groupOf(f.id), box = $('mcWrap').getBoundingClientRect();
    tipEl.innerHTML = '<b>' + esc(f.properties.name) + '</b>' + (g ? ' · ' + esc(g.label || 'coloured') : '');
    tipEl.style.left = (ev.clientX - box.left + 12) + 'px';
    tipEl.style.top = (ev.clientY - box.top + 12) + 'px';
    tipEl.hidden = false;
  }

  /* ---------- zoom / rotate ---------- */
  var zoom = d3.zoom().scaleExtent([.6, 60])
    .filter(function (ev) {
      if (ev.button || ev.type === 'dblclick') return false;
      if (mode === 'brush' && !spaceDown) {
        if (ev.type === 'mousedown') return false;
        if (ev.type === 'touchstart' && ev.touches.length < 2) return false;
      }
      return true;
    })
    .on('zoom', function (ev) {
      var t = ev.transform;
      if (isGlobe) {
        if (last && ev.sourceEvent && ev.sourceEvent.type !== 'wheel' && t.k === last.k) {
          var sens = 75 / proj.scale();
          var r = proj.rotate();
          rot = [r[0] + (t.x - last.x) * sens, Math.max(-90, Math.min(90, r[1] - (t.y - last.y) * sens)), r[2]];
          proj.rotate(rot);
        }
        proj.scale(baseScale * t.k);
        last = t;
        draw(true);
      } else {
        zt = t;
        draw(true);
      }
    })
    .on('end', function () { draw(false); });
  svg.call(zoom).on('dblclick.zoom', null);

  function resetView() {
    if (cur === 'world' && isGlobe) rot = [-20, -15];
    setupProjection(); draw();
  }

  /* ---------- actions ---------- */
  var mode = 'tap', spaceDown = false, undoS = {}, redoS = {};
  function snap() { return JSON.stringify(view().groups.map(function (g) { return g.ids; })); }
  function pushUndo(before) {
    (undoS[cur] = undoS[cur] || []).push(before);
    if (undoS[cur].length > 200) undoS[cur].shift();
    redoS[cur] = [];
    updUndo();
  }
  function restore(json) {
    var ids = JSON.parse(json);
    view().groups.forEach(function (g, i) { g.ids = ids[i] || []; });
  }
  function undo(back) {
    var from = back ? undoS[cur] : redoS[cur], to = back ? redoS : undoS;
    if (!from || !from.length) return;
    (to[cur] = to[cur] || []).push(snap());
    restore(from.pop());
    refresh(); updUndo();
  }
  function updUndo() {
    $('mcUndo').disabled = !(undoS[cur] && undoS[cur].length);
    $('mcRedo').disabled = !(redoS[cur] && redoS[cur].length);
  }
  // put a place in group g (null = clear); returns true if anything changed
  function setPlace(id, g) {
    var old = groupOf(id);
    if (old === g) return false;
    if (old) old.ids.splice(old.ids.indexOf(id), 1);
    if (g) g.ids.push(id);
    return true;
  }
  function toggle(id) {
    var before = snap(), a = activeGroup(), g = groupOf(id);
    if (setPlace(id, a && g !== a ? a : null)) pushUndo(before);
    focus(id);
    refresh();
  }
  // cheap redraw after colours change: fills, labels, legend, counts; the long list waits a frame
  var listT;
  function refresh() {
    save(); paintFills(); drawLabels(); drawLegend(); renderGroups();
    cancelAnimationFrame(listT); listT = requestAnimationFrame(renderList);
  }
  function commit() { save(); draw(); renderGroups(); renderList(); }

  /* ---------- brush: drag across places to paint (or clear) them ---------- */
  var stroke = null;
  function placeAt(x, y) {
    var el = document.elementFromPoint(x, y);
    return el && el.parentNode === gPlaces.node() ? d3.select(el).datum() : null;
  }
  svg.on('pointerdown.brush', function (ev) {
    if (mode !== 'brush' || spaceDown || ev.button) return;
    if (ev.pointerType === 'touch' && !ev.isPrimary) { stroke = null; return; }
    var f = placeAt(ev.clientX, ev.clientY), a = activeGroup();
    stroke = { before: snap(), changed: false, target: null, erase: !a };
    if (f && a && groupOf(f.id) === a) stroke.erase = true;   // starting on your own colour wipes instead
    stroke.target = stroke.erase ? null : a;
    try { this.setPointerCapture(ev.pointerId); } catch (e) {}
    brushAt(ev);
    ev.preventDefault();
  });
  svg.on('pointermove.brush', function (ev) { if (stroke) brushAt(ev); });
  svg.on('pointerup.brush pointercancel.brush', function () {
    if (!stroke) return;
    if (stroke.changed) pushUndo(stroke.before);
    stroke = null; refresh();
  });
  function brushAt(ev) {
    var f = placeAt(ev.clientX, ev.clientY);
    if (!f) return;
    var g = groupOf(f.id);
    if (stroke.erase && !g) return;
    if (setPlace(f.id, stroke.target)) {
      stroke.changed = true; paintFills(); focus(f.id);
    }
  }
  function setMode(m) {
    mode = m;
    $('mcModeTap').classList.toggle('on', m === 'tap');
    $('mcModeBrush').classList.toggle('on', m === 'brush');
    $('mcWrap').classList.toggle('is-brush', m === 'brush');
    $('mcHint').textContent = m === 'brush'
      ? 'Brush: drag across places to colour them · start on your colour to wipe · hold Space or use two fingers to move'
      : 'Tap to colour · drag to turn or pan · scroll or pinch to zoom';
  }
  function pick(id) { view().active = id; save(); renderGroups(); paintFills(); }

  function focus(id) {
    var f = feats().filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    var g = groupOf(id), el = $('mcFocus');
    var drill = cur === 'world' && subIndex[id] > 1;
    el.innerHTML = '<span class="mc-dot" style="background:' + (g ? g.color : 'transparent') + '"></span><b>' + esc(f.properties.name) + '</b>' +
      '<span class="mc-focus-g">' + (g ? esc(g.label || 'Coloured') : 'Not coloured') + '</span>' +
      (drill ? '<button class="tl-btn" data-drill="' + esc(id) + '">States / provinces →</button>' : '');
    el.hidden = false;
  }

  function open(key) {
    tipEl.hidden = true; $('mcFocus').hidden = true;
    if (key === 'world') {
      cur = 'world'; sub = null; after();
      return;
    }
    $('mcStatus').textContent = 'Loading ' + (names[key] || key) + '…';
    getJSON('a1/' + key + '.json').then(function (topo) {
      sub = unpack(topo); cur = key; after();
    }).catch(function () { $('mcStatus').textContent = 'Could not load that country. Try again.'; });
    function after() {
      $('mcStatus').textContent = '';
      view();
      setupProjection(); draw(); renderAll(); updUndo();
      try { history.replaceState(null, '', '#' + (cur === 'world' ? '' : 'c=' + cur)); } catch (e) {}
    }
  }

  /* ---------- panel: crumb, groups, list ---------- */
  function renderAll() { renderCrumb(); renderProj(); renderGroups(); renderList(); renderStyle(); }

  function renderCrumb() {
    var c = $('mcCrumb');
    if (cur === 'world') c.innerHTML = '<b>World</b><span class="mc-crumb-note">Click a country to colour it. Use <i>States / provinces →</i> to drill down.</span>';
    else c.innerHTML = '<button class="mc-back" data-open="world">World</button><span>/</span><b>' + esc(names[cur] || cur) + '</b><span class="mc-crumb-note">' + feats().length + ' states / provinces</span>';
  }
  function renderProj() {
    var opts = cur === 'world'
      ? [['globe', 'Globe'], ['equalearth', 'Equal Earth'], ['natural', 'Natural Earth'], ['mercator', 'Mercator']]
      : [['fit', 'Fitted (equal-area)'], ['globe', 'Globe'], ['mercator', 'Mercator']];
    var k = projKind();
    $('mcProj').innerHTML = opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === k ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
  }
  function renderGroups() {
    var v = view();
    $('mcSw').innerHTML = v.groups.map(function (g, i) {
      return '<button class="mc-sw' + (g.id === v.active ? ' on' : '') + '" data-pick="' + g.id + '" style="--c:' + g.color + '" title="' + esc((g.label || 'Colour ' + (i + 1)) + (i < 9 ? ' · key ' + (i + 1) : '')) + '" aria-label="' + esc(g.label || 'Colour ' + (i + 1)) + '"><i>' + g.ids.length + '</i></button>';
    }).join('');
    $('mcErase').classList.toggle('on', v.active === ERASE);
    $('mcGroups').innerHTML = v.groups.map(function (g, i) {
      return '<li class="mc-g' + (g.id === v.active ? ' on' : '') + '" data-g="' + g.id + '">' +
        '<label class="mc-g-pick" title="Paint with this colour"><input type="radio" name="mcActive" value="' + g.id + '"' + (g.id === v.active ? ' checked' : '') + '><span></span></label>' +
        '<input type="color" value="' + g.color + '" data-gc="' + g.id + '" aria-label="Colour">' +
        '<input type="text" class="mc-g-name" value="' + esc(g.label) + '" placeholder="Label for the legend" data-gl="' + g.id + '" aria-label="Label">' +
        '<span class="mc-g-n">' + g.ids.length + '</span>' +
        (v.groups.length > 1 ? '<button class="mc-x" data-gx="' + g.id + '" aria-label="Remove colour" title="Remove colour">×</button>' : '<span></span>') +
        '</li>';
    }).join('');
  }
  function renderList() {
    var q = $('mcSearch').value.trim().toLowerCase(), only = $('mcOnly').checked;
    var list = feats().slice().sort(function (a, b) { return a.properties.name.localeCompare(b.properties.name); })
      .filter(function (f) {
        if (only && !groupOf(f.id)) return false;
        return !q || f.properties.name.toLowerCase().indexOf(q) >= 0 || String(f.id).toLowerCase() === q;
      });
    $('mcList').innerHTML = list.map(function (f) {
      var g = groupOf(f.id), drill = cur === 'world' && subIndex[f.id] > 1;
      return '<li><button class="mc-item" data-t="' + esc(f.id) + '"><span class="mc-dot" style="background:' + (g ? g.color : 'transparent') + '"></span>' + esc(f.properties.name) + '</button>' +
        (drill ? '<button class="mc-drill" data-drill="' + esc(f.id) + '" title="States / provinces of ' + esc(f.properties.name) + '">States →</button>' : '') + '</li>';
    }).join('') || '<li class="mc-empty">Nothing matches.</li>';
    var n = feats().filter(function (f) { return groupOf(f.id); }).length;
    $('mcCount').textContent = n + ' of ' + feats().length + ' coloured';
  }
  function renderStyle() {
    var st = S.style;
    $('mcOthers').value = st.others; $('mcBorders').value = st.borders;
    $('mcOutline').checked = st.outlineColoured; $('mcBorderC').value = st.borderColor;
    $('mcLandC').value = st.landColor; $('mcOcean').checked = st.ocean; $('mcOceanC').value = st.oceanColor;
    $('mcGrat').checked = st.graticule; $('mcLabels').checked = st.labels; $('mcLegend').checked = st.legend;
    $('mcNb').checked = st.neighbours; $('mcNbRow').hidden = cur === 'world';
    $('mcTitleIn').value = S.title;
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-drill],[data-open],[data-t],[data-gx],[data-pick]');
    if (!t) return;
    if (t.dataset.pick) pick(t.dataset.pick);
    else if (t.dataset.drill) open(t.dataset.drill);
    else if (t.dataset.open) open(t.dataset.open);
    else if (t.dataset.t) toggle(t.dataset.t);
    else if (t.dataset.gx) {
      var v = view(); v.groups = v.groups.filter(function (g) { return g.id !== t.dataset.gx; });
      if (v.active === t.dataset.gx) v.active = v.groups[0].id;
      undoS[cur] = []; redoS[cur] = []; updUndo();
      commit();
    }
  });
  $('mcGroups').addEventListener('change', function (e) {
    var t = e.target, v = view();
    if (t.name === 'mcActive') pick(t.value);
    if (t.dataset.gc) { v.groups.forEach(function (g) { if (g.id === t.dataset.gc) g.color = t.value; }); commit(); }
  });
  $('mcGroups').addEventListener('input', function (e) {
    var t = e.target, v = view();
    if (t.dataset.gc) {
      v.groups.forEach(function (g) { if (g.id === t.dataset.gc) g.color = t.value; });
      save(); paintFills(); drawLegend();
      var sw = $('mcSw').querySelector('[data-pick="' + t.dataset.gc + '"]'); if (sw) sw.style.setProperty('--c', t.value);
      cancelAnimationFrame(listT); listT = requestAnimationFrame(renderList);
    }
    if (t.dataset.gl) { v.groups.forEach(function (g) { if (g.id === t.dataset.gl) g.label = t.value; }); save(); drawLegend(); }
  });
  $('mcAddG').addEventListener('click', function () {
    var v = view(), used = v.groups.map(function (g) { return g.color.toLowerCase(); });
    var c = PALETTE.filter(function (p) { return used.indexOf(p.toLowerCase()) < 0; })[0] || '#888888';
    var id = 'g' + Date.now().toString(36);
    v.groups.push({ id: id, color: c, label: '', ids: [] }); v.active = id;
    commit();
  });
  $('mcSearch').addEventListener('input', renderList);
  $('mcOnly').addEventListener('change', renderList);
  $('mcProj').addEventListener('change', function () {
    if (cur === 'world') S.style.projWorld = this.value; else S.style.projCountry = this.value;
    save(); setupProjection(); draw();
  });
  function bindStyle(id, key, prop) {
    $(id).addEventListener(prop === 'checked' ? 'change' : 'input', function () { S.style[key] = this[prop || 'value']; save(); draw(); });
  }
  bindStyle('mcOthers', 'others'); bindStyle('mcBorders', 'borders');
  bindStyle('mcOutline', 'outlineColoured', 'checked'); bindStyle('mcBorderC', 'borderColor');
  bindStyle('mcLandC', 'landColor'); bindStyle('mcOcean', 'ocean', 'checked'); bindStyle('mcOceanC', 'oceanColor');
  bindStyle('mcGrat', 'graticule', 'checked'); bindStyle('mcLabels', 'labels', 'checked'); bindStyle('mcLegend', 'legend', 'checked');
  bindStyle('mcNb', 'neighbours', 'checked');
  $('mcOthers').addEventListener('change', function () { S.style.others = this.value; save(); draw(); });
  $('mcBorders').addEventListener('change', function () { S.style.borders = this.value; save(); draw(); });
  $('mcTitleIn').addEventListener('input', function () { S.title = this.value; save(); drawTitle(); });
  $('mcReset').addEventListener('click', resetView);
  $('mcClear').addEventListener('click', function () {
    var before = snap();
    view().groups.forEach(function (g) { g.ids = []; });
    pushUndo(before); refresh(); focusHide();
    $('mcShareMsg').textContent = 'Cleared — Undo brings it back.';
  });

  // paste a list of names or codes
  $('mcPasteGo').addEventListener('click', function () {
    var words = $('mcPaste').value.split(/[\n,;\t]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var idx = {};
    feats().forEach(function (f) {
      idx[f.properties.name.toLowerCase()] = f.id; idx[String(f.id).toLowerCase()] = f.id;
      var short = String(f.id).split('-')[1]; if (short) idx[short.toLowerCase()] = idx[short.toLowerCase()] || f.id;
    });
    var a = activeGroup(), miss = [], n = 0, before = snap();
    words.forEach(function (w) {
      var id = idx[w.toLowerCase()];
      if (!id) { miss.push(w); return; }
      if (setPlace(id, a)) n++;
    });
    if (n) pushUndo(before);
    $('mcPasteMsg').textContent = n + (a ? ' coloured' : ' cleared') + (miss.length ? ' · not found: ' + miss.join(', ') : '');
    refresh();
  });

  function focusHide() { $('mcFocus').hidden = true; }
  $('mcErase').addEventListener('click', function () { pick(ERASE); });
  $('mcAddG2').addEventListener('click', function () { $('mcAddG').click(); });
  $('mcModeTap').addEventListener('click', function () { setMode('tap'); });
  $('mcModeBrush').addEventListener('click', function () { setMode('brush'); });
  $('mcUndo').addEventListener('click', function () { undo(true); });
  $('mcRedo').addEventListener('click', function () { undo(false); });
  document.addEventListener('keydown', function (e) {
    var tg = e.target, typing = tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) && tg.type !== 'checkbox' && tg.type !== 'radio');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(!e.shiftKey); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); undo(false); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    var gs = view().groups;
    if (/^[1-9]$/.test(e.key) && gs[+e.key - 1]) { pick(gs[+e.key - 1].id); }
    else if (e.key === 'e' || e.key === 'E' || e.key === '0') pick(ERASE);
    else if (e.key === 'b' || e.key === 'B') setMode(mode === 'brush' ? 'tap' : 'brush');
    else if (e.key === ' ' && mode === 'brush') { spaceDown = true; $('mcWrap').classList.add('is-pan'); e.preventDefault(); }
  });
  document.addEventListener('keyup', function (e) { if (e.key === ' ') { spaceDown = false; $('mcWrap').classList.remove('is-pan'); } });
  setMode('tap');

  /* ---------- export ---------- */
  function svgString() {
    var node = $('mcMap').cloneNode(true);
    node.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    node.setAttribute('width', W); node.setAttribute('height', H);
    return new XMLSerializer().serializeToString(node);
  }
  function fname(ext) {
    var n = (S.title.trim() || ('map-' + (cur === 'world' ? 'world' : (names[cur] || cur)))).replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase();
    return n + '.' + ext;
  }
  function dl(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  $('mcSvg').addEventListener('click', function () { dl(new Blob([svgString()], { type: 'image/svg+xml' }), fname('svg')); });
  $('mcPng').addEventListener('click', function () {
    var img = new Image(), sc = 3, transparent = $('mcTransp').checked;
    img.onload = function () {
      var c = document.createElement('canvas'); c.width = W * sc; c.height = H * sc;
      var x = c.getContext('2d');
      if (!transparent) { x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) { dl(b, fname('png')); }, 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString());
  });
  $('mcShare').addEventListener('click', function () {
    var v = view();
    var payload = { c: cur, t: S.title, s: S.style, g: v.groups.filter(function (g) { return g.ids.length; }).map(function (g) { return [g.color, g.label, g.ids]; }) };
    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    var url = location.origin + location.pathname + '#m=' + b64;
    var done = function () { $('mcShareMsg').textContent = 'Link copied — it opens this map with these colours.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt('Copy this link', url); });
    else prompt('Copy this link', url);
  });
  function readShared() {
    var m = /[#&]m=([\w-]+)/.exec(location.hash);
    if (!m) { var c = /[#&]c=([A-Z0-9~-]+)/.exec(location.hash); return c ? c[1] : null; }
    try {
      var s = m[1].replace(/-/g, '+').replace(/_/g, '/');
      var p = JSON.parse(decodeURIComponent(escape(atob(s))));
      S.title = p.t || ''; S.style = Object.assign({}, DEF_STYLE, p.s || {});
      S.views[p.c] = {
        groups: (p.g.length ? p.g : [[PALETTE[0], '', []]]).map(function (g, i) { return { id: 'g' + (i + 1), color: g[0], label: g[1] || '', ids: g[2] || [] }; }),
        active: 'g1'
      };
      save();
      return p.c;
    } catch (e) { return null; }
  }

  /* ---------- boot ---------- */
  Promise.all([getJSON('world.json'), getJSON('a1/index.json')]).then(function (r) {
    world = unpack(r[0]); subIndex = r[1];
    world.feats.forEach(function (f) { names[f.id] = f.properties.name; });
    var start = readShared();
    $('mcStatus').textContent = '';
    if (start && start !== 'world' && subIndex[start]) open(start);
    else { cur = 'world'; view(); setupProjection(); draw(); renderAll(); }
    getJSON('world-lo.json').then(function (t) { worldLo = unpack(t); });
  }).catch(function () { $('mcStatus').textContent = 'The map data did not load. Refresh to try again.'; });
})();
