/* staff-sw.js — 서희타워 직원관리 Service Worker v1 */
var CACHE = 'staff-v5';
var ASSETS = [
  './staff.html',
  './staff-manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).catch(function(){})
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  /* Firebase API는 캐시하지 않음 */
  if(e.request.url.includes('firestore.googleapis.com')||
     e.request.url.includes('googleapis.com/identitytoolkit')) return;
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(res){
        if(res&&res.status===200&&res.type==='basic'){
          var clone=res.clone();
          caches.open(CACHE).then(function(c){c.put(e.request,clone);});
        }
        return res;
      }).catch(function(){
        return caches.match('./staff.html');
      });
    })
  );
});
