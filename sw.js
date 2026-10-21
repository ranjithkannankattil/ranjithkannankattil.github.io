// Offline shell for ranjithkb.com: pages and their CSS/JS keep working without a signal.
// Never touches audio streams, news data or anything on other sites (except Google Fonts).
const CACHE = "rkb-v2";
const SHELL = ["/", "/radio.html", "/news.html", "/css/style.css", "/css/radio.css", "/css/news.css",
  "/js/nav.js", "/writings.html", "/photography.html", "/css/writings.css", "/css/photography.css", "/js/posts-index.js", "/js/radio.js", "/js/news.js", "/js/collections.js", "/assets/icons/radio-192.png", "/assets/icons/news-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const fonts = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (!same && !fonts.test(req.url)) return;
  if (same && (url.pathname.startsWith("/__/") || url.pathname.startsWith("/js/stations/"))) {
    // station lists: always fresh when online, last copy when not
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return r; }).catch(() => caches.match(req)));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("/"))));
    return;
  }
  // CSS, JS, images, fonts: answer from cache at once, refresh it in the background
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
