/* ============================================================
   links-recipes.js  v1.0-20260615
   변경내역: 최초 작성
   링크/레시피 저장 + AI검색 + 달력(확대축소/제목표시) + 백업
   Firebase: Firestore REST API
   ============================================================ */

// ===== CONFIG =====
const FB_PROJECT = 'my-system-25497';
const FB_API_KEY = 'AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY';
const FB_BASE = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;

// ===== STATE =====
let links = [];
let recipes = [];
let linkCats = ['자재','타일','전기','기계','조명'];
let recipeCats = ['한식','양식','일식','중식','디저트'];
let calZoom = 'md';
let calYear, calMonth;
let editingLinkId = null;
let editingRecipeId = null;
let lmImages = []; // base64 images for link modal
let rmImages = []; // base64 images for recipe modal
let customFieldTarget = null; // 'link' | 'recipe'
let lmCustomFields = [];
let rmCustomFields = [];
let backupTimer = null;
let currentDetailId = null;
let currentDetailType = null;

// ===== FIRESTORE HELPERS =====
function toFS(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) { fields[k] = {nullValue: null}; continue; }
    if (typeof v === 'boolean') fields[k] = {booleanValue: v};
    else if (typeof v === 'number') fields[k] = {doubleValue: v};
    else if (typeof v === 'string') fields[k] = {stringValue: v};
    else if (Array.isArray(v)) fields[k] = {stringValue: JSON.stringify(v)};
    else if (typeof v === 'object') fields[k] = {stringValue: JSON.stringify(v)};
  }
  return {fields};
}
function fromFS(doc) {
  const obj = {id: doc.name.split('/').pop()};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    if (v.stringValue !== undefined) {
      const s = v.stringValue;
      if ((s.startsWith('[') || s.startsWith('{')) && k !== 'url' && k !== 'link' && k !== 'refLink') {
        try { obj[k] = JSON.parse(s); } catch { obj[k] = s; }
      } else obj[k] = s;
    }
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.doubleValue !== undefined) obj[k] = v.doubleValue;
    else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue);
    else if (v.nullValue !== undefined) obj[k] = null;
  }
  return obj;
}
async function fsGet(col) {
  try {
    const r = await fetch(`${FB_BASE}/${col}?key=${FB_API_KEY}&pageSize=300`);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.documents || []).map(fromFS);
  } catch { return []; }
}
async function fsSet(col, id, data) {
  const url = `${FB_BASE}/${col}/${id}?key=${FB_API_KEY}`;
  const r = await fetch(url, {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(toFS(data))});
  return r.ok;
}
async function fsDelete(col, id) {
  const r = await fetch(`${FB_BASE}/${col}/${id}?key=${FB_API_KEY}`, {method:'DELETE'});
  return r.ok;
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  loadLocal();
  setupTabs();
  setupTheme();
  setupCalendar();
  setupLinkModal();
  setupRecipeModal();
  setupDetailModal();
  setupShopModal();
  setupCustomFieldModal();
  setupSettings();
  setupAI();
  await loadData();
  renderLinkList();
  renderRecipeList();
  renderCalendar();
  renderSettings();
  scheduleAutoBackup();
});

// ===== LOCAL STORAGE =====
function loadLocal() {
  const lc = localStorage.getItem('lr_linkCats');
  const rc = localStorage.getItem('lr_recipeCats');
  if (lc) try { linkCats = JSON.parse(lc); } catch {}
  if (rc) try { recipeCats = JSON.parse(rc); } catch {}
}
function saveLocalCats() {
  localStorage.setItem('lr_linkCats', JSON.stringify(linkCats));
  localStorage.setItem('lr_recipeCats', JSON.stringify(recipeCats));
}

// ===== TABS =====
function setupTabs() {
  document.querySelectorAll('.btab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.btab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById('tab-' + tab).classList.add('active');
      if (tab === 'cal') renderCalendar();
      if (tab === 'settings') renderSettings();
    });
  });
}

// ===== THEME =====
function setupTheme() {
  const dm = localStorage.getItem('lr_dark') === '1';
  if (dm) document.body.classList.add('dark');
  const tog = document.getElementById('darkModeToggle');
  const hdrTog = document.getElementById('darkToggle');
  if (tog) { tog.checked = dm; tog.addEventListener('change', toggleDark); }
  if (hdrTog) hdrTog.addEventListener('click', toggleDark);
}
function toggleDark() {
  document.body.classList.toggle('dark');
  const d = document.body.classList.contains('dark') ? '1' : '0';
  localStorage.setItem('lr_dark', d);
  const tog = document.getElementById('darkModeToggle');
  if (tog) tog.checked = d === '1';
}

// ===== LOAD DATA =====
async function loadData() {
  const [l, r] = await Promise.all([fsGet('lr_links'), fsGet('lr_recipes')]);
  links = l;
  recipes = r;
}

// ===== PLATFORM DETECT =====
function getPlatform(url) {
  if (!url) return 'etc';
  if (url.includes('instagram.com')) return 'insta';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'yt';
  return 'etc';
}
function platformEmoji(p) { return p==='insta'?'🟣':p==='yt'?'🔴':'🔗'; }
function platformClass(p) { return p==='insta'?'badge-insta':p==='yt'?'badge-yt':'badge-etc'; }

// ===== TAG COLORS =====
const TAG_COLORS = ['tag-pk','tag-mn','tag-lv','tag-yw','tag-bl'];
function tagColor(i) { return TAG_COLORS[i % TAG_COLORS.length]; }

// ===== LINK LIST =====
let linkCatFilter = 'all';
let linkSortMode = 'newest';
document.addEventListener('DOMContentLoaded', () => {
  const ls = document.getElementById('linkSort');
  if (ls) ls.addEventListener('change', () => { linkSortMode = ls.value; renderLinkList(); });
  const lsearch = document.getElementById('linkSearch');
  if (lsearch) lsearch.addEventListener('input', renderLinkList);
});

function renderLinkCatChips() {
  const wrap = document.getElementById('linkCatChips');
  if (!wrap) return;
  wrap.innerHTML = '';
  const all = document.createElement('div');
  all.className = 'chip chip-all' + (linkCatFilter==='all'?' active':'');
  all.textContent = '전체';
  all.onclick = () => { linkCatFilter='all'; renderLinkCatChips(); renderLinkList(); };
  wrap.appendChild(all);
  linkCats.forEach(cat => {
    const c = document.createElement('div');
    c.className = 'chip chip-item' + (linkCatFilter===cat?' active':'');
    c.textContent = cat;
    c.onclick = () => { linkCatFilter=cat; renderLinkCatChips(); renderLinkList(); };
    wrap.appendChild(c);
  });
  const add = document.createElement('div');
  add.className = 'chip chip-add';
  add.textContent = '＋ 추가';
  add.onclick = () => {
    const n = prompt('새 카테고리 이름');
    if (n && !linkCats.includes(n)) { linkCats.push(n); saveLocalCats(); renderLinkCatChips(); renderLinkCatSelect(); }
  };
  wrap.appendChild(add);
}

