/* English News radio stations for radio.html — every stream was play-tested on ranjithkb.com.
   Checked twice a day by scripts/check_streams.py (GitHub Actions).
   streams: tried in order; offline: set by the check when none work */
window.STATIONS = [
  {
    "id": "bbc-world-service",
    "name": "BBC World Service",
    "category": "uk",
    "streams": [
      "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service",
      "https://as-hls-ww-live.akamaized.net/pool_87948813/live/ww/bbc_world_service/bbc_world_service.isml/bbc_world_service-audio%3d128000.norewind.m3u8"
    ],
    "where": "UK"
  },
  {
    "id": "npr-24-hour-program-stream",
    "name": "NPR 24 Hour Program Stream",
    "category": "us",
    "streams": [
      "https://npr-ice.streamguys1.com/live.mp3"
    ],
    "where": "US"
  },
  {
    "id": "cnn",
    "name": "CNN",
    "category": "us",
    "streams": [
      "https://tunein.cdnstream1.com/2868_96.mp3"
    ],
    "where": "US"
  },
  {
    "id": "cnn-international-audio",
    "name": "CNN International Audio",
    "category": "us",
    "streams": [
      "https://tunein.cdnstream1.com/3519_96.aac"
    ],
    "where": "US"
  },
  {
    "id": "fox-news-radio",
    "name": "Fox News Radio",
    "category": "us",
    "streams": [
      "https://live.amperwave.net/direct/foxnewsradio-foxnewsradioaac-imc?source=fnr.web"
    ],
    "where": "US"
  },
  {
    "id": "msnbc",
    "name": "MSNBC",
    "category": "us",
    "streams": [
      "https://tunein.cdnstream1.com/3511_96.mp3"
    ],
    "where": "US"
  },
  {
    "id": "nbc-news-radio",
    "name": "NBC News Radio",
    "category": "us",
    "streams": [
      "https://stream.revma.ihrhls.com/zc6043"
    ],
    "where": "US"
  },
  {
    "id": "cbs-news",
    "name": "CBS News",
    "category": "us",
    "streams": [
      "https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8"
    ],
    "where": "US"
  },
  {
    "id": "sky-news-australia-radio",
    "name": "Sky News Australia Radio",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/NOVA_SKYNEWSAAC.aac"
    ],
    "where": "Australia"
  },
  {
    "id": "gb-news",
    "name": "GB News",
    "category": "uk",
    "streams": [
      "https://listen-gbnews.sharp-stream.com/gbnews.mp3"
    ],
    "where": "UK"
  },
  {
    "id": "times-radio",
    "name": "Times Radio",
    "category": "uk",
    "streams": [
      "https://timesradio.wireless.radio/stream"
    ],
    "where": "UK"
  },
  {
    "id": "lbc-news",
    "name": "LBC News",
    "category": "uk",
    "streams": [
      "https://media-ssl.musicradio.com/LBCNewsUK"
    ],
    "where": "UK"
  },
  {
    "id": "al-jazeera-english",
    "name": "Al Jazeera English",
    "category": "world",
    "streams": [
      "https://live-hls-audio-web-aje.getaj.net/VOICE-AJE/01.m3u8"
    ],
    "where": "Qatar"
  },
  {
    "id": "cna-938-live-singapore",
    "name": "CNA 938 Live Singapore",
    "category": "world",
    "streams": [
      "https://28453.live.streamtheworld.com/938NOW_PREM_SC"
    ],
    "where": "Singapore"
  },
  {
    "id": "abc-newsradio",
    "name": "ABC NewsRadio",
    "category": "anz",
    "streams": [
      "https://abc.streamguys1.com/live/newsradio/icecast.audio"
    ],
    "where": "Australia"
  },
  {
    "id": "bloomberg-uk",
    "name": "Bloomberg UK",
    "category": "uk",
    "streams": [
      "https://bloomberg-live-prod-us-east-1.s3.amazonaws.com/rad/Channel-RAD-AWS-virginia-1/Source-RadUK-96-1_live.m3u8"
    ],
    "where": "UK"
  },
  {
    "id": "newstalk-ireland",
    "name": "Newstalk Ireland",
    "category": "uk",
    "streams": [
      "https://edge.audioxi.com/NT"
    ],
    "where": "Ireland"
  },
  {
    "id": "cbc-radio-one-vancouver",
    "name": "CBC Radio One Vancouver",
    "category": "canada",
    "streams": [
      "https://27033.live.streamtheworld.com/CBU2FM_CBC_SC"
    ],
    "where": "Canada"
  },
  {
    "id": "wnyc-93-9-fm",
    "name": "WNYC 93.9 FM",
    "category": "us",
    "streams": [
      "https://fm939.wnyc.org/wnycfm.aac"
    ],
    "where": "US"
  },
  {
    "id": "cgtn-radio",
    "name": "CGTN Radio",
    "category": "world",
    "streams": [
      "https://sk.cri.cn/am846.m3u8"
    ],
    "where": "China"
  },
  {
    "id": "houston-public-media-news-88-7",
    "name": "Houston Public Media News 88.7",
    "category": "us",
    "streams": [
      "https://stream.houstonpublicmedia.org/news-aac"
    ],
    "where": "US"
  },
  {
    "id": "wamu-88-5-washington",
    "name": "WAMU 88.5 Washington",
    "category": "us",
    "streams": [
      "https://wamu.cdnstream1.com/wamu.mp3"
    ],
    "where": "US"
  }
];
window.STATIONS_CHECKED = "2026-10-21T18:27Z";
