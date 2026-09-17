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
#sfTime{cursor:pointer;text-align:left}
#listSync{display:block;margin-top:8px;font-size:11px;color:#8e8e93}#listRetry{margin-top:6px;border:0;border-radius:9px;padding:7px 10px;background:#edf2f8;color:#2354a0;font-weight:700}
#listOv{display:none;position:fixed;inset:0;background:#0008;z-index:15000;align-items:center;justify-content:center;padding:12px}#listOv.show{display:flex}#listOv .lm{background:#fff;color:#172235;width:min(540px,100%);max-height:90dvh;overflow:auto;border-radius:20px;padding:16px}#listOv .lmh,#listOv .lmf{display:flex;align-items:center;justify-content:space-between;gap:8px}.lmh{margin-bottom:10px}.lmh button,.lmf button,#listAdd{border:0;border-radius:10px;min-height:42px;padding:8px 12px;font-weight:750}.lmf{margin-top:12px}.lmf .blue,#listAdd{background:#2563eb;color:#fff}.listEditRow{display:flex;gap:8px;margin:8px 0}.listEditRow input,#listNew{flex:1;min-width:0;border:1px solid #d7dee8;border-radius:10px;padding:10px;font-size:16px}.listEditRow button{border:0;border-radius:9px;padding:8px 10px;color:#b91c1c}.listNewRow{display:flex;gap:8px;margin-top:12px}#listError{color:#b91c1c;font-size:12px;min-height:18px}
#scannerPhotoFrame{position:fixed;inset:0;width:100%;height:100dvh;border:0;z-index:20000;background:#0b111b}
#addOverlay .modal{width:min(720px,calc(100vw - 24px));max-width:720px}
/* 시간 — 원형 시계판 */
#timePickerOv{display:none;position:fixed;inset:0;background:#0007;z-index:21000;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
#timePickerOv.show{display:flex}
#timePickerOv .tp-card{width:min(320px,100%);max-height:92dvh;overflow:auto;background:#fff;color:#172235;border-radius:20px;padding:18px;box-sizing:border-box}
.tp-preview{text-align:center;font-size:26px;font-weight:800;margin-bottom:14px}
.tp-ampm{display:flex;gap:8px;justify-content:center;margin-bottom:14px}
.tp-ampm button{border:0;border-radius:999px;padding:8px 20px;font-weight:800;background:#edf2f8;color:#405069;font-size:14px}
.tp-ampm button.on{background:#2563eb;color:#fff}
.tp-tabs{display:flex;justify-content:center;gap:22px;margin-bottom:12px;font-size:13px;font-weight:800;color:#9aa5b1;cursor:pointer}
.tp-tabs span.on{color:#2563eb}
.tp-dial{position:relative;width:228px;height:228px;margin:0 auto 18px;border-radius:50%;background:#f1f4f8}
.tp-num{position:absolute;width:38px;height:38px;margin:-19px;border-radius:50%;border:0;background:transparent;font-weight:700;font-size:13px;color:#172235;display:flex;align-items:center;justify-content:center;cursor:pointer}
.tp-num.on{background:#2563eb;color:#fff}
.tp-foot{display:flex;gap:8px;margin-top:6px}
.tp-foot button{flex:1;height:46px;border:0;border-radius:12px;font-weight:800;font-size:14px}
.tp-cancel{background:#edf2f8;color:#405069}
.tp-ok{background:#2563eb;color:#fff}
/* 태그 — 입력칸 안 칩 + 입력칸 아래 드롭다운 */
.tag-input-box{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:46px;
  border-radius:12px;background:rgba(118,118,128,.10);padding:6px 8px;box-sizing:border-box;cursor:text}
.tag-chip{display:inline-flex;align-items:center;gap:5px;background:#2563eb;color:#fff;
  border-radius:999px;padding:5px 6px 5px 11px;font-size:12px;font-weight:700;white-space:nowrap;max-width:100%}
.tag-chip b{font-weight:700;overflow:hidden;text-overflow:ellipsis;max-width:140px}
.tag-chip button{border:0;background:rgba(255,255,255,.28);color:#fff;border-radius:50%;flex:none;
  width:16px;height:16px;font-size:10px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
#sfTagsText{flex:1 1 70px;min-width:70px;border:0;background:transparent;outline:none;font-size:15px;
  color:inherit;padding:4px 2px;height:28px}
.tag-dropdown{display:none;position:absolute;left:0;right:0;z-index:30;background:#fff;color:#172235;
  border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.2);padding:8px;box-sizing:border-box;
  border:1px solid rgba(0,0,0,.08)}
.tag-dropdown.show{display:block}
.tag-dropdown.tag-below{top:100%;margin-top:6px}
.tag-dropdown.tag-above{bottom:100%;margin-bottom:6px}
.tag-dropdown-list{max-height:190px;overflow-y:auto;display:flex;flex-direction:column;gap:2px}
.tag-opt{border:0;background:transparent;text-align:left;padding:9px 10px;border-radius:8px;
  font-size:14px;color:#172235;cursor:pointer;width:100%}
.tag-opt:hover{background:rgba(37,99,235,.10)}
.tag-opt.sel{color:#2563eb;font-weight:800}
.tag-opt.add-new{color:#2563eb;font-weight:700;border-top:1px solid rgba(0,0,0,.08);margin-top:4px;padding-top:10px}
.tag-empty{padding:10px;font-size:12px;color:#8e8e93}
.tag-manage-btn{width:100%;margin-top:6px;justify-content:center;display:flex}
@media(max-width:420px){#scannerFields .sf-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#scannerFields select,#scannerFields input,#fDateField input{height:44px;padding:0 9px;font-size:15px}.sf-edit{font-size:10px;padding:5px 8px}}
`;
document.head.appendChild(style);
const field=(kind,label,id,control)=>`<div class="field sf-field" data-sf-kind="${kind}"><div class="sf-labelrow"><label for="${id}">${label}</label></div>${control}<div class="sf-editrow"><button type="button" class="sf-edit" data-edit-kind="${kind}">목록 편집</button></div></div>`;
/* 구분/상태/위치/태그를 한 그리드에 두면 2열로 자동 배치된다 — [구분|상태][위치|태그].
   날짜(fDate, 기존 base HTML 필드)를 이 그리드로 옮기고 시간을 이어 붙이면 [날짜|시간]까지 같은 방식으로 맞춰진다.
   태그는 입력칸을 누르면 그 자리에서 목록이 펼쳐지는 구조라 일반 field() 대신 별도 마크업을 쓴다. */
const tagsFieldHtml=`<div class="field sf-field" data-sf-kind="tags" id="sfTagsField">
  <div class="sf-labelrow"><label for="sfTagsText">태그</label></div>
  <div id="tagInputBox" class="tag-input-box"><input id="sfTagsText" type="text" placeholder="태그 선택 또는 입력" autocomplete="off"></div>
  <div id="tagDropdown" class="tag-dropdown"><div id="tagDropdownList" class="tag-dropdown-list"></div><button type="button" id="tagManageBtn" class="sf-edit tag-manage-btn">목록 편집</button></div>
</div>`;
const panel=document.createElement('div');
panel.id='scannerFields';
panel.innerHTML=`<div class="sf-grid">${field('scope','구분','sfScope','<select id="sfScope"></select>')}${field('status','상태','sfStatus','<select id="sfStatus"></select>')}${field('location','위치','sfLocation','<select id="sfLocation"></select>')}${tagsFieldHtml}</div><span id="listSync"></span><button id="listRetry" type="button" hidden>동기화 재시도</button>`;
(($g('afTitleMemoRow'))||$g('fMemo')?.closest('.field'))?.after(panel);
const sfGrid=panel.querySelector('.sf-grid');
const dateField=$g('fDateField');
if(dateField&&sfGrid){ dateField.classList.add('sf-field'); sfGrid.appendChild(dateField); }
if(sfGrid){
  const timeField=document.createElement('div');
  timeField.id='sfTimeField';
  timeField.className='field sf-field';
  timeField.innerHTML='<div class="sf-labelrow"><label for="sfTime">시간</label></div><input type="text" id="sfTime" readonly placeholder="선택 안 함">';
  sfGrid.appendChild(timeField);
}
const modal=document.createElement('div');modal.innerHTML=`<div id="listOv"><div class="lm"><div class="lmh"><b id="listTitle">목록 편집</b><button id="listClose">✕</button></div><div id="listRows"></div><div class="listNewRow"><input id="listNew" maxlength="80" placeholder="새 항목"><button id="listAdd">추가</button></div><div id="listError"></div><div class="lmf"><button id="listCancel">취소</button><button id="listSave" class="blue">저장</button></div></div></div>`;document.body.appendChild(modal);
/* ═══ 🕐 시간 — 원형 시계판(오전/오후 → 시 → 5분 단위) ═══
   기존 값은 열었다고 반올림하지 않는다: 다이얼 초기 표시만 가까운 5분에 맞추고,
   실제 저장은 사용자가 확인을 눌렀을 때만 일어난다(취소하면 기존 값 그대로). */
const timePicker=document.createElement('div');
timePicker.innerHTML=`<div id="timePickerOv"><div class="tp-card">
  <div class="tp-preview" id="tpPreview"></div>
  <div class="tp-ampm"><button type="button" data-ampm="AM">오전</button><button type="button" data-ampm="PM">오후</button></div>
  <div class="tp-tabs"><span id="tpTabHour">시</span><span id="tpTabMinute">분</span></div>
  <div class="tp-dial" id="tpDial"></div>
  <div class="tp-foot"><button type="button" class="tp-cancel" id="tpCancel">취소</button><button type="button" class="tp-ok" id="tpOk">확인</button></div>
</div></div>`;
document.body.appendChild(timePicker);
const HOUR_ITEMS=[12,1,2,3,4,5,6,7,8,9,10,11].map(h=>({label:String(h),value:h}));
const MIN_ITEMS=Array.from({length:12},(_,i)=>{const m=i*5;return{label:String(m).padStart(2,'0'),value:m};});
let _tp={ampm:'AM',hour12:12,minute:0,step:'hour'};
function _tpLayoutDial(items,activeCheck,onPick){
  const dial=$g('tpDial');if(!dial)return;
  dial.innerHTML='';
  const R=94,CX=114,CY=114;
  items.forEach((it,i)=>{
    const angle=(i*30-90)*Math.PI/180;
    const x=CX+R*Math.cos(angle),y=CY+R*Math.sin(angle);
    const b=document.createElement('button');
    b.type='button';b.className='tp-num'+(activeCheck(it)?' on':'');
    b.style.left=x+'px';b.style.top=y+'px';
    b.textContent=it.label;
    b.onclick=()=>onPick(it.value);
    dial.appendChild(b);
  });
}
function _tpPreviewText(){
  const ap=_tp.ampm==='AM'?'오전':'오후';
  return`${ap} ${String(_tp.hour12).padStart(2,'0')}:${String(_tp.minute).padStart(2,'0')}`;
}
function _tpTo24(){
  let h=_tp.hour12%12; if(_tp.ampm==='PM')h+=12;
  return String(h).padStart(2,'0')+':'+String(_tp.minute).padStart(2,'0');
}
function _tpRender(){
  const pv=$g('tpPreview');if(pv)pv.textContent=_tpPreviewText();
  document.querySelectorAll('#timePickerOv .tp-ampm button').forEach(b=>b.classList.toggle('on',b.dataset.ampm===_tp.ampm));
  $g('tpTabHour')?.classList.toggle('on',_tp.step==='hour');
  $g('tpTabMinute')?.classList.toggle('on',_tp.step==='minute');
  if(_tp.step==='hour') _tpLayoutDial(HOUR_ITEMS,it=>it.value===_tp.hour12,v=>{_tp.hour12=v;_tp.step='minute';_tpRender();});
  else _tpLayoutDial(MIN_ITEMS,it=>it.value===_tp.minute,v=>{_tp.minute=v;_tpRender();});
}
function _tpParse24(v24){
  const m=/^(\d{1,2}):(\d{1,2})$/.exec(v24||'');
  if(!m){const now=new Date();return _tpFromDate(now);}
  let h=parseInt(m[1],10),mi=parseInt(m[2],10);
  const ampm=h>=12?'PM':'AM';
  let hour12=h%12; if(hour12===0)hour12=12;
  let minute=Math.round(mi/5)*5; if(minute===60)minute=0;
  return{ampm,hour12,minute};
}
function _tpFromDate(d){
  const h=d.getHours(),ampm=h>=12?'PM':'AM';let hour12=h%12; if(hour12===0)hour12=12;
  let minute=Math.round(d.getMinutes()/5)*5%60;
  return{ampm,hour12,minute};
}
function openTimePicker(){
  const cur=$g('sfTime')?.dataset.value||'';
  const parsed=_tpParse24(cur);
  _tp={...parsed,step:'hour'};
  _tpRender();
  $g('timePickerOv').classList.add('show');
}
function _setTimeValue(v24){
  const el=$g('sfTime');if(!el)return;
  el.dataset.value=v24||'';
  if(!v24){el.value='';return;}
  const[hh,mm]=v24.split(':').map(Number);
  const ampm=hh>=12?'오후':'오전';let h12=hh%12;if(h12===0)h12=12;
  el.value=`${ampm} ${String(h12).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}
document.querySelectorAll('#timePickerOv .tp-ampm button').forEach(b=>b.onclick=()=>{_tp.ampm=b.dataset.ampm;_tpRender();});
if($g('tpTabHour'))$g('tpTabHour').onclick=()=>{_tp.step='hour';_tpRender();};
if($g('tpTabMinute'))$g('tpTabMinute').onclick=()=>{_tp.step='minute';_tpRender();};
if($g('tpCancel'))$g('tpCancel').onclick=()=>$g('timePickerOv').classList.remove('show');
if($g('tpOk'))$g('tpOk').onclick=()=>{_setTimeValue(_tpTo24());$g('timePickerOv').classList.remove('show');};
if($g('sfTime'))$g('sfTime').onclick=e=>{e.stopPropagation();openTimePicker();};
const LIST_KEY='fieldCards.optionLists.v2',NAMES={scope:'구분',status:'상태',location:'위치',tags:'태그'},FIELDS={scope:'sfScope',status:'sfStatus',location:'sfLocation',tags:'sfTags'};
const mk=(label,id)=>(id?{id,label}:{id:uid(),label});
/* 위치 기본값 — 옥탑 → 20층…1층 → 지하1층…지하6층, 문자순 정렬 금지(요청 순서 그대로 유지).
   서희타워 실제 층 구성(업무일지 FLOORS·개인일지 FLOOR_ORDER·직원 담당구역·주차 로그와 대조 확인됨: 20층 + 지하6층). */
const LOCATION_DEFAULT=['옥탑',...Array.from({length:20},(_,i)=>(20-i)+'층'),...Array.from({length:6},(_,i)=>'지하'+(i+1)+'층')];
const defaults={scope:[mk('업무'),mk('개인')],status:['발견','점검 필요','작업 중','완료'].map(v=>mk(v)),location:LOCATION_DEFAULT.map(v=>mk(v)),tags:[]};
let lists=JSON.parse(JSON.stringify(defaults)),pending={},listRef=null,kind='scope',draft=[];
try{const c=JSON.parse(localStorage.getItem(LIST_KEY)||'null');if(c?.lists)Object.keys(NAMES).forEach(k=>{if(Array.isArray(c.lists[k]))lists[k]=c.lists[k]});pending=c?.pending||{}}catch(e){}
const cache=()=>localStorage.setItem(LIST_KEY,JSON.stringify({lists,pending}));const valueFor=(k,x)=>x.label;
/* 위치 목록을 옥탑→20층…1층→지하1층…지하6층 순서로 맞춘다 — 딱 한 번만.
   이미 몇 개만(예: 3층/4층/5층) 저장해 둔 기기도 그 값이 사라지지 않도록 기본 순서 뒤에 그대로 이어 붙인다.
   pending으로 표시해야 이어지는 loadCloud() 가 옛 클라우드 값으로 도로 덮어쓰지 않고, sync() 로 클라우드에도 반영된다. */
const LOCATION_MERGE_FLAG='scanapp_location_default_merge_v1';
if(!localStorage.getItem(LOCATION_MERGE_FLAG)){
  try{
    const defaultLabels=new Set(defaults.location.map(x=>x.label));
    const extra=lists.location.filter(x=>!defaultLabels.has(x.label));
    lists.location=[...JSON.parse(JSON.stringify(defaults.location)),...extra];
    pending.location=Date.now();
    cache();
  }catch(e){}
  try{localStorage.setItem(LOCATION_MERGE_FLAG,'1');}catch(e){}
}
/* 카테고리 → 구분 통합 — 딱 한 번만. 현재 cats(실제 카테고리 목록)를 구분 목록에 합치고 중복은 라벨 기준으로 제거.
   이후로는 구분 목록 편집(saveDraft)이 cats 쪽도 함께 갱신해 필터·검색과 어긋나지 않게 한다.
   마찬가지로 pending 표시를 해야 클라우드 재동기화 때 사라지지 않는다. */
const MERGE_FLAG='scanapp_scope_cat_merge_v1';
if(!localStorage.getItem(MERGE_FLAG)){
  try{
    const existing=new Set(lists.scope.map(x=>x.label));
    const toAdd=(Array.isArray(cats)?cats:[]).map(c=>String(c||'').trim()).filter(c=>c&&!existing.has(c));
    if(toAdd.length){ lists.scope=[...lists.scope,...toAdd.map(v=>mk(v))]; pending.scope=Date.now(); }
    cache();
  }catch(e){}
  try{localStorage.setItem(MERGE_FLAG,'1');}catch(e){}
}
function fill(k){if(k==='tags')return renderTags();const el=$g(FIELDS[k]);if(!el)return;const old=el.value;el.replaceChildren();el.add(new Option('선택 안 함',''));lists[k].forEach(x=>el.add(new Option(x.label,valueFor(k,x))));if(old&&!Array.from(el.options).some(o=>o.value===old))el.add(new Option(old+' (기존 값)',old));el.value=old}
/* ═══ 🏷 태그 — 입력칸을 누르면 그 자리에 드롭다운, 선택은 입력칸 안 칩으로 ═══ */
let tagState=[];
function _tagRenderChips(){
  const box=$g('tagInputBox'),inp=$g('sfTagsText');if(!box||!inp)return;
  box.querySelectorAll('.tag-chip').forEach(c=>c.remove());
  tagState.forEach(label=>{
    const chip=document.createElement('span');chip.className='tag-chip';
    const b=document.createElement('b');b.textContent=label;
    const rm=document.createElement('button');rm.type='button';rm.textContent='✕';rm.setAttribute('aria-label','태그 제거');
    rm.onclick=e=>{e.stopPropagation();tagState=tagState.filter(t=>t!==label);_tagRenderChips();_tagRenderDropdown();};
    chip.append(b,rm);
    box.insertBefore(chip,inp);
  });
}
function _tagAdd(label){
  label=(label||'').trim();if(!label)return;
  if(!tagState.includes(label))tagState=[...tagState,label];
  const inp=$g('sfTagsText');if(inp)inp.value='';
  _tagRenderChips();_tagRenderDropdown();
}
/* 드롭다운을 닫거나 저장하기 직전, 아직 확정 안 한 입력 글자가 조용히 사라지지 않도록 태그로 커밋한다 */
function _tagCommitTyped(){
  const inp=$g('sfTagsText');if(!inp)return;
  const v=inp.value.trim();
  if(v)_tagAdd(v);
}
function _tagRenderDropdown(){
  const list=$g('tagDropdownList');if(!list)return;
  const inp=$g('sfTagsText');
  const q=(inp?inp.value.trim():'').toLowerCase();
  list.innerHTML='';
  const matches=lists.tags.filter(x=>!q||x.label.toLowerCase().includes(q));
  matches.forEach(x=>{
    const b=document.createElement('button');
    const on=tagState.includes(x.label);
    b.type='button';b.className='tag-opt'+(on?' sel':'');
    b.textContent=(on?'✓ ':'')+x.label;
    b.onclick=e=>{
      e.stopPropagation();
      if(tagState.includes(x.label))tagState=tagState.filter(t=>t!==x.label);
      else tagState=[...tagState,x.label];
      if(inp){inp.value='';inp.focus();}
      _tagRenderChips();_tagRenderDropdown();
    };
    list.appendChild(b);
  });
  if(q&&!lists.tags.some(x=>x.label.toLowerCase()===q)){
    const addBtn=document.createElement('button');
    addBtn.type='button';addBtn.className='tag-opt add-new';
    addBtn.textContent=`＋ "${q}" 추가`;
    addBtn.onclick=e=>{e.stopPropagation();_tagAdd(q);if(inp)inp.focus();};
    list.appendChild(addBtn);
  }
  if(!matches.length&&!q){
    const p=document.createElement('div');p.className='tag-empty';p.textContent='등록된 태그가 없습니다. 입력해서 추가하세요.';
    list.appendChild(p);
  }
}
function _tagOpenDropdown(){
  const dd=$g('tagDropdown'),box=$g('tagInputBox');if(!dd||!box)return;
  _tagRenderDropdown();
  const rect=box.getBoundingClientRect();
  const estH=Math.min(240,60+(lists.tags.length+1)*38);
  const openAbove=(window.innerHeight-rect.bottom)<estH&&rect.top>estH;
  dd.classList.toggle('tag-above',openAbove);
  dd.classList.toggle('tag-below',!openAbove);
  dd.classList.add('show');
}
function _tagCloseDropdown(){
  const dd=$g('tagDropdown');if(dd&&!dd.classList.contains('show'))return;
  dd?.classList.remove('show');
  _tagCommitTyped();
}
/* 기존 renderTags() 자리 — 이제 태그는 fill('tags') 를 통해 이 함수로 화면을 맞춘다(칩만 갱신, 드롭다운은 열렸을 때만) */
function renderTags(){_tagRenderChips();if($g('tagDropdown')?.classList.contains('show'))_tagRenderDropdown();}
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
document.addEventListener('pointerdown',e=>{
  const f=e.target.closest('.sf-field');
  if(f)activateField(f);
  else if(!e.target.closest('#listOv'))document.querySelectorAll('.sf-field.sf-active').forEach(x=>x.classList.remove('sf-active'));
  if(!e.target.closest('#sfTagsField'))_tagCloseDropdown();
});
document.querySelectorAll('[data-edit-kind]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openManager(b.dataset.editKind)});$g('listAdd').onclick=addDraft;$g('listNew').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addDraft()}};$g('listSave').onclick=saveDraft;$g('listClose').onclick=$g('listCancel').onclick=()=>$g('listOv').classList.remove('show');$g('listRetry').onclick=async()=>{if(!listRef)await loadCloud();await sync()};
if($g('sfTagsText')){
  $g('sfTagsText').addEventListener('click',e=>{e.stopPropagation();_tagOpenDropdown();});
  $g('sfTagsText').addEventListener('focus',()=>_tagOpenDropdown());
  $g('sfTagsText').addEventListener('input',()=>_tagRenderDropdown());
  $g('sfTagsText').addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();_tagCommitTyped();_tagRenderDropdown();}
    else if(e.key==='Backspace'&&!e.target.value&&tagState.length){tagState=tagState.slice(0,-1);_tagRenderChips();_tagRenderDropdown();}
  });
}
if($g('tagInputBox'))$g('tagInputBox').addEventListener('click',e=>{if(e.target===$g('tagInputBox')){e.stopPropagation();$g('sfTagsText')?.focus();_tagOpenDropdown();}});
if($g('tagManageBtn'))$g('tagManageBtn').onclick=e=>{e.stopPropagation();openManager('tags');};
refreshAll();
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
    _setTimeValue(photo?.time||now);
    tagState=[...(photo?.tags||[])];
    _tagRenderChips();
    if($g('tagDropdown'))$g('tagDropdown').classList.remove('show');
  }
  document.querySelectorAll('.sf-field.sf-active').forEach(x=>x.classList.remove('sf-active'));
  if(!listRef)loadCloud();
};
/* cat(카테고리) 대신 구분 선택값을 그대로 cat 으로 내보낸다 — 기존 목록·검색·필터는 p.cat 을 그대로 읽으므로
   저장 방식만 바뀌고 조회 방식은 안 바뀐다. 보안 섹션은 구분(카테고리)만 내보내고 나머지는 예전처럼 비운다.
   태그는 저장 직전에 입력 중이던 글자까지 커밋해서 조용히 빠지지 않게 한다. */
window.ScannerFields={values:()=>{
  const cat=$g('sfScope').value||'';
  if(curSection==='secure')return{cat};
  _tagCommitTyped();
  return{cat,status:$g('sfStatus').value,location:$g('sfLocation').value,time:$g('sfTime')?.dataset.value||'',tags:[...tagState]};
}};
const oldEditor=openEditModal;let frame=null,cb=null,img=null,token=null,timer=null;function dismiss(){clearTimeout(timer);frame?.remove();frame=null;cb=null;img=null;token=null}
openEditModal=function(image,callback){if(curSection!=='normal')return oldEditor(image,callback);dismiss();img=image;cb=callback;token=uid();frame=document.createElement('iframe');frame.id='scannerPhotoFrame';frame.title='사진 표시 편집';frame.src='scan-photo-editor-v15.html';document.body.appendChild(frame);timer=setTimeout(()=>{const a=img,b=cb;dismiss();toast('사진 편집기를 불러오지 못해 기존 편집기로 열었습니다');oldEditor(a,b)},12000)};
window.addEventListener('message',e=>{if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin)return;const d=e.data;if(d?.type==='scanner-photo-ready'){clearTimeout(timer);frame.contentWindow.postMessage({type:'scanner-photo-open',token,image:img},location.origin);return}if(d?.token!==token)return;if(d.type==='scanner-photo-save'&&typeof d.image==='string'&&d.image.startsWith('data:image/')){const f=cb;dismiss();f(d.image)}else if(d.type==='scanner-photo-cancel')dismiss();else if(d.type==='scanner-photo-error'){dismiss();toast('사진을 열지 못했습니다')}});
})();
