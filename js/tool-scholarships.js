/* ============================================================
   TOOL — Scholarship finder  (productivity/scholarships.html)
   Filters the list in js/scholarships-data.js. Nothing typed
   here leaves the browser; filters live in the page address so
   a search can be shared.
   ============================================================ */
(function () {
  'use strict';
  var ALL = window.SCHOLARSHIPS, REGIONS = window.SCHOLARSHIP_REGIONS, WATCH = window.SCHOLARSHIP_WATCH;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var LEVEL = { ug: 'Bachelor’s', masters: 'Master’s', phd: 'PhD & research' };
  var FUND = { full: 'Full funding', part: 'Part funding', check: 'Check funding' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var day = function (iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var pretty = function (iso) { var d = day(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  var daysTo = function (iso) { return Math.round((day(iso) - today) / 864e5); };

  // open | upcoming | closed | varies, worked out from today's date
  function status(s) {
    if (s.closes && daysTo(s.closes) < 0) return { k: 'closed', label: 'Closed' };
    if (s.opens && daysTo(s.opens) > 0) return { k: 'upcoming', label: 'Opens ' + pretty(s.opens) };
    if (s.closes) {
      var n = daysTo(s.closes);
      return { k: 'open', label: n === 0 ? 'Closes today' : 'Open · ' + n + (n === 1 ? ' day left' : ' days left') };
    }
    if (s.state === 'closed') return { k: 'closed', label: 'Closed' };
    if (s.state === 'upcoming') return { k: 'upcoming', label: 'Opening soon' };
    return { k: 'varies', label: 'Dates vary' };
  }
  var ORDER = { open: 0, upcoming: 1, varies: 2, closed: 3 };
  function rank(a, b) {
    var sa = status(a), sb = status(b);
    if (ORDER[sa.k] !== ORDER[sb.k]) return ORDER[sa.k] - ORDER[sb.k];
    if (sa.k === 'open') return daysTo(a.closes) - daysTo(b.closes);
    if (sa.k === 'upcoming' && a.opens && b.opens) return daysTo(a.opens) - daysTo(b.opens);
    if (a.funding !== b.funding) return a.funding === 'full' ? -1 : b.funding === 'full' ? 1 : 0;
    return a.name.localeCompare(b.name);
  }

  var PAGE = {};   // official-page status from the daily GitHub check
  var state = { region: '', country: '', level: '', funding: '', q: '', age: '', work: '', open: false };

  function ageLimit(s) {
    if (s.ageBy) {
      if (state.level && s.ageBy[state.level] != null) return s.ageBy[state.level];
      return Math.max.apply(null, Object.keys(s.ageBy).map(function (k) { return s.ageBy[k]; }));
    }
    return s.maxAge;
  }
  function match(s) {
    if (state.region && s.regions.indexOf(state.region) < 0 && s.regions.indexOf('any') < 0) return false;
    if (state.country && s.countries.indexOf(state.country) < 0 && s.countries.indexOf('Any country') < 0) return false;
    if (state.level && s.levels.indexOf(state.level) < 0) return false;
    if (state.funding && s.funding !== state.funding) return false;
    if (state.open) { var k = status(s).k; if (k !== 'open' && k !== 'upcoming') return false; }
    var lim = ageLimit(s);
    if (state.age !== '' && lim != null && +state.age > lim) return false;
    if (state.work !== '' && s.minWork && +state.work < s.minWork) return false;
    if (state.q) {
      var hay = (s.name + ' ' + s.by + ' ' + s.place + ' ' + s.amount + ' ' + s.who).toLowerCase();
      if (!state.q.toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) >= 0; })) return false;
    }
    return true;
  }

  // Android: try the LinkedIn app first, and use the browser if it isn't installed.
  // Other phones get the normal link, which their system may hand to the app.
  function linkedInLink(q) {
    var path = 'www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(q);
    var web = 'https://' + path;
    if (/Android/i.test(navigator.userAgent)) {
      return '<a href="intent://' + esc(path) + '#Intent;scheme=https;package=com.linkedin.android;S.browser_fallback_url=' + encodeURIComponent(web) + ';end" rel="nofollow">Search on LinkedIn ↗</a>';
    }
    return '<a href="' + esc(web) + '" target="_blank" rel="noopener nofollow">Search on LinkedIn ↗</a>';
  }

  function peopleLinks(s) {
    var q = (window.SCHOLARSHIP_PEOPLE || {})[s.id] || '"' + s.name + '" India';
    var page = (window.SCHOLARSHIP_PEOPLE_PAGES || {})[s.id];
    return (page ? '<a href="' + esc(page) + '" target="_blank" rel="noopener">Official scholar list ↗</a>' : '') +
      linkedInLink(q);
  }

  function card(s) {
    var st = status(s);
    var canSave = s.closes && daysTo(s.closes) >= 0;
    var soon = st.k === 'open' && daysTo(s.closes) <= 30;
    var pg = PAGE[s.url] || {};
    var read = pg.checked && pg.checked > s.checked ? pg.checked : s.checked;
    var moved = pg.changed && pg.changed > s.checked;
    return '<li class="sc-card">' +
      '<div class="sc-top"><span class="sc-status ' + st.k + (soon ? ' soon' : '') + '">' + esc(st.label) + '</span><span class="sc-fund ' + s.funding + '">' + FUND[s.funding] + '</span></div>' +
      '<h3>' + esc(s.name) + '</h3>' +
      (moved ? '<p class="sc-changed">The official page changed on ' + pretty(pg.changed) + '. Details here may be out of date.</p>' : '') +
      '<p class="sc-by">' + esc(s.by) + ' · ' + esc(s.place) + '</p>' +
      '<p class="sc-levels">' + s.levels.map(function (l) { return LEVEL[l]; }).join(' · ') + '</p>' +
      '<dl>' +
      '<dt>What you get</dt><dd>' + esc(s.amount) + '</dd>' +
      '<dt>Who can apply</dt><dd>' + esc(s.who) + '</dd>' +
      '<dt>How to apply</dt><dd>' + esc(s.how) + '</dd>' +
      '<dt>Dates</dt><dd>' + esc(s.when) + '</dd>' +
      '<dt>Meet past scholars</dt><dd class="sc-people">' + peopleLinks(s) + '</dd>' +
      '</dl>' +
      '<div class="sc-acts">' +
      '<a class="sc-go" href="' + esc(s.url) + '" target="_blank" rel="noopener">Official page ↗</a>' +
      (canSave ? '<button class="sc-cal" type="button" data-cal="' + esc(s.id) + '">Add deadline to calendar</button>' : '') +
      '</div>' +
      '<p class="sc-checked">Official page last read ' + pretty(read) + '</p>' +
      (s.found ? '<p class="sc-checked">Added by the weekly search on ' + pretty(s.found) + '. Confirm the details on the official page.</p>' : '') +
      '</li>';
  }

  function render() {
    var list = ALL.filter(match).sort(rank);
    $('scList').innerHTML = list.map(card).join('');
    $('scNone').hidden = list.length > 0;
    var open = list.filter(function (s) { return status(s).k === 'open'; }).length;
    $('scCount').textContent = list.length + (list.length === 1 ? ' scholarship' : ' scholarships') + (open ? ' · ' + open + ' open now' : '');
    syncUrl();
  }

  function syncUrl() {
    var p = new URLSearchParams();
    ['region', 'country', 'level', 'funding', 'q', 'age', 'work'].forEach(function (k) { if (state[k] !== '') p.set(k, state[k]); });
    if (state.open) p.set('open', '1');
    var qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  function readUrl() {
    var p = new URLSearchParams(location.search);
    if (REGIONS.some(function (r) { return r.id === p.get('region'); })) state.region = p.get('region');
    state.country = (p.get('country') || '').slice(0, 40);
    if (LEVEL[p.get('level')]) state.level = p.get('level');
    if (FUND[p.get('funding')]) state.funding = p.get('funding');
    state.q = (p.get('q') || '').slice(0, 80);
    if (/^\d{1,2}$/.test(p.get('age') || '')) state.age = p.get('age');
    if (/^\d{1,2}$/.test(p.get('work') || '')) state.work = p.get('work');
    state.open = p.get('open') === '1';
  }

  function drawRegions() {
    var items = [{ id: '', name: 'All regions' }].concat(REGIONS);
    $('scRegions').innerHTML = items.map(function (r) {
      return '<button type="button" data-region="' + r.id + '" aria-pressed="' + (state.region === r.id) + '">' + esc(r.name) + '</button>';
    }).join('');
  }

  // countries on offer for the chosen continent
  function drawCountries() {
    var seen = {};
    ALL.forEach(function (s) {
      if (state.region && s.regions.indexOf(state.region) < 0) return;
      s.countries.forEach(function (c) { if (c !== 'Any country') seen[c] = 1; });
    });
    var names = Object.keys(seen).sort();
    if (names.indexOf(state.country) < 0) state.country = '';
    $('scCountry').innerHTML = '<option value="">All countries</option>' + names.map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
    $('scCountry').value = state.country;
  }

  function saveIcs(s) {
    var d = s.closes.replace(/-/g, ''), e = day(s.closes);
    e.setDate(e.getDate() + 1);
    var end = e.getFullYear() + ('0' + (e.getMonth() + 1)).slice(-2) + ('0' + e.getDate()).slice(-2);
    var clean = function (t) { return t.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n'); };
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ranjithkb.com//Scholarship finder//EN', 'BEGIN:VEVENT',
      'UID:' + s.id + '-' + d + '@ranjithkb.com', 'DTSTAMP:' + d + 'T000000Z', 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + end,
      'SUMMARY:' + clean(s.name + ' deadline'), 'DESCRIPTION:' + clean(s.when + ' Confirm on the official page: ' + s.url),
      'URL:' + s.url,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + clean(s.name + ' deadline in 7 days'), 'TRIGGER:-P7D', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = s.id + '-deadline.ics';
    document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // ---------- wire up ----------
  readUrl();
  drawRegions();
  drawCountries();
  $('scLevel').value = state.level;
  $('scFunding').value = state.funding;
  $('scQ').value = state.q;
  $('scAge').value = state.age;
  $('scWork').value = state.work;
  $('scOpen').checked = state.open;

  $('scRegions').addEventListener('click', function (e) {
    var b = e.target.closest('[data-region]');
    if (!b) return;
    state.region = b.getAttribute('data-region');
    drawRegions(); drawCountries(); render();
  });
  [['scCountry', 'country'], ['scLevel', 'level'], ['scFunding', 'funding'], ['scQ', 'q'], ['scAge', 'age'], ['scWork', 'work']].forEach(function (x) {
    $(x[0]).addEventListener('input', function (e) { state[x[1]] = e.target.value.trim(); render(); });
  });
  $('scOpen').addEventListener('change', function (e) { state.open = e.target.checked; render(); });
  $('scReset').addEventListener('click', function () {
    state = { region: '', country: '', level: '', funding: '', q: '', age: '', work: '', open: false };
    ['scLevel', 'scFunding', 'scQ', 'scAge', 'scWork'].forEach(function (id) { $(id).value = ''; });
    $('scOpen').checked = false;
    drawRegions(); drawCountries(); render();
  });
  $('scList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cal]');
    if (!b) return;
    var s = ALL.filter(function (x) { return x.id === b.getAttribute('data-cal'); })[0];
    if (s) saveIcs(s);
  });

  $('scWatch').innerHTML = WATCH.map(function (w) {
    return '<li><a href="' + esc(w.url) + '" target="_blank" rel="noopener">' + esc(w.name) + '</a> ' + esc(w.note) + '</li>';
  }).join('');
  $('scUnconfirmed').innerHTML = window.SCHOLARSHIP_UNCONFIRMED.map(function (u) {
    return '<li><a href="' + esc(u.url) + '" target="_blank" rel="noopener">' + esc(u.name) + '</a></li>';
  }).join('');
  render();

  // the date in the address makes sure each day's status file is fetched fresh
  fetch('../js/scholarships-status.json?d=' + now.toISOString().slice(0, 10))
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (d) { PAGE = d; render(); })
    .catch(function () {});
})();
