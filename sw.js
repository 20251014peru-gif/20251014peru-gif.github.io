/* ===== 서희타워 업무일지 Service Worker v44-0708-0913 =====
   전략: worklog.html / worklog.js 등 앱 코어는 network-first
        (항상 최신을 가져오고, 오프라인일 때만 캐시 폴백)
   → "새로고침해도 버전이 안 바뀌는" 문제 방지
   ===== */
var SW_VERSION = 'wl-v44-0708-0913';
var CACHE_NAME = 'worklog-' + SW_VERSION;

/* 설치: 즉시 활성화 대기 상태로 */
self.addEventListener('install', function(e){
  self.skipWaiting();
});

/* 활성화: 예전 버전 캐시 전부 삭제 + 즉시 제어권 획득 */
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* 페이지에서 SKIP_WAITING 메시지 오면 즉시 새 SW 활성화 */
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING'){ self.skipWaiting(); }
});

/* fetch: 코어 파일은 network-first, 나머지는 그냥 네트워크 */
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET'){ return; }
  var url = new URL(req.url);

  /* 같은 오리진의 html/js/json/css만 network-first 처리 */
  var isCore = url.origin === self.location.origin &&
    /\.(html|js|json|css)(\?|$)/i.test(url.pathname + url.search);

  if(isCore){
    e.respondWith(
      fetch(req).then(function(res){
        /* 성공하면 최신본을 캐시에 갱신해두고 반환 */
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c){ try{ c.put(req, copy); }catch(_e){} });
        return res;
      }).catch(function(){
        /* 오프라인 등 실패 시에만 캐시 폴백 */
        return caches.match(req);
      })
    );
    return;
  }
  /* 그 외 요청은 개입하지 않음 (기본 브라우저 처리) */
});
