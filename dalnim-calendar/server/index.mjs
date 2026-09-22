import {notificationRoutes,recordDelivery,deliveryState} from './notifications.mjs';
import {eventFromWorklog,worklogFromEvent} from '../src/core/worklog-contract.js';
import {onRequest} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {defineSecret,defineString} from 'firebase-functions/params';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {createHash,randomUUID} from 'node:crypto';
import webpush from 'web-push';
import {canRead,canWrite,cleanEvent,validSubscription} from './policy.mjs';
import {nextReminder} from './schedule.mjs';
initializeApp();
const db=getFirestore(),privateKey=defineSecret('DALNIM_VAPID_PRIVATE_KEY'),publicKey=defineString('DALNIM_VAPID_PUBLIC_KEY'),subject=defineString('DALNIM_PUSH_SUBJECT'),allowedOrigins=defineString('DALNIM_ALLOWED_ORIGINS');
const hash=s=>createHash('sha256').update(s).digest('hex');
const idOK=s=>typeof s==='string'&&/^[\w.-]{1,80}$/.test(s);
const failure=(status,message)=>Object.assign(Error(message),{status});
const jobRef=(space,e,alarm)=>db.collection('dalnimReminderJobs').doc(hash(space+':'+e.id+':'+e.revision+':'+alarm.occurrence));
function addJob(tx,space,e,alarm){if(alarm)tx.set(jobRef(space,e,alarm),{space,eventId:e.id,revision:e.revision,...alarm,attempts:0,leaseUntil:0,delivered:[],createdAt:Date.now()},{merge:false});}
export const calendarApi=onRequest({region:'asia-northeast3',invoker:'public',maxInstances:3,timeoutSeconds:120,secrets:[privateKey]},async(req,res)=>{
 const origin=req.get('Origin'),allow=allowedOrigins.value().split(',').map(s=>s.trim());
 if(origin&&!allow.includes(origin)){res.status(403).json({error:'허용되지 않은 앱입니다.'});return;}
 if(origin){res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');}
 res.set('Access-Control-Allow-Headers','Authorization,Content-Type,X-Workspace-Id');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.set('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.status(204).end();return;}
 try{
  const token=req.get('Authorization')?.replace(/^Bearer /,'');if(!token)throw failure(401,'로그인이 필요합니다.');
  let user;try{user=await getAuth().verifyIdToken(token,true);}catch{throw failure(401,'로그인이 만료되었습니다.');}
  const uid=user.uid,space=req.get('X-Workspace-Id');if(!idOK(space))throw failure(400,'공간이 올바르지 않습니다.');
  const root=db.collection('dalnimSpaces').doc(space),spaceDoc=await root.get(),role=spaceDoc.data()?.members?.[uid];
  if(!role)throw failure(403,'이 공간에 초대된 계정이 아닙니다.');
  const route=req.path.replace(/\/$/,'')||'/';
  if(await notificationRoutes({root,uid,role,req,res,route,webpush,vapid:()=>[subject.value(),publicKey.value(),privateKey.value()]}))return;
  if(route==='/preferences'&&req.method==='GET'){res.json((await root.collection('preferences').doc(uid).get()).data()||{});return;}
  if(route==='/preferences'&&req.method==='POST'){
   const {key,value}=req.body||{};if(!['categories','disabled'].includes(key)||!Array.isArray(value)||value.length>100)throw failure(400,'설정 값이 올바르지 않습니다.');
   if(key==='categories'&&!value.every(c=>typeof c.id==='string'&&/^[\w:.-]{1,160}$/.test(c.id)&&typeof c.label==='string'&&c.label.length<=30&&/^#[0-9a-fA-F]{6}$/.test(c.color)))throw failure(400,'캘린더 분류가 올바르지 않습니다.');
   if(key==='disabled'&&!value.every(v=>typeof v==='string'&&v.length<=80))throw failure(400,'블록 설정이 올바르지 않습니다.');
   await root.collection('preferences').doc(uid).set({[key]:value},{merge:true});res.json({ok:true});return;
  }
  if(route==='/events'&&req.method==='GET'){
   const snapshot=await root.collection('events').limit(5001).get();
   if(snapshot.size>5000)throw failure(413,'일정이 많아 조회 범위 확장이 필요합니다. 관리자에게 문의해 주세요.');
   res.json({events:snapshot.docs.map(x=>x.data()).filter(e=>canRead(e,uid,role))});return;
  }
  if(['/events','/worklog'].includes(route)&&req.method==='POST'){
   if(Buffer.byteLength(JSON.stringify(req.body||{}))>100000)throw failure(413,'일정 내용이 너무 큽니다.');
   let raw=req.body?.event;const worklogRecord=route==='/worklog'?req.body?.record:null;
   if(worklogRecord){try{raw=eventFromWorklog(worklogRecord);}catch(err){throw failure(400,err.message);}}
   if(!raw?.id||!/^[\w:.-]{1,160}$/.test(raw.id))throw failure(400,'일정 ID가 올바르지 않습니다.');
   const ref=root.collection('events').doc(raw.id),expected=req.body.expectedRevision;
   const event=await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),old=snap.data();
    if(!canWrite(old,uid,role))throw failure(403,'이 일정을 수정할 수 없습니다.');
    if((old?.revision||0)!==expected)throw failure(409,'다른 화면에서 수정되었습니다. 최신 내용을 다시 열어 주세요.');
    let e;try{e=cleanEvent(worklogRecord?eventFromWorklog(worklogRecord,old):raw,old,uid,worklogRecord);}catch(err){throw failure(400,err.message);}
    const alarm=nextReminder(e);
    tx.set(ref,e);
    tx.set(ref.collection('history').doc(String(e.revision)),{...e,changedBy:uid});
    // Private search index: never write personal content to the legacy public index.
    tx.set(root.collection('my_system_search').doc(e.id),{app:'dalnim-calendar',type:e.module,title:e.title,memo:e.notes,cat:e.category,date:e.start,ownerId:e.ownerId,visibility:e.visibility,deletedAt:e.deletedAt,updatedAt:e.updatedAt});
    addJob(tx,space,e,alarm);return e;
   });res.json(worklogRecord?{record:{...worklogFromEvent(event,event.worklogRecord),calendarId:event.id,calendarRevision:event.revision}}:{event});return;
  }
  if(route==='/subscriptions'&&req.method==='POST'){
   const sub=req.body?.subscription;if(!validSubscription(sub))throw failure(400,'알림 수신 주소가 올바르지 않습니다.');
   const collection=root.collection('members').doc(uid).collection('subscriptions'),key=hash(sub.endpoint),existing=await collection.doc(key).get();
   if(!existing.exists&&(await collection.limit(20).get()).size>=20)throw failure(400,'등록 기기가 너무 많습니다. 이전 기기를 정리해 주세요.');
   await collection.doc(key).set({subscription:{endpoint:sub.endpoint,keys:{auth:String(sub.keys.auth),p256dh:String(sub.keys.p256dh)}},name:String(req.body?.name||'등록된 기기').slice(0,80),updatedAt:Date.now()});res.json({ok:true});return;
  }
  res.status(404).json({error:'지원하지 않는 요청입니다.'});
 }catch(e){if(!e.status)console.error('calendar API',e);res.status(e.status||500).json({error:e.status?e.message:'서버에서 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'});}
});
// Independent scheduled worker: failure cannot block event creation or editing.
// Claims, per-device checkpoints and stable notification tags limit duplicates.
// Push transport acceptance is NOT user acknowledgement.
export const calendarReminderSweep=onSchedule({schedule:'every 1 minutes',region:'asia-northeast3',maxInstances:1,timeoutSeconds:120,secrets:[privateKey]},async()=>{
 webpush.setVapidDetails(subject.value(),publicKey.value(),privateKey.value());
 const now=Date.now(),jobs=await db.collection('dalnimReminderJobs').where('dueAt','<=',now).limit(100).get();
 await Promise.allSettled(jobs.docs.map(doc=>dispatch(doc.ref,now)));
});
async function dispatch(ref,now){
 const lease=randomUUID();
 const job=await db.runTransaction(async tx=>{const s=await tx.get(ref),j=s.data();if(!j||!j.dueAt||j.leaseUntil>now)return null;tx.update(ref,{lease,leaseUntil:now+180000});return j;});
 if(!job)return;
 try{
  const root=db.collection('dalnimSpaces').doc(job.space),[eventDoc,spaceDoc]=await Promise.all([root.collection('events').doc(job.eventId).get(),root.get()]),e=eventDoc.data(),members=spaceDoc.data()?.members||{};
  if(!e||e.deletedAt||e.status==='done'||e.revision!==job.revision||!members[e.ownerId]){await ref.update({dueAt:FieldValue.delete(),state:'cancelled',leaseUntil:0});return;}
  if(now-job.dueAt>86400000){await finish('expired');return;}
  const recipients=Object.keys(members).filter(uid=>canRead(e,uid,members[uid]));
  let failures=0,targets=0;const delivered=new Set(job.delivered||[]);
  for(const uid of recipients){
   let accepted=0,deviceFailures=0;
   await recordDelivery(root,uid,ref.id,{eventId:e.id,title:e.title,kind:'event',createdAt:job.createdAt,state:'preparing'});
   const subs=await root.collection('members').doc(uid).collection('subscriptions').get();
   for(const sub of subs.docs){targets++;const key=uid+':'+sub.id;if(delivered.has(key)){accepted++;continue;}
    // Recheck event revision just before sending; cancelled jobs do not survive edits.
    const current=(await eventDoc.ref.get()).data();if(!current||current.deletedAt||current.revision!==job.revision){await ref.update({dueAt:FieldValue.delete(),state:'cancelled',leaseUntil:0});return;}
    try{await webpush.sendNotification(sub.data().subscription,JSON.stringify({title:'달님 · 일정 알림',body:e.title,eventId:e.id,deliveryId:ref.id}),{TTL:3600,urgency:'high',timeout:12000});accepted++;delivered.add(key);await ref.update({delivered:FieldValue.arrayUnion(key)});}
    catch(err){if(err.statusCode===404||err.statusCode===410)await sub.ref.delete();else {failures++;deviceFailures++;}}
   }
   await recordDelivery(root,uid,ref.id,{state:deliveryState({accepted,failed:deviceFailures}),accepted,failed:deviceFailures});
  }
  if(failures&&job.attempts<5){await ref.update({attempts:job.attempts+1,dueAt:now+Math.min(3600000,60000*2**job.attempts),leaseUntil:0,state:'retry'});return;}
  await finish(failures?'failed':delivered.size?'sent':'no-device');
  async function finish(state){
   const alarm=nextReminder(e,Date.now(),job.occurrence);
   await db.runTransaction(async tx=>{const current=await tx.get(eventDoc.ref);tx.update(ref,{state,dueAt:FieldValue.delete(),finishedAt:Date.now(),leaseUntil:0});if(current.data()?.revision===job.revision)addJob(tx,job.space,e,alarm);});
  }
 }catch(error){console.error('calendar reminder',ref.id,error.message);await ref.update({leaseUntil:0,dueAt:Date.now()+300000,lastError:String(error.message).slice(0,300),attempts:(job.attempts||0)+1});}
}

