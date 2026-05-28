/* ===== 설정 ===== */
const APP_VERSION = "v21";
const firebaseConfig = {
  apiKey: "AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY",
  authDomain: "my-system-25497.firebaseapp.com",
  projectId: "my-system-25497",
  storageBucket: "my-system-25497.firebasestorage.app",
};
const COL = "worklog_entries";
const STATUSES = ["미완료","진행중","완료"];
const CALLDIR  = ["수신","발신"];
const VTYPES   = ["년차휴가","오전반차","오후반차","병가","경조","기타"];
const FLOORS   = ["","옥탑층","20층","19층","18층","17층","16층","15층","14층","13층","12층","11층","10층","9층","8층","7층","6층","5층","4층","3층","2층","1층","지하1층","지하2층","지하3층","지하4층","지하5층","지하6층"];
const FIELDS = {
  "시설": [{name:"전기",subs:["엘리베이터","카리프트"]}, "통신", {name:"기계",subs:["냉난방","누수"]}, {name:"소방",subs:["소화전","스프링클러","감지기","수신기","펌프"]}, "영선", "주차", "주간점검", "월간점검", "협력업체점검"],
  "환경": ["청소","화단관리","은진"],
  "행정/문서": ["품의서","전표","안내문","관리비","임대"],
  "기타": ["기타"]
};
const FIELD_GROUP={};
Object.entries(FIELDS).forEach(([g,arr])=>arr.forEach(it=>{ if(typeof it==="string") FIELD_GROUP[it]=g; else { FIELD_GROUP[it.name]=g; (it.subs||[]).forEach(s=>FIELD_GROUP[s]=g); } }));
const GROUP_CLASS={"시설":"tech","환경":"env","행정/문서":"admin","기타":"etc"};
const FIELD_HINT={
  "품의서":"품의서 작성/상신 건이면 업무내역 제목에 '품의서'를 함께 적어두면 검색이 쉬워요.",
  "전표":"전표 처리 건은 제목에 대상·금액을 함께 적어두면 좋아요.",
  "안내문":"안내문 게시/배포 건은 제목에 대상(동·층)을 적어두면 좋아요.",
  "관리비":"관리비 관련 건은 제목에 항목(부과/정산 등)을 적어두면 좋아요.",
  "임대":"임대 관련 건은 제목에 호실·임차인을 적어두면 좋아요.",
  "월간점검":"월간점검 결과는 제목에 점검 대상·일자를 적어두면 좋아요.",
  "주간점검":"주간점검 결과는 제목에 점검 구역을 적어두면 좋아요.",
  "협력업체점검":"협력업체점검은 제목에 업체명·점검항목을 적어두면 좋아요.",
  "소방":"소방 점검/조치는 제목에 설비(소화전·스프링클러 등)와 위치를 적어두면 좋아요."
};
function fieldClass(f){ return GROUP_CLASS[FIELD_GROUP[f]]||"etc"; }
function statusClass(s){ return s==="완료"?"done":s==="진행중"?"prog":"todo"; }
function statusColor(s){ return s==="완료"?"var(--mint)":s==="진행중"?"var(--gold)":"var(--peach)"; }

const KIND_LABEL={work:"업무",plan:"오늘계획",memo:"메모",call:"통화",vacation:"휴가",meeting:"회의메모",deliver:"전달사항",filelink:"파일링크",site:"사이트",password:"비밀번호",schedule:"업무예정"};
const PHOTO_KINDS=["work","memo","meeting"];
const ATTACH_KINDS=["work","memo","meeting"];

/* ===== v16 카테고리 시스템 ===== */
const DEFAULT_CATS_FILE = ["전기","소방","기계","서희타워 운영","사무관련","비용관련","공적업무","용역","개인용도"];
const DEFAULT_CATS_SITE = ["전기","소방","기계","서희타워 운영","사무관련","비용관련","공적업무","용역","개인용도","견적전용업체"];
const DEFAULT_CATS_PW   = ["업무시스템","거래처","공적업무","개인용도","기타"];
const CAT_LS_KEY = "wl_categories_v16";
let CATEGORIES = { filelink: DEFAULT_CATS_FILE.slice(), site: DEFAULT_CATS_SITE.slice(), password: DEFAULT_CATS_PW.slice() };
function loadCategories(){
  try{
    const saved = JSON.parse(localStorage.getItem(CAT_LS_KEY)||"null");
    if(saved && typeof saved==="object"){
      ["filelink","site","password"].forEach(k=>{
        if(Array.isArray(saved[k]) && saved[k].length) CATEGORIES[k]=saved[k];
      });
    }
  }catch(e){}
}
function saveCategories(){ try{ localStorage.setItem(CAT_LS_KEY, JSON.stringify(CATEGORIES)); }catch(e){} }
function catOptions(kind, includeAll=true){
  let h = includeAll ? `<option value="전체">카테고리 전체</option>` : "";
  h += CATEGORIES[kind].map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  return h;
}
function subcatList(kind, cat){
  if(!cat || cat==="전체") return [];
  return [...new Set(entries.filter(e=>e.kind===kind && e.category===cat && e.subcategory).map(e=>e.subcategory))].sort();
}

const SCHEMA={
  work:[
    {k:"date",label:"날짜",type:"date",req:true},
    {k:"status",label:"완료 상태",type:"status"},
    {k:"floor",label:"해당층",type:"floor"},
    {k:"loc",label:"위치 (수동 입력)",type:"text"},
    {k:"title",label:"업무내역",type:"text",full:true,req:true},
    {k:"detail",label:"세부내용",type:"textarea",full:true},
    {k:"field",label:"분야",type:"field"},
    {k:"material",label:"자재",type:"text"},
    {k:"cost",label:"비용 (원)",type:"number"},
    {k:"improve",label:"앞으로 개선사항",type:"textarea",full:true},
  ],
  plan:[ {k:"date",label:"날짜",type:"date",req:true}, {k:"text",label:"할 일",type:"text",full:true,req:true} ],
  memo:[ {k:"date",label:"날짜",type:"date",req:true}, {k:"title",label:"제목(선택)",type:"text",full:true}, {k:"body",label:"내용",type:"textarea",full:true,req:true} ],
  call:[
    {k:"date",label:"날짜",type:"date",req:true}, {k:"time",label:"시간",type:"time"},
    {k:"dir",label:"구분",type:"select",opts:CALLDIR}, {k:"name",label:"상대 (이름/업체)",type:"text"},
    {k:"phone",label:"전화번호",type:"tel"}, {k:"content",label:"통화 내용",type:"textarea",full:true,req:true},
    {k:"followup",label:"조치 / 후속내용",type:"textarea",full:true},
  ],
  vacation:[
    {k:"name",label:"이름",type:"text",req:true}, {k:"vtype",label:"종류",type:"select",opts:VTYPES},
    {k:"start",label:"시작일",type:"date",req:true}, {k:"end",label:"종료일(여러날이면)",type:"date"},
    {k:"note",label:"메모(선택)",type:"text",full:true},
  ],
  meeting:[
    {k:"date",label:"날짜",type:"date",req:true}, {k:"title",label:"제목",type:"text",full:true,req:true},
    {k:"attendees",label:"참석자",type:"text",full:true}, {k:"body",label:"회의 내용",type:"textarea",full:true},
  ],
  deliver:[
    {k:"date",label:"날짜",type:"date",req:true},
    {k:"dtype",label:"전달 종류",type:"select",opts:["즉시전달","주간전달"]},
    {k:"title",label:"제목(선택)",type:"text",full:true},
    {k:"content",label:"전달할 내용",type:"textarea",full:true,req:true},
  ],
  filelink:[
    {k:"label",label:"별칭",type:"text",full:true,req:true},
    {k:"path",label:"파일/폴더 경로",type:"text",full:true,req:true},
    {k:"ptype",label:"종류",type:"select",opts:["파일","폴더"]},
    {k:"category",label:"카테고리",type:"catselect",ctx:"filelink"},
    {k:"subcategory",label:"소분류 (자유 입력)",type:"subcat",ctx:"filelink"},
    {k:"memo",label:"메모(선택)",type:"textarea",full:true},
  ],
  site:[
    {k:"name",label:"사이트명",type:"text",full:true,req:true},
    {k:"url",label:"URL",type:"text",full:true,req:true},
    {k:"category",label:"카테고리",type:"catselect",ctx:"site"},
    {k:"subcategory",label:"소분류 (자유 입력)",type:"subcat",ctx:"site"},
    {k:"memo",label:"메모(선택)",type:"textarea",full:true},
  ],
  schedule:[
    {k:"date",label:"예정일",type:"date",req:true},
    {k:"sStatus",label:"상태",type:"select",opts:["예정","진행중","완료","연기"]},
    {k:"sType",label:"종류",type:"select",opts:["정기점검","협력업체점검","회의","행사","공사","기타"]},
    {k:"title",label:"예정 내용",type:"text",full:true,req:true},
    {k:"memo",label:"메모(선택)",type:"textarea",full:true},
  ],
};

let db=null, online=false, entries=[];
let lastError=null;
const errorLog=[];
function logErr(where, e){
  const code=(e&&(e.code||e.name))||"unknown";
  const message=(e&&(e.message||String(e)))||"(메시지 없음)";
  const rec={where, code, message, at:Date.now()};
  lastError=rec; errorLog.unshift(rec); if(errorLog.length>30) errorLog.pop();
  try{ renderDiag(); }catch(_){}
  return rec;
}
const won = n => (Math.round(Number(n)||0)).toLocaleString("ko-KR");
const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const nowTime = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const clockStr = ts => { if(!ts) return ""; const d=new Date(ts); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const $ = id => document.getElementById(id);
const esc = s => (s||"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
function toast(msg){ const t=$("toast"); t.innerHTML=esc(msg); t.classList.add("show"); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),2200); }
function toastAction(msg, btnLabel, onClick, ms){
  const t=$("toast"); t.innerHTML=`<span>${esc(msg)}</span> <button id="toastBtn" style="margin-left:10px;background:rgba(255,255,255,.25);color:#fff;border:none;border-radius:8px;padding:4px 12px;font-weight:700;font-family:inherit;font-size:13px;cursor:pointer">${esc(btnLabel)}</button>`;
  t.classList.add("show"); clearTimeout(t._t);
  const btn=$("toastBtn"); if(btn) btn.addEventListener("click",()=>{ t.classList.remove("show"); clearTimeout(t._t); onClick(); });
  t._t=setTimeout(()=>t.classList.remove("show"), ms||6000);
}
function metaLine(parts){ return parts.filter(Boolean).map(esc).join(" · "); }
function byDateDesc(a,b){ return (b.date||"").localeCompare(a.date||"")||((b.createdAt||0)-(a.createdAt||0)); }
function cleanCell(s){ return (s||"").toString().replace(/[\t\r\n]/g," "); }
function fieldOptionsHTML(){
  return Object.entries(FIELDS).map(([g,arr])=>{
    const opts=arr.map(it=> typeof it==="string" ? `<option value="${it}">${it}</option>`
      : `<option value="${it.name}">${it.name}</option>`+(it.subs||[]).map(s=>`<option value="${s}">└ ${s}</option>`).join("")).join("");
    return `<optgroup label="${g}">${opts}</optgroup>`;
  }).join("");
}
function datesBetween(start,end){
  const out=[]; if(!start) return out;
  let s=new Date(start+"T00:00:00"); const e=new Date(((end||start))+"T00:00:00");
  if(isNaN(s)||isNaN(e)) return [start]; if(e<s) return [start];
  let i=0; while(s<=e && i<366){ out.push(`${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,"0")}-${String(s.getDate()).padStart(2,"0")}`); s.setDate(s.getDate()+1); i++; }
  return out;
}

/* ===== 파일링크 (v15 신규, v19에서 ptype 우선) ===== */
function isFolder(p, ptype){
  // v19: 사용자가 명시적으로 선택한 종류가 있으면 그것을 우선
  if(ptype === "폴더") return true;
  if(ptype === "파일") return false;
  // 기존 호환: 경로 끝이 슬래시면 폴더로 추정
  return /[\\\/]\s*$/.test(p||"");
}
function fileIcon(p, ptype){
  if(isFolder(p, ptype)) return "📁";
  const ext=(p||"").split(".").pop().toLowerCase();
  if(["doc","docx"].includes(ext)) return "📄";
  if(["xls","xlsx","xlsm","csv"].includes(ext)) return "📊";
  if(["ppt","pptx"].includes(ext)) return "📽";
  if(["pdf"].includes(ext)) return "📕";
  if(["jpg","jpeg","png","gif","bmp","webp"].includes(ext)) return "🖼";
  if(["zip","rar","7z"].includes(ext)) return "🗜";
  if(["hwp","hwpx"].includes(ext)) return "📃";
  return "📎";
}
function toLocalUrl(path){
  if(!path) return "";
  // 역슬래시를 슬래시로 변환하고 인코딩
  const normalized=path.replace(/\\/g,"/");
  return "localfile://"+encodeURI(normalized);
}
function attachLinksRO(arr){
  if(!arr||!arr.length) return "";
  return `<div class="attach-links">`+arr.map(a=>{
    const label=a.label||a.path||"";
    return `<a href="${toLocalUrl(a.path)}" class="attach-link" title="${esc(a.path)}">
      <span>${fileIcon(a.path)}</span>
      <span style="display:flex;flex-direction:column;align-items:flex-start;min-width:0">
        <span>${esc(label)}</span>
        <span class="al-path">${esc(a.path)}</span>
      </span>
    </a>`;
  }).join("")+`</div>`;
}
function attachMiniRO(arr){
  if(!arr||!arr.length) return "";
  return `<div class="row-attach-mini">`+arr.map(a=>`<a href="${toLocalUrl(a.path)}" title="${esc(a.path)}" onclick="event.stopPropagation()">${fileIcon(a.path)} ${esc(a.label||a.path.split(/[\\\/]/).pop()||a.path)}</a>`).join("")+`</div>`;
}

