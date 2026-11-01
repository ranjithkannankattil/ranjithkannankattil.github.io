#!/usr/bin/env python3
"""Build the Expat Life Saver section.

Content lives in scripts/expat/<city>/<topic>.html (just the <section class="topic"> blocks).
This script wraps each one in the site shell and writes:

  expat/index.html                 the Expat Life Saver hub (one card per city)
  expat/milan/index.html           the Milan hub (topic cards, search, emergency numbers)
  expat/milan/<topic>.html         one page per topic, with breadcrumb, topic menu,
                                   "on this page" links and previous / next
  expat/milan/sources.html         every source used

To add a topic: write scripts/expat/milan/<id>.html, add it to TOPICS below, run
    python3 scripts/build_expat.py
and commit the generated pages. To add a city: add it to CITIES and give it a folder.
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / "expat"
OUT = ROOT / "expat"
UPDATED = "November 2026"
CSS_V = "3"
NAV_V = "13"

GROUPS = [
    ("m1", "M1", "Papers & money"),
    ("m2", "M2", "Home"),
    ("m3", "M3", "Getting around"),
    ("m4", "M4", "Health & family"),
    ("m5", "M5", "Everyday life"),
]

# id, group, title, short (menu label), blurb (card + page intro), search keywords
TOPICS = [
    ("arrival", "m1", "First 90 days", "First 90 days",
     "The ten things to do after you land, in the order that works, with a checklist that remembers your progress and the offices you'll visit.",
     "checklist arrival codice fiscale residenza anagrafe questura consulate india indonesia cie spid"),
    ("permits", "m1", "Visas & permits", "Visas & permits",
     "Which permesso di soggiorno you hold, the post-office kit, renewals, family reunification, the long-term EU permit and citizenship.",
     "permesso di soggiorno kit renewal rinnovo blue card family ricongiungimento citizenship cittadinanza long term"),
    ("tax", "m1", "Tax & money", "Tax & money",
     "Tax residence, the 50% impatriati regime, declaring foreign assets, the yearly tax calendar and opening a bank account.",
     "tax 730 impatriati quadro rw ivafe bank account iban fineco intesa cu"),
    ("americans", "m1", "Moving from the US", "Americans",
     "Visa routes for US citizens, filing US taxes from Italy (FBAR, FATCA, PFIC), Social Security, Medicare and the US Consulate in Milan.",
     "usa american visa digital nomad elective residence fbar fatca pfic irs social security medicare consulate"),
    ("housing", "m2", "Where to live", "Where to live",
     "Rent per square metre across Milan and the hinterland, and what each neighbourhood is like for singles, couples and families.",
     "rent neighbourhood area isola brera porta venezia citylife navigli citta studi monza price"),
    ("renting", "m2", "Renting a flat", "Renting",
     "Contract types (4+4, 3+2, transitorio), deposits, scams to avoid, setting up utilities and TARI, and moving out.",
     "contract lease 4+4 3+2 transitorio deposit cauzione agency scam utilities electricity gas tari broadband"),
    ("landlord", "m2", "Documents from your landlord", "Landlord documents",
     "The papers only the flat's owner can give you, for residence, the housing-suitability certificate your family's visas need, and the 48-hour hosting declaration.",
     "landlord owner proprietario documents idoneita alloggiativa housing suitability family reunification residence assenso planimetria ospitalita"),
    ("transport", "m3", "Public transport", "Public transport",
     "ATM fares and passes, tapping in with your card, airports, regional and high-speed trains, strikes and night service.",
     "atm metro tram bus ticket abbonamento contactless malpensa linate bergamo trenord strike sciopero"),
    ("driving", "m3", "Driving & licence", "Driving",
     "Which foreign licences convert, getting an Italian licence step by step, Area B and Area C, and the costs of owning a car.",
     "driving licence patente conversion india indonesia usa uk area b area c car insurance bollo autoscuola"),
    ("health", "m4", "Health card & hospitals", "Health & hospitals",
     "Emergency numbers, joining the SSN and getting the tessera sanitaria, choosing a GP, pharmacies, and Milan's main hospitals.",
     "health ssn tessera sanitaria hospital ospedale emergency 112 gp medico pharmacy farmacia pronto soccorso"),
    ("insurance", "m4", "Private insurance & Cigna", "Insurance & Cigna",
     "How Cigna direct billing works in Milan, employer health funds, other international and Italian insurers, and visa cover rules.",
     "cigna insurance direct billing allianz bupa axa generali unisalute fondo sanitario"),
    ("schools", "m4", "Schools", "Schools",
     "International schools with addresses and fees, Italian state schools, nurseries and how enrolment works.",
     "school international british american ib nursery nido kindergarten enrolment"),
    ("gyms", "m4", "Gyms", "Gyms",
     "Gyms open 24/7 with ratings, budget and premium chains, public sports centres, and the medical certificate gyms ask for.",
     "gym palestra 24/7 anytime fitness mcfit virgin active fitness"),
    ("apps", "m5", "Apps to install", "Apps",
     "Digital identity, health, transport, money, shopping and phone apps, with direct App Store, Google Play and official links.",
     "app download spid cie io atm satispay salutile sim iliad phone internet"),
    ("communities", "m5", "Communities", "Communities",
     "Where to meet people: expat networks, nationality associations, chambers of commerce and free Italian classes.",
     "community expat internations meetup association malayali indian indonesian filipino chinese american"),
    ("food", "m5", "Restaurants & food", "Restaurants",
     "Restaurants rated 4.5 or higher on Google across every cuisine, from Indian, Kerala and Sri Lankan to Milanese, pizza, Japanese and Lebanese, plus groceries from home.",
     "food restaurant indian kerala south indian banaras malabar taj mahal pasajo italian milanese pizza sushi japanese chinese korean thai vietnamese lebanese turkish greek peruvian mexican vegan vegetarian seafood steak burger brunch grocery"),
    ("language", "m5", "Language & customs", "Language & customs",
     "Survival Italian with pronunciation, how to learn Italian for free, and the unwritten rules of daily life in Milan.",
     "italian language phrases learn course cpia customs culture etiquette coffee"),
    ("missed", "m5", "Things people miss", "Often missed",
     "Documents to bring from home, family paperwork, heating rules, pets, insurance and other things newcomers find out too late.",
     "tips mistakes apostille documents pets heating"),
]
GROUP_OF = {t[0]: t[1] for t in TOPICS}

CITIES = [
    ("milan", "Milan", "Milano · Lombardia",
     "Permits, tax, homes, transport, driving, health, schools, gyms, apps, communities and customs."),
]

FONTS = ("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700"
         "&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap")

esc = html.escape


def head(title, desc, canonical, root):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)} — Ranjith Kannankattil</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="https://ranjithkb.com/{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ranjith Kannankattil">
<meta property="og:title" content="{esc(title)} — Ranjith Kannankattil">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="https://ranjithkb.com/{canonical}">
<meta name="twitter:card" content="summary">
<link rel="manifest" href="/site.webmanifest">
<link rel="icon" href="/assets/icons/site-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/icons/site-180.png">
<meta name="theme-color" content="#F0EDE6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16161A" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="{FONTS}" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="{FONTS}"></noscript>
<link rel="stylesheet" href="{root}css/style.css?v=13">
<link rel="stylesheet" href="{root}css/expat.css?v={CSS_V}">
</head>
<body data-section="expat">

<header class="titleblock">
  <div>
    <div class="id">RANJITH KANNANKATTIL</div>
    <div class="name">Expat Life Saver</div>
  </div>
  <nav class="tabs" data-root="{root}" data-active="expat" aria-label="Site">
    <a href="{root}index.html">Home</a>
    <a href="{root}writings.html">Writings</a>
    <a href="{root}photography/">Photography</a>
    <a href="{root}trip.html">Trip planner</a>
    <a href="{root}expat/" class="active">Expat Life Saver</a>
  </nav>
</header>

<main class="mg ex">
"""


