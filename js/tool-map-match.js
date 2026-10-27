/* ============================================================
   Map colourer — place-name matching
   Turns what people type ("uk", "S. Korea", "Frnace", "Orissa",
   "tamil nadu", "TN") into a place id for the current map.
   MapMatch.index(features) → { resolve(q), suggest(q, n) }
   ============================================================ */
(function (root) {
  'use strict';

  // Everyday names the data doesn't carry. Keyed by the map's country id.
  var COUNTRY_EXTRA = {
    GBR: ['uk', 'u k', 'britain', 'great britain', 'gb', 'england', 'scotland', 'wales', 'northern ireland', 'united kingdom'],
    USA: ['us', 'usa', 'u s', 'u s a', 'america', 'united states', 'the states'],
    KOR: ['korea', 's korea', 'south korea', 'rok', 'republic of korea'],
    PRK: ['n korea', 'north korea', 'dprk'],
    RUS: ['russia', 'russian federation'],
    CZE: ['czech', 'czech republic', 'czechia'],
    NLD: ['holland', 'netherlands', 'the netherlands'],
    ARE: ['uae', 'emirates', 'dubai', 'abu dhabi'],
    SAU: ['ksa', 'saudi'],
    COD: ['drc', 'dr congo', 'congo kinshasa', 'zaire', 'democratic republic of congo'],
    COG: ['congo', 'congo brazzaville', 'republic of congo'],
    CIV: ['ivory coast', 'cote divoire', 'cote d ivoire'],
    MMR: ['burma'],
    SWZ: ['swaziland', 'eswatini'],
    MKD: ['macedonia'],
    TUR: ['turkiye', 'turkey'],
    CPV: ['cape verde', 'cabo verde'],
    TLS: ['east timor', 'timor leste'],
    LAO: ['laos'],
    VNM: ['viet nam', 'vietnam'],
    IRN: ['persia'],
    VAT: ['vatican', 'holy see', 'vatican city'],
    BIH: ['bosnia', 'bosnia herzegovina', 'bih'],
    PNG: ['png'],
    CAF: ['car', 'central african rep'],
    NZL: ['nz', 'aotearoa'],
    ZAF: ['rsa', 'south africa', 'sa'],
    CHN: ['prc', 'mainland china'],
    TWN: ['roc', 'formosa'],
    TZA: ['tanzania'],
    BOL: ['bolivia'],
    SYR: ['syria'],
    MDA: ['moldova'],
    FSM: ['micronesia'],
    DOM: ['dominican rep', 'dr'],
    LKA: ['ceylon'],
    THA: ['siam'],
    IRL: ['eire', 'republic of ireland'],
    DEU: ['deutschland', 'west germany'],
    ESP: ['espana'],
    ITA: ['italia'],
    CHE: ['swiss', 'schweiz', 'suisse'],
    GRC: ['hellas'],
    JPN: ['nippon'],
    PHL: ['philippines'],
    VEN: ['venezuela'],
    BRN: ['brunei'],
    STP: ['sao tome'],
    KNA: ['st kitts', 'saint kitts'],
    LCA: ['st lucia'],
    VCT: ['st vincent'],
    TTO: ['trinidad', 'tobago'],
    ATG: ['antigua'],
    GNB: ['guinea bissau'],
    GNQ: ['equatorial guinea'],
    KGZ: ['kirghizia', 'kirgizstan'],
    BLR: ['belorussia', 'byelorussia'],
    PSX: ['palestine', 'west bank', 'gaza'],
    PSE: ['palestine', 'west bank', 'gaza']
  };
  // Subdivision nicknames, keyed by subdivision id (ISO 3166-2)
  var SUB_EXTRA = {
    'IN-DL': ['new delhi', 'nct', 'delhi ncr', 'nct of delhi'],
    'IN-AN': ['andaman', 'andamans', 'andaman and nicobar islands', 'a and n'],
    'IN-JK': ['j and k', 'jammu', 'kashmir'],
    'IN-OR': ['orissa'],
    'IN-PY': ['pondy', 'pondicherry'],
    'IN-WB': ['bengal'],
    'IN-TN': ['tamilnadu'],
    'IN-UP': ['uttarpradesh'],
    'IN-MP': ['madhyapradesh'],
    'IN-KL': ['keralam'],
    'IN-KA': ['mysore state'],
    'IN-CT': ['chattisgarh', 'chhatisgarh'],
    'IN-DH': ['daman', 'diu', 'dadra', 'nagar haveli'],
    'GB-ENG': ['england'], 'GB-SCT': ['scotland'], 'GB-WLS': ['wales', 'cymru'], 'GB-NIR': ['northern ireland', 'ni'],
    'US-DC': ['washington dc', 'dc', 'district of columbia'],
    'US-NY': ['new york state'],
    'US-WA': ['washington state']
  };

  function norm(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[’'`´]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(the|state of|province of|region of|republic of|kingdom of|union territory of)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function squash(s) { return s.replace(/ /g, ''); }

  // Damerau–Levenshtein (optimal string alignment), bailing out above max
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      var rowMin = Infinity;
      for (j = 1; j <= b.length; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        var v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v; if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
  }

  function index(feats) {
    var keys = {};          // normalised key → id (first writer wins: names beat aliases)
    var entries = [];       // { id, name, key, primary }
    var byId = {};
    function add(id, raw, primary) {
      var k = norm(raw);
      if (!k) return;
      [k, squash(k)].forEach(function (kk, i) {
        if (i && kk === k) return;
        if (!(kk in keys)) keys[kk] = id;
      });
      entries.push({ id: id, key: k, primary: primary });
    }
    feats.forEach(function (f) {
      byId[f.id] = { f: f };
    });
    feats.forEach(function (f) { add(f.id, f.properties.name, true); });
    feats.forEach(function (f) {
      var id = String(f.id);
      add(id, id, false);
      if (id.indexOf('-') > 0) add(id, id.split('-')[1], false);   // IN-KL → KL
      (f.properties.alt || '').split('|').forEach(function (a) { add(id, a, false); });
      (COUNTRY_EXTRA[id] || SUB_EXTRA[id] || []).forEach(function (a) { add(id, a, false); });
    });

    function name(id) { return byId[id] ? byId[id].f.properties.name : id; }

    // q → { id, name, how: exact|alias|prefix|fuzzy, guess? } or { id:null, maybe:[...] }
    function resolve(q) {
      var n = norm(q);
      if (!n) return null;
      var hit = keys[n] || keys[squash(n)];
      if (hit) return { id: hit, name: name(hit), how: norm(name(hit)) === n ? 'exact' : 'alias' };
      if (n.length < 3) return { id: null, maybe: suggest(q, 3).map(function (s) { return s.id; }) };
      // unique prefix ("andaman", "kara", "luxem")
      var pre = {}, preIds = [];
      entries.forEach(function (e) {
        if (e.key.indexOf(n) === 0 || e.key.split(' ').some(function (w) { return w.length > 2 && w.indexOf(n) === 0 && n.length > 3; })) {
          if (!pre[e.id]) { pre[e.id] = 1; preIds.push(e.id); }
        }
      });
      if (preIds.length === 1) return { id: preIds[0], name: name(preIds[0]), how: 'prefix' };
      // typo-tolerant: best edit distance, must be clearly better than the runner-up
      var max = n.length <= 4 ? 1 : n.length <= 8 ? 2 : 3;
      var best = null, second = null;
      entries.forEach(function (e) {
        if (e.key.length < 3) return;
        var d = Math.min(dist(n, e.key, max), dist(squash(n), squash(e.key), max));
        if (d > max) return;
        var s = { id: e.id, d: d + (e.primary ? 0 : .3) };
        if (!best || s.d < best.d) { if (best && best.id !== s.id) second = best; best = s; }
        else if (s.id !== best.id && (!second || s.d < second.d)) second = s;
      });
      if (best && (!second || second.d - best.d >= .7 || best.d <= 1 && second.d > 1)) {
        return { id: best.id, name: name(best.id), how: 'fuzzy' };
      }
      var maybe = suggest(q, 3).map(function (s) { return s.id; });
      if (preIds.length) maybe = preIds.slice(0, 3).concat(maybe.filter(function (m) { return preIds.indexOf(m) < 0; })).slice(0, 3);
      return { id: null, maybe: maybe };
    }

    // ranked suggestions for a partial query
    function suggest(q, limit) {
      var n = norm(q), sq = squash(n);
      if (!n) return [];
      var score = {};
      function put(id, s) { if (!(id in score) || s < score[id]) score[id] = s; }
      entries.forEach(function (e) {
        var k = e.key, p = e.primary ? 0 : .5;
        if (k === n) put(e.id, 0 + p);
        else if (k.indexOf(n) === 0 || squash(k).indexOf(sq) === 0) put(e.id, 1 + p);
        else if (k.split(' ').some(function (w) { return w.indexOf(n) === 0; })) put(e.id, 2 + p);
        else if (n.length > 2 && k.indexOf(n) > 0) put(e.id, 3 + p);
      });
      if (n.length > 2) {
        var max = n.length <= 4 ? 1 : n.length <= 8 ? 2 : 3;
        entries.forEach(function (e) {
          if (e.key.length < 3) return;
          var head = e.key.slice(0, n.length + 1);
          var d = Math.min(dist(n, e.key, max), dist(n, head, max), dist(n, e.key.slice(0, n.length), max));
          if (d <= max) put(e.id, 4 + d + (e.primary ? 0 : .5));
        });
      }
      var ids = Object.keys(score);
      var good = ids.filter(function (id) { return score[id] < 4; });
      if (good.length >= 3) ids = good;           // keep typo guesses out when real matches exist
      return ids
        .sort(function (a, b) { return score[a] - score[b] || name(a).localeCompare(name(b)); })
        .slice(0, limit || 6)
        .map(function (id) { return { id: id, name: name(id), score: score[id] }; });
    }

    // does feature id match a search box query? (names, aliases, codes)
    function matches(id, q) {
      var n = norm(q); if (!n) return true;
      var sq = squash(n);
      return entries.some(function (e) { return e.id === id && (e.key.indexOf(n) >= 0 || squash(e.key).indexOf(sq) >= 0); });
    }

    return { resolve: resolve, suggest: suggest, matches: matches, name: name };
  }

  root.MapMatch = { index: index, norm: norm };
})(typeof window !== 'undefined' ? window : globalThis);
