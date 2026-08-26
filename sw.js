// PDF Clair — service worker : permet d'utiliser l'outil sans connexion
// après un premier chargement. Ne fait aucun envoi réseau autre que le
// chargement normal des pages/bibliothèques ; ne collecte rien.

const CACHE_NAME = "pdfclair-v1";

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

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          // Ne met en cache que les réponses correctes (ou opaques pour le cross-origin).
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      // Cache-first pour tout ce qui est déjà connu (rapide + fonctionne hors ligne),
      // sinon on attend le réseau une première fois.
      return cached || network;
    })
  );
});
