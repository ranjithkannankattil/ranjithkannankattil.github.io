/* ============================================================
   MOVIES — public side: search, film pages, related-film rows, people.
   Data comes from the movies-api Worker (worker/movies-api.js); nothing
   about visitors is stored. The owner's private log (js/movies-log.js)
   and dashboard (js/movies-dash.js) plug in through window.MoviesApp.
   Views (in the address after #):
     /                 home rows          /s/<words>[?exact]   search results
     /m/<id>           a film             /p/<id>[/<role>]     a person
     /diary  /watchlist  /dash[?filters]  owner only
   ============================================================ */
(function () {
  'use strict';
  var API = String(window.MOVIES_API || '').replace(/\/+$/, '');
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var view = $('#view');

  var LANGS = { en: 'English', ml: 'Malayalam', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', bn: 'Bengali', mr: 'Marathi', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', cn: 'Cantonese', it: 'Italian', fr: 'French', es: 'Spanish', de: 'German', pt: 'Portuguese', ru: 'Russian', tr: 'Turkish', fa: 'Persian', ar: 'Arabic', sv: 'Swedish', da: 'Danish', no: 'Norwegian', pl: 'Polish', th: 'Thai', id: 'Indonesian', nl: 'Dutch', el: 'Greek', he: 'Hebrew', hu: 'Hungarian', cs: 'Czech', fi: 'Finnish', ro: 'Romanian', uk: 'Ukrainian', tl: 'Tagalog', ur: 'Urdu', pa: 'Punjabi', gu: 'Gujarati', si: 'Sinhala', vi: 'Vietnamese', ms: 'Malay' };
  var CHIPS = ['all', 'en', 'ml', 'hi', 'ta', 'te', 'ko', 'ja', 'it', 'fr', 'es'];
  var langName = function (l) { return LANGS[l] || (l ? l.toUpperCase() : ''); };
  var REGIONS = { IT: 'Italy', GB: 'UK', IN: 'India', US: 'USA' };

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('mv.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('mv.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  // ---------- data ----------
  var memo = new Map();
  function api(path) {
    if (!API) return Promise.reject(new Error('noapi'));
    if (memo.has(path)) return memo.get(path);
    var p = fetch(API + path).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) { throw new Error(b.error || ('HTTP ' + r.status)); });
      return r.json();
    });
    memo.set(path, p);
    p.catch(function () { memo.delete(path); });
    return p;
  }
  var img = function (path, size) { return path ? API + '/img/' + (size || 'w185') + path : ''; };

  // ---------- owner hooks (js/movies-log.js fills window.MovieLog) ----------
  var log = function () { return window.MovieLog && window.MovieLog.owner ? window.MovieLog : null; };
  var seenIds = function () { var l = log(); return l ? l.watchedIds() : new Set(); };
  var hideSeen = function () { return !!log() && store.get('hideSeen', false); };

  // ---------- small formatters ----------
  var runtime = function (m) { if (!m) return ''; var h = Math.floor(m / 60), r = m % 60; return (h ? h + ' h ' : '') + (r ? r + ' min' : ''); };
  var money = function (n) { try { return new Intl.NumberFormat('en', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch (e) { return '$' + n; } };
  var compact = function (n) { try { return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch (e) { return String(n); } };
  var stars = function (r) { if (r == null) return ''; var full = Math.floor(r), half = r - full >= 0.5; return '★'.repeat(full) + (half ? '½' : ''); };

  function cardHTML(m, extra) {
    var seen = seenIds().has(m.id);
    return '<a class="mv-card' + (seen ? ' seen' : '') + '" href="#/m/' + m.id + '" data-id="' + m.id + '">' +
      '<span class="mv-poster">' + (m.p ? '<img loading="lazy" decoding="async" src="' + esc(img(m.p, 'w185')) + '" alt="">' : '<span class="mv-noposter">' + esc(m.t) + '</span>') +
      (m.v ? '<b class="mv-badge" title="TMDB rating">★ ' + m.v.toFixed(1) + '</b>' : '') +
      (seen ? '<i class="mv-seen" title="Watched">✓</i>' : '') + '</span>' +
      '<span class="mv-ct">' + esc(m.t) + '</span>' +
      '<span class="mv-cm">' + [m.y, langName(m.l)].filter(Boolean).join(' · ') + (extra ? ' · ' + esc(extra) : '') + '</span></a>';
  }
  function personCardHTML(p) {
    return '<a class="mv-person" href="#/p/' + p.id + '">' +
      '<span class="mv-face">' + (p.p ? '<img loading="lazy" src="' + esc(img(p.p, 'w185')) + '" alt="">' : '<span>' + esc((p.name || '?').slice(0, 1)) + '</span>') + '</span>' +
      '<span class="mv-ct">' + esc(p.name) + '</span><span class="mv-cm">' + esc(p.char || p.dept || (p.known || []).join(', ')) + '</span></a>';
  }

  function alertBox(t, ms) {
    var a = $('#alert'); a.textContent = t; a.hidden = !t;
    clearTimeout(alertBox.t); if (t && ms !== 0) alertBox.t = setTimeout(function () { a.hidden = true; }, ms || 5000);
  }
  function failHTML(e) {
    if (e && e.message === 'noapi') return '<div class="mv-empty"><h2>The film database isn’t connected yet</h2><p>This page needs its data service set up. Check back soon.</p></div>';
    return '<div class="mv-empty"><h2>Couldn’t load that</h2><p>' + esc(e && e.message || 'Network error') + ' — try again in a moment.</p><button class="mv-btn" type="button" onclick="location.reload()">Retry</button></div>';
  }
  var loading = '<div class="mv-loading" aria-label="Loading"><span></span><span></span><span></span></div>';

  // ---------- rows of films ----------
  function chipsHTML(active) {
    var more = Object.keys(LANGS).filter(function (l) { return CHIPS.indexOf(l) < 0; }).sort(function (a, b) { return langName(a).localeCompare(langName(b)); });
    return '<div class="mv-chips" role="group" aria-label="Language">' + CHIPS.map(function (l) {
      return '<button type="button" data-lang="' + l + '" aria-pressed="' + (active === l) + '">' + (l === 'all' ? 'All' : langName(l)) + '</button>';
    }).join('') + '<select aria-label="More languages" data-more><option value="">More…</option>' +
      more.map(function (l) { return '<option value="' + l + '"' + (active === l ? ' selected' : '') + '>' + langName(l) + '</option>'; }).join('') + '</select></div>';
  }

  // one row: {title, sub, kind, id, role, items?} — items given (home) or fetched (film page)
  function mountRow(holder, r, filmId) {
    var sec = document.createElement('section');
    sec.className = 'mv-row';
    var pageable = filmId && ['more', 'thread', 'thrill', 'genre', 'world', 'language', 'era'].indexOf(r.kind) >= 0;
    var chips = filmId && r.kind !== 'franchise' && r.kind !== 'person';
    sec.innerHTML = '<header class="mv-row-h"><h2>' + esc(r.title) + '</h2>' + (r.sub ? '<span class="mv-row-sub">' + esc(r.sub) + '</span>' : '') +
      '<button class="mv-all" type="button" aria-expanded="false">See all</button></header>' +
      (chips ? chipsHTML('all') : '') + '<div class="mv-strip">' + loading + '</div>';
    holder.append(sec);
    var strip = $('.mv-strip', sec), allBtn = $('.mv-all', sec);
    var state = { lang: 'all', page: 1, items: [], done: false };

    function path(page) {
      if (r.kind === 'person') return '/person/' + r.id + '?role=' + encodeURIComponent(r.role || 'cast');
      return '/row/' + filmId + '/' + r.kind + '?lang=' + state.lang + '&page=' + page;
    }
    function draw() {
      var seen = seenIds(), list = state.items.filter(function (m) { return !(hideSeen() && seen.has(m.id)); });
      if (r.kind === 'person' && state.lang !== 'all') list = list.filter(function (m) { return m.l === state.lang; });
      if (!state.items.length && state.lang === 'all') { sec.hidden = true; return; }
      sec.hidden = false;
      strip.innerHTML = list.length ? list.map(function (m) { return cardHTML(m); }).join('') :
        '<p class="mv-none">Nothing ' + (state.lang !== 'all' ? 'in ' + langName(state.lang) + ' ' : '') + (hideSeen() && state.items.length ? 'you haven’t seen ' : '') + 'here yet.</p>';
      if (sec.classList.contains('grid') && pageable && !state.done) {
        var more = document.createElement('button');
        more.className = 'mv-btn mv-more'; more.type = 'button'; more.textContent = 'Load more';
        more.onclick = function () { load(state.page + 1, true); };
        strip.append(more);
      }
    }
    function load(page, append) {
      if (!append) strip.innerHTML = loading;
      var p = r.items && page === 1 && state.lang === 'all' ? Promise.resolve({ items: r.items }) : api(path(page));
      return p.then(function (d) {
        var items = (d && d.items) || [];
        state.page = page;
        if (page > 1 && !items.length) state.done = true;
        if (append) { var ids = new Set(state.items.map(function (m) { return m.id; })); items = items.filter(function (m) { return !ids.has(m.id); }); if (!items.length) state.done = true; }
        state.items = append ? state.items.concat(items) : items;
        draw();
      }).catch(function (e) { if (!append) strip.innerHTML = '<p class="mv-none">Couldn’t load this row. ' + esc(e.message) + '</p>'; });
    }
    sec._redraw = draw;
    allBtn.onclick = function () {
      var on = !sec.classList.contains('grid');
      sec.classList.toggle('grid', on); allBtn.setAttribute('aria-expanded', on); allBtn.textContent = on ? 'Show less' : 'See all';
      draw();
    };
    sec.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-lang]'); if (!b) return;
      state.lang = b.getAttribute('data-lang'); state.done = false;
      $$('button[data-lang]', sec).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      var sel = $('select[data-more]', sec); if (sel) sel.value = '';
      r.kind === 'person' ? draw() : load(1);
    });
    sec.addEventListener('change', function (e) {
      if (!e.target.matches('select[data-more]') || !e.target.value) return;
      state.lang = e.target.value; state.done = false;
      $$('button[data-lang]', sec).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      r.kind === 'person' ? draw() : load(1);
    });
    // fetch rows only when they come near the screen
    if (r.items || !('IntersectionObserver' in window)) load(1);
    else {
      var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); load(1); } }, { rootMargin: '400px 0px' });
      io.observe(sec);
    }
    return sec;
  }

  // ---------- views ----------
  var token = 0; // drops answers for a view the person has already left
  function setTitle(t) { document.title = (t ? t + ' — ' : '') + 'Movies — Ranjith Kannankattil'; }

  function viewHome() {
    setTitle('');
    var my = token;
    view.innerHTML = '<div class="mv-rows" id="rows">' + loading + '</div>';
    api('/home?region=' + store.get('region', 'IT')).then(function (d) {
      if (my !== token) return;
      var holder = $('#rows'); holder.innerHTML = '';
      var l = log();
      if (l) {
        var wl = l.watchlistCards();
        if (wl.length) mountRow(holder, { title: 'On my watchlist', items: wl, kind: 'watchlist' });
      }
      (d.rows || []).forEach(function (r) { mountRow(holder, r); });
    }).catch(function (e) { if (my === token) view.innerHTML = failHTML(e); });
  }

  function viewSearch(q, exact) {
    setTitle('“' + q + '”');
    var my = token;
    $('#q').value = q;
    rememberSearch(q);
    view.innerHTML = loading;
    api('/search?q=' + encodeURIComponent(q) + (exact ? '&exact=1' : '')).then(function (d) {
      if (my !== token) return;
      var html = '';
      if (d.corrected) html += '<p class="mv-fix">Showing results for <b>' + esc(d.corrected) + '</b>. <a href="#/s/' + encodeURIComponent(q) + '?exact">Search instead for “' + esc(q) + '”</a></p>';
      var people = d.people.length ? '<section class="mv-block"><h2 class="mv-h2">People</h2><div class="mv-strip people">' + d.people.map(personCardHTML).join('') + '</div></section>' : '';
      var langs = Array.from(new Set(d.movies.map(function (m) { return m.l; }))).filter(Boolean);
      var decades = Array.from(new Set(d.movies.map(function (m) { return m.y ? Math.floor(m.y / 10) * 10 : null; }))).filter(Boolean).sort(function (a, b) { return b - a; });
      var films = d.movies.length ?
        '<section class="mv-block"><h2 class="mv-h2">Films <i>' + d.movies.length + '</i></h2>' +
        (langs.length > 1 || decades.length > 1 ? '<div class="mv-filters">' +
          (langs.length > 1 ? '<label><span>Language</span><select id="fLang"><option value="">Any</option>' + langs.map(function (l) { return '<option value="' + l + '">' + langName(l) + '</option>'; }).join('') + '</select></label>' : '') +
          (decades.length > 1 ? '<label><span>Decade</span><select id="fDec"><option value="">Any</option>' + decades.map(function (y) { return '<option value="' + y + '">' + y + 's</option>'; }).join('') + '</select></label>' : '') + '</div>' : '') +
        '<div class="mv-grid" id="results"></div></section>' : '';
      if (!d.movies.length && !d.people.length) html += '<div class="mv-empty"><h2>Nothing found for “' + esc(q) + '”</h2><p>Try fewer words, the original title, or a director’s name.</p></div>';
      view.innerHTML = html + (d.personFirst ? people + films : films + people);
      var grid = $('#results');
      function draw() {
        var fl = ($('#fLang') || {}).value, fd = Number(($('#fDec') || {}).value) || 0;
        grid.innerHTML = d.movies.filter(function (m) { return (!fl || m.l === fl) && (!fd || (m.y && Math.floor(m.y / 10) * 10 === fd)); }).map(function (m) { return cardHTML(m, m.ot); }).join('');
      }
      if (grid) { draw(); $$('#fLang, #fDec').forEach(function (s) { s.onchange = draw; }); }
    }).catch(function (e) { if (my === token) view.innerHTML = failHTML(e); });
  }

  function rateBadge(k, label, value, sub, href, title) {
    var tag = href ? 'a' : 'span';
    return '<' + tag + ' class="mv-rate mv-rate-' + k + '"' + (href ? ' href="' + esc(href) + '" target="_blank" rel="noopener"' : '') + (title ? ' title="' + esc(title) + '"' : '') + '>' +
      '<span class="k">' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</' + tag + '>';
  }

  function viewFilm(id) {
    var my = token;
    view.innerHTML = loading;
    api('/movie/' + id).then(function (m) {
      if (my !== token) return;
      if (!m) { view.innerHTML = '<div class="mv-empty"><h2>No such film</h2></div>'; return; }
      setTitle(m.title + (m.year ? ' (' + m.year + ')' : ''));
      var R = m.ratings || {}, L = m.links || {};
      var badges = [
        R.imdb ? rateBadge('imdb', 'IMDb', R.imdb.v.toFixed(1), '/10' + (R.imdb.n ? ' · ' + compact(R.imdb.n) : ''), L.imdb, 'IMDb user rating') : '',
        R.rt != null ? rateBadge('rt', 'Rotten Tomatoes', R.rt + '%', 'critics', L.rt, 'Tomatometer') : '',
        R.mc != null ? rateBadge('mc', 'Metacritic', R.mc, '/100', L.mc, 'Metascore') : '',
        R.tmdb ? rateBadge('tmdb', 'TMDB', R.tmdb.v.toFixed(1), '/10 · ' + compact(R.tmdb.n), L.tmdb, 'TMDB user rating') : '',
        rateBadge('lb', 'Letterboxd', 'Open', '↗', L.letterboxd, 'Opens the film on Letterboxd'),
        '<span class="mv-rate mv-rate-me" id="myRate" hidden></span>'
      ].join('');
      var credit = function (label, list) { return list && list.length ? '<div><dt>' + label + '</dt><dd>' + list.map(function (p) { return '<a href="#/p/' + p.id + '">' + esc(p.name) + '</a>'; }).join(', ') + '</dd></div>' : ''; };
      var region = store.get('region', 'IT');
      var details = [
        m.budget ? ['Budget', money(m.budget)] : null,
        m.revenue ? ['Box office', money(m.revenue)] : (m.boxOffice ? ['Box office (US)', m.boxOffice] : null),
        m.awards ? ['Awards', m.awards] : null,
        m.langs && m.langs.length ? ['Spoken', m.langs.join(', ')] : null,
        m.date ? ['Released', new Date(m.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })] : null,
      ].filter(Boolean);
      view.innerHTML =
        '<article class="mv-film">' +
        '<div class="mv-hero"' + (m.backdrop ? ' style="--bd:url(\'' + esc(img(m.backdrop, 'w1280')) + '\')"' : '') + '>' +
          '<div class="mv-hero-in">' +
          (m.poster ? '<img class="mv-hero-p" src="' + esc(img(m.poster, 'w342')) + '" alt="Poster of ' + esc(m.title) + '">' : '') +
          '<div class="mv-hero-t">' +
            '<div class="mv-eyebrow">Film' + (m.year ? ' · ' + m.year : '') + ' · ' + esc(m.langName) + '</div>' +
            '<h1>' + esc(m.title) + '</h1>' + (m.original ? '<div class="mv-orig">' + esc(m.original) + '</div>' : '') +
            '<div class="mv-meta">' + [runtime(m.runtime), m.cert ? m.cert.cert + ' (' + m.cert.c + ')' : '', (m.countries || []).slice(0, 3).join(', ')].filter(Boolean).map(esc).join(' · ') + '</div>' +
            '<div class="mv-genres">' + (m.genres || []).map(function (g) { return '<span>' + esc(g.name) + '</span>'; }).join('') + '</div>' +
            '<div class="mv-ratings">' + badges + '</div>' +
            '<div class="mv-acts" id="acts"></div>' +
          '</div></div></div>' +
        (m.tagline ? '<p class="mv-tagline">' + esc(m.tagline) + '</p>' : '') +
        (m.overview ? '<p class="mv-plot">' + esc(m.overview) + '</p>' : '') +
        '<dl class="mv-credits">' + credit('Directed by', m.directors) + credit('Written by', m.writers) + credit('Music', m.composer) + credit('Cinematography', m.dop) + '</dl>' +
        (m.cast && m.cast.length ? '<section class="mv-block"><h2 class="mv-h2">Cast</h2><div class="mv-strip people">' + m.cast.map(personCardHTML).join('') + '</div></section>' : '') +
        '<section class="mv-block mv-watch"><h2 class="mv-h2">Where to watch <select id="region" aria-label="Country">' + Object.keys(REGIONS).map(function (c) { return '<option value="' + c + '"' + (c === region ? ' selected' : '') + '>' + REGIONS[c] + '</option>'; }).join('') + '</select></h2><div id="prov"></div></section>' +
        (details.length ? '<dl class="mv-details">' + details.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
        (m.keywords && m.keywords.length ? '<div class="mv-kw">' + m.keywords.slice(0, 14).map(function (k) { return '<span>' + esc(k.name) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="mv-links">' + [
          m.trailer ? '<a class="mv-btn" href="' + esc(m.trailer) + '" target="_blank" rel="noopener">▶ Trailer</a>' : '',
          L.imdb ? '<a class="mv-btn ghost" href="' + esc(L.imdb) + '" target="_blank" rel="noopener">IMDb ↗</a>' : '',
          '<a class="mv-btn ghost" href="' + esc(L.letterboxd) + '" target="_blank" rel="noopener">Letterboxd ↗</a>',
          '<a class="mv-btn ghost" href="' + esc(L.tmdb) + '" target="_blank" rel="noopener">TMDB ↗</a>',
          m.homepage ? '<a class="mv-btn ghost" href="' + esc(m.homepage) + '" target="_blank" rel="noopener">Official site ↗</a>' : '',
          '<button class="mv-btn ghost" type="button" id="share">Copy link</button>'
        ].join('') + '</div>' +
        '<div class="mv-rows-h"><h2 class="mv-h2">Where to go next</h2>' + (log() ? '<label class="mv-switch"><input type="checkbox" id="hideSeen"' + (hideSeen() ? ' checked' : '') + '> Hide films I’ve watched</label>' : '') + '</div>' +
        '<div class="mv-rows" id="rows"></div></article>';

      function drawProv() {
        var c = $('#region').value, p = (m.providers || {})[c];
        store.set('region', c);
        var group = function (label, list) { return list && list.length ? '<div class="mv-prov-g"><span>' + label + '</span>' + list.map(function (x) { return '<i title="' + esc(x.name) + '">' + (x.logo ? '<img src="' + esc(img(x.logo, 'w92')) + '" alt="' + esc(x.name) + '">' : esc(x.name)) + '</i>'; }).join('') + '</div>' : ''; };
        $('#prov').innerHTML = p && (p.stream.length || p.free.length || p.rent.length || p.buy.length) ?
          group('Stream', p.stream) + group('Free', p.free) + group('Rent', p.rent) + group('Buy', p.buy) + (p.link ? '<a class="mv-prov-link" href="' + esc(p.link) + '" target="_blank" rel="noopener">All options on JustWatch ↗</a>' : '') :
          '<p class="mv-none">Not streaming in ' + REGIONS[c] + ' as far as JustWatch knows.</p>';
      }
      drawProv();
      $('#region').onchange = drawProv;
      $('#share').onclick = function () {
        var u = location.href;
        (navigator.share ? navigator.share({ title: m.title, url: u }) : navigator.clipboard.writeText(u).then(function () { alertBox('Link copied.'); })).catch(function () {});
      };
      var hs = $('#hideSeen');
      if (hs) hs.onchange = function () { store.set('hideSeen', hs.checked); $$('.mv-row').forEach(function (s) { s._redraw && s._redraw(); }); };
      var holder = $('#rows');
      (m.rows || []).forEach(function (r) { mountRow(holder, r, m.id); });
      current.film = m;
      drawOwnerFilm();
    }).catch(function (e) { if (my === token) view.innerHTML = failHTML(e); });
  }

  // the owner's buttons and history on a film page
  function drawOwnerFilm() {
    var m = current.film, acts = $('#acts'), me = $('#myRate');
    if (!m || !acts) return;
    var l = log();
    if (!l) { acts.innerHTML = ''; if (me) me.hidden = true; return; }
    var w = l.watchesFor(m.id), inList = l.inWatchlist(m.id);
    var rated = w.filter(function (x) { return x.rating != null; })[0];
    if (me) { me.hidden = !rated; if (rated) me.innerHTML = '<span class="k">My rating</span><b>' + stars(rated.rating) + '</b><small>' + rated.rating + '/5</small>'; }
    acts.innerHTML = '<button class="mv-btn" type="button" id="logBtn">' + (w.length ? '+ Log again' : '✓ Watched') + '</button>' +
      '<button class="mv-btn ghost" type="button" id="wlBtn" aria-pressed="' + inList + '">' + (inList ? '★ On watchlist' : '+ Watchlist') + '</button>' +
      (w.length ? '<div class="mv-history"><b>' + (w.length === 1 ? 'Watched' : 'Watched ' + w.length + ' times') + '</b> ' + w.map(function (x) {
        return '<a href="#/diary" data-edit="' + esc(x.id) + '">' + (x.date ? new Date(x.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'date unknown') + (x.rating != null ? ' · ' + stars(x.rating) : '') + '</a>';
      }).join(', ') + '</div>' : '');
    $('#logBtn').onclick = function () { l.openSheet({ film: m }); };
    $('#wlBtn').onclick = function () { l.toggleWatchlist(m); };
    $$('[data-edit]', acts).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); l.openSheet({ film: m, edit: a.getAttribute('data-edit') }); }; });
  }

  var ROLES = { cast: 'Acting', director: 'Directing', writer: 'Writing', composer: 'Music', dop: 'Cinematography' };
  function viewPerson(id, role) {
    var my = token;
    view.innerHTML = loading;
    api('/person/' + id + (role ? '?role=' + role : '')).then(function (p) {
      if (my !== token) return;
      if (!p) { view.innerHTML = '<div class="mv-empty"><h2>No such person</h2></div>'; return; }
      setTitle(p.name);
      var r = p.role;
      var life = [p.born ? 'Born ' + new Date(p.born + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '', p.died ? 'died ' + p.died.slice(0, 4) : '', p.place || ''].filter(Boolean).join(' · ');
      var langs = Array.from(new Set(p.items.map(function (m) { return m.l; }))).filter(Boolean);
      view.innerHTML = '<article class="mv-personpage"><div class="mv-ph">' +
        (p.p ? '<img src="' + esc(img(p.p, 'w342')) + '" alt="">' : '') +
        '<div><div class="mv-eyebrow">' + esc(p.dept || 'Person') + '</div><h1>' + esc(p.name) + '</h1><div class="mv-meta">' + esc(life) + '</div>' +
        (p.bio ? '<p class="mv-bio">' + esc(p.bio.length > 600 ? p.bio.slice(0, 600).replace(/\s+\S*$/, '') + '…' : p.bio) + '</p>' : '') +
        (p.imdb ? '<a class="mv-btn ghost" href="https://www.imdb.com/name/' + esc(p.imdb) + '/" target="_blank" rel="noopener">IMDb ↗</a>' : '') + '</div></div>' +
        '<nav class="mv-tabs" aria-label="Roles">' + Object.keys(ROLES).filter(function (k) { return p.counts[k]; }).map(function (k) {
          return '<a href="#/p/' + p.id + '/' + k + '"' + (k === r ? ' aria-current="page"' : '') + '>' + ROLES[k] + ' <i>' + p.counts[k] + '</i></a>';
        }).join('') + '</nav>' +
        (langs.length > 1 ? '<div class="mv-filters"><label><span>Language</span><select id="pLang"><option value="">Any</option>' + langs.map(function (l) { return '<option value="' + l + '">' + langName(l) + '</option>'; }).join('') + '</select></label>' +
          '<label><span>Sort</span><select id="pSort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="top">Best rated</option><option value="pop">Most popular</option></select></label></div>' : '') +
        '<div class="mv-grid" id="pgrid"></div></article>';
      function draw() {
        var fl = ($('#pLang') || {}).value, so = ($('#pSort') || {}).value || 'new';
        var list = p.items.filter(function (m) { return !fl || m.l === fl; }).slice();
        if (so === 'old') list.sort(function (a, b) { return (a.y || 9999) - (b.y || 9999); });
        if (so === 'top') list = list.filter(function (m) { return m.n >= 20; }).sort(function (a, b) { return (b.v || 0) - (a.v || 0); });
        if (so === 'pop') list.sort(function (a, b) { return (b.pop || 0) - (a.pop || 0); });
        $('#pgrid').innerHTML = list.map(function (m) { return cardHTML(m, r === 'cast' ? m.as : null); }).join('') || '<p class="mv-none">Nothing here.</p>';
      }
      draw();
      $$('#pLang, #pSort').forEach(function (s) { s.onchange = draw; });
    }).catch(function (e) { if (my === token) view.innerHTML = failHTML(e); });
  }

  function viewPrivate(name, q) {
    var l = log();
    setTitle({ diary: 'Diary', watchlist: 'Watchlist', dash: 'Dashboard' }[name]);
    if (!l) {
      var waiting = window.MovieLog && window.MovieLog.pending;
      view.innerHTML = waiting ? loading : '<div class="mv-empty"><h2>This page is private</h2><p>The diary, watchlist and dashboard are Ranjith’s own film log.</p><button class="mv-btn" type="button" data-signin>Owner sign-in</button></div>';
      return;
    }
    if (name === 'dash') window.MoviesDash.render(view, l.watches(), q);
    else l.render(name, view);
  }

  // ---------- router ----------
  var current = {};
  function route() {
    token++;
    current = {};
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    var qi = h.indexOf('?'), qs = qi >= 0 ? h.slice(qi + 1) : '', path = qi >= 0 ? h.slice(0, qi) : h;
    var parts = path.split('/');
    current.view = parts[0] || 'home';
    $$('#mine a').forEach(function (a) { a.toggleAttribute('aria-current', a.getAttribute('data-v') === parts[0]); });
    closeSugg();
    if (parts[0] !== 's') $('#q').value = '';
    if (parts[0] === 'm' && /^\d+$/.test(parts[1])) viewFilm(parts[1]);
    else if (parts[0] === 'p' && /^\d+$/.test(parts[1])) viewPerson(parts[1], ROLES[parts[2]] ? parts[2] : '');
    else if (parts[0] === 's' && parts[1]) viewSearch(parts.slice(1).join('/'), /(^|&)exact/.test(qs));
    else if (parts[0] === 'diary' || parts[0] === 'watchlist' || parts[0] === 'dash') viewPrivate(parts[0], qs);
    else { current.view = 'home'; $('#q').value = ''; viewHome(); }
    if (route.ran) window.scrollTo(0, 0);
    route.ran = true;
  }
  window.addEventListener('hashchange', route);

  // ---------- search box with suggestions ----------
  var q = $('#q'), sugg = $('#sugg'), form = $('#searchForm');
  var sTimer = null, sSeq = 0, active = -1, items = [];
  function rememberSearch(t) { var r = store.get('recent', []).filter(function (x) { return x.toLowerCase() !== t.toLowerCase(); }); r.unshift(t); store.set('recent', r.slice(0, 8)); }
  function closeSugg() { sugg.hidden = true; q.setAttribute('aria-expanded', 'false'); active = -1; }
  function showSugg(html) { sugg.innerHTML = html; sugg.hidden = !html; q.setAttribute('aria-expanded', String(!!html)); items = $$('[role="option"]', sugg); active = -1; }
  function mark(i) { items.forEach(function (x, j) { x.setAttribute('aria-selected', j === i); }); active = i; if (items[i]) items[i].scrollIntoView({ block: 'nearest' }); }
  function recents() {
    var r = store.get('recent', []);
    if (!r.length) return closeSugg();
    showSugg('<li class="mv-sugg-h">Recent <button type="button" data-clear>Clear</button></li>' + r.map(function (t) { return '<li role="option" data-href="#/s/' + esc(encodeURIComponent(t)) + '"><span class="mv-sugg-r">↺</span><b>' + esc(t) + '</b></li>'; }).join(''));
  }
  q.addEventListener('input', function () {
    clearTimeout(sTimer);
    var t = q.value.trim();
    if (t.length < 2) { return t ? closeSugg() : recents(); }
    sTimer = setTimeout(function () {
      var my = ++sSeq;
      api('/search?q=' + encodeURIComponent(t)).then(function (d) {
        if (my !== sSeq || q.value.trim() !== t) return;
        var html = d.corrected ? '<li class="mv-sugg-h">Did you mean <b>' + esc(d.corrected) + '</b>?</li>' : '';
        var ppl = d.people.slice(0, d.personFirst ? 3 : 2).map(function (p) {
          return '<li role="option" data-href="#/p/' + p.id + '"><span class="mv-sugg-face">' + (p.p ? '<img src="' + esc(img(p.p, 'w92')) + '" alt="">' : '') + '</span><b>' + esc(p.name) + '</b><small>' + esc(p.dept || '') + '</small></li>';
        }).join('');
        var mov = d.movies.slice(0, 7).map(function (m) {
          return '<li role="option" data-href="#/m/' + m.id + '"><span class="mv-sugg-p">' + (m.p ? '<img src="' + esc(img(m.p, 'w92')) + '" alt="">' : '') + '</span><b>' + esc(m.t) + '</b><small>' + [m.y, langName(m.l), m.ot].filter(Boolean).map(esc).join(' · ') + '</small></li>';
        }).join('');
        html += d.personFirst ? ppl + mov : mov + ppl;
        html += '<li role="option" class="mv-sugg-all" data-href="#/s/' + esc(encodeURIComponent(t)) + '">See all results for “' + esc(t) + '” →</li>';
        showSugg(html);
      }).catch(function (e) { if (e.message === 'noapi') showSugg('<li class="mv-sugg-h">The film database isn’t connected yet.</li>'); });
    }, 250);
  });
  q.addEventListener('focus', function () { if (!q.value.trim()) recents(); });
  q.addEventListener('keydown', function (e) {
    if (sugg.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); mark(Math.min(items.length - 1, active + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mark(Math.max(-1, active - 1)); }
    else if (e.key === 'Escape') closeSugg();
  });
  sugg.addEventListener('mousedown', function (e) { e.preventDefault(); });
  sugg.addEventListener('click', function (e) {
    if (e.target.closest('[data-clear]')) { store.set('recent', []); closeSugg(); return; }
    var li = e.target.closest('[data-href]'); if (!li) return;
    go(li.getAttribute('data-href'));
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (active >= 0 && items[active]) return go(items[active].getAttribute('data-href'));
    var t = q.value.trim(); if (t) go('#/s/' + encodeURIComponent(t));
  });
  q.addEventListener('blur', function () { setTimeout(closeSugg, 120); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !$('#sheet').open) { e.preventDefault(); q.focus(); }
  });
  function go(h) { closeSugg(); q.blur(); if (location.hash === h) route(); else location.hash = h; }

  // sign-in buttons anywhere on the page
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-signin], #ownerBtn')) {
      if (!window.MovieLog) return alertBox('Sign-in is still loading — try again in a second.');
      window.MovieLog.owner ? window.MovieLog.signOut() : window.MovieLog.signIn();
    }
  });

  // the owner signed in or out, or the log changed: refresh what depends on it
  window.addEventListener('movielog:change', function () {
    var l = log();
    $('#mine').hidden = !l;
    $('#ownerBtn').textContent = l ? 'Sign out' : 'Owner sign-in';
    if (current.view === 'diary' && l) return l.render('diary', view);
    if (current.view === 'diary' || current.view === 'watchlist' || current.view === 'dash') return route();
    if (current.view === 'm') { drawOwnerFilm(); $$('.mv-row').forEach(function (s) { s._redraw && s._redraw(); }); return; }
    $$('.mv-card').forEach(function (a) { var s = seenIds().has(Number(a.getAttribute('data-id'))); a.classList.toggle('seen', s); });
  });

  // shared with the log and dashboard scripts
  window.MoviesApp = { api: api, img: img, esc: esc, langName: langName, LANGS: LANGS, cardHTML: cardHTML, stars: stars, runtime: runtime, alert: alertBox, go: go, loading: loading, store: store };

  route();
})();