/* 날짜 범위 필터 */
const RANGES=["전체","오늘","어제","2일전","3일전","이번주","이번달"];
function dayOffset(n){ const d=new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function weekRange(){ const d=new Date(); const dow=(d.getDay()+6)%7; const mon=new Date(d); mon.setDate(d.getDate()-dow); const sun=new Date(mon); sun.setDate(mon.getDate()+6); const f=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`; return [f(mon),f(sun)]; }
function inDateRange(d,from,to){ d=d||""; return (!from||d>=from)&&(!to||d<=to); }

/* ===== 사진 ===== */
const MAX_TOTAL=900000;
function compressImage(file, maxDim=1100, quality=0.62){
  return new Promise((resolve,reject)=>{ const reader=new FileReader();
    reader.onload=e=>{ const img=new Image(); img.onload=()=>{ let w=img.width,h=img.height;
      if(w>h){ if(w>maxDim){ h=Math.round(h*maxDim/w); w=maxDim; } } else { if(h>maxDim){ w=Math.round(w*maxDim/h); h=maxDim; } }
      const cv=document.createElement("canvas"); cv.width=w; cv.height=h; cv.getContext("2d").drawImage(img,0,0,w,h);
      resolve(cv.toDataURL("image/jpeg",quality)); }; img.onerror=reject; img.src=e.target.result; };
    reader.onerror=reject; reader.readAsDataURL(file);
  });
}
async function addPhotos(files, arr, rerender){
  for(const f of files){ if(!f.type.startsWith("image/")) continue;
    try{ const data=await compressImage(f); const cur=arr.reduce((s,p)=>s+p.length,0);
      if(cur+data.length>MAX_TOTAL){ toast("사진 용량이 커서 더 추가할 수 없어요"); break; } arr.push(data);
    }catch(e){ toast("사진 처리 실패"); } }
  rerender();
}
function handleFiles(e,arr,cb){ const files=[...e.target.files]; e.target.value=""; if(files.length) addPhotos(files,arr,cb); }
function renderThumbs(container, arr, onRemove){
  container.innerHTML=arr.map((src,i)=>`<div class="thumb"><img class="zimg" src="${src}"><button class="rm" data-rm="${i}">×</button></div>`).join("");
  container.querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click",e=>{ e.stopPropagation(); onRemove(Number(b.dataset.rm)); }));
}
function thumbsRO(arr){ return (arr&&arr.length)?`<div class="detail-thumbs">${arr.map(p=>`<div class="thumb"><img class="zimg" src="${p}"></div>`).join("")}</div>`:""; }
function showImg(src){ $("imgFull").src=src; $("imgOverlay").classList.add("show"); }
$("imgOverlay").addEventListener("click",()=>$("imgOverlay").classList.remove("show"));
document.addEventListener("click",e=>{ const im=e.target.closest("img.zimg"); if(im){ e.stopPropagation(); showImg(im.src); } });

/* ===== 저장소 ===== */
function lsLoad(){ try{ return JSON.parse(localStorage.getItem("wl_"+COL)||"[]"); }catch(e){ return []; } }
function lsSave(){ try{ localStorage.setItem("wl_"+COL, JSON.stringify(entries)); }catch(e){} }
function genId(){ return online ? db.collection(COL).doc().id : "L"+Date.now()+Math.floor(Math.random()*100000); }
function syncSet(id,rec){ if(!online) return; const {id:_x,...payload}=rec; db.collection(COL).doc(id).set(payload).catch(e=>{ logErr("저장 동기화", e); toast("클라우드 동기화 지연 — 이 기기에는 저장됨"); }); }
function addRecord(data){ const id=genId(); const rec={...data,id}; entries.push(rec); if(online) syncSet(id,rec); lsSave(); return rec; }
function updateRecord(id,patch){ const i=entries.findIndex(x=>x.id===id); if(i<0) return; entries[i]={...entries[i],...patch}; if(online) syncSet(id,entries[i]); lsSave(); }
function deleteRecord(id){ entries=entries.filter(x=>x.id!==id); if(online) db.collection(COL).doc(id).delete().catch(e=>logErr("삭제 동기화", e)); lsSave(); }
const TEMP_BK="wl_tempbackup";
function saveTempBackup(){ try{ localStorage.setItem(TEMP_BK, JSON.stringify({at:Date.now(),entries})); }catch(e){} }
function restoreRecord(rec){
  if(!rec) return;
  const i=entries.findIndex(x=>x.id===rec.id);
  if(i<0) entries.push(rec); else entries[i]=rec;
  if(online){ const {id,...p}=rec; db.collection(COL).doc(rec.id).set(p).catch(e=>logErr("복구 동기화", e)); }
  lsSave();
}
function deleteWithUndo(id, label){
  const rec=entries.find(x=>x.id===id); if(!rec) return;
  const backup=JSON.parse(JSON.stringify(rec));
  saveTempBackup();
  deleteRecord(id); renderAll();
  toastAction(`${label||"항목"}을(를) 삭제했습니다`, "되돌리기", ()=>{
    restoreRecord(backup); renderAll(); toast("삭제를 되돌렸습니다");
  });
}
async function loadAll(){
  if(online){
    try{
      const s=await db.collection(COL).get();
      const fb=s.docs.map(d=>({id:d.id,...d.data()}));
      const ids=new Set(fb.map(x=>x.id));
      const extra=lsLoad().filter(x=>!ids.has(x.id));
      entries=[...fb,...extra];
      extra.forEach(x=>{ const {id,...p}=x; db.collection(COL).doc(id).set(p).catch(()=>{}); });
    }catch(e){ entries=lsLoad(); }
  } else entries=lsLoad();
}

/* ===== 초기화 ===== */
async function init(){
  $("planDate").value=todayStr();
  { const vb=$("verBadge"); if(vb) vb.textContent=APP_VERSION; }
  $("planFrom").addEventListener("change",e=>{ planFrom=e.target.value; renderPlan(); });
  $("planTo").addEventListener("change",e=>{ planTo=e.target.value; renderPlan(); });
  $("planRangeClear").addEventListener("click",()=>{ planFrom=""; planTo=""; $("planFrom").value=""; $("planTo").value=""; renderPlan(); });
  $("memoFrom").addEventListener("change",e=>{ memoFrom=e.target.value; renderMemo(); });
  $("memoTo").addEventListener("change",e=>{ memoTo=e.target.value; renderMemo(); });
  $("memoRangeClear").addEventListener("click",()=>{ memoFrom=""; memoTo=""; $("memoFrom").value=""; $("memoTo").value=""; renderMemo(); });
  $("delFrom").addEventListener("change",e=>{ delFrom=e.target.value; renderDeliver(); });
  $("delTo").addEventListener("change",e=>{ delTo=e.target.value; renderDeliver(); });
  $("delRangeClear").addEventListener("click",()=>{ delFrom=""; delTo=""; $("delFrom").value=""; $("delTo").value=""; renderDeliver(); });
  $("floorFilter").addEventListener("change",e=>{ floorFilter=e.target.value; renderWork(); });
  $("wkFrom").addEventListener("change",e=>{ wkFrom=e.target.value; renderWork(); });
  $("wkTo").addEventListener("change",e=>{ wkTo=e.target.value; renderWork(); });
  $("wkDateClear").addEventListener("click",()=>{ wkFrom=""; wkTo=""; $("wkFrom").value=""; $("wkTo").value=""; renderWork(); });
  $("locFilter").addEventListener("change",e=>{ locFilter=e.target.value; renderWork(); });
  $("fieldFilter").addEventListener("change",e=>{ fieldFilter=e.target.value; renderWork(); });
  wireDiag();
  aiInitKeyUI();
  wireAttachUI();
  loadCategories();
  loadViewPrefs();
  wireFileLinkTab();
  wireSiteTab();
  wirePasswordTab();
  wireCatMgr();
  try{
    if(typeof firebase==="undefined") throw new Error("sdk");
    firebase.initializeApp(firebaseConfig); db=firebase.firestore();
    try{ await db.enablePersistence({synchronizeTabs:true}); }catch(_){}
    await Promise.race([ db.collection(COL).limit(1).get(), new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),6000)) ]);
    online=true; setStatus(true);
  }catch(e){ online=false; setStatus(false); logErr("초기 연결", e); }
  await loadAll();
  renderStatusChips(); renderAll();
  try{ const t=localStorage.getItem("wl_tab"); if(t) activateTab(t); }catch(e){}
}
function setStatus(on){ const el=$("status"); el.classList.toggle("on",on); el.classList.toggle("off",!on); $("statusText").textContent=on?"클라우드 연결됨":"오프라인 (이 기기에 저장)"; }
function renderAll(){ renderWork(); renderPlan(); renderMemo(); renderCall(); renderVac(); renderMeeting(); renderDeliver(); renderCalendar(); renderFileLink(); renderSite(); renderPassword(); renderDiag(); }

/* ===== 탭 ===== */
function activateTab(name){
  const btn=document.querySelector(`.tabs button[data-tab="${name}"]`); if(!btn) return;
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active"); $("panel-"+name).classList.add("active");
  try{ btn.scrollIntoView({inline:"center",block:"nearest",behavior:"smooth"}); }catch(e){}
  try{ localStorage.setItem("wl_tab", name); }catch(e){}
  try{ onTabChange(name); }catch(e){}
}
$("tabs").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; activateTab(b.dataset.tab); });
(function(){
  const nav=$("tabs"), L=$("tabArrowL"), R=$("tabArrowR");
  function upd(){
    const max=nav.scrollWidth-nav.clientWidth-2;
    L.classList.toggle("show", nav.scrollLeft>2);
    R.classList.toggle("show", nav.scrollLeft<max && max>0);
  }
  L.addEventListener("click",()=>nav.scrollBy({left:-160,behavior:"smooth"}));
  R.addEventListener("click",()=>nav.scrollBy({left:160,behavior:"smooth"}));
  nav.addEventListener("scroll",upd);
  window.addEventListener("resize",upd);
  setTimeout(upd,200);
})();

/* ===== 공용 모달 ===== */
let mKind=null, mId=null, modalPhotos=[], modalAttachments=[]; // v15: modalAttachments 추가
function defaults(kind){
  const t=todayStr();
  if(kind==="work") return {date:t,status:"미완료",field:"전기"};
  if(kind==="call") return {date:t,time:nowTime(),dir:"수신"};
  if(kind==="vacation") return {start:t,end:t,vtype:"년차휴가"};
  if(kind==="filelink") return {category:(CATEGORIES.filelink[0]||""), ptype:"파일"};
  if(kind==="site") return {category:(CATEGORIES.site[0]||"")};
  if(kind==="deliver") return {date:t, dtype:"즉시전달"};
  if(kind==="schedule") return {date:t, sStatus:"예정", sType:"정기점검"};
  return {date:t};
}
function fieldHTML(f){
  let inner;
  if(f.type==="textarea") inner=`<textarea id="m-${f.k}"></textarea>`;
  else if(f.type==="select") inner=`<select id="m-${f.k}">${f.opts.map(o=>`<option>${o}</option>`).join("")}</select>`;
  else if(f.type==="status") inner=`<select id="m-${f.k}">${STATUSES.map(o=>`<option>${o}</option>`).join("")}</select>`;
  else if(f.type==="field") inner=`<select id="m-${f.k}">${fieldOptionsHTML()}</select>`;
  else if(f.type==="floor") inner=`<select id="m-${f.k}">${FLOORS.map(o=>`<option value="${o}">${o===""?"(층 선택 안 함)":o}</option>`).join("")}</select>`;
  else if(f.type==="catselect"){
    inner=`<select id="m-${f.k}" class="cat-sel" data-ctx="${f.ctx}"></select>
    <input type="text" id="m-${f.k}-new" class="cat-new" autocomplete="off" placeholder="새 카테고리 입력" style="display:none;margin-top:6px">`;
  }
  else if(f.type==="subcat"){
    inner=`<select id="m-${f.k}-sel" class="subcat-sel" data-subctx="${f.ctx}"></select>
    <input type="text" id="m-${f.k}" class="subcat-new" autocomplete="off" placeholder="새 소분류 입력 (예: 엘리베이터)" style="display:none;margin-top:6px">`;
  }
  else { const t=f.type==="number"?"number":f.type==="date"?"date":f.type==="time"?"time":"text"; const im=f.type==="tel"?' inputmode="tel"':'';
    if(f.k==="loc"){
      const vals=[...new Set(entries.filter(e=>e.kind==="work"&&e.loc).map(e=>e.loc))].sort();
      inner=`<input type="text" id="m-${f.k}" list="dl-loc" autocomplete="off"><datalist id="dl-loc">${vals.map(v=>`<option value="${esc(v)}"></option>`).join("")}</datalist>`;
    } else inner=`<input type="${t}" id="m-${f.k}"${im}>`;
  }
  const req=f.req?' <span class="req">*</span>':'';
  return `<div class="field ${f.full?"full":""}"><label>${f.label}${req}</label>${inner}</div>`;
}
function openEditor(kind,id){
  // v16: 비밀번호는 별도 에디터로
  if(kind==="password"){ pwOpenEditor(id); return; }
  mKind=kind; mId=id||null;
  const sc=SCHEMA[kind];
  const data = id ? (entries.find(x=>x.id===id)||{}) : defaults(kind);
  // v19: filelink 기존 항목에 ptype 없으면 경로로 추정해서 채움 (수정 시 자동 보정)
  if(kind==="filelink" && id && !data.ptype){
    data.ptype = /[\\\/]\s*$/.test(data.path||"") ? "폴더" : "파일";
  }
  $("mTitle").textContent = (id?"수정":"추가")+" · "+KIND_LABEL[kind];
  $("mFields").innerHTML = sc.map(fieldHTML).join("");
  sc.forEach(f=>{ const el=$("m-"+f.k); if(!el) return; const v=data[f.k]; if(v!==undefined&&v!==null&&v!=="") el.value=v; });
  const hasPhoto=PHOTO_KINDS.includes(kind);
  $("mPhotoArea").style.display=hasPhoto?"":"none";
  modalPhotos=hasPhoto?((data.photos||[]).slice()):[];
  renderModalThumbs();

  // v15: 첨부파일 영역
  const hasAttach=ATTACH_KINDS.includes(kind);
  $("mAttachArea").style.display=hasAttach?"":"none";
  modalAttachments=hasAttach?((data.attachments||[]).slice().map(a=>({label:a.label||"",path:a.path||""}))):[];
  renderModalAttachList();
  $("mAttachLabel").value=""; $("mAttachPath").value="";

  $("mDelete").style.display=id?"":"none";

  // v21+: 카테고리·소분류 모두 드롭다운에서 선택 또는 새로 직접 입력
  if(kind==="filelink" || kind==="site"){
    const ctx=kind;
    const catSel=$("m-category");
    const catNew=$("m-category-new");
    const subSel=$("m-subcategory-sel");
    const subInp=$("m-subcategory");
    const curCat=()=> (catSel && catSel.value==="__new__") ? (catNew.value.trim()||"") : (catSel?catSel.value:"");
    // 카테고리 채우기
    const fillCat=(cv)=>{
      if(!catSel) return;
      const cats=CATEGORIES[ctx];
      let html=cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
      html+=`<option value="__new__">➕ 새 카테고리 직접 입력…</option>`;
      catSel.innerHTML=html;
      if(cv && cats.includes(cv)){ catSel.value=cv; catNew.style.display="none"; }
      else if(cv){ catSel.value="__new__"; catNew.value=cv; catNew.style.display=""; }
      else { catSel.value=cats[0]||""; catNew.style.display="none"; }
    };
    // 소분류 채우기
    const fillSub=(sv)=>{
      if(!subSel) return;
      const subs=subcatList(ctx, curCat());
      let html=`<option value="">(소분류 없음)</option>`;
      html+=subs.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("");
      html+=`<option value="__new__">➕ 새 소분류 직접 입력…</option>`;
      subSel.innerHTML=html;
      if(sv && subs.includes(sv)){ subSel.value=sv; subInp.style.display="none"; }
      else if(sv){ subSel.value="__new__"; subInp.value=sv; subInp.style.display=""; }
      else { subSel.value=""; subInp.style.display="none"; }
    };
    fillCat(data.category||"");
    fillSub(id ? (data.subcategory||"") : "");
    if(catSel){
      catSel.addEventListener("change",()=>{
        if(catSel.value==="__new__"){ catNew.style.display=""; catNew.value=""; catNew.focus(); }
        else { catNew.style.display="none"; }
        fillSub("");
      });
    }
    if(catNew){
      catNew.addEventListener("input",()=>fillSub(""));
    }
    if(subSel){
      subSel.addEventListener("change",()=>{
        if(subSel.value==="__new__"){ subInp.style.display=""; subInp.value=""; subInp.focus(); }
        else { subInp.style.display="none"; }
      });
    }
  }

  if(kind==="work"){
    const fe=$("m-field"), te=$("m-title");
    if(fe&&te){
      const hintBox=document.createElement("div");
      hintBox.id="fieldHint"; hintBox.style.cssText="grid-column:1/-1;font-size:12.5px;color:var(--primary-deep);background:var(--primary-soft);border-radius:9px;padding:8px 11px;display:none";
      te.closest(".field").after(hintBox);
      const showHint=()=>{ const h=FIELD_HINT[fe.value]; if(h){ hintBox.textContent="💡 "+h; hintBox.style.display=""; } else hintBox.style.display="none"; };
      fe.addEventListener("change",showHint); showHint();
    }
  }
  $("overlay").classList.add("show");
  const modalEl=$("overlay").querySelector(".modal"); if(modalEl) modalEl.scrollTop=0;
}
function renderModalThumbs(){ renderThumbs($("m-thumbs"),modalPhotos,i=>{ modalPhotos.splice(i,1); renderModalThumbs(); }); }

/* ===== 첨부파일 모달 UI (v15 신규) ===== */
function renderModalAttachList(){
  const box=$("mAttachList");
  if(!modalAttachments.length){ box.innerHTML=`<div style="font-size:12px;color:var(--ink-soft);padding:6px 2px">아직 추가된 파일/폴더 링크가 없습니다.</div>`; return; }
  box.innerHTML=modalAttachments.map((a,i)=>`<div class="attach-item">
    <span class="ai-icon">${fileIcon(a.path)}</span>
    <div class="ai-body">
      <span class="ai-label">${esc(a.label||"(별칭 없음)")}</span>
      <span class="ai-path">${esc(a.path)}</span>
    </div>
    <a href="${toLocalUrl(a.path)}" title="열기" style="text-decoration:none;color:var(--primary-deep);font-size:13px;font-weight:600;padding:4px 8px;border-radius:6px;border:1px solid var(--primary-soft)">열기</a>
    <button type="button" class="ai-rm" data-arm="${i}" title="삭제">🗑</button>
  </div>`).join("");
  box.querySelectorAll("[data-arm]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation();
    const i=Number(b.dataset.arm);
    modalAttachments.splice(i,1);
    renderModalAttachList();
  }));
}
function wireAttachUI(){
  $("mAttachAdd").addEventListener("click",()=>{
    const label=$("mAttachLabel").value.trim();
    const path=$("mAttachPath").value.trim();
    if(!path){ toast("파일/폴더 경로를 입력하세요"); return; }
    modalAttachments.push({label, path});
    $("mAttachLabel").value=""; $("mAttachPath").value="";
    $("mAttachPath").focus();
    renderModalAttachList();
  });
  // Enter 키로 추가
  ["mAttachLabel","mAttachPath"].forEach(id=>{
    $(id).addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); $("mAttachAdd").click(); } });
  });
}

/* ===== 보기(확대) 모달 ===== */
let vId=null, vKind=null;
function fmtVal(f,v){
  if(v===undefined||v===null||v==="") return "";
  if(f.type==="number") return v?won(v)+" 원":"";
  return String(v);
}
function openViewer(kind,id){
  // v16: 파일링크/사이트/비번은 카드 자체 동작으로 처리 (viewer 사용 안 함)
  if(kind==="filelink"||kind==="site"||kind==="password"){ openEditor(kind,id); return; }
  const data=entries.find(x=>x.id===id); if(!data){ openEditor(kind,id); return; }
  vKind=kind; vId=id;
  $("vTitle").textContent="상세보기 · "+(KIND_LABEL[kind]||"");
  let rows="";
  if(kind==="plan"){
    rows+=vrow("날짜",data.date)+vrow("할 일",data.text)+vrow("상태",data.done?"완료":"미완료");
  } else {
    (SCHEMA[kind]||[]).forEach(f=>{ const val=fmtVal(f,data[f.k]); if(val) rows+=vrow(f.label.replace(/\s*\*$/,""),val); });
    if(kind==="call") rows+=vrow("조치완료",data.done?"완료":"미완료");
    if(kind==="deliver") rows+=vrow("전달완료",data.done?"완료":"미완료");
  }
  // v15: 첨부파일 표시
  if((data.attachments||[]).length){
    rows+=`<div class="vrow"><div class="vk">📎 파일링크</div><div class="vv">${attachLinksRO(data.attachments)}</div></div>`;
  }
  let photos="";
  if((data.photos||[]).length) photos=`<div class="vrow"><div class="vk">사진</div><div class="vv">${thumbsRO(data.photos)}</div></div>`;
  $("vBody").innerHTML=`<dl>${rows}${photos}</dl>`;
  $("viewOverlay").classList.add("show");
  const m=$("viewOverlay").querySelector(".modal"); if(m) m.scrollTop=0;
}
function vrow(k,v){ return `<div class="vrow"><div class="vk">${esc(k)}</div><div class="vv">${esc(String(v))}</div></div>`; }
$("vClose").addEventListener("click",()=>$("viewOverlay").classList.remove("show"));
$("vEdit").addEventListener("click",()=>{ $("viewOverlay").classList.remove("show"); openEditor(vKind,vId); });
$("vDel").addEventListener("click",()=>{ if(!vId) return; $("viewOverlay").classList.remove("show"); deleteWithUndo(vId, KIND_LABEL[vKind]||"항목"); });
$("viewOverlay").addEventListener("click",e=>{ if(e.target===$("viewOverlay")) $("viewOverlay").classList.remove("show"); });
$("m-cam").addEventListener("change",e=>handleFiles(e,modalPhotos,renderModalThumbs));
$("m-file").addEventListener("change",e=>handleFiles(e,modalPhotos,renderModalThumbs));
$("mCancel").addEventListener("click",()=>$("overlay").classList.remove("show"));
$("mSave").addEventListener("click",async ()=>{
  // v16: 비밀번호 종류는 별도 처리 (암호화)
  if(mKind==="password"){
    const name=$("m-pwname").value.trim();
    const pw=$("m-pwpass").value;
    if(!name){ toast("사이트명을 입력하세요"); return; }
    if(!pw){ toast("비밀번호를 입력하세요"); return; }
    // 카테고리: 드롭다운 또는 새 입력
    const pwCatSel=$("m-pwcat");
    let pwCat = (pwCatSel && pwCatSel.value==="__new__") ? ($("m-pwcat-new").value||"").trim() : (pwCatSel?pwCatSel.value:"");
    if(pwCatSel && pwCatSel.value==="__new__" && pwCat && !CATEGORIES.password.includes(pwCat)){ CATEGORIES.password.push(pwCat); saveCategories(); }
    // 소분류: 드롭다운 또는 새 입력
    const pwSubSel=$("m-pwsub-sel");
    let pwSub = (pwSubSel && pwSubSel.value==="__new__") ? ($("m-pwsub").value||"").trim() : (pwSubSel?pwSubSel.value:"");
    const obj={
      kind:"password",
      name,
      category:pwCat||"",
      subcategory:pwSub||"",
    };
    try{
      const payload=JSON.stringify({
        username:$("m-pwuser").value||"",
        password:pw,
        url:($("m-pwurl").value||"").trim(),
        memo:$("m-pwmemo").value||""
      });
      obj.encrypted=await encryptStr(payload, masterPassword);
    }catch(e){ toast("암호화 실패: "+e.message); return; }
    if(mId){ updateRecord(mId,obj); } else { obj.createdAt=Date.now(); obj.starred=false; addRecord(obj); }
    $("overlay").classList.remove("show");
    pwRenderList();
    toast(mId?"수정되었습니다":"저장되었습니다");
    return;
  }
  const sc=SCHEMA[mKind]; const obj={kind:mKind};
  for(const f of sc){
    let v="";
    if(f.type==="subcat"){
      const sel=$("m-"+f.k+"-sel");
      if(sel && sel.value==="__new__"){ const inp=$("m-"+f.k); v=inp?inp.value.trim():""; }
      else if(sel){ v=sel.value; }
    } else if(f.type==="catselect"){
      const sel=$("m-"+f.k);
      if(sel && sel.value==="__new__"){
        const inp=$("m-"+f.k+"-new"); v=inp?inp.value.trim():"";
        // 새 카테고리를 목록에 자동 등록
        if(v && CATEGORIES[f.ctx] && !CATEGORIES[f.ctx].includes(v)){ CATEGORIES[f.ctx].push(v); saveCategories(); }
      } else if(sel){ v=sel.value; }
    } else {
      const el=$("m-"+f.k); v=el?el.value:"";
      if(f.type==="number") v=Number(v)||0; else if(typeof v==="string") v=v.trim();
    }
    obj[f.k]=v;
  }
  for(const f of sc){ if(f.req && !String(obj[f.k]||"").trim()){ toast(f.label+"을(를) 입력하세요"); return; } }
  // v19: filelink가 폴더면 경로 끝에 \ 자동 추가, 파일이면 끝 슬래시 제거
  if(mKind==="filelink" && obj.path){
    if(obj.ptype==="폴더" && !/[\\\/]$/.test(obj.path)) obj.path = obj.path + "\\";
    if(obj.ptype==="파일") obj.path = obj.path.replace(/[\\\/]+$/, "");
  }
  if(PHOTO_KINDS.includes(mKind)) obj.photos=modalPhotos.slice();
  if(ATTACH_KINDS.includes(mKind)) obj.attachments=modalAttachments.slice();
  if(mKind==="vacation" && !obj.end) obj.end=obj.start;
  if(mId) updateRecord(mId,obj); else { obj.createdAt=Date.now(); if(mKind==="plan") obj.done=false; if(mKind==="filelink"||mKind==="site") obj.starred=false; addRecord(obj); }
  renderAll(); $("overlay").classList.remove("show"); toast(mId?"수정되었습니다":"저장되었습니다");
});
$("mDelete").addEventListener("click",()=>{ if(!mId) return; $("overlay").classList.remove("show"); deleteWithUndo(mId, KIND_LABEL[mKind]||"항목"); });
document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>openEditor(b.dataset.add,null)));

/* ===== 검색 ===== */
const Q={work:"",plan:"",memo:"",call:"",vacation:"",meeting:"",deliver:""};
function matchObj(e,q){ if(!q.trim()) return true; const s=Object.entries(e).filter(([k])=>k!=="photos"&&k!=="id"&&k!=="kind").map(([,v])=>String(v)).join(" ").toLowerCase(); return s.includes(q.trim().toLowerCase()); }
$("wkSearch").addEventListener("input",e=>{ Q.work=e.target.value; renderWork(); });
$("planSearch").addEventListener("input",e=>{ Q.plan=e.target.value; renderPlan(); });
$("memoSearch").addEventListener("input",e=>{ Q.memo=e.target.value; renderMemo(); });
$("callSearch").addEventListener("input",e=>{ Q.call=e.target.value; renderCall(); });
$("vacSearch").addEventListener("input",e=>{ Q.vacation=e.target.value; renderVac(); });
$("meetSearch").addEventListener("input",e=>{ Q.meeting=e.target.value; renderMeeting(); });
$("delSearch").addEventListener("input",e=>{ Q.deliver=e.target.value; renderDeliver(); });
function listOf(kind){ return entries.filter(e=>e.kind===kind && matchObj(e,Q[kind])); }

/* 카드 공통 */
function wireCards(scope){
  scope.querySelectorAll("[data-id][data-kind]").forEach(el=>{
    el.addEventListener("click",e=>{ if(e.target.closest("a,img,button,input,.cb")) return; openViewer(el.dataset.kind, el.dataset.id); });
    const ed=el.querySelector("[data-edit]"); if(ed) ed.addEventListener("click",e=>{ e.stopPropagation(); openEditor(el.dataset.kind, el.dataset.id); });
    const dl=el.querySelector("[data-del]"); if(dl) dl.addEventListener("click",e=>{ e.stopPropagation(); deleteWithUndo(el.dataset.id, KIND_LABEL[el.dataset.kind]||"항목"); });
    const cb=el.querySelector(".cb"); if(cb) cb.addEventListener("click",e=>{ e.stopPropagation(); if(el.dataset.kind==="plan") togglePlanDone(el.dataset.id); });
  });
}

/* ===== 업무 ===== */
let statusFilter="전체", locFilter="전체", fieldFilter="전체", floorFilter="전체", wkFrom="", wkTo="";
function renderStatusChips(){
  const opts=["전체",...STATUSES];
  $("statusChips").innerHTML=opts.map(o=>`<button class="chip ${o===statusFilter?"active":""}" data-s="${o}">${o}</button>`).join("");
  $("statusChips").querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{ statusFilter=b.dataset.s; renderStatusChips(); renderWork(); }));
}
function populateWorkFilters(){
  const usedFloors=FLOORS.filter(f=>f && entries.some(e=>e.kind==="work"&&e.floor===f));
  $("floorFilter").innerHTML=`<option value="전체">해당층 전체</option>`+usedFloors.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join("");
  if(floorFilter!=="전체" && !usedFloors.includes(floorFilter)) floorFilter="전체";
  $("floorFilter").value=floorFilter;
  const locs=[...new Set(entries.filter(e=>e.kind==="work"&&e.loc).map(e=>e.loc))].sort();
  $("locFilter").innerHTML=`<option value="전체">위치 전체</option>`+locs.map(l=>`<option value="${esc(l)}">${esc(l)}</option>`).join("");
  if(!locs.includes(locFilter)) locFilter="전체";
  $("locFilter").value=locFilter;
  $("fieldFilter").innerHTML=`<option value="전체">분야 전체</option>`+fieldOptionsHTML();
  $("fieldFilter").value=fieldFilter;
}
function workList(){
  return entries.filter(e=>e.kind==="work"
    && (statusFilter==="전체"||e.status===statusFilter)
    && (!wkFrom || (e.date||"")>=wkFrom)
    && (!wkTo || (e.date||"")<=wkTo)
    && (locFilter==="전체"||e.loc===locFilter)
    && (floorFilter==="전체"||e.floor===floorFilter)
    && (fieldFilter==="전체"||e.field===fieldFilter)
    && matchObj(e,Q.work)).sort(byDateDesc);
}
function renderWork(){
  populateWorkFilters();
  const body=$("wkBody"), foot=$("wkFoot");
  const all=entries.filter(e=>e.kind==="work");
  const list=workList();
  const filterOn = Q.work.trim()||statusFilter!=="전체"||wkFrom||wkTo||locFilter!=="전체"||floorFilter!=="전체"||fieldFilter!=="전체";
  $("wkCount").textContent = filterOn ? `${list.length} / 전체 ${all.length}건` : `총 ${all.length}건`;
  if(!list.length){ body.innerHTML=`<tr><td colspan="11" class="empty">${all.length?"조건에 맞는 업무가 없습니다.":"아직 입력된 업무가 없습니다."}</td></tr>`; foot.innerHTML=""; return; }
  body.innerHTML=list.map(en=>`<tr data-id="${en.id}">
    <td>${en.date||""}</td>
    <td><span class="st ${statusClass(en.status)}">${esc(en.status||"")}</span></td>
    <td>${esc(en.floor||"")}</td>
    <td>${esc(en.loc||"")}</td>
    <td>${esc(en.title||"")}${(en.photos&&en.photos.length)?" 📷":""}${(en.attachments&&en.attachments.length)?" 📎":""}</td>
    <td class="clip" data-tip="${esc(en.detail||"")}" title="${esc(en.detail||"")}">${esc(en.detail||"")}</td>
    <td><span class="pill ${fieldClass(en.field)}">${esc(en.field||"")}</span></td>
    <td>${esc(en.material||"")}</td>
    <td class="num">${en.cost?won(en.cost):""}</td>
    <td class="clip" data-tip="${esc(en.improve||"")}" title="${esc(en.improve||"")}">${esc(en.improve||"")}</td>
    <td><button class="rowdel" data-del="${en.id}" title="삭제">🗑</button></td></tr>`).join("");
  const totalCost=list.reduce((s,en)=>s+(Number(en.cost)||0),0);
  foot.innerHTML=`<tr><td colspan="8" style="background:#33567d;color:#fff;font-weight:700">합계 (${list.length}건)</td><td class="num" style="background:#33567d;color:#fff;font-weight:700">${totalCost?won(totalCost):""}</td><td colspan="2" style="background:#33567d"></td></tr>`;
  body.querySelectorAll("tr[data-id]").forEach(tr=>tr.addEventListener("click",e=>{ if(e.target.closest("[data-del]")) return; openViewer("work",tr.dataset.id); }));
  body.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",e=>{ e.stopPropagation(); deleteWithUndo(b.dataset.del, "업무"); }));
}
function workCopyLine(en){
  const head=((en.floor?en.floor+" ":"")+(en.loc?en.loc+" ":"")+(en.title||"")).trim();
  const parts=[head, en.detail, en.material, (Number(en.cost)?won(en.cost):"")].map(x=>(x||"").toString().trim()).filter(Boolean);
  return cleanCell(parts.join("_"));
}
$("btnCopyExcel").addEventListener("click",()=>{
  const list=workList(); if(!list.length){ toast("복사할 내역이 없습니다"); return; }
  const text=list.map(workCopyLine).join("\n");
  copyText(text,"엑셀용으로 복사됨 (사진 제외)");
});
function copyText(text,msg){ const ok=()=>toast(msg); if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(ok).catch(()=>fallbackCopy(text,ok)); } else fallbackCopy(text,ok); }
function fallbackCopy(text,cb){ const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); try{document.execCommand("copy");cb();}catch(e){toast("복사 실패");} ta.remove(); }
$("btnBackup").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),entries},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`업무일지백업_${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); toast("백업 파일을 저장했습니다");
});

