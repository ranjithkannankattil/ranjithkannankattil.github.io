/* ============================================================
   PRODUCTIVITY — tool registry
   One entry per tool. The hub (productivity/index.html) builds its
   cards from this list, and every tool page builds its switcher
   from it (the switcher only appears once there are 2+ tools).

   To add a tool:
     1. add an entry below (href is relative to /productivity/)
     2. create productivity/<id>.html from meeting.html's shell
        (keep data-tool-nav and data-tool="<id>" on <main>)
     3. put its code in js/tool-<id>.js and css/tool-<id>.css
   ============================================================ */
window.TOOLS = [
  {
    id: 'meeting',
    name: 'Meeting time finder',
    short: 'Meetings',
    href: 'meeting.html',
    blurb: 'Houston, London, Milan, Maputo, Bangalore, Beijing and Seoul on one timeline, plus any city you add. Working hours per city, daylight saving resolved for the date you pick.',
    meta: 'Time zones · DST · Working hours'
  },
  {
    id: 'timeline',
    name: 'Timeline & Gantt',
    short: 'Timeline',
    href: 'timeline.html',
    blurb: 'Phases, tasks, milestones and dependencies on a drag-and-drop Gantt chart. Download a live Excel workbook, a paged PDF or an image for slides.',
    meta: 'Gantt · Milestones · Excel · PDF · PNG'
  },
  {
    id: 'keyboard',
    name: 'Indic Keyboard for iPhone',
    short: 'Keyboard',
    href: 'keyboard.html',
    blurb: 'A Malayalam keyboard for iPhone and iPad, with Swanalekha, Mozhi, InScript and Lalitha layouts, English suggestions and emoji. My open-source port of SMC\'s Android Indic Keyboard. Alpha.',
    meta: 'iOS app · Malayalam · Open source · Alpha'
  },
  {
    id: 'map',
    name: 'Map colourer',
    short: 'Map',
    href: 'map.html',
    blurb: 'Colour countries on a globe or world map in your own colours, then open any country to colour its states or provinces. India drawn as India maps it. Download PNG or SVG, or share a link.',
    meta: 'Globe · States & provinces · PNG · SVG'
  }
];

(function () {
  'use strict';
  var T = window.TOOLS;
  var no = function (i) { return (i + 1 < 10 ? '0' : '') + (i + 1); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // Hub: <ul data-tool-hub>
  document.querySelectorAll('[data-tool-hub]').forEach(function (el) {
    var html = T.map(function (t, i) {
      return '<li><a class="tool-card" href="' + esc(t.href) + '">' +
        '<span class="tool-card-no">TOOL ' + no(i) + '</span>' +
        '<h2 class="tool-card-name">' + esc(t.name) + '</h2>' +
        '<p class="tool-card-blurb">' + esc(t.blurb) + '</p>' +
        (t.meta ? '<span class="tool-card-meta">' + esc(t.meta) + '</span>' : '') +
        '<span class="tool-card-go">Open →</span></a></li>';
    }).join('');
    html += '<li><div class="tool-card is-soon"><h2 class="tool-card-name">More on the way</h2><p>New tools land here as I build them.</p></div></li>';
    el.innerHTML = html;
  });

  // Tool pages: <div data-tool-nav> inside <main data-tool="id">
  document.querySelectorAll('[data-tool-nav]').forEach(function (el) {
    var host = el.closest('[data-tool]'), cur = host && host.getAttribute('data-tool');
    var idx = -1;
    T.forEach(function (t, i) { if (t.id === cur) idx = i; });
    var tool = T[idx];
    var crumb = '<div class="tool-crumb"><a href="./">Productivity</a><span>/</span>' +
      (tool ? 'Tool ' + no(idx) + ' · ' + esc(tool.name) : '') + '</div>';
    var strip = '<nav class="tool-strip" aria-label="Other tools"' + (T.length < 2 ? ' hidden' : '') + '>' +
      T.map(function (t, i) {
        return '<a href="' + esc(t.href) + '"' + (t.id === cur ? ' aria-current="page"' : '') + '><b>' + no(i) + '</b>' + esc(t.short || t.name) + '</a>';
      }).join('') + '</nav>';
    el.className = 'tool-nav';
    el.innerHTML = crumb + strip;
    var eb = host && host.querySelector('[data-tool-eyebrow]');
    if (eb && tool) eb.textContent = 'Tool ' + no(idx);
  });
})();
