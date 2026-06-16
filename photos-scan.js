/* photos-scan.js  v6.1-20260616
   수정: Flask서버 OpenCV 연동(서버→브라우저CV→AI fallback)
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

/* 사이드 메뉴 제거 */

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
  editingPhotoId=null;
  // 배열 깊은 복사 — 참조 공유 방지 (폰 저장 오류 원인)
  modalImages = preImages.map(m=>({...m}));
  modalSlide=0;
  document.getElementById('modalAddTitle').textContent = '사진 추가';
  document.getElementById('photoTitle').value='';
  document.getElementById('photoMemo').value='';
  document.getElementById('photoDate').value=today();
  document.getElementById('aiCropStatus').textContent='';
  populateCatSelect();
  const ptEl=document.getElementById('photoType');
  if(ptEl) ptEl.value='';
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
  const typeEl= document.getElementById('photoType');
  const type  = typeEl ? typeEl.value : '';
  if(!modalImages.length){ showToast('사진을 1장 이상 추가하세요'); return; }
  if(!title){ showToast('제목을 입력하세요'); return; }

  if(editingPhotoId){
    const p=photos.find(x=>x.id===editingPhotoId); if(!p) return;
    await Promise.all((p.imgIds||[]).map(id=>idbDelete(id)));
    const newIds=[];
    for(const m of modalImages){ const nid=m.id||uid(); await idbPut(nid,m.dataUrl); newIds.push(nid); }
    p.title=title; p.cat=cat; p.memo=memo; p.date=date; p.type=type; p.imgIds=newIds;
  } else {
    const pid=uid(); const imgIds=[];
    for(const m of modalImages){ const iid=uid(); await idbPut(iid,m.dataUrl); imgIds.push(iid); }
    photos.unshift({id:pid,title,cat,memo,date,type,imgIds});
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

/* 이미지 로드 헬퍼 — AI 크롭에서 사용 */
function sortCorners(pts){
  if(!pts||!pts.length) return pts;
  const arr = pts.map(p=>({x:+p.x||0, y:+p.y||0}));
  const cx = arr.reduce((s,p)=>s+p.x,0)/arr.length;
  const cy = arr.reduce((s,p)=>s+p.y,0)/arr.length;
  const tl=arr.find(p=>p.x<=cx&&p.y<=cy)||arr[0];
  const tr=arr.find(p=>p.x>cx&&p.y<=cy)||arr[1];
  const br=arr.find(p=>p.x>cx&&p.y>cy)||arr[2];
  const bl=arr.find(p=>p.x<=cx&&p.y>cy)||arr[3];
  return [tl,tr,br,bl].map((p,i)=>p||arr[i]);
}

/* ── 이미지 크게 보기 팝업 ── */
function openImgPopup(){
  if(!modalImages.length) return;
  const url = modalImages[modalSlide]?.dataUrl;
  if(!url) return;
  const popup = document.getElementById('imgPopup');
  const img   = document.getElementById('imgPopupImg');
  img.src = url;
  popup.style.display = 'flex';
  // 좌우 버튼 표시 여부
  document.getElementById('popupPrev').style.display = modalImages.length>1?'':'none';
  document.getElementById('popupNext').style.display = modalImages.length>1?'':'none';
}
function closeImgPopup(){
  const popup = document.getElementById('imgPopup');
  if(popup) popup.style.display='none';
}
function popupNav(dir){
  modalSlide=(modalSlide+dir+modalImages.length)%modalImages.length;
  renderModalSlides();
  const img=document.getElementById('imgPopupImg');
  if(img) img.src=modalImages[modalSlide]?.dataUrl||'';
}

function loadImage(src){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>res(img);
    img.onerror=()=>rej(new Error('이미지 로드 실패: '+src.slice(0,40)));
    img.src=src;
  });
}

/* ═══════════════════════════════════════════════════════
   문서 자동감지 시스템 v6.3
   우선순위:
     1) 🖥️ Flask 서버 Python OpenCV (컴 켜져 있을 때 — 최고 정확도)
     2) 🤖 Claude AI 2단계 분석    (컴 꺼져 있을 때 — 자동 fallback)
   ═══════════════════════════════════════════════════════ */

let cvReady = false;  // 브라우저 OpenCV (예비)
let cvError  = false;

/* 문서감지 상태 변수 */
let docCorners     = [];    // [{x,y}] 4개 꼭짓점 (원본 이미지 픽셀 좌표)
let docScanImgData = null;  // 원본 dataUrl

function onOpenCvReady(){ cvReady=true; const b=document.getElementById('cvStatusBadge'); if(b) b.remove(); }
function onOpenCvError(){ cvError=true;  const b=document.getElementById('cvStatusBadge'); if(b) b.remove(); }

/* ── 서버 주소 (app.py 포트에 맞게) ── */
const SCAN_SERVER = 'http://localhost:8080'; // app.py 포트

/* ── 서버 생존 확인 (1.5초 타임아웃) ── */
async function serverAlive(){
  try{
    const r = await fetch(SCAN_SERVER + '/api/scan/detect', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      // 1픽셀 GIF — 실제 처리 없이 응답만 확인
      body: JSON.stringify({image:'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='}),
      signal: AbortSignal.timeout(1500)
    });
    return r.status < 500; // 200 또는 400이면 서버 살아있음
  } catch{ return false; }
}

/* ═══════════════════════════════════════
   메인 진입점 — 자동 경로 선택
   ═══════════════════════════════════════ */
async function aiDocCrop(silent=false){
  if(!modalImages.length){ if(!silent) showToast('먼저 사진을 추가하세요'); return; }

  const statusEl = document.getElementById('aiCropStatus');
  const btn      = document.getElementById('btnAiCrop');
  if(btn) btn.disabled = true;

  try{
    const alive = await serverAlive();

    if(alive){
      /* ─── 경로 1: 서버 Python OpenCV ─── */
      statusEl.textContent = '🖥️ 서버(Python OpenCV)로 감지 중...';
      await runServerScan(silent, statusEl);
    } else {
      /* ─── 경로 2: Claude AI ─── */
      statusEl.textContent = '🤖 AI로 문서 감지 중... (1~3단계)';
      await aiDocCropFallback(silent, statusEl, btn);
    }
  } catch(e){
    console.error('aiDocCrop error:', e);
    statusEl.textContent = '⚠️ 오류: ' + e.message;
  } finally{
    if(btn) btn.disabled = false;
  }
}

/* ═══════════════════════════════════════
   경로 1: Flask 서버 Python OpenCV
   ═══════════════════════════════════════ */
