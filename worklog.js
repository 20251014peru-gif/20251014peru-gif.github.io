/* ===== 설정 ===== */
const APP_VERSION = "v44-0626-1719";
// v44-20260619 변경사항:
// - 업무 모달에서 지출유형 선택 후 저장 → 지출 모달 자동으로 열림 (직접 작성 구조)
// - 개인비용/후불청구일 때 모달 위에 색상 표시 (파란/주황)
// - 업무 데이터(날짜·업체·자재·수량·단가·합계)가 지출 모달에 자동 채워짐
// - syncWorkExpense 자동 생성/삭제 제거 — 기존 지출 내역 안전 보호
// v43-20260617 변경사항:
// - 업무 입력창: 위치/단가/택배비/개선사항 필드 제거
// - 합계→지출금액으로 이름 변경
// - 지출종류: 없음/개인비용/후불청구로 변경
// v42-20260608 변경사항:
// - 업무 목록: 체크박스 다중선택 삭제 추가, 삭제버튼 항상 표시
// - 업무 추가창: 분야/지출종류 → 해당층/위치 아래로 이동, 자재사양/단가/수량/합계/택배비 필드 추가
// - 급한메모: 패널 밖 클릭 시 닫기
// - 청소 지시사항/전달사항: Enter 키로 항목 추가
// - 청소 소모품: 점보롤/핸드타월 고정 → 입고된 자재/출고된 자재 자유 항목으로 변경
// - 점검일지 폴더 수정 버튼 크기 크게
// - 통화 추가: 이름/직책/업체 3개 필드 분리
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
// v37: 분야를 평면 배열로 (트리 구조 제거, 들여쓰기 없음)
// 지출 전용 분야
const EXP_FIELDS_LS = 'wl_exp_fields';

// 담당업체 목록 관리
const WORK_VENDORS_LS = 'wl_work_vendors';
function loadWorkVendors(){ try{ return JSON.parse(localStorage.getItem(WORK_VENDORS_LS)||'[]'); }catch(e){ return []; } }
function saveWorkVendors(arr){ try{ localStorage.setItem(WORK_VENDORS_LS,JSON.stringify(arr)); }catch(e){} }
function loadExpFields(){
  try{ const a=JSON.parse(localStorage.getItem(EXP_FIELDS_LS)||'null'); if(Array.isArray(a)&&a.length) return a; }catch(e){}
  return [];
}
function saveExpFields(arr){ try{ localStorage.setItem(EXP_FIELDS_LS,JSON.stringify(arr)); }catch(e){} }

const DEFAULT_FIELDS = [
  "전기","엘리베이터","카리프트","통신","기계","냉난방","누수",
  "소방","소화전","스프링클러","감지기","수신기","펌프",
  "영선","주차","주간점검","월간점검","협력업체점검",
  "청소","화단관리","은진",
  "품의서","전표","안내문","관리비","임대",
  "기타"
];
let FIELDS = DEFAULT_FIELDS.slice();
const FIELDS_LS_KEY = "wl_fields_v37";

// 자재 전용 분야 (필터 칩용)
const MAT_FIELDS_LS = "wl_mat_fields_v44";
const DEFAULT_MAT_FIELDS = ["영선","전기","청소","소방","기계","환경","기타"];
let MAT_FIELDS = (()=>{ try{ const s=JSON.parse(localStorage.getItem(MAT_FIELDS_LS)||"null"); if(Array.isArray(s)&&s.length) return s; }catch(e){} return DEFAULT_MAT_FIELDS.slice(); })();
function saveMatFields(){ try{ localStorage.setItem(MAT_FIELDS_LS, JSON.stringify(MAT_FIELDS)); }catch(e){} }
function openMatFieldMgr(){
  const old=document.getElementById("matFieldMgrOv"); if(old) old.remove();
  const ov=document.createElement("div");
  ov.id="matFieldMgrOv";
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit";
  ov.innerHTML=`<div style="background:#fff;border-radius:18px;width:100%;max-width:380px;padding:22px;box-shadow:0 8px 32px rgba(0,0,0,.2)">
    <h3 style="margin:0 0 14px;font-size:17px;font-weight:800;color:#1a2f45">⚙ 자재 분야 관리</h3>
    <div id="mfmList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;max-height:280px;overflow:auto"></div>
    <div style="display:flex;gap:6px;margin-bottom:12px">
      <input type="text" id="mfmNew" placeholder="새 분야 입력" style="flex:1;height:38px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:14px;font-family:inherit;outline:none;background:#f7faff">
      <button id="mfmAdd" style="height:38px;padding:0 14px;background:#3f7cb8;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">➕ 추가</button>
    </div>
    <button id="mfmClose" style="width:100%;height:42px;background:#f7faff;border:2px solid #dbe6f4;border-radius:10px;font-size:14px;font-weight:700;color:#7a92a8;font-family:inherit;cursor:pointer">닫기</button>
  </div>`;
  document.body.appendChild(ov);
  function renderList(){
    const box=document.getElementById("mfmList");
    box.innerHTML=MAT_FIELDS.map((f,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:#f7faff;border-radius:8px;border:1px solid #e8f0fa">
      <span style="flex:1;font-size:14px;font-weight:600;color:#1a2f45">${f}</span>
      <button data-mfmdel="${i}" style="background:#fde8e8;border:none;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700;color:#b52929;cursor:pointer;font-family:inherit">삭제</button>
    </div>`).join("");
    box.querySelectorAll("[data-mfmdel]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const i=+btn.dataset.mfmdel;
        if(!confirm(`"${MAT_FIELDS[i]}" 분야를 삭제할까요?`)) return;
        MAT_FIELDS.splice(i,1); saveMatFields(); renderList();
        renderMatFieldChips(); renderMaterial();
      });
    });
  }
  renderList();
  document.getElementById("mfmAdd").addEventListener("click",()=>{
    const inp=document.getElementById("mfmNew");
    const v=(inp.value||"").trim(); if(!v) return;
    if(MAT_FIELDS.includes(v)){ if(typeof toast==="function") toast("이미 있는 분야예요"); return; }
    MAT_FIELDS.push(v); saveMatFields(); inp.value=""; renderList();
    renderMatFieldChips(); renderMaterial();
    if(typeof toast==="function") toast("추가됐어요");
  });
  document.getElementById("mfmNew").addEventListener("keydown",e=>{ if(e.key==="Enter") document.getElementById("mfmAdd").click(); });
  document.getElementById("mfmClose").addEventListener("click",()=>ov.remove());
  /* 배경 클릭 닫기 비활성화 */
}

// 분야별 색상 자동 배정 (10가지 색 풀)
const FIELD_COLOR_POOL = ["tech","env","admin","etc","peach","mint","gold","blue","purple","rose"];
function fieldClass(f){
  if(!f) return "etc";
  // 사용자 정의 분야는 이름 해시로 색 배정
  const i = FIELDS.indexOf(f);
  if(i<0) return "etc";
  return FIELD_COLOR_POOL[i % FIELD_COLOR_POOL.length];
}

// ── 분야(FIELDS) = contact_cats와 통합 ──────────────────────
// contact_cats 컬렉션 하나를 worklog업무·통화·contacts 공통으로 사용
const SHARED_CATS_COL = "contact_cats";
const SHARED_CATS_LS  = "wl_shared_cats_v1";
const DEFAULT_SHARED_CATS = ["감지기","견적업체","공사/인테리어","관리비","기계","기계/냉난방","기타","냉난방","누수","서희타워공사","설비","소방","소화전","수신기","스프링클러","승강기","안내문","엘리베이터","영선","월간점검","은진","인테리어","임대","임차인","자재","전기","전표","주간점검","주차","직원(재직중)","직원(퇴사)","청소","카리프트","통신","펌프","품의서","행정","협력업체점검","화단관리"];

async function loadSharedCats(){
  // localStorage 먼저
  try{
    const ls = JSON.parse(localStorage.getItem(SHARED_CATS_LS)||"null");
    if(Array.isArray(ls)&&ls.length){
      const merged = [...ls];
      DEFAULT_SHARED_CATS.forEach(c=>{ if(!merged.includes(c)) merged.push(c); });
      merged.sort((a,b)=>a.localeCompare(b,"ko"));
      FIELDS = merged;
      // CONTACT_CATS는 독립 관리 (공유 제거)
      return;
    }
  }catch(e){}
  // Firebase
  if(!online||!db) return;
  try{
    const snap = await db.collection(SHARED_CATS_COL).doc("list").get();
    if(snap.exists){
      const d=snap.data();
      if(Array.isArray(d.cats)&&d.cats.length){
        const merged = [...d.cats];
        DEFAULT_SHARED_CATS.forEach(c=>{ if(!merged.includes(c)) merged.push(c); });
        merged.sort((a,b)=>a.localeCompare(b,"ko"));
        FIELDS = merged;
        // CONTACT_CATS는 독립 관리 (공유 제거)
        try{ localStorage.setItem(SHARED_CATS_LS, JSON.stringify(FIELDS)); }catch(e){}
      }
    } else {
      await db.collection(SHARED_CATS_COL).doc("list").set({cats:DEFAULT_SHARED_CATS, updatedAt:Date.now()});
      FIELDS = DEFAULT_SHARED_CATS.slice();
      if(typeof CONTACT_CATS!=="undefined") CONTACT_CATS = DEFAULT_SHARED_CATS.slice();
      try{ localStorage.setItem(SHARED_CATS_LS, JSON.stringify(FIELDS)); }catch(e){}
    }
  }catch(e){ console.warn("분야 로드 실패:", e); }
}

function loadFields(){
  try{
    const ls = JSON.parse(localStorage.getItem(SHARED_CATS_LS)||"null");
    if(Array.isArray(ls)&&ls.length) FIELDS = ls;
    else {
      const old = JSON.parse(localStorage.getItem(FIELDS_LS_KEY)||"null");
      if(Array.isArray(old)&&old.length) FIELDS = old;
    }
  }catch(e){}
}
function saveFields(){
  FIELDS.sort((a,b)=>a.localeCompare(b,"ko"));
  try{ localStorage.setItem(SHARED_CATS_LS, JSON.stringify(FIELDS)); }catch(e){}
  // CONTACT_CATS도 동기화
  // Firestore 동기화 (contact_cats + worklog_meta 모두)
  if(online && db){
    db.collection(SHARED_CATS_COL).doc("list").set({cats:FIELDS, updatedAt:Date.now()}).catch(()=>{});
    db.collection("worklog_meta").doc("fields").set({fields:FIELDS, updatedAt:Date.now()}).catch(()=>{});
  }
}

// 옛 FIELD_HINT 호환 (사용처에서 참조)
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
function statusClass(s){ return s==="완료"?"done":s==="진행중"?"prog":"todo"; }
function statusColor(s){ return s==="완료"?"var(--mint)":s==="진행중"?"var(--gold)":"var(--peach)"; }

const KIND_LABEL={work:"업무",plan:"오늘계획",memo:"메모",call:"통화",vacation:"휴가",meeting:"회의메모",deliver:"전달사항",filelink:"파일링크",site:"사이트",password:"비밀번호",schedule:"예정",item:"품목",stock:"입출고",cleaning:"청소일지",expense:"지출",accident:"사고"};
const PHOTO_KINDS=["work","memo","meeting","accident"];
const ATTACH_KINDS=["work","memo","meeting","accident"];

/* ===== v16 카테고리 시스템 ===== */
const DEFAULT_CATS_FILE = ["전기","소방","기계","서희타워 운영","사무관련","비용관련","공적업무","용역","개인용도"];
const DEFAULT_CATS_SITE = ["전기","소방","기계","서희타워 운영","사무관련","비용관련","공적업무","용역","개인용도","견적전용업체"];
const DEFAULT_CATS_PW   = ["업무시스템","거래처","공적업무"];
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
    {k:"field",label:"분야",type:"field"},
    {k:"title",label:"업무내역",type:"text",full:true,req:true},
    // 아래는 JS에서 workMode에 따라 동적 렌더
  ],
  // 일반업무 토글 추가 필드
  work_simple_more:[
    {k:"detail",label:"상세내용",type:"textarea",full:true},
    {k:"material",label:"자재명·규격",type:"text"},
    {k:"qty",label:"수량",type:"number"},
  ],
  // 외주·비용 전용 필드
  work_full:[
    {k:"expType",label:"지출종류",type:"select",opts:["개인비용","후불청구"]},
    {k:"cost",label:"금액 (원)",type:"number"},
  ],
  // 외주 토글 추가 필드
  work_full_more:[
    {k:"detail",label:"상세내용",type:"textarea",full:true},
    {k:"estimateMemo",label:"견적 메모",type:"textarea",full:true},
  ],
  plan:[ {k:"date",label:"날짜",type:"date",req:true}, {k:"text",label:"할 일",type:"text",full:true,req:true} ],
  memo:[ {k:"date",label:"날짜",type:"date",req:true}, {k:"title",label:"제목(선택)",type:"text",full:true}, {k:"body",label:"내용",type:"textarea",full:true,req:true} ],
  call:[
    {k:"date",label:"날짜",type:"date",req:true}, {k:"time",label:"시간",type:"time"},
    {k:"dir",label:"구분",type:"select",opts:CALLDIR},
    {k:"content",label:"통화 내용",type:"textarea",full:true,req:true},
    {k:"callContact",label:"담당업체/담당자",type:"callcontact"},
    {k:"name",label:"이름",type:"text"},
    {k:"role",label:"직책",type:"text"},
    {k:"company",label:"업체",type:"text"},
    {k:"phone",label:"전화번호",type:"tel"},
    {k:"callField",label:"분야",type:"callfield"},
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
    {k:"date",label:"예정일",type:"date",req:true,full:true},
    {k:"startTime",label:"시작 시간",type:"timepick",full:true},
    {k:"scheduleType",label:"반복 유형",type:"select",opts:["일회성","월간반복","연간반복"],full:true},
    {k:"title",label:"예정 내용",type:"textarea",full:true,req:true},
    {k:"memo",label:"메모(선택)",type:"textarea",full:true},
    {k:"alertBefore",label:"🔔 알림 설정",type:"alertbefore",full:true},
    {k:"alertMethod",label:"알림 방법",type:"select",opts:["팝업","이메일","팝업+이메일"],full:true},
  ],
  item:[
    {k:"itemCode",label:"품목 ID (내부 관리용)",type:"text"},
    {k:"shopId",label:"서브원 상품ID (검색용)",type:"text"},
    {k:"itemName",label:"품목명",type:"text",full:true,req:true},
    {k:"spec",label:"규격 (간단히)",type:"text",full:true},
    {k:"unit",label:"단위",type:"text"},
    {k:"field",label:"분야",type:"field"},
    {k:"maker",label:"제조원",type:"text"},
    {k:"vendor",label:"주거래처/공급업체",type:"text"},
    {k:"unitPrice",label:"기본 단가 (원)",type:"number"},
    {k:"safetyStock",label:"안전재고 수량",type:"number"},
    {k:"recurring",label:"구매 주기",type:"select",opts:["비주기","월간","분기","반기","연간","수시"]},
    {k:"location",label:"보관 위치",type:"text",full:true},
    {k:"memo",label:"메모",type:"textarea",full:true},
  ],
  stock:[
    {k:"date",label:"거래일",type:"date",req:true},
    {k:"stockType",label:"구분",type:"select",opts:["입고","출고"]},
    {k:"itemId",label:"품목",type:"itemselect",req:true},
    {k:"qty",label:"수량",type:"number",req:true},
    {k:"unitPrice",label:"단가 (원)",type:"number"},
    {k:"amount",label:"금액 (원)",type:"number"},
    {k:"vendor",label:"거래처",type:"text"},
    {k:"docNo",label:"전표/세금계산서 번호",type:"text"},
    {k:"useTarget",label:"사용처 (출고시)",type:"text",full:true},
    {k:"memo",label:"메모",type:"textarea",full:true},
  ],
  expense:[
    {k:"date",label:"날짜",type:"date",req:true},
    {k:"expType",label:"종류",type:"select",opts:["개인지출","세금계산서","전표"],req:true},
    {k:"title",label:"내역",type:"text",full:true,req:true},
    {k:"amount",label:"금액 (원)",type:"number",req:true},
    {k:"memo",label:"비고",type:"text",full:true},
  ],
  // v44: 사고 처리 내역
  accident:[
    {k:"date",label:"발생 날짜",type:"date",req:true},
    {k:"time",label:"발생 시각",type:"time"},
    {k:"accType",label:"사고 종류",type:"select",opts:["누수","화재","미끄러짐","추락","차량파손","도난","폭행/시비","엘리베이터","주차장","승강기","감전","기타"],req:true},
    {k:"status",label:"처리 상태",type:"select",opts:["⏳ 접수","🔍 조사중","⚙ 처리중","✅ 완료","📋 종결"],req:true},
    {k:"floor",label:"발생 층",type:"floor"},
    {k:"location",label:"상세 위치",type:"text",full:true},
    {k:"field",label:"분야",type:"field"},
    {k:"partyName",label:"당사자 이름",type:"text"},
    {k:"partyType",label:"당사자 유형",type:"select",opts:["임차인","방문객","직원","외부인","불명"]},
    {k:"partyPhone",label:"당사자 연락처",type:"text"},
    {k:"title",label:"사고 제목",type:"text",full:true,req:true},
    {k:"detail",label:"사고 경위 (상세)",type:"textarea",full:true},
    {k:"emergency",label:"응급조치 내용",type:"textarea",full:true},
    {k:"reported",label:"신고 여부",type:"select",opts:["없음","경찰 112","소방 119","구급차","보험사","본사 보고","기타"]},
    {k:"repairCost",label:"수리비 (원)",type:"number"},
    {k:"compensation",label:"배상금 (원)",type:"number"},
    {k:"insurance",label:"보험금 (원)",type:"number"},
    {k:"followUp",label:"후속 조치 / 재발 방지책",type:"textarea",full:true},
    {k:"memo",label:"비고",type:"textarea",full:true},
    // v44: vendors=[{name,phone,memo}], history=[{date,time,by,action,status,memo}]는 데이터 배열로 저장
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
const kstNow = () => new Date(Date.now() + 9*60*60*1000);
const todayStr = () => { const d=kstNow(); return d.toISOString().slice(0,10); };
const yesterdayStr = () => { const d=kstNow(); d.setUTCDate(d.getUTCDate()-1); return d.toISOString().slice(0,10); };
const nowTime = () => { const d=kstNow(); return d.toISOString().slice(11,16); };
const clockStr = ts => { if(!ts) return ""; const d=new Date(ts); const k=new Date(d.getTime()+9*60*60*1000); return k.toISOString().slice(11,16); };
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
  // 평면화: 들여쓰기 없이 일자로
  const opts = FIELDS.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join("");
  return opts + `<option value="__new__">➕ 새 분야 추가</option>`;
}

/* v44: 한글 초성 추출 (예: "전기" → "ㅈㄱ") */
const HANGUL_CHOSUNG = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
function getChosung(str){
  let r = "";
  for(const ch of (str||"")){
    const code = ch.charCodeAt(0);
    if(code >= 0xAC00 && code <= 0xD7A3){
      // 한글 음절 → 초성 인덱스
      r += HANGUL_CHOSUNG[Math.floor((code - 0xAC00) / 588)];
    } else if(code >= 0x3131 && code <= 0x314E){
      // 이미 자음
      r += ch;
    } else {
      r += ch;
    }
  }
  return r;
}
function isChosungOnly(str){
  if(!str) return false;
  return /^[ㄱ-ㅎ]+$/.test(str);
}

/* v44: 분야 검색 가능한 UI (초성검색 지원) */
function makeFieldSearchUI(inputId, listId, onSelect){
  const inp = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if(!inp || !list) return;
  if(inp._fieldACwired) return;
  inp._fieldACwired = true;

  // ✕ 클리어 버튼 추가 (담당업체와 동일하게)
  const wrap = inp.parentElement;
  if(wrap && !wrap.querySelector('.fsl-clear')){
    wrap.style.position = 'relative';
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'fsl-clear';
    clearBtn.textContent = '✕';
    clearBtn.style.cssText = 'position:absolute;right:56px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:16px;color:#aab8c8;cursor:pointer;padding:4px;display:none;line-height:1;z-index:10';
    clearBtn.addEventListener('mousedown', e=>{
      e.preventDefault();
      inp.value = '';
      clearBtn.style.display = 'none';
      list.style.display = 'none';
      inp.focus();
      render(''); // 클리어 후 전체 목록 표시
    });
    wrap.appendChild(clearBtn);
    inp.addEventListener('input', ()=>{
      clearBtn.style.display = inp.value ? 'block' : 'none';
    });
  }

  function render(q){
    q = (q||"").trim();
    let filtered;
    if(!q){
      filtered = FIELDS.slice();
    } else if(isChosungOnly(q)){
      // 초성검색
      filtered = FIELDS.filter(f => getChosung(f).includes(q));
    } else {
      // 일반 검색 (포함 또는 초성 포함)
      const ql = q.toLowerCase();
      filtered = FIELDS.filter(f => {
        if(f.toLowerCase().includes(ql)) return true;
        if(getChosung(f).includes(q)) return true;
        return false;
      });
    }
    if(!filtered.length){
      list.innerHTML = `<div style="padding:10px 14px;color:#aab8c8;font-size:13px">"${esc(q)}" 검색 결과 없음 — Enter로 새 분야 추가</div>`;
      list.style.display = "block";
      return;
    }
    list.innerHTML = filtered.map((f,i)=>`
      <div class="fsl-item" data-fv="${esc(f)}" data-idx="${i}" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f6ff;transition:background .1s;font-size:14px;font-weight:600;color:#1a2f45">
        <span class="pill ${fieldClass(f)}" style="margin-right:8px;font-size:11px">${esc(f)}</span>
        <span style="font-size:11px;color:#aab8c8">${esc(getChosung(f))}</span>
      </div>`).join("");
    list.style.display = "block";
    list.querySelectorAll(".fsl-item").forEach(el=>{
      el.addEventListener("mouseenter",()=>el.style.background="#f0f6ff");
      el.addEventListener("mouseleave",()=>el.style.background="");
      el.addEventListener("mousedown",e=>{
        e.preventDefault();
        inp.value = el.dataset.fv;
        list.style.display = "none";
        const cb = wrap && wrap.querySelector('.fsl-clear');
        if(cb) cb.style.display = 'block';
        if(onSelect) onSelect(el.dataset.fv);
      });
    });
  }

  let activeIdx = -1;
  function updateActive(items){
    items.forEach((el,i)=>{ el.style.background = i===activeIdx ? "#e8f0fb" : ""; });
  }

  inp.addEventListener("input", ()=>{ activeIdx=-1; render(inp.value); });
  inp.addEventListener("focus", ()=>{ activeIdx=-1; render(inp.value); });
  // v44: 클릭 시에도 목록 다시 표시 (이미 focus 상태에서 클릭한 경우)
  inp.addEventListener("click", ()=>{ activeIdx=-1; render(inp.value); });
  inp.addEventListener("blur", ()=>setTimeout(()=>{ list.style.display="none"; activeIdx=-1; }, 200));
  inp.addEventListener("keydown", e=>{
    const items = [...list.querySelectorAll(".fsl-item")];
    if(e.key==="ArrowDown"){
      e.preventDefault();
      if(!items.length) return;
      activeIdx = Math.min(activeIdx+1, items.length-1);
      updateActive(items);
      if(items[activeIdx]) items[activeIdx].scrollIntoView({block:"nearest"});
    } else if(e.key==="ArrowUp"){
      e.preventDefault();
      if(!items.length) return;
      activeIdx = Math.max(activeIdx-1, 0);
      updateActive(items);
      if(items[activeIdx]) items[activeIdx].scrollIntoView({block:"nearest"});
    } else if(e.key==="Enter"){
      e.preventDefault();
      e.stopPropagation();
      if(activeIdx >= 0 && items[activeIdx]){
        items[activeIdx].dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));
      } else if(items.length > 0){
        items[0].dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));
      } else {
        // 검색 결과 없으면 → 새 분야로 추가
        const v = inp.value.trim();
        if(v && !FIELDS.includes(v)){
          FIELDS.push(v);
          saveFields();
          list.style.display = "none";
          if(onSelect) onSelect(v);
          toast(`✅ "${v}" 분야 추가됨`);
        }
      }
    } else if(e.key==="Escape"){
      list.style.display = "none";
      activeIdx = -1;
    } else if(e.key==="Tab"){
      // Tab → 첫 결과 자동 선택
      if(items.length > 0){
        e.preventDefault();
        items[0].dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));
      }
    }
  });

  // 초기 클리어 버튼 상태 (값이 이미 있으면 표시)
  setTimeout(()=>{
    const cb = wrap && wrap.querySelector('.fsl-clear');
    if(cb) cb.style.display = inp.value ? 'block' : 'none';
  }, 50);
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
function fileIcon(p, ptype, label){
  if(isFolder(p, ptype)){
    // 폴더명 키워드로 아이콘
    const fn=((p||"")+(label||"")).toLowerCase();
    if(/전기|electric/.test(fn)) return "⚡";
    if(/소방|fire/.test(fn)) return "🔥";
    if(/기계|냉난방|hvac|boiler/.test(fn)) return "❄️";
    if(/승강기|엘리베이터|elevator/.test(fn)) return "🛗";
    if(/청소|미화/.test(fn)) return "🧹";
    if(/경비|보안|security/.test(fn)) return "🛡️";
    if(/계약|contract/.test(fn)) return "📜";
    if(/도면|설계|drawing/.test(fn)) return "🗺️";
    if(/보험/.test(fn)) return "🛡️";
    if(/발주|구매|order/.test(fn)) return "🚚";
    if(/견적|estimate/.test(fn)) return "💰";
    if(/공문|문서|내부/.test(fn)) return "📨";
    if(/업무일지|일지/.test(fn)) return "📓";
    if(/사진|photo|image/.test(fn)) return "📷";
    if(/회의|meeting/.test(fn)) return "💼";
    if(/민원|complaint/.test(fn)) return "📢";
    if(/점검|inspect|check/.test(fn)) return "🔍";
    if(/관리|manage/.test(fn)) return "🗂️";
    if(/품의서|품의/.test(fn)) return "📝";
    return "📁";
  }
  // 파일명 키워드로 아이콘
  const fn=((p||"")+(label||"")).toLowerCase();
  if(/전화|통화|연락처|phone|call/.test(fn)) return "📞";
  if(/안내|인포|info|notice/.test(fn)) return "ℹ️";
  if(/교육|training|edu/.test(fn)) return "🎓";
  if(/점검|inspect|check/.test(fn)) return "🔍";
  if(/발전기|generator/.test(fn)) return "🔋";
  if(/소방|fire/.test(fn)) return "🚒";
  if(/전기|electric/.test(fn)) return "⚡";
  if(/승강기|엘리베이터/.test(fn)) return "🛗";
  if(/냉난방|냉각|hvac/.test(fn)) return "❄️";
  if(/보험/.test(fn)) return "🛡️";
  if(/계약/.test(fn)) return "📜";
  if(/견적/.test(fn)) return "💰";
  if(/주차|parking/.test(fn)) return "🚗";
  if(/도면/.test(fn)) return "🗺️";
  if(/품의/.test(fn)) return "📝";
  if(/공문|내부문서/.test(fn)) return "📨";
  if(/일지|일일/.test(fn)) return "📓";
  if(/회의|meeting/.test(fn)) return "💼";
  if(/민원/.test(fn)) return "📢";
  if(/관리비/.test(fn)) return "💸";
  if(/사진|photo/.test(fn)) return "📷";
  if(/주간|weekly/.test(fn)) return "📅";
  if(/월간|monthly/.test(fn)) return "🗓️";
  // 확장자별
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
  return `<div class="row-attach-mini">`+arr.filter(a=>a && a.path).map(a=>`<a href="${toLocalUrl(a.path)}" title="${esc(a.path)}" onclick="event.stopPropagation()">${fileIcon(a.path)} ${esc(a.label||a.path.split(/[\\\/]/).pop()||a.path)}</a>`).join("")+`</div>`;
}

/* 날짜 범위 필터 */
const RANGES=["전체","오늘","어제","2일전","3일전","이번주","이번달"];
function dayOffset(n){ const d=kstNow(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }
function weekRange(){ const d=kstNow(); const dow=(d.getUTCDay()+6)%7; const mon=new Date(d); mon.setUTCDate(d.getUTCDate()-dow); const sun=new Date(mon); sun.setUTCDate(mon.getUTCDate()+6); return [mon.toISOString().slice(0,10), sun.toISOString().slice(0,10)]; }
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
/* ── 풀스크린 이미지 뷰어 (scan-app 동일) ── */
let _iv={scale:1,x:0,y:0,rot:0,dragging:false,lastX:0,lastY:0};

function showImg(src,title){
  const ov=$("imgOverlay"), img=$("imgFull");
  ov.classList.add("show");
  $("imgViewerTitle").textContent=title||"";
  img.src=src;
  img.onload=()=>_ivFit();
}
function _ivApply(){
  $("imgFull").style.transform=`translate(${_iv.x}px,${_iv.y}px) scale(${_iv.scale}) rotate(${_iv.rot}deg)`;
}
function _ivFit(){
  const ov=$("imgOverlay"),img=$("imgFull");
  const r=ov.getBoundingClientRect();
  const iw=img.naturalWidth,ih=img.naturalHeight;
  if(!iw||!ih)return;
  _iv.scale=Math.min(r.width/iw,(r.height-120)/ih)*0.95;
  _iv.x=0;_iv.y=0;_iv.rot=0;
  _ivApply();
}
function _ivClose(){ $("imgOverlay").classList.remove("show"); $("imgFull").src=""; }

/* 버튼 이벤트 */
$("ivClose").addEventListener("click",_ivClose);
$("ivFit").addEventListener("click",_ivFit);
$("ivZoomIn").addEventListener("click",()=>{_iv.scale=Math.min(10,_iv.scale*1.25);_ivApply();});
$("ivZoomOut").addEventListener("click",()=>{_iv.scale=Math.max(0.1,_iv.scale*0.8);_ivApply();});
$("ivRotL").addEventListener("click",()=>{_iv.rot-=90;_ivApply();});
$("ivRotR").addEventListener("click",()=>{_iv.rot+=90;_ivApply();});
$("ivDownload").addEventListener("click",()=>{
  const src=$("imgFull").src;
  const title=$("imgViewerTitle").textContent||"사진";
  // base64면 직접 다운로드, Storage URL이면 새 탭
  if(src.startsWith("data:")){
    const a=document.createElement("a");
    a.href=src; a.download=title.replace(/[/\\:*?"<>|]/g,"_")+".jpg"; a.click();
  } else {
    // Storage URL — 새 탭에서 열어서 저장
    const w=window.open(src,"_blank");
    if(!w) toast("팝업 차단됨 — 브라우저에서 팝업 허용 후 다시 시도하세요");
    else toast("새 탭에서 열림 — 마우스 우클릭 → 이미지 저장");
  }
});
$("ivShare").addEventListener("click",async()=>{
  const src=$("imgFull").src;
  const title=($("imgViewerTitle").textContent||"사진").replace(/[/\\:*?"<>|]/g,"_");
  try{
    if(src.startsWith("data:") && navigator.share && navigator.canShare){
      // base64일 때만 파일 공유 시도
      const res=await fetch(src);
      const blob=await res.blob();
      const file=new File([blob],title+".jpg",{type:"image/jpeg"});
      if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title});return;}
    }
    // Storage URL이거나 Web Share 미지원이면 새 탭
    const w=window.open(src.startsWith("data:")? src : src,"_blank");
    if(w) toast("새 탭에서 열림 — 길게 눌러 저장/공유");
    else toast("팝업 차단됨 — ⬇ 다운로드 버튼 이용");
  }catch(e){if(e.name!=="AbortError")toast("공유 실패: "+e.message);}
});

/* 휠 줌 */
$("imgOverlay").addEventListener("wheel",e=>{
  e.preventDefault();
  _iv.scale=Math.max(0.1,Math.min(10,_iv.scale*(e.deltaY<0?1.15:0.87)));
  _ivApply();
},{passive:false});

/* 마우스 드래그 */
$("imgFull").addEventListener("mousedown",e=>{
  e.preventDefault();_iv.dragging=true;_iv.lastX=e.clientX;_iv.lastY=e.clientY;
});
window.addEventListener("mousemove",e=>{
  if(!_iv.dragging)return;
  _iv.x+=e.clientX-_iv.lastX;_iv.y+=e.clientY-_iv.lastY;
  _iv.lastX=e.clientX;_iv.lastY=e.clientY;_ivApply();
});
window.addEventListener("mouseup",()=>{_iv.dragging=false;});

/* 터치 핀치줌 */
$("imgOverlay").addEventListener("touchstart",e=>{
  if(e.touches.length===2){
    const dx=e.touches[0].clientX-e.touches[1].clientX;
    const dy=e.touches[0].clientY-e.touches[1].clientY;
    _iv._td=Math.hypot(dx,dy);
  }else if(e.touches.length===1){
    _iv.dragging=true;_iv.lastX=e.touches[0].clientX;_iv.lastY=e.touches[0].clientY;
  }
},{passive:true});
$("imgOverlay").addEventListener("touchmove",e=>{
  if(e.touches.length===2){
    e.preventDefault();
    const dx=e.touches[0].clientX-e.touches[1].clientX;
    const dy=e.touches[0].clientY-e.touches[1].clientY;
    const d=Math.hypot(dx,dy);
    if(_iv._td){_iv.scale=Math.max(0.1,Math.min(10,_iv.scale*d/_iv._td));_ivApply();}
    _iv._td=d;
  }else if(e.touches.length===1&&_iv.dragging){
    _iv.x+=e.touches[0].clientX-_iv.lastX;_iv.y+=e.touches[0].clientY-_iv.lastY;
    _iv.lastX=e.touches[0].clientX;_iv.lastY=e.touches[0].clientY;_ivApply();
  }
},{passive:false});
$("imgOverlay").addEventListener("touchend",()=>{_iv.dragging=false;_iv._td=0;});

/* ESC 닫기 */
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("imgOverlay").classList.contains("show"))_ivClose();});

/* 썸네일 클릭 → 뷰어 열기 (기존 zimg 이벤트 유지) */
document.addEventListener("click",e=>{ const im=e.target.closest("img.zimg"); if(im){ e.stopPropagation(); showImg(im.src,im.dataset.title||""); } });
document.addEventListener("click",e=>{ const im=e.target.closest("img.zimg"); if(im){ e.stopPropagation(); showImg(im.src); } });

/* ===== 저장소 ===== */
function lsLoad(){ try{ return JSON.parse(localStorage.getItem("wl_"+COL)||"[]"); }catch(e){ return []; } }

/* localStorage 전체 용량 확인 (bytes) */
function lsTotalSize(){
  let t=0;
  try{ for(let k in localStorage){ if(localStorage.hasOwnProperty(k)) t+=(localStorage.getItem(k)||"").length; } }catch(e){}
  return t;
}

/* 오래된 캐시 자동 정리 — 4.5MB 초과 시 호출 */
function lsAutoClean(){
  const targets=[
    "wl_tempbackup",       // 임시백업 (삭제 무방)
    "psc_photos_personal", // 연락처 사진 캐시 (재로드 가능)
  ];
  targets.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
  console.warn("[worklog] localStorage 자동 정리 완료. 현재:", (lsTotalSize()/1024).toFixed(0)+"KB");
}

/* 안전 lsSave — 용량 초과 시 자동 정리 후 재시도 */
function lsSave(){
  try{
    localStorage.setItem("wl_"+COL, JSON.stringify(entries));
  }catch(e){
    // 1차: 자동 정리 후 재시도
    try{
      lsAutoClean();
      localStorage.setItem("wl_"+COL, JSON.stringify(entries));
      toast("💾 저장 공간 자동 정리 후 저장했습니다");
    }catch(e2){
      // 2차: Firebase에는 저장되므로 사용자에게 안내
      console.error("[worklog] lsSave 실패:", e2);
      toast("⚠️ 로컬 저장 실패 — 클라우드에는 저장됩니다 (브라우저 저장공간 부족)");
    }
  }
}

function genId(){ return online ? db.collection(COL).doc().id : "L"+Date.now()+Math.floor(Math.random()*100000); }
function syncSet(id,rec){ if(!online) return; const {id:_x,...payload}=rec; db.collection(COL).doc(id).set(payload).catch(e=>{ logErr("저장 동기화", e); toast("클라우드 동기화 지연 — 이 기기에는 저장됨"); }); }
function addRecord(data){ const id=genId(); const rec={...data,id}; entries.push(rec); if(online) syncSet(id,rec); lsSave(); return rec; }
function updateRecord(id,patch){ const i=entries.findIndex(x=>x.id===id); if(i<0) return; entries[i]={...entries[i],...patch}; if(online) syncSet(id,entries[i]); lsSave(); }
function deleteRecord(id){ entries=entries.filter(x=>x.id!==id); if(online) db.collection(COL).doc(id).delete().catch(e=>logErr("삭제 동기화", e)); lsSave(); }
const TEMP_BK="wl_tempbackup";
/* tempbackup — 24시간 만료 적용 */
function saveTempBackup(){
  try{
    // 용량 4.5MB 초과 시 tempbackup 저장 생략
    if(lsTotalSize() > 4.5*1024*1024){ console.warn("[worklog] 용량 부족으로 tempbackup 생략"); return; }
    localStorage.setItem(TEMP_BK, JSON.stringify({at:Date.now(),entries}));
  }catch(e){}
}
/* 앱 시작 시 24시간 지난 tempbackup 자동 삭제 */
(function cleanExpiredTempBackup(){
  try{
    const raw=localStorage.getItem(TEMP_BK);
    if(!raw) return;
    const obj=JSON.parse(raw);
    if(Date.now()-obj.at > 24*60*60*1000){
      localStorage.removeItem(TEMP_BK);
      console.log("[worklog] 만료된 tempbackup 삭제");
    }
  }catch(e){ try{ localStorage.removeItem(TEMP_BK); }catch(e2){} }
})();
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
  // v42: 전체선택 + 선택삭제
  document.addEventListener("change", e=>{
    if(!e.target.classList.contains("wk-allchk")) return;
    const checked = e.target.checked;
    const list = workList();
    if(checked) list.forEach(en=>wkChecked.add(en.id));
    else wkChecked.clear();
    renderWork();
  });
  const _btnWkDel = $("btnWkDelSelected");
  if(_btnWkDel) _btnWkDel.addEventListener("click",()=>{
    const cnt = wkChecked.size;
    if(!cnt) return;
    if(!confirm(`선택한 업무 ${cnt}건을 삭제하시겠습니까?`)) return;
    const ids = [...wkChecked];
    wkChecked.clear();
    ids.forEach(id=>{
      const linked=entries.filter(e=>e.kind==="expense"&&e.workId===id);
      linked.forEach(e=>deleteRecord(e.id));
      deleteRecord(id);
    });
    renderAll();
    toast(`${cnt}건 삭제됨`);
  });
  wireDiag();
  aiInitKeyUI();
  wireAttachUI();
  loadCategories();
  loadFields();
  loadViewPrefs();
  wireFileLinkTab();
  wireSiteTab();
  wirePasswordTab();
  wireMaterialTab();
  wireCleaningTab();
  wireCleaningModal();
  wireExpenseTab();
  wireExpenseModal();
  wireWorkSubtabs();
  wireGlobalSearch();
  wireQuickMemo();
  const backBtn = $("btnBack");
  if(backBtn) backBtn.addEventListener("click", goBack);
  loadCleanSettings();
  wireCatMgr();
  wireFieldMgr();
  try{
    if(typeof firebase==="undefined") throw new Error("sdk");
    firebase.initializeApp(firebaseConfig); db=firebase.firestore();
    try{ await db.enablePersistence({synchronizeTabs:true}); }catch(_){}
    await Promise.race([ db.collection(COL).limit(1).get(), new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),6000)) ]);
    online=true; setStatus(true);
  }catch(e){ online=false; setStatus(false); logErr("초기 연결", e); }
  await loadAll();
  migrateTissueToJumbo(); // v26: 휴지 → 점보롤 자동 변환
  migrateBadMemoAttachments(); // v38: 깨진 첨부 정리
  renderStatusChips(); renderAll();
  // v43: 통합 UI 갱신 훅
  try{ if(typeof window.v43Refresh==='function') window.v43Refresh(); }catch(e){}
  // v43 모드: 탭 복원은 v43ActivateTab이 처리 (worklog.js activateTab 복원 비활성)
  // v43: init 완료 신호
  try{ window._wlInitDone = true; }catch(e){}
  // v41: contacts 연동 초기화
  loadContactCats().catch(()=>{});
  loadContactsCache().catch(()=>{});
  loadContactCats().catch(()=>{});
  // 드래그 앤 드롭 순서 로드
  loadFlOrder().catch(()=>{});
  // 공통 분야 로드 (업무·통화·contacts 통합)
  loadSharedCats().then(()=>{ renderWork(); }).catch(()=>{});
  // 서희타워 카테고리 분리 마이그레이션
  migrateTowerCats();
}

// v26: 옛 "휴지" 품목 → "점보롤"로 자동 마이그레이션
function migrateTissueToJumbo(){
  let changed = 0;
  entries.forEach(e=>{
    if(e.kind==="item" && (e.itemName||"").trim()==="휴지"){
      e.itemName = "점보롤";
      if(!e.unit || e.unit==="EA") e.unit = "롤";
      if(!e.memo) e.memo = "휴지에서 자동 변경됨";
      else e.memo = e.memo + " · 휴지에서 자동 변경됨";
      // Firestore에도 반영
      if(online && db){
        db.collection(COL).doc(e.id).set(e).catch(err=>console.warn("migrate save fail",err));
      }
      changed++;
    }
  });
  if(changed>0){
    lsSave();
    console.log(`✅ 마이그레이션: 휴지 ${changed}건 → 점보롤로 변경됨`);
    setTimeout(()=>toast(`✅ 휴지 ${changed}건이 자동으로 점보롤로 변경되었어요`, 3500), 800);
  }
}
// v38: 메모의 잘못된 attachments({type:"image",data:...}) 정리 → photos로 이동
function migrateBadMemoAttachments(){
  let changed = 0;
  entries.forEach(e=>{
    if(e.kind==="memo" && Array.isArray(e.attachments) && e.attachments.length){
      const badItems = e.attachments.filter(a => a && a.data && !a.path);
      if(badItems.length){
        // 이미지 데이터를 photos로 옮기기
        if(!Array.isArray(e.photos)) e.photos = [];
        badItems.forEach(a => {
          if(typeof a.data === "string") e.photos.push(a.data);
        });
        // attachments에서 제거
        e.attachments = e.attachments.filter(a => a && a.path);
        // body 필드 호환 (content → body)
        if(e.content && !e.body) e.body = e.content;
        if(online && db){
          db.collection(COL).doc(e.id).set(e).catch(()=>{});
        }
        changed++;
      }
    }
  });
  if(changed>0){
    lsSave();
    console.log(`✅ v38 마이그레이션: 메모 ${changed}건의 깨진 첨부 정리됨`);
  }
}

function setStatus(on){ const el=$("status"); el.classList.toggle("on",on); el.classList.toggle("off",!on); $("statusText").textContent=on?"클라우드 연결됨":"오프라인 (이 기기에 저장)"; }

// v43: 지출금액 직접 입력 (단가/택배비 제거)
function calcWorkTotal(obj){
  // 지출금액(cost)은 직접 입력 — 자동계산 없음
}


/* ── v44: syncWorkExpense 비활성화 ────────────────────────
   사용자가 업무 모달에서 지출유형 선택 시,
   저장 후 지출 모달이 자동으로 열리고 사용자가 직접 작성하는 구조로 변경됨.
   자동 생성/삭제는 더 이상 하지 않음.
   기존에 만들어진 연동 expense는 유지됨. */
function syncWorkExpense(workObj, workId, savedId){
  // 의도적으로 비워둠 - 사용자가 직접 통제
  return;
}

function renderAll(){
  // v38: 한 함수 에러가 나머지를 막지 않도록 각각 try-catch
  const fns = [
    ["work", renderWork], ["plan", renderPlan], ["memo", renderMemo],
    ["call", renderCall], ["vac", renderVac], ["meeting", renderMeeting],
    ["deliver", renderDeliver], ["calendar", renderCalendar],
    ["filelink", renderFileLink], ["site", renderSite], ["password", renderPassword],
    ["material", renderMaterial], ["cleaning", renderCleaning],
    ["expense", renderExpense], ["accident", renderAccidents], ["diag", renderDiag]
  ];
  fns.forEach(([name, fn])=>{
    try{ fn(); }catch(err){ console.error(`render${name} 에러:`, err); }
  });
}

/* ===== 탭 ===== */
// v35: 뒤로 가기 히스토리 (5단계까지)
const TAB_HISTORY = []; // [{tab, subtab}]
const TAB_HISTORY_MAX = 5;
let SKIP_HISTORY = false;

function pushTabHistory(tab, subtab){
  if(SKIP_HISTORY) return;
  const last = TAB_HISTORY[TAB_HISTORY.length-1];
  // 같은 상태 중복 방지
  if(last && last.tab===tab && last.subtab===subtab) return;
  TAB_HISTORY.push({tab, subtab});
  while(TAB_HISTORY.length > TAB_HISTORY_MAX+1) TAB_HISTORY.shift();
  updateBackButton();
}

function updateBackButton(){
  const btn = $("btnBack"); if(!btn) return;
  btn.disabled = TAB_HISTORY.length < 2;
}

function goBack(){
  if(TAB_HISTORY.length < 2) return;
  TAB_HISTORY.pop(); // 현재 제거
  const prev = TAB_HISTORY.pop(); // 직전 가져옴 (다시 push될 거임)
  if(!prev) return;
  SKIP_HISTORY = true;
  activateTab(prev.tab);
  if(prev.subtab && prev.tab==="work"){
    setTimeout(()=>{ activateWorkSubtab(prev.subtab); SKIP_HISTORY=false; pushTabHistory(prev.tab, prev.subtab); updateBackButton(); }, 60);
  } else {
    SKIP_HISTORY = false;
    pushTabHistory(prev.tab, null);
    updateBackButton();
  }
}

function activateTab(name){
  // 서브탭으로 이동된 항목이면 업무 탭 + 해당 서브탭으로
  const subtabs = ["filelink","call","site","vacation","meeting","deliver","expense"];
  if(subtabs.includes(name)){
    activateTab("work");
    setTimeout(()=>activateWorkSubtab(name), 50);
    return;
  }
  const btn=document.querySelector(`.tabs button[data-tab="${name}"]`); if(!btn) return;
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".panel:not(.v43-panel)").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active"); $("panel-"+name).classList.add("active");
  // 업무 탭이면 마지막 서브탭 복원
  if(name==="work"){
    let last="general";
    try{ last = localStorage.getItem("wl_work_subtab")||"general"; }catch(e){}
    activateWorkSubtab(last);
    pushTabHistory(name, last);
  } else {
    pushTabHistory(name, null);
  }
  try{ btn.scrollIntoView({inline:"center",block:"nearest",behavior:"smooth"}); }catch(e){}
  try{ localStorage.setItem("wl_tab", name); }catch(e){}
  try{ onTabChange(name); }catch(e){}
}

// v29: 업무 탭 내 서브탭 활성화
function activateWorkSubtab(sub){
  document.querySelectorAll("#workSubtabs button").forEach(b=>b.classList.toggle("active", b.dataset.subtab===sub));
  // 일반업무 영역 (work-subpanel)
  const generalPanel = document.querySelector('.work-subpanel[data-subpanel="general"]');
  if(generalPanel) generalPanel.style.display = sub==="general" ? "" : "none";
  // 호스트 영역
  const host = $("workSubpanelHost");
  if(!host) return;
  // 모든 통합 패널 강제 숨김 + 호스트 안으로 이동
  ["filelink","call","site","vacation","meeting","deliver","expense"].forEach(name=>{
    const p = document.getElementById("panel-"+name);
    if(p){
      if(p.parentElement !== host) host.appendChild(p);
      p.style.display = "none";
      p.classList.remove("active");
    }
  });
  if(sub !== "general"){
    const panel = document.getElementById("panel-"+sub);
    if(panel){
      panel.style.display = "block";
      panel.classList.add("active");
    }
  }
  // 페이지 맨 위로 스크롤
  window.scrollTo({top:0, behavior:"smooth"});
  try{ localStorage.setItem("wl_work_subtab", sub); }catch(e){}
  // 히스토리 push (work 탭이 활성일 때만)
  if(document.getElementById("panel-work").classList.contains("active")){
    pushTabHistory("work", sub);
  }
}

// 업무 탭 서브탭 클릭 wiring
function wireWorkSubtabs(){
  document.querySelectorAll("#workSubtabs button").forEach(b=>b.addEventListener("click",()=>{
    // 외부 링크 탭(직원관리, 업체연락처)은 새 탭으로 열기
    if(b.dataset.extlink){
      window.open(b.dataset.extlink, "_blank");
      return;
    }
    activateWorkSubtab(b.dataset.subtab);
  }));
  // 페이지 로드 직후 통합 대상 패널들을 모두 host 안으로 즉시 이동 + 숨김
  const host = $("workSubpanelHost");
  if(host){
    ["filelink","call","site","vacation","meeting","deliver","expense"].forEach(name=>{
      const p = document.getElementById("panel-"+name);
      if(p && p.parentElement !== host){
        host.appendChild(p);
        p.style.display = "none";
        p.classList.remove("active");
      }
    });
  }
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
  if(kind==="work") return {date:t,status:"완료",field:""};
  if(kind==="call") return {date:t,time:nowTime(),dir:"수신"};
  if(kind==="vacation") return {start:t,end:t,vtype:"년차휴가"};
  if(kind==="filelink") return {category:(CATEGORIES.filelink[0]||""), ptype:"파일"};
  if(kind==="site") return {category:(CATEGORIES.site[0]||"")};
  if(kind==="deliver") return {date:t, dtype:"즉시전달"};
  if(kind==="schedule") return {date:t, sStatus:"예정", sType:"정기점검", scheduleType:"일회성"};
  if(kind==="item") return {field:"", recurring:"비주기", safetyStock:0, unitPrice:0};
  if(kind==="stock") return {date:t, stockType:"입고", qty:1, unitPrice:0, amount:0};
  if(kind==="expense") return {date:t, expType:"개인지출", amount:0};
  if(kind==="accident") return {date:t, time:nowTime(), accType:"누수", status:"⏳ 접수", partyType:"임차인", reported:"없음"};
  return {date:t};
}
function fieldHTML(f){
  let inner;
  if(f.type==="callfield"){
    const _cats = (typeof CONTACT_CATS!=="undefined") ? CONTACT_CATS : ["전기","설비","기타"];
    const opts = '<option value="">(선택 안 함)</option>' + _cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
    return `<div class="field ${f.full?"full":""}"><label>${esc(f.label||"분야")}</label>
      <div style="display:flex;gap:6px;align-items:stretch">
        <select id="m-${f.k}" style="flex:1">${opts}</select>
        <button type="button" class="btn btn-ghost btn-sm" onclick="openContactCatMgrFromModal()" style="flex:0 0 auto;padding:0 10px" title="분야 추가/삭제">⚙</button>
      </div></div>`;
  }
  if(f.type==="callcontact"){
    return `<div class="field full" style="position:relative"><label>${esc(f.label)}</label>
      <input type="text" id="m-${f.k}" placeholder="이름·업체·전화번호 검색..." autocomplete="off"
        style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
      <div id="m-${f.k}-list" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid #dbe6f4;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.12);z-index:500;max-height:220px;overflow:auto"></div>
    </div>`;
  }
  if(f.type==="alertbefore"){
    return `<div class="field full"><label>${esc(f.label)}</label>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="m-alertDays" onchange="syncAlertBefore()" style="height:44px;padding:0 10px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;flex:1">
          <option value="0">0일</option><option value="1">1일</option><option value="2">2일</option><option value="3">3일</option><option value="4">4일</option><option value="5">5일</option><option value="6">6일</option><option value="7">7일</option>
        </select>
        <select id="m-alertHours" onchange="syncAlertBefore()" style="height:44px;padding:0 10px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;flex:1">
          <option value="0">0시간</option><option value="1">1시간</option><option value="2">2시간</option><option value="3">3시간</option><option value="4">4시간</option><option value="5">5시간</option><option value="6">6시간</option><option value="7">7시간</option><option value="8">8시간</option><option value="9">9시간</option><option value="10">10시간</option><option value="11">11시간</option><option value="12">12시간</option><option value="13">13시간</option><option value="14">14시간</option><option value="15">15시간</option><option value="16">16시간</option><option value="17">17시간</option><option value="18">18시간</option><option value="19">19시간</option><option value="20">20시간</option><option value="21">21시간</option><option value="22">22시간</option><option value="23">23시간</option>
        </select>
        <select id="m-alertMins" onchange="syncAlertBefore()" style="height:44px;padding:0 10px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;flex:1">
          <option value="0">0분</option><option value="5">5분</option><option value="10">10분</option><option value="15">15분</option><option value="20">20분</option><option value="30">30분</option><option value="45">45분</option>
        </select>
        <span style="font-size:13px;color:#3f7cb8;font-weight:700;white-space:nowrap">전에 알림</span>
        <input type="hidden" id="m-${f.k}">
      </div></div>`;
  }
if(f.type==="timepick"){
    const fid=`m-${f.k}`;
    return `<div class="field${f.full?' full':''}"><label>${esc(f.label)}</label>
      <div style="display:flex;gap:6px;align-items:center">
        <select id="${fid}-ampm" onchange="syncTimepick('${fid}')" style="height:44px;padding:0 8px;border:2px solid #dbe6f4;border-radius:12px;font-size:13px;font-family:inherit;background:#f7faff;outline:none;flex:0 0 68px">
          <option value="AM">오전</option>
          <option value="PM">오후</option>
        </select>
        <select id="${fid}-h" onchange="syncTimepick('${fid}')" style="height:44px;padding:0 8px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;flex:1;text-align:center">
          <option value="">시</option>
          <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option>
        </select>
        <span style="font-size:18px;font-weight:700;color:#3f7cb8">:</span>
        <select id="${fid}-m" onchange="syncTimepick('${fid}')" style="height:44px;padding:0 8px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;flex:1;text-align:center">
          <option value="">분</option>
          <option value="00">00</option><option value="05">05</option><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="25">25</option><option value="30">30</option><option value="35">35</option><option value="40">40</option><option value="45">45</option><option value="50">50</option><option value="55">55</option>
        </select>
        <input type="hidden" id="${fid}">
      </div></div>`;
  }

  if(f.type==="workvendor"){
    return `<div class="field" style="position:relative"><label>${esc(f.label)} <a href="contacts.html" target="_blank" style="margin-left:4px;font-size:11px;padding:2px 7px;border:1px solid #dbe6f4;border-radius:6px;background:#f7faff;color:#3f7cb8;font-weight:700;text-decoration:none">📋 연락처관리</a></label>
      <input type="text" id="m-${f.k}" placeholder="업체명 검색..." autocomplete="off"
        style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
      <div id="m-${f.k}-list" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid #dbe6f4;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.12);z-index:500;max-height:220px;overflow:auto"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px;font-weight:700;color:#94a3b8;margin:0">
          <input type="checkbox" id="m-isOnetime" style="width:15px;height:15px;accent-color:#f59e0b;cursor:pointer">
          🕐 일회성 업체
        </label>
        <div id="m-vendorContractBadge" style="display:none;align-items:center;gap:6px;flex-wrap:wrap"></div>
      </div>
    </div>`;
  }
  if(f.type==="textarea") inner=`<textarea id="m-${f.k}"></textarea>`;
  else if(f.type==="select") inner=`<select id="m-${f.k}">${f.opts.map(o=>`<option>${o}</option>`).join("")}</select>`;
  else if(f.type==="status") inner=`<select id="m-${f.k}">${STATUSES.map(o=>`<option>${o}</option>`).join("")}</select>`;
  else if(f.type==="field") inner=`<div style="display:flex;gap:6px;align-items:stretch;position:relative">
      <input type="text" id="m-${f.k}" placeholder="분야 검색 (초성 가능, 예: ㅈㄱ → 전기)" autocomplete="off" style="flex:1;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
      <button type="button" class="btn btn-ghost btn-sm" data-fieldmgr style="flex:0 0 auto;padding:0 10px" title="분야 관리">⚙</button>
      <div id="m-${f.k}-list" style="display:none;position:absolute;top:48px;left:0;right:46px;background:#fff;border:1.5px solid #dbe6f4;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.12);z-index:500;max-height:240px;overflow:auto"></div>
    </div>
    <input type="hidden" id="m-${f.k}-new">`;
  else if(f.type==="floor") inner=`<select id="m-${f.k}">${FLOORS.map(o=>`<option value="${o}">${o===""?"(층 선택 안 함)":o}</option>`).join("")}</select>`;
  else if(f.type==="catselect"){
    inner=`<select id="m-${f.k}" class="cat-sel" data-ctx="${f.ctx}"></select>
    <input type="text" id="m-${f.k}-new" class="cat-new" autocomplete="off" placeholder="새 카테고리 입력" style="display:none;margin-top:6px">`;
  }
  else if(f.type==="itemselect"){
    inner=`<select id="m-${f.k}" class="item-sel"></select>
    <div id="m-${f.k}-info" style="margin-top:5px;font-size:12px;color:var(--ink-soft);background:var(--primary-soft);border-radius:7px;padding:6px 9px;display:none"></div>`;
  }
  else if(f.type==="subcat"){
    inner=`<select id="m-${f.k}-sel" class="subcat-sel" data-subctx="${f.ctx}"></select>
    <input type="text" id="m-${f.k}" class="subcat-new" autocomplete="off" placeholder="새 소분류 입력 (예: 엘리베이터)" style="display:none;margin-top:6px">`;
  }
  else { const t=f.type==="number"?"number":f.type==="date"?"date":f.type==="time"?"time":"text"; const im=f.type==="tel"?' inputmode="tel"':'';
    if(f.k==="loc"){
      const vals=[...new Set(entries.filter(e=>e.kind==="work"&&e.loc).map(e=>e.loc))].sort();
      inner=`<input type="text" id="m-${f.k}" list="dl-loc" autocomplete="off"><datalist id="dl-loc">${vals.map(v=>`<option value="${esc(v)}"></option>`).join("")}</datalist>`;
    } else if(f.k==="title" && f.full){
      const titles=[...new Set(entries.filter(e=>e.kind==="work"&&e.title).map(e=>e.title))].sort();
      inner=`<input type="text" id="m-${f.k}" list="dl-title" autocomplete="off"><datalist id="dl-title">${titles.map(v=>`<option value="${esc(v)}"></option>`).join("")}</datalist>`;
    } else if(f.k==="material"){
      // v44: 자재명 - 자재 탭의 품목과 연동된 검색 가능한 입력창
      inner=`<div style="position:relative">
        <input type="text" id="m-${f.k}" placeholder="클릭하면 자재 목록, 검색 가능, 없으면 새로 추가" autocomplete="off" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        <div id="m-${f.k}-list" style="display:none;position:absolute;top:48px;left:0;right:0;background:#fff;border:1.5px solid #dbe6f4;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.12);z-index:500;max-height:260px;overflow:auto"></div>
      </div>`;
    } else if(f.k==="name" && mKind==="call"){
      inner=`<input type="text" id="m-${f.k}" autocomplete="off" placeholder="이름 입력 시 연락처 자동완성">`;
    } else if(f.k==="date" && (mKind==="work"||mKind==="call")){
      // 날짜 + 어제 토글 버튼
      inner=`<div style="display:flex;gap:6px;align-items:center">
        <input type="date" id="m-${f.k}" style="flex:1;height:44px;padding:0 12px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        <button type="button" id="btn-yesterday" style="height:44px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:12px;font-size:12px;font-weight:700;color:#7a92a8;background:#f7faff;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0"
          onclick="(function(){const el=document.getElementById('m-date');if(!el)return;const yd=yesterdayStr();if(el.value===yd){el.value=(window._todayBeforeYd||todayStr());this.textContent='어제';this.style.background='#f7faff';this.style.color='#7a92a8';}else{window._todayBeforeYd=el.value||todayStr();el.value=yd;this.textContent='✓ 어제';this.style.background='#fef3c7';this.style.color='#92400e';}}).call(this)">어제</button>
      </div>`;
    } else inner=`<input type="${t}" id="m-${f.k}"${im}>`;
  }
  const req=f.req?' <span class="req">*</span>':'';
  // 업무 모달의 cost 필드는 기본 숨김 (expType 변경 시 표시)
  const initHide = (f.k==="cost" && mKind==="work") ? 'display:none;' : '';
  return `<div class="field ${f.full?"full":""}" style="${initHide}"><label>${f.label}${req}</label>${inner}</div>`;
}
/* v44: 자재명 검색 가능한 UI (자재 탭의 item과 연동, 초성검색 지원) */
/* v44: 새 자재 빠르게 추가하는 미니 모달 */
function openNewMaterialModal(prefilledName, onSaved){
  // 기존 오버레이 있으면 제거
  const oldOv = document.getElementById('newMatOverlay');
  if(oldOv) oldOv.remove();
  // 새 오버레이 생성
  const ov = document.createElement('div');
  ov.id = 'newMatOverlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:18px;width:100%;max-width:480px;padding:24px;box-shadow:0 12px 40px rgba(0,0,0,.2);max-height:90vh;overflow:auto">
      <h3 style="margin:0 0 16px;font-size:18px;font-weight:800;color:#0369a1">📦 새 자재 추가</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">서브원 상품ID <span style="color:#aab8c8;font-weight:500">(선택)</span></label>
          <input type="text" id="newMatShopId" placeholder="예: 6573068" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">품목명 <span style="color:#e74c3c">*</span></label>
          <input type="text" id="newMatName" value="${esc(prefilledName||'')}" placeholder="예: 형광등, 점보롤" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">규격 <span style="color:#aab8c8;font-weight:500">(간단히 - 정확한 규격만)</span></label>
          <input type="text" id="newMatSpec" placeholder="예: 36W / LED / 5500K" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">단위코드</label>
            <input type="text" id="newMatUnit" placeholder="EA, BOX, ROL" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
          </div>
          <div style="flex:1">
            <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">판매단가 (원)</label>
            <input type="number" id="newMatPrice" placeholder="0" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
          </div>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">제조원</label>
          <input type="text" id="newMatMaker" placeholder="예: (주)동원피앤아이" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">분야</label>
          <select id="newMatField" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
            ${FIELDS.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">거래처 <span style="color:#aab8c8;font-weight:500">(기본: 서브원)</span></label>
          <input type="text" id="newMatVendor" value="서브원" placeholder="예: 서브원" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button id="newMatCancel" type="button" style="flex:1;height:48px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;background:#f7faff;color:#7a92a8;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">취소</button>
          <button id="newMatSave" type="button" style="flex:2;height:48px;padding:0 14px;border:none;border-radius:12px;background:#0369a1;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">📦 자재 탭에 저장</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  // 품목명 입력칸에 포커스
  setTimeout(()=>{
    const nameEl = document.getElementById('newMatName');
    if(nameEl){ nameEl.focus(); nameEl.select(); }
  }, 100);
  // 닫기 처리
  const close = ()=>{ ov.remove(); };
  document.getElementById('newMatCancel').addEventListener('click', close);
  /* 배경 클릭 닫기 비활성화 */
  // 저장
  document.getElementById('newMatSave').addEventListener('click', ()=>{
    const name = (document.getElementById('newMatName').value||'').trim();
    if(!name){ toast('품목명을 입력하세요'); return; }
    const shopId = (document.getElementById('newMatShopId').value||'').trim();
    const spec = (document.getElementById('newMatSpec').value||'').trim();
    const unit = (document.getElementById('newMatUnit').value||'').trim();
    const price = Number(document.getElementById('newMatPrice').value)||0;
    const maker = (document.getElementById('newMatMaker').value||'').trim();
    const field = document.getElementById('newMatField').value||'';
    const vendor = (document.getElementById('newMatVendor').value||'').trim();
    // 자재 탭에 새 item 추가
    const newItem = {
      kind: "item",
      itemCode: (typeof nextItemCode==='function')?nextItemCode():"M"+Date.now(),
      shopId: shopId,
      itemName: name,
      spec: spec,
      unit: unit,
      field: field,
      maker: maker,
      vendor: vendor,
      unitPrice: price,
      safetyStock: 0,
      recurring: "비주기",
      location: "",
      memo: "업무 입력 시 새로 추가됨",
      createdAt: Date.now()
    };
    const saved = addRecord(newItem);
    close();
    toast(`✅ "${name}" 자재가 자재 탭에 저장됐어요`);
    if(onSaved) onSaved(saved||newItem);
    // 자재 탭 새로고침
    try{ if(typeof renderMaterial==='function') renderMaterial(); }catch(e){}
  });
  // Enter 키로 저장
  ['newMatShopId','newMatName','newMatSpec','newMatUnit','newMatPrice','newMatMaker','newMatVendor'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('keydown', e=>{
      if(e.key==='Enter'){ e.preventDefault(); document.getElementById('newMatSave').click(); }
    });
  });
}

function makeMaterialSearchUI(inputId, listId, onSelect){
  const inp = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if(!inp || !list) return;
  if(inp._matACwired) return;
  inp._matACwired = true;

  // ✕ 클리어 버튼
  const wrap = inp.parentElement;
  if(wrap && !wrap.querySelector('.msl-clear')){
    wrap.style.position = 'relative';
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'msl-clear';
    clearBtn.textContent = '✕';
    clearBtn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:16px;color:#aab8c8;cursor:pointer;padding:4px;display:none;line-height:1;z-index:10';
    clearBtn.addEventListener('mousedown', e=>{
      e.preventDefault();
      inp.value = '';
      clearBtn.style.display = 'none';
      list.style.display = 'none';
      inp.focus();
      render('');
    });
    wrap.appendChild(clearBtn);
    inp.addEventListener('input', ()=>{
      clearBtn.style.display = inp.value ? 'block' : 'none';
    });
  }

  function render(q){
    q = (q||"").trim();
    // v44: 자재 탭의 item만 표시 (기록 항목은 제외)
    const items = entries.filter(e=>e.kind==="item"&&e.itemName);
    const all = items.map(it=>({type:"item",id:it.id,name:it.itemName||"",spec:it.spec||"",unit:it.unit||"",field:it.field||"",vendor:it.vendor||""}));
    let filtered;
    if(!q){
      filtered = all.slice(0,50);
    } else if(isChosungOnly(q)){
      filtered = all.filter(it => getChosung(it.name).includes(q));
    } else {
      const ql = q.toLowerCase();
      filtered = all.filter(it => {
        const text = (it.name+" "+it.spec).toLowerCase();
        if(text.includes(ql)) return true;
        if(getChosung(it.name).includes(q)) return true;
        return false;
      });
    }
    if(!filtered.length){
      // v44: 없을 때 → 새 자재 추가 모달 열기 버튼
      const newName = q || "";
      list.innerHTML = `
        <div style="padding:14px;text-align:center;background:#f7faff;border-radius:8px">
          <div style="font-size:13px;color:#7a92a8;margin-bottom:10px">
            ${newName ? `"<b style="color:#1a2f45">${esc(newName)}</b>" 자재가 없어요` : '자재가 없어요'}
          </div>
          <button type="button" class="msl-add-new" style="background:#3f7cb8;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">
            ➕ 새 자재로 추가하기
          </button>
        </div>`;
      list.style.display = "block";
      const addBtn = list.querySelector(".msl-add-new");
      if(addBtn){
        addBtn.addEventListener("mousedown", e=>{
          e.preventDefault();
          list.style.display = "none";
          // 자재 추가 모달 열기 (이름은 미리 채움)
          openNewMaterialModal(newName, (newItem)=>{
            // 저장 후 input에 자동 채움
            inp.value = newItem.itemName || newName;
            const cb = wrap && wrap.querySelector('.msl-clear');
            if(cb) cb.style.display = 'block';
            if(onSelect) onSelect({type:"item",name:newItem.itemName,spec:newItem.spec,unit:newItem.unit,field:newItem.field});
          });
        });
      }
      return;
    }
    list.innerHTML = filtered.map((it,i)=>{
      const badge = `<span style="background:#0369a1;color:#fff;font-size:10px;padding:1px 6px;border-radius:5px;font-weight:700;margin-right:6px">📦 자재</span>`;
      const sub = [it.spec, it.unit && `[${it.unit}]`].filter(Boolean).join(" · ");
      return `
        <div class="msl-item" data-idx="${i}" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f6ff;transition:background .1s">
          <div style="font-size:14px;font-weight:700;color:#1a2f45">${badge}${esc(it.name)}</div>
          ${sub?`<div style="font-size:12px;color:#aab8c8;margin-top:2px;margin-left:48px">${esc(sub)}</div>`:""}
        </div>`;
    }).join("");
    list.style.display = "block";
    list.querySelectorAll(".msl-item").forEach((el,i)=>{
      el.addEventListener("mouseenter",()=>el.style.background="#f0f6ff");
      el.addEventListener("mouseleave",()=>el.style.background="");
      el.addEventListener("mousedown",e=>{
        e.preventDefault();
        const picked = filtered[i];
        inp.value = picked.name;
        list.style.display = "none";
        const cb = wrap && wrap.querySelector('.msl-clear');
        if(cb) cb.style.display = 'block';
        if(onSelect) onSelect(picked);
      });
    });
  }

  let activeIdx = -1;
  function updateActive(items){
    items.forEach((el,i)=>{ el.style.background = i===activeIdx ? "#e8f0fb" : ""; });
  }

  inp.addEventListener("input", ()=>{ activeIdx=-1; render(inp.value); });
  inp.addEventListener("focus", ()=>{ activeIdx=-1; render(inp.value); });
  inp.addEventListener("click", ()=>{ activeIdx=-1; render(inp.value); });
  inp.addEventListener("blur", ()=>setTimeout(()=>{ list.style.display="none"; activeIdx=-1; }, 200));
  inp.addEventListener("keydown", e=>{
    const items = [...list.querySelectorAll(".msl-item")];
    if(e.key==="ArrowDown"){
      e.preventDefault();
      if(!items.length) return;
      activeIdx = Math.min(activeIdx+1, items.length-1);
      updateActive(items);
      if(items[activeIdx]) items[activeIdx].scrollIntoView({block:"nearest"});
    } else if(e.key==="ArrowUp"){
      e.preventDefault();
      if(!items.length) return;
      activeIdx = Math.max(activeIdx-1, 0);
      updateActive(items);
      if(items[activeIdx]) items[activeIdx].scrollIntoView({block:"nearest"});
    } else if(e.key==="Enter"){
      e.preventDefault();
      e.stopPropagation();
      if(activeIdx >= 0 && items[activeIdx]){
        items[activeIdx].dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));
      } else if(items.length > 0){
        items[0].dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));
      } else {
        // 검색 결과 없으면 → 그냥 텍스트로 사용
        const v = inp.value.trim();
        if(v){
          list.style.display = "none";
          if(onSelect) onSelect({type:"new",name:v,spec:"",unit:""});
        }
      }
    } else if(e.key==="Escape"){
      list.style.display = "none";
      activeIdx = -1;
    } else if(e.key==="Tab"){
      if(items.length > 0){
        e.preventDefault();
        items[0].dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));
      }
    }
  });

  setTimeout(()=>{
    const cb = wrap && wrap.querySelector('.msl-clear');
    if(cb) cb.style.display = inp.value ? 'block' : 'none';
  }, 50);
}
/* ── 업무 모달 탭 렌더러 ── */
/* ── 자재 선택 팝업 ── */
function openMatPickerPopup(){
  const old = document.getElementById('matPickerOv'); if(old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'matPickerOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:12000;display:flex;align-items:center;justify-content:center;padding:16px';

  const curMat = ($('m-material')||{}).value||'';
  const curQty = ($('m-qty')||{}).value||'1';  /* 기본값 1 */

  ov.innerHTML = `
    <div style="background:#fff;border-radius:16px;width:100%;max-width:440px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(0,0,0,.22)">
      <div style="padding:16px 18px 12px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">📦</span>
        <span style="font-size:16px;font-weight:800;color:#1a2f45;flex:1">자재 선택</span>
        <button id="matPopClose" type="button" style="border:none;background:none;font-size:20px;color:#94a3b8;cursor:pointer;padding:4px">✕</button>
      </div>
      <div style="padding:14px 18px 0;position:relative">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:5px">자재명 검색</div>
        <input type="text" id="matPopSearch" value="${esc(curMat)}" placeholder="자재명 또는 초성 검색…" autocomplete="off"
          style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:1.5px solid #3b82f6;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;color:#1a2f45">
        <div id="matPopList" style="position:absolute;left:18px;right:18px;top:84px;background:#fff;border:1.5px solid #dbe6f4;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);z-index:100;max-height:220px;overflow:auto;display:none"></div>
      </div>
      <div style="padding:10px 18px 14px;display:flex;align-items:flex-end;gap:10px">
        <div style="flex:1">
          <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:5px">선택된 자재</div>
          <div id="matPopSelected" style="min-height:38px;padding:8px 12px;background:#f8fafc;border-radius:8px;font-size:13px;font-weight:600;color:#1a2f45;border:1.5px solid #e2e8f0;line-height:1.4">${curMat||'<span style="color:#94a3b8;font-weight:400">없음</span>'}</div>
        </div>
        <div style="width:88px">
          <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:5px">수량</div>
          <input type="number" id="matPopQty" value="${esc(curQty)}" min="0" placeholder="0"
            style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;background:#fff;outline:none;text-align:right">
        </div>
      </div>
      <div style="padding:4px 18px 16px;display:flex;gap:8px;border-top:1px solid #f1f5f9">
        <button id="matPopClear" type="button" style="padding:0 14px;height:44px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;color:#94a3b8;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">지우기</button>
        <button id="matPopOk" type="button" style="flex:1;height:44px;border:none;border-radius:10px;background:#2563a8;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">✓ 확인</button>
      </div>
    </div>`;

  document.body.appendChild(ov);

  let _pickedId = ($('m-mat-item-id')||{}).value||'';
  let _pickedName = curMat;

  const searchEl = document.getElementById('matPopSearch');
  const listEl   = document.getElementById('matPopList');
  const selEl    = document.getElementById('matPopSelected');

  function renderList(q){
    q = (q||'').trim();
    const items = entries.filter(e=>e.kind==='item'&&e.itemName);
    let filtered = items.map(it=>({
      id:it.id,
      name:(it.itemName||'').replace(/^\[.*?\]/,'').trim(),
      rawName:it.itemName||'',
      spec:it.spec||'',
      unit:it.unit||''
    }));
    if(q){
      if(typeof isChosungOnly==='function'&&isChosungOnly(q)){
        filtered=filtered.filter(it=>typeof getChosung==='function'&&getChosung(it.name).includes(q));
      } else {
        const ql=q.toLowerCase();
        filtered=filtered.filter(it=>(it.name+' '+it.spec).toLowerCase().includes(ql)||
          (typeof getChosung==='function'&&getChosung(it.name).includes(q)));
      }
    }
    filtered=filtered.slice(0,60);
    if(!filtered.length){
      listEl.innerHTML=`<div style="padding:12px 14px;text-align:center;color:#94a3b8;font-size:13px">결과 없음 — 그대로 직접 입력하세요</div>`;
    } else {
      listEl.innerHTML=filtered.map((it,i)=>`
        <div class="mpp-item" data-idx="${i}"
          style="padding:9px 14px;cursor:pointer;border-bottom:1px solid #f8fafc;display:flex;align-items:center;gap:8px">
          <span style="background:#0369a1;color:#fff;font-size:10px;padding:1px 6px;border-radius:5px;font-weight:700;flex-shrink:0">자재</span>
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:700;color:#1a2f45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.name)}</div>
            ${it.spec?`<div style="font-size:11px;color:#94a3b8">${esc(it.spec.slice(0,40))}${it.unit?' ['+esc(it.unit)+']':''}</div>`:''}
          </div>
        </div>`).join('');
      listEl.querySelectorAll('.mpp-item').forEach((el,i)=>{
        el.addEventListener('mouseenter',()=>el.style.background='#f0f6ff');
        el.addEventListener('mouseleave',()=>el.style.background='');
        el.addEventListener('mousedown',e=>{
          e.preventDefault();
          const it=filtered[i];
          _pickedId=it.id; _pickedName=it.name;
          searchEl.value=it.name;
          selEl.innerHTML=`<b>${esc(it.name)}</b>${it.spec?`<br><span style="font-size:11px;color:#94a3b8">${esc(it.spec)}</span>`:''}`;
          listEl.style.display='none';
          document.getElementById('matPopQty').focus();
          document.getElementById('matPopQty').select();
        });
      });
    }
    listEl.style.display='block';
  }

  renderList('');
  setTimeout(()=>{ searchEl.focus(); searchEl.select(); },80);

  searchEl.addEventListener('input',()=>{ _pickedId=''; _pickedName=searchEl.value; renderList(searchEl.value); });
  searchEl.addEventListener('focus',()=>renderList(searchEl.value));
  searchEl.addEventListener('blur',()=>setTimeout(()=>{ listEl.style.display='none'; },200));

  function doConfirm(){
    const name=(_pickedName||searchEl.value).trim();
    const qty=Number(document.getElementById('matPopQty').value)||0;
    const mInp=$('m-material'); if(mInp) mInp.value=name;
    const qInp=$('m-qty');      if(qInp) qInp.value=qty||'';
    const idInp=$('m-mat-item-id'); if(idInp) idInp.value=_pickedId||'';
    const lbl=document.getElementById('wMatLabel');
    if(lbl) lbl.innerHTML = name&&qty
      ? `📦 자재: <b>${esc(name)}</b> × ${qty}`
      : `📦 자재 사용 내역`;
    ov.remove();
  }

  document.getElementById('matPopOk').addEventListener('click', doConfirm);
  document.getElementById('matPopClear').addEventListener('click',()=>{
    const mInp=$('m-material'); if(mInp) mInp.value='';
    const qInp=$('m-qty');      if(qInp) qInp.value='';
    const idInp=$('m-mat-item-id'); if(idInp) idInp.value='';
    const lbl=document.getElementById('wMatLabel');
    if(lbl) lbl.innerHTML='📦 자재 사용 내역';
    ov.remove();
  });
  document.getElementById('matPopClose').addEventListener('click',()=>ov.remove());
  /* 배경 클릭 닫기 비활성화 */
  document.getElementById('matPopQty').addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();doConfirm();} });
}

let _workMode = "simple";

/* ── 담당업체 선택 팝업 ── */
function openVendorPickerPopup(){
  const old=document.getElementById('vendorPickerOv'); if(old) old.remove();
  const ov=document.createElement('div');
  ov.id='vendorPickerOv';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:12000;display:flex;align-items:center;justify-content:center;padding:16px';
  const cur={
    vendor:($('m-workVendor')||{}).value||'',
    contact:($('m-workContact')||{}).value||'',
    role:($('m-workRole')||{}).value||'',
    phone:($('m-workPhone')||{}).value||'',
    memo:($('m-workMemo')||{}).value||'',
    onetime:($('m-isOnetime')||{}).value||''
  };
  const SI='width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;color:#1a2f45';
  const LB='display:block;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:5px';
  ov.innerHTML=`
    <div style="background:#fff;border-radius:16px;width:100%;max-width:460px;max-height:90vh;overflow:auto;box-shadow:0 16px 48px rgba(0,0,0,.22)">
      <div style="padding:16px 18px 12px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;position:sticky;top:0;background:#fff">
        <span style="font-size:18px">🏢</span>
        <span style="font-size:16px;font-weight:800;color:#1a2f45;flex:1">담당업체 입력</span>
        <a href="contacts.html" target="_blank" style="font-size:11px;padding:3px 10px;border:1px solid #dbe6f4;border-radius:7px;background:#f7faff;color:#3f7cb8;font-weight:700;text-decoration:none;margin-right:6px">연락처 관리</a>
        <button id="vpClose" type="button" style="border:none;background:none;font-size:20px;color:#94a3b8;cursor:pointer;padding:4px">✕</button>
      </div>
      <div style="padding:14px 18px;display:flex;flex-direction:column;gap:12px">
        <div style="position:relative">
          <label style="${LB}">업체명 검색</label>
          <input type="text" id="vpSearch" value="${esc(cur.vendor)}" placeholder="업체명 또는 연락처 검색…" autocomplete="off"
            style="${SI};border-color:#3b82f6">
          <div id="vpList" style="position:absolute;top:68px;left:0;right:0;background:#fff;border:1.5px solid #dbe6f4;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);z-index:100;max-height:180px;overflow:auto;display:none"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label style="${LB}">담당자</label><input type="text" id="vpContact" value="${esc(cur.contact)}" style="${SI}"></div>
          <div><label style="${LB}">직책</label><input type="text" id="vpRole" value="${esc(cur.role)}" style="${SI}"></div>
          <div><label style="${LB}">전화번호</label><input type="tel" id="vpPhone" value="${esc(cur.phone)}" style="${SI}"></div>
          <div><label style="${LB}">업체 메모</label><input type="text" id="vpMemo" value="${esc(cur.memo)}" style="${SI}"></div>
        </div>
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:#64748b">
          <input type="checkbox" id="vpOnetime" ${cur.onetime?"checked":""} style="width:15px;height:15px;accent-color:#f59e0b">
          🕐 일회성 업체
        </label>
      </div>
      <div style="padding:4px 18px 18px;display:flex;gap:8px;border-top:1px solid #f1f5f9;margin-top:4px">
        <button id="vpClear" type="button" style="padding:0 14px;height:44px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;color:#94a3b8;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">지우기</button>
        <button id="vpOk" type="button" style="flex:1;height:44px;border:none;border-radius:10px;background:#2563a8;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">✓ 확인</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  if(typeof makeContactSearchUI==='function'){
    setTimeout(()=>{
      makeContactSearchUI('vpSearch','vpList',(c)=>{
        document.getElementById('vpSearch').value=c.company||c.name||'';
        document.getElementById('vpContact').value=c.person||'';
        document.getElementById('vpRole').value=c.title||'';
        document.getElementById('vpPhone').value=c.phone||'';
        document.getElementById('vpMemo').value=c.memo||'';
        document.getElementById('vpOnetime').checked=(c.vendorType==='일회성');
      },()=>{});
    },80);
  }
  setTimeout(()=>{ document.getElementById('vpSearch').focus(); },80);
  function doConfirm(){
    const v=document.getElementById('vpSearch').value.trim();
    const fv=(id)=>(document.getElementById(id)||{}).value||'';
    const fo=(id)=>(document.getElementById(id)||{}).checked||false;
    const set=(id,val)=>{ const el=$(id); if(el) el.value=val; };
    set('m-workVendor',v); set('m-workContact',fv('vpContact'));
    set('m-workRole',fv('vpRole')); set('m-workPhone',fv('vpPhone'));
    set('m-workMemo',fv('vpMemo')); set('m-isOnetime',fo('vpOnetime')?'1':'');
    // 라벨 업데이트
    const lbl=document.getElementById('wVendorLabel');
    const phone2=fv('vpPhone'); const contact2=fv('vpContact'); const role2=fv('vpRole');
    if(lbl) lbl.innerHTML=v
      ? `🏢 <b>${esc(v)}</b>${contact2?' · '+esc(contact2):''}${role2?' ('+esc(role2)+')':''}`
      : `🏢 담당업체 입력`;
    // 전화번호 행 업데이트 (버튼 다음 형제 a 태그)
    const vendorBtn=document.getElementById('btnOpenVendorPop');
    if(vendorBtn){
      // 기존 전화 행 제거
      const oldA=vendorBtn.nextElementSibling;
      if(oldA&&oldA.tagName==='A') oldA.remove();
      // 새 전화 행 삽입
      if(v && phone2){
        const a=document.createElement('a');
        a.href='tel:'+phone2.replace(/[^0-9+]/g,'');
        a.onclick=e=>e.stopPropagation();
        a.style.cssText='display:flex;align-items:center;gap:6px;padding:7px 14px 9px;background:#f0f7ff;border-top:1px solid #e8f0fa;font-size:13px;font-weight:700;color:#0369a1;text-decoration:none;font-family:inherit';
        a.innerHTML=`📞 ${esc(phone2)} <span style="font-size:10px;color:#94a3b8;font-weight:400">터치해서 전화</span>`;
        vendorBtn.parentElement.insertBefore(a, vendorBtn.nextSibling);
      }
    }
    ov.remove();
  }
  document.getElementById('vpOk').addEventListener('click',doConfirm);
  document.getElementById('vpClear').addEventListener('click',()=>{
    ['m-workVendor','m-workContact','m-workRole','m-workPhone','m-workMemo','m-isOnetime'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
    const lbl=document.getElementById('wVendorLabel'); if(lbl) lbl.innerHTML='🏢 담당업체 입력';
    // 전화 행 제거
    const vendorBtn=document.getElementById('btnOpenVendorPop');
    if(vendorBtn){ const oldA=vendorBtn.nextElementSibling; if(oldA&&oldA.tagName==='A') oldA.remove(); }
    ov.remove();
  });
  document.getElementById('vpClose').addEventListener('click',()=>ov.remove());
  /* 배경 클릭 닫기 비활성화 */
}

function renderWorkModal(data, mode){
  _workMode = mode||"simple";
  const e2 = s=>(s||"").toString().replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
  const td = kstNow().toISOString().slice(0,10);
  const d = data||{};
  const expType = d.expType&&d.expType!=="없음" ? d.expType : "개인비용";

  const S = { /* 공통 스타일 */
    inp: `width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;color:#1a2f45`,
    sel: `width:100%;box-sizing:border-box;height:44px;padding:0 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;color:#1a2f45;cursor:pointer`,
    lbl: `display:block;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:5px;text-transform:uppercase`,
    ta:  `width:100%;box-sizing:border-box;min-height:68px;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;color:#1a2f45;resize:vertical;line-height:1.6`,
    row: `display:grid;grid-template-columns:110px 1fr;gap:10px;margin-bottom:12px`, /* 층(작게)+분야(크게) */
    mb:  `margin-bottom:12px`,
  };

  /* ── 탭 ── */
  const tabs = `
  <div style="display:flex;gap:0;border-radius:10px;overflow:hidden;border:1.5px solid #e2e8f0;margin-bottom:18px">
    <button type="button" onclick="renderWorkModal(window._wModalData,'simple')"
      style="flex:1;padding:11px 0;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;border:none;
      background:${_workMode==='simple'?'#2563a8':'#f8fafc'};color:${_workMode==='simple'?'#fff':'#64748b'}">
      🏢 일반업무
    </button>
    <button type="button" onclick="renderWorkModal(window._wModalData,'full')"
      style="flex:1;padding:11px 0;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;border:none;border-left:1.5px solid #e2e8f0;
      background:${_workMode==='full'?'#c2410c':'#f8fafc'};color:${_workMode==='full'?'#fff':'#64748b'}">
      💰 외주·비용
    </button>
  </div>`;

  /* ── 날짜+상태 (2열) ── */
  const rowDateStatus = `
  <div style="display:grid;grid-template-columns:1fr auto 100px;gap:8px;align-items:end;${S.mb}">
    <div>
      <label style="${S.lbl}">날짜 *</label>
      <input type="date" id="m-date" value="${e2(d.date||td)}" style="${S.inp}">
    </div>
    <button type="button" id="btn-yesterday"
      style="height:44px;padding:0 13px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:12px;font-weight:700;color:#64748b;background:#f8fafc;cursor:pointer;font-family:inherit;white-space:nowrap"
      onclick="(function(b){const e=document.getElementById('m-date');if(!e)return;const y=yesterdayStr();if(e.value===y){e.value=window._wTodayBk||todayStr();b.textContent='어제';b.style.background='#f8fafc';b.style.color='#64748b';}else{window._wTodayBk=e.value||todayStr();e.value=y;b.textContent='✓ 어제';b.style.background='#fef3c7';b.style.color='#92400e';}})(this)">어제</button>
    <div>
      <label style="${S.lbl}">상태</label>
      <select id="m-status" style="${S.sel}">
        ${["미완료","진행중","완료","보류"].map(o=>`<option${(d.status||"완료")===o?" selected":""}>${o}</option>`).join("")}
      </select>
    </div>
  </div>`;

  /* ── 층(작게) + 분야(크게) 2열 ── */
  const rowFloorField = `
  <div style="${S.row};${S.mb}">
    <div>
      <label style="${S.lbl}">층</label>
      <select id="m-floor" style="${S.sel};font-size:13px">
        ${FLOORS.map(o=>`<option value="${e2(o)}"${(d.floor||"")===o?" selected":""}>${o===""?"—":o}</option>`).join("")}
      </select>
    </div>
    <div style="position:relative">
      <label style="${S.lbl}">분야</label>
      <input type="text" id="m-field" value="${e2(d.field||"")}" placeholder="분야 입력 또는 검색" autocomplete="off"
        style="${S.inp}">
      <button type="button" data-fieldmgr title="분야 관리"
        style="position:absolute;right:10px;top:70%;transform:translateY(-50%);background:none;border:none;color:#cbd5e1;font-size:15px;cursor:pointer;padding:2px">⚙</button>
      <div id="m-field-list" style="display:none;position:absolute;top:48px;left:0;right:0;background:#fff;border:1.5px solid #dbe6f4;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:600;max-height:220px;overflow:auto"></div>
      <input type="hidden" id="m-field-new">
    </div>
  </div>`;

  /* ── 업무내역 (1열 풀) ── */
  const rowTitle = `
  <div style="${S.mb}">
    <label style="${S.lbl}">업무내역 *</label>
    <input type="text" id="m-title" value="${e2(d.title||"")}" list="dl-title" autocomplete="off"
      placeholder="무엇을 했나요?" style="${S.inp};font-size:15px;font-weight:600;border-color:#3b82f6">
    <datalist id="dl-title">${[...new Set(entries.filter(e=>e.kind==="work"&&e.title).map(e=>e.title))].sort().map(v=>`<option value="${e2(v)}"></option>`).join("")}</datalist>
  </div>`;

  /* ── 상세내용 (1열 풀, 항상 표시) ── */
  const rowDetail = `
  <div style="${S.mb}">
    <label style="${S.lbl}">상세내용</label>
    <textarea id="m-detail" placeholder="작업 내용, 특이사항 등" style="${S.ta}">${e2(d.detail||"")}</textarea>
  </div>`;

  /* ── 임시 전화번호 — 연락처 검색 + 전화 + 저장 통합 UI ── */
  const rowTempPhone = `
  <div id="wTempPhoneBox" style="border:1.5px solid #fde68a;border-radius:12px;overflow:visible;background:#fffbea;${S.mb}">
    <div style="padding:8px 12px 6px;display:flex;align-items:center;gap:4px;flex-wrap:wrap">
      <label style="font-size:11px;font-weight:700;color:#92400e;flex:1;min-width:80px">📞 전화번호 메모 <span style="font-weight:400;color:#b45309">(저장 안 됨)</span></label>
      <button type="button" id="btnTpAddReg"
        style="font-size:11px;padding:3px 9px;border:1.5px solid #86efac;border-radius:6px;background:#f0fdf4;color:#065f46;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap">
        📇 연락처 추가
      </button>
      <button type="button" id="btnTpAddOne"
        style="font-size:11px;padding:3px 9px;border:1.5px solid #fde68a;border-radius:6px;background:#fff8e1;color:#92400e;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap">
        🕐 임시번호
      </button>
      <button type="button" id="btnTpSearch"
        style="font-size:11px;padding:3px 9px;border:1.5px solid #dbe6f4;border-radius:6px;background:#f7faff;color:#3f7cb8;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap">
        🔍 검색
      </button>
    </div>
      <div id="tpSearchWrap" style="display:none;margin-bottom:8px;position:relative">
        <input type="text" id="tpSearchInp" placeholder="업체명·이름·번호 검색…" autocomplete="off"
          style="width:100%;box-sizing:border-box;height:40px;padding:0 36px 0 12px;border:1.5px solid #fcd34d;border-radius:8px;font-size:13px;font-family:inherit;background:#fff;outline:none;color:#1a2f45">
        <button type="button" id="tpSearchClear"
          style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:15px;color:#aab8c8;cursor:pointer;display:none">✕</button>
        <div id="tpSearchList"
          style="position:absolute;top:44px;left:0;right:0;background:#fff;border:1.5px solid #fcd34d;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:800;max-height:200px;overflow:auto;display:none"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center">
        <input type="tel" id="m-tempPhone" value="" placeholder="010-0000-0000"
          style="height:42px;padding:0 12px;border:1.5px solid #fcd34d;border-radius:8px;font-size:14px;font-weight:600;font-family:inherit;background:#fff;outline:none;color:#1a2f45;width:100%;box-sizing:border-box">
        <a id="m-tempPhoneCall" href="#"
          style="height:42px;padding:0 12px;border-radius:8px;border:1.5px solid #fcd34d;background:#fff;color:#0369a1;font-size:13px;font-weight:700;display:flex;align-items:center;gap:4px;text-decoration:none;white-space:nowrap;font-family:inherit"
          onclick="(function(a){var v=document.getElementById('m-tempPhone').value.replace(/[^0-9+]/g,'');if(!v)return false;a.href='tel:'+v;})(this)">
          📲 전화
        </a>
        <button type="button" id="btnTpSave"
          style="height:42px;padding:0 12px;border-radius:8px;border:1.5px solid #fcd34d;background:#fff;color:#065f46;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;display:none">
          💾 저장
        </button>
      </div>
      <div id="tpMatchInfo" style="display:none;margin-top:6px;padding:6px 10px;background:#f0fdf4;border-radius:7px;border:1px solid #bbf7d0;font-size:12px;color:#065f46;font-weight:600"></div>
    </div>
  </div>`;

  /* ── 자재 사용 내역 — 클릭 시 팝업 ── */
  const matLabel = d.material && d.qty
    ? `📦 자재: <b>${e2(d.material)}</b> × ${e2(String(d.qty))}`
    : `📦 자재 사용 내역`;
  const matSection = `
  <div id="wMatRow" style="border:1.5px solid #f1f5f9;border-radius:10px;overflow:hidden;${S.mb}">
    <button type="button" id="btnOpenMatPop"
      style="width:100%;display:flex;align-items:center;gap:8px;padding:9px 14px;background:#f8fafc;border:none;cursor:pointer;font-family:inherit;text-align:left">
      <span id="wMatLabel" style="font-size:12px;font-weight:700;color:#64748b;flex:1">${matLabel}</span>
      <span style="font-size:10px;color:#94a3b8">▶ 클릭해서 입력</span>
    </button>
    <input type="hidden" id="m-material" value="${e2(d.material||"")}">
    <input type="hidden" id="m-qty" value="${e2(d.qty||"")}">
    <input type="hidden" id="m-mat-item-id" value="">
  </div>`;

  /* ════════════════ 모드별 추가 필드 ════════════════ */
  let modeExtra = "";

  if(_workMode === "full"){

    /* ── 지출종류 + 금액 (1열씩) ── */
    const isPost = expType==="후불청구";
    const costSection = `
    <div style="padding:14px;background:${isPost?"#fff7ed":"#eff6ff"};border:1.5px solid ${isPost?"#fdba74":"#bfdbfe"};border-radius:12px;${S.mb}">
      <div style="${S.mb.replace('12px','10px')}">
        <label style="${S.lbl.replace('#94a3b8',isPost?'#c2410c':'#1d4ed8')}">지출종류</label>
        <select id="m-expType" style="${S.sel};background:transparent;border-color:${isPost?"#fdba74":"#bfdbfe"}">
          ${["개인비용","후불청구"].map(o=>`<option${expType===o?" selected":""}>${o}</option>`).join("")}
        </select>
      </div>
      <div>
        <label id="lbl-cost" style="${S.lbl.replace('#94a3b8',isPost?'#c2410c':'#1d4ed8')}">${isPost?"계약금액 (원)":"금액 (원)"}</label>
        <input type="number" id="m-cost" value="${e2(d.cost||"")}" placeholder="0"
          style="${S.inp};background:transparent;border-color:${isPost?"#fdba74":"#bfdbfe"};font-size:17px;font-weight:700;text-align:right;color:${isPost?"#c2410c":"#1d4ed8"}">
      </div>
    </div>`;

    /* ── 담당업체 팝업 버튼 ── */
    const _vName = d.workVendor||d.vendor||'';
    const _vPhone = d.workPhone||'';
    const _vContact = d.workContact||'';
    const _vRole = d.workRole||'';
    const vendorLabel = _vName
      ? `🏢 <b>${e2(_vName)}</b>${_vContact?` · ${e2(_vContact)}`:''}${_vRole?` (${e2(_vRole)})`:''}`
      : `🏢 담당업체 입력`;
    const vendorPhoneRow = (_vName && _vPhone)
      ? `<a href="tel:${_vPhone.replace(/[^0-9+]/g,'')}"
           onclick="event.stopPropagation()"
           style="display:flex;align-items:center;gap:6px;padding:7px 14px 9px;background:#f0f7ff;border-top:1px solid #e8f0fa;
                  font-size:13px;font-weight:700;color:#0369a1;text-decoration:none;font-family:inherit">
          📞 ${e2(_vPhone)}
          <span style="font-size:10px;color:#94a3b8;font-weight:400">터치해서 전화</span>
        </a>`
      : '';
    const vendorSection = `
    <div style="border:1.5px solid #f1f5f9;border-radius:10px;overflow:hidden;${S.mb}">
      <button type="button" id="btnOpenVendorPop"
        style="width:100%;display:flex;align-items:center;gap:8px;padding:9px 14px;background:#f8fafc;border:none;cursor:pointer;font-family:inherit;text-align:left">
        <span id="wVendorLabel" style="font-size:12px;font-weight:700;color:#64748b;flex:1">${vendorLabel}</span>
        <span style="font-size:10px;color:#94a3b8">✏️ 수정</span>
      </button>
      ${vendorPhoneRow}
      <input type="hidden" id="m-workVendor"  value="${e2(_vName)}">
      <input type="hidden" id="m-workContact" value="${e2(_vContact)}">
      <input type="hidden" id="m-workRole"    value="${e2(_vRole)}">
      <input type="hidden" id="m-workPhone"   value="${e2(_vPhone)}">
      <input type="hidden" id="m-workMemo"    value="${e2(d.workMemo||d.memo||"")}">
      <input type="hidden" id="m-isOnetime"   value="${d.isOnetime?"1":""}">
    </div>`;

    /* ── 견적 메모 (토글) ── */
    const estimateSection = `
    <details style="border:1.5px solid #f1f5f9;border-radius:10px;overflow:hidden;${S.mb}">
      <summary style="display:flex;align-items:center;gap:8px;padding:9px 14px;background:#f8fafc;cursor:pointer;list-style:none;user-select:none">
        <span style="font-size:12px;font-weight:700;color:#64748b;flex:1">📋 견적 메모</span>
        <span style="font-size:10px;color:#94a3b8">▼</span>
      </summary>
      <div style="padding:12px 14px">
        <textarea id="m-estimateMemo" placeholder="견적 내용, 계약 조건 등" style="${S.ta}">${e2(d.estimateMemo||"")}</textarea>
      </div>
    </details>`;

    modeExtra = costSection + vendorSection + estimateSection;
  }

  /* ── 조립: 탭 → 날짜/상태 → 층/분야 → 업무내역 → 상세내용 → [외주전용] → 자재 ── */
  /* v44-fix: 이전 kind에서 남은 grid style 초기화 */
  const mfEl = $("mFields");
  mfEl.style.cssText = "display:block";
  mfEl.className = "";
  mfEl.innerHTML = tabs + rowDateStatus + rowFloorField + rowTitle + rowDetail + rowTempPhone + modeExtra + matSection;
  window._wModalData = data;

  /* 외주 모달: 상태를 항상 완료로 강제 */
  if(_workMode==="full"){
    const stEl=$("m-status"); if(stEl) stEl.value="완료";
  }

  /* expType 변경 */
  const expTypeEl=$("m-expType");
  if(expTypeEl){
    expTypeEl.addEventListener("change",()=>{
      const isPost=expTypeEl.value==="후불청구";
      const lbl2=$("lbl-cost"); if(lbl2) lbl2.textContent=isPost?"계약금액 (원)":"금액 (원)";
      const box=expTypeEl.closest("div[style*='background']");
      if(box){ box.style.background=isPost?"#fff7ed":"#eff6ff"; box.style.borderColor=isPost?"#fdba74":"#bfdbfe"; }
      const ci=$("m-cost");
      if(ci){ ci.style.color=isPost?"#c2410c":"#1d4ed8"; ci.style.borderColor=isPost?"#fdba74":"#bfdbfe"; }
      const modal=document.querySelector("#overlay .modal");
      if(modal){ modal.classList.remove("exp-mode-personal","exp-mode-tax","exp-mode-none");
        modal.classList.add(isPost?"exp-mode-tax":"exp-mode-personal"); }
    });
    setTimeout(()=>expTypeEl.dispatchEvent(new Event("change")),50);
  }

  /* 담당업체 팝업 버튼 바인딩 */
  setTimeout(()=>{
    const vBtn=document.getElementById('btnOpenVendorPop');
    if(vBtn&&!vBtn._bound){ vBtn._bound=true; vBtn.addEventListener('click', openVendorPickerPopup); }
  },80);

  /* 분야 검색 */
  setTimeout(()=>{ makeFieldSearchUI&&makeFieldSearchUI('m-field','m-field-list'); },80);

  /* 분야 관리 버튼 */
  const fb=document.querySelector('#mFields [data-fieldmgr]');
  if(fb&&!fb._bound){ fb._bound=true; fb.addEventListener("click",e=>{ e.preventDefault(); openFieldManager(()=>{}); }); }

  /* 자재 팝업 버튼 바인딩 */
  setTimeout(()=>{
    const btn = document.getElementById('btnOpenMatPop');
    if(btn && !btn._bound){ btn._bound=true; btn.addEventListener('click', openMatPickerPopup); }
  }, 80);

  /* ── 임시 전화번호 통합 UI 바인딩 ── */
  setTimeout(()=>{ bindTempPhoneUI(); }, 100);
}

function bindTempPhoneUI(){
  const searchBtn  = document.getElementById('btnTpSearch');
  const searchWrap = document.getElementById('tpSearchWrap');
  const searchInp  = document.getElementById('tpSearchInp');
  const searchClear= document.getElementById('tpSearchClear');
  const searchList = document.getElementById('tpSearchList');
  const phoneInp   = document.getElementById('m-tempPhone');
  const saveBtn    = document.getElementById('btnTpSave');
  const matchInfo  = document.getElementById('tpMatchInfo');
  if(!searchBtn||!phoneInp) return;

  /* 🔍 연락처 검색 토글 */
  searchBtn.addEventListener('click', ()=>{
    const shown = searchWrap.style.display!=='none';
    searchWrap.style.display = shown ? 'none' : 'block';
    if(!shown) setTimeout(()=>searchInp.focus(), 50);
  });

  /* 검색창 입력 → 연락처 드롭다운 */
  function renderTpList(q){
    const contacts = (typeof contactsCache!=='undefined') ? contactsCache : [];
    if(!contacts.length){
      searchList.innerHTML='<div style="padding:10px 14px;color:#aab8c8;font-size:13px">⏳ 연락처 로드 중… 잠시 후 다시 시도하세요</div>';
      searchList.style.display='block';
      if(typeof loadContactsCache==='function') loadContactsCache().then(()=>renderTpList(q)).catch(()=>{});
      return;
    }
    const ql = (q||'').trim().toLowerCase();
    const qlNum = ql.replace(/[^0-9]/g,'');
    let arr = ql
      ? contacts.filter(c=>{
          const hay = [c.name,c.person,c.title,c.cat,c.memo,c.address,c.email,c.company]
            .map(v=>String(v||'')).join(' ').toLowerCase();
          const ph = (c.phone||'').replace(/[^0-9]/g,'');
          return hay.includes(ql) || (qlNum.length>=2 && ph.includes(qlNum));
        })
      : contacts.slice(0, 30);
    if(!arr.length){
      searchList.innerHTML='<div style="padding:10px 14px;color:#aab8c8;font-size:13px">검색 결과 없음</div>';
      searchList.style.display='block'; return;
    }
    /* 등록업체 먼저, 일회성 뒤 */
    const reg = arr.filter(c=>(c.vendorType||'등록업체')!=='일회성');
    const one = arr.filter(c=>c.vendorType==='일회성');
    arr = [...reg, ...one];
    searchList.innerHTML = arr.map((c,i)=>{
      const isOne = c.vendorType==='일회성';
      const badge = isOne ? '<span style="font-size:10px;background:#f1f5f9;color:#94a3b8;border-radius:5px;padding:1px 5px;margin-left:4px">🕐 일회성</span>' : '';
      return `<div class="tp-item" data-i="${i}"
        style="padding:9px 14px;cursor:pointer;border-bottom:1px solid #fef9c3;display:flex;justify-content:space-between;align-items:center${isOne?';opacity:.7':''}">
        <div>
          <span style="font-size:13px;font-weight:700;color:#1a2f45">${esc(c.name||c.person||'(이름없음)')}${badge}</span>
          ${c.person&&c.name?`<span style="font-size:12px;color:#3f7cb8;margin-left:4px">· ${esc(c.person)}</span>`:''}
          <div style="font-size:11px;color:#94a3b8;margin-top:1px">${[c.cat,c.title].filter(Boolean).join(' · ')}</div>
        </div>
        <span style="font-size:13px;font-weight:700;color:#0369a1;white-space:nowrap">${esc(c.phone||'')}</span>
      </div>`;
    }).join('');
    /* 일회성 구분선 */
    if(one.length && reg.length){
      const div=document.createElement('div');
      div.style.cssText='padding:3px 14px;font-size:10px;font-weight:700;color:#94a3b8;background:#fef9c3';
      div.textContent='🕐 일회성 업체';
      searchList.querySelectorAll('.tp-item')[reg.length]?.before(div);
    }
    searchList.style.display='block';
    /* 클릭 → 전화번호 채우기 */
    searchList.querySelectorAll('.tp-item').forEach((el,i2)=>{
      el.addEventListener('mouseenter',()=>el.style.background='#fef3c7');
      el.addEventListener('mouseleave',()=>el.style.background='');
      el.addEventListener('mousedown', e=>{
        e.preventDefault();
        const c = arr[parseInt(el.dataset.i)];
        phoneInp.value = c.phone||'';
        searchWrap.style.display='none';
        searchList.style.display='none';
        /* 매칭 정보 표시 */
        matchInfo.style.display='block';
        matchInfo.textContent = `✅ ${c.name||c.person||''} ${c.person&&c.name?'· '+c.person:''} ${c.phone||''}`;
        /* 이미 연락처에 있으면 저장 버튼 숨김 */
        saveBtn.style.display = (c.vendorType==='일회성') ? 'flex' : 'none';
        if(c.vendorType==='일회성') saveBtn.title='일회성 업체 — 연락처에 저장';
        checkTpSaveBtn();
      });
    });
  }

  searchInp.addEventListener('input', ()=>{
    searchClear.style.display = searchInp.value ? 'block' : 'none';
    renderTpList(searchInp.value);
  });
  searchInp.addEventListener('focus', ()=>{ if(!searchInp.value) renderTpList(''); });
  searchClear.addEventListener('mousedown', e=>{
    e.preventDefault();
    searchInp.value=''; searchList.style.display='none';
    searchClear.style.display='none';
  });

  /* 전화번호 직접 입력 시 → 저장 버튼 표시 여부 */
  function checkTpSaveBtn(){
    const v = (phoneInp.value||'').replace(/[^0-9]/g,'');
    if(!v){ saveBtn.style.display='none'; matchInfo.style.display='none'; return; }
    /* 이미 연락처에 있는 번호면 저장 버튼 숨김 */
    const exists = (typeof contactsCache!=='undefined'?contactsCache:[])
      .find(c=>(c.phone||'').replace(/[^0-9]/g,'')===v);
    if(exists){
      matchInfo.style.display='block';
      matchInfo.innerHTML=`<span style="color:#065f46">📇 ${esc(exists.name||'')}${exists.person?' · '+esc(exists.person):''} — 이미 연락처에 있어요</span>`;
      saveBtn.style.display='none';
    } else {
      matchInfo.style.display='none';
      saveBtn.style.display='flex';
    }
  }
  phoneInp.addEventListener('input', checkTpSaveBtn);

  /* 💾 저장 버튼 → Firebase contacts에 저장 */
  saveBtn.addEventListener('click', async ()=>{
    const phone = (phoneInp.value||'').trim();
    if(!phone){ toast('전화번호를 입력하세요'); return; }
    const name = prompt('연락처에 저장할 이름을 입력하세요:', '');
    if(name===null) return; /* 취소 */
    const isOne = confirm('일회성 업체로 저장할까요?\n[확인] 일회성  /  [취소] 등록업체');
    if(!online||!db){ toast('오프라인 — 연락처 저장 불가'); return; }
    const rec = {
      name: name||phone,
      cat: '기타',
      person: '',
      phone,
      vendorType: isOne ? '일회성' : '등록업체',
      memo: '업무 모달 전화번호에서 저장 ('+kstNow().toLocaleDateString('ko-KR')+')',
      fav: false,
      createdAt: Date.now()
    };
    try{
      const ref = await db.collection('contacts').add(rec);
      rec.id = ref.id;
      contactsCache.push(rec);
      toast(`✅ "${rec.name}" 연락처에 저장됐어요`);
      saveBtn.style.display='none';
      matchInfo.style.display='block';
      matchInfo.innerHTML=`<span style="color:#065f46">📇 ${esc(rec.name)} — 연락처에 저장됐어요</span>`;
    }catch(e){ toast('저장 실패: '+(e.message||e)); }
  });

  /* 닫기: 검색 목록이 열린 상태에서 외부 클릭 */
  document.addEventListener('mousedown', function tpClose(e){
    if(!searchWrap.contains(e.target) && e.target!==searchBtn){
      searchList.style.display='none';
    }
  });

  /* 📇 연락처 추가 / 🕐 임시번호 버튼 바인딩 */
  const btnReg = document.getElementById("btnTpAddReg");
  if(btnReg && !btnReg._bound){ btnReg._bound=true; btnReg.addEventListener("click", ()=>openTpContactForm(phoneInp,"등록업체")); }
  const btnOne = document.getElementById("btnTpAddOne");
  if(btnOne && !btnOne._bound){ btnOne._bound=true; btnOne.addEventListener("click", ()=>openTpContactForm(phoneInp,"일회성")); }
}


/* ── 연락처 추가 팝업 (등록업체 / 일회성) ── */
function openTpContactForm(phoneInpRef, defaultType){
  var old=document.getElementById('tpCfOv'); if(old) old.remove();
  var curPhone=(phoneInpRef&&phoneInpRef.value)?phoneInpRef.value.trim():'';
  var SI='width:100%;box-sizing:border-box;height:42px;padding:0 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;font-family:inherit;background:#fff;outline:none;color:#1a2f45';
  var LB='display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px';
  var isOne=(defaultType==='일회성');
  var ov=document.createElement('div');
  ov.id='tpCfOv';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:13000;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML=
    '<div style="background:#fff;border-radius:18px;width:100%;max-width:420px;box-shadow:0 16px 48px rgba(0,0,0,.25);overflow:hidden">'+
      '<div style="padding:14px 18px 12px;background:'+(isOne?'#fffbea':'#f8faff')+';border-bottom:1.5px solid '+(isOne?'#fde68a':'#e8f0fa')+';display:flex;align-items:center;justify-content:space-between">'+
        '<span style="font-size:16px;font-weight:800;color:#1a2f45">'+(isOne?'🕐 임시번호 저장':'📇 연락처 추가')+'</span>'+
        '<button id="tpCfX" type="button" style="border:none;background:none;font-size:22px;color:#94a3b8;cursor:pointer;line-height:1">✕</button>'+
      '</div>'+
      '<div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px">'+
        '<div><label style="'+LB+'">업체명 / 이름 <span style="color:#e74c3c">*</span></label>'+
          '<input type="text" id="tpCfName" placeholder="예: 서희건설, 김상동" autocomplete="off" style="'+SI+';border-color:#3b82f6;font-weight:600"></div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
          '<div><label style="'+LB+'">담당자</label><input type="text" id="tpCfPerson" placeholder="담당자 이름" style="'+SI+'"></div>'+
          '<div><label style="'+LB+'">직책</label><input type="text" id="tpCfRole" placeholder="예: 소장" style="'+SI+'"></div>'+
        '</div>'+
        '<div><label style="'+LB+'">전화번호 <span style="color:#e74c3c">*</span></label>'+
          '<input type="tel" id="tpCfPhone" value="'+curPhone+'" placeholder="010-0000-0000" style="'+SI+'"></div>'+
        '<div><label style="'+LB+'">분야</label>'+
          '<input type="text" id="tpCfCat" placeholder="예: 전기, 설비, 영선" style="'+SI+'"></div>'+
        '<div><label style="'+LB+'">메모</label>'+
          '<input type="text" id="tpCfMemo" placeholder="간단한 메모" style="'+SI+'"></div>'+
      '</div>'+
      '<div style="padding:0 18px 18px;display:flex;flex-direction:column;gap:6px">'+
        '<button id="tpCfSaveReg" type="button" style="width:100%;height:48px;border:none;border-radius:12px;background:'+(isOne?'#f1f5f9':'#3f7cb8')+';color:'+(isOne?'#94a3b8':'#fff')+';font-size:15px;font-weight:700;font-family:inherit;cursor:pointer">'+
          '🏢 등록업체로 저장</button>'+
        '<button id="tpCfSaveOne" type="button" style="width:100%;height:48px;border:none;border-radius:12px;background:'+(isOne?'#f59e0b':'#f8fafc')+';color:'+(isOne?'#fff':'#92400e')+';border:2px solid '+(isOne?'#f59e0b':'#fde68a')+';font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">'+
          '🕐 임시번호 (일회성)로 저장</button>'+
        '<p style="font-size:11px;color:#94a3b8;text-align:center;margin:0">일회성은 연락처에서 별도 탭으로 관리됩니다</p>'+
      '</div>'+
    '</div>';
  document.body.appendChild(ov);

  function doSave(vendorType){
    var name=(document.getElementById('tpCfName').value||'').trim();
    var phone=(document.getElementById('tpCfPhone').value||'').trim();
    if(!name){toast('업체명 또는 이름을 입력하세요');document.getElementById('tpCfName').focus();return;}
    if(!phone){toast('전화번호를 입력하세요');document.getElementById('tpCfPhone').focus();return;}
    var phoneClean=phone.replace(/[^0-9]/g,'');
    var dup=(typeof contactsCache!=='undefined'?contactsCache:[]).find(function(c){return (c.phone||'').replace(/[^0-9]/g,'')=== phoneClean;});
    if(dup&&!confirm('"'+dup.name+'"과 같은 번호예요. 그래도 추가할까요?')) return;
    if(!online||!db){toast('오프라인 — 저장 불가');return;}
    var rec={
      name:name,
      cat:(document.getElementById('tpCfCat').value||'').trim()||'기타',
      person:(document.getElementById('tpCfPerson').value||'').trim(),
      title:(document.getElementById('tpCfRole').value||'').trim(),
      phone:phone,
      memo:(document.getElementById('tpCfMemo').value||'').trim(),
      vendorType:vendorType,
      fav:false,
      createdAt:Date.now()
    };
    var btn=document.getElementById(vendorType==='일회성'?'tpCfSaveOne':'tpCfSaveReg');
    if(btn){btn.disabled=true;btn.textContent='저장 중…';}
    db.collection('contacts').add(rec).then(function(ref){
      rec.id=ref.id;
      if(typeof contactsCache!=='undefined') contactsCache.push(rec);
      if(phoneInpRef) phoneInpRef.value=phone;
      ov.remove();
      toast('✅ "'+name+'" '+(vendorType==='일회성'?'일회성':'등록업체')+'로 저장됐어요');
    }).catch(function(e){
      if(btn){btn.disabled=false;btn.textContent=vendorType==='일회성'?'🕐 임시번호 (일회성)로 저장':'🏢 등록업체로 저장';}
      toast('저장 실패: '+(e.message||e));
    });
  }

  document.getElementById('tpCfSaveReg').addEventListener('click',function(){doSave('등록업체');});
  document.getElementById('tpCfSaveOne').addEventListener('click',function(){doSave('일회성');});
  document.getElementById('tpCfX').addEventListener('click',function(){ov.remove();});
  /* 배경 클릭 닫기 비활성화 */
  setTimeout(function(){var n=document.getElementById('tpCfName');if(n)n.focus();},80);
}


/* ══════════════════════════════════════════════
   🔤 맞춤법 AI 검사 (저장 전 자동 실행)
   ══════════════════════════════════════════════ */
async function saveWorkEntry(){
  const title = ($("m-title")||{}).value?.trim();
  const detail = ($("m-detail")||{}).value?.trim();
  if(!title){ toast("업무내역을 입력하세요"); return; }

  // AI 키 없으면 바로 저장
  const apiKey = (typeof aiGetKey==="function") ? aiGetKey() : "";
  if(!apiKey){ _doSaveWorkEntry(); return; }

  // 검사할 텍스트 수집
  const checkTexts = [];
  if(title)  checkTexts.push({field:"업무내역", text:title});
  if(detail) checkTexts.push({field:"상세내용", text:detail});
  if(!checkTexts.length){ _doSaveWorkEntry(); return; }

  // 로딩 표시
  const saveBtn = $("mSave");
  const origText = saveBtn ? saveBtn.textContent : "";
  if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent="✍️ 검사 중…"; }

  try{
    const prompt = `다음 업무일지 내용의 맞춤법과 띄어쓰기를 검사해주세요.
오류가 있으면 JSON으로만 응답하세요. 오류가 없으면 {"ok":true} 만 응답하세요.

${checkTexts.map(t=>`[${t.field}]: ${t.text}`).join("\n")}

응답 형식(오류 있을 때):
{"ok":false,"items":[{"field":"필드명","original":"원본","corrected":"수정본","reason":"이유"}]}`;

    const res = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({
        model:"claude-sonnet-4-6",
        max_tokens:1000,
        messages:[{role:"user",content:prompt}]
      })
    });
    const data = await res.json();
    const raw = (data.content||[]).map(b=>b.text||"").join("").trim();

    let result;
    try{ result = JSON.parse(raw.replace(/```json|```/g,"").trim()); }
    catch(e){ result = {ok:true}; }

    if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent=origText; }

    if(result.ok){ _doSaveWorkEntry(); return; }

    // 오류 있으면 수정 제안 팝업
    showSpellCorrectPopup(result.items||[], ()=>_doSaveWorkEntry());

  }catch(err){
    console.warn("[맞춤법 검사 오류]", err);
    if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent=origText; }
    // 네트워크 오류 등은 그냥 저장
    _doSaveWorkEntry();
  }
}

/* 맞춤법 수정 제안 팝업 */
function showSpellCorrectPopup(items, onSave, kind){
  const ov = document.createElement("div");
  ov.id = "spellCheckOv";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:13000;display:flex;align-items:center;justify-content:center;padding:16px";

  const itemsHTML = items.map((it,i)=>`
    <div style="background:#fff;border:1.5px solid #e8f0fa;border-radius:12px;padding:12px 14px;margin-bottom:8px">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:6px">[${it.field}]</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:14px;color:#e74c3c;text-decoration:line-through">${esc(it.original)}</span>
        <span style="font-size:16px;color:#94a3b8">→</span>
        <span style="font-size:14px;font-weight:700;color:#065f46">${esc(it.corrected)}</span>
      </div>
      <div style="font-size:11px;color:#7a92a8;margin-top:4px">💡 ${esc(it.reason||"")}</div>
      <label style="display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer;font-size:13px;font-weight:600;color:#1a2f45">
        <input type="checkbox" class="spell-apply" data-idx="${i}" checked
          style="width:15px;height:15px;accent-color:#3f7cb8;cursor:pointer">
        이 수정 적용
      </label>
    </div>`).join("");

  ov.innerHTML = `
    <div style="background:#fff;border-radius:18px;width:100%;max-width:480px;max-height:85vh;overflow:auto;box-shadow:0 16px 48px rgba(0,0,0,.25)">
      <div style="padding:14px 18px 12px;background:linear-gradient(135deg,#fef3c7,#fff);border-bottom:1.5px solid #fde68a;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">✍️</span>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:800;color:#1a2f45">맞춤법 검사 결과</div>
          <div style="font-size:12px;color:#92400e">${items.length}개 수정 제안</div>
        </div>
        <button id="spellClose" type="button" style="border:none;background:none;font-size:22px;color:#94a3b8;cursor:pointer">✕</button>
      </div>
      <div style="padding:14px 18px">${itemsHTML}</div>
      <div style="padding:0 18px 18px;display:flex;flex-direction:column;gap:8px">
        <button id="spellApply" type="button"
          style="width:100%;height:48px;border:none;border-radius:12px;background:#3f7cb8;color:#fff;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer">
          ✅ 선택 수정 후 저장
        </button>
        <button id="spellSkip" type="button"
          style="width:100%;height:42px;border:1.5px solid #e2e8f0;border-radius:12px;background:#f8fafc;color:#64748b;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">
          그냥 저장 (수정 안 함)
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  document.getElementById("spellClose").addEventListener("click", ()=>ov.remove());
  document.getElementById("spellSkip").addEventListener("click", ()=>{ ov.remove(); onSave(); });
  document.getElementById("spellApply").addEventListener("click", ()=>{
    ov.querySelectorAll(".spell-apply:checked").forEach(cb=>{
      const it = items[parseInt(cb.dataset.idx)];
      if(!it) return;
      // SCHEMA에서 label 일치하는 필드 찾아서 적용
      const sc3 = (kind && SCHEMA[kind]) ? SCHEMA[kind] : (SCHEMA[mKind]||[]);
      const fd = sc3.find(f=>f.label.replace(/\s*\*$/,"")===it.field);
      if(fd){
        const el=$("m-"+fd.k);
        if(el) el.value=el.value.replace(it.original, it.corrected);
      } else {
        // 업무 모달 fallback
        if(it.field==="업무내역"){ const el=$("m-title"); if(el) el.value=el.value.replace(it.original,it.corrected); }
        if(it.field==="상세내용"){ const el=$("m-detail"); if(el) el.value=el.value.replace(it.original,it.corrected); }
      }
    });
    ov.remove();
    onSave();
  });
  /* 배경 클릭 닫기 비활성화 */
}

function _doSaveWorkEntry(){
  const mode = _workMode;
  const title=($("m-title")||{}).value?.trim();
  if(!title){ toast("업무내역을 입력하세요"); return; }
  const obj={
    kind:"work", workMode:mode,
    date:($("m-date")||{}).value||todayStr(),
    status:($("m-status")||{}).value||"미완료",
    floor:($("m-floor")||{}).value||"",
    field:($("m-field")||{}).value?.trim()||"",
    title,
    detail:($("m-detail")||{}).value?.trim()||"",
    material:($("m-material")||{}).value?.trim()||"",
    qty:Number(($("m-qty")||{}).value)||0,
    expType: mode==="full"?(($("m-expType")||{}).value||"개인비용"):"없음",
    cost: mode==="full"?(Number(($("m-cost")||{}).value)||0):0,
    workVendor:($("m-workVendor")||{}).value?.trim()||"",
    workContact:($("m-workContact")||{}).value?.trim()||"",
    workRole:($("m-workRole")||{}).value?.trim()||"",
    workPhone:($("m-workPhone")||{}).value?.trim()||"",
    workMemo:($("m-workMemo")||{}).value?.trim()||"",
    estimateMemo:($("m-estimateMemo")||{}).value?.trim()||"",
    isOnetime:_workMode==="full" ? !!($("m-isOnetime")||{}).value : !!($("m-isOnetime")||{}).checked,
  };
  // 분야 신규 자동 등록
  if(obj.field && !FIELDS.includes(obj.field)){ FIELDS.push(obj.field); saveFields(); }
  obj.photos=modalPhotos.slice();
  obj.attachments=modalAttachments.slice();
  let savedId=mId;
  if(mId) updateRecord(mId,obj);
  else { obj.createdAt=Date.now(); const nr=addRecord(obj); savedId=nr?nr.id:obj.id; }
  renderAll();
  calcWorkTotal(obj); applyExpLinks(savedId);

  // 자재 출고 자동 기록 (신규 업무에서 자재명+수량 있을 때)
  if(!mId && obj.material && obj.qty>0){
    const matName = obj.material.trim();
    const matInpEl = $("m-material");
    const savedItemId = ($("m-mat-item-id")||{}).value||'';
    // itemId 직접 지정 → 없으면 이름으로 검색
    const matchItem = savedItemId
      ? entries.find(e=>e.id===savedItemId && e.kind==="item")
      : entries.find(e=>e.kind==="item" && (e.itemName||"").replace(/^\[.*?\]/,"").trim()===matName);
    const stockRec = {
      kind:"stock",
      stockType:"출고",
      date: obj.date,
      itemId: matchItem ? matchItem.id : null,
      itemName: matchItem ? matchItem.itemName : matName,
      qty: obj.qty,
      unitPrice: matchItem ? (Number(matchItem.unitPrice)||0) : 0,
      amount: matchItem ? (Number(matchItem.unitPrice)||0)*obj.qty : 0,
      useTarget: `업무: ${obj.title}`,
      memo: `업무 자동출고 (${obj.date})`,
      workId: savedId,
      createdAt: Date.now(),
    };
    addRecord(stockRec);
    toast(`📦 "${matName}" ${obj.qty}개 출고 기록됐어요`);
  }

  $("overlay").classList.remove("show"); toast(mId?"수정되었습니다":"저장되었습니다");
  // 외주모드에서 비용 있으면 지출 모달 연동
  if(mode==="full" && (obj.expType==="개인비용"||obj.expType==="후불청구")){
    const alreadyLinked = mId && typeof entries!=="undefined"
      && entries.some(e=>e.kind==="expense" && e.workId===savedId);
    if(!alreadyLinked){
      setTimeout(()=>openExpenseFromWork({workObj:obj,workId:savedId,expType:obj.expType,isEdit:!!mId}),400);
    }
  }
  if(typeof window.gcalSync==="function" && typeof accessToken!=="undefined" && accessToken){
    const saved=entries.find(e=>e.id===savedId);
    if(saved && typeof GCAL_IDS!=="undefined" && GCAL_IDS[saved.kind]) setTimeout(()=>window.gcalSync(saved),500);
  }
}

function openEditor(kind,id){
  // v16: 비밀번호는 별도 에디터로
  if(kind==="password"){ pwOpenEditor(id); return; }
  mKind=kind; mId=id||null;
  const data = id ? (entries.find(x=>x.id===id)||{}) : defaults(kind);
  // v19: filelink 기존 항목에 ptype 없으면 경로로 추정해서 채움 (수정 시 자동 보정)
  if(kind==="filelink" && id && !data.ptype){
    data.ptype = /[\\\/]\s*$/.test(data.path||"") ? "폴더" : "파일";
  }
  $("mTitle").textContent = (id?"수정":"추가")+" · "+(kind==="work"?(data&&data.workMode==="full"?"외주·비용":"업무"):kind==="schedule"?"예정":KIND_LABEL[kind]);

  // ── 업무 모달: 탭 분리 렌더 ──
  if(kind==="work"){
    // 기존 데이터의 모드 판단: expType 있거나 workVendor 있으면 외주
    const savedMode = data.workMode || (
      (data.expType&&data.expType!=="없음") || data.workVendor || data.cost ? "full" : "simple"
    );
    renderWorkModal(data, savedMode);
    const hasPhoto=PHOTO_KINDS.includes(kind);
    $("mPhotoArea").style.display=hasPhoto?"flex":"none";
    modalPhotos=hasPhoto?((data.photos||[]).slice()):[];
    renderModalThumbs();
    /* scan-app 연결 초기화 */
    _mScanRefs=(data.scanRefs||[]).map(r=>({type:r.type,id:r.id,data:r.data||{}}));
    renderMScanRefs();
    const hasAttach=ATTACH_KINDS.includes(kind);
    $("mAttachArea").style.display=hasAttach?"":"none";
    modalAttachments=hasAttach?((data.attachments||[]).slice().map(a=>({label:a.label||"",path:a.path||""}))):[];
    renderModalAttachList();
    $("mAttachLabel").value=""; $("mAttachPath").value="";
    $("mDelete").style.display=id?"":"none";
    const expLinkArea=$("mExpLinkArea"); if(expLinkArea) expLinkArea.style.display="none";
    renderExpLinkList(id);
    if(id && data && data.workVendor){
      setTimeout(()=>{
        const c=(typeof contactsCache!=='undefined'?contactsCache:[]).find(x=>x.name===data.workVendor);
        if(c && typeof showVendorContractBadge==='function') showVendorContractBadge(c);
      },200);
    }
    $("overlay").classList.add("show");
    $("overlay").querySelector(".modal").scrollTop=0;
    return;
  }

  const sc=SCHEMA[kind];
  const mf = $("mFields");
  mf.className = "grid kind-" + kind; /* kind별 그리드 적용 */
  /* 여러 필드가 있는 모달은 인라인으로도 그리드 강제 (CSS 충돌 방지) */
  const GRID_KINDS = ['call', 'accident', 'item', 'stock', 'meeting', 'deliver', 'vacation', 'schedule'];
  if(GRID_KINDS.includes(kind)){
    mf.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px';
  } else {
    mf.style.cssText = 'display:block';
  }
  mf.innerHTML = sc.map(fieldHTML).join("");
  /* .field 마진 제거 + full은 전체 폭 */
  if(GRID_KINDS.includes(kind)){
    mf.querySelectorAll('.field').forEach(f=>{
      f.style.margin = '0';
      if(f.classList.contains('full')) f.style.gridColumn = '1 / -1';
    });
  }
  sc.forEach(f=>{ 
    if(f.type==="timepick"){
      setTimeout(()=>restoreTimepick('m-'+f.k, data[f.k]||''), 50);
      return;
    }
    if(f.type==="alertbefore"){
      setTimeout(()=>restoreAlertBefore(data[f.k]||0), 50);
      return;
    }
    const el=$("m-"+f.k); if(!el) return; const v=data[f.k]; 
    /* number 타입에서 0이면 빈셀로 (사용자 가독성 ↑) */
    if(f.type === 'number' && (v === 0 || v === '0' || v === undefined || v === null)){
      el.value = '';
    } else if(v!==undefined&&v!==null&&v!=="") {
      el.value=v;
    }
  });
  const hasPhoto=PHOTO_KINDS.includes(kind);
  $("mPhotoArea").style.display=hasPhoto?"flex":"none";
  modalPhotos=hasPhoto?((data.photos||[]).slice()):[];
  renderModalThumbs();
  /* scan-app 연결 초기화 */
  _mScanRefs=(data.scanRefs||[]).map(r=>({type:r.type,id:r.id,data:r.data||{}}));
  renderMScanRefs();
  const hasAttach=ATTACH_KINDS.includes(kind);
  $("mAttachArea").style.display=hasAttach?"":"none";
  modalAttachments=hasAttach?((data.attachments||[]).slice().map(a=>({label:a.label||"",path:a.path||""}))):[];
  renderModalAttachList();
  $("mAttachLabel").value=""; $("mAttachPath").value="";

  $("mDelete").style.display=id?"":"none";

  // 지출 연결 영역 제거 (지출종류 select로 통합)
  const expLinkArea=$("mExpLinkArea");
  if(expLinkArea) expLinkArea.style.display="none";

  // 검색 UI 초기화 (렌더 후 바인딩)
  setTimeout(()=>{
    // 업무 담당업체 검색
    if(kind==="work"){
      makeContactSearchUI('m-workVendor','m-workVendor-list',(c)=>{
        // 무조건 덮어쓰기
        const contactEl=$("m-workContact"); if(contactEl) contactEl.value=c.person||'';
        const roleEl=$("m-workRole"); if(roleEl) roleEl.value=c.title||'';
        const phoneEl=$("m-workPhone"); if(phoneEl) phoneEl.value=c.phone||'';
        const memoEl=$("m-workMemo"); if(memoEl) memoEl.value=c.memo||'';
        // 일회성 체크박스 자동 반영
        const cb=$("m-isOnetime"); if(cb) cb.checked=(c.vendorType==='일회성');
        // 계약형태 뱃지 표시
        showVendorContractBadge(c);
      }, ()=>{
        // ✕ 클릭 시 초기화
        const contactEl=$("m-workContact"); if(contactEl) contactEl.value='';
        const roleEl=$("m-workRole"); if(roleEl) roleEl.value='';
        const phoneEl=$("m-workPhone"); if(phoneEl) phoneEl.value='';
        const memoEl=$("m-workMemo"); if(memoEl) memoEl.value='';
        const cb=$("m-isOnetime"); if(cb) cb.checked=false;
        const badge=$("m-vendorContractBadge"); if(badge) badge.style.display='none';
      });
    }
    // 통화 담당자 검색
    if(kind==="call"){
      makeContactSearchUI('m-callContact','m-callContact-list',(c)=>{
        // 무조건 덮어쓰기
        const nameEl=$("m-name"); if(nameEl) nameEl.value=c.person||c.name||'';
        const roleEl=$("m-role"); if(roleEl) roleEl.value=c.title||'';
        const compEl=$("m-company"); if(compEl) compEl.value=c.name||'';
        const phoneEl=$("m-phone"); if(phoneEl) phoneEl.value=c.phone||'';
      }, ()=>{
        // ✕ 클릭 시 초기화
        const nameEl=$("m-name"); if(nameEl) nameEl.value='';
        const roleEl=$("m-role"); if(roleEl) roleEl.value='';
        const compEl=$("m-company"); if(compEl) compEl.value='';
        const phoneEl=$("m-phone"); if(phoneEl) phoneEl.value='';
      });
    }
  },100);

  // 업무 종류일 때: v44에서는 자동 팝업 제거 (저장 후 지출 모달 자동 호출됨)
  if(kind==="work"){
    renderExpLinkList(id);
    // 일회성 체크박스 복원
    setTimeout(()=>{
      const cb=$("m-isOnetime"); if(cb) cb.checked=!!(data&&data.isOnetime);
      // 담당업체 선택 시 일회성 연동
      const vendorInp=$("m-workVendor");
      if(vendorInp&&!vendorInp._onetimePatch){
        vendorInp._onetimePatch=true;
        // 자동완성에서 업체 선택 시 vendorType 반영
        const origSelect=window._lastContactSelectFn;
      }
    },150);
    // v44: openExpPick 자동 호출 제거 - 저장 후 openExpenseFromWork가 처리함
    // v44-0624: 수정 시 기존 업체 계약형태 뱃지 복원
    if(id && data && data.workVendor){
      const vendorName = data.workVendor;
      setTimeout(()=>{
        const c = (typeof contactsCache!=='undefined'?contactsCache:[]).find(x=>x.name===vendorName);
        if(c && typeof showVendorContractBadge==='function') showVendorContractBadge(c);
      }, 200);
    }
  }

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

  // v22: stock(입출고) 모달 — 품목 셀렉트와 단가 자동 채움
  if(kind==="stock"){
    const itemSel=$("m-itemId");
    const infoBox=$("m-itemId-info");
    const items=entries.filter(e=>e.kind==="item").sort((a,b)=>(a.itemName||"").localeCompare(b.itemName||"","ko"));
    let html=`<option value="">— 품목 선택 —</option>`;
    items.forEach(it=>{
      const lbl=`${it.itemName||""}${it.spec?" ("+it.spec+")":""}${it.unit?" ["+it.unit+"]":""}`;
      html+=`<option value="${esc(it.id)}">${esc(lbl)}</option>`;
    });
    itemSel.innerHTML=html;
    if(data.itemId) itemSel.value=data.itemId;
    const refreshItemInfo=()=>{
      const it=entries.find(e=>e.id===itemSel.value && e.kind==="item");
      if(!it){ infoBox.style.display="none"; return; }
      const stock=calcStock(it.id);
      infoBox.style.display="";
      infoBox.innerHTML=`<b>📦 ${esc(it.itemName||"")}</b>${it.spec?" · "+esc(it.spec):""}${it.unit?" · "+esc(it.unit):""} <br>
        분야: ${esc(it.field||"-")} · 거래처: ${esc(it.vendor||"-")} · 기본단가: ${it.unitPrice?won(it.unitPrice)+"원":"-"} · 현재재고: <b>${stock}</b>${it.safetyStock?` / 안전 ${it.safetyStock}`:""}`;
      // 단가 자동 채움 (비어있을 때만)
      const upEl=$("m-unitPrice");
      if(upEl && (!upEl.value || Number(upEl.value)===0) && it.unitPrice){
        upEl.value=it.unitPrice;
        // 수량 × 단가 = 금액 자동 계산
        recalcAmount();
      }
    };
    itemSel.addEventListener("change",refreshItemInfo);
    if(data.itemId) refreshItemInfo();
    // 수량/단가 입력 → 금액 자동
    const recalcAmount=()=>{
      const q=Number($("m-qty").value)||0;
      const p=Number($("m-unitPrice").value)||0;
      const a=q*p;
      $("m-amount").value=a;
    };
    $("m-qty").addEventListener("input",recalcAmount);
    $("m-unitPrice").addEventListener("input",recalcAmount);
  }

  // v44: field 타입 — 검색 가능한 input + 초성 자동완성
  document.querySelectorAll("#mFields input[id^='m-']").forEach(inp=>{
    const fieldKey = inp.id.replace("m-","");
    // 끝에 -new, -list 같은 건 제외
    if(fieldKey.endsWith("-new") || fieldKey.endsWith("-list")) return;
    const fieldDef = SCHEMA[kind].find(f=>f.k===fieldKey && f.type==="field");
    if(!fieldDef) return;
    const listEl = $(`m-${fieldKey}-list`);
    const mgrBtn = inp.parentElement.querySelector("[data-fieldmgr]");
    // 기존 값 복원
    if(data[fieldKey]) inp.value = data[fieldKey];
    // 자동완성 UI 연결
    makeFieldSearchUI(inp.id, `m-${fieldKey}-list`, (val)=>{
      // 선택 시 별도 처리 필요시 추가
    });
    if(mgrBtn){
      mgrBtn.addEventListener("click", e=>{
        e.preventDefault();
        openFieldManager(()=>{
          // 닫힌 후 입력칸은 그대로
        });
      });
    }
  });

  if(kind==="work"){
    const fe=$("m-field"), te=$("m-title");
    if(fe&&te){
      const hintBox=document.createElement("div");
      hintBox.id="fieldHint"; hintBox.style.cssText="grid-column:1/-1;font-size:12.5px;color:var(--primary-deep);background:var(--primary-soft);border-radius:9px;padding:8px 11px;display:none";
      te.closest(".field").after(hintBox);
      const showHint=()=>{ const h=FIELD_HINT[fe.value]; if(h){ hintBox.textContent="💡 "+h; hintBox.style.display=""; } else hintBox.style.display="none"; };
      fe.addEventListener("change",showHint);
      fe.addEventListener("input",showHint);  // v44: input도 감지
      showHint();
    }
    // v44: 지출유형에 따른 모달 색상 표시 (자재 칸은 항상 표시)
    const updateExpMode = ()=>{
      const expType = ($("m-expType")||{}).value||"없음";
      const modal = document.querySelector("#overlay .modal");
      if(modal){
        modal.classList.remove("exp-mode-personal","exp-mode-tax","exp-mode-none");
        if(expType==="개인비용") modal.classList.add("exp-mode-personal");
        else if(expType==="후불청구") modal.classList.add("exp-mode-tax");
        else modal.classList.add("exp-mode-none");
      }
      // 금액 필드 표시/숨김 + 라벨 변경
      const costEl = $("m-cost");
      if(costEl){
        const costField = costEl.closest(".field");
        if(costField){
          const isActive = (expType==="개인비용"||expType==="후불청구");
          costField.style.display = isActive ? "" : "none";
          const lbl = costField.querySelector("label");
          if(lbl) lbl.textContent = expType==="후불청구" ? "💰 계약금액 (원)" : "💰 금액 (원)";
        }
      }
    };
    // v44: 자재 자동계산 (개인비용 모드일 때만)
    const calcWorkCost = ()=>{
      const expType = ($("m-expType")||{}).value||"없음";
      if(expType==="후불청구") return; // 후불은 수동 입력
      const qty = Number(($("m-qty")||{}).value)||0;
      const up  = Number(($("m-unitPrice")||{}).value)||0;
      const del = Number(($("m-deliveryFee")||{}).value)||0;
      const costEl = $("m-cost");
      if(costEl && (qty>0||up>0)){
        costEl.value = qty*up + del;
      }
    };
    ["m-qty","m-unitPrice","m-deliveryFee"].forEach(id=>{
      const el=$(id); if(el) el.addEventListener("input", calcWorkCost);
    });
    // expType 변경 → 모드 전환
    const expTypeEl = $("m-expType");
    if(expTypeEl){
      expTypeEl.addEventListener("change", updateExpMode);
      setTimeout(updateExpMode, 100); // 초기 적용
    }
    // v44: 자재명 검색 UI 연결 (선택 시 자재 사양 자동 채움)
    setTimeout(()=>{
      makeMaterialSearchUI('m-material', 'm-material-list', (picked)=>{
        // 자재 사양 자동 채움 (비어있을 때만)
        const specEl = $("m-matSpec");
        if(specEl && picked.spec && !specEl.value.trim()){
          specEl.value = picked.spec;
        }
        // 단위가 있으면 사양에 추가 (사양이 비어있을 때만)
        if(specEl && !specEl.value.trim() && picked.unit){
          specEl.value = `[${picked.unit}]`;
        }
      });
      // v44: 수량 필드 옆에 ➕ 자재 추가 버튼 동적 추가
      const qtyEl = $("m-qty");
      if(qtyEl){
        const qtyWrap = qtyEl.closest(".field");
        if(qtyWrap && !qtyWrap.querySelector(".btn-add-material")){
          const lbl = qtyWrap.querySelector("label");
          if(lbl){
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn-add-material";
            btn.innerHTML = "➕ 자재 추가";
            btn.style.cssText = "margin-left:8px;background:#0369a1;color:#fff;border:none;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;vertical-align:middle";
            btn.addEventListener("click", (e)=>{
              e.preventDefault();
              // 자재명 input에 있는 값을 미리 채움
              const matInp = $("m-material");
              const preFilled = matInp ? (matInp.value||"").trim() : "";
              openNewMaterialModal(preFilled, (newItem)=>{
                // 저장 후 자재명/사양/단위 자동 채움
                if(matInp) matInp.value = newItem.itemName || "";
                const specEl = $("m-matSpec");
                if(specEl){
                  if(newItem.spec) specEl.value = newItem.spec;
                  else if(newItem.unit) specEl.value = `[${newItem.unit}]`;
                }
              });
            });
            lbl.appendChild(btn);
          }
        }
      }
    }, 100);
  }
  // v44: 사고 모달 - 처리 단계 동적 추가
  if(kind==="accident"){
    setTimeout(()=>{
      renderAccidentSteps(data.steps || []);
    }, 100);
  }
  // 예정 모달: 반복 유형에 따른 힌트 표시
  if(kind==="schedule"){
    const stEl=$("m-scheduleType");
    if(stEl){
      // 힌트 박스 삽입
      const hintEl=document.createElement("div");
      hintEl.id="scheduleTypeHint";
      hintEl.style.cssText="grid-column:1/-1;font-size:12px;font-weight:700;padding:8px 12px;border-radius:9px;margin-top:-6px;display:none";
      stEl.closest(".field")&&stEl.closest(".field").after(hintEl);
      const updateHint=()=>{
        const v=stEl.value;
        if(v==="월간반복"){
          hintEl.style.display="";
          hintEl.style.background="#eff6ff"; hintEl.style.color="#185FA5";
          hintEl.textContent="🔁 매월 같은 날짜에 반복 — 알림을 설정하면 매월 자동 알림됩니다";
        } else if(v==="연간반복"){
          hintEl.style.display="";
          hintEl.style.background="#f0fdf4"; hintEl.style.color="#166534";
          hintEl.textContent="📅 매년 같은 날짜에 반복 — 법정검사·계약갱신 등에 활용하세요";
        } else {
          hintEl.style.display="none";
        }
      };
      stEl.addEventListener("change",updateHint);
      updateHint();
    }
  }

  $("overlay").classList.add("show");
  const modalEl=$("overlay").querySelector(".modal"); if(modalEl) modalEl.scrollTop=0;

}

/* v44: 사고 처리 단계 (시간순 조치+업체) 동적 UI */
let _accidentSteps = [];
function renderAccidentSteps(steps){
  _accidentSteps = (steps && Array.isArray(steps)) ? steps.slice() : [];
  // 모달 그리드의 마지막에 처리단계 영역 추가
  const grid = $("mFields");
  if(!grid) return;
  // 기존 영역 제거
  const old = document.getElementById("accStepsArea");
  if(old) old.remove();
  // 새 영역 생성
  const area = document.createElement("div");
  area.id = "accStepsArea";
  area.className = "field full";
  area.style.cssText = "grid-column:1/-1;margin-top:8px;padding:14px;background:#fff8e1;border:2px solid #ffd54f;border-radius:12px";
  area.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <label style="font-weight:800;font-size:14px;color:#7c5e1a;margin:0">📋 처리 단계 (시간순)</label>
      <button type="button" id="btnAddAccStep" style="background:#f59e0b;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer">➕ 단계 추가</button>
    </div>
    <div id="accStepsList" style="display:flex;flex-direction:column;gap:8px"></div>
    <div id="accStepsEmpty" style="display:none;text-align:center;padding:20px;color:#aab8c8;font-size:13px">아직 처리 단계가 없어요 — "➕ 단계 추가" 버튼을 누르세요</div>
  `;
  grid.appendChild(area);
  // 단계 추가 버튼
  document.getElementById("btnAddAccStep").addEventListener("click", ()=>{
    _accidentSteps.push({
      date: todayStr(),
      action: "",
      vendor: "",
      vendorPhone: "",
      memo: ""
    });
    redrawAccStepList();
  });
  redrawAccStepList();
}

function redrawAccStepList(){
  const list = document.getElementById("accStepsList");
  const empty = document.getElementById("accStepsEmpty");
  if(!list) return;
  if(!_accidentSteps.length){
    list.innerHTML = "";
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";
  list.innerHTML = _accidentSteps.map((s,i)=>`
    <div class="acc-step-card" data-idx="${i}" style="background:#fff;border:1.5px solid #ffd54f;border-radius:10px;padding:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:12px">${i+1}단계</span>
        <button type="button" class="acc-step-del" data-idx="${i}" style="background:#fde8e8;color:#b52929;border:none;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer">🗑 삭제</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-bottom:8px">
        <input type="date" class="acc-step-input" data-idx="${i}" data-k="date" value="${esc(s.date||'')}" style="height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff">
        <input type="text" class="acc-step-input" data-idx="${i}" data-k="action" value="${esc(s.action||'')}" placeholder="📝 조치 내용 (예: 누수 확인, 보험사 접수, 시공 완료)" style="height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input type="text" class="acc-step-input" data-idx="${i}" data-k="vendor" value="${esc(s.vendor||'')}" placeholder="🏢 업체명 (예: 삼성화재, 한국방수)" style="height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff">
        <input type="text" class="acc-step-input" data-idx="${i}" data-k="vendorPhone" value="${esc(s.vendorPhone||'')}" placeholder="📞 연락처" style="height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff">
      </div>
      <input type="text" class="acc-step-input" data-idx="${i}" data-k="memo" value="${esc(s.memo||'')}" placeholder="💬 비고 (예: 견적 80만원, 사고번호 ACC-2026, 야간 출동)" style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff">
    </div>
  `).join("");
  // 입력 변경 이벤트
  list.querySelectorAll(".acc-step-input").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const idx = Number(inp.dataset.idx);
      const k = inp.dataset.k;
      if(_accidentSteps[idx]) _accidentSteps[idx][k] = inp.value;
    });
  });
  // 삭제 버튼
  list.querySelectorAll(".acc-step-del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.dataset.idx);
      if(confirm(`${idx+1}단계를 삭제할까요?`)){
        _accidentSteps.splice(idx, 1);
        redrawAccStepList();
      }
    });
  });
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
  /* scan-app 연결 영수증 표시 */
  let scanRefsHtml="";
  if((data.scanRefs||[]).length){
    const chips=data.scanRefs.map(r=>{
      const icon=r.type==='receipt'?'🧾':'💼';
      const label=r.type==='receipt'?'영수증':'명함';
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;background:#e8f0fa;color:#3f7cb8;font-size:12px;font-weight:700;cursor:pointer" data-scan-type="${r.type}" data-scan-id="${r.id}">${icon} ${label}</span>`;
    }).join(' ');
    scanRefsHtml=`<div class="vrow"><div class="vk">🔗 영수증</div><div class="vv" id="vScanRefs">${chips}</div></div>`;
  }
  $("vBody").innerHTML=`<dl>${rows}${photos}${scanRefsHtml}</dl>`;
  /* 영수증 칩 클릭 → 사진 팝업 */
  $("vBody").querySelectorAll('[data-scan-type]').forEach(chip=>{
    chip.addEventListener('click',async()=>{
      const type=chip.dataset.scanType, id=chip.dataset.scanId;
      // scanRefs에서 이미 가진 data 우선 사용
      const cached=(data.scanRefs||[]).find(r=>r.id===id);
      const d=cached&&cached.data ? cached.data : null;
      const photoUrl=d&&d.photoUrl ? d.photoUrl : null;
      const title=(d&&(d.place||d.name))||'영수증';
      if(photoUrl){
        showImg(photoUrl, title);
      } else if(typeof window._fetchScanItem==='function'){
        try{
          const fd=await window._fetchScanItem(type,id);
          if(fd&&fd.photoUrl) showImg(fd.photoUrl, fd.place||fd.name||title);
          else toast('사진 없음');
        }catch(e){ toast('사진 로드 실패'); }
      } else {
        toast('사진 없음');
      }
    });
  });
  $("viewOverlay").classList.add("show");
  const m=$("viewOverlay").querySelector(".modal"); if(m) m.scrollTop=0;
}
function vrow(k,v){ return `<div class="vrow"><div class="vk">${esc(k)}</div><div class="vv">${esc(String(v))}</div></div>`; }
$("vClose").addEventListener("click",()=>$("viewOverlay").classList.remove("show"));
$("vEdit").addEventListener("click",()=>{ $("viewOverlay").classList.remove("show"); openEditor(vKind,vId); });
$("vDel").addEventListener("click",()=>{ if(!vId) return; $("viewOverlay").classList.remove("show"); deleteWithUndo(vId, KIND_LABEL[vKind]||"항목"); });
/* viewOverlay 배경 클릭 닫기 비활성화 */
$("m-cam").addEventListener("change",e=>handleFiles(e,modalPhotos,renderModalThumbs));
$("m-file").addEventListener("change",e=>handleFiles(e,modalPhotos,renderModalThumbs));

/* 업무 모달 scan-app 연결 영수증 */
let _mScanRefs = [];
function renderMScanRefs(){
  const wrap = $("mScanRefs"); if(!wrap) return;
  if(!_mScanRefs.length){ wrap.innerHTML=''; return; }
  wrap.innerHTML = _mScanRefs.map(function(r,idx){
    const d = r.data || {};
    const icon = r.type==='receipt'?'🧾':'💼';
    const title = r.type==='receipt'?(d.place||'영수증'):(d.name||'명함');
    const sub = r.type==='receipt'
      ? ((d.date||'')+(d.amount?(' · '+(d.amount).toLocaleString()+'원'):''))
      : ((d.company||'')+(d.mobile?(' · '+d.mobile):''));
    const photoUrl = d.photoUrl||'';
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#fff;border:1.5px solid #dbe6f4;border-radius:8px;margin-bottom:4px">'
      +(photoUrl
        ?'<img src="'+photoUrl+'" class="zimg" data-title="'+title+'" style="width:48px;height:48px;object-fit:cover;border-radius:6px;cursor:zoom-in">'
        :'<div style="width:48px;height:48px;background:#f0f6ff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px">'+icon+'</div>')
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+icon+' '+esc(title)+'</div>'
        +'<div style="font-size:11px;color:#7a92a8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(sub)+'</div>'
      +'</div>'
      +(photoUrl?'<button type="button" data-view="'+idx+'" style="background:#e8f0fa;border:none;border-radius:6px;padding:6px 10px;font-size:12px;color:#3f7cb8;cursor:pointer;font-family:inherit">🔍</button>':'')
      +'<button type="button" data-rmidx="'+idx+'" style="background:#fde8e8;border:none;border-radius:6px;padding:6px 10px;font-size:12px;color:#b52929;cursor:pointer;font-family:inherit">×</button>'
    +'</div>';
  }).join('');
  wrap.querySelectorAll('[data-rmidx]').forEach(b=>{
    b.addEventListener('click',()=>{ _mScanRefs.splice(parseInt(b.dataset.rmidx),1); renderMScanRefs(); });
  });
  wrap.querySelectorAll('[data-view]').forEach(b=>{
    b.addEventListener('click',()=>{
      const r=_mScanRefs[parseInt(b.dataset.view)];
      if(r&&r.data&&r.data.photoUrl) showImg(r.data.photoUrl,r.data.place||r.data.name||'영수증');
    });
  });
}

/* 업무 모달 scan-app picker 버튼 */
const mScanPickBtn = $("mScanPickBtn");
if(mScanPickBtn){
  mScanPickBtn.addEventListener("click",()=>{
    if(typeof openScanPicker==='function'){
      openScanPicker('receipt', '', function(type,id,data){
        _mScanRefs.push({type,id,data:data||{}});
        renderMScanRefs();
      });
    } else {
      // openScanPicker가 IIFE 안에 있으므로 window 통해 호출
      if(typeof window._openScanPickerForWork==='function'){
        window._openScanPickerForWork(function(type,id,data){
          _mScanRefs.push({type,id,data:data||{}});
          renderMScanRefs();
        });
      } else {
        toast('scan-app picker를 열 수 없습니다');
      }
    }
  });
}

// v44: 모달에 드래그앤드롭 + 클립보드 붙여넣기로 사진 추가
(function setupModalImageInputs(){
  const overlay = $("overlay");
  if(!overlay) return;
  const modal = overlay.querySelector(".modal");
  if(!modal) return;
  // 드래그 오버 - 모달 전체에 시각 효과
  let dragCounter = 0;
  modal.addEventListener("dragenter", e=>{
    if(!overlay.classList.contains("show")) return;
    if(!PHOTO_KINDS.includes(mKind)) return;
    e.preventDefault();
    dragCounter++;
    modal.style.outline = "3px dashed #3f7cb8";
    modal.style.outlineOffset = "-6px";
    modal.style.background = "#eaf3fb";
  });
  modal.addEventListener("dragleave", e=>{
    if(!PHOTO_KINDS.includes(mKind)) return;
    dragCounter--;
    if(dragCounter<=0){
      dragCounter = 0;
      modal.style.outline = "";
      modal.style.outlineOffset = "";
      modal.style.background = "";
    }
  });
  modal.addEventListener("dragover", e=>{
    if(!overlay.classList.contains("show")) return;
    if(!PHOTO_KINDS.includes(mKind)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  modal.addEventListener("drop", e=>{
    if(!overlay.classList.contains("show")) return;
    if(!PHOTO_KINDS.includes(mKind)) return;
    e.preventDefault();
    dragCounter = 0;
    modal.style.outline = "";
    modal.style.outlineOffset = "";
    modal.style.background = "";
    const files = [...(e.dataTransfer.files||[])].filter(f=>f.type.startsWith("image/"));
    if(files.length){
      addPhotos(files, modalPhotos, renderModalThumbs);
      toast(`📷 사진 ${files.length}장 추가됨`);
    }
  });
  // 붙여넣기 (Ctrl+V / Cmd+V)
  modal.addEventListener("paste", e=>{
    if(!overlay.classList.contains("show")) return;
    if(!PHOTO_KINDS.includes(mKind)) return;
    const items = [...(e.clipboardData?.items||[])];
    const files = items
      .filter(it=>it.type.startsWith("image/"))
      .map(it=>it.getAsFile())
      .filter(Boolean);
    if(files.length){
      e.preventDefault();
      addPhotos(files, modalPhotos, renderModalThumbs);
      toast(`📋 클립보드에서 사진 ${files.length}장 추가됨`);
    }
  });
})();
$("mCancel").addEventListener("click",()=>$("overlay").classList.remove("show"));

// ── 탭키: datalist 자동완성 첫 항목 선택 (capture:true로 브라우저 포커스이동 차단) ──
document.addEventListener("keydown", e=>{
  if(e.key!=="Tab") return;
  const overlay = $("overlay");
  if(!overlay || !overlay.classList.contains("show")) return;
  const el = document.activeElement;
  if(!el || el.tagName!=="INPUT") return;
  const listId = el.getAttribute("list");
  if(!listId) return;
  const dl = document.getElementById(listId);
  if(!dl || !dl.options.length) return;
  const typed = (el.value||"").toLowerCase();
  if(!typed) return;
  const match = Array.from(dl.options).find(o=>o.value.toLowerCase().startsWith(typed));
  if(match && match.value !== el.value){
    e.preventDefault();
    e.stopPropagation();
    el.value = match.value;
    el.dispatchEvent(new Event("input"));
  }
}, true);

// ── 엔터: 셀(input) 안에서도, 셀 밖에서도 저장. textarea·select는 기본동작 유지 ──
// Shift+Enter: textarea 안에서 줄바꿈 허용
document.addEventListener("keydown", e=>{
  if(e.key!=="Enter") return;
  const overlay = $("overlay");
  if(!overlay || !overlay.classList.contains("show")) return;
  const tag = (document.activeElement||{}).tagName||"";
  if(tag==="SELECT") return;
  if(tag==="TEXTAREA"){
    if(e.shiftKey) return; // Shift+Enter → 줄바꿈 허용
    e.preventDefault();
    $("mSave").click();
    return;
  }
  if(e.shiftKey) return; // input에서도 Shift+Enter는 무시
  e.preventDefault();
  $("mSave").click();
});
$("mExpLinkBtn")?.addEventListener("click", openExpPick);
$("expPickCancel")?.addEventListener("click",()=>{ document.getElementById("expPickOverlay").style.display="none"; });
$("expPickOverlay")?.addEventListener("click",e=>{ if(e.target===document.getElementById("expPickOverlay")) document.getElementById("expPickOverlay").style.display="none"; });

$("mSave").addEventListener("click",async ()=>{
  try {
  // 업무 모달은 별도 저장 함수로 처리
  if(mKind==="work"){ saveWorkEntry(); return; }
  // ── 맞춤법 검사 대상 kind ──
  const SPELL_CHECK_KINDS = ["call","plan","memo","meeting","deliver","vacation","schedule","accident","cleaning"];
  if(SPELL_CHECK_KINDS.includes(mKind)){
    const apiKey = (typeof aiGetKey==="function") ? aiGetKey() : "";
    if(apiKey){
      // 현재 kind의 text/textarea 필드 수집
      const sc2 = SCHEMA[mKind]||[];
      const checkTexts2 = [];
      sc2.filter(f=>f.type==="text"||f.type==="textarea").forEach(f=>{
        const el=$("m-"+f.k);
        const v = el ? (el.value||"").trim() : "";
        if(v.length>1) checkTexts2.push({field:f.label.replace(/\s*\*$/,""), text:v});
      });
      if(checkTexts2.length){
        const saveBtn2 = $("mSave");
        const origTxt2 = saveBtn2 ? saveBtn2.textContent : "";
        if(saveBtn2){ saveBtn2.disabled=true; saveBtn2.textContent="✍️ 검사 중…"; }
        try{
          const prompt2 = "다음 내용의 맞춤법과 띄어쓰기를 검사해주세요.\n오류가 있으면 JSON으로만 응답하세요. 오류가 없으면 {\"ok\":true} 만 응답하세요.\n\n"
            + checkTexts2.map(function(t){return "["+t.field+"]: "+t.text;}).join("\n")
            + "\n\n응답 형식(오류 있을 때):\n{\"ok\":false,\"items\":[{\"field\":\"필드명\",\"original\":\"원본\",\"corrected\":\"수정본\",\"reason\":\"이유\"}]}";
          const res2 = await fetch("https://api.anthropic.com/v1/messages",{
            method:"POST",
            headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
            body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content:prompt2}]})
          });
          const data2 = await res2.json();
          const raw2 = (data2.content||[]).map(b=>b.text||"").join("").trim();
          let result2;
          try{ result2=JSON.parse(raw2.replace(/```json|```/g,"").trim()); }catch(e){ result2={ok:true}; }
          if(saveBtn2){ saveBtn2.disabled=false; saveBtn2.textContent=origTxt2; }
          if(!result2.ok && (result2.items||[]).length){
            // 맞춤법 오류 팝업 — 확인 후 계속 진행하는 콜백 방식
            await new Promise(resolve=>{
              showSpellCorrectPopup(result2.items||[], resolve, mKind);
            });
          }
        }catch(e2){
          console.warn("[맞춤법 검사]",e2);
          if(saveBtn2){ saveBtn2.disabled=false; saveBtn2.textContent=origTxt2; }
        }
      }
    }
  }
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
    } else if(f.type==="field"){
      // v44: 분야 — input 값 그대로. 신규면 자동 등록
      const inp=$("m-"+f.k);
      v = inp ? inp.value.trim() : "";
      if(v && !FIELDS.includes(v)){
        FIELDS.push(v);
        saveFields();
      }
    } else if(f.type==="catselect"){
      const sel=$("m-"+f.k);
      if(sel && sel.value==="__new__"){
        const inp=$("m-"+f.k+"-new"); v=inp?inp.value.trim():"";
        // 새 카테고리를 목록에 자동 등록
        if(v && CATEGORIES[f.ctx] && !CATEGORIES[f.ctx].includes(v)){ CATEGORIES[f.ctx].push(v); saveCategories(); }
      } else if(sel){ v=sel.value; }
    } else if(f.type==="itemselect"){
      const sel=$("m-"+f.k);
      v=sel?sel.value:"";
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
  /* scan-app 연결 영수증 저장 — photoUrl 등 핵심 data 함께 보존 */
  if(_mScanRefs.length) obj.scanRefs=_mScanRefs.map(r=>({
    type:r.type,
    id:r.id,
    data:r.data ? {
      place:r.data.place||'',
      name:r.data.name||'',
      date:r.data.date||'',
      amount:r.data.amount||0,
      photoUrl:r.data.photoUrl||'',
      photoId:r.data.photoId||''
    } : {}
  }));
  if(mKind==="vacation" && !obj.end) obj.end=obj.start;
  // 업무: 일회성 업체 여부 저장
  if(mKind==="work"){
    const cb=$("m-isOnetime"); obj.isOnetime=cb?cb.checked:false;
  }
  // v44: 사고면 처리 단계 함께 저장
  if(mKind==="accident"){
    obj.steps = (_accidentSteps||[]).filter(s=>s.action||s.vendor||s.memo);
  }
  let savedId=mId;
  if(mId) updateRecord(mId,obj); else { obj.createdAt=Date.now(); if(mKind==="plan") obj.done=false; if(mKind==="filelink"||mKind==="site") obj.starred=false; const nr=addRecord(obj); savedId=nr?nr.id:obj.id; }
  // filelink 수정 시 위치 유지 (renderAll 대신 renderFileLink만)
  if(mKind==="filelink"){ setTimeout(()=>renderFileLink(),50); }
  else if(mKind==="site"){ renderSite(); }
  else renderAll();
  // v44: 업무 저장 후 지출유형이 개인비용/후불청구면 → 지출 모달 자동으로 열기
  // v44-0624: 수정 저장 시에도 연동 (신규=새 지출 등록, 수정=기존 연결 지출이 없으면 새로 등록)
  let _v44OpenExpenseAfter = null;
  if(mKind==="work"){
    const expType = obj.expType||"없음";
    if(expType==="개인비용" || expType==="후불청구"){
      // 수정 시: 이미 연결된 지출이 있으면 건너뜀 (중복 방지)
      const alreadyLinked = mId && typeof entries!=="undefined"
        && entries.some(e=>e.kind==="expense" && e.workId===savedId);
      if(!alreadyLinked){
        _v44OpenExpenseAfter = {
          workObj: obj,
          workId: savedId,
          expType: expType,
          isEdit: !!mId  // 수정인지 신규인지 플래그
        };
      }
    }
  }
  // 업무 저장 시 합계 자동계산 (자동 연동은 v44에서 비활성)
  if(mKind==="work"){ calcWorkTotal(obj); applyExpLinks(savedId); }
  $("overlay").classList.remove("show"); toast(mId?"수정되었습니다":"저장되었습니다");
  // v44: 지출 모달 자동 호출
  if(_v44OpenExpenseAfter){
    setTimeout(()=>openExpenseFromWork(_v44OpenExpenseAfter), 400);
  }
  // 구글캘린더 자동 동기화
  if(typeof window.gcalSync==="function" && typeof accessToken!=="undefined" && accessToken){
    const savedEntry = entries.find(e=>e.id===savedId);
    if(savedEntry && typeof GCAL_IDS!=="undefined" && GCAL_IDS[savedEntry.kind]){
      setTimeout(()=>window.gcalSync(savedEntry), 500);
    }
  }
  } catch(err) {
    console.error('[mSave 오류]', err);
    toast('저장 중 오류: ' + (err && err.message ? err.message : String(err)));
  }
});
$("mDelete").addEventListener("click",()=>{
  if(!mId) return;
  // 업무 삭제 시 연동 expense도 함께 삭제
  if(mKind==="work"){
    const linked=entries.filter(e=>e.kind==="expense"&&e.workId===mId);
    linked.forEach(e=>deleteRecord(e.id));
  }
  $("overlay").classList.remove("show");
  deleteWithUndo(mId, KIND_LABEL[mKind]||"항목");
});
document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>openEditor(b.dataset.add,null)));

/* ===== 검색 ===== */
const Q={work:"",plan:"",memo:"",call:"",vacation:"",meeting:"",deliver:""};
function matchObj(e,q){ if(!q.trim()) return true; const s=Object.entries(e).filter(([k])=>k!=="photos"&&k!=="id"&&k!=="kind").map(([,v])=>String(v)).join(" ").toLowerCase(); return s.includes(q.trim().toLowerCase()); }
const _ws=$("wkSearch"); if(_ws) _ws.addEventListener("input",e=>{ Q.work=e.target.value; renderWork(); });
const _ps=$("planSearch"); if(_ps) _ps.addEventListener("input",e=>{ Q.plan=e.target.value; renderPlan(); });
const _ms=$("memoSearch"); if(_ms) _ms.addEventListener("input",e=>{ Q.memo=e.target.value; renderMemo(); });
const _cs=$("callSearch"); if(_cs) _cs.addEventListener("input",e=>{ Q.call=e.target.value; renderCall(); });
const _vacSearch=$("vacSearch"); if(_vacSearch) _vacSearch.addEventListener("input",e=>{ Q.vacation=e.target.value; renderVac(); });
const _meetSearch=$("meetSearch"); if(_meetSearch) _meetSearch.addEventListener("input",e=>{ Q.meeting=e.target.value; renderMeeting(); });
const _delSearch=$("delSearch"); if(_delSearch) _delSearch.addEventListener("input",e=>{ Q.deliver=e.target.value; renderDeliver(); });
function listOf(kind){ return entries.filter(e=>e.kind===kind && matchObj(e,Q[kind])); }

/* 카드 공통 */
function wireCards(scope, directEdit=false){
  scope.querySelectorAll("[data-id][data-kind]").forEach(el=>{
    el.addEventListener("click",e=>{
      if(e.target.closest("a,img,button,input,.cb")) return;
      if(el.dataset.kind==="cleaning"){ openCleaningEditor(el.dataset.id); return; }
      if(el.dataset.kind==="expense"){ openExpenseEditor(el.dataset.id); return; }
      // directEdit=true면 바로 수정창 (달력에서 사용)
      if(directEdit) openEditor(el.dataset.kind, el.dataset.id);
      else openViewer(el.dataset.kind, el.dataset.id);
    });
    const ed=el.querySelector("[data-edit]"); if(ed) ed.addEventListener("click",e=>{
      e.stopPropagation();
      if(el.dataset.kind==="cleaning") openCleaningEditor(el.dataset.id);
      else if(el.dataset.kind==="expense") openExpenseEditor(el.dataset.id);
      else openEditor(el.dataset.kind, el.dataset.id);
    });
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
  // v42: __new__ 옵션 제외 (필터에는 실제 분야만)
  const fieldOpts = FIELDS.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join("");
  $("fieldFilter").innerHTML=`<option value="전체">분야 전체</option>`+fieldOpts;
  if(fieldFilter!=="전체" && !FIELDS.includes(fieldFilter)) fieldFilter="전체";
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
let wkChecked = new Set(); // 선택된 업무 id

function renderWork(){
  populateWorkFilters();
  const body=$("wkBody"), foot=$("wkFoot");
  const all=entries.filter(e=>e.kind==="work");
  const list=workList();
  const filterOn = Q.work.trim()||statusFilter!=="전체"||wkFrom||wkTo||locFilter!=="전체"||floorFilter!=="전체"||fieldFilter!=="전체";
  $("wkCount").textContent = filterOn ? `${list.length} / 전체 ${all.length}건` : `총 ${all.length}건`;
  // 선택 삭제 버튼 상태 갱신
  const delSelBtn = $("btnWkDelSelected");
  if(delSelBtn) delSelBtn.style.display = wkChecked.size>0 ? "" : "none";
  if(!list.length){ body.innerHTML=`<tr><td colspan="10" class="empty">${all.length?"조건에 맞는 업무가 없습니다.":"아직 입력된 업무가 없습니다."}</td></tr>`; foot.innerHTML=""; return; }
  const allChecked = list.length>0 && list.every(en=>wkChecked.has(en.id));
  body.innerHTML=list.map(en=>`<tr data-id="${en.id}" class="${wkChecked.has(en.id)?"wk-checked":""}">
    <td style="text-align:center;padding:6px 8px"><input type="checkbox" class="wk-chk" data-wid="${en.id}" ${wkChecked.has(en.id)?"checked":""} onclick="event.stopPropagation()"></td>
    <td>${en.date||""}</td>
    <td><span class="st ${statusClass(en.status)}">${esc(en.status||"")}</span></td>
    <td>${esc(en.floor||"")}</td>
    <td>${esc(en.loc||"")}</td>
    <td>${esc(en.title||"")}${(en.photos&&en.photos.length)?" 📷":""}${(en.attachments&&en.attachments.length)?" 📎":""}</td>
    <td><span class="pill ${fieldClass(en.field)}">${esc(en.field||"")}</span></td>
    <td class="num">${en.cost?won(en.cost):""}</td>
    <td>${en.expType&&en.expType!=="없음"?'<span class="pill '+(en.expType==="후불청구"?"amount":"tech")+'" style="font-size:10px">'+(en.expType==="후불청구"?"📃후불":"💸개인")+"</span>":""}</td>
    <td style="text-align:center"><button class="rowdel wk-rowdel-vis" data-del="${en.id}" title="삭제">🗑</button></td></tr>`).join("");
  // 전체선택 체크박스 헤더 동기화
  const thChk = document.querySelector("#panel-work thead .wk-allchk");
  if(thChk) thChk.checked = allChecked;
  const totalCost=list.reduce((s,en)=>s+(Number(en.cost)||0),0);
  foot.innerHTML=`<tr><td></td><td colspan="6" style="background:#33567d;color:#fff;font-weight:700">합계 (${list.length}건)</td><td class="num" style="background:#33567d;color:#fff;font-weight:700">${totalCost?won(totalCost):""}</td><td colspan="2" style="background:#33567d"></td></tr>`;
  body.querySelectorAll("tr[data-id]").forEach(tr=>tr.addEventListener("click",e=>{ if(e.target.closest("[data-del],.wk-chk")) return; openViewer("work",tr.dataset.id); }));
  body.querySelectorAll(".wk-chk").forEach(chk=>chk.addEventListener("change",e=>{
    e.stopPropagation();
    const id = chk.dataset.wid;
    if(chk.checked) wkChecked.add(id); else wkChecked.delete(id);
    chk.closest("tr").classList.toggle("wk-checked", chk.checked);
    const delSelBtn2=$("btnWkDelSelected");
    if(delSelBtn2) delSelBtn2.style.display = wkChecked.size>0 ? "" : "none";
    // 전체선택 체크박스 갱신
    const thChk2=document.querySelector("#panel-work thead .wk-allchk");
    if(thChk2) thChk2.checked = list.every(en=>wkChecked.has(en.id));
  }));
  body.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",e=>{ e.stopPropagation(); deleteWithUndo(b.dataset.del, "업무"); }));
}
function workCopyLine(en){
  const head=((en.floor?en.floor+" ":"")+(en.title||"")).trim();
  const matQty = [en.material, en.qty].filter(Boolean).join(" ") || "";
  const parts=[head, en.detail, matQty, (Number(en.cost)?won(en.cost):"")].map(x=>(x||"").toString().trim()).filter(Boolean);
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
const DIAG_KINDS=[["work","업무"],["plan","오늘계획"],["memo","메모"],["call","통화"],["vacation","휴가"],["meeting","회의메모"],["deliver","전달사항"],["schedule","업무예정"],["item","품목"],["stock","입출고"],["cleaning","청소일지"],["expense","지출"],["filelink","파일링크"],["site","사이트"],["password","비밀번호"]];
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
  work:[["date","날짜"],["status","상태"],["floor","해당층"],["loc","위치"],["title","업무내역"],["detail","세부내용"],["field","분야"],["material","자재"],["qty","수량"],["cost","비용"],["improve","개선사항"]],
  plan:[["date","날짜"],["text","할일"],["done","완료"]],
  memo:[["date","날짜"],["title","제목"],["body","내용"]],
  call:[["date","날짜"],["time","시간"],["dir","구분"],["name","상대"],["phone","전화번호"],["content","통화내용"],["followup","조치"],["done","완료"]],
  vacation:[["name","이름"],["vtype","종류"],["start","시작일"],["end","종료일"],["note","메모"]],
  meeting:[["date","날짜"],["title","제목"],["attendees","참석자"],["body","내용"]],
  deliver:[["date","날짜"],["dtype","전달종류"],["title","제목"],["content","내용"],["done","완료"]],
  schedule:[["date","예정일"],["sStatus","상태"],["sType","종류"],["title","예정내용"],["memo","메모"]],
  item:[["itemCode","품목ID"],["shopId","상품ID"],["itemName","품목명"],["spec","규격"],["unit","단위"],["field","분야"],["maker","제조원"],["vendor","거래처"],["unitPrice","단가"],["safetyStock","안전재고"],["recurring","구매주기"],["location","보관위치"],["memo","메모"]],
  stock:[["date","거래일"],["stockType","구분"],["itemName","품목명"],["spec","규격"],["qty","수량"],["unitPrice","단가"],["amount","금액"],["vendor","거래처"],["docNo","전표번호"],["useTarget","사용처"],["memo","메모"]],
  expense:[["no","NO"],["title","지출내역"],["amount","지출금액"],["date","날짜"],["memo","비고"]],
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
    <button class="mini-btn" data-edit>✏️ 수정</button><button class="mini-btn del" data-del>🗑 삭제</button></div>`;
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
  return `<div class="resp-grid">`+list.map(cardFn).join("")+`</div>`;
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
    <div class="card-acts"><button class="mini-btn" data-edit>✏️ 수정</button><button class="mini-btn del" data-del>🗑 삭제</button></div></div>
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
  if(!list.length){ body.innerHTML=`<tr><td colspan="10" class="empty">통화 기록이 없습니다.</td></tr>`; return; }
  body.innerHTML=list.map(c=>{
    const nameStr = [c.name, c.role, c.company].filter(Boolean).join(" / ");
    return `<tr data-id="${c.id}">
    <td>${c.date||""}</td><td>${esc(c.time||"")}</td>
    <td><span class="dir ${c.dir==="발신"?"out":"in"}">${esc(c.dir||"")}</span></td>
    <td>${esc(nameStr||c.name||"")}</td>
    <td>${c.phone?`<a href="tel:${esc(c.phone)}" class="tel" data-tel="${esc(c.phone)}" title="클릭: 휴대폰은 바로 통화 / PC는 번호 복사">📞 ${esc(c.phone)}</a>`:""}</td>
    <td class="clip" data-tip="${esc(c.content||"")}" title="${esc(c.content||"")}">${esc(c.content||"")}</td>
    <td class="clip" data-tip="${esc(c.followup||"")}" title="${esc(c.followup||"")}">${esc(c.followup||"")}</td>
    <td style="text-align:center"><input type="checkbox" class="ccheck" title="후속조치 완료 표시" ${c.done?"checked":""}></td>
    <td><button class="rowdel" data-del="${c.id}" title="삭제">🗑</button></td></tr>`;
  }).join("");
  body.querySelectorAll("tr[data-id]").forEach(tr=>{
    tr.addEventListener("click",e=>{ if(e.target.closest("a,button,input")) return; openViewer("call",tr.dataset.id); });
    const cb=tr.querySelector(".ccheck"); cb.addEventListener("change",()=>updateRecord(tr.dataset.id,{done:cb.checked}));
    tr.querySelector("[data-del]").addEventListener("click",e=>{ e.stopPropagation(); deleteWithUndo(tr.dataset.id, "통화"); });
    const telLink=tr.querySelector("[data-tel]");
    if(telLink) telLink.addEventListener("click",e=>{
      const num=telLink.dataset.tel;
      const isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if(!isMobile){
        e.preventDefault();
        copyText(num, `📞 ${num} 복사됨 — 휴대폰에서 통화하세요`);
      }
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
    <div class="card-acts"><button class="mini-btn" data-edit>✏️ 수정</button><button class="mini-btn del" data-del>🗑 삭제</button></div></div></div>`;
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
    <div class="card-acts"><button class="mini-btn" data-edit>✏️ 수정</button><button class="mini-btn del" data-del>🗑 삭제</button></div></div>
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
    <div class="card-acts"><button class="mini-btn" data-edit>✏️ 수정</button><button class="mini-btn del" data-del>🗑 삭제</button></div></div>
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
  const expBadge = en.expType&&en.expType!=="없음"
    ? `<span class="pill ${en.expType==="세금계산서"?"amount":"tech"}" style="font-size:10px">${en.expType==="세금계산서"?"📃세금":"💸품의"}</span>` : "";
  return `<div class="row-item" data-kind="work" data-id="${en.id}">
    <div class="grow">
      <div class="t">${esc(en.title||"")} <span class="st ${statusClass(en.status)}">${esc(en.status||"")}</span> <span class="pill ${fieldClass(en.field)}">${esc(en.field||"")}</span>${expBadge}${(en.attachments&&en.attachments.length)?' 📎':''}</div>
      <div class="m">${metaLine([en.floor,en.loc,en.detail,en.cost?won(en.cost)+"원":""])}</div>
      ${thumbsRO(en.photos)}${attachMiniRO(en.attachments)}
      <div class="card-acts"><button class="mini-btn" data-edit>✏️ 수정</button><button class="mini-btn del" data-del>🗑 삭제</button></div>
    </div></div>`;
}

/* ===== 달력 (v21: 업무/스케줄 모드 + 월간/연간 뷰) ===== */
var calY, calM, selDay=null;
var calMode="work";   // "work" or "schedule"
var calView="month";  // "month" or "year"
// v37: 달력 종류별 필터 (true=표시)
const CAL_FILTER = {
  work:true, cleaning:true, cleaning_lead:true, memo:true, call:true, meeting:true,
  deliver:true, vacation:true, expense:true, expense_tax:true, expense_personal:true, expense_voucher:true, plan:true, schedule:true
};
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
  // v37: 달력 종류별 필터 단추
  const filterWrap = $("calFilter");
  if(filterWrap){
    filterWrap.querySelectorAll("button[data-calf]").forEach(b=>{
      b.addEventListener("click",()=>{
        const k = b.dataset.calf;
        if(k==="all"){
          // 전체 토글: 모두 켜있으면 모두 끄기, 아니면 모두 켜기
          const allOn = Object.values(CAL_FILTER).every(v=>v);
          Object.keys(CAL_FILTER).forEach(key=>{ CAL_FILTER[key] = !allOn; });
          filterWrap.querySelectorAll("button[data-calf]").forEach(btn=>{
            btn.classList.toggle("active", !allOn);
          });
        } else {
          CAL_FILTER[k] = !CAL_FILTER[k];
          b.classList.toggle("active", CAL_FILTER[k]);
          // "전체" 단추 상태 갱신
          const allOn = Object.keys(CAL_FILTER).every(key=>CAL_FILTER[key]);
          const allBtn = filterWrap.querySelector('button[data-calf="all"]');
          if(allBtn) allBtn.classList.toggle("active", allOn);
        }
        renderCalendar();
      });
    });
  }
}
function dateLabel(k){ if(!k) return "(날짜없음)"; const [y,m,d]=k.split("-"); const w=["일","월","화","수","목","금","토"][new Date(k+"T00:00:00").getDay()]; return `${Number(m)}월 ${Number(d)}일 (${w})`; }
function otherText(o){
  if(o.kind==="plan") return o.text||"계획";
  if(o.kind==="memo"){
    const t=o.title||"메모";
    const b=(o.body||o.text||"").replace(/\n/g," ");
    return b ? t+" "+b : t;
  }
  if(o.kind==="call"){
    const n=o.name||"통화";
    const c=(o.content||"").replace(/\n/g," ");
    return c ? n+" "+c : n;
  }
  if(o.kind==="meeting") return o.title||"회의";
  if(o.kind==="deliver") return o.title||o.content||"전달";
  if(o.kind==="schedule") return o.title||"예정";
  return "";
}
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
  const work={}, vac={}, other={}, sched={}, cleaning={}, expense={};
  entries.forEach(e=>{
    if(e.kind==="work"&&e.date){ (work[e.date]=work[e.date]||[]).push(e); }
    else if(e.kind==="vacation"){ datesBetween(e.start,e.end).forEach(d=>{ (vac[d]=vac[d]||[]).push(e.name||"휴가"); }); }
    else if(e.kind==="schedule"&&e.date){ (sched[e.date]=sched[e.date]||[]).push(e); }
    else if(e.kind==="cleaning"&&e.date){ (cleaning[e.date]=cleaning[e.date]||[]).push(e); }
    else if(e.kind==="expense"&&e.date){ (expense[e.date]=expense[e.date]||[]).push(e); }
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
        let b=""; sArr.forEach(s=> b+=`<div class="wtitle" data-kind="schedule" data-id="${s.id}"><span class="d" style="background:${scheduleStatusColor(s.sStatus)}"></span><span class="wt">${esc(s.title||"")}${s.sType?" ["+esc(s.sType)+"]":""}</span></div>`);
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR.schedule}">${CAL_KIND_LABEL.schedule} ${sArr.length}</div>${b}</div>`;
      }
      if(vArr.length){
        hasContent=true;
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR.vacation}">${CAL_KIND_LABEL.vacation}</div><div class="vac">${esc(vArr.join(", "))}</div></div>`;
      }
    } else {
      const wArrAll=work[ds]||[]; const vArr=vac[ds]||[]; const oArr=other[ds]||[]; const sArr=sched[ds]||[]; const clArr=cleaning[ds]||[]; const exArr=expense[ds]||[];
      /* 🧹 청소반장 일일업무 분리 (분야 정확히 매칭) */
      const isCleaningLead = (e) => (e.field||'') === '청소반장일일업무';
      const wArr = wArrAll.filter(e=>!isCleaningLead(e));
      const wLeadArr = wArrAll.filter(isCleaningLead);
      // v37: 필터 적용
      if(wArr.length && CAL_FILTER.work){
        hasContent=true;
        let b=""; wArr.forEach(en=> b+=`<div class="wtitle" data-kind="work" data-id="${en.id}"><span class="d" style="background:${statusColor(en.status)}"></span><span class="wt">${esc(((en.floor?en.floor+" ":"")+(en.loc?en.loc+" ":"")+(en.title||"")).trim())}</span></div>`);
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR.work}">${CAL_KIND_LABEL.work} ${wArr.length}</div>${b}</div>`;
      }
      if(wLeadArr.length && CAL_FILTER.cleaning_lead){
        hasContent=true;
        let lb=""; wLeadArr.forEach(en=> lb+=`<div class="wtitle" data-kind="work" data-id="${en.id}"><span class="d" style="background:${statusColor(en.status)}"></span><span class="wt">${esc(((en.floor?en.floor+" ":"")+(en.loc?en.loc+" ":"")+(en.title||"")).trim())}</span></div>`);
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:#1f7a3a">🧹 청소반장 ${wLeadArr.length}</div>${lb}</div>`;
      }
      if(clArr.length && CAL_FILTER.cleaning){
        hasContent=true;
        // 청소 일지의 지시·전달·특기 항목 표시
        let cb = "";
        clArr.forEach(c=>{
          const items = [];
          if(Array.isArray(c.directorOrders)) c.directorOrders.forEach(t=>{ if(t&&t.trim()) items.push("👔 "+t.trim()); });
          if(Array.isArray(c.directives)) c.directives.forEach(t=>{ if(t&&t.trim()) items.push("📌 "+t.trim()); });
          if(Array.isArray(c.specials)) c.specials.forEach(t=>{ if(t&&t.trim()) items.push("⭐ "+t.trim()); });
          items.slice(0,3).forEach(it=>{
            cb += `<div class="otitle" data-kind="cleaning" data-id="${c.id}">${esc(it).slice(0,40)}</div>`;
          });
        });
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:#15803d">🧹 청소 ${clArr.length}</div>${cb}</div>`;
      }
      // 지출: 세금계산서 / 개인지출 / 전표 분리 필터
      const taxArr = exArr.filter(e=>e.expType==="세금계산서");
      const voucherArr = exArr.filter(e=>e.expType==="전표");
      const personalArr = exArr.filter(e=>e.expType!=="세금계산서" && e.expType!=="전표");
      const renderExpGroup = (arr, mode) => {
        if(!arr.length) return;
        if(mode==='tax' && !CAL_FILTER.expense_tax) return;
        if(mode==='voucher' && !CAL_FILTER.expense_voucher) return;
        if(mode==='personal' && !CAL_FILTER.expense_personal) return;
        hasContent=true;
        const icon = mode==='tax'?"📃":(mode==='voucher'?"📋":"💸");
        const color = mode==='tax'?"#c2410c":(mode==='voucher'?"#7c3aed":"#0369a1");
        const label = mode==='tax'?"📃 세금계산서":(mode==='voucher'?"📋 전표":"💸 개인지출");
        let eb="";
        arr.forEach(e=>{
          eb += `<div class="otitle" data-kind="expense" data-id="${e.id}">${icon} ${esc((e.title||"").slice(0,18))} <b style="color:${color}">${won(Number(e.amount)||0)}원</b></div>`;
        });
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${color}">${label} ${arr.length}</div>${eb}</div>`;
      };
      renderExpGroup(taxArr, 'tax');
      renderExpGroup(voucherArr, 'voucher');
      renderExpGroup(personalArr, 'personal');
      if(vArr.length && CAL_FILTER.vacation){
        hasContent=true;
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR.vacation}">${CAL_KIND_LABEL.vacation}</div><div class="vac">${esc(vArr.join(", "))}</div></div>`;
      }
      // 업무 달력에서도 스케줄을 작게 표시
      if(sArr.length && CAL_FILTER.schedule){
        hasContent=true;
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR.schedule}">${CAL_KIND_LABEL.schedule} ${sArr.length}</div>${sArr.map(s=>`<div class="otitle" data-kind="schedule" data-id="${s.id}">${esc(s.title||"")}</div>`).join("")}</div>`;
      }
      OTHER_ORDER.forEach(k=>{
        const arr=oArr.filter(o=>o.kind===k); if(!arr.length) return;
        if(!CAL_FILTER[k]) return; // v37: 필터
        hasContent=true;
        const b=arr.map(o=>`<div class="otitle" data-kind="${o.kind}" data-id="${o.id}">${esc(otherText(o))}</div>`).join("");
        inner+=`<div class="cgrp"><div class="cgrp-h" style="color:${CAL_KIND_COLOR[k]}">${CAL_KIND_LABEL[k]} ${arr.length}</div>${b}</div>`;
      });
    }
    if(hasContent) cls.push("has");
    html+=`<div class="${cls.join(" ")}" data-d="${ds}"><span class="dnum">${d}</span>${inner}</div>`;
  }
  $("calGrid").innerHTML=html;
  $("calGrid").querySelectorAll("[data-d]").forEach(el=>{
    el.addEventListener("click",(e)=>{
      // 개별 항목(wtitle, otitle) 클릭 → 조회창 먼저
      const item = e.target.closest("[data-id][data-kind]");
      if(item){
        e.stopPropagation();
        const kind=item.dataset.kind, id=item.dataset.id;
        if(kind==="cleaning") openCleaningEditor(id);
        else if(kind==="expense") openExpenseEditor(id);
        else openViewer(kind, id);
        return;
      }
      // 빈 셀 또는 날짜 클릭 → 상세보기
      selDay=el.dataset.d; renderCalendar();
    });
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
  /* card-acts 한 줄 강제 스타일 */
  if(!document.getElementById('_cardActsStyle')){
    const st=document.createElement('style');
    st.id='_cardActsStyle';
    st.textContent=`.card-acts{display:flex;flex-direction:row;gap:6px;margin-top:6px;flex-wrap:nowrap}.mini-btn{white-space:nowrap}`;
    document.head.appendChild(st);
  }
  const w=entries.filter(e=>e.kind==="work"&&e.date===selDay).sort(byDateDesc);
  const v=entries.filter(e=>e.kind==="vacation"&&datesBetween(e.start,e.end).includes(selDay));
  const p=entries.filter(e=>e.kind==="plan"&&e.date===selDay);
  const m=entries.filter(e=>e.kind==="memo"&&e.date===selDay).sort(byDateDesc);
  const c=entries.filter(e=>e.kind==="call"&&e.date===selDay);
  const mt=entries.filter(e=>e.kind==="meeting"&&e.date===selDay).sort(byDateDesc);
  const dv=entries.filter(e=>e.kind==="deliver"&&e.date===selDay).sort(byDateDesc);
  const sc=entries.filter(e=>e.kind==="schedule"&&e.date===selDay).sort(byDateDesc);
  const cl=entries.filter(e=>e.kind==="cleaning"&&e.date===selDay).sort(byDateDesc);
  const ex=entries.filter(e=>e.kind==="expense"&&e.date===selDay).sort(byDateDesc);
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
  if(!(w.length||v.length||p.length||m.length||c.length||mt.length||dv.length||sc.length||cl.length||ex.length)){
    box.innerHTML=h+`<div class="empty">이 날의 기록이 없습니다.</div>`; wireRep(); return;
  }
  if(cl.length){
    const clHtml = cl.map(c=>{
      const getDirs = function(c){ if(Array.isArray(c.directives)) return c.directives; var s=c.notes||c.instructions||""; return s?s.split("\n").filter(function(x){return x.trim();}):[];};
      const getSpecs = function(c){ if(Array.isArray(c.specials)) return c.specials; var s=c.special||""; return s?s.split("\n").filter(function(x){return x.trim();}):[];};
      var dirs=getDirs(c), specs=getSpecs(c), parts=[];
      dirs.slice(0,3).forEach(function(t){if(t.trim()) parts.push("📌 "+esc(t));});
      specs.slice(0,3).forEach(function(t){if(t.trim()) parts.push("⭐ "+esc(t));});
      var detail=parts.join(" · ");
      return '<div class="row-item" data-kind="cleaning" data-id="'+c.id+'"><div class="grow"><div class="t">🧹 청소일지 <span class="pill admin">반장 '+esc(c.foreman||"")+'</span></div>'+(detail?'<div class="m" style="font-size:12.5px;line-height:1.6;margin-top:3px">'+detail+'</div>':"")
        +'<div class="card-acts"><button class="mini-btn" data-edit>✏️ 수정</button></div>'
        +"</div></div>";
    });
    h+='<div class="detail-block"><div class="bh">🧹 청소일지</div>'+clHtml.join("")+'</div>';
  }
  if(ex.length){
    const taxEx=ex.filter(e=>e.expType==="세금계산서");
    const perEx=ex.filter(e=>e.expType!=="세금계산서");
    const makeExBlock=(arr,label,color)=>{
      if(!arr.length) return "";
      const rows=arr.map(e=>`<div class="row-item" data-kind="expense" data-id="${e.id}"><div class="grow"><div class="t">${e.expType==="세금계산서"?"📃":"💸"} ${esc(e.title||"")} <span class="pill amount" style="background:${color}20;color:${color}">${won(e.amount||0)}원</span>${e.vendor?` <span style="font-size:12px;color:#888">${esc(e.vendor)}</span>`:""}</div><div class="m">${e.memo?esc(e.memo):""}</div><div class="card-acts"><button class="mini-btn" data-edit>✏️ 수정</button><button class="mini-btn del" data-del>🗑 삭제</button></div></div></div>`).join("");
      return `<div class="detail-block" style="border-left:3px solid ${color}"><div class="bh" style="color:${color}">${label} (${arr.length}건)</div>${rows}</div>`;
    };
    h+=makeExBlock(taxEx,"📃 세금계산서","#c2410c");
    h+=makeExBlock(perEx,"💸 개인지출","#0369a1");
  }
  if(sc.length) h+=`<div class="detail-block"><div class="bh">📅 업무예정</div>${sc.map(cardSchedule).join("")}</div>`;
  if(v.length) h+=`<div class="detail-block"><div class="bh">🌴 휴가</div>${v.map(cardVac).join("")}</div>`;
  if(w.length) h+=`<div class="detail-block"><div class="bh">🛠 업무</div>${w.map(cardWork).join("")}</div>`;
  if(p.length) h+=`<div class="detail-block"><div class="bh">📋 오늘계획</div>${p.map(planItemHTML).join("")}</div>`;
  if(c.length) h+=`<div class="detail-block"><div class="bh">📞 통화</div>${c.map(cc=>`<div class="row-item" data-kind="call" data-id="${cc.id}"><div class="grow"><div class="t">${esc(cc.name||"(상대)")} <span class="dir ${cc.dir==="발신"?"out":"in"}">${esc(cc.dir||"")}</span></div><div class="m">${cc.phone?"☎ "+esc(cc.phone)+" · ":""}${esc(cc.content||"")}</div><div class="card-acts"><button class="mini-btn" data-edit>✏️ 수정</button><button class="mini-btn del" data-del>🗑 삭제</button></div></div></div>`).join("")}</div>`;
  if(m.length) h+=`<div class="detail-block"><div class="bh">📝 메모</div>${m.map(cardMemo).join("")}</div>`;
  if(mt.length) h+=`<div class="detail-block"><div class="bh">👥 회의</div>${mt.map(cardMeeting).join("")}</div>`;
  if(dv.length) h+=`<div class="detail-block"><div class="bh">📢 전달사항</div>${dv.map(cardDeliver).join("")}</div>`;
  box.innerHTML=h;
  wireCards(box, false); // 달력: 클릭 시 조회창 → 수정 버튼으로 수정
  wireRep();
}
function cardSchedule(s){
  const st=s.sStatus||"예정";
  const stCls = st==="완료"?"done":st==="진행중"?"prog":st==="연기"?"etc":"todo";
  return `<div class="row-item" data-kind="schedule" data-id="${s.id}">
    <div class="grow"><div class="t">📅 ${esc(s.title||"")} <span class="st ${stCls}">${esc(st)}</span> <span class="pill etc">${esc(s.sType||"")}</span></div>
    <div class="m">${s.memo?esc(s.memo):""}</div>
    <div class="card-acts"><button class="mini-btn" data-edit>✏️ 수정</button><button class="mini-btn del" data-del>🗑 삭제</button></div></div>
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
  const cl=entries.filter(e=>e.kind==="cleaning"&&D(e.date)===day).sort(byDateDesc);
  /* 날짜 한 줄로 크게 표시, 출력일 제거 */
  const dayObj = new Date(day);
  const weekNames = ['일','월','화','수','목','금','토'];
  const dayNum = dayObj.getDate();
  const weekName = weekNames[dayObj.getDay()];
  const monthNum = dayObj.getMonth()+1;
  let h=`<div style="display:flex;align-items:center;gap:16px;margin-bottom:8px">`
    +`<span style="font-size:48px;font-weight:900;color:#1a2f45;line-height:1">${dayNum}</span>`
    +`<span style="font-size:22px;font-weight:800;color:#1a2f45">${monthNum}월 ${dayNum}일 (${weekName}) 업무일지 보고서</span>`
    +`</div><hr style="border:none;border-top:2px solid #1a2f45;margin:6px 0 12px">`;
  const sec=(title,items,cls)=> items.length?`<div class="rsec ${cls}"><h2>${title} (${items.length}건)</h2>`+items.join("")+`</div>`:"";
  h+=sec("업무", w.map(en=>`<div class="it"><b>[${esc(en.status||"")}]</b> ${esc(en.floor||"")} ${esc(en.loc||"")} ${esc(en.title||"")}${en.detail?" — "+esc(en.detail):""}${en.field?" ["+esc(en.field)+"]":""}${en.material?" / 자재: "+esc(en.material):""}${Number(en.cost)?" / "+won(en.cost)+"원":""}${en.improve?"<br>↳ 개선: "+esc(en.improve):""}</div>`), "work");
  h+=sec("휴가", v.map(x=>`<div class="it">🌴 ${esc(x.name||"")} (${esc(x.vtype||"")}) ${x.end&&x.end!==x.start?esc(x.start)+" ~ "+esc(x.end):esc(x.start||"")}${x.note?" — "+esc(x.note):""}</div>`), "vac");
  h+=sec("오늘계획", p.map(x=>`<div class="it">${x.done?"☑":"☐"} ${esc(x.text||"")}</div>`), "plan");
  h+=sec("통화", c.map(x=>`<div class="it">[${esc(x.dir||"")}] ${esc(x.time||"")} ${esc(x.name||"")} ${esc(x.phone||"")} — ${esc(x.content||"")}${x.followup?" / 조치: "+esc(x.followup):""}${x.done?" (완료)":""}</div>`), "call");
  h+=sec("메모", m.map(x=>`<div class="it"><b>${esc(x.title||"메모")}</b> ${esc(x.body||"")}</div>`), "memo");
  h+=sec("회의메모", mt.map(x=>`<div class="it"><b>${esc(x.title||"회의")}</b>${x.attendees?" (참석: "+esc(x.attendees)+")":""}<br>${esc(x.body||"")}</div>`), "meet");
  h+=sec("전달사항", dv.map(x=>`<div class="it">📢 <b>${esc(x.title||"")}</b> ${esc(x.content||"")}</div>`), "deliver");
  if(cl.length){
    const clItems=cl.map(x=>{
      const dirs=Array.isArray(x.directives)?x.directives:(x.notes||x.instructions?(x.notes||x.instructions).split("\n").filter(s=>s.trim()):[]);
      const specs=Array.isArray(x.specials)?x.specials:(x.special?x.special.split("\n").filter(s=>s.trim()):[]);
      let s=`<div class="it"><b>반장: ${esc(x.foreman||"")}</b>`;
      if(dirs.length) s+=`<br>📌 지시사항: ${dirs.map(d=>esc(d)).join(" / ")}`;
      if(specs.length) s+=`<br>⭐ 특기사항: ${specs.map(d=>esc(d)).join(" / ")}`;
      if(x.instructions&&!dirs.length) s+=`<br>📢 전달사항: ${esc(x.instructions)}`;
      const issues=(x.staffWork||[]).filter(sw=>sw.special&&sw.special.trim());
      if(issues.length) s+=`<br>⚠ 담당자: ${issues.map(sw=>esc(sw.name)+"-"+esc(sw.special)).join(" / ")}`;
      return s+"</div>";
    });
    h+=sec("청소일지", clItems, "cleaning");
  }
  if(!(w.length||v.length||p.length||m.length||c.length||mt.length||dv.length||cl.length)) h+=`<div class="it">이 날의 기록이 없습니다.</div>`;
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

/* 서희타워 운영 → 서희타워 운영 1/2/3 마이그레이션 */
const TOWER_GROUPS_DEF = [
  { label:"서희타워 운영 1", keys:["업무일지","경비업무일지","주간회의록","회의록","사무관련","사무","경비"] },
  { label:"서희타워 운영 2", keys:["견적","계약","관리"] },
  { label:"서희타워 운영 3", keys:["도면","보험증권","발주서"] },
];
function getTowerGroupLabel(item){
  const t=(item.label||item.path||"").toLowerCase();
  for(const g of TOWER_GROUPS_DEF){
    if(g.keys.some(k=>t.includes(k.toLowerCase()))) return g.label;
  }
  return "서희타워 운영 1";
}
function migrateTowerCats(){
  const LS_KEY = "tower_migrated_v4";
  if(localStorage.getItem(LS_KEY)) return;

  const toMigrate = entries.filter(e=>e.kind==="filelink"&&
    (e.category==="서희타워 운영"||e.category==="서희타워 운영 1"||
     e.category==="서희타워 운영 2"||e.category==="서희타워 운영 3"));

  if(!toMigrate.length){ localStorage.setItem(LS_KEY,"1"); return; }

  // entries를 직접 동기 수정 (렌더링 즉시 반영)
  let changed=0;
  toMigrate.forEach(e=>{
    const newCat = getTowerGroupLabel(e);
    if(e.category!==newCat){
      e.category = newCat; // entries 직접 수정
      if(online&&db) db.collection(COL).doc(e.id).update({category:newCat}).catch(()=>{});
      changed++;
    }
  });

  ["서희타워 운영 1","서희타워 운영 2","서희타워 운영 3"].forEach(c=>{
    if(!CATEGORIES.filelink.includes(c)) CATEGORIES.filelink.push(c);
  });
  CATEGORIES.filelink = CATEGORIES.filelink.filter(c=>c!=="서희타워 운영");
  saveCategories();
  lsSave(); // localStorage도 즉시 반영
  localStorage.setItem(LS_KEY,"1");

  if(changed>0){
    renderFileLink();
    toast(`✅ 서희타워 운영 카테고리 1/2/3 분리 완료 (${changed}개)`);
  }
  console.log("서희타워 마이그레이션 완료:", changed+"개");
}
function sortItems(kind, list){
  const s=VIEW_PREFS[kind].sort;
  const nameKey = kind==="filelink" ? "label" : "name";
  const cmp=(a,b)=>{
    if(s==="recent") return (b.lastOpenedAt||0)-(a.lastOpenedAt||0) || (a[nameKey]||"").localeCompare(b[nameKey]||"","ko");
    if(s==="created") return (b.createdAt||0)-(a.createdAt||0) || (a[nameKey]||"").localeCompare(b[nameKey]||"","ko");
    return (a[nameKey]||"").localeCompare(b[nameKey]||"","ko");
  };
  if(kind==="filelink"){
    // flOrder에 저장된 순서가 있으면 → 저장 순서 우선 (수정 후 위치 유지)
    const hasOrder = list.some(e=>flOrder.cards[e.id]);
    if(hasOrder){
      return list.sort((a,b)=>{
        const oa = flOrder.cards[a.id] ? flOrder.cards[a.id].order : 9999;
        const ob = flOrder.cards[b.id] ? flOrder.cards[b.id].order : 9999;
        if(oa!==ob) return oa-ob;
        // 같은 order면 폴더 먼저
        const fa=isFolder(a.path,a.ptype)?0:1;
        const fb=isFolder(b.path,b.ptype)?0:1;
        if(fa!==fb) return fa-fb;
        return cmp(a,b);
      });
    }
    return list.sort((a,b)=>{
      const fa=isFolder(a.path,a.ptype)?0:1;
      const fb=isFolder(b.path,b.ptype)?0:1;
      if(fa!==fb) return fa-fb;
      return cmp(a,b);
    });
  }
  return list.sort(cmp);
}

/* ===== 파일링크 탭 ===== */

/* =========================================================
   드래그 앤 드롭 — 점검일지 카드/카테고리 순서
   Firebase: filelink_order / doc: "order"
   ========================================================= */
const FL_ORDER_COL = "filelink_order";
const FL_ORDER_LS  = "fl_order_v1";
let flOrder = { catOrder:[], cards:{} }; // {catOrder:[catName,...], cards:{id:{cat,order}}}

async function loadFlOrder(){
  try{
    const ls = JSON.parse(localStorage.getItem(FL_ORDER_LS)||"null");
    if(ls) flOrder = ls;
  }catch(e){}
  if(!online||!db) return;
  try{
    const snap = await db.collection(FL_ORDER_COL).doc("order").get();
    if(snap.exists){
      flOrder = snap.data();
      try{ localStorage.setItem(FL_ORDER_LS, JSON.stringify(flOrder)); }catch(e){}
    }
  }catch(e){ console.warn("flOrder 로드 실패:", e); }
}

async function saveFlOrder(){
  try{ localStorage.setItem(FL_ORDER_LS, JSON.stringify(flOrder)); }catch(e){}
  if(!online||!db) return;
  try{
    await db.collection(FL_ORDER_COL).doc("order").set(flOrder);
  }catch(e){ console.warn("flOrder 저장 실패:", e); }
}

// 카드에 저장된 순서/카테고리 정보 가져오기
function getCardMeta(id){ return flOrder.cards[id]||null; }
function setCardMeta(id, cat, order){ flOrder.cards[id]={cat,order}; }

// 카테고리 순서 적용
function applyFlOrder(orderedCats){
  if(!flOrder.catOrder||!flOrder.catOrder.length) return orderedCats;
  const saved = flOrder.catOrder.filter(c=>orderedCats.includes(c));
  const extra = orderedCats.filter(c=>!saved.includes(c));
  return [...saved, ...extra];
}

// 카드 순서 적용 (카테고리 내)
function applyCardOrder(cat, items){
  if(!items||!items.length) return items||[];
  const withOrder = items.map(e=>{
    const m = getCardMeta(e.id);
    return { e, order: (m&&m.cat===cat) ? m.order : 9999 };
  });
  withOrder.sort((a,b)=>a.order-b.order);
  return withOrder.map(x=>x.e);
}

/* ── 드래그 앤 드롭 바인딩 ── */
let dragItem=null, dragType=null; // dragType: "card"|"cat"
let dragOverEl=null;

function bindDnD(box){
  // 드래그 중인 카드를 어느 위치에 삽입할지 판단 (X/Y 모두 계산 - 그리드 대응)
  function getDropTarget(container, clientX, clientY){
    const cards = [...container.querySelectorAll(".link-card[data-fid]")].filter(c=>c!==dragItem);
    if(!cards.length) return {before: null};
    // 각 카드의 중심점과 거리 계산
    let closest = null, closestDist = Infinity, insertBefore = true;
    for(const card of cards){
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);
      if(dist < closestDist){
        closestDist = dist;
        closest = card;
        // 같은 행이면 X로 판단, 다른 행이면 Y로 판단
        const sameRow = Math.abs(clientY - cy) < rect.height * 0.6;
        insertBefore = sameRow ? clientX < cx : clientY < cy;
      }
    }
    if(!closest) return {before: null};
    return {before: insertBefore ? closest : null, after: !insertBefore ? closest : null};
  }

  // ── 카테고리 헤더 드래그 ──
  box.querySelectorAll(".cat-group").forEach(grp=>{
    const hdr = grp.querySelector(".cat-group-h");
    hdr.setAttribute("draggable","true");
    hdr.style.cursor="grab";
    hdr.addEventListener("dragstart", e=>{
      dragType="cat"; dragItem=grp;
      grp.classList.add("dnd-dragging");
      e.dataTransfer.effectAllowed="move";
    });
    hdr.addEventListener("dragend", ()=>{
      dragType=null; dragItem=null;
      box.querySelectorAll(".dnd-dragging,.dnd-over-cat").forEach(el=>el.classList.remove("dnd-dragging","dnd-over-cat"));
    });
    grp.addEventListener("dragover", e=>{
      if(dragType!=="cat"||dragItem===grp) return;
      e.preventDefault();
      box.querySelectorAll(".dnd-over-cat").forEach(el=>el.classList.remove("dnd-over-cat"));
      grp.classList.add("dnd-over-cat");
    });
    grp.addEventListener("drop", e=>{
      if(dragType!=="cat"||dragItem===grp) return;
      e.preventDefault();
      const allGrps = [...box.querySelectorAll(".cat-group")];
      const toIdx   = allGrps.indexOf(grp);
      const fromIdx = allGrps.indexOf(dragItem);
      if(fromIdx<0||toIdx<0) return;
      if(fromIdx<toIdx) grp.after(dragItem); else grp.before(dragItem);
      flOrder.catOrder = [...box.querySelectorAll(".cat-group")].map(g=>g.dataset.cat);
      saveFlOrder();
      grp.classList.remove("dnd-over-cat");
    });
  });

  // ── 카드 드래그 ──
  box.querySelectorAll(".link-card[data-fid]").forEach(card=>{
    card.setAttribute("draggable","true");
    card.addEventListener("dragstart", e=>{
      if(e.target.closest("[data-star],[data-edit]")){ e.preventDefault(); return; }
      dragType="card"; dragItem=card;
      card.classList.add("dnd-dragging");
      e.dataTransfer.effectAllowed="move";
      e.dataTransfer.setData("text/plain", card.dataset.fid);
    });
    card.addEventListener("dragend", ()=>{
      dragType=null; dragItem=null;
      box.querySelectorAll(".dnd-dragging,.dnd-over-card,.dnd-over-catitems,.dnd-insert-before,.dnd-insert-after").forEach(el=>{
        el.classList.remove("dnd-dragging","dnd-over-card","dnd-over-catitems","dnd-insert-before","dnd-insert-after");
      });
      box.querySelectorAll(".dnd-line").forEach(el=>el.remove());
    });
  });

  // ── cat-items 영역 드롭 처리 (정확한 삽입 위치) ──
  box.querySelectorAll(".cat-items").forEach(ci=>{
    ci.addEventListener("dragover", e=>{
      if(dragType!=="card") return;
      e.preventDefault();
      // 삽입 위치 표시선 업데이트
      box.querySelectorAll(".dnd-line").forEach(el=>el.remove());
      const {before, after} = getDropTarget(ci, e.clientX, e.clientY);
      const line = document.createElement("div");
      line.className="dnd-line";
      line.style.cssText="height:3px;background:var(--primary);border-radius:3px;margin:2px 0;pointer-events:none;grid-column:1/-1";
      const refNode = before || (after ? after.nextSibling : null);
      if(refNode) ci.insertBefore(line, refNode);
      else ci.appendChild(line);
      ci.classList.add("dnd-over-catitems");
    });
    ci.addEventListener("dragleave", e=>{
      if(!ci.contains(e.relatedTarget)){
        ci.classList.remove("dnd-over-catitems");
        box.querySelectorAll(".dnd-line").forEach(el=>el.remove());
      }
    });
    ci.addEventListener("drop", e=>{
      if(dragType!=="card"||!dragItem) return;
      e.preventDefault();
      ci.classList.remove("dnd-over-catitems");
      box.querySelectorAll(".dnd-line").forEach(el=>el.remove());

      const fromId     = dragItem.dataset.fid;
      const fromCatGrp = dragItem.closest(".cat-group,.fav-section");
      const toCatGrp   = ci.closest(".cat-group,.fav-section");
      const toCat      = toCatGrp ? toCatGrp.dataset.cat : null;
      const fromCat    = fromCatGrp ? fromCatGrp.dataset.cat : null;

      // 정확한 위치에 삽입
      const {before, after} = getDropTarget(ci, e.clientX, e.clientY);
      if(before && before !== dragItem) ci.insertBefore(dragItem, before);
      else if(after && after !== dragItem) after.after(dragItem);
      else ci.appendChild(dragItem);

      // 카테고리/즐겨찾기 변경 처리
      const fromIsFav = fromCatGrp&&fromCatGrp.classList.contains("fav-section");
      const toIsFav   = toCatGrp&&toCatGrp.classList.contains("fav-section");
      if(toIsFav && !fromIsFav){
        updateRecord(fromId, {starred:true});
        toast(`⭐ "${entries.find(x=>x.id===fromId)?.label||""}" 즐겨찾기 추가`);
      } else if(fromIsFav && !toIsFav && toCat){
        updateRecord(fromId, {starred:false, category:toCat});
        toast(`"${entries.find(x=>x.id===fromId)?.label||""}" → ${toCat} 이동`);
      } else if(!toIsFav && toCat && toCat !== fromCat){
        updateRecord(fromId, {category:toCat});
        toast(`"${entries.find(x=>x.id===fromId)?.label||""}" → ${toCat} 이동`);
      }

      // 순서 저장
      [...ci.querySelectorAll(".link-card[data-fid]")].forEach((c,i)=>{
        setCardMeta(c.dataset.fid, toCat||"", i);
      });
      saveFlOrder();
      dragItem=null;
    });
  });
}
function wireFileLinkTab(){
  const _fileSearch=$("fileSearch"); if(_fileSearch) _fileSearch.addEventListener("input",e=>{ CAT_FILTER.filelink.q=e.target.value; renderFileLink(); });
  const _fileCatFilter=$("fileCatFilter"); if(_fileCatFilter) _fileCatFilter.addEventListener("change",e=>{ CAT_FILTER.filelink.cat=e.target.value; CAT_FILTER.filelink.sub="전체"; renderFileLink(); });
  const _btnFileCatMgr=$("btnFileCatMgr"); if(_btnFileCatMgr) _btnFileCatMgr.addEventListener("click",()=>openCatMgr("filelink"));
  // 보기 드롭다운
  const vsel=$("fileLinkViewSelect");
  if(vsel){
    vsel.value = VIEW_PREFS.filelink.mode||"card";
    vsel.addEventListener("change",()=>{
      VIEW_PREFS.filelink.mode=vsel.value; saveViewPrefs(); renderFileLink();
    });
  }
  // 소분류 드롭다운
  const subSel=$("fileSubFilter");
  if(subSel){
    subSel.addEventListener("change",()=>{
      CAT_FILTER.filelink.sub=subSel.value; renderFileLink();
    });
  }
  // 종류 드롭다운
  const typeSel=$("fileTypeSelect");
  if(typeSel){
    typeSel.value=CAT_FILTER.filelink.type||"all";
    typeSel.addEventListener("change",()=>{
      CAT_FILTER.filelink.type=typeSel.value;
      // 숨겨진 버튼 동기화
      document.querySelectorAll("#fileTypeFilter button").forEach(b=>{
        b.classList.toggle("active", b.dataset.ft===typeSel.value);
      });
      renderFileLink();
    });
  }
  // 폴더/파일 종류 필터 (숨겨진 버튼 - 하위 호환)
  document.querySelectorAll("#fileTypeFilter button").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("#fileTypeFilter button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    CAT_FILTER.filelink.type=b.dataset.ft;
    if(typeSel) typeSel.value=b.dataset.ft;
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
  if(!box) return;
  if(!subs.length){ box.innerHTML=`<option value="전체">소분류 전체</option>`; box.style.display="none"; return; }
  box.style.display="";
  let html=`<option value="전체">소분류 전체 (${baseList.length})</option>`;
  html+=subs.map(s=>`<option value="${esc(s)}">${esc(s)} (${cnt[s]})</option>`).join("");
  box.innerHTML=html;
  box.value=CAT_FILTER.filelink.sub;
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
  // 보기 드롭다운 동기화
  const vsel=$("fileLinkViewSelect");
  if(vsel && vsel.value!==VIEW_PREFS.filelink.mode) vsel.value=VIEW_PREFS.filelink.mode||"card";
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
  // 즐겨찾기: 위에 별도 섹션으로 표시 (카테고리 목록에도 동시 표시)
  const favs = list.filter(e=>e.starred);
  // 카테고리별 묶기 (즐겨찾기 포함 전체)
  const groups={};
  list.forEach(e=>{
    const c=e.category||"(미분류)";
    if(!groups[c]) groups[c]=[];
    groups[c].push(e);
  });
  // 카테고리 순서 (저장된 순서 우선 → CATEGORIES 순서 → 가나다)
  // 빈 카테고리도 포함해서 표시
  let orderedCats=[...CATEGORIES.filelink];
  Object.keys(groups).forEach(c=>{ if(!orderedCats.includes(c)) orderedCats.push(c); });
  orderedCats = applyFlOrder(orderedCats);
  // 점프 메뉴
  const jumpGroups={};
  if(favs.length) jumpGroups["⭐ 즐겨찾기"]=favs;
  orderedCats.forEach(c=>{ jumpGroups[c]=groups[c]; });
  // 점프 메뉴 미사용
  if($("fileCatJump")) $("fileCatJump").innerHTML="";
  // 본문
  const mode=VIEW_PREFS.filelink.mode;
  const compact=VIEW_PREFS.filelink.compact;
  box.className=`view-${mode}${mode==="card"&&compact?" compact":""}`;
  let html="";
  // 즐겨찾기 섹션
  if(favs.length){
    const orderedFavs = applyCardOrder("__fav__", favs);
    html+=`<div class="fav-section" data-cat="__fav__"><div class="fs-h">⭐ 즐겨찾기 <span class="fs-cnt">${favs.length}</span></div>
      <div class="cat-items">${orderedFavs.map(e=>fileLinkCardHTML(e)).join("")}</div></div>`;
  }
  // 카테고리별 - 서희타워 운영 5개 초과시 자동 분할, 소형 카테고리 묶기
  const CAT_ICONS_MAP={"전기":"⚡","소방":"🔥","기계":"❄️","기계/냉난방":"❄️","서희타워 운영":"🏢","사무관련":"📋","비용관련":"💰","공적업무":"📌","용역":"🔧","개인용도":"👤","승강기":"🛗","청소":"🧹","경비":"🛡️","행정":"📋"};
  
  // 카테고리별 독립 처리 (서희타워 운영 1/2/3은 마이그레이션으로 이미 분리됨)
  const expandedCats=[];
  orderedCats.forEach(c=>{
    const items=groups[c];
    expandedCats.push({cat:c, origCat:c, items:applyCardOrder(c, items||[])});
  });

  html+=expandedCats.map(({cat,origCat,items})=>{
    const collapsed=VIEW_PREFS.filelink.collapsed[origCat];
    const colorClass=catColorClass("filelink",origCat);
    const items2 = items||[];
    const folders=items2.filter(e=>isFolder(e.path,e.ptype));
    const files=items2.filter(e=>!isFolder(e.path,e.ptype));
    let inner="";
    if(!items2.length){
      inner=`<div class="cat-items"><div style="padding:12px;color:var(--ink-soft);font-size:13px;text-align:center">➕ 파일 추가를 눌러 이 카테고리에 항목을 추가하세요</div></div>`;
    } else {
      if(folders.length){
        inner+=`<div class="grp-sublabel">📁 폴더 <span class="gs-cnt">${folders.length}</span></div>`;
        inner+=`<div class="cat-items">${folders.map(e=>fileLinkCardHTML(e)).join("")}</div>`;
      }
      if(files.length){
        inner+=`<div class="grp-sublabel">📄 파일 <span class="gs-cnt">${files.length}</span></div>`;
        inner+=`<div class="cat-items">${files.map(e=>fileLinkCardHTML(e)).join("")}</div>`;
      }
    }
    const catIco = CAT_ICONS_MAP[origCat]||"📁";
    return `<div class="cat-group ${colorClass}${collapsed?" collapsed":""}" data-cat="${esc(cat)}" data-origcat="${esc(origCat)}" data-label="${esc(cat)}">
      <div class="cat-group-h"><span class="ch-arrow">▼</span><span>${catIco}</span> <span class="ch-label">${esc(cat)}</span><span class="ch-cnt">${items.length}</span><button class="ch-rename" data-cat="${esc(origCat)}" data-dispcat="${esc(cat)}" title="이름 변경">✏️</button></div>
      ${inner}</div>`;
  }).join("");
  box.innerHTML=html;
  // 이벤트
  box.querySelectorAll(".cat-group-h").forEach(h=>{
    h.addEventListener("click", e=>{
      if(e.target.closest(".ch-rename")) return;
      const g=h.parentElement; const cat=g.dataset.cat;
      VIEW_PREFS.filelink.collapsed[cat]=!VIEW_PREFS.filelink.collapsed[cat];
      saveViewPrefs(); g.classList.toggle("collapsed");
    });
  });
  // 카테고리 이름 변경
  box.querySelectorAll(".ch-rename").forEach(btn=>{
    btn.addEventListener("click", e=>{
      e.stopPropagation();
      const origCat = btn.dataset.cat;
      const grp = btn.closest(".cat-group");
      const curLabel = grp.dataset.label||origCat;
      const newName = prompt(`"${curLabel}" 카테고리 이름 변경:`, curLabel);
      if(!newName||newName===curLabel) return;
      // CATEGORIES에서 이름 변경
      const idx = CATEGORIES.filelink.indexOf(origCat);
      if(idx>=0){ CATEGORIES.filelink[idx]=newName; saveCategories(); }
      // 해당 카테고리 항목들 일괄 변경
      const toChange = entries.filter(e=>e.kind==="filelink"&&e.category===origCat);
      toChange.forEach(e=>updateRecord(e.id,{category:newName}));
      toast(`"${origCat}" → "${newName}" 변경됨 (${toChange.length}개 항목)`);
      renderFileLink();
    });
  });
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
  // 드래그 앤 드롭 바인딩
  bindDnD(box);
}
function fileLinkCardHTML(e){
  const tt=`${e.label||""}\n${e.path||""}${e.memo?"\n"+e.memo:""}`;
  const folder=isFolder(e.path, e.ptype);
  const badge=folder
    ? `<span class="lc-typebadge tb-folder">📁 폴더</span>`
    : `<span class="lc-typebadge tb-file">📄 파일</span>`;
  return `<div class="link-card${folder?" is-folder":""}${e.starred?" starred":""}" data-fid="${e.id}" data-cat="${esc(e.category||"")}" title="${esc(tt)}">
    <span class="lc-icon">${fileIcon(e.path, e.ptype, e.label)}</span>
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
  const _ss=$("siteSearch"); if(_ss) _ss.addEventListener("input",e=>{ CAT_FILTER.site.q=e.target.value; renderSite(); });
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
  rest.forEach(e=>{ var c=e.category||"(미분류)"; if(c==="개인용도"||c==="기타") c="(미분류)"; if(!groups[c]) groups[c]=[]; groups[c].push(e); });
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
      <div class="cat-group-h pw-cat-hdr" data-cat="${esc(c)}" style="display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;user-select:none">
        <span class="ch-arrow" style="font-size:14px;transition:transform .2s;display:inline-block;${collapsed?'transform:rotate(-90deg)':''}">▾</span>
        <span style="font-size:15px;font-weight:800;letter-spacing:-.3px">${esc(c)}</span>
        <span style="background:rgba(255,255,255,.3);border-radius:20px;padding:2px 10px;font-size:13px;font-weight:700">${items.length}</span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">
          <!-- 전체접기 -->
          <button class="pw-hdr-btn" data-pvcollapse="${esc(c)}" title="접기/펼치기" style="width:36px;height:36px;border-radius:10px;border:none;background:rgba(255,255,255,.25);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
          <!-- 카드형 -->
          <button class="pw-hdr-btn pw-view-btn ${VIEW_PREFS.password.mode==='card'?'pw-view-active':''}" data-pvmode="card" title="카드형" style="width:36px;height:36px;border-radius:10px;border:none;background:rgba(255,255,255,.25);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </button>
          <!-- 목록형 -->
          <button class="pw-hdr-btn pw-view-btn ${VIEW_PREFS.password.mode==='list'?'pw-view-active':''}" data-pvmode="list" title="목록형" style="width:36px;height:36px;border-radius:10px;border:none;background:rgba(255,255,255,.25);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
          </button>
        </div>
      </div>
      <div class="cat-items">${items.map(e=>siteCardHTML(e)).join("")}</div></div>`;
  }).join("");
  box.innerHTML=html;
  box.querySelectorAll(".cat-group-h").forEach(h=>h.addEventListener("click",(ev)=>{
    if(ev.target.closest(".view-mode-group")) return;
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
  /* catMgrOverlay 배경 클릭 닫기 비활성화 */
  $("catAddBtn").addEventListener("click",catAddNew);
  $("catNewName").addEventListener("keydown",e=>{ if(e.key==="Enter") catAddNew(); });
}

// v37: 분야 관리 모달
let fieldMgrOnClose = null;
function openFieldManager(onClose){
  fieldMgrOnClose = onClose || null;
  renderFieldMgrList();
  $("fieldMgrOverlay").classList.add("show");
  $("fieldMgrNew").value = "";
  setTimeout(()=>$("fieldMgrNew").focus(), 100);
}
function closeFieldManager(){
  $("fieldMgrOverlay").classList.remove("show");
  if(fieldMgrOnClose) fieldMgrOnClose();
  fieldMgrOnClose = null;
}
function renderFieldMgrList(){
  const box = $("fieldMgrList");
  if(!FIELDS.length){
    box.innerHTML = `<div class="empty" style="padding:14px">등록된 분야가 없습니다.</div>`;
    return;
  }
  box.innerHTML = FIELDS.map((f,i)=>{
    // 해당 분야 사용 건수
    const cnt = entries.filter(e=>(e.kind==="work"||e.kind==="item") && e.field===f).length;
    return `<div class="cat-row" data-i="${i}">
      <span class="pill ${fieldClass(f)}" style="min-width:50px;text-align:center">${esc(f)}</span>
      <span style="flex:1;font-size:12px;color:var(--ink-soft)">${cnt}건 사용 중</span>
      <button data-act="up" title="위로">▲</button>
      <button data-act="down" title="아래로">▼</button>
      <button class="danger" data-act="del" title="삭제">🗑</button>
    </div>`;
  }).join("");
  box.querySelectorAll(".cat-row").forEach(row=>{
    const i = Number(row.dataset.i);
    row.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>{
      const a = b.dataset.act;
      if(a==="up" && i>0){
        [FIELDS[i-1], FIELDS[i]] = [FIELDS[i], FIELDS[i-1]];
        saveFields(); renderFieldMgrList();
      } else if(a==="down" && i<FIELDS.length-1){
        [FIELDS[i+1], FIELDS[i]] = [FIELDS[i], FIELDS[i+1]];
        saveFields(); renderFieldMgrList();
      } else if(a==="del"){
        const f = FIELDS[i];
        const cnt = entries.filter(e=>(e.kind==="work"||e.kind==="item") && e.field===f).length;
        let msg = `"${f}" 분야를 삭제하시겠어요?`;
        if(cnt>0) msg += `\n\n⚠ 이 분야를 사용 중인 ${cnt}건이 "기타"로 자동 변경됩니다.`;
        if(!confirm(msg)) return;
        FIELDS.splice(i,1);
        // 기존 데이터 "기타"로 변경
        if(cnt>0){
          if(!FIELDS.includes("기타")) FIELDS.push("기타");
          entries.forEach(e=>{
            if((e.kind==="work"||e.kind==="item") && e.field===f){
              e.field = "기타";
              // Firestore 동기화
              if(online && db) db.collection(COL).doc(e.id).set(e).catch(()=>{});
            }
          });
          lsSave();
        }
        saveFields();
        renderFieldMgrList();
        renderAll();
        toast(`"${f}" 분야 삭제됨${cnt>0?` (${cnt}건이 "기타"로 변경)`:""}`);
      }
    }));
  });
}
function fieldMgrAddNew(){
  const v = ($("fieldMgrNew").value||"").trim();
  if(!v){ toast("분야 이름을 입력하세요"); return; }
  if(FIELDS.includes(v)){ toast("이미 있는 분야예요"); return; }
  FIELDS.push(v);
  saveFields();
  renderFieldMgrList();
  $("fieldMgrNew").value = "";
  $("fieldMgrNew").focus();
  toast(`✅ "${v}" 분야 추가됨`);
}
function wireFieldMgr(){
  $("fieldMgrClose").addEventListener("click", closeFieldManager);
  $("fieldMgrOverlay").addEventListener("click", e=>{
    if(e.target===$("fieldMgrOverlay")) closeFieldManager();
  });
  $("fieldMgrAddBtn").addEventListener("click", fieldMgrAddNew);
  $("fieldMgrNew").addEventListener("keydown", e=>{ if(e.key==="Enter") fieldMgrAddNew(); });
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

  // 목록형 CSS 동적 추가
  if(!document.getElementById('pw-list-style')){
    const st=document.createElement('style'); st.id='pw-list-style';
    st.textContent=`
      .pw-list-table{width:100%;border-collapse:collapse;font-size:13px}
      .pw-list-table th{background:#f0f6ff;padding:9px 12px;text-align:left;font-weight:700;color:#33567d;border-bottom:2px solid #dbe6f4;white-space:nowrap}
      .pw-list-table td{padding:9px 12px;border-bottom:1px solid #f0f6ff;color:#1a2f45;vertical-align:middle}
      .pw-list-table tr:hover td{background:#f7faff}
      .pw-list-table .pw-mini-btn{padding:3px 8px;font-size:11px;border:1px solid #dbe6f4;border-radius:6px;background:#fff;cursor:pointer}
      .pw-hdr-btn:hover{background:rgba(255,255,255,.45)!important}
      .pw-view-active{background:rgba(255,255,255,.5)!important;box-shadow:0 0 0 2px rgba(255,255,255,.6)}
    `;
    document.head.appendChild(st);
  }
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
  rest.forEach(e=>{ var c=e.category||"(미분류)"; if(!groups[c]) groups[c]=[]; groups[c].push(e); });
  // 업무시스템만 표시, 나머지 제외
  const orderedCats=["업무시스템"].filter(c=>groups[c]);
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
      <div class="cat-group-h pw-cat-hdr" data-cat="${esc(c)}" style="display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;user-select:none">
        <span class="ch-arrow" style="font-size:14px;transition:transform .2s;display:inline-block;${collapsed?'transform:rotate(-90deg)':''}">▾</span>
        <span style="font-size:15px;font-weight:800;letter-spacing:-.3px">${esc(c)}</span>
        <span style="background:rgba(255,255,255,.3);border-radius:20px;padding:2px 10px;font-size:13px;font-weight:700">${items.length}</span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">
          <!-- 전체접기 -->
          <button class="pw-hdr-btn" data-pvcollapse="${esc(c)}" title="접기/펼치기" style="width:36px;height:36px;border-radius:10px;border:none;background:rgba(255,255,255,.25);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
          <!-- 카드형 -->
          <button class="pw-hdr-btn pw-view-btn ${VIEW_PREFS.password.mode==='card'?'pw-view-active':''}" data-pvmode="card" title="카드형" style="width:36px;height:36px;border-radius:10px;border:none;background:rgba(255,255,255,.25);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </button>
          <!-- 목록형 -->
          <button class="pw-hdr-btn pw-view-btn ${VIEW_PREFS.password.mode==='list'?'pw-view-active':''}" data-pvmode="list" title="목록형" style="width:36px;height:36px;border-radius:10px;border:none;background:rgba(255,255,255,.25);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
          </button>
        </div>
      </div>
      <div class="cat-items" data-cat-items="${esc(c)}" style="${VIEW_PREFS.password.mode==='list'?'':'display:flex;flex-wrap:wrap;gap:10px;padding:10px 0'}">
        ${VIEW_PREFS.password.mode==='list'?`
        <table class="pw-list-table">
          <thead><tr><th>사이트명</th><th>카테고리</th><th>아이디</th><th>비밀번호</th><th>URL</th><th>메모</th><th></th></tr></thead>
          <tbody>${items.map(e=>`<tr data-pid="${e.id}">
            <td style="font-weight:600">${e.starred?'⭐ ':''}${esc(e.name||'')}</td>
            <td><span style="background:#eaf1fb;color:#3f7cb8;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700">${esc(e.category||'')}</span></td>
            <td data-fields-user>-</td><td data-fields-pw>-</td><td data-fields-url>-</td><td data-fields-memo>-</td>
            <td style="white-space:nowrap"><button class="pw-mini-btn" data-pact="edit">수정</button> <button class="pw-mini-btn" data-pact="del" style="color:#e74c3c">삭제</button></td>
          </tr>`).join('')}</tbody>
        </table>`:items.map(pwCardPlaceholder).join("")}
      </div></div>`;
  }).join("");
  box.innerHTML=html;

  // 접기 이벤트
  box.querySelectorAll(".pw-cat-hdr").forEach(h=>h.addEventListener("click",(ev)=>{
    if(ev.target.closest("[data-pvmode],[data-pvcollapse]")) return;
    const g=h.parentElement; const cat=g.dataset.cat||h.dataset.cat;
    VIEW_PREFS.password.collapsed[cat]=!VIEW_PREFS.password.collapsed[cat];
    saveViewPrefs(); g.classList.toggle("collapsed");
    const items=g.querySelector(".cat-items");
    if(items) items.style.display=g.classList.contains("collapsed")?"none":"";
    const arrow=h.querySelector(".ch-arrow");
    if(arrow) arrow.style.transform=g.classList.contains("collapsed")?"rotate(-90deg)":"";
  }));
  // 접기 버튼 개별 클릭
  box.querySelectorAll("[data-pvcollapse]").forEach(btn=>{
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      const g=btn.closest(".cat-group"); const cat=btn.dataset.pvcollapse;
      VIEW_PREFS.password.collapsed[cat]=!VIEW_PREFS.password.collapsed[cat];
      saveViewPrefs(); g.classList.toggle("collapsed");
      const items=g.querySelector(".cat-items");
      if(items) items.style.display=g.classList.contains("collapsed")?"none":"";
      const arrow=g.querySelector(".ch-arrow");
      if(arrow) arrow.style.transform=g.classList.contains("collapsed")?"rotate(-90deg)":"";
    });
  });
  // 초기 접힘 상태 반영
  box.querySelectorAll(".cat-group.collapsed .cat-items").forEach(el=>el.style.display="none");

  // 카드/목록 전환
  box.querySelectorAll("[data-pvmode]").forEach(btn=>{
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      VIEW_PREFS.password.mode=btn.dataset.pvmode;
      saveViewPrefs(); pwRenderList();
    });
  });

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
    const fb=card?card.querySelector("[data-fields]"):null;
    if(fb) fb.innerHTML=fieldsHTML;

    // 목록형 복호화 + 이벤트
    const tr=box.querySelector(`tr[data-pid="${e.id}"]`);
    if(tr){
      const uEl=tr.querySelector("[data-fields-user]");
      if(uEl) uEl.innerHTML=data.username?`${esc(data.username)} <button class="pw-mini-btn" data-copy="${esc(data.username).replace(/"/g,"&quot;")}" data-label="아이디">📋</button>`:"-";
      const pwEl=tr.querySelector("[data-fields-pw]");
      if(pwEl){
        const sh=pwShownIds.has(e.id);
        pwEl.innerHTML=data.password
          ? `<span style="${sh?'':'font-family:monospace'}">${sh?esc(data.password):"••••••"}</span> <button class="pw-mini-btn" data-toggle>${sh?"🙈":"👁"}</button> <button class="pw-mini-btn" data-copy="${esc(data.password).replace(/"/g,"&quot;")}" data-label="비밀번호">📋</button>`
          : "-";
        pwEl.querySelector("[data-toggle]")?.addEventListener("click",()=>{ if(pwShownIds.has(e.id)) pwShownIds.delete(e.id); else pwShownIds.add(e.id); pwRenderList(); });
        pwEl.querySelector("[data-copy]")?.addEventListener("click",function(){ copyText(this.dataset.copy, this.dataset.label+" 복사됨"); });
      }
      const urlEl=tr.querySelector("[data-fields-url]");
      if(urlEl) urlEl.innerHTML=data.url?`<a href="${esc(normUrl(data.url))}" target="_blank" style="color:var(--primary-deep)">${esc(data.url)}</a>`:"-";
      const mEl=tr.querySelector("[data-fields-memo]");
      if(mEl) mEl.textContent=data.memo||"-";
      /* 행 자체 클릭 → 보기 팝업 (수정/삭제/복사/토글 버튼은 제외) */
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', function(ev){
        if(ev.target.closest('[data-pact],[data-copy],[data-toggle],button,a')) return;
        console.log('[pw-row click] id=', e.id, 'openPwViewer=', typeof window.openPwViewer);
        if(typeof window.openPwViewer === 'function'){
          window.openPwViewer(e.id);
        } else {
          console.warn('[pw-row] openPwViewer 미정의');
        }
      });
      // 수정/삭제 이벤트
      tr.querySelectorAll("[data-pact]").forEach(b=>b.addEventListener("click",async ev=>{
        ev.stopPropagation();
        if(b.dataset.pact==="edit") pwOpenEditor(e.id);
        else if(b.dataset.pact==="del"){
          if(!confirm(`"${e.name}" 비밀번호를 삭제하시겠습니까?`)) return;
          deleteWithUndo(e.id,"비밀번호");
        }
      }));
    }

    // 카드형 이벤트
    if(fb){
      fb.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",()=>{
        if(pwShownIds.has(e.id)) pwShownIds.delete(e.id); else pwShownIds.add(e.id);
        pwRenderList();
      }));
      fb.querySelectorAll("[data-copy]").forEach(b=>b.addEventListener("click",()=>{
        copyText(b.dataset.copy, b.dataset.label+" 복사됨");
      }));
    }
    if(card) {
      /* 카드 자체 클릭 → 보기 팝업 (내부 버튼 제외) */
      card.style.cursor = 'pointer';
      card.addEventListener('click', function(ev){
        if(ev.target.closest('[data-pact],[data-copy],[data-toggle],button,a')) return;
        console.log('[pw-card click] id=', e.id, 'openPwViewer=', typeof window.openPwViewer);
        if(typeof window.openPwViewer === 'function'){
          window.openPwViewer(e.id);
        } else {
          console.warn('[pw-card] openPwViewer 미정의');
        }
      });
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
    } /* if(card) close */
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


/* =========================================================
   v22: 자재 관리 (품목 마스터 + 입출고 + 재고 자동계산)
   ========================================================= */
const MAT_FILTER = { tab:"stock", field:"전체", q:"", recurring:"전체", lowOnly:false };

// 품목별 현재 재고 계산
function calcStock(itemId){
  if(!itemId) return 0;
  let s=0;
  entries.forEach(e=>{
    if(e.kind==="stock" && e.itemId===itemId){
      const q=Number(e.qty)||0;
      if(e.stockType==="입고") s+=q;
      else if(e.stockType==="출고") s-=q;
    }
  });
  return s;
}

// 품목 ID 자동 생성 (M0001 형식)
function nextItemCode(){
  const used=entries.filter(e=>e.kind==="item"&&/^M\d+$/.test(e.itemCode||"")).map(e=>parseInt(e.itemCode.slice(1)));
  const n=used.length?Math.max(...used)+1:1;
  return "M"+String(n).padStart(4,"0");
}

function wireMaterialTab(){
  // 탭 토글 (재고/품목/입출고)
  document.querySelectorAll("[data-mattab]").forEach(b=>b.addEventListener("click",()=>{
    MAT_FILTER.tab=b.dataset.mattab;
    document.querySelectorAll("[data-mattab]").forEach(x=>x.classList.toggle("active",x===b));
    renderMaterial();
  }));
  const _mats=$("matSearch"); if(_mats) _mats.addEventListener("input",e=>{ MAT_FILTER.q=e.target.value; renderMaterial(); });
  $("matFieldFilter").addEventListener("change",e=>{ MAT_FILTER.field=e.target.value; renderMaterial(); });
  $("matRecFilter").addEventListener("change",e=>{ MAT_FILTER.recurring=e.target.value; renderMaterial(); });
  $("matLowToggle").addEventListener("click",()=>{
    MAT_FILTER.lowOnly=!MAT_FILTER.lowOnly;
    $("matLowToggle").classList.toggle("active",MAT_FILTER.lowOnly);
    renderMaterial();
  });
  $("btnAddItem").addEventListener("click",()=>openEditor("item",null));
  $("btnAddStock").addEventListener("click",()=>openEditor("stock",null));
  $("btnMatExcel").addEventListener("click",matExcelCopy);
  $("btnAIExtract").addEventListener("click",aiExtractDialog);
  $("matFileUpload").addEventListener("change",handleMatFileUpload);
}

function extractJsonFromAIReply(reply, expectArray){
  if(!reply) throw new Error("AI 응답이 비어있습니다");
  let s = reply.trim();
  // 1) ```json ... ``` 코드블럭 안에 들어있으면 추출
  const codeBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if(codeBlock) s = codeBlock[1].trim();
  // 2) 배열을 기대하면 [ ... ], 객체면 { ... } 첫 매칭
  if(expectArray){
    const m = s.match(/\[[\s\S]*\]/);
    if(m) s = m[0];
  } else {
    const m = s.match(/\{[\s\S]*\}/);
    if(m) s = m[0];
  }
  try{
    return JSON.parse(s);
  }catch(e){
    // 단일 따옴표 → 쌍따옴표 변환 시도
    try{
      const fixed = s.replace(/(\w+)'(\w+)/g,"$1__APOS__$2").replace(/'/g,'"').replace(/__APOS__/g,"'");
      return JSON.parse(fixed);
    }catch(e2){
      throw new Error(`AI 응답에서 JSON을 찾을 수 없어요. 응답 앞부분: "${reply.slice(0,80)}..."`);
    }
  }
}


async function handleMatFileUpload(e){
  const file = e.target.files&&e.target.files[0];
  e.target.value = "";
  if(!file) return;
  if(typeof XLSX === "undefined"){ toast("엑셀 라이브러리 로드 실패 — 새로고침해주세요"); return; }
  const key=(aiGetKey()||"").trim();
  if(!key){ toast("자가진단·AI 탭에서 API 키부터 저장해주세요"); activateTab("ai"); return; }
  if(!/^[\x20-\x7E]+$/.test(key)){ toast("⚠ API 키에 잘못된 문자가 있어요. AI 탭에서 재저장하세요"); return; }
  // 1) 파일 첨부 알림
  toast(`📎 "${file.name}" 파일 첨부됨 — 읽는 중...`);
  try{
    // 2) 엑셀 파싱
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:"array"});
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if(!sheet || !sheet["!ref"]){ toast("❌ 엑셀이 비어있습니다"); return; }
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const totalRows = range.e.r - range.s.r;
    if(totalRows<=0){ toast("❌ 데이터가 없습니다"); return; }
    // 3) 첫 5행 미리보기
    const aoa = XLSX.utils.sheet_to_json(sheet, {header:1, raw:false, defval:""});
    const preview = aoa.slice(0, 6).map((r,i)=>`${i===0?"📋":(i+"·")} ${r.slice(0,7).join(" | ").slice(0,80)}`).join("\n");
    toast(`✅ ${totalRows}행 로드 완료`, 2500);
    // 4) 구매 날짜 입력 받기
    const todayDefault = todayStr();
    const dateInput = prompt(
`📎 ${file.name}\n📊 ${totalRows}행 데이터\n\n┌── 미리보기 ──┐\n${preview}\n└──────────┘\n\n📅 이 구매내역의 날짜를 입력하세요 (YYYY-MM-DD)\n→ 모든 행이 이 날짜로 입고 처리됩니다.`,
      todayDefault
    );
    if(!dateInput){ toast("취소되었습니다"); return; }
    const purchaseDate = dateInput.trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)){
      toast("❌ 날짜 형식이 잘못되었습니다 (예: 2026-05-29)");
      return;
    }
    // 5) TSV 변환
    const txt = XLSX.utils.sheet_to_csv(sheet, {FS:"\t", RS:"\n", strip:true});
    if(!txt || !txt.trim()){ toast("❌ 변환된 데이터가 비어있습니다"); return; }
    // 6) 길이 자르기
    const MAX_CHARS = 80000;
    let dataText = txt;
    let trimmed = false;
    if(dataText.length > MAX_CHARS){
      dataText = dataText.slice(0, MAX_CHARS) + "\n...(이하 생략)";
      trimmed = true;
    }
    toast(`🤖 AI 분석 중... ${totalRows}행${trimmed?" (일부만)":""} — 30초~1분 소요`, 5000);
    // 7) AI 분석 — 구매내역 전용
    await aiExtractPurchase(dataText, purchaseDate, key);
  }catch(err){
    logErr("엑셀 파일 분석", err);
    console.error("엑셀 분석 상세 에러:", err);
    toast(`❌ ${err.message||"파일 처리 실패"}`, 5000);
  }
}

// 구매내역 전용 AI 추출 (엑셀 → 품목 등록 + 입고 처리)
async function aiExtractPurchase(txt, purchaseDate, key){
  const sys = `당신은 서브원(SERVEONE) 같은 쇼핑몰의 구매 엑셀 데이터를 분석하는 도우미입니다. 반드시 JSON 배열만 응답하세요. 다른 설명·인사말·코드블럭 표시 모두 금지. 응답은 [로 시작해서 ]로 끝나야 합니다.

각 행은 한 번의 구매(입고)입니다. 추출할 필드:
{"shopId":"상품ID","itemName":"품목명","spec":"규격(핵심만 간단히)","unit":"단위(EA/BOX/ROL/PR 등)","maker":"제조원","qty":수량,"unitPrice":단가,"amount":총액}

중요 규칙:
- shopId: "상품ID","상품코드","제품번호" 컬럼의 값 그대로. 없으면 빈 문자열.
- itemName: "상품명","품명","제품명" 컬럼.
- spec: "규격" 컬럼에서 핵심만 추려 짧게. 예: "SR끈;15mm*100m;재생;포장용;SR;300g;300g" → "15mm×100m 재생". 너무 긴 옵션 나열 금지.
- unit: "1EA", "1BOX", "1ROL", "1PR" 같은 값은 숫자 떼고 단위만 ("EA","BOX","ROL","PR"). "1BOX(5000SH)" 같은 건 "BOX" 만.
- maker: "제조원","메이커" 컬럼.
- qty, unitPrice, amount: 숫자만. 콤마/공백 제거.
- "총액","합계" 컬럼은 amount로.
- 통화단위(KRW 등) 컬럼은 완전히 무시.
- StockNo 컬럼도 무시.
- 다른 설명 없이 JSON 배열만 답하세요.
- 예: [{"shopId":"6573068","itemName":"소프트밴드","spec":"15mm×100m 재생","unit":"ROL","maker":"(주)동원피앤아이","qty":5,"unitPrice":2430,"amount":12150}]`;

  const res=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:AI_MODEL, max_tokens:8000, system:sys, messages:[{role:"user",content:txt}]})
  });
  if(!res.ok){ const j=await res.json().catch(()=>({})); throw new Error(j?.error?.message||`HTTP ${res.status}`); }
  const data=await res.json();
  const reply=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n").trim();
  console.log("AI 응답 (처음 500자):", reply.slice(0,500));
  console.log("AI 응답 (마지막 200자):", reply.slice(-200));
  let arr;
  try{
    arr = extractJsonFromAIReply(reply, true);
  }catch(e){
    console.error("JSON 파싱 실패. AI 전체 응답:", reply);
    throw new Error(`JSON 파싱 실패. F12 콘솔에서 'AI 전체 응답' 확인. 첫 부분: "${reply.slice(0,100)}"`);
  }
  if(!Array.isArray(arr)||!arr.length){ toast("AI가 데이터를 추출하지 못했습니다"); return; }

  // 신규 품목 / 기존 품목 분리
  let newItemsCount = 0, existingItemsCount = 0;
  arr.forEach(row=>{
    if(!row.itemName) return;
    const matched = entries.find(e=>e.kind==="item" && (
      (row.shopId && e.shopId===row.shopId) ||
      (!row.shopId && (e.itemName||"").trim()===(row.itemName||"").trim())
    ));
    if(matched) existingItemsCount++;
    else newItemsCount++;
  });
  const totalAmount = arr.reduce((s,r)=>s+(Number(r.amount)||Number(r.qty)*Number(r.unitPrice)||0),0);
  const confirmMsg = `📊 분석 완료\n\n📅 구매일자: ${purchaseDate}\n📦 총 ${arr.length}건\n  · 신규 품목 자동 등록: ${newItemsCount}건\n  · 기존 품목 매칭: ${existingItemsCount}건\n💰 총 구매금액: ${won(totalAmount)}원\n\n이대로 진행할까요?`;
  if(!confirm(confirmMsg)) return;

  // 신규 등록 + 입고 처리
  let addedItems = 0, addedStocks = 0;
  for(const row of arr){
    if(!row.itemName) continue;
    // 품목 매칭 (shopId 우선 → 품목명)
    let item = entries.find(e=>e.kind==="item" && (
      (row.shopId && e.shopId===row.shopId) ||
      (!row.shopId && (e.itemName||"").trim()===(row.itemName||"").trim())
    ));
    if(!item){
      item = addRecord({
        kind:"item",
        itemCode: nextItemCode(),
        shopId: row.shopId||"",
        itemName: row.itemName||"",
        spec: row.spec||"",
        unit: row.unit||"",
        field: "기타",
        maker: row.maker||"",
        vendor: "서브원",
        unitPrice: Number(row.unitPrice)||0,
        safetyStock: 0,
        recurring: "비주기",
        location: "",
        memo: `엑셀 구매내역에서 자동 등록 (${purchaseDate})`,
        createdAt: Date.now()
      });
      addedItems++;
    }
    // 입고 처리
    const qty = Number(row.qty)||0;
    const up = Number(row.unitPrice)||0;
    const amt = Number(row.amount) || (qty*up);
    if(qty>0){
      addRecord({
        kind:"stock",
        date: purchaseDate,
        stockType: "입고",
        itemId: item.id,
        qty,
        unitPrice: up,
        amount: amt,
        vendor: "서브원",
        docNo: "",
        useTarget: "",
        memo: `엑셀 구매내역`,
        createdAt: Date.now()
      });
      addedStocks++;
    }
  }
  renderMaterial();
  toast(`✅ 완료! 신규 품목 ${addedItems}건, 입고 ${addedStocks}건 등록`, 5000);
}

// AI 추출 공통 로직 (텍스트와 파일 둘 다에서 호출)
async function aiExtractFromText(txt, type, key){
  const sys = type==="stock"
    ? `당신은 엑셀 데이터를 분석해 자재 입출고 내역을 추출하는 도우미입니다. 반드시 JSON 배열만 응답하세요. 다른 설명, 인사말, 코드블럭 표시(\`\`\`) 모두 금지. 응답은 [로 시작해서 ]로 끝나야 합니다.

각 항목의 필드:
{"date":"YYYY-MM-DD","stockType":"입고|출고","itemName":"품목명","spec":"규격(간단히)","unit":"단위","qty":숫자,"unitPrice":숫자,"amount":숫자,"vendor":"거래처","maker":"제조원","docNo":"전표번호","useTarget":"사용처","memo":"메모"}
- stockType: "구매","매입","입고" 같은 단어 → "입고", "사용","출고","불출" → "출고". 명시 없으면 "입고".
- 날짜: 다양한 형식을 YYYY-MM-DD로. 연도 없으면 ${calY}.
- 숫자: 콤마/공백 제거. 빈값은 0.
- 규격은 핵심만 간략히 (전체 옵션 나열하지 말고 핵심 1~2개만).
- 예: [{"date":"2026-05-01","stockType":"입고","itemName":"점보롤","qty":10}]`
    : `당신은 엑셀 데이터를 분석해 자재 품목 마스터를 추출하는 도우미입니다. 반드시 JSON 배열만 응답하세요. 다른 설명, 인사말, 코드블럭 표시(\`\`\`) 모두 금지. 응답은 [로 시작해서 ]로 끝나야 합니다.

각 항목의 필드:
{"shopId":"상품ID(엑셀의 상품ID 또는 상품코드 컬럼 값을 그대로)","itemName":"품목명","spec":"규격을 간단히 핵심만","unit":"단위","field":"전기|소방|기계|통신|영선|주차|청소|기타","maker":"제조원","vendor":"거래처/공급업체","unitPrice":숫자,"safetyStock":숫자,"recurring":"비주기|월간|분기|반기|연간|수시","location":"보관위치","memo":"메모"}

중요한 규칙:
- shopId: 엑셀의 "상품ID", "상품코드", "제품번호" 같은 컬럼 값을 그대로. 없으면 빈 문자열.
- spec(규격): 핵심 정보만 추려서 짧게 (예: "300mm×100m·재생" / 전체 옵션 나열 금지)
- unit: "1EA", "1BOX", "1ROL", "1PR" 같은 형식은 단위 부분만 추출 ("EA", "BOX", "ROL", "PR")
- field: 품목 성격으로 추정. 청소용품 → "청소", 전기재 → "전기", 모르면 "기타".
- maker: "제조원" 또는 "메이커" 컬럼.
- vendor: "거래처", "구매처", "공급업체" 컬럼. 없으면 빈 문자열.
- recurring: 명시 없으면 "비주기".
- 통화단위(KRW 등)는 무시. 총액 컬럼도 무시(단가만 사용).
- 예: [{"shopId":"6573068","itemName":"소프트밴드","spec":"SR끈;15mm*100m","unit":"ROL","maker":"(주)동원피앤아이","unitPrice":2430,"field":"기타"}]`;
  const res=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:AI_MODEL, max_tokens:8000, system:sys, messages:[{role:"user",content:txt}]})
  });
  if(!res.ok){ const j=await res.json().catch(()=>({})); throw new Error(j?.error?.message||`HTTP ${res.status}`); }
  const data=await res.json();
  const reply=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n").trim();
  console.log("AI 응답 (처음 500자):", reply.slice(0,500));
  console.log("AI 응답 (마지막 200자):", reply.slice(-200));
  let arr;
  try{
    arr = extractJsonFromAIReply(reply, true);
  }catch(e){
    console.error("JSON 파싱 실패. AI 전체 응답:", reply);
    throw new Error(`JSON 파싱 실패. F12 콘솔에서 'AI 전체 응답' 확인. 첫 부분: "${reply.slice(0,100)}"`);
  }
  if(!Array.isArray(arr)||!arr.length){ toast("AI가 데이터를 추출하지 못했습니다"); return; }
  if(!confirm(`AI가 ${arr.length}건을 추출했습니다.\n그대로 추가할까요?`)) return;
  // 추가
  let added=0;
  if(type==="item"){
    for(const it of arr){
      if(!it.itemName) continue;
      addRecord({
        kind:"item",
        itemCode:it.itemCode||nextItemCode(),
        shopId:it.shopId||"",
        itemName:it.itemName||"",
        spec:it.spec||"",
        unit:it.unit||"",
        field:it.field||"기타",
        maker:it.maker||"",
        vendor:it.vendor||"",
        unitPrice:Number(it.unitPrice)||0,
        safetyStock:Number(it.safetyStock)||0,
        recurring:it.recurring||"비주기",
        location:it.location||"",
        memo:it.memo||"",
        createdAt:Date.now()
      });
      added++;
    }
  } else {
    for(const t of arr){
      if(!t.itemName) continue;
      let item=entries.find(e=>e.kind==="item" && (e.itemName||"").trim()===String(t.itemName).trim());
      if(!item){
        item=addRecord({
          kind:"item",
          itemCode:nextItemCode(),
          shopId:t.shopId||"",
          itemName:t.itemName,
          spec:t.spec||"",
          unit:t.unit||"",
          field:t.field||"기타",
          maker:t.maker||"",
          vendor:t.vendor||"",
          unitPrice:Number(t.unitPrice)||0,
          safetyStock:0,
          recurring:"비주기",
          createdAt:Date.now()
        });
      }
      const qty=Number(t.qty)||0;
      const up=Number(t.unitPrice)||0;
      const amt=Number(t.amount) || (qty*up);
      addRecord({
        kind:"stock",
        date:t.date||todayStr(),
        stockType:(t.stockType==="출고"?"출고":"입고"),
        itemId:item.id,
        qty,
        unitPrice:up,
        amount:amt,
        vendor:t.vendor||"",
        docNo:t.docNo||"",
        useTarget:t.useTarget||"",
        memo:t.memo||"",
        createdAt:Date.now()
      });
      added++;
    }
  }
  renderMaterial();
  toast(`✅ ${added}건 추가 완료`);
}

function renderMaterial(){
  // 필터/필드 옵션 초기화
  const fieldEl=$("matFieldFilter");
  if(fieldEl && !fieldEl.options.length){
    fieldEl.innerHTML=`<option value="전체">분야 전체</option>`+MAT_FIELDS.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join("");
    $("matRecFilter").innerHTML=`<option value="전체">주기 전체</option>`+["비주기","월간","분기","반기","연간","수시"].map(o=>`<option value="${o}">${o}</option>`).join("");
  }
  // 월별 통계
  renderMatMonthlySummary();
  // v44: 분야별 칩
  renderMatFieldChips();
  // 탭별 렌더
  $("matStockPanel").style.display = MAT_FILTER.tab==="stock" ? "" : "none";
  $("matItemPanel").style.display  = MAT_FILTER.tab==="item"  ? "" : "none";
  $("matTxPanel").style.display    = MAT_FILTER.tab==="tx"    ? "" : "none";
  if(MAT_FILTER.tab==="stock") renderStockOverview();
  else if(MAT_FILTER.tab==="item") renderItemList();
  else if(MAT_FILTER.tab==="tx") renderTxList();
}

// v44: 자재 탭 - 분야별 빠른 필터 칩 (MAT_FIELDS 기반)
function renderMatFieldChips(){
  let chipsBox = document.getElementById('matFieldChips');
  if(!chipsBox){
    const summary = document.getElementById('matMonthlySummary');
    if(!summary) return;
    chipsBox = document.createElement('div');
    chipsBox.id = 'matFieldChips';
    chipsBox.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:12px 0';
    summary.parentNode.insertBefore(chipsBox, summary.nextSibling);
  }
  const items = entries.filter(e=>e.kind==="item");
  // 분야별 카운트
  const cnt = {};
  items.forEach(it=>{ const f=it.field||'기타'; cnt[f]=(cnt[f]||0)+1; });
  const total = items.length;
  const colors = {
    '청소':{bg:'#e8f5e9',fg:'#27ae60'},'영선':{bg:'#e3f2fd',fg:'#3f7cb8'},
    '전기':{bg:'#fff8e1',fg:'#f39c12'},'소방':{bg:'#ffebee',fg:'#e74c3c'},
    '기계':{bg:'#f3e5f5',fg:'#8e44ad'},'환경':{bg:'#e0f7fa',fg:'#00838f'},
    '기타':{bg:'#eceff1',fg:'#7a92a8'},
  };
  let html = `<button class="mat-field-chip" data-mfc="전체" style="padding:6px 12px;border-radius:20px;border:2px solid ${MAT_FILTER.field==='전체'?'#3f7cb8':'#dbe6f4'};background:${MAT_FILTER.field==='전체'?'#3f7cb8':'#fff'};color:${MAT_FILTER.field==='전체'?'#fff':'#1a2f45'};font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">📦 전체 ${total}</button>`;
  MAT_FIELDS.forEach(f=>{
    const c = colors[f]||colors['기타'];
    const isActive = MAT_FILTER.field===f;
    const count = cnt[f]||0;
    html += `<button class="mat-field-chip" data-mfc="${esc(f)}" style="padding:6px 12px;border-radius:20px;border:2px solid ${isActive?c.fg:'#dbe6f4'};background:${isActive?c.fg:c.bg};color:${isActive?'#fff':c.fg};font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">${esc(f)} ${count}</button>`;
  });
  // ⚙ 분야 관리 버튼을 칩 끝에 추가
  html += `<button id="btnMatFieldMgr" style="padding:6px 12px;border-radius:20px;border:1.5px solid #dbe6f4;background:#fff;color:#94a3b8;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-left:4px">⚙ 분야</button>`;
  chipsBox.innerHTML = html;
  chipsBox.querySelectorAll('.mat-field-chip').forEach(btn=>{
    btn.addEventListener('click',()=>{
      MAT_FILTER.field = btn.dataset.mfc;
      const sel=$("matFieldFilter"); if(sel) sel.value=MAT_FILTER.field;
      renderMaterial();
    });
  });
  const mgrBtn = document.getElementById("btnMatFieldMgr");
  if(mgrBtn && !mgrBtn._bound){ mgrBtn._bound=true; mgrBtn.addEventListener("click", openMatFieldMgr); }
}

// v26: 자재 탭 상단 — 월별 구매·사용 요약
function renderMatMonthlySummary(){
  const box = $("matMonthlySummary"); if(!box) return;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const stocks = entries.filter(e=>e.kind==="stock");
  const thisMonthIn = stocks.filter(e=>e.stockType==="입고" && (e.date||"").startsWith(ym));
  const thisMonthOut = stocks.filter(e=>e.stockType==="출고" && (e.date||"").startsWith(ym));
  const inAmount = thisMonthIn.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const outAmount = thisMonthOut.reduce((s,e)=>s+(Number(e.amount)||0),0);
  // 이전 달도 비교용
  const prevDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,"0")}`;
  const prevIn = stocks.filter(e=>e.stockType==="입고" && (e.date||"").startsWith(prevYm))
    .reduce((s,e)=>s+(Number(e.amount)||0),0);
  // 전체 누적 재고가액 (현재재고 × 단가)
  const items = entries.filter(e=>e.kind==="item");
  const stockValue = items.reduce((s,it)=>{
    const q = calcStock(it.id);
    return s + (q>0 ? q*(Number(it.unitPrice)||0) : 0);
  },0);
  box.innerHTML = `
    <div class="mat-month-row">
      <div class="mat-month-card mat-month-in">
        <div class="mm-h">📥 ${ym} 구매 금액</div>
        <div class="mm-v">${won(inAmount)}<span class="mm-u">원</span></div>
        <div class="mm-s">${thisMonthIn.length}건 · 지난달 ${won(prevIn)}원</div>
      </div>
      <div class="mat-month-card mat-month-out">
        <div class="mm-h">📤 ${ym} 사용 금액</div>
        <div class="mm-v">${won(outAmount)}<span class="mm-u">원</span></div>
        <div class="mm-s">${thisMonthOut.length}건</div>
      </div>
      <div class="mat-month-card mat-month-stock">
        <div class="mm-h">📦 누적 재고가액</div>
        <div class="mm-v">${won(stockValue)}<span class="mm-u">원</span></div>
        <div class="mm-s">${items.length}개 품목</div>
      </div>
    </div>
  `;
}

// 재고 현황 — 품목 단위로 현재 재고 + 안전재고 경고
function renderStockOverview(){
  const items=entries.filter(e=>e.kind==="item")
    .filter(it=>MAT_FILTER.field==="전체"||it.field===MAT_FILTER.field)
    .filter(it=>MAT_FILTER.recurring==="전체"||it.recurring===MAT_FILTER.recurring)
    .filter(it=>{
      if(!MAT_FILTER.q.trim()) return true;
      const s=[it.itemCode,it.shopId,it.itemName,it.spec,it.maker,it.vendor,it.memo].filter(Boolean).join(" ").toLowerCase();
      return s.includes(MAT_FILTER.q.trim().toLowerCase());
    });
  // 재고 계산 + 안전재고 필터
  const rows=items.map(it=>({
    item:it,
    stock:calcStock(it.id),
  })).filter(r=>{
    if(!MAT_FILTER.lowOnly) return true;
    return Number(it.safetyStock||0)>0 ? r.stock < Number(r.item.safetyStock) : r.stock<=0;
  }).sort((a,b)=>(a.item.itemName||"").localeCompare(b.item.itemName||"","ko"));
  const body=$("matStockBody");
  if(!rows.length){ body.innerHTML=`<tr><td colspan="10" class="empty">${entries.some(e=>e.kind==="item")?"조건에 맞는 품목이 없습니다.":"➕ 품목 추가를 눌러 자주 쓰는 자재를 등록해 보세요."}</td></tr>`; return; }
  body.innerHTML=rows.map(r=>{
    const it=r.item, st=r.stock;
    const safe=Number(it.safetyStock||0);
    const lowCls = safe>0 && st<safe ? "st-low" : (st<=0 ? "st-zero" : "");
    const cleanName = (it.itemName||"").replace(/^\[.*?\]/,"").trim();
    const shopId = it.shopId||it.itemCode||"";
    return `<tr data-id="${it.id}" class="${lowCls}" style="cursor:pointer">
      <td style="font-size:11px;color:#94a3b8;font-weight:600;padding-right:6px">${esc(shopId)}</td>
      <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0;padding-left:8px" title="${esc(it.itemName||"")}${it.spec?' / '+esc(it.spec):''}">
        <b style="font-size:13px">${esc(cleanName)}</b>
        ${it.spec?`<span style="font-size:10px;color:#94a3b8;margin-left:5px">${esc(it.spec.slice(0,28))}${it.spec.length>28?'…':''}</span>`:""}
      </td>
      <td style="font-size:12px;color:#64748b;text-align:center">${esc(it.unit||"")}</td>
      <td><span class="pill ${fieldClass(it.field)}" style="font-size:10px">${esc(it.field||"")}</span></td>
      <td class="num" style="font-size:12px">${it.unitPrice?won(it.unitPrice):""}</td>
      <td class="num"><b style="font-size:14px;color:${st<=0?'#e74c3c':safe>0&&st<safe?'#f39c12':'#1a2f45'}">${st}</b></td>
      <td style="text-align:center;white-space:nowrap;padding:4px 4px">
        <button class="mini-btn" data-act="in" style="padding:3px 7px;font-size:11px;background:#e0f7fa;border-color:#4dd0e1;color:#0097a7" title="입고">입고</button>
        <button class="mini-btn" data-act="out" style="padding:3px 7px;font-size:11px;background:#fce4ec;border-color:#f48fb1;color:#c2185b" title="출고">출고</button>
        <button class="mini-btn" data-act="edit" style="padding:3px 7px;font-size:11px" title="수정">수정</button>
      </td></tr>`;
  }).join("");
  body.querySelectorAll("tr[data-id]").forEach(tr=>{
    const id=tr.dataset.id;
    /* 🆕 행 자체 클릭 → 보기 팝업 (버튼 영역 제외) */
    tr.style.cursor = "pointer";
    tr.addEventListener("click", function(e){
      if(e.target.closest("[data-act]")) return;
      console.log('[stock-row click] id=', id, 'openItemViewer=', typeof window.openItemViewer);
      if(typeof window.openItemViewer === 'function'){
        window.openItemViewer(id);
      } else {
        openEditor("item", id);
      }
    });
    tr.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",e=>{
      e.stopPropagation();
      if(b.dataset.act==="edit") openEditor("item",id);
      else { // 입고 or 출고 — stock 모달 열고 품목 미리 선택
        openEditor("stock",null);
        setTimeout(()=>{
          const sel=$("m-itemId"); if(sel){ sel.value=id; sel.dispatchEvent(new Event("change")); }
          const tp=$("m-stockType"); if(tp){ tp.value=b.dataset.act==="in"?"입고":"출고"; }
        },80);
      }
    }));
  });
}

// 품목 목록
function renderItemList(){
  const items=entries.filter(e=>e.kind==="item")
    .filter(it=>MAT_FILTER.field==="전체"||it.field===MAT_FILTER.field)
    .filter(it=>MAT_FILTER.recurring==="전체"||it.recurring===MAT_FILTER.recurring)
    .filter(it=>{
      if(!MAT_FILTER.q.trim()) return true;
      const s=[it.itemCode,it.shopId,it.itemName,it.spec,it.maker,it.vendor,it.memo,it.location].filter(Boolean).join(" ").toLowerCase();
      return s.includes(MAT_FILTER.q.trim().toLowerCase());
    })
    .sort((a,b)=>(a.itemName||"").localeCompare(b.itemName||"","ko"));
  const body=$("matItemBody");
  if(!items.length){ body.innerHTML=`<tr><td colspan="10" class="empty">등록된 품목이 없습니다.</td></tr>`; return; }
  body.innerHTML=items.map(it=>{
    const cleanName = (it.itemName||"").replace(/^\[.*?\]/,"").trim();
    return `<tr data-id="${it.id}">
    <td style="font-size:11px;color:#94a3b8">${esc(it.shopId||it.itemCode||"")}</td>
    <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0" title="${esc(it.itemName||"")}"><b style="font-size:12px">${esc(cleanName)}</b></td>
    <td style="font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0" title="${esc(it.spec||"")}">${esc(it.spec||"")}</td>
    <td style="font-size:12px">${esc(it.unit||"")}</td>
    <td><span class="pill ${fieldClass(it.field)}" style="font-size:10px">${esc(it.field||"")}</span></td>
    <td style="font-size:12px;color:#64748b">${esc(it.maker||"")}</td>
    <td style="font-size:12px;color:#64748b">${esc(it.vendor||"")}</td>
    <td class="num" style="font-size:12px">${it.unitPrice?won(it.unitPrice):""}</td>
    <td>${it.recurring&&it.recurring!=="비주기"?`<span class="pill leave" style="font-size:10px">🔁 ${esc(it.recurring)}</span>`:""}</td>
    <td style="white-space:nowrap;text-align:center;padding:4px 6px">
      <button class="mini-btn" data-quickedit="${it.id}" style="padding:3px 8px;font-size:11px;background:#eaf1fb;border-color:#dbe6f4;color:#3f7cb8" title="수정">✏️ 수정</button>
      <button class="rowdel" data-del="${it.id}" style="padding:3px 7px;font-size:11px" title="삭제">🗑</button>
    </td>
  </tr>`;
  }).join("");
  body.querySelectorAll("tr[data-id]").forEach(tr=>{
    tr.style.cursor = "pointer";
    tr.addEventListener("click",e=>{ 
      if(e.target.closest("[data-del],[data-quickedit]")) return; 
      console.log('[item-row click] id=', tr.dataset.id, 'openItemViewer=', typeof window.openItemViewer);
      /* 행 클릭은 보기 팝업 (수정 모달 X) */
      if(typeof window.openItemViewer === 'function'){
        window.openItemViewer(tr.dataset.id);
      } else {
        console.warn('[item-row] openItemViewer 미정의 → 수정 모달로 폴백');
        openQuickEditMaterial(tr.dataset.id);
      }
    });
    tr.querySelector("[data-del]").addEventListener("click",e=>{ e.stopPropagation(); deleteWithUndo(tr.dataset.id,"품목"); });
    tr.querySelector("[data-quickedit]").addEventListener("click",e=>{
      e.stopPropagation();
      openQuickEditMaterial(tr.dataset.id);
    });
  });
}

/* v44: 자재 빠른 수정 모달 - 새 자재 추가 모달과 같은 구조 */
function openQuickEditMaterial(id){
  const item = entries.find(e=>e.id===id && e.kind==="item");
  if(!item){ toast("자재를 찾을 수 없어요"); return; }
  // 기존 오버레이 있으면 제거
  const oldOv = document.getElementById('quickEditMatOverlay');
  if(oldOv) oldOv.remove();
  const ov = document.createElement('div');
  ov.id = 'quickEditMatOverlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:18px;width:100%;max-width:480px;padding:24px;box-shadow:0 12px 40px rgba(0,0,0,.2);max-height:90vh;overflow:auto">
      <h3 style="margin:0 0 6px;font-size:18px;font-weight:800;color:#0369a1">✏️ 자재 수정</h3>
      <div style="font-size:12px;color:#aab8c8;margin-bottom:16px">규격을 간단하게 정리하거나, 분야/단가 등을 빠르게 수정하세요</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">서브원 상품ID</label>
          <input type="text" id="qeShopId" value="${esc(item.shopId||'')}" placeholder="예: 6573068" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">품목명 <span style="color:#e74c3c">*</span></label>
          <input type="text" id="qeName" value="${esc(item.itemName||'')}" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">규격 <span style="color:#aab8c8;font-weight:500">(짧게 정리)</span></label>
          <input type="text" id="qeSpec" value="${esc(item.spec||'')}" placeholder="예: 8W / Φ60mm" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">단위코드</label>
            <input type="text" id="qeUnit" value="${esc(item.unit||'')}" placeholder="EA, BOX, ROL" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
          </div>
          <div style="flex:1">
            <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">판매단가 (원)</label>
            <input type="number" id="qePrice" value="${Number(item.unitPrice)||0}" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
          </div>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">제조원</label>
          <input type="text" id="qeMaker" value="${esc(item.maker||'')}" placeholder="예: (주)동원피앤아이" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">분야</label>
          <select id="qeField" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
            ${FIELDS.map(f=>`<option value="${esc(f)}" ${item.field===f?'selected':''}>${esc(f)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">거래처</label>
          <input type="text" id="qeVendor" value="${esc(item.vendor||'')}" placeholder="예: 서브원" style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button id="qeCancel" type="button" style="flex:1;height:48px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;background:#f7faff;color:#7a92a8;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">취소</button>
          <button id="qeDelete" type="button" style="flex:1;height:48px;padding:0 14px;border:2px solid #fde8e8;border-radius:12px;background:#fff;color:#e74c3c;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">🗑 삭제</button>
          <button id="qeSave" type="button" style="flex:2;height:48px;padding:0 14px;border:none;border-radius:12px;background:#0369a1;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">💾 저장</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  // 포커스 - 규격 칸에 (가장 많이 수정할 칸)
  setTimeout(()=>{
    const specEl = document.getElementById('qeSpec');
    if(specEl){ specEl.focus(); specEl.select(); }
  }, 100);
  const close = ()=>{ ov.remove(); };
  document.getElementById('qeCancel').addEventListener('click', close);
  /* 배경 클릭 닫기 비활성화 */
  // 저장
  document.getElementById('qeSave').addEventListener('click', ()=>{
    const name = (document.getElementById('qeName').value||'').trim();
    if(!name){ toast('품목명을 입력하세요'); return; }
    const patch = {
      shopId: (document.getElementById('qeShopId').value||'').trim(),
      itemName: name,
      spec: (document.getElementById('qeSpec').value||'').trim(),
      unit: (document.getElementById('qeUnit').value||'').trim(),
      unitPrice: Number(document.getElementById('qePrice').value)||0,
      maker: (document.getElementById('qeMaker').value||'').trim(),
      field: document.getElementById('qeField').value||'',
      vendor: (document.getElementById('qeVendor').value||'').trim(),
    };
    updateRecord(id, patch);
    close();
    toast(`✅ "${name}" 수정됨`);
    renderMaterial();
  });
  // 삭제
  document.getElementById('qeDelete').addEventListener('click', ()=>{
    close();
    deleteWithUndo(id, "품목");
  });
  // Enter 키 → 저장 (textarea 제외)
  ['qeShopId','qeName','qeSpec','qeUnit','qePrice','qeMaker','qeVendor'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('keydown', e=>{
      if(e.key==='Enter'){ e.preventDefault(); document.getElementById('qeSave').click(); }
    });
  });
}

// 입출고 거래 내역
let _txSubTab = "전체"; // "전체" | "입고" | "출고"

function renderTxList(){
  // 서브탭 버튼 바인딩 (최초 1회)
  document.querySelectorAll(".tx-sub-tab").forEach(btn=>{
    if(btn._txBound) return; btn._txBound=true;
    btn.addEventListener("click",()=>{
      _txSubTab = btn.dataset.txtab;
      document.querySelectorAll(".tx-sub-tab").forEach(b=>{
        const on = b.dataset.txtab===_txSubTab;
        b.style.background = on?"#3f7cb8":"#f7faff";
        b.style.color = on?"#fff":"#7a92a8";
      });
      renderTxList();
    });
  });

  const items=entries.filter(e=>e.kind==="item");
  const itemById={}; items.forEach(it=>itemById[it.id]=it);
  const txs=entries.filter(e=>e.kind==="stock")
    .filter(t=>{
      if(_txSubTab!=="전체" && t.stockType!==_txSubTab) return false;
      const it=itemById[t.itemId];
      if(MAT_FILTER.field!=="전체" && (!it || it.field!==MAT_FILTER.field)) return false;
      if(!MAT_FILTER.q.trim()) return true;
      const s=[t.date,t.useTarget,t.memo,(it&&it.itemName)||"",(it&&it.spec)||""].filter(Boolean).join(" ").toLowerCase();
      return s.includes(MAT_FILTER.q.trim().toLowerCase());
    })
    .sort(byDateDesc);
  const body=$("matTxBody");
  if(!txs.length){ body.innerHTML=`<tr><td colspan="8" class="empty">${_txSubTab==="전체"?"입출고 내역이 없습니다.":_txSubTab+" 내역이 없습니다."}</td></tr>`; return; }
  body.innerHTML=txs.map(t=>{
    const it=itemById[t.itemId];
    const isIn = t.stockType==="입고";
    const tCls = isIn ? "in" : "out";
    const cleanName = it ? (it.itemName||"").replace(/^\[.*?\]/,"").trim() : "";
    return `<tr data-id="${t.id}">
      <td style="font-size:12px">${t.date||""}</td>
      <td><span class="dir ${tCls}" style="font-size:11px">${esc(t.stockType||"")}</span></td>
      <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0" title="${esc(it?it.itemName:"")}">
        ${it?`<b style="font-size:12px">${esc(cleanName)}</b>`:"<span style='color:var(--peach);font-size:11px'>(삭제됨)</span>"}
      </td>
      <td style="font-size:12px;color:#64748b;text-align:center">${it?esc(it.unit||""):""}</td>
      <td class="num" style="font-weight:700;font-size:13px">${t.qty||0}</td>
      <td class="num" style="font-size:11px">${t.unitPrice?won(t.unitPrice):""}</td>
      <td style="font-size:11px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0" title="${esc(t.useTarget||t.memo||"")}">${esc((t.useTarget||t.memo||"").slice(0,20))}</td>
      <td style="text-align:center;white-space:nowrap;padding:4px 6px">
        <button class="mini-btn" data-txedit="${t.id}" style="padding:3px 7px;font-size:11px" title="수정">✏️</button>
        <button class="rowdel" data-del="${t.id}" style="padding:3px 7px;font-size:11px" title="삭제">🗑</button>
      </td>
    </tr>`;
  }).join("");
  body.querySelectorAll("tr[data-id]").forEach(tr=>{
    tr.addEventListener("click",e=>{ if(e.target.closest("[data-del],[data-txedit]")) return; openEditor("stock",tr.dataset.id); });
    tr.querySelector("[data-del]").addEventListener("click",e=>{ e.stopPropagation(); deleteWithUndo(tr.dataset.id,"입출고 내역"); });
    tr.querySelector("[data-txedit]").addEventListener("click",e=>{ e.stopPropagation(); openEditor("stock",tr.dataset.id); });
  });
  const inCnt=txs.filter(t=>t.stockType==="입고").length;
  const outCnt=txs.filter(t=>t.stockType==="출고").length;
  $("matTxSummary").innerHTML=`총 ${txs.length}건 · 📥 입고 ${inCnt}건 · 📤 출고 ${outCnt}건`;
}

function matExcelCopy(){
  const items=entries.filter(e=>e.kind==="item");
  const itemById={}; items.forEach(it=>itemById[it.id]=it);
  let text=""; let lbl="";
  if(MAT_FILTER.tab==="stock"){
    lbl="재고현황";
    const rows=items.sort((a,b)=>(a.itemName||"").localeCompare(b.itemName||"","ko"));
    text=rows.map(it=>[it.itemCode,it.itemName,it.spec,it.unit,it.field,it.vendor,it.unitPrice||"",calcStock(it.id),it.safetyStock||"",it.recurring||""].map(x=>cleanCell(x)).join("\t")).join("\n");
  } else if(MAT_FILTER.tab==="item"){
    lbl="품목목록";
    const rows=items.sort((a,b)=>(a.itemName||"").localeCompare(b.itemName||"","ko"));
    text=rows.map(it=>[it.itemCode,it.itemName,it.spec,it.unit,it.field,it.vendor,it.unitPrice||"",it.safetyStock||"",it.recurring||"",it.location,it.memo].map(x=>cleanCell(x)).join("\t")).join("\n");
  } else {
    lbl="입출고내역";
    const txs=entries.filter(e=>e.kind==="stock").sort(byDateDesc);
    text=txs.map(t=>{
      const it=itemById[t.itemId]||{};
      return [t.date,t.stockType,it.itemName||"",it.spec||"",t.qty||0,t.unitPrice||"",t.amount||"",t.vendor,t.docNo,t.useTarget,t.memo].map(x=>cleanCell(x)).join("\t");
    }).join("\n");
  }
  if(!text){ toast("복사할 내역이 없습니다"); return; }
  copyText(text, `${lbl} 엑셀 복사됨`);
}

/* AI 텍스트 추출 — 사용자가 엑셀 텍스트 붙여넣으면 Claude가 분석 */
async function aiExtractDialog(){
  const key=(aiGetKey()||"").trim();
  if(!key){ toast("자가진단·AI 탭에서 API 키부터 저장해주세요"); activateTab("ai"); return; }
  if(!/^[\x20-\x7E]+$/.test(key)){ toast("⚠ API 키에 잘못된 문자가 있어요. AI 탭에서 재저장하세요"); return; }
  const txt = prompt("엑셀에서 복사한 내용을 붙여넣어 주세요\n(첫 행은 헤더로, Tab 또는 쉼표로 구분된 데이터)\n\nAI가 분석해서 품목 또는 입출고 내역으로 자동 추출합니다.","");
  if(!txt||!txt.trim()) return;
  const type = confirm("이 데이터는 [확인=입출고 내역] / [취소=품목 마스터] 중 어느 쪽인가요?") ? "stock" : "item";
  toast("AI 분석 중...잠시 기다려주세요");
  try{
    await aiExtractFromText(txt, type, key);
  }catch(e){ logErr("AI 자재추출",e); toast(`❌ ${e.message}`); }
}


function wireCleaningModal(){
  $("clnCancel").addEventListener("click",()=>$("cleaningOverlay").classList.remove("show"));
  $("clnSave").addEventListener("click",saveCleaning);
  $("clnDelete").addEventListener("click",()=>{
    if(!cleaningData||!cleaningData.id) return;
    const id=cleaningData.id;
    $("cleaningOverlay").classList.remove("show");
    const linkedStocks=entries.filter(s=>s.kind==="stock"&&s.cleaningId===id).map(s=>s.id);
    linkedStocks.forEach(sid=>deleteRecord(sid));
    deleteWithUndo(id, "청소일지");
  });
  /* cleaningOverlay 배경 클릭 닫기 비활성화 */
  // 명단 관리 모달
  $("cleanStaffClose").addEventListener("click",()=>$("cleanStaffOverlay").classList.remove("show"));
  /* cleanStaffOverlay 배경 클릭 닫기 비활성화 */
  $("cleanStaffAdd").addEventListener("click",()=>{
    CLEAN_STAFF.push({name:"", floors:"", tissue:0, towel:0, special:""});
    saveCleanStaff(); renderCleanStaffList();
  });
  $("cleanForemanInput").addEventListener("input",e=>{ CLEAN_FOREMAN=e.target.value||"배옥식"; saveCleanForeman(); });
}


const CLEAN_STAFF_LS = "wl_clean_staff_v23";
const CLEAN_FOREMAN_LS = "wl_clean_foreman_v23";
const DEFAULT_CLEAN_STAFF = [
  {name:"김태경", floors:"20·19·15층"},
  {name:"한광희", floors:"16·17·18층"},
  {name:"박일월", floors:"11·12·13·14층"},
  {name:"정은지", floors:"8·9·10층"},
  {name:"오희성", floors:"4·5·6·7층"},
  {name:"차민자", floors:"B1·1·2·3층"},
];
let CLEAN_STAFF = DEFAULT_CLEAN_STAFF.slice();
let CLEAN_FOREMAN = "배옥식";

function loadCleanSettings(){
  try{
    const s=JSON.parse(localStorage.getItem(CLEAN_STAFF_LS)||"null");
    if(Array.isArray(s)&&s.length) CLEAN_STAFF=s;
    const f=localStorage.getItem(CLEAN_FOREMAN_LS);
    if(f) CLEAN_FOREMAN=f;
  }catch(e){}
}
function saveCleanStaff(){ try{ localStorage.setItem(CLEAN_STAFF_LS, JSON.stringify(CLEAN_STAFF)); }catch(e){} }
function saveCleanForeman(){ try{ localStorage.setItem(CLEAN_FOREMAN_LS, CLEAN_FOREMAN); }catch(e){} }

// 청소 일지 필터 상태
const CLEAN_FILTER = { q:"", from:"", to:"" };

function wireCleaningTab(){
  const _clnSearch=$("clnSearch"); if(_clnSearch) _clnSearch.addEventListener("input",e=>{ CLEAN_FILTER.q=e.target.value; renderCleaning(); });
  $("clnFrom").addEventListener("change",e=>{ CLEAN_FILTER.from=e.target.value; renderCleaning(); });
  $("clnTo").addEventListener("change",e=>{ CLEAN_FILTER.to=e.target.value; renderCleaning(); });
  $("clnRangeClear").addEventListener("click",()=>{ CLEAN_FILTER.from=""; CLEAN_FILTER.to=""; $("clnFrom").value=""; $("clnTo").value=""; renderCleaning(); });
  $("btnAddCleaning").addEventListener("click",()=>openCleaningEditor(null));
  $("btnCleanStaffMgr").addEventListener("click",openCleanStaffMgr);
  // 청소 달력
  $("cleanCalPrev").addEventListener("click",()=>{ cleanCalM--; if(cleanCalM<0){cleanCalM=11; cleanCalY--;} renderCleaningCalendar(); });
  $("cleanCalNext").addEventListener("click",()=>{ cleanCalM++; if(cleanCalM>11){cleanCalM=0; cleanCalY++;} renderCleaningCalendar(); });
}

// 청소 전용 달력 상태
let cleanCalY = new Date().getFullYear();
let cleanCalM = new Date().getMonth();

function cleaningList(){
  return entries.filter(e=>e.kind==="cleaning"
    && inDateRange(e.date, CLEAN_FILTER.from, CLEAN_FILTER.to)
    && (!CLEAN_FILTER.q.trim() || cleaningMatches(e, CLEAN_FILTER.q))
  ).sort(byDateDesc);
}
function cleaningMatches(e, q){
  const parts=[e.date, e.foreman, e.notes, e.instructions, e.special];
  if(Array.isArray(e.directorOrders)) parts.push(...e.directorOrders);
  if(Array.isArray(e.directives)) parts.push(...e.directives);
  if(Array.isArray(e.specials)) parts.push(...e.specials);
  (e.staffWork||[]).forEach(s=>{ parts.push(s.name, s.floors, s.special); });
  return parts.filter(Boolean).join(" ").toLowerCase().includes(q.trim().toLowerCase());
}

function renderCleaningCalendar(){
  const titleEl = $("cleanCalTitle"); if(!titleEl) return;
  titleEl.textContent = `${cleanCalY}년 ${cleanCalM+1}월`;
  const first = new Date(cleanCalY, cleanCalM, 1).getDay();
  const days = new Date(cleanCalY, cleanCalM+1, 0).getDate();
  // 청소 일지 있는 날짜 집계
  const byDate = {};
  entries.filter(e=>e.kind==="cleaning"&&e.date).forEach(e=>{
    (byDate[e.date]=byDate[e.date]||[]).push(e);
  });
  const today = todayStr();
  let html = `<div class="cc-dh">일</div><div class="cc-dh">월</div><div class="cc-dh">화</div><div class="cc-dh">수</div><div class="cc-dh">목</div><div class="cc-dh">금</div><div class="cc-dh">토</div>`;
  for(let i=0;i<first;i++) html += `<div class="cc-cell empty"></div>`;
  for(let d=1; d<=days; d++){
    const ds = `${cleanCalY}-${String(cleanCalM+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const arr = byDate[ds]||[];
    const has = arr.length>0;
    const isToday = ds === today;
    const dow = new Date(cleanCalY,cleanCalM,d).getDay();
    const cls = `cc-cell ${has?"has":""} ${isToday?"today":""} ${dow===0?"sun":""} ${dow===6?"sat":""}`;
    let inner = `<div class="cc-num">${d}</div>`;
    if(has){
      // 모든 일지의 지시·전달·특기 항목 모으기
      const items = [];
      arr.forEach(c=>{
        if(Array.isArray(c.directorOrders)) c.directorOrders.forEach(t=>{ if(t&&t.trim()) items.push({type:"director",text:t.trim()}); });
        if(Array.isArray(c.directives)) c.directives.forEach(t=>{ if(t&&t.trim()) items.push({type:"directive",text:t.trim()}); });
        if(Array.isArray(c.specials)) c.specials.forEach(t=>{ if(t&&t.trim()) items.push({type:"special",text:t.trim()}); });
        // 옛 데이터 호환
        if(!Array.isArray(c.directives) && c.notes) c.notes.split(/\n+/).forEach(t=>{ if(t&&t.trim()) items.push({type:"directive",text:t.trim()}); });
        if(!Array.isArray(c.specials) && c.special) c.special.split(/\n+/).forEach(t=>{ if(t&&t.trim()) items.push({type:"special",text:t.trim()}); });
      });
      if(items.length){
        const itemsHtml = items.map(it=>{
          const icon = it.type==="director" ? "👔" : it.type==="special" ? "⭐" : "📌";
          return `<div class="cc-it cc-it-${it.type}">${icon} ${esc(it.text)}</div>`;
        }).join("");
        inner += `<div class="cc-items">${itemsHtml}</div>`;
      } else {
        // 항목 없으면 표시만
        inner += `<div class="cc-mark">🧹${arr.length>1?` ${arr.length}`:""}</div>`;
      }
    }
    html += `<div class="${cls}" data-date="${ds}">${inner}</div>`;
  }
  $("cleanCalGrid").innerHTML = html;
  // 클릭 → 일지 열기
  $("cleanCalGrid").querySelectorAll(".cc-cell[data-date]").forEach(el=>{
    el.addEventListener("click",()=>{
      const ds = el.dataset.date;
      const arr = byDate[ds]||[];
      if(arr.length===1) openCleaningEditor(arr[0].id);
      else if(arr.length>1){
        openCleaningEditor(arr[0].id);
      } else {
        openCleaningEditor(null);
        setTimeout(()=>{ const d=$("cln-date"); if(d) d.value=ds; },80);
      }
    });
  });
}

function renderCleaning(){
  renderCleaningCalendar(); // 달력도 같이 갱신
  const list=cleaningList();
  // 월별 사용량 통계
  renderCleaningStats();
  const box=$("clnList");
  if(!list.length){ box.innerHTML=`<div class="empty">청소 일지가 없습니다. <b>➕ 일지 추가</b>로 사진 한 장 올려보세요.</div>`; return; }
  box.innerHTML=list.map(c=>{
    const totalTissue=(c.staffWork||[]).reduce((s,x)=>s+(Number(x.tissue)||0),0);
    const totalTowel=(c.staffWork||[]).reduce((s,x)=>s+(Number(x.towel)||0),0);
    const issues=(c.staffWork||[]).filter(x=>x.special&&x.special.trim());
    // 옛 데이터 호환
    const directors = Array.isArray(c.directorOrders) ? c.directorOrders : [];
    const directives = Array.isArray(c.directives) ? c.directives : (c.notes||c.instructions?(c.notes||c.instructions).split("\n").filter(s=>s.trim()):[]);
    const specials = Array.isArray(c.specials) ? c.specials : (c.special?c.special.split("\n").filter(s=>s.trim()):[]);
    const itemList = (arr, max=3) => arr.slice(0,max).map(t=>`<li>${esc(t).slice(0,90)}${t.length>90?"…":""}</li>`).join("") + (arr.length>max?`<li style="color:var(--ink-soft);font-style:italic">+${arr.length-max}건 더</li>`:"");
    return `<div class="row-item cln-row" data-id="${c.id}">
      <div class="grow">
        <div class="t">🧹 ${esc(c.date||"")} <span class="pill admin">반장 ${esc(c.foreman||CLEAN_FOREMAN)}</span>
          ${totalTissue?`<span class="pill tech">점보롤 ${totalTissue}</span>`:""}
          ${totalTowel?`<span class="pill env">핸드타월 ${totalTowel}</span>`:""}
          ${(c.photo)?`<span style="font-size:13px">📷</span>`:""}
        </div>
        <div class="m">
          ${directors.length?`<div class="cln-card-section"><b>👔 소장 지시:</b><ul>${itemList(directors)}</ul></div>`:""}
          ${directives.length?`<div class="cln-card-section"><b>📌 지시·전달:</b><ul>${itemList(directives)}</ul></div>`:""}
          ${specials.length?`<div class="cln-card-section"><b>⭐ 특기:</b><ul>${itemList(specials)}</ul></div>`:""}
          ${issues.length?`<div style="margin-top:5px"><b>⚠ 담당자 특이사항:</b> ${issues.map(s=>esc(s.name)+"-"+esc(s.special)).join(" / ")}</div>`:""}
        </div>
        <div class="card-acts">
          <button class="mini-btn" data-edit>✏️ 수정</button>
          <button class="mini-btn del" data-del>🗑 삭제</button>
        </div>
      </div>
    </div>`;
  }).join("");
  box.querySelectorAll(".cln-row").forEach(el=>{
    const id=el.dataset.id;
    el.addEventListener("click",e=>{ if(e.target.closest("button")) return; openCleaningEditor(id); });
    el.querySelector("[data-edit]").addEventListener("click",e=>{ e.stopPropagation(); openCleaningEditor(id); });
    el.querySelector("[data-del]").addEventListener("click",e=>{
      e.stopPropagation();
      // 연동된 자재 입출고 같이 삭제
      const linkedStocks=entries.filter(s=>s.kind==="stock"&&s.cleaningId===id).map(s=>s.id);
      linkedStocks.forEach(sid=>deleteRecord(sid));
      deleteWithUndo(id, "청소일지");
    });
  });
}

function renderCleaningStats(){
  const box=$("clnStats"); if(!box) return;
  const all=entries.filter(e=>e.kind==="cleaning");
  if(!all.length){ box.innerHTML=""; return; }
  // 이번 달
  const now=new Date();
  const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const thisMonth=all.filter(e=>(e.date||"").startsWith(ym));
  const t=thisMonth.reduce((s,e)=>s+(e.staffWork||[]).reduce((q,x)=>q+(Number(x.tissue)||0),0),0);
  const w=thisMonth.reduce((s,e)=>s+(e.staffWork||[]).reduce((q,x)=>q+(Number(x.towel)||0),0),0);
  box.innerHTML=`<div class="cln-stat-row">
    <span class="cln-stat-item">📅 이번달 일지 <b>${thisMonth.length}건</b></span>
    <span class="cln-stat-item">🧻 점보롤 사용 <b>${t}</b></span>
    <span class="cln-stat-item">🧺 핸드타월 사용 <b>${w}</b></span>
    <span class="cln-stat-item" style="color:var(--ink-soft)">전체 일지 ${all.length}건</span>
  </div>`;
}

// ===== 청소 일지 추가/수정 모달 =====
let cleaningPhoto=null;
let cleaningData=null;
function openCleaningEditor(id){
  cleaningData = id ? Object.assign({},entries.find(e=>e.id===id)||{}) : {
    date: todayStr(),
    foreman: CLEAN_FOREMAN,
    staffWork: CLEAN_STAFF.map(s=>({name:s.name, floors:s.floors, tissue:0, towel:0, special:""})),
    directorOrders: [],
    directives: [],
    specials: [],
    // v42: 자유 입출고 항목 배열 [{name, qty}]
    inItems: [], outItems: [],
    // 구버전 호환 필드
    tissueIn: 0, tissueOut: 0, towelIn: 0, towelOut: 0,
    photo: null,
  };
  // 옛 데이터 호환
  if(cleaningData.id){
    if(!Array.isArray(cleaningData.directives)){
      const src = cleaningData.notes || cleaningData.instructions || "";
      cleaningData.directives = src ? src.split(/\n+/).filter(s=>s.trim()) : [];
    }
    if(!Array.isArray(cleaningData.specials)){
      const src = cleaningData.special || "";
      cleaningData.specials = src ? src.split(/\n+/).filter(s=>s.trim()) : [];
    }
    if(!Array.isArray(cleaningData.directorOrders)) cleaningData.directorOrders = [];
    // v42: 구버전 점보롤/핸드타월 → inItems/outItems 마이그레이션
    if(!Array.isArray(cleaningData.inItems)){
      const legacy = [];
      if(Number(cleaningData.tissueIn)>0) legacy.push({name:"점보롤", qty:Number(cleaningData.tissueIn)});
      if(Number(cleaningData.towelIn)>0) legacy.push({name:"핸드타월", qty:Number(cleaningData.towelIn)});
      cleaningData.inItems = legacy;
    }
    if(!Array.isArray(cleaningData.outItems)){
      const legacy = [];
      if(Number(cleaningData.tissueOut)>0) legacy.push({name:"점보롤", qty:Number(cleaningData.tissueOut)});
      if(Number(cleaningData.towelOut)>0) legacy.push({name:"핸드타월", qty:Number(cleaningData.towelOut)});
      cleaningData.outItems = legacy;
    }
  }
  cleaningPhoto = cleaningData.photo || null;
  renderCleaningModal(id);
  $("cleaningOverlay").classList.add("show");
  const m=$("cleaningOverlay").querySelector(".modal"); if(m) m.scrollTop=0;
}

function renderCleaningModal(id){
  $("clnTitle").textContent = (id?"수정":"추가")+" · 🧹 청소 일지";
  const d=cleaningData;
  // 누락된 staffWork 보정
  if(!Array.isArray(d.staffWork)) d.staffWork=[];
  // 현재 등록 명단과 일지 명단 동기화 (퇴사·신규 반영, 기존 데이터는 유지)
  const byName={};
  d.staffWork.forEach(s=>{ byName[s.name]=s; });
  const aligned=CLEAN_STAFF.map(cs=>{
    const found=byName[cs.name];
    return found || {name:cs.name, floors:cs.floors, tissue:0, towel:0, special:""};
  });
  // 명단에 없는 옛 데이터도 끝에 보존
  d.staffWork.forEach(s=>{
    if(!CLEAN_STAFF.find(cs=>cs.name===s.name)) aligned.push(s);
  });
  d.staffWork=aligned;

  let rows = d.staffWork.map((s,i)=>`
    <tr data-idx="${i}">
      <td><b>${esc(s.name||"")}</b></td>
      <td><input type="text" class="cln-floors" value="${esc(s.floors||"")}"></td>
      <td><input type="number" class="cln-tissue" value="${Number(s.tissue)||0}" min="0"></td>
      <td><input type="number" class="cln-towel" value="${Number(s.towel)||0}" min="0"></td>
      <td><input type="text" class="cln-special" value="${esc(s.special||"")}" placeholder="특이사항"></td>
    </tr>`).join("");

  $("clnFields").innerHTML=`
    <div class="grid" style="margin-bottom:14px">
      <div class="field"><label>날짜 <span class="req">*</span></label><input type="date" id="cln-date" value="${esc(d.date||todayStr())}"></div>
      <div class="field"><label>반장</label><input type="text" id="cln-foreman" value="${esc(d.foreman||CLEAN_FOREMAN)}"></div>
    </div>

    <div class="field full" style="margin-bottom:14px">
      <label>📷 일지 원본 사진 (AI 분석에 사용)</label>
      <div class="photo-btns">
        <label class="photo-btn">📷 촬영<input type="file" id="cln-cam" accept="image/*" capture="environment" style="display:none"></label>
        <label class="photo-btn">🖼 사진 선택<input type="file" id="cln-file" accept="image/*" style="display:none"></label>
        <button class="btn btn-primary btn-sm" id="cln-aiBtn" type="button" ${cleaningPhoto?"":"disabled"}>🤖 AI 분석</button>
      </div>
      <div id="cln-photoArea"></div>
    </div>

    <h3 style="font-family:'Gowun Batang',serif;font-size:16px;color:#33567d;margin:6px 0">👥 담당자별 작업 내역</h3>
    <div class="table-wrap" style="margin-bottom:14px">
      <table class="rec cln-staff-table"><thead><tr>
        <th>담당자</th><th>담당 층</th><th>점보롤</th><th>핸드타월</th><th>특이사항</th>
      </tr></thead><tbody id="cln-staffBody">${rows}</tbody></table>
    </div>

    <div class="field full" style="margin-bottom:14px">
      <label>👔 소장 지시사항 <span style="color:var(--ink-soft);font-weight:400;font-size:11px">— 항목당 한 셀로 추가됩니다</span></label>
      <div id="cln-directorList" class="cln-item-list"></div>
      <button type="button" class="btn btn-ghost btn-sm" data-addcln="director">➕ 항목 추가</button>
    </div>

    <div class="field full" style="margin-bottom:14px">
      <label>📌 지시 및 전달사항 <span style="color:var(--ink-soft);font-weight:400;font-size:11px">— 항목당 한 셀로 추가됩니다</span></label>
      <div id="cln-directiveList" class="cln-item-list"></div>
      <button type="button" class="btn btn-ghost btn-sm" data-addcln="directive">➕ 항목 추가</button>
    </div>

    <div class="field full" style="margin-bottom:14px">
      <label>⭐ 특기사항 <span style="color:var(--ink-soft);font-weight:400;font-size:11px">— 항목당 한 셀로 추가됩니다</span></label>
      <div id="cln-specialList" class="cln-item-list"></div>
      <button type="button" class="btn btn-ghost btn-sm" data-addcln="special">➕ 항목 추가</button>
    </div>

    <h3 style="font-family:'Gowun Batang',serif;font-size:16px;color:#33567d;margin:6px 0">📦 소모품 입출고 (자재 탭 자동 연동)</h3>
    <div style="margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700;color:var(--ink-soft)">📥 입고된 자재</span>
        <button type="button" class="btn btn-ghost btn-sm" id="cln-addInItem">➕ 항목 추가</button>
      </div>
      <div id="cln-inItems"></div>
    </div>
    <div style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700;color:var(--ink-soft)">📤 출고된 자재</span>
        <button type="button" class="btn btn-ghost btn-sm" id="cln-addOutItem">➕ 항목 추가</button>
      </div>
      <div id="cln-outItems"></div>
    </div>
    <p style="font-size:12px;color:var(--ink-soft);margin-top:6px">💡 저장 시 해당 자재 품목이 자재 탭에 자동 등록되고, 입출고 내역도 자동으로 기록됩니다.</p>
  `;
  // 3개 항목 리스트 렌더링
  renderCleaningItemList("director", "cln-directorList", cleaningData.directorOrders);
  renderCleaningItemList("directive", "cln-directiveList", cleaningData.directives);
  renderCleaningItemList("special", "cln-specialList", cleaningData.specials);
  // ➕ 항목 추가 버튼 (지시사항 등)
  $("clnFields").querySelectorAll("[data-addcln]").forEach(b=>b.addEventListener("click",()=>{
    const type=b.dataset.addcln;
    const arr = type==="director"?cleaningData.directorOrders : type==="directive"?cleaningData.directives : cleaningData.specials;
    arr.push("");
    const listId = type==="director"?"cln-directorList" : type==="directive"?"cln-directiveList" : "cln-specialList";
    renderCleaningItemList(type, listId, arr);
    setTimeout(()=>{
      const inputs=$(listId).querySelectorAll("input.cln-item-input");
      if(inputs.length) inputs[inputs.length-1].focus();
    },50);
  }));
  // v42: 자유 입출고 항목 렌더링
  renderClnStockItems("cln-inItems", cleaningData.inItems);
  renderClnStockItems("cln-outItems", cleaningData.outItems);
  $("cln-addInItem").addEventListener("click",()=>{
    cleaningData.inItems.push({name:"", qty:0});
    renderClnStockItems("cln-inItems", cleaningData.inItems);
    setTimeout(()=>{ const els=$("cln-inItems").querySelectorAll(".cln-stock-name"); if(els.length) els[els.length-1].focus(); },30);
  });
  $("cln-addOutItem").addEventListener("click",()=>{
    cleaningData.outItems.push({name:"", qty:0});
    renderClnStockItems("cln-outItems", cleaningData.outItems);
    setTimeout(()=>{ const els=$("cln-outItems").querySelectorAll(".cln-stock-name"); if(els.length) els[els.length-1].focus(); },30);
  });
  // 사진 영역
  renderCleaningPhoto();
  $("cln-aiBtn").disabled = !cleaningPhoto;
  // 이벤트
  $("cln-cam").addEventListener("change",e=>handleCleaningPhoto(e));
  $("cln-file").addEventListener("change",e=>handleCleaningPhoto(e));
  $("cln-aiBtn").addEventListener("click",cleaningAIAnalyze);
  $("clnSave").style.display="";
  $("clnDelete").style.display = id?"":"none";
}

// v42: 자유 입출고 항목 렌더링
function renderClnStockItems(containerId, arr){
  const box=$(containerId); if(!box) return;
  if(!arr.length){ box.innerHTML=`<div style="font-size:12px;color:var(--ink-soft);padding:6px 2px;font-style:italic">아직 항목이 없습니다 — ➕ 항목 추가를 눌러 자재를 입력하세요</div>`; return; }
  box.innerHTML = arr.map((it,i)=>`
    <div class="cln-item-row" data-si="${i}">
      <span class="cln-item-no">${i+1}.</span>
      <input type="text" class="cln-item-input cln-stock-name" value="${esc(it.name||"")}" data-idx="${i}" placeholder="자재명 (예: 점보롤)">
      <input type="number" class="cln-stock-qty" value="${Number(it.qty)||0}" data-idx="${i}" min="0" placeholder="수량" style="width:70px;text-align:right;padding:5px 6px;font-size:13px;border:1px solid var(--line);border-radius:7px;background:#fbfdff">
      <span style="font-size:12px;color:var(--ink-soft);flex:0 0 auto">개</span>
      <button type="button" class="cln-item-del" data-idx="${i}" title="삭제">🗑</button>
    </div>`).join("");
  box.querySelectorAll(".cln-stock-name").forEach(inp=>{
    inp.addEventListener("input",()=>{ arr[Number(inp.dataset.idx)].name = inp.value; });
    inp.addEventListener("keydown",e=>{ if(e.key==="Tab"){ e.preventDefault(); const q=inp.closest(".cln-item-row").querySelector(".cln-stock-qty"); if(q) q.focus(); } });
  });
  box.querySelectorAll(".cln-stock-qty").forEach(inp=>{
    inp.addEventListener("input",()=>{ arr[Number(inp.dataset.idx)].qty = Number(inp.value)||0; });
  });
  box.querySelectorAll(".cln-item-del").forEach(b=>b.addEventListener("click",()=>{
    arr.splice(Number(b.dataset.idx),1);
    renderClnStockItems(containerId, arr);
  }));
}

function renderCleaningItemList(type, containerId, arr){
  const box = $(containerId); if(!box) return;
  if(!arr.length){ box.innerHTML = `<div style="font-size:12px;color:var(--ink-soft);padding:6px 2px;font-style:italic">아직 항목이 없습니다 — ➕ 버튼으로 추가하세요</div>`; return; }
  box.innerHTML = arr.map((v,i)=>`
    <div class="cln-item-row">
      <span class="cln-item-no">${i+1}.</span>
      <input type="text" class="cln-item-input" value="${esc(v)}" data-idx="${i}" placeholder="내용 입력">
      <button type="button" class="cln-item-del" data-idx="${i}" title="삭제">🗑</button>
    </div>
  `).join("");
  box.querySelectorAll(".cln-item-input").forEach(inp=>{
    inp.addEventListener("input",()=>{ arr[Number(inp.dataset.idx)] = inp.value; });
    // v42: Enter → 새 항목 추가
    inp.addEventListener("keydown", e=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      arr[Number(inp.dataset.idx)] = inp.value; // 현재 값 저장
      arr.push("");
      renderCleaningItemList(type, containerId, arr);
      setTimeout(()=>{
        const inputs = box.querySelectorAll("input.cln-item-input");
        if(inputs.length) inputs[inputs.length-1].focus();
      }, 30);
    });
  });
  box.querySelectorAll(".cln-item-del").forEach(b=>b.addEventListener("click",()=>{
    arr.splice(Number(b.dataset.idx),1);
    renderCleaningItemList(type, containerId, arr);
  }));
}

function renderCleaningPhoto(){
  const area=$("cln-photoArea");
  if(!cleaningPhoto){ area.innerHTML=`<div style="font-size:12px;color:var(--ink-soft);margin-top:8px">사진을 올리면 AI 분석 버튼이 활성화됩니다.</div>`; return; }
  area.innerHTML=`<div class="thumbs" style="margin-top:8px"><div class="thumb" style="width:120px;height:120px"><img class="zimg" src="${cleaningPhoto}"><button class="rm" id="cln-rmPhoto">×</button></div></div>`;
  $("cln-rmPhoto").addEventListener("click",()=>{ cleaningPhoto=null; renderCleaningPhoto(); $("cln-aiBtn").disabled=true; });
}


async function handleCleaningPhoto(e){
  const f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f) return;
  try{
    cleaningPhoto=await compressImage(f, 1400, 0.7);
    renderCleaningPhoto();
    $("cln-aiBtn").disabled=false;
  }catch(err){ toast("사진 처리 실패"); }
}

async function cleaningAIAnalyze(){
  const key=(aiGetKey()||"").trim();
  if(!key){ toast("AI 탭에서 API 키부터 저장해주세요"); return; }
  if(!/^[\x20-\x7E]+$/.test(key)){
    toast("⚠ API 키에 잘못된 문자가 들어있어요. AI 탭에서 다시 저장하세요");
    return;
  }
  if(!cleaningPhoto){ toast("사진이 없습니다"); return; }
  const btn=$("cln-aiBtn");
  btn.disabled=true; btn.textContent="🤖 분석 중...";
  toast("AI가 일지를 읽고 있어요... 10~20초 걸려요");
  try{
    const staffNames=CLEAN_STAFF.map(s=>s.name).join(", ");
    const sys=`당신은 미화반 청소 일지 사진을 분석하는 도우미입니다. 한국어 손글씨로 작성된 일지 양식을 보고 데이터를 추출해 JSON으로만 응답하세요.

추출할 필드:
{
  "date": "YYYY-MM-DD" (일지의 날짜),
  "foreman": "반장 이름" (못 읽으면 "${CLEAN_FOREMAN}"),
  "staffWork": [
    {"name": "담당자명", "floors": "담당 층", "tissue": 점보롤 출고 수량, "towel": 핸드타월 출고 수량, "special": "문제점 및 특이사항"},
    ...
  ],
  "directorOrders": ["소장 지시사항 항목 1", "소장 지시사항 항목 2", ...],
  "directives": ["지시 및 전달사항 항목 1", "항목 2", ...],
  "specials": ["특기사항 항목 1", "특기사항 항목 2", ...],
  "tissueIn": 점보롤 입고 수량,
  "tissueOut": 점보롤 출고 수량,
  "towelIn": 핸드타월 입고 수량,
  "towelOut": 핸드타월 출고 수량
}

알려진 담당자 명단(참고): ${staffNames}
- 손글씨가 흐릿하면 합리적으로 추정.
- 수량은 빈칸이면 0.
- 점보롤/핸드타월 출고는 담당자별 "소모품 출고내역" 칸에서 읽으세요. "휴지" 칸은 점보롤을 의미합니다.
- 지시 및 전달사항·특기사항·소장 지시사항은 줄 단위로 분리하여 각각 배열에 넣으세요. (글머리표 ·, -, ※ 등은 제거)
- "소장 지시사항"이 별도로 보이지 않으면 빈 배열 [].
- 다른 설명 없이 JSON만 답하세요.`;
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({
        model:AI_MODEL, max_tokens:3000, system:sys,
        messages:[{role:"user", content:[
          {type:"image", source:{type:"base64", media_type:"image/jpeg", data:cleaningPhoto.split(",")[1]}},
          {type:"text", text:"이 청소 일지를 분석해서 JSON으로 추출해주세요."}
        ]}]
      })
    });
    if(!res.ok){ const j=await res.json().catch(()=>({})); throw new Error(j?.error?.message||`HTTP ${res.status}`); }
    const data=await res.json();
    const reply=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n").trim();
    const parsed=extractJsonFromAIReply(reply, false);
    // cleaningData에 적용 (사진은 유지)
    cleaningData={...cleaningData, ...parsed, photo: cleaningPhoto};
    if(!Array.isArray(cleaningData.staffWork)) cleaningData.staffWork=[];
    if(!Array.isArray(cleaningData.directorOrders)) cleaningData.directorOrders=[];
    if(!Array.isArray(cleaningData.directives)) cleaningData.directives=[];
    if(!Array.isArray(cleaningData.specials)) cleaningData.specials=[];
    renderCleaningModal(cleaningData.id);
    toast("✅ AI 분석 완료 — 내용 확인 후 수정/저장하세요");
  }catch(e){
    logErr("AI 청소분석", e);
    toast(`❌ ${e.message}`);
  }finally{
    btn.disabled=false; btn.textContent="🤖 AI 분석";
  }
}

// ===== 청소일지 저장 (자재 자동 연동) =====
async function saveCleaning(){
  const id = cleaningData && cleaningData.id;
  const cleanArr = arr => (arr||[]).map(s=>(s||"").trim()).filter(Boolean);
  const obj = {
    kind:"cleaning",
    date: $("cln-date").value || todayStr(),
    foreman: ($("cln-foreman").value||"").trim() || CLEAN_FOREMAN,
    directorOrders: cleanArr(cleaningData.directorOrders),
    directives: cleanArr(cleaningData.directives),
    specials: cleanArr(cleaningData.specials),
    // v42: 자유 입출고 항목
    inItems: (cleaningData.inItems||[]).filter(it=>it.name&&it.name.trim()),
    outItems: (cleaningData.outItems||[]).filter(it=>it.name&&it.name.trim()),
    photo: cleaningPhoto,
    staffWork: []
  };
  // 담당자별 데이터 수집
  document.querySelectorAll("#cln-staffBody tr[data-idx]").forEach(tr=>{
    const idx=Number(tr.dataset.idx);
    const src=cleaningData.staffWork[idx]||{};
    obj.staffWork.push({
      name: src.name||"",
      floors: tr.querySelector(".cln-floors").value||"",
      tissue: Number(tr.querySelector(".cln-tissue").value)||0,
      towel: Number(tr.querySelector(".cln-towel").value)||0,
      special: tr.querySelector(".cln-special").value||"",
    });
  });
  // 저장 또는 수정
  let savedRec;
  if(id){
    updateRecord(id, obj);
    savedRec={...obj, id};
    const linked=entries.filter(s=>s.kind==="stock"&&s.cleaningId===id).map(s=>s.id);
    linked.forEach(sid=>deleteRecord(sid));
  } else {
    obj.createdAt=Date.now();
    savedRec=addRecord(obj);
  }
  // 자재 연동
  await syncCleaningToStock(savedRec);
  $("cleaningOverlay").classList.remove("show");
  renderAll();
  toast(id?"수정되었습니다":"저장되었습니다");
}

// 점보롤/핸드타월 품목 자동 생성 보장
function ensureCleaningItem(name){
  let item=entries.find(e=>e.kind==="item" && (e.itemName||"").trim()===name);
  if(item) return item;
  return addRecord({
    kind:"item",
    itemCode: nextItemCode(),
    itemName: name,
    spec: "",
    unit: name==="점보롤"?"롤":"팩",
    field: "환경",
    vendor: "",
    unitPrice: 0,
    safetyStock: 0,
    recurring: "월간",
    location: "",
    memo: "청소 일지에서 자동 생성됨",
    createdAt: Date.now()
  });
}

async function syncCleaningToStock(cln){
  const dateStr = cln.date || todayStr();
  // v42: 자유 입출고 항목 처리
  const inItems = Array.isArray(cln.inItems) ? cln.inItems : [];
  const outItems = Array.isArray(cln.outItems) ? cln.outItems : [];

  for(const it of inItems){
    if(!it.name||!it.name.trim()||!(Number(it.qty)>0)) continue;
    const item = ensureCleaningItem(it.name.trim());
    addRecord({kind:"stock", date:dateStr, stockType:"입고", itemId:item.id, qty:Number(it.qty), unitPrice:0, amount:0, memo:`청소일지 ${dateStr} 입고`, cleaningId:cln.id, createdAt:Date.now()});
  }
  for(const it of outItems){
    if(!it.name||!it.name.trim()||!(Number(it.qty)>0)) continue;
    const item = ensureCleaningItem(it.name.trim());
    addRecord({kind:"stock", date:dateStr, stockType:"출고", itemId:item.id, qty:Number(it.qty), unitPrice:0, amount:0, useTarget:"청소 전체", memo:`청소일지 ${dateStr} 출고`, cleaningId:cln.id, createdAt:Date.now()});
  }
  // 담당자별 층별 출고 (tissue/towel 필드가 있으면 구버전 호환)
  (cln.staffWork||[]).forEach(s=>{
    if(Number(s.tissue)>0){
      const item=ensureCleaningItem("점보롤");
      addRecord({kind:"stock", date:dateStr, stockType:"출고", itemId:item.id, qty:Number(s.tissue), unitPrice:0, amount:0, useTarget:`${s.floors||""} (${s.name})`, memo:`청소일지 ${dateStr} 층별 출고`, cleaningId:cln.id, createdAt:Date.now()});
    }
    if(Number(s.towel)>0){
      const item=ensureCleaningItem("핸드타월");
      addRecord({kind:"stock", date:dateStr, stockType:"출고", itemId:item.id, qty:Number(s.towel), unitPrice:0, amount:0, useTarget:`${s.floors||""} (${s.name})`, memo:`청소일지 ${dateStr} 층별 출고`, cleaningId:cln.id, createdAt:Date.now()});
    }
  });
}

// ===== 명단 관리 모달 =====
function openCleanStaffMgr(){
  renderCleanStaffList();
  $("cleanStaffOverlay").classList.add("show");
}
function renderCleanStaffList(){
  $("cleanForemanInput").value = CLEAN_FOREMAN;
  $("cleanStaffList").innerHTML = CLEAN_STAFF.map((s,i)=>`
    <div class="cat-row" data-i="${i}">
      <input type="text" class="cr-name-edit" value="${esc(s.name)}" data-k="name" style="flex:1">
      <input type="text" class="cr-name-edit" value="${esc(s.floors)}" data-k="floors" placeholder="담당 층" style="flex:1.4">
      <button data-act="up" title="위로">▲</button>
      <button data-act="down" title="아래로">▼</button>
      <button class="danger" data-act="del" title="삭제">🗑</button>
    </div>
  `).join("") || `<div class="empty" style="padding:14px">등록된 담당자가 없습니다.</div>`;
  $("cleanStaffList").querySelectorAll(".cat-row").forEach(row=>{
    const i=Number(row.dataset.i);
    row.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",()=>{
      CLEAN_STAFF[i][inp.dataset.k] = inp.value;
    }));
    row.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>{
      const a=b.dataset.act;
      if(a==="up"&&i>0) [CLEAN_STAFF[i-1],CLEAN_STAFF[i]]=[CLEAN_STAFF[i],CLEAN_STAFF[i-1]];
      else if(a==="down"&&i<CLEAN_STAFF.length-1) [CLEAN_STAFF[i+1],CLEAN_STAFF[i]]=[CLEAN_STAFF[i],CLEAN_STAFF[i+1]];
      else if(a==="del"){
        if(!confirm(`${CLEAN_STAFF[i].name} 담당자를 명단에서 삭제하시겠습니까?\n(기존 일지의 데이터는 유지됩니다)`)) return;
        CLEAN_STAFF.splice(i,1);
      }
      saveCleanStaff();
      renderCleanStaffList();
    }));
  });
}


/* =========================================================
   v37: ⚡ 급한 메모 (Quick Memo)
   ========================================================= */
const QM_LS_TEXT = "wl_quickmemo_text_v37";
const QM_LS_PHOTOS = "wl_quickmemo_photos_v37";
let quickMemoPhotos = [];

function wireQuickMemo(){
  const btn = $("btnQuickMemo");
  if(btn) btn.addEventListener("click", toggleQuickMemo);
  // 단축키 Ctrl+Shift+M
  document.addEventListener("keydown", e=>{
    if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()==="m"){
      e.preventDefault();
      toggleQuickMemo();
    }
  });
  $("qmClose").addEventListener("click", closeQuickMemo);
  $("qmClear").addEventListener("click", clearQuickMemo);
  $("qmToMemo").addEventListener("click", quickMemoToFormal);
  $("qmFile").addEventListener("change", handleQmPhoto);
  // v42: 패널 밖 클릭 시 닫기
  document.addEventListener("click", e=>{
    const side = $("quickMemoSide");
    if(!side.classList.contains("show")) return;
    const qmBtn = $("btnQuickMemo");
    if(side.contains(e.target)) return;
    if(qmBtn && qmBtn.contains(e.target)) return;
    closeQuickMemo();
  });
  // v39: contenteditable div에 클립보드 paste — 사진은 인라인으로 삽입
  $("qmText").addEventListener("paste", async e=>{
    const cd = (e.clipboardData||window.clipboardData);
    if(!cd) return;
    const items = cd.items;
    if(!items) return;
    // 이미지 항목이 있으면 인라인 삽입
    for(const it of items){
      if(it.type && it.type.startsWith("image/")){
        e.preventDefault();
        const blob = it.getAsFile();
        if(!blob) continue;
        try{
          const dataUrl = await compressImage(blob, 1400, 0.75);
          insertImageAtCursor(dataUrl);
          $("qmStatus").textContent = "📷 사진이 본문에 들어갔어요";
          scheduleQmSave();
        }catch(err){ console.warn("paste image 실패", err); }
        return; // 첫 이미지만 처리하고 종료
      }
    }
    // 이미지 없으면 일반 텍스트 붙여넣기 (스타일 제거)
    e.preventDefault();
    const text = cd.getData("text/plain") || "";
    document.execCommand("insertText", false, text);
  });
  // 텍스트/사진 변경 시 자동 저장
  $("qmText").addEventListener("input", scheduleQmSave);
  // 사진 클릭 — 삭제 버튼은 별도, 사진 자체 클릭은 확대
  $("qmText").addEventListener("click", e=>{
    const rm = e.target.closest(".qm-inline-img-rm");
    if(rm){
      e.preventDefault();
      const wrap = rm.closest(".qm-inline-img-wrap");
      if(wrap){ wrap.remove(); scheduleQmSave(); }
      return;
    }
    const img = e.target.closest(".qm-inline-img-wrap img");
    if(img){
      e.preventDefault();
      openQmZoom(img.src);
    }
  });
  // 확대 오버레이 닫기
  $("qmZoomOverlay").addEventListener("click", ()=>$("qmZoomOverlay").classList.remove("show"));
  // 초기 로드
  loadQuickMemo();
}

function insertImageAtCursor(dataUrl){
  const wrapHtml = `<div class="qm-inline-img-wrap" contenteditable="false"><img src="${dataUrl}"><button type="button" class="qm-inline-img-rm" title="이 사진 삭제">×</button></div><br>`;
  // 커서 위치에 삽입
  const sel = window.getSelection();
  if(sel && sel.rangeCount){
    const range = sel.getRangeAt(0);
    const editor = $("qmText");
    if(editor.contains(range.startContainer)){
      range.deleteContents();
      const tmp = document.createElement("div");
      tmp.innerHTML = wrapHtml;
      const frag = document.createDocumentFragment();
      while(tmp.firstChild) frag.appendChild(tmp.firstChild);
      range.insertNode(frag);
      // 커서를 사진 뒤로
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
  }
  // 커서 위치를 못 찾으면 끝에 추가
  $("qmText").insertAdjacentHTML("beforeend", wrapHtml);
}

function openQmZoom(src){
  $("qmZoomImg").src = src;
  $("qmZoomOverlay").classList.add("show");
}

let qmSaveTimer = null;
function scheduleQmSave(){
  clearTimeout(qmSaveTimer);
  qmSaveTimer = setTimeout(()=>{
    try{ localStorage.setItem(QM_LS_TEXT, $("qmText").innerHTML); }catch(err){}
    const s=$("qmStatus"); if(s){ s.textContent="💾 자동 저장됨 "+new Date().toLocaleTimeString("ko-KR").slice(0,8); }
  }, 400);
}

function loadQuickMemo(){
  try{
    const t = localStorage.getItem(QM_LS_TEXT)||"";
    $("qmText").innerHTML = t;
    // 옛 quickMemoPhotos 배열 호환 (이전 버전 데이터 마이그레이션)
    const p = JSON.parse(localStorage.getItem(QM_LS_PHOTOS)||"[]");
    if(Array.isArray(p) && p.length){
      // 옛 사진들을 본문 끝에 추가
      p.forEach(src=>{
        $("qmText").insertAdjacentHTML("beforeend", `<div class="qm-inline-img-wrap" contenteditable="false"><img src="${src}"><button type="button" class="qm-inline-img-rm" title="이 사진 삭제">×</button></div><br>`);
      });
      localStorage.removeItem(QM_LS_PHOTOS);
      try{ localStorage.setItem(QM_LS_TEXT, $("qmText").innerHTML); }catch(e){}
    }
    quickMemoPhotos = []; // 이제 사용 안 함
  }catch(e){}
}

function toggleQuickMemo(){
  const side = $("quickMemoSide");
  if(side.classList.contains("show")){ closeQuickMemo(); }
  else { side.classList.add("show"); setTimeout(()=>$("qmText").focus(), 200); }
}
function closeQuickMemo(){
  $("quickMemoSide").classList.remove("show");
}
function clearQuickMemo(){
  if(!confirm("급한 메모 내용을 모두 지울까요? (되돌릴 수 없음)")) return;
  $("qmText").innerHTML = "";
  quickMemoPhotos = [];
  try{
    localStorage.removeItem(QM_LS_TEXT);
    localStorage.removeItem(QM_LS_PHOTOS);
  }catch(e){}
  $("qmStatus").textContent = "🗑 지워졌습니다";
}

// 파일 선택 버튼으로 사진 추가 (인라인 삽입)
async function handleQmPhoto(e){
  const files = Array.from(e.target.files||[]);
  e.target.value = "";
  for(const f of files){
    try{
      const dataUrl = await compressImage(f, 1400, 0.75);
      insertImageAtCursor(dataUrl);
    }catch(err){ console.warn("사진 처리 실패", err); }
  }
  scheduleQmSave();
  $("qmText").focus();
}

// renderQmPhotos는 더이상 필요 없음 (사진이 본문 안에 있음) - 빈 함수로 호환 유지
function renderQmPhotos(){
  // 빈 함수: 이제 사진은 qmText 안에 인라인으로 들어감
}

function quickMemoToFormal(){
  const editor = $("qmText");
  // 텍스트 추출
  const textOnly = (editor.innerText||"").trim();
  // 사진 추출
  const photos = Array.from(editor.querySelectorAll("img")).map(img=>img.src);
  if(!textOnly && !photos.length){ toast("저장할 내용이 없습니다"); return; }
  const firstLine = (textOnly.split("\n")[0]||"").slice(0,40);
  const title = firstLine || "급한 메모 "+todayStr();
  const memoRec = {
    kind: "memo",
    date: todayStr(),
    title,
    body: textOnly,
    photos,
    createdAt: Date.now()
  };
  addRecord(memoRec);
  // 정식 저장 후 지우기
  editor.innerHTML = "";
  quickMemoPhotos = [];
  try{
    localStorage.removeItem(QM_LS_TEXT);
    localStorage.removeItem(QM_LS_PHOTOS);
  }catch(e){}
  renderAll();
  toast(`✅ 메모 탭에 저장되었습니다: "${title.slice(0,30)}"`, 3500);
  $("qmStatus").textContent = "📋 정식 메모로 저장됨";
}


function wireGlobalSearch(){
  // 상단 고정 검색창
  const bar = $("globalSearchBar");
  if(bar){
    bar.addEventListener("focus", ()=>{
      openGlobalSearch();
      // 검색창 값을 팝업 input에 동기화
      setTimeout(()=>{ const gi=$("gsInput"); if(gi){ gi.value=bar.value; gi.focus(); if(bar.value) runGlobalSearch(bar.value); } }, 60);
    });
    bar.addEventListener("input", e=>{
      const gi=$("gsInput"); if(gi){ gi.value=e.target.value; runGlobalSearch(e.target.value); }
      if(!$("globalSearchOverlay").classList.contains("show")) openGlobalSearch();
    });
  }
  const btn = $("btnGlobalSearchTop");
  if(btn) btn.addEventListener("click", openGlobalSearch);
  // Ctrl+K 단축키
  document.addEventListener("keydown", e=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){
      e.preventDefault();
      if(bar){ bar.focus(); } else openGlobalSearch();
    }
    if(e.key==="Escape"){
      if($("globalSearchOverlay").classList.contains("show")){ closeGlobalSearch(); if(bar) bar.blur(); }
    }
  });
  $("gsClose").addEventListener("click", ()=>{ closeGlobalSearch(); if(bar){ bar.value=""; } });
  $("globalSearchOverlay").addEventListener("click", e=>{
    if(e.target===$("globalSearchOverlay")){ closeGlobalSearch(); if(bar) bar.blur(); }
  });
  $("gsInput").addEventListener("input", e=>{
    runGlobalSearch(e.target.value);
    if(bar) bar.value=e.target.value; // 팝업→상단 검색창 동기화
  });
  /* 🔍 엔터로 첫 결과 열기 */
  $("gsInput").addEventListener("keydown", function(e){
    if(e.key === 'Enter' || e.keyCode === 13){
      e.preventDefault();
      e.stopPropagation();
      var gi = $("gsInput");
      runGlobalSearch(gi.value);  /* 검색 즉시 실행 */
      setTimeout(function(){
        var firstItem = document.querySelector('#gsResults .gs-item');
        if(firstItem){
          firstItem.click();  /* 첫 결과 클릭 */
        } else if(typeof toast === 'function'){
          toast('검색 결과가 없어요');
        }
      }, 100);
    }
  });
}
function openGlobalSearch(){
  $("globalSearchOverlay").classList.add("show");
  setTimeout(()=>$("gsInput").focus(), 50);
  runGlobalSearch($("gsInput").value);
}
function closeGlobalSearch(){
  $("globalSearchOverlay").classList.remove("show");
}
function runGlobalSearch(q){
  const box = $("gsResults");
  q = (q||"").trim().toLowerCase();
  if(!q){
    box.innerHTML = `<div class="empty" style="padding:30px">검색어를 입력하세요 (예: <b>점검</b>, <b>비둘기</b>, <b>2026-05</b>, <b>김태경</b>)</div>`;
    return;
  }
  // 모든 entries에서 검색
  const matches = [];
  entries.forEach(e=>{
    const kind = e.kind;
    const text = collectSearchText(e).toLowerCase();
    if(text.includes(q)){
      matches.push({
        e, kind,
        preview: makeSearchPreview(e),
      });
    }
  });
  if(!matches.length){
    box.innerHTML = `<div class="empty" style="padding:30px">"${esc(q)}" 검색 결과 없음</div>`;
    return;
  }
  // 종류별로 그룹화
  const byKind = {};
  matches.forEach(m=>{ (byKind[m.kind]=byKind[m.kind]||[]).push(m); });
  const kindOrder = ["work","schedule","plan","memo","call","meeting","deliver","vacation","cleaning","expense","stock","item","filelink","site","password"];
  let html = `<div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px">📌 총 <b style="color:var(--primary-deep)">${matches.length}건</b>의 결과 — 클릭하면 해당 화면으로 이동</div>`;
  kindOrder.forEach(k=>{
    if(!byKind[k]) return;
    const lbl = KIND_LABEL[k]||k;
    html += `<div class="gs-group"><div class="gs-group-h">${esc(lbl)} <span class="gs-cnt">${byKind[k].length}</span></div>`;
    byKind[k].slice(0,30).forEach(m=>{
      html += `<div class="gs-item" data-kind="${m.kind}" data-id="${m.e.id}">${m.preview}</div>`;
    });
    if(byKind[k].length>30) html += `<div class="gs-more">+ ${byKind[k].length-30}건 더 (검색어를 더 좁혀주세요)</div>`;
    html += `</div>`;
  });
  box.innerHTML = html;
  box.querySelectorAll(".gs-item").forEach(el=>{
    el.addEventListener("click",()=>{
      const kind = el.dataset.kind, id = el.dataset.id;
      closeGlobalSearch();
      // 해당 탭으로 이동
      const tabMap = {work:"work", schedule:"work", plan:"plan", memo:"memo", call:"call", meeting:"meeting", deliver:"deliver", vacation:"vacation", cleaning:"cleaning", expense:"expense", stock:"material", item:"material", filelink:"filelink", site:"site", password:"password"};
      const tab = tabMap[kind] || "work";
      activateTab(tab);
      // 모달 열기
      setTimeout(()=>{
        if(kind==="cleaning") openCleaningEditor(id);
        else if(kind==="expense") openExpenseEditor(id);
        else openViewer(kind, id);
      }, 200);
    });
  });
}
function collectSearchText(e){
  const parts = [];
  Object.keys(e).forEach(k=>{
    const v = e[k];
    if(typeof v === "string") parts.push(v);
    else if(typeof v === "number") parts.push(String(v));
    else if(Array.isArray(v)){
      v.forEach(x=>{
        if(typeof x === "string") parts.push(x);
        else if(x && typeof x === "object") parts.push(JSON.stringify(x));
      });
    }
  });
  return parts.join(" ");
}
function makeSearchPreview(e){
  const lbl = KIND_LABEL[e.kind]||e.kind;
  const date = e.date || e.start || "";
  let title="", subtitle="";
  if(e.kind==="work"){ title = e.title||"(제목없음)"; subtitle = `${e.floor||""} ${e.loc||""} · ${e.status||""}`.trim(); }
  else if(e.kind==="schedule"){ title = e.title||"(제목없음)"; subtitle = `${e.sStatus||""} · ${e.sType||""}`; }
  else if(e.kind==="plan"){ title = e.title||"(제목없음)"; subtitle = e.memo||""; }
  else if(e.kind==="memo"){ title = e.title||"(제목없음)"; subtitle = (e.content||"").slice(0,60); }
  else if(e.kind==="call"){ title = e.who||e.from||"(통화)"; subtitle = `${e.time||""} ${e.dir||""} · ${(e.content||"").slice(0,40)}`; }
  else if(e.kind==="meeting"){ title = e.title||"(회의)"; subtitle = (e.content||"").slice(0,60); }
  else if(e.kind==="deliver"){ title = e.title||"(전달사항)"; subtitle = (e.content||"").slice(0,60); }
  else if(e.kind==="vacation"){ title = e.name||"휴가"; subtitle = `${e.vtype||""} ${e.start||""}~${e.end||""}`; }
  else if(e.kind==="cleaning"){ title = `청소일지 ${e.date||""}`; subtitle = `반장 ${e.foreman||""}`; }
  else if(e.kind==="expense"){ title = e.title||""; subtitle = `${e.expType||"개인지출"} · ${won(Number(e.amount)||0)}원`; }
  else if(e.kind==="item"){ title = e.itemName||""; subtitle = `${e.shopId||""} ${e.spec||""}`; }
  else if(e.kind==="stock"){
    const it = entries.find(x=>x.id===e.itemId);
    title = `${e.stockType||""} ${(it&&it.itemName)||"(품목)"}`;
    subtitle = `${e.qty||0} × ${won(Number(e.unitPrice)||0)} = ${won(Number(e.amount)||0)}원`;
  }
  else if(e.kind==="filelink"){ title = e.label||""; subtitle = `${e.category||""} · ${e.path||""}`; }
  else if(e.kind==="site"){ title = e.name||""; subtitle = `${e.category||""} · ${e.url||""}`; }
  else if(e.kind==="password"){ title = e.name||""; subtitle = e.user||""; }
  return `<div class="gs-i-title"><span class="gs-i-lbl">${esc(lbl)}</span> ${esc(title).slice(0,70)}</div>${subtitle?`<div class="gs-i-sub">${esc(subtitle).slice(0,90)}</div>`:""}${date?`<div class="gs-i-date">📅 ${esc(date)}</div>`:""}`;
}


const EXP_FILTER = { tab:"personal", q:"", ym:"" };

function wireExpenseTab(){
  // 서브탭 전환
  document.querySelectorAll("[data-exptab]").forEach(b=>b.addEventListener("click",()=>{
    EXP_FILTER.tab = b.dataset.exptab;
    document.querySelectorAll("[data-exptab]").forEach(x=>{
      x.classList.toggle("active",x===b);
      // 인라인 스타일 버튼도 업데이트
      if(x.classList.contains("mat-tab")){
        if(x===b){
          x.style.background="var(--primary)"; x.style.color="#fff"; x.style.borderColor="var(--primary)";
        } else {
          x.style.background="#fff"; x.style.color="var(--ink)"; x.style.borderColor="var(--line)";
        }
      }
    });
    EXP_FILTER.ym=""; // 탭 전환 시 월 초기화
    renderExpense();
  }));
  const _expSearch=$("expSearch"); if(_expSearch) _expSearch.addEventListener("input",e=>{ EXP_FILTER.q=e.target.value; renderExpense(); });
  $("expMonthFilter").addEventListener("change",e=>{ EXP_FILTER.ym=e.target.value; renderExpense(); });
  $("btnAddExpense").addEventListener("click",()=>openExpenseEditor(null));
  $("btnExpExcel").addEventListener("click",copyExpenseExcel);
}

/* ===== v44: 사고 처리 내역 ===== */
const ACCIDENT_FILTER = { status:"전체", type:"all", from:"", to:"" };
var ACCIDENT_STATUS = ["⏳ 접수","🔍 조사중","⚙ 처리중","✅ 완료","📋 종결"];
var ACCIDENT_STATUS_COLOR = {
  "⏳ 접수": {bg:"#fef3c7", fg:"#92400e", border:"#f59e0b"},
  "🔍 조사중": {bg:"#dbeafe", fg:"#1e40af", border:"#3b82f6"},
  "⚙ 처리중": {bg:"#fce7f3", fg:"#9f1239", border:"#ec4899"},
  "✅ 완료": {bg:"#d1fae5", fg:"#065f46", border:"#10b981"},
  "📋 종결": {bg:"#e5e7eb", fg:"#374151", border:"#6b7280"},
};
const ACCIDENT_TYPE_ICON = {
  "누수":"💧","화재":"🔥","미끄러짐":"🛝","추락":"⬇","차량파손":"🚗",
  "도난":"🔓","폭행/시비":"⚠️","엘리베이터":"🛗","주차장":"🅿️","승강기":"🛗","감전":"⚡","기타":"📌"
};

function setupAccidentTab(){
  // 상태 칩 렌더
  renderAccidentStatusChips();
  // 추가 버튼
  const addBtn = document.getElementById("btnAddAccident");
  if(addBtn && !addBtn._wired){
    addBtn._wired = true;
    addBtn.addEventListener("click", ()=>openEditor("accident", null));
  }
  // 종류 필터
  const typeSel = document.getElementById("accidentTypeFilter");
  if(typeSel && !typeSel._wired){
    typeSel._wired = true;
    typeSel.addEventListener("change", ()=>{
      ACCIDENT_FILTER.type = typeSel.value;
      renderAccidents();
    });
  }
  // 기간 필터
  const fromEl = document.getElementById("accidentDateFrom");
  const toEl = document.getElementById("accidentDateTo");
  const clearEl = document.getElementById("accidentDateClear");
  if(fromEl && !fromEl._wired){
    fromEl._wired = true;
    fromEl.addEventListener("change", ()=>{ ACCIDENT_FILTER.from = fromEl.value; renderAccidents(); });
  }
  if(toEl && !toEl._wired){
    toEl._wired = true;
    toEl.addEventListener("change", ()=>{ ACCIDENT_FILTER.to = toEl.value; renderAccidents(); });
  }
  if(clearEl && !clearEl._wired){
    clearEl._wired = true;
    clearEl.addEventListener("click", ()=>{
      ACCIDENT_FILTER.from = "";
      ACCIDENT_FILTER.to = "";
      if(fromEl) fromEl.value = "";
      if(toEl) toEl.value = "";
      renderAccidents();
    });
  }
}

function renderAccidentStatusChips(){
  const box = document.getElementById("accidentStatusChips");
  if(!box) return;
  const allAccidents = entries.filter(e=>e.kind==="accident");
  // 전체 + 상태별 카운트
  const counts = {};
  ACCIDENT_STATUS.forEach(s=>{ counts[s] = allAccidents.filter(a=>a.status===s).length; });
  let html = `<button class="acc-chip" data-acc-status="전체" style="padding:8px 14px;border-radius:20px;border:2px solid ${ACCIDENT_FILTER.status==='전체'?'#1a2f45':'#dbe6f4'};background:${ACCIDENT_FILTER.status==='전체'?'#1a2f45':'#fff'};color:${ACCIDENT_FILTER.status==='전체'?'#fff':'#1a2f45'};font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">📋 전체 ${allAccidents.length}</button>`;
  ACCIDENT_STATUS.forEach(s=>{
    const c = ACCIDENT_STATUS_COLOR[s];
    const isActive = ACCIDENT_FILTER.status===s;
    html += `<button class="acc-chip" data-acc-status="${esc(s)}" style="padding:8px 14px;border-radius:20px;border:2px solid ${isActive?c.border:'#dbe6f4'};background:${isActive?c.border:c.bg};color:${isActive?'#fff':c.fg};font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">${esc(s)} ${counts[s]}</button>`;
  });
  box.innerHTML = html;
  box.querySelectorAll(".acc-chip").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      ACCIDENT_FILTER.status = btn.dataset.accStatus;
      renderAccidents();
    });
  });
}

function renderAccidents(){
  setupAccidentTab();
  renderAccidentStatusChips();
  const list = document.getElementById("accidentList");
  if(!list) return;
  let arr = entries.filter(e=>e.kind==="accident");
  // 필터링
  if(ACCIDENT_FILTER.status !== "전체") arr = arr.filter(a=>a.status===ACCIDENT_FILTER.status);
  if(ACCIDENT_FILTER.type !== "all") arr = arr.filter(a=>a.accType===ACCIDENT_FILTER.type);
  if(ACCIDENT_FILTER.from) arr = arr.filter(a=>(a.date||"")>=ACCIDENT_FILTER.from);
  if(ACCIDENT_FILTER.to) arr = arr.filter(a=>(a.date||"")<=ACCIDENT_FILTER.to);
  // 최신순 정렬
  arr.sort((a,b)=>(b.date||"").localeCompare(a.date||"") || (b.time||"").localeCompare(a.time||""));
  // 카운트 표시
  const cnt = document.getElementById("accidentCount");
  if(cnt) cnt.textContent = `${arr.length}건`;
  if(!arr.length){
    list.style.cssText = '';
    list.innerHTML = `<div style="padding:60px 20px;text-align:center;color:#aab8c8;background:#f7faff;border-radius:12px">
      <div style="font-size:40px;margin-bottom:10px">🚨</div>
      <div style="font-size:14px;font-weight:700">사고 기록이 없어요</div>
      <div style="font-size:12px;margin-top:6px">상단 "➕ 사고 등록" 버튼으로 등록하세요</div>
    </div>`;
    return;
  }
  /* v44-fix: 다열 그리드 적용 */
  list.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(480px,1fr));gap:10px';
  list.innerHTML = arr.map(a=>{
    const c = ACCIDENT_STATUS_COLOR[a.status] || ACCIDENT_STATUS_COLOR["⏳ 접수"];
    const icon = ACCIDENT_TYPE_ICON[a.accType] || "📌";
    const totalCost = (Number(a.repairCost)||0)+(Number(a.compensation)||0)+(Number(a.insurance)||0);
    return `<div class="acc-card" data-acc-id="${a.id}" style="background:#fff;border:1.5px solid #e8f0fa;border-left:4px solid ${c.border};border-radius:12px;padding:14px 16px;cursor:pointer;transition:box-shadow .12s">
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-size:20px">${icon}</span>
            <span style="font-size:11px;font-weight:700;background:${c.bg};color:${c.fg};padding:3px 8px;border-radius:6px">${esc(a.status||'⏳ 접수')}</span>
            <span style="font-size:11px;font-weight:700;background:#f0f6ff;color:#3f7cb8;padding:3px 8px;border-radius:6px">${esc(a.accType||'기타')}</span>
            ${a.partyType?`<span style="font-size:11px;color:#7a92a8">${esc(a.partyType)}</span>`:''}
          </div>
          <div style="font-size:15px;font-weight:700;color:#1a2f45;margin-bottom:4px">${esc(a.title||'(제목 없음)')}</div>
          <div style="font-size:12px;color:#7a92a8;display:flex;gap:12px;flex-wrap:wrap">
            <span>📅 ${esc(a.date||'')} ${esc(a.time||'')}</span>
            ${a.floor?`<span>🏢 ${esc(a.floor)}${a.location?' · '+esc(a.location):''}</span>`:(a.location?`<span>📍 ${esc(a.location)}</span>`:'')}
            ${a.partyName?`<span>👤 ${esc(a.partyName)}${a.partyPhone?' · '+esc(a.partyPhone):''}</span>`:''}
          </div>
          ${a.detail?`<div style="font-size:12.5px;color:#33567d;margin-top:6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(a.detail)}</div>`:''}
          ${a.steps&&a.steps.length?`<div style="margin-top:8px;padding:8px 10px;background:#fff8e1;border:1px solid #ffd54f;border-radius:8px">
            <div style="font-size:11px;color:#7c5e1a;font-weight:700;margin-bottom:4px">📋 처리 단계 ${a.steps.length}건 · 최근: ${esc((a.steps[a.steps.length-1].date||''))}</div>
            <div style="font-size:12px;color:#1a2f45">▶ ${esc(a.steps[a.steps.length-1].action||'(내용 없음)')}${a.steps[a.steps.length-1].vendor?` · 🏢 ${esc(a.steps[a.steps.length-1].vendor)}`:''}</div>
          </div>`:''}
          ${a.photos&&a.photos.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            ${a.photos.slice(0,4).map(p=>`<img src="${esc(p)}" style="width:54px;height:54px;object-fit:cover;border-radius:6px;border:1px solid #e8f0fa">`).join('')}
            ${a.photos.length>4?`<div style="width:54px;height:54px;background:#f0f6ff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#3f7cb8">+${a.photos.length-4}</div>`:''}
          </div>`:''}
        </div>
        ${totalCost>0?`<div style="text-align:right;font-size:14px;font-weight:800;color:#e74c3c;white-space:nowrap">💰 ${won(totalCost)}</div>`:''}
      </div>
    </div>`;
  }).join("");
  list.querySelectorAll(".acc-card").forEach(card=>{
    card.addEventListener("mouseenter", ()=>card.style.boxShadow="0 4px 16px rgba(0,0,0,.08)");
    card.addEventListener("mouseleave", ()=>card.style.boxShadow="");
    card.addEventListener("click", ()=>openEditor("accident", card.dataset.accId));
  });
}

function renderExpense(){
  // 월 필터 옵션 초기화 (있는 월만)
  const monthSel = $("expMonthFilter");
  if(monthSel){
    const allExp = entries.filter(e=>e.kind==="expense");
    const months = [...new Set(allExp.map(e=>{
      const d = e.date||e.createdAt&&new Date(e.createdAt).toISOString().slice(0,10)||"";
      return d.slice(0,7);
    }).filter(Boolean))].sort().reverse();
    const curYM = todayStr().slice(0,7); // 현재 월
    // EXP_FILTER.ym 없으면 현재 월 기본 선택
    if(!EXP_FILTER.ym) EXP_FILTER.ym = months.includes(curYM) ? curYM : "";
    monthSel.innerHTML = `<option value="">전체 월</option>` + months.map(m=>`<option value="${m}">${m}</option>`).join("");
    monthSel.value = EXP_FILTER.ym && months.includes(EXP_FILTER.ym) ? EXP_FILTER.ym : "";
  }
  // 월별 통계
  renderExpenseStats();
  // 필터된 목록
  const expType = EXP_FILTER.tab==="personal" ? "개인지출" : "세금계산서";
  const list = entries.filter(e=>e.kind==="expense"
    && (e.expType||"개인지출")===expType
    && (!EXP_FILTER.ym || (e.date||"").startsWith(EXP_FILTER.ym))
    && (!EXP_FILTER.q.trim() || [e.title,e.memo,e.date].filter(Boolean).join(" ").toLowerCase().includes(EXP_FILTER.q.trim().toLowerCase()))
  ).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const body = $("expBody");
  if(!list.length){
    body.innerHTML = `<tr><td colspan="7" class="empty">${EXP_FILTER.tab==="personal"?"개인 지출":"세금계산서"} 내역이 없습니다.</td></tr>`;
    $("expTotal").innerHTML = "";
    return;
  }
  let total=0;
  const isPersonal = EXP_FILTER.tab==="personal";
  body.innerHTML = list.map((e,i)=>{
    const amt = Number(e.amount)||0; total+=amt;
    const rowStyle = isPersonal
      ? "background:linear-gradient(90deg,#f0f9ff 0%,#fff 100%)" // 개인지출: 하늘
      : "background:linear-gradient(90deg,#fff8f0 0%,#fff 100%)"; // 세금계산서: 주황
    const amtColor = isPersonal ? "#0369a1" : "#c2410c";
    const badge = isPersonal
      ? `<span class="pill tech" style="font-size:10px">💸품의</span>`
      : `<span class="pill amount" style="font-size:10px">📃세금</span>`;
    return `<tr data-id="${e.id}" style="${rowStyle}">
      <td class="num" style="color:#888">${i+1}</td>
      <td>${badge} <b>${esc(e.title||"")}</b>${e.workId?` <span style="font-size:11px;color:#aaa">🔗업무연동</span>`:""}${e.photo?'<span style="margin-left:5px;font-size:13px">📷</span>':""}</td>
      <td class="num" style="font-weight:800;color:${amtColor}">${won(amt)}</td>
      <td>${esc(e.vendor||"")}</td>
      <td>${esc(e.date||"")}</td>
      <td>${esc(e.memo||"").slice(0,30)}</td>
      <td><button class="rowdel" data-del title="삭제">🗑</button></td>
    </tr>`;
  }).join("");
  const totalColor = isPersonal ? "#0369a1" : "#c2410c";
  $("expTotal").innerHTML = `합계: <b style="color:${totalColor};font-size:16px">${won(total)}원</b> <span style="color:#888">(${list.length}건)</span>`;
  body.querySelectorAll("tr[data-id]").forEach(tr=>{
    const id=tr.dataset.id;
    tr.addEventListener("click",e=>{ if(e.target.closest("[data-del]")) return; openExpenseEditor(id); });
    tr.querySelector("[data-del]").addEventListener("click",e=>{ e.stopPropagation(); deleteWithUndo(id, "지출 내역"); });
  });
}

function renderExpenseStats(){
  const box = $("expStats"); if(!box) return;
  const all = entries.filter(e=>e.kind==="expense");
  if(!all.length){ box.innerHTML=""; return; }
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  // 이번달 + 전체 모두 보여줌
  const filterByType = (type) => all.filter(e=>(e.expType||"개인지출")===type)
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const personalAll = filterByType("개인지출");
  const taxAll = filterByType("세금계산서");
  const personalThis = personalAll.filter(e=>(e.date||"").startsWith(ym));
  const taxThis = taxAll.filter(e=>(e.date||"").startsWith(ym));
  const personalSum = personalThis.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const taxSum = taxThis.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const personalSumAll = personalAll.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const taxSumAll = taxAll.reduce((s,e)=>s+(Number(e.amount)||0),0);
  // 표시할 항목들 (이번달 우선, 없으면 최근 10건)
  const showItems = (thisMonth, allArr) => {
    const showList = thisMonth.length ? thisMonth : allArr.slice(0,10);
    if(!showList.length) return `<div class="es-empty">아직 내역이 없습니다</div>`;
    const lblPrefix = thisMonth.length ? "" : `<div class="es-recent-lbl">📋 최근 10건</div>`;
    return lblPrefix + `<div class="es-items">` + showList.map(e=>
      `<div class="es-item" data-id="${e.id}" title="${esc(e.date||"")} · ${esc(e.memo||"")}">
        <span class="es-i-date">${esc((e.date||"").slice(5))}</span>
        <span class="es-i-title">${esc(e.title||"(제목없음)")}</span>
        <span class="es-i-amt">${won(Number(e.amount)||0)}</span>
      </div>`
    ).join("") + `</div>`;
  };
  box.innerHTML = `
    <div class="exp-stat-row">
      <div class="exp-stat-card exp-stat-personal">
        <div class="es-h">💸 ${ym} 개인 지출 <span class="es-h-sub">전체 ${won(personalSumAll)}원</span></div>
        <div class="es-v">${won(personalSum)}<span class="es-u">원</span></div>
        <div class="es-s">이번달 ${personalThis.length}건 · 전체 ${personalAll.length}건</div>
        ${showItems(personalThis, personalAll)}
      </div>
      <div class="exp-stat-card exp-stat-tax">
        <div class="es-h">📃 ${ym} 세금계산서 <span class="es-h-sub">전체 ${won(taxSumAll)}원</span></div>
        <div class="es-v">${won(taxSum)}<span class="es-u">원</span></div>
        <div class="es-s">이번달 ${taxThis.length}건 · 전체 ${taxAll.length}건</div>
        ${showItems(taxThis, taxAll)}
      </div>
    </div>
  `;
  box.querySelectorAll(".es-item").forEach(el=>{
    el.addEventListener("click",()=>openExpenseEditor(el.dataset.id));
  });
}

// ===== 지출 추가/수정 모달 =====
let expenseData = null;
let expensePhoto = null;

/* v44: 업무 저장 후 호출됨 - 업무 데이터로 지출 모달 자동 채워서 열기 */
function openExpenseFromWork(info){
  const w = info.workObj || {};
  const expType = info.expType || "개인비용";
  const isPersonal = expType === "개인비용";
  // 지출 모달 데이터 준비 (업무 정보로 자동 채움)
  // 단가/택배비/합계는 사용자가 지출 모달에서 직접 입력
  expenseData = {
    date: w.date || todayStr(),
    expType: isPersonal ? "개인지출" : "세금계산서",
    utype: isPersonal ? "자재구매" : "공사/용역",
    title: w.title || "",  // 업무내역 → 지출 내역에 자동 채움
    vendor: w.workVendor || "",
    field: w.field || "",
    matName: isPersonal ? (w.material || "") : "",
    spec: w.matSpec || "",
    qty: isPersonal ? (Number(w.qty) || 1) : 1,
    unitPrice: 0,
    deliveryFee: 0,
    amount: 0,
    memo: w.workNote || ((w.floor||"")+(w.field?" ["+w.field+"]":"")),
    workId: info.workId,  // 업무와 연결
    photo: null
  };
  expensePhoto = null;
  // 탭도 해당 종류로 전환
  EXP_FILTER.tab = isPersonal ? "personal" : "tax";
  renderExpenseModal(null);
  $("expenseOverlay").classList.add("show");
  const m=$("expenseOverlay").querySelector(".modal"); if(m) m.scrollTop=0;
  // 안내 토스트
  toast(`💡 ${isPersonal?"💸 개인비용":"📃 후불청구"} 작성 — 업무 정보가 자동 입력됐어요`);
}

function openExpenseEditor(id){
  expenseData = id ? Object.assign({}, entries.find(e=>e.id===id)||{}) : {
    date: todayStr(),
    expType: EXP_FILTER.tab==="personal" ? "개인지출" : "세금계산서",
    title: "",
    amount: 0,
    memo: "",
    photo: null
  };
  expensePhoto = expenseData.photo || null;
  renderExpenseModal(id);
  $("expenseOverlay").classList.add("show");
  const m=$("expenseOverlay").querySelector(".modal"); if(m) m.scrollTop=0;
}

function renderExpenseModal(id){
  $("expTitle").textContent = (id?"수정":"추가")+" · 💰 지출 내역";
  const d = expenseData;
  const fieldOpts = (typeof FIELDS!=="undefined"?FIELDS:["전기","기계/냉난방","소방","영선","청소","기타"])
    .map(f=>`<option value="${esc(f)}" ${d.field===f?"selected":""}>${esc(f)}</option>`).join("");
  const utype = d.utype||"자재구매"; // 유형: 자재구매/공사용역/택배/기타

  // 유형별 추가 필드
  const typeFields = {
    "자재구매": `
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>자재명 <span class="req">*</span></label><input type="text" id="exp-matname" value="${esc(d.matName||"")}" placeholder="예: 형광등, 소화기"></div>
        <div class="field"><label>규격/사양</label><input type="text" id="exp-spec" value="${esc(d.spec||"")}" placeholder="예: 36W, 3.3kg"></div>
      </div>
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>단가 (원)</label><input type="number" id="exp-unitprice" value="${d.unitPrice||''}" min="0" oninput="expCalcTotal()"></div>
        <div class="field"><label>수량</label><input type="number" id="exp-qty" value="${Number(d.qty)||1}" min="1" oninput="expCalcTotal()"></div>
      </div>
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>택배비</label><input type="number" id="exp-delivery" value="${d.deliveryFee||''}" min="0" oninput="expCalcTotal()"></div>
        <div class="field"><label>합계 (원) <span class="req">*</span></label><input type="number" id="exp-amount" value="${d.amount||''}" min="0" placeholder="자동계산"></div>
      </div>`,
    "공사/용역": `
      <div class="field full" style="margin-top:10px">
        <label>공사/용역명 <span class="req">*</span></label>
        <input type="text" id="exp-matname" value="${esc(d.matName||"")}" placeholder="예: 외벽 도색, 엘리베이터 점검">
      </div>
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>계약금액 (원) <span class="req">*</span></label><input type="number" id="exp-amount" value="${d.amount||''}" min="0"></div>
        <div class="field"><label>택배비</label><input type="number" id="exp-delivery" value="${d.deliveryFee||''}" min="0"></div>
      </div>`,
    "택배": `
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>품목</label><input type="text" id="exp-matname" value="${esc(d.matName||"")}" placeholder="예: 소화기 부품"></div>
        <div class="field"><label>택배비 (원) <span class="req">*</span></label><input type="number" id="exp-amount" value="${d.amount||''}" min="0"></div>
      </div>`,
    "기타": `
      <div class="field full" style="margin-top:10px">
        <label>금액 (원) <span class="req">*</span></label>
        <input type="number" id="exp-amount" value="${d.amount||''}" min="0">
      </div>`
  };

  $("expFields").innerHTML = `
    <div class="grid">
      <div class="field"><label>날짜 <span class="req">*</span></label><input type="date" id="exp-date" value="${esc(d.date||todayStr())}"></div>
      <div class="field">
        <label>지출유형 <span class="req">*</span></label>
        <select id="exp-utype" onchange="expChangeType(this.value)">
          <option value="자재구매" ${utype==="자재구매"?"selected":""}>🛒 자재구매</option>
          <option value="공사/용역" ${utype==="공사/용역"?"selected":""}>🏗 공사/용역</option>
          <option value="기타" ${utype==="기타"?"selected":""}>📝 기타</option>
        </select>
      </div>
    </div>
    <div class="grid" style="margin-top:10px">
      <div class="field">
        <label>분야
          <button onclick="openExpFieldMgr()" style="margin-left:6px;font-size:11px;padding:2px 8px;border:1px solid #dbe6f4;border-radius:6px;background:#f7faff;cursor:pointer;font-family:inherit;color:#3f7cb8;font-weight:700">⚙ 관리</button>
        </label>
        <select id="exp-field">
          <option value="">-- 선택 --</option>
          ${loadExpFields().map(f=>`<option value="${esc(f)}" ${d.field===f?"selected":""}>${esc(f)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>정산종류</label>
        <select id="exp-type">
          <option value="개인지출" ${(d.expType==="개인지출")?"selected":""}>💸 개인지출</option>
          <option value="세금계산서" ${(d.expType==="세금계산서")?"selected":""}>📃 세금계산서</option>
        </select>
      </div>
    </div>
    <div class="field full" style="margin-top:10px">
      <label>내역 <span class="req">*</span></label>
      <input type="text" id="exp-title" value="${esc(d.title||"")}" placeholder="예: 종량제 봉투 구매, 외벽 도색 공사">
    </div>
    <div class="field full" style="margin-top:10px">
      <label>업체명</label>
      <input type="text" id="exp-vendor" value="${esc(d.vendor||"")}" placeholder="예: 삼성에어컨, 한국전기">
    </div>
    <div id="exp-typeFields">${typeFields[utype]||typeFields["기타"]}</div>
    <div class="field full" style="margin-top:10px">
      <label>비고</label>
      <input type="text" id="exp-memo" value="${esc(d.memo||"")}" placeholder="예: 5층 창고 보관">
    </div>
    <div class="field full" style="margin-top:14px">
      <label>📷 영수증 사진 (선택)</label>
      <div class="photo-btns">
        <label class="photo-btn">📷 촬영<input type="file" id="exp-cam" accept="image/*" capture="environment" style="display:none"></label>
        <label class="photo-btn">🖼 사진 선택<input type="file" id="exp-file" accept="image/*" style="display:none"></label>
      </div>
      <div id="exp-photoArea"></div>
    </div>
  `;
  renderExpensePhoto();
  $("exp-cam").addEventListener("change",e=>handleExpensePhoto(e));
  $("exp-file").addEventListener("change",e=>handleExpensePhoto(e));
  $("expDelete").style.display = id?"":"none";
}

// 유형 변경 시 필드 전환
function expChangeType(utype){
  const typeFields = {
    "자재구매": `
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>자재명 <span class="req">*</span></label><input type="text" id="exp-matname" placeholder="예: 형광등, 소화기"></div>
        <div class="field"><label>규격/사양</label><input type="text" id="exp-spec" placeholder="예: 36W, 3.3kg"></div>
      </div>
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>단가 (원)</label><input type="number" id="exp-unitprice" value="" placeholder="0" min="0" oninput="expCalcTotal()"></div>
        <div class="field"><label>수량</label><input type="number" id="exp-qty" value="1" min="1" oninput="expCalcTotal()"></div>
      </div>
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>택배비</label><input type="number" id="exp-delivery" value="" placeholder="0" min="0" oninput="expCalcTotal()"></div>
        <div class="field"><label>합계 (원) <span class="req">*</span></label><input type="number" id="exp-amount" value="" placeholder="0" min="0" placeholder="자동계산"></div>
      </div>`,
    "공사/용역": `
      <div class="field full" style="margin-top:10px">
        <label>공사/용역명</label>
        <input type="text" id="exp-matname" placeholder="예: 외벽 도색, 엘리베이터 점검">
      </div>
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>계약금액 (원) <span class="req">*</span></label><input type="number" id="exp-amount" value="" placeholder="0" min="0"></div>
        <div class="field"><label>택배비</label><input type="number" id="exp-delivery" value="" placeholder="0" min="0"></div>
      </div>`,
    "기타": `
      <div class="field full" style="margin-top:10px">
        <label>금액 (원) <span class="req">*</span></label>
        <input type="number" id="exp-amount" value="" placeholder="0" min="0">
      </div>`
  };
  const box = $("exp-typeFields");
  if(box) box.innerHTML = typeFields[utype]||typeFields["기타"];
}

// 합계 자동계산 (자재구매)
function expCalcTotal(){
  const up = Number($("exp-unitprice")||{value:0}).value||0;
  const qty = Number($("exp-qty")||{value:1}).value||1;
  const del = Number($("exp-delivery")||{value:0}).value||0;
  const total = (up*qty)+del;
  const amtEl = $("exp-amount");
  if(amtEl) amtEl.value = total;
}

function renderExpensePhoto(){
  const area = $("exp-photoArea");
  if(!expensePhoto){ area.innerHTML = `<div style="font-size:12px;color:var(--ink-soft);margin-top:6px">영수증을 촬영하거나 사진으로 첨부하세요. (선택)</div>`; return; }
  area.innerHTML = `<div class="thumbs" style="margin-top:8px"><div class="thumb" style="width:120px;height:120px"><img class="zimg" src="${expensePhoto}"><button class="rm" id="exp-rmPhoto">×</button></div></div>`;
  $("exp-rmPhoto").addEventListener("click",()=>{ expensePhoto=null; renderExpensePhoto(); });
}
async function handleExpensePhoto(e){
  const f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f) return;
  try{ expensePhoto = await compressImage(f, 1400, 0.7); renderExpensePhoto(); }
  catch(err){ toast("사진 처리 실패"); }
}

// 지출 분야 관리 모달
function openWorkVendorMgr(){
  const overlay = document.getElementById('workVendorMgrOverlay');
  if(!overlay){
    const el=document.createElement('div');
    el.id='workVendorMgrOverlay';
    el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:none;align-items:flex-end;justify-content:center';
    el.innerHTML=`
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:520px;padding:24px 20px 32px;box-shadow:0 -4px 32px rgba(0,0,0,.15)">
        <h3 style="margin:0 0 16px;font-size:17px;font-weight:800;color:#1a2f45">🏢 담당업체 관리</h3>
        <div id="workVendorList" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto;margin-bottom:14px"></div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input type="text" id="workVendorNew" placeholder="새 업체명" style="flex:1;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:15px;font-family:inherit;background:#f7faff;outline:none">
          <button onclick="workVendorAdd()" style="height:44px;padding:0 18px;background:#3f7cb8;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">➕ 추가</button>
        </div>
        <button onclick="document.getElementById('workVendorMgrOverlay').style.display='none'" style="width:100%;padding:13px;border-radius:14px;border:2px solid #dbe6f4;background:#f7faff;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;color:#7a92a8">닫기</button>
      </div>`;
    el.addEventListener('click',e=>{ if(e.target===el) el.style.display='none'; });
    document.body.appendChild(el);
  }
  document.getElementById('workVendorMgrOverlay').style.display='flex';
  workVendorRender();
}

function workVendorRender(){
  const list=document.getElementById('workVendorList'); if(!list) return;
  const vendors=loadWorkVendors();
  list.innerHTML=vendors.map((v,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f7faff;border-radius:10px;border:1.5px solid #e8f0fa">
      <input type="text" value="${esc(v)}" data-vi="${i}" style="flex:1;border:none;background:transparent;font-size:14px;font-family:inherit;outline:none;color:#1a2f45;font-weight:600">
      <button data-vsave="${i}" style="background:#eaf1fb;border:none;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;color:#3f7cb8;cursor:pointer;font-family:inherit">저장</button>
      <button data-vdel="${i}" style="background:#fde8e8;border:none;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;color:#b52929;cursor:pointer;font-family:inherit">삭제</button>
    </div>`).join('');
  list.querySelectorAll('[data-vsave]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const i=parseInt(btn.dataset.vsave);
      const inp=list.querySelector(`[data-vi="${i}"]`);
      if(!inp||!inp.value.trim()) return;
      const arr=loadWorkVendors(); arr[i]=inp.value.trim(); saveWorkVendors(arr);
      workVendorRender(); refreshWorkVendorSelect();
      if(typeof toast==='function') toast('저장됐어요');
    });
  });
  list.querySelectorAll('[data-vdel]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const i=parseInt(btn.dataset.vdel);
      const arr=loadWorkVendors(); if(!confirm(`"${arr[i]}" 업체를 삭제할까요?`)) return;
      arr.splice(i,1); saveWorkVendors(arr);
      workVendorRender(); refreshWorkVendorSelect();
    });
  });
}

function workVendorAdd(){
  const inp=document.getElementById('workVendorNew');
  const name=(inp&&inp.value||'').trim();
  if(!name) return;
  const arr=loadWorkVendors();
  if(arr.includes(name)){ if(typeof toast==='function') toast('이미 있는 업체예요'); return; }
  arr.push(name); saveWorkVendors(arr);
  if(inp) inp.value='';
  workVendorRender(); refreshWorkVendorSelect();
  if(typeof toast==='function') toast('추가됐어요');
}


// 검색 가능한 연락처 선택 드롭다운
// timepick 동기화 (hidden input에 HH:MM 값 저장)
// alertbefore - 일/시간/분 → 총 분으로 변환해서 hidden에 저장
function syncAlertBefore(){
  const d = parseInt(document.getElementById('m-alertDays')?.value||0);
  const h = parseInt(document.getElementById('m-alertHours')?.value||0);
  const m = parseInt(document.getElementById('m-alertMins')?.value||0);
  const total = d*24*60 + h*60 + m;
  const el = document.getElementById('m-alertBefore');
  if(el) el.value = String(total);
}

// alertbefore 복원
function restoreAlertBefore(total){
  total = parseInt(total)||0;
  const d = Math.floor(total/(24*60));
  const h = Math.floor((total%(24*60))/60);
  const m = total%60;
  const dEl=document.getElementById('m-alertDays');
  const hEl=document.getElementById('m-alertHours');
  const mEl=document.getElementById('m-alertMins');
  if(dEl) dEl.value=String(d);
  if(hEl) hEl.value=String(h);
  // 분은 가장 가까운 5분 단위로
  const mOpts=[0,5,10,15,20,30,45];
  const closest=mOpts.reduce((a,b)=>Math.abs(b-m)<Math.abs(a-m)?b:a);
  if(mEl) mEl.value=String(closest);
  syncAlertBefore();
}

function syncTimepick(fid){
  const ampm = (document.getElementById(fid+'-ampm')||{}).value||'AM';
  const h = parseInt((document.getElementById(fid+'-h')||{}).value||'0');
  const m = (document.getElementById(fid+'-m')||{}).value||'';
  if(!h||m==='') { const el=document.getElementById(fid); if(el) el.value=''; return; }
  let h24 = h;
  if(ampm==='AM' && h===12) h24=0;
  else if(ampm==='PM' && h!==12) h24=h+12;
  const val = `${String(h24).padStart(2,'0')}:${m}`;
  const el=document.getElementById(fid); if(el) el.value=val;
}

// timepick 기존값 복원 (수정 시)
function restoreTimepick(fid, val){
  if(!val) return;
  const [hStr,mStr]=val.split(':');
  let h24=parseInt(hStr); const m=mStr;
  const ampmEl=document.getElementById(fid+'-ampm');
  const hEl=document.getElementById(fid+'-h');
  const mEl=document.getElementById(fid+'-m');
  if(!ampmEl||!hEl||!mEl) return;
  let ampm='AM'; let h12=h24;
  if(h24===0){ ampm='AM'; h12=12; }
  else if(h24<12){ ampm='AM'; h12=h24; }
  else if(h24===12){ ampm='PM'; h12=12; }
  else { ampm='PM'; h12=h24-12; }
  ampmEl.value=ampm;
  hEl.value=String(h12);
  mEl.value=m;
}

function makeContactSearchUI(inputId, listId, onSelect, onClear){
  const inp = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if(!inp||!list) return;
  const contacts = (typeof contactsCache!=='undefined'?contactsCache:[]).filter(c=>c.name);

  // ✕ 초기화 버튼 추가
  const wrap = inp.parentElement;
  if(wrap && !wrap.querySelector('.csl-clear')){
    wrap.style.position='relative';
    const clearBtn=document.createElement('button');
    clearBtn.type='button';
    clearBtn.className='csl-clear';
    clearBtn.textContent='✕';
    clearBtn.style.cssText='position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:16px;color:#aab8c8;cursor:pointer;padding:4px;display:none;line-height:1';
    clearBtn.addEventListener('mousedown',e=>{
      e.preventDefault();
      inp.value='';
      clearBtn.style.display='none';
      list.style.display='none';
      if(onClear) onClear();
    });
    wrap.appendChild(clearBtn);

    inp.addEventListener('input',()=>{
      clearBtn.style.display=inp.value?'block':'none';
    });
  }

  function render(q){
    const all = q
      ? contacts.filter(c=>(c.name||'').includes(q)||(c.cat||'').includes(q)||(c.phone||'').includes(q)||(c.person||'').includes(q)||(c.title||'').includes(q))
      : contacts;
    if(!all.length){
      list.innerHTML='<div style="padding:10px 14px;color:#aab8c8;font-size:13px">검색 결과 없음</div>';
      list.style.display='block'; return;
    }
    // 등록업체 먼저, 일회성은 맨 아래
    const reg = all.filter(c=>(c.vendorType||'등록업체')!=='일회성');
    const one = all.filter(c=>c.vendorType==='일회성');
    const filtered = [...reg, ...one];
    list.innerHTML = filtered.map(c=>{
      const isOnetime = c.vendorType==='일회성';
      const onetimeBadge = isOnetime ? '<span style="font-size:10px;font-weight:700;background:#f1f5f9;color:#94a3b8;border-radius:6px;padding:1px 6px;margin-left:4px">🕐 일회성</span>' : '';
      return `<div class="csl-item" data-idx="${contacts.indexOf(c)}" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f6ff;transition:background .1s${isOnetime?';opacity:.65':''}">
        <div style="font-size:14px;font-weight:700;color:#1a2f45">${esc(c.name)}${onetimeBadge}${c.person?' <span style="font-size:12px;color:#3f7cb8;font-weight:600">· '+esc(c.person)+'</span>':''}</div>
        <div style="font-size:12px;color:#aab8c8;margin-top:2px">${[c.cat,c.title,c.phone].filter(Boolean).join(' · ')}</div>
      </div>`;
    }).join('');
    if(one.length && reg.length){
      // 일회성 구분선
      const divider = document.createElement('div');
      divider.style.cssText='padding:4px 14px;font-size:10px;font-weight:700;color:#94a3b8;background:#f8fafc;border-bottom:1px solid #f0f6ff';
      divider.textContent='🕐 일회성 업체';
      list.querySelectorAll('.csl-item')[reg.length]?.before(divider);
    }
    list.style.display='block';
    list.querySelectorAll('.csl-item').forEach(el=>{
      el.addEventListener('mouseenter',()=>el.style.background='#f0f6ff');
      el.addEventListener('mouseleave',()=>el.style.background='');
      el.addEventListener('mousedown',e=>{
        e.preventDefault();
        const c=contacts[parseInt(el.dataset.idx)];
        inp.value=c.name;
        list.style.display='none';
        const cb=inp.parentElement&&inp.parentElement.querySelector('.csl-clear');
        if(cb) cb.style.display='block';
        onSelect(c);
      });
    });
  }

  let activeIdx = -1;

  function updateActive(items){
    items.forEach((el,i)=>{ el.style.background = i===activeIdx ? '#e8f0fb' : ''; });
  }

  inp.addEventListener('keydown',e=>{
    const items=[...list.querySelectorAll('.csl-item')];
    if(!items.length) return;
    if(e.key==='ArrowDown'){
      e.preventDefault();
      activeIdx=Math.min(activeIdx+1, items.length-1);
      updateActive(items);
      items[activeIdx]?.scrollIntoView({block:'nearest'});
    } else if(e.key==='ArrowUp'){
      e.preventDefault();
      activeIdx=Math.max(activeIdx-1, 0);
      updateActive(items);
      items[activeIdx]?.scrollIntoView({block:'nearest'});
    } else if(e.key==='Enter'){
      e.preventDefault();
      e.stopPropagation();
      const target = activeIdx>=0 ? items[activeIdx] : items[0];
      if(target) target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
    } else if(e.key==='Escape'){
      list.style.display='none';
      activeIdx=-1;
    }
  });

  inp.addEventListener('input',()=>{ activeIdx=-1; render(inp.value); });
  inp.addEventListener('focus',()=>{ activeIdx=-1; render(inp.value); });
  inp.addEventListener('blur',()=>setTimeout(()=>{ list.style.display='none'; activeIdx=-1; },200));
}

// 통화 - 연락처 선택 시 자동입력
function fillCallContact(val){
  if(!val) return;
  try{
    const c=JSON.parse(val);
    const nameEl=document.getElementById('m-name');
    const roleEl=document.getElementById('m-role');
    const compEl=document.getElementById('m-company');
    const phoneEl=document.getElementById('m-phone');
    if(nameEl&&c.name) nameEl.value=c.name;
    if(roleEl&&c.role) roleEl.value=c.role;
    if(compEl&&c.company) compEl.value=c.company;
    if(phoneEl&&c.phone) phoneEl.value=c.phone;
  }catch(e){}
}

// 업무 - 담당업체 선택 시 담당자/전화 자동입력
function fillWorkVendor(vendorName){
  if(!vendorName) return;
  const contacts=(typeof contactsCache!=='undefined'?contactsCache:[]);
  // 업체명으로 첫 번째 담당자 찾기
  const contact=contacts.find(c=>c.name===vendorName||c.company===vendorName);
  if(!contact) return;
  const contactEl=document.getElementById('m-workContact');
  const phoneEl=document.getElementById('m-workPhone');
  if(contactEl&&!contactEl.value) contactEl.value=contact.person||'';
  const roleEl=document.getElementById('m-workRole');
  if(roleEl&&!roleEl.value) roleEl.value=contact.title||'';
  if(phoneEl&&!phoneEl.value) phoneEl.value=contact.phone||'';
  const memoEl=document.getElementById('m-workMemo');
  if(memoEl&&!memoEl.value) memoEl.value=contact.memo||'';
}

function refreshWorkVendorSelect(){
  const sel=document.getElementById('m-workVendor');
  if(!sel) return;
  const cur=sel.value;
  const contacts=(typeof contactsCache!=='undefined'?contactsCache:[]).filter(c=>c.name&&c.cat!=='직원(재직중)'&&c.cat!=='직원(퇴직)');
  sel.innerHTML='<option value="">-- 선택 --</option>'+contacts.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}${c.cat?' ('+esc(c.cat)+')':''}</option>`).join('');
  if(cur) sel.value=cur;
}

function openExpFieldMgr(){
  const overlay = document.getElementById('expFieldMgrOverlay');
  if(!overlay) {
    // 모달 동적 생성
    const el = document.createElement('div');
    el.id = 'expFieldMgrOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:none;align-items:flex-end;justify-content:center';
    el.innerHTML = `
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:520px;padding:24px 20px 32px;box-shadow:0 -4px 32px rgba(0,0,0,.15)">
        <h3 style="margin:0 0 16px;font-size:17px;font-weight:800;color:#1a2f45">⚙ 지출 분야 관리</h3>
        <div id="expFieldMgrList" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto;margin-bottom:14px"></div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input type="text" id="expFieldMgrNew" placeholder="새 분야 이름" style="flex:1;height:44px;padding:0 14px;border:2px solid #dbe6f4;border-radius:12px;font-size:15px;font-family:inherit;outline:none;background:#f7faff">
          <button onclick="expFieldMgrAdd()" style="height:44px;padding:0 18px;background:#3f7cb8;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">➕ 추가</button>
        </div>
        <button onclick="document.getElementById('expFieldMgrOverlay').style.display='none'" style="width:100%;padding:13px;border-radius:14px;border:2px solid #dbe6f4;background:#f7faff;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;color:#7a92a8">닫기</button>
      </div>`;
    el.addEventListener('click', e=>{ if(e.target===el) el.style.display='none'; });
    document.body.appendChild(el);
  }
  document.getElementById('expFieldMgrOverlay').style.display='flex';
  expFieldMgrRender();
}

function expFieldMgrRender(){
  const list = document.getElementById('expFieldMgrList');
  if(!list) return;
  const fields = loadExpFields();
  list.innerHTML = fields.map((f,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f7faff;border-radius:10px;border:1.5px solid #e8f0fa">
      <input type="text" value="${esc(f)}" data-fi="${i}" style="flex:1;border:none;background:transparent;font-size:14px;font-family:inherit;outline:none;color:#1a2f45;font-weight:600">
      <button data-fsave="${i}" style="background:#eaf1fb;border:none;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;color:#3f7cb8;cursor:pointer;font-family:inherit">저장</button>
      <button data-fdel="${i}" style="background:#fde8e8;border:none;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;color:#b52929;cursor:pointer;font-family:inherit">삭제</button>
    </div>`).join('');
  list.querySelectorAll('[data-fsave]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const i=parseInt(btn.dataset.fsave);
      const inp=list.querySelector(`[data-fi="${i}"]`);
      if(!inp||!inp.value.trim()) return;
      const arr=loadExpFields(); arr[i]=inp.value.trim(); saveExpFields(arr);
      expFieldMgrRender(); expRefreshFieldSelect();
      if(typeof toast==='function') toast('저장됐어요');
    });
  });
  list.querySelectorAll('[data-fdel]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const i=parseInt(btn.dataset.fdel);
      const arr=loadExpFields(); if(!confirm(`"${arr[i]}" 분야를 삭제할까요?`)) return;
      arr.splice(i,1); saveExpFields(arr);
      expFieldMgrRender(); expRefreshFieldSelect();
    });
  });
}

function expFieldMgrAdd(){
  const inp=document.getElementById('expFieldMgrNew');
  const name=(inp&&inp.value||'').trim();
  if(!name) return;
  const arr=loadExpFields();
  if(arr.includes(name)){ if(typeof toast==='function') toast('이미 있는 분야예요'); return; }
  arr.push(name); saveExpFields(arr);
  if(inp) inp.value='';
  expFieldMgrRender(); expRefreshFieldSelect();
  if(typeof toast==='function') toast('추가됐어요');
}

function expRefreshFieldSelect(){
  const sel=document.getElementById('exp-field');
  if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">-- 선택 --</option>'+loadExpFields().map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('');
  if(cur) sel.value=cur;
}

function saveExpense(){
  const id = expenseData && expenseData.id;
  const title = ($("exp-title").value||"").trim();
  const amount = Number($("exp-amount").value)||0;
  if(!title){ toast("내역을 입력하세요"); return; }
  if(amount<=0){ toast("금액을 입력하세요"); return; }
  const utype = ($("exp-utype")||{value:"기타"}).value||"기타";
  const unitPrice = Number(($("exp-unitprice")||{value:0}).value)||0;
  const qty = Number(($("exp-qty")||{value:1}).value)||1;
  const deliveryFee = Number(($("exp-delivery")||{value:0}).value)||0;
  const obj = {
    kind: "expense",
    date: $("exp-date").value || todayStr(),
    expType: ($("exp-type")||{value:"개인지출"}).value || "개인지출",
    utype,
    title,
    amount,
    matName: ($("exp-matname")||{value:""}).value.trim(),
    spec: ($("exp-spec")||{value:""}).value.trim(),
    unitPrice, qty, deliveryFee,
    memo: ($("exp-memo")||{value:""}).value || "",
    vendor: ($("exp-vendor")||{value:""}).value.trim(),
    field: ($("exp-field")||{value:""}).value,
    photo: expensePhoto
  };
  if(id){ updateRecord(id, obj); }
  else { obj.createdAt = Date.now(); addRecord(obj); }
  // 현재 보고 있던 종류와 다르면 그 탭으로 자동 전환
  if(obj.expType==="개인지출" && EXP_FILTER.tab!=="personal"){
    EXP_FILTER.tab = "personal";
    document.querySelectorAll("[data-exptab]").forEach(x=>x.classList.toggle("active", x.dataset.exptab==="personal"));
  } else if(obj.expType==="세금계산서" && EXP_FILTER.tab!=="tax"){
    EXP_FILTER.tab = "tax";
    document.querySelectorAll("[data-exptab]").forEach(x=>x.classList.toggle("active", x.dataset.exptab==="tax"));
  }
  $("expenseOverlay").classList.remove("show");
  renderAll();
  toast(id?"수정되었습니다":"저장되었습니다");
  // 구글캘린더 자동 동기화
  if(typeof window.gcalSync==="function" && typeof accessToken!=="undefined" && accessToken){
    const savedExp = entries.find(e=>e.id===(id||entries[entries.length-1]?.id));
    if(savedExp && typeof GCAL_IDS!=="undefined" && GCAL_IDS[savedExp.kind]){
      setTimeout(()=>window.gcalSync(savedExp), 500);
    }
  }
}

/* ===== 업무-지출 연결 ===== */
let mLinkedExpIds = []; // 현재 업무에 연결된 지출 ID 목록

function renderExpLinkList(workId){
  mLinkedExpIds = workId
    ? entries.filter(e=>e.kind==="expense"&&e.workId===workId).map(e=>e.id)
    : [];
  // 연결된 지출 있으면 영역 표시
  const area=$("mExpLinkArea");
  if(area) area.style.display = mLinkedExpIds.length ? "" : "none";
  refreshExpLinkUI();
}

function refreshExpLinkUI(){
  const list = document.getElementById("mExpLinkList");
  if(!list) return;
  const linked = entries.filter(e=>e.kind==="expense"&&mLinkedExpIds.includes(e.id));
  if(!linked.length){
    list.innerHTML = "<div style='font-size:13px;color:#aab8c8;padding:4px 0'>연결된 지출이 없습니다</div>";
    return;
  }
  const total = linked.reduce((s,e)=>s+Number(e.amount||0),0);
  list.innerHTML = linked.map(e=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f7faff;border-radius:10px;border:1.5px solid #e8f0fa">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#1a2f45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.title||"")}</div>
        <div style="font-size:11px;color:#aab8c8;margin-top:2px">${esc(e.date||"")} · ${esc(e.utype||e.expType||"")} · ${Number(e.amount||0).toLocaleString()}원</div>
      </div>
      <button data-unlinkid="${e.id}" style="background:#fde8e8;border:none;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;color:#b52929;cursor:pointer;font-family:inherit;flex-shrink:0">해제</button>
    </div>`).join("")+
    `<div style="text-align:right;font-size:13px;font-weight:800;color:#3f7cb8;margin-top:6px">합계: ${total.toLocaleString()}원</div>`;
  list.querySelectorAll("[data-unlinkid]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      mLinkedExpIds = mLinkedExpIds.filter(id=>id!==btn.dataset.unlinkid);
      refreshExpLinkUI();
    });
  });
}

function openExpPick(){
  const overlay = document.getElementById("expPickOverlay");
  if(!overlay) return;
  overlay.style.display="flex";
  renderExpPickList("");
  const inp = document.getElementById("expPickSearch");
  if(inp){ inp.value=""; inp.focus(); inp.oninput=()=>renderExpPickList(inp.value); }
}

function renderExpPickList(q){
  const list = document.getElementById("expPickList");
  if(!list) return;
  const expenses = entries.filter(e=>e.kind==="expense")
    .filter(e=>{
      if(mLinkedExpIds.includes(e.id)) return false; // 이미 연결된 것 제외
      if(!q.trim()) return true;
      const s=[e.title,e.utype,e.expType,e.field,e.vendor,String(e.amount||"")].filter(Boolean).join(" ").toLowerCase();
      return s.includes(q.trim().toLowerCase());
    })
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  if(!expenses.length){
    list.innerHTML="<div style='text-align:center;padding:30px;color:#aab8c8;font-size:14px'>조건에 맞는 지출이 없습니다</div>";
    return;
  }
  list.innerHTML = expenses.map(e=>`
    <div data-pickid="${e.id}" style="display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #f0f6ff;cursor:pointer;transition:background .1s" onmouseenter="this.style.background='#f0f6ff'" onmouseleave="this.style.background=''">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:#1a2f45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.title||"")}</div>
        <div style="font-size:12px;color:#aab8c8;margin-top:3px">
          ${esc(e.date||"")} · <span style="background:#eaf1fb;color:#3f7cb8;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700">${esc(e.utype||e.expType||"")}</span> ${e.field?"· "+esc(e.field):""}
        </div>
      </div>
      <div style="font-size:14px;font-weight:800;color:#3f7cb8;white-space:nowrap;flex-shrink:0">${Number(e.amount||0).toLocaleString()}원</div>
    </div>`).join("");
  list.querySelectorAll("[data-pickid]").forEach(el=>{
    el.addEventListener("click",()=>{
      const eid = el.dataset.pickid;
      // 이미 있으면 제거 후 다시 추가 (중복 방지)
      mLinkedExpIds = mLinkedExpIds.filter(i=>i!==eid);
      mLinkedExpIds.push(eid);
      document.getElementById("expPickOverlay").style.display="none";
      // 업무 모달의 지출 연결 현황 간단히 표시
      const linked=entries.find(e=>e.id===eid);
      if(linked){
        const area=$("mExpLinkArea"); if(area) area.style.display="";
        refreshExpLinkUI();
      }
      if(typeof toast==="function") toast("💰 지출 연결됐어요");
    });
  });
}

// 저장 시 연결 처리 (mSave 클릭 후 호출)
function applyExpLinks(workId){
  if(!workId) return;
  // 기존 연결 해제 (현재 목록에 없는 것)
  entries.filter(e=>e.kind==="expense"&&e.workId===workId)
    .forEach(e=>{ if(!mLinkedExpIds.includes(e.id)) updateRecord(e.id,{workId:null}); });
  // 새 연결
  mLinkedExpIds.forEach(eid=>{
    const ex=entries.find(e=>e.id===eid);
    if(ex&&ex.workId!==workId) updateRecord(eid,{workId});
  });
}

// v43 업무 엑셀 복사
function v43CopyWorkExcel(){
  const allEnt = (typeof entries!=='undefined') ? entries : [];
  const v43From = (document.getElementById('v43From')||{}).value||'';
  const v43To = (document.getElementById('v43To')||{}).value||'';
  const ents = allEnt.filter(e=>{
    if(e.kind!=='work') return false;
    if(v43From && (e.date||'')<v43From) return false;
    if(v43To && (e.date||'')>v43To) return false;
    return true;
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(!ents.length){ toast('복사할 업무가 없어요'); return; }
  // 한 셀에 들어가도록 공백 구분 (탭 X)
  const rows = ents.map(e=>{
    const floor = (e.floor||'').trim();
    const title = (e.title||'').trim();
    const detail = (e.detail||'').trim().replace(/[\t\n]/g,' ');
    const matParts = [];
    if(e.material) matParts.push(String(e.material).trim());
    if(e.matSpec) matParts.push(String(e.matSpec).trim());
    if(Number(e.qty)>0) matParts.push(e.qty+'개');
    const material = matParts.join('_').replace(/[\t\n]/g,' ');
    // 지출종류가 개인비용/후불청구이면 금액 추가
    const expType = e.expType||'없음';
    const costPart = (expType==='개인비용'||expType==='후불청구') && Number(e.cost)>0
      ? `${Math.round(Number(e.cost)).toLocaleString('ko-KR')}원`
      : '';
    return [floor, title, detail, material, costPart].filter(Boolean).join(' ');
  });
  const text = rows.join('\n');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(
      ()=>toast(`📋 ${ents.length}건 복사됐어요! 셀 클릭 → Ctrl+V`),
      ()=>{
        const ta=document.createElement('textarea');
        ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select();
        try{ document.execCommand('copy'); toast(`📋 ${ents.length}건 복사됨`); }catch(e){ toast('복사 실패'); }
        ta.remove();
      }
    );
  }
}
function wireExpenseModal(){
  $("expCancel").addEventListener("click",()=>$("expenseOverlay").classList.remove("show"));
  $("expSave").addEventListener("click",saveExpense);
  $("expDelete").addEventListener("click",()=>{
    if(!expenseData||!expenseData.id) return;
    const id=expenseData.id;
    $("expenseOverlay").classList.remove("show");
    deleteWithUndo(id, "지출 내역");
  });
  /* expenseOverlay 배경 클릭 닫기 비활성화 */
}

// 엑셀 복사 — 품의서 양식에 붙여넣을 수 있도록
function copyExpenseExcel(){
  const expType = EXP_FILTER.tab==="personal" ? "개인지출" : "세금계산서";
  const list = entries.filter(e=>e.kind==="expense"
    && (e.expType||"개인지출")===expType
    && (!EXP_FILTER.ym || (e.date||"").startsWith(EXP_FILTER.ym))
  ).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  if(!list.length){ toast("복사할 내역이 없습니다"); return; }
  // 1) 탭 구분 텍스트
  const rows = list.map((e,i)=>[i+1, e.title||"", e.amount||0, e.date||"", e.memo||""]);
  const text = rows.map(r=>r.map(v=>String(v).replace(/\t/g," ").replace(/\n/g," ")).join("\t")).join("\n");
  // 2) HTML 테이블 (엑셀이 자동으로 셀에 매핑)
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><table border="1" cellspacing="0">`;
  rows.forEach(r=>{
    html += "<tr>";
    r.forEach(v=>{
      const s=String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const isNum = typeof v === "number" || (/^[0-9]+$/.test(String(v)) && String(v).length<10);
      html += isNum ? `<td x:num>${s}</td>` : `<td>${s}</td>`;
    });
    html += "</tr>";
  });
  html += "</table></body></html>";
  copyExcelData(text, html, `${expType} ${list.length}건 엑셀 복사됨`);
}

// 엑셀이 잘 인식하도록 plain text + HTML 두 형식을 같이 클립보드에
async function copyExcelData(text, html, successMsg){
  // 방법 1: 최신 Clipboard API + ClipboardItem (두 형식 동시 제공)
  if(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem){
    try{
      const item = new ClipboardItem({
        "text/plain": new Blob([text], {type:"text/plain"}),
        "text/html": new Blob([html], {type:"text/html"})
      });
      await navigator.clipboard.write([item]);
      toast(successMsg);
      return;
    }catch(e){ console.warn("ClipboardItem 실패, 폴백 시도:", e); }
  }
  // 방법 2: 옛 방식 — 임시 div에 HTML 넣고 selection으로 복사
  try{
    const div = document.createElement("div");
    div.contentEditable = "true";
    div.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
    div.innerHTML = html;
    document.body.appendChild(div);
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand("copy");
    sel.removeAllRanges();
    document.body.removeChild(div);
    if(ok){ toast(successMsg); return; }
  }catch(e){ console.warn("execCommand HTML 복사 실패:", e); }
  // 방법 3: 최후의 보루 — plain text만
  copyText(text, successMsg);
}


const AI_MODEL="claude-sonnet-4-6";
const AI_KEY_LS="wl_anthropic_key";
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
  const v=$("aiKey").value.trim();
  if(!v){ toast("키를 입력하세요"); return; }
  if(!/^[\x20-\x7E]+$/.test(v)){
    toast("⚠ 키에 잘못된 문자(한글·공백 등)가 들어있어요. sk-ant-로 시작하는 영문/숫자만 입력하세요");
    return;
  }
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

/* =========================================================
   v41: 통화↔연락처 연동 · 분야 공유 (contact_cats)
   추가 위치: worklog.js 맨 끝 init(); 바로 위에 붙여넣기
   ========================================================= */

/* ── contact_cats 공유 분야 목록 ──────────────────────────── */
const CONTACT_CATS_COL = "contact_cats";
const CONTACT_CATS_LS  = "wl_contact_cats_v41";
const DEFAULT_CONTACT_CATS = ["전기","설비","기계/냉난방","통신","승강기","소방","영선","청소",
  "공사/인테리어","인테리어","서희타워공사","견적업체","자재","행정","임차인",
  "직원(재직중)","직원(퇴사)","기타"];
let CONTACT_CATS = DEFAULT_CONTACT_CATS.slice();

async function loadContactCats(){
  // 연락처 분야 독립 로드 (업무 분야와 분리)
  try{
    const ls=JSON.parse(localStorage.getItem(CONTACT_CATS_LS)||'null');
    if(Array.isArray(ls)&&ls.length){ CONTACT_CATS=ls; return; }
  }catch(e){}
  // Firestore에서 로드
  if(online&&db){
    try{
      const snap=await db.collection('ct_cats_v2').doc('list').get();
      if(snap.exists){
        const d=snap.data();
        if(Array.isArray(d.cats)&&d.cats.length){
          CONTACT_CATS=d.cats;
          try{ localStorage.setItem(CONTACT_CATS_LS,JSON.stringify(CONTACT_CATS)); }catch(e){}
          return;
        }
      }
    }catch(e){}
  }
  CONTACT_CATS=DEFAULT_CONTACT_CATS.slice();
}

async function saveContactCats(){
  // 연락처 분야 독립 저장 (업무 분야 건드리지 않음)
  try{ localStorage.setItem(CONTACT_CATS_LS,JSON.stringify(CONTACT_CATS)); }catch(e){}
  if(online&&db){
    db.collection('ct_cats_v2').doc('list').set({cats:CONTACT_CATS,updatedAt:Date.now()}).catch(()=>{});
  }
}

/* ── 분야 관리 모달 ──────────────────────────────────────── */
function openContactCatMgr(onClose){
  // 기존 catMgrOverlay를 재사용
  catMgrKind = "__contactCats__";
  $("catMgrTitle").textContent = "⚙ 통화/연락처 분야 관리";
  $("catNewName").value = "";
  renderContactCatMgrList();
  $("catMgrOverlay").classList.add("show");
  // 닫힐 때 콜백
  $("catMgrOverlay")._onContactCatClose = onClose || null;
}

// 모달에서 직접 호출 (onclick)
function openContactCatMgrFromModal(){
  openContactCatMgr(()=>{
    // 분야 선택 갱신
    const sel = $("m-callField");
    if(sel){
      const cur = sel.value;
      sel.innerHTML = CONTACT_CATS.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
      if(CONTACT_CATS.includes(cur)) sel.value = cur;
    }
  });
}

function renderContactCatMgrList(){
  const cnt = {};
  entries.filter(e=>e.kind==="call").forEach(e=>{ const c=e.callField||""; if(c) cnt[c]=(cnt[c]||0)+1; });
  $("catList").innerHTML = CONTACT_CATS.length
    ? CONTACT_CATS.map((c,i)=>`<div class="cat-row" data-ci="${i}">
        <span class="cr-name">${esc(c)}</span>
        <span class="cr-cnt">${cnt[c]||0}건</span>
        <button data-cact="up" title="위로">▲</button>
        <button data-cact="down" title="아래로">▼</button>
        <button class="danger" data-cact="del" title="삭제">🗑</button>
      </div>`).join("")
    : `<div class="empty" style="padding:14px">분야가 없습니다. 추가해 주세요.</div>`;
  $("catList").querySelectorAll(".cat-row").forEach(row=>{
    const i = Number(row.dataset.ci);
    row.querySelectorAll("[data-cact]").forEach(b=>b.addEventListener("click",()=>{
      const a=b.dataset.cact;
      if(a==="up"&&i>0) [CONTACT_CATS[i-1],CONTACT_CATS[i]]=[CONTACT_CATS[i],CONTACT_CATS[i-1]];
      else if(a==="down"&&i<CONTACT_CATS.length-1) [CONTACT_CATS[i+1],CONTACT_CATS[i]]=[CONTACT_CATS[i],CONTACT_CATS[i+1]];
      else if(a==="del"){
        if(!confirm(`"${CONTACT_CATS[i]}" 분야를 삭제할까요?`)) return;
        CONTACT_CATS.splice(i,1);
      }
      saveContactCats(); renderContactCatMgrList();
    }));
  });
}

// catAddBtn 클릭 — catMgrKind가 __contactCats__ 일 때 분기
const _v41_origCatAddNew = catAddNew;
catAddNew = function(){
  if(catMgrKind === "__contactCats__"){
    const v = $("catNewName").value.trim();
    if(!v) return;
    if(CONTACT_CATS.includes(v)){ toast("이미 있는 분야입니다"); return; }
    CONTACT_CATS.push(v);
    saveContactCats();
    $("catNewName").value="";
    renderContactCatMgrList();
    toast(`✅ "${v}" 분야 추가됨`);
    return;
  }
  _v41_origCatAddNew();
};

// catMgrClose 닫힐 때 콜백 호출
const _origCatMgrClose = $("catMgrClose");
$("catMgrClose").addEventListener("click", ()=>{
  if(catMgrKind === "__contactCats__"){
    catMgrKind = null;
    const cb = $("catMgrOverlay")._onContactCatClose;
    if(cb) cb();
    $("catMgrOverlay")._onContactCatClose = null;
  }
});

/* ── contacts 컬렉션 캐시 (자동완성용) ───────────────────── */
let contactsCache = [];
// 직원 명단 (이름+전화번호) - 자동완성 및 contacts 연동용
// STAFF_LIST: 기본값 (contacts 컬렉션 로드 전 fallback)
let STAFF_LIST = [
  {name:"조태경", phone:"010-8724-5543", role:"실장"},
  {name:"김대환", phone:"010-3358-4852", role:"경비"},
  {name:"정지환", phone:"010-5520-3157", role:"경비"},
  {name:"마재곤", phone:"010-7752-2569", role:"경비"},
  {name:"구자경", phone:"010-3842-2566", role:"경비"},
  {name:"배옥식", phone:"010-8949-7400", role:"청소반장"},
  {name:"김태경", phone:"010-7388-4170", role:"미화"},
  {name:"한광희", phone:"010-8215-0047", role:"미화"},
  {name:"정은지", phone:"010-8937-6265", role:"미화"},
  {name:"오희성", phone:"010-4223-2842", role:"미화"},
  {name:"차민자", phone:"010-7330-5996", role:"미화"},
  {name:"박일월", phone:"010-8976-5746", role:"미화"},
];

async function loadContactsCache(){
  if(!online||!db) return;
  try{
    const snap = await db.collection("contacts").get();
    contactsCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    // contacts에서 직원(재직중) 카테고리를 STAFF_LIST로 동기화
    const staffFromDB = contactsCache.filter(c=>c.cat==="직원(재직중)"&&c.name);
    if(staffFromDB.length){
      STAFF_LIST = staffFromDB.map(c=>({
        name: c.name||"",
        phone: c.phone||"",
        role: c.memo ? c.memo.split(" · ")[0] : ""
      }));
    }
  }catch(e){ console.warn("contacts 캐시 로드 실패:", e); }
}

function searchContacts(q){
  q = (q||"").trim();
  if(!q) return [];
  const ql = q.toLowerCase();
  const results = [];
  // 업체 연락처
  contactsCache.forEach(c=>{
    const nm = (c.name||"").toLowerCase();
    const ps = (c.person||"").toLowerCase();
    if(nm.includes(ql)||ps.includes(ql)){
      const ct = c.contractType||'';
      results.push({
        label: c.name+(c.person?" / "+c.person:"")+(ct?" ["+ct+"]":"")+(c.cat?" ["+c.cat+"]":""),
        phone: c.phone||"",
        name: c.name||c.person||"",
        contractType: ct,
        contractCycle: c.contractCycle||""
      });
    }
  });
  // 직원 명단 (이름 매칭 + 실제 전화번호)
  STAFF_LIST.forEach(s=>{
    if(s.name.includes(q) && !results.find(r=>r.name===s.name)){
      results.push({label: s.name+" ["+s.role+"]", phone:s.phone, name:s.name});
    }
  });
  return results.slice(0,8);
}

/* ── 통화 모달 — 이름 자동완성 + 전화번호 자동 채움 ─────── */
function wireCallNameAutocomplete(){
  const nameEl = $("m-name");
  const phoneEl = $("m-phone");
  const roleEl = $("m-role");
  const companyEl = $("m-company");
  if(!nameEl||!phoneEl) return;
  if(nameEl._callACwired) return;
  nameEl._callACwired = true;

  const existAC = document.getElementById("callNameAC");
  if(existAC) existAC.remove();

  const acBox = document.createElement("div");
  acBox.id = "callNameAC";
  acBox.style.cssText = [
    "position:absolute","background:#fff","border:1px solid var(--line)",
    "border-radius:10px","box-shadow:0 4px 18px rgba(63,74,87,.18)",
    "z-index:300","min-width:260px","max-height:230px","overflow:auto","display:none","top:100%","left:0","right:0"
  ].join(";");

  const wrap = nameEl.closest(".field");
  if(wrap){ wrap.style.position="relative"; wrap.appendChild(acBox); }

  const fillFromHit = h => {
    nameEl.value = h.name;
    if(h.phone && !phoneEl.value.trim()) phoneEl.value = h.phone;
    // 직책/업체 자동 채움 (contacts 캐시에서 가져올 수 있으면)
    const contact = contactsCache.find(c=>c.name===h.name||(c.person&&c.person===h.name));
    if(contact){
      if(roleEl && !roleEl.value.trim()) roleEl.value = contact.role||contact.position||"";
      if(companyEl && !companyEl.value.trim()) companyEl.value = contact.company||contact.name||"";
    }
  };

  const showAC = ()=>{
    const q = nameEl.value.trim();
    if(q.length < 1){ acBox.style.display="none"; return; }
    const hits = searchContacts(q);
    if(!hits.length){ acBox.style.display="none"; return; }
    acBox.innerHTML = hits.map((h,i)=>`
      <div data-aci="${i}" style="padding:9px 13px;cursor:pointer;font-size:14px;border-bottom:1px solid var(--bg2);display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span><b>${esc(h.name)}</b> <span style="color:var(--ink-soft);font-size:12px">${esc(h.label.slice(h.name.length))}</span></span>
        <span style="color:var(--primary-deep);font-size:13px;white-space:nowrap">${h.phone?"📞 "+esc(h.phone):""}</span>
      </div>`).join("");
    acBox.style.display = "block";
    acBox.querySelectorAll("[data-aci]").forEach(el=>{
      el.addEventListener("mouseenter",()=>{el.style.background="var(--primary-soft)";});
      el.addEventListener("mouseleave",()=>{el.style.background="";});
      el.addEventListener("mousedown", e=>{
        e.preventDefault();
        fillFromHit(hits[Number(el.dataset.aci)]);
        acBox.style.display = "none";
      });
    });
  };
  nameEl.addEventListener("input", showAC);
  nameEl.addEventListener("focus", showAC);
  nameEl.addEventListener("blur", ()=>setTimeout(()=>{ acBox.style.display="none"; }, 180));
  nameEl.addEventListener("keydown", e=>{
    if(e.key!=="Tab") return;
    const q = nameEl.value.trim();
    if(!q) return;
    const hits = searchContacts(q);
    if(!hits.length) return;
    e.preventDefault();
    e.stopPropagation();
    fillFromHit(hits[0]);
    acBox.style.display = "none";
  });
}

/* ── 통화 저장 후 contacts 연동 제안 ─────────────────────── */
let _pendingCallContact = null;

// overlay 닫힘 감지
new MutationObserver(mutations=>{
  mutations.forEach(m=>{
    if(m.type==="attributes" && m.attributeName==="class"){
      if(!$("overlay").classList.contains("show") && _pendingCallContact){
        const saved = _pendingCallContact;
        _pendingCallContact = null;
        setTimeout(()=>maybeAddToContacts(saved), 350);
      }
    }
  });
}).observe($("overlay"), {attributes:true});

function maybeAddToContacts(saved){
  if(!saved.phone) return;
  // 이미 contacts에 같은 번호가 있으면 스킵
  const phoneClean = saved.phone.replace(/[^0-9]/g,"");
  const exists = contactsCache.find(c=>(c.phone||"").replace(/[^0-9]/g,"")===phoneClean);
  if(exists) return;
  if(confirm(`📇 업체 연락처에 추가할까요?\n\n이름: ${saved.name||"(이름없음)"}\n전화: ${saved.phone}\n분야: ${saved.cat||"기타"}\n\n[확인] 추가 / [취소] 그냥 두기`)){
    doAddToContacts(saved);
  }
}

async function doAddToContacts(saved){
  if(!online||!db){ toast("오프라인 — 연락처 추가 불가"); return; }
  const rec = {
    name: saved.name||saved.phone,
    cat:  saved.cat||"기타",
    person: "",
    phone: saved.phone,
    email: "", address: "",
    memo: "통화 기록에서 자동 추가 ("+new Date().toLocaleDateString("ko-KR")+")",
    card: "", fav: false, createdAt: Date.now()
  };
  try{
    const ref = await db.collection("contacts").add(rec);
    rec.id = ref.id;
    contactsCache.push(rec);
    toast(`✅ "${rec.name}" 업체 연락처에 추가되었습니다`);
  }catch(e){ toast("연락처 추가 실패: "+(e.message||e)); }
}

/* ═══════════════════════════════════════════════
   📋 업체 구분 뱃지 (v44-0624 단순화)
   vendorType: "등록업체" | "일회성"
   ═══════════════════════════════════════════════ */

/* 담당업체 선택 시 일회성 여부를 업무 모달에 표시 */
function showVendorContractBadge(c){
  const box = $("m-vendorContractBadge");
  if(!box) return;
  const vt = c.vendorType||"등록업체";
  box.style.display = "flex";
  box.innerHTML = vt==="일회성"
    ? '<span style="font-size:11px;font-weight:700;background:#f1f5f9;color:#94a3b8;border-radius:8px;padding:3px 10px;">🕐 일회성 업체</span>'
    : '<span style="font-size:11px;font-weight:700;background:#d1fae5;color:#166534;border-radius:8px;padding:3px 10px;">✅ 등록업체</span>';
}

/* ── mSave 클릭 인터셉트 (capture phase) ────────────────── */
$("mSave").addEventListener("click", ()=>{
  if(mKind==="call"){
    const name  = ($("m-name" )||{value:""}).value.trim();
    const phone = ($("m-phone")||{value:""}).value.trim();
    const cat   = ($("m-callField")||{value:"기타"}).value||"기타";
    if(phone) _pendingCallContact = {name, phone, cat};
  }
}, true);

/* ── openEditor 패치 — call 열릴 때 추가 기능 연결 ─────── */
// v41: openEditor 확장 (call 종류일 때 자동완성+분야 복원)
const _v41_origOpenEditor = openEditor;
openEditor = function(kind, id){
  _v41_origOpenEditor(kind, id);
  if(kind==="call"){
    // contacts 캐시 최신화 후 자동완성 연결
    loadContactsCache().catch(()=>{}).finally(()=>{
      wireCallNameAutocomplete();
    });
    setTimeout(()=>{
      // 분야 복원
      if(id){
        const rec = entries.find(e=>e.id===id);
        const sel = $("m-callField");
        if(rec && sel && rec.callField){
          if(CONTACT_CATS.includes(rec.callField)) sel.value = rec.callField;
        }
      }
    }, 90);
  }
};

/* ── renderCall 테이블에 분야 열 추가 ──────────────────────── */
// (기존 renderCall 함수에 callField 컬럼을 추가로 표시)
const _v41_origRenderCall = renderCall;
renderCall = function(){
  _v41_origRenderCall();
  // thead에 분야 열 추가 (아직 없을 때만)
  const thead = document.querySelector("#panel-call table.rec thead tr");
  if(thead && !thead.querySelector("[data-callfield-th]")){
    const th = document.createElement("th");
    th.dataset.callfieldTh = "1";
    th.textContent = "분야";
    // "상대" 열 뒤에 삽입
    const ths = thead.querySelectorAll("th");
    if(ths.length >= 4) thead.insertBefore(th, ths[4]);
  }
  // tbody 각 행에 분야 셀 추가
  const body = $("callBody");
  if(!body) return;
  body.querySelectorAll("tr[data-id]").forEach(tr=>{
    if(tr.querySelector("[data-callfield-td]")) return;
    const rec = entries.find(e=>e.id===tr.dataset.id);
    const td = document.createElement("td");
    td.dataset.callfieldTd = "1";
    td.innerHTML = rec&&rec.callField ? `<span class="pill etc">${esc(rec.callField)}</span>` : "";
    const tds = tr.querySelectorAll("td");
    if(tds.length >= 4) tr.insertBefore(td, tds[4]);
  });
}

/* ── fieldHTML 패치 — callfield 타입 처리 ───────────────── */
const _v41_origFieldHTML = fieldHTML;
fieldHTML = function(f){
  if(f.type==="callfield"){
    const opts = CONTACT_CATS.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
    return `<div class="field ${f.full?"full":""}"><label>${esc(f.label||"분야")}</label>
      <div style="display:flex;gap:6px;align-items:stretch">
        <select id="m-${f.k}" style="flex:1">${opts}</select>
        <button type="button" class="btn btn-ghost btn-sm" onclick="openContactCatMgrFromModal()" style="flex:0 0 auto;padding:0 10px" title="분야 추가/삭제">⚙</button>
      </div></div>`;
  }
  return _v41_origFieldHTML(f);
};

// v41 init은 원본 init()에 직접 통합됨

init();
