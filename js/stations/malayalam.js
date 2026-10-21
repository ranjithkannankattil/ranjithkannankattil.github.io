/* Malayalam radio stations for radio.html.
   Checked and updated daily by scripts/check_streams.py (GitHub Actions).
   category: air | fm | online | artist | devotional
   streams: tried in order until one plays; working ones are moved first
   offline: set by the daily check when no stream works (station stays listed)
   exclude: streams the daily check must never add back (wrong station)
   akv: name in the Akashvani station list, used to pick up new official links */
window.STATIONS = [
  {
    "id": "radiomirchimalayalam",
    "name": "Mirchi Kochi",
    "category": "fm",
    "streams": [
      "https://stream.aiir.com/dbv0rxpwp6ytv",
      "https://sp14.instainternet.com/8050/stream"
    ]
  },
  {
    "id": "clubfm",
    "name": "Club FM",
    "category": "fm",
    "streams": [
      "https://listen.openstream.co/4626/audio"
    ]
  },
  {
    "id": "radiomango",
    "name": "Radio Mango",
    "category": "fm",
    "streams": [
      "https://listen.openstream.co/4635/audio",
      "https://radiomangoalive1-a.akamaihd.net/9268677ef77949a9b21d33239a55eadd/ap-southeast-1/6034685947001/playlist.m3u8"
    ],
    "offline": true,
    "exclude": [
      "https://eu10.fastcast4u.com/clubfmuae"
    ]
  },
  {
    "id": "homefm",
    "name": "Home FM",
    "category": "fm",
    "streams": [
      "https://centova.aarenworld.com/proxy/922radiokhushi/stream"
    ]
  },
  {
    "id": "radiosunomalayalam",
    "name": "Radio Suno",
    "category": "fm",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/SUNO917_SC"
    ]
  },
  {
    "id": "radiosunobahrain",
    "name": "Suno Bahrain",
    "category": "fm",
    "streams": [
      "https://osrnstream.olivesuno.com/suno876.mp3"
    ]
  },
  {
    "id": "ananthapurifm",
    "name": "AIR Ananthapuri FM",
    "category": "air",
    "streams": [
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio229/playlist.m3u8"
    ]
  },
  {
    "id": "radiokeralam",
    "name": "Radio Keralam",
    "category": "online",
    "streams": [
      "https://ice31.securenetsystems.net/RADIOKERAL"
    ]
  },
  {
    "id": "986malayalamradio",
    "name": "98.6 FM",
    "category": "fm",
    "streams": [
      "https://stream.qfmradio.qa/986fm",
      "https://stream.zeno.fm/512rbf1e3qzuv"
    ]
  },
  {
    "id": "livefm1072",
    "name": "Live FM 1072",
    "category": "fm",
    "streams": [
      "https://stream.aiir.com/dbv0rxpwp6ytv"
    ]
  },
  {
    "id": "radiolemonlive",
    "name": "Radio Lemon",
    "category": "online",
    "streams": [
      "https://live.sarrit.com:8040/radio.mp3"
    ]
  },
  {
    "id": "airmalayalam",
    "name": "AIR Malayalam",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/6ff13de7ea9b53d7/6ff13de7ea9b53d7.m3u8"
    ],
    "akv": "Akashvani Kerala",
    "exclude": [
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio230/playlist.m3u8"
    ]
  },
  {
    "id": "kochifm",
    "name": "AIR Kochi FM",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/70400e7510e87cdf/70400e7510e87cdf.m3u8",
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio045/playlist.m3u8",
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio044/playlist.m3u8"
    ],
    "freq": "102.3 FM",
    "akv": "Akashvani Kochi",
    "offline": true
  },
  {
    "id": "fmrainbowkochi",
    "name": "AIR FM Rainbow Kochi",
    "category": "air",
    "freq": "107.5 FM",
    "streams": [
      "https://radio.wavespb.com/live/7df6f2a8c3c4d33b/7df6f2a8c3c4d33b.m3u8"
    ],
    "akv": "FM Rainbow Kochi",
    "offline": true
  },
  {
    "id": "aircalicut",
    "name": "AIR Kozhikode (Calicut)",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/8321393de70015fc/8321393de70015fc.m3u8"
    ],
    "akv": "Akashvani Calicut"
  },
  {
    "id": "vbmalayalam",
    "name": "Vividh Bharati Malayalam",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/ad3a8436a329e2d6/ad3a8436a329e2d6.m3u8"
    ],
    "akv": "VB MALAYALAM"
  },
  {
    "id": "airalappuzha",
    "name": "AIR Alappuzha",
    "category": "air",
    "streams": [
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio230/playlist.m3u8"
    ]
  },
  {
    "id": "airdevikulam",
    "name": "AIR Devikulam",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/e97acc829da9bf2a/e97acc829da9bf2a.m3u8"
    ],
    "akv": "Akashvani Devikulam",
    "exclude": [
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio230/playlist.m3u8"
    ],
    "offline": true
  },
  {
    "id": "airkozhikodefm",
    "name": "AIR Kozhikode FM",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/b69c296065db7627/b69c296065db7627.m3u8",
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio083/playlist.m3u8"
    ],
    "akv": "Akashvani Kozhikode Real FM"
  },
  {
    "id": "radio90fm",
    "name": "Radio 90 FM",
    "category": "online",
    "streams": [
      "https://ice42.securenetsystems.net/CR90?type=.mp3"
    ]
  },
  {
    "id": "radiokerala",
    "name": "Radio Kerala",
    "category": "online",
    "streams": [
      "https://streaming.radiokerala.in/listen/radio_kerala/radio.mp3"
    ]
  },
  {
    "id": "nammuderadio",
    "name": "Nammude Radio",
    "category": "online",
    "streams": [
      "https://stream.nammude.uk/listen/nammude_uk/live",
      "https://das-edge16-live365-dal02.cdnstream.com/a39171"
    ]
  },
  {
    "id": "myradio90fm",
    "name": "My Radio FM",
    "category": "online",
    "streams": [
      "https://cast1.my-control-panel.com/proxy/myradio90fm/stream"
    ]
  },
  {
    "id": "airkannur",
    "name": "AIR Kannur",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/b82c91a395fc4a7d/b82c91a395fc4a7d.m3u8"
    ],
    "akv": "Akashvani Kannur",
    "offline": true
  },
  {
    "id": "helloradio",
    "name": "Hello Radio",
    "category": "online",
    "streams": [
      "https://radio.helloradio.in/radio"
    ]
  },
  {
    "id": "radiobenziger",
    "name": "Benziger FM",
    "category": "online",
    "streams": [
      "https://icecast.octosignals.com/benziger"
    ]
  },
  {
    "id": "aahafmradio",
    "name": "Aaha FM",
    "category": "online",
    "streams": [
      "https://s2.radio.co/s3801784f1/listen"
    ]
  },
  {
    "id": "manjerifm",
    "name": "AIR Manjeri FM",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/58390a2ed33cea4a/58390a2ed33cea4a.m3u8"
    ],
    "akv": "Akashvani Manjeri",
    "offline": true
  },
  {
    "id": "akashvanithrissur",
    "name": "AIR Thrissur",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/f70fdeca437dc326/f70fdeca437dc326.m3u8"
    ],
    "freq": "630 AM",
    "akv": "Akashvani Thrissur",
    "exclude": [
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio230/playlist.m3u8"
    ],
    "offline": true
  },
  {
    "id": "radioneythal",
    "name": "Radio Neythal",
    "category": "online",
    "streams": [
      "https://s2.myradiostream.com/5538/listen.mp3"
    ],
    "offline": true
  },
  {
    "id": "radiomattoli",
    "name": "Radio Mattoli",
    "category": "online",
    "streams": [
      "https://cast1.my-control-panel.com/proxy/radiomattoli/stream"
    ]
  },
  {
    "id": "enteradio",
    "name": "Ente Radio",
    "category": "online",
    "streams": [
      "https://cast1.my-control-panel.com/proxy/enteradio/stream"
    ]
  },
  {
    "id": "janvanifm",
    "name": "Janvani FM",
    "category": "online",
    "streams": [
      "https://radiosavre.com:8060/radio.mp3",
      "http://centova87.instainternet.com:8272/;"
    ]
  },
  {
    "id": "radiomacfast",
    "name": "Radio Macfast",
    "category": "online",
    "streams": [
      "https://icecast.octosignals.com/radiomacfast"
    ],
    "offline": true
  },
  {
    "id": "globalradio",
    "name": "Global Radio",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/epyhxgc1y8huv",
      "https://stream.zeno.fm/epyhxgc1y8huv.mp3"
    ]
  },
  {
    "id": "radiomalabar",
    "name": "Radio Malabar",
    "category": "online",
    "streams": [
      "https://d98pmgd7by0qx.cloudfront.net/radiomalabar.m3u8",
      "https://streamasiacdn.atc-labs.com/radiomalabar.aac"
    ]
  },
  {
    "id": "ahaliafm",
    "name": "Ahalia FM",
    "category": "online",
    "streams": [
      "https://cast1.my-control-panel.com/proxy/ahaliafm/stream"
    ]
  },
  {
    "id": "junefm",
    "name": "June FM",
    "category": "online",
    "streams": [
      "https://onair.junefm.in/live"
    ]
  },
  {
    "id": "radiomangalam",
    "name": "Radio Mangalam",
    "category": "online",
    "streams": [
      "http://radiomangalam.in:8000/stream"
    ],
    "offline": true
  },
  {
    "id": "sargakshetrafm",
    "name": "Sargakshetra FM",
    "category": "online",
    "streams": [
      "https://icecast.octosignals.com/sargakshetrafm",
      "https://edge.mixlr.com/channel/ugbfe"
    ]
  },
  {
    "id": "radiomediavillage",
    "name": "Radio Media Village",
    "category": "online",
    "streams": [
      "https://443-1.autopo.st/183/stream",
      "https://cp3.shoutcheap.com:18145/stream"
    ]
  },
  {
    "id": "radiokochi",
    "name": "Radio Kochi",
    "category": "online",
    "streams": [
      "https://d3caeelfr0kslf.cloudfront.net/radiokochi.m3u8"
    ]
  },
  {
    "id": "radio4u",
    "name": "Radio 4U",
    "category": "online",
    "streams": [
      "https://a5.asurahosting.com:7450/radio.mp3"
    ]
  },
  {
    "id": "ashrayafm",
    "name": "Ashraya FM",
    "category": "online",
    "streams": [
      "https://fm.ashrayafm90.com/ashrayafm"
    ]
  },
  {
    "id": "radiodigitalmalayali",
    "name": "Digital Malayali",
    "category": "online",
    "streams": [
      "https://radio.digitalmalayali.in/listen/stream/radio.mp3"
    ]
  },
  {
    "id": "radionellika",
    "name": "Radio Nellika",
    "category": "online",
    "streams": [
      "https://usa10.fastcast4u.com:8110/;?type=http&nocache=3"
    ],
    "offline": true
  },
  {
    "id": "lmrradio",
    "name": "LMR Radio",
    "category": "online",
    "streams": [
      "https://ais-edge51-live365-dal02.cdnstream.com/a50671"
    ]
  },
  {
    "id": "chitrahitsmalayalam",
    "name": "KS Chitra Hits",
    "category": "artist",
    "streams": [
      "https://stream.zeno.fm/dubvcz3rkrhvv"
    ]
  },
  {
    "id": "mohanlalhits",
    "name": "Mohanlal Hits",
    "category": "artist",
    "streams": [
      "https://stream.zeno.fm/5vva7u4ts0quv"
    ]
  },
  {
    "id": "kjyesudas",
    "name": "KJ Yesudas Hits",
    "category": "artist",
    "streams": [
      "https://stream.zeno.fm/9x1sw687nf9uv"
    ]
  },
  {
    "id": "radiomallu",
    "name": "Radio Mallu",
    "category": "online",
    "streams": [
      "https://usa15.fastcast4u.com/proxy/radiomall/stream"
    ],
    "offline": true
  },
  {
    "id": "radiomate",
    "name": "Radio Mate",
    "category": "online",
    "streams": [
      "https://live.sarrit.com:8140/lemonaustralia"
    ]
  },
  {
    "id": "radiolimemalayalam",
    "name": "Radio Lime",
    "category": "online",
    "streams": [
      "https://s5.radio.co/s6e27496ef/listen"
    ]
  },
  {
    "id": "recastfm",
    "name": "Recast FM",
    "category": "online",
    "streams": [
      "https://usa8.fastcast4u.com/proxy/auralradio?mp=/1/;stream.mp3"
    ]
  },
  {
    "id": "premamfm",
    "name": "Premam FM",
    "category": "online",
    "streams": [
      "https://fm.thamizhinifm.com/listen/premamfm/radio.mp3"
    ]
  },
  {
    "id": "radiodelhimalayalam",
    "name": "Radio Delhi",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/ap5sacmsn7zuv"
    ]
  },
  {
    "id": "paattupetti",
    "name": "Paattupetti",
    "category": "online",
    "streams": [
      "https://streamer.radio.co/s8d5f06a3d/listen"
    ],
    "offline": true
  },
  {
    "id": "malayalammusic",
    "name": "Music FM",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/g8cx7tggb3quv.aac"
    ]
  },
  {
    "id": "radioonattukara",
    "name": "Onattukara",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/fu94u25kqd0uv"
    ]
  },
  {
    "id": "radioshree",
    "name": "Radio Shree",
    "category": "online",
    "streams": [
      "https://eu10.fastcast4u.com:14910/;",
      "https://usa19.fastcast4u.com:6270/stream",
      "http://server.geetradio.com:8020/radio.mp3"
    ]
  },
  {
    "id": "karunasairadio",
    "name": "Karunasai Radio",
    "category": "online",
    "streams": [
      "https://streamasiahlscdn.atc-labs.com/karunasairadio.m3u8"
    ]
  },
  {
    "id": "radiomalayalam",
    "name": "Radio Malayalam",
    "category": "online",
    "streams": [
      "https://radiomalayalamfm.com/radio/8000/radio.mp3"
    ]
  },
  {
    "id": "pranayamradio",
    "name": "Pranayam Radio",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/g2zves9gdwzuv"
    ]
  },
  {
    "id": "radiosallapam",
    "name": "Radio Sallapam",
    "category": "online",
    "streams": [
      "https://sallapambyasset.com/api/Stream/Live"
    ]
  },
  {
    "id": "radiolalsalam",
    "name": "Radio Lalsalam",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/f3nc8x3tywzuv"
    ],
    "offline": true
  },
  {
    "id": "arradio",
    "name": "AR Radio",
    "category": "online",
    "streams": [
      "https://free.rcast.net/200660",
      "https://stream.zeno.fm/heq754gwxwzuv"
    ]
  },
  {
    "id": "radiomythri",
    "name": "Radio Mythri",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/ekthuu9bfwzuv"
    ]
  },
  {
    "id": "keralafm",
    "name": "Kerala FM",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/mfn3gkbvty8uv"
    ],
    "offline": true
  },
  {
    "id": "radiobeatmalayalamhd",
    "name": "Radio Beats",
    "category": "online",
    "streams": [
      "https://listen.openstream.co/6761/audio"
    ]
  },
  {
    "id": "tcrliveradio",
    "name": "TCR Live",
    "category": "online",
    "streams": [
      "https://centova71.instainternet.com/proxy/tcrliveradio?mp=/stream"
    ],
    "offline": true
  },
  {
    "id": "kaathoramlive",
    "name": "Kaathoram",
    "category": "online",
    "streams": [
      "https://c30.radioboss.fm/stream/560"
    ]
  },
  {
    "id": "auralmelodies",
    "name": "Aural Melodies",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/7fmywrmrga0uv"
    ]
  },
  {
    "id": "deshavanifm",
    "name": "Deshavani FM",
    "category": "online",
    "streams": [
      "https://fm.saksoftlabs.com/radio.mp3"
    ],
    "offline": true
  },
  {
    "id": "radiome",
    "name": "Radio Me",
    "category": "online",
    "streams": [
      "https://freestream.hu:8340/radiome"
    ]
  },
  {
    "id": "thaalamradio",
    "name": "Thaalam Radio",
    "category": "online",
    "streams": [
      "https://thaalam.tamilfmradios.com/live"
    ],
    "offline": true
  },
  {
    "id": "omrradio",
    "name": "OMR Radio",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/x2baeup395quv"
    ],
    "offline": true
  },
  {
    "id": "radiotirur",
    "name": "Tirur Radio",
    "category": "online",
    "streams": [
      "https://sonic01.instainternet.com/8002/stream"
    ]
  },
  {
    "id": "radiovatakara",
    "name": "Radio Vatakara",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/9k5ku7bhb8zuv"
    ],
    "offline": true
  },
  {
    "id": "mazhavilfm",
    "name": "Mazhavil FM",
    "category": "online",
    "streams": [
      "https://live.sarrit.com:8010/mazhavilfm"
    ],
    "offline": true
  },
  {
    "id": "radiosarangi",
    "name": "Radio Sarangi",
    "category": "online",
    "streams": [
      "https://radiosarangi.logichost.in/listen/sarangi/radio.mp3"
    ]
  },
  {
    "id": "radiovoxa",
    "name": "Radio Voxa",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/zrfx7zy2wwzuv.aac"
    ]
  },
  {
    "id": "auralradio",
    "name": "Aural Radio",
    "category": "online",
    "streams": [
      "https://live.auralradiokerala.in/auralradio/mp3",
      "https://radio.auralradiokerala.com:1330/;?type=http&nocache=1723445732"
    ]
  },
  {
    "id": "pravasibharathi",
    "name": "Pravasi Bharathi",
    "category": "online",
    "streams": [
      "https://c30.radioboss.fm:8964/stream",
      "https://c4.radioboss.fm:8547/autodj"
    ]
  },
  {
    "id": "radiocafe",
    "name": "Radio Cafe",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/gqmh0caknchvv"
    ],
    "offline": true
  },
  {
    "id": "radiopalakkad",
    "name": "Radio Palakkad",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/qgqrxfte41zuv"
    ]
  },
  {
    "id": "ragamradio",
    "name": "Ragam Radio",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/xwlwqmiogncvv"
    ],
    "offline": true
  },
  {
    "id": "radioutsav",
    "name": "Radio Utsav",
    "category": "online",
    "streams": [
      "http://82.145.63.6:6094/mp=/stream"
    ],
    "offline": true
  },
  {
    "id": "kancheeravamradio",
    "name": "Kancheeravam",
    "category": "online",
    "streams": [
      "https://radiosavre.com:8020/radio.mp3"
    ]
  },
  {
    "id": "rafaradio",
    "name": "Rafa Radio",
    "category": "devotional",
    "streams": [
      "https://gains.reviveradio.net/proxy/rafaradio?mp=/stream"
    ]
  },
  {
    "id": "menorahradio",
    "name": "Menorah Radio",
    "category": "devotional",
    "streams": [
      "https://gains.reviveradio.net/proxy/menorah?mp=/stream"
    ],
    "offline": true
  },
  {
    "id": "dvnradio",
    "name": "DVN Radio",
    "category": "devotional",
    "streams": [
      "https://ice31.securenetsystems.net/DVN"
    ]
  },
  {
    "id": "psalmsradio",
    "name": "Psalms Radio",
    "category": "devotional",
    "streams": [
      "https://s2.citrus3.com:8046/stream"
    ]
  },
  {
    "id": "shalomradio",
    "name": "Shalom Radio",
    "category": "devotional",
    "streams": [
      "https://stream.radio.co/s1383afdc9/listen?ver=828256"
    ],
    "offline": true
  },
  {
    "id": "reviveradiomalayalam",
    "name": "Revive Radio",
    "category": "devotional",
    "streams": [
      "https://gains.reviveradio.net/proxy/revivemalayalam?mp=/stream"
    ]
  },
  {
    "id": "radiowind",
    "name": "Radio Wind",
    "category": "devotional",
    "streams": [
      "https://stream.radio.co/s9015a8e16/listen"
    ],
    "offline": true
  },
  {
    "id": "radioangelos",
    "name": "Radio Angelos",
    "category": "devotional",
    "streams": [
      "https://s7.voscast.com:9563/stream"
    ],
    "offline": true
  },
  {
    "id": "bafaradio",
    "name": "Bafa Radio",
    "category": "devotional",
    "streams": [
      "https://gains.reviveradio.net/proxy/bafaradio/stream"
    ]
  },
  {
    "id": "worldtoworldradio",
    "name": "World to World",
    "category": "devotional",
    "streams": [
      "https://streaming.radio.co/s4f2cc35de/listen"
    ]
  },
  {
    "id": "ephphatharadio",
    "name": "Ephphatha",
    "category": "devotional",
    "streams": [
      "https://ephphatha.radioca.st/stream"
    ]
  },
  {
    "id": "amenradio",
    "name": "Amen Radio",
    "category": "devotional",
    "streams": [
      "https://ice7.securenetsystems.net/AMENFM"
    ]
  },
  {
    "id": "marymatharadio",
    "name": "Mary Matha",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/g5ay9q4dgrruv"
    ]
  },
  {
    "id": "greenradio",
    "name": "Green Radio",
    "category": "devotional",
    "streams": [
      "http://108.170.51.230:8010/stream"
    ],
    "offline": true
  },
  {
    "id": "luminousradiomalayalam",
    "name": "Luminous FM",
    "category": "devotional",
    "streams": [
      "https://patmos.cdnstream.com/proxy/luminous/?mp=/stream"
    ]
  },
  {
    "id": "tharangamradio",
    "name": "Tharangam",
    "category": "devotional",
    "streams": [
      "https://usa14.fastcast4u.com/proxy/bobbygeo?mp=/;"
    ],
    "offline": true
  },
  {
    "id": "radiomaria",
    "name": "Radio Maria",
    "category": "devotional",
    "streams": [
      "https://dreamsiteradiocp2.com/proxy/rmindia1?mp=/stream"
    ],
    "offline": true
  },
  {
    "id": "puthiyerushalemradio",
    "name": "Puthiyerushalem",
    "category": "devotional",
    "streams": [
      "https://streams.radio.co/s4e89ff5bd/listen"
    ],
    "offline": true
  },
  {
    "id": "muthnabiradio",
    "name": "Muthnabi",
    "category": "devotional",
    "streams": [
      "https://cast4.my-control-panel.com/proxy/muthnabi/stream"
    ]
  },
  {
    "id": "peaceradio",
    "name": "Peace Radio",
    "category": "devotional",
    "streams": [
      "https://peaceradio.out.airtime.pro/peaceradio_a"
    ]
  },
  {
    "id": "radioislam",
    "name": "Radio Islam",
    "category": "devotional",
    "streams": [
      "https://radioislamin.out.airtime.pro/radioislamin_a"
    ]
  },
  {
    "id": "quranradiomalayalam",
    "name": "Quran Radio",
    "category": "devotional",
    "streams": [
      "https://server03.quran-uni.com:7029/stream"
    ],
    "offline": true
  },
  {
    "id": "radioilmussalaf",
    "name": "Ilmussalaf Radio",
    "category": "devotional",
    "streams": [
      "https://darhdth.radioca.st/stream"
    ]
  },
  {
    "id": "radioayyappa",
    "name": "Radio Ayyappa",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/rdcci38kky4vv"
    ],
    "offline": true
  },
  {
    "id": "malayalambhakthiradio",
    "name": "Bhakthi Radio",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/08e1vkshcc9uv"
    ]
  },
  {
    "id": "nradiodevotional",
    "name": "N Devotional",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/wbtn4zwb998uv"
    ]
  },
  {
    "id": "swarnanjalidevotionalradio",
    "name": "Devotional Radio",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/x7mve2vt01zuv",
      "https://stream.zeno.fm/zkqsxrd1h2zuv"
    ]
  },
  {
    "id": "njanmalayalibhakthi",
    "name": "Njan Malayali Bhakthi",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/w9kku8utuy8uv"
    ],
    "offline": true
  }
];
window.STATIONS_CHECKED = "2026-10-21T18:27Z";
