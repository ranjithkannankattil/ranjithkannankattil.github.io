/* English Talk radio stations for radio.html — every stream was play-tested on ranjithkb.com.
   Checked twice a day by scripts/check_streams.py (GitHub Actions).
   streams: tried in order; offline: set by the check when none work */
window.STATIONS = [
  {
    "id": "bbc-radio-4",
    "name": "BBC Radio 4",
    "category": "uk",
    "streams": [
      "https://as-hls-ww-live.akamaized.net/pool_55057080/live/ww/bbc_radio_fourfm/bbc_radio_fourfm.isml/bbc_radio_fourfm-audio%3d128000.norewind.m3u8",
      "https://as-hls-ww-live.akamaized.net/pool_55057080/live/ww/bbc_radio_fourfm/bbc_radio_fourfm.isml/bbc_radio_fourfm-audio=128000.norewind.m3u8"
    ],
    "where": "UK"
  },
  {
    "id": "lbc",
    "name": "LBC",
    "category": "uk",
    "streams": [
      "https://media-ice.musicradio.com/LBCUKMP3Low",
      "https://media-sov.musicradio.com/LBC973MP3Low"
    ],
    "where": "UK"
  },
  {
    "id": "lbc-london",
    "name": "LBC London",
    "category": "uk",
    "streams": [
      "https://media-sov.musicradio.com/LBCLondon"
    ],
    "where": "UK"
  },
  {
    "id": "bbc-radio-scotland",
    "name": "BBC Radio Scotland",
    "category": "uk",
    "streams": [
      "https://as-hls-ww-live.akamaized.net/pool_43322914/live/ww/bbc_radio_scotland_fm/bbc_radio_scotland_fm.isml/bbc_radio_scotland_fm-audio%3d128000.norewind.m3u8"
    ],
    "where": "UK"
  },
  {
    "id": "bbc-radio-ulster",
    "name": "BBC Radio Ulster",
    "category": "uk",
    "streams": [
      "https://as-hls-ww-live.akamaized.net/pool_31244774/live/ww/bbc_radio_ulster/bbc_radio_ulster.isml/bbc_radio_ulster-audio%3d128000.norewind.m3u8"
    ],
    "where": "UK"
  },
  {
    "id": "bbc-radio-london",
    "name": "BBC Radio London",
    "category": "uk",
    "streams": [
      "https://as-hls-ww-live.akamaized.net/pool_98137350/live/ww/bbc_london/bbc_london.isml/bbc_london-audio%3d128000.norewind.m3u8"
    ],
    "where": "UK"
  },
  {
    "id": "24-7-comedy",
    "name": "24/7 Comedy",
    "category": "comedy",
    "streams": [
      "https://stream.revma.ihrhls.com/zc4902"
    ],
    "where": "US"
  },
  {
    "id": "181-fm-comedy-club",
    "name": "181.FM Comedy Club",
    "category": "comedy",
    "streams": [
      "https://listen.181fm.com/181-comedy_128k.mp3"
    ],
    "where": "US"
  },
  {
    "id": "abc-radio-national",
    "name": "ABC Radio National",
    "category": "anz",
    "streams": [
      "https://abc.streamguys1.com/live/rnnsw/icecast.audio",
      "https://mediaserviceslive.akamaized.net/hls/live/2038318/rnnsw/index.m3u8"
    ],
    "where": "Australia"
  },
  {
    "id": "abc-radio-sydney",
    "name": "ABC Radio Sydney",
    "category": "anz",
    "streams": [
      "https://mediaserviceslive.akamaized.net/hls/live/2038302/localsydney/masterhq.m3u8"
    ],
    "where": "Australia"
  },
  {
    "id": "abc-radio-melbourne",
    "name": "ABC Radio Melbourne",
    "category": "anz",
    "streams": [
      "https://mediaserviceslive.akamaized.net/hls/live/2038300/localmelbourne/masterhq.m3u8",
      "https://streaming.abc-cdn.net.au/audio/hls/localmelbourne.m3u8?source=web"
    ],
    "where": "Australia"
  },
  {
    "id": "3aw-melbourne-693",
    "name": "3AW Melbourne 693",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/3AW.mp3"
    ],
    "where": "Australia"
  },
  {
    "id": "2gb-sydney-873",
    "name": "2GB Sydney 873",
    "category": "anz",
    "streams": [
      "https://28093.live.streamtheworld.com/2GBAAC_O/HLS/playlist.m3u8"
    ],
    "where": "Australia"
  },
  {
    "id": "6pr-perth-882",
    "name": "6PR Perth 882",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/6PR.mp3"
    ],
    "where": "Australia"
  },
  {
    "id": "4bc-brisbane-882",
    "name": "4BC Brisbane 882",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/4BC.mp3"
    ],
    "where": "Australia"
  },
  {
    "id": "newstalk-zb",
    "name": "Newstalk ZB",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/NZME_01AAC.m3u8?aw_0_1st.playerid=iHeartRadioWebPlayer&aw_0_1st.skey=9631949606&clientType=web&companionAds=false&deviceName=web-desktop&dist=iheart&host=webapp.NZ&listenerId=&playedFrom=157&pname=live_profile&profileId=9631949606&stationid=6187&terminalId=162&territory=NZ"
    ],
    "where": "New Zealand"
  },
  {
    "id": "cbc-radio-one-ottawa",
    "name": "CBC Radio One Ottawa",
    "category": "canada",
    "streams": [
      "https://cbcradiolive.akamaized.net/hls/live/2041037/ES_R1ETT/adaptive_128/chunklist_ao.m3u8"
    ],
    "where": "Canada"
  },
  {
    "id": "wabc-770-new-york",
    "name": "WABC 770 New York",
    "category": "us",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/WABCAM.mp3"
    ],
    "where": "US"
  },
  {
    "id": "wrko-680-boston",
    "name": "WRKO 680 Boston",
    "category": "us",
    "streams": [
      "https://stream.revma.ihrhls.com/zc7750"
    ],
    "where": "US"
  },
  {
    "id": "wtam-1100-cleveland",
    "name": "WTAM 1100 Cleveland",
    "category": "us",
    "streams": [
      "https://stream.revma.ihrhls.com/zc1749"
    ],
    "where": "US"
  },
  {
    "id": "630-ched-edmonton",
    "name": "630 CHED Edmonton",
    "category": "canada",
    "streams": [
      "https://corus.leanstream.co/CHEDAM-MP3"
    ],
    "where": "Canada"
  },
  {
    "id": "cape-talk",
    "name": "Cape Talk",
    "category": "world",
    "streams": [
      "https://22733.live.streamtheworld.com/CAPE_TALK_SC"
    ],
    "where": "South Africa"
  },
  {
    "id": "702-johannesburg",
    "name": "702 Johannesburg",
    "category": "world",
    "streams": [
      "https://22333.live.streamtheworld.com/FM702_SC"
    ],
    "where": "South Africa"
  },
  {
    "id": "espn-1000-chicago",
    "name": "ESPN 1000 Chicago",
    "category": "sport",
    "streams": [
      "https://live.amperwave.net/direct/goodkarma-wmvpammp3-ibc1"
    ],
    "where": "US"
  },
  {
    "id": "sportsnet-590-the-fan",
    "name": "Sportsnet 590 The Fan",
    "category": "sport",
    "streams": [
      "https://rogers-hls.leanstream.co/rogers/tor590.stream/playlist.m3u8"
    ],
    "where": "Canada"
  },
  {
    "id": "bloomberg-radio-boston",
    "name": "Bloomberg Radio Boston",
    "category": "us",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/WRCAAMAAC.aac"
    ],
    "where": "US"
  },
  {
    "id": "kcrw-88-9-santa-monica",
    "name": "KCRW 88.9 Santa Monica",
    "category": "us",
    "streams": [
      "https://streams.kcrw.com/kcrw_mp3?aw_0_1st.playerid=radio-browser.info"
    ],
    "where": "US"
  },
  {
    "id": "bbc-world-service",
    "name": "BBC World Service",
    "category": "uk",
    "streams": [
      "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service"
    ],
    "added": "2026-10-22",
    "where": "UK"
  },
  {
    "id": "walm-old-time-radio",
    "name": "WALM - Old Time Radio",
    "category": "comedy",
    "streams": [
      "https://icecast.walmradio.com:8443/otr"
    ],
    "added": "2026-10-22",
    "where": "US"
  },
  {
    "id": "walm-2-hd",
    "name": "WALM 2 HD",
    "category": "us",
    "streams": [
      "https://icecast.walmradio.com:8443/walm2"
    ],
    "added": "2026-10-22",
    "where": "US"
  },
  {
    "id": "npr-24-hour-program-stream",
    "name": "NPR 24 Hour Program Stream",
    "category": "us",
    "streams": [
      "https://npr-ice.streamguys1.com/live.mp3"
    ],
    "added": "2026-10-22",
    "where": "US"
  },
  {
    "id": "walm-2",
    "name": "WALM 2",
    "category": "us",
    "streams": [
      "https://icecast.walmradio.com:8443/walm2_opus"
    ],
    "added": "2026-10-22",
    "where": "US"
  },
  {
    "id": "times-radio",
    "name": "Times Radio",
    "category": "uk",
    "streams": [
      "https://timesradio.wireless.radio/stream"
    ],
    "added": "2026-10-22",
    "where": "UK"
  },
  {
    "id": "bbc-radio-5-live",
    "name": "BBC Radio 5 Live",
    "category": "sport",
    "streams": [
      "https://as-hls-ww-live.akamaized.net/pool_89021708/live/ww/bbc_radio_five_live/bbc_radio_five_live.isml/bbc_radio_five_live-audio%3d128000.norewind.m3u8"
    ],
    "added": "2026-10-22",
    "where": "UK"
  },
  {
    "id": "kexp",
    "name": "KEXP",
    "category": "us",
    "streams": [
      "https://kexp.streamguys1.com/kexp160.aac?listenerid=f4bcb5c771d830fbdd4195088a946ea6&awparams=companionAds%3Atrue"
    ],
    "added": "2026-10-22",
    "where": "US"
  },
  {
    "id": "sky-news-australia-radio",
    "name": "Sky News Australia Radio",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/NOVA_SKYNEWSAAC.aac"
    ],
    "added": "2026-10-22",
    "where": "Australia"
  },
  {
    "id": "rte1",
    "name": "RTE1",
    "category": "uk",
    "streams": [
      "https://icecast.rte.ie/radio1"
    ],
    "added": "2026-10-23",
    "where": "Ireland"
  },
  {
    "id": "bbc-radio-4-extra",
    "name": "BBC Radio 4 Extra",
    "category": "comedy",
    "streams": [
      "https://as-hls-ww-live.akamaized.net/pool_26173715/live/ww/bbc_radio_four_extra/bbc_radio_four_extra.isml/bbc_radio_four_extra-audio%3d128000.norewind.m3u8"
    ],
    "added": "2026-10-23",
    "where": "UK"
  },
  {
    "id": "gb-news",
    "name": "GB News",
    "category": "uk",
    "streams": [
      "https://listen-gbnews.sharp-stream.com/gbnews.mp3"
    ],
    "added": "2026-10-23",
    "where": "UK"
  },
  {
    "id": "jacaranda-fm",
    "name": "Jacaranda FM",
    "category": "world",
    "streams": [
      "https://edge.iono.fm/xice/jacarandafm_live_medium.aac"
    ],
    "added": "2026-10-23",
    "where": "South Africa"
  },
  {
    "id": "wamu-american-university-radio",
    "name": "WAMU American University Radio",
    "category": "us",
    "streams": [
      "https://wamu.cdnstream1.com/wamu.mp3"
    ],
    "added": "2026-10-23",
    "where": "US"
  },
  {
    "id": "comedy-104-radiostorm",
    "name": "Comedy 104 - Radiostorm",
    "category": "comedy",
    "streams": [
      "https://ais-sa5.cdnstream1.com/b42761_64mp3"
    ],
    "added": "2026-10-23",
    "where": "US"
  },
  {
    "id": "al-jazeera-english",
    "name": "Al Jazeera - English",
    "category": "sport",
    "streams": [
      "https://live-hls-audio-web-aje.getaj.net/VOICE-AJE/01.m3u8"
    ],
    "added": "2026-10-24",
    "where": "Qatar"
  },
  {
    "id": "citi-fm",
    "name": "Citi FM",
    "category": "sport",
    "streams": [
      "https://citi973fm.radioca.st/index.html:80/;stream.mp3"
    ],
    "added": "2026-10-24",
    "where": "Ghana"
  },
  {
    "id": "rokit-radio-british-comedy-1",
    "name": "ROKit Radio : British Comedy 1",
    "category": "comedy",
    "streams": [
      "https://streaming04.liveboxstream.uk/proxy/roksta14/stream"
    ],
    "added": "2026-10-24",
    "where": "UK"
  },
  {
    "id": "cgtn-radio",
    "name": "CGTN Radio",
    "category": "world",
    "streams": [
      "https://sk.cri.cn/am846.m3u8"
    ],
    "added": "2026-10-24",
    "where": "China"
  },
  {
    "id": "power-98-7",
    "name": "Power 98.7",
    "category": "world",
    "streams": [
      "https://edge.iono.fm/xice/65_medium.aac"
    ],
    "added": "2026-10-24",
    "where": "South Africa"
  },
  {
    "id": "cjad-800",
    "name": "CJAD 800",
    "category": "canada",
    "streams": [
      "https://26183.live.streamtheworld.com/CJADAM_SC"
    ],
    "added": "2026-10-24",
    "where": "Canada"
  },
  {
    "id": "wrfz-rochester-free-radio",
    "name": "WRFZ - Rochester Free Radio",
    "category": "us",
    "streams": [
      "https://listen.rochesterfreeradio.com/live.mp3"
    ],
    "added": "2026-10-25",
    "where": "US"
  },
  {
    "id": "radio-jamaica-94fm",
    "name": "Radio Jamaica 94FM",
    "category": "world",
    "streams": [
      "https://stream.zeno.fm/cub84trbgy5tv"
    ],
    "added": "2026-10-25",
    "where": "Jamaica"
  },
  {
    "id": "britcom-4",
    "name": "Britcom 4",
    "category": "comedy",
    "streams": [
      "https://cast2.asurahosting.com/proxy/britcom4/stream.mp3"
    ],
    "added": "2026-10-25",
    "where": "UK"
  },
  {
    "id": "radio-poland",
    "name": "Radio Poland",
    "category": "world",
    "streams": [
      "https://stream85.polskieradio.pl/pr5/pr5.sdp/playlist.m3u8"
    ],
    "added": "2026-10-25",
    "where": "Poland"
  },
  {
    "id": "nhyira-104-5-fm",
    "name": "Nhyira 104.5 FM",
    "category": "sport",
    "streams": [
      "https://mmg.streamguys1.com/NhyiraFM-mp3?key=63d8990dfe4438ae984fd70d2d2b4bd31c842c474987bd810ac0e8e0fd62e8cf2015661105cced63ccfdca89a8422ab1"
    ],
    "added": "2026-10-25",
    "where": "Ghana"
  },
  {
    "id": "rokit-radio-comedy-gold",
    "name": "ROKit Radio : Comedy Gold",
    "category": "comedy",
    "streams": [
      "https://streaming06.liveboxstream.uk/proxy/rokstar8/stream"
    ],
    "added": "2026-10-25",
    "where": "UK"
  },
  {
    "id": "102-7-star-fm-manila-dwsm",
    "name": "102.7 Star FM Manila - DWSM",
    "category": "world",
    "streams": [
      "https://stream-288.surfernetwork.com/g1pmt17nz9duv?zt=eyJhbGciOiJIUzI1NiJ9.eyJzdHJlYW0iOiJnMXBtdDE3bno5ZHV2IiwiaG9zdCI6InN0cmVhbS0yODguc3VyZmVybmV0d29yay5jb20iLCJydHRsIjo1LCJqdGkiOiJMaXZRVVVnMVJBNllJVm1CMzZweXlRIiwiaWF0IjoxNzgxNjc4NzM0LCJleHAiOjE3ODE2Nzg3OTR9.5G1wZmONFqXySurSj1Oj6_UtSmcJMwlc6JJy2oL7fX8"
    ],
    "added": "2026-10-26",
    "where": "The Philippines"
  },
  {
    "id": "kogo-am-600",
    "name": "KOGO AM 600",
    "category": "us",
    "streams": [
      "https://ample.revma.ihrhls.com/zc257"
    ],
    "added": "2026-10-26",
    "where": "US"
  },
  {
    "id": "ahenfie-fm-106-1mhz",
    "name": "Ahenfie FM 106.1MHz",
    "category": "sport",
    "streams": [
      "https://radio.localstreamgh.com/listen/ahenfie_radio_/radio.mp3"
    ],
    "added": "2026-10-26",
    "where": "Ghana"
  },
  {
    "id": "rte-radio-1",
    "name": "RTÉ Radio 1",
    "category": "sport",
    "streams": [
      "https://liveaudio.rte.ie/hls-radio/radio1/chunklist.m3u8"
    ],
    "added": "2026-10-26",
    "where": "Ireland"
  },
  {
    "id": "truckers-radio-usa",
    "name": "Truckers Radio USA",
    "category": "us",
    "streams": [
      "https://streamer.radio.co/s81d30349a/low"
    ],
    "added": "2026-10-26",
    "where": "US"
  },
  {
    "id": "gb-news-uk-48k-eaac",
    "name": "GB News (UK) 48k eAAC+",
    "category": "uk",
    "streams": [
      "https://listen-gbnews.sharp-stream.com/gbnews.aac"
    ],
    "added": "2026-10-26",
    "where": "UK"
  },
  {
    "id": "raxies-fm",
    "name": "Raxies FM",
    "category": "world",
    "streams": [
      "https://stream.zeno.fm/annpmyskb4jtv"
    ],
    "added": "2026-10-27",
    "where": "Chile"
  },
  {
    "id": "rokit-radio-british-comedy-2",
    "name": "ROKit Radio : British Comedy 2",
    "category": "comedy",
    "streams": [
      "https://streaming05.liveboxstream.uk/proxy/jondreas/stream"
    ],
    "added": "2026-10-27",
    "where": "UK"
  },
  {
    "id": "abc-radio-australia",
    "name": "ABC Radio Australia",
    "category": "anz",
    "streams": [
      "https://mediaserviceslive.akamaized.net/hls/live/2038266/ramulti/masterhq.m3u8"
    ],
    "added": "2026-10-27",
    "where": "Australia"
  },
  {
    "id": "drgnu-metallica",
    "name": "DrGnu - Metallica",
    "category": "world",
    "streams": [
      "https://streams.radiobob.de/metallica/mp3-192/mediaplayer/"
    ],
    "added": "2026-10-27",
    "where": "Germany"
  },
  {
    "id": "naija-fm-102-7-lagos",
    "name": "Naija FM 102.7 Lagos",
    "category": "world",
    "streams": [
      "https://naijafmlagos-atunwadigital.streamguys1.com/naijafmlagos/playlist.m3u8"
    ],
    "added": "2026-10-27",
    "where": "Nigeria"
  },
  {
    "id": "cfrb-news-talk-1010-toronto-on",
    "name": "CFRB News/Talk 1010 (Toronto, ON)",
    "category": "canada",
    "streams": [
      "https://29324.live.streamtheworld.com/CFRBAMAAC_SC"
    ],
    "added": "2026-10-27",
    "where": "Canada"
  },
  {
    "id": "radiostorm-comedy-104",
    "name": "Radiostorm - Comedy 104",
    "category": "comedy",
    "streams": [
      "https://streaming.live365.com/b42761_64mp3"
    ],
    "added": "2026-10-28",
    "where": "US"
  },
  {
    "id": "radio-vaticana-english",
    "name": "Radio Vaticana English",
    "category": "world",
    "streams": [
      "https://radio.vaticannews.va/stream-en"
    ],
    "added": "2026-10-28",
    "where": "The Holy See"
  },
  {
    "id": "rokit-radio-classic-old-time-radio-shows",
    "name": "ROKit Radio : Classic Old Time Radio Shows",
    "category": "comedy",
    "streams": [
      "https://streaming04.liveboxstream.uk/proxy/roksta18/stream"
    ],
    "added": "2026-10-28",
    "where": "UK"
  },
  {
    "id": "chennai-live",
    "name": "Chennai live",
    "category": "world",
    "streams": [
      "https://c2.radioboss.fm:8332/stream"
    ],
    "added": "2026-10-28",
    "where": "India"
  },
  {
    "id": "gen-x-radio",
    "name": "Gen X Radio",
    "category": "uk",
    "streams": [
      "https://s2.radio.co/sf25229e16/listen"
    ],
    "added": "2026-10-28",
    "where": "UK"
  },
  {
    "id": "mbc-radio-mauritius",
    "name": "MBC Radio Mauritius",
    "category": "world",
    "streams": [
      "https://radio.mbconline.xyz/hls/radiomauritus.m3u8"
    ],
    "added": "2026-10-28",
    "where": "Mauritius"
  },
  {
    "id": "kaya-fm",
    "name": "Kaya FM",
    "category": "world",
    "streams": [
      "https://edge.iono.fm/xice/82_medium.aac"
    ],
    "added": "2026-10-29",
    "where": "South Africa"
  },
  {
    "id": "agidigbo-88-7-fm",
    "name": "Agidigbo 88.7 FM",
    "category": "world",
    "streams": [
      "https://agidigbostream.com.ng/radio/8000/radio.mp3"
    ],
    "added": "2026-10-29",
    "where": "Nigeria"
  },
  {
    "id": "vob-92-9-fm",
    "name": "VOB 92.9 FM",
    "category": "world",
    "streams": [
      "https://ice66.securenetsystems.net:80/VOB929"
    ],
    "added": "2026-10-29",
    "where": "Barbados"
  },
  {
    "id": "dublin-s-98fm",
    "name": "Dublin's 98FM",
    "category": "uk",
    "streams": [
      "https://stream.audioxi.com/98"
    ],
    "added": "2026-10-29",
    "where": "Ireland"
  },
  {
    "id": "wtop-103-5-fm",
    "name": "WTOP 103.5 FM",
    "category": "us",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/WTOPFM.mp3"
    ],
    "added": "2026-10-29",
    "where": "US"
  },
  {
    "id": "cbc-radio-1-calgary",
    "name": "CBC Radio 1 Calgary",
    "category": "canada",
    "streams": [
      "https://cbcradiolive.akamaized.net/hls/live/2041039/ES_R1MCG/master.m3u8"
    ],
    "added": "2026-10-29",
    "where": "Canada"
  },
  {
    "id": "gbc-uniiq-95-7-fm",
    "name": "GBC Uniiq 95.7 FM",
    "category": "sport",
    "streams": [
      "https://mediagh.us:2000/stream/uniiqfm"
    ],
    "added": "2026-10-30",
    "where": "Ghana"
  },
  {
    "id": "2sm-sydney-1269am",
    "name": "2SM Sydney 1269AM",
    "category": "anz",
    "streams": [
      "https://cast4.asurahosting.com/proxy/2sm1269/stream"
    ],
    "added": "2026-10-30",
    "where": "Australia"
  },
  {
    "id": "national-fm-zbc",
    "name": "National FM ZBC",
    "category": "world",
    "streams": [
      "https://mainradiostreaming.zbc.co.zw:8020/national.mp3"
    ],
    "added": "2026-10-30",
    "where": "Zimbabwe"
  },
  {
    "id": "radio-sahar",
    "name": "Radio Sahar",
    "category": "world",
    "streams": [
      "https://live.ecast.co.il/stream/sahar/stream"
    ],
    "added": "2026-10-31",
    "where": "Israel"
  },
  {
    "id": "red-state-talk-radio",
    "name": "Red State Talk Radio",
    "category": "us",
    "streams": [
      "https://s2.radio.co/s572ad25f7/listen"
    ],
    "added": "2026-10-31",
    "where": "US"
  },
  {
    "id": "sexfm",
    "name": "SexFM",
    "category": "comedy",
    "streams": [
      "https://api.potat.bot/api/hls/live.m3u8"
    ],
    "added": "2026-10-31",
    "where": "US"
  },
  {
    "id": "drgnu-gothic",
    "name": "DrGnu - Gothic",
    "category": "world",
    "streams": [
      "https://streams.radiobob.de/gothic/mp3-192/mediaplayer"
    ],
    "added": "2026-10-31",
    "where": "Germany"
  },
  {
    "id": "glow-99-1-fm-akure",
    "name": "Glow 99.1 FM Akure",
    "category": "world",
    "streams": [
      "https://stream.zeno.fm/mwam2yirv1pvv"
    ],
    "added": "2026-10-31",
    "where": "Nigeria"
  },
  {
    "id": "bfm-89-9-malaysia",
    "name": "BFM 89.9 Malaysia",
    "category": "world",
    "streams": [
      "https://22253.live.streamtheworld.com/BFM_SC"
    ],
    "added": "2026-10-31",
    "where": "Malaysia"
  },
  {
    "id": "cna-938-live-singapore",
    "name": "CNA 938 Live Singapore",
    "category": "world",
    "streams": [
      "https://28373.live.streamtheworld.com/938NOW_PREM_SC"
    ],
    "added": "2026-11-01",
    "where": "Singapore"
  },
  {
    "id": "historyradio-org",
    "name": "Historyradio Org",
    "category": "world",
    "streams": [
      "https://stream.radiojar.com/6bmecgg3wd5tv"
    ],
    "added": "2026-11-01",
    "where": "Norway"
  },
  {
    "id": "northwest-public-broadcasting-news",
    "name": "Northwest Public Broadcasting - News",
    "category": "us",
    "streams": [
      "https://nwpb.streamguys1.com/nwprnews-aac-128-icy"
    ],
    "added": "2026-11-01",
    "where": "US"
  },
  {
    "id": "wabc",
    "name": "WABC",
    "category": "us",
    "streams": [
      "https://26223.live.streamtheworld.com/WABCAMAAC_SC"
    ],
    "added": "2026-11-01",
    "where": "US"
  },
  {
    "id": "radio-east",
    "name": "Radio East",
    "category": "world",
    "streams": [
      "https://stream.zeno.fm/7f4w4us5wp8uv"
    ],
    "added": "2026-11-01",
    "where": "Nigeria"
  },
  {
    "id": "capital-radio",
    "name": "Capital Radio",
    "category": "world",
    "streams": [
      "https://capitalradio.radioca.st/stream"
    ],
    "added": "2026-11-01",
    "where": "United Republic Of Tanzania"
  },
  {
    "id": "nettalk-america",
    "name": "NetTalk America",
    "category": "us",
    "streams": [
      "https://stream.zeno.fm/st9bhqvgvceuv"
    ],
    "added": "2026-11-02",
    "where": "US"
  },
  {
    "id": "102-5-abc-perth",
    "name": "102.5 ABC Perth",
    "category": "anz",
    "streams": [
      "https://streaming.abc-cdn.net.au/audio/hls/localperth.m3u8?source=web"
    ],
    "added": "2026-11-02",
    "where": "Australia"
  },
  {
    "id": "npr-news-radio-107-7-fm",
    "name": "NPR News Radio 107.7 FM",
    "category": "world",
    "streams": [
      "https://npr-ice.streamguys1.com/live.aac"
    ],
    "added": "2026-11-02",
    "where": "Saudi Arabia"
  },
  {
    "id": "670-the-score-wscr",
    "name": "670 The Score (WSCR)",
    "category": "sport",
    "streams": [
      "https://stream.abacast.net/direct/audacy-wscrfmaac-imc"
    ],
    "added": "2026-11-02",
    "where": "US"
  },
  {
    "id": "newstalk-zb-wellington",
    "name": "Newstalk ZB Wellington",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/NZME_31AAC.m3u8"
    ],
    "added": "2026-11-02",
    "where": "New Zealand"
  },
  {
    "id": "101-fm-logan-101-1-fm",
    "name": "101 FM - Logan - 101.1 FM",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/4CBL.mp3"
    ],
    "added": "2026-11-02",
    "where": "Australia"
  },
  {
    "id": "radio-england-pumpkin-fm",
    "name": "Radio England - Pumpkin FM",
    "category": "comedy",
    "streams": [
      "https://cast2.asurahosting.com/proxy/radioengland/stream"
    ],
    "added": "2026-11-02",
    "where": "UK"
  },
  {
    "id": "conspiracy-radio",
    "name": "Conspiracy Radio",
    "category": "us",
    "streams": [
      "https://stream.radiojar.com/sqxkmtks1d5tv"
    ],
    "added": "2026-11-02",
    "where": "US"
  },
  {
    "id": "drgnu-metal-2",
    "name": "DrGnu - Metal 2",
    "category": "world",
    "streams": [
      "https://fluxfm.streamabc.net/flx-metalfm-mp3-320-9154971?sABC=6202r2p8%230%23sorr1p583723p06268o324o2ps5n399q%23fgernzf.syhksz.qr&amsparams=playerid:streams.fluxfm.de;skey:1644356296"
    ],
    "added": "2026-11-02",
    "where": "Germany"
  },
  {
    "id": "classic-105",
    "name": "Classic 105",
    "category": "world",
    "streams": [
      "https://classic105-atunwadigital.streamguys1.com/classic105"
    ],
    "added": "2026-11-03",
    "where": "Kenya"
  },
  {
    "id": "612-abc-brisbane",
    "name": "612 ABC Brisbane",
    "category": "anz",
    "streams": [
      "https://streaming.abc-cdn.net.au/audio/hls/localbrisbane.m3u8?source=web"
    ],
    "added": "2026-11-03",
    "where": "Australia"
  },
  {
    "id": "christian-talk-fm",
    "name": "Christian Talk FM",
    "category": "us",
    "streams": [
      "https://ample.radiojar.com/cm4by4kt2ceuv"
    ],
    "added": "2026-11-03",
    "where": "US"
  },
  {
    "id": "newstalk-zb-christchurch",
    "name": "Newstalk ZB Christchurch",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/NZME_41AAC.m3u8"
    ],
    "added": "2026-11-03",
    "where": "New Zealand"
  },
  {
    "id": "abc-radio-national-nt",
    "name": "ABC Radio National NT",
    "category": "us",
    "streams": [
      "https://mediaserviceslive.akamaized.net/hls/live/2038332/rnnt/index.m3u8"
    ],
    "added": "2026-11-03",
    "where": "US"
  },
  {
    "id": "tbc-radio-88-5-fm",
    "name": "TBC Radio 88.5 FM",
    "category": "world",
    "streams": [
      "https://stream.zeno.fm/004dvn2qqy5tv"
    ],
    "added": "2026-11-03",
    "where": "Jamaica"
  },
  {
    "id": "bbc-sounds-news",
    "name": "BBC Sounds News",
    "category": "uk",
    "streams": [
      "https://a.files.bbci.co.uk/ms6/live/3441A116-B12E-4D2F-ACA8-C1984642FA4B/audio/simulcast/hls/nonuk/pc_hd_abr_v2/ak/bbc_sounds_news.m3u8"
    ],
    "added": "2026-11-04",
    "where": "UK"
  },
  {
    "id": "star-fm",
    "name": "Star FM",
    "category": "world",
    "streams": [
      "https://stream.zeno.fm/66qwf50nw98uv"
    ],
    "added": "2026-11-04",
    "where": "Zimbabwe"
  },
  {
    "id": "730-cknw",
    "name": "730 CKNW",
    "category": "canada",
    "streams": [
      "https://corus.leanstream.co/CKNWAM-MP3?type=.mp3&playertype=dplayer"
    ],
    "added": "2026-11-04",
    "where": "Canada"
  },
  {
    "id": "radio-vivid-voice",
    "name": "Radio Vivid Voice",
    "category": "world",
    "streams": [
      "https://stream.zeno.fm/xuin6ocdc2juv"
    ],
    "added": "2026-11-04",
    "where": "Bangladesh"
  },
  {
    "id": "albania-360-radio",
    "name": "Albania 360 Radio",
    "category": "world",
    "streams": [
      "https://radio.albania360.net/listen/albania_360_radio/radio.mp3"
    ],
    "added": "2026-11-04",
    "where": "Albania"
  },
  {
    "id": "zifm-stereo",
    "name": "ZiFM Stereo",
    "category": "world",
    "streams": [
      "https://edge.iono.fm/xice/134_high.aac"
    ],
    "added": "2026-11-04",
    "where": "Zimbabwe"
  },
  {
    "id": "classic-old-time-radio",
    "name": "Classic Old Time Radio",
    "category": "comedy",
    "streams": [
      "https://stream.zeno.fm/b6v6nu8uhnruv"
    ],
    "added": "2026-11-05",
    "where": "Spain"
  },
  {
    "id": "qbs-radio-97-5",
    "name": "QBS Radio 97.5",
    "category": "world",
    "streams": [
      "https://live.kwikmotion.com/qmcqbsradiolive/qbsradio/playlist.m3u8"
    ],
    "added": "2026-11-05",
    "where": "Qatar"
  },
  {
    "id": "britcom-3-pumpkin-fm",
    "name": "BritCom 3 - Pumpkin FM",
    "category": "comedy",
    "streams": [
      "https://cast2.asurahosting.com/proxy/britcom3/stream"
    ],
    "added": "2026-11-05",
    "where": "UK"
  },
  {
    "id": "2gb-sydney-873-am",
    "name": "2GB - Sydney - 873 AM",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/2GB.mp3"
    ],
    "added": "2026-11-05",
    "where": "Australia"
  },
  {
    "id": "britcom-1-pumpkin-fm",
    "name": "BritCom 1 - Pumpkin FM",
    "category": "comedy",
    "streams": [
      "https://cast2.asurahosting.com/proxy/britcom1/stream"
    ],
    "added": "2026-11-05",
    "where": "UK"
  },
  {
    "id": "salem-news-channel-audio-stream",
    "name": "Salem News Channel Audio Stream",
    "category": "us",
    "streams": [
      "https://tc1.bahamatel.net:7928/;?type=http&nocache=6029555"
    ],
    "added": "2026-11-05",
    "where": "US"
  },
  {
    "id": "105fm",
    "name": "105FM",
    "category": "world",
    "streams": [
      "https://105fm.espiv.net/listen/105fm/stream.mp3"
    ],
    "added": "2026-11-06",
    "where": "Greece"
  },
  {
    "id": "702-abc-sydney",
    "name": "702 ABC Sydney",
    "category": "anz",
    "streams": [
      "https://streaming.abc-cdn.net.au/audio/hls/localsydney.m3u8?source=web"
    ],
    "added": "2026-11-06",
    "where": "Australia"
  },
  {
    "id": "letio-tonga",
    "name": "Letio Tonga",
    "category": "world",
    "streams": [
      "https://stream.zeno.fm/wnd22q3485quv"
    ],
    "added": "2026-11-06",
    "where": "Tonga"
  },
  {
    "id": "bloomberg-uk",
    "name": "Bloomberg UK",
    "category": "uk",
    "streams": [
      "https://bloomberg-live-prod-us-east-1.s3.amazonaws.com/rad/Channel-RAD-AWS-virginia-1/Source-RadUK-96-1_live.m3u8"
    ],
    "added": "2026-11-06",
    "where": "UK"
  },
  {
    "id": "2cc-talking-canberra",
    "name": "2CC Talking Canberra",
    "category": "anz",
    "streams": [
      "https://playerservices.streamtheworld.com/api/livestream-redirect/2CCAAC.aac"
    ],
    "added": "2026-11-06",
    "where": "Australia"
  },
  {
    "id": "cape-talk-567",
    "name": "Cape Talk 567",
    "category": "world",
    "streams": [
      "https://27863.live.streamtheworld.com/CAPE_TALKAAC_SC?dist=CapeTalkWeb&pname=TDSdk"
    ],
    "added": "2026-11-06",
    "where": "South Africa"
  },
  {
    "id": "detour-talk",
    "name": "detour TALK",
    "category": "us",
    "streams": [
      "https://ec1.yesstreaming.net:4350/;"
    ],
    "added": "2026-11-07",
    "where": "US"
  },
  {
    "id": "afn-360-naples",
    "name": "AFN 360 Naples",
    "category": "world",
    "streams": [
      "https://23623.live.streamtheworld.com/AFNE_NAP_SC"
    ],
    "added": "2026-11-07",
    "where": "Italy"
  },
  {
    "id": "fumba-town-radio",
    "name": "Fumba Town Radio",
    "category": "world",
    "streams": [
      "https://stream.perspektiveausland.app/listen/fumba_town_radio/radio.mp3"
    ],
    "added": "2026-11-07",
    "where": "United Republic Of Tanzania"
  },
  {
    "id": "radio-tambrin-92-7-scarborough",
    "name": "Radio Tambrin 92.7 - Scarborough",
    "category": "world",
    "streams": [
      "https://ice42.securenetsystems.net/TAMBRIN"
    ],
    "added": "2026-11-07",
    "where": "Trinidad And Tobago"
  },
  {
    "id": "ghana-waves-radio",
    "name": "Ghana Waves Radio",
    "category": "sport",
    "streams": [
      "https://stream.zeno.fm/pg5c7zx3p0quv"
    ],
    "added": "2026-11-07",
    "where": "Ghana"
  },
  {
    "id": "891-abc-adelaide",
    "name": "891 ABC Adelaide",
    "category": "anz",
    "streams": [
      "https://streaming.abc-cdn.net.au/audio/hls/localadelaide.m3u8?source=web"
    ],
    "added": "2026-11-07",
    "where": "Australia"
  },
  {
    "id": "rri-voice-of-indonesia",
    "name": "RRI Voice Of Indonesia",
    "category": "world",
    "streams": [
      "https://stream-node0.rri.co.id/streaming/25/9125/voi.mp3"
    ],
    "added": "2026-11-08",
    "where": "Indonesia"
  },
  {
    "id": "drgnu-metalcore-1",
    "name": "DrGnu - Metalcore 1",
    "category": "world",
    "streams": [
      "https://streams.radiobob.de/metalcore/mp3-192/mediaplayer"
    ],
    "added": "2026-11-08",
    "where": "Germany"
  },
  {
    "id": "kyebi-radio",
    "name": "Kyebi Radio",
    "category": "sport",
    "streams": [
      "https://stream.zenolive.com/ep91zyvc9zquv"
    ],
    "added": "2026-11-08",
    "where": "Ghana"
  },
  {
    "id": "99-5-dzyw-koolfm",
    "name": "99.5 DZYW koolFM",
    "category": "world",
    "streams": [
      "https://listen.smilemediaph.com/listen/koolfm/radio.mp3"
    ],
    "added": "2026-11-08",
    "where": "The Philippines"
  },
  {
    "id": "news-radio-uk",
    "name": "News Radio UK",
    "category": "uk",
    "streams": [
      "https://stream.aiir.com/clcb6m0k9shvv"
    ],
    "added": "2026-11-08",
    "where": "UK"
  },
  {
    "id": "wunc-91-5-chapel-hill-nc",
    "name": "WUNC 91.5 Chapel Hill, NC",
    "category": "us",
    "streams": [
      "https://wunc-ice.streamguys1.com/wunc-128-mp3"
    ],
    "added": "2026-11-08",
    "where": "US"
  },
  {
    "id": "whbe-espn-louisville",
    "name": "WHBE ESPN Louisville",
    "category": "sport",
    "streams": [
      "https://prod-44-203-50-103.amperwave.net/unionbroadcasting-whbeammp3-ibc2?session-id=fe287fd17b9c51db5f3aeed55913daa2"
    ],
    "added": "2026-11-09",
    "where": "US"
  },
  {
    "id": "american-gold-pumpkin-fm",
    "name": "American Gold - Pumpkin FM",
    "category": "comedy",
    "streams": [
      "https://cast2.asurahosting.com/proxy/americangold/stream"
    ],
    "added": "2026-11-09",
    "where": "UK"
  },
  {
    "id": "red-state-talk-radio-encore",
    "name": "Red State Talk Radio Encore",
    "category": "us",
    "streams": [
      "https://s2.radio.co/sf03a6a4b2/listen"
    ],
    "added": "2026-11-09",
    "where": "US"
  }
];
window.STATIONS_CHECKED = "2026-11-09T06:27Z";