function sortedLinks() {
  let arr = [...links];
  const q = (document.getElementById('linkSearch')?.value || '').toLowerCase();
  if (q) arr = arr.filter(l => (l.title||'').toLowerCase().includes(q) || (l.url||'').toLowerCase().includes(q) || (l.memo||'').toLowerCase().includes(q) || (l.cat||'').toLowerCase().includes(q));
  if (linkCatFilter !== 'all') arr = arr.filter(l => l.cat === linkCatFilter);
  if (linkSortMode === 'newest') arr.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  else if (linkSortMode === 'oldest') arr.sort((a,b) => (a.createdAt||0) - (b.createdAt||0));
  else if (linkSortMode === 'name') arr.sort((a,b) => (a.title||'').localeCompare(b.title||''));
  else if (linkSortMode === 'fav') arr.sort((a,b) => (b.fav?1:0)-(a.fav?1:0));
  return arr;
}

function renderLinkList() {
  renderLinkCatChips();
  const list = document.getElementById('linkList');
  const arr = sortedLinks();
  document.getElementById('linkCount').textContent = arr.length + '개';
  if (!arr.length) { list.innerHTML = '<div class="empty-state"><div class="empty-emoji">🔗</div><div class="empty-text">저장된 링크가 없어요<br>＋ 버튼으로 추가해보세요</div></div>'; return; }
  list.innerHTML = arr.map(l => {
    const plat = getPlatform(l.url);
    const imgs = Array.isArray(l.images) ? l.images : [];
    const customs = Array.isArray(l.customFields) ? l.customFields : [];
    const customHtml = customs.length ? `<div class="card-custom">${customs.map(cf=>`<div class="custom-row"><span class="custom-label">${esc(cf.name)}</span><span class="custom-val">${esc(String(cf.value||''))}</span></div>`).join('')}</div>` : '';
    const imgHtml = imgs.length ? `<img class="card-img" src="${imgs[0]}" alt="">` : '';
    const remindHtml = l.remind ? `<span class="remind-badge">📅 ${l.remind}</span>` : '';
    const catIdx = linkCats.indexOf(l.cat);
    const catHtml = l.cat ? `<span class="tag ${tagColor(catIdx>=0?catIdx:0)}">${esc(l.cat)}</span>` : '';
    return `<div class="item-card" onclick="openDetailLink('${l.id}')">
      <div class="card-top">
        <div class="platform-badge ${platformClass(plat)}">${platformEmoji(plat)}</div>
        <div class="card-info">
          <div class="card-title">${esc(l.title||'제목 없음')}</div>
          <div class="card-url ${l.urlOk===false?'url-invalid':''}">${esc((l.url||'').slice(0,50))}</div>
        </div>
        <span class="card-fav" onclick="toggleLinkFav(event,'${l.id}')">${l.fav?'⭐':'☆'}</span>
      </div>
      <div class="card-meta">${catHtml}${remindHtml}<span class="card-date">${formatDate(l.createdAt)}</span></div>
      ${l.memo?`<div class="card-memo">${esc(l.memo)}</div>`:''}
      ${imgHtml}${customHtml}
      <div class="card-actions">
        <button class="card-edit-btn" onclick="event.stopPropagation();openLinkModal('${l.id}')">✏️ 수정</button>
        <button class="card-del-btn" onclick="event.stopPropagation();quickDeleteLink('${l.id}')">🗑️ 삭제</button>
      </div>
    </div>`;
  }).join('');
}

async function toggleLinkFav(e, id) {
  e.stopPropagation();
  const l = links.find(x=>x.id===id);
  if (!l) return;
  l.fav = !l.fav;
  await fsSet('lr_links', id, l);
  renderLinkList();
}

// ===== RECIPE LIST =====
let recipeCatFilter = 'all';
let recipeSortMode = 'newest';
document.addEventListener('DOMContentLoaded', () => {
  const rs = document.getElementById('recipeSort');
  if (rs) rs.addEventListener('change', () => { recipeSortMode = rs.value; renderRecipeList(); });
  const rsearch = document.getElementById('recipeSearch');
  if (rsearch) rsearch.addEventListener('input', renderRecipeList);
});

function renderRecipeCatChips() {
  const wrap = document.getElementById('recipeCatChips');
  if (!wrap) return;
  wrap.innerHTML = '';
  const all = document.createElement('div');
  all.className = 'chip chip-all-mint' + (recipeCatFilter==='all'?' chip-all':'');
  all.style.background = recipeCatFilter==='all' ? 'var(--mn3)' : 'var(--bg2)';
  all.style.color = recipeCatFilter==='all' ? '#fff' : 'var(--txt2)';
  all.style.borderColor = recipeCatFilter==='all' ? 'var(--mn3)' : 'var(--border)';
  all.textContent = '전체';
  all.onclick = () => { recipeCatFilter='all'; renderRecipeCatChips(); renderRecipeList(); };
  wrap.appendChild(all);
  recipeCats.forEach(cat => {
    const c = document.createElement('div');
    c.className = 'chip chip-item-mint' + (recipeCatFilter===cat?' active':'');
    c.style.background = recipeCatFilter===cat ? 'var(--mn)' : 'var(--bg2)';
    c.style.color = recipeCatFilter===cat ? 'var(--mn3)' : 'var(--txt2)';
    c.style.borderColor = recipeCatFilter===cat ? 'var(--mn2)' : 'var(--border)';
    c.textContent = cat;
    c.onclick = () => { recipeCatFilter=cat; renderRecipeCatChips(); renderRecipeList(); };
    wrap.appendChild(c);
  });
  const add = document.createElement('div');
  add.className = 'chip chip-add';
  add.textContent = '＋ 추가';
  add.onclick = () => {
    const n = prompt('새 카테고리 이름');
    if (n && !recipeCats.includes(n)) { recipeCats.push(n); saveLocalCats(); renderRecipeCatChips(); renderRecipeCatSelect(); }
  };
  wrap.appendChild(add);
}

function sortedRecipes() {
  let arr = [...recipes];
  const q = (document.getElementById('recipeSearch')?.value || '').toLowerCase();
  if (q) arr = arr.filter(r => (r.title||'').toLowerCase().includes(q) || (r.cat||'').toLowerCase().includes(q) || (r.tags||'').toLowerCase().includes(q));
  if (recipeCatFilter !== 'all') arr = arr.filter(r => r.cat === recipeCatFilter);
  if (recipeSortMode === 'newest') arr.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  else if (recipeSortMode === 'oldest') arr.sort((a,b) => (a.createdAt||0) - (b.createdAt||0));
  else if (recipeSortMode === 'name') arr.sort((a,b) => (a.title||'').localeCompare(b.title||''));
  else if (recipeSortMode === 'fav') arr.sort((a,b) => (b.fav?1:0)-(a.fav?1:0));
  return arr;
}

