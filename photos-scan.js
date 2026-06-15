/* ============================================
   photos-scan.js  v1.0-20260616
   기능: 사진 스캔/저장, AI 문서 크롭, Fabric.js 편집,
         카테고리, 제목/메모, Firebase 백업, AI 검색
   ============================================ */

'use strict';

/* =====================
   APP CONFIG
   ===================== */
const APP_VERSION = 'v1.0-20260616';
const FIREBASE_PROJECT = 'my-system-25497';
const FIREBASE_API_KEY = 'AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const LS_PHOTOS   = 'photoscan_photos';
const LS_CATS     = 'photoscan_categories';
const LS_API_KEY  = 'photoscan_anthropic_key';

/* =====================
   INDEXEDDB (실제 이미지 저장)
   ===================== */
let idb = null;
const IDB_NAME = 'PhotoScanDB';
const IDB_STORE = 'images';

function openIDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
    };
    req.onsuccess = e => { idb = e.target.result; res(idb); };
    req.onerror   = e => rej(e);
  });
}
function idbPut(id, dataUrl) {
  return new Promise((res, rej) => {
    const tx  = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ id, dataUrl });
    tx.oncomplete = res; tx.onerror = rej;
  });
}
function idbGet(id) {
  return new Promise((res, rej) => {
    const tx  = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = e => res(e.target.result ? e.target.result.dataUrl : null);
    req.onerror   = rej;
  });
}
function idbDelete(id) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = res; tx.onerror = rej;
  });
}
function idbGetAll() {
  return new Promise((res, rej) => {
    const tx  = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = rej;
  });
}

/* =====================
   STATE
   ===================== */
let photos     = [];   // [{id, title, cat, memo, date, imgIds:[], thumb}]
let categories = [];   // ['영수증','계약서', ...]
let currentFilter = 'all';
let currentSearch = '';
let apiKey = '';

/* =====================
   LOAD / SAVE
   ===================== */
function loadData() {
  try { photos     = JSON.parse(localStorage.getItem(LS_PHOTOS)  || '[]'); } catch(e){ photos = []; }
  try { categories = JSON.parse(localStorage.getItem(LS_CATS)    || '["영수증","계약서","문서","일반"]'); } catch(e){ categories = ['영수증','계약서','문서','일반']; }
  apiKey = localStorage.getItem(LS_API_KEY) || '';
}
function savePhotos()     { localStorage.setItem(LS_PHOTOS, JSON.stringify(photos)); }
function saveCategories() { localStorage.setItem(LS_CATS, JSON.stringify(categories)); }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function today() { return new Date().toISOString().slice(0,10); }

/* =====================
   TOAST
   ===================== */
let toastTimer = null;
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

/* =====================
   VIEW SWITCHER
   ===================== */
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('active');
  document.querySelectorAll('.menu-item[data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });
  closeSideMenu();
  if (name === 'gallery') renderGallery();
  if (name === 'categories') renderCatList();
}

/* =====================
   SIDE MENU
   ===================== */
function openSideMenu()  { document.getElementById('sideMenu').classList.add('open'); document.getElementById('sideOverlay').classList.add('open'); }
function closeSideMenu() { document.getElementById('sideMenu').classList.remove('open'); document.getElementById('sideOverlay').classList.remove('open'); }

/* =====================
   CATEGORY CHIPS
   ===================== */
function renderFilterChips() {
  const area = document.getElementById('filterChips');
  area.innerHTML = '<button class="chip' + (currentFilter==='all'?' active':'') + '" data-cat="all">전체</button>';
  categories.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (currentFilter===c?' active':'');
    btn.dataset.cat = c; btn.textContent = c;
    area.appendChild(btn);
  });
  area.querySelectorAll('.chip').forEach(b => {
    b.addEventListener('click', () => {
      currentFilter = b.dataset.cat;
      renderFilterChips(); renderGallery();
    });
  });
}

/* =====================
   GALLERY RENDER
   ===================== */
