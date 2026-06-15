/* photos-scan.js  v4.0-20260616d
   URL ?mode=personal (기본) / ?mode=work 로 개인/업무 완전 분리
   - IndexedDB: PhotoScanDB_personal / PhotoScanDB_work
   - localStorage 키: photoscan_photos_personal / photoscan_photos_work 등
   - 기본 카테고리: 영수증, 계약서, 행정문서
   - 카메라 촬영 시 자동 AI 스캔
   - AI CORS 헤더 포함
*/
'use strict';

/* ── 모드 결정 (URL 파라미터) ── */
const MODE = new URLSearchParams(location.search).get('mode') === 'work' ? 'work' : 'personal';
const MODE_LABEL  = MODE === 'work' ? '📋 업무 스캔' : '📷 개인 스캔';
const MODE_COLOR  = MODE === 'work' ? '#2563EB' : '#7C3AED';

const FIREBASE_PROJECT = 'my-system-25497';
const FIREBASE_API_KEY = 'AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

/* ── 모드별 스토리지 키 분리 ── */
const LS_PHOTOS  = `photoscan_photos_${MODE}`;
const LS_CATS    = `photoscan_cats_${MODE}`;
const LS_API_KEY = 'photoscan_anthropic_key'; // API 키는 공용
const IDB_NAME   = `PhotoScanDB_${MODE}`;
const DEFAULT_CATS = ['영수증', '계약서', '행정문서'];

/* ── IndexedDB ── */
let idb = null;
function openIDB(){
  return new Promise((res,rej)=>{
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('images',{keyPath:'id'});
    req.onsuccess = e => { idb = e.target.result; res(idb); };
    req.onerror   = rej;
  });
}
const idbPut    = (id,dataUrl) => new Promise((res,rej)=>{ const tx=idb.transaction('images','readwrite'); tx.objectStore('images').put({id,dataUrl}); tx.oncomplete=res; tx.onerror=rej; });
const idbGet    = id => new Promise((res,rej)=>{ const req=idb.transaction('images','readonly').objectStore('images').get(id); req.onsuccess=e=>res(e.target.result?e.target.result.dataUrl:null); req.onerror=rej; });
const idbDelete = id => new Promise((res,rej)=>{ const tx=idb.transaction('images','readwrite'); tx.objectStore('images').delete(id); tx.oncomplete=res; tx.onerror=rej; });
const idbGetAll = ()  => new Promise((res,rej)=>{ const req=idb.transaction('images','readonly').objectStore('images').getAll(); req.onsuccess=e=>res(e.target.result); req.onerror=rej; });

/* ── State ── */
let photos=[], categories=[], currentFilter='all', currentSearch='';

function loadData(){
  try{ photos     = JSON.parse(localStorage.getItem(LS_PHOTOS) || '[]'); }     catch{ photos=[]; }
  try{ categories = JSON.parse(localStorage.getItem(LS_CATS)   || JSON.stringify(DEFAULT_CATS)); } catch{ categories=[...DEFAULT_CATS]; }
}
const savePhotos     = () => localStorage.setItem(LS_PHOTOS, JSON.stringify(photos));
const saveCategories = () => localStorage.setItem(LS_CATS,   JSON.stringify(categories));
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().slice(0,10);

/* ── Toast ── */
let toastTimer;
function showToast(msg, dur=2500){
  const t = document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), dur);
}

/* ── Modal ── */
const openModal  = id => document.getElementById(id).classList.add('open');
const closeModal = id => document.getElementById(id).classList.remove('open');

/* ── 사이드 메뉴 ── */
const openSideMenu  = () => { document.getElementById('sideMenu').classList.add('open');    document.getElementById('sideOverlay').classList.add('open'); };
const closeSideMenu = () => { document.getElementById('sideMenu').classList.remove('open'); document.getElementById('sideOverlay').classList.remove('open'); };

/* ── 이미지 리사이즈 (AI 전송용) ── */
function resizeForAI(dataUrl, maxPx=1024){
  return new Promise(res=>{
    const img = new Image();
    img.onload = ()=>{
      const scale = Math.min(maxPx/img.width, maxPx/img.height, 1);
      const c = document.createElement('canvas');
      c.width  = Math.round(img.width*scale);
      c.height = Math.round(img.height*scale);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      res(c.toDataURL('image/jpeg',0.85));
    };
    img.src = dataUrl;
  });
}

