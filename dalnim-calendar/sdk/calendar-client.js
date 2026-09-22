// Shared connector for future programs. The caller supplies its authenticated token.
// This module does not depend on the calendar UI or any optional block.
export class CalendarClient {
 constructor({apiBase,workspaceId,getAccessToken}){this.apiBase=apiBase;this.workspaceId=workspaceId;this.getAccessToken=getAccessToken;}
 async request(path,method='GET',data){const r=await fetch(this.apiBase+path,{method,headers:{'Content-Type':'application/json','X-Workspace-Id':this.workspaceId,Authorization:'Bearer '+await this.getAccessToken()},...(data?{body:JSON.stringify(data)}:{})});const b=await r.json();if(!r.ok){const e=Error(b.error||'Calendar request failed');e.status=r.status;throw e;}return b;}
 async list(){return (await this.request('/events')).events;}
 async save(event,expectedRevision=0){return (await this.request('/events','POST',{event,expectedRevision})).event;}
 subscribe(fn,{interval=15000,onError=console.error}={}){let active=true,busy=false;const tick=async()=>{if(!active||busy)return;busy=true;try{const events=await this.list();if(active)fn(events);}catch(e){if(active)onError(e);}finally{busy=false;}};const timer=setInterval(tick,Math.max(3000,interval));tick();return()=>{active=false;clearInterval(timer);};}
 async remove(event){return this.save({...event,deletedAt:Date.now()},event.revision);}
}

