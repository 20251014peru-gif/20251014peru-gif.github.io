/* photos-scan.js  v2.0-20260616b
   수정: 카메라/갤러리 분리, 모자이크크기, 툴아이콘크게,
         AI크롭오류수정, 카테고리인라인추가삭제, 카메라검은화면수정,
         유형드롭다운, 공유기능, 카드수정삭제버튼
*/
'use strict';

const FIREBASE_PROJECT = 'my-system-25497';
const FIREBASE_API_KEY = 'AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const LS_PHOTOS  = 'photoscan_photos';
const LS_CATS    = 'photoscan_categories';
const LS_API_KEY = 'photoscan_anthropic_key';

/* ── IndexedDB ── */
let idb = null;
function openIDB(){
  return new Promise((res,rej)=>{
    const req=indexedDB.open('PhotoScanDB',1);
    req.onupgradeneeded=e=>e.target.result.createObjectStore('images',{keyPath:'id'});
    req.onsuccess=e=>{idb=e.target.result;res(idb);};
    req.onerror=rej;
  });
}
function idbPut(id,dataUrl){return new Promise((res,rej)=>{const tx=idb.transaction('images','readwrite');tx.objectStore('images').put({id,dataUrl});tx.oncomplete=res;tx.onerror=rej;});}
function idbGet(id){return new Promise((res,rej)=>{const tx=idb.transaction('images','readonly');const req=tx.objectStore('images').get(id);req.onsuccess=e=>res(e.target.result?e.target.result.dataUrl:null);req.onerror=rej;});}
function idbDelete(id){return new Promise((res,rej)=>{const tx=idb.transaction('images','readwrite');tx.objectStore('images').delete(id);tx.oncomplete=res;tx.onerror=rej;});}
function idbGetAll(){return new Promise((res,rej)=>{const tx=idb.transaction('images','readonly');const req=tx.objectStore('images').getAll();req.onsuccess=e=>res(e.target.result);req.onerror=rej;});}

/* ── State ── */
let photos=[], categories=[], currentFilter='all', currentSearch='';

function loadData(){
  try{photos=JSON.parse(localStorage.getItem(LS_PHOTOS)||'[]');}catch{photos=[];}
  try{categories=JSON.parse(localStorage.getItem(LS_CATS)||'["개인","업무","기타"]');}catch{categories=['개인','업무','기타'];}
}
function savePhotos(){localStorage.setItem(LS_PHOTOS,JSON.stringify(photos));}
function saveCategories(){localStorage.setItem(LS_CATS,JSON.stringify(categories));}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function today(){return new Date().toISOString().slice(0,10);}

/* ── Toast ── */
let toastTimer=null;
function showToast(msg,dur=2500){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),dur);
}

/* ── 모달 ── */
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}

/* ── 사이드 메뉴 ── */
function openSideMenu(){document.getElementById('sideMenu').classList.add('open');document.getElementById('sideOverlay').classList.add('open');}
function closeSideMenu(){document.getElementById('sideMenu').classList.remove('open');document.getElementById('sideOverlay').classList.remove('open');}

/* ── 카테고리 필터칩 ── */
function renderFilterChips(){
  const area=document.getElementById('filterChips');
  area.innerHTML='';
  const all=document.createElement('button');
  all.className='chip'+(currentFilter==='all'?' active':'');
  all.dataset.cat='all';all.textContent='전체';
  all.onclick=()=>{currentFilter='all';renderFilterChips();renderGallery();};
  area.appendChild(all);
  categories.forEach(c=>{
    const b=document.createElement('button');
    b.className='chip'+(currentFilter===c?' active':'');
    b.dataset.cat=c;b.textContent=c;
    b.onclick=()=>{currentFilter=c;renderFilterChips();renderGallery();};
    area.appendChild(b);
  });
}

