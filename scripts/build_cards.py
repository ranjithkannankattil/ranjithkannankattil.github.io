#!/usr/bin/env python3
"""Link-preview cards and share pages.

    FONTS_DIR=<folder with the site fonts> python3 scripts/build_cards.py [--out build] [--pages-only]

For every writing in js/posts.js:
  build/cards/<id>-<hash>.jpg   a 1200x630 card (title, English title or opening line, date)
  w/<id>.html                   a tiny share page whose link preview shows that card, then opens the post
For each section page (Writings, Radio, News, ...): build/sections/<name>-<hash>.jpg, and the page's
og:image is pointed at it.

Images are not kept in the repository: the "Cards" GitHub Action uploads build/ to R2
(https://media.ranjithkb.com/). The hash in each file name changes when the card's text or design
changes, so previews refresh and unchanged cards are never re-uploaded.
<id> is the same 10-character id scripts/split_posts.py uses (js/posts-index.js "f")."""
import hashlib, html, json, os, re, sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://ranjithkb.com"
MEDIA = "https://media.ranjithkb.com"
DESIGN_V = "1"            # bump to redraw every card
W, H = 1200, 630
PAPER, INK, MUTED, RULE = "#F0EDE6", "#1B1B1F", "#5A5A60", "#CFC9BD"
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
ML = re.compile(r"[ഀ-ൿ]")
E = lambda s: html.escape(str(s), quote=True)  # noqa: E731

# section pages: file, kicker, title, line under it, accent, accent text
SECTIONS = [
    ("writings", ["writings.html", "writing-post.html"], "Writings", "എഴുത്തുകൾ — Writings",
     "Malayalam prose and poetry by Ranjith Kannankattil.", "#B8860B", "#7F5D06"),
    ("radio", ["radio.html"], "Radio", "Live radio in many languages",
     "Malayalam, Hindi, Tamil, English news and talk, African languages, Italian, French and Korean.", "#2F6B4F", None),
    ("news", ["news.html"], "News", "News from trusted independent papers",
     "In the languages you choose, from the whole world down to your own town. Updated every two hours.", "#A33A2C", None),
    ("trip", ["trip.html"], "Trip planner", "Plan a day or a week anywhere",
     "Main sights in walking order, with opening hours, tickets, weather and maps.", "#1F6F78", None),
    ("productivity", ["productivity/index.html"], "Productivity", "Small tools for working across time zones",
     "Meeting finder, Gantt, RACI matrix, PDF toolkit, passport photos, oil & gas units and more.", "#5C4D7D", None),
    ("meeting", ["productivity/meeting.html"], "Productivity · Meeting finder", "Meeting time finder",
     "Find a time that works across cities, with daylight saving handled per date.", "#5C4D7D", None),
    ("timeline", ["productivity/timeline.html"], "Productivity · Timeline", "Timeline & Gantt",
     "Plan phases, tasks and milestones, then download as Excel, PDF or an image.", "#5C4D7D", None),
    ("raci", ["productivity/raci.html"], "Productivity · RACI", "RACI matrix builder",
     "Who is responsible, accountable, consulted and informed — with checks, and Excel or PDF out.", "#5C4D7D", None),
    ("pdf", ["productivity/pdf.html"], "Productivity · PDF toolkit", "PDF toolkit",
     "Merge, split, reorder, sign and shrink PDFs in your browser. Files never leave your device.", "#5C4D7D", None),
    ("passport", ["productivity/passport.html"], "Productivity · Passport photos", "Passport photo maker",
     "UK, Schengen, US, India, China and more, with print sheets for any paper.", "#5C4D7D", None),
    ("units", ["productivity/units.html"], "Productivity · Units", "Oil & gas unit converter",
     "MTPA to MMscfd, barrels to m³, psig to bara, °API to density, MMBtu to MWh.", "#5C4D7D", None),
    ("map", ["productivity/map.html"], "Productivity · Map colourer", "Map colourer",
     "Colour countries on a globe, or the states and provinces of any country, in your own colours.", "#5C4D7D", None),
    ("keyboard", ["productivity/keyboard.html"], "Productivity · Indic Keyboard", "Indic Keyboard for iPhone",
     "Swanalekha and other Malayalam layouts on iPhone and iPad. Open source, alpha.", "#5C4D7D", None),
    ("publications", ["publications.html"], "Publications", "Books and papers",
     "Malayalam essays and poetry, two free to download, and a paper from graduate research.", "#6B2740", None),
    ("padolpathi", [], "Padolpathi", "പദോൽപത്തി — where Malayalam words come from",
     "Notes on the roots of Malayalam words, written with the help of AI.", "#66702A", "#4E561F"),
    ("privacy", ["privacy.html"], "Privacy", "What this site stores, and why",
     "And how to have it removed.", "#2E4374", None),
]


