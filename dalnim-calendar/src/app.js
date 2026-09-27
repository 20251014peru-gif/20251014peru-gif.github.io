import {dateTimeField,bindDateTimes} from './components/time-dial.js';
import {bindDayFlow} from './components/day-flow.js';
import {defaultCategories,isArchivedEvent,scopeCategories,mergeCategories,calendarBackupRecords} from './core/calendar-scope.js';
import {FeedConnection} from './core/feed-connection.js';
import {isInvestmentReminder,investmentReminderOrigin} from './core/investment-snooze.js';
import {openInvestmentDetail} from './components/investment-detail.js';
import {config} from './config.js';
import {LocalStore} from './core/store.js';
import {ModuleRegistry} from './core/registry.js';
import {dayKey,atDay,shiftDay,newId,expandEvents,safeURL,ZONE,MAX_PHOTOS} from './core/model.js';
import {demoEvents} from './demo.js';
import {esc,icon,button,toast,ask,chooseScope,download} from './ui.js';

const $=s=>document.querySelector(s);
const registry=new ModuleRegistry();
let store,calendar,events=[],disabled=[],hidden=new Set(),categories=[],selectedDate=new Date(),page='calendar',view=innerWidth<761?'timeGridDay':'timeGridWeek',query='',selectedId=null,installEvent;
let investmentEvents=[];
const findAnyEvent=id=>events.find(e=>e.id===id)||investmentEvents.find(e=>e.id===id||e.aliases?.includes(id));
const baseCategories=defaultCategories;
let savedCategories=[],feedTimer;
function feedChanged(){investmentEvents=[...investmentFeed.events,...predictionFeed.events];if($('#categories')){paintCategories();paintFeedState();refreshCalendar();if(page==='blocks')renderBlocks();}}
const investmentFeed=new FeedConnection(feedChanged),predictionFeed=new FeedConnection(feedChanged);
function setCategories(saved){savedCategories=saved;categories=scopeCategories(saved);}
async function persistCategories(){savedCategories=mergeCategories(savedCategories,categories);await store.setMeta('categories',savedCategories);}
const archivedEvents=()=>events.filter(isArchivedEvent);
const color=e=>categories.find(c=>c.id===e.category)?.color||'#8795ad';
const catName=e=>categories.find(c=>c.id===e.category)?.label||'보관된 일정';
const timeLabel=e=>e.allDay?'종일':new Date(e.start).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})+' – '+new Date(e.end).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
const enabled=id=>id==='personal'||!disabled.includes(id);
const visible=()=>[...events,...investmentEvents].filter(e=>!isArchivedEvent(e)&&!e.deletedAt&&e.calendarVisible!==false&&!hidden.has(e.category)&&(!query||[e.title,e.notes,e.location,...Object.values(e.details||{})].join(' ').toLowerCase().includes(query.toLowerCase())));
const stateLabel=()=>store?.isCloud?(store.pendingCount?'오프라인 저장 대기 · '+store.pendingCount+'건':store.lastError?'연결 확인 필요':'클라우드 연결됨'):'이 기기에 저장';
const occurrenceAnchor=id=>id&&id.includes('@')?id.slice(id.indexOf('@')+1):null;
function shell(){
 $('#app').innerHTML='<div class="shell"><aside class="sidebar"><div class="brand"><img src="./icon.svg" alt=""><div><strong>달님</strong><small>MY CONNECTED DAYS</small></div></div><button class="space-btn" data-action="settings"><span class="avatar">나</span><span>나의 공간</span>'+icon('chevron')+'</button><label class="search sidebar-search">'+icon('search')+'<input type="search" id="search" placeholder="일정 검색" aria-label="일정 검색"><span class="kbd">/</span></label><nav class="navigation">'+nav('calendar','캘린더','calendar')+nav('agenda','일정 모아보기','list')+nav('inbox','알림함','bell')+nav('blocks','데이터 연결','blocks')+'</nav><div id="mini"></div><div><div class="side-heading"><span>내 캘린더</span><button data-action="categories" aria-label="캘린더 관리">'+icon('plus')+'</button></div><div id="categories"></div></div><div id="feed-state" class="feed-state" aria-live="polite"></div><div class="sidebar-footer"><div class="footer-status"><span class="mode-badge" id="store-state">'+icon('check')+stateLabel()+'</span><button data-action="inbox" aria-label="알림함">'+icon('bell')+'</button><span class="avatar">나</span></div>'+button('settings','설정','settings','nav')+button('export','백업 내보내기','download','nav')+'<a class="backlink" href="'+esc(config.systemHomeUrl)+'" target="_top" id="home-link">'+icon('home')+'나의 시스템 홈</a><span>달님 캘린더 · '+config.version+'</span></div></aside><main class="main"><header class="topbar"><button class="mobile-menu" data-action="menu" aria-label="메뉴 열기">'+icon('menu')+'</button></header><section class="page-head"><div><a class="system-home-link" href="'+esc(config.systemHomeUrl)+'" target="_top" aria-label="나의 시스템 · 인생 6대축 홈" title="나의 시스템 · 인생 6대축으로 이동">'+icon('home')+'<span>6대축 홈</span></a><h1 id="page-title"></h1><p class="head-description" id="page-description"></p></div><div class="page-actions"><a class="archive-link soft" href="'+esc(config.investmentArchiveUrl)+'" target="_blank" rel="noopener">'+icon('chart')+'<span>기록보관실</span></a><button class="primary" data-action="add">'+icon('plus')+'<span>새 기록</span></button></div></section><div id="content"></div><div class="banner"><span id="banner-label">체험 공간 · 투자와 기록을 살펴보는 예시입니다.</span><button data-action="clear-demo">예시 지우기</button></div></main></div><nav class="mobile-bottom">'+nav('calendar','캘린더','calendar')+nav('agenda','모아보기','list')+nav('inbox','알림함','bell')+nav('blocks','연결','blocks')+'</nav><input type="file" id="import-file" accept=".json,application/json" hidden>';
 $('#search').value=query;
 $('#search').addEventListener('input',e=>{query=e.target.value;if(page==='calendar'||page==='agenda')refreshCalendar();else navigate('agenda');});
 $('#import-file').addEventListener('change',importFile);
 document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action)));
 if(new URLSearchParams(location.search).has('embed'))document.body.classList.add('embed');
 paintCategories();paintMini();paintFeedState();navigate(page);
}
function nav(id,label,ico){return '<button class="nav'+(page===id?' active':'')+'" data-action="'+id+'">'+icon(ico)+'<span>'+label+'</span></button>';}
function paintCategories(){
 $('#categories').innerHTML=categories.map(c=>'<label class="cat-row" style="--cat:'+c.color+'"><input type="checkbox" data-category="'+esc(c.id)+'" '+(!hidden.has(c.id)?'checked':'')+'><span>'+esc(c.label)+'</span><span class="count">'+[...events,...investmentEvents].filter(e=>!isArchivedEvent(e)&&!e.deletedAt&&e.category===c.id).length+'</span></label>').join('');
 $('#categories').querySelectorAll('input').forEach(el=>el.addEventListener('change',()=>{el.checked?hidden.delete(el.dataset.category):hidden.add(el.dataset.category);refreshCalendar();}));
}
function paintMini(){
 const d=calendar?.getDate()||selectedDate,year=d.getFullYear(),month=d.getMonth(),first=new Date(year,month,1),start=shiftDay(first,-first.getDay());
 $('#mini').innerHTML='<div class="mini-head"><strong>'+year+'년 '+(month+1)+'월</strong><span><button data-mini="-1" aria-label="이전 달">'+icon('chevron','rotated')+'</button><button data-mini="1" aria-label="다음 달">'+icon('chevron')+'</button></span></div><div class="mini-grid">'+['일','월','화','수','목','금','토'].map(x=>'<span>'+x+'</span>').join('')+Array.from({length:42},(_,i)=>{const x=shiftDay(start,i);return '<button data-date="'+dayKey(x)+'" class="'+(x.getMonth()!==month?'out ':'')+(dayKey(x)===dayKey()?'today ':'')+(dayKey(x)===dayKey(selectedDate)?'selected':'')+'">'+x.getDate()+'</button>';}).join('')+'</div>';
 $('#mini').querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selectedDate=atDay(b.dataset.date);if(page!=='calendar'&&page!=='agenda')navigate('calendar');else calendar?.gotoDate(selectedDate);paintRail();});
 $('#mini').querySelectorAll('[data-mini]').forEach(b=>b.onclick=()=>{const x=new Date(year,month+Number(b.dataset.mini),1);selectedDate=x;calendar?.gotoDate(x);paintMini();});
}
function setHeading(){
 const titles={blocks:['데이터 연결','나의 기록과 투자 기록보관실을 한곳에서 살펴보세요.'],inbox:['알림함','다가오는 일정과 알림 준비 상태를 확인하세요.']};
 if(titles[page]){$('#page-title').textContent=titles[page][0];$('#page-description').textContent=titles[page][1];}
 else {const d=calendar?.getDate()||selectedDate;$('#page-title').innerHTML=d.getMonth()+1+'월 <span>'+d.getFullYear()+'</span>';$('#page-description').textContent=page==='agenda'?'시간 순서대로, 놓치지 않고.':'투자와 기록, 확인할 순간을 한곳에.';}
 document.querySelectorAll('.navigation .nav,.mobile-bottom .nav').forEach(b=>b.classList.toggle('active',b.dataset.action===page));
}
function navigate(next){page=next;calendar?.destroy();calendar=null;$('.sidebar')?.classList.remove('open');setHeading();
 if(next==='calendar'||next==='agenda')renderCalendar();else if(next==='blocks')renderBlocks();else renderInbox();
}
function renderCalendar(){
 $('#content').innerHTML='<div class="workspace"><div class="calendar-wrap"><div class="toolbar"><div class="date-nav"><button class="today-btn" data-cal="today">오늘</button><button data-cal="prev" aria-label="이전 기간">'+icon('chevron','rotated')+'</button><button data-cal="next" aria-label="다음 기간">'+icon('chevron')+'</button><span id="range-label" class="quiet small"></span></div><div class="toolbar-end"><div class="day-flow"><button class="flow-trigger" aria-expanded="false" aria-controls="rail">'+icon('clock')+'<span>하루 흐름</span></button><div class="flow-panel" inert><aside class="right-rail" id="rail" aria-label="하루의 흐름"></aside></div></div><div class="view-switch">'+[['timeGridDay','일'],['timeGridWeek','주'],['dayGridMonth','월'],['multiMonthYear','연']].map(([v,l])=>'<button data-view="'+v+'" class="'+(v===view?'active':'')+'">'+l+'</button>').join('')+'</div></div></div><div id="calendar"></div><div class="calendar-foot"><span>'+icon('info')+'빈 시간을 선택해 추가 · 일정을 끌어서 이동</span><span>'+esc(ZONE)+' · '+(store.isCloud?'클라우드 동기화':'내 기기 체험')+'</span></div></div></div>';
 bindDayFlow($('.day-flow'));
 if(!window.FullCalendar){$('#calendar').innerHTML='<div class="empty">캘린더 화면을 불러오지 못했습니다.<br>다른 블록과 백업 기능은 계속 사용할 수 있습니다.</div>';return;}
 calendar=new FullCalendar.Calendar($('#calendar'),{
  initialView:page==='agenda'?'listMonth':view,initialDate:selectedDate,locale:'ko',firstDay:0,headerToolbar:false,nowIndicator:true,allDayText:'종일',noEventsText:'표시할 일정이 없습니다.',buttonText:{today:'오늘'},height:'auto',expandRows:true,slotMinTime:'07:00:00',slotMaxTime:'22:00:00',scrollTime:'08:00:00',slotDuration:'00:30:00',snapDuration:'00:05:00',slotLabelInterval:'01:00:00',slotLabelFormat:{hour:'2-digit',minute:'2-digit',hour12:false},eventTimeFormat:{hour:'2-digit',minute:'2-digit',hour12:false},selectable:true,editable:true,eventDurationEditable:true,longPressDelay:350,selectMirror:true,dayMaxEvents:false,navLinks:true,slotEventOverlap:false,
  dayHeaderContent:arg=>{if(arg.view.type==='listMonth')return arg.text;return {html:'<span class="day-name">'+['일','월','화','수','목','금','토'][arg.date.getDay()]+'</span><span class="day-number">'+arg.date.getDate()+'</span>'};},
  events:(info,success)=>{
   const mapped=expandEvents(visible(),info.start,info.end).map(e=>({id:e.occurrenceId,title:e.title,start:e.start,end:e.end,allDay:e.allDay,backgroundColor:color(e)+'1b',borderColor:color(e),extendedProps:{record:e},editable:e.repeat==='none'&&!e.readOnly&&!isInvestmentReminder(e)}));
   // Read-only investment items all share one category color, so several on the same day blur
   // together — alternate two colors by their order within that day instead.
   const READONLY_ALT=['#1e3f78','#e2760f'],dayCount={};
   mapped.filter(m=>m.extendedProps.record.readOnly).forEach(m=>{
    const day=String(m.start).slice(0,10),i=dayCount[day]=(dayCount[day]||0)+1,c=READONLY_ALT[(i-1)%2];
    m.borderColor=c;m.backgroundColor=c+'1b';
   });
   success(mapped);
  },
  eventContent:arg=>{const e=arg.event.extendedProps.record;if(arg.view.type==='listMonth')return {html:esc(e.title)};return {html:'<div class="'+(e.status==='done'?'event-done':'')+'">'+(!e.allDay&&arg.view.type.startsWith('timeGrid')?'<div class="event-time">'+esc(timeLabel(e))+'</div>':'')+'<div class="event-title">'+(e.readOnly?icon('link','tiny')+' ':'')+esc(e.title)+'</div>'+((e.location&&arg.view.type.startsWith('timeGrid'))?'<div class="event-place">'+esc(e.location)+'</div>':'')+'</div>'};},
  eventDidMount:arg=>{
   const r=arg.event.extendedProps.record,c=r.readOnly?arg.event.borderColor:color(r);
   arg.el.style.setProperty('--event-color',c);
   const t=arg.el.querySelector('.event-title');if(t&&r.readOnly)t.style.color=c;
   arg.el.title=arg.event.title;
  },
  select:arg=>{openEditor(null,{start:arg.allDay?dayKey(arg.start):arg.start.toISOString(),end:arg.allDay?dayKey(arg.end):arg.end.toISOString(),allDay:arg.allDay});calendar.unselect();},
  eventClick:arg=>{const r=arg.event.extendedProps.record;if(r.readOnly)openReadOnlyRecord(r);else openEditor(r.id,{},occurrenceAnchor(r.occurrenceId));},
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
 catch(err){if(err.queued)toast(err.message);else{arg.revert();toast(err.message);}}
}
function refreshCalendar(){calendar?.refetchEvents();paintRail();}
function paintRail(){
 if(!$('#rail'))return;
 const daily=expandEvents(visible(),atDay(dayKey(selectedDate),0),atDay(dayKey(shiftDay(selectedDate,1)),0)).sort((a,b)=>a.start.localeCompare(b.start)),next=daily.find(e=>e.status!=='done'),done=daily.filter(e=>e.status==='done').length;
 $('#rail').innerHTML='<div class="rail-date">'+selectedDate.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'})+'</div><div class="rail-title"><h2>하루의 흐름</h2><span class="pill">'+daily.length+'개의 일정</span></div>'+(next?'<div class="focus-card"><div class="label">NEXT ON YOUR DAY</div><h3>'+esc(next.title)+'</h3><p>'+esc(timeLabel(next))+'</p><button data-open="'+esc(next.id)+'" data-anchor="'+esc(occurrenceAnchor(next.occurrenceId)||'')+'">일정 살펴보기 '+icon('arrow')+'</button></div>':'<div class="focus-card"><div class="label">A LITTLE SPACE</div><h3>여유가 있는 하루</h3><p>나를 위한 시간을 남겨 두세요.</p></div>')+'<div class="side-heading"><span>오늘의 일정</span><span>'+done+' / '+daily.length+' 완료</span></div>'+daily.map(e=>'<button class="agenda-row '+(e.status==='done'?'done':'')+'" data-open="'+esc(e.id)+'" data-anchor="'+esc(occurrenceAnchor(e.occurrenceId)||'')+'" style="--cat:'+color(e)+'"><span class="agenda-dot"></span><span><strong>'+esc(e.title)+'</strong><small>'+esc(timeLabel(e))+' · '+esc(catName(e))+'</small></span><span class="check-circle">'+(e.status==='done'?icon('check'):'')+'</span></button>').join('')+(!daily.length?'<p class="quiet small">아직 등록된 일정이 없어요.</p>':'')+'<div class="rail-section"><div class="side-heading"><span>연결 상태</span>'+icon('link')+'</div><div class="notice">'+(store.isCloud?'클라우드에 연결되어 있습니다. 휴대폰 알림은 기기별로 허용해 주세요.':'지금은 내 기기에서 체험 중이에요.<br>다른 기기에서도 보려면 클라우드에 연결해 주세요.')+'<br><button data-rail-settings>연결 설정 보기 →</button></div></div>';
 $('#rail').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const r=findAnyEvent(b.dataset.open);r?.readOnly?openReadOnlyRecord(r):openEditor(b.dataset.open,{},b.dataset.anchor||null);});
 $('[data-rail-settings]').onclick=()=>openSettings();
}
const dateInput=s=>{const d=new Date(s);return dayKey(d)+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
function openInvestmentFromQuery(){
 const id=new URLSearchParams(location.search).get('investment');if(!id)return;
 const item=investmentEvents.find(e=>e.id===id||e.aliases?.includes(id));if(item)openReadOnlyRecord(item);else if(store.isCloud)store.request('/investment-items/resolve','POST',{id}).then(r=>{if(r.event)openReadOnlyRecord(r.event);else toast('원본 항목을 찾지 못했습니다.');}).catch(e=>toast(e.message));
}
function openReadOnlyRecord(record){
 return openInvestmentDetail({dialog:$('#editor'),store,record,onChange:async item=>{
  if(item){for(const feed of [investmentFeed,predictionFeed])feed.events=feed.events.map(e=>e.id===item.id?item:e);feedChanged();}
  await refresh();await loadInvestmentFeed();
 },onSettings:()=>navigate('inbox'),notify:toast});
}
// Basic viewer: pinch/wheel/double-click zoom, drag-to-pan, prev/next, save and share. Save/share
// fetch the image as a blob first (Storage's download endpoint allows cross-origin reads) so a real
// file can be handed to the OS share sheet or saved with a real filename, falling back to opening
// the link directly (long-press-to-save works on phones) if that fetch is blocked for any reason.
function openPhotoViewer(photos,startIndex){
 const list=photos.filter(p=>p?.url);if(!list.length)return;
 let idx=Math.max(0,Math.min(startIndex,list.length-1)),scale=1,tx=0,ty=0,dragging=false,lastX=0,lastY=0,touchMode=null,pinchStart=0,pinchScale=1,panX=0,panY=0;
 const d=$('#photo-viewer');
 d.innerHTML='<div class="pv-head"><span class="pv-count"></span><div class="pv-actions"><button type="button" class="icon-btn" data-pv-save aria-label="저장">'+icon('download')+'</button><button type="button" class="icon-btn" data-pv-share aria-label="공유">'+icon('upload')+'</button><button type="button" class="icon-btn" data-pv-close aria-label="닫기">'+icon('close')+'</button></div></div><div class="pv-stage"><button type="button" class="pv-nav pv-prev" aria-label="이전">'+icon('chevron')+'</button><img class="pv-img" alt="사진"><button type="button" class="pv-nav pv-next" aria-label="다음">'+icon('chevron')+'</button></div>';
 const img=d.querySelector('.pv-img'),stage=d.querySelector('.pv-stage');
 const applyTransform=()=>{img.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';};
 const resetZoom=()=>{scale=1;tx=0;ty=0;applyTransform();};
 function render(){
  const p=list[idx];img.src=p.url;
  d.querySelector('.pv-count').textContent=list.length>1?(idx+1)+' / '+list.length:'';
  d.querySelector('.pv-prev').hidden=d.querySelector('.pv-next').hidden=list.length<2;
  resetZoom();
 }
 d.querySelector('[data-pv-close]').onclick=()=>d.close();
 d.querySelector('.pv-prev').onclick=()=>{idx=(idx-1+list.length)%list.length;render();};
 d.querySelector('.pv-next').onclick=()=>{idx=(idx+1)%list.length;render();};
 stage.addEventListener('wheel',ev=>{ev.preventDefault();scale=Math.min(4,Math.max(1,scale-ev.deltaY*0.0025));if(scale===1){tx=0;ty=0;}applyTransform();},{passive:false});
 img.addEventListener('dblclick',()=>{scale=scale>1?1:2.4;tx=0;ty=0;applyTransform();});
 img.addEventListener('mousedown',ev=>{if(scale<=1)return;dragging=true;lastX=ev.clientX;lastY=ev.clientY;});
 function onMouseMove(ev){if(!dragging)return;tx+=ev.clientX-lastX;ty+=ev.clientY-lastY;lastX=ev.clientX;lastY=ev.clientY;applyTransform();}
 function onMouseUp(){dragging=false;}
 window.addEventListener('mousemove',onMouseMove);window.addEventListener('mouseup',onMouseUp);
 stage.addEventListener('touchstart',ev=>{
  if(ev.touches.length===2){touchMode='pinch';pinchStart=Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX,ev.touches[0].clientY-ev.touches[1].clientY);pinchScale=scale;}
  else if(ev.touches.length===1&&scale>1){touchMode='pan';panX=ev.touches[0].clientX-tx;panY=ev.touches[0].clientY-ty;}
 },{passive:true});
 stage.addEventListener('touchmove',ev=>{
  if(touchMode==='pinch'&&ev.touches.length===2){
   const dist=Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX,ev.touches[0].clientY-ev.touches[1].clientY);
   scale=Math.min(4,Math.max(1,pinchScale*(dist/pinchStart)));applyTransform();
  }else if(touchMode==='pan'&&ev.touches.length===1){tx=ev.touches[0].clientX-panX;ty=ev.touches[0].clientY-panY;applyTransform();}
 },{passive:true});
 stage.addEventListener('touchend',()=>{touchMode=null;if(scale<1.02)resetZoom();});
 d.querySelector('[data-pv-save]').onclick=async()=>{
  const p=list[idx];
  try{const blob=await(await fetch(p.url)).blob();download('dalnim-photo-'+(idx+1)+'.jpg',blob,blob.type||'image/jpeg');}
  catch{window.open(p.url,'_blank','noopener');toast('새 탭에서 열었습니다. 길게 눌러 저장해 주세요.');}
 };
 d.querySelector('[data-pv-share]').onclick=async()=>{
  const p=list[idx];
  try{
   const blob=await(await fetch(p.url)).blob(),file=new File([blob],'dalnim-photo.jpg',{type:blob.type||'image/jpeg'});
   if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'사진 공유'});return;}
   throw Error('file-share-unsupported');
  }catch(err){
   if(err?.name==='AbortError')return;
   try{await navigator.share({url:p.url,title:'사진 공유'});return;}catch(err2){if(err2?.name==='AbortError')return;}
   try{await navigator.clipboard.writeText(p.url);toast('사진 주소를 복사했습니다.');}catch{toast('공유하지 못했습니다.');}
  }
 };
 d.addEventListener('close',()=>{window.removeEventListener('mousemove',onMouseMove);window.removeEventListener('mouseup',onMouseUp);},{once:true});
 render();d.showModal();
}
function openEditor(id,patch={},anchor=null){
 const old=id?events.find(e=>e.id===id):null;if(id&&!old)return;if(isInvestmentReminder(old)){openReadOnlyRecord(investmentEvents.find(e=>e.id===old.details.investmentItemId||e.aliases?.includes(old.details.investmentItemId))||investmentReminderOrigin(old));return;}if(old&&isArchivedEvent(old)){openArchivedRecord(old);return;}
 selectedId=id;
 const perOccurrence=Boolean(old&&old.repeat!=='none'&&anchor);
 const start=atDay(dayKey(selectedDate),9);
 const e=old||{id:newId(),title:'',start:start.toISOString(),end:new Date(+start+3600000).toISOString(),allDay:false,category:'personal',module:'personal',status:'done',visibility:'personal',reminder:10,repeat:'none',notes:'',location:'',details:{},checklist:[],photos:[],...patch};
 const d=$('#editor'),field=(label,body,full=false,attrs='')=>'<label class="field'+(full?' full':'')+'"'+(attrs?' '+attrs:'')+'><span>'+label+'</span>'+body+'</label>';
 d.innerHTML='<form id="event-form"><div class="dialog-head"><h2 id="editor-title">'+(old?'기록 살펴보기':'새로운 기록')+'</h2><button type="button" data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body"><input class="editor-name" name="title" placeholder="어떤 기록을 남길까요?" aria-label="기록 이름" maxlength="160" required value="'+esc(e.title)+'"><div class="form-grid">'+field('캘린더','<select name="category">'+(categories.some(c=>c.id===e.category)?categories:[...categories,{id:e.category,label:'보관된 분류'}]).map(c=>'<option value="'+esc(c.id)+'" '+(c.id===e.category?'selected':'')+'>'+esc(c.label)+'</option>').join('')+'</select>')+field('진행 상태','<select name="status">'+[['planned','예정'],['progress','진행 중'],['done','완료']].map(([v,l])=>'<option value="'+v+'" '+(e.status===v?'selected':'')+'>'+l+'</option>').join('')+'</select>',false,'id="status-field"')+'</div><div id="extra-fields"></div><div class="form-grid">'+dateTimeField('start','시작',e.allDay?e.start:dateInput(e.start),e.allDay)+dateTimeField('end',e.allDay?'마지막 날짜':'종료',e.allDay?dayKey(shiftDay(atDay(e.end),-1)):dateInput(e.end),e.allDay)+'</div><div class="form-grid tri">'+field('반복','<select name="repeat">'+[['none','반복 안 함'],['daily','매일'],['weekly','매주'],['monthly','매월 같은 날짜'],['yearly','매년 같은 날짜']].map(([v,l])=>'<option value="'+v+'" '+(e.repeat===v?'selected':'')+'>'+l+'</option>').join('')+'</select>')+field('미리 알림','<select name="reminder">'+[[-1,'알림 없음'],[0,'시작할 때'],[10,'10분 전'],[30,'30분 전'],[60,'1시간 전'],[1440,'하루 전']].map(([v,l])=>'<option value="'+v+'" '+(e.reminder===v?'selected':'')+'>'+l+'</option>').join('')+'</select>')+'<label class="form-check compact allday"><input type="checkbox" name="allDay"'+(e.allDay?'checked':'')+'><span class="allday-label">종일<br>일정</span></label></div><div class="field full"><div class="memo-head"><span id="notes-label">메모</span><div class="memo-actions"><button type="button" class="soft" id="checklist-add">'+icon('plus')+'체크박스</button><button type="button" class="soft" id="bullet-add">'+icon('plus')+'목록</button></div></div><div class="memo-box"><textarea name="notes" style="min-height:170px" placeholder="기억할 내용이나 준비할 것을 남겨 주세요.">'+esc(e.notes)+'</textarea><div id="checklist-rows"></div></div></div><div class="field full" id="photo-field"><div class="memo-head"><span>사진</span><div class="memo-actions"><button type="button" class="soft" id="photo-add" title="Ctrl+V로 붙여넣기도 할 수 있어요">'+icon('plus')+'사진 추가</button></div></div><input type="file" id="photo-input" accept="image/*" multiple hidden><div id="photo-grid" class="photo-grid"></div></div><p class="form-note">'+(perOccurrence?'저장하거나 삭제할 때 이 날짜만 바꿀지, 전체 반복을 바꿀지 선택할 수 있어요. ':e.repeat!=='none'?'반복 일정의 수정·삭제는 전체 반복에 적용됩니다. ':'')+(store.isCloud?'':'체험 공간의 알림은 설정만 저장됩니다. 휴대폰으로 발송되지 않습니다.')+'</p><p class="form-error" role="alert"></p></div><div class="dialog-actions"><div class="actions-left">'+(old?'<button type="button" class="danger" id="delete-event">'+icon('trash')+'삭제</button>':'')+'<span class="private-label">나만 보는 기록</span>'+'</div><button type="button" data-close class="soft">닫기</button><button type="submit" class="primary">'+icon('check')+'저장하기</button></div></form>';
 const form=$('#event-form');let draftDetails={...(e.details||{})};
 function extras(){
  form.querySelectorAll('[data-detail]').forEach(x=>draftDetails[x.dataset.detail]=x.value);
  const module=registry.get(form.category.value),active=Boolean(module);
  $('#notes-label').textContent='메모';
  form.elements.namedItem('title').placeholder='어떤 기록을 남길까요?';


  if(active&&module.renderEditor){module.renderEditor($('#extra-fields'),draftDetails);return;}
  const fields=active?module.fields:[];
  $('#extra-fields').innerHTML=fields.length?'<div class="extra-fields"><div class="extra-label">'+icon(module.icon)+esc(module.label)+' 상세</div><div class="form-grid">'+fields.map(f=>field(esc(f.label),'<input data-detail="'+esc(f.key)+'" type="'+(f.type||'text')+'" '+(f.type==='number'?'min="0"':'')+' placeholder="'+esc(f.placeholder||'')+'" value="'+esc(draftDetails[f.key]??'')+'">')).join('')+'</div></div>':'';
 }
 extras();form.category.addEventListener('change',extras);
 bindDateTimes(form);
 // Plain-text markdown-lite prefixes ("- [ ] ", "- ") — a real WYSIWYG editor would mean storing
 // HTML and re-escaping it everywhere notes is shown; this stays inside the existing plain-text field.
 let draftChecklist=(e.checklist||[]).map(x=>({...x}));
 function renderChecklistRows(){
  const host=$('#checklist-rows');if(!host)return;
  host.innerHTML=draftChecklist.map((item,i)=>'<div class="memo-row">'+(item.kind==='bullet'?'<span class="bullet-dot">•</span>':'<input type="checkbox" data-check-idx="'+i+'" '+(item.done?'checked':'')+'>')+'<input type="text" data-check-text="'+i+'" placeholder="'+(item.kind==='bullet'?'내용':'할 일')+'" value="'+esc(item.text)+'"><button type="button" class="icon-btn" data-check-del="'+i+'" aria-label="삭제">'+icon('close')+'</button></div>').join('');
  host.querySelectorAll('[data-check-idx]').forEach(cb=>cb.onchange=()=>{draftChecklist[Number(cb.dataset.checkIdx)].done=cb.checked;});
  host.querySelectorAll('[data-check-text]').forEach(inp=>inp.oninput=()=>{draftChecklist[Number(inp.dataset.checkText)].text=inp.value;});
  host.querySelectorAll('[data-check-del]').forEach(b=>b.onclick=()=>{draftChecklist.splice(Number(b.dataset.checkDel),1);renderChecklistRows();});
 }
 renderChecklistRows();
 const addChecklistRow=kind=>{draftChecklist.push({text:'',done:false,kind});renderChecklistRows();const inputs=document.querySelectorAll('[data-check-text]');inputs[inputs.length-1]?.focus();};
 $('#checklist-add').onclick=()=>addChecklistRow('check');
 $('#bullet-add').onclick=()=>addChecklistRow('bullet');
 // A saved (existing) cloud event uploads/deletes photos immediately, independent of 저장하기 —
 // there is already an event doc to attach to. A brand-new cloud event has none yet, so its photos
 // are staged locally (pendingUpload) and only actually uploaded right after the first save succeeds.
 let draftPhotos=(e.photos||[]).map(x=>({...x}));
 let currentRevision=old?.revision||0;
 function compressImageFile(file){
  return new Promise((resolve,reject)=>{
   const img=new Image(),reader=new FileReader();
   reader.onerror=()=>reject(Error('이미지를 읽지 못했습니다.'));
   reader.onload=()=>{
    img.onerror=()=>reject(Error('이미지를 열지 못했습니다.'));
    img.onload=()=>{
     const maxDim=1600;let w=img.width,h=img.height;
     if(w>maxDim||h>maxDim){if(w>h){h=Math.round(h*maxDim/w);w=maxDim;}else{w=Math.round(w*maxDim/h);h=maxDim;}}
     const c=document.createElement('canvas');c.width=w;c.height=h;
     c.getContext('2d').drawImage(img,0,0,w,h);
     resolve(c.toDataURL('image/jpeg',0.82));
    };
    img.src=reader.result;
   };
   reader.readAsDataURL(file);
  });
 }
 function renderPhotoGrid(){
  const host=$('#photo-grid');if(!host)return;
  host.innerHTML=draftPhotos.map((p,i)=>'<div class="photo-tile"><img src="'+esc(p.url)+'" alt="사진" data-photo-open="'+i+'">'+(p.uploading?'<span class="photo-spin" aria-hidden="true"></span>':'<button type="button" class="photo-del" data-photo-del="'+esc(p.id)+'" aria-label="삭제">'+icon('close')+'</button>')+'</div>').join('');
  host.querySelectorAll('[data-photo-open]').forEach(img=>img.onclick=()=>openPhotoViewer(draftPhotos,Number(img.dataset.photoOpen)));
  host.querySelectorAll('[data-photo-del]').forEach(b=>b.onclick=()=>removePhoto(b.dataset.photoDel));
  const addBtn=$('#photo-add');if(addBtn)addBtn.hidden=draftPhotos.length>=MAX_PHOTOS;
 }
 async function addPhotoFiles(files){
  const room=MAX_PHOTOS-draftPhotos.length;
  if(room<=0){toast('사진은 최대 '+MAX_PHOTOS+'장까지 첨부할 수 있습니다.');return;}
  for(const file of files.slice(0,room)){
   if(!file.type.startsWith('image/')){toast('이미지 파일만 추가할 수 있어요.');continue;}
   if(file.size>20*1024*1024){toast('사진 용량이 너무 큽니다. (최대 20MB)');continue;}
   let dataUrl;try{dataUrl=await compressImageFile(file);}catch(err){toast(err.message);continue;}
   if(!store.isCloud){draftPhotos.push({id:newId(),url:dataUrl,createdAt:Date.now()});renderPhotoGrid();continue;}
   if(!old){
    // No event doc to attach to yet — stage it and upload right after the first save succeeds.
    draftPhotos.push({id:'pending:'+newId(),url:dataUrl,createdAt:Date.now(),pendingUpload:true});
    renderPhotoGrid();continue;
   }
   const tempId='pending:'+newId();
   draftPhotos.push({id:tempId,url:dataUrl,createdAt:Date.now(),uploading:true});renderPhotoGrid();
   try{
    const base64=dataUrl.slice(dataUrl.indexOf(',')+1);
    const {event,photo}=await store.uploadPhoto(old.id,base64,'image/jpeg');
    currentRevision=event.revision;
    const idx=draftPhotos.findIndex(p=>p.id===tempId);if(idx>-1)draftPhotos[idx]={...photo};
   }catch(err){
    draftPhotos=draftPhotos.filter(p=>p.id!==tempId);
    toast(err.message||'사진을 올리지 못했습니다.');
   }
   renderPhotoGrid();
  }
 }
 async function removePhoto(photoId){
  const target=draftPhotos.find(p=>p.id===photoId);
  draftPhotos=draftPhotos.filter(p=>p.id!==photoId);renderPhotoGrid();
  if(!target||target.uploading||target.pendingUpload||!store.isCloud||!old)return;
  try{const {event}=await store.deletePhoto(old.id,photoId);currentRevision=event.revision;}
  catch(err){draftPhotos=[...draftPhotos,target];renderPhotoGrid();toast(err.message||'사진을 지우지 못했습니다.');}
 }
 // A brand-new cloud event's staged photos have no event doc to belong to until the main save below
 // succeeds; this uploads them right after, using the id/revision the save just returned.
 async function flushPendingPhotos(savedEvent){
  const pending=draftPhotos.filter(p=>p.pendingUpload);
  for(const p of pending){
   try{
    const base64=p.url.slice(p.url.indexOf(',')+1);
    const {event}=await store.uploadPhoto(savedEvent.id,base64,'image/jpeg');
    currentRevision=event.revision;
   }catch(err){toast('사진 일부를 올리지 못했습니다: '+(err.message||''));}
  }
 }
 $('#photo-add').onclick=()=>$('#photo-input').click();
 $('#photo-input').onchange=ev=>{const files=[...ev.target.files];ev.target.value='';if(files.length)addPhotoFiles(files);};
 // Clipboard image paste (screenshot tools, copied images) anywhere in the form — skipped for
 // Leave the clipboard alone when it has no image so normal
 // text paste into the title/notes/address fields keeps working.
 form.addEventListener('paste',ev=>{

  const files=[...(ev.clipboardData?.items||[])].filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
  if(!files.length)return;
  ev.preventDefault();addPhotoFiles(files);
 });
 renderPhotoGrid();
 d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
 if(old)$('#delete-event').onclick=async()=>{
  let scope='all';
  if(perOccurrence){
   scope=await chooseScope('삭제 범위를 선택해 주세요.','반복 일정 중 이 날짜만 지울지, 전체 반복을 지울지 골라 주세요.',[{value:'one',label:'이 날짜만'},{value:'all',label:'전체 반복',cls:'danger'}]);
   if(!scope)return;
  } else if(!await ask('일정을 삭제할까요?',e.repeat!=='none'?'이 일정의 전체 반복이 삭제됩니다. 삭제 후 백업 또는 휴지통에서 복원할 수 있습니다.':'삭제된 일정은 휴지통에서 복원할 수 있습니다.','삭제')){
   return;
  }
  try{
   if(scope==='one'){await store.save({...old,exceptions:{...(old.exceptions||{}),[anchor]:{deletedAt:Date.now()}}},currentRevision);}
   else await store.remove({...old,revision:currentRevision});
   d.close();toast(scope==='one'?'이 날짜만 휴지통으로 옮겼습니다. 다른 날짜의 반복은 유지됩니다.':'일정을 휴지통으로 옮겼습니다.');
  }catch(err){if(err.queued){d.close();toast(err.message);}else $('.form-error').textContent=err.message;}
 };
 form.addEventListener('submit',async ev=>{
  ev.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{
   form.querySelectorAll('[data-detail]').forEach(x=>draftDetails[x.dataset.detail]=x.value);
   const allDay=form.allDay.checked;
   const fields={title:form.elements.namedItem('title').value,category:form.category.value,module:form.category.value===e.category?e.module:(registry.get(form.category.value)?form.category.value:'personal'),status:form.status.value,repeat:form.repeat.value,reminder:Number(form.reminder.value),allDay,start:allDay?form.start.value:new Date(form.start.value).toISOString(),end:allDay?dayKey(shiftDay(atDay(form.end.value),1)):new Date(form.end.value).toISOString(),notes:form.notes.value,location:e.location||'',details:draftDetails,checklist:draftChecklist.filter(x=>x.text.trim()).map(x=>({text:x.text.trim(),done:!!x.done,kind:x.kind})),photos:draftPhotos.filter(p=>!p.uploading&&!p.pendingUpload).map(p=>({id:p.id,url:p.url,createdAt:p.createdAt})),visibility:'personal'};
   let scope='all';
   if(perOccurrence){
    scope=await chooseScope('저장 범위를 선택해 주세요.','반복 일정 중 이 날짜만 바꿀지, 전체 반복을 바꿀지 골라 주세요.',[{value:'one',label:'이 날짜만'},{value:'all',label:'전체 반복'}]);
    if(!scope){submit.disabled=false;return;}
   }
   let saved;
   // A single-occurrence edit only overrides content (title/notes/location/status/reminder), not
   // the time — moving one instance of a series is a later refinement (see docs).
   if(scope==='one'){saved=await store.save({...old,visibility:'personal',exceptions:{...(old.exceptions||{}),[anchor]:{title:fields.title,notes:fields.notes,location:fields.location,status:fields.status,reminder:fields.reminder}}},currentRevision);}
   else saved=await store.save({...e,...fields,demo:old?.demo||false},currentRevision);
   d.close();toast(saved?.pendingSync?'오프라인 상태입니다. 온라인이 되면 자동으로 저장됩니다.':scope==='one'?'이 날짜만 저장했습니다.':'일정을 저장했습니다.');
   if(!old&&store.isCloud&&saved?.id&&!saved.pendingSync)await flushPendingPhotos(saved);
  }catch(err){if(err.queued){d.close();toast(err.message);}else $('.form-error').textContent=err.message;}
  finally{submit.disabled=false;}
 });
 d.showModal();setTimeout(()=>form.elements.namedItem('title').focus(),30);
}
function feedStatusText(feed=investmentFeed){
 const state=feed.state;
 if(state.status==='ready'||state.status==='partial')return feed.events.filter(e=>e.calendarVisible!==false).length+'건 · '+new Date(state.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' 갱신'+(state.status==='partial'?' · '+state.error:'');
 return ({idle:'연결 준비 중',loading:'기록 불러오는 중…',error:'가져오기 실패 · '+(state.updatedAt?'이전 기록 표시 중':'연결 확인 필요'),disabled:'연결 꺼짐',local:'체험 공간 · 클라우드에서 연결',unavailable:'연결 모듈을 불러오지 못했어요'})[state.status]||'';
}
function paintFeedState(){
 const host=$('#feed-state');if(!host)return;
 host.innerHTML='<span>'+icon('link')+'투자 기록·검증</span><small>기록보관실 · '+esc(feedStatusText())+'</small><small>예측 · '+esc(feedStatusText(predictionFeed))+'</small><button class="feed-refresh" aria-label="투자 기록 새로고침">'+icon('download')+'새로고침</button>';
 host.dataset.state=[investmentFeed,predictionFeed].some(f=>['error','partial'].includes(f.state.status))?'error':investmentFeed.state.status;host.querySelector('button').onclick=loadInvestmentFeed;
}
async function loadInvestmentFeed(){return Promise.allSettled([
 investmentFeed.reload(store,registry.get('investment')?.readFeed,{enabled:enabled('investment')}),
 predictionFeed.reload(store,s=>s.request('/prediction-feed'),{enabled:enabled('predictions')})
]);}
function startFeedPolling(){clearInterval(feedTimer);loadInvestmentFeed().then(openInvestmentFromQuery);if(store.isCloud)feedTimer=setInterval(()=>{if(!document.hidden)loadInvestmentFeed();},30000);}
function renderBlocks(){
 const card=(id,title,description,feed,url)=>'<article class="block-card" style="--cat:#378e86;--tint:#edf7f4"><div class="block-icon">'+icon('chart')+'</div><h3>'+title+'</h3><p>'+description+'</p><p class="connection-status">'+esc(feedStatusText(feed))+'</p>'+(['error','partial'].includes(feed.state.status)?'<p class="form-error">'+esc(feed.state.error)+'</p>':'')+'<div class="row-actions"><a class="soft archive-link" href="'+esc(url)+'" target="_blank" rel="noopener">원본 열기 ↗</a><button class="soft" data-refresh-feed>새로고침</button></div><div class="block-bottom"><span>필요한 연결만 켜 두세요</span><button role="switch" aria-checked="'+enabled(id)+'" aria-label="'+title+' 연결" class="switch" data-toggle-feed="'+id+'"></button></div></article>';
 $('#content').innerHTML='<div class="block-page"><div class="blocks-intro"><div>'+icon('chart')+'</div><div><strong>날짜를 따라 보는 투자와 기록</strong><p>기록을 읽고, 예상과 결과를 확인하고, 필요한 때 다시 살펴봅니다.</p></div></div><div class="block-grid"><article class="block-card" style="--cat:#8a829e;--tint:#f5f0fa"><div class="block-icon">'+icon('list')+'</div><h3>나의 기록</h3><p>메모·관찰·학습·복기를 남기고 사진과 체크리스트를 함께 보관합니다.</p><div class="block-bottom"><span>나만 보는 기록</span><span class="pill">사용 중</span></div></article>'+card('investment','투자 기록보관실','기록 날짜와 최신 확인·복기를 연결합니다. 확인 날짜·상태·결과를 어느 화면에서 바꿔도 같은 원본에 저장합니다.',investmentFeed,config.investmentArchiveUrl)+card('predictions','예측 검증','유튜브 예측의 기한·판정·근거를 함께 관리합니다. 투자 예측은 자동 채점 원본의 날짜와 결과를 가져옵니다.',predictionFeed,config.youtubeUrl)+'</div><p class="blocks-legend">연결을 꺼도 원본과 직접 남긴 기록은 유지됩니다. 화면 연결을 끄는 것과 알림 예약 취소는 별개입니다.</p></div>';
 document.querySelectorAll('[data-refresh-feed]').forEach(b=>b.onclick=loadInvestmentFeed);
 document.querySelectorAll('[data-toggle-feed]').forEach(b=>b.onclick=async()=>{const id=b.dataset.toggleFeed;b.disabled=true;try{const next=enabled(id)?[...disabled,id]:disabled.filter(x=>x!==id);await store.setMeta('disabled',next);disabled=next;await loadInvestmentFeed();}catch(e){b.disabled=false;toast(e.message);}});
}
function openArchivedRecord(record){
 const d=$('#editor');d.innerHTML='<div class="dialog-head"><h2 id="editor-title">이전 분류 기록</h2><button data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body"><h3>'+esc(record.title)+'</h3><p class="form-note">'+esc(timeLabel(record))+' · '+esc(record.start.slice(0,10))+(record.deletedAt?' · 휴지통':'')+'</p><p style="white-space:pre-wrap">'+esc(record.notes||'메모 없음')+'</p><div class="archive-details">'+Object.entries(record.details||{}).filter(([,v])=>v!==''&&v!==null).map(([k,v])=>'<p><span>'+esc(k)+'</span> '+esc(v)+'</p>').join('')+'</div><p class="form-note">이 기록은 이전 분류에 보관되어 있습니다. 전체 백업에 원본 상세와 첨부 정보가 포함됩니다.</p></div><div class="dialog-actions"><button class="soft" id="archive-back">보관 목록</button><button class="primary" data-close>닫기</button></div>';
 d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());$('#archive-back').onclick=()=>{d.close();showArchivedRecords();};d.showModal();
}
function showArchivedRecords(){
 const d=$('#settings'),list=archivedEvents();
 d.innerHTML='<div class="dialog-head"><h2 id="settings-title">이전 분류 기록</h2><button data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body"><p class="form-note">현재 캘린더에서 제외한 이전 분류의 기록입니다. 삭제하지 않고 그대로 보관합니다.</p>'+list.map(e=>'<button class="archive-row" data-archived="'+esc(e.id)+'"><strong>'+esc(e.title)+'</strong><small>'+esc(e.start.slice(0,10))+(e.deletedAt?' · 휴지통':'')+'</small></button>').join('')+'</div><div class="dialog-actions"><button class="primary" data-close>닫기</button></div>';
 d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.querySelectorAll('[data-archived]').forEach(b=>b.onclick=()=>{d.close();openArchivedRecord(events.find(e=>e.id===b.dataset.archived));});d.showModal();
}
function renderInbox(){
 const reminders=expandEvents(events.filter(e=>!isArchivedEvent(e)&&!e.deletedAt&&e.reminder>=0&&e.status!=='done'),new Date(),shiftDay(new Date(),14)).sort((a,b)=>a.start.localeCompare(b.start));
 $('#content').innerHTML='<div class="block-page"><p class="form-note" style="margin-bottom:18px">아래는 다가오는 알림 예약입니다. 실제 발송 내역은 위 상태 패널에서 확인하세요.</p><div class="side-heading"><span>앞으로 2주 · 알림이 설정된 일정</span><span>'+reminders.length+'건</span></div>'+reminders.map(e=>'<div class="inbox-item" style="--cat:'+color(e)+';--tint:'+color(e)+'12"><div class="block-icon">'+icon('bell')+'</div><div><strong>'+esc(e.title)+'</strong><p>'+new Date(e.start).toLocaleDateString('ko-KR',{month:'long',day:'numeric'})+' · '+esc(timeLabel(e))+'<br>'+(e.reminder===0?'시작할 때':e.reminder+'분 전')+' 알림 · '+(store.isCloud?'예약 설정':'연결 대기')+'</p></div><button data-open="'+esc(e.id)+'" data-anchor="'+esc(occurrenceAnchor(e.occurrenceId)||'')+'">'+icon('chevron')+'</button></div>').join('')+(!reminders.length?'<div class="empty">'+icon('bell')+'<p>다가오는 알림이 없습니다.</p></div>':'')+'</div>';
 const panel=document.createElement('div');panel.id='push-panel';$('#content .block-page').prepend(panel);import('./notifications.js').then(m=>m.mountNotifications(panel,store,()=>store.isCloud?enablePush():openSettings())).catch(e=>{panel.textContent='알림 상태를 불러오지 못했습니다: '+e.message;});
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const r=findAnyEvent(b.dataset.open);r?.readOnly?openReadOnlyRecord(r):openEditor(b.dataset.open,{},b.dataset.anchor||null);});
}
async function acknowledgePush(){if(!store.isCloud)return;try{const {confirmNotificationOpen}=await import('./notifications.js');await confirmNotificationOpen(store);}catch(e){toast('알림 열기 확인을 저장하지 못했습니다. 앱을 다시 열면 재시도합니다.');}}