/* ===== 자가진단 ===== */
const DIAG_KINDS=[["work","업무"],["plan","오늘계획"],["memo","메모"],["call","통화"],["vacation","휴가"],["meeting","회의메모"],["deliver","전달사항"],["schedule","업무예정"],["filelink","파일링크"],["site","사이트"],["password","비밀번호"]];
function bytesOf(obj){ try{ return new Blob([JSON.stringify(obj)]).size; }catch(e){ return JSON.stringify(obj).length; } }
function fmtBytes(n){ if(n<1024) return n+" B"; if(n<1048576) return (n/1024).toFixed(1)+" KB"; return (n/1048576).toFixed(2)+" MB"; }
function renderDiag(){
  const box=$("diagStatus"); if(!box) return;
  const photoCount=entries.reduce((s,e)=>s+((e.photos&&e.photos.length)||0),0);
  const attachCount=entries.reduce((s,e)=>s+((e.attachments&&e.attachments.length)||0),0);
  const fileLinks=entries.filter(e=>e.kind==="filelink");
  const folderCnt=fileLinks.filter(e=>isFolder(e.path, e.ptype)).length;
  const fileCnt=fileLinks.length-folderCnt;
  const size=bytesOf(entries);
  let lsOk=true; try{ localStorage.setItem("wl_test","1"); localStorage.removeItem("wl_test"); }catch(e){ lsOk=false; }
  const rows=[
    ["버전", APP_VERSION],
    ["클라우드 연결", online?"✅ 연결됨":"⚠ 오프라인 (이 기기에 저장)"],
    ["프로젝트", firebaseConfig.projectId],
    ["로컬 저장소", lsOk?"✅ 정상":"⚠ 사용 불가"],
    ["마지막 오류", lastError?`❌ [${lastError.code}] ${lastError.message}`:"없음 ✅"],
    ["전체 기록 수", entries.length+"건"],
    ["사진 수", photoCount+"장"],
    ["첨부파일링크 수", attachCount+"개"],
    ["파일링크 (폴더/파일)", `${folderCnt}개 / ${fileCnt}개`],
    ["데이터 크기", fmtBytes(size)],
  ];
  const cnt={}; DIAG_KINDS.forEach(([k])=>cnt[k]=0); entries.forEach(e=>{ if(cnt[e.kind]!==undefined) cnt[e.kind]++; });
  const kindRows=DIAG_KINDS.map(([k,lbl])=>`<tr><td>${lbl}</td><td class="num">${cnt[k]}건</td></tr>`).join("");
  box.innerHTML=`<div class="table-wrap" style="min-width:0"><table class="rec" style="min-width:0">
    <tbody>${rows.map(r=>`<tr><td style="font-weight:700;color:#36699c;white-space:nowrap">${r[0]}</td><td style="white-space:normal;word-break:break-word">${esc(String(r[1]))}</td></tr>`).join("")}</tbody></table></div>
    <div class="table-wrap" style="min-width:0;margin-top:10px"><table class="rec" style="min-width:0">
    <thead><tr><th>항목</th><th style="text-align:right">기록 수</th></tr></thead><tbody>${kindRows}</tbody></table></div>`;
  renderDiagErrors();
}
function fmtTime(ts){ const d=new Date(ts); return `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`; }
function renderDiagErrors(){
  const box=$("diagErrors"); if(!box) return;
  if(!errorLog.length){ box.innerHTML=`<div class="empty" style="padding:14px">기록된 오류가 없습니다 🎉</div>`; return; }
  box.innerHTML=`<div class="sec-head">최근 오류 기록 <span class="cnt">${errorLog.length}</span></div>
    <div class="table-wrap"><table class="rec"><thead><tr><th>시각</th><th>위치</th><th>코드</th><th>메시지</th></tr></thead>
    <tbody>${errorLog.map(e=>`<tr><td style="white-space:nowrap">${fmtTime(e.at)}</td><td>${esc(e.where)}</td><td><span class="pill etc">${esc(e.code)}</span></td><td class="clip" title="${esc(e.message)}">${esc(e.message)}</td></tr>`).join("")}</tbody></table></div>`;
}
async function connTest(){
  if(typeof firebase==="undefined"||!db){ toast("Firebase 미초기화 — 오프라인 상태"); logErr("연결테스트", new Error("Firebase 미초기화")); return; }
  toast("연결 테스트 중…");
  const testId="zz_conntest_"+Date.now();
  try{
    await db.collection(COL).doc(testId).set({_t:Date.now(),_test:true});
    await db.collection(COL).doc(testId).get();
    await db.collection(COL).doc(testId).delete();
    online=true; setStatus(true); lastError=null; renderDiag();
    toast("✅ 연결 테스트 성공 — 읽기/쓰기 정상");
  }catch(e){
    online=false; setStatus(false); const r=logErr("연결테스트", e);
    toast(`❌ 실패 [${r.code}]`);
  }
}
function wireDiag(){
  $("diagRefresh").addEventListener("click",()=>{ renderDiag(); toast("진단을 새로 했습니다"); });
  $("diagConnTest").addEventListener("click",connTest);
  $("diagClearErr").addEventListener("click",()=>{ errorLog.length=0; lastError=null; renderDiag(); toast("오류 기록을 지웠습니다"); });
  $("diagBackup").addEventListener("click",doBackup);
  $("diagRestore").addEventListener("change",handleRestore);
  document.querySelectorAll("[data-csv]").forEach(b=>b.addEventListener("click",()=>exportCSV(b.dataset.csv)));
}
function doBackup(){
  const blob=new Blob([JSON.stringify({app:"업무일지",version:APP_VERSION,exportedAt:new Date().toISOString(),count:entries.length,entries},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`업무일지_전체백업_${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); toast("전체 백업을 저장했습니다");
}
function handleRestore(e){
  const file=e.target.files&&e.target.files[0]; e.target.value="";
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    let data; try{ data=JSON.parse(ev.target.result); }catch(err){ toast("백업 파일을 읽을 수 없습니다"); return; }
    const arr=Array.isArray(data)?data:(data.entries||[]);
    if(!Array.isArray(arr)||!arr.length){ toast("복구할 데이터가 없습니다"); return; }
    if(!confirm(`백업 파일에서 ${arr.length}건을 불러옵니다.\n기존 데이터에 합쳐지고, 같은 항목은 덮어쓰기 됩니다. 계속할까요?`)) return;
    const byId={}; entries.forEach(x=>{ if(x.id) byId[x.id]=x; });
    let added=0,updated=0;
    arr.forEach(rec=>{
      if(!rec||typeof rec!=="object") return;
      if(!rec.id) rec.id=genId();
      if(byId[rec.id]) updated++; else added++;
      byId[rec.id]=rec;
      if(online){ const {id,...p}=rec; db.collection(COL).doc(rec.id).set(p).catch(()=>{}); }
    });
    entries=Object.values(byId); lsSave(); renderAll();
    toast(`복구 완료 — 신규 ${added}건, 갱신 ${updated}건`);
  };
  reader.onerror=()=>toast("파일 읽기 실패");
  reader.readAsText(file);
}
const CSV_COLS={
  work:[["date","날짜"],["status","상태"],["floor","해당층"],["loc","위치"],["title","업무내역"],["detail","세부내용"],["field","분야"],["material","자재"],["cost","비용"],["improve","개선사항"]],
  plan:[["date","날짜"],["text","할일"],["done","완료"]],
  memo:[["date","날짜"],["title","제목"],["body","내용"]],
  call:[["date","날짜"],["time","시간"],["dir","구분"],["name","상대"],["phone","전화번호"],["content","통화내용"],["followup","조치"],["done","완료"]],
  vacation:[["name","이름"],["vtype","종류"],["start","시작일"],["end","종료일"],["note","메모"]],
  meeting:[["date","날짜"],["title","제목"],["attendees","참석자"],["body","내용"]],
  deliver:[["date","날짜"],["dtype","전달종류"],["title","제목"],["content","내용"],["done","완료"]],
  schedule:[["date","예정일"],["sStatus","상태"],["sType","종류"],["title","예정내용"],["memo","메모"]],
};
function csvCell(v){ if(v===true) return "완료"; if(v===false) return ""; let s=(v==null?"":String(v)); if(/[",\n\r]/.test(s)) s='"'+s.replace(/"/g,'""')+'"'; return s; }
function buildCSV(kind){
  const cols=CSV_COLS[kind]; if(!cols) return "";
  const rows=entries.filter(e=>e.kind===kind).sort((a,b)=>((b.date||b.start||"")+"").localeCompare((a.date||a.start||"")+""));
  const head=cols.map(c=>csvCell(c[1])).join(",");
  const body=rows.map(r=>cols.map(c=>csvCell(r[c[0]])).join(",")).join("\n");
  return head+(body?"\n"+body:"");
}
function downloadCSV(kind,label){
  const csv=buildCSV(kind);
  const rowCount=entries.filter(e=>e.kind===kind).length;
  if(!rowCount){ toast(`${label}: 내보낼 기록이 없습니다`); return false; }
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`업무일지_${label}_${todayStr()}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); return true;
}
function exportCSV(kind){
  if(kind==="all"){
    let n=0; DIAG_KINDS.forEach(([k,lbl])=>{ if(downloadCSV(k,lbl)) n++; });
    toast(n?`CSV ${n}개 파일을 내보냈습니다`:"내보낼 기록이 없습니다");
    return;
  }
  const lbl=(DIAG_KINDS.find(x=>x[0]===kind)||[,"데이터"])[1];
  if(downloadCSV(kind,lbl)) toast(`${lbl} CSV를 내보냈습니다`);
}

/* ===== 오늘계획 ===== */
let planFrom="", planTo="";
$("planAdd").addEventListener("click",addPlan);
$("planInput").addEventListener("keydown",e=>{ if(e.key==="Enter") addPlan(); });
function addPlan(){
  const text=$("planInput").value.trim(); if(!text){ toast("할 일을 입력하세요"); return; }
  addRecord({ kind:"plan", date:$("planDate").value||todayStr(), text, done:false, createdAt:Date.now() });
  $("planInput").value=""; renderPlan(); renderCalendar(); toast("추가됨");
}
function togglePlanDone(id){
  const p=entries.find(x=>x.id===id); if(!p) return;
  const newDone=!p.done;
  if(newDone){
    const w=addRecord({ kind:"work", date:p.date||todayStr(), status:"완료", floor:"", loc:"", title:p.text||"", detail:"", field:"기타", material:"", cost:0, improve:"", photos:[], fromPlan:true, createdAt:Date.now() });
    updateRecord(id,{done:true, loggedWorkId:w.id});
    toast("완료 — 업무일지에 기록됨");
  } else {
    if(p.loggedWorkId) deleteRecord(p.loggedWorkId);
    updateRecord(id,{done:false, loggedWorkId:""});
    toast("미완료로 이동");
  }
  renderAll();
}
function planItemHTML(p){
  return `<div class="sup-item ${p.done?"done":""}" data-kind="plan" data-id="${p.id}">
    <div class="cb">${p.done?"✓":""}</div>
    <div class="grow"><span class="txt">${esc(p.text||"")}</span> <span class="pdate">${p.date||""}</span></div>
    <button class="mini-btn" data-edit>수정</button><button class="mini-btn del" data-del>삭제</button></div>`;
}
function renderPlan(){
  const box=$("planList");
  const all=entries.filter(e=>e.kind==="plan" && inDateRange(e.date,planFrom,planTo) && matchObj(e,Q.plan));
  if(!all.length){ box.innerHTML=`<div class="empty">할 일을 추가해 보세요.</div>`; return; }
  const undone=all.filter(p=>!p.done).sort(byDateDesc);
  const done=all.filter(p=>p.done).sort(byDateDesc);
  let h=`<div class="sec-head">미완료 <span class="cnt">${undone.length}</span></div>`;
  h+= undone.length ? undone.map(planItemHTML).join("") : `<div class="empty" style="padding:14px">미완료 항목이 없어요 🎉</div>`;
  if(done.length) h+=`<div class="sec-head">완료 <span class="cnt">${done.length}</span></div>`+done.map(planItemHTML).join("");
  box.innerHTML=h;
  wireCards(box);
}
$("btnPlanExcel").addEventListener("click",()=>{
  const all=entries.filter(e=>e.kind==="plan" && inDateRange(e.date,planFrom,planTo) && matchObj(e,Q.plan)).sort(byDateDesc);
  if(!all.length){ toast("복사할 내역이 없습니다"); return; }
  const rows=all.map(p=>[p.date||"",cleanCell(p.text),p.done?"완료":"미완료"].map(x=>(x||"").toString().trim()).filter(Boolean).join("_"));
  copyText(rows.join("\n"),"엑셀용으로 복사됨");
});

/* ===== 카드형/목록형 ===== */
const viewMode={memo:"card",vacation:"card",meeting:"card"};
try{ const sv=JSON.parse(localStorage.getItem("wl_viewmode")||"{}"); Object.assign(viewMode,sv); }catch(e){}
function saveViewMode(){ try{ localStorage.setItem("wl_viewmode",JSON.stringify(viewMode)); }catch(e){} }
function wrapView(kind, list, cardFn){
  if(!list.length) return null;
  const mode=viewMode[kind]||"card";
  if(mode==="list"){
    return `<div class="list-rows compact">`+list.map(cardFn).join("")+`</div>`;
  }
  return `<div class="card-grid">`+list.map(cardFn).join("")+`</div>`;
}
function syncViewToggle(kind){
  const tg=document.querySelector(`.view-toggle[data-vt="${kind}"]`); if(!tg) return;
  tg.querySelectorAll("button").forEach(b=>b.classList.toggle("active", b.dataset.v===(viewMode[kind]||"card")));
}
document.querySelectorAll(".view-toggle[data-vt]").forEach(tg=>{
  const kind=tg.dataset.vt;
  tg.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    viewMode[kind]=b.dataset.v; saveViewMode(); syncViewToggle(kind);
    if(kind==="memo") renderMemo(); else if(kind==="vacation") renderVac(); else if(kind==="meeting") renderMeeting();
  }));
});

