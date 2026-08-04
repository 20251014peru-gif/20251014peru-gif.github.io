/* ===== 서희타워 업무일지 Service Worker =====
   전략: network-first (HTML/JS/CSS 항상 최신 우선, 오프라인일 때만 캐시 폴백)
   ⚠️ 배포할 때마다 아래 SW_VERSION 문자열만 새 버전으로 바꾸면
      브라우저가 새 SW를 설치하고 옛 캐시를 전부 지운 뒤 1회 자동 새로고침한다.
   ⚠️ 같은 출처(github.io)만 처리하고 Firebase·구글 등 외부 요청은 건드리지 않는다. */
const SW_VERSION = 'v45-20260804-132536';
const CACHE_NAME = 'worklog-' + SW_VERSION;

/* 설치: 즉시 대기 해제 (waiting 단계 건너뜀) */
self.addEventListener('install', function(e){
  self.skipWaiting();
});

/* 활성화: CACHE_NAME 이외의 옛 캐시 전부 삭제 후 즉시 제어권 획득 */
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE_NAME){ return caches.delete(k); }
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* 페이지에서 SKIP_WAITING 요청 시 즉시 활성화 */
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING'){ self.skipWaiting(); }
});

/* fetch: 네트워크 우선 → 성공 시 캐시에 갱신, 실패(오프라인) 시 캐시 폴백 */
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET'){ return; }                 /* GET 만 처리 */
  var url;
  try { url = new URL(req.url); } catch(_){ return; }
  if(url.origin !== self.location.origin){ return; }  /* 외부(Firebase/구글/CDN) 는 브라우저 기본 처리 */

  e.respondWith(
    fetch(req).then(function(res){
      /* 정상 응답만 캐시에 저장 (opaque/에러 제외) */
      if(res && res.status === 200 && res.type === 'basic'){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c){ try { c.put(req, copy); } catch(_){} });
      }
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        if(hit) return hit;
        if(req.mode === 'navigate'){ return caches.match('/worklog.html'); }
        return undefined;
      });
    })
  );
});