/* ── Anthropic API 호출 공통 ── */
async function callAI(messages, maxTokens=512){
  const key = localStorage.getItem(LS_API_KEY)||'';
  if(!key) throw new Error('API 키 없음 — ⚙️ 설정에서 입력하세요');
  const resp = await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:maxTokens, messages })
  });
  if(!resp.ok){
    const err = await resp.json().catch(()=>({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  if(data.error) throw new Error(data.error.message);
  return (data.content||[]).map(b=>b.text||'').join('').trim();
}

/* ── 필터칩 렌더 ── */
function renderFilterChips(){
  const area = document.getElementById('filterChips');
  area.innerHTML = '';

  const all = document.createElement('button');
  all.className = 'chip'+(currentFilter==='all'?' active':'');
  all.textContent = '전체';
  all.onclick = ()=>{ currentFilter='all'; renderFilterChips(); renderGallery(); };
  area.appendChild(all);

  categories.forEach(c=>{
    const chip  = document.createElement('button');
    chip.className = 'chip'+(currentFilter===c?' active':'');

    const lbl = document.createElement('span');
    lbl.textContent = c;
    lbl.onclick = e=>{ e.stopPropagation(); currentFilter=c; renderFilterChips(); renderGallery(); };

    const del = document.createElement('span');
    del.className = 'chip-del';
    del.textContent = '✕';
    del.title = `"${c}" 삭제`;
    del.onclick = e=>{
      e.stopPropagation();
      if(DEFAULT_CATS.includes(c)){ showToast(`"${c}"은 기본 카테고리라 삭제할 수 없습니다`); return; }
      if(!confirm(`"${c}" 카테고리를 삭제할까요?`)) return;
      categories = categories.filter(x=>x!==c);
      saveCategories();
      if(currentFilter===c) currentFilter='all';
      renderFilterChips(); renderGallery(); populateCatSelect();
    };

    chip.appendChild(lbl);
    chip.appendChild(del);
    area.appendChild(chip);
  });
}

/* ── 카테고리 select ── */
function populateCatSelect(selected){
  const sel  = document.getElementById('photoCat');
  const prev = selected || sel.value || categories[0] || '';
  sel.innerHTML = categories.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(prev && categories.includes(prev)) sel.value = prev;
}

/* ── 갤러리 렌더 ── */
async function renderGallery(){
  const grid  = document.getElementById('photoGrid');
  const empty = document.getElementById('emptyState');
  const q = currentSearch.toLowerCase();
  const list = photos.filter(p=>{
    const mc = currentFilter==='all' || p.cat===currentFilter;
    const mt = !q || (p.title||'').toLowerCase().includes(q) || (p.memo||'').toLowerCase().includes(q);
    return mc && mt;
  }).sort((a,b)=>b.id.localeCompare(a.id));

  grid.querySelectorAll('.photo-card').forEach(c=>c.remove());
  empty.style.display = list.length ? 'none' : '';

  for(const p of list){
    const card = document.createElement('div');
    card.className = 'photo-card';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-img-wrap';

    const img = document.createElement('img');
    img.className='card-img'; img.alt=p.title||'';
    imgWrap.appendChild(img);

    if((p.imgIds||[]).length>1){
      const mb=document.createElement('span');
      mb.className='card-multi'; mb.textContent='×'+p.imgIds.length;
      imgWrap.appendChild(mb);
    }

    const acts = document.createElement('div');
    acts.className = 'card-actions';
    acts.innerHTML = '<button class="card-act-btn edit">✏️ 수정</button><button class="card-act-btn del">🗑 삭제</button>';
    acts.querySelector('.edit').onclick = e=>{ e.stopPropagation(); openEditMetaModal(p.id); };
    acts.querySelector('.del').onclick  = e=>{ e.stopPropagation(); deletePhoto(p.id); };
    imgWrap.appendChild(acts);

    const firstId = (p.imgIds||[])[0];
    if(firstId) idbGet(firstId).then(url=>{ if(url) img.src=url; });

    const body = document.createElement('div');
    body.className='card-body';
    body.innerHTML=`<div class="card-title">${p.title||'(제목 없음)'}</div>
      <div class="card-meta"><span class="badge">${p.cat||''}</span><span class="card-date">${(p.date||'').slice(5)}</span></div>`;

    card.appendChild(imgWrap);
    card.appendChild(body);
    card.onclick = ()=>openViewModal(p.id);
    grid.insertBefore(card, empty);
  }
}

/* ── 추가/수정 모달 ── */
let modalImages=[], modalSlide=0, editingPhotoId=null;

function openAddModal(preImages=[]){
  editingPhotoId=null; modalImages=preImages; modalSlide=0;
  document.getElementById('modalAddTitle').textContent = '사진 추가';
  document.getElementById('photoTitle').value='';
  document.getElementById('photoMemo').value='';
  document.getElementById('photoDate').value=today();
  document.getElementById('aiCropStatus').textContent='';
  populateCatSelect();
  renderModalSlides();
  openModal('modalAdd');
}

async function openEditMetaModal(pid){
  const p=photos.find(x=>x.id===pid); if(!p) return;
  editingPhotoId=pid; modalImages=[]; modalSlide=0;
  document.getElementById('modalAddTitle').textContent='사진 수정';
  document.getElementById('photoTitle').value=p.title||'';
  document.getElementById('photoMemo').value=p.memo||'';
  document.getElementById('photoDate').value=p.date||today();
  document.getElementById('aiCropStatus').textContent='';
  populateCatSelect(p.cat);
  const imgs = await Promise.all((p.imgIds||[]).map(id=>idbGet(id).then(url=>({id,dataUrl:url}))));
  modalImages = imgs.filter(x=>x.dataUrl);
  renderModalSlides();
  openModal('modalAdd');
}

function renderModalSlides(){
  const wrap = document.getElementById('imgSlides');
  wrap.innerHTML='';
  if(!modalImages.length){
    wrap.innerHTML='<div class="no-img-placeholder">사진 없음</div>';
    document.getElementById('slideCount').textContent='0 / 0';
    return;
  }
  modalImages.forEach((m,i)=>{
    const img=document.createElement('img');
    img.src=m.dataUrl; img.alt='';
    if(i===modalSlide) img.classList.add('active');
    wrap.appendChild(img);
  });
  document.getElementById('slideCount').textContent=`${modalSlide+1} / ${modalImages.length}`;
}
function goSlide(dir){
  if(!modalImages.length) return;
  modalSlide=(modalSlide+dir+modalImages.length)%modalImages.length;
  renderModalSlides();
}

async function savePhoto(){
  const title = document.getElementById('photoTitle').value.trim();
  const cat   = document.getElementById('photoCat').value;
  const memo  = document.getElementById('photoMemo').value.trim();
  const date  = document.getElementById('photoDate').value||today();
  if(!modalImages.length){ showToast('사진을 1장 이상 추가하세요'); return; }
  if(!title){ showToast('제목을 입력하세요'); return; }

  if(editingPhotoId){
    const p=photos.find(x=>x.id===editingPhotoId); if(!p) return;
    await Promise.all((p.imgIds||[]).map(id=>idbDelete(id)));
    const newIds=[];
    for(const m of modalImages){ const nid=m.id||uid(); await idbPut(nid,m.dataUrl); newIds.push(nid); }
    p.title=title; p.cat=cat; p.memo=memo; p.date=date; p.imgIds=newIds;
  } else {
    const pid=uid(); const imgIds=[];
    for(const m of modalImages){ const iid=uid(); await idbPut(iid,m.dataUrl); imgIds.push(iid); }
    photos.unshift({id:pid,title,cat,memo,date,imgIds});
  }
  savePhotos(); closeModal('modalAdd'); renderGallery(); showToast('저장되었습니다');
}

/* ── 파일 처리 ── */
async function handleFiles(files, append=false, autoScan=false){
  const results=[];
  for(const f of Array.from(files)){
    let blob=f;
    if(f.name?.toLowerCase().endsWith('.heic')||f.type==='image/heic'){
      try{ blob=await heic2any({blob:f,toType:'image/jpeg',quality:0.92}); } catch(e){ console.warn(e); }
    }
    results.push({id:uid(), dataUrl:await blobToDataUrl(blob)});
  }
  if(append){ modalImages.push(...results); renderModalSlides(); }
  else{
    openAddModal(results);
    if(autoScan && results.length===1) setTimeout(()=>aiDocCrop(true), 500);
  }
}
const blobToDataUrl = blob => new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(blob); });

/* ── AI 문서 자동감지 크롭 (2단계 정교 분석) ── */
async function aiDocCrop(silent=false){
  if(!modalImages.length){ if(!silent) showToast('먼저 사진을 추가하세요'); return; }
  const key = localStorage.getItem(LS_API_KEY)||'';
  if(!key){
    document.getElementById('aiCropStatus').textContent='⚠️ AI 키 없음 — ⚙️에서 설정하세요';
    return;
  }
  const statusEl = document.getElementById('aiCropStatus');
  const btn      = document.getElementById('btnAiCrop');
  const overlay  = document.getElementById('scanOverlay');
  btn.disabled=true;
  if(silent) overlay.style.display='flex';
  else statusEl.textContent='🤖 1단계: 문서 감지 중...';

  try{
    const m = modalImages[modalSlide];

    /* ── 1단계: 문서 존재 여부 + 대략 위치 ── */
    const small = await resizeForAI(m.dataUrl, 1600); // 고해상도로 전송
    const [mtype, base64] = getB64Parts(small);

    const prompt1 = `이 이미지를 분석해서 문서(영수증, 계약서, 명함, 인쇄된 종이 등)가 있는지 찾아주세요.

규칙:
- 이미지 전체가 문서이거나, 배경 위에 문서가 놓인 경우 모두 포함
- 문서의 네 꼭짓점을 픽셀 좌표로 최대한 정확히 찾아주세요
- 이미지 크기는 ${await getImgSize(m.dataUrl)}

응답 형식(JSON만, 다른 텍스트 없이):
문서가 있는 경우: {"hasDoc":true,"x1":픽셀,"y1":픽셀,"x2":픽셀,"y2":픽셀,"x3":픽셀,"y3":픽셀,"x4":픽셀,"y4":픽셀}
(x1,y1=좌상, x2,y2=우상, x3,y3=우하, x4,y4=좌하 순서)
문서가 없는 경우: {"hasDoc":false}`;

    const text1 = await callAI([{
      role:'user',
      content:[
        {type:'image', source:{type:'base64', media_type:mtype, data:base64}},
        {type:'text',  text:prompt1}
      ]
    }], 300);

    const j1 = JSON.parse(text1.replace(/```json|```/g,'').trim());
    if(!j1.hasDoc){
      statusEl.textContent='✓ 문서를 찾지 못했습니다';
      return;
    }

    /* ── 2단계: 꼭짓점 좌표로 정밀 크롭 ── */
    if(!silent) statusEl.textContent='🤖 2단계: 정밀 크롭 중...';

    // 원본 이미지 크기 가져오기
    const origSize = await getImgSize(m.dataUrl);
    const [origW, origH] = origSize.split('x').map(Number);

    // 리사이즈된 이미지 기준 좌표 → 원본 좌표로 변환
    const resized = await resizeForAI(m.dataUrl, 1600);
    const resizedSize = await getImgSize(resized);
    const [rW, rH] = resizedSize.split('x').map(Number);
    const scaleX = origW / rW;
    const scaleY = origH / rH;

    // 4개 꼭짓점에서 bounding box 계산
    const xs = [j1.x1, j1.x2, j1.x3, j1.x4].map(v => Math.round((+v||0) * scaleX));
    const ys = [j1.y1, j1.y2, j1.y3, j1.y4].map(v => Math.round((+v||0) * scaleY));
    const minX = Math.max(0, Math.min(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxX = Math.min(origW, Math.max(...xs));
    const maxY = Math.min(origH, Math.max(...ys));

    // 여백 5% 추가
    const padX = Math.round((maxX - minX) * 0.02);
    const padY = Math.round((maxY - minY) * 0.02);
    const sx = Math.max(0, minX - padX);
    const sy = Math.max(0, minY - padY);
    const sw = Math.min(origW - sx, maxX - minX + padX*2);
    const sh = Math.min(origH - sy, maxY - minY + padY*2);

    if(sw < 50 || sh < 50) throw new Error('문서 크롭 영역이 너무 작습니다');

    const cropped = await cropImageByPixel(m.dataUrl, sx, sy, sw, sh);
    modalImages[modalSlide].dataUrl = cropped;
    renderModalSlides();
    statusEl.textContent = `✅ 정밀 크롭 완료 (${sw}×${sh}px)`;

  } catch(e){
    console.error('AI Crop:', e);
    statusEl.textContent = '⚠️ ' + e.message;
  } finally{
    btn.disabled = false;
    overlay.style.display = 'none';
  }
}

/* 이미지 크기 반환 "WxH" */
function getImgSize(dataUrl){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>res(`${img.width}x${img.height}`);
    img.src=dataUrl;
  });
}
/* base64 분리 */
function getB64Parts(dataUrl){
  const parts=dataUrl.split(';base64,');
  return [parts[0].replace('data:',''), parts[1]];
}
/* 픽셀 단위 크롭 */
function cropImageByPixel(dataUrl, sx, sy, sw, sh){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      c.width=sw; c.height=sh;
      c.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,sw,sh);
      res(c.toDataURL('image/jpeg',0.95));
    };
    img.src=dataUrl;
  });
}

