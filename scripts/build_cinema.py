#!/usr/bin/env python3
"""Build today's original-version (VO) cinema listings for the English OV cinema page.

Sources: MYmovies' "film in lingua originale" page per city (the base list), the cinemas' own
18tickets sites (per-show booking links, halls, and V.O. shows MYmovies misses), Cinebot for
Verona's Alcione, and the site's movies-api Worker (poster, ratings, streaming, release dates).
Runs from .github/workflows/build-cinema.yml; output goes to the cinema-data branch.

    python3 scripts/build_cinema.py --out out --prev prev

Writes out/index.json and out/<city>.json, plus two caches carried between runs:
out/films.json (per-film details and English plots) and out/sites.json (cinemas' own websites).
A city whose fetch fails keeps the previous run's file (from --prev) so the page never goes blank.
"""
import argparse, datetime as dt, html, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

CITIES = [
    ("milano", "Milano"), ("roma", "Roma"), ("torino", "Torino"), ("bologna", "Bologna"),
    ("firenze", "Firenze"), ("napoli", "Napoli"), ("genova", "Genova"), ("venezia", "Venezia"),
    ("padova", "Padova"), ("verona", "Verona"), ("bergamo", "Bergamo"), ("brescia", "Brescia"),
    ("monzabrianza", "Monza"), ("pisa", "Pisa"), ("trieste", "Trieste"),
]
MM_URL = "https://www.mymovies.it/cinema/{slug}/versione-originale/"
ANTEO_URL = "https://anteo.spaziocinema.18tickets.it/"
UA = "Mozilla/5.0 (compatible; ranjithkb-cinema/1.0; +https://ranjithkb.com/)"

# Countries whose productions are (almost always) English-language when listed first.
ANGLO = {"usa", "stati uniti", "gran bretagna", "regno unito", "inghilterra", "irlanda", "canada",
         "australia", "nuova zelanda", "scozia", "galles"}
COUNTRY_EN = {"usa": "USA", "gran bretagna": "UK", "regno unito": "UK", "irlanda": "Ireland",
              "francia": "France", "germania": "Germany", "italia": "Italy", "spagna": "Spain",
              "giappone": "Japan", "corea del sud": "South Korea", "cina": "China", "messico": "Mexico",
              "polonia": "Poland", "lettonia": "Latvia", "belgio": "Belgium", "svezia": "Sweden",
              "danimarca": "Denmark", "norvegia": "Norway", "australia": "Australia", "canada": "Canada",
              "nuova zelanda": "New Zealand", "india": "India", "brasile": "Brazil", "argentina": "Argentina",
              "libano": "Lebanon", "israele": "Israel", "iran": "Iran", "turchia": "Turkey", "svizzera": "Switzerland",
              "austria": "Austria", "olanda": "Netherlands", "paesi bassi": "Netherlands", "portogallo": "Portugal",
              "grecia": "Greece", "romania": "Romania", "russia": "Russia", "ucraina": "Ukraine", "finlandia": "Finland",
              "islanda": "Iceland", "cile": "Chile", "colombia": "Colombia", "taiwan": "Taiwan", "hong kong": "Hong Kong"}
# Anteo's "Lingua:" values → page language label
LANG_EN = {"inglese": "English", "francese": "French", "tedesco": "German", "spagnolo": "Spanish",
           "russo": "Russian", "portoghese": "Portuguese", "arabo": "Arabic", "ebraico": "Hebrew",
           "giapponese": "Japanese", "coreano": "Korean", "polacco": "Polish", "cinese": "Chinese",
           "danese": "Danish", "svedese": "Swedish", "norvegese": "Norwegian", "persiano": "Persian",
           "turco": "Turkish", "hindi": "Hindi", "olandese": "Dutch", "greco": "Greek"}

TIME_RE = re.compile(r"(?<![\d,.:])([01]?\d|2[0-3]):([0-5]\d)(?![\d,.:])")
FILM_RE = re.compile(r"^https?://(?:www\.)?mymovies\.it/film/(\d{4})/[^/?#]+/$")
CINEMA_RE = re.compile(r"^https?://(?:www\.)?mymovies\.it/cinema/[a-z]+/(\d+)/$")


def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "it-IT,it;q=0.9,en;q=0.5"})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"{url}: {last}")


