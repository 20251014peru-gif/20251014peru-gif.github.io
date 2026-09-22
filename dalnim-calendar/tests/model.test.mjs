import test from 'node:test';import assert from 'node:assert/strict';import {expandEvents,validateEvent,occurrenceAt} from '../src/core/model.js';import {mapWorklog} from '../src/adapters/worklog.js';import {ModuleRegistry} from '../src/core/registry.js';
const event={id:'one',title:'점검',start:'2026-01-31',end:'2026-02-01',allDay:true,status:'planned',repeat:'monthly',reminder:10,visibility:'personal'};
test('monthly recurrence skips missing days without drifting',()=>{assert.equal(occurrenceAt(event,1),null);assert.equal(occurrenceAt(event,2).start,'2026-03-31');});
test('repeat generation works for old anchors without walking every day',()=>{const e={...event,repeat:'daily',start:'1990-01-01',end:'1990-01-02'};assert.equal(expandEvents([e],'2026-09-21','2026-09-28').length,7);});
test('all-day end is exclusive and tombstones are hidden',()=>{assert.equal(expandEvents([{...event,repeat:'none'}],'2026-02-01','2026-02-02').length,0);assert.equal(expandEvents([{...event,deletedAt:1}],'2026-01-01','2027-01-01').length,0);});
test('invalid time range is rejected',()=>assert.throws(()=>validateEvent({...event,end:'2026-01-30'})));
test('worklog adapter retains source identity and detail, ignores secure records',()=>{const a=mapWorklog([{id:'abc',kind:'work',date:'2026-09-22',title:'시설 점검',floor:'3층',cost:20000},{id:'secret',kind:'work',date:'2026-09-22',secure:true}]);assert.equal(a.length,1);assert.equal(a[0].source.recordId,'abc');assert.equal(a[0].details.floor,'3층');assert.equal(a[0].end,'2026-09-23');});
test('missing module does not prevent other modules from loading',async()=>{const r=new ModuleRegistry();await r.load(['./modules/missing.js','./modules/worklog.js','./modules/family.js']);assert.equal(r.errors.length,1);assert.equal(r.list().length,2);});

