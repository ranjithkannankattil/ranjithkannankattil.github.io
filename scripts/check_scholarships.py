#!/usr/bin/env python3
"""Daily check of every official scholarship page.

Reads the links in js/scholarships-data.js, keeps the lines on each page that
talk about dates, deadlines or eligibility, and compares them with the copy in
scripts/scholarship-watch.json. It writes a plain report to
scripts/scholarship-report.md, for a person to review. It never edits the list
on the site. The first time a page is seen, it just records the copy.
"""
import hashlib
import html
import json
import re
import ssl
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "js/scholarships-data.js"
STATE = ROOT / "scripts/scholarship-watch.json"
REPORT = ROOT / "scripts/scholarship-report.md"
UA = "Mozilla/5.0 (compatible; ranjithkb-scholarship-check; +https://ranjithkb.com/)"
KEY = re.compile(
    r"deadline|closing|closes|closed|opens|open now|applications?\b|apply|eligib|"
    r"stipend|allowance|tuition|\b20\d\d\b|january|february|march|april|\bmay\b|june|july|"
    r"august|september|october|november|december",
    re.I,
)
MAX_LINES = 150


def links(js):
    """Every official link, with the names that use it."""
    found = {}
    for name, url in re.findall(r"name: '((?:[^'\\]|\\.)*)'.*?url: '([^']+)'", js, re.S):
        found.setdefault(url, []).append(name.replace("\\'", "'"))
    return found


def key_lines(raw, content_type=""):
    """The date and eligibility lines of a page, tidied so small layout changes don't count."""
    if raw[:5] == b"%PDF-":
        return ["pdf:" + hashlib.sha256(raw).hexdigest()]
    text = raw.decode("utf-8", "replace")
    text = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header)\b.*?</\1>", " ", text)
    text = re.sub(r"(?i)<(br|/p|/div|/li|/tr|/h[1-6])\b[^>]*>", "\n", text)
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    seen, out = set(), []
    for line in text.split("\n"):
        line = re.sub(r"\s+", " ", line).strip()
        if 12 <= len(line) <= 400 and KEY.search(line) and line not in seen:
            seen.add(line)
            out.append(line)
    return out[:MAX_LINES]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/pdf,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=40, context=ssl.create_default_context()) as r:
            return url, key_lines(r.read(8_000_000), r.headers.get("content-type", "")), None
    except Exception as e:  # any failure just means "couldn't read today"
        return url, None, str(e)[:120]


def compare(old, results, used):
    """Returns the new state, the changed pages and the unreadable ones."""
    state, changed, failed = {}, [], []
    for url, lines, err in results:
        before = old.get(url)
        if lines is None or not lines:
            misses = (before or {}).get("misses", 0) + 1
            state[url] = {**(before or {"lines": []}), "misses": misses}
            failed.append((url, err or "no readable text", misses))
            continue
        state[url] = {"lines": lines, "misses": 0}
        if before and before.get("lines") and before["lines"] != lines:
            added = [x for x in lines if x not in before["lines"]]
            removed = [x for x in before["lines"] if x not in lines]
            changed.append((url, added, removed))
    return state, changed, failed


def report(changed, failed, used, day):
    out = [f"# Scholarship page check, {day}", ""]
    if changed:
        out += ["Review these and update `js/scholarships-data.js` if the facts changed.", ""]
    for url, added, removed in changed:
        out += [f"## {', '.join(used[url])}", url, ""]
        out += [f"- New: {x}" for x in added[:8]]
        out += [f"- Gone: {x}" for x in removed[:8]]
        if len(added) > 8 or len(removed) > 8:
            out.append("- More changes on the page.")
        out.append("")
    stuck = [f for f in failed if f[2] == 3 or f[2] % 30 == 0]  # say so once, then monthly
    if stuck:
        out += ["## Could not read for three days or more", ""]
        out += [f"- {', '.join(used[u])}: {u} ({e})" for u, e, _ in stuck]
    return "\n".join(out) + "\n", len(changed) + len(stuck)


def main():
    from datetime import date

    used = links(DATA.read_text(encoding="utf-8"))
    old = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    with ThreadPoolExecutor(8) as ex:
        results = list(ex.map(fetch, used))
    state, changed, failed = compare(old, results, used)
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=0, sort_keys=True) + "\n", encoding="utf-8")
    text, issues = report(changed, failed, used, date.today().isoformat())
    REPORT.write_text(text, encoding="utf-8")
    print(f"{len(used)} pages, {len(changed)} changed, {len(failed)} unreadable, {issues} to review")
    if len(sys.argv) > 1:  # tell the workflow whether to raise a review note
        Path(sys.argv[1]).write_text(str(issues), encoding="utf-8")


if __name__ == "__main__":
    main()
