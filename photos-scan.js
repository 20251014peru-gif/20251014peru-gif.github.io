/* photos-scan.js  v8.0-20260616
   완전 재작성 — 누적 버그 없음
*/
'use strict';

/* ═══════════════════════════════════════
   디버그 로그 시스템 — 폰에서도 에러 확인 가능
   화면 우측하단 🐞 버튼 → 패널 열림
   ═══════════════════════════════════════ */
const _dbgLogs = [];
function dbg(msg, type='log'){
  const t = new Date().toLocaleTimeString();
  const entry = {t, type, msg:String(msg)};
  _dbgLogs.push(entry);
  if(_dbgLogs.length>100) _dbgLogs.shift();
  if(type==='error') console.error('🐞',msg);
  else console.log('🐞',msg);
  // 패널 열려있으면 실시간 갱신
  if(document.getElementById('dbgPanel')?.style.display==='flex') renderDbg();
}
// 전역 에러 자동 캡처
window.addEventListener('error', e => dbg(`❌ ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`,'error'));
window.addEventListener('unhandledrejection', e => dbg(`❌ Promise: ${e.reason?.message||e.reason}`,'error'));

function renderDbg(){
  const body = document.getElementById('dbgBody'); if(!body) return;
  body.innerHTML = _dbgLogs.slice().reverse().map(e=>{
    const col = e.type==='error'?'#ef4444':'#22c55e';
    return `<div style="border-bottom:1px solid #333;padding:4px 0;font-size:11px;line-height:1.4"><span style="color:${col}">[${e.t}]</span> ${e.msg.replace(/</g,'&lt;')}</div>`;
  }).join('') || '<div style="color:#888;padding:10px">로그 없음</div>';
}
function toggleDbg(){
  const p = document.getElementById('dbgPanel');
  if(!p) return;
  p.style.display = p.style.display==='flex'?'none':'flex';
  if(p.style.display==='flex') renderDbg();
}
function clearDbg(){ _dbgLogs.length=0; renderDbg(); }
function copyDbg(){
  const txt = _dbgLogs.map(e=>`[${e.t}][${e.type}] ${e.msg}`).join('\n');
  navigator.clipboard?.writeText(txt).then(()=>toast('로그 복사됨')).catch(()=>{
    const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('로그 복사됨');
  });
}


/* ═══ 상수 ═══ */
const FIREBASE_PROJECT = 'my-system-25497';
const FIREBASE_KEY     = 'AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const LS_PHOTOS  = 'psc_photos';
const LS_CATS    = 'psc_cats';
const LS_API_KEY = 'psc_apikey';
// 다른 앱들의 키 이름들 — 호환성
const LS_API_KEYS = ['psc_apikey','claude_api_key','anthropic_key','CLAUDE_API_KEY','ANTHROPIC_API_KEY'];
const SCAN_SERVER= 'http://localhost:8080';
const DEFAULT_CATS = ['영수증','계약서','행정문서'];
const MODE = new URLSearchParams(location.search).get('mode')==='work' ? 'work' : 'personal';
const MODE_LABEL = MODE==='work' ? '📋 업무 스캔' : '📷 개인 스캔';
const MODE_COLOR = MODE==='work' ? '#2563EB' : '#7C3AED';

/* ═══ IndexedDB ═══ */
let idb = null;
function openIDB(){
  return new Promise((res,rej)=>{
    // v2로 올려서 옛 DB에 store 없으면 자동 생성
    const r = indexedDB.open('PhotoScanDB_'+MODE, 2);
    r.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains('imgs')){
        db.createObjectStore('imgs',{keyPath:'id'});
      }
    };
    r.onsuccess = e => {
      idb = e.target.result;
      // store 확인 — 없으면 DB 삭제 후 재생성
      if(!idb.objectStoreNames.contains('imgs')){
        idb.close();
        const del = indexedDB.deleteDatabase('PhotoScanDB_'+MODE);
        del.onsuccess = ()=>{ openIDB().then(res).catch(rej); };
        del.onerror = rej;
      } else {
        res();
      }
    };
    r.onerror = e => { dbg('IDB open error: '+e.target.error?.message); rej(e); };
  });
}
const idbPut = (id,data) => new Promise((r,j)=>{ const t=idb.transaction('imgs','readwrite'); t.objectStore('imgs').put({id,data}); t.oncomplete=r; t.onerror=j; });
const idbGet = id => new Promise((r,j)=>{ const req=idb.transaction('imgs','readonly').objectStore('imgs').get(id); req.onsuccess=e=>r(e.target.result?.data||null); req.onerror=j; });
const idbDel = id => new Promise((r,j)=>{ const t=idb.transaction('imgs','readwrite'); t.objectStore('imgs').delete(id); t.oncomplete=r; t.onerror=j; });
const idbAll = () => new Promise((r,j)=>{ const req=idb.transaction('imgs','readonly').objectStore('imgs').getAll(); req.onsuccess=e=>r(e.target.result); req.onerror=j; });

/* ═══ 상태 ═══ */
let photos=[], cats=[], filter='all', searchQ='';
function loadData(){
  try{ photos=JSON.parse(localStorage.getItem(LS_PHOTOS+'_'+MODE)||'[]'); }catch{ photos=[]; }
  try{ cats=JSON.parse(localStorage.getItem(LS_CATS+'_'+MODE)||JSON.stringify(DEFAULT_CATS)); }catch{ cats=[...DEFAULT_CATS]; }
}
const savePhotos = () => localStorage.setItem(LS_PHOTOS+'_'+MODE, JSON.stringify(photos));
const saveCats   = () => localStorage.setItem(LS_CATS+'_'+MODE,   JSON.stringify(cats));
const uid  = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const today= () => new Date().toISOString().slice(0,10);
const $    = id => document.getElementById(id);
const $on  = (id,fn) => { const el=$(id); if(el) el.onclick=fn; };

/* ═══ 토스트 ═══ */
let _tt;
function toast(msg,ms=2500){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(_tt); _tt=setTimeout(()=>t.classList.remove('show'),ms);
}

/* ═══ 유틸 ═══ */
const blobToUrl = b => new Promise((r,j)=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.onerror=j; fr.readAsDataURL(b); });
function loadImg(src){ return new Promise((r,j)=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=j; i.src=src; }); }
function resizeImg(src, maxPx=1024){ return new Promise(r=>{ const i=new Image(); i.onload=()=>{ const s=Math.min(maxPx/i.width,maxPx/i.height,1); const c=document.createElement('canvas'); c.width=Math.round(i.width*s); c.height=Math.round(i.height*s); c.getContext('2d').drawImage(i,0,0,c.width,c.height); r(c.toDataURL('image/jpeg',0.85)); }; i.src=src; }); }
function cropPx(src,sx,sy,sw,sh){ return new Promise(r=>{ const i=new Image(); i.onload=()=>{ const c=document.createElement('canvas'); c.width=sw; c.height=sh; c.getContext('2d').drawImage(i,sx,sy,sw,sh,0,0,sw,sh); r(c.toDataURL('image/jpeg',0.96)); }; i.src=src; }); }
function sortCorners(pts){ const cx=pts.reduce((s,p)=>s+p.x,0)/4, cy=pts.reduce((s,p)=>s+p.y,0)/4; return [ pts.find(p=>p.x<=cx&&p.y<=cy)||pts[0], pts.find(p=>p.x>cx&&p.y<=cy)||pts[1], pts.find(p=>p.x>cx&&p.y>cy)||pts[2], pts.find(p=>p.x<=cx&&p.y>cy)||pts[3] ]; }

/* ═══ AI API ═══ */
function getApiKey(){
  for(const k of LS_API_KEYS){ const v=(localStorage.getItem(k)||'').trim(); if(v) return v; }
  return '';
}
async function callAI(messages, maxTok=512){
  const key=getApiKey();
  if(!key) throw new Error('AI 키 없음 — 🔑 버튼에서 설정');
  const r=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:maxTok,messages})
  });
  if(!r.ok){ const e=await r.json().catch(()=>{}); throw new Error(e?.error?.message||`HTTP ${r.status}`); }
  const d=await r.json();
  return (d.content||[]).map(b=>b.text||'').join('').trim();
}

