/* photos-scan.js  v8.0-20260616
   완전 재작성 — 누적 버그 없음
*/
'use strict';

/* ═══ 상수 ═══ */
const FIREBASE_PROJECT = 'my-system-25497';
const FIREBASE_KEY     = 'AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const LS_PHOTOS  = 'psc_photos';
const LS_CATS    = 'psc_cats';
const LS_API_KEY = 'psc_apikey';
const SCAN_SERVER= 'http://localhost:8080';
const DEFAULT_CATS = ['영수증','계약서','행정문서'];
const MODE = new URLSearchParams(location.search).get('mode')==='work' ? 'work' : 'personal';
const MODE_LABEL = MODE==='work' ? '📋 업무 스캔' : '📷 개인 스캔';
const MODE_COLOR = MODE==='work' ? '#2563EB' : '#7C3AED';

/* ═══ IndexedDB ═══ */
let idb = null;
function openIDB(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open('PhotoScanDB_'+MODE, 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('imgs',{keyPath:'id'});
    r.onsuccess = e => { idb=e.target.result; res(); };
    r.onerror = rej;
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
async function callAI(messages, maxTok=512){
  const key=localStorage.getItem(LS_API_KEY)||'';
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

function openAddModal(photoId=null){
  mEditId=photoId; mImgs=[]; mSlide=0;
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

async function handleFiles(files, append=false, autoScan=false){
  const results=[];
  for(const f of Array.from(files)){
    let blob=f;
    if(f.name?.toLowerCase().endsWith('.heic')||f.type==='image/heic'){ try{ blob=await heic2any({blob:f,toType:'image/jpeg',quality:0.92}); }catch(e){} }
    results.push({id:uid(), data:await blobToUrl(blob)});
  }
  if(append){ mImgs.push(...results); renderSlides(); return; }
  mImgs=[...results]; mSlide=0;
  if(autoScan&&results.length===1){ openAddModal(); setTimeout(()=>runDocScan(true),300); }
  else openAddModal();
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
      dsOrig=origI; dsZoom=1;
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
      dsOrig=oi; dsZoom=1;
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

/* ── 문서감지 풀스크린 ── */
function openDocScan(){
  const fs=$('docScanFs'); if(!fs||!dsOrig) return;
  // 핸들 inited 초기화
  for(let i=0;i<8;i++){ const h=$('dh'+i); if(h){ h._inited=false; } }
  fs.style.display='flex';
  requestAnimationFrame(renderDocScan);
}
function closeDocScan(){ $('docScanFs').style.display='none'; }

function renderDocScan(){
  const body=$('docScanBody'), cvs=$('docScanCanvas'), wrap=$('docScanWrap');
  if(!dsOrig||!cvs||!body) return;
  const bW=body.clientWidth||window.innerWidth;
  const bH=body.clientHeight||(window.innerHeight-100);
  const scale=Math.min(bW/dsOrig.width, bH/dsOrig.height)*dsZoom;
  dsScale=scale;
  const dw=Math.round(dsOrig.width*scale), dh=Math.round(dsOrig.height*scale);
  cvs.width=dw; cvs.height=dh;
  wrap.style.width=dw+'px'; wrap.style.height=dh+'px';
  const ctx=cvs.getContext('2d');
  ctx.drawImage(dsOrig,0,0,dw,dh);
  dsDrawLines(ctx,dw,dh);
  dsPlaceHandles(dw,dh);
}

function dsDrawLines(ctx,dw,dh){
  const p=dsCorners.map(c=>({x:Math.round(c.x*dsScale),y:Math.round(c.y*dsScale)}));
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.44)';
  ctx.beginPath(); ctx.rect(0,0,dw,dh);
  ctx.moveTo(p[0].x,p[0].y); p.forEach(c=>ctx.lineTo(c.x,c.y)); ctx.closePath();
  ctx.fill('evenodd');
  ctx.strokeStyle='#FFD700'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(p[0].x,p[0].y); p.forEach(c=>ctx.lineTo(c.x,c.y)); ctx.closePath(); ctx.stroke();
  ctx.restore();
}

function dsPlaceHandles(dw,dh){
  const p=dsCorners.map(c=>({x:Math.round(Math.max(0,Math.min(dw,c.x*dsScale))),y:Math.round(Math.max(0,Math.min(dh,c.y*dsScale)))}));
  const [tl,tr,br,bl]=p;
  // 모서리 4개
  [['dh0',tl,0],['dh1',tr,1],['dh2',br,2],['dh3',bl,3]].forEach(([id,pt,idx])=>{
    const h=$(id); if(!h) return;
    h.style.left=(pt.x-10)+'px'; h.style.top=(pt.y-10)+'px';
    if(!h._inited){ h._inited=true; dsCornerBind(h,idx,$('docScanCanvas'),dw,dh); }
  });
  // 막대 4개
  const mT={x:Math.round((tl.x+tr.x)/2)-20, y:Math.min(tl.y,tr.y)-5};
  const mB={x:Math.round((bl.x+br.x)/2)-20, y:Math.max(bl.y,br.y)-5};
  const mL={x:Math.min(tl.x,bl.x)-5, y:Math.round((tl.y+bl.y)/2)-20};
  const mR={x:Math.max(tr.x,br.x)-5, y:Math.round((tr.y+br.y)/2)-20};
  [['dh4',mT,'t'],['dh5',mB,'b'],['dh6',mL,'l'],['dh7',mR,'r']].forEach(([id,pt,type])=>{
    const h=$(id); if(!h) return;
    h.style.left=pt.x+'px'; h.style.top=pt.y+'px';
    if(type==='t'||type==='b'){ h.style.width='40px'; h.style.height='10px'; }
    else { h.style.width='10px'; h.style.height='40px'; }
    if(!h._inited){ h._inited=true; dsBarBind(h,type,$('docScanCanvas'),dw,dh); }
  });
}

function dsCanvasPos(ev,cvs){
  const r=cvs.getBoundingClientRect();
  return { x:Math.max(0,Math.min(cvs.width, ev.clientX-r.left)), y:Math.max(0,Math.min(cvs.height,ev.clientY-r.top)) };
}

function dsCornerBind(h,idx,cvs,dw,dh){
  h.style.touchAction='none';
  h.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation(); h.setPointerCapture(e.pointerId);
    const mv=ev=>{ ev.preventDefault(); const {x,y}=dsCanvasPos(ev,cvs); dsCorners[idx]={x:x/dsScale,y:y/dsScale}; dsRedraw(cvs,dw,dh); };
    const up=()=>{ h.removeEventListener('pointermove',mv); h.removeEventListener('pointerup',up); h.removeEventListener('pointercancel',up); };
    h.addEventListener('pointermove',mv,{passive:false}); h.addEventListener('pointerup',up); h.addEventListener('pointercancel',up);
  },{passive:false});
}

function dsBarBind(h,type,cvs,dw,dh){
  h.style.touchAction='none';
  h.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation(); h.setPointerCapture(e.pointerId);
    const mv=ev=>{ ev.preventDefault(); const {x,y}=dsCanvasPos(ev,cvs); const ox=x/dsScale,oy=y/dsScale;
      if(type==='t'){ dsCorners[0]={...dsCorners[0],y:oy}; dsCorners[1]={...dsCorners[1],y:oy}; }
      if(type==='b'){ dsCorners[2]={...dsCorners[2],y:oy}; dsCorners[3]={...dsCorners[3],y:oy}; }
      if(type==='l'){ dsCorners[0]={...dsCorners[0],x:ox}; dsCorners[3]={...dsCorners[3],x:ox}; }
      if(type==='r'){ dsCorners[1]={...dsCorners[1],x:ox}; dsCorners[2]={...dsCorners[2],x:ox}; }
      dsRedraw(cvs,dw,dh);
    };
    const up=()=>{ h.removeEventListener('pointermove',mv); h.removeEventListener('pointerup',up); h.removeEventListener('pointercancel',up); };
    h.addEventListener('pointermove',mv,{passive:false}); h.addEventListener('pointerup',up); h.addEventListener('pointercancel',up);
  },{passive:false});
}

