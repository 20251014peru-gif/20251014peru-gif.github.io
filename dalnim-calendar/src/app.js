import {config} from './config.js';
import {LocalStore} from './core/store.js';
import {ModuleRegistry} from './core/registry.js';
import {dayKey,atDay,shiftDay,newId,expandEvents,safeURL,ZONE} from './core/model.js';
import {demoEvents} from './demo.js';
import {esc,icon,button,toast,ask,download} from './ui.js';

const $=s=>document.querySelector(s);
const registry=new ModuleRegistry();
let store,calendar,events=[],disabled=[],hidden=new Set(),categories=[],selectedDate=new Date(),page='calendar',view=innerWidth<761?'timeGridDay':'timeGridWeek',query='',selectedId=null,installEvent;
const baseCategories=[{id:'personal',label:'나의 일정',color:'#7585b5'},{id:'worklog',label:'워크로그',color:'#3565e8'},{id:'investment',label:'투자 노트',color:'#16938a'},{id:'family',label:'가족 일정',color:'#d38b38'}];
const color=e=>categories.find(c=>c.id===e.category)?.color||'#8795ad';
const catName=e=>categories.find(c=>c.id===e.category)?.label||'보관된 일정';
const timeLabel=e=>e.allDay?'종일':new Date(e.start).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})+' – '+new Date(e.end).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
const enabled=id=>id==='personal'||!disabled.includes(id);
const visible=()=>events.filter(e=>!e.deletedAt&&!hidden.has(e.category)&&(!query||[e.title,e.notes,e.location,...Object.values(e.details||{})].join(' ').toLowerCase().includes(query.toLowerCase())));
const stateLabel=()=>store?.isCloud?(store.lastError?'연결 확인 필요':'클라우드 연결됨'):'이 기기에 저장';
function shell(){
 $('#app').innerHTML='<div class="shell"><aside class="sidebar"><div class="brand"><img src="./icon.svg" alt=""><div><strong>달님</strong><small>MY CONNECTED DAYS</small></div></div><button class="space-btn" data-action="settings"><span class="avatar">나</span><span>나의 공간</span>'+icon('chevron')+'</button><nav class="navigation">'+nav('calendar','캘린더','calendar')+nav('agenda','일정 모아보기','list')+nav('inbox','알림함','bell')+nav('blocks','연결 블록','blocks')+'</nav><div id="mini"></div><div><div class="side-heading"><span>내 캘린더</span><button data-action="categories" aria-label="캘린더 관리">'+icon('plus')+'</button></div><div id="categories"></div></div><div class="sidebar-footer">'+button('settings','설정','settings','nav')+button('export','백업 내보내기','download','nav')+'<a class="backlink" href="../index.html" id="home-link">'+icon('home')+'시스템 홈</a><span>달님 캘린더 · '+config.version+'</span></div></aside><main class="main"><header class="topbar"><button class="mobile-menu" data-action="menu" aria-label="메뉴 열기">'+icon('menu')+'</button><div class="breadcrumb">나의 공간 '+icon('chevron')+' <strong id="crumb">캘린더</strong></div><div class="top-actions"><label class="search">'+icon('search')+'<input type="search" id="search" placeholder="일정 검색" aria-label="일정 검색"><span class="kbd">/</span></label><span class="mode-badge" id="store-state">'+icon('check')+stateLabel()+'</span><button data-action="inbox" aria-label="알림함">'+icon('bell')+'</button><span class="avatar">나</span></div></header><section class="page-head"><div><div class="eyebrow" id="eyebrow">YOUR DAYS, CONNECTED</div><h1 id="page-title"></h1><p class="head-description" id="page-description"></p></div><button class="primary" data-action="add">'+icon('plus')+'<span>새 일정</span></button></section><div id="content"></div><div class="banner"><span id="banner-label">체험 공간 · 예시 데이터가 포함되어 있습니다. 실제 워크로그와 연결되지 않습니다.</span><button data-action="clear-demo">예시 지우기</button></div></main></div><nav class="mobile-bottom">'+nav('calendar','캘린더','calendar')+nav('agenda','모아보기','list')+nav('inbox','알림함','bell')+nav('blocks','블록','blocks')+'</nav><input type="file" id="import-file" accept=".json,application/json" hidden>';
 $('#search').value=query;
 $('#search').addEventListener('input',e=>{query=e.target.value;if(page==='calendar'||page==='agenda')refreshCalendar();else navigate('agenda');});
 $('#import-file').addEventListener('change',importFile);
 document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action)));
 $('#home-link').addEventListener('click',e=>{if(location.hostname==='127.0.0.1'||location.hostname==='localhost'){e.preventDefault();navigate('calendar');}});
 if(new URLSearchParams(location.search).has('embed'))document.body.classList.add('embed');
 paintCategories();paintMini();navigate(page);
}
function nav(id,label,ico){return '<button class="nav'+(page===id?' active':'')+'" data-action="'+id+'">'+icon(ico)+'<span>'+label+'</span></button>';}
function paintCategories(){
 $('#categories').innerHTML=categories.map(c=>'<label class="cat-row" style="--cat:'+c.color+'"><input type="checkbox" data-category="'+esc(c.id)+'" '+(!hidden.has(c.id)?'checked':'')+'><span>'+esc(c.label)+'</span><span class="count">'+events.filter(e=>!e.deletedAt&&e.category===c.id).length+'</span></label>').join('');
 $('#categories').querySelectorAll('input').forEach(el=>el.addEventListener('change',()=>{el.checked?hidden.delete(el.dataset.category):hidden.add(el.dataset.category);refreshCalendar();}));
}
function paintMini(){
 const d=calendar?.getDate()||selectedDate,year=d.getFullYear(),month=d.getMonth(),first=new Date(year,month,1),start=shiftDay(first,-((first.getDay()+6)%7));
 $('#mini').innerHTML='<div class="mini-head"><strong>'+year+'년 '+(month+1)+'월</strong><span><button data-mini="-1" aria-label="이전 달">'+icon('chevron','rotated')+'</button><button data-mini="1" aria-label="다음 달">'+icon('chevron')+'</button></span></div><div class="mini-grid">'+['월','화','수','목','금','토','일'].map(x=>'<span>'+x+'</span>').join('')+Array.from({length:42},(_,i)=>{const x=shiftDay(start,i);return '<button data-date="'+dayKey(x)+'" class="'+(x.getMonth()!==month?'out ':'')+(dayKey(x)===dayKey()?'today ':'')+(dayKey(x)===dayKey(selectedDate)?'selected':'')+'">'+x.getDate()+'</button>';}).join('')+'</div>';
 $('#mini').querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selectedDate=atDay(b.dataset.date);if(page!=='calendar'&&page!=='agenda')navigate('calendar');else calendar?.gotoDate(selectedDate);paintRail();});
 $('#mini').querySelectorAll('[data-mini]').forEach(b=>b.onclick=()=>{const x=new Date(year,month+Number(b.dataset.mini),1);selectedDate=x;calendar?.gotoDate(x);paintMini();});
}
function setHeading(){
 const titles={blocks:['연결되는 블록','필요한 기능을 연결하고, 나에게 맞게 조합하세요.'],inbox:['알림함','다가오는 일정과 알림 준비 상태를 확인하세요.']};
 if(titles[page]){$('#page-title').textContent=titles[page][0];$('#page-description').textContent=titles[page][1];}
 else {const d=calendar?.getDate()||selectedDate;$('#page-title').innerHTML=d.getMonth()+1+'월 <span>'+d.getFullYear()+'</span>';$('#page-description').textContent=page==='agenda'?'시간 순서대로, 놓치지 않고.':'일과 생활, 중요한 순간을 한곳에.';}
 $('#crumb').textContent=({calendar:'캘린더',agenda:'일정 모아보기',blocks:'연결 블록',inbox:'알림함'})[page];
 document.querySelectorAll('.navigation .nav,.mobile-bottom .nav').forEach(b=>b.classList.toggle('active',b.dataset.action===page));
}
function navigate(next){page=next;calendar?.destroy();calendar=null;$('.sidebar')?.classList.remove('open');setHeading();
 if(next==='calendar'||next==='agenda')renderCalendar();else if(next==='blocks')renderBlocks();else renderInbox();
}
function renderCalendar(){
 $('#content').innerHTML='<div class="workspace"><div class="calendar-wrap"><div class="toolbar"><div class="date-nav"><button class="today-btn" data-cal="today">오늘</button><button data-cal="prev" aria-label="이전 기간">'+icon('chevron','rotated')+'</button><button data-cal="next" aria-label="다음 기간">'+icon('chevron')+'</button><span id="range-label" class="quiet small"></span></div><div class="view-switch">'+[['timeGridDay','일'],['timeGridWeek','주'],['dayGridMonth','월'],['multiMonthYear','연']].map(([v,l])=>'<button data-view="'+v+'" class="'+(v===view?'active':'')+'">'+l+'</button>').join('')+'</div></div><div id="calendar"></div><div class="calendar-foot"><span>'+icon('info')+'빈 시간을 선택해 추가 · 일정을 끌어서 이동</span><span>'+esc(ZONE)+' · '+(store.isCloud?'클라우드 동기화':'내 기기 체험')+'</span></div></div><aside class="right-rail" id="rail"></aside></div>';
 if(!window.FullCalendar){$('#calendar').innerHTML='<div class="empty">캘린더 화면을 불러오지 못했습니다.<br>다른 블록과 백업 기능은 계속 사용할 수 있습니다.</div>';return;}
 calendar=new FullCalendar.Calendar($('#calendar'),{
  initialView:page==='agenda'?'listMonth':view,initialDate:selectedDate,locale:'ko',firstDay:1,headerToolbar:false,nowIndicator:true,allDayText:'종일',noEventsText:'표시할 일정이 없습니다.',buttonText:{today:'오늘'},height:innerWidth<761?'auto':Math.max(570,innerHeight-270),expandRows:true,slotMinTime:'07:00:00',slotMaxTime:'22:00:00',scrollTime:'08:00:00',slotDuration:'00:30:00',slotLabelInterval:'01:00:00',slotLabelFormat:{hour:'2-digit',minute:'2-digit',hour12:false},eventTimeFormat:{hour:'2-digit',minute:'2-digit',hour12:false},selectable:true,editable:true,eventDurationEditable:true,longPressDelay:350,selectMirror:true,dayMaxEvents:3,navLinks:true,
  dayHeaderContent:arg=>{if(arg.view.type==='listMonth')return arg.text;return {html:'<span class="day-name">'+['일','월','화','수','목','금','토'][arg.date.getDay()]+'</span><span class="day-number">'+arg.date.getDate()+'</span>'};},
  events:(info,success)=>success(expandEvents(visible(),info.start,info.end).map(e=>({id:e.occurrenceId,title:e.title,start:e.start,end:e.end,allDay:e.allDay,backgroundColor:color(e)+'15',borderColor:color(e),extendedProps:{record:e},editable:e.repeat==='none'&&!e.readOnly}))),
  eventContent:arg=>{const e=arg.event.extendedProps.record;if(arg.view.type==='listMonth')return {html:esc(e.title)};return {html:'<div class="'+(e.status==='done'?'event-done':'')+'">'+(!e.allDay&&arg.view.type.startsWith('timeGrid')?'<div class="event-time">'+esc(timeLabel(e))+'</div>':'')+'<div class="event-title">'+esc(e.title)+'</div>'+((e.location&&arg.view.type.startsWith('timeGrid'))?'<div class="event-place">'+esc(e.location)+'</div>':'')+'</div>'};},
  eventDidMount:arg=>{arg.el.style.setProperty('--event-color',color(arg.event.extendedProps.record));arg.el.title=arg.event.title;},
  select:arg=>{openEditor(null,{start:arg.allDay?dayKey(arg.start):arg.start.toISOString(),end:arg.allDay?dayKey(arg.end):arg.end.toISOString(),allDay:arg.allDay});calendar.unselect();},
  eventClick:arg=>openEditor(arg.event.extendedProps.record.id),
  eventDrop:moveEvent,eventResize:moveEvent,
  datesSet:()=>{selectedDate=calendar?.getDate()||selectedDate;setHeading();paintMini();paintRail();},
 });
 calendar.render();
 document.querySelectorAll('[data-cal]').forEach(b=>b.onclick=()=>calendar[b.dataset.cal]());
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;page='calendar';calendar.changeView(view);setHeading();document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));});
 paintRail();
}
async function moveEvent(arg){
 const old=events.find(e=>e.id===arg.event.extendedProps.record.id);
 try{await store.save({...old,start:old.allDay?dayKey(arg.event.start):arg.event.start.toISOString(),end:old.allDay?dayKey(arg.event.end):arg.event.end.toISOString()},old.revision);toast('일정 시간이 변경되었습니다.');}
 catch(e){arg.revert();toast(e.message);}
}
function refreshCalendar(){calendar?.refetchEvents();paintRail();}
function paintRail(){
 if(!$('#rail'))return;
 const daily=expandEvents(visible(),atDay(dayKey(selectedDate),0),atDay(dayKey(shiftDay(selectedDate,1)),0)).sort((a,b)=>a.start.localeCompare(b.start)),next=daily.find(e=>e.status!=='done'),done=daily.filter(e=>e.status==='done').length;
 $('#rail').innerHTML='<div class="rail-date">'+selectedDate.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'})+'</div><div class="rail-title"><h2>하루의 흐름</h2><span class="pill">'+daily.length+'개의 일정</span></div>'+(next?'<div class="focus-card"><div class="label">NEXT ON YOUR DAY</div><h3>'+esc(next.title)+'</h3><p>'+esc(timeLabel(next))+'</p><button data-open="'+esc(next.id)+'">일정 살펴보기 '+icon('arrow')+'</button></div>':'<div class="focus-card"><div class="label">A LITTLE SPACE</div><h3>여유가 있는 하루</h3><p>나를 위한 시간을 남겨 두세요.</p></div>')+'<div class="side-heading"><span>오늘의 일정</span><span>'+done+' / '+daily.length+' 완료</span></div>'+daily.map(e=>'<button class="agenda-row '+(e.status==='done'?'done':'')+'" data-open="'+esc(e.id)+'" style="--cat:'+color(e)+'"><span class="agenda-dot"></span><span><strong>'+esc(e.title)+'</strong><small>'+esc(timeLabel(e))+' · '+esc(catName(e))+'</small></span><span class="check-circle">'+(e.status==='done'?icon('check'):'')+'</span></button>').join('')+(!daily.length?'<p class="quiet small">아직 등록된 일정이 없어요.</p>':'')+'<div class="rail-section"><div class="side-heading"><span>연결 상태</span>'+icon('link')+'</div><div class="notice">'+(store.isCloud?'클라우드에 연결되어 있습니다. 휴대폰 알림은 기기별로 허용해 주세요.':'지금은 내 기기에서 체험 중이에요.<br>가족 공유와 휴대폰 푸시는 클라우드 연결 후 사용할 수 있어요.')+'<br><button data-rail-settings>연결 설정 보기 →</button></div></div>';
 $('#rail').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openEditor(b.dataset.open));
 $('[data-rail-settings]').onclick=()=>openSettings();
}
const dateInput=s=>{const d=new Date(s);return dayKey(d)+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
function openEditor(id,patch={}){
 const old=id?events.find(e=>e.id===id):null;if(id&&!old)return;
 selectedId=id;
 const start=atDay(dayKey(selectedDate),9);
 const e=old||{id:newId(),title:'',start:start.toISOString(),end:new Date(+start+3600000).toISOString(),allDay:false,category:'personal',module:'personal',status:'planned',visibility:'personal',reminder:10,repeat:'none',notes:'',location:'',details:{},...patch};
 const d=$('#editor'),field=(label,body,full=false)=>'<label class="field'+(full?' full':'')+'"><span>'+label+'</span>'+body+'</label>';
 d.innerHTML='<form id="event-form"><div class="dialog-head"><h2 id="editor-title">'+(old?'일정 살펴보기':'새로운 일정')+'</h2><button type="button" data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body"><input class="editor-name" name="title" placeholder="어떤 하루를 계획하나요?" aria-label="일정 이름" maxlength="160" required value="'+esc(e.title)+'"><div class="form-grid">'+field('캘린더','<select name="category">'+(categories.some(c=>c.id===e.category)?categories:[...categories,{id:e.category,label:'보관된 분류'}]).map(c=>'<option value="'+esc(c.id)+'" '+(c.id===e.category?'selected':'')+'>'+esc(c.label)+'</option>').join('')+'</select>')+field('진행 상태','<select name="status">'+[['planned','예정'],['progress','진행 중'],['done','완료']].map(([v,l])=>'<option value="'+v+'" '+(e.status===v?'selected':'')+'>'+l+'</option>').join('')+'</select>')+'</div><label class="form-check"><input type="checkbox" name="allDay" '+(e.allDay?'checked':'')+'>종일 일정</label><div class="form-grid">'+field('시작','<input name="start" type="'+(e.allDay?'date':'datetime-local')+'" required value="'+(e.allDay?e.start:dateInput(e.start))+'">')+field(e.allDay?'마지막 날짜':'종료','<input name="end" type="'+(e.allDay?'date':'datetime-local')+'" required value="'+(e.allDay?dayKey(shiftDay(atDay(e.end),-1)):dateInput(e.end))+'">')+field('반복','<select name="repeat">'+[['none','반복 안 함'],['daily','매일'],['weekly','매주'],['monthly','매월 같은 날짜'],['yearly','매년 같은 날짜']].map(([v,l])=>'<option value="'+v+'" '+(e.repeat===v?'selected':'')+'>'+l+'</option>').join('')+'</select>')+field('미리 알림','<select name="reminder">'+[[-1,'알림 없음'],[0,'시작할 때'],[10,'10분 전'],[30,'30분 전'],[60,'1시간 전'],[1440,'하루 전']].map(([v,l])=>'<option value="'+v+'" '+(e.reminder===v?'selected':'')+'>'+l+'</option>').join('')+'</select>')+field('장소','<input name="location" placeholder="장소를 입력하세요" value="'+esc(e.location)+'">',true)+field('메모','<textarea name="notes" placeholder="기억할 내용이나 준비할 것을 남겨 주세요.">'+esc(e.notes)+'</textarea>',true)+(store.isCloud?field('공개 범위','<select name="visibility"><option value="personal" '+(e.visibility==='personal'?'selected':'')+'>나만 보기</option><option value="family" '+(e.visibility==='family'?'selected':'')+'>가족과 공유</option></select>',true):'')+'</div><div id="extra-fields"></div><p class="form-note">'+(e.repeat!=='none'?'반복 일정의 수정·삭제는 전체 반복에 적용됩니다. ':'')+(store.isCloud?'':'체험 공간의 알림은 설정만 저장됩니다. 휴대폰으로 발송되지 않습니다.')+(e.source?'<br>가져온 원본: '+esc(e.source.app)+' · 원본 수정은 아직 반영하지 않습니다.':'')+'</p><p class="form-error" role="alert"></p></div><div class="dialog-actions">'+(old?'<button type="button" class="danger" id="delete-event">'+icon('trash')+'삭제</button>':'')+'<button type="button" data-close class="soft">닫기</button><button type="submit" class="primary">'+icon('check')+'저장하기</button></div></form>';
 const form=$('#event-form');let draftDetails={...(e.details||{})};
 function extras(){form.querySelectorAll('[data-detail]').forEach(x=>draftDetails[x.dataset.detail]=x.value);const module=registry.get(form.category.value);const fields=module&&enabled(module.id)?module.fields:[];$('#extra-fields').innerHTML=fields.length?'<div class="extra-fields"><div class="extra-label">'+icon(module.icon)+esc(module.label)+' 상세</div><div class="form-grid">'+fields.map(f=>field(esc(f.label),'<input data-detail="'+esc(f.key)+'" type="'+(f.type||'text')+'" '+(f.type==='number'?'min="0"':'')+' placeholder="'+esc(f.placeholder||'')+'" value="'+esc(draftDetails[f.key]||'')+'">')).join('')+'</div></div>':'';}
 extras();form.category.addEventListener('change',extras);
 form.allDay.addEventListener('change',()=>{for(const name of ['start','end']){const x=form[name],v=x.value;if(form.allDay.checked){x.type='date';x.value=v.slice(0,10);}else{x.type='datetime-local';x.value=v.slice(0,10)+'T'+(name==='start'?'09:00':'10:00');}}});
 d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
 if(old)$('#delete-event').onclick=async()=>{if(await ask('일정을 삭제할까요?',e.repeat!=='none'?'이 일정의 전체 반복이 삭제됩니다. 삭제 후 백업 또는 휴지통에서 복원할 수 있습니다.':'삭제된 일정은 휴지통에서 복원할 수 있습니다.','삭제')){try{await store.remove(old);d.close();toast('일정을 휴지통으로 옮겼습니다.');}catch(err){$('.form-error').textContent=err.message;}}};
 form.addEventListener('submit',async ev=>{ev.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;try{form.querySelectorAll('[data-detail]').forEach(x=>draftDetails[x.dataset.detail]=x.value);const allDay=form.allDay.checked;const value={...e,title:form.elements.namedItem('title').value,category:form.category.value,module:form.category.value===e.category?e.module:(registry.get(form.category.value)?form.category.value:'personal'),status:form.status.value,repeat:form.repeat.value,reminder:Number(form.reminder.value),allDay,start:allDay?form.start.value:new Date(form.start.value).toISOString(),end:allDay?dayKey(shiftDay(atDay(form.end.value),1)):new Date(form.end.value).toISOString(),notes:form.notes.value,location:form.location.value,details:draftDetails,visibility:store.isCloud?form.visibility.value:'personal',demo:old?.demo||false};await store.save(value,old?.revision||0);d.close();toast('일정을 저장했습니다.');}catch(err){$('.form-error').textContent=err.message;}finally{submit.disabled=false;}});
 d.showModal();setTimeout(()=>form.elements.namedItem('title').focus(),30);
}
function renderBlocks(){
 $('#content').innerHTML='<div class="block-page"><div class="blocks-intro"><div>'+icon('blocks')+'</div><div><strong>연결할수록 넓어지는 나의 공간</strong><p>블록을 꺼도 일정과 기록은 남습니다. 다른 블록은 그대로 사용할 수 있어요.</p></div></div><div class="block-grid"><article class="block-card" style="--cat:#3565e8;--tint:#edf2ff"><div class="block-icon">'+icon('calendar')+'</div><h3>캘린더</h3><p>모든 일정의 공통 공간. 보기·검색·편집·백업을 담당합니다.</p><div class="block-bottom"><span>공통 기반</span><span class="pill">사용 중</span></div></article>'+registry.list().map(m=>'<article class="block-card" style="--cat:'+m.color+';--tint:'+m.color+'12"><div class="block-icon">'+icon(m.icon)+'</div><h3>'+esc(m.label)+'</h3><p>'+esc(m.description)+'</p><div class="block-bottom"><span>'+(!enabled(m.id)?'일정은 보존됨':'상세 입력 사용 중')+'</span><button role="switch" aria-checked="'+enabled(m.id)+'" aria-label="'+esc(m.label)+' 블록" class="switch" data-toggle="'+esc(m.id)+'"></button></div></article>').join('')+'</div><p class="blocks-legend">워크로그 파일은 설정에서 가져올 수 있습니다. 프로그램 간 실시간 연동과 가족 공유는 클라우드 연결 후 활성화됩니다.</p>'+(registry.errors.length?'<p class="notice">일부 블록을 불러오지 못했습니다. 나머지 블록은 정상 작동합니다.</p>':'')+'</div>';
 document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async()=>{const id=b.dataset.toggle;disabled=disabled.includes(id)?disabled.filter(x=>x!==id):[...disabled,id];await store.setMeta('disabled',disabled);if(page==='blocks')renderBlocks();toast(enabled(id)?'블록을 연결했습니다.':'블록을 껐습니다. 기존 일정은 유지됩니다.');});
}
function renderInbox(){
 const reminders=expandEvents(events.filter(e=>!e.deletedAt&&e.reminder>=0&&e.status!=='done'),new Date(),shiftDay(new Date(),14)).sort((a,b)=>a.start.localeCompare(b.start));
 $('#content').innerHTML='<div class="block-page"><div class="blocks-intro"><div>'+icon('bell')+'</div><div><strong>'+(store.isCloud?'이 기기의 알림을 켜 주세요':'휴대폰 알림 연결 전')+'</strong><p>'+(store.isCloud?'알림 권한을 허용하고 이 기기를 등록하면, 앱을 열지 않아도 서버에서 알림을 보냅니다.':'아래 목록은 저장된 알림 설정입니다. 실제 발송 내역이 아닙니다.')+'</p><button class="soft" id="enable-push">'+(store.isCloud?'이 기기에 알림 연결':'연결 설정 보기')+'</button></div></div><div class="side-heading"><span>앞으로 2주 · 알림이 설정된 일정</span><span>'+reminders.length+'건</span></div>'+reminders.map(e=>'<div class="inbox-item" style="--cat:'+color(e)+';--tint:'+color(e)+'12"><div class="block-icon">'+icon('bell')+'</div><div><strong>'+esc(e.title)+'</strong><p>'+new Date(e.start).toLocaleDateString('ko-KR',{month:'long',day:'numeric'})+' · '+esc(timeLabel(e))+'<br>'+(e.reminder===0?'시작할 때':e.reminder+'분 전')+' 알림 · '+(store.isCloud?'예약 설정':'연결 대기')+'</p></div><button data-open="'+esc(e.id)+'">'+icon('chevron')+'</button></div>').join('')+(!reminders.length?'<div class="empty">'+icon('bell')+'<p>다가오는 알림이 없습니다.</p></div>':'')+'</div>';
 $('#enable-push').onclick=()=>store.isCloud?enablePush():openSettings();
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openEditor(b.dataset.open));
}
async function enablePush(){try{const {subscribePush}=await import('./cloud.js');await subscribePush(store);toast('이 기기를 알림 수신 기기로 등록했습니다.');}catch(e){toast(e.message);}}
function openSettings(){
 const d=$('#settings');
 d.innerHTML='<div class="dialog-head"><h2 id="settings-title">나의 캘린더 설정</h2><button data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body"><div class="notice"><strong>'+stateLabel()+'</strong><br>'+(store.isCloud?'로그인한 공간의 일정과 연결되어 있습니다.':'체험 데이터는 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우기 전 백업해 주세요. 가족 공유·휴대폰 푸시는 아직 연결되지 않았습니다.')+'</div><div class="settings-row"><div><strong>클라우드 · 가족 공유</strong><p>'+(config.apiBase?'설정된 전용 서버에 로그인합니다.':'전용 서버 배포와 계정 연결이 필요합니다.')+'</p></div><button class="soft" id="cloud-login" '+(!config.apiBase?'disabled':'')+'>연결</button></div><div class="settings-row"><div><strong>홈 화면에 설치</strong><p>휴대폰에서는 브라우저 메뉴의 ‘홈 화면에 추가’를 사용하세요.</p></div><button class="soft" id="install" '+(!installEvent?'disabled':'')+'>설치</button></div><div class="settings-group"><h3>데이터 관리</h3><div class="settings-row"><div><strong>워크로그 · 백업 가져오기</strong><p>JSON 파일을 가져옵니다. 원본 파일은 변경하지 않습니다.</p></div><button class="soft" data-setting="import">'+icon('upload')+'가져오기</button></div><div class="settings-row"><div><strong>내 일정 백업</strong><p>삭제한 일정과 상세 항목을 포함해 내보냅니다.</p></div><button class="soft" data-setting="export">'+icon('download')+'내보내기</button></div><div class="settings-row"><div><strong>캘린더 관리</strong><p>분류를 추가하거나 이름을 바꿀 수 있습니다.</p></div><button class="soft" data-setting="categories">관리</button></div><div class="settings-row"><div><strong>휴지통</strong><p>삭제된 일정 '+events.filter(e=>e.deletedAt).length+'개</p></div><button class="soft" data-setting="trash">열기</button></div><div class="settings-row"><div><strong>인쇄</strong><p>현재 캘린더 화면을 출력합니다.</p></div><button class="soft" data-setting="print">'+icon('print')+'인쇄</button></div></div><details class="settings-group"><summary class="quiet small">앱 상태 · 버전 '+config.version+'</summary><p class="form-note">저장소: '+(store.isCloud?'클라우드':'이 기기')+'<br>전체 일정: '+events.length+'개<br>불러온 블록: '+registry.list().length+'개<br>블록 오류: '+registry.errors.length+'개<br>마지막 화면 갱신: '+new Date().toLocaleString('ko-KR')+'</p></details></div><div class="dialog-actions"><button class="primary" data-close>완료</button></div>';
 d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
 d.querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>{d.close();action(b.dataset.setting);});
 $('#install').onclick=async()=>{await installEvent?.prompt();installEvent=null;};
 $('#cloud-login').onclick=()=>{d.close();cloudLogin();};
 if(store.isCloud){const out=document.createElement('button');out.className='soft';out.textContent='로그아웃';out.onclick=()=>{store.close();location.reload();};d.querySelector('.dialog-actions').prepend(out);}
 d.showModal();
}
function manageCategories(){
 const d=$('#settings');d.innerHTML='<div class="dialog-head"><h2 id="settings-title">내 캘린더 관리</h2><button data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body">'+categories.map(c=>'<div class="settings-row"><input data-cat-name="'+esc(c.id)+'" aria-label="캘린더 이름" value="'+esc(c.label)+'" maxlength="30"><input type="color" data-cat-color="'+esc(c.id)+'" aria-label="색상" value="'+c.color+'" style="width:52px;height:40px;padding:5px"><button class="danger" data-cat-delete="'+esc(c.id)+'" aria-label="'+esc(c.label)+' 삭제">'+icon('trash')+'</button></div>').join('')+'<button class="soft" id="add-category" style="margin-top:17px">'+icon('plus')+'캘린더 추가</button><p class="form-note">일정이 있는 캘린더는 먼저 일정을 다른 캘린더로 옮겨 주세요.</p></div><div class="dialog-actions"><button class="primary" id="save-categories">저장</button></div>';
 d.querySelector('[data-close]').onclick=()=>d.close();
 d.querySelectorAll('[data-cat-delete]').forEach(b=>b.onclick=async()=>{const id=b.dataset.catDelete;if(events.some(e=>!e.deletedAt&&e.category===id)){toast('일정이 있어 삭제할 수 없습니다. 먼저 일정을 옮겨 주세요.');return;}if(id==='personal'){toast('기본 캘린더는 유지됩니다.');return;}categories=categories.filter(c=>c.id!==id);await store.setMeta('categories',categories);d.close();manageCategories();paintCategories();});
 $('#add-category').onclick=async()=>{categories.push({id:newId(),label:'새 캘린더',color:'#607cbb'});await store.setMeta('categories',categories);d.close();manageCategories();};
 $('#save-categories').onclick=async()=>{for(const c of categories){c.label=d.querySelector('[data-cat-name="'+c.id+'"]').value.trim()||c.label;c.color=d.querySelector('[data-cat-color="'+c.id+'"]').value;}await store.setMeta('categories',categories);d.close();paintCategories();refreshCalendar();toast('캘린더 구성을 저장했습니다.');};d.showModal();
}
function trash(){
 const d=$('#settings'),deleted=events.filter(e=>e.deletedAt);
 d.innerHTML='<div class="dialog-head"><h2 id="settings-title">휴지통</h2><button data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body">'+deleted.map(e=>'<div class="settings-row"><strong>'+esc(e.title)+'</strong><button class="soft" data-restore="'+esc(e.id)+'">복원</button></div>').join('')+(!deleted.length?'<p class="empty">휴지통이 비어 있습니다.</p>':'')+'</div>';d.querySelector('[data-close]').onclick=()=>d.close();d.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{try{const e=events.find(x=>x.id===b.dataset.restore);await store.save({...e,deletedAt:null},e.revision);await refresh();d.close();trash();toast('일정을 복원했습니다.');}catch(e){toast(e.message);}});d.showModal();
}
async function importFile(event){
 const file=event.target.files[0];if(!file)return;
 try{if(file.size>10*1024*1024)throw Error('10MB 이하 JSON 파일을 선택해 주세요.');const data=JSON.parse(await file.text());const {mapWorklog}=await import('./adapters/worklog.js');const records=Array.isArray(data)?data:data.events||data.entries;if(!Array.isArray(records))throw Error('events 또는 entries 배열이 있는 JSON 파일을 선택해 주세요.');
 const canonical=records.every(e=>e.schemaVersion===1);
 const mapped=canonical?records:mapWorklog(records);
 if(!mapped.length)throw Error('날짜가 있는 기록을 찾지 못했습니다.');
 if(await ask('일정 '+mapped.length+'개를 가져올까요?','이 공간에 복사합니다. 같은 ID의 일정은 건너뛰며 기존 내용과 원본 파일은 덮어쓰지 않습니다.','가져오기')){const n=await store.import(mapped);toast(n+'개를 가져왔습니다.');}
 }catch(e){toast(e.message);}finally{event.target.value='';}
}
async function cloudLogin(){
 const d=$('#settings');d.innerHTML='<form id="login-form"><div class="dialog-head"><h2 id="settings-title">내 공간 로그인</h2><button type="button" data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body"><div class="form-grid"><label class="field full">이메일<input name="email" type="email" required autocomplete="username"></label><label class="field full">비밀번호<input name="password" type="password" required autocomplete="current-password"></label><label class="field full">공간 ID<input name="workspace" required value="'+esc(config.workspaceId||'family')+'"></label></div><p class="form-note">초대된 계정만 사용할 수 있습니다. 체험 일정은 자동 업로드하지 않습니다.</p><p class="form-error"></p></div><div class="dialog-actions"><button class="primary" type="submit">로그인</button></div></form>';d.querySelector('[data-close]').onclick=()=>d.close();d.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.target;try{const {CloudStore}=await import('./cloud.js');const live=await new CloudStore(config).login(f.email.value,f.password.value,f.workspace.value);store=live;categories=await store.meta('categories',baseCategories);disabled=await store.meta('disabled',[]);await refresh();store.subscribe(refresh);d.close();shell();$('#banner-label').textContent='클라우드 공간 · 실제 계정 데이터';toast('내 공간에 연결되었습니다.');const target=new URLSearchParams(location.search).get('event');if(target)openEditor(target);}catch(err){d.querySelector('.form-error').textContent=err.message;}};d.showModal();
}
async function action(name){
 if(['calendar','agenda','blocks','inbox'].includes(name)){navigate(name);return;}
 if(name==='add')openEditor();
 if(name==='settings')openSettings();
 if(name==='menu')$('.sidebar').classList.toggle('open');
 if(name==='categories')manageCategories();
 if(name==='trash')trash();
 if(name==='export')download('dalnim-backup-'+dayKey()+'.json',JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),events,categories},null,2));
 if(name==='import')$('#import-file').click();
 if(name==='print'){if(page!=='calendar'&&page!=='agenda')navigate('calendar');setTimeout(()=>window.print(),100);}
 if(name==='clear-demo'&&await ask('예시 일정을 지울까요?','직접 만든 일정은 유지되고 예시 일정만 휴지통으로 옮겨집니다.','예시 지우기')){for(const e of events.filter(e=>e.demo&&!e.deletedAt))await store.remove(e);toast('예시 일정을 지웠습니다.');}
}
async function refresh(){events=await store.list();if($('#store-state'))$('#store-state').innerHTML=icon('check')+stateLabel();paintCategories();if(page==='blocks')renderBlocks();else if(page==='inbox')renderInbox();else refreshCalendar();}
async function init(){
 store=await new LocalStore().init();
 if(config.apiBase&&sessionStorage.getItem('dalnim-session')){try{const {CloudStore}=await import('./cloud.js');store=await new CloudStore(config).restore();}catch(err){sessionStorage.removeItem('dalnim-session');toast('클라우드에 연결하지 못해 체험 공간을 열었습니다. 다시 로그인해 주세요.');}}
 await registry.load(config.modules);categories=await store.meta('categories',baseCategories);disabled=await store.meta('disabled',[]);events=await store.list();
 if(!store.isCloud&&!await store.meta('seeded',false)){await store.import(demoEvents());await store.setMeta('seeded',true);events=await store.list();}
 shell();if(store.isCloud){$('#banner-label').textContent='클라우드 공간 · 실제 계정 데이터';$('[data-action=clear-demo]').hidden=true;}store.subscribe(refresh);
 window.addEventListener('unhandledrejection',e=>{console.error(e.reason);toast(e.reason?.message||'처리하지 못했습니다. 다시 시도해 주세요.');});
 document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.key==='/'){e.preventDefault();$('#search').focus();}if(e.key==='n'||e.key==='N')openEditor();if(e.key==='t'||e.key==='T')calendar?.today();});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;});
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>console.warn('Service worker unavailable',e));
 const id=new URLSearchParams(location.search).get('event');if(id)openEditor(id);
 window.Dalnim={version:config.version,openEvent:openEditor,getStatus:()=>({mode:store.isCloud?'cloud':'local',modules:registry.list().map(m=>m.id),errors:registry.errors})};
}
init().catch(e=>{$('#app').innerHTML='<div class="boot"><h2>캘린더를 열지 못했어요</h2><p>'+esc(e.message)+'</p><p>브라우저의 저장 공간과 사이트 권한을 확인해 주세요.</p><button onclick="location.reload()">다시 열기</button></div>';console.error(e);});


