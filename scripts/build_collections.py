#!/usr/bin/env python3
"""Build new Radio collections from radio-browser.info, keeping only streams that play.

For each collection in NEW below whose js/stations/<id>.js does not exist yet, it:
  1. pulls the most-listened stations for that language / country,
  2. merges duplicate listings (same stream or same name) into one station with backups,
  3. tests every stream with scripts/check_streams.py (the same test as the
     twice-daily check) and keeps only those that play,
  4. writes js/stations/<id>.js and adds the collection to js/collections.js.

Existing collections are never overwritten, so hand-checked lists stay as they are.
Run by .github/workflows/build-radio-collections.yml (or locally: python3 scripts/build_collections.py).
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import re
import sys
import unicodedata
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_streams as cs  # noqa: E402

ROOT = cs.ROOT
CAP = 40            # stations kept per collection
CANDIDATES = 70     # stations tested per collection

E, M, A, AM = "Europe", "Middle East & Central Asia", "East & Southeast Asia", "Americas"
# id, name, native, group, intro, radio-browser queries, languages for later replacement search
NEW = [
    ("spanish-spain", "Spanish (Spain)", "Español", E, "RNE, Cadena SER, COPE, Los40 and stations across Spain.", [{"language": "spanish", "countrycode": "ES"}, {"countrycode": "ES"}], ["spanish", "castellano"]),
    ("spanish-latam", "Spanish (Latin America)", "Español", AM, "Mexico, Argentina, Colombia, Chile, Peru and the rest of Latin America.", [{"language": "spanish", "_not": "ES"}, {"language": "español mexico"}, {"language": "español argentina"}, {"language": "español - latinoamerica"}], ["spanish", "español"]),
    ("portuguese-brazil", "Portuguese (Brazil)", "Português", AM, "Brazilian news, sertanejo, MPB and pop.", [{"countrycode": "BR"}, {"language": "brazilian portuguese"}], ["portuguese", "brazilian portuguese", "português"]),
    ("portuguese-portugal", "Portuguese (Portugal)", "Português", E, "RTP, Renascença, Rádio Comercial and Portuguese stations.", [{"countrycode": "PT"}], ["portuguese", "português"]),
    ("german", "German", "Deutsch", E, "Stations from Germany, Austria and Switzerland.", [{"language": "german"}], ["german", "deutsch"]),
    ("dutch", "Dutch", "Nederlands", E, "NPO, Qmusic, Radio 538 and Flemish stations.", [{"language": "dutch"}], ["dutch", "nederlands", "flemish"]),
    ("polish", "Polish", "Polski", E, "Polskie Radio, RMF FM, Radio ZET and more.", [{"language": "polish"}], ["polish", "polski"]),
    ("greek", "Greek", "Ελληνικά", E, "Stations from Greece and Cyprus.", [{"language": "greek"}], ["greek"]),
    ("russian", "Russian", "Русский", E, "Russian-language stations from around the world.", [{"language": "russian"}], ["russian"]),
    ("ukrainian", "Ukrainian", "Українська", E, "Suspilne, Hit FM and Ukrainian stations.", [{"language": "ukrainian"}], ["ukrainian"]),
    ("romanian", "Romanian", "Română", E, "Stations from Romania and Moldova.", [{"language": "romanian"}, {"language": "română"}, {"language": "romania"}], ["romanian", "română"]),
    ("hungarian", "Hungarian", "Magyar", E, "Hungarian stations, live.", [{"language": "hungarian"}], ["hungarian", "magyar"]),
    ("czech", "Czech", "Čeština", E, "Český rozhlas, Evropa 2 and Czech stations.", [{"language": "czech"}], ["czech"]),
    ("slovak", "Slovak", "Slovenčina", E, "Slovak stations, live.", [{"language": "slovak"}], ["slovak"]),
    ("serbian", "Serbian", "Српски", E, "Stations from Serbia and the region.", [{"language": "serbian"}], ["serbian"]),
    ("croatian", "Croatian", "Hrvatski", E, "HRT and Croatian stations.", [{"language": "croatian"}], ["croatian"]),
    ("bosnian", "Bosnian", "Bosanski", E, "Stations from Bosnia and Herzegovina.", [{"language": "bosnian"}], ["bosnian"]),
    ("slovenian", "Slovenian", "Slovenščina", E, "Slovenian stations, live.", [{"language": "slovenian"}], ["slovenian"]),
    ("bulgarian", "Bulgarian", "Български", E, "Bulgarian stations, live.", [{"language": "bulgarian"}], ["bulgarian"]),
    ("albanian", "Albanian", "Shqip", E, "Stations from Albania and Kosovo.", [{"language": "albanian"}], ["albanian"]),
    ("macedonian", "Macedonian", "Македонски", E, "Macedonian stations, live.", [{"language": "macedonian"}], ["macedonian"]),
    ("swedish", "Swedish", "Svenska", E, "Sveriges Radio and Swedish stations.", [{"language": "swedish"}], ["swedish"]),
    ("norwegian", "Norwegian", "Norsk", E, "NRK and Norwegian stations.", [{"language": "norwegian"}], ["norwegian"]),
    ("danish", "Danish", "Dansk", E, "DR and Danish stations.", [{"language": "danish"}], ["danish"]),
    ("finnish", "Finnish", "Suomi", E, "Yle and Finnish stations.", [{"language": "finnish"}], ["finnish"]),
    ("estonian", "Estonian", "Eesti", E, "ERR and Estonian stations.", [{"language": "estonian"}], ["estonian"]),
    ("latvian", "Latvian", "Latviešu", E, "Latvian stations, live.", [{"language": "latvian"}], ["latvian"]),
    ("lithuanian", "Lithuanian", "Lietuvių", E, "LRT and Lithuanian stations.", [{"language": "lithuanian"}], ["lithuanian"]),
    ("catalan", "Catalan", "Català", E, "Catalunya Ràdio, RAC1 and Catalan stations.", [{"language": "catalan"}], ["catalan"]),
    ("arabic", "Arabic", "العربية", M, "Stations from across the Arab world — news, music and Quran.", [{"language": "arabic"}, {"language": "ar"}], ["arabic"]),
    ("turkish", "Turkish", "Türkçe", M, "TRT and Turkish stations.", [{"language": "turkish"}], ["turkish"]),
    ("persian", "Persian", "فارسی", M, "Persian-language stations from Iran, Afghanistan and the diaspora.", [{"language": "persian"}, {"language": "farsi"}], ["persian", "farsi"]),
    ("hebrew", "Hebrew", "עברית", M, "Kan, Galgalatz and Israeli stations.", [{"language": "hebrew"}], ["hebrew"]),
    ("kurdish", "Kurdish", "Kurdî", M, "Kurdish stations, live.", [{"language": "kurdish"}], ["kurdish"]),
    ("azerbaijani", "Azerbaijani", "Azərbaycan", M, "Azerbaijani stations, live.", [{"language": "azerbaijani"}], ["azerbaijani"]),
    ("kazakh", "Kazakh", "Қазақша", M, "Kazakh stations, live.", [{"language": "kazakh"}], ["kazakh"]),
    ("chinese", "Chinese (Mandarin)", "中文", A, "Mandarin stations from China, Taiwan, Singapore and beyond.", [{"language": "chinese"}, {"language": "mandarin"}], ["chinese", "mandarin"]),
    ("cantonese", "Cantonese", "粵語", A, "RTHK and Cantonese stations.", [{"language": "cantonese"}], ["cantonese"]),
    ("japanese", "Japanese", "日本語", A, "Japanese stations and J-pop channels.", [{"language": "japanese"}], ["japanese"]),
    ("indonesian", "Indonesian", "Bahasa Indonesia", A, "RRI, Prambors and Indonesian stations.", [{"language": "indonesian"}, {"language": "bahasa indonesia"}], ["indonesian", "bahasa indonesia"]),
    ("malay", "Malay", "Bahasa Melayu", A, "Stations from Malaysia, Brunei and Singapore.", [{"language": "malay"}, {"language": "bahasa melayu"}], ["malay", "bahasa melayu"]),
    ("filipino", "Filipino", "Filipino", A, "Tagalog and Filipino stations.", [{"language": "filipino"}, {"language": "tagalog"}], ["filipino", "tagalog"]),
    ("thai", "Thai", "ไทย", A, "Thai stations, live.", [{"language": "thai"}], ["thai"]),
    ("vietnamese", "Vietnamese", "Tiếng Việt", A, "VOV and Vietnamese stations.", [{"language": "vietnamese"}], ["vietnamese"]),
    ("sinhala", "Sinhala", "සිංහල", "India & South Asia", "Sinhala stations from Sri Lanka.", [{"language": "sinhala"}, {"language": "sinhalese"}], ["sinhala"]),
]
# existing collections move into the new groups
REGROUP = {"italian": E, "french": E, "korean": A}

NEWS = re.compile(r"\b(news|talk|sports?|politics?|current affairs|information|speech|business|nachrichten|noticias|actualités|notizie|info)\b", re.I)
DEVOT = re.compile(r"\b(religio\w*|christian|gospel|islam(ic)?|quran|qur'an|bhakti|bhajan|devotional|spiritual|church|catholic|worship|"
                   r"hindu|sikh|gurbani|kirtan|buddhis\w*|sufi|naat|jesus|bible|prayer|krishna|vedic|mantra|mosque|evangel\w*|orthodox)\b", re.I)


def clean(name: str) -> str:
    n = re.sub(r"\s*[\(\[][^)\]]*(\bk\b|kbps|mp3|aac\+?|hls|opus|flac|\bhd\b|stream|ogg|\d{2,3}k)[^)\]]*[\)\]]", "", name, flags=re.I)
    n = re.sub(r"\s+(HD Opus|Opus|MP3|AAC\+?|HLS|FLAC|\d{2,3}k(bps)?( mp3| aac)?)$", "", n, flags=re.I)
    n = re.sub(r"\s{2,}", " ", n).strip(" -–|·")
    n = n or name.strip()
    if not re.search(r"[\sA-Z]", n) and re.fullmatch(r"[a-z0-9\-_.]+", n):      # "radioname" / "radio-name" slugs
        n = re.sub(r"[-_.]+", " ", n).title()
    return n


def norm_url(u: str) -> str:
    u = u.strip()
    m = re.match(r"^https?://(?:stream-\d+|node-\d+)\.(?:zeno\.fm|zenolive\.com)/([a-z0-9]+)", u, re.I)
    if m:
        return "https://stream.zeno.fm/" + m.group(1)
    if u.lower().startswith("http://"):
        return "https://" + u[7:]
    return u


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "station"


def fetch(params: dict) -> list[dict]:
    params = dict(params)
    skip_cc = params.pop("_not", None)          # e.g. Latin American Spanish: leave out Spain
    q = dict(params, order="clickcount", reverse="true", hidebroken="true", limit="150")
    for host in ("de1", "fi1", "nl1", "at1"):
        try:
            rows = json.loads(cs.http_get(f"https://{host}.api.radio-browser.info/json/stations/search?" + urllib.parse.urlencode(q), timeout=30))
            return [r for r in rows if r.get("countrycode") != skip_cc]
        except Exception:  # noqa: BLE001
            continue
    return []


def category(r: dict) -> str:
    t = (r.get("tags") or "")
    if DEVOT.search(t + " " + r["name"]):
        return "devotional"
    if NEWS.search(t):
        return "news"
    return "music"


def candidates(queries: list[dict]) -> list[dict]:
    rows = [r for q in queries for r in fetch(q)]
    rows.sort(key=lambda r: -(r.get("clickcount") or 0))
    by_url, by_name, out = {}, {}, []
    for r in rows:
        raw = (r.get("url_resolved") or r.get("url") or "").strip()
        if not raw:
            continue
        u = norm_url(raw)
        name = clean(r.get("name") or "")
        nk = re.sub(r"[^\w]", "", name.lower())
        if not nk or u in by_url:
            continue
        if nk in by_name:
            by_name[nk]["streams"].append(u)
            by_url[u] = by_name[nk]
            continue
        st = {"name": name, "category": category(r), "streams": [u], "_cc": r.get("countrycode")}
        by_url[u] = by_name[nk] = st
        out.append(st)
        if len(out) >= CANDIDATES:
            break
    return out


def main() -> None:
    cols_path = cs.COLLECTIONS_JS
    head, cols = cs._json_array(cols_path.read_text(encoding="utf-8"), "window.RADIO_COLLECTIONS")
    have = {c["id"] for c in cols}
    for c in cols:
        if c["id"] in REGROUP:
            c["group"] = REGROUP[c["id"]]

    todo = [n for n in NEW if not (cs.STATIONS_DIR / f"{n[0]}.js").exists()]
    print(f"{len(todo)} collections to build")
    pool = {cid: candidates(q) for cid, _, _, _, _, q, _ in todo}
    urls = sorted({u for sts in pool.values() for st in sts for u in st["streams"]})
    print(f"testing {len(urls)} streams")
    with cf.ThreadPoolExecutor(max_workers=48) as ex:
        res = dict(zip(urls, ex.map(cs.test_stream, urls)))

    summary = []
    for cid, name, native, group, intro, _, rb in todo:
        keep = []
        for st in pool[cid]:
            st["streams"] = [u for u in st["streams"] if res.get(u, ("",))[0] == cs.OK]
            if st["streams"]:
                keep.append(st)
            if len(keep) >= CAP:
                break
        summary.append(f"{name}: {len(keep)} of {len(pool[cid])} candidates play")
        if len(keep) < 5:
            continue                     # too few to be worth a collection
        used = set()
        for st in keep:
            base = slug(st["name"]); i = base; k = 2
            while i in used:
                i = f"{base}-{k}"; k += 1
            used.add(i)
            st.pop("_cc", None)
            st_id = {"id": i}
            st_id.update(st)
            st.clear(); st.update(st_id)
        header = (f"/* {name} radio stations for radio.html — from radio-browser.info, kept only if the stream plays.\n"
                  "   Checked twice a day by scripts/check_streams.py (GitHub Actions).\n"
                  "   streams: tried in order; offline: set by the check when none work */\n")
        cs.save_stations(cs.STATIONS_DIR / f"{cid}.js", header, keep)
        if cid not in have:
            cols.append({"id": cid, "name": name, "native": native, "group": group, "intro": intro, "rb": rb,
                         "cats": [["music", "Music"], ["news", "News & talk"], ["devotional", "Devotional"]]})

    cols_path.write_text(head + "window.RADIO_COLLECTIONS = " + json.dumps(cols, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print("\n".join(summary))


if __name__ == "__main__":
    main()