class Tokens(HTMLParser):
    """Flattens HTML into ('a', href, title, text) and ('t', text) tokens, skipping scripts/styles."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip, self.a = [], 0, None

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.skip += 1
        elif tag == "a":
            d = dict(attrs)
            self.a = [d.get("href") or "", d.get("title") or "", []]
        elif tag in ("br", "p", "div", "li", "span", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b") and not self.a:
            self.out.append(("t", "\n"))

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self.skip = max(0, self.skip - 1)
        elif tag == "a" and self.a:
            href, title, parts = self.a
            self.out.append(("a", html.unescape(href), html.unescape(title), " ".join(" ".join(parts).split())))
            self.a = None

    def handle_data(self, data):
        if self.skip:
            return
        if self.a is not None:
            self.a[2].append(data)
        elif data.strip():
            self.out.append(("t", " ".join(data.split())))


def tokens(page):
    p = Tokens()
    p.feed(page)
    return p.out


def times_in(text):
    return [f"{int(h):02d}:{m}" for h, m in TIME_RE.findall(text)]


def parse_mymovies(page, city_name):
    films, film, show, mode = [], None, None, None
    for tok in tokens(page):
        if tok[0] == "a":
            _, href, title, text = tok
            m = FILM_RE.match(href)
            if m and title and text and text.upper() == text and any(c.isalpha() for c in text) \
                    and not title.lower().startswith(("recensione", "cast", "rassegna", "forum")):
                if film and (film["url"] == href):
                    continue
                film = {"t": title.strip(), "url": href, "y": int(m.group(1)), "country": [], "cast": [], "shows": []}
                films.append(film)
                show, mode = None, "meta"
                continue
            if not film:
                continue
            if mode in ("meta", "dir", "cast"):
                if "?country=" in href and text:
                    film["country"].append(COUNTRY_EN.get(norm(text), text.strip()))
                elif "/persone/" in href and text:
                    if mode == "dir":
                        film["dir"] = (film.get("dir", "") + ", " + text).strip(", ")
                    elif mode == "cast" and len(film["cast"]) < 3:
                        film["cast"].append(text)
                elif re.match(r"^https?://(?:www\.)?mymovies\.it/film/\d{4}/$", href):
                    pass
            if mode == "shows":
                cm = CINEMA_RE.match(href)
                if cm and title.lower().startswith("programmazione del cinema"):
                    name = re.sub(r"^programmazione del cinema\s+", "", title, flags=re.I)
                    name = re.sub(r"\s+di\s+" + re.escape(city_name) + r"\s*$", "", name, flags=re.I).strip()
                    show = {"cinema": name, "times": [], "mm": href, "_vo": False}
                    film["shows"].append(show)
                elif "/provincia/" in href:
                    mode = None
            continue
        text = tok[1]
        if not film:
            continue
        low = text.lower()
        if mode in ("meta", "dir", "cast"):
            d = re.search(r"durata\s+(\d+)\s+minuti", low)
            if d:
                film["dur"] = int(d.group(1))
            if "un film di" in low:
                mode = "dir"
            elif mode == "dir" and re.search(r"(^|\.\s*)con\b", low):
                mode = "cast"
            elif "uscita" in low and mode in ("dir", "cast"):
                mode = "meta"
        if low.startswith("oggi a "):
            mode, show = "shows", None
            continue
        if mode == "shows":
            if low.startswith("in provincia") or low.startswith("recensione"):
                mode, show = None, None
                continue
            if show is None:
                continue
            if "versione originale" in low:
                show["_vo"] = True
                text = text[low.index("versione originale"):]
            if show["_vo"]:
                for t in times_in(text):
                    if t not in show["times"]:
                        show["times"].append(t)
    out = []
    for f in films:
        shows = [{k: v for k, v in s.items() if not k.startswith("_")} for s in f["shows"] if s["_vo"] and s["times"]]
        if not shows:
            continue
        for s in shows:
            s["times"].sort()
        f["shows"] = shows
        f["en"], f["lang"] = False, "Original language"
        out.append(f)
    return out


# ====================================================================== cinemas' own ticket sites
T18 = "https://{host}.18tickets.it/"
# host, city id, extra MYmovies names for the cinema(s) behind it. The venue names the site prints
# ("Anteo Palazzo Del Cinema", "Filmclub", ...) are matched too, so aliases are only for odd cases.
SITES = [
    ("anteo.spaziocinema", "milano", ["Anteo Palazzo del Cinema"]),
    ("citylife.spaziocinema", "milano", ["CityLife Anteo"]),
    ("ariosto.spaziocinema", "milano", ["Ariosto spazioCinema"]),
    ("arlecchino.cinetecadimilano", "milano", ["Cineteca Arlecchino"]),
    ("mic.cinetecadimilano", "milano", ["Cineteca Milano MIC", "MIC"]),
    ("capitol.spaziocinema", "monza", ["Capitol"]),
    ("cinema.barberini", "roma", ["Barberini"]),
    ("quattrofontane.ccroma", "roma", ["Quattro Fontane"]),
    ("giuliocesare.ccroma", "roma", ["Giulio Cesare"]),
    ("roma.andromeda", "roma", ["Andromeda"]),
    ("lux.cdr", "roma", ["Lux"]),
    ("nazionale.cctorino", "torino", ["Nazionale"]),
    ("arlecchino.popupcinema", "bologna", ["Arlecchino"]),
    ("medica.popupcinema", "bologna", ["Medica Palace", "Medica"]),
    ("odeon.ccb", "bologna", ["Odeon"]),
    ("rialto.ccb", "bologna", ["Rialto Studios", "Rialto"]),
    ("roma.ccb", "bologna", ["Roma d'Essai", "Roma"]),
    ("europa.ccb", "bologna", ["Europa"]),
    ("lumiere.cinetecabologna", "bologna", ["Lumière", "Lumiere"]),
    ("flora.ccroma", "firenze", ["Flora"]),
    ("casacinema", "napoli", ["CasaCinema", "Casa Cinema"]),
    ("corallo.ccgenova", "genova", ["Corallo"]),
    ("city.ccgenova", "genova", ["City"]),
    ("carignano.ccgenova", "genova", ["Circuito Filmclub", "Filmclub", "Carignano"]),
    ("ariston.ccgenova", "genova", ["Ariston"]),
    ("lab80", "bergamo", ["Lab 80", "Auditorium", "Conca Verde"]),
]
ALCIONE = ("https://ticket.cinebot.it/alcione/", "verona", "Alcione")
# full-price tickets (city id, name the cinema is matched by, euros)
PRICES = [("milano", "Anteo Palazzo del Cinema", 9.5), ("milano", "CityLife Anteo", 9.5),
          ("milano", "Ariosto spazioCinema", 8.5), ("monza", "Capitol", 9.0),
          ("firenze", "Giunti Odeon", 12.0), ("brescia", "Nuovo Eden", 6.5)]
# chains whose booking sites can't be read automatically: link the cinema's own page instead
CHAIN = re.compile(r"\b(uci|the space|space cinema)\b", re.I)

VO_MARK = re.compile(r"\bv\.\s*o\b|\bv\.\s*o\.\s*s\b|\bvos\b|\bvo\b|\bsott(\.|otitol)|\boriginal\s*(language|version)|originalversion|\bsub\.?\s*ita|vers(\.|ione)\s*orig", re.I)
CLEAN_PATTERNS = [
    r"\(\s*\d+\s*h\s*\d*\W*\)",               # (2H13')
    r"\(\s*ried[^)]*\)", r"\bvers\.?\s*rest\.?\s*4k\b", r"\b4k\b",
    r"[-–]\s*\d+\w*\s+anniversary\b",
    r"\boriginal\s*(language|version)\b", r"\bversione\s+originale\b", r"\blingua\s+originale\b",
    r"\bv\.?\s*o\.?\s*s?\.?\s*sott(otitol\w*|\.)?\s*(ita(l\w*)?)?\.?", r"\bsott\.?\s*ita(l\w*)?\.?",
    r"(?<![a-z])v\.\s*o\.(\s*s\.)?", r"\bv\.o\.s\b", r"\bvos\b", r"\bvo\b",
]
SMALL = {"a", "an", "and", "of", "the", "in", "on", "at", "to", "for", "or", "di", "del", "della", "e", "il",
         "la", "le", "lo", "gli", "i", "un", "una", "da", "de", "des", "du", "et", "el", "y"}


def nice_case(s):
    """'GLI INTOCCABILI' → 'Gli intoccabili'-style title case that copes with apostrophes."""
    if not s or s != s.upper():
        return s
    words = s.lower().split(" ")
    out = []
    for i, w in enumerate(words):
        if i and w in SMALL:
            out.append(w)
        else:
            out.append(re.sub(r"(^|[\-'’(“\"])([a-zà-ÿ])", lambda m: m.group(1) + m.group(2).upper(), w))
    return " ".join(out)


def clean_title(raw):
    """'V.O.SOTT.ITA - RAGIONE E SENTIMENTO (SENSE AND SENSIBILITY)' → ('Ragione e Sentimento', 'Sense and Sensibility')."""
    t = html.unescape(" ".join(raw.split()))
    for p in CLEAN_PATTERNS:
        t = re.sub(p, " ", t, flags=re.I)
    alt = None
    m = re.search(r"\(([^()]{2,})\)\s*$", t)
    if m:
        alt, t = m.group(1).strip(), t[:m.start()]
    t = re.sub(r"\s+", " ", t).strip(" -–—:.,;")
    t = re.sub(r"(\s*[-–—]\s*)+$", "", t).strip()
    return nice_case(t), nice_case(alt) if alt else None


def fetch_polite(url, tries=4):
    """fetch() that waits out 18tickets' 'Slow down! Too many requests'."""
    for i in range(tries):
        try:
            page = fetch(url, tries=1)
            if len(page) < 200 and "too many requests" in page.lower():
                raise RuntimeError("429")
            return page
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            time.sleep(12 * (i + 1) if "429" in str(e) else 4)
    return ""


