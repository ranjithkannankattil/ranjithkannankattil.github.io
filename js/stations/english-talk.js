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
  }
];
window.STATIONS_CHECKED = "2026-10-25T05:40Z";
