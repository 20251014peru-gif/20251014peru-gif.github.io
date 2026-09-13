(()=>{
'use strict';
const $g=id=>document.getElementById(id);
const style=document.createElement('style');
style.textContent=`
#scannerFields{margin-top:12px;padding:14px;border:1px solid rgba(0,0,0,.08);border-radius:16px;background:rgba(118,118,128,.06)}
#scannerFields .sf-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
#scannerFields .sf-head b{font-size:15px}.sf-manage{border:0;border-radius:10px;background:#e8effb;color:#2354a0;padding:9px 12px;font-weight:800;min-height:40px}
#scannerFields .sf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#scannerFields .field{margin:0}#scannerFields label{display:block;margin:0 0 6px;font-size:12px;font-weight:700;color:#6e6e73}
#scannerFields select,#scannerFields input{width:100%;min-width:0;height:48px;border:0;border-radius:12px;background:rgba(118,118,128,.10);padding:0 12px;font-size:16px;color:inherit}
#scannerFields .sf-tags{grid-column:1/-1}.sf-help{font-size:12px;color:#8e8e93;margin:10px 0 0}
#tagChoices{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}#tagChoices button{border:0;border-radius:999px;padding:7px 10px;background:#edf2f8;color:#405069;font-weight:700}#tagChoices button.active{background:#2563eb;color:#fff}
#listSync{display:block;margin-top:8px;font-size:11px;color:#8e8e93}
#listRetry{margin-top:6px;border:0;border-radius:9px;padding:7px 10px;background:#edf2f8;color:#2354a0;font-weight:700}
#listOv{display:none;position:fixed;inset:0;background:#0008;z-index:15000;align-items:center;justify-content:center;padding:12px}#listOv.show{display:flex}
#listOv .lm{background:#fff;color:#172235;width:min(540px,100%);max-height:90dvh;overflow:auto;border-radius:20px;padding:16px}
#listOv .lmh,#listOv .lmf{display:flex;align-items:center;justify-content:space-between;gap:8px}.lmh{margin-bottom:10px}.lmh button,.lmf button,#listAdd{border:0;border-radius:10px;min-height:42px;padding:8px 12px;font-weight:750}.lmf{margin-top:12px}.lmf .blue,#listAdd{background:#2563eb;color:#fff}
#listKind{width:100%;height:46px;border:1px solid #d7dee8;border-radius:11px;padding:0 10px;font-size:16px;margin-bottom:10px}.listEditRow{display:flex;gap:8px;margin:8px 0}.listEditRow input,#listNew{flex:1;min-width:0;border:1px solid #d7dee8;border-radius:10px;padding:10px;font-size:16px}.listEditRow button{border:0;border-radius:9px;padding:8px 10px;color:#b91c1c}.listNewRow{display:flex;gap:8px;margin-top:12px}#listError{color:#b91c1c;font-size:12px;min-height:18px}
#scannerPhotoFrame{position:fixed;inset:0;width:100%;height:100dvh;border:0;z-index:20000;background:#0b111b}
.preview-item:has(.sf-notes){width:170px;flex:none;overflow:visible;height:auto;background:#f1f5f9;border:1px solid #dbe3ee}.preview-item:has(.sf-notes)>img{height:110px}.sf-notes{display:grid;gap:6px;padding:7px}.sf-notes button,.sf-notes select{min-height:38px;border:0;border-radius:9px;background:#e8effb;color:#2354a0;padding:7px;font-weight:700}.sf-notes input{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font-size:15px}
#fCat{width:100%}#addOverlay .modal{width:min(720px,calc(100vw - 24px));max-width:720px}
@media(max-width:600px){#scannerFields{padding:12px}#scannerFields .sf-grid{grid-template-columns:1fr 1fr}.sf-manage{font-size:13px;padding:8px 10px}#scannerFields select,#scannerFields input{height:46px}.listEditRow{align-items:center}}
@media(max-width:420px){#scannerFields .sf-grid{grid-template-columns:1fr}.sf-tags{grid-column:auto!important}}
`;
document.head.appendChild(style);

const panel=document.createElement('div');
panel.id='scannerFields';
panel.innerHTML=`<div class="sf-head"><b>업무 정보</b><button type="button" class="sf-manage" id="sfManageAll">⚙ 항목 관리</button></div>
<div class="sf-grid">
  <div class="field"><label for="sfScope">구분</label><select id="sfScope"></select></div>
  <div class="field"><label for="sfStatus">상태</label><select id="sfStatus"></select></div>
  <div class="field"><label for="sfLocation">위치</label><select id="sfLocation"></select></div>
  <div class="field"><label for="sfTime">시간</label><input type="time" id="sfTime"></div>
  <div class="field sf-tags"><label for="sfTags">태그</label><div id="tagChoices"></div><input id="sfTags" placeholder="태그 선택 또는 쉼표로 입력"></div>
</div><div class="sf-help">구분·상태·위치·분류·태그는 ‘항목 관리’에서 한 번에 수정합니다.</div><span id="listSync"></span><button id="listRetry" type="button" hidden>동기화 재시도</button>`;
const memoField=$g('fMemo')?.closest('.field'); if(memoField) memoField.after(panel);

const modal=document.createElement('div');
modal.innerHTML=`<div id="listOv" role="dialog" aria-modal="true"><div class="lm"><div class="lmh"><b>항목 관리</b><button id="listClose">✕</button></div><select id="listKind"><option value="scope">구분</option><option value="status">상태</option><option value="location">위치</option><option value="category">분류</option><option value="tags">태그</option></select><div id="listRows"></div><div class="listNewRow"><input id="listNew" maxlength="80" placeholder="새 항목"><button id="listAdd">추가</button></div><div id="listError"></div><div class="lmf"><button id="listCancel">취소</button><button id="listSave" class="blue">저장</button></div></div></div>`;
document.body.appendChild(modal);

const LIST_KEY='fieldCards.optionLists.v2';
const NAMES={scope:'구분',status:'상태',location:'위치',category:'분류',tags:'태그'};
const FIELDS={scope:'sfScope',status:'sfStatus',location:'sfLocation',category:'fCat',tags:'sfTags'};
const mk=(label,id)=>(id?{id,label}:{id:uid(),label});
const defaults={scope:[mk('업무','work'),mk('개인','personal')],status:['발견','점검 필요','작업 중','완료'].map(x=>mk(x)),location:[],category:(Array.isArray(cats)?cats:[]).map(x=>mk(x)),tags:[]};
let lists=JSON.parse(JSON.stringify(defaults)),pending={},listRef=null,kind='scope',draft=[];
function valid(a){return Array.isArray(a)&&a.every(x=>x&&x.id&&x.label&&x.label.trim())}
try{const c=JSON.parse(localStorage.getItem(LIST_KEY)||'null');if(c?.lists)for(const k of Object.keys(NAMES))if(valid(c.lists[k]))lists[k]=c.lists[k];if(c?.pending)pending=c.pending}catch(e){}
function cache(){localStorage.setItem(LIST_KEY,JSON.stringify({lists,pending}))}
function valueFor(k,x){return k==='scope'?x.id:x.label}
function fill(k){if(k==='tags'){renderTags();return}const el=$g(FIELDS[k]);if(!el)return;const old=el.value;el.replaceChildren();el.add(new Option('선택 안 함',''));for(const x of lists[k])el.add(new Option(x.label,valueFor(k,x)));if(old&&!Array.from(el.options).some(o=>o.value===old))el.add(new Option(old+' (기존 값)',old));el.value=old}
function renderTags(){const box=$g('tagChoices'),input=$g('sfTags');if(!box||!input)return;const set=new Set(input.value.split(',').map(x=>x.trim()).filter(Boolean));box.replaceChildren();for(const x of lists.tags){const b=document.createElement('button');b.type='button';b.textContent=x.label;b.className=set.has(x.label)?'active':'';b.onclick=()=>{set.has(x.label)?set.delete(x.label):set.add(x.label);input.value=[...set].join(', ');renderTags()};box.appendChild(b)}}
function refreshAll(){for(const k of ['scope','status','location','tags'])fill(k);const cur=$g('fCat')?.value||'';cats=lists.category.map(x=>x.label);refreshCatSelects();if($g('fCat'))$g('fCat').value=cur}
function syncMsg(t){if($g('listSync'))$g('listSync').textContent=t;if($g('listRetry'))$g('listRetry').hidden=!Object.keys(pending).length}
async function sync(){if(!Object.keys(pending).length)return;if(!listRef){syncMsg('이 기기에 저장됨');return}try{const payload={};for(const k of Object.keys(pending))payload[k]=lists[k];await listRef.set(payload,{merge:true});pending={};cache();syncMsg('항목 저장 완료')}catch(e){syncMsg('이 기기에 저장됨 · 클라우드 동기화 대기')}}
async function loadCloud(){if(typeof _fbDb==='undefined'||!_fbDb||typeof _fbUser==='undefined'||!_fbUser)return;listRef=_fbDb.collection('scanapp').doc(_fbUser).collection('fieldCardSettings').doc('optionLists');try{const s=await listRef.get(),d=s.exists?s.data():{};for(const k of Object.keys(NAMES))if(!pending[k]&&valid(d[k]))lists[k]=d[k];cache();refreshAll();syncMsg('목록 불러오기 완료');await sync()}catch(e){syncMsg('이 기기 목록 사용 중')}}
function renderDraft(){const box=$g('listRows');box.replaceChildren();if(!draft.length){const p=document.createElement('p');p.textContent='등록된 항목이 없습니다.';box.appendChild(p)}draft.forEach((x,i)=>{const r=document.createElement('div');r.className='listEditRow';const inp=document.createElement('input');inp.value=x.label;inp.oninput=()=>x.label=inp.value;const del=document.createElement('button');del.type='button';del.textContent='삭제';del.onclick=()=>{draft.splice(i,1);renderDraft()};r.append(inp,del);box.appendChild(r)})}
function openManager(){kind=$g('listKind').value||'scope';draft=JSON.parse(JSON.stringify(lists[kind]));$g('listNew').value='';$g('listError').textContent='';renderDraft();$g('listOv').classList.add('show')}
function changeKind(){kind=$g('listKind').value;draft=JSON.parse(JSON.stringify(lists[kind]));$g('listNew').value='';$g('listError').textContent='';renderDraft()}
function addDraft(){const t=$g('listNew').value.trim();if(!t)return;if(draft.some(x=>x.label.trim()===t)){$g('listError').textContent='같은 이름이 이미 있습니다.';return}draft.push(mk(t));$g('listNew').value='';renderDraft()}
function saveDraft(){const clean=draft.map(x=>({...x,label:x.label.trim()})).filter(x=>x.label);if(new Set(clean.map(x=>x.label)).size!==clean.length){$g('listError').textContent='중복 이름을 확인하세요.';return}lists[kind]=clean;pending[kind]=Date.now();cache();if(kind==='category'){cats=clean.map(x=>x.label);refreshCatSelects();try{saveCats()}catch(e){}}else fill(kind);$g('listOv').classList.remove('show');syncMsg('이 기기에 저장됨 · 동기화 중');sync()}
$g('sfManageAll').onclick=openManager;$g('listKind').onchange=changeKind;$g('listAdd').onclick=addDraft;$g('listNew').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addDraft()}};$g('listSave').onclick=saveDraft;$g('listClose').onclick=$g('listCancel').onclick=()=>$g('listOv').classList.remove('show');$g('listRetry').onclick=async()=>{if(!listRef)await loadCloud();await sync()};$g('sfTags').oninput=renderTags;
refreshAll();

