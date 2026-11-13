/* ============================================================
   TOOL — Internship finder  (productivity/internships.html)

   Everything runs in the visitor's browser on THEIR OWN Gemini key
   (Google AI Studio, free tier). This site never sees the key, the
   course or the results. No Google Search tool is used (free keys
   get "quota exceeded" for it). Flow:
     1 course → 2 key → 3 profile (1–2 AI requests; tries to open the
       university's syllabus page) → 4 search:
       a. 1 AI request names organisations per tier (state govt →
          central govt → PSUs → private) with careers/notices pages,
          plus the built-in official programmes (internships-data.js)
       b. those pages are opened with a free page reader (Jina Reader,
          AllOrigins as backup) and internship links are picked out by
          code; one careers/notices link per site is followed
       c. Google News RSS for recent announcements (same reader)
       d. a few batched AI requests turn the finds into cards
   If the AI limit runs out, the code-picked finds stay on the page.

   Test without a key: ?mock=1, ?mock=day, ?mock=noread
   ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var root = $('in');
  if (!root) return;

  var API = 'https://generativelanguage.googleapis.com/v1beta/models/';
  var PLAIN_MODEL = 'gemini-flash-lite-latest';
  var GAP = 7000;                                     // ms between AI calls
  var STORE = 'ifind-v1', KEYSTORE = 'ifind-key', LANGSTORE = 'ifind-lang';
  var TIERS = ['state', 'central', 'psu', 'private'];
  var TIER_T = { state: 'tState', central: 'tCentral', psu: 'tPsu', private: 'tPrivate' };
  var MOCK = /[?&]mock=/.test(location.search), MOCKERR = (location.search.match(/mock=(day|noread)/) || [])[1];
  var LANGS = window.INTERN_LANGS, TT = window.INTERN_T, FIELDS = window.INTERN_FIELDS;

  // ---------------------------------------------------------------- state
  var blank = function () {
    return { v: 1, step: 1, depth: 'std', tab: 'state', filter: 'all',
      p: { course: '', uni: '', state: '', year: '1', places: '', paste: '', subjects: [], skills: [], orgs: [], fields: [], syl: null },
      run: null, res: [], marks: {} };
  };
  var S = blank();
  try { var raw = localStorage.getItem(STORE); if (raw) S = Object.assign(blank(), JSON.parse(raw)); } catch (e) {}
  var lang = (function () {
    try { var l = localStorage.getItem(LANGSTORE); if (l && TT[l]) return l; } catch (e) {}
    var n = (navigator.language || 'en').toLowerCase();
    return n.indexOf('ml') === 0 ? 'ml' : n.indexOf('hi') === 0 ? 'hi' : 'en';
  })();
  var pdf = null;            // { name, b64 } — kept in memory only
  var running = false, stopAsked = false, wake = null, night = false;

  var save = function () {
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
    queueFolderWrite();
  };
  var getKey = function () {
    try { return sessionStorage.getItem(KEYSTORE) || localStorage.getItem(KEYSTORE) || ''; } catch (e) { return ''; }
  };
  var setKey = function (k, remember) {
    try {
      sessionStorage.setItem(KEYSTORE, k);
      if (remember) localStorage.setItem(KEYSTORE, k); else localStorage.removeItem(KEYSTORE);
    } catch (e) {}
  };

  // ---------------------------------------------------------------- text
  var t = function (k, vars) {
    var s = (TT[lang] && TT[lang][k]) || TT.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var applyLang = function () {
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    $('inNight').setAttribute('lang', lang);
    if (lang === 'hi' && !document.getElementById('inHiFont')) {
      var l = document.createElement('link');
      l.id = 'inHiFont'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600&display=swap';
      document.head.appendChild(l);
    }
    document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.getAttribute('data-t')); });
    document.querySelectorAll('[data-th]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-th')); });
    document.querySelectorAll('[data-tp]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-tp')); });
    $('inLang').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('lang') === lang); });
    fillStates();
    renderProfile(); renderResults(); renderProgress();
  };

  // language buttons
  $('inLang').innerHTML = LANGS.map(function (L) { return '<button type="button" lang="' + L.id + '">' + esc(L.label) + '</button>'; }).join('');
  $('inLang').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    lang = b.getAttribute('lang');
    try { localStorage.setItem(LANGSTORE, lang); } catch (er) {}
    if (lang === 'ml' && !S.p.state) S.p.state = 'Kerala';
    applyLang();
  });

  // ---------------------------------------------------------------- steps
  var show = function (n, noScroll) {
    var changed = S.step !== n;
    S.step = n;
    document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = +p.getAttribute('data-panel') !== n; });
    document.querySelectorAll('#inSteps li').forEach(function (li) {
      var k = +li.getAttribute('data-step');
      li.classList.toggle('on', k === n); li.classList.toggle('done', k < n);
    });
    save();
    if (n === 2 && typeof keyStepUI === 'function') keyStepUI();
    // a new step starts at the top: bring the step bar to the top of the screen
    if (!noScroll && changed) {
      var top = $('inSteps').getBoundingClientRect().top + window.pageYOffset - 12;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
  };
  $('inSteps').addEventListener('click', function (e) {
    var li = e.target.closest('[data-step]'); if (!li || running) return;
    var n = +li.getAttribute('data-step');
    if (n === 4 && !S.run) return;
    if (n === 3 && !S.p.subjects.length) return;
    show(n);
  });
  root.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]'); if (g) show(+g.getAttribute('data-go'));
  });
  var msg = function (id, text, bad) {
    var el = $(id); if (!el) return;
    el.hidden = !text; el.textContent = text || ''; el.classList.toggle('bad', !!bad);
  };

  // ---------------------------------------------------------------- step 1
  var fillStates = function () {
    var sel = $('inState'), cur = S.p.state;
    sel.innerHTML = '<option value="">' + esc(t('statePick')) + '</option><option value="all">' + esc(t('allStates')) + '</option>' +
      window.INTERN_STATES.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    sel.value = cur || '';
  };
  var readForm = function () {
    S.p.course = $('inCourse').value.trim(); S.p.uni = $('inUni').value.trim();
    S.p.state = $('inState').value; S.p.year = $('inYear').value;
    S.p.places = $('inPlaces').value.trim(); S.p.paste = $('inPaste').value.trim();
  };
  var fillForm = function () {
    $('inCourse').value = S.p.course; $('inUni').value = S.p.uni; $('inYear').value = S.p.year || '1';
    $('inPlaces').value = S.p.places; $('inPaste').value = S.p.paste || '';
  };
  ['inCourse', 'inUni', 'inState', 'inYear', 'inPlaces', 'inPaste'].forEach(function (id) {
    $(id).addEventListener('change', function () { readForm(); save(); });
  });
  $('inPdf').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    if (f.size > 15e6) { alert('PDF > 15 MB'); this.value = ''; return; }
    var r = new FileReader();
    r.onload = function () { pdf = { name: f.name, b64: String(r.result).split(',')[1] }; $('inPdfName').hidden = false; $('inPdfName').textContent = '📄 ' + f.name; };
    r.readAsDataURL(f);
  });
  $('inNext1').addEventListener('click', function () {
    readForm();
    if (!S.p.course) return msg('inMsg1', t('needCourse'), true);
    if (!S.p.state) return msg('inMsg1', t('needState'), true);
    msg('inMsg1', '');
    show(2); keyStepUI();
    if (getKey()) $('inKey').value = getKey();
  });

  // ---------------------------------------------------------------- step 2
  $('inKeyShow').addEventListener('click', function () {
    var k = $('inKey'); var on = k.type === 'password';
    k.type = on ? 'text' : 'password'; this.textContent = t(on ? 'hide' : 'show');
  });
  var takeKey = function () {
    var k = $('inKey').value.trim();
    if (!k) { msg('inMsg2', t('needKey'), true); return ''; }
    setKey(k, $('inRemember').checked);
    return k;
  };
  var keyStepUI = function () { $('inContinue').hidden = !(typeof pending === 'function' && pending()); };
  // switch to another key (e.g. from a different Gmail account): stop, keep progress, come back here
  $('inChangeKey').addEventListener('click', function () {
    if (running) stopAsked = true;
    nightOff();
    $('inKey').value = ''; $('inKey').type = 'password'; $('inKeyShow').textContent = t('show');
    show(2); keyStepUI(); msg('inMsg2', t('changeKeyH'));
    setTimeout(function () { $('inKey').focus(); }, 400);
  });
  $('inForget').addEventListener('click', function () {
    try { localStorage.removeItem(KEYSTORE); sessionStorage.removeItem(KEYSTORE); } catch (e) {}
    $('inKey').value = ''; msg('inMsg2', t('keyForgot'));
  });
  $('inContinue').addEventListener('click', function () {
    if (!takeKey()) return;
    msg('inMsg2', '');
    retryFailed();
    show(4);
    // the old search may still be finishing its last request: start once it has stopped
    var go = function () { if (running) return setTimeout(go, 500); loop(); };
    go();
  });
  $('inTest').addEventListener('click', function () {
    var k = takeKey(); if (!k) return;
    var b = this; b.disabled = true;
    gemini({ contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }] }, PLAIN_MODEL)
      .then(function () { msg('inMsg2', t('keyOk')); })
      .catch(function (e) { msg('inMsg2', t('keyBad', { m: e.message || e.kind }), true); })
      .then(function () { b.disabled = false; });
  });
  $('inRead').addEventListener('click', function () {
    if (!takeKey()) return;
    var b = this; b.disabled = true; msg('inMsg2', t('reading'));
    buildProfile().then(function () { msg('inMsg2', ''); show(3); renderProfile(); renderResults(); })
      .catch(function (e) { msg('inMsg2', e.kind === 'key' ? t('errKey') : t('keyBad', { m: e.message || e.kind }), true); })
      .then(function () { b.disabled = false; });
  });

  // ---------------------------------------------------------------- Gemini
  function GemErr(kind, message) { this.kind = kind; this.message = message; }
  var classify = function (status, body, search) {
    var s = JSON.stringify(body || {}), m = (body && body.error && body.error.message) || ('HTTP ' + status);
    if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(s)) return new GemErr('key', m);
    if (status === 401 || status === 403) return new GemErr(/search|grounding/i.test(s) || search ? 'nosearch' : 'key', m);
    if (status === 404) return new GemErr(search ? 'nosearch' : 'other', m);
    if (status === 429) {
      // "limit: 0" means this model (or Google Search on it) is not in this key's free tier at all
      if (/limit:\s*0\b|"quotaValue":"0"/i.test(s)) return new GemErr(search ? 'nosearch' : 'day', m);
      if (/PerDay|per_day|per day|daily/i.test(s)) return new GemErr('day', m);
      var d = s.match(/"retryDelay":"(\d+)s"/);
      var e = new GemErr('rate', m); e.wait = Math.min(d ? (+d[1] + 2) * 1000 : 60000, 90000); return e;
    }
    if (status === 400 && /search|grounding|tool/i.test(s)) return new GemErr('nosearch', m);
    if (status >= 500) { var e5 = new GemErr('rate', m); e5.wait = 20000; return e5; }
    return new GemErr('other', m);
  };
  var gemini = function (body, model) {
    if (MOCK) return mockGemini(body, model);
    var key = getKey();
    if (!key) return Promise.reject(new GemErr('key', t('needKey')));
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl && setTimeout(function () { ctl.abort(); }, 120000);
    return fetch(API + model + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw classify(r.status, j, !!body.tools);
        var c = j.candidates && j.candidates[0];
        var text = c && c.content && c.content.parts ? c.content.parts.map(function (p) { return p.text || ''; }).join('') : '';
        var gm = (c && c.groundingMetadata) || {};
        var hosts = (gm.groundingChunks || []).map(function (ch) { return ch.web && (ch.web.title || hostOf(ch.web.uri)); }).filter(Boolean)
          .map(function (h) { return String(h).toLowerCase().replace(/^www\./, ''); });
        var um = (c && (c.urlContextMetadata || c.url_context_metadata)) || {};
        (um.urlMetadata || um.url_metadata || []).forEach(function (u) {
          var st = u.urlRetrievalStatus || u.url_retrieval_status || '';
          var h = hostOf(u.retrievedUrl || u.retrieved_url);
          if (h && /SUCCESS/.test(st)) hosts.push(h);
        });
        return { text: text, hosts: hosts, searched: !!(gm.webSearchQueries && gm.webSearchQueries.length) || hosts.length > 0 };
      });
    }, function (er) { clearTimeout(timer); if (er && er.kind) throw er; throw new GemErr('net', t('errNet')); });
  };
  var parseJSON = function (text, open) {
    if (!text) return null;
    text = text.replace(/```(?:json)?/gi, '');
    var a = text.indexOf(open), b = text.lastIndexOf(open === '[' ? ']' : '}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { return null; }
  };
  var hostOf = function (u) { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var profileText = function () {
    var p = S.p;
    return 'Course: ' + p.course + (p.uni ? '\nUniversity/college: ' + p.uni : '') +
      '\nYear of study: ' + (p.year === 'grad' ? 'finished the course' : p.year) +
      '\nHome state: ' + (p.state === 'all' ? 'any Indian state' : p.state) +
      (p.places ? '\nPreferred places: ' + p.places : '') +
      (p.subjects.length ? '\nKey subjects: ' + p.subjects.join('; ') : '') +
      (p.skills.length ? '\nSkills: ' + p.skills.join('; ') : '') +
      (p.orgs.length ? '\nRelated organisations: ' + p.orgs.join('; ') : '');
  };

  // ---- AI calls: Flash-Lite first (largest free allowance), then Flash. No Google Search tool anywhere.
  var ask = function (body) {
    var run = S.run || {}; run.dead = run.dead || {};
    var models = [PLAIN_MODEL, 'gemini-flash-latest'].filter(function (m) { return run.dead[m] !== today(); });
    var last = new GemErr('day', 'Today’s free AI limit for this key is used up.');
    var go = function (i) {
      if (i >= models.length) throw last;
      return gemini(body, models[i]).catch(function (e) {
        if (e.kind === 'day' || e.kind === 'nosearch') { run.dead[models[i]] = today(); last = e.kind === 'nosearch' ? new GemErr('day', e.message) : e; return go(i + 1); }
        throw e;
      });
    };
    return Promise.resolve().then(function () { return go(0); });
  };

  // ---- Page reader: opens any public page from the browser without AI.
  // 1) Jina Reader (free, no key, ~20 pages a minute per phone)  2) AllOrigins as a backup
  var READER = 'https://r.jina.ai/', ORIGINS = 'https://api.allorigins.win/raw?url=';
  var READ_GAP = 3500;
  var fetchText = function (url, ms) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl && setTimeout(function () { ctl.abort(); }, ms || 40000);
    return fetch(url, { signal: ctl ? ctl.signal : undefined }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.text();
    }, function (e) { clearTimeout(timer); throw e; });
  };
  var htmlToMd = function (html, base) {
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script,style,noscript,svg').forEach(function (n) { n.remove(); });
      doc.querySelectorAll('a[href]').forEach(function (a) {
        var href; try { href = new URL(a.getAttribute('href'), base).href; } catch (e) { return; }
        a.textContent = '[' + a.textContent.replace(/\s+/g, ' ').trim() + '](' + href + ')';
      });
      doc.querySelectorAll('br,p,div,li,tr,h1,h2,h3,h4,h5,h6').forEach(function (n) { n.append('\n'); });
      return (doc.body ? doc.body.textContent : '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
    } catch (e) { return html; }
  };
  var readerDown = 0;
  var readPage = function (url) {
    if (MOCK) return mockRead(url);
    var viaOrigins = function () { return fetchText(ORIGINS + encodeURIComponent(url), 30000).then(function (h) { return /<html|<body|<a /i.test(h) ? htmlToMd(h, url) : h; }); };
    var first = readerDown > 3 ? viaOrigins() : fetchText(READER + url, 40000).then(function (t) { readerDown = 0; return t; }, function (e) { readerDown++; return viaOrigins(); });
    return first.then(function (text) {
      if (!text || text.length < 80) throw new Error('empty page');
      return text.slice(0, 250000);
    });
  };

  // ---- Is a link alive? (dead = the site answers "not found"; unknown/blocked counts as alive)
  var DEAD = /returned error (404|410)\b|^Title:\s*(404\b|404 not found|not found|page not found)\s*$|the requested url was not found on this server/im;
  var checkLink = function (url) {
    if (MOCK) return sleep(100).then(function () { return !/dead/.test(url); });
    return fetchText(READER + url, 30000).then(function (text) { return !DEAD.test(String(text).slice(0, 1500)); },
      function (e) {
        if (e && (e.status === 404 || e.status === 410)) return false;
        return fetchText(ORIGINS + encodeURIComponent(url), 25000).then(function (h) { return !DEAD.test(String(h).slice(0, 3000)); },
          function (e2) { return !(e2 && (e2.status === 404 || e2.status === 410)); });
      });
  };

  // ---- Picking out internship mentions from a page (no AI)
  var KW = /\b(intern(ship)?s?|summer (training|school|research|fellowship|programme|program)|trainee(ship)?s?|apprentice(ship)?s?|studentships?|project (assistant|trainee|fellow)|industrial training|vocational training|in-?plant training|graduate engineer trainee)\b/i;
  var HOPKW = /(career|recruit|notice|notification|intern|training|vacanc|apprentic|opportunit|\bjobs?\b|advertis|announcement|what.?s new|latest)/i;
  var linksOf = function (md) {
    var out = [], re = /\[([^\]\n]{2,220})\]\((https?:\/\/[^)\s]+)\)/g, m;
    while ((m = re.exec(md))) out.push({ text: m[1].replace(/[*_`#]/g, '').trim(), url: m[2], at: m.index });
    return out;
  };
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var findDate = function (s) {
    var m = s.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d\d)\b/);
    if (m && +m[2] <= 12 && +m[1] <= 31) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?,?\s+(20\d\d)\b/i);
    if (m) return m[3] + '-' + pad(MONTHS[m[2].toLowerCase()]) + '-' + pad(+m[1]);
    m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d\d)\b/i);
    if (m) return m[3] + '-' + pad(MONTHS[m[1].toLowerCase()]) + '-' + pad(+m[2]);
    return '';
  };
  var snippetsOf = function (md) {
    var lines = md.split('\n'), out = [], used = {};
    for (var i = 0; i < lines.length && out.length < 14; i++) {
      if (!KW.test(lines[i]) || used[i]) continue;
      var a = Math.max(0, i - 2), b = Math.min(lines.length, i + 3), chunk = [];
      for (var k = a; k < b; k++) { used[k] = 1; chunk.push(lines[k]); }
      out.push(chunk.join(' ').replace(/\s+/g, ' ').slice(0, 700));
    }
    return out;
  };
  // links that are really about an internship: the link text must say so (or the address names one clearly);
  // menus, "skip to content", same-page anchors and words like "Internal"/"International" are left out
  var URLKW = /(internship|apprenticeship|apprentice|summer[-_ ]?training|summer[-_ ]?intern|studentship|trainee)/i;
  var NAVJUNK = /^(skip|home|menu|login|log in|sign in|register|contact|about|faculty|staff|gallery|tenders?|rti|sitemap|search|back|more|read more|click here|view|download|english|hindi|malayalam)\b/i;
  var rawItems = function (md, page) {
    var now = today(), seen = {}, pageKey = page.url.replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase();
    return linksOf(md).filter(function (l) {
      var text = l.text.replace(/\s+/g, ' ').trim();
      if (text.length < 6 || NAVJUNK.test(text) || /login|sign.?in|policy\b/i.test(text)) return false;
      var target = l.url.replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase();
      if (target === pageKey || /^#/.test(l.url) || /#(main|content|skip)/i.test(l.url)) return false;
      var path = l.url.replace(/^https?:\/\/[^/]+/i, '');
      return KW.test(text) || (URLKW.test(path) && text.split(' ').length >= 2);
    }).map(function (l) {
      var near = md.slice(Math.max(0, l.at - 250), l.at + l.text.length + 350);
      var dl = /last date|closing|deadline|on or before|apply by/i.test(near) ? findDate(near) : '';
      return { title: l.text.replace(/\s+/g, ' ').trim().slice(0, 160), org: page.org, url: l.url, deadline: dl && dl >= now ? dl : '', status: 'unclear', why: '' };
    }).filter(function (x) {
      var k = x.url.toLowerCase(), k2 = x.title.toLowerCase() + '|' + x.org.toLowerCase();
      if (seen[k] || seen[k2]) return false; seen[k] = 1; seen[k2] = 1; return true;
    }).slice(0, 12);
  };
  var hopsOf = function (md, page) {
    var h = hostOf(page.url);
    return linksOf(md).filter(function (l) {
      var lh = hostOf(l.url);
      return (lh === h || lh.slice(-(h.length + 1)) === '.' + h || h.slice(-(lh.length + 1)) === '.' + lh) && HOPKW.test(l.text + ' ' + l.url) && !/\.(jpg|png|zip)$/i.test(l.url);
    }).sort(function (a, b) { return (KW.test(b.text) ? 1 : 0) - (KW.test(a.text) ? 1 : 0); }).slice(0, 2);
  };

  // ---- Google News RSS (recent announcements about internships), read through the same reader
  var newsUrl = function (q) { return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:120d') + '&hl=en-IN&gl=IN&ceid=IN:en'; };
  var readNews = function (q) {
    if (MOCK) return mockNews(q);
    var u = newsUrl(q);
    var parse = function (xml) {
      var items = [];
      try {
        var doc = new DOMParser().parseFromString(xml, 'text/xml');
        doc.querySelectorAll('item').forEach(function (it) {
          var g = function (s) { var n = it.querySelector(s); return n ? n.textContent.trim() : ''; };
          items.push({ title: g('title'), url: g('link'), date: g('pubDate'), src: g('source') });
        });
      } catch (e) {}
      if (!items.length) linksOf(xml).forEach(function (l) { if (/news\.google\.com\/rss\/articles/.test(l.url)) items.push({ title: l.text, url: l.url, date: '', src: '' }); });
      return items.filter(function (x) { return x.title && x.url && KW.test(x.title); }).slice(0, 8);
    };
    return fetchText(ORIGINS + encodeURIComponent(u), 30000).then(parse)
      .catch(function () { return fetchText(READER + u, 40000).then(parse); });
  };

  // ---------------------------------------------------------------- step 3: profile
  var clean = function (a, n) { return (Array.isArray(a) ? a : []).map(function (x) { return String(x).trim(); }).filter(Boolean).slice(0, n); };
  var PROFILE_SPEC = '{"subjects": [up to 15 key subjects or papers], "skills": [up to 12 practical skills, lab techniques or software], ' +
    '"orgs": [up to 10 specific kinds of Indian organisations that take interns in this field, e.g. boards, research institutes, departments, industries], ' +
    '"fields": [1 to 4 of: policy, law, finance, science, engg, it, agri, health, env, arts, mgmt]';
  var takeProfile = function (j, syl) {
    var p = S.p;
    p.subjects = clean(j.subjects, 15); p.skills = clean(j.skills, 12); p.orgs = clean(j.orgs, 10);
    p.fields = clean(j.fields, 4).filter(function (f) { return FIELDS[f]; });
    p.syl = syl; save();
  };
  var buildProfile = function () {
    var p = S.p, own = !!(pdf || p.paste);
    var head = 'An Indian student wants internships in their field.\n' + profileText() + '\n\n';
    if (own) {
      var parts = [{ text: head + (pdf ? 'The attached PDF is this student\'s syllabus. Read it.\n' : '') +
        (p.paste ? 'The student typed their subjects:\n' + p.paste + '\n' : '') + '\nReply with ONLY this JSON, in English:\n' + PROFILE_SPEC + '}' }];
      if (pdf) parts.push({ inline_data: { mime_type: 'application/pdf', data: pdf.b64 } });
      return (pdf ? gemini({ contents: [{ parts: parts }], generationConfig: { temperature: 0.2 } }, 'gemini-flash-latest').catch(function (e) {
        if (e.kind === 'key' || e.kind === 'net') throw e;
        return ask({ contents: [{ parts: parts }], generationConfig: { temperature: 0.2 } });
      }) : ask({ contents: [{ parts: parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } })).then(function (r) {
        var j = parseJSON(r.text, '{'); if (!j) throw new GemErr('other', 'Could not read the answer. Please try again.');
        takeProfile(j, { found: true, url: '', own: true });
      });
    }
    // 1 AI request: typical syllabus + likely official syllabus links; then try to open those links (no AI)
    var prompt = head + 'From your own knowledge of Indian university syllabi, describe this course. Also give up to 3 links where this university most likely publishes the official syllabus or curriculum for it (its own website; PDFs are fine).\n' +
      'Reply with ONLY this JSON, in English:\n' + PROFILE_SPEC + ', "syllabusUrls": ["https://..."]}';
    return ask({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }).then(function (r) {
      var j = parseJSON(r.text, '{'); if (!j) throw new GemErr('other', 'Could not read the answer. Please try again.');
      takeProfile(j, { found: false, url: '', own: false });
      var urls = clean(j.syllabusUrls, 3).filter(function (u) { return /^https?:\/\//.test(u); });
      // open the suggested pages; if one really is a syllabus, one more AI request reads the subjects from it
      var tryAt = function (i) {
        if (i >= urls.length) return null;
        return readPage(urls[i]).then(function (text) {
          var hits = (text.match(/syllabus|curriculum|semester|course code|credits|unit\s*[-–:]?\s*(i|1)\b|paper/gi) || []).length;
          return hits >= 6 ? { url: urls[i], text: text } : tryAt(i + 1);
        }, function () { return tryAt(i + 1); });
      };
      return tryAt(0).then(function (found) {
        if (!found) return;
        var pr = head + 'Below is text from this university\'s syllabus page (' + found.url + '). Read the subjects for this course from it.\n' +
          'Reply with ONLY this JSON, in English:\n' + PROFILE_SPEC + '}\n\nSYLLABUS TEXT:\n' + found.text.slice(0, 30000);
        return ask({ contents: [{ parts: [{ text: pr }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }).then(function (r2) {
          var j2 = parseJSON(r2.text, '{');
          if (j2 && clean(j2.subjects, 15).length >= 3) takeProfile(j2, { found: true, url: found.url, own: false });
        }, function () {});
      });
    });
  };

  var CHIPS = [['subjects', 'subjects'], ['skills', 'skills'], ['orgs', 'orgs']];
  var renderProfile = function () {
    var p = S.p;
    var syl = $('inSyl');
    if (p.syl) {
      syl.hidden = false;
      syl.innerHTML = p.syl.found
        ? esc(t('syllabusFrom')) + ' ' + (p.syl.url ? '<a href="' + esc(p.syl.url) + '" target="_blank" rel="noopener">' + esc(hostOf(p.syl.url) || p.syl.url) + '</a>' : (p.syl.own ? '✓' : ''))
        : esc(t('syllabusNone'));
    } else syl.hidden = true;
    $('inChips').innerHTML = CHIPS.map(function (c) {
      return '<div class="in-chip-g" data-g="' + c[0] + '"><h3>' + esc(t(c[1])) + '</h3><div class="in-chip-list">' +
        p[c[0]].map(function (x, i) { return '<span class="in-chip">' + esc(x) + '<button type="button" data-del="' + i + '" aria-label="Remove ' + esc(x) + '">✕</button></span>'; }).join('') +
        '</div><div class="in-chip-add"><input type="text" placeholder="' + esc(t('addPh')) + '" maxlength="80"><button type="button" class="in-btn" data-add>' + esc(t('add')) + '</button></div></div>';
    }).join('');
    $('inFields').innerHTML = Object.keys(FIELDS).filter(function (f) { return f !== 'any'; }).map(function (f) {
      return '<button type="button" data-f="' + f + '" aria-pressed="' + (p.fields.indexOf(f) >= 0) + '">' + esc(FIELDS[f]) + '</button>';
    }).join('');
    document.querySelectorAll('input[name="inDepth"]').forEach(function (r) { r.checked = r.value === S.depth; });
  };
  $('inChips').addEventListener('click', function (e) {
    var g = e.target.closest('[data-g]'); if (!g) return;
    var list = S.p[g.getAttribute('data-g')];
    var d = e.target.closest('[data-del]');
    if (d) { list.splice(+d.getAttribute('data-del'), 1); save(); renderProfile(); renderResults(); return; }
    if (e.target.closest('[data-add]')) {
      var inp = g.querySelector('input'), v = inp.value.trim();
      if (v && list.indexOf(v) < 0) { list.push(v); save(); renderProfile(); renderResults(); var again = document.querySelector('[data-g="' + g.getAttribute('data-g') + '"] input'); if (again) again.focus(); }
    }
  });
  $('inChips').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.parentNode.querySelector('[data-add]').click(); }
  });
  $('inFields').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]'); if (!b) return;
    var f = b.getAttribute('data-f'), i = S.p.fields.indexOf(f);
    if (i >= 0) S.p.fields.splice(i, 1); else S.p.fields.push(f);
    save(); renderProfile();
  });
  document.querySelectorAll('input[name="inDepth"]').forEach(function (r) {
    r.addEventListener('change', function () { S.depth = r.value; save(); });
  });

  // ---------------------------------------------------------------- the search (no Google Search)
  var relevant = function (list) {
    var f = S.p.fields;
    return list.map(function (x) {
      var score = x.fields.indexOf('any') >= 0 ? 1 : 0;
      f.forEach(function (k) { if (x.fields.indexOf(k) >= 0) score += 2; });
      return { x: x, s: score };
    }).filter(function (o) { return o.s > 0; }).sort(function (a, b) { return b.s - a.s; }).map(function (o) { return o.x; });
  };
  var stateName = function () { return S.p.state === 'all' || !S.p.state ? 'any Indian state' : S.p.state; };
  // pages to open per tier (state, central, psu, private), built-in programmes, PSUs, news searches
  var DEPTH2 = { quick: [6, 5, 3, 5, 3, 2, 4], std: [12, 10, 6, 11, 6, 4, 8], deep: [25, 20, 12, 22, 12, 8, 14] };
  var TIER_DESC = {
    state: function () { return 'the state government of ' + stateName() + ': departments, boards, corporations, state universities, research stations, district bodies'; },
    central: function () { return 'the Government of India: ministries, regulators, commodity boards, national institutes, research labs (CSIR, ICAR, ICMR, DRDO, ISRO and others), national schemes'; },
    psu: function () { return 'public sector undertakings (central and state PSUs)'; },
    private: function () { return 'private companies, startups and NGOs in India (not government)'; }
  };
  var ITEM_SPEC = '{"tier":"state|central|psu|private","title":"...","org":"...","place":"city/state or remote","stipend":"amount or unpaid or empty","deadline":"YYYY-MM-DD or empty","opens":"YYYY-MM-DD or empty",' +
    '"status":"open|soon|unclear","eligibility":"who can apply, short","why":"one short line: which subject or skill it matches","url":"link copied exactly from the excerpts"}';

  var discover = function () {
    var n = DEPTH2[S.depth] || DEPTH2.std;
    var prompt = 'You help an Indian student find internships.\n' + profileText() + '\n\n' +
      'Name real organisations in India that take students from this field as interns, summer trainees, project trainees or apprentices. Give exactly: ' +
      n[0] + ' from ' + TIER_DESC.state() + '; ' + n[1] + ' from ' + TIER_DESC.central() + '; ' + n[2] + ' from ' + TIER_DESC.psu() + '; ' + n[3] + ' from ' + TIER_DESC.private() + '. ' +
      'Prefer organisations closely tied to the subjects above, including lesser-known specialised bodies. For each, give the URL of its official careers, recruitment, notices or internship page if you know it, otherwise its official home page. ' +
      'Only real official websites. Reply with ONLY this JSON: {"state":[{"org":"...","url":"https://..."}],"central":[...],"psu":[...],"private":[...]}';
    return ask({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: 'application/json' } })
      .then(function (r) { return parseJSON(r.text, '{') || {}; }, function (e) { if (e.kind === 'key') throw e; return { failed: e }; })
      .then(function (j) {
        var failed = j.failed;
        var pages = [], seen = {};
        var add = function (tier, org, url, hop) {
          if (!/^https?:\/\//.test(url || '')) return;
          var k = url.toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '');
          if (seen[k]) return; seen[k] = 1;
          pages.push({ tier: tier, org: String(org || hostOf(url)).slice(0, 120), url: url, hop: !!hop, done: false });
        };
        TIERS.forEach(function (tr, i) {
          (Array.isArray(j[tr]) ? j[tr] : []).slice(0, n[i]).forEach(function (o) { add(tr, o && o.org, o && o.url); });
          if (tr === 'central') relevant(window.INTERN_CENTRAL).slice(0, n[4]).forEach(function (c) { add('central', c.name, c.url); });
          if (tr === 'psu') relevant(window.INTERN_PSU).slice(0, n[5]).forEach(function (c) { add('psu', c.name, c.url); });
        });
        var words = S.p.subjects.slice(0, 4).concat(S.p.orgs.slice(0, 4));
        var st = S.p.state && S.p.state !== 'all' ? S.p.state + ' ' : '';
        var qs = [S.p.course + ' internship', st + 'internship students ' + (S.p.fields[0] ? FIELDS[S.p.fields[0]].split(',')[0] : S.p.course)];
        words.forEach(function (w) { qs.push(w + ' internship'); });
        var news = qs.filter(Boolean).slice(0, n[6]).map(function (q) { return { q: q, done: false }; });
        return { pages: pages, news: news, failed: failed };
      });
  };

  var OFFICIAL = /\.(gov\.in|nic\.in|res\.in|ac\.in|edu\.in|gov)$/;
  var curatedHosts = window.INTERN_CENTRAL.concat(window.INTERN_PSU).map(function (c) { return hostOf(c.url); });
  var keyOf = function (it) {
    return (it.url || '').toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '') + '|' +
      String(it.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  };
  var sameSite = function (a, b) { return a && b && (a === b || a.slice(-(b.length + 1)) === '.' + b || b.slice(-(a.length + 1)) === '.' + a); };
  // opts: { tier, hosts (pages actually opened), raw (picked by code), news, src (page it came from) }
  var addItems = function (arr, opts) {
    var added = 0, now = today();
    (Array.isArray(arr) ? arr : []).forEach(function (x) {
      if (!x || !x.url || !/^https?:\/\//.test(x.url) || !(x.title || x.org)) return;
      var tier = TIERS.indexOf(x.tier) >= 0 ? x.tier : opts.tier;
      if (!tier) return;
      var dl = /^\d{4}-\d\d-\d\d$/.test(x.deadline || '') ? x.deadline : '';
      if (dl && dl < now) return;
      var h = hostOf(x.url);
      var it = {
        tier: tier, title: String(x.title || 'Internship').slice(0, 160), org: String(x.org || '').slice(0, 120),
        place: String(x.place || '').slice(0, 80), stipend: String(x.stipend || '').slice(0, 60), deadline: dl,
        opens: /^\d{4}-\d\d-\d\d$/.test(x.opens || '') ? x.opens : '', who: String(x.eligibility || '').slice(0, 220),
        why: String(x.why || '').slice(0, 200), url: x.url,
        status: x.status === 'open' ? 'open' : x.status === 'soon' ? 'soon' : 'lead',
        verified: !opts.news && (opts.hosts || []).some(function (g) { return sameSite(h, g); }),
        official: OFFICIAL.test(h) || curatedHosts.indexOf(h) >= 0, news: !!opts.news, raw: !!opts.raw, src: opts.src || '', at: now
      };
      it.id = keyOf(it);
      var old = S.res.filter(function (r) { return r.id === it.id; })[0];
      if (old) { if (old.raw && !it.raw) Object.assign(old, it); return; }
      S.res.push(it); added++;
    });
    return added;
  };

  var startRun = function (asNight) {
    readForm();
    if (!getKey() && !MOCK) { show(2); msg('inMsg2', t('needKey'), true); return; }
    S.run = { v: 2, phase: 'discover', pages: [], news: [], snips: [], ai: 0, dead: {}, note: '', tasks: [], stat: { orgs: 0, opened: 0, failed: 0, links: 0, news: 0, ai: 0, gone: 0 } };
    S.res = S.res.filter(function (x) { return S.marks[x.id] === 'saved' || S.marks[x.id] === 'applied'; });
    show(4); setLine(t('phDiscover')); renderProgress();
    if (asNight) nightOn();
    loop();
  };
  $('inStartNow').addEventListener('click', function () { startRun(false); });
  $('inStartNight').addEventListener('click', function () { askNotify(); startRun(true); });
  $('inNightAgain').addEventListener('click', function () { askNotify(); nightOn(); if (!running) loop(); });
  var retryFailed = function () {
    var R = S.run; if (!R || R.v !== 2) return;
    R.dead = {}; R.note = ''; R.aiPaused = false;
    if (R.redo) { R.phase = 'discover'; R.redo = false; }
    if (R.readerFailed) { R.pages.forEach(function (x) { if (x.ok === false) x.done = false; }); R.news.forEach(function (x) { if (x.ok === false) x.done = false; }); R.readerFailed = false; }
  };
  $('inResume').addEventListener('click', function () {
    if (!S.run) return;
    retryFailed();
    show(4); loop();
  });
  $('inStop').addEventListener('click', function () { stopAsked = true; setLine(t('stopped')); });
  $('inNightStop').addEventListener('click', function () { stopAsked = true; nightOff(); });

  var setLine = function (s) { $('inProgLine').textContent = s; $('inNightLine').textContent = s; };
  var pending = function () {
    var r = S.run; if (!r || r.v !== 2) return false;
    return r.phase === 'discover' || !!r.redo || r.pages.some(function (x) { return !x.done; }) || r.news.some(function (x) { return !x.done; }) || r.snips.some(function (x) { return !x.done; }) ||
      S.res.some(function (x) { return !x.news && !x.checked; }) ||
      (r.readerFailed && r.pages.some(function (x) { return x.ok === false; }));
  };

  var loop = function () {
    if (running || !S.run) return;
    if (S.run.v !== 2) { S.run = null; save(); return; }
    running = true; stopAsked = false;
    $('inStop').hidden = false; $('inResume').hidden = true;
    var netFails = 0, readFails = 0, rateFails = 0;
    var wait = function (ms) {
      var end = Date.now() + ms;
      return new Promise(function (res) {
        var tick = function () {
          var left = Math.ceil((end - Date.now()) / 1000);
          if (left <= 0 || stopAsked) return res();
          setLine(t('waiting', { n: left })); setTimeout(tick, 1000);
        };
        tick();
      });
    };
    var R = S.run;
    R.stat = R.stat || { orgs: 0, opened: 0, failed: 0, links: 0, news: 0, ai: 0, gone: 0 };
    var aiErr = function (e, again) {
      if (e.kind === 'key') return finish(t('errKey'), true);
      if (e.kind === 'net') { if (++netFails > 4) return finish(t('errNet'), true); return wait(15000).then(again); }
      if (e.message) msg('inMsg4', t('lastErr', { m: String(e.message).slice(0, 220) }));
      if (e.kind === 'rate' && ++rateFails <= 3) return wait(e.wait || 60000).then(again);
      return null;   // daily limit or other: caller decides
    };

    var step = function () {
      if (stopAsked) return finish(t('stopped'));
      renderProgress();

      // 1) one AI request: which organisations to open
      if (R.phase === 'discover') {
        setLine(t('phDiscover'));
        return discover().then(function (d) {
          var have = {};
          R.pages.forEach(function (x) { have[x.url] = 1; }); R.news.forEach(function (x) { have['q:' + x.q] = 1; });
          R.pages = R.pages.concat(d.pages.filter(function (x) { return !have[x.url]; }));
          R.news = R.news.concat(d.news.filter(function (x) { return !have['q:' + x.q]; }));
          // if the AI could not name organisations today, the built-in list still runs; ask again on "Continue"
          R.redo = !!d.failed; R.stat.orgs = R.pages.length;
          if (d.failed && d.failed.message) msg('inMsg4', t('lastErr', { m: String(d.failed.message).slice(0, 220) }));
          R.phase = 'read'; save();
          return step();
        }, function (e) { return aiErr(e, step) || finish(t('errKey'), true); });
      }

      // 2) open the pages (no AI), pick out internship mentions, follow 1 careers/notices link
      var pg = R.pages.filter(function (x) { return !x.done; })[0];
      if (pg) {
        var all = R.pages.length, i = R.pages.indexOf(pg);
        setLine(t('phRead', { n: i + 1, s: all }) + ' · ' + pg.org);
        return readPage(pg.url).then(function (md) {
          readFails = 0;
          pg.done = true; pg.ok = true;
          var title = (md.match(/^Title:\s*(.+)$/m) || [])[1];
          var sn = snippetsOf(md);
          var raw = rawItems(md, pg);
          if (sn.length || raw.length) R.snips.push({ tier: pg.tier, org: pg.org, url: pg.url, title: title || '', text: sn.join('\n'), links: raw.map(function (x) { return '[' + x.title + '](' + x.url + ')'; }).join('\n'), done: false });
          pg.n = addItems(raw, { tier: pg.tier, hosts: [hostOf(pg.url)], raw: true, src: pg.url });
          R.stat.opened++; R.stat.links += pg.n;
          if (!pg.hop) hopsOf(md, pg).forEach(function (l) {
            if (R.pages.some(function (x) { return x.url === l.url; })) return;
            R.pages.splice(R.pages.indexOf(pg) + 1, 0, { tier: pg.tier, org: pg.org, url: l.url, hop: true, done: false });
          });
          save(); renderResults();
          return sleep(READ_GAP).then(step);
        }, function () {
          pg.done = true; pg.ok = false; R.stat.failed++; save();
          // if nothing at all can be opened from this phone, say so instead of failing silently
          if (++readFails >= 6 && !R.pages.some(function (x) { return x.ok; })) { R.readerFailed = true; save(); return finish(t('readerFail'), true); }
          return sleep(1500).then(step);
        });
      }

      // 3) recent news reports about internships in this field (no AI)
      var nw = R.news.filter(function (x) { return !x.done; })[0];
      if (nw) {
        setLine(t('phNews') + ' · ' + nw.q);
        return readNews(nw.q).then(function (items) {
          nw.done = true; nw.ok = true;
          if (items.length) R.snips.push({ tier: '', org: 'News', url: '', news: true, text: items.map(function (x) { return '- [' + x.title + '](' + x.url + ')' + (x.date ? ' (' + x.date + ')' : ''); }).join('\n'), links: '', done: false });
          R.stat.news += addItems(items.map(function (x) { return { title: x.title, org: x.src || 'News report', url: x.url, status: 'unclear', why: '' }; }), { tier: 'private', news: true, raw: true });
          save(); renderResults();
          return sleep(READ_GAP).then(step);
        }, function () { nw.done = true; nw.ok = false; save(); return sleep(1000).then(step); });
      }

      // 4) a few AI requests: turn what was found into proper cards (batched to save the free allowance)
      var batch = [], size = 0;
      R.snips.forEach(function (s) {
        if (R.aiPaused || s.done || size > 14000) return;
        var block = (s.news ? 'NEWS REPORTS (not official pages)' : 'PAGE ' + s.url + ' — ' + s.org + ' — tier: ' + s.tier) + '\n' + s.text + (s.links ? '\nLINKS ON THE PAGE:\n' + s.links : '');
        block = block.slice(0, 4000); size += block.length; batch.push({ s: s, block: block });
      });
      if (batch.length) {
        var tot = R.snips.length, done = R.snips.filter(function (x) { return x.done; }).length;
        setLine(t('phAi', { n: done + 1, s: tot }));
        var prompt = 'You help an Indian student find internships.\n' + profileText() + '\nToday: ' + today() + '\n\n' +
          'Below are excerpts read today from official websites (and some news reports). List every internship, summer training, summer research, project traineeship, studentship or apprenticeship programme mentioned in them that a student of this course could apply to. ' +
          'Include programmes even when no date is given (status "unclear"); use "open" only if the excerpt says applications are open now, "soon" if it gives a future opening. ' +
          'Use only what the excerpts say. The url must be a link copied exactly from the excerpts (or the page address). Set tier from the page label (for news, decide: state/central government, PSU or private). ' +
          'Leave out only: anything whose last date has clearly passed, regular job vacancies for experienced staff, internal staff training, and anything that asks students to pay. ' +
          'Reply with ONLY a JSON array, or [] if none: [' + ITEM_SPEC + ']\n\n' + batch.map(function (b) { return b.block; }).join('\n\n---\n\n');
        return ask({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }).then(function (r) {
          rateFails = 0; netFails = 0; msg('inMsg4', '');
          var arr = parseJSON(r.text, '[');
          if (Array.isArray(arr)) {
            var hasNews = batch.some(function (b) { return b.s.news; });
            var hosts = batch.filter(function (b) { return !b.s.news; }).map(function (b) { return hostOf(b.s.url); });
            var seenText = batch.map(function (b) { return b.block; }).join('\n');
            var norm = function (u) { return String(u || '').replace(/[#].*$/, '').replace(/\/+$/, ''); };
            arr = arr.filter(function (x) {
              if (!x || !x.url) return false;
              if (seenText.indexOf(norm(x.url)) >= 0) return true;
              // a link the AI made up: fall back to the official page it came from, if it named that site
              var page = batch.filter(function (b) { return !b.s.news && sameSite(hostOf(b.s.url), hostOf(x.url)); })[0];
              if (page) { x.url = page.s.url; return true; }
              return false;
            });
            arr.forEach(function (x) {
              var fromNews = hasNews && !hosts.some(function (g) { return sameSite(hostOf(x.url), g); });
              // an AI card for the same link replaces the raw find; raw finds the AI skipped stay as "to check"
              var nu = norm(x.url).toLowerCase();
              S.res = S.res.filter(function (y) { return !(y.raw && norm(y.url).toLowerCase() === nu && !S.marks[y.id]); });
              if (addItems([x], { tier: x.tier, hosts: hosts, news: fromNews })) R.stat.ai++;
            });
          }
          batch.forEach(function (b) { b.s.done = true; });
          R.ai++; save(); renderResults();
          return sleep(GAP).then(step);
        }, function (e) {
          var h = aiErr(e, step);
          if (h) return h;
          // today's AI limit is used up: keep the raw finds (still check their links), tidy them another day
          R.aiPaused = true; save();
          return step();
        });
      }
      // 5) check that every card's link still opens (no AI); dead links are removed
      var unchecked = S.res.filter(function (x) { return !x.news && !x.checked; });
      if (unchecked.length) {
        var x = unchecked[0], tot2 = S.res.filter(function (y) { return !y.news; }).length;
        setLine(t('phCheck', { n: tot2 - unchecked.length + 1, s: tot2 }));
        return checkLink(x.url).then(function (alive) {
          x.checked = true;
          if (!alive && !S.marks[x.id]) { S.res.splice(S.res.indexOf(x), 1); R.stat.gone++; }
          save(); renderResults();
          return sleep(READ_GAP).then(step);
        });
      }
      if (R.aiPaused && R.snips.some(function (x) { return !x.done; })) return finish(t('aiLater', { n: R.pages.filter(function (x) { return x.ok; }).length }));
      return finish('');
    };
    step();
  };
  var finish = function (note, bad) {
    running = false;
    var R = S.run, left = pending();
    R.note = note || ''; R.finished = left ? 0 : Date.now(); R.phase = R.phase === 'discover' && left ? 'discover' : R.phase;
    save();
    var n = S.res.length;
    var line = note || t('done', { n: n });
    setLine(line);
    // open the first tab that has something in it
    if (!S.res.some(function (x) { return x.tier === S.tab; })) {
      var tr = TIERS.filter(function (k) { return S.res.some(function (x) { return x.tier === k; }); })[0];
      if (tr) S.tab = tr;
    }
    var lastE = $('inMsg4').hidden ? '' : $('inMsg4').textContent;
    var st = R.stat;
    var sum = st ? t('summary', { o: st.opened, f: st.failed, l: st.links, n: st.news, a: st.ai, g: st.gone }) : '';
    if (!left && !note) msg('inMsg4', sum); else msg('inMsg4', (lastE && lastE !== sum ? lastE + ' · ' : '') + sum, !!bad);
    $('inStop').hidden = true; $('inResume').hidden = !left; $('inNightAgain').hidden = !left;
    renderProgress(); renderResults();
    if (night) {
      $('inNightLine').textContent = line;
      notify(t('notifDone', { n: n }));
      setTimeout(nightOff, 4000);
    }
  };

  var renderProgress = function () {
    var r = S.run;
    if (!r || r.v !== 2) return;
    var chk = S.res.filter(function (x) { return !x.news; });
    var all = 1 + r.pages.length + r.news.length + r.snips.length + chk.length;
    var done = (r.phase === 'discover' ? 0 : 1) + r.pages.filter(function (x) { return x.done; }).length + r.news.filter(function (x) { return x.done; }).length + r.snips.filter(function (x) { return x.done; }).length +
      chk.filter(function (x) { return x.checked; }).length;
    var pct = Math.max(3, Math.round(done / all * 100));
    $('inBar').style.width = pct + '%'; $('inNightBar').style.width = pct + '%';
    $('inProgCounts').innerHTML = TIERS.map(function (tr) { return '<span>' + esc(t(TIER_T[tr])) + ' <b>' + S.res.filter(function (x) { return x.tier === tr; }).length + '</b></span>'; }).join('');
    $('inNightBig').textContent = S.res.length;
    var left = pending();
    if (!running && r.note) setLine(r.note);
    else if (!running && !left) setLine(t('done', { n: S.res.length }));
    $('inResume').hidden = running || !left;
    $('inNightAgain').hidden = running || !left;
    $('inStop').hidden = !running;
  };

  // ---------------------------------------------------------------- night mode
  var nightOn = function () {
    night = true; $('inNight').hidden = false;
    document.documentElement.style.overflow = 'hidden';
    getWake();
    if (document.documentElement.requestFullscreen && matchMedia('(max-width:900px)').matches) document.documentElement.requestFullscreen().catch(function () {});
  };
  var nightOff = function () {
    night = false; $('inNight').hidden = true; document.documentElement.style.overflow = '';
    if (wake) { try { wake.release(); } catch (e) {} wake = null; }
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
  };
  var getWake = function () {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {});
  };
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (night) getWake();
      if (S.run && !running && S.step === 4 && pending() && !S.run.note) loop();
    }
  });
  var askNotify = function () {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(function () {});
  };
  var notify = function (text) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (reg) reg.showNotification('ranjithkb.com', { body: text, icon: '/assets/icons/site-192.png', tag: 'ifind' });
    }).catch(function () {});
  };

  // ---------------------------------------------------------------- results
  var FILTERS = [['all', 'fAll'], ['open', 'fOpen'], ['soon', 'fSoon'], ['lead', 'fLead'], ['saved', 'fSaved'], ['applied', 'fApplied']];
  var fmtDate = function (d) {
    if (!d) return '';
    try { return new Date(d + 'T12:00:00').toLocaleDateString(lang === 'en' ? 'en-IN' : lang + '-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; }
  };
  var visible = function (tier) {
    return S.res.filter(function (x) {
      var m = S.marks[x.id];
      if (x.tier !== tier || m === 'hidden') return false;
      var f = S.filter;
      if (f === 'saved') return m === 'saved';
      if (f === 'applied') return m === 'applied';
      if (f === 'open' || f === 'soon' || f === 'lead') return x.status === f;
      return true;
    }).sort(function (a, b) {
      var o = { open: 0, soon: 1, lead: 2 };
      if (o[a.status] !== o[b.status]) return o[a.status] - o[b.status];
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1;
    });
  };
  var card = function (x) {
    var m = S.marks[x.id];
    var st = { open: ['open', 'stOpen'], soon: ['soon', 'stSoon'], lead: ['lead', 'stLead'] }[x.status];
    var rows = [
      x.deadline ? ['deadline', fmtDate(x.deadline)] : null,
      x.opens && x.status !== 'open' ? ['opens', fmtDate(x.opens)] : null,
      x.place ? ['where', x.place] : null,
      x.stipend ? ['stipend', x.stipend] : null,
      x.who ? ['who', x.who] : null
    ].filter(Boolean);
    var expl = x.expl && x.expl[lang];
    return '<li class="in-card' + (m === 'applied' ? ' is-applied' : '') + '" data-id="' + esc(x.id) + '">' +
      '<div class="in-card-top"><span class="in-st ' + st[0] + '">' + esc(t(st[1])) + '</span>' +
      '<span class="in-ver ' + (x.verified ? 'ok' : 'no') + '">' + esc(t(x.raw && !x.news ? 'rawItem' : x.verified ? 'verified' : x.news ? 'newsItem' : (x.official ? 'official' : 'unverified'))) + '</span></div>' +
      '<h3>' + esc(x.title) + '</h3>' + (x.org ? '<p class="in-org">' + esc(x.org) + '</p>' : '') +
      (rows.length ? '<dl>' + rows.map(function (r) { return '<dt>' + esc(t(r[0])) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' : '') +
      (x.why ? '<p class="in-why"><b>' + esc(t('why')) + ':</b> ' + esc(x.why) + '</p>' : '') +
      (expl ? '<p class="in-expl" lang="' + lang + '">' + esc(expl) + '</p>' : '') +
      '<div class="in-card-acts"><a class="in-go" href="' + esc(x.url) + '" target="_blank" rel="noopener nofollow">' + esc(t('apply')) + '</a>' +
      '<button type="button" data-act="saved" aria-pressed="' + (m === 'saved') + '">' + esc(t(m === 'saved' ? 'saved' : 'save')) + '</button>' +
      '<button type="button" data-act="applied" aria-pressed="' + (m === 'applied') + '">' + esc(t(m === 'applied' ? 'applied' : 'markApplied')) + '</button>' +
      (x.deadline ? '<button type="button" data-act="cal">' + esc(t('cal')) + '</button>' : '') +
      (lang !== 'en' && !expl ? '<button type="button" data-act="explain">' + esc(t('explain')) + '</button>' : '') +
      '<button type="button" data-act="hidden">' + esc(t('hideIt')) + '</button></div></li>';
  };
  var gLink = function (q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); };
  var renderResults = function () {
    var box = $('inResults');
    var have = S.res.length > 0 || !!S.run || S.p.subjects.length > 0;
    box.hidden = !have;
    if (!have) return;
    if (TIERS.indexOf(S.tab) < 0) S.tab = 'state';
    $('inTabs').innerHTML = TIERS.map(function (tr) {
      var n = S.res.filter(function (x) { return x.tier === tr && S.marks[x.id] !== 'hidden'; }).length;
      return '<button type="button" role="tab" data-tab="' + tr + '" aria-selected="' + (S.tab === tr) + '">' + esc(t(TIER_T[tr])) + '<small>' + n + '</small></button>';
    }).join('');
    $('inFilters').innerHTML = FILTERS.map(function (f) {
      return '<button type="button" data-filter="' + f[0] + '" aria-pressed="' + (S.filter === f[0]) + '">' + esc(t(f[1])) + '</button>';
    }).join('');
    var list = visible(S.tab);
    $('inList').innerHTML = list.map(card).join('');
    $('inNone').hidden = list.length > 0;

    var cur = '';
    if (S.tab === 'central') {
      var c = relevant(window.INTERN_CENTRAL);
      cur = '<div class="in-cur"><h3>' + esc(t('curatedCentral')) + '</h3><ul>' + c.map(function (x) {
        return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.name) + '</a><p>' + esc(x.by) + ' · ' + esc(x.when) + (x.note ? ' · ' + esc(x.note) : '') + '</p></li>';
      }).join('') + '</ul></div>';
    } else if (S.tab === 'psu') {
      var ps = relevant(window.INTERN_PSU);
      if (ps.length) cur = '<div class="in-cur"><h3>' + esc(t('curatedPsu')) + '</h3><ul>' + ps.map(function (x) {
        return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.name) + '</a></li>';
      }).join('') + '</ul></div>';
    }
    $('inCurated').innerHTML = cur;

    var kw = S.p.subjects.slice(0, 2).concat(S.p.orgs.slice(0, 2), [S.p.course]).filter(Boolean).slice(0, 4);
    var st = S.p.state && S.p.state !== 'all' ? S.p.state + ' ' : '';
    var qs = kw.map(function (k) {
      return S.tab === 'state' ? st + k + ' internship site:gov.in' :
        S.tab === 'central' ? k + ' internship government of India site:gov.in' :
        S.tab === 'psu' ? k + ' PSU summer training internship' : k + ' internship India';
    });
    $('inMore').innerHTML = qs.length ? '<h3>' + esc(t('moreSearch')) + '</h3><div>' + qs.map(function (q) {
      return '<a href="' + esc(gLink(q)) + '" target="_blank" rel="noopener">🔎 ' + esc(q) + '</a>';
    }).join('') + '</div>' : '';
    renderAgg();
  };
  // ---- other internship sites: open their own search pages (no scraping, no AI quota)
  var slug = function (x) { return String(x || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  var aggWord = '';
  var AGG = [
    { name: 'Internshala', url: function (w) { return gLink('site:internshala.com ' + w + ' internship'); } },
    { name: 'LinkedIn', url: function (w, st) { return 'https://www.linkedin.com/jobs/search/?keywords=' + encodeURIComponent(w) + '&location=' + encodeURIComponent(st ? st + ', India' : 'India') + '&f_JT=I'; } },
    { name: 'Indeed', url: function (w, st) { return 'https://in.indeed.com/jobs?q=' + encodeURIComponent(w + ' internship') + (st ? '&l=' + encodeURIComponent(st) : ''); } },
    { name: 'Naukri', url: function (w) { return gLink('site:naukri.com ' + w + ' internship'); } },
    { name: 'Unstop', url: function (w, st) { return st ? 'https://unstop.com/internship/internship-in-' + slug(st) : 'https://unstop.com/internship'; } },
    { name: 'Unstop · Govt', url: function () { return 'https://unstop.com/internship/government-internship'; } },
    { name: 'Google Jobs', url: function (w, st) { return 'https://www.google.com/search?ibp=htl;jobs&q=' + encodeURIComponent(w + ' internship ' + (st || 'India')); } },
    { name: 'AICTE portal', url: function () { return 'https://internship.aicte-india.org'; } },
    { name: 'PM Internship', url: function () { return 'https://pminternship.mca.gov.in'; } },
    { name: 'NATS apprenticeship', url: function () { return 'https://nats.education.gov.in'; } },
    { name: 'Apprenticeship India', url: function () { return 'https://www.apprenticeshipindia.gov.in'; } }
  ];
  var renderAgg = function () {
    var words = [S.p.course].concat(S.p.subjects.slice(0, 4), S.p.skills.slice(0, 2)).filter(Boolean)
      .filter(function (w, i, a) { return a.indexOf(w) === i; });
    if (!words.length) { $('inAgg').innerHTML = ''; return; }
    if (words.indexOf(aggWord) < 0) aggWord = words[0];
    var st = S.p.state && S.p.state !== 'all' ? S.p.state : '';
    $('inAgg').innerHTML = '<h3>' + esc(t('aggHead')) + '</h3><p class="in-small">' + esc(t('aggHelp')) + '</p>' +
      '<label class="in-agg-w"><span>' + esc(t('aggWord')) + '</span><select id="inAggW">' + words.map(function (w) {
        return '<option' + (w === aggWord ? ' selected' : '') + '>' + esc(w) + '</option>';
      }).join('') + '</select></label>' +
      '<div class="in-agg-list">' + AGG.map(function (a) {
        return '<a href="' + esc(a.url(aggWord, st)) + '" target="_blank" rel="noopener">' + esc(a.name) + ' ↗</a>';
      }).join('') + '</div>';
  };
  $('inAgg').addEventListener('change', function (e) { if (e.target.id === 'inAggW') { aggWord = e.target.value; renderAgg(); } });

  $('inTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.getAttribute('data-tab'); save(); renderResults();
  });
  $('inFilters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]'); if (!b) return; S.filter = b.getAttribute('data-filter'); save(); renderResults();
  });
  $('inList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var id = b.closest('[data-id]').getAttribute('data-id');
    var x = S.res.filter(function (r) { return r.id === id; })[0]; if (!x) return;
    var a = b.getAttribute('data-act');
    if (a === 'cal') return download(ics([x]), 'internship-deadline.ics', 'text/calendar');
    if (a === 'explain') {
      b.disabled = true; b.textContent = t('explaining');
      var L = lang === 'ml' ? 'Malayalam' : 'Hindi';
      var pr = 'Explain this internship to a student in simple ' + L + ' in 2–3 short sentences: what it is, who can apply and the last date. Keep organisation names in English.\n' +
        JSON.stringify({ title: x.title, org: x.org, place: x.place, stipend: x.stipend, deadline: x.deadline, opens: x.opens, eligibility: x.who });
      gemini({ contents: [{ parts: [{ text: pr }] }], generationConfig: { temperature: 0.3 } }, PLAIN_MODEL)
        .then(function (r) { x.expl = x.expl || {}; x.expl[lang] = r.text.trim().slice(0, 600); save(); renderResults(); })
        .catch(function (er) { b.disabled = false; b.textContent = er.kind === 'key' ? t('errKey') : t('explain'); });
      return;
    }
    S.marks[id] = S.marks[id] === a ? undefined : a;
    if (!S.marks[id]) delete S.marks[id];
    save(); renderResults();
  });

  // ---------------------------------------------------------------- exports
  var download = function (text, name, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  var ics = function (items) {
    var stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    var line = function (s) { return String(s).replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, ' '); };
    return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ranjithkb.com//Internship finder//EN\r\n' + items.filter(function (x) { return x.deadline; }).map(function (x, i) {
      var d = x.deadline.replace(/-/g, '');
      return 'BEGIN:VEVENT\r\nUID:ifind-' + d + '-' + i + '-' + Math.abs(hash(x.id)) + '@ranjithkb.com\r\nDTSTAMP:' + stamp + '\r\nDTSTART;VALUE=DATE:' + d +
        '\r\nSUMMARY:' + line('Last date: ' + x.title + (x.org ? ' — ' + x.org : '')) + '\r\nDESCRIPTION:' + line(x.url) + '\r\nURL:' + x.url +
        '\r\nBEGIN:VALARM\r\nTRIGGER:-P3D\r\nACTION:DISPLAY\r\nDESCRIPTION:Internship deadline in 3 days\r\nEND:VALARM\r\nEND:VEVENT\r\n';
    }).join('') + 'END:VCALENDAR\r\n';
  };
  var hash = function (s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  $('inCsv').addEventListener('click', function () {
    var cols = ['tier', 'status', 'title', 'org', 'place', 'stipend', 'deadline', 'opens', 'who', 'why', 'url', 'verified', 'mark'];
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = S.res.filter(function (x) { return S.marks[x.id] !== 'hidden'; }).map(function (x) {
      return cols.map(function (c) { return q(c === 'mark' ? (S.marks[x.id] || '') : x[c]); }).join(',');
    });
    download('﻿' + cols.join(',') + '\n' + rows.join('\n'), 'internships.csv', 'text/csv');
  });
  $('inIcs').addEventListener('click', function () {
    var items = S.res.filter(function (x) { return x.deadline && S.marks[x.id] !== 'hidden'; });
    download(ics(items), 'internship-deadlines.ics', 'text/calendar');
  });

  // ---------------------------------------------------------------- backup & restore
  var backupData = function () {
    return JSON.stringify({ app: 'ranjithkb-internships', v: 1, saved: new Date().toISOString(), lang: lang,
      data: { depth: S.depth, p: S.p, run: S.run, res: S.res, marks: S.marks } });
  };
  var keepMsg = function (s, bad) { msg('inMsgKeep', s, bad); if (s) setTimeout(function () { msg('inMsgKeep', ''); }, 5000); };
  $('inBackup').addEventListener('click', function () {
    var name = 'internship-finder-backup.json', text = backupData();
    var file;
    try { file = new File([text], name, { type: 'application/json' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Internship finder backup' }).catch(function (e) { if (e && e.name !== 'AbortError') download(text, name, 'application/json'); });
    } else download(text, name, 'application/json');
  });
  var applyBackup = function (obj) {
    if (!obj || obj.app !== 'ranjithkb-internships' || !obj.data) { keepMsg(t('badFile'), true); return false; }
    var d = obj.data;
    S.p = Object.assign(blank().p, d.p || {}); S.depth = d.depth || 'std';
    S.run = d.run || null; S.res = Array.isArray(d.res) ? d.res : []; S.marks = d.marks || {};
    if (S.run && S.run.v !== 2) S.run = null;
    S.step = S.res.length || S.run ? 4 : S.p.subjects.length ? 3 : 1;
    if (obj.lang && TT[obj.lang]) { lang = obj.lang; try { localStorage.setItem(LANGSTORE, lang); } catch (e) {} }
    save(); fillForm(); applyLang(); show(S.step); keepMsg(t('restored'));
    return true;
  };
  $('inOpen').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    var input = this;
    f.text().then(function (s) { var o; try { o = JSON.parse(s); } catch (e) {} applyBackup(o); input.value = ''; });
  });

  // restore link: profile only, deflated into the #fragment (never sent to the server)
  var b64u = function (buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var unb64u = function (s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  var pack = function (obj) {
    var data = new TextEncoder().encode(JSON.stringify(obj));
    if (!window.CompressionStream) return Promise.resolve('j' + b64u(data));
    var cs = new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw')));
    return cs.arrayBuffer().then(function (b) { return 'z' + b64u(b); });
  };
  var unpack = function (s) {
    var kind = s[0], bytes = unb64u(s.slice(1));
    if (kind === 'j') return Promise.resolve(JSON.parse(new TextDecoder().decode(bytes)));
    var ds = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
    return ds.text().then(JSON.parse);
  };
  var restoreLink = function () {
    var p = Object.assign({}, S.p); delete p.paste;
    return pack({ v: 1, lang: lang, depth: S.depth, p: p }).then(function (z) {
      return location.origin + location.pathname + '#r=' + z;
    });
  };
  $('inEmail').addEventListener('click', function () {
    restoreLink().then(function (link) {
      location.href = 'mailto:?subject=' + encodeURIComponent('Internship finder — my restore link') + '&body=' + encodeURIComponent(link);
    });
  });
  $('inCopy').addEventListener('click', function () {
    var b = this;
    restoreLink().then(function (link) {
      return navigator.clipboard.writeText(link).then(function () { b.textContent = t('copied'); setTimeout(function () { b.textContent = t('copyLink'); }, 2500); });
    }).catch(function () {});
  });
  var readHash = function () {
    var m = location.hash.match(/^#r=([A-Za-z0-9_-]+)$/);
    if (!m) return;
    unpack(m[1]).then(function (o) {
      history.replaceState(null, '', location.pathname + location.search);
      if (!o || !o.p) return;
      if (!confirm(t('restoreAsk'))) return;
      S.p = Object.assign(blank().p, o.p); S.depth = o.depth || S.depth;
      if (o.lang && TT[o.lang]) { lang = o.lang; try { localStorage.setItem(LANGSTORE, lang); } catch (e) {} }
      save(); fillForm(); applyLang(); show(S.p.subjects.length ? 3 : 1);
      if (!getKey()) show(2);
      keepMsg(t('restored'));
    }).catch(function () {});
  };

  // laptops: keep a copy in a file the student picks (e.g. in their Google Drive folder); updates by itself
  var idb = function (mode, fn) {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej();
      var o = indexedDB.open('ifind', 1);
      o.onupgradeneeded = function () { o.result.createObjectStore('h'); };
      o.onsuccess = function () { var tx = o.result.transaction('h', mode); var r = fn(tx.objectStore('h')); tx.oncomplete = function () { res(r && r.result); }; tx.onerror = rej; };
      o.onerror = rej;
    });
  };
  var fh = null, fhOk = false, fhTimer = null;
  var folderUI = function () {
    $('inFolderH').textContent = fh ? (fhOk ? t('folderOn', { m: fh.name }) : t('folderH')) : t('folderH');
    $('inFolder').lastChild.textContent = fh && !fhOk ? t('reconnect') : t('folder');
  };
  if (window.showSaveFilePicker && !/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    $('inFolderBox').hidden = false;
    idb('readonly', function (s) { return s.get('file'); }).then(function (h) {
      if (!h) return;
      fh = h;
      return h.queryPermission({ mode: 'readwrite' }).then(function (p) { fhOk = p === 'granted'; folderUI(); });
    }).catch(function () {});
    $('inFolder').addEventListener('click', function () {
      var pick = fh && !fhOk
        ? fh.requestPermission({ mode: 'readwrite' }).then(function (p) { if (p !== 'granted') throw 0; return fh; })
        : window.showSaveFilePicker({ suggestedName: 'internship-finder-backup.json', types: [{ description: 'Backup', accept: { 'application/json': ['.json'] } }] });
      pick.then(function (h) {
        fh = h; fhOk = true; folderUI();
        idb('readwrite', function (s) { return s.put(h, 'file'); }).catch(function () {});
        return writeFolder();
      }).catch(function () {});
    });
  }
  var writeFolder = function () {
    if (!fh || !fhOk) return Promise.resolve();
    return fh.createWritable().then(function (w) { return w.write(backupData()).then(function () { return w.close(); }); }).catch(function () { fhOk = false; folderUI(); });
  };
  function queueFolderWrite() { if (!fh || !fhOk) return; clearTimeout(fhTimer); fhTimer = setTimeout(writeFolder, 3000); }

  // Clear search: drop this search's results and progress, keep the course, profile, key and anything Saved / Applied
  var clearSearch = function () {
    if (!confirm(t('clearAsk'))) return;
    stopAsked = true; nightOff();
    var go = function () {
      if (running) return setTimeout(go, 300);
      S.run = null;
      S.res = S.res.filter(function (x) { return S.marks[x.id] === 'saved' || S.marks[x.id] === 'applied'; });
      Object.keys(S.marks).forEach(function (k) { if (S.marks[k] === 'hidden') delete S.marks[k]; });
      S.filter = 'all'; S.tab = 'state';
      msg('inMsg4', ''); setLine('');
      $('inBar').style.width = '0'; $('inProgCounts').innerHTML = '';
      save(); renderResults();
      show(S.p.subjects.length ? 3 : 1);
    };
    go();
  };
  $('inClear').addEventListener('click', clearSearch);
  $('inClear2').addEventListener('click', clearSearch);
  $('inReset').addEventListener('click', function () {
    if (running) return;
    if (!confirm(t('startOverAsk'))) return;
    S = blank(); pdf = null; save(); fillForm(); $('inPdfName').hidden = true; applyLang(); show(1);
  });

  // ---------------------------------------------------------------- mock (?mock=1, for testing the page without a key)
  // ?mock=1 normal · ?mock=day (AI limit used up after 2 requests) · ?mock=noread (pages can't be opened)
  var mockCalls = 0;
  var md8 = function (n) { var x = new Date(Date.now() + n * 864e5); return x.toISOString().slice(0, 10); };
  function mockGemini(body, model) {
    var txt = body.contents[0].parts[0].text;
    mockCalls++;
    if (MOCKERR === 'day' && mockCalls > 2) return sleep(200).then(function () { throw classify(429, { error: { message: 'You exceeded your current quota, please check your plan and billing details. GenerateRequestsPerDayPerProjectPerModel-FreeTier' } }, false); });
    var out = 'OK';
    if (/SYLLABUS TEXT/.test(txt)) out = JSON.stringify({ subjects: ['Structural analysis', 'Geotechnical engineering', 'Surveying', 'Concrete technology', 'Transportation engineering'], skills: ['AutoCAD', 'Site surveying', 'Soil testing'], orgs: ['State PWD', 'Water authority', 'Construction PSUs'], fields: ['engg'] });
    else if (/"subjects"/.test(txt)) out = JSON.stringify({ subjects: ['Structural analysis', 'Surveying', 'Fluid mechanics'], skills: ['AutoCAD', 'Soil testing'], orgs: ['Public Works Department', 'Irrigation department', 'Construction companies'], fields: ['engg'], syllabusUrls: ['https://ktu.edu.in/syllabus/civil'] });
    else if (/Name real organisations/.test(txt)) out = JSON.stringify({ state: [{ org: 'Kerala PWD', url: 'https://pwd.kerala.gov.in' }, { org: 'Kerala Water Authority', url: 'https://kwa.kerala.gov.in' }], central: [{ org: 'CPWD', url: 'https://cpwd.gov.in' }], psu: [{ org: 'NBCC', url: 'https://nbccindia.in' }], private: [{ org: 'L&T Construction', url: 'https://www.lntecc.com/careers' }] });
    else if (/excerpts read today/.test(txt)) {
      var urls = (txt.match(/\]\((https?:[^)]+)\)/g) || []).map(function (x) { return x.slice(2, -1); });
      out = JSON.stringify(urls.slice(0, 4).map(function (u, i) { return { tier: /news\.google/.test(u) ? 'central' : (/kerala/.test(u) ? 'state' : /cpwd|gov\.in/.test(u) ? 'central' : /nbcc/.test(u) ? 'psu' : 'private'), title: 'Summer internship for civil engineering students ' + (i + 1), org: 'Org ' + hostOf(u), place: 'Kerala', stipend: '₹5,000/month', deadline: md8(15 + i * 5), status: i % 2 ? 'soon' : 'open', eligibility: 'BTech Civil 3rd year', why: 'Matches Surveying', url: u }; }));
    }
    else if (/Explain this internship/.test(txt)) out = 'ഇത് സിവിൽ എഞ്ചിനീയറിങ് വിദ്യാർത്ഥികൾക്കുള്ള 2 മാസത്തെ ഇന്റേൺഷിപ്പാണ്.';
    return sleep(300).then(function () { return { text: out, hosts: [], searched: false }; });
  }
  function mockRead(url) {
    if (MOCKERR === 'noread') return sleep(200).then(function () { throw new Error('blocked'); });
    var h = hostOf(url);
    if (/syllabus/.test(url)) return sleep(200).then(function () { return 'Title: Syllabus\nSemester 1 syllabus curriculum course code credits paper Unit I semester 2 syllabus paper credits'; });
    return sleep(250).then(function () {
      return 'Title: ' + h + '\nURL Source: ' + url + '\nMarkdown Content:\n[Home](' + url + ')\n[Careers](https://' + h + '/careers)\n' +
        'Applications are invited for the Summer Internship Programme for engineering students. Last date: 15 December 2026.\n' +
        '[Summer Internship 2026 notification](https://' + h + '/notices/internship-' + url.length + '.pdf)\n[Annual report](https://' + h + '/report.pdf)\n' +
        '[Summer internship old link](https://' + h + '/dead-internship)\n' +
        '[Internal](https://' + h + '/internal-faculty)\n[Skip to main content](' + url + '#main-content)\n[International relations](https://' + h + '/international)';
    });
  }
  function mockNews(q) {
    if (MOCKERR === 'noread') return sleep(200).then(function () { throw new Error('blocked'); });
    return sleep(200).then(function () { return [{ title: 'Applications open for summer internship in ' + q, url: 'https://news.google.com/rss/articles/' + q.length, date: '', src: 'The Hindu' }]; });
  }
  if (MOCK) { GAP = 300; READ_GAP = 200; }

  // ---------------------------------------------------------------- start
  if (lang === 'ml' && !S.p.state) S.p.state = 'Kerala';
  fillForm();
  applyLang();
  var k0 = getKey(); if (k0) $('inKey').value = k0;
  var first = S.step || 1; S.step = 0; show(first, true);
  if (S.run && S.run.v !== 2) { S.run = null; save(); }
  if (S.step === 4 && S.run && pending()) {
    $('inResume').hidden = false; $('inStop').hidden = true; setLine(S.run.note || t('stopped'));
  }
  readHash();
})();
