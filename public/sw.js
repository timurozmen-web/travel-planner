/* Journeys Planner offline support.
   App shell and map data: cache first. Weather, rates and photo searches: show the saved copy,
   refresh in the background. Photos and your documents: cache first. Sync, AI, sharing: network only. */
const V = 'jp-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/countries-50m.json', '/cities.json'];
const LIMITS = { 'jp-img': 400 };

self.addEventListener('install', (e) => { e.waitUntil(caches.open(V + '-shell').then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('jp-') && !k.startsWith(V)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max) { const c = await caches.open(name), keys = await c.keys(); for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]); }
async function cacheFirst(req, name) {
  const c = await caches.open(name), hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); if (LIMITS[name.replace(V + '-', 'jp-')]) trim(name, LIMITS[name.replace(V + '-', 'jp-')]); }
  return res;
}
async function staleWhileRevalidate(req, name, e) {
  const c = await caches.open(name), hit = await c.match(req);
  const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  return (await net) || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'content-type': 'application/json' } });
}
async function networkFirst(req, name) {
  const c = await caches.open(name);
  try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
  catch { return (await c.match(req)) || (await c.match('/index.html')) || Response.error(); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (/^\/api\/(sync|ai|share|cal|photo-used)/.test(u.pathname)) return;
    if (req.mode === 'navigate' || u.pathname === '/' || u.pathname === '/index.html' || u.pathname === '/sw.js') return e.respondWith(networkFirst(req, V + '-shell'));
    if (/^\/api\/(weather|fx|photos)/.test(u.pathname)) return e.respondWith(staleWhileRevalidate(req, V + '-api', e));
    if (u.pathname.startsWith('/api/upload/')) return e.respondWith(cacheFirst(req, V + '-docs'));
    if (/^\/(tiles|logos|icons)\//.test(u.pathname) || /\.(json|png)$/.test(u.pathname)) return e.respondWith(cacheFirst(req, V + '-data'));
    return;
  }
  if (/(^|\.)cdnjs\.cloudflare\.com$|fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return e.respondWith(cacheFirst(req, V + '-lib'));
  if (u.hostname === 'images.unsplash.com') return e.respondWith(cacheFirst(req, V + '-img'));
});
