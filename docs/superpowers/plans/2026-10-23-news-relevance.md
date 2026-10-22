# News Relevance and Thin Places Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every place's News list shows stories really about that place (no club football, no other districts), and thin places get neighbourhood matches, a longer look-back, an "Around <place>" section and new trusted sources.

**Architecture:** The pure rules live in a new `scripts/news_relevance.py` (no network, unit-tested). `build_news.py` calls them while it assembles each list, and again after `enrich()`. A new `AI.relevance()` in `news_extras.py` asks Gemini about stories the rules can't settle, caching each verdict. The front end (`js/news.js`) renders an optional `around` block.

**Tech Stack:** Python 3.12 standard library, pytest (tests only), Gemini REST (existing), vanilla JS.

**Spec:** `docs/superpowers/specs/2026-10-23-news-relevance-design.md`

## Global Constraints

- Trusted, independent papers only; no state media (no new Chinese sources).
- Free: GitHub Actions every 2 hours; Gemini free tier, model `gemini-flash-lite-latest`; `AI.MAX_CALLS = 60`.
- Gemini unavailable or erroring → rules still apply, and an unanswered relevance check means **keep**.
- A thin place has fewer than **5** own stories; its window widens to **21 days**; its `around` holds up to **8** parent stories.
- Older `p/<place>.json` files without `around` must still render.
- Commits use author `Claude <noreply@anthropic.com>` and end with the two attribution lines (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Claude-Session: https://claude.ai/code/session_01FoR52BD8YuYbKCAkB8WZtG`); `git pull --rebase` before every push (other sessions push to `main`).

## Review Focus

1. A civic story that names the club ("Riots near San Siro after AC Milan match") must stay in Milan — Task 2 test `test_club_with_civic_cue_kept`.
2. A Thrissur district-page headline naming no place ("Water supply restored") must stay — Task 2 test `test_no_place_named_kept`.
3. A headline naming both places ("Thrissur–Kochi bus strike") must stay in Thrissur — Task 2 test `test_both_places_named_kept`.
4. A Gemini reply with missing or garbled entries must keep those stories, not drop them — Task 4 test `test_relevance_garbled_reply_keeps`.
5. A place whose parent has no stories in that language must not render an empty "Around" heading — Task 6 test `test_around_empty_parent_is_none` and the Task 7 render check.

---

### Task 1: Config — clubs, civic cues, place words, neighbourhoods; test harness

**Files:**
- Modify: `scripts/news_config.py` (add `CLUBS`, `CIVIC`, `PLACE_WORDS`; extend `ALIASES`; remove `"Swans"` from `ALIASES["swansea"]`)
- Create: `scripts/test_news_relevance.py`
- Modify: `.github/workflows/build-news.yml` (install pytest, run tests before Build; add `scripts/news_relevance.py` and the test file to `paths`)

**Interfaces:**
- Produces:
  - `CLUBS: dict[str, list[str]]`: case-insensitive whole-phrase patterns per place id. `milan` (en): `AC Milan`, `Inter Milan`, `l'Inter`, `Rossoneri`, `Nerazzurri`, `San Siro`; `milan` (it): `il Milan`, `rossoneri`, `nerazzurri`, `l'Inter`. `swansea`: `Swansea City`, `the Swans`, `Swans`. Also `london` (Chelsea, Arsenal, Tottenham, Spurs, West Ham, Fulham, Crystal Palace, Brentford), `manchester` (Manchester United, Man Utd, Manchester City, Man City), `birmingham` (Aston Villa, Birmingham City), `glasgow` (Celtic, Rangers), `edinburgh` (Hearts, Hibernian, Hibs), `cardiff` (Cardiff City, the Bluebirds), `rome` (AS Roma, Lazio, giallorossi, biancocelesti).
  - `CIVIC: re.Pattern` covering en, it, ml and zh cues: police, council, mayor, riot, protest, traffic, fire, court, hospital, school, flood, strike; polizia, comune, sindaco, scontri, corteo, traffico, incendio, tribunale, ospedale, scuola, sciopero; പോലീസ്, നഗരസഭ, കോടതി, ആശുപത്രി, സമരം; 警方, 法院, 医院, 学校.
  - `PLACE_WORDS: dict[str, list[str]]`: extra place names for the other-place rule, keyed by region id. `kerala` holds the 14 districts and their main towns in English and Malayalam (Thiruvananthapuram, Kollam, Pathanamthitta, Alappuzha, Kottayam, Idukki, Ernakulam/Kochi, Thrissur, Palakkad, Malappuram, Kozhikode, Wayanad, Kannur, Kasaragod).
  - New `ALIASES` entries: `kodungallur` += Methala, Eriyad, Azhikode, Mathilakam, Kaipamangalam, Pullut, Edavilangu, Sringapuram, Lokamaleswaram, Kurumba, plus Malayalam forms (മേത്തല, എറിയാട്, അഴീക്കോട്, മതിലകം, കയ്പമംഗലം, പുല്ലൂറ്റ്, എടവിലങ്ങ്, ശൃംഗപുരം, ലോകമലേശ്വരം); `pemba` += "Pemba city", "baía de Pemba".

- [ ] **Step 1: Write the failing test** in `scripts/test_news_relevance.py`

```python
from news_config import CLUBS, CIVIC, PLACE_WORDS, ALIASES

def test_config_shapes():
    assert "AC Milan" in CLUBS["milan"] and "Swansea City" in CLUBS["swansea"]
    assert "Inter" not in CLUBS["milan"]
    assert CIVIC.search("Police close roads") and CIVIC.search("scontri in centro")
    assert len([w for w in PLACE_WORDS["kerala"] if w.isascii()]) >= 14
    assert "Swans" not in ALIASES["swansea"]
    assert "Methala" in ALIASES["kodungallur"]
```

- [ ] **Step 2: Run it to see it fail:** `cd scripts && python3 -m pytest test_news_relevance.py -q` → ImportError for `CLUBS`.
- [ ] **Step 3: Add the config values above to `news_config.py`.**
- [ ] **Step 4: Run it to see it pass:** same command → `1 passed`.
- [ ] **Step 5: Workflow:** add `- run: pip install -q pytest && cd scripts && python3 -m pytest -q` before `Build`; add both new files to `on.push.paths`.
- [ ] **Step 6: Commit** — `git commit -m "News: club, civic and place-word config; test harness"`.

### Task 2: Pure rules — club stories and other-place headlines

**Files:**
- Create: `scripts/news_relevance.py`
- Test: `scripts/test_news_relevance.py`

**Interfaces:**
- Consumes: Task 1 config.
- Produces:
  - `club_story(title: str, summary: str, pid: str) -> bool`: True when the title matches a `CLUBS[pid]` phrase (whole words, case-insensitive) and neither title nor summary matches `CIVIC`.
  - `other_place(title: str, own: list[str], others: list[str]) -> bool`: True when the title contains any `others` name and no `own` name (case-insensitive substring, the same matching `names()` uses today).
  - `other_names(pid: str, pmap: dict, names_fn) -> list[str]`: the names of every place except `pid`, its ancestors and its descendants, plus `PLACE_WORDS` of its region minus its own names.

- [ ] **Step 1: Write failing tests:**

```python
from news_relevance import club_story, other_place

def test_club_story_dropped():
    assert club_story("AC Milan beat Bournemouth 2-0", "", "milan")
def test_club_with_civic_cue_kept():
    assert not club_story("Riots near San Siro after AC Milan match", "Police made arrests", "milan")
def test_city_story_not_club():
    assert not club_story("Milan deploys 500 troops", "", "milan")
def test_other_place_dropped():
    assert other_place("കൊച്ചിയിലെ ‘മിനി റെഡ് സ്ട്രീറ്റ്’", ["തൃശൂ"], ["കൊച്ചി", "kochi"])
def test_no_place_named_kept():
    assert not other_place("Water supply restored", ["thrissur"], ["kochi", "kollam"])
def test_both_places_named_kept():
    assert not other_place("Thrissur–Kochi bus strike", ["thrissur"], ["kochi"])
```

- [ ] **Step 2: Run it to see it fail:** `python3 -m pytest test_news_relevance.py -q` → ModuleNotFoundError.
- [ ] **Step 3: Implement the three functions in `news_relevance.py`.** Club phrases are compiled once per place as `\b(?:…)\b` with `re.I`; non-ASCII phrases skip the `\b`.
- [ ] **Step 4: Run it to see it pass** → all pass.
- [ ] **Step 5: Commit** — `"News: rules for club stories and other-place headlines"`.

### Task 3: Wire the rules into the build, with counts in the report

**Files:**
- Modify: `scripts/build_news.py` (the local-list assembly at the `elif kind in ("region", "city")` block and the final filter loop after `enrich()`; the report line)
- Test: `scripts/test_news_relevance.py`

**Interfaces:**
- Consumes: `club_story`, `other_place`, `other_names` (Task 2).
- Produces: `filter_local(stories: list[dict], pid: str, own: list[str], others: list[str], counts: dict) -> list[dict]` in `news_relevance.py`. It drops club stories (all stories in a city or region list) and other-place headlines (only `_own` district-page stories), and increments `counts["club"]` and `counts["other_place"]`. `build_news.py` keeps one `counts` dict per `(pid, lang)`. The report line gains `removed club N other-place N`.

- [ ] **Step 1: Write the failing test:** `test_filter_local_counts` builds three stories (a club one, an `_own` story naming Kochi under `pid="thrissur"`, a clean one), runs `filter_local`, and asserts one story is left with `counts == {"club": 1, "other_place": 1}`.
- [ ] **Step 2: Run it to see it fail** → ImportError.
- [ ] **Step 3: Implement `filter_local`.** Call it in `build_news.py` on `trusted` and `other` right after the round-robin split for region/city lists, and again in the final loop before the cap. `own` is `names(pmap[pid])`; `others` comes from `other_names(pid, pmap, names)`, computed once per place.
- [ ] **Step 4: Run the tests** → pass. Then run `python3 -c "import build_news"` from `scripts/` → no error.
- [ ] **Step 5: Commit** — `"News: apply club and other-place rules; report removals"`.

### Task 4: Gemini relevance check

**Files:**
- Modify: `scripts/news_extras.py` (`AI.MAX_CALLS = 60`; new `AI.relevance`)
- Modify: `scripts/build_news.py` (call it after summaries, before digests)
- Test: `scripts/test_news_relevance.py`

**Interfaces:**
- Produces: `AI.relevance(items: list[tuple[str, dict]]) -> set[int]`. Each item is `(place_name, story)`. It returns the `id()`s of the stories judged not about their place. Each request carries 40 items as `[{"i", "place", "headline", "summary"}]` and expects `[{"i", "about": bool}]` back. Verdicts are cached on `cache[story["_k"]]["rel:" + place_name]` (only stories that have `_k`). A cached verdict is used without asking. A missing, non-bool or out-of-range answer means **keep**. It stops when `self.calls >= MAX_CALLS`.
- Which stories are asked about (in `build_news.py`): local-list stories kept only through `_own`, or whose title lacks every `own` name. Newest first. Dropped stories add to `counts["ai"]`, and the report shows `ai N`.

- [ ] **Step 1: Write failing tests.** Each uses `AI.__new__(AI)` with `key="x"`, `on=True`, a dict cache, `calls=0`, `errors=0`, and `_ask` monkeypatched:
  - `test_relevance_drops_false`: the fake reply marks item 0 false and item 1 true → the returned set holds only story 0's id, and the cache records `False` and `True`.
  - `test_relevance_uses_cache`: a story whose cache says `rel:Thrissur: False` → `_ask` is never called and the story is dropped.
  - `test_relevance_garbled_reply_keeps`: the fake reply is `[{"i": 7, "about": "no"}]` → the returned set is empty.
  - `test_relevance_no_answer_keeps`: `_ask` returns `None` → the returned set is empty.
- [ ] **Step 2: Run them to see them fail** → AttributeError `relevance`.
- [ ] **Step 3: Implement `AI.relevance`, set `MAX_CALLS = 60`, and wire it** in `build_news.py` after `ai.summaries(need)`. Remove the dropped ids from `result[pid]["news"][lang]` and add to `counts`.
- [ ] **Step 4: Run the tests** → pass.
- [ ] **Step 5: Commit** — `"News: Gemini relevance check for local stories, cached"`.

### Task 5: Longer look-back for thin places

**Files:**
- Modify: `scripts/news_relevance.py`, `scripts/build_news.py` (`jobs_for` gets the `when` override; the 8-day age cut becomes per place)
- Test: `scripts/test_news_relevance.py`

**Interfaces:**
- Produces:
  - `thin_from_prev(prev_dir: Path, pids: list[str], kinds: dict[str, str]) -> set[str]`: region or city ids whose previous `p/<id>.json` has fewer than 5 `news` stories in every language. A missing file counts as not thin.
  - In `build_news.py`, `THIN = thin_from_prev(...)` is computed before `jobs`. `jobs_for(p)` uses `when = "21d"` for ids in `THIN`. The age limit is `21 * 86400` for those ids and `8 * 86400` otherwise, in both places it is applied. The report line gains `window 21d`.

- [ ] **Step 1: Write failing tests:** `test_thin_from_prev` writes into a tmp dir:
  - `a.json` with news `{"en": [1, 2], "ml": [1]}` → thin.
  - `b.json` with `{"en": [1] * 6}` → not thin.
  - no file for `c` → not thin.
  - a country `d` with 0 stories → not thin.

  It asserts the result is `{"a"}`.
- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: Implement it and wire it in.**
- [ ] **Step 4: Run the tests** → pass.
- [ ] **Step 5: Commit** — `"News: three-week look-back for thin places"`.

### Task 6: "Around <place>" data

**Files:**
- Modify: `scripts/news_relevance.py`, `scripts/build_news.py` (before the `p/<pid>.json` write; add `around` to `doc`; the report's "Thin places" section)
- Test: `scripts/test_news_relevance.py`

**Interfaces:**
- Produces:
  - `build_around(own: dict[str, list], parent_news: dict[str, list], parent_id: str, langs: list[str], cap: int = 8) -> dict | None`. It returns `{"from": parent_id, "news": {lang: [...]}}` holding, for each language where `len(own.get(lang, [])) < 5`, up to `cap` parent stories whose `u` is not among the own stories' URLs. It returns `None` if no language gets any stories.
  - `doc["around"]` is set only when this is not `None`. The stories pass through the existing `clean()`. Only region and city places with a parent get it.
  - `report.txt` gains a final `Thin places:` section listing `pid lang own N around M` for every list still under 5.

- [ ] **Step 1: Write failing tests:**
  - `test_around_fills_thin_lang`: own `{"ml": [s1]}`, parent `{"ml": [s1, s2, s3], "en": [s4]}`, langs `["ml", "en"]` → `ml` holds `[s2, s3]` (s1 de-duplicated), and `en` holds `[s4]` because own `en` is empty.
  - `test_around_not_needed`: own has 5 in every language → `None`.
  - `test_around_empty_parent_is_none`: parent `{}` → `None`.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement it and wire it in.**
- [ ] **Step 4: Run the tests** → pass.
- [ ] **Step 5: Commit** — `"News: Around <place> stories for thin places"`.

### Task 7: Render "Around" on the page

**Files:**
- Modify: `js/news.js` (inside `for (const l of chosen)`, after the story list or the empty note); `css/news.css`; bump both version query strings in `news.html`.

**Interfaces:**
- Consumes: `data.around = {from, news: {lang: [story]}}` (Task 6). It may be absent.
- Produces: for the current language, when there is no topic and `data.around?.news?.[l]?.length`, a `<div class="around">` holding the heading `Around ${p.name} — from ${parentName}` (parentName from `index.places`, where the parent's `kind` of `region` adds " district" for an Indian region with an Indian city child, otherwise the name alone) and then the stories via `storyEl(s, false, false)`. With nothing to show, no element at all.

- [ ] **Step 1: Write the check.** Under `scripts/`, add a Playwright script `check_news_around.mjs` that serves the repo, fulfils `raw.githubusercontent.com/**/news-data/**` with fixture JSON (one place with `around`, one without), opens `news.html?p=kodungallur`, and asserts that `.around` exists with the heading text and 2 stories. For a place without `around` it asserts `.around` count is 0.
- [ ] **Step 2: Run it to see it fail:** `NODE_PATH=/opt/node-tools/node_modules node scripts/check_news_around.mjs` → assertion fails (no `.around`).
- [ ] **Step 3: Implement the render and the styles.** `.around` uses the same left rule and muted heading style as the existing "Other outlet" items; it works in both themes.
- [ ] **Step 4: Run the check** → `ok`. Take a screenshot at 1280 and at 390 px wide, and look at both.
- [ ] **Step 5: Commit** — `"News page: show Around <place> for thin places"`.

### Task 8: New trusted sources (verified from GitHub Actions)

**Files:**
- Create: `scripts/probe_sources.py` (one-off, kept for re-checks)
- Create, then delete after use: `.github/workflows/probe-sources.yml` (workflow_dispatch; runs the probe and pushes its output to the `probe-out` branch)
- Modify: `scripts/news_config.py` (`OUTLETS["pt"]`, `build_news.EN_LOCAL["MZ"]`, `LOCAL_PAGES`)

**Interfaces:**
- Candidates:
  - Mozambique: `cartamz.com` (Carta de Moçambique), `opais.co.mz` (O País), `pinnaclenews.net` (Pinnacle News, Cabo Delgado).
  - Kannada: the Bengaluru and Mangaluru district pages on `prajavani.net` and `udayavani.com`.
  - For each, the probe fetches the Google News search `site:<domain> when:7d` and the section page URL, then prints the HTTP status, the number of parseable stories (`news_extras.harvest_page` for pages, `build_news.parse_rss` for feeds) and 3 sample titles.
- Rule: add a source only if the probe shows at least 3 parseable stories with on-topic titles. Write each rejected source and the reason into the commit message.

- [ ] **Step 1: Write `probe_sources.py`** (candidate list in the file; output to `probe/out.txt`) **and the temporary workflow.**
- [ ] **Step 2: Run it** with `gh api -X POST repos/ranjithkannankattil/ranjithkannankattil.github.io/actions/workflows/probe-sources.yml/dispatches -f ref=main`. Wait for completion, then read `probe/out.txt` from `probe-out` with `gh api .../contents/out.txt?ref=probe-out`.
- [ ] **Step 3: Add the passing sources** to the config.
- [ ] **Step 4: Run** `python3 -m pytest -q` → still passes.
- [ ] **Step 5: Delete the temporary workflow and commit** — `"News: add verified Mozambique and Kannada sources"`, with the accept/reject list in the body.

### Task 9: Run it live and check against the 2026-10-22 baseline

**Files:** none (verification); save the comparison to `docs/superpowers/plans/2026-10-23-news-relevance-results.md`.

- [ ] **Step 1: Push and trigger the build:** `gh api -X POST .../actions/workflows/build-news.yml/dispatches -f ref=main`; wait for `completed success`.
- [ ] **Step 2: Fetch** `report.txt` and `p/{milan,swansea,thrissur,kodungallur,pemba,bengaluru}.json` from `news-data`.
- [ ] **Step 3: Check every success criterion** and record the evidence in the results file:
  - Milan (en): no club-only stories in the top 10.
  - Swansea: no club-only stories in the top 10.
  - Thrissur (ml): no headline names only another district.
  - The "Thin places" section lists only places with a filled `around`.
  - Kodungallur, Pemba and Bengaluru (kn) each have at least 5 own stories or an `around` section.
  - The report's removal counts are non-zero for Milan and Thrissur.
- [ ] **Step 4: Open the page** for those six places and screenshot each: the live site via the browser, or the Task 7 check pointed at the real data.
- [ ] **Step 5: Commit the results file**; report the outcome to Ranjith.