/* ===== 메모 ===== */
let memoFrom="", memoTo="";
function cardMemo(m){
  return `<div class="row-item" data-kind="memo" data-id="${m.id}">
    <div class="grow"><div class="t">${m.title?esc(m.title):"메모"}${(m.attachments&&m.attachments.length)?' 📎':''}</div>
    <div class="m" style="white-space:pre-wrap">${esc(m.body||"")}</div>${thumbsRO(m.photos)}${attachMiniRO(m.attachments)}
    <div class="card-acts"><button class="mini-btn" data-edit>수정</button><button class="mini-btn del" data-del>삭제</button></div></div>
    <span class="rtime">${m.date||""}<br>${clockStr(m.createdAt)}</span></div>`;
}
function memoFiltered(){ return entries.filter(e=>e.kind==="memo" && inDateRange(e.date,memoFrom,memoTo) && matchObj(e,Q.memo)).sort(byDateDesc); }
function renderMemo(){
  const box=$("memoList"); const list=memoFiltered();
  box.innerHTML = list.length ? wrapView("memo",list,cardMemo) : `<div class="empty">메모가 없습니다.</div>`;
  wireCards(box); syncViewToggle("memo");
}
$("btnMemoExcel").addEventListener("click",()=>{
  const list=memoFiltered(); if(!list.length){ toast("복사할 내역이 없습니다"); return; }
  const rows=list.map(m=>[cleanCell(m.title),cleanCell(m.body)].map(x=>(x||"").toString().trim()).filter(Boolean).join("_"));
  copyText(rows.join("\n"),"엑셀용으로 복사됨");
});

/* ===== 통화 ===== */
$("callFrom").addEventListener("change",renderCall);
$("callTo").addEventListener("change",renderCall);
$("callRangeClear").addEventListener("click",()=>{ $("callFrom").value=""; $("callTo").value=""; renderCall(); });
let callDir="전체";
function renderCallDirChips(){
  const opts=["전체",...CALLDIR];
  $("callDirChips").innerHTML=opts.map(o=>`<button class="chip ${o===callDir?"active":""}" data-cd="${o}">${o}</button>`).join("");
  $("callDirChips").querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{ callDir=b.dataset.cd; renderCall(); }));
}
function callFiltered(){
  const f=$("callFrom").value, t=$("callTo").value;
  return entries.filter(e=>e.kind==="call" && inDateRange(e.date,f,t) && (callDir==="전체"||e.dir===callDir) && matchObj(e,Q.call))
    .sort((a,b)=>((b.date||"")+(b.time||"")).localeCompare((a.date||"")+(a.time||"")));
}
function renderCall(){
  renderCallDirChips();
  const body=$("callBody"); const list=callFiltered();
  if(!list.length){ body.innerHTML=`<tr><td colspan="9" class="empty">통화 기록이 없습니다.</td></tr>`; return; }
  body.innerHTML=list.map(c=>`<tr data-id="${c.id}">
    <td>${c.date||""}</td><td>${esc(c.time||"")}</td>
    <td><span class="dir ${c.dir==="발신"?"out":"in"}">${esc(c.dir||"")}</span></td>
    <td>${esc(c.name||"")}</td>
    <td>${c.phone?`<a href="tel:${esc(c.phone)}" class="tel" data-tel="${esc(c.phone)}" title="클릭: 휴대폰은 바로 통화 / PC는 번호 복사">📞 ${esc(c.phone)}</a>`:""}</td>
    <td class="clip" data-tip="${esc(c.content||"")}" title="${esc(c.content||"")}">${esc(c.content||"")}</td>
    <td class="clip" data-tip="${esc(c.followup||"")}" title="${esc(c.followup||"")}">${esc(c.followup||"")}</td>
    <td style="text-align:center"><input type="checkbox" class="ccheck" title="후속조치 완료 표시" ${c.done?"checked":""}></td>
    <td><button class="rowdel" data-del="${c.id}" title="삭제">🗑</button></td></tr>`).join("");
  body.querySelectorAll("tr[data-id]").forEach(tr=>{
    tr.addEventListener("click",e=>{ if(e.target.closest("a,button,input")) return; openViewer("call",tr.dataset.id); });
    const cb=tr.querySelector(".ccheck"); cb.addEventListener("change",()=>updateRecord(tr.dataset.id,{done:cb.checked}));
    tr.querySelector("[data-del]").addEventListener("click",e=>{ e.stopPropagation(); deleteWithUndo(tr.dataset.id, "통화"); });
    // v21: 전화번호 클릭 → 모바일이면 자동통화, PC면 번호 복사
    const telLink=tr.querySelector("[data-tel]");
    if(telLink) telLink.addEventListener("click",e=>{
      const num=telLink.dataset.tel;
      const isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if(!isMobile){
        e.preventDefault();
        copyText(num, `📞 ${num} 복사됨 — 휴대폰에서 통화하세요`);
      }
      // 모바일이면 그대로 tel: 링크 작동
    });
  });
}
$("btnCallExcel").addEventListener("click",()=>{
  const list=callFiltered(); if(!list.length){ toast("복사할 내역이 없습니다"); return; }
  const rows=list.map(c=>[c.date||"",c.dir||"",cleanCell(c.name),cleanCell(c.phone),cleanCell(c.content),cleanCell(c.followup)].map(x=>(x||"").toString().trim()).filter(Boolean).join("_"));
  copyText(rows.join("\n"),"엑셀용으로 복사됨");
});

/* ===== 휴가 ===== */
function cardVac(v){
  const range = (v.end&&v.end!==v.start) ? `${v.start} ~ ${v.end}` : (v.start||"");
  return `<div class="row-item" data-kind="vacation" data-id="${v.id}">
    <div class="grow"><div class="t">${esc(v.name||"")} <span class="pill leave">${esc(v.vtype||"")}</span></div>
    <div class="m">🌴 ${esc(range)}${v.note?" · "+esc(v.note):""}</div>
    <div class="card-acts"><button class="mini-btn" data-edit>수정</button><button class="mini-btn del" data-del>삭제</button></div></div></div>`;
}
function renderVac(){
  const box=$("vacList"); const list=listOf("vacation").sort((a,b)=>(b.start||"").localeCompare(a.start||""));
  box.innerHTML = list.length ? wrapView("vacation",list,cardVac) : `<div class="empty">휴가 기록이 없습니다.</div>`;
  wireCards(box); syncViewToggle("vacation");
}

/* ===== 회의메모 ===== */
function cardMeeting(t){
  return `<div class="row-item" data-kind="meeting" data-id="${t.id}">
    <div class="grow"><div class="t">${esc(t.title||"회의")}${(t.attachments&&t.attachments.length)?' 📎':''}</div>
    <div class="m">${t.attendees?"👥 "+esc(t.attendees):""}${t.body?`<br>📄 <span style="white-space:pre-wrap">${esc(t.body)}</span>`:""}</div>${thumbsRO(t.photos)}${attachMiniRO(t.attachments)}
    <div class="card-acts"><button class="mini-btn" data-edit>수정</button><button class="mini-btn del" data-del>삭제</button></div></div>
    <span class="rtime">${t.date||""}</span></div>`;
}
function renderMeeting(){
  const box=$("meetList"); const list=listOf("meeting").sort(byDateDesc);
  box.innerHTML = list.length ? wrapView("meeting",list,cardMeeting) : `<div class="empty">회의메모가 없습니다.</div>`;
  wireCards(box); syncViewToggle("meeting");
}

/* ===== 전달사항 ===== */
function cardDeliver(d){
  const dt=d.dtype||"즉시전달";
  const dtCls = dt==="주간전달" ? "leave" : "tech";
  return `<div class="row-item" data-kind="deliver" data-id="${d.id}">
    <div class="grow"><div class="t">📢 ${d.title?esc(d.title):"전달사항"} <span class="pill ${dtCls}">${esc(dt)}</span></div>
    <div class="m" style="white-space:pre-wrap">${esc(d.content||"")}</div>
    <div class="card-acts"><button class="mini-btn" data-edit>수정</button><button class="mini-btn del" data-del>삭제</button></div></div>
    <span class="rtime">${d.date||""}</span></div>`;
}
let delFrom="", delTo="", delDtype="전체";
function deliverFiltered(){
  return entries.filter(e=>e.kind==="deliver"
    && inDateRange(e.date,delFrom,delTo)
    && (delDtype==="전체"||(e.dtype||"즉시전달")===delDtype)
    && matchObj(e,Q.deliver)).sort(byDateDesc);
}
function renderDeliverDtypeChips(){
  const box=$("delDtypeChips");
  if(!box) return;
  const opts=["전체","즉시전달","주간전달"];
  box.innerHTML=opts.map(o=>`<button class="chip ${o===delDtype?"active":""}" data-dt="${o}">${o}</button>`).join("");
  box.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{ delDtype=b.dataset.dt; renderDeliver(); }));
}
function renderDeliver(){
  renderDeliverDtypeChips();
  const body=$("delBody"); const list=deliverFiltered();
  if(!list.length){ body.innerHTML=`<tr><td colspan="6" class="empty">전달사항이 없습니다.</td></tr>`; return; }
  body.innerHTML=list.map(d=>{
    const dt=d.dtype||"즉시전달";
    const dtCls = dt==="주간전달" ? "leave" : "tech";
    return `<tr data-id="${d.id}">
    <td>${d.date||""}</td>
    <td><span class="pill ${dtCls}">${esc(dt)}</span></td>
    <td>${esc(d.title||"")}</td>
    <td class="clip" data-tip="${esc(d.content||"")}" title="${esc(d.content||"")}">${esc(d.content||"")}</td>
    <td style="text-align:center"><input type="checkbox" class="ccheck" title="전달 완료 표시" ${d.done?"checked":""}></td>
    <td><button class="rowdel" data-del="${d.id}" title="삭제">🗑</button></td></tr>`;
  }).join("");
  body.querySelectorAll("tr[data-id]").forEach(tr=>{
    tr.addEventListener("click",e=>{ if(e.target.closest("a,button,input")) return; openViewer("deliver",tr.dataset.id); });
    const cb=tr.querySelector(".ccheck"); cb.addEventListener("change",()=>updateRecord(tr.dataset.id,{done:cb.checked}));
    tr.querySelector("[data-del]").addEventListener("click",e=>{ e.stopPropagation(); deleteWithUndo(tr.dataset.id, "전달사항"); });
  });
}
$("btnDelExcel").addEventListener("click",()=>{
  const list=deliverFiltered(); if(!list.length){ toast("복사할 내역이 없습니다"); return; }
  const rows=list.map(d=>[d.date||"",d.dtype||"즉시전달",cleanCell(d.title),cleanCell(d.content)].map(x=>(x||"").toString().trim()).filter(Boolean).join("_"));
  copyText(rows.join("\n"),"엑셀용으로 복사됨");
});

/* 업무 카드(달력 상세) */
function cardWork(en){
  return `<div class="row-item" data-kind="work" data-id="${en.id}">
    <div class="grow"><div class="t">${esc(en.title||"")} <span class="st ${statusClass(en.status)}">${esc(en.status||"")}</span> <span class="pill ${fieldClass(en.field)}">${esc(en.field||"")}</span>${(en.attachments&&en.attachments.length)?' 📎':''}</div>
    <div class="m">${metaLine([en.floor,en.loc,en.detail,en.cost?won(en.cost)+"원":""])}</div>${thumbsRO(en.photos)}${attachMiniRO(en.attachments)}</div></div>`;
}

