import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
function worker(fetch){
 const listeners={},added=[],writes=[],origin='https://calendar.example',scope=origin+'/dalnim-calendar/';let activated=false;
 const cached={offline:true};
 const self={registration:{scope},clients:{claim:async()=>{}},skipWaiting:async()=>{activated=true;},addEventListener:(name,fn)=>listeners[name]=fn};
 const caches={open:async()=>({add:async req=>added.push(req),put:async(req,response)=>writes.push(response)}),match:async()=>cached};
 vm.runInNewContext(source,{self,caches,fetch,URL,location:{origin},Request:class{constructor(url,options){this.url=url;this.cache=options.cache;}}});
 return {listeners,added,writes,cached,activated:()=>activated,scope};
}
test('an update caches versioned entry assets and activates without closing existing calendar tabs',async()=>{
 const w=worker();let pending;w.listeners.install({waitUntil:p=>pending=p});await pending;
 assert.ok(w.activated());assert.ok(w.added.some(r=>r.url==='./src/app.js?v=0.12.1'));
 assert.ok(w.added.some(r=>r.url==='./src/config.js?v=0.12.1'));assert.ok(w.added.every(r=>r.cache==='reload'));
});
test('online shell requests revalidate HTTP cache and retain a usable offline copy',async()=>{
 let cacheMode;const response={ok:true,type:'basic',clone(){return this;}},w=worker(async(req,options)=>{cacheMode=options.cache;return response;});let result;const tasks=[];
 w.listeners.fetch({request:{method:'GET',url:w.scope+'src/app.js?v=0.12.1'},respondWith:p=>result=p,waitUntil:p=>tasks.push(p)});
 assert.equal(await result,response);await Promise.all(tasks);assert.equal(cacheMode,'no-cache');assert.equal(w.writes.length,1);
});
test('offline requests still use the saved shell, while API and cross-origin calls stay untouched',async()=>{
 const w=worker(async()=>{throw Error('offline');});let result;
 w.listeners.fetch({request:{method:'GET',url:w.scope+'src/app.js'},respondWith:p=>result=p,waitUntil:()=>{}});assert.equal(await result,w.cached);
 for(const url of [w.scope+'api/data','https://api.example/events']){let intercepted=false;w.listeners.fetch({request:{method:'GET',url},respondWith:()=>intercepted=true});assert.equal(intercepted,false);}
});
