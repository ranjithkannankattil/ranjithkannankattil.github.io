/* ============================================================
   MEETING TIME FINDER — productivity.html
   All time-zone maths goes through Intl (the browser's IANA
   database), so daylight saving is resolved per instant.
   ============================================================ */
(function () {
  'use strict';

  var CITIES = [
    { id: 'hou', name: 'Houston',    sub: 'Texas, USA',         tz: 'America/Chicago', abbr: ['CST', 'CDT'] },
    { id: 'lon', name: 'London',     sub: 'United Kingdom',     tz: 'Europe/London',   abbr: ['GMT', 'BST'] },
    { id: 'mil', name: 'Milan',      sub: 'Italy',              tz: 'Europe/Rome',     abbr: ['CET', 'CEST'] },
    { id: 'moz', name: 'Mozambique', sub: 'Maputo · Afungi',    tz: 'Africa/Maputo',   abbr: ['CAT', 'CAT'] },
    { id: 'blr', name: 'Bangalore',  sub: 'India',              tz: 'Asia/Kolkata',    abbr: ['IST', 'IST'] },
    { id: 'chn', name: 'China',      sub: 'Beijing · Shanghai', tz: 'Asia/Shanghai',   abbr: ['CST', 'CST'] },
    { id: 'seo', name: 'Seoul',      sub: 'South Korea',        tz: 'Asia/Seoul',      abbr: ['KST', 'KST'] }
  ];
  var STEP = 15;            // minutes per slider step
  var MIN = 60000;
  var LS_KEY = 'ranjithkb.meeting.v1';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------- time helpers ---------- */
  var fmts = {}, cache = new Map();
  function parts(tz, ms) {
    var key = tz + '|' + ms, hit = cache.get(key);
    if (hit) return hit;
    var f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }));
    var o = {};
    f.formatToParts(ms).forEach(function (p) { o[p.type] = p.value; });
    var r = { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, wd: o.weekday };
    r.ymd = r.y + '-' + pad(r.mo) + '-' + pad(r.d);
    if (cache.size > 20000) cache.clear();
    cache.set(key, r);
    return r;
  }
  function offset(tz, ms) {           // minutes east of UTC at that instant
    var t = Math.floor(ms / MIN) * MIN, p = parts(tz, t);
    return (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - t) / MIN;
  }
  function wallToUTC(tz, y, mo, d, h, mi) {
    var g = Date.UTC(y, mo - 1, d, h, mi);
    var t = g - offset(tz, g) * MIN;
    return g - offset(tz, t) * MIN;
  }
  function stdDst(tz, ms) {           // null = zone has no DST
    var y = parts(tz, ms).y;
    var a = offset(tz, Date.UTC(y, 0, 1, 12)), b = offset(tz, Date.UTC(y, 6, 1, 12));
    if (a === b) return null;
    return offset(tz, ms) === Math.max(a, b);
  }
  function abbr(c, ms) { var s = stdDst(c.tz, ms); return c.abbr[s ? 1 : 0]; }
  function fmtOff(m) {
    var a = Math.abs(m);
    return 'UTC' + (m < 0 ? '−' : '+') + Math.floor(a / 60) + (a % 60 ? ':' + pad(a % 60) : '');
  }
  function fmtHrs(m) {
    var a = Math.abs(m), h = Math.floor(a / 60), r = a % 60;
    return h + (r ? ':' + pad(r) : '') + ' h';
  }
  var hm = function (p) { return pad(p.h) + ':' + pad(p.mi); };
  var dayLabel = function (p) { return p.wd + ' ' + p.d + ' ' + MON[p.mo - 1]; };
  function addDays(ymd, n) {
    var a = ymd.split('-').map(Number);
    return new Date(Date.UTC(a[0], a[1] - 1, a[2] + n)).toISOString().slice(0, 10);
  }
  function dayDiff(a, b) {
    var x = a.split('-').map(Number), y = b.split('-').map(Number);
    return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 864e5);
  }
  var todayIn = function (tz) { return parts(tz, Math.floor(Date.now() / MIN) * MIN).ymd; };
  var fmtHour = function (h) { var w = Math.floor(h); return pad(w) + ':' + (h % 1 ? '30' : '00'); };

  /* ---------- state ---------- */
  var S = { date: null, base: 'mil', step: 0, len: 60, ws: 8, we: 18, flex: 1, off: [] };
  try {
    var saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved) ['base', 'len', 'ws', 'we', 'flex', 'off'].forEach(function (k) { if (saved[k] != null) S[k] = saved[k]; });
  } catch (e) { /* storage unavailable: defaults */ }

  var q = new URLSearchParams(location.search);
  if (q.get('base') && CITIES.some(function (c) { return c.id === q.get('base'); })) S.base = q.get('base');
  if (q.get('len') && +q.get('len') >= 15) S.len = clamp(Math.round(+q.get('len') / 15) * 15, 15, 240);
  var base = function () { return CITIES.filter(function (c) { return c.id === S.base; })[0]; };
  S.date = /^\d{4}-\d{2}-\d{2}$/.test(q.get('d') || '') ? q.get('d') : todayIn(base().tz);
  var urlTime = /^\d{4}$/.test(q.get('t') || '') ? q.get('t') : null;

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ base: S.base, len: S.len, ws: S.ws, we: S.we, flex: S.flex, off: S.off })); } catch (e) {}
  }

  /* ---------- core ---------- */
  var day;
  function computeDay() {
    var tz = base().tz, a = S.date.split('-').map(Number), b = addDays(S.date, 1).split('-').map(Number);
    var start = wallToUTC(tz, a[0], a[1], a[2], 0, 0), end = wallToUTC(tz, b[0], b[1], b[2], 0, 0);
    day = { start: start, end: end, steps: Math.round((end - start) / (STEP * MIN)) };
  }
  var isOff = function (c) { return S.off.indexOf(c.id) >= 0; };

  function statusAt(c, ms) {
    var p = parts(c.tz, ms);
    if (p.wd === 'Sat' || p.wd === 'Sun') return 'wkend';
    var lm = p.h * 60 + p.mi, ws = S.ws * 60, we = S.we * 60, fx = S.flex * 60;
    if (lm >= ws && lm < we) return 'work';
    if (lm >= ws - fx && lm < we + fx) return 'edge';
    return 'off';
  }
  var RANK = { work: 0, edge: 1, off: 2, wkend: 3 };
  function meetStatus(c, a, b) {
    var worst = 'work';
    for (var t = a; t < b; t += STEP * MIN) {
      var s = statusAt(c, t);
      if (RANK[s] > RANK[worst]) worst = s;
    }
    return worst;
  }
  function statusWord(c, s, a) {
    if (s === 'work') return 'In hours';
    if (s === 'wkend') return 'Weekend';
    var p = parts(c.tz, a), lm = p.h * 60 + p.mi;
    if (s === 'edge') return lm < S.ws * 60 ? 'Early' : 'Late';
    return (lm < 6 * 60 || lm >= 22 * 60) ? 'Night' : 'Off hours';
  }

  /* ---------- build static UI ---------- */
  var baseSel = $('baseSel');
  CITIES.forEach(function (c) {
    var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; baseSel.appendChild(o);
  });

  var sliders = {
    len:  { r: $('lenR'),  v: $('lenV'),  f: null },
    ws:  { r: $('wsR'),   v: $('wsV'),   f: fmtHour },
    we:   { r: $('weR'),   v: $('weV'),   f: fmtHour },
    flex: { r: $('flexR'), v: $('flexV'), f: function (x) { return x ? '±' + x + ' h' : 'No stretch'; } }
  };
  sliders.len.f = function (x) {
    if (x < 60) return x + ' min';
    var h = Math.floor(x / 60), m = x % 60;
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  };

  function syncSliders() {
    Object.keys(sliders).forEach(function (k) {
      sliders[k].r.value = S[k];
      sliders[k].v.textContent = sliders[k].f(S[k]);
      fill(sliders[k].r);
    });
    baseSel.value = S.base;
  }
  function fill(r) {
    var p = (r.value - r.min) / (r.max - r.min) * 100;
    r.style.setProperty('--p', p + '%');
  }

  /* ---------- rendering ---------- */
  var labelsEl = $('labels'), tracksEl = $('tracks'), timeR = $('timeR');

  function renderBoard() {
    computeDay();
    var b = base(), hours = Math.round(day.steps / 4);
    labelsEl.innerHTML = ''; tracksEl.innerHTML = '';
    tracksEl.style.setProperty('--n', hours);

    CITIES.forEach(function (c) {
      var lab = document.createElement('label');
      lab.className = 'mt-lab' + (c.id === S.base ? ' is-base' : '') + (isOff(c) ? ' is-off' : '');
      lab.innerHTML =
        '<input type="checkbox"' + (isOff(c) ? '' : ' checked') + ' data-id="' + c.id + '" aria-label="Include ' + c.name + ' in suggestions">' +
        '<span class="mt-lab-txt"><span class="mt-lab-n">' + c.name + '</span>' +
        '<span class="mt-lab-t mt-clock" data-now="' + c.id + '"></span></span>';
      labelsEl.appendChild(lab);

      var row = document.createElement('div');
      row.className = 'mt-row' + (c.id === S.base ? ' is-base' : '') + (isOff(c) ? ' is-off' : '');
      var html = '', lastYmd = null;
      for (var i = 0; i < hours; i++) {
        var t = day.start + i * 60 * MIN, p = parts(c.tz, t);
        var st = statusAt(c, t + 30 * MIN);
        var newDay = lastYmd !== null && p.ymd !== lastYmd;
        lastYmd = p.ymd;
        var txt = (p.h === 0 && p.mi === 0) || (newDay && p.h === 0) ? p.wd : (p.mi ? p.h + ':' + pad(p.mi) : String(p.h));
        html += '<button class="mt-c s-' + st + (newDay ? ' new-day' : '') + (p.mi ? ' half' : '') +
          '" data-i="' + i + '" tabindex="-1" title="' + c.name + ' ' + hm(p) + ', ' + dayLabel(p) + '"><span>' + txt + '</span></button>';
      }
      row.innerHTML = html;
      tracksEl.appendChild(row);
    });

    // now marker
    var now = Date.now(), nl = $('nowLine');
    if (now >= day.start && now < day.end) {
      nl.hidden = false;
      nl.style.left = ((now - day.start) / (day.end - day.start) * 100) + '%';
    } else nl.hidden = true;

    renderDate();
    renderClocks();
    renderBest();
    renderDst();
  }

  function renderDate() {
    var b = base(), p = parts(b.tz, day.start + 12 * 60 * MIN);
    $('dayMain').textContent = dayLabel(p) + ' ' + p.y;
    var diff = dayDiff(todayIn(b.tz), S.date);
    $('dayRel').textContent = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
      : (diff > 0 ? 'In ' + diff + ' days' : Math.abs(diff) + ' days ago');
    $('dateInput').value = S.date;
    $('todayBtn').disabled = diff === 0;
  }

  function renderSel() {
    var maxStep = day.steps - S.len / STEP;
    S.step = clamp(S.step, 0, maxStep);
    timeR.max = maxStep; timeR.value = S.step; fill(timeR);

    var a = day.start + S.step * STEP * MIN, z = a + S.len * MIN, b = base();
    var pa = parts(b.tz, a), pz = parts(b.tz, z);
    var box = $('selBox');
    box.style.left = (S.step / day.steps * 100) + '%';
    box.style.width = (S.len / STEP / day.steps * 100) + '%';
    $('selTag').textContent = hm(pa);

    $('pickTime').textContent = hm(pa) + ' – ' + hm(pz);
    $('pickSub').textContent = b.name + ' · ' + dayLabel(pa) + ' · ' + abbr(b, a) + ' ' + fmtOff(offset(b.tz, a));

    var list = $('cityList'), html = '', inHours = 0, counted = 0, misses = [];
    CITIES.forEach(function (c) {
      var ca = parts(c.tz, a), cz = parts(c.tz, z), st = meetStatus(c, a, z), off = offset(c.tz, a);
      var dd = dayDiff(pa.ymd, ca.ymd), dst = stdDst(c.tz, a);
      if (!isOff(c)) { counted++; if (st === 'work') inHours++; else misses.push(c.name + ' ' + statusWord(c, st, a).toLowerCase()); }
      html += '<li class="mt-li' + (isOff(c) ? ' is-off' : '') + (c.id === S.base ? ' is-base' : '') + '">' +
        '<div class="mt-li-city"><span class="mt-li-n">' + c.name + '</span><span class="mt-li-s">' + c.sub + '</span><span class="mt-li-now mt-clock" data-now="' + c.id + '"></span></div>' +
        '<div class="mt-li-time">' + hm(ca) + '<span>–' + hm(cz) + '</span></div>' +
        '<div class="mt-li-day">' + dayLabel(ca) + (dd ? ' <b class="mt-shift">' + (dd > 0 ? '+' : '−') + Math.abs(dd) + ' day</b>' : '') + '</div>' +
        '<div class="mt-li-zone">' + abbr(c, a) + ' · ' + fmtOff(off) +
          '<span>' + (dst === null ? 'No DST' : dst ? 'Summer time' : 'Standard time') + '</span></div>' +
        '<div class="mt-li-st"><span class="mt-chip s-' + st + '">' + statusWord(c, st, a) + '</span></div>' +
        '</li>';
    });
    list.innerHTML = html;
    renderClocks();

    var v = $('pickVerdict');
    if (!counted) v.textContent = 'No cities selected.';
    else if (inHours === counted) v.textContent = 'Everyone ' + (counted === CITIES.length ? '' : 'selected ') + 'is in working hours.';
    else v.textContent = inHours + ' of ' + counted + ' in hours — ' + misses.join(', ') + '.';
    v.className = 'mt-pick-verdict' + (counted && inHours === counted ? ' good' : '');

    writeUrl(pa);
  }

  function windows() {
    var inc = CITIES.filter(function (c) { return !isOff(c); });
    var n = S.len / STEP, out = [], cur = null;
    if (!inc.length) return out;
    for (var i = 0; i + n <= day.steps; i++) {
      var a = day.start + i * STEP * MIN, z = a + S.len * MIN;
      var st = inc.map(function (c) { return meetStatus(c, a, z); });
      var key = st.join(',');
      if (cur && cur.key === key && cur.last === i - 1) { cur.last = i; continue; }
      var w = 0, e = 0;
      st.forEach(function (s) { if (s === 'work') w++; else if (s === 'edge') e++; });
      cur = { key: key, first: i, last: i, w: w, e: e, st: st, inc: inc };
      out.push(cur);
    }
    return out;
  }

  var bestCache = [];
  function renderBest() {
    var all = windows().filter(function (w) { return w.w + w.e > 0; });
    all.sort(function (x, y) {
      return (y.w * 2 + y.e) - (x.w * 2 + x.e) || (y.last - y.first) - (x.last - x.first) || x.first - y.first;
    });
    bestCache = all.slice(0, 4);
    var el = $('best'), b = base();
    if (!bestCache.length) { el.innerHTML = '<li class="mt-empty">Nothing overlaps on this day. Try a stretch of an hour or two, or untick a city.</li>'; return; }
    el.innerHTML = bestCache.map(function (w, k) {
      var a = day.start + w.first * STEP * MIN, z = day.start + (w.last * STEP + S.len) * MIN;
      var total = w.inc.length, detail;
      if (w.w === total) detail = 'All ' + total + ' in working hours';
      else {
        var miss = [];
        w.st.forEach(function (s, j) { if (s !== 'work') miss.push(w.inc[j].name + ' ' + statusWord(w.inc[j], s, a).toLowerCase()); });
        detail = w.w + ' of ' + total + ' in hours · ' + miss.join(', ');
      }
      return '<li><button class="mt-win' + (w.w === total ? ' good' : '') + '" data-step="' + w.first + '">' +
        '<span class="mt-win-t">' + hm(parts(b.tz, a)) + ' – ' + hm(parts(b.tz, z)) + ' <em>' + b.name + '</em></span>' +
        '<span class="mt-win-d">' + detail + '</span></button></li>';
    }).join('');
  }

  function transitions(c, from, to) {
    var res = [], H6 = 6 * 60 * MIN, prev = offset(c.tz, from);
    for (var t = from + H6; t <= to; t += H6) {
      var o = offset(c.tz, t);
      if (o !== prev) {
        var lo = t - H6, hi = t;
        while (hi - lo > MIN) {
          var mid = lo + Math.floor((hi - lo) / MIN / 2) * MIN;
          if (offset(c.tz, mid) === prev) lo = mid; else hi = mid;
        }
        res.push({ c: c, at: hi, from: prev, to: o });
        prev = o;
      }
    }
    return res;
  }

  function renderDst() {
    var from = day.start - 7 * 864e5, to = day.start + 28 * 864e5, b = base(), groups = {};
    CITIES.forEach(function (c) {
      transitions(c, from, to).forEach(function (tr) { (groups[tr.at] = groups[tr.at] || []).push(tr); });
    });
    var keys = Object.keys(groups).map(Number).sort(function (x, y) { return x - y; });
    var el = $('dst');
    if (!keys.length) { el.innerHTML = '<li class="mt-empty">No clock changes from a week before this date to four weeks after.</li>'; return; }
    el.innerHTML = keys.map(function (at) {
      var g = groups[at], c0 = g[0].c, p = parts(c0.tz, at), past = at <= day.start;
      var delta = g[0].to - g[0].from, dir = delta < 0 ? 'back' : 'forward';
      var names = g.map(function (x) { return x.c.name; });
      var who = names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : names[0];
      var zones = g.map(function (x) { return x.c.abbr[delta < 0 ? 1 : 0] + ' → ' + x.c.abbr[delta < 0 ? 0 : 1]; }).join(', ');
      var inDay = at >= day.start && at < day.end;
      // effect on gaps from the base city
      var fx = [];
      CITIES.forEach(function (c) {
        if (c.id === b.id) return;
        var before = offset(c.tz, at - MIN) - offset(b.tz, at - MIN), after = offset(c.tz, at) - offset(b.tz, at);
        if (before !== after) {
          var side = function (m) { return m === 0 ? 'same time' : fmtHrs(m) + (m > 0 ? ' ahead' : ' behind'); };
          fx.push(c.name + ': ' + side(before) + ' → ' + side(after));
        }
      });
      return '<li class="' + (past ? 'past' : '') + (inDay ? ' today' : '') + '">' +
        '<div class="mt-dst-d">' + dayLabel(p) + (inDay ? ' <b>this day</b>' : '') + '</div>' +
        '<div class="mt-dst-w">' + who + ' ' + (past ? 'went' : names.length > 1 ? 'go' : 'goes') + ' ' + dir + ' 1 h <span>(' + zones + ')</span></div>' +
        (fx.length ? '<div class="mt-dst-fx">From ' + b.name + ' — ' + fx.join(' · ') + '</div>' : '') +
        '</li>';
    }).join('');
  }

  function writeUrl(pa) {
    var p = new URLSearchParams();
    p.set('d', S.date); p.set('t', pad(pa.h) + pad(pa.mi));
    if (S.base !== 'mil') p.set('base', S.base);
    if (S.len !== 60) p.set('len', S.len);
    try { history.replaceState(null, '', location.pathname + '?' + p.toString() + location.hash); } catch (e) {}
  }

  /* ---------- live clocks ---------- */
  function renderClocks() {
    var now = Math.floor(Date.now() / MIN) * MIN;
    CITIES.forEach(function (c) {
      var p = parts(c.tz, now);
      var html = '<b>' + hm(p) + '</b> ' + p.wd + ' ' + p.d + '<span class="mt-mon"> ' + MON[p.mo - 1] + '</span>';
      document.querySelectorAll('[data-now="' + c.id + '"]').forEach(function (el) {
        el.innerHTML = html;
        el.title = 'Now in ' + c.name + ': ' + hm(p) + ', ' + dayLabel(p) + ' ' + p.y + ' (' + abbr(c, now) + ')';
      });
    });
    var nl = $('nowLine'), t = Date.now();
    if (day && t >= day.start && t < day.end) { nl.hidden = false; nl.style.left = ((t - day.start) / (day.end - day.start) * 100) + '%'; }
    else if (day) nl.hidden = true;
  }
  function tick() { renderClocks(); setTimeout(tick, MIN - (Date.now() % MIN) + 50); }

  /* ---------- actions ---------- */
  function keepWallTime(fn) {           // change something, keep the same base clock time selected
    var p = parts(base().tz, day.start + S.step * STEP * MIN);
    fn();
    computeDay();
    var a = S.date.split('-').map(Number);
    S.step = Math.round((wallToUTC(base().tz, a[0], a[1], a[2], p.h, p.mi) - day.start) / (STEP * MIN));
    renderBoard(); renderSel();
  }
  function moveDays(n) { keepWallTime(function () { S.date = addDays(S.date, n); }); }

  document.querySelectorAll('.mt-step').forEach(function (btn) {
    btn.addEventListener('click', function () { moveDays(+btn.dataset.days); });
  });
  $('todayBtn').addEventListener('click', function () { keepWallTime(function () { S.date = todayIn(base().tz); }); });
  $('dateInput').addEventListener('change', function (e) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) keepWallTime(function () { S.date = e.target.value; });
  });
  baseSel.addEventListener('change', function () {
    // keep the same instant, re-expressed in the new base city's day
    var inst = day.start + S.step * STEP * MIN;
    S.base = baseSel.value; save();
    S.date = parts(base().tz, inst).ymd;
    computeDay();
    S.step = Math.round((inst - day.start) / (STEP * MIN));
    renderBoard(); renderSel();
  });

  timeR.addEventListener('input', function () { S.step = +timeR.value; renderSel(); });

  Object.keys(sliders).forEach(function (k) {
    sliders[k].r.addEventListener('input', function () {
      S[k] = +sliders[k].r.value;
      if (k === 'ws' && S.we - S.ws < 1) S.we = S.ws + 1;
      if (k === 'we' && S.we - S.ws < 1) S.ws = S.we - 1;
      S.ws = clamp(S.ws, 5, 12); S.we = clamp(S.we, 13, 22);
      syncSliders(); save();
      renderBoard(); renderSel();
    });
  });

  labelsEl.addEventListener('change', function (e) {
    var id = e.target.dataset && e.target.dataset.id;
    if (!id) return;
    if (e.target.checked) S.off = S.off.filter(function (x) { return x !== id; });
    else if (S.off.indexOf(id) < 0) S.off.push(id);
    save(); renderBoard(); renderSel();
  });
  tracksEl.addEventListener('click', function (e) {
    var c = e.target.closest('.mt-c');
    if (!c) return;
    S.step = +c.dataset.i * 4; renderSel();
  });
  $('best').addEventListener('click', function (e) {
    var w = e.target.closest('.mt-win');
    if (!w) return;
    S.step = +w.dataset.step; renderSel();
  });

  document.addEventListener('keydown', function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft') { moveDays(e.shiftKey ? -7 : -1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { moveDays(e.shiftKey ? 7 : 1); e.preventDefault(); }
  });

  $('copyBtn').addEventListener('click', function () {
    var a = day.start + S.step * STEP * MIN, z = a + S.len * MIN, b = base(), pb = parts(b.tz, a);
    var lines = [dayLabel(pb) + ' ' + pb.y + ' · ' + sliders.len.f(S.len)];
    CITIES.forEach(function (c) {
      if (isOff(c)) return;
      var ca = parts(c.tz, a), cz = parts(c.tz, z);
      lines.push(c.name + '  ' + hm(ca) + '–' + hm(cz) + ' ' + abbr(c, a) + (ca.ymd !== pb.ymd ? ' (' + dayLabel(ca) + ')' : ''));
    });
    var text = lines.join('\n'), btn = $('copyBtn');
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy times for an invite'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      ta.remove();
    }
  });

  /* ---------- start ---------- */
  syncSliders();
  computeDay();
  if (urlTime) {
    var a = S.date.split('-').map(Number);
    S.step = Math.round((wallToUTC(base().tz, a[0], a[1], a[2], +urlTime.slice(0, 2), +urlTime.slice(2)) - day.start) / (STEP * MIN));
  }
  renderBoard();
  if (!urlTime) {
    S.step = bestCache.length ? bestCache[0].first
      : Math.ceil((Date.now() - day.start) / (STEP * MIN));
  }
  renderSel();
  tick();
})();