/* ===== 달력 (v21: 업무/스케줄 모드 + 월간/연간 뷰) ===== */
let calY,calM,selDay=null;
let calMode="work";   // "work" or "schedule"
let calView="month";  // "month" or "year"
(function(){ const d=new Date(); calY=d.getFullYear(); calM=d.getMonth(); })();
function bindCalControls(){
  // 한 번만 바인딩
  if($("calPrev")._bound) return;
  $("calPrev")._bound=true;
  $("calPrev").addEventListener("click",()=>{
    if(calView==="year"){ calY--; }
    else { calM--; if(calM<0){calM=11;calY--;} }
    selDay=null; renderCalendar();
  });
  $("calNext").addEventListener("click",()=>{
    if(calView==="year"){ calY++; }
    else { calM++; if(calM>11){calM=0;calY++;} }
    selDay=null; renderCalendar();
  });
  $("calToday").addEventListener("click",()=>{ const d=new Date(); calY=d.getFullYear(); calM=d.getMonth(); selDay=todayStr(); renderCalendar(); });
  $("calPrint").addEventListener("click",printCalendar);
  // 모드 전환 (업무/스케줄)
  document.querySelectorAll("[data-calmode]").forEach(b=>b.addEventListener("click",()=>{
    calMode=b.dataset.calmode;
    document.querySelectorAll("[data-calmode]").forEach(x=>x.classList.toggle("active",x===b));
    selDay=null; renderCalendar();
  }));
  // 뷰 전환 (월/연)
  document.querySelectorAll("[data-calview]").forEach(b=>b.addEventListener("click",()=>{
    calView=b.dataset.calview;
    document.querySelectorAll("[data-calview]").forEach(x=>x.classList.toggle("active",x===b));
    selDay=null; renderCalendar();
  }));
  // 스케줄 빠른 추가 버튼
  $("calQuickAdd").addEventListener("click",()=>{
    const d=selDay||todayStr();
    openEditor("schedule",null);
    setTimeout(()=>{ const el=$("m-date"); if(el) el.value=d; },50);
  });
}
function dateLabel(k){ if(!k) return "(날짜없음)"; const [y,m,d]=k.split("-"); const w=["일","월","화","수","목","금","토"][new Date(k+"T00:00:00").getDay()]; return `${Number(m)}월 ${Number(d)}일 (${w})`; }
function otherText(o){ if(o.kind==="plan") return o.text||"계획"; if(o.kind==="memo") return o.title||o.body||"메모"; if(o.kind==="call") return o.name||o.content||"통화"; if(o.kind==="meeting") return o.title||"회의"; if(o.kind==="deliver") return o.title||o.content||"전달"; if(o.kind==="schedule") return o.title||"예정"; return ""; }
const CAL_KIND_COLOR={work:"#3f7cb8",vacation:"#9a6f17",plan:"#15803d",call:"#0e7490",memo:"#7c3aed",meeting:"#334155",deliver:"#be123c",schedule:"#0891b2"};
const CAL_KIND_LABEL={work:"🛠 업무",vacation:"🌴 휴가",plan:"📋 계획",call:"📞 통화",memo:"📝 메모",meeting:"👥 회의",deliver:"📢 전달",schedule:"📅 예정"};
const OTHER_ORDER=["plan","call","memo","meeting","deliver"];
function scheduleStatusColor(s){
  return s==="완료"?"var(--mint)":s==="진행중"?"var(--gold)":s==="연기"?"#999":"#0891b2";
}
function scheduleStatusHex(s){
  return s==="완료"?"#15803d":s==="진행중"?"#b45309":s==="연기"?"#666":"#0891b2";
}
function renderCalendar(){
  bindCalControls();
  // 모드/뷰 버튼 active 상태 동기화
  document.querySelectorAll("[data-calmode]").forEach(b=>b.classList.toggle("active", b.dataset.calmode===calMode));
  document.querySelectorAll("[data-calview]").forEach(b=>b.classList.toggle("active", b.dataset.calview===calView));
  // 빠른추가 버튼은 스케줄 모드일 때만 표시
  $("calQuickAdd").style.display = calMode==="schedule" ? "" : "none";
  if(calView==="year"){
    renderYearView();
  } else {
    renderMonthView();
  }
}
function renderMonthView(){
  $("calMonth").textContent=`${calY}년 ${calM+1}월`;
  $("calGrid").style.display="";
  $("calYearGrid").style.display="none";
  const first=new Date(calY,calM,1).getDay(), days=new Date(calY,calM+1,0).getDate();
  // 업무 모드 데이터
  const work={}, vac={}, other={}, sched={};
  entries.forEach(e=>{
    if(e.kind==="work"&&e.date){ (work[e.date]=work[e.date]||[]).push(e); }
    else if(e.kind==="vacation"){ datesBetween(e.start,e.end).forEach(d=>{ (vac[d]=vac[d]||[]).push(e.name||"휴가"); }); }
    else if(e.kind==="schedule"&&e.date){ (sched[e.date]=sched[e.date]||[]).push(e); }
    else if(["plan","memo","call","meeting","deliver"].includes(e.kind)&&e.date){ (other[e.date]=other[e.date]||[]).push(e); }
  });
  const dow=["일","월","화","수","목","금","토"];
  let html=dow.map((d,i)=>`<div class="cal-dow ${i===0?"sun":""}">${d}</div>`).join("");
  for(let i=0;i<first;i++) html+=`<div class="cal-cell empty-cell"></div>`;
  for(let d=1;d<=days;d++){
    const ds=`${calY}-${String(calM+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const wd=new Date(calY,calM,d).getDay(); const cls=["cal-cell"];
    if(wd===0) cls.push("sun"); if(ds===todayStr()) cls.push("today"); if(ds===selDay) cls.push("sel");
    let inner=""; let hasContent=false;
    if(calMode==="schedule"){
      const sArr=sched[ds]||[]; const vArr=vac[ds]||[];
      if(sArr.length){
        hasContent=true;
        let b=""; sArr.forEach(s=> b+=`<div class="wtitle"><span class="d" style="background:${scheduleStatusColor(s.sStatus)}"></span><span class="wt">${esc(s.title||"")}${s.sType?" ["+esc(s.sType)+"]":""}</span></div>`);
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR.schedule}">${CAL_KIND_LABEL.schedule} ${sArr.length}</div>${b}</div>`;
      }
      if(vArr.length){
        hasContent=true;
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR.vacation}">${CAL_KIND_LABEL.vacation}</div><div class="vac">${esc(vArr.join(", "))}</div></div>`;
      }
    } else {
      const wArr=work[ds]||[]; const vArr=vac[ds]||[]; const oArr=other[ds]||[]; const sArr=sched[ds]||[];
      if(wArr.length){
        hasContent=true;
        let b=""; wArr.forEach(en=> b+=`<div class="wtitle"><span class="d" style="background:${statusColor(en.status)}"></span><span class="wt">${esc(((en.floor?en.floor+" ":"")+(en.loc?en.loc+" ":"")+(en.title||"")).trim())}</span></div>`);
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR.work}">${CAL_KIND_LABEL.work} ${wArr.length}</div>${b}</div>`;
      }
      if(vArr.length){
        hasContent=true;
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR.vacation}">${CAL_KIND_LABEL.vacation}</div><div class="vac">${esc(vArr.join(", "))}</div></div>`;
      }
      // 업무 달력에서도 스케줄을 작게 표시
      if(sArr.length){
        hasContent=true;
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR.schedule}">${CAL_KIND_LABEL.schedule} ${sArr.length}</div>${sArr.map(s=>`<div class="otitle">${esc(s.title||"")}</div>`).join("")}</div>`;
      }
      OTHER_ORDER.forEach(k=>{
        const arr=oArr.filter(o=>o.kind===k); if(!arr.length) return;
        hasContent=true;
        const b=arr.map(o=>`<div class="otitle">${esc(otherText(o))}</div>`).join("");
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR[k]}">${CAL_KIND_LABEL[k]} ${arr.length}</div>${b}</div>`;
      });
    }
    if(hasContent) cls.push("has");
    html+=`<div class="${cls.join(" ")}" data-d="${ds}"><span class="dnum">${d}</span>${inner}</div>`;
  }
  $("calGrid").innerHTML=html;
  $("calGrid").querySelectorAll("[data-d]").forEach(el=>{
    el.addEventListener("click",()=>{ selDay=el.dataset.d; renderCalendar(); });
    // 스케줄 모드에서 빈 셀 더블클릭 → 빠른 추가
    el.addEventListener("dblclick",()=>{
      if(calMode==="schedule"){
        const d=el.dataset.d;
        openEditor("schedule",null);
        setTimeout(()=>{ const e=$("m-date"); if(e) e.value=d; },50);
      }
    });
  });
  renderDayDetail();
}
function renderYearView(){
  $("calMonth").textContent=`${calY}년 연간 계획표`;
  $("calGrid").style.display="none";
  $("calYearGrid").style.display="";
  // 데이터 수집
  const work={}, vac={}, sched={};
  entries.forEach(e=>{
    if(e.kind==="work"&&e.date && e.date.startsWith(String(calY))){ (work[e.date]=work[e.date]||[]).push(e); }
    else if(e.kind==="vacation"){ datesBetween(e.start,e.end).forEach(d=>{ if(d.startsWith(String(calY))) (vac[d]=vac[d]||[]).push(e); }); }
    else if(e.kind==="schedule"&&e.date && e.date.startsWith(String(calY))){ (sched[e.date]=sched[e.date]||[]).push(e); }
  });
  // 표 형식 연간 계획표 (세로:1~31일, 가로:1~12월)
  let html=`<table class="yp-table"><thead><tr><th class="yp-corner">일\\월</th>`;
  for(let m=0;m<12;m++) html+=`<th class="yp-mh">${m+1}월</th>`;
  html+=`</tr></thead><tbody>`;
  for(let d=1;d<=31;d++){
    html+=`<tr><th class="yp-dh">${d}</th>`;
    for(let m=0;m<12;m++){
      const lastDay=new Date(calY,m+1,0).getDate();
      if(d>lastDay){ html+=`<td class="yp-empty"></td>`; continue; }
      const ds=`${calY}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const wd=new Date(calY,m,d).getDay();
      const sArr=sched[ds]||[], wArr=work[ds]||[], vArr=vac[ds]||[];
      const cls=["yp-cell"];
      if(wd===0) cls.push("sun");
      if(wd===6) cls.push("sat");
      if(ds===todayStr()) cls.push("today");
      let content="";
      if(calMode==="schedule"){
        if(sArr.length){
          sArr.slice(0,4).forEach(s=>{
            const bg=scheduleStatusHex(s.sStatus);
            content+=`<div class="yp-s" style="background:${bg};color:#fff" title="${esc(s.title||"")} (${esc(s.sStatus||"예정")})">${esc(s.title||"")}</div>`;
          });
          if(sArr.length>4) content+=`<div class="yp-more">+${sArr.length-4}건 더</div>`;
        }
        if(vArr.length) content+=`<div class="yp-v">🌴 ${esc(vArr[0].name||"")}${vArr.length>1?` 외 ${vArr.length-1}`:""}</div>`;
      } else {
        if(wArr.length) content+=`<div class="yp-w">🛠 업무 ${wArr.length}건</div>`;
        if(sArr.length){
          sArr.slice(0,2).forEach(s=> content+=`<div class="yp-s yp-mini" style="background:#0891b2;color:#fff">📅 ${esc(s.title||"")}</div>`);
          if(sArr.length>2) content+=`<div class="yp-more">+${sArr.length-2}</div>`;
        }
        if(vArr.length) content+=`<div class="yp-v">🌴 ${esc(vArr[0].name||"")}</div>`;
      }
      // 툴팁 정보
      let tt = ds + " ("+["일","월","화","수","목","금","토"][wd]+")";
      if(sArr.length){ tt += "\n📅 " + sArr.map(s=>`${s.title}[${s.sStatus||"예정"}]`).join(", "); }
      if(wArr.length){ tt += "\n🛠 업무 " + wArr.length + "건"; }
      if(vArr.length){ tt += "\n🌴 " + vArr.map(v=>v.name||"휴가").join(", "); }
      html+=`<td class="${cls.join(" ")}" data-d="${ds}" title="${esc(tt)}">${content}</td>`;
    }
    html+=`</tr>`;
  }
  html+=`</tbody></table>`;
  $("calYearGrid").innerHTML=html;
  $("calYearGrid").querySelectorAll("[data-d]").forEach(el=>el.addEventListener("click",()=>{
    const ds=el.dataset.d;
    const [y,m]=ds.split("-").map(Number);
    calY=y; calM=m-1; selDay=ds; calView="month";
    document.querySelectorAll("[data-calview]").forEach(b=>b.classList.toggle("active", b.dataset.calview==="month"));
    renderCalendar();
  }));
}
function renderDayDetail(){
  const box=$("dayDetail"); if(!selDay){ box.innerHTML=""; return; }
  const w=entries.filter(e=>e.kind==="work"&&e.date===selDay).sort(byDateDesc);
  const v=entries.filter(e=>e.kind==="vacation"&&datesBetween(e.start,e.end).includes(selDay));
  const p=entries.filter(e=>e.kind==="plan"&&e.date===selDay);
  const m=entries.filter(e=>e.kind==="memo"&&e.date===selDay).sort(byDateDesc);
  const c=entries.filter(e=>e.kind==="call"&&e.date===selDay);
  const mt=entries.filter(e=>e.kind==="meeting"&&e.date===selDay).sort(byDateDesc);
  const dv=entries.filter(e=>e.kind==="deliver"&&e.date===selDay).sort(byDateDesc);
  const sc=entries.filter(e=>e.kind==="schedule"&&e.date===selDay).sort(byDateDesc);
  let h=`<div class="list-head"><h2 style="font-size:16px">${dateLabel(selDay)}</h2>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${calMode==="schedule"?`<button class="btn btn-primary btn-sm" id="addSchedBtn">➕ 예정 추가</button>`:""}
      <button class="btn btn-ghost btn-sm" id="repBtn">🖨 이 날 보고서</button>
    </div></div>`;
  const wireRep=()=>{
    const rb=$("repBtn"); if(rb) rb.addEventListener("click",()=>printReport(selDay));
    const ab=$("addSchedBtn"); if(ab) ab.addEventListener("click",()=>{
      openEditor("schedule",null);
      setTimeout(()=>{ const e=$("m-date"); if(e) e.value=selDay; },50);
    });
  };
  if(!(w.length||v.length||p.length||m.length||c.length||mt.length||dv.length||sc.length)){
    box.innerHTML=h+`<div class="empty">이 날의 기록이 없습니다.</div>`; wireRep(); return;
  }
  if(sc.length) h+=`<div class="detail-block"><div class="bh">📅 업무예정</div>${sc.map(cardSchedule).join("")}</div>`;
  if(v.length) h+=`<div class="detail-block"><div class="bh">🌴 휴가</div>${v.map(cardVac).join("")}</div>`;
  if(w.length) h+=`<div class="detail-block"><div class="bh">🛠 업무</div>${w.map(cardWork).join("")}</div>`;
  if(p.length) h+=`<div class="detail-block"><div class="bh">📋 오늘계획</div>${p.map(planItemHTML).join("")}</div>`;
  if(c.length) h+=`<div class="detail-block"><div class="bh">📞 통화</div>${c.map(cc=>`<div class="row-item" data-kind="call" data-id="${cc.id}"><div class="grow"><div class="t">${esc(cc.name||"(상대)")} <span class="dir ${cc.dir==="발신"?"out":"in"}">${esc(cc.dir||"")}</span></div><div class="m">${cc.phone?"☎ "+esc(cc.phone)+" · ":""}${esc(cc.content||"")}</div></div></div>`).join("")}</div>`;
  if(m.length) h+=`<div class="detail-block"><div class="bh">📝 메모</div>${m.map(cardMemo).join("")}</div>`;
  if(mt.length) h+=`<div class="detail-block"><div class="bh">👥 회의</div>${mt.map(cardMeeting).join("")}</div>`;
  if(dv.length) h+=`<div class="detail-block"><div class="bh">📢 전달사항</div>${dv.map(cardDeliver).join("")}</div>`;
  box.innerHTML=h;
  wireCards(box);
  wireRep();
}
function cardSchedule(s){
  const st=s.sStatus||"예정";
  const stCls = st==="완료"?"done":st==="진행중"?"prog":st==="연기"?"etc":"todo";
  return `<div class="row-item" data-kind="schedule" data-id="${s.id}">
    <div class="grow"><div class="t">📅 ${esc(s.title||"")} <span class="st ${stCls}">${esc(st)}</span> <span class="pill etc">${esc(s.sType||"")}</span></div>
    <div class="m">${s.memo?esc(s.memo):""}</div>
    <div class="card-acts"><button class="mini-btn" data-edit>수정</button><button class="mini-btn del" data-del>삭제</button></div></div>
    <span class="rtime">${s.date||""}</span></div>`;
}
function buildReport(day){
  const D=(x)=>(x||"").toString().trim();
  day=D(day);
  const w=entries.filter(e=>e.kind==="work"&&D(e.date)===day).sort(byDateDesc);
  const v=entries.filter(e=>e.kind==="vacation"&&datesBetween(e.start,e.end).includes(day));
  const p=entries.filter(e=>e.kind==="plan"&&D(e.date)===day);
  const m=entries.filter(e=>e.kind==="memo"&&D(e.date)===day).sort(byDateDesc);
  const c=entries.filter(e=>e.kind==="call"&&D(e.date)===day);
  const mt=entries.filter(e=>e.kind==="meeting"&&D(e.date)===day).sort(byDateDesc);
  const dv=entries.filter(e=>e.kind==="deliver"&&D(e.date)===day).sort(byDateDesc);
  let h=`<h1>업무일지 보고서</h1><div class="sub">${dateLabel(day)} · 출력일 ${todayStr()}</div>`;
  const sec=(title,items,cls)=> items.length?`<div class="rsec ${cls}"><h2>${title} (${items.length}건)</h2>`+items.join("")+`</div>`:"";
  h+=sec("업무", w.map(en=>`<div class="it"><b>[${esc(en.status||"")}]</b> ${esc(en.floor||"")} ${esc(en.loc||"")} ${esc(en.title||"")}${en.detail?" — "+esc(en.detail):""}${en.field?" ["+esc(en.field)+"]":""}${en.material?" / 자재: "+esc(en.material):""}${Number(en.cost)?" / "+won(en.cost)+"원":""}${en.improve?"<br>↳ 개선: "+esc(en.improve):""}</div>`), "work");
  h+=sec("휴가", v.map(x=>`<div class="it">🌴 ${esc(x.name||"")} (${esc(x.vtype||"")}) ${x.end&&x.end!==x.start?esc(x.start)+" ~ "+esc(x.end):esc(x.start||"")}${x.note?" — "+esc(x.note):""}</div>`), "vac");
  h+=sec("오늘계획", p.map(x=>`<div class="it">${x.done?"☑":"☐"} ${esc(x.text||"")}</div>`), "plan");
  h+=sec("통화", c.map(x=>`<div class="it">[${esc(x.dir||"")}] ${esc(x.time||"")} ${esc(x.name||"")} ${esc(x.phone||"")} — ${esc(x.content||"")}${x.followup?" / 조치: "+esc(x.followup):""}${x.done?" (완료)":""}</div>`), "call");
  h+=sec("메모", m.map(x=>`<div class="it"><b>${esc(x.title||"메모")}</b> ${esc(x.body||"")}</div>`), "memo");
  h+=sec("회의메모", mt.map(x=>`<div class="it"><b>${esc(x.title||"회의")}</b>${x.attendees?" (참석: "+esc(x.attendees)+")":""}<br>${esc(x.body||"")}</div>`), "meet");
  h+=sec("전달사항", dv.map(x=>`<div class="it">📢 <b>${esc(x.title||"")}</b> ${esc(x.content||"")}</div>`), "deliver");
  if(!(w.length||v.length||p.length||m.length||c.length||mt.length||dv.length)) h+=`<div class="it">이 날의 기록이 없습니다.</div>`;
  return h;
}
function printReport(day){ if(!day) return; $("printArea").className=""; $("printArea").innerHTML=buildReport(day); window.print(); }

function buildCalendarPrint(){
  const work={}, vac={}, other={};
  entries.forEach(e=>{
    if(e.kind==="work"&&e.date){ (work[e.date]=work[e.date]||[]).push(e); }
    else if(e.kind==="vacation"){ datesBetween(e.start,e.end).forEach(d=>{ (vac[d]=vac[d]||[]).push(e.name||"휴가"); }); }
    else if(["plan","memo","call","meeting","deliver"].includes(e.kind)&&e.date){ (other[e.date]=other[e.date]||[]).push(e); }
  });
  const first=new Date(calY,calM,1).getDay(), days=new Date(calY,calM+1,0).getDate();
  const cells=[]; for(let i=0;i<first;i++) cells.push(null);
  for(let d=1;d<=days;d++) cells.push(`${calY}-${String(calM+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  while(cells.length%7) cells.push(null);
  const dow=["일","월","화","수","목","금","토"];
  let h=`<h1>${calY}년 ${calM+1}월 업무 달력</h1>`;
  h+=`<table class="pcal"><thead><tr>`+dow.map((d,i)=>`<th class="${i===0?"sun":""}">${d}</th>`).join("")+`</tr></thead><tbody>`;
  for(let r=0;r<cells.length/7;r++){
    h+="<tr>";
    for(let c=0;c<7;c++){
      const ds=cells[r*7+c];
      if(!ds){ h+="<td></td>"; continue; }
      const dnum=Number(ds.split("-")[2]);
      let inner=`<div class="pd">${dnum}</div>`;
      const wA=work[ds]||[], oA=other[ds]||[];
      if(wA.length){ inner+=`<div class="pgh" style="color:${CAL_KIND_COLOR.work}">${CAL_KIND_LABEL.work}</div>`; wA.forEach(en=> inner+=`<div class="pw"><b style="color:${statusHex(en.status)}">●</b> ${esc(((en.floor?en.floor+" ":"")+(en.loc?en.loc+" ":"")+(en.title||"")).trim())}</div>`); }
      if(vac[ds]) inner+=`<div class="pgh" style="color:${CAL_KIND_COLOR.vacation}">${CAL_KIND_LABEL.vacation}</div><div class="pv">${esc(vac[ds].join(", "))}</div>`;
      OTHER_ORDER.forEach(k=>{ const arr=oA.filter(o=>o.kind===k); if(!arr.length) return; inner+=`<div class="pgh" style="color:${CAL_KIND_COLOR[k]}">${CAL_KIND_LABEL[k]}</div>`+arr.map(o=>`<div class="po">${esc(otherText(o))}</div>`).join(""); });
      h+=`<td class="${c===0?"sun":""}">${inner}</td>`;
    }
    h+="</tr>";
  }
  h+="</tbody></table>";
  return h;
}
function statusHex(s){ return s==="완료"?"#15803d":s==="진행중"?"#b45309":"#c0392b"; }
function printCalendar(){ $("printArea").className="calmode"; $("printArea").innerHTML=buildCalendarPrint(); window.print(); }
$("calPrint").addEventListener("click",printCalendar);

/* =========================================================
   v16 신규 — 파일링크 / 사이트 / 비밀번호 / 카테고리 관리
   ========================================================= */

/* ===== 활성 탭 감지 (비번 자동잠금용) ===== */
function onTabChange(name){
  if(name!=="password") { masterKey=null; pwShownIds.clear(); }
  if(name==="password") renderPassword();
}

/* ===== 카테고리 필터 상태 ===== */
const CAT_FILTER = { filelink:{cat:"전체",sub:"전체",q:"",type:"all"}, site:{cat:"전체",sub:"전체",q:""}, password:{cat:"전체",sub:"전체",q:""} };

/* ===== v17 보기 모드 / 정렬 / 컴팩트 / 접기 상태 ===== */
const VIEW_PREFS_LS = "wl_view_prefs_v17";
const VIEW_PREFS = {
  filelink:{ mode:"card", sort:"name", compact:false, collapsed:{} },
  site:{ mode:"card", sort:"name", compact:false, collapsed:{} },
  password:{ mode:"card", sort:"name", compact:false, collapsed:{} },
};
function loadViewPrefs(){
  try{
    const s=JSON.parse(localStorage.getItem(VIEW_PREFS_LS)||"null");
    if(s){ ["filelink","site","password"].forEach(k=>{ if(s[k]) Object.assign(VIEW_PREFS[k], s[k]); if(s[k] && !s[k].collapsed) VIEW_PREFS[k].collapsed={}; }); }
  }catch(e){}
}
function saveViewPrefs(){ try{ localStorage.setItem(VIEW_PREFS_LS, JSON.stringify(VIEW_PREFS)); }catch(e){} }
function bindViewControls(kind){
  // 보기 모드 버튼
  document.querySelectorAll(`.view-mode-group[data-vm="${kind}"] button`).forEach(b=>{
    b.classList.toggle("active", b.dataset.v===VIEW_PREFS[kind].mode);
    if(!b._bound){ b._bound=true; b.addEventListener("click",()=>{
      VIEW_PREFS[kind].mode=b.dataset.v; saveViewPrefs(); renderKind(kind);
    }); }
  });
  // 정렬 셀렉트
  const sel=document.querySelector(`.sort-select[data-sort="${kind}"]`);
  if(sel){ sel.value=VIEW_PREFS[kind].sort; if(!sel._bound){ sel._bound=true; sel.addEventListener("change",()=>{
    VIEW_PREFS[kind].sort=sel.value; saveViewPrefs(); renderKind(kind);
  }); } }
  // 컴팩트 토글
  const cb=document.querySelector(`[data-compact="${kind}"]`);
  if(cb){ cb.classList.toggle("active", !!VIEW_PREFS[kind].compact); if(!cb._bound){ cb._bound=true; cb.addEventListener("click",()=>{
    VIEW_PREFS[kind].compact=!VIEW_PREFS[kind].compact; saveViewPrefs(); renderKind(kind);
  }); } }
  // 전체 접기/펼치기 토글
  const col=document.querySelector(`[data-collapse="${kind}"]`);
  if(col){
    const anyExpanded=Object.values(VIEW_PREFS[kind].collapsed).some(v=>!v) || Object.keys(VIEW_PREFS[kind].collapsed).length===0;
    col.textContent = anyExpanded ? "전체 접기" : "전체 펼치기";
    if(!col._bound){ col._bound=true; col.addEventListener("click",()=>{
      // 현재 보이는 카테고리 모두 토글
      const isCollapsing = col.textContent==="전체 접기";
      const all = (kind==="password") ? CATEGORIES.password.concat(["(미분류)"]) : CATEGORIES[kind].concat(["(미분류)"]);
      VIEW_PREFS[kind].collapsed = {};
      if(isCollapsing) all.forEach(c=>VIEW_PREFS[kind].collapsed[c]=true);
      saveViewPrefs(); renderKind(kind);
    }); }
  }
}
function renderKind(kind){
  if(kind==="filelink") renderFileLink();
  else if(kind==="site") renderSite();
  else if(kind==="password") pwRenderList();
}
function catColorClass(kind, cat){
  const idx = CATEGORIES[kind].indexOf(cat);
  if(idx<0) return "cat-c11"; // 미분류
  return "cat-c"+(idx % 12);
}
function buildCatJump(kind, groupsObj, jumpBoxId){
  const box=$(jumpBoxId); if(!box) return;
  const keys=Object.keys(groupsObj);
  if(keys.length<2){ box.innerHTML=""; return; }
  // 카테고리 순서대로
  const cats=CATEGORIES[kind].filter(c=>groupsObj[c]).concat(groupsObj["(미분류)"]?["(미분류)"]:[]);
  box.innerHTML=`<div class="cat-jump"><span class="jh">⬇ 점프</span>`+cats.map(c=>{
    const colorClass=catColorClass(kind,c);
    return `<a data-jump="${esc(c)}" class="${colorClass}"><span class="jdot" style="background:var(--ccol)"></span>${esc(c)}<span class="jc">${groupsObj[c].length}</span></a>`;
  }).join("")+`</div>`;
  box.querySelectorAll("[data-jump]").forEach(a=>a.addEventListener("click",ev=>{
    ev.preventDefault();
    const cat=a.dataset.jump;
    const grp=document.querySelector(`#${kind==="filelink"?"fileList":kind==="site"?"siteList":"pwList"} .cat-group[data-cat="${CSS.escape(cat)}"]`);
    if(grp){
      // 접혀있으면 펼치기
      if(VIEW_PREFS[kind].collapsed[cat]){ VIEW_PREFS[kind].collapsed[cat]=false; saveViewPrefs(); renderKind(kind); setTimeout(()=>{ const g=document.querySelector(`#${kind==="filelink"?"fileList":kind==="site"?"siteList":"pwList"} .cat-group[data-cat="${CSS.escape(cat)}"]`); if(g) g.scrollIntoView({behavior:"smooth",block:"start"}); }, 50); return; }
      grp.scrollIntoView({behavior:"smooth",block:"start"});
    }
  }));
}
function sortItems(kind, list){
  const s=VIEW_PREFS[kind].sort;
  const nameKey = kind==="filelink" ? "label" : "name";
  // 기본 비교 함수 (선택된 정렬 기준에 따라)
  const cmp=(a,b)=>{
    if(s==="recent") return (b.lastOpenedAt||0)-(a.lastOpenedAt||0) || (a[nameKey]||"").localeCompare(b[nameKey]||"","ko");
    if(s==="created") return (b.createdAt||0)-(a.createdAt||0) || (a[nameKey]||"").localeCompare(b[nameKey]||"","ko");
    return (a[nameKey]||"").localeCompare(b[nameKey]||"","ko"); // 이름순 (ㄱㄴㄷ)
  };
  if(kind==="filelink"){
    // 폴더 먼저, 파일 나중 — 각 그룹 안에서 위 기준으로 정렬
    return list.sort((a,b)=>{
      const fa=isFolder(a.path,a.ptype)?0:1;
      const fb=isFolder(b.path,b.ptype)?0:1;
      if(fa!==fb) return fa-fb;   // 폴더(0)가 파일(1)보다 앞
      return cmp(a,b);
    });
  }
  return list.sort(cmp);
}

/* ===== 파일링크 탭 ===== */
function wireFileLinkTab(){
  $("fileSearch").addEventListener("input",e=>{ CAT_FILTER.filelink.q=e.target.value; renderFileLink(); });
  $("fileCatFilter").addEventListener("change",e=>{ CAT_FILTER.filelink.cat=e.target.value; CAT_FILTER.filelink.sub="전체"; renderFileLink(); });
  $("btnFileCatMgr").addEventListener("click",()=>openCatMgr("filelink"));
  // v18: 폴더/파일 종류 필터
  document.querySelectorAll("#fileTypeFilter button").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("#fileTypeFilter button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    CAT_FILTER.filelink.type=b.dataset.ft;
    renderFileLink();
  }));
}
function fileLinkMatches(e,q){
  if(!q.trim()) return true;
  const s=[e.label,e.path,e.memo,e.category,e.subcategory].filter(Boolean).join(" ").toLowerCase();
  return s.includes(q.trim().toLowerCase());
}
function populateFileFilters(){
  $("fileCatFilter").innerHTML=catOptions("filelink",true);
  $("fileCatFilter").value=CAT_FILTER.filelink.cat;
  const cat=CAT_FILTER.filelink.cat;
  // 소분류 후보 + 카운트
  const baseList = cat==="전체"
    ? entries.filter(e=>e.kind==="filelink"&&e.subcategory)
    : entries.filter(e=>e.kind==="filelink"&&e.category===cat&&e.subcategory);
  const cnt={}; baseList.forEach(e=>{ cnt[e.subcategory]=(cnt[e.subcategory]||0)+1; });
  const subs=Object.keys(cnt).sort();
  if(!subs.includes(CAT_FILTER.filelink.sub) && CAT_FILTER.filelink.sub!=="전체") CAT_FILTER.filelink.sub="전체";
  const box=$("fileSubFilter");
  if(!subs.length){ box.innerHTML=`<span class="sub-h">소분류</span><span class="sub-empty">— 없음 —</span>`; return; }
  const allCnt=baseList.length;
  let html=`<span class="sub-h">소분류</span>`;
  html+=`<button class="chip ${CAT_FILTER.filelink.sub==="전체"?"active":""}" data-sub="전체">전체<span class="sub-cnt">${allCnt}</span></button>`;
  html+=subs.map(s=>`<button class="chip ${CAT_FILTER.filelink.sub===s?"active":""}" data-sub="${esc(s)}">${esc(s)}<span class="sub-cnt">${cnt[s]}</span></button>`).join("");
  box.innerHTML=html;
  box.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{
    CAT_FILTER.filelink.sub=b.dataset.sub;
    renderFileLink();
  }));
}
function fileLinkList(){
  const f=CAT_FILTER.filelink;
  return entries.filter(e=>e.kind==="filelink"
    && (f.cat==="전체"||e.category===f.cat)
    && (f.sub==="전체"||e.subcategory===f.sub)
    && (f.type==="all" || (f.type==="folder" && isFolder(e.path, e.ptype)) || (f.type==="file" && !isFolder(e.path, e.ptype)))
    && fileLinkMatches(e,f.q));
}
function renderFileLink(){
  bindViewControls("filelink");
  populateFileFilters();
  const box=$("fileList");
  const list=fileLinkList();
  if(!list.length){
    $("fileCatJump").innerHTML="";
    box.innerHTML=`<div class="empty">${entries.some(e=>e.kind==="filelink")?"조건에 맞는 파일이 없습니다.":"➕ 파일 추가를 눌러 자주 쓰는 파일/폴더를 등록해 보세요."}</div>`;
    box.className=""; return;
  }
  // 정렬
  sortItems("filelink", list);
  // 즐겨찾기 분리
  const favs = list.filter(e=>e.starred);
  const rest = list.filter(e=>!e.starred);
  // 카테고리별 묶기 (즐겨찾기 제외분만)
  const groups={};
  rest.forEach(e=>{
    const c=e.category||"(미분류)";
    if(!groups[c]) groups[c]=[];
    groups[c].push(e);
  });
  // 카테고리 순서 (CATEGORIES 순서 우선, 그 외는 가나다)
  const orderedCats=CATEGORIES.filelink.filter(c=>groups[c]);
  Object.keys(groups).forEach(c=>{ if(!orderedCats.includes(c)) orderedCats.push(c); });
  // 점프 메뉴
  const jumpGroups={};
  if(favs.length) jumpGroups["⭐ 즐겨찾기"]=favs;
  orderedCats.forEach(c=>{ jumpGroups[c]=groups[c]; });
  buildCatJump("filelink", jumpGroups, "fileCatJump");
  // 본문
  const mode=VIEW_PREFS.filelink.mode;
  const compact=VIEW_PREFS.filelink.compact;
  box.className=`view-${mode}${mode==="card"&&compact?" compact":""}`;
  let html="";
  // 즐겨찾기 섹션
  if(favs.length){
    html+=`<div class="fav-section"><div class="fs-h">⭐ 즐겨찾기 <span class="fs-cnt">${favs.length}</span></div>
      <div class="cat-items">${favs.map(e=>fileLinkCardHTML(e)).join("")}</div></div>`;
  }
  // 카테고리별
  html+=orderedCats.map(c=>{
    const items=groups[c];
    const collapsed=VIEW_PREFS.filelink.collapsed[c];
    const colorClass=catColorClass("filelink",c);
    // 폴더/파일 분리 (이미 sortItems에서 폴더가 앞으로 정렬됨)
    const folders=items.filter(e=>isFolder(e.path,e.ptype));
    const files=items.filter(e=>!isFolder(e.path,e.ptype));
    let inner="";
    if(folders.length){
      inner+=`<div class="grp-sublabel">📁 폴더 <span class="gs-cnt">${folders.length}</span></div>`;
      inner+=`<div class="cat-items">${folders.map(e=>fileLinkCardHTML(e)).join("")}</div>`;
    }
    if(files.length){
      inner+=`<div class="grp-sublabel">📄 파일 <span class="gs-cnt">${files.length}</span></div>`;
      inner+=`<div class="cat-items">${files.map(e=>fileLinkCardHTML(e)).join("")}</div>`;
    }
    return `<div class="cat-group ${colorClass}${collapsed?" collapsed":""}" data-cat="${esc(c)}">
      <div class="cat-group-h"><span class="ch-arrow">▼</span>${esc(c)}<span class="ch-cnt">${items.length}</span></div>
      ${inner}</div>`;
  }).join("");
  box.innerHTML=html;
  // 이벤트
  box.querySelectorAll(".cat-group-h").forEach(h=>h.addEventListener("click",()=>{
    const g=h.parentElement; const cat=g.dataset.cat;
    VIEW_PREFS.filelink.collapsed[cat]=!VIEW_PREFS.filelink.collapsed[cat];
    saveViewPrefs(); g.classList.toggle("collapsed");
  }));
  box.querySelectorAll("[data-fid]").forEach(el=>{
    const id=el.dataset.fid;
    el.addEventListener("click",ev=>{
      if(ev.target.closest("[data-star],[data-edit]")) return;
      const e=entries.find(x=>x.id===id); if(!e) return;
      window.open(toLocalUrl(e.path),"_self");
      updateRecord(id,{lastOpenedAt:Date.now()});
    });
    el.querySelector("[data-star]").addEventListener("click",ev=>{
      ev.stopPropagation();
      const e=entries.find(x=>x.id===id); if(!e) return;
      updateRecord(id,{starred:!e.starred}); renderFileLink();
    });
    el.querySelector("[data-edit]").addEventListener("click",ev=>{ ev.stopPropagation(); openEditor("filelink", id); });
  });
}
function fileLinkCardHTML(e){
  const tt=`${e.label||""}\n${e.path||""}${e.memo?"\n"+e.memo:""}`;
  const folder=isFolder(e.path, e.ptype);
  const badge=folder
    ? `<span class="lc-typebadge tb-folder">📁 폴더</span>`
    : `<span class="lc-typebadge tb-file">📄 파일</span>`;
  return `<div class="link-card${folder?" is-folder":""}${e.starred?" starred":""}" data-fid="${e.id}" title="${esc(tt)}">
    <span class="lc-icon">${fileIcon(e.path, e.ptype)}</span>
    <div class="lc-body">
      <div class="lc-name">${esc(e.label||"")}</div>
      <div class="lc-sub">${esc(e.path||"")}</div>
      ${badge}
      ${e.subcategory?` <span class="lc-tag">${esc(e.subcategory)}</span>`:""}
      ${e.memo?`<div class="lc-memo">📝 ${esc(e.memo)}</div>`:""}
    </div>
    <div class="lc-acts">
      <button class="lc-star ${e.starred?"on":""}" data-star title="즐겨찾기">⭐</button>
      <button class="lc-menu-btn" data-edit>수정</button>
    </div>
  </div>`;
}