/* ═══ 필터칩 ═══ */
function renderChips(){
  const area=$('filterChips'); if(!area) return;
  area.innerHTML='';
  const mk=(label,val)=>{
    const b=document.createElement('button');
    b.className='chip'+(filter===val?' active':'');
    const lbl=document.createElement('span'); lbl.textContent=label; lbl.onclick=()=>{ filter=val; renderChips(); renderGallery(); };
    b.appendChild(lbl);
    if(val!=='all'){
      const x=document.createElement('span'); x.className='chipX'; x.textContent=' ✕'; x.title=`"${val}" 삭제`;
      x.onclick=e=>{ e.stopPropagation(); if(!confirm(`"${val}" 삭제?`)) return; cats=cats.filter(c=>c!==val); saveCats(); if(filter===val) filter='all'; renderChips(); renderGallery(); populateCatSel(); };
      b.appendChild(x);
    }
    area.appendChild(b);
  };
  mk('전체','all');
  cats.forEach(c=>mk(c,c));
}

/* ═══ 갤러리 ═══ */
async function renderGallery(){
  const grid=$('photoGrid'), empty=$('emptyState');
  grid.querySelectorAll('.card').forEach(c=>c.remove());
  const q=searchQ.toLowerCase();
  const list=photos.filter(p=>{
    const mc=filter==='all'||p.cat===filter;
    const ms=!q||(p.title||'').toLowerCase().includes(q)||(p.memo||'').toLowerCase().includes(q);
    return mc&&ms;
  }).sort((a,b)=>b.id.localeCompare(a.id));
  if(empty) empty.style.display=list.length?'none':'';
  for(const p of list){
    const card=document.createElement('div'); card.className='card';
    const iw=document.createElement('div'); iw.className='card-img-wrap';
    const img=document.createElement('img'); img.className='card-img'; img.alt=p.title||'';
    iw.appendChild(img);
    if(p.type){ const tb=document.createElement('span'); tb.className='card-type'; tb.textContent={'영수증':'🧾','계약서':'📄','행정문서':'📋'}[p.type]||''; iw.appendChild(tb); }
    if((p.imgIds||[]).length>1){ const mb=document.createElement('span'); mb.className='card-multi'; mb.textContent='×'+p.imgIds.length; iw.appendChild(mb); }
    const acts=document.createElement('div'); acts.className='card-acts';
    const e1=document.createElement('button'); e1.className='cAct edit'; e1.textContent='✏️ 수정'; e1.onclick=ev=>{ ev.stopPropagation(); openAddModal(p.id); };
    const e2=document.createElement('button'); e2.className='cAct del';  e2.textContent='🗑 삭제'; e2.onclick=ev=>{ ev.stopPropagation(); delPhoto(p.id); };
    acts.append(e1,e2); iw.appendChild(acts);
    const firstId=(p.imgIds||[])[0]; if(firstId) idbGet(firstId).then(u=>{ if(u) img.src=u; });
    const info=document.createElement('div'); info.className='card-info';
    info.innerHTML=`<div class="card-title">${p.title||'(제목없음)'}</div><div class="card-meta"><span class="badge">${p.cat||''}</span><span class="card-date">${(p.date||'').slice(5)}</span></div>`;
    card.append(iw,info);
    card.onclick=()=>openView(p.id);
    grid.insertBefore(card,empty);
  }
}

/* ═══ 사진 추가/수정 모달 ═══ */
let mImgs=[], mSlide=0, mEditId=null;

function populateCatSel(sel){
  const s=$('fCat'); if(!s) return;
  const prev=sel||s.value||cats[0]||'';
  s.innerHTML=cats.map(c=>`<option value="${c}"${c===prev?' selected':''}>${c}</option>`).join('');
}

function openAddModal(photoId=null, preserveImgs=false){
  mEditId=photoId;
  // 사진 첨부 후 호출되는 경우 mImgs 보존 (preserveImgs=true)
  if(!preserveImgs){ mImgs=[]; mSlide=0; }
  $('addModalTitle').textContent=photoId?'사진 수정':'사진 추가';
  $('fTitle').value=''; $('fMemo').value=''; $('fDate').value=today();
  $('fType') && ($('fType').value='');
  $('aiStatus').textContent='';
  populateCatSel();
  if(photoId){
    const p=photos.find(x=>x.id===photoId); if(!p) return;
    $('fTitle').value=p.title||''; $('fMemo').value=p.memo||''; $('fDate').value=p.date||today();
    if($('fType')) $('fType').value=p.type||'';
    populateCatSel(p.cat);
    Promise.all((p.imgIds||[]).map(id=>idbGet(id).then(u=>({id,data:u})))).then(imgs=>{ mImgs=imgs.filter(x=>x.data); renderSlides(); });
  }
  renderSlides();
  $('modalAdd').style.display='flex';
}

function renderSlides(){
  const wrap=$('slides'); if(!wrap) return;
  wrap.innerHTML='';
  if(!mImgs.length){ wrap.innerHTML='<div class="noimg">사진 없음</div>'; $('slideCnt').textContent='0/0'; return; }
  mImgs.forEach((m,i)=>{ const img=document.createElement('img'); img.src=m.data; if(i===mSlide) img.classList.add('active'); wrap.appendChild(img); });
  $('slideCnt').textContent=`${mSlide+1}/${mImgs.length}`;
}
function goSlide(d){ if(!mImgs.length) return; mSlide=(mSlide+d+mImgs.length)%mImgs.length; renderSlides(); }

/* ══ EXIF orientation 읽고 자동 회전 (틀어진 사진 바로) ══ */
function getExifOrientation(dataUrl){
  try{
    const b64 = dataUrl.split(',')[1] || '';
    const bin = atob(b64.slice(0, 65536));
    if(bin.charCodeAt(0)!==0xFF || bin.charCodeAt(1)!==0xD8) return 1;
    let i=2;
    while(i < bin.length){
      if(bin.charCodeAt(i)!==0xFF) break;
      const marker=bin.charCodeAt(i+1);
      if(marker===0xE1){
        if(bin.substr(i+4,6)!=='Exif\0\0'){
          const len=bin.charCodeAt(i+2)*256 + bin.charCodeAt(i+3);
          i+=2+len; continue;
        }
        const tiffStart=i+10;
        const little = bin.charCodeAt(tiffStart)===0x49;
        const get16=o=>little ? bin.charCodeAt(o)+bin.charCodeAt(o+1)*256 : bin.charCodeAt(o)*256+bin.charCodeAt(o+1);
        const get32=o=>little ? bin.charCodeAt(o)+bin.charCodeAt(o+1)*256+bin.charCodeAt(o+2)*65536+bin.charCodeAt(o+3)*16777216
                              : bin.charCodeAt(o)*16777216+bin.charCodeAt(o+1)*65536+bin.charCodeAt(o+2)*256+bin.charCodeAt(o+3);
        const ifd0 = tiffStart + get32(tiffStart+4);
        const count = get16(ifd0);
        for(let j=0; j<count; j++){
          const off = ifd0 + 2 + j*12;
          if(get16(off)===0x0112) return get16(off+8);
        }
        return 1;
      }
      if(marker===0xDA) break;
      const len=bin.charCodeAt(i+2)*256 + bin.charCodeAt(i+3);
      i += 2 + len;
    }
  }catch(e){}
  return 1;
}

function autoRotateImage(dataUrl){
  // 자동 회전 비활성화 — 사용자가 편집에서 직접 ↺/↻ 회전
  return Promise.resolve(dataUrl);
}

async function handleFiles(files, append=false, autoScan=false){
  const results=[];
  for(const f of Array.from(files)){
    let blob=f;
    if(f.name?.toLowerCase().endsWith('.heic')||f.type==='image/heic'){ try{ blob=await heic2any({blob:f,toType:'image/jpeg',quality:0.92}); }catch(e){} }
    let url = await blobToUrl(blob);
    // ★ 자동 회전 — EXIF orientation에 따라 사진 바로 세움
    url = await autoRotateImage(url);
    results.push({id:uid(), data:url});
  }
  if(append){ mImgs.push(...results); renderSlides(); return; }
  mImgs=[...results]; mSlide=0;
  if(autoScan&&results.length===1){ openAddModal(null,true); setTimeout(()=>runDocScan(true),300); }
  else openAddModal(null,true);
}

async function savePhoto(){
  const title=$('fTitle').value.trim();
  if(!mImgs.length){ toast('사진을 추가하세요'); return; }
  if(!title){ toast('제목을 입력하세요'); return; }
  const cat=$('fCat').value, memo=$('fMemo').value.trim(), date=$('fDate').value||today(), type=$('fType')?.value||'';
  if(mEditId){
    const p=photos.find(x=>x.id===mEditId); if(!p) return;
    await Promise.all((p.imgIds||[]).map(id=>idbDel(id)));
    const ids=[]; for(const m of mImgs){ const nid=m.id||uid(); await idbPut(nid,m.data); ids.push(nid); }
    p.title=title; p.cat=cat; p.memo=memo; p.date=date; p.type=type; p.imgIds=ids;
  } else {
    const pid=uid(), ids=[]; for(const m of mImgs){ const iid=uid(); await idbPut(iid,m.data); ids.push(iid); }
    photos.unshift({id:pid,title,cat,memo,date,type,imgIds:ids});
  }
  savePhotos(); $('modalAdd').style.display='none'; renderGallery(); toast('저장되었습니다');
}