/* ── 갤러리 렌더 ── */
async function renderGallery(){
  const grid=document.getElementById('photoGrid');
  const empty=document.getElementById('emptyState');
  const q=currentSearch.toLowerCase();
  const list=photos.filter(p=>{
    const mc=currentFilter==='all'||p.cat===currentFilter;
    const mt=!q||(p.title||'').toLowerCase().includes(q)||(p.memo||'').toLowerCase().includes(q);
    return mc&&mt;
  }).sort((a,b)=>b.id.localeCompare(a.id));

  grid.querySelectorAll('.photo-card').forEach(c=>c.remove());
  empty.style.display=list.length?'none':'';

  for(const p of list){
    const card=document.createElement('div');
    card.className='photo-card';card.dataset.id=p.id;

    const imgWrap=document.createElement('div');
    imgWrap.className='card-img-wrap';
    const img=document.createElement('img');
    img.className='card-img';img.alt=p.title||'';
    imgWrap.appendChild(img);

    if(p.type&&p.type!=='일반'){
      const tb=document.createElement('span');
      tb.className='card-type-badge';
      const icons={'영수증':'🧾','계약서':'📄','문서':'📋'};
      tb.textContent=(icons[p.type]||'')+' '+p.type;
      imgWrap.appendChild(tb);
    }
    if((p.imgIds||[]).length>1){
      const mb=document.createElement('span');
      mb.className='card-multi';mb.textContent='×'+p.imgIds.length;
      imgWrap.appendChild(mb);
    }

    // 수정/삭제 액션
    const actions=document.createElement('div');
    actions.className='card-actions';
    actions.innerHTML=`<button class="card-act-btn edit">✏️ 수정</button><button class="card-act-btn del">🗑 삭제</button>`;
    actions.querySelector('.edit').onclick=e=>{e.stopPropagation();openEditMetaModal(p.id);};
    actions.querySelector('.del').onclick=e=>{e.stopPropagation();deletePhoto(p.id);};
    imgWrap.appendChild(actions);

    const firstId=(p.imgIds||[])[0];
    if(firstId) idbGet(firstId).then(url=>{if(url)img.src=url;});

    const body=document.createElement('div');
    body.className='card-body';
    body.innerHTML=`<div class="card-title">${p.title||'(제목 없음)'}</div>
      <div class="card-meta"><span class="badge">${p.cat||'일반'}</span><span class="card-date">${(p.date||'').slice(5)}</span></div>`;

    card.appendChild(imgWrap);card.appendChild(body);
    card.addEventListener('click',()=>openViewModal(p.id));
    grid.insertBefore(card,empty);
  }
}

/* ── 카테고리 관리 모달 ── */
function openCatModal(){
  renderCatList();openModal('modalCat');
}
function renderCatList(){
  const ul=document.getElementById('catList');
  ul.innerHTML='';
  categories.forEach((c,i)=>{
    const li=document.createElement('li');
    li.className='cat-item';
    li.innerHTML=`<span class="cat-name">${c}</span><button title="삭제">🗑</button>`;
    li.querySelector('button').onclick=()=>{
      if(confirm(`"${c}" 카테고리를 삭제할까요?`)){
        categories.splice(i,1);saveCategories();
        renderCatList();renderFilterChips();
        populateCatSelect();
      }
    };
    ul.appendChild(li);
  });
}

/* ── 사진 추가/수정 모달 ── */
let modalImages=[], modalSlide=0, editingPhotoId=null;

function openAddModal(preImages=[]){
  editingPhotoId=null;
  modalImages=preImages;modalSlide=0;
  document.getElementById('modalAddTitle').textContent='사진 추가';
  document.getElementById('photoTitle').value='';
  document.getElementById('photoMemo').value='';
  document.getElementById('photoDate').value=today();
  document.getElementById('photoType').value='일반';
  document.getElementById('aiCropStatus').textContent='';
  populateCatSelect();
  renderModalSlides();
  openModal('modalAdd');
}

async function openEditMetaModal(pid){
  const p=photos.find(x=>x.id===pid);if(!p)return;
  editingPhotoId=pid;modalImages=[];modalSlide=0;
  document.getElementById('modalAddTitle').textContent='사진 수정';
  document.getElementById('photoTitle').value=p.title||'';
  document.getElementById('photoMemo').value=p.memo||'';
  document.getElementById('photoDate').value=p.date||today();
  document.getElementById('photoType').value=p.type||'일반';
  document.getElementById('aiCropStatus').textContent='';
  populateCatSelect(p.cat);
  const imgs=await Promise.all((p.imgIds||[]).map(id=>idbGet(id).then(url=>({id,dataUrl:url}))));
  modalImages=imgs.filter(x=>x.dataUrl);
  renderModalSlides();
  openModal('modalAdd');
}

