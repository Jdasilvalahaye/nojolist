/* ============================================================
   NOJOLIST — sw.js (Service Worker)
   ------------------------------------------------------------
   Le Service Worker est un petit programme qui tourne EN DEHORS
   de la page : il intercepte les requêtes réseau et permet à
   l'app de fonctionner hors-ligne et de se mettre à jour.

   ⚠️ IMPORTANT : à CHAQUE déploiement d'une nouvelle version,
   incrémente le numéro ci-dessous (v4 → v5 → …). C'est ce
   changement qui déclenche la mise à jour chez Jonathan et
   Noémie (l'app leur proposera "Mettre à jour").

   STRATÉGIES DE CACHE utilisées :
   • Navigation (index.html)  → "network-first" : on tente le
     réseau (toujours frais), et si hors-ligne → version en cache.
   • Fichiers statiques (css, js, icônes, polices) →
     "stale-while-revalidate" : on sert le cache immédiatement
     (rapide !) et on télécharge la nouvelle version en fond
     pour la prochaine fois.
   • Firebase → jamais mis en cache (données temps réel).
   ============================================================ */

const CACHE = "nojolist-v4"; // ← incrémente-moi à chaque déploiement !

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

/* INSTALL : on pré-télécharge le "squelette" de l'app */
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  // NOTE : pas de skipWaiting() automatique ici. La nouvelle
  // version attend que l'utilisateur clique "Mettre à jour"
  // (message SKIP_WAITING envoyé par app.js). Ça évite qu'une
  // page à moitié chargée se retrouve avec des fichiers mixtes.
});

/* Message envoyé par app.js quand l'utilisateur accepte la MAJ */
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

/* ACTIVATE : on supprime les vieux caches (nojolist-v3, etc.) */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* FETCH : le cœur du hors-ligne */
self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // 1) Firebase & co : on n'intercepte PAS (temps réel oblige)
  if (url.includes("firebase") || url.includes("googleapis") && url.includes("database")) return;
  if (e.request.method !== "GET") return;

  // 2) Navigation (ouverture de l'app) : réseau d'abord, cache en secours
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match("/nojolist/index.html"))
    );
    return;
  }

  // 3) Tout le reste (css, js, images, polices) : stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached); // hors-ligne : on garde le cache
      return cached || fetchPromise;
    })
  );
});