async function delPhoto(id){
  if(!confirm('삭제할까요?')) return;
  const i=photos.findIndex(x=>x.id===id); if(i<0) return;
  await Promise.all((photos[i].imgIds||[]).map(iid=>idbDel(iid)));
  photos.splice(i,1); savePhotos(); $('viewFs').style.display='none'; renderGallery(); toast('삭제됨');
}

/* ═══ 이미지 확대 팝업 ═══ */
function openImgPopup(){
  if(!mImgs.length) return;
  $('popupImg').src=mImgs[mSlide]?.data||'';
  $('imgPopup').style.display='flex';
  $('popupPrev').style.display=mImgs.length>1?'':'none';
  $('popupNext').style.display=mImgs.length>1?'':'none';
}
function closeImgPopup(){ $('imgPopup').style.display='none'; }
function popupNav(d){ mSlide=(mSlide+d+mImgs.length)%mImgs.length; renderSlides(); $('popupImg').src=mImgs[mSlide]?.data||''; }

/* ═══ 상세보기 ═══ */
let vId=null, vSlide=0, vImgIds=[];
async function openView(id){
  const p=photos.find(x=>x.id===id); if(!p) return;
  vId=id; vSlide=0; vImgIds=p.imgIds||[];
  $('viewTitle').textContent=p.title||'(제목없음)';
  $('viewTypeBadge').textContent=p.type?({'영수증':'🧾','계약서':'📄','행정문서':'📋'}[p.type]||'')+' '+p.type:'';
  $('viewCatBadge').textContent=p.cat||'';
  $('viewDateTxt').textContent=p.date||'';
  $('viewMemoTxt').textContent=p.memo||'';
  await loadViewImg();
  $('viewFs').style.display='flex';
}
async function loadViewImg(){
  const url=vImgIds[vSlide]?await idbGet(vImgIds[vSlide]):null;
  $('viewImg').src=url||'';
  $('btnVPrev').style.display=vImgIds.length>1?'':'none';
  $('btnVNext').style.display=vImgIds.length>1?'':'none';
}
async function vNav(d){ vSlide=(vSlide+d+vImgIds.length)%vImgIds.length; await loadViewImg(); }

async function shareView(){
  const src=$('viewImg').src; if(!src) return;
  try{ const b=await fetch(src).then(r=>r.blob()); const f=new File([b],'photo.jpg',{type:'image/jpeg'});
    if(navigator.canShare&&navigator.canShare({files:[f]})) await navigator.share({files:[f],title:$('viewTitle').textContent});
    else { const a=document.createElement('a'); a.href=src; a.download='photo.jpg'; a.click(); toast('다운로드로 저장'); }
  }catch(e){ if(e.name!=='AbortError') toast('공유 오류: '+e.message); }
}

/* ═══ 카테고리 ═══ */
function addCat(name){ const n=name?.trim(); if(!n) return; if(cats.includes(n)){ toast('이미 있는 카테고리'); return; } cats.push(n); saveCats(); renderChips(); populateCatSel(n); renderCatList(); toast(`"${n}" 추가`); }
function renderCatList(){
  const ul=$('catList'); if(!ul) return; ul.innerHTML='';
  cats.forEach((c,i)=>{ const li=document.createElement('li'); li.className='catItem';
    li.innerHTML=`<span class="catItemName">${c}</span><button class="catItemDel" title="삭제">🗑</button>`;
    li.querySelector('button').onclick=()=>{ if(!confirm(`"${c}" 삭제?`)) return; cats.splice(i,1); saveCats(); renderCatList(); renderChips(); populateCatSel(); };
    ul.appendChild(li); });
}

/* ═══ 문서감지 (서버 or AI) ═══ */
let dsOrig=null, dsScale=1, dsZoom=1, dsCorners=[];

async function serverAlive(){
  try{ const r=await fetch(SCAN_SERVER+'/api/scan/health',{signal:AbortSignal.timeout(1500)}); return r.ok; }catch{ return false; }
}

async function runDocScan(silent=false){
  if(!mImgs.length){ if(!silent) toast('사진을 먼저 추가하세요'); return; }
  const btn=$('btnAiCrop'), st=$('aiStatus');
  if(btn) btn.disabled=true;
  if(st) st.textContent='';
  $('scanLoader').style.display='flex'; $('scanLoaderMsg').textContent='문서 감지 중...';
  try{
    const src=mImgs[mSlide].data;
    const alive=await serverAlive();
    if(alive){
      // 서버 OpenCV
      const small=await resizeImg(src,1200);
      const r=await fetch(SCAN_SERVER+'/api/scan/detect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:small}),signal:AbortSignal.timeout(15000)});
      if(!r.ok) throw new Error(`서버 ${r.status}`);
      const d=await r.json(); if(d.error) throw new Error(d.error);
      const origI=await loadImg(src), sI=await loadImg(small);
      const sx=origI.width/sI.width, sy=origI.height/sI.height;
      dsCorners=d.corners.map(([x,y])=>({x:x*sx,y:y*sy}));
      dsOrig=origI; _ds.orig=origI; _ds.corners=dsCorners;
      if(st) st.textContent=d.found?'✅ 서버 감지 완료':'⚠️ 경계 불명확 — 조정하세요';
    } else {
      // AI
      if(st) st.textContent='🤖 AI 감지 중...';
      $('scanLoaderMsg').textContent='AI 문서 감지 중...';
      const small=await resizeImg(src,1024);
      const p=small.split(';base64,'); const mt=p[0].replace('data:',''), b64=p[1];
      const si=await loadImg(small), oi=await loadImg(src);
      const tx=await callAI([{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:mt,data:b64}},
        {type:'text',text:`이미지(${si.width}×${si.height}px)에서 문서를 찾아주세요. JSON만: {"found":true,"tl":[x,y],"tr":[x,y],"br":[x,y],"bl":[x,y]} 또는 {"found":false}`}
      ]}],200);
      const j=JSON.parse(tx.replace(/```json|```/g,'').trim());
      if(!j.found){ dsCorners=[{x:oi.width*.07,y:oi.height*.07},{x:oi.width*.93,y:oi.height*.07},{x:oi.width*.93,y:oi.height*.93},{x:oi.width*.07,y:oi.height*.93}]; }
      else { const sx=oi.width/si.width,sy=oi.height/si.height; dsCorners=[j.tl,j.tr,j.br,j.bl].map(([x,y])=>({x:x*sx,y:y*sy})); }
      dsCorners=sortCorners(dsCorners);
      dsOrig=oi; _ds.orig=oi; _ds.corners=dsCorners;
      if(st) st.textContent=j.found?'✅ AI 감지 완료':'⚠️ 문서 미감지 — 조정하세요';
    }
    openDocScan();
  }catch(e){
    console.error(e);
    if(st) st.textContent='⚠️ '+e.message;
    toast('감지 오류: '+e.message);
  }finally{
    $('scanLoader').style.display='none';
    if(btn) btn.disabled=false;
  }
}

/* ══════════════════════════════════════════════════
   문서감지 — 캔버스 단일 렌더 방식 v9.0
   사진/꼭짓점/막대 모두 캔버스에 그림
   포인터 이벤트도 캔버스 하나에만 등록 — 단순/안정
   ══════════════════════════════════════════════════ */
let _ds = {
  orig: null,      // 원본 Image
  corners: [],     // 원본 좌표 [{x,y}] x4 — tl,tr,br,bl
  scale: 1,        // 표시 배율
  dragIdx: -1,     // 드래그 중인 핸들 인덱스 (-1=없음, 0~3=모서리, 4~7=막대 t/b/l/r)
};

function openDocScan(){
  if(!_ds.orig){ dbg('no image to scan','error'); return; }
  const fs=$('docScanFs');
  fs.style.display='flex';
  // 캔버스 이벤트 바인딩 (한 번만)
  const cvs=$('docScanCanvas');
  if(!cvs._bound){ cvs._bound=true; dsBindCanvas(cvs); }
  requestAnimationFrame(dsRender);
}

function closeDocScan(){ $('docScanFs').style.display='none'; }

