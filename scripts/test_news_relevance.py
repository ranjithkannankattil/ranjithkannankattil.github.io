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


import news_extras


def _ai(reply):
    ai = news_extras.AI.__new__(news_extras.AI)
    ai.key, ai.on, ai.cache, ai.calls, ai.errors, ai.model = "x", True, {}, 0, 0, "m"
    ai.asked = []

    def fake(prompt):
        ai.asked.append(prompt); ai.calls += 1
        return reply
    ai._ask = fake
    return ai


def test_relevance_drops_false():
    ai = _ai([{"i": 0, "about": False}, {"i": 1, "about": True}])
    a, b = {"t": "Kochi news", "_k": "k1"}, {"t": "Thrissur news", "_k": "k2"}
    ai.cache.update({"k1": {}, "k2": {}})
    out = ai.relevance([("Thrissur", a), ("Thrissur", b)])
    assert out == {id(a)}
    assert ai.cache["k1"]["rel:Thrissur"] is False and ai.cache["k2"]["rel:Thrissur"] is True


def test_relevance_uses_cache():
    ai = _ai(None)
    a = {"t": "Kochi news", "_k": "k1"}
    ai.cache["k1"] = {"rel:Thrissur": False}
    assert ai.relevance([("Thrissur", a)]) == {id(a)}
    assert ai.asked == []


def test_relevance_garbled_reply_keeps():
    ai = _ai([{"i": 7, "about": "no"}])
    a = {"t": "x", "_k": "k1"}
    ai.cache["k1"] = {}
    assert ai.relevance([("Thrissur", a)]) == set()


def test_relevance_no_answer_keeps():
    ai = _ai(None)
    a = {"t": "x", "_k": "k1"}
    ai.cache["k1"] = {}
    assert ai.relevance([("Thrissur", a)]) == set()


def test_relevance_leaves_calls_for_digests():
    ai = _ai([])
    ai.calls = news_extras.AI.MAX_CALLS - 3
    ai.relevance([("Thrissur", {"t": "x"})], reserve=3)
    assert ai.asked == []


import json as _json
from news_relevance import thin_from_prev


def test_thin_from_prev(tmp_path):
    (tmp_path / "p").mkdir()
    w = lambda pid, news: (tmp_path / "p" / f"{pid}.json").write_text(_json.dumps({"news": news}))  # noqa: E731
    w("a", {"en": [1, 2], "ml": [1]})
    w("b", {"en": [1] * 6})
    w("d", {"en": []})
    kinds = {"a": "city", "b": "city", "c": "city", "d": "country"}
    assert thin_from_prev(tmp_path, ["a", "b", "c", "d"], kinds) == {"a"}


def test_thin_if_any_language_is_thin(tmp_path):
    (tmp_path / "p").mkdir()
    (tmp_path / "p" / "k.json").write_text(_json.dumps({"news": {"en": [1], "ml": [1] * 9}}))
    assert thin_from_prev(tmp_path, ["k"], {"k": "city"}) == {"k"}


from news_relevance import build_around


def _s(u):
    return {"t": u, "u": u}


def test_around_fills_thin_lang():
    s1, s2, s3, s4 = _s("1"), _s("2"), _s("3"), _s("4")
    a = build_around({"ml": [s1]}, [("thrissur", {"ml": [s1, s2, s3], "en": [s4]})], ["ml", "en"])
    assert a == {"from": {"ml": "thrissur", "en": "thrissur"}, "news": {"ml": [s2, s3], "en": [s4]}}


def test_around_not_needed():
    five = [_s(str(i)) for i in range(5)]
    assert build_around({"ml": five, "en": five}, [("thrissur", {"ml": [_s("x")]})], ["ml", "en"]) is None


def test_around_empty_parent_is_none():
    assert build_around({"ml": []}, [("thrissur", {})], ["ml"]) is None


def test_around_caps_at_8():
    a = build_around({"en": []}, [("kerala", {"en": [_s(str(i)) for i in range(20)]})], ["en"])
    assert len(a["news"]["en"]) == 8


