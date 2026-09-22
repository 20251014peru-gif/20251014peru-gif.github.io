import {validateEvent} from './model.js';
const KST='Asia/Seoul';
const kinds=new Set(['work','schedule']);
const DAY=86400000;
const shift=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
const parts=iso=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:KST,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
function local(iso){const p=parts(iso);return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||'')||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error('워크로그 날짜가 올바르지 않습니다.');return s;}
function time(s){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s||''))throw Error('워크로그 시간이 올바르지 않습니다.');return s;}
export function worklogEventId(id){if(typeof id!=='string'||!id)throw Error('원본 ID가 필요합니다.');const key='worklog:'+encodeURIComponent(id).replace(/_/g,'_5F').replace(/%/g,'_');if(key.length>160)throw Error('원본 ID가 너무 깁니다.');return key;}
export function checkWorklog(record){
 if(!record||!kinds.has(record.kind))throw Error('양방향 연결은 업무와 업무예정 기록부터 지원합니다.');
 if(record.secure)throw Error('잠금 기록은 캘린더에 연결할 수 없습니다.');
 worklogEventId(record.id);
 if(new TextEncoder().encode(JSON.stringify(record)).length>80000)throw Error('연결할 기록이 너무 큽니다. 첨부 파일은 주소로 연결해 주세요.');
 return structuredClone(record);
}
export function eventFromWorklog(raw,old){
 const r=checkWorklog(raw),d=date(r.date),allDay=r.allDay===true||!r.startTime;
 const start=allDay?d:new Date(d+'T'+time(r.startTime)+':00+09:00').toISOString();
 let end;
 if(allDay)end=shift(date(r.endDate||d),1);
 else if(r.endTime)end=new Date(date(r.endDate||d)+'T'+time(r.endTime)+':00+09:00').toISOString();
 else end=new Date(+new Date(start)+3600000).toISOString();
 const repeat=r.calendarRepeat||({일회성:'none',매일반복:'daily',주간반복:'weekly',월간반복:'monthly',연간반복:'yearly'}[r.scheduleType]||'none');
 const status=r.kind==='schedule'?r.sStatus:r.status;
 const e={...old,id:worklogEventId(r.id),title:r.title||'',start,end,allDay,timeZone:KST,category:'worklog',module:'worklog',status:status==='완료'?'done':status==='진행중'?'progress':'planned',repeat,reminder:r.alertBefore==null?-1:Number(r.alertBefore),visibility:old?.visibility||'personal',notes:r.kind==='work'?(r.detail||''):(r.memo||''),location:r.loc||'',details:{...old?.details,floor:r.floor||'',field:r.field||'',assignee:r.assignee||r.name||'',cost:r.cost??''},deletedAt:r.deletedAt||null,source:{app:'worklog',recordId:r.id,kind:r.kind},worklogRecord:r};
 return validateEvent(e);
}
// Project only fields the calendar owns. Attachments, billing, custom fields and IDs survive.
export function worklogFromEvent(event,source){
 const e=validateEvent(event),r=checkWorklog(source);
 if(e.id!==worklogEventId(r.id)||e.source?.recordId!==r.id)throw Error('연결 원본 ID는 변경할 수 없습니다.');
 const previous=eventFromWorklog(r);
 r.title=e.title;
 if(e.start!==previous.start||e.end!==previous.end||e.allDay!==previous.allDay){
  if(e.allDay){r.date=e.start;r.endDate=shift(e.end,-1);r.startTime='';r.endTime='';}
  else {const s=local(e.start),t=local(e.end);r.date=s.date;r.startTime=s.time;r.endDate=t.date;r.endTime=t.time;}
  r.allDay=e.allDay;
 }
 const statusField=r.kind==='schedule'?'sStatus':'status';
 if(e.status!==previous.status)r[statusField]=({done:'완료',progress:'진행중',planned:r.kind==='schedule'?'예정':'미완료'})[e.status];
 r[r.kind==='work'?'detail':'memo']=e.notes;r.loc=e.location;
 for(const key of ['floor','field','cost'])if(e.details?.[key]!==previous.details?.[key])r[key]=e.details?.[key]??'';
 if(e.details?.assignee!==previous.details?.assignee)r[r.assignee!==undefined?'assignee':'name']=e.details?.assignee||'';
 if(e.repeat!==previous.repeat){r.calendarRepeat=e.repeat;r.scheduleType=({none:'일회성',daily:'매일반복',weekly:'주간반복',monthly:'월간반복',yearly:'연간반복'})[e.repeat];}
 if(e.reminder!==previous.reminder)r.alertBefore=e.reminder;
 r.deletedAt=e.deletedAt||null;
 return r;
}
export function attachWorklog(event,old,record){
 const source=record||old?.worklogRecord;
 if(!source)return event;
 const r=checkWorklog(source);
 if(old?.worklogRecord&&(r.id!==old.worklogRecord.id||r.kind!==old.worklogRecord.kind))throw Error('연결된 기록의 ID와 종류는 변경할 수 없습니다.');
 if(event.category!=='worklog'||event.module!=='worklog')throw Error('워크로그 연결 일정의 분류는 워크로그로 유지해 주세요.');
 return {...event,source:{app:'worklog',recordId:r.id,kind:r.kind},worklogRecord:worklogFromEvent({...event,source:{app:'worklog',recordId:r.id}},r)};
}
