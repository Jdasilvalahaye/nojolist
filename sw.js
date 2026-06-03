const CACHE = "nojolist-v2";
const ASSETS = [
  "/nojolist/",
  "/nojolist/index.html",
  "/nojolist/css/style.css",
  "/nojolist/js/firebase.js",
  "/nojolist/js/emojis.js",
  "/nojolist/js/app.js",
  "/nojolist/manifest.json",
  "/nojolist/icons/icon-192x192.png",
  "/nojolist/icons/icon-512x512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Firebase et fonts : toujours réseau
  if (e.request.url.includes("firebase") || e.request.url.includes("googleapis") || e.request.url.includes("gstatic")) {
    return;
  }
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