def foot(root, extra_js=""):
    return f"""</main>

<footer>
  <div class="cheart">♡ <span id="year"></span> Ranjith Kannankattil · What I created here is free to copy — <a href="https://copyheart.org/" rel="noopener">copying is an act of love</a>. Others' work keeps its own terms.</div>
  <div class="foot-r"><span class="visits" id="visits" hidden></span><a href="mailto:hello@ranjithkb.com">hello@ranjithkb.com</a><a href="{root}privacy.html">Privacy</a></div>
</footer>

<script>document.getElementById('year').textContent = new Date().getFullYear();</script>
{extra_js}<script src="{root}js/nav.js?v={NAV_V}" defer></script>
<script src="{root}js/visits.js?v=2" defer></script>
</body>
</html>
"""


def bullet(gid, label=None):
    g = next(g for g in GROUPS if g[0] == gid)
    return f'<span class="bullet l{gid[1]}" aria-hidden="true">{label or g[1]}</span>'


def slugify(s):
    s = re.sub(r"<[^>]+>", "", s).lower().replace("&amp;", "and")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def topic_menu(current):
    """The 'All topics' dropdown: every topic, grouped by line."""
    rows = []
    for gid, code, gname in GROUPS:
        rows.append(f'<div class="ex-menu-g">{bullet(gid)}<span>{esc(gname)}</span></div>')
        for tid, g, title, short, *_ in TOPICS:
            if g != gid:
                continue
            cur = ' aria-current="page"' if tid == current else ""
            rows.append(f'<a href="{tid}.html"{cur}>{esc(title)}</a>')
    rows.append('<a class="ex-menu-all" href="./">Milan overview →</a>')
    return ('<details class="ex-menu"><summary><span>All Milan topics</span><i aria-hidden="true">▾</i></summary>'
            '<div class="ex-menu-pop">' + "".join(rows) + "</div></details>")


