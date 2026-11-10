// Service Worker for Digital Bahi-Khata PWA (Network-First)
const CACHE_NAME = "bahi-khata-v10";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("Deleting old service worker cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Always try Network First so updates are seen immediately
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful GET responses for offline fallback
        if (event.request.method === "GET" && response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return response;
      })
      .catch(async () => {
        // Fallback to cache if network offline
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.url.includes("/api/")) {
          return new Response(JSON.stringify({ offline: true, error: "Offline mode" }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      })
  );
});
