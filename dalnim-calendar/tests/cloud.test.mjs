import test from 'node:test';import assert from 'node:assert/strict';import {CloudStore} from '../src/cloud.js';
const conf={apiBase:'https://api.example.test',firebase:{apiKey:'public'}};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('concurrent API requests share one access token refresh',async()=>{const savedFetch=global.fetch,savedStorage=global.sessionStorage;const gate=deferred();let refreshCount=0;global.sessionStorage={setItem(){}};global.fetch=async url=>{assert.ok(url.includes('securetoken'));refreshCount++;await gate.promise;return {ok:true,json:async()=>({id_token:'token',refresh_token:'refresh',expires_in:3600})};};try{const s=new CloudStore(conf);s.refreshToken='old';const a=s.accessToken(),b=s.accessToken();gate.resolve();assert.equal(await a,'token');assert.equal(await b,'token');assert.equal(refreshCount,1);}finally{global.fetch=savedFetch;global.sessionStorage=savedStorage;}});
test('save waits for an in-flight poll then fetches a fresh version',async()=>{const s=new CloudStore(conf),gate=deferred();let gets=0;s.request=async(path,method)=>{if(method==='POST')return {event:{id:'a',revision:2}};gets++;if(gets===1){await gate.promise;return {events:[{id:'a',revision:1}]};}return {events:[{id:'a',revision:2}]};};const poll=s.reload(),save=s.save({id:'a'},1);gate.resolve();await Promise.all([poll,save]);assert.equal(gets,2);assert.equal((await s.list())[0].revision,2);});
test('failed workspace login does not persist a session',async()=>{const previous=global.sessionStorage;let saved=false;global.sessionStorage={setItem(){saved=true;}};try{const s=new CloudStore(conf);s.request=async()=>{throw Error('not invited');};await assert.rejects(s.connectSession({idToken:'token',refreshToken:'refresh',expiresIn:3600}));assert.equal(saved,false);assert.equal(s.token,null);assert.equal(s.timer,undefined);}finally{global.sessionStorage=previous;}});
test('a network failure while saving queues the change and never claims it is fully saved',async()=>{
 const s=new CloudStore(conf);s.token='t';s.expires=Date.now()+3600000;s.workspaceId='family';
 const savedFetch=global.fetch;global.fetch=async()=>{throw new TypeError('network down');};
 try{
  await assert.rejects(s.save({id:'a',title:'x'},0),err=>{assert.equal(err.queued,true);assert.equal(err.event.pendingSync,true);return true;});
  assert.equal(s.pendingCount,1);
  assert.equal((await s.list())[0].pendingSync,true);
 }finally{global.fetch=savedFetch;}
});
test('a queued save is resent once the network returns, then cleared',async()=>{
 const s=new CloudStore(conf);s.token='t';s.expires=Date.now()+3600000;s.workspaceId='family';
 const savedFetch=global.fetch;let mode='offline',posts=0;
 global.fetch=async(url,opts)=>{if(mode==='offline')throw new TypeError('network down');if(opts?.method==='POST'){posts++;return {ok:true,json:async()=>({event:{id:'a',revision:1}})};}return {ok:true,json:async()=>({events:[{id:'a',revision:1}]})};};
 try{
  await assert.rejects(s.save({id:'a',title:'x'},0));assert.equal(s.pendingCount,1);
  mode='online';await s.flushQueue();
  assert.equal(posts,1);assert.equal(s.pendingCount,0);
 }finally{global.fetch=savedFetch;}
});
test('a genuine rejection while flushing (a stale revision) is dropped and reported, not retried forever',async()=>{
 const s=new CloudStore(conf);s.token='t';s.expires=Date.now()+3600000;s.workspaceId='family';
 const savedFetch=global.fetch;global.fetch=async()=>{throw new TypeError('network down');};
 try{
  await assert.rejects(s.save({id:'a',title:'x'},0));
  let conflict=null;s.onConflict=(event,message)=>{conflict={event,message};};
  global.fetch=async(url,opts)=>opts?.method==='POST'?{ok:false,status:409,json:async()=>({error:'stale revision'})}:{ok:true,json:async()=>({events:[]})};
  await s.flushQueue();
  assert.equal(s.pendingCount,0);assert.equal(conflict.message,'stale revision');
 }finally{global.fetch=savedFetch;}
});
