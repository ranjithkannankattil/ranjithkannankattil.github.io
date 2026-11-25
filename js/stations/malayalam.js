/* Malayalam radio stations for radio.html.
   Checked and updated daily by scripts/check_streams.py (GitHub Actions).
   category: air | fm | online | artist | devotional
   streams: tried in order until one plays; working ones are moved first
   offline: set by the daily check when no stream works (station stays listed)
   exclude: streams the daily check must never add back (wrong station)
   akv: name in the Akashvani station list, used to pick up new official links */
window.STATIONS = [
  {
    "id": "radiomango",
    "name": "Radio Mango",
    "category": "fm",
    "streams": [
      "https://listen.openstream.co/4635/audio"
    ],
    "exclude": [
      "https://ais-edge105-live365-dal02.cdnstream.com/a50671",
      "https://ais-edge51-live365-dal02.cdnstream.com/a50671",
      "https://eu10.fastcast4u.com/clubfmuae",
      "https://listen.openstream.co/4626/audio",
      "https://sp14.instainternet.com/8050/stream",
      "https://stream.aiir.com/dbv0rxpwp6ytv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "homefm",
    "name": "Home FM",
    "category": "fm",
    "streams": [
      "https://centova.aarenworld.com/proxy/922radiokhushi/stream"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "hit967",
    "name": "Hit 96.7",
    "category": "fm",
    "streams": [
      "https://stream.radiojar.com/3yygc0pwuueuv"
    ],
    "geo": "AE"
  },
  {
    "id": "radiosunomalayalam",
    "name": "Radio Suno",
    "category": "fm",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/SUNO917_SC",
      "https://playerservices.streamtheworld.com/api/livestream-redirect/SUNO917.mp3"
    ],
    "br": [
      128,
      128
    ]
  },
  {
    "id": "radiosunobahrain",
    "name": "Suno Bahrain",
    "category": "fm",
    "streams": [
      "https://osrnstream.olivesuno.com/suno876.mp3"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "ananthapurifm",
    "name": "AIR Ananthapuri FM",
    "category": "air",
    "streams": [
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio229/chunklist.m3u8",
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio229/playlist.m3u8"
    ],
    "br": [
      0,
      96
    ]
  },
  {
    "id": "radiokeralam",
    "name": "Radio Keralam",
    "category": "online",
    "streams": [
      "https://ice31.securenetsystems.net/RADIOKERAL"
    ],
    "br": [
      192
    ]
  },
  {
    "id": "986malayalamradio",
    "name": "98.6 FM",
    "category": "fm",
    "streams": [
      "https://stream.zeno.fm/512rbf1e3qzuv",
      "https://stream.qfmradio.qa/986fm"
    ],
    "br": [
      128,
      0
    ]
  },
  {
    "id": "livefm1072",
    "name": "Live FM 1072",
    "category": "fm",
    "streams": [
      "https://stream.aiir.com/dbv0rxpwp6ytv"
    ],
    "br": [
      320
    ]
  },
  {
    "id": "radiolemonlive",
    "name": "Radio Lemon UK",
    "category": "online",
    "streams": [
      "https://live.sarrit.com:8040/radio.mp3"
    ],
    "br": [
      96
    ]
  },
  {
    "id": "radiolemonnz",
    "name": "Radio Lemon New Zealand",
    "category": "online",
    "streams": [
      "https://stream.nammude.uk/listen/radio_lemon_live_newzealand_-_copy/radio.mp3"
    ],
    "br": [
      96
    ]
  },
  {
    "id": "radiolemonbengaluru",
    "name": "Radio Lemon Bengaluru",
    "category": "online",
    "streams": [
      "https://live.sarrit.com:8070/radio.mp3"
    ],
    "offline": true,
    "hidden": true
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
      "https://radio.wavespb.com/live/70400e7510e87cdf/70400e7510e87cdf.m3u8"
    ],
    "freq": "102.3 FM",
    "akv": "Akashvani Kochi"
  },
  {
    "id": "fmrainbowkochi",
    "name": "AIR FM Rainbow Kochi",
    "category": "air",
    "freq": "107.5 FM",
    "streams": [
      "https://radio.wavespb.com/live/7df6f2a8c3c4d33b/7df6f2a8c3c4d33b.m3u8"
    ],
    "akv": "FM Rainbow Kochi"
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
    ],
    "br": [
      95
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
    ]
  },
  {
    "id": "airkozhikodefm",
    "name": "AIR Kozhikode FM",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/b69c296065db7627/b69c296065db7627.m3u8",
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio083/playlist.m3u8"
    ],
    "akv": "Akashvani Kozhikode Real FM",
    "br": [
      0,
      129
    ]
  },
  {
    "id": "radio90fm",
    "name": "Radio 90 FM",
    "category": "online",
    "streams": [
      "https://ice42.securenetsystems.net/CR90?type=.mp3"
    ],
    "br": [
      32
    ]
  },
  {
    "id": "radiokerala",
    "name": "Radio Kerala",
    "category": "online",
    "streams": [
      "https://streaming.radiokerala.in/listen/radio_kerala/radio.mp3"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "nammuderadio",
    "name": "Nammude UK",
    "category": "online",
    "streams": [
      "https://stream.nammude.uk/listen/nammude_uk/live",
      "https://live.sarrit.com/listen/nammude_uk/live"
    ],
    "br": [
      128,
      128
    ]
  },
  {
    "id": "naadanchaaya",
    "name": "Naadan Chaaya Radio (Ireland)",
    "category": "online",
    "streams": [
      "https://uksoutha.streaming.broadcast.radio/naadanchaayaradio"
    ]
  },
  {
    "id": "myradio90fm",
    "name": "My Radio FM",
    "category": "online",
    "streams": [
      "https://cast1.my-control-panel.com/proxy/myradio90fm/stream"
    ],
    "br": [
      320
    ]
  },
  {
    "id": "airkannur",
    "name": "AIR Kannur",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/b82c91a395fc4a7d/b82c91a395fc4a7d.m3u8"
    ],
    "akv": "Akashvani Kannur"
  },
  {
    "id": "helloradio",
    "name": "Hello Radio",
    "category": "online",
    "streams": [
      "https://radio.helloradio.in/radio"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "radiobenziger",
    "name": "Benziger FM",
    "category": "online",
    "streams": [
      "https://icecast.octosignals.com/benziger"
    ],
    "br": [
      96
    ]
  },
  {
    "id": "aahafmradio",
    "name": "Aaha FM",
    "category": "online",
    "streams": [
      "https://s2.radio.co/s3801784f1/listen"
    ],
    "br": [
      192
    ]
  },
  {
    "id": "manjerifm",
    "name": "AIR Manjeri FM",
    "category": "air",
    "streams": [
      "https://radio.wavespb.com/live/58390a2ed33cea4a/58390a2ed33cea4a.m3u8"
    ],
    "akv": "Akashvani Manjeri"
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
    ]
  },
  {
    "id": "radioneythal",
    "name": "Radio Neythal",
    "category": "online",
    "streams": [
      "https://s2.myradiostream.com/5538/listen.mp3"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "radiomattoli",
    "name": "Radio Mattoli",
    "category": "online",
    "streams": [
      "https://cast1.my-control-panel.com/proxy/radiomattoli/stream"
    ],
    "br": [
      320
    ]
  },
  {
    "id": "radiocu",
    "name": "Radio CU (University of Calicut)",
    "category": "online",
    "streams": [
      "https://cast1.my-control-panel.com/proxy/radioculive/stream"
    ],
    "added": "2026-11-22",
    "br": [
      320
    ]
  },
  {
    "id": "enteradio",
    "name": "Ente Radio",
    "category": "online",
    "streams": [
      "https://cast1.my-control-panel.com/proxy/enteradio/stream"
    ],
    "br": [
      112
    ]
  },
  {
    "id": "janvanifm",
    "name": "Janvani FM",
    "category": "online",
    "streams": [
      "https://radiosavre.com:8060/radio.mp3"
    ],
    "br": [
      192
    ]
  },
  {
    "id": "radiomacfast",
    "name": "Radio Macfast 90.4",
    "category": "fm",
    "streams": [
      "https://icecast.octosignals.com/radiomacfast"
    ],
    "br": [
      96
    ]
  },
  {
    "id": "globalradio",
    "name": "Global Radio",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/epyhxgc1y8huv",
      "https://stream.zeno.fm/epyhxgc1y8huv.mp3"
    ],
    "br": [
      128,
      128
    ]
  },
  {
    "id": "radiomalabar",
    "name": "Radio Malabar",
    "category": "online",
    "streams": [
      "https://d98pmgd7by0qx.cloudfront.net/radiomalabar.m3u8",
      "https://streamasiacdn.atc-labs.com/radiomalabar.aac"
    ],
    "br": [
      0,
      64
    ]
  },
  {
    "id": "ahaliafm",
    "name": "Ahalia FM",
    "category": "online",
    "streams": [
      "https://cast1.my-control-panel.com/proxy/ahaliafm/stream"
    ],
    "br": [
      128
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
    "offline": true,
    "hidden": true
  },
  {
    "id": "sargakshetrafm",
    "name": "Sargakshetra FM",
    "category": "online",
    "streams": [
      "https://icecast.octosignals.com/sargakshetrafm"
    ],
    "br": [
      96
    ]
  },
  {
    "id": "radiomediavillage",
    "name": "Radio Media Village",
    "category": "online",
    "streams": [
      "https://443-1.autopo.st/183/stream",
      "https://cp3.shoutcheap.com:18145/stream"
    ],
    "br": [
      320,
      0
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
    ],
    "br": [
      320
    ]
  },
  {
    "id": "malayalamfmnz",
    "name": "Malayalam FM 104.6 (NZ)",
    "category": "online",
    "streams": [
      "https://a5.asurahosting.com/listen/malayalamfm_live/radio.mp3",
      "https://a5.asurahosting.com:7770/radio.mp3"
    ],
    "br": [
      128,
      128
    ]
  },
  {
    "id": "planetfmnz",
    "name": "Planet FM 104.6 (NZ)",
    "category": "fm",
    "streams": [
      "https://live.accessmedia.nz/PlanetFM.stream_aac/playlist.m3u8",
      "https://live.accessmedia.nz/PlanetFM.stream/playlist.m3u8"
    ],
    "br": [
      151,
      135
    ]
  },
  {
    "id": "ashrayafm",
    "name": "Ashraya FM",
    "category": "online",
    "streams": [
      "https://fm.ashrayafm90.com/ashrayafm"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "radiodigitalmalayali",
    "name": "Digital Malayali",
    "category": "online",
    "streams": [
      "https://radio.digitalmalayali.in/listen/stream/radio.mp3"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "radionellika",
    "name": "Radio Nellika",
    "category": "online",
    "streams": [
      "https://usa10.fastcast4u.com:8110/;?type=http&nocache=3"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "chitrahitsmalayalam",
    "name": "KS Chitra Hits",
    "category": "artist",
    "streams": [
      "https://stream.zeno.fm/dubvcz3rkrhvv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "mohanlalhits",
    "name": "Mohanlal Hits",
    "category": "artist",
    "streams": [
      "https://stream.zeno.fm/5vva7u4ts0quv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "kjyesudas",
    "name": "KJ Yesudas Hits",
    "category": "artist",
    "streams": [
      "https://stream.zeno.fm/9x1sw687nf9uv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "radiomallu",
    "name": "Radio Mallu",
    "category": "online",
    "streams": [
      "https://usa15.fastcast4u.com/proxy/radiomall/stream"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "radiomate",
    "name": "Radio Mate",
    "category": "online",
    "streams": [
      "https://live.sarrit.com:8140/lemonaustralia"
    ],
    "br": [
      96
    ]
  },
  {
    "id": "radiolimemalayalam",
    "name": "Radio Lime",
    "category": "online",
    "streams": [
      "https://s5.radio.co/s6e27496ef/listen"
    ],
    "br": [
      192
    ]
  },
  {
    "id": "recastfm",
    "name": "Recast FM",
    "category": "online",
    "streams": [
      "https://usa8.fastcast4u.com/proxy/auralradio?mp=/1/;stream.mp3"
    ],
    "offline": true
  },
  {
    "id": "premamfm",
    "name": "Premam FM",
    "category": "online",
    "streams": [
      "https://fm.thamizhinifm.com/listen/premamfm/radio.mp3"
    ],
    "br": [
      192
    ]
  },
  {
    "id": "radiodelhimalayalam",
    "name": "Radio Delhi",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/ap5sacmsn7zuv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "paattupetti",
    "name": "Paattupetti",
    "category": "online",
    "streams": [
      "https://streamer.radio.co/s8d5f06a3d/listen"
    ]
  },
  {
    "id": "malayalammusic",
    "name": "Music FM",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/g8cx7tggb3quv.aac"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "radioonattukara",
    "name": "Onattukara",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/fu94u25kqd0uv",
      "https://stream.zeno.fm/fu94u25kqd0uv/;stream.mp3"
    ],
    "br": [
      128,
      128
    ]
  },
  {
    "id": "radioshree",
    "name": "Radio Shree",
    "category": "online",
    "streams": [
      "https://eu10.fastcast4u.com:14910/;"
    ],
    "br": [
      128
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
    ],
    "br": [
      128
    ]
  },
  {
    "id": "pranayamradio",
    "name": "Pranayam Radio",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/g2zves9gdwzuv"
    ],
    "br": [
      96
    ]
  },
  {
    "id": "radiosallapam",
    "name": "Radio Sallapam",
    "category": "online",
    "streams": [
      "https://sallapambyasset.com/api/Stream/Live"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "radiolalsalam",
    "name": "Radio Lalsalam",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/f3nc8x3tywzuv"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "arradio",
    "name": "AR Radio",
    "category": "online",
    "streams": [
      "https://free.rcast.net/200660"
    ],
    "br": [
      32
    ]
  },
  {
    "id": "radiomythri",
    "name": "Radio Mythri",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/ekthuu9bfwzuv"
    ],
    "br": [
      56
    ]
  },
  {
    "id": "keralafm",
    "name": "Kerala FM",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/mfn3gkbvty8uv"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "radiobeatmalayalamhd",
    "name": "Radio Beats",
    "category": "online",
    "streams": [
      "https://listen.openstream.co/6761/audio"
    ],
    "br": [
      192
    ]
  },
  {
    "id": "tcrliveradio",
    "name": "TCR Live",
    "category": "online",
    "streams": [
      "https://centova71.instainternet.com/proxy/tcrliveradio?mp=/stream"
    ],
    "hidden": true,
    "offline": true
  },
  {
    "id": "kaathoramlive",
    "name": "Kaathoram",
    "category": "online",
    "streams": [
      "https://c30.radioboss.fm/stream/560"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "auralmelodies",
    "name": "Aural Melodies",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/7fmywrmrga0uv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "deshavanifm",
    "name": "Deshavani FM",
    "category": "online",
    "streams": [
      "https://fm.saksoftlabs.com/radio.mp3"
    ]
  },
  {
    "id": "radiome",
    "name": "Radio Me",
    "category": "online",
    "streams": [
      "https://freestream.hu:8340/radiome"
    ],
    "br": [
      96
    ]
  },
  {
    "id": "thaalamradio",
    "name": "Thaalam Radio",
    "category": "online",
    "streams": [
      "https://thaalam.tamilfmradios.com/live"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "omrradio",
    "name": "OMR Radio",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/x2baeup395quv"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "radiotirur",
    "name": "Tirur Radio",
    "category": "online",
    "streams": [
      "https://sonic01.instainternet.com/8002/stream"
    ],
    "br": [
      64
    ]
  },
  {
    "id": "radiovatakara",
    "name": "Radio Vatakara",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/9k5ku7bhb8zuv"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "mazhavilfm",
    "name": "Mazhavil FM",
    "category": "online",
    "streams": [
      "https://live.sarrit.com:8010/mazhavilfm"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "radiosarangi",
    "name": "Radio Sarangi",
    "category": "online",
    "streams": [
      "https://radiosarangi.logichost.in/listen/sarangi/radio.mp3"
    ],
    "br": [
      192
    ]
  },
  {
    "id": "radiovoxa",
    "name": "Radio Voxa",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/zrfx7zy2wwzuv.aac"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "auralradio",
    "name": "Aural Radio",
    "category": "online",
    "streams": [
      "https://live.auralradiokerala.in/auralradio/mp3"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "pravasibharathi",
    "name": "Pravasi Bharathi",
    "category": "online",
    "streams": [
      "https://c30.radioboss.fm:8964/stream",
      "https://c4.radioboss.fm:8547/autodj"
    ],
    "br": [
      128,
      0
    ]
  },
  {
    "id": "radiocafe",
    "name": "Radio Cafe",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/gqmh0caknchvv"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "radiopalakkad",
    "name": "Radio Palakkad",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/qgqrxfte41zuv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "ragamradio",
    "name": "Ragam Radio",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/xwlwqmiogncvv"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "radioutsav",
    "name": "Utsav Live Radio",
    "category": "online",
    "keep": true,
    "streams": [
      "http://82.145.63.6:6094/mp=/stream"
    ],
    "added": "2026-11-23"
  },
  {
    "id": "kancheeravamradio",
    "name": "Kancheeravam",
    "category": "online",
    "streams": [
      "https://radiosavre.com:8020/radio.mp3"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "rafaradio",
    "name": "Rafa Radio",
    "category": "devotional",
    "streams": [
      "https://gains.reviveradio.net/proxy/rafaradio?mp=/stream"
    ],
    "br": [
      192
    ]
  },
  {
    "id": "menorahradio",
    "name": "Menorah Radio",
    "category": "devotional",
    "streams": [
      "https://gains.reviveradio.net/proxy/menorah?mp=/stream"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "dvnradio",
    "name": "DVN Radio",
    "category": "devotional",
    "streams": [
      "https://ice31.securenetsystems.net/DVN"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "psalmsradio",
    "name": "Psalms Radio",
    "category": "devotional",
    "streams": [
      "https://s2.citrus3.com:8046/stream"
    ],
    "br": [
      256
    ]
  },
  {
    "id": "avefm",
    "name": "AVE FM (Mananthavady)",
    "category": "devotional",
    "streams": [
      "https://cast1.my-control-panel.com/proxy/avefm/stream"
    ],
    "added": "2026-11-23",
    "br": [
      360
    ]
  },
  {
    "id": "shalomradio",
    "name": "Shalom Radio",
    "category": "devotional",
    "streams": [
      "https://stream.radio.co/s1383afdc9/listen?ver=828256"
    ]
  },
  {
    "id": "reviveradiomalayalam",
    "name": "Revive Radio",
    "category": "devotional",
    "streams": [
      "https://gains.reviveradio.net/proxy/revivemalayalam?mp=/stream"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "radiowind",
    "name": "Radio Wind",
    "category": "devotional",
    "streams": [
      "https://stream.radio.co/s9015a8e16/listen"
    ]
  },
  {
    "id": "radioangelos",
    "name": "Radio Angelos",
    "category": "devotional",
    "streams": [
      "https://s7.voscast.com:9563/stream"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "bafaradio",
    "name": "Bafa Radio",
    "category": "devotional",
    "streams": [
      "https://gains.reviveradio.net/proxy/bafaradio/stream"
    ],
    "br": [
      192
    ]
  },
  {
    "id": "worldtoworldradio",
    "name": "World to World",
    "category": "devotional",
    "streams": [
      "https://streaming.radio.co/s4f2cc35de/listen"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "ephphatharadio",
    "name": "Ephphatha",
    "category": "devotional",
    "streams": [
      "https://ephphatha.radioca.st/stream"
    ],
    "br": [
      320
    ]
  },
  {
    "id": "amenradio",
    "name": "Amen Radio",
    "category": "devotional",
    "streams": [
      "https://ice7.securenetsystems.net/AMENFM"
    ],
    "br": [
      192
    ]
  },
  {
    "id": "marymatharadio",
    "name": "Mary Matha",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/g5ay9q4dgrruv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "greenradio",
    "name": "Green Radio",
    "category": "devotional",
    "streams": [
      "http://108.170.51.230:8010/stream"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "luminousradiomalayalam",
    "name": "Luminous FM",
    "category": "devotional",
    "streams": [
      "https://patmos.cdnstream.com/proxy/luminous/?mp=/stream"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "tharangamradio",
    "name": "Tharangam",
    "category": "devotional",
    "streams": [
      "https://usa14.fastcast4u.com/proxy/bobbygeo?mp=/;"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "radiomaria",
    "name": "Radio Maria",
    "category": "devotional",
    "streams": [
      "https://dreamsiteradiocp2.com/proxy/rmindia1?mp=/stream"
    ],
    "br": [
      32
    ]
  },
  {
    "id": "puthiyerushalemradio",
    "name": "Puthiyerushalem",
    "category": "devotional",
    "streams": [
      "https://streams.radio.co/s4e89ff5bd/listen"
    ]
  },
  {
    "id": "muthnabiradio",
    "name": "Muthnabi",
    "category": "devotional",
    "streams": [
      "https://cast4.my-control-panel.com/proxy/muthnabi/stream"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "peaceradio",
    "name": "Peace Radio",
    "category": "devotional",
    "streams": [
      "https://peaceradio.out.airtime.pro/peaceradio_a"
    ],
    "br": [
      96
    ]
  },
  {
    "id": "radioislam",
    "name": "Radio Islam",
    "category": "devotional",
    "streams": [
      "https://radioislamin.out.airtime.pro/radioislamin_a"
    ],
    "br": [
      96
    ]
  },
  {
    "id": "quranradiomalayalam",
    "name": "Quran Radio",
    "category": "devotional",
    "streams": [
      "https://server03.quran-uni.com:7029/stream"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "radioilmussalaf",
    "name": "Ilmussalaf Radio",
    "category": "devotional",
    "streams": [
      "https://darhdth.radioca.st/stream"
    ],
    "br": [
      32
    ]
  },
  {
    "id": "radioayyappa",
    "name": "Radio Ayyappa",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/rdcci38kky4vv"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "malayalambhakthiradio",
    "name": "Bhakthi Radio",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/08e1vkshcc9uv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "nradiodevotional",
    "name": "N Devotional",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/wbtn4zwb998uv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "swarnanjalidevotionalradio",
    "name": "Devotional Radio",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/x7mve2vt01zuv"
    ],
    "br": [
      128
    ]
  },
  {
    "id": "njanmalayalibhakthi",
    "name": "Njan Malayali Bhakthi",
    "category": "devotional",
    "streams": [
      "https://stream.zeno.fm/w9kku8utuy8uv"
    ],
    "offline": true,
    "hidden": true
  },
  {
    "id": "raagam-air-24-7",
    "name": "Raagam AIR 24*7",
    "category": "air",
    "streams": [
      "https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudioragam/hlspbaudioragam_Auto.m3u8"
    ],
    "added": "2026-10-22",
    "br": [
      32
    ]
  },
  {
    "id": "anbu-fm-malayalam",
    "name": "Anbu FM Malayalam",
    "category": "fm",
    "streams": [
      "https://stream.zeno.fm/8ca40byv4x8uv"
    ],
    "added": "2026-10-22",
    "br": [
      128
    ]
  },
  {
    "id": "fm-city-100-1",
    "name": "FM City 100.1",
    "category": "fm",
    "streams": [
      "https://stream.zeno.fm/4yfsm0d8n98uv"
    ],
    "added": "2026-10-22",
    "br": [
      112
    ]
  },
  {
    "id": "vividh-bharati-thiruvananthapuram",
    "name": "Vividh Bharati Thiruvananthapuram",
    "category": "online",
    "streams": [
      "https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8"
    ],
    "added": "2026-10-22",
    "br": [
      94
    ]
  },
  {
    "id": "aural-oldies",
    "name": "Aural Oldies",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/anrf216cu68uv",
      "https://stream.zeno.fm/tksfwb1mgzzuv"
    ],
    "added": "2026-10-22",
    "br": [
      128,
      128
    ]
  },
  {
    "id": "shaiva-lahari",
    "name": "Shaiva Lahari",
    "category": "online",
    "streams": [
      "https://radio.shaivam.org/listen/shaiva-lahari/radio.mp3"
    ],
    "added": "2026-10-22",
    "br": [
      128
    ]
  },
  {
    "id": "shahimsha-online-radio",
    "name": "Shahimsha Online radio",
    "category": "online",
    "streams": [
      "https://radio.shahimsha.com/listen/shahimsha/radio.mp3"
    ],
    "added": "2026-10-22",
    "br": [
      192
    ]
  },
  {
    "id": "planet-black",
    "name": "Planet black",
    "category": "online",
    "streams": [
      "https://mp3.planetradio.de/plrchannels/hqblackbeats.aac"
    ],
    "added": "2026-10-23",
    "br": [
      128
    ]
  },
  {
    "id": "mala90",
    "name": "Mala90",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/gm3g9amzm0hvv"
    ],
    "added": "2026-10-23",
    "br": [
      128
    ]
  },
  {
    "id": "retro-ma",
    "name": "Retro Ma",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/b6augfmdanzuv"
    ],
    "added": "2026-10-23",
    "br": [
      128
    ]
  },
  {
    "id": "malever",
    "name": "Malever",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/5u6gkp9sp0hvv"
    ],
    "added": "2026-10-23",
    "br": [
      128
    ]
  },
  {
    "id": "kalabhavan-mani-radio",
    "name": "Kalabhavan Mani Radio",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/s6hhy943w0hvv"
    ],
    "added": "2026-10-23",
    "br": [
      128
    ]
  },
  {
    "id": "hallos-radio",
    "name": "Hallos Radio",
    "category": "online",
    "streams": [
      "https://usa8.fastcast4u.com/proxy/auralradio?mp=/1"
    ],
    "added": "2026-10-24",
    "offline": true
  },
  {
    "id": "jesus-radio-malayalam",
    "name": "Jesus Radio Malayalam",
    "category": "devotional",
    "streams": [
      "https://gains.reviveradio.net/proxy/jesusreigns?mp=/stream"
    ],
    "added": "2026-10-24",
    "br": [
      128
    ]
  },
  {
    "id": "malysadan",
    "name": "Malysadan",
    "category": "online",
    "streams": [
      "https://stream.zeno.fm/8g9nvr1rkrhvv"
    ],
    "added": "2026-10-24",
    "br": [
      128
    ]
  },
  {
    "id": "translation-of-the-quran-in-malayalam",
    "name": "Translation of the Quran in Malayalam",
    "category": "devotional",
    "streams": [
      "https://serverkw.quran-uni.com:8060/;"
    ],
    "added": "2026-11-03",
    "br": [
      128
    ]
  },
  {
    "id": "kairali-news",
    "name": "Kairali News",
    "tv": true,
    "category": "online",
    "streams": [
      "https://cdn.pishow.tv/ott/live/1469/master.m3u8"
    ],
    "added": "2026-11-14",
    "br": [
      691
    ]
  },
  {
    "id": "kairaly-tv",
    "name": "Kairaly TV",
    "tv": true,
    "category": "online",
    "streams": [
      "https://mumt01.tangotv.in/O5aw8Zn3KAIRALI/index.m3u8"
    ],
    "added": "2026-11-14",
    "br": [
      2240
    ]
  },
  {
    "id": "asianet",
    "name": "Asianet",
    "tv": true,
    "category": "online",
    "streams": [
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starasianet.smil/chunklist_b1928000.m3u8"
    ],
    "added": "2026-11-14"
  },
  {
    "id": "air-akashvani-malayalam",
    "name": "AIR Akashvani Malayalam",
    "category": "air",
    "streams": [
      "https://d3hrxqn1tritdh.cloudfront.net/6ff13de7ea9b53d7/6ff13de7ea9b53d7.m3u8"
    ],
    "added": "2026-11-17",
    "offline": true
  }
];
window.STATIONS_CHECKED = "2026-11-25T12:56Z";
