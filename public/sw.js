// Service worker: precache the app shell and data, then answer from cache and refresh in the background.
// Repeat visits paint instantly and the site works offline. Bump VERSION to force a refresh.
const VERSION = "v6";
const CACHE = "dbms-exam-prep-" + VERSION;
const SHELL = ["./", "index.html", "css/styles.css", "js/app.js", "js/api.js", "data/modules.json", "data/papers.json", "data/topics.json", "favicon.svg", "img/imp1.jpg", "img/imp2.jpg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const refresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || refresh;
    })
  );
});
