// An optional source can fail or be switched off without touching locally authored records.
export class FeedConnection {
 constructor(changed=()=>{}){this.changed=changed;this.events=[];this.state={status:'idle',updatedAt:null,error:''};this.generation=0;}
 publish(status,error=''){this.state={...this.state,status,error};this.changed(this);}
 async reload(store,reader,{enabled=true}={}){
  const generation=++this.generation;
  if(this.store!==store){this.store=store;this.events=[];this.state.updatedAt=null;}
  if(!enabled||!store?.isCloud||!reader){this.events=[];this.publish(!enabled?'disabled':!store?.isCloud?'local':'unavailable');return;}
  this.publish('loading');
  try{
   const result=await reader(store);
   if(generation!==this.generation)return;
   if(!Array.isArray(result?.events))throw Error('기록 목록을 읽지 못했습니다.');
   this.events=result.events;this.state.updatedAt=Date.now();this.publish('ready');
  }catch(err){if(generation!==this.generation)return;this.publish('error',err.message||'연결을 확인해 주세요.');}
 }
}
