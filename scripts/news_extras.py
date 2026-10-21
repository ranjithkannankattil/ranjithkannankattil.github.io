"""Extras for build_news.py: district pages, article excerpts, Gemini summaries/digests, morning epub."""
import hashlib, html, json, os, re, time, urllib.parse, urllib.request, zipfile
import email.utils
from pathlib import Path

TAG = re.compile(r"<[^>]+>")


def _clean(t):
    return re.sub(r"\s+", " ", html.unescape(TAG.sub(" ", t or ""))).strip()


# ------------------------------------------------------------------ district pages
SKIP_PATH = re.compile(r"/(tag|tags|topic|topics|author|authors|video|videos|photo|photos|gallery|live-tv|podcast|search|login|subscribe|"
                       r"epaper|e-paper|about|contact|privacy|terms|advertise|careers|rss)(/|$|\.)", re.I)


def harvest_page(text, base):
    """Story links from a paper's district page (HTML) or a city RSS feed."""
    if not text:
        return []
    out, seen = [], set()
    if "<item>" in text or "<item " in text:
        for it in re.findall(r"<item\b[^>]*>(.*?)</item>", text, re.S):
            def tag(n):
                m = re.search(rf"<{n}[^>]*>(.*?)</{n}>", it, re.S)
                return html.unescape(re.sub(r"^\s*<!\[CDATA\[|\]\]>\s*$", "", m.group(1).strip())) if m else ""
            t, u = _clean(tag("title")), tag("link").strip()
            if not t or not u or u in seen:
                continue
            seen.add(u)
            d = {"t": t, "u": u}
            try:
                d["ts"] = int(email.utils.parsedate_to_datetime(tag("pubDate")).timestamp())
            except (TypeError, ValueError):
                pass
            desc = _clean(tag("description"))
            if len(desc) > 30:
                d["s"] = desc[:300]
            out.append(d)
        return out[:40]
    bh = urllib.parse.urlparse(base).hostname or ""
    root = ".".join(bh.split(".")[-2:])
    for href, inner in re.findall(r'<a\b[^>]*?href\s*=\s*"([^"#]+)"[^>]*>(.*?)</a>', text, re.S | re.I):
        t = _clean(inner)
        if not (20 <= len(t) <= 220):
            continue
        u = urllib.parse.urljoin(base, html.unescape(href))
        pu = urllib.parse.urlparse(u)
        if not (pu.hostname or "").endswith(root) or SKIP_PATH.search(pu.path):
            continue
        slug = pu.path.rstrip("/").rsplit("/", 1)[-1]
        if pu.path.count("/") < 2 or (len(slug) < 25 and not re.search(r"\d{4,}", pu.path)):
            continue
        if u in seen:
            continue
        seen.add(u)
        out.append({"t": t, "u": u})
    return out[:40]


PUB = [re.compile(r'<meta[^>]+(?:property|name|itemprop)\s*=\s*["\'](?:article:published_time|og:article:published_time|datePublished|publish-date|pubdate)["\'][^>]*content\s*=\s*["\']([^"\']+)', re.I),
       re.compile(r'"datePublished"\s*:\s*"([^"]+)"')]


def published(page):
    """Publication time (unix) from an article page, if it says."""
    if not page:
        return None
    import datetime as dt
    for rx in PUB:
        m = rx.search(page)
        if m:
            v = m.group(1).strip().replace("Z", "+00:00")
            try:
                t = dt.datetime.fromisoformat(v)
                if t.tzinfo is None:
                    t = t.replace(tzinfo=dt.timezone(dt.timedelta(hours=5, minutes=30)))
                return int(t.timestamp())
            except ValueError:
                continue
    return None


def script_ok(t, lang):
    """Headlines in a non-Latin language should be in that script (drops menu links like 'OPINION')."""
    if lang in ("en", "it", "fr", "de", "es", "pt"):
        return True
    letters = [c for c in t if c.isalpha()]
    return bool(letters) and sum(1 for c in letters if ord(c) > 0x2FF) / len(letters) > 0.5


def diversify(items, key=lambda s: s.get("src")):
    """Keep roughly time order but don't let one paper take three slots in a row."""
    out, rest = [], list(items)
    while rest:
        pick = 0
        if len(out) >= 2 and key(out[-1]) == key(out[-2]):
            for i, s in enumerate(rest):
                if key(s) != key(out[-1]):
                    pick = i
                    break
        out.append(rest.pop(pick))
    return out


def round_robin(items, key=lambda s: s.get("src")):
    """One from each paper in turn (each paper's own order kept)."""
    from collections import OrderedDict
    q = OrderedDict()
    for it in items:
        q.setdefault(key(it), []).append(it)
    out = []
    while q:
        for k in list(q):
            out.append(q[k].pop(0))
            if not q[k]:
                del q[k]
    return out