async function renderGallery() {
  const grid  = document.getElementById('photoGrid');
  const empty = document.getElementById('emptyState');
  const q     = currentSearch.toLowerCase();
  const list  = photos.filter(p => {
    const matchCat  = currentFilter === 'all' || p.cat === currentFilter;
    const matchText = !q || (p.title||'').toLowerCase().includes(q) || (p.memo||'').toLowerCase().includes(q);
    return matchCat && matchText;
  }).sort((a,b) => b.id.localeCompare(a.id));

  // Remove old cards (keep emptyState)
  grid.querySelectorAll('.photo-card').forEach(c => c.remove());

  if (!list.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  for (const p of list) {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.dataset.id = p.id;

    // Lazy load thumb
    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-img-wrap';
    const img = document.createElement('img');
    img.className = 'card-img';
    img.alt = p.title || '사진';
    imgWrap.appendChild(img);
    if ((p.imgIds||[]).length > 1) {
      const badge = document.createElement('span');
      badge.className = 'multi-badge';
      badge.textContent = `×${p.imgIds.length}`;
      imgWrap.appendChild(badge);
    }

    // load thumb from IDB
    const firstId = (p.imgIds||[])[0];
    if (firstId) {
      idbGet(firstId).then(url => { if (url) img.src = url; });
    }

    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = `
      <div class="card-title">${p.title || '(제목 없음)'}</div>
      <div class="card-meta">
        <span class="badge">${p.cat || '일반'}</span>
        <span class="card-date">${(p.date||'').slice(5)}</span>
      </div>`;

    card.appendChild(imgWrap); card.appendChild(body);
    card.addEventListener('click', () => openViewModal(p.id));
    grid.insertBefore(card, empty);
  }
}

/* =====================
   CATEGORY MANAGEMENT
   ===================== */
function renderCatList() {
  const ul = document.getElementById('catList');
  ul.innerHTML = '';
  categories.forEach((c, i) => {
    const li = document.createElement('li');
    li.className = 'cat-item';
    li.innerHTML = `<span class="cat-name">${c}</span><button title="삭제" data-i="${i}">🗑</button>`;
    li.querySelector('button').addEventListener('click', () => {
      if (confirm(`"${c}" 카테고리를 삭제할까요?`)) {
        categories.splice(i, 1); saveCategories();
        renderCatList(); renderFilterChips();
      }
    });
    ul.appendChild(li);
  });
}

/* =====================
   PHOTO ADD / EDIT MODAL
   ===================== */
let modalImages  = [];  // [{id, dataUrl}] for current add session
let modalSlide   = 0;
let editingPhotoId = null;

function openAddModal(preImages = []) {
  editingPhotoId = null;
  modalImages = preImages;
  modalSlide = 0;
  document.getElementById('modalAddTitle').textContent = '사진 추가';
  document.getElementById('photoTitle').value = '';
  document.getElementById('photoMemo').value = '';
  document.getElementById('photoDate').value = today();
  document.getElementById('aiCropStatus').textContent = '';
  populateCatSelect();
  renderModalSlides();
  document.getElementById('modalAdd').classList.add('open');
}

function openEditMetaModal(pid) {
  const p = photos.find(x => x.id === pid);
  if (!p) return;
  editingPhotoId = pid;
  modalImages = [];
  modalSlide = 0;
  document.getElementById('modalAddTitle').textContent = '사진 수정';
  document.getElementById('photoTitle').value = p.title || '';
  document.getElementById('photoMemo').value = p.memo || '';
  document.getElementById('photoDate').value = p.date || today();
  document.getElementById('aiCropStatus').textContent = '';
  populateCatSelect(p.cat);

  // Load images from IDB
  Promise.all((p.imgIds||[]).map(id => idbGet(id).then(url => ({id, dataUrl: url}))))
    .then(imgs => {
      modalImages = imgs.filter(x => x.dataUrl);
      renderModalSlides();
    });
  document.getElementById('modalAdd').classList.add('open');
}

function populateCatSelect(selected) {
  const sel = document.getElementById('photoCat');
  sel.innerHTML = categories.map(c => `<option value="${c}" ${c===selected?'selected':''}>${c}</option>`).join('');
}

function renderModalSlides() {
  const wrap = document.getElementById('imgSlides');
  wrap.innerHTML = '';
  if (!modalImages.length) {
    wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-size:14px;">사진 없음</div>';
    document.getElementById('slideCount').textContent = '0 / 0';
    return;
  }
  modalImages.forEach((m, i) => {
    const img = document.createElement('img');
    img.src = m.dataUrl; img.alt = '';
    if (i === modalSlide) img.classList.add('active');
    wrap.appendChild(img);
  });
  document.getElementById('slideCount').textContent = `${modalSlide+1} / ${modalImages.length}`;
}

function goSlide(dir) {
  if (!modalImages.length) return;
  modalSlide = (modalSlide + dir + modalImages.length) % modalImages.length;
  renderModalSlides();
}

async function savePhoto() {
  const title = document.getElementById('photoTitle').value.trim();
  const cat   = document.getElementById('photoCat').value;
  const memo  = document.getElementById('photoMemo').value.trim();
  const date  = document.getElementById('photoDate').value || today();

  if (!modalImages.length) { showToast('사진을 1장 이상 추가하세요'); return; }
  if (!title) { showToast('제목을 입력하세요'); return; }

  if (editingPhotoId) {
    // UPDATE
    const p = photos.find(x => x.id === editingPhotoId);
    if (!p) return;
    // Delete old IDB images
    await Promise.all((p.imgIds||[]).map(id => idbDelete(id)));
    const newIds = [];
    for (const m of modalImages) {
      const nid = m.id || uid();
      await idbPut(nid, m.dataUrl);
      newIds.push(nid);
    }
    p.title = title; p.cat = cat; p.memo = memo; p.date = date; p.imgIds = newIds;
    savePhotos();
  } else {
    // INSERT
    const pid = uid();
    const imgIds = [];
    for (const m of modalImages) {
      const iid = uid();
      await idbPut(iid, m.dataUrl);
      imgIds.push(iid);
    }
    photos.unshift({ id: pid, title, cat, memo, date, imgIds });
    savePhotos();
  }

  closeModal('modalAdd');
  renderGallery();
  showToast('저장되었습니다');
}

/* =====================
   FILE INPUT HANDLER
   ===================== */
async function handleFiles(files, append = false) {
  const arr = Array.from(files);
  const results = [];
  for (const f of arr) {
    let blob = f;
    // HEIC 변환
    if (f.name.toLowerCase().endsWith('.heic') || f.type === 'image/heic') {
      try { blob = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.92 }); }
      catch(e) { console.warn('heic convert fail', e); }
    }
    const dataUrl = await blobToDataUrl(blob);
    results.push({ id: uid(), dataUrl });
  }
  if (append) { modalImages.push(...results); renderModalSlides(); }
  else { openAddModal(results); }
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