function populateCatSelect(selected){
  const sel=document.getElementById('photoCat');
  sel.innerHTML=categories.map(c=>`<option value="${c}"${c===selected?' selected':''}>${c}</option>`).join('');
}

function renderModalSlides(){
  const wrap=document.getElementById('imgSlides');
  wrap.innerHTML='';
  if(!modalImages.length){
    wrap.innerHTML='<div class="no-img-placeholder">사진 없음</div>';
    document.getElementById('slideCount').textContent='0 / 0';
    return;
  }
  modalImages.forEach((m,i)=>{
    const img=document.createElement('img');
    img.src=m.dataUrl;img.alt='';
    if(i===modalSlide)img.classList.add('active');
    wrap.appendChild(img);
  });
  document.getElementById('slideCount').textContent=`${modalSlide+1} / ${modalImages.length}`;
}
function goSlide(dir){
  if(!modalImages.length)return;
  modalSlide=(modalSlide+dir+modalImages.length)%modalImages.length;
  renderModalSlides();
}

async function savePhoto(){
  const title=document.getElementById('photoTitle').value.trim();
  const cat=document.getElementById('photoCat').value;
  const memo=document.getElementById('photoMemo').value.trim();
  const date=document.getElementById('photoDate').value||today();
  const type=document.getElementById('photoType').value;
  if(!modalImages.length){showToast('사진을 1장 이상 추가하세요');return;}
  if(!title){showToast('제목을 입력하세요');return;}

  if(editingPhotoId){
    const p=photos.find(x=>x.id===editingPhotoId);if(!p)return;
    await Promise.all((p.imgIds||[]).map(id=>idbDelete(id)));
    const newIds=[];
    for(const m of modalImages){const nid=m.id||uid();await idbPut(nid,m.dataUrl);newIds.push(nid);}
    p.title=title;p.cat=cat;p.memo=memo;p.date=date;p.type=type;p.imgIds=newIds;
  } else {
    const pid=uid();const imgIds=[];
    for(const m of modalImages){const iid=uid();await idbPut(iid,m.dataUrl);imgIds.push(iid);}
    photos.unshift({id:pid,title,cat,memo,date,type,imgIds});
  }
  savePhotos();closeModal('modalAdd');renderGallery();showToast('저장되었습니다');
}

/* ── 파일 처리 ── */
async function handleFiles(files,append=false){
  const results=[];
  for(const f of Array.from(files)){
    let blob=f;
    if(f.name.toLowerCase().endsWith('.heic')||f.type==='image/heic'){
      try{blob=await heic2any({blob:f,toType:'image/jpeg',quality:0.92});}catch(e){console.warn(e);}
    }
    results.push({id:uid(),dataUrl:await blobToDataUrl(blob)});
  }
  if(append){modalImages.push(...results);renderModalSlides();}
  else openAddModal(results);
}
function blobToDataUrl(blob){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(blob);});}

/* ── 상세 보기 ── */
let viewPhotoId=null,viewSlide=0,viewImgIds=[];
async function openViewModal(pid){
  const p=photos.find(x=>x.id===pid);if(!p)return;
  viewPhotoId=pid;viewSlide=0;viewImgIds=p.imgIds||[];
  document.getElementById('viewTitle').textContent=p.title||'(제목 없음)';
  document.getElementById('viewCat').textContent=p.cat||'일반';
  document.getElementById('viewType').textContent=p.type||'일반';
  document.getElementById('viewDate').textContent=p.date||'';
  document.getElementById('viewMemo').textContent=p.memo||'';
  await updateViewImg();
  openModal('modalView');
}
async function updateViewImg(){
  const url=viewImgIds[viewSlide]?await idbGet(viewImgIds[viewSlide]):null;
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
  if(!confirm('이 사진을 삭제할까요?'))return;
  const idx=photos.findIndex(x=>x.id===pid);if(idx<0)return;
  await Promise.all((photos[idx].imgIds||[]).map(id=>idbDelete(id)));
  photos.splice(idx,1);savePhotos();
  closeModal('modalView');renderGallery();showToast('삭제되었습니다');
}

