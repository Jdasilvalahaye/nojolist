const CACHE = "nojolist-v3";
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
  if (e.request.url.includes("firebase") || e.request.url.includes("googleapis") || e.request.url.includes("gstatic")) {
    return;
  }
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});

// ── NOTIFICATIONS PUSH (Firebase Cloud Messaging) ──
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDsuWLg8hMaj8Dkq3-kycUVmVJvLfBTlSE",
  authDomain: "nojolist.firebaseapp.com",
  databaseURL: "https://nojolist-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nojolist",
  storageBucket: "nojolist.firebasestorage.app",
  messagingSenderId: "655476142859",
  appId: "1:655476142859:web:5f55b115288e3eff4ce80e",
});

const messaging = firebase.messaging();

// Notification reçue en arrière-plan
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: "/nojolist/icons/icon-192x192.png",
    badge: "/nojolist/icons/icon-72x72.png",
  });
});