function renderRecipeList() {
  renderRecipeCatChips();
  const list = document.getElementById('recipeList');
  const arr = sortedRecipes();
  document.getElementById('recipeCount').textContent = arr.length + '개';
  if (!arr.length) { list.innerHTML = '<div class="empty-state"><div class="empty-emoji">🍳</div><div class="empty-text">저장된 레시피가 없어요<br>＋ 버튼으로 추가해보세요</div></div>'; return; }
  list.innerHTML = arr.map(r => {
    const ingrs = Array.isArray(r.ingredients) ? r.ingredients : [];
    const steps = Array.isArray(r.steps) ? r.steps : [];
    const imgs = Array.isArray(r.images) ? r.images : [];
    const tags = r.tags ? r.tags.split(',').map(t=>t.trim()).filter(Boolean) : [];
    const customs = Array.isArray(r.customFields) ? r.customFields : [];
    const catIdx = recipeCats.indexOf(r.cat);
    const catHtml = r.cat ? `<span class="tag tag-mn">${esc(r.cat)}</span>` : '';
    const tagHtml = tags.map((t,i) => `<span class="tag ${tagColor(i+1)}">${esc(t)}</span>`).join('');
    const ingrHtml = ingrs.length ? `<div class="ingr-chips">${ingrs.slice(0,4).map(ig=>`<span class="ingr-chip">${esc(ig.name)}${ig.amount?' '+esc(ig.amount):''}</span>`).join('')}${ingrs.length>4?`<span class="ingr-chip">+${ingrs.length-4}개</span>`:''}</div>` : '';
    const stepHtml = steps.length ? `<div class="step-preview">${steps.slice(0,3).map((s,i)=>`<span class="step-dot">${i+1}</span>${esc((s.text||'').slice(0,15))} `).join('')}</div>` : '';
    const imgHtml = imgs.length ? `<img class="card-img" src="${imgs[0]}" alt="">` : '';
    const customHtml = customs.length ? `<div class="card-custom">${customs.map(cf=>`<div class="custom-row"><span class="custom-label custom-label-mn">${esc(cf.name)}</span><span class="custom-val">${esc(String(cf.value||''))}</span></div>`).join('')}</div>` : '';
    const meta2 = [r.serving, r.time, r.calorie, r.difficulty].filter(Boolean).map(m=>`<span style="font-size:11px;color:var(--txt2)">${esc(m)}</span>`).join(' · ');
    return `<div class="item-card recipe-card" onclick="openDetailRecipe('${r.id}')">
      <div class="card-top">
        <div class="platform-badge badge-recipe">🍳</div>
        <div class="card-info">
          <div class="card-title">${esc(r.title||'제목 없음')}</div>
          ${meta2 ? `<div style="margin-top:2px">${meta2}</div>` : ''}
        </div>
        <span class="card-fav" onclick="toggleRecipeFav(event,'${r.id}')">${r.fav?'⭐':'☆'}</span>
      </div>
      <div class="card-meta">${catHtml}${tagHtml}<span class="card-date">${formatDate(r.createdAt)}</span></div>
      ${ingrHtml}${stepHtml}${imgHtml}${customHtml}
      <div class="card-actions">
        <button class="card-edit-btn card-edit-btn-mn" onclick="event.stopPropagation();openRecipeModal('${r.id}')">✏️ 수정</button>
        <button class="card-del-btn" onclick="event.stopPropagation();quickDeleteRecipe('${r.id}')">🗑️ 삭제</button>
      </div>
    </div>`;
  }).join('');
}

async function toggleRecipeFav(e, id) {
  e.stopPropagation();
  const r = recipes.find(x=>x.id===id);
  if (!r) return;
  r.fav = !r.fav;
  await fsSet('lr_recipes', id, r);
  renderRecipeList();
}

// ===== QUICK DELETE =====
async function quickDeleteLink(id) {
  if (!confirm('이 링크를 삭제할까요?')) return;
  await fsDelete('lr_links', id);
  links = links.filter(x=>x.id!==id);
  renderLinkList(); renderCalendar(); toast('삭제 완료');
}
async function quickDeleteRecipe(id) {
  if (!confirm('이 레시피를 삭제할까요?')) return;
  await fsDelete('lr_recipes', id);
  recipes = recipes.filter(x=>x.id!==id);
  renderRecipeList(); renderCalendar(); toast('삭제 완료');
}

// ===== LINK MODAL =====
function setupLinkModal() {
  document.getElementById('addLinkBtn').onclick = () => openLinkModal();
  document.getElementById('linkModalClose').onclick = () => closeLinkModal();
  document.getElementById('lmSave').onclick = saveLinkModal;
  document.getElementById('lmImgCam').onclick = () => document.getElementById('lmImgFile').click();
  document.getElementById('lmImgFile').onchange = (e) => { if(e.target.files[0]) addImageFromFile(e.target.files[0], 'link'); };
  document.getElementById('lmImgPaste').onclick = () => pasteImage('link');
  document.getElementById('lmAddCustom').onclick = () => { customFieldTarget='link'; openCustomFieldModal(); };
  document.getElementById('linkModal').onclick = (e) => { if(e.target===document.getElementById('linkModal')) closeLinkModal(); };
  document.addEventListener('paste', (e) => {
    if (!document.getElementById('linkModal').classList.contains('open')) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) { item.getAsFile() && addImageFromFile(item.getAsFile(), 'link'); break; }
    }
  });
}
function openLinkModal(id=null) {
  editingLinkId = id;
  lmImages = [];
  lmCustomFields = [];
  const modal = document.getElementById('linkModal');
  const title = document.getElementById('linkModalTitle');
  title.textContent = id ? '🔗 링크 수정' : '🔗 링크 추가';
  renderLinkCatSelect();
  if (id) {
    const l = links.find(x=>x.id===id);
    if (l) {
      document.getElementById('lmUrl').value = l.url||'';
      document.getElementById('lmTitle').value = l.title||'';
      document.getElementById('lmCat').value = l.cat||'';
      document.getElementById('lmMemo').value = l.memo||'';
      document.getElementById('lmRemind').value = l.remind||'';
      document.getElementById('lmFav').checked = l.fav||false;
      lmImages = Array.isArray(l.images) ? [...l.images] : [];
      lmCustomFields = Array.isArray(l.customFields) ? JSON.parse(JSON.stringify(l.customFields)) : [];
    }
  } else {
    document.getElementById('lmUrl').value='';
    document.getElementById('lmTitle').value='';
    document.getElementById('lmCat').value='';
    document.getElementById('lmMemo').value='';
    document.getElementById('lmRemind').value='';
    document.getElementById('lmFav').checked=false;
  }
  renderLmImgPreview();
  renderLmCustomFields();
  modal.classList.add('open');
}
function closeLinkModal() { document.getElementById('linkModal').classList.remove('open'); }
function renderLinkCatSelect() {
  const sel = document.getElementById('lmCat');
  sel.innerHTML = '<option value="">카테고리 선택</option>' + linkCats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
}
function renderLmImgPreview() {
  const wrap = document.getElementById('lmImgPreview');
  wrap.innerHTML = lmImages.map((img,i) => `<div class="img-preview-item"><img src="${img}" alt=""><button class="img-del-btn" onclick="lmDelImg(${i})">✕</button></div>`).join('');
}
window.lmDelImg = (i) => { lmImages.splice(i,1); renderLmImgPreview(); };
function renderLmCustomFields() {
  const wrap = document.getElementById('lmCustomFields');
  wrap.innerHTML = lmCustomFields.map((cf,i) => `
    <div class="custom-field-row">
      <input type="text" value="${esc(cf.name)}" placeholder="필드명" oninput="lmCustomFields[${i}].name=this.value">
      ${cf.type==='checkbox'
        ? `<input type="checkbox" ${cf.value?'checked':''} onchange="lmCustomFields[${i}].value=this.checked" style="width:24px;height:24px;flex:0">`
        : `<input type="${cf.type||'text'}" value="${esc(String(cf.value||''))}" placeholder="값" oninput="lmCustomFields[${i}].value=this.value">`}
      <button class="custom-field-del" onclick="lmDelCustom(${i})">✕</button>
    </div>`).join('');
}
window.lmDelCustom = (i) => { lmCustomFields.splice(i,1); renderLmCustomFields(); };

