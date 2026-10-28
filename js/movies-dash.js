/* ============================================================
   MOVIES — the owner's private dashboard. Reads only the watch log
   (with the film summary saved in each entry), so it stores nothing
   extra and makes no API calls. Every bar, square and row is a filter:
   clicking adds a chip at the top and every chart redraws under it.
   Filters live in the address (#/dash?y=2026&l=ml) so a view can be bookmarked.
   ============================================================ */
(function () {
  'use strict';
  var App = window.MoviesApp, esc = App.esc;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var RUN = [['<90', 'Under 90 min'], ['90', '90–119 min'], ['120', '2 h–2 h 29'], ['150', '2 h 30 and over']];
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // ---------- reading one watch ----------
  var wday = function (d) { var x = new Date(d + 'T12:00:00').getDay(); return (x + 6) % 7; }; // Monday = 0
  var runBucket = function (rt) { return !rt ? null : rt < 90 ? '<90' : rt < 120 ? '90' : rt < 150 ? '120' : '150'; };
  function dims(w) {
    var f = w.film || {};
    return {
      y: w.date ? w.date.slice(0, 4) : null, m: w.date ? String(Number(w.date.slice(5, 7))) : null, d: w.date || null,
      g: f.g || [], l: f.l ? [f.l] : [], c: f.c || [], dec: f.y ? [String(Math.floor(f.y / 10) * 10)] : [],
      dir: (f.d || []).map(function (x) { return String(x.id); }), act: (f.a || []).slice(0, 4).map(function (x) { return String(x.id); }),
      w: w.where ? [w.where] : [], wd: w.date ? [String(wday(w.date))] : [], r: w.rating != null ? [String(w.rating)] : [],
      rt: runBucket(f.rt) ? [runBucket(f.rt)] : [], rw: [w.rewatch ? 'yes' : 'no']
    };
  }
  var KEYS = ['y', 'm', 'd', 'g', 'l', 'c', 'dec', 'dir', 'act', 'w', 'wd', 'r', 'rt', 'rw'];
  function pass(D, F, skip) {
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i], v = F[k];
      if (!v || k === skip) continue;
      var have = D[k];
      if (Array.isArray(have) ? have.indexOf(v) < 0 : have !== v) return false;
    }
    return true;
  }

  // names for ids and codes, gathered from the log itself
  function namer(all) {
    var people = {};
    all.forEach(function (w) { var f = w.film || {}; (f.d || []).concat(f.a || []).forEach(function (p) { people[p.id] = p.name; }); });
    return function (k, v) {
      if (k === 'y' || k === 'dec') return k === 'dec' ? v + 's' : v;
      if (k === 'm') return MONTHS_L[Number(v) - 1];
      if (k === 'd') return new Date(v + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      if (k === 'l') return App.langName(v);
      if (k === 'dir' || k === 'act') return people[v] || 'Person ' + v;
      if (k === 'wd') return ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'][Number(v)];
      if (k === 'r') return App.stars(Number(v)) + ' (' + v + ')';
      if (k === 'rt') return (RUN.filter(function (x) { return x[0] === v; })[0] || [0, v])[1];
      if (k === 'rw') return v === 'yes' ? 'Rewatches' : 'First watches';
      return v;
    };
  }
  var LABEL = { y: 'Year', m: 'Month', d: 'Day', g: 'Genre', l: 'Language', c: 'Country', dec: 'Released', dir: 'Director', act: 'Actor', w: 'Where', wd: 'Weekday', r: 'My rating', rt: 'Length', rw: 'Watch' };

  // ---------- pieces ----------
  function count(list, key, D) {
    var m = new Map();
    list.forEach(function (w, i) { var v = D[i][key]; (Array.isArray(v) ? v : v ? [v] : []).forEach(function (x) { m.set(x, (m.get(x) || 0) + 1); }); });
    return m;
  }
  function bars(title, key, entries, name, F, opts) {
    opts = opts || {};
    if (!entries.length) return '';
    var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }));
    var limit = opts.all ? entries.length : (opts.limit || 8);
    var shown = entries.slice(0, limit);
    return '<section class="mv-card-c" data-key="' + key + '"><h3>' + esc(title) + (F[key] ? ' <i>filtered</i>' : '') + '</h3><ul class="mv-hbars">' +
      shown.map(function (e) {
        var label = name(key, e[0]), on = F[key] === e[0];
        return '<li><button type="button" class="' + (on ? 'on' : '') + '" data-k="' + key + '" data-v="' + esc(e[0]) + '" data-tip="' + esc(label + ' · ' + e[1] + ' watch' + (e[1] === 1 ? '' : 'es')) + '" aria-pressed="' + on + '">' +
          '<span class="t">' + esc(label) + '</span><span class="b"><i style="width:' + Math.max(2, 100 * e[1] / max).toFixed(1) + '%"></i></span><span class="n">' + e[1] + '</span></button></li>';
      }).join('') + '</ul>' +
      (entries.length > limit ? '<button type="button" class="mv-more-link" data-expand="' + key + '">All ' + entries.length + ' →</button>' : '') + '</section>';
  }
  function sortCount(m) { return Array.from(m).sort(function (a, b) { return b[1] - a[1] || String(a[0]).localeCompare(String(b[0])); }); }

  function timeline(list, D, F, name) {
    var level = F.d ? 'day' : F.m && F.y ? 'day' : F.y ? 'month' : 'year';
    var dated = list.filter(function (w, i) { return D[i].d; });
    var cols = [];
    if (level === 'year') {
      var ys = dated.map(function (w) { return Number(w.date.slice(0, 4)); });
      if (!ys.length) return '';
      var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      for (var y = lo; y <= hi; y++) cols.push({ k: 'y', v: String(y), label: String(y), n: 0 });
      dated.forEach(function (w) { cols[Number(w.date.slice(0, 4)) - lo].n++; });
    } else if (level === 'month') {
      for (var m = 1; m <= 12; m++) cols.push({ k: 'm', v: String(m), label: MONTHS[m - 1], n: 0 });
      dated.forEach(function (w) { cols[Number(w.date.slice(5, 7)) - 1].n++; });
    } else {
      var yy = Number(F.y || (F.d || '').slice(0, 4)), mm = Number(F.m || (F.d || '').slice(5, 7));
      var days = new Date(yy, mm, 0).getDate();
      for (var d = 1; d <= days; d++) { var iso = yy + '-' + String(mm).padStart(2, '0') + '-' + String(d).padStart(2, '0'); cols.push({ k: 'd', v: iso, label: String(d), n: 0 }); }
      dated.forEach(function (w) { var i = Number(w.date.slice(8, 10)) - 1; if (cols[i] && w.date.slice(0, 7) === cols[i].v.slice(0, 7)) cols[i].n++; });
    }
    var max = Math.max(1, Math.max.apply(null, cols.map(function (c) { return c.n; })));
    var title = level === 'year' ? 'Watches by year' : level === 'month' ? 'Watches by month, ' + F.y : 'Watches by day, ' + MONTHS_L[Number(F.m || (F.d || '').slice(5, 7)) - 1] + ' ' + (F.y || (F.d || '').slice(0, 4));
    var every = cols.length > 16 ? Math.ceil(cols.length / 8) : 1;
    return '<section class="mv-card-c mv-wide"><h3>' + esc(title) + '<small>Click a bar to look inside it</small></h3>' +
      '<div class="mv-vbars" style="--n:' + cols.length + '">' + cols.map(function (c, i) {
        var on = F[c.k] === c.v;
        return '<button type="button" class="' + (on ? 'on' : '') + (c.n ? '' : ' zero') + '" data-k="' + c.k + '" data-v="' + c.v + '" data-tip="' + esc(name(c.k, c.v) + ' · ' + c.n + ' watch' + (c.n === 1 ? '' : 'es')) + '" aria-label="' + esc(name(c.k, c.v) + ': ' + c.n) + '">' +
          '<span class="v">' + (c.n && cols.length <= 16 ? c.n : '') + '</span><i style="height:' + (c.n ? Math.max(3, 100 * c.n / max) : 0).toFixed(1) + '%"></i><span class="x">' + (i % every === 0 ? esc(c.label) : '') + '</span></button>';
      }).join('') + '</div></section>';
  }

  function heatmap(list, D, F) {
    var dated = list.filter(function (w, i) { return D[i].d; });
    if (!dated.length) return '';
    var yr = Number(F.y || (F.d || '').slice(0, 4)) || Number(dated[0].date.slice(0, 4));
    var per = {};
    dated.forEach(function (w) { if (w.date.slice(0, 4) === String(yr)) per[w.date] = (per[w.date] || 0) + 1; });
    var start = new Date(yr, 0, 1), lead = (start.getDay() + 6) % 7, days = (new Date(yr + 1, 0, 1) - start) / 864e5;
    var cells = '', monthLabels = '';
    for (var i = 0; i < lead; i++) cells += '<span class="pad"></span>';
    for (var d = 0; d < days; d++) {
      var dt = new Date(yr, 0, 1 + d), iso = yr + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      var n = per[iso] || 0, lvl = n >= 3 ? 3 : n;
      if (dt.getDate() === 1) monthLabels += '<span style="grid-column:' + (Math.floor((d + lead) / 7) + 1) + '">' + MONTHS[dt.getMonth()] + '</span>';
      cells += '<button type="button" class="l' + lvl + (F.d === iso ? ' on' : '') + '" data-k="d" data-v="' + iso + '" data-tip="' + esc(dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + (n ? n + ' watch' + (n === 1 ? '' : 'es') : 'nothing')) + '" aria-label="' + iso + ': ' + n + '"></button>';
    }
    return '<section class="mv-card-c mv-wide"><h3>Every day of ' + yr + '<small class="mv-key">Less <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i> More</small></h3>' +
      '<div class="mv-heat-w"><div class="mv-heat-m">' + monthLabels + '</div><div class="mv-heat">' + cells + '</div></div></section>';
  }

  function streaks(list) {
    var ds = Array.from(new Set(list.map(function (w) { return w.date; }).filter(Boolean))).sort();
    var best = 0, run = 0, prev = null;
    ds.forEach(function (d) { var t = Date.parse(d + 'T12:00:00Z'); run = prev && t - prev === 864e5 ? run + 1 : 1; best = Math.max(best, run); prev = t; });
    return best;
  }

  function disagreements(list) {
    var rows = list.filter(function (w) { return w.rating != null && w.film && w.film.iv; }).map(function (w) { return { w: w, gap: w.rating * 2 - w.film.iv }; });
    var seen = new Set(); rows = rows.sort(function (a, b) { return Math.abs(b.gap) - Math.abs(a.gap); }).filter(function (r) { if (seen.has(r.w.tmdb)) return false; seen.add(r.w.tmdb); return true; }).slice(0, 8);
    if (!rows.length) return '';
    return '<section class="mv-card-c"><h3>Where I disagree with IMDb<small>My stars × 2 against the IMDb score</small></h3><ul class="mv-dis">' + rows.map(function (r) {
      var f = r.w.film;
      return '<li><a href="#/m/' + r.w.tmdb + '">' + esc(f.t) + ' <i>' + (f.y || '') + '</i></a><span class="me">' + App.stars(r.w.rating) + '</span><span class="vs">IMDb ' + f.iv.toFixed(1) + '</span><b class="' + (r.gap > 0 ? 'up' : 'down') + '">' + (r.gap > 0 ? '+' : '−') + Math.abs(r.gap).toFixed(1) + '</b></li>';
    }).join('') + '</ul></section>';
  }

  function filmList(list, sort, mode) {
    var rows = list.slice();
    if (sort === 'mine') rows.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    else if (sort === 'imdb') rows.sort(function (a, b) { return ((b.film || {}).iv || 0) - ((a.film || {}).iv || 0); });
    else if (sort === 'year') rows.sort(function (a, b) { return ((b.film || {}).y || 0) - ((a.film || {}).y || 0); });
    else if (sort === 'old') rows.reverse();
    if (mode === 'table') {
      return '<div class="mv-table-w"><table class="mv-table"><thead><tr><th>Watched</th><th>Film</th><th>Year</th><th>Language</th><th>Mine</th><th>IMDb</th><th>Where</th></tr></thead><tbody>' +
        rows.map(function (w) { var f = w.film || {}; return '<tr><td>' + esc(w.date || '—') + '</td><td><a href="#/m/' + w.tmdb + '">' + esc(f.t) + '</a>' + (w.rewatch ? ' ↻' : '') + '</td><td>' + (f.y || '') + '</td><td>' + esc(App.langName(f.l)) + '</td><td class="mv-st">' + App.stars(w.rating) + '</td><td>' + (f.iv ? f.iv.toFixed(1) : '') + '</td><td>' + esc(w.where) + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
    }
    return '<div class="mv-grid">' + rows.map(function (w) { var f = w.film || {}; return App.cardHTML({ id: w.tmdb, t: f.t, y: f.y, l: f.l, p: f.p, v: null }, (w.date ? w.date.slice(5).split('-').reverse().join('/') : '') + (w.rating != null ? ' ' + App.stars(w.rating) : '')); }).join('') + '</div>';
  }

  // ---------- the page ----------
  var expanded = {};
  function render(view, all, qs) {
    var F = {};
    new URLSearchParams(qs || '').forEach(function (v, k) { if (KEYS.indexOf(k) >= 0 && v) F[k] = v; });
    var name = namer(all);
    var D = all.map(dims);
    var idx = all.map(function (w, i) { return i; }).filter(function (i) { return pass(D[i], F); });
    var list = idx.map(function (i) { return all[i]; }), LD = idx.map(function (i) { return D[i]; });
    // each breakdown ignores its own filter, so the chosen bar stays visible among the others
    var forKey = function (k) { var ii = all.map(function (w, i) { return i; }).filter(function (i) { return pass(D[i], F, k); }); return { l: ii.map(function (i) { return all[i]; }), d: ii.map(function (i) { return D[i]; }) }; };
    var by = function (k) { var s = forKey(k); return sortCount(count(s.l, k, s.d)); };

    if (!all.length) {
      view.innerHTML = '<section class="mv-mypage"><h1 class="mv-h1">Dashboard</h1><div class="mv-empty"><h2>Nothing to show yet</h2><p>Log films as you watch them, or import your Letterboxd or IMDb history from the <a href="#/diary">Diary</a>.</p></div></section>';
      return;
    }
    var films = new Set(list.map(function (w) { return w.tmdb; })).size;
    var mins = list.reduce(function (s, w) { return s + ((w.film || {}).rt || 0); }, 0);
    var rated = list.filter(function (w) { return w.rating != null; });
    var avg = rated.length ? rated.reduce(function (s, w) { return s + w.rating; }, 0) / rated.length : null;
    var thisYear = String(new Date().getFullYear());
    var yearCount = all.filter(function (w) { return w.date && w.date.slice(0, 4) === thisYear; }).length;
    var monthCount = all.filter(function (w) { return w.date && w.date.slice(0, 7) === new Date().toISOString().slice(0, 7); }).length;
    var stat = function (v, k, sub) { return '<div class="mv-stat"><b>' + v + '</b><span>' + k + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var chips = Object.keys(F).map(function (k) { return '<button type="button" class="mv-fchip" data-rm="' + k + '">' + LABEL[k] + ': <b>' + esc(name(k, F[k])) + '</b> <span aria-hidden="true">×</span><span class="sr">remove</span></button>'; }).join('');
    var weekEntries = WEEK.map(function (d, i) { var m = count(forKey('wd').l, 'wd', forKey('wd').d); return [String(i), m.get(String(i)) || 0]; }).filter(function (e) { return e[1]; });
    var rateEntries = (function () { var m = count(forKey('r').l, 'r', forKey('r').d); return [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map(function (r) { return [String(r), m.get(String(r)) || 0]; }).filter(function (e) { return e[1]; }); })();
    var runEntries = (function () { var m = count(forKey('rt').l, 'rt', forKey('rt').d); return RUN.map(function (r) { return [r[0], m.get(r[0]) || 0]; }).filter(function (e) { return e[1]; }); })();
    var decEntries = by('dec').sort(function (a, b) { return Number(b[0]) - Number(a[0]); });
    var sort = App.store.get('dashSort', 'new'), mode = App.store.get('dashMode', 'grid');
    var keep = window.scrollY;

    view.innerHTML = '<section class="mv-mypage mv-dash">' +
      '<div class="mv-my-h"><h1 class="mv-h1">Dashboard</h1><p class="mv-meta">' + yearCount + ' this year · ' + monthCount + ' this month</p></div>' +
      '<div class="mv-fbar">' + (chips ? chips + '<button type="button" class="mv-clear" data-clear>Clear all</button>' : '<span class="mv-hint">Everything I’ve logged. Click any bar or square to narrow it down.</span>') + '</div>' +
      '<div class="mv-stats">' +
        stat(films, films === 1 ? 'film' : 'films') + stat(list.length, list.length === 1 ? 'watch' : 'watches') +
        stat(Math.round(mins / 60).toLocaleString('en'), 'hours') +
        stat(list.filter(function (w) { return w.rewatch; }).length, 'rewatches') +
        stat(avg != null ? avg.toFixed(1) : '—', 'average stars', rated.length ? rated.length + ' rated' : '') +
        stat(streaks(list), 'day best streak') +
      '</div>' +
      timeline(list, LD, F, name) + heatmap(list, LD, F) +
      '<div class="mv-cols">' +
        bars('Genres', 'g', by('g'), name, F, { all: expanded.g }) +
        bars('Languages', 'l', by('l'), name, F, { all: expanded.l }) +
        bars('Countries', 'c', by('c'), name, F, { all: expanded.c }) +
        bars('Release decade', 'dec', decEntries, name, F, { all: true }) +
        bars('Directors', 'dir', by('dir'), name, F, { all: expanded.dir }) +
        bars('Actors', 'act', by('act'), name, F, { all: expanded.act }) +
        bars('My ratings', 'r', rateEntries, name, F, { all: true }) +
        bars('Where I watched', 'w', by('w'), name, F, { all: expanded.w }) +
        bars('Day of the week', 'wd', weekEntries, name, F, { all: true }) +
        bars('Film length', 'rt', runEntries, name, F, { all: true }) +
        bars('First watch or rewatch', 'rw', by('rw'), name, F, { all: true }) +
        disagreements(list) +
      '</div>' +
      '<section class="mv-block"><div class="mv-list-h"><h2 class="mv-h2">' + (chips ? 'These ' : 'All ') + list.length + ' watch' + (list.length === 1 ? '' : 'es') + '</h2>' +
        '<label><span class="sr">Sort</span><select id="dSort">' + [['new', 'Newest watched'], ['old', 'Oldest watched'], ['mine', 'My rating'], ['imdb', 'IMDb rating'], ['year', 'Release year']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sort ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<div class="mv-seg" role="group" aria-label="Show as"><button type="button" data-mode="grid" aria-pressed="' + (mode === 'grid') + '">Posters</button><button type="button" data-mode="table" aria-pressed="' + (mode === 'table') + '">Table</button></div></div>' +
        '<div id="dList">' + filmList(list, sort, mode) + '</div></section>' +
    '</section>';
    window.scrollTo(0, keep);

    var setF = function (next) {
      var p = new URLSearchParams();
      KEYS.forEach(function (k) { if (next[k]) p.set(k, next[k]); });
      var s = p.toString();
      history.replaceState(null, '', '#/dash' + (s ? '?' + s : ''));
      render(view, all, s);
    };
    view.querySelectorAll('[data-k]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-k'), v = b.getAttribute('data-v'), next = Object.assign({}, F);
        if (next[k] === v) { delete next[k]; if (k === 'y') { delete next.m; delete next.d; } if (k === 'm') delete next.d; }
        else {
          next[k] = v;
          if (k === 'd') { next.y = v.slice(0, 4); next.m = String(Number(v.slice(5, 7))); }
          if (k === 'y' && F.y !== v) { delete next.m; delete next.d; }
          if (k === 'm') delete next.d;
        }
        setF(next);
      };
    });
    $$('[data-rm]', view).forEach(function (b) {
      b.onclick = function () { var k = b.getAttribute('data-rm'), next = Object.assign({}, F); delete next[k]; if (k === 'y') { delete next.m; delete next.d; } if (k === 'm') delete next.d; setF(next); };
    });
    var clr = $('[data-clear]', view); if (clr) clr.onclick = function () { setF({}); };
    $$('[data-expand]', view).forEach(function (b) { b.onclick = function () { expanded[b.getAttribute('data-expand')] = true; render(view, all, qs); }; });
    $('#dSort', view).onchange = function () { App.store.set('dashSort', this.value); $('#dList', view).innerHTML = filmList(list, this.value, App.store.get('dashMode', 'grid')); };
    $$('[data-mode]', view).forEach(function (b) {
      b.onclick = function () {
        App.store.set('dashMode', b.getAttribute('data-mode'));
        $$('[data-mode]', view).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        $('#dList', view).innerHTML = filmList(list, App.store.get('dashSort', 'new'), b.getAttribute('data-mode'));
      };
    });
  }

  // hover tooltips for any [data-tip] on the page
  var tip = document.getElementById('tip');
  document.addEventListener('mouseover', function (e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.getAttribute('data-tip'); tip.hidden = false;
    var r = t.getBoundingClientRect(), tw = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px';
    tip.style.top = (r.top + window.scrollY - tip.offsetHeight - 8) + 'px';
  });
  document.addEventListener('scroll', function () { tip.hidden = true; }, { passive: true });

  window.MoviesDash = { render: render };
})();
