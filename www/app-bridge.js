/*
 * Injected by the Android app at document start (never loaded on the website).
 * Android's WebView has no working navigator.mediaSession, so this provides one that
 * forwards to the native RadioMedia plugin: notification, lock-screen, Bluetooth and
 * headset controls, plus a foreground service that keeps playback alive.
 * radio.js keeps using the standard Media Session API unchanged.
 */
(function () {
  "use strict";
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  if (C.getPlatform && C.getPlatform() !== "android") return;
  var RM = C.Plugins && C.Plugins.RadioMedia;
  if (!RM) return;

  document.documentElement.classList.add("in-app", "in-app-android");

  function abs(u) {
    try { return new URL(u, location.href).href; } catch (e) { return ""; }
  }

  function pickArtwork(list) {
    if (!list || !list.length) return "";
    var best = list[0], bestSize = 0;
    for (var i = 0; i < list.length; i++) {
      var s = String(list[i].sizes || "").split(/\s+/)[0].split("x")[0] | 0;
      if (s > bestSize) { bestSize = s; best = list[i]; }
    }
    var src = String(best.src || "");
    if (/^data:image\//.test(src)) return src;
    src = abs(src);
    return /^https?:/.test(src) ? src : "";
  }

  function call(method, args) {
    try { var p = RM[method](args); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
  }

  var handlers = {};
  var metadata = null;
  var playbackState = "none";

  function pushSkips() {
    call("setActions", { previoustrack: !!handlers.previoustrack, nexttrack: !!handlers.nexttrack });
  }

  var shim = {
    get metadata() { return metadata; },
    set metadata(m) {
      metadata = m || null;
      call("setMetadata", m ? {
        title: m.title || "", artist: m.artist || "", album: m.album || "",
        artwork: pickArtwork(m.artwork)
      } : { title: "", artist: "", album: "", artwork: "" });
    },
    get playbackState() { return playbackState; },
    set playbackState(s) {
      playbackState = s || "none";
      call("setPlaybackState", { state: playbackState });
    },
    setActionHandler: function (action, handler) {
      handlers[action] = typeof handler === "function" ? handler : null;
      if (action === "previoustrack" || action === "nexttrack") pushSkips();
    },
    setPositionState: function () { /* live radio: no position */ },
    setMicrophoneActive: function () {},
    setCameraActive: function () {}
  };

  function Metadata(init) {
    init = init || {};
    this.title = init.title || "";
    this.artist = init.artist || "";
    this.album = init.album || "";
    this.artwork = init.artwork || [];
  }

  try {
    Object.defineProperty(navigator, "mediaSession", { value: shim, configurable: true });
    if (typeof window.MediaMetadata !== "function") window.MediaMetadata = Metadata;
  } catch (e) { return; }

  RM.addListener("action", function (ev) {
    var a = ev && ev.action;
    var h = a && handlers[a];
    // The page may register a single toggle for play and pause; fall back between them.
    if (!h && a === "play") h = handlers.pause;
    if (!h && a === "pause") h = handlers.pause || handlers.stop;
    if (h) { try { h({ action: a }); } catch (e) { /* ignore */ } }
  });

  // If the page is closed or reloaded, clear the controls.
  window.addEventListener("pagehide", function () { call("setPlaybackState", { state: "none" }); });
})();
