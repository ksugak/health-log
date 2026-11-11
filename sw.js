// 혈압·체중 수첩 - 오프라인에서도 앱이 열리도록 파일을 캐시한다.
const PREFIX = 'health-log-';
const CACHE = PREFIX + 'v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // 같은 주소를 쓰는 다른 앱의 캐시는 건드리지 않고, 이 앱의 옛 캐시만 지운다
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;               // AI 요청(POST)은 건드리지 않는다
  const url = new URL(req.url);

  // AI용 SDK(버전 고정된 CDN 파일): 한 번 받으면 캐시에서 쓴다
  if (url.hostname === 'esm.sh') {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // 앱 파일: 새 버전이 바로 반영되도록 네트워크 우선, 안 되면 캐시
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || c.match('index.html'))))
    );
  }
});
