import test from 'node:test';import assert from 'node:assert/strict';import {expandEvents,validateEvent,occurrenceAt,sanitizeExceptions,sanitizeChecklist,sanitizePhotos,MAX_PHOTOS} from '../src/core/model.js';import {mapWorklog} from '../src/adapters/worklog.js';import {ModuleRegistry} from '../src/core/registry.js';
const event={id:'one',title:'점검',start:'2026-01-31',end:'2026-02-01',allDay:true,status:'planned',repeat:'monthly',reminder:10,visibility:'personal'};
test('monthly recurrence skips missing days without drifting',()=>{assert.equal(occurrenceAt(event,1),null);assert.equal(occurrenceAt(event,2).start,'2026-03-31');});
test('repeat generation works for old anchors without walking every day',()=>{const e={...event,repeat:'daily',start:'1990-01-01',end:'1990-01-02'};assert.equal(expandEvents([e],'2026-09-21','2026-09-28').length,7);});
test('all-day end is exclusive and tombstones are hidden',()=>{assert.equal(expandEvents([{...event,repeat:'none'}],'2026-02-01','2026-02-02').length,0);assert.equal(expandEvents([{...event,deletedAt:1}],'2026-01-01','2027-01-01').length,0);});
test('invalid time range is rejected',()=>assert.throws(()=>validateEvent({...event,end:'2026-01-30'})));
test('worklog adapter retains source identity and detail, ignores secure records',()=>{const a=mapWorklog([{id:'abc',kind:'work',date:'2026-09-22',title:'시설 점검',floor:'3층',cost:20000},{id:'secret',kind:'work',date:'2026-09-22',secure:true}]);assert.equal(a.length,1);assert.equal(a[0].source.recordId,'abc');assert.equal(a[0].details.floor,'3층');assert.equal(a[0].end,'2026-09-23');});
test('missing module does not prevent other modules from loading',async()=>{const r=new ModuleRegistry();await r.load(['./modules/missing.js','./modules/worklog.js','./modules/family.js']);assert.equal(r.errors.length,1);assert.equal(r.list().length,2);});
test('sanitizeExceptions keeps only valid keys and whitelisted fields',()=>{
 const out=sanitizeExceptions({'2026-09-22':{title:'변경',bogus:'x'},'not-a-date':{title:'무시됨'}},true);
 assert.deepEqual(Object.keys(out),['2026-09-22']);
 assert.deepEqual(out['2026-09-22'],{title:'변경'});
});
test('deleting one occurrence hides only that date, the series continues',()=>{
 const e={id:'daily',title:'운동',start:'2026-09-01',end:'2026-09-02',allDay:true,status:'planned',repeat:'daily',reminder:10,visibility:'personal',exceptions:{'2026-09-03':{deletedAt:1}}};
 const days=expandEvents([e],'2026-09-01','2026-09-06').map(o=>o.start);
 assert.deepEqual(days,['2026-09-01','2026-09-02','2026-09-04','2026-09-05']);
});
test('sanitizeChecklist keeps real checkboxes only — trims blanks, caps length and count',()=>{
 const out=sanitizeChecklist([{text:'  우유 사기 ',done:false},{text:'',done:true},{text:'x'.repeat(300),done:'yes'},...Array.from({length:60},()=>({text:'항목',done:false}))]);
 assert.equal(out[0].text,'우유 사기');assert.equal(out[0].done,false);assert.equal(out[0].kind,'check');
 assert.equal(out[1].text.length,200);assert.equal(out[1].done,true);
 assert.ok(out.length<=50);
});
test('a bullet row keeps its kind but a stray value never becomes anything but check/bullet',()=>{
 const out=sanitizeChecklist([{text:'참고 사항',kind:'bullet'},{text:'다른 항목',kind:'numbered'}]);
 assert.equal(out[0].kind,'bullet');assert.equal(out[1].kind,'check');
});
test('sanitizeChecklist drops non-array input instead of throwing',()=>{
 assert.deepEqual(sanitizeChecklist(undefined),[]);assert.deepEqual(sanitizeChecklist('- [ ] x'),[]);
});
test('sanitizePhotos keeps only real Storage or local data URLs, caps count',()=>{
 const many=Array.from({length:MAX_PHOTOS+5},(_,i)=>({id:'p'+i,url:'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&token=t'+i}));
 const out=sanitizePhotos(many);
 assert.equal(out.length,MAX_PHOTOS);assert.equal(out[0].id,'p0');assert.ok(out[0].createdAt>0);
});
test('sanitizePhotos rejects URLs outside Storage/data-URL and drops oversized entries',()=>{
 const out=sanitizePhotos([
  {id:'a',url:'https://evil.example.com/x.jpg'},
  {id:'b',url:'javascript:alert(1)'},
  {id:'c',url:'data:image/png;base64,abc'},
  {id:'d',url:'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media'},
  {id:'e',url:'https://firebasestorage.googleapis.com/v0/b/x/o/'+'y'.repeat(2000001)},
 ]);
 assert.deepEqual(out.map(p=>p.id),['c','d']);
});
test('sanitizePhotos drops non-array input instead of throwing',()=>{
 assert.deepEqual(sanitizePhotos(undefined),[]);assert.deepEqual(sanitizePhotos('x'),[]);
});
test('editing one occurrence only changes that date, others keep the series value',()=>{
 const e={id:'daily',title:'운동',start:'2026-09-01',end:'2026-09-02',allDay:true,status:'planned',repeat:'daily',reminder:10,visibility:'personal',exceptions:{'2026-09-03':{title:'병원',status:'done'}}};
 const occ=expandEvents([e],'2026-09-01','2026-09-05');
 const changed=occ.find(o=>o.start==='2026-09-03'),other=occ.find(o=>o.start==='2026-09-01');
 assert.equal(changed.title,'병원');assert.equal(changed.status,'done');assert.equal(changed.isException,true);
 assert.equal(other.title,'운동');assert.equal(other.isException,false);
});