/* =====================
   VIEW MODAL (상세보기)
   ===================== */
let viewPhotoId = null;
let viewSlide   = 0;
let viewImgIds  = [];

async function openViewModal(pid) {
  const p = photos.find(x => x.id === pid);
  if (!p) return;
  viewPhotoId = pid;
  viewSlide   = 0;
  viewImgIds  = p.imgIds || [];

  document.getElementById('viewTitle').textContent = p.title || '(제목 없음)';
  document.getElementById('viewCat').textContent   = p.cat   || '일반';
  document.getElementById('viewDate').textContent  = p.date  || '';
  document.getElementById('viewMemo').textContent  = p.memo  || '';

  await updateViewImg();
  document.getElementById('modalView').classList.add('open');
}

async function updateViewImg() {
  const id  = viewImgIds[viewSlide];
  const url = id ? await idbGet(id) : null;
  document.getElementById('viewImg').src = url || '';
  document.getElementById('btnViewPrev').style.display = viewImgIds.length > 1 ? '' : 'none';
  document.getElementById('btnViewNext').style.display = viewImgIds.length > 1 ? '' : 'none';
}

async function viewNavSlide(dir) {
  viewSlide = (viewSlide + dir + viewImgIds.length) % viewImgIds.length;
  await updateViewImg();
}

