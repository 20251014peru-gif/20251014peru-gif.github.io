import test from 'node:test';import assert from 'node:assert/strict';
import {scopeCategories,mergeCategories,isArchivedEvent,calendarBackupRecords} from '../src/core/calendar-scope.js';
import {FeedConnection} from '../src/core/feed-connection.js';
test('retired categories are hidden but metadata and custom names survive saving',()=>{
 const saved=[{id:'personal',label:'나의 일정',color:'#112233'},{id:'worklog',label:'시설 관리',color:'#445566'},{id:'family',label:'가족',color:'#778899'},{id:'custom',label:'내 분류',color:'#001122'}];
 const active=scopeCategories(saved);assert.deepEqual(active.map(c=>c.id),['personal','custom','investment']);assert.equal(active[0].label,'나의 기록');assert.equal(active[0].color,'#112233');
 const combined=mergeCategories(saved,active);assert.deepEqual(combined.find(c=>c.id==='worklog'),saved[1]);assert.deepEqual(combined.find(c=>c.id==='family'),saved[2]);assert.equal(saved[0].label,'나의 일정');
});
test('retired source records stay archived after being assigned a custom category',()=>{
 assert.ok(isArchivedEvent({category:'custom',module:'worklog'}));assert.ok(isArchivedEvent({category:'personal',source:{app:'worklog'}}));assert.ok(isArchivedEvent({category:'custom',worklogRecord:{id:'original'}}));assert.ok(isArchivedEvent({category:'family'}));assert.equal(isArchivedEvent({category:'investment'}),false);
});
test('calendar backups retain retired records; raw worklog imports are no longer accepted',()=>{
 const rows=[{schemaVersion:1,id:'a',category:'worklog'},{schemaVersion:1,id:'b',category:'personal'}];assert.equal(calendarBackupRecords({events:rows}),rows);assert.throws(()=>calendarBackupRecords({entries:[{kind:'work'}]}));
});
test('a failed optional feed keeps its previous data and surfaces an error',async()=>{
 const f=new FeedConnection(),store={isCloud:true};await f.reload(store,async()=>({events:[{id:'external'}]}));const updated=f.state.updatedAt;await f.reload(store,async()=>{throw Error('network');});assert.equal(f.state.status,'error');assert.equal(f.state.error,'network');assert.equal(f.events[0].id,'external');assert.equal(f.state.updatedAt,updated);
});
test('switching a connection off discards an in-flight response without re-enabling it',async()=>{
 let resolve;const promise=new Promise(r=>resolve=r),f=new FeedConnection(),store={isCloud:true};const pending=f.reload(store,()=>promise);await f.reload(store,()=>promise,{enabled:false});resolve({events:[{id:'late'}]});await pending;assert.equal(f.state.status,'disabled');assert.deepEqual(f.events,[]);
});
test('empty, unavailable, and failed sources are different states and changing accounts clears data',async()=>{
 const f=new FeedConnection(),store={isCloud:true};await f.reload(store,async()=>({events:[]}));assert.equal(f.state.status,'ready');await f.reload(store,null);assert.equal(f.state.status,'unavailable');await f.reload(store,async()=>({events:[{id:'old'}]}));await f.reload({isCloud:true},async()=>{throw Error('denied');});assert.deepEqual(f.events,[]);assert.equal(f.state.updatedAt,null);assert.equal(f.state.status,'error');
});
