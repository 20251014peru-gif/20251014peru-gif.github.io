// 부동산 프로젝트 관리 서비스워커 — 오프라인에서도 앱이 열리게 함
// 새 버전 배포 시 아래 CACHE 숫자를 올리면 캐시가 갱신됨
var CACHE = 'realestate-app-v5-5';
var ASSETS = [
  './realestate-project.html',
  './realestate-project.css?v=5.5',
  './realestate-project.js?v=5.5',
  './realestate-manifest.json'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS).catch(function(){}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  // 데이터/외부 API는 항상 네트워크(캐시 안 함) — 데이터는 늘 최신
  if (url.indexOf('firestore.googleapis.com') > -1 ||
      url.indexOf('firebasestorage.googleapis.com') > -1 ||
      url.indexOf('firebasestorage.app') > -1 ||
      url.indexOf('api.anthropic.com') > -1 ||
      e.request.method !== 'GET') {
    return;
  }
  // 앱 파일: 네트워크 우선, 실패 시 캐시(오프라인 대비)
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy).catch(function(){}); });
      return res;
    }).catch(function () { return caches.match(e.request); })
  );
});
