"""Tests for the News relevance rules (run: cd scripts && python3 -m pytest -q)."""
from news_config import CLUBS, CIVIC, PLACE_WORDS, ALIASES


def test_config_shapes():
    assert "AC Milan" in CLUBS["milan"] and "Swansea City" in CLUBS["swansea"]
    assert "Inter" not in CLUBS["milan"]
    assert CIVIC.search("Police close roads") and CIVIC.search("scontri in centro")
    assert len([w for w in PLACE_WORDS["kerala"] if w.isascii()]) >= 14
    assert "Swans" not in ALIASES["swansea"]
    assert "Methala" in ALIASES["kodungallur"]