/* ===== 사이트 탭 ===== */
function wireSiteTab(){
  $("siteSearch").addEventListener("input",e=>{ CAT_FILTER.site.q=e.target.value; renderSite(); });
  $("siteCatFilter").addEventListener("change",e=>{ CAT_FILTER.site.cat=e.target.value; CAT_FILTER.site.sub="전체"; renderSite(); });
  $("btnSiteCatMgr").addEventListener("click",()=>openCatMgr("site"));
}
function siteMatches(e,q){
  if(!q.trim()) return true;
  const s=[e.name,e.url,e.memo,e.category,e.subcategory].filter(Boolean).join(" ").toLowerCase();
  return s.includes(q.trim().toLowerCase());
}
function populateSiteFilters(){
  $("siteCatFilter").innerHTML=catOptions("site",true);
  $("siteCatFilter").value=CAT_FILTER.site.cat;
  const cat=CAT_FILTER.site.cat;
  const baseList = cat==="전체"
    ? entries.filter(e=>e.kind==="site"&&e.subcategory)
    : entries.filter(e=>e.kind==="site"&&e.category===cat&&e.subcategory);
  const cnt={}; baseList.forEach(e=>{ cnt[e.subcategory]=(cnt[e.subcategory]||0)+1; });
  const subs=Object.keys(cnt).sort();
  if(!subs.includes(CAT_FILTER.site.sub) && CAT_FILTER.site.sub!=="전체") CAT_FILTER.site.sub="전체";
  const box=$("siteSubFilter");
  if(!subs.length){ box.innerHTML=`<span class="sub-h">소분류</span><span class="sub-empty">— 없음 —</span>`; return; }
  const allCnt=baseList.length;
  let html=`<span class="sub-h">소분류</span>`;
  html+=`<button class="chip ${CAT_FILTER.site.sub==="전체"?"active":""}" data-sub="전체">전체<span class="sub-cnt">${allCnt}</span></button>`;
  html+=subs.map(s=>`<button class="chip ${CAT_FILTER.site.sub===s?"active":""}" data-sub="${esc(s)}">${esc(s)}<span class="sub-cnt">${cnt[s]}</span></button>`).join("");
  box.innerHTML=html;
  box.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{
    CAT_FILTER.site.sub=b.dataset.sub;
    renderSite();
  }));
}
function siteList(){
  const f=CAT_FILTER.site;
  return entries.filter(e=>e.kind==="site"
    && (f.cat==="전체"||e.category===f.cat)
    && (f.sub==="전체"||e.subcategory===f.sub)
    && siteMatches(e,f.q));
}
function normUrl(u){
  if(!u) return "";
  if(/^https?:\/\//i.test(u)) return u;
  return "https://"+u;
}
function faviconUrl(u){
  try{ const h=new URL(normUrl(u)).hostname; return `https://www.google.com/s2/favicons?domain=${h}&sz=32`; }catch(e){ return ""; }
}
function renderSite(){
  bindViewControls("site");
  populateSiteFilters();
  const box=$("siteList");
  const list=siteList();
  if(!list.length){
    $("siteCatJump").innerHTML="";
    box.innerHTML=`<div class="empty">${entries.some(e=>e.kind==="site")?"조건에 맞는 사이트가 없습니다.":"➕ 사이트 추가를 눌러 자주 가는 사이트를 등록해 보세요."}</div>`;
    box.className=""; return;
  }
  sortItems("site", list);
  const favs=list.filter(e=>e.starred);
  const rest=list.filter(e=>!e.starred);
  const groups={};
  rest.forEach(e=>{ const c=e.category||"(미분류)"; if(!groups[c]) groups[c]=[]; groups[c].push(e); });
  const orderedCats=CATEGORIES.site.filter(c=>groups[c]);
  Object.keys(groups).forEach(c=>{ if(!orderedCats.includes(c)) orderedCats.push(c); });
  const jumpGroups={};
  if(favs.length) jumpGroups["⭐ 즐겨찾기"]=favs;
  orderedCats.forEach(c=>{ jumpGroups[c]=groups[c]; });
  buildCatJump("site", jumpGroups, "siteCatJump");
  const mode=VIEW_PREFS.site.mode;
  const compact=VIEW_PREFS.site.compact;
  box.className=`view-${mode}${mode==="card"&&compact?" compact":""}`;
  let html="";
  if(favs.length){
    html+=`<div class="fav-section"><div class="fs-h">⭐ 즐겨찾기 <span class="fs-cnt">${favs.length}</span></div>
      <div class="cat-items">${favs.map(e=>siteCardHTML(e)).join("")}</div></div>`;
  }
  html+=orderedCats.map(c=>{
    const items=groups[c];
    const collapsed=VIEW_PREFS.site.collapsed[c];
    const colorClass=catColorClass("site",c);
    return `<div class="cat-group ${colorClass}${collapsed?" collapsed":""}" data-cat="${esc(c)}">
      <div class="cat-group-h"><span class="ch-arrow">▼</span>${esc(c)}<span class="ch-cnt">${items.length}</span></div>
      <div class="cat-items">${items.map(e=>siteCardHTML(e)).join("")}</div></div>`;
  }).join("");
  box.innerHTML=html;
  box.querySelectorAll(".cat-group-h").forEach(h=>h.addEventListener("click",()=>{
    const g=h.parentElement; const cat=g.dataset.cat;
    VIEW_PREFS.site.collapsed[cat]=!VIEW_PREFS.site.collapsed[cat];
    saveViewPrefs(); g.classList.toggle("collapsed");
  }));
  box.querySelectorAll("[data-sid]").forEach(el=>{
    const id=el.dataset.sid;
    el.addEventListener("click",ev=>{
      if(ev.target.closest("[data-star],[data-edit]")) return;
      const e=entries.find(x=>x.id===id); if(!e) return;
      window.open(normUrl(e.url),"_blank","noopener");
      updateRecord(id,{lastOpenedAt:Date.now()});
    });
    el.querySelector("[data-star]").addEventListener("click",ev=>{
      ev.stopPropagation();
      const e=entries.find(x=>x.id===id); if(!e) return;
      updateRecord(id,{starred:!e.starred}); renderSite();
    });
    el.querySelector("[data-edit]").addEventListener("click",ev=>{ ev.stopPropagation(); openEditor("site", id); });
  });
}
function siteCardHTML(e){
  const fv=faviconUrl(e.url);
  const ic=fv?`<img src="${fv}" style="width:24px;height:24px;border-radius:4px" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span style="display:none;font-size:24px">🌐</span>`:`<span style="font-size:24px">🌐</span>`;
  const tt=`${e.name||""}\n${e.url||""}${e.memo?"\n"+e.memo:""}`;
  return `<div class="link-card${e.starred?" starred":""}" data-sid="${e.id}" title="${esc(tt)}">
    <span class="lc-icon">${ic}</span>
    <div class="lc-body">
      <div class="lc-name">${esc(e.name||"")}</div>
      <div class="lc-sub">${esc(e.url||"")}</div>
      ${e.subcategory?`<span class="lc-tag">${esc(e.subcategory)}</span>`:""}
      ${e.memo?`<div class="lc-memo">📝 ${esc(e.memo)}</div>`:""}
    </div>
    <div class="lc-acts">
      <button class="lc-star ${e.starred?"on":""}" data-star title="즐겨찾기">⭐</button>
      <button class="lc-menu-btn" data-edit>수정</button>
    </div>
  </div>`;
}

/* ===== 카테고리 관리 모달 ===== */
let catMgrKind=null;
function wireCatMgr(){
  $("catMgrClose").addEventListener("click",()=>$("catMgrOverlay").classList.remove("show"));
  $("catMgrOverlay").addEventListener("click",e=>{ if(e.target===$("catMgrOverlay")) $("catMgrOverlay").classList.remove("show"); });
  $("catAddBtn").addEventListener("click",catAddNew);
  $("catNewName").addEventListener("keydown",e=>{ if(e.key==="Enter") catAddNew(); });
}
function openCatMgr(kind){
  catMgrKind=kind;
  const label=kind==="filelink"?"파일링크":kind==="site"?"사이트":"비밀번호";
  $("catMgrTitle").textContent=`⚙ ${label} 카테고리 관리`;
  $("catNewName").value="";
  renderCatMgrList();
  $("catMgrOverlay").classList.add("show");
}
function renderCatMgrList(){
  const kind=catMgrKind; if(!kind) return;
  const list=CATEGORIES[kind];
  const cnt={}; entries.forEach(e=>{ if(e.kind===kind){ const c=e.category||"(미분류)"; cnt[c]=(cnt[c]||0)+1; }});
  $("catList").innerHTML = list.length ? list.map((c,i)=>`<div class="cat-row" data-i="${i}">
    <span class="cr-name">${esc(c)}</span>
    <span class="cr-cnt">${cnt[c]||0}건</span>
    <button data-act="up" title="위로">▲</button>
    <button data-act="down" title="아래로">▼</button>
    <button data-act="rename" title="이름변경">✏</button>
    <button class="danger" data-act="del" title="삭제">🗑</button>
  </div>`).join("") : `<div class="empty" style="padding:14px">카테고리가 없습니다. 위에서 추가해 주세요.</div>`;
  $("catList").querySelectorAll(".cat-row").forEach(row=>{
    const i=Number(row.dataset.i);
    row.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>catAct(kind,i,b.dataset.act,row)));
  });
}
function catAddNew(){
  const v=$("catNewName").value.trim();
  if(!v) return;
  if(CATEGORIES[catMgrKind].includes(v)){ toast("이미 있는 카테고리입니다"); return; }
  CATEGORIES[catMgrKind].push(v);
  saveCategories();
  $("catNewName").value="";
  renderCatMgrList();
  renderAll();
}
function catAct(kind,i,act,row){
  const list=CATEGORIES[kind];
  if(act==="up" && i>0){ [list[i-1],list[i]]=[list[i],list[i-1]]; }
  else if(act==="down" && i<list.length-1){ [list[i+1],list[i]]=[list[i],list[i+1]]; }
  else if(act==="del"){
    const name=list[i];
    const used=entries.filter(e=>e.kind===kind && e.category===name).length;
    if(used && !confirm(`"${name}" 카테고리에 ${used}건이 있습니다.\n카테고리를 삭제해도 항목은 유지되며 "(미분류)"로 표시됩니다. 계속할까요?`)) return;
    list.splice(i,1);
  }
  else if(act==="rename"){
    const old=list[i];
    const nv=prompt("새 이름을 입력하세요", old);
    if(!nv || nv.trim()===old || !nv.trim()) return;
    const nn=nv.trim();
    if(list.includes(nn)){ toast("이미 있는 이름입니다"); return; }
    list[i]=nn;
    // 기존 항목들의 category도 일괄 변경
    entries.forEach(e=>{ if(e.kind===kind && e.category===old){ updateRecord(e.id,{category:nn}); }});
  }
  saveCategories();
  renderCatMgrList();
  renderAll();
}