# ------------------------------------------------------------------ drawing
def fonts_dir():
    d = Path(os.environ.get("FONTS_DIR", ROOT / "scripts/.fonts"))
    if not (d / "Manjari-Bold.ttf").exists():
        sys.exit(f"fonts not found in {d} (set FONTS_DIR)")
    return d


_cache = {}
def font(name, size, wght=None):
    from PIL import ImageFont
    k = (name, size, wght)
    if k not in _cache:
        f = ImageFont.truetype(str(fonts_dir() / name), size, layout_engine=ImageFont.Layout.RAQM)
        if wght:
            f.set_variation_by_axes([wght, 20] if "Serif" in name else [wght])
        _cache[k] = f
    return _cache[k]


def wrap(draw, text, f, width, max_lines):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=f) <= width or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while lines[-1] and draw.textlength(lines[-1] + "…", font=f) > width:
            lines[-1] = lines[-1].rsplit(" ", 1)[0] if " " in lines[-1] else lines[-1][:-1]
        lines[-1] = lines[-1].rstrip(" .,:;-–—…") + "…"
    return lines


def draw_card(out, kicker, title, sub, accent, accent_text=None, foot_right=""):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 18, H], fill=accent)
    x, maxw = 90, W - 180
    d.text((x, 70), kicker.upper(), font=font("IBMPlexMono-Medium.ttf", 24), fill=accent_text or accent)
    is_ml = bool(ML.search(title))
    for size in (84, 76, 68, 60, 54, 48):
        tf = font("Manjari-Bold.ttf", size) if is_ml else font("SpaceGrotesk[wght].ttf", size, 700)
        lines = wrap(d, title, tf, maxw, 3)
        lh = int(size * (1.28 if is_ml else 1.12))
        if (len(lines) * lh <= 300 and not lines[-1].endswith("…")) or size == 48:
            break
    y = 130
    for ln in lines:
        d.text((x, y), ln, font=tf, fill=INK)
        y += lh
    if sub:
        y += 18
        sf = font("Manjari-Regular.ttf", 32) if ML.search(sub) else font("SourceSerif4-Italic[opsz,wght].ttf", 34, 400)
        slh = int(sf.size * 1.4)
        room = max(0, (H - 92 - 28 - y) // slh)
        for ln in (wrap(d, sub, sf, maxw, min(2, room)) if room else []):
            d.text((x, y), ln, font=sf, fill=MUTED)
            y += slh
    fy = H - 92
    d.line([x, fy, W - 90, fy], fill=RULE, width=2)
    cx = x + 12
    d.polygon([(cx, fy - 12), (cx + 12, fy), (cx, fy + 12), (cx - 12, fy)], fill=accent)
    mf = font("IBMPlexMono-Medium.ttf", 24)
    d.text((x, fy + 26), "ranjithkb.com", font=mf, fill=INK)
    if foot_right:
        d.text((W - 90 - d.textlength(foot_right, font=mf), fy + 26), foot_right, font=mf, fill=MUTED)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "JPEG", quality=86, optimize=True, progressive=True)


def h8(*parts):
    return hashlib.sha1(json.dumps([DESIGN_V, *parts], ensure_ascii=False).encode()).hexdigest()[:8]


def section_card_name(key):
    for k, _pages, kicker, title, sub, accent, _at in SECTIONS:
        if k == key:
            return f"{k}-{h8(kicker, title, sub, accent)}.jpg"
    raise KeyError(key)


# ------------------------------------------------------------------ padolpathi words
PD_ACCENT, PD_TEXT = "#66702A", "#4E561F"


def padolpathi_words():
    f = ROOT / "scripts/padolpathi.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def padolpathi_sub(w):
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", w["html"]))).strip()
    return re.sub(r"\s*\[\d+\](\[\d+\])*", "", t)[:220]


def padolpathi_card_name(w):
    return f"padolpathi-{w['id']}-{h8(w['title'], padolpathi_sub(w), PD_ACCENT)}.jpg"


# ------------------------------------------------------------------ posts
def load_posts():
    src = (ROOT / "js/posts.js").read_text(encoding="utf-8")
    return json.loads(src[src.index("["): src.rindex("]") + 1])


