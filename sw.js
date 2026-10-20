/* オフライン用 Service Worker (個人情報漏洩ガイド)
   - 同じ場所(同じオリジン)のファイルを、取得したときに端末へ保存し、ネットがなくても開けるようにします
   - 保存済みの内容を先に表示し、ネットがあるときは裏で新しい内容に更新します(次に開いたときに反映)
   - 他のサイトへの通信には関与しません */
const CN = 'nk-offline-v1';
const SHELL = new URL('__nk_shell__', self.registration.scope).href;

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k.indexOf('nk-offline-') === 0 && k !== CN).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  if (u.pathname.endsWith('/sw.js')) return;
  e.respondWith((async () => {
    const c = await caches.open(CN);
    const key = r.mode === 'navigate' ? (u.origin + u.pathname) : r.url;
    const hit = await c.match(key, { ignoreSearch: r.mode === 'navigate' });
    const net = fetch(r).then(async (res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        await c.put(key, res.clone());
        if (r.mode === 'navigate') await c.put(SHELL, res.clone());
      }
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (r.mode === 'navigate') {
      const sh = await c.match(SHELL);
      if (sh) return sh;
    }
    return new Response('オフラインです。保存済みの内容がありません。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
