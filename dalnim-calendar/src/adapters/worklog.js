import {dayKey,atDay,shiftDay,validateEvent} from '../core/model.js';
const supported=new Set(['work','schedule','cleaning','cleaning_lead','memo','call','meeting','deliver','vacation','expense','plan']);
export function mapWorklog(records){
 const out=[];
 for(const e of records){
  if(!e || !supported.has(e.kind))continue;
  const date=e.date||e.start;if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))continue;
  // Password/credential entries must never enter a calendar export.
  if(e.secure||e.kind==='password')continue;
  const id=String(e.id||'');if(!id)continue;
  const allDay=!e.startTime||e.kind==='vacation';
  const start=allDay?date:new Date(date+'T'+e.startTime+':00').toISOString();
  const end=allDay?dayKey(shiftDay(atDay(e.kind==='vacation'&&e.end?e.end:date),1)):(e.endTime&&e.endTime>e.startTime?new Date(date+'T'+e.endTime+':00').toISOString():new Date(+new Date(start)+3600000).toISOString());
  const mapped={id:'worklog:'+encodeURIComponent(id).replace(/%/g,'_'),title:e.title||e.text||e.name||(e.kind==='cleaning'?'청소 일지':'업무 기록'),start,end,allDay,category:'worklog',module:'worklog',status:(e.sStatus||e.status)==='완료'?'done':(e.sStatus||e.status)==='진행중'?'progress':'planned',repeat:e.scheduleType==='월간반복'?'monthly':e.scheduleType==='연간반복'?'yearly':'none',reminder:Number.isInteger(Number(e.alertBefore))?Math.max(-1,Math.min(10080,Number(e.alertBefore))):-1,visibility:'personal',notes:e.detail||e.memo||e.body||e.content||'',location:e.loc||'',details:{floor:e.floor||'',field:e.field||e.kind,assignee:e.name||'',cost:e.cost||e.amount||''},source:{app:'worklog',recordId:id,kind:e.kind,importedAt:new Date().toISOString()},schemaVersion:1};
  try{out.push(validateEvent(mapped));}catch{ /* Do not invent dates for malformed source records. */ }
 }
 return out;
}
// A host application uses the same contract for future write-through support.
// Import is deliberately explicit; it never edits the original worklog.
export const adapterContract={version:1,id:'worklog',capabilities:['import'],map:mapWorklog};