async function runServerScan(silent, statusEl){
  const overlay = document.getElementById('scanOverlay');
  if(silent) overlay.style.display = 'flex';

  try{
    const m = modalImages[modalSlide];
    // 1600px 리사이즈 후 서버 전송
    const small = await resizeForAI(m.dataUrl, 1024);

    const resp = await fetch(SCAN_SERVER + '/api/scan/detect', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({image: small}),
      signal: AbortSignal.timeout(15000)
    });
    if(!resp.ok) throw new Error(`서버 오류 ${resp.status}`);
    const result = await resp.json();
    if(result.error) throw new Error(result.error);

    // 좌표를 원본 이미지 기준으로 역변환
    const origImg  = await loadImage(m.dataUrl);
    const smallImg = await loadImage(small);
    const sX = origImg.width  / smallImg.width;
    const sY = origImg.height / smallImg.height;

    docCorners = sortCorners(
      result.corners.map(([x,y]) => ({
        x: Math.round(Math.max(0, Math.min(origImg.width,  x*sX))),
        y: Math.round(Math.max(0, Math.min(origImg.height, y*sY)))
      }))
    );
    docScanImgData = m.dataUrl;

    statusEl.textContent = result.found
      ? '✅ 서버 감지 완료 — 꼭짓점 조정 후 크롭'
      : '⚠️ 문서 경계 불명확 — 꼭짓점을 조정하세요';

    openDocScanModal(origImg);

  } catch(e){
    console.error('Server scan failed:', e);
    statusEl.textContent = '⚠️ 서버 오류 → AI로 재시도 중...';
    // 서버 실패 시 AI로 자동 전환
    await aiDocCropFallback(false, statusEl, null);
  } finally{
    overlay.style.display = 'none';
  }
}

/* ═══════════════════════════════════════
   경로 2: Claude AI 2단계 정밀 감지
   ═══════════════════════════════════════ */
async function aiDocCropFallback(silent, statusEl, btn){
  const key = localStorage.getItem(LS_API_KEY)||'';
  if(!key){
    statusEl.textContent = '⚠️ AI 키 없음 — ⚙️에서 설정하세요';
    return;
  }
  const overlay = document.getElementById('scanOverlay');
  if(silent) overlay.style.display = 'flex';

  try{
    const m = modalImages[modalSlide];
    if(!m){ statusEl.textContent='⚠️ 사진이 없습니다'; return; }

    /* ── 전처리: 대비/선명도 향상 ── */
    const enhanced = await enhanceImage(m.dataUrl);

    /* ── 1단계: 문서 위치 + 신뢰도 ── */
    statusEl.textContent = '🤖 1단계: 문서 위치 파악 중...';
    const small1 = await resizeForAI(enhanced, 1024); // 1600→1024 payload 축소
    const [mt1, b641] = getB64Parts(small1);
    const [rW1, rH1]  = (await getImgSize(small1)).split('x').map(Number);

    const r1 = await callAI([{
      role:'user',
      content:[
        {type:'image', source:{type:'base64', media_type:mt1, data:b641}},
        {type:'text', text:
`당신은 문서 스캔 전문가입니다. 이미지(${rW1}×${rH1}px)에서 문서를 찾아주세요.

대상: 영수증, 계약서, 청구서, 종이문서, 명함, A4용지 등
조건: 그림자/접힘/구겨짐/비스듬한 각도 모두 인식

JSON만 반환 (다른 텍스트 절대 금지):
문서 있음: {"found":true,"tl":[x,y],"tr":[x,y],"br":[x,y],"bl":[x,y],"conf":0~100}
문서 없음: {"found":false}
(tl=좌상, tr=우상, br=우하, bl=좌하, 픽셀좌표)`
        }
      ]
    }], 200);

    let j1;
    try{ j1 = JSON.parse(r1.replace(/```json|```/g,'').trim()); }
    catch(pe){ throw new Error('AI 응답 파싱 실패: ' + r1.slice(0,100)); }

    if(!j1.found){
      /* 못 찾으면 기본 꼭짓점으로 모달 열기 */
      statusEl.textContent = '⚠️ 문서를 찾지 못했습니다. 꼭짓점을 직접 조정하세요.';
      const origImg = await loadImage(m.dataUrl);
      const px = Math.round(origImg.width*0.08), py = Math.round(origImg.height*0.08);
      docCorners     = sortCorners([
        {x:px,                y:py},
        {x:origImg.width-px,  y:py},
        {x:origImg.width-px,  y:origImg.height-py},
        {x:px,                y:origImg.height-py}
      ]);
      docScanImgData = m.dataUrl;
      openDocScanModal(origImg);
      return;
    }

    let corners = {tl:j1.tl, tr:j1.tr, br:j1.br, bl:j1.bl};

    /* ── 2단계: 신뢰도 낮으면 확대 재분석 ── */
    if((j1.conf||100) < 80){
      statusEl.textContent = '🤖 2단계: 정밀 좌표 재확인 중...';
      try{
        const xs  = [j1.tl[0],j1.tr[0],j1.br[0],j1.bl[0]];
        const ys  = [j1.tl[1],j1.tr[1],j1.br[1],j1.bl[1]];
        const pad = 0.08;
        const pw  = Math.round((Math.max(...xs)-Math.min(...xs))*pad);
        const ph  = Math.round((Math.max(...ys)-Math.min(...ys))*pad);
        const sx2 = Math.max(0, Math.min(...xs)-pw);
        const sy2 = Math.max(0, Math.min(...ys)-ph);
        const sw2 = Math.min(rW1-sx2, Math.max(...xs)-sx2+pw*2);
        const sh2 = Math.min(rH1-sy2, Math.max(...ys)-sy2+ph*2);

        const crop2      = await cropImageByPixel(small1, sx2, sy2, sw2, sh2);
        const [mt2,b642] = getB64Parts(crop2);
        const [rW2,rH2]  = (await getImgSize(crop2)).split('x').map(Number);

        const r2 = await callAI([{
          role:'user',
          content:[
            {type:'image', source:{type:'base64', media_type:mt2, data:b642}},
            {type:'text', text:
`이 이미지(${rW2}×${rH2}px)는 문서를 확대한 것입니다.
문서의 정확한 4개 꼭짓점 픽셀 좌표를 찾아주세요.
JSON만 반환: {"tl":[x,y],"tr":[x,y],"br":[x,y],"bl":[x,y]}`
            }
          ]
        }], 150);

        const j2 = JSON.parse(r2.replace(/```json|```/g,'').trim());
        const sc = rW1/rW2;
        corners  = {
          tl: [Math.round((j2.tl[0]+sx2)*sc), Math.round((j2.tl[1]+sy2)*sc)],
          tr: [Math.round((j2.tr[0]+sx2)*sc), Math.round((j2.tr[1]+sy2)*sc)],
          br: [Math.round((j2.br[0]+sx2)*sc), Math.round((j2.br[1]+sy2)*sc)],
          bl: [Math.round((j2.bl[0]+sx2)*sc), Math.round((j2.bl[1]+sy2)*sc)],
        };
      } catch(e2){ /* 2단계 실패 → 1단계 결과 유지 */ }
    }

    /* ── 원본 이미지 크기로 역변환 ── */
    const origImg = await loadImage(m.dataUrl);
    const sX = origImg.width  / rW1;
    const sY = origImg.height / rH1;
    const toOrig = ([x,y]) => ({
      x: Math.round(Math.max(0, Math.min(origImg.width,  x*sX))),
      y: Math.round(Math.max(0, Math.min(origImg.height, y*sY)))
    });

    docCorners     = sortCorners([toOrig(corners.tl), toOrig(corners.tr), toOrig(corners.br), toOrig(corners.bl)]);
    docScanImgData = m.dataUrl;

    statusEl.textContent = '✅ AI 감지 완료 — 꼭짓점 조정 후 크롭';
    openDocScanModal(origImg);

  } catch(e){
    console.error('AI fallback error:', e);
    statusEl.textContent = '⚠️ AI 오류: ' + e.message;
  } finally{
    if(btn) btn.disabled = false;
    overlay.style.display = 'none';
  }
}