function cropImageDataUrl(dataUrl,rx,ry,rw,rh){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      const sx=Math.round(rx*img.width), sy=Math.round(ry*img.height);
      const sw=Math.round(rw*img.width), sh=Math.round(rh*img.height);
      c.width=sw; c.height=sh;
      c.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,sw,sh);
      res(c.toDataURL('image/jpeg',0.92));
    };
    img.src=dataUrl;
  });
}

/* ── AI 검색 ── */
async function aiSearch(){
  const query = document.getElementById('aiSearchQuery').value.trim();
  if(!query) return;
  const resultEl = document.getElementById('aiSearchResult');
  resultEl.innerHTML='<div class="loading">검색 중</div>';
  const index = photos.map(p=>({id:p.id,title:p.title,cat:p.cat,memo:p.memo,date:p.date}));
  try{
    const text = await callAI([{
      role:'user',
      content:`사진 목록:\n${JSON.stringify(index)}\n\n검색: "${query}"\n\n관련 사진을 JSON 배열로 반환: [{"id":"xxx","reason":"이유"}]. JSON만 반환.`
    }],1024);
    const found = JSON.parse(text.replace(/```json|```/g,'').trim());
    if(!found.length){ resultEl.innerHTML='<p style="color:#aaa;font-size:14px">관련 사진을 찾지 못했습니다.</p>'; return; }
    resultEl.innerHTML='';
    for(const r of found){
      const p=photos.find(x=>x.id===r.id); if(!p) continue;
      const card=document.createElement('div'); card.className='result-card';
      card.innerHTML=`<div class="result-title">${p.title||'(제목 없음)'}</div><div class="result-meta">${p.cat||''} · ${p.date||''}</div><div class="result-reason">${r.reason}</div>`;
      card.onclick=()=>{ document.getElementById('panelSearch').classList.remove('open'); openViewModal(p.id); };
      resultEl.appendChild(card);
    }
  } catch(e){ resultEl.innerHTML=`<p style="color:red;font-size:13px">오류: ${e.message}</p>`; }
}

