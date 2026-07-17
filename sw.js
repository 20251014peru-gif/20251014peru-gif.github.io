/* 나의 시스템 PWA — 설치·배지용 최소 서비스워커 */
const CACHE = 'mysystem-v1';
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(e){ /* 네트워크 우선(패스스루) */ });
/* 알림 클릭 시 앱으로 포커스 */
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window'}).then(function(cl){
    for(var i=0;i<cl.length;i++){ if('focus'in cl[i]) return cl[i].focus(); }
    if(self.clients.openWindow) return self.clients.openWindow('./index.html');
  }));
});