async function enablePush(){try{const {subscribePush}=await import('./cloud.js');await subscribePush(store);toast('이 기기를 알림 수신 기기로 등록했습니다.');}catch(e){toast(e.message);}}
function openSettings(){
 const d=$('#settings');
 d.innerHTML='<div class="dialog-head"><h2 id="settings-title">나의 캘린더 설정</h2><button data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body"><div class="notice"><strong>'+stateLabel()+'</strong><br>'+(store.isCloud?'로그인한 공간의 일정과 연결되어 있습니다.':'체험 데이터는 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우기 전 백업해 주세요. 실제 알림은 클라우드에 연결한 뒤 사용할 수 있습니다.')+'</div><div class="settings-row"><div><strong>내 계정 연결</strong><p>'+(config.apiBase?'설정된 전용 서버에 로그인합니다.':'전용 서버 배포와 계정 연결이 필요합니다.')+'</p></div><button class="soft" id="cloud-login" '+(!config.apiBase?'disabled':'')+'>연결</button></div>'+'<div class="settings-row"><div><strong>홈 화면에 설치</strong><p>휴대폰에서는 브라우저 메뉴의 ‘홈 화면에 추가’를 사용하세요.</p></div><button class="soft" id="install" '+(!installEvent?'disabled':'')+'>설치</button></div><div class="settings-group"><h3>데이터 관리</h3><div class="settings-row"><div><strong>캘린더 백업 가져오기</strong><p>달님 캘린더에서 내보낸 JSON을 가져옵니다.</p></div><button class="soft" data-setting="import">'+icon('upload')+'가져오기</button></div><div class="settings-row"><div><strong>전체 기록 백업</strong><p>삭제한 일정과 상세 항목을 포함해 내보냅니다.</p></div><button class="soft" data-setting="export">'+icon('download')+'내보내기</button></div><div class="settings-row"><div><strong>캘린더 관리</strong><p>분류를 추가하거나 이름을 바꿀 수 있습니다.</p></div><button class="soft" data-setting="categories">관리</button></div><div class="settings-row"><div><strong>휴지통</strong><p>삭제된 일정 '+events.filter(e=>!isArchivedEvent(e)&&e.deletedAt).length+'개</p></div><button class="soft" data-setting="trash">열기</button></div>'+(archivedEvents().length?'<div class="settings-row"><div><strong>이전 분류 기록</strong><p>'+archivedEvents().length+'개 보관 중 · 전체 백업에 포함</p></div><button class="soft" data-setting="archive">보기</button></div>':'')+'<div class="settings-row"><div><strong>인쇄</strong><p>현재 캘린더 화면을 출력합니다.</p></div><button class="soft" data-setting="print">'+icon('print')+'인쇄</button></div></div><details class="settings-group"><summary class="quiet small">앱 상태 · 버전 '+config.version+'</summary><p class="form-note">저장소: '+(store.isCloud?'클라우드':'이 기기')+'<br>전체 일정: '+events.length+'개<br>불러온 블록: '+registry.list().length+'개<br>블록 오류: '+registry.errors.length+'개<br>마지막 화면 갱신: '+new Date().toLocaleString('ko-KR')+'</p></details></div><div class="dialog-actions"><button class="primary" data-close>완료</button></div>';
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
 d.querySelectorAll('[data-cat-delete]').forEach(b=>b.onclick=async()=>{const id=b.dataset.catDelete;if([...events,...investmentEvents].some(e=>!e.deletedAt&&e.category===id)){toast('일정이 있어 삭제할 수 없습니다. 먼저 일정을 옮겨 주세요.');return;}if(['personal','investment'].includes(id)){toast('기본 캘린더는 유지됩니다.');return;}categories=categories.filter(c=>c.id!==id);await persistCategories();d.close();manageCategories();paintCategories();});
 $('#add-category').onclick=async()=>{categories.push({id:newId(),label:'새 캘린더',color:'#607cbb'});await persistCategories();d.close();manageCategories();};
 $('#save-categories').onclick=async()=>{for(const c of categories){c.label=d.querySelector('[data-cat-name="'+c.id+'"]').value.trim()||c.label;c.color=d.querySelector('[data-cat-color="'+c.id+'"]').value;}await persistCategories();d.close();paintCategories();refreshCalendar();toast('캘린더 구성을 저장했습니다.');};d.showModal();
}

