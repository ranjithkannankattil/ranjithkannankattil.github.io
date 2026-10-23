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