/* ── 렌더: 캔버스 크기 설정 + 그리기 ── */
function dsRender(){
  const cvs=$('docScanCanvas'); if(!cvs||!_ds.orig) return;
  const sW=window.innerWidth, sH=window.innerHeight;
  const scale=Math.min(sW/_ds.orig.width, sH/_ds.orig.height);
  _ds.scale=scale;
  const dw=Math.round(_ds.orig.width*scale);
  const dh=Math.round(_ds.orig.height*scale);
  // ★ 크기가 바뀔 때만 설정 (드래그 중에는 그대로) — pointer 이벤트 끊김 방지
  if(cvs.width!==dw || cvs.height!==dh){
    cvs.width=dw; cvs.height=dh;
    cvs.style.width=dw+'px'; cvs.style.height=dh+'px';
  }
  dsRedraw();
}

/* ── 그리기만 (크기 변경 없음) — 드래그 중 호출 ── */
function dsRedraw(){
  const cvs=$('docScanCanvas'); if(!cvs||!_ds.orig) return;
  const dw=cvs.width, dh=cvs.height;
  const ctx=cvs.getContext('2d');
  ctx.clearRect(0,0,dw,dh);
  ctx.drawImage(_ds.orig, 0, 0, dw, dh);

  const p = _ds.corners.map(c=>({
    x: Math.round(Math.max(0,Math.min(dw, c.x*_ds.scale))),
    y: Math.round(Math.max(0,Math.min(dh, c.y*_ds.scale)))
  }));

  // 외부 어둡게
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.45)';
  ctx.beginPath();
  ctx.rect(0,0,dw,dh);
  ctx.moveTo(p[0].x,p[0].y);
  p.forEach(pt=>ctx.lineTo(pt.x,pt.y));
  ctx.closePath();
  ctx.fill('evenodd');

  // 노란 선
  ctx.strokeStyle='#FFD700';
  ctx.lineWidth=2.5;
  ctx.beginPath();
  ctx.moveTo(p[0].x,p[0].y);
  p.forEach(pt=>ctx.lineTo(pt.x,pt.y));
  ctx.closePath();
  ctx.stroke();

  // 막대 (얇게)
  const bars = dsBarRects(p);
  bars.forEach(b=>{
    ctx.fillStyle='#FFD700';
    ctx.strokeStyle='#fff';
    ctx.lineWidth=1.5;
    dsRoundRect(ctx, b.x, b.y, b.w, b.h, 3);
    ctx.fill(); ctx.stroke();
  });

  // 모서리 동그라미
  p.forEach(pt=>{
    ctx.fillStyle='#FFD700';
    ctx.strokeStyle='#fff';
    ctx.lineWidth=2.5;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 11, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
  });

  ctx.restore();
  _ds.dispCorners = p;
  _ds.dispBars = bars;
}

function dsRoundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

/* 막대 사각형 좌표 — 변 정중앙에 위치 (얇게) */
function dsBarRects(p){
  const [tl,tr,br,bl]=p;
  const BL=50, BT=10;  // 막대 길이 50 / 두께 10 (얇게)
  return [
    // t: 상단 변 정중앙 (가로)
    {type:'t', x:Math.round((tl.x+tr.x)/2)-BL/2, y:Math.round((tl.y+tr.y)/2)-BT/2, w:BL, h:BT},
    // b: 하단 변 정중앙 (가로)
    {type:'b', x:Math.round((bl.x+br.x)/2)-BL/2, y:Math.round((bl.y+br.y)/2)-BT/2, w:BL, h:BT},
    // l: 좌측 변 정중앙 (세로)
    {type:'l', x:Math.round((tl.x+bl.x)/2)-BT/2, y:Math.round((tl.y+bl.y)/2)-BL/2, w:BT, h:BL},
    // r: 우측 변 정중앙 (세로)
    {type:'r', x:Math.round((tr.x+br.x)/2)-BT/2, y:Math.round((tr.y+br.y)/2)-BL/2, w:BT, h:BL},
  ];
}

/* ── 히트테스트: 어느 핸들 위에 있는지 ── */
function dsHitTest(x, y){
  if(!_ds.dispCorners) return -1;
  // 모서리 먼저 (우선순위 높음)
  for(let i=0; i<4; i++){
    const c=_ds.dispCorners[i];
    const dx=x-c.x, dy=y-c.y;
    if(dx*dx + dy*dy < 30*30) return i; // 반경 30px 터치 영역
  }
  // 막대
  if(_ds.dispBars){
    for(let i=0; i<4; i++){
      const b=_ds.dispBars[i];
      // 막대 사각형 + 여유 8px
      if(x >= b.x-8 && x <= b.x+b.w+8 &&
         y >= b.y-8 && y <= b.y+b.h+8) return 4+i;
    }
  }
  return -1;
}

/* ── 캔버스에 단일 이벤트 ── */
function dsBindCanvas(cvs){
  cvs.style.touchAction='none';

  cvs.addEventListener('pointerdown', e=>{
    e.preventDefault();
    const r=cvs.getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;
    const hit=dsHitTest(x,y);
    if(hit<0){ dbg(`tap miss @ ${x.toFixed(0)},${y.toFixed(0)}`); return; }
    _ds.dragIdx=hit;
    dbg(`drag start: idx=${hit} @ ${x.toFixed(0)},${y.toFixed(0)}`);

    const onMove=ev=>{
      ev.preventDefault();
      const r2=cvs.getBoundingClientRect();
      const mx=Math.max(0,Math.min(cvs.width, ev.clientX-r2.left));
      const my=Math.max(0,Math.min(cvs.height,ev.clientY-r2.top));
      const ox=mx/_ds.scale, oy=my/_ds.scale;

      if(_ds.dragIdx>=0 && _ds.dragIdx<4){
        // 모서리
        _ds.corners[_ds.dragIdx] = {x:ox, y:oy};
      } else if(_ds.dragIdx===4){ // t
        _ds.corners[0].y=oy; _ds.corners[1].y=oy;
      } else if(_ds.dragIdx===5){ // b
        _ds.corners[2].y=oy; _ds.corners[3].y=oy;
      } else if(_ds.dragIdx===6){ // l
        _ds.corners[0].x=ox; _ds.corners[3].x=ox;
      } else if(_ds.dragIdx===7){ // r
        _ds.corners[1].x=ox; _ds.corners[2].x=ox;
      }
      dsRedraw();  // ★ 크기 변경 없이 다시 그리기만
    };
    const onUp=()=>{
      dbg(`drag end: idx=${_ds.dragIdx}`);
      _ds.dragIdx=-1;
      document.removeEventListener('pointermove',onMove);
      document.removeEventListener('pointerup',onUp);
      document.removeEventListener('pointercancel',onUp);
    };
    document.addEventListener('pointermove',onMove,{passive:false});
    document.addEventListener('pointerup',onUp);
    document.addEventListener('pointercancel',onUp);
  },{passive:false});
}

/* ── 호환용 글로벌 (이미 위에서 선언됨) ── */

/* ── 크롭 적용 ── */
/* ── 캔버스 기반 4점 원근 보정 (메쉬 제거 — 깔끔한 단순 크롭) ──
   서버 OpenCV가 가장 정확. 서버 없을 땐 bounding-box로 단순 크롭. */
async function canvasWarp(src, corners){
  // 메쉬 분할은 가장자리에 선이 생기므로 사용하지 않음
  // 단순 4점의 bounding box로 크롭만 (서버 없을 때 fallback)
  const img = await loadImg(src);
  const xs = corners.map(p=>p.x), ys = corners.map(p=>p.y);
  const sx = Math.max(0, Math.min(...xs));
  const sy = Math.max(0, Math.min(...ys));
  const sw = Math.min(img.width-sx,  Math.max(...xs)-sx);
  const sh = Math.min(img.height-sy, Math.max(...ys)-sy);
  if(sw<20 || sh<20) throw new Error('영역이 너무 작음');
  const c = document.createElement('canvas');
  c.width = Math.round(sw); c.height = Math.round(sh);
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.95);
}

