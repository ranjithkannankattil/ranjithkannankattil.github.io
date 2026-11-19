#!/usr/bin/env python3
"""How much mobile data Radio Velvet uses per hour of listening, measured on real streams.

For the most-listened stations this week (js/station-stats.json), downloads ~30 s of the stream the app would play first,
counts the bytes, and works out MB per hour. Also reads the station's own bitrate header (icy-br) where it sends one.
HLS (.m3u8) streams: the first variant, its segments. Run by hand ("Measure radio data use"); no Claude, no secrets.
"""
import json, re, sys, time, urllib.request, urllib.parse

UA = {"User-Agent": "RadioVelvet/2.7 (data check)", "Icy-MetaData": "0"}
SECS = 30

def load(col):
    t = open(f"js/stations/{col}.js", encoding="utf-8").read()
    return {s["id"]: s for s in json.loads(t[t.index("["):t.rindex("]") + 1])}

def timed_read(resp, secs):
    n, t0 = 0, time.time()
    while time.time() - t0 < secs:
        b = resp.read(16384)
        if not b: break
        n += len(b)
    return n, time.time() - t0

def hls(url):
    pl = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=15).read().decode("utf-8", "replace")
    if "#EXT-X-STREAM-INF" in pl:
        lines = [l.strip() for l in pl.splitlines()]
        var = [(int(re.search(r"BANDWIDTH=(\d+)", lines[i]).group(1)), lines[i + 1]) for i, l in enumerate(lines)
               if l.startswith("#EXT-X-STREAM-INF") and re.search(r"BANDWIDTH=(\d+)", l)]
        bw, u = max(var)                                   # the player picks the best it can on a good connection
        url = urllib.parse.urljoin(url, u)
        pl = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=15).read().decode("utf-8", "replace")
    segs, durs, lines = [], [], pl.splitlines()
    for i, l in enumerate(lines):
        if l.startswith("#EXTINF:"):
            durs.append(float(l[8:].split(",")[0])); segs.append(urllib.parse.urljoin(url, lines[i + 1].strip()))
    n = d = 0
    for s, du in list(zip(segs, durs))[-4:]:
        n += len(urllib.request.urlopen(urllib.request.Request(s, headers=UA), timeout=20).read()); d += du
    return n, d, None

def measure(url):
    if ".m3u8" in url: return hls(url)
    r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=15)
    br = r.headers.get("icy-br")
    ct = r.headers.get("content-type", "")
    if "mpegurl" in ct or "x-scpls" in ct or "audio/x-mpegurl" in ct:
        body = r.read(20000).decode("utf-8", "replace")
        u2 = next((l.split("=", 1)[-1].strip() for l in body.splitlines() if l.strip().startswith(("http", "File1="))), None)
        if u2: return measure(u2)
    n, d = timed_read(r, SECS)
    return n, d, br

stats = json.load(open("js/station-stats.json"))
top = sorted(stats.get("week", {}).items(), key=lambda x: -float(x[1]))[:int(sys.argv[1]) if len(sys.argv) > 1 else 15]
cache, rows = {}, []
for key, mins in top:
    col, sid = key.split(":", 1)
    st = cache.setdefault(col, load(col)).get(sid)
    if not st: continue
    for u in st["streams"][:2]:
        try:
            n, d, br = measure(u)
            if n < 2000 or d < 3: raise RuntimeError("too little audio")
            kbps = n * 8 / d / 1000
            rows.append((st["name"], kbps, n / d * 3600 / 1e6, br))
            print(f"{st['name'][:28]:28} {kbps:6.0f} kbps  {n/d*3600/1e6:6.1f} MB/hour  (station says {br or '-'} kbps)", flush=True)
            break
        except Exception as e:
            print(f"{st['name'][:28]:28} {u[:60]} failed: {str(e)[:80]}", flush=True)
if rows:
    mb = sorted(r[2] for r in rows)
    print(f"\n{len(rows)} stations: median {mb[len(mb)//2]:.0f} MB/hour, lowest {mb[0]:.0f}, highest {mb[-1]:.0f}")