def hall_name(h):
    h = " ".join(html.unescape(h).split())
    if re.fullmatch(r"\d+", h):
        return "Sala " + h
    m = re.fullmatch(r"(?i)sala\s*(\S.*)", h)
    h = ("Sala " + m.group(1)) if m else h
    return "" if h.lower() in ("sala", "") else h


def parse_18tickets(page, host, today):
    """One 18tickets homepage → film blocks with today's not-yet-started shows."""
    rome = ZoneInfo("Europe/Rome")
    ml = page.find("id='movie-list'")
    body = page[ml:] if ml > 0 else page
    out = []
    for blk in body.split("<div class='movie movie--preview'>")[1:]:
        tm = re.search(r"class='movie__title'[^>]*>\s*(.*?)\s*</a>", blk, re.S)
        if not tm:
            continue
        raw = html.unescape(" ".join(tm.group(1).split()))
        opt = lambda k: (lambda m: html.unescape(" ".join(m.group(1).split())) if m else "")(re.search(k + r"\s*</strong>\s*(.*?)\s*</p>", blk, re.S))
        lingua, regia, con = opt("Lingua:"), opt("Regia:"), opt("Con:")
        labels = [html.unescape(" ".join(x.split())) for x in re.findall(r"class='film-label[^']*'>\s*(.*?)\s*</div>", blk, re.S)]
        lw = norm(lingua)
        italian = lw.startswith("italian") or lw in ("ita", "it")
        marked = bool(VO_MARK.search(raw) or any(VO_MARK.search(x) for x in labels) or re.search(r"sott|sub|originale", lw))
        shows, venue, day = [], "", None
        pos = re.compile(r"class='time-select__place'>(.*?)</div>|<a\b[^>]*\bdata-time='(\d+)'[^>]*href='([^']+)'[^>]*>(.*?)</a>|<a\b[^>]*href='([^']+)'[^>]*\bdata-time='(\d+)'[^>]*>(.*?)</a>", re.S)
        for m in pos.finditer(blk):
            if m.group(1) is not None:
                txt = " ".join(re.sub(r"<[^>]+>", " ", html.unescape(m.group(1))).split())
                d = re.search(r"(\d{2}/\d{2}/\d{4})", txt)
                day = d.group(1) if d else day
                venue = txt[d.end():].strip() if d else venue
                continue
            ms, href, inner = (m.group(2), m.group(3), m.group(4)) if m.group(2) else (m.group(6), m.group(5), m.group(7))
            when = dt.datetime.fromtimestamp(int(ms) / 1000, rome)
            if when.date() != today:
                continue
            text = " ".join(re.sub(r"<[^>]+>", " ", html.unescape(inner)).split())
            hh = when.strftime("%H:%M")
            hall = hall_name(re.sub(r"^\D*\d{1,2}[:.]\d{2}", "", text).strip())
            url = href if href.startswith("http") else T18.format(host=host).rstrip("/") + href
            shows.append({"t": hh, "url": url, "hall": hall, "venue": venue})
        if not shows:
            continue
        lang_words = [w for w in lw.split() if w in LANG_EN]
        dur = None
        h2 = re.search(r"\((\d)\s*h\s*(\d{1,2})", raw, re.I)
        if h2:
            dur = int(h2.group(1)) * 60 + int(h2.group(2))
        main, alt = clean_title(raw)
        out.append({"host": host, "raw": raw, "title": main, "alt": alt, "lingua": lingua, "italian": italian,
                    "vo": marked and not italian, "langs": [LANG_EN[w] for w in lang_words],
                    "dir": nice_case(regia), "cast": [c.strip() for c in con.split(",") if c.strip()][:3],
                    "dur": dur, "shows": shows})
    return out


