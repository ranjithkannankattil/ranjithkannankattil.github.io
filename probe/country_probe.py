"""One-off: why don't the English Music 'Country' stations play in Europe, and which country
stations do? Uses radio-browser.info's own checks (run from its servers in Europe) plus a test
from this GitHub runner. Writes probe/result.json."""
import json, sys, time, urllib.parse, urllib.request
from pathlib import Path
sys.path.insert(0, "scripts")
import check_streams as cs

HOSTS = ["de1", "nl1", "at1", "fi1"]
def rb(path, **q):
    for h in HOSTS:
        try:
            u = f"https://{h}.api.radio-browser.info/json/{path}" + ("?" + urllib.parse.urlencode(q) if q else "")
            req = urllib.request.Request(u, headers={"User-Agent": "ranjithkb.com radio probe"})
            return json.loads(urllib.request.urlopen(req, timeout=20).read())
        except Exception as e:
            err = e
    print("radio-browser failed", path, err); return []

def checks(uuid):
    rows = rb(f"checks/{uuid}", seconds=7 * 86400)
    by = {}
    for r in rows:
        src = r.get("source", "?")
        by.setdefault(src, []).append(1 if r.get("ok") else 0)
    return {k: f"{sum(v)}/{len(v)}" for k, v in by.items()}

_, stations = cs.load_stations(Path("js/stations/english-music.js"))
current = [s for s in stations if s.get("category") == "country" or "country" in s["name"].lower()]
out = {"current": [], "candidates": []}
for s in current:
    for url in s["streams"]:
        rows = rb("stations/byurl", url=url)
        st, why = cs.test_stream(url)
        out["current"].append({"id": s["id"], "name": s["name"], "url": url, "runner": [st, why],
            "rb": [{"name": r["name"], "country": r.get("countrycode"), "lastcheckok": r.get("lastcheckok"),
                    "checks": checks(r["stationuuid"])} for r in rows[:2]]})

seen, cands = set(), []
for tag in ["country", "country music", "classic country", "bluegrass", "americana", "new country", "outlaw country", "country hits"]:
    for r in rb("stations/search", tag=tag, tagExact="true", hidebroken="true", is_https="true",
                order="clickcount", reverse="true", limit=120):
        u = r.get("url_resolved") or r.get("url")
        key = r["name"].strip().lower()
        if not u or key in seen or not u.startswith("https://"): continue
        lang = (r.get("language") or "").lower()
        if lang and "english" not in lang: continue
        seen.add(key); cands.append(r)
cands.sort(key=lambda r: -(r.get("clickcount") or 0))
for r in cands[:90]:
    u = r.get("url_resolved") or r.get("url")
    st, why = cs.test_stream(u)
    ch = checks(r["stationuuid"])
    out["candidates"].append({"name": r["name"].strip(), "url": u, "homepage": r.get("homepage"),
        "country": r.get("countrycode"), "tags": r.get("tags"), "codec": r.get("codec"), "bitrate": r.get("bitrate"),
        "clicks": r.get("clickcount"), "votes": r.get("votes"), "lastcheckok": r.get("lastcheckok"),
        "runner": [st, why], "checks": ch, "hls": r.get("hls")})
    time.sleep(0.2)
Path("probe/result.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
print("done", len(out["current"]), len(out["candidates"]))