/* ── 이미지 전처리: 대비/선명도 향상 (AI 정확도 개선) ── */
function enhanceImage(dataUrl){
  return new Promise(res=>{
    const img = new Image();
    img.onload = ()=>{
      const c   = document.createElement('canvas');
      c.width   = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.filter = 'contrast(1.15) brightness(1.05) saturate(0.85)';
      ctx.drawImage(img, 0, 0);
      res(c.toDataURL('image/jpeg', 0.95));
    };
    img.src = dataUrl;
  });
}


/* ══════════════════════════════════════════════════
   문서감지 풀스크린 v7.4 — 완전 재작성
   ══════════════════════════════════════════════════ */
let _dsOrig  = null;  // 원본 Image element
let _dsScale = 1;     // 표시 배율
let _dsZoom  = 1;     // 사용자 줌

/* ── 열기 ── */
function openDocScanModal(origImg){
  _dsOrig = origImg;
  _dsZoom = 1;
  // 핸들 inited 초기화 (재진입 대비)
  for(let i=0;i<8;i++){
    const h=document.getElementById('ch'+i);
    if(h) h._dsInited=false;
  }
  const fs = document.getElementById('modalDocScan');
  fs.classList.add('show');
  fs.style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>_dsRender()));
}

/* ── 닫기 ── */
function closeDocScanModal(){
  const fs=document.getElementById('modalDocScan');
  if(fs){ fs.classList.remove('show'); fs.style.display='none'; }
}

/* ── 렌더 ── */
function _dsRender(){
  const body   = document.getElementById('docScanBody');
  const canvas = document.getElementById('docScanCanvas');
  if(!_dsOrig||!canvas||!body) return;

  // 캔버스 크기: body 전체를 꽉 채우되 이미지 비율 유지
  const bW = body.clientWidth  || window.innerWidth;
  const bH = body.clientHeight || (window.innerHeight - 110);
  const scale = Math.min(bW/_dsOrig.width, bH/_dsOrig.height) * _dsZoom;
  _dsScale = scale;

  const dw = Math.round(_dsOrig.width  * scale);
  const dh = Math.round(_dsOrig.height * scale);
  canvas.width  = dw;
  canvas.height = dh;

  // 이미지 그리기
  const ctx = canvas.getContext('2d');
  ctx.drawImage(_dsOrig, 0, 0, dw, dh);

  // 꼭짓점 → 화면 좌표
  const disp = docCorners.map(p=>({x:Math.round(p.x*scale), y:Math.round(p.y*scale)}));

  // 선 그리기
  _dsDrawLines(ctx, disp, dw, dh);

  // 핸들 배치
  _dsPlaceHandles(disp);
}

