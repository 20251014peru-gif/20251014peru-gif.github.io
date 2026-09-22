import test from 'node:test';import assert from 'node:assert/strict';import {mapRecordToEvent,mapTodoToEvent} from '../server/investment-feed.mjs';
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
 assert.equal(e.title,'차트 기록');
});
test('a malformed date is rejected rather than producing a broken event',()=>{
 assert.equal(mapRecordToEvent({id:'r3',date:'2026/09/20',title:'x'}),null);
 assert.equal(mapRecordToEvent({id:'r4',title:'no date'}),null);
});
test('a todo becomes an event whose status reflects done, and reminders stay off',()=>{
 const open=mapTodoToEvent({id:'t1',date:'2026-09-22',text:'분기 실적 확인',done:false});
 const done=mapTodoToEvent({id:'t2',date:'2026-09-21',text:'배당락 체크',done:true});
 assert.equal(open.status,'planned');assert.equal(open.reminder,-1);
 assert.equal(done.status,'done');
});
test('an empty or whitespace-only todo is dropped instead of showing a blank title',()=>{
 assert.equal(mapTodoToEvent({id:'t3',date:'2026-09-22',text:'   '}),null);
 assert.equal(mapTodoToEvent({id:'t4',date:'2026-09-22'}),null);
});