def fid(slug):
    return hashlib.sha1(slug.encode()).hexdigest()[:10]   # same as split_posts.py


def line_under(p):
    if p.get("title_en"):
        return p["title_en"]
    tidy = lambda s: re.sub(r"\s+", " ", re.sub(r"([*=~_#-])\1{2,}", " ", s)).strip(" *")  # noqa: E731
    flat = tidy(" ".join(p["body"]))
    title = re.sub(r"[.…]+$", "", tidy(p["title_ml"])).strip()
    if title and flat.startswith(title):
        flat = flat[len(title):].lstrip(" .,:;-–—…*")
    return flat[:220]


def pretty_date(d):
    y, m, dd = d.split("-")
    return f"{int(dd)} {MONTHS[int(m) - 1]} {y}"


SAFE = "-_.!~*'()"         # what encodeURIComponent leaves alone, as in js/post.js


def post_url(slug):
    return f"{SITE}/writing-post.html?slug={quote(slug, safe=SAFE)}"


def share_page(p, img, desc):
    url, t = post_url(p["slug"]), p["title_ml"]
    lang = "ml" if ML.search(t) else "en"
    share = f"{SITE}/w/{fid(p['slug'])}.html"
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(t)} — Ranjith Kannankattil</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="{E(url)}">
<meta name="description" content="{E(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Ranjith Kannankattil">
<meta property="og:title" content="{E(t)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{E(share)}">
<meta property="og:image" content="{E(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={E(url)}">
<script>location.replace({json.dumps(url)})</script>
</head>
<body><p><a href="{E(url)}">{E(t)}</a></p></body>
</html>
"""


def set_og_image(page, img):
    p = ROOT / page
    s = p.read_text(encoding="utf-8")
    new = re.sub(r'(<meta property="og:image" content=")[^"]*(">)', lambda m: m.group(1) + img + m.group(2), s, count=1)
    if 'property="og:image"' not in s:
        print(f"  warning: {page} has no og:image tag; left alone")
        return False
    if new != s:
        p.write_text(new, encoding="utf-8")
        return True
    return False


def main():
    args = sys.argv[1:]
    out = Path(args[args.index("--out") + 1]) if "--out" in args else ROOT / "build"
    pages_only = "--pages-only" in args
    if not pages_only:
        from PIL import features
        if not features.check("raqm"):
            sys.exit("Pillow has no raqm text shaping: Malayalam would render broken. Install libraqm.")
    wdir = ROOT / "w"
    wdir.mkdir(exist_ok=True)
    keep, drawn = set(), 0
    for p in load_posts():
        i = fid(p["slug"])
        sub = line_under(p)
        date = pretty_date(p["date"])
        name = f"{i}-{h8(p['title_ml'], sub, date)}.jpg"
        img = out / "cards" / name
        if not pages_only and not img.exists():
            draw_card(img, "Ranjith Kannankattil · Writings", p["title_ml"], sub, "#B8860B", "#7F5D06", date)
            drawn += 1
        desc = sub if len(sub) <= 160 else sub[:160].rsplit(" ", 1)[0] + "…"
        page = wdir / f"{i}.html"
        txt = share_page(p, f"{MEDIA}/cards/{name}", desc)
        if not page.exists() or page.read_text(encoding="utf-8") != txt:
            page.write_text(txt, encoding="utf-8")
        keep.add(page.name)
    for f in wdir.glob("*.html"):           # posts that were removed
        if f.name not in keep:
            f.unlink()
    for w in padolpathi_words():
        img = out / "cards" / padolpathi_card_name(w)
        if not pages_only and not img.exists():
            draw_card(img, "Ranjith Kannankattil · പദോൽപത്തി", w["title"], padolpathi_sub(w), PD_ACCENT, PD_TEXT,
                      "Written with AI")
            drawn += 1
    changed = 0
    for key, pages, kicker, title, sub, accent, accent_text in SECTIONS:
        name = section_card_name(key)
        if not pages_only and not (out / "sections" / name).exists():
            draw_card(out / "sections" / name, "Ranjith Kannankattil · " + kicker, title, sub, accent, accent_text)
            drawn += 1
        for page in pages:
            changed += set_og_image(page, f"{MEDIA}/sections/{name}")
    print(f"{len(keep)} share pages, {drawn} cards drawn, {changed} section pages updated")


if __name__ == "__main__":
    main()
