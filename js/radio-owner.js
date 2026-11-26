/* radio-admin.html, owner only: listening numbers from js/station-stats.json (built nightly, nothing about
   people), and the latest requests, feature ideas and thank-you notes. Shown after radio-admin.js has
   confirmed the owner's sign-in. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var S = null, period = "7", names = {};
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hrs(min) { return min >= 600 ? Math.round(min / 60).toLocaleString("en-GB") + " hrs" : (min / 60).toFixed(1) + " hrs"; }
  function colName(id) { var c = (window.RADIO_COLLECTIONS || []).find(function (x) { return x.id === id; }); return c ? c.name : id; }
  function stName(k) { return names[k] || k.split(":")[1].replace(/-/g, " "); }

  async function loadNames(keys) {
    var cols = {}; keys.forEach(function (k) { cols[k.split(":")[0]] = 1; });
    await Promise.all(Object.keys(cols).map(function (c) {
      return fetch("js/stations/" + c + ".js").then(function (r) { return r.text(); }).then(function (t) {
        var re = /"id"\s*:\s*"([^"]+)"[^}]*?"name"\s*:\s*"([^"]+)"/g, m;
        while ((m = re.exec(t))) names[c + ":" + m[1]] = m[2];
      }).catch(function () {});
    }));
  }

  // bars: [label, minutes] oldest first; a period of N days uses days, 12 months uses months, All uses months
  function series() {
    var pd = S.perday || {}, days = Object.keys(pd).sort(), out = [], prev = 0;
    if (period === "7" || period === "30") {
      var n = +period, t = new Date(); t.setUTCDate(t.getUTCDate() - 1);
      for (var i = n - 1; i >= 0; i--) { var d = new Date(t); d.setUTCDate(t.getUTCDate() - i); var k = d.toISOString().slice(0, 10);
        out.push([n === 7 ? d.toUTCString().slice(0, 2) : (i % 5 === 0 ? String(d.getUTCDate()) : ""), pd[k] || 0]); }
      for (var j = 2 * n - 1; j >= n; j--) { var e = new Date(t); e.setUTCDate(t.getUTCDate() - j); prev += pd[e.toISOString().slice(0, 10)] || 0; }
      return { bars: out, prev: prev };
    }
    var months = {}; days.forEach(function (k) { months[k.slice(0, 7)] = (months[k.slice(0, 7)] || 0) + pd[k]; });
    var ms = Object.keys(months).sort(); if (period === "365") ms = ms.slice(-12);
    return { bars: ms.map(function (m) { return [new Date(m + "-01").toLocaleString("en-GB", { month: "short" }), months[m]]; }), prev: null };
  }

  function chart(bars) {
    var max = Math.max.apply(null, bars.map(function (b) { return b[1]; }).concat([1])), w = 100 / bars.length, svg = "";
    bars.forEach(function (b, i) { var h = 130 * b[1] / max;
      svg += '<rect x="' + (i * w + w * 0.2) + '" y="' + (136 - h) + '" width="' + (w * 0.6) + '" height="' + Math.max(h, b[1] ? 2 : 0) +
        '" rx="2" fill="' + (i === bars.length - 1 ? "var(--gold, #B8913A)" : "var(--accent)") + '"><title>' + Math.round(b[1] / 60) + ' hrs</title></rect>';
    });
    // labels in HTML under the bars (text inside a stretched SVG would be squashed)
    return '<svg viewBox="0 0 100 140" preserveAspectRatio="none" role="img" aria-label="Listening per ' + (period.length < 3 ? "day" : "month") + '">' + svg + "</svg>" +
      '<div class="ow-labs">' + bars.map(function (b) { return "<span>" + esc(b[0]) + "</span>"; }).join("") + "</div>";
  }

  function draw() {
    var s = series(), sum = s.bars.reduce(function (a, b) { return a + b[1]; }, 0);
    if (period === "all") sum = Math.max(sum, Object.values(S.total || {}).reduce(function (a, b) { return a + b; }, 0));
    $("#owHours").textContent = hrs(sum);
    var chg = $("#owChg"); chg.className = "ow-chg";
    if (s.prev) { var pc = Math.round((sum - s.prev) * 100 / s.prev); chg.textContent = (pc >= 0 ? "▲ " : "▼ ") + Math.abs(pc) + "% vs the " + period + " days before"; chg.classList.add(pc >= 0 ? "up" : "down"); }
    else chg.textContent = "";
    $("#owChart").innerHTML = (S.perday && Object.keys(S.perday).length) ? chart(s.bars) : '<p class="ow-note">Day-by-day totals start with the next nightly run.</p>';
    document.querySelectorAll(".ow-pill button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.p === period)); });
  }

  async function run() {
    S = await fetch("js/station-stats.json?d=" + Date.now()).then(function (r) { return r.json(); });
    var top = Object.entries(S.total || {}).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
    var rated = Object.entries(S.ratings || {}).filter(function (e) { return e[1][1] >= 3; }).sort(function (a, b) { return b[1][0] - a[1][0] || b[1][1] - a[1][1]; }).slice(0, 10);
    await loadNames(top.map(function (e) { return e[0]; }).concat(rated.map(function (e) { return e[0]; })));
    $("#owTop").innerHTML = top.map(function (e) { return "<li>" + esc(stName(e[0])) + " <span>" + hrs(e[1]) + " · " + esc(colName(e[0].split(":")[0])) + "</span></li>"; }).join("");
    var langs = {}, all = 0; Object.entries(S.total || {}).forEach(function (e) { var c = e[0].split(":")[0]; langs[c] = (langs[c] || 0) + e[1]; all += e[1]; });
    $("#owLang").innerHTML = Object.entries(langs).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8)
      .map(function (e) { return "<li>" + esc(colName(e[0])) + " <span>" + Math.round(e[1] * 100 / Math.max(all, 1)) + "% · " + hrs(e[1]) + "</span></li>"; }).join("");
    $("#owRated").innerHTML = rated.map(function (e) { return "<li>" + esc(stName(e[0])) + " <span>★ " + e[1][0].toFixed(1) + " from " + e[1][1] + "</span></li>"; }).join("") || "<li><span>Not enough ratings yet.</span></li>";
    $("#owUpd").textContent = "Worked out every night from anonymous minutes per station. Last update " + (S.updated || "").replace("T", " ") + " (UTC). It can't count people or countries.";
    draw();
    document.querySelectorAll(".ow-pill button").forEach(function (b) { b.onclick = function () { period = b.dataset.p; draw(); }; });
    $("#owShare").onclick = function () {
      var t = "Radio Velvet: " + $("#owHours").textContent + " of listening (" + document.querySelector('.ow-pill [aria-pressed="true"]').textContent + ")"
        + (top[0] ? ". Most heard: " + stName(top[0][0]) : "") + ". https://ranjithkb.com/radio.html";
      if (navigator.share) navigator.share({ text: t }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(t);
    };
    try {
      var reqs = await window.RadioRatings.requests(60);
      $("#owReqH").textContent = "Requests, ideas and thanks (" + reqs.length + ")";
      $("#owReq").innerHTML = reqs.map(function (r) {
        var kind = r.name === "Feature request" ? "Feature idea" : r.name === "Thank-you note" ? "Thank you" : "Station";
        var when = r.ts && r.ts.toDate ? r.ts.toDate().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
        var head = kind === "Station" ? esc(r.name) + (r.place ? " · " + esc(r.place) : "") : (r.place ? esc(r.place) : "");
        return '<li><p><span class="ow-kind">' + kind + "</span> " + esc(when) + " · " + esc(r.from || "") + "</p>" +
          (head ? "<p><b>" + head + "</b></p>" : "") + (r.note ? "<p>" + esc(r.note) + "</p>" : "") +
          (r.link ? '<p><a href="' + esc(r.link) + '" rel="noopener">' + esc(r.link) + "</a></p>" : "") + "</li>";
      }).join("") || "<li>Nothing waiting.</li>";
    } catch (e) { console.warn(e); $("#owReq").innerHTML = "<li>Couldn't read the requests.</li>"; }
  }
  window.addEventListener("radio:owner", function () { run().catch(function (e) { console.warn(e); $("#owUpd").textContent = "Couldn't load the numbers."; }); });
})();