/* ── 상세 보기 ── */
let viewPhotoId=null, viewSlide=0, viewImgIds=[];
async function openViewModal(pid){
  const p=photos.find(x=>x.id===pid); if(!p) return;
  viewPhotoId=pid; viewSlide=0; viewImgIds=p.imgIds||[];
  document.getElementById('viewTitle').textContent=p.title||'(제목 없음)';
  document.getElementById('viewCat').textContent=p.cat||'';
  document.getElementById('viewDate').textContent=p.date||'';
  document.getElementById('viewMemo').textContent=p.memo||'';
  await updateViewImg();
  openModal('modalView');
}
async function updateViewImg(){
  const url = viewImgIds[viewSlide] ? await idbGet(viewImgIds[viewSlide]) : null;
  document.getElementById('viewImg').src=url||'';
  const show=viewImgIds.length>1;
  document.getElementById('btnViewPrev').style.display=show?'':'none';
  document.getElementById('btnViewNext').style.display=show?'':'none';
}
async function viewNavSlide(dir){
  viewSlide=(viewSlide+dir+viewImgIds.length)%viewImgIds.length;
  await updateViewImg();
}
async function deletePhoto(pid){
  if(!confirm('이 사진을 삭제할까요?')) return;
  const idx=photos.findIndex(x=>x.id===pid); if(idx<0) return;
  await Promise.all((photos[idx].imgIds||[]).map(id=>idbDelete(id)));
  photos.splice(idx,1); savePhotos();
  closeModal('modalView'); renderGallery(); showToast('삭제되었습니다');
}

/* ── 공유 ── */
async function sharePhoto(){
  const url=document.getElementById('viewImg').src;
  if(!url){ showToast('사진이 없습니다'); return; }
  try{
    const blob=await fetch(url).then(r=>r.blob());
    const file=new File([blob],'photo.jpg',{type:'image/jpeg'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:document.getElementById('viewTitle').textContent});
    } else {
      const a=document.createElement('a'); a.href=url; a.download='photo.jpg'; a.click();
      showToast('다운로드로 저장했습니다');
    }
  } catch(e){ if(e.name!=='AbortError') showToast('공유 오류: '+e.message); }
}

