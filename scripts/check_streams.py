#!/usr/bin/env python3
"""Daily health check for the Radio page (js/stations.js).

For every station it:
  1. tests each stream the way a browser on ranjithkb.com would need it to work
     (HTTPS only; HLS playlists must allow cross-origin playback),
  2. moves working streams to the front so the player tries them first,
  3. if a station has no working stream, looks for a replacement on the
     station's radiosindia.com page and in the radio-browser.info directory,
  4. marks stations that still have nothing as offline (they stay listed),
  5. drops a stream only after it has failed for DROP_AFTER days in a row
     and the station has another working stream,
  6. writes scripts/stream-report.md and scripts/stream-health.json.

Uses only the Python standard library plus the curl command.
Run locally:  python3 scripts/check_streams.py
"""
from __future__ import annotations

import concurrent.futures as cf
import datetime as dt
import json
import re
import subprocess
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATIONS_JS = ROOT / "js" / "stations.js"
HEALTH = ROOT / "scripts" / "stream-health.json"
REPORT = ROOT / "scripts" / "stream-report.md"

DROP_AFTER = 7          # consecutive failed days before a stream is removed
SANITY_MIN = 0.4        # if fewer than 40% of stations work, assume the runner's network is at fault
MIN_BYTES = 16_000      # audio bytes needed in TIMEOUT seconds to count as live
TIMEOUT = 10
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
ORIGIN = "https://ranjithkb.com"
TODAY = dt.date.today().isoformat()


# ---------------------------------------------------------------- data I/O
def load_stations() -> tuple[str, list[dict]]:
    text = STATIONS_JS.read_text(encoding="utf-8")
    start = text.index("window.STATIONS")
    arr_start = text.index("[", start)
    arr_end = text.rindex("]")
    return text[:start], json.loads(text[arr_start:arr_end + 1])


def save_stations(header: str, stations: list[dict]) -> None:
    body = json.dumps(stations, ensure_ascii=False, indent=2)
    checked = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    STATIONS_JS.write_text(f"{header}window.STATIONS = {body};\nwindow.STATIONS_CHECKED = \"{checked}\";\n",
                           encoding="utf-8")


# ---------------------------------------------------------------- testing
def curl(url: str, timeout: int = TIMEOUT) -> tuple[int, str, bytes, dict, int]:
    """Return (http_code, content_type, body, headers, curl_exit). http_code 0 = failed."""
    with tempfile.NamedTemporaryFile() as body, tempfile.NamedTemporaryFile() as hdr:
        cmd = ["curl", "-sS", "-L", "--http0.9", "--max-time", str(timeout),
               "-A", UA, "-H", f"Origin: {ORIGIN}", "-H", f"Referer: {ORIGIN}/radio.html",
               "-H", "Accept: */*", "-H", "Accept-Encoding: identity;q=1, *;q=0",
               "-H", "Range: bytes=0-", "-H", "Sec-Fetch-Dest: audio", "-H", "Sec-Fetch-Mode: no-cors",
               "-D", hdr.name, "-o", body.name, "-w", "%{http_code} %{content_type}", url]
        p = subprocess.run(cmd, capture_output=True, text=True)
        out = (p.stdout or "0 ").split(" ", 1)
        code = int(out[0]) if out[0].isdigit() else 0
        ctype = (out[1] if len(out) > 1 else "").lower()
        data = Path(body.name).read_bytes()
        headers: dict[str, str] = {}
        for line in Path(hdr.name).read_text("latin-1").splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        # ICY servers answer "ICY 200 OK", which curl reports as code 0
        if code == 0 and len(data) >= MIN_BYTES and p.returncode in (0, 28):
            code = 200
        return code, ctype, data, headers, p.returncode


OK, DEAD, UNKNOWN = "ok", "dead", "unknown"
# curl exit codes that usually mean "this server won't talk to GitHub's machines"
# (timeouts, resets) rather than "this stream is gone"
NETWORKY = {28, 52, 56}


def no_answer(code: int, data: bytes, rc: int) -> bool:
    return code == 0 and not data and rc in NETWORKY


def is_hls(url: str) -> bool:
    return bool(re.search(r"\.m3u8(\?|$)", url, re.I))


