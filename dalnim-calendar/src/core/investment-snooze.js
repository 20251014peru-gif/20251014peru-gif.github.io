import {validateEvent} from './model.js';

const APP='dalnim-investment-reminder';
export const isInvestmentReminder=e=>e?.source?.app===APP&&e?.details?.kind==='investment-reminder';
export const activeInvestmentReminder=e=>isInvestmentReminder(e)&&!e.deletedAt&&e.status!=='done'&&e.reminder>=0;
export const canRemindInvestment=e=>!e?.integration||['open','working','대기중'].includes(e.integration.state);
export async function investmentReminderId(itemId){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(itemId)));
 return 'investment-reminder:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
export function makeInvestmentReminder(record,when,id,previous=null,now=Date.now()){
 const at=+new Date(when);
 if(!Number.isFinite(at)||at<now+60000)throw Error('지금보다 1분 이상 뒤의 시간을 선택해 주세요.');
 if(!record?.id||record.source?.app!=='investment-archive')throw Error('다시 확인할 투자 기록을 찾지 못했습니다.');
 if(!canRemindInvestment(record))throw Error('완료·보류된 항목은 다시 열거나 대기 상태로 바꾼 후 예약해 주세요.');
 if(previous?.pendingSync)throw Error('이전 변경을 서버에 저장한 뒤 다시 시도해 주세요.');
 // Flat primitive fields survive the existing server's details allowlist. The original text is
 // stored once in notes, so long Korean notes do not double the API payload size.
 const details={kind:'investment-reminder',investmentItemId:record.id,originTitle:record.title,
  originStart:record.start,originEnd:record.end,originAllDay:!!record.allDay,
  originStatus:record.status||'planned',originKind:record.source.kind||'record',scheduledAt:now};
 if(Number.isInteger(record.source.index))details.originIndex=record.source.index;
 return validateEvent({...previous,id,title:('다시 확인 · '+record.title).slice(0,160),
  start:new Date(at).toISOString(),end:new Date(at+15*60000).toISOString(),allDay:false,
  timeZone:record.timeZone||'Asia/Seoul',category:'investment',module:'investment',status:'planned',
  repeat:'none',reminder:0,visibility:'personal',deletedAt:null,exceptions:{},readOnly:false,
  notes:record.notes||'',location:record.location||'',details,
  source:{app:APP,recordId:record.source.recordId}});
}
export function investmentReminderOrigin(event){
 if(!isInvestmentReminder(event))return null;
 const d=event.details,source={app:'investment-archive',recordId:event.source.recordId,kind:d.originKind};
 if(Number.isInteger(d.originIndex))source.index=d.originIndex;
 return {id:d.investmentItemId,title:d.originTitle,start:d.originStart,end:d.originEnd,
  allDay:d.originAllDay,timeZone:event.timeZone,status:d.originStatus,notes:event.notes,
  location:event.location,source,readOnly:true,category:'investment',module:'investment',
  repeat:'none',reminder:-1,visibility:'personal',details:{}};
}
export async function getInvestmentReminder(store,record,{fresh=false}={}){
 if(fresh&&store.isCloud)await store.reload({fresh:true});
 const id=await investmentReminderId(record.id);
 const ids=[record.id,...(record.aliases||[])];
 return (await store.list()).filter(e=>e.id===id||(isInvestmentReminder(e)&&ids.includes(e.details.investmentItemId))).sort((a,b)=>Number(activeInvestmentReminder(b))-Number(activeInvestmentReminder(a))||(b.updatedAt||0)-(a.updatedAt||0))[0]||null;
}
const save=(store,event,revision)=>store.isCloud?store.saveOnline(event,revision):store.save(event,revision);
export async function scheduleInvestmentReminder(store,record,when,now=Date.now()){
 const previous=await getInvestmentReminder(store,record,{fresh:true});
 const id=previous?.id||await investmentReminderId(record.id);
 const event=makeInvestmentReminder(record,when,id,previous,Math.max(now,Date.now()));
 return save(store,event,previous?.revision||0);
}
export async function cancelInvestmentReminder(store,record){
 const previous=await getInvestmentReminder(store,record,{fresh:true});
 if(!activeInvestmentReminder(previous))return null;
 if(previous.pendingSync)throw Error('이전 변경을 서버에 저장한 뒤 다시 시도해 주세요.');
 return save(store,{...previous,status:'done',reminder:-1},previous.revision);
}
