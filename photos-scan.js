/* photos-scan.js  v5.4-20260616
   수정: 크롭 contacts.html 완전동일패턴, initCropEvents DOM후 호출
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
  else if(autoScan && results.length===1){
    // 카메라 촬영 → 추가모달 열고 즉시 문서감지 모달 띄움
    openAddModal(results);
    // OpenCV 준비되면 바로, 아니면 500ms 대기 후 시도
    const tryDocScan = ()=>{
      if(cvReady){
        aiDocCrop(true);
      } else if(!cvError){
        setTimeout(tryDocScan, 300);
      } else {
        aiDocCrop(true); // fallback AI
      }
    };
    setTimeout(tryDocScan, 300);
  } else {
    openAddModal(results);
  }
}
const blobToDataUrl = blob => new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(blob); });

/* ═══════════════════════════════════════
   OpenCV.js 문서 자동감지 시스템
   ═══════════════════════════════════════ */
let cvReady = false;
let cvError  = false;

function onOpenCvReady(){
  cvReady = true;
  console.log('OpenCV.js 로드 완료');
  // 로딩 배지 제거
  const b = document.getElementById('cvStatusBadge');
  if(b) b.remove();
}
function onOpenCvError(){
  cvError = true;
  console.warn('OpenCV.js 로드 실패 — AI 크롭으로 대체');
  const b = document.getElementById('cvStatusBadge');
  if(b){ b.textContent='⚠️ OpenCV 로드 실패'; setTimeout(()=>b.remove(), 3000); }
}

/* 문서 감지 진입점 */
async function aiDocCrop(silent=false){
  if(!modalImages.length){ if(!silent) showToast('먼저 사진을 추가하세요'); return; }

  const statusEl = document.getElementById('aiCropStatus');
  const btn      = document.getElementById('btnAiCrop');
  btn.disabled   = true;

  if(cvReady){
    // ── OpenCV 경로 ──
    statusEl.textContent = '📄 OpenCV로 문서 감지 중...';
    try{
      await openCvDocScan(modalImages[modalSlide].dataUrl, silent);
    } catch(e){
      console.error('OpenCV scan error:', e);
      statusEl.textContent = '⚠️ 감지 실패: ' + e.message;
    } finally{
      btn.disabled = false;
    }
  } else if(!cvError){
    // 아직 로딩 중
    statusEl.textContent = '⏳ OpenCV 로딩 중... (잠시 후 다시 시도)';
    btn.disabled = false;
  } else {
    // OpenCV 실패 → Anthropic AI fallback
    await aiDocCropFallback(silent, statusEl, btn);
  }
}

/* ── OpenCV 문서감지 핵심 로직 ── */
let docCorners = []; // [{x,y}] 4개 꼭짓점 (캔버스 좌표)
let docScanImgData = null; // 원본 dataUrl 보관
let docScanScale   = 1;

async function openCvDocScan(dataUrl, silent=false){
  const statusEl = document.getElementById('aiCropStatus');
  docScanImgData = dataUrl;

  // 1. 이미지 → HTMLImageElement
  const img = await loadImage(dataUrl);

  // 2. OpenCV Mat 생성 (처리용 축소 버전)
  const MAX = 800;
  const scale = Math.min(MAX/img.width, MAX/img.height, 1);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  docScanScale = scale;

  const tmpC = document.createElement('canvas');
  tmpC.width=w; tmpC.height=h;
  tmpC.getContext('2d').drawImage(img, 0, 0, w, h);

  const src = cv.imread(tmpC);
  const dst = new cv.Mat();

  // 3. 그레이스케일 → 가우시안 블러 → Canny 엣지
  const gray   = new cv.Mat();
  const blurred= new cv.Mat();
  const edges  = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blurred, new cv.Size(5,5), 0);
  cv.Canny(blurred, edges, 75, 200);

  // 4. dilate로 엣지 두껍게 (끊긴 선 연결)
  const kernel  = cv.Mat.ones(3, 3, cv.CV_8U);
  const dilated = new cv.Mat();
  cv.dilate(edges, dilated, kernel);

  // 5. 윤곽선 찾기
  const contours = new cv.MatVector();
  const hierarchy= new cv.Mat();
  cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  // 6. 가장 큰 사각형 윤곽 찾기
  let bestQuad = null;
  let bestArea = 0;
  const imgArea = w * h;

  for(let i=0; i<contours.size(); i++){
    const cnt  = contours.get(i);
    const peri = cv.arcLength(cnt, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(cnt, approx, 0.02*peri, true);

    if(approx.rows === 4){
      const area = Math.abs(cv.contourArea(approx));
      // 이미지의 10%~95% 크기인 것만 유효
      if(area > imgArea*0.10 && area < imgArea*0.95 && area > bestArea){
        bestArea = area;
        bestQuad = [];
        for(let j=0; j<4; j++){
          bestQuad.push({
            x: approx.intAt(j,0) / scale, // 원본 픽셀 좌표
            y: approx.intAt(j,1) / scale
          });
        }
      }
      approx.delete();
    }
    cnt.delete();
  }

  // 메모리 해제
  [src,dst,gray,blurred,edges,kernel,dilated,contours,hierarchy].forEach(m=>{ try{m.delete();}catch(e){} });

  if(!bestQuad){
    // 사각형 못 찾으면 이미지 전체를 기본값으로
    statusEl.textContent = '⚠️ 문서 경계를 찾지 못했습니다. 꼭짓점을 수동으로 조정하세요.';
    bestQuad = [
      {x:img.width*0.05,  y:img.height*0.05},
      {x:img.width*0.95,  y:img.height*0.05},
      {x:img.width*0.95,  y:img.height*0.95},
      {x:img.width*0.05,  y:img.height*0.95}
    ];
  } else {
    // 꼭짓점 정렬: 좌상→우상→우하→좌하
    bestQuad = sortCorners(bestQuad);
    statusEl.textContent = '✅ 문서 감지 완료! 꼭짓점을 조정 후 크롭하세요.';
  }

  docCorners = bestQuad;
  openDocScanModal(img);
}