/* ── 백업 ── */
async function exportBackup(){
  showToast('백업 생성 중...');
  const allImages=await idbGetAll();
  const blob=new Blob([JSON.stringify({mode:MODE,photos,categories,images:allImages},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`photoscan-${MODE}-backup-${today()}.json`; a.click();
  showToast('백업 완료');
}
async function importBackup(file){
  try{
    const data=JSON.parse(await file.text());
    if(!data.photos||!data.images){ showToast('올바른 백업 파일이 아닙니다'); return; }
    if(!confirm(`백업 불러오기 — 현재 ${MODE==='work'?'업무':'개인'} 데이터가 대체됩니다.\n사진 ${data.photos.length}개`)) return;
    for(const img of data.images) await idbPut(img.id,img.dataUrl);
    photos=data.photos; categories=data.categories||categories;
    savePhotos(); saveCategories();
    renderFilterChips(); renderGallery(); populateCatSelect();
    showToast('백업 불러오기 완료');
  } catch(e){ showToast('파일 읽기 오류'); }
}
async function firebaseBackupMeta(){
  try{
    const docId = `photoscan-${MODE}-meta`;
    await fetch(`${FS_BASE}/photoscan/${docId}?key=${FIREBASE_API_KEY}`,{
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({fields:{
        mode:{stringValue:MODE},
        photos:{stringValue:JSON.stringify(photos)},
        categories:{stringValue:JSON.stringify(categories)},
        updatedAt:{stringValue:new Date().toISOString()}
      }})
    });
    showToast('☁️ 클라우드 백업 완료');
  } catch(e){ showToast('클라우드 백업 실패'); }
}

/* ── Fabric.js 편집기 ── */
let canvas=null, editImgId=null, editTool='select', cropRect=null;
let mosaicActive=false; // 드래그 모자이크 상태

function openEditor(){
  if(!modalImages.length){ showToast('사진을 먼저 추가하세요'); return; }
  editImgId = modalImages[modalSlide].id;
  closeModal('modalAdd');
  openModal('modalEdit');
  setTimeout(()=>initCanvas(modalImages[modalSlide].dataUrl), 120);
}

function initCanvas(dataUrl){
  const wrapper = document.getElementById('canvasWrapper');
  const maxW = Math.min(wrapper.clientWidth - 20, 700);
  const maxH = Math.min(wrapper.clientHeight - 20, 540);
  if(canvas){ canvas.dispose(); canvas=null; }

  canvas = new fabric.Canvas('editCanvas', {
    selection: true,
    preserveObjectStacking: true,
    stopContextMenu: true,
    fireRightClick: false
  });

  fabric.Image.fromURL(dataUrl, img=>{
    const scale = Math.min(maxW/img.width, maxH/img.height, 1);
    const cw = Math.round(img.width * scale);
    const ch = Math.round(img.height * scale);
    canvas.setWidth(cw);
    canvas.setHeight(ch);
    img.set({ scaleX:scale, scaleY:scale, selectable:false, evented:false });
    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));

    /* 모자이크 드래그 이벤트 */
    canvas.on('mouse:down', opt=>{
      if(editTool==='mosaic'){ mosaicActive=true; applyMosaicAt(opt.e); }
    });
    canvas.on('mouse:move', opt=>{
      if(editTool==='mosaic' && mosaicActive) applyMosaicAt(opt.e);
    });
    canvas.on('mouse:up', ()=>{ mosaicActive=false; });

    // 터치 이벤트도 모자이크 지원
    canvas.upperCanvasEl.addEventListener('touchstart', e=>{
      if(editTool==='mosaic'){ mosaicActive=true; applyMosaicAt(e.touches[0]); e.preventDefault(); }
    }, {passive:false});
    canvas.upperCanvasEl.addEventListener('touchmove', e=>{
      if(editTool==='mosaic' && mosaicActive){ applyMosaicAt(e.touches[0]); e.preventDefault(); }
    }, {passive:false});
    canvas.upperCanvasEl.addEventListener('touchend', ()=>{ mosaicActive=false; });

  }, {crossOrigin:'anonymous'});
  setTool('select');
}

function setTool(tool){
  editTool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>b.classList.toggle('active', b.dataset.tool===tool));
  document.getElementById('cropControls').classList.add('hidden');
  document.getElementById('textInputRow').classList.add('hidden');
  document.getElementById('lblMosaic').style.display  = 'none';
  document.getElementById('mosaicSize').style.display = 'none';
  if(!canvas) return;

  canvas.isDrawingMode = false;
  canvas.selection     = true;
  canvas.defaultCursor = 'default';

  if(tool==='draw'){
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush.width = parseInt(document.getElementById('toolSize').value);
    canvas.freeDrawingBrush.color = document.getElementById('toolColor').value;
  } else if(tool==='crop'){
    canvas.selection = false;
    document.getElementById('cropControls').classList.remove('hidden');
    startCropMode();
  } else if(tool==='text'){
    document.getElementById('textInputRow').classList.remove('hidden');
    canvas.defaultCursor = 'text';
  } else if(tool==='mosaic'){
    document.getElementById('lblMosaic').style.display  = '';
    document.getElementById('mosaicSize').style.display = '';
    canvas.selection     = false;
    canvas.defaultCursor = 'crosshair';
  }
}

/* 크롭 박스 — 핸들 크게, 터치 정교하게 */
function startCropMode(){
  if(cropRect) canvas.remove(cropRect);
  const pad = 30;
  cropRect = new fabric.Rect({
    left:   pad,
    top:    pad,
    width:  canvas.width  - pad*2,
    height: canvas.height - pad*2,
    fill:             'rgba(0,0,0,0.0)',
    stroke:           '#3F7CB8',
    strokeWidth:      2.5,
    strokeDashArray:  [8,4],
    cornerColor:      '#fff',
    cornerStrokeColor:'#3F7CB8',
    cornerSize:       20,          // 터치하기 쉽게 크게
    cornerStyle:      'circle',
    transparentCorners: false,
    borderColor:      '#3F7CB8',
    borderDashArray:  [6,3],
    hasRotatingPoint: false,       // 회전 핸들 숨김
    lockRotation:     true,
    minScaleLimit:    0.1,
    padding:          6
  });

  // 반투명 어두운 오버레이 (크롭 외부)
  canvas.clipPath = null;
  canvas.add(cropRect);
  canvas.setActiveObject(cropRect);

  // 크롭 박스 외부 어둡게
  cropRect.on('moving',   updateCropOverlay);
  cropRect.on('scaling',  updateCropOverlay);
  cropRect.on('modified', updateCropOverlay);

  canvas.renderAll();
}

