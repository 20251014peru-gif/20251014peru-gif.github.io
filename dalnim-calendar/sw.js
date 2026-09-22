const CACHE='dalnim-shell-v5';
const SHELL=['./','./index.html','./styles.css','./theme.css','./icon.svg','./manifest.webmanifest','./vendor/fullcalendar.min.js','./connected.html','./integrations/worklog.css','./integrations/worklog-demo.js','./sdk/worklog-client.js','./src/notifications.js','./src/components/time-dial.js','./src/components/day-flow.js','./src/app.js','./src/config.js','./src/ui.js','./src/demo.js','./src/core/worklog-contract.js','./src/core/model.js','./src/core/store.js','./src/core/registry.js','./src/modules/worklog.js','./src/modules/investment.js','./src/modules/family.js','./src/adapters/worklog.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(p=>c.add(p)))));});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('dalnim-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin||!u.href.startsWith(self.registration.scope))return;
 if(u.pathname.includes('/server/')||u.pathname.includes('/api/'))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok&&r.type==='basic'){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request)));
});
self.addEventListener('push',e=>{let d={};try{d=e.data?.json()||{};}catch{}
 const url=new URL('./',self.registration.scope);if(d.eventId)url.searchParams.set('event',d.eventId);if(d.deliveryId)url.searchParams.set('delivery',d.deliveryId);
 e.waitUntil(self.registration.showNotification(d.title||'달님 일정 알림',{body:d.body||'확인할 일정이 있습니다.',icon:new URL('icon.svg',self.registration.scope).href,tag:d.deliveryId||'dalnim-event',data:{url:url.href},requireInteraction:false}));
});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=e.notification.data?.url||self.registration.scope;e.waitUntil(clients.openWindow(url));});

