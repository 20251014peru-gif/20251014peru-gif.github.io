import test from 'node:test';import assert from 'node:assert/strict';
import {mapFollowup,mapYoutubePrediction,mapPrediction,dueItems,digestItems,followupChange,predictionChange,validDate} from '../server/linked-investments/items.mjs';
import {createInvestmentRepository} from '../server/linked-investments/repository.mjs';
import {memoryFirestore} from './helpers/memory-firestore.mjs';
import {makeInvestmentReminder,investmentReminderId,getInvestmentReminder,canRemindInvestment} from '../src/core/investment-snooze.js';
const fu={id:'fu_a',question:'실적 검증',dueAt:'2026-10-03',originalDueAt:'2026-09-20',state:'open',result:'',revision:3,sourceIds:['r1'],sourceSnapshots:[{title:'원본'}],legacy:{index:0,check:{id:'check_a'},key:'r1#check_a'},assets:[{id:'photo',url:'https://example.com/a.png'}],links:[{url:'https://example.com/'}],expectation:'성장 유지'};
const yt={id:'p_a',대상:'매출 성장',검증기한:'2026-10-04',상태:'대기중',판정근거:'',원문:'성장 예상',채널:'채널'};
const rootPath='dalnimSpaces/family';
const sourceURL=url=>Promise.resolve(url.endsWith('raw/predictions.json')?{schema:'predictions/1',items:[]}:{schema:'scores/1',items:[]});
function fixture(extra={}){const db=memoryFirestore({'records/r1':{date:'2020-01-01',title:'원본',checks:[{date:'2026-09-20'}]},'record_followups/fu_a':fu,'youtube_predictions/p_a':yt,[rootPath]:{members:{owner:'owner'}},...extra});return {db,repo:createInvestmentRepository(db,{fetchJSON:sourceURL}),root:db.collection('dalnimSpaces').doc('family')};}
async function reminder(item,id='reservation'){return {...makeInvestmentReminder(item,new Date(Date.now()+3600000),id),revision:1,ownerId:'owner'};}
test('calendar uses the current followup date/status and never old checks, even for old records',async()=>{
 const {repo}=fixture();const {events}=await repo.investmentFeed();assert.equal(events.length,2);assert.equal(events[1].start,'2026-10-03');assert.equal(events.some(e=>e.id.startsWith('investment-check:')),false);assert.equal(events[0].start,'2020-01-01');
});
test('paused/undated followups are retained for deep links but not scheduled; done is not actionable',()=>{
 assert.equal(mapFollowup({...fu,state:'paused'}).calendarVisible,false);assert.equal(mapFollowup({...fu,dueAt:''}).calendarVisible,false);
 assert.equal(dueItems([mapFollowup({...fu,state:'done'}),mapFollowup(fu)],fu.dueAt).length,1);assert.equal(canRemindInvestment(mapFollowup({...fu,state:'done'})),false);
 assert.equal(validDate('2026-02-30'),false);
});
test('legacy notification IDs resolve to the same stable followup, without duplicated calendar events',async()=>{
 const {repo}=fixture();assert.equal((await repo.resolve('investment-check:r1:check_a')).id,'investment-followup:fu_a');assert.equal((await repo.resolve('investment-check:r1:0')).id,'investment-followup:fu_a');
});
test('completion requires real results; pause requires a reason; date is validated',()=>{
 assert.throws(()=>followupChange(fu,{state:'done'},3,'op'),/확인 결과/);assert.throws(()=>followupChange(fu,{state:'paused'},3,'op'),/보류 이유/);assert.throws(()=>followupChange(fu,{dueAt:'2026-02-30'},3,'op'),/날짜/);
});
test('saving shares source document and review history, preserving attachments and original checks',async()=>{
 const {repo,db,root}=fixture();const original=structuredClone(db.data.get('records/r1'));
 const result=await repo.save(root,'owner',{id:'investment-followup:fu_a',patch:{dueAt:'2026-10-05',state:'done',result:'발표 결과 확인',nextAction:'다음 분기 관찰'},expectedRevision:3,operationId:'op1'});
 assert.equal(result.event.status,'done');const current=db.data.get('record_followups/fu_a');assert.equal(current.revision,4);assert.deepEqual(current.assets,fu.assets);assert.deepEqual(current.links,fu.links);assert.equal(current.originalDueAt,fu.originalDueAt);assert.deepEqual(db.data.get('records/r1'),original);
 assert.equal(db.data.get('record_followup_reviews/fu_a_op1').event,'completed');
 assert.equal((await repo.resolve(result.event.id)).integration.result,'발표 결과 확인');
});
test('stale concurrent write is rejected and failed transactions do not partially complete/cancel',async()=>{
 const item=mapFollowup(fu),e=await reminder(item);const {repo,db,root}=fixture({[rootPath+'/events/reservation']:e});
 await assert.rejects(repo.save(root,'owner',{id:item.id,patch:{state:'done',result:'확인'},expectedRevision:2,operationId:'stale'}),e=>e.status===409);
 db.beforeCommit(()=>{});await assert.rejects(repo.save(root,'owner',{id:item.id,patch:{state:'done',result:'확인'},expectedRevision:3,operationId:'failed'}));
 assert.equal(db.data.get('record_followups/fu_a').state,'open');assert.equal(db.data.get(rootPath+'/events/reservation').status,'planned');assert.equal([...db.data.keys()].some(k=>k.startsWith('record_followup_reviews/')),false);
});
test('complete cancels both old and canonical reservations atomically; retry writes one history',async()=>{
 const item=mapFollowup(fu),a=await reminder(item,'a'),b=await reminder({...item,id:'investment-check:r1:check_a'},'b');const {repo,db,root}=fixture({[rootPath+'/events/a']:a,[rootPath+'/events/b']:b});
 const request={id:item.id,patch:{state:'done',result:'확인함'},expectedRevision:3,operationId:'same'};
 const result=await repo.save(root,'owner',request);assert.equal(result.cancelled.length,2);await repo.save(root,'owner',request);
 assert.equal(db.data.get(rootPath+'/events/a').reminder,-1);assert.equal(db.data.get(rootPath+'/events/b').revision,2);assert.equal([...db.data.keys()].filter(k=>k.startsWith('record_followup_reviews/')).length,1);
});
test('source completion in the other app is reconciled while calendar is closed; reopening does not revive alerts',async()=>{
 const item=mapFollowup(fu),e=await reminder(item);const {repo,db}=fixture({[rootPath+'/events/reservation']:e});
 db.data.set('record_followups/fu_a',{...fu,state:'done',result:'다른 앱에서 확인',revision:4});assert.equal(await repo.reconcile(),1);assert.equal(db.data.get(rootPath+'/events/reservation').status,'done');
 db.data.set('record_followups/fu_a',{...fu,state:'open',revision:5});assert.equal(await repo.reconcile(),0);assert.equal(db.data.get(rootPath+'/events/reservation').reminder,-1);
});
test('removed source cancels alerts, but source fetch failure never means completion',async()=>{
 const e=await reminder(mapFollowup(fu));const {repo,db}=fixture({[rootPath+'/events/reservation']:e});db.data.delete('record_followups/fu_a');assert.equal(await repo.reconcile(),1);
 const pub=mapPrediction({id:'p',due:'2026-10-03',target:'공개 예측'});const pubEvent=await reminder(pub,'pub');db.data.set(rootPath+'/events/pub',pubEvent);
 const broken=createInvestmentRepository(db,{fetchJSON:async()=>{throw Error('offline');}});await broken.reconcile();assert.equal(db.data.get(rootPath+'/events/pub').status,'planned');
});
test('YouTube predictions share dates and evidence with source; external writes invalidate fingerprint',async()=>{
 const {repo,db,root}=fixture();const item=mapYoutubePrediction(yt);db.data.set('youtube_predictions/p_a',{...yt,판정근거:'다른 화면 수정'});
 await assert.rejects(repo.save(root,'owner',{id:item.id,patch:{dueAt:'2026-10-06',state:'적중',result:'근거'},expectedRevision:item.integration.revision,operationId:'p1'}),e=>e.status===409);
 const fresh=await repo.resolve(item.id);const req={id:item.id,patch:{dueAt:'2026-10-06',state:'판정불가',result:'자료 부족'},expectedRevision:fresh.integration.revision,operationId:'p2'};
 await repo.save(root,'owner',req);await repo.save(root,'owner',req);const current=db.data.get('youtube_predictions/p_a');assert.equal(current.상태,'판정불가');assert.equal(current.검증기한,'2026-10-06');assert.equal(current.원문,yt.원문);
 assert.equal([...db.data.keys()].filter(k=>k.includes('/integrationHistory/')).length,1);
});
test('a failed optional public feed keeps YouTube available and reports missing source',async()=>{
 const {db}=fixture();const repo=createInvestmentRepository(db,{fetchJSON:async()=>{throw Error('unavailable');}});const feed=await repo.predictionFeed();assert.equal(feed.events.length,1);assert.deepEqual(feed.unavailableKinds,['prediction']);assert.equal(feed.warnings.length,1);
});
test('public predictions combine current score and withdrawal without converting them into user edits',()=>{
 const p={id:'p',target:'예측',due:'2026-10-01'};assert.equal(mapPrediction(p,{status:'빗나감',basis:'종가 확인'}).integration.result,'종가 확인');assert.equal(mapPrediction({...p,status:'withdrawn'}).integration.state,'철회');assert.equal(mapPrediction(p).integration.editable,false);
});
test('existing legacy snooze is reused after migration, preventing duplicate reminders',async()=>{
 const item=mapFollowup(fu),legacy=await reminder({...item,id:item.aliases[0]},'old');const store={list:async()=>[legacy]};assert.equal((await getInvestmentReminder(store,item)).id,'old');assert.match(await investmentReminderId(item.id),/^investment-reminder:/);
});
test('daily digest respects a future snooze but includes other pending items',async()=>{
 const a=mapFollowup(fu),b=mapYoutubePrediction({...yt,검증기한:fu.dueAt}),e=await reminder(a);
 assert.deepEqual(digestItems([a,b],fu.dueAt,[e]).map(x=>x.id),[b.id]);
 assert.equal(digestItems([a,b],fu.dueAt,[{...e,status:'done'}]).length,2);
});
