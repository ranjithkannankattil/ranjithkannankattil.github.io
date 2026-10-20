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
    ]
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
  }
];
window.STATIONS_CHECKED = "2026-10-20T23:46Z";