function trash(){
 const d=$('#settings'),deleted=events.filter(e=>!isArchivedEvent(e)&&e.deletedAt);
 d.innerHTML='<div class="dialog-head"><h2 id="settings-title">휴지통</h2><button data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body">'+deleted.map(e=>'<div class="settings-row"><strong>'+esc(e.title)+'</strong><button class="soft" data-restore="'+esc(e.id)+'">복원</button></div>').join('')+(!deleted.length?'<p class="empty">휴지통이 비어 있습니다.</p>':'')+'</div>';d.querySelector('[data-close]').onclick=()=>d.close();d.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{try{const e=events.find(x=>x.id===b.dataset.restore);await store.save({...e,deletedAt:null},e.revision);await refresh();d.close();trash();toast('일정을 복원했습니다.');}catch(e){toast(e.message);}});d.showModal();
}
async function importFile(event){
 const file=event.target.files[0];if(!file)return;
 try{if(file.size>10*1024*1024)throw Error('10MB 이하 JSON 파일을 선택해 주세요.');const mapped=calendarBackupRecords(JSON.parse(await file.text()));
  if(!mapped.length)throw Error('가져올 기록이 없습니다.');
  if(await ask('기록 '+mapped.length+'개를 가져올까요?','같은 ID의 기록은 건너뜁니다. 이전 분류의 기록은 보관 목록에 표시합니다.','가져오기')){const n=await store.import(mapped);toast(n+'개를 가져왔습니다.');}
 }catch(e){toast(e.message);}finally{event.target.value='';}
}
async function cloudLogin(){
 const d=$('#settings');
 d.innerHTML='<form id="login-form"><div class="dialog-head"><h2 id="settings-title">내 공간 로그인</h2><button type="button" data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body"><p class="notice">본인 계정으로 로그인해 투자와 기록을 이어서 보세요.</p><input name="workspace" type="hidden" value="'+esc(config.workspaceId)+'"><button type="button" class="primary" id="google-login" style="width:100%">Google 계정으로 계속</button><details class="settings-group"><summary class="quiet small">이메일과 비밀번호로 로그인</summary><div class="form-grid" style="margin-top:16px"><label class="field full">이메일<input name="email" type="email" autocomplete="username"></label><label class="field full">비밀번호<input name="password" type="password" autocomplete="current-password"></label></div><button class="soft" type="submit" style="margin-top:16px">이메일로 로그인</button></details><p class="form-note">등록된 본인 계정으로 연결해 주세요.</p><p class="form-error" role="alert"></p></div></form>';
 const form=d.querySelector('form');d.querySelector('[data-close]').onclick=()=>d.close();
 async function connect(kind){
  const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{const {CloudStore}=await import('./cloud.js');const live=new CloudStore(config);const space=form.workspace.value.trim();
   if(!space)throw Error('공간 ID를 입력해 주세요.');
   if(kind==='google')await live.loginGoogle(space);else {if(!form.email.value||!form.password.value)throw Error('이메일과 비밀번호를 입력해 주세요.');await live.login(form.email.value,form.password.value,space);}
   if(!store){location.reload();return;}
   store=live;setCategories(await store.meta('categories',baseCategories));disabled=await store.meta('disabled',[]);await refresh();store.subscribe(refresh);d.close();shell();$('#banner-label').textContent='클라우드 공간 · 실제 계정 데이터';$('[data-action=clear-demo]').hidden=true;toast('내 기록에 연결되었습니다.');startFeedPolling();const target=new URLSearchParams(location.search).get('event');if(target)openEditor(target);await acknowledgePush();
  }catch(err){d.querySelector('.form-error').textContent=err.code==='auth/popup-closed-by-user'?'로그인 창을 닫았습니다. 다시 눌러 연결할 수 있어요.':err.message;}finally{buttons.forEach(b=>b.disabled=false);}
 }
 form.onsubmit=e=>{e.preventDefault();connect('email');};$('#google-login').onclick=()=>connect('google');d.showModal();
}

