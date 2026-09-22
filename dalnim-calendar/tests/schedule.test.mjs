import test from 'node:test';import assert from 'node:assert/strict';import {nextReminder} from '../server/schedule.mjs';
const event={start:'2026-09-22T09:00:00+09:00',end:'2026-09-22T10:00:00+09:00',allDay:false,timeZone:'Asia/Seoul',repeat:'none',reminder:10,status:'planned'};
test('reminder uses actual instant in Korea',()=>assert.equal(nextReminder(event,Date.parse('2026-09-22T08:00:00+09:00')).dueAt,Date.parse('2026-09-22T08:50:00+09:00')));
test('all-day reminder anchors to 09:00 in event time zone',()=>assert.equal(nextReminder({...event,start:'2026-09-22',end:'2026-09-23',allDay:true},Date.parse('2026-09-21T00:00:00Z')).dueAt,Date.parse('2026-09-22T08:50:00+09:00')));
test('deletion or completion cancels future reminder',()=>{assert.equal(nextReminder({...event,deletedAt:1}),null);assert.equal(nextReminder({...event,status:'done'}),null);});
test('next weekly occurrence does not reschedule the delivered occurrence',()=>{const now=Date.parse('2026-09-22T08:50:00+09:00'),r=nextReminder({...event,repeat:'weekly'},now,Date.parse(event.start));assert.equal(r.occurrence,Date.parse('2026-09-29T09:00:00+09:00'));});
test('monthly 31st does not turn into February 28th',()=>{const r=nextReminder({...event,start:'2026-01-31T09:00:00+09:00',repeat:'monthly'},Date.parse('2026-02-01T00:00:00Z'));assert.equal(r.occurrence,Date.parse('2026-03-31T09:00:00+09:00'));});
test('daily recurrence keeps local wall time across DST',()=>{const r=nextReminder({...event,start:'2026-03-07T09:00:00-05:00',timeZone:'America/New_York',repeat:'daily'},Date.parse('2026-03-08T00:00:00Z'));assert.equal(r.occurrence,Date.parse('2026-03-08T09:00:00-04:00'));});
test('a single occurrence deleted or marked done is skipped without cancelling the series',()=>{
 const anchor=new Date('2026-09-23T09:00:00+09:00').toISOString();
 const deleted={...event,repeat:'daily',exceptions:{[anchor]:{deletedAt:1}}};
 const r=nextReminder(deleted,Date.parse('2026-09-22T08:50:00+09:00'),Date.parse(event.start));
 assert.equal(r.occurrence,Date.parse('2026-09-24T09:00:00+09:00'));
});
test('a single occurrence with its own reminder time uses that override',()=>{
 const anchor=new Date('2026-09-23T09:00:00+09:00').toISOString();
 const e={...event,repeat:'daily',exceptions:{[anchor]:{reminder:0}}};
 const r=nextReminder(e,Date.parse('2026-09-22T08:50:00+09:00'),Date.parse(event.start));
 assert.equal(r.occurrence,Date.parse('2026-09-23T09:00:00+09:00'));
 assert.equal(r.dueAt,Date.parse('2026-09-23T09:00:00+09:00'));
});