CHECKLIST_JS = """<script>
(function(){
  var KEY="milano-guide-checklist", saved={};
  try{ saved=JSON.parse(localStorage.getItem(KEY)||"{}")||{}; }catch(e){ saved={}; }
  var boxes=document.querySelectorAll("#checklist input"), prog=document.getElementById("prog");
  if(!boxes.length) return;
  function update(){
    var n=0;
    boxes.forEach(function(b){ if(b.checked) n++; b.closest("li").classList.toggle("done", b.checked); });
    prog.textContent=n+" of "+boxes.length+" done";
  }
  boxes.forEach(function(b){
    if(saved[b.id]) b.checked=true;
    b.addEventListener("change", function(){ saved[b.id]=b.checked; try{ localStorage.setItem(KEY, JSON.stringify(saved)); }catch(e){} update(); });
  });
  update();
})();
</script>
"""

HUB_JS = """<script>
(function(){
  var q=document.getElementById("ex-q"), cards=[].slice.call(document.querySelectorAll(".ex-card")),
      groups=[].slice.call(document.querySelectorAll(".ex-group")), none=document.getElementById("ex-none");
  if(!q) return;
  q.addEventListener("input", function(){
    var t=q.value.trim().toLowerCase(), shown=0;
    cards.forEach(function(c){ var ok=!t || c.getAttribute("data-k").indexOf(t)>-1; c.hidden=!ok; if(ok) shown++; });
    groups.forEach(function(g){ g.hidden=!g.querySelector(".ex-card:not([hidden])"); });
    none.hidden=shown>0;
  });
})();
</script>
"""


