#!/usr/bin/env python3
"""Check candidate news sources from where the build runs (GitHub Actions).

For each candidate it fetches the paper's own pages (harvested like LOCAL_PAGES) and a
Google News search limited to its site, and prints the status, the number of stories
found and three sample headlines. Output: probe/out.txt. Re-run when adding sources.
"""
import os, sys, time
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
import build_news as b  # noqa: E402
import news_extras  # noqa: E402

# (label, lang, cc, domain, [section / district pages to harvest], search term)
CANDIDATES = [
    ("Carta de Moçambique", "pt", "MZ", "cartamz.com", ["https://www.cartamz.com/", "https://cartamz.com/index.php/politica"], "Moçambique"),
    ("O País", "pt", "MZ", "opais.co.mz", ["https://opais.co.mz/", "https://opais.co.mz/category/sociedade/"], "Moçambique"),
    ("Pinnacle News", "pt", "MZ", "pinnaclenews.net", ["https://pinnaclenews.net/", "https://www.pinnaclenews.net/"], "Cabo Delgado"),
    ("Prajavani Bengaluru", "kn", "IN", "prajavani.net", ["https://www.prajavani.net/district/bengaluru-city",
                                                        "https://www.prajavani.net/district/bengaluru"], "ಬೆಂಗಳೂರು"),
    ("Prajavani Mangaluru", "kn", "IN", "prajavani.net", ["https://www.prajavani.net/district/dakshina-kannada"], "ಮಂಗಳೂರು"),
    ("Udayavani Bengaluru", "kn", "IN", "udayavani.com", ["https://www.udayavani.com/district-news/bengaluru-news"], "ಬೆಂಗಳೂರು"),
    ("Udayavani Mangaluru", "kn", "IN", "udayavani.com", ["https://www.udayavani.com/district-news/mangaluru-news",
                                                        "https://www.udayavani.com/district-news/dakshina-kannada-news"], "ಮಂಗಳೂರು"),
]


def main():
    out = []
    for label, lang, cc, domain, pages, term in CANDIDATES:
        out.append(f"== {label} ({domain}, {lang})")
        for u in pages:
            html = b.get(u, limit=3_000_000)
            items = [i for i in news_extras.harvest_page(html, u) if domain in b.host(i["u"])] if html else []
            out.append(f"  page {u}: {'ok' if html else 'FAILED'}, {len(items)} stories")
            out += [f"    - {i['t'][:90]}" for i in items[:3]]
            time.sleep(0.5)
        ed = b.edition(lang, cc)
        rss = b.get(b.gn_url("/search", ed, f"{term} site:{domain} when:7d"))
        items = b.parse_rss(rss) if rss else []
        out.append(f"  google news site search: {'ok' if rss else 'FAILED'}, {len(items)} stories")
        out += [f"    - {i['t'][:90]}" for i in items[:3]]
    Path("probe").mkdir(exist_ok=True)
    Path("probe/out.txt").write_text("\n".join(out) + "\n")
    print("\n".join(out))


if __name__ == "__main__":
    main()
