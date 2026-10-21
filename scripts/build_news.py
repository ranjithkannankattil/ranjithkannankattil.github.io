#!/usr/bin/env python3
"""Build the News page data (runs every 2 hours in GitHub Actions).

For every place and language in news_config.py it searches Google News, keeps stories from the
trusted outlets for that language, resolves each story to the publisher's own link and takes the
publisher's own one-line summary (og:description). Output:
  out/index.json      languages, place tree, outlet names, update time
  out/p/<place>.json  {"news": {lang: [story…]}, "other": {lang: [story…]}}
A story is {"t": title, "s": summary, "u": url, "src": outlet, "ts": unix time}.
"""
import argparse, concurrent.futures as cf, email.utils, html, json, os, re, sys, time, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from news_config import LANGS, OUTLETS, PLACES, JUNK, NATIVE  # noqa: E402

try:
    from googlenewsdecoder import gnewsdecoder
except ImportError:  # still works, links just stay as Google News redirects
    gnewsdecoder = None

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
KEEP, KEEP_OTHER = 25, 12
WHEN = {"world": "1d", "country": "1d", "region": "3d", "city": "7d"}
NOW = time.time()


def get(url, limit=None, timeout=20, tries=2):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-GB,en;q=0.8"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                b = r.read(limit) if limit else r.read()
                cs = r.headers.get_content_charset() or "utf-8"
                return b.decode(cs, "replace")
        except Exception as e:  # noqa: BLE001
            code = getattr(e, "code", None)
            if code in (429, 503) and i + 1 < tries:
                time.sleep(6)
                continue
            if code in (404, 410, 403):
                break
            if i + 1 < tries:
                time.sleep(2)
    return None


def edition(lang, cc):
    ed = LANGS[lang]["ed"]
    return ed.get(cc) or ed["*"]


def gn_url(path, ed, q=None):
    hl, gl, ceid = ed
    qs = {"hl": hl, "gl": gl, "ceid": ceid}
    if q:
        qs = {"q": q, **qs}
    return f"https://news.google.com/rss{path}?" + urllib.parse.urlencode(qs)


def host(u):
    try:
        return urllib.parse.urlparse(u).hostname or ""
    except ValueError:
        return ""


def outlet_for(lang, h):
    h = h.lower().removeprefix("www.")
    for d, name in OUTLETS.get(lang, {}).items():
        if h == d or h.endswith("." + d):
            return name
    return None


def junk(h, title):
    h = h.lower()
    if any(j in h for j in JUNK):
        return True
    return bool(re.search(r"\b(price|prices|on road|weather forecast|gold rate|petrol price|horoscope|ఈరోజు రాశి|राशिफल)\b", title, re.I))


def parse_rss(xml):
    out = []
    for it in re.findall(r"<item>(.*?)</item>", xml or "", re.S):
        def tag(n):
            m = re.search(rf"<{n}[^>]*>(.*?)</{n}>", it, re.S)
            return html.unescape(re.sub(r"^<!\[CDATA\[|\]\]>$", "", m.group(1).strip())) if m else ""
        src = re.search(r'<source url="([^"]+)">(.*?)</source>', it, re.S)
        title, link = tag("title"), tag("link")
        sname = html.unescape(src.group(2)) if src else ""
        if sname and title.endswith(" - " + sname):
            title = title[: -len(sname) - 3]
        try:
            ts = int(email.utils.parsedate_to_datetime(tag("pubDate")).timestamp())
        except (TypeError, ValueError):
            ts = int(NOW)
        if title and link:
            out.append({"t": title.strip(), "u": link, "src": sname, "h": host(src.group(1)) if src else "", "ts": ts})
    return out


def jobs_for(p):
    """(place_id, lang, [urls]) for one place."""
    for lang in p["langs"]:
        ed = edition(lang, p.get("cc", ""))
        eds = [ed]
        if lang == "zh" and ed != LANGS["zh"]["ed"]["*"]:
            eds.append(LANGS["zh"]["ed"]["*"])  # Hong Kong edition carries more independent Chinese-language outlets
        name = p.get("q", {}).get(lang, p["name"])
        when = WHEN[p["kind"]]
        urls = []
        for e in eds:
            if p["kind"] == "world":
                urls.append(gn_url("/headlines/section/topic/WORLD", e))
                urls.append(gn_url("/headlines/section/topic/BUSINESS", e))
                continue
            if p["kind"] == "country" and e[1] == p.get("cc"):
                urls.append(gn_url("/headlines/section/topic/NATION", e))
            urls.append(gn_url("/search", e, f"{name} when:{when}"))
            domains = list(OUTLETS.get(lang, {}))
            if lang == "en":
                domains = EN_LOCAL.get(p.get("cc"), EN_LOCAL["*"])
            if domains:
                sites = " OR ".join(f"site:{d}" for d in domains[:14])
                urls.append(gn_url("/search", e, f"{name} ({sites}) when:{when}"))
        yield p["id"], lang, urls


