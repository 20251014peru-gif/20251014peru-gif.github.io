const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');const {webcrypto}=require('node:crypto');
const core=require('../sync-core.js');let cloud=[],seq=0,account='owner',failChanges=false;const stats={full:0,changes:0,media:0,create:0,hash:0};
async function backend(url,o={}){
 if(url.includes('/changes/startPageToken'))return Response.json({startPageToken:String(seq+1)});
 if(url.includes('/changes?')){stats.changes++;if(failChanges){failChanges=false;return new Response('retry',{status:503})}const since=Number(new URL(url).searchParams.get('pageToken'));return Response.json({changes:cloud.filter(f=>Number(f.id)>=since).map(({blob,...f})=>({fileId:f.id,removed:false,file:f})),newStartPageToken:String(seq+1)})}
if(url.includes('/about?'))return Response.json({user:{permissionId:account,emailAddress:account+'@example.com'}});
 if(o.method==='POST'){stats.create++;let meta,blob;if(o.body instanceof Blob){const raw=await o.body.text(),boundary=o.body.type.split('boundary=')[1],parts=raw.split('--'+boundary);meta=JSON.parse(parts[1].split('\r\n\r\n')[1]);const data=parts[2],split=data.indexOf('\r\n\r\n');blob=new Blob([data.slice(split+4,-2)],{type:/Content-Type: ([^\r]+)/.exec(data)[1]})}else meta=JSON.parse(o.body);const f={...meta,id:String(++seq),blob};cloud.push(f);return Response.json({id:f.id,name:f.name,appProperties:f.appProperties})}
 const id=/\/files\/(\d+)\?alt=media/.exec(url)?.[1];if(id){stats.media++;const f=cloud.find(f=>f.id===id);return new Response(f.blob,{headers:{'Content-Type':f.blob.type}})}stats.full++;return Response.json({files:cloud.map(({blob,...f})=>f)});
}
function device(stores={notes:new Map(),images:new Map(),revisions:new Map()},storage=new Map()){
 const els={},events={};let callback;const clone=structuredClone;
 const ctx={console,crypto:{randomUUID:()=>webcrypto.randomUUID(),subtle:{digest:(...args)=>{stats.hash++;return webcrypto.subtle.digest(...args)}}},Blob,FormData,Response,URLSearchParams,Date,Map,Set,structuredClone,clearTimeout,setTimeout:()=>0,setInterval:()=>0,confirm:()=>true,fetch:backend,QMSyncCore:core,QM_DRIVE:{clientId:'test'},db:{},notes:[...stores.notes.values()],active:null,pendingWrites:Promise.resolve(),render(){},getOne:async(s,id)=>clone(stores[s].get(id)),getAll:async s=>clone([...stores[s].values()]),put:async(s,n)=>stores[s].set(n.id,clone(n)),enqueue:async fn=>fn(),navigator:{onLine:true,locks:{request:async(n,fn)=>fn()}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},google:{accounts:{oauth2:{initTokenClient:c=>{callback=c.callback;return{requestAccessToken(){}}}}}},document:{hidden:false,getElementById:id=>els[id]??=( {hidden:false,textContent:''}),addEventListener(){}},addEventListener:(n,fn)=>events[n]=fn};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../drive-sync.js'),'utf8'),ctx);
 return {ctx,stores,storage,els,login:async()=>{els.cloudLogin.onclick();await callback({access_token:'token',expires_in:3600})},sync:()=>els.cloudSync.onclick(),status:()=>els.cloudState.textContent,save:n=>{stores.notes.set(n.id,clone(n));ctx.notes=[...stores.notes.values()]}};
}
const note=(id,body)=>({id,type:'work',body,person:'',scope:'personal',direction:'expense',amount:'',category:'',created:'2026-11-17T00:00:00Z',updated:'2026-11-17T00:00:00Z',images:[],star:false,done:false,deleted:false});
(async()=>{
 const a=device();a.save(note('note1','first'));await a.login();assert.match(a.status(),/동기화 완료/);const b=device();await b.login();assert.equal(b.stores.notes.get('note1').body,'first');
 a.ctx.navigator.onLine=false;a.save({...a.stores.notes.get('note1'),body:'offline edit'});await a.sync();assert.match(a.status(),/오프라인/);
 const reloaded=device(a.stores,a.storage);await reloaded.login();assert.match(reloaded.status(),/완료/);await b.sync();assert.equal(b.stores.notes.get('note1').body,'offline edit');
 reloaded.save({...reloaded.stores.notes.get('note1'),body:'branch A'});b.save({...b.stores.notes.get('note1'),body:'branch B'});await reloaded.sync();await b.sync();await reloaded.sync();
 const bodies=[...reloaded.stores.notes.values()].map(n=>n.body);assert(bodies.some(x=>x.includes('branch A')));assert(bodies.some(x=>x.includes('branch B')));
 const count=reloaded.stores.notes.size;await reloaded.sync();assert.equal(reloaded.stores.notes.size,count);
 const img=new Blob(['photo bytes'],{type:'image/png'});reloaded.stores.images.set('image1',{id:'image1',blob:img,type:'image/png'});reloaded.save({...note('photo1','photo'),images:['image1']});await reloaded.sync();await b.sync();assert.equal(await b.stores.images.get('image1').blob.text(),'photo bytes');
 const assets=cloud.filter(f=>f.appProperties?.kind==='asset').length;reloaded.save({...reloaded.stores.notes.get('photo1'),body:'photo edited'});await reloaded.sync();assert.equal(cloud.filter(f=>f.appProperties?.kind==='asset').length,assets);
 reloaded.save({...reloaded.stores.notes.get('photo1'),deleted:true});await reloaded.sync();await b.sync();assert.equal(b.stores.notes.get('photo1').deleted,true);
 account='different';const blocked=device(a.stores,a.storage);const before=cloud.length;await blocked.login();assert.match(blocked.status(),/계정 혼합/);assert.equal(cloud.length,before);
 account='owner';
 await reloaded.login();await reloaded.sync();const beforeStats={...stats};await reloaded.sync();
 assert.equal(stats.hash-beforeStats.hash,0);assert.equal(stats.full-beforeStats.full,0);assert.equal(stats.media-beforeStats.media,0);assert.equal(stats.create-beforeStats.create,0);assert.equal(stats.changes-beforeStats.changes,1);
 const checkpoint=structuredClone(reloaded.stores.revisions.get('__qm_drive_index_v1'));failChanges=true;await reloaded.sync();assert.match(reloaded.status(),/503/);assert.deepEqual(reloaded.stores.revisions.get('__qm_drive_index_v1'),checkpoint);await reloaded.sync();assert.match(reloaded.status(),/완료/);
 for(let i=0;i<1000;i++)reloaded.save(note('scale'+i,'메모 '+i));await reloaded.sync();await b.sync();const scaleStats={...stats};await b.sync();assert.equal(stats.full-scaleStats.full,0);assert.equal(stats.media-scaleStats.media,0);assert.equal(stats.create-scaleStats.create,0);assert.equal(stats.hash-scaleStats.hash,0);
 console.log('PERF PASS: unchanged sync with 1,000+ notes and photos = 1 changes request, 0 full listings, 0 downloads/uploads, 0 photo hashes; failed cursor retries safely');
 console.log('PASS: two-device transfer, offline reload/retry, concurrent edits preserved, stable conflicts, photo integrity, photo deduplication, trash sync, account isolation');
})().catch(e=>{console.error(e);process.exit(1)});