def parse_alcione(page, today):
    """Cinebot (Verona Alcione): event cards with dates like 'Lun 02/11 21:00'. Only cards marked V.O."""
    out, dm = [], today.strftime("%d/%m")
    for m in re.finditer(r'<a href="(/alcione/evento/[^"]+)"[^>]*class="eventi-item.*?<h4 class="title">(.*?)</h4>(.*?)</a>', page, re.S):
        href, title, rest = m.group(1), html.unescape(" ".join(m.group(2).split())), m.group(3)
        if not VO_MARK.search(title):
            continue
        txt = " ".join(re.sub(r"<[^>]+>", " ", html.unescape(rest)).split())
        times = sorted({f"{int(h):02d}:{mi}" for d, h, mi in re.findall(r"(\d{2}/\d{2})\s+(\d{1,2}):(\d{2})", txt) if d == dm})
        if re.search(r"\boggi\b", txt, re.I):
            times = sorted(set(times) | set(times_in(txt)))
        if not times:
            continue
        main, alt = clean_title(title)
        out.append({"host": "alcione", "raw": title, "title": main, "alt": alt, "lingua": "", "italian": False, "vo": True,
                    "langs": [], "dir": "", "cast": [], "dur": None, "book": "https://ticket.cinebot.it" + href,
                    "shows": [{"t": t, "url": None, "hall": "", "venue": "Cinema Alcione"} for t in times]})
    return out


# ---------------------------------------------------------------------- matching
GENERIC = {"cinema", "cine", "multisala", "multiplex", "sala", "sale", "the", "di", "del", "della", "dei", "d",
           "spaziocinema", "spazio", "essai", "palazzo", "studios", "theatre", "theater", "il", "lo", "la", "le",
           "milano", "roma", "torino", "bologna", "firenze", "napoli", "genova", "bergamo", "monza", "verona", "brescia",
           "venezia", "padova", "pisa", "trieste", "cineteca", "circuito"}


def ckey(name):
    return [w for w in norm(name).split() if w not in GENERIC]


def name_score(a, b):
    """How sure we are that cinema names a and b are the same place (0 = no)."""
    ka, kb = ckey(a), ckey(b)
    ca, cb = "".join(ka), "".join(kb)
    if not ca or not cb:
        return 0
    if ca == cb:
        return 3
    if len(min(ca, cb, key=len)) >= 4 and (ca in cb or cb in ca):
        return 2
    if set(w for w in ka if len(w) >= 5) & set(w for w in kb if len(w) >= 5):
        return 1
    return 0


def title_keys(f):
    return {k for k in (norm(f.get("t")), norm(f.get("it")), norm(f.get("orig"))) if k}


def match(keys, title):
    return any(k and (k == title or (len(k) > 3 and (k in title or title in k))) for k in keys)


def film_score(keys, blk):
    """Does an 18tickets block show this MYmovies film? 0 = no, higher = surer."""
    best = 0
    for b in {norm(blk["title"]), norm(blk["alt"] or "")} - {""}:
        for k in keys:
            if k == b:
                best = max(best, 3)
            elif len(min(k, b, key=len)) >= 4 and (b.startswith(k + " ") or k.startswith(b + " ")):
                best = max(best, 2)
            elif min(len(k), len(b)) >= 6 and lev_ratio(k, b) >= 0.86:
                best = max(best, 2)
    return best