# English outlets most likely to cover a country's own towns
EN_LOCAL = {
    "IN": ["thehindu.com", "newindianexpress.com", "indianexpress.com", "deccanherald.com", "thenewsminute.com", "onmanorama.com",
           "english.mathrubhumi.com", "telegraphindia.com", "hindustantimes.com", "scroll.in", "thewire.in", "livemint.com", "theprint.in"],
    "GB": ["bbc.co.uk", "theguardian.com", "walesonline.co.uk", "nation.cymru", "independent.co.uk", "standard.co.uk", "itv.com",
           "manchestereveningnews.co.uk", "heraldscotland.com", "scotsman.com", "birminghammail.co.uk", "inews.co.uk", "news.sky.com"],
    "IT": ["ansa.it", "wantedinmilan.com", "thelocal.it", "theguardian.com", "reuters.com", "bbc.co.uk", "euronews.com", "ft.com"],
    "CN": ["scmp.com", "caixinglobal.com", "reuters.com", "bbc.co.uk", "theguardian.com", "nytimes.com", "ft.com", "bloomberg.com", "apnews.com"],
    "AE": ["thenationalnews.com", "gulfnews.com", "khaleejtimes.com", "reuters.com", "aljazeera.com", "bbc.co.uk", "ft.com"],
    "MZ": ["clubofmozambique.com", "zitamar.com", "reuters.com", "allafrica.com", "theafricareport.com", "dailymaverick.co.za", "bbc.co.uk",
           "aljazeera.com", "apnews.com", "ft.com", "bloomberg.com", "lusa.pt"],
    "*": ["reuters.com", "apnews.com", "bbc.co.uk", "bbc.com", "theguardian.com", "nytimes.com", "ft.com", "dw.com", "france24.com",
          "aljazeera.com", "euronews.com", "independent.co.uk", "npr.org", "politico.eu"],
}


DESC = re.compile(r'<meta\s+[^>]*(?:property|name)\s*=\s*["\'](?:og:description|twitter:description|description)["\'][^>]*>', re.I)


def summary_from(page, title):
    if not page:
        return ""
    for tag in DESC.findall(page):
        m = re.search(r'content\s*=\s*"([^"]*)"', tag) or re.search(r"content\s*=\s*'([^']*)'", tag)
        if not m:
            continue
        s = re.sub(r"\s+", " ", html.unescape(html.unescape(m.group(1)))).strip()
        s = re.sub(r"<[^>]+>", "", s)
        if len(s) < 30 or s.lower().strip(" .") == title.lower().strip(" ."):
            continue
        if len(s) > 300:
            s = s[:300].rsplit(" ", 1)[0].rstrip(",;:—-") + "…"
        return s
    return ""


def enrich(stories, cache):
    """Resolve Google News links to publisher links and fetch the publisher's summary (cached)."""
    todo = []
    for st in stories:
        key = st["u"].split("/articles/")[-1].split("?")[0]
        st["_k"] = key
        if key in cache:
            cache[key]["seen"] = int(NOW)
        else:
            todo.append(st)
    uniq = {s["_k"]: s for s in todo}
    print(f"enrich: {len(stories)} stories, {len(uniq)} new", flush=True)

    def decode(st):
        if not gnewsdecoder:
            return st["_k"], st["u"]
        try:
            d = gnewsdecoder(st["u"], interval=0)
            if d.get("status") or d.get("success"):
                return st["_k"], d.get("decoded_url") or st["u"]
        except Exception:  # noqa: BLE001
            pass
        return st["_k"], st["u"]

    decoded = {}
    with cf.ThreadPoolExecutor(6) as ex:
        for k, u in ex.map(decode, uniq.values()):
            decoded[k] = u

    def fetch(item):
        k, u = item
        if "news.google.com" in u:
            return k, u, ""
        page = get(u, limit=400_000, timeout=12, tries=1)
        return k, u, summary_from(page, uniq[k]["t"])

    with cf.ThreadPoolExecutor(24) as ex:
        for k, u, s in ex.map(fetch, decoded.items()):
            cache[k] = {"u": u, "s": s, "seen": int(NOW)}

    for st in stories:
        c = cache.get(st["_k"], {})
        st["u"] = c.get("u", st["u"])
        if c.get("s"):
            st["s"] = c["s"]


