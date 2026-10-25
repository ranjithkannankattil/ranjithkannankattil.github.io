"""Photography data: places → visits (month) → photos, kept in scripts/photos.json.

Each photo has a preview image assets/photos/web/<stem>-800.webp and a full-size image
assets/photos/web/<full>. See build_photos.py for the pages made from it.
"""
import calendar
import json
import re
from pathlib import Path

WEB = Path("assets/photos/web")
MONTH = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
SIZES = {"s6", "s3", "s2"}


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def month_label(month):
    y, m = month.split("-")
    return f"{calendar.month_name[int(m)]} {y}"


def preview(ph):
    """File name of the grid-size image (usually <stem>-800.webp)."""
    return ph.get("preview") or f"{ph['stem']}-800.webp"


def sizes(n):
    """Tile widths for photos without one: rows of one wide, two halves, three thirds,
    ending so that no row is left half empty."""
    out, r = [], n
    while r:
        if r >= 6:
            out += ["s6", "s3", "s3", "s2", "s2", "s2"]; r -= 6
        else:
            out += {5: ["s6", "s3", "s3", "s3", "s3"], 4: ["s3"] * 4, 3: ["s2"] * 3, 2: ["s3"] * 2, 1: ["s6"]}[r]; r = 0
    return out


def photos_of(place):
    return [ph for v in place["visits"] for ph in v["photos"]]


def validate(data, root):
    """Problems with the data, as readable lines; an empty list means it is fine."""
    errs, seen_places, seen_stems = [], set(), set()
    root = Path(root)
    for p in data.get("places", []):
        pid = p.get("id", "?")
        if not re.fullmatch(r"[a-z][a-z0-9-]*", pid):
            errs.append(f"place id {pid!r} must be lower-case letters, digits and dashes")
        if pid in seen_places:
            errs.append(f"duplicate place {pid}")
        seen_places.add(pid)
        for k in ("name", "country", "key"):
            if not p.get(k):
                errs.append(f"{pid}: missing {k}")
        months = set()
        for v in p.get("visits", []):
            m = v.get("month", "")
            if not MONTH.match(m):
                errs.append(f"{pid}: month {m!r} is not yyyy-mm")
            if m in months:
                errs.append(f"{pid}: duplicate visit {m}")
            months.add(m)
            if not v.get("photos"):
                errs.append(f"{pid} {m}: no photos")
            for ph in v.get("photos", []):
                stem = ph.get("stem", "")
                if (pid, stem) in seen_stems:
                    errs.append(f"{pid}: duplicate photo {stem}")
                seen_stems.add((pid, stem))
                for f in (preview(ph), ph.get("full", "")):
                    if not f or not (root / WEB / f).exists():
                        errs.append(f"{pid} {m}: image {f or stem + ' (full)'} not found")
                if not ph.get("caption"):
                    errs.append(f"{pid} {m}: {stem} has no caption")
                if ph.get("size", "s3") not in SIZES:
                    errs.append(f"{pid} {m}: {stem} size must be one of {sorted(SIZES)}")
                if not (isinstance(ph.get("w"), int) and isinstance(ph.get("h"), int)):
                    errs.append(f"{pid} {m}: {stem} needs integer w and h")
        if p.get("key") and p["key"] not in {ph.get("stem") for ph in photos_of(p)}:
            errs.append(f"{pid}: key photo {p['key']} is not one of its photos")
    return errs