let cropOverlays = [];
function updateCropOverlay(){
  cropOverlays.forEach(o=>canvas.remove(o));
  cropOverlays=[];
  if(!cropRect) return;

  const r   = cropRect.getBoundingRect(true);
  const cw  = canvas.width;
  const ch  = canvas.height;

  const rects=[
    {left:0,        top:0,     width:r.left,             height:ch},
    {left:r.left+r.width, top:0, width:cw-(r.left+r.width), height:ch},
    {left:r.left,   top:0,     width:r.width,             height:r.top},
    {left:r.left,   top:r.top+r.height, width:r.width, height:ch-(r.top+r.height)}
  ];
  rects.forEach(opts=>{
    if(opts.width<=0||opts.height<=0) return;
    const o = new fabric.Rect({...opts, fill:'rgba(0,0,0,0.45)', selectable:false, evented:false});
    cropOverlays.push(o);
    canvas.add(o);
    canvas.sendToBack(o);
  });
  canvas.bringToFront(cropRect);
  canvas.renderAll();
}

function applyCrop(){
  if(!cropRect) return;

  // 현재 크롭 박스의 실제 화면 좌표
  const br = cropRect.getBoundingRect(true);
  const cw = canvas.width, ch = canvas.height;

  // 비율 계산
  const rx = Math.max(0, br.left / cw);
  const ry = Math.max(0, br.top  / ch);
  const rw = Math.min(1-rx, br.width  / cw);
  const rh = Math.min(1-ry, br.height / ch);

  // 오버레이 제거
  cropOverlays.forEach(o=>canvas.remove(o));
  cropOverlays=[];
  canvas.remove(cropRect);
  cropRect=null;

  // 현재 편집 canvas를 이미지로 내보내고 크롭
  const fullDataUrl = canvas.toDataURL({format:'jpeg', quality:0.95});
  cropImageByPixel(
    fullDataUrl,
    Math.round(rx*canvas.width),
    Math.round(ry*canvas.height),
    Math.round(rw*canvas.width),
    Math.round(rh*canvas.height)
  ).then(cropped=>{
    // modalImages에 즉시 반영
    const idx = modalImages.findIndex(m=>m.id===editImgId);
    if(idx>=0) modalImages[idx].dataUrl = cropped;
    initCanvas(cropped);
    document.getElementById('cropControls').classList.add('hidden');
    showToast('✂️ 잘라내기 완료');
  });
}

/* 회전 */
function rotateImage(deg){
  if(!canvas) return;
  const dataUrl = canvas.toDataURL({format:'jpeg', quality:0.95});
  const img = new Image();
  img.onload = ()=>{
    const c = document.createElement('canvas');
    if(deg===90||deg===-90){ c.width=img.height; c.height=img.width; }
    else { c.width=img.width; c.height=img.height; }
    const ctx = c.getContext('2d');
    ctx.translate(c.width/2, c.height/2);
    ctx.rotate(deg * Math.PI/180);
    ctx.drawImage(img, -img.width/2, -img.height/2);
    const rotated = c.toDataURL('image/jpeg', 0.95);
    const idx = modalImages.findIndex(m=>m.id===editImgId);
    if(idx>=0) modalImages[idx].dataUrl = rotated;
    initCanvas(rotated);
  };
  img.src = dataUrl;
}

/* 텍스트 */
function addText(){
  const txt = document.getElementById('textInput').value; if(!txt) return;
  const t = new fabric.Text(txt, {
    left:40, top:40,
    fill:     document.getElementById('toolColor').value,
    fontSize: parseInt(document.getElementById('toolSize').value)*5+16,
    fontFamily:'Arial', fontWeight:'bold',
    shadow:   'rgba(0,0,0,0.4) 1px 1px 3px'
  });
  canvas.add(t); canvas.setActiveObject(t); canvas.renderAll();
  document.getElementById('textInput').value='';
  setTool('select');
}

/* 도형 */
function addShape(type){
  const color = document.getElementById('toolColor').value;
  const sw    = parseInt(document.getElementById('toolSize').value);
  const shape = type==='rect'
    ? new fabric.Rect({left:60,top:60,width:150,height:100,fill:'transparent',stroke:color,strokeWidth:sw,cornerSize:14})
    : new fabric.Ellipse({left:60,top:60,rx:75,ry:50,fill:'transparent',stroke:color,strokeWidth:sw,cornerSize:14});
  canvas.add(shape); canvas.setActiveObject(shape); canvas.renderAll();
  setTool('select');
}

/* 화살표 */
function addArrow(){
  const color = document.getElementById('toolColor').value;
  const sw    = parseInt(document.getElementById('toolSize').value);
  const len   = 120;

  // 화살표 몸통 + 머리 (triangle)
  const line = new fabric.Line([50, 100, 50+len, 100], {
    stroke:color, strokeWidth:sw, selectable:false
  });
  const head = new fabric.Triangle({
    width: sw*5+8, height: sw*5+12,
    fill:  color,
    left:  50+len, top:100,
    angle: 90,
    originX:'center', originY:'center',
    selectable:false
  });
  const group = new fabric.Group([line, head], {
    left:80, top:80, cornerSize:14,
    hasRotatingPoint:true
  });
  canvas.add(group); canvas.setActiveObject(group); canvas.renderAll();
  setTool('select');
}