def norm(t):
    return re.sub(r"\W+", "", t.lower())[:80]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    ap.add_argument("--prev", default="prev")
    ap.add_argument("--cache", default=".news-cache/cache.json")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    out, prev = Path(a.out), Path(a.prev)
    (out / "p").mkdir(parents=True, exist_ok=True)
    cache_path = Path(a.cache)
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}

    places = [p for p in PLACES if not a.only or p["id"] in a.only.split(",")]
    jobs = [j for p in places for j in jobs_for(p)]
    urls = sorted({u for _, _, us in jobs for u in us})
    print(f"{len(places)} places, {len(jobs)} place-languages, {len(urls)} feeds", flush=True)

    feeds = {}

    def pull(u):
        time.sleep(0.15)
        return u, get(u)

    with cf.ThreadPoolExecutor(5) as ex:
        for u, x in ex.map(pull, urls):
            feeds[u] = x
    failed = sum(1 for x in feeds.values() if x is None)
    print(f"feeds fetched, {failed} failed", flush=True)

    kind = {p["id"]: p["kind"] for p in PLACES}
    result = defaultdict(lambda: {"news": {}, "other": {}})
    report = []
    for pid, lang, us in jobs:
        trusted, other, seen = [], [], set()
        got_any = False
        for u in us:
            if feeds.get(u) is None:
                continue
            got_any = True
            for st in parse_rss(feeds[u]):
                k = norm(st["t"])
                if k in seen:
                    continue
                if NOW - st["ts"] > 8 * 86400:
                    continue
                name = outlet_for(lang, st["h"])
                if name:
                    seen.add(k)
                    st["src"] = name
                    trusted.append(st)
                elif kind[pid] in ("region", "city") and st["h"] and not junk(st["h"], st["t"]):
                    seen.add(k)
                    other.append(st)
        trusted.sort(key=lambda s: -s["ts"])
        other.sort(key=lambda s: -s["ts"])
        trusted, other = trusted[:KEEP], other[:KEEP_OTHER]
        if not got_any:  # every feed failed this run: keep the last good data
            pf = prev / "p" / f"{pid}.json"
            if pf.exists():
                old = json.loads(pf.read_text())
                trusted = old.get("news", {}).get(lang, [])
                other = old.get("other", {}).get(lang, [])
        result[pid]["news"][lang] = trusted
        result[pid]["other"][lang] = other
        report.append(f"{pid:20} {lang}  trusted {len(trusted):3}  other {len(other):3}{'  (kept previous)' if not got_any else ''}")

    allst = [s for r in result.values() for part in ("news", "other") for lst in r[part].values() for s in lst if "_k" not in s and "news.google.com" in s["u"]]
    enrich(allst, cache)

    for pid, r in result.items():
        for part in ("news", "other"):
            for lang, lst in r[part].items():
                r[part][lang] = [{k: v for k, v in s.items() if k in ("t", "s", "u", "src", "ts")} for s in lst]
        (out / "p" / f"{pid}.json").write_text(json.dumps({"id": pid, "updated": int(NOW), **r}, ensure_ascii=False, separators=(",", ":")))

    index = {
        "updated": int(NOW),
        "every": 7200,
        "langs": {k: {"name": v["name"], "native": v["native"]} for k, v in LANGS.items()},
        "places": [{"id": p["id"], "name": p["name"], "native": NATIVE.get(p["id"], ""), "parent": p.get("parent"), "kind": p["kind"], "langs": p["langs"]} for p in PLACES],
        "outlets": {k: sorted(set(v.values())) for k, v in OUTLETS.items()},
    }
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    (out / "report.txt").write_text(time.strftime("%Y-%m-%d %H:%M UTC\n", time.gmtime(NOW)) + f"feeds {len(urls)}, failed {failed}\n" + "\n".join(report) + "\n")

    # keep the cache small: drop entries unseen for 4 days
    cache = {k: v for k, v in cache.items() if NOW - v.get("seen", 0) < 4 * 86400}
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False))
    print("\n".join(report))


if __name__ == "__main__":
    main()
