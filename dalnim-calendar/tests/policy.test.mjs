import test from 'node:test';import assert from 'node:assert/strict';import {canRead,canWrite,cleanEvent,validSubscription} from '../server/policy.mjs';
const e={id:'e',title:'점검',start:'2026-10-01T09:00:00+09:00',end:'2026-10-01T10:00:00+09:00',allDay:false,category:'worklog',module:'worklog',status:'planned',repeat:'none',reminder:10,visibility:'personal',ownerId:'a',revision:3};
test('family member cannot access another member private events',()=>{assert.equal(canRead(e,'b','owner'),false);assert.equal(canWrite(e,'b','owner'),false);});
test('viewer can read shared events but cannot change them',()=>{assert.equal(canRead({...e,visibility:'family'},'b','viewer'),true);assert.equal(canWrite({...e,visibility:'family'},'b','viewer'),false);});
test('owner and revision are controlled by the server',()=>{const out=cleanEvent({...e,ownerId:'attacker',revision:500},e,'a');assert.equal(out.ownerId,'a');assert.equal(out.revision,4);});
test('push registration rejects local and arbitrary URLs',()=>{const s={keys:{auth:'a',p256dh:'b'}};assert.equal(validSubscription({...s,endpoint:'https://127.0.0.1/internal'}),false);assert.equal(validSubscription({...s,endpoint:'https://example.com/private'}),false);assert.equal(validSubscription({...s,endpoint:'https://fcm.googleapis.com/fcm/send/a'}),true);});