/* =========================================================
   비밀번호 탭 (AES-GCM 암호화)
   ========================================================= */
const PW_MASTER_CHECK_LS = "wl_pw_master_check_v16";
const PW_CHECK_PLAIN = "worklog_master_ok";
let masterKey = null;          // CryptoKey (잠금 해제 시 메모리에만 보관)
let masterPassword = null;     // 새 항목 암호화용
let pwShownIds = new Set();    // 비번 표시 토글 상태

async function deriveKey(password, salt){
  const enc=new TextEncoder();
  const km=await crypto.subtle.importKey("raw", enc.encode(password), {name:"PBKDF2"}, false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2", salt, iterations:100000, hash:"SHA-256"}, km, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
}
function u8ToB64(u8){ let s=""; for(let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); }
function b64ToU8(b64){ const s=atob(b64); const u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; }
async function encryptStr(plain, password){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(password, salt);
  const ct=await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, new TextEncoder().encode(plain));
  const all=new Uint8Array(salt.length+iv.length+ct.byteLength);
  all.set(salt,0); all.set(iv,salt.length); all.set(new Uint8Array(ct), salt.length+iv.length);
  return u8ToB64(all);
}
async function decryptStr(b64, password){
  const all=b64ToU8(b64);
  const salt=all.slice(0,16), iv=all.slice(16,28), ct=all.slice(28);
  const key=await deriveKey(password, salt);
  const pt=await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, ct);
  return new TextDecoder().decode(pt);
}
function pwHasMaster(){ try{ return !!localStorage.getItem(PW_MASTER_CHECK_LS); }catch(e){ return false; } }

function wirePasswordTab(){ /* 진입 시 renderPassword가 모든 걸 처리 */ }