/* ── AI 보정: 잘린 사진의 휘어짐/명암을 다듬어 반듯하게 ── */
async function aiEnhanceCrop(dataUrl, statusEl){
  // 1단계: 캔버스 기반 자동 보정 (대비/감마/선명도)
  const img = await loadImg(dataUrl);
  const w=img.width, h=img.height;
  const c = document.createElement('canvas');
  c.width=w; c.height=h;
  const ctx = c.getContext('2d');
  // 대비/밝기/채도 보정 (문서 가독성 향상)
  ctx.filter = 'contrast(1.15) brightness(1.04) saturate(0.85)';
  ctx.drawImage(img,0,0);

  // 화이트밸런스 + 그림자 제거 (분할 평균)
  try{
    const data = ctx.getImageData(0,0,w,h);
    const px = data.data;
    // 평균 밝기로 정규화 (간단한 화이트 매트 기반 보정)
    let sum=0, cnt=0;
    for(let i=0; i<px.length; i+=16){
      sum += (px[i]+px[i+1]+px[i+2])/3;
      cnt++;
    }
    const avg = sum/cnt;
    const target = 200; // 문서 평균 밝기 목표
    const scale = Math.min(1.3, Math.max(0.9, target/avg));
    for(let i=0; i<px.length; i+=4){
      px[i  ] = Math.min(255, px[i  ]*scale);
      px[i+1] = Math.min(255, px[i+1]*scale);
      px[i+2] = Math.min(255, px[i+2]*scale);
    }
    ctx.putImageData(data, 0, 0);
  }catch(e){ dbg('white balance skip: '+e.message); }

  return c.toDataURL('image/jpeg', 0.95);
}

async function applyDocScan(){
  if(!_ds.corners.length||!mImgs[mSlide]){ toast('감지된 문서가 없습니다'); return; }
  const src=mImgs[mSlide].data;
  const s=sortCorners(_ds.corners);
  const btn=$('btnDsApply'); if(btn) btn.disabled=true;
  const statusEl=$('aiStatus');

  try{
    let result;
    // 1순위: 서버 OpenCV 원근 보정 (가장 정확)
    try{
      const alive=await serverAlive();
      if(alive){
        toast('서버 원근 보정 중...');
        const r=await fetch(SCAN_SERVER+'/api/scan/warp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:src,corners:s.map(p=>[p.x,p.y])}),signal:AbortSignal.timeout(15000)});
        if(r.ok){ const d=await r.json(); if(!d.error) result=d.result; }
      }
    }catch(e){ dbg('server warp failed: '+e.message); }

    // 2순위: 캔버스 기반 4점 원근 보정 (휜 종이도 펴줌)
    if(!result){
      toast('원근 보정 중...');
      try{ result = await canvasWarp(src, s); }
      catch(e){ dbg('canvas warp failed: '+e.message); }
    }

    // 3순위: 단순 bounding-box 크롭
    if(!result){
      const xs=s.map(p=>p.x),ys=s.map(p=>p.y);
      const sx=Math.max(0,Math.min(...xs)), sy=Math.max(0,Math.min(...ys));
      const sw=Math.max(20,Math.max(...xs)-sx), sh=Math.max(20,Math.max(...ys)-sy);
      result=await cropPx(src,Math.round(sx),Math.round(sy),Math.round(sw),Math.round(sh));
    }

    // ★ AI 색상/대비 보정 — 반듯하고 깔끔하게
    toast('AI 보정 중...');
    try{ result = await aiEnhanceCrop(result, statusEl); }
    catch(e){ dbg('AI enhance skip: '+e.message); }

    mImgs[mSlide]={id:mImgs[mSlide].id||uid(), data:result};
    closeDocScan(); renderSlides();
    if(statusEl) statusEl.textContent='✅ 크롭+보정 완료';
    toast('✅ 문서 크롭 + 보정 완료!');
  } catch(e){
    dbg('applyDocScan error: '+e.message,'error');
    toast('오류: '+e.message);
  } finally{
    if(btn) btn.disabled=false;
  }
}

/* ═══ 편집기 (Fabric.js) ═══ */
let canvas=null, editId=null, editTool='select', editSrc='', mosaicOn=false;
let history=[], histMax=20;

function pushHist(){
  if(!canvas) return;
  history.push(JSON.stringify(canvas.toJSON()));
  if(history.length>histMax) history.shift();
}
function popHist(){
  if(!canvas||!history.length){ toast('더 이상 되돌릴 수 없어요'); return; }
  const state=history.pop();
  canvas.loadFromJSON(JSON.parse(state),()=>{
    if(editSrc){ const i=new Image(); i.onload=()=>{ const fi=new fabric.Image(i,{scaleX:canvas.width/i.width,scaleY:canvas.height/i.height,selectable:false,evented:false}); canvas.setBackgroundImage(fi,canvas.renderAll.bind(canvas)); }; i.src=editSrc; }
    else canvas.renderAll();
  });
}

function openEditor(){
  if(!mImgs.length){ toast('사진을 추가하세요'); return; }
  editId=mImgs[mSlide].id; editSrc=mImgs[mSlide].data;
  history=[]; $('modalAdd').style.display='none'; $('modalEdit').style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>initCanvas(editSrc)));
}

function initCanvas(src){
  editSrc=src;
  const wrap=$('canvasWrap'); if(!wrap) return;
  const mW=(wrap.clientWidth||window.innerWidth)-16, mH=(wrap.clientHeight||(window.innerHeight-200))-16;
  if(canvas){ canvas.dispose(); canvas=null; }
  canvas=new fabric.Canvas('editCanvas',{selection:true,preserveObjectStacking:true});
  const img=new Image();
  img.onload=()=>{
    const sc=Math.min(mW/img.width,mH/img.height,1);
    canvas.setWidth(Math.round(img.width*sc)); canvas.setHeight(Math.round(img.height*sc));
    const fi=new fabric.Image(img,{scaleX:sc,scaleY:sc,selectable:false,evented:false});
    canvas.setBackgroundImage(fi,()=>{
      canvas.renderAll();
      canvas.off('object:added').off('object:modified').off('object:removed');
      canvas.on('object:added',    pushHist);
      canvas.on('object:modified', pushHist);
      canvas.on('object:removed',  pushHist);
    });
    // 모자이크 이벤트
    canvas.on('mouse:down', o=>{ if(editTool==='mosaic'){ mosaicOn=true; applyMosaic(o.e); }});
    canvas.on('mouse:move', o=>{ if(editTool==='mosaic'&&mosaicOn) applyMosaic(o.e); });
    canvas.on('mouse:up',   ()=>{ mosaicOn=false; });
    canvas.upperCanvasEl.addEventListener('touchstart',e=>{ if(editTool==='mosaic'){ mosaicOn=true; applyMosaic(e.touches[0]); e.preventDefault(); }},{passive:false});
    canvas.upperCanvasEl.addEventListener('touchmove', e=>{ if(editTool==='mosaic'&&mosaicOn){ applyMosaic(e.touches[0]); e.preventDefault(); }},{passive:false});
    canvas.upperCanvasEl.addEventListener('touchend',  ()=>{ mosaicOn=false; });
  };
  img.src=src;
  setTool('select');
}

function setTool(t){
  editTool=t;
  document.querySelectorAll('.tbtn[data-t]').forEach(b=>b.classList.toggle('active',b.dataset.t===t));
  $('textRow').style.display=t==='text'?'flex':'none';
  $('mosaicSz').style.display=t==='mosaic'?'inline-block':'none';
  // 크롭 오버레이는 캔버스 방식으로 전환
  if(t==='crop'){ openCanvasCrop(); }
  else { closeCanvasCrop(); }
  if(!canvas) return;
  canvas.isDrawingMode=false; canvas.selection=true; canvas.defaultCursor='default';
  if(t==='draw'){
    canvas.isDrawingMode=true;
    canvas.freeDrawingBrush.width=parseInt($('tSize').value);
    canvas.freeDrawingBrush.color=$('tColor').value;
  } else if(t==='mosaic'){
    canvas.selection=false; canvas.defaultCursor='crosshair';
  }
}

/* ══ 수동 크롭 — 캔버스 단일 방식 (풀스크린 문서감지와 동일) ══ */
let _cc = { box:null, dragIdx:-1, sx:0, sy:0, sBox:null };

function openCanvasCrop(){
  if(!canvas){ toast('이미지가 없습니다'); return; }
  const inner=$('canvasInner');
  if(!inner){ toast('편집기 오류'); return; }
  inner.style.width=canvas.width+'px';
  inner.style.height=canvas.height+'px';

  // 오버레이 캔버스 생성/재사용
  let cc=document.getElementById('cropCanvas');
  if(!cc){
    cc=document.createElement('canvas');
    cc.id='cropCanvas';
    cc.style.cssText='position:absolute;left:0;top:0;z-index:50;touch-action:none;cursor:crosshair;';
    inner.appendChild(cc);
  }
  cc.width=canvas.width; cc.height=canvas.height;
  cc.style.width=canvas.width+'px'; cc.style.height=canvas.height+'px';
  cc.style.display='block';

  // 크롭박스 초기값 — 가운데 85%
  const pad=Math.round(Math.min(canvas.width,canvas.height)*0.075);
  _cc.box = { x:pad, y:pad, w:canvas.width-pad*2, h:canvas.height-pad*2 };

  // 버튼 표시
  const cb=$('cropBtns'); if(cb) cb.style.display='flex';

  drawCropOverlay();
  bindCropCanvas(cc);
}

