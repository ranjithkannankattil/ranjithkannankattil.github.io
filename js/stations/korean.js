/* Korean radio stations for radio.html — every stream was play-tested on ranjithkb.com.
   Checked twice a day by scripts/check_streams.py (GitHub Actions).
   streams: tried in order; offline: set by the check when none work */
window.STATIONS = [
  {
    "id": "ytn",
    "name": "YTN 라디오",
    "category": "news",
    "streams": [
      "https://radiolive.ytn.co.kr/radio/_definst_/20211118_fmlive/playlist.m3u8"
    ]
  },
  {
    "id": "tbs-fm-95-1",
    "name": "TBS FM 95.1",
    "category": "news",
    "streams": [
      "https://cdnfm.tbs.seoul.kr/tbs/_definst_/tbs_fm_web_360.smil/chunklist.m3u8"
    ]
  },
  {
    "id": "obs",
    "name": "OBS 라디오",
    "category": "music",
    "streams": [
      "https://vod3.obs.co.kr:444/live/obsstream1/radio.stream/playlist.m3u8"
    ]
  },
  {
    "id": "ifm",
    "name": "경인방송 iFM",
    "category": "music",
    "streams": [
      "https://stream.ifm.kr/live/aod1/playlist.m3u8"
    ]
  },
  {
    "id": "fm",
    "name": "국방FM",
    "category": "music",
    "streams": [
      "https://mediaworks.dema.mil.kr/live_edge/audio.sdp/playlist.m3u8"
    ]
  },
  {
    "id": "cbs-fm",
    "name": "CBS 음악FM",
    "category": "music",
    "streams": [
      "https://lhttp-hw.qtfm.cn/live/15318233/64k.mp3"
    ]
  },
  {
    "id": "replay-news",
    "name": "REPLAY NEWS 한국어",
    "category": "news",
    "streams": [
      "https://replaynewskr.ice.infomaniak.ch/replaynewskr-128.mp3"
    ]
  },
  {
    "id": "24",
    "name": "하늘호수24",
    "category": "music",
    "streams": [
      "https://cast2.sayclub.com/saycast2/24sky/llhls.m3u8"
    ]
  },
  {
    "id": "yojosuknam-radio",
    "name": "yojosuknam Radio",
    "category": "music",
    "streams": [
      "https://stream.yojosuknam.com/live.mp3"
    ]
  },
  {
    "id": "big-b-radio-k-pop",
    "name": "Big B Radio K-Pop",
    "category": "music",
    "streams": [
      "https://antares.dribbcast.com/proxy/kpop?mp=/s"
    ]
  },
  {
    "id": "listen-moe-k-pop",
    "name": "Listen.moe K-Pop",
    "category": "music",
    "streams": [
      "https://listen.moe/kpop/stream",
      "https://listen.moe/kpop/fallback"
    ]
  },
  {
    "id": "only-hits-k-pop",
    "name": "Only Hits K-Pop",
    "category": "music",
    "streams": [
      "https://kpop.onlyhit.us/play"
    ]
  },
  {
    "id": "k-radio",
    "name": "K-Radio",
    "category": "music",
    "streams": [
      "https://s5.radio.co/s0a9796fe3/listen"
    ]
  },
  {
    "id": "sbs-popasia-australia",
    "name": "SBS PopAsia (Australia)",
    "category": "music",
    "streams": [
      "https://sbs-ice.streamguys1.com/sbs-popasia-sbs-web"
    ]
  },
  {
    "id": "hallypop-radio-101-9-philippines",
    "name": "Hallypop Radio 101.9 (Philippines)",
    "category": "music",
    "streams": [
      "https://ais-edge50-live365-dal02.cdnstream.com/a63316"
    ]
  },
  {
    "id": "juka-radio-k-pop",
    "name": "Juka Radio K-Pop",
    "category": "music",
    "streams": [
      "https://juka-kpop.stream.laut.fm/juka-kpop?t302=2021-04-01_09-03-35&uuid=6aa06ca0-9a01-407d-91af-155d24c5c405"
    ]
  },
  {
    "id": "voice-of-chongro",
    "name": "Voice of Chongro",
    "category": "music",
    "streams": [
      "https://stream.zeno.fm/oldwnjuma3duv"
    ]
  },
  {
    "id": "yanbian",
    "name": "연변 뉴스종합방송 (Yanbian)",
    "category": "news",
    "streams": [
      "https://srs.iybtv.cn/audio/AM1206/index.m3u8"
    ]
  },
  {
    "id": "soshi-subs",
    "name": "Soshi-Subs",
    "category": "music",
    "streams": [
      "https://092007.xyz/radio/soshisubs"
    ]
  }
];
