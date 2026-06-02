// staff-sw.js v2 - Network First 전략 (항상 최신 파일 우선)
const CACHE_NAME = 'staff-v2';

self.addEventListener('install', e=>{
  self.skipWaiting(); // 즉시 활성화
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))
    ).then(()=>self.clients.claim())
  );
});

// Network First: 네트워크 우선, 실패 시 캐시
self.addEventListener('fetch', e=>{
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res=>{
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c=>c.put(e.request, clone));
      return res;
    }).catch(()=> caches.match(e.request))
  );
});

// 메시지: SKIP_WAITING 처리
self.addEventListener('message', e=>{
  if(e.data && e.data.type==='SKIP_WAITING') self.skipWaiting();
});