async function saveLinkModal() {
  const url = document.getElementById('lmUrl').value.trim();
  const title = document.getElementById('lmTitle').value.trim();
  if (!url) { toast('URL을 입력해주세요'); return; }
  const id = editingLinkId || genId();
  const existing = editingLinkId ? links.find(x=>x.id===editingLinkId) : null;
  const data = {
    url, title: title||url,
    cat: document.getElementById('lmCat').value,
    memo: document.getElementById('lmMemo').value.trim(),
    remind: document.getElementById('lmRemind').value,
    fav: document.getElementById('lmFav').checked,
    images: lmImages,
    customFields: lmCustomFields,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  const ok = await fsSet('lr_links', id, data);
  if (!ok) { toast('저장 실패. 네트워크 확인'); return; }
  if (editingLinkId) { const idx = links.findIndex(x=>x.id===editingLinkId); if(idx>=0) links[idx]={id,...data}; }
  else links.unshift({id,...data});
  closeLinkModal();
  renderLinkList();
  renderCalendar();
  toast('링크 저장 완료 ✓');
}

// ===== RECIPE MODAL =====
function setupRecipeModal() {
  document.getElementById('addRecipeBtn').onclick = () => openRecipeModal();
  document.getElementById('recipeModalClose').onclick = () => closeRecipeModal();
  document.getElementById('rmSave').onclick = saveRecipeModal;
  document.getElementById('rmAddIngr').onclick = addIngrRow;
  document.getElementById('rmAddStep').onclick = addStepRow;
  document.getElementById('rmImgCam').onclick = () => document.getElementById('rmImgFile').click();
  document.getElementById('rmImgFile').onchange = (e) => { if(e.target.files[0]) addImageFromFile(e.target.files[0], 'recipe'); };
  document.getElementById('rmImgPaste').onclick = () => pasteImage('recipe');
  document.getElementById('rmAddCustom').onclick = () => { customFieldTarget='recipe'; openCustomFieldModal(); };
  document.getElementById('recipeModal').onclick = (e) => { if(e.target===document.getElementById('recipeModal')) closeRecipeModal(); };
  document.addEventListener('paste', (e) => {
    if (!document.getElementById('recipeModal').classList.contains('open')) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) { item.getAsFile() && addImageFromFile(item.getAsFile(), 'recipe'); break; }
    }
  });
}
let ingrRows = [];
let stepRows = [];

function openRecipeModal(id=null) {
  editingRecipeId = id;
  rmImages = [];
  rmCustomFields = [];
  ingrRows = [];
  stepRows = [];
  const modal = document.getElementById('recipeModal');
  document.getElementById('recipeModalTitle').textContent = id ? '🍳 레시피 수정' : '🍳 레시피 추가';
  renderRecipeCatSelect();
  if (id) {
    const r = recipes.find(x=>x.id===id);
    if (r) {
      document.getElementById('rmTitle').value = r.title||'';
      document.getElementById('rmLink').value = r.refLink||'';
      document.getElementById('rmCat').value = r.cat||'';
      document.getElementById('rmServing').value = r.serving||'';
      document.getElementById('rmTime').value = r.time||'';
      document.getElementById('rmCalorie').value = r.calorie||'';
      document.getElementById('rmDifficulty').value = r.difficulty||'';
      document.getElementById('rmTags').value = r.tags||'';
      document.getElementById('rmMemo').value = r.memo||'';
      document.getElementById('rmFav').checked = r.fav||false;
      rmImages = Array.isArray(r.images) ? [...r.images] : [];
      rmCustomFields = Array.isArray(r.customFields) ? JSON.parse(JSON.stringify(r.customFields)) : [];
      ingrRows = Array.isArray(r.ingredients) ? JSON.parse(JSON.stringify(r.ingredients)) : [];
      stepRows = Array.isArray(r.steps) ? JSON.parse(JSON.stringify(r.steps)) : [];
    }
  } else {
    ['rmTitle','rmLink','rmServing','rmTime','rmCalorie','rmTags','rmMemo'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('rmCat').value='';
    document.getElementById('rmDifficulty').value='';
    document.getElementById('rmFav').checked=false;
  }
  renderRmIngredients();
  renderRmSteps();
  renderRmImgPreview();
  renderRmCustomFields();
  modal.classList.add('open');
}
function closeRecipeModal() { document.getElementById('recipeModal').classList.remove('open'); }
function renderRecipeCatSelect() {
  const sel = document.getElementById('rmCat');
  sel.innerHTML = '<option value="">카테고리 선택</option>' + recipeCats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
}
function addIngrRow() { ingrRows.push({name:'',amount:'',buyLink:''}); renderRmIngredients(); }
function renderRmIngredients() {
  const wrap = document.getElementById('rmIngredients');
  if (!ingrRows.length) { wrap.innerHTML=''; return; }
  wrap.innerHTML = ingrRows.map((ig,i)=>`
    <div class="ingr-row">
      <input class="ingr-name" type="text" placeholder="재료명" value="${esc(ig.name||'')}" oninput="ingrRows[${i}].name=this.value">
      <input class="ingr-amount" type="text" placeholder="양" value="${esc(ig.amount||'')}" oninput="ingrRows[${i}].amount=this.value">
      <input class="ingr-link" type="url" placeholder="구매 링크 (선택)" value="${esc(ig.buyLink||'')}" oninput="ingrRows[${i}].buyLink=this.value">
      <button class="ingr-del" onclick="delIngrRow(${i})">✕</button>
    </div>`).join('');
}
window.delIngrRow = (i) => { ingrRows.splice(i,1); renderRmIngredients(); };

function addStepRow() { stepRows.push({text:''}); renderRmSteps(); }
function renderRmSteps() {
  const wrap = document.getElementById('rmSteps');
  if (!stepRows.length) { wrap.innerHTML=''; return; }
  wrap.innerHTML = stepRows.map((s,i)=>`
    <div class="step-row">
      <div class="step-num">${i+1}</div>
      <textarea placeholder="단계 ${i+1} 내용" oninput="stepRows[${i}].text=this.value">${esc(s.text||'')}</textarea>
      <button class="step-del" onclick="delStepRow(${i})">✕</button>
    </div>`).join('');
}
window.delStepRow = (i) => { stepRows.splice(i,1); renderRmSteps(); };

function renderRmImgPreview() {
  const wrap = document.getElementById('rmImgPreview');
  wrap.innerHTML = rmImages.map((img,i) => `<div class="img-preview-item"><img src="${img}" alt=""><button class="img-del-btn" onclick="rmDelImg(${i})">✕</button></div>`).join('');
}
window.rmDelImg = (i) => { rmImages.splice(i,1); renderRmImgPreview(); };
function renderRmCustomFields() {
  const wrap = document.getElementById('rmCustomFields');
  wrap.innerHTML = rmCustomFields.map((cf,i) => `
    <div class="custom-field-row">
      <input type="text" value="${esc(cf.name)}" placeholder="필드명" oninput="rmCustomFields[${i}].name=this.value">
      ${cf.type==='checkbox'
        ? `<input type="checkbox" ${cf.value?'checked':''} onchange="rmCustomFields[${i}].value=this.checked" style="width:24px;height:24px;flex:0">`
        : `<input type="${cf.type||'text'}" value="${esc(String(cf.value||''))}" placeholder="값" oninput="rmCustomFields[${i}].value=this.value">`}
      <button class="custom-field-del" onclick="rmDelCustom(${i})">✕</button>
    </div>`).join('');
}
window.rmDelCustom = (i) => { rmCustomFields.splice(i,1); renderRmCustomFields(); };

async function saveRecipeModal() {
  const title = document.getElementById('rmTitle').value.trim();
  if (!title) { toast('제목을 입력해주세요'); return; }
  const id = editingRecipeId || genId();
  const existing = editingRecipeId ? recipes.find(x=>x.id===editingRecipeId) : null;
  const data = {
    title,
    refLink: document.getElementById('rmLink').value.trim(),
    cat: document.getElementById('rmCat').value,
    serving: document.getElementById('rmServing').value.trim(),
    time: document.getElementById('rmTime').value.trim(),
    calorie: document.getElementById('rmCalorie').value.trim(),
    difficulty: document.getElementById('rmDifficulty').value,
    tags: document.getElementById('rmTags').value.trim(),
    memo: document.getElementById('rmMemo').value.trim(),
    fav: document.getElementById('rmFav').checked,
    images: rmImages,
    ingredients: ingrRows.filter(r=>r.name),
    steps: stepRows.filter(s=>s.text),
    customFields: rmCustomFields,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  const ok = await fsSet('lr_recipes', id, data);
  if (!ok) { toast('저장 실패. 네트워크 확인'); return; }
  if (editingRecipeId) { const idx = recipes.findIndex(x=>x.id===editingRecipeId); if(idx>=0) recipes[idx]={id,...data}; }
  else recipes.unshift({id,...data});
  closeRecipeModal();
  renderRecipeList();
  renderCalendar();
  toast('레시피 저장 완료 ✓');
}

// ===== IMAGE HELPERS =====
function addImageFromFile(file, target) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const b64 = e.target.result;
    if (target==='link') { lmImages.push(b64); renderLmImgPreview(); }
    else { rmImages.push(b64); renderRmImgPreview(); }
  };
  reader.readAsDataURL(file);
}
async function pasteImage(target) {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          addImageFromFile(blob, target);
          return;
        }
      }
    }
    toast('클립보드에 이미지가 없어요');
  } catch { toast('Ctrl+V로 붙여넣기 해주세요'); }
}

