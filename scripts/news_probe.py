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
    pass
def _show(u):
    s,b=get(u); items=re.findall(r"<item>(.*?)</item>",b,re.S)
    srcs=[re.search(r'<source url="([^"]+)"',i) for i in items]
    print("##",s,len(items),u); 
    for i in items[:4]:
        t=re.search(r"<title>(.*?)</title>",i,re.S); src=re.search(r'<source url="([^"]+)">(.*?)</source>',i)
        print("   ",(t.group(1)[:90] if t else ""),"|",src.groups() if src else "")
    if items: print("   link:",re.search(r"<link>(.*?)</link>",items[0]).group(1)[:120]); print("   desc:",re.search(r"<description>(.*?)</description>",items[0],re.S).group(1)[:200])
    return items
EDS={"IN:en":("en-IN","IN","IN:en"),"IN:ml":("ml","IN","IN:ml"),"GB:en":("en-GB","GB","GB:en"),"IT:it":("it","IT","IT:it"),"CN:zh":("zh-CN","CN","CN:zh-Hans"),"HK:zh":("zh-HK","HK","HK:zh-Hant"),"KR:ko":("ko","KR","KR:ko"),"IN:hi":("hi","IN","IN:hi"),"IN:ta":("ta","IN","IN:ta"),"MZ:pt":("pt-PT","MZ","MZ:pt-150"),"FR:fr":("fr","FR","FR:fr")}
# decoder
try:
    import subprocess; subprocess.run([sys.executable,"-m","pip","install","-q","googlenewsdecoder"])
    from googlenewsdecoder import gnewsdecoder
    s,b=get(gn("/search?q=Thrissur",EDS["IN:en"]))
    links=re.findall(r"<link>(https://news.google.com/[^<]+)</link>",b)[:12]
    for l in links:
        t=time.time(); d=gnewsdecoder(l,interval=0); print("DECODE",round(time.time()-t,2),d)
        if d.get("status"):
            s2,h=get(d["decoded_url"]); m=re.search(r'<meta[^>]+(?:property|name)="(?:og:description|description)"[^>]+content="([^"]+)"',h); print("  OG",s2,m.group(1)[:200] if m else None)
except Exception as e: print("decoder err",e)