def merge_city(cid, city_name, films, blocks, report):
    """Adds per-show links, halls and missing V.O. shows from the cinemas' sites; drops times they list as Italian."""
    # which MYmovies cinema name each site venue is (best name match within the city)
    mm_names = {s["cinema"] for f in films for s in f["shows"]}
    site_names = {}
    for b in blocks:
        for sh in b["shows"]:
            v = sh["venue"] or b["host"]
            if (b["host"], v) in site_names:
                continue
            aliases = next((a for h, c, a in SITES if h == b["host"]), [])
            cands = [(max([name_score(v, n)] + [name_score(a, n) for a in aliases]), n) for n in mm_names]
            cands.sort(reverse=True)
            ok = cands and cands[0][0] >= 2 or (cands and cands[0][0] == 1 and (len(cands) == 1 or cands[1][0] == 0))
            site_names[(b["host"], v)] = cands[0][1] if ok else (aliases[0] if aliases else v)
    added = linked = dropped = 0
    for b in blocks:
        keys_b = b
        target = None
        sc = [(film_score(title_keys(f), b), i) for i, f in enumerate(films)]
        sc = [x for x in sc if x[0]]
        if sc:
            target = films[max(sc)[1]]
        if b["italian"] and not b["vo"]:
            # times this cinema sells as dubbed: drop them from the V.O. list unless also sold as V.O.
            if not target:
                continue
            vo_times = {sh["t"] for bb in blocks if bb["vo"] and bb["host"] == b["host"] and film_score(title_keys(target), bb) for sh in bb["shows"]}
            for sh in b["shows"]:
                name = site_names[(b["host"], sh["venue"] or b["host"])]
                for s in target["shows"]:
                    if s["cinema"] == name and sh["t"] in s["times"] and sh["t"] not in vo_times:
                        s["times"].remove(sh["t"])
                        dropped += 1
            continue
        if not b["vo"]:
            continue
        if not target:
            target = {"t": b["alt"] or b["title"], "it": b["title"] if b["alt"] else None, "url": None, "y": None,
                      "country": [], "cast": b["cast"], "dir": b["dir"] or None, "dur": b["dur"], "shows": [],
                      "en": False, "lang": "Original language", "src": b["host"]}
            if not target["it"]:
                target.pop("it")
            films.append(target)
            report.append(f"    + new from {b['host']}: {target['t']}")
        if b.get("langs"):
            target["_t18lang"] = b["langs"]
        if not target.get("dur") and b.get("dur"):
            target["dur"] = b["dur"]
        for sh in b["shows"]:
            name = site_names[(b["host"], sh["venue"] or b["host"])]
            show = next((s for s in target["shows"] if s["cinema"] == name), None)
            if not show:
                show = {"cinema": name, "times": []}
                target["shows"].append(show)
            if sh["t"] not in show["times"]:
                show["times"].append(sh["t"])
                added += 1
            if b["host"] == "alcione":
                show["book"] = b["book"]
            else:
                show["book"] = T18.format(host=b["host"])
            if sh["url"]:
                show.setdefault("links", {})[sh["t"]] = sh["url"]
                linked += 1
            if sh["hall"]:
                show.setdefault("halls", {})[sh["t"]] = sh["hall"]
    for f in films:
        f["shows"] = [s for s in f["shows"] if s["times"]]
        for s in f["shows"]:
            s["times"] = sorted(set(s["times"]))
    films[:] = [f for f in films if f["shows"]]
    unmatched = sorted({f"{h}:{v}→{n}" for (h, v), n in site_names.items() if n not in mm_names})
    report.append(f"    sites: {linked} per-show links, {added} times added, {dropped} Italian times dropped"
                  + (f"; venues not on MYmovies: {', '.join(unmatched)}" if unmatched else ""))


# ---------------------------------------------------------------------- film details
WORKER = "https://movies-api.ranjeethkkb.workers.dev"
FILM_CACHE = {}
WD_LANG = {"Q1860": "English", "Q150": "French", "Q188": "German", "Q7737": "Russian", "Q9288": "Hebrew",
           "Q652": "Italian", "Q1321": "Spanish", "Q5146": "Portuguese", "Q13955": "Arabic", "Q5287": "Japanese",
           "Q9176": "Korean", "Q809": "Polish", "Q7411": "Dutch", "Q9035": "Danish", "Q9027": "Swedish",
           "Q9043": "Norwegian", "Q9168": "Persian", "Q256": "Turkish", "Q1568": "Hindi", "Q9056": "Czech",
           "Q9067": "Hungarian", "Q7850": "Chinese", "Q727694": "Cantonese", "Q9186": "Cantonese", "Q36510": "Ukrainian",
           "Q1412": "Finnish", "Q294": "Icelandic", "Q36236": "Malayalam", "Q5885": "Tamil", "Q8097": "Telugu", "Q36368": "Greek"}
FILM_TYPES = {"Q11424", "Q93204", "Q24869", "Q506240", "Q20650540", "Q202866", "Q226730", "Q24862"}


def wd_get(params):
    q = urllib.parse.urlencode({**params, "format": "json"})
    return json.loads(fetch("https://www.wikidata.org/w/api.php?" + q, tries=2))


