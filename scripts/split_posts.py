#!/usr/bin/env python3
"""Split js/posts.js (the full archive, kept as the source) into small files the site loads:
  js/posts-index.js   titles, dates, tags, a one-line excerpt and reading time for every post
  posts/<id>.json     one post's text, loaded only on its own page
  posts/search.json   plain text of everything, loaded only when someone searches
  sitemap.xml         the site's public pages plus one entry per post, for search engines
Runs automatically (GitHub Actions) whenever js/posts.js changes."""
import hashlib, json, re
from urllib.parse import quote
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "js/posts.js").read_text(encoding="utf-8")
posts = json.loads(src[src.index("["): src.rindex("]") + 1])
posts.sort(key=lambda p: (p["date"], p["slug"]))       # oldest first

out = ROOT / "posts"
out.mkdir(exist_ok=True)
for f in out.glob("*.json"):
    f.unlink()

index, search = [], []
for p in posts:
    fid = hashlib.sha1(p["slug"].encode()).hexdigest()[:10]
    text = " ".join(p["body"])
    words = len(re.findall(r"\S+", text))
    flat = re.sub(r"\s+", " ", text).strip()
    title = re.sub(r"[.…]+$", "", p["title_ml"]).strip()
    if title and flat.startswith(title):          # Facebook titles are the opening words: preview what follows
        flat = flat[len(title):].lstrip(" .,:;-–—…")
    ex = flat if len(flat) <= 150 else flat[:150].rsplit(" ", 1)[0] + "…"
    lines = [l for l in p["body"] if l.strip()]
    verse = len(lines) >= 4 and sum(len(l) for l in lines) / len(lines) < 70
    index.append({"s": p["slug"], "f": fid, "t": p["title_ml"], "te": p.get("title_en", ""), "d": p["date"],
                  "src": p.get("source", ""), "tags": p.get("tags", []), "x": ex, "m": max(1, round(words / 160)), "v": 1 if verse else 0,
                  "u": p.get("source_url", "")})
    (out / f"{fid}.json").write_text(json.dumps({"slug": p["slug"], "body": p["body"]}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    search.append([fid, (p["title_ml"] + " " + p.get("title_en", "") + " " + " ".join(p.get("tags", [])) + " " + text).lower()])

(ROOT / "js/posts-index.js").write_text("/* AUTO-GENERATED from js/posts.js by scripts/split_posts.py — edit posts.js, not this. */\n"
                                         "window.POST_INDEX = " + json.dumps(index, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
(out / "search.json").write_text(json.dumps(search, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(len(index), "posts")

# sitemap: public pages, then every post (same address js/post.js links to)
SITE = "https://ranjithkb.com/"
PAGES = ["", "photography.html", "writings.html", "publications.html", "radio.html", "news.html", "trip.html",
         "productivity/", "productivity/meeting.html", "productivity/timeline.html", "privacy.html"]
urls = [f"  <url><loc>{SITE}{u}</loc></url>" for u in PAGES]
urls += [f"  <url><loc>{SITE}writing-post.html?slug={quote(p['s'], safe="-_.!~*'()")}</loc><lastmod>{p['d']}</lastmod></url>"
         for p in reversed(index)]
(ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                                  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n", encoding="utf-8")
