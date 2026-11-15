#!/usr/bin/env python3
"""Station logos for Android Auto (no Claude involved; runs on GitHub Actions).

For every station in js/stations/*.js, looks up its logo ("favicon") in the open radio-browser.info directory
(matched by stream address, then by exact name), downloads it, keeps it only if it is a real, clear picture,
and stores it unchanged on a white square (400 x 400 PNG) at https://media.ranjithkb.com/radio-logos/<collection>/<id>.png.
The app draws the Velvet frame around it, and only on the Android Auto screen.
Writes js/station-logos.json ("collection:id" -> address). Stations without a usable logo are retried after 30 days.
Usage: python3 scripts/fetch_station_logos.py [--limit N] [--dry]
"""
from __future__ import annotations

import concurrent.futures as cf
import datetime as dt
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "js" / "station-logos.json"
TRIED = ROOT / "scripts" / "data" / "station-logos-tried.json"
WORK = ROOT / "build-logos"
MEDIA = "https://media.ranjithkb.com/radio-logos"
UA = {"User-Agent": "RadioVelvet/1.0 (+https://ranjithkb.com/radio.html)"}
API = ["https://de1.api.radio-browser.info", "https://nl1.api.radio-browser.info", "https://at1.api.radio-browser.info"]
SIZE = 400
RETRY_DAYS = 30


def get(url: str, timeout: int = 20, limit: int | None = None) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(limit) if limit else r.read()


def stations():
    for f in sorted((ROOT / "js" / "stations").glob("*.js")):
        t = f.read_text()
        m = re.search(r"window\.STATIONS\s*=\s*(\[[\s\S]*?\]);\s*window\.STATIONS_CHECKED", t) or re.search(r"window\.STATIONS\s*=\s*(\[[\s\S]*\]);", t)
        if not m:
            continue
        for s in json.loads(m.group(1)):
            yield f.stem, s


def norm(u: str) -> str:
    u = (u or "").strip().lower()
    u = re.sub(r"^https?://", "", u)
    u = u.split("#")[0].rstrip("/;")
    return u


def directory():
    for base in API:
        try:
            rows = json.loads(get(f"{base}/json/stations?hidebroken=false&limit=200000", timeout=180))
            print(f"directory: {len(rows)} stations from {base}")
            return rows
        except Exception as e:
            print("directory failed at", base, e)
    sys.exit("radio-browser directory unreachable")


def usable(data: bytes) -> Image.Image | None:
    """A real logo: decodes, at least 96 px, not too long or thin, not a blank square."""
    try:
        im = Image.open(io.BytesIO(data))
        if getattr(im, "format", "") == "ICO":
            sizes = im.info.get("sizes") or []
            if sizes:
                im.size = max(sizes)
        im.load()
    except Exception:
        return None
    w, h = im.size
    if min(w, h) < 96 or max(w, h) / max(1, min(w, h)) > 2.2:
        return None
    im = im.convert("RGBA")
    flat = Image.new("RGB", im.size, "white")
    flat.paste(im, mask=im.split()[3])
    st = ImageStat.Stat(flat.convert("L"))
    if st.stddev[0] < 10:      # one plain colour: no logo in it
        return None
    return flat


def square(im: Image.Image) -> bytes:
    """The logo as the station made it, on white, centred with a little room around it."""
    box = int(SIZE * 0.86)
    im = im.copy()
    im.thumbnail((box, box), Image.LANCZOS)
    if max(im.size) < box * 0.6:    # small but sharp: enlarge a little, never past 1.6x
        f = min(1.6, box * 0.75 / max(im.size))
        im = im.resize((int(im.width * f), int(im.height * f)), Image.LANCZOS)
    out = Image.new("RGB", (SIZE, SIZE), "white")
    out.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    b = io.BytesIO()
    out.save(b, "PNG", optimize=True)
    return b.getvalue()


def main() -> None:
    args = sys.argv[1:]
    limit = int(args[args.index("--limit") + 1]) if "--limit" in args else 3000
    dry = "--dry" in args
    have = json.loads(OUT.read_text()).get("logos", {}) if OUT.exists() else {}
    tried = json.loads(TRIED.read_text()) if TRIED.exists() else {}
    today = dt.date.today()
    todo = []
    for col, s in stations():
        k = f"{col}:{s['id']}"
        if k in have:
            continue
        t = tried.get(k)
        if t and (today - dt.date.fromisoformat(t)).days < RETRY_DAYS:
            continue
        todo.append((col, s))
    print(f"{len(have)} logos already, {len(todo)} stations to look up (this run: up to {limit})")
    todo = todo[:limit]
    if not todo:
        return
    rows = directory()
    by_url, by_name = {}, {}
    for r in rows:
        fav = (r.get("favicon") or "").strip()
        if not fav.startswith("http") or fav.lower().endswith(".svg"):
            continue
        for u in (r.get("url"), r.get("url_resolved")):
            if u:
                by_url.setdefault(norm(u), fav)
        by_name.setdefault((r.get("name") or "").strip().lower(), set()).add(fav)

    def find(col, s):
        for u in s.get("streams", []):
            f = by_url.get(norm(u))
            if f:
                return f
        favs = by_name.get(s["name"].strip().lower(), set())
        return next(iter(favs)) if len(favs) == 1 else None

    def work(item):
        col, s = item
        k = f"{col}:{s['id']}"
        fav = find(col, s)
        if not fav:
            return k, None, "no logo listed"
        try:
            data = get(fav, timeout=15, limit=3_000_000)
        except Exception as e:
            return k, None, f"download failed: {str(e)[:40]}"
        im = usable(data)
        if im is None:
            return k, None, "not a clear logo"
        png = square(im)
        path = WORK / col / f"{re.sub(r'[^A-Za-z0-9._-]', '_', s['id'])}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(png)
        return k, path, hashlib.sha1(png).hexdigest()[:8]

    found = {}
    reasons = {}
    with cf.ThreadPoolExecutor(16) as ex:
        for k, path, info in ex.map(work, todo):
            if path:
                found[k] = (path, info)
            else:
                tried[k] = today.isoformat()
                reasons[info.split(":")[0]] = reasons.get(info.split(":")[0], 0) + 1
    print(f"new logos: {len(found)}; without: {dict(reasons)}")
    if dry:
        return
    if not found:
        TRIED.parent.mkdir(parents=True, exist_ok=True)
        TRIED.write_text(json.dumps(dict(sorted(tried.items())), indent=0) + "\n")
        return
    # upload to R2 (the same bucket the Media upload workflow uses), then record the addresses
    env = os.environ
    subprocess.run(["aws", "s3", "cp", str(WORK), "s3://ranjithkb-media/radio-logos/", "--recursive",
                    "--endpoint-url", env["R2"], "--content-type", "image/png",
                    "--cache-control", "public, max-age=604800", "--only-show-errors"], check=True)
    for k, (path, h) in found.items():
        col = k.split(":", 1)[0]
        have[k] = f"{MEDIA}/{col}/{path.name}?v={h}"
    OUT.write_text(json.dumps({"updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
                               "note": "Station logos belong to their owners. Used only to show the station on Android Auto.",
                               "logos": dict(sorted(have.items()))}, ensure_ascii=False, separators=(",", ":")) + "\n")
    TRIED.parent.mkdir(parents=True, exist_ok=True)
    TRIED.write_text(json.dumps(dict(sorted(tried.items())), indent=0) + "\n")


if __name__ == "__main__":
    main()
