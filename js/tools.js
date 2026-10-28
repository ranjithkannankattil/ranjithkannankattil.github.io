/* ============================================================
   PRODUCTIVITY — tool registry
   One entry per tool, in the order they're numbered. The hub
   (productivity/index.html) builds its grouped cards and search
   from this list; every tool page builds its breadcrumb, its
   "All tools" switcher and the previous / next links from it.

   To add a tool:
     1. add an entry below (href is relative to /productivity/,
        group is one of the GROUPS ids)
     2. create productivity/<id>.html from meeting.html's shell
        (keep data-tool-nav and data-tool="<id>" on <main>)
     3. put its code in js/tool-<id>.js and css/tool-<id>.css
     4. add it to the Tools menu list in js/nav.js (PRODUCTIVITY)
   ============================================================ */
window.TOOL_GROUPS = [
  { id: 'plan', name: 'Planning & projects' },
  { id: 'docs', name: 'Documents & photos' },
  { id: 'eng', name: 'Engineering' },
  { id: 'lang', name: 'Maps & language' }
];

window.TOOLS = [
  {
    id: 'meeting', group: 'plan',
    name: 'Meeting time finder',
    short: 'Meetings',
    href: 'meeting.html',
    blurb: 'Houston, London, Milan, Maputo, Bangalore, Beijing and Seoul on one timeline, plus any city you add. Working hours per city, daylight saving resolved for the date you pick.',
    meta: 'Time zones · DST · Working hours',
    keys: 'time zone timezone schedule calendar invite dst clock'
  },
  {
    id: 'timeline', group: 'plan',
    name: 'Timeline & Gantt',
    short: 'Timeline',
    href: 'timeline.html',
    blurb: 'Phases, tasks, milestones and dependencies on a drag-and-drop Gantt chart. Download a live Excel workbook, a paged PDF or an image for slides.',
    meta: 'Gantt · Milestones · Excel · PDF · PNG',
    keys: 'schedule plan project gantt milestone bar chart programme'
  },
  {
    id: 'raci', group: 'plan',
    name: 'RACI matrix builder',
    short: 'RACI',
    href: 'raci.html',
    blurb: 'Who is Responsible, Accountable, Consulted and Informed for each deliverable. Click or type R, A, C, I into the grid; it flags rows with no owner or two. Export to Excel, PDF, CSV or an image.',
    meta: 'RACI · RASCI · Excel · PDF · PNG',
    keys: 'responsibility matrix roles raci rasci accountable owner org chart'
  },
  {
    id: 'pdf', group: 'docs',
    name: 'PDF toolkit',
    short: 'PDF',
    href: 'pdf.html',
    blurb: 'Merge, split, reorder, rotate and delete pages, turn photos into a PDF, add page numbers or a watermark, sign, and shrink scans. Your files never leave your device.',
    meta: 'Merge · Split · Sign · Compress · Offline',
    keys: 'pdf merge combine split extract rotate delete pages sign signature watermark page numbers compress jpg image'
  },
  {
    id: 'passport', group: 'docs',
    name: 'Passport photo maker',
    short: 'Passport',
    href: 'passport.html',
    blurb: 'Crop a photo to the UK, Schengen, US, India, China, Canada or any custom size with head-height guides. Download one photo in exact pixels, or a print sheet that fits as many copies as your paper takes.',
    meta: 'Visa · ID photo · 4×6 · A4 · JPG · PDF',
    keys: 'passport visa photo id picture 35x45 2x2 print sheet 4x6 a4 crop resize biometric'
  },
  {
    id: 'units', group: 'eng',
    name: 'Oil & gas unit converter',
    short: 'Units',
    href: 'units.html',
    blurb: 'MTPA to MMscfd, barrels to cubic metres, psig to bara, °API to density, MMBtu to MWh and the rest, with the LNG density and heating value you choose.',
    meta: 'LNG · Gas · Oil · Pressure · Energy',
    keys: 'unit convert conversion lng mtpa mmscfd bbl barrel psi bar api gravity mmbtu energy flow pressure temperature'
  },
  {
    id: 'map', group: 'lang',
    name: 'Map colourer',
    short: 'Map',
    href: 'map.html',
    blurb: 'Colour countries on a globe or world map in your own colours, then open any country to colour its states or provinces. India drawn as India maps it. Download PNG or SVG, or share a link.',
    meta: 'Globe · States & provinces · PNG · SVG',
    keys: 'map world globe country state province colour color geography'
  },
  {
    id: 'keyboard', group: 'lang',
    name: 'Indic Keyboard for iPhone',
    short: 'Keyboard',
    href: 'keyboard.html',
    blurb: 'A Malayalam keyboard for iPhone and iPad, with Swanalekha, Mozhi, InScript and Lalitha layouts, English suggestions and emoji. My open-source port of SMC\'s Android Indic Keyboard. Alpha.',
    meta: 'iOS app · Malayalam · Open source · Alpha',
    keys: 'malayalam keyboard ios iphone ipad swanalekha mozhi inscript typing'
  }
];