// ===== CUSTOM FIELD MODAL =====
function setupCustomFieldModal() {
  document.getElementById('cfClose').onclick = () => document.getElementById('customFieldModal').classList.remove('open');
  document.getElementById('cfSave').onclick = () => {
    const name = document.getElementById('cfName').value.trim();
    const type = document.getElementById('cfType').value;
    if (!name) { toast('필드 이름을 입력해주세요'); return; }
    const cf = {name, type, value: type==='checkbox'?false:''};
    if (customFieldTarget==='link') { lmCustomFields.push(cf); renderLmCustomFields(); }
    else { rmCustomFields.push(cf); renderRmCustomFields(); }
    document.getElementById('cfName').value='';
    document.getElementById('customFieldModal').classList.remove('open');
  };
  document.getElementById('customFieldModal').onclick = (e) => { if(e.target===document.getElementById('customFieldModal')) document.getElementById('customFieldModal').classList.remove('open'); };
}
function openCustomFieldModal() {
  document.getElementById('cfName').value='';
  document.getElementById('cfType').value='text';
  document.getElementById('customFieldModal').classList.add('open');
}

// ===== DETAIL MODAL =====
function setupDetailModal() {
  document.getElementById('detailClose').onclick = () => document.getElementById('detailModal').classList.remove('open');
  document.getElementById('detailEdit').onclick = () => {
    document.getElementById('detailModal').classList.remove('open');
    if (currentDetailType==='link') openLinkModal(currentDetailId);
    else openRecipeModal(currentDetailId);
  };
  document.getElementById('detailShare').onclick = shareDetail;
  document.getElementById('detailDelete').onclick = deleteDetail;
  document.getElementById('detailModal').onclick = (e) => { if(e.target===document.getElementById('detailModal')) document.getElementById('detailModal').classList.remove('open'); };
}

window.openDetailLink = (id) => {
  const l = links.find(x=>x.id===id);
  if (!l) return;
  currentDetailId = id;
  currentDetailType = 'link';
  const plat = getPlatform(l.url);
  const imgs = Array.isArray(l.images) ? l.images : [];
  const customs = Array.isArray(l.customFields) ? l.customFields : [];
  document.getElementById('detailTitle').textContent = platformEmoji(plat) + ' ' + (l.title||'링크');
  const body = document.getElementById('detailBody');
  body.innerHTML = `
    ${imgs.map(img=>`<img class="detail-img" src="${img}" alt="">`).join('')}
    <div class="detail-section">
      <div class="detail-section-title">URL</div>
      <a href="${esc(l.url)}" target="_blank" style="color:var(--bl3);font-size:14px;word-break:break-all">${esc(l.url)}</a>
    </div>
    ${l.cat?`<div class="detail-section"><div class="detail-section-title">카테고리</div><span class="tag tag-pk">${esc(l.cat)}</span></div>`:''}
    ${l.memo?`<div class="detail-section"><div class="detail-section-title">메모</div><div style="font-size:13px;color:var(--txt);line-height:1.6">${esc(l.memo)}</div></div>`:''}
    ${l.remind?`<div class="detail-section"><div class="detail-section-title">나중에 보기</div><span class="remind-badge">📅 ${l.remind}</span></div>`:''}
    ${customs.length?`<div class="detail-section"><div class="detail-section-title">추가 정보</div>${customs.map(cf=>`<div class="custom-row"><span class="custom-label">${esc(cf.name)}</span><span class="custom-val">${esc(String(cf.value||''))}</span></div>`).join('')}</div>`:''}
    <div style="font-size:11px;color:var(--txt2);margin-top:8px">저장일: ${formatDateFull(l.createdAt)}</div>
  `;
  document.getElementById('detailModal').classList.add('open');
};

