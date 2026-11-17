const CACHE='quickmemo-drive-v18-startup-resume-sync';
const FILES=['./annotation-core.js?v=phone-16','./photo-annotator.js?v=phone-17','./phone-ui.js?v=phone-17','./','./index.html','./drive-config.js','./sync-core.js?v=phone-15','./drive-sync.js?v=phone-18','./password-core.js?v=secure-12','./crypto-core.js?v=phone-15','./vault.js?v=phone-16','./viewport.js?v=phone-16','./backup.js?v=secure-12','./editor.js?v=phone-16','./vendor/quill.js?v=2.0.3','./vendor/quill.core.css?v=2.0.3','./daily-gate.js?v=phone-15','./media.js?v=phone-16','./layout.js?v=phone-16','./install.js','./install.html','./session-cache.js?v=phone-16','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(!FILES.some(f=>new URL(f,self.location.href).pathname===u.pathname))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const clone=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,clone)))}return r}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))))});





