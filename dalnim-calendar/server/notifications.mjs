import {createHash} from 'node:crypto';
import {canRead} from './policy.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const failure=(status,message)=>Object.assign(Error(message),{status});
export function deliveryState({accepted,failed}){return failed?(accepted?'partial':'failed'):(accepted?'accepted':'no-device');}
export async function recordDelivery(root,uid,id,data){
 const ref=root.collection('members').doc(uid).collection('notifications').doc(id);
 await ref.set({...data,id,updatedAt:Date.now()},{merge:true});
}
export async function notificationRoutes({root,uid,role,req,res,route,webpush,vapid}){
 const member=root.collection('members').doc(uid),subscriptions=member.collection('subscriptions'),notices=member.collection('notifications');
 if(route==='/subscriptions'&&req.method==='GET'){
  const snap=await subscriptions.get();res.json({devices:snap.docs.map(d=>({id:d.id,name:d.data().name||'등록된 기기',updatedAt:d.data().updatedAt}))});return true;
 }
 if(route==='/subscriptions/remove'&&req.method==='POST'){
  const id=req.body?.id;if(!/^[a-f0-9]{64}$/.test(id||''))throw failure(400,'기기 ID가 올바르지 않습니다.');
  await subscriptions.doc(id).delete();res.json({ok:true});return true;
 }
 if(route==='/notifications'&&req.method==='GET'){
  const snap=await notices.orderBy('createdAt','desc').limit(50).get(),rows=[];
  for(const doc of snap.docs){const n=doc.data();if(n.eventId){const e=(await root.collection('events').doc(n.eventId).get()).data();if(!e||!canRead(e,uid,role))continue;n.title=e.title;}rows.push(n);}
  res.json({notifications:rows});return true;
 }
 if(route==='/notifications/opened'&&req.method==='POST'){
  const id=req.body?.id;if(!/^[\w-]{1,100}$/.test(id||''))throw failure(400,'알림 ID가 올바르지 않습니다.');
  const ref=notices.doc(id),notice=(await ref.get()).data();if(!notice)throw failure(404,'알림 내역을 찾지 못했습니다.');
  if(notice.eventId){const e=(await root.collection('events').doc(notice.eventId).get()).data();if(!e||!canRead(e,uid,role))throw failure(403,'이 알림을 열 수 없습니다.');}
  const openedAt=notice.openedAt||Date.now();await ref.set({openedAt},{merge:true});res.json({openedAt});return true;
 }
 if(route==='/notifications/test'&&req.method==='POST'){
  const requestId=req.body?.requestId;if(!/^[\w-]{8,80}$/.test(requestId||''))throw failure(400,'알림 요청 ID가 필요합니다.');
  const id='test-'+hash(requestId),ref=notices.doc(id),now=Date.now();
  const subs=await subscriptions.get();if(subs.empty)throw failure(400,'먼저 이 기기에 알림을 연결해 주세요.');
  const cached=await root.firestore.runTransaction(async tx=>{
   const [prior,owner]=await Promise.all([tx.get(ref),tx.get(member)]);if(prior.exists)return prior.data();
   if(now-(owner.data()?.lastTestAt||0)<30000)throw failure(429,'테스트 알림은 30초 뒤에 다시 보낼 수 있어요.');
   tx.set(member,{lastTestAt:now},{merge:true});tx.set(ref,{id,title:'연결 확인 알림',kind:'test',state:'preparing',createdAt:now,updatedAt:now});return null;
  });
  if(cached){res.json(cached);return true;}
  try{webpush.setVapidDetails(...vapid());}catch(err){await ref.set({state:'failed',updatedAt:Date.now()},{merge:true});throw failure(503,'서버의 알림 키 설정을 확인해 주세요.');}
  let accepted=0,failed=0;
  await Promise.all(subs.docs.map(async sub=>{try{await webpush.sendNotification(sub.data().subscription,JSON.stringify({title:'달님 · 연결 확인',body:'이 알림을 눌러 앱을 열면 확인 상태가 기록돼요.',deliveryId:id}),{TTL:300,urgency:'high',timeout:12000});accepted++;}
   catch(err){if(err.statusCode===404||err.statusCode===410)await sub.ref.delete();else failed++;}}));
  const result={id,state:deliveryState({accepted,failed}),accepted,failed,updatedAt:Date.now()};await ref.set(result,{merge:true});res.json(result);return true;
 }
 return false;
}