def wikidata_lang(title, year):
    """Original language(s) of a film from Wikidata (P364), checked against the release year."""
    try:
        hits = wd_get({"action": "wbsearchentities", "search": title, "language": "en", "type": "item", "limit": 7}).get("search", [])
        ids = [h["id"] for h in hits]
        if not ids:
            return None
        ents = wd_get({"action": "wbgetentities", "ids": "|".join(ids), "props": "claims|labels", "languages": "en"}).get("entities", {})
        for qid in ids:
            c = ents.get(qid, {}).get("claims", {})
            kinds = {x["mainsnak"].get("datavalue", {}).get("value", {}).get("id") for x in c.get("P31", [])}
            if not kinds & FILM_TYPES:
                continue
            years = {int(x["mainsnak"]["datavalue"]["value"]["time"][1:5]) for x in c.get("P577", []) if x["mainsnak"].get("datavalue")}
            if year and years and not any(abs(y - year) <= 1 for y in years):
                continue
            langs = [x["mainsnak"].get("datavalue", {}).get("value", {}).get("id") for x in c.get("P364", [])]
            langs = [WD_LANG[l] for l in langs if l in WD_LANG]
            if langs:
                label = ents[qid].get("labels", {}).get("en", {}).get("value")
                return {"lang": " / ".join(dict.fromkeys(langs)), "en": langs[0] == "English", "label": label}
    except Exception:  # noqa: BLE001
        return None
    return None


def worker(path, params=None):
    q = ("?" + urllib.parse.urlencode({k: v for k, v in (params or {}).items() if v})) if params else ""
    return json.loads(fetch(WORKER + path + q, tries=2))


def translate_en(text):
    """Italian → English. Google's public endpoint first, MyMemory as backup. None if both fail."""
    if not text:
        return None
    try:
        u = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode({"client": "gtx", "sl": "it", "tl": "en", "dt": "t", "q": text})
        d = json.loads(fetch(u, tries=2))
        out = "".join(seg[0] for seg in d[0] if seg and seg[0]).strip()
        if out:
            return out
    except Exception:  # noqa: BLE001
        pass
    try:
        u = "https://api.mymemory.translated.net/get?" + urllib.parse.urlencode({"q": text[:480], "langpair": "it|en"})
        out = json.loads(fetch(u, tries=2)).get("responseData", {}).get("translatedText", "").strip()
        return out or None
    except Exception:  # noqa: BLE001
        return None


def two_sentences(text, limit=320):
    text = " ".join((text or "").split())
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9“\"'])", text)
    out = " ".join(parts[:2]).strip()
    if len(out) > limit:
        out = out[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return out or None


def mymovies_page(url):
    """Original title, countries, Italian plot, poster and runtime from a MYmovies film page."""
    info = {}
    page = fetch(url, tries=2)
    for blob in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S):
        try:
            d = json.loads(blob, strict=False)
        except ValueError:
            continue
        if isinstance(d, dict) and d.get("@type") == "Movie":
            info["plot_it"] = html.unescape(d.get("description") or "").strip() or None
            img = d.get("image")
            if isinstance(img, list) and img:
                img = img[0].get("url") if isinstance(img[0], dict) else img[0]
            elif isinstance(img, dict):
                img = img.get("url")
            info["img"] = img if isinstance(img, str) else None
            m = re.match(r"PT(\d+)M", d.get("duration") or "")
            if m:
                info["dur"] = int(m.group(1))
    toks = tokens(page)
    for i, tok in enumerate(toks):
        if tok[0] == "t" and tok[1].lower().startswith("titolo originale"):
            rest = tok[1][len("titolo originale"):].strip(" :|")
            if not rest:
                rest = next((t[1] if t[0] == "t" else t[3] for t in toks[i + 1:i + 5] if (t[1] if t[0] == "t" else t[3]).strip(" \n:|")), "")
            info["orig"] = rest.strip(" :|").strip()
            break
    cs = [t[3] for t in toks if t[0] == "a" and "?country=" in t[1] and t[3]]
    info["country"] = list(dict.fromkeys(COUNTRY_EN.get(norm(c), c) for c in cs))[:4]
    return info


def film_key(f):
    return f.get("url") or "t:" + norm(f.get("t")) + "|" + str(f.get("y") or "")


def details(f, cache, today):
    """Everything about a film that doesn't change with the showtimes, cached between runs.
    Ratings/streaming are refreshed once a day; the plot and the rest are kept."""
    key = film_key(f)
    f["_k"] = key
    c = cache.get(key) or {}
    if c.get("day") == today:
        return c
    if f.get("url") and "mm" not in c:
        try:
            c["mm"] = mymovies_page(f["url"])
        except Exception:  # noqa: BLE001
            c["mm"] = {}
        time.sleep(0.4)
    mm = c.get("mm") or {}
    title = mm.get("orig") or f.get("orig") or f["t"]
    if "tmdb" not in c:
        try:
            hit = worker("/match", {"title": title, "year": f.get("y") or ""})
            if not hit and title != f["t"]:
                hit = worker("/match", {"title": f["t"], "year": f.get("y") or ""})
            c["tmdb"] = hit.get("id") if hit else None
        except Exception:  # noqa: BLE001
            pass  # try again next run
    if c.get("tmdb"):
        try:
            d = worker(f"/movie/{c['tmdb']}")
            it = (d.get("providers") or {}).get("IT") or {}
            c["tm"] = {
                "title": d.get("title"), "original": d.get("original"), "year": d.get("year"), "runtime": d.get("runtime"),
                "olang": d.get("olang"), "langName": d.get("langName"), "overview": d.get("overview"),
                "poster": d.get("poster"), "imdb": d.get("imdb"),
                "ratings": {k: v for k, v in (d.get("ratings") or {}).items() if k in ("imdb", "rt", "mc")},
                "stream": [p["name"] for p in it.get("stream") or []], "streamLink": it.get("link"),
                "releases": d.get("releases") or {}, "rtLink": (d.get("links") or {}).get("rt"),
            }
            c["day"] = today
        except Exception:  # noqa: BLE001
            pass
    if "syn" not in c:
        plot = translate_en(mm.get("plot_it")) if mm.get("plot_it") else None
        c["syn"] = two_sentences(plot) or two_sentences((c.get("tm") or {}).get("overview"))
        c["synSrc"] = "mymovies" if plot else ("tmdb" if c["syn"] else None)
    elif not c["syn"] and (c.get("tm") or {}).get("overview"):
        c["syn"], c["synSrc"] = two_sentences(c["tm"]["overview"]), "tmdb"
    if "wd" not in c and not c.get("tm"):
        c["wd"] = wikidata_lang(title, f.get("y"))
    cache[key] = c
    return c


