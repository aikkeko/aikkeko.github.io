/**
 * Service Worker - 博客缓存策略
 * 
 * 缓存策略：
 * 1. 静态资源 (CSS/JS/图片) - Cache First, 缓存 30 天
 * 2. 文章页面 - Network First, 失败时回退缓存
 * 3. API/动态内容 - Network Only
 * 
 * 针对 30 万字小说级内容的离线阅读优化
 */

const CACHE_VERSION = 'blog-v18';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const IMAGES_CACHE = `${CACHE_VERSION}-images`;

// 预缓存的关键资源
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/css/main.css',
  '/js/next-boot.js',
  '/js/utils.js',
  '/js/motion.js',
  '/lib/font-awesome/css/all.min.css',
  '/lib/velocity/velocity.min.js',
  '/lib/velocity/velocity.ui.min.js',
  '/lib/anime.min.js',
  '/images/Z.A.T.O_02_ca04.jpg',
  '/images/bitbug_favicon.ico'
];

// 安装：预缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[ServiceWorker] 预缓存关键资源');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[ServiceWorker] 预缓存失败:', err);
      })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('blog-') && !name.startsWith(`${CACHE_VERSION}-`))
          .map((name) => {
            console.log('[ServiceWorker] 删除旧缓存:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 获取缓存策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 跳过非 GET 请求
  if (request.method !== 'GET') {
    return;
  }
  
  // 跳过浏览器扩展和第三方分析
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return;
  }
  
  // 策略 1: 静态资源 (CSS/JS) - Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE, 30 * 24 * 60 * 60 * 1000));
    return;
  }
  
  // 策略 2: 图片 - Cache First with Stale While Revalidate
  if (isImage(url.pathname)) {
    event.respondWith(staleWhileRevalidateStrategy(request, IMAGES_CACHE, 7 * 24 * 60 * 60 * 1000));
    return;
  }
  
  // 策略 3: 文章页面 - Network First
  if (isPage(url.pathname)) {
    event.respondWith(networkFirstStrategy(request, PAGES_CACHE, 24 * 60 * 60 * 1000));
    return;
  }
  
  // 默认策略：网络优先
  event.respondWith(networkFirstStrategy(request, PAGES_CACHE, 60 * 60 * 1000));
});

// 判断是否为静态资源
function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|otf)$/.test(pathname);
}

// 判断是否为图片
function isImage(pathname) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/.test(pathname);
}

// 判断是否为页面
function isPage(pathname) {
  // HTML 文件或目录（默认 index.html）
  return /\.(html?)$/.test(pathname) || (!/\.\w+$/.test(pathname) && pathname !== '/');
}

// Cache First 策略
async function cacheFirstStrategy(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
    // 后台更新缓存
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
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Network First 策略
async function networkFirstStrategy(request, cacheName, maxAge) {
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
    
    if (cachedResponse) {
      console.log('[ServiceWorker] 从缓存返回:', request.url);
      return cachedResponse;
    }
    
    // 返回离线页面
    return caches.match('/offline.html');
  }
}

// Stale While Revalidate 策略
async function staleWhileRevalidateStrategy(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// 后台获取并缓存
async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response);
    }
  } catch (error) {
    // 静默处理网络错误，避免控制台报错
    console.log('[ServiceWorker] 后台更新跳过:', request.url);
  }
}

// 检查缓存是否过期
function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;
  
  const date = new Date(dateHeader).getTime();
  const now = Date.now();
  return now - date > maxAge;
}

// 后台同步 - 离线阅读进度同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reading-progress') {
    event.waitUntil(syncReadingProgress());
  }
});

async function syncReadingProgress() {
  // 可以在这里同步阅读进度到服务器
  console.log('[ServiceWorker] 同步阅读进度');
}

// 推送通知支持（可选）
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/images/bitbug_favicon.ico',
      badge: '/images/bitbug_favicon.ico'
    })
  );
});