def build_topic(city, i):
    tid, gid, title, short, blurb, keys = TOPICS[i]
    body = (SRC / city / f"{tid}.html").read_text()
    # give every section an id for the "on this page" links
    heads = []
    def add_id(m):
        h3 = m.group(1)
        sid = slugify(h3)
        heads.append((sid, h3))
        return f'<section class="topic" id="{sid}">\n    <h3>{h3}</h3>'
    body = re.sub(r'<section class="topic"[^>]*>\s*<h3>(.*?)</h3>', add_id, body)
    gname = next(g[2] for g in GROUPS if g[0] == gid)
    prev_t = TOPICS[i - 1] if i > 0 else None
    next_t = TOPICS[i + 1] if i + 1 < len(TOPICS) else None
    toc = ""
    if len(heads) > 1:
        toc = ('<nav class="ex-toc" aria-label="On this page"><span>On this page</span>'
               + "".join(f'<a href="#{sid}">{h}</a>' for sid, h in heads) + "</nav>")
    pager = '<nav class="ex-pager" aria-label="More topics">'
    pager += (f'<a class="prev" href="{prev_t[0]}.html"><span>← Previous</span><b>{esc(prev_t[2])}</b></a>'
              if prev_t else '<span></span>')
    pager += '<a class="hub" href="./">All Milan topics</a>'
    pager += (f'<a class="next" href="{next_t[0]}.html"><span>Next →</span><b>{esc(next_t[2])}</b></a>'
              if next_t else '<span></span>')
    pager += "</nav>"
    page = head(f"{title} · Milan", blurb, f"expat/{city}/{tid}.html", "../../")
    page += f"""  <div class="ex-bar">
    <nav class="ex-crumb" aria-label="Breadcrumb"><a href="../">Expat Life Saver</a><span>/</span><a href="./">Milan</a><span>/</span><em>{esc(short)}</em></nav>
    {topic_menu(tid)}
  </div>

  <div class="ex-head">
    <div class="ex-eyebrow">{bullet(gid)}{esc(gname)}</div>
    <h1>{esc(title)}</h1>
    <p class="ex-intro">{esc(blurb)}</p>
    <p class="ex-updated">Checked {UPDATED} · rules change, so confirm fees and deadlines on the linked official pages</p>
  </div>
  {toc}

  <div class="line g{gid[1]}">
{body}
  </div>

  {pager}
  <p class="ex-src-link"><a href="sources.html">Sources for this guide</a></p>
"""
    js = CHECKLIST_JS if tid == "arrival" else ""
    page += foot("../../", js)
    (OUT / city / f"{tid}.html").write_text(page)


def build_city_hub(city, cname, sub, blurb):
    cards = []
    for gid, code, gname in GROUPS:
        items = []
        for tid, g, title, short, tblurb, keys in TOPICS:
            if g != gid:
                continue
            k = esc((title + " " + tblurb + " " + keys).lower())
            items.append(f'<a class="ex-card" href="{tid}.html" data-k="{k}"><b>{esc(title)}</b><span>{esc(tblurb)}</span></a>')
        cards.append(f'<section class="ex-group g{gid[1]}"><h2>{bullet(gid)}{esc(gname)}</h2><div class="ex-cards">{"".join(items)}</div></section>')
    page = head(f"Living in {cname}", f"Expat guide to {cname}: {blurb}", f"expat/{city}/", "../../")
    page += f"""  <div class="ex-bar">
    <nav class="ex-crumb" aria-label="Breadcrumb"><a href="../">Expat Life Saver</a><span>/</span><em>{esc(cname)}</em></nav>
  </div>

  <div class="hero">
    <div class="eyebrow">{esc(sub)} · a guide for expats</div>
    <h1>Living in <span>{esc(cname)}</span></h1>
    <p class="lede">{esc(blurb)} Each topic is one short page. Start with the first 90 days, or search for what you need.</p>
    <div class="linebar" aria-hidden="true"><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><i class="l5"></i></div>
  </div>

  <a class="ex-start" href="arrival.html"><span class="ex-start-k">Start here</span><b>First 90 days, in order</b><span>Permit, tax code, residence, health card, digital ID and bank, with a checklist that remembers your progress.</span><i aria-hidden="true">→</i></a>

  <div class="sos ex-sos" aria-label="Emergency numbers">
    <div><span class="n">112</span><span>Any emergency</span></div>
    <div><span class="n">116117</span><span>Doctor out of hours</span></div>
    <div><span class="n">+39 02 8057691</span><span>Consulate of India</span></div>
    <div><span class="n">+39 02 290351</span><span>US Consulate</span></div>
  </div>

  <div class="ex-find">
    <label for="ex-q">Find a topic</label>
    <input id="ex-q" type="search" placeholder="Try: licence, rent, Cigna, SIM, gym" autocomplete="off">
  </div>
  <p id="ex-none" class="muted" hidden>No topic matches. Try a shorter word.</p>

  {"".join(cards)}

  <p class="ex-also">Also on this site: <a href="../../expats/cinema.html">English-language films in Milan cinemas today</a></p>
  <p class="ex-src-link">Checked {UPDATED}. <a href="sources.html">All sources</a></p>
"""
    page += foot("../../", HUB_JS)
    (OUT / city / "index.html").write_text(page)