window.openDetailRecipe = (id) => {
  const r = recipes.find(x=>x.id===id);
  if (!r) return;
  currentDetailId = id;
  currentDetailType = 'recipe';
  const imgs = Array.isArray(r.images) ? r.images : [];
  const ingrs = Array.isArray(r.ingredients) ? r.ingredients : [];
  const steps = Array.isArray(r.steps) ? r.steps : [];
  const customs = Array.isArray(r.customFields) ? r.customFields : [];
  const tags = r.tags ? r.tags.split(',').map(t=>t.trim()).filter(Boolean) : [];
  document.getElementById('detailTitle').textContent = '🍳 ' + (r.title||'레시피');
  const body = document.getElementById('detailBody');
  body.innerHTML = `
    ${imgs.map(img=>`<img class="detail-img" src="${img}" alt="">`).join('')}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      ${r.cat?`<span class="tag tag-mn">${esc(r.cat)}</span>`:''}
      ${tags.map((t,i)=>`<span class="tag ${tagColor(i+1)}">${esc(t)}</span>`).join('')}
      ${r.serving?`<span class="tag tag-lv">👥 ${esc(r.serving)}</span>`:''}
      ${r.time?`<span class="tag tag-yw">⏱️ ${esc(r.time)}</span>`:''}
      ${r.calorie?`<span class="tag tag-bl">🔥 ${esc(r.calorie)}</span>`:''}
    </div>
    ${r.difficulty?`<div style="font-size:13px;color:var(--txt2);margin-bottom:10px">난이도: ${esc(r.difficulty)}</div>`:''}
    ${r.refLink?`<div class="detail-section"><div class="detail-section-title">참고 링크</div><a href="${esc(r.refLink)}" target="_blank" style="color:var(--bl3);font-size:13px;word-break:break-all">${esc(r.refLink)}</a></div>`:''}
    ${ingrs.length?`<div class="detail-section">
      <div class="detail-section-title">재료 <button onclick="openShopModal('${r.id}')" style="font-size:11px;padding:3px 10px;border-radius:8px;background:var(--mn);color:var(--mn3);border:none;cursor:pointer;font-weight:700">🛒 장보기 모드</button></div>
      ${ingrs.map(ig=>`<div class="detail-ingr-item">
        <span class="detail-ingr-name">${esc(ig.name)}</span>
        <span class="detail-ingr-amount">${esc(ig.amount||'')}</span>
        ${ig.buyLink?`<a class="detail-ingr-link" href="${esc(ig.buyLink)}" target="_blank">🛒 구매링크</a>`:''}
      </div>`).join('')}
    </div>`:''}
    ${steps.length?`<div class="detail-section">
      <div class="detail-section-title">조리 순서</div>
      ${steps.map((s,i)=>`<div class="detail-step-item"><div class="detail-step-num">${i+1}</div><div class="detail-step-txt">${esc(s.text||'')}</div></div>`).join('')}
    </div>`:''}
    ${r.memo?`<div class="detail-section"><div class="detail-section-title">만드는 방법 메모</div><div style="font-size:13px;color:var(--txt);line-height:1.6;white-space:pre-wrap">${esc(r.memo)}</div></div>`:''}
    ${customs.length?`<div class="detail-section"><div class="detail-section-title">추가 정보</div>${customs.map(cf=>`<div class="custom-row"><span class="custom-label custom-label-mn">${esc(cf.name)}</span><span class="custom-val">${esc(String(cf.value||''))}</span></div>`).join('')}</div>`:''}
    <div style="font-size:11px;color:var(--txt2);margin-top:8px">저장일: ${formatDateFull(r.createdAt)}</div>
  `;
  document.getElementById('detailModal').classList.add('open');
};

function shareDetail() {
  let text = '';
  if (currentDetailType==='link') {
    const l = links.find(x=>x.id===currentDetailId);
    if (l) text = `${l.title||'링크'}\n${l.url}${l.memo?'\n'+l.memo:''}`;
  } else {
    const r = recipes.find(x=>x.id===currentDetailId);
    if (r) {
      const ingrs = Array.isArray(r.ingredients)?r.ingredients:[];
      text = `[${r.title}]\n재료: ${ingrs.map(i=>i.name+(i.amount?' '+i.amount:'')).join(', ')}`;
    }
  }
  if (navigator.share) { navigator.share({text}); }
  else { navigator.clipboard.writeText(text); toast('클립보드에 복사되었어요'); }
}

async function deleteDetail() {
  if (!confirm('정말 삭제할까요?')) return;
  const col = currentDetailType==='link' ? 'lr_links' : 'lr_recipes';
  await fsDelete(col, currentDetailId);
  if (currentDetailType==='link') links = links.filter(x=>x.id!==currentDetailId);
  else recipes = recipes.filter(x=>x.id!==currentDetailId);
  document.getElementById('detailModal').classList.remove('open');
  if (currentDetailType==='link') renderLinkList();
  else renderRecipeList();
  renderCalendar();
  toast('삭제 완료');
}

// ===== SHOP MODAL =====
function setupShopModal() {
  document.getElementById('shopClose').onclick = () => document.getElementById('shopModal').classList.remove('open');
  document.getElementById('shopModal').onclick = (e) => { if(e.target===document.getElementById('shopModal')) document.getElementById('shopModal').classList.remove('open'); };
}
window.openShopModal = (id) => {
  const r = recipes.find(x=>x.id===id);
  if (!r) return;
  const ingrs = Array.isArray(r.ingredients) ? r.ingredients : [];
  document.getElementById('shopTitle').textContent = `🛒 ${r.title} 장보기`;
  document.getElementById('shopBody').innerHTML = ingrs.map((ig,i)=>`
    <div class="shop-item">
      <input type="checkbox" id="shop${i}" onchange="this.parentElement.style.opacity=this.checked?'.4':'1'">
      <label for="shop${i}" class="shop-item-name">${esc(ig.name)}</label>
      <span class="shop-item-amount">${esc(ig.amount||'')}</span>
      ${ig.buyLink?`<a class="shop-item-link" href="${esc(ig.buyLink)}" target="_blank">🛒 구매</a>`:''}
    </div>`).join('');
  document.getElementById('shopModal').classList.add('open');
};

