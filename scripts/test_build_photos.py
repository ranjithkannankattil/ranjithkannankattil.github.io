"""Tests for the photography data (photos.json) and page builder (build_photos.py)."""
import copy
import json
from pathlib import Path

import pytest

import photo_data as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(__file__).resolve().parent / "photos.json"


@pytest.fixture()
def data():
    return pd.load(DATA)


def test_valid_site_data(data):
    assert pd.validate(data, ROOT) == []
    counts = {p["id"]: sum(len(v["photos"]) for v in p["visits"]) for p in data["places"]}
    assert counts == {"swansea": 26, "milan": 10, "florence": 18, "gower": 7, "tenby": 19}


def test_people_rule_florence_portraits_removed(data):
    florence = next(p for p in data["places"] if p["id"] == "florence")
    stems = {ph["stem"] for v in florence["visits"] for ph in v["photos"]}
    assert "DSC05418" not in stems and "DSC05443" not in stems


def test_missing_image_reported(data):
    d = copy.deepcopy(data)
    d["places"][0]["visits"][0]["photos"][0]["stem"] = "nope-xyz"
    assert any("nope-xyz" in e for e in pd.validate(d, ROOT))


def test_duplicate_place_reported(data):
    d = copy.deepcopy(data)
    d["places"].append(copy.deepcopy(d["places"][0]))
    assert any("duplicate" in e for e in pd.validate(d, ROOT))


def test_bad_month_reported(data):
    d = copy.deepcopy(data)
    d["places"][0]["visits"][0]["month"] = "2026-5"
    assert any("2026-5" in e for e in pd.validate(d, ROOT))


def test_key_photo_must_belong_to_place(data):
    d = copy.deepcopy(data)
    d["places"][0]["key"] = "tenby-18"
    assert any("key" in e for e in pd.validate(d, ROOT))


def test_month_label():
    assert pd.month_label("2026-04") == "April 2026"
    assert pd.month_label("2026-05") == "May 2026"


# ---------------------------------------------------------------- page builder
import build_photos as bp
from PIL import Image


def two_visits(data):
    """Tenby with a second, later visit (made from its own photos) for ordering tests."""
    d = copy.deepcopy(data)
    t = next(p for p in d["places"] if p["id"] == "tenby")
    extra = copy.deepcopy(t["visits"][0])
    extra["month"] = "2027-03"
    extra["photos"] = extra["photos"][:3]
    t["visits"].append(extra)
    return d


@pytest.fixture()
def built(tmp_path, data):
    (tmp_path / "assets/photos/web").mkdir(parents=True)
    for p in data["places"]:
        for ph in pd.photos_of(p):
            for f in {pd.preview(ph), ph["full"]}:
                src = ROOT / "assets/photos/web" / f
                (tmp_path / "assets/photos/web" / f).write_bytes(src.read_bytes())
    (tmp_path / "sitemap.xml").write_text((ROOT / "sitemap.xml").read_text())
    bp.build(data, tmp_path)
    return tmp_path


def test_builds_every_page(built):
    assert (built / "photography/index.html").exists()
    for pid, month in [("swansea", "2026-05"), ("milan", "2026-04"), ("florence", "2026-04"),
                       ("gower", "2026-06"), ("tenby", "2026-08")]:
        assert (built / f"photography/{pid}/index.html").exists()
        assert (built / f"photography/{pid}/{month}/index.html").exists()


def test_visit_page_has_only_its_photos(built):
    html = (built / "photography/gower/2026-06/index.html").read_text()
    assert html.count('class="ph ') == 7
    assert "gower-01-800.webp" in html and "tenby-18" not in html.split("<main")[1]


def test_location_page_newest_visit_first(tmp_path, data):
    d = two_visits(data)
    (tmp_path / "sitemap.xml").write_text((ROOT / "sitemap.xml").read_text())
    bp.build(d, tmp_path, images=False)
    html = (tmp_path / "photography/tenby/index.html").read_text()
    assert html.index('id="v2027-03"') < html.index('id="v2026-08"')
    assert "March 2027 · 3 photos" in html and "August 2026 · 19 photos" in html
    assert "2 visits · 22 photos · March 2027" in (tmp_path / "photography/index.html").read_text()


def test_cards_sorted_by_latest_visit(built):
    html = (built / "photography/index.html").read_text()
    order = [html.index(f'href="/photography/{p}/"') for p in ("tenby", "gower", "swansea", "milan", "florence")]
    assert order == sorted(order)
    assert "1 visit · 26 photos · May 2026" in html


def test_og_image_1200x630(built):
    for f in ("assets/og/photo-swansea.jpg", "assets/og/photo-swansea-2026-05.jpg"):
        assert Image.open(built / f).size == (1200, 630)


def test_page_titles_and_og_url(built):
    html = (built / "photography/swansea/2026-05/index.html").read_text()
    assert "<title>Swansea · May 2026 — Photography</title>" in html
    assert '<meta property="og:url" content="https://ranjithkb.com/photography/swansea/2026-05/">' in html
    assert 'content="https://ranjithkb.com/assets/og/photo-swansea-2026-05.jpg"' in html
    assert '<link rel="canonical" href="https://ranjithkb.com/photography/swansea/2026-05/">' in html


def test_sitemap_lists_new_pages_not_old(built):
    sm = (built / "sitemap.xml").read_text()
    assert "https://ranjithkb.com/photography/swansea/2026-05/" in sm
    assert "https://ranjithkb.com/photography/</loc>" in sm
    assert "photography.html" not in sm
    assert sm.count("https://ranjithkb.com/radio.html") == 1


def test_old_links_follow_removed_photos(data):
    links = bp.old_links(data)
    assert links["tenby-4"] == "/photography/tenby/2026-08/#4"
    # old Florence 9 (Coronas Café) moved up to 7 after two photos before it were removed
    assert links["florence-9"] == "/photography/florence/2026-04/#7"
    assert links["9"] == links["florence-9"]
    # a removed photo goes to its visit page, not to a neighbour
    assert links["florence-7"] == "/photography/florence/2026-04/"
    assert links["gower-5"] == "/photography/gower/2026-06/#5"


def test_captions_are_escaped(tmp_path, data):
    d = copy.deepcopy(data)
    d["places"][3]["visits"][0]["photos"][0]["caption"] = 'Food & Drink "quoted" <b>'
    (tmp_path / "sitemap.xml").write_text((ROOT / "sitemap.xml").read_text())
    bp.build(d, tmp_path, images=False)
    html = (tmp_path / "photography/gower/2026-06/index.html").read_text()
    assert 'alt="Food &amp; Drink &quot;quoted&quot; &lt;b&gt;"' in html
    assert "<b>" not in html.split("<main")[1].split("</main>")[0]


def test_links_file_written(built):
    js = (built / "js/photo-links.js").read_text()
    assert '"tenby-4": "/photography/tenby/2026-08/#4"' in js
