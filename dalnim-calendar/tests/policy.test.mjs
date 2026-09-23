import test from 'node:test';import assert from 'node:assert/strict';import {canRead,canWrite,cleanEvent,validSubscription,EMAIL_RE,canInvite,emailMatches,inviteExpired} from '../server/policy.mjs';
const e={id:'e',title:'점검',start:'2026-10-01T09:00:00+09:00',end:'2026-10-01T10:00:00+09:00',allDay:false,category:'worklog',module:'worklog',status:'planned',repeat:'none',reminder:10,visibility:'personal',ownerId:'a',revision:3};
test('family member cannot access another member private events',()=>{assert.equal(canRead(e,'b','owner'),false);assert.equal(canWrite(e,'b','owner'),false);});
test('viewer can read shared events but cannot change them',()=>{assert.equal(canRead({...e,visibility:'family'},'b','viewer'),true);assert.equal(canWrite({...e,visibility:'family'},'b','viewer'),false);});
test('owner and revision are controlled by the server',()=>{const out=cleanEvent({...e,ownerId:'attacker',revision:500},e,'a');assert.equal(out.ownerId,'a');assert.equal(out.revision,4);});
test('push registration rejects local and arbitrary URLs',()=>{const s={keys:{auth:'a',p256dh:'b'}};assert.equal(validSubscription({...s,endpoint:'https://127.0.0.1/internal'}),false);assert.equal(validSubscription({...s,endpoint:'https://example.com/private'}),false);assert.equal(validSubscription({...s,endpoint:'https://fcm.googleapis.com/fcm/send/a'}),true);});
test('a single-occurrence exception on save is sanitized like every other field',()=>{
 const key=new Date('2026-10-08T09:00:00+09:00').toISOString();
 const out=cleanEvent({...e,repeat:'daily',exceptions:{[key]:{title:'변경',bogus:'x'},'not-a-date':{title:'무시'}}},e,'a');
 assert.deepEqual(Object.keys(out.exceptions),[key]);
 assert.deepEqual(out.exceptions[key],{title:'변경'});
});
test('checklist items survive a save as real structured entries, not text',()=>{
 const out=cleanEvent({...e,checklist:[{text:' 자재 확인 ',done:true},{text:'',done:false}]},e,'a');
 assert.deepEqual(out.checklist,[{text:'자재 확인',done:true}]);
});
test('only the space owner can invite, and invites need a real email and a known role',()=>{
 assert.equal(canInvite('owner'),true);assert.equal(canInvite('editor'),false);assert.equal(canInvite('viewer'),false);
 assert.equal(EMAIL_RE.test('family@example.com'),true);assert.equal(EMAIL_RE.test('not-an-email'),false);
});
test('an invite can only be accepted by the exact invited email, before it expires',()=>{
 assert.equal(emailMatches('Family@Example.com','family@example.com'),true);
 assert.equal(emailMatches('family@example.com','someone-else@example.com'),false);
 assert.equal(inviteExpired({createdAt:Date.now()}),false);
 assert.equal(inviteExpired({createdAt:Date.now()-8*24*3600000}),true);
});