def load_overrides():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cinema_overrides.json")
    try:
        with open(p, encoding="utf-8") as fh:
            return {norm(k): v for k, v in json.load(fh).items() if not k.startswith("_")}
    except FileNotFoundError:
        return {}


TMDB_LANG_EN = {"en"}


def enrich(films, cache, overrides, today):
    for f in films:
        c = details(f, cache, today)
        mm, tm, wd = c.get("mm") or {}, c.get("tm") or {}, c.get("wd")
        if mm.get("country") and not f.get("country"):
            f["country"] = mm["country"]
        if mm.get("dur") and not f.get("dur"):
            f["dur"] = mm["dur"]
        if tm.get("runtime") and not f.get("dur"):
            f["dur"] = tm["runtime"]
        if not f.get("y") and tm.get("year"):
            f["y"] = tm["year"]
        mm_title = f["t"]
        orig = (mm.get("orig") or "").strip()
        # Show the original title. TMDB's English title fixes MYmovies' occasional typos in it.
        if orig and norm(orig) != norm(mm_title):
            f["t"], f["it"] = orig, f.get("it") or mm_title
        if tm.get("title") and (not orig or lev_ratio(norm(tm["title"]), norm(orig)) >= 0.8) and tm.get("olang") == "en":
            if norm(tm["title"]) != norm(f["t"]):
                f.setdefault("it", mm_title)
                f["t"] = tm["title"]
        if f.get("it") and norm(f["it"]) == norm(f["t"]):
            f.pop("it")
        keys = title_keys(f) | {norm(mm_title)}
        ov = next((v for k, v in overrides.items() if k in keys), None)
        if ov and ov.get("title"):
            if norm(ov["title"]) != norm(mm_title):
                f["it"] = f.get("it") or mm_title
            f["t"] = ov["title"]
        t18 = f.pop("_t18lang", None)
        if ov and "en" in ov:
            f["lang"], f["en"], f["langSrc"] = ov.get("lang", f.get("lang")), bool(ov.get("en")), "manual"
        elif t18:
            f["lang"], f["en"], f["langSrc"] = " / ".join(dict.fromkeys(t18)), t18[0] == "English", "cinema"
        elif tm.get("olang"):
            f["lang"], f["en"], f["langSrc"] = tm.get("langName") or tm["olang"], tm["olang"] in TMDB_LANG_EN, "tmdb"
        elif wd:
            f["lang"], f["en"], f["langSrc"] = wd["lang"], wd["en"], "wikidata"
        else:
            first = norm(f["country"][0]) if f.get("country") else ""
            f["en"] = first in {norm(x) for x in ANGLO} or first == "uk"
            f["lang"], f["langSrc"] = ("English" if f["en"] else "Original language"), "country"
        # the extras the page shows
        if c.get("syn"):
            f["syn"] = c["syn"]
        poster = tm.get("poster")
        f["poster"] = f"{WORKER}/img/w185{poster}" if poster else (mm.get("img") or None)
        r = tm.get("ratings") or {}
        if r.get("imdb") or r.get("rt") is not None:
            f["ratings"] = {k: v for k, v in r.items() if v is not None}
            if tm.get("imdb"):
                f["imdbUrl"] = f"https://www.imdb.com/title/{tm['imdb']}/"
            if tm.get("rtLink"):
                f["rtUrl"] = tm["rtLink"]
        if tm.get("stream"):
            f["stream"] = {"on": tm["stream"][:4], "link": tm.get("streamLink")}
        rel = tm.get("releases") or {}
        digital = (rel.get("IT") or {}).get("digital")
        if digital:
            f["ott"] = {"date": digital, "where": "IT"}
        elif (rel.get("US") or {}).get("digital") or (rel.get("GB") or {}).get("digital"):
            f["ott"] = {"date": (rel.get("US") or {}).get("digital") or rel["GB"]["digital"], "where": "US" if (rel.get("US") or {}).get("digital") else "GB"}
        f.pop("orig", None)


def lev_ratio(a, b):
    if not a or not b:
        return 0.0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return 1 - prev[-1] / max(len(a), len(b))