/* ── 선 그리기 (외부 어둡게) ── */
function _dsDrawLines(ctx, pts, dw, dh){
  if(pts.length<4) return;
  ctx.save();
  // 외부 어둡게
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.rect(0,0,dw,dh);
  ctx.moveTo(pts[0].x,pts[0].y);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.closePath();
  ctx.fill('evenodd');
  // 테두리 선
  ctx.strokeStyle='#FFD700';
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(pts[0].x,pts[0].y);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/* ── 핸들 배치 (absolute position) ── */
function _dsPlaceHandles(disp){
  const [tl,tr,br,bl] = disp;

  // 모서리 4개 — transform:translate(-50%,-50%) 이미 CSS에 있음
  const corners=[
    {id:'ch0',x:tl.x,y:tl.y},
    {id:'ch1',x:tr.x,y:tr.y},
    {id:'ch2',x:br.x,y:br.y},
    {id:'ch3',x:bl.x,y:bl.y},
  ];
  corners.forEach(({id,x,y},i)=>{
    const h=document.getElementById(id); if(!h) return;
    h.style.left=x+'px'; h.style.top=y+'px';
    if(!h._dsInited){ h._dsInited=true; _dsBindCorner(h,i); }
  });

  // 엣지 막대 4개
  const bars=[
    {id:'ch4', x:(tl.x+tr.x)/2, y:Math.min(tl.y,tr.y), cls:'ds-t'},
    {id:'ch5', x:(bl.x+br.x)/2, y:Math.max(bl.y,br.y), cls:'ds-b'},
    {id:'ch6', x:Math.min(tl.x,bl.x), y:(tl.y+bl.y)/2, cls:'ds-l'},
    {id:'ch7', x:Math.max(tr.x,br.x), y:(tr.y+br.y)/2, cls:'ds-r'},
  ];
  const barTypes=['t','b','l','r'];
  bars.forEach(({id,x,y,cls},i)=>{
    const h=document.getElementById(id); if(!h) return;
    h.style.left=x+'px'; h.style.top=y+'px';
    if(!h._dsInited){ h._dsInited=true; _dsBindBar(h, barTypes[i]); }
  });
}

/* ── 모서리 드래그 ── */
function _dsBindCorner(handle, idx){
  handle.style.touchAction='none';
  handle.addEventListener('pointerdown', e=>{
    e.preventDefault(); e.stopPropagation();
    handle.setPointerCapture(e.pointerId);

    function onMove(ev){
      ev.preventDefault();
      const cr = document.getElementById('docScanCanvas').getBoundingClientRect();
      const cx = Math.max(0, Math.min(canvas_dw(), ev.clientX-cr.left));
      const cy = Math.max(0, Math.min(canvas_dh(), ev.clientY-cr.top));
      // 원본 좌표 업데이트
      docCorners[idx]={x:cx/_dsScale, y:cy/_dsScale};
      _dsRedraw();
    }
    function onEnd(){
      handle.removeEventListener('pointermove',onMove);
      handle.removeEventListener('pointerup',onEnd);
      handle.removeEventListener('pointercancel',onEnd);
    }
    handle.addEventListener('pointermove',onMove,{passive:false});
    handle.addEventListener('pointerup',onEnd);
    handle.addEventListener('pointercancel',onEnd);
  },{passive:false});
}

/* ── 막대 드래그 ── */
function _dsBindBar(handle, type){
  handle.style.touchAction='none';
  handle.addEventListener('pointerdown', e=>{
    e.preventDefault(); e.stopPropagation();
    handle.setPointerCapture(e.pointerId);

    function onMove(ev){
      ev.preventDefault();
      const cr = document.getElementById('docScanCanvas').getBoundingClientRect();
      const cx = Math.max(0, Math.min(canvas_dw(), ev.clientX-cr.left));
      const cy = Math.max(0, Math.min(canvas_dh(), ev.clientY-cr.top));
      const ox = cx/_dsScale, oy = cy/_dsScale;

      // 해당 변의 두 꼭짓점 이동
      if(type==='t'){       // 상단: tl(0),tr(1) y
        docCorners[0]={...docCorners[0],y:oy};
        docCorners[1]={...docCorners[1],y:oy};
      } else if(type==='b'){ // 하단: br(2),bl(3) y
        docCorners[2]={...docCorners[2],y:oy};
        docCorners[3]={...docCorners[3],y:oy};
      } else if(type==='l'){ // 좌: tl(0),bl(3) x
        docCorners[0]={...docCorners[0],x:ox};
        docCorners[3]={...docCorners[3],x:ox};
      } else if(type==='r'){ // 우: tr(1),br(2) x
        docCorners[1]={...docCorners[1],x:ox};
        docCorners[2]={...docCorners[2],x:ox};
      }
      _dsRedraw();
    }
    function onEnd(){
      handle.removeEventListener('pointermove',onMove);
      handle.removeEventListener('pointerup',onEnd);
      handle.removeEventListener('pointercancel',onEnd);
    }
    handle.addEventListener('pointermove',onMove,{passive:false});
    handle.addEventListener('pointerup',onEnd);
    handle.addEventListener('pointercancel',onEnd);
  },{passive:false});
}

/* ── 캔버스 크기 ── */
function canvas_dw(){ const c=document.getElementById('docScanCanvas'); return c?c.width:0; }
function canvas_dh(){ const c=document.getElementById('docScanCanvas'); return c?c.height:0; }

/* ── 다시 그리기 (드래그 중) ── */
function _dsRedraw(){
  const canvas=document.getElementById('docScanCanvas'); if(!canvas||!_dsOrig) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(_dsOrig,0,0,canvas.width,canvas.height);
  const disp=docCorners.map(p=>({x:Math.round(p.x*_dsScale),y:Math.round(p.y*_dsScale)}));
  _dsDrawLines(ctx,disp,canvas.width,canvas.height);
  _dsPlaceHandles(disp);
}

/* ── 줌 ── */
function _dsZoomIn(){  _dsZoom=Math.min(_dsZoom*1.4,4); _dsRender(); }
function _dsZoomOut(){ _dsZoom=Math.max(_dsZoom/1.4,0.5); _dsRender(); }

/* ── 크롭 적용 ── */
async function applyDocScanCrop(){
  if(!docCorners.length||!docScanImgData){ showToast('감지된 문서가 없습니다'); return; }
  const btn=document.getElementById('btnDocScanApply');
  if(btn) btn.disabled=true;
  const statusEl=document.getElementById('aiCropStatus');
  if(statusEl) statusEl.textContent='⏳ 크롭 중...';
  try{
    let result;
    try{ result=await serverWarp(docScanImgData,docCorners); }
    catch(e){ result=await canvasWarp(docScanImgData,docCorners); }
    closeDocScanModal();
    if(!modalImages.length) modalImages=[{id:uid(),dataUrl:result}];
    else modalImages[modalSlide]={id:modalImages[modalSlide]?.id||uid(),dataUrl:result};
    renderModalSlides();
    if(statusEl) statusEl.textContent='✅ 크롭 완료';
    showToast('✅ 문서 크롭 완료!');
  } catch(e){
    console.error(e);
    if(statusEl) statusEl.textContent='⚠️ '+e.message;
    showToast('크롭 오류: '+e.message);
  } finally{
    if(btn) btn.disabled=false;
  }
}

/* ── canvas bounding box 크롭 ── */
async function canvasWarp(dataUrl,corners){
  const img=await loadImage(dataUrl);
  const s=sortCorners(corners);
  const xs=s.map(p=>p.x),ys=s.map(p=>p.y);
  const sx=Math.max(0,Math.min(...xs)), sy=Math.max(0,Math.min(...ys));
  const sw=Math.min(img.width-sx,Math.max(...xs)-sx);
  const sh=Math.min(img.height-sy,Math.max(...ys)-sy);
  if(sw<20||sh<20) throw new Error('크롭 영역이 너무 작습니다');
  return cropImageByPixel(dataUrl,Math.round(sx),Math.round(sy),Math.round(sw),Math.round(sh));
}

/* 구버전 호환 */
function drawDocOutline(ctx,c,dw,dh){ _dsDrawLines(ctx,c,dw,dh); }
function makeDraggable(){}


/* ── Anthropic AI fallback (OpenCV 실패 시) ── */

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
      card.onclick=()=>{ closeAiDrop(); openViewModal(p.id); };
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
let editHistory=[];   // 뒤로가기 히스토리 스택
const MAX_HISTORY=20;

function pushHistory(){
  if(!canvas) return;
  const state = JSON.stringify(canvas.toJSON());
  editHistory.push(state);
  if(editHistory.length > MAX_HISTORY) editHistory.shift();
}
function popHistory(){
  if(!canvas || editHistory.length===0){ showToast('더 이상 되돌릴 수 없습니다'); return; }
  const state = editHistory.pop();
  canvas.loadFromJSON(state, ()=>{
    // 배경 이미지 복원
    canvas.renderAll();
  });
}
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

/* ═══════════════════════════════════════════
   수동 크롭 v6.0 — 완전히 새로 작성
   구조: #cropOverlay > #cropArea > #cropImg + #cropBox(핸들8개)
   원리: cropArea pointerdown → data-h 있으면 리사이즈, 없으면 move
         setPointerCapture 로 손가락이 밖으로 나가도 추적
         naturalWidth/naturalHeight 비율로 정확한 픽셀 크롭
   ═══════════════════════════════════════════ */

/* 크롭 상태 변수 */
let _cIR   = {w:0, h:0};          // cropImg 화면 크기
let _cOff  = {x:0, y:0};          // cropImg 의 cropArea 기준 offset
let _cBox  = {x:0, y:0, w:0, h:0}; // 크롭 박스 (cropImg 기준 좌표)
let _cDrag = null, _cSX=0, _cSY=0, _cSB=null;
let _cTries = 0;

/* 박스 DOM 업데이트 */
function _cLayout(){
  const box = document.getElementById('cropBox');
  if(!box) return;
  box.style.left   = (_cOff.x + _cBox.x) + 'px';
  box.style.top    = (_cOff.y + _cBox.y) + 'px';
  box.style.width  = _cBox.w + 'px';
  box.style.height = _cBox.h + 'px';
}

/* iOS/Android 공통 — 레이아웃 완료 대기 */
function _cReady(){
  const im = document.getElementById('cropImg');
  if(im.clientWidth > 0 && im.clientHeight > 0){ _cTries=0; _cMeasure(); return; }
  if(_cTries++ < 80){ requestAnimationFrame(_cReady); return; }
  // fallback
  _cTries=0;
  const area = document.getElementById('cropArea');
  _cIR  = {w: area.clientWidth||300, h: area.clientHeight||400};
  _cOff = {x:0, y:0};
  _cBox = {x:_cIR.w*0.06, y:_cIR.h*0.06, w:_cIR.w*0.88, h:_cIR.h*0.88};
  _cLayout();
}

function _cMeasure(){
  const im   = document.getElementById('cropImg');
  const area = document.getElementById('cropArea');
  const aR   = area.getBoundingClientRect();
  const iR   = im.getBoundingClientRect();
  _cIR  = {w: im.clientWidth, h: im.clientHeight};
  _cOff = {x: iR.left - aR.left, y: iR.top - aR.top};
  _cBox = {x:_cIR.w*0.06, y:_cIR.h*0.06, w:_cIR.w*0.88, h:_cIR.h*0.88};
  _cLayout();
}

/* 크롭 열기 */
function openCropUI(){
  cropImgSrc = (modalImages[modalSlide]||{}).dataUrl || cropImgSrc;
  if(!cropImgSrc){ showToast('사진이 없습니다'); return; }
  const im = document.getElementById('cropImg');
  im.onload = ()=>{ _cTries=0; requestAnimationFrame(_cReady); };
  im.src = cropImgSrc;
  if(im.complete && im.naturalWidth){ _cTries=0; requestAnimationFrame(_cReady); }
  document.getElementById('cropOverlay').classList.add('show');
}

function closeCropUI(){
  document.getElementById('cropOverlay').classList.remove('show');
}

/* 이벤트 초기화 — init() 에서 DOM 완성 후 1회 호출 */
function initCropEvents(){
  const area = document.getElementById('cropArea');
  if(!area || area._inited) return;
  area._inited = true;

  area.addEventListener('pointerdown', function(e){
    // e.target에서 data-h 찾기 (핸들은 pointer-events:all 이므로 직접 잡힘)
    let h = null;
    let el = e.target;
    while(el && el !== area){
      const dh = el.getAttribute && el.getAttribute('data-h');
      if(dh){ h = dh; break; }
      el = el.parentElement;
    }
    // #cropBox 내부 클릭 (핸들 아닌 곳) = move
    // #cropArea 빈 곳 클릭 = 무시
    if(!h){
      const box = document.getElementById('cropBox');
      if(!box) return;
      const bR = box.getBoundingClientRect();
      const inBox = e.clientX>=bR.left && e.clientX<=bR.right &&
                    e.clientY>=bR.top  && e.clientY<=bR.bottom;
      if(!inBox) return;
      h = 'move';
    }
    _cDrag = h;
    _cSX = e.clientX; _cSY = e.clientY;
    _cSB = {..._cBox};
    try{ area.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  }, {passive:false});

  area.addEventListener('pointermove', function(e){
    if(!_cDrag) return;
    const dx = e.clientX - _cSX;
    const dy = e.clientY - _cSY;
    let {x,y,w,h} = _cSB;
    const W = _cIR.w, H = _cIR.h;

    if(_cDrag === 'move'){
      x = Math.max(0, Math.min(_cSB.x + dx, W - _cSB.w));
      y = Math.max(0, Math.min(_cSB.y + dy, H - _cSB.h));
    } else {
      if(_cDrag.includes('l')){ x = _cSB.x+dx; w = _cSB.w-dx; }
      if(_cDrag.includes('r')){ w = _cSB.w+dx; }
      if(_cDrag.includes('t')){ y = _cSB.y+dy; h = _cSB.h-dy; }
      if(_cDrag.includes('b')){ h = _cSB.h+dy; }
      if(w < 30){ if(_cDrag.includes('l')){ x = _cSB.x+_cSB.w-30; } w=30; }
      if(h < 30){ if(_cDrag.includes('t')){ y = _cSB.y+_cSB.h-30; } h=30; }
      if(x<0){w+=x;x=0;} if(y<0){h+=y;y=0;}
      if(x+w>W) w=W-x; if(y+h>H) h=H-y;
    }
    _cBox = {x,y,w,h};
    _cLayout();
    e.preventDefault();
  }, {passive:false});

  area.addEventListener('pointerup',     ()=>{ _cDrag=null; });
  area.addEventListener('pointercancel', ()=>{ _cDrag=null; });
}

/* 크롭 적용 */
function applyCrop(){
  const im = document.getElementById('cropImg');
  if(!im.naturalWidth){ showToast('이미지가 없습니다'); return; }
  const sX = im.naturalWidth  / (_cIR.w || 1);
  const sY = im.naturalHeight / (_cIR.h || 1);
  const sx = Math.max(0, Math.round(_cBox.x * sX));
  const sy = Math.max(0, Math.round(_cBox.y * sY));
  const sw = Math.max(20, Math.round(_cBox.w * sX));
  const sh = Math.max(20, Math.round(_cBox.h * sY));

  const out = document.createElement('canvas');
  out.width=sw; out.height=sh;
  out.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
  const cropped = out.toDataURL('image/jpeg', 0.96);

  let idx = modalImages.findIndex(m=>m.id===editImgId);
  if(idx<0) idx = modalSlide;
  if(idx>=0 && idx<modalImages.length){
    modalImages[idx].dataUrl = cropped;
    editImgId = modalImages[idx].id;
    cropImgSrc = cropped;
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
  if(document.getElementById('catList')) renderCatList();
  showToast(`"${n}" 추가됨`);
}

function openCatModal(){
  renderCatList();
  openModal('modalCat');
}

function renderCatList(){
  const ul=document.getElementById('catList'); if(!ul) return;
  ul.innerHTML='';
  categories.forEach((c,i)=>{
    const li=document.createElement('li');
    li.className='cat-item';
    li.innerHTML=`<span class="cat-name">${c}</span><button title="삭제">🗑</button>`;
    li.querySelector('button').onclick=()=>{
      if(!confirm(`"${c}" 삭제?`)) return;
      categories.splice(i,1); saveCategories();
      renderCatList(); renderFilterChips(); populateCatSelect();
    };
    ul.appendChild(li);
  });
}

/* ══════════════════════════════════════════
   모드 관리 (일반사진 / 문서스캔)
   연속촬영 (burst)
   ══════════════════════════════════════════ */
let currentMode = 'photo'; // 'photo' | 'scan'
let burstImages = [];      // 연속촬영 임시 저장

/* 모드 전환 */
function setMode(mode){
  currentMode = mode;
  document.getElementById('tabPhoto').classList.toggle('active', mode==='photo');
  document.getElementById('tabScan').classList.toggle('active', mode==='scan');
  document.getElementById('modePhoto').style.display = mode==='photo' ? '' : 'none';
  document.getElementById('modeScan').style.display  = mode==='scan'  ? '' : 'none';
}

/* ── 일반사진: 카메라 연속촬영 ── */
function startBurstCamera(){
  burstImages = [];
  renderBurstOverlay();
  document.getElementById('fileInputCamera').click();
}

function renderBurstOverlay(){
  const overlay = document.getElementById('burstOverlay');
  const count   = document.getElementById('burstCount');
  const thumbs  = document.getElementById('burstThumbs');
  count.textContent = burstImages.length + '장';
  thumbs.innerHTML  = '';
  burstImages.forEach(m=>{
    const img = document.createElement('img');
    img.className = 'burst-thumb'; img.src = m.dataUrl;
    thumbs.appendChild(img);
  });
  overlay.classList.toggle('show', burstImages.length > 0);
}

async function addBurstFiles(files){
  for(const f of Array.from(files)){
    let blob = f;
    if(f.name?.toLowerCase().endsWith('.heic')||f.type==='image/heic'){
      try{ blob = await heic2any({blob:f,toType:'image/jpeg',quality:0.92}); }catch(e){}
    }
    burstImages.push({id:uid(), dataUrl: await blobToDataUrl(blob)});
  }
  renderBurstOverlay();
}

function burstDone(){
  if(!burstImages.length){ burstCancel(); return; }
  document.getElementById('burstOverlay').classList.remove('show');
  openAddModal([...burstImages]);
  burstImages = [];
}

function burstCancel(){
  burstImages = [];
  document.getElementById('burstOverlay').classList.remove('show');
}

/* ── 문서스캔: 카메라/갤러리 → 자동감지 ── */
async function startScanFromCamera(files){
  if(!files.length) return;
  const results = [];
  for(const f of Array.from(files)){
    let blob=f;
    if(f.name?.toLowerCase().endsWith('.heic')||f.type==='image/heic'){
      try{ blob=await heic2any({blob:f,toType:'image/jpeg',quality:0.92}); }catch(e){}
    }
    results.push({id:uid(), dataUrl:await blobToDataUrl(blob)});
  }
  openAddModal(results);
  // 자동 문서감지 실행
  setTimeout(()=> aiDocCrop(true), 400);
}


/* ════════════════════════════════════
   OneDrive 백업 (Microsoft Graph API)
   ════════════════════════════════════ */
const OD_CLIENT_ID = ''; // Azure App Registration Client ID (설정 필요)
const OD_SCOPE     = 'Files.ReadWrite offline_access';
let   odToken      = null;

async function odLogin(){
  const statusEl = document.getElementById('oneDriveStatus');
  if(!OD_CLIENT_ID){
    statusEl.innerHTML = '⚠️ OneDrive Client ID가 설정되지 않았습니다.<br>설정 > OneDrive 연동에서 입력하세요.';
    return null;
  }
  // PKCE 방식 로그인
  const redirectUri = location.origin + location.pathname;
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
    + `?client_id=${OD_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&scope=${encodeURIComponent(OD_SCOPE)}&response_mode=fragment`;
  const popup = window.open(authUrl, 'odAuth', 'width=500,height=600');
  return new Promise(res=>{
    const timer = setInterval(()=>{
      try{
        const hash = popup.location.hash;
        if(hash && hash.includes('access_token')){
          clearInterval(timer); popup.close();
          const params = new URLSearchParams(hash.slice(1));
          odToken = params.get('access_token');
          res(odToken);
        }
      }catch(e){}
      if(popup.closed){ clearInterval(timer); res(null); }
    }, 500);
  });
}

async function uploadToOneDrive(){
  const statusEl = document.getElementById('oneDriveStatus');
  statusEl.textContent = '☁️ OneDrive 연결 중...';

  // 토큰 없으면 로그인
  if(!odToken){
    odToken = await odLogin();
    if(!odToken){ statusEl.textContent = '❌ 로그인 실패'; return; }
  }

  try{
    statusEl.textContent = '📦 백업 파일 생성 중...';
    const allImages = await idbGetAll();
    const blob = new Blob(
      [JSON.stringify({photos, categories, images:allImages}, null, 2)],
      {type:'application/json'}
    );
    const fileName = `photoscan-backup-${today()}.json`;

    statusEl.textContent = '⬆️ OneDrive에 업로드 중...';
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/PhotoScan/${fileName}:/content`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${odToken}`,
          'Content-Type': 'application/json'
        },
        body: blob
      }
    );
    if(!resp.ok) throw new Error(`업로드 실패 ${resp.status}`);
    const result = await resp.json();
    statusEl.innerHTML = `✅ OneDrive 업로드 완료!<br>📁 경로: PhotoScan/${fileName}<br>📅 ${new Date().toLocaleString('ko-KR')}`;
    showToast('☁️ OneDrive 백업 완료!');
  } catch(e){
    if(e.message.includes('401')){ odToken=null; statusEl.textContent='⚠️ 인증 만료 — 다시 시도하세요'; }
    else statusEl.textContent = '❌ 오류: ' + e.message;
  }
}

