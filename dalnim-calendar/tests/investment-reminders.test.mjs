import test from 'node:test';import assert from 'node:assert/strict';
import {dueInvestmentItems} from '../server/investment-reminders.mjs';
test('only checks[]/reviewAt items due exactly today are returned',()=>{
 const records=[
  {id:'r1',title:'삼성전자',checks:[{date:'2026-09-23',what:'실적 확인'},{date:'2026-09-24',what:'다음날 — 오늘 아님'}]},
  {id:'r2',kind:'study',title:'듀레이션 정리',reviewAt:'2026-09-23'},
  {id:'r3',kind:'idea',title:'무관한 재검토',reviewAt:'2026-09-23'},
 ];
 const due=dueInvestmentItems(records,'2026-09-23');
 assert.equal(due.length,2);
 assert.ok(due.some(e=>e.source.kind==='check'&&e.id==='investment-check:r1:0'));
 assert.ok(due.some(e=>e.source.kind==='review'&&e.id==='investment-review:r2'));
});
test('a day with nothing due returns an empty array, never throws',()=>{
 assert.deepEqual(dueInvestmentItems([{id:'r1',checks:[{date:'2026-09-25',what:'x'}]}],'2026-09-23'),[]);
 assert.deepEqual(dueInvestmentItems([],'2026-09-23'),[]);
 assert.deepEqual(dueInvestmentItems(undefined,'2026-09-23'),[]);
});
