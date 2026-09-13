/* Preserve documents written in the simplified edition before restoring the full editor. */
window.markflowRestoreV38 = (async function () {
  const oldKey='markflow_wysiwyg_v1', newKey='markflow_writer_v4';
  function read(raw){try{const s=typeof raw==='string'?JSON.parse(raw):raw;return s&&Array.isArray(s.docs)?s:null;}catch{return null;}}
  function local(key){try{return read(localStorage.getItem(key));}catch{return null;}}
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('markflow_db',2);r.onupgradeneeded=()=>{for(const k of ['kv','media'])if(!r.result.objectStoreNames.contains(k))r.result.createObjectStore(k);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('다른 MarkFlow 창을 닫고 새로고침해 주세요.'));});
  try{
    const get=key=>new Promise((resolve,reject)=>{const r=db.transaction('kv').objectStore('kv').get(key);r.onsuccess=()=>resolve(read(r.result));r.onerror=()=>reject(r.error);});
    const [oldDB,newDB,previous]=await Promise.all([get('state'),get(newKey),get('restore-v38-applied')]);
    const newLocal=local(newKey),oldLocal=local(oldKey);
    const newest=(a,b)=>(a?.savedAt||0)>(b?.savedAt||0)?a:b||a;
    const writer=newest(newLocal,newDB);if(!writer||writer.savedAt<=(previous?.savedAt||0))return;
    // IDB contains full images; do not replace it with the old lightweight local cache.
    const original=oldDB||oldLocal||{docs:[],folders:[],currentId:null,savedAt:0};
    const merged=structuredClone(original);let added=0;
    for(const d of writer.docs){if(typeof d.content!=='string'||typeof d.id!=='string')continue;const old=merged.docs.find(x=>x.id===d.id);
      if(!old||Number(d.updated)>Number(old.updated||0)){
        const restored={...d,content:'# '+(d.title||'제목 없는 글')+'\n\n'+d.content};
        delete restored.title;
        if(old)merged.docs[merged.docs.indexOf(old)]=restored;else merged.docs.push(restored);
        added++;
      }
    }
    merged.folders=[...new Set([...(merged.folders||[]),...(writer.folders||[]),...merged.docs.map(d=>d.folder).filter(Boolean)])];
    if(added){merged.savedAt=Date.now();if(merged.docs.some(d=>d.id===writer.currentId))merged.currentId=writer.currentId;}
    await new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite'),kv=tx.objectStore('kv');kv.put(JSON.stringify({docs:original.docs,original,writer,savedAt:Date.now()}),'restore-v38-safety-backup');if(added)kv.put(JSON.stringify(merged),'state');kv.put(JSON.stringify({docs:[],savedAt:writer.savedAt}),'restore-v38-applied');tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('복구 글 저장 실패'));});
    if(added){try{const slim=structuredClone(merged);slim.docs.forEach(d=>d.content=d.content.replace(/(!\[[^\]]*\]\()data:[^)\s]+(\))/g,'$1data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7$2'));localStorage.setItem(oldKey,JSON.stringify(slim));}catch{}window.markflowRestoredCount=added;}
  }finally{db.close();}
})();