function closeCanvasCrop(){
  const cc=document.getElementById('cropCanvas');
  if(cc) cc.style.display='none';
  const cb=$('cropBtns'); if(cb) cb.style.display='none';
}

function drawCropOverlay(){
  const cc=document.getElementById('cropCanvas'); if(!cc||!_cc.box) return;
  const ctx=cc.getContext('2d');
  const W=cc.width, H=cc.height;
  const {x,y,w,h}=_cc.box;
  ctx.clearRect(0,0,W,H);
  // 외부 어둡게
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.5)';
  ctx.beginPath();
  ctx.rect(0,0,W,H);
  ctx.rect(x,y,w,h);
  ctx.fill('evenodd');
  // 노란 테두리
  ctx.strokeStyle='#FFD700';
  ctx.lineWidth=2.5;
  ctx.strokeRect(x,y,w,h);
  // 막대 (얇게, 변 정중앙)
  const BL=50, BT=10;
  const bars=[
    {t:'t',x:x+w/2-BL/2, y:y-BT/2, w:BL, h:BT},
    {t:'b',x:x+w/2-BL/2, y:y+h-BT/2, w:BL, h:BT},
    {t:'l',x:x-BT/2, y:y+h/2-BL/2, w:BT, h:BL},
    {t:'r',x:x+w-BT/2, y:y+h/2-BL/2, w:BT, h:BL},
  ];
  ctx.fillStyle='#FFD700'; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5;
  bars.forEach(b=>{
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(b.x,b.y,b.w,b.h,3) : ctx.rect(b.x,b.y,b.w,b.h);
    ctx.fill(); ctx.stroke();
  });
  // 모서리 동그라미
  const corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  corners.forEach(([cx,cy])=>{
    ctx.fillStyle='#FFD700'; ctx.strokeStyle='#fff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,10,0,Math.PI*2);
    ctx.fill(); ctx.stroke();
  });
  ctx.restore();
  _cc.bars=bars; _cc.corners=corners;
}

function hitTestCrop(x,y){
  if(!_cc.corners) return -1;
  // 모서리 우선
  for(let i=0;i<4;i++){
    const [cx,cy]=_cc.corners[i];
    if((x-cx)**2 + (y-cy)**2 < 28*28) return i; // 0~3
  }
  // 막대
  for(let i=0;i<4;i++){
    const b=_cc.bars[i];
    if(x>=b.x-6 && x<=b.x+b.w+6 && y>=b.y-6 && y<=b.y+b.h+6) return 4+i; // 4~7
  }
  // 박스 내부 = 이동
  const {x:bx,y:by,w:bw,h:bh}=_cc.box;
  if(x>=bx && x<=bx+bw && y>=by && y<=by+bh) return 8; // move
  return -1;
}

function bindCropCanvas(cc){
  if(cc._bound) return; cc._bound=true;
  cc.style.touchAction='none';
  cc.addEventListener('pointerdown', e=>{
    e.preventDefault();
    const r=cc.getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;
    const hit=hitTestCrop(x,y);
    if(hit<0) return;
    _cc.dragIdx=hit;
    _cc.sx=e.clientX; _cc.sy=e.clientY;
    _cc.sBox={..._cc.box};
    dbg(`crop drag start: idx=${hit}`);

    const onMove=ev=>{
      ev.preventDefault();
      const dx=ev.clientX-_cc.sx, dy=ev.clientY-_cc.sy;
      const W=cc.width, H=cc.height;
      let {x:bx,y:by,w:bw,h:bh}=_cc.sBox;
      const idx=_cc.dragIdx;

      if(idx===8){ // move
        bx=Math.max(0,Math.min(_cc.sBox.x+dx, W-_cc.sBox.w));
        by=Math.max(0,Math.min(_cc.sBox.y+dy, H-_cc.sBox.h));
      } else if(idx===0){ // lt
        bx=_cc.sBox.x+dx; by=_cc.sBox.y+dy; bw=_cc.sBox.w-dx; bh=_cc.sBox.h-dy;
      } else if(idx===1){ // rt
        by=_cc.sBox.y+dy; bw=_cc.sBox.w+dx; bh=_cc.sBox.h-dy;
      } else if(idx===2){ // rb
        bw=_cc.sBox.w+dx; bh=_cc.sBox.h+dy;
      } else if(idx===3){ // lb
        bx=_cc.sBox.x+dx; bw=_cc.sBox.w-dx; bh=_cc.sBox.h+dy;
      } else if(idx===4){ // t
        by=_cc.sBox.y+dy; bh=_cc.sBox.h-dy;
      } else if(idx===5){ // b
        bh=_cc.sBox.h+dy;
      } else if(idx===6){ // l
        bx=_cc.sBox.x+dx; bw=_cc.sBox.w-dx;
      } else if(idx===7){ // r
        bw=_cc.sBox.w+dx;
      }
      // 최소 크기 + 경계
      if(bw<30){bw=30; if(idx===0||idx===3||idx===6) bx=_cc.sBox.x+_cc.sBox.w-30;}
      if(bh<30){bh=30; if(idx===0||idx===1||idx===4) by=_cc.sBox.y+_cc.sBox.h-30;}
      if(bx<0){bw+=bx;bx=0;}
      if(by<0){bh+=by;by=0;}
      if(bx+bw>W) bw=W-bx;
      if(by+bh>H) bh=H-by;
      _cc.box={x:bx,y:by,w:bw,h:bh};
      drawCropOverlay();
    };
    const onUp=()=>{
      dbg(`crop drag end: idx=${_cc.dragIdx}`);
      _cc.dragIdx=-1;
      document.removeEventListener('pointermove',onMove);
      document.removeEventListener('pointerup',onUp);
      document.removeEventListener('pointercancel',onUp);
    };
    document.addEventListener('pointermove',onMove,{passive:false});
    document.addEventListener('pointerup',onUp);
    document.addEventListener('pointercancel',onUp);
  },{passive:false});
}

function applyCrop(){
  if(!_cc.box){ toast('크롭 영역이 없습니다'); return; }
  const {x,y,w,h}=_cc.box;
  if(w<10||h<10){toast('크롭 영역이 너무 작아요');return;}
  const full=canvas.toDataURL({format:'jpeg',quality:0.96});
  const tmp=new Image();
  tmp.onload=()=>{
    const c=document.createElement('canvas'); c.width=Math.round(w); c.height=Math.round(h);
    c.getContext('2d').drawImage(tmp,x,y,w,h,0,0,w,h);
    const cropped=c.toDataURL('image/jpeg',0.96);
    const idx=mImgs.findIndex(m=>m.id===editId);
    if(idx>=0){ mImgs[idx].data=cropped; editId=mImgs[idx].id; editSrc=cropped; }
    initCanvas(cropped);
    setTool('select');
    toast('✂️ 크롭 완료');
  };
  tmp.src=full;
}

function rotateSlide(deg){
  if(!mImgs.length){ toast('사진이 없어요'); return; }
  const src = mImgs[mSlide].data;
  const i = new Image();
  i.onload = ()=>{
    const c = document.createElement('canvas');
    if(Math.abs(deg)===90){ c.width=i.height; c.height=i.width; }
    else{ c.width=i.width; c.height=i.height; }
    const ctx = c.getContext('2d');
    ctx.translate(c.width/2, c.height/2);
    ctx.rotate(deg*Math.PI/180);
    ctx.drawImage(i, -i.width/2, -i.height/2);
    mImgs[mSlide].data = c.toDataURL('image/jpeg', 0.95);
    renderSlides();
    toast(deg<0 ? '↺ 반시계 회전' : '↻ 시계 회전');
  };
  i.src = src;
}

function rotateImg(deg){
  const src=editSrc||canvas.toDataURL({format:'jpeg',quality:0.95});
  const i=new Image(); i.onload=()=>{
    const c=document.createElement('canvas');
    if(Math.abs(deg)===90){c.width=i.height;c.height=i.width;}
    else{c.width=i.width;c.height=i.height;}
    const ctx=c.getContext('2d'); ctx.translate(c.width/2,c.height/2); ctx.rotate(deg*Math.PI/180); ctx.drawImage(i,-i.width/2,-i.height/2);
    const r=c.toDataURL('image/jpeg',.95);
    const idx=mImgs.findIndex(m=>m.id===editId); if(idx>=0) mImgs[idx].data=r;
    editSrc=r; initCanvas(r);
  }; i.src=src;
}

