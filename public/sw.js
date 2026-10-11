// Brújula service worker: keeps the app shell and static assets available offline.
// Data never goes through here: /api and Supabase requests always hit the network,
// and the tracker already keeps its own local copy of the state.
const CACHE = "brujula-shell-v1";
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(new Request(SHELL, { cache: "reload" }))).then(() => self.skipWaiting()),
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
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Network first; the cached shell renders from local storage when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(SHELL, response.clone()));
          return response;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/") || /\.(png|svg|webp|ico|woff2?)$/.test(url.pathname);
  if (!isStatic) return;
  // Hashed assets and icons: cache first, refreshed in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached ?? refresh;
    }),
  );
});