/* 꼭짓점 정렬: 좌상→우상→우하→좌하 */
function sortCorners(pts){
  const cx = pts.reduce((s,p)=>s+p.x,0)/4;
  const cy = pts.reduce((s,p)=>s+p.y,0)/4;
  return [
    pts.find(p=>p.x<cx&&p.y<cy) || pts[0], // 좌상
    pts.find(p=>p.x>cx&&p.y<cy) || pts[1], // 우상
    pts.find(p=>p.x>cx&&p.y>cy) || pts[2], // 우하
    pts.find(p=>p.x<cx&&p.y>cy) || pts[3], // 좌하
  ];
}

/* 이미지 로드 헬퍼 */
function loadImage(src){
  return new Promise((res,rej)=>{
    const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=src;
  });
}

/* ── 문서감지 모달 열기 + 꼭짓점 UI ── */
function openDocScanModal(origImg){
  openModal('modalDocScan');

  const wrap   = document.getElementById('docScanWrap');
  const canvas = document.getElementById('docScanCanvas');

  // 캔버스 크기: wrap 기준으로 맞춤
  const maxW = Math.min(wrap.clientWidth  || 500, 560);
  const maxH = Math.min(wrap.clientHeight || 400, 440);
  const scale = Math.min(maxW/origImg.width, maxH/origImg.height, 1);
  const dw = Math.round(origImg.width  * scale);
  const dh = Math.round(origImg.height * scale);

  canvas.width  = dw;
  canvas.height = dh;

  // 이미지 그리기
  const ctx = canvas.getContext('2d');
  ctx.drawImage(origImg, 0, 0, dw, dh);

  // 꼭짓점을 캔버스 좌표로 변환
  const dispCorners = docCorners.map(p=>({ x:p.x*scale, y:p.y*scale }));
  drawDocOutline(ctx, dispCorners, dw, dh);

  // 핸들 위치 설정
  const wrapRect = wrap.getBoundingClientRect();
  const canvRect = canvas.getBoundingClientRect();
  const offsetX  = canvRect.left - wrapRect.left;
  const offsetY  = canvRect.top  - wrapRect.top;

  dispCorners.forEach((p,i)=>{
    const h = document.getElementById(`ch${i}`);
    h.style.left = (offsetX + p.x) + 'px';
    h.style.top  = (offsetY + p.y) + 'px';
    makeDraggable(h, i, scale, origImg, offsetX, offsetY, dw, dh);
  });
}

/* 윤곽선 + 꼭짓점 그리기 */
function drawDocOutline(ctx, corners, dw, dh){
  ctx.save();
  // 외부 어둡게
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.rect(0,0,dw,dh);
  ctx.moveTo(corners[0].x,corners[0].y);
  corners.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.closePath();
  ctx.fill('evenodd');
  // 선
  ctx.strokeStyle='#FFD700';
  ctx.lineWidth=2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(corners[0].x,corners[0].y);
  corners.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/* 핸들 드래그 */
function makeDraggable(handle, idx, dispScale, origImg, offX, offY, dw, dh){
  const canvas = document.getElementById('docScanCanvas');
  let dragging = false;

  function onStart(e){
    dragging=true; e.preventDefault();
  }
  function onMove(e){
    if(!dragging) return;
    e.preventDefault();
    const wrap   = document.getElementById('docScanWrap');
    const wRect  = wrap.getBoundingClientRect();
    const client = e.touches ? e.touches[0] : e;
    const cx = client.clientX - wRect.left - offX;
    const cy = client.clientY - wRect.top  - offY;
    const clampX = Math.max(0, Math.min(dw, cx));
    const clampY = Math.max(0, Math.min(dh, cy));

    // 핸들 이동
    handle.style.left = (offX + clampX) + 'px';
    handle.style.top  = (offY + clampY) + 'px';

    // 원본 좌표 업데이트
    docCorners[idx] = { x: clampX/dispScale, y: clampY/dispScale };

    // 캔버스 다시 그리기
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,dw,dh);
    ctx.drawImage(origImg,0,0,dw,dh);
    const dispC = docCorners.map(p=>({x:p.x*dispScale, y:p.y*dispScale}));
    drawDocOutline(ctx, dispC, dw, dh);
  }
  function onEnd(){ dragging=false; }

  handle.addEventListener('mousedown',  onStart);
  handle.addEventListener('touchstart', onStart, {passive:false});
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, {passive:false});
  document.addEventListener('mouseup',   onEnd);
  document.addEventListener('touchend',  onEnd);
}