/* 모자이크 — 터치/마우스 드래그 */
function applyMosaicAt(e){
  if(!canvas) return;
  // 캔버스 기준 좌표 계산
  const rect = canvas.upperCanvasEl.getBoundingClientRect();
  const pt   = {
    x: (e.clientX - rect.left),
    y: (e.clientY - rect.top)
  };
  const sz  = parseInt(document.getElementById('mosaicSize').value)||40;
  const bg  = canvas.backgroundImage; if(!bg) return;
  const bgEl= bg.getElement();
  // 원본 이미지 픽셀 좌표
  const sx = Math.round((pt.x - sz/2) / (bg.scaleX||1));
  const sy = Math.round((pt.y - sz/2) / (bg.scaleY||1));
  const sw = Math.round(sz / (bg.scaleX||1));
  const sh = Math.round(sz / (bg.scaleY||1));

  const tc = document.createElement('canvas');
  tc.width=Math.max(1,sw); tc.height=Math.max(1,sh);
  tc.getContext('2d').drawImage(bgEl, sx, sy, sw, sh, 0, 0, sw, sh);

  // 픽셀화
  const pb = Math.max(3, Math.round(sz/10));
  const pc = document.createElement('canvas');
  pc.width=pb; pc.height=pb;
  const pctx = pc.getContext('2d');
  pctx.imageSmoothingEnabled=false;
  pctx.drawImage(tc, 0, 0, pb, pb);

  // 확대해서 모자이크 타일 완성
  const mc = document.createElement('canvas');
  mc.width=sz; mc.height=sz;
  const mctx = mc.getContext('2d');
  mctx.imageSmoothingEnabled=false;
  mctx.drawImage(pc, 0, 0, sz, sz);

  fabric.Image.fromURL(mc.toDataURL(), mImg=>{
    mImg.set({
      left:pt.x-sz/2, top:pt.y-sz/2,
      width:sz, height:sz,
      scaleX:1, scaleY:1,
      selectable:false, evented:false,
      opacity:1
    });
    canvas.add(mImg);
    canvas.renderAll();
  });
}

/* 편집 완료 → modalImages 반영 후 추가모달로 */
function finishEdit(){
  if(!canvas) return;
  // 크롭 오버레이 정리
  cropOverlays.forEach(o=>canvas.remove(o)); cropOverlays=[];
  if(cropRect){ canvas.remove(cropRect); cropRect=null; }
  canvas.renderAll();

  const dataUrl = canvas.toDataURL({format:'jpeg', quality:0.95});
  const idx = modalImages.findIndex(m=>m.id===editImgId);
  if(idx>=0){
    modalImages[idx].dataUrl = dataUrl;
  } else {
    // id 못 찾으면 현재 슬라이드에 반영
    if(modalImages[modalSlide]) modalImages[modalSlide].dataUrl = dataUrl;
  }
  closeModal('modalEdit');
  openModal('modalAdd');
  renderModalSlides();
  showToast('✅ 편집 내용이 저장되었습니다');
}

/* ── 카테고리 추가 공통 함수 ── */
function addCategory(name){
  const n = name?.trim();
  if(!n) return;
  if(categories.includes(n)){ showToast('이미 있는 카테고리'); return; }
  categories.push(n); saveCategories();
  renderFilterChips(); populateCatSelect(n);
  showToast(`"${n}" 추가됨`);
}

