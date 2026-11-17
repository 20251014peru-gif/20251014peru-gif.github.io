(()=>{'use strict';
const ready=new Promise((resolve,reject)=>{const r=indexedDB.open('qm-drive-session-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('auth');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function transact(mode,fn){const d=await ready;return new Promise((resolve,reject)=>{const t=d.transaction('auth',mode);let req;try{req=fn(t.objectStore('auth'))}catch(e){reject(e);return}t.oncomplete=()=>resolve(req?.result);t.onerror=()=>reject(t.error)})}
async function key(){let k=await transact('readonly',s=>s.get('key'));if(!k){k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await transact('readwrite',s=>s.put(k,'key'))}return k}
let queue=Promise.resolve();function guard(fn){if(navigator.locks)return navigator.locks.request('qm-drive-auth-session',fn);const task=queue.catch(()=>{}).then(fn);queue=task;return task}
window.QMDriveSession={
 async save(value){return guard(async()=>{const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(JSON.stringify(value)));await transact('readwrite',s=>s.put({iv,data},'session'))})},
 async load(){return guard(async()=>{const entry=await transact('readonly',s=>s.get('session'));if(!entry)return null;try{return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:entry.iv},await key(),entry.data)))}catch(e){await transact('readwrite',s=>s.delete('session'));return null}})},
 async clear(){return guard(()=>transact('readwrite',s=>s.delete('session')))}
};})();

