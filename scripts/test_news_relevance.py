"""Tests for the News relevance rules (run: cd scripts && python3 -m pytest -q)."""
from news_config import CLUBS, CIVIC, PLACE_WORDS, ALIASES


def test_config_shapes():
    assert "AC Milan" in CLUBS["milan"] and "Swansea City" in CLUBS["swansea"]
    assert "Inter" not in CLUBS["milan"]
    assert CIVIC.search("Police close roads") and CIVIC.search("scontri in centro")
    assert len([w for w in PLACE_WORDS["kerala"] if w.isascii()]) >= 14
    assert "Swans" not in ALIASES["swansea"]
    assert "Methala" in ALIASES["kodungallur"]


from news_relevance import club_story, other_place, other_names


def test_club_story_dropped():
    assert club_story("AC Milan beat Bournemouth 2-0", "", "milan")


def test_club_with_civic_cue_kept():
    assert not club_story("Riots near San Siro after AC Milan match", "Police made arrests", "milan")


def test_city_story_not_club():
    assert not club_story("Milan deploys 500 troops", "", "milan")


def test_bare_inter_is_not_a_club():
    assert not club_story("Inter-city trains cancelled", "", "milan")


def test_other_place_dropped():
    assert other_place("കൊച്ചിയിലെ ‘മിനി റെഡ് സ്ട്രീറ്റ്’", ["തൃശൂ"], ["കൊച്ചി", "kochi"])


def test_no_place_named_kept():
    assert not other_place("Water supply restored", ["thrissur"], ["kochi", "kollam"])


def test_both_places_named_kept():
    assert not other_place("Thrissur–Kochi bus strike", ["thrissur"], ["kochi"])


def test_other_names_excludes_family():
    pmap = {
        "world": {"id": "world", "name": "World", "parent": None},
        "kerala": {"id": "kerala", "name": "Kerala", "parent": "world"},
        "thrissur": {"id": "thrissur", "name": "Thrissur", "parent": "kerala"},
        "kodungallur": {"id": "kodungallur", "name": "Kodungallur", "parent": "thrissur"},
        "kochi": {"id": "kochi", "name": "Kochi", "parent": "kerala"},
    }
    names_fn = lambda p: [p["name"].lower()]  # noqa: E731
    o = other_names("thrissur", pmap, names_fn)
    assert "kochi" in o and "kollam" in o          # a sibling, and a Kerala district word
    assert "kerala" not in o and "world" not in o  # ancestors
    assert "kodungallur" not in o                  # descendant
    assert "thrissur" not in o                     # itself, also removed from the district words


from news_relevance import filter_local


def test_filter_local_counts():
    stories = [
        {"t": "AC Milan beat Bournemouth 2-0", "s": ""},
        {"t": "കൊച്ചിയിലെ ‘മിനി റെഡ് സ്ട്രീറ്റ്’", "_own": True},
        {"t": "Water supply restored", "_own": True},
    ]
    counts = {}
    kept = filter_local(stories, "milan", ["thrissur", "തൃശൂ"], ["കൊച്ചി", "kochi"], counts)
    assert [s["t"] for s in kept] == ["Water supply restored"]
    assert counts == {"club": 1, "other_place": 1}


def test_filter_local_other_place_only_for_district_pages():
    counts = {}
    kept = filter_local([{"t": "Kochi metro extended to Thrissur? No: Kochi only"}], "thrissur", ["x-not-present"], ["kochi"], counts)
    assert len(kept) == 1 and counts == {}


def test_other_place_ascii_whole_words():
    assert not other_place("Bus stand reopens", ["thrissur"], ["us"])
    assert not other_place("Aroma of Onam", ["thrissur"], ["roma"])
    assert other_place("Kochi metro update", ["thrissur"], ["kochi"])


def test_other_names_same_country_and_district_towns():
    pmap = {
        "world": {"id": "world", "name": "World", "parent": None},
        "india": {"id": "india", "name": "India", "parent": "world", "cc": "IN"},
        "kerala": {"id": "kerala", "name": "Kerala", "parent": "india", "cc": "IN"},
        "thrissur": {"id": "thrissur", "name": "Thrissur", "parent": "kerala", "cc": "IN"},
        "kodungallur": {"id": "kodungallur", "name": "Kodungallur", "parent": "kerala", "cc": "IN"},
        "kochi": {"id": "kochi", "name": "Kochi", "parent": "kerala", "cc": "IN"},
        "uk": {"id": "uk", "name": "UK", "parent": "world", "cc": "GB"},
    }
    names_fn = lambda p: [p["name"].lower()]  # noqa: E731
    o = other_names("thrissur", pmap, names_fn, local_from={"kodungallur": "thrissur"})
    assert "kochi" in o
    assert "uk" not in o              # another country
    assert "kodungallur" not in o     # takes its stories from Thrissur's pages
