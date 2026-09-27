import test from 'node:test';
import assert from 'node:assert/strict';
import {verificationGuide,planFor,matchingCases,safeEvidenceURL} from '../src/core/verification.js';
import {followupChange,mapFollowup} from '../server/linked-investments/items.mjs';
import {saveTransition} from '../server/linked-investments/followup-contract.mjs';
import {createInvestmentRepository} from '../server/linked-investments/repository.mjs';
import {sourceContext} from '../server/linked-investments/evidence.mjs';
import {memoryFirestore} from './helpers/memory-firestore.mjs';
const item={id:'a',question:'📺 영상파월 기자회견 톤 변화',state:'open',revision:3,expectation:'조건부 예상',sourceIds:['r'],sourceSnapshots:[{id:'r',title:'원문'}],links:[{url:'https://example.com/source',title:'원래 근거',extra:'keep'}],assets:[{url:'https://example.com/image'}],legacy:{untouched:true}};
const plan={schemaVersion:1,claim:'원문에서 확인한 주장',targetPeriod:'대상 회의 / 직전 회의',findWhat:'정책 조건',whereToLook:'해당 기자회견',compareWith:'직전 발언',criteria:'같음·다름·유보',patternKey:'FOMC · 정책 발언'};
const patch={state:'done',result:'확인한 사실',basisDate:'2026-09-28',comparison:'partial',judgment:'change',observedChange:'관찰 전',lesson:'다음 확인 기준',changeReason:'원문 차이',verificationPlan:plan};
test('topic prompts specify documents and comparisons without inventing dates or source claims',()=>{
 const g=verificationGuide(item);assert.equal(g.claim,'');assert.equal(g.targetPeriod,'');assert.match(g.whereToLook,/Statement/);assert.match(g.compareWith,/직전/);assert.match(g.criteria,/단어 하나/);
 assert.match(verificationGuide({question:'PPI 발표'}).patternKey,/PPI/);
 assert.match(verificationGuide({question:'CPI 발표'}).findWhat,/계절조정/);
 assert.match(verificationGuide({question:'EPS 리비전'}).criteria,/각각 구분/);
 assert.match(verificationGuide({question:'미국채 잔액'}).criteria,/순매도/);
 assert.equal(verificationGuide({question:'무슨 변화일까',expectation:'파월 CPI'}).patternKey,'');
 assert.equal(planFor({...item,verificationPlan:{...plan,findWhat:'직접 수정'}}).findWhat,'직접 수정');
});
test('structured results preserve source fields and append a full history snapshot; retries do not mutate',()=>{
 const change=followupChange(item,patch,3,'op',1234);
 assert.deepEqual(change.item.assets,item.assets);assert.deepEqual(change.item.legacy,item.legacy);assert.deepEqual(change.item.links,item.links);
 assert.deepEqual(change.review.verificationPlan,plan);assert.equal(change.review.lesson,patch.lesson);assert.equal(change.item.revision,4);
 const retry=followupChange(change.item,{verificationPlan:{claim:'must not change'}},3,'op',4567);
 assert.equal(retry.repeated,true);assert.equal(retry.item.verificationPlan.claim,plan.claim);assert.equal(retry.review,undefined);
 const editedInSource=saveTransition(change.item,{result:'원본 앱에서 수정'},{expected:4,operationId:'source-op',id:'a'});
 assert.deepEqual(editedInSource.item.verificationPlan,plan);assert.deepEqual(editedInSource.review.verificationPlan,plan);
 assert.equal(mapFollowup(change.item).integration.observedChange,patch.observedChange);
 assert.throws(()=>followupChange(change.item,patch,3,'another'),e=>e.status===409);
});
test('invalid evidence is rejected before writes; absent new fields preserve earlier plans',()=>{
 for(const bad of [{comparison:'win'},{judgment:'buy'},{basisDate:'2026-02-30'},{links:[{url:'javascript:alert(1)'}]},{links:[{url:'https://secret@example.com/'}]},{verificationPlan:[]},{verificationPlan:{claim:123}},{verificationPlan:{patternKey:'x'.repeat(121)}}])assert.throws(()=>followupChange(item,bad,3,'op'),e=>e.status===400);
 assert.equal(safeEvidenceURL('data:text/html,hello'),'');
 const old=followupChange({...item,verificationPlan:plan},{result:'다른 화면의 결과'},3,'op');assert.deepEqual(old.item.verificationPlan,plan);
});
test('matching cases require exact pattern and real completed results, exclude self and unrelated text',()=>{
 const rows=[{...item,state:'done',result:'self'},{...item,id:'b',state:'done',result:'확인됨',completedAt:10},{...item,id:'c',state:'done',result:''},{...item,id:'d',state:'open',result:'아직'},{...item,id:'e',question:'CPI 발표',state:'done',result:'물가 확인'},{...item,id:'f',state:'done',result:'다른 기준',verificationPlan:{patternKey:'직접 분류'}}];
 assert.deepEqual(matchingCases(item,rows).map(r=>r.id),['b']);
 assert.equal(matchingCases({question:'모호한 질문'},rows).length,0);
});
test('detail loads source, completed cases and revision history; save is atomic and original is untouched',async()=>{
 const db=memoryFirestore({'records/r':{title:'원문',body:'원문 본문',date:'2026-09-01',link:'https://example.com'},'record_followups/a':item,'record_followups/b':{...item,id:'b',state:'done',result:'지난 결과',lesson:'지난 교훈'},'record_followup_reviews/a_old':{...item,followupId:'a',revision:2,result:'과거 결과',recordedAt:100}});
 const repo=createInvestmentRepository(db),root=db.collection('dalnimSpaces').doc('family');
 const d=await repo.detail('investment-followup:a');assert.equal(d.evidence.sources[0].body,'원문 본문');assert.equal(d.evidence.cases.total,1);assert.equal(d.evidence.history.items[0].result,'과거 결과');
 const original=structuredClone(db.data.get('records/r'));
 db.beforeCommit(async()=>{});await assert.rejects(repo.save(root,'owner',{id:'investment-followup:a',patch,expectedRevision:3,operationId:'fail'}));assert.equal(db.data.get('record_followups/a').revision,3);assert.equal(db.data.has('record_followup_reviews/a_fail'),false);
 await repo.save(root,'owner',{id:'investment-followup:a',patch,expectedRevision:3,operationId:'ok'});
 const after=await repo.detail('investment-followup:a');assert.equal(after.evidence.history.total,2);assert.deepEqual(after.evidence.history.items[0].verificationPlan,plan);assert.equal(after.event.integration.result,'확인한 사실');assert.deepEqual(db.data.get('records/r'),original);
});
test('missing source and optional collection failures never masquerade as successful empty results',async()=>{
 // Async collection failures are isolated, just like network failures.
 const db2=memoryFirestore({'record_followups/a':item}),col=db2.collection;db2.collection=name=>{const c=col(name);if(name==='record_followup_reviews')c.where=()=>({limit:()=>({get:async()=>{throw Error('unavailable');}})});return c;};
 const d=await createInvestmentRepository(db2).detail('investment-followup:a');assert.equal(d.event.id,'investment-followup:a');assert.equal(d.evidence.sources[0].missing,true);assert.equal(d.evidence.history,null);assert.match(d.evidence.warnings.join(),/저장 이력/);
 assert.equal(sourceContext({id:'x',body:'<script>test</script>',link:'javascript:bad'}).url,'');
});
