(()=>{
'use strict';

const $id=id=>document.getElementById(id);
const css=document.createElement('style');
css.textContent=`
#scannerFields{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);overflow:hidden}
#scannerFields .sf-intro{margin:0 0 10px;font-size:12px;line-height:1.45;color:var(--ink-faint)}
#scannerFields .sf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
#scannerFields .sf-field{min-width:0;margin:0}
#scannerFields .sf-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:0 0 5px}
#scannerFields .sf-head label,#scannerFields .sf-field>label{font-size:12px;font-weight:700;color:var(--ink-soft);margin:0}
#scannerFields select,#scannerFields input{display:block;width:100%;min-width:0;height:44px;padding:0 12px;border:0;border-radius:10px;background:var(--blue-soft);color:var(--ink);font-size:16px}
#scannerFields .sf-manage,[data-manage="category"]{flex:0 0 auto;min-height:30px!important;height:30px!important;padding:0 9px!important;border:0!important;border-radius:8px!important;background:var(--blue-lt)!important;color:var(--accent)!important;font-size:11px!important;font-weight:700!important;white-space:nowrap}
#scannerFields .sf-tags{margin-top:10px}
#tagChoices{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
#tagChoices .chip{min-height:30px;padding:4px 10px;font-size:12px}
#tagChoices .active{background:var(--accent);color:#fff}
#listSync{display:block;margin-top:7px;font-size:11px;color:var(--ink-faint);min-height:16px}
#listRetry{margin-top:5px;min-height:32px;border:0;border-radius:8px;background:var(--blue-lt);color:var(--accent);font-size:12px;font-weight:700}
#scannerCatEdit{display:block;width:auto!important;margin:6px 0 0 auto!important}
#addOverlay .modal{max-width:min(720px,calc(100vw - 20px));overflow-x:hidden}
#addOverlay .modal-body{overflow-x:hidden}
#addOverlay .field{min-width:0}
#listOv{display:none;position:fixed;inset:0;background:#0008;z-index:15000;align-items:center;justify-content:center;padding:12px}
#listOv.show{display:flex}
#listOv .modal{background:var(--surface);color:var(--ink);width:min(520px,100%);max-height:90dvh;overflow:auto;border-radius:18px;padding:16px}
#listOv .mh,#listOv .mf{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0}
#listOv .listEditRow{display:flex;gap:8px;margin:10px 0}
#listOv input{flex:1;min-width:0;padding:10px;border:1px solid var(--line);border-radius:10px;font-size:16px;background:var(--surface);color:var(--ink)}
#listOv button{min-height:40px;padding:7px 11px;border:0;border-radius:10px;font-size:14px}
#listOv .danger,#listError{color:var(--red)}
#listOv .blue{background:var(--accent);color:#fff}
.sf-notes{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0;padding:6px}
.sf-notes input{width:100%;min-width:0;font-size:14px;padding:8px;box-sizing:border-box;border:1px solid var(--line);border-radius:8px}
.sf-notes select,.sf-notes button{min-height:38px;border:0;border-radius:9px;background:var(--blue-lt);color:var(--accent);padding:7px;font-weight:700}
.preview-item:has(.sf-notes){width:170px;flex:none;overflow:visible;height:auto;background:var(--surface-2);border:1px solid var(--line)}
.preview-item:has(.sf-notes)>img{height:110px}
#scannerPhotoFrame{position:fixed;inset:0;width:100%;height:100dvh;border:0;z-index:20000;background:#0b111b}
@media(max-width:520px){
  #scannerFields .sf-grid{grid-template-columns:1fr}
  #scannerFields .sf-intro{font-size:11px}
  #addOverlay .modal{width:calc(100vw - 12px);max-width:none;border-radius:18px}
}
`;
document.head.appendChild(css);

const panel=document.createElement('div');
panel.id='scannerFields';
panel.innerHTML=`
  <p class="sf-intro">업무용 사진은 필요한 정보만 선택해서 저장할 수 있습니다.</p>
  <div class="sf-grid">
    <div class="sf-field"><div class="sf-head"><label for="sfScope">구분</label><button type="button" class="sf-manage" data-manage="scope">편집</button></div><select id="sfScope"></select></div>
    <div class="sf-field"><div class="sf-head"><label for="sfStatus">상태</label><button type="button" class="sf-manage" data-manage="status">편집</button></div><select id="sfStatus"></select></div>
    <div class="sf-field"><div class="sf-head"><label for="sfLocation">위치</label><button type="button" class="sf-manage" data-manage="location">편집</button></div><select id="sfLocation"></select></div>
    <div class="sf-field"><label for="sfTime">시간</label><input type="time" id="sfTime"></div>
  </div>
  <div class="sf-field sf-tags"><div class="sf-head"><label for="sfTags">태그</label><button type="button" class="sf-manage" data-manage="tags">편집</button></div><div id="tagChoices"></div><input id="sfTags" placeholder="태그 선택 또는 쉼표로 입력"></div>
  <span id="listSync" role="status"></span><button id="listRetry" type="button" hidden>동기화 재시도</button>
`;
$id('fMemo').closest('.field').after(panel);

const catButton=document.createElement('button');
catButton.type='button';
catButton.id='scannerCatEdit';
catButton.className='sf-manage';
catButton.textContent='분류 편집';
catButton.dataset.manage='category';
$id('fCat').after(catButton);

const modal=document.createElement('div');
modal.innerHTML=`<div id="listOv" role="dialog" aria-modal="true" aria-labelledby="listTitle"><div class="modal"><div class="mh"><b id="listTitle">목록 편집</b><button id="listClose">×</button></div><p>항목을 추가·수정·삭제할 수 있습니다. 기존 사진 기록은 유지됩니다.</p><div id="listRows"></div><div class="listEditRow"><input id="listNew" maxlength="80" placeholder="새 항목 이름"><button id="listAdd">추가</button></div><p id="listError" role="alert"></p><div class="mf"><button id="listCancel">취소</button><button id="listSave" class="blue">저장</button></div></div></div>`;
document.body.appendChild(modal);

const LIST_KEY='fieldCards.optionLists.v1';
const LIST_NAMES={scope:'구분',status:'상태',location:'위치',category:'분류',tags:'태그'};
const LIST_FIELDS={scope:'sfScope',status:'sfStatus',location:'sfLocation',category:'fCat',tags:'sfTags'};
const DEFAULT_LISTS={
  scope:[{id:'work',label:'업무'},{id:'personal',label:'개인'}],
  status:['발견','점검 필요','작업 중','완료'].map(label=>({id:uid(),label})),
  location:[],category:cats.map(label=>({id:uid(),label})),tags:[]
};
let optionLists=JSON.parse(JSON.stringify(DEFAULT_LISTS)),pendingLists={},listRef=null,managingList=null,listDraft=[],listSyncBusy=false;
function validList(a){return Array.isArray(a)&&a.every(x=>x&&typeof x.id==='string'&&typeof x.label==='string'&&x.label.trim()&&x.label.length<=80)&&new Set(a.map(x=>x.id)).size===a.length&&new Set(a.map(x=>x.label)).size===a.length}
try{const cached=JSON.parse(localStorage.getItem(LIST_KEY)||'null');if(cached){for(const k of Object.keys(LIST_NAMES))if(validList(cached.lists?.[k]))optionLists[k]=cached.lists[k];pendingLists=cached.pending||{}}}catch(e){console.warn('목록 캐시 읽기 실패',e)}
function cacheLists(lists=optionLists,pending=pendingLists){localStorage.setItem(LIST_KEY,JSON.stringify({lists,pending}))}
function listValue(k,item){return k==='scope'?item.id:item.label}
function scopeLabel(value){return optionLists.scope.find(x=>x.id===value)?.label||({work:'업무',personal:'개인'}[value])||value||'미지정'}
function fillListField(k,reset=false){if(k==='tags'){renderTagChoices();return}const el=$id(LIST_FIELDS[k]);if(!el)return;const current=reset?'':el.value,items=optionLists[k];el.replaceChildren();el.add(new Option('선택 안 함',''));for(const item of items)el.add(new Option(item.label,listValue(k,item)));if(current&&!Array.from(el.options).some(o=>o.value===current))el.add(new Option(current+' (기존 값)',current));el.value=reset?(items[0]?listValue(k,items[0]):''):current}
function renderTagChoices(){const box=$id('tagChoices'),field=$id('sfTags');if(!box||!field)return;const chosen=field.value.split(',').map(s=>s.trim()).filter(Boolean);box.replaceChildren();for(const item of optionLists.tags){const b=document.createElement('button');b.type='button';b.className='chip'+(chosen.includes(item.label)?' active':'');b.textContent=item.label;b.onclick=()=>{const set=new Set(field.value.split(',').map(s=>s.trim()).filter(Boolean));set.has(item.label)?set.delete(item.label):set.add(item.label);field.value=[...set].join(', ');renderTagChoices()};box.appendChild(b)}}
function refreshLists(){const current=$id('fCat')?.value||'';cats=optionLists.category.map(x=>x.label);refreshCatSelects();if($id('fCat'))$id('fCat').value=current;for(const k of Object.keys(LIST_NAMES))fillListField(k)}
function syncMessage(message){if($id('listSync'))$id('listSync').textContent=message;if($id('listRetry'))$id('listRetry').hidden=!Object.keys(pendingLists).length}
async function syncLists(){if(listSyncBusy||!Object.keys(pendingLists).length)return;if(!listRef){syncMessage('기기에 저장됨');return}listSyncBusy=true;const sending={...pendingLists};try{const payload={};for(const k of Object.keys(sending))if(validList(optionLists[k]))payload[k]=optionLists[k];await listRef.set(payload,{merge:true});for(const k of Object.keys(sending))if(pendingLists[k]===sending[k])delete pendingLists[k];cacheLists();syncMessage('목록 저장 완료')}catch(e){syncMessage('기기에 저장됨 · 클라우드 동기화 대기')}finally{listSyncBusy=false}}
async function loadOptionLists(){if(!_fbDb||!_fbUser)return;listRef=_fbDb.collection('scanapp').doc(_fbUser).collection('fieldCardSettings').doc('optionLists');try{const snap=await listRef.get(),data=snap.exists?snap.data():{};for(const k of Object.keys(LIST_NAMES))if(!pendingLists[k]&&validList(data[k]))optionLists[k]=data[k];cacheLists();refreshLists();syncMessage('목록 불러오기 완료');await syncLists()}catch(e){syncMessage('기기 목록 사용 중')}}
function openListManager(k){managingList=k;listDraft=JSON.parse(JSON.stringify(optionLists[k]));$id('listTitle').textContent=LIST_NAMES[k]+' 편집';$id('listNew').value='';$id('listError').textContent='';renderListDraft();$id('listOv').classList.add('show')}
function renderListDraft(){const box=$id('listRows');box.replaceChildren();if(!listDraft.length){const p=document.createElement('p');p.textContent='등록된 항목이 없습니다.';box.appendChild(p)}listDraft.forEach((item,i)=>{const row=document.createElement('div');row.className='listEditRow';const input=document.createElement('input');input.value=item.label;input.maxLength=80;input.oninput=()=>item.label=input.value;const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='삭제';del.onclick=()=>{listDraft.splice(i,1);renderListDraft()};row.append(input,del);box.appendChild(row)})}
function addListDraft(){const label=$id('listNew').value.trim();if(!label)return;if(listDraft.some(x=>x.label.trim()===label)){$id('listError').textContent='같은 이름이 이미 있습니다.';return}listDraft.push({id:uid(),label});$id('listNew').value='';$id('listError').textContent='';renderListDraft()}
function saveListDraft(){const k=managingList,next=listDraft.map(x=>({...x,label:x.label.trim()}));if(!validList(next)||next.some(x=>x.label.includes(','))){$id('listError').textContent='중복 이름과 쉼표는 사용할 수 없습니다.';return}const field=$id(LIST_FIELDS[k]);let selectedValue=field?.value||'';optionLists={...optionLists,[k]:next};pendingLists={...pendingLists,[k]:uid()};cacheLists();refreshLists();if(field)field.value=selectedValue;$id('listOv').classList.remove('show');if(k==='category')saveCats();syncMessage('기기에 저장됨');syncLists()}

document.querySelectorAll('[data-manage]').forEach(b=>b.onclick=()=>openListManager(b.dataset.manage));
$id('listAdd').onclick=addListDraft;
$id('listNew').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addListDraft()}};
$id('listSave').onclick=saveListDraft;
$id('listCancel').onclick=$id('listClose').onclick=()=>{$id('listOv').classList.remove('show')};
$id('listRetry').onclick=async()=>{if(!listRef)await loadOptionLists();else await syncLists()};
$id('sfTags').oninput=renderTagChoices;
refreshLists();