def excerpt(page):
    """First paragraphs of an article, for summarising when the paper gave no standfirst."""
    if not page:
        return ""
    body = re.sub(r"<(script|style|noscript)\b.*?</\1>", " ", page, flags=re.S | re.I)
    paras = [_clean(p) for p in re.findall(r"<p\b[^>]*>(.*?)</p>", body, re.S | re.I)]
    paras = [p for p in paras if len(p) > 60 and not re.search(r"cookie|subscribe|sign up|newsletter|javascript|all rights reserved", p, re.I)]
    text = " ".join(paras)
    return text[:1500]


# ------------------------------------------------------------------ Gemini
class AI:
    """Gemini via its REST API. Off unless the GEMINI_API_KEY secret is set."""
    MAX_CALLS = 30

    def __init__(self, cache):
        self.key = os.environ.get("GEMINI_API_KEY", "").strip()
        self.model = os.environ.get("GEMINI_MODEL", "").strip() or "gemini-flash-lite-latest"
        self.cache, self.calls, self.errors = cache, 0, 0
        self.on = bool(self.key)

    def _ask(self, prompt):
        if self.calls >= self.MAX_CALLS:
            return None
        self.calls += 1
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        body = {"contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}}
        req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "x-goog-api-key": self.key})
        for attempt in range(2):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    d = json.load(r)
                txt = d["candidates"][0]["content"]["parts"][0]["text"]
                time.sleep(4.5)   # stay under the free tier's per-minute limit
                return json.loads(txt)
            except Exception as e:  # noqa: BLE001
                if getattr(e, "code", None) == 429 and attempt == 0:
                    time.sleep(30)
                    continue
                self.errors += 1
                print("AI error:", str(e)[:120], flush=True)
                return None

    def summaries(self, stories):
        """Two-line summaries from the article's own opening paragraphs."""
        todo = []
        for s in stories:
            c = self.cache.get(s.get("_k"), {})
            if c.get("ai_s"):
                s["s"], s["ai"] = c["ai_s"], 1
            else:
                todo.append(s)
        for i in range(0, min(len(todo), 150), 25):
            batch = todo[i:i + 25]
            items = [{"i": n, "headline": s["t"], "text": s["_x"][:1200]} for n, s in enumerate(batch)]
            prompt = ("Summarise each news article below in at most two short sentences (under 40 words), in the same language as "
                      "the article. Use only facts stated in its text; no opinions, no speculation. Return JSON: "
                      '[{"i": number, "s": "summary"}].\n\n' + json.dumps(items, ensure_ascii=False))
            res = self._ask(prompt)
            if not isinstance(res, list):
                continue
            for r in res:
                try:
                    s = batch[int(r["i"])]
                except (KeyError, ValueError, IndexError, TypeError):
                    continue
                txt = str(r.get("s", "")).strip()
                if 20 < len(txt) < 400:
                    s["s"], s["ai"] = txt, 1
                    if s.get("_k") in self.cache:
                        self.cache[s["_k"]]["ai_s"] = txt

    def digest(self, place, lang_name, stories):
        """Three neutral bullet points on what the trusted papers are reporting about a place."""
        top = stories[:14]
        if len(top) < 3:
            return None
        lines = [f"- {s['t']} ({s.get('src', '')})" + (f": {s['s']}" if s.get("s") else "") for s in top]
        h = "ai_d:" + hashlib.sha1((place + lang_name + "".join(lines)).encode()).hexdigest()[:16]
        if h in self.cache:
            self.cache[h]["seen"] = int(time.time())
            return self.cache[h]["d"]
        prompt = (f"These are today's headlines about {place} from trusted newspapers, in {lang_name}.\n" + "\n".join(lines) +
                  f"\n\nWrite a neutral briefing of the 3 most important stories as 3 bullet points in {lang_name}, each under 28 words, "
                  "using only the facts above. Return JSON: {\"bullets\": [\"...\", \"...\", \"...\"]}")
        res = self._ask(prompt)
        b = res.get("bullets") if isinstance(res, dict) else None
        if not b or not all(isinstance(x, str) for x in b):
            return None
        d = {"b": [x.strip() for x in b[:3]], "ts": int(time.time())}
        self.cache[h] = {"d": d, "seen": int(time.time())}
        return d


# ------------------------------------------------------------------ morning briefing epub
FONT = Path(__file__).parent / ".fonts" / "Manjari-Regular.ttf"


def _x(t):
    return html.escape(t or "", quote=True)


