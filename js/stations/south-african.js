/* Zulu, Xhosa & Sotho radio stations for radio.html — every stream was play-tested on ranjithkb.com.
   Checked twice a day by scripts/check_streams.py (GitHub Actions).
   streams: tried in order; offline: set by the check when none work */
window.STATIONS = [
  {
    "id": "jozi-fm",
    "name": "Jozi FM",
    "category": "music",
    "streams": [
      "https://edge.iono.fm/xice/51_medium.aac",
      "https://edge.iono.fm/xice/51_high.aac"
    ]
  },
  {
    "id": "izwi-lomzansi",
    "name": "Izwi LoMzansi",
    "category": "music",
    "streams": [
      "https://streaming.fabrik.fm/izwi/echocast/audio/index.m3u8"
    ]
  },
  {
    "id": "capricorn-fm",
    "name": "Capricorn FM",
    "category": "news",
    "streams": [
      "https://edge.iono.fm/xice/67_medium.aac"
    ]
  },
  {
    "id": "link-fm",
    "name": "Link FM",
    "category": "devotional",
    "streams": [
      "https://de2.streamingpulse.com/ssl/LinkFM"
    ]
  },
  {
    "id": "kariega-online-radio",
    "name": "Kariega Online Radio",
    "category": "music",
    "streams": [
      "https://stream.zeno.fm/uoscm48onclvv"
    ]
  },
  {
    "id": "kingdom-sounds-radio",
    "name": "Kingdom Sounds Radio",
    "category": "devotional",
    "streams": [
      "https://radiohost.ifastekpanel.com/listen/kingdom/live"
    ]
  },
  {
    "id": "sekhukhune-fm",
    "name": "Sekhukhune FM",
    "category": "music",
    "streams": [
      "https://edge.iono.fm/xice/301_low.aac"
    ]
  }
];
window.STATIONS_CHECKED = "2026-10-21T18:55Z";
