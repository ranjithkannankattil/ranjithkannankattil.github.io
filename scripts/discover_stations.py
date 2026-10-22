"""New-station discovery for the twice-daily radio check (called from check_streams.py).

For every collection it asks radio-browser.info for that language's most-listened stations,
skips any already listed (same stream or same name) or tried and failed in the last 3 weeks,
tests the rest with the same test as every other stream, and adds the ones that play to the
right category. A few per collection per run, so lists grow steadily rather than all at once.
"""
from __future__ import annotations

import concurrent.futures as cf
import datetime as dt
import re

PER_RUN_TEST = 6      # new candidates tested per collection per run
PER_RUN_ADD = 3       # at most this many added per collection per run
MAX_SIZE = 150        # never grow a collection past this
RETRY_AFTER = 21      # days before a failed candidate is tried again

COUNTRY = {"GB": "UK", "IE": "Ireland", "US": "US", "CA": "Canada", "AU": "Australia", "NZ": "New Zealand", "IN": "India"}
REGION = {"GB": "uk", "IE": "uk", "US": "us", "CA": "canada", "AU": "anz", "NZ": "anz"}
GENRES = [("rock", r"rock|metal|punk|grunge|alternative|indie"), ("jazz", r"jazz|blues|soul|swing|funk"), ("classical", r"classical|opera|baroque|symphon"),
          ("country", r"country|bluegrass|americana|folk"), ("pop", r"pop|hits|top 40|chart|dance|80s|90s|oldies|adult contemporary")]


def queries_for(col: dict, new_specs: dict) -> list[dict]:
    if col["id"] in new_specs:
        return new_specs[col["id"]]
    if col["id"] == "english-news":
        return [{"language": "english", "tag": "news"}]
    if col["id"] == "english-talk":
        return [{"language": "english", "tag": "talk"}, {"language": "english", "tag": "comedy"}]
    if col["id"] == "english-music":
        return [{"language": "english", "tag": t} for t in ("pop", "rock", "jazz", "classical", "country")]
    return [{"language": l} for l in col.get("rb", [])]


def category_for(col: dict, r: dict, bc) -> str | None:
    cats = [c[0] for c in col.get("cats", [])]
    tags = (r.get("tags") or "").lower()
    name = r.get("name") or ""
    cc = r.get("countrycode") or ""
    if col["id"] == "malayalam":
        if re.search(r"\b(air|akashvani|all india radio)\b", name, re.I):
            return "air"
        if bc.DEVOT.search(tags + " " + name):
            return "devotional"
        if cc == "IN" and re.search(r"\b\d{2,3}(\.\d)?\s*fm\b|\bfm\b", name, re.I):
            return "fm"
        return "online"
    if col["id"] in ("english-news", "english-talk"):
        if "comedy" in cats and "comedy" in tags:
            return "comedy"
        if "sport" in cats and re.search(r"\bsports?\b", tags):
            return "sport"
        return REGION.get(cc, "world")
    if col["id"] == "english-music":
        for k, rx in GENRES:
            if k in cats and re.search(rx, tags):
                return k
        return "eclectic" if "eclectic" in cats else cats[0]
    if set(cats) >= {"music", "news", "devotional"}:
        return bc.category(r)
    return cats[0] if cats else None


def discover(cols: list[dict], files: dict, health: dict, test_stream, OK: str) -> list[str]:
    import build_collections as bc       # imported here: build_collections itself imports check_streams
    today = dt.date.today()
    tried = health.setdefault("_tried", {})
    for u, d in list(tried.items()):      # forget old failures so they get another chance
        try:
            if (today - dt.date.fromisoformat(d)).days > RETRY_AFTER:
                tried.pop(u)
        except ValueError:
            tried.pop(u)
    new_specs = {n[0]: n[5] for n in bc.NEW}
    plan = []                              # (collection, candidate)
    for col in cols:
        if col["id"] not in files:
            continue
        _, _, sts = files[col["id"]]
        if len(sts) >= MAX_SIZE:
            continue
        have_urls = {bc.norm_url(u) for s in sts for u in s["streams"]} | {bc.norm_url(u) for s in sts for u in s.get("exclude", [])}
        have_names = {re.sub(r"[^\w]", "", s["name"].lower()) for s in sts}
        rows = [r for q in queries_for(col, new_specs) for r in bc.fetch(q)]
        rows.sort(key=lambda r: -(r.get("clickcount") or 0))
        picked, seen = [], set()
        for r in rows:
            raw = (r.get("url_resolved") or r.get("url") or "").strip()
            if not raw:
                continue
            u = bc.norm_url(raw)
            name = bc.clean(r.get("name") or "")
            nk = re.sub(r"[^\w]", "", name.lower())
            if not nk or u in have_urls or nk in have_names or u in tried or nk in seen or bc.BLOCK.search(name):
                continue
            cat = category_for(col, r, bc)
            if not cat:
                continue
            seen.add(nk)
            picked.append({"name": name, "category": cat, "streams": [u], "_cc": r.get("countrycode") or "", "_country": r.get("country") or ""})
            if len(picked) >= PER_RUN_TEST:
                break
        plan += [(col, c) for c in picked]

    with cf.ThreadPoolExecutor(max_workers=32) as ex:
        results = list(ex.map(lambda pc: test_stream(pc[1]["streams"][0])[0], plan))

    added, per_col = [], {}
    for (col, c), res in zip(plan, results):
        u = c["streams"][0]
        if res != OK:
            tried[u] = today.isoformat()
            continue
        if per_col.get(col["id"], 0) >= PER_RUN_ADD:
            continue
        _, _, sts = files[col["id"]]
        ids = {s["id"] for s in sts}
        base = bc.slug(c["name"]); sid = base; k = 2
        while sid in ids:
            sid = f"{base}-{k}"; k += 1
        st = {"id": sid, "name": c["name"], "category": c["category"], "streams": [u], "added": today.isoformat()}
        if col["id"].startswith("english-") and c["_cc"]:
            st["where"] = COUNTRY.get(c["_cc"], c["_country"])
        sts.append(st)
        per_col[col["id"]] = per_col.get(col["id"], 0) + 1
        added.append(f'{col["name"]} · {c["name"]} ({c["category"]})')
    return added
