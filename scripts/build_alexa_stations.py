#!/usr/bin/env python3
"""Station list for the Radio Velvet Alexa skill.

Alexa plays only secure streams (https on port 443), so this keeps the stations that have one, in the same order
as the site (Malayalam first), and writes:
  js/alexa-stations.json                 the list the skill reads every hour (no redeploy needed for new stations)
  alexa/skill-package/interactionModels/custom/<locale>.json
                                         the voice model: station and language names Alexa should listen for
Runs from GitHub Actions after the stream checks (no Claude). Station logos are NOT used: they may only appear on
Android Auto.
"""
import json, os, re, sys, glob, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCALES = ["en-IN", "en-GB", "en-US", "en-AU", "en-CA"]
INVOCATION = "radio velvet"


def load_js_array(path, start="["):
    t = open(path, encoding="utf-8").read()
    return json.loads(t[t.index(start):t.rindex(start == "[" and "]" or "}") + 1])


def secure(urls):
    out = []
    for u in urls or []:
        p = urllib.parse.urlparse(u)
        if p.scheme == "https" and p.port in (None, 443) and p.hostname:
            out.append(u)
    return out


NUM = {0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine",
       10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen", 16: "sixteen",
       17: "seventeen", 18: "eighteen", 19: "nineteen", 20: "twenty", 30: "thirty", 40: "forty", 50: "fifty",
       60: "sixty", 70: "seventy", 80: "eighty", 90: "ninety"}


def say_number(tok):
    """'94.3' -> 'ninety four point three', '104' -> 'one oh four' style is too varied; keep plain words."""
    def whole(n):
        n = int(n)
        if n < 20: return NUM[n]
        if n < 100: return NUM[n - n % 10] + ("" if n % 10 == 0 else " " + NUM[n % 10])
        if n < 1000: return NUM[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + whole(n % 100))
        return " ".join(NUM[int(d)] for d in str(n))
    if re.fullmatch(r"\d+\.\d+", tok):
        a, b = tok.split(".")
        return whole(a) + " point " + " ".join(NUM[int(d)] for d in b)
    if re.fullmatch(r"\d+", tok): return whole(tok)
    return tok


def spoken(name):
    """How people may say a station: the name, without its frequency, without 'Radio'."""
    base = re.sub(r"[^\w\s.&'+-]", " ", name, flags=re.U)
    base = re.sub(r"\s+", " ", base).strip()
    out = {base}
    nofreq = re.sub(r"\b\d{2,3}(\.\d{1,2})?\b", "", base).strip(" -")
    nofreq = re.sub(r"\s+", " ", nofreq)
    if len(nofreq) >= 3: out.add(nofreq)
    out.add(" ".join(say_number(t) for t in base.split()))
    for x in list(out):
        y = re.sub(r"^radio\s+", "", x, flags=re.I)
        if len(y) >= 3 and y.lower() not in ("fm", "am"): out.add(y)
    clean = set()
    for x in out:
        x = x.replace("&", " and ").replace("+", " plus ")
        x = re.sub(r"[^\w\s.'-]", " ", x, flags=re.U)
        x = re.sub(r"\s+", " ", x).strip().lower()
        if 2 <= len(x) <= 140: clean.add(x)
    return sorted(clean)


def main():
    cols = load_js_array(os.path.join(ROOT, "js/collections.js"))
    order = ["malayalam"] + [c["id"] for c in cols if c["id"] != "malayalam"]
    names = {c["id"]: c["name"] for c in cols}
    stations, langs = [], []
    for cid in order:
        f = os.path.join(ROOT, "js/stations", cid + ".js")
        if not os.path.exists(f): continue
        n = 0
        for s in load_js_array(f):
            if s.get("offline"): continue
            urls = secure(s.get("streams"))
            if not urls: continue
            row = {"c": cid, "id": s["id"], "n": s["name"], "u": urls[:3]}
            if s.get("geo"): row["g"] = s["geo"]
            stations.append(row); n += 1
        if n: langs.append({"id": cid, "n": names.get(cid, cid)})
    data = {"v": 1, "note": "Radio Velvet for Alexa: stations with secure streams, site order. Built by scripts/build_alexa_stations.py.",
            "langs": langs, "st": stations}
    out = os.path.join(ROOT, "js/alexa-stations.json")
    json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    # ---- voice model: station names (with ways people say them) and languages
    seen, values = {}, []
    for s in stations:
        # Alexa's English voice model takes names in Latin letters only (Arabic, Chinese… names still play by language / next)
        if not re.fullmatch(r"[A-Za-z0-9 .,&'+()!?:/\-]+", s["n"]): continue
        sp = spoken(s["n"])
        if not sp: continue
        key = sp[0]
        if key in seen: continue
        seen[key] = 1
        values.append({"id": f'{s["c"]}:{s["id"]}', "name": {"value": s["n"].replace("&", "and")[:140],
                       "synonyms": [x for x in sp if x != s["n"].lower()][:12]}})
    lang_values = []
    for l in langs:
        nm = l["n"]; syn = {nm.lower(), nm.lower().replace("-", " ")}
        base = re.sub(r"\s*\(.*\)", "", nm).strip().lower()
        syn.add(base)
        if l["id"] == "english-music": syn.add("english")
        lang_values.append({"id": l["id"], "name": {"value": nm, "synonyms": sorted(x for x in syn if x != nm.lower())}})
    model = json.load(open(os.path.join(ROOT, "alexa/model-template.json"), encoding="utf-8"))
    model["interactionModel"]["languageModel"]["invocationName"] = INVOCATION
    for t in model["interactionModel"]["languageModel"]["types"]:
        if t["name"] == "STATION": t["values"] = values
        if t["name"] == "LANGUAGE": t["values"] = lang_values
    d = os.path.join(ROOT, "alexa/skill-package/interactionModels/custom")
    os.makedirs(d, exist_ok=True)
    for loc in LOCALES:
        json.dump(model, open(os.path.join(d, loc + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ml = sum(1 for s in stations if s["c"] == "malayalam")
    print(f"{len(stations)} stations with secure streams ({ml} Malayalam), {len(langs)} languages, {len(values)} spoken names")


if __name__ == "__main__":
    sys.exit(main())
