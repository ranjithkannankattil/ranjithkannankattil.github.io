import urllib.request, urllib.parse, re, sys, time
UA={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"}
def get(u):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=20); b=r.read(); return r.status,b.decode("utf-8","replace")
    except Exception as e: return str(e)[:80],""
def gn(path,ed):
    hl,gl,ce=ed
    return f"https://news.google.com/rss{path}{'&' if '?' in path else '?'}hl={hl}&gl={gl}&ceid={ce}"
def show(u):
    s,b=get(u); items=re.findall(r"<item>(.*?)</item>",b,re.S)
    srcs=[re.search(r'<source url="([^"]+)"',i) for i in items]
    print("##",s,len(items),u); 
    for i in items[:4]:
        t=re.search(r"<title>(.*?)</title>",i,re.S); src=re.search(r'<source url="([^"]+)">(.*?)</source>',i)
        print("   ",(t.group(1)[:90] if t else ""),"|",src.groups() if src else "")
    if items: print("   link:",re.search(r"<link>(.*?)</link>",items[0]).group(1)[:120]); print("   desc:",re.search(r"<description>(.*?)</description>",items[0],re.S).group(1)[:200])
    return items
EDS={"IN:en":("en-IN","IN","IN:en"),"IN:ml":("ml","IN","IN:ml"),"GB:en":("en-GB","GB","GB:en"),"IT:it":("it","IT","IT:it"),"CN:zh":("zh-CN","CN","CN:zh-Hans"),"HK:zh":("zh-HK","HK","HK:zh-Hant"),"KR:ko":("ko","KR","KR:ko"),"IN:hi":("hi","IN","IN:hi"),"IN:ta":("ta","IN","IN:ta"),"MZ:pt":("pt-PT","MZ","MZ:pt-150"),"FR:fr":("fr","FR","FR:fr")}
for k,e in EDS.items(): show(gn("",e))
show(gn("/headlines/section/topic/WORLD",EDS["IN:en"]))
for place,ed in [("Thrissur","IN:en"),("Kodungallur","IN:en"),("Swansea","GB:en"),("Qidong","IN:en"),("Milan","GB:en"),("Milano","IT:it")]:
    show(gn("/headlines/section/geo/"+urllib.parse.quote(place),EDS[ed]))
for q,ed in [('Kodungallur when:7d',"IN:en"),('കൊടുങ്ങല്ലൂർ',"IN:ml"),('തൃശൂർ site:mathrubhumi.com OR site:manoramaonline.com OR site:deshabhimani.com',"IN:ml"),('Swansea site:bbc.co.uk OR site:walesonline.co.uk',"GB:en"),('启东',"CN:zh"),('Qingdao',"GB:en")]:
    show(gn("/search?q="+urllib.parse.quote(q),EDS[ed]))
# direct feeds
for u in ["https://www.thehindu.com/news/national/feeder/default.rss","https://www.thehindu.com/news/cities/bangalore/feeder/default.rss","https://www.thehindu.com/news/national/kerala/feeder/default.rss","https://www.telegraphindia.com/feeds/rss.jsp?id=3","https://www.livemint.com/rss/news","https://www.thehindubusinessline.com/feeder/default.rss","https://feeds.bbci.co.uk/news/wales/south_west/rss.xml","https://feeds.bbci.co.uk/news/rss.xml","https://www.theguardian.com/uk/rss","https://www.mathrubhumi.com/cmlink/mathrubhumi-latest-news-1.5126","https://www.manoramaonline.com/news/latest-news.feeds.rss","https://www.deshabhimani.com/rss","https://www.corriere.it/rss/homepage.xml","https://milano.corriere.it/rss/homepage.xml","https://www.repubblica.it/rss/homepage/rss2.0.xml","https://www.ilpost.it/feed/","https://www.lemonde.fr/rss/une.xml","https://www.scmp.com/rss/91/feed","https://www.hani.co.kr/rss/","https://clubofmozambique.com/feed/","https://feeds.bbci.co.uk/zhongwen/simp/rss.xml"]:
    show(u)
# decoder
try:
    import subprocess; subprocess.run([sys.executable,"-m","pip","install","-q","googlenewsdecoder"])
    from googlenewsdecoder import gnewsdecoder
    s,b=get(gn("/search?q=Thrissur",EDS["IN:en"]))
    links=re.findall(r"<link>(https://news.google.com/[^<]+)</link>",b)[:3]
    for l in links:
        t=time.time(); d=gnewsdecoder(l,interval=0); print("DECODE",round(time.time()-t,2),d)
        if d.get("status"):
            s2,h=get(d["decoded_url"]); m=re.search(r'<meta[^>]+(?:property|name)="(?:og:description|description)"[^>]+content="([^"]+)"',h); print("  OG",s2,m.group(1)[:200] if m else None)
except Exception as e: print("decoder err",e)
