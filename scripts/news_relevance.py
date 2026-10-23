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


def other_place(title, own, others):
    """The headline names another place and none of this place's own names."""
    t = (title or "").lower()
    if any(n.lower() in t for n in own if n):
        return False
    return any(n.lower() in t for n in others if n)


def other_names(pid, pmap, names_fn):
    """Names of every other place, except this place's ancestors and descendants,
    plus the district words of its region (minus its own names)."""
    ancestors, p = set(), pmap[pid].get("parent")
    while p:
        ancestors.add(p)
        p = pmap.get(p, {}).get("parent")

    def is_descendant(q):
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
        if q == pid or q in ancestors or is_descendant(q):
            continue
        out |= {n.lower() for n in names_fn(place)}
    for a in ancestors:
        out |= {w.lower() for w in PLACE_WORDS.get(a, [])}
    # a word that is also one of our own (or an ancestor's) names never counts as "another place"
    return sorted(n for n in out if n not in own and n not in family and not any(n in o or o in n for o in own))
