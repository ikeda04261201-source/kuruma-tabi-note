/**
 * くるま旅ノート — Service Worker
 * 全アセットをキャッシュしてオフライン動作を実現
 */
const CACHE_NAME = 'kuruma-tabi-v1';
const TILE_CACHE = 'osm-tiles-v1';
const MAX_TILES = 2000;

// Pre-cache these on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
];

// Install: pre-cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== TILE_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for assets, network-first for navigation
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // OSM tiles: cache-first
  if (url.hostname.match(/[abc]\.tile\.openstreetmap\.org/)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            // Limit tile cache size
            const keys = await cache.keys();
            if (keys.length > MAX_TILES) {
              await cache.delete(keys[0]);
            }
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // Google Fonts / Leaflet CSS: cache-first
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com' ||
      url.hostname === 'unpkg.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return cached || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // Same-origin requests: cache-first for assets, network-first for HTML
  if (url.origin === self.location.origin) {
    // JS/CSS/images: cache-first
    if (request.destination === 'script' ||
        request.destination === 'style' ||
        request.destination === 'image' ||
        url.pathname.startsWith('/_astro/')) {
      event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
          const cached = await cache.match(request);
          if (cached) return cached;
          try {
            const response = await fetch(request);
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          } catch {
            return cached || new Response('', { status: 408 });
          }
        })
      );
      return;
    }

    // HTML/navigation: network-first, fallback to cache
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cached = await cache.match(request);
          return cached || await cache.match('/index.html') || new Response('オフラインです', { status: 408 });
        }
      })
    );
    return;
  }
});