/* ── 원근 변환(Perspective Warp) 적용 크롭 ── */
async function applyDocScanCrop(){
  if(!docCorners.length || !docScanImgData){ showToast('감지된 문서가 없습니다'); return; }

  const statusEl = document.getElementById('aiCropStatus');
  statusEl.textContent = '⏳ 원근 보정 중...';

  try{
    const img = await loadImage(docScanImgData);

    // 꼭짓점 정렬: 좌상→우상→우하→좌하
    const sorted = sortCorners(docCorners);
    const [tl,tr,br2,bl] = sorted;

    // 출력 크기: 상단/하단 너비, 좌/우 높이 중 최대값
    const wTop  = Math.hypot(tr.x-tl.x, tr.y-tl.y);
    const wBot  = Math.hypot(br2.x-bl.x, br2.y-bl.y);
    const hLeft = Math.hypot(bl.x-tl.x, bl.y-tl.y);
    const hRight= Math.hypot(br2.x-tr.x, br2.y-tr.y);
    const outW  = Math.round(Math.max(wTop, wBot));
    const outH  = Math.round(Math.max(hLeft, hRight));

    if(outW < 50 || outH < 50){ showToast('크롭 영역이 너무 작습니다'); return; }

    if(cvReady){
      // OpenCV 원근 변환
      const srcPts = cv.matFromArray(4,1,cv.CV_32FC2,[
        tl.x,tl.y, tr.x,tr.y, br2.x,br2.y, bl.x,bl.y
      ]);
      const dstPts = cv.matFromArray(4,1,cv.CV_32FC2,[
        0,0, outW,0, outW,outH, 0,outH
      ]);

      // 원본 이미지 → OpenCV Mat
      const tmpC = document.createElement('canvas');
      tmpC.width=img.width; tmpC.height=img.height;
      tmpC.getContext('2d').drawImage(img,0,0);
      const srcMat = cv.imread(tmpC);
      const dstMat = new cv.Mat();
      const M = cv.getPerspectiveTransform(srcPts, dstPts);
      const dsize = new cv.Size(outW, outH);
      cv.warpPerspective(srcMat, dstMat, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT);

      // 결과를 canvas로 출력
      const outC = document.createElement('canvas');
      outC.width=outW; outC.height=outH;
      cv.imshow(outC, dstMat);

      [srcPts,dstPts,srcMat,dstMat,M].forEach(m=>{try{m.delete();}catch(e){}});

      const result = outC.toDataURL('image/jpeg', 0.95);
      applyResultToModal(result);
    } else {
      // OpenCV 없으면 단순 bounding box 크롭
      const xs = sorted.map(p=>p.x);
      const ys = sorted.map(p=>p.y);
      const result = await cropImageByPixel(
        docScanImgData,
        Math.round(Math.min(...xs)), Math.round(Math.min(...ys)),
        Math.round(Math.max(...xs)-Math.min(...xs)),
        Math.round(Math.max(...ys)-Math.min(...ys))
      );
      applyResultToModal(result);
    }
  } catch(e){
    console.error('Warp error:', e);
    statusEl.textContent = '⚠️ 원근 보정 실패: ' + e.message;
  }
}

function applyResultToModal(dataUrl){
  modalImages[modalSlide].dataUrl = dataUrl;
  closeModal('modalDocScan');
  renderModalSlides();
  document.getElementById('aiCropStatus').textContent = '✅ 문서 크롭 + 원근 보정 완료!';
  showToast('📄 문서 크롭 완료');
}