// ===== CALENDAR =====
function setupCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  document.getElementById('calPrev').onclick = () => { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); };
  document.getElementById('calNext').onclick = () => { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); };
  document.getElementById('zoomSm').onclick = () => setZoom('sm');
  document.getElementById('zoomMd').onclick = () => setZoom('md');
  document.getElementById('zoomLg').onclick = () => setZoom('lg');
  document.getElementById('calDetailClose').onclick = () => { document.getElementById('calDetail').style.display='none'; };
}
function setZoom(z) {
  calZoom = z;
  document.querySelectorAll('.zoom-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('zoom'+z.charAt(0).toUpperCase()+z.slice(1)).classList.add('active');
  renderCalendar();
}

function renderCalendar() {
  const label = document.getElementById('calMonthLabel');
  label.textContent = `${calYear}년 ${calMonth+1}월`;
  const dow = document.getElementById('calDow');
  dow.innerHTML = ['일','월','화','수','목','금','토'].map(d=>`<div class="cal-dow">${d}</div>`).join('');
  const grid = document.getElementById('calGrid');
  grid.className = `cal-grid zoom-${calZoom}`;
  const first = new Date(calYear, calMonth, 1).getDay();
  const days = new Date(calYear, calMonth+1, 0).getDate();
  const prevDays = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();
  let cells = '';
  // prev month
  for (let i=first-1; i>=0; i--) {
    cells += `<div class="cal-cell other-month"><span class="cal-day-num">${prevDays-i}</span></div>`;
  }
  // current month
  const maxEntries = calZoom==='sm' ? 1 : calZoom==='md' ? 2 : 3;
  for (let d=1; d<=days; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayLinks = links.filter(l => l.createdAt && tsToDate(l.createdAt)===dateStr);
    const dayRecipes = recipes.filter(r => r.createdAt && tsToDate(r.createdAt)===dateStr);
    const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;
    const isSun = new Date(calYear,calMonth,d).getDay()===0;
    const isSat = new Date(calYear,calMonth,d).getDay()===6;
    let entriesHtml = '';
    let total = 0;
    for (const l of dayLinks) {
      if (total>=maxEntries) break;
      entriesHtml += `<div class="cal-entry link-entry" title="${esc(l.title||'링크')}">🔗 ${esc((l.title||'링크').slice(0,calZoom==='lg'?10:6))}</div>`;
      total++;
    }
    for (const r of dayRecipes) {
      if (total>=maxEntries) break;
      entriesHtml += `<div class="cal-entry recipe-entry" title="${esc(r.title||'레시피')}">🍳 ${esc((r.title||'레시피').slice(0,calZoom==='lg'?10:6))}</div>`;
      total++;
    }
    const remaining = (dayLinks.length + dayRecipes.length) - total;
    if (remaining > 0) entriesHtml += `<div class="cal-more">+${remaining}개 더</div>`;
    cells += `<div class="cal-cell${isToday?' today':''}${isSun?' sunday':''}${isSat?' saturday':''}" onclick="openCalDay('${dateStr}')">
      <span class="cal-day-num">${d}</span>${entriesHtml}
    </div>`;
  }
  // next month fill
  const total_cells = Math.ceil((first + days) / 7) * 7;
  for (let d=1; d <= total_cells-(first+days); d++) {
    cells += `<div class="cal-cell other-month"><span class="cal-day-num">${d}</span></div>`;
  }
  grid.innerHTML = cells;

  // stats
  const mLinks = links.filter(l=>l.createdAt && new Date(l.createdAt).getFullYear()===calYear && new Date(l.createdAt).getMonth()===calMonth).length;
  const mRecipes = recipes.filter(r=>r.createdAt && new Date(r.createdAt).getFullYear()===calYear && new Date(r.createdAt).getMonth()===calMonth).length;
  document.getElementById('calStats').innerHTML = `
    <div class="cal-stats-row">
      <div class="cal-stat-box pk"><span class="cal-stat-num">${mLinks}</span><div class="cal-stat-label">이번달 링크</div></div>
      <div class="cal-stat-box mn"><span class="cal-stat-num">${mRecipes}</span><div class="cal-stat-label">이번달 레시피</div></div>
      <div class="cal-stat-box lv"><span class="cal-stat-num">${mLinks+mRecipes}</span><div class="cal-stat-label">전체</div></div>
    </div>`;
}

window.openCalDay = (dateStr) => {
  const dayLinks = links.filter(l => l.createdAt && tsToDate(l.createdAt)===dateStr);
  const dayRecipes = recipes.filter(r => r.createdAt && tsToDate(r.createdAt)===dateStr);
  if (!dayLinks.length && !dayRecipes.length) return;
  const detail = document.getElementById('calDetail');
  document.getElementById('calDetailDate').textContent = `📅 ${dateStr}`;
  const list = document.getElementById('calDetailList');
  list.innerHTML = [
    ...dayLinks.map(l=>`<div class="cal-detail-item" onclick="openDetailLink('${l.id}')">
      <span class="cal-detail-icon">🔗</span>
      <span class="cal-detail-name link-name">${esc(l.title||'링크')}</span>
      <span class="cal-detail-type type-link">링크</span>
    </div>`),
    ...dayRecipes.map(r=>`<div class="cal-detail-item" onclick="openDetailRecipe('${r.id}')">
      <span class="cal-detail-icon">🍳</span>
      <span class="cal-detail-name recipe-name">${esc(r.title||'레시피')}</span>
      <span class="cal-detail-type type-recipe">레시피</span>
    </div>`)
  ].join('');
  detail.style.display = 'block';
};

function tsToDate(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts==='number' ? ts : parseInt(ts));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ===== AI TAB =====
function setupAI() {
  const sendBtn = document.getElementById('aiSend');
  const input = document.getElementById('aiInput');
  sendBtn.onclick = sendAI;
  input.addEventListener('keydown', (e) => { if(e.key==='Enter') sendAI(); });
}

async function sendAI() {
  const input = document.getElementById('aiInput');
  const q = input.value.trim();
  if (!q) return;
  const apiKey = localStorage.getItem('lr_apiKey');
  if (!apiKey) { appendAIBubble('API 키가 없어요. 설정 탭에서 Anthropic API 키를 입력해주세요 🔑', 'bot'); return; }
  appendAIBubble(q, 'user');
  input.value = '';
  const loading = appendAIBubble('생각 중...🤔', 'loading');

  const dataContext = JSON.stringify({
    links: links.map(l=>({title:l.title,url:l.url,cat:l.cat,memo:l.memo,tags:'',date:formatDateFull(l.createdAt)})),
    recipes: recipes.map(r=>({title:r.title,cat:r.cat,tags:r.tags,ingredients:(Array.isArray(r.ingredients)?r.ingredients:[]).map(i=>i.name).join(','),date:formatDateFull(r.createdAt)}))
  });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key': apiKey,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'
      },
      body: JSON.stringify({
        model:'claude-sonnet-4-6',
        max_tokens:1000,
        system:`당신은 사용자의 링크와 레시피 컬렉션 검색 도우미입니다. 
아래 데이터를 기반으로 질문에 한국어로 간결하게 답변해주세요.
항목을 찾으면 제목과 카테고리를 알려주세요.
데이터: ${dataContext}`,
        messages:[{role:'user',content:q}]
      })
    });
    loading.remove();
    if (!res.ok) { appendAIBubble('오류가 발생했어요. API 키를 확인해주세요.', 'bot'); return; }
    const data = await res.json();
    const text = data.content?.[0]?.text || '답변을 받지 못했어요.';
    appendAIBubble(text, 'bot');
  } catch(e) {
    loading.remove();
    appendAIBubble('네트워크 오류가 발생했어요.', 'bot');
  }
}

function appendAIBubble(text, type) {
  const chat = document.getElementById('aiChat');
  const div = document.createElement('div');
  div.className = `ai-bubble ai-bubble-${type==='user'?'user':type==='loading'?'loading':'bot'}`;
  div.style.cssText = type==='user' ? 'margin-left:auto;max-width:85%' : 'max-width:85%';
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

// ===== SETTINGS =====
function setupSettings() {
  document.getElementById('saveApiKey').onclick = () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) { toast('API 키를 입력해주세요'); return; }
    localStorage.setItem('lr_apiKey', key);
    document.getElementById('apiKeyInput').value='';
    toast('API 키 저장 완료 ✓');
  };
  const savedKey = localStorage.getItem('lr_apiKey');
  if (savedKey) document.getElementById('apiKeyInput').placeholder = '저장됨 (변경하려면 입력)';

  document.getElementById('manualBackup').onclick = doBackup;
  document.getElementById('exportJson').onclick = exportJson;
  document.getElementById('addLinkCat').onclick = () => {
    const v = document.getElementById('newLinkCat').value.trim();
    if (!v || linkCats.includes(v)) { toast('중복이거나 비어있어요'); return; }
    linkCats.push(v); saveLocalCats(); document.getElementById('newLinkCat').value='';
    renderSettings(); renderLinkCatChips();
  };
  document.getElementById('addRecipeCat').onclick = () => {
    const v = document.getElementById('newRecipeCat').value.trim();
    if (!v || recipeCats.includes(v)) { toast('중복이거나 비어있어요'); return; }
    recipeCats.push(v); saveLocalCats(); document.getElementById('newRecipeCat').value='';
    renderSettings(); renderRecipeCatChips();
  };
  document.getElementById('darkModeToggle').onchange = toggleDark;
  document.getElementById('checkLinks').onclick = checkLinks;
  document.getElementById('clearAll').onclick = async () => {
    if (!confirm('정말 전체 삭제할까요? 복구 불가능합니다.')) return;
    if (!confirm('마지막 확인: 전체 삭제하시겠어요?')) return;
    for (const l of links) await fsDelete('lr_links', l.id);
    for (const r of recipes) await fsDelete('lr_recipes', r.id);
    links=[]; recipes=[];
    renderLinkList(); renderRecipeList(); renderCalendar(); renderSettings();
    toast('전체 삭제 완료');
  };
}