/* ── 공유 ── */
async function sharePhoto(){
  const url=document.getElementById('viewImg').src;
  if(!url){showToast('사진이 없습니다');return;}
  try{
    const res=await fetch(url);const blob=await res.blob();
    const file=new File([blob],'photo.jpg',{type:'image/jpeg'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:document.getElementById('viewTitle').textContent});
    } else {
      // fallback: 다운로드
      const a=document.createElement('a');a.href=url;a.download='photo.jpg';a.click();
      showToast('공유 미지원 — 다운로드로 저장했습니다');
    }
  } catch(e){
    if(e.name!=='AbortError') showToast('공유 중 오류: '+e.message);
  }
}

/* ── AI 문서 크롭 ── */
async function aiDocCrop(){
  if(!modalImages.length){showToast('먼저 사진을 추가하세요');return;}
  const key=localStorage.getItem(LS_API_KEY)||'';
  if(!key){showToast('AI API 키를 먼저 설정하세요');return;}

  const statusEl=document.getElementById('aiCropStatus');
  const btn=document.getElementById('btnAiCrop');
  statusEl.textContent='🤖 AI 분석 중...';btn.disabled=true;

  try{
    const m=modalImages[modalSlide];
    // dataUrl에서 base64와 mediaType 분리
    const parts=m.dataUrl.split(';base64,');
    if(parts.length!==2) throw new Error('이미지 형식 오류');
    const mtype=parts[0].replace('data:','');
    const base64=parts[1];

    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':key,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'
      },
      body:JSON.stringify({
        model:'claude-sonnet-4-6',
        max_tokens:256,
        messages:[{
          role:'user',
          content:[
            {type:'image',source:{type:'base64',media_type:mtype,data:base64}},
            {type:'text',text:'이미지에서 문서(영수증, 계약서, 종이문서 등)의 위치를 찾아주세요. 문서가 있으면 {"hasDoc":true,"x":0.1,"y":0.05,"w":0.8,"h":0.9} 형태로 0~1 비율 좌표를 반환하세요. 없으면 {"hasDoc":false}. 반드시 JSON만 반환하세요.'}
          ]
        }]
      })
    });

    if(!resp.ok) throw new Error(`API 오류 ${resp.status}`);
    const data=await resp.json();
    if(data.error) throw new Error(data.error.message||'API 오류');

    const text=(data.content||[]).map(b=>b.text||'').join('').trim();
    const jsonStr=text.replace(/```json|```/g,'').trim();
    const json=JSON.parse(jsonStr);

    if(!json.hasDoc){
      statusEl.textContent='✓ 문서를 찾지 못했습니다 (일반 사진으로 저장)';
      return;
    }
    // 크롭
    const x=Math.max(0,Math.min(json.x,0.99));
    const y=Math.max(0,Math.min(json.y,0.99));
    const w=Math.max(0.05,Math.min(json.w,1-x));
    const h=Math.max(0.05,Math.min(json.h,1-y));
    const cropped=await cropImageDataUrl(m.dataUrl,x,y,w,h);
    modalImages[modalSlide].dataUrl=cropped;
    renderModalSlides();
    statusEl.textContent='✅ 문서 영역이 자동으로 잘렸습니다';
    // 유형도 자동 설정
    if(document.getElementById('photoType').value==='일반')
      document.getElementById('photoType').value='문서';
  } catch(e){
    console.error('AI Crop Error:',e);
    statusEl.textContent='⚠️ 오류: '+e.message;
  } finally{
    btn.disabled=false;
  }
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
  const query=document.getElementById('aiSearchQuery').value.trim();
  if(!query)return;
  const key=localStorage.getItem(LS_API_KEY)||'';
  if(!key){showToast('AI API 키를 먼저 설정하세요');return;}
  const resultEl=document.getElementById('aiSearchResult');
  resultEl.innerHTML='<div class="loading">검색 중</div>';
  const index=photos.map(p=>({id:p.id,title:p.title,cat:p.cat,type:p.type,memo:p.memo,date:p.date}));
  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:'claude-sonnet-4-6',max_tokens:1024,
        messages:[{role:'user',content:`사진 목록:\n${JSON.stringify(index)}\n\n검색: "${query}"\n\n관련 사진을 JSON 배열로 반환: [{"id":"xxx","reason":"이유"},...]. JSON만 반환.`}]
      })
    });
    const data=await resp.json();
    const text=(data.content||[]).map(b=>b.text||'').join('').replace(/```json|```/g,'').trim();
    const found=JSON.parse(text);
    if(!found.length){resultEl.innerHTML='<p style="color:#aaa;font-size:14px">관련 사진을 찾지 못했습니다.</p>';return;}
    resultEl.innerHTML='';
    for(const r of found){
      const p=photos.find(x=>x.id===r.id);if(!p)continue;
      const card=document.createElement('div');card.className='result-card';
      card.innerHTML=`<div class="result-title">${p.title||'(제목 없음)'}</div><div class="result-meta">${p.type||''} · ${p.cat||''} · ${p.date||''}</div><div class="result-reason">${r.reason}</div>`;
      card.onclick=()=>{document.getElementById('panelSearch').classList.remove('open');openViewModal(p.id);};
      resultEl.appendChild(card);
    }
  } catch(e){resultEl.innerHTML='<p style="color:red;font-size:13px">오류: '+e.message+'</p>';}
}

