(()=>{
'use strict';
const $g=id=>document.getElementById(id);
const style=document.createElement('style');
style.textContent=`
#scannerFields{margin-top:2px}
#scannerFields .sf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px}
.sf-field{position:relative;margin:0;min-width:0}.sf-labelrow{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px}
.sf-labelrow label{margin:0!important;font-size:12px;font-weight:700;color:#6e6e73}
.sf-editrow{display:none;justify-content:flex-end;margin-top:6px}.sf-field.sf-active .sf-editrow{display:flex}
.sf-edit{border:0;border-radius:999px;background:#e8effb;color:#2354a0;padding:6px 10px;font-size:11px;font-weight:800;min-height:30px}
#scannerFields select,#scannerFields input,#fDateField input{box-sizing:border-box;width:100%;min-width:0;height:46px;border:0;border-radius:12px;background:rgba(118,118,128,.10);padding:0 12px;font-size:16px;color:inherit}
#tagChoices{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}#tagChoices button{border:0;border-radius:999px;padding:7px 10px;background:#edf2f8;color:#405069;font-weight:700}#tagChoices button.active{background:#2563eb;color:#fff}
#listSync{display:block;margin-top:8px;font-size:11px;color:#8e8e93}#listRetry{margin-top:6px;border:0;border-radius:9px;padding:7px 10px;background:#edf2f8;color:#2354a0;font-weight:700}
#listOv{display:none;position:fixed;inset:0;background:#0008;z-index:15000;align-items:center;justify-content:center;padding:12px}#listOv.show{display:flex}#listOv .lm{background:#fff;color:#172235;width:min(540px,100%);max-height:90dvh;overflow:auto;border-radius:20px;padding:16px}#listOv .lmh,#listOv .lmf{display:flex;align-items:center;justify-content:space-between;gap:8px}.lmh{margin-bottom:10px}.lmh button,.lmf button,#listAdd{border:0;border-radius:10px;min-height:42px;padding:8px 12px;font-weight:750}.lmf{margin-top:12px}.lmf .blue,#listAdd{background:#2563eb;color:#fff}.listEditRow{display:flex;gap:8px;margin:8px 0}.listEditRow input,#listNew{flex:1;min-width:0;border:1px solid #d7dee8;border-radius:10px;padding:10px;font-size:16px}.listEditRow button{border:0;border-radius:9px;padding:8px 10px;color:#b91c1c}.listNewRow{display:flex;gap:8px;margin-top:12px}#listError{color:#b91c1c;font-size:12px;min-height:18px}
#scannerPhotoFrame{position:fixed;inset:0;width:100%;height:100dvh;border:0;z-index:20000;background:#0b111b}
#addOverlay .modal{width:min(720px,calc(100vw - 24px));max-width:720px}
@media(max-width:420px){#scannerFields .sf-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#scannerFields select,#scannerFields input,#fDateField input{height:44px;padding:0 9px;font-size:15px}.sf-edit{font-size:10px;padding:5px 8px}}
`;
document.head.appendChild(style);
const field=(kind,label,id,control)=>`<div class="field sf-field" data-sf-kind="${kind}"><div class="sf-labelrow"><label for="${id}">${label}</label></div>${control}<div class="sf-editrow"><button type="button" class="sf-edit" data-edit-kind="${kind}">목록 편집</button></div></div>`;
/* 구분/상태/위치/태그를 한 그리드에 두면 2열로 자동 배치된다 — [구분|상태][위치|태그].
   날짜(fDate, 기존 base HTML 필드)를 이 그리드로 옮기고 시간을 이어 붙이면 [날짜|시간]까지 같은 방식으로 맞춰진다. */
const panel=document.createElement('div');
panel.id='scannerFields';
panel.innerHTML=`<div class="sf-grid">${field('scope','구분','sfScope','<select id="sfScope"></select>')}${field('status','상태','sfStatus','<select id="sfStatus"></select>')}${field('location','위치','sfLocation','<select id="sfLocation"></select>')}${field('tags','태그','sfTags','<div id="tagChoices"></div><input id="sfTags" placeholder="태그 선택 또는 쉼표로 입력">')}</div><span id="listSync"></span><button id="listRetry" type="button" hidden>동기화 재시도</button>`;
(($g('afTitleMemoRow'))||$g('fMemo')?.closest('.field'))?.after(panel);
const sfGrid=panel.querySelector('.sf-grid');
const dateField=$g('fDateField');
if(dateField&&sfGrid){ dateField.classList.add('sf-field'); sfGrid.appendChild(dateField); }
if(sfGrid){
  const timeField=document.createElement('div');
  timeField.id='sfTimeField';
  timeField.className='field sf-field';
  timeField.innerHTML='<div class="sf-labelrow"><label for="sfTime">시간</label></div><input type="time" id="sfTime">';
  sfGrid.appendChild(timeField);
}
const modal=document.createElement('div');modal.innerHTML=`<div id="listOv"><div class="lm"><div class="lmh"><b id="listTitle">목록 편집</b><button id="listClose">✕</button></div><div id="listRows"></div><div class="listNewRow"><input id="listNew" maxlength="80" placeholder="새 항목"><button id="listAdd">추가</button></div><div id="listError"></div><div class="lmf"><button id="listCancel">취소</button><button id="listSave" class="blue">저장</button></div></div></div>`;document.body.appendChild(modal);
const LIST_KEY='fieldCards.optionLists.v2',NAMES={scope:'구분',status:'상태',location:'위치',tags:'태그'},FIELDS={scope:'sfScope',status:'sfStatus',location:'sfLocation',tags:'sfTags'};
const mk=(label,id)=>(id?{id,label}:{id:uid(),label});
/* 위치 기본값 — 옥탑 → 20층…1층 → 지하1층…지하6층, 문자순 정렬 금지(요청 순서 그대로 유지) */
const LOCATION_DEFAULT=['옥탑',...Array.from({length:20},(_,i)=>(20-i)+'층'),...Array.from({length:6},(_,i)=>'지하'+(i+1)+'층')];
const defaults={scope:[mk('업무'),mk('개인')],status:['발견','점검 필요','작업 중','완료'].map(v=>mk(v)),location:LOCATION_DEFAULT.map(v=>mk(v)),tags:[]};
let lists=JSON.parse(JSON.stringify(defaults)),pending={},listRef=null,kind='scope',draft=[];
try{const c=JSON.parse(localStorage.getItem(LIST_KEY)||'null');if(c?.lists)Object.keys(NAMES).forEach(k=>{if(Array.isArray(c.lists[k]))lists[k]=c.lists[k]});pending=c?.pending||{}}catch(e){}
const cache=()=>localStorage.setItem(LIST_KEY,JSON.stringify({lists,pending}));const valueFor=(k,x)=>x.label;
/* 예전에 위치 기본값이 빈 배열이던 기기 — 한 번만 기본 순서로 채운다(사용자가 직접 비웠을 수도 있는 경우는 드묾) */
if(!lists.location.length){ lists.location=JSON.parse(JSON.stringify(defaults.location)); cache(); }
/* 카테고리 → 구분 통합 — 딱 한 번만. 현재 cats(실제 카테고리 목록)를 구분 목록에 합치고 중복은 라벨 기준으로 제거.
   이후로는 구분 목록 편집(saveDraft)이 cats 쪽도 함께 갱신해 필터·검색과 어긋나지 않게 한다. */
const MERGE_FLAG='scanapp_scope_cat_merge_v1';
if(!localStorage.getItem(MERGE_FLAG)){
  try{
    const existing=new Set(lists.scope.map(x=>x.label));
    const toAdd=(Array.isArray(cats)?cats:[]).map(c=>String(c||'').trim()).filter(c=>c&&!existing.has(c));
    if(toAdd.length) lists.scope=[...lists.scope,...toAdd.map(v=>mk(v))];
    cache();
  }catch(e){}
  try{localStorage.setItem(MERGE_FLAG,'1');}catch(e){}
}
function fill(k){if(k==='tags')return renderTags();const el=$g(FIELDS[k]);if(!el)return;const old=el.value;el.replaceChildren();el.add(new Option('선택 안 함',''));lists[k].forEach(x=>el.add(new Option(x.label,valueFor(k,x))));if(old&&!Array.from(el.options).some(o=>o.value===old))el.add(new Option(old+' (기존 값)',old));el.value=old}
function renderTags(){const box=$g('tagChoices'),input=$g('sfTags');if(!box||!input)return;const set=new Set(input.value.split(',').map(x=>x.trim()).filter(Boolean));box.replaceChildren();lists.tags.forEach(x=>{const b=document.createElement('button');b.type='button';b.textContent=x.label;b.className=set.has(x.label)?'active':'';b.onclick=()=>{set.has(x.label)?set.delete(x.label):set.add(x.label);input.value=[...set].join(', ');renderTags()};box.appendChild(b)})}
function refreshAll(){['scope','status','location','tags'].forEach(fill)}
function syncMsg(t){if($g('listSync'))$g('listSync').textContent=t;if($g('listRetry'))$g('listRetry').hidden=!Object.keys(pending).length}
async function sync(){if(!Object.keys(pending).length)return;if(!listRef){syncMsg('이 기기에 저장됨');return}try{const p={};Object.keys(pending).forEach(k=>p[k]=lists[k]);await listRef.set(p,{merge:true});pending={};cache();syncMsg('목록 저장 완료')}catch(e){syncMsg('이 기기에 저장됨 · 동기화 대기')}}
async function loadCloud(){if(typeof _fbDb==='undefined'||!_fbDb||typeof _fbUser==='undefined'||!_fbUser)return;listRef=_fbDb.collection('scanapp').doc(_fbUser).collection('fieldCardSettings').doc('optionLists');try{const s=await listRef.get(),d=s.exists?s.data():{};Object.keys(NAMES).forEach(k=>{if(!pending[k]&&Array.isArray(d[k]))lists[k]=d[k]});cache();refreshAll();syncMsg('목록 불러오기 완료');await sync()}catch(e){syncMsg('이 기기 목록 사용 중')}}
function renderDraft(){const box=$g('listRows');box.replaceChildren();if(!draft.length){const p=document.createElement('p');p.textContent='등록된 항목이 없습니다.';box.appendChild(p)}draft.forEach((x,i)=>{const r=document.createElement('div');r.className='listEditRow';const inp=document.createElement('input');inp.value=x.label;inp.oninput=()=>x.label=inp.value;const del=document.createElement('button');del.type='button';del.textContent='삭제';del.onclick=()=>{draft.splice(i,1);renderDraft()};r.append(inp,del);box.appendChild(r)})}
function openManager(k){kind=k;draft=JSON.parse(JSON.stringify(lists[kind]));$g('listTitle').textContent=NAMES[kind]+' 목록 편집';$g('listNew').value='';$g('listError').textContent='';renderDraft();$g('listOv').classList.add('show')}
function addDraft(){const t=$g('listNew').value.trim();if(!t)return;if(draft.some(x=>x.label.trim()===t)){$g('listError').textContent='같은 이름이 이미 있습니다.';return}draft.push(mk(t));$g('listNew').value='';renderDraft()}
/* 구분 목록을 저장하면 cats(카테고리 필터·검색이 실제로 읽는 배열)도 같이 갱신 — 통합 후 저장·조회 방식을 맞추기 위함 */
function saveDraft(){const clean=draft.map(x=>({...x,label:x.label.trim()})).filter(x=>x.label);if(new Set(clean.map(x=>x.label)).size!==clean.length){$g('listError').textContent='중복 이름을 확인하세요.';return}lists[kind]=clean;pending[kind]=Date.now();cache();fill(kind);if(kind==='scope'){cats=clean.map(x=>x.label);refreshCatSelects();try{saveCats()}catch(e){}}$g('listOv').classList.remove('show');syncMsg('이 기기에 저장됨 · 동기화 중');sync()}
function activateField(el){document.querySelectorAll('.sf-field.sf-active').forEach(x=>x.classList.remove('sf-active'));el?.closest('.sf-field')?.classList.add('sf-active')}
document.addEventListener('pointerdown',e=>{const f=e.target.closest('.sf-field');if(f)activateField(f);else if(!e.target.closest('#listOv'))document.querySelectorAll('.sf-field.sf-active').forEach(x=>x.classList.remove('sf-active'))});
document.querySelectorAll('[data-edit-kind]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openManager(b.dataset.editKind)});$g('listAdd').onclick=addDraft;$g('listNew').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addDraft()}};$g('listSave').onclick=saveDraft;$g('listClose').onclick=$g('listCancel').onclick=()=>$g('listOv').classList.remove('show');$g('listRetry').onclick=async()=>{if(!listRef)await loadCloud();await sync()};$g('sfTags').oninput=renderTags;refreshAll();
/* 구분(옛 카테고리 포함)은 보안 섹션에서도 항상 보인다 — 카테고리 선택 기능이 사라지지 않도록.
   상태·위치·시간·태그는 예전처럼 보안 섹션에서는 숨긴다(업무 추적 정보라 비공개 사진엔 안 맞음). */
const oldOpen=openAddModal;
openAddModal=function(photo){
  oldOpen(photo);
  const secure=curSection==='secure';
  ['status','location','tags'].forEach(k=>{const el=panel.querySelector(`[data-sf-kind="${k}"]`);if(el)el.style.display=secure?'none':''});
  if($g('sfTimeField'))$g('sfTimeField').style.display=secure?'none':'';
  fill('scope');
  const scopeVal=photo?(photo.cat||photo.scope||''):(lists.scope[0]?.label||'');
  if(scopeVal&&!Array.from($g('sfScope').options).some(o=>o.value===scopeVal))$g('sfScope').add(new Option(scopeVal,scopeVal));
  $g('sfScope').value=scopeVal;
  if(!secure){
    ['status','location'].forEach(k=>{fill(k);const el=$g(FIELDS[k]),v=photo?.[k]||'';if(v&&!Array.from(el.options).some(o=>o.value===v))el.add(new Option(v,v));el.value=v});
    const now=new Date().toLocaleTimeString('sv-SE',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'});
    $g('sfTime').value=photo?.time||now;
    $g('sfTags').value=(photo?.tags||[]).join(', ');
    renderTags();
  }
  document.querySelectorAll('.sf-field.sf-active').forEach(x=>x.classList.remove('sf-active'));
  if(!listRef)loadCloud();
};
/* cat(카테고리) 대신 구분 선택값을 그대로 cat 으로 내보낸다 — 기존 목록·검색·필터는 p.cat 을 그대로 읽으므로
   저장 방식만 바뀌고 조회 방식은 안 바뀐다. 보안 섹션은 구분(카테고리)만 내보내고 나머지는 예전처럼 비운다. */
window.ScannerFields={values:()=>{
  const cat=$g('sfScope').value||'';
  if(curSection==='secure')return{cat};
  return{cat,status:$g('sfStatus').value,location:$g('sfLocation').value,time:$g('sfTime').value,tags:$g('sfTags').value.split(',').map(x=>x.trim()).filter(Boolean)};
}};
const oldEditor=openEditModal;let frame=null,cb=null,img=null,token=null,timer=null;function dismiss(){clearTimeout(timer);frame?.remove();frame=null;cb=null;img=null;token=null}
openEditModal=function(image,callback){if(curSection!=='normal')return oldEditor(image,callback);dismiss();img=image;cb=callback;token=uid();frame=document.createElement('iframe');frame.id='scannerPhotoFrame';frame.title='사진 표시 편집';frame.src='scan-photo-editor-v15.html';document.body.appendChild(frame);timer=setTimeout(()=>{const a=img,b=cb;dismiss();toast('사진 편집기를 불러오지 못해 기존 편집기로 열었습니다');oldEditor(a,b)},12000)};
window.addEventListener('message',e=>{if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin)return;const d=e.data;if(d?.type==='scanner-photo-ready'){clearTimeout(timer);frame.contentWindow.postMessage({type:'scanner-photo-open',token,image:img},location.origin);return}if(d?.token!==token)return;if(d.type==='scanner-photo-save'&&typeof d.image==='string'&&d.image.startsWith('data:image/')){const f=cb;dismiss();f(d.image)}else if(d.type==='scanner-photo-cancel')dismiss();else if(d.type==='scanner-photo-error'){dismiss();toast('사진을 열지 못했습니다')}});
})();