def test_hls(url: str, depth: int = 0) -> tuple[str, str]:
    code, _, data, headers, rc = curl(url, timeout=8)
    if no_answer(code, data, rc):
        return UNKNOWN, "no answer to GitHub's servers"
    if code not in (200, 206) or not data.lstrip().startswith(b"#EXTM3U"):
        return DEAD, f"playlist HTTP {code}"
    if depth == 0 and "access-control-allow-origin" not in headers:
        return DEAD, "playlist blocks cross-origin playback"
    lines = [l.strip() for l in data.decode("utf-8", "ignore").splitlines()]
    uris = [l for l in lines if l and not l.startswith("#")]
    if not uris:
        return DEAD, "empty playlist"
    nxt = urllib.parse.urljoin(url, uris[-1] if "#EXTINF" in data.decode("utf-8", "ignore") else uris[0])
    if is_hls(nxt) and depth < 3:
        return test_hls(nxt, depth + 1)
    code, _, seg, _, rc = curl(nxt, timeout=8)
    if seg.lstrip().startswith(b"#EXTM3U") and depth < 3:
        return test_hls(nxt, depth + 1)
    if code in (200, 206) and len(seg) > 300:
        return OK, "HLS ok"
    if no_answer(code, seg, rc):
        return UNKNOWN, "segment: no answer to GitHub's servers"
    return DEAD, f"segment HTTP {code}, {len(seg)} bytes"


def test_stream(url: str) -> tuple[str, str]:
    """OK = plays; DEAD = definitely broken; UNKNOWN = GitHub's servers got no answer."""
    if not url.lower().startswith("https://"):
        return DEAD, "not HTTPS (browsers block it on an HTTPS site)"
    try:
        if is_hls(url):
            return test_hls(url)
        code, ctype, data, headers, rc = curl(url)
        head = data[:200].lower()
        if b"#extm3u" in head:
            return test_hls(url)
        if no_answer(code, data, rc):
            return UNKNOWN, "no answer to GitHub's servers"
        if "html" in ctype or b"<html" in head or b"<!doctype" in head:
            if code in (200, 206):
                # some servers show their player page to scripts but stream audio to browsers
                return UNKNOWN, "server answered GitHub with a web page"
            if code == 403:
                return UNKNOWN, "server refuses GitHub's servers (403)"
            return DEAD, f"HTTP {code} error page"
        if code in (200, 206) and len(data) >= MIN_BYTES:
            if rc == 0:
                # A live stream never finishes downloading. This one did: either a file (a jingle -
                # never used as a replacement) or a region-blocked message for GitHub's US servers.
                return UNKNOWN, "finished downloading: a file, or blocked in GitHub's region"
            return OK, f"{len(data)//1000} KB in {TIMEOUT}s"
        return DEAD, f"HTTP {code}, {len(data)} bytes"
    except Exception as e:  # noqa: BLE001
        return UNKNOWN, f"checker error {e}"


def best_variant(url: str) -> list[str]:
    """http:// URLs: also try the https:// version."""
    if url.lower().startswith("http://"):
        return ["https://" + url[7:], url]
    return [url]