/* ── 백업 ── */
async function exportBackup(){
  showToast('백업 파일 생성 중...');
  const allImages=await idbGetAll();
  const blob=new Blob([JSON.stringify({photos,categories,images:allImages},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`photoscan-backup-${today()}.json`;a.click();
  showToast('백업 완료');
}
async function importBackup(file){
  try{
    const data=JSON.parse(await file.text());
    if(!data.photos||!data.images){showToast('올바른 백업 파일이 아닙니다');return;}
    if(!confirm(`백업 불러오기 — 현재 데이터가 대체됩니다.\n사진 ${data.photos.length}개`))return;
    for(const img of data.images)await idbPut(img.id,img.dataUrl);
    photos=data.photos;categories=data.categories||categories;
    savePhotos();saveCategories();renderFilterChips();renderGallery();renderCatList();
    showToast('백업 불러오기 완료');
  } catch(e){showToast('파일 읽기 오류');}
}
async function firebaseBackupMeta(){
  try{
    await fetch(`${FS_BASE}/photoscan/photoscan-meta?key=${FIREBASE_API_KEY}`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({fields:{photos:{stringValue:JSON.stringify(photos)},categories:{stringValue:JSON.stringify(categories)},updatedAt:{stringValue:new Date().toISOString()}}})
    });
    showToast('☁️ 클라우드 백업 완료');
  } catch(e){showToast('클라우드 백업 실패');}
}

/* ── Fabric.js 편집기 ── */
let canvas=null, editImgId=null, editTool='select', cropRect=null;

function openEditor(){
  if(!modalImages.length){showToast('사진을 먼저 추가하세요');return;}
  const m=modalImages[modalSlide];
  editImgId=m.id;
  closeModal('modalAdd');
  openModal('modalEdit');
  setTimeout(()=>initCanvas(m.dataUrl),100);
}

function initCanvas(dataUrl){
  const wrapper=document.getElementById('canvasWrapper');
  const maxW=Math.min(wrapper.clientWidth-24,680);
  const maxH=Math.min(wrapper.clientHeight-24,520);

  if(canvas){canvas.dispose();canvas=null;}
  canvas=new fabric.Canvas('editCanvas',{selection:true});

  fabric.Image.fromURL(dataUrl,img=>{
    const scale=Math.min(maxW/img.width,maxH/img.height,1);
    const cw=Math.round(img.width*scale);
    const ch=Math.round(img.height*scale);
    canvas.setWidth(cw);canvas.setHeight(ch);
    img.set({scaleX:scale,scaleY:scale,selectable:false,evented:false});
    canvas.setBackgroundImage(img,canvas.renderAll.bind(canvas));
    // 모자이크 클릭 이벤트
    canvas.on('mouse:down',opt=>{
      if(editTool==='mosaic') applyMosaic(opt);
    });
  },{crossOrigin:'anonymous'});
  setTool('select');
}

function setTool(tool){
  editTool=tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  document.getElementById('cropControls').classList.add('hidden');
  document.getElementById('textInputRow').classList.add('hidden');
  document.getElementById('mosaicSizeLabel').style.display='none';
  document.getElementById('mosaicSize').style.display='none';
  if(!canvas)return;
  canvas.isDrawingMode=false;
  if(tool==='draw'){
    canvas.isDrawingMode=true;
    canvas.freeDrawingBrush.width=parseInt(document.getElementById('toolSize').value);
    canvas.freeDrawingBrush.color=document.getElementById('toolColor').value;
  } else if(tool==='crop'){
    document.getElementById('cropControls').classList.remove('hidden');
    startCropMode();
  } else if(tool==='text'){
    document.getElementById('textInputRow').classList.remove('hidden');
  } else if(tool==='mosaic'){
    document.getElementById('mosaicSizeLabel').style.display='';
    document.getElementById('mosaicSize').style.display='';
    canvas.defaultCursor='crosshair';
  }
}

function startCropMode(){
  if(cropRect)canvas.remove(cropRect);
  cropRect=new fabric.Rect({
    left:30,top:30,width:canvas.width-60,height:canvas.height-60,
    fill:'rgba(0,0,0,0)',stroke:'#3F7CB8',strokeWidth:2,
    strokeDashArray:[6,4],cornerColor:'#3F7CB8',cornerSize:12,transparentCorners:false
  });
  canvas.add(cropRect);canvas.setActiveObject(cropRect);canvas.renderAll();
}

function applyCrop(){
  if(!cropRect)return;
  const cw=canvas.width,ch=canvas.height;
  const rx=cropRect.left/cw, ry=cropRect.top/ch;
  const rw=(cropRect.width*cropRect.scaleX)/cw;
  const rh=(cropRect.height*cropRect.scaleY)/ch;
  const dataUrl=canvas.toDataURL({format:'jpeg',quality:0.92});
  cropImageDataUrl(dataUrl,rx,ry,rw,rh).then(cropped=>{
    initCanvas(cropped);
    // 현재 편집 중인 이미지에 반영
    if(editImgId){const idx=modalImages.findIndex(m=>m.id===editImgId);if(idx>=0)modalImages[idx].dataUrl=cropped;}
    document.getElementById('cropControls').classList.add('hidden');
    cropRect=null;
  });
}

function addText(){
  const txt=document.getElementById('textInput').value;if(!txt)return;
  const t=new fabric.Text(txt,{
    left:40,top:40,fill:document.getElementById('toolColor').value,
    fontSize:parseInt(document.getElementById('toolSize').value)*5+14,
    fontFamily:'Arial',fontWeight:'bold'
  });
  canvas.add(t);canvas.setActiveObject(t);canvas.renderAll();
  document.getElementById('textInput').value='';
}

function addShape(type){
  const color=document.getElementById('toolColor').value;
  const sw=parseInt(document.getElementById('toolSize').value);
  const shape=type==='rect'
    ? new fabric.Rect({left:60,top:60,width:140,height:90,fill:'transparent',stroke:color,strokeWidth:sw})
    : new fabric.Ellipse({left:60,top:60,rx:70,ry:45,fill:'transparent',stroke:color,strokeWidth:sw});
  canvas.add(shape);canvas.setActiveObject(shape);canvas.renderAll();
}

function applyMosaic(opt){
  const pt=canvas.getPointer(opt.e);
  const sz=parseInt(document.getElementById('mosaicSize').value)||40;
  // 해당 영역의 픽셀을 읽어 평균색 계산
  const tempCanvas=document.createElement('canvas');
  const bg=canvas.backgroundImage;
  if(!bg){return;}
  const bgImg=bg.getElement();
  const scaleX=bg.scaleX||1, scaleY=bg.scaleY||1;
  const srcX=Math.round((pt.x-sz/2)/scaleX), srcY=Math.round((pt.y-sz/2)/scaleY);
  const srcW=Math.round(sz/scaleX), srcH=Math.round(sz/scaleY);
  tempCanvas.width=srcW;tempCanvas.height=srcH;
  const ctx=tempCanvas.getContext('2d');
  ctx.drawImage(bgImg,srcX,srcY,srcW,srcH,0,0,srcW,srcH);
  // 픽셀화 효과: 작게 그린 후 다시 크게 그림
  const pxC=document.createElement('canvas');
  const pixelBlock=Math.max(4,Math.round(sz/8));
  pxC.width=pixelBlock;pxC.height=pixelBlock;
  const pxCtx=pxC.getContext('2d');
  pxCtx.drawImage(tempCanvas,0,0,pixelBlock,pixelBlock);
  const dataUrl=pxC.toDataURL();
  fabric.Image.fromURL(dataUrl,mImg=>{
    mImg.set({left:pt.x-sz/2,top:pt.y-sz/2,width:sz,height:sz,scaleX:1,scaleY:1,selectable:false,evented:false});
    canvas.add(mImg);canvas.renderAll();
  });
}

function finishEdit(){
  if(!canvas)return;
  const dataUrl=canvas.toDataURL({format:'jpeg',quality:0.92});
  const idx=modalImages.findIndex(m=>m.id===editImgId);
  if(idx>=0)modalImages[idx].dataUrl=dataUrl;
  closeModal('modalEdit');
  openModal('modalAdd');
  renderModalSlides();
}

/* ── 초기화 & 이벤트 ── */
async function init(){
  await openIDB();
  loadData();
  renderFilterChips();
  renderGallery();
  populateCatSelect();

  // 헤더
  document.getElementById('btnMenu').onclick=openSideMenu;
  document.getElementById('sideOverlay').onclick=closeSideMenu;
  document.getElementById('btnMenuClose').onclick=closeSideMenu;
  document.getElementById('btnSearch').onclick=()=>document.getElementById('panelSearch').classList.add('open');
  document.getElementById('btnBackup').onclick=firebaseBackupMeta;
  document.getElementById('btnSettings').onclick=()=>openModal('modalApiKey');

  // 사이드 메뉴
  document.getElementById('mnuApiKey').onclick=()=>{closeSideMenu();openModal('modalApiKey');};
  document.getElementById('mnuBackupExport').onclick=()=>{closeSideMenu();exportBackup();};
  document.getElementById('mnuBackupImport').onclick=()=>{closeSideMenu();document.getElementById('backupInput').click();};

  // 카메라 / 갤러리 버튼 (메인)
  document.getElementById('btnCamera').onclick=()=>document.getElementById('fileInputCamera').click();
  document.getElementById('btnGallery').onclick=()=>document.getElementById('fileInputGallery').click();
  document.getElementById('fileInputCamera').onchange=e=>{if(e.target.files.length)handleFiles(e.target.files);e.target.value='';};
  document.getElementById('fileInputGallery').onchange=e=>{if(e.target.files.length)handleFiles(e.target.files);e.target.value='';};

  // 검색
  document.getElementById('gallerySearch').oninput=e=>{currentSearch=e.target.value;renderGallery();};

  // 카테고리 관리
  document.getElementById('btnCatManage').onclick=openCatModal;
  document.getElementById('btnCatClose').onclick=()=>closeModal('modalCat');
  document.getElementById('btnCatAdd').onclick=()=>{
    const name=document.getElementById('catNewName').value.trim();
    if(!name)return;
    if(categories.includes(name)){showToast('이미 있는 카테고리');return;}
    categories.push(name);saveCategories();
    document.getElementById('catNewName').value='';
    renderCatList();renderFilterChips();populateCatSelect();
    showToast(`"${name}" 추가됨`);
  };
  document.getElementById('catNewName').onkeydown=e=>{if(e.key==='Enter')document.getElementById('btnCatAdd').click();};

  // 추가 모달
  document.getElementById('btnModalAddClose').onclick=()=>closeModal('modalAdd');
  document.getElementById('btnSlidePrev').onclick=()=>goSlide(-1);
  document.getElementById('btnSlideNext').onclick=()=>goSlide(1);
  // 모달 내 카메라/갤러리
  document.getElementById('btnAddMoreCam').onclick=()=>document.getElementById('addMoreCamera').click();
  document.getElementById('btnAddMoreGal').onclick=()=>document.getElementById('addMoreInput').click();
  document.getElementById('addMoreCamera').onchange=e=>{if(e.target.files.length)handleFiles(e.target.files,true);e.target.value='';};
  document.getElementById('addMoreInput').onchange=e=>{if(e.target.files.length)handleFiles(e.target.files,true);e.target.value='';};
  document.getElementById('btnDelImg').onclick=()=>{
    if(!modalImages.length)return;
    modalImages.splice(modalSlide,1);
    modalSlide=Math.min(modalSlide,modalImages.length-1);
    renderModalSlides();
  };
  document.getElementById('btnAiCrop').onclick=aiDocCrop;
  document.getElementById('btnSavePhoto').onclick=savePhoto;
  document.getElementById('btnEditPhoto').onclick=openEditor;

  // 백업 import
  document.getElementById('backupInput').onchange=e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value='';};

  // 편집 모달
  document.getElementById('btnEditClose').onclick=()=>{closeModal('modalEdit');openModal('modalAdd');};
  document.getElementById('btnEditDone').onclick=finishEdit;
  document.getElementById('btnEditUndo').onclick=()=>{if(canvas)canvas.undo&&canvas.undo();};
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>{
    b.onclick=()=>{
      const t=b.dataset.tool;
      if(t==='rect')addShape('rect');
      else if(t==='circle')addShape('circle');
      else setTool(t);
    };
  });
  document.getElementById('toolColor').onchange=()=>{
    if(canvas&&canvas.isDrawingMode)canvas.freeDrawingBrush.color=document.getElementById('toolColor').value;
  };
  document.getElementById('toolSize').onchange=()=>{
    if(canvas&&canvas.isDrawingMode)canvas.freeDrawingBrush.width=parseInt(document.getElementById('toolSize').value);
  };
  document.getElementById('btnDelObj').onclick=()=>{
    if(canvas){const o=canvas.getActiveObject();if(o){canvas.remove(o);canvas.renderAll();}}
  };
  document.getElementById('btnApplyCrop').onclick=applyCrop;
  document.getElementById('btnCancelCrop').onclick=()=>{
    if(cropRect){canvas.remove(cropRect);cropRect=null;}
    document.getElementById('cropControls').classList.add('hidden');
    setTool('select');
  };
  document.getElementById('btnAddText').onclick=addText;
  document.getElementById('textInput').onkeydown=e=>{if(e.key==='Enter')addText();};

  // 상세 보기 모달
  document.getElementById('btnViewClose').onclick=()=>closeModal('modalView');
  document.getElementById('btnViewPrev').onclick=()=>viewNavSlide(-1);
  document.getElementById('btnViewNext').onclick=()=>viewNavSlide(1);
  document.getElementById('btnViewShare').onclick=sharePhoto;
  document.getElementById('btnViewEdit').onclick=()=>{closeModal('modalView');openEditMetaModal(viewPhotoId);};
  document.getElementById('btnViewDelete').onclick=()=>deletePhoto(viewPhotoId);

  // AI 검색
  document.getElementById('btnSearchClose').onclick=()=>document.getElementById('panelSearch').classList.remove('open');
  document.getElementById('btnAiSearch').onclick=aiSearch;

  // API 키
  document.getElementById('btnApiKeyClose').onclick=()=>closeModal('modalApiKey');
  document.getElementById('apiKeyInput').value=localStorage.getItem(LS_API_KEY)||'';
  document.getElementById('btnSaveApiKey').onclick=()=>{
    localStorage.setItem(LS_API_KEY,document.getElementById('apiKeyInput').value.trim());
    closeModal('modalApiKey');showToast('API 키 저장됨');
  };

  // ESC
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      ['modalAdd','modalEdit','modalView','modalApiKey','modalCat'].forEach(closeModal);
      document.getElementById('panelSearch').classList.remove('open');
    }
  });

  // 드래그앤드롭
  document.addEventListener('dragover',e=>e.preventDefault());
  document.addEventListener('drop',e=>{
    e.preventDefault();
    const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')||f.name.endsWith('.heic'));
    if(files.length)handleFiles(files);
  });
}

document.addEventListener('DOMContentLoaded',init);
