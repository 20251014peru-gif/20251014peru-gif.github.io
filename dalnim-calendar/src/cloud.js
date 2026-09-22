import {config} from './config.js';
import {OfflineQueue,isOfflineError} from './core/offline-queue.js';
export class CloudStore{
 constructor(c){this.config=c;this.isCloud=true;this.listeners=new Set();this.cache=[];this.refreshing=false;this.memoryMeta=new Map();this.pendingCount=0;
  if(typeof window!=='undefined')window.addEventListener('online',()=>this.reload({fresh:true}).catch(()=>{}));
 }
 async ensureQueue(){if(!this.queue)this.queue=await new OfflineQueue('dalnim-offline-'+(this.config.apiBase||'')).init();return this.queue;}
 async loginGoogle(workspaceId){
  if(!this.config.apiBase)throw Error('클라우드 서버 연결이 필요합니다.');
  const {googleIdentity}=await import('./google-login.js');const d=await googleIdentity(this.config.firebase);
  this.workspaceId=workspaceId;return this.connectSession(d);
 }
 async connectSession(d){
  this.token=d.idToken;this.refreshToken=d.refreshToken;this.expires=Date.now()+Number(d.expiresIn)*1000;
  try{await this.reload();}catch(e){this.token=null;this.refreshToken=null;throw e;}
  this.persistSession();this.startPolling();if(this.pendingCount)this.flushQueue().catch(()=>{});return this;
 }
 startPolling(){clearInterval(this.timer);this.timer=setInterval(()=>this.reload().then(()=>{if(this.pendingCount)this.flushQueue().catch(()=>{});}).catch(e=>{this.lastError=e.message;for(const fn of this.listeners)fn();}),15000);}
 async login(email,password,workspaceId){
  if(!this.config.firebase?.apiKey||!this.config.apiBase)throw Error('클라우드 설정이 필요합니다.');
  this.workspaceId=workspaceId;
  const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(this.config.firebase.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  const d=await r.json();if(!r.ok)throw Error('로그인하지 못했습니다. 계정과 비밀번호를 확인해 주세요.');
  return this.connectSession(d);
 }
 persistSession(){sessionStorage.setItem('dalnim-session',JSON.stringify({refreshToken:this.refreshToken,workspaceId:this.workspaceId}));}
 async restore(){const d=JSON.parse(sessionStorage.getItem('dalnim-session')||'null');if(!d?.refreshToken)throw Error('로그인이 필요합니다.');this.refreshToken=d.refreshToken;this.workspaceId=d.workspaceId;this.expires=0;await this.reload();this.startPolling();if(this.pendingCount)this.flushQueue().catch(()=>{});return this;}
 async accessToken(){if(Date.now()<this.expires-60000)return this.token;
  if(!this.tokenRequest)this.tokenRequest=this.refreshAccessToken().finally(()=>this.tokenRequest=null);return this.tokenRequest;
 }
 async refreshAccessToken(){
  const r=await fetch('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(this.config.firebase.apiKey),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:this.refreshToken})});const d=await r.json();if(!r.ok)throw Error('로그인이 만료되었습니다. 다시 연결해 주세요.');this.token=d.id_token;this.refreshToken=d.refresh_token;this.expires=Date.now()+Number(d.expires_in)*1000;this.persistSession();return this.token;
 }
 async request(path,method='GET',body){
  const token=await this.accessToken();
  let r;try{r=await fetch(this.config.apiBase+path,{method,headers:{Authorization:'Bearer '+token,'X-Workspace-Id':this.workspaceId,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
  catch{const e=Error('오프라인 상태입니다. 인터넷 연결을 확인해 주세요.');e.offline=true;throw e;}
  const data=await r.json();if(!r.ok){const e=Error(data.error||'서버와 연결하지 못했습니다.');e.status=r.status;throw e;}return data;
 }
 async reload({fresh=false}={}){
  while(this.reloadRequest){if(!fresh)return this.reloadRequest;await this.reloadRequest.catch(()=>{});}
  this.reloadRequest=(async()=>{
   const data=await this.request('/events');
   const queued=await(await this.ensureQueue()).list();this.pendingCount=queued.length;
   const pendingIds=new Set(queued.map(q=>q.event.id));
   const pendingEvents=queued.map(q=>({...q.event,revision:(q.expectedRevision||0)+1,pendingSync:true}));
   this.cache=[...data.events.filter(e=>!pendingIds.has(e.id)),...pendingEvents];this.lastError=null;for(const fn of this.listeners)fn();
  })().finally(()=>this.reloadRequest=null);return this.reloadRequest;
 }
 // While offline, a save is queued rather than rejected outright — but it never claims to be fully
 // saved: callers get a distinct `queued` error with the optimistic event, and cache entries carry
 // pendingSync so the UI can say "waiting to sync" instead of pretending the cloud copy is current.
 async save(event,expectedRevision=0){
  try{const data=await this.request('/events','POST',{event,expectedRevision});await this.reload({fresh:true});return data.event;}
  catch(err){
   if(!isOfflineError(err))throw err;
   const queue=await this.ensureQueue();
   const existing=(await queue.list()).find(x=>x.event.id===event.id);
   const baseRevision=existing?existing.expectedRevision:expectedRevision;
   if(existing)await queue.remove(existing.localId);
   await queue.enqueue({event,expectedRevision:baseRevision,queuedAt:Date.now()});
   this.pendingCount=(await queue.list()).length;
   const optimistic={...event,revision:baseRevision+1,pendingSync:true};
   this.cache=[...this.cache.filter(x=>x.id!==event.id),optimistic];for(const fn of this.listeners)fn();
   const queuedErr=Error('오프라인 상태입니다. 온라인이 되면 자동으로 저장됩니다.');queuedErr.queued=true;queuedErr.event=optimistic;throw queuedErr;
  }
 }
 // Retries queued saves in order once connectivity returns. A renewed offline failure stops the
 // sweep (retried on the next poll/online event); a real server rejection (e.g. a stale revision
 // conflict from another device) is surfaced via onConflict and dropped, never silently reapplied.
 async flushQueue(){
  if(this.flushing)return;this.flushing=true;
  try{
   const queue=await this.ensureQueue();let synced=0;
   for(const item of await queue.list()){
    try{await this.request('/events','POST',{event:item.event,expectedRevision:item.expectedRevision});await queue.remove(item.localId);synced++;}
    catch(err){if(isOfflineError(err))break;await queue.remove(item.localId);this.onConflict?.(item.event,err.message);}
   }
   if(synced)this.onSynced?.(synced);
  }finally{this.flushing=false;await this.reload({fresh:true}).catch(()=>{});for(const fn of this.listeners)fn();}
 }
 async list(){return structuredClone(this.cache);}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 async remove(event){return this.save({...event,deletedAt:Date.now()},event.revision);}
 async import(events){let n=0;for(const e of events){if(this.cache.some(x=>x.id===e.id))continue;try{await this.save(e,0);}catch(err){if(!err.queued)throw err;}n++;}return n;}
 async meta(k,f){if(!this.preferences)this.preferences=await this.request("/preferences");return this.preferences[k]??f;}
 async setMeta(k,v){await this.request("/preferences","POST",{key:k,value:v});this.preferences={...this.preferences,[k]:v};}
 close(){clearInterval(this.timer);this.token=null;this.refreshToken=null;sessionStorage.removeItem("dalnim-session");}
}
export async function subscribePush(store){
 if(!('serviceWorker' in navigator)||!('PushManager' in window))throw Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
 if(!config.vapidPublicKey)throw Error('서버의 알림 키 연결이 필요합니다.');
 if(await Notification.requestPermission()!=='granted')throw Error('휴대폰 설정에서 알림 권한을 허용해 주세요.');
 const reg=await navigator.serviceWorker.ready;
 const s=config.vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/'),key=Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
 const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 await store.request('/subscriptions','POST',{subscription:sub.toJSON(),name:/Android/i.test(navigator.userAgent)?'안드로이드':/iPhone|iPad/i.test(navigator.userAgent)?'아이폰 · 아이패드':'PC 브라우저'});
}

