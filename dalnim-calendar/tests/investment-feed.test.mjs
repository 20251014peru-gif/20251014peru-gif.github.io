import test from 'node:test';import assert from 'node:assert/strict';import {mapRecordToEvent,mapCheckToEvent,mapReviewToEvent,completionMarker} from '../server/investment-feed.mjs';
test('an investment record becomes a read-only, one-day calendar event',()=>{
 const e=mapRecordToEvent({id:'r1',date:'2026-09-20',kind:'idea',title:'반도체 업황 메모',body:'재고 정상화 신호',stocks:['SK하이닉스','삼성전자']});
 assert.equal(e.id,'investment-record:r1');
 assert.equal(e.start,'2026-09-20');assert.equal(e.end,'2026-09-21');assert.equal(e.allDay,true);
 assert.equal(e.readOnly,true);assert.equal(e.category,'investment');
 assert.equal(e.location,'SK하이닉스, 삼성전자');
 assert.deepEqual(e.source,{app:'investment-archive',recordId:'r1',kind:'idea'});
});
test('a record without a title falls back to its kind label, never a blank event',()=>{
 const e=mapRecordToEvent({id:'r2',date:'2026-09-20',kind:'chart',body:'저항선 돌파'});
 assert.equal(e.title,'📁 차트 기록');
});
test('a malformed date is rejected rather than producing a broken event',()=>{
 assert.equal(mapRecordToEvent({id:'r3',date:'2026/09/20',title:'x'}),null);
 assert.equal(mapRecordToEvent({id:'r4',title:'no date'}),null);
});
test('a checks[] follow-up becomes its own event on the check date, not the record date',()=>{
 const record={id:'r5',date:'2026-08-01',title:'삼성전자'};
 const e=mapCheckToEvent(record,{id:'chk_1',date:'2026-09-25',what:'3분기 실적 발표 확인',action:'가이던스 대비 서프라이즈 체크',followUpType:'lookup'},0);
 assert.equal(e.id,'investment-check:r5:chk_1');
 assert.equal(e.start,'2026-09-25');assert.equal(e.status,'planned');
 assert.equal(e.title,'🔔 3분기 실적 발표 확인');assert.equal(e.notes,'가이던스 대비 서프라이즈 체크');
 assert.equal(e.location,'삼성전자');
 // id prefers check.id, but index is always carried separately for the records_todos dueKey.
 assert.equal(e.source.index,0);
});
test('a checks[] entry without its own what falls back to the follow-up type label, and without an id falls back to its index',()=>{
 const record={id:'r6',date:'2026-08-01',title:'현대차'};
 const e=mapCheckToEvent(record,{date:'2026-09-25',action:'',followUpType:'think'},2);
 assert.equal(e.title,'🔔 💭 더 생각하기');assert.equal(e.id,'investment-check:r6:2');
});
test('a checks[] entry with no date is dropped instead of producing a broken event',()=>{
 assert.equal(mapCheckToEvent({id:'r7'},{what:'날짜 없음'},0),null);
});
test('reviewAt only produces an event for study-kind records, never other kinds',()=>{
 const e=mapReviewToEvent({id:'r8',kind:'study',title:'듀레이션 정리',reviewAt:'2026-10-01'});
 assert.equal(e.id,'investment-review:r8');assert.equal(e.start,'2026-10-01');
 assert.equal(e.title,'🔁 재검토: 듀레이션 정리');assert.equal(e.status,'planned');
 assert.equal(mapReviewToEvent({id:'r9',kind:'idea',reviewAt:'2026-10-01'}),null);
 assert.equal(mapReviewToEvent({id:'r10',kind:'study'}),null);
});
test('completionMarker matches the exact dueKey shape the source app itself reads (recordId#index)',()=>{
 const m=completionMarker('r5',0,'3분기 실적 발표 확인','2026-09-23');
 assert.deepEqual(m,{date:'2026-09-23',done:true,text:'3분기 실적 발표 확인',dueKey:'r5#0',createdAt:m.createdAt});
 assert.ok(Number.isInteger(m.createdAt));
});
test('completionMarker trims an overlong or missing text rather than throwing',()=>{
 assert.equal(completionMarker('r6',2,'x'.repeat(300),'2026-09-23').text.length,200);
 assert.equal(completionMarker('r6',2,undefined,'2026-09-23').text,'');
});
