#!/usr/bin/env python3
"""Nightly: totals for "Most heard" and "Top rated" → js/station-stats.json (read by the Radio page and the app).

- Listening: anonymous minutes per station per day (Firestore listens/<YYYY-MM-DD>/s/<collection:station>, written by
  the website and the app). "week" = the last 7 days including today; "total" = all complete days, added once each.
- Ratings: every vote (ratings/<collection~station>/votes/*): average stars and number of ratings.
Only public data is read (with the site's public API key), so no secrets are needed. No Claude involved.
"""
from __future__ import annotations

import datetime as dt
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "js" / "station-stats.json"
KEY = "AIzaSyDGsaqqamWbS6RCtyU9v54o-oqZqYzdDEo"   # public web key (already in js/firebase-config.js)
DOCS = "https://firestore.googleapis.com/v1/projects/ranjithkb-radio/databases/(default)/documents"


def get(url: str, body: dict | None = None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 headers={"content-type": "application/json"}, method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def day_minutes(day: str) -> dict[str, int]:
    out, token = {}, ""
    while True:
        q = {"key": KEY, "pageSize": 300}
        if token:
            q["pageToken"] = token
        try:
            j = get(f"{DOCS}/listens/{day}/s?{urllib.parse.urlencode(q)}")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return out
            raise
        for d in j.get("documents", []):
            k = d["name"].rsplit("/", 1)[1]
            out[k] = int(d.get("fields", {}).get("m", {}).get("integerValue", 0))
        token = j.get("nextPageToken", "")
        if not token:
            return out


def ratings() -> dict[str, list]:
    rows = get(f"{DOCS}:runQuery?key={KEY}", {"structuredQuery": {
        "from": [{"collectionId": "votes", "allDescendants": True}], "select": {"fields": [{"fieldPath": "stars"}]}}})
    sums: dict[str, list] = {}
    for r in rows:
        d = r.get("document")
        if not d:
            continue
        parts = d["name"].split("/documents/", 1)[1].split("/")      # ratings/<key>/votes/<uid>
        if len(parts) != 4 or parts[0] != "ratings":
            continue
        stars = int(d.get("fields", {}).get("stars", {}).get("integerValue", 0))
        if 1 <= stars <= 5:
            k = parts[1].replace("~", ":", 1)
            s = sums.setdefault(k, [0, 0]); s[0] += stars; s[1] += 1
    return {k: [round(t / n, 2), n] for k, (t, n) in sums.items()}


def main() -> None:
    old = json.loads(OUT.read_text()) if OUT.exists() else {}
    today = dt.datetime.now(dt.timezone.utc).date()
    week: dict[str, int] = {}
    total: dict[str, int] = dict(old.get("total", {}))
    done = set(old.get("days", []))
    perday: dict[str, int] = dict(old.get("perday", {}))   # all stations together, minutes per complete day (owner page)
    for i in range(0, 8):                       # today + the 7 days before (for "total", complete days only)
        day = (today - dt.timedelta(days=i)).isoformat()
        m = day_minutes(day)
        if i < 7:
            for k, v in m.items():
                week[k] = week.get(k, 0) + v
        if i >= 1 and day not in done:
            for k, v in m.items():
                total[k] = total.get(k, 0) + v
            done.add(day)
        if i >= 1:
            perday[day] = sum(m.values())
    data = {"updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
            "week": dict(sorted(week.items())), "total": dict(sorted(total.items())),
            "ratings": dict(sorted(ratings().items())), "days": sorted(done)[-60:],
            "perday": dict(sorted(perday.items())[-800:])}
    OUT.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"{len(week)} stations heard this week, {len(data['ratings'])} rated")


if __name__ == "__main__":
    main()