async function deletePhoto(pid) {
  if (!confirm('이 사진을 삭제할까요?')) return;
  const idx = photos.findIndex(x => x.id === pid);
  if (idx < 0) return;
  const p = photos[idx];
  await Promise.all((p.imgIds||[]).map(id => idbDelete(id)));
  photos.splice(idx, 1);
  savePhotos();
  closeModal('modalView');
  renderGallery();
  showToast('삭제되었습니다');
}

/* =====================
   AI CROP (문서 감지)
   ===================== */
async function aiDocCrop() {
  if (!modalImages.length) { showToast('먼저 사진을 추가하세요'); return; }
  const key = apiKey || localStorage.getItem(LS_API_KEY) || '';
  if (!key) { showToast('AI API 키를 먼저 설정하세요 (메뉴 > AI API 키 설정)'); return; }

  const status = document.getElementById('aiCropStatus');
  status.textContent = '🤖 분석 중...';
  document.getElementById('btnAiCrop').disabled = true;

  try {
    const m = modalImages[modalSlide];
    // Send to Claude for document detection
    const base64 = m.dataUrl.split(',')[1];
    const mtype  = m.dataUrl.split(';')[0].split(':')[1];

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mtype, data: base64 } },
            { type: 'text', text: '이 이미지에서 문서(영수증, 계약서, 종이 문서 등)를 찾아주세요. 문서가 있다면 JSON으로 크롭 좌표를 알려주세요. 형식: {"hasDoc":true,"x":0.1,"y":0.05,"w":0.8,"h":0.9} (0~1 비율). 문서가 없으면 {"hasDoc":false}만 반환. JSON만 반환하세요.' }
          ]
        }]
      })
    });
    const data = await resp.json();
    const text = (data.content||[]).map(b => b.text||'').join('');
    const json = JSON.parse(text.replace(/```json|```/g,'').trim());

    if (!json.hasDoc) {
      status.textContent = '✓ 문서를 찾지 못했습니다 (일반 사진으로 저장됩니다)';
      return;
    }
    // Crop image using canvas
    const cropped = await cropImageDataUrl(m.dataUrl, json.x, json.y, json.w, json.h);
    modalImages[modalSlide].dataUrl = cropped;
    renderModalSlides();
    status.textContent = '✓ 문서 영역이 자동으로 잘렸습니다';
  } catch(e) {
    console.error(e);
    status.textContent = '⚠ AI 분석 중 오류가 발생했습니다';
  } finally {
    document.getElementById('btnAiCrop').disabled = false;
  }
}

function cropImageDataUrl(dataUrl, rx, ry, rw, rh) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const sx = Math.round(rx * img.width);
      const sy = Math.round(ry * img.height);
      const sw = Math.round(rw * img.width);
      const sh = Math.round(rh * img.height);
      c.width = sw; c.height = sh;
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      res(c.toDataURL('image/jpeg', 0.92));
    };
    img.src = dataUrl;
  });
}

/* =====================
   AI SEARCH
   ===================== */
async function aiSearch() {
  const query = document.getElementById('aiSearchQuery').value.trim();
  if (!query) return;
  const key = apiKey || localStorage.getItem(LS_API_KEY) || '';
  if (!key) { showToast('AI API 키를 먼저 설정하세요'); return; }

  const resultEl = document.getElementById('aiSearchResult');
  resultEl.innerHTML = '<div class="loading">검색 중</div>';

  // Build photo index for AI
  const index = photos.map(p => ({
    id: p.id, title: p.title, cat: p.cat, memo: p.memo, date: p.date, count: (p.imgIds||[]).length
  }));

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `다음은 저장된 사진 목록입니다:\n${JSON.stringify(index)}\n\n사용자 검색: "${query}"\n\n관련 사진의 id 목록과 이유를 JSON으로 반환하세요. 형식: [{"id":"xxx","reason":"이유"}, ...]. JSON만 반환.`
        }]
      })
    });
    const data = await resp.json();
    const text = (data.content||[]).map(b=>b.text||'').join('');
    const found = JSON.parse(text.replace(/```json|```/g,'').trim());

    if (!found.length) { resultEl.innerHTML = '<p style="color:#aaa;font-size:14px;">관련 사진을 찾지 못했습니다.</p>'; return; }

    resultEl.innerHTML = '';
    for (const r of found) {
      const p = photos.find(x => x.id === r.id);
      if (!p) continue;
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `<div class="result-title">${p.title || '(제목 없음)'}</div><div class="result-meta">${p.cat||''} · ${p.date||''}</div><div class="result-reason">${r.reason}</div>`;
      card.addEventListener('click', () => {
        document.getElementById('panelSearch').classList.remove('open');
        openViewModal(p.id);
      });
      resultEl.appendChild(card);
    }
  } catch(e) {
    resultEl.innerHTML = '<p style="color:red;font-size:13px;">오류가 발생했습니다.</p>';
  }
}

