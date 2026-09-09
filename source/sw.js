/* Site-owned cache. Third-party comments, players and APIs stay online-only. */
const CACHE_VERSION = 'blog-v165';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const IMAGES_CACHE = `${CACHE_VERSION}-images`;
const HOSTNAME = self.location.hostname;
const IS_LOCAL_PREVIEW = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)$/.test(HOSTNAME) ||
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(HOSTNAME) || /\.local$/i.test(HOSTNAME);
const LIMITS = { [STATIC_CACHE]: 80, [PAGES_CACHE]: 30, [IMAGES_CACHE]: 60 };
let cacheWrites = Promise.resolve();

async function deleteOldCaches(keepCurrent) {
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith('blog-') &&
    (!keepCurrent || !name.startsWith(`${CACHE_VERSION}-`))).map(name => caches.delete(name)));
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Failed precache must not activate and discard the previous working cache.
    if (!IS_LOCAL_PREVIEW) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(['/offline.html']);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await deleteOldCaches(!IS_LOCAL_PREVIEW);
    if (IS_LOCAL_PREVIEW) await self.registration.unregister();
    else await self.clients.claim();
  })());
});
function saveResponse(name, request, response) {
  if (!response.ok || response.type === 'opaque' || response.redirected ||
      /no-store|private/i.test(response.headers.get('cache-control') || '')) return Promise.resolve();
  const copy = response.clone();
  cacheWrites = cacheWrites.catch(() => {}).then(async () => {
    const cache = await caches.open(name);
    await cache.put(request, copy);
    const keys = await cache.keys();
    let count = keys.length;
    for (const key of keys) {
      if (count < LIMITS[name] + 1) break;
      if (new URL(key.url).pathname === '/offline.html') continue;
      await cache.delete(key); count--;
    }
  });
  return cacheWrites;
}
async function assetResponse(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  const refresh = fetch(event.request).then(async response => {
    await saveResponse(cacheName, event.request, response);
    return response;
  });
  event.waitUntil(refresh.catch(() => {}));
  return cached || refresh;
}
async function pageResponse(event) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(event.request, { signal: controller.signal });
    if (response.status >= 500) throw new Error('Temporary server failure');
    event.waitUntil(saveResponse(PAGES_CACHE, event.request, response).catch(() => {}));
    return response;
  } catch {
    const cache = await caches.open(PAGES_CACHE);
    return await cache.match(event.request) || await caches.match('/offline.html') ||
      new Response('暂时离线，请联网后重试。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } finally { clearTimeout(timer); }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (IS_LOCAL_PREVIEW || request.method !== 'GET' || url.origin !== self.location.origin ||
      request.headers.has('range') || /^\/(api|content-manager)(\/|$)/.test(url.pathname)) return;
  if (request.mode === 'navigate') event.respondWith(pageResponse(event));
  else if (/\.(css|js|woff2?|ttf|otf)$/i.test(url.pathname)) event.respondWith(assetResponse(event, STATIC_CACHE));
  else if (/\.(png|jpe?g|gif|svg|webp|avif|ico)$/i.test(url.pathname)) event.respondWith(assetResponse(event, IMAGES_CACHE));
});