async function action(name){
 if(['calendar','agenda','blocks','inbox'].includes(name)){navigate(name);return;}
 if(name==='add')openEditor();
 if(name==='settings')openSettings();
 if(name==='menu')$('.sidebar').classList.toggle('open');
 if(name==='categories')manageCategories();
 if(name==='trash')trash();
 if(name==='archive')showArchivedRecords();
 if(name==='export')download('dalnim-backup-'+dayKey()+'.json',JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),events,categories:mergeCategories(savedCategories,categories)},null,2));
 if(name==='import')$('#import-file').click();
 if(name==='print'){if(page!=='calendar'&&page!=='agenda')navigate('calendar');setTimeout(()=>window.print(),100);}
 if(name==='clear-demo'&&await ask('예시 일정을 지울까요?','직접 만든 일정은 유지되고 예시 일정만 휴지통으로 옮겨집니다.','예시 지우기')){for(const e of events.filter(e=>e.demo&&!e.deletedAt))await store.remove(e);toast('예시 일정을 지웠습니다.');}
}
async function refresh(){events=await store.list();if($('#store-state'))$('#store-state').innerHTML=icon('check')+stateLabel();paintCategories();if(page==='blocks')renderBlocks();else if(page==='inbox')renderInbox();else refreshCalendar();}
async function init(){

 if(config.apiBase){
  if(localStorage.getItem('dalnim-session')){try{const {CloudStore}=await import('./cloud.js');store=await new CloudStore(config).restore();}catch(err){toast('서버 연결을 확인하고 다시 로그인해 주세요.');}}
  if(!store){
   $('#app').innerHTML='<main class="welcome-gate"><img src="./icon.svg" alt="달님"><p class="eyebrow">YOUR DAYS, CONNECTED</p><h1>오늘도, 나의 달님</h1><p>투자와 기록을 날짜로 연결하는 나만의 캘린더.<br>로그인하면 모든 기기에서 같은 기록을 만나요.</p><button class="primary" id="open-login">내 캘린더 열기</button><a class="system-home-link welcome-home" href="'+esc(config.systemHomeUrl)+'" target="_top" aria-label="나의 시스템 · 인생 6대축 홈">'+icon('home')+'<span>6대축 홈으로</span></a><small>일정은 전용 Firebase 서버에 안전하게 저장됩니다.</small></main>';
   $('#open-login').onclick=()=>cloudLogin();
   if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
   return;
  }
 }else store=await new LocalStore().init();
 await registry.load(config.modules);setCategories(await store.meta('categories',baseCategories));disabled=await store.meta('disabled',[]);events=await store.list();
 if(!store.isCloud&&!await store.meta('seeded',false)){await store.import(demoEvents());await store.setMeta('seeded',true);events=await store.list();}
 shell();if(store.isCloud){$('#banner-label').textContent='클라우드 공간 · 실제 계정 데이터';$('[data-action=clear-demo]').hidden=true;}store.subscribe(refresh);

 startFeedPolling();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadInvestmentFeed();});
 window.addEventListener('unhandledrejection',e=>{console.error(e.reason);toast(e.reason?.message||'처리하지 못했습니다. 다시 시도해 주세요.');});
 document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.key==='/'){e.preventDefault();$('#search').focus();}if(e.key==='n'||e.key==='N')openEditor();if(e.key==='t'||e.key==='T')calendar?.today();});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;});
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>console.warn('Service worker unavailable',e));
 const id=new URLSearchParams(location.search).get('event');if(id)openEditor(id);await acknowledgePush();
 window.Dalnim={version:config.version,openEvent:openEditor,getStatus:()=>({mode:store.isCloud?'cloud':'local',modules:registry.list().map(m=>m.id),errors:registry.errors})};
}
init().catch(e=>{$('#app').innerHTML='<div class="boot"><h2>캘린더를 열지 못했어요</h2><p>'+esc(e.message)+'</p><p>브라우저의 저장 공간과 사이트 권한을 확인해 주세요.</p><button onclick="location.reload()">다시 열기</button></div>';console.error(e);});


