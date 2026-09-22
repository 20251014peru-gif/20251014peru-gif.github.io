import {attachWorklog} from './worklog-contract.js';
import {validateEvent} from './model.js';
export class LocalStore {
  async init(name='dalnim-preview-v1') {
    this.db = await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('events',{keyPath:'id'});r.result.createObjectStore('meta');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    this.channel = typeof BroadcastChannel!=='undefined' ? new BroadcastChannel(name) : null;
    this.listeners=new Set(); if(this.channel) this.channel.onmessage=()=>this.emit(); return this;
  }
  emit(){ for(const fn of this.listeners) { try{fn();}catch(e){console.error(e);} } }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  async list(){return this.read('events',s=>s.getAll());}
  async meta(key,fallback){const v=await this.read('meta',s=>s.get(key));return v===undefined?fallback:v;}
  read(name,fn){return new Promise((resolve,reject)=>{const r=fn(this.db.transaction(name).objectStore(name));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  setMeta(key,value){return new Promise((resolve,reject)=>{const t=this.db.transaction('meta','readwrite');t.objectStore('meta').put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});}
  async save(input,expectedRevision=0,options={}){
    const e=validateEvent(input);
    return new Promise((resolve,reject)=>{
      const t=this.db.transaction('events','readwrite'), s=t.objectStore('events');let result, failure;
      const r=s.get(e.id);r.onsuccess=()=>{
        const old=r.result;
        if((old?.revision||0)!==expectedRevision){failure=Error('다른 화면에서 이 일정을 수정했습니다. 창을 닫고 최신 내용을 다시 열어 주세요.');t.abort();return;}
        let linked;try{linked=attachWorklog(e,old,options.worklogRecord);}catch(err){failure=err;t.abort();return;}
        result={...linked,revision:(old?.revision||0)+1,updatedAt:Date.now(),createdAt:old?.createdAt||Date.now()};s.put(result);
      };
      t.oncomplete=()=>{this.channel?.postMessage('change');this.emit();resolve(result);};t.onabort=()=>reject(failure||t.error);t.onerror=()=>reject(t.error);
    });
  }
  async remove(e){return this.save({...e,deletedAt:Date.now()},e.revision);}
  async import(events){
    const checked=events.map(validateEvent);
    if(checked.length>5000) throw Error('한 번에 5,000개까지 가져올 수 있습니다.');
    return new Promise((resolve,reject)=>{const t=this.db.transaction('events','readwrite'),s=t.objectStore('events');let added=0;
      for(const e of checked){const r=s.get(e.id);r.onsuccess=()=>{if(!r.result){s.put({...e,revision:1,createdAt:Date.now(),updatedAt:Date.now()});added++;}};}
      t.oncomplete=()=>{this.channel?.postMessage('change');this.emit();resolve(added);};t.onabort=()=>reject(t.error);t.onerror=()=>reject(t.error);
    });
  }
}