function dsRedraw(cvs,dw,dh){
  const ctx=cvs.getContext('2d'); ctx.clearRect(0,0,dw,dh); ctx.drawImage(dsOrig,0,0,dw,dh);
  dsDrawLines(ctx,dw,dh); dsPlaceHandles(dw,dh);
}

async function applyDocScan(){
  if(!dsCorners.length||!mImgs[mSlide]){ toast('감지된 문서가 없습니다'); return; }
  const src=mImgs[mSlide].data; const s=sortCorners(dsCorners);
  const xs=s.map(p=>p.x),ys=s.map(p=>p.y);
  const sx=Math.max(0,Math.min(...xs)), sy=Math.max(0,Math.min(...ys));
  const sw=Math.max(20,Math.max(...xs)-sx), sh=Math.max(20,Math.max(...ys)-sy);
  // 서버 warp 시도
  let result;
  try{
    const alive=await serverAlive();
    if(alive){
      const r=await fetch(SCAN_SERVER+'/api/scan/warp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:src,corners:s.map(p=>[p.x,p.y])}),signal:AbortSignal.timeout(15000)});
      if(r.ok){ const d=await r.json(); if(!d.error) result=d.result; }
    }
  }catch(e){}
  if(!result) result=await cropPx(src,Math.round(sx),Math.round(sy),Math.round(sw),Math.round(sh));
  mImgs[mSlide]={id:mImgs[mSlide].id||uid(), data:result};
  closeDocScan(); renderSlides();
  $('aiStatus').textContent='✅ 크롭 완료';
  toast('✅ 문서 크롭 완료!');
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
  $('cropOv').style.display=t==='crop'?'block':'none';
  if(!canvas) return;
  canvas.isDrawingMode=false; canvas.selection=true; canvas.defaultCursor='default';
  if(t==='draw'){
    canvas.isDrawingMode=true;
    canvas.freeDrawingBrush.width=parseInt($('tSize').value);
    canvas.freeDrawingBrush.color=$('tColor').value;
  } else if(t==='crop'){
    canvas.selection=false;
    // 크롭 박스 초기화
    const cw=canvas.width, ch=canvas.height, pad=Math.round(Math.min(cw,ch)*0.07);
    const box=$('cropBox');
    box.style.left=pad+'px'; box.style.top=pad+'px';
    box.style.width=(cw-pad*2)+'px'; box.style.height=(ch-pad*2)+'px';
    initCropDrag();
  } else if(t==='mosaic'){
    canvas.selection=false; canvas.defaultCursor='crosshair';
  }
}

/* ── 크롭 드래그 ── */
let cBox={x:0,y:0,w:0,h:0}, cDrag=null, cSX=0, cSY=0, cSB=null;

function initCropDrag(){
  const ov=$('cropOv'); if(!ov||ov._inited) return; ov._inited=true;
  ov.addEventListener('pointerdown',e=>{
    let h=null, el=e.target;
    while(el&&el!==ov){ const dh=el.getAttribute&&el.getAttribute('data-h'); if(dh){h=dh;break;} el=el.parentElement; }
    if(!h){
      const box=$('cropBox'); const br=box.getBoundingClientRect();
      const inBox=e.clientX>=br.left&&e.clientX<=br.right&&e.clientY>=br.top&&e.clientY<=br.bottom;
      if(!inBox) return;
      h='move';
    }
    cDrag=h; cSX=e.clientX; cSY=e.clientY;
    const box=$('cropBox');
    cSB={x:parseInt(box.style.left)||0, y:parseInt(box.style.top)||0, w:parseInt(box.style.width)||0, h:parseInt(box.style.height)||0};
    try{ ov.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  },{passive:false});
  ov.addEventListener('pointermove',e=>{
    if(!cDrag) return;
    const dx=e.clientX-cSX, dy=e.clientY-cSY;
    const W=canvas.width, H=canvas.height;
    let {x,y,w,h}=cSB;
    if(cDrag==='move'){ x=Math.max(0,Math.min(cSB.x+dx,W-cSB.w)); y=Math.max(0,Math.min(cSB.y+dy,H-cSB.h)); }
    else {
      if(cDrag.includes('l')){ x=cSB.x+dx; w=cSB.w-dx; }
      if(cDrag.includes('r')){ w=cSB.w+dx; }
      if(cDrag.includes('t')){ y=cSB.y+dy; h=cSB.h-dy; }
      if(cDrag.includes('b')){ h=cSB.h+dy; }
      if(w<30){if(cDrag.includes('l')){x=cSB.x+cSB.w-30;}w=30;}
      if(h<30){if(cDrag.includes('t')){y=cSB.y+cSB.h-30;}h=30;}
      if(x<0){w+=x;x=0;} if(y<0){h+=y;y=0;}
      if(x+w>W) w=W-x; if(y+h>H) h=H-y;
    }
    const box=$('cropBox');
    box.style.left=x+'px'; box.style.top=y+'px'; box.style.width=w+'px'; box.style.height=h+'px';
    e.preventDefault();
  },{passive:false});
  ov.addEventListener('pointerup',  ()=>{cDrag=null;});
  ov.addEventListener('pointercancel',()=>{cDrag=null;});
}

function applyCrop(){
  const box=$('cropBox');
  const x=parseInt(box.style.left)||0, y=parseInt(box.style.top)||0;
  const w=parseInt(box.style.width)||0, h=parseInt(box.style.height)||0;
  if(w<10||h<10){toast('크롭 영역이 너무 작아요');return;}
  const full=canvas.toDataURL({format:'jpeg',quality:0.96});
  const tmp=new Image();
  tmp.onload=()=>{
    const c=document.createElement('canvas'); c.width=w; c.height=h;
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
    burstImgs.push({id:uid(),data:await blobToUrl(blob)});
  }
  renderBurst();
}
function burstDone(){ if(!burstImgs.length) return; $('burstOv').style.display='none'; mImgs=[...burstImgs]; mSlide=0; burstImgs=[]; openAddModal(); }
function burstCancel(){ burstImgs=[]; $('burstOv').style.display='none'; }

/* ═══ INIT ═══ */
async function init(){
  await openIDB(); loadData();
  // 버전/모드
  if($('appTitle')) $('appTitle').textContent=MODE_LABEL;
  if($('appVersion')) $('appVersion').textContent='v8.0';
  document.title=MODE_LABEL;
  const bar=document.createElement('div');
  bar.style.cssText=`position:fixed;top:0;left:0;right:0;height:3px;background:${MODE_COLOR};z-index:200;`;
  document.body.appendChild(bar);

  renderChips(); renderGallery(); populateCatSel(); renderCatList();

  // ── 헤더 ──
  $on('btnHome',    ()=>location.href='index.html');
  $on('btnBackup',  ()=>{ $('modalOD').style.display='flex'; });
  $on('btnApiKey',  ()=>{ $('apiKeyInp').value=localStorage.getItem(LS_API_KEY)||''; $('modalKey').style.display='flex'; });
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
  $on('btnAiCrop',   ()=>runDocScan(false));
  $on('btnSave',     savePhoto);
  $on('btnEdit',     openEditor);
  $on('btnCatAdd2',  ()=>{ const n=prompt('새 카테고리'); if(n) addCat(n); });
  $on('btnCatDel2',  ()=>{ const v=$('fCat')?.value; if(!v) return; if(!confirm(`"${v}" 삭제?`)) return; cats=cats.filter(c=>c!==v); saveCats(); populateCatSel(); renderChips(); toast('삭제됨'); });

  // ── 편집 모달 ──
  $on('btnEditClose', ()=>{ $('modalEdit').style.display='none'; $('modalAdd').style.display='flex'; });
  $on('btnEditDone',  finishEdit);
  $on('btnUndo',      popHist);
  document.querySelectorAll('.tbtn[data-t]').forEach(b=>{ b.onclick=()=>{ const t=b.dataset.t; if(t==='rect') addShape('rect'); else if(t==='circle') addShape('circle'); else if(t==='arrow') addArrow(); else setTool(t); }; });
  $('tColor') && ($('tColor').onchange=()=>{ if(canvas&&canvas.isDrawingMode) canvas.freeDrawingBrush.color=$('tColor').value; });
  $('tSize')  && ($('tSize').onchange =()=>{ if(canvas&&canvas.isDrawingMode) canvas.freeDrawingBrush.width=parseInt($('tSize').value); });
  $on('btnDelObj',    ()=>{ if(canvas){ const objs=canvas.getActiveObjects(); objs.forEach(o=>canvas.remove(o)); canvas.discardActiveObject(); canvas.renderAll(); }});
  $on('btnRotL',      ()=>rotateImg(-90));
  $on('btnRotR',      ()=>rotateImg(90));
  $on('btnCropApply', applyCrop);
  $on('btnCropCancel',()=>setTool('select'));
  $on('btnAddTxt',    addText);
  $('textInp') && ($('textInp').onkeydown=e=>{ if(e.key==='Enter') addText(); });

  // ── 문서감지 ──
  $on('btnDsClose',  closeDocScan);
  $on('btnDsRetry',  ()=>{ closeDocScan(); runDocScan(false); });
  $on('btnDsApply',  applyDocScan);
  $on('btnDsZoomIn', ()=>{ dsZoom=Math.min(dsZoom*1.4,4); for(let i=0;i<8;i++){ const h=$('dh'+i); if(h) h._inited=false; } renderDocScan(); });
  $on('btnDsZoomOut',()=>{ dsZoom=Math.max(dsZoom/1.4,0.5); for(let i=0;i<8;i++){ const h=$('dh'+i); if(h) h._inited=false; } renderDocScan(); });

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
  $on('btnKeySave',  ()=>{ localStorage.setItem(LS_API_KEY,$('apiKeyInp').value.trim()); $('modalKey').style.display='none'; toast('API 키 저장'); });

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
