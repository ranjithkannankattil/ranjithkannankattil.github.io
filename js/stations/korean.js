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
      "https://1fm.gscdn.kbs.co.kr/1fm_192_2.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8xZm0uZ3NjZG4ua2JzLmNvLmtyLyoiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTQxMTAzODN9fX1dfQ__&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=Q-6D8qKpBUZwUyDRv43aZSdAtZayES-JV07vz1zTBLAV9dG3e0VdwDTNPZ55~89~BCgMI0QK4ATbYQ8ZjcWm~0UW3uGX0wQtF4Iz87qYmg77u7BWv6qs3F1BAcVEc0-I2nCcrDF9vYoRnVf973jped9TWmi66Wc9Eg1r6ZgiK2-hin5Ked0~bxg~hEwuiqYuOXl~-I2EClps2JG1o9Yru6oD1vLoTBubFYsLcdJIqpga0jUJW3idgxR7uakuJiO01grtN0KAvIJdhaYXV7HdTtU2rPf~TEUoi3QykXo7QRYOhPaiPdOFZR8mF4dpmLJGINa~dkL40~~nKv1sdQSbgw__",
      "https://1fm.gscdn.kbs.co.kr/1fm_192_2.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8xZm0uZ3NjZG4ua2JzLmNvLmtyLyoiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTM2NzgzOTd9fX1dfQ__&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=nZk4tXIZP2vAT77B0qkqUFU83wdASgj5eseWijT4yh0IniIZZnh7VketzSW01~3H6imOR-Zv1h1tsTggh1H1x8LyxzE9Sai4vO~pjbcVctfhU6QaqRAQ0WrOIGXm2EWENXmPaNYWm-OX~1H8bp7TWt-961WekfMf3yhemJlPpsF9902-oFIGFHT1SDLzbdyGeDkMCRJOZmkRWYt4CZwmBU8BJmVTRjV9ZEjjjzKLk5RpocwkYgOUglfNRbZ0mU~0Tr6o0hoSf-am5ZM0AEdGKJ6KSnibi4UdR0c1Q-5rx~Ig8U5ZkZ~lsQY8DzbsKsY~Yz-sT5SLu2rKuBJQc1GYWA__"
    ],
    "added": "2026-10-22",
    "offline": true
  },
  {
    "id": "sbs-power-fm",
    "name": "SBS Power FM",
    "category": "music",
    "streams": [
      "https://radiolive.sbs.co.kr/powerpc/powerfm.stream/playlist.m3u8?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTM5ODMyMDcsInBhdGgiOiIvcG93ZXJmbS5zdHJlYW0iLCJkdXJhdGlvbiI6LTEsInVubyI6ImMzNjgwM2E5LTFlMjktNDMxMC1iYWE4LTRjYzk4MmE5NDJmNSIsImlhdCI6MTc5Mzk0MDAwN30.FTR0W6RYHq40WGd3Dj3PvMqXVFnpw70RzzmaUEd13o0",
      "https://radiolive.sbs.co.kr/powerpc/powerfm.stream/playlist.m3u8?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTM1NTEyMDUsInBhdGgiOiIvcG93ZXJmbS5zdHJlYW0iLCJkdXJhdGlvbiI6LTEsInVubyI6ImM1MmU1MTYzLTAxN2MtNDEyYi1hMzExLWUxMWYwY2FjMGI0YyIsImlhdCI6MTc5MzUwODAwNX0.SqeLhr52pGzha977F63zywtDhY4fQ5-QYIYPomy4tSM"
    ],
    "added": "2026-10-22",
    "offline": true
  },
  {
    "id": "kbs-1radio",
    "name": "KBS 1Radio",
    "category": "music",
    "streams": [
      "https://2radio-bora.gscdn.kbs.co.kr/2radio-bora-01/2radio-bora-01_hd.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8ycmFkaW8tYm9yYS5nc2Nkbi5rYnMuY28ua3IvMnJhZGlvLWJvcmEtMDEvKiIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5NDEyOTU5Mn19fV19&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=iuNprM-kmzIs3v44fdDDXSY9-tVxo~6G7MbzR8SLsrDIFi7goVjAqa4wRYp0FlhTojCapKDZlVouZIG2GWWP7A1bk-WnabZSe5UTCnHpIiK8rVLdbCBT9L3mlkZUpJqnn9Y7QpPfu6hZVrlD47zXgS6Kp28PCjNEGNCW30DQqbcpMt3fbd~P7SUn5kBg6zkFf8Bmf-0c0VxymxBppkAszbzFTBw9~20GwQpPErC8C531gwesQzcGRy-fUVOIjbYFlh4CqCgTMqGaIpiwf9bgwKDSaRWcDIsSW3DvYzlj6UHyaJ~BVrf2JGdroLuCkIdr6Dbf1MaV4-YVqBDrSyrnVQ__",
      "https://2radio-bora.gscdn.kbs.co.kr/2radio-bora-01/2radio-bora-01_hd.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8ycmFkaW8tYm9yYS5nc2Nkbi5rYnMuY28ua3IvMnJhZGlvLWJvcmEtMDEvKiIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5MzY5NjM4MH19fV19&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=kaVuof3zZ71CkFHyxNd69O~qD1fnpfDRs~UedNhkMf4po1l7V0ht7GNtefxszGX85Ym0DruadEBhM6EGZTAzqqGQzVGnOa5iAi20z4Wo--MHccI7DUygt6bl0BBzjXMQfW44scqPN1JMRlijjmFP7IZVyv8jA97pIbpBt-YkOH1PuIa1sJYwfrf8AgH7EDM6v~2TUPrYQs4KBg-gl8as7UQZ3OwMa45YjBKS0YlB76jU3J248HRQydYINIKGTp2dLOCzK5P8rf6drOvWbQQMfMhUEvl5Pr~C1Mf164A4yQqFb727DJWeWvw6MPjEd-EOFvo1KSV-slwKJO3ft0OHew__"
    ],
    "added": "2026-10-22",
    "offline": true
  },
  {
    "id": "kbs-cool-fm",
    "name": "KBS Cool FM",
    "category": "music",
    "streams": [
      "https://2fm-ad.gscdn.kbs.co.kr/2fm_ad_192_1.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8yZm0tYWQuZ3NjZG4ua2JzLmNvLmtyLyoiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTQwOTIzOTR9fX1dfQ__&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=C85jy7mKLZS7m5eb4hIXWKqN41hPtPovPwkvRrC-Hu~nMJWtm1xyUGKo06I7Clgc171a0JvPHdwbk58HMWlShYL36fcg0zCO9PwlkdqSneOZTLHH~QyZb0NTa219ZLoA~cGwjt8mD87BE7l8YaBPOh49lhXRJZ4-HheOjuZC584xyfj-XpwiZBz4iJ7peEp1BJD0Cpgo2F5GuWEIqz7l9Trqq7y2Xwnz7-FpiLXssWQtEFK~6SGNTx~WQp1cAK4O2~kulu21L2-TOI8mrgKAOw53ZggQhwqfwcLhWW5RELHFTJpKQ~XFB-cTJKbxpbIfRgf3u5nG1eGxG~StJylv2Q__",
      "https://2fm-ad.gscdn.kbs.co.kr/2fm_ad_192_1.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8yZm0tYWQuZ3NjZG4ua2JzLmNvLmtyLyoiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTM2NTkxNjR9fX1dfQ__&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=K971H~TYyRfroye4mfqpGrRI-oW1rXzrb30u6V9YbagzyvPPfWXg3RkyWzmrLQBZvn0vfc2DsXt0vL3XfkmO2OooAN4cl6UpAXybxYzYKj2CsAy~~BjCdQbDURZs-90p3zejrBX61BbutZkZYtKCUV1j8T2jzvbG8avxF0YYDotDL2CAoxb-M70XqafqkLHK9iT1RVoFbSKHI5N7Ng3Mc2c0ylhXB9Nit3YvkzNd25Ldtl3YBrOcdi2scWffTN4BiwUNpolCMZGcLLRUcbntjtBJK8dmodjbxU6EH3BGf2O2z~A2TRyRScg8yNnmsRDUQ2ahfGkZV~NTWi~LD6ciMw__"
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
      "https://live.andongmbc.co.kr/live/fmlive/playlist.m3u8"
    ],
    "added": "2026-10-23"
  },
  {
    "id": "mbc-fm",
    "name": "MBC FM",
    "category": "music",
    "streams": [
      "https://minisw.imbc.com/dsfm/_definst_/sfm.stream/playlist.m3u8?_lsu_sa_=6651ED14839C3D64DB4C951A3C71684B95FE35658407F25F321060a246793656A8aF83E23EB2734EE03E35314Eb5412B06E420F5DDF094200F1DF8DAD17C0684A0BD36FB121A015A653770786D0700CDCA57C52CB7E374FF81462855FAEFF89194462994594075F3759D5DF4FB2F353C",
      "https://minisw.imbc.com/dsfm/_definst_/sfm.stream/playlist.m3u8?_lsu_sa_=6C213512E3C43554E848B5673E913F49B59D3FC5B40AD2F731504DaDE68337067Ca0335932D2E64250DC392137b981CF67A36F3A6FEBBF4E377CAE80B9C5D70FC366EDDFB9A480245DF74EE8AEA1B20F31FD6B1C3F0D5138FAB535560F5C3DF5001B4C9A10D1D5DCD4FEF65BD33D045B"
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
  },
  {
    "id": "cbs-joy4u",
    "name": "CBS JOY4U",
    "category": "devotional",
    "streams": [
      "https://m-aac.cbs.co.kr/mweb_cbscmc/_definst_/cbscmc.stream/playlist.m3u8"
    ],
    "added": "2026-10-25"
  },
  {
    "id": "chkg-fm-96-1-fairchild-radio-vancouver-b",
    "name": "CHKG-FM 96.1 \"Fairchild Radio\" Vancouver, BC",
    "category": "music",
    "streams": [
      "https://5b2959fe11444.streamlock.net/radio/fm961.stream/playlist.m3u8"
    ],
    "added": "2026-10-25"
  },
  {
    "id": "ebs-tv-i",
    "name": "EBS TV-i",
    "category": "music",
    "streams": [
      "https://ebsonairios.ebs.co.kr/plus1familypc/familypc1m/playlist.m3u8"
    ],
    "added": "2026-10-25"
  },
  {
    "id": "gukak-tv",
    "name": "Gukak TV",
    "category": "music",
    "streams": [
      "https://mgugaklive.nowcdn.co.kr/gugakvideo/gugakvideo.stream/playlist.m3u8"
    ],
    "added": "2026-10-25"
  },
  {
    "id": "96-kool-fm",
    "name": "96 KOOL FM",
    "category": "music",
    "streams": [
      "https://stream.zeno.fm/97qzdqafuqzuv"
    ],
    "added": "2026-10-25"
  },
  {
    "id": "vibe-radio",
    "name": "Vibe Radio",
    "category": "music",
    "streams": [
      "https://stream.zeno.fm/zf0ac4raqy8uv"
    ],
    "added": "2026-10-25"
  },
  {
    "id": "station",
    "name": "韩国音乐台",
    "category": "music",
    "streams": [
      "https://stream.zeno.fm/r0tbse9jnbptv"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "cinz-net-radio",
    "name": "CINZ NET Radio",
    "category": "music",
    "streams": [
      "https://stream.cinz.net/"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "fred-film-radio",
    "name": "Fred Film Radio(한국어)",
    "category": "music",
    "streams": [
      "https://s10.webradio-hosting.com/proxy/fredradiokr/stream"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "ebs-tune-in",
    "name": "ebs tune in",
    "category": "music",
    "streams": [
      "https://ebsonair.ebs.co.kr/fmradiofamilypc/familypc1m/playlist.m3u8"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "rmf-k-pop",
    "name": "RMF K-Pop",
    "category": "music",
    "streams": [
      "https://rs8-krk2-cyfronet.rmfstream.pl/GAMEMUSIC"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "station-2",
    "name": "아리랑모바일방송",
    "category": "music",
    "streams": [
      "https://lhttp.qingting.fm/live/5022144/64k.mp3"
    ],
    "added": "2026-10-26"
  },
  {
    "id": "gugakfm",
    "name": "GugakFM",
    "category": "music",
    "streams": [
      "https://mgugaklive.nowcdn.co.kr/gugakradio/gugakradio.stream/chunklist_w1653570079.m3u8",
      "https://mgugaklive.nowcdn.co.kr/gugakradio/gugakradio.stream/chunklist_w253831608.m3u8"
    ],
    "added": "2026-10-27"
  },
  {
    "id": "station-3",
    "name": "延边朝鲜语新闻综合广播",
    "category": "music",
    "streams": [
      "https://lhttp-hw.qtfm.cn/live/20324/64k.mp3"
    ],
    "added": "2026-10-27"
  },
  {
    "id": "gukak",
    "name": "Gukak",
    "category": "music",
    "streams": [
      "https://mgugaklive.nowcdn.co.kr/gugakradio/gugakradio.stream/playlist.m3u8"
    ],
    "added": "2026-10-27"
  },
  {
    "id": "kbs-1r",
    "name": "KBS 1R",
    "category": "music",
    "streams": [
      "https://1radio-bora.gscdn.kbs.co.kr/1radio-bora-01/1radio-bora-01_hd.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8xcmFkaW8tYm9yYS5nc2Nkbi5rYnMuY28ua3IvMXJhZGlvLWJvcmEtMDEvKiIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5NDE0NjM5Mn19fV19&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=Ui7PH99GHvFk-9xkWhIwzGdzQVdbitKhTCw5uymNaSKcwufkjrDsPnFtjWhppgv7IxbWNxxsLB0Ks0ARvEUPAcQC3IKRaai3qRxl9uXJz6Bb7zN9052tmk7lop93d-HPZSPN5Ufe-zCvnAAGq7mufJWchYneRAlvRodOT58EOmlhLcqOinveEzAL6SNZEcYsxNVIZGadRP422BjfA7z~bf071TR2eMEgIfailRmLnhNvNT7hlWq0hDorP7yrDn55XqyZKhpucgGpmHRu16TB3BKDhYeU7twE38nz-nuMDp7as8db6f~FLr9SU2cuyqCJWaqq9HNP36LI~pTSnPc1GA__",
      "https://1radio-bora.gscdn.kbs.co.kr/1radio-bora-01/1radio-bora-01_hd.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8xcmFkaW8tYm9yYS5nc2Nkbi5rYnMuY28ua3IvMXJhZGlvLWJvcmEtMDEvKiIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5MzcxMzIwNn19fV19&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=eDvDH75Q3QTu-J1j1tW17tGkLPSpFFGpFiUJAR~zTiWkjXE6GPnyYQVAvlfHBf2d8AeNsU0I-cCIC3jSRekiXEuB~iZgKOxSfBK0FDVtdnqNoWrr9vLOpAhjU51vINerSYfY0jcikHV~2at77yS4xNAQBsSb3gyWiRNn59rFNRUsH131rm3lUdegJNnKr3yv5v7Rt6hVH2hb~kNNs0D~rP5cdurNzftoPA6rB17Nn5h0GJQesefTqvIJh3h455QehRJ0pHUaMfKAb26AT0m1Ae7TyWExwFCvgOt8IhP9glRbRz7Qd5fTZYWRjJ-E8p5wbjRxV8ZwaBHk1s0HGNdAkg__"
    ],
    "added": "2026-10-27",
    "offline": true
  },
  {
    "id": "kbs",
    "name": "Kbs",
    "category": "music",
    "streams": [
      "https://1fm.gscdn.kbs.co.kr/1fm_192_2.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8xZm0uZ3NjZG4ua2JzLmNvLmtyLyoiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTQxMzc5NjV9fX1dfQ__&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=Z1SPqpRUd4kFiDaLk45PxR5i5uc3Y6dzIrJn~Ny2XIsZKOHMLJEA4uVCbrgDGPRiESX-LV5AkIKz8NknESFts5rfvLXaG7CZHyeGlx~SWbrGG~YtsUTLdWtqnrJil6DWav3iog6by8cjSRCtax8C9Ud2Hsk7N1Z51K2WyYOcHjZwBq1QFvxgjlR-gO~gU3jrNFeMN~9305lYzrxas9hFDCgy5XhZRAkyjocEcW7l1ImKC2OesvGnIGRfzREsl86Ph~cFuLSLL5Bj2iOaVIDwhZOk~guDhtBMHIbEMt4KRSs0u7~R4bIsK9erN-EgXdtzeGmZnNL6vHPOI9bN3b5GXA__",
      "https://1fm.gscdn.kbs.co.kr/1fm_192_2.m3u8?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly8xZm0uZ3NjZG4ua2JzLmNvLmtyLyoiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTM3MDQ3NTl9fX1dfQ__&Key-Pair-Id=APKAICDSGT3Y7IXGJ3TA&Signature=brrU~fF0QpHradtCWr7M7yBhemDR4JUbH9kPPaZmTBaXCM2yvVDm7CQj6xuElI5jDRRMFxDKJnXTtbIcm5lE-RCjMIPWfb6-tD1TGEgSK-dj2~I-qfSldiUKhvFxnsX5gdyRQx6G~iGwfjG~6G2aHLlqKlW-JtNHLr09q3FKc2QPD9h9eNwWgrM02OlQHqKK5CluY0KCDSKRZ5t9kPlwhg4f4fsRCmTjPYwjwa49J3hVcGDubDqFOYHiHgkBUm-uFf~niqQDdx6GFkZ1X6dUyl0h4vvpqnHDTlqNqotYhHTJHNLD0PMfrn92HWy5lVP6AcGcd1YLk0uqx~-XZfZBwQ__"
    ],
    "added": "2026-10-27",
    "offline": true
  },
  {
    "id": "station-4",
    "name": "黑龙江朝语广播",
    "category": "music",
    "streams": [
      "https://satellitepull.cnr.cn/live/wx32hljcygb/playlist.m3u8?wsSession=a919bd0baf31a1a6f3966f08-174778330216034&wsIPSercert=2683acdad9e689f89519c7ec3f7e218b"
    ],
    "added": "2026-10-27"
  },
  {
    "id": "whrw-binghamton-90-5-fm",
    "name": "WHRW Binghamton 90.5 FM",
    "category": "music",
    "streams": [
      "https://stream.whrwfm.org/new"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "europa-plus-k-pop",
    "name": "Europa Plus K-Pop",
    "category": "music",
    "streams": [
      "https://hls-01-europaplus-kpop.emgsound.ru/europaplus-kpop/112/playlist.m3u8"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "ebs-tv-e",
    "name": "EBS TV-e",
    "category": "music",
    "streams": [
      "https://ebsonair.ebs.co.kr/plus3familypc/familypc1m/playlist.m3u8"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "ebs-tv-plus-2",
    "name": "EBS TV-Plus 2",
    "category": "music",
    "streams": [
      "https://ebsonairios.ebs.co.kr/plus2familypc/familypc1m/playlist.m3u8"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "cnr-8",
    "name": "CNR-8 民族之声 조선어방송  ",
    "category": "music",
    "streams": [
      "https://satellitepull.cnr.cn/live/wxmzzs/playlist.m3u8?wsSession=a919bd0baf31a1a6f3966f08-174761703245334&wsIPSercert=270c8446fe14303f2433a2f164ccd9e5"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "ebs-tv-2",
    "name": "EBS TV-2",
    "category": "music",
    "streams": [
      "https://ebsonair.ebs.co.kr/ebs2familypc/familypc1m/playlist.m3u8"
    ],
    "added": "2026-10-28"
  },
  {
    "id": "bbn-korean",
    "name": "BBN Korean",
    "category": "devotional",
    "streams": [
      "https://streams.radiomast.io/678de728-1691-4eb7-bf37-057bcc9b12f5"
    ],
    "added": "2026-10-29"
  },
  {
    "id": "station-5",
    "name": "延边朝鲜语文艺生活广播 문예생활방송",
    "category": "music",
    "streams": [
      "https://srs.iybtv.cn/audio/FM1023/index.m3u8"
    ],
    "added": "2026-10-29"
  },
  {
    "id": "hit-fm-k-pop-hits",
    "name": "HIT FM K-Pop Hits",
    "category": "music",
    "streams": [
      "https://radio3.dixi.md/listen/kpop_hits/kpop_hits.aac"
    ],
    "added": "2026-10-29"
  },
  {
    "id": "station-6",
    "name": "Радио Группы Солидарности с КНДР",
    "category": "music",
    "streams": [
      "https://stream.zeno.fm/i3q4bwnzxp1uv"
    ],
    "added": "2026-10-31"
  },
  {
    "id": "sbs-love-fm",
    "name": "SBS Love FM",
    "category": "music",
    "streams": [
      "https://radiolive.sbs.co.kr/lovepc/lovefm.stream/playlist.m3u8?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTQwMjY0MTksInBhdGgiOiIvbG92ZWZtLnN0cmVhbSIsImR1cmF0aW9uIjotMSwidW5vIjoiYTI1ZGFiNTQtYTBkNS00NTFiLWIyNTYtMzIzMDQ0YzEzM2FkIiwiaWF0IjoxNzkzOTgzMjE5fQ.GqQJtXtPEZtbeySXupneg5CA_gr-dnBJTtsp9qXotng",
      "https://radiolive.sbs.co.kr/lovepc/lovefm.stream/playlist.m3u8?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTM5NjUyMTAsInBhdGgiOiIvbG92ZWZtLnN0cmVhbSIsImR1cmF0aW9uIjotMSwidW5vIjoiMzNiZTIzODgtY2NhOS00NmEyLTg5NDAtNTlmNzVlNjM3ZGJkIiwiaWF0IjoxNzkzOTIyMDEwfQ.65i79TrMp7Roo5IjzfSkP_IsHacFtbNl05jxzG3knP0",
      "https://radiolive.sbs.co.kr/lovepc/lovefm.stream/playlist.m3u8?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTM1OTMyMTYsInBhdGgiOiIvbG92ZWZtLnN0cmVhbSIsImR1cmF0aW9uIjotMSwidW5vIjoiOWU2OWY2NGEtNTYxNS00NDVhLWFmMDgtMTMxNWZmYTVkNjA0IiwiaWF0IjoxNzkzNTUwMDE2fQ.axrOOsMvKadHEYMmSN1AEqn3OQs5Gr3HvtIDp-jvSis",
      "https://radiolive.sbs.co.kr/lovepc/lovefm.stream/playlist.m3u8?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTM1MzIwMDksInBhdGgiOiIvbG92ZWZtLnN0cmVhbSIsImR1cmF0aW9uIjotMSwidW5vIjoiMGRlMTZiNDAtY2QwOC00YWE3LTlmMzItNjMwMTdmY2U2YWRmIiwiaWF0IjoxNzkzNDg4ODA5fQ.zf9ccNbG4dsNoGSXfjhnfPdjsOyeifxWhIYV7u5aaoU"
    ],
    "added": "2026-11-01",
    "offline": true
  },
  {
    "id": "cpbc",
    "name": "CPBC",
    "category": "music",
    "streams": [
      "https://cdn-radio-seoul.cpbc.co.kr/cpbcseoul/playlist.m3u8?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTM5ODQ0MjEsInBhdGgiOiIvY3BiY3Nlb3VsIiwiZHVyYXRpb24iOi0xLCJ1bm8iOiIzOWQ3Zjk2ZC01YzcwLTRmOWEtYWMwMi1jNjU0ZjJjYjIyYjYiLCJpYXQiOjE3OTM5NDEyMjF9.2cQIV2_xk2WLsR-eQg59ut5jDlAKqxA8k3-8l2IjxEE",
      "https://cdn-radio-seoul.cpbc.co.kr/cpbcseoul/playlist.m3u8?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTM1NTI0MjMsInBhdGgiOiIvY3BiY3Nlb3VsIiwiZHVyYXRpb24iOi0xLCJ1bm8iOiI1NzQzNmU3Ny1mNWJhLTRjZGQtYjUwOC1mMTYyMzllODE1YWEiLCJpYXQiOjE3OTM1MDkyMjN9.JFWnNAKyIKd1x7icQIzX3GLfAPrp5G5sfChyaIULwhQ"
    ],
    "added": "2026-11-01",
    "offline": true
  },
  {
    "id": "translation-of-the-quran-in-korean",
    "name": "Translation of the Quran in Korean",
    "category": "devotional",
    "streams": [
      "https://serverkw.quran-uni.com:8136/;"
    ],
    "added": "2026-11-03"
  }
];
window.STATIONS_CHECKED = "2026-11-10T21:05Z";
