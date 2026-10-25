#!/usr/bin/env python3
"""Copy the posts of padolpathi.wordpress.com (മലയാളം പദോൽപത്തി) into scripts/padolpathi.json.

    python3 scripts/import_padolpathi.py

Uses WordPress.com's public API (no key). Each post keeps its title, date, categories and a cleaned
copy of its text: paragraphs, headings, bold/italic, lists, rules and links (http/https only, opened
in a new tab). Everything else (styles, scripts, embeds, WordPress markup) is dropped.
Run by the "Padolpathi" GitHub Action once a day, so new words on WordPress appear on the site."""
import html
import json
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

API = "https://public-api.wordpress.com/rest/v1.1/sites/padolpathi.wordpress.com/posts/"
OUT = Path(__file__).with_name("padolpathi.json")

KEEP = {"p": "p", "strong": "strong", "b": "strong", "em": "em", "i": "em", "br": "br", "hr": "hr",
        "h1": "h2", "h2": "h2", "h3": "h3", "h4": "h4", "h5": "h4", "h6": "h4",
        "ul": "ul", "ol": "ol", "li": "li", "a": "a", "code": "code", "blockquote": "blockquote",
        "sup": "sup", "sub": "sub"}
VOID = {"br", "hr"}
DROP_INSIDE = {"script", "style", "iframe", "svg", "noscript", "figure", "form", "button"}


class Clean(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.stack, self.skip = [], [], 0

    def handle_starttag(self, tag, attrs):
        if tag in DROP_INSIDE:
            self.skip += 1
            return
        if self.skip or tag not in KEEP:
            return
        t = KEEP[tag]
        if t == "a":
            href = dict(attrs).get("href", "") or ""
            if not re.match(r"https?://", href):
                self.stack.append(None)       # keep the text, drop a link that goes nowhere useful
                return
            self.out.append(f'<a href="{html.escape(href, quote=True)}" target="_blank" rel="noopener nofollow">')
        elif t in VOID:
            self.out.append(f"<{t}>")
            return
        else:
            self.out.append(f"<{t}>")
        self.stack.append(t)

    def handle_startendtag(self, tag, attrs):
        if not self.skip and KEEP.get(tag) in VOID:
            self.out.append(f"<{KEEP[tag]}>")

    def handle_endtag(self, tag):
        if tag in DROP_INSIDE:
            self.skip = max(0, self.skip - 1)
            return
        if self.skip or tag not in KEEP or KEEP[tag] in VOID:
            return
        t = KEEP[tag]
        # close up to the matching open tag (WordPress markup is well formed; this is a safety net)
        while self.stack:
            top = self.stack.pop()
            if top is None and t == "a":
                return
            if top:
                self.out.append(f"</{top}>")
            if top == t:
                return

    def handle_data(self, data):
        if not self.skip:
            self.out.append(html.escape(data, quote=False))

    def result(self):
        while self.stack:
            top = self.stack.pop()
            if top:
                self.out.append(f"</{top}>")
        s = "".join(self.out)
        s = re.sub(r" ", " ", s)
        s = re.sub(r"<(p|li|h[234]|strong|em)>\s*</\1>", "", s)          # empty blocks
        s = re.sub(r"(<br>\s*){3,}", "<br><br>", s)
        s = re.sub(r"<p>\s*(<br>\s*)+", "<p>", s)
        s = re.sub(r"(<br>\s*)+</p>", "</p>", s)
        s = re.sub(r"\n{2,}", "\n", s)
        return s.strip()


def clean(h):
    c = Clean()
    c.feed(h)
    c.close()
    return c.result()


def plain(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ranjithkb.com padolpathi import"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    fields = "ID,title,date,modified,URL,content,categories,status,type"
    posts, page = [], 1
    while True:
        d = fetch(f"{API}?number=100&page={page}&order_by=date&order=DESC&fields={fields}")
        batch = d.get("posts", [])
        posts += batch
        if not batch or len(posts) >= d.get("found", 0):
            break
        page += 1
    words = []
    for p in posts:
        if p.get("type", "post") != "post" or p.get("status", "publish") != "publish":
            continue
        body = clean(p["content"])
        if not plain(body):
            continue
        words.append({
            "id": p["ID"],
            "title": plain(p["title"]).replace("‌", ""),
            "date": p["date"][:10],
            "modified": p["modified"][:10],
            "categories": sorted(c for c in (p.get("categories") or {}) if c not in ("Uncategorized",)),
            "source": p["URL"],
            "html": body,
        })
    words.sort(key=lambda w: (w["date"], w["id"]), reverse=True)
    if not words:
        sys.exit("no posts came back from WordPress; keeping the old file")
    new = json.dumps(words, ensure_ascii=False, indent=1) + "\n"
    old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    if new != old:
        OUT.write_text(new, encoding="utf-8")
    print(f"{len(words)} words ({'changed' if new != old else 'unchanged'})")


if __name__ == "__main__":
    main()
