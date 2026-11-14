#!/usr/bin/env python3
"""Tidy station names (approved by the owner on 14 Nov 2026): "FM" split off a joined name and written in capitals
("Hitfm" -> "Hit FM"), ALL-CAPS and all-lowercase names in normal case, stray spaces removed. Short abbreviations and
call signs (BBC, AIR, KVTO, 630 CHED), names in other scripts and web-style names ("dinamo.fm") stay as they are.

Run directly to tidy every js/stations/*.js file; discover_stations.py imports tidy() for new stations.
"""
from __future__ import annotations
import re, sys
from pathlib import Path
ACR = {"BBC","AIR","FM","AM","NPR","ABC","CBC","LBC","HD","TV","UK","US","USA","UAE","DJ","RTL","NRJ","SBS","RTÉ","RTE","MBC","KBS","NHK","RAI","ORF","SRF","SWR","WDR","NDR","MDR","ERT","TRT","RFI","RNE","CNN","ESPN","NBC","CBS","WNYC","KEXP","KCRW","EU","NZ","AU","GB","SA","II","III","IV","XL","XXL","OK","HR","BR","RBB","DAB","SR","DR","YLE","NRK","SVT","RTP","RTS","RTVE","SER","COPE","AFN","VOA","RFE","KFM","ZFM","CHR","EDM","RNB","R&B","80S","90S","70S","60S","AC","DC","AC/DC","LA","NY","NYC","SF","OG","TNT","MTV","VH1","LGBT","LGBTQ","RCI","CBN","TWR","EWTN","FEBC","TBN","GMA","ABS","CBN","KIIS","ZNews","ISKCON","AIR","ICI","CJ","QFM","UP","MP","AP","TN","UAE","KSA","RJ"}
import unicodedata
def latin(ch): return 'LATIN' in unicodedata.name(ch, '')
COMMON2 = {"MY","IN","ON","OF","TO","BY","AT","IS","IT","OR","AN","DE","LA","LE","EL","DI","DA","DU","Y","E","THE","AND","FOR"}
def keep_caps(core):
    letters = re.sub(r"[^A-ZÀ-Þ]", "", core)
    if re.search(r"\d", core): return True                      # ERT3, AM1400, JOY4U
    if core in ACR: return True
    if core in COMMON2: return False
    if len(letters) <= 3: return True                           # BBC, VOB, MBC
    if len(letters) == 4 and re.fullmatch(r"[KWC][A-Z]{3}", core) and len(re.findall(r"[AEIOUY]", core)) <= 1: return True   # call signs: KVTO, CHED, WNYC
    if not re.search(r"[AEIOUYÀ-Ý]", letters): return True       # BDPST
    return False
def word_fix(w, mode):
    core = re.sub(r"[^\w&/+]", "", w)
    if not core or not all(latin(c) for c in core if c.isalpha()): return w
    m = re.fullmatch(r"([A-Za-zÀ-ÿ]{2,})([Ff][Mm])", core)       # joined FM: Hitfm, Adwaafm, DJFM
    if m and core.upper() != "FM":
        head = m.group(1)
        head = head if (head.isupper() and keep_caps(head)) else head.capitalize() if (head.isupper() or head.islower()) else head
        return w.replace(core, head + " FM")
    if core.upper() in ("FM", "AM", "HD") and core != core.upper(): return w.replace(core, core.upper())
    if mode == "caps" and core.isupper():
        return w if keep_caps(core) else w.replace(core, core[0] + core[1:].lower())
    if mode == "low" and core.islower() and core.isalpha():
        return w.replace(core, core[0].upper() + core[1:])
    return w
SMALL = {"of","the","and","de","la","le","el","di","da","du","des","del","y","e","et","von","van","der","den","on","in","for","by"}
def tidy(name):
    n = re.sub(r"\s{2,}", " ", name).strip()
    letters = [c for c in n if c.isalpha()]
    if not letters: return n
    lat = [c for c in letters if latin(c)]
    pure_latin = len(lat) == len(letters)
    domain = re.search(r"\w\.[a-z]{2,}\b", n) is not None
    mode = None
    if pure_latin and not domain:
        words = [w for w in n.split() if re.search(r"[A-Za-zÀ-ÿ]", w)]
        if len(lat) >= 4 and all(c.isupper() for c in lat) and len(words) >= 2: mode = "caps"
        elif all(c.islower() for c in lat): mode = "low"
    out = []
    for i, w in enumerate(n.split(" ")):
        if i > 0 and mode and w.lower() in SMALL: out.append(w.lower()); continue
        out.append(word_fix(w, mode) if (mode or re.search(r"fm|^hd$", w, re.I)) else w)
    r = " ".join(out)
    if mode == "low" and r and r[0].islower(): r = r[0].upper() + r[1:]
    return r


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from check_streams import STATIONS_DIR, load_stations, save_stations
    total = 0
    for path in sorted(STATIONS_DIR.glob("*.js")):
        header, sts = load_stations(path)
        n = 0
        for st in sts:
            t = tidy(st["name"])
            if t != st["name"]:
                st["name"] = t; n += 1
        if n:
            save_stations(path, header, sts); total += n
            print(f"{path.stem}: {n}")
    print(f"{total} names tidied")


if __name__ == "__main__":
    main()
