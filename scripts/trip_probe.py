import json, time, urllib.parse, urllib.request
UA={"User-Agent":"ranjithkb-trip-probe/1.0 (https://ranjithkb.com)","Accept":"application/sparql-results+json"}
def get(u, t=60):
    s=time.time()
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=t); return json.load(r), round(time.time()-s,1)
    except Exception as e: return {"err":str(e)[:200]}, round(time.time()-s,1)
ph,_=get("https://photon.komoot.io/api/?q=Sicily&limit=3&lang=en")
print("PHOTON", [(f["properties"].get("name"),f["properties"].get("osm_key"),f["properties"].get("osm_value"),f["properties"].get("type"),f["properties"].get("extent"),f["geometry"]["coordinates"]) for f in ph.get("features",[])])
f=ph["features"][0]; ext=f["properties"].get("extent")
w,n,e,s=ext if ext else (12.3,38.4,15.7,36.6)
for minsl in (22,16):
    q=f'''SELECT ?item ?itemLabel ?sl ?townLabel WHERE {{ SERVICE wikibase:box {{ ?item wdt:P625 ?c . bd:serviceParam wikibase:cornerWest "Point({w} {s})"^^geo:wktLiteral . bd:serviceParam wikibase:cornerEast "Point({e} {n})"^^geo:wktLiteral . }} ?item wikibase:sitelinks ?sl . FILTER(?sl >= {minsl}) ?item wdt:P31 ?type . OPTIONAL {{ ?item wdt:P131 ?town }} SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,mul". }} }} ORDER BY DESC(?sl) LIMIT 700'''
    r,t=get("https://query.wikidata.org/sparql?format=json&query="+urllib.parse.quote(q))
    b=r.get("results",{}).get("bindings",[]) if "err" not in r else []
    print("BOX minsl",minsl,"secs",t,"rows",len(b),r.get("err",""), [ (x["itemLabel"]["value"], x.get("townLabel",{}).get("value"), x["sl"]["value"]) for x in b[:25]])
sr,_=get("https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Sicily&language=en&type=item&limit=3&format=json")
print("QID", [(x["id"],x.get("label"),x.get("description")) for x in sr.get("search",[])])
qid=sr["search"][0]["id"]
q=f'''SELECT ?t ?tLabel ?pop WHERE {{ ?t wdt:P131+ wd:{qid} ; wdt:P1082 ?pop ; wdt:P625 ?c . ?t wdt:P31/wdt:P279* wd:Q486972 . SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,mul". }} }} ORDER BY DESC(?pop) LIMIT 14'''
r,t=get("https://query.wikidata.org/sparql?format=json&query="+urllib.parse.quote(q))
print("TOWNS secs",t, r.get("err",""), [(x["tLabel"]["value"],x["pop"]["value"]) for x in r.get("results",{}).get("bindings",[])])
