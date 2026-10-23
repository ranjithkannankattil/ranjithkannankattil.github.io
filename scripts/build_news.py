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
from news_config import DISTRICT_TOWNS, LANGS, OUTLETS, PLACES, JUNK, NATIVE, ALIASES, TOPICS, LOCAL_PAGES, LOCAL_FROM, BRIEFING, LIVE_URL  # noqa: E402
import news_extras  # noqa: E402
from news_relevance import filter_local, other_names, thin_from_prev, build_around, ancestor_chain, in_script, relevance_asks, THIN, THIN_DAYS  # noqa: E402

try:
    from googlenewsdecoder import gnewsdecoder
except ImportError:  # still works, links just stay as Google News redirects
    gnewsdecoder = None

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
KEEP, KEEP_OTHER, KEEP_TOPIC = 25, 12, 15
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


NOT_STORY = re.compile(r"(stats & head-to-head|scores & fixtures|scores, results|live scores|player stats|^catch up on|e-?paper|today'?s paper|\bnewspaper group\b|^bbc [a-z]+$|^the city$|news headlines for school assembly|horoscope|lottery result|ലോട്ടറി.*(ഫലം|നറുക്കെടുപ്പ്)|weather today|^watch:? live|express group\b|, (mon|tue|wed|thu|fri|sat|sun), \d)", re.I)


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


def jobs_for(p, thin=False):
    """(place_id, lang, topic, [urls]) for one place; topic "" is the main list."""
    for lang in p["langs"]:
        ed = edition(lang, p.get("cc", ""))
        if p["kind"] == "world" or (p["kind"] == "country" and ed[1] == p.get("cc")):
            for tid, _, sec in TOPICS:
                yield p["id"], lang, tid, [gn_url(f"/headlines/section/topic/{sec}", ed)]
    for lang in p["langs"]:
        ed = edition(lang, p.get("cc", ""))
        eds = [ed]
        if lang == "zh" and ed != LANGS["zh"]["ed"]["*"]:
            eds.append(LANGS["zh"]["ed"]["*"])  # Hong Kong edition carries more independent Chinese-language outlets
        names = [x.strip() for x in p.get("q", {}).get(lang, p["name"]).split(" OR ")]
        when = f"{THIN_DAYS}d" if thin else WHEN[p["kind"]]
        urls = []
        for e in eds:
            if p["kind"] == "world":
                urls.append(gn_url("/headlines/section/topic/WORLD", e))
                urls.append(gn_url("", e))
                continue
            if p["kind"] == "country" and e[1] == p.get("cc"):
                urls.append(gn_url("/headlines/section/topic/NATION", e))
            domains = list(OUTLETS.get(lang, {}))
            if lang == "en":
                domains = EN_LOCAL.get(p.get("cc"), EN_LOCAL["*"])
            for name in names:
                urls.append(gn_url("/search", e, f"{name} when:{when}"))
                if p["kind"] in ("region", "city"):
                    # one paper per search: Google News reads "a site:x OR site:y" as "(a site:x) OR site:y"
                    for d in domains[:4]:
                        urls.append(gn_url("/search", e, f"{name} site:{d} when:{when}"))
        yield p["id"], lang, "", urls


