# News: right stories for every place — design

Date: 2026-10-23 · Status: approved in chat, awaiting review of this document

## Why

The News tool (news.html, built every 2 hours by `scripts/build_news.py`) is the
daily-use tool that matters most. Its weakness is **wrong or thin stories**, and
every place in the list should be right, not just a favourite few.

Evidence from the 2026-10-22 13:50 UTC edition (`report.txt`, `p/<place>.json`):

- Wrong: Milan (English) is mostly AC Milan football; Swansea is half Swansea City
  FC; Thrissur (Malayalam) includes Kochi, Kollam and Kolkata stories, because
  everything on a paper's district page is accepted unchecked (`_own` skips the
  name check).
- Thin: Kodungallur 1 English / 2 Malayalam; Qingdao and Qidong 0; Pemba and Cabo
  Delgado 0–3; Kannada lists 0–6.

## Constraints

- Trusted, independent papers only; state media stays out (this rules out new
  Chinese city sources).
- Free: GitHub Actions every 2 hours, Gemini free tier (`gemini-flash-lite-latest`).
- Nothing may break when Gemini is unavailable or a source fails — fall back to rules
  or to the previous edition, as today.
- Page format stays compatible: older `p/<place>.json` files without the new fields
  must still render.

## Success criteria

1. Club-football stories no longer appear in a city's main list unless they are
   about the city itself.
2. District-page stories that name another place, and not this one, are gone.
3. Every city and region has at least 5 real stories, or a filled, clearly labelled
   "Around <place>" section.
4. `report.txt` shows, per list, how many stories each rule removed, and a
   per-place before/after comparison is checked by hand for Milan (en), Swansea,
   Thrissur (ml), Kodungallur, Pemba and Bengaluru (kn).

## Part 1 — keep wrong stories out

### 1.1 Club names (rule)

`news_config.py` gains `CLUBS = {place_id: [patterns]}`, e.g.
`milan: ["AC Milan", "Inter Milan", "l'Inter", "Rossoneri", "Nerazzurri", "San Siro"]` (never a bare "Inter", which is an ordinary Italian word),
`swansea: ["Swansea City", "the Swans", "Swans"]`, `london`/`manchester`/
`birmingham`/`glasgow`/`edinburgh`/`cardiff`/`rome` likewise, with native forms
where the list has another language (`Milan` in Italian: "Milan" the club vs
"Milano" the city — the Italian list keys on "Milano", so the club rule there
targets "il Milan", "rossoneri", "nerazzurri").

A story is a *club story* when its headline matches a club pattern **and** its
headline + summary does not also match a civic cue (`police|council|mayor|riot|
protest|traffic|fire|court|hospital|school|flood|strike` and their it/ml/zh
equivalents in `CIVIC`). Club stories are dropped from the place's main and
"other" lists (they still reach the Sport topic for the country/world).

### 1.2 District pages must not name another place (rule)

`news_config.py` gains `PLACE_WORDS`: for Kerala, the 14 districts and their main
towns in English and Malayalam; plus, automatically, `names()` of every place in
`PLACES`. For a story harvested from a district page (`_own`), if its headline names
any other place and none of this place's names (including neighbourhood names, 2.1),
it is dropped. A headline that names no place at all is kept (village stories).

### 1.3 Gemini relevance check (AI, existing step)

New `AI.relevance(items)` in `news_extras.py`:

- Input: local-list stories the rules cannot settle — those kept only because they
  came from a district page, or whose summary but not headline names the place.
- Batched across places, ~40 per request:
  `[{"i", "place", "headline", "summary"}]` → `[{"i", "about": true|false}]`,
  prompt: "Is this story about, or happening in, <place>?".
- Each verdict is cached in the existing news cache under the story key
  (`rel:<place>`), so a story is judged once; cache rules unchanged (4-day expiry).
- Stories judged `false` are dropped. No answer (quota, error) means *keep*.
- `AI.MAX_CALLS` 30 → 60. Summaries and digests keep their current share; relevance
  uses what is left, newest stories first.

Order in `main()`: rules 1.1 and 1.2 run where the list is assembled; 1.3 runs after
`enrich()` (needs summaries) and before the final cap/round-robin.

## Part 2 — fill thin places

### 2.1 Neighbourhood names

Extend `ALIASES` for small places with the areas papers actually name:
Kodungallur — Methala, Eriyad, Azhikode, Mathilakam, Kaipamangalam, Pullut,
Edavilangu, Sringapuram, Lokamaleswaram, Kodungallur Bhagavathy / Kurumba temple
(English and Malayalam). Pemba — Pemba city, Pemba bay, plus the Cabo Delgado list
for the region. Bengaluru/Mangaluru — common area names in Kannada.

### 2.2 Longer look-back when quiet

Today stories older than 8 days are dropped everywhere. For city/region lists with
fewer than 5 stories after filtering, the window widens to 21 days (search `when:`
for those places becomes `21d` on the next run via a per-place override in
`WHEN_THIN`, decided from the previous edition's counts). The page already shows
each story's time; older ones show their date.

### 2.3 "Around <place>" fallback

If a city/region still has fewer than 5 stories, its JSON gains
`"around": {"from": "<parent id>", "news": {lang: [up to 8 stories]}}` — the
parent's top stories in the same languages, excluding any already shown.
`js/news.js` renders it after the place's own stories under a heading
"Around Kodungallur — from Thrissur district" (parent name from `index.json`),
styled like the existing "other outlets" group. Absent field → nothing rendered.

### 2.4 New trusted sources (verify each before adding)

- Mozambique (pt/en): Carta de Moçambique, O País, Pinnacle News (Cabo Delgado),
  alongside Zitamar and Club of Mozambique — added to `OUTLETS["pt"]` / `EN_LOCAL["MZ"]`;
  their section pages added to `LOCAL_PAGES` where they have one.
- Kannada: Prajavani and Udayavani district pages for Bengaluru and Mangaluru in
  `LOCAL_PAGES`.
- China: none (state media excluded). Qingdao and Qidong rely on 2.2 and 2.3.

A source is added only if a fetch from GitHub Actions returns parseable stories;
otherwise it is left out and noted in the report.

## Reporting

`report.txt` per list adds `removed club N, other-place N, ai N, around N` and
`window 21d` when widened, and a new "Thin places" section listing any city/region
still under 5 own stories.

## Testing

- Unit tests (`scripts/test_news_relevance.py`, pytest, run in the workflow before
  the build): club rule with civic-cue exception; other-place rule including
  "no place named → keep"; relevance verdict caching and "no answer → keep";
  `around` built only when thin and never duplicating own stories; window override.
- Gemini calls are faked in tests; no network.
- After deploy, one run's `report.txt` and the six hand-checked lists (success
  criterion 4) are compared with the 2026-10-22 edition.

## Out of scope

Freshness, layout, new places, Kindle/epub changes, the live-refresh worker
(it will pick up the new rules only when it is deployed and updated separately).
