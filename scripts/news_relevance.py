"""Relevance rules for the News build: which stories belong to a place.

Pure functions (no network) so they can be unit-tested; build_news.py calls them.
"""
import re

from news_config import CLUBS, CIVIC, PLACE_WORDS

_club_rx = {}


def _club_pattern(pid):
    if pid not in _club_rx:
        parts = []
        for phrase in CLUBS.get(pid, []):
            p = re.escape(phrase)
            parts.append(rf"\b{p}\b" if phrase.isascii() else p)
        _club_rx[pid] = re.compile("|".join(parts), re.I) if parts else None
    return _club_rx[pid]


def club_story(title, summary, pid):
    """A story about the place's football club rather than the place itself."""
    rx = _club_pattern(pid)
    if not rx or not rx.search(title or ""):
        return False
    return not (CIVIC.search(title or "") or CIVIC.search(summary or ""))


def _names_in(t, n):
    """Latin-script names match whole words ("us" is not in "bus"); other scripts match as
    substrings, because Malayalam, Tamil etc. add suffixes to place names."""
    n = n.lower()
    if n.isascii():
        return re.search(r"(?<![a-z0-9])" + re.escape(n) + r"(?![a-z0-9])", t) is not None
    return n in t


def other_place(title, own, others):
    """The headline names another place and none of this place's own names."""
    t = (title or "").lower()
    if any(n and n.lower() in t for n in own):
        return False
    return any(n and _names_in(t, n) for n in others)


def other_names(pid, pmap, names_fn, local_from=None):
    """Names of every other place in the same country, except this place's ancestors and
    descendants (including towns that take their stories from its pages, via LOCAL_FROM),
    plus the district words of its region (minus its own names)."""
    local_from = local_from or {}
    cc = pmap[pid].get("cc")
    ancestors, p = set(), pmap[pid].get("parent")
    while p:
        ancestors.add(p)
        p = pmap.get(p, {}).get("parent")

    def is_descendant(q):
        if local_from.get(q) == pid:
            return True
        while q:
            q = pmap.get(q, {}).get("parent")
            if q == pid:
                return True
        return False

    own = {n.lower() for n in names_fn(pmap[pid])}
    family = set()
    for a in ancestors:
        family |= {n.lower() for n in names_fn(pmap[a])}
    out = set()
    for q, place in pmap.items():
        if q == pid or q in ancestors or is_descendant(q) or (cc and place.get("cc") and place.get("cc") != cc):
            continue
        out |= {n.lower() for n in names_fn(place)}
    for a in ancestors:
        out |= {w.lower() for w in PLACE_WORDS.get(a, [])}
    # a word that is also one of our own (or an ancestor's) names never counts as "another place"
    return sorted(n for n in out if n not in own and n not in family and not any(n in o or o in n for o in own))


def filter_local(stories, pid, own, others, counts):
    """Drop club stories, and district-page stories whose headline names only another place.
    Counts what each rule removed in `counts` ("club", "other_place")."""
    kept = []
    for st in stories:
        if club_story(st.get("t", ""), st.get("s", ""), pid):
            counts["club"] = counts.get("club", 0) + 1
            continue
        if st.get("_own") and other_place(st.get("t", ""), own, others):
            counts["other_place"] = counts.get("other_place", 0) + 1
            continue
        kept.append(st)
    return kept


THIN, THIN_DAYS = 5, 21


def thin_from_prev(prev_dir, pids, kinds):
    """Region/city ids whose previous edition had fewer than THIN stories in any language."""
    import json
    from pathlib import Path
    out = set()
    for pid in pids:
        if kinds.get(pid) not in ("region", "city"):
            continue
        f = Path(prev_dir) / "p" / f"{pid}.json"
        if not f.exists():
            continue
        try:
            news = json.loads(f.read_text()).get("news", {})
        except (OSError, ValueError):
            continue
        if news and any(len(v) < THIN for v in news.values()):
            out.add(pid)
    return out


def build_around(own, parent_news, parent_id, langs, cap=8):
    """For each language where a place has fewer than THIN own stories, up to `cap` of its
    parent's stories that it does not already show. None when nothing is needed or found."""
    out = {}
    for lang in langs:
        mine = own.get(lang, [])
        if len(mine) >= THIN:
            continue
        seen = {s.get("u") for s in mine}
        extra = [s for s in parent_news.get(lang, []) if s.get("u") not in seen][:cap]
        if extra:
            out[lang] = extra
    return {"from": parent_id, "news": out} if out else None