def briefing(out, result, pmap, LANGS, now):
    from news_config import BRIEFING
    day = time.strftime("%A %-d %B %Y", time.gmtime(now + 19800 // 2))   # roughly Europe/India morning
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
    chapters = []
    for pid, langs in BRIEFING:
        r = result.get(pid)
        if not r:
            continue
        parts = []
        for lang in langs:
            lst = r["news"].get(lang, [])[:8]
            if not lst:
                continue
            body = [f'<h2 lang="{lang}">{_x(LANGS[lang]["name"])}</h2>']
            d = r.get("digest", {}).get(lang)
            if d:
                body.append('<div class="digest"><p class="k">In brief (AI summary)</p><ul>' +
                            "".join(f'<li lang="{lang}">{_x(b)}</li>' for b in d["b"]) + "</ul></div>")
            for s in lst:
                when = time.strftime("%-d %b %H:%M", time.gmtime(s["ts"]))
                body.append(f'<div class="st" lang="{lang}"><h3>{_x(s["t"])}</h3>' +
                            (f'<p>{_x(s["s"])}</p>' if s.get("s") else "") +
                            f'<p class="m">{_x(s.get("src", ""))} · {when} UTC · <a href="{_x(s["u"])}">read</a></p></div>')
            parts.append("\n".join(body))
        if parts:
            chapters.append((pid, pmap[pid]["name"], "\n".join(parts)))
    if not chapters:
        return
    css = ("body{font-family:serif;line-height:1.45;margin:0 .4em}h1{font-size:1.5em;margin:.2em 0 .6em;border-bottom:2px solid #000}"
           "h2{font-size:.8em;letter-spacing:.12em;text-transform:uppercase;margin:1.4em 0 .4em}h3{font-size:1.05em;margin:.9em 0 .2em}"
           "p{margin:.2em 0}.m{font-size:.75em;color:#444}.digest{border:1px solid #000;padding:.3em .7em;margin:.5em 0 1em}"
           ".digest .k{font-size:.7em;letter-spacing:.1em;text-transform:uppercase}.st{page-break-inside:avoid}"
           + ("@font-face{font-family:'Manjari';src:url(Manjari.ttf)}[lang=ml]{font-family:'Manjari',serif}" if FONT.exists() else ""))
    xhtml = lambda title, inner: ('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" '  # noqa: E731
                                  f'xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en"><head><title>{_x(title)}</title>'
                                  f'<link rel="stylesheet" href="style.css"/></head><body>{inner}</body></html>')
    title = f"Morning briefing — {day}"
    nav = "".join(f'<li><a href="{pid}.xhtml">{_x(n)}</a></li>' for pid, n, _ in chapters)
    manifest = "".join(f'<item id="c-{pid}" href="{pid}.xhtml" media-type="application/xhtml+xml"/>' for pid, _, _ in chapters)
    spine = "".join(f'<itemref idref="c-{pid}"/>' for pid, _, _ in chapters)
    opf = ('<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">'
           f'<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:ranjithkb:briefing:{stamp[:10]}</dc:identifier>'
           f'<dc:title>{_x(title)}</dc:title><dc:language>en</dc:language><dc:creator>ranjithkb.com</dc:creator>'
           f'<meta property="dcterms:modified">{stamp}</meta></metadata><manifest>'
           '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
           '<item id="css" href="style.css" media-type="text/css"/>' +
           ('<item id="font" href="Manjari.ttf" media-type="font/ttf"/>' if FONT.exists() else "") +
           f'{manifest}</manifest><spine><itemref idref="nav"/>{spine}</spine></package>')
    path = out / "briefing.epub"
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
                   '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', zipfile.ZIP_DEFLATED)
        z.writestr("OEBPS/content.opf", opf, zipfile.ZIP_DEFLATED)
        z.writestr("OEBPS/style.css", css, zipfile.ZIP_DEFLATED)
        if FONT.exists():
            z.write(FONT, "OEBPS/Manjari.ttf", zipfile.ZIP_DEFLATED)
        z.writestr("OEBPS/nav.xhtml", xhtml(title, f'<h1>{_x(title)}</h1><nav epub:type="toc"><ol>{nav}</ol></nav>'
                                               '<p class="m">From trusted papers via ranjithkb.com/news.html</p>'), zipfile.ZIP_DEFLATED)
        for pid, name, inner in chapters:
            z.writestr(f"OEBPS/{pid}.xhtml", xhtml(name, f"<h1>{_x(name)}</h1>{inner}"), zipfile.ZIP_DEFLATED)
    opds = ('<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">'
            f'<id>urn:ranjithkb:news</id><title>ranjithkb.com — News</title><updated>{stamp}</updated>'
            f'<entry><title>{_x(title)}</title><id>urn:ranjithkb:briefing:{stamp}</id><updated>{stamp}</updated>'
            '<author><name>ranjithkb.com</name></author><content type="text">Your places and languages from trusted papers.</content>'
            '<link rel="http://opds-spec.org/acquisition" href="briefing.epub" type="application/epub+zip"/></entry></feed>')
    (out / "opds.xml").write_text(opds, encoding="utf-8")