def test_verified_sources_added():
    from news_config import OUTLETS, LOCAL_PAGES
    assert "cartamz.com" in OUTLETS["pt"] and "opais.co.mz" in OUTLETS["pt"]
    assert "pinnaclenews.net" not in OUTLETS["pt"]           # probe: site did not respond
    assert any("prajavani.net/district/bengaluru-city" in u for u in LOCAL_PAGES["bengaluru"]["kn"])
    assert any("prajavani.net/district/dakshina-kannada" in u for u in LOCAL_PAGES["mangaluru"]["kn"])


# found in the trial build: match reports that name only the city, not the club
def test_match_report_without_club_name():
    assert club_story("QPR - Swansea | Football", "", "swansea")
    assert club_story("Swansea 0-1 West Ham - the fans' verdict", "", "swansea")
    assert club_story("Coach who worked under Jürgen Klopp has Swansea dreaming of promotion", "", "swansea")
    # borderline club-history features naming the city stay (accepted: "clubs" alone is too common a word)
    assert not club_story("Bournemouth and Milan: Two clubs connected by stripes meet at last", "", "milan")
    assert club_story("Dream night for Bournemouth - how did the Premier League come to dominate Europe?", "", "milan")


def test_sport_cue_only_for_club_cities():
    assert not club_story("Thrissur 2-1 win in state football", "", "thrissur")   # no clubs listed for Thrissur


def test_civic_beats_sport_cue():
    assert not club_story("Police close roads around stadium before Swansea match", "", "swansea")


def test_around_walks_up_the_tree():
    s = {"t": "China news", "u": "c1"}
    a = build_around({"en": []}, [("shandong", {"en": []}), ("china", {"en": [s]})], ["en"])
    assert a == {"from": {"en": "china"}, "news": {"en": [s]}}


def test_sport_cue_false_positives_kept():
    assert not club_story("Milan fashion week runs 22-28 September", "", "milan")
    assert not club_story("Swansea coach crash closes the M4", "", "swansea")
    assert not club_story("Store promotion draws crowds in Swansea", "", "swansea")
    assert not club_story("Milan hotel manager speaks out", "", "milan")
    assert not club_story("Swansea family wins 2-3 bedroom house in prize draw", "", "swansea")


def test_more_match_reports():
    assert club_story("Nuno Espirito Santo: Listen to West Ham boss' reaction to win against Swansea", "", "swansea")


from news_relevance import ancestor_chain


def test_ancestor_chain():
    pmap = {"world": {"kind": "world", "parent": None}, "india": {"kind": "country", "parent": "world"},
            "kerala": {"kind": "region", "parent": "india"}, "thrissur": {"kind": "city", "parent": "kerala"},
            "kodungallur": {"kind": "city", "parent": "kerala"}}
    assert ancestor_chain("kodungallur", pmap, {"kodungallur": "thrissur"}) == ["thrissur", "kerala", "india"]
    assert ancestor_chain("thrissur", pmap, {}) == ["kerala", "india"]
    # a district that is also the parent: no loop, no repeat
    assert ancestor_chain("kodungallur", pmap, {"kodungallur": "kerala"}) == ["kerala", "india"]


# found in trial 3
def test_versus_and_victory_reports():
    assert club_story("Swansea v West Ham United", "", "swansea")
    assert club_story("West Ham: Fan speaks about Championship victory against Swansea", "", "swansea")


def test_around_skips_wrong_script():
    hindi = {"t": "भारत चीन बॉर्डर पर", "u": "h"}
    kannada = {"t": "ಬೆಂಗಳೂರು ಸುದ್ದಿ", "u": "k"}
    ok = lambda s, lang: lang != "kn" or any("ಀ" <= ch <= "೿" for ch in s["t"])  # noqa: E731
    a = build_around({"kn": []}, [("karnataka", {"kn": []}), ("india", {"kn": [hindi, kannada]})], ["kn"], keep=ok)
    assert a["news"]["kn"] == [kannada]


from news_relevance import in_script


def test_in_script():
    assert in_script("ಬೆಂಗಳೂರು ಸುದ್ದಿ", "kn") and not in_script("भारत चीन बॉर्डर पर", "kn")
    assert in_script("തൃശൂർ വാർത്ത", "ml") and not in_script("ಬೆಂಗಳೂರು", "ml")
    assert in_script("Milan news", "en") and in_script("Notizie di Milano", "it")
    assert in_script("青岛新闻", "zh") and in_script("서울 뉴스", "ko")


