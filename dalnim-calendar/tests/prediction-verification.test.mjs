import test from 'node:test';
import assert from 'node:assert/strict';
import {mapYoutubePrediction,predictionChange} from '../server/linked-investments/items.mjs';
import {createInvestmentRepository} from '../server/linked-investments/repository.mjs';
import {verificationPanel} from '../src/components/verification-panel.js';
import {renderSourceFocus} from '../src/components/source-panel.js';
import {memoryFirestore} from './helpers/memory-firestore.mjs';
const prediction={id:'p',대상:'시험 EPS 리비전',원문:'시험 기업의 전망 상향 여부를 관찰한다.',기준선:'시험 기준',반증조건:'추정치 하향 여부',영상제목:'시험 영상',summaryId:'s',검증기한:'2026-10-01',상태:'대기중',판정근거:'',unknown:{keep:true}};
const plan={schemaVersion:1,claim:'직접 확인한 발언',targetPeriod:'같은 회계연도',findWhat:'하향 수정 건수',whereToLook:'같은 제공처',compareWith:'이전 조회일',criteria:'조건 충족 여부',patternKey:'EPS 검증 시험'};
const patch={dueAt:'2026-10-02',state:'판정불가',result:'미발표 자료로 판단 유보',verificationPlan:plan,basisDate:'2026-09-28',comparison:'unknown',judgment:'keep',observedChange:'아직 관찰 중',changeReason:'자료 부족',lesson:'기간부터 확인',nextAction:'발표 후 확인',links:[{url:'https://example.com/evidence',title:'시험 자료',extra:'preserve'}]};
function fixture(){const db=memoryFirestore({'youtube_predictions/p':prediction,'youtube_summaries/s':{url:'https://www.youtube.com/watch?v=abcdefghijk',html:'<script>never rendered</script>'}}),root=db.collection('dalnimSpaces').doc('family');return {db,root,repo:createInvestmentRepository(db)};}
test('prediction detailed review round-trips in its existing document and records full history once',async()=>{
 const {db,root,repo}=fixture(),event=mapYoutubePrediction(prediction),req={id:event.id,patch,expectedRevision:event.integration.revision,operationId:'save1'};
 const saved=await repo.save(root,'owner',req);await repo.save(root,'owner',req);
 const raw=db.data.get('youtube_predictions/p');assert.deepEqual(raw.unknown,prediction.unknown);assert.equal(raw.원문,prediction.원문);assert.equal(raw.상태,'판정불가');assert.deepEqual(raw.calendarVerification.verificationPlan,plan);
 assert.equal(saved.event.integration.lesson,patch.lesson);assert.deepEqual(saved.event.integration.links,patch.links);
 const detail=await repo.detail(event.id,root);assert.equal(detail.evidence.history.total,1);assert.equal(detail.evidence.history.items[0].predictionVerdict,'판정불가');assert.equal(detail.evidence.history.items[0].originalClaim,prediction.원문);assert.deepEqual(detail.evidence.history.items[0].verificationPlan,plan);
 assert.equal(detail.evidence.sources[0].body,prediction.원문);assert.match(detail.evidence.sources[0].url,/abcdefghijk/);assert.equal(detail.event.integration.verificationEditable,true);
});
test('old client and source-app edits preserve rich review while refreshing shared verdict and evidence',async()=>{
 const {db,root,repo}=fixture();let e=await repo.resolve('youtube-prediction:p');await repo.save(root,'owner',{id:e.id,patch,expectedRevision:e.integration.revision,operationId:'rich'});
 e=await repo.resolve(e.id);await repo.save(root,'owner',{id:e.id,patch:{dueAt:patch.dueAt,state:'대기중',result:'다음 자료 대기'},expectedRevision:e.integration.revision,operationId:'old-client'});
 let raw=db.data.get('youtube_predictions/p');assert.deepEqual(raw.calendarVerification.verificationPlan,plan);
 db.data.set('youtube_predictions/p',{...raw,상태:'적중',판정근거:'원본 화면 수정'});
 const detail=await repo.detail(e.id,root);assert.equal(detail.event.integration.state,'적중');assert.equal(detail.event.integration.result,'원본 화면 수정');assert.equal(detail.event.integration.lesson,patch.lesson);
 await assert.rejects(repo.save(root,'owner',{id:e.id,patch,expectedRevision:e.integration.revision,operationId:'stale'}),e=>e.status===409);
});
test('failed transaction does not partially save review or history',async()=>{
 const {db,root,repo}=fixture(),e=await repo.resolve('youtube-prediction:p');db.beforeCommit(()=>{});
 await assert.rejects(repo.save(root,'owner',{id:e.id,patch,expectedRevision:e.integration.revision,operationId:'fail'}));
 assert.deepEqual(db.data.get('youtube_predictions/p'),prediction);assert.equal([...db.data.keys()].some(x=>x.includes('integrationHistory')),false);
});
test('invalid rich prediction fields, malformed dates and unsafe URLs reject before writing',()=>{
 const revision=mapYoutubePrediction(prediction).integration.revision;
 for(const bad of [{comparison:'win'},{judgment:'buy'},{basisDate:'2026-02-30'},{links:[{url:'javascript:alert(1)'}]},{verificationPlan:[]},{verificationPlan:{claim:123}},{lesson:'x'.repeat(20001)},{verificationPlan:{patternKey:'x'.repeat(121)}}])assert.throws(()=>predictionChange(prediction,{...patch,...bad},revision),e=>e.status===400);
});
test('prediction cases require a verdict and evidence and use exact saved pattern',async()=>{
 const {db,root,repo}=fixture();db.data.set('youtube_predictions/p',{...prediction,calendarVerification:{verificationPlan:plan}});
 for(const [id,state,result,key] of [['match','적중','자료 확인',plan.patternKey],['pending','대기중','관찰 중',plan.patternKey],['empty','적중','',plan.patternKey],['other','적중','확인','다른 패턴']])db.data.set('youtube_predictions/'+id,{...prediction,id,상태:state,판정근거:result,calendarVerification:{verificationPlan:{...plan,patternKey:key}}});
 const d=await repo.detail('youtube-prediction:p',root);assert.equal(d.evidence.cases.total,1);assert.equal(d.evidence.cases.items[0].id,'match');assert.equal(d.evidence.cases.items[0].predictionVerdict,'적중');
});
test('optional history failure is explicit and original prediction statement remains available',async()=>{
 const {repo}=fixture();const d=await repo.detail('youtube-prediction:p');assert.equal(d.evidence.history,null);assert.match(d.evidence.warnings.join(),/저장 이력/);assert.equal(d.evidence.sources[0].body,prediction.원문);
});
test('rich prediction UI keeps verdict semantics and exposes all review controls',()=>{
 const e=mapYoutubePrediction(prediction),html=verificationPanel(e,{sources:[{kind:'prediction',body:prediction.원문}],history:{items:[],total:0},cases:{items:[],total:0}},true);
 assert.match(html,/verification-workspace/);assert.match(html,/예측 판정/);assert.match(html,/value="적중"/);assert.doesNotMatch(html,/value="done"/);
 for(const name of ['result','evidenceLinks','comparison','judgment','lesson','changeReason','nextAction','observedChange','plan.claim','plan.patternKey'])assert.ok(html.includes('name="'+name+'"'),name);
 assert.match(html,/evidence-learning" open/);assert.match(html,/evidence-edit" open/);
 const source=renderSourceFocus(e,{sources:[{kind:'prediction',body:'짧은 저장 발언 <script>x</script>',url:'javascript:bad'}]},true);
 assert.match(source,/짧은 저장 발언 &lt;script&gt;/);assert.doesNotMatch(source,/<script>/);assert.doesNotMatch(source,/href="javascript/);
});
