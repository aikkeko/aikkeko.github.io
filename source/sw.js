/**
 * Service Worker - archive reading cache
 *
 * Production:
 * - Static assets: cache first
 * - Images: stale while revalidate
 * - Pages: network first, fallback to cached page/offline page
 *
 * Local preview:
 * - Do not control localhost.
 * - Delete old blog caches and unregister itself to avoid stale offline pages.
 */

const CACHE_VERSION = 'blog-v54';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const IMAGES_CACHE = `${CACHE_VERSION}-images`;
const LOCAL_PREVIEW_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const IS_LOCAL_PREVIEW = LOCAL_PREVIEW_HOSTS.has(self.location.hostname);

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/css/main.css',
  '/js/next-boot.js',
  '/js/utils.js',
  '/js/motion.js',
  '/lib/font-awesome/css/all.min.css',
  '/lib/anime.min.js',
  '/images/Z.A.T.O_02_ca04.jpg',
  '/images/bitbug_favicon.ico'
];

async function deleteBlogCaches({ keepCurrent = false } = {}) {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames
      .filter((name) => {
        if (!name.startsWith('blog-')) return false;
        return keepCurrent ? !name.startsWith(`${CACHE_VERSION}-`) : true;
      })
      .map((name) => caches.delete(name))
  );
}

self.addEventListener('install', (event) => {
  if (IS_LOCAL_PREVIEW) {
    event.waitUntil(self.skipWaiting());
    return;
  }

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[ServiceWorker] Precache failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  if (IS_LOCAL_PREVIEW) {
    event.waitUntil(
      deleteBlogCaches()
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then((clients) => Promise.all(clients.map((client) => client.navigate(client.url))))
    );
    return;
  }

  event.waitUntil(
    deleteBlogCaches({ keepCurrent: true })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (IS_LOCAL_PREVIEW) return;

  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE, 30 * 24 * 60 * 60 * 1000));
    return;
  }

  if (isImage(url.pathname)) {
    event.respondWith(staleWhileRevalidateStrategy(request, IMAGES_CACHE));
    return;
  }

  if (isPage(url.pathname)) {
    event.respondWith(networkFirstStrategy(request, PAGES_CACHE));
    return;
  }

  event.respondWith(networkFirstStrategy(request, PAGES_CACHE));
});

function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|otf)$/.test(pathname);
}

function isImage(pathname) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/.test(pathname);
}

function isPage(pathname) {
  return /\.(html?)$/.test(pathname) || (!/\.\w+$/.test(pathname) && pathname !== '/');
}

async function cacheFirstStrategy(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
    fetchAndCache(request, cacheName).catch(() => {});
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    if (cachedResponse) return cachedResponse;
    throw error;
  }
}

async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    return caches.match('/offline.html');
  }
}

async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response);
    }
  } catch (error) {
    // Ignore background refresh failures.
  }
}

function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;

  const date = new Date(dateHeader).getTime();
  return Date.now() - date > maxAge;
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reading-progress') {
    event.waitUntil(syncReadingProgress());
  }
});

async function syncReadingProgress() {
  console.log('[ServiceWorker] Sync reading progress');
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/images/bitbug_favicon.ico',
      badge: '/images/bitbug_favicon.ico'
    })
  );
});