# English outlets most likely to cover a country's own towns
EN_LOCAL = {
    "IN": ["thehindu.com", "newindianexpress.com", "onmanorama.com", "indianexpress.com", "deccanherald.com", "thenewsminute.com",
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
        key = st["u"].split("/articles/")[-1].split("?")[0] if "news.google.com" in st["u"] else st["u"]
        st["_k"] = key
        if key in cache and not (key.startswith("http") and "pt" not in cache[key] and not cache[key].get("pt_tried")):
            cache[key]["seen"] = int(NOW)
        else:
            todo.append(st)
    uniq = {s["_k"]: s for s in todo}
    print(f"enrich: {len(stories)} stories, {len(uniq)} new", flush=True)

    def decode(st):
        if "news.google.com" not in st["u"]:
            return st["_k"], st["u"]
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
        page = get(u, limit=600_000, timeout=12, tries=1)
        s = summary_from(page, uniq[k]["t"])
        x = "" if s else news_extras.excerpt(page)
        return k, u, s, x, news_extras.published(page)

    with cf.ThreadPoolExecutor(24) as ex:
        for k, u, s, x, pt in ex.map(fetch, decoded.items()):
            cache[k] = {"u": u, "s": s, "seen": int(NOW), "first": int(NOW)}
            if x:
                cache[k]["x"] = x
            if pt and pt <= NOW + 3600:
                cache[k]["pt"] = pt
            elif k.startswith("http"):
                cache[k]["pt_tried"] = 1

    for st in stories:
        c = cache.get(st["_k"], {})
        st["u"] = c.get("u", st["u"])
        if c.get("s"):
            st["s"] = c["s"]
        if c.get("x"):
            st["_x"] = c["x"]
        if st.get("_first") and (c.get("pt") or c.get("first")):
            st["ts"] = c.get("pt") or c["first"]


def own_names(p):
    """A place's names plus, for a district, its own towns (DISTRICT_TOWNS)."""
    return names(p) + [x.lower() for x in DISTRICT_TOWNS.get(p["id"], [])]


def names(p):
    n = [p["name"], NATIVE.get(p["id"], "")] + ALIASES.get(p["id"], [])
    for q in p.get("q", {}).values():
        n += [x.strip() for x in q.split(" OR ")]
    return [x.lower() for x in n if x and len(x) > 1]


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
    thin = thin_from_prev(prev, [p["id"] for p in places], {p["id"]: p["kind"] for p in places}, {p["id"]: p["langs"] for p in places}, NOW)
    max_age = lambda pid: (THIN_DAYS if pid in thin else 8) * 86400  # noqa: E731
    jobs = [j for p in places for j in jobs_for(p, p["id"] in thin)]
    local_urls = sorted({u for pid in [p["id"] for p in places] for us in LOCAL_PAGES.get(LOCAL_FROM.get(pid, pid), {}).values() for u in us})
    urls = sorted({u for *_, us in jobs for u in us} | set(local_urls))
    print(f"{len(places)} places, {len(jobs)} lists, {len(urls)} feeds and pages", flush=True)

    feeds = {}

    def pull(u):
        time.sleep(0.15)
        return u, get(u, limit=3_000_000)

    with cf.ThreadPoolExecutor(5) as ex:
        for u, x in ex.map(pull, urls):
            feeds[u] = x
    failed = sum(1 for x in feeds.values() if x is None)
    print(f"feeds fetched, {failed} failed", flush=True)

    pmap = {p["id"]: p for p in PLACES}
    result = defaultdict(lambda: {"news": {}, "other": {}, "topics": defaultdict(dict)})
    report, stale, local_debug = [], {}, {}
    removed = defaultdict(dict)                     # (pid, lang) -> {"club": n, "other_place": n, ...}
    others_of = {}

    def others(pid):
        if pid not in others_of:
            others_of[pid] = other_names(pid, pmap, names, LOCAL_FROM)
        return others_of[pid]

    def harvest(pid, lang):
        """Stories from the papers' own district pages / city feeds."""
        src_pid = LOCAL_FROM.get(pid, pid)
        out = []
        for u in LOCAL_PAGES.get(src_pid, {}).get(lang, []):
            items = news_extras.harvest_page(feeds.get(u), u)
            local_debug[u] = {"ok": feeds.get(u) is not None, "n": len(items), "sample": [i["t"][:70] for i in items[:4]]}
            own = src_pid == pid and any(n.isascii() and n.replace(" ", "-") in u.lower() for n in names(pmap[pid]))
            for it in items:
                name = outlet_for(lang, host(it["u"]))
                if not name or not news_extras.script_ok(it["t"], lang) or re.search(r"\(\d{2,3}\)\s*അന്തരിച്ചു|അന്തരിച്ചു\.?$|ആദരാഞ്ജലി", it["t"]):
                    continue
                it.update(src=name, _first=it.get("ts") is None, _own=own)
                it.setdefault("ts", int(NOW))
                out.append(it)
        return out

    for pid, lang, topic, us in jobs:
        kind = pmap[pid]["kind"]
        trusted, other, seen = [], [], set()
        got_any = False
        cands = []
        for u in us:
            if feeds.get(u) is None:
                continue
            got_any = True
            cands += parse_rss(feeds[u])
        if not topic and kind in ("region", "city"):
            loc = harvest(pid, lang)
            got_any = got_any or bool(loc)
            cands = loc + cands
        for st in cands:
            k = norm(st["t"])
            if k in seen or NOW - st["ts"] > max_age(pid):
                continue
            if NOT_STORY.search(st["t"]) or len(st["t"]) < 10:
                continue
            name = st["src"] if st.get("_own") is not None else outlet_for(lang, st["h"])
            if name:
                seen.add(k)
                st["src"] = name
                trusted.append(st)
            elif not topic and kind in ("region", "city") and st.get("h") and not junk(st["h"], st["t"]):
                seen.add(k)
                other.append(st)
        trusted.sort(key=lambda s: -s["ts"])
        other.sort(key=lambda s: -s["ts"])
        if topic:
            trusted, other = trusted[:KEEP_TOPIC], []
        elif kind in ("region", "city"):  # stories naming the place first; the rest are checked against their summary later
            nm = own_names(pmap[pid])
            hit = lambda st: st.get("_own") or any(n in st["t"].lower() for n in nm)  # noqa: E731
            trusted = news_extras.round_robin([x for x in trusted if hit(x)])[:KEEP * 2] \
                + [x for x in trusted if not hit(x)][:KEEP]
            other = [x for x in other if hit(x)][:KEEP_OTHER] + [x for x in other if not hit(x)][:KEEP_OTHER]
            trusted = filter_local(trusted, pid, nm, others(pid), removed[(pid, lang)])
            other = filter_local(other, pid, nm, others(pid), removed[(pid, lang)])
        else:
            trusted, other = trusted[:KEEP], other[:KEEP_OTHER]
        if not got_any:  # every feed failed this run: keep the last good data
            pf = prev / "p" / f"{pid}.json"
            if pf.exists():
                old = json.loads(pf.read_text())
                if topic:
                    trusted = old.get("topics", {}).get(topic, {}).get(lang, [])
                else:
                    trusted = old.get("news", {}).get(lang, [])
                    other = old.get("other", {}).get(lang, [])
        if topic:
            result[pid]["topics"][topic][lang] = trusted
        else:
            result[pid]["news"][lang] = trusted
            result[pid]["other"][lang] = other
            stale[(pid, lang)] = not got_any

    def every_list(r):
        yield from r["news"].values()
        yield from r["other"].values()
        for t in r["topics"].values():
            yield from t.values()

    allst = [s for r in result.values() for lst in every_list(r) for s in lst if "_k" not in s and ("news.google.com" in s["u"] or s.get("_own") is not None)]
    enrich(allst, cache)

    for pid, r in result.items():
        p = pmap[pid]
        local = p["kind"] in ("region", "city")
        nm = own_names(p)
        for part, cap in (("news", KEEP), ("other", KEEP_OTHER)):
            for lang, lst in r[part].items():
                keep, seen_u, seen_s = [], set(), set()
                for st in lst:
                    if st["u"] in seen_u or (st.get("s") and st["s"] in seen_s):
                        continue
                    if local and not stale.get((pid, lang)) and not st.get("_own"):
                        text = (st["t"] + " " + st.get("s", "")).lower()
                        if not any(n in text for n in nm):
                            continue
                    seen_u.add(st["u"])
                    if st.get("s"):
                        seen_s.add(st["s"])
                    keep.append(st)
                if local:
                    keep = filter_local(keep, pid, nm, others(pid), removed[(pid, lang)])
                keep = [x for x in keep if NOW - x["ts"] < max_age(pid)]
                keep.sort(key=lambda x: -x["ts"])
                r[part][lang] = (news_extras.round_robin(keep) if local else news_extras.diversify(keep))[:cap]
        for t in r["topics"].values():
            for lang, lst in t.items():
                seen_u = set()
                t[lang] = [x for x in lst if not (x["u"] in seen_u or seen_u.add(x["u"]))]

    # AI: summaries for stories the papers gave none for, and a short digest per briefing place
    ai = news_extras.AI(cache)
    if ai.on:
        need = [s for r in result.values() for lst in r["news"].values() for s in lst if not s.get("s") and s.get("_x")]
        ai.summaries(need)
        # stories the rules could not settle: kept only because they came from a district page,
        # or naming the place only in their summary
        asks = relevance_asks(result, pmap, own_names)
        reserve = sum(len(langs) for _, langs in BRIEFING)
        gone = ai.relevance([(name, st) for name, st, _, _ in asks], reserve=reserve)
        for name, st, pid, lang in asks:
            if id(st) in gone:
                result[pid]["news"][lang] = [x for x in result[pid]["news"][lang] if x is not st]
                removed[(pid, lang)]["ai"] = removed[(pid, lang)].get("ai", 0) + 1
        for pid, langs in BRIEFING:
            if pid in result:
                for lang in langs:
                    lst = result[pid]["news"].get(lang, [])
                    d = ai.digest(pmap[pid]["name"], LANGS[lang]["name"], lst)
                    if d:
                        result[pid].setdefault("digest", {})[lang] = d
        print(f"AI: {ai.calls} calls, {ai.errors} errors", flush=True)

    for pid, r in result.items():
        for lang in pmap[pid]["langs"]:
            report.append(f"{pid:20} {lang}  trusted {len(r['news'].get(lang, [])):3}  other {len(r['other'].get(lang, [])):3}"
                          f"  topics {sum(len(t.get(lang, [])) for t in r['topics'].values()):3}{'  (kept previous)' if stale.get((pid, lang)) else ''}"
                          + (f"  window {THIN_DAYS}d" if pid in thin else "") + "".join(f"  removed {k.replace('_', '-')} {v}" for k, v in sorted(removed[(pid, lang)].items()) if v))

    thin_lines = []
    clean = lambda lst: [{k: v for k, v in s.items() if k in ("t", "s", "u", "src", "ts", "ai")} for s in lst]  # noqa: E731
    for pid, r in result.items():
        doc = {"id": pid, "updated": int(NOW), "news": {l: clean(v) for l, v in r["news"].items()},
               "other": {l: clean(v) for l, v in r["other"].items()}}
        if r["topics"]:
            doc["topics"] = {t: {l: clean(v) for l, v in d.items()} for t, d in r["topics"].items()}
        if r.get("digest"):
            doc["digest"] = r["digest"]
        p = pmap[pid]
        around = None
        if p["kind"] in ("region", "city"):
            # nearest first: the district whose pages it reads (LOCAL_FROM), then up the tree, never World
            chain = [(q, result[q]["news"]) for q in ancestor_chain(pid, pmap, LOCAL_FROM) if q in result]
            around = build_around(r["news"], chain, p["langs"], keep=lambda s, l: in_script(s.get("t", ""), l))
            if around:
                doc["around"] = {"from": around["from"], "news": {l: clean(v) for l, v in around["news"].items()}}
                for l, v in around["news"].items():
                    thin_lines.append(f"{pid:20} {l}  own {len(r['news'].get(l, [])):3}  around {len(v):3} from {around['from'][l]}")
            for l in p["langs"]:
                if len(r["news"].get(l, [])) < THIN and not (around and l in around["news"]):
                    thin_lines.append(f"{pid:20} {l}  own {len(r['news'].get(l, [])):3}  around   0  (nothing to borrow)")
        (out / "p" / f"{pid}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))

    index = {
        "updated": int(NOW),
        "every": 7200,
        "langs": {k: {"name": v["name"], "native": v["native"]} for k, v in LANGS.items()},
        "places": [{"id": p["id"], "name": p["name"], "native": NATIVE.get(p["id"], ""), "parent": p.get("parent"), "kind": p["kind"], "langs": p["langs"]} for p in PLACES],
        "outlets": {k: sorted(set(v.values())) for k, v in OUTLETS.items()},
        "topics": [[t, n] for t, n, _ in TOPICS],
        "live": LIVE_URL,
    }
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    (out / "report.txt").write_text(time.strftime("%Y-%m-%d %H:%M UTC\n", time.gmtime(NOW)) + f"feeds {len(urls)}, failed {failed}\n"
                                    + "\n".join(report) + "\n\nThin places:\n" + ("\n".join(thin_lines) or "none") + "\n\nLocal pages:\n" + json.dumps(local_debug, ensure_ascii=False, indent=1) + "\n")

    # settings for the instant-refresh worker (worker/news-live.js)
    live = {"ed": {l: v["ed"] for l, v in LANGS.items()}, "outlets": OUTLETS,
            "names": {}, "places": {}, "not_story": NOT_STORY.pattern, "when": WHEN}
    for p in PLACES:
        live["places"][p["id"]] = {"kind": p["kind"], "cc": p.get("cc", ""), "langs": p["langs"], "name": p["name"], "q": p.get("q", {})}
        live["names"][p["id"]] = names(p)
    (out / "live.json").write_text(json.dumps(live, ensure_ascii=False, separators=(",", ":")))

    # morning briefing epub + OPDS catalogue for KOReader
    try:
        news_extras.briefing(out, result, pmap, LANGS, NOW)
    except Exception as e:  # noqa: BLE001
        print("briefing failed:", e, flush=True)

    # keep the cache small: drop entries unseen for 4 days
    cache = {k: v for k, v in cache.items() if NOW - v.get("seen", 0) < 4 * 86400}
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False))
    print("\n".join(report))


if __name__ == "__main__":
    main()