const oldOpen=openAddModal;
openAddModal=function(photo){
  oldOpen(photo);
  const hidden=curSection==='secure';panel.hidden=hidden;catButton.hidden=hidden;
  for(const k of ['scope','status','location']){fillListField(k);const el=$id(LIST_FIELDS[k]),v=photo?.[k]||'';if(v&&!Array.from(el.options).some(o=>o.value===v))el.add(new Option(v,v));el.value=v}
  const time=new Date().toLocaleTimeString('sv-SE',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'});
  $id('sfTime').value=photo?.time||time;$id('sfTags').value=(photo?.tags||[]).join(', ');renderTagChoices();
  if(_fbDb&&_fbUser&&!listRef)loadOptionLists();
};
window.ScannerFields={values:()=>curSection==='secure'?{}:{scope:$id('sfScope').value,scopeLabel:scopeLabel($id('sfScope').value),status:$id('sfStatus').value,location:$id('sfLocation').value,time:$id('sfTime').value,tags:$id('sfTags').value.split(',').map(x=>x.trim()).filter(Boolean)}};

const oldEditor=openEditModal;let editorFrame=null,editorCallback=null,editorImage=null,editorToken=null,readyTimer=null;
function dismissEditor(){clearTimeout(readyTimer);editorFrame?.remove();editorFrame=null;editorCallback=null;editorImage=null;editorToken=null}
openEditModal=function(image,callback){if(curSection!=='normal')return oldEditor(image,callback);dismissEditor();editorImage=image;editorCallback=callback;editorToken=uid();editorFrame=document.createElement('iframe');editorFrame.id='scannerPhotoFrame';editorFrame.title='사진 표시 편집';editorFrame.src='scan-photo-editor-v15.html';document.body.appendChild(editorFrame);readyTimer=setTimeout(()=>{const original=editorImage,cb=editorCallback;dismissEditor();toast('사진 편집기를 불러오지 못해 기존 편집기로 열었습니다');oldEditor(original,cb)},12000)};
window.addEventListener('message',e=>{if(!editorFrame||e.source!==editorFrame.contentWindow||e.origin!==location.origin)return;const d=e.data;if(d?.type==='scanner-photo-ready'){clearTimeout(readyTimer);editorFrame.contentWindow.postMessage({type:'scanner-photo-open',token:editorToken,image:editorImage},location.origin);return}if(d?.token!==editorToken)return;if(d.type==='scanner-photo-save'&&typeof d.image==='string'&&d.image.startsWith('data:image/jpeg')){const callback=editorCallback;dismissEditor();callback(d.image)}else if(d.type==='scanner-photo-cancel')dismissEditor();else if(d.type==='scanner-photo-error'){dismissEditor();toast('사진을 열지 못했습니다. 다시 시도하세요')}});

const oldPreviews=renderPreviews;
renderPreviews=function(){oldPreviews();if(curSection!=='normal')return;$id('previewList').querySelectorAll('.preview-item').forEach((item,i)=>{const m=mImgs[i];if(!m)return;const notes=document.createElement('div');notes.className='sf-notes';const edit=document.createElement('button');edit.type='button';edit.textContent='✏ 표시 편집';edit.onclick=()=>openEditModal(m.data,data=>{m.data=data;m.dirty=true;renderPreviews()});const role=document.createElement('select');role.setAttribute('aria-label','사진 '+(i+1)+' 역할');for(const value of ['일반','작업 전','작업 후','현장','여행','기타'])role.add(new Option(value,value));role.value=m.role||'일반';role.onchange=()=>m.role=role.value;const caption=document.createElement('input');caption.placeholder='사진 설명';caption.value=m.caption||'';caption.oninput=()=>m.caption=caption.value;notes.append(edit,role,caption);item.appendChild(notes)})};
})();