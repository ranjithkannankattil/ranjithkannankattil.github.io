#!/usr/bin/env python3
"""Build the Padolpathi (പദോൽപത്തി) pages from scripts/padolpathi.json.

    python3 scripts/build_padolpathi.py        (run from anywhere)

Writes padolpathi/index.html (every word, A–Z by the Malayalam alphabet, with search and topic
filters), padolpathi/<id>.html (one word each) and the padolpathi entries in sitemap.xml.
The words were copied once from padolpathi.wordpress.com (scripts/import_padolpathi.py); they were
written with the help of AI, which every page says."""
import html
import json
import re
import shutil
from datetime import date
from pathlib import Path

import build_cards as bc

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://ranjithkb.com"
BLOG = "https://padolpathi.wordpress.com/"
CSS_V, STYLE_V, NAV_V = "1", "12", "9"
E = lambda s: html.escape(str(s), quote=True)  # noqa: E731
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
          "October", "November", "December"]
ML = re.compile(r"[ഀ-ൿ]")
AI_ML = "ഈ ലേഖനങ്ങൾ AI-യുടെ സഹായത്തോടെ തയ്യാറാക്കിയവയാണ്."
AI_EN = "Written with the help of AI."
TOPIC_EN = {"Food": "Food", "Modern words": "Modern words", "Others": "Other languages", "Places": "Places",
            "Animals": "Animals", "Vulgar Words": "Rude words"}
FONTS = ("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Source+Serif+4:"
         "ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&family=Manjari:wght@400;700&display=swap")


def pretty(d):
    y, m, dd = d.split("-")
    return f"{int(dd)} {MONTHS[int(m) - 1]} {y}"