# ---------------------------------------------------------------- finding replacements
def http_get(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


def from_radiosindia(station_id: str) -> list[str]:
    try:
        html = http_get(f"https://radiosindia.com/{station_id}.html")
    except Exception:  # noqa: BLE001
        return []
    m = re.search(r"new\s+Playerjs\(\s*\{[^}]*?file\s*:\s*[\"']([^\"']+)[\"']", html)
    return [u.strip() for u in m.group(1).split(" or ")] if m else []


STOP = {"radio", "fm", "air", "akashvani", "online", "the", "malayalam", "hits", "live"}


def tokens(name: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", name.lower()) if t not in STOP} or set(re.findall(r"[a-z0-9]+", name.lower()))


def from_radio_browser(name: str) -> list[str]:
    want = tokens(name)
    found: list[str] = []
    queries = {name, re.sub(r"^(AIR|Radio)\s+", "", name, flags=re.I)}
    for q in queries:
        for host in ("de1", "fi1", "nl1"):
            try:
                url = (f"https://{host}.api.radio-browser.info/json/stations/search?"
                       + urllib.parse.urlencode({"name": q, "hidebroken": "true", "limit": 25}))
                rows = json.loads(http_get(url))
                break
            except Exception:  # noqa: BLE001
                rows = []
        for r in rows:
            langs = (r.get("language") or "").lower()
            if "malayalam" not in langs:
                continue
            theirs = tokens(r.get("name", ""))
            extra = theirs - want            # same distinctive words; only frequencies may differ
            if not want or not want <= theirs or any(not t.isdigit() for t in extra):
                continue
            for k in ("url_resolved", "url"):
                if r.get(k) and r[k] not in found:
                    found.append(r[k])
    return found


_AKV: dict[str, str] | None = None


def akashvani_official() -> dict[str, str]:
    """Official Akashvani stream links, from github.com/codito/akashvani (scraped from akashvani.gov.in)."""
    global _AKV
    if _AKV is None:
        try:
            rows = json.loads(http_get("https://raw.githubusercontent.com/codito/akashvani/main/stations.json"))
            _AKV = {r["name"].strip().lower(): r["stream_url"].strip() for r in rows if r.get("stream_url")}
        except Exception:  # noqa: BLE001
            _AKV = {}
    return _AKV


def find_replacements(st: dict, known: set[str]) -> list[str]:
    known = known | set(st.get("exclude", []))
    cands = []
    official = akashvani_official().get(st.get("akv", "").lower())
    for u in ([official] if official else []) + from_radiosindia(st["id"]) + from_radio_browser(st["name"]):
        for v in best_variant(u.strip()):
            if v not in known and v not in cands:
                cands.append(v)
    good = []
    for u in cands[:12]:
        if test_stream(u)[0] == OK:
            good.append(u)
            break
    return good


# ---------------------------------------------------------------- main
def main() -> None:
    header, stations = load_stations()
    health: dict = json.loads(HEALTH.read_text()) if HEALTH.exists() else {}

    # 1. test every stream (and the https version of http ones)
    urls = sorted({v for s in stations for u in s["streams"] for v in best_variant(u)})
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        results = dict(zip(urls, ex.map(test_stream, urls)))

    # Akashvani changes its official links from time to time: add any new one up front
    akv = akashvani_official()
    for st in stations:
        new = akv.get(st.get("akv", "").lower())
        if new and new not in st["streams"] and new not in st.get("exclude", []):
            results[new] = test_stream(new)
            if results[new][0] == OK:
                st["streams"].insert(0, new)

    report_rows = []
    changed_stations = []
    for st in stations:
        before = list(st["streams"])
        working, dead, unknown = [], [], []
        for u in st["streams"]:
            variants = best_variant(u)
            hit = next((v for v in variants if results[v][0] == OK), None)
            if hit:
                working.append(hit)                 # upgrades http -> https when that works
                health.pop(u, None)
                health.pop(hit, None)
            elif any(results[v][0] == DEAD for v in variants):
                dead.append(u)
                h = health.setdefault(u, {"fails": 0, "since": TODAY})
                h["fails"] += 1
                h["last_reason"] = results[variants[0]][1]
            else:
                unknown.append(u)

        # 2. no working stream -> look for a replacement
        found = []
        if not working and dead:
            found = find_replacements(st, set(st["streams"]))
            working = found

        # 3. drop long-dead streams only when something else works
        keep_dead = [u for u in dead if not (working and health.get(u, {}).get("fails", 0) >= DROP_AFTER)]
        dropped = [u for u in dead if u not in keep_dead]
        for u in dropped:
            health.pop(u, None)

        st["streams"] = list(dict.fromkeys(working + unknown + keep_dead))
        if working:
            st.pop("offline", None)
        elif unknown:
            pass        # couldn't tell from GitHub's servers: leave the station as it was
        else:
            st["offline"] = True

        if st["streams"] != before or found or dropped:
            changed_stations.append(st["name"])
        status = "ok" if working else ("UNKNOWN" if unknown else "OFFLINE")
        note = []
        if found:
            note.append(f"new stream found: {', '.join(found)}")
        if dropped:
            note.append(f"removed after {DROP_AFTER} days dead: {', '.join(dropped)}")
        if dead and working:
            note.append(f"{len(dead)} backup source(s) failing")
        if not working:
            note.append("; ".join(f"{u} — {results[best_variant(u)[0]][1]}" for u in dead + unknown))
        report_rows.append((status, st["name"], " · ".join(note)))

    ok = sum(1 for r in report_rows if r[0] == "ok")
    if ok < len(stations) * SANITY_MIN:
        # Far too many failures at once means the check itself is broken
        # (runner network trouble), not the stations. Change nothing.
        raise SystemExit(f"Only {ok}/{len(stations)} stations reachable — assuming a network problem, no changes written.")

    save_stations(header, stations)
    HEALTH.write_text(json.dumps(health, indent=2, sort_keys=True) + "\n")

    off = [r for r in report_rows if r[0] == "OFFLINE"]
    unk = [r for r in report_rows if r[0] == "UNKNOWN"]
    lines = [f"# Radio stream check — {TODAY}", "",
             f"**{ok} of {len(stations)} stations playing.** {len(off)} offline, {len(unk)} couldn't be checked.", ""]
    for title, rows in (("Offline", off), ("Couldn't be checked from GitHub (left unchanged)", unk)):
        if rows:
            lines += [f"## {title}", "", "| Station | Why |", "|---|---|"]
            lines += [f"| {n} | {why} |" for _, n, why in rows]
            lines.append("")
    notes = [r for r in report_rows if r[0] == "ok" and r[2]]
    if notes:
        lines += ["## Changes and warnings", "", "| Station | Note |", "|---|---|"]
        lines += [f"| {n} | {why} |" for _, n, why in notes]
        lines.append("")
    REPORT.write_text("\n".join(lines))
    print("\n".join(lines))
    print(f"\nChanged: {', '.join(changed_stations) or 'nothing'}")


if __name__ == "__main__":
    main()
