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
  },
  {
    "id": "nhk-world-radio",
    "name": "NHK WORLD RADIO",
    "category": "news",
    "streams": [
      "https://nhkworld-radio.nhkworld.jp/hls/live/nhkworld-radio-media2/index.m3u8"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "kbs-classic-fm",
    "name": "KBS Classic FM",
    "category": "music",
    "streams": [
      "https://1fm.gscdn.kbs.co.kr/1fm_192_2.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8xZm0uZ3NjZG4ua2JzLmNvLmtyLyoiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTI4MTMwOTF9fX1dfQ__&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=mvmj5AjA1l3fxWu7uzLkxU~-MhyOtzblLm7pJD55i7ZSj6aaU2dYgPq~42eYC81kaN97PEV~uvHMOv2FjQuk7nHy1HaEPTrsoM9wOcD45UCcszucF6Vh02ACY5F32OnfN~xTh-E2HJbCOenYmPIj4jLgQ0pCoH5NiYqv1lBYAiD~q4aQ0QG0o4tlA3k5KtMacs3zmEbEtKuyP~vvjS7dzE465TjNOuuEqYZCe9bPmpQbjyYdGDn3zpjM-vguLtvnzvJyvPPwkeq~ek~ruqfN7Yh~eQTPMHrQhlOSZFyImbf6jiZv~jyGhLBlLw3-HozLeR77O3y0BWe221OI7dulLw__"
    ],
    "added": "2026-10-22",
    "offline": true
  },
  {
    "id": "sbs-power-fm",
    "name": "SBS Power FM",
    "category": "music",
    "streams": [
      "https://radiolive.sbs.co.kr/powerpc/powerfm.stream/playlist.m3u8?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTI2ODYwMTAsInBhdGgiOiIvcG93ZXJmbS5zdHJlYW0iLCJkdXJhdGlvbiI6LTEsInVubyI6IjlkMDFiOGE3LThlMDMtNDFkYS1iYWZhLTM1YzYyZGU5NzdlNCIsImlhdCI6MTc5MjY0MjgxMH0.PMNO73j0Gu8tDxuzEDDcbUuhW9OUZBZSYD__4ffU3R4"
    ],
    "added": "2026-10-22",
    "offline": true
  },
  {
    "id": "kbs-1radio",
    "name": "KBS 1Radio",
    "category": "music",
    "streams": [
      "https://2radio-bora.gscdn.kbs.co.kr/2radio-bora-01/2radio-bora-01_hd.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8ycmFkaW8tYm9yYS5nc2Nkbi5rYnMuY28ua3IvMnJhZGlvLWJvcmEtMDEvKiIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5MjgyOTk3OH19fV19&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=E8D8SD3Yu6sh1AA5e1zt8I6catGSMg4oIYNaJidlPY2oc~oHzwQftQ5Yzb6xvd2uZqc~E1L721kgKvVwfybyCcCxnJLbbfdGmewqhUfytnIP-2kJT3mM3nX85CdOTKV1SU6z85UT1toYA-4IgKtTNxdyh2f9hHCOtyid5hvEJSheYovtNvpjvgNzNUPG~ZJ4QZPpOzg5Xc32XY6vnqM7rWkvB6P~GA9JYbmMecMvquYFkMfxdnDp~2U13QmYmJle8iToe5na6gzjd7U33bXnSw1uvWFkyuw0zpg0klN~qNMvuF-0mjJ8G8JVbAJj09bqtPz0EZX0xS0MD4ifWnqW5Q__"
    ],
    "added": "2026-10-22",
    "offline": true
  },
  {
    "id": "kbs-cool-fm",
    "name": "KBS Cool FM",
    "category": "music",
    "streams": [
      "https://2fm-ad.gscdn.kbs.co.kr/2fm_ad_192_1.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8yZm0tYWQuZ3NjZG4ua2JzLmNvLmtyLyoiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTI3OTE1NjJ9fX1dfQ__&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=QgtE3eaQycyAqCFRMR7EDWEx5BePNVRBT8XZgANvywVr2D6a6gL1irZIihZ3ji7aU7cgGUNMyPzJnw3h-oJlmCqrygP-x5tjOCZ2jQ~ihT1q5e~pqDbhbwxCVwxofGf9cuSZsmi~ZpBBRRNjS23tz6SLG6g0-Ya5ZX2FFvAxwALz68uEUm2gEmhrTJRUw9Y81B6QCx4~i6i3AZadtjfUGThWWEeAN872eAQfmwP8z--MV~Z05h1BxLEP9J9qZCw1T4IKKdVxUOt8Gr~oHbScMJI4APMqQfjrvolyXRiqWl2JWwEWOAKOQnO79mdAWIWfRHQZ~o70MnrUMlvtb3xEKw__"
    ],
    "added": "2026-10-22",
    "offline": true
  },
  {
    "id": "cjrk-fm-102-7-east-fm-toronto-on",
    "name": "CJRK-FM 102.7 \"East FM\" Toronto, ON",
    "category": "music",
    "streams": [
      "https://centova.radioservers.biz/proxy/eastfmc1/stream"
    ],
    "added": "2026-10-22"
  },
  {
    "id": "mbc-fm4u",
    "name": "MBC FM4U",
    "category": "music",
    "streams": [
      "https://live.andongmbc.co.kr/live/fmlive/playlist.m3u8",
      "https://minimw.imbc.com/dmfm/_definst_/mfm.stream/playlist.m3u8?_lsu_sa_=69B1841A83103904DB45D5B53A31F34E05893FF57800F2363B60E3a516B63EC69Ea8D3AF3FD22C47E01436A1A7bAB1A9EEEA0436F3BB215246FC2773FDDCCC9FF6C04EF472B03A7E6C74A6420BBABFD0BE4B65F3FF21D5C79980F3A1E519BFEF184543F44EFCDDF1FF6E44E347653B1F"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "mbc-fm",
    "name": "MBC FM",
    "category": "music",
    "streams": [
      "https://minisw.imbc.com/dsfm/_definst_/sfm.stream/playlist.m3u8?_lsu_sa_=68919E1363883D34B742559934D1FF47259F32B5C000821F3840ABa5A6AF3726A6a663783BD25A45F0BF34A1B6bD71D5C345F4F61278F2959F0858196353AF9407330DA027CA0C6978619518ADDCED4D7A1637155985D2ECC6AAF778E76AED6B790730144F878DD339BEE1A3D0FAB467"
    ],
    "added": "2026-10-23",
    "offline": true
  },
  {
    "id": "big-b-radio-asian-pop",
    "name": "Big B Radio - Asian pop",
    "category": "music",
    "streams": [
      "https://antares.dribbcast.com/proxy/apop?mp=/s?"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "fm105-2",
    "name": "평양FM105.2",
    "category": "music",
    "streams": [
      "https://listen7.myradio24.com/69366"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "fm-2",
    "name": "평양FM",
    "category": "news",
    "streams": [
      "https://listen7.myradio24.com/69366"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "mbc-fm4u-2",
    "name": "안동MBC FM4U",
    "category": "music",
    "streams": [
      "https://live.andongmbc.co.kr/live/fmlive/playlist.m3u8"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "ebs-tv-kids",
    "name": "EBS TV-Kids",
    "category": "music",
    "streams": [
      "https://ebsonairios.ebs.co.kr/ebsufamilypc/familypc1m/playlist.m3u8"
    ],
    "added": "2026-10-24"
  },
  {
    "id": "buddhist-true-network-tv",
    "name": "Buddhist True Network TV",
    "category": "devotional",
    "streams": [
      "https://btn.nowcdn.co.kr/btn/btnlive01/playlist.m3u8"
    ],
    "added": "2026-10-24"
  },
  {
    "id": "ebs-tv-1",
    "name": "EBS TV-1",
    "category": "music",
    "streams": [
      "https://ebsonair.ebs.co.kr/groundwavefamilypc/familypc1m/playlist.m3u8"
    ],
    "added": "2026-10-24"
  }
];
window.STATIONS_CHECKED = "2026-10-24T17:12Z";
