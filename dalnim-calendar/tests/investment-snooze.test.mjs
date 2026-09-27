import test from 'node:test';
import assert from 'node:assert/strict';
import {investmentReminderId,makeInvestmentReminder,investmentReminderOrigin,scheduleInvestmentReminder,cancelInvestmentReminder} from '../src/core/investment-snooze.js';
import {cleanEvent} from '../server/policy.mjs';
import {nextReminder} from '../server/schedule.mjs';

const record={id:'investment-check:record-one:check-one',title:'검수용 확인 항목',start:'2030-10-01',end:'2030-10-02',allDay:true,timeZone:'Asia/Seoul',status:'planned',notes:'원문 보존',location:'검수용 원문',source:{app:'investment-archive',recordId:'record-one',kind:'check',index:0}};
const now=Date.parse('2030-09-27T09:00:00+09:00'),due=now+3*3600000;
function memoryCloud(){
 let rows=[];const writes=[];
 return {isCloud:true,writes,reload:async()=>{},list:async()=>structuredClone(rows),save(){throw Error('Offline queue must not be used');},
  async saveOnline(e,revision){const old=rows.find(x=>x.id===e.id);assert.equal(revision,old?.revision||0);const saved=cleanEvent(e,old,'owner');rows=[...rows.filter(x=>x.id!==e.id),saved];writes.push(saved);return saved;}};
}
test('reserving a review preserves the original and schedules the existing server worker at the chosen instant',async()=>{
 const original=structuredClone(record),id=await investmentReminderId(record.id),saved=cleanEvent(makeInvestmentReminder(record,due,id,null,now),null,'owner');
 assert.deepEqual(record,original);assert.equal(saved.visibility,'personal');assert.equal(saved.repeat,'none');assert.equal(saved.status,'planned');assert.equal(saved.reminder,0);
 assert.equal(nextReminder(saved,now).dueAt,due);assert.equal(saved.details.originIndex,0);
 const reopened=investmentReminderOrigin(saved);assert.equal(reopened.id,record.id);assert.deepEqual(reopened.source,record.source);assert.equal(reopened.notes,record.notes);assert.equal(reopened.start,record.start);
});
test('stable IDs keep different check items separate and repeated reservations update a single event',async()=>{
 assert.notEqual(await investmentReminderId(record.id),await investmentReminderId('investment-check:record-one:check-two'));
 const s=memoryCloud(),a=await scheduleInvestmentReminder(s,record,due,now),b=await scheduleInvestmentReminder(s,record,due+3600000,now);
 assert.equal(a.id,b.id);assert.equal((await s.list()).length,1);assert.equal(b.revision,2);assert.equal(nextReminder(b,now).dueAt,due+3600000);
});
test('cancel removes the future alarm and rebooking reuses the same ID and revision chain',async()=>{
 const s=memoryCloud(),first=await scheduleInvestmentReminder(s,record,due,now);const cancelled=await cancelInvestmentReminder(s,record);
 assert.equal(nextReminder(cancelled,now),null);assert.equal(cancelled.status,'done');assert.equal(await cancelInvestmentReminder(s,record),null);
 const again=await scheduleInvestmentReminder(s,record,due+7200000,now);assert.equal(again.id,first.id);assert.equal(again.revision,3);assert.equal(again.status,'planned');
});
test('past or invalid times and unsynced changes cannot become reminder reservations',async()=>{
 const id=await investmentReminderId(record.id);
 for(const value of [now-1,now+59000,'invalid'])assert.throws(()=>makeInvestmentReminder(record,value,id,null,now),/1분/);
 assert.throws(()=>makeInvestmentReminder(record,due,id,{pendingSync:true},now),/서버/);
});
test('cloud read or write failure is returned and never falls back to an offline reservation',async()=>{
 const s=memoryCloud();s.reload=async()=>{throw Error('offline');};await assert.rejects(scheduleInvestmentReminder(s,record,due,now),/offline/);assert.equal(s.writes.length,0);
 s.reload=async()=>{};s.saveOnline=async()=>{throw Object.assign(Error('conflict'),{status:409});};await assert.rejects(scheduleInvestmentReminder(s,record,due,now),e=>e.status===409);
});