def build_sources(city, cname):
    body = (SRC / city / "sources.html").read_text()
    page = head(f"Sources · {cname}", f"Sources used for the {cname} expat guide.", f"expat/{city}/sources.html", "../../")
    page += f"""  <div class="ex-bar">
    <nav class="ex-crumb" aria-label="Breadcrumb"><a href="../">Expat Life Saver</a><span>/</span><a href="./">{esc(cname)}</a><span>/</span><em>Sources</em></nav>
    {topic_menu(None)}
  </div>
  <div class="ex-head"><h1>Sources</h1><p class="ex-intro">Official pages, press and expat forums used for this guide, checked {UPDATED}.</p></div>
  <div class="sources">{body}</div>
"""
    page += foot("../../")
    (OUT / city / "sources.html").write_text(page)


def build_root_hub():
    cards = "".join(
        f'<a class="ex-city" href="{cid}/"><span class="ex-city-k">{esc(sub)}</span><b>{esc(cname)}</b><span>{esc(blurb)}</span><i aria-hidden="true">→</i></a>'
        for cid, cname, sub, blurb in CITIES)
    page = head("Expat Life Saver", "Practical city guides for people moving abroad: permits, homes, health, transport, schools and everyday life.", "expat/", "../")
    page += f"""  <div class="hero">
    <div class="eyebrow">City guides for people who move</div>
    <h1>Expat <span>Life Saver</span></h1>
    <p class="lede">Practical guides for settling into a new city: the paperwork in the right order, where to live, getting around, health care, schools and the everyday things nobody tells you. Each city is split into short pages you can read in a few minutes.</p>
  </div>

  <section class="ex-group"><h2>Cities</h2><div class="ex-cities">{cards}</div></section>

  <section class="ex-group">
    <h2>Before any move</h2>
    <ul class="ex-before">
      <li><b>Apostille and translate</b> birth, marriage and degree certificates before you leave. It is slow and expensive from abroad.</li>
      <li><b>Scan everything</b> into one cloud folder: passports, visas, contracts, payslips, medical records.</li>
      <li><b>Keep your home phone number</b> alive (roaming or eSIM) so bank and government OTPs still reach you.</li>
      <li><b>Bring 3–6 months of costs</b>: deposits, agency fees and the gap before the first salary add up.</li>
      <li><b>Sort health cover from day one</b>, until the local public system enrols you.</li>
      <li><b>Learn 50 words</b> of the local language before you land. Greeting people in their language opens more doors than anything else.</li>
    </ul>
  </section>
"""
    page += foot("../")
    (OUT / "index.html").write_text(page)


def main():
    for cid, cname, sub, blurb in CITIES:
        (OUT / cid).mkdir(parents=True, exist_ok=True)
        for i in range(len(TOPICS)):
            build_topic(cid, i)
        build_city_hub(cid, cname, sub, blurb)
        build_sources(cid, cname)
    build_root_hub()
    print("built", len(TOPICS) + 2, "Milan pages and the hub")


if __name__ == "__main__":
    main()