/* ── Anthropic AI fallback (OpenCV 실패 시) ── */
async function aiDocCropFallback(silent, statusEl, btn){
  const key = localStorage.getItem(LS_API_KEY)||'';
  if(!key){
    statusEl.textContent='⚠️ OpenCV 로드 실패. AI 키도 없음 — ⚙️에서 설정하세요';
    btn.disabled=false; return;
  }
  const overlay = document.getElementById('scanOverlay');
  if(silent) overlay.style.display='flex';
  else statusEl.textContent='🤖 AI로 문서 감지 중...';
  try{
    const m     = modalImages[modalSlide];
    const small = await resizeForAI(m.dataUrl, 1200);
    const [mtype,base64] = getB64Parts(small);
    const origSize = await getImgSize(m.dataUrl);
    const [oW,oH] = origSize.split('x').map(Number);
    const resizedSize = await getImgSize(small);
    const [rW,rH] = resizedSize.split('x').map(Number);

    const text = await callAI([{
      role:'user',
      content:[
        {type:'image', source:{type:'base64', media_type:mtype, data:base64}},
        {type:'text', text:`이미지(${rW}x${rH}px)에서 문서의 4개 꼭짓점 픽셀 좌표를 찾아주세요. JSON만 반환: {"hasDoc":true,"tl":[x,y],"tr":[x,y],"br":[x,y],"bl":[x,y]} 또는 {"hasDoc":false}`}
      ]
    }],256);

    const j = JSON.parse(text.replace(/```json|```/g,'').trim());
    if(!j.hasDoc){ statusEl.textContent='✓ 문서를 찾지 못했습니다'; return; }

    const sx = Math.round(Math.min(j.tl[0],j.bl[0]) * oW/rW);
    const sy = Math.round(Math.min(j.tl[1],j.tr[1]) * oH/rH);
    const sw = Math.round((Math.max(j.tr[0],j.br[0]) - Math.min(j.tl[0],j.bl[0])) * oW/rW);
    const sh = Math.round((Math.max(j.bl[1],j.br[1]) - Math.min(j.tl[1],j.tr[1])) * oH/rH);
    const cropped = await cropImageByPixel(m.dataUrl, sx, sy, sw, sh);
    modalImages[modalSlide].dataUrl = cropped;
    renderModalSlides();
    statusEl.textContent = `✅ AI 크롭 완료 (${sw}×${sh}px)`;
  } catch(e){
    statusEl.textContent='⚠️ '+e.message;
  } finally{
    btn.disabled=false;
    overlay.style.display='none';
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
function getB64Parts(dataUrl){
  const p=dataUrl.split(';base64,');
  return [p[0].replace('data:',''), p[1]];
}
function cropImageByPixel(dataUrl,sx,sy,sw,sh){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      c.width=Math.max(1,sw); c.height=Math.max(1,sh);
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
      const sx=Math.round(rx*img.width),sy=Math.round(ry*img.height);
      const sw=Math.round(rw*img.width),sh=Math.round(rh*img.height);
      c.width=sw;c.height=sh;
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
  const mv=document.getElementById('modalView'); mv.style.display='flex';
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
  document.getElementById('modalView').style.display='none'; renderGallery(); showToast('삭제되었습니다');
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

/* ── 편집기 (명함앱 검증 방식 — img+overlay, Fabric 크롭 대신 native canvas) ── */
let canvas=null, editImgId=null, editTool='select', mosaicActive=false;
let cropImgSrc='';  // 현재 크롭/편집 중인 원본 dataUrl

function openEditor(){
  if(!modalImages.length){ showToast('사진을 먼저 추가하세요'); return; }
  editImgId = modalImages[modalSlide].id;
  cropImgSrc = modalImages[modalSlide].dataUrl;
  closeModal('modalAdd');
  openModal('modalEdit');
  requestAnimationFrame(()=>requestAnimationFrame(()=>initCanvas(cropImgSrc)));
}

/* ── Canvas 초기화 (Fabric용, 크롭 제외) ── */
function initCanvas(dataUrl){
  cropImgSrc = dataUrl;
  const wrapper = document.getElementById('canvasWrapper');
  const maxW = (wrapper.clientWidth  > 50 ? wrapper.clientWidth  : window.innerWidth)  - 8;
  const maxH = (wrapper.clientHeight > 50 ? wrapper.clientHeight : window.innerHeight) - 180;

  if(canvas){ canvas.dispose(); canvas=null; }
  canvas = new fabric.Canvas('editCanvas', {
    selection:true, preserveObjectStacking:true,
    stopContextMenu:true, fireRightClick:false
  });

  const _img = new Image();
  _img.onload = ()=>{
    const scale = Math.min(maxW/_img.width, maxH/_img.height, 1);
    const cw = Math.round(_img.width  * scale);
    const ch = Math.round(_img.height * scale);
    canvas.setWidth(cw); canvas.setHeight(ch);
    const fImg = new fabric.Image(_img, {scaleX:scale,scaleY:scale,selectable:false,evented:false});
    canvas.setBackgroundImage(fImg, canvas.renderAll.bind(canvas));

    /* 모자이크 드래그 */
    canvas.on('mouse:down', opt=>{ if(editTool==='mosaic'){ mosaicActive=true; applyMosaicAt(opt.e); }});
    canvas.on('mouse:move', opt=>{ if(editTool==='mosaic'&&mosaicActive) applyMosaicAt(opt.e); });
    canvas.on('mouse:up',   ()=>{ mosaicActive=false; });
    canvas.upperCanvasEl.addEventListener('touchstart',e=>{
      if(editTool==='mosaic'){mosaicActive=true;applyMosaicAt(e.touches[0]);e.preventDefault();}
    },{passive:false});
    canvas.upperCanvasEl.addEventListener('touchmove',e=>{
      if(editTool==='mosaic'&&mosaicActive){applyMosaicAt(e.touches[0]);e.preventDefault();}
    },{passive:false});
    canvas.upperCanvasEl.addEventListener('touchend',()=>{ mosaicActive=false; });
  };
  _img.src = dataUrl;
  setTool('select');
}

function setTool(tool){
  editTool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  document.getElementById('cropControls').classList.add('hidden');
  document.getElementById('textInputRow').classList.add('hidden');
  document.getElementById('lblMosaic').style.display  = 'none';
  document.getElementById('mosaicSize').style.display = 'none';
  if(!canvas) return;
  canvas.isDrawingMode=false; canvas.selection=true; canvas.defaultCursor='default';

  if(tool==='draw'){
    canvas.isDrawingMode=true;
    canvas.freeDrawingBrush.width=parseInt(document.getElementById('toolSize').value);
    canvas.freeDrawingBrush.color=document.getElementById('toolColor').value;
  } else if(tool==='crop'){
    canvas.selection=false;
    // 크롭 풀스크린 UI 열기 (별도 오버레이)
    openCropUI();
  } else if(tool==='text'){
    document.getElementById('textInputRow').classList.remove('hidden');
    canvas.defaultCursor='text';
  } else if(tool==='mosaic'){
    document.getElementById('lblMosaic').style.display='';
    document.getElementById('mosaicSize').style.display='';
    canvas.selection=false; canvas.defaultCursor='crosshair';
  }
}

/* ═══════════════════════════════════════════════
   크롭 UI v5.4 — contacts.html 완전 동일 패턴
   - 정적 HTML (cropArea/cropImg/cropBox/핸들)
   - pointerdown: data-h 없으면 move
   - setPointerCapture 로 손가락 추적
   - naturalWidth 비율로 정확한 픽셀 크롭
   ═══════════════════════════════════════════════ */

let cIR={w:0,h:0}, cBox={x:0,y:0,w:0,h:0};
let cDrag=null, cSX=0, cSY=0, cSB=null;
let cOffset={x:0,y:0};
let cResetTries=0;

/* 크롭 레이아웃 업데이트 */
function cropUILayout(){
  const box=document.getElementById('cropBox');
  if(!box) return;
  box.style.left   = (cOffset.x + cBox.x)+'px';
  box.style.top    = (cOffset.y + cBox.y)+'px';
  box.style.width  = cBox.w+'px';
  box.style.height = cBox.h+'px';
}

/* iOS/Android 레이아웃 완료 대기 루프 */
function cResetWhenReady(){
  const im=document.getElementById('cropImg');
  if(im.clientWidth>0 && im.clientHeight>0){
    cResetTries=0; cReset(); return;
  }
  if(cResetTries++<60){ requestAnimationFrame(cResetWhenReady); return; }
  cResetTries=0;
  // fallback: naturalWidth 기준
  const area=document.getElementById('cropArea');
  const mw=area.clientWidth||window.innerWidth;
  const mh=area.clientHeight||(window.innerHeight-120);
  cIR={w:Math.min(mw,im.naturalWidth||mw), h:Math.min(mh,im.naturalHeight||mh)};
  cOffset={x:0,y:0};
  cBox={x:cIR.w*0.06,y:cIR.h*0.06,w:cIR.w*0.88,h:cIR.h*0.88};
  cropUILayout();
}

function cReset(){
  const im=document.getElementById('cropImg');
  const area=document.getElementById('cropArea');
  const aRect=area.getBoundingClientRect();
  const iRect=im.getBoundingClientRect();
  cIR={w:im.clientWidth, h:im.clientHeight};
  cOffset={x:iRect.left-aRect.left, y:iRect.top-aRect.top};
  cBox={x:cIR.w*0.06,y:cIR.h*0.06,w:cIR.w*0.88,h:cIR.h*0.88};
  cropUILayout();
}

/* 크롭 열기 */
function openCropUI(){
  cropImgSrc = (modalImages[modalSlide]||{}).dataUrl || cropImgSrc;
  if(!cropImgSrc){ showToast('사진이 없습니다'); return; }
  const im=document.getElementById('cropImg');
  im.onload=()=>{ cResetTries=0; requestAnimationFrame(cResetWhenReady); };
  im.src=cropImgSrc;
  if(im.complete && im.naturalWidth){ cResetTries=0; requestAnimationFrame(cResetWhenReady); }
  document.getElementById('cropOverlay').classList.add('show');
}

function closeCropUI(){
  document.getElementById('cropOverlay').classList.remove('show');
}

/* ── 크롭 이벤트 — init() 에서 호출 ── */
function initCropEvents(){
  const area=document.getElementById('cropArea');
  if(!area || area._cropInited) return;
  area._cropInited=true;

  area.addEventListener('pointerdown',e=>{
    // data-h 있으면 해당 핸들 방향, 없으면 전체 이동
    const h=e.target.getAttribute&&e.target.getAttribute('data-h');
    cDrag=h||'move';
    cSX=e.clientX; cSY=e.clientY; cSB={...cBox};
    try{ area.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  });

  area.addEventListener('pointermove',e=>{
    if(!cDrag) return;
    const dx=e.clientX-cSX, dy=e.clientY-cSY;
    let {x,y,w,h}=cSB;
    const W=cIR.w, H=cIR.h;
    if(cDrag==='move'){
      x=Math.min(Math.max(0,cSB.x+dx),W-cSB.w);
      y=Math.min(Math.max(0,cSB.y+dy),H-cSB.h);
    } else {
      if(cDrag.indexOf('l')>=0){ x=cSB.x+dx; w=cSB.w-dx; }
      if(cDrag.indexOf('r')>=0){ w=cSB.w+dx; }
      if(cDrag.indexOf('t')>=0){ y=cSB.y+dy; h=cSB.h-dy; }
      if(cDrag.indexOf('b')>=0){ h=cSB.h+dy; }
      if(w<40){ if(cDrag.indexOf('l')>=0) x=cSB.x+cSB.w-40; w=40; }
      if(h<30){ if(cDrag.indexOf('t')>=0) y=cSB.y+cSB.h-30; h=30; }
      if(x<0){w+=x;x=0;} if(y<0){h+=y;y=0;}
      if(x+w>W) w=W-x; if(y+h>H) h=H-y;
    }
    cBox={x,y,w,h}; cropUILayout();
    e.preventDefault();
  });

  area.addEventListener('pointerup',    ()=>{ cDrag=null; });
  area.addEventListener('pointercancel',()=>{ cDrag=null; });
}

/* ── 크롭 적용 — contacts.html cropDone 완전 동일 ── */
function applyCrop(){
  const im=document.getElementById('cropImg');
  const sX=im.naturalWidth/(cIR.w||1);
  const sY=im.naturalHeight/(cIR.h||1);
  const sx=Math.max(0,Math.round(cBox.x*sX));
  const sy=Math.max(0,Math.round(cBox.y*sY));
  const sw=Math.max(20,Math.round(cBox.w*sX));
  const sh=Math.max(20,Math.round(cBox.h*sY));
  const out=document.createElement('canvas');
  out.width=sw; out.height=sh;
  out.getContext('2d').drawImage(im,sx,sy,sw,sh,0,0,sw,sh);
  const cropped=out.toDataURL('image/jpeg',0.96);

  let idx=modalImages.findIndex(m=>m.id===editImgId);
  if(idx<0) idx=modalSlide;
  if(idx>=0&&idx<modalImages.length){
    modalImages[idx].dataUrl=cropped;
    editImgId=modalImages[idx].id;
    cropImgSrc=cropped;
  }
  closeCropUI();
  initCanvas(cropped);
  setTool('select');
  showToast('✂️ 크롭 완료 — ✓완료로 저장');
}


/* ── 회전 ── */
function rotateImage(deg){
  const im = new Image();
  im.onload = ()=>{
    const c = document.createElement('canvas');
    if(deg===90||deg===-90){ c.width=im.height; c.height=im.width; }
    else { c.width=im.width; c.height=im.height; }
    const ctx=c.getContext('2d');
    ctx.translate(c.width/2, c.height/2);
    ctx.rotate(deg*Math.PI/180);
    ctx.drawImage(im, -im.width/2, -im.height/2);
    const rotated = c.toDataURL('image/jpeg', 0.95);
    let idx=modalImages.findIndex(m=>m.id===editImgId);
    if(idx<0) idx=modalSlide;
    if(idx>=0) modalImages[idx].dataUrl = rotated;
    cropImgSrc = rotated;
    initCanvas(rotated);
  };
  im.src = canvas ? canvas.toDataURL({format:'jpeg',quality:0.95}) : cropImgSrc;
}

/* ── 텍스트 ── */
function addText(){
  const txt=document.getElementById('textInput').value; if(!txt) return;
  canvas.add(new fabric.Text(txt,{
    left:40,top:40,fill:document.getElementById('toolColor').value,
    fontSize:parseInt(document.getElementById('toolSize').value)*5+16,
    fontFamily:'Arial',fontWeight:'bold',shadow:'rgba(0,0,0,0.4) 1px 1px 3px'
  }));
  canvas.renderAll();
  document.getElementById('textInput').value='';
  setTool('select');
}

/* ── 도형 ── */
function addShape(type){
  const color=document.getElementById('toolColor').value;
  const sw=parseInt(document.getElementById('toolSize').value);
  const shape=type==='rect'
    ?new fabric.Rect({left:60,top:60,width:150,height:100,fill:'transparent',stroke:color,strokeWidth:sw,cornerSize:14})
    :new fabric.Ellipse({left:60,top:60,rx:75,ry:50,fill:'transparent',stroke:color,strokeWidth:sw,cornerSize:14});
  canvas.add(shape); canvas.setActiveObject(shape); canvas.renderAll();
  setTool('select');
}

/* ── 화살표 ── */
function addArrow(){
  const color=document.getElementById('toolColor').value;
  const sw=parseInt(document.getElementById('toolSize').value);
  const len=120;
  const line=new fabric.Line([50,100,50+len,100],{stroke:color,strokeWidth:sw,selectable:false});
  const head=new fabric.Triangle({width:sw*5+8,height:sw*5+12,fill:color,left:50+len,top:100,angle:90,originX:'center',originY:'center',selectable:false});
  const grp=new fabric.Group([line,head],{left:80,top:80,cornerSize:14,hasRotatingPoint:true});
  canvas.add(grp); canvas.setActiveObject(grp); canvas.renderAll();
  setTool('select');
}

/* ── 모자이크 드래그 ── */
function applyMosaicAt(e){
  if(!canvas) return;
  const rect=canvas.upperCanvasEl.getBoundingClientRect();
  const pt={x:e.clientX-rect.left, y:e.clientY-rect.top};
  const sz=parseInt(document.getElementById('mosaicSize').value)||40;
  const bg=canvas.backgroundImage; if(!bg) return;
  const bgEl=bg.getElement();
  const sx=Math.round((pt.x-sz/2)/(bg.scaleX||1));
  const sy=Math.round((pt.y-sz/2)/(bg.scaleY||1));
  const sw=Math.round(sz/(bg.scaleX||1));
  const sh=Math.round(sz/(bg.scaleY||1));
  const tc=document.createElement('canvas'); tc.width=Math.max(1,sw); tc.height=Math.max(1,sh);
  tc.getContext('2d').drawImage(bgEl,sx,sy,sw,sh,0,0,sw,sh);
  const pb=Math.max(3,Math.round(sz/10));
  const pc=document.createElement('canvas'); pc.width=pb; pc.height=pb;
  const pctx=pc.getContext('2d'); pctx.imageSmoothingEnabled=false;
  pctx.drawImage(tc,0,0,pb,pb);
  const mc=document.createElement('canvas'); mc.width=sz; mc.height=sz;
  const mctx=mc.getContext('2d'); mctx.imageSmoothingEnabled=false;
  mctx.drawImage(pc,0,0,sz,sz);
  fabric.Image.fromURL(mc.toDataURL(),mImg=>{
    mImg.set({left:pt.x-sz/2,top:pt.y-sz/2,width:sz,height:sz,scaleX:1,scaleY:1,selectable:false,evented:false});
    canvas.add(mImg); canvas.renderAll();
  });
}

/* ── 편집 완료 → modalImages 저장 ── */
function finishEdit(){
  if(!canvas) return;
  closeCropUI();

  // Fabric canvas export (어노테이션 포함)
  const annotated = canvas.toDataURL({format:'jpeg', quality:0.95});

  // 원본 이미지와 어노테이션 합성
  const bgImg = canvas.backgroundImage;
  if(bgImg){
    const origEl = bgImg.getElement();
    const ow = origEl.naturalWidth  || origEl.width;
    const oh = origEl.naturalHeight || origEl.height;
    // 원본 해상도 캔버스에 배경 + 어노테이션 합성
    const out = document.createElement('canvas');
    out.width=ow; out.height=oh;
    const ctx=out.getContext('2d');
    ctx.drawImage(origEl,0,0,ow,oh);
    // 어노테이션: canvas export를 원본 크기에 맞게 스케일
    const ann=new Image();
    ann.onload=()=>{
      ctx.drawImage(ann,0,0,ow,oh);
      const final=out.toDataURL('image/jpeg',0.95);
      saveEditResult(final);
    };
    ann.src=annotated;
  } else {
    saveEditResult(annotated);
  }
}

function saveEditResult(dataUrl){
  let idx=modalImages.findIndex(m=>m.id===editImgId);
  if(idx<0) idx=modalSlide;
  if(idx<0||idx>=modalImages.length){
    modalImages.push({id:editImgId||uid(), dataUrl});
    idx=modalImages.length-1;
  } else {
    modalImages[idx].dataUrl=dataUrl;
    modalImages[idx].id=editImgId||modalImages[idx].id;
  }
  modalSlide=idx;
  closeModal('modalEdit');
  openModal('modalAdd');
  renderModalSlides();
  showToast('✅ 편집 저장 완료');
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
  document.getElementById('appTitle').textContent   = MODE_LABEL;
  document.getElementById('appVersion').textContent = 'v5.4';
  document.getElementById('sideTitle').textContent  = MODE_LABEL;
  document.title = MODE_LABEL;
  document.querySelector('.app-title').style.color = MODE_COLOR;
  // 헤더 배경 모드 표시줄
  const modeBar = document.createElement('div');
  modeBar.style.cssText = `position:fixed;top:0;left:0;right:0;height:3px;background:${MODE_COLOR};z-index:200;`;
  document.body.appendChild(modeBar);

  /* 크롭 이벤트 초기화 (DOM 완성 후) */
  initCropEvents();

  /* OpenCV 로딩 배지 */
  if(!cvReady && !cvError){
    const badge = document.createElement('div');
    badge.id = 'cvStatusBadge';
    badge.className = 'cv-status';
    badge.textContent = '⏳ OpenCV 로딩 중...';
    document.body.appendChild(badge);
    let tries = 0;
    const waitCv = setInterval(()=>{
      tries++;
      if(cvReady){
        badge.textContent='✅ OpenCV 준비됨';
        setTimeout(()=>badge.remove(),2000);
        clearInterval(waitCv);
      } else if(cvError || tries > 30){ // 15초(30×500ms) 후 포기
        cvError=true;
        badge.textContent='⚠️ OpenCV 실패 — AI 모드로 동작';
        setTimeout(()=>badge.remove(),3000);
        clearInterval(waitCv);
      }
    }, 500);
  }

  renderFilterChips();
  renderGallery();
  populateCatSelect();

  /* 문서감지 모달 이벤트 */
  document.getElementById('btnDocScanClose').onclick = ()=>closeModal('modalDocScan');
  document.getElementById('btnDocScanRetry').onclick = ()=>{
    closeModal('modalDocScan');
    aiDocCrop(false);
  };
  document.getElementById('btnDocScanApply').onclick = applyDocScanCrop;

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
  // 크롭 풀스크린 버튼들
  document.getElementById('cropDoneBtn').onclick   = applyCrop;
  document.getElementById('cropCancelBtn').onclick = ()=>{ closeCropUI(); setTool('select'); };
  document.getElementById('cropRotateBtn').onclick = ()=>{
    const im = document.getElementById('cropImg');
    const src = im.src || cropImgSrc;
    const tmpI = new Image();
    tmpI.onload = ()=>{
      const c=document.createElement('canvas'); c.width=tmpI.height; c.height=tmpI.width;
      const ctx=c.getContext('2d');
      ctx.translate(c.width/2,c.height/2); ctx.rotate(Math.PI/2);
      ctx.drawImage(tmpI,-tmpI.width/2,-tmpI.height/2);
      cropImgSrc = c.toDataURL('image/jpeg',0.95);
      const im2=document.getElementById('cropImg');
      im2.onload=()=>{ cResetTries=0; cResetWhenReady(); };
      im2.src=cropImgSrc;
    };
    tmpI.src=src;
  };
  // 편집모달 내 크롭/취소 버튼 (하단 바 — crop tool 선택 시 표시)
  document.getElementById('btnApplyCrop').onclick  = applyCrop;
  document.getElementById('btnCancelCrop').onclick = ()=>{ closeCropUI(); setTool('select'); };
  document.getElementById('btnAddText').onclick    = addText;
  document.getElementById('textInput').onkeydown   = e=>{ if(e.key==='Enter') addText(); };

  /* 상세 보기 */
  document.getElementById('btnViewClose').onclick  = ()=>{ document.getElementById('modalView').style.display='none'; };
  document.getElementById('btnViewPrev').onclick   = ()=>viewNavSlide(-1);
  document.getElementById('btnViewNext').onclick   = ()=>viewNavSlide(1);
  document.getElementById('btnViewShare').onclick  = sharePhoto;
  document.getElementById('btnViewEdit').onclick   = ()=>{ document.getElementById('modalView').style.display='none'; openEditMetaModal(viewPhotoId); };
  document.getElementById('btnViewDelete').onclick = ()=>deletePhoto(viewPhotoId);

  /* AI 검색 */
  document.getElementById('btnSearchClose').onclick = ()=>document.getElementById('panelSearch').classList.remove('open');
  document.getElementById('btnAiSearch').onclick    = aiSearch;

  /* API 키 */
  document.getElementById('btnApiKeyClose').onclick = ()=>closeModal('modalApiKey');
  document.getElementById('apiKeyInput').value      = localStorage.getItem(LS_API_KEY)||'';
  document.getElementById('btnSaveApiKey').onclick  = ()=>{ localStorage.setItem(LS_API_KEY,document.getElementById('apiKeyInput').value.trim()); closeModal('modalApiKey'); showToast('API 키 저장됨'); };

  /* ESC */
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){['modalAdd','modalEdit','modalApiKey'].forEach(closeModal); document.getElementById('modalView').style.display='none'; document.getElementById('panelSearch').classList.remove('open'); } });

  /* 드래그앤드롭 */
  document.addEventListener('dragover',e=>e.preventDefault());
  document.addEventListener('drop',e=>{ e.preventDefault(); const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')||f.name.endsWith('.heic')); if(files.length) handleFiles(files); });
}

document.addEventListener('DOMContentLoaded', init);
