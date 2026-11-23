/* 清醒地图 LucidMap · PWA service worker
   策略：页面走网络优先（离线回缓存）；静态资源缓存优先。
   更新时改 CACHE 版本号即可。 */
const CACHE = 'lucidmap-v3-2026-11-22-16';
const BASE = new URL('./', self.location.href);
const CORE = [
  'v3/m/',
  'v3/',
  'v3/pro/',
  'v3/human/',
  'manifest.json',
  'assets/mermaid.min.js',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-512-maskable.png',
  'assets/hero-report.jpg',
  'assets/report-map.png'
].map((p) => new URL(p, BASE).href);
const OFFLINE_PAGE = new URL('v3/m/', BASE).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) await cache.put(url, res);
      } catch (e) { /* 单个资源失败不阻塞安装 */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('lucidmap-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        const cache = await caches.open(CACHE);
        let hit = await cache.match(req);
        if (!hit) hit = await cache.match(url.origin + url.pathname);
        if (!hit) hit = await cache.match(OFFLINE_PAGE);
        return hit || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) await cache.put(req, res.clone());
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});