/* ════════════════════════════════════
   AI 검색 — 검색창 통합
   @ 입력하거나 🤖 버튼 클릭 시 실행
   ════════════════════════════════════ */
function closeAiDrop(){
  document.getElementById('aiSearchDropdown').style.display='none';
}

async function runAiSearch(query){
  query = query.replace(/^@/,'').trim();
  if(!query) return;
  const key = localStorage.getItem(LS_API_KEY)||'';
  if(!key){ showToast('AI 키를 먼저 설정하세요 🔑'); return; }

  const drop = document.getElementById('aiSearchDropdown');
  const res  = document.getElementById('aiSearchDropResult');
  drop.style.display = '';
  res.innerHTML = '<div style="padding:16px;color:#94a3b8">🤖 검색 중...</div>';

  const index = photos.map(p=>({id:p.id,title:p.title,cat:p.cat,type:p.type,memo:p.memo,date:p.date}));
  try{
    const text = await callAI([{
      role:'user',
      content:`사진 목록:
${JSON.stringify(index)}

검색: "${query}"

관련 사진을 JSON으로 반환: [{"id":"xxx","reason":"이유"},...]. JSON만 반환.`
    }], 1024);
    const found = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g,'').trim());
    if(!found.length){ res.innerHTML='<p style="padding:16px;color:#aaa">관련 사진을 찾지 못했습니다.</p>'; return; }
    res.innerHTML='';
    found.forEach(r=>{
      const p=photos.find(x=>x.id===r.id); if(!p) return;
      const card=document.createElement('div');
      card.className='result-card';
      card.innerHTML=`<div class="result-title">${p.title||'(제목 없음)'}</div><div class="result-meta">${p.type||''} · ${p.cat||''} · ${p.date||''}</div><div class="result-reason">${r.reason}</div>`;
      card.onclick=()=>{ closeAiDrop(); openViewModal(p.id); };
      res.appendChild(card);
    });
  } catch(e){
    res.innerHTML=`<p style="padding:16px;color:red">오류: ${e.message}</p>`;
  }
}