(function () {
  'use strict';
  var T = window.TOOLS, G = window.TOOL_GROUPS;
  var no = function (i) { return (i + 1 < 10 ? '0' : '') + (i + 1); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var groupName = function (id) { for (var i = 0; i < G.length; i++) if (G[i].id === id) return G[i].name; return ''; };
  var inGroup = function (g) { return T.map(function (t, i) { return { t: t, i: i }; }).filter(function (x) { return x.t.group === g.id; }); };

  // ---------- Hub: <div data-tool-hub> ----------
  document.querySelectorAll('[data-tool-hub]').forEach(function (el) {
    var bar = '<div class="tool-find">' +
      '<label class="tool-search"><span class="sr">Find a tool</span>' +
      '<input type="search" id="toolQ" placeholder="Find a tool — try “merge”, “mtpa” or “gantt”" autocomplete="off" spellcheck="false"><kbd aria-hidden="true">/</kbd></label>' +
      '<nav class="tool-jump" aria-label="Tool groups">' + G.map(function (g) {
        return '<a href="#g-' + g.id + '">' + esc(g.name) + '<b>' + inGroup(g).length + '</b></a>';
      }).join('') + '</nav></div>';
    var sections = G.map(function (g) {
      var items = inGroup(g);
      if (!items.length) return '';
      return '<section class="tool-group" id="g-' + g.id + '" data-group>' +
        '<h2 class="tool-group-h"><span>' + esc(g.name) + '</span><i>' + items.length + (items.length === 1 ? ' tool' : ' tools') + '</i></h2>' +
        '<ul class="tool-grid">' + items.map(function (x) {
          var t = x.t;
          return '<li data-keys="' + esc((t.name + ' ' + t.short + ' ' + t.meta + ' ' + (t.keys || '') + ' ' + t.blurb).toLowerCase()) + '">' +
            '<a class="tool-card" href="' + esc(t.href) + '">' +
            '<span class="tool-card-no">TOOL ' + no(x.i) + '</span>' +
            '<h3 class="tool-card-name">' + esc(t.name) + '</h3>' +
            '<p class="tool-card-blurb">' + esc(t.blurb) + '</p>' +
            (t.meta ? '<span class="tool-card-meta">' + esc(t.meta) + '</span>' : '') +
            '<span class="tool-card-go">Open →</span></a></li>';
        }).join('') + '</ul></section>';
    }).join('');
    el.innerHTML = bar + sections +
      '<p class="tool-none" id="toolNone" hidden>No tool matches that yet. <a href="mailto:hello@ranjithkb.com">Tell me what you need</a>.</p>' +
      '<div class="tool-soon">More on the way — new tools land here as I build them.</div>';

    var q = el.querySelector('#toolQ'), none = el.querySelector('#toolNone');
    var filter = function () {
      var words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
      el.querySelectorAll('[data-group]').forEach(function (sec) {
        var n = 0;
        sec.querySelectorAll('li[data-keys]').forEach(function (li) {
          var k = li.getAttribute('data-keys');
          var ok = words.every(function (w) { return k.indexOf(w) >= 0; });
          li.hidden = !ok; if (ok) n++;
        });
        sec.hidden = !n; shown += n;
      });
      none.hidden = shown > 0;
    };
    q.addEventListener('input', filter);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var a = el.querySelector('li[data-keys]:not([hidden]) a'); if (a) location.href = a.href; }
      if (e.key === 'Escape') { q.value = ''; filter(); q.blur(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { e.preventDefault(); q.focus(); }
    });
  });

  // ---------- Tool pages: <div data-tool-nav> inside <main data-tool="id"> ----------
  document.querySelectorAll('[data-tool-nav]').forEach(function (el) {
    var host = el.closest('[data-tool]'), cur = host && host.getAttribute('data-tool');
    var idx = -1;
    T.forEach(function (t, i) { if (t.id === cur) idx = i; });
    var tool = T[idx];

    var crumb = '<div class="tool-crumb"><a href="./">Productivity</a><span>/</span>' +
      (tool ? '<a href="./#g-' + tool.group + '">' + esc(groupName(tool.group)) + '</a><span>/</span><em>' + esc(tool.name) + '</em>' : '') + '</div>';

    var menu = '<details class="tool-switch"><summary><span>All tools</span><b>' + T.length + '</b><i aria-hidden="true">▾</i></summary>' +
      '<div class="tool-switch-pop" role="menu">' + G.map(function (g) {
        var items = inGroup(g);
        if (!items.length) return '';
        return '<div class="tool-switch-g">' + esc(g.name) + '</div>' + items.map(function (x) {
          return '<a role="menuitem" href="' + esc(x.t.href) + '"' + (x.t.id === cur ? ' aria-current="page"' : '') + '>' +
            '<b>' + no(x.i) + '</b><span>' + esc(x.t.name) + '</span></a>';
        }).join('');
      }).join('') + '<a class="tool-switch-all" href="./">Productivity home →</a></div></details>';

    el.className = 'tool-nav';
    el.innerHTML = crumb + (T.length > 1 ? menu : '');

    var sw = el.querySelector('.tool-switch');
    if (sw) {
      document.addEventListener('click', function (e) { if (!sw.contains(e.target)) sw.open = false; });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sw.open) { sw.open = false; sw.querySelector('summary').focus(); } });
    }

    var eb = host && host.querySelector('[data-tool-eyebrow]');
    if (eb && tool) eb.textContent = 'Tool ' + no(idx) + ' · ' + groupName(tool.group);

    // previous / next at the foot of the tool, just above the diamond rule
    if (tool && T.length > 1) {
      var prev = T[(idx - 1 + T.length) % T.length], next = T[(idx + 1) % T.length];
      var pager = document.createElement('nav');
      pager.className = 'tool-pager';
      pager.setAttribute('aria-label', 'More tools');
      pager.innerHTML =
        '<a class="prev" href="' + esc(prev.href) + '"><span>← Previous tool</span><b>' + esc(prev.name) + '</b></a>' +
        '<a class="hub" href="./">All tools</a>' +
        '<a class="next" href="' + esc(next.href) + '"><span>Next tool →</span><b>' + esc(next.name) + '</b></a>';
      var rule = host.querySelector(':scope > .diamond-rule');
      if (rule) host.insertBefore(pager, rule); else host.appendChild(pager);
    }
  });
})();