function renderPassword(){
  const lock=$("pwLockScreen"), main=$("pwMainArea"), hdr=$("pwHeaderBtns");
  if(masterPassword){
    lock.style.display="none"; main.style.display="";
    hdr.innerHTML=`<button class="btn btn-primary btn-sm" id="pwAddBtn">➕ 비번 추가</button>
      <button class="btn btn-ghost btn-sm" id="pwCatMgrBtn">⚙ 카테고리</button>
      <button class="btn btn-ghost btn-sm" id="pwChgMaster">🔑 마스터 변경</button>
      <button class="btn btn-danger btn-sm" id="pwLockBtn">🔒 잠그기</button>`;
    $("pwAddBtn").addEventListener("click",()=>pwOpenEditor(null));
    $("pwCatMgrBtn").addEventListener("click",()=>openCatMgr("password"));
    $("pwChgMaster").addEventListener("click",pwChangeMaster);
    $("pwLockBtn").addEventListener("click",()=>{ masterKey=null; masterPassword=null; pwShownIds.clear(); renderPassword(); toast("🔒 비밀번호 탭을 잠갔습니다"); });
    pwBindSearch();
    pwRenderList();
  } else {
    main.style.display="none"; lock.style.display="";
    hdr.innerHTML="";
    if(!pwHasMaster()){
      // 최초 설정
      lock.innerHTML=`<div class="pw-lock">
        <div class="lock-icon">🔐</div>
        <h3>마스터 비밀번호 설정</h3>
        <p>비밀번호 탭은 모든 데이터를 마스터 비번으로 암호화합니다.<br>
        ⚠ <b>마스터 비번을 잊으면 저장된 비밀번호를 복구할 수 없습니다.</b><br>
        안전한 곳에 따로 적어두세요.</p>
        <input type="password" id="pwMaster1" placeholder="마스터 비번 (6자 이상)" autocomplete="new-password">
        <input type="password" id="pwMaster2" placeholder="다시 한 번 입력" autocomplete="new-password">
        <div class="pw-err" id="pwErr"></div>
        <button class="btn btn-primary" id="pwSetupBtn">설정하기</button>
      </div>`;
      $("pwSetupBtn").addEventListener("click",pwSetupMaster);
      $("pwMaster2").addEventListener("keydown",e=>{ if(e.key==="Enter") pwSetupMaster(); });
    } else {
      // 로그인
      lock.innerHTML=`<div class="pw-lock">
        <div class="lock-icon">🔒</div>
        <h3>마스터 비밀번호 입력</h3>
        <p>비밀번호 데이터를 보려면 마스터 비번을 입력해 주세요.</p>
        <input type="password" id="pwMasterIn" placeholder="마스터 비번" autocomplete="current-password" autofocus>
        <div class="pw-err" id="pwErr"></div>
        <button class="btn btn-primary" id="pwUnlockBtn">잠금 해제</button>
      </div>`;
      $("pwUnlockBtn").addEventListener("click",pwUnlock);
      $("pwMasterIn").addEventListener("keydown",e=>{ if(e.key==="Enter") pwUnlock(); });
      setTimeout(()=>{ const i=$("pwMasterIn"); if(i) i.focus(); },50);
    }
  }
}
async function pwSetupMaster(){
  const p1=$("pwMaster1").value, p2=$("pwMaster2").value;
  const err=$("pwErr");
  if(p1.length<6){ err.textContent="6자 이상 입력하세요"; return; }
  if(p1!==p2){ err.textContent="두 입력이 일치하지 않습니다"; return; }
  err.textContent="";
  try{
    const token=await encryptStr(PW_CHECK_PLAIN, p1);
    localStorage.setItem(PW_MASTER_CHECK_LS, token);
    masterPassword=p1; masterKey=true;
    renderPassword();
    toast("✅ 마스터 비번 설정 완료");
  }catch(e){ err.textContent="설정 실패: "+e.message; }
}
async function pwUnlock(){
  const p=$("pwMasterIn").value, err=$("pwErr");
  if(!p){ err.textContent="비번을 입력하세요"; return; }
  try{
    const token=localStorage.getItem(PW_MASTER_CHECK_LS);
    const dec=await decryptStr(token, p);
    if(dec!==PW_CHECK_PLAIN) throw new Error("검증 실패");
    masterPassword=p; masterKey=true;
    renderPassword();
    toast("🔓 잠금 해제됨");
  }catch(e){
    err.textContent="비밀번호가 일치하지 않습니다";
  }
}
async function pwChangeMaster(){
  if(!masterPassword){ toast("먼저 잠금을 해제하세요"); return; }
  const cur=prompt("현재 마스터 비번을 입력하세요");
  if(cur===null) return;
  if(cur!==masterPassword){ toast("현재 비번이 일치하지 않습니다"); return; }
  const nv=prompt("새 마스터 비번을 입력하세요 (6자 이상)");
  if(!nv) return;
  if(nv.length<6){ toast("6자 이상 입력하세요"); return; }
  const nv2=prompt("새 비번을 한 번 더 입력하세요");
  if(nv!==nv2){ toast("두 입력이 일치하지 않습니다"); return; }
  try{
    // 모든 기존 비번 항목을 새 키로 재암호화
    const pwItems=entries.filter(e=>e.kind==="password" && e.encrypted);
    const updates=[];
    for(const e of pwItems){
      const plain=await decryptStr(e.encrypted, masterPassword);
      const newEnc=await encryptStr(plain, nv);
      updates.push([e.id, newEnc]);
    }
    const token=await encryptStr(PW_CHECK_PLAIN, nv);
    localStorage.setItem(PW_MASTER_CHECK_LS, token);
    updates.forEach(([id,enc])=>updateRecord(id,{encrypted:enc}));
    masterPassword=nv;
    toast(`✅ 마스터 비번 변경됨 (${updates.length}건 재암호화)`);
    renderPassword();
  }catch(e){ toast("변경 실패: "+e.message); }
}
function pwBindSearch(){
  const s=$("pwSearch"); if(s && !s._bound){ s._bound=true; s.addEventListener("input",e=>{ CAT_FILTER.password.q=e.target.value; pwRenderList(); }); }
  const cf=$("pwCatFilter"); if(cf && !cf._bound){ cf._bound=true; cf.addEventListener("change",e=>{ CAT_FILTER.password.cat=e.target.value; CAT_FILTER.password.sub="전체"; pwRenderList(); }); }
}
function pwMatches(e,q){
  if(!q.trim()) return true;
  const s=[e.name,e.category,e.subcategory,e.memoPlain||""].filter(Boolean).join(" ").toLowerCase();
  return s.includes(q.trim().toLowerCase());
}
async function pwRenderList(){
  bindViewControls("password");
  // 필터 채우기
  $("pwCatFilter").innerHTML=catOptions("password",true);
  $("pwCatFilter").value=CAT_FILTER.password.cat;
  const cat=CAT_FILTER.password.cat;
  const baseList = cat==="전체"
    ? entries.filter(e=>e.kind==="password"&&e.subcategory)
    : entries.filter(e=>e.kind==="password"&&e.category===cat&&e.subcategory);
  const cnt={}; baseList.forEach(e=>{ cnt[e.subcategory]=(cnt[e.subcategory]||0)+1; });
  const subs=Object.keys(cnt).sort();
  if(!subs.includes(CAT_FILTER.password.sub) && CAT_FILTER.password.sub!=="전체") CAT_FILTER.password.sub="전체";
  const subBox=$("pwSubFilter");
  if(!subs.length){
    subBox.innerHTML=`<span class="sub-h">소분류</span><span class="sub-empty">— 없음 —</span>`;
  } else {
    const allCnt=baseList.length;
    let h=`<span class="sub-h">소분류</span>`;
    h+=`<button class="chip ${CAT_FILTER.password.sub==="전체"?"active":""}" data-sub="전체">전체<span class="sub-cnt">${allCnt}</span></button>`;
    h+=subs.map(s=>`<button class="chip ${CAT_FILTER.password.sub===s?"active":""}" data-sub="${esc(s)}">${esc(s)}<span class="sub-cnt">${cnt[s]}</span></button>`).join("");
    subBox.innerHTML=h;
    subBox.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{
      CAT_FILTER.password.sub=b.dataset.sub;
      pwRenderList();
    }));
  }

  const f=CAT_FILTER.password;
  const list=entries.filter(e=>e.kind==="password"
    && (f.cat==="전체"||e.category===f.cat)
    && (f.sub==="전체"||e.subcategory===f.sub)
    && pwMatches(e,f.q));

  const box=$("pwList");
  if(!list.length){
    $("pwCatJump").innerHTML="";
    box.innerHTML=`<div class="empty">${entries.some(e=>e.kind==="password")?"조건에 맞는 비번이 없습니다.":"➕ 비번 추가를 눌러 사이트별 계정·비밀번호를 등록해 보세요."}</div>`;
    box.className=""; return;
  }
  sortItems("password", list);
  const favs=list.filter(e=>e.starred);
  const rest=list.filter(e=>!e.starred);
  const groups={};
  rest.forEach(e=>{ const c=e.category||"(미분류)"; if(!groups[c]) groups[c]=[]; groups[c].push(e); });
  const orderedCats=CATEGORIES.password.filter(c=>groups[c]);
  Object.keys(groups).forEach(c=>{ if(!orderedCats.includes(c)) orderedCats.push(c); });
  const jumpGroups={};
  if(favs.length) jumpGroups["⭐ 즐겨찾기"]=favs;
  orderedCats.forEach(c=>{ jumpGroups[c]=groups[c]; });
  buildCatJump("password", jumpGroups, "pwCatJump");
  const mode=VIEW_PREFS.password.mode;
  box.className=mode==="list"?"pw-view-list":"";

  // 카드 placeholder 렌더
  const pwCardPlaceholder = e =>{
    const cat=e.category?`<span class="pw-cat">${esc(e.category)}</span>`:"";
    const sub=e.subcategory?`<span class="pw-cat" style="background:var(--mint-soft);color:#2c7d62">${esc(e.subcategory)}</span>`:"";
    return `<div class="pw-card" data-pid="${e.id}">
      <div class="pw-head">
        <div class="pw-name">${e.starred?"⭐ ":""}${esc(e.name||"(이름없음)")}${cat}${sub}</div>
        <div class="pw-acts">
          <button class="pw-mini-btn" data-pact="star" title="즐겨찾기">${e.starred?"★":"☆"}</button>
          <button class="pw-mini-btn" data-pact="edit">수정</button>
          <button class="pw-mini-btn" data-pact="del" style="color:var(--peach)">🗑</button>
        </div>
      </div>
      <div data-fields>로딩 중…</div>
    </div>`;
  };

  let html="";
  if(favs.length){
    html+=`<div class="fav-section"><div class="fs-h">⭐ 즐겨찾기 <span class="fs-cnt">${favs.length}</span></div>
      <div>${favs.map(pwCardPlaceholder).join("")}</div></div>`;
  }
  html+=orderedCats.map(c=>{
    const items=groups[c];
    const collapsed=VIEW_PREFS.password.collapsed[c];
    const colorClass=catColorClass("password",c);
    return `<div class="cat-group ${colorClass}${collapsed?" collapsed":""}" data-cat="${esc(c)}" style="margin-bottom:14px">
      <div class="cat-group-h"><span class="ch-arrow">▼</span>${esc(c)}<span class="ch-cnt">${items.length}</span></div>
      <div class="cat-items" style="display:block">${items.map(pwCardPlaceholder).join("")}</div></div>`;
  }).join("");
  box.innerHTML=html;

  // 접기 이벤트
  box.querySelectorAll(".cat-group-h").forEach(h=>h.addEventListener("click",()=>{
    const g=h.parentElement; const cat=g.dataset.cat;
    VIEW_PREFS.password.collapsed[cat]=!VIEW_PREFS.password.collapsed[cat];
    saveViewPrefs(); g.classList.toggle("collapsed");
    // 접힘 처리 (display:none 으로)
    const items=g.querySelector(".cat-items");
    if(items) items.style.display = g.classList.contains("collapsed") ? "none" : "block";
  }));
  // 초기 접힘 상태 반영
  box.querySelectorAll(".cat-group.collapsed .cat-items").forEach(el=>el.style.display="none");

  // 복호화 채우기
  for(const e of list){
    const card=box.querySelector(`[data-pid="${e.id}"]`);
    if(!card) continue;
    let data={username:"",password:"",url:"",memo:""};
    try{ if(e.encrypted) data=JSON.parse(await decryptStr(e.encrypted, masterPassword)); }
    catch(err){ card.querySelector("[data-fields]").innerHTML=`<div style="color:var(--peach);font-size:13px;padding:6px 0">⚠ 복호화 실패</div>`; continue; }
    const shown=pwShownIds.has(e.id);
    const pwDisp = shown ? esc(data.password||"") : "••••••••";
    const fieldsHTML=`
      ${data.username?`<div class="pw-field"><span class="pw-field-k">아이디</span><span class="pw-field-v">${esc(data.username)}</span><button class="pw-mini-btn" data-copy="${esc(data.username).replace(/"/g,"&quot;")}" data-label="아이디">📋</button></div>`:""}
      ${data.password?`<div class="pw-field"><span class="pw-field-k">비밀번호</span><span class="pw-field-v${shown?"":" masked"}">${pwDisp}</span><button class="pw-mini-btn" data-toggle>${shown?"🙈":"👁"}</button><button class="pw-mini-btn" data-copy="${esc(data.password).replace(/"/g,"&quot;")}" data-label="비밀번호">📋</button></div>`:""}
      ${data.url?`<div class="pw-field"><span class="pw-field-k">URL</span><span class="pw-field-v"><a href="${esc(normUrl(data.url))}" target="_blank" rel="noopener" style="color:var(--primary-deep);text-decoration:none">${esc(data.url)}</a></span></div>`:""}
      ${data.memo?`<div class="pw-memo">📝 ${esc(data.memo)}</div>`:""}
    `;
    const fb=card.querySelector("[data-fields]"); fb.innerHTML=fieldsHTML;
    fb.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",()=>{
      if(pwShownIds.has(e.id)) pwShownIds.delete(e.id); else pwShownIds.add(e.id);
      pwRenderList();
    }));
    fb.querySelectorAll("[data-copy]").forEach(b=>b.addEventListener("click",()=>{
      copyText(b.dataset.copy, b.dataset.label+" 복사됨");
    }));
    card.querySelectorAll("[data-pact]").forEach(b=>b.addEventListener("click",async ev=>{
      ev.stopPropagation();
      const act=b.dataset.pact;
      if(act==="edit") pwOpenEditor(e.id);
      else if(act==="del"){
        if(!confirm(`"${e.name}" 비밀번호를 삭제하시겠습니까?`)) return;
        deleteWithUndo(e.id,"비밀번호");
      }
      else if(act==="star"){ updateRecord(e.id,{starred:!e.starred}); pwRenderList(); }
    }));
  }
}

/* 비밀번호 추가/수정 — 별도 모달 (암호화 처리 필요) */
async function pwOpenEditor(id){
  if(!masterPassword){ toast("먼저 잠금을 해제하세요"); return; }
  let data={name:"",category:CATEGORIES.password[0]||"",subcategory:"",username:"",password:"",url:"",memo:""};
  if(id){
    const e=entries.find(x=>x.id===id);
    if(e){
      data.name=e.name||""; data.category=e.category||""; data.subcategory=e.subcategory||"";
      try{ if(e.encrypted){ const o=JSON.parse(await decryptStr(e.encrypted, masterPassword)); Object.assign(data, o); } }
      catch(err){ toast("복호화 실패 — 수정할 수 없습니다"); return; }
    }
  }
  // 동일한 공용 모달을 비번용으로 재구성
  mKind="password"; mId=id||null;
  $("mTitle").textContent=(id?"수정":"추가")+" · 🔐 비밀번호";
  const cats=CATEGORIES.password;
  const subs=subcatList("password", data.category);
  $("mFields").innerHTML=`
    <div class="field full"><label>사이트명 <span class="req">*</span></label><input type="text" id="m-pwname" value="${esc(data.name)}"></div>
    <div class="field"><label>카테고리</label>
      <select id="m-pwcat" class="cat-sel"></select>
      <input type="text" id="m-pwcat-new" class="cat-new" autocomplete="off" placeholder="새 카테고리 입력" style="display:none;margin-top:6px">
    </div>
    <div class="field"><label>소분류</label>
      <select id="m-pwsub-sel" class="subcat-sel"></select>
      <input type="text" id="m-pwsub" class="subcat-new" autocomplete="off" placeholder="새 소분류 입력" style="display:none;margin-top:6px">
    </div>
    <div class="field full"><label>아이디</label><input type="text" id="m-pwuser" value="${esc(data.username)}" autocomplete="off"></div>
    <div class="field full"><label>비밀번호 <span class="req">*</span></label><div style="display:flex;gap:6px"><input type="password" id="m-pwpass" value="${esc(data.password)}" autocomplete="new-password" style="flex:1"><button type="button" class="mini-btn" id="m-pwShow">👁</button></div></div>
    <div class="field full"><label>URL (선택)</label><input type="text" id="m-pwurl" value="${esc(data.url)}" placeholder="https://..."></div>
    <div class="field full"><label>메모 (선택)</label><textarea id="m-pwmemo">${esc(data.memo)}</textarea></div>
  `;
  // 카테고리/소분류 드롭다운 구성
  const pwCatSel=$("m-pwcat"), pwCatNew=$("m-pwcat-new");
  const pwSubSel=$("m-pwsub-sel"), pwSubInp=$("m-pwsub");
  const pwCurCat=()=> pwCatSel.value==="__new__" ? (pwCatNew.value.trim()||"") : pwCatSel.value;
  const pwFillCat=(cv)=>{
    let html=cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
    html+=`<option value="__new__">➕ 새 카테고리 직접 입력…</option>`;
    pwCatSel.innerHTML=html;
    if(cv && cats.includes(cv)){ pwCatSel.value=cv; pwCatNew.style.display="none"; }
    else if(cv){ pwCatSel.value="__new__"; pwCatNew.value=cv; pwCatNew.style.display=""; }
    else { pwCatSel.value=cats[0]||""; pwCatNew.style.display="none"; }
  };
  const pwFillSub=(sv)=>{
    const ss=subcatList("password", pwCurCat());
    let html=`<option value="">(소분류 없음)</option>`;
    html+=ss.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("");
    html+=`<option value="__new__">➕ 새 소분류 직접 입력…</option>`;
    pwSubSel.innerHTML=html;
    if(sv && ss.includes(sv)){ pwSubSel.value=sv; pwSubInp.style.display="none"; }
    else if(sv){ pwSubSel.value="__new__"; pwSubInp.value=sv; pwSubInp.style.display=""; }
    else { pwSubSel.value=""; pwSubInp.style.display="none"; }
  };
  pwFillCat(data.category||"");
  pwFillSub(id ? (data.subcategory||"") : "");
  pwCatSel.addEventListener("change",()=>{
    if(pwCatSel.value==="__new__"){ pwCatNew.style.display=""; pwCatNew.value=""; pwCatNew.focus(); }
    else { pwCatNew.style.display="none"; }
    pwFillSub("");
  });
  pwCatNew.addEventListener("input",()=>pwFillSub(""));
  pwSubSel.addEventListener("change",()=>{
    if(pwSubSel.value==="__new__"){ pwSubInp.style.display=""; pwSubInp.value=""; pwSubInp.focus(); }
    else { pwSubInp.style.display="none"; }
  });
  $("m-pwShow").addEventListener("click",()=>{
    const el=$("m-pwpass"); el.type=el.type==="password"?"text":"password";
  });
  $("mPhotoArea").style.display="none";
  $("mAttachArea").style.display="none";
  $("mDelete").style.display=id?"":"none";
  $("overlay").classList.add("show");
  const m=$("overlay").querySelector(".modal"); if(m) m.scrollTop=0;
}

/* ===== 카테고리 모달 진입 정의 (password용 라벨) ===== */
// (openCatMgr 함수에서 처리됨)


const AI_KEY_LS="wl_anthropic_key";
const AI_MODEL="claude-sonnet-4-6";
let aiHistory=[];
function aiGetKey(){ try{ return localStorage.getItem(AI_KEY_LS)||""; }catch(e){ return ""; } }
function aiRenderKeyState(){
  const k=aiGetKey(); const el=$("aiKeyState"); if(!el) return;
  el.innerHTML = k ? `🔑 키 저장됨 (••••${esc(k.slice(-4))})` : "⚠ 키가 없습니다 — 위에 입력 후 저장하세요";
}
function aiInitKeyUI(){
  const k=aiGetKey(); if(k) $("aiKey").value="";
  aiRenderKeyState();
}
$("aiKeySave").addEventListener("click",()=>{
  const v=$("aiKey").value.trim(); if(!v){ toast("키를 입력하세요"); return; }
  try{ localStorage.setItem(AI_KEY_LS,v); }catch(e){ toast("저장 실패"); return; }
  $("aiKey").value=""; aiRenderKeyState(); toast("API 키를 저장했습니다");
});
$("aiKeyClear").addEventListener("click",()=>{ try{ localStorage.removeItem(AI_KEY_LS); }catch(e){} aiRenderKeyState(); toast("키를 삭제했습니다"); });
function aiPushMsg(role,text){
  const box=$("aiChat");
  const mine=role==="user";
  const div=document.createElement("div");
  div.style.cssText=`margin-bottom:10px;display:flex;${mine?"justify-content:flex-end":""}`;
  div.innerHTML=`<div style="max-width:84%;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.55;padding:9px 13px;border-radius:13px;${mine?"background:var(--primary);color:#fff":"background:#fff;border:1px solid var(--line)"}">${esc(text)}</div>`;
  box.appendChild(div); box.scrollTop=box.scrollHeight;
  return div;
}
function aiDataContext(){
  // 사진·암호화 데이터 제외
  const slim=entries.filter(e=>e.kind!=="password").map(e=>{ const {photos,loggedWorkId,fromPlan,encrypted,...rest}=e; return rest; });
  let json=JSON.stringify(slim);
  if(json.length>120000) json=json.slice(0,120000)+"…(이하 생략)";
  return json;
}
async function aiAsk(userText){
  const key=aiGetKey();
  if(!key){ toast("먼저 API 키를 저장하세요"); activateTab("ai"); return; }
  if(!userText.trim()) return;
  aiPushMsg("user",userText);
  aiHistory.push({role:"user",content:userText});
  const waiting=aiPushMsg("assistant","…생각 중");
  const sys=`당신은 시설관리 업무일지 비서입니다. 아래는 사용자의 업무일지 데이터(JSON, 사진 및 비밀번호 데이터 제외)입니다. 한국어로 간결하고 실용적으로 답하세요. 데이터에 근거해 답하고, 없는 내용은 추측하지 마세요.\n\n오늘 날짜: ${todayStr()}\n\n[데이터]\n${aiDataContext()}`;
  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({ model:AI_MODEL, max_tokens:1500, system:sys, messages:aiHistory })
    });
    if(!res.ok){
      let msg=`HTTP ${res.status}`;
      try{ const j=await res.json(); if(j&&j.error&&j.error.message) msg=j.error.message; }catch(_){}
      throw Object.assign(new Error(msg),{code:"api_"+res.status});
    }
    const data=await res.json();
    const text=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n").trim()||"(응답 없음)";
    waiting.remove();
    aiPushMsg("assistant",text);
    aiHistory.push({role:"assistant",content:text});
  }catch(e){
    waiting.remove();
    const r=logErr("AI 요청", e);
    aiPushMsg("assistant",`❌ 오류 [${r.code}] ${r.message}\n\n키가 올바른지, 사용량이 남아있는지 확인해 주세요.`);
  }
}
$("aiSend").addEventListener("click",()=>{ const t=$("aiInput").value; $("aiInput").value=""; aiAsk(t); });
$("aiInput").addEventListener("keydown",e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); $("aiSend").click(); } });
$("aiClear").addEventListener("click",()=>{ aiHistory=[]; $("aiChat").innerHTML=""; toast("대화를 지웠습니다"); });
const AI_PROMPTS={
  today:"오늘 날짜의 업무·통화·메모·회의·전달사항·휴가를 항목별로 요약해줘.",
  week:"이번 주(월~일)의 활동을 항목별로 요약하고, 눈에 띄는 점이나 반복되는 이슈가 있으면 짚어줘.",
  pending:"미완료 업무와 완료되지 않은 오늘계획, 그리고 통화 중 조치가 필요한 건을 모아서 우선순위와 함께 정리해줘.",
  cost:"업무에 기록된 비용을 분야별·기간별로 분석하고 합계와 큰 지출 항목을 알려줘.",
  improve:"업무의 '개선사항' 내용을 모아서 공통 주제별로 묶고, 실행 가능한 제안으로 정리해줘."
};
document.querySelectorAll("[data-ai]").forEach(b=>b.addEventListener("click",()=>{ const p=AI_PROMPTS[b.dataset.ai]; if(p) aiAsk(p); }));

init();
