import {mapRecordToEvent} from '../investment-feed.mjs';
import {fail,mapFollowup,mapYoutubePrediction,mapPrediction,followupChange,predictionChange,actionable,fingerprint} from './items.mjs';
import {isInvestmentReminder,activeInvestmentReminder} from '../../src/core/investment-snooze.js';

const LIMIT=5000, idOK=s=>typeof s==='string'&&/^[\w.-]{1,160}$/.test(s);
const values=s=>s.docs.map(d=>({...d.data(),id:d.id}));
export function reminderMatches(e,item){return isInvestmentReminder(e)&&[item.id,...(item.aliases||[])].includes(e.details.investmentItemId);}
export function cancelledReminder(e,reason,now=Date.now()){return {...e,status:'done',reminder:-1,revision:e.revision+1,updatedAt:now,details:{...e.details,cancelledBySource:reason}};}
export function writeCancellation(tx,root,doc,e,reason){
 const next=cancelledReminder(e,reason);tx.set(doc.ref,next);
 tx.set(doc.ref.collection('history').doc(String(next.revision)),{...next,changedBy:'source-sync'});
 tx.set(root.collection('my_system_search').doc(next.id),{title:next.title,memo:next.notes,updatedAt:next.updatedAt},{merge:true});
 return next;
}
export function createInvestmentRepository(db,{fetchJSON=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('예측 원본을 읽지 못했습니다.');return r.json();}}={}){
 let publicCache=null;
 async function all(collection){const s=await db.collection(collection).limit(LIMIT+1).get();if(s.size>LIMIT)throw fail(413,'연결 자료가 조회 범위를 넘었습니다. 범위 확장이 필요합니다.');return values(s);}
 async function publicPredictions({fresh=false}={}){
  if(!fresh&&publicCache&&Date.now()-publicCache.at<60000)return publicCache.items;
  const base='https://20251014peru-gif.github.io/invest/';
  const [p,s]=await Promise.all([fetchJSON(base+'raw/predictions.json'),fetchJSON(base+'analysis/scores.json')]);
  if(p.schema!=='predictions/1'||s.schema!=='scores/1'||!Array.isArray(p.items)||!Array.isArray(s.items))throw Error('예측 원본 형식을 확인해 주세요.');
  if(p.items.length>LIMIT)throw Error('예측 원본 조회 범위를 넘었습니다.');
  const scores=new Map(s.items.map(x=>[x.id,x]));const items=p.items.filter(x=>idOK(x.id)).map(x=>mapPrediction(x,scores.get(x.id)));
  publicCache={at:Date.now(),items};return items;
 }
 async function investmentFeed(){
  const [records,followups]=await Promise.all([all('records'),all('record_followups')]);
  return {events:[...records.map(mapRecordToEvent).filter(Boolean),...followups.map(mapFollowup)],version:2};
 }
 async function predictionFeed(){
  const results=await Promise.allSettled([all('youtube_predictions').then(rows=>rows.map(mapYoutubePrediction)),publicPredictions()]);
  const labels=['유튜브 예측','투자 예측'],kinds=['youtube-prediction','prediction'];
  if(results.every(r=>r.status==='rejected'))throw fail(503,'예측 연결을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return {events:results.flatMap(r=>r.status==='fulfilled'?r.value:[]),warnings:results.flatMap((r,i)=>r.status==='rejected'?[labels[i]+' 연결 실패']:[]),unavailableKinds:results.flatMap((r,i)=>r.status==='rejected'?[kinds[i]]:[])};
 }
 function reference(itemId){
  const pairs=[['investment-followup:','record_followups',mapFollowup],['youtube-prediction:','youtube_predictions',mapYoutubePrediction],['investment-record:','records',mapRecordToEvent]];
  for(const [prefix,col,map]of pairs)if(itemId.startsWith(prefix)){const id=itemId.slice(prefix.length);if(!idOK(id))throw fail(400,'연결 항목 ID가 올바르지 않습니다.');return {id,ref:db.collection(col).doc(id),map,col};}
  return null;
 }
 async function resolve(itemId,{fresh=false}={}){
  if(typeof itemId!=='string'||itemId.length>400)throw fail(400,'연결 항목 ID가 올바르지 않습니다.');
  const target=reference(itemId);
  if(target){const s=await target.ref.get();return s.exists?target.map({...s.data(),id:s.id}):null;}
  if(itemId.startsWith('investment-prediction:'))return (await publicPredictions({fresh})).find(e=>e.id===itemId)||null;
  if(itemId.startsWith('investment-check:')||itemId.startsWith('investment-review:'))return (await all('record_followups')).map(mapFollowup).find(e=>e.aliases.includes(itemId))||null;
  throw fail(400,'지원하지 않는 연결 항목입니다.');
 }
 async function save(root,uid,{id,patch,expectedRevision,operationId}){
  if(!idOK(operationId)||!patch||typeof patch!=='object')throw fail(400,'저장 요청이 올바르지 않습니다.');
  const target=reference(String(id||''));if(!target||target.col==='records')throw fail(400,'원본 프로그램에서 수정하는 항목입니다.');
  return db.runTransaction(async tx=>{
   const snap=await tx.get(target.ref);if(!snap.exists)throw fail(404,'원본 항목이 없습니다.');
   const current={...snap.data(),id:snap.id};let changed,review,repeated=false;
   if(target.col==='record_followups'){
    const result=followupChange(current,patch,expectedRevision,operationId);changed=result.item;review=result.review;repeated=result.repeated;
   }else{
    const requestKey=fingerprint(patch);
    if(current._calendarOperationId===operationId&&current._calendarRequestKey===requestKey){changed=current;repeated=true;}
    else changed={...current,...predictionChange(current,patch,expectedRevision),_calendarOperationId:operationId,_calendarRequestKey:requestKey};
   }
   const item=target.map(changed);
   // Read before writing so source state and all matching reservations commit together.
   const reminders=!actionable(item)?await tx.get(root.collection('events').where('source.app','==','dalnim-investment-reminder')):null;
   if(!repeated){
    tx.set(target.ref,changed);
    if(review)tx.set(db.collection('record_followup_reviews').doc(target.id+'_'+operationId),{...review,followupId:target.id});
    else tx.set(root.collection('integrationHistory').doc(fingerprint(id+':'+operationId)),{itemId:id,before:{dueAt:current.검증기한||'',state:current.상태||'대기중',result:current.판정근거||''},after:patch,changedBy:uid,changedAt:Date.now()});
   }
   const cancelled=[];
   for(const doc of reminders?.docs||[]){const e=doc.data();if(activeInvestmentReminder(e)&&reminderMatches(e,item))cancelled.push(writeCancellation(tx,root,doc,e,item.integration.state));}
   return {event:item,cancelled};
  });
 }
 async function cancelIfInactive(root,doc){
  const original=doc.data();if(!activeInvestmentReminder(original))return null;
  // Failed source reads throw; they must never be interpreted as deletion/completion.
  let item=await resolve(original.details.investmentItemId,{fresh:true});
  if(item&&actionable(item))return null;
  return db.runTransaction(async tx=>{
   const snap=await tx.get(doc.ref),current=snap.data();if(!current||current.revision!==original.revision||!activeInvestmentReminder(current))return null;
   const target=item?reference(item.id):reference(original.details.investmentItemId);
   if(target){const source=await tx.get(target.ref);item=source.exists?target.map({...source.data(),id:source.id}):null;if(item&&actionable(item))return null;}
   return writeCancellation(tx,root,doc,current,item?.integration?.state||'source-missing');
  });
 }
 async function reconcile(){
  const spaces=await db.collection('dalnimSpaces').get();let cancelled=0;
  for(const rootDoc of spaces.docs){
   const rows=await rootDoc.ref.collection('events').where('source.app','==','dalnim-investment-reminder').get();
   const results=await Promise.allSettled(rows.docs.filter(d=>activeInvestmentReminder(d.data())).map(d=>cancelIfInactive(rootDoc.ref,d)));
   for(const r of results){if(r.status==='fulfilled'&&r.value)cancelled++;if(r.status==='rejected')console.error('investment source reconciliation',r.reason.message);}
  }
  return cancelled;
 }
 return {investmentFeed,predictionFeed,resolve,save,cancelIfInactive,reconcile,reference};
}