def plain(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()


def excerpt(w, n=150):
    t = re.sub(r"\s*\[\d+\](\[\d+\])*", "", plain(w["html"]))
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"


def sort_key(w):
    t = w["title"].strip().lstrip("“\"'‘(")
    return (0 if ML.match(t) else 1, t.lower())


def letter(w):
    t = w["title"].strip().lstrip("“\"'‘(")
    return t[0] if ML.match(t) else "A–Z"


def refs(h):
    """[1][2] reference markers as small superscripts (text only, never inside a tag)."""
    parts = re.split(r"(<[^>]+>)", h)
    return "".join(x if x.startswith("<") else re.sub(r"\[(\d{1,3})\]", r'<sup class="ref">[\1]</sup>', x) for x in parts)


def topics(w):
    return [TOPIC_EN[c] for c in w["categories"] if c in TOPIC_EN]


def page_url(w):
    return f"/padolpathi/{w['id']}.html"


def head(title, desc, url, img, lang="ml"):
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{SITE}{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Ranjith Kannankattil">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{SITE}{url}">
<meta property="og:image" content="{E(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="manifest" href="/site.webmanifest">
<link rel="icon" href="/assets/icons/site-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/icons/site-180.png">
<meta name="theme-color" content="#F0EDE6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16161A" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="{FONTS}" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="{FONTS}"></noscript>
<link rel="stylesheet" href="/css/style.css?v={STYLE_V}">
<link rel="stylesheet" href="/css/padolpathi.css?v={CSS_V}">
</head>
<body data-section="padolpathi">

<header class="titleblock">
  <div>
    <div class="id">RANJITH KANNANKATTIL</div>
    <div class="name">Padolpathi</div>
  </div>
  <nav class="tabs" data-root="/" data-active="padolpathi" aria-label="Site">
    <a href="/index.html">Home</a>
    <a href="/writings.html">Writings</a>
    <a href="/padolpathi/" class="active">Padolpathi</a>
  </nav>
</header>
"""


FOOT = f"""
<footer>
  <div class="cheart">♡ <span id="year"></span> Ranjith Kannankattil · What I created here is free to copy — <a href="https://copyheart.org/" rel="noopener">copying is an act of love</a>. Others' work keeps its own terms.</div>
  <div class="foot-r"><span class="visits" id="visits" hidden></span><a href="mailto:hello@ranjithkb.com">hello@ranjithkb.com</a><a href="/privacy.html">Privacy</a></div>
</footer>

<script>document.getElementById('year').textContent = new Date().getFullYear();</script>
<script src="/js/nav.js?v={NAV_V}" defer></script>
<script src="/js/visits.js?v=2" defer></script>
"""

AI_NOTE = f"""<p class="pd-ai"><span lang="ml">{AI_ML}</span> <span lang="en">{AI_EN}</span>
  First published on <a href="{BLOG}" target="_blank" rel="noopener">padolpathi.wordpress.com</a>.</p>"""


def index_page(words):
    groups = {}
    for w in words:
        groups.setdefault(letter(w), []).append(w)
    order = list(groups)
    all_topics = sorted({t for w in words for t in topics(w)})
    desc = (f"{len(words)} Malayalam words and where they come from — Sanskrit, Persian, Tamil, Portuguese "
            "and older roots. Written with the help of AI.")
    out = [head("പദോൽപത്തി — Padolpathi — Ranjith Kannankattil", desc, "/padolpathi/",
                f"{bc.MEDIA}/sections/{bc.section_card_name('padolpathi')}")]
    out.append(f"""
<main class="pd">
  <div class="pd-intro">
    <h1 class="pd-h1"><span lang="ml">പദോൽപത്തി</span> <span class="en">Padolpathi</span></h1>
    <p class="pd-lead" lang="ml">മലയാളം വാക്കുകൾ എവിടെ നിന്നു വന്നു — ഭാഷാചരിത്രത്തിന്റെ ഏടുകളിലൂടെ ഒരു യാത്ര.</p>
    <p class="pd-sub">Where Malayalam words come from. {len(words)} words so far, A–Z by the Malayalam alphabet.</p>
    {AI_NOTE}
  </div>

  <div class="pd-find">
    <input id="pd-q" type="search" placeholder="Search words…" aria-label="Search words" autocomplete="off">
    <div class="pd-topics" role="group" aria-label="Topics">
      <button type="button" class="on" data-t="">All</button>""")
    for t in all_topics:
        out.append(f'      <button type="button" data-t="{E(t)}">{E(t)}</button>')
    out.append("""    </div>
  </div>

  <nav class="pd-letters" aria-label="Jump to a letter">""")
    for i, g in enumerate(order):
        out.append(f'    <a href="#l{i}" lang="ml">{E(g)}</a>')
    out.append("  </nav>\n\n  <div id=\"pd-list\">")
    for i, g in enumerate(order):
        out.append(f'  <section class="pd-group" id="l{i}">\n    <h2 class="pd-letter" lang="ml">{E(g)}</h2>\n    <ul>')
        for w in groups[g]:
            ts = topics(w)
            search = (w["title"] + " " + excerpt(w, 400) + " " + " ".join(ts)).lower()
            out.append(f'      <li data-s="{E(search)}" data-t="{E("|".join(ts))}"><a href="{page_url(w)}">'
                       f'<span class="w" lang="{"ml" if ML.search(w["title"]) else "en"}">{E(w["title"])}</span>'
                       f'<span class="x" lang="ml">{E(excerpt(w))}</span></a></li>')
        out.append("    </ul>\n  </section>")
    out.append("""  </div>
  <p class="pd-none" id="pd-none" hidden>No word matches that search.</p>
</main>

<script>
(function () {
  const q = document.getElementById("pd-q"), list = document.getElementById("pd-list"), none = document.getElementById("pd-none");
  const chips = [...document.querySelectorAll(".pd-topics button")];
  let topic = "";
  function apply() {
    const s = q.value.trim().toLowerCase();
    let shown = 0;
    list.querySelectorAll(".pd-group").forEach((g) => {
      let n = 0;
      g.querySelectorAll("li").forEach((li) => {
        const ok = (!s || li.dataset.s.includes(s)) && (!topic || li.dataset.t.split("|").includes(topic));
        li.hidden = !ok; if (ok) n++;
      });
      g.hidden = !n; shown += n;
    });
    none.hidden = shown > 0;
  }
  q.addEventListener("input", apply);
  chips.forEach((c) => c.addEventListener("click", () => {
    chips.forEach((o) => o.classList.toggle("on", o === c));
    topic = c.dataset.t; apply();
  }));
})();
</script>""")
    out.append(FOOT + "</body>\n</html>\n")
    return "\n".join(out)


def word_page(w, prev, nxt):
    words = len(plain(w["html"]).split())
    mins = max(1, round(words / 160))
    ts = topics(w)
    desc = excerpt(w, 160)
    lang = "ml" if ML.search(w["title"]) else "en"
    meta = [f"<span>{pretty(w['date'])}</span>", f"<span>{mins} min read</span>"] + [f"<span>{E(t)}</span>" for t in ts]
    nav = []
    for q, dirn, cls in ((prev, "← Earlier in A–Z", "prev"), (nxt, "Later in A–Z →", "next")):
        if q:
            nav.append(f'<a class="{cls}" href="{page_url(q)}"><span class="dir">{dirn}</span><span class="t">{E(q["title"])}</span></a>')
        else:
            nav.append(f'<a class="{cls}" style="visibility:hidden" aria-hidden="true" tabindex="-1"></a>')
    return (head(f"{w['title']} — പദോൽപത്തി — Ranjith Kannankattil", desc, page_url(w),
                 f"{bc.MEDIA}/cards/{bc.padolpathi_card_name(w)}") + f"""
<main class="pd pd-word post">
  <p class="pd-crumb"><a href="/padolpathi/">പദോൽപത്തി</a> / <a href="/padolpathi/#l{w['_g']}" lang="ml">{E(letter(w))}</a></p>
  <header class="post-head">
    <div class="post-meta">{''.join(meta)}</div>
    <h1 class="post-title" lang="{lang}">{E(w['title'])}</h1>
    {AI_NOTE}
    <div class="post-tools">
      <button type="button" id="pd-share" data-url="{SITE}{page_url(w)}" data-title="{E(w['title'])}">Share</button>
      <a href="{E(w['source'])}" target="_blank" rel="noopener">Original on WordPress ↗</a>
    </div>
  </header>
  <article class="post-body pd-body" lang="ml">
{refs(w['html'])}
  </article>
  <nav class="post-nav">{''.join(nav)}</nav>
  <p class="post-back"><a href="/padolpathi/">← All words</a></p>
</main>

<script>
document.getElementById("pd-share").onclick = async function () {{
  const data = {{ title: this.dataset.title, url: this.dataset.url }};
  try {{
    if (navigator.share) await navigator.share(data);
    else {{ await navigator.clipboard.writeText(data.url); this.textContent = "Link copied"; setTimeout(() => (this.textContent = "Share"), 1800); }}
  }} catch (e) {{ /* cancelled */ }}
}};
</script>""" + FOOT + "</body>\n</html>\n")


def update_sitemap(words):
    p = ROOT / "sitemap.xml"
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"\s*<url><loc>https://ranjithkb\.com/padolpathi/[^<]*</loc>(<lastmod>[^<]*</lastmod>)?</url>", "", s)
    urls = [f"\n  <url><loc>{SITE}/padolpathi/</loc></url>"]
    urls += [f"\n  <url><loc>{SITE}{page_url(w)}</loc><lastmod>{w['modified']}</lastmod></url>" for w in words]
    s = s.replace("\n</urlset>", "".join(urls) + "\n</urlset>")
    p.write_text(s, encoding="utf-8")


def main():
    words = json.loads((ROOT / "scripts/padolpathi.json").read_text(encoding="utf-8"))
    words.sort(key=sort_key)
    letters = []
    for w in words:
        g = letter(w)
        if g not in letters:
            letters.append(g)
        w["_g"] = letters.index(g)
    out = ROOT / "padolpathi"
    if out.exists():
        shutil.rmtree(out)                 # a word removed on WordPress must not stay online
    out.mkdir()
    (out / "index.html").write_text(index_page(words), encoding="utf-8")
    for i, w in enumerate(words):
        prev = words[i - 1] if i else None
        nxt = words[i + 1] if i + 1 < len(words) else None
        (out / f"{w['id']}.html").write_text(word_page(w, prev, nxt), encoding="utf-8")
    update_sitemap(words)
    print(f"{len(words)} word pages, {len(letters)} letters, built {date.today()}")


if __name__ == "__main__":
    main()
