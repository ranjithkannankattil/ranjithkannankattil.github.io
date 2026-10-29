/* Nepali radio stations for radio.html — every stream was play-tested on ranjithkb.com.
   Checked twice a day by scripts/check_streams.py (GitHub Actions).
   streams: tried in order; offline: set by the check when none work */
window.STATIONS = [
  {
    "id": "kantipur-fm",
    "name": "Kantipur FM",
    "category": "music",
    "streams": [
      "https://radio-broadcast.ekantipur.com/stream"
    ]
  },
  {
    "id": "hits-fm-91-2",
    "name": "Hits FM 91.2",
    "category": "music",
    "streams": [
      "https://usa15.fastcast4u.com/proxy/hitsfm912?mp=/1"
    ]
  },
  {
    "id": "bbc-nepali",
    "name": "BBC Nepali",
    "category": "news",
    "streams": [
      "https://stream.live.vc.bbcmedia.co.uk/bbc_nepali_radio"
    ]
  },
  {
    "id": "kalika-fm-95-2",
    "name": "Kalika FM 95.2",
    "category": "music",
    "streams": [
      "https://streaming.softnep.net:10828/stream"
    ]
  },
  {
    "id": "ujyaalo-90-network",
    "name": "Ujyaalo 90 Network",
    "category": "news",
    "streams": [
      "https://stream.zenolive.com/wtuvp08xq1duv"
    ]
  },
  {
    "id": "radio-audio",
    "name": "Radio Audio",
    "category": "music",
    "streams": [
      "https://stream.zeno.fm/fvrx47wpg0quv"
    ]
  },
  {
    "id": "cin-khabar",
    "name": "CIN Khabar",
    "category": "news",
    "streams": [
      "https://streaming.softnep.net:10996/;stream.nsv&type=mp3&volume=60"
    ],
    "offline": true
  },
  {
    "id": "universal-health-radio",
    "name": "Universal Health Radio (नेपाली)",
    "category": "news",
    "streams": [
      "https://radio.universalhealthradio.org/uhr-ne.mp3"
    ]
  },
  {
    "id": "radio-himalaya",
    "name": "Radio Himalaya",
    "category": "music",
    "streams": [
      "https://live.itech.host/himalayaradio",
      "https://live.itech.host/himalayaradio?1588276425741"
    ]
  },
  {
    "id": "90-1-nbc-fm-sydney",
    "name": "90.1 NBC FM Sydney",
    "category": "music",
    "streams": [
      "https://studio.901nbcfm.com.au:8902/newstream"
    ],
    "offline": true
  },
  {
    "id": "tinau-fm",
    "name": "Tinau FM",
    "category": "music",
    "streams": [
      "https://streaming.softnep.net:10854/;stream.nsv;type=mp3&volume=70"
    ]
  },
  {
    "id": "butwal-fm",
    "name": "Butwal FM",
    "category": "music",
    "streams": [
      "https://streaming.softnep.net:10994/;stream.nsv"
    ]
  },
  {
    "id": "radio-thaha-sanchar",
    "name": "Radio Thaha Sanchar",
    "category": "music",
    "streams": [
      "https://streaming.softnep.net:10988/;stream.nsv&type=mp3"
    ]
  },
  {
    "id": "napho-radio-fm-88-25",
    "name": "Napho Radio FM 88.25",
    "category": "music",
    "streams": [
      "https://radio11.plathong.net/7136/;stream.mp3"
    ]
  }
];
window.STATIONS_CHECKED = "2026-10-29T19:34Z";
