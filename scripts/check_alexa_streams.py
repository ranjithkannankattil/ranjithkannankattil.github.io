#!/usr/bin/env python3
"""Plays the start of every Malayalam stream the Alexa skill would use (plus a sample of other languages), the way an
Echo does: https on port 443, a trusted certificate, and audio (or a playlist) coming back. Writes a short report.
Runs on GitHub (US servers), so a few stations that only stream inside India or the Gulf may show as failing here."""
import json, os, ssl, sys, urllib.request, concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(ROOT, "js/alexa-stations.json"), encoding="utf-8"))
ctx = ssl.create_default_context()           # Alexa needs a certificate a normal phone would trust


def probe(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Linux; Android) Echo-like check", "Icy-MetaData": "0"})
        with urllib.request.urlopen(req, timeout=12, context=ctx) as r:
            ct = (r.headers.get("Content-Type") or "").lower()
            body = r.read(16384)
            ok = len(body) > 0 and any(x in ct for x in ("audio", "mpegurl", "octet-stream", "ogg", "aac", "mpeg", "x-scpls", "video/mp2t"))
            return ok, f"{r.status} {ct or 'no type'} {len(body)}B"
    except Exception as e:
        return False, type(e).__name__ + ": " + str(e)[:80]


def main():
    pick = [s for s in data["st"] if s["c"] == "malayalam"]
    for col in ("tamil", "hindi", "arabic", "english-news", "english-music"):
        pick += [s for s in data["st"] if s["c"] == col][:15]
    rows = []
    with cf.ThreadPoolExecutor(24) as ex:
        futs = {ex.submit(probe, s["u"][0]): s for s in pick}
        for f in cf.as_completed(futs):
            s = futs[f]; ok, why = f.result(); rows.append((s, ok, why))
    rows.sort(key=lambda r: (r[0]["c"] != "malayalam", r[0]["c"], r[1], r[0]["n"]))
    ml = [r for r in rows if r[0]["c"] == "malayalam"]
    good_ml = sum(1 for r in ml if r[1]); good = sum(1 for r in rows if r[1])
    out = [f"## Alexa stream check", "", f"Malayalam: **{good_ml} of {len(ml)}** play the way an Echo needs.",
           f"All checked: {good} of {len(rows)}.", "", "| Station | Language | Result |", "|---|---|---|"]
    for s, ok, why in rows:
        if s["c"] == "malayalam" or not ok:
            out.append(f"| {s['n']}{' (' + s['g'] + ' only)' if s.get('g') else ''} | {s['c']} | {'✅' if ok else '❌'} {why} |")
    rep = "\n".join(out)
    open(os.path.join(ROOT, "scripts/alexa-stream-report.md"), "w").write(rep + "\n")
    print(rep)
    # fail only if something is badly wrong (most Malayalam streams failing means the list or the check is broken)
    return 0 if good_ml >= 0.6 * len(ml) else 1


if __name__ == "__main__":
    sys.exit(main())