const oldOpen=openAddModal;
openAddModal=function(photo){oldOpen(photo);panel.hidden=curSection==='secure';for(const k of ['scope','status','location']){fill(k);const el=$g(FIELDS[k]);const v=photo?.[k]||'';if(v&&!Array.from(el.options).some(o=>o.value===v))el.add(new Option(v,v));el.value=v}const now=new Date().toLocaleTimeString('sv-SE',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'});$g('sfTime').value=photo?.time||now;$g('sfTags').value=(photo?.tags||[]).join(', ');renderTags();if(!listRef)loadCloud()};
window.ScannerFields={values:()=>curSection==='secure'?{}:{scope:$g('sfScope').value,scopeLabel:lists.scope.find(x=>x.id===$g('sfScope').value)?.label||'',status:$g('sfStatus').value,location:$g('sfLocation').value,time:$g('sfTime').value,tags:$g('sfTags').value.split(',').map(x=>x.trim()).filter(Boolean)}};

const oldEditor=openEditModal;let frame=null,cb=null,img=null,token=null,timer=null;
function dismiss(){clearTimeout(timer);frame?.remove();frame=null;cb=null;img=null;token=null}
openEditModal=function(image,callback){if(curSection!=='normal')return oldEditor(image,callback);dismiss();img=image;cb=callback;token=uid();frame=document.createElement('iframe');frame.id='scannerPhotoFrame';frame.title='사진 표시 편집';frame.src='scan-photo-editor-v15.html';document.body.appendChild(frame);timer=setTimeout(()=>{const a=img,b=cb;dismiss();toast('사진 편집기를 불러오지 못해 기존 편집기로 열었습니다');oldEditor(a,b)},12000)};
window.addEventListener('message',e=>{if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin)return;const d=e.data;if(d?.type==='scanner-photo-ready'){clearTimeout(timer);frame.contentWindow.postMessage({type:'scanner-photo-open',token,image:img},location.origin);return}if(d?.token!==token)return;if(d.type==='scanner-photo-save'&&typeof d.image==='string'&&d.image.startsWith('data:image/')){const f=cb;dismiss();f(d.image)}else if(d.type==='scanner-photo-cancel')dismiss();else if(d.type==='scanner-photo-error'){dismiss();toast('사진을 열지 못했습니다')}});

const oldPreviews=renderPreviews;
renderPreviews=function(){oldPreviews();if(curSection!=='normal')return;$g('previewList').querySelectorAll('.preview-item').forEach((item,i)=>{const m=mImgs[i];if(!m)return;const notes=document.createElement('div');notes.className='sf-notes';const edit=document.createElement('button');edit.type='button';edit.textContent='✏ 표시 편집';edit.onclick=()=>openEditModal(m.data,data=>{m.data=data;m.dirty=true;renderPreviews()});const role=document.createElement('select');for(const v of ['일반','작업 전','작업 후','현장','여행','기타'])role.add(new Option(v,v));role.value=m.role||'일반';role.onchange=()=>m.role=role.value;const cap=document.createElement('input');cap.placeholder='사진 설명';cap.value=m.caption||'';cap.oninput=()=>m.caption=cap.value;notes.append(edit,role,cap);item.appendChild(notes)})};
})();