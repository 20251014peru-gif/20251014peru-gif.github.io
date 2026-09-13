/* Load full documents before editor startup. Recover only uniquely identified placeholders. */
window.markflowPhotos=(()=>{
 const PH='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
 const images=s=>[...(s||'').matchAll(/!\[([^\]]*)\]\((data:image\/[^\s)]+)(?:\s+"[^"]*")?\)/g)];
 const real=d=>images(d.content).filter(m=>m[2]!==PH);
 const skeleton=s=>(s||'').replace(/(!\[[^\]]*\]\()data:image\/[^\s)]+/g,'$1IMAGE').replace(/\s+/g,' ').trim();
 let sources=[],result={restored:0,missing:0,backedUp:false},db;
 function parse(x){try{return typeof x==='string'?JSON.parse(x):x;}catch{return null;}}
 function collect(value){const v=parse(value);if(!v||typeof v!=='object')return;if(Array.isArray(v.docs))sources.push({docs:v.docs.map(d=>({...d,content:(d.title?'# '+d.title+'\n\n':'')+(d.content||'')}))});for(const k of ['state','original','writer','local','idb'])if(v[k])collect(v[k]);}
 function repair(state){const next=structuredClone(state);let count=0;
  for(const d of next.docs||[]){const candidates=sources.flatMap(s=>s.docs).filter(c=>c.id===d.id),currentImages=images(d.content);let index=0;
   d.content=(d.content||'').replace(/!\[([^\]]*)\]\((data:image\/[^\s)]+)(?:\s+"[^"]*")?\)/g,(whole,alt,url)=>{const i=index++;if(url!==PH)return whole;const found=new Set();
    for(const c of candidates){const ci=images(c.content);if(ci.length===currentImages.length&&skeleton(c.content)===skeleton(d.content)&&ci[i]&&ci[i][2]!==PH)found.add(ci[i][2]);
     else if(alt&&currentImages.filter(x=>x[1]===alt).length===1){const same=ci.filter(x=>x[1]===alt&&x[2]!==PH);if(same.length===1)found.add(same[0][2]);}}
    if(found.size===1){count++;return whole.replace(PH,[...found][0]);}return whole;
   });
  }return {state:next,count};
 }
 const get=k=>new Promise((resolve,reject)=>{const r=db.transaction('kv').objectStore('kv').get(k);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const put=(k,v)=>new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});
 async function prepare(){try{
  db=await new Promise((resolve,reject)=>{const r=indexedDB.open('markflow_db',2);r.onupgradeneeded=()=>{for(const n of ['kv','media'])if(!r.result.objectStoreNames.contains(n))r.result.createObjectStore(n);};r.onsuccess=()=>resolve(r.result);r.onerror=r.onblocked=()=>reject(r.error||Error('저장소가 다른 창에서 사용 중입니다.'));});
  const local=localStorage.getItem('markflow_wysiwyg_v1'),keys=['state','markflow_writer_v4','writer-v4-original-backup','restore-v38-safety-backup'];const values=await Promise.all(keys.map(get));const snapshot=await get('photo-recovery-safety-v1');
  if(!snapshot)await put('photo-recovery-safety-v1',{time:Date.now(),local,values});result.backedUp=true;
  values.forEach(collect);collect(local);collect(localStorage.getItem('markflow_writer_v4'));if(snapshot){collect(snapshot.local);(snapshot.values||[]).forEach(collect);}
  const a=parse(local),b=parse(values[0]);const valid=x=>x&&Array.isArray(x.docs)&&x.docs.length;const latest=valid(a)&&(!valid(b)||(a.savedAt||0)>(b.savedAt||0))?a:b;
  if(valid(latest)){const fixed=repair(latest);result.state=fixed.state;result.restored=fixed.count;result.missing=result.state.docs.reduce((n,d)=>n+images(d.content).filter(m=>m[2]===PH).length,0);if(fixed.count){result.state.savedAt=Date.now();await put('state',JSON.stringify(result.state));}}
 }catch(e){result.blocked=true;result.error=e.message||'사진 원본을 안전하게 읽지 못했습니다.';}return result;}
 function alternatives(state){return state.docs.flatMap(d=>{const candidates=sources.flatMap(s=>s.docs).filter(c=>c.id===d.id&&real(c).length>real(d).length).sort((a,b)=>real(b).length-real(a).length);return candidates[0]?[candidates[0]]:[];});}
 return {prepare,repair,alternatives,get result(){return result;}};
})();