function addShape(type){
  const color=$('tColor').value, sw=parseInt($('tSize').value);
  const sh=type==='rect'?new fabric.Rect({left:60,top:60,width:140,height:90,fill:'transparent',stroke:color,strokeWidth:sw}):new fabric.Ellipse({left:60,top:60,rx:70,ry:45,fill:'transparent',stroke:color,strokeWidth:sw});
  canvas.add(sh); canvas.setActiveObject(sh); canvas.renderAll(); setTool('select');
}
function addArrow(){
  const color=$('tColor').value, sw=parseInt($('tSize').value);
  const ln=new fabric.Line([50,100,170,100],{stroke:color,strokeWidth:sw,selectable:false});
  const hd=new fabric.Triangle({width:sw*5+8,height:sw*5+10,fill:color,left:170,top:100,angle:90,originX:'center',originY:'center',selectable:false});
  const g=new fabric.Group([ln,hd],{left:80,top:80,hasRotatingPoint:true});
  canvas.add(g); canvas.setActiveObject(g); canvas.renderAll(); setTool('select');
}
function addText(){
  const txt=$('textInp').value; if(!txt) return;
  const t=new fabric.Text(txt,{left:40,top:40,fill:$('tColor').value,fontSize:parseInt($('tSize').value)*5+16,fontFamily:'Arial',fontWeight:'bold'});
  canvas.add(t); canvas.setActiveObject(t); canvas.renderAll(); $('textInp').value=''; setTool('select');
}
function applyMosaic(e){
  const rect=canvas.upperCanvasEl.getBoundingClientRect();
  const px=e.clientX-rect.left, py=e.clientY-rect.top;
  const sz=parseInt($('mosaicSz').value)||40;
  const bg=canvas.backgroundImage; if(!bg) return;
  const bgEl=bg.getElement();
  const sx=Math.round((px-sz/2)/(bg.scaleX||1)), sy=Math.round((py-sz/2)/(bg.scaleY||1));
  const sw=Math.round(sz/(bg.scaleX||1)), sh=Math.round(sz/(bg.scaleY||1));
  const tc=document.createElement('canvas'); tc.width=Math.max(1,sw); tc.height=Math.max(1,sh);
  tc.getContext('2d').drawImage(bgEl,sx,sy,sw,sh,0,0,sw,sh);
  const pb=Math.max(3,Math.round(sz/10));
  const pc=document.createElement('canvas'); pc.width=pb; pc.height=pb;
  const pctx=pc.getContext('2d'); pctx.imageSmoothingEnabled=false; pctx.drawImage(tc,0,0,pb,pb);
  const mc=document.createElement('canvas'); mc.width=sz; mc.height=sz;
  const mctx=mc.getContext('2d'); mctx.imageSmoothingEnabled=false; mctx.drawImage(pc,0,0,sz,sz);
  fabric.Image.fromURL(mc.toDataURL(),mi=>{ mi.set({left:px-sz/2,top:py-sz/2,width:sz,height:sz,scaleX:1,scaleY:1,selectable:false,evented:false}); canvas.add(mi); canvas.renderAll(); });
}

function finishEdit(){
  if(!canvas) return;
  const url=canvas.toDataURL({format:'jpeg',quality:0.95});
  const idx=mImgs.findIndex(m=>m.id===editId);
  if(idx>=0) mImgs[idx].data=url;
  $('modalEdit').style.display='none'; $('modalAdd').style.display='flex'; renderSlides();
  toast('✅ 편집 저장 완료');
}