/* =====================
   BACKUP
   ===================== */
async function exportBackup() {
  showToast('백업 파일 생성 중...');
  const allImages = await idbGetAll();
  const blob = new Blob([JSON.stringify({ photos, categories, images: allImages }, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `photoscan-backup-${today()}.json`;
  a.click();
  showToast('백업 완료');
}

async function importBackup(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.photos || !data.images) { showToast('올바른 백업 파일이 아닙니다'); return; }
    if (!confirm(`백업을 불러오면 현재 데이터가 덮어씌워집니다. 계속할까요?\n(사진 ${data.photos.length}개)`)) return;

    // Save images to IDB
    for (const img of data.images) await idbPut(img.id, img.dataUrl);
    photos     = data.photos;
    categories = data.categories || categories;
    savePhotos(); saveCategories();
    renderGallery(); renderFilterChips(); renderCatList();
    showToast('백업 불러오기 완료');
  } catch(e) { showToast('파일 읽기 오류'); }
}

/* =====================
   FIREBASE BACKUP (클라우드)
   ===================== */
async function firebaseBackupMeta() {
  try {
    const docId = 'photoscan-meta';
    const url   = `${FS_BASE}/photoscan/${docId}?key=${FIREBASE_API_KEY}`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          photos:     { stringValue: JSON.stringify(photos) },
          categories: { stringValue: JSON.stringify(categories) },
          updatedAt:  { stringValue: new Date().toISOString() }
        }
      })
    });
    showToast('☁️ 클라우드 백업 완료 (메타데이터)');
  } catch(e) { showToast('클라우드 백업 실패: ' + e.message); }
}

/* =====================
   MODAL HELPERS
   ===================== */
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* =====================
   FABRIC.JS EDITOR
   ===================== */
let canvas    = null;
let editImgId = null;
let editTool  = 'select';
let cropRect  = null;
let fabHistory = [];

function openEditor() {
  if (!modalImages.length) { showToast('사진을 먼저 추가하세요'); return; }
  const m = modalImages[modalSlide];
  editImgId = m.id;

  document.getElementById('modalAdd').classList.remove('open');
  document.getElementById('modalEdit').classList.add('open');

  // Init Fabric
  const wrapper = document.getElementById('canvasWrapper');
  const maxW = Math.min(wrapper.clientWidth - 24, 660);
  const maxH = Math.min(wrapper.clientHeight - 24, 500);

  if (!canvas) {
    canvas = new fabric.Canvas('editCanvas', { selection: true });
  } else {
    canvas.clear();
    canvas.setWidth(300);
    canvas.setHeight(300);
  }

  fabric.Image.fromURL(m.dataUrl, img => {
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    canvas.setWidth(Math.round(img.width * scale));
    canvas.setHeight(Math.round(img.height * scale));
    img.scaleToWidth(canvas.width);
    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
    fabHistory = [];
  }, { crossOrigin: 'anonymous' });

  setTool('select');
}