/* ── Init ── */
async function init(){
  await openIDB();
  loadData();

  /* 모드별 UI 적용 */
  document.getElementById('appTitle').textContent  = MODE_LABEL;
  document.getElementById('sideTitle').textContent = MODE_LABEL;
  document.title = MODE_LABEL;
  document.querySelector('.app-title').style.color = MODE_COLOR;
  // 헤더 배경 모드 표시줄
  const modeBar = document.createElement('div');
  modeBar.style.cssText = `position:fixed;top:0;left:0;right:0;height:3px;background:${MODE_COLOR};z-index:200;`;
  document.body.appendChild(modeBar);

  renderFilterChips();
  renderGallery();
  populateCatSelect();

  /* 헤더 */
  document.getElementById('btnMenu').onclick     = openSideMenu;
  document.getElementById('sideOverlay').onclick = closeSideMenu;
  document.getElementById('btnMenuClose').onclick= closeSideMenu;
  document.getElementById('btnSearch').onclick   = ()=>document.getElementById('panelSearch').classList.add('open');
  document.getElementById('btnBackup').onclick   = firebaseBackupMeta;
  document.getElementById('btnSettings').onclick = ()=>openModal('modalApiKey');

  /* 사이드 메뉴 */
  document.getElementById('mnuApiKey').onclick       = ()=>{ closeSideMenu(); openModal('modalApiKey'); };
  document.getElementById('mnuBackupExport').onclick = ()=>{ closeSideMenu(); exportBackup(); };
  document.getElementById('mnuBackupImport').onclick = ()=>{ closeSideMenu(); document.getElementById('backupInput').click(); };

  /* 카메라(자동스캔) / 갤러리 */
  document.getElementById('btnCamera').onclick  = ()=>document.getElementById('fileInputCamera').click();
  document.getElementById('btnGallery').onclick = ()=>document.getElementById('fileInputGallery').click();
  document.getElementById('fileInputCamera').onchange  = e=>{ if(e.target.files.length) handleFiles(e.target.files,false,true); e.target.value=''; };
  document.getElementById('fileInputGallery').onchange = e=>{ if(e.target.files.length) handleFiles(e.target.files); e.target.value=''; };

  /* 검색 */
  document.getElementById('gallerySearch').oninput = e=>{ currentSearch=e.target.value; renderGallery(); };

  /* 필터칩 카테고리 추가 */
  document.getElementById('btnAddCat').onclick = ()=>{
    const n=prompt('새 카테고리 이름');
    addCategory(n);
  };

  /* 추가 모달 */
  document.getElementById('btnModalAddClose').onclick = ()=>closeModal('modalAdd');
  document.getElementById('btnSlidePrev').onclick     = ()=>goSlide(-1);
  document.getElementById('btnSlideNext').onclick     = ()=>goSlide(1);
  document.getElementById('btnAddMoreCam').onclick    = ()=>document.getElementById('addMoreCam').click();
  document.getElementById('btnAddMoreGal').onclick    = ()=>document.getElementById('addMoreGal').click();
  document.getElementById('addMoreCam').onchange      = e=>{ if(e.target.files.length) handleFiles(e.target.files,true); e.target.value=''; };
  document.getElementById('addMoreGal').onchange      = e=>{ if(e.target.files.length) handleFiles(e.target.files,true); e.target.value=''; };
  document.getElementById('btnDelImg').onclick        = ()=>{
    if(!modalImages.length) return;
    modalImages.splice(modalSlide,1);
    modalSlide=Math.min(modalSlide,modalImages.length-1);
    renderModalSlides();
  };
  document.getElementById('btnAiCrop').onclick    = ()=>aiDocCrop(false);
  document.getElementById('btnSavePhoto').onclick = savePhoto;
  document.getElementById('btnEditPhoto').onclick = openEditor;

  /* select 옆 카테고리 인라인 추가/삭제 */
  document.getElementById('btnInlineCatAdd').onclick = ()=>{
    const n=prompt('새 카테고리 이름'); addCategory(n);
  };
  document.getElementById('btnInlineCatDel').onclick = ()=>{
    const cur=document.getElementById('photoCat').value;
    if(!cur){ showToast('삭제할 카테고리가 없습니다'); return; }
    if(DEFAULT_CATS.includes(cur)){ showToast(`"${cur}"은 기본 카테고리라 삭제할 수 없습니다`); return; }
    if(!confirm(`"${cur}" 카테고리를 삭제할까요?`)) return;
    categories=categories.filter(c=>c!==cur); saveCategories();
    populateCatSelect(); renderFilterChips();
    showToast(`"${cur}" 삭제됨`);
  };

  /* 백업 import */
  document.getElementById('backupInput').onchange = e=>{ if(e.target.files[0]) importBackup(e.target.files[0]); e.target.value=''; };

  /* 편집 모달 */
  document.getElementById('btnEditClose').onclick  = ()=>{ closeModal('modalEdit'); openModal('modalAdd'); };
  document.getElementById('btnEditDone').onclick   = finishEdit;
  document.getElementById('btnEditUndo').onclick   = ()=>{ if(canvas&&canvas.undo) canvas.undo(); };
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>{
    b.onclick=()=>{
      const t=b.dataset.tool;
      if(t==='rect')   addShape('rect');
      else if(t==='circle') addShape('circle');
      else if(t==='arrow')  addArrow();
      else setTool(t);
    };
  });
  document.getElementById('toolColor').onchange = ()=>{ if(canvas&&canvas.isDrawingMode) canvas.freeDrawingBrush.color=document.getElementById('toolColor').value; };
  document.getElementById('toolSize').onchange  = ()=>{ if(canvas&&canvas.isDrawingMode) canvas.freeDrawingBrush.width=parseInt(document.getElementById('toolSize').value); };
  document.getElementById('btnDelObj').onclick   = ()=>{ if(canvas){const o=canvas.getActiveObject();if(o){canvas.remove(o);canvas.renderAll();}} };
  document.getElementById('btnRotateL').onclick  = ()=>rotateImage(-90);
  document.getElementById('btnRotateR').onclick  = ()=>rotateImage(90);
  document.getElementById('btnApplyCrop').onclick  = applyCrop;
  document.getElementById('btnCancelCrop').onclick = ()=>{
    cropOverlays.forEach(o=>canvas.remove(o)); cropOverlays=[];
    if(cropRect){canvas.remove(cropRect);cropRect=null;}
    document.getElementById('cropControls').classList.add('hidden');
    setTool('select');
  };
  document.getElementById('btnAddText').onclick    = addText;
  document.getElementById('textInput').onkeydown   = e=>{ if(e.key==='Enter') addText(); };

  /* 상세 보기 */
  document.getElementById('btnViewClose').onclick  = ()=>closeModal('modalView');
  document.getElementById('btnViewPrev').onclick   = ()=>viewNavSlide(-1);
  document.getElementById('btnViewNext').onclick   = ()=>viewNavSlide(1);
  document.getElementById('btnViewShare').onclick  = sharePhoto;
  document.getElementById('btnViewEdit').onclick   = ()=>{ closeModal('modalView'); openEditMetaModal(viewPhotoId); };
  document.getElementById('btnViewDelete').onclick = ()=>deletePhoto(viewPhotoId);

  /* AI 검색 */
  document.getElementById('btnSearchClose').onclick = ()=>document.getElementById('panelSearch').classList.remove('open');
  document.getElementById('btnAiSearch').onclick    = aiSearch;

  /* API 키 */
  document.getElementById('btnApiKeyClose').onclick = ()=>closeModal('modalApiKey');
  document.getElementById('apiKeyInput').value      = localStorage.getItem(LS_API_KEY)||'';
  document.getElementById('btnSaveApiKey').onclick  = ()=>{ localStorage.setItem(LS_API_KEY,document.getElementById('apiKeyInput').value.trim()); closeModal('modalApiKey'); showToast('API 키 저장됨'); };

  /* ESC */
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){['modalAdd','modalEdit','modalView','modalApiKey'].forEach(closeModal); document.getElementById('panelSearch').classList.remove('open'); } });

  /* 드래그앤드롭 */
  document.addEventListener('dragover',e=>e.preventDefault());
  document.addEventListener('drop',e=>{ e.preventDefault(); const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')||f.name.endsWith('.heic')); if(files.length) handleFiles(files); });
}

document.addEventListener('DOMContentLoaded', init);