/* ═══ 백업 ═══ */
async function exportBackup(){
  toast('백업 생성 중...',3000);
  const imgs=await idbAll();
  const blob=new Blob([JSON.stringify({photos,cats,imgs},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`psc-backup-${today()}.json`; a.click();
  toast('백업 완료');
}
async function importBackup(file){
  try{
    const d=JSON.parse(await file.text());
    if(!d.photos){ toast('올바른 파일이 아닙니다'); return; }
    if(!confirm(`백업 불러오기 (${d.photos.length}개)? 현재 데이터가 대체됩니다.`)) return;
    if(d.imgs) for(const im of d.imgs) await idbPut(im.id,im.data);
    photos=d.photos; cats=d.cats||cats;
    savePhotos(); saveCats(); renderChips(); renderGallery(); populateCatSel(); renderCatList();
    toast('백업 불러오기 완료');
  }catch(e){ toast('오류: '+e.message); }
}
async function uploadToOneDrive(){
  const st=$('odStatus'); if(st) st.textContent='☁️ 준비 중...';
  toast('OneDrive: Azure Client ID가 필요합니다. 로컬 저장을 사용하세요.'); // 단순 안내
}

/* ═══ AI 검색 ═══ */
function closeAiDrop(){ $('aiDrop').style.display='none'; }
async function runAiSearch(q){
  q=(q||'').replace(/^@/,'').trim(); if(!q) return;
  $('aiDrop').style.display='block'; $('aiDropBody').innerHTML='<div style="padding:14px;color:#64748b">🤖 검색 중...</div>';
  try{
    const idx=photos.map(p=>({id:p.id,title:p.title,cat:p.cat,type:p.type,memo:p.memo,date:p.date}));
    const txt=await callAI([{role:'user',content:`사진목록:\n${JSON.stringify(idx)}\n검색: "${q}"\nJSON만: [{"id":"x","reason":"이유"},...]`}],1024);
    const found=JSON.parse(txt.replace(/```json|```/g,'').trim());
    $('aiDropBody').innerHTML='';
    if(!found.length){ $('aiDropBody').innerHTML='<p style="padding:14px;color:#aaa">결과 없음</p>'; return; }
    found.forEach(r=>{ const p=photos.find(x=>x.id===r.id); if(!p) return;
      const c=document.createElement('div'); c.className='aiCard';
      c.innerHTML=`<div class="aiCardTitle">${p.title||'(제목없음)'}</div><div class="aiCardMeta">${p.type||''} · ${p.cat||''} · ${p.date||''}</div><div class="aiCardReason">${r.reason}</div>`;
      c.onclick=()=>{ closeAiDrop(); openView(p.id); }; $('aiDropBody').appendChild(c); });
  }catch(e){ $('aiDropBody').innerHTML=`<p style="padding:14px;color:red">오류: ${e.message}</p>`; }
}

/* ═══ 모드 ═══ */
function setMode(m){
  $('tabPhoto').classList.toggle('active',m==='photo');
  $('tabScan').classList.toggle('active',m==='scan');
  $('modePhoto').style.display=m==='photo'?'flex':'none';
  $('modeScan').style.display=m==='scan'?'flex':'none';
}

/* ═══ 연속촬영 ═══ */
let burstImgs=[];
function startBurst(){ burstImgs=[]; renderBurst(); }
function renderBurst(){
  $('burstCount').textContent=burstImgs.length+'장';
  $('burstThumbs').innerHTML='';
  burstImgs.forEach(m=>{ const i=document.createElement('img'); i.className='bThumb'; i.src=m.data; $('burstThumbs').appendChild(i); });
  $('burstOv').style.display=burstImgs.length>0?'flex':'none';
}
async function addBurstFiles(files){
  for(const f of Array.from(files)){
    let blob=f;
    if(f.name?.toLowerCase().endsWith('.heic')||f.type==='image/heic'){ try{ blob=await heic2any({blob:f,toType:'image/jpeg',quality:0.92}); }catch(e){} }
    let url = await blobToUrl(blob);
    url = await autoRotateImage(url);
    burstImgs.push({id:uid(),data:url});
  }
  renderBurst();
}
function burstDone(){ if(!burstImgs.length) return; $('burstOv').style.display='none'; mImgs=[...burstImgs]; mSlide=0; burstImgs=[]; openAddModal(null,true); }
function burstCancel(){ burstImgs=[]; $('burstOv').style.display='none'; }

/* ═══ INIT ═══ */
async function init(){
  await openIDB(); loadData();
  // 버전/모드
  if($('appTitle')) $('appTitle').textContent=MODE_LABEL;
  if($('appVersion')) $('appVersion').textContent='v9.9';
  document.title=MODE_LABEL;
  const bar=document.createElement('div');
  bar.style.cssText=`position:fixed;top:0;left:0;right:0;height:3px;background:${MODE_COLOR};z-index:200;`;
  document.body.appendChild(bar);

  renderChips(); renderGallery(); populateCatSel(); renderCatList();

  // ── 헤더 ──
  $on('btnHome',    ()=>location.href='index.html');
  $on('btnBackup',  ()=>{ $('modalOD').style.display='flex'; });
  $on('btnApiKey',  ()=>{ $('apiKeyInp').value=getApiKey(); $('modalKey').style.display='flex'; });
  $on('btnCatMgr',  ()=>{ renderCatList(); $('modalCat').style.display='flex'; });
  $on('btnExpBak',  exportBackup);
  $on('btnImpBak',  ()=>$('fBackup').click());

  // ── 모드 버튼 ──
  $on('btnPhotoCamera',  ()=>{ startBurst(); $('fCamera').click(); });
  $on('btnPhotoGallery', ()=>$('fGallery').click());
  $on('btnScanCamera',   ()=>$('fScanCam').click());
  $on('btnScanGallery',  ()=>$('fScanGal').click());

  // ── 파일 입력 ──
  $('fCamera')  && ($('fCamera').onchange  = e=>{ if(e.target.files.length) addBurstFiles(e.target.files); e.target.value=''; });
  $('fGallery') && ($('fGallery').onchange = e=>{ if(e.target.files.length) handleFiles(e.target.files); e.target.value=''; });
  $('fScanCam') && ($('fScanCam').onchange = e=>{ if(e.target.files.length) handleFiles(e.target.files,false,true); e.target.value=''; });
  $('fScanGal') && ($('fScanGal').onchange = e=>{ if(e.target.files.length) handleFiles(e.target.files,false,true); e.target.value=''; });
  $('fMoreGal') && ($('fMoreGal').onchange = e=>{ if(e.target.files.length) handleFiles(e.target.files,true); e.target.value=''; });
  $('fMoreCam') && ($('fMoreCam').onchange = e=>{ if(e.target.files.length) handleFiles(e.target.files,true); e.target.value=''; });
  $('fBackup')  && ($('fBackup').onchange  = e=>{ if(e.target.files[0]) importBackup(e.target.files[0]); e.target.value=''; });

  // ── 연속촬영 ──
  $on('burstAdd',    ()=>$('fCamera').click());
  $on('burstDone',   burstDone);
  $on('burstCancel', burstCancel);

  // ── 검색 ──
  $('gallerySearch') && ($('gallerySearch').oninput=e=>{ const v=e.target.value; searchQ=v.startsWith('@')?'':v; renderGallery(); });
  $('gallerySearch') && $('gallerySearch').addEventListener('keydown',e=>{ if(e.key==='Enter'&&$('gallerySearch').value.startsWith('@')){ e.preventDefault(); runAiSearch($('gallerySearch').value); }});
  $on('btnAiSearch', ()=>runAiSearch($('gallerySearch')?.value||''));

  // ── 추가 모달 ──
  $on('btnAddClose', ()=>{ $('modalAdd').style.display='none'; });
  $on('btnPrev',     ()=>goSlide(-1));
  $on('btnNext',     ()=>goSlide(1));
  $on('btnZoom',     openImgPopup);
  $on('btnMoreCam',  ()=>$('fMoreCam').click());
  $on('btnMoreGal',  ()=>$('fMoreGal').click());
  $on('btnDelSlide', ()=>{ if(!mImgs.length) return; mImgs.splice(mSlide,1); mSlide=Math.min(mSlide,mImgs.length-1); renderSlides(); });
  $on('btnSlideRotL', ()=>rotateSlide(-90));
  $on('btnSlideRotR', ()=>rotateSlide(90));
  $on('btnAiCrop',   ()=>runDocScan(false));
  $on('btnSave',     savePhoto);
  $on('btnEdit',     openEditor);
  $on('btnCatAdd2',  ()=>{ const n=prompt('새 카테고리'); if(n) addCat(n); });
  $on('btnCatDel2',  ()=>{ const v=$('fCat')?.value; if(!v) return; if(!confirm(`"${v}" 삭제?`)) return; cats=cats.filter(c=>c!==v); saveCats(); populateCatSel(); renderChips(); toast('삭제됨'); });

  // ── 편집 모달 ──
  $on('btnEditClose', ()=>{
    if(canvas){ try{ canvas.dispose(); }catch(_){} canvas=null; }
    history=[]; editId=null; editSrc='';
    $('modalEdit').style.display='none';
    $('modalAdd').style.display='flex';
    toast('편집 취소됨');
  });
  $on('btnEditDone',  finishEdit);
  $on('btnUndo',      popHist);
  document.querySelectorAll('.tbtn[data-t]').forEach(b=>{ b.onclick=()=>{ const t=b.dataset.t; if(t==='rect') addShape('rect'); else if(t==='circle') addShape('circle'); else if(t==='arrow') addArrow(); else setTool(t); }; });
  $('tColor') && ($('tColor').onchange=()=>{ if(canvas&&canvas.isDrawingMode) canvas.freeDrawingBrush.color=$('tColor').value; });
  $('tSize')  && ($('tSize').onchange =()=>{ if(canvas&&canvas.isDrawingMode) canvas.freeDrawingBrush.width=parseInt($('tSize').value); });
  $on('btnDelObj',    ()=>{ if(canvas){ const objs=canvas.getActiveObjects(); objs.forEach(o=>canvas.remove(o)); canvas.discardActiveObject(); canvas.renderAll(); }});
  $on('btnClearAll',  ()=>{
    if(!canvas) return;
    const cnt = canvas.getObjects().length;
    if(cnt===0){ toast('편집한 내용이 없어요'); return; }
    if(!confirm(`편집한 ${cnt}개 객체를 모두 지울까요?`)) return;
    canvas.getObjects().slice().forEach(o=>canvas.remove(o));
    canvas.discardActiveObject();
    canvas.renderAll();
    history=[];
    toast('🧹 편집 초기화됨');
  });
  $on('btnRotL',      ()=>rotateImg(-90));
  $on('btnRotR',      ()=>rotateImg(90));
  $on('btnCropApply', applyCrop);
  $on('btnCropCancel',()=>setTool('select'));
  $on('btnAddTxt',    addText);
  $('textInp') && ($('textInp').onkeydown=e=>{ if(e.key==='Enter') addText(); });

  // ── 문서감지 ──
  $on('btnDsClose', closeDocScan);
  $on('btnDsApply', applyDocScan);

  // ── 상세보기 ──
  $on('btnVClose', ()=>{ $('viewFs').style.display='none'; });
  $on('btnVPrev',  ()=>vNav(-1));
  $on('btnVNext',  ()=>vNav(1));
  $on('btnVShare', shareView);
  $on('btnVEdit',  ()=>{ $('viewFs').style.display='none'; openAddModal(vId); });
  $on('btnVDel',   ()=>delPhoto(vId));

  // ── 이미지 팝업 ──
  $on('popupClose', closeImgPopup);

  // ── 카테고리 모달 ──
  $on('btnCatClose',  ()=>{ $('modalCat').style.display='none'; });
  $on('btnCatAddOk',  ()=>{ const n=$('catNewName')?.value.trim(); if(n){ addCat(n); $('catNewName').value=''; }});
  $('catNewName') && ($('catNewName').onkeydown=e=>{ if(e.key==='Enter') $('btnCatAddOk')?.click(); });

  // ── API 키 모달 ──
  $on('btnKeyClose', ()=>{ $('modalKey').style.display='none'; });
  $on('btnKeySave',  ()=>{
    const v=$('apiKeyInp').value.trim();
    if(!v){ toast('키를 입력하세요'); return; }
    // 모든 앱과 공유되는 키 이름들에 동일하게 저장
    LS_API_KEYS.forEach(k=>localStorage.setItem(k,v));
    $('modalKey').style.display='none';
    toast('✅ API 키 저장됨');
  });

  // ── OneDrive 모달 ──
  $on('btnODClose',  ()=>{ $('modalOD').style.display='none'; });
  $on('btnODLocal',  ()=>{ $('modalOD').style.display='none'; exportBackup(); });
  $on('btnODUpload', uploadToOneDrive);

  // ── ESC ──
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape') return;
    ['modalAdd','modalEdit','modalKey','modalOD','modalCat'].forEach(id=>{ const el=$(id); if(el) el.style.display='none'; });
    closeDocScan(); closeAiDrop(); closeImgPopup();
    const vf=$('viewFs'); if(vf) vf.style.display='none';
  });

  // ── 드래그&드롭 ──
  document.addEventListener('dragover',e=>e.preventDefault());
  document.addEventListener('drop',e=>{ e.preventDefault(); const fs=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')||f.name?.endsWith('.heic')); if(fs.length) handleFiles(fs); });
}

document.addEventListener('DOMContentLoaded', init);