function setTool(tool) {
  editTool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool===tool));
  document.getElementById('cropControls').classList.add('hidden');
  document.getElementById('textInputRow').classList.add('hidden');
  if (!canvas) return;

  canvas.isDrawingMode = false;
  canvas.defaultCursor = 'default';

  switch (tool) {
    case 'select':
      canvas.isDrawingMode = false;
      break;
    case 'draw':
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.width = parseInt(document.getElementById('toolSize').value);
      canvas.freeDrawingBrush.color = document.getElementById('toolColor').value;
      break;
    case 'crop':
      document.getElementById('cropControls').classList.remove('hidden');
      startCropMode();
      break;
    case 'text':
      document.getElementById('textInputRow').classList.remove('hidden');
      break;
    case 'mosaic':
      canvas.defaultCursor = 'crosshair';
      break;
  }
}

function startCropMode() {
  if (cropRect) canvas.remove(cropRect);
  cropRect = new fabric.Rect({
    left: 30, top: 30,
    width: canvas.width - 60, height: canvas.height - 60,
    fill: 'rgba(0,0,0,0)',
    stroke: '#3F7CB8', strokeWidth: 2,
    strokeDashArray: [6,4],
    cornerColor: '#3F7CB8', cornerSize: 10,
    transparentCorners: false
  });
  canvas.add(cropRect);
  canvas.setActiveObject(cropRect);
  canvas.renderAll();
}

function applyCrop() {
  if (!cropRect) return;
  const scaleX = canvas.backgroundImage ? canvas.backgroundImage.scaleX : 1;
  const scaleY = canvas.backgroundImage ? canvas.backgroundImage.scaleY : 1;
  const origW  = canvas.backgroundImage ? canvas.backgroundImage.width  : canvas.width;
  const origH  = canvas.backgroundImage ? canvas.backgroundImage.height : canvas.height;

  // Ratio on canvas
  const rx = cropRect.left / canvas.width;
  const ry = cropRect.top  / canvas.height;
  const rw = (cropRect.width  * cropRect.scaleX) / canvas.width;
  const rh = (cropRect.height * cropRect.scaleY) / canvas.height;

  // Pixel on original
  const sx = rx * origW; const sy = ry * origH;
  const sw = rw * origW; const sh = rh * origH;

  // Export current canvas with annotations then crop
  const dataUrl = canvas.toDataURL({ format:'jpeg', quality:0.92 });
  cropImageDataUrl(dataUrl, rx, ry, rw, rh).then(cropped => {
    fabric.Image.fromURL(cropped, img => {
      canvas.setWidth(Math.round(sw * scaleX));
      canvas.setHeight(Math.round(sh * scaleY));
      img.scaleToWidth(canvas.width);
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
      canvas.remove(cropRect); cropRect = null;
      document.getElementById('cropControls').classList.add('hidden');
    });
  });
}

function addText() {
  const txt = document.getElementById('textInput').value;
  if (!txt) return;
  const t = new fabric.Text(txt, {
    left: 40, top: 40,
    fill: document.getElementById('toolColor').value,
    fontSize: parseInt(document.getElementById('toolSize').value) * 5 + 10,
    fontFamily: 'Arial'
  });
  canvas.add(t); canvas.setActiveObject(t); canvas.renderAll();
  document.getElementById('textInput').value = '';
}

function addShape(type) {
  const color = document.getElementById('toolColor').value;
  const size  = parseInt(document.getElementById('toolSize').value);
  let shape;
  if (type === 'rect') {
    shape = new fabric.Rect({ left:60, top:60, width:120, height:80, fill:'transparent', stroke:color, strokeWidth:size });
  } else {
    shape = new fabric.Ellipse({ left:60, top:60, rx:60, ry:40, fill:'transparent', stroke:color, strokeWidth:size });
  }
  canvas.add(shape); canvas.setActiveObject(shape); canvas.renderAll();
}

function addMosaic(e) {
  if (editTool !== 'mosaic') return;
  const pt = canvas.getPointer(e.e);
  const size = parseInt(document.getElementById('toolSize').value) * 8 + 16;
  // Create pixelated rectangle over that region
  const rect = new fabric.Rect({
    left: pt.x - size/2, top: pt.y - size/2,
    width: size, height: size,
    fill: '#aaa', opacity: 0.7, selectable: false
  });
  canvas.add(rect); canvas.renderAll();
}

