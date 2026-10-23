# News relevance — trial results

Trial builds ran on the `news-relevance` branch with output written to `probe-out`, so nothing
reached the live page. Baseline: the live edition of 2026-10-22 13:50 UTC.

| Check (spec success criterion) | Baseline | Trial 3 (2026-10-23 11:40 UTC) |
|---|---|---|
| 1. Club stories out of city lists | Milan (en) mostly AC Milan; Swansea half Swansea City | Milan (en): 20 removed, top 10 city news (one borderline club-history piece). Swansea: 36 removed; two match reports left, fixed after the trial (`X v Y`, "victory against") |
| 2. District pages naming another place | Thrissur (ml) had Kochi, Kollam, Kolkata items | Thrissur (ml): 5 removed by the rule + 6 by Gemini; top 8 all Thrissur district (Nattika, Puthukkad, Mala…) |
| 3. ≥ 5 own stories or a filled "Around" | Kodungallur 1 en / 2 ml; Qingdao, Qidong 0; Pemba 0–3; Kannada 0–6 | Every thin city/region in the "Thin places" section has an Around block (e.g. Kodungallur ml 3 + 8 from Thrissur; Qingdao en 0 + 8 from China; Pemba 1 pt + 8 from Cabo Delgado). Kodungallur en now 5 own |
| 4. Removal counts in the report | — | `removed club N`, `removed other-place N`, `removed ai N`, `window 21d` per list |
| New sources | Bengaluru kn 0, Mangaluru kn 0 | Bengaluru kn 9, Mangaluru kn 2 (Prajavani); Carta de Moçambique and O País in Mozambique lists |

Problems found and fixed during verification (each with a test written first):

- Match reports naming only the city ("QPR - Swansea | Football", "Swansea 0-1 West Ham") — sport cues for places with clubs.
- Towns whose parent had no stories in a language got no Around — Around now takes the nearest ancestor with stories (never World).
- Mangaluru's Kannada Around borrowed Hindi headlines from India's Kannada list — Around only borrows stories in the language's script.

Known and not fixed here: India's Kannada list itself contains Hindi headlines (existing behaviour of the
national lists; Around no longer spreads it). Trial 2 failed at the build step and its log could not be
read from the sandbox; trial 3 with identical code succeeded.
