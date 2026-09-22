import {LocalStore} from '../src/core/store.js';
import {WorklogClient} from '../sdk/worklog-client.js';
import {dayKey,newId} from '../src/core/model.js';
import {esc,toast,ask} from '../src/ui.js';
const store=await new LocalStore().init(),client=new WorklogClient(store),form=document.querySelector('#record-form');
let rows=[],selected=null,dirty=false,saving=false;
const $=s=>document.querySelector(s),el=name=>form.elements.namedItem(name);
function open(record){
 selected=record?structuredClone(record):null;dirty=false;$('#record-error').textContent='';$('#remote-notice').hidden=true;
 $('#form-title').textContent=record?(record.deletedAt?'삭제한 기록':'업무 기록 편집'):'새 업무 기록';$('#revision').textContent=record?'버전 '+record.calendarRevision:'새 기록';
 form.reset();const r=record||{date:dayKey(),endDate:dayKey(),kind:'work',startTime:'09:00',endTime:'10:00'};
 for(const name of ['title','kind','date','startTime','endTime','floor','field','cost'])el(name).value=r[name]??'';
 el('endDate').value=r.endDate||r.date;el('assignee').value=r.assignee||r.name||'';el('notes').value=r.kind==='work'?r.detail||'':r.memo||'';
 const st=r.kind==='schedule'?r.sStatus:r.status;el('status').value=st==='완료'?'done':st==='진행중'?'progress':'planned';el('kind').disabled=!!record;
 $('#delete-record').hidden=!record||!!record.deletedAt;$('#restore-record').hidden=!record?.deletedAt;form.querySelector('[type=submit]').disabled=!!record?.deletedAt;paintList();
}
function paintList(){const filtered=rows.filter(r=>$('#show-deleted').checked||!r.deletedAt);$('#record-list').innerHTML=filtered.map(r=>'<button class="record-item '+(r.id===selected?.id?'active ':'')+(r.deletedAt?'deleted':'')+'" data-id="'+esc(r.id)+'"><strong>'+esc(r.title)+'</strong><small>'+esc(r.date)+' · '+esc(r.startTime||'종일')+' · 버전 '+r.calendarRevision+'</small></button>').join('')||'<div class="empty">아직 연결된 기록이 없어요.<br>첫 업무를 추가해 보세요.</div>';$('#record-list').querySelectorAll('[data-id]').forEach(b=>b.onclick=async()=>{if(dirty&&!await ask('작성 중인 내용을 닫을까요?','저장하지 않은 입력 내용이 있습니다.','다른 기록 열기'))return;open(rows.find(r=>r.id===b.dataset.id));});}
async function refresh(){rows=await client.list({includeDeleted:true});rows.sort((a,b)=>b.date.localeCompare(a.date));if(selected&&!saving){const latest=rows.find(r=>r.id===selected.id);if(latest?.calendarRevision!==selected.calendarRevision){if(dirty)$('#remote-notice').hidden=false;else open(latest);}}paintList();}
form.addEventListener('input',()=>dirty=true);
$('#new-record').onclick=async()=>{if(dirty&&!await ask('새 기록을 열까요?','저장하지 않은 입력 내용이 있습니다.','새 기록'))return;open(null);};
$('#show-deleted').onchange=paintList;
$('#reload-record').onclick=async()=>{if(dirty&&!await ask('최신 기록으로 바꿀까요?','현재 입력을 닫고 다른 화면에서 저장한 내용을 엽니다.','최신 기록 열기'))return;await refresh();open(rows.find(r=>r.id===selected?.id));};
form.onsubmit=async e=>{e.preventDefault();saving=true;const button=form.querySelector('[type=submit]');button.disabled=true;try{
 const kind=selected?.kind||el('kind').value,r={...selected,id:selected?.id||newId(),kind,title:el('title').value,date:el('date').value,endDate:el('endDate').value,startTime:el('startTime').value,endTime:el('endTime').value,allDay:!el('startTime').value,floor:el('floor').value,field:el('field').value,assignee:el('assignee').value,cost:el('cost').value===''?'':Number(el('cost').value),deletedAt:null};
 r[kind==='work'?'detail':'memo']=el('notes').value;r[kind==='work'?'status':'sStatus']=({done:'완료',progress:'진행중',planned:kind==='work'?'미완료':'예정'})[el('status').value];
 const saved=await client.save(r,selected?.calendarRevision||0);dirty=false;await refresh();open(saved);toast('워크로그와 캘린더에 함께 저장했어요.');
 }catch(err){$('#record-error').textContent=err.message;}finally{saving=false;button.disabled=false;}};
$('#delete-record').onclick=async()=>{if(!await ask('기록을 휴지통으로 옮길까요?','이 연동 체험의 캘린더에서도 함께 삭제됩니다. 복원할 수 있습니다.','휴지통으로'))return;try{const r=await client.remove(selected);dirty=false;await refresh();open(r);toast('두 화면에서 함께 삭제했어요.');}catch(e){$('#record-error').textContent=e.message;}};
$('#restore-record').onclick=async()=>{try{const r=await client.restore(selected);await refresh();open(r);toast('기록과 일정을 복원했어요.');}catch(e){$('#record-error').textContent=e.message;}};
client.subscribe(()=>refresh().catch(e=>$('#connection-state').textContent=e.message));await refresh();open(null);$('#connection-state').textContent='같은 브라우저의 달님 캘린더와 연결됨';
