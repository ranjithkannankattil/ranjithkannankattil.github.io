import json, urllib.request, urllib.parse, time, sys
API = "https://de1.api.radio-browser.info/json/stations/byname/"
names = ["Radio Maria", "Journey Catholic", "Classical Catholic", "EWTN", "Veritas", "Relevant Radio", "SiriusXM", "Sirius XM"]
UA = {"User-Agent": "RadioVelvet/1.0 (ranjithkb.com)"}
def get(u, t=20):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t)
def test(url):
    try:
        r = get(url, 12)
        ct = r.headers.get("Content-Type", "")
        data = r.read(48000)
        ok = len(data) > 16000 and ("audio" in ct or "mpeg" in ct or "aac" in ct or "ogg" in ct or "mpegurl" in ct)
        return ok, ct, len(data)
    except Exception as e:
        return False, str(e)[:60], 0
seen = set()
for n in names:
    try:
        rows = json.load(get(API + urllib.parse.quote(n) + "?hidebroken=false&order=clickcount&reverse=true&limit=60"))
    except Exception as e:
        print("LOOKUP FAIL", n, e); continue
    print(f"\n### {n}: {len(rows)} found")
    for r in rows:
        u = r.get("url_resolved") or r.get("url")
        if u in seen: continue
        seen.add(u)
        ok, ct, size = test(u)
        print(f"{'PLAYS' if ok else 'dead '} | {r['name'][:60]:60} | {r.get('country','')[:14]:14} | {r.get('language','')[:18]:18} | {r.get('codec','')}/{r.get('bitrate','')} | votes {r.get('votes')} | {u} | {ct}")
        time.sleep(0.2)