# ---- final review fix pass ----
def test_place_like_club_names_need_a_sport_cue():                     # review 1
    for t, pid in [("Chelsea Flower Show opens with record crowds", "london"),
                   ("Fulham Road shop owners fear rent rise", "london"),
                   ("Crystal Palace Park dinosaurs restored", "london"),
                   ("Celtic Connections festival line-up announced", "glasgow"),
                   ("Hearts warmed as Edinburgh charity hits target", "edinburgh"),
                   ("Regione Lazio, via libera al nuovo piano rifiuti per Roma", "rome")]:
        assert not club_story(t, "", pid), t
    assert club_story("Chelsea beat Spurs in London derby fixture", "", "london")   # with a sport cue
    assert club_story("Tottenham Hotspur sack manager", "", "london")                  # unambiguous name


def test_everyday_words_are_not_sport():                               # review 2
    for t, pid in [("How to beat the heat in London this weekend", "london"),
                   ("London's best comedy clubs", "london"),
                   ("Tube closures 2-4 November: what you need to know", "london"),
                   ("Derby day for London commuters as rail fares rise", "london"),
                   ("Henry V returns to the Old Vic", "london"),
                   ("Partita Iva, a Milano boom di aperture", "milan")]:
        assert not club_story(t, "", pid), t


def test_thin_uses_only_recent_stories_and_all_languages(tmp_path):    # review 3
    import time
    (tmp_path / "p").mkdir()
    now = time.time()
    old = [{"ts": now - 15 * 86400}] * 5
    (tmp_path / "p" / "a.json").write_text(_json.dumps({"news": {"en": old + [{"ts": now}]}}))     # 1 recent: thin
    (tmp_path / "p" / "b.json").write_text(_json.dumps({"news": {"en": [{"ts": now}] * 6}}))         # en fine, ml missing
    (tmp_path / "p" / "c.json").write_text(_json.dumps({"news": {"en": [{"ts": now}] * 6}}))
    kinds = {"a": "city", "b": "city", "c": "city"}
    langs = {"a": ["en"], "b": ["en", "ml"], "c": ["en"]}
    assert thin_from_prev(tmp_path, ["a", "b", "c"], kinds, langs=langs, now=now) == {"a", "b"}


def test_kollam_as_year_and_district_towns_kept():                     # review 4
    import build_news as bn
    pmap = {p["id"]: p for p in bn.PLACES}
    own = bn.names(pmap["thrissur"]) + __import__("news_config").DISTRICT_TOWNS.get("thrissur", [])
    others = other_names("thrissur", pmap, bn.names, bn.LOCAL_FROM)
    assert not other_place("ഈ കൊല്ലം പൂരം ഗംഭീരമാക്കും", own, others)                     # 'this year'
    assert not other_place("ചാലക്കുടിയിൽ യുവാവ് അറസ്റ്റിൽ, പ്രതി കൊച്ചിയിലേക്ക് കടന്നു", own, others)
    assert other_place("കൊച്ചിയിലെ ‘മിനി റെഡ് സ്ട്രീറ്റ്’", own, others)                    # still dropped
    assert "delhi" not in others and "kolkata" not in others                               # other states: Gemini's call


def test_relevance_asks_only_district_stories_without_the_place():    # review 5
    from news_relevance import relevance_asks
    pmap = {"india": {"id": "india", "name": "India", "kind": "country", "parent": None},
            "kerala": {"id": "kerala", "name": "Kerala", "kind": "region", "parent": "india"},
            "thrissur": {"id": "thrissur", "name": "Thrissur", "kind": "city", "parent": "kerala"}}
    named = {"t": "Thrissur pooram plan", "_own": True, "ts": 2}
    village = {"t": "Water supply restored", "_own": True, "ts": 1}
    result = {"thrissur": {"news": {"en": [named, village]}}}
    asks = relevance_asks(result, pmap, lambda p: [p["name"].lower()])
    assert [a[1] for a in asks] == [village]
    assert asks[0][0] == "Thrissur, Kerala, India (from the Thrissur district page)"


def test_relevance_prompt_says_true_when_unsure():
    ai = _ai([])
    ai.cache["k1"] = {}
    ai.relevance([("Thrissur", {"t": "x", "_k": "k1"})])
    assert "unsure" in ai.asked[0] and "true" in ai.asked[0]
