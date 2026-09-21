import {config} from './config.js';
export class CloudStore{
 constructor(c){this.config=c;this.isCloud=true;this.listeners=new Set();this.cache=[];this.refreshing=false;this.memoryMeta=new Map();}
 async login(email,password,workspaceId){
  if(!this.config.firebase?.apiKey||!this.config.apiBase)throw Error('클라우드 설정이 필요합니다.');
  this.workspaceId=workspaceId;
  const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(this.config.firebase.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  const d=await r.json();if(!r.ok)throw Error('로그인하지 못했습니다. 계정과 비밀번호를 확인해 주세요.');
  this.token=d.idToken;this.refreshToken=d.refreshToken;this.expires=Date.now()+Number(d.expiresIn)*1000;
  this.persistSession();await this.reload();this.timer=setInterval(()=>this.reload().catch(e=>{this.lastError=e.message;for(const fn of this.listeners)fn();}),15000);return this;
 }
 persistSession(){sessionStorage.setItem('dalnim-session',JSON.stringify({refreshToken:this.refreshToken,workspaceId:this.workspaceId}));}
 async restore(){const d=JSON.parse(sessionStorage.getItem('dalnim-session')||'null');if(!d?.refreshToken)throw Error('로그인이 필요합니다.');this.refreshToken=d.refreshToken;this.workspaceId=d.workspaceId;this.expires=0;await this.reload();this.timer=setInterval(()=>this.reload().catch(e=>{this.lastError=e.message;for(const fn of this.listeners)fn();}),15000);return this;}
 async accessToken(){if(Date.now()<this.expires-60000)return this.token;
  const r=await fetch('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(this.config.firebase.apiKey),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:this.refreshToken})});const d=await r.json();if(!r.ok)throw Error('로그인이 만료되었습니다. 다시 연결해 주세요.');this.token=d.id_token;this.refreshToken=d.refresh_token;this.expires=Date.now()+Number(d.expires_in)*1000;this.persistSession();return this.token;
 }
 async request(path,method='GET',body){
  const token=await this.accessToken();const r=await fetch(this.config.apiBase+path,{method,headers:{Authorization:'Bearer '+token,'X-Workspace-Id':this.workspaceId,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'서버와 연결하지 못했습니다.');return data;
 }
 async reload(){if(this.refreshing)return;this.refreshing=true;try{const data=await this.request('/events');this.cache=data.events;this.lastError=null;for(const fn of this.listeners)fn();}finally{this.refreshing=false;}}
 async list(){return structuredClone(this.cache);}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 async save(event,expectedRevision=0){const data=await this.request('/events','POST',{event,expectedRevision});await this.reload();return data.event;}
 async remove(event){return this.save({...event,deletedAt:Date.now()},event.revision);}
 async import(events){let n=0;for(const e of events){if(this.cache.some(x=>x.id===e.id))continue;await this.save(e,0);n++;}return n;}
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
 await store.request('/subscriptions','POST',{subscription:sub.toJSON()});
}