# ---------------------------------------------------------------------- cinema websites and prices
def official_site(mm_url, sites):
    """A cinema's own website, from the 'Sito ufficiale' link on its MYmovies page (cached)."""
    if not mm_url:
        return None
    if mm_url in sites:
        return sites[mm_url]
    url = None
    try:
        page = fetch(mm_url, tries=2)
        m = re.search(r'<a href="(https?://[^"]+)"[^>]*>\s*<span[^>]*>\s*Sito(?:&nbsp;|\s)+ufficiale', page, re.I)
        if m and "mymovies" not in m.group(1):
            url = html.unescape(m.group(1))
        time.sleep(0.4)
    except Exception:  # noqa: BLE001
        return None  # not cached: try again next run
    sites[mm_url] = url
    return url


def finish_shows(cid, films, sites):
    for f in films:
        for s in f["shows"]:
            for c, name, eur in PRICES:
                if c == cid and name_score(name, s["cinema"]) >= 2:
                    s["price"] = eur
            if not s.get("book"):
                site = official_site(s.get("mm"), sites)
                if site:
                    s["book"] = site
            if CHAIN.search(s["cinema"]):
                s["chain"] = True


# ---------------------------------------------------------------------- run
def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, ValueError):
        return default


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    ap.add_argument("--prev", default="prev")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    now = dt.datetime.now(ZoneInfo("Europe/Rome"))
    today = now.date()
    stamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    report, index = [], []
    overrides = load_overrides()
    cache = load_json(os.path.join(a.prev, "films.json"), {})
    sites = load_json(os.path.join(a.prev, "sites.json"), {})
    # forget film details nobody has needed for a month
    cutoff = (today - dt.timedelta(days=30)).isoformat()
    cache = {k: v for k, v in cache.items() if (v.get("seen") or "") >= cutoff}

    blocks_by_city = {}
    for host, cid, _aliases in SITES:
        try:
            bl = parse_18tickets(fetch_polite(T18.format(host=host)), host, today)
            blocks_by_city.setdefault(cid, []).extend(bl)
            report.append(f"{host}: {sum(1 for b in bl if b['vo'])} V.O. films today ({sum(len(b['shows']) for b in bl if b['vo'])} shows), {sum(1 for b in bl if b['italian'])} dubbed")
        except Exception as e:  # noqa: BLE001
            report.append(f"{host}: FAILED ({e})")
        time.sleep(2.5)
    try:
        bl = parse_alcione(fetch_polite(ALCIONE[0]), today)
        blocks_by_city.setdefault(ALCIONE[1], []).extend(bl)
        report.append(f"alcione: {len(bl)} V.O. films today")
    except Exception as e:  # noqa: BLE001
        report.append(f"alcione: FAILED ({e})")

    for slug, name in CITIES:
        cid = "monza" if slug == "monzabrianza" else slug
        path = os.path.join(a.out, cid + ".json")
        try:
            films = parse_mymovies(fetch(MM_URL.format(slug=slug)), name)
            if cid == "milano" and not films:
                raise RuntimeError("no films parsed for Milano — page layout may have changed")
            sub = []
            merge_city(cid, name, films, blocks_by_city.get(cid, []), sub)
            enrich(films, cache, overrides, today.isoformat())
            finish_shows(cid, films, sites)
            for f in films:
                cache.get(f.pop("_k", film_key(f)), {})["seen"] = today.isoformat()
            doc = {"city": name, "date": today.isoformat(), "updatedAt": stamp,
                   "source": MM_URL.format(slug=slug), "films": films}
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
            en = sum(1 for f in films if f["en"])
            report.append(f"{name}: {len(films)} films ({en} English)")
            report += sub
            report += [f"    {'EN' if f['en'] else '--'} {f['t']} [{f.get('lang')} via {f.get('langSrc')}]"
                       f"{' syn' if f.get('syn') else ''}{' poster' if f.get('poster') else ''}{' imdb' if (f.get('ratings') or {}).get('imdb') else ''}"
                       f"{' stream' if f.get('stream') else ''}{' ott' if f.get('ott') else ''}"
                       f" · {sum(len(s.get('links') or {}) for s in f['shows'])} links" for f in films]
            index.append({"id": cid, "name": name, "films": len(films), "english": en, "date": doc["date"]})
        except Exception as e:  # noqa: BLE001
            old = os.path.join(a.prev, cid + ".json")
            if os.path.exists(old):
                doc = load_json(old, {})
                with open(path, "w", encoding="utf-8") as fh:
                    json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
                index.append({"id": cid, "name": name, "films": len(doc.get("films", [])),
                              "english": sum(1 for f in doc.get("films", []) if f.get("en")), "date": doc.get("date"), "stale": True})
            report.append(f"{name}: FAILED ({e}){' — kept previous data' if os.path.exists(old) else ''}")
        time.sleep(1.5)

    for fname, data in (("films.json", cache), ("sites.json", sites)):
        with open(os.path.join(a.out, fname), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(a.out, "index.json"), "w", encoding="utf-8") as fh:
        json.dump({"updatedAt": stamp, "date": today.isoformat(), "cities": index}, fh, ensure_ascii=False)
    with open(os.path.join(a.out, "report.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(["### Cinema build", "```"] + report + ["```"]) + "\n")
    print("\n".join(report))
    if not any(c["id"] == "milano" and not c.get("stale") for c in index):
        sys.exit(1)


if __name__ == "__main__":
    main()
