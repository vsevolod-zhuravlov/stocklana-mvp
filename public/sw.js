/**
 * Minimal service worker. Its job is to make the app installable to the home
 * screen and to keep the shell available on a flaky connection — not to cache
 * aggressively. Anything involving money or wallet state always hits the
 * network so the user never hears a stale balance.
 */

const CACHE = "stocklana-v1";
const SHELL = ["/", "/app", "/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Network first so a deployed update is picked up immediately; the cache is
  // only a fallback for navigations made offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (request.mode === "navigate" || SHELL.includes(url.pathname))) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/app"))),
  );
});
