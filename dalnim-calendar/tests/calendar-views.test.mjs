import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarId,displayCalendars,matchesCalendar,readViewPreferences} from '../src/core/calendar-views.js';
const followup=title=>({id:'investment-followup:f',title,category:'investment',source:{app:'investment-archive',kind:'followup'},integration:{type:'followup'}});
test('explicit video labels split followups; topic words and original video records do not',()=>{
 for(const title of ['🔔 📺 영상미국 CPI 발표','🔔 🔄 직전오른 종목 비교','🔔 🔁 직전 영상 입장 변화'])assert.equal(calendarId(followup(title)),'linked:youtube');
 for(const title of ['🔔 📊 직접미국 CPI 확인','🔔 🤖 AI일본 미국채 확인','🔔 유튜브에서 언급한 CPI를 공식 자료로 확인'])assert.equal(calendarId(followup(title)),'linked:research');
 assert.equal(calendarId({id:'investment-record:r',title:'📺 영상 제목',source:{app:'investment-archive',kind:'youtube'}}),'investment');
});
test('prediction deadlines are distinct from video followups; authored categories stay intact',()=>{
 assert.equal(calendarId({id:'youtube-prediction:p',source:{app:'investment-archive',kind:'youtube-prediction'}}),'linked:predictions');
 assert.equal(calendarId({id:'investment-prediction:p',source:{app:'investment-archive',kind:'prediction'}}),'linked:predictions');
 assert.equal(calendarId({category:'personal',title:'📺 영상 계획'}),'personal');
});
test('snoozes follow the latest source calendar including aliases, with safe offline fallback',()=>{
 const original={...followup('🔔 📺 영상CPI 발표'),aliases:['investment-check:r:0']};
 const reminder={category:'investment',source:{app:'dalnim-investment-reminder'},details:{kind:'investment-reminder',investmentItemId:'investment-check:r:0',originKind:'check',originTitle:'🔔 🤖 AI기존 제목'}};
 assert.equal(calendarId(reminder,[original]),'linked:youtube');
 assert.equal(calendarId(reminder,[]),'linked:research');
 assert.equal(matchesCalendar(reminder,{hidden:new Set(['linked:youtube']),sources:[original]}),false);
 assert.equal(reminder.category,'investment');
});
test('display categories preserve customization and never change source category metadata',()=>{
 const cats=[{id:'investment',label:'투자 노트',color:'#123456'},{id:'custom',label:'내 분류',color:'#abcdef'}];
 const rows=displayCalendars(cats);assert.equal(rows.find(c=>c.id==='investment').label,'투자 기록');assert.equal(cats[0].label,'투자 노트');
 assert.equal(displayCalendars([{id:'investment',label:'나의 투자'}]).at(-1).label,'나의 투자');assert.deepEqual(rows.at(-1),cats[1]);
});
test('combined selection and completed filter compose without modifying events',()=>{
 const e={...followup('🔔 📺 영상후속 확인'),status:'done'};
 assert.equal(matchesCalendar(e),true);assert.equal(matchesCalendar(e,{hideDone:true}),false);
 assert.equal(matchesCalendar(e,{hidden:new Set(['linked:research'])}),true);assert.equal(e.status,'done');
});
test('device view preference recovery tolerates invalid JSON and validates only display fields',()=>{
 assert.deepEqual([...readViewPreferences({getItem:()=>'{broken'},'k').hidden],[]);
 const p=readViewPreferences({getItem:()=>JSON.stringify({hidden:['linked:youtube',null,42],hideDone:true})},'k');
 assert.deepEqual([...p.hidden],['linked:youtube']);assert.equal(p.hideDone,true);
});
