// Cloudflare Worker: instant refresh for ranjithkb.com/news.html.
// GET /?p=thrissur&l=en,ml  ->  {"updated": unix, "news": {"en": [story…], "ml": [...]}}
// Uses the same trusted-paper lists as the 2-hourly build (read from live.json on the news-data branch).
// Stories keep their Google News links (they open the paper's page); no summaries.
const CONFIG = "https://raw.githubusercontent.com/ranjithkannankattil/ranjithkannankattil.github.io/news-data/live.json";
const ALLOW = ["https://ranjithkb.com", "https://www.ranjithkb.com", "http://localhost:8765"];

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": ALLOW.includes(origin) ? origin : ALLOW[0], "Vary": "Origin", "Content-Type": "application/json; charset=utf-8" };
    if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET" } });
    const url = new URL(req.url);
    const pid = url.searchParams.get("p") || "world";
    const langs = (url.searchParams.get("l") || "en").split(",").slice(0, 6);

    // answer repeat requests from the edge cache for 5 minutes
    const cacheKey = new Request(`https://cache/${pid}/${langs.sort().join(",")}`);
    const hit = await caches.default.match(cacheKey);
    if (hit) return new Response(hit.body, { headers: cors });

    const cfg = await (await fetch(CONFIG, { cf: { cacheTtl: 3600 } })).json();
    const p = cfg.places[pid];
    if (!p) return new Response(JSON.stringify({ error: "unknown place" }), { status: 404, headers: cors });
    const notStory = new RegExp(cfg.not_story, "i");
    const names = cfg.names[pid] || [];
    const local = p.kind === "region" || p.kind === "city";
    const out = { updated: Math.floor(Date.now() / 1000), news: {} };

    await Promise.all(langs.filter((l) => p.langs.includes(l)).map(async (l) => {
      const ed = cfg.ed[l][p.cc] || cfg.ed[l]["*"];
      const qs = (q) => `https://news.google.com/rss${q}hl=${ed[0]}&gl=${ed[1]}&ceid=${encodeURIComponent(ed[2])}`;
      const when = cfg.when[p.kind];
      const urls = [];
      const qnames = ((p.q || {})[l] || p.name).split(" OR ").map((x) => x.trim());
      if (p.kind === "world") urls.push(qs("/headlines/section/topic/WORLD?"));
      else {
        if (p.kind === "country" && ed[1] === p.cc) urls.push(qs("/headlines/section/topic/NATION?"));
        for (const n of qnames) urls.push(qs(`/search?q=${encodeURIComponent(n + " when:" + when)}&`));
      }
      const outlets = cfg.outlets[l] || {}, domains = Object.keys(outlets);
      const feeds = await Promise.all(urls.map((u) => fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => (r.ok ? r.text() : "")).catch(() => "")));
      const seen = new Set(), list = [];
      for (const xml of feeds) {
        for (const it of xml.split("<item>").slice(1)) {
          const tag = (n) => { const m = it.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)); return m ? decode(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "")) : ""; };
          const src = it.match(/<source url="([^"]+)">([\s\S]*?)<\/source>/);
          if (!src) continue;
          let host = ""; try { host = new URL(src[1]).hostname.replace(/^www\./, ""); } catch {}
          const d = domains.find((x) => host === x || host.endsWith("." + x));
          if (!d) continue;
          let t = tag("title"); const sname = decode(src[2]);
          if (t.endsWith(" - " + sname)) t = t.slice(0, -sname.length - 3);
          const k = t.toLowerCase().replace(/\W+/g, "").slice(0, 80);
          if (seen.has(k) || notStory.test(t) || t.length < 10) continue;
          if (local && !names.some((n) => t.toLowerCase().includes(n))) continue;
          seen.add(k);
          const ts = Math.floor(Date.parse(tag("pubDate")) / 1000) || out.updated;
          list.push({ t: t.trim(), u: tag("link"), src: outlets[d] || sname, ts });
        }
      }
      out.news[l] = list.sort((a, b) => b.ts - a.ts).slice(0, 25);
    }));

    const body = JSON.stringify(out);
    ctx.waitUntil(caches.default.put(cacheKey, new Response(body, { headers: { "Cache-Control": "max-age=300" } })));
    return new Response(body, { headers: cors });
  },
};

function decode(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
}