/* ── Init ── */
async function init(){
  await openIDB();
  loadData();

  /* ── 버전/모드 표시 ── */
  const _el = id => document.getElementById(id);
  if(_el('appTitle'))   _el('appTitle').textContent   = MODE_LABEL;
  if(_el('appVersion')) _el('appVersion').textContent = 'v7.4';
  document.title = MODE_LABEL;
  // 상단 모드 컬러 바
  const modeBar = document.createElement('div');
  modeBar.style.cssText = `position:fixed;top:0;left:0;right:0;height:3px;background:${MODE_COLOR};z-index:200;`;
  document.body.appendChild(modeBar);

  /* ── 크롭 이벤트 초기화 ── */
  initCropEvents();

  /* ── OpenCV 로딩 배지 ── */
  if(!cvReady && !cvError){
    const badge = document.createElement('div');
    badge.id='cvStatusBadge'; badge.className='cv-status';
    badge.textContent='⏳ OpenCV 로딩 중...';
    document.body.appendChild(badge);
    let tries=0;
    const waitCv = setInterval(()=>{
      tries++;
      if(cvReady){ badge.textContent='✅ OpenCV 준비됨'; setTimeout(()=>badge.remove(),2000); clearInterval(waitCv); }
      else if(cvError||tries>30){ cvError=true; badge.textContent='⚠️ OpenCV 실패(AI모드)'; setTimeout(()=>badge.remove(),3000); clearInterval(waitCv); }
    },500);
  }

  renderFilterChips();
  renderGallery();
  populateCatSelect();

  /* ══════════════════════════════════════
     헤더 아이콘 — 모두 안전하게 연결
     ══════════════════════════════════════ */
  const $on = (id,fn)=>{ const el=_el(id); if(el) el.onclick=fn; };

  $on('btnHome',       ()=>location.href='index.html');
  $on('btnBackup',     ()=>{ if(_el('oneDriveStatus')) _el('oneDriveStatus').textContent='☁️ 준비됨'; openModal('modalOneDrive'); });
  $on('btnApiKey',     ()=>{ if(_el('apiKeyInput')) _el('apiKeyInput').value=localStorage.getItem(LS_API_KEY)||''; openModal('modalApiKey'); });
  $on('btnCatManage2', openCatModal);
  $on('btnLocalExp',   exportBackup);
  $on('btnLocalImp',   ()=>_el('backupInput')?.click());
  $on('btnAddCat',     ()=>{ const n=prompt('새 카테고리 이름'); if(n?.trim()) addCategory(n.trim()); });

  /* ══════════════════════════════════════
     모드 버튼 (일반사진 / 문서스캔)
     ══════════════════════════════════════ */
  $on('btnPhotoCamera',  startBurstCamera);
  $on('btnPhotoGallery', ()=>_el('fileInputGallery')?.click());
  $on('btnScanCamera',   ()=>_el('fileScanCamera')?.click());
  $on('btnScanGallery',  ()=>_el('fileScanGallery')?.click());

  /* 파일 입력 */
  $on('fileInputCamera',  null); // onclick 아님 — onchange 아래에서
  _el('fileInputCamera')  && (_el('fileInputCamera').onchange  = e=>{ if(e.target.files.length) addBurstFiles(e.target.files); e.target.value=''; });
  _el('fileInputGallery') && (_el('fileInputGallery').onchange = e=>{ if(e.target.files.length) handleFiles(e.target.files); e.target.value=''; });
  _el('fileScanCamera')   && (_el('fileScanCamera').onchange   = e=>{ if(e.target.files.length) startScanFromCamera(e.target.files); e.target.value=''; });
  _el('fileScanGallery')  && (_el('fileScanGallery').onchange  = e=>{ if(e.target.files.length) startScanFromCamera(e.target.files); e.target.value=''; });
  _el('addMoreCam')       && (_el('addMoreCam').onchange       = e=>{ if(e.target.files.length) handleFiles(e.target.files,true); e.target.value=''; });
  _el('addMoreGal')       && (_el('addMoreGal').onchange       = e=>{ if(e.target.files.length) handleFiles(e.target.files,true); e.target.value=''; });
  _el('backupInput')      && (_el('backupInput').onchange      = e=>{ if(e.target.files[0]) importBackup(e.target.files[0]); e.target.value=''; });

  /* 연속촬영 오버레이 */
  $on('burstAddMore', ()=>_el('fileInputCamera')?.click());
  $on('burstDone',    burstDone);
  $on('burstCancel',  burstCancel);

  /* ══════════════════════════════════════
     검색
     ══════════════════════════════════════ */
  const srchEl = _el('gallerySearch');
  if(srchEl){
    srchEl.oninput = e=>{ currentSearch=e.target.value.startsWith('@')?'':e.target.value; renderGallery(); };
    srchEl.addEventListener('keydown', e=>{
      if(e.key==='Enter' && srchEl.value.startsWith('@')){ e.preventDefault(); runAiSearch(srchEl.value); }
    });
  }
  $on('btnAiSearchInline', ()=>{
    const v=srchEl?.value||'';
    runAiSearch(v.startsWith('@')?v:'@'+(v||prompt('AI 검색어')||''));
  });

  /* ══════════════════════════════════════
     사진 추가/수정 모달
     ══════════════════════════════════════ */
  $on('btnModalAddClose', ()=>closeModal('modalAdd'));
  $on('btnSlidePrev',     ()=>goSlide(-1));
  $on('btnSlideNext',     ()=>goSlide(1));
  $on('btnExpandImg',     openImgPopup);
  $on('btnAddMoreCam',    ()=>_el('addMoreCam')?.click());
  $on('btnAddMoreGal',    ()=>_el('addMoreGal')?.click());
  $on('btnDelImg', ()=>{
    if(!modalImages.length) return;
    modalImages.splice(modalSlide,1);
    modalSlide=Math.min(modalSlide,modalImages.length-1);
    renderModalSlides();
  });
  $on('btnAiCrop',   ()=>aiDocCrop(false));
  $on('btnSavePhoto', savePhoto);
  $on('btnEditPhoto', openEditor);

  /* 카테고리 인라인 추가/삭제 */
  $on('btnInlineCatAdd', ()=>{
    const n=prompt('새 카테고리 이름'); if(n?.trim()) addCategory(n.trim());
  });
  $on('btnInlineCatDel', ()=>{
    const sel=_el('photoCat'); if(!sel?.value) return;
    if(!confirm(`"${sel.value}" 카테고리를 삭제할까요?`)) return;
    categories=categories.filter(c=>c!==sel.value); saveCategories();
    populateCatSelect(); renderFilterChips(); showToast('삭제됨');
  });

  /* ══════════════════════════════════════
     편집 모달
     ══════════════════════════════════════ */
  $on('btnEditClose', ()=>{ closeModal('modalEdit'); openModal('modalAdd'); });
  $on('btnEditDone',  finishEdit);
  $on('btnEditUndo',  ()=>{ if(canvas&&canvas.undo) canvas.undo(); });
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>{
    b.onclick=()=>{
      const t=b.dataset.tool;
      if(t==='rect') addShape('rect');
      else if(t==='circle') addShape('circle');
      else if(t==='arrow')  addArrow();
      else setTool(t);
    };
  });
  $on('toolColor', null);
  _el('toolColor') && (_el('toolColor').onchange=()=>{ if(canvas&&canvas.isDrawingMode) canvas.freeDrawingBrush.color=_el('toolColor').value; });
  _el('toolSize')  && (_el('toolSize').onchange =()=>{ if(canvas&&canvas.isDrawingMode) canvas.freeDrawingBrush.width=parseInt(_el('toolSize').value); });
  // 뒤로가기
  $on('btnUndoAction',  popHistory);
  $on('btnEditUndo',    popHistory);
  // 선택 객체 삭제
  $on('btnDelSelected', ()=>{
    if(!canvas) return;
    const objs = canvas.getActiveObjects();
    if(!objs.length){ showToast('삭제할 객체를 선택하세요'); return; }
    objs.forEach(o=>canvas.remove(o));
    canvas.discardActiveObject();
    canvas.renderAll();
  });
  $on('btnDelObj', ()=>{ // 기존 호환
    if(!canvas) return;
    const o=canvas.getActiveObject();
    if(o){canvas.remove(o);canvas.renderAll();}
  });
  $on('btnRotateL',   ()=>rotateImage(-90));
  $on('btnRotateR',   ()=>rotateImage(90));
  $on('btnApplyCrop', applyCrop);
  $on('btnCancelCrop',()=>{ closeCropUI(); setTool('select'); });
  $on('btnAddText',   addText);
  _el('textInput') && (_el('textInput').onkeydown=e=>{ if(e.key==='Enter') addText(); });

  /* 크롭 풀스크린 버튼 */
  $on('cropDoneBtn',   applyCrop);
  $on('cropCancelBtn', ()=>{ closeCropUI(); setTool('select'); });
  $on('cropRotateBtn', ()=>{
    const im=_el('cropImg'); if(!im) return;
    const tmp=new Image(); tmp.onload=()=>{
      const cv=document.createElement('canvas'); cv.width=tmp.height; cv.height=tmp.width;
      const ctx=cv.getContext('2d'); ctx.translate(cv.width/2,cv.height/2); ctx.rotate(Math.PI/2);
      ctx.drawImage(tmp,-tmp.width/2,-tmp.height/2);
      cropImgSrc=cv.toDataURL('image/jpeg',0.95);
      im.onload=()=>{ _cTries=0; requestAnimationFrame(_cReady); };
      im.src=cropImgSrc;
    }; tmp.src=im.src||cropImgSrc;
  });

  /* ══════════════════════════════════════
     상세보기 모달
     ══════════════════════════════════════ */
  $on('btnViewClose',  ()=>{ if(_el('modalView')) _el('modalView').style.display='none'; });
  $on('btnViewPrev',   ()=>viewNavSlide(-1));
  $on('btnViewNext',   ()=>viewNavSlide(1));
  $on('btnViewShare',  sharePhoto);
  $on('btnViewEdit',   ()=>{ if(_el('modalView')) _el('modalView').style.display='none'; openEditMetaModal(viewPhotoId); });
  $on('btnViewDelete', ()=>deletePhoto(viewPhotoId));

  /* ══════════════════════════════════════
     OpenCV 문서감지 모달
     ══════════════════════════════════════ */
  $on('btnDocScanClose', closeDocScanModal);
  $on('btnDocScanRetry', ()=>{ closeDocScanModal(); aiDocCrop(false); });
  $on('btnDocScanApply', applyDocScanCrop);
  $on('btnDocScanZoomIn',  _dsZoomIn);
  $on('btnDocScanZoomOut', _dsZoomOut);

  /* ══════════════════════════════════════
     카테고리 관리 모달
     ══════════════════════════════════════ */
  $on('btnCatClose', ()=>closeModal('modalCat'));
  $on('btnCatAdd',   ()=>{
    const n=_el('catNewName')?.value.trim(); if(!n) return;
    addCategory(n); if(_el('catNewName')) _el('catNewName').value='';
  });
  _el('catNewName') && (_el('catNewName').onkeydown=e=>{ if(e.key==='Enter') _el('btnCatAdd')?.click(); });

  /* ══════════════════════════════════════
     API 키 모달
     ══════════════════════════════════════ */
  $on('btnApiKeyClose', ()=>closeModal('modalApiKey'));
  $on('btnSaveApiKey',  ()=>{
    const k=_el('apiKeyInput')?.value.trim()||'';
    localStorage.setItem(LS_API_KEY,k); closeModal('modalApiKey'); showToast('API 키 저장됨');
  });

  /* ══════════════════════════════════════
     OneDrive 모달
     ══════════════════════════════════════ */
  $on('btnOneDriveClose', ()=>closeModal('modalOneDrive'));
  $on('btnOdUpload',      uploadToOneDrive);
  $on('btnOdLocalExport', ()=>{ closeModal('modalOneDrive'); exportBackup(); });

  /* ══════════════════════════════════════
     ESC 키
     ══════════════════════════════════════ */
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      ['modalAdd','modalEdit','modalApiKey','modalOneDrive','modalCat'].forEach(closeModal);
      if(_el('modalView'))    _el('modalView').style.display='none';
      closeDocScanModal();
      if(_el('imgPopup'))     _el('imgPopup').style.display='none';
      closeAiDrop(); closeCropUI();
    }
  });

  /* 드래그&드롭 */
  document.addEventListener('dragover', e=>e.preventDefault());
  document.addEventListener('drop', e=>{
    e.preventDefault();
    const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')||f.name?.endsWith('.heic'));
    if(files.length) handleFiles(files);
  });
}

document.addEventListener('DOMContentLoaded', init);
