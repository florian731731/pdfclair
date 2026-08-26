// PDF Clair — service worker : permet d'utiliser l'outil sans connexion
// après un premier chargement. Ne fait aucun envoi réseau autre que le
// chargement normal des pages/bibliothèques ; ne collecte rien.
//
// v2 : ne met JAMAIS en cache une réponse redirigée, et ne sert jamais depuis
// le cache une entrée redirigée (Safari refuse de rendre une page servie par
// un service worker si sa réponse a "redirected: true" — ça provoquait un
// blocage total du site sur iOS).

const CACHE_NAME = "pdfclair-v2";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./editeur-pdf.html",
  "./favicon.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { mode: url.startsWith("http") ? "no-cors" : "same-origin" })).catch(() => {
            // Une ressource (ex: hors ligne dès l'install) ne doit pas bloquer les autres.
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Pages HTML (navigation) : toujours réseau en priorité, jamais de cache
  // potentiellement redirigé. Le cache ne sert que de secours hors ligne.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => (cached && !cached.redirected ? cached : caches.match("./index.html")))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedRaw) => {
      const cached = cachedRaw && !cachedRaw.redirected ? cachedRaw : undefined;
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque") && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
