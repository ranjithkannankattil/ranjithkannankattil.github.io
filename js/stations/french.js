/* French radio stations for radio.html — every stream was play-tested on ranjithkb.com.
   Checked twice a day by scripts/check_streams.py (GitHub Actions).
   streams: tried in order; offline: set by the check when none work */
window.STATIONS = [
  {
    "id": "france-inter",
    "name": "France Inter",
    "category": "news",
    "streams": [
      "https://direct.franceinter.fr/live/franceinter-hifi.aac"
    ]
  },
  {
    "id": "france-info",
    "name": "France Info",
    "category": "news",
    "streams": [
      "https://icecast.radiofrance.fr/franceinfo-hifi.aac"
    ]
  },
  {
    "id": "france-culture",
    "name": "France Culture",
    "category": "news",
    "streams": [
      "https://icecast.radiofrance.fr/franceculture-hifi.aac"
    ]
  },
  {
    "id": "fip",
    "name": "FIP",
    "category": "music",
    "streams": [
      "https://icecast.radiofrance.fr/fip-hifi.aac",
      "https://stream.radiofrance.fr/fip/fip_hifi.m3u8"
    ]
  },
  {
    "id": "fip-jazz",
    "name": "FIP Jazz",
    "category": "music",
    "streams": [
      "https://icecast.radiofrance.fr/fipjazz-hifi.aac"
    ]
  },
  {
    "id": "rmc",
    "name": "RMC",
    "category": "news",
    "streams": [
      "https://audio.bfmtv.com/rmcradio_128.mp3",
      "https://audio.bfmtv.com/rmcradio_128.mp3?aw_0_1st.playerId=RMC_audio_web&aggregator=RMC_audio_web"
    ]
  },
  {
    "id": "europe-1",
    "name": "Europe 1",
    "category": "news",
    "streams": [
      "https://stream.europe1.fr/europe1.aac"
    ]
  },
  {
    "id": "bfm-business",
    "name": "BFM Business",
    "category": "news",
    "streams": [
      "https://audio.bfmtv.com/bfmbusiness_128.mp3?aw_0_1st.playerId=BFMBusiness_audio_web&aggregator=BFMBusiness_audio_web"
    ]
  },
  {
    "id": "bfm-radio",
    "name": "BFM Radio",
    "category": "news",
    "streams": [
      "https://audio.bfmtv.com/bfmradio_128.mp3"
    ]
  },
  {
    "id": "rtbf-la-premiere-belgique",
    "name": "RTBF La Première (Belgique)",
    "category": "news",
    "streams": [
      "https://radios.rtbf.be/laprem1ere-64.aac"
    ]
  },
  {
    "id": "fun-radio",
    "name": "Fun Radio",
    "category": "music",
    "streams": [
      "https://icecast.funradio.fr/fun-1-44-128"
    ]
  },
  {
    "id": "skyrock",
    "name": "Skyrock",
    "category": "music",
    "streams": [
      "https://icecast.skyrock.net/s/natio_mp3_128k"
    ]
  },
  {
    "id": "skyrock-klassiks",
    "name": "Skyrock Klassiks",
    "category": "music",
    "streams": [
      "https://icecast.skyrock.net/s/klassiks_aac_64k?tvr_name=radiofr&tvr_section1=64aac"
    ]
  },
  {
    "id": "nrj-hits",
    "name": "NRJ Hits",
    "category": "music",
    "streams": [
      "https://streaming.nrjaudio.fm/ou7xugf3s5gi?origine=playernrj&aw_0_req.userConsentV2=&aw_0_1st.station=NRJ-Hits"
    ]
  },
  {
    "id": "nrj-paris",
    "name": "NRJ Paris",
    "category": "music",
    "streams": [
      "https://streaming.nrjaudio.fm/ou5k6tirv93h"
    ]
  },
  {
    "id": "europe-2",
    "name": "Europe 2",
    "category": "music",
    "streams": [
      "https://europe2.lmn.fm/europe2.mp3"
    ]
  },
  {
    "id": "radio-nova",
    "name": "Radio Nova",
    "category": "music",
    "streams": [
      "https://novazz.ice.infomaniak.ch/novazz-128.mp3"
    ]
  },
  {
    "id": "oui-fm",
    "name": "OUI FM",
    "category": "music",
    "streams": [
      "https://ouifm.ice.infomaniak.ch/ouifm-high.mp3"
    ]
  },
  {
    "id": "radio-fg",
    "name": "Radio FG",
    "category": "music",
    "streams": [
      "https://radiofg.impek.com/fg"
    ]
  },
  {
    "id": "rfm-pop-rock",
    "name": "RFM Pop-Rock",
    "category": "music",
    "streams": [
      "https://stream.rfm.fr/rfm-wr10.aac"
    ],
    "offline": true
  },
  {
    "id": "jazz-radio",
    "name": "Jazz Radio",
    "category": "music",
    "streams": [
      "https://jazzradio.ice.infomaniak.ch/jazzradio-high.mp3"
    ]
  },
  {
    "id": "jazz-radio-blues",
    "name": "Jazz Radio Blues",
    "category": "music",
    "streams": [
      "https://jazzblues.ice.infomaniak.ch/jazzblues-high.mp3"
    ]
  },
  {
    "id": "jazz-radio-classic-jazz",
    "name": "Jazz Radio Classic Jazz",
    "category": "music",
    "streams": [
      "https://jazz-wr01.ice.infomaniak.ch/jazz-wr01-128.mp3"
    ]
  },
  {
    "id": "chante-france-80s",
    "name": "Chante France 80s",
    "category": "music",
    "streams": [
      "https://stream1.chantefrance.com/cf-80"
    ]
  },
  {
    "id": "100-radio-80",
    "name": "100% Radio 80",
    "category": "music",
    "streams": [
      "https://100radio-80.ice.infomaniak.ch/100radio-80-128.mp3"
    ]
  },
  {
    "id": "made-in-80",
    "name": "Made in 80",
    "category": "music",
    "streams": [
      "https://madein80.leswebradios.fr/"
    ]
  },
  {
    "id": "eurodance-90",
    "name": "EuroDance 90",
    "category": "music",
    "streams": [
      "https://stream-eurodance90.fr/radio/8000/128.mp3?1627933323"
    ]
  },
  {
    "id": "rire-et-chansons-sketches",
    "name": "Rire et Chansons Sketches",
    "category": "music",
    "streams": [
      "https://streaming.nrjaudio.fm/ou8oqegk7oiu?aw_0_1st.station=Rire-Chansons-SKETCHES&origine=mytuner"
    ]
  },
  {
    "id": "rire-et-chansons-canulars",
    "name": "Rire et Chansons Canulars",
    "category": "music",
    "streams": [
      "https://streaming.nrjaudio.fm/ouwgjmsk6j4d?aw_0_1st.station=Rire-Chansons-CANULARS&origine=mytuner"
    ]
  },
  {
    "id": "la-grosse-radio-reggae",
    "name": "La Grosse Radio Reggae",
    "category": "music",
    "streams": [
      "https://hd.lagrosseradio.info/lagrosseradio-reggae-192.mp3"
    ]
  },
  {
    "id": "fm-80-funky-music",
    "name": "FM 80 Funky Music",
    "category": "music",
    "streams": [
      "https://listen.radioking.com/radio/467555/stream/523739"
    ]
  },
  {
    "id": "radio-cotonou-94-3-benin",
    "name": "Radio Cotonou 94.3 (Bénin)",
    "category": "music",
    "streams": [
      "https://stream.zeno.fm/o9bspgm4y78vv"
    ]
  },
  {
    "id": "radio-plus-agadir-92-4-maroc",
    "name": "Radio Plus Agadir 92.4 (Maroc)",
    "category": "music",
    "streams": [
      "https://stream.zeno.fm/bqdbb6hd0neuv"
    ]
  },
  {
    "id": "sud-fm-sen-radio-senegal",
    "name": "Sud FM Sen Radio (Sénégal)",
    "category": "news",
    "streams": [
      "https://stream.zenolive.com/rq40edfn3reuv"
    ]
  },
  {
    "id": "sud-radio",
    "name": "Sud Radio",
    "category": "news",
    "streams": [
      "https://ice.creacast.com/sudradio"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "alouette",
    "name": "Alouette",
    "category": "music",
    "streams": [
      "https://alouette.ice.infomaniak.ch/alouette-high.mp3"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "radio-courtoisie",
    "name": "Radio Courtoisie",
    "category": "devotional",
    "streams": [
      "https://ice.creacast.com/radio-courtoisie"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "france-musique",
    "name": "France Musique",
    "category": "music",
    "streams": [
      "https://icecast.radiofrance.fr/francemusique-hifi.aac"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "radio-orient",
    "name": "Radio Orient",
    "category": "devotional",
    "streams": [
      "https://stream.rcs.revma.com/7hnrkawf4p8uv.mp3"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "rts-92-5-rsi",
    "name": "RTS 92.5 RSI",
    "category": "music",
    "streams": [
      "https://10gb1.acangroup.org:8000/rsi"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "nostalgie-80-90",
    "name": "Nostalgie 80 90",
    "category": "music",
    "streams": [
      "https://streaming.nrjaudio.fm/ou62iyxp336f?origine=fluxradios&aw_0_1st.station=Nostalgie-80-90"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "radio-meuh",
    "name": "Radio Meuh",
    "category": "music",
    "streams": [
      "https://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "france-bleu-provence",
    "name": "France Bleu Provence",
    "category": "music",
    "streams": [
      "https://icecast.radiofrance.fr/fbprovence-midfi.mp3?ID=radiofrance"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "yumi-co-radio",
    "name": "Yumi Co. Radio",
    "category": "music",
    "streams": [
      "https://yumicoradio.net/stream"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "radio-freedom-fm",
    "name": "Radio Freedom FM",
    "category": "music",
    "streams": [
      "https://freedomice.streamakaci.com/freedom.mp3"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "rts-la-premiere",
    "name": "RTS La Première",
    "category": "music",
    "streams": [
      "https://stream.srg-ssr.ch/m/la-1ere/mp3_128"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "chante-france",
    "name": "Chante France",
    "category": "music",
    "streams": [
      "https://stream.chantefrance.com/Chante_France"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "radio-plus-mauritius",
    "name": "Radio Plus Mauritius",
    "category": "news",
    "streams": [
      "https://stream.radioplus.mu:8000/radio.mp3"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "el-bahdja",
    "name": "El Bahdja - الجزائر العاصمة",
    "category": "news",
    "streams": [
      "https://webradio3.tda.dz:8001/ElBahdja_64K.mp3"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "generations-rap-fr-gold",
    "name": "Generations Rap FR Gold",
    "category": "music",
    "streams": [
      "https://gene-wr06.ice.infomaniak.ch/gene-wr06.mp3"
    ],
    "added": "2026-10-24"
  },
  {
    "id": "latina-reggaeton",
    "name": "Latina Reggaeton",
    "category": "music",
    "streams": [
      "https://latinareggaeton.ice.infomaniak.ch/latinareggaeton.mp3"
    ],
    "added": "2026-10-24"
  },
  {
    "id": "fip-reggae",
    "name": "FIP Reggae",
    "category": "music",
    "streams": [
      "https://icecast.radiofrance.fr/fipreggae-hifi.aac"
    ],
    "added": "2026-10-24"
  },
  {
    "id": "tropiques-fm",
    "name": "Tropiques FM",
    "category": "music",
    "streams": [
      "https://listen.radioking.com/radio/8916/stream/19088"
    ],
    "added": "2026-10-24"
  },
  {
    "id": "nrj-nouveaux-hits-2026",
    "name": "NRJ Nouveaux Hits 2026",
    "category": "music",
    "streams": [
      "https://streaming.nrjaudio.fm/ouucqs5n3nje"
    ],
    "added": "2026-10-24"
  },
  {
    "id": "rtbf-classic-21",
    "name": "RTBF Classic 21",
    "category": "music",
    "streams": [
      "https://radios.rtbf.be/classic21-128.mp3"
    ],
    "added": "2026-10-24"
  },
  {
    "id": "hits-1-algerie",
    "name": "Hits 1 Algérie",
    "category": "music",
    "streams": [
      "https://radio12.pro-fhi.net/listen/whmnrlow/stream"
    ],
    "added": "2026-10-25"
  },
  {
    "id": "chante-france-60-s",
    "name": "Chante France 60's",
    "category": "music",
    "streams": [
      "https://stream.chantefrance.com/cf-60"
    ],
    "added": "2026-10-25"
  },
  {
    "id": "fip-jazz-hi-fi",
    "name": "FIP Jazz (Hi-Fi)",
    "category": "music",
    "streams": [
      "https://stream.radiofrance.fr/fipjazz/fipjazz_hifi.m3u8?id=radiofrance"
    ],
    "added": "2026-10-25"
  },
  {
    "id": "le-bon-mix-hifi-flac-1411-kbps",
    "name": "Le Bon Mix HiFi Flac 1411 Kbps",
    "category": "music",
    "streams": [
      "https://stream10.xdevel.com/audio17s976748-2218/stream/icecast.audio"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "jazz-radio-swiss",
    "name": "Jazz · Radio Swiss",
    "category": "music",
    "streams": [
      "https://stream.srg-ssr.ch/m/rsj/mp3_128"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "algerie-internationale",
    "name": "Algérie Internationale الجزائر الدولية",
    "category": "news",
    "streams": [
      "https://webradio3.tda.dz:8001/Internationale_64K.mp3"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "00-radio-canada-montreal",
    "name": "00-Radio Canada Montreal",
    "category": "news",
    "streams": [
      "https://rcavliveaudio.akamaized.net/hls/live/2006635/P-2QMTL0_MTL/adaptive_192/master.m3u8"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "generations-funk",
    "name": "Generations Funk",
    "category": "music",
    "streams": [
      "https://gene-wr05.ice.infomaniak.ch/gene-wr05.mp3"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "mouv",
    "name": "Mouv'",
    "category": "music",
    "streams": [
      "https://icecast.radiofrance.fr/mouv-hifi.aac"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "couleur3",
    "name": "Couleur3",
    "category": "music",
    "streams": [
      "https://stream.srg-ssr.ch/m/couleur3/aacp_96"
    ],
    "added": "2026-10-27"
  },
  {
    "id": "nostalgie-best-of-70-80-90",
    "name": "Nostalgie Best Of 70 80 90",
    "category": "music",
    "streams": [
      "https://streaming.nrjaudio.fm/oumrpo8fnozc"
    ],
    "added": "2026-10-27"
  },
  {
    "id": "radio-la-belle-aventure",
    "name": "Radio La Belle Aventure",
    "category": "music",
    "streams": [
      "https://flux.radiolabelleaventure.com/listen/radio_la_belle_aventure/radio.mp3"
    ],
    "added": "2026-10-27"
  },
  {
    "id": "jazz-radio-funk",
    "name": "Jazz Radio Funk",
    "category": "music",
    "streams": [
      "https://jazz-wr06.ice.infomaniak.ch/jazz-wr06-128.mp3"
    ],
    "added": "2026-10-27"
  },
  {
    "id": "cherie-fm-2000",
    "name": "Chérie FM 2000",
    "category": "music",
    "streams": [
      "https://streaming.nrjaudio.fm/ouf2ebtx4thg"
    ],
    "added": "2026-10-27"
  },
  {
    "id": "fip-musiques-du-monde",
    "name": "FIP Musiques du monde",
    "category": "music",
    "streams": [
      "https://icecast.radiofrance.fr/fipworld-hifi.aac"
    ],
    "added": "2026-10-27"
  },
  {
    "id": "hit-radio-morocco",
    "name": "Hit Radio (Morocco)",
    "category": "music",
    "streams": [
      "https://hitradio-maroc.ice.infomaniak.ch/hitradio-maroc-128.mp3"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "innovation-fm",
    "name": "Innovation FM",
    "category": "news",
    "streams": [
      "https://radio.fdvi.org/live"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "france-musique-la-baroque",
    "name": "France Musique La Baroque",
    "category": "music",
    "streams": [
      "https://icecast.radiofrance.fr/francemusiquebaroque-hifi.aac"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "latina-salsa",
    "name": "Latina Salsa",
    "category": "music",
    "streams": [
      "https://latinasalsa.ice.infomaniak.ch/latinasalsa.mp3"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "fip-rock",
    "name": "FIP Rock",
    "category": "music",
    "streams": [
      "https://icecast.radiofrance.fr/fiprock-hifi.aac"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "latina",
    "name": "Latina",
    "category": "music",
    "streams": [
      "https://start-latina.ice.infomaniak.ch/start-latina-high.mp3"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "skyrock-casablanca",
    "name": "Skyrock Casablanca",
    "category": "music",
    "streams": [
      "https://icecast.skyrock.net/s/casa_aac_64k"
    ],
    "added": "2026-10-29"
  },
  {
    "id": "chaine-1",
    "name": "Chaine 1 القناة الأولى",
    "category": "news",
    "streams": [
      "https://webradio1.tda.dz:8001/Chaine1_64K.mp3"
    ],
    "added": "2026-10-29"
  },
  {
    "id": "medi-1-radio",
    "name": "MEDI 1 RADIO",
    "category": "news",
    "streams": [
      "https://cdn.live.easybroadcast.io/live/83_medi1radio-maghreb_8s9i4bn/playlist.m3u8"
    ],
    "added": "2026-10-29"
  },
  {
    "id": "jil-fm",
    "name": "Jil FM",
    "category": "music",
    "streams": [
      "https://webradio1.tda.dz:8001/Jeunesse_64K.mp3"
    ],
    "added": "2026-10-29"
  },
  {
    "id": "rci-martinique",
    "name": "RCI Martinique",
    "category": "news",
    "streams": [
      "https://stream.rcs.revma.com/t0abpqyspwzuv"
    ],
    "added": "2026-10-29"
  },
  {
    "id": "tizi-ouzou",
    "name": "Tizi Ouzou تيزي وزو",
    "category": "news",
    "streams": [
      "https://webradio2.tda.dz:8001/TiziOuzou_64K.mp3"
    ],
    "added": "2026-10-29"
  },
  {
    "id": "coran",
    "name": "Coran القرآن الكريم",
    "category": "devotional",
    "streams": [
      "https://webradio1.tda.dz:8001/Coran_64K.mp3"
    ],
    "added": "2026-10-30"
  },
  {
    "id": "zaman-fm",
    "name": "Zaman FM زمان",
    "category": "news",
    "streams": [
      "https://webradio2.tda.dz:8001/Zamen_64K.mp3"
    ],
    "added": "2026-10-30"
  },
  {
    "id": "oran",
    "name": "Oran وهران",
    "category": "news",
    "streams": [
      "https://webradio2.tda.dz:8001/Oran_64K.mp3"
    ],
    "added": "2026-10-30"
  },
  {
    "id": "exo-fm-reunion",
    "name": "Exo FM Réunion",
    "category": "music",
    "streams": [
      "https://exofmreunion.ice.infomaniak.ch/exofmreunion-64.aac"
    ],
    "added": "2026-10-31"
  },
  {
    "id": "rtl-100-80",
    "name": "RTL 100% 80",
    "category": "music",
    "streams": [
      "https://live.m6radio.quortex.io/webpHJPXnXrN7B6J7Q8mcqmxP/webradio/rtl100pc80/130/audio-64000/index.m3u8"
    ],
    "added": "2026-10-31"
  },
  {
    "id": "jesus-is-lord-radio",
    "name": "JESUS IS LORD Radio",
    "category": "devotional",
    "streams": [
      "https://s3.radio.co/s97f38db97/listen"
    ],
    "added": "2026-10-31"
  }
];
window.STATIONS_CHECKED = "2026-10-31T06:43Z";
