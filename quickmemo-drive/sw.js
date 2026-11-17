const CACHE='quickmemo-drive-v9-editor-startup';
const FILES=['./','./index.html','./drive-config.js','./sync-core.js','./drive-sync.js','./password-core.js','./daily-gate.js?v=focus-editor-9','./media.js?v=focus-editor-9','./layout.js?v=focus-editor-9','./install.js','./install.html','./session-cache.js','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(!FILES.some(f=>new URL(f,self.location.href).pathname===u.pathname))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const clone=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,clone)))}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});