function finishEdit() {
  if (!canvas) return;
  const dataUrl = canvas.toDataURL({ format:'jpeg', quality:0.92 });
  const idx = modalImages.findIndex(m => m.id === editImgId);
  if (idx >= 0) modalImages[idx].dataUrl = dataUrl;
  document.getElementById('modalEdit').classList.remove('open');
  document.getElementById('modalAdd').classList.add('open');
  renderModalSlides();
}

/* =====================
   CAMERA SCAN
   ===================== */
let stream = null; let facingMode = 'environment';

async function startCamera() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
    document.getElementById('scanVideo').srcObject = stream;
    switchView('scan');
  } catch(e) { showToast('카메라 접근 권한이 필요합니다'); }
}

function captureFrame() {
  const video = document.getElementById('scanVideo');
  const c = document.createElement('canvas');
  c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  const dataUrl = c.toDataURL('image/jpeg', 0.93);
  if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
  switchView('gallery');
  openAddModal([{ id: uid(), dataUrl }]);
}

/* =====================
   INIT & EVENT LISTENERS
   ===================== */
async function init() {
  await openIDB();
  loadData();
  renderFilterChips();
  renderGallery();

  // Header buttons
  document.getElementById('btnMenu').addEventListener('click', openSideMenu);
  document.getElementById('sideOverlay').addEventListener('click', closeSideMenu);
  document.getElementById('btnMenuClose').addEventListener('click', closeSideMenu);
  document.getElementById('btnSearch').addEventListener('click', () => document.getElementById('panelSearch').classList.add('open'));
  document.getElementById('btnBackup').addEventListener('click', firebaseBackupMeta);
  document.getElementById('btnSettings').addEventListener('click', () => document.getElementById('modalApiKey').classList.add('open'));

  // Side menu items
  document.querySelectorAll('.menu-item[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  document.getElementById('mnuApiKey').addEventListener('click', () => { closeSideMenu(); document.getElementById('modalApiKey').classList.add('open'); });
  document.getElementById('mnuBackupExport').addEventListener('click', () => { closeSideMenu(); exportBackup(); });
  document.getElementById('mnuBackupImport').addEventListener('click', () => { closeSideMenu(); document.getElementById('backupInput').click(); });

  // Add photo button
  document.getElementById('btnAddPhoto').addEventListener('click', () => document.getElementById('fileInput').click());

  // File inputs
  document.getElementById('fileInput').addEventListener('change', e => {
    if (e.target.files.length) { handleFiles(e.target.files); e.target.value = ''; }
  });
  document.getElementById('backupInput').addEventListener('change', e => {
    if (e.target.files[0]) { importBackup(e.target.files[0]); e.target.value = ''; }
  });

  // Gallery search
  document.getElementById('gallerySearch').addEventListener('input', e => {
    currentSearch = e.target.value; renderGallery();
  });

  // Add modal
  document.getElementById('btnModalAddClose').addEventListener('click', () => closeModal('modalAdd'));
  document.getElementById('btnSlidePrev').addEventListener('click', () => goSlide(-1));
  document.getElementById('btnSlideNext').addEventListener('click', () => goSlide(1));
  document.getElementById('btnAddMoreImg').addEventListener('click', () => {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'image/*,.heic'; fi.multiple = true;
    fi.onchange = e => { if(e.target.files.length) handleFiles(e.target.files, true); };
    fi.click();
  });
  document.getElementById('btnDelImg').addEventListener('click', () => {
    if (!modalImages.length) return;
    modalImages.splice(modalSlide, 1);
    modalSlide = Math.min(modalSlide, modalImages.length - 1);
    renderModalSlides();
  });
  document.getElementById('btnAiCrop').addEventListener('click', aiDocCrop);
  document.getElementById('btnSavePhoto').addEventListener('click', savePhoto);
  document.getElementById('btnEditPhoto').addEventListener('click', openEditor);

  // Edit modal
  document.getElementById('btnEditClose').addEventListener('click', () => {
    document.getElementById('modalEdit').classList.remove('open');
    document.getElementById('modalAdd').classList.add('open');
  });
  document.getElementById('btnEditDone').addEventListener('click', finishEdit);
  document.getElementById('btnEditUndo').addEventListener('click', () => {
    if (canvas) { canvas.undo && canvas.undo(); }
  });
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.tool === 'rect') addShape('rect');
      else if (b.dataset.tool === 'circle') addShape('circle');
      else setTool(b.dataset.tool);
    });
  });
  document.getElementById('toolColor').addEventListener('change', () => {
    if (canvas && canvas.isDrawingMode) canvas.freeDrawingBrush.color = document.getElementById('toolColor').value;
  });
  document.getElementById('toolSize').addEventListener('change', () => {
    if (canvas && canvas.isDrawingMode) canvas.freeDrawingBrush.width = parseInt(document.getElementById('toolSize').value);
  });
  document.getElementById('btnDelObj').addEventListener('click', () => {
    if (canvas) { const o = canvas.getActiveObject(); if(o) { canvas.remove(o); canvas.renderAll(); } }
  });
  document.getElementById('btnApplyCrop').addEventListener('click', applyCrop);
  document.getElementById('btnCancelCrop').addEventListener('click', () => {
    if (cropRect) canvas.remove(cropRect); cropRect = null;
    document.getElementById('cropControls').classList.add('hidden');
    setTool('select');
  });
  document.getElementById('btnAddText').addEventListener('click', addText);
  document.getElementById('textInput').addEventListener('keydown', e => { if(e.key==='Enter') addText(); });

  // Mosaic click on canvas
  document.getElementById('editCanvas').parentElement.addEventListener('mousedown', e => {
    if (editTool === 'mosaic' && canvas) addMosaic({ e });
  });

  // View modal
  document.getElementById('btnViewClose').addEventListener('click', () => closeModal('modalView'));
  document.getElementById('btnViewPrev').addEventListener('click', () => viewNavSlide(-1));
  document.getElementById('btnViewNext').addEventListener('click', () => viewNavSlide(1));
  document.getElementById('btnViewEdit').addEventListener('click', () => {
    closeModal('modalView'); openEditMetaModal(viewPhotoId);
  });
  document.getElementById('btnViewDelete').addEventListener('click', () => deletePhoto(viewPhotoId));

  // AI Search panel
  document.getElementById('btnSearchClose').addEventListener('click', () => document.getElementById('panelSearch').classList.remove('open'));
  document.getElementById('btnAiSearch').addEventListener('click', aiSearch);

  // API Key modal
  document.getElementById('btnApiKeyClose').addEventListener('click', () => closeModal('modalApiKey'));
  document.getElementById('apiKeyInput').value = localStorage.getItem(LS_API_KEY) || '';
  document.getElementById('btnSaveApiKey').addEventListener('click', () => {
    const k = document.getElementById('apiKeyInput').value.trim();
    localStorage.setItem(LS_API_KEY, k); apiKey = k;
    closeModal('modalApiKey'); showToast('API 키가 저장되었습니다');
  });

  // Category management
  document.getElementById('btnCatAdd').addEventListener('click', () => {
    const name = document.getElementById('catNewName').value.trim();
    if (!name) return;
    if (categories.includes(name)) { showToast('이미 있는 카테고리입니다'); return; }
    categories.push(name); saveCategories();
    document.getElementById('catNewName').value = '';
    renderCatList(); renderFilterChips();
    showToast(`"${name}" 카테고리가 추가되었습니다`);
  });

  // Camera scan
  document.getElementById('btnCapture').addEventListener('click', captureFrame);
  document.getElementById('btnSwitchCam').addEventListener('click', () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment'; startCamera();
  });
  document.getElementById('btnScanClose').addEventListener('click', () => {
    if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
    switchView('gallery');
  });

  // ESC close modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('modalAdd'); closeModal('modalEdit'); closeModal('modalView');
      closeModal('modalApiKey');
      document.getElementById('panelSearch').classList.remove('open');
    }
  });

  // Drag & Drop 파일 업로드
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/') || f.name.endsWith('.heic'));
    if (files.length) handleFiles(files);
  });
}

document.addEventListener('DOMContentLoaded', init);
