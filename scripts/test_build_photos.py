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
