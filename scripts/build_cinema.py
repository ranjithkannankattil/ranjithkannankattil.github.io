#!/usr/bin/env python3
"""Build today's original-version (VO) cinema listings for the English OV cinema page.

Source: MYmovies' "film in lingua originale" page per city, plus Anteo's own
ticket site (18tickets) for per-screening booking links in Milan.
Runs from .github/workflows/build-cinema.yml; output goes to the cinema-data branch.

    python3 scripts/build_cinema.py --out out --prev prev

Writes out/index.json and out/<city>.json. A city whose fetch fails keeps the
previous run's file (from --prev) so the page never goes blank.
"""
import argparse, datetime as dt, html, json, os, re, sys, time, unicodedata, urllib.request
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

TIME_RE = re.compile(r"(?<![\d,.])([01]?\d|2[0-3])[:.]([0-5]\d)(?![\d,])")
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
        first = norm(f["country"][0]) if f["country"] else ""
        f["en"] = first in {norm(c) for c in ANGLO} or (f["country"][:1] == ["UK"])
        f["lang"] = "English" if f["en"] else "Original language"
        out.append(f)
    return out


def parse_anteo(page, today):
    """Anteo 18tickets → {(norm title, 'HH:MM'): (url, language label, is_english)} for today's V.O. screenings."""
    links, cur, lang, date, want_lang = {}, None, "", None, False
    datestr = today.strftime("%d/%m/%Y")
    for tok in tokens(page):
        if tok[0] == "a":
            _, href, _title, text = tok
            if re.search(r"/film/\d+/?$", href) and text and not text.lower().startswith(("guarda", "programmazione")):
                t = re.sub(r"v\.?\s*o\.?\s*sott\.?\s*ita\.?\s*-?", " ", text, flags=re.I)
                t = re.sub(r"^\W+", "", t).strip()
                if t:
                    cur, lang, date = norm(t), "", None
                continue
            m = re.search(r"/film/\d+/[0-9a-f-]{36}", href)
            if m and cur and lang and date == datestr:
                tt = times_in(text)
                if tt and not lang.startswith("italiano"):
                    url = href if href.startswith("http") else ANTEO_URL.rstrip("/") + href
                    first = norm(lang).split()[0] if norm(lang) else ""
                    label = " / ".join(LANG_EN[w] for w in norm(lang).split() if w in LANG_EN) or "Original language"
                    links[(cur, tt[0])] = (url, label, first == "inglese")
            continue
        text = tok[1]
        low = text.lower()
        if text == "\n":
            continue
        if low.startswith("lingua:"):
            lang = norm(text[7:])
            want_lang = not lang
            continue
        if cur and want_lang:
            lang, want_lang = norm(text), False
        d = re.search(r"\b(\d{2}/\d{2}/\d{4})\b", text)
        if d:
            date = d.group(1)
    return links


def attach_anteo(films, links):
    n = 0
    for f in films:
        names = {norm(f["t"]), norm(f.get("it", ""))} - {""}
        for s in f["shows"]:
            if "anteo palazzo" not in norm(s["cinema"]):
                continue
            for t in s["times"]:
                for (title, tm), (url, label, is_en) in links.items():
                    if tm == t and any(n_ and (n_ in title or title in n_) for n_ in names):
                        s.setdefault("links", {})[t] = url
                        f["lang"], f["en"] = label, is_en
                        n += 1
                        break
    return n


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

    anteo = {}
    try:
        anteo = parse_anteo(fetch(ANTEO_URL), today)
        report.append(f"Anteo booking links today: {len(anteo)}")
    except Exception as e:  # noqa: BLE001
        report.append(f"Anteo links failed: {e}")

    for slug, name in CITIES:
        cid = "monza" if slug == "monzabrianza" else slug
        path = os.path.join(a.out, cid + ".json")
        try:
            films = parse_mymovies(fetch(MM_URL.format(slug=slug)), name if cid != "monza" else "Monza")
            linked = attach_anteo(films, anteo) if cid == "milano" else 0
            if cid == "milano" and not films:
                raise RuntimeError("no films parsed for Milano — page layout may have changed")
            doc = {"city": name, "date": today.isoformat(), "updatedAt": stamp,
                   "source": MM_URL.format(slug=slug), "films": films}
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
            en = sum(1 for f in films if f["en"])
            report.append(f"{name}: {len(films)} films ({en} English), {linked} per-screening links")
            index.append({"id": cid, "name": name, "films": len(films), "english": en, "date": doc["date"]})
        except Exception as e:  # noqa: BLE001
            old = os.path.join(a.prev, cid + ".json")
            if os.path.exists(old):
                with open(old, encoding="utf-8") as fh:
                    doc = json.load(fh)
                with open(path, "w", encoding="utf-8") as fh:
                    json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
                index.append({"id": cid, "name": name, "films": len(doc.get("films", [])),
                              "english": sum(1 for f in doc.get("films", []) if f.get("en")), "date": doc.get("date"), "stale": True})
            report.append(f"{name}: FAILED ({e}){' — kept previous data' if os.path.exists(old) else ''}")
        time.sleep(1.5)

    with open(os.path.join(a.out, "index.json"), "w", encoding="utf-8") as fh:
        json.dump({"updatedAt": stamp, "date": today.isoformat(), "cities": index}, fh, ensure_ascii=False)
    with open(os.path.join(a.out, "report.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(["### Cinema build"] + [f"- {r}" for r in report]) + "\n")
    print("\n".join(report))
    if not any(c["id"] == "milano" and not c.get("stale") for c in index):
        sys.exit(1)


if __name__ == "__main__":
    main()
