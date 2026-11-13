#!/usr/bin/env python3
"""Hourly quick re-check: brings back stations that were marked "not working" as soon as they play again.

Only looks at stations currently marked offline (or hidden) in the collections listed in RECHECK_COLLECTIONS
(default: malayalam). If one of a station's streams plays now, that stream goes first and the station is
switched back on. It never marks anything as not working: that stays with the twice-daily full check
(scripts/check_streams.py), so a short hiccup on GitHub's side can't switch off a working station.
Writes nothing when nothing came back.
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_streams import HEALTH, OK, STATIONS_DIR, best_variant, load_stations, save_stations, test_stream  # noqa: E402

COLLECTIONS = [c.strip() for c in os.environ.get("RECHECK_COLLECTIONS", "malayalam").split(",") if c.strip()]


def main() -> None:
    health: dict = json.loads(HEALTH.read_text()) if HEALTH.exists() else {}
    st_health = health.setdefault("@station", {})
    back = []
    for cid in COLLECTIONS:
        path = STATIONS_DIR / f"{cid}.js"
        if not path.exists():
            continue
        header, sts = load_stations(path)
        todo = [st for st in sts if (st.get("offline") or st.get("hidden")) and not st.get("geo")]
        if not todo:
            print(f"{cid}: nothing marked not working")
            continue
        urls = sorted({v for st in todo for u in st["streams"] for v in best_variant(u)})
        with cf.ThreadPoolExecutor(max_workers=16) as ex:
            results = dict(zip(urls, ex.map(test_stream, urls)))
        changed = False
        for st in todo:
            working = []
            for u in st["streams"]:
                hit = next((v for v in best_variant(u) if results[v][0] == OK), None)
                if hit:
                    working.append(hit)
                    health.pop(u, None); health.pop(hit, None)
            if not working:
                continue
            st["streams"] = list(dict.fromkeys(working + st["streams"]))
            st.pop("offline", None); st.pop("hidden", None)
            st_health.pop(f"{cid}:{st['id']}", None)
            back.append(f"{cid} · {st['name']}")
            changed = True
        print(f"{cid}: {len(todo)} rechecked, {sum(1 for b in back if b.startswith(cid + ' · '))} back")
        if changed:
            save_stations(path, header, sts)
    if back:
        HEALTH.write_text(json.dumps(health, indent=2, sort_keys=True) + "\n")
        print("Back on air:\n" + "\n".join(f"- {b}" for b in back))


if __name__ == "__main__":
    main()
