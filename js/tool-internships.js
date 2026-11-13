/* ============================================================
   TOOL — Internship finder  (productivity/internships.html)

   Everything runs in the visitor's browser on THEIR OWN Gemini key
   (Google AI Studio, free tier). This site never sees the key, the
   course or the results. Flow:
     1 course → 2 key → 3 profile (AI reads the syllabus) → 4 search
   The search plans ~16/40/90 Google-grounded queries in four tiers
   (state govt → central govt → PSUs → private), runs them slowly to
   stay inside the free limits, and saves after every step so it can
   stop and continue (even the next day). If Google Search grounding
   is not available on the key, it falls back to "leads" from the
   model's own knowledge, clearly marked "check page".

   Test without a key: open the page with ?mock=1
   ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var root = $('in');
  if (!root) return;

  var API = 'https://generativelanguage.googleapis.com/v1beta/models/';
  var SEARCH_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
  var PLAIN_MODEL = 'gemini-flash-lite-latest';
  var GAP = 7000;                                     // ms between calls: ~8 a minute
  var STORE = 'ifind-v1', KEYSTORE = 'ifind-key', LANGSTORE = 'ifind-lang';
  var TIERS = ['state', 'central', 'psu', 'private'];
  var TIER_T = { state: 'tState', central: 'tCentral', psu: 'tPsu', private: 'tPrivate' };
  var DEPTH = { quick: [5, 5, 2, 4, 2], std: [12, 12, 6, 10, 4], deep: [27, 27, 13, 23, 8] }; // state, central, psu, private, programme checks
  var MOCK = /[?&]mock=/.test(location.search), MOCKERR = (location.search.match(/mock=(nosearch|rate)/) || [])[1];
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
    show(2);
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

  // try search models in turn; returns {text, hosts} or throws GemErr('nosearch'|'day'|...)
  var searchCall = function (prompt) {
    var run = S.run || {}; run.dead = run.dead || {};
    var models = SEARCH_MODELS.filter(function (m) { return run.dead[m] !== today(); });
    var lastErr = new GemErr('day', 'search limit');
    var allNoSearch = true;
    var tryAt = function (i) {
      if (i >= models.length) { if (allNoSearch && lastErr.kind === 'nosearch') lastErr.kind = 'nosearch'; throw lastErr; }
      var m = models[i];
      return gemini({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } }, m)
        .catch(function (e) {
          if (e.kind === 'day' || e.kind === 'nosearch') {
            if (e.kind === 'day') allNoSearch = false;
            run.dead[m] = today(); lastErr = e; return tryAt(i + 1);
          }
          throw e;
        });
    };
    return Promise.resolve().then(function () { return tryAt(0); });
  };

  // ---------------------------------------------------------------- step 3: profile
  var buildProfile = function () {
    var p = S.p, own = !!(pdf || p.paste);
    var head = 'An Indian student wants internships in their field.\n' + profileText() + '\n\n';
    var ask = (pdf ? 'The attached PDF is this student\'s syllabus. Read it.\n' : '') +
      (p.paste ? 'The student typed their subjects:\n' + p.paste + '\n' : '') +
      (own ? '' : 'Use Google Search to find the official syllabus or curriculum of this course at this university (prefer the university\'s own website or PDF). If you cannot find it, use the typical syllabus of this course in India.\n') +
      '\nReply with ONLY this JSON, in English:\n' +
      '{"found": true or false (true only if you read this university\'s syllabus or the student\'s own list), "url": "link to the syllabus you read, or empty", ' +
      '"subjects": [up to 15 key subjects or papers], "skills": [up to 12 practical skills, lab techniques or software], ' +
      '"orgs": [up to 10 specific kinds of Indian organisations that take interns in this field, e.g. boards, research institutes, departments, industries], ' +
      '"fields": [1 to 4 of: policy, law, finance, science, engg, it, agri, health, env, arts, mgmt]}';
    var parts = [{ text: head + ask }];
    if (pdf) parts.push({ inline_data: { mime_type: 'application/pdf', data: pdf.b64 } });
    var plain = function () { return gemini({ contents: [{ parts: parts }], generationConfig: { temperature: 0.2 } }, own ? 'gemini-flash-latest' : PLAIN_MODEL); };
    var call = own ? plain() : searchCall(head + ask).catch(function (e) { if (e.kind === 'key' || e.kind === 'net') throw e; return plain(); });
    return call.then(function (r) {
      var j = parseJSON(r.text, '{');
      if (!j) throw new GemErr('other', 'Could not read the answer. Please try again.');
      var clean = function (a, n) { return (Array.isArray(a) ? a : []).map(function (x) { return String(x).trim(); }).filter(Boolean).slice(0, n); };
      p.subjects = clean(j.subjects, 15); p.skills = clean(j.skills, 12); p.orgs = clean(j.orgs, 10);
      p.fields = clean(j.fields, 4).filter(function (f) { return FIELDS[f]; });
      p.syl = { found: !!j.found, url: /^https?:\/\//.test(j.url || '') ? j.url : '', own: own };
      save();
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

  // ---------------------------------------------------------------- plan
  var relevant = function (list) {
    var f = S.p.fields;
    return list.map(function (x) {
      var score = x.fields.indexOf('any') >= 0 ? 1 : 0;
      f.forEach(function (k) { if (x.fields.indexOf(k) >= 0) score += 2; });
      return { x: x, s: score };
    }).filter(function (o) { return o.s > 0; }).sort(function (a, b) { return b.s - a.s; }).map(function (o) { return o.x; });
  };
  var stateName = function () { return S.p.state === 'all' || !S.p.state ? 'any Indian state' : S.p.state; };

  var templateTasks = function (n) {
    var words = S.p.subjects.concat(S.p.skills, S.p.orgs, [S.p.course]);
    var pick = function (i) { return words[i % words.length] || S.p.course; };
    var st = S.p.state === 'all' ? 'state government' : S.p.state + ' government';
    var out = [], kinds = ['internship', 'summer training', 'project trainee', 'studentship'];
    for (var i = 0; i < n[0]; i++) out.push({ tier: 'state', q: st + ' ' + pick(i) + ' ' + kinds[i % 4] + ' students' });
    for (i = 0; i < n[1]; i++) out.push({ tier: 'central', q: 'Government of India ' + pick(i + 3) + ' ' + kinds[i % 4] + ' ' + new Date().getFullYear() });
    for (i = 0; i < n[2]; i++) out.push({ tier: 'psu', q: 'PSU ' + pick(i + 5) + ' internship students' });
    for (i = 0; i < n[3]; i++) out.push({ tier: 'private', q: pick(i + 7) + ' internship India ' + kinds[i % 4] });
    return out;
  };
  var plan = function () {
    var n = DEPTH[S.depth] || DEPTH.std, total = n[0] + n[1] + n[2] + n[3];
    var prompt = 'Plan Google searches to find internships for this Indian student.\n' + profileText() + '\nToday: ' + today() + '\n\n' +
      'Make exactly ' + total + ' searches: ' + n[0] + ' for the state government of ' + stateName() + ' (its departments, boards, corporations, universities, research stations, district bodies), ' +
      n[1] + ' for the central government (ministries, regulators, commodity boards, national institutes, research labs, national schemes), ' +
      n[2] + ' for public sector undertakings (PSUs), and ' + n[3] + ' for private companies, startups and NGOs. ' +
      'Each search is a short Google query (max 12 words) that would find a current internship, summer training, project trainee, studentship or apprentice announcement. ' +
      'Use the subjects, skills and organisations above — name specific bodies related to this field where you can. Avoid generic job-board searches. ' +
      'Reply with ONLY a JSON array: [{"tier":"state|central|psu|private","q":"..."}]';
    return gemini({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, responseMimeType: 'application/json' } }, PLAIN_MODEL)
      .then(function (r) { return parseJSON(r.text, '['); })
      .catch(function (e) { if (e.kind === 'key' || e.kind === 'day') throw e; return null; })
      .then(function (arr) {
        var tasks = (Array.isArray(arr) ? arr : []).filter(function (x) { return x && TIERS.indexOf(x.tier) >= 0 && x.q; })
          .map(function (x) { return { tier: x.tier, q: String(x.q).slice(0, 160) }; });
        if (tasks.length < total / 2) tasks = templateTasks(n);
        // official programme checks go first in the central tier
        var checks = relevant(window.INTERN_CENTRAL).slice(0, n[4]).map(function (c) { return { tier: 'central', q: c.name, check: c.name, url: c.url }; });
        tasks = tasks.filter(function (x) { return x.tier === 'state'; })
          .concat(checks, tasks.filter(function (x) { return x.tier === 'central'; }),
            tasks.filter(function (x) { return x.tier === 'psu'; }), tasks.filter(function (x) { return x.tier === 'private'; }));
        return tasks.map(function (x, i) { x.id = i; x.done = false; return x; });
      });
  };

  // ---------------------------------------------------------------- search
  var TIER_DESC = {
    state: function () { return 'the state government of ' + stateName() + ' or its departments, boards, corporations, universities or research bodies'; },
    central: function () { return 'the Government of India: ministries, regulators, commodity boards, national institutes, research labs or national schemes'; },
    psu: function () { return 'public sector undertakings (central or state PSUs)'; },
    private: function () { return 'private companies, startups or NGOs (not government)'; }
  };
  var ITEM_SPEC = '{"title":"...","org":"...","place":"city/state or remote","stipend":"amount or unpaid or empty","deadline":"YYYY-MM-DD or empty","opens":"YYYY-MM-DD or empty",' +
    '"status":"open|soon|unclear","eligibility":"who can apply, short","why":"one short line: which subject or skill it matches","url":"official page link"}';
  var taskPrompt = function (task) {
    var base = 'You help an Indian student find internships.\n' + profileText() + '\nToday: ' + today() + '\n\n';
    if (task.check) {
      return base + 'Use Google Search to check the current status of "' + task.check + '" (official site ' + task.url + '). ' +
        'Is there an internship round open now, or announced to open in the next 4 months? Reply with ONLY a JSON array with one item ' + ITEM_SPEC +
        ' using the official page, or [] if you found nothing current.';
    }
    return base + 'Use Google Search for: ' + task.q + '\n\n' +
      'Find internships (also summer training, project traineeships, studentships, apprenticeships) offered by ' + TIER_DESC[task.tier]() +
      ', that suit this student and are open now or will open in the next 4 months, in India or remote. ' +
      'Only include ones you actually saw on a page in the search results, and give that page (prefer the organisation\'s own website). ' +
      'Leave out anything that asks students to pay, and anything whose last date has passed. ' +
      'Reply with ONLY a JSON array of up to 6 items, or [] if none: [' + ITEM_SPEC + ']';
  };
  var leadsPrompt = function (tier) {
    return 'You help an Indian student find internships.\n' + profileText() + '\n\n' +
      'From your own knowledge, list up to 10 real organisations under ' + TIER_DESC[tier]() + ' that are known to take students from this field as interns or trainees. ' +
      'For each give the official website (home or careers page). Reply with ONLY a JSON array: [{"org":"...","title":"Internship or training — check the official page","url":"https://...","why":"one short line"}]';
  };

  var OFFICIAL = /\.(gov\.in|nic\.in|res\.in|ac\.in|edu\.in|gov)$/;
  var curatedHosts = window.INTERN_CENTRAL.concat(window.INTERN_PSU).map(function (c) { return hostOf(c.url); });
  var keyOf = function (it) {
    return (it.url || '').toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '') + '|' +
      String(it.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  };
  var addItems = function (arr, tier, hosts, lead) {
    var added = 0, now = today();
    (Array.isArray(arr) ? arr : []).forEach(function (x) {
      if (!x || !x.url || !/^https?:\/\//.test(x.url) || !(x.title || x.org)) return;
      var dl = /^\d{4}-\d\d-\d\d$/.test(x.deadline || '') ? x.deadline : '';
      if (dl && dl < now) return;
      var h = hostOf(x.url);
      var verified = !lead && hosts.some(function (g) { return h === g || h.slice(-(g.length + 1)) === '.' + g || g.slice(-(h.length + 1)) === '.' + h; });
      var it = {
        tier: tier, title: String(x.title || 'Internship').slice(0, 160), org: String(x.org || '').slice(0, 120),
        place: String(x.place || '').slice(0, 80), stipend: String(x.stipend || '').slice(0, 60), deadline: dl,
        opens: /^\d{4}-\d\d-\d\d$/.test(x.opens || '') ? x.opens : '', who: String(x.eligibility || '').slice(0, 220),
        why: String(x.why || '').slice(0, 200), url: x.url,
        status: lead ? 'lead' : (x.status === 'open' ? 'open' : x.status === 'soon' ? 'soon' : 'lead'),
        verified: verified, official: OFFICIAL.test(h) || curatedHosts.indexOf(h) >= 0, at: now
      };
      if (lead && !it.why) it.why = '';
      it.id = keyOf(it);
      var old = S.res.filter(function (r) { return r.id === it.id; })[0];
      if (old) { if (old.status === 'lead' && it.status !== 'lead') Object.assign(old, it); return; }
      S.res.push(it); added++;
    });
    return added;
  };

  var startRun = function (asNight) {
    readForm();
    if (!getKey() && !MOCK) { show(2); msg('inMsg2', t('needKey'), true); return; }
    S.run = { tasks: [], started: Date.now(), dead: {}, noSearch: false, leads: {}, note: '' };
    show(4); setLine(t('planning')); renderProgress();
    if (asNight) nightOn();
    plan().then(function (tasks) { S.run.tasks = tasks; save(); loop(); })
      .catch(function (e) { endRun(e.kind === 'key' ? t('errKey') : e.kind === 'day' ? t('quota') : (e.message || 'Error'), true); });
  };
  $('inStartNow').addEventListener('click', function () { startRun(false); });
  $('inStartNight').addEventListener('click', function () { askNotify(); startRun(true); });
  $('inNightAgain').addEventListener('click', function () { askNotify(); nightOn(); if (!running) loop(); });
  $('inResume').addEventListener('click', function () {
    if (!S.run) return;
    S.run.dead = {}; S.run.note = '';
    show(4); loop();
  });
  $('inStop').addEventListener('click', function () { stopAsked = true; setLine(t('stopped')); });
  $('inNightStop').addEventListener('click', function () { stopAsked = true; nightOff(); });

  var setLine = function (s) { $('inProgLine').textContent = s; $('inNightLine').textContent = s; };

  var doLeads = function () {
    // one knowledge-only call per tier that has nothing yet
    var tiers = TIERS.filter(function (tr) { return !S.run.leads[tr]; });
    var chain = Promise.resolve();
    tiers.forEach(function (tr) {
      chain = chain.then(function () {
        if (stopAsked) return;
        setLine(t(TIER_T[tr]) + ' …');
        return gemini({ contents: [{ parts: [{ text: leadsPrompt(tr) }] }], generationConfig: { temperature: 0.3, responseMimeType: 'application/json' } }, PLAIN_MODEL)
          .then(function (r) { addItems(parseJSON(r.text, '['), tr, [], true); S.run.leads[tr] = 1; save(); renderResults(); renderProgress(); })
          .then(function () { return sleep(GAP); });
      });
    });
    return chain;
  };

  var loop = function () {
    if (running) return;
    running = true; stopAsked = false;
    $('inStop').hidden = false; $('inResume').hidden = true;
    var netFails = 0, rateFails = 0;
    var wait = function (ms, why) {
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
    var step = function () {
      if (stopAsked) return finish(t('stopped'));
      var task = S.run.tasks.filter(function (x) { return !x.done; })[0];
      if (!task) return finish('');
      if (S.run.noSearch) return doLeads().then(function () { finish(t('searchOff')); }, failLeads);
      var i = S.run.tasks.indexOf(task);
      setLine(t('running', { n: i + 1, s: S.run.tasks.length }) + ' · ' + t(TIER_T[task.tier]));
      renderProgress();
      return searchCall(taskPrompt(task)).then(function (r) {
        netFails = 0; rateFails = 0; msg('inMsg4', '');
        task.done = true; task.n = addItems(parseJSON(r.text, '['), task.tier, r.hosts, false);
        save(); renderResults(); renderProgress();
        return sleep(GAP).then(step);
      }, function (e) {
        if (e.kind === 'key') return finish(t('errKey'), true);
        if (e.kind === 'net') { if (++netFails > 4) return finish(t('errNet'), true); return wait(15000).then(step); }
        if (e.message) msg('inMsg4', t('lastErr', { m: String(e.message).slice(0, 220) }));
        if (e.kind === 'rate') {
          // Google keeps asking us to wait: after 3 tries treat it like today's limit
          if (++rateFails > 3) return doLeads().then(function () { finish(t('quota')); }, failLeads);
          return wait(e.wait || 60000).then(step);
        }
        if (e.kind === 'nosearch') { S.run.noSearch = true; save(); return step(); }
        if (e.kind === 'day') {
          // search quota is used up today: give knowledge-only leads now, finish the searches tomorrow
          return doLeads().then(function () { finish(t('quota')); }, failLeads);
        }
        task.done = true; task.err = String(e.message || '').slice(0, 120); save();
        return sleep(GAP).then(step);
      });
    };
    var failLeads = function (e) { finish(e && e.kind === 'key' ? t('errKey') : t('quota'), e && e.kind === 'key'); };
    step();
  };
  var finish = function (note, bad) {
    running = false;
    var left = S.run ? S.run.tasks.filter(function (x) { return !x.done; }).length : 0;
    S.run.note = note || ''; S.run.finished = left ? 0 : Date.now();
    save();
    var n = S.res.length;
    if (!left && !note) note = t('done', { n: n });
    setLine(note || t('done', { n: n }));
    var lastE = $('inMsg4').hidden ? '' : $('inMsg4').textContent;
    msg('inMsg4', (left ? t('left', { n: left }) : '') + (left && lastE && lastE.indexOf('·') < 0 ? ' · ' + lastE : ''), !!bad);
    $('inStop').hidden = true; $('inResume').hidden = !left; $('inNightAgain').hidden = !left;
    renderProgress(); renderResults();
    if (night) {
      $('inNightLine').textContent = note || t('done', { n: n });
      notify(t('notifDone', { n: n }));
      setTimeout(nightOff, 4000);
    }
    endRunUI();
  };
  var endRun = function (note, bad) { running = false; if (S.run) S.run.note = note; setLine(note); msg('inMsg4', note, bad); $('inStop').hidden = true; $('inResume').hidden = !S.run || !S.run.tasks.length; save(); nightOff(); };
  var endRunUI = function () { if ($('inResults').hidden === false) return; };

  var renderProgress = function () {
    var r = S.run;
    if (!r) return;
    var all = r.tasks.length, done = r.tasks.filter(function (x) { return x.done; }).length;
    var pct = all ? Math.round(done / all * 100) : 4;
    $('inBar').style.width = pct + '%'; $('inNightBar').style.width = pct + '%';
    var counts = TIERS.map(function (tr) { return '<span>' + esc(t(TIER_T[tr])) + ' <b>' + S.res.filter(function (x) { return x.tier === tr; }).length + '</b></span>'; }).join('');
    $('inProgCounts').innerHTML = counts;
    $('inNightBig').textContent = S.res.length;
    if (!running && r.note) setLine(r.note);
    else if (!running && all && done === all) setLine(t('done', { n: S.res.length }));
    $('inResume').hidden = running || !all || done === all;
    $('inNightAgain').hidden = running || !all || done === all;
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
      if (S.run && !running && S.step === 4 && S.run.tasks.some(function (x) { return !x.done; }) && !S.run.note) loop();
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
      '<span class="in-ver ' + (x.verified ? 'ok' : 'no') + '">' + esc(t(x.verified ? 'verified' : (x.official ? 'official' : 'unverified'))) + '</span></div>' +
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
    var have = S.res.length > 0 || (S.run && S.run.tasks.length > 0) || S.p.subjects.length > 0;
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
    S.step = S.res.length || (S.run && S.run.tasks && S.run.tasks.length) ? 4 : S.p.subjects.length ? 3 : 1;
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

  $('inReset').addEventListener('click', function () {
    if (running) return;
    if (!confirm(t('startOverAsk'))) return;
    S = blank(); pdf = null; save(); fillForm(); $('inPdfName').hidden = true; applyLang(); show(1);
  });

  // ---------------------------------------------------------------- mock (?mock=1, for testing the page without a key)
  function mockGemini(body, model) {
    var txt = body.contents[0].parts[0].text, search = !!body.tools;
    if (search && MOCKERR === 'nosearch') return sleep(300).then(function () { throw classify(429, { error: { message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: ' + model } }, true); });
    if (search && MOCKERR === 'rate') return sleep(300).then(function () { throw classify(429, { error: { message: 'Resource exhausted. Please try again later.', details: [{ retryDelay: '2s' }] } }, true); });
    var d = function (n) { var x = new Date(Date.now() + n * 864e5); return x.toISOString().slice(0, 10); };
    var out = 'OK';
    if (/syllabus/.test(txt) && /"subjects"/.test(txt)) out = JSON.stringify({ found: true, url: 'https://www.uni-mysore.ac.in/syllabus/bsc-sericulture.pdf', subjects: ['Mulberry cultivation', 'Silkworm rearing', 'Silkworm pathology', 'Silk reeling technology', 'Seed technology'], skills: ['Disease diagnosis', 'Microscopy', 'Farm record keeping'], orgs: ['Central Silk Board institutes', 'State sericulture departments', 'Silk reeling units'], fields: ['agri', 'science'] });
    else if (/Plan Google searches/.test(txt)) out = JSON.stringify([{ tier: 'state', q: 'Karnataka sericulture department internship' }, { tier: 'state', q: 'KSSRDI training students' }, { tier: 'central', q: 'Central Silk Board CSR&TI internship' }, { tier: 'psu', q: 'KSIC silk PSU training' }, { tier: 'private', q: 'silk reeling company internship India' }]);
    else if (/From your own knowledge/.test(txt)) out = JSON.stringify([{ org: 'Example Board', title: 'Internship or training — check the official page', url: 'https://example.gov.in', why: 'Works on silk' }]);
    else if (/Explain this internship/.test(txt)) out = 'ഇത് പട്ടുനൂൽ ഗവേഷണ സ്ഥാപനത്തിലെ 2 മാസത്തെ ഇന്റേൺഷിപ്പാണ്. BSc വിദ്യാർത്ഥികൾക്ക് അപേക്ഷിക്കാം.';
    else if (/Use Google Search/.test(txt)) {
      var tier = /state government of/.test(txt) && /offered by the state/.test(txt) ? 'Karnataka' : 'India';
      out = JSON.stringify([{ title: 'Summer internship in silkworm pathology', org: tier === 'Karnataka' ? 'Karnataka State Sericulture R&D Institute' : 'Central Sericultural Research & Training Institute', place: 'Mysuru', stipend: '₹5,000/month', deadline: d(20 + Math.floor(Math.random() * 30)), opens: '', status: Math.random() > .5 ? 'open' : 'soon', eligibility: 'BSc Sericulture 2nd/3rd year', why: 'Matches Silkworm pathology', url: 'https://csrtimys.res.in/internship-' + Math.floor(Math.random() * 1e5) }]);
    }
    return sleep(400).then(function () { return { text: out, hosts: search ? ['csrtimys.res.in'] : [], searched: search }; });
  }
  if (MOCK) GAP = 300;

  // ---------------------------------------------------------------- start
  if (lang === 'ml' && !S.p.state) S.p.state = 'Kerala';
  fillForm();
  applyLang();
  var k0 = getKey(); if (k0) $('inKey').value = k0;
  var first = S.step || 1; S.step = 0; show(first, true);
  if (S.step === 4 && S.run && S.run.tasks.some(function (x) { return !x.done; })) {
    $('inResume').hidden = false; $('inStop').hidden = true; setLine(S.run.note || t('stopped'));
  }
  readHash();
})();