function renderSettings() {
  // link cat manage
  const lcm = document.getElementById('linkCatManage');
  lcm.innerHTML = linkCats.map((c,i)=>`<div class="cat-manage-item"><span class="cat-manage-name">${esc(c)}</span><button class="cat-del-btn" onclick="delLinkCat(${i})">✕</button></div>`).join('');
  // recipe cat manage
  const rcm = document.getElementById('recipeCatManage');
  rcm.innerHTML = recipeCats.map((c,i)=>`<div class="cat-manage-item"><span class="cat-manage-name">${esc(c)}</span><button class="cat-del-btn" onclick="delRecipeCat(${i})">✕</button></div>`).join('');
  // stats
  const stats = document.getElementById('statsArea');
  const tagCounts = {};
  links.forEach(l=>{if(l.cat)tagCounts[l.cat]=(tagCounts[l.cat]||0)+1});
  stats.innerHTML = `
    <div class="stat-item"><span>전체 링크</span><span class="stat-val">${links.length}개</span></div>
    <div class="stat-item"><span>전체 레시피</span><span class="stat-val">${recipes.length}개</span></div>
    <div class="stat-item"><span>이번달 링크</span><span class="stat-val">${links.filter(l=>{const d=new Date(l.createdAt);return d.getMonth()===new Date().getMonth()&&d.getFullYear()===new Date().getFullYear()}).length}개</span></div>
    <div class="stat-item"><span>이번달 레시피</span><span class="stat-val">${recipes.filter(r=>{const d=new Date(r.createdAt);return d.getMonth()===new Date().getMonth()&&d.getFullYear()===new Date().getFullYear()}).length}개</span></div>
    <div class="stat-item"><span>즐겨찾기 링크</span><span class="stat-val">${links.filter(l=>l.fav).length}개</span></div>
    <div class="stat-item"><span>즐겨찾기 레시피</span><span class="stat-val">${recipes.filter(r=>r.fav).length}개</span></div>`;
  // backup list
  renderBackupList();
}

window.delLinkCat = (i) => { linkCats.splice(i,1); saveLocalCats(); renderSettings(); renderLinkCatChips(); };
window.delRecipeCat = (i) => { recipeCats.splice(i,1); saveLocalCats(); renderSettings(); renderRecipeCatChips(); };

// ===== BACKUP =====
async function doBackup() {
  const snap = {
    timestamp: Date.now(),
    links: links,
    recipes: recipes,
    linkCats, recipeCats
  };
  const id = 'backup_' + Date.now();
  await fsSet('lr_backups', id, {data: JSON.stringify(snap), timestamp: Date.now()});
  localStorage.setItem('lr_lastBackup', Date.now().toString());
  document.getElementById('backupStatus').textContent = '💾 방금 백업';
  document.getElementById('backupInfo').textContent = '마지막 백업: 방금';
  await cleanOldBackups();
  toast('백업 완료 ✓');
  renderBackupList();
}

async function cleanOldBackups() {
  const all = await fsGet('lr_backups');
  all.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
  for (let i=5; i<all.length; i++) await fsDelete('lr_backups', all[i].id);
}

async function renderBackupList() {
  const list = document.getElementById('backupList');
  list.innerHTML = '<div style="font-size:12px;color:var(--txt2)">불러오는 중...</div>';
  const all = await fsGet('lr_backups');
  all.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
  if (!all.length) { list.innerHTML='<div style="font-size:12px;color:var(--txt2)">백업 없음</div>'; return; }
  list.innerHTML = all.map(b=>`
    <div class="backup-item">
      <span>${formatDateFull(b.timestamp)}</span>
      <button class="backup-restore-btn" onclick="restoreBackup('${b.id}')">복원</button>
    </div>`).join('');
  const lb = localStorage.getItem('lr_lastBackup');
  if (lb) document.getElementById('backupInfo').textContent = '마지막 백업: ' + formatDateFull(parseInt(lb));
}

window.restoreBackup = async (id) => {
  if (!confirm('이 백업으로 복원할까요? 현재 데이터는 덮어씌워집니다.')) return;
  const all = await fsGet('lr_backups');
  const b = all.find(x=>x.id===id);
  if (!b) { toast('백업을 찾을 수 없어요'); return; }
  try {
    const snap = typeof b.data==='string' ? JSON.parse(b.data) : b.data;
    links = snap.links||[];
    recipes = snap.recipes||[];
    linkCats = snap.linkCats||linkCats;
    recipeCats = snap.recipeCats||recipeCats;
    saveLocalCats();
    renderLinkList(); renderRecipeList(); renderCalendar(); renderSettings();
    toast('복원 완료 ✓');
  } catch { toast('복원 실패'); }
};

function exportJson() {
  const data = JSON.stringify({links, recipes, linkCats, recipeCats}, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mycollection_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  toast('JSON 내보내기 완료');
}

function scheduleAutoBackup() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,1,0);
  const msToMidnight = midnight - now;
  setTimeout(async () => { await doBackup(); setInterval(doBackup, 24*60*60*1000); }, msToMidnight);
  // 7일 이상 지났으면 즉시 백업
  const lb = parseInt(localStorage.getItem('lr_lastBackup')||'0');
  if (Date.now()-lb > 7*24*60*60*1000) { setTimeout(doBackup, 3000); }
}

// ===== LINK CHECK =====
async function checkLinks() {
  const result = document.getElementById('linkCheckResult');
  result.innerHTML = '<div style="font-size:12px;color:var(--txt2)">확인 중...</div>';
  let ok=0, fail=0;
  for (const l of links) {
    try {
      const r = await fetch(l.url, {method:'HEAD', mode:'no-cors', signal:AbortSignal.timeout(5000)});
      l.urlOk = true; ok++;
    } catch {
      l.urlOk = false; fail++;
    }
    await fsSet('lr_links', l.id, l);
  }
  result.innerHTML = `<div class="link-check-ok">✓ 정상: ${ok}개</div>${fail?`<div class="link-check-fail">✗ 오류: ${fail}개</div>`:''}`;
  renderLinkList();
}

// ===== UTILS =====
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts==='number'?ts:parseInt(ts));
  return `${d.getMonth()+1}/${d.getDate()}`;
}
function formatDateFull(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts==='number'?ts:parseInt(ts));
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}
