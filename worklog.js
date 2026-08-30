/* ══════════════════════════════════════════════════════════════
   ★ 이 파일은  worklog.js  입니다 (자바스크립트)
   ★ GitHub 에서 반드시 worklog.js 에만 붙여넣으세요.
   ★ worklog.html 에 붙이면 화면이 글자로 도배됩니다.
   ══════════════════════════════════════════════════════════════ */
/* ===== 설정 ===== */
/* ⚠️ 버전의 원본은 worklog.html <head> 의  window.APP_VERSION  한 곳뿐이다.
   아래 따옴표 안의 값은 HTML 이 옛 버전일 때만 쓰이는 비상용이라
   평소에는 손대지 않아도 된다. 화면 배지·제목이 전부 이걸 읽는다. */
const APP_VERSION = (typeof window !== "undefined" && window.APP_VERSION)
                  ? window.APP_VERSION
                  : "v93-0829-0837";

/* ── 휴지통 스텁 (함수 정의 누락 방지) ── */
function renderTrash(){ /* 미구현 */ }
function autoCleanTrash(){ /* 미구현 */ }


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

/* ══════════════════════════════════════════════════════════════
   📦 덩치 큰 종류를 별도 컬렉션으로 (v149-0830-1700)
   달님 : 「kind 26종 중 지출·자재·입출고를 별도 컬렉션으로 — 이건 해야 해」

   기록이 1,232건을 넘어 한 컬렉션이 버거워졌다.
   (2026-08-30 : Write stream exhausted / 연결 timeout 이 잦아진 배경)

   ⚠ 데이터를 옮기는 일이라 세 걸음으로 나눈다. 한 번에 하지 않는다.
     1걸음 (이번 판) : 새 컬렉션도 함께 「읽고」, 새 기록은 새 컬렉션에 「쓴다」
                        → 옛 기록은 그대로 있으므로 아무것도 잃지 않는다
     2걸음 (달님이 단추) : 옛 기록을 새 컬렉션으로 복사 → 숫자 대조
     3걸음 (대조가 맞으면) : 옛 자리에서 지운다

   되돌리기 : wlSplit.off()  → 전부 예전처럼 worklog_entries 한 곳만 쓴다
   ══════════════════════════════════════════════════════════════ */
const COL_SPLIT = { expense:"worklog_expense", item:"worklog_item", stock:"worklog_stock" };
function splitOn(){ try{ return localStorage.getItem("wl_col_split") !== "0"; }catch(e){ return true; } }
/* 이 종류를 어느 컬렉션에 쓸까 */
function colOf(kind){
  if(!splitOn()) return COL;
  return COL_SPLIT[String(kind||"")] || COL;
}
/* id 만 아는 경우엔 기억해 둔 목록에서 종류를 찾는다 */
function colOfId(id){
  try{
    var r = (entries||[]).filter(function(x){ return x && x.id === id; })[0];
    return colOf(r && r.kind);
  }catch(e){ return COL; }
}
function _wlDoc(rec){
  try{ return db.collection(colOf(rec && rec.kind)).doc(rec.id); }
  catch(e){ return db.collection(COL).doc(rec.id); }
}
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
      // v44: merge 없이 localStorage 값 그대로 사용 (삭제한 분야 복원 방지)
      FIELDS = ls.slice();
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
        // v44: merge 없이 Firebase 값 그대로 사용
        FIELDS = d.cats.slice();
        FIELDS.sort((a,b)=>a.localeCompare(b,"ko"));
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

const KIND_LABEL={work:"업무",plan:"오늘계획",memo:"메모",call:"통화",vacation:"휴가",meeting:"회의메모",deliver:"전달사항",filelink:"파일링크",site:"사이트",password:"비밀번호",schedule:"예정",item:"품목",stock:"입출고",cleaning:"청소일지",expense:"지출",accident:"사고",progress:"진행업무"};
const PHOTO_KINDS=["work","memo","meeting","accident","progress"];
const ATTACH_KINDS=["work","memo","meeting","accident","progress"];

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
    {k:"title",label:"제목",type:"text",full:true,req:true},
    // 아래는 JS에서 workMode에 따라 동적 렌더
  ],
  // 일반업무 토글 추가 필드
  work_simple_more:[
    {k:"detail",label:"상세내용",type:"textarea",full:true},
    {k:"material",label:"자재명",type:"text"},
    {k:"qty",label:"수량",type:"number"},
  ],
  // 외주·비용 전용 필드
  work_full:[
    {k:"expType",label:"지출종류",type:"select",opts:["자재","개인비용","전표","후불청구"]},
    {k:"cost",label:"금액 (원)",type:"number"},
  ],
  // 외주 토글 추가 필드
  work_full_more:[
    {k:"detail",label:"상세내용",type:"textarea",full:true},
    {k:"estimateMemo",label:"견적 메모",type:"textarea",full:true},
  ],
  plan:[ {k:"date",label:"날짜",type:"date",req:true},
         {k:"status",label:"상태",type:"select",opts:["미완료","보류","완료"]},
         {k:"text",label:"할 일",type:"text",full:true,req:true} ],
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
    {k:"recurring",label:"구매 주기",type:"select",opts:["정기구매","수시구매","비정기구매","계절구매","미구매"]},
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
  progress:[
    {k:"date",label:"등록일",type:"date",req:true},
    {k:"status",label:"진행상태",type:"select",opts:["검토중","견적중","품의중","발주완료","공사중","완료","보류"],req:true},
    {k:"title",label:"업무 제목",type:"text",full:true,req:true},
    {k:"owner",label:"담당 업체",type:"text",span:2,nl:true},
    {k:"ownerPhone",label:"담당자 · 연락처",type:"text",span:2},
    {k:"estCost",label:"초기 견적비 (원)",type:"number",span:2,nl:true},
    {k:"finalCost",label:"최종 금액 (원)",type:"number",span:2},
    {k:"detail",label:"상세 내용",type:"textarea",full:true},
    {k:"memo",label:"비고",type:"textarea",full:true},
    // v46: 처리단계(steps)는 상세 내용 바로 아래에 삽입됨. steps=[{date,action,detail}]
  ],
  accident:[
    {k:"status",label:"처리 상태",type:"select",opts:["⏳ 접수","🔍 조사중","⚙ 처리중","✅ 완료","📋 종결"],req:true},
    {k:"accType",label:"사고 종류",type:"select",opts:["누수","화재","미끄러짐","추락","차량파손","도난","폭행/시비","엘리베이터","주차장","승강기","감전","기타"],req:true},
    {k:"date",label:"발생 날짜",type:"date",req:true},
    {k:"time",label:"발생 시각",type:"time"},
    {k:"title",label:"사고 제목",type:"text",full:true,req:true},
    {k:"floor",label:"발생 층",type:"floor",nl:true},
    {k:"location",label:"상세 위치",type:"text"},
    {k:"field",label:"분야",type:"field"},
    {k:"partyName",label:"당사자 이름",type:"text",nl:true},
    {k:"partyType",label:"당사자 유형",type:"select",opts:["임차인","방문객","직원","외부인","불명"]},
    {k:"partyPhone",label:"당사자 연락처",type:"text"},
    {k:"repairCost",label:"수리비 (원)",type:"number",nl:true},
    {k:"compensation",label:"배상금 (원)",type:"number"},
    {k:"insurance",label:"보험금 (원)",type:"number"},
    {k:"detail",label:"사고 경위 (상세)",type:"textarea",full:true},
    // v46: 처리단계(steps)는 사고 경위 바로 아래에 삽입됨
    {k:"emergency",label:"응급조치 내용",type:"textarea",full:true},
    {k:"reported",label:"신고 여부",type:"select",opts:["없음","경찰 112","소방 119","구급차","보험사","본사 보고","기타"]},
    {k:"followUp",label:"후속 조치 / 재발 방지책",type:"textarea",full:true},
    {k:"memo",label:"비고",type:"textarea",full:true},
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
/* 대상월 + 제목 합성 (표시용) */
function displayTitle(e){ if(!e) return '(제목없음)'; var pfx=(e.refYear?(e.refYear+'년 '):'')+(e.refMonth?(e.refMonth+'월 '):''); return pfx+(e.title||'(제목없음)'); }
const yesterdayStr = () => { const d=kstNow(); d.setUTCDate(d.getUTCDate()-1); return d.toISOString().slice(0,10); };
/* 3일전 — 월요일이면 지난 금요일(3일전) 반환 */
const prev3WorkdayStr = () => {
  const d=kstNow();
  const dow = d.getUTCDay(); // 0=일,1=월,...,6=토
  // 월요일(1)이면 3일전=금요일
  d.setUTCDate(d.getUTCDate()-3);
  return d.toISOString().slice(0,10);
};
const nowTime = () => { const d=kstNow(); return d.toISOString().slice(11,16); };
const clockStr = ts => { if(!ts) return ""; const d=new Date(ts); const k=new Date(d.getTime()+9*60*60*1000); return k.toISOString().slice(11,16); };
const $ = id => document.getElementById(id);
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
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
        // v44: 선택 후 업무내역으로 포커스 이동
        setTimeout(()=>{
          const titleEl = document.getElementById('m-title');
          if(titleEl){ titleEl.focus(); }
        }, 50);
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
  inp.addEventListener("blur", ()=>setTimeout(()=>{ list.style.display="none"; }, 200));
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
      // v44: 분야 선택 후 업무내역 필드로 포커스 이동
      setTimeout(()=>{
        const titleEl = document.getElementById("m-title");
        if(titleEl) titleEl.focus();
      }, 50);
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

/* ===== 사진 =====
   화질 설정 — 계량기 숫자·명판 글씨가 확대해서 읽혀야 하므로 기본을 올렸다.
   파이어스토어 한 건이 1MB 라 총량은 900KB 로 묶는다. */
const MAX_TOTAL=900000;
const PHOTO_Q = {
  low:  { dim:1200, q:0.70, n:'표준 (많이 담기)' },
  mid:  { dim:1700, q:0.80, n:'선명 (권장)' },
  high: { dim:2400, q:0.88, n:'최고 (글씨까지)' }
};
function photoQ(){
  var k='mid';
  try{ k = localStorage.getItem('wl_photo_q') || 'mid'; }catch(e){}
  return PHOTO_Q[k] || PHOTO_Q.mid;
}
function photoQSet(k){ try{ localStorage.setItem('wl_photo_q', k); }catch(e){} }
function compressImage(file, maxDim, quality){
  var _pq = photoQ();
  if(maxDim==null) maxDim = _pq.dim;
  if(quality==null) quality = _pq.q;
  return _compressImage(file, maxDim, quality);
}
function _compressImage(file, maxDim=1700, quality=0.80){
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

/* ⚠️⚠️ 빈 데이터·급감 덮어쓰기 방지 (v90) ⚠️⚠️
   🔎 주의 — 이 아래 lsSave() 는 평소에는 **쓰이지 않는다.** (v92에서 확인)
      worklog.html 이 window.lsSave 를 두 번 갈아끼우기 때문:
        ① html 「💾 저장 공간 구하기」 → saveLight() 로 교체   ← 진짜 저장은 여기
        ② html 「🔐 안전 저장소 v47」 boot() → guardOK() 가드로 다시 감쌈
      그래서 실제 가드는 saveLight() 안(0건·급감)과 guardOK()(급감 확인창) 두 곳에 있다.
      여기 가드는 위 두 블록이 어떤 이유로 안 실행됐을 때를 위한 **비상용**이다.
      ⚠ 가드를 고칠 일이 생기면 saveLight() 를 먼저 고칠 것.
   2026-08-27 사고 — 파이어스토어가 멈춰 entries 가 0건이 된 상태에서 lsSave() 가 돌아
   기기에 남아 있던 기록까지 통째로 사라졌다.
   사고 문서에는 이 가드가 있다고 적혀 있었지만 실제 코드에는 없었다(2026-08-28 확인).
   → 기록이 0건이거나 갑자기 절반 밑으로 줄면 기기 사본을 건드리지 않는다.
     클라우드가 진짜이므로, 새로고침하면 올바른 값으로 다시 채워진다. */
function lsGuardOK(){
  try{
    var now = (typeof entries!=='undefined' && entries) ? entries.length : 0;
    var had = lsLoad().length;
    if(had <= 0) return true;                       /* 지킬 게 없으면 그냥 저장 */
    if(window.__wlForceSave){ window.__wlForceSave=false; return true; }
    if(now === 0){
      window.__wlEmptyGuard = { at:Date.now(), had:had, now:0 };
      console.warn('[worklog] 🛑 기록이 0건이라 기기 사본을 지켰습니다 (기존 '+had+'건). 새로고침하세요.');
      try{ if(typeof toast==='function')
        toast('🛑 기록을 못 불러왔어요 — 기기 사본 '+had+'건은 그대로 지켰습니다. 새로고침해 주세요'); }catch(e){}
      return false;
    }
    if(had >= 20 && now < had/2){
      window.__wlEmptyGuard = { at:Date.now(), had:had, now:now };
      console.warn('[worklog] 🛑 기록이 '+had+'건 → '+now+'건으로 급감해서 기기 사본을 지켰습니다.'
        + ' 정말 맞으면 콘솔에 window.__wlForceSave=true 를 넣고 다시 저장하세요.');
      try{ if(typeof toast==='function')
        toast('🛑 기록이 '+had+'→'+now+'건으로 확 줄어서 기기 사본은 그대로 뒀어요'); }catch(e){}
      return false;
    }
  }catch(e){ console.warn('[worklog] 저장 가드 확인 실패 — 그냥 저장합니다', e); }
  return true;
}
window.wlForceSave = function(){ window.__wlForceSave = true; lsSave(); };
window.wlSaveGuardInfo = function(){ return window.__wlEmptyGuard || null; };

/* 안전 lsSave — 용량 초과 시 자동 정리 후 재시도 */
function lsSave(){
  if(!lsGuardOK()) return;
  try{
    localStorage.setItem("wl_"+COL, JSON.stringify(entries));
    window.__wlEmptyGuard = null;
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
function syncSet(id,rec){
  if(!online) return;
  const {id:_x,...payload}=rec;
  db.collection(colOf(rec&&rec.kind)).doc(id).set(payload)
    .catch(e=>{ logErr("저장 동기화", e); toast("클라우드 동기화 지연 — 이 기기에는 저장됨"); });
}
function addRecord(data){ const id=genId(); const rec={...data,id}; entries.push(rec); if(online) syncSet(id,rec); lsSave(); return rec; }
function updateRecord(id,patch){ const i=entries.findIndex(x=>x.id===id); if(i<0) return; entries[i]={...entries[i],...patch}; if(online) syncSet(id,entries[i]); lsSave(); }
/* ═══ v46: 지운 항목이 되살아나는 것 방지 ═══
   원인 — loadAll() 이 "폰 저장소엔 있는데 클라우드엔 없는 것"을 잃어버린 것으로 보고
   클라우드에 다시 올렸다. PC에서 지워도 폰을 열면 폰이 되살려 놓는 구조였다.
   해결 — 지운 id 를 기억해 두고, 그 항목은 다시 올리지도 읽지도 않는다.
   이 기억은 wl_ 로 시작해서 클라우드 백업으로 다른 기기에도 전파된다. */
const DEL_IDS_LS = "wl_deleted_ids";
const DEL_KEEP_DAYS = 120;
function loadDelIds(){
  try{ const m = JSON.parse(localStorage.getItem(DEL_IDS_LS) || "{}"); return (m && typeof m === "object") ? m : {}; }
  catch(e){ return {}; }
}
function rememberDelId(id){
  if(!id) return;
  try{
    const m = loadDelIds();
    m[id] = Date.now();
    const cut = Date.now() - DEL_KEEP_DAYS*24*3600*1000;
    for(const k in m){ if(m[k] < cut) delete m[k]; }
    localStorage.setItem(DEL_IDS_LS, JSON.stringify(m));
  }catch(e){}
}
function forgetDelId(id){
  if(!id) return;
  try{ const m = loadDelIds(); delete m[id]; localStorage.setItem(DEL_IDS_LS, JSON.stringify(m)); }catch(e){}
}
function isDelId(id){ return !!loadDelIds()[id]; }
window.wlDeletedIds = { list: loadDelIds, forget: forgetDelId,
  clear: function(){ try{ localStorage.removeItem(DEL_IDS_LS); if(typeof toast==="function") toast("삭제 기록을 비웠어요"); }catch(e){} } };

function deleteRecord(id){
  rememberDelId(id);
  entries=entries.filter(x=>x.id!==id);
  if(online){
    const _c = colOfId(id);
    db.collection(_c).doc(id).delete().catch(e=>logErr("삭제 동기화", e));
    /* 옛 자리에 남아 있을 수도 있다 — 거기서도 지운다 (되살아나는 것 방지) */
    if(_c !== COL) db.collection(COL).doc(id).delete().catch(()=>{});
  }
  lsSave();
}
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
  forgetDelId(rec.id);                       /* v46: 되살리기로 지운 기록 취소 */
  const i=entries.findIndex(x=>x.id===rec.id);
  if(i<0) entries.push(rec); else entries[i]=rec;
  if(online){ const {id,...p}=rec; _wlDoc(rec).set(p).catch(e=>logErr("복구 동기화", e)); }
  lsSave();
}
function deleteWithUndo(id, label){
  const rec=entries.find(x=>x.id===id); if(!rec) return;
  const backup=JSON.parse(JSON.stringify(rec));
  saveTempBackup();
  deleteRecord(id);
  // toastAction 먼저 — renderAll보다 먼저 등록해야 toastBtn이 덮이지 않음
  toastAction(`${label||"항목"}을(를) 삭제했습니다`, "되돌리기", ()=>{
    restoreRecord(backup); renderAll(); toast("✅ 삭제를 되돌렸습니다");
  });
  renderAll();
}
async function loadAll(){
  if(online){
    try{
      /* v149 — 나뉜 컬렉션까지 함께 읽는다.
            ⚠ 하나라도 실패하면 그 부분이 통째로 빠져 「기록이 사라진 것」처럼 보인다.
              그래서 실패한 컬렉션은 건너뛰되 반드시 콘솔에 남긴다 (지침 ㉑). */
      const _cols = splitOn()
        ? [COL].concat(Object.keys(COL_SPLIT).map(function(k){ return COL_SPLIT[k]; }))
        : [COL];
      const _snaps = await Promise.all(_cols.map(function(c){
        return db.collection(c).get().catch(function(err){
          console.warn('[불러오기] ' + c + ' 를 못 읽었어요', err);
          return null;
        });
      }));
      if(!_snaps[0]) throw new Error('worklog_entries 를 못 읽었습니다');
      let all = [];
      const _seen = {};
      _snaps.forEach(function(sn){
        if(!sn) return;
        sn.docs.forEach(function(d){
          if(_seen[d.id]) return;                 /* 옮기는 중이면 두 곳에 있을 수 있다 */
          _seen[d.id] = 1;
          all.push({ id:d.id, ...d.data() });
        });
      });
      /* v46: 지운 항목이 클라우드에 되살아나 있으면 조용히 청소 */
      const zombie=all.filter(x=>isDelId(x.id));
      const fb=all.filter(x=>!isDelId(x.id));
      if(zombie.length){
        console.log("[worklog] 되살아난 항목 "+zombie.length+"건 정리");
        zombie.forEach(x=>{
          db.collection(colOf(x.kind)).doc(x.id).delete().catch(()=>{});
          if(colOf(x.kind) !== COL) db.collection(COL).doc(x.id).delete().catch(()=>{});
        });
      }
      const ids=new Set(fb.map(x=>x.id));
      /* v46: 지운 것은 다시 올리지 않는다 */
      const extra=lsLoad().filter(x=>!ids.has(x.id) && !isDelId(x.id));
      entries=[...fb,...extra];
      extra.forEach(x=>{ const {id,...p}=x; db.collection(colOf(x.kind)).doc(id).set(p).catch(()=>{}); });
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
    /* synchronizeTabs 는 탭끼리 알리려고 localStorage 를 쓴다.
       저장소가 꽉 차면 QuotaExceeded → FIRESTORE INTERNAL ASSERTION FAILED 로 번진다.
       IndexedDB 만 쓰도록 끈다 (여러 탭을 동시에 안 여니 문제 없음). */
    try{ await db.enablePersistence(); }catch(_){ }
    /* v146 — 6초는 너무 짧았다. 파이어스토어 자체가 10초를 기다린다.
          그 전에 우리가 먼저 포기해 「오프라인」으로 못 박혀 버렸다. */
    await Promise.race([ db.collection(COL).limit(1).get(), new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),12000)) ]);
    online=true; setStatus(true);
  }catch(e){
    online=false; setStatus(false); logErr("초기 연결", e);
    /* v146 【근본】 달님 로그 : 「Could not reach Cloud Firestore backend / 초기 연결 timeout」
          예전에는 여기서 online=false 로 못 박고 끝이었다.
          그 뒤 연결이 살아나도 아무도 다시 확인하지 않아
          연락처가 영영 빈 채로 남았다 (업체 목록이 안 뜨던 진짜 배경).
          → 뒤에서 조용히 다시 확인하고, 이어지면 그때 불러온다. */
    try{ if(db) _wlReconnect(0); }catch(_){}
  }
  await loadAll();
  autoCleanTrash(); // v44: 30일 지난 휴지통 자동 정리
  migrateTissueToJumbo(); // v26: 휴지 → 점보롤 자동 변환
  migrateItemMemo(); // v44: 품목 메모 정리 (서브원 주문내역 → 마지막 구매일)
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
        _wlDoc(e).set(e).catch(err=>console.warn("migrate save fail",err));
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
function migrateItemMemo(){
  // v2: 마지막 구매 날짜도 메모에서 제거 (lastBuyDate 필드로 분리됨)
  if(localStorage.getItem('_itemMemoMigrated_v2')) return;
  let changed = 0;
  entries.forEach(it=>{
    if(it.kind!=="item") return;
    const memo = it.memo||"";
    // 지울 패턴
    const isJunk = /서브원.{0,10}주문내역|엑셀.{0,10}구매내역|자동\s*등록|마지막\s*구매\s*:\s*\d{4}-\d{2}-\d{2}/.test(memo);
    if(!isJunk) return;
    // 마지막 구매일은 lastBuyDate 필드로 따로 저장
    const lastStock = entries.filter(e=>e.kind==="stock"&&e.itemId===it.id&&e.stockType==="입고")
      .sort((a,b)=>(b.date||"").localeCompare(a.date||"")).shift();
    const patch = { memo: "" };
    if(lastStock && !it.lastBuyDate) patch.lastBuyDate = lastStock.date;
    updateRecord(it.id, patch);
    changed++;
  });
  localStorage.setItem('_itemMemoMigrated_v2','1');
  if(changed>0){
    console.log(`[migrateItemMemo v2] ${changed}건 정리 완료`);
    toast(`✅ 품목 메모 ${changed}건 정리 완료`);
  }
}

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
          _wlDoc(e).set(e).catch(()=>{});
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
    ["expense", renderExpense], ["accident", renderAccidents], ["progress", renderProgressTasks], ["diag", renderDiag]
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
  if(kind==="item") return {field:"", recurring:"수시구매", safetyStock:0, unitPrice:0};
  if(kind==="stock") return {date:t, stockType:"입고", qty:1, unitPrice:0, amount:0};
  if(kind==="expense") return {date:t, expType:"개인지출", amount:0};
  if(kind==="accident") return {date:t, time:nowTime(), accType:"누수", status:"⏳ 접수", partyType:"임차인", reported:"없음"};
  if(kind==="progress") return {status:"검토중", date:t};
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
        style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
      <div id="m-${f.k}-list" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid #dbe6f4;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.12);z-index:500;max-height:220px;overflow:auto"></div>
    </div>`;
  }
  if(f.type==="alertbefore"){
    return `<div class="field full"><label style="font-size:10px;margin-bottom:2px">${esc(f.label)}</label>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="m-alertDays" onchange="syncAlertBefore()" style="height:28px;padding:0 6px;border:1.5px solid #dbe6f4;border-radius:6px;font-size:12px;font-family:inherit;background:#f7faff;outline:none;flex:1">
          <option value="0">0일</option><option value="1">1일</option><option value="2">2일</option><option value="3">3일</option><option value="4">4일</option><option value="5">5일</option><option value="6">6일</option><option value="7">7일</option>
        </select>
        <select id="m-alertHours" onchange="syncAlertBefore()" style="height:28px;padding:0 6px;border:1.5px solid #dbe6f4;border-radius:6px;font-size:12px;font-family:inherit;background:#f7faff;outline:none;flex:1">
          <option value="0">0시간</option><option value="1">1시간</option><option value="2">2시간</option><option value="3">3시간</option><option value="4">4시간</option><option value="5">5시간</option><option value="6">6시간</option><option value="7">7시간</option><option value="8">8시간</option><option value="9">9시간</option><option value="10">10시간</option><option value="11">11시간</option><option value="12">12시간</option><option value="13">13시간</option><option value="14">14시간</option><option value="15">15시간</option><option value="16">16시간</option><option value="17">17시간</option><option value="18">18시간</option><option value="19">19시간</option><option value="20">20시간</option><option value="21">21시간</option><option value="22">22시간</option><option value="23">23시간</option>
        </select>
        <select id="m-alertMins" onchange="syncAlertBefore()" style="height:28px;padding:0 6px;border:1.5px solid #dbe6f4;border-radius:6px;font-size:12px;font-family:inherit;background:#f7faff;outline:none;flex:1">
          <option value="0">0분</option><option value="5">5분</option><option value="10">10분</option><option value="15">15분</option><option value="20">20분</option><option value="30">30분</option><option value="45">45분</option>
        </select>
        <span style="font-size:12px;color:#3f7cb8;font-weight:700;white-space:nowrap">전에 알림</span>
        <input type="hidden" id="m-${f.k}">
      </div></div>`;
  }
if(f.type==="timepick"){
    const fid=`m-${f.k}`;
    return `<div class="field${f.full?' full':''}"><label>${esc(f.label)}</label>
      <div style="display:flex;gap:6px;align-items:center">
        <select id="${fid}-ampm" onchange="syncTimepick('${fid}')" style="height:28px;padding:0 5px;border:1.5px solid #dbe6f4;border-radius:6px;font-size:11px;font-family:inherit;background:#f7faff;outline:none;flex:0 0 50px">
          <option value="AM">오전</option>
          <option value="PM">오후</option>
        </select>
        <select id="${fid}-h" onchange="syncTimepick('${fid}')" style="height:28px;padding:0 5px;border:1.5px solid #dbe6f4;border-radius:6px;font-size:12px;font-family:inherit;background:#f7faff;outline:none;flex:1;text-align:center">
          <option value="">시</option>
          <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option>
        </select>
        <span style="font-size:14px;font-weight:700;color:#3f7cb8">:</span>
        <select id="${fid}-m" onchange="syncTimepick('${fid}')" style="height:28px;padding:0 5px;border:1.5px solid #dbe6f4;border-radius:6px;font-size:12px;font-family:inherit;background:#f7faff;outline:none;flex:1;text-align:center">
          <option value="">분</option>
          <option value="00">00</option><option value="05">05</option><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="25">25</option><option value="30">30</option><option value="35">35</option><option value="40">40</option><option value="45">45</option><option value="50">50</option><option value="55">55</option>
        </select>
        <input type="hidden" id="${fid}">
      </div></div>`;
  }

  if(f.type==="workvendor"){
    return `<div class="field" style="position:relative"><label>${esc(f.label)} <a href="contacts.html" target="_blank" style="margin-left:4px;font-size:11px;padding:2px 7px;border:1px solid #dbe6f4;border-radius:6px;background:#f7faff;color:#3f7cb8;font-weight:700;text-decoration:none">📋 연락처관리</a></label>
      <input type="text" id="m-${f.k}" placeholder="업체명 검색..." autocomplete="off"
        style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
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
  else if(f.type==="select") inner=`<select id="m-${f.k}">${f.opts.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select>`;
  else if(f.type==="status") inner=`<select id="m-${f.k}">${STATUSES.map(o=>`<option>${o}</option>`).join("")}</select>`;
  else if(f.type==="field") inner=`<div style="display:flex;gap:6px;align-items:stretch;position:relative">
      <input type="text" id="m-${f.k}" placeholder="분야 검색 (초성 가능, 예: ㅈㄱ → 전기)" autocomplete="off" style="flex:1;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
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
        <input type="text" id="m-${f.k}" placeholder="클릭하면 자재 목록, 검색 가능, 없으면 새로 추가" autocomplete="off" style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
        <div id="m-${f.k}-list" style="display:none;position:absolute;top:48px;left:0;right:0;background:#fff;border:1.5px solid #dbe6f4;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.12);z-index:500;max-height:260px;overflow:auto"></div>
      </div>`;
    } else if(f.k==="name" && mKind==="call"){
      inner=`<input type="text" id="m-${f.k}" autocomplete="off" placeholder="이름 입력 시 연락처 자동완성">`;
    } else if(f.k==="date" && (mKind==="work"||mKind==="call")){
      // 날짜 + 어제 토글 버튼
      inner=`<div style="display:flex;gap:6px;align-items:center">
        <input type="date" id="m-${f.k}" style="flex:1;height:32px;padding:0 8px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
        <button type="button" id="btn-yesterday" style="height:44px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:12px;font-size:12px;font-weight:700;color:#7a92a8;background:#f7faff;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0"
          onclick="(function(){const el=document.getElementById('m-date');if(!el)return;const yd=yesterdayStr();if(el.value===yd){el.value=(window._todayBeforeYd||todayStr());this.textContent='어제';this.style.background='#f7faff';this.style.color='#7a92a8';}else{window._todayBeforeYd=el.value||todayStr();el.value=yd;this.textContent='✓ 어제';this.style.background='#fef3c7';this.style.color='#92400e';}}).call(this)">어제</button>
      </div>`;
    } else inner=`<input type="${t}" id="m-${f.k}"${im}>`;
  }
  const req=f.req?' <span class="req">*</span>':'';
  // 업무 모달의 cost 필드는 기본 숨김 (expType 변경 시 표시)
  const initHide = (f.k==="cost" && mKind==="work") ? 'display:none;' : '';
  return `<div class="field ${f.full?"full":""}" data-k="${f.k}" style="${initHide}"><label>${f.label}${req}</label>${inner}</div>`;
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
          <input type="text" id="newMatShopId" placeholder="예: 6573068" style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">품목명 <span style="color:#e74c3c">*</span></label>
          <input type="text" id="newMatName" value="${esc(prefilledName||'')}" placeholder="예: 형광등, 점보롤" style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">규격 <span style="color:#aab8c8;font-weight:500">(간단히 - 정확한 규격만)</span></label>
          <input type="text" id="newMatSpec" placeholder="예: 36W / LED / 5500K" style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">단위코드</label>
            <input type="text" id="newMatUnit" placeholder="EA, BOX, ROL" style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
          </div>
          <div style="flex:1">
            <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">판매단가 (원)</label>
            <input type="number" id="newMatPrice" placeholder="0" style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
          </div>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">제조원</label>
          <input type="text" id="newMatMaker" placeholder="예: (주)동원피앤아이" style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">분야</label>
          <select id="newMatField" style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
            ${FIELDS.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:#7a92a8;margin-bottom:4px">거래처 <span style="color:#aab8c8;font-weight:500">(기본: 서브원)</span></label>
          <input type="text" id="newMatVendor" value="서브원" placeholder="예: 서브원" style="width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">
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
      recurring: "수시구매",
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
  inp.addEventListener("blur", ()=>setTimeout(()=>{ list.style.display="none"; }, 200));
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
/* ── v45-0824: 자재 여러 개(최대 3종류) 공용 헬퍼 ── */
const MAT_MAX = 5;   /* v85: 3 → 5 (페이지·입력창 같은 값이어야 조용히 잘리지 않는다) */
function matOne(m){
  if(!m || !m.name) return '';
  return String(m.name) + (m.spec ? ' ' + m.spec : '') + ' × ' + (Number(m.qty)||1);
}
function matsText(list){
  return (list||[]).map(matOne).filter(Boolean).join(' _ ');
}
/* 목록·카드·캘린더에서 자재를 한 줄로 보여줄 때 항상 이걸 쓴다 */
function matDisplay(en){
  if(en && Array.isArray(en.materials) && en.materials.length) return matsText(en.materials);
  if(en && en.material) return String(en.material) + (Number(en.qty) ? ' × ' + Number(en.qty) : '');
  return '';
}
/* 저장된 기록 → 편집용 배열 (옛 기록은 material/qty 한 건으로 변환) */
function matsFromEntry(d){
  if(d && Array.isArray(d.materials) && d.materials.length) return d.materials.slice(0, MAT_MAX);
  if(d && d.material) return [{ name:String(d.material), spec:'', qty:Number(d.qty)||1, itemId:'' }];
  return [];
}
function readMats(){
  try{
    const el = document.getElementById('m-materials');
    if(!el || !el.value) return [];
    const a = JSON.parse(el.value);
    return Array.isArray(a) ? a.slice(0, MAT_MAX) : [];
  }catch(e){ return []; }
}
/* 배열 → 숨김 입력 3개 + 접힌 줄 라벨까지 한 번에 반영 */
function writeMats(list){
  list = (list||[]).slice(0, MAT_MAX);
  const el = document.getElementById('m-materials');     if(el) el.value = JSON.stringify(list);
  const mEl = document.getElementById('m-material');     if(mEl) mEl.value = list.length ? (list[0].name||'') : '';
  const qEl = document.getElementById('m-qty');          if(qEl) qEl.value = list.length ? (Number(list[0].qty)||1) : '';
  const iEl = document.getElementById('m-mat-item-id');  if(iEl) iEl.value = list.length ? (list[0].itemId||'') : '';
  const lbl = document.getElementById('wMatLabel');
  if(lbl) lbl.innerHTML = list.length
    ? ('📦 자재: <b>' + esc(matsText(list)) + '</b>')
    : '📦 자재 사용 내역';
}

/* ── 자재 선택 팝업 (여러 개 담기) ── */
function openMatPickerPopup(){
  const old = document.getElementById('matPickerOv'); if(old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'matPickerOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:12000;display:flex;align-items:center;justify-content:center;padding:16px';

  let bag = readMats();

  ov.innerHTML = `
    <div style="background:#fff;border-radius:16px;width:100%;max-width:440px;max-height:88vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(0,0,0,.22)">
      <div style="padding:16px 18px 12px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">📦</span>
        <span style="font-size:16px;font-weight:800;color:#1a2f45;flex:1">자재 선택 <span style="font-size:11px;font-weight:600;color:#94a3b8">(최대 ${MAT_MAX}종류)</span></span>
        <button id="matPopClose" type="button" style="border:none;background:none;font-size:20px;color:#94a3b8;cursor:pointer;padding:4px">✕</button>
      </div>
      <div style="overflow:auto">
        <div style="padding:14px 18px 0;position:relative">
          <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:5px">자재명 검색</div>
          <input type="text" id="matPopSearch" value="" placeholder="자재명 또는 초성 검색…" autocomplete="off"
            style="width:100%;box-sizing:border-box;height:44px;padding:0 14px;border:1.5px solid #3b82f6;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;color:#1a2f45">
          <div id="matPopList" style="margin-top:8px;background:#fff;border:1.5px solid #dbe6f4;border-radius:10px;max-height:210px;overflow:auto"></div>
        </div>
        <div style="padding:10px 18px 6px;display:flex;align-items:flex-end;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:5px">선택된 자재</div>
            <div id="matPopSelected" style="min-height:38px;padding:8px 12px;background:#f8fafc;border-radius:8px;font-size:13px;font-weight:600;color:#1a2f45;border:1.5px solid #e2e8f0;line-height:1.4"><span style="color:#94a3b8;font-weight:400">없음</span></div>
          </div>
          <div style="width:88px;flex:0 0 auto">
            <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:5px">수량</div>
            <input type="number" id="matPopQty" value="1" min="0" placeholder="0"
              style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;background:#fff;outline:none;text-align:right">
          </div>
        </div>
        <div style="padding:0 18px 10px">
          <button id="matPopAdd" type="button"
            style="width:100%;height:40px;border:1.5px dashed #93c5fd;border-radius:10px;background:#f8fbff;color:#2563a8;font-size:13.5px;font-weight:800;font-family:inherit;cursor:pointer">➕ 담고 계속 고르기</button>
        </div>
        <div style="padding:0 18px 12px">
          <div id="matPopBagTitle" style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:6px">담은 자재</div>
          <div id="matPopBag" style="display:flex;flex-wrap:wrap;gap:6px"></div>
        </div>
      </div>
      <div style="padding:10px 18px 16px;display:flex;gap:8px;border-top:1px solid #f1f5f9">
        <button id="matPopClear" type="button" style="padding:0 14px;height:44px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;color:#94a3b8;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">전체 지우기</button>
        <button id="matPopOk" type="button" style="flex:1;height:44px;border:none;border-radius:10px;background:#2563a8;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">✓ 확인</button>
      </div>
    </div>`;

  document.body.appendChild(ov);

  let _pickedId = '', _pickedName = '', _pickedSpec = '';

  const searchEl = document.getElementById('matPopSearch');
  const listEl   = document.getElementById('matPopList');
  const selEl    = document.getElementById('matPopSelected');
  const qtyEl    = document.getElementById('matPopQty');
  const bagEl    = document.getElementById('matPopBag');
  const addBtn   = document.getElementById('matPopAdd');

  function renderBag(){
    document.getElementById('matPopBagTitle').innerHTML =
      '담은 자재 <span style="color:#2563a8">' + bag.length + ' / ' + MAT_MAX + '</span>';
    if(!bag.length){
      bagEl.innerHTML = '<div style="font-size:12px;color:#c3d1de">아직 담은 자재가 없습니다</div>';
    } else {
      bagEl.innerHTML = bag.map((m,i)=>`
        <span style="display:inline-flex;align-items:center;gap:6px;background:#eef6ff;border:1.5px solid #bfdbfe;border-radius:999px;padding:5px 6px 5px 11px;font-size:12.5px;font-weight:700;color:#1a2f45;max-width:100%">
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(matOne(m))}</span>
          <button type="button" class="mpp-rm" data-i="${i}" style="border:none;background:#dbeafe;color:#1d4ed8;border-radius:50%;width:19px;height:19px;line-height:1;font-size:12px;font-weight:800;cursor:pointer;flex:0 0 auto;padding:0">✕</button>
        </span>`).join('');
      bagEl.querySelectorAll('.mpp-rm').forEach(b=>{
        b.addEventListener('click',()=>{ bag.splice(Number(b.dataset.i),1); renderBag(); });
      });
    }
    const full = bag.length >= MAT_MAX;
    addBtn.disabled = full;
    addBtn.style.opacity = full ? '.45' : '1';
    addBtn.style.cursor  = full ? 'not-allowed' : 'pointer';
    addBtn.textContent   = full ? '자재는 최대 ' + MAT_MAX + '종류까지' : '➕ 담고 계속 고르기';
  }

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
    /* 목록에 없는 이름도 그대로 담을 수 있게 — 늘 맨 위에 보여준다 */
    const exact = q && filtered.some(it=>it.name===q);
    const newRow = (q && !exact)
      ? `<div class="mpp-new" style="padding:10px 14px;cursor:pointer;border-bottom:1.5px solid #e8f0fa;display:flex;align-items:center;gap:8px;background:#f6f2ff">
           <span style="background:#7c3aed;color:#fff;font-size:10px;padding:1px 6px;border-radius:5px;font-weight:700;flex-shrink:0">새로</span>
           <div style="font-size:13px;font-weight:800;color:#5b21b6;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
             "${esc(q)}" 목록에 없는 자재로 담기</div>
         </div>`
      : `<div style="padding:9px 14px;border-bottom:1.5px solid #f1f5f9;font-size:11.5px;color:#a8b8c8">
           이름을 치면 <b style="color:#7c3aed">목록에 없는 자재</b>로도 담을 수 있어요</div>`;
    if(!filtered.length){
      listEl.innerHTML=newRow+`<div style="padding:12px 14px;text-align:center;color:#94a3b8;font-size:13px">등록된 자재 중에는 없어요</div>`;
    } else {
      listEl.innerHTML=newRow+filtered.map((it,i)=>`
        <div class="mpp-item" data-idx="${i}"
          style="padding:9px 14px;cursor:pointer;border-bottom:1px solid #f8fafc;display:flex;align-items:center;gap:8px">
          <span style="background:#0369a1;color:#fff;font-size:10px;padding:1px 6px;border-radius:5px;font-weight:700;flex-shrink:0">자재</span>
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:700;color:#1a2f45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.name)}</div>
            ${it.spec?`<div style="font-size:11px;color:#94a3b8">${esc(it.spec.slice(0,40))}${it.unit?' ['+esc(it.unit)+']':''}</div>`:''}
          </div>
        </div>`).join('');
      bindNew();
      listEl.querySelectorAll('.mpp-item').forEach((el,i)=>{
        el.addEventListener('mouseenter',()=>el.style.background='#f0f6ff');
        el.addEventListener('mouseleave',()=>el.style.background='');
        el.addEventListener('mousedown',e=>{
          e.preventDefault();
          const it=filtered[i];
          _pickedId=it.id; _pickedName=it.name; _pickedSpec=it.spec||'';
          searchEl.value=it.name;
          selEl.innerHTML=`<b>${esc(it.name)}</b>${it.spec?`<br><span style="font-size:11px;color:#94a3b8">${esc(it.spec)}</span>`:''}`;
          qtyEl.focus(); qtyEl.select();
        });
      });
    }
    if(!filtered.length) bindNew();
    function bindNew(){
      const nb=listEl.querySelector('.mpp-new');
      if(!nb) return;
      nb.addEventListener('mousedown',e=>{
        e.preventDefault();
        _pickedId=''; _pickedName=q; _pickedSpec='';
        selEl.innerHTML=`<b>${esc(q)}</b><br><span style="font-size:11px;color:#7c3aed">목록에 없는 자재 — 그대로 담깁니다</span>`;
        qtyEl.focus(); qtyEl.select();
      });
    }
  }

  function clearPick(){
    _pickedId=''; _pickedName=''; _pickedSpec='';
    searchEl.value='';
    qtyEl.value='1';
    selEl.innerHTML='<span style="color:#94a3b8;font-weight:400">없음</span>';
  }

  /* 지금 고른 것을 담는다 — 목록에 없는 이름도 그대로 담긴다 */
  function addToBag(){
    const name=(_pickedName||searchEl.value).trim();
    if(!name){ if(typeof toast==='function') toast('자재를 먼저 고르거나 입력하세요'); searchEl.focus(); return false; }
    if(bag.length>=MAT_MAX){ if(typeof toast==='function') toast('자재는 최대 '+MAT_MAX+'종류까지 담을 수 있어요'); return false; }
    bag.push({ name:name, spec:_pickedSpec||'', qty:Number(qtyEl.value)||1, itemId:_pickedId||'' });
    renderBag();
    clearPick();
    renderList('');
    searchEl.focus();
    return true;
  }

  function doConfirm(){
    const name=(_pickedName||searchEl.value).trim();
    if(name && bag.length<MAT_MAX){
      bag.push({ name:name, spec:_pickedSpec||'', qty:Number(qtyEl.value)||1, itemId:_pickedId||'' });
    }
    writeMats(bag);
    ov.remove();
  }

  renderBag();
  renderList('');
  setTimeout(()=>{ searchEl.focus(); },80);

  searchEl.addEventListener('input',()=>{ _pickedId=''; _pickedSpec=''; _pickedName=searchEl.value; renderList(searchEl.value); });
  searchEl.addEventListener('focus',()=>renderList(searchEl.value));
  /* 목록은 늘 펼쳐 둔다 — 한 번 눌러야 나오면 불편하다 */
  searchEl.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); qtyEl.focus(); qtyEl.select(); } });

  addBtn.addEventListener('click', addToBag);
  qtyEl.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); addToBag(); } });

  document.getElementById('matPopOk').addEventListener('click', doConfirm);
  document.getElementById('matPopClear').addEventListener('click',()=>{
    bag = [];
    writeMats([]);
    ov.remove();
  });
  document.getElementById('matPopClose').addEventListener('click',()=>ov.remove());
  /* 배경 클릭 닫기 비활성화 */
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
  /* v103: 그린 직후 맨 위로 (수정 모드로 열 때 위쪽 탭이 잘리던 문제) */
  try{
    [0, 80, 200, 400].forEach(function(ms){
      setTimeout(function(){
        var md = document.getElementById('overlay');
        md = md && md.querySelector('.modal');
        if(md && md.scrollTop) md.scrollTop = 0;
      }, ms);
    });
  }catch(e){ console.warn('[업무 모달] 맨 위로 실패', e); }

  _workMode = mode||"simple";
  const e2 = s=>(s||"").toString().replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
  const td = kstNow().toISOString().slice(0,10);
  const d = data||{};
  const expType = d.expType&&d.expType!=="없음" ? d.expType : "개인비용";

  const S = { /* 공통 스타일 — v44 compact (35% 축소) */
    inp: `width:100%;box-sizing:border-box;height:28px;padding:0 7px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;outline:none;color:#1a2f45`,
    sel: `width:100%;box-sizing:border-box;height:28px;padding:0 7px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;outline:none;color:#1a2f45;cursor:pointer`,
    lbl: `display:block;font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:.3px;margin-bottom:1px;text-transform:uppercase`,
    ta:  `width:100%;box-sizing:border-box;min-height:32px;padding:4px 7px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;outline:none;color:#1a2f45;resize:vertical;line-height:1.5`,
    row: `display:grid;grid-template-columns:90px 1fr;gap:6px;margin-bottom:6px`,
    mb:  `margin-bottom:6px`,
  };

  /* ── 탭 ── */
  const tabs = `
  <div id="mWorkTabs" style="display:flex;gap:0;border-radius:6px;overflow:hidden;border:1.5px solid #e2e8f0;margin-bottom:6px">
    <button type="button" onclick="renderWorkModal(window._wModalData,'simple')"
      style="flex:1;padding:5px 0;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;border:none;
      background:${_workMode==='simple'?'#2563a8':'#f8fafc'};color:${_workMode==='simple'?'#fff':'#64748b'}">
      🏢 일반업무
    </button>
    <button type="button" onclick="renderWorkModal(window._wModalData,'full')"
      style="flex:1;padding:5px 0;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;border:none;border-left:1.5px solid #e2e8f0;
      background:${_workMode==='full'?'#c2410c':'#f8fafc'};color:${_workMode==='full'?'#fff':'#64748b'}">
      💰 외주·비용
    </button>
  </div>`;

  /* ── 날짜+상태 (2열) ── */
  const rowDateStatus = `
  <div style="display:flex;gap:6px;align-items:center;${S.mb}">
    <input type="date" id="m-date" value="${e2(d.date||td)}" style="${S.inp};flex:1;min-width:0">
    <button type="button" id="btn-yesterday"
      style="height:28px;padding:0 7px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;font-weight:700;color:#64748b;background:#f8fafc;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0"
      onclick="(function(b){const e=document.getElementById('m-date');if(!e)return;const y=yesterdayStr();if(e.value===y){e.value=window._wTodayBk||todayStr();b.textContent='어제';b.style.background='#f8fafc';b.style.color='#64748b';}else{window._wTodayBk=e.value||todayStr();e.value=y;b.textContent='✓ 어제';b.style.background='#fef3c7';b.style.color='#92400e';}})(this)">어제</button>
    <button type="button" id="btn-3days"
      style="height:28px;padding:0 7px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;font-weight:700;color:#64748b;background:#f8fafc;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0"
      onclick="(function(b){const e=document.getElementById('m-date');if(!e)return;const p=prev3WorkdayStr();if(e.value===p){e.value=window._wTodayBk3||todayStr();b.textContent='3일전';b.style.background='#f8fafc';b.style.color='#64748b';}else{window._wTodayBk3=e.value||todayStr();e.value=p;b.textContent='✓ 3일전';b.style.background='#e0f2fe';b.style.color='#0369a1';}})(this)">3일전</button>
    <select id="m-status" style="${S.sel};width:72px;flex-shrink:0">
      ${["미완료","진행중","완료","보류"].map(o=>`<option${(d.status||"완료")===o?" selected":""}>${o}</option>`).join("")}
    </select>
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

  /* ── 대상년도 + 대상월 + 업무내역 (월별 반복 업무용) ── */
  const refM = d.refMonth||"";
  const refY = d.refYear||"";
  const _curY = Number(kstNow().toISOString().slice(0,4));
  const _years = [_curY-2, _curY-1, _curY, _curY+1];
  const rowTitle = `
  <div style="${S.mb}">
    <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:6px">
      <div style="flex-shrink:0">
        <label style="${S.lbl}">대상년도</label>
        <select id="m-refYear" style="height:44px;width:88px;padding:0 6px;border:1.5px solid #fbbf24;border-radius:10px;font-size:15px;font-weight:800;font-family:inherit;background:#fffbea;color:#92400e;outline:none;text-align:center">
          <option value="">—</option>
          ${_years.map(y=>'<option value="'+y+'"'+(String(refY)===String(y)?' selected':'')+'>'+y+'</option>').join('')}
        </select>
      </div>
      <div style="flex-shrink:0">
        <label style="${S.lbl}">대상월</label>
        <select id="m-refMonth" style="height:44px;width:80px;padding:0 6px;border:1.5px solid #fbbf24;border-radius:10px;font-size:15px;font-weight:800;font-family:inherit;background:#fffbea;color:#92400e;outline:none;text-align:center">
          <option value="">—</option>
          ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m=>'<option value="'+m+'"'+(String(refM)===String(m)?' selected':'')+'>'+m+'월</option>').join('')}
        </select>
      </div>
      <div style="flex:1;min-width:0">
        <label style="${S.lbl}">제목 *</label>
    <div style="position:relative">
      <input type="text" id="m-title" value="${e2(d.title||"")}" autocomplete="off"
        placeholder="무엇을 했나요?" style="${S.inp};font-size:15px;font-weight:600;border-color:#3b82f6">
      <div id="titleAcBox" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 2px);background:#fff;border:1.5px solid #3b82f6;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.12);max-height:260px;overflow:auto;z-index:50"></div>
    </div>
      </div>
    </div>
  </div>`;

  /* ── 상세내용 (1열 풀, 항상 표시) ── */
  const rowDetail = `
  <div style="${S.mb}">
    <label style="${S.lbl}">상세내용</label>
    <textarea id="m-detail" placeholder="작업 내용, 특이사항 등" style="${S.ta}">${e2(d.detail||"")}</textarea>
  </div>`;

  /* ── 임시 전화번호 — 연락처 검색 + 전화 + 저장 통합 UI ── */
  const rowTempPhone = `
  <div id="wTempPhoneBox" style="border:1.5px solid #fde68a;border-radius:8px;overflow:visible;background:#fffbea;${S.mb}">
    <div style="padding:4px 8px 3px;display:flex;align-items:center;gap:3px;flex-wrap:wrap">
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
      <div id="tpSearchWrap" style="display:none;margin-bottom:6px;position:relative">
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
  const _mats0 = matsFromEntry(d);
  const matLabel = _mats0.length
    ? `📦 자재: <b>${e2(matsText(_mats0))}</b>`
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
    <input type="hidden" id="m-mat-item-id" value="${e2(_mats0.length?(_mats0[0].itemId||""):"")}">
    <input type="hidden" id="m-materials" value="${e2(JSON.stringify(_mats0))}">
  </div>`;

  /* ════════════════ 모드별 추가 필드 ════════════════ */
  let modeExtra = "";

  if(_workMode === "full"){

    /* ── 지출종류 + 금액 (1열씩) ── */
    const isPost = expType==="후불청구";
    const costSection = `
    <div style="padding:6px 10px;background:${isPost?"#fff7ed":"#eff6ff"};border:1.5px solid ${isPost?"#fdba74":"#bfdbfe"};border-radius:8px;${S.mb};display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:center">
      <div>
        <label style="${S.lbl.replace('#94a3b8',isPost?'#c2410c':'#1d4ed8')}">지출종류</label>
        <select id="m-expType" style="${S.sel};background:transparent;border-color:${isPost?"#fdba74":"#bfdbfe"}">
          ${["개인비용","전표","후불청구"].map(o=>`<option${expType===o?" selected":""}>${o}</option>`).join("")}
        </select>
      </div>
      <div>
        <label id="lbl-cost" style="${S.lbl.replace('#94a3b8',isPost?'#c2410c':'#1d4ed8')}">${isPost?"계약금액 (원)":"금액 (원)"}</label>
        <input type="number" id="m-cost" value="${e2(d.cost||"")}" placeholder="0"
          style="${S.inp};background:transparent;border-color:${isPost?"#fdba74":"#bfdbfe"};font-size:14px;font-weight:700;text-align:right;color:${isPost?"#c2410c":"#1d4ed8"}">
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
        style="width:100%;display:flex;align-items:center;gap:6px;padding:5px 10px;background:#f8fafc;border:none;cursor:pointer;font-family:inherit;text-align:left">
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
      <summary style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:#f8fafc;cursor:pointer;list-style:none;user-select:none">
        <span style="font-size:12px;font-weight:700;color:#64748b;flex:1">📋 견적 메모</span>
        <span style="font-size:10px;color:#94a3b8">▼</span>
      </summary>
      <div style="padding:6px 10px">
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
  if(!title){ toast("제목을 입력하세요"); return; }

  // AI 키 없으면 바로 저장
  const apiKey = (typeof aiGetKey==="function") ? aiGetKey() : "";
  if(!apiKey){ _doSaveWorkEntry(); return; }

  // 검사할 텍스트 수집
  const checkTexts = [];
  if(title)  checkTexts.push({field:"제목", text:title});
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
    <div style="background:#fff;border:1.5px solid #e8f0fa;border-radius:12px;padding:12px 14px;margin-bottom:6px">
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
        if(it.field==="업무내역"||it.field==="제목"){ const el=$("m-title"); if(el) el.value=el.value.replace(it.original,it.corrected); }
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
  if(!title){ toast("제목을 입력하세요"); return; }
  const obj={
    kind:"work", workMode:mode,
    date:($("m-date")||{}).value||todayStr(),
    status:($("m-status")||{}).value||"미완료",
    floor:($("m-floor")||{}).value||"",
    field:($("m-field")||{}).value?.trim()||"",
    title,
    refMonth:($("m-refMonth")||{}).value||"",
    refYear:($("m-refYear")||{}).value||"",
    detail:($("m-detail")||{}).value?.trim()||"",
    material:($("m-material")||{}).value?.trim()||"",
    qty:Number(($("m-qty")||{}).value)||0,
    materials: readMats(),
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
  if(!mId && Array.isArray(obj.materials) && obj.materials.length){
    const _done = [];
    obj.materials.forEach(m=>{
      const matName = String(m.name||"").trim();
      const mQty = Number(m.qty)||0;
      if(!matName || mQty<=0) return;
      const matchItem = m.itemId
        ? entries.find(e=>e.id===m.itemId && e.kind==="item")
        : entries.find(e=>e.kind==="item" && (e.itemName||"").replace(/^\[.*?\]/,"").trim()===matName);
      addRecord({
        kind:"stock",
        stockType:"출고",
        date: obj.date,
        itemId: matchItem ? matchItem.id : null,
        itemName: matchItem ? matchItem.itemName : matName,
        qty: mQty,
        unitPrice: matchItem ? (Number(matchItem.unitPrice)||0) : 0,
        amount: matchItem ? (Number(matchItem.unitPrice)||0)*mQty : 0,
        useTarget: `업무: ${obj.title}`,
        memo: `업무 자동출고 (${obj.date})`,
        workId: savedId,
        createdAt: Date.now(),
      });
      _done.push(matName + " " + mQty + "개");
    });
    if(_done.length) toast(`📦 ${_done.join(", ")} 출고 기록됐어요`);
  }

  $("overlay").classList.remove("show"); toast(mId?"수정되었습니다":"저장되었습니다");
  // 외주모드에서 비용 있으면 지출 모달 연동
  if(mode==="full" && (obj.expType==="개인비용"||obj.expType==="후불청구"||obj.expType==="전표")){
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
  /* 데이터 화면(내 속성)에서 읽을 수 있게 밖으로도 알려둔다 */
  try{ window._mKind=kind; window._mId=id||null; }catch(e){}
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

  /* v103: 모달을 열 때는 언제나 맨 위부터 — 스크롤이 남아 있으면 위쪽 탭이 제목에 가린다 */
  try{
    var _md = $("overlay") && $("overlay").querySelector(".modal");
    if(_md){ _md.scrollTop = 0; setTimeout(function(){ try{ _md.scrollTop = 0; }catch(e){} }, 60); }
  }catch(e){ console.warn('[모달] 맨 위로 되돌리기 실패', e); }

  const sc=SCHEMA[kind];
  /* v97: SCHEMA 에 없는 종류(청소일지·비밀번호)는 전용 화면을 쓴다 — 조용히 깨지지 않게 */
  if(!sc){
    console.warn('[모달] SCHEMA 에 없는 종류입니다: ' + kind + ' — 전용 화면을 쓰세요');
    if(kind === 'cleaning' && typeof openCleaningEditor === 'function'){ openCleaningEditor(id); return; }
    if(kind === 'password' && typeof pwOpenEditor === 'function'){ pwOpenEditor(id); return; }
    if(typeof toast === 'function') toast('이 종류(' + kind + ')는 이 창으로 열 수 없어요');
    return;
  }
  const mf = $("mFields");
  mf.className = "grid kind-" + kind; /* kind별 그리드 적용 */
  /* 여러 필드가 있는 모달은 인라인으로도 그리드 강제 (CSS 충돌 방지) */
  const GRID_KINDS = ['call', 'accident', 'progress', 'item', 'stock', 'meeting', 'deliver', 'vacation', 'schedule'];
  if(GRID_KINDS.includes(kind)){
    const COLS = (kind === 'progress') ? 4 : 3;
    mf.style.cssText = 'display:grid;grid-template-columns:repeat('+COLS+',1fr);gap:9px 10px';
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
    /* v46: 스키마의 span / nl 로 한 줄 묶음 만들기 */
    sc.forEach(fd=>{
      if(!fd || (!fd.span && !fd.nl)) return;
      const el = mf.querySelector('.field[data-k="'+fd.k+'"]');
      if(!el || el.classList.contains('full')) return;
      if(fd.span) el.style.gridColumn = (fd.nl ? ('1 / span '+fd.span) : ('span '+fd.span));
      else el.style.gridColumnStart = '1';
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
        else if(expType==="전표") modal.classList.add("exp-mode-tax");
        else modal.classList.add("exp-mode-none");
      }
      // 금액 필드 표시/숨김 + 라벨 변경
      const costEl = $("m-cost");
      if(costEl){
        const costField = costEl.closest(".field");
        if(costField){
          const isActive = (expType==="개인비용"||expType==="후불청구"||expType==="전표");
          costField.style.display = isActive ? "" : "none";
          const lbl = costField.querySelector("label");
          if(lbl) lbl.textContent = expType==="후불청구" ? "💰 계약금액 (원)" : "💰 금액 (원)";
        }
      }
    };
    // v44: 자재 자동계산 (개인비용 모드일 때만)
    const calcWorkCost = ()=>{
      const expType = ($("m-expType")||{}).value||"없음";
      if(expType==="후불청구"||expType==="전표") return; // 후불·전표는 수동 입력
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
  // v44: 진행업무 모달 - 처리 단계 동적 추가 (분야/업체/연락처 포함)
  if(kind==="progress"){
    setTimeout(()=>{
      renderProgressSteps(data.steps || []);
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
      <label style="font-weight:800;font-size:14px;color:#7c5e1a;margin:0">📋 처리 기록 (시간순)</label>
      <button type="button" id="btnAddAccStep" style="background:#f59e0b;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer">➕ 내용 추가</button>
    </div>
    <div id="accStepsList" style="display:flex;flex-direction:column;gap:8px"></div>
    <div id="accStepsEmpty" style="display:none;text-align:center;padding:18px;color:#aab8c8;font-size:13px">처리한 내용을 날짜별로 쌓아두세요 — "➕ 내용 추가"</div>
  `;
  wlPutStepsAfter(area, "detail");
  // 단계 추가 버튼
  document.getElementById("btnAddAccStep").addEventListener("click", ()=>{
    _accidentSteps.push({
      date: todayStr(),
      action: "",
      vendor: "",
      owner: "",
      vendorPhone: "",
      memo: ""
    });
    redrawAccStepList();
    setTimeout(()=>{
      const first = document.querySelector("#accStepsList .acc-step-card");
      if(first){
        first.scrollIntoView({block:"nearest"});
        const t = first.querySelector('[data-k="action"]');
        if(t) t.focus();
      }
    }, 40);
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
  const IST = "height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff";
  const SST = "height:34px;padding:0 9px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:12.5px;font-family:inherit;background:#f7faff";
  const view = _accidentSteps.map((s,idx)=>({s:s, idx:idx}))
    .sort((a,b)=>((a.s.date||"").localeCompare(b.s.date||"")))
    .map((o,n)=>({...o, no:n+1}))
    .reverse();
  list.innerHTML = view.map((o,pos)=>{
    const s = o.s, i = o.idx;
    return `
    <div class="acc-step-card" data-idx="${i}" style="background:#fff;border:1.5px solid ${pos===0?'#f59e0b':'#ffd54f'};border-radius:10px;padding:9px 10px">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;flex-wrap:wrap">
        <span style="background:${pos===0?'#c2740b':'#f59e0b'};color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:12px">${o.no}</span>
        ${pos===0?`<span style="background:#fff3cd;color:#7c5e1a;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:8px">최근</span>`:''}
        <input type="date" class="acc-step-input" data-idx="${i}" data-k="date" value="${esc(s.date||'')}" style="${IST};width:150px;flex:0 0 auto">
        <input type="text" class="acc-step-input" data-idx="${i}" data-k="action" value="${esc(s.action||'')}" placeholder="제목 (예: 누수 확인, 보험사 접수, 시공 완료)" style="${IST};flex:1;min-width:120px">
        <button type="button" class="acc-step-del" data-idx="${i}" title="삭제" style="background:#fde8e8;color:#b52929;border:none;border-radius:7px;width:32px;height:32px;font-size:13px;font-family:inherit;cursor:pointer;flex:0 0 auto">🗑</button>
      </div>
      <textarea class="acc-step-input wl-grow" data-idx="${i}" data-k="memo" rows="1" placeholder="자세한 사항 — 통화 내용, 금액, 다음 할 일 등 (직접 늘릴 수 있어요)" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;line-height:1.5;resize:vertical;overflow:auto;min-height:68px;margin-bottom:6px">${esc(s.memo||'')}</textarea>
      <div style="display:grid;grid-template-columns:1.2fr 1fr 1.1fr;gap:6px">
        <input type="text" class="acc-step-input" data-idx="${i}" data-k="vendor" value="${esc(s.vendor||'')}" placeholder="🏢 업체" style="${SST}">
        <input type="text" class="acc-step-input" data-idx="${i}" data-k="owner" value="${esc(s.owner||'')}" placeholder="👤 담당자" style="${SST}">
        <input type="text" class="acc-step-input" data-idx="${i}" data-k="vendorPhone" value="${esc(s.vendorPhone||'')}" placeholder="📞 연락처" style="${SST}">
      </div>
    </div>`;
  }).join("");
  wlAutoGrow(list);
  list.querySelectorAll(".acc-step-input").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const idx = Number(inp.dataset.idx);
      const k = inp.dataset.k;
      if(_accidentSteps[idx]) _accidentSteps[idx][k] = inp.value;
    });
    if(inp.dataset.k === "date"){
      inp.addEventListener("change", ()=>{ redrawAccStepList(); });
    }
  });
  list.querySelectorAll(".acc-step-del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.dataset.idx);
      if(confirm("이 기록을 삭제할까요?")){
        _accidentSteps.splice(idx, 1);
        redrawAccStepList();
      }
    });
  });
}

/* ===== v46: 단계 시간순 도우미 ===== */
/* 저장은 오래된 → 최신 순(시간순). 화면은 최신이 위. 번호는 시간순 번호. */
function wlSortStepsAsc(arr){
  return (arr||[]).slice().sort((a,b)=>{
    const da = (a && a.date) || "", dbb = (b && b.date) || "";
    if(da !== dbb) return da.localeCompare(dbb);
    return 0;
  });
}
/* [{s, no}] — 최신이 앞. no 는 시간순 번호(1부터) */
function wlStepsNewestFirst(arr){
  const asc = wlSortStepsAsc(arr);
  return asc.map((s,i)=>({ s:s, no:i+1 })).reverse();
}
/* 가장 최근 단계 */
/* 내용만큼 늘어나는 입력칸 */
function wlAutoGrow(root){
  (root||document).querySelectorAll('textarea.wl-grow').forEach(t=>{
    const fit = ()=>{
      const userH = parseInt(t.dataset.userH || '0', 10) || 0;
      t.style.height = 'auto';
      t.style.height = Math.max(68, t.scrollHeight + 2, userH) + 'px';
    };
    if(!t._grow){
      t._grow = true;
      t.addEventListener('input', fit);
      /* 직접 늘린 높이는 기억한다 */
      t.addEventListener('mouseup', ()=>{ t.dataset.userH = String(t.offsetHeight); });
      t.addEventListener('touchend', ()=>{ t.dataset.userH = String(t.offsetHeight); });
    }
    fit();
  });
}
function wlLastStep(arr){
  const asc = wlSortStepsAsc(arr);
  return asc.length ? asc[asc.length-1] : null;
}

/* ===== v46: 진행업무 처리단계 — 상세 내용 바로 아래에 쌓인다 ===== */
var _progressSteps = [];

/* 처리단계 영역을 특정 필드 바로 아래에 끼워 넣기 */
function wlPutStepsAfter(area, key){
  const grid = $("mFields");
  if(!grid) return;
  const anchor = document.getElementById("m-" + key);
  const box = anchor ? anchor.closest(".field") : null;
  if(box && box.parentNode === grid) box.after(area);
  else grid.appendChild(area);
}

function renderProgressSteps(steps){
  _progressSteps = (steps && Array.isArray(steps)) ? steps.slice() : [];
  const grid = $("mFields");
  if(!grid) return;
  const old = document.getElementById("progStepsArea");
  if(old) old.remove();
  const area = document.createElement("div");
  area.id = "progStepsArea";
  area.className = "field full";
  area.style.cssText = "grid-column:1/-1;margin-top:8px;padding:14px;background:#eef6ff;border:2px solid #90c2f0;border-radius:12px";
  area.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">
      <label style="font-weight:800;font-size:14px;color:#1a4a8a;margin:0">📋 진행 기록 (시간순)</label>
      <button type="button" id="btnAddProgStep" style="background:#3f7cb8;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer">➕ 내용 추가</button>
    </div>
    <div id="progStepsList" style="display:flex;flex-direction:column;gap:8px"></div>
    <div id="progStepsEmpty" style="display:none;text-align:center;padding:18px;color:#aab8c8;font-size:13px">진행된 내용을 날짜별로 쌓아두세요 — "➕ 내용 추가"</div>
  `;
  wlPutStepsAfter(area, "detail");
  document.getElementById("btnAddProgStep").addEventListener("click", ()=>{
    _progressSteps.push({ date: todayStr(), action: "", detail: "", vendor: "", owner: "", vendorPhone: "" });
    redrawProgStepList();
    setTimeout(()=>{
      const first = document.querySelector("#progStepsList .prog-step-card");
      if(first){
        first.scrollIntoView({block:"nearest"});
        const t = first.querySelector('[data-k="action"]');
        if(t) t.focus();
      }
    }, 40);
  });
  redrawProgStepList();
}

function redrawProgStepList(){
  const list = document.getElementById("progStepsList");
  const empty = document.getElementById("progStepsEmpty");
  if(!list) return;
  if(!_progressSteps.length){
    list.innerHTML = "";
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";
  const IST = "height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff";
  const SST = "height:34px;padding:0 9px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:12.5px;font-family:inherit;background:#f7faff";
  /* 최신이 맨 위 · 번호는 시간순 그대로 */
  const view = _progressSteps.map((s,idx)=>({s:s, idx:idx}))
    .sort((a,b)=>((a.s.date||"").localeCompare(b.s.date||"")))
    .map((o,n)=>({...o, no:n+1}))
    .reverse();
  list.innerHTML = view.map((o,pos)=>{
    const s = o.s, i = o.idx;
    return `
    <div class="prog-step-card" data-idx="${i}" style="background:#fff;border:1.5px solid ${pos===0?'#3f7cb8':'#90c2f0'};border-radius:10px;padding:9px 10px">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;flex-wrap:wrap">
        <span style="background:${pos===0?'#1a4a8a':'#3f7cb8'};color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:12px">${o.no}</span>
        ${pos===0?`<span style="background:#dbeafe;color:#1a4a8a;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:8px">최근</span>`:''}
        <input type="date" class="prog-step-input" data-idx="${i}" data-k="date" value="${esc(s.date||'')}" style="${IST};width:150px;flex:0 0 auto">
        <input type="text" class="prog-step-input" data-idx="${i}" data-k="action" value="${esc(s.action||'')}" placeholder="제목 (예: 견적 접수, 자재 입고, 시공 완료)" style="${IST};flex:1;min-width:120px">
        <button type="button" class="prog-step-del" data-idx="${i}" title="삭제" style="background:#fde8e8;color:#b52929;border:none;border-radius:7px;width:32px;height:32px;font-size:13px;font-family:inherit;cursor:pointer;flex:0 0 auto">🗑</button>
      </div>
      <textarea class="prog-step-input wl-grow" data-idx="${i}" data-k="detail" rows="1" placeholder="자세한 사항 — 통화 내용, 금액, 다음 할 일 등 (직접 늘릴 수 있어요)" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;line-height:1.5;resize:vertical;overflow:auto;min-height:68px;margin-bottom:6px">${esc(s.detail||s.memo||'')}</textarea>
      <div style="display:grid;grid-template-columns:1.2fr 1fr 1.1fr;gap:6px">
        <input type="text" class="prog-step-input" data-idx="${i}" data-k="vendor" value="${esc(s.vendor||'')}" placeholder="🏢 업체" style="${SST}">
        <input type="text" class="prog-step-input" data-idx="${i}" data-k="owner" value="${esc(s.owner||'')}" placeholder="👤 담당자" style="${SST}">
        <input type="text" class="prog-step-input" data-idx="${i}" data-k="vendorPhone" value="${esc(s.vendorPhone||'')}" placeholder="📞 연락처" style="${SST}">
      </div>
      ${s.field?`<div style="font-size:11.5px;color:#7a92a8;margin-top:5px">🏷 ${esc(s.field)}</div>`:''}
    </div>`;
  }).join("");
  wlAutoGrow(list);
  list.querySelectorAll(".prog-step-input").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const idx = Number(inp.dataset.idx);
      const k = inp.dataset.k;
      if(_progressSteps[idx]) _progressSteps[idx][k] = inp.value;
    });
    if(inp.dataset.k === "date"){
      inp.addEventListener("change", ()=>{ redrawProgStepList(); });
    }
  });
  list.querySelectorAll(".prog-step-del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.dataset.idx);
      if(confirm("이 기록을 삭제할까요?")){
        _progressSteps.splice(idx, 1);
        redrawProgStepList();
      }
    });
  });
}

function renderModalThumbs(){ renderThumbs($("m-thumbs"),modalPhotos,i=>{ modalPhotos.splice(i,1); renderModalThumbs(); }); }

/* ===== 첨부파일 모달 UI (v15 신규) ===== */
function renderModalAttachList(){
  const box=$("mAttachList");
  if(!modalAttachments.length){ box.innerHTML=`<div style="font-size:11px;color:var(--ink-soft);padding:1px 2px">아직 추가된 파일/폴더 링크가 없습니다.</div>`; return; }
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
  // v44: 진행업무 처리단계 — 조회창에서도 시간순으로 보여줌
  if((kind==="progress"||kind==="accident") && (data.steps||[]).length){
    const isAcc = (kind==="accident");
    const bd = isAcc ? "#c2740b" : "#2563a8";
    /* ⚠ worklog.css 의 white-space:pre-wrap 때문에 줄바꿈·들여쓰기가 그대로 공백이 된다.
       → 태그 사이에 공백을 하나도 넣지 않는다. */
    const stepsHtml = wlStepsNewestFirst(data.steps).map((o,pos)=>{
      const st = o.s;
      const who = [ st.vendor&&('🏢 '+st.vendor), st.owner&&('👤 '+st.owner),
                    st.vendorPhone&&('📞 '+st.vendorPhone), st.field&&('🏷 '+st.field) ].filter(Boolean);
      let h = '<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px solid #eef4fa;white-space:normal">';
      h += '<span style="flex:0 0 auto;background:'+(pos===0?bd:'#c3d4e6')+';color:#fff;font-size:10px;font-weight:800;min-width:19px;height:19px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;margin-top:2px;line-height:1">'+o.no+'</span>';
      h += '<span style="flex:0 0 auto;font-size:12px;font-weight:700;color:#7a92a8;white-space:nowrap;margin-top:3px;line-height:1.3">'+esc((st.date||'').slice(2))+'</span>';
      h += '<div style="flex:1;min-width:0;white-space:normal">';
      h += '<div style="font-size:13px;font-weight:700;color:#1a2f45;line-height:1.45">'+esc(st.action||'')+(pos===0?'<span style="font-size:10px;font-weight:800;color:'+bd+'"> · 최근</span>':'')+'</div>';
      if(st.detail||st.memo) h += '<div class="wl-pre" style="font-size:12.5px;color:#41627f;line-height:1.5">'+esc(st.detail||st.memo)+'</div>';
      if(who.length) h += '<div style="font-size:11.5px;color:#8ea3b8;line-height:1.4">'+who.map(esc).join(' · ')+'</div>';
      h += '</div></div>';
      return h;
    }).join('');
    rows+='<div class="vrow"><div class="vk" style="white-space:nowrap">📋 '+(isAcc?'처리 기록':'진행 기록')+' <span style="font-weight:700;color:#a7b6c6;font-size:11px">'+data.steps.length+'건</span></div>'
        + '<div class="vv wl-steps" style="white-space:normal;line-height:1.4;padding-top:2px">'+stepsHtml+'</div></div>';
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
      const k=scanKindOf(r.type);
      const t=scanRefTitle(r.type,r.data);
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;background:#e8f0fa;color:#3f7cb8;font-size:12px;font-weight:700;cursor:pointer;max-width:220px" title="${esc(t)}" data-scan-type="${r.type}" data-scan-id="${r.id}">${k.icon} <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t)}</span></span>`;
    }).join(' ');
    scanRefsHtml=`<div class="vrow"><div class="vk">🔗 스캔첨부</div><div class="vv" id="vScanRefs">${chips}</div></div>`;
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

/* 업무 모달 scan-app 연결 항목 (영수증·명함·서류·사진) */
let _mScanRefs = [];

/* scan-app 항목의 종류별 아이콘·제목·부제목을 한 곳에서 정한다.
   목록·저장·상세보기가 전부 이걸 쓴다. */
const SCAN_KIND = {
  receipt:{ icon:'🧾', label:'영수증' },
  card:   { icon:'💼', label:'명함'   },
  text:   { icon:'📄', label:'서류'   },
  photo:  { icon:'🖼', label:'사진'   }
};
function scanKindOf(t){ return SCAN_KIND[t] || { icon:'📎', label:'첨부' }; }
function scanRefTitle(type, d){
  d = d || {};
  if(type==='receipt') return d.place || '영수증';
  if(type==='card')    return d.name  || d.company || '명함';
  if(type==='text')    return d.title || '서류';
  if(type==='photo')   return d.title || '사진';
  return '첨부';
}
function scanRefSub(type, d){
  d = d || {};
  if(type==='receipt') return (d.date||'') + (d.amount ? ' · '+Number(d.amount).toLocaleString()+'원' : '');
  if(type==='card')    return (d.company||'') + (d.mobile ? ' · '+d.mobile : '');
  if(type==='text')    return (d.docType||'') + (d.date ? (d.docType?' · ':'')+d.date : '');
  if(type==='photo')   return (d.cat||'') + (d.date ? (d.cat?' · ':'')+d.date : '');
  return d.date || '';
}
function renderMScanRefs(){
  const wrap = $("mScanRefs"); if(!wrap) return;
  if(!_mScanRefs.length){ wrap.innerHTML=''; return; }
  wrap.innerHTML = _mScanRefs.map(function(r,idx){
    const d = r.data || {};
    const icon = scanKindOf(r.type).icon;
    const title = scanRefTitle(r.type, d);
    const sub = scanRefSub(r.type, d);
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
      if(r&&r.data&&r.data.photoUrl) showImg(r.data.photoUrl, scanRefTitle(r.type,r.data));
    });
  });
}

/* 업무 모달 scan-app picker 버튼 — 종류를 고르고 연다.
   예전엔 'receipt' 로 박혀 있어 서류·사진은 고를 방법이 아예 없었다. */
function _onScanPicked(type,id,data){
  _mScanRefs.push({type,id,data:data||{}});
  renderMScanRefs();
  toast(scanKindOf(type).icon+' '+scanRefTitle(type,data)+' 첨부됨');
}
/* ⚠️ worklog.html 의 IIFE 에도 같은 주소가 있다. 그쪽이 원본이고 이건 대비책이다.
   scan-app 주소가 바뀌면 두 곳 다 고쳐야 한다. */
const SCAN_APP_URL_FALLBACK = 'https://20251014peru-gif.github.io/scan-app.html';
let _scanPickCb = null;

function openScanPickerOfType(type){
  /* 1순위 — html 쪽 창구가 있으면 그걸 쓴다 (주소가 한 곳에 있으니 이게 낫다) */
  if(typeof window._openScanPickerOfType==='function'){
    window._openScanPickerOfType(type, _onScanPicked);
    return;
  }
  /* 2순위 — 옛 worklog.html 이어도 동작하게 js 가 직접 연다.
     iframe·오버레이는 옛 html 에도 있으므로 이것만으로 충분하다.
     (html 쪽엔 receipt 로 박힌 _openScanPickerForWork 뿐이라 서류를 못 연다) */
  const frame = document.getElementById('scanPickerFrame');
  const ov    = document.getElementById('scanPickerOverlay');
  if(!frame || !ov){ toast('scan-app 선택창을 찾을 수 없습니다'); return; }
  _scanPickCb = _onScanPicked;
  frame.src = SCAN_APP_URL_FALLBACK + '?mode=picker&type=' + encodeURIComponent(type) + '&linkedTo=';
  ov.style.display = 'flex';
}

function _closeScanPickerJs(){
  const frame = document.getElementById('scanPickerFrame');
  const ov    = document.getElementById('scanPickerOverlay');
  if(ov) ov.style.display = 'none';
  if(frame) frame.src = 'about:blank';
  _scanPickCb = null;
}

/* 자체 수신기 — 2순위로 열었을 때만 동작한다.
   1순위로 열면 _scanPickCb 가 null 이라 여기서 그냥 흘려보내고
   html 쪽 수신기가 처리한다. 둘이 겹쳐서 두 번 들어가지 않는다. */
window.addEventListener('message', function(e){
  if(!e.data || e.data.source !== 'scan-app') return;
  if(e.data.action !== 'selected' || !_scanPickCb) return;
  const cb = _scanPickCb;
  _scanPickCb = null;
  try{ cb(e.data.payload.type, e.data.payload.id, e.data.payload.data); }
  finally{ _closeScanPickerJs(); }
});
function closeScanKindMenu(){
  const m=document.getElementById('scanKindMenu');
  if(m) m.remove();
}
const mScanPickBtn = $("mScanPickBtn");
if(mScanPickBtn){
  mScanPickBtn.addEventListener("click",(e)=>{
    e.stopPropagation();
    if(document.getElementById('scanKindMenu')){ closeScanKindMenu(); return; }
    const menu=document.createElement('div');
    menu.id='scanKindMenu';
    menu.style.cssText='position:absolute;z-index:9999;background:#fff;border:1.5px solid #dbe6f4;'
      +'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:6px;display:flex;'
      +'flex-direction:column;gap:2px;min-width:150px';
    menu.innerHTML=['text','receipt','card','photo'].map(function(t){
      const k=scanKindOf(t);
      return '<button type="button" data-kind="'+t+'" style="display:flex;align-items:center;gap:8px;'
        +'padding:9px 12px;border:none;background:transparent;border-radius:7px;cursor:pointer;'
        +'font-family:inherit;font-size:13px;font-weight:600;color:#1a2f45;text-align:left;width:100%">'
        +'<span style="font-size:16px">'+k.icon+'</span>'+k.label+'</button>';
    }).join('');
    document.body.appendChild(menu);
    const r=mScanPickBtn.getBoundingClientRect();
    /* 버튼 위쪽에 띄운다 — 아래는 저장/취소 버튼에 가린다.
       화면 위로 넘치면 아래로 돌린다. */
    const top=r.top+window.scrollY-menu.offsetHeight-6;
    menu.style.top=(top<window.scrollY+4 ? r.bottom+window.scrollY+6 : top)+'px';
    menu.style.left=Math.max(6, Math.min(r.left+window.scrollX, window.innerWidth-menu.offsetWidth-6))+'px';
    menu.querySelectorAll('[data-kind]').forEach(function(b){
      b.addEventListener('mouseenter',function(){ b.style.background='#eef5ff'; });
      b.addEventListener('mouseleave',function(){ b.style.background='transparent'; });
      b.addEventListener('click',function(ev){
        ev.stopPropagation();
        const t=b.dataset.kind;
        closeScanKindMenu();
        openScanPickerOfType(t);
      });
    });
    setTimeout(function(){
      document.addEventListener('click', closeScanKindMenu, { once:true });
    },0);
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

// ── 엔터: 셀(input) 안에서도, 셀 밖에서도 저장. Shift+Enter는 줄바꿈 ──
document.addEventListener("keydown", e=>{
  if(e.key!=="Enter") return;
  const overlay = $("overlay");
  if(!overlay || !overlay.classList.contains("show")) return;
  const tag = (document.activeElement||{}).tagName||"";
  if(tag==="SELECT") return;
  if(tag==="TEXTAREA"){
    if(e.shiftKey) return;
    e.preventDefault();
    $("mSave").click();
    return;
  }
  if(e.shiftKey) return;
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
  for(const f of sc){ if(f.req && !String(obj[f.k]||"").trim()){ console.warn("[저장 막힘] 필수값 누락:", f.k, f.label, "현재값:", obj[f.k]); toast("⚠️ "+f.label+"을(를) 입력하세요"); return; } }
  // v19: filelink가 폴더면 경로 끝에 \ 자동 추가, 파일이면 끝 슬래시 제거
  if(mKind==="filelink" && obj.path){
    if(obj.ptype==="폴더" && !/[\\\/]$/.test(obj.path)) obj.path = obj.path + "\\";
    if(obj.ptype==="파일") obj.path = obj.path.replace(/[\\\/]+$/, "");
  }
  if(PHOTO_KINDS.includes(mKind)) obj.photos=modalPhotos.slice();
  if(ATTACH_KINDS.includes(mKind)) obj.attachments=modalAttachments.slice();
  /* scan-app 연결 항목 저장 — 종류별로 화면에 쓰는 값을 다 남긴다.
     예전엔 place/name/date/amount 만 남겨서
     명함은 회사·연락처가, 서류는 제목이 저장 후 사라졌다. */
  if(_mScanRefs.length) obj.scanRefs=_mScanRefs.map(r=>({
    type:r.type,
    id:r.id,
    data:r.data ? {
      place:r.data.place||'',
      name:r.data.name||'',
      title:r.data.title||'',
      docType:r.data.type||r.data.docType||'',   /* 서류 종류 — r.data.type 은 항목 종류와 이름이 겹쳐 옮겨 담는다 */
      owner:r.data.owner||'',                    /* 업무/개인 — scan-app 이 서류에도 붙인다 */
      cat:r.data.cat||'',
      company:r.data.company||'',
      mobile:r.data.mobile||'',
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
    obj.steps = wlSortStepsAsc((_accidentSteps||[]).filter(s=>s.action||s.vendor||s.owner||s.memo));
  }
  // v44: 진행업무면 처리 단계 함께 저장 (분야/업체/연락처 포함)
  if(mKind==="progress"){
    obj.steps = (typeof _progressSteps!=="undefined" && Array.isArray(_progressSteps)) ? wlSortStepsAsc(_progressSteps.filter(s=>s.action||s.detail||s.field||s.vendor||s.owner)) : [];
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
    if(expType==="개인비용" || expType==="후불청구" || expType==="전표"){
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
document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>{ if(window.wlAddNew) window.wlAddNew(b.dataset.add); else openEditor(b.dataset.add,null); }));

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
  const refY = en.refYear ? (String(en.refYear).slice(-2)+"년 ") : "";
  const refM = en.refMonth ? (en.refMonth+"월 ") : "";
  const ymf=(refY+refM+(en.floor?en.floor:"")).trim();
  const matQty = matDisplay(en);
  const parts=[ymf, (en.title||""), en.detail, matQty, (Number(en.cost)?won(en.cost):"")].map(x=>(x||"").toString().trim()).filter(Boolean);
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
  renderTrash();
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
      if(online){ const {id,...p}=rec; _wlDoc(rec).set(p).catch(()=>{}); }
    });
    entries=Object.values(byId); lsSave(); renderAll();
    toast(`복구 완료 — 신규 ${added}건, 갱신 ${updated}건`);
  };
  reader.onerror=()=>toast("파일 읽기 실패");
  reader.readAsText(file);
}
const CSV_COLS={
  work:[["date","날짜"],["status","상태"],["floor","해당층"],["loc","위치"],["title","제목"],["detail","세부내용"],["field","분야"],["material","자재"],["qty","수량"],["cost","비용"],["improve","개선사항"]],
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
  const _matQty = matDisplay(en);
  return `<div class="row-item" data-kind="work" data-id="${en.id}">
    <div class="grow">
      <div class="t">${esc(displayTitle(en))} <span class="st ${statusClass(en.status)}">${esc(en.status||"")}</span> <span class="pill ${fieldClass(en.field)}">${esc(en.field||"")}</span>${expBadge}${(en.attachments&&en.attachments.length)?' 📎':''}</div>
      <div class="m">${metaLine([en.floor,en.loc,en.detail,_matQty,en.cost?won(en.cost)+"원":""])}</div>
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
  if(o.kind==="memo"){ const t=o.title||"메모"; const b=(o.body||o.text||"").replace(/\n/g," "); return b?t+" "+b:t; }
  if(o.kind==="call"){ const n=o.name||"통화"; const c=(o.content||"").replace(/\n/g," "); return c?n+" "+c:n; }
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
    else if(e.kind==="vacation"){ datesBetween(e.start,e.end).forEach(d=>{ (vac[d]=vac[d]||[]).push((e.name||"휴가")+(e.vtype?" "+e.vtype:"")+(e.note?" · "+e.note:"")); }); }
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
    html+=`<div class="${cls.join(" ")}" data-d="${ds}"><span class="dnum" data-dow="${dow[wd]}">${d}</span>${inner}</div>`;
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
  wireCards(box, false); // 달력: 조회창 → 수정 버튼으로 수정
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
  const _dayObj=new Date(day),_wn=['일','월','화','수','목','금','토'];
  let h=`<div style="display:flex;align-items:center;gap:16px;margin-bottom:6px"><span style="font-size:48px;font-weight:900;color:#1a2f45;line-height:1">${_dayObj.getDate()}</span><span style="font-size:22px;font-weight:800;color:#1a2f45">${_dayObj.getMonth()+1}월 ${_dayObj.getDate()}일 (${_wn[_dayObj.getDay()]}) 업무일지 보고서</span></div><hr style="border:none;border-top:2px solid #1a2f45;margin:6px 0 12px">`;
  const sec=(title,items,cls)=> items.length?`<div class="rsec ${cls}"><h2>${title} (${items.length}건)</h2>`+items.join("")+`</div>`:"";
  h+=sec("업무", w.map(en=>`<div class="it"><b>[${esc(en.status||"")}]</b> ${esc(en.floor||"")} ${esc(en.loc||"")} ${esc(en.title||"")}${en.detail?" — "+esc(en.detail):""}${en.field?" ["+esc(en.field)+"]":""}${matDisplay(en)?" / 자재: "+esc(matDisplay(en)):""}${Number(en.cost)?" / "+won(en.cost)+"원":""}${en.improve?"<br>↳ 개선: "+esc(en.improve):""}</div>`), "work");
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
    else if(e.kind==="vacation"){ datesBetween(e.start,e.end).forEach(d=>{ (vac[d]=vac[d]||[]).push((e.name||"휴가")+(e.vtype?" "+e.vtype:"")+(e.note?" · "+e.note:"")); }); }
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
      if(online&&db) _wlDoc(e).update({category:newCat}).catch(()=>{});
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
              if(online && db) _wlDoc(e).set(e).catch(()=>{});
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
    return `<div class="cat-group ${colorClass}${collapsed?" collapsed":""}" data-cat="${esc(c)}" style="margin-bottom:6px">
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
const MAT_FILTER = { tab:"stock", field:"전체", q:"", recurring:"전체", lowOnly:false, txYm:"thisMonth", sortKey:"itemName", sortAsc:true };

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
  $("btnAddItem").addEventListener("click",()=>{ if(window.wlAddNew) window.wlAddNew("item"); else openEditor("item",null); });
  $("btnAddStock").addEventListener("click",()=>{ if(window.wlAddNew) window.wlAddNew("stock"); else openEditor("stock",null); });
  $("btnMatExcel").addEventListener("click",matExcelCopy);
  $("btnGitUpload").addEventListener("click", async ()=>{
    let tok = localStorage.getItem('_ghToken')||'';
    if(!tok){
      tok = prompt('GitHub Personal Access Token 입력:\n(한 번만 입력하면 저장)');
      if(!tok) return;
      localStorage.setItem('_ghToken', tok.trim());
      tok = tok.trim();
    }
    toast('🚀 GitHub 업로드 중...');
    try{
      await githubUpload(tok);
      toast('✅ GitHub 업로드 완료!');
    }catch(e){
      toast('❌ 업로드 실패: '+e.message);
      localStorage.removeItem('_ghToken');
    }
  });
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
        recurring: "수시구매",
        location: "",
        memo: "",
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
{"shopId":"상품ID(엑셀의 상품ID 또는 상품코드 컬럼 값을 그대로)","itemName":"품목명","spec":"규격을 간단히 핵심만","unit":"단위","field":"전기|소방|기계|통신|영선|주차|청소|기타","maker":"제조원","vendor":"거래처/공급업체","unitPrice":숫자,"safetyStock":숫자,"recurring":"정기구매|수시구매|비정기구매|계절구매|미구매","location":"보관위치","memo":"메모"}

중요한 규칙:
- shopId: 엑셀의 "상품ID", "상품코드", "제품번호" 같은 컬럼 값을 그대로. 없으면 빈 문자열.
- spec(규격): 핵심 정보만 추려서 짧게 (예: "300mm×100m·재생" / 전체 옵션 나열 금지)
- unit: "1EA", "1BOX", "1ROL", "1PR" 같은 형식은 단위 부분만 추출 ("EA", "BOX", "ROL", "PR")
- field: 품목 성격으로 추정. 청소용품 → "청소", 전기재 → "전기", 모르면 "기타".
- maker: "제조원" 또는 "메이커" 컬럼.
- vendor: "거래처", "구매처", "공급업체" 컬럼. 없으면 빈 문자열.
- recurring: 명시 없으면 "수시구매".
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
          recurring:"수시구매",
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
    $("matRecFilter").innerHTML=`<option value="전체">주기 전체</option>`+[
    ["정기구매","정기구매 (예: 월 정기발주 청소용품)"],
    ["수시구매","수시구매 (예: 전구·소모품 소진시)"],
    ["비정기구매","비정기구매 (예: 공구·부속 파손시)"],
    ["계절구매","계절구매 (예: 에어컨필터·부동액)"],
    ["미구매",  "미구매 (예: 단종·교체완료)"],
  ].map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
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
  const rows=items.map(it=>({
    item:it,
    stock:calcStock(it.id),
  })).filter(r=>{
    if(!MAT_FILTER.lowOnly) return true;
    return Number(r.item.safetyStock||0)>0 ? r.stock < Number(r.item.safetyStock) : r.stock<=0;
  }).sort((a,b)=>{
    const k=MAT_FILTER.sortKey, asc=MAT_FILTER.sortAsc?1:-1;
    let av, bv;
    const RO=["정기구매","수시구매","비정기구매","계절구매","미구매"];
    const aRetired=(a.item.recurring||"")==="미구매", bRetired=(b.item.recurring||"")==="미구매";
    if(aRetired!==bRetired) return aRetired?1:-1;
    if(k==="stock"){ av=a.stock; bv=b.stock; }
    else if(k==="unitPrice"){ av=Number(a.item.unitPrice||0); bv=Number(b.item.unitPrice||0); }
    else if(k==="recurring"){ av=RO.indexOf(a.item.recurring||"수시구매"); bv=RO.indexOf(b.item.recurring||"수시구매"); }
    else if(k==="lastBuy"){
      const la=entries.filter(e=>e.kind==="stock"&&e.itemId===a.item.id&&e.stockType==="입고").sort((x,y)=>(y.date||"").localeCompare(x.date||"")).shift();
      const lb=entries.filter(e=>e.kind==="stock"&&e.itemId===b.item.id&&e.stockType==="입고").sort((x,y)=>(y.date||"").localeCompare(x.date||"")).shift();
      av=la?la.date:""; bv=lb?lb.date:"";
    }
    else { av=(a.item[k]||"").toLowerCase(); bv=(b.item[k]||"").toLowerCase(); }
    if(av<bv) return -1*asc;
    if(av>bv) return 1*asc;
    return 0;
  });
  const body=$("matStockBody");
  // 헤더 정렬 클릭 바인딩 (1회)
  if(!window._matSortBound){
    window._matSortBound=true;
    document.querySelectorAll('[data-sort]').forEach(th=>{
      th.addEventListener('click',()=>{
        const k=th.dataset.sort;
        if(MAT_FILTER.sortKey===k) MAT_FILTER.sortAsc=!MAT_FILTER.sortAsc;
        else { MAT_FILTER.sortKey=k; MAT_FILTER.sortAsc=true; }
        // 아이콘 업데이트
        document.querySelectorAll('[id^="sortIcon_"]').forEach(el=>el.textContent='');
        const icon=document.getElementById('sortIcon_'+k);
        if(icon) icon.textContent=MAT_FILTER.sortAsc?' ▲':' ▼';
        renderStockOverview();
      });
    });
  }
  // 현재 정렬 아이콘 표시
  document.querySelectorAll('[id^="sortIcon_"]').forEach(el=>el.textContent='');
  const curIcon=document.getElementById('sortIcon_'+MAT_FILTER.sortKey);
  if(curIcon) curIcon.textContent=MAT_FILTER.sortAsc?' ▲':' ▼';
  if(!rows.length){ body.innerHTML=`<tr><td colspan="9" class="empty">${entries.some(e=>e.kind==="item")?"조건에 맞는 품목이 없습니다.":"➕ 품목 추가를 눌러 자주 쓰는 자재를 등록해 보세요."}</td></tr>`; return; }
  body.innerHTML=rows.map(r=>{
    const it=r.item, st=r.stock;
    const safe=Number(it.safetyStock||0);
    const lowCls = safe>0 && st<safe ? "st-low" : (st<=0 ? "st-zero" : "");
    const cleanName = (it.itemName||"").replace(/^\[.*?\]/,"").trim();
    const shopId = it.shopId||it.itemCode||"";
    // 마지막 입고 날짜 계산
    const lastStock = entries.filter(e=>e.kind==="stock"&&e.itemId===it.id&&e.stockType==="입고")
      .sort((a,b)=>(b.date||"").localeCompare(a.date||"")).shift();
    const lastBuyDate = lastStock ? lastStock.date : null;
    const isRetired = (it.recurring||'') === '미구매';
    const nameStyle = isRetired ? 'font-size:13px;text-decoration:line-through;color:#b0bec5' : 'font-size:13px';
    const rowOpacity = isRetired ? 'opacity:0.55;' : '';
    const recLabel = {'정기구매':'정기','수시구매':'수시','비정기구매':'비정기','계절구매':'계절','미구매':'미구매'}[it.recurring||''] || (it.recurring||'');
    const recColor = {'정기구매':'#3f7cb8','수시구매':'#64748b','비정기구매':'#e67e22','계절구매':'#00838f','미구매':'#b0bec5'}[it.recurring||''] || '#94a3b8';
    return `<tr data-id="${it.id}" class="${lowCls}" style="cursor:pointer;${rowOpacity}">
      <td style="font-size:11px;color:#94a3b8;font-weight:600;white-space:nowrap;overflow:hidden">
        <span>${esc(shopId)}</span>
        ${shopId?`<button onclick="event.stopPropagation();copyText('${esc(shopId)}','📋 복사됨')" style="margin-left:4px;padding:1px 5px;font-size:10px;border:1px solid #dbe6f4;border-radius:4px;background:#f0f7ff;color:#3f7cb8;cursor:pointer;font-family:inherit">복사</button>`:''}
      </td>
      <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:4px" title="${esc(it.itemName||'')}">
        <b style="${nameStyle}">${esc(cleanName)}</b>
      </td>
      <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#64748b" title="${esc(it.spec||'')}">${esc(it.spec||'')}</td>
      <td style="font-size:13px;color:${recColor};font-weight:700;white-space:nowrap">${recLabel}</td>
      <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#64748b" title="${esc(it.memo||'')}">${esc((it.memo||"").slice(0,20))}${(it.memo||"").length>20?'…':''}</td>
      <td style="font-size:11px;color:#64748b;text-align:center">${esc(it.unit||"")}</td>
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
    tr.style.cursor = "pointer";
    tr.addEventListener("click", function(e){
      if(e.target.closest("[data-act]")) return;
      if(typeof window.openItemViewer === 'function') window.openItemViewer(id);
      else openEditor("item", id);
    });
    tr.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",e=>{
      e.stopPropagation();
      if(b.dataset.act==="edit") openEditor("item",id);
      else {
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
    <td>${it.recurring&&it.recurring!=="수시구매"?`<span class="pill leave" style="font-size:10px">🔁 ${esc(it.recurring)}</span>`:""}</td>
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
  // 마지막 구매일 계산
  const _lastStock = entries.filter(e=>e.kind==="stock"&&e.itemId===id&&e.stockType==="입고")
    .sort((a,b)=>(b.date||"").localeCompare(a.date||"")).shift();
  const _cleanMemo = (item.memo||'').replace(/마지막 구매: \d{4}-\d{2}-\d{2}/,'').trim();
  const ov = document.createElement('div');
  ov.id = 'quickEditMatOverlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
  const INP = 'width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:12px;font-family:inherit;background:#f7faff;outline:none';
  const SEL = 'width:100%;box-sizing:border-box;height:32px;padding:0 6px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:12px;font-family:inherit;background:#f7faff;outline:none';
  const LBL = 'display:block;font-size:11px;font-weight:700;color:#7a92a8;margin-bottom:3px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:18px;width:100%;max-width:560px;padding:20px 24px;box-shadow:0 12px 40px rgba(0,0,0,.2);max-height:90vh;overflow:auto">
      <h3 style="margin:0 0 4px;font-size:17px;font-weight:800;color:#0369a1">✏️ 자재 수정</h3>
      <div style="font-size:11px;color:#aab8c8;margin-bottom:14px">규격을 간단하게 정리하거나, 분야/단가 등을 빠르게 수정하세요</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div style="grid-column:1/3">
          <label style="${LBL}">품목명 <span style="color:#e74c3c">*</span></label>
          <input type="text" id="qeName" value="${esc(item.itemName||'')}" style="${INP}">
        </div>
        <div>
          <label style="${LBL}">서브원 상품ID</label>
          <input type="text" id="qeShopId" value="${esc(item.shopId||'')}" placeholder="예: 6573068" style="${INP}">
        </div>
        <div style="grid-column:1/-1">
          <label style="${LBL}">규격 <span style="color:#aab8c8;font-weight:500">(짧게 정리)</span></label>
          <input type="text" id="qeSpec" value="${esc(item.spec||'')}" placeholder="예: 8W / Φ60mm" style="${INP}">
        </div>
        <div>
          <label style="${LBL}">단위</label>
          <input type="text" id="qeUnit" value="${esc(item.unit||'')}" placeholder="EA, BOX" style="${INP}">
        </div>
        <div>
          <label style="${LBL}">판매단가 (원)</label>
          <input type="number" id="qePrice" value="${Number(item.unitPrice)||0}" style="${INP}">
        </div>
        <div>
          <label style="${LBL}">구매 주기</label>
          <select id="qeRecurring" style="${SEL}">
            ${[
            ["정기구매","정기구매 (예: 월 정기발주 청소용품)"],
            ["수시구매","수시구매 (예: 전구·소모품 소진시)"],
            ["비정기구매","비정기구매 (예: 공구·부속 파손시)"],
            ["계절구매","계절구매 (예: 에어컨필터·부동액)"],
            ["미구매",  "미구매 (예: 단종·교체완료)"],
          ].map(([v,l])=>`<option value="${v}" ${(item.recurring||"수시구매")===v?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="${LBL}">분야</label>
          <select id="qeField" style="${SEL}">
            ${FIELDS.map(f=>`<option value="${esc(f)}" ${item.field===f?'selected':''}>${esc(f)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="${LBL}">거래처</label>
          <input type="text" id="qeVendor" value="${esc(item.vendor||'')}" placeholder="예: 서브원" style="${INP}">
        </div>
        <div>
          <label style="${LBL}">제조원</label>
          <input type="text" id="qeMaker" value="${esc(item.maker||'')}" placeholder="예: (주)동원피앤아이" style="${INP}">
        </div>
        <div style="grid-column:1/-1;display:grid;grid-template-columns:1fr 160px;gap:10px">
          <div>
            <label style="${LBL}">메모</label>
            <textarea id="qeMemo" rows="2" placeholder="보관위치, 특이사항 등" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:12px;font-family:inherit;background:#f7faff;outline:none;resize:none">${esc(_cleanMemo)}</textarea>
          </div>
          <div>
            <label style="${LBL}">마지막 구매일</label>
            <input type="date" id="qeLastBuy" value="${item.lastBuyDate||(_lastStock?_lastStock.date:'')}" style="width:100%;box-sizing:border-box;height:32px;padding:0 8px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:12px;font-family:inherit;background:#f7faff;outline:none">
          </div>
        </div>
        <div style="grid-column:1/-1;display:flex;gap:8px;margin-top:4px">
          <button id="qeCancel" type="button" style="flex:1;height:44px;border:2px solid #dbe6f4;border-radius:12px;background:#f7faff;color:#7a92a8;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">취소</button>
          <button id="qeDelete" type="button" style="flex:1;height:44px;border:2px solid #fde8e8;border-radius:12px;background:#fff;color:#e74c3c;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">🗑 삭제</button>
          <button id="qeSave" type="button" style="flex:2;height:44px;border:none;border-radius:12px;background:#0369a1;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">💾 저장</button>
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
      recurring: document.getElementById('qeRecurring').value||'수시구매',
      memo: (document.getElementById('qeMemo').value||'').trim(),
      lastBuyDate: document.getElementById('qeLastBuy').value||'',
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

  // 월간 기간 필터 칩 바인딩 (최초 1회)
  document.querySelectorAll('.mat-month-chip').forEach(btn=>{
    if(btn._mymBound) return; btn._mymBound=true;
    btn.addEventListener('click',()=>{
      MAT_FILTER.txYm = btn.dataset.txym;
      document.querySelectorAll('.mat-month-chip').forEach(b=>{
        const on = b.dataset.txym===MAT_FILTER.txYm;
        b.style.background = on?'#3f7cb8':'#fff';
        b.style.color = on?'#fff':'#4a6a8a';
        b.style.borderColor = on?'#3f7cb8':'#dbe6f4';
      });
      renderTxList();
    });
  });

  // 현재 선택된 기간 라벨 표시
  (function(){
    const d0=kstNow();
    function ymStr(d){ return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0'); }
    function offsetMonth(n){ const d=new Date(d0); d.setUTCMonth(d.getUTCMonth()-n); return ymStr(d); }
    const ymMap = { thisMonth:offsetMonth(0), lastMonth:offsetMonth(1), '2months':offsetMonth(2), '3months':offsetMonth(3), all:'전체' };
    const ym = ymMap[MAT_FILTER.txYm] || 'all';
    const lbl = document.getElementById('matTxYmLabel');
    if(lbl) lbl.textContent = ym==='전체' ? '' : ym+' 기준';
    // 활성 칩 스타일 동기화
    document.querySelectorAll('.mat-month-chip').forEach(b=>{
      const on = b.dataset.txym===MAT_FILTER.txYm;
      b.style.background = on?'#3f7cb8':'#fff';
      b.style.color = on?'#fff':'#4a6a8a';
      b.style.borderColor = on?'#3f7cb8':'#dbe6f4';
    });
  })();

  const items=entries.filter(e=>e.kind==="item");
  const itemById={}; items.forEach(it=>itemById[it.id]=it);
  // 기간 필터 ym 계산
  const _d0=kstNow();
  function _ymStr(d){ return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0'); }
  function _offsetYm(n){ const d=new Date(_d0); d.setUTCMonth(d.getUTCMonth()-n); return _ymStr(d); }
  const _ymMap={ thisMonth:_offsetYm(0), lastMonth:_offsetYm(1), '2months':_offsetYm(2), '3months':_offsetYm(3), all:null };
  const _filterYm = _ymMap[MAT_FILTER.txYm] ?? null;

  const txs=entries.filter(e=>e.kind==="stock")
    .filter(t=>{
      if(_txSubTab!=="전체" && t.stockType!==_txSubTab) return false;
      const it=itemById[t.itemId];
      if(MAT_FILTER.field!=="전체" && (!it || it.field!==MAT_FILTER.field)) return false;
      // 기간 필터
      if(_filterYm && !(t.date||"").startsWith(_filterYm)) return false;
      // 검색 필터
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
  const outAmt=txs.filter(t=>t.stockType==="출고").reduce((s,t)=>s+(Number(t.amount)||0),0);
  const inAmt=txs.filter(t=>t.stockType==="입고").reduce((s,t)=>s+(Number(t.amount)||0),0);
  const ymDisp = _filterYm ? ` (${_filterYm})` : "";
  $("matTxSummary").innerHTML=`총 ${txs.length}건${ymDisp} · 📥 입고 ${inCnt}건 ${inAmt?won(inAmt)+"원":""} · 📤 출고 ${outCnt}건 ${outAmt?won(outAmt)+"원":""}`;
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
    <div class="grid" style="margin-bottom:6px">
      <div class="field"><label>날짜 <span class="req">*</span></label><input type="date" id="cln-date" value="${esc(d.date||todayStr())}"></div>
      <div class="field"><label>반장</label><input type="text" id="cln-foreman" value="${esc(d.foreman||CLEAN_FOREMAN)}"></div>
    </div>

    <div class="field full" style="margin-bottom:6px">
      <label>📷 일지 원본 사진 (AI 분석에 사용)</label>
      <div class="photo-btns">
        <label class="photo-btn">📷 촬영<input type="file" id="cln-cam" accept="image/*" capture="environment" style="display:none"></label>
        <label class="photo-btn">🖼 사진 선택<input type="file" id="cln-file" accept="image/*" style="display:none"></label>
        <button class="btn btn-primary btn-sm" id="cln-aiBtn" type="button" ${cleaningPhoto?"":"disabled"}>🤖 AI 분석</button>
      </div>
      <div id="cln-photoArea"></div>
    </div>

    <h3 style="font-family:'Gowun Batang',serif;font-size:16px;color:#33567d;margin:6px 0">👥 담당자별 작업 내역</h3>
    <div class="table-wrap" style="margin-bottom:6px">
      <table class="rec cln-staff-table"><thead><tr>
        <th>담당자</th><th>담당 층</th><th>점보롤</th><th>핸드타월</th><th>특이사항</th>
      </tr></thead><tbody id="cln-staffBody">${rows}</tbody></table>
    </div>

    <div class="field full" style="margin-bottom:6px">
      <label>👔 소장 지시사항 <span style="color:var(--ink-soft);font-weight:400;font-size:11px">— 항목당 한 셀로 추가됩니다</span></label>
      <div id="cln-directorList" class="cln-item-list"></div>
      <button type="button" class="btn btn-ghost btn-sm" data-addcln="director">➕ 항목 추가</button>
    </div>

    <div class="field full" style="margin-bottom:6px">
      <label>📌 지시 및 전달사항 <span style="color:var(--ink-soft);font-weight:400;font-size:11px">— 항목당 한 셀로 추가됩니다</span></label>
      <div id="cln-directiveList" class="cln-item-list"></div>
      <button type="button" class="btn btn-ghost btn-sm" data-addcln="directive">➕ 항목 추가</button>
    </div>

    <div class="field full" style="margin-bottom:6px">
      <label>⭐ 특기사항 <span style="color:var(--ink-soft);font-weight:400;font-size:11px">— 항목당 한 셀로 추가됩니다</span></label>
      <div id="cln-specialList" class="cln-item-list"></div>
      <button type="button" class="btn btn-ghost btn-sm" data-addcln="special">➕ 항목 추가</button>
    </div>

    <h3 style="font-family:'Gowun Batang',serif;font-size:16px;color:#33567d;margin:6px 0">📦 소모품 입출고 (자재 탭 자동 연동)</h3>
    <div style="margin-bottom:6px">
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
    cleaningPhoto=await compressImage(f);
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
          const dataUrl = await compressImage(blob);
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
      const dataUrl = await compressImage(f);
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
  if(e.kind==="work"){ title = displayTitle(e); subtitle = `${e.floor||""} ${e.loc||""} · ${e.status||""}`.trim(); }
  else if(e.kind==="schedule"){ title = displayTitle(e); subtitle = `${e.sStatus||""} · ${e.sType||""}`; }
  else if(e.kind==="plan"){ title = displayTitle(e); subtitle = e.memo||""; }
  else if(e.kind==="memo"){ title = displayTitle(e); subtitle = (e.content||"").slice(0,60); }
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
    addBtn.addEventListener("click", ()=>{ if(window.wlAddNew) window.wlAddNew("accident"); else openEditor("accident", null); });
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
  /* v46: 처리 중인 사고는 위, 완료·종결은 아래 */
  const ARANK = {"⏳ 접수":0, "🔍 조사중":1, "⚙ 처리중":2, "✅ 완료":9, "📋 종결":9};
  arr.sort((a,b)=>{
    const ra = (ARANK[a.status]!==undefined?ARANK[a.status]:3), rb = (ARANK[b.status]!==undefined?ARANK[b.status]:3);
    if(ra !== rb) return ra - rb;
    return (b.date||"").localeCompare(a.date||"") || (b.time||"").localeCompare(a.time||"");
  });
  // 카운트 표시
  const cnt = document.getElementById("accidentCount");
  if(cnt) cnt.textContent = `${arr.length}건`;
  if(!arr.length){
    list.className = ''; list.style.cssText = '';
    list.innerHTML = `<div style="padding:60px 20px;text-align:center;color:#aab8c8;background:#f7faff;border-radius:12px">
      <div style="font-size:40px;margin-bottom:10px">🚨</div>
      <div style="font-size:14px;font-weight:700">사고 기록이 없어요</div>
      <div style="font-size:12px;margin-top:6px">상단 "➕ 사고 등록" 버튼으로 등록하세요</div>
    </div>`;
    return;
  }
  /* v44-fix: 다열 그리드 적용 */
  list.className = 'wl-cardgrid';
  list.style.cssText = '';
  let _ag = null;
  const isDone = x => (x.status==="✅ 완료" || x.status==="📋 종결");
  const agrpHead = (a)=>{
    const g = isDone(a) ? "완료·종결" : "처리 중인 사고";
    if(g === _ag) return "";
    _ag = g;
    const n = arr.filter(x=>(isDone(x)?"완료·종결":"처리 중인 사고")===g).length;
    const col = isDone(a) ? "#9ab0c4" : "#c2410c";
    return `<div style="grid-column:1/-1;display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;color:${col};padding:10px 3px 3px;border-bottom:1.5px solid #e8f0fa;margin-top:2px">${isDone(a)?"✅":"🚨"} ${g} <span style="font-weight:700;color:#a7b6c6;font-size:11.5px">${n}</span></div>`;
  };
  list.innerHTML = arr.map(a=>{
    const _h = agrpHead(a);
    const c = ACCIDENT_STATUS_COLOR[a.status] || ACCIDENT_STATUS_COLOR["⏳ 접수"];
    const icon = ACCIDENT_TYPE_ICON[a.accType] || "📌";
    const _ls = (a.steps&&a.steps.length) ? wlLastStep(a.steps) : null;
    const totalCost = (Number(a.repairCost)||0)+(Number(a.compensation)||0)+(Number(a.insurance)||0);
    return _h + `<div class="acc-card" data-acc-id="${a.id}" style="background:#fff;border:1.5px solid #e8f0fa;border-left:5px solid ${c.border};border-radius:12px;padding:12px 14px;cursor:pointer;transition:box-shadow .12s;position:relative">
      <button type="button" class="acc-card-del" data-acc-del="${a.id}" title="삭제" style="position:absolute;top:10px;right:10px;width:26px;height:26px;border:none;background:#fde8e8;color:#b52929;border-radius:6px;font-size:13px;cursor:pointer;z-index:2">🗑</button>
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;padding-right:32px">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:5px">
            <span style="font-size:19px">${icon}</span>
            <span style="font-size:11.5px;font-weight:800;background:${c.bg};color:${c.fg};padding:3px 9px;border-radius:7px;border:1px solid ${c.border}">${esc(a.status||'⏳ 접수')}</span>
            <span style="font-size:11.5px;font-weight:800;background:#f0f6ff;color:#3f7cb8;padding:3px 9px;border-radius:7px;border:1px solid #cfe0f2">${esc(a.accType||'기타')}</span>
            ${a.partyType?`<span style="font-size:11px;color:#7a92a8">${esc(a.partyType)}</span>`:''}
          </div>
          <div style="font-size:17.5px;font-weight:800;color:#0f2438;line-height:1.32;letter-spacing:-.3px;margin-bottom:4px;word-break:keep-all">${esc(a.title||'(제목 없음)')}</div>
          <div style="font-size:12px;color:#7a92a8;display:flex;gap:12px;flex-wrap:wrap">
            <span>📅 ${esc(a.date||'')} ${esc(a.time||'')}</span>
            ${a.floor?`<span>🏢 ${esc(a.floor)}${a.location?' · '+esc(a.location):''}</span>`:(a.location?`<span>📍 ${esc(a.location)}</span>`:'')}
            ${a.partyName?`<span>👤 ${esc(a.partyName)}${a.partyPhone?' · '+esc(a.partyPhone):''}</span>`:''}
          </div>
          ${a.detail?`<div style="font-size:12.5px;color:#33567d;margin-top:6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(a.detail)}</div>`:''}
          ${a.steps&&a.steps.length?`<div style="margin-top:8px;padding:8px 10px;background:#fff8e1;border:1px solid #ffd54f;border-radius:8px">
            <div style="font-size:11px;color:#7c5e1a;font-weight:700;margin-bottom:4px">📋 처리 기록 ${a.steps.length}건 · 최근: ${esc(_ls?(_ls.date||''):'')}</div>
            <div style="font-size:12px;color:#1a2f45;font-weight:700">▶ ${esc(_ls?(_ls.action||'(내용 없음)'):'')}</div>
            ${(_ls&&(_ls.vendor||_ls.owner))?`<div style="font-size:11.5px;color:#5b7794;margin-top:2px">${[_ls.vendor&&('🏢 '+_ls.vendor),_ls.owner&&('👤 '+_ls.owner)].filter(Boolean).map(esc).join(' · ')}</div>`:''}
            ${(_ls&&_ls.memo)?`<div style="font-size:11.5px;color:#33567d;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(_ls.memo)}</div>`:''}
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
    card.addEventListener("click", (e)=>{
      if(e.target.closest("[data-acc-del]")) return;
      openViewer("accident", card.dataset.accId);
    });
  });
  list.querySelectorAll("[data-acc-del]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      deleteWithUndo(btn.dataset.accDel, "사고");
    });
  });
}

/* ===== v44: 진행업무 — 시간순 처리단계가 쌓이는 업무 (사고탭과 동일 패턴) ===== */
const PROGRESS_FILTER = { status:"전체", from:"", to:"" };
/* v46: 실제 업무 흐름대로 세분화 — 검토 → 견적 → 품의 → 발주 → 공사 → 완료 */
var PROGRESS_FLOW = ["검토중","견적중","품의중","발주완료","공사중","완료"];
var PROGRESS_STATUS = ["검토중","견적중","품의중","발주완료","공사중","완료","보류"];
var PROGRESS_STATUS_COLOR = {
  "검토중":   {bg:"#ede9fe", fg:"#5b21b6", border:"#8b5cf6"},
  "견적중":   {bg:"#fef3c7", fg:"#92400e", border:"#f59e0b"},
  "품의중":   {bg:"#ffedd5", fg:"#9a3412", border:"#f97316"},
  "발주완료": {bg:"#dbeafe", fg:"#1e40af", border:"#3b82f6"},
  "공사중":   {bg:"#fce7f3", fg:"#9f1239", border:"#ec4899"},
  "완료":     {bg:"#d1fae5", fg:"#065f46", border:"#10b981"},
  "보류":     {bg:"#f1f5f9", fg:"#64748b", border:"#94a3b8"},
  "진행중":   {bg:"#fce7f3", fg:"#9f1239", border:"#ec4899"},   /* 옛 이름 호환 */
};
/* 단계 막대 — 지금 어디까지 왔는지 한눈에 */
function progStepBar(status){
  var i = PROGRESS_FLOW.indexOf(status === "진행중" ? "공사중" : status);
  if(status === "보류") return '<div style="display:flex;gap:3px;margin:6px 0 2px">'
    + PROGRESS_FLOW.map(function(){ return '<span style="flex:1;height:4px;border-radius:3px;background:#e2e8f0"></span>'; }).join('')
    + '</div>';
  if(i < 0) return "";
  var done = PROGRESS_STATUS_COLOR[status] || PROGRESS_STATUS_COLOR["견적중"];
  return '<div style="display:flex;gap:3px;margin:6px 0 2px" title="' + esc(status) + ' (' + (i+1) + '/' + PROGRESS_FLOW.length + '단계)">'
    + PROGRESS_FLOW.map(function(_, k){
        return '<span style="flex:1;height:4px;border-radius:3px;background:' + (k <= i ? done.border : '#e6edf5') + '"></span>';
      }).join('')
    + '</div>';
}

function setupProgressTab(){
  renderProgressStatusChips();
  const addBtn = document.getElementById("btnAddProgress");
  if(addBtn && !addBtn._wired){
    addBtn._wired = true;
    addBtn.addEventListener("click", ()=>{ if(window.wlAddNew) window.wlAddNew("progress"); else openEditor("progress", null); });
  }
  const fromEl = document.getElementById("progressDateFrom");
  const toEl = document.getElementById("progressDateTo");
  const clearEl = document.getElementById("progressDateClear");
  const statusSelEl = document.getElementById("progressStatusFilter");
  if(statusSelEl && !statusSelEl._wired){
    statusSelEl._wired = true;
    statusSelEl.addEventListener("change", ()=>{ PROGRESS_FILTER.status = statusSelEl.value; renderProgressStatusChips(); renderProgressTasks(); });
  }
  if(fromEl && !fromEl._wired){
    fromEl._wired = true;
    fromEl.addEventListener("change", ()=>{ PROGRESS_FILTER.from = fromEl.value; renderProgressTasks(); });
  }
  if(toEl && !toEl._wired){
    toEl._wired = true;
    toEl.addEventListener("change", ()=>{ PROGRESS_FILTER.to = toEl.value; renderProgressTasks(); });
  }
  if(clearEl && !clearEl._wired){
    clearEl._wired = true;
    clearEl.addEventListener("click", ()=>{
      PROGRESS_FILTER.from = ""; PROGRESS_FILTER.to = ""; PROGRESS_FILTER.status = "전체";
      if(fromEl) fromEl.value = ""; if(toEl) toEl.value = "";
      if(statusSelEl) statusSelEl.value = "전체";
      renderProgressStatusChips(); renderProgressTasks();
    });
  }
}

function renderProgressStatusChips(){
  const box = document.getElementById("progressStatusChips");
  if(!box) return;
  const all = entries.filter(e=>e.kind==="progress");
  const counts = {};
  PROGRESS_STATUS.forEach(s=>{ counts[s] = all.filter(a=>a.status===s).length; });
  let html = `<button class="prog-chip" data-prog-status="전체" style="padding:8px 14px;border-radius:20px;border:2px solid ${PROGRESS_FILTER.status==='전체'?'#1a2f45':'#dbe6f4'};background:${PROGRESS_FILTER.status==='전체'?'#1a2f45':'#fff'};color:${PROGRESS_FILTER.status==='전체'?'#fff':'#1a2f45'};font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">📋 전체 ${all.length}</button>`;
  PROGRESS_STATUS.forEach(s=>{
    const c = PROGRESS_STATUS_COLOR[s];
    const isActive = PROGRESS_FILTER.status===s;
    html += `<button class="prog-chip" data-prog-status="${esc(s)}" style="padding:8px 14px;border-radius:20px;border:2px solid ${isActive?c.border:'#dbe6f4'};background:${isActive?c.border:c.bg};color:${isActive?'#fff':c.fg};font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">${esc(s)} ${counts[s]}</button>`;
  });
  box.innerHTML = html;
  box.querySelectorAll(".prog-chip").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      PROGRESS_FILTER.status = btn.dataset.progStatus;
      renderProgressTasks();
    });
  });
}

function renderProgressTasks(){
  setupProgressTab();
  renderProgressStatusChips();
  const list = document.getElementById("progressList");
  if(!list) return;
  let arr = entries.filter(e=>e.kind==="progress");
  if(PROGRESS_FILTER.status !== "전체") arr = arr.filter(a=>a.status===PROGRESS_FILTER.status);
  const _pd = (x)=>{
    if(x.date) return String(x.date).slice(0,10);
    const ls = (x.steps&&x.steps.length) ? wlLastStep(x.steps) : null;
    if(ls && ls.date) return String(ls.date).slice(0,10);
    return x.createdAt ? new Date(x.createdAt).toISOString().slice(0,10) : "";
  };
  if(PROGRESS_FILTER.from) arr = arr.filter(a=>_pd(a) >= PROGRESS_FILTER.from);
  if(PROGRESS_FILTER.to)   arr = arr.filter(a=>_pd(a) <= PROGRESS_FILTER.to);
  /* v46: 살아있는 건 위로, 완료는 아래로 */
  const PRANK = {"검토중":0, "견적중":1, "품의중":2, "발주완료":3, "공사중":4, "진행중":4, "보류":8, "완료":9};
  const prank = a => (PRANK[a.status] !== undefined ? PRANK[a.status] : 5);
  /* v46: 등록일 기준 최신순 (없으면 마지막 진행기록 → 생성일) */
  const pdate = (x)=>{
    if(x.date) return String(x.date).slice(0,10);
    const ls = (x.steps&&x.steps.length) ? wlLastStep(x.steps) : null;
    if(ls && ls.date) return String(ls.date).slice(0,10);
    return x.createdAt ? new Date(x.createdAt).toISOString().slice(0,10) : "";
  };
  arr.sort((a,b)=>{
    const ra = prank(a), rb = prank(b);
    if(ra !== rb) return ra - rb;
    const da = pdate(a), db2 = pdate(b);
    if(da !== db2) return db2.localeCompare(da);
    return (b.createdAt||0)-(a.createdAt||0);
  });
  const cnt = document.getElementById("progressCount");
  if(cnt) cnt.textContent = `${arr.length}건`;
  if(!arr.length){
    list.className = ''; list.style.cssText = '';
    list.innerHTML = `<div style="padding:60px 20px;text-align:center;color:#aab8c8;background:#f7faff;border-radius:12px">
      <div style="font-size:40px;margin-bottom:10px">📋</div>
      <div style="font-size:14px;font-weight:700">진행업무가 없어요</div>
      <div style="font-size:12px;margin-top:6px">상단 "➕ 진행업무 등록" 버튼으로 등록하세요</div>
    </div>`;
    return;
  }
  list.className = 'wl-cardgrid';
  list.style.cssText = '';
  let _pg = null;
  const gname = (x)=> x.status==="완료" ? "완료" : (x.status==="보류" ? "보류" : "진행 중인 업무");
  const gicon = { "진행 중인 업무":"🔵", "보류":"⏸", "완료":"✅" };
  const gcol  = { "진행 중인 업무":"#2563a8", "보류":"#64748b", "완료":"#9ab0c4" };
  const grpHead = (a)=>{
    const g = gname(a);
    if(g === _pg) return "";
    _pg = g;
    const n = arr.filter(x=>gname(x)===g).length;
    return `<div style="grid-column:1/-1;display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:${gcol[g]};padding:12px 3px 4px;border-bottom:2px solid #e8f0fa;margin-top:4px">${gicon[g]} ${g} <span style="font-weight:700;color:#a7b6c6;font-size:12px">${n}</span></div>`;
  };
  list.innerHTML = arr.map(a=>{
    const _h = grpHead(a);
    const c = PROGRESS_STATUS_COLOR[a.status] || PROGRESS_STATUS_COLOR["견적중"];
    const lastStep = (a.steps&&a.steps.length) ? wlLastStep(a.steps) : null;
    const totalCost = Number(a.finalCost)||Number(a.estCost)||0;
    const costLabel = Number(a.finalCost) ? '최종' : (Number(a.estCost) ? '견적' : '');
    return _h + `<div class="prog-card" data-prog-id="${a.id}" style="background:#fff;border:1.5px solid #e8f0fa;border-left:5px solid ${c.border};border-radius:12px;padding:12px 14px;cursor:pointer;transition:box-shadow .12s;position:relative">
      <button type="button" class="prog-card-del" data-prog-del="${a.id}" title="삭제" style="position:absolute;top:10px;right:10px;width:26px;height:26px;border:none;background:#fde8e8;color:#b52929;border-radius:6px;font-size:13px;cursor:pointer;z-index:2">🗑</button>
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;padding-right:32px">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:5px">
            <span style="font-size:11.5px;font-weight:800;background:${c.bg};color:${c.fg};padding:3px 9px;border-radius:7px;border:1px solid ${c.border}">${esc(a.status||'검토중')}</span>
            ${a.floor?`<span style="font-size:11px;color:#7a92a8">${esc(a.floor)}</span>`:''}
          </div>
          <div style="font-size:17.5px;font-weight:800;color:#0f2438;line-height:1.32;letter-spacing:-.3px;margin-bottom:3px;word-break:keep-all">${esc(a.title||'(제목 없음)')}</div>
          <div style="font-size:11.5px;color:#7a92a8;margin-bottom:2px">📅 ${esc(a.date || (a.createdAt?new Date(a.createdAt).toISOString().slice(0,10):''))}</div>
          ${progStepBar(a.status)}
          ${(a.owner||a.ownerPhone)?`<div style="font-size:12px;color:#7a92a8">👤 ${esc(a.owner||'')}${a.ownerPhone?' · '+esc(a.ownerPhone):''}</div>`:''}
          ${a.location?`<div style="font-size:11.5px;color:#9ab0c4">📍 ${esc(a.location)}</div>`:''}
          ${a.detail?`<div style="font-size:12.5px;color:#33567d;margin-top:6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(a.detail)}</div>`:''}
          ${a.steps&&a.steps.length?`<div style="margin-top:8px;padding:8px 10px;background:#eef6ff;border:1px solid #90c2f0;border-radius:8px">
            <div style="font-size:11px;color:#1a4a8a;font-weight:700;margin-bottom:4px">📋 진행 기록 ${a.steps.length}건 · 최근: ${esc(lastStep.date||'')}</div>
            <div style="font-size:12px;color:#1a2f45;font-weight:700">▶ ${esc(lastStep.action||'(내용 없음)')}</div>
            ${(lastStep.vendor||lastStep.owner)?`<div style="font-size:11.5px;color:#5b7794;margin-top:2px">${[lastStep.vendor&&('🏢 '+lastStep.vendor),lastStep.owner&&('👤 '+lastStep.owner)].filter(Boolean).map(esc).join(' · ')}</div>`:''}
            ${(lastStep.detail||lastStep.memo)?`<div style="font-size:11.5px;color:#33567d;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(lastStep.detail||lastStep.memo)}</div>`:''}
          </div>`:''}
          ${a.photos&&a.photos.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            ${a.photos.slice(0,4).map(p=>`<img src="${esc(p)}" style="width:54px;height:54px;object-fit:cover;border-radius:6px;border:1px solid #e8f0fa">`).join('')}
            ${a.photos.length>4?`<div style="width:54px;height:54px;background:#f0f6ff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#3f7cb8">+${a.photos.length-4}</div>`:''}
          </div>`:''}
        </div>
        ${totalCost>0?`<div style="text-align:right;white-space:nowrap"><div style="font-size:10.5px;color:#9ab0c4;font-weight:700">${costLabel}</div><div style="font-size:14px;font-weight:800;color:${Number(a.finalCost)?'#1a7a4a':'#3f7cb8'}">💰 ${won(totalCost)}</div></div>`:''}
      </div>
    </div>`;
  }).join("");
  /* 카드 클릭 → 조회창(읽기전용). 하단 수정 버튼을 눌러야만 수정 가능 */
  list.querySelectorAll(".prog-card").forEach(card=>{
    card.addEventListener("mouseenter", ()=>card.style.boxShadow="0 4px 16px rgba(0,0,0,.08)");
    card.addEventListener("mouseleave", ()=>card.style.boxShadow="");
    card.addEventListener("click", (e)=>{
      if(e.target.closest("[data-prog-del]")) return;
      openViewer("progress", card.dataset.progId);
    });
  });
  /* 카드 자체의 삭제 버튼 */
  list.querySelectorAll("[data-prog-del]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const id = btn.dataset.progDel;
      deleteWithUndo(id, "진행업무");
    });
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

/* v149 — 달님 : 「지출 월별 합계 표를 데이터 탭으로 옮기자」
      그리는 곳을 밖에서 정할 수 있게만 열어 둔다. 인자 없이 부르면 예전 그대로. */
function renderExpenseStats(target){
  const box = target || $("expStats"); if(!box) return;
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
        <span class="es-i-title">${esc(displayTitle(e))}</span>
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
  try{ expensePhoto = await compressImage(f); renderExpensePhoto(); }
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
        <div id="workVendorList" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto;margin-bottom:6px"></div>
        <div style="display:flex;gap:8px;margin-bottom:6px">
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
        <div id="expFieldMgrList" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto;margin-bottom:6px"></div>
        <div style="display:flex;gap:8px;margin-bottom:6px">
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
    let material;
    if(Array.isArray(e.materials) && e.materials.length){
      material = matsText(e.materials).replace(/[\t\n]/g,' ');
    } else {
      const matParts = [];
      if(e.material) matParts.push(String(e.material).trim());
      if(e.matSpec) matParts.push(String(e.matSpec).trim());
      if(Number(e.qty)>0) matParts.push(e.qty+'개');
      material = matParts.join('_').replace(/[\t\n]/g,' ');
    }
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

/* v145 — 달님 : 「업체 연락처 안 나와. 확실히 고쳐」
      원인 : 인터넷이 끊겨 있으면(online=false) 이 함수가 그냥 나가서
             연락처가 영영 빈 채였다. 게다가 조용히 나가서 이유도 몰랐다.
      고침 : 성공하면 이 기기에 적어 두고, 못 불러오면 그걸로 되살린다.
             ⚠ 명함 사진 같은 큰 값은 빼고 적는다 (2026-08-28 저장소 사고) */
const LS_CONTACTS = 'wl_contacts_cache';
function _ctSlim(list){
  return (list||[]).map(function(c){
    var o = {};
    for(var k in c){
      if(!Object.prototype.hasOwnProperty.call(c,k)) continue;
      if(/photo|card|image|img|base64|thumb/i.test(k)) continue;   /* 사진은 안 적는다 */
      var v = c[k];
      if(typeof v === 'string' && v.length > 1500) continue;        /* 지나치게 긴 값도 뺀다 */
      o[k] = v;
    }
    return o;
  });
}
function _ctSave(){
  try{ localStorage.setItem(LS_CONTACTS, JSON.stringify(_ctSlim(contactsCache))); }
  catch(e){ console.warn('[연락처] 이 기기에 적어 두지 못했어요', e); }
}
function _ctLoadLocal(){
  try{
    var s = JSON.parse(localStorage.getItem(LS_CONTACTS) || 'null');
    if(Array.isArray(s) && s.length){ contactsCache = s; return s.length; }
  }catch(e){ console.warn('[연락처] 적어 둔 것을 못 읽었어요', e); }
  return 0;
}
try{ window.wlContactsLocal = _ctLoadLocal; }catch(e){}

/* v146 — 연결이 늦게 살아나는 경우를 지켜본다.
      5초 · 10초 · 20초 · 40초 · 60초 · 60초 (총 약 3분) 뒤에 한 번씩만 확인한다.
      쉬지 않고 두드리면 배터리·요금만 먹는다. */
var _WL_RC = [5000, 10000, 20000, 40000, 60000, 60000];
function _wlReconnect(n){
  if(online || !db || n >= _WL_RC.length) return;
  setTimeout(function(){
    if(online) return;
    db.collection(COL).limit(1).get().then(function(){
      if(online) return;
      online = true;
      try{ setStatus(true); }catch(e){}
      console.warn('[연결] 늦게 이어졌습니다 — 연락처를 다시 불러옵니다');
      try{ loadContactsCache(); }catch(e){ console.warn('[연결] 연락처 다시 불러오기 실패', e); }
      try{ if(typeof loadContactCats === 'function') loadContactCats().catch(function(){}); }catch(e){}
      try{ if(typeof renderDiag === 'function') renderDiag(); }catch(e){}
      if(typeof toast === 'function') toast('🌐 연결됐어요 — 연락처를 불러왔습니다');
    }).catch(function(){ _wlReconnect(n + 1); });
  }, _WL_RC[n]);
}
try{ window.wlReconnect = function(){ online = false; _wlReconnect(0); return '연결을 다시 확인합니다'; }; }catch(e){}

async function loadContactsCache(){
  if(!online || !db){
    /* 인터넷이 끊겼어도 예전에 적어 둔 연락처는 쓸 수 있게 한다 */
    var n0 = contactsCache.length ? contactsCache.length : _ctLoadLocal();
    console.warn('[연락처] 인터넷 연결이 없어 이 기기에 적어 둔 ' + n0 + '건을 씁니다');
    return;
  }
  try{
    const snap = await db.collection("contacts").get();
    contactsCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    _ctSave();
    // contacts에서 직원(재직중) 카테고리를 STAFF_LIST로 동기화
    const staffFromDB = contactsCache.filter(c=>c.cat==="직원(재직중)"&&c.name);
    if(staffFromDB.length){
      STAFF_LIST = staffFromDB.map(c=>({
        name: c.name||"",
        phone: c.phone||"",
        role: c.memo ? c.memo.split(" · ")[0] : ""
      }));
    }
  }catch(e){
    console.warn("contacts 캐시 로드 실패:", e);
    if(!contactsCache.length){
      var n1 = _ctLoadLocal();
      if(n1) console.warn('[연락처] 대신 이 기기에 적어 둔 ' + n1 + '건을 씁니다');
    }
  }
}

function searchContacts(q){
  q = (q||"").trim();
  if(!q) return [];
  const ql = q.toLowerCase();
  const results = [];
  // 업체 연락처
  const _cho = (typeof isChosungOnly==='function') && isChosungOnly(q);
  const _hitCho = (t)=>{ try{ return _cho && typeof getChosung==='function' && getChosung(t||"").includes(q); }catch(e){ return false; } };
  contactsCache.forEach(c=>{
    const nm = (c.name||"").toLowerCase();
    const ps = (c.person||"").toLowerCase();
    if(nm.includes(ql)||ps.includes(ql)||_hitCho(c.name)||_hitCho(c.person)){
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
    if((s.name.includes(q)||_hitCho(s.name)) && !results.find(r=>r.name===s.name)){
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

/* ===== GitHub 자동 업로드 ===== */
async function githubUpload(token){
  const OWNER = '20251014peru-gif';
  const REPO  = '20251014peru-gif.github.io';
  const BRANCH = 'main';
  const files = [
    {path:'worklog.html', url:location.origin+'/worklog.html'},
    {path:'worklog.js',   url:location.origin+'/worklog.js'},
  ];
  for(const f of files){
    // 파일 내용 가져오기
    const res = await fetch(f.url+'?v='+Date.now());
    const blob = await res.blob();
    const b64 = await new Promise(resolve=>{
      const r=new FileReader();
      r.onload=()=>resolve(r.result.split(',')[1]);
      r.readAsDataURL(blob);
    });
    // 현재 SHA
    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${f.path}`;
    const headers = {'Authorization':'token '+token,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'};
    let sha = '';
    try{
      const r2 = await fetch(apiUrl,{headers});
      const d = await r2.json();
      sha = d.sha||'';
    }catch(e){}
    // 업로드
    const body = JSON.stringify({message:`Update ${f.path} ${APP_VERSION}`,content:b64,branch:BRANCH,sha});
    const r3 = await fetch(apiUrl,{method:'PUT',headers,body});
    if(!r3.ok){
      const err = await r3.json();
      throw new Error(f.path+': '+(err.message||r3.status));
    }
    console.log('[GitHub] '+f.path+' 업로드 완료');
  }
}


/* ============================================================
   v44: 임차인 카드 — 임대개별 탭 상단 (kind:"tenant")
   계약정보 + 특약 전체 + 중요메모(태그) + 연결서류
   저장: entries 시스템 → Firebase 자동 동기화 + 삭제복구 지원
   ============================================================ */
(function(){
  var TN_FLOORS = ['B1','1F','2F','3F','4F','5F','6F','7F','8F','9F','10F','11F','12F','13F','14F','15F','16F','17F','18F','19F','20F'];
  var TN_TAGS = ['계약','하자','민원','기타'];
  var TN_TAG_COLOR = {'계약':'#3f7cb8','하자':'#e67e22','민원':'#e74c3c','기타':'#7a92a8'};
  var tnSearch = '';
  var tnFloor = 'all';

  function tnList(){
    try{ return entries.filter(function(e){ return e.kind==='tenant'; }); }catch(e){ return []; }
  }
  function tnFloorOrder(f){
    if(f==='B1') return -1;
    var n = parseInt(f); return isNaN(n) ? 999 : n;
  }
  function tnMoney(v){
    var n = Number(v)||0;
    return n===0 ? '' : n.toLocaleString('ko-KR');
  }
  function tnParseMoney(s){
    return Number(String(s||'').replace(/[^0-9]/g,''))||0;
  }
  /* 날짜 문자열에 년수 더하기 (YYYY-MM-DD) */
  function tnAddYears(dateStr, yrs){
    try{
      var p = String(dateStr).split('-');
      var y = Number(p[0])+yrs, m = p[1], d = p[2];
      return y+'-'+m+'-'+d;
    }catch(e){ return dateStr; }
  }
  /* 자동갱신 반영한 실효 종료일 계산 — 종료일이 지났으면 1년씩 굴려서 미래 날짜로 */
  function tnEffectiveEnd(t){
    if(!t.endDate) return null;
    if(t.autoRenew===false) return {end:t.endDate, renewed:0};
    var end = t.endDate, renewed = 0, guard = 0;
    while(guard<60){
      var diff = Math.round((new Date(end+'T00:00:00Z') - new Date(todayStr()+'T00:00:00Z'))/86400000);
      if(diff >= 0) break;
      end = tnAddYears(end, 1); renewed++; guard++;
    }
    return {end:end, renewed:renewed};
  }
  function tnDday(t){
    if(!t.endDate) return null;
    try{
      var eff = tnEffectiveEnd(t);
      var useEnd = eff ? eff.end : t.endDate;
      var renewed = eff ? eff.renewed : 0;
      var diff = Math.round((new Date(useEnd+'T00:00:00Z') - new Date(todayStr()+'T00:00:00Z'))/86400000);
      /* 자동갱신된 경우: 갱신 표시 + 다음 만료까지 D-day */
      if(renewed>0){
        var base;
        if(diff <= 30) base={bg:'#fde8e8', color:'#e74c3c'};
        else if(diff <= 90) base={bg:'#fef5e7', color:'#e67e22'};
        else base={bg:'#eaf6ef', color:'#27ae60'};
        return {label:'🔄 자동갱신 D-'+diff, bg:base.bg, color:base.color, renewed:renewed, effEnd:useEnd};
      }
      if(diff === 0) return {label:'오늘 만료', bg:'#fde8e8', color:'#b52929'};
      if(diff <= 30) return {label:'D-'+diff, bg:'#fde8e8', color:'#e74c3c'};
      if(diff <= 90) return {label:'D-'+diff, bg:'#fef5e7', color:'#e67e22'};
      return {label:'D-'+diff, bg:'#eaf6ef', color:'#27ae60'};
    }catch(e){ return null; }
  }
  function tnMatches(t, q){
    q = (q||'').trim().toLowerCase();
    if(!q) return true;
    var parts = [t.floor, t.unit, t.name, t.ceo, t.phone, t.biznum, t.business, t.note];
    if(Array.isArray(t.specials)) parts = parts.concat(t.specials);
    if(Array.isArray(t.memos)) t.memos.forEach(function(m){ parts.push(m.text, m.tag); });
    return parts.filter(Boolean).join(' ').toLowerCase().indexOf(q) >= 0;
  }

  /* ---- 섹션 렌더 (툴바 1회 생성 → 검색창 DOM 보존, 그리드만 재렌더) ---- */
  function renderTenantCards(){
    var host = document.getElementById('tenantSection');
    if(!host) return;
    if(!document.getElementById('tnToolbar')){
      host.innerHTML =
        '<div id="tnToolbar">'
        + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
          + '<span style="font-size:16px;font-weight:800;color:#33567d">🏠 임차인 카드</span>'
          + '<span id="tnCount" style="font-size:12px;color:#aab8c8"></span>'
          + '<input type="text" id="tnSearchInp" placeholder="상호·대표자·호수·특약·메모 검색" style="flex:1;min-width:170px;max-width:320px;height:34px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-family:inherit;background:#fff;outline:none">'
          + '<button id="tnAddBtn" style="height:34px;padding:0 14px;border:none;border-radius:10px;background:#3f7cb8;color:#fff;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">➕ 임차인 추가</button>'
          + '<button id="tnBulkBtn" style="height:34px;padding:0 12px;border:1.5px solid #cbb6ea;border-radius:10px;background:#f6f2fd;color:#7c3aed;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">📊 임대현황 일괄등록</button>'
          + '<button id="tnEnbiBtn" style="height:34px;padding:0 12px;border:1.5px solid #9ec7ea;border-radius:10px;background:#f0f7fd;color:#3f7cb8;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">➕ 엔비홀딩스</button>'
          + '<button id="tnExpiryCalBtn" style="height:34px;padding:0 12px;border:1.5px solid #f5c6a0;border-radius:10px;background:#fef6ee;color:#c2540c;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">📅 만료일 달력추가</button>'
        + '</div>'
        + '<div id="tnChips" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px"></div>'
        + '</div>'
        + '<div id="tnGrid"></div>'
        + '<div id="tnSummary" style="margin-top:18px"></div>'
        + '<div style="padding:12px 4px 6px;font-size:14px;font-weight:800;color:#3f7cb8;border-bottom:2px solid #e8f0fa;margin:16px 0 4px">📂 서류</div>';
      var inp = document.getElementById('tnSearchInp');
      if(inp && !inp._bound){
        inp._bound = true;
        inp.addEventListener('input', function(){ tnSearch = inp.value; renderTnGrid(); });
        inp.addEventListener('keydown', function(ev){
          if(ev.key==='Enter'){
            var first = document.querySelector('#tnGrid .tn-card');
            if(first) openTenantModal(first.getAttribute('data-id'));
          }
        });
      }
      var ab = document.getElementById('tnAddBtn');
      if(ab && !ab._bound){ ab._bound = true; ab.addEventListener('click', function(){ openTenantModal(null); }); }
      var bb = document.getElementById('tnBulkBtn');
      if(bb && !bb._bound){ bb._bound = true; bb.addEventListener('click', function(){ tnBulkImport(); }); }
      var eb = document.getElementById('tnEnbiBtn');
      if(eb && !eb._bound){ eb._bound = true; eb.addEventListener('click', function(){ tnAddEnbi(); }); }
      var xb = document.getElementById('tnExpiryCalBtn');
      if(xb && !xb._bound){ xb._bound = true; xb.addEventListener('click', function(){ tnAddExpiryToCalendar(); }); }
    }
    renderTnGrid();
  }

  function tnChipStyle(active){
    return 'padding:5px 12px;border-radius:14px;border:1.5px solid '+(active?'#3f7cb8':'#dbe6f4')+';background:'+(active?'#3f7cb8':'#fff')+';color:'+(active?'#fff':'#7a92a8')+';font-size:12px;font-weight:700;cursor:pointer;font-family:inherit';
  }

  function renderTnGrid(){
    var grid = document.getElementById('tnGrid');
    var chips = document.getElementById('tnChips');
    var cnt = document.getElementById('tnCount');
    if(!grid) return;
    var all = tnList();
    /* 층 칩: 등록된 층만 표시 */
    var floors = {};
    all.forEach(function(t){ if(t.floor) floors[t.floor]=1; });
    var floorKeys = Object.keys(floors).sort(function(a,b){ return tnFloorOrder(a)-tnFloorOrder(b); });
    if(tnFloor!=='all' && floorKeys.indexOf(tnFloor)<0) tnFloor='all';
    if(chips){
      var ch = '<button class="tn-chip" data-f="all" style="'+tnChipStyle(tnFloor==='all')+'">전체</button>';
      floorKeys.forEach(function(f){
        ch += '<button class="tn-chip" data-f="'+esc(f)+'" style="'+tnChipStyle(tnFloor===f)+'">'+esc(f)+'</button>';
      });
      chips.innerHTML = ch;
      chips.querySelectorAll('.tn-chip').forEach(function(b){
        b.addEventListener('click', function(){ tnFloor = b.getAttribute('data-f'); renderTnGrid(); });
      });
    }
    var list = all.filter(function(t){
      if(tnFloor!=='all' && t.floor!==tnFloor) return false;
      return tnMatches(t, tnSearch);
    }).sort(function(a,b){
      return tnFloorOrder(a.floor)-tnFloorOrder(b.floor) || String(a.unit||'').localeCompare(String(b.unit||''),'ko',{numeric:true});
    });
    if(cnt) cnt.textContent = list.length + '명' + (all.length!==list.length ? ' / 전체 '+all.length+'명' : '');
    if(!list.length){
      grid.style.cssText = '';
      grid.innerHTML = '<div style="text-align:center;padding:36px 20px;color:#aab8c8;background:#f7faff;border-radius:12px;font-size:13px">'
        + (all.length ? '조건에 맞는 임차인이 없어요' : '🏠 <b>➕ 임차인 추가</b> 버튼으로 첫 임차인 카드를 만들어보세요')
        + '</div>';
      return;
    }
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:8px';
    grid.innerHTML = list.map(tnCardHtml).join('');
    grid.querySelectorAll('.tn-card').forEach(function(card){
      var head = card.querySelector('.tn-card-head');
      if(head){
        head.addEventListener('click', function(e){
          if(e.target.closest('a')) return;
          openTenantModal(card.getAttribute('data-id'));
        });
      }
      card.addEventListener('mouseenter', function(){ card.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'; });
      card.addEventListener('mouseleave', function(){ card.style.boxShadow=''; });
      if(head){
        head.addEventListener('mouseenter', function(){ head.style.opacity='0.72'; });
        head.addEventListener('mouseleave', function(){ head.style.opacity='1'; });
      }
    });
    renderTnSummary(all);
  }

  /* 층별 한 줄 요약 표 (엑셀 스타일) — 전체 임차인 대상, 필터 무관 */
  function renderTnSummary(all){
    var host = document.getElementById('tnSummary');
    if(!host) return;
    if(!all || !all.length){ host.innerHTML=''; return; }
    var sorted = all.slice().sort(function(a,b){
      return tnFloorOrder(a.floor)-tnFloorOrder(b.floor) || String(a.unit||'').localeCompare(String(b.unit||''),'ko',{numeric:true});
    });
    var sumDep=0, sumRent=0, sumMgmt=0;
    /* 금액+평단가 셀 */
    function moneyCell(val, py, color){
      var pyTxt = tnMoney(py) ? '<div style="font-size:10px;color:#0f766e;font-weight:600">('+tnMoney(py)+')</div>' : '';
      return '<td style="padding:5px 8px 5px 20px;text-align:right;font-weight:700;color:'+color+';white-space:nowrap;line-height:1.35">'+(tnMoney(val)||'-')+pyTxt+'</td>';
    }
    function dateCell(v, extra){
      return '<td style="padding:5px 8px 5px 16px;text-align:center;color:#7a92a8;white-space:nowrap;font-size:12px">'+(v?esc(String(v)):'-')+(extra||'')+'</td>';
    }
    var rows = sorted.map(function(t){
      sumDep+=Number(t.deposit)||0; sumRent+=Number(t.rent)||0; sumMgmt+=Number(t.mgmtFee)||0;
      var dd = tnDday(t);
      var renewTxt = (dd&&dd.renewed) ? esc(dd.effEnd) : '';
      return '<tr style="border-bottom:1px solid #eef2f7">'
        + '<td style="padding:5px 8px;font-weight:800;color:#3f7cb8;white-space:nowrap">'+esc(String(t.floor||''))+'</td>'
        + '<td style="padding:5px 8px;color:#7a92a8;white-space:nowrap">'+esc(String(t.unit||''))+'</td>'
        + '<td style="padding:5px 14px 5px 8px;font-weight:600;color:#1a2f45;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(String(t.name||''))+'</td>'
        + '<td style="padding:5px 8px 5px 20px;text-align:right;color:#0f766e;white-space:nowrap">'+esc(String(t.area||''))+'</td>'
        + moneyCell(t.deposit, t.depPy, '#1a2f45')
        + moneyCell(t.rent, t.rentPy, '#2563a8')
        + moneyCell(t.mgmtFee, t.mgmtPy, '#1a2f45')
        + dateCell(t.moveInDate)
        + dateCell(t.startDate)
        + dateCell(t.endDate)
        + '<td style="padding:5px 8px 5px 16px;text-align:center;white-space:nowrap;font-size:12px;color:'+(renewTxt?'#27ae60':'#c5cfda')+';font-weight:'+(renewTxt?'700':'400')+'">'+(renewTxt||'-')+'</td>'
      + '</tr>';
    }).join('');
    var thDate = 'padding:8px 8px 8px 16px;text-align:center;color:#33567d;white-space:nowrap;font-size:12px';
    host.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        + '<span style="font-size:14px;font-weight:800;color:#33567d">📋 층별 요약</span>'
        + '<span style="font-size:12px;color:#aab8c8">'+sorted.length+'개 · 전체 임차인 · 금액 아래 ()는 평단가</span>'
      + '</div>'
      + '<div style="overflow-x:auto;border:1.5px solid #e8f0fa;border-radius:12px">'
        + '<table style="width:auto;border-collapse:collapse;font-size:13px">'
          + '<thead><tr style="background:#f4f8fd;border-bottom:2px solid #dbe6f4">'
            + '<th style="padding:8px;text-align:left;color:#33567d;white-space:nowrap">층</th>'
            + '<th style="padding:8px;text-align:left;color:#33567d;white-space:nowrap">호수</th>'
            + '<th style="padding:8px;text-align:left;color:#33567d;white-space:nowrap">상호</th>'
            + '<th style="padding:8px 8px 8px 20px;text-align:right;color:#33567d;white-space:nowrap">면적</th>'
            + '<th style="padding:8px 8px 8px 20px;text-align:right;color:#33567d;white-space:nowrap">보증금</th>'
            + '<th style="padding:8px 8px 8px 20px;text-align:right;color:#33567d;white-space:nowrap">월세</th>'
            + '<th style="padding:8px 8px 8px 20px;text-align:right;color:#33567d;white-space:nowrap">관리비</th>'
            + '<th style="'+thDate+'">최초입주</th>'
            + '<th style="'+thDate+'">계약시작</th>'
            + '<th style="'+thDate+'">만료</th>'
            + '<th style="'+thDate+'">갱신</th>'
          + '</tr></thead>'
          + '<tbody>'+rows+'</tbody>'
          + '<tfoot><tr style="background:#eef5fd;border-top:2px solid #dbe6f4;font-weight:800">'
            + '<td colspan="4" style="padding:8px;color:#33567d">합계</td>'
            + '<td style="padding:8px 8px 8px 20px;text-align:right;color:#1a2f45;white-space:nowrap">'+sumDep.toLocaleString('ko-KR')+'</td>'
            + '<td style="padding:8px 8px 8px 20px;text-align:right;color:#2563a8;white-space:nowrap">'+sumRent.toLocaleString('ko-KR')+'</td>'
            + '<td style="padding:8px 8px 8px 20px;text-align:right;color:#1a2f45;white-space:nowrap">'+sumMgmt.toLocaleString('ko-KR')+'</td>'
            + '<td colspan="4"></td>'
          + '</tr></tfoot>'
        + '</table>'
      + '</div>';
  }

  function tnCardHtml(t){
    var dd = tnDday(t);
    var spN = (t.specials||[]).filter(function(s){ return s&&String(s).trim(); }).length;
    var mmN = (t.memos||[]).length;
    var ctN = (t.contractFiles||[]).length;
    var tel = String(t.phone||'').replace(/[^0-9+]/g,'');
    /* 담당 연락처: 대표 전화 + contacts 배열 첫 항목 */
    var contactLines = [];
    if(t.ceo || tel) contactLines.push((t.ceo?'👤 '+esc(String(t.ceo)):'')+(t.ceo&&tel?' ':'')+(tel?'<a href="tel:'+tel+'" style="color:#3f7cb8;text-decoration:none;font-weight:700">📞 '+esc(String(t.phone))+'</a>':''));
    if(Array.isArray(t.contacts)){
      t.contacts.filter(function(cc){return cc&&(cc.name||cc.phone);}).forEach(function(cc){
        var ct=String(cc.phone||'').replace(/[^0-9+]/g,'');
        contactLines.push((cc.name?'🧑 '+esc(String(cc.name)):'')+(cc.name&&ct?' ':'')+(ct?'<a href="tel:'+ct+'" style="color:#3f7cb8;text-decoration:none;font-weight:700">📞 '+esc(String(cc.phone))+'</a>':esc(String(cc.phone||''))));
      });
    }
    /* 금액 한 줄씩 (라벨 왼쪽, 금액 + 평단가 오른쪽) */
    var moneyRows = '';
    function moneyLine(lbl, val, py, color){
      if(!tnMoney(val)) return '';
      var pyTxt = tnMoney(py) ? ' <span style="font-size:10px;color:#0f766e;font-weight:700">(평단가 '+tnMoney(py)+')</span>' : '';
      return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;padding:4px 10px;background:#f4f8fd;border-radius:7px;margin-bottom:4px;box-sizing:border-box">'
        + '<span style="font-size:11px;color:#7a92a8;font-weight:700;flex-shrink:0">'+lbl+'</span>'
        + '<span style="font-size:14px;font-weight:800;color:'+color+';text-align:right;min-width:0">'+tnMoney(val)+pyTxt+'</span>'
      + '</div>';
    }
    if(tnMoney(t.deposit)||tnMoney(t.rent)||tnMoney(t.mgmtFee)){
      moneyRows = '<div style="margin:2px 0 4px">'
        + moneyLine('보증금', t.deposit, t.depPy, '#1a2f45')
        + moneyLine('월세', t.rent, t.rentPy, '#2563a8')
        + moneyLine('관리비', t.mgmtFee, t.mgmtPy, '#1a2f45')
      + '</div>';
    }
    return '<div class="tn-card" data-id="'+esc(String(t.id))+'" style="background:#fff;border:1.5px solid #e8f0fa;border-radius:12px;padding:12px 14px;transition:box-shadow .15s,transform .15s">'
      /* ▼ 여기(tn-card-head)를 클릭하면 조회모달 열림 — 나머지는 무반응 */
      + '<div class="tn-card-head" style="cursor:pointer">'
      + '<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">'
        + '<span style="background:#eef5fd;color:#3f7cb8;font-size:11px;font-weight:800;padding:3px 8px;border-radius:8px;white-space:nowrap">'+esc(String(t.floor||''))+' · '+esc(String(t.unit||''))+'</span>'
        + '<span style="font-size:15px;font-weight:800;color:#1a2f45;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(String(t.name||'(상호 미입력)'))+'</span>'
      + '</div>'
      /* D-day 크게 + 면적 크게 한 줄 */
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">'
        + (dd ? '<span style="font-size:15px;font-weight:900;padding:4px 12px;border-radius:9px;background:'+dd.bg+';color:'+dd.color+';white-space:nowrap">'+dd.label+'</span>' : '')
        + (t.area ? '<span style="font-size:14px;font-weight:800;color:#0f766e;background:#e6f5f2;padding:4px 11px;border-radius:9px;white-space:nowrap">📐 '+esc(String(t.area))+'</span>' : '')
      + '</div>'
      /* 계약기간 — 크게, 줄 꽉차게 (클릭 영역 포함) */
      + ((t.startDate||t.endDate) ? '<div style="display:block;width:100%;font-size:14px;font-weight:800;color:#334;background:#eef2f8;border:1.5px solid #dde5f0;border-radius:8px;padding:8px 12px;margin-bottom:'+(t.moveInDate?'4px':'7px')+';box-sizing:border-box;text-align:center;letter-spacing:.3px">📅 '+esc(String(t.startDate||'?'))+' ~ '+esc(String(t.endDate||'?'))+(dd&&dd.renewed?' <span style="color:#27ae60">→ 갱신 '+esc(dd.effEnd)+'</span>':'')+'</div>' : '')
      + (t.moveInDate ? '<div style="font-size:12px;font-weight:700;color:#8a6d3b;background:#fef8ed;border-radius:7px;padding:4px 10px;margin-bottom:7px;box-sizing:border-box;text-align:center">🔑 최초 입주 '+esc(String(t.moveInDate))+'</div>' : '')
      + '</div>'  /* ▲ tn-card-head 끝 */
      + (t.business ? '<div style="font-size:12px;color:#7a5cad;background:#f6f2fd;border-radius:7px;padding:3px 9px;margin-bottom:5px;display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-sizing:border-box">🏷 '+esc(String(t.business))+'</div>' : '')
      + (contactLines.length ? '<div style="font-size:12px;color:#7a92a8;margin-bottom:4px;line-height:1.7">'+contactLines.join('<br>')+'</div>' : '')
      + moneyRows
      + ((spN||mmN) ? '<div style="display:flex;gap:5px;margin-top:6px">'
          + (spN ? '<span style="font-size:11px;font-weight:700;background:#f3eefc;color:#8e44ad;padding:2px 8px;border-radius:8px">📋 특약 '+spN+'</span>' : '')
          + (mmN ? '<span style="font-size:11px;font-weight:700;background:#fff8e6;color:#b8860b;padding:2px 8px;border-radius:8px">📝 메모 '+mmN+'</span>' : '')
          + (ctN ? '<span style="font-size:11px;font-weight:700;background:#e6f5f2;color:#0f766e;padding:2px 8px;border-radius:8px">📎 계약서 '+ctN+'</span>' : '')
        + '</div>' : '')
      + (spN ? '<div style="margin-top:6px;padding:8px 10px;background:#faf7fd;border:1px solid #e8ddf5;border-radius:8px">'
          + (t.specials||[]).filter(function(s){return s&&String(s).trim();}).map(function(s){ return '<div style="font-size:12px;color:#6b21a8;line-height:1.6">📋 '+esc(String(s).trim())+'</div>'; }).join('')
        + '</div>' : '')
      + (mmN ? '<div style="margin-top:6px;padding:8px 10px;background:#fffdf0;border:1px solid #fde68a;border-radius:8px">'
          + (t.memos||[]).slice(0,3).map(function(m){ return '<div style="font-size:12px;color:#92400e;line-height:1.6">📝 '+(m.tag?'<span style="background:#fef3c7;padding:0 5px;border-radius:4px;font-weight:700;font-size:10px">'+esc(m.tag)+'</span> ':'')+ esc(String(m.text||'').substring(0,60))+(String(m.text||'').length>60?'…':'')+'</div>'; }).join('')
          + (mmN>3 ? '<div style="font-size:11px;color:#b8860b;margin-top:2px">… 외 '+(mmN-3)+'건</div>' : '')
        + '</div>' : '')
      + '</div>';
  }

  /* ---- 상세 팝업 (조회 모드 먼저 → 수정 버튼으로 편집) ---- */
  var tnDrag = {x:0, y:0};
  function openTenantModal(id, mode){
    var t = id ? tnList().find(function(x){ return x.id===id; }) : null;
    if(id && !t){ toast('임차인을 찾을 수 없어요'); return; }
    var old = document.getElementById('tnOverlay');
    if(old) old.remove();
    tnDrag = {x:0, y:0};
    var ov = document.createElement('div');
    ov.id = 'tnOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
    var sheet = document.createElement('div');
    sheet.id = 'tnSheet';
    sheet.style.cssText = 'background:#fff;border-radius:18px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.2)';
    ov.appendChild(sheet);
    document.body.appendChild(ov);
    if(!t || mode==='edit') renderTnEdit(sheet, t);
    else renderTnView(sheet, t.id);
    wireTnDrag(ov, sheet);
  }
  /* 팝업 헤더 드래그 이동 (transform translate) */
  function wireTnDrag(ov, sheet){
    var dragging=false, sx=0, sy=0;
    ov.addEventListener('mousedown', function(e){
      var h = e.target.closest('.tn-drag-handle');
      if(!h || e.target.closest('button,a,input,select,textarea')) return;
      dragging=true; sx=e.clientX-tnDrag.x; sy=e.clientY-tnDrag.y; e.preventDefault();
    });
    ov.addEventListener('mousemove', function(e){
      if(!dragging) return;
      tnDrag.x = e.clientX-sx; tnDrag.y = e.clientY-sy;
      sheet.style.transform = 'translate('+tnDrag.x+'px,'+tnDrag.y+'px)';
    });
    ov.addEventListener('mouseup', function(){ dragging=false; });
  }

  function tnInfoRow(label, valueHtml){
    if(!valueHtml) return '';
    return '<div style="display:flex;gap:8px;font-size:13px;padding:4px 0"><span style="width:78px;flex-shrink:0;color:#7a92a8;font-weight:700">'+label+'</span><span style="color:#1a2f45;font-weight:600;min-width:0;word-break:break-word">'+valueHtml+'</span></div>';
  }

  /* ---- 조회 모드 ---- */
  function renderTnView(sheet, id){
    var t = tnList().find(function(x){ return x.id===id; });
    if(!t){ var o0=document.getElementById('tnOverlay'); if(o0) o0.remove(); return; }
    var tel = String(t.phone||'').replace(/[^0-9+]/g,'');
    var dd = tnDday(t);
    var specials = (t.specials||[]).filter(function(s){ return s&&String(s).trim(); });
    var memos = (t.memos||[]).slice().sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')) || String(b.id||'').localeCompare(String(a.id||'')); });
    var docs = [];
    try{
      var arr = JSON.parse(localStorage.getItem('wl_indiv_v43')||'[]');
      docs = arr.filter(function(dc){ return dc.floor===t.floor && String(dc.unit||'')===String(t.unit||''); });
    }catch(e){}
    sheet.innerHTML =
      '<div class="tn-drag-handle" style="display:flex;align-items:center;gap:6px;padding:14px 18px;border-bottom:1.5px solid #e8f0fa;cursor:move;position:sticky;top:0;background:#fff;border-radius:18px 18px 0 0;z-index:2">'
        + '<span style="background:#eef5fd;color:#3f7cb8;font-size:12px;font-weight:800;padding:4px 9px;border-radius:8px;white-space:nowrap">'+esc(String(t.floor||''))+' · '+esc(String(t.unit||''))+'</span>'
        + '<span style="font-size:16px;font-weight:800;color:#1a2f45;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(String(t.name||''))+'</span>'
        + '<button id="tnEditBtn" style="height:32px;padding:0 11px;border:none;border-radius:8px;background:#3f7cb8;color:#fff;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap">✏️ 수정</button>'
        + '<button id="tnDelBtn" style="height:32px;padding:0 11px;border:none;border-radius:8px;background:#fde8e8;color:#b52929;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap">🗑 삭제</button>'
        + '<button id="tnCloseBtn" style="height:32px;width:32px;border:none;border-radius:8px;background:#f0f4f9;color:#7a92a8;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;flex-shrink:0">✕</button>'
      + '</div>'
      + '<div style="padding:14px 18px 18px;box-sizing:border-box;max-width:100%">'
        + '<div style="font-size:13px;font-weight:800;color:#33567d;margin-bottom:4px">📄 계약정보 '+(dd?'<span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:8px;background:'+dd.bg+';color:'+dd.color+'">'+dd.label+'</span>':'')+'</div>'
        + '<div style="background:#f7faff;border-radius:12px;padding:10px 14px;margin-bottom:14px;box-sizing:border-box">'
          + tnInfoRow('대표자', t.ceo?esc(String(t.ceo)):'')
          + tnInfoRow('연락처', tel?'<a href="tel:'+tel+'" style="color:#3f7cb8;text-decoration:none">📞 '+esc(String(t.phone))+'</a>':'')
          + ((Array.isArray(t.contacts)&&t.contacts.length) ? t.contacts.filter(function(cc){return cc&&(cc.name||cc.phone);}).map(function(cc){ var ct=String(cc.phone||'').replace(/[^0-9+]/g,''); return tnInfoRow(esc(cc.name||'담당'), (ct?'<a href="tel:'+ct+'" style="color:#3f7cb8;text-decoration:none">📞 '+esc(String(cc.phone||''))+'</a>':esc(String(cc.phone||'')))); }).join('') : '')
          + tnInfoRow('사업자번호', t.biznum?esc(String(t.biznum)):'')
          + tnInfoRow('업종', t.business?esc(String(t.business)):'')
          + tnInfoRow('면적', t.area?esc(String(t.area)):'')
          + tnInfoRow('계약기간', (t.startDate||t.endDate)?esc(String(t.startDate||'?'))+' ~ '+esc(String(t.endDate||'?'))+(dd&&dd.renewed?' <span style="color:#27ae60;font-weight:800">→ 자동갱신 '+esc(dd.effEnd)+'</span>':''):'')
          + tnInfoRow('보증금', tnMoney(t.deposit)?tnMoney(t.deposit)+'원':'')
          + tnInfoRow('월세', tnMoney(t.rent)?tnMoney(t.rent)+'원':'')
          + tnInfoRow('관리비', tnMoney(t.mgmtFee)?tnMoney(t.mgmtFee)+'원':'')
          + tnInfoRow('납부일', t.payDay?'매월 '+esc(String(t.payDay))+'일':'')
          + tnInfoRow('비고', t.note?esc(String(t.note)):'')
        + '</div>'
        + '<div style="font-size:13px;font-weight:800;color:#8e44ad;margin-bottom:4px">📋 특약사항 <span style="color:#aab8c8;font-weight:600;font-size:11px">'+specials.length+'건</span></div>'
        + (specials.length
            ? '<div style="background:#faf7fd;border-radius:12px;padding:10px 14px;margin-bottom:14px">'+specials.map(function(s,i){ return '<div style="display:flex;gap:8px;font-size:13px;color:#1a2f45;padding:3px 0;line-height:1.55"><b style="color:#8e44ad;flex-shrink:0">'+(i+1)+'.</b><span style="min-width:0;word-break:break-word">'+esc(String(s))+'</span></div>'; }).join('')+'</div>'
            : '<div style="font-size:12px;color:#aab8c8;padding:4px 4px 14px">등록된 특약이 없어요 — ✏️ 수정에서 추가하세요</div>')
        + '<div style="font-size:13px;font-weight:800;color:#b8860b;margin-bottom:6px">📝 중요메모 <span style="color:#aab8c8;font-weight:600;font-size:11px">'+memos.length+'건</span></div>'
        + '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;box-sizing:border-box">'
          + '<select id="tnMemoTag" style="flex:0 0 auto;width:82px;box-sizing:border-box;height:34px;padding:0 8px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:12px;font-family:inherit;background:#f7faff;outline:none;flex-shrink:0">'+TN_TAGS.map(function(g){ return '<option value="'+g+'">'+g+'</option>'; }).join('')+'</select>'
          + '<input type="text" id="tnMemoText" placeholder="메모 입력 후 Enter 또는 ➕ 추가" style="flex:1 1 140px;min-width:120px;box-sizing:border-box;height:34px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">'
          + '<button id="tnMemoAdd" style="height:34px;padding:0 12px;border:none;border-radius:8px;background:#b8860b;color:#fff;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;flex-shrink:0">➕ 추가</button>'
        + '</div>'
        + '<div id="tnMemoList">' + (memos.length ? memos.map(function(m){
            var c = TN_TAG_COLOR[m.tag]||'#7a92a8';
            return '<div style="display:flex;gap:8px;align-items:flex-start;background:#fffdf5;border:1px solid #f2ead0;border-radius:10px;padding:8px 10px;margin-bottom:6px">'
              + '<span style="font-size:10px;font-weight:800;color:#fff;background:'+c+';padding:2px 7px;border-radius:7px;flex-shrink:0;margin-top:2px">'+esc(String(m.tag||'기타'))+'</span>'
              + '<div style="flex:1;min-width:0"><div style="font-size:13px;color:#1a2f45;line-height:1.5;word-break:break-word">'+esc(String(m.text||''))+'</div><div style="font-size:11px;color:#aab8c8;margin-top:2px">'+esc(String(m.date||''))+(m.editedAt?' <span style="color:#b8860b">(수정됨)</span>':'')+'</div></div>'
              + '<button class="tn-memo-edit" data-mid="'+esc(String(m.id||''))+'" data-tag="'+esc(String(m.tag||'기타'))+'" style="border:none;background:none;color:#a8b4c0;font-size:13px;cursor:pointer;padding:2px;flex-shrink:0" title="수정">✏️</button>'
              + '<button class="tn-memo-del" data-mid="'+esc(String(m.id||''))+'" style="border:none;background:none;color:#d0d8e2;font-size:13px;cursor:pointer;padding:2px;flex-shrink:0">🗑</button>'
            + '</div>';
          }).join('') : '<div style="font-size:12px;color:#aab8c8;padding:4px">메모가 없어요 — 위 입력줄에서 바로 추가할 수 있어요</div>') + '</div>'
        + '<div style="font-size:13px;font-weight:800;color:#0f766e;margin:14px 0 4px">📎 계약서 <span style="color:#aab8c8;font-weight:600;font-size:11px">'+((t.contractFiles||[]).length)+'건</span></div>'
        + '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">'
          + '<input type="text" id="tnCtName" placeholder="계약서 별칭 (예: 2024 임대차계약서)" style="flex:1 1 160px;min-width:130px;box-sizing:border-box;height:34px;padding:0 10px;border:1.5px solid #cde8e4;border-radius:8px;font-size:13px;font-family:inherit;background:#f2fbf9;outline:none">'
          + '<input type="text" id="tnCtPath" placeholder="경로/링크" style="flex:1 1 130px;min-width:110px;box-sizing:border-box;height:34px;padding:0 10px;border:1.5px solid #cde8e4;border-radius:8px;font-size:13px;font-family:inherit;background:#f2fbf9;outline:none">'
          + '<button id="tnCtAdd" style="height:34px;padding:0 12px;border:none;border-radius:8px;background:#0f766e;color:#fff;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;flex-shrink:0">➕ 추가</button>'
        + '</div>'
        + '<div id="tnCtList">' + ((t.contractFiles||[]).length ? (t.contractFiles||[]).map(function(cf,ci){
            return '<div style="display:flex;gap:8px;align-items:center;background:#f2fbf9;border:1px solid #d5efe9;border-radius:10px;padding:8px 10px;margin-bottom:5px">'
              + '<span style="flex:1;min-width:0;font-size:13px;color:#134e48;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📎 '+esc(String(cf.name||'계약서'))+(cf.path?' <span style="color:#7a92a8;font-weight:400">· '+esc(String(cf.path))+'</span>':'')+'</span>'
              + (cf.path?'<button class="tn-ct-copy" data-path="'+esc(String(cf.path))+'" style="border:1.5px solid #cde8e4;background:#fff;color:#0f766e;font-size:11px;font-weight:700;padding:3px 9px;border-radius:7px;cursor:pointer;font-family:inherit;flex-shrink:0">📋 복사</button>':'')
              + '<button class="tn-ct-del" data-ci="'+ci+'" style="border:none;background:none;color:#d0d8e2;font-size:13px;cursor:pointer;padding:2px;flex-shrink:0">🗑</button>'
            + '</div>';
          }).join('') : '<div style="font-size:12px;color:#aab8c8;padding:2px 4px 10px">첨부된 계약서가 없어요 — 위에 별칭·경로를 넣고 ➕</div>') + '</div>'
        + '<div style="font-size:13px;font-weight:800;color:#3f7cb8;margin:14px 0 4px">📂 연결 서류 <span style="color:#aab8c8;font-weight:600;font-size:11px">'+docs.length+'건 · 임대개별 서류의 같은 층·호수 자동 연결</span></div>'
        + (docs.length
            ? docs.map(function(dc){
                return '<div style="display:flex;gap:8px;align-items:center;background:#f7faff;border-radius:10px;padding:8px 10px;margin-bottom:5px">'
                  + '<span style="font-size:11px;font-weight:700;color:#3f7cb8;background:#eef5fd;padding:2px 7px;border-radius:7px;flex-shrink:0">'+esc(String(dc.type||'서류'))+'</span>'
                  + '<span style="flex:1;min-width:0;font-size:12px;color:#1a2f45;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(dc.fileType==='folder'?'📁':'📄')+' '+esc(String(dc.name||''))+'</span>'
                  + (dc.path ? '<button class="tn-doc-copy" data-path="'+esc(String(dc.path))+'" style="border:1.5px solid #dbe6f4;background:#fff;color:#3f7cb8;font-size:11px;font-weight:700;padding:3px 9px;border-radius:7px;cursor:pointer;font-family:inherit;flex-shrink:0">📋 경로복사</button>' : '')
                + '</div>';
              }).join('')
            : '<div style="font-size:12px;color:#aab8c8;padding:4px">같은 층·호수로 등록된 서류가 없어요 (아래 📂 서류에서 층·호수를 지정해 등록하면 자동 연결)</div>')
      + '</div>';

    document.getElementById('tnCloseBtn').addEventListener('click', function(){ var o=document.getElementById('tnOverlay'); if(o) o.remove(); });
    document.getElementById('tnEditBtn').addEventListener('click', function(){ renderTnEdit(sheet, t); });
    document.getElementById('tnDelBtn').addEventListener('click', function(){
      var o=document.getElementById('tnOverlay'); if(o) o.remove();
      deleteWithUndo(t.id, '임차인 카드');
      renderTnGrid();
    });
    var _editingMemoId = null;  /* 수정 중인 메모 id (null이면 신규 추가) */
    var addMemo = function(){
      try{
        var txtEl = document.getElementById('tnMemoText');
        var txt = (txtEl.value||'').trim();
        if(!txt){ toast('메모 내용을 입력하세요'); return; }
        var tag = document.getElementById('tnMemoTag').value || '기타';
        var cur = tnList().find(function(x){ return x.id===id; });
        if(!cur) return;
        var memos2 = Array.isArray(cur.memos) ? cur.memos.slice() : [];
        if(_editingMemoId){
          /* 기존 메모 수정 */
          for(var i=0;i<memos2.length;i++){
            if(String(memos2[i].id)===String(_editingMemoId)){
              memos2[i] = {id:memos2[i].id, date:memos2[i].date||todayStr(), tag:tag, text:txt, editedAt:Date.now()};
              break;
            }
          }
          updateRecord(id, {memos:memos2, updatedAt:Date.now()});
          _editingMemoId = null;
          renderTnView(sheet, id); renderTnGrid();
          toast('✏️ 메모 수정됨');
        } else {
          /* 신규 추가 */
          memos2.unshift({id:'m'+Date.now()+Math.floor(Math.random()*1000), date:todayStr(), tag:tag, text:txt});
          updateRecord(id, {memos:memos2, updatedAt:Date.now()});
          renderTnView(sheet, id); renderTnGrid();
          toast('📝 메모 추가됨');
        }
      }catch(err){ console.error('[임차인 메모]', err); toast('메모 저장 오류: '+(err.message||err)); }
    };
    document.getElementById('tnMemoAdd').addEventListener('click', addMemo);
    document.getElementById('tnMemoText').addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); addMemo(); } });
    /* 메모 수정 버튼: 입력줄에 값 로드 + 버튼 라벨 변경 */
    sheet.querySelectorAll('.tn-memo-edit').forEach(function(b){
      b.addEventListener('click', function(){
        try{
          var cur = tnList().find(function(x){ return x.id===id; });
          if(!cur) return;
          var mid = b.getAttribute('data-mid');
          var m = (cur.memos||[]).find(function(x){ return String(x.id)===String(mid); });
          if(!m) return;
          _editingMemoId = mid;
          document.getElementById('tnMemoTag').value = m.tag||'기타';
          var txtEl = document.getElementById('tnMemoText');
          txtEl.value = m.text||'';
          txtEl.focus();
          var addBtn = document.getElementById('tnMemoAdd');
          addBtn.textContent = '💾 수정';
          addBtn.style.background = '#3f7cb8';
          txtEl.placeholder = '내용 수정 후 Enter 또는 💾 수정';
        }catch(err){ console.error('[임차인 메모수정 로드]', err); }
      });
    });
    sheet.querySelectorAll('.tn-memo-del').forEach(function(b){
      b.addEventListener('click', function(){
        try{
          var cur = tnList().find(function(x){ return x.id===id; });
          if(!cur) return;
          var memos2 = (cur.memos||[]).filter(function(m){ return String(m.id)!==b.getAttribute('data-mid'); });
          updateRecord(id, {memos:memos2, updatedAt:Date.now()});
          renderTnView(sheet, id); renderTnGrid();
          toast('메모 삭제됨');
        }catch(err){ console.error('[임차인 메모삭제]', err); }
      });
    });
    sheet.querySelectorAll('.tn-doc-copy').forEach(function(b){
      b.addEventListener('click', function(){
        var p = b.getAttribute('data-path')||'';
        try{
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(p).then(function(){ toast('📋 경로 복사됨'); }).catch(function(){ tnCopyFallback(p); });
          } else tnCopyFallback(p);
        }catch(e){ tnCopyFallback(p); }
      });
    });

    /* 계약서 추가/삭제/복사 */
    var ctAddBtn = document.getElementById('tnCtAdd');
    if(ctAddBtn){
      ctAddBtn.addEventListener('click', function(){
        try{
          var nm = (document.getElementById('tnCtName').value||'').trim();
          var pa = (document.getElementById('tnCtPath').value||'').trim();
          if(!nm && !pa){ toast('계약서 별칭 또는 경로를 입력하세요'); return; }
          var cur = tnList().find(function(x){ return x.id===id; });
          if(!cur) return;
          var arr = Array.isArray(cur.contractFiles) ? cur.contractFiles.slice() : [];
          arr.push({name:nm||'계약서', path:pa});
          updateRecord(id, {contractFiles:arr, updatedAt:Date.now()});
          renderTnView(sheet, id); renderTnGrid();
          toast('📎 계약서 추가됨');
        }catch(err){ console.error('[임차인 계약서]', err); toast('오류: '+(err.message||err)); }
      });
    }
    sheet.querySelectorAll('.tn-ct-del').forEach(function(b){
      b.addEventListener('click', function(){
        try{
          var cur = tnList().find(function(x){ return x.id===id; });
          if(!cur) return;
          var ci = Number(b.getAttribute('data-ci'));
          var arr = (cur.contractFiles||[]).slice();
          arr.splice(ci,1);
          updateRecord(id, {contractFiles:arr, updatedAt:Date.now()});
          renderTnView(sheet, id); renderTnGrid();
          toast('계약서 삭제됨');
        }catch(err){ console.error('[임차인 계약서삭제]', err); }
      });
    });
    sheet.querySelectorAll('.tn-ct-copy').forEach(function(b){
      b.addEventListener('click', function(){
        var p = b.getAttribute('data-path')||'';
        try{
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(p).then(function(){ toast('📋 경로 복사됨'); }).catch(function(){ tnCopyFallback(p); });
          } else tnCopyFallback(p);
        }catch(e){ tnCopyFallback(p); }
      });
    });
  }
  function tnCopyFallback(text){
    try{
      var ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('📋 경로 복사됨');
    }catch(e){ toast('복사 실패 — 경로를 길게 눌러 복사하세요'); }
  }

  /* ---- 편집 모드 (신규는 바로 편집) ---- */
  function renderTnEdit(sheet, t){
    var isNew = !t;
    var d = t || {floor:'', unit:'', name:'', ceo:'', phone:'', biznum:'', business:'', area:'', startDate:'', endDate:'', deposit:0, rent:0, mgmtFee:0, payDay:'', specials:[], memos:[], note:''};
    var INP = 'width:100%;box-sizing:border-box;height:34px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none';
    var LBL = 'display:block;font-size:11px;font-weight:700;color:#33567d;margin-bottom:2px';
    var specials = (d.specials||[]).filter(function(s){ return s&&String(s).trim(); });
    if(!specials.length) specials = [''];
    sheet.innerHTML =
      '<div class="tn-drag-handle" style="display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1.5px solid #e8f0fa;cursor:move;position:sticky;top:0;background:#fff;border-radius:18px 18px 0 0;z-index:2">'
        + '<span style="font-size:16px;font-weight:800;color:#1a2f45;flex:1">'+(isNew?'🏠 임차인 추가':'✏️ 임차인 수정')+'</span>'
        + '<button id="tnEditClose" type="button" style="height:32px;width:32px;border:none;border-radius:8px;background:#f0f4f9;color:#7a92a8;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer">✕</button>'
      + '</div>'
      + '<div style="padding:14px 18px 18px;box-sizing:border-box;max-width:100%">'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
          + '<div><label style="'+LBL+'">층 <span style="color:#e74c3c">*</span></label><select id="tnFloorSel" style="'+INP+';padding:0 6px">'
            + '<option value="">층 선택</option>'
            + TN_FLOORS.map(function(f){ return '<option value="'+f+'" '+(d.floor===f?'selected':'')+'>'+f+'</option>'; }).join('')
          + '</select></div>'
          + '<div><label style="'+LBL+'">호수 <span style="color:#e74c3c">*</span></label><input type="text" id="tnUnitInp" placeholder="예: 501" style="'+INP+'"></div>'
          + '<div style="grid-column:1/-1"><label style="'+LBL+'">상호 / 임차인명 <span style="color:#e74c3c">*</span></label><input type="text" id="tnNameInp" placeholder="예: (주)OO상사" style="'+INP+'"></div>'
          + '<div><label style="'+LBL+'">대표자</label><input type="text" id="tnCeoInp" style="'+INP+'"></div>'
          + '<div><label style="'+LBL+'">연락처</label><input type="text" id="tnPhoneInp" placeholder="010-0000-0000" style="'+INP+'"></div>'
          + '<div><label style="'+LBL+'">사업자번호</label><input type="text" id="tnBiznumInp" style="'+INP+'"></div>'
          + '<div><label style="'+LBL+'">업종</label><input type="text" id="tnBizInp" style="'+INP+'"></div>'
          + '<div><label style="'+LBL+'">면적</label><input type="text" id="tnAreaInp" placeholder="예: 33평 (109㎡)" style="'+INP+'"></div>'
          + '<div><label style="'+LBL+'">납부일</label><input type="text" id="tnPayDayInp" placeholder="예: 25 (매월 25일)" style="'+INP+'"></div>'
          + '<div><label style="'+LBL+'">🔑 최초 입주일</label><input type="date" id="tnMoveInInp" style="'+INP+'"></div>'
          + '<div></div>'
          + '<div><label style="'+LBL+'">계약 시작</label><input type="date" id="tnStartInp" style="'+INP+'"></div>'
          + '<div><label style="'+LBL+'">계약 종료</label><input type="date" id="tnEndInp" style="'+INP+'"></div>'
          + '<div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:6px 10px;background:#eaf6ef;border:1.5px solid #bfe3ce;border-radius:8px"><input type="checkbox" id="tnAutoRenew" style="width:18px;height:18px;cursor:pointer"><label for="tnAutoRenew" style="font-size:12px;font-weight:700;color:#27ae60;cursor:pointer;flex:1">🔄 자동갱신 (종료일 지나면 자동으로 1년 연장 표시)</label></div>'
          + '<div><label style="'+LBL+'">보증금 (원)</label><input type="text" id="tnDepositInp" inputmode="numeric" style="'+INP+'"></div>'
          + '<div><label style="'+LBL+'">월세 (원)</label><input type="text" id="tnRentInp" inputmode="numeric" style="'+INP+'"></div>'
          + '<div style="grid-column:1/-1"><label style="'+LBL+'">관리비 (원)</label><input type="text" id="tnMgmtInp" inputmode="numeric" style="'+INP+'"></div>'
          + '<div style="grid-column:1/-1;font-size:11px;font-weight:700;color:#0f766e;margin-top:2px">📐 평당가 (선택 · 직접 입력)</div>'
          + '<div><label style="'+LBL+'">보증금 평단가</label><input type="text" id="tnDepPyInp" inputmode="numeric" placeholder="평당 원" style="'+INP+'"></div>'
          + '<div><label style="'+LBL+'">월세 평단가</label><input type="text" id="tnRentPyInp" inputmode="numeric" placeholder="평당 원" style="'+INP+'"></div>'
          + '<div style="grid-column:1/-1"><label style="'+LBL+'">관리비 평단가</label><input type="text" id="tnMgmtPyInp" inputmode="numeric" placeholder="평당 원" style="'+INP+'"></div>'
          + '<div style="grid-column:1/-1"><label style="'+LBL+'">📞 담당 연락처 (여러 명 가능)</label><div id="tnContactRows"></div>'
            + '<button id="tnContactAdd" type="button" style="margin-top:4px;height:30px;padding:0 12px;border:1.5px dashed #9ec7ea;border-radius:8px;background:#f0f7fd;color:#3f7cb8;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer">➕ 연락처 추가</button></div>'
          + '<div style="grid-column:1/-1"><label style="'+LBL+'">📋 특약사항</label><div id="tnSpecialRows"></div>'
            + '<button id="tnSpecialAdd" type="button" style="margin-top:4px;height:30px;padding:0 12px;border:1.5px dashed #c9b8e8;border-radius:8px;background:#faf7fd;color:#8e44ad;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer">➕ 특약 추가</button></div>'
          + '<div style="grid-column:1/-1"><label style="'+LBL+'">비고</label><textarea id="tnNoteInp" rows="2" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none;resize:vertical"></textarea></div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:14px">'
          + '<button id="tnEditCancel" type="button" style="flex:1;height:44px;border:2px solid #dbe6f4;border-radius:12px;background:#f7faff;color:#7a92a8;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">취소</button>'
          + (isNew?'':'<button id="tnEditDel" type="button" style="flex:1;height:44px;border:2px solid #fde8e8;border-radius:12px;background:#fff;color:#e74c3c;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">🗑 삭제</button>')
          + '<button id="tnEditSave" type="button" style="flex:2;height:44px;border:none;border-radius:12px;background:#3f7cb8;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">💾 저장</button>'
        + '</div>'
      + '</div>';

    /* 값 주입 (innerHTML 속성 이스케이프 문제 방지 — DOM으로 직접) */
    document.getElementById('tnUnitInp').value = d.unit||'';
    document.getElementById('tnNameInp').value = d.name||'';
    document.getElementById('tnCeoInp').value = d.ceo||'';
    document.getElementById('tnPhoneInp').value = d.phone||'';
    document.getElementById('tnBiznumInp').value = d.biznum||'';
    document.getElementById('tnBizInp').value = d.business||'';
    document.getElementById('tnAreaInp').value = d.area||'';
    document.getElementById('tnPayDayInp').value = d.payDay||'';
    document.getElementById('tnMoveInInp').value = d.moveInDate||'';
    document.getElementById('tnStartInp').value = d.startDate||'';
    document.getElementById('tnEndInp').value = d.endDate||'';
    document.getElementById('tnDepositInp').value = tnMoney(d.deposit);
    document.getElementById('tnRentInp').value = tnMoney(d.rent);
    document.getElementById('tnMgmtInp').value = tnMoney(d.mgmtFee);
    document.getElementById('tnDepPyInp').value = tnMoney(d.depPy);
    document.getElementById('tnRentPyInp').value = tnMoney(d.rentPy);
    document.getElementById('tnMgmtPyInp').value = tnMoney(d.mgmtPy);
    document.getElementById('tnNoteInp').value = d.note||'';
    document.getElementById('tnAutoRenew').checked = (d.autoRenew!==false);

    /* 담당 연락처 동적 행 */
    var contactHost = document.getElementById('tnContactRows');
    function addContactRow(nm, ph){
      var row = document.createElement('div');
      row.className = 'tn-ct-row';
      row.style.cssText = 'display:flex;gap:6px;margin-bottom:5px';
      row.innerHTML = '<input type="text" class="tn-ct-name" placeholder="이름/직책" style="flex:0 0 34%;min-width:0;box-sizing:border-box;height:34px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">'
        + '<input type="text" class="tn-ct-phone" placeholder="010-0000-0000" style="flex:1;min-width:0;box-sizing:border-box;height:34px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">'
        + '<button type="button" class="tn-ctrow-del" style="width:34px;height:34px;border:1.5px solid #fde8e8;border-radius:8px;background:#fff;color:#e74c3c;font-size:13px;cursor:pointer;flex-shrink:0">✕</button>';
      row.querySelector('.tn-ct-name').value = nm||'';
      row.querySelector('.tn-ct-phone').value = ph||'';
      row.querySelector('.tn-ctrow-del').addEventListener('click', function(){ row.remove(); });
      contactHost.appendChild(row);
    }
    var initContacts = Array.isArray(d.contacts) ? d.contacts.filter(function(c){return c&&(c.name||c.phone);}) : [];
    if(!initContacts.length) initContacts = [{name:'',phone:''}];
    initContacts.forEach(function(c){ addContactRow(c.name, c.phone); });
    document.getElementById('tnContactAdd').addEventListener('click', function(){
      addContactRow('','');
      var rows = contactHost.querySelectorAll('.tn-ct-name');
      if(rows.length) rows[rows.length-1].focus();
    });

    /* 특약 동적 행 */
    var rowsHost = document.getElementById('tnSpecialRows');
    function addSpecialRow(val){
      var row = document.createElement('div');
      row.className = 'tn-sp-row';
      row.style.cssText = 'display:flex;gap:6px;margin-bottom:5px';
      row.innerHTML = '<input type="text" class="tn-sp-inp" placeholder="특약 내용 (예: 원상복구 조건, 관리비 포함 항목 등)" style="flex:1;min-width:0;box-sizing:border-box;height:34px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none">'
        + '<button type="button" class="tn-sp-del" style="width:34px;height:34px;border:1.5px solid #fde8e8;border-radius:8px;background:#fff;color:#e74c3c;font-size:13px;cursor:pointer;flex-shrink:0">✕</button>';
      row.querySelector('.tn-sp-inp').value = val||'';
      row.querySelector('.tn-sp-del').addEventListener('click', function(){ row.remove(); });
      rowsHost.appendChild(row);
    }
    specials.forEach(addSpecialRow);
    document.getElementById('tnSpecialAdd').addEventListener('click', function(){
      addSpecialRow('');
      var rows = rowsHost.querySelectorAll('.tn-sp-inp');
      if(rows.length) rows[rows.length-1].focus();
    });

    /* 금액 자동 콤마 */
    ['tnDepositInp','tnRentInp','tnMgmtInp','tnDepPyInp','tnRentPyInp','tnMgmtPyInp'].forEach(function(iid){
      var el = document.getElementById(iid);
      el.addEventListener('input', function(){ var n=el.value.replace(/[^0-9]/g,''); el.value = n?Number(n).toLocaleString('ko-KR'):''; });
    });

    var closeAll = function(){ var o=document.getElementById('tnOverlay'); if(o) o.remove(); };
    document.getElementById('tnEditClose').addEventListener('click', closeAll);
    document.getElementById('tnEditCancel').addEventListener('click', function(){
      if(isNew) closeAll(); else renderTnView(sheet, t.id);
    });
    if(!isNew){
      document.getElementById('tnEditDel').addEventListener('click', function(){
        closeAll(); deleteWithUndo(t.id, '임차인 카드'); renderTnGrid();
      });
    }
    document.getElementById('tnEditSave').addEventListener('click', function(){
      try{
        var floor = document.getElementById('tnFloorSel').value;
        var unit = document.getElementById('tnUnitInp').value.trim();
        var name = document.getElementById('tnNameInp').value.trim();
        if(!floor){ toast('층을 선택하세요'); return; }
        if(!unit){ toast('호수를 입력하세요'); return; }
        if(!name){ toast('상호/임차인명을 입력하세요'); return; }
        var sp = [];
        rowsHost.querySelectorAll('.tn-sp-inp').forEach(function(i2){ var v=(i2.value||'').trim(); if(v) sp.push(v); });
        var cts = [];
        contactHost.querySelectorAll('.tn-ct-row').forEach(function(r2){
          var nm=(r2.querySelector('.tn-ct-name').value||'').trim();
          var ph=(r2.querySelector('.tn-ct-phone').value||'').trim();
          if(nm||ph) cts.push({name:nm, phone:ph});
        });
        var patch = {
          kind:'tenant', floor:floor, unit:unit, name:name,
          ceo: document.getElementById('tnCeoInp').value.trim(),
          phone: document.getElementById('tnPhoneInp').value.trim(),
          contacts: cts,
          biznum: document.getElementById('tnBiznumInp').value.trim(),
          business: document.getElementById('tnBizInp').value.trim(),
          area: document.getElementById('tnAreaInp').value.trim(),
          payDay: document.getElementById('tnPayDayInp').value.trim(),
          moveInDate: document.getElementById('tnMoveInInp').value,
          startDate: document.getElementById('tnStartInp').value,
          endDate: document.getElementById('tnEndInp').value,
          autoRenew: document.getElementById('tnAutoRenew').checked,
          deposit: tnParseMoney(document.getElementById('tnDepositInp').value),
          rent: tnParseMoney(document.getElementById('tnRentInp').value),
          mgmtFee: tnParseMoney(document.getElementById('tnMgmtInp').value),
          depPy: tnParseMoney(document.getElementById('tnDepPyInp').value),
          rentPy: tnParseMoney(document.getElementById('tnRentPyInp').value),
          mgmtPy: tnParseMoney(document.getElementById('tnMgmtPyInp').value),
          specials: sp,
          note: document.getElementById('tnNoteInp').value.trim(),
          updatedAt: Date.now()
        };
        /* 계약서는 조회모드에서 관리되므로 편집 저장 시 기존값 보존 */
        if(!isNew && t && Array.isArray(t.contractFiles)) patch.contractFiles = t.contractFiles;
        if(isNew){
          patch.memos = [];
          patch.date = todayStr();
          patch.createdAt = Date.now();
          var rec = addRecord(patch);
          toast('🏠 임차인 카드 저장됨');
          renderTnGrid();
          renderTnView(sheet, rec.id);
        } else {
          updateRecord(t.id, patch);
          toast('💾 저장됨');
          renderTnGrid();
          renderTnView(sheet, t.id);
        }
      }catch(err){ console.error('[임차인 저장]', err); toast('저장 오류: '+(err.message||err)); }
    });
  }

  /* renderAll 래핑 — 클라우드 동기화·삭제복구 후 임차인 그리드도 갱신 */
  try{
    if(typeof renderAll === 'function' && !renderAll._tnWrapped){
      var _tnOrigRenderAll = renderAll;
      renderAll = function(){
        _tnOrigRenderAll();
        try{ if(document.getElementById('tnGrid')) renderTnGrid(); }catch(e){}
      };
      renderAll._tnWrapped = true;
      window.renderAll = renderAll;
    }
  }catch(e){ console.warn('[임차인] renderAll 래핑 생략:', e); }

  /* 서희타워 임대현황 엑셀(26.07.01 기준) — 평당단가×면적 합산 */
  var TN_BULK_DATA = [
    {floor:"B1",unit:"B101,B103",name:"애플이엔씨",area:"340.5평",deposit:102135000,rent:14657394,mgmtFee:8511250},
    {floor:"B1",unit:"B102",name:"서희건설",area:"21.2평",deposit:6355117,rent:912023,mgmtFee:529593},
    {floor:"1F",unit:"101,102",name:"서희건설 / 양재퍼스트 정형외과",area:"158.4평",deposit:400000000,rent:20999954,mgmtFee:3961000},
    {floor:"2F",unit:"201,202",name:"아이피 웰의원",area:"84.4평",deposit:99990300,rent:6999321,mgmtFee:2109500},
    {floor:"3F",unit:"301,302",name:"삼성생명서비스",area:"183.1평",deposit:200000000,rent:12157840,mgmtFee:4577500},
    {floor:"4F",unit:"401",name:"콜로노비타",area:"184.7평",deposit:120068000,rent:13484560,mgmtFee:4618000},
    {floor:"5F",unit:"501",name:"광주은행양재지점",area:"118.0평",deposit:83772332,rent:9203158,mgmtFee:2831741},
    {floor:"5F",unit:"502",name:"세양재법무법인",area:"66.7평",deposit:40037640,rent:4003764,mgmtFee:1668235},
    {floor:"6F",unit:"601",name:"진지노코리아",area:"184.7평",deposit:138540000,rent:13854000,mgmtFee:4618000},
    {floor:"7F",unit:"701",name:"법무법인 지향",area:"184.7평",deposit:129304000,rent:13484560,mgmtFee:4618000},
    {floor:"8F",unit:"801",name:"법무법인 지향",area:"184.7평",deposit:129304000,rent:13484560,mgmtFee:4618000},
    {floor:"9F",unit:"901",name:"유성티엔에스",area:"184.7평",deposit:110832000,rent:13299840,mgmtFee:4618000},
    {floor:"10F",unit:"1001",name:"앰비앤홀딩스",area:"160.7평",deposit:96000000,rent:11680000,mgmtFee:4000000,depPy:600000,rentPy:70000,mgmtPy:25000},
    {floor:"10F",unit:"1001",name:"엔비홀딩스",area:"24.0평",deposit:15000000,rent:1825000,mgmtFee:625000,depPy:600000,rentPy:70000,mgmtPy:25000},
    {floor:"11F",unit:"1101",name:"서희건설",area:"114.3평",deposit:68580000,rent:8229600,mgmtFee:2857500},
    {floor:"12F",unit:"1201",name:"㈜원준",area:"108.2평",deposit:64890000,rent:7786800,mgmtFee:2703750},
    {floor:"13F",unit:"1301",name:"서희건설",area:"184.7평",deposit:110832000,rent:11662667,mgmtFee:4618000},
    {floor:"14F",unit:"1401",name:"법무법인 예헌",area:"184.7평",deposit:138742140,rent:14592769,mgmtFee:4784212},
    {floor:"15F",unit:"1501",name:"서희건설",area:"184.7평",deposit:110832000,rent:11662667,mgmtFee:4618000},
    {floor:"16F",unit:"1601",name:"서희건설",area:"184.7평",deposit:110832000,rent:11662667,mgmtFee:4618000},
    {floor:"17F",unit:"1701",name:"서희건설",area:"185.1평",deposit:111084000,rent:11689184,mgmtFee:4628500},
    {floor:"18F",unit:"1801",name:"국민트랜스",area:"185.1평",deposit:111084000,rent:11689184,mgmtFee:4628500},
    {floor:"19F",unit:"1901",name:"서희건설",area:"93.7평",deposit:56244000,rent:5918462,mgmtFee:2343500},
    {floor:"19F",unit:"1902",name:"서희휴먼테크",area:"7.0평",deposit:4200000,rent:441959,mgmtFee:175000},
    {floor:"19F",unit:"1903",name:"이엔비하우징",area:"7.0평",deposit:4200000,rent:441959,mgmtFee:175000},
    {floor:"19F",unit:"1905",name:"소망이에스디",area:"",deposit:0,rent:0,mgmtFee:0},
    {floor:"19F",unit:"1904",name:"유성티엔에스",area:"77.0평",deposit:0,rent:0,mgmtFee:0},
    {floor:"20F",unit:"2001",name:"서희건설",area:"196.5평",deposit:117924000,rent:12408946,mgmtFee:4913500}
  ];
  function tnBulkImport(){
    try{
      var existing = tnList();
      var msg = '📊 서희타워 임대현황 '+TN_BULK_DATA.length+'개 임차인 카드를 등록합니다.\n\n';
      if(existing.length){ msg += '⚠️ 기존 임차인 카드 '+existing.length+'개가 모두 삭제되고 새로 생성됩니다.\n(되돌리기 가능)\n\n'; }
      msg += '진행할까요?';
      if(!confirm(msg)) return;
      /* 기존 임차인 전부 삭제 (클라우드 동기화 포함) */
      existing.forEach(function(t){ try{ deleteRecord(t.id); }catch(e){} });
      /* 27개 생성 */
      var now = Date.now(), added=0;
      TN_BULK_DATA.forEach(function(row, i){
        addRecord({
          kind:'tenant', floor:row.floor, unit:row.unit, name:row.name,
          ceo:'', phone:'', contacts:[], biznum:'', business:'', area:row.area||'',
          payDay:'', startDate:'', endDate:'', autoRenew:true,
          deposit:row.deposit||0, rent:row.rent||0, mgmtFee:row.mgmtFee||0,
          specials:[], memos:[], contractFiles:[], note:'',
          date:todayStr(), createdAt:now+i, updatedAt:now+i
        });
        added++;
      });
      if(typeof lsSave==='function') lsSave();
      renderTnGrid();
      toast('📊 '+added+'개 임차인 카드 등록 완료');
    }catch(err){ console.error('[임차인 일괄등록]', err); toast('일괄등록 오류: '+(err.message||err)); }
  }
  window.tnBulkImport = tnBulkImport;

  /* 엔비홀딩스 단독 추가 (중복 방지) */
  function tnAddEnbi(){
    try{
      var exists = tnList().some(function(t){ return (t.name||'').indexOf('엔비홀딩스')>=0; });
      if(exists){ toast('엔비홀딩스 카드가 이미 있어요'); return; }
      if(!confirm('🏠 엔비홀딩스 (10F·1001) 카드를 추가할까요?\n보증금 15,000,000 / 월세 1,825,000 / 관리비 625,000')) return;
      var now = Date.now();
      addRecord({
        kind:'tenant', floor:'10F', unit:'1001', name:'엔비홀딩스',
        ceo:'', phone:'', contacts:[], biznum:'', business:'', area:'24.0평',
        payDay:'', startDate:'', endDate:'', autoRenew:true,
        deposit:15000000, rent:1825000, mgmtFee:625000,
        depPy:600000, rentPy:70000, mgmtPy:25000,
        specials:[], memos:[], contractFiles:[], note:'',
        date:todayStr(), createdAt:now, updatedAt:now
      });
      if(typeof lsSave==='function') lsSave();
      renderTnGrid();
      toast('🏠 엔비홀딩스 카드 추가됨');
    }catch(err){ console.error('[엔비홀딩스 추가]', err); toast('추가 오류: '+(err.message||err)); }
  }
  window.tnAddEnbi = tnAddEnbi;

  /* 날짜에서 N개월 빼기 (YYYY-MM-DD) */
  function tnMinusMonths(dateStr, months){
    try{
      var p = String(dateStr).split('-').map(Number);
      var d = new Date(Date.UTC(p[0], p[1]-1, p[2]));
      d.setUTCMonth(d.getUTCMonth() - months);
      var y=d.getUTCFullYear(), m=('0'+(d.getUTCMonth()+1)).slice(-2), dd=('0'+d.getUTCDate()).slice(-2);
      return y+'-'+m+'-'+dd;
    }catch(e){ return dateStr; }
  }

  /* 만료일 4개월·3개월 전 알림을 달력(schedule)에 일괄 추가 */
  function tnAddExpiryToCalendar(){
    try{
      var list = tnList().filter(function(t){ return t.endDate; });
      if(!list.length){ toast('만료일이 입력된 임차인이 없어요'); return; }
      var msg = '📅 임차인 '+list.length+'곳의 계약 만료 알림을 달력에 추가합니다.\n\n'
        + '각 임차인마다 만료 4개월 전 · 3개월 전 2개씩 (자동갱신 시 갱신된 만료일 기준)\n'
        + '총 '+(list.length*2)+'개 일정이 생성됩니다.\n\n중복 추가를 막기 위해 기존 계약만료 일정은 먼저 제거됩니다. 진행할까요?';
      if(!confirm(msg)) return;

      /* 기존 자동생성 계약만료 일정 제거 (tnExpiryRef 표식 있는 것만) */
      var olds = entries.filter(function(e){ return e.kind==='schedule' && e.tnExpiryRef; });
      olds.forEach(function(e){ try{ deleteRecord(e.id); }catch(_e){} });

      var now = Date.now(), added=0, i=0;
      list.forEach(function(t){
        /* 자동갱신 반영 실효 만료일 */
        var eff = (typeof tnEffectiveEnd==='function') ? tnEffectiveEnd(t) : null;
        var endDate = (eff && eff.end) ? eff.end : t.endDate;
        var nm = (t.name||'').split('/')[0].trim();
        [[4,'4개월'],[3,'3개월']].forEach(function(pair){
          var alertDate = tnMinusMonths(endDate, pair[0]);
          addRecord({
            kind:'schedule',
            date: alertDate,
            title: '['+esc(String(t.floor||''))+' '+esc(String(t.unit||''))+'] '+nm+' 계약만료 '+pair[1]+'전 (만료 '+endDate+')',
            sStatus:'예정', sType:'계약갱신', scheduleType:'일회성',
            tnExpiryRef: t.id,
            createdAt: now+i, updatedAt: now+i, date_added: todayStr()
          });
          added++; i++;
        });
      });
      if(typeof lsSave==='function') lsSave();
      if(typeof renderAll==='function') renderAll();
      toast('📅 '+added+'개 계약만료 알림을 달력에 추가했어요');
    }catch(err){ console.error('[만료 달력추가]', err); toast('오류: '+(err.message||err)); }
  }
  window.tnAddExpiryToCalendar = tnAddExpiryToCalendar;

  window.renderTenantCards = renderTenantCards;
  window.openTenantModal = openTenantModal;

  /* 초기 렌더 (저장된 탭이 임대개별인 채로 열린 경우 대비) */
  setTimeout(function(){ try{ renderTenantCards(); }catch(e){} }, 900);
})();


/* ============================================================
   v44: 월간 반복업무 체크리스트 — 메인(기록) 탭 상단
   - 반복업무 템플릿(recurTpl): 항목명·분류·매월 기한일·금액 — 달님이 추가/수정/삭제
   - 매월 자동 생성: 이번 달 앱 열면 템플릿→월별 완료상태(recurDone) 자동 준비
   - 완료 체크만 (기록·전표 연결 없음)
   - 기한 지난 미완료 = 빨강 최상단 / 기한 3일 전 = 주황
   저장: entries 시스템 (kind:"recurTpl") → Firebase 동기화 + 삭제복구
   완료상태: kind:"recurTpl" 레코드의 done 맵 {"2026-07": true} 에 월별 저장
   ============================================================ */
(function(){
  var RC_CATS = ['전표','납부','점검','기타'];
  var RC_CAT_BG = {'전표':'#f3eefc','납부':'#eef5fd','점검':'#eaf6ef','기타':'#f0f4f9'};
  var RC_CAT_FG = {'전표':'#8e44ad','납부':'#3f7cb8','점검':'#27ae60','기타':'#7a92a8'};
  var rcCollapsed = false;
  try{ rcCollapsed = localStorage.getItem('wl_recur_collapsed')==='1'; }catch(e){}

  function rcCurMonth(){ return todayStr().slice(0,7); }           // "2026-07"
  function rcToday(){ return Number(todayStr().slice(8,10)); }      // 6
  function rcList(){
    try{ return entries.filter(function(e){ return e.kind==='recurTpl'; }); }catch(e){ return []; }
  }
  function rcSortKey(t){ return (Number(t.day)||99); }
  function rcIsDone(t){ var m=t.done||{}; return !!m[rcCurMonth()]; }
  function rcMoney(v){ var n=Number(v)||0; return n===0?'':n.toLocaleString('ko-KR'); }

  /* ---- 위젯 렌더 (툴바 1회 생성, 리스트만 갱신) ---- */
  function renderRecurWidget(){
    var host = document.getElementById('recurWidget');
    if(!host) return;
    var all = rcList();
    /* 등록된 반복업무가 하나도 없으면: 안내 + 추가 버튼만 */
    if(!all.length){
      host.innerHTML =
        '<div style="background:#fff;border:1.5px dashed #cdddf0;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        + '<span style="font-size:14px;font-weight:800;color:#33567d">📅 월간 반복업무</span>'
        + '<span style="font-size:12px;color:#aab8c8;flex:1;min-width:140px">정수기 임차료·전기요금 같은 매월 반복 업무를 등록하면 매달 자동으로 체크리스트가 떠요</span>'
        + '<button id="rcMgmtBtn0" style="height:34px;padding:0 14px;border:none;border-radius:10px;background:#3f7cb8;color:#fff;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">➕ 반복업무 추가</button>'
        + '</div>';
      var b0 = document.getElementById('rcMgmtBtn0');
      if(b0) b0.addEventListener('click', function(){ openRecurManage(); });
      return;
    }
    if(!document.getElementById('rcCard')){
      host.innerHTML =
        '<div id="rcCard" style="background:#fff;border:1.5px solid #e8f0fa;border-radius:14px;padding:12px 15px">'
          + '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:8px">'
            + '<span style="font-size:15px;font-weight:800;color:#33567d">📅 <span id="rcMonthLabel"></span> 반복업무</span>'
            + '<span id="rcProg" style="font-size:12px;color:#7a92a8;font-weight:700"></span>'
            + '<span style="flex:1"></span>'
            + '<button id="rcMgmtBtn" style="height:30px;padding:0 11px;border:1.5px solid #dbe6f4;border-radius:8px;background:#f7faff;color:#3f7cb8;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer">⚙️ 관리</button>'
            + '<button id="rcToggle" style="height:30px;width:30px;border:1.5px solid #dbe6f4;border-radius:8px;background:#f7faff;color:#7a92a8;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer" aria-label="접기">▾</button>'
          + '</div>'
          + '<div id="rcBarWrap" style="height:6px;background:#eef2f7;border-radius:3px;margin-bottom:11px;overflow:hidden"><div id="rcBar" style="height:100%;width:0;background:#3f7cb8;border-radius:3px;transition:width .25s"></div></div>'
          + '<div id="rcBody"></div>'
        + '</div>';
      document.getElementById('rcMgmtBtn').addEventListener('click', function(){ openRecurManage(); });
      var tg = document.getElementById('rcToggle');
      tg.addEventListener('click', function(){
        rcCollapsed = !rcCollapsed;
        try{ localStorage.setItem('wl_recur_collapsed', rcCollapsed?'1':'0'); }catch(e){}
        renderRcBody();
      });
    }
    renderRcBody();
  }

  function renderRcBody(){
    var body = document.getElementById('rcBody');
    var barWrap = document.getElementById('rcBarWrap');
    var tg = document.getElementById('rcToggle');
    if(!body) return;
    var all = rcList();
    var ml = document.getElementById('rcMonthLabel');
    if(ml) ml.textContent = rcToday() ? (Number(rcCurMonth().slice(5,7))+'월') : '';
    var doneN = all.filter(rcIsDone).length;
    var prog = document.getElementById('rcProg');
    if(prog) prog.textContent = doneN + ' / ' + all.length + ' 완료';
    var bar = document.getElementById('rcBar');
    if(bar) bar.style.width = all.length ? Math.round(doneN/all.length*100)+'%' : '0';

    if(tg) tg.textContent = rcCollapsed ? '▸' : '▾';
    if(rcCollapsed){ body.style.display='none'; if(barWrap) barWrap.style.display='none'; return; }
    body.style.display=''; if(barWrap) barWrap.style.display='';

    var today = rcToday();
    /* 정렬: 미완료 우선 → 기한 지난 것 → 기한 임박 → 완료 */
    var sorted = all.slice().sort(function(a,b){
      var ad=rcIsDone(a), bd=rcIsDone(b);
      if(ad!==bd) return ad?1:-1;
      var ao=(rcSortKey(a)<today)?0:1, bo=(rcSortKey(b)<today)?0:1;
      if(ao!==bo) return ao-bo;
      return rcSortKey(a)-rcSortKey(b);
    });
    body.innerHTML = sorted.map(function(t){
      var done = rcIsDone(t);
      var day = Number(t.day)||0;
      var over = (!done && day && day<today);
      var soon = (!done && day && day>=today && (day-today)<=3);
      var border = over ? '#f7c1c1' : (soon ? '#fac775' : '#e8f0fa');
      var bg = over ? '#fcebeb' : (soon ? '#faeeda' : '#fff');
      var money = rcMoney(t.amt);
      var rightBadge;
      if(done){
        var dm = (t.doneAt&&t.doneAt[rcCurMonth()]) ? t.doneAt[rcCurMonth()] : '';
        rightBadge = '<span style="font-size:11px;color:#aab8c8;flex-shrink:0">'+(dm?esc(dm)+' 완료':'완료')+'</span>';
      } else if(over){
        rightBadge = '<span style="font-size:11px;font-weight:800;color:#791f1f;background:#f7c1c1;padding:2px 8px;border-radius:7px;flex-shrink:0">'+(today-day)+'일 지남</span>';
      } else if(day){
        var dd = day-today;
        rightBadge = '<span style="font-size:11px;font-weight:800;color:'+(soon?'#854f0b':'#5f5e5a')+';background:'+(soon?'#fac775':'#f0f4f9')+';padding:2px 8px;border-radius:7px;flex-shrink:0">'+(dd===0?'오늘':'D-'+dd)+'</span>';
      } else {
        rightBadge = '';
      }
      return '<div class="rc-row" style="display:flex;align-items:center;gap:9px;padding:9px 10px;border:1.5px solid '+border+';background:'+bg+';border-radius:9px;margin-bottom:6px;'+(done?'opacity:.6':'')+'">'
        + '<input type="checkbox" class="rc-chk" data-id="'+esc(String(t.id))+'" '+(done?'checked':'')+' style="width:19px;height:19px;flex-shrink:0;cursor:pointer">'
        + '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:'+(RC_CAT_BG[t.cat]||RC_CAT_BG['기타'])+';color:'+(RC_CAT_FG[t.cat]||RC_CAT_FG['기타'])+';flex-shrink:0">'+esc(String(t.cat||'기타'))+'</span>'
        + '<span style="flex:1;min-width:0;font-size:14px;color:#1a2f45;'+(done?'text-decoration:line-through;color:#7a92a8':'')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(String(t.name||''))+(money?' <span style="font-size:12px;color:#7a92a8">'+money+'원</span>':'')+'</span>'
        + (day&&!done ? '<span style="font-size:11px;color:#aab8c8;flex-shrink:0">매월 '+day+'일</span>' : '')
        + rightBadge
        + ((done && t.cat==='전표') ? '<button class="rc-slip" data-id="'+esc(String(t.id))+'" type="button" style="font-size:11px;font-weight:700;color:#0f6e56;background:#e1f5ee;border:1px solid #9fe1cb;padding:3px 9px;border-radius:7px;cursor:pointer;font-family:inherit;flex-shrink:0;white-space:nowrap">🧾 전표 등록 →</button>' : '')
        + '</div>';
    }).join('');

    body.querySelectorAll('.rc-chk').forEach(function(cb){
      cb.addEventListener('change', function(){
        try{
          var id = cb.getAttribute('data-id');
          var t = rcList().find(function(x){ return x.id===id; });
          if(!t) return;
          var mon = rcCurMonth();
          var doneMap = Object.assign({}, t.done||{});
          var atMap = Object.assign({}, t.doneAt||{});
          if(cb.checked){ doneMap[mon]=true; atMap[mon]=todayStr().slice(5); }
          else { delete doneMap[mon]; delete atMap[mon]; }
          updateRecord(id, {done:doneMap, doneAt:atMap, updatedAt:Date.now()});
          renderRcBody();
          toast(cb.checked ? '✅ 완료 처리됨' : '완료 해제됨');
        }catch(err){ console.error('[반복업무 체크]', err); toast('오류: '+(err.message||err)); }
      });
    });

    /* 전표 등록 버튼 → 지출 탭 전표 입력창 자동채움 */
    body.querySelectorAll('.rc-slip').forEach(function(b){
      b.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        try{
          var t = rcList().find(function(x){ return x.id===b.getAttribute('data-id'); });
          if(!t) return;
          if(typeof openExpenseFromWork==='function'){
            openExpenseFromWork({
              workObj: {
                date: todayStr(),
                title: t.name || '',
                workVendor: t.vendor || '',
                workNote: t.memo || '',
                cost: t.amt || 0
              },
              expType: '후불청구'
            });
            /* 금액 자동 반영 (openExpenseFromWork는 금액을 0으로 두므로 보정) */
            setTimeout(function(){
              try{
                if(typeof expenseData==='object' && expenseData){
                  if(t.amt){ expenseData.amount = t.amt; }
                  var amtEl = document.getElementById('exp-amount');
                  if(amtEl && t.amt){ amtEl.value = Number(t.amt).toLocaleString('ko-KR'); }
                }
              }catch(_e){}
            }, 500);
          } else {
            toast('지출 탭 전표 기능을 찾을 수 없어요');
          }
        }catch(err){ console.error('[반복업무 전표연동]', err); toast('전표 연동 오류: '+(err.message||err)); }
      });
    });

    try{ if(typeof rcUpdateFabBadge==='function') rcUpdateFabBadge(); }catch(e){}
  }

  /* ---- 반복업무 관리 팝업 (추가/수정/삭제) ---- */
  var rcDrag = {x:0,y:0};
  function openRecurManage(){
    var old = document.getElementById('rcOverlay');
    if(old) old.remove();
    rcDrag = {x:0,y:0};
    var ov = document.createElement('div');
    ov.id='rcOverlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
    var sheet=document.createElement('div');
    sheet.id='rcSheet';
    sheet.style.cssText='background:#fff;border-radius:18px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.2)';
    ov.appendChild(sheet);
    document.body.appendChild(ov);
    renderRcManageList(sheet);
    /* 헤더 드래그 이동 */
    var dragging=false,sx=0,sy=0;
    ov.addEventListener('mousedown', function(e){
      var h=e.target.closest('.rc-drag-handle');
      if(!h||e.target.closest('button,a,input,select,textarea')) return;
      dragging=true; sx=e.clientX-rcDrag.x; sy=e.clientY-rcDrag.y; e.preventDefault();
    });
    ov.addEventListener('mousemove', function(e){
      if(!dragging) return;
      rcDrag.x=e.clientX-sx; rcDrag.y=e.clientY-sy;
      sheet.style.transform='translate('+rcDrag.x+'px,'+rcDrag.y+'px)';
    });
    ov.addEventListener('mouseup', function(){ dragging=false; });
  }

  function rcCloseModal(){ var o=document.getElementById('rcOverlay'); if(o) o.remove(); }

  /* 관리 목록 화면 */
  function renderRcManageList(sheet){
    var all = rcList().slice().sort(function(a,b){ return rcSortKey(a)-rcSortKey(b); });
    sheet.innerHTML =
      '<div class="rc-drag-handle" style="display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1.5px solid #e8f0fa;cursor:move;position:sticky;top:0;background:#fff;border-radius:18px 18px 0 0;z-index:2">'
        + '<span style="font-size:16px;font-weight:800;color:#1a2f45;flex:1">⚙️ 반복업무 관리</span>'
        + '<button id="rcAddNew" type="button" style="height:32px;padding:0 12px;border:none;border-radius:8px;background:#3f7cb8;color:#fff;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer">➕ 추가</button>'
        + '<button id="rcClose" type="button" style="height:32px;width:32px;border:none;border-radius:8px;background:#f0f4f9;color:#7a92a8;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer">✕</button>'
      + '</div>'
      + '<div style="padding:12px 18px 18px">'
        + '<div style="font-size:12px;color:#aab8c8;margin-bottom:10px">매월 반복되는 업무 목록입니다. 각 항목은 매달 자동으로 체크리스트에 뜹니다. 순서는 기한일 순.</div>'
        + (all.length ? '<div id="rcMgList"></div>'
            : '<div style="text-align:center;padding:30px 20px;color:#aab8c8;background:#f7faff;border-radius:12px;font-size:13px">아직 등록된 반복업무가 없어요<br>➕ 추가 버튼으로 첫 항목을 만들어보세요</div>')
      + '</div>';
    document.getElementById('rcClose').addEventListener('click', rcCloseModal);
    document.getElementById('rcAddNew').addEventListener('click', function(){ renderRcEdit(sheet, null); });
    var listHost = document.getElementById('rcMgList');
    if(listHost){
      function _rcRow(t){
        var done = rcIsDone(t);
        return '<div style="display:flex;align-items:center;gap:9px;padding:10px 12px;border:1.5px solid #e8f0fa;border-radius:10px;margin-bottom:6px;background:#fff;'+(done?'opacity:.6':'')+'">'
          + '<input type="checkbox" class="rc-mgchk" data-id="'+esc(String(t.id))+'" '+(done?'checked':'')+' title="이번 달 완료 체크" style="width:19px;height:19px;flex-shrink:0;cursor:pointer">'
          + '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:'+(RC_CAT_BG[t.cat]||RC_CAT_BG['기타'])+';color:'+(RC_CAT_FG[t.cat]||RC_CAT_FG['기타'])+';flex-shrink:0">'+esc(String(t.cat||'기타'))+'</span>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:14px;font-weight:600;color:#1a2f45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'+(done?'text-decoration:line-through;color:#7a92a8':'')+'">'+esc(String(t.name||''))+'</div>'
            + '<div style="font-size:11px;color:#aab8c8">'+(t.day?'매월 '+esc(String(t.day))+'일':'기한 미지정')+(rcMoney(t.amt)?' · '+rcMoney(t.amt)+'원':'')+'</div>'
          + '</div>'
          + '<button class="rc-edit" data-id="'+esc(String(t.id))+'" type="button" style="height:30px;padding:0 11px;border:1.5px solid #dbe6f4;border-radius:8px;background:#f7faff;color:#3f7cb8;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;flex-shrink:0">✏️ 수정</button>'
          + '<button class="rc-del" data-id="'+esc(String(t.id))+'" type="button" style="height:30px;padding:0 11px;border:1.5px solid #fde8e8;border-radius:8px;background:#fff;color:#e74c3c;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;flex-shrink:0">🗑</button>'
          + '</div>';
      }
      var _pend = all.filter(function(x){ return !rcIsDone(x); });
      var _done = all.filter(function(x){ return rcIsDone(x); });
      var _html = _pend.map(_rcRow).join('');
      if(!_pend.length){ _html += '<div style="text-align:center;padding:20px;color:#aab8c8;background:#f7faff;border-radius:12px;font-size:13px">이번 달 반복업무를 모두 완료했어요 🎉</div>'; }
      if(_done.length){
        _html += '<div style="margin-top:12px">'
          + '<button id="rcDoneToggle" type="button" style="width:100%;text-align:left;padding:8px 12px;border:1.5px dashed #cdd8e6;border-radius:9px;background:#f7faff;color:#7a92a8;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer">✓ 이번 달 완료 '+_done.length+'개 — 펼치기 ▾</button>'
          + '<div id="rcDoneList" style="display:none;margin-top:6px">'+_done.map(_rcRow).join('')+'</div>'
          + '</div>';
      }
      listHost.innerHTML = _html;
      var _dt=document.getElementById('rcDoneToggle');
      if(_dt){ _dt.addEventListener('click', function(){ var dl=document.getElementById('rcDoneList'); if(!dl) return; var open=dl.style.display!=='none'; dl.style.display=open?'none':'block'; _dt.textContent='✓ 이번 달 완료 '+_done.length+'개 — '+(open?'펼치기 ▾':'접기 ▴'); }); }
      listHost.querySelectorAll('.rc-mgchk').forEach(function(cb){
        cb.addEventListener('change', function(){
          try{
            var id=cb.getAttribute('data-id');
            var t=rcList().find(function(x){ return x.id===id; });
            if(!t) return;
            var mon=rcCurMonth();
            var doneMap=Object.assign({}, t.done||{});
            var atMap=Object.assign({}, t.doneAt||{});
            if(cb.checked){ doneMap[mon]=true; atMap[mon]=todayStr().slice(5); }
            else { delete doneMap[mon]; delete atMap[mon]; }
            updateRecord(id, {done:doneMap, doneAt:atMap, updatedAt:Date.now()});
            renderRcManageList(sheet);
            if(typeof renderRecurWidget==='function') renderRecurWidget();
            toast(cb.checked ? '✅ 완료 처리됨' : '완료 해제됨');
          }catch(err){ console.error('[반복업무 관리 체크]', err); toast('오류: '+(err.message||err)); }
        });
      });
      listHost.querySelectorAll('.rc-edit').forEach(function(b){
        b.addEventListener('click', function(){
          var t = rcList().find(function(x){ return x.id===b.getAttribute('data-id'); });
          renderRcEdit(sheet, t);
        });
      });
      listHost.querySelectorAll('.rc-del').forEach(function(b){
        b.addEventListener('click', function(){
          var id=b.getAttribute('data-id');
          var t = rcList().find(function(x){ return x.id===id; });
          if(!t) return;
          if(!confirm('"'+(t.name||'')+'" 반복업무를 삭제할까요?\n(이 업무가 목록에서 완전히 제거됩니다)')) return;
          deleteWithUndo(id, '반복업무');
          renderRcManageList(sheet);
          renderRecurWidget();
        });
      });
    }
  }

  /* 추가/수정 화면 */
  function renderRcEdit(sheet, t){
    var isNew = !t;
    var d = t || {name:'', cat:'전표', day:'', amt:0, memo:''};
    var INP='width:100%;box-sizing:border-box;height:38px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:9px;font-size:14px;font-family:inherit;background:#f7faff;outline:none';
    var LBL='display:block;font-size:12px;font-weight:700;color:#33567d;margin-bottom:3px';
    sheet.innerHTML =
      '<div class="rc-drag-handle" style="display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1.5px solid #e8f0fa;cursor:move;position:sticky;top:0;background:#fff;border-radius:18px 18px 0 0;z-index:2">'
        + '<span style="font-size:16px;font-weight:800;color:#1a2f45;flex:1">'+(isNew?'➕ 반복업무 추가':'✏️ 반복업무 수정')+'</span>'
        + '<button id="rcEditClose" type="button" style="height:32px;width:32px;border:none;border-radius:8px;background:#f0f4f9;color:#7a92a8;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer">✕</button>'
      + '</div>'
      + '<div style="padding:16px 18px 18px">'
        + '<div style="margin-bottom:12px"><label style="'+LBL+'">업무명 <span style="color:#e74c3c">*</span></label><input type="text" id="rcName" placeholder="예: 정수기 임차료, 전기요금 납부, 승강기 점검 전표" style="'+INP+'"></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'
          + '<div><label style="'+LBL+'">분류</label><select id="rcCat" style="'+INP+';padding:0 8px">'+RC_CATS.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('')+'</select></div>'
          + '<div><label style="'+LBL+'">매월 기한일</label><input type="number" id="rcDay" min="1" max="31" placeholder="예: 25" style="'+INP+'"></div>'
        + '</div>'
        + '<div style="margin-bottom:12px"><label style="'+LBL+'">금액 (선택)</label><input type="text" id="rcAmt" inputmode="numeric" placeholder="예: 45,000" style="'+INP+'"></div>'
        + '<div style="margin-bottom:12px"><label style="'+LBL+'">업체명 (선택 · 전표 자동채움에 사용)</label><input type="text" id="rcVendor" placeholder="예: 코웨이, 한국전력" style="'+INP+'"></div>'
        + '<div style="margin-bottom:4px"><label style="'+LBL+'">메모 (선택)</label><textarea id="rcMemo" rows="2" placeholder="업체·계좌·특이사항 등" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #dbe6f4;border-radius:9px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;resize:vertical"></textarea></div>'
        + '<div style="display:flex;gap:8px;margin-top:16px">'
          + '<button id="rcEditCancel" type="button" style="flex:1;height:46px;border:2px solid #dbe6f4;border-radius:12px;background:#f7faff;color:#7a92a8;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">취소</button>'
          + (isNew?'':'<button id="rcEditDel" type="button" style="flex:1;height:46px;border:2px solid #fde8e8;border-radius:12px;background:#fff;color:#e74c3c;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">🗑 삭제</button>')
          + '<button id="rcEditSave" type="button" style="flex:2;height:46px;border:none;border-radius:12px;background:#3f7cb8;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">💾 저장</button>'
        + '</div>'
      + '</div>';
    /* 값 주입 */
    document.getElementById('rcName').value = d.name||'';
    document.getElementById('rcCat').value = d.cat||'전표';
    document.getElementById('rcDay').value = d.day||'';
    document.getElementById('rcAmt').value = rcMoney(d.amt);
    document.getElementById('rcVendor').value = d.vendor||'';
    document.getElementById('rcMemo').value = d.memo||'';
    /* 금액 자동 콤마 */
    var amtEl = document.getElementById('rcAmt');
    amtEl.addEventListener('input', function(){ var n=amtEl.value.replace(/[^0-9]/g,''); amtEl.value=n?Number(n).toLocaleString('ko-KR'):''; });

    document.getElementById('rcEditClose').addEventListener('click', rcCloseModal);
    document.getElementById('rcEditCancel').addEventListener('click', function(){ renderRcManageList(sheet); });
    if(!isNew){
      document.getElementById('rcEditDel').addEventListener('click', function(){
        if(!confirm('"'+(t.name||'')+'" 반복업무를 삭제할까요?')) return;
        deleteWithUndo(t.id, '반복업무');
        renderRcManageList(sheet); renderRecurWidget();
      });
    }
    document.getElementById('rcEditSave').addEventListener('click', function(){
      try{
        var name = document.getElementById('rcName').value.trim();
        if(!name){ toast('업무명을 입력하세요'); return; }
        var dayRaw = document.getElementById('rcDay').value.trim();
        var day = dayRaw ? Math.max(1, Math.min(31, Number(dayRaw)||0)) : '';
        var patch = {
          kind:'recurTpl',
          name:name,
          cat: document.getElementById('rcCat').value||'전표',
          day: day,
          amt: Number(document.getElementById('rcAmt').value.replace(/[^0-9]/g,''))||0,
          vendor: document.getElementById('rcVendor').value.trim(),
          memo: document.getElementById('rcMemo').value.trim(),
          updatedAt: Date.now()
        };
        if(isNew){
          patch.done = {};
          patch.doneAt = {};
          patch.date = todayStr();
          patch.createdAt = Date.now();
          addRecord(patch);
          toast('📅 반복업무 추가됨');
        } else {
          updateRecord(t.id, patch);
          toast('💾 저장됨');
        }
        renderRcManageList(sheet);
        renderRecurWidget();
      }catch(err){ console.error('[반복업무 저장]', err); toast('저장 오류: '+(err.message||err)); }
    });
  }

  /* renderAll 래핑 — 클라우드 동기화·삭제복구 후 위젯도 갱신 */
  try{
    if(typeof renderAll === 'function' && !renderAll._rcWrapped){
      var _rcOrig = renderAll;
      renderAll = function(){
        _rcOrig();
        try{ if(document.getElementById('recurWidget')) renderRecurWidget(); }catch(e){}
        try{ if(typeof rcUpdateFabBadge==='function') rcUpdateFabBadge(); }catch(e){}
      };
      renderAll._rcWrapped = true;
      window.renderAll = renderAll;
    }
  }catch(e){ console.warn('[반복업무] renderAll 래핑 생략:', e); }

  /* FAB 알림 배지 — 기한 지난+임박(3일이내) 미완료 개수 */
  function rcUpdateFabBadge(){
    try{
      var fab = document.getElementById('v43FabHeader');
      if(!fab) return;
      var today = rcToday();
      var _pend = rcList().filter(function(t){ return !rcIsDone(t); });
      var total = _pend.length;
      var urgent = _pend.filter(function(t){
        var day = Number(t.day)||0;
        if(!day) return false;
        return day < today || (day>=today && (day-today)<=3);
      }).length;
      var badge = fab.querySelector('.rc-fab-badge');
      if(total<=0){ if(badge) badge.remove(); return; }
      if(!badge){
        badge = document.createElement('div');
        badge.className = 'rc-fab-badge';
        badge.style.cssText = 'position:absolute;bottom:-5px;left:-8px;min-width:22px;height:22px;padding:0 5px;box-sizing:border-box;background:#e74c3c;color:#fff;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;box-shadow:0 2px 8px rgba(231,76,60,.55);border:2px solid #fff;z-index:11;pointer-events:auto;cursor:pointer;line-height:1';
        fab.appendChild(badge);
        badge.addEventListener('click', function(ev){ ev.stopPropagation(); ev.preventDefault(); try{ openRecurManage(); }catch(e){} });
      }
      badge.textContent = total>99 ? '99+' : String(total);
      if(urgent>0){ badge.style.background='#c0392b'; badge.style.boxShadow='0 2px 10px rgba(192,57,43,.7)'; }
      else { badge.style.background='#f0a020'; badge.style.boxShadow='0 2px 8px rgba(240,160,32,.55)'; }
      badge.title = '이번 달 미완료 '+total+'건'+(urgent>0?' (임박·지난 '+urgent+'건)':'')+' — 클릭하면 반복업무 관리 열기';
    }catch(e){ console.warn('[반복업무 FAB배지]', e); }
  }

  window.renderRecurWidget = renderRecurWidget;
  window.openRecurManage = openRecurManage;
  window.rcUpdateFabBadge = rcUpdateFabBadge;

  setTimeout(function(){ try{ renderRecurWidget(); rcUpdateFabBadge(); }catch(e){} }, 950);
})();


/* ============================================================
   v44: 업무내역 자동완성 커스텀 드롭다운 (항목별 🗑 삭제 지원)
   - 브라우저 datalist는 항목 삭제 불가 → 커스텀 드롭다운으로 교체
   - 과거 업무내역(entries kind:work)에서 후보 생성
   - 🗑 누르면 해당 문구를 숨김목록(localStorage)에 추가 → 자동완성에서만 제외
   - 원본 업무 기록은 그대로 유지 (안전)
   - 한글 IME 안전: 입력란 DOM 보존, 드롭다운 박스만 갱신
   ============================================================ */
(function(){
  var HIDE_KEY = 'wl_title_hidden';

  function loadHidden(){
    try{ return JSON.parse(localStorage.getItem(HIDE_KEY)||'[]'); }catch(e){ return []; }
  }
  function saveHidden(arr){
    try{ localStorage.setItem(HIDE_KEY, JSON.stringify(arr)); }catch(e){}
  }
  function addHidden(text){
    var arr = loadHidden();
    if(arr.indexOf(text)<0){ arr.push(text); saveHidden(arr); }
  }

  /* 후보 목록: 과거 업무내역 - 숨김목록 */
  function titleCandidates(){
    var hidden = loadHidden();
    var set = {};
    try{
      entries.forEach(function(e){
        if(e.kind==='work' && e.title){
          /* refMonth가 있으면 순수 title만, 없으면 "N월 " 접두어 제거한 것도 추가 */
          var t=e.title;
          set[t]=1;
          if(e.refMonth){
            set[t]=1; /* refMonth 있으면 title이 이미 순수 내용 */
          } else {
            var m=t.match(/^(\d{1,2})월\s+(.+)$/);
            if(m) set[m[2]]=1; /* "6월 수도요금" → "수도요금" 도 후보에 */
          }
        }
      });
    }catch(e){}
    return Object.keys(set).filter(function(t){ return hidden.indexOf(t)<0; }).sort();
  }

  function acBox(){ return document.getElementById('titleAcBox'); }
  function acInput(){ return document.getElementById('m-title'); }

  function hideBox(){ var b=acBox(); if(b){ b.style.display='none'; b.innerHTML=''; } }

  function renderBox(filter){
    var box = acBox(); var inp = acInput();
    if(!box || !inp) return;
    var q = (filter||'').trim().toLowerCase();
    var list = titleCandidates();
    if(q){
      list = list.filter(function(t){ return t.toLowerCase().indexOf(q)>=0; });
    }
    list = list.slice(0, 40);
    if(!list.length){ hideBox(); return; }
    box.innerHTML = list.map(function(t){
      return '<div class="tac-item" data-val="'+esc(t)+'" style="display:flex;align-items:center;gap:8px;padding:9px 10px;cursor:pointer;border-bottom:1px solid #f0f4f9">'
        + '<span class="tac-pick" data-val="'+esc(t)+'" style="flex:1;min-width:0;font-size:14px;color:#1a2f45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(t)+'</span>'
        + '<button type="button" class="tac-del" data-val="'+esc(t)+'" title="자동완성 목록에서 지우기" style="flex-shrink:0;width:28px;height:28px;border:1.5px solid #fde8e8;border-radius:7px;background:#fff;color:#e74c3c;font-size:13px;cursor:pointer;font-family:inherit;line-height:1">🗑</button>'
        + '</div>';
    }).join('');
    box.style.display='block';

    box.querySelectorAll('.tac-pick').forEach(function(el){
      el.addEventListener('mousedown', function(ev){
        ev.preventDefault();
        var v = el.getAttribute('data-val');
        var mm = v.match(/^(\d{1,2})월\s+(.+)$/);
        if(mm){
          inp.value = mm[2];
          var rm = document.getElementById('m-refMonth');
          if(rm) rm.value = mm[1];
        } else {
          inp.value = v;
        }
        hideBox();
        inp.focus();
      });
    });
    box.querySelectorAll('.tac-del').forEach(function(el){
      el.addEventListener('mousedown', function(ev){
        ev.preventDefault(); ev.stopPropagation();
        var v = el.getAttribute('data-val');
        if(!confirm('"'+v+'"\n이 문구를 업무내역 자동완성 목록에서 지울까요?\n(과거 업무 기록 자체는 지워지지 않아요)')) return;
        addHidden(v);
        renderBox(inp.value);
        if(typeof toast==='function') toast('자동완성에서 제외됨');
      });
    });
  }

  /* renderWorkModal이 열릴 때마다 호출됨 — 입력란에 1회만 바인딩 */
  function bindTitleAc(){
    var inp = acInput();
    if(!inp || inp._acBound) return;
    inp._acBound = true;
    inp.addEventListener('focus', function(){ renderBox(inp.value); });
    inp.addEventListener('input', function(){ renderBox(inp.value); });
    inp.addEventListener('blur', function(){ setTimeout(hideBox, 150); });
    inp.addEventListener('keydown', function(ev){ if(ev.key==='Escape'){ hideBox(); } });
  }

  /* renderWorkModal 래핑 — 모달 렌더 후 자동 바인딩 */
  try{
    if(typeof renderWorkModal === 'function' && !renderWorkModal._acWrapped){
      var _origRWM = renderWorkModal;
      renderWorkModal = function(){
        var r = _origRWM.apply(this, arguments);
        setTimeout(bindTitleAc, 60);
        return r;
      };
      renderWorkModal._acWrapped = true;
      window.renderWorkModal = renderWorkModal;
    }
  }catch(e){ console.warn('[업무내역 자동완성] renderWorkModal 래핑 실패:', e); }

  window.bindTitleAc = bindTitleAc;
})();


/* ══════════════════════════════════════════════════════════════════════
   ✅ 자가 점검  (v75-0828-1144)
   · 파일을 올린 직후 "안 깨졌는지"를 버튼 한 번으로 확인한다.
   · 기준선(정상 상태)은 localStorage 'wl_selfcheck_base' 에 저장한다.
     버전이 올라가 숫자가 달라지면 [정상으로 기록]을 눌러 새 기준을 잡는다.
   · 진단 탭 안에서만 동작하고, 새 script / style 블록을 만들지 않는다.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var BASE_KEY = 'wl_selfcheck_base';

  /* ── 값 읽기 도우미 (전역 let 변수는 반드시 try 로 감싼다) ───────────── */
  function safe(fn, dflt){ try{ var v=fn(); return (v===undefined||v===null)?dflt:v; }catch(e){ return dflt; } }
  function esc2(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function stamp(){ var d=safe(function(){ return kstNow(); }, new Date(Date.now()+9*36e5));
    return d.toISOString().slice(0,16).replace('T',' '); }

  /* ── 현재 상태 측정 ──────────────────────────────────────────────── */
  function measure(){
    var m = {};

    m.appVer = safe(function(){ return window.APP_VERSION || ''; }, '');

    var tag = document.querySelector('script[src*="worklog.js?v="]');
    m.jsTag = tag ? (tag.getAttribute('src').split('?v=')[1] || '') : '';

    var link = document.getElementById('main-css');
    m.cssHref = link ? (link.getAttribute('href') || '') : '';

    m.sheets = 0; m.rules = 0; m.blocked = 0;
    for (var i = 0; i < document.styleSheets.length; i++){
      m.sheets++;
      try { m.rules += document.styleSheets[i].cssRules.length; }
      catch(e){ m.blocked++; }                       /* 외부 CDN 은 셀 수 없음 */
    }

    var list = document.getElementById('v43List');
    if (list){
      var cs = getComputedStyle(list);
      m.listDisplay = cs.display;
      m.listCols = (cs.gridTemplateColumns || '').split(' ').filter(Boolean).length;
    } else { m.listDisplay = '없음'; m.listCols = 0; }

    var fb = document.querySelector('.btn-action');
    if (fb){
      var fs = getComputedStyle(fb);
      m.btnRadius = parseInt(fs.borderRadius, 10) || 0;
      m.btnHeight = Math.round(fb.getBoundingClientRect().height) || 0;
    } else { m.btnRadius = -1; m.btnHeight = -1; }

    /* localStorage 사용량 + 키별 상세
       ※ 이 저장소는 같은 주소(20251014peru-gif.github.io)의 모든 앱이 함께 씁니다.
          그래서 다른 앱이 쓴 키까지 여기 용량에 잡힙니다. */
    var bytes = 0, keys = 0, mineB = 0, otherB = 0, list = [];
    function isMine(k){
      return /^wl_/.test(k) || /^v43_/.test(k) ||
             k === 'shared_pin' || k === 'sticky_view' || k === '_ghToken' ||
             /^_itemMemo/.test(k);
    }
    try {
      for (var k in localStorage){
        if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
        var raw = String(localStorage[k]);
        var b = (k.length + raw.length) * 2;
        keys++; bytes += b;
        var mine = isMine(k);
        if (mine) mineB += b; else otherB += b;
        var cnt = null;
        if (raw.charAt(0) === '[') { try { var arr = JSON.parse(raw); if (arr && arr.length !== undefined) cnt = arr.length; } catch(e){} }
        list.push({ k:k, kb:Math.round(b/1024), mine:mine, n:cnt });
      }
    } catch(e){}
    list.sort(function(a,b2){ return b2.kb - a.kb; });
    m.lsKeys  = keys;
    m.lsMB    = Math.round(bytes / 1048576 * 100) / 100;
    m.lsMineMB  = Math.round(mineB / 1048576 * 100) / 100;
    m.lsOtherMB = Math.round(otherB / 1048576 * 100) / 100;
    m.lsList  = list;

    /* 제일 큰 키 안에서 어느 항목이 용량을 먹는지 */
    m.lsTopField = null;
    try {
      var top = list[0];
      if (top && top.kb > 300){
        var arr2 = JSON.parse(localStorage.getItem(top.k) || 'null');
        if (arr2 && arr2.length && typeof arr2[0] === 'object'){
          var f = {};
          for (var z = 0; z < arr2.length; z++){
            for (var key2 in arr2[z]){
              if (!Object.prototype.hasOwnProperty.call(arr2[z], key2)) continue;
              var v2 = arr2[z][key2];
              f[key2] = (f[key2] || 0) + (typeof v2 === 'string' ? v2.length : JSON.stringify(v2 || '').length) * 2;
            }
          }
          var fl = [];
          for (var fk in f) fl.push({ f:fk, kb:Math.round(f[fk]/1024) });
          fl.sort(function(a,b3){ return b3.kb - a.kb; });
          m.lsTopField = { key:top.k, n:arr2.length, fields:fl.slice(0,6) };
        }
      }
    } catch(e){}

    /* 데이터 건수 */
    var ents = safe(function(){ return entries; }, null) || safe(function(){ return window.entries; }, null) || [];
    m.entCount = ents.length;
    var kinds = {};
    for (var n = 0; n < ents.length; n++){
      var kd = ents[n] && ents[n].kind ? ents[n].kind : 'work';
      kinds[kd] = (kinds[kd] || 0) + 1;
    }
    m.kinds = kinds;
    m.kindCount = Object.keys(kinds).length;

    /* 필수 함수 */
    var need = {
      renderAll:       function(){ return typeof renderAll; },
      renderWorkModal: function(){ return typeof renderWorkModal; },
      toast:           function(){ return typeof toast; },
      kstNow:          function(){ return typeof kstNow; },
      esc:             function(){ return typeof esc; },
      won:             function(){ return typeof won; },
      todayStr:        function(){ return typeof todayStr; }
    };
    m.missing = [];
    for (var nm in need){
      var t = 'undefined';
      try { t = need[nm](); } catch(e){ t = 'undefined'; }
      if (t !== 'function' && typeof window[nm] !== 'function') m.missing.push(nm);
    }

    m.errCount = safe(function(){ return errorLog.length; }, 0);
    m.fbReady  = safe(function(){ return (typeof firebase !== 'undefined' && !!firebase.apps.length); }, false);

    return m;
  }

  /* ── 판정 ────────────────────────────────────────────────────────── */
  function judge(m, base){
    var R = [];
    function row(name, state, value, hint){ R.push({name:name, state:state, value:value, hint:hint||''}); }

    /* 1. 버전 일치 */
    var appNum = String(m.appVer).replace(/^v/, '').split('-')[0];
    var tagNum = String(m.jsTag).split('t')[0].split('-')[0];
    row('버전 일치',
        (appNum && tagNum && appNum === tagNum) ? 'ok' : 'fail',
        'HTML ' + (m.appVer || '?') + '  /  worklog.js ?v=' + (m.jsTag || '없음'),
        'worklog.html 의 &lt;script src="worklog.js?v=…"&gt; 번호를 APP_VERSION 과 맞추세요');

    /* 2. CSS 캐시 주소 */
    var cssOk = m.cssHref.indexOf(appNum) >= 0;
    row('CSS 캐시 주소', cssOk ? 'ok' : 'fail', m.cssHref || '링크 없음',
        'CSS 주소에 현재 버전이 안 들어갔습니다. 옛 디자인이 그대로 보일 수 있어요');

    /* 3. 스타일시트 로드 */
    row('스타일시트', m.sheets >= 6 ? 'ok' : 'warn',
        m.sheets + '개 로드 (외부 ' + m.blocked + '개는 셀 수 없음)',
        '평소보다 적으면 CSS 파일이 안 올라갔을 수 있습니다');

    /* 4. CSS 규칙 수 — 기준선 대비 */
    if (base && base.rules){
      var diff = m.rules - base.rules;
      var st = (Math.abs(diff) <= 3) ? 'ok' : (diff < -20 ? 'fail' : 'warn');
      row('CSS 규칙 수', st,
          m.rules + '개 (기준 ' + base.rules + '개, ' + (diff >= 0 ? '+' : '') + diff + ')',
          diff < 0 ? '규칙이 줄었습니다 — style 블록의 중괄호 { } 짝이 맞는지 확인하세요' : 'CSS를 늘렸다면 정상입니다. [정상으로 기록]을 눌러 기준을 갱신하세요');
    } else {
      row('CSS 규칙 수', 'none', m.rules + '개', '아직 기준이 없습니다 — [정상으로 기록]을 한 번 눌러두세요');
    }

    /* 5. 기록 목록 그리드 */
    var gOk = (m.listDisplay === 'grid' && m.listCols >= 2);
    row('기록 목록 배치', m.listDisplay === '없음' ? 'none' : (gOk ? 'ok' : 'fail'),
        m.listDisplay + ' · ' + m.listCols + '열',
        '한 줄씩 나온다면 CSS가 죽은 것입니다 — 중괄호 짝을 확인하세요');

    /* 6. 필터 버튼 스타일 */
    var btnState = (m.btnRadius < 0 || m.btnHeight <= 0) ? 'none'
                 : (m.btnRadius >= 6 ? 'ok' : 'fail');
    row('필터 버튼 모양', btnState,
        m.btnRadius < 0  ? '버튼 없음(다른 탭)'
      : m.btnHeight <= 0 ? '지금 화면에 안 보여서 판정 보류 (기록 탭에서 다시 눌러보세요)'
      : ('모서리 ' + m.btnRadius + 'px · 높이 ' + m.btnHeight + 'px'),
        '모서리가 0px 이면 기본 브라우저 버튼으로 돌아간 것 — CSS가 죽었습니다');

    /* 7. 필수 함수 */
    row('필수 기능', m.missing.length === 0 ? 'ok' : 'fail',
        m.missing.length === 0 ? '7개 모두 정상' : ('없음: ' + m.missing.join(', ')),
        'worklog.js 가 안 올라갔거나 문법 오류로 멈춘 상태입니다');

    /* 8. 저장 공간 */
    var lsSt = m.lsMB >= 4.5 ? 'fail' : (m.lsMB >= 3.5 ? 'warn' : 'ok');
    row('저장 공간', lsSt,
        m.lsMB + 'MB (업무일지 ' + m.lsMineMB + ' + 다른 앱 ' + m.lsOtherMB + ') · 키 ' + m.lsKeys + '개',
        '이 저장소는 같은 주소의 모든 앱이 함께 씁니다. 아래 상세에서 큰 것부터 정리하세요');

    /* 9. 데이터 건수 */
    if (base && base.entCount){
      var d2 = m.entCount - base.entCount;
      var eSt = (d2 < -10) ? 'fail' : 'ok';
      row('데이터 건수', eSt, m.entCount + '건 (기준 ' + base.entCount + '건, ' + (d2 >= 0 ? '+' : '') + d2 + ')',
          '크게 줄었다면 동기화 사고일 수 있습니다 — 되돌리기 전에 백업부터 받으세요');
    } else {
      row('데이터 건수', m.entCount > 0 ? 'ok' : 'warn', m.entCount + '건 · 종류 ' + m.kindCount + '가지',
          '0건이면 아직 안 불러왔거나 연결이 끊긴 상태입니다');
    }

    /* 10. 파이어베이스 */
    row('클라우드 연결', m.fbReady ? 'ok' : 'warn', m.fbReady ? '연결됨' : '아직 연결 안 됨',
        '인터넷이 끊겼거나 초기화 전일 수 있습니다');

    /* 11. 오류 기록 */
    row('오류 기록', m.errCount === 0 ? 'ok' : (m.errCount >= 5 ? 'fail' : 'warn'),
        m.errCount + '건',
        '위 [오류기록 지우기] 로 비운 뒤 다시 눌러보면 새로 생기는 오류만 볼 수 있습니다');

    return R;
  }

  /* ── 그리기 ──────────────────────────────────────────────────────── */
  var STYLE = {
    ok:   { bg:'#e9f6ef', bd:'#2f7d6e', fg:'#20614f', tx:'통과' },
    warn: { bg:'#fdf4e3', bd:'#c08a19', fg:'#8a6209', tx:'주의' },
    fail: { bg:'#fdeceb', bd:'#c0392b', fg:'#a02c22', tx:'확인' },
    none: { bg:'#f1f5f9', bd:'#94a3b8', fg:'#64748b', tx:'—'   }
  };

  function render(){
    var host = document.getElementById('scResult');
    if (!host) return;
    var base = null;
    try { base = JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); } catch(e){}

    var m = measure();
    var rows = judge(m, base);

    var nFail = 0, nWarn = 0;
    for (var i = 0; i < rows.length; i++){
      if (rows[i].state === 'fail') nFail++;
      else if (rows[i].state === 'warn') nWarn++;
    }

    var head = nFail ? { bg:'#fdeceb', bd:'#c0392b', fg:'#a02c22', msg:'확인이 필요한 항목이 ' + nFail + '개 있습니다' }
             : nWarn ? { bg:'#fdf4e3', bd:'#c08a19', fg:'#8a6209', msg:'주의 항목이 ' + nWarn + '개 있습니다' }
                     : { bg:'#e9f6ef', bd:'#2f7d6e', fg:'#20614f', msg:'모든 항목 정상입니다' };

    var html = '<div style="border:1.5px solid ' + head.bd + ';background:' + head.bg +
               ';border-radius:10px;padding:12px 14px;margin-bottom:10px;color:' + head.fg +
               ';font-size:15px;font-weight:700">' + esc2(head.msg) +
               '<span style="font-weight:400;font-size:12.5px;margin-left:8px;opacity:.8">' +
               esc2(m.appVer) + ' · ' + esc2(stamp()) + '</span></div>';

    html += '<div style="border:1.5px solid #e6edf3;border-radius:10px;overflow:hidden">';
    for (var r = 0; r < rows.length; r++){
      var it = rows[r], st = STYLE[it.state] || STYLE.none;
      var showHint = (it.state === 'fail' || it.state === 'warn' || it.state === 'none');
      html += '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;' +
              (r ? 'border-top:1px solid #f1f5f9;' : '') + 'background:#fff">' +
                '<span style="flex:0 0 auto;min-width:44px;text-align:center;font-size:12px;font-weight:700;' +
                  'padding:3px 8px;border-radius:6px;border:1px solid ' + st.bd + ';background:' + st.bg + ';color:' + st.fg + '">' +
                  st.tx + '</span>' +
                '<div style="flex:1;min-width:0">' +
                  '<div style="font-size:14px;font-weight:700;color:#243b53">' + esc2(it.name) + '</div>' +
                  '<div style="font-size:13px;color:#486581;word-break:break-all">' + esc2(it.value) + '</div>' +
                  (showHint && it.hint ? '<div style="font-size:12.5px;color:' + st.fg + ';margin-top:3px">→ ' + it.hint + '</div>' : '') +
                '</div>' +
              '</div>';
    }
    html += '</div>';

    /* 저장 공간 상세 — 주의/확인일 때만 자동으로 펼친다 */
    var lsBad = (m.lsMB >= 3.5);
    if (lsBad && m.lsList && m.lsList.length){
      html += '<div style="margin-top:12px;border:1.5px solid #c08a19;border-radius:10px;overflow:hidden">' +
              '<div style="background:#fdf4e3;color:#8a6209;font-size:14px;font-weight:700;padding:9px 12px">' +
              '📦 저장 공간 상세 — 큰 것부터</div>';
      var shown = m.lsList.slice(0, 12);
      for (var s = 0; s < shown.length; s++){
        var it2 = shown[s];
        var who = it2.mine
          ? '<span style="color:#20614f;background:#e9f6ef;border:1px solid #2f7d6e;border-radius:5px;padding:1px 6px;font-size:11.5px">업무일지</span>'
          : '<span style="color:#8a6209;background:#fdf4e3;border:1px solid #c08a19;border-radius:5px;padding:1px 6px;font-size:11.5px">다른 앱</span>';
        html += '<div style="display:flex;gap:8px;align-items:center;padding:8px 12px;background:#fff;' +
                (s ? 'border-top:1px solid #f1f5f9;' : '') + '">' +
                  '<span style="flex:0 0 auto">' + who + '</span>' +
                  '<span style="flex:1;min-width:0;font-size:13px;color:#243b53;word-break:break-all">' + esc2(it2.k) +
                    (it2.n !== null ? ' <span style="color:#829ab1">(' + it2.n + '건)</span>' : '') + '</span>' +
                  '<b style="flex:0 0 auto;font-size:13.5px;color:' + (it2.kb >= 500 ? '#a02c22' : '#486581') + '">' +
                    (it2.kb >= 1024 ? (Math.round(it2.kb/102.4)/10 + 'MB') : (it2.kb + 'KB')) + '</b>' +
                '</div>';
      }
      if (m.lsTopField){
        html += '<div style="padding:9px 12px;background:#fbfcfd;border-top:1px solid #e6edf3;font-size:12.5px;color:#486581">' +
                '가장 큰 <b>' + esc2(m.lsTopField.key) + '</b> (' + m.lsTopField.n + '건) 안에서 용량을 먹는 항목 &nbsp;';
        for (var g = 0; g < m.lsTopField.fields.length; g++){
          html += '<span style="display:inline-block;background:#f1f5f9;border-radius:6px;padding:2px 8px;margin:0 4px 4px 0">' +
                  esc2(m.lsTopField.fields[g].f) + ' <b>' + m.lsTopField.fields[g].kb + 'KB</b></span>';
        }
        html += '</div>';
      }
      html += '<div style="padding:9px 12px;background:#fffdf7;border-top:1px solid #f1e6cc;font-size:12.5px;color:#8a6209;line-height:1.8">' +
              '이 저장소는 <b>같은 주소를 쓰는 모든 앱이 함께 씁니다.</b> 「다른 앱」 표시가 붙은 키는 업무일지가 만든 것이 아니므로, ' +
              '그 앱에서 정리하거나 <b>클라우드에 원본이 있는 캐시인지 먼저 확인한 뒤</b> 지우세요.</div>';
      html += '</div>';
    }

    /* 종류별 건수 */
    var ks = Object.keys(m.kinds).sort(function(a, b){ return m.kinds[b] - m.kinds[a]; });
    if (ks.length){
      html += '<div style="margin-top:10px;font-size:12.5px;color:#627d98;line-height:1.9">종류별 건수 &nbsp;';
      for (var q = 0; q < ks.length; q++){
        html += '<span style="display:inline-block;background:#f1f5f9;border-radius:6px;padding:2px 8px;margin:0 4px 4px 0">' +
                esc2(ks[q]) + ' <b style="color:#243b53">' + m.kinds[ks[q]] + '</b></span>';
      }
      html += '</div>';
    }

    host.innerHTML = html;
    var sp = document.getElementById('scStamp');
    if (sp) sp.textContent = '마지막 점검 ' + stamp();
    return { m:m, fail:nFail, warn:nWarn };
  }

  function saveBase(){
    var m = measure();
    try {
      localStorage.setItem(BASE_KEY, JSON.stringify({
        ver: m.appVer, rules: m.rules, sheets: m.sheets,
        entCount: m.entCount, at: stamp()
      }));
      if (typeof toast === 'function') toast('현재 상태를 정상 기준으로 기록했습니다');
    } catch(e){
      if (typeof toast === 'function') toast('기준 기록 실패: ' + (e.message || e));
    }
    render();
  }

  /* ── 버튼 연결 (중복 바인딩 방지) ──────────────────────────────────── */
  function bind(){
    var b1 = document.getElementById('scRun');
    if (b1 && !b1._bound){ b1._bound = true; b1.addEventListener('click', function(){ render(); }); }
    var b2 = document.getElementById('scBase');
    if (b2 && !b2._bound){ b2._bound = true; b2.addEventListener('click', saveBase); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  setTimeout(bind, 1500);

  window.wlSelfCheck = render;
  window.wlSelfCheckBase = saveBase;
})();


/* ══════════════════════════════════════════════════════════════════════
   📄 기록을 누르면 페이지로 열기   (v80-0828-1600)
   · 목록 클릭 → 예전 입력창 대신 노션식 페이지가 열린다.
   · 페이지 안 [✏️ 전체 서식] 을 누르면 예전 입력창도 그대로 쓸 수 있다.
   · 진단 탭 「기록을 누르면」 에서 언제든 되돌릴 수 있다 (localStorage wl_open_as_page)
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var LS = 'wl_open_as_page';
  /* 페이지가 감당하는 종류만 — 나머지는 예전 창 그대로 */
  var KINDS = { work:1, expense:1, memo:1, call:1, schedule:1, deliver:1, vacation:1,
                meeting:1, accident:1, progress:1, item:1, stock:1, plan:1, site:1 };

  /* modal(기본) | page | old  — 예전 값 '1'/'0' 도 그대로 읽는다 */
  function openStyle(){
    try{
      var v=localStorage.getItem(LS);
      if(v==='0' || v==='old')  return 'old';
      if(v==='page')            return 'page';
      if(v==='modal')           return 'modal';
      return 'modal';                      /* 처음이거나 예전 '1' → 창(모달) */
    }catch(e){ return 'modal'; }
  }
  function usesPage(){ return openStyle()!=='old'; }
  function setUsesPage(v){
    var s = (v===true) ? 'modal' : (v===false ? 'old' : String(v||'modal'));
    try{ localStorage.setItem(LS, s); }catch(e){}
    paint();
    if(typeof toast==='function') toast(
      s==='modal' ? '🗔 기록을 누르면 창으로 열립니다'
    : s==='page'  ? '📄 기록을 누르면 전체 페이지로 열립니다'
                  : '🗒 기록을 누르면 예전 입력창이 열립니다');
  }

  /* ── openViewer 를 감싼다 (원래 함수는 그대로 살려둔다) ── */
  try{
    if(typeof openViewer === 'function' && !openViewer._pgWrapped){
      var _origViewer = openViewer;
      openViewer = function(kind, id){
        try{
          if(usesPage() && KINDS[kind] && id && typeof window.wlGoPage === 'function'){
            window.wlGoPage(id, openStyle()==='modal');
            return;
          }
        }catch(e){ console.warn('[페이지 열기] 실패 — 예전 창으로', e); }
        return _origViewer.apply(this, arguments);
      };
      openViewer._pgWrapped = true;
      window.openViewer = openViewer;
    }
    /* 목록의 [수정]·달력의 바로수정도 같은 화면으로 보낸다.
       페이지 안 [✏️ 전체 서식] 은 일부러 예전 창을 부르므로 그때만 비켜준다. */
    if(typeof openEditor === 'function' && !openEditor._pgWrapped){
      var _origEd = openEditor;
      openEditor = function(kind, id){
        var force = !!window._wlForceOld;
        window._wlForceOld = false;
        try{
          if(!force && id && KINDS[kind] && usesPage() && typeof window.wlGoPage === 'function'){
            window.wlGoPage(id, openStyle()==='modal');
            return;
          }
        }catch(e){ console.warn('[페이지 열기] 수정 경로 실패 — 예전 창으로', e); }
        return _origEd.apply(this, arguments);
      };
      openEditor._pgWrapped = true;
      window.openEditor = openEditor;
    }
  }catch(e){ console.warn('[페이지 열기] 감싸기 실패', e); }

  /* ── 진단 탭 버튼 ── */
  var OPMAP = { opAsWin:'modal', opAsPage:'page', opAsModal:'old' };
  function paint(){
    var s = openStyle();
    for(var k in OPMAP){
      var el=document.getElementById(k); if(!el) continue;
      el.className = 'btn btn-sm ' + (s===OPMAP[k] ? 'btn-primary' : 'btn-ghost');
      el.style.minHeight='44px';
    }
    var n=document.getElementById('opNow');
    if(n) n.textContent = '지금: ' + (s==='modal' ? '창(모달)으로 열림'
                                    : s==='page' ? '전체 페이지로 열림' : '예전 입력창으로 열림');
  }
  function bind(){
    for(var k in OPMAP){
      (function(id, val){
        var el=document.getElementById(id);
        if(el && !el._bound){ el._bound=1; el.addEventListener('click', function(){ setUsesPage(val); }); }
      })(k, OPMAP[k]);
    }
    paint();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  setTimeout(bind, 1500);

  /* ── 📦 저장된 자재에서 하나 고르기 (페이지용) ──
     고르면 {name, spec, unit, price, qty} 를 돌려준다.
     ⚠ 한글 IME — 검색칸은 다시 만들지 않고 결과 영역만 다시 그린다 */
  window.wlPickItem = function(onPick, prefill){
    var items = [];
    try{ items = (entries||[]).filter(function(e){ return e && e.kind==='item' && e.itemName; }); }
    catch(e){ console.warn('[자재 고르기] 목록을 못 읽었어요', e); }
    function ES(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    var ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:rgba(12,26,42,.45);z-index:10050;'
      + 'display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:16px;width:min(94vw,600px);max-height:88vh;'
      + 'display:flex;flex-direction:column;box-shadow:0 18px 60px rgba(20,40,64,.3);padding:18px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      +   '<b style="font-size:16px;color:#1a2f45">📦 저장된 자재에서 고르기</b>'
      +   '<button type="button" id="ipX" style="border:none;background:none;font-size:21px;'
      +     'color:#94a3b8;cursor:pointer;min-height:44px;min-width:44px">✕</button></div>'
      + '<input type="text" id="ipQ" placeholder="자재명 · 규격 · 제조원으로 검색" autocomplete="off"'
      +   ' style="width:100%;box-sizing:border-box;padding:11px 13px;font-size:14px;'
      +   'border:1.5px solid #dbe6f4;border-radius:10px;font-family:inherit;min-height:44px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin:10px 2px 8px">'
      +   '<span style="font-size:12.5px;color:#7a92a8;font-weight:800">수량</span>'
      +   '<input type="number" id="ipQty" value="1" min="1" style="width:88px;box-sizing:border-box;'
      +     'padding:8px 10px;font-size:14px;border:1.5px solid #dbe6f4;border-radius:9px;font-family:inherit">'
      +   '<span style="font-size:12px;color:#a8b8c8">고르면 규격도 함께 채워집니다</span></div>'
      + '<div id="ipList" style="overflow:auto;flex:1;min-height:120px"></div></div>';
    document.body.appendChild(ov);
    function close(){ try{ ov.remove(); }catch(e){} document.removeEventListener('keydown', onEsc); }
    function onEsc(e){ if(e.key==='Escape') close(); }
    document.addEventListener('keydown', onEsc);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) close(); });
    var xb=ov.querySelector('#ipX'); if(xb) xb.addEventListener('click', close);
    var qEl=ov.querySelector('#ipQ'), listEl=ov.querySelector('#ipList'), qtyEl=ov.querySelector('#ipQty');
    if(prefill) qEl.value = prefill;
    function draw(){
      var q=String(qEl.value||'').trim().toLowerCase();
      var rows = q ? items.filter(function(it){
        return [it.itemName, it.spec, it.maker, it.vendor, it.unit].join(' ').toLowerCase().indexOf(q)>=0;
      }) : items;
      var show = rows.slice(0,200);
      if(!show.length){
        listEl.innerHTML='<div style="padding:26px 8px;text-align:center;color:#a8b8c8;font-size:13.5px">'
          + (items.length? '찾는 자재가 없어요' : '자재 탭에 등록된 자재가 없어요') + '</div>';
        return;
      }
      listEl.innerHTML = show.map(function(it){
        return '<div data-ipid="'+ES(it.id)+'" style="border:1.5px solid #eaf1f9;border-radius:11px;'
          + 'padding:10px 12px;margin-bottom:7px;cursor:pointer;min-height:44px">'
          + '<b style="font-size:14px;color:#1a2f45">'+ES(it.itemName)+'</b>'
          + '<div style="margin-top:4px;font-size:12px;color:#7a92a8">'
          +   (it.spec? ES(it.spec) : '규격 없음')
          +   (it.unit? ' · '+ES(it.unit) : '')
          +   (Number(it.unitPrice)? ' · '+Number(it.unitPrice).toLocaleString('ko-KR')+'원' : '')
          + '</div></div>';
      }).join('');
      [].forEach.call(listEl.querySelectorAll('[data-ipid]'), function(row){
        row.addEventListener('click', function(){
          var it = items.filter(function(x){ return x.id===row.getAttribute('data-ipid'); })[0];
          if(!it) return;
          var qty = Number(qtyEl.value)||1;
          close();
          try{ onPick({ id:it.id, name:(it.itemName||''), spec:(it.spec||''),
                        unit:(it.unit||''), price:Number(it.unitPrice)||0, qty:qty }); }
          catch(e){ console.error('[자재 고르기]', e); }
        });
        row.addEventListener('mouseenter', function(){ row.style.background='#f6faff'; row.style.borderColor='#cfe0f3'; });
        row.addEventListener('mouseleave', function(){ row.style.background=''; row.style.borderColor='#eaf1f9'; });
      });
    }
    qEl.addEventListener('input', draw);
    draw();
    setTimeout(function(){ try{ qEl.focus(); }catch(e){} }, 60);
  };

  /* ── 📦 저장된 자재에서 여러 개 담기 (페이지용) ──
     onDone([{id,name,spec,unit,price,qty}, …]) 을 부른다. 취소하면 안 부른다. */
  window.wlPickMats = function(onDone, initial){
    var MAX = (typeof MAT_MAX==='number') ? MAT_MAX : 5;
    var items = [];
    try{ items = (entries||[]).filter(function(e){ return e && e.kind==='item' && e.itemName; }); }
    catch(e){ console.warn('[자재 담기] 목록을 못 읽었어요', e); }
    var bag = (Array.isArray(initial)? initial : []).slice(0, MAX).map(function(m){
      return { id:m.id||'', name:m.name||'', spec:m.spec||'', unit:m.unit||'',
               price:Number(m.price)||0, qty:Number(m.qty)||1 };
    });
    function ES(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function won(n){ n=Number(n)||0; return n.toLocaleString('ko-KR'); }
    function sum(){ return bag.reduce(function(a,m){ return a + (Number(m.price)||0)*(Number(m.qty)||1); }, 0); }

    var ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:rgba(12,26,42,.45);z-index:10050;'
      + 'display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:16px;width:min(94vw,640px);max-height:88vh;'
      + 'display:flex;flex-direction:column;box-shadow:0 18px 60px rgba(20,40,64,.3);padding:18px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      +   '<b style="font-size:16px;color:#1a2f45">📦 자재 담기</b>'
      +   '<button type="button" id="mpX" style="border:none;background:none;font-size:21px;'
      +     'color:#94a3b8;cursor:pointer;min-height:44px;min-width:44px">✕</button></div>'
      + '<div id="mpBag" style="margin-bottom:10px"></div>'
      + '<input type="text" id="mpQ" placeholder="자재명 · 규격 · 제조원으로 검색" autocomplete="off"'
      +   ' style="width:100%;box-sizing:border-box;padding:11px 13px;font-size:14px;'
      +   'border:1.5px solid #dbe6f4;border-radius:10px;font-family:inherit;min-height:44px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin:10px 2px 8px">'
      +   '<span style="font-size:12.5px;color:#7a92a8;font-weight:800">담을 수량</span>'
      +   '<input type="number" id="mpQty" value="1" min="1" style="width:88px;box-sizing:border-box;'
      +     'padding:8px 10px;font-size:14px;border:1.5px solid #dbe6f4;border-radius:9px;font-family:inherit">'
      +   '<span style="font-size:12px;color:#a8b8c8">자재를 누르면 위에 담깁니다 (최대 '+MAX+'종)</span></div>'
      + '<div id="mpList" style="overflow:auto;flex:1;min-height:110px"></div>'
      + '<div style="display:flex;gap:8px;margin-top:12px;border-top:1.5px solid #f1f5f9;padding-top:12px">'
      +   '<button type="button" id="mpClear" style="padding:0 14px;height:46px;border:1.5px solid #e2e8f0;'
      +     'border-radius:10px;background:#fff;color:#94a3b8;font-size:13px;font-weight:800;'
      +     'font-family:inherit;cursor:pointer">전체 비우기</button>'
      +   '<button type="button" id="mpOk" style="flex:1;height:46px;border:none;border-radius:10px;'
      +     'background:#2563a8;color:#fff;font-size:14.5px;font-weight:800;font-family:inherit;'
      +     'cursor:pointer">✓ 확인</button></div></div>';
    document.body.appendChild(ov);
    function close(){ try{ ov.remove(); }catch(e){} document.removeEventListener('keydown', onEsc); }
    function onEsc(e){ if(e.key==='Escape') close(); }
    document.addEventListener('keydown', onEsc);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) close(); });
    ov.querySelector('#mpX').addEventListener('click', close);

    var qEl=ov.querySelector('#mpQ'), listEl=ov.querySelector('#mpList'),
        bagEl=ov.querySelector('#mpBag'), qtyEl=ov.querySelector('#mpQty');

    function drawBag(){
      if(!bag.length){
        bagEl.innerHTML='<div style="font-size:12.5px;color:#c3d1de;padding:8px 2px">'
          + '아직 담은 자재가 없어요</div>';
        return;
      }
      var s=sum();
      bagEl.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px">'
        + bag.map(function(m,i){
            return '<span style="display:inline-flex;align-items:center;gap:6px;background:#eef6ff;'
              + 'border:1.5px solid #bfdbfe;border-radius:999px;padding:5px 6px 5px 11px;'
              + 'font-size:12.5px;font-weight:700;color:#1a2f45;max-width:100%">'
              + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
              +   ES(m.name)+(m.spec?(' '+ES(m.spec)):'')+' × '+m.qty+'</span>'
              + '<button type="button" data-mprm="'+i+'" style="border:none;background:#dbeafe;'
              +   'color:#1d4ed8;border-radius:50%;width:20px;height:20px;line-height:1;font-size:12px;'
              +   'font-weight:800;cursor:pointer;flex:0 0 auto;padding:0">✕</button></span>';
          }).join('')
        + '</div>'
        + (s>0 ? '<div style="margin-top:8px;font-size:13px;font-weight:800;color:#b45309">'
                 + '합계 '+won(s)+'원 <span style="font-weight:600;color:#a8b8c8">'
                 + '(단가가 등록된 자재만)</span></div>' : '');
      [].forEach.call(bagEl.querySelectorAll('[data-mprm]'), function(b2){
        b2.addEventListener('click', function(){
          bag.splice(Number(b2.getAttribute('data-mprm')),1); drawBag(); drawList(); });
      });
    }
    function drawList(){
      var q=String(qEl.value||'').trim().toLowerCase();
      var rows = q ? items.filter(function(it){
        return [it.itemName,it.spec,it.maker,it.vendor,it.unit].join(' ').toLowerCase().indexOf(q)>=0;
      }) : items;
      var show=rows.slice(0,200), full = bag.length>=MAX;
      if(!show.length){
        listEl.innerHTML='<div style="padding:24px 8px;text-align:center;color:#a8b8c8;font-size:13.5px">'
          + (items.length? '찾는 자재가 없어요' : '자재 탭에 등록된 자재가 없어요')+'</div>';
        return;
      }
      listEl.innerHTML = show.map(function(it){
        return '<div data-mpid="'+ES(it.id)+'" style="border:1.5px solid #eaf1f9;border-radius:11px;'
          + 'padding:10px 12px;margin-bottom:7px;min-height:44px;'
          + (full?'opacity:.4;cursor:not-allowed':'cursor:pointer')+'">'
          + '<b style="font-size:14px;color:#1a2f45">'+ES(it.itemName)+'</b>'
          + '<div style="margin-top:4px;font-size:12px;color:#7a92a8">'
          +   (it.spec? ES(it.spec):'규격 없음') + (it.unit? ' · '+ES(it.unit):'')
          +   (Number(it.unitPrice)? ' · '+won(it.unitPrice)+'원' : ' · 단가 없음')
          + '</div></div>';
      }).join('')
      + (full ? '<div style="text-align:center;color:#b45309;font-size:12.5px;font-weight:800;padding:8px">'
                + '자재는 최대 '+MAX+'종까지 담을 수 있어요</div>' : '');
      [].forEach.call(listEl.querySelectorAll('[data-mpid]'), function(row){
        row.addEventListener('click', function(){
          if(bag.length>=MAX) return;
          var it=items.filter(function(x){ return x.id===row.getAttribute('data-mpid'); })[0];
          if(!it) return;
          bag.push({ id:it.id, name:(it.itemName||''), spec:(it.spec||''), unit:(it.unit||''),
                     price:Number(it.unitPrice)||0, qty:Number(qtyEl.value)||1 });
          drawBag(); drawList();
        });
      });
    }
    ov.querySelector('#mpClear').addEventListener('click', function(){ bag=[]; drawBag(); drawList(); });
    ov.querySelector('#mpOk').addEventListener('click', function(){
      close();
      try{ onDone(bag.slice()); }catch(e){ console.error('[자재 담기]', e); }
    });
    qEl.addEventListener('input', drawList);
    drawBag(); drawList();
    setTimeout(function(){ try{ qEl.focus(); }catch(e){} }, 60);
  };

  window.wlOpenAsPage = setUsesPage;
  window.wlOpenStyle  = openStyle;   /* 페이지 쪽이 창/전체를 스스로 판단하도록 */

  /* ══════════════════════════════════════════════════════════
     ＋ 새로 만들기도 같은 페이지 화면으로   (v82)
     · '창(모달)' 을 고르면 페이지가 90% 크기 창으로 뜬다 — 디자인 통일
     · 속성을 추가·정렬·숨김한 것이 새로 만들기에도 그대로 반영된다
     · 날짜·업체를 미리 채워 주는 자리(달력 ＋, 통화→업무)는
       예전 입력창을 그대로 쓴다. 채워 넣을 칸이 페이지엔 없기 때문.
     ══════════════════════════════════════════════════════════ */
  var LSN = 'wl_new_style';                       /* modal | page | old */
  function newStyle(){
    try{ var v=localStorage.getItem(LSN); return (v==='page'||v==='old') ? v : 'modal'; }
    catch(e){ return 'modal'; }
  }
  function setNewStyle(v){
    try{ localStorage.setItem(LSN, v); }catch(e){}
    paintNew();
    if(typeof toast==='function') toast(
      v==='modal' ? '🗔 ＋ 를 누르면 페이지가 창으로 열립니다'
    : v==='page'  ? '📄 ＋ 를 누르면 전체 페이지로 열립니다'
                  : '🗒 ＋ 를 누르면 예전 입력창이 열립니다');
  }
  function oldAdd(kind){
    try{
      if(kind==='expense' && typeof openExpenseEditor==='function'){ openExpenseEditor(null); return; }
      if(typeof openEditor==='function') openEditor(kind, null);
    }catch(e){ console.error('[새로 만들기]', e); }
  }
  /* ＋ 버튼은 전부 이걸 부른다 */
  window.wlAddNew = function(kind){
    try{
      var st = newStyle();
      if(st==='old' || !KINDS[kind] || typeof window.wlNewPage!=='function'){ oldAdd(kind); return; }
      window.wlNewPage(kind, st==='modal');
    }catch(e){ console.warn('[새로 만들기] 페이지 실패 — 예전 창으로', e); oldAdd(kind); }
  };

  function paintNew(){
    var st=newStyle();
    var m={ nsModal:'modal', nsPage:'page', nsOld:'old' };
    for(var k in m){
      var el=document.getElementById(k); if(!el) continue;
      el.className = 'btn btn-sm ' + (st===m[k] ? 'btn-primary' : 'btn-ghost');
      el.style.minHeight='44px';
    }
    var n=document.getElementById('nsNow');
    if(n) n.textContent = '지금: ' + (st==='modal'?'창(모달)으로 열림':st==='page'?'전체 페이지로 열림':'예전 입력창으로 열림');
  }
  function bindNew(){
    var m={ nsModal:'modal', nsPage:'page', nsOld:'old' };
    for(var k in m){
      (function(id, val){
        var el=document.getElementById(id);
        if(el && !el._bound){ el._bound=1; el.addEventListener('click', function(){ setNewStyle(val); }); }
      })(k, m[k]);
    }
    paintNew();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bindNew);
  else bindNew();
  setTimeout(bindNew, 1500);
})();


/* ══════════════════════════════════════════════════════════════════════
   📋 사고 · 진행업무 — 업무 기록에서 가져오기   (v83-0828-1458)
   · 사고/진행업무를 쓸 때 [📋 업무에서 가져오기] 로 기존 업무 기록을 골라
     날짜·제목·층·분야·업체·연락처·금액·상세를 한 번에 채운다.
   · ⚠ 빈 칸만 채운다 — 이미 쓴 내용은 절대 덮어쓰지 않는다.
   · 고른 업무의 id 를 workRef 에 남겨 나중에 되짚을 수 있게 한다.
   · 예전 입력창과 노션식 페이지 양쪽에서 같은 고르기 창을 쓴다.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var KIND_OK = { accident:1, progress:1 };
  var _link = null;          /* 이번 입력창에서 고른 업무 id */
  var _linkKind = '';

  function esc2(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function won(n){ n=Number(n)||0; return n? n.toLocaleString('ko-KR') : ''; }
  function workList(){
    try{
      return (entries||[]).filter(function(e){ return e && e.kind==='work'; })
        .slice().sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); });
    }catch(e){ console.warn('[가져오기] 업무 목록을 못 읽었어요', e); return []; }
  }
  function vendorOf(w){ return w.workVendor || w.vendor || ''; }
  function phoneOf(w){
    var a = [w.workContact, w.workPhone].filter(Boolean).join(' ');
    return a.trim();
  }
  function detailOf(w){
    return [w.detail, w.workMemo, w.memo].filter(function(x){ return String(x||'').trim(); })
      .join('\n').trim();
  }

  /* 업무 1건 → 사고/진행업무의 칸 값으로 옮겨 담는다 */
  window.wlWorkToFields = function(w, kind){
    if(!w) return {};
    var d = detailOf(w);
    var cost = Number(w.cost)||0;
    if(kind==='progress') return {
      date: w.date||'', title: w.title||'',
      owner: vendorOf(w), ownerPhone: phoneOf(w),
      estCost: cost, detail: d
    };
    /* accident */
    return {
      date: w.date||'', title: w.title||'',
      floor: w.floor||'', field: w.field||'',
      repairCost: cost, detail: d
    };
  };

  /* ── 업무 고르기 창 ──────────────────────────────────────
     onPick(업무기록) 을 부른다. 취소하면 아무 것도 안 부른다.
     ⚠ 한글 IME — 검색칸은 절대 다시 만들지 않고 결과 영역만 다시 그린다 */
  window.wlPickWork = function(onPick){
    var all = workList();
    var ov = document.createElement('div');
    ov.className = 'lf-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,26,42,.45);z-index:10050;'
      + 'display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:16px;width:min(94vw,880px);max-height:88vh;'
      + 'display:flex;flex-direction:column;box-shadow:0 18px 60px rgba(20,40,64,.3);padding:18px 18px 14px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      +   '<b style="font-size:16px;color:#1a2f45">📋 업무 기록에서 가져오기</b>'
      +   '<button type="button" id="iwX" style="border:none;background:none;font-size:21px;'
      +     'color:#94a3b8;cursor:pointer;min-height:44px;min-width:44px">✕</button>'
      + '</div>'
      + '<input type="text" id="iwQ" placeholder="제목 · 업체 · 분야 · 층으로 검색"'
      +   ' autocomplete="off" style="width:100%;box-sizing:border-box;padding:11px 13px;font-size:14px;'
      +   'border:1.5px solid #dbe6f4;border-radius:10px;font-family:inherit;min-height:44px">'
      + '<div id="iwHint" style="font-size:12.5px;color:#7a92a8;margin:8px 2px 6px">'
      +   '빈 칸만 채웁니다 — 이미 쓴 내용은 그대로 둡니다.</div>'
      + '<div id="iwList" style="overflow:auto;flex:1;min-height:120px"></div>'
      + '</div>';
    document.body.appendChild(ov);

    function close(){ try{ ov.remove(); }catch(e){} document.removeEventListener('keydown', onEsc); }
    function onEsc(e){ if(e.key==='Escape') close(); }
    document.addEventListener('keydown', onEsc);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) close(); });
    var xb = ov.querySelector('#iwX'); if(xb) xb.addEventListener('click', close);

    var listEl = ov.querySelector('#iwList');
    var qEl    = ov.querySelector('#iwQ');

    function draw(){
      var q = String(qEl.value||'').trim().toLowerCase();
      var rows = all;
      if(q) rows = all.filter(function(w){
        return [w.title, vendorOf(w), w.field, w.floor, w.detail, w.workMemo]
          .join(' ').toLowerCase().indexOf(q) >= 0;
      });
      var show = rows.slice(0, 200);
      if(!show.length){
        listEl.innerHTML = '<div style="padding:26px 8px;text-align:center;color:#a8b8c8;font-size:13.5px">'
          + (all.length ? '찾는 업무가 없어요' : '업무 기록이 아직 없어요') + '</div>';
        return;
      }
      listEl.innerHTML = show.map(function(w){
        var v = vendorOf(w), c = won(w.cost);
        return '<div data-iwid="'+esc2(w.id)+'" style="border:1.5px solid #eaf1f9;border-radius:11px;'
          + 'padding:10px 12px;margin-bottom:7px;cursor:pointer;min-height:44px">'
          + '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap">'
          +   (w.floor? '<span style="background:#eef5fd;color:#2b5f96;border-radius:6px;padding:1px 7px;'
                      + 'font-size:11.5px;font-weight:800">'+esc2(w.floor)+'</span>' : '')
          +   '<b style="font-size:14px;color:#1a2f45">'+esc2(w.title||'(제목 없음)')+'</b>'
          + '</div>'
          + '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:5px;font-size:12px;color:#7a92a8">'
          +   '<span>'+esc2(w.date||'')+'</span>'
          +   (w.field? '<span>· '+esc2(w.field)+'</span>':'')
          +   (v? '<span style="color:#2b5f96;font-weight:700">· '+esc2(v)+'</span>':'')
          +   (c? '<span style="color:#b45309;font-weight:700">· '+c+'원</span>':'')
          + '</div></div>';
      }).join('')
      + (rows.length>200 ? '<div style="text-align:center;color:#a8b8c8;font-size:12px;padding:6px">'
         + '…앞 200건만 보여요. 검색으로 좁혀 주세요</div>' : '');

      [].forEach.call(listEl.querySelectorAll('[data-iwid]'), function(row){
        row.addEventListener('click', function(){
          var id = row.getAttribute('data-iwid');
          var w = all.filter(function(x){ return x.id===id; })[0];
          if(!w) return;
          close();
          try{ onPick(w); }catch(e){ console.error('[가져오기]', e); }
        });
        row.addEventListener('mouseenter', function(){ row.style.background='#f6faff'; row.style.borderColor='#cfe0f3'; });
        row.addEventListener('mouseleave', function(){ row.style.background=''; row.style.borderColor='#eaf1f9'; });
      });
    }
    qEl.addEventListener('input', draw);      /* 검색칸 DOM 은 그대로 두고 목록만 다시 그린다 */
    draw();
    setTimeout(function(){ try{ qEl.focus(); }catch(e){} }, 60);
  };

  /* ── 예전 입력창(모달)에 단추 붙이기 ───────────────────── */
  function fillModal(w, kind, isNew){
    var patch = window.wlWorkToFields(w, kind);
    /* 새로 쓰는 중이면 '오늘' 로 미리 찍혀 있는 날짜는 빈 칸으로 본다 —
       사용자가 고른 값이 아니라 기본값이기 때문 */
    var td = ''; try{ td = todayStr(); }catch(e){}
    var filled = [], skipped = [];
    var sc = (typeof SCHEMA!=='undefined' && SCHEMA[kind]) ? SCHEMA[kind] : [];
    sc.forEach(function(f){
      if(!(f.k in patch)) return;
      var el = document.getElementById('m-'+f.k); if(!el) return;
      var cur = String(el.value==null?'':el.value).trim();
      var isEmpty = (cur==='' || cur==='0');
      if(!isEmpty && isNew && f.type==='date' && td && cur===td) isEmpty = true;
      var val = patch[f.k];
      if(val===''||val==null||val===0) return;
      if(!isEmpty){ skipped.push(f.label.replace(/\s*\*$/,'')); return; }
      el.value = val;
      el.style.background = '#fffbea';                 /* 자동입력 = 노란 배경 */
      try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
      try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
      filled.push(f.label.replace(/\s*\*$/,''));
    });
    _link = w.id; _linkKind = kind;
    paintChip(kind, w);
    if(typeof toast==='function'){
      toast(filled.length
        ? ('가져왔어요 — ' + filled.join(' · ') + (skipped.length? (' / 이미 쓴 칸 '+skipped.length+'개는 그대로 뒀어요') : ''))
        : '채울 빈 칸이 없었어요 — 연결만 해뒀습니다');
    }
  }

  function paintChip(kind, w){
    var host = document.getElementById('mFields'); if(!host) return;
    var old = document.getElementById('iwChip'); if(old) old.remove();
    if(!w) return;
    var chip = document.createElement('div');
    chip.id = 'iwChip';
    chip.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;'
      + 'background:#eef7ff;border:1.5px solid #cfe3f7;border-radius:10px;padding:8px 11px;margin-bottom:9px;'
      + 'font-size:12.5px;color:#2b5f96';
    chip.innerHTML = '<b>🔗 연결된 업무</b><span>'+esc2(w.date||'')+' · '+esc2(w.title||'')+'</span>'
      + '<button type="button" id="iwUnlink" style="margin-left:auto;border:none;background:none;'
      + 'color:#7a92a8;cursor:pointer;font-size:12.5px;font-family:inherit;min-height:32px">연결 끊기</button>';
    var btn = document.getElementById('iwBtnRow');
    if(btn && btn.parentNode) btn.parentNode.insertBefore(chip, btn.nextSibling);
    else host.insertBefore(chip, host.firstChild);
    var ub = document.getElementById('iwUnlink');
    if(ub) ub.addEventListener('click', function(){ _link=null; _linkKind=''; chip.remove(); });
  }

  function mIdNow(){ try{ return mId || null; }catch(e){ return null; } }

  function addModalButton(kind, data){
    var host = document.getElementById('mFields'); if(!host) return;
    var old = document.getElementById('iwBtnRow'); if(old) old.remove();
    var row = document.createElement('div');
    row.id = 'iwBtnRow';
    row.style.cssText = 'grid-column:1/-1;margin-bottom:10px';
    row.innerHTML = '<button type="button" id="iwBtn" style="width:100%;min-height:46px;'
      + 'border:1.5px dashed #b9d3ee;background:#f6fbff;color:#2b5f96;border-radius:11px;'
      + 'font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit">'
      + '📋 업무 기록에서 가져오기</button>';
    host.insertBefore(row, host.firstChild);
    var b = document.getElementById('iwBtn');
    if(b) b.addEventListener('click', function(){
      window.wlPickWork(function(w){ fillModal(w, kind, !mIdNow()); });
    });
    /* 이미 연결돼 있던 기록이면 칩을 보여준다 */
    if(data && data.workRef){
      var w = null;
      try{ w = (entries||[]).filter(function(x){ return x.id===data.workRef; })[0]; }catch(e){}
      if(w){ _link = w.id; _linkKind = kind; paintChip(kind, w); }
    }
  }

  /* openEditor 를 감싼다 — 원래 함수는 그대로 살려둔다 */
  try{
    if(typeof openEditor === 'function' && !openEditor._impWrapped){
      var _origEd = openEditor;
      openEditor = function(kind, id){
        _link = null; _linkKind = '';
        var r = _origEd.apply(this, arguments);
        try{
          var ovEl = document.getElementById('overlay');
          var shown = !!(ovEl && ovEl.classList && ovEl.classList.contains('show'));
          if(KIND_OK[kind] && shown){
            var data = id ? ((entries||[]).filter(function(x){ return x.id===id; })[0]||{}) : {};
            addModalButton(kind, data);
          }
        }catch(e){ console.warn('[가져오기] 단추를 못 붙였어요', e); }
        return r;
      };
      openEditor._impWrapped = true;
      window.openEditor = openEditor;
    }
  }catch(e){ console.warn('[가져오기] openEditor 감싸기 실패', e); }

  /* 저장할 때 workRef 를 함께 남긴다 (원래 저장 코드는 안 건드린다) */
  function stamp(obj){
    try{
      if(!obj || !KIND_OK[obj.kind]) return;
      if(_link && _linkKind===obj.kind){ obj.workRef = _link; obj.workRefKind = 'work'; }
    }catch(e){}
  }
  try{
    if(typeof addRecord === 'function' && !addRecord._impWrapped){
      var _oAdd = addRecord;
      addRecord = function(data){ stamp(data); return _oAdd.apply(this, arguments); };
      addRecord._impWrapped = true; window.addRecord = addRecord;
    }
    if(typeof updateRecord === 'function' && !updateRecord._impWrapped){
      var _oUpd = updateRecord;
      updateRecord = function(id, patch){
        try{ if(patch && KIND_OK[patch.kind]) stamp(patch); }catch(e){}
        return _oUpd.apply(this, arguments);
      };
      updateRecord._impWrapped = true; window.updateRecord = updateRecord;
    }
  }catch(e){ console.warn('[가져오기] 저장 감싸기 실패', e); }
})();


/* ══════════════════════════════════════════════════════════════════════
   ☁️ 드라이브 백업이 멈추면 화면으로 알린다   (v93-0829-0837)
   · 2026-08-24 캘린더 사고와 같은 꼴 — 한 번 쏘고 끝이면 실패가 안 보인다.
   · 백업이 주기의 2배를 넘도록 안 올라가면 머리말에 빨간 단추를 띄운다.
   · 단추는 '사용자 클릭' 이라 구글 팝업이 차단되지 않는다 (타이머 안에서 부르면 막힌다).
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var ID = 'wlDrvBadge';

  function badge(){
    var b = document.getElementById(ID);
    if(b) return b;
    var host = document.getElementById('btnGCal');
    if(!host || !host.parentNode) return null;
    b = document.createElement('button');
    b.id = ID; b.type = 'button';
    b.style.cssText = 'display:none;margin-left:6px;height:32px;padding:0 11px;border-radius:9px;'
      + 'border:1.5px solid #e08a8a;background:#fdecec;color:#a13030;font-size:12px;font-weight:800;'
      + 'font-family:inherit;cursor:pointer;white-space:nowrap;vertical-align:middle';
    b.addEventListener('click', function(){
      var D = window.wlDrive;
      if(!D){ alert('백업 기능을 못 불러왔어요 — worklog.html 을 올렸는지 확인해 주세요'); return; }
      b.disabled = true; b.textContent = '☁️ 연결하는 중…';
      /* 사용자가 직접 누른 것이므로 창을 띄워도 막히지 않는다 */
      D.auth(false).then(function(ok){
        if(!ok){
          b.disabled = false; paint();
          var why2 = '';
          try{ why2 = (D.why && D.why()) || ''; }catch(e){}
          alert('연결하지 못했어요.\n\n' + (why2 || '이유를 알 수 없습니다.')
                + '\n\n🔧 진단 탭 → [🔍 왜 안 되는지 확인] 에서 자세히 볼 수 있어요.');
          return;
        }
        b.textContent = '☁️ 백업하는 중…';
        return D.upload().then(function(f){
          try{ D.noteTry && D.noteTry(''); }catch(e){}
          b.disabled = false; paint();
          if(typeof toast==='function') toast('☁️ 드라이브에 백업했어요 — ' + (f && f.name ? f.name : ''));
        });
      }).catch(function(e){
        b.disabled = false; paint();
        console.warn('[드라이브 배지]', e);
        alert('백업하지 못했어요: ' + (e && e.message ? e.message : e));
      });
    });
    host.parentNode.insertBefore(b, host.nextSibling);
    return b;
  }

  function paint(){
    try{ paintDiag(); }catch(e){}          /* 진단 탭 상태 줄도 같이 갱신 */
    try{
      var b = badge(); if(!b) return;
      var D = window.wlDrive;
      var st = (D && D.stale) ? D.stale() : null;
      if(!st){ b.style.display = 'none'; return; }
      b.style.display = 'inline-block';
      b.textContent = '🔑 드라이브 백업 끊김'
        + (st.days >= 0 ? (' (' + st.days + '일)') : '');
      b.title = '자동 백업이 멈춰 있어요'
        + (st.err ? ('\n사유: ' + st.err) : '')
        + '\n눌러서 다시 연결하고 지금 백업합니다.';
    }catch(e){ console.warn('[드라이브 배지] 그리기 실패', e); }
  }

  /* ── 진단 탭 단추 ── */
  function connectNow(btn){
    var D = window.wlDrive;
    if(!D){ alert('백업 기능을 못 불러왔어요 — worklog.html 을 올렸는지 확인해 주세요'); return; }
    var old = btn ? btn.textContent : '';
    if(btn){ btn.disabled = true; btn.textContent = '☁️ 구글 창을 여는 중…'; }
    D.auth(false).then(function(ok){
      if(!ok){
        if(btn){ btn.disabled=false; btn.textContent=old; }
        var why = '';
        try{ why = (D.why && D.why()) || ''; }catch(e){}
        alert('연결하지 못했어요.\n\n' + (why || '이유를 알 수 없습니다.')
              + '\n\n[🔍 왜 안 되는지 확인] 을 눌러 자세히 보세요.');
        showDiag();
        return;
      }
      if(btn) btn.textContent = '☁️ 백업하는 중…';
      var c = D.cfg(); if(!c.on){ c.on = true; D.save(c); }     /* 꺼져 있었으면 같이 켠다 */
      return D.upload().then(function(f){
        try{ D.noteTry && D.noteTry(''); }catch(e){}
        if(btn){ btn.disabled=false; btn.textContent=old; }
        paintDiag(); paint();
        alert('✅ 백업했어요\n\n' + ((f && f.name) ? f.name : '') + '\n내 구글 드라이브 「업무일지 백업」 폴더에 있습니다.');
      });
    }).catch(function(e){
      if(btn){ btn.disabled=false; btn.textContent=old; }
      console.warn('[드라이브 연결]', e);
      alert('백업하지 못했어요: ' + (e && e.message ? e.message : e));
    });
  }
  function paintDiag(){
    try{
      var n = document.getElementById('diagDrvNow'); if(!n) return;
      var D = window.wlDrive; if(!D){ n.textContent = ''; return; }
      var c = D.cfg(), st = D.stale();
      var last = c.lastAt
        ? new Date(c.lastAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})
        : '아직 없음';
      n.textContent = !c.on ? '⚪ 꺼짐 — 눌러서 켜기'
                    : st   ? ('🔴 멈춰 있어요 · 마지막 ' + last)
                           : ('🟢 정상 · 마지막 ' + last);
      n.style.color = !c.on ? '#7a92a8' : (st ? '#c0392b' : '#0f7a4a');
    }catch(e){ console.warn('[드라이브 진단 표시]', e); }
  }
  /* 🔍 왜 안 되는지 — 항목별로 보여준다 (v89) */
  function showDiag(){
    var box = document.getElementById('diagDrvBox'); if(!box) return;
    var D = window.wlDrive;
    if(!D || typeof D.diag !== 'function'){
      box.innerHTML = '<div style="padding:10px;color:#c0392b;font-size:13px;font-weight:700">'
        + 'worklog.html 이 옛 파일이라 진단을 못 합니다 — 같이 올려 주세요</div>';
      return;
    }
    var rows;
    try{ rows = D.diag(); }
    catch(e){ box.innerHTML = '<div style="padding:10px;color:#c0392b">진단 실패: '+(e.message||e)+'</div>'; return; }
    var bad = rows.filter(function(r){ return !r.ok; });
    box.innerHTML =
      '<div style="border:1.5px solid #dbe6f4;border-radius:11px;overflow:hidden">'
      + rows.map(function(r){
          return '<div style="display:flex;gap:9px;padding:8px 12px;border-bottom:1px solid #f1f6fb;'
            + 'font-size:13px;align-items:flex-start">'
            + '<span style="flex:0 0 16px">'+(r.ok?'🟢':'🔴')+'</span>'
            + '<span style="flex:0 0 130px;font-weight:800;color:#5b7794">'+r.name+'</span>'
            + '<span style="flex:1;min-width:0;color:'+(r.ok?'#1a2f45':'#a13030')+';word-break:break-all">'
            +   (r.val||'—')+'</span></div>';
        }).join('')
      + '</div>'
      + '<div style="margin-top:9px;padding:10px 12px;border-radius:9px;font-size:13px;font-weight:700;'
      +   'background:'+(bad.length?'#fdecec':'#effaf4')+';color:'+(bad.length?'#a13030':'#0f7a4a')+'">'
      +   (bad.length
          ? ('🔴 걸리는 곳 '+bad.length+'군데 — 위의 빨간 줄을 먼저 해결해 주세요')
          : '🟢 막는 것이 없습니다 — [☁️ 지금 연결하고 백업] 을 눌러 보세요')
      + '</div>';
  }

  function bindDiag(){
    var bw = document.getElementById('diagDrvWhy');
    if(bw && !bw._drvB){ bw._drvB = 1; bw.addEventListener('click', showDiag); }
    var b1 = document.getElementById('diagDrvConn');
    if(b1 && !b1._drvB){ b1._drvB = 1; b1.addEventListener('click', function(){ connectNow(b1); }); }
    var b2 = document.getElementById('diagDrvGo');
    if(b2 && !b2._drvB){ b2._drvB = 1; b2.addEventListener('click', function(){
      var g = document.getElementById('btnSafe');
      if(g){ g.click(); setTimeout(function(){
        var card = document.querySelector('#lifeHost [id="lfDrvOn"], [id="lfDrvOn"]');
        if(card && card.scrollIntoView) try{ card.scrollIntoView({block:'center', behavior:'smooth'}); }catch(e){}
      }, 500); }
      else alert('머리말의 초록색 [🛟 안전] 단추를 눌러 주세요.');
    }); }
    paintDiag();
  }
  window.wlDriveConnect = function(){ connectNow(null); };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ paint(); bindDiag(); }, 2500); });
  else setTimeout(function(){ paint(); bindDiag(); }, 2500);
  setTimeout(bindDiag, 6000);
  setInterval(paint, 5*60*1000);          /* 5분마다 다시 본다 */
  window.addEventListener('focus', paint);
  window.wlDrvBadge = paint;

  /* ── 자가 점검에 「드라이브 백업」 항목을 얹는다 ── */
  try{
    if(typeof window.wlSelfCheck === 'function' && !window.wlSelfCheck._drvHooked){
      var _orig = window.wlSelfCheck;
      window.wlSelfCheck = function(){
        var r = _orig.apply(this, arguments);
        try{
          var D = window.wlDrive;
          var box = document.getElementById('scBody') || document.getElementById('scResult');
          if(D && box){
            var c = D.cfg(), st = D.stale();
            var last = c.lastAt
              ? new Date(c.lastAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})
              : '아직 없음';
            var txt = !c.on ? '⚪ 자동 백업이 꺼져 있습니다'
                    : st   ? ('🔴 백업이 멈춰 있어요 — 마지막 ' + last + (st.err ? (' · ' + st.err) : ''))
                           : ('🟢 정상 — 마지막 백업 ' + last);
            var d = document.createElement('div');
            d.style.cssText = 'margin-top:10px;padding:9px 12px;border-radius:9px;font-size:13px;'
              + 'font-weight:700;background:' + (!c.on ? '#f4f7fa' : st ? '#fdecec' : '#effaf4')
              + ';color:' + (!c.on ? '#7a92a8' : st ? '#a13030' : '#0f7a4a');
            d.textContent = '☁️ 드라이브 백업 — ' + txt;
            box.appendChild(d);
          }
        }catch(e){ console.warn('[자가 점검] 드라이브 항목 실패', e); }
        paint();
        return r;
      };
      window.wlSelfCheck._drvHooked = true;
    }
  }catch(e){ console.warn('[자가 점검] 드라이브 항목 붙이기 실패', e); }
})();


/* ══════════════════════════════════════════════════════════════════════
   🛑 기록을 못 불러왔을 때 화면 맨 위로 알린다   (v93-0829-0837)
   · 0건이거나 갑자기 절반 밑으로 줄면 lsSave() 가 기기 사본을 지키고 멈춘다.
   · 그 사실을 사용자가 알아야 "왜 0건이지?" 하고 기록을 다시 쓰는 일을 막는다.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var ID='wlGuardBn';
  function bn(){
    var b=document.getElementById(ID);
    if(b) return b;
    b=document.createElement('div');
    b.id=ID;
    b.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147482000;display:none;'
      + 'background:#b52929;color:#fff;padding:11px 14px;font-size:14px;font-weight:800;'
      + 'font-family:inherit;text-align:center;box-shadow:0 3px 14px rgba(0,0,0,.25);line-height:1.5';
    document.body.appendChild(b);
    return b;
  }
  function paint(){
    try{
      var g = window.__wlEmptyGuard;
      var b = bn(); if(!b) return;
      if(!g){ b.style.display='none'; return; }
      b.style.display='block';
      b.innerHTML = '🛑 <b>기록을 못 불러왔습니다</b> — 화면에 '+g.now+'건으로 보이지만 '
        + '이 기기에 <b>'+g.had+'건</b>이 그대로 있습니다. '
        + '<u style="cursor:pointer" id="wlGuardR">새로고침</u> 해주세요. '
        + '<span style="font-weight:600;opacity:.9">그 전에는 기록을 새로 쓰지 마세요.</span>';
      var r=document.getElementById('wlGuardR');
      if(r && !r._b){ r._b=1; r.addEventListener('click', function(){ location.reload(); }); }
    }catch(e){ console.warn('[저장 가드 배너]', e); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(paint,1500); });
  else setTimeout(paint,1500);
  setInterval(paint, 15000);   /* v92: 4초 → 15초. 저장이 막히는 순간엔 saveLight 가 직접 부른다 */
  window.wlGuardBanner = paint;

  /* 자가 점검에도 한 줄 */
  try{
    if(typeof window.wlSelfCheck === 'function' && !window.wlSelfCheck._gdHooked){
      var _o = window.wlSelfCheck;
      window.wlSelfCheck = function(){
        var r = _o.apply(this, arguments);
        try{
          var g = window.__wlEmptyGuard;
          var box = document.getElementById('scResult');
          if(box){
            var d=document.createElement('div');
            d.style.cssText='margin-top:10px;padding:9px 12px;border-radius:9px;font-size:13px;font-weight:700;'
              + 'background:'+(g?'#fdecec':'#effaf4')+';color:'+(g?'#a13030':'#0f7a4a');
            d.textContent = g
              ? ('🛑 저장 보호 작동 중 — 기기 사본 '+g.had+'건을 지키고 있습니다 (화면 '+g.now+'건). 새로고침하세요')
              : '🛡 저장 보호 — 정상 (빈 데이터로 덮어쓴 적 없음)';
            box.appendChild(d);
          }
        }catch(e){ console.warn('[자가 점검] 저장 보호 항목 실패', e); }
        paint();
        return r;
      };
      window.wlSelfCheck._gdHooked = true;
    }
  }catch(e){ console.warn('[자가 점검] 저장 보호 붙이기 실패', e); }
})();


/* ============================================================
   ✨ 입력칸 3종 세트 (wlSmartField)  v111-0829-2330
   기본지침 제3원칙 — 어떤 프로그램이든 기본으로 넣는 부품

   ① 자동완성 + 초성검색 : 모든 짧은 입력칸에 자동으로 붙는다
   ② 연결 배지          : 이름·업체를 고르면 전화·직책이 따라 보인다
   ③ 빈 칸 접기          : 값 없는 칸을 접어 화면을 아낀다 (기본 꺼짐)

   ▸ 붙이는 방식은 「전부 붙이고 예외만 빼기」 — 새 칸을 만들어도 자동으로 된다
   ▸ 기존 자동완성 5벌(제목·위치·분야·자재·통화이름)은 건드리지 않는다 (충돌 0)
   ▸ 새 script / style 블록을 만들지 않는다
   ▸ 되돌리기는 파일이 아니라 진단 탭 스위치로 한다
   ============================================================ */
(function(){
  'use strict';

  var LS_ON     = 'wl_sf_on';        /* 스위치      {ac,link,fold} */
  var LS_HIDE   = 'wl_sugg_hidden';  /* 🗑 로 뺀 값  {키:[값…]}    */
  var MAXLEN    = 30;                /* 후보 글자수 상한 (기본)   */
  /* 문장이 들어가는 칸은 더 길게 — 제목·내용은 30자를 쉽게 넘는다 */
  var MAX_BY_KEY = { title:80, detail:120, body:120, memo:120, note:80, dtl:120, content:120 };
  function maxOf(key){ return MAX_BY_KEY[key] || MAXLEN; }
  var MAXSHOW   = 8;                 /* 한 번에 보여줄 개수        */
  var MINCOUNT  = 1;                 /* 기본: 한 번만 쓴 것도 후보 */
  /* 값이 몰리는 「목록성」 칸만 2번 이상으로 — 제목·내역은 한 번짜리도 쓸모가 있다 */
  var MIN_BY_KEY = { company:2, vendor:2, workVendor:2, material:2, unit:2, floor:2, field:2 };
  function minOf(key){ return MIN_BY_KEY[key] || MINCOUNT; }

  /* ── 설정 ─────────────────────────────────────────── */
  function cfg(){
    var d = { ac:1, link:1, fold:0, idsave:1, quick:1 };
    try{
      var o = JSON.parse(localStorage.getItem(LS_ON) || 'null');
      if(o && typeof o === 'object'){ for(var k in d) if(k in o) d[k] = o[k] ? 1 : 0; }
    }catch(e){ console.warn('[입력도우미] 설정 읽기 실패', e); }
    return d;
  }
  function cfgSet(k, v){
    var c = cfg(); c[k] = v ? 1 : 0;
    try{ localStorage.setItem(LS_ON, JSON.stringify(c)); }
    catch(e){ console.warn('[입력도우미] 설정 저장 실패', e); }
    return c;
  }

  /* ── 초성 ─────────────────────────────────────────── */
  var CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  function chosung(s){
    return String(s == null ? '' : s).split('').map(function(ch){
      var c = ch.charCodeAt(0) - 0xAC00;
      return (c >= 0 && c <= 11171) ? CHO[Math.floor(c/588)] : ch;
    }).join('');
  }
  function hitCand(cand, q){
    var s = String(cand == null ? '' : cand);
    var t = String(q || '').trim();
    if(!t) return true;
    if(/^[ㄱ-ㅎ]+$/.test(t)) return chosung(s).indexOf(t) >= 0;
    return s.toLowerCase().indexOf(t.toLowerCase()) >= 0;
  }
  function canSuggest(v, key){
    var s = String(v == null ? '' : v).trim();
    return s.length > 0 && s.length <= maxOf(key) && s.indexOf('\n') < 0;
  }
  function normKey(s){
    return String(s == null ? '' : s)
      .replace(/\s+/g, '')
      .replace(/\(주\)|（주）|㈜|\(유\)|（유）|㈜|주식회사|유한회사/g, '')  /* 법인표기는 통째로 먼저 */
      .replace(/[()（）.\-_]/g, '')                                      /* 남은 기호 */
      .toLowerCase();
  }
  function ES(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ── 🗑 숨김 목록 ─────────────────────────────────── */
  function hiddenOf(key){
    try{
      var o = JSON.parse(localStorage.getItem(LS_HIDE) || '{}');
      return Array.isArray(o[key]) ? o[key] : [];
    }catch(e){ console.warn('[입력도우미] 숨김 목록 읽기 실패', e); return []; }
  }
  function hideVal(key, v){
    try{
      var o = JSON.parse(localStorage.getItem(LS_HIDE) || '{}');
      if(!Array.isArray(o[key])) o[key] = [];
      if(o[key].indexOf(v) < 0) o[key].push(v);
      localStorage.setItem(LS_HIDE, JSON.stringify(o));
    }catch(e){ console.warn('[입력도우미] 숨김 저장 실패', e); }
  }
  function unhideAll(){
    try{ localStorage.removeItem(LS_HIDE); }
    catch(e){ console.warn('[입력도우미] 숨김 비우기 실패', e); }
  }

  /* ── 후보 모으기 (기록에서 직접, 5초 캐시) ─────────── */
  var _cache = {}, _cacheAt = 0;
  function buildCache(){
    var now = Date.now();
    if(now - _cacheAt < 5000) return _cache;
    var map = {};
    try{
      var list = (typeof entries !== 'undefined' && entries) ? entries : [];
      for(var i = 0; i < list.length; i++){
        var e = list[i]; if(!e) continue;
        for(var k in e){
          if(k === 'id' || k === 'kind' || k === 'createdAt' || k === 'updatedAt') continue;
          var v = e[k];
          if(typeof v !== 'string') continue;
          if(!canSuggest(v, k)) continue;
          var t = v.trim();
          if(!map[k]) map[k] = {};
          map[k][t] = (map[k][t] || 0) + 1;
        }
      }
    }catch(err){ console.warn('[입력도우미] 후보 모으기 실패', err); }
    _cache = map; _cacheAt = now;
    return map;
  }
  function candFor(key){
    var m = buildCache()[key] || {};
    if(isItemKey(key)){                       /* 자재는 자재 탭 품목을 후보에 더한다 */
      try{
        var list = (typeof entries !== 'undefined' && entries) ? entries : [];
        m = JSON.parse(JSON.stringify(m));
        for(var i = 0; i < list.length; i++){
          var e = list[i];
          if(e && e.kind === 'item' && e.itemName) m[String(e.itemName).trim()] = (m[String(e.itemName).trim()] || 0) + 2;
        }
      }catch(err){ console.warn('[입력도우미] 자재 후보 더하기 실패', err); }
    }
    var hid = hiddenOf(key);
    var need = minOf(key);
    var arr = [];
    for(var v in m){
      if(hid.indexOf(v) >= 0) continue;
      if(m[v] < need) continue;
      arr.push({ v: v, n: m[v] });
    }
    arr.sort(function(a, b){ return b.n - a.n || a.v.localeCompare(b.v); });
    return arr;
  }
  function countOf(key, val){
    var m = buildCache()[key] || {};
    return m[String(val).trim()] || 0;
  }

  /* ── 연락처에서 찾기 (연결 배지용) ─────────────────── */
  var LINK_KEYS = ['company','vendor','workVendor','supplier','partner','거래처','업체'];
  function isLinkKey(key){ return LINK_KEYS.indexOf(key) >= 0; }
  function contacts(){
    try{
      if(typeof contactsCache !== 'undefined' && contactsCache && contactsCache.length) return contactsCache;
      if(typeof loadContactsCache === 'function') loadContactsCache().catch(function(){});
    }catch(e){ console.warn('[입력도우미] 연락처를 못 읽었어요', e); }
    return [];
  }
  function findContact(name){
    var n = normKey(name); if(!n) return null;
    var list = contacts();
    for(var i = 0; i < list.length; i++){
      var c = list[i]; if(!c) continue;
      if(normKey(c.name) === n || normKey(c.company) === n) return c;
    }
    return null;
  }

  /* ── 드롭다운 (한 개만 만들어 돌려 쓴다) ───────────── */
  var box = null, boxFor = null;
  function ensureBox(){
    if(box && box.parentNode) return box;
    box = document.createElement('div');
    box.id = 'wlSfBox';
    box.style.cssText = 'display:none;position:fixed;z-index:99999;background:#fff;'
      + 'border:1.5px solid #dbe6f4;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.14);'
      + 'max-height:260px;overflow:auto;font-family:inherit;font-size:13px';
    document.body.appendChild(box);
    return box;
  }
  function closeBox(){
    if(box) box.style.display = 'none';
    boxFor = null;
  }
  function placeBox(inp){
    var r = inp.getBoundingClientRect();
    var b = ensureBox();
    var below = window.innerHeight - r.bottom;
    b.style.left  = Math.max(6, r.left) + 'px';
    b.style.width = Math.max(160, r.width) + 'px';
    if(below < 180 && r.top > 200){          /* 아래가 좁으면 위로 뒤집는다 */
      b.style.top = 'auto';
      b.style.bottom = (window.innerHeight - r.top + 4) + 'px';
      b.style.maxHeight = Math.min(260, r.top - 12) + 'px';
    }else{
      b.style.bottom = 'auto';
      b.style.top = (r.bottom + 4) + 'px';
      b.style.maxHeight = Math.min(260, below - 12) + 'px';
    }
  }

  /* ── 연결 배지 ─────────────────────────────────────── */
  function badgeOf(inp, make){
    var id = 'sfb-' + (inp.id || '');
    var el = document.getElementById(id);
    if(!el && make){
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'margin-top:4px;padding:6px 9px;border-radius:8px;background:#f1f5f9;'
        + 'border:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;'
        + 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
      if(inp.parentNode) inp.parentNode.appendChild(el);
    }
    return el;
  }
  function showBadge(inp, c){
    if(!cfg().link) return;
    var el = badgeOf(inp, true); if(!el) return;
    var bits = [];
    if(c.phone)   bits.push('📞 <a href="tel:' + ES(String(c.phone).replace(/[^0-9+]/g,'')) + '" style="color:#2563eb;text-decoration:none">' + ES(c.phone) + '</a>');
    if(c.company && normKey(c.company) !== normKey(c.name)) bits.push('🏢 ' + ES(c.company));
    if(c.role)    bits.push('👤 ' + ES(c.role));
    if(c.cat)     bits.push('🏷 ' + ES(c.cat));
    if(!bits.length){ el.remove(); return; }
    el.innerHTML = '<span style="flex:1;min-width:0">' + bits.join(' · ') + '</span>'
      + '<button type="button" data-sfx="1" style="flex:0 0 auto;height:24px;padding:0 8px;'
      + 'border:1px solid #e2e8f0;border-radius:7px;background:#fff;color:#94a3b8;'
      + 'font-size:11px;font-family:inherit;cursor:pointer">연결 해제</button>';
    el.style.display = 'flex';
    var x = el.querySelector('[data-sfx]');
    if(x) x.addEventListener('click', function(){ el.remove(); });
  }
  function syncBadge(inp){
    var key = keyOf(inp);
    if(!isLinkKey(key)){ return; }
    var v = (inp.value || '').trim();
    var old = badgeOf(inp, false);
    if(!v){ if(old) old.remove(); return; }
    var c = findContact(v);
    if(c) showBadge(inp, c);
    else if(old) old.remove();
  }

  /* ── 자재를 고르면 규격·단위·단가가 따라 채워진다 ──────
     업체(관련처) 자동채움과 같은 방식. 빈 칸만 채우고 이미 쓴 값은 안 건드린다 */
  var ITEM_KEYS = ['material','itemName','item'];
  function isItemKey(key){ return ITEM_KEYS.indexOf(key) >= 0; }
  function findItem(name){
    var n = normKey(name); if(!n) return null;
    try{
      var list = (typeof entries !== 'undefined' && entries) ? entries : [];
      for(var i = 0; i < list.length; i++){
        var e = list[i];
        if(!e || e.kind !== 'item') continue;
        if(normKey(e.itemName) === n) return e;
      }
    }catch(err){ console.warn('[입력도우미] 자재를 못 찾았어요', err); }
    return null;
  }
  /* 같은 화면에서 그 항목의 입력칸을 찾는다 — 모달(m-키) · 노션식(data-ppid/pid) 둘 다 */
  function fieldFor(fromInp, key){
    var el = document.getElementById('m-' + key);
    if(el) return el;
    try{
      var root = fromInp.closest('#mFields, #expV2Overlay, .pg-body, tr, form, .modal') || document;
      var host = root.querySelector('[data-ppid="f:' + key + '"],[data-pid="f:' + key + '"]');
      if(host){ var ie = host.querySelector('.lf-ie'); if(ie) return ie; }
    }catch(e){}
    return null;
  }
  function fillFromItem(inp, name){
    if(!cfg().link) return;
    var it = findItem(name); if(!it) return;
    var MAP = { spec:'spec', unit:'unit', unitPrice:'unitPrice', maker:'maker', vendor:'vendor', itemCode:'itemCode' };
    var filled = [];
    for(var k in MAP){
      var v = it[MAP[k]];
      if(v == null || v === '') continue;
      var t = fieldFor(inp, k);
      if(!t) continue;
      if((t.value || '').trim()) continue;              /* 이미 쓴 값은 안 건드린다 */
      t.value = v;
      t._byLink = 1;                                     /* v106: 연결에서 온 값 표시 */
      try{ t.dataset.fromLink = '1'; }catch(e){}
      t.style.background = '#fffbea';                    /* 자동 채운 칸은 노란 배경 (달님 표준) */
      try{ t.dispatchEvent(new Event('input',  {bubbles:true})); }catch(e){}
      try{ t.dispatchEvent(new Event('change', {bubbles:true})); }catch(e){}
      filled.push(k);
    }
    if(filled.length){
      /* v113 — 자재에서 저절로 따라 들어온 칸을 적어 둔다 (↩ 로 되돌릴 수 있게) */
      try{
        var _m = String(location.hash||'').match(/^#lp=([^&]+)/);
        if(_m && typeof window.wlAutoMark === 'function'){
          var _am = {};
          filled.forEach(function(k){ var t2 = fieldFor(inp, k); if(t2) _am[k] = t2.value; });
          window.wlAutoMark(decodeURIComponent(_m[1]), _am);
        }
      }catch(e){ console.warn('[자재 자동채움] 기록 실패', e); }
      var el = badgeOf(inp, true);
      if(el){
        var bits = [];
        if(it.spec)      bits.push('📐 ' + ES(it.spec));
        if(it.unit)      bits.push('📦 ' + ES(it.unit));
        if(it.unitPrice) bits.push('💰 ' + ES(Number(it.unitPrice).toLocaleString()) + '원');
        if(it.vendor)    bits.push('🏢 ' + ES(it.vendor));
        el.innerHTML = '<span style="flex:1;min-width:0">' + (bits.join(' · ') || '자재 정보 채움') + '</span>';
        el.style.display = 'flex';
      }
      if(typeof toast === 'function') toast('자재 정보를 채웠습니다 (' + filled.length + '칸)');
    }
  }

  /* ── 목록 그리기 ───────────────────────────────────── */
  function render(inp){
    var key = keyOf(inp);
    var q = (inp.value || '').trim();
    var all = candFor(key);
    var hit = [];
    for(var i = 0; i < all.length && hit.length < MAXSHOW; i++){
      if(hitCand(all[i].v, q)) hit.push(all[i]);
    }
    if(!hit.length){ closeBox(); return; }
    var b = ensureBox();
    var html = '';
    for(var j = 0; j < hit.length; j++){
      var it = hit[j];
      var sub = '';
      if(isLinkKey(key)){
        var c = findContact(it.v);
        if(c && (c.role || c.phone)) sub = ' · ' + ES([c.role, c.phone].filter(Boolean).join(' '));
      }
      html += '<div data-sfv="' + ES(it.v) + '" style="display:flex;align-items:center;gap:6px;'
        + 'padding:9px 10px;cursor:pointer;border-bottom:1px solid #f1f5f9">'
        + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + ES(it.v) + '<span style="color:#94a3b8;font-size:11.5px">' + sub + '</span></span>'
        + '<span style="flex:0 0 auto;color:#94a3b8;font-size:11px">' + it.n + '</span>'
        + '<button type="button" data-sfdel="' + ES(it.v) + '" title="이 목록에서 빼기" '
        + 'style="flex:0 0 auto;width:24px;height:24px;border:1px solid #fde8e8;border-radius:6px;'
        + 'background:#fff;color:#e74c3c;font-size:11px;cursor:pointer;font-family:inherit;line-height:1">🗑</button>'
        + '</div>';
    }
    b.innerHTML = html;
    b.style.display = 'block';
    boxFor = inp;
    placeBox(inp);

    /* 고르기 — mousedown 이어야 폰에서 키보드가 안 닫힌다 */
    b.querySelectorAll('[data-sfv]').forEach(function(row){
      row.addEventListener('mousedown', function(ev){
        if(ev.target && ev.target.getAttribute('data-sfdel') != null) return;
        ev.preventDefault();
        inp.value = row.getAttribute('data-sfv');
        closeBox();
        syncBadge(inp);
        if(isItemKey(keyOf(inp))) fillFromItem(inp, inp.value);
        try{ inp.dispatchEvent(new Event('input',  {bubbles:true})); }catch(e){}
        try{ inp.dispatchEvent(new Event('change', {bubbles:true})); }catch(e){}
      });
    });
    b.querySelectorAll('[data-sfdel]').forEach(function(btn){
      btn.addEventListener('mousedown', function(ev){
        ev.preventDefault(); ev.stopPropagation();
        var v = btn.getAttribute('data-sfdel');
        if(!confirm('"' + v + '"\n이 값을 자동완성 목록에서 뺄까요?\n(과거 기록은 그대로 남습니다)')) return;
        hideVal(keyOf(inp), v);
        render(inp);
        if(typeof toast === 'function') toast('자동완성에서 뺐습니다');
      });
    });
  }

  /* ── 입력칸 하나에 붙이기 ──────────────────────────── */
  /* 화면 전용 id → 실제 데이터 칸 (페이지 제목칸은 pgTitle 이지만 데이터는 title 이다) */
  var ID_ALIAS = { pgTitle:'title', pgSubIn:'title', pgBody:'detail', pgDetail:'detail',
                   lfIeTime:'', wlTitle:'title' };
  function keyOf(inp){
    var id = inp.id || '';
    if(id && ID_ALIAS.hasOwnProperty(id)) return ID_ALIAS[id];
    if(!id){
      /* 노션식 화면(데이터·페이지)의 편집칸은 id 가 없다 — 조상의 이름표로 찾는다 */
      try{
        var host = inp.closest && inp.closest('[data-ppid],[data-pid],[data-k],[data-key],[data-col]');
        if(!host) return '';
        var pid = host.getAttribute('data-ppid') || host.getAttribute('data-pid')
               || host.getAttribute('data-k')    || host.getAttribute('data-key')
               || host.getAttribute('data-col')  || '';
        if(!pid) return '';
        return (pid.slice(0, 2) === 'f:') ? pid.slice(2) : pid;   /* f:title → title */
      }catch(e){ return ''; }
    }
    id = id.replace(/^m-/, '')
           .replace(/^expV2/, '')      /* 지출창: expV2Vendor → Vendor */
           .replace(/^exp-?/, '')
           .replace(/-(new|list|sel)$/, '')
           .replace(/Input$/, '');     /* expV2TitleInput → Title */
    if(!id) return '';
    return id.charAt(0).toLowerCase() + id.slice(1);   /* Vendor → vendor */
  }

  /* 건드리지 않을 칸 — 이미 다른 자동완성이 붙었거나, 검색창이거나, 짧은 이름칸이 아닌 것 */
  /* m-material 은 뺐다 — 전용 검색창(m-material-list)이 있는 화면에서는
     아래 「-list 가 있으면 건너뛴다」 규칙이 알아서 비켜준다 */
  var SKIP_ID = ['m-field','m-contact',
                 'tpSearchInp','vpSearch','tpCfName','q','v43Search','searchInp',
                 'newMatName','newMatVendor','wlSfBox'];
  /* 흡수 대상 — 옛 자동완성을 끄고 이 엔진으로 통일한다 (제목·위치) */
  var TAKEOVER = ['m-title','m-loc'];
  function shouldSkip(inp){
    if(!inp || inp._sfDone) return true;
    var tag = (inp.tagName || '').toLowerCase();
    if(tag === 'textarea'){
      /* 긴 글 칸도 붙이되, 줄바꿈이 들어간 순간부터는 목록을 안 띄운다 */
      if((inp.value || '').indexOf('\n') >= 0) return true;
    }else{
      var t = (inp.getAttribute('type') || 'text').toLowerCase();
      if(['text','search',''].indexOf(t) < 0) return true;    /* 날짜·시간·숫자·전화 제외 */
    }
    var id = inp.id || '';
    if(!id){
      /* 노션식 편집칸만 예외로 받아준다 (어느 칸인지 알아낼 수 있을 때만) */
      var isIE = inp.classList && inp.classList.contains('lf-ie');
      if(!isIE) return true;
      if(!keyOf(inp)) return true;
      return false;
    }
    if(SKIP_ID.indexOf(id) >= 0) return true;
    /* 이름 칸은 통화 모달에만 전용 자동완성이 있다 — 그때만 비켜준다 */
    if(id === 'm-name'){
      var mk = '';
      try{ mk = window._mKind || ''; }catch(e){ mk = ''; }
      if(mk === 'call' || inp._callACwired) return true;
    }
    if(/search|검색/i.test(id)) return true;
    if(TAKEOVER.indexOf(id) < 0){                              /* 흡수 대상은 아래 검사를 건너뛴다 */
      if(inp.getAttribute('list')) return true;                /* datalist 붙은 칸 */
      if(document.getElementById(id + '-list')) return true;   /* 기존 커스텀 목록 */
    }
    if(inp._callACwired || inp._tacWired || inp._fsWired) return true;
    if(inp.readOnly || inp.disabled) return true;
    if(inp.closest && inp.closest('#wlSfBox')) return true;
    return false;
  }

  /* 옛 자동완성 끄기 — 박스를 없애면 옛 코드는 `if(!box) return` 으로 조용히 빠진다 */
  function takeover(inp){
    var id = inp.id;
    if(TAKEOVER.indexOf(id) < 0) return;
    try{
      var l = inp.getAttribute('list');
      if(l){
        inp.removeAttribute('list');
        var dl = document.getElementById(l);
        if(dl && dl.parentNode) dl.parentNode.removeChild(dl);   /* datalist 제거 */
      }
      if(id === 'm-title'){
        var b = document.getElementById('titleAcBox');
        if(b && b.parentNode) b.parentNode.removeChild(b);       /* 옛 커스텀 드롭다운 제거 */
        inp._acBound = true;                                     /* 다시 붙지 않게 */
        migrateOldHidden();                                      /* 지웠던 문구를 이어받는다 */
      }
    }catch(e){ console.warn('[입력도우미] 옛 자동완성 끄기 실패 (' + id + ')', e); }
  }

  /* 옛 숨김 목록(wl_title_hidden)을 새 숨김 목록으로 한 번만 옮긴다 */
  var _migrated = false;
  function migrateOldHidden(){
    if(_migrated) return;
    _migrated = true;
    try{
      var old = JSON.parse(localStorage.getItem('wl_title_hidden') || '[]');
      if(!Array.isArray(old) || !old.length) return;
      for(var i = 0; i < old.length; i++) hideVal('title', old[i]);
      console.log('[입력도우미] 예전에 뺀 제목 ' + old.length + '건을 이어받았습니다');
    }catch(e){ console.warn('[입력도우미] 옛 숨김 목록 이어받기 실패', e); }
  }

  function attach(inp){
    if(shouldSkip(inp)) return;
    inp._sfDone = true;
    takeover(inp);
    inp.setAttribute('autocomplete', 'off');

    var composing = false;
    inp.addEventListener('compositionstart', function(){ composing = true; });
    inp.addEventListener('compositionend',   function(){ composing = false; if(cfg().ac) render(inp); });
    inp.addEventListener('input', function(){
      if(!cfg().ac) return;
      if(composing) return;                 /* 조합 중에는 건드리지 않는다 (자모 분리 방지) */
      if((inp.value || '').indexOf('\n') >= 0){ closeBox(); return; }   /* 여러 줄이면 글쓰기 중 */
      render(inp);
    });
    inp.addEventListener('focus', function(){ if(cfg().ac) render(inp); });
    inp.addEventListener('blur',  function(){
      setTimeout(function(){ if(boxFor === inp) closeBox(); }, 120);
      syncBadge(inp);
      warnSimilar(inp);
    });
    inp.addEventListener('keydown', function(ev){
      if(ev.key === 'Escape') closeBox();
    });
    if((inp.value || '').trim()) syncBadge(inp);
  }

  /* ── 「비슷한 이름이 있어요」 — 새 값을 처음 만들 때 한 번만 ── */
  var warned = {};
  function warnSimilar(inp){
    if(!cfg().ac) return;
    var key = keyOf(inp);
    var v = (inp.value || '').trim();
    if(!canSuggest(v, key)) return;
    if(countOf(key, v) > 0) return;                 /* 이미 있는 값이면 조용히 */
    var wk = key + '|' + v;
    if(warned[wk]) return;
    var n = normKey(v); if(n.length < 2) return;
    var all = candFor(key), same = null;
    for(var i = 0; i < all.length; i++){
      if(normKey(all[i].v) === n){ same = all[i]; break; }
    }
    if(!same) return;
    warned[wk] = 1;
    if(confirm('비슷한 이름이 이미 있어요.\n\n  기존 : ' + same.v + '  (' + same.n + '건)\n  입력 : ' + v
             + '\n\n[확인] 기존 것으로 맞출까요?\n[취소] 새 이름 그대로 둡니다')){
      inp.value = same.v;
      syncBadge(inp);
      try{ inp.dispatchEvent(new Event('input', {bubbles:true})); }catch(e){}
    }
  }

  /* ── ③ 빈 칸 접기 ─────────────────────────────────── */
  function foldEmpty(root){
    if(!cfg().fold) return;
    if(!root) return;
    var wraps = root.querySelectorAll('.field');
    var hidden = 0;
    for(var i = 0; i < wraps.length; i++){
      var w = wraps[i];
      if(w._sfKeep) continue;
      var el = w.querySelector('input, select, textarea');
      if(!el) continue;
      var id = el.id || '';
      if(/date|time|title|kind|status/i.test(id)) continue;   /* 늘 보여야 하는 칸 */
      var v = (el.value || '').trim();
      if(v) continue;
      w.style.display = 'none';
      w._sfFolded = true;
      hidden++;
    }
    var bar = root.querySelector('[data-sffold]');
    if(hidden > 0){
      if(!bar){
        bar = document.createElement('div');
        bar.setAttribute('data-sffold', '1');
        bar.style.cssText = 'grid-column:1/-1;margin:6px 0;padding:8px 12px;border-radius:9px;'
          + 'background:#f8fafc;border:1px dashed #cbd5e1;color:#64748b;font-size:12.5px;'
          + 'cursor:pointer;text-align:center;font-family:inherit';
        bar.addEventListener('click', function(){
          root.querySelectorAll('.field').forEach(function(w){
            if(w._sfFolded){ w.style.display = ''; w._sfKeep = true; w._sfFolded = false; }
          });
          bar.remove();
        });
        root.insertBefore(bar, root.firstChild);
      }
      bar.textContent = '＋ 비어 있는 항목 ' + hidden + '개 — 눌러서 펼치기';
    }else if(bar){ bar.remove(); }
  }

  /* ── 날짜·시각 칸 빠른 버튼 (v102) ─────────────────────
     옛 입력창에만 있던 [어제][3일전][지금][+30분] 을 노션식에도 붙인다 */
  function ymd(d){
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
         + '-' + String(d.getDate()).padStart(2,'0');
  }
  function dayShift(n){
    var k = (typeof kstNow === 'function') ? kstNow() : new Date();
    var p = ymd(k).split('-');
    var d = new Date(Date.UTC(+p[0], +p[1]-1, +p[2]));   /* 날짜 셈은 UTC 로 (하루 밀림 방지) */
    d.setUTCDate(d.getUTCDate() + n);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0')
         + '-' + String(d.getUTCDate()).padStart(2,'0');
  }
  function hhmm(mins){
    var k = (typeof kstNow === 'function') ? kstNow() : new Date();
    var t = k.getHours()*60 + k.getMinutes() + (mins || 0);
    t = ((t % 1440) + 1440) % 1440;
    t = Math.round(t/5)*5; if(t >= 1440) t -= 1440;      /* 5분 단위 (달님 표준) */
    return String(Math.floor(t/60)).padStart(2,'0') + ':' + String(t%60).padStart(2,'0');
  }
  function setVal(inp, v){
    inp.value = v;
    try{ inp.dispatchEvent(new Event('input',  {bubbles:true})); }catch(e){}
    try{ inp.dispatchEvent(new Event('change', {bubbles:true})); }catch(e){}
  }
  function quickChips(inp){
    if(!cfg().quick) return;
    if(inp._sfChip) return;
    /* 옛 입력창에는 이미 같은 버튼이 있다 — 중복으로 붙이지 않는다 */
    try{ if(inp.closest && inp.closest('#overlay')) { inp._sfChip = true; return; } }catch(e){}
    var ty = (inp.getAttribute('type') || '').toLowerCase();
    var isDate = (ty === 'date');
    /* v105: 시각 칸 칩은 없앴다 — 시계 창 안에 ± 와 분 단위·소요시간이 들어갔다 */
    if(!isDate) return;
    var isTime = false;
    inp._sfChip = true;

    var bar = document.createElement('div');
    bar.className = 'sf-chips';
    bar.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;margin-top:5px';
    var items = isDate
      ? [['오늘',0],['어제',-1],['2일전',-2],['3일전',-3]]
      : [['🕐 지금',0],['+30분',30],['−30분',-30],['지우기',null]];
    items.forEach(function(it){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it[0];
      b.style.cssText = 'height:30px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:9px;'
        + 'background:#f7faff;color:#5b7fa6;font-size:12px;font-weight:700;'
        + 'cursor:pointer;font-family:inherit;line-height:1';
      b.addEventListener('mousedown', function(ev){
        ev.preventDefault();
        try{
          if(isDate) setVal(inp, dayShift(it[1]));
          else if(it[1] === null) setVal(inp, '');
          else setVal(inp, hhmm(it[1]));
        }catch(e){ console.warn('[빠른버튼] 넣기 실패', e); }
      });
      bar.appendChild(b);
    });
    try{
      var box = inp.parentNode;
      if(box) box.appendChild(bar);
    }catch(e){ console.warn('[빠른버튼] 붙이기 실패', e); }
  }

  /* ── 화면에 나타나는 칸을 자동으로 잡는다 ──────────── */
  var scanT = null;
  function scanNow(){
    try{
      document.querySelectorAll('input, textarea, .lf-ie').forEach(function(el){
        var tg = (el.tagName || '').toLowerCase();
        if(tg === 'input' || tg === 'textarea') attach(el);
      });
      ['mFields','mxWrap','expV2Overlay'].forEach(function(id){
        var r = document.getElementById(id);
        if(r) foldEmpty(r);
      });
    }catch(e){ console.warn('[입력도우미] 훑기 실패', e); }
  }
  function scan(){
    clearTimeout(scanT);
    scanT = setTimeout(scanNow, 150);
  }

  try{
    var mo = new MutationObserver(function(muts){
      for(var i = 0; i < muts.length; i++){
        if(muts[i].addedNodes && muts[i].addedNodes.length){ scan(); return; }
      }
    });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }catch(e){ console.warn('[입력도우미] 감시 시작 실패', e); }

  /* 클릭해서 칸이 막 생긴 경우 감시(150ms)보다 빠르게 붙인다 */
  document.addEventListener('focusin', function(ev){
    var el = ev.target;
    if(!el) return;
    var tag = (el.tagName || '').toLowerCase();
    if(tag !== 'input' && tag !== 'textarea') return;
    try{ quickChips(el); }catch(e){ console.warn('[빠른버튼] 실패', e); }
    if(el._sfDone) return;
    try{
      attach(el);
      if(el._sfDone && cfg().ac) setTimeout(function(){ render(el); }, 30);
    }catch(e){ console.warn('[입력도우미] 즉시 붙이기 실패', e); }
  }, true);

  window.addEventListener('scroll', function(){ if(boxFor) placeBox(boxFor); }, true);
  window.addEventListener('resize', closeBox);
  document.addEventListener('mousedown', function(ev){
    if(box && box.style.display === 'block' && !box.contains(ev.target) && ev.target !== boxFor) closeBox();
  });

  /* ── 진단 탭 스위치 ────────────────────────────────── */
  function panel(){
    var anchor = document.getElementById('opNow');
    var host = anchor && anchor.parentNode ? anchor.parentNode.parentNode : null;
    if(!host) return;
    if(document.getElementById('sfPanel')) { paintPanel(); return; }

    var head = document.createElement('div');
    head.className = 'sec-head';
    head.textContent = '✨ 입력 도우미';

    var wrap = document.createElement('div');
    wrap.id = 'sfPanel';
    wrap.innerHTML =
      '<div style="font-size:12.5px;color:#7a92a8;margin-bottom:6px">'
      + '입력칸에 저장된 값을 띄워 오타를 막습니다. 이상하면 여기서 끄면 원래대로 돌아갑니다.</div>'
      + '<div class="btn-row" style="margin-top:0">'
      + '<button class="btn btn-sm" id="sfAc"   style="min-height:44px">🔤 자동완성·초성검색</button>'
      + '<button class="btn btn-sm" id="sfLink" style="min-height:44px">🔗 연락처 정보 표시</button>'
      + '<button class="btn btn-sm" id="sfFold" style="min-height:44px">📁 빈 칸 접기</button>'
      + '<button class="btn btn-sm" id="sfIdsave" style="min-height:44px">🆔 업체 아이디 남기기</button>'
      + '<button class="btn btn-sm" id="sfQuick" style="min-height:44px">⏱ 날짜·시각 빠른버튼</button>'
      + '<button class="btn btn-ghost btn-sm" id="sfUnhide" style="min-height:44px">👁 뺀 값 되살리기</button>'
      + '</div><div id="sfNow" style="font-size:12.5px;color:#7a92a8;margin-top:6px"></div>';

    host.insertBefore(head, anchor.parentNode.nextSibling);
    host.insertBefore(wrap, head.nextSibling);

    [['sfAc','ac'],['sfLink','link'],['sfFold','fold'],['sfIdsave','idsave'],['sfQuick','quick']].forEach(function(p){
      var el = document.getElementById(p[0]);
      if(el && !el._bound){
        el._bound = 1;
        el.addEventListener('click', function(){
          var c = cfg();
          cfgSet(p[1], !c[p[1]]);
          paintPanel();
          if(p[1] === 'fold' && typeof toast === 'function') toast('입력창을 다시 열면 반영됩니다');
        });
      }
    });
    var u = document.getElementById('sfUnhide');
    if(u && !u._bound){
      u._bound = 1;
      u.addEventListener('click', function(){
        unhideAll();
        _cacheAt = 0;
        paintPanel();
        if(typeof toast === 'function') toast('뺀 값을 모두 되살렸습니다');
      });
    }
    paintPanel();
  }
  function paintPanel(){
    var c = cfg();
    [['sfAc','ac'],['sfLink','link'],['sfFold','fold'],['sfIdsave','idsave'],['sfQuick','quick']].forEach(function(p){
      var el = document.getElementById(p[0]); if(!el) return;
      el.className = 'btn btn-sm ' + (c[p[1]] ? 'btn-primary' : 'btn-ghost');
      el.style.minHeight = '44px';
    });
    var n = document.getElementById('sfNow'); if(!n) return;
    var m = buildCache(), keys = 0, vals = 0;
    for(var k in m){ keys++; for(var v in m[k]) vals++; }
    var hid = 0;
    try{
      var ho = JSON.parse(localStorage.getItem(LS_HIDE) || '{}');
      for(var kk in ho) hid += (ho[kk] || []).length;
    }catch(e){}
    n.textContent = '지금: ' + (c.ac ? '자동완성 켜짐' : '자동완성 꺼짐')
      + ' · ' + (c.link ? '연락처 표시 켜짐' : '연락처 표시 꺼짐')
      + ' · ' + (c.fold ? '빈 칸 접기 켜짐' : '빈 칸 접기 꺼짐')
      + ' · ' + (c.idsave ? '업체 아이디 남김' : '업체 아이디 안 남김')
      + '  |  후보 ' + vals + '개 / 칸 ' + keys + '종' + (hid ? ' · 뺀 값 ' + hid + '개' : '');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 1500);
  setTimeout(scanNow, 800);

  /* ── ④ 저장할 때 업체 「아이디」와 사본을 같이 남긴다 ────────
     제1원칙 — 이름이 아니라 아이디로 가리킨다.
     · 기존 칸은 하나도 안 건드리고 칸 3개(companyId·companySnap·companyAt)만 더한다
     · 옛 기록은 그대로 — 새로 저장하는 것부터 붙는다
     · 진단 탭 「🆔 업체 아이디 남기기」로 끌 수 있다 */
  var LINK_SAVE_KEYS = ['company','vendor','workVendor'];
  function stampLink(rec){
    if(!rec || typeof rec !== 'object') return rec;
    if(!cfg().idsave) return rec;
    try{
      for(var i = 0; i < LINK_SAVE_KEYS.length; i++){
        var k = LINK_SAVE_KEYS[i];
        var v = rec[k];
        if(typeof v !== 'string' || !v.trim()) continue;
        var c = findContact(v);
        if(!c || !c.id) continue;
        if(rec[k + 'Id'] === c.id) continue;          /* 이미 같은 것 */
        rec[k + 'Id']   = c.id;                        /* ★ 연결 */
        rec[k + 'Snap'] = {                            /* 그때의 사본 — 연결이 끊겼을 때만 쓴다 */
          name:    c.name    || '',
          phone:   c.phone   || '',
          company: c.company || '',
          role:    c.role    || c.position || '',
          cat:     c.cat     || ''
        };
        rec[k + 'At'] = kstNow().toISOString().slice(0, 10);
      }
    }catch(e){ console.warn('[입력도우미] 업체 아이디 남기기 실패', e); }
    return rec;
  }
  try{
    if(typeof addRecord === 'function' && !addRecord._sfWrapped){
      var _origAdd = addRecord;
      addRecord = function(data){ return _origAdd.call(this, stampLink(data)); };
      addRecord._sfWrapped = true;
      window.addRecord = addRecord;
    }
    if(typeof updateRecord === 'function' && !updateRecord._sfWrapped){
      var _origUpd = updateRecord;
      updateRecord = function(id, patch){ return _origUpd.call(this, id, stampLink(patch)); };
      updateRecord._sfWrapped = true;
      window.updateRecord = updateRecord;
    }
  }catch(e){ console.warn('[입력도우미] 저장 감싸기 실패', e); }

  /* ── 콘솔 도구 ─────────────────────────────────────── */
  window.wlSmartField = {
    on:   function(){ cfgSet('ac',1); cfgSet('link',1); paintPanel(); return cfg(); },
    off:  function(){ cfgSet('ac',0); cfgSet('link',0); cfgSet('fold',0); paintPanel(); closeBox(); return cfg(); },
    cfg:  cfg,
    set:  function(k,v){ var c = cfgSet(k,v); paintPanel(); return c; },
    info: function(){
      var m = buildCache(), out = [];
      for(var k in m){
        var n = 0; for(var v in m[k]) if(m[k][v] >= minOf(k)) n++;
        if(n) out.push({ 칸:k, 후보수:n });
      }
      out.sort(function(a,b){ return b.후보수 - a.후보수; });
      console.table(out.slice(0, 25));
      return out.length + '개 칸에 후보가 있습니다';
    },
    cand:    function(key){ console.table(candFor(key).slice(0,20)); },
    chosung: chosung,
    rescan:  function(){ _cacheAt = 0; scanNow(); return '다시 훑었습니다'; },
    unhide:  function(){ unhideAll(); _cacheAt = 0; return '뺀 값을 모두 되살렸습니다'; },
    /* ★ 왜 안 뜨는지 그대로 말해준다 — 칸을 클릭해 둔 채로 부른다 */
    why: function(el){
      var inp = el || document.activeElement;
      if(!inp || ['INPUT','TEXTAREA'].indexOf(inp.tagName) < 0){
        console.log('%c먼저 확인할 입력칸을 클릭한 뒤 다시 불러주세요.', 'color:#b45309;font-weight:700');
        return '입력칸이 아닙니다';
      }
      var c = cfg();
      var id = inp.id || '(이름표 없음)';
      var key = keyOf(inp);
      var host = inp.closest && inp.closest('[data-ppid],[data-pid],[data-k],[data-key],[data-col]');
      var reasons = [];
      if(!c.ac) reasons.push('진단 탭에서 「자동완성」이 꺼져 있습니다');
      if(!key)  reasons.push('이 칸이 어느 항목인지 알아낼 수 없습니다 (이름표도 없고 감싼 칸에 표시도 없음)');
      if(inp.readOnly) reasons.push('읽기 전용 칸입니다');
      if(inp.disabled) reasons.push('잠긴 칸입니다');
      if(SKIP_ID.indexOf(id) >= 0) reasons.push('제외 목록에 있는 칸입니다 (전용 자동완성이 따로 있음)');
      if(inp.getAttribute('list')) reasons.push('브라우저 기본 목록(datalist)이 붙어 있습니다');
      if(document.getElementById(id + '-list')) reasons.push('전용 검색창이 따로 붙어 있습니다');
      if(!inp._sfDone) reasons.push('이 칸에 아직 자동완성이 붙지 않았습니다');
      var all = key ? candFor(key) : [];
      if(key && !all.length) reasons.push('이 칸에 쓸 후보가 0개입니다 (최소 ' + minOf(key) + '번 이상 쓴 값만 후보, 글자수 ' + maxOf(key) + '자 이하)');
      var raw = key ? (buildCache()[key] || {}) : {};
      var rawN = 0; for(var _v in raw) rawN++;

      console.log('%c── 입력 도우미 진단 ──', 'color:#2563eb;font-weight:700');
      console.table([{
        '칸 이름표': id,
        '알아낸 항목': key || '(못 알아냄)',
        '감싼 표시': host ? (host.getAttribute('data-ppid') || host.getAttribute('data-pid') || host.getAttribute('data-k') || '') : '(없음)',
        '붙었나': inp._sfDone ? '예' : '아니오',
        '기록에서 모은 값': rawN,
        '후보로 쓸 값': all.length,
        '최소 횟수': key ? minOf(key) : '-',
        '글자수 상한': key ? maxOf(key) : '-'
      }]);
      if(all.length) console.table(all.slice(0, 10));
      if(reasons.length){
        console.log('%c안 뜨는 이유:', 'color:#dc2626;font-weight:700');
        reasons.forEach(function(r, i){ console.log('  ' + (i+1) + '. ' + r); });
      }else{
        console.log('%c막는 것이 없습니다 — 글자를 치면 떠야 합니다.', 'color:#0f7a4a;font-weight:700');
      }
      return reasons.length ? ('막는 것 ' + reasons.length + '가지') : '정상';
    },
    ids:     function(){          /* 업체 아이디가 실제로 붙었는지 확인 */
      var n = 0, out = [];
      try{
        (entries || []).forEach(function(e){
          if(!e) return;
          LINK_SAVE_KEYS.forEach(function(k){
            if(e[k + 'Id']){ n++; if(out.length < 15) out.push({ 기록:(e.title||e[k]||e.id), 칸:k, 아이디:e[k+'Id'], 남긴날:e[k+'At']||'' }); }
          });
        });
      }catch(e){ console.warn(e); }
      console.table(out);
      return '업체 아이디가 붙은 기록 ' + n + '건';
    }
  };

  console.log('[입력도우미] 준비됨 — 진단 탭 「✨ 입력 도우미」에서 켜고 끌 수 있어요');
})();


/* ============================================================
   🔗 연결 규칙 (wlRules)  v106-0829-1900
   기본지침 제4원칙 — 「만든 사람 없이도 늘릴 수 있어야 한다」

   지금까지 「업체를 넣으면 전화·직책이 따라온다」 는 코드에 박혀 있었다.
   그래서 새 연결을 만들려면 매번 손을 봐야 했다.
   이제 그 규칙을 데이터로 꺼내서, 화면에서 만들고 지울 수 있게 한다.

   규칙 = 「언제(조건)  →  무엇을(동작)」
     조건 : 어떤 칸이 [채워지면 / 비면 / 값이 ○○이면 / ○○을 담고 있으면]
     동작 : 다른 칸을 [보이게 / 숨기게 / 비우게]

   ▸ 값 채우기(업체→전화)는 이미 있는 기능이 하고, 여기서는 그 뒷정리를 맡는다
   ▸ 되돌리기 : wlRules.reset()  — 처음 규칙으로
   ============================================================ */
(function(){
  'use strict';

  var LS_RULES = 'wl_rules';
  var LS_ON    = 'wl_rules_on';

  /* ── 처음부터 들어 있는 규칙 ─────────────────────────── */
  /* ⚠ v112 — 칸 이름을 14종 전수 실측으로 다시 썼다 (기본지침 제0원칙)
        업체는 workVendor 가 아니라 **_sub** 다. v111 까지 한 번도 안 맞았다.
        업무   : _sub(업체) f:workContact f:workRole f:workPhone f:workMemo
                 f:material f:spec f:qty f:expType f:estimateMemo f:startTime f:endTime
        지출   : _sub(업체) f:expType f:purpose f:expSubType f:supplyAmt f:taxAmt
                 f:isIssued f:isJeonpyo
        통화   : _sub(상대) f:callContact f:role f:phone f:callField
        진행업무: _sub(담당 업체) f:ownerPhone f:status
        사고   : _sub(당사자) f:partyType f:partyPhone f:accType f:followUp
        입출고 : _sub(거래처) f:stockType f:qty f:unitPrice f:docNo f:useTarget  */
  var RVER = 3;                      /* 규칙 정의가 바뀌면 올린다 → 옛 저장본 자동 교체 */
  var LS_RVER = 'wl_rules_ver';
  function baseRules(){
    return [
      { id:'b1', on:1, base:1, name:'업체를 넣으면 담당자·직책·전화·메모가 나온다',
        when:{ k:'_sub', op:'filled' },
        then:{ act:'show', keys:['f:workContact','f:workRole','f:workPhone','f:workMemo',
                                 'f:callContact','f:role','f:phone','f:ownerPhone',
                                 'f:partyType','f:partyPhone'] } },
      { id:'b2', on:1, base:1, name:'업체를 지우면 딸린 값도 지운다',
        when:{ k:'_sub', op:'empty' },
        then:{ act:'clear', keys:['f:workContact','f:workRole','f:workPhone',
                                  'f:callContact','f:role','f:phone','f:ownerPhone'] } },
      { id:'b3', on:1, base:1, name:'업무 — 자재명을 넣으면 규격·수량·금액이 나온다',
        when:{ k:'f:material', op:'filled' },
        then:{ act:'show', keys:['f:spec','f:qty','_amount'] } },
      { id:'b4', on:1, base:1, name:'업무 — 자재명을 지우면 규격도 지운다',
        when:{ k:'f:material', op:'empty' },
        then:{ act:'clear', keys:['f:spec'] } },
      { id:'b5', on:1, base:1, name:'업무 — 후불청구면 업체·금액·견적메모가 나온다',
        when:{ k:'f:expType', op:'contains', v:'후불' },
        then:{ act:'show', keys:['_sub','_amount','f:estimateMemo','sec:att'] } },
      { id:'b6', on:1, base:1, name:'업무 — 개인비용이면 자재·수량·금액·사진이 나온다',
        when:{ k:'f:expType', op:'contains', v:'개인비용' },
        then:{ act:'show', keys:['f:material','f:qty','_amount','sec:pics'] } },
      { id:'b7', on:1, base:1, name:'업무 — 전표면 업체·금액·사진이 나온다',
        when:{ k:'f:expType', op:'contains', v:'전표' },
        then:{ act:'show', keys:['_sub','_amount','sec:pics'] } },
      { id:'b8', on:1, base:1, name:'지출 — 세금계산서면 발행여부·공급가액·부가세가 나온다',
        when:{ k:'f:expType', op:'contains', v:'계산서' },
        then:{ act:'show', keys:['f:isIssued','f:supplyAmt','f:taxAmt','f:expSubType'] } },
      { id:'b9', on:1, base:1, name:'지출 — 개인지출이면 용도·사진이 나온다',
        when:{ k:'f:expType', op:'contains', v:'개인지출' },
        then:{ act:'show', keys:['f:purpose','sec:pics'] } },
      { id:'b10', on:1, base:1, name:'시작 시각을 넣으면 끝난 시각이 나온다',
        when:{ k:'f:startTime', op:'filled' },
        then:{ act:'show', keys:['f:endTime'] } },
      { id:'b11', on:1, base:1, name:'사고 — 당사자를 넣으면 유형·연락처·후속조치가 나온다',
        when:{ k:'_sub', op:'filled' },
        then:{ act:'show', keys:['f:accType','f:followUp'] } },
      { id:'b12', on:1, base:1, name:'입출고 — 거래처를 넣으면 단가·전표번호가 나온다',
        when:{ k:'_sub', op:'filled' },
        then:{ act:'show', keys:['f:unitPrice','f:docNo'] } },
      { id:'b13', on:1, base:1, name:'미완료면 담당자·후속조치가 나온다',
        when:{ k:'f:status', op:'contains', v:'미완료' },
        then:{ act:'show', keys:['f:workContact','f:followUp'] } }
    ];
  }

  function isOn(){
    try{ return localStorage.getItem(LS_ON) !== '0'; }catch(e){ return true; }
  }
  function setOn(v){
    try{ localStorage.setItem(LS_ON, v ? '1' : '0'); }catch(e){ console.warn('[연결 규칙] 켜기 저장 실패', e); }
  }
  function load(){
    try{
      if(String(localStorage.getItem(LS_RVER)) !== String(RVER)){
        localStorage.removeItem(LS_RULES);            /* 옛 이름(workVendor…)을 쓰는 규칙은 버린다 */
        localStorage.setItem(LS_RVER, String(RVER));
        return baseRules();
      }
      var raw = localStorage.getItem(LS_RULES);
      if(!raw) return baseRules();
      var a = JSON.parse(raw);
      return Array.isArray(a) ? a : baseRules();
    }catch(e){ console.warn('[연결 규칙] 읽기 실패', e); return baseRules(); }
  }
  function save(arr){
    try{ localStorage.setItem(LS_RULES, JSON.stringify(arr)); localStorage.setItem(LS_RVER, String(RVER)); }
    catch(e){ console.warn('[연결 규칙] 저장 실패', e); }
  }

  /* ── 화면에서 칸 찾기 — 모달(m-키) · 노션식(data-ppid/pid) 모두 ── */
  /* v112 — 이름은 두 가지로 온다.
        · 옛 규칙 : workContact  (f: 없이)
        · 새 규칙 : f:workContact · _sub (data-prow 그대로)
     둘 다 받아들인다. 그리고 노션식 페이지는 **고치는 중이 아니면 입력칸이 없다**
     → 줄(.pg-prow)도 함께 돌려주고, 값은 보이는 글자에서 읽는다. */
  function idsOf(key){
    var k = String(key || '');
    if(!k) return [];
    if(k.charAt(0) === '_') return [k];                    /* 공통칸 _sub·_amount·_memo */
    if(k.slice(0,2) === 'f:') return [k, k.slice(2)];
    return ['f:' + k, k];
  }
  function fieldsIn(root, key){
    var out = [];
    try{
      var ids = idsOf(key);
      var el = (root.querySelector ? root.querySelector('#m-' + key.replace(/^f:/,'')) : null)
               || document.getElementById('m-' + key.replace(/^f:/,''));
      if(el) out.push(el);
      var sel = ids.map(function(i){
        return '[data-prow="'+i+'"],[data-ppid="'+i+'"],[data-pid="'+i+'"]'; }).join(',');
      var hosts = root.querySelectorAll ? root.querySelectorAll(sel) : [];
      [].forEach.call(hosts, function(h){
        var ie = h.querySelector('.lf-ie, input, textarea, select');
        if(ie){ if(out.indexOf(ie) < 0) out.push(ie); return; }
        if(out.indexOf(h) < 0) out.push(h);                /* 입력칸이 없으면 줄 자체 */
      });
    }catch(e){ console.warn('[연결 규칙] 칸 찾기 실패 (' + key + ')', e); }
    return out;
  }
  /* 입력칸이면 value, 아니면 화면에 보이는 글자 */
  function readVal(el){
    try{
      if(el && 'value' in el && el.tagName && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)){
        if(el.type === 'checkbox') return el.checked ? '1' : '';
        return String(el.value == null ? '' : el.value).trim();
      }
      var pv = el && el.querySelector ? el.querySelector('.pg-pv') : null;
      var t = ((pv || el || {}).textContent || '').trim();
      if(!t || t === '비어 있음' || t === '\u2014') return '';
      return t;
    }catch(e){ return ''; }
  }
  function rowOf(el){
    try{ return el.closest('.pg-prow, .field, tr') || el.parentNode; }catch(e){ return el.parentNode; }
  }
  function valOf(root, key){
    var els = fieldsIn(root, key);
    for(var i = 0; i < els.length; i++){
      var v = readVal(els[i]);
      if(v) return v;
    }
    return '';
  }

  /* ── 조건이 맞나 ─────────────────────────────────────── */
  function match(root, w){
    if(!w || !w.k) return false;
    var v = valOf(root, w.k);
    switch(w.op){
      case 'filled':   return !!v;
      case 'empty':    return !v;
      case 'eq':       return v === String(w.v || '');
      case 'contains': return v.indexOf(String(w.v || '')) >= 0;
      default:         return false;
    }
  }

  /* ── 동작 ────────────────────────────────────────────── */
  function apply(root, rule){
    var keys = (rule.then && rule.then.keys) || [];
    var act  = (rule.then && rule.then.act) || 'show';
    for(var i = 0; i < keys.length; i++){
      /* sec:pics 처럼 적으면 아래쪽 큰 영역을 펼친다 (v109) */
      if(String(keys[i]).indexOf('sec:') === 0){
        if(act === 'show'){
          try{ if(typeof window.wlSecShow === 'function') window.wlSecShow(String(keys[i]).slice(4)); }
          catch(e){ console.warn('[연결 규칙] 영역 펼치기 실패', e); }
        }
        continue;
      }
      var els = fieldsIn(root, keys[i]);
      for(var j = 0; j < els.length; j++){
        var el = els[j], row = rowOf(el);
        if(act === 'show'){
          if(row && row._gHid) continue;                 /* 묶어보기가 접어 둔 줄은 건드리지 않는다 (v112) */
          if(row && row._userHid) continue;              /* ✋ 사람이 숨긴 칸도 건드리지 않는다 (v123) */
          if(row && row.style && row.style.display === 'none'){ row.style.display = ''; row._ruleShown = 1; }
          if(row) row._ruleKeep = 1;                     /* 빈 칸 접기가 다시 숨기지 않게 */
        }else if(act === 'hide'){
          if(row && row.style && !(el.value || '').trim()){ row.style.display = 'none'; }
        }else if(act === 'clear'){
          /* 조건이 된 칸 자체는 절대 안 건드린다 (업체를 지우려다 업체를 지우는 사고 방지) */
          if(keys[i] === (rule.when && rule.when.k)) continue;
          /* 사람이 직접 쓴 값은 지우지 않는다 — 연결에서 온 값만 */
          if(el._byLink === 1 || el.dataset.fromLink === '1'){
            if((el.value || '').trim()){
              el.value = '';
              try{ el.dispatchEvent(new Event('input',  {bubbles:true})); }catch(e){}
              try{ el.dispatchEvent(new Event('change', {bubbles:true})); }catch(e){}
            }
          }
        }
      }
    }
  }

  var runT = null;
  function runNow(root){
    if(!isOn()) return;
    var host = root || document;
    var rules = load();
    for(var i = 0; i < rules.length; i++){
      var r = rules[i];
      if(!r || !r.on) continue;
      try{ if(match(host, r.when)) apply(host, r); }
      catch(e){ console.warn('[연결 규칙] 적용 실패 — ' + (r.name || r.id), e); }
    }
  }
  function run(root){
    clearTimeout(runT);
    runT = setTimeout(function(){ runNow(root); }, 120);
  }

  /* 값이 바뀔 때마다 규칙을 다시 본다 */
  document.addEventListener('input',  function(ev){
    var t = ev.target; if(!t || ['INPUT','TEXTAREA','SELECT'].indexOf(t.tagName) < 0) return;
    run(t.closest('#mFields, .lf-page, #expV2Overlay, form, tr') || document);
  }, true);
  document.addEventListener('change', function(ev){
    var t = ev.target; if(!t || ['INPUT','TEXTAREA','SELECT'].indexOf(t.tagName) < 0) return;
    run(t.closest('#mFields, .lf-page, #expV2Overlay, form, tr') || document);
  }, true);
  /* v112 — 기록을 처음 열었을 때도 한 번 본다 (그전엔 값을 바꿔야만 돌았다) */
  var seenPg = null;
  setInterval(function(){
    try{
      var pg = document.querySelector('.lf-page .pg-props');
      if(pg && pg !== seenPg){ seenPg = pg; run(document.querySelector('.lf-page')); }
      else if(!pg) seenPg = null;
    }catch(e){ console.warn('[연결 규칙] 파수꾼 실패', e); }
  }, 400);
  try{
    var mo = new MutationObserver(function(m){
      for(var i = 0; i < m.length; i++) if(m[i].addedNodes && m[i].addedNodes.length){ run(); return; }
    });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }catch(e){ console.warn('[연결 규칙] 감시 시작 실패', e); }

  /* ── 규칙 만드는 화면 ───────────────────────────────── */
  var OPS = [['채워지면','filled'],['비면','empty'],['값이 같으면','eq'],['값을 담고 있으면','contains']];
  var ACTS = [['보이게','show'],['숨기게','hide'],['비우게','clear']];

  function openMgr(){
    var ov = document.createElement('div'); ov.className = 'ptw';
    function draw(){
      var rules = load();
      ov.innerHTML = '<div class="ptw-box" style="width:min(96vw,560px)">'
        + '<div class="ptw-h">🔗 연결 규칙</div>'
        + '<div class="ptw-s">「어떤 칸이 ○○이면 → 다른 칸을 ○○하게」 를 직접 만들 수 있어요.<br>'
        + '<b>업체를 넣으면 전화·직책이 나오는 것</b>도 아래 규칙 중 하나입니다.</div>'
        + '<div class="rl-list">' + rules.map(function(r, i){
            return '<div class="rl-row'+(r.on?'':' off')+'">'
              + '<button type="button" class="rl-tg" data-rlon="'+i+'" title="켜기 / 끄기">'+(r.on?'✔':'○')+'</button>'
              + '<div class="rl-nm">' + ES(r.name || '(이름 없음)')
              +   '<div class="rl-sub">' + ES(r.when.k) + ' 가 '
              +   ES((OPS.filter(function(o){return o[1]===r.when.op;})[0]||['?'])[0])
              +   (r.when.v ? ' (' + ES(r.when.v) + ')' : '') + ' → '
              +   ES((r.then.keys||[]).slice(0,4).join(', '))
              +   ' 를 ' + ES((ACTS.filter(function(a){return a[1]===r.then.act;})[0]||['?'])[0]) + '</div>'
              + '</div>'
              + (r.base ? '<span class="rl-base">기본</span>'
                        : '<button type="button" class="rl-del" data-rldel="'+i+'" title="지우기">🗑</button>')
              + '</div>';
          }).join('') + '</div>'
        + '<div class="rl-new">'
        +   '<div class="rl-nh">＋ 새 규칙</div>'
        +   '<div class="rl-nr">'
        +     '<input type="text" id="rlK" placeholder="칸 이름 (예: expType)" data-vac="off">'
        +     '<select id="rlOp">' + OPS.map(function(o){ return '<option value="'+o[1]+'">'+o[0]+'</option>'; }).join('') + '</select>'
        +     '<input type="text" id="rlV" placeholder="값 (같으면·담고 있으면 일 때)" data-vac="off">'
        +   '</div>'
        +   '<div class="rl-nr">'
        +     '<span class="rl-ar">→</span>'
        +     '<input type="text" id="rlT" placeholder="대상 칸 (쉼표로 여러 개)" data-vac="off">'
        +     '<select id="rlAct">' + ACTS.map(function(a){ return '<option value="'+a[1]+'">'+a[0]+'</option>'; }).join('') + '</select>'
        +     '<button type="button" id="rlAdd">추가</button>'
        +   '</div>'
        + '</div>'
        + '<div class="ptw-btns">'
        +   '<button type="button" id="rlReset" style="flex:1;border:1.5px solid #dbe6f4;background:#f7faff;color:#7a92a8">처음으로</button>'
        +   '<button type="button" id="rlClose" style="flex:2;background:#2563a8;color:#fff">닫기</button>'
        + '</div></div>';

      ov.querySelectorAll('[data-rlon]').forEach(function(b){
        b.addEventListener('click', function(){
          var a = load(); var i = +b.getAttribute('data-rlon');
          a[i].on = a[i].on ? 0 : 1; save(a); draw();
        });
      });
      ov.querySelectorAll('[data-rldel]').forEach(function(b){
        b.addEventListener('click', function(){
          var a = load(); var i = +b.getAttribute('data-rldel');
          if(!confirm('「' + (a[i].name || '') + '」 규칙을 지울까요?')) return;
          a.splice(i, 1); save(a); draw();
        });
      });
      ov.querySelector('#rlAdd').addEventListener('click', function(){
        var k  = (ov.querySelector('#rlK').value || '').trim();
        var op = ov.querySelector('#rlOp').value;
        var v  = (ov.querySelector('#rlV').value || '').trim();
        var t  = (ov.querySelector('#rlT').value || '').trim();
        var ac = ov.querySelector('#rlAct').value;
        if(!k || !t){ alert('칸 이름과 대상 칸을 적어주세요'); return; }
        if((op === 'eq' || op === 'contains') && !v){ alert('비교할 값을 적어주세요'); return; }
        var a = load();
        a.push({ id:'u_' + Date.now().toString(36), on:1,
          name: k + ' → ' + t,
          when:{ k:k, op:op, v:v },
          then:{ act:ac, keys: t.split(',').map(function(x){ return x.trim(); }).filter(Boolean) } });
        save(a); draw();
        if(typeof toast === 'function') toast('규칙을 추가했어요');
      });
      ov.querySelector('#rlReset').addEventListener('click', function(){
        if(!confirm('내가 만든 규칙이 모두 사라지고 처음 규칙으로 돌아갑니다. 계속할까요?')) return;
        try{ localStorage.removeItem(LS_RULES); }catch(e){}
        draw();
      });
      ov.querySelector('#rlClose').addEventListener('click', function(){ ov.remove(); runNow(); });
    }
    draw();
    ov.addEventListener('mousedown', function(e){ if(e.target === ov) { ov.remove(); runNow(); } });
    document.body.appendChild(ov);
  }
  function ES(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ── 진단 탭 버튼 ───────────────────────────────────── */
  function panel(){
    var host = document.getElementById('sfPanel');
    if(!host || document.getElementById('rlBtn')) return;
    var row = host.querySelector('.btn-row');
    if(!row) return;
    var b = document.createElement('button');
    b.className = 'btn btn-sm'; b.id = 'rlBtn'; b.style.minHeight = '44px';
    b.textContent = '🔗 연결 규칙';
    b.addEventListener('click', openMgr);
    row.appendChild(b);
    var t = document.createElement('button');
    t.className = 'btn btn-sm'; t.id = 'rlOnBtn'; t.style.minHeight = '44px';
    function paintT(){
      t.textContent = isOn() ? '🔗 규칙 켜짐' : '🔗 규칙 꺼짐';
      t.className = 'btn btn-sm ' + (isOn() ? 'btn-primary' : 'btn-ghost');
      t.style.minHeight = '44px';
    }
    t.addEventListener('click', function(){ setOn(!isOn()); paintT(); runNow(); });
    paintT();
    row.appendChild(t);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 1800);
  setTimeout(function(){ runNow(); }, 1000);

  window.wlRules = {
    list:  function(){ console.table(load().map(function(r){
             return { 켜짐:r.on?'✔':'', 이름:r.name, 조건:r.when.k+' '+r.when.op+(r.when.v?' '+r.when.v:''),
                      동작:r.then.act, 대상:(r.then.keys||[]).join(',') }; })); return load().length + '개'; },
    open:  openMgr,
    on:    function(){ setOn(1); runNow(); return '규칙 켜짐'; },
    off:   function(){ setOn(0); return '규칙 꺼짐'; },
    reset: function(){ try{ localStorage.removeItem(LS_RULES); }catch(e){} return '처음 규칙으로 돌아갔습니다'; },
    run:   function(){ runNow(); return '규칙을 다시 적용했습니다'; }
  };
  console.log('[연결 규칙] 준비됨 — 진단 탭 「🔗 연결 규칙」 에서 만들 수 있어요');
})();


/* ============================================================
   🗂 아래쪽 블록 접기 (wlSecs)  v109-0829-2130
   기본지침 제3원칙 3-3 「비어 있는 칸은 안 그린다」 를 큰 영역까지 넓힌 것

   노션식 페이지 아래에는 큰 영역이 여섯 개 있다.
     🧷 하위 항목 · ⏱ 소요 시간 · 📦 자재 사용 내역
     📎 파일·폴더 링크 · 📝 본문 · 📷 사진·첨부
   대부분 비어 있는데 늘 자리를 차지한다.

   ▸ 비어 있으면 접고, 맨 위에 [＋ 본문] 같은 단추만 남긴다
   ▸ 내용이 있으면 저절로 펼쳐진다
   ▸ 단추를 누르면 그 자리에 나타난다
   ▸ 연결 규칙에서 sec:pics 처럼 지정하면 조건에 따라 펼칠 수 있다
   ▸ 되돌리기 : 진단 탭 「🗂 빈 영역 접기」 를 끄면 전부 보인다
   ============================================================ */
(function(){
  'use strict';

  var LS_ON   = 'wl_secs_on';
  var LS_OPEN = 'wl_secs_open';     /* 사람이 편 것 — 기록마다 기억 */

  /* 2026-08-29 실측한 실제 제목들 */
  var SECS = [
    { key:'sub',  label:'하위 항목', icon:'🧷', re:/하위\s*항목/,        has:function(w){ return cnt(w,'.pg-subrow, .pg-sub li, [data-subid]'); } },
    /* v121 — 달님 : 「시간 추가는 없어도 돼」 → 늘 접어 두고 단추도 안 만든다.
          (시작·끝난 시각은 위 「🕐 시각 한 덩어리」에서 시계로 넣는다) */
    { key:'time', label:'소요 시간', icon:'⏱',  re:/소요\s*시간/,        chip:false,
      has:function(){ return false; } },
    { key:'mat',  label:'자재 내역', icon:'📦', re:/자재\s*사용/,         has:function(w){ return cnt(w,'.pg-matrow, [data-matdel]'); } },
    { key:'att',  label:'파일 링크', icon:'📎', re:/파일\s*[·ㆍ]\s*폴더/, has:function(w){ return cnt(w,'.pg-attrow, [data-attdel]'); } },
    /* ★ v113 — 페이지(전체 화면)로 볼 때는 본문을 늘 펼쳐 둔다.
          노션이 본문을 항상 보여 주는 이유와 같다 : 속성은 「미리 정한 질문의 답」이고,
          본문은 「아직 칸이 없는 것 전부」다. 닫아 두면 적을 곳이 없어져
          사람이 제목·비고에 욱여넣게 되고, 나중에 어떤 칸이 필요한지도 안 보인다.
          좁은 창에서만 접는다. */
    { key:'body', label:'본문',      icon:'📝', re:/본문/,               has:function(){ var t=document.getElementById('pgBodyTx');
                                                                                          if(isFullPage()) return true;
                                                                                          return !!(t && (t.textContent||'').trim().length); } },
    { key:'pics', label:'사진',      icon:'📷', re:/사진/,               has:function(w){ return cnt(w,'img'); } }
  ];
  function cnt(wrap, sel){
    try{ return wrap.some(function(el){ return el.querySelectorAll && el.querySelectorAll(sel).length > 0; }); }
    catch(e){ return false; }
  }

  var FORCE = {};                 /* 밖에서 정해 주는 펼침/접힘 (지출종류가 쓴다) */
  function isOn(){ try{ return localStorage.getItem(LS_ON) !== '0'; }catch(e){ return true; } }
  function setOn(v){ try{ localStorage.setItem(LS_ON, v ? '1' : '0'); }catch(e){ console.warn('[빈 영역] 설정 저장 실패', e); } }
  /* 지금 전체 페이지로 보고 있나 (창이면 .as-modal 이 붙는다) */
  function isFullPage(){
    try{
      var ov = document.getElementById('lfPageOv');
      return !!(ov && !/as-modal/.test(ov.className));
    }catch(e){ return false; }
  }
  function pageId(){
    try{ var m = String(location.hash||'').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function openedOf(){
    try{ var o = JSON.parse(localStorage.getItem(LS_OPEN) || '{}'); return (o && typeof o==='object') ? o : {}; }
    catch(e){ return {}; }
  }
  function markOpen(key){
    try{
      var o = openedOf(), id = pageId() || '_';
      if(!o[id]) o[id] = [];
      if(o[id].indexOf(key) < 0) o[id].push(key);
      var ks = Object.keys(o);                       /* 너무 쌓이지 않게 최근 40건만 */
      if(ks.length > 40) delete o[ks[0]];
      localStorage.setItem(LS_OPEN, JSON.stringify(o));
    }catch(e){ console.warn('[빈 영역] 펼침 기억 실패', e); }
  }
  function isOpened(key){
    var o = openedOf(), id = pageId() || '_';
    return (o[id] || []).indexOf(key) >= 0;
  }

  /* 이 제목줄이 이끄는 영역 — 다음 제목줄이나 구분선 앞까지 */
  function blockOf(head){
    var out = [head], n = head.nextElementSibling;
    while(n){
      if(n.classList && (n.classList.contains('pg-sec') || n.classList.contains('pg-div'))) break;
      out.push(n);
      n = n.nextElementSibling;
    }
    return out;
  }

  function run(){
    var body = document.querySelector('.lf-page .pg-body');
    if(!body) return;
    var heads = [].slice.call(body.querySelectorAll('.pg-sec'));
    if(!heads.length) return;

    /* 단추 줄 자리 */
    var bar = body.querySelector('#pgSecBar');
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'pgSecBar';
      bar.className = 'pg-secbar';
      var anchor = body.querySelector('.pg-div') || heads[0];
      if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor);
    }

    var chips = [];
    heads.forEach(function(h){
      var txt = (h.textContent || '').trim();
      var def = null;
      for(var i = 0; i < SECS.length; i++){ if(SECS[i].re.test(txt)){ def = SECS[i]; break; } }
      if(!def) return;

      var wrap = blockOf(h);
      var filled = false;
      try{ filled = !!def.has(wrap); }catch(e){ filled = true; }
      /* v123 — 사람이 정한 것은 wlUser 에 남는다. 자동 규칙은 이걸 못 이긴다 */
      var mine   = (window.wlUser ? window.wlUser.get('sec', def.key) : undefined);
      var forced = (mine === 1) || h._secForce || isOpened(def.key);
      var show   = !isOn() || filled || forced;
      if(mine === 0 && !filled) show = false;          /* 사람이 접었으면 접힌 채로 */
      /* v115 — 지출종류가 「이 기록에 무엇을 넣을지」 정한다.
            wlSecForce({mat:true, pics:false}) 처럼 밖에서 지시할 수 있게.
            단, 내용이 들어 있는 영역은 절대 감추지 않는다 (데이터가 안 보이면 안 된다) */
      var ovr = FORCE[def.key];
      if(ovr === true)  show = true;
      /* ★ v122 근본 수정 — 달님 : 「하위 항목·파일 링크가 안 눌러져」
            원인 : 지출종류 모드가 「이 영역은 접어라」고 지시하면,
                   사람이 ＋ 단추로 펼쳐도 그 지시가 이겨서 **도로 접혔다.**
                   그래서 단추가 아예 안 먹는 것처럼 보였다.
            규칙 : 사람이 직접 펼친 것은 어떤 지시보다 세다. */
      if(ovr === false && !filled && !forced) show = false;

      wrap.forEach(function(el){
        if(!el.style) return;
        if(show){ if(el._secHid){ el.style.display = ''; el._secHid = 0; } }
        else { if(el.style.display !== 'none'){ el._secPrev = el.style.display; el.style.display = 'none'; el._secHid = 1; } }
      });

      if(!show && def.chip !== false) chips.push({ key:def.key, label:def.label, icon:def.icon, head:h });
    });

    if(!chips.length){ bar.innerHTML = ''; bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = chips.map(function(c){
      return '<button type="button" class="pg-secb" data-secadd="' + c.key + '">＋ ' + c.icon + ' ' + c.label + '</button>';
    }).join('');
    bar.querySelectorAll('[data-secadd]').forEach(function(b){
      b.addEventListener('click', function(){
        var k = b.getAttribute('data-secadd');
        var hit = chips.filter(function(c){ return c.key === k; })[0];
        if(hit && hit.head){ hit.head._secForce = 1; markOpen(k); }
        try{ if(window.wlUser) window.wlUser.set('sec', k, 1); }catch(e){}   /* ✋ 사람이 폈다 */
        if(typeof window.wlAfterPaint === 'function') window.wlAfterPaint(); else run();
        setTimeout(function(){
          try{
            if(k === 'body'){ var t = document.getElementById('pgBodyTx'); if(t) t.focus(); }
            if(hit && hit.head && hit.head.scrollIntoView) hit.head.scrollIntoView({block:'center'});
          }catch(e){}
        }, 60);
      });
    });
  }

  /* 연결 규칙에서 sec:pics 처럼 부를 수 있게 */
  window.wlSecShow = function(key){
    var body = document.querySelector('.lf-page .pg-body'); if(!body) return false;
    var heads = [].slice.call(body.querySelectorAll('.pg-sec'));
    for(var i = 0; i < heads.length; i++){
      var txt = (heads[i].textContent || '').trim();
      for(var j = 0; j < SECS.length; j++){
        if(SECS[j].key === key && SECS[j].re.test(txt)){
          heads[i]._secForce = 1; markOpen(key); run(); return true;
        }
      }
    }
    return false;
  };

  var t = null;
  function later(){ clearTimeout(t); t = setTimeout(run, 150); }
  try{
    var mo = new MutationObserver(function(m){
      for(var i = 0; i < m.length; i++) if(m[i].addedNodes && m[i].addedNodes.length){ later(); return; }
    });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }catch(e){ console.warn('[빈 영역] 감시 시작 실패', e); }
  document.addEventListener('input', function(ev){
    var t2 = ev.target;
    if(t2 && (t2.id === 'pgBodyTx' || (t2.closest && t2.closest('.pg-body')))) later();
  }, true);
  setTimeout(run, 1200);
  /* v118 — 파수꾼을 각자 돌리지 않는다. 그리는 차례는 wlPaint 한 곳에서 정한다 */
  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:10, n:'빈 영역 접기', f:run });

  /* 진단 탭 스위치 */
  function panel(){
    var host = document.getElementById('sfPanel');
    if(!host || document.getElementById('secBtn')) return;
    var row = host.querySelector('.btn-row'); if(!row) return;
    var b = document.createElement('button');
    b.id = 'secBtn'; b.style.minHeight = '44px';
    function paint(){
      b.textContent = isOn() ? '🗂 빈 영역 접힘' : '🗂 빈 영역 다 보임';
      b.className = 'btn btn-sm ' + (isOn() ? 'btn-primary' : 'btn-ghost');
      b.style.minHeight = '44px';
    }
    b.addEventListener('click', function(){ setOn(!isOn()); paint(); run(); });
    paint(); row.appendChild(b);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 2000);

  /* 밖에서 부르는 통로 — {mat:true, pics:false, ...} · null 이면 지시 해제 */
  window.wlSecForce = function(map){
    var next = (map && typeof map === 'object') ? map : {};
    var a = JSON.stringify(FORCE), b = JSON.stringify(next);
    FORCE = next;
    if(a !== b) run();          /* 달라졌을 때만 다시 그린다 — 되돌이 방지 (v118) */
    return FORCE;
  };

  window.wlSecs = {
    on:  function(){ setOn(1); run(); return '빈 영역을 접습니다'; },
    off: function(){ setOn(0); run(); return '전부 보입니다'; },
    show: window.wlSecShow,
    run: function(){ run(); return '다시 살폈습니다'; },
    forget: function(){ try{ localStorage.removeItem(LS_OPEN); }catch(e){} run(); return '펼침 기억을 지웠습니다'; }
  };
  console.log('[빈 영역] 준비됨 — 비어 있는 아래쪽 영역을 접고 단추로 꺼내 씁니다');
})();


/* ============================================================
   🧩 연관 속성 묶어보기 (wlGroup)  v112-0829-2350
   기본지침 제0원칙 — 「짐작하지 않는다. 14종을 열어 이름을 직접 뽑았다」

   ⚠ v110 까지 틀렸던 것
      업체 칸 이름을 workVendor 로 짐작했는데, 노션식 화면에서는
      공통 칸 **_sub** 다. (2026-08-29 14종 전수 실측)
      그래서 묶음도 연결 규칙도 한 번도 맞은 적이 없었다.

   하는 일
     ① 대표 값이 있으면  →  한 줄로 접는다
          🏢 (주)은진 · 조홍석 · 상무 · 010-6265-4001      [펼치기]
     ② 대표 값이 비었으면 →  접지 않고 **한 덩어리로 띠를 둘러** 보여준다
          (담당자가 지출종류 옆에 홀로 떠 있지 않게 — 새 줄에서 시작한다)
     ③ 펼친 것은 [접기] 로 다시 접힌다
     ④ 페이지·창(모달) 둘 다 같은 코드가 돈다 (.lf-page 는 공통 뿌리)

   되돌리기 : 진단 탭 「🧩 연관 묶어보기」 를 끄면 원래대로
   ============================================================ */
(function(){
  'use strict';

  var LS_ON  = 'wl_group_on';
  var LS_GRP = 'wl_groups';
  var VER    = 8;                    /* 묶음 정의가 바뀌면 올린다 → 옛 저장본 자동 교체 */
  var LS_VER = 'wl_groups_ver';

  /* ── 2026-08-29 14종 전수 실측 결과로 만든 묶음 ──
        이름은 data-prow 값 그대로 쓴다 (_sub · f:workContact …) */
  function baseGroups(){
    return [
      /* v117 — 달님 : 「이쪽 목록의 이름을 만들어줘」
            날짜·대상년월·층·분야·상태 = 「언제 · 어디서 · 무엇」 한 덩어리.
            평소에는 펼쳐 두고, 접으면 한 줄로 요약된다. */
      { id:'g0', on:1, base:1, icon:'📌', name:'기본 — 언제 · 어디서 · 무엇', head:'_date',
        keys:['f:refYear','f:refMonth','f:floor','f:field','f:status'], openDefault:1 },
      /* v121 — 달님 : 「업체랑 자재가 한 덩어리로 나와. 구분하고 그룹 지어줘」
            용도·구분은 돈 이야기지 업체 이야기가 아니다 → 💰 비용 묶음으로 옮겼다. */
      { id:'gc', on:1, base:1, icon:'💰', name:'비용 — 얼마를 어떻게', head:'f:expType',
        keys:['f:expSubType','f:purpose','f:supplyAmt','f:taxAmt','_amount','f:isIssued'],
        openDefault:1 },
      /* v124 — 달님 : 「자재도 자재 제목 넣어줘 별도로 구분되게」 */
      { id:'gt', on:1, base:1, icon:'📦', name:'자재 — 무엇을 썼나', head:'f:material',
        keys:['f:spec','f:qty','f:matCost'], openDefault:1 },   /* v135 — 자재 합계도 자재 묶음 안에 */
      /* ★ v126 — 달님 : 「개인비용 입력하고 접기 하니까 자재·업체·시각 입력 창이 사라졌어」
            원인 : 대표 값이 있으면 **저절로 접히는** 것이 기본이었다.
                   업체·시각처럼 값이 이미 있는 덩어리는 열자마자 접혀 있어서
                   「입력칸이 사라진 것」으로 보였다.
            → 기본은 **펼침**. 접는 것은 사람이 [접기] 를 누를 때만.
              (사람이 접은 것은 그대로 기억된다 — v123 규칙) */
      { id:'g1', on:1, base:1, icon:'🏢', name:'업체 — 누구와', head:'_sub', openDefault:1,
        keys:['f:workContact','f:workRole','f:workPhone','f:workMemo',   /* 업무 */
              'f:callContact','f:role','f:phone',                        /* 통화 */
              'f:ownerPhone',                                            /* 진행업무 */
              'f:partyType','f:partyPhone'] },                           /* 사고 */
      /* v118 — 자재 속성 칸(자재명·규격·수량)은 더 이상 묶지 않는다.
            진짜 자재는 「자재 사용 내역」이고, 그것은 위쪽 📦 줄이 보여준다.
            비어 있을 때 「(자재명 없음) · 0」 같은 줄이 나와서 오히려 헷갈렸다. */
      { id:'g3', on:1, base:1, icon:'🕐', name:'시각 — 언제부터 언제까지', head:'f:startTime',
        keys:['f:endTime'], even:1, sep:' ~ ', openDefault:1 },   /* 시작·끝은 대등하므로 굵기를 같게 */
      /* 🧾 세금계산서 칸들은 일부러 묶지 않는다 —
            「세금계산서를 고르면 발행여부가 나온다」는 연결 규칙이 보여줘야 하는데,
            묶어버리면 접혀서 안 보인다. (2026-08-29 실측으로 확인) */
      { id:'g5', on:1, base:1, icon:'🏷', name:'품목 한 덩어리', head:'f:itemName',
        keys:['f:unitPrice','f:docNo','f:useTarget'] }
    ];
  }

  /* v117 — 접고 편 상태는 줄(DOM)이 아니라 묶음 이름으로 기억한다.
        화면을 다시 그리면 줄이 새로 만들어져서 예전에는 매번 되돌아갔다.

     ★ v127 — 달님 : 「연결된 지출 보기만 누르면 창이 다 접혀서 없는 걸로 보여」
        원인 : 이 기억이 **종류를 가리지 않았다.**
               업무에서 💰 비용을 접으면 그 기억이 지출 화면까지 따라갔고,
               지출 화면에는 덩어리가 그것 하나뿐이라 통째로 접힌 것처럼 보였다.
               (보이는 칸 23개 → 4개)
        → 종류마다 따로 기억한다. 업무에서 접은 것은 업무에서만. */
  var OPEN = {};
  function okey(gid){
    var k = '';
    try{ k = (window.wlUser && window.wlUser.kind) ? (window.wlUser.kind() || '') : ''; }catch(e){}
    return (k || '_') + '|' + gid;
  }
  function isOn(){ try{ return localStorage.getItem(LS_ON) !== '0'; }catch(e){ return true; } }
  function setOn(v){ try{ localStorage.setItem(LS_ON, v ? '1':'0'); }catch(e){ console.warn('[묶어보기] 설정 저장 실패', e); } }

  function load(){
    try{
      var v = localStorage.getItem(LS_VER);
      if(String(v) !== String(VER)){          /* 옛 정의(workVendor 등)는 버린다 */
        localStorage.removeItem(LS_GRP);
        localStorage.setItem(LS_VER, String(VER));
        return baseGroups();
      }
      var raw = localStorage.getItem(LS_GRP);
      if(!raw) return baseGroups();
      var a = JSON.parse(raw);
      return Array.isArray(a) && a.length ? a : baseGroups();
    }catch(e){ console.warn('[묶어보기] 읽기 실패', e); return baseGroups(); }
  }
  function save(a){
    try{ localStorage.setItem(LS_GRP, JSON.stringify(a)); localStorage.setItem(LS_VER, String(VER)); }
    catch(e){ console.warn('[묶어보기] 저장 실패', e); }
  }

  function ES(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* 속성 줄 하나 — 페이지·창 모두 data-prow 를 쓴다 */
  function rowOf(props, key){
    if(!key) return null;
    try{ return props.querySelector('[data-prow="' + key.replace(/"/g,'') + '"]'); }
    catch(e){ return null; }
  }
  /* 그 줄에 지금 들어 있는 값 (편집 중이면 입력칸, 아니면 보기 글자) */
  function valOf(row){
    if(!row) return '';
    try{
      var ie = row.querySelector('.lf-ie');
      if(ie){
        if(ie.type === 'checkbox') return ie.checked ? '✔' : '';
        return String(ie.value == null ? '' : ie.value).trim();
      }
      var v = row.querySelector('.pg-pv');
      if(!v) return '';
      /* ★ v126 — 값 칸 안에는 덧붙인 안내·단추(.pg-addon)도 들어 있다.
            그대로 읽으면 접힌 요약에 「합계만 넣어도 공급가액·부가세가…」 같은
            안내 문구가 섞여 들어간다. (달님 스크린샷) → 값만 골라 읽는다. */
      var t = '';
      [].forEach.call(v.childNodes, function(n){
        if(n.nodeType === 1 && n.classList && n.classList.contains('pg-addon')) return;
        t += (n.textContent || '');
      });
      t = t.replace(/\s+/g, ' ').trim();
      if(!t || t === '비어 있음' || t === '—' || t === '☐') return '';
      if(t === '☑') return '✔';
      return t;
    }catch(e){ return ''; }
  }
  function labelOf(row){
    try{ return ((row.querySelector('.pg-pnm')||{}).textContent||'').trim().replace(/^\S+\s/,''); }
    catch(e){ return ''; }
  }

  /* ── 원래 차례를 기억해 두고, 끌 때 그대로 되돌린다 ──
        (정리 모드에서 차례를 저장하므로 뒤섞인 채로 두면 안 된다) */
  /* 속성 줄이 .pg-props 의 바로 밑 자식이 아닐 수도 있다 → 진짜 부모를 찾아 쓴다 */
  function boxOf(props){
    var r = props.querySelector('[data-prow]');
    return (r && r.parentNode) ? r.parentNode : props;
  }
  function putBefore(el, ref){
    if(!ref || !ref.parentNode) return false;
    ref.parentNode.insertBefore(el, ref); return true;
  }
  function putAfter(el, ref){
    if(!ref || !ref.parentNode) return false;
    ref.parentNode.insertBefore(el, ref.nextSibling); return true;
  }
  /* v124 — 속성 줄은 두 곳에 나뉘어 있다 : 보이는 곳(.pg-props) 과 「빈 항목」 상자(#pgHidden).
        예전에는 보이는 곳만 기억해서, 빈 항목 상자에 있던 칸(예: 발급 완료)이
        묶음 안으로 못 들어오고 **덩그러니 밖에** 남았다. (달님 : 「발급 완료가 이상한 데 있잖아」)
        → 부모마다 원래 차례를 기억해 둔다. 그러면 어디에 있든 옮겼다가 되돌릴 수 있다. */
  function snapshot(props){
    if(props._gSnap) return;
    var seen = [], snap = [];
    [].forEach.call(props.querySelectorAll('[data-prow]'), function(r){
      var pa = r.parentNode;
      if(pa && seen.indexOf(pa) < 0){ seen.push(pa); snap.push({ pa:pa, kids:[].slice.call(pa.children) }); }
    });
    props._gSnap = snap;
  }
  function restoreOrder(props){
    var snap = props._gSnap; if(!snap) return;
    snap.forEach(function(g){
      g.kids.forEach(function(el){ try{ if(el) g.pa.appendChild(el); }catch(e){} });
    });
  }

  /* v118 — 사람이 접거나 펼친 뒤에는 묶어보기만 다시 그리면 안 된다.
        붙어 있던 단추(↩·💸·＋자재)가 같이 지워진 채로 남기 때문. */
  function redraw(){
    if(typeof window.wlAfterPaint === 'function') window.wlAfterPaint();
    else run();
  }
  function cleanup(props){
    /* v136 — 묶음 줄은 「오른쪽 곁상자」로 옮겨져 있을 수도 있다.
          속성 상자 안만 뒤지면 옮겨 간 머리·발치가 남아 겹겹이 쌓인다.
          그래서 페이지 전체에서 치운다. 제자리 되돌리기는 restoreOrder 가
          부모별 스냅샷으로 하므로 곁상자에 있던 줄도 알아서 돌아온다. */
    var scope = (props.closest && props.closest('.lf-page')) || props;
    [].forEach.call(scope.querySelectorAll('.pg-grow,.pg-ghead,.pg-gtail,.pg-gfoot'), function(x){ x.remove(); });
    [].forEach.call(scope.querySelectorAll('[data-prow]'), function(r){
      if(r._gHid){ r.style.display = ''; r._gHid = 0; }
      if(r._gEmpty){ r.style.display = ''; r._gEmpty = 0; }
      r.classList.remove('pg-gm', 'pg-gm-first', 'pg-gm-last');
    });
    restoreOrder(props);
  }

  /* v114 — 자재는 「속성 칸(자재명·사양·수량)」과 「자재 사용 내역」 두 군데에 있다.
        내역에 자재가 있으면 그쪽이 진짜다 → 묶음 줄이 내역을 보여주고,
        겹치는 속성 칸(자재명·사양·수량)은 감춘다. 수량이 두 번 나오지 않게. */
  function ridNow2(){
    try{ var m = String(location.hash||'').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function matsOfRec(){
    try{
      var rid = ridNow2(); if(!rid) return [];
      var rec = (entries||[]).filter(function(x){ return x && x.id === rid; })[0];
      if(!rec) return [];
      /* v132 — 자재명 칸에 직접 적은 것도 「첫째 자재」로 함께 센다.
            달님 : 「자재 첫재줄은 요약이 안나와 저상태야」 */
      var out = [];
      var nm = String(rec.material == null ? '' : rec.material).trim();
      if(nm) out.push({ name:nm, spec:String(rec.spec==null?'':rec.spec),
                        qty:Number(rec.qty)||1, price:0, _field:1 });
      if(Array.isArray(rec.materials)) rec.materials.filter(Boolean).forEach(function(m){ out.push(m); });
      return out;
    }catch(e){ return []; }
  }
  function matLine(m){
    var bits = [ String(m.name||'').trim(), String(m.spec||'').trim() ].filter(Boolean);
    var q = Number(m.qty) || 0; if(q) bits.push(q + '개');
    return bits.join(' · ');
  }

  function run(){
    var page = document.querySelector('.lf-page');      /* 페이지·창 공통 뿌리 */
    if(!page) return;
    var props = page.querySelector('.pg-props');
    if(!props) return;
    var box = boxOf(props);
    snapshot(props);

    /* 정리 모드에서는 손대지 않는다 — 끌어서 차례를 바꿔야 하니까 */
    var editing = props.classList && props.classList.contains('pg-edit');

    cleanup(props);
    if(!isOn() || editing) return;

    var used = {};
    var lastTail = null;      /* v125 — 묶음을 「정한 차례대로」 위에서부터 쌓기 위한 표시 */

    /* v131 【근본 수정】 자재 사용 내역이 있어도 「📦 자재」 묶음은 그대로 만든다.
          예전에는 겹친다는 이유로 used 에 넣어 묶음 자체를 죽였는데,
          그러면 자재 요약 줄이 갈 곳을 잃고 「🕐 시각」 묶음 앞으로 밀려났다
          (달님 : 「한줄 정리가 시간 쪽으로 입력이 돼」). */
    var mats = matsOfRec();

    load().forEach(function(g){
      if(!g || !g.on) return;

      var hRow = rowOf(props, g.head);
      if(!hRow || used[g.head]) return;

      var rows = [], parts = [];
      (g.keys || []).forEach(function(k){
        if(used[k]) return;
        var r = rowOf(props, k); if(!r) return;
        rows.push({ k:k, el:r });
        var v = valOf(r);
        if(v) parts.push(v);
      });
      if(!rows.length) return;                     /* 묶을 짝이 없으면 그냥 둔다 */

      var hVal = valOf(hRow);
      used[g.head] = 1;
      rows.forEach(function(r){ used[r.k] = 1; });

      /* ── ① 접혀 있으면 한 줄로 ──
            v116 — 달님 : 「접고 펴기는 항상 있어야 하는데 나오다 안 나오다 그래」
            예전에는 대표 값(업체 이름)이 있어야만 접혔다. 업체가 비어 있으면
            접기 단추가 아무 일도 안 해서 「안 된다」로 보였다.
            → 값이 하나라도 있으면 접을 수 있다. 대표 값이 비어 있으면
              「(업체 없음)」 이라고 적어 준다. */
      var anyVal = hVal || parts.length;
      var gid = g.id || '';
      /* v123 — 사람이 정한 것 > 이 화면에서 누른 것 > 처음 값 */
      var uOpen = (window.wlUser ? window.wlUser.get('grp', gid) : undefined);
      var ok = okey(gid);
      var wantOpen = (uOpen !== undefined) ? !!uOpen
                   : ((OPEN[ok] === undefined) ? !!g.openDefault : !!OPEN[ok]);
      if(anyVal && !wantOpen){
        var line = document.createElement('div');
        line.className = 'pg-prow wide pg-grow';
        line.setAttribute('data-gid', g.id || '');    /* v113 — 어떤 묶음인지 (↩ 단추가 찾아 쓴다) */
        var sep = g.sep || ' · ';
        var hTxt = hVal || ('(' + (labelOf(hRow) || '대표 값') + ' 없음)');
        line.innerHTML =
            '<div class="pg-gk">' + (g.icon || '🔗') + '</div>'
          + '<div class="pg-gv">'
          +   (g.even                                    /* 대등한 묶음 — 굵기를 같게 */
                ? ES([hVal].concat(parts).filter(Boolean).join(sep))
                : (hVal ? '<b>' + ES(hVal) + '</b>' : '<span class="pg-gnone">' + ES(hTxt) + '</span>')
                  + (parts.length ? '<span class="pg-gsep">' + ES(sep) + '</span>' + ES(parts.join(' · ')) : ''))
          + '</div>'
          + '<button type="button" class="pg-gb" title="펼쳐서 고치기">펼치기</button>';
        /* v125 — 앞 묶음이 있으면 그 뒤에 이어 붙인다 → 관리 창에서 정한 차례가 화면 차례가 된다 */
        if(lastTail) putAfter(line, lastTail);
        else if(!putBefore(line, hRow)) return;

        var pvL = line;
        hRow.style.display = 'none'; hRow._gHid = 1;
        /* v124 — 접혀 있을 때도 짝들을 대표 줄 뒤로 모아 둔다.
              안 그러면 펼쳤을 때 밴드가 엉뚱한 자리(다른 묶음 뒤)에 생긴다. */
        if(hRow.previousElementSibling !== line) putAfter(hRow, line);
        var pv0 = hRow;
        rows.forEach(function(r){
          if(r.el.previousElementSibling !== pv0) putAfter(r.el, pv0);
          pv0 = r.el;
          r.el.style.display = 'none'; r.el._gHid = 1;
        });
        lastTail = pv0;

        function openIt(){
          OPEN[okey(gid)] = 1;
          try{ if(window.wlUser) window.wlUser.set('grp', gid, 1); }catch(e){}   /* ✋ 사람이 폈다 */
          redraw();
          setTimeout(function(){
            try{ var r2 = rowOf(document.querySelector('.lf-page .pg-props'), g.head);
                 if(r2) r2.scrollIntoView({block:'center'}); }catch(e){}
          }, 80);
        }
        line.querySelector('.pg-gb').addEventListener('click', openIt);
        line.querySelector('.pg-gv').addEventListener('click', openIt);
        return;
      }

      /* ── ② 펼친 상태 / 대표 값이 빈 상태 → 새 줄에서 시작하는 한 덩어리로 ── */
      var bar = document.createElement('div');
      bar.className = 'pg-ghead';
      bar.setAttribute('data-gid', g.id || '');
      bar.innerHTML =
          '<span class="pg-gi">' + (g.icon || '🔗') + '</span>'
        + '<b>' + ES(g.name || '묶음') + '</b>'
        + (hVal || g.openDefault ? '' : '<span class="pg-ghint">' + ES(labelOf(hRow) || '대표 값') + '을 먼저 넣으면 한 줄로 접힙니다</span>')
        + '<button type="button" class="pg-gfold">접기</button>';
      if(lastTail) putAfter(bar, lastTail);
      else if(!putBefore(bar, hRow)) return;
      if(hRow.previousElementSibling !== bar) putAfter(hRow, bar);

      /* 흩어져 있는 짝들을 대표 줄 바로 뒤로 모은다 (차례는 끌 때 되돌린다).
            v124 — 「빈 항목」 상자에 들어 있던 칸도 데려온다. 다만 그건 빈 칸이므로
            밴드 안에서 조용히 감춰 둔다 → 덩어리 밖에 덩그러니 뜨지 않는다. */
      var prev = hRow;
      rows.forEach(function(r){
        var wasHidden = false;
        try{ wasHidden = !!(r.el.closest && r.el.closest('#pgHidden')); }catch(e){}
        if(r.el.previousElementSibling !== prev) putAfter(r.el, prev);
        prev = r.el;
        if(wasHidden){ r.el.style.display = 'none'; r.el._gEmpty = 1; }
      });

      hRow.classList.add('pg-gm', 'pg-gm-first');
      rows.forEach(function(r){ r.el.classList.add('pg-gm'); });
      (rows.length ? rows[rows.length-1].el : hRow).classList.add('pg-gm-last');

      /* v124 — 묶음 발치. 「연결된 지출 보기」 같은 단추가 여기 앉는다.
            (속성 줄 안에 끼워 넣으면 값 칸이 눌린다 — v118 규칙) */
      var foot = document.createElement('div');
      foot.className = 'pg-gfoot';
      foot.setAttribute('data-gfoot', gid);
      putAfter(foot, prev);

      var tail = document.createElement('div');
      tail.className = 'pg-gtail';
      putAfter(tail, foot);
      lastTail = tail;

      bar.querySelector('.pg-gfold').addEventListener('click', function(){
        OPEN[okey(gid)] = 0;
        try{ if(window.wlUser) window.wlUser.set('grp', gid, 0); }catch(e){}     /* ✋ 사람이 접었다 */
        redraw();                                    /* 값이 없어도 접힌다 (v116) */
      });
    });

    /* v124 — 자재 내역 요약 줄은 「📦 자재」 밴드 바로 밑에 놓는다.
          밴드가 없으면(자재 묶음이 꺼져 있으면) 시각 묶음 앞에 놓는다. */
    /* v140 — 달님 : 「자재 정리된거 자재 항목 밑에 나올 필요 없잖아.
          이제 전부 본문에만 저장하게 해」
          자재 내역은 본문 맨 위 「자동 정리」의 📦 줄에 이미 들어간다.
          같은 것을 두 곳에 그리면 화면만 길어진다. */
    if(false && mats.length){
      var mLine = document.createElement('div');
      mLine.className = 'pg-prow wide pg-grow';
      mLine.setAttribute('data-gid', 'gm');
      mLine.innerHTML =
          '<div class="pg-gk">📦</div>'
        + '<div class="pg-gv">' + ES(mats.map(matLine).join('  /  ')) + '</div>'
        + '<span class="pg-gcnt">자재 ' + mats.length + '건</span>';
      /* v131 — 자재 묶음 발치가 제자리다. 없으면 밴드 바로 밑,
            그것도 없으면 자재명 줄 앞. 그 어디도 없으면 아예 그리지 않는다.
            (예전엔 「시각」 줄 앞으로 보냈다 — 엉뚱한 묶음에 붙는 원인이었다) */
      var foot2 = props.querySelector('[data-gfoot="gt"]');
      var band  = props.querySelector('[data-gid="gt"].pg-ghead')
               || props.querySelector('[data-gid="gt"].pg-grow');
      var mrow  = rowOf(props, 'f:material');
      if(foot2)      putBefore(mLine, foot2);
      else if(band)  putAfter(mLine, band);
      else if(mrow)  putBefore(mLine, mrow);
      else           mLine = null;
    }

    /* v133 — 달님 : 「내용은 기본탭 바로 밑으로. 업무 내용 적을 꺼야」
          묶음들은 lastTail 체인으로 위에서부터 다시 쌓인다. 어느 묶음에도
          속하지 않는 「내용」 줄은 제자리에 남아 묶음들에게 밀려 아래로 간다.
          그래서 묶음을 다 쌓은 뒤 「기본」 묶음 바로 뒤로 옮겨 준다. */
    try{
      var mrow2 = rowOf(props, '_memo');
      if(mrow2){
        var g0f = props.querySelector('[data-gfoot="g0"]');
        var anchor = null;
        if(g0f){
          anchor = g0f;
          var nx = g0f.nextElementSibling;                    /* 발치 다음의 여백 줄까지 건너뛴다 */
          if(nx && nx.classList && nx.classList.contains('pg-gtail')) anchor = nx;
        }else{
          anchor = props.querySelector('[data-gid="g0"].pg-grow');
        }
        if(anchor && anchor.nextElementSibling !== mrow2) putAfter(mrow2, anchor);
      }
    }catch(e){ console.warn('[묶어보기] 「내용」 자리 옮기기 실패', e); }
  }


  /* ── 화면이 다시 그려질 때마다 따라간다 ── */
  var t = null;
  /* v118 — 묶어보기만 다시 그리면, 여기 붙어 있던 단추(↩·💸·＋자재)가
        같이 지워진 채로 남는다. 그래서 「그리는 차례 전체」를 부른다. */
  function later(){
    clearTimeout(t);
    t = setTimeout(function(){
      if(typeof window.wlAfterPaint === 'function') window.wlAfterPaint();
      else run();
    }, 180);
  }
  try{
    var mo = new MutationObserver(function(m){
      for(var i = 0; i < m.length; i++){
        var add = m[i].addedNodes;
        if(!add || !add.length) continue;
        var mine = false;
        for(var j = 0; j < add.length; j++){
          var n = add[j];
          if(n.classList && (n.classList.contains('pg-grow') || n.classList.contains('pg-ghead')
                             || n.classList.contains('pg-gtail') || n.classList.contains('pg-addon'))) mine = true;
        }
        if(!mine){ later(); return; }
      }
    });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }catch(e){ console.warn('[묶어보기] 감시 시작 실패', e); }
  document.addEventListener('change', function(ev){
    if(ev.target && ev.target.classList && ev.target.classList.contains('lf-ie')) later();
  }, true);
  setTimeout(run, 1300);

  /* v118 — 파수꾼을 각자 돌리지 않는다 (wlPaint 가 차례대로 부른다) */
  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:20, n:'묶어보기', f:run });

  /* ── 묶음 관리 창 ──────────────────────────────────
        v125 — 달님이 직접 : 이름 바꾸기 · 차례 옮기기 · 켜고 끄기 · 새로 만들기
        여기서 정한 차례가 화면에 나오는 차례가 된다. */
  function openMgr(){
    var ov = document.createElement('div');
    ov.className = 'rl-ov';
    var gs = load();

    function draw(){
      ov.innerHTML =
          '<div class="rl-mod">'
        +   '<div class="rl-head"><b>🧩 묶어보기 — 덩어리 고치기</b>'
        +     '<button type="button" id="gClose" class="rl-x">✕</button></div>'
        +   '<div class="rl-note">이름을 고치고 ▲▼ 로 차례를 옮기면, <b>화면에 나오는 차례</b>도 그대로 바뀝니다. '
        +     '대표 칸에 값이 있으면 한 줄로 접히고, 없으면 한 덩어리로 묶여 보입니다.</div>'
        +   '<div class="rl-list">'
        +     gs.map(function(g, i){
              return '<div class="gm-row">'
                + '<div class="gm-ord">'
                +   '<button type="button" class="gm-up" data-gup="' + i + '"' + (i===0?' disabled':'') + ' title="위로">▲</button>'
                +   '<button type="button" class="gm-dn" data-gdn="' + i + '"' + (i===gs.length-1?' disabled':'') + ' title="아래로">▼</button>'
                + '</div>'
                + '<button type="button" class="rl-on' + (g.on ? ' on':'') + '" data-gon="' + i + '">'
                +   (g.on ? '켜짐' : '꺼짐') + '</button>'
                + '<div class="gm-body">'
                +   '<div class="gm-nm">'
                +     '<input class="gm-icon" data-gi="' + i + '" value="' + ES(g.icon||'') + '" maxlength="2" title="그림">'
                +     '<input class="gm-name" data-gn="' + i + '" value="' + ES(g.name||'') + '" placeholder="덩어리 이름">'
                +   '</div>'
                +   '<div class="gm-keys">대표 <b>' + ES(g.head) + '</b> · 함께 ' + ES((g.keys||[]).join(', ') || '(없음)') + '</div>'
                + '</div>'
                + (g.base ? '' : '<button type="button" class="rl-del" data-gdel="' + i + '">✕</button>')
                + '</div>';
              }).join('')
        +   '</div>'
        +   '<div class="rl-add"><b>＋ 내 덩어리 추가</b>'
        +     '<input id="gH" placeholder="대표 칸 이름 (예: _sub)">'
        +     '<input id="gK" placeholder="함께 묶을 칸들, 쉼표로 (예: f:workRole, f:workPhone)">'
        +     '<button type="button" id="gAdd">넣기</button></div>'
        +   '<div class="rl-foot"><button type="button" id="gReset">처음으로 되돌리기</button>'
        +     '<span class="rl-hint">칸 이름은 콘솔에 wlGroup.names() 로 볼 수 있어요</span></div>'
        + '</div>';

      function save2(){ save(gs); redraw(); }

      ov.querySelectorAll('[data-gup]').forEach(function(b){
        b.addEventListener('click', function(){
          var i = +b.getAttribute('data-gup'); if(i<=0) return;
          var t = gs[i-1]; gs[i-1] = gs[i]; gs[i] = t; save2(); draw();
        }); });
      ov.querySelectorAll('[data-gdn]').forEach(function(b){
        b.addEventListener('click', function(){
          var i = +b.getAttribute('data-gdn'); if(i>=gs.length-1) return;
          var t = gs[i+1]; gs[i+1] = gs[i]; gs[i] = t; save2(); draw();
        }); });
      ov.querySelectorAll('[data-gon]').forEach(function(b){
        b.addEventListener('click', function(){
          var i = +b.getAttribute('data-gon'); gs[i].on = gs[i].on ? 0 : 1; save2(); draw();
        }); });
      ov.querySelectorAll('[data-gn]').forEach(function(i2){
        i2.addEventListener('change', function(){ gs[+i2.getAttribute('data-gn')].name = i2.value; save2(); }); });
      ov.querySelectorAll('[data-gi]').forEach(function(i3){
        i3.addEventListener('change', function(){ gs[+i3.getAttribute('data-gi')].icon = i3.value; save2(); }); });
      ov.querySelectorAll('[data-gdel]').forEach(function(b){
        b.addEventListener('click', function(){
          gs.splice(+b.getAttribute('data-gdel'), 1); save2(); draw();
        }); });

      var addB = ov.querySelector('#gAdd');
      if(addB) addB.addEventListener('click', function(){
        var h = (ov.querySelector('#gH').value || '').trim();
        var k = (ov.querySelector('#gK').value || '').trim();
        if(!h || !k){ alert('대표 칸과 함께 묶을 칸을 모두 적어주세요'); return; }
        gs.push({ id:'u'+Date.now(), on:1, icon:'🔗', name:h+' 덩어리', head:h,
                  keys:k.split(',').map(function(x){ return x.trim(); }).filter(Boolean) });
        save2(); draw();
      });
      var rs = ov.querySelector('#gReset');
      if(rs) rs.addEventListener('click', function(){
        if(!confirm('덩어리 이름과 차례를 처음으로 되돌릴까요?')) return;
        try{ localStorage.removeItem(LS_GRP); localStorage.removeItem(LS_VER); }catch(e){}
        gs = load(); redraw(); draw();
      });
      var xb = ov.querySelector('#gClose');
      if(xb) xb.addEventListener('click', function(){ ov.remove(); redraw(); });
    }
    draw();
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', function(e){ if(e.target === ov){ ov.remove(); redraw(); } });
  }

  /* ── 진단 탭 스위치 ── */
  function panel(){
    var host = document.getElementById('sfPanel');
    if(!host || document.getElementById('grpBtn')) return;
    var row = host.querySelector('.btn-row'); if(!row) return;
    var b = document.createElement('button');
    b.id = 'grpBtn'; b.style.minHeight = '44px';
    function paint(){
      b.textContent = isOn() ? '🧩 묶어보기 켜짐' : '🧩 묶어보기 꺼짐';
      b.className = 'btn btn-sm ' + (isOn() ? 'btn-primary' : 'btn-ghost');
      b.style.minHeight = '44px';
    }
    b.addEventListener('click', function(){ setOn(!isOn()); paint(); redraw(); });
    paint(); row.appendChild(b);

    if(!document.getElementById('grpMgr')){
      var m = document.createElement('button');
      m.id = 'grpMgr'; m.className = 'btn btn-ghost btn-sm'; m.style.minHeight = '44px';
      m.textContent = '⚙ 묶음 고치기';
      m.addEventListener('click', openMgr);
      row.appendChild(m);
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 2200);

  window.wlGroup = {
    list: function(){
      console.table(load().map(function(g){
        return { 켜짐:g.on?'✔':'', 이름:g.name, 대표:g.head, 접는칸:(g.keys||[]).join(',') }; }));
      return load().length + '개';
    },
    /* 지금 열린 화면에 실제로 있는 칸 이름 — 짐작하지 말고 이걸 보고 만든다 */
    names: function(){
      var p = document.querySelector('.lf-page .pg-props');
      if(!p) return '기록을 하나 연 다음에 다시 불러주세요';
      var out = [].map.call(p.querySelectorAll('[data-prow]'), function(r){
        return { 이름:r.getAttribute('data-prow'), 보이는말:labelOf(r), 값:valOf(r) }; });
      console.table(out); return out.length + '개';
    },
    open: openMgr,
    on:   function(){ setOn(1); redraw(); return '묶어서 보여줍니다'; },
    off:  function(){ setOn(0); redraw(); return '전부 펼쳐서 보여줍니다'; },
    run:  function(){ redraw(); return '다시 그렸습니다'; },
    reset:function(){ try{ localStorage.removeItem(LS_GRP); localStorage.removeItem(LS_VER); }catch(e){}
                      run(); return '처음 묶음으로 되돌렸습니다'; }
  };
  console.log('[묶어보기] v112 준비됨 — 진단 탭 「🧩 묶어보기」 / 칸 이름은 wlGroup.names()');
})();


/* ============================================================
   🩺 종합 점검 (wlCheckAll)  v111-0829-2330
   기본지침 제0원칙 ④ — 「같은 걸 두 번 틀리면 진단 도구부터 만든다」

   「안 먹는다」 는 말만으로는 원인을 알 수 없다.
   무엇이 켜져 있고, 무엇을 못 읽고 있고, 어느 칸이 없는지를
   한 번에 보여준다. 스크린샷 한 장이면 원인이 나온다.

   쓰는 법 :  콘솔에 wlCheckAll()   또는  진단 탭 [🩺 종합 점검]
   ============================================================ */
(function(){
  'use strict';

  function g(id){ try{ return document.getElementById(id); }catch(e){ return null; } }
  function num(v){ return (v == null) ? '?' : v; }
  function yn(v){ return v ? '✅' : '❌'; }

  function verOf(){
    try{ return window.APP_VERSION || (document.title.match(/v[\d.]+-\d+-\d+/) || ['?'])[0]; }
    catch(e){ return '?'; }
  }
  function onlineOf(){
    try{ if(typeof online !== 'undefined') return !!online; }catch(e){}
    try{ return navigator.onLine; }catch(e){ return null; }
  }
  function cntOf(name){
    try{ var v = window[name]; if(Array.isArray(v)) return v.length; }catch(e){}
    try{ return eval(name).length; }catch(e){ return null; }
  }

  /* 지금 열린 화면에 그 칸이 실제로 있나 */
  function fieldExists(key){
    if(!key) return false;
    if(g('m-' + key)) return true;
    try{
      return !!document.querySelector('[data-prow="f:' + key + '"],[data-ppid="f:' + key + '"],[data-pid="f:' + key + '"]');
    }catch(e){ return false; }
  }

  function run(){
    var L = [];
    function add(s){ L.push(s); }
    function head(s){ L.push(''); L.push('── ' + s + ' ' + '─'.repeat(Math.max(2, 40 - s.length))); }

    head('지금 상태');
    var on = onlineOf();
    add('버전        : ' + verOf());
    add('연결        : ' + (on === null ? '알 수 없음' : (on ? '🟢 온라인' : '🔴 오프라인 — 클라우드를 못 읽습니다')));
    var ents = cntOf('entries'), cts = cntOf('contactsCache');
    add('기록        : ' + num(ents) + '건');
    add('연락처      : ' + num(cts) + '건' + ((cts === 0) ? '  ⚠ 0건이면 업체 연결이 안 됩니다' : ''));
    if(cts === 0 && on === false) add('              → 오프라인이라 연락처를 못 읽은 것입니다. 인터넷을 연결하고 새로고침하세요.');
    if(cts === 0 && on !== false) add('              → 콘솔에 loadContactsCache() 를 한 번 실행해 보세요.');

    head('기능이 살아 있나');
    var mods = [
      ['입력 도우미', 'wlSmartField'], ['연결 규칙', 'wlRules'],
      ['묶어보기', 'wlGroup'], ['빈 영역 접기', 'wlSecs'],
      ['시계 창', 'wlTimeDial'], ['칸 종류 되돌리기', 'wlFieldTypeReset']
    ];
    mods.forEach(function(m){
      var t = '';
      try{ t = typeof window[m[1]]; }catch(e){ t = 'undefined'; }
      add((m[0] + '            ').slice(0, 13) + ': ' + (t === 'undefined' ? '❌ 없음 (파일이 옛 것일 수 있어요)' : '✅ ' + t));
    });

    head('켜짐 / 꺼짐');
    try{
      var c = window.wlSmartField ? window.wlSmartField.cfg() : null;
      if(c) add('자동완성    : ' + yn(c.ac) + '   연락처 표시 ' + yn(c.link) + '   빈 칸 접기 ' + yn(c.fold)
              + '   업체 아이디 ' + yn(c.idsave) + '   빠른버튼 ' + yn(c.quick));
    }catch(e){ add('자동완성    : 확인 실패 — ' + e.message); }
    try{ add('연결 규칙   : ' + (localStorage.getItem('wl_rules_on') === '0' ? '꺼짐' : '켜짐')); }catch(e){}
    try{ add('묶어보기    : ' + (localStorage.getItem('wl_group_on') === '0' ? '꺼짐' : '켜짐')); }catch(e){}
    try{ add('빈 영역 접기: ' + (localStorage.getItem('wl_secs_on') === '0' ? '꺼짐' : '켜짐')); }catch(e){}

    head('연결 규칙이 지금 화면에 맞나');
    try{
      var raw = localStorage.getItem('wl_rules');
      var mine = !!raw;
      var rules = [];
      try{ rules = JSON.parse(raw || 'null') || []; }catch(e){ rules = []; }
      if(!mine){
        add('저장된 규칙 : 없음 (처음 규칙을 씁니다) ✅');
        add('              — 옛 규칙이 남아 있지 않아 정상입니다');
      }else{
        add('저장된 규칙 : ' + rules.length + '개  ⚠ 내가 손댄 규칙이 있습니다');
        var old = rules.filter(function(r){
          return r && r.when && ['company','person','role','phone','receipt','taxInvoice','companyMemo','material']
            .indexOf(r.when.k) >= 0 && String(r.id||'').charAt(0) === 'b';
        });
        if(old.length) add('              ⚠ 옛 이름을 쓰는 기본 규칙 ' + old.length + '개 — wlRules.reset() 을 실행하세요');
      }
      var use = {};
      (window.wlRules ? [] : []).forEach(function(){});
      var list = [];
      try{ list = (raw ? rules : null) || []; }catch(e){}
      if(!list.length && window.wlRules){
        /* 저장된 게 없으면 기본 규칙을 못 읽으므로 화면에서 자주 쓰는 칸만 확인 */
        list = [];
      }
      var keys = ['workVendor','workContact','workRole','workPhone','workMemo',
                  'material','spec','qty','expType','cost','company','name','role','phone',
                  'owner','ownerPhone','partyName','startTime','endTime','isIssued','purpose'];
      var found = keys.filter(fieldExists);
      add('지금 화면에 있는 칸 : ' + (found.length ? found.join(', ') : '(없음 — 기록을 열고 다시 눌러주세요)'));
    }catch(e){ add('규칙 확인 실패 — ' + e.message); }

    head('지금 열린 화면');
    var page = document.querySelector('.lf-page .pg-body');
    var modal = g('mFields');
    add('노션식 페이지 : ' + (page ? '✅ 열림' : '닫힘'));
    add('옛 입력창     : ' + (modal && modal.innerHTML ? '✅ 열림' : '닫힘'));
    if(page){
      var rows = page.querySelectorAll('[data-prow]');
      add('속성 줄       : ' + rows.length + '개');
      var sample = [];
      for(var i = 0; i < rows.length && sample.length < 5; i++){
        sample.push(rows[i].getAttribute('data-prow'));
      }
      add('이름표 모양   : ' + (sample.join(' , ') || '(없음)'));
      add('묶음 줄       : ' + page.querySelectorAll('.pg-grow').length + '개');
      add('접힌 영역 단추: ' + (g('pgSecBar') ? g('pgSecBar').querySelectorAll('button').length : 0) + '개');
    }
    try{
      var st = (typeof window.wlOpenStyle === 'function') ? window.wlOpenStyle() : '?';
      add('기록을 누르면 : ' + st + (st === 'old' ? '  ⚠ 예전 입력창이라 새 기능이 안 보입니다' : ''));
    }catch(e){}

    head('화면이 반듯한가');
    try{
      if(typeof window.wlLayoutCheck === 'function'){
        var _lg = console.log, _buf = [];
        console.log = function(){ _buf.push([].slice.call(arguments).map(String).join(' ')); };
        var _r = window.wlLayoutCheck();
        console.log = _lg;
        var _body = _buf.join('\n').split('📐 화면 점검')[2] || '';
        _body.split('\n').forEach(function(l){ if(l.trim()) add(l.replace(/^\s{0,2}/,'')); });
        if(!_body) add(String(_r));
      }else add('화면 점검 도구가 없습니다 — 최신 worklog.js 를 올리세요');
    }catch(e){ add('화면 점검 실패 — ' + e.message); }

    head('무엇을 하면 되나');
    var todo = [];
    if(on === false) todo.push('인터넷을 연결하고 새로고침 (연락처·클라우드가 이때 살아납니다)');
    if(cts === 0) todo.push('연락처가 0건입니다 — 연결 후 새로고침');
    try{ if(localStorage.getItem('wl_rules')) todo.push('wlRules.reset() 으로 규칙을 새것으로'); }catch(e){}
    try{ if(typeof window.wlGroup === 'undefined') todo.push('파일이 옛 것입니다 — 최신 worklog.js 를 올리세요'); }catch(e){}
    try{ if(typeof window.wlOpenStyle === 'function' && window.wlOpenStyle() === 'old')
           todo.push('진단 탭 「기록을 누르면」 을 창 또는 페이지로 바꾸세요'); }catch(e){}
    try{
      if(typeof window.wlLayoutCheck === 'function'){
        var _lg2 = console.log; console.log = function(){};
        var _r2 = window.wlLayoutCheck(); console.log = _lg2;
        if(String(_r2).indexOf('어긋난') >= 0) todo.push('📐 화면이 ' + _r2 + ' — 진단 탭 [📐 화면 점검] 을 눌러 자세히 보세요');
      }
    }catch(e){}
    try{
      if(window.wlUser){
        var _n = window.wlUser.list ? 0 : 0;
        var _o = JSON.parse(localStorage.getItem('wl_userchoice')||'{}');
        var _c = 0; Object.keys(_o).forEach(function(k){ _c += Object.keys(_o[k]).length; });
        if(_c) todo.push('✋ 내가 정한 것 ' + _c + '개 (접어 둠·숨긴 칸) — 이상하면 진단 탭 [✋ 내가 정한 것 지우기]');
      }
    }catch(e){}
    if(!todo.length) todo.push('막는 것이 없습니다 — 기록을 하나 열고 다시 점검해 보세요');
    todo.forEach(function(t, i){ add((i+1) + '. ' + t); });

    var txt = L.join('\n');
    console.log('%c🩺 종합 점검', 'color:#2563a8;font-size:14px;font-weight:800');
    console.log(txt);
    try{
      var box = g('scResult');
      if(box){
        var d = document.createElement('pre');
        d.style.cssText = 'margin-top:10px;padding:11px 13px;border-radius:10px;background:#f7faff;'
          + 'border:1px solid #dbe6f4;font-size:12px;line-height:1.65;white-space:pre-wrap;'
          + 'font-family:ui-monospace,Menlo,Consolas,monospace;color:#3d5875';
        d.textContent = txt;
        box.appendChild(d);
      }
    }catch(e){}
    return '점검 끝 — 위 내용을 그대로 보여주시면 원인을 찾을 수 있어요';
  }

  window.wlCheckAll = run;

  function panel(){
    var host = g('sfPanel');
    if(!host || g('caBtn')) return;
    var row = host.querySelector('.btn-row'); if(!row) return;
    var b = document.createElement('button');
    b.id = 'caBtn'; b.className = 'btn btn-primary btn-sm'; b.style.minHeight = '44px';
    b.textContent = '🩺 종합 점검';
    b.addEventListener('click', function(){
      try{ var box = g('scResult'); if(box) box.innerHTML = ''; }catch(e){}
      run();
      if(typeof toast === 'function') toast('점검 결과를 아래에 적었습니다');
    });
    row.appendChild(b);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 2400);

  console.log('[종합 점검] 준비됨 — 콘솔에 wlCheckAll() 또는 진단 탭 [🩺 종합 점검]');
})();


/* ============================================================
   🗔📄 창 ↔ 전체 페이지 한 번에 바꾸기 (wlPageStyle)  v112-0829-2350

   달님 말 : 「페이지로 보기가 없어, 모달만 열리지」
   → 설정은 진단 탭 깊숙이 있었다. 보이지 않으면 없는 것과 같다.
     그래서 기록을 연 자리(머리줄)에 단추를 놓는다.
     지금 창이면 [📄 페이지로] · 지금 페이지면 [🗔 창으로]
     누르면 보던 기록을 그 모양으로 곧바로 다시 연다.
   ============================================================ */
(function(){
  'use strict';
  var LS = 'wl_open_as_page';

  function styleNow(){
    try{ return (typeof window.wlOpenStyle === 'function') ? window.wlOpenStyle() : 'modal'; }
    catch(e){ return 'modal'; }
  }
  function ridNow(){
    try{
      var m = String(location.hash || '').match(/^#lp=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    }catch(e){ return ''; }
  }

  function add(){
    var top = document.querySelector('.lf-page .pg-top');
    if(!top) return;
    var old = top.querySelector('#pgStyleBtn');
    var cur = styleNow();
    var toModal = (cur !== 'modal');          /* 지금 페이지면 → 창으로 */
    var label = toModal ? '🗔 창으로' : '📄 페이지로';
    if(old){ old.textContent = label; return; }

    var b = document.createElement('button');
    b.type = 'button'; b.id = 'pgStyleBtn';
    b.textContent = label;
    b.title = toModal ? '작은 창으로 봅니다' : '화면 전체로 넓게 봅니다';
    b.addEventListener('click', function(){
      var rid = ridNow();
      try{ localStorage.setItem(LS, toModal ? 'modal' : 'page'); }
      catch(e){ console.warn('[보기 모양] 저장 실패', e); }
      if(typeof toast === 'function') toast(toModal ? '🗔 창으로 봅니다' : '📄 전체 페이지로 봅니다');
      /* 보던 기록을 그 모양으로 곧바로 다시 연다 */
      setTimeout(function(){
        try{
          if(rid && typeof window.wlGoPage === 'function') window.wlGoPage(rid, toModal);
        }catch(e){ console.warn('[보기 모양] 다시 열기 실패', e); }
      }, 120);
    });

    var del = top.querySelector('#pgDel');
    if(del) top.insertBefore(b, del); else top.appendChild(b);
  }

  var t = null;
  function later(){ clearTimeout(t); t = setTimeout(add, 160); }
  try{
    var mo = new MutationObserver(function(m){
      for(var i = 0; i < m.length; i++) if(m[i].addedNodes && m[i].addedNodes.length){ later(); return; }
    });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }catch(e){ console.warn('[보기 모양] 감시 시작 실패', e); }
  setTimeout(add, 1200);
  /* 감시가 놓치는 경우가 있어 머리줄이 새로 생겼는지 0.4초마다 확인한다 */
  var seenTop = null;
  setInterval(function(){
    try{
      var tp = document.querySelector('.lf-page .pg-top');
      if(tp && tp !== seenTop){ seenTop = tp; add(); }
      else if(!tp) seenTop = null;
    }catch(e){ console.warn('[보기 모양] 파수꾼 실패', e); }
  }, 400);

  window.wlPageStyle = function(v){
    if(v === 'page' || v === 'modal' || v === 'old'){
      try{ localStorage.setItem(LS, v); }catch(e){}
      return '이제 기록을 누르면 ' + (v==='page'?'전체 페이지':(v==='modal'?'창(모달)':'예전 입력창')) + '으로 열립니다';
    }
    return '지금: ' + styleNow() + "  —  바꾸려면 wlPageStyle('page') 또는 wlPageStyle('modal')";
  };
  console.log('[보기 모양] v112 준비됨 — 기록 머리줄의 [📄 페이지로] / [🗔 창으로]');
})();


/* ============================================================
   ↩📝 자동입력 되돌리기 + 속성을 본문으로 (wlAutoUndo)  v113-0829-2359

   달님 두 가지 요청
     ① 「업체를 누르면 자동으로 들어가잖아. 다시 누르면 그 내용들 지워지게」
     ② 「내용에 내가 셀에 입력했던 걸 정리해서 넣으면 되겠네」

   ① 되돌리기
      자동으로 채운 칸이 무엇이었는지 기록해 둔다.
      그 뒤 업체 줄에 [↩] 단추가 뜨고, 누르면 **자동으로 들어간 것만** 지운다.
      손으로 고친 칸은 값이 달라져 있으므로 건드리지 않는다.
      (기본지침 「저장·수정·삭제 3원칙」 — 지울 것과 지키지 말 것을 구분한다)

   ② 속성 → 본문
      본문 옆 [📝 속성 정리해서 넣기] 를 누르면
      채워진 속성만 골라 문장으로 만들어 본문에 넣는다.
      한 번 넣은 뒤에는 사람이 자유롭게 고쳐 쓴다 (덮어쓰지 않는다).
   ============================================================ */
(function(){
  'use strict';

  var LS = 'wl_autofill';
  var MAX = 40;

  function all(){
    try{ var o = JSON.parse(localStorage.getItem(LS) || '{}'); return (o && typeof o==='object') ? o : {}; }
    catch(e){ console.warn('[자동채움] 읽기 실패', e); return {}; }
  }
  function put(o){
    try{
      var ks = Object.keys(o);
      while(ks.length > MAX){ delete o[ks[0]]; ks = Object.keys(o); }
      localStorage.setItem(LS, JSON.stringify(o));
    }catch(e){ console.warn('[자동채움] 저장 실패', e); }
  }

  /* 페이지 자동채움이 부른다 — 무엇을 넣었는지 적어 둔다 */
  window.wlAutoMark = function(rid, patch){
    if(!rid || !patch) return;
    var o = all();
    var m = o[rid] || {};
    Object.keys(patch).forEach(function(k){ if(patch[k] != null && patch[k] !== '') m[k] = patch[k]; });
    o[rid] = m; put(o);
  };

  function ridNow(){
    try{ var m = String(location.hash||'').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function recOf(rid){
    try{ return (entries||[]).filter(function(x){ return x && x.id === rid; })[0] || null; }
    catch(e){ return null; }
  }

  /* 아직 「자동으로 들어간 그대로」인 칸만 고른다 */
  function stillAuto(rid){
    var m = (all()[rid] || {}), rec = recOf(rid), out = {};
    if(!rec) return out;
    Object.keys(m).forEach(function(k){
      if(String(rec[k] == null ? '' : rec[k]) === String(m[k])) out[k] = m[k];
    });
    return out;
  }

  /* 그 묶음의 대표 칸에 값이 들어 있나 */
  function hasVal(rid, keys){
    var rec = recOf(rid); if(!rec || !keys) return false;
    for(var i=0;i<keys.length;i++){
      var v = rec[keys[i]];
      if(v != null && String(v).trim() !== '') return true;
    }
    return false;
  }
  function undo(rid, only, headKeys){
    var hit = stillAuto(rid);
    var ks = Object.keys(hit).filter(function(k){ return !only || only.indexOf(k) >= 0; });
    var rec = recOf(rid);
    var hk = [];
    (headKeys || []).forEach(function(k){                 /* 대표 칸(업체 이름 등)도 함께 */
      if(rec && rec[k] != null && String(rec[k]).trim() !== '') hk.push(k);
    });
    if(!ks.length && !hk.length){
      if(typeof toast === 'function') toast('지울 것이 없어요');
      return;
    }
    var patch = {};
    ks.forEach(function(k){ patch[k] = ''; });
    hk.forEach(function(k){ patch[k] = ''; });
    try{
      if(typeof updateRecord === 'function') updateRecord(rid, patch);
      var o = all(), m2 = o[rid] || {};
      ks.forEach(function(k){ delete m2[k]; });          /* 지운 것만 기억에서 뺀다 */
      if(Object.keys(m2).length) o[rid] = m2; else delete o[rid];
      put(o);
      if(typeof toast === 'function') toast('↩ ' + (ks.length + hk.length) + '칸을 지웠어요');
      setTimeout(function(){
        try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid, undefined); }catch(e){}
      }, 150);
    }catch(e){
      console.error('[자동채움] 되돌리기 실패', e);
      if(typeof toast === 'function') toast('되돌리지 못했어요: ' + (e.message || e));
    }
  }

  /* ── 속성 → 본문 글 만들기 ──────────────────────────
        달님이 정한 차례 :  층 - 분야 - 제목 - 내용 - 자재명 - 사양 - 갯수
        비어 있는 것은 건너뛰고, 있는 것만 이어 붙여 **한 줄**로 만든다.
        (보고서·카톡에 그대로 붙여 넣을 수 있게) */
  var SEP = ' - ';

  /* 화면에서 그 칸의 값을 읽는다 (고치는 중이면 입력칸, 아니면 보이는 글자) */
  function vOf(page, id){
    try{
      var r = page.querySelector('[data-prow="' + id + '"]'); if(!r) return '';
      var ie = r.querySelector('.lf-ie');
      var v  = ie ? String(ie.value == null ? '' : ie.value).trim()
                  : ((r.querySelector('.pg-pv')||{}).textContent || '').trim();
      if(!v || v === '비어 있음' || v === '—') return '';
      return v.replace(/\s+/g, ' ');
    }catch(e){ return ''; }
  }
  function titleOf(page){
    try{
      var t = document.getElementById('pgTitle');
      return t ? String(t.value || '').trim().replace(/\s+/g,' ') : '';
    }catch(e){ return ''; }
  }
  /* 자재 : 이름(사양) N개 — 문장에 그대로 들어갈 모양 */
  function matBit(name, spec, qty){
    var t = String(name||'').trim();
    if(!t) return '';
    var sp = String(spec||'').trim();
    if(sp) t += '(' + sp + ')';
    var q = Number(qty) || 0;
    if(q) t += ' ' + q + '개';
    return t;
  }
  function matsOf(page){
    var out = [];
    try{
      var rid = ridNow(), rec = recOf(rid);
      var arr = (rec && Array.isArray(rec.materials)) ? rec.materials : [];
      arr.forEach(function(m){
        if(!m) return;
        var b = matBit(m.name, m.spec, m.qty);
        if(b) out.push(b);
      });
    }catch(e){ console.warn('[속성 정리] 자재 읽기 실패', e); }
    if(!out.length){                       /* 내역이 비었으면 속성 칸으로 */
      var b2 = matBit(vOf(page,'f:material'), vOf(page,'f:spec'), vOf(page,'f:qty'));
      if(b2) out.push(b2);
    }
    return out;
  }

  /* 한 줄 — 달님이 정한 차례를 「문장」으로 만든다
        층 · 분야 · 제목 · 내용 · 자재명 · 사양 · 갯수

        지하1층 전기 「승강기 홀 등기구 교체」 — B1 승강기 홀 3등 점멸.
        사용 자재는 형광등(20W) 3개, 안정기(220V) 1개.
  */
  /* 대상년도·대상월이 있으면 문장 맨 앞에 — 「2026년 8월 …」 (v116) */
  function whenOf(page){
    var y = vOf(page, 'f:refYear'), m = vOf(page, 'f:refMonth');
    y = y.replace(/[^0-9]/g, ''); m = m.replace(/[^0-9]/g, '');
    if(y && m) return y + '년 ' + Number(m) + '월';
    if(y) return y + '년';
    if(m) return Number(m) + '월';
    return '';
  }
  function oneLine(){
    var page = document.querySelector('.lf-page'); if(!page) return '';
    var when  = whenOf(page);
    var floor = vOf(page, 'f:floor');
    var field = vOf(page, 'f:field');
    var ttl   = titleOf(page);
    var memo  = vOf(page, '_memo');

    var where = [when, floor, field].filter(Boolean).join(' ');
    var head  = '';
    if(where && ttl)      head = where + ' 「' + ttl + '」';
    else if(ttl)          head = '「' + ttl + '」';
    else if(where)        head = where + ' 작업';
    var sent = head;
    if(memo) sent += (sent ? ' — ' : '') + memo.replace(/[.。]\s*$/, '');
    if(sent) sent += '.';

    var m = matsSentence(page);
    if(m) sent += (sent ? ' ' : '') + m;
    return sent.trim();
  }
  /* 자재를 문장으로 : 사용 자재는 형광등(20W) 3개, 안정기(220V) 1개. */
  function matsSentence(page){
    var list = matsOf(page);
    if(!list.length) return '';
    return '사용 자재는 ' + list.join(', ') + '.';
  }

  /* 자세히 — 채워진 칸을 전부 줄줄이 (예전 방식, 콘솔·단추 길게 누르기용) */
  function fullText(){
    var page = document.querySelector('.lf-page'); if(!page) return '';
    var rows = page.querySelectorAll('.pg-props [data-prow]');
    var SKIP = { '_title':1, '_memo':1, '_att':1 };
    var lines = [];
    [].forEach.call(rows, function(r){
      var id = r.getAttribute('data-prow');
      if(SKIP[id]) return;
      var nm = ((r.querySelector('.pg-pnm')||{}).textContent || '').trim().replace(/^\S+\s/, '');
      var ie = r.querySelector('.lf-ie');
      var v  = ie ? String(ie.value == null ? '' : ie.value).trim()
                  : ((r.querySelector('.pg-pv')||{}).textContent || '').trim();
      if(!v || v === '비어 있음' || v === '—' || v === '0' || !nm) return;
      lines.push('· ' + nm + ' : ' + v);
    });
    return lines.join('\n');
  }

  function putBody(txt, note){
    var B = document.getElementById('pgBodyTx');
    if(!B){ if(typeof toast === 'function') toast('본문을 먼저 펼쳐 주세요'); return; }
    if(!txt){ if(typeof toast === 'function') toast('본문에 넣을 만한 값이 아직 없어요'); return; }
    var add = txt.split('\n').map(function(l){
      return '<div>' + l.replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }) + '</div>';
    }).join('');
    var cur = (B.innerHTML || '').replace(/^(<br>|<div><br><\/div>)$/, '');
    B.innerHTML = cur ? (cur + '<div><br></div>' + add) : add;
    try{ B.dispatchEvent(new Event('input', {bubbles:true})); }catch(e){}
    /* blur 로만 저장하면 코드로 고친 것은 저장이 안 된다 → 저장을 직접 부른다 */
    if(typeof window.wlBodySave === 'function'){ window.wlBodySave(B.innerHTML); }
    else { try{ B.focus(); B.blur(); }catch(e){} }
    if(typeof toast === 'function') toast('📝 ' + (note || '본문에 넣었어요') + ' — 자유롭게 고치세요');
  }
  function toBody(){ putBody(oneLine(), '한 줄로 정리했어요'); }
  function toBodyFull(){ putBody(fullText(), '칸을 전부 적었어요'); }

  /* ── 단추 놓기 ──────────────────────────────────────
        업체 묶음(g1)·자재 묶음(g2) 각각에 ↩ 를 붙인다.
        자기 묶음에 딸린 칸만 지운다 — 남의 칸은 안 건드린다. */
  var UNDO_G = [
    { gid:'g1', head:'_sub', icon:'🏢', name:'업체',
      /* v114 — 달님 : 「업체는 안 지워지고」 → 대표 칸(업체 이름)까지 함께 지운다.
            _sub 는 데이터 칸 셋(workVendor·owner·vendor)을 물고 있어 전부 비운다. */
      headKeys:['workVendor','owner','vendor','company','partyName','payee'],
      keys:['workContact','workRole','workPhone','workMemo',
            'callContact','role','phone','ownerPhone','partyType','partyPhone',
            'person','companyMemo'] },
    { gid:'gt', head:'f:material', icon:'📦', name:'자재',
      headKeys:['material','itemName'],
      keys:['spec','qty','unit','unitPrice','maker','itemCode','cost','amount'] }
  ];

  function hostFor(page, g){
    /* 접혀 있으면 묶음 줄 안, 펼쳐져 있으면 묶음 발치, 그것도 없으면 대표 칸 안 (v124) */
    return page.querySelector('[data-gid="' + g.gid + '"].pg-grow .pg-gv')
        || page.querySelector('[data-gfoot="' + g.gid + '"]')
        || page.querySelector('[data-prow="' + g.head + '"] .pg-pv')
        || null;
  }

  function paint(){
    var page = document.querySelector('.lf-page'); if(!page) return;
    var rid = ridNow(); if(!rid) return;
    var auto = stillAuto(rid);

    UNDO_G.forEach(function(g){
      var mine = g.keys.filter(function(k){ return auto[k] != null; });
      var hasHead = hasVal(rid, g.headKeys);
      if(!mine.length && !hasHead){ window.wlAddOn(['#__none'], 'undo_' + g.gid, function(){ return null; }); return; }
      /* v118 — 접혀 있으면 묶음 줄 안, 펼쳐져 있으면 대표 칸의 값 칸 안.
            둘 다 「값 칸 안쪽」이라 줄이 눌리지 않는다. */
      window.wlAddOn(
        ['[data-gid="' + g.gid + '"] .pg-gv', '[data-prow="' + g.head + '"] .pg-pv'],
        'undo_' + g.gid,
        function(){
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'pg-undo';
          b.textContent = '↩ ' + (g.name || '') + ' 지우기';
          b.title = g.icon + ' 을(를) 골라 저절로 들어간 칸과 대표 칸을 함께 지웁니다';
          b.addEventListener('click', function(ev){ ev.stopPropagation(); undo(rid, g.keys, g.headKeys); });
          return b;
        });
    });

    /* 본문 옆 단추 두 개 — 한 줄 / 자세히 */
    var B = document.getElementById('pgBodyTx');
    if(B && !page.querySelector('#pgSumWrap')){
      var wrap = document.createElement('div');
      wrap.id = 'pgSumWrap'; wrap.className = 'pg-extra'; wrap.style.marginTop = '8px';
      wrap.innerHTML =
          '<button type="button" id="pgSumBody" class="pg-xb on" title="층 · 분야 · 제목 · 내용 · 자재를 한 문장으로">'
        +   '📝 한 줄로 정리해 넣기</button>'
        + '<button type="button" id="pgSumFull" class="pg-xb" title="채워진 칸을 전부 줄줄이 적습니다">'
        +   '📋 칸 전부 적기</button>'
        + '<span id="pgSumPrev" class="pg-sumprev"></span>';
      B.parentNode.insertBefore(wrap, B.nextSibling);
      wrap.querySelector('#pgSumBody').addEventListener('click', toBody);
      wrap.querySelector('#pgSumFull').addEventListener('click', toBodyFull);
    }
    try{
      var pv = page.querySelector('#pgSumPrev');
      if(pv){ var one = oneLine(); pv.textContent = one ? ('→ ' + one.slice(0,90) + (one.length>90?'…':'')) : ''; }
    }catch(e){}
  }

  /* v118 — 파수꾼·감시를 각자 돌리지 않는다 (wlPaint 가 묶어보기 뒤에 부른다) */
  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:40, n:'자동입력 되돌리기', f:paint });

  window.wlAutoUndo = {
    show: function(){ var r = ridNow(); console.table(stillAuto(r)); return r || '기록을 먼저 여세요'; },
    undo: function(){ var r = ridNow(); if(r) undo(r); return r ? '되돌렸습니다' : '기록을 먼저 여세요'; },
    line: function(){ return oneLine() || '(넣을 값이 없어요)'; },
    toBody: toBody,
    toBodyFull: toBodyFull,
    forget: function(){ try{ localStorage.removeItem(LS); }catch(e){} return '자동입력 기록을 지웠습니다'; }
  };
  console.log('[자동채움] v113 준비됨 — 업체·자재 줄 [↩] · 본문 [📝 한 줄로 정리해 넣기]');
})();


/* ============================================================
   💸 지출종류 → 지출 기록 잇기 (wlExpLink)  v114-0829-1950

   달님이 세 번 말한 「지출 종류는 여전히 안돼」의 진짜 뜻을 찾았다.

   예전 전체입력 모달에서는 —
     업무를 저장할 때 지출종류가 개인비용·전표·후불청구면
     **지출 모달이 저절로 열리면서** 업체·내역·분야·자재가 채워졌다.
     (worklog.js 4152행 : v44 지출 모달 자동 호출)

   노션식 화면에는 그 연결이 없다. 그래서 고르기만 하고 **아무 일도 안 일어난다.**
   → 지출종류 줄 옆에 단추를 놓는다.
        · 아직 지출이 없으면  [💸 지출 기록 만들기]
        · 이미 있으면        [💸 연결된 지출 보기]
   ============================================================ */
(function(){
  'use strict';

  var LIVE = { '개인비용':1, '전표':1, '후불청구':1 };

  function ridNow(){
    try{ var m = String(location.hash||'').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function recOf(rid){
    try{ return (entries||[]).filter(function(x){ return x && x.id === rid; })[0] || null; }
    catch(e){ return null; }
  }
  function linkedExp(rid){
    try{ return (entries||[]).filter(function(e){ return e && e.kind === 'expense' && e.workId === rid; })[0] || null; }
    catch(e){ return null; }
  }

  function make(rec, expType){
    /* v131 【근본 수정】 옛 지출 창을 열지 않는다 — 열면 지출에만 저장되고
          업무 기록에는 안 남았다. 지금 화면(업무)은 이미 저장돼 있으므로
          지출 기록만 뒤에서 만들면 두 곳에 다 남는다. */
    try{
      if(window.wlExpSync && typeof window.wlExpSync.now === 'function'){
        var r = window.wlExpSync.now();
        if(typeof toast === 'function') toast('🧾 지출 목록에 등록했어요 — 업무 기록도 그대로 있습니다');
        return r;
      }
      if(typeof window.openExpenseFromWork === 'function'){
        window.openExpenseFromWork({ workObj: rec, workId: rec.id, expType: expType, isEdit: true });
        return;
      }
      if(typeof toast === 'function') toast('지출 연결을 못 불러왔어요 — worklog.js 를 올렸는지 확인해 주세요');
    }catch(e){
      console.error('[지출 잇기] 실패', e);
      if(typeof toast === 'function') toast('지출 기록을 못 만들었어요: ' + (e.message || e));
    }
  }

  function paint(){
    var page = document.querySelector('.lf-page'); if(!page) return;
    var rid = ridNow(); if(!rid) return;
    var rec = recOf(rid);
    var et  = rec ? String(rec.expType || '').trim() : '';

    if(!rec || rec.kind !== 'work' || !LIVE[et]){
      window.wlAddOn(['#__none'], 'explink', function(){ return null; });
      return;
    }
    /* 지출종류를 골랐으면 이 줄은 접기에서 빼 둔다 */
    try{
      var row = page.querySelector('[data-prow="f:expType"]');
      if(row){ row.style.display = ''; row._ruleKeep = 1; }
    }catch(e){}

    /* ★ v128 — 달님 : 「연결된 지출 보기가 아니라 지출 목록에 등록이 되어야지.
          두 군데 저장이 되는 거야. 지출에는 업체·자재가 없다 보니
          지출에서 보니 사라진 것처럼 보인 거고, 업무에는 없었던 거야」

       맞는 지적이다. 창을 하나로 만든 마당에 **다른 기록으로 건너뛰게** 만든 것이
       화면이 통째로 바뀐 것처럼 보이게 했다. 업무 기록은 멀쩡히 저장돼 있었다.
       → 이제 단추가 아니라 **등록 상태 표시**다. 눌러도 화면이 안 바뀐다.
         정말 지출 기록을 보고 싶을 때만 옆의 작은 [보기] 를 누른다 (한 번 물어본다). */
    window.wlAddOn(['[data-gfoot="gc"]', '[data-prow="f:expType"] .pg-pv'], 'explink',
      function(){
        var d = document.createElement('div');
        d.className = 'pg-explink';
        return d;
      },
      function(d){
        var cur = linkedExp(rid);
        if(cur){
          var won = (Number(cur.amount) || 0).toLocaleString('ko-KR');
          d.innerHTML = '<span class="pg-el-ok">\uD83E\uDDFE 지출 목록에 등록됨</span>'
                      + '<span class="pg-el-amt">' + won + '원</span>'
                      + '<button type="button" class="pg-el-go">보기</button>';
          d.title = '이 업무를 고치면 지출 목록도 함께 갱신됩니다';
          var go = d.querySelector('.pg-el-go');
          if(go) go.addEventListener('click', function(ev){
            ev.stopPropagation();
            if(!confirm('지출 기록 화면으로 갑니다.\n\n지출 기록에는 업체·자재 칸이 없어\n화면이 달라 보입니다. 갈까요?')) return;
            try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(cur.id); }
            catch(e){ console.warn('[지출 잇기] 이동 실패', e); }
          });
        }else{
          d.innerHTML = '<span class="pg-el-no">\uD83E\uDDFE 지출 목록에 아직 없음</span>'
                      + '<button type="button" class="pg-el-add">지금 등록</button>';
          d.title = '합계를 넣으면 저절로 등록됩니다';
          var add = d.querySelector('.pg-el-add');
          if(add) add.addEventListener('click', function(ev){
            ev.stopPropagation();
            try{
              if(window.wlExpSync && window.wlExpSync.now) window.wlExpSync.now();
              else { var r2 = recOf(rid); if(r2) make(r2, String(r2.expType || '개인비용')); }
            }catch(e){ console.warn('[지출 잇기] 등록 실패', e); }
          });
        }
      });
  }

  /* v118 — 파수꾼·감시를 각자 돌리지 않는다 */
  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:41, n:'지출 잇기', f:paint });

  window.wlExpLink = {
    run: function(){ paint(); return '다시 살폈습니다'; },
    make: function(){ var r = recOf(ridNow()); if(!r) return '기록을 먼저 여세요';
                      make(r, String(r.expType||'개인비용')); return '지출 화면을 엽니다'; }
  };
  console.log('[지출 잇기] v114 준비됨 — 지출종류를 고르면 [💸 지출 기록 만들기] 가 나옵니다');
})();


/* ============================================================
   🎛 지출종류 = 이 기록의 「모드」 (wlExpMode)  v115-0829-2020

   달님 설계 :
     「지출 개인·전표·후불에 자재까지 넣고, 자재로 대면 밑에 있는 자재 입력창이
       뜨게끔. 그럼 한번에 해결되지 않아? 밑에 항상 자재 입력 나오는 것도 방지되니까」

   즉 지출종류를 고르는 것이 **이 기록에 무엇을 넣을지 정하는 스위치**가 된다.
   늘 떠 있던 아래 영역들이 필요할 때만 나온다.

   ┌ 없음      아무 영역도 안 뜬다 (그냥 업무 기록)
   ├ 📦 자재    자재 사용 내역 입력창이 열린다 · 합계
   ├ 💸 개인비용 자재 내역 + 사진 · 업체 · 합계        → 지출 화면 자동 열림
   ├ 📋 전표    사진 · 업체 · 합계                    → 지출 화면 자동 열림
   └ 📃 후불청구 파일 링크 + 본문 · 업체 · 합계 · 견적 메모 → 지출 화면 자동 열림

   ▸ 내용이 들어 있는 영역은 어떤 모드에서도 감추지 않는다 (데이터를 숨기지 않는다)
   ▸ 자동 열기는 **사람이 지출종류를 직접 바꿨을 때만** 돈다
     (기록을 열기만 해도 창이 튀어나오면 성가시다)
   ▸ 끄기 : 진단 탭 「🎛 지출종류 모드」
   ============================================================ */
(function(){
  'use strict';

  var LS_ON   = 'wl_expmode_on';
  var LS_AUTO = 'wl_expmode_auto';       /* 지출 화면 자동 열기 */
  var LS_MODE = 'wl_modes';              /* 달님이 고친 모드표 */
  var MVER = 4, LS_MVER = 'wl_modes_ver';

  /* v116 응용② — 어느 칸이 「모드 스위치」인지 종류마다 다르다 */
  var SWITCH = {
    work:     'f:expType',    /* 지출종류 */
    expense:  'f:expType',    /* 종류 */
    accident: 'f:accType',    /* 사고 종류 */
    stock:    'f:stockType',  /* 입출고 구분 */
    vacation: 'f:vtype'       /* 휴가 종류 */
  };

  /* 모드표 — 종류 > 고른 값 > {영역, 칸, 안내}
     영역 이름 : sub(하위항목) time(소요시간) mat(자재내역) att(파일링크) body(본문) pics(사진) */
  function baseModes(){
    return {
      work: {
        /* v118 달님 설계 — 「자재로 고르면 자재에서 고르기 창이 뜨고,
              밑에 늘 붙어 있던 자재 입력 화면은 없앤다. 금액도 저절로.」 */
        '자재':     { secs:{ mat:false, pics:false, att:false, sub:false, time:false },
                      props:['_amount'], pick:'mats',
                      hint:'＋ 로 골라 담으면 합계가 저절로 들어갑니다 (지출 기록은 안 만듭니다)' },
        /* v119 — 지출 등록 창을 안 열고 여기서 끝낸다.
              합계를 넣으면 공급가액·부가세가 거꾸로 계산된다. */
        '개인비용': { secs:{ mat:false, pics:true,  att:false, sub:false, time:false },
                      props:['_sub','f:purpose','f:supplyAmt','f:taxAmt','_amount'],
                      pick:'mats', exp:'개인지출',
                      hint:'합계만 넣어도 공급가액·부가세가 저절로 나뉩니다 · 영수증은 📎 스캔앱' },
        '전표':     { secs:{ mat:false, pics:true,  att:false, sub:false, time:false },
                      props:['_sub','f:expSubType','f:purpose','_amount'], exp:'전표',
                      hint:'전표 구분(전기·수도…)과 용도를 고르세요' },
        '후불청구': { secs:{ mat:false, pics:false, att:true,  sub:false, time:false },
                      props:['_sub','f:expSubType','f:purpose','f:supplyAmt','f:taxAmt','_amount',
                             'f:isIssued','f:estimateMemo'], exp:'세금계산서',
                      hint:'합계를 넣으면 공급가액·부가세가 나뉩니다 · 발급을 마치면 「발급 완료」를 켜세요' }
      },
      expense: {
        '개인지출': { secs:{ mat:true,  pics:true,  att:false, sub:false, time:false },
                      props:['_sub','f:purpose','f:supplyAmt','f:taxAmt','_amount'],
                      hint:'영수증 사진을 남겨 두세요 · 합계를 넣으면 공급가액·부가세가 나뉩니다' },
        '세금계산서':{ secs:{ mat:false, pics:false, att:true,  sub:false, time:false },
                      props:['_sub','_amount','f:isIssued','f:supplyAmt','f:taxAmt'],
                      hint:'발행 여부와 공급가액·부가세를 확인하세요' },
        '전표':     { secs:{ mat:false, pics:true,  att:false, sub:false, time:false },
                      props:['_sub','f:expSubType','f:purpose','_amount'],
                      hint:'전표 구분(전기·수도…)과 용도를 고르세요' },
        '급여':     { secs:{ mat:false, pics:false, att:true,  sub:false, time:false },
                      props:['_amount'], hint:'급여 명세는 파일 링크로 걸어 두세요' }
      },
      accident: {
        'default':  { secs:{ pics:true, att:true, body:true, mat:false, sub:false, time:false },
                      props:['_sub','f:partyType','f:partyPhone','f:followUp'],
                      hint:'현장 사진과 후속 조치를 꼭 남겨 두세요' }
      },
      stock: {
        '입고':     { secs:{ mat:false, pics:true, att:true, sub:false, time:false },
                      props:['_sub','f:qty','f:unitPrice','f:docNo'], hint:'전표·계산서 번호를 적어 두세요' },
        '출고':     { secs:{ mat:false, pics:false, att:false, sub:false, time:false },
                      props:['f:qty','f:useTarget'], hint:'어디에 썼는지(사용처)를 적어 두세요' }
      }
    };
  }
  function loadModes(){
    try{
      if(String(localStorage.getItem(LS_MVER)) !== String(MVER)){
        localStorage.removeItem(LS_MODE); localStorage.setItem(LS_MVER, String(MVER));
        return baseModes();
      }
      var raw = localStorage.getItem(LS_MODE);
      if(!raw) return baseModes();
      var o = JSON.parse(raw);
      return (o && typeof o === 'object') ? o : baseModes();
    }catch(e){ console.warn('[지출모드] 읽기 실패', e); return baseModes(); }
  }
  function saveModes(o){
    try{ localStorage.setItem(LS_MODE, JSON.stringify(o)); localStorage.setItem(LS_MVER, String(MVER)); }
    catch(e){ console.warn('[지출모드] 저장 실패', e); }
  }

  var EXPENSE = { '개인비용':1, '전표':1, '후불청구':1 };   /* 지출 기록이 따라붙는 종류 */
  var NONE_SECS = { mat:false, pics:false, att:false, sub:false, time:false };
  function modeFor(kind, val){
    var mm = loadModes()[kind]; if(!mm) return null;
    return mm[val] || mm['default'] || null;
  }
  function switchOf(kind){ return SWITCH[kind] || ''; }

  function isOn(){ try{ return localStorage.getItem(LS_ON) !== '0'; }catch(e){ return true; } }
  function setOn(v){ try{ localStorage.setItem(LS_ON, v?'1':'0'); }catch(e){ console.warn('[지출모드] 저장 실패', e); } }
  /* v119 — 이제 업무 기록 안에서 지출을 다 적으므로 창을 따로 열지 않는다.
        예전 방식이 필요하면 진단 탭에서 켤 수 있다. */
  function isAuto(){ try{ return localStorage.getItem(LS_AUTO) === '1'; }catch(e){ return false; } }
  function setAuto(v){ try{ localStorage.setItem(LS_AUTO, v?'1':'0'); }catch(e){ console.warn('[지출모드] 저장 실패', e); } }

  function ridNow(){
    try{ var m = String(location.hash||'').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function recOf(rid){
    try{ return (entries||[]).filter(function(x){ return x && x.id === rid; })[0] || null; }
    catch(e){ return null; }
  }
  function linkedExp(rid){
    try{ return (entries||[]).filter(function(e){ return e && e.kind==='expense' && e.workId===rid; })[0] || null; }
    catch(e){ return null; }
  }

  function apply(){
    if(!isOn()) return;
    var page = document.querySelector('.lf-page'); if(!page) return;
    var rid = ridNow(); if(!rid) return;
    var rec = recOf(rid); if(!rec) return;

    var sw = switchOf(rec.kind);
    if(!sw) return;
    var et = String(rec[sw.slice(2)] || '').trim();
    var m  = modeFor(rec.kind, et);

    /* ① 아래 영역 — 필요한 것만 */
    try{
      if(typeof window.wlSecForce === 'function') window.wlSecForce(m ? m.secs : NONE_SECS);
    }catch(e){ console.warn('[지출모드] 영역 지시 실패', e); }

    /* ② 속성 칸 — 그 모드에 필요한 것은 비어 있어도 보이고,
          필요 없는 것은 **비어 있을 때만** 감춘다.
          (v121 달님 : 「나와야 할 건 나오고 안 나와도 될 건 안 나오게」)
          ⚠ 값이 들어 있는 칸은 어떤 모드에서도 감추지 않는다 — 데이터가 안 보이면 안 된다 */
    var need = {};
    if(m) (m.props || []).forEach(function(k){ need[k] = 1; });

    /* v122 — 「안 쓰는 칸 감추기」는 기본으로 끈다.
          v121에서 켰더니 지출 화면에서 공급가액·부가세처럼 **있어야 할 칸까지 사라졌다.**
          달님 : 「있어야 할 게 없잖아. 화면은 아까 걸로 되돌려」
          쓰고 싶으면 진단 탭 「👁 안 쓰는 칸 감추기」 를 켠다. */
    var HIDE_ON = false;
    try{ HIDE_ON = localStorage.getItem('wl_modehide_on') === '1'; }catch(e){}

    /* 이 모드에서 쓸 수도 있고 안 쓸 수도 있는 칸들 */
    var SWAY = ['f:purpose','f:expSubType','f:supplyAmt','f:taxAmt','f:isIssued',
                'f:material','f:spec','f:qty','f:estimateMemo'];
    if(m && m.pick === 'mats'){ need['f:material'] = 1; need['f:spec'] = 1; need['f:qty'] = 1; }

    SWAY.forEach(function(k){
      try{
        var r = page.querySelector('[data-prow="' + k + '"]');
        if(!r || r._gHid) return;
        if(!HIDE_ON){                       /* 꺼져 있으면 감추지 않고 되돌려만 놓는다 */
          if(r._modeHid){ r.style.display = ''; r._modeHid = 0; }
          return;
        }
        /* 화면 글자가 아니라 **기록의 값**으로 본다 —
              체크박스(발급 완료)나 0 을 화면 글자로 읽으면 잘못 판단한다 (v121) */
        var raw = rec[k.slice(2)];
        var filled = (raw === true) || (raw != null && raw !== '' && raw !== 0 && raw !== '0' && raw !== false);
        /* v123 — 사람이 숨긴 칸은 자동이 다시 띄우지 않는다 */
        if(window.wlUser && window.wlUser.get('fld', k) === 0){ r.style.display = 'none'; return; }
        if(need[k] || filled){ r.style.display = ''; r._ruleKeep = 1; r._modeHid = 0; }
        else { r.style.display = 'none'; r._modeHid = 1; }
      }catch(e){}
    });

    /* 모드가 꼭 필요하다고 한 나머지 칸도 보이게 */
    if(m){
      m.props.forEach(function(k){
        try{
          if(window.wlUser && window.wlUser.get('fld', k) === 0) return;   /* ✋ 사람이 숨긴 칸 */
          var r2 = page.querySelector('[data-prow="' + k + '"]');
          if(r2 && !r2._gHid){ r2.style.display = ''; r2._ruleKeep = 1; }
        }catch(e){}
      });
    }

    /* ③ 안내 한 줄 + ＋ 자재 담기 단추 — 둘 다 값 칸 안쪽에 (v118 공용 규칙) */
    try{
      if(!m || !m.hint){
        window.wlAddOn(['#__none'], 'modehint', function(){ return null; });
      }else{
        window.wlAddOn(['[data-prow="' + sw + '"] .pg-pv'], 'modehint',
          function(){ var d = document.createElement('div'); d.className = 'pg-modehint'; return d; },
          function(d){ d.textContent = '· ' + m.hint; });
      }
    }catch(e){ console.warn('[지출모드] 안내 실패', e); }

    /* ④ 자재를 쓰는 모드면 ＋ 단추 — 자재 요약 줄, 없으면 지출종류 값 칸 */
    try{
      if(!m || m.pick !== 'mats'){
        window.wlAddOn(['#__none'], 'matadd', function(){ return null; });
      }else{
        window.wlAddOn(['[data-gfoot="gt"]', '[data-gid="gm"] .pg-gv',
                        '[data-prow="' + sw + '"] .pg-pv'], 'matadd',
          function(){
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'pg-matadd';
            b.textContent = '＋ 자재 담기';
            b.title = '저장된 자재에서 골라 담습니다 — 합계가 저절로 들어갑니다';
            b.addEventListener('click', function(ev){ ev.stopPropagation(); openMats(); });
            return b;
          });
      }
    }catch(e){ console.warn('[지출모드] 자재 단추 실패', e); }
  }

  /* 저장된 자재에서 골라 담기 — 예전 「자재에서 고르기」 창을 그대로 쓴다 */
  function openMats(){
    var rid = ridNow(); if(!rid) return;
    var rec = recOf(rid); if(!rec) return;
    if(typeof window.wlPickMats !== 'function'){
      if(typeof toast === 'function') toast('자재 고르기를 못 불러왔어요 — worklog.js 를 올렸는지 확인해 주세요');
      return;
    }
    window.wlPickMats(function(list){
      try{
        var arr = Array.isArray(list) ? list : [];
        var sum = arr.reduce(function(a,m2){ return a + (Number(m2.price)||0) * (Number(m2.qty)||1); }, 0);
        var patch = { materials: arr, matCost: sum };  /* v135 — 자재 값은 「자재 합계」 칸으로 */
        if(typeof updateRecord === 'function') updateRecord(rid, patch);
        if(typeof toast === 'function') toast(
          arr.length ? ('📦 자재 ' + arr.length + '종' + (sum>0 ? (' · 합계 ' + sum.toLocaleString('ko-KR') + '원') : ''))
                     : '자재를 모두 비웠어요');
        setTimeout(function(){
          try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid); }catch(e){}
        }, 150);
      }catch(e){
        console.error('[자재 담기] 실패', e);
        if(typeof toast === 'function') toast('자재를 못 넣었어요: ' + (e.message||e));
      }
    }, Array.isArray(rec.materials) ? rec.materials : []);
  }

  /* ── 사람이 지출종류를 직접 바꿨을 때 ── */
  function onPick(newVal){
    var rid = ridNow(); if(!rid) return;
    /* v121 — 모드가 바뀌면 필요한 칸이 달라진다. 화면을 다시 그려야
          새로 필요해진 칸이 「비용 묶음」 안 제자리로 들어간다.
          (다시 안 그리면 「빈 항목」 쪽에 남아 묶음 밖에 떠 있다) */
    setTimeout(function(){
      try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid); }catch(e){}
    }, 300);
    setTimeout(apply, 700);

    var rec0 = recOf(rid);
    if(!rec0 || rec0.kind !== 'work') return;     /* 지출 화면 자동 열기는 업무에서만 */

    /* v118 — 「자재」를 고르면 곧바로 자재 고르기 창 (업체 고르듯이) */
    var m0 = modeFor(rec0.kind, newVal);
    if(m0 && m0.pick === 'mats' && !EXPENSE[newVal]){
      setTimeout(openMats, 420);
      return;
    }
    if(!EXPENSE[newVal]) return;
    /* v131 【근본 수정】 옛 지출 창을 열지 않는다.
          옛 창에서 저장하면 지출 기록만 생기고 업무 기록에는 아무것도 안 남았다
          (달님 : 「지출 쪽만 저장이 되고 업무 쪽에는 저장이 안돼」).
          화면을 하나로 합쳤으므로, 업무는 이 화면이 저장하고
          지출 기록은 wlExpSync 가 뒤에서 만든다 → 두 곳에 남는다. */
    setTimeout(function(){
      try{
        var rec = recOf(rid); if(!rec) return;
        if(String(rec.expType||'') !== newVal) return;      /* 그새 바뀌었으면 그만둔다 */
        if(isAuto() && typeof window.openExpenseFromWork === 'function' && !linkedExp(rid)){
          window.openExpenseFromWork({ workObj: rec, workId: rid, expType: newVal, isEdit: true });
          return;                                           /* 진단 탭에서 일부러 켠 경우만 */
        }
        if(window.wlExpSync && typeof window.wlExpSync.now === 'function') window.wlExpSync.now();
      }catch(e){ console.warn('[지출모드] 지출 기록 만들기 실패', e); }
    }, 600);
  }

  document.addEventListener('change', function(ev){
    var t = ev.target;
    if(!t || t.tagName !== 'SELECT' || !t.classList || !t.classList.contains('lf-ie')) return;
    try{
      var row = t.closest('[data-prow]');
      if(!row) return;
      var rec1 = recOf(ridNow());
      if(!rec1 || row.getAttribute('data-prow') !== switchOf(rec1.kind)) return;
      onPick(String(t.value || '').trim());
    }catch(e){ console.warn('[지출모드] 고르기 감지 실패', e); }
  }, true);

  /* v118 — 파수꾼을 각자 돌리지 않는다 (묶어보기 다음, 덧붙임 앞) */
  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:30, n:'지출종류 모드', f:apply });

  /* ── 응용① 모드를 달님이 직접 고치는 창 ────────────────
        「어떤 값을 고르면 · 어느 영역이 열리고 · 어떤 칸이 나오는지」를
        표로 보여 주고 체크로 바꾼다. 새 모드를 만들 수도 있다. */
  var SECN = { sub:'🧷 하위 항목', time:'⏱ 소요 시간', mat:'📦 자재 내역',
               att:'📎 파일 링크', body:'📝 본문', pics:'📷 사진' };

  function ES2(x){ return String(x==null?'':x).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function openMgr(){
    var all = loadModes();
    var kinds = Object.keys(all);
    var cur = (function(){ var r = recOf(ridNow()); return (r && all[r.kind]) ? r.kind : kinds[0]; })();

    var ov = document.createElement('div');
    ov.className = 'rl-ov';
    function draw(){
      var mm = all[cur] || {};
      ov.innerHTML =
          '<div class="rl-mod">'
        +   '<div class="rl-head"><b>🎛 모드 고치기</b>'
        +     '<button type="button" id="mmX" class="rl-x">✕</button></div>'
        +   '<div class="rl-note">「어떤 값을 고르면 아래 어느 영역이 열리는지」를 정합니다. '
        +     '내용이 들어 있는 영역은 어떤 모드에서도 감추지 않습니다.</div>'
        +   '<div class="mm-tabs">'
        +     kinds.map(function(k){
              return '<button type="button" class="mm-tab' + (k===cur?' on':'') + '" data-mk="' + ES2(k) + '">'
                   + ES2(k) + ' <span>' + ES2(switchOf(k) || '-') + '</span></button>'; }).join('')
        +   '</div>'
        +   '<div class="rl-list">'
        +     Object.keys(mm).map(function(v){
              var m = mm[v];
              return '<div class="mm-row">'
                + '<div class="mm-name"><b>' + ES2(v) + '</b>'
                +   '<button type="button" class="mm-del" data-mdel="' + ES2(v) + '" title="이 모드 빼기">✕</button></div>'
                + '<div class="mm-secs">'
                +   Object.keys(SECN).map(function(sk){
                      var on = !!(m.secs && m.secs[sk]);
                      return '<button type="button" class="mm-s' + (on?' on':'') + '" data-ms="' + ES2(v) + '|' + sk + '">'
                           + SECN[sk] + '</button>'; }).join('')
                + '</div>'
                + '<input class="mm-hint" data-mh="' + ES2(v) + '" value="' + ES2(m.hint||'') + '" placeholder="안내 한 줄 (선택)">'
                + '</div>'; }).join('')
        +   '</div>'
        +   '<div class="rl-add"><b>＋ 새 모드</b>'
        +     '<input id="mmNew" placeholder="고를 값 이름 (예: 청소, 점검)">'
        +     '<button type="button" id="mmAdd">넣기</button></div>'
        +   '<div class="rl-foot"><button type="button" id="mmReset">처음으로 되돌리기</button>'
        +     '<span class="rl-hint">' + ES2(cur) + ' 의 스위치 칸 : ' + ES2(switchOf(cur)||'없음') + '</span></div>'
        + '</div>';

      ov.querySelectorAll('[data-mk]').forEach(function(b){
        b.addEventListener('click', function(){ cur = b.getAttribute('data-mk'); draw(); }); });
      ov.querySelectorAll('[data-ms]').forEach(function(b){
        b.addEventListener('click', function(){
          var pr = b.getAttribute('data-ms').split('|');
          var m = all[cur][pr[0]]; if(!m) return;
          m.secs = m.secs || {};
          m.secs[pr[1]] = !m.secs[pr[1]];
          saveModes(all); draw(); apply();
        }); });
      ov.querySelectorAll('[data-mh]').forEach(function(i){
        i.addEventListener('change', function(){
          var m = all[cur][i.getAttribute('data-mh')]; if(!m) return;
          m.hint = i.value; saveModes(all); apply();
        }); });
      ov.querySelectorAll('[data-mdel]').forEach(function(b){
        b.addEventListener('click', function(){
          delete all[cur][b.getAttribute('data-mdel')]; saveModes(all); draw(); apply();
        }); });
      var addB = ov.querySelector('#mmAdd');
      if(addB) addB.addEventListener('click', function(){
        var v = (ov.querySelector('#mmNew').value || '').trim();
        if(!v){ alert('고를 값 이름을 적어 주세요'); return; }
        all[cur] = all[cur] || {};
        all[cur][v] = { secs:{ mat:false, pics:false, att:false, sub:false, time:false }, props:[], hint:'' };
        saveModes(all); draw(); apply();
      });
      var rs = ov.querySelector('#mmReset');
      if(rs) rs.addEventListener('click', function(){
        try{ localStorage.removeItem(LS_MODE); localStorage.removeItem(LS_MVER); }catch(e){}
        all = loadModes(); draw(); apply();
      });
      var xb = ov.querySelector('#mmX');
      if(xb) xb.addEventListener('click', function(){ ov.remove(); apply(); });
    }
    draw();
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', function(e){ if(e.target === ov){ ov.remove(); apply(); } });
  }

  /* ── 진단 탭 스위치 ── */
  function panel(){
    var host = document.getElementById('sfPanel');
    if(!host || document.getElementById('emBtn')) return;
    var row = host.querySelector('.btn-row'); if(!row) return;
    var b = document.createElement('button'); b.id='emBtn'; b.style.minHeight='44px';
    function paint(){
      b.textContent = isOn() ? '🎛 지출종류 모드 켜짐' : '🎛 지출종류 모드 꺼짐';
      b.className = 'btn btn-sm ' + (isOn()?'btn-primary':'btn-ghost'); b.style.minHeight='44px';
    }
    b.addEventListener('click', function(){ setOn(!isOn()); paint(); apply(); });
    paint(); row.appendChild(b);

    var a = document.createElement('button'); a.id='emAuto'; a.style.minHeight='44px';
    function paintA(){
      a.textContent = isAuto() ? '💸 옛 지출 창 자동 열림' : '💸 옛 지출 창 안 열림';
      a.className = 'btn btn-sm ' + (isAuto()?'btn-primary':'btn-ghost'); a.style.minHeight='44px';
    }
    a.addEventListener('click', function(){ setAuto(!isAuto()); paintA(); });
    paintA(); row.appendChild(a);

    if(!document.getElementById('emHide')){
      var h2 = document.createElement('button'); h2.id='emHide'; h2.style.minHeight='44px';
      function paintH(){
        var on = false; try{ on = localStorage.getItem('wl_modehide_on') === '1'; }catch(e){}
        h2.textContent = on ? '👁 안 쓰는 칸 감춤' : '👁 칸 전부 보임';
        h2.className = 'btn btn-sm ' + (on?'btn-primary':'btn-ghost'); h2.style.minHeight='44px';
      }
      h2.addEventListener('click', function(){
        var on = false; try{ on = localStorage.getItem('wl_modehide_on') === '1'; }catch(e){}
        try{ localStorage.setItem('wl_modehide_on', on ? '0' : '1'); }catch(e){}
        paintH(); apply();
      });
      paintH(); row.appendChild(h2);
    }
    if(!document.getElementById('emMgr')){
      var m2 = document.createElement('button');
      m2.id = 'emMgr'; m2.className = 'btn btn-ghost btn-sm'; m2.style.minHeight = '44px';
      m2.textContent = '⚙ 모드 고치기';
      m2.addEventListener('click', openMgr);
      row.appendChild(m2);
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 2400);

  /* v119 — 그 모드에서 꼭 필요한 칸 목록. openPage 가 「늘 보이는 칸」으로 쓴다.
        (비어 있다고 「빈 항목」 뒤로 밀리면 합계와 따로 놀아 보기 나쁘다) */
  window.wlModeProps = function(kind, val){
    try{
      var m = modeFor(kind, String(val==null?'':val).trim());
      return (m && Array.isArray(m.props)) ? m.props.slice() : [];
    }catch(e){ return []; }
  };
  window.wlModeSwitch = function(kind){ try{ return switchOf(kind); }catch(e){ return ''; } };

  window.wlExpMode = {
    on:   function(){ setOn(1); apply(); return '지출종류가 화면을 정합니다'; },
    off:  function(){ setOn(0); try{ window.wlSecForce(null); }catch(e){} return '늘 다 보여줍니다'; },
    auto: function(v){ setAuto(v !== false); return isAuto() ? '지출 화면이 저절로 열립니다' : '손으로 엽니다'; },
    run:  function(){ apply(); return '다시 맞췄습니다'; },
    mats: function(){ openMats(); return '자재 고르기 창'; },
    modes:function(){
      var all = loadModes(), rows = [];
      Object.keys(all).forEach(function(k){
        Object.keys(all[k]).forEach(function(v){
          var m = all[k][v];
          rows.push({ 종류:k, 스위치:switchOf(k), 고른값:v,
                      영역:Object.keys(m.secs||{}).filter(function(x){ return m.secs[x]; }).join(','),
                      칸:(m.props||[]).join(','), 안내:m.hint||'' });
        });
      });
      console.table(rows); return rows.length + '가지';
    },
    open: function(){ openMgr(); return '모드 고치기 창'; },
    reset:function(){ try{ localStorage.removeItem(LS_MODE); localStorage.removeItem(LS_MVER); }catch(e){}
                      apply(); return '처음 모드로 되돌렸습니다'; }
  };
  console.log('[지출모드] v115 준비됨 — 지출종류가 아래 영역·칸을 정합니다 (wlExpMode.modes())');
})();


/* ============================================================
   🧬 칸 ↔ 데이터 지도 (wlFieldMap)  v115-0829-2020

   2026-08-29에 「업체를 지워도 옛 이름이 되살아나는」 사고가 났다.
   화면의 칸 하나가 데이터 칸 여럿을 물고 있는데 그게 어디에도 안 보였기 때문이다.

   이 표는 그것을 눈에 보이게 한다.
     화면 이름 / 속성 이름 / 물고 있는 데이터 칸 / 지금 값 / 👻 숨은 값

   👻 표시가 있으면 = 화면에 안 보이는 값이 뒤에 숨어 있다는 뜻.
   쓰는 법 : 콘솔에 wlFieldMap()  또는 진단 탭 [🧬 칸-데이터 지도]
   ============================================================ */
(function(){
  'use strict';

  function ridNow(){
    try{ var m = String(location.hash||'').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function recOf(rid){
    try{ return (entries||[]).filter(function(x){ return x && x.id === rid; })[0] || null; }
    catch(e){ return null; }
  }
  function bmapOf(kind){
    try{ return (window.wlBMAP && window.wlBMAP[kind]) || null; }catch(e){ return null; }
  }

  function build(){
    var rid = ridNow(), rec = recOf(rid);
    if(!rec) return { err:'기록을 하나 연 다음에 다시 눌러주세요' };
    var page = document.querySelector('.lf-page');
    var bm = bmapOf(rec.kind) || {};
    var rows = [];

    /* 기본 칸 — 데이터 칸 여러 개를 물고 있는 것들 */
    Object.keys(bm).forEach(function(pid){
      var keys = bm[pid] || [];
      if(!keys.length) return;
      var vals = keys.map(function(k){ return { k:k, v:(rec[k]==null?'':String(rec[k])) }; });
      var shown = vals.filter(function(x){ return x.v !== ''; })[0];
      var hidden = vals.filter(function(x){ return x.v !== '' && (!shown || x.k !== shown.k); });
      var nm = '';
      try{ nm = ((page.querySelector('[data-prow="'+pid+'"] .pg-pnm')||{}).textContent||'').trim().replace(/^\S+\s/,''); }catch(e){}
      rows.push({
        '보이는 이름': nm || pid,
        '속성': pid,
        '물고 있는 데이터 칸': keys.join(' · '),
        '지금 보이는 값': shown ? (shown.k + '=' + shown.v) : '(비어 있음)',
        '👻 숨은 값': hidden.length ? hidden.map(function(x){ return x.k+'='+x.v; }).join(' , ') : ''
      });
    });

    /* 그 종류의 나머지 칸 — 1:1 이라 안전하다 */
    var one = [];
    try{
      [].forEach.call(page.querySelectorAll('.pg-props [data-prow]'), function(r){
        var pid = r.getAttribute('data-prow');
        if(pid.slice(0,2) !== 'f:') return;
        var k = pid.slice(2);
        one.push({ '보이는 이름': ((r.querySelector('.pg-pnm')||{}).textContent||'').trim().replace(/^\S+\s/,''),
                   '속성': pid, '데이터 칸': k,
                   '지금 값': (rec[k]==null?'':String(rec[k])).slice(0,40) });
      });
    }catch(e){}

    var ghosts = rows.filter(function(r){ return r['👻 숨은 값']; });
    return { kind:rec.kind, rows:rows, one:one, ghosts:ghosts };
  }

  function run(){
    var d = build();
    if(d.err){ console.log(d.err); return d.err; }
    console.log('%c🧬 칸 ↔ 데이터 지도  (' + d.kind + ')', 'color:#2563a8;font-size:14px;font-weight:800');
    console.log('── 여러 데이터 칸을 물고 있는 기본 칸 ──');
    console.table(d.rows);
    console.log('── 1:1 로 이어진 칸 (안전) ──');
    console.table(d.one);
    if(d.ghosts.length){
      console.warn('👻 숨은 값이 ' + d.ghosts.length + '군데 있습니다 — 지우면 이 값이 올라옵니다:');
      d.ghosts.forEach(function(g){ console.warn('   ' + g['보이는 이름'] + ' ← ' + g['👻 숨은 값']); });
    }else{
      console.log('✅ 숨은 값 없음');
    }
    try{
      var box = document.getElementById('scResult');
      if(box){
        var pre = document.createElement('pre');
        pre.style.cssText = 'margin-top:10px;padding:11px 13px;border-radius:10px;background:#f7faff;'
          + 'border:1px solid #dbe6f4;font-size:12px;line-height:1.65;white-space:pre-wrap;'
          + 'font-family:ui-monospace,Menlo,Consolas,monospace;color:#3d5875';
        pre.textContent = '🧬 칸 ↔ 데이터 지도 (' + d.kind + ')\n\n'
          + d.rows.map(function(r){
              return (r['보이는 이름']+'        ').slice(0,10) + ' ← ' + r['물고 있는 데이터 칸']
                   + '\n    지금 : ' + r['지금 보이는 값']
                   + (r['👻 숨은 값'] ? '\n    👻 숨은 값 : ' + r['👻 숨은 값'] : ''); }).join('\n\n')
          + '\n\n' + (d.ghosts.length ? ('👻 숨은 값 ' + d.ghosts.length + '군데 — 지우면 이 값이 올라옵니다')
                                      : '✅ 숨은 값 없음');
        box.appendChild(pre);
      }
    }catch(e){}
    return d.ghosts.length ? ('👻 숨은 값 ' + d.ghosts.length + '군데') : '✅ 숨은 값 없음';
  }

  /* 응용③ — 찾은 👻 숨은 값을 한 번에 정리한다.
        화면에 보이는 값은 그대로 두고, 뒤에 숨어 있던 값만 비운다.
        (다른 기본칸이 쓰는 칸은 애초에 지도에 안 잡히므로 안전하다) */
  function sweep(){
    var d = build();
    if(d.err){ if(typeof toast === 'function') toast(d.err); return d.err; }
    if(!d.ghosts.length){ if(typeof toast === 'function') toast('✅ 숨은 값이 없습니다'); return '없음'; }

    var rid = ridNow(), rec = recOf(rid);
    var bm = bmapOf(rec.kind) || {};
    var used = {};
    for(var ok in bm){ (bm[ok]||[]).forEach(function(k){ used[k] = (used[k]||0) + 1; }); }

    var patch = {}, names = [];
    Object.keys(bm).forEach(function(pid){
      var keys = bm[pid] || [];
      var shownK = null;
      for(var i=0;i<keys.length;i++){
        var v = rec[keys[i]];
        if(v != null && String(v) !== ''){ shownK = keys[i]; break; }
      }
      if(!shownK) return;
      for(var j=0;j<keys.length;j++){
        var k = keys[j];
        if(k === shownK) continue;
        if(used[k] > 1) continue;                       /* 다른 기본칸도 쓰는 칸은 안 건드린다 */
        var cv = rec[k];
        if(cv == null || String(cv) === '') continue;
        patch[k] = '';
        names.push(k + '=' + String(cv).slice(0,20));
      }
    });
    if(!Object.keys(patch).length){
      if(typeof toast === 'function') toast('정리할 숨은 값이 없습니다 (다른 칸이 함께 쓰는 값은 그대로 둡니다)');
      return '없음';
    }
    if(!confirm('숨어 있던 값 ' + names.length + '개를 비웁니다.\n\n'
              + names.join('\n') + '\n\n화면에 보이는 값은 그대로 둡니다. 계속할까요?')) return '취소';
    try{
      if(typeof updateRecord === 'function') updateRecord(rid, patch);
      if(typeof toast === 'function') toast('🧹 숨은 값 ' + names.length + '개를 정리했어요');
      setTimeout(function(){ try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid); }catch(e){} }, 150);
      return '정리 ' + names.length + '개';
    }catch(e){
      console.error('[칸 지도] 정리 실패', e);
      if(typeof toast === 'function') toast('정리하지 못했어요: ' + (e.message||e));
      return '실패';
    }
  }

  window.wlFieldMap = run;
  window.wlFieldSweep = sweep;

  function panel(){
    var host = document.getElementById('sfPanel');
    if(!host || document.getElementById('fmBtn')) return;
    var row = host.querySelector('.btn-row'); if(!row) return;
    var b = document.createElement('button');
    b.id='fmBtn'; b.className='btn btn-ghost btn-sm'; b.style.minHeight='44px';
    b.textContent = '🧬 칸-데이터 지도';
    b.addEventListener('click', function(){
      try{ var box=document.getElementById('scResult'); if(box) box.innerHTML=''; }catch(e){}
      var r = run();
      if(typeof toast === 'function') toast(String(r));
    });
    row.appendChild(b);

    if(!document.getElementById('fsBtn')){
      var c = document.createElement('button');
      c.id='fsBtn'; c.className='btn btn-ghost btn-sm'; c.style.minHeight='44px';
      c.textContent = '🧹 숨은 값 정리';
      c.title = '지도에서 찾은 👻 숨은 값만 비웁니다 (보이는 값은 그대로)';
      c.addEventListener('click', function(){ sweep(); });
      row.appendChild(c);
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 2600);

  console.log('[칸 지도] v115 준비됨 — 콘솔에 wlFieldMap() 또는 진단 탭 [🧬 칸-데이터 지도]');
})();


/* ============================================================
   🖌 화면에 덧붙이는 것들의 규칙 (wlPaint)  v118-0829-2230

   ── 왜 만들었나 ────────────────────────────────────────
   같은 증상이 세 번 넘게 났다. 기본지침 3-2 : 「2회 이상이면 땜빵 중단, 근본 수정」

   ❶ 「후/불/청/구」 처럼 값 칸이 세로로 쪼개짐  (2회)
      속성 줄 .pg-prow 는 flex 다. 거기에 단추를 **형제**로 넣으면
      칸이 하나 더 늘어 값 상자가 눌린다.
      → 규칙 : 속성 줄에 덧붙이는 것은 **반드시 값 칸(.pg-pv) 안쪽 아래**에 넣는다.

   ❷ 단추가 「나왔다 안 나왔다」  (3회)
      묶어보기·자동채움·지출잇기·지출모드가 **각자 0.4초 파수꾼**을 돌렸다.
      묶어보기가 줄을 다시 그리면 거기 붙어 있던 단추가 같이 지워지고,
      다음 파수꾼이 돌 때까지 안 보였다 → 깜빡임.
      → 규칙 : 그리는 차례를 **한 곳에서** 정한다.
              영역 접기 → 묶어보기 → 모드 → 덧붙임 순서로 한 번에.

   ── 쓰는 법 ────────────────────────────────────────────
   window.wlPaintReg(순서, 이름, 함수)    ← 그릴 것을 등록
   window.wlAddOn(찾을곳, 이름, 만들기)   ← 값 칸 안쪽에 안전하게 붙이기
   window.wlAfterPaint()                  ← 묶어보기가 다 그린 뒤 부른다
   ============================================================ */
(function(){
  'use strict';

  var Q = window.__wlPaintQ || (window.__wlPaintQ = []);
  Q.sort(function(a,b){ return a.o - b.o; });          /* 모듈이 밀어 넣은 것도 차례대로 */

  window.wlPaintReg = function(order, name, fn){
    if(typeof fn !== 'function') return;
    for(var i=0;i<Q.length;i++) if(Q[i].n === name) return;   /* 두 번 등록 방지 */
    Q.push({ o: order, n: name, f: fn });
    Q.sort(function(a,b){ return a.o - b.o; });
  };

  var painting = false;
  var qn = -1;
  function paintAll(){
    if(painting) return;                       /* 그리다가 또 그리기 방지 (되돌이 막기) */
    painting = true;
    /* v132 — 예전엔 파일을 읽을 때 딱 한 번만 차례를 매겼다.
          그래서 뒤에 새로 붙인 모듈이 제 차례(o) 를 무시하고 맨 끝에 붙었다.
          늘어났을 때만 다시 매긴다 (매번 정렬하지 않는다). */
    if(Q.length !== qn){ Q.sort(function(a,b){ return a.o - b.o; }); qn = Q.length; }
    try{
      for(var i=0;i<Q.length;i++){
        try{ Q[i].f(); }
        catch(e){ console.warn('[그리기] ' + Q[i].n + ' 실패', e); }
      }
    } finally { painting = false; }
  }
  window.wlAfterPaint = paintAll;

  /* ── 값 칸 안쪽에 안전하게 붙이기 ──
        host  : 붙일 곳을 찾는 선택자 (여러 개면 앞에서부터)
        key   : 이 덧붙임의 이름 (id 가 된다)
        make  : 없을 때 새로 만드는 함수 → 요소를 돌려준다
        upd   : 이미 있을 때 손볼 함수 (선택)
     ▸ 붙일 곳이 없으면 조용히 치운다
     ▸ 이미 제자리에 있으면 그대로 둔다 (깜빡임 없음) */
  window.wlAddOn = function(hosts, key, make, upd){
    var page = document.querySelector('.lf-page');
    var id = 'ao-' + key;
    var old = page ? page.querySelector('#' + id) : document.getElementById(id);
    if(!page){ if(old) old.remove(); return null; }

    var host = null;
    var list = Array.isArray(hosts) ? hosts : [hosts];
    for(var i=0;i<list.length;i++){
      var h = page.querySelector(list[i]);
      if(h){ host = h; break; }
    }
    if(!host){ if(old) old.remove(); return null; }

    if(old && old.parentNode === host){                  /* 이미 제자리 */
      if(upd) try{ upd(old); }catch(e){ console.warn('[덧붙임] ' + key + ' 손보기 실패', e); }
      return old;
    }
    if(old) old.remove();
    var el;
    try{ el = make(); }catch(e){ console.warn('[덧붙임] ' + key + ' 만들기 실패', e); return null; }
    if(!el) return null;
    el.id = id;
    el.classList.add('pg-addon');
    host.appendChild(el);                                /* ★ 언제나 값 칸 안쪽 아래 */
    if(upd) try{ upd(el); }catch(e){ console.warn('[덧붙임] ' + key + ' 손보기 실패', e); }
    return el;
  };

  /* 묶어보기가 안 도는 화면(다른 종류·다른 상황)을 위한 되받이 파수꾼 —
     모듈마다 따로 돌리지 않고 이것 하나만 돈다 */
  var seen = null;
  setInterval(function(){
    try{
      var pr = document.querySelector('.lf-page .pg-props');
      if(pr && pr !== seen){ seen = pr; paintAll(); }
      else if(!pr){ seen = null; }
    }catch(e){ console.warn('[그리기] 파수꾼 실패', e); }
  }, 400);

  window.wlPaint = {
    now:  function(){ paintAll(); return '다시 그렸습니다'; },
    list: function(){ console.table(Q.map(function(x){ return { 순서:x.o, 이름:x.n }; }));
                      return Q.length + '개'; }
  };
  console.log('[그리기] v118 준비됨 — 덧붙임은 값 칸 안쪽에, 차례는 한 곳에서 (wlPaint.list())');
})();


/* ============================================================
   🧾 업무 안에서 지출 끝내기 (wlExpSync)  v119-0829-2320

   달님 : 「지출 등록도 따로 열지 말고 등록 모달에서 만드는 걸로 해.
           개인 지출이면 사용 내역·용도 고를 수 있게, 공급가액·부가세·합계 나오게,
           합계금액을 넣으면 역계산도 되게. 세금계산서도 용도·발급 완료까지.
           전표는 전표 구분·용도. 이제 지출등록 모달 따로 안 나오게.」

   ── 하는 일 두 가지 ────────────────────────────────────
   ① 세 금액 칸을 서로 맞춘다
        합계를 넣으면      → 공급가액 = 합계 ÷ 1.1 (반올림) · 부가세 = 합계 − 공급가액
        공급가액을 넣으면  → 부가세 = 공급가액 × 10% · 합계 = 둘의 합
        부가세를 고치면    → 합계 = 공급가액 + 부가세
        (사람이 방금 고친 칸은 절대 안 건드린다)

   ② 지출 기록을 뒤에서 만들고 갱신한다
        ⚠ 지출 탭·월보고·정산은 **지출 기록(kind:'expense')** 을 세어서 만든다.
          업무 기록에만 적으면 그 숫자가 통째로 어긋난다.
          그래서 화면은 하나만 쓰되, 저장은 두 곳에 남긴다.
        · workId 로 이어 두고, 같은 업무엔 언제나 한 건만 만든다
        · 업무에서 지운 값은 지출에서도 지운다
        · 지출 기록을 사람이 직접 고쳤으면(직접수정 표시) 덮어쓰지 않는다

   되돌리기 : 진단 탭 「🧾 지출 자동 연결」 을 끄면 예전처럼 창으로 만든다
   ============================================================ */
(function(){
  'use strict';

  var LS_ON = 'wl_expsync_on';
  /* 업무 지출종류 → 지출 기록의 정산종류 */
  var MAP = { '개인비용':'개인지출', '전표':'전표', '후불청구':'세금계산서' };

  function isOn(){ try{ return localStorage.getItem(LS_ON) !== '0'; }catch(e){ return true; } }
  function setOn(v){ try{ localStorage.setItem(LS_ON, v?'1':'0'); }catch(e){ console.warn('[지출연결] 저장 실패', e); } }

  function ridNow(){
    try{ var m = String(location.hash||'').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function recOf(id){
    try{ return (entries||[]).filter(function(x){ return x && x.id === id; })[0] || null; }
    catch(e){ return null; }
  }
  function linkedExp(rid){
    try{ return (entries||[]).filter(function(e){ return e && e.kind==='expense' && e.workId===rid; })[0] || null; }
    catch(e){ return null; }
  }
  function n(v){ var x = Number(String(v==null?'':v).replace(/[^0-9.\-]/g,'')); return isFinite(x) ? x : 0; }

  /* ── ① 공급가액 · 부가세 · 합계 맞추기 ────────────────── */
  function balance(rid, edited){
    var r = recOf(rid); if(!r) return null;
    var sup = n(r.supplyAmt), tax = n(r.taxAmt), tot = n(r.cost);
    var p = {};

    if(edited === 'cost'){
      if(tot > 0){
        var s2 = Math.round(tot / 1.1);
        var t2 = tot - s2;
        if(s2 !== sup) p.supplyAmt = s2;
        if(t2 !== tax) p.taxAmt = t2;
      }else{                                   /* 합계를 지우면 나머지도 비운다 */
        if(sup) p.supplyAmt = '';
        if(tax) p.taxAmt = '';
      }
    }else if(edited === 'supplyAmt'){
      if(sup > 0){
        var t3 = Math.round(sup * 0.1);
        var c3 = sup + t3;
        if(t3 !== tax) p.taxAmt = t3;
        if(c3 !== tot) p.cost = c3;
      }
    }else if(edited === 'taxAmt'){
      var c4 = sup + tax;
      if(sup > 0 && c4 !== tot) p.cost = c4;
    }
    return Object.keys(p).length ? p : null;
  }

  /* ── ② 지출 기록 만들고 갱신하기 ──────────────────────── */
  /* ★ v120 — 달님 질문 : 「원래 지출 부분 개인·전표·후불청구는 지출에 다 들어가게
        되어 있어. 이거 꼬인 거 아니지?」  → 직접 확인해 보니 꼬일 수 있었다.

        · worklog.js 에 이런 주석이 있다 :
            「v44: syncWorkExpense 비활성화 — 자동 생성/삭제는 더 이상 하지 않음.
              사용자가 직접 통제」
          즉 예전에 자동 생성을 **일부러 껐던** 것이다.
        · 옛 방식(지출 창에서 직접 작성)으로 만든 지출에도 workId 가 붙는다.
        · 내 코드가 그것을 「내가 만든 것」으로 알고 **덮어쓸 수 있었다.**
          지출 창에서 넣은 자재 명세·택배비 같은 것이 날아갈 수 있다.

        그래서 규칙을 하나로 못박는다 :
            ▶ 내가 만든 지출(autoFromWork 표시가 있는 것)만 내가 고친다.
            ▶ 표시가 없는 지출은 읽기만 하고 **절대 손대지 않는다.**
        (기본지침 「저장·수정·삭제 3원칙」 — 남이 넣은 값을 잃지 않는다) */
  function isMine(e){ return !!(e && e.autoFromWork === true); }

  function expPatch(r){
    var et = MAP[String(r.expType||'').trim()];
    if(!et) return null;
    var memo = [ (r.floor||''), (r.field? '['+r.field+']' : '') ].filter(Boolean).join(' ');
    return {
      kind:      'expense',
      workId:    r.id,
      date:      r.date || '',
      expType:   et,
      expSubType:r.expSubType || '',
      title:     r.title || '',
      vendor:    r.workVendor || '',
      field:     r.field || '',
      purpose:   r.purpose || '',
      supplyAmt: n(r.supplyAmt) || '',
      taxAmt:    n(r.taxAmt) || '',
      amount:    n(r.cost) || 0,
      isIssued:  !!r.isIssued,
      isJeonpyo: et === '전표',
      autoFromWork: true,                 /* ★ 내가 만든 것이라는 표시 */
      memo:      memo,
      photos:    Array.isArray(r.photos) ? r.photos : [],
      scanRefs:  Array.isArray(r.scanRefs) ? r.scanRefs : [],
      linkedTo:  r.id
    };
  }
  function same(a, b){
    for(var k in b){
      if(k === 'photos' || k === 'scanRefs'){
        if(JSON.stringify(a[k]||[]) !== JSON.stringify(b[k]||[])) return false;
        continue;
      }
      if(String(a[k] == null ? '' : a[k]) !== String(b[k] == null ? '' : b[k])) return false;
    }
    return true;
  }

  function sync(rid, quiet){
    if(!isOn()) return '';
    var r = recOf(rid);
    if(!r || r.kind !== 'work') return '';
    var want = expPatch(r);
    var cur  = linkedExp(rid);

    if(!want){                                        /* 지출종류를 없앴다 → 딸린 지출은 그대로 둔다 */
      if(cur && !quiet && typeof toast === 'function')
        toast('지출종류를 비웠어요 — 이미 만든 지출 기록은 그대로 둡니다 (지출 탭에서 지우세요)');
      return '';
    }
    if(!cur){
      if(!(n(r.cost) > 0) && !r.title) return '';     /* 아직 적을 게 없다 */
      try{
        var made = addRecord(want);
        if(!quiet && typeof toast === 'function') toast('🧾 지출 기록을 만들었어요 — 지출 탭에도 올라갑니다');
        return made ? made.id : '';
      }catch(e){ console.error('[지출연결] 만들기 실패', e); return ''; }
    }
    /* ★ 내가 만든 것이 아니면 읽기만 한다 — 지출 창에서 직접 넣은 값을 지키기 위해 */
    if(!isMine(cur)){
      if(!quiet && typeof toast === 'function')
        toast('이 업무엔 직접 만든 지출 기록이 있어요 — 그쪽 값은 건드리지 않습니다');
      return cur.id;
    }
    if(same(cur, want)) return cur.id;
    try{
      updateRecord(cur.id, want);
      if(!quiet && typeof toast === 'function') toast('🧾 지출 기록도 함께 고쳤어요');
    }catch(e){ console.error('[지출연결] 갱신 실패', e); }
    return cur.id;
  }

  /* ── 값이 바뀌면 : 금액 맞추기 → 지출 반영 ────────────── */
  var WATCH = { '_amount':'cost', 'f:supplyAmt':'supplyAmt', 'f:taxAmt':'taxAmt' };
  var ALSO  = { 'f:expType':1, 'f:expSubType':1, 'f:purpose':1, 'f:isIssued':1,
                '_sub':1, '_date':1, 'f:field':1, 'f:floor':1 };
  var timer = null;

  function afterEdit(prow){
    var rid = ridNow(); if(!rid) return;
    clearTimeout(timer);
    timer = setTimeout(function(){
      try{
        var edited = WATCH[prow] || '';
        var p = edited ? balance(rid, edited) : null;
        if(p){
          updateRecord(rid, p);
          setTimeout(function(){
            try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid); }catch(e){}
          }, 120);
        }
        sync(rid, false);
      }catch(e){ console.warn('[지출연결] 반영 실패', e); }
    }, 420);                                  /* 편집이 저장된 뒤에 돈다 */
  }

  document.addEventListener('change', function(ev){
    var t = ev.target;
    if(!t || !t.classList || !t.classList.contains('lf-ie')) return;
    try{
      var row = t.closest('[data-prow]'); if(!row) return;
      var k = row.getAttribute('data-prow');
      if(WATCH[k] || ALSO[k]) afterEdit(k);
    }catch(e){}
  }, true);
  /* 제목·내용은 blur 로 저장되므로 따로 본다 */
  document.addEventListener('blur', function(ev){
    var t = ev.target;
    if(t && t.id === 'pgTitle') afterEdit('');
  }, true);

  /* 화면을 그릴 때마다 조용히 한 번 맞춘다 (자재 합계가 바뀐 경우 등) */
  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:45, n:'지출 자동 연결', f:function(){
    try{
      var rid = ridNow(); if(!rid) return;
      var r = recOf(rid); if(!r || r.kind !== 'work') return;
      if(!MAP[String(r.expType||'').trim()]) return;
      sync(rid, true);
    }catch(e){ console.warn('[지출연결] 살피기 실패', e); }
  }});

  /* ── 진단 탭 스위치 ── */
  function panel(){
    var host = document.getElementById('sfPanel');
    if(!host || document.getElementById('esBtn')) return;
    var row = host.querySelector('.btn-row'); if(!row) return;
    var b = document.createElement('button'); b.id='esBtn'; b.style.minHeight='44px';
    function paint(){
      b.textContent = isOn() ? '🧾 지출 자동 연결 켜짐' : '🧾 지출 자동 연결 꺼짐';
      b.className = 'btn btn-sm ' + (isOn()?'btn-primary':'btn-ghost'); b.style.minHeight='44px';
    }
    b.addEventListener('click', function(){ setOn(!isOn()); paint(); });
    paint(); row.appendChild(b);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 2800);

  window.wlExpSync = {
    /* 🔎 업무에 딸린 지출이 「자동」인지 「직접」인지 전부 보여준다 (덮어쓰기 걱정 확인용) */
    check: function(){
      var out = [];
      try{
        (entries||[]).forEach(function(e){
          if(!e || e.kind !== 'expense' || !e.workId) return;
          var w = recOf(e.workId);
          out.push({
            업무: w ? (w.date + ' ' + (w.title||'(제목없음)')).slice(0,28) : '(업무 없음)',
            지출종류: e.expType || '',
            금액: n(e.amount),
            만든이: isMine(e) ? '🤖 자동' : '✋ 직접(안 건드림)',
            내역: (e.title||'').slice(0,20)
          });
        });
      }catch(err){ console.warn('[지출연결] 점검 실패', err); }
      console.table(out);
      var mine = out.filter(function(x){ return x.만든이.indexOf('자동')>=0; }).length;
      return out.length + '건 (자동 ' + mine + ' · 직접 ' + (out.length-mine) + ')';
    },
    now:  function(){ var r = ridNow(); return r ? (sync(r, false) || '만들 것이 없습니다') : '기록을 먼저 여세요'; },
    show: function(){
      var r = ridNow(), e = r ? linkedExp(r) : null;
      if(!e) return '이 업무에 연결된 지출 기록이 없습니다';
      console.table([e]); return e.id;
    },
    on:   function(){ setOn(1); return '업무에서 적으면 지출 기록이 함께 만들어집니다'; },
    off:  function(){ setOn(0); return '지출 기록을 따로 만들지 않습니다'; }
  };
  console.log('[지출연결] v119 준비됨 — 업무에서 적으면 지출 기록이 뒤에서 함께 만들어집니다');
})();


/* ============================================================
   ✋ 사람이 한 것이 먼저다 (wlUser)  v123-0830-0040

   ── 왜 만들었나 ────────────────────────────────────────
   2026-08-30 사고 : ＋하위 항목을 눌러 펼쳐도 0.4초 뒤 모드가 도로 접었다.
   단추가 아예 안 먹는 것처럼 보였다.
   원인은 「자동 규칙이 사람 손보다 셌던 것」이고, 이 구조가 남아 있으면
   접기·묶기·칸 감추기 어디서든 같은 사고가 또 난다.

   그래서 규칙을 코드 한 곳에 못박는다 :

       ▶ 사람이 직접 한 것은 기록해 둔다.
       ▶ 자동 규칙은 그 기록을 절대 못 이긴다.

   ── 무엇을 기억하나 ────────────────────────────────────
     sec:본문      아래 영역을 폈나 접었나
     grp:g1        묶음을 폈나 접었나
     fld:f:qty     칸을 숨겼나 보이게 했나
   종류(업무·지출·사고…)마다 따로 기억한다.
   지우기 : 진단 탭 「✋ 내가 정한 것 지우기」  또는  wlUser.clear()
   ============================================================ */
(function(){
  'use strict';

  var LS  = 'wl_userchoice';
  var MAX = 24;                      /* 종류 수 — 넉넉하다 */

  function all(){
    try{ var o = JSON.parse(localStorage.getItem(LS) || '{}'); return (o && typeof o==='object') ? o : {}; }
    catch(e){ console.warn('[사람먼저] 읽기 실패', e); return {}; }
  }
  function put(o){
    try{
      var ks = Object.keys(o);
      while(ks.length > MAX){ delete o[ks[0]]; ks = Object.keys(o); }
      localStorage.setItem(LS, JSON.stringify(o));
    }catch(e){ console.warn('[사람먼저] 저장 실패', e); }
  }

  /* 지금 보고 있는 기록의 종류 */
  function kindNow(){
    try{
      var m = String(location.hash||'').match(/^#lp=([^&]+)/);
      if(!m) return '';
      var id = decodeURIComponent(m[1]);
      var r = (entries||[]).filter(function(x){ return x && x.id === id; })[0];
      return r ? String(r.kind || '') : '';
    }catch(e){ return ''; }
  }

  var API = {
    /* 사람이 한 것을 적는다.  v : 1 = 폈다/보이게, 0 = 접었다/숨겼다, null = 잊어라 */
    set: function(what, key, v, kind){
      var k = kind || kindNow(); if(!k) return;
      var o = all(); var bag = o[k] || (o[k] = {});
      var id = what + ':' + key;
      if(v === null || v === undefined) delete bag[id];
      else bag[id] = v ? 1 : 0;
      put(o);
    },
    /* 사람이 정한 값. 정한 적 없으면 undefined */
    get: function(what, key, kind){
      var k = kind || kindNow(); if(!k) return undefined;
      var bag = all()[k]; if(!bag) return undefined;
      var v = bag[what + ':' + key];
      return (v === 1 || v === 0) ? v : undefined;
    },
    /* 자동 규칙이 부르는 문 — 사람이 정했으면 그 값, 아니면 자동값 */
    decide: function(what, key, autoValue, kind){
      var v = API.get(what, key, kind);
      return (v === undefined) ? autoValue : !!v;
    },
    clear: function(kind){
      var o = all();
      if(kind){ delete o[kind]; } else { o = {}; }
      put(o);
      try{ if(typeof window.wlAfterPaint === 'function') window.wlAfterPaint(); }catch(e){}
      return kind ? (kind + ' 에서 내가 정한 것을 지웠습니다') : '내가 정한 것을 모두 지웠습니다';
    },
    list: function(){
      var o = all(), rows = [];
      Object.keys(o).forEach(function(k){
        Object.keys(o[k]).forEach(function(id){
          var p = id.split(':');
          rows.push({ 종류:k, 무엇:({sec:'아래 영역', grp:'묶음', fld:'칸'})[p[0]] || p[0],
                      이름:p.slice(1).join(':'), 내가정한것: o[k][id] ? '폈다/보이게' : '접었다/숨겼다' });
        });
      });
      console.table(rows);
      return rows.length + '개';
    },
    kind: kindNow
  };
  window.wlUser = API;

  /* 진단 탭 — 지우기 */
  function panel(){
    var host = document.getElementById('sfPanel');
    if(!host || document.getElementById('uwBtn')) return;
    var row = host.querySelector('.btn-row'); if(!row) return;
    var b = document.createElement('button');
    b.id = 'uwBtn'; b.className = 'btn btn-ghost btn-sm'; b.style.minHeight = '44px';
    b.textContent = '✋ 내가 정한 것 지우기';
    b.title = '접어 둔 것 · 숨긴 칸을 처음 상태로 되돌립니다';
    b.addEventListener('click', function(){
      if(!confirm('접어 둔 것과 숨긴 칸을 처음 상태로 되돌릴까요?\n\n(기록 내용은 그대로입니다)')) return;
      API.clear();
      if(typeof toast === 'function') toast('✋ 처음 상태로 되돌렸어요');
    });
    row.appendChild(b);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 3000);

  console.log('[사람먼저] v123 준비됨 — 사람이 한 것을 자동 규칙이 못 이깁니다 (wlUser.list())');
})();


/* ============================================================
   👁 칸 하나만 숨기기 (wlEye)  v123-0830-0040

   달님 아이디어 : 「켜고 끄는 대신, 칸마다 👁 을 눌러 그 칸만 숨기게 하면 훨씬 안전」

   ▸ 속성 줄에 마우스를 올리면 이름표 오른쪽에 작은 👁 이 나타난다
   ▸ 누르면 그 칸이 이 종류에서 숨는다 — 「사람이 정한 것」으로 적히므로
     어떤 자동 규칙도 다시 띄우지 않는다
   ▸ 되돌리기 : 아래 「👁 내가 숨긴 칸 N개」 를 누른다
   ▸ 값이 들어 있는 칸을 숨기려 하면 한 번 물어본다 (데이터를 못 보게 되니까)
   ============================================================ */
(function(){
  'use strict';

  function U(){ return window.wlUser; }

  function labelOf(row){
    try{ return ((row.querySelector('.pg-pnm')||{}).textContent||'').trim().replace(/^\S+\s/,''); }
    catch(e){ return ''; }
  }
  function valOf(row){
    try{
      var ie = row.querySelector('.lf-ie');
      if(ie) return String(ie.value == null ? '' : ie.value).trim();
      var t = ((row.querySelector('.pg-pv')||{}).textContent||'').trim();
      return (t === '비어 있음' || t === '—') ? '' : t;
    }catch(e){ return ''; }
  }

  function paint(){
    var u = U(); if(!u) return;
    var page = document.querySelector('.lf-page'); if(!page) return;
    var props = page.querySelector('.pg-props'); if(!props) return;

    var hidden = [];
    [].forEach.call(props.querySelectorAll('[data-prow]'), function(row){
      var key = row.getAttribute('data-prow');
      if(!key || key === '_date') return;                 /* 날짜는 못 숨긴다 */

      /* 사람이 숨긴 칸이면 감춘다 — 자동 규칙보다 세다 */
      if(u.get('fld', key) === 0){
        if(row.style.display !== 'none'){ row.style.display = 'none'; }
        row._userHid = 1;
        hidden.push(labelOf(row) || key);
        return;
      }
      if(row._userHid){ row.style.display = ''; row._userHid = 0; }

      /* 👁 단추 — 이름표 안에 겹쳐 놓아 칸 너비를 건드리지 않는다 (v118 규칙) */
      var pk = row.querySelector('.pg-pk'); if(!pk) return;
      if(pk.querySelector('.pg-eye')) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pg-eye';
      b.textContent = '👁';
      b.title = '이 칸을 숨깁니다 (되돌릴 수 있어요)';
      b.addEventListener('click', function(ev){
        ev.stopPropagation(); ev.preventDefault();
        var nm = labelOf(row) || key;
        if(valOf(row) && !confirm('「' + nm + '」 에는 값이 들어 있습니다.\n\n숨기면 화면에서 안 보입니다. (내용은 지워지지 않습니다)\n숨길까요?')) return;
        u.set('fld', key, 0);
        if(typeof toast === 'function') toast('👁 ' + nm + ' 을(를) 숨겼어요 — 아래에서 되돌릴 수 있어요');
        try{ if(typeof window.wlAfterPaint === 'function') window.wlAfterPaint(); }catch(e){}
      });
      pk.appendChild(b);
    });

    /* 되돌리기 단추 */
    var foot = props.querySelector('.pg-foot');
    var old  = props.querySelector('#pgEyeBack');
    if(!hidden.length){ if(old) old.remove(); return; }
    if(!foot) return;
    if(!old){
      old = document.createElement('button');
      old.type = 'button'; old.id = 'pgEyeBack'; old.className = 'pg-addp';
      old.addEventListener('click', function(){
        var u2 = U(); if(!u2) return;
        var kind = u2.kind();
        var o = null;
        try{ o = JSON.parse(localStorage.getItem('wl_userchoice')||'{}')[kind] || {}; }catch(e){ o = {}; }
        Object.keys(o).forEach(function(id){ if(id.slice(0,4) === 'fld:') u2.set('fld', id.slice(4), null); });
        if(typeof toast === 'function') toast('👁 숨긴 칸을 모두 되살렸어요');
        try{ if(typeof window.wlAfterPaint === 'function') window.wlAfterPaint(); }catch(e){}
      });
      foot.appendChild(old);
    }
    old.textContent = '👁 내가 숨긴 칸 ' + hidden.length + '개 되살리기';
    old.title = hidden.join(' · ');
  }

  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:50, n:'칸 숨기기', f:paint });
  console.log('[칸 숨기기] v123 준비됨 — 속성 줄에 마우스를 올리면 👁 이 나옵니다');
})();


/* ============================================================
   📐 화면이 어긋나지 않았나 (wlLayoutCheck)  v123-0830-0040

   같은 종류의 사고가 세 번 났다 —
     · 단추를 값 칸 **옆**에 붙여 「후/불/청/구」로 쪼개짐 (2회)
     · 한 줄 통째로 쓰는 칸의 이름표만 20px 좁아 입력 상자가 어긋남 (1회)

   눈으로 보고 찾기엔 너무 미세하다. 그래서 자로 재는 도구를 만든다.
   쓰는 법 : 기록을 하나 열고 → 진단 탭 [📐 화면 점검] 또는 wlLayoutCheck()
   ============================================================ */
(function(){
  'use strict';

  function run(){
    var page = document.querySelector('.lf-page');
    if(!page){ var m0='기록을 하나 열고 다시 눌러주세요'; console.log(m0); return m0; }
    var props = page.querySelector('.pg-props');
    if(!props){ var m1='속성판을 못 찾았어요'; console.log(m1); return m1; }

    var bad = [];
    var L = [];
    function add(s){ L.push(s); }

    /* ① 이름표 폭이 다 같은가 */
    var widths = {}, rows = [].slice.call(props.querySelectorAll('.pg-prow'));
    rows.forEach(function(r){
      var pk = r.querySelector('.pg-pk'); if(!pk) return;
      var w = getComputedStyle(pk).flexBasis;
      (widths[w] = widths[w] || []).push(r.getAttribute('data-prow') || '(이름없음)');
    });
    var keys = Object.keys(widths);
    add('① 이름표 폭 : ' + keys.map(function(k){ return k + ' ' + widths[k].length + '칸'; }).join(' / '));
    if(keys.length > 1){
      bad.push('이름표 폭이 ' + keys.length + '가지 — 입력 상자가 어긋나 보입니다');
      keys.forEach(function(k){
        if(widths[k].length <= 3) add('     ⚠ ' + k + ' : ' + widths[k].join(', '));
      });
    }else add('     ✅ 모두 같습니다');

    /* ② 값 칸이 눌리지 않았나 — 속성 줄의 칸은 「이름표 + 값」 둘이어야 한다 */
    var squeezed = [];
    rows.forEach(function(r){
      if(r.classList.contains('pg-grow') || r.classList.contains('pg-sechd')) return;
      var kids = [].filter.call(r.children, function(c){ return getComputedStyle(c).display !== 'none'; });
      if(kids.length > 2) squeezed.push((r.getAttribute('data-prow')||'?') + '(' + kids.length + '칸)');
    });
    add('② 값 칸이 눌린 줄 : ' + (squeezed.length ? squeezed.join(', ') : '없음 ✅'));
    if(squeezed.length) bad.push('속성 줄에 칸이 더 붙어 값 상자가 눌렸습니다 — 덧붙임은 값 칸 **안쪽**에 넣어야 합니다');

    /* ③ 덧붙인 단추가 값 칸 안에 있나 */
    var outs = [];
    [].forEach.call(page.querySelectorAll('.pg-addon'), function(el){
      var host = el.parentNode;
      /* 올바른 자리 : 값 칸(.pg-pv) · 묶음 요약(.pg-gv) · 묶음 발치(.pg-gfoot) */
      if(!host || !(host.classList.contains('pg-pv') || host.classList.contains('pg-gv')
                    || host.classList.contains('pg-gfoot')))
        outs.push(el.id || el.className);
    });
    add('③ 덧붙임 : ' + page.querySelectorAll('.pg-addon').length + '개 · 자리 잘못 '
        + (outs.length ? outs.join(', ') : '없음 ✅'));
    if(outs.length) bad.push('덧붙인 단추가 값 칸 밖에 있습니다: ' + outs.join(', '));

    /* ④ 가로로 넘치지 않았나 */
    var over = [];
    rows.forEach(function(r){
      if(r.scrollWidth > r.clientWidth + 2) over.push(r.getAttribute('data-prow')||'?');
    });
    add('④ 가로로 넘친 줄 : ' + (over.length ? over.join(', ') : '없음 ✅'));
    if(over.length) bad.push('줄이 가로로 넘칩니다: ' + over.join(', '));

    /* ⑤ 글자가 세로로 쪼개졌나 — 값 상자가 지나치게 좁은 것 */
    var thin = [];
    rows.forEach(function(r){
      var pv = r.querySelector('.pg-pv'); if(!pv) return;
      var w = pv.getBoundingClientRect().width;
      if(w > 0 && w < 90) thin.push((r.getAttribute('data-prow')||'?') + ' ' + Math.round(w) + 'px');
    });
    add('⑤ 값 상자가 너무 좁은 줄 : ' + (thin.length ? thin.join(', ') : '없음 ✅'));
    if(thin.length) bad.push('값 상자가 90px 미만 — 글자가 세로로 쪼개질 수 있습니다: ' + thin.join(', '));

    var head = bad.length ? ('⚠ 어긋난 곳 ' + bad.length + '군데') : '✅ 화면이 반듯합니다';
    var txt  = '📐 화면 점검\n\n' + L.join('\n') + '\n\n' + head
             + (bad.length ? ('\n' + bad.map(function(x,i){ return (i+1)+'. '+x; }).join('\n')) : '');
    console.log('%c📐 화면 점검', 'color:#2563a8;font-size:14px;font-weight:800');
    console.log(txt);
    try{
      var box = document.getElementById('scResult');
      if(box){
        var pre = document.createElement('pre');
        pre.style.cssText = 'margin-top:10px;padding:11px 13px;border-radius:10px;background:#f7faff;'
          + 'border:1px solid #dbe6f4;font-size:12px;line-height:1.65;white-space:pre-wrap;'
          + 'font-family:ui-monospace,Menlo,Consolas,monospace;color:#3d5875';
        pre.textContent = txt;
        box.appendChild(pre);
      }
    }catch(e){}
    return head;
  }

  window.wlLayoutCheck = run;

  function panel(){
    var host = document.getElementById('sfPanel');
    if(!host || document.getElementById('lcBtn')) return;
    var row = host.querySelector('.btn-row'); if(!row) return;
    var b = document.createElement('button');
    b.id = 'lcBtn'; b.className = 'btn btn-ghost btn-sm'; b.style.minHeight = '44px';
    b.textContent = '📐 화면 점검';
    b.title = '이름표 폭 · 눌린 값 칸 · 덧붙임 자리 · 넘침을 자로 잽니다';
    b.addEventListener('click', function(){
      try{ var box=document.getElementById('scResult'); if(box) box.innerHTML=''; }catch(e){}
      var r = run();
      if(typeof toast === 'function') toast(String(r));
    });
    row.appendChild(b);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 3200);

  console.log('[화면 점검] v123 준비됨 — 진단 탭 [📐 화면 점검] 또는 wlLayoutCheck()');
})();


/* ============================================================
   ⌨ 고르는 칸 — 자주 쓰는 것은 단추, 나머지는 초성 검색 (wlPick)  v129-0830-0810

   달님 : 「대상년·대상월·해당층은 단추로 한 번에.
           분야는 자주 쓰는 5개만 단추, 나머지는 초성 검색」

   ⚠ v128 사고 (이번에 고친 것)
     검색창이 select 의 포커스를 빼앗아 blur 가 나고, 편집기가 그 자리에서
     닫혀 버려 「대상년도~분야」를 아예 고를 수 없었다.
     → 앱이 이미 갖고 있는 「지금 고르는 중」 표시(_dialOpen)를 켜 둔다.
       고르거나 그만둘 때만 끈다. 단추는 mousedown 으로 포커스를 안 옮긴다.

   어떤 칸을 어떻게 보여줄지는 아래 PLAN 한 곳만 고치면 된다.
   ============================================================ */
(function(){
  'use strict';

  var MIN_OPTS = 3;          /* 계획에 없는 칸은 고를 것이 이만큼 넘을 때만 검색창 */
  var TOP_N    = 5;          /* 「자주 쓰는 것」 몇 개를 단추로 */

  /* 칸별 보여주는 방법 ─────────────────────────────────
     chips : 'all'  전부 단추   |  'top'  자주 쓰는 것만 단추
     search: true   검색창도 함께
     lab   : 단추에 쓸 글자 (값은 그대로 저장된다)
     ──────────────────────────────────────────────── */
  var PLAN = {
    'f:refYear'   : { chips:'all', search:false, lab:function(v){ return v + '년'; } },
    'f:refMonth'  : { chips:'all', search:false, lab:function(v){ return v + '월'; } },
    'f:floor'     : { chips:'all', search:false },
    'f:field'     : { chips:'top', search:true,  cnt:'field' },
    'f:status'    : { chips:'all', search:false },   /* 완료 상태 */
    'f:expType'   : { chips:'all', search:false },   /* 지출종류 */
    'f:expSubType': { chips:'all', search:false },   /* 세금계산서·전표 구분 */
    'f:purpose'   : { chips:'all', search:false }    /* 용도 */
  };

  function cho(s){
    try{ if(typeof getChosung === 'function') return getChosung(String(s||'')); }catch(e){}
    return String(s||'');
  }
  function hit(opt, q){
    var o = String(opt||''), s = String(q||'').trim();
    if(!s) return true;
    if(o.toLowerCase().indexOf(s.toLowerCase()) >= 0) return true;
    try{ if(cho(o).indexOf(s) >= 0) return true; }catch(e){}
    return false;
  }
  function ES(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  /* 이 select 이 화면의 어느 칸인가 */
  function pidOf(sel){
    try{
      var h = sel.closest('[data-ppid]') || sel.closest('[data-pid]');
      if(!h) return '';
      return h.getAttribute('data-ppid') || h.getAttribute('data-pid') || '';
    }catch(e){ return ''; }
  }

  /* 실제로 많이 쓴 차례로 — 기록에서 세어 온다 */
  function topUsed(key, opts, n){
    var cnt = {};
    try{
      (entries||[]).forEach(function(e){
        var v = e && e[key]; if(v==null || v==='') return;
        v = String(v); cnt[v] = (cnt[v]||0) + 1;
      });
    }catch(e){ console.warn('[고르기] 자주 쓰는 것 세기 실패', e); }
    var out = Object.keys(cnt)
      .filter(function(v){ return opts.indexOf(v) >= 0; })
      .sort(function(a,b){ return cnt[b] - cnt[a]; })
      .slice(0, n);
    /* 기록이 적어 모자라면 목록 앞에서 채운다 */
    for(var i=0; i<opts.length && out.length<n; i++){
      if(out.indexOf(opts[i]) < 0) out.push(opts[i]);
    }
    return out;
  }

  function attach(sel){
    if(!sel || sel._ssBound) return;

    var opts = [].map.call(sel.options, function(o){ return o.value; })
                 .filter(function(v){ return v !== ''; });
    if(!opts.length) return;

    var pid  = pidOf(sel);
    var plan = PLAN[pid] || null;
    var useChips  = !!plan;
    var useSearch = plan ? (plan.search !== false) : (opts.length >= MIN_OPTS);
    if(!useChips && !useSearch) return;

    sel._ssBound = 1;

    /* ★ 무엇보다 먼저 — 이 칸은 「지금 고르는 중」이다.
          이걸 켜 두지 않으면 아래에서 select 를 숨기거나 검색창에 포커스를 주는
          순간 blur 가 나서 편집기가 통째로 닫힌다 (v128 사고의 원인). */
    sel._dialOpen = 1;

    var cur = String(sel.value == null ? '' : sel.value);

    var box = document.createElement('div');
    box.className = 'qp-wrap';

    /* ── 단추판 ── */
    var chipVals = [];
    if(useChips){
      chipVals = (plan.chips === 'top')
        ? topUsed(plan.cnt || pid.slice(2), opts, TOP_N)
        : opts.slice();
      var lab = plan.lab || function(v){ return v; };
      var grid = document.createElement('div');
      grid.className = 'qp-grid';
      grid.innerHTML = chipVals.map(function(v){
        return '<button type="button" class="qp-it' + (v === cur ? ' on' : '') + '" '
             + 'data-qpv="' + ES(v) + '">' + ES(lab(v)) + '</button>';
      }).join('')
      + '<button type="button" class="qp-it qp-clr" data-qpv="">비우기</button>';
      box.appendChild(grid);
    }

    /* ── 검색창 + 목록 ── */
    var q = null, list = null, ime = false;
    if(useSearch){
      var sw = document.createElement('div');
      sw.className = 'ss-wrap';
      sw.innerHTML =
          '<input type="text" class="ss-q" autocomplete="off" '
        + 'placeholder="' + (useChips ? '다른 것 찾기' : '검색')
        + ' (초성 가능 · 예: ㅈㄱ → 전기)">'
        + '<div class="ss-list"></div>';
      box.appendChild(sw);
      q    = sw.querySelector('.ss-q');
      list = sw.querySelector('.ss-list');
    }

    if(sel.parentNode) sel.parentNode.insertBefore(box, sel);
    /* 단추가 전부를 덮는 칸은 원래 목록을 감춘다 — 화면이 좁아지지 않게 */
    if(useChips && plan.chips === 'all') sel.classList.add('qp-hide');
    if(useChips && plan.chips === 'top' && useSearch) sel.classList.add('qp-hide');

    function draw(){
      if(!list) return;
      var s = q.value;
      var pool = (useChips && !s)
        ? opts.filter(function(o){ return chipVals.indexOf(o) < 0; })   /* 단추로 이미 나온 건 빼고 */
        : opts;
      var found = pool.filter(function(o){ return hit(o, s); });
      if(!found.length){
        list.innerHTML = '<div class="ss-none">찾는 것이 없어요</div>';
        return;
      }
      list.innerHTML = found.slice(0, 60).map(function(o, i){
        return '<button type="button" class="ss-it' + (i===0 && s ? ' on' : '')
             + '" data-qpv="' + ES(o) + '">' + ES(o) + '</button>';
      }).join('');
    }

    var closed = false;
    function offGuard(){
      try{ document.removeEventListener('mousedown', outside, true); }catch(e){}
    }
    /* 고르기 — 값을 넣고 「고르는 중」을 끈 뒤 앱의 저장을 그대로 부른다 */
    function pick(v){
      if(closed) return; closed = true;
      offGuard();
      try{
        sel.value = v;
        sel._dialOpen = 0;
        sel.dispatchEvent(new Event('input',  {bubbles:true}));
        sel.dispatchEvent(new Event('change', {bubbles:true}));   /* → 앱이 저장하고 칸을 닫는다 */
      }catch(e){
        console.warn('[고르기] 넣기 실패 — 예전 방식으로', e);
        try{ sel._dialOpen = 0; if(typeof sel._dialDone === 'function') sel._dialDone(); }catch(e2){}
      }
    }
    /* 그만두기 — 아무것도 바꾸지 않고 칸만 닫는다 */
    function giveUp(){
      if(closed) return; closed = true;
      offGuard();
      sel._dialOpen = 0;
      try{ if(typeof sel._dialDone === 'function') sel._dialDone(); else { sel.focus(); sel.blur(); } }
      catch(e){ console.warn('[고르기] 닫기 실패', e); }
    }

    /* 단추·목록은 mousedown 으로 — click 이면 blur 가 먼저 나 창이 닫힌다 */
    box.addEventListener('mousedown', function(ev){
      var b = ev.target.closest && ev.target.closest('[data-qpv]');
      if(!b) return;
      ev.preventDefault(); ev.stopPropagation();
      pick(b.getAttribute('data-qpv'));
    });

    if(q){
      q.addEventListener('compositionstart', function(){ ime = true; });
      q.addEventListener('compositionend',   function(){ ime = false; draw(); });
      q.addEventListener('input', function(){ if(!ime) draw(); });   /* 검색창은 그대로 두고 목록만 다시 그린다 */
      q.addEventListener('keydown', function(ev){
        if(ev.key === 'Enter'){
          ev.preventDefault();
          var f = list && list.querySelector('[data-qpv]');
          if(f) pick(f.getAttribute('data-qpv'));
        }else if(ev.key === 'Escape'){ ev.preventDefault(); giveUp(); }
      });
      draw();
    }

    /* 딴 데를 누르면 조용히 닫는다 (칸이 열린 채 남지 않게) */
    function outside(ev){
      try{
        if(box.contains(ev.target) || ev.target === sel) return;
        giveUp();
      }catch(e){}
    }
    setTimeout(function(){
      try{ document.addEventListener('mousedown', outside, true); }catch(e){}
    }, 0);
  }

  /* 고르는 칸이 어떤 길로 열리든 붙게 — 화면에 select 가 나타나면 바로 잡는다 */
  try{
    var mo = new MutationObserver(function(m){
      for(var i=0;i<m.length;i++){
        var add = m[i].addedNodes; if(!add) continue;
        for(var j=0;j<add.length;j++){
          var n = add[j];
          if(!n || n.nodeType !== 1) continue;
          if(n.tagName === 'SELECT' && n.classList && n.classList.contains('lf-ie')) attach(n);
          else if(n.querySelectorAll){
            [].forEach.call(n.querySelectorAll('select.lf-ie'), attach);
          }
        }
      }
    });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }catch(e){ console.warn('[고르기] 감시 시작 실패', e); }

  document.addEventListener('focusin', function(ev){
    var t = ev.target;
    if(t && t.tagName === 'SELECT' && t.classList && t.classList.contains('lf-ie')) attach(t);
  }, true);
  document.addEventListener('click', function(ev){
    try{
      var host = ev.target.closest && ev.target.closest('[data-ppid],[data-pid]');
      if(!host) return;
      setTimeout(function(){
        var s = host.querySelector('select.lf-ie');
        if(s) attach(s);
      }, 60);
    }catch(e){}
  }, true);

  window.wlPick = {
    min:  function(n){ if(typeof n === 'number') MIN_OPTS = n; return '고를 것이 ' + MIN_OPTS + '개 넘으면 검색창'; },
    top:  function(n){ if(typeof n === 'number') TOP_N = n;    return '자주 쓰는 것 ' + TOP_N + '개를 단추로'; },
    plan: function(){ return PLAN; }
  };
  window.wlSelSearch = window.wlPick;   /* 예전 이름도 그대로 */
  console.log('[고르기] v129 준비됨 — 대상년·월·층은 단추, 분야는 자주 쓰는 ' + TOP_N + '개 단추 + 초성 검색');
})();


/* ============================================================
   🔗 탭 하나로 · 링크 보내기 (wlOneTab)  v130-0830-0830

   달님 : 「(가)로 해줘 — 위 줄 탭을 누르면 데이터 탭으로 가게.
           그리고 카톡 링크로 보내기도 만들어줘」

   ① 위 줄의 지출·메모·사고·진행업무·자재 탭을 누르면
      데이터 탭의 같은 종류로 바로 간다 → 같은 기록이 두 화면으로
      보이던 헷갈림이 없어진다.
      ⚠ 되돌리기 : 진단 탭 「🗂 탭 하나로」 에서 언제든 끈다.
   ② 기록 페이지 위쪽 [🔗 링크] — 그 기록 하나로 바로 열리는 주소를
      만들어 카톡·문자로 보낸다. 폰에서는 공유창(카톡 포함)이 뜨고,
      컴퓨터에서는 주소가 복사된다.
      ※ 새 열쇠(API 키)를 코드에 넣지 않는다 — 브라우저가 이미 가진
        공유 기능(navigator.share)만 쓴다.
   ============================================================ */
(function(){
  'use strict';

  /* ─────────────── ① 탭 하나로 ─────────────── */
  var LS = 'wl_tab_one';
  /* 위 줄 탭 → 데이터 탭의 어느 종류로 보낼까 */
  var MAP = {
    expense : 'expense',
    memo    : 'memo',
    accident: 'accident',
    progress: 'progress',
    material: 'item'
  };
  var NAME = { expense:'지출', memo:'메모', accident:'사고', progress:'진행업무', material:'자재' };

  function isOn(){
    try{ return localStorage.getItem(LS) !== '0'; }catch(e){ return true; }   /* 기본 켬 */
  }
  function setOn(v){
    try{ localStorage.setItem(LS, v ? '1' : '0'); }catch(e){}
    paint();
    if(typeof toast === 'function') toast(v
      ? '🗂 지출·메모·사고·진행업무·자재 탭이 데이터 탭으로 모입니다'
      : '🗂 탭이 예전처럼 따로 열립니다');
  }

  /* 탭 누름을 가로챈다 — 원래 손잡이(핸들러)보다 먼저 잡아야 하므로 캡처 단계 */
  document.addEventListener('click', function(ev){
    try{
      if(!isOn()) return;
      var b = ev.target.closest && ev.target.closest('.v43-tab[data-v43tab]');
      if(!b) return;
      var t = b.getAttribute('data-v43tab');
      var kind = MAP[t];
      if(!kind) return;
      if(typeof window.wlOpenData !== 'function') return;   /* 없으면 예전대로 */
      ev.preventDefault(); ev.stopPropagation();
      window.wlOpenData(kind);
    }catch(e){ console.warn('[탭 하나로] 넘기기 실패 — 예전대로', e); }
  }, true);

  /* 진단 탭에 켜고 끄는 자리를 만든다 (HTML 은 건드리지 않는다) */
  function panel(){
    var anchor = document.getElementById('nsNow');
    if(!anchor) return;
    var host = anchor.parentNode && anchor.parentNode.parentNode;
    if(!host || document.getElementById('tabOneRow')) return;

    var h = document.createElement('div');
    h.className = 'sec-head'; h.textContent = '🗂 탭 하나로';
    var d = document.createElement('div');
    d.style.cssText = 'font-size:12.5px;color:#7a92a8;margin-bottom:6px';
    d.textContent = '켜면 위쪽의 ' + Object.keys(MAP).map(function(k){ return NAME[k]; }).join(' · ')
                  + ' 탭을 눌렀을 때 데이터 탭의 같은 종류로 갑니다. '
                  + '같은 기록이 두 가지 화면으로 보이는 헷갈림이 없어집니다.';
    var row = document.createElement('div');
    row.className = 'btn-row'; row.id = 'tabOneRow'; row.style.marginTop = '0';
    row.innerHTML = '<button class="btn btn-sm" id="tabOneOn"  style="min-height:44px">🗂 데이터 탭으로 모으기</button>'
                  + '<button class="btn btn-sm" id="tabOneOff" style="min-height:44px">🗒 예전처럼 따로</button>'
                  + '<span id="tabOneNow" style="font-size:12.5px;color:#7a92a8;align-self:center;margin-left:6px"></span>';

    var after = anchor.parentNode;              /* ＋ 새로 만들 때 줄 바로 다음에 */
    host.insertBefore(h,   after.nextSibling);
    host.insertBefore(d,   h.nextSibling);
    host.insertBefore(row, d.nextSibling);

    document.getElementById('tabOneOn').addEventListener('click',  function(){ setOn(true);  });
    document.getElementById('tabOneOff').addEventListener('click', function(){ setOn(false); });
    paint();
  }
  function paint(){
    var on = isOn();
    var a = document.getElementById('tabOneOn'), b2 = document.getElementById('tabOneOff');
    if(a)  a.className  = 'btn btn-sm ' + (on  ? 'btn-primary' : 'btn-ghost');
    if(b2) b2.className = 'btn btn-sm ' + (!on ? 'btn-primary' : 'btn-ghost');
    var n = document.getElementById('tabOneNow');
    if(n) n.textContent = '지금: ' + (on ? '데이터 탭으로 모읍니다' : '탭마다 따로 열립니다');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 1600);
  setTimeout(panel, 4000);

  /* ─────────────── ② 링크 보내기 ─────────────── */

  function curId(){
    try{
      var m = String(location.hash || '').match(/^#lp=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    }catch(e){ return ''; }
  }
  function curTitle(){
    try{
      var t = document.getElementById('pgTitle');
      var s = t ? String(t.value || '').trim() : '';
      return s || '업무일지 기록';
    }catch(e){ return '업무일지 기록'; }
  }
  function linkOf(){
    var id = curId(); if(!id) return '';
    try{
      /* 파일을 직접 열어 본 경우(file://)엔 남에게 보낼 수 없다 */
      if(location.protocol === 'file:') return '';
      return location.origin + location.pathname + (location.hash || ('#lp=' + id));
    }catch(e){ return ''; }
  }

  function copy(text){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        return navigator.clipboard.writeText(text);
      }
    }catch(e){ console.warn('[링크] 새 방식 복사 실패 — 예전 방식으로', e); }
    return new Promise(function(ok, no){
      try{
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta); ta.select();
        var done = document.execCommand('copy');
        document.body.removeChild(ta);
        done ? ok() : no(new Error('복사가 막혀 있어요'));
      }catch(e){ no(e); }
    });
  }

  function share(){
    var url = linkOf();
    if(!url){
      alert('이 화면에서는 링크를 만들 수 없어요.\n\n인터넷 주소(github.io)로 연 다음\n기록 하나를 열고 다시 눌러 주세요.');
      return;
    }
    var title = curTitle();
    var text  = '📋 ' + title;
    /* 폰 — 공유창이 뜨고 거기에 카톡이 있다 */
    try{
      if(navigator.share){
        navigator.share({ title:title, text:text, url:url })
          .catch(function(e){
            if(e && e.name === 'AbortError') return;    /* 사용자가 그만둠 — 조용히 */
            console.warn('[링크] 공유 실패 — 복사로', e);
            copy(url).then(function(){ if(typeof toast==='function') toast('🔗 주소를 복사했어요'); })
                     .catch(function(){ prompt('아래 주소를 복사해서 보내세요', url); });
          });
        return;
      }
    }catch(e){ console.warn('[링크] 공유 기능 없음 — 복사로', e); }
    /* 컴퓨터 — 복사해 준다 */
    copy(text + '\n' + url)
      .then(function(){ if(typeof toast==='function') toast('🔗 카톡에 붙여넣을 주소를 복사했어요'); })
      .catch(function(){ prompt('아래 주소를 복사해서 카톡에 붙여넣으세요', url); });
  }

  /* 페이지 위쪽 단추줄에 [🔗 링크] 를 넣는다 — 페이지가 다시 그려져도 붙는다 */
  function addBtn(){
    try{
      var top = document.querySelector('.lf-page .pg-top');
      if(!top || top.querySelector('#pgShare')) return;
      if(!curId()) return;
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'pgShare';
      b.title = '이 기록으로 바로 열리는 주소를 만들어 카톡·문자로 보냅니다';
      b.textContent = '🔗 링크';
      b.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); share(); });
      var del = top.querySelector('#pgDel');
      if(del) top.insertBefore(b, del); else top.appendChild(b);
    }catch(e){ console.warn('[링크] 단추 붙이기 실패', e); }
  }
  try{
    var mo = new MutationObserver(function(){ addBtn(); });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }catch(e){ console.warn('[링크] 감시 실패', e); }
  setInterval(addBtn, 1200);

  window.wlOneTab = {
    on:   function(){ setOn(true);  return '데이터 탭으로 모읍니다'; },
    off:  function(){ setOn(false); return '탭마다 따로 열립니다'; },
    link: function(){ return linkOf() || '(기록을 연 다음, 인터넷 주소로 열었을 때만 만들 수 있어요)'; }
  };
  console.log('[탭 하나로] v130 준비됨 — ' + (isOn()?'켜짐':'꺼짐') + ' / 페이지에 [🔗 링크] 단추');
})();


/* ============================================================
   📦 자재 담기 · 🔗 관련 업무 (wlMatBox)  v131-0830-0910

   달님 :
     「자재 넣는게 처음엔 정상인데 한줄 내역이 안나와.
       자재 추가시 한줄 정리가 시간 쪽으로 입력이 돼.
       업체 입력 하는것처럼 해주고 맨 마지막에 +버튼 넣어서 추가 추가.
       지출쪽 모달에 관련업무 열기로 해야 이게 정상이야」

   ① 「📦 자재 — 무엇을 썼나」 묶음 발치에 담긴 자재를 한 줄씩 보여준다.
      · 줄마다 ✕ 로 빼기 · 합계는 저절로 합계 칸에 들어간다
      · 맨 끝 [＋ 자재 추가] → 업체 고르듯 고르기 창 → 목록에 이어 붙인다
   ② 화면 아래 큰 「자재 사용 내역」 상자는 접어 둔다 (같은 일을 두 곳에서
      하면 어느 쪽이 진짜인지 헷갈린다).  되살리기 : wlMatBox.old()
   ③ 지출 기록에는 [🔗 관련 업무 열기] — 업무↔지출을 오갈 수 있게.
   ============================================================ */
(function(){
  'use strict';

  var HIDE_OLD = 'wl_matbox_old';     /* '1' 이면 아래 큰 상자를 그대로 둔다 */

  function ES(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function won(n2){ n2 = Number(n2)||0; return n2 ? n2.toLocaleString('ko-KR') : ''; }
  function ridNow(){
    try{ var m = String(location.hash||'').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function recOf(id){
    try{ return (entries||[]).filter(function(x){ return x && x.id === id; })[0] || null; }
    catch(e){ return null; }
  }
  function matsOf(r){ return (r && Array.isArray(r.materials)) ? r.materials.filter(Boolean) : []; }
  /* v132 — 자재명 칸에 직접 적은 것 + 담은 자재 목록 = 화면에 보여줄 전부 */
  function matsAll(r){
    var out = [];
    var nm = String((r && r.material) == null ? '' : r.material).trim();
    if(nm) out.push({ name:nm, spec:String((r && r.spec)||''), qty:Number(r && r.qty)||1, price:0, _field:1 });
    matsOf(r).forEach(function(m){ out.push(m); });
    return out;
  }
  function sumOf(arr){
    return arr.reduce(function(a,m){
      if(m && m._field) return a;                   /* 칸에 적은 것은 단가가 없다 */
      return a + (Number(m.price)||0) * (Number(m.qty)||1);
    }, 0);
  }
  function keepOld(){ try{ return localStorage.getItem(HIDE_OLD) === '1'; }catch(e){ return false; } }

  /* 목록을 통째로 저장한다 — 합계도 함께 (금액 칸을 사람이 잠갔으면 건드리지 않는다) */
  function save(rid, arr){
    try{
      var patch = { materials: arr };
      /* v135 — 달님 : 「금액쪽 합계는 비용의 합계, 자재쪽 합계는 자재쪽 칸에」
            예전에는 자재 값이 비용의 「합계」(cost) 를 덮어썼다.
            외주비를 적어 둔 기록에 자재를 담으면 그 금액이 통째로 날아갔다. */
      patch.matCost = sumOf(arr);
      if(typeof updateRecord === 'function') updateRecord(rid, patch);
      try{ if(typeof window.wlSumNow === 'function') window.wlSumNow(); }catch(e){}
      setTimeout(function(){
        try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid); }catch(e){}
      }, 140);
    }catch(e){
      console.error('[자재 담기] 저장 실패', e);
      if(typeof toast === 'function') toast('자재를 못 저장했어요: ' + (e.message || e));
    }
  }

  /* ＋ 자재 추가 — 업체 고르듯 창을 열고, 고른 것을 목록에 「이어 붙인다」 */
  function addOne(){
    var rid = ridNow(); if(!rid) return;
    var rec = recOf(rid); if(!rec) return;
    var cur = matsOf(rec);

    /* 여러 개를 한 번에 고르는 창이 있으면 그걸 쓴다 (이미 담긴 것을 넘겨 이어 담기) */
    if(typeof window.wlPickMats === 'function'){
      window.wlPickMats(function(list){
        var arr = Array.isArray(list) ? list : [];
        save(rid, arr);
        if(typeof toast === 'function') toast(arr.length ? ('📦 자재 ' + arr.length + '종') : '자재를 모두 비웠어요');
      }, cur.slice());
      return;
    }
    /* 하나씩 고르는 창밖에 없으면 그걸로 이어 붙인다 */
    if(typeof window.wlPickItem === 'function'){
      window.wlPickItem(function(r){
        if(!r) return;
        var arr = cur.slice();
        arr.push({ name:(r.name||''), spec:(r.spec||''), unit:(r.unit||''),
                   qty:Number(r.qty)||1, price:Number(r.price)||0 });
        save(rid, arr);
      }, '');
      return;
    }
    if(typeof toast === 'function') toast('자재 고르기를 못 불러왔어요 — worklog.js 를 올렸는지 확인해 주세요');
  }

  function drop(i){
    var rid = ridNow(); if(!rid) return;
    var rec = recOf(rid); if(!rec) return;
    var all = matsAll(rec);
    if(i < 0 || i >= all.length) return;
    /* v132 — 첫 줄이 「자재명 칸에 적은 것」이면 배열이 아니라 칸을 비운다 */
    if(all[i] && all[i]._field){
      try{
        if(typeof updateRecord === 'function') updateRecord(rid, { material:'', spec:'', qty:'' });
        setTimeout(function(){
          try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid); }catch(e){}
        }, 140);
      }catch(e){ console.error('[자재 담기] 칸 비우기 실패', e); }
      return;
    }
    var arr = matsOf(rec).slice();
    var j = i - (all.length - arr.length);          /* 칸 줄을 뺀 실제 자리 */
    if(j < 0 || j >= arr.length) return;
    arr.splice(j, 1);
    save(rid, arr);
  }

  /* ── 자재 묶음 발치에 목록과 ＋ 단추 ── */
  function paintMats(){
    var rid = ridNow();
    var rec = rid ? recOf(rid) : null;
    var page = document.querySelector('.lf-page');
    if(!page || !rec){ window.wlAddOn(['#__none'], 'matbox', function(){ return null; }); return; }

    var mats = matsAll(rec);

    /* v135 — 담긴 자재가 있으면 「자재 합계」 칸을 실제 합계로 맞춰 둔다.
          값이 이미 같으면 아무것도 하지 않으므로 되풀이되지 않는다. */
    try{
      var real = sumOf(mats);
      if(real > 0 && Number(rec.matCost || 0) !== real && typeof updateRecord === 'function'){
        updateRecord(rid, { matCost: real });
      }
      /* 저장은 됐어도 화면은 아직 옛 값이다 — 고치는 중이 아닐 때만 표시를 맞춘다 */
      if(real > 0){
        var cell = document.querySelector('.lf-page [data-ppid="f:matCost"]');
        if(cell && !cell.querySelector('.lf-ie')){
          var t = String(cell.textContent || '').replace(/\s/g, '');
          if(!t || t === '—' || t === '비어있음') cell.textContent = won(real) + '원';
        }
      }
    }catch(e){ console.warn('[자재 합계] 맞추기 실패', e); }

    /* v140 — 담긴 자재 목록도 화면에서 내린다 (본문 자동 정리로 충분).
          담고 빼는 일은 [＋ 자재 추가] 창에서 한다. */
    window.wlAddOn(['#__none'], 'matbox', function(){ return null; });
    if(false) window.wlAddOn(['[data-gfoot="gt"]'], 'matbox_old',
      function(){ var d = document.createElement('div'); d.className = 'pg-matbox'; return d; },
      function(d){
        var h = '';
        if(mats.length){
          h += '<div class="mb-list">' + mats.map(function(m, i){
            var bits = [ES(m.name||''), ES(m.spec||'')].filter(Boolean).join(' <span class="mb-sp">·</span> ');
            var q = Number(m.qty)||1, pr = (Number(m.price)||0) * q;
            return '<div class="mb-it' + (m._field ? ' mb-fld' : '') + '">'
                 + '<span class="mb-n">' + (i+1) + '</span>'
                 + '<span class="mb-t">' + bits + '</span>'
                 + (m._field ? '<span class="mb-tag">칸에 적음</span>' : '')
                 + '<span class="mb-q">' + q + '개</span>'
                 + (pr ? '<span class="mb-p">' + won(pr) + '원</span>' : '')
                 + '<button type="button" class="mb-x" data-mbx="' + i + '" title="빼기">✕</button>'
                 + '</div>';
          }).join('') + '</div>';
          var s = sumOf(mats);
          if(s > 0) h += '<div class="mb-sum">자재 합계 <b>' + won(s) + '원</b>'
                       + ' <span>「자재 합계」 칸에 저절로 들어갑니다 · 비용의 합계와는 따로입니다</span></div>';
        }
        if(d.innerHTML !== h) d.innerHTML = h;

        var ab = d.querySelector('.mb-add');
        if(ab && !ab._b){ ab._b = 1; ab.addEventListener('click', function(ev){
          ev.preventDefault(); ev.stopPropagation(); addOne(); }); }
        if(!d._bx){
          d._bx = 1;
          d.addEventListener('click', function(ev){
            var x = ev.target.closest && ev.target.closest('[data-mbx]');
            if(!x) return;
            ev.preventDefault(); ev.stopPropagation();
            drop(Number(x.getAttribute('data-mbx')));
          });
        }
      });

    /* v140 — 달님 : 「자재 추가 버튼을 수량 오른쪽으로 보내. 그럼 균형이 조금 더 맞을듯」
          단추가 발치에 있으면 한 줄을 통째로 잡아먹는다. 수량 칸 옆이면 자리를 안 쓴다. */
    window.wlAddOn(['[data-prow="f:qty"] .pg-pv', '[data-prow="f:material"] .pg-pv'], 'matadd2',
      function(){
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'mb-add mb-add-s';
        b.textContent = '＋ 자재 추가';
        b.title = '저장된 자재에서 골라 담습니다';
        b.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); addOne(); });
        return b;
      });

    /* 화면 아래 큰 「자재 사용 내역」 상자는 접어 둔다 — 같은 일을 두 곳에서 하지 않게 */
    try{
      var old = page.querySelector('#pgMatPick');
      var sec = old && old.closest ? old.closest('.pg-secbox, .pg-sec-wrap, div') : null;
      [].forEach.call(page.querySelectorAll('.pg-sec'), function(t){
        if(String(t.textContent||'').indexOf('자재 사용 내역') < 0) return;
        var on = keepOld();
        t.style.display = on ? '' : 'none';
        var n2 = t.nextElementSibling, guard = 0;
        while(n2 && guard++ < 6){
          if(n2.classList && n2.classList.contains('pg-sec')) break;
          n2.style.display = on ? '' : 'none';
          n2 = n2.nextElementSibling;
        }
      });
    }catch(e){ console.warn('[자재 담기] 아래 상자 접기 실패', e); }
  }

  /* ── 지출 기록에 [🔗 관련 업무 열기] ── */
  function paintWorkLink(){
    var rid = ridNow();
    var rec = rid ? recOf(rid) : null;
    if(!rec || rec.kind !== 'expense' || !rec.workId){
      window.wlAddOn(['#__none'], 'worklink', function(){ return null; });
      return;
    }
    var w = recOf(rec.workId);
    window.wlAddOn(['[data-gfoot="g0"]', '[data-prow="_date"] .pg-pv'], 'worklink',
      function(){ var d = document.createElement('div'); d.className = 'pg-worklink'; return d; },
      function(d){
        var t = w ? ((w.date||'') + ' ' + (w.title||'(제목없음)')).trim().slice(0, 26) : '(업무를 못 찾음)';
        var h = '<span class="wl-lb">🔗 이 지출은 업무 기록에서 만들어졌습니다</span>'
              + '<button type="button" class="wl-go"' + (w?'':' disabled') + '>' + ES(t) + ' 열기</button>';
        if(d.innerHTML !== h) d.innerHTML = h;
        var b = d.querySelector('.wl-go');
        if(b && !b._b){
          b._b = 1;
          b.addEventListener('click', function(ev){
            ev.preventDefault(); ev.stopPropagation();
            try{ if(w && typeof window.wlGoPage === 'function') window.wlGoPage(w.id); }
            catch(e){ console.warn('[관련 업무] 열기 실패', e); }
          });
        }
      });
  }

  function run(){ paintMats(); paintWorkLink(); }

  /* 그리는 차례에 끼워 넣는다 — 각자 파수꾼을 돌리면 서로 지운다 (v118 규칙) */
  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:46, n:'자재 담기·관련 업무', f:run });

  window.wlMatBox = {
    old:  function(v){ try{ localStorage.setItem(HIDE_OLD, (v===false)?'0':'1'); }catch(e){}
                       if(typeof window.wlAfterPaint==='function') window.wlAfterPaint();
                       return keepOld() ? '아래 큰 자재 상자를 다시 보여줍니다' : '아래 큰 자재 상자를 접습니다'; },
    add:  addOne,
    list: function(){ var r = recOf(ridNow()); return r ? matsOf(r) : []; }
  };
  console.log('[자재 담기] v131 준비됨 — 자재 묶음 발치에 목록과 ＋ 추가 / 지출에 🔗 관련 업무');
})();


/* ============================================================
   ▸ 아래 영역 접었다 펴기 (wlFold)  v132-0830-0930

   달님 : 「하위목록과 파일 폴더 목록은 클릭 했을 때 펼쳐지게 해」

   「🧷 하위 항목」·「📎 파일 · 폴더 링크」는 내용이 있어도 화면만 길어질 뿐
   늘 보고 있을 것은 아니다. 제목 줄만 남기고 접어 두었다가 누르면 편다.

   ⚠ wlSecs 는 style.display 로 영역을 감춘다. 여기서 같은 style 을 만지면
     서로 지우게 되므로, 이쪽은 **클래스**로만 접는다 (CSS 가 이긴다).
     wlSecs 가 아예 감춘 영역(내용 없음)은 건드리지 않는다.
   되돌리기 : wlFold.off()
   ============================================================ */
(function(){
  'use strict';

  var LS = 'wl_fold_on';
  /* 접을 영역 — 제목 글자로 알아본다 */
  var DEFS = [
    { key:'sub', re:/하위\s*항목/,        icon:'🧷', cnt:'.pg-subrow, .pg-sub li, [data-subid]' },
    { key:'att', re:/파일\s*[·ㆍ]\s*폴더/, icon:'📎', cnt:'.pg-attrow, [data-attdel]' }
  ];

  function isOn(){ try{ return localStorage.getItem(LS) !== '0'; }catch(e){ return true; } }
  function setOn(v){ try{ localStorage.setItem(LS, v?'1':'0'); }catch(e){} }

  /* 사람이 편 것은 종류별로 기억한다 (wlUser 규칙) */
  function opened(key){
    try{ if(window.wlUser) return window.wlUser.get('fold', key); }catch(e){}
    return undefined;
  }
  function markOpen(key, v){
    try{ if(window.wlUser) window.wlUser.set('fold', key, v ? 1 : 0); }catch(e){}
  }

  /* 제목 다음부터 다음 제목 전까지가 그 영역이다 */
  function blockOf(head){
    var out = [], n = head.nextElementSibling, guard = 0;
    while(n && guard++ < 12){
      if(n.classList && n.classList.contains('pg-sec')) break;
      out.push(n);
      n = n.nextElementSibling;
    }
    return out;
  }
  function count(list, sel){
    var n = 0;
    list.forEach(function(el){
      try{ if(el.querySelectorAll) n += el.querySelectorAll(sel).length; }catch(e){}
    });
    return n;
  }

  /* v133 — 달님 : 「하위목록과 파일 폴더 링크는 2열로 나오게 해 공간 활용」
        두 영역이 나란히 붙어 있으면 한 상자에 담아 좌·우로 나눈다.
        ⚠ 이미 담아 둔 상자가 있으면 그대로 쓴다 (다시 그릴 때마다 겹겹이 싸지 않게).
        좁은 화면에서는 CSS 가 알아서 1열로 돌린다. */
  function twoCol(page){
    try{
      var heads = [].filter.call(page.querySelectorAll('.pg-sec'), function(h){
        if(h.style && h.style.display === 'none') return false;
        return /하위\s*항목|파일\s*[·ㆍ]\s*폴더/.test(h.textContent || '');
      });
      /* v134 — 페이지가 이미 좌·우로 나뉘어 있으면 오른쪽 칸을 또 반으로 쪼개지 않는다.
            그러면 하위 항목·파일 링크가 너무 좁아진다. */
      if(typeof window.wlIsTwoCol === 'function' && window.wlIsTwoCol()){
        var w0 = page.querySelector('.pg-fold2');
        if(w0 && w0.children.length){
          while(w0.firstChild) w0.parentNode.insertBefore(w0.firstChild, w0);
          w0.remove();
        }
        return;
      }
      if(heads.length < 2){                       /* 한쪽만 있으면 나눌 것이 없다 */
        var solo = page.querySelector('.pg-fold2');
        if(solo && solo.children.length){
          while(solo.firstChild) solo.parentNode.insertBefore(solo.firstChild, solo);
          solo.remove();
        }
        return;
      }
      var a = heads[0], b2 = heads[1];
      /* 이미 같은 상자 안에 좌·우로 들어가 있으면 손대지 않는다 */
      var ca = a.closest('.pg-fold2c'), cb = b2.closest('.pg-fold2c');
      if(ca && cb && ca !== cb && ca.parentNode === cb.parentNode
         && ca.parentNode.classList.contains('pg-fold2')) return;

      var wrap = document.createElement('div');
      wrap.className = 'pg-fold2';
      a.parentNode.insertBefore(wrap, a);

      function cell(head){
        var c = document.createElement('div');
        c.className = 'pg-fold2c';
        var list = [head].concat(blockOf(head));
        wrap.appendChild(c);
        list.forEach(function(el){ c.appendChild(el); });
        return c;
      }
      cell(a); cell(b2);
    }catch(e){ console.warn('[영역 접기] 2열로 나누기 실패', e); }
  }

  function run(){
    var page = document.querySelector('.lf-page');
    if(!page) return;

    if(isOn()) twoCol(page);

    [].forEach.call(page.querySelectorAll('.pg-sec'), function(h){
      var txt = (h.textContent || '').trim();
      var def = null;
      for(var i = 0; i < DEFS.length; i++){ if(DEFS[i].re.test(txt)){ def = DEFS[i]; break; } }
      if(!def) return;

      /* wlSecs 가 이미 통째로 감춘 영역이면 손대지 않는다 */
      if(h.style && h.style.display === 'none'){ h.classList.remove('pg-foldable'); return; }

      var body = blockOf(h);
      if(!body.length) return;

      if(!isOn()){
        h.classList.remove('pg-foldable', 'is-open');
        body.forEach(function(el){ el.classList.remove('wl-foldhide'); });
        var od = h.querySelector('.pg-foldi'); if(od) od.remove();
        return;
      }

      var open = (opened(def.key) === 1);
      var n = count(body, def.cnt);

      /* 제목을 누를 수 있게 만든다 (한 번만) */
      h.classList.add('pg-foldable');
      h.classList.toggle('is-open', open);
      var ind = h.querySelector('.pg-foldi');
      if(!ind){
        ind = document.createElement('span');
        ind.className = 'pg-foldi';
        h.insertBefore(ind, h.firstChild);
      }
      var lab = (open ? '▾' : '▸') + (n ? (' ' + n) : '');
      if(ind.textContent !== lab) ind.textContent = lab;

      if(!h._foldB){
        h._foldB = 1;
        h.addEventListener('click', function(ev){
          /* 안쪽 단추를 누른 것은 접기가 아니다 */
          if(ev.target !== h && ev.target.closest && ev.target.closest('button,input,a,textarea,select')) return;
          var now = (opened(def.key) === 1);
          markOpen(def.key, !now);
          if(typeof window.wlAfterPaint === 'function') window.wlAfterPaint(); else run();
        });
      }

      body.forEach(function(el){ el.classList.toggle('wl-foldhide', !open); });
    });
  }

  /* 그리는 차례 맨 뒤 — wlSecs(10) 가 display 를 정한 다음에 클래스로 접는다 */
  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:60, n:'아래 영역 접기', f:run });

  window.wlFold = {
    on:  function(){ setOn(1); if(window.wlAfterPaint) window.wlAfterPaint(); return '하위 항목·파일 링크를 접습니다'; },
    off: function(){ setOn(0); if(window.wlAfterPaint) window.wlAfterPaint(); return '예전처럼 늘 펼쳐 둡니다'; }
  };
  console.log('[영역 접기] v132 준비됨 — 🧷 하위 항목 · 📎 파일 링크는 제목을 누르면 펼쳐집니다');
})();


/* ============================================================
   ▥ 페이지를 2열로 (wlPage2)  v134-0830-1010

   달님 : 「페이지는 2열로 나오게 만들자.
           작성하면서 본문도 같이 보면서 데이터 넣고 보고 수정하게」

   왼쪽 = 속성(칸들) · 오른쪽 = 본문 · 자재 · 하위 항목 · 파일 링크 · 사진
   ▸ 뱃지와 제목은 위에 그대로 (전체 폭)
   ▸ 화면이 좁으면(1180px 미만) CSS 가 알아서 1열로 돌린다
   ▸ 속성 격자는 원래 「폭에 맞춰 2~4열」이라, 절반이 되면 저절로 2열이 된다

   ⚠ 화면을 다시 그릴 때마다 겹겹이 싸지 않도록, 이미 나뉘어 있으면 손대지 않는다.
   되돌리기 : wlPage2.off()   또는 진단 탭 「▥ 페이지 2열」
   ============================================================ */
(function(){
  'use strict';

  var LS = 'wl_page2';

  function isOn(){ try{ return localStorage.getItem(LS) !== '0'; }catch(e){ return true; } }
  function setOn(v){
    try{ localStorage.setItem(LS, v?'1':'0'); }catch(e){}
    paintBtn();
    if(typeof window.wlGoPage === 'function'){
      try{
        var m = String(location.hash||'').match(/^#lp=([^&]+)/);
        if(m) window.wlGoPage(decodeURIComponent(m[1]));       /* 통째로 다시 그린다 */
      }catch(e){}
    }
    if(typeof toast === 'function') toast(v ? '▥ 페이지를 2열로 봅니다' : '▤ 페이지를 한 줄로 봅니다');
  }

  /* 이 페이지가 이미 나뉘어 있나 */
  window.wlIsTwoCol = function(){
    try{ return !!document.querySelector('.lf-page .pg-2col'); }catch(e){ return false; }
  };

  function split(){
    var body = document.querySelector('.lf-page .pg-body');
    if(!body) return;

    var have = body.querySelector(':scope > .pg-2col');

    if(!isOn()){                                   /* 꺼져 있으면 원래대로 돌려 놓는다 */
      if(have){
        var L = have.querySelector('.pg-2l'), R = have.querySelector('.pg-2r');
        [L, R].forEach(function(c){
          if(!c) return;
          while(c.firstChild) body.insertBefore(c.firstChild, have);
        });
        have.remove();
      }
      try{ var pg0 = body.closest('.lf-page'); if(pg0) pg0.classList.remove('is-2col'); }catch(e){}
      return;
    }
    if(have){
      /* v134 — 「＋ 영역」 칩줄은 속성과 한 몸이다. 나중에 만들어져 오른쪽에
            섞여 들어갔으면 왼쪽 끝으로 돌려 놓는다. */
      try{
        var bar = have.querySelector('.pg-2r > #pgSecBar');
        var lc  = have.querySelector('.pg-2l');
        if(bar && lc) lc.appendChild(bar);
      }catch(e){ console.warn('[페이지 2열] 칩줄 자리 되돌리기 실패', e); }
      return;                                      /* 이미 나뉘어 있으면 그대로 */
    }

    var props = body.querySelector(':scope > .pg-props');
    if(!props) return;                             /* 속성이 없으면 나눌 것이 없다 */

    /* 속성 격자와 그 바로 밑 「＋ 영역」 칩줄까지가 왼쪽 */
    var left = [props];
    var n = props.nextElementSibling;
    if(n && n.id === 'pgSecBar'){ left.push(n); n = n.nextElementSibling; }

    var right = [];
    while(n){ right.push(n); n = n.nextElementSibling; }
    if(!right.length) return;                      /* 오른쪽에 놓을 것이 없으면 굳이 나누지 않는다 */

    /* v134 — 좁은 화면에서는 나누지 않는다. 나눠 봐야 양쪽 다 답답해진다. */
    try{ if((window.innerWidth || 0) < 1200) return; }catch(e){}

    var wrap = document.createElement('div');
    wrap.className = 'pg-2col';
    body.insertBefore(wrap, props);
    /* 2열일 때만 페이지를 넓힌다 — 평소 읽기 폭(860px)은 그대로 둔다 */
    try{ var pgEl = body.closest('.lf-page'); if(pgEl) pgEl.classList.add('is-2col'); }catch(e){}

    var L2 = document.createElement('div'); L2.className = 'pg-2l';
    var R2 = document.createElement('div'); R2.className = 'pg-2r';
    wrap.appendChild(L2); wrap.appendChild(R2);
    left.forEach(function(el){ L2.appendChild(el); });
    right.forEach(function(el){ R2.appendChild(el); });

    /* v134 — 오른쪽 맨 위는 「본문」이다.
          달님 : 「작성하면서 본문도 같이 보면서 데이터 넣고 보고 수정하게」
          본문 제목 뒤에 오는 것들(서식줄·글상자·한 줄 정리·사진)은 본문에 딸린
          것이므로 통째로 앞으로 옮긴다. */
    try{
      var bodySec = null;
      [].forEach.call(R2.children, function(el){
        if(bodySec) return;
        if(el.classList && el.classList.contains('pg-sec') && /본문/.test(el.textContent || '')) bodySec = el;
      });
      if(bodySec){
        var move = [], hit = false;
        [].slice.call(R2.children).forEach(function(el){
          if(el === bodySec) hit = true;
          if(hit) move.push(el);
        });
        move.reverse().forEach(function(el){ R2.insertBefore(el, R2.firstChild); });
      }
    }catch(e){ console.warn('[페이지 2열] 본문을 위로 올리지 못했어요', e); }
  }

  function run(){
    try{ split(); }
    catch(e){ console.warn('[페이지 2열] 나누기 실패 — 한 줄로 둡니다', e); }
  }

  /* 큰 틀을 먼저 만들고, 나머지 모듈이 그 안에서 자리를 잡게 한다 */
  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:5, n:'페이지 2열', f:run });

  /* ── 진단 탭 스위치 ── */
  function paintBtn(){
    var a = document.getElementById('pg2On'), b = document.getElementById('pg2Off');
    var on = isOn();
    if(a) a.className = 'btn btn-sm ' + (on ? 'btn-primary' : 'btn-ghost');
    if(b) b.className = 'btn btn-sm ' + (!on ? 'btn-primary' : 'btn-ghost');
    var t = document.getElementById('pg2Now');
    if(t) t.textContent = '지금: ' + (on ? '2열로 봅니다' : '한 줄로 봅니다');
  }
  function panel(){
    var anchor = document.getElementById('tabOneNow');
    if(!anchor) return;
    var host = anchor.parentNode && anchor.parentNode.parentNode;
    if(!host || document.getElementById('pg2Row')) return;

    var h = document.createElement('div');
    h.className = 'sec-head'; h.textContent = '▥ 페이지 2열';
    var d = document.createElement('div');
    d.style.cssText = 'font-size:12.5px;color:#7a92a8;margin-bottom:6px';
    d.textContent = '켜면 왼쪽에 칸들, 오른쪽에 본문·자재·하위 항목이 나란히 놓입니다. '
                  + '적으면서 본문을 같이 볼 수 있습니다. 화면이 좁으면 저절로 한 줄이 됩니다.';
    var row = document.createElement('div');
    row.className = 'btn-row'; row.id = 'pg2Row'; row.style.marginTop = '0';
    row.innerHTML = '<button class="btn btn-sm" id="pg2On"  style="min-height:44px">▥ 2열로</button>'
                  + '<button class="btn btn-sm" id="pg2Off" style="min-height:44px">▤ 한 줄로</button>'
                  + '<span id="pg2Now" style="font-size:12.5px;color:#7a92a8;align-self:center;margin-left:6px"></span>';

    var after = anchor.parentNode;
    host.insertBefore(h,   after.nextSibling);
    host.insertBefore(d,   h.nextSibling);
    host.insertBefore(row, d.nextSibling);

    document.getElementById('pg2On').addEventListener('click',  function(){ setOn(true);  });
    document.getElementById('pg2Off').addEventListener('click', function(){ setOn(false); });
    paintBtn();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 1800);
  setTimeout(panel, 4200);

  window.wlPage2 = {
    on:  function(){ setOn(true);  return '페이지를 2열로 봅니다'; },
    off: function(){ setOn(false); return '페이지를 한 줄로 봅니다'; }
  };
  console.log('[페이지 2열] v134 준비됨 — ' + (isOn()?'켜짐':'꺼짐') + ' (진단 탭 「▥ 페이지 2열」)');
})();


/* ============================================================
   ↔ 묶음을 오른쪽으로 보내기 (wlSide)  v136-0830-1110

   달님 : 「2열 구조에서 시각을 본문 쪽으로 보내면 한 창에 다 나올듯.
           내가 중요시하는게 한눈에 파악이야. 이게 가장 중요해」

   실측 (1600×1000 화면) : 왼쪽 1482px · 오른쪽 523px · 화면 1000px
   → 왼쪽이 482px 넘쳐 스크롤이 생겼다. 오른쪽에는 477px 이 남아 있었다.
     시각 묶음 하나(≈150px)만 옮겨서는 모자라, 무엇을 보낼지 고를 수 있게 한다.
     기본은 「🕐 시각 + 🏢 업체」 — 둘이 ≈450px 라 양쪽이 비슷해진다.

   ⚠ 옮긴 줄은 wlGroup 이 다시 그릴 때 restoreOrder 가 제자리로 되돌린다.
     그래서 매번 「그리기 → 다시 옮기기」 차례로만 움직인다 (o:25).
   되돌리기 : wlSide.set('')   /  진단 탭 「↔ 오른쪽으로 보낼 묶음」
   ============================================================ */
(function(){
  'use strict';

  var LS = 'wl_side_groups';
  /* v138 — 달님 : 「업체 누구와는 2열로 만들어서 왼쪽으로 보내. 그래야 균형이 맞아」
        업체는 칸이 5개라 오른쪽 1열에 두면 세로로 길어져 오른쪽만 늘어났다.
        왼쪽 속성 격자는 폭에 맞춰 2열이 되므로 업체는 왼쪽이 맞다. */
  var DEF = 'g3';                    /* 기본 : 시각만 */
  var NAME = { g0:'📌 기본', gc:'💰 비용', gt:'📦 자재', g1:'🏢 업체', g3:'🕐 시각' };
  var LS_AUTO = 'wl_side_autofit';
  var _fitId = '';                   /* 이 기록에서 이미 균형을 맞췄나 */
  function autoOn(){ try{ return localStorage.getItem(LS_AUTO) !== '0'; }catch(e){ return true; } }

  /* v138 — 예전 기본값(시각+업체)을 그대로 쓰고 있던 분은 새 기본값으로 한 번 갈아끼운다.
        손으로 정해 둔 분은 건드리지 않는다. */
  try{
    if(localStorage.getItem(LS) === 'g3,g1' && localStorage.getItem('wl_side_v138') !== '1'){
      localStorage.setItem(LS, 'g3');
      localStorage.setItem('wl_side_v138', '1');
    }
  }catch(e){}

  function list(){
    try{
      var v = localStorage.getItem(LS);
      if(v === null) v = DEF;
      return String(v).split(',').map(function(x){ return x.trim(); }).filter(Boolean);
    }catch(e){ return DEF.split(','); }
  }
  function set(v){
    try{ localStorage.setItem(LS, Array.isArray(v) ? v.join(',') : String(v||'')); }catch(e){}
    paintBtns();
    if(typeof window.wlAfterPaint === 'function') window.wlAfterPaint();
    var n = list().length;
    if(typeof toast === 'function')
      toast(n ? ('↔ ' + list().map(function(g){ return NAME[g]||g; }).join(' · ') + ' 를 오른쪽으로 보냅니다')
              : '↔ 모두 왼쪽에 둡니다');
  }
  function toggle(gid){
    var a = list(), i = a.indexOf(gid);
    if(i >= 0) a.splice(i, 1); else a.push(gid);
    set(a);
  }

  /* 묶음 한 덩어리 = 머리 ~ 다음 묶음 머리 직전 (발치·여백까지) */
  function chunk(props, gid){
    var head = props.querySelector('.pg-ghead[data-gid="' + gid + '"]')
            || props.querySelector('.pg-grow[data-gid="' + gid + '"]');
    if(!head) return null;
    var out = [head], n = head.nextElementSibling, guard = 0;
    while(n && guard++ < 60){
      var c = n.classList;
      if(c && (c.contains('pg-ghead') || (c.contains('pg-grow') && n.hasAttribute('data-gid')))) break;
      out.push(n);
      var isTail = c && c.contains('pg-gtail');
      n = n.nextElementSibling;
      if(isTail) break;
    }
    return out;
  }

  function run(){
    var page = document.querySelector('.lf-page');
    if(!page) return;
    var side = page.querySelector('.pg-side');
    var want = list();

    /* 2열이 아니거나 보낼 것이 없으면 곁상자를 치운다 (줄은 restoreOrder 가 되돌린다) */
    var two = (typeof window.wlIsTwoCol === 'function') ? window.wlIsTwoCol() : false;
    if(!two || !want.length){
      if(side) side.remove();
      return;
    }

    var props = page.querySelector('.pg-props');
    var right = page.querySelector('.pg-2r');
    if(!props || !right) return;

    if(!side || side.parentNode !== right){
      if(side) side.remove();
      side = document.createElement('div');
      side.className = 'pg-props pg-side';
      /* v144 — 달님 : 「시각은 본문 위로 보내」
            시각은 적자마자 눈에 들어와야 하는 값이라 오른쪽 맨 위가 제자리다.
            (예전에는 본문 아래·하위 항목 앞에 두어 스크롤을 내려야 보였다) */
      if(right.firstChild) right.insertBefore(side, right.firstChild);
      else right.appendChild(side);
    }
    side.innerHTML = '';

    var moved = 0;
    want.forEach(function(gid){
      var part = chunk(props, gid);
      if(!part || !part.length) return;
      part.forEach(function(el){ side.appendChild(el); });
      moved++;
    });
    if(!moved) side.remove();

    /* v138 — 기록마다 값이 달라 한쪽만 길어질 수 있다.
          기록을 열 때 딱 한 번 재어 균형을 맞춘다 (같은 기록에서는 다시 안 한다).
          끄기 : wlSide.autoOff() */
    try{
      var rid = (String(location.hash||'').match(/^#lp=([^&]+)/)||[])[1] || '';
      if(autoOn() && rid && rid !== _fitId){
        _fitId = rid;
        /* 한 번 옮기면 여백이 달라져 계산이 조금 어긋난다.
              옮긴 뒤 실제로 다시 재어 두 번까지만 맞춘다 (그 뒤로는 손대지 않는다). */
        var tries = 0;
        (function again(){
          setTimeout(function(){
            try{
              var L2 = document.querySelector('.pg-2l'), R2 = document.querySelector('.pg-2r');
              if(!L2 || !R2) return;
              if(Math.max(L2.scrollHeight, R2.scrollHeight) <= window.innerHeight) return;  /* 알맞다 */
              var before = list().join(',');
              autoFit();
              if(++tries < 2 && list().join(',') !== before) again();   /* 달라졌으면 한 번 더 */
            }catch(e){ console.warn('[묶음 오른쪽으로] 자동 균형 실패', e); }
          }, 450);
        })();
      }
    }catch(e){}
  }

  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:25, n:'묶음 오른쪽으로', f:run });

  /* ── 진단 탭 스위치 ── */
  function paintBtns(){
    var on = list();
    Object.keys(NAME).forEach(function(g){
      var el = document.getElementById('sd_' + g);
      if(!el) return;
      el.className = 'btn btn-sm ' + (on.indexOf(g) >= 0 ? 'btn-primary' : 'btn-ghost');
      el.style.minHeight = '44px';
    });
    var t = document.getElementById('sdNow');
    if(t) t.textContent = on.length
      ? ('오른쪽: ' + on.map(function(g){ return NAME[g]||g; }).join(' · '))
      : '모두 왼쪽에 둡니다';
  }
  function panel(){
    var anchor = document.getElementById('pg2Now');
    if(!anchor) return;
    var host = anchor.parentNode && anchor.parentNode.parentNode;
    if(!host || document.getElementById('sdRow')) return;

    var h = document.createElement('div');
    h.className = 'sec-head'; h.textContent = '↔ 오른쪽으로 보낼 묶음';
    var d = document.createElement('div');
    d.style.cssText = 'font-size:12.5px;color:#7a92a8;margin-bottom:6px';
    d.textContent = '2열로 볼 때, 눌러 둔 묶음을 오른쪽(본문 쪽)으로 보냅니다. '
                  + '왼쪽이 길어 스크롤이 생기면 몇 개를 오른쪽으로 보내 한 화면에 담으세요.';
    var row = document.createElement('div');
    row.className = 'btn-row'; row.id = 'sdRow'; row.style.marginTop = '0';
    row.innerHTML = ['gc','gt','g1','g3'].map(function(g){
      return '<button class="btn btn-sm" id="sd_' + g + '">' + NAME[g] + '</button>';
    }).join('')
    + '<button class="btn btn-primary btn-sm" id="sdAuto" style="min-height:44px">⚖ 자동 맞춤</button>'
    + '<span id="sdNow" style="font-size:12.5px;color:#7a92a8;align-self:center;margin-left:6px"></span>';

    var after = anchor.parentNode;
    host.insertBefore(h,   after.nextSibling);
    host.insertBefore(d,   h.nextSibling);
    host.insertBefore(row, d.nextSibling);

    ['gc','gt','g1','g3'].forEach(function(g){
      var el = document.getElementById('sd_' + g);
      if(el && !el._b){ el._b = 1; el.addEventListener('click', function(){ toggle(g); }); }
    });
    var ab = document.getElementById('sdAuto');
    if(ab && !ab._b){
      ab._b = 1;
      ab.addEventListener('click', function(){
        var r = autoFit();
        if(typeof toast === 'function') toast('⚖ ' + r);
        var t2 = document.getElementById('sdNow');
        setTimeout(function(){ if(t2) t2.textContent = r; }, 400);
      });
    }
    paintBtns();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
  setTimeout(panel, 2000);
  setTimeout(panel, 4600);

  /* ⚖ 자동 맞춤 — 지금 화면을 재어 좌·우가 비슷해지도록 묶음을 나눈다.
        한 번 계산해서 정해 두는 방식이라, 저절로 왔다 갔다 하지 않는다. */
  function autoFit(){
    var page = document.querySelector('.lf-page');
    var L = page && page.querySelector('.pg-2l');
    var R = page && page.querySelector('.pg-2r');
    if(!L || !R) return '2열 화면에서 눌러 주세요';

    var props = page.querySelector('.pg-props');
    if(!props) return '속성을 못 찾았어요';

    /* 지금 왼쪽에 있는 묶음들의 높이를 잰다 */
    var cand = [];
    ['gc','gt','g1','g3'].forEach(function(gid){
      var part = chunk(props, gid);
      if(!part || !part.length) return;
      var h = 0;
      part.forEach(function(el){
        try{ var r = el.getBoundingClientRect(); h += r.height; }catch(e){}
      });
      if(h > 0) cand.push({ gid:gid, h:Math.round(h) });
    });

    var side = page.querySelector('.pg-side');
    var sideH = side ? side.scrollHeight : 0;
    var Lh = L.scrollHeight, Rh = R.scrollHeight;
    var base = { L: Lh, R: Rh - sideH };          /* 곁상자를 뺀 순수 높이 */

    /* 이미 오른쪽에 가 있는 것도 후보에 넣는다 (되돌릴 수 있게) */
    var cur = list();
    if(side){
      ['gc','gt','g1','g3'].forEach(function(gid){
        if(cur.indexOf(gid) < 0) return;
        var p2 = chunk(side, gid);
        if(!p2 || !p2.length) return;
        var h2 = 0;
        p2.forEach(function(el){ try{ h2 += el.getBoundingClientRect().height; }catch(e){} });
        if(h2 > 0){ cand.push({ gid:gid, h:Math.round(h2) }); base.L += h2; }
      });
    }
    if(!cand.length) return '나눌 묶음이 없어요';

    /* 큰 것부터 넣어 보며 「높은 쪽」이 가장 낮아지는 조합을 고른다 */
    cand.sort(function(a,b){ return b.h - a.h; });
    var best = null;
    var n = cand.length, total = 1 << n;
    for(var m = 0; m < total; m++){
      var l = base.L, r = base.R, pick = [];
      for(var i = 0; i < n; i++){
        if(m & (1 << i)){ l -= cand[i].h; r += cand[i].h; pick.push(cand[i].gid); }
      }
      var worst = Math.max(l, r);
      if(!best || worst < best.worst){ best = { worst:worst, pick:pick, l:l, r:r }; }
      if(m === 0) var now = { worst:worst, pick:pick.slice(), l:l, r:r };   /* 지금 그대로 두는 경우 */
    }
    /* v136 — 지금과 크게 다르지 않으면 바꾸지 않는다.
          안 그러면 누를 때마다 조합이 왔다 갔다 해서 화면이 흔들린다. */
    var nowWorst = Math.max(base.L, base.R);
    var margin = (nowWorst > window.innerHeight) ? 15 : 40;   /* 넘치는 중이면 조금만 나아져도 옮긴다 */
    if(best.worst > nowWorst - margin){
      return '왼쪽 ' + Math.round(base.L) + 'px · 오른쪽 ' + Math.round(base.R) + 'px → '
           + (nowWorst <= window.innerHeight ? '✅ 이미 알맞습니다'
                                             : '지금이 가장 나은 배치예요 — 안 쓰는 묶음을 접어 보세요');
    }
    set(best.pick);
    var fits = best.worst <= window.innerHeight;
    return '왼쪽 ' + Math.round(best.l) + 'px · 오른쪽 ' + Math.round(best.r) + 'px → '
         + (fits ? '✅ 한 화면에 들어옵니다'
                 : '⚠ 아직 ' + Math.round(best.worst - window.innerHeight) + 'px 넘칩니다 — 안 쓰는 묶음을 접어 보세요');
  }

  window.wlSide = {
    auto: autoFit,
    autoOn:  function(){ try{ localStorage.setItem(LS_AUTO,'1'); }catch(e){} _fitId=''; return '기록을 열 때 저절로 균형을 맞춥니다'; },
    autoOff: function(){ try{ localStorage.setItem(LS_AUTO,'0'); }catch(e){} return '자동 균형을 껐습니다'; },
    set:  function(v){ set(v); return list().join(',') || '(없음)'; },
    list: function(){ return list(); },
    /* 지금 화면이 한 눈에 들어오는지 재어 본다 */
    fit:  function(){
      var L = document.querySelector('.pg-2l'), R = document.querySelector('.pg-2r');
      if(!L || !R) return '2열 화면이 아닙니다';
      var h = window.innerHeight;
      return '왼쪽 ' + Math.round(L.scrollHeight) + 'px · 오른쪽 ' + Math.round(R.scrollHeight)
           + 'px · 화면 ' + h + 'px → '
           + ((L.scrollHeight <= h && R.scrollHeight <= h) ? '✅ 한 화면에 들어옵니다'
                                                           : '⚠ 넘칩니다 — 묶음을 더 오른쪽으로 보내 보세요');
    }
  };
  console.log('[묶음 오른쪽으로] v136 준비됨 — ' + (list().map(function(g){ return NAME[g]||g; }).join(' · ') || '없음'));
})();


/* ============================================================
   🧾 묶음별 한 줄 자동 정리 (wlAutoSum)  v137-0830-1150

   달님 : 「기본·비용·자재·업체·시간이 채워지면 다 채워진 것만 자동으로
           본문에 들어가게. 한 줄씩 밑으로 쌓이게.
           칸 전부 적기는 세로 나열이라 불편해」

   본문 맨 위에 「정리」 상자를 두고, 채워진 묶음마다 한 줄씩 쌓는다.

       📌 2026-08-30 · 지하6층 · 전기 · 완료
       💰 개인비용 · 합계 500,000원
       📦 소방관창 AL/65A 1개 · 삼파장램프 2개 · 자재 4,020원
       🏢 (주)은진 · 조홍석 상무 · 010-6265-4001
       🕐 09:00 ~ 10:30

   ▸ 값이 바뀌면 그 줄만 다시 쓴다 — 상자 아래에 직접 적은 글은 안 건드린다
   ▸ 실제로 달라졌을 때만 저장한다 (저장이 쉴 새 없이 도는 것을 막는다)
   되돌리기 : wlAutoSum.off()  또는 본문 옆 [🧾 자동 정리] 를 한 번 더
   ============================================================ */
(function(){
  'use strict';

  var LS  = 'wl_autosum';
  var TAG = 'wlsum';                 /* 정리 상자 표시 — 이 표시가 붙은 것만 앱이 고친다 */

  function isOn(){ try{ return localStorage.getItem(LS) !== '0'; }catch(e){ return true; } }
  function setOn(v){
    try{ localStorage.setItem(LS, v?'1':'0'); }catch(e){}
    run();
    if(typeof toast === 'function') toast(v ? '🧾 채워진 묶음이 본문에 한 줄씩 쌓입니다' : '🧾 자동 정리를 껐어요');
  }
  function ridNow(){
    try{ var m = String(location.hash||'').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function recOf(id){
    try{ return (entries||[]).filter(function(x){ return x && x.id === id; })[0] || null; }
    catch(e){ return null; }
  }
  function ES(s){ return String(s==null?'':s).replace(/[&<>]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function won(n){ n = Number(n)||0; return n ? n.toLocaleString('ko-KR') : ''; }
  function T(v){ return String(v==null?'':v).trim(); }

  /* 묶음마다 한 줄 만들기 — 값이 없으면 그 묶음은 아예 빠진다 */
  function lines(r){
    var out = [];

    /* 📌 기본 — 달님이 정한 차례 (v147)
          년 → (년+월) → 분야 → 층 → 제목 → 내용 → 완료 상태
          ▸ 「대상」 이라는 말은 빼고, 작성 날짜도 넣지 않는다 */
    var b = [];
    var _yy = T(r.refYear), _mm = T(r.refMonth);
    if(_yy && _mm)      b.push(_yy + '년 ' + _mm + '월');
    else if(_yy)        b.push(_yy + '년');
    else if(_mm)        b.push(_mm + '월');
    if(T(r.field))  b.push(T(r.field));
    if(T(r.floor))  b.push(T(r.floor));
    if(T(r.title))  b.push('「' + T(r.title) + '」');
    if(T(r.detail)) b.push(T(r.detail));
    if(T(r.status)) b.push(T(r.status));
    /* v139 — 달님 : 「기본은 제목 빼고 3개 이상 채워졌을 때에만 한 줄 요약해」
          날짜·완료 상태는 새로 만들 때 저절로 들어가는 값이다.
          그 둘만으로 「📌 2026-08-30 · 완료」 를 적어 봐야 아무 정보도 아니다. */
    if(b.length >= 3) out.push({ k:'g0', t:'📌 ' + b.join(' · ') });

    /* 💰 비용 */
    var c = [];
    if(T(r.expType) && T(r.expType) !== '없음') c.push(T(r.expType));
    if(T(r.expSubType)) c.push(T(r.expSubType));
    if(T(r.purpose))    c.push(T(r.purpose));
    if(Number(r.supplyAmt)) c.push('공급 ' + won(r.supplyAmt) + '원');
    if(Number(r.taxAmt))    c.push('부가세 ' + won(r.taxAmt) + '원');
    if(Number(r.cost))      c.push('합계 ' + won(r.cost) + '원');
    if(r.isIssued) c.push('발급 완료');
    if(c.length) out.push({ k:'gc', t:'💰 ' + c.join(' · ') });

    /* 📦 자재 — 칸에 적은 것 + 담은 목록 */
    var m = [];
    if(T(r.material)) m.push([T(r.material), T(r.spec)].filter(Boolean).join(' ')
                             + (Number(r.qty) ? ' ' + Number(r.qty) + '개' : ''));
    (Array.isArray(r.materials) ? r.materials : []).filter(Boolean).forEach(function(x){
      m.push([T(x.name), T(x.spec)].filter(Boolean).join(' ') + ' ' + (Number(x.qty)||1) + '개');
    });
    if(Number(r.matCost)) m.push('자재 ' + won(r.matCost) + '원');
    if(m.length) out.push({ k:'gt', t:'📦 ' + m.join(' · ') });

    /* 🏢 업체 */
    var v = [];
    var nm = T(r.workVendor) || T(r.vendor) || T(r.owner) || T(r.company) || T(r.partyName);
    if(nm) v.push(nm);
    var who = [T(r.workContact) || T(r.callContact) || T(r.person),
               T(r.workRole) || T(r.role)].filter(Boolean).join(' ');
    if(who) v.push(who);
    var ph = T(r.workPhone) || T(r.phone) || T(r.ownerPhone) || T(r.partyPhone);
    if(ph) v.push(ph);
    if(T(r.workMemo)) v.push(T(r.workMemo));
    if(v.length) out.push({ k:'g1', t:'🏢 ' + v.join(' · ') });

    /* 🕐 시각 */
    var st = T(r.startTime), et = T(r.endTime);
    if(st || et) out.push({ k:'g3', t:'🕐 ' + [st, et].filter(Boolean).join(' ~ ') });

    return out;
  }

  function boxHTML(ls){
    return '<div data-' + TAG + '="1" class="pg-sumbox">'
         + ls.map(function(l){ return '<div data-' + TAG + 'k="' + l.k + '">' + ES(l.t) + '</div>'; }).join('')
         + '<div class="pg-sumnote" contenteditable="false">칸을 고치면 이 줄들이 저절로 바뀝니다 · 아래에 쓴 글은 그대로 둡니다</div>'
         + '</div>';
  }

  function run(){
    var B = document.getElementById('pgBodyTx');
    if(!B) return;
    var old = B.querySelector('[data-' + TAG + ']');

    if(!isOn()){
      if(old){ old.remove(); save(B); }
      return;
    }
    var rid = ridNow(); if(!rid) return;
    var r = recOf(rid); if(!r) return;
    if(_curId !== rid){ _curId = rid; _lastSaved = ''; }   /* 다른 기록 — 기억을 비운다 */

    var ls = lines(r);
    if(!ls.length){
      if(old){ old.remove(); save(B); }
      return;
    }
    var want = boxHTML(ls);

    if(old){
      if(old.outerHTML === want) return;            /* 달라진 게 없으면 저장하지 않는다 */
      old.outerHTML = want;
    }else{
      B.insertAdjacentHTML('afterbegin', want);     /* 맨 위에 — 아래 글은 그대로 */
    }
    save(B);
  }

  /* v147 【최우선】 달님 로그 :
        「resource-exhausted : Write stream exhausted maximum allowed queued writes」
        = 저장 요청이 너무 많이 쌓여 파이어스토어가 받기를 거부한 것이다.
          이 상태로 두면 적은 내용이 서버에 안 올라간다.
        원인 : 정리 줄이 다시 그려질 때마다 본문을 저장했다.
        고침 : 화면에는 바로 반영하고, 서버 저장은 1.5초 모아서 한 번만 한다.
               게다가 마지막으로 저장한 내용과 같으면 아예 안 보낸다. */
  var _saveT = null, _lastSaved = '', _curId = '';
  function save(B){
    try{ B.dispatchEvent(new Event('input', {bubbles:true})); }catch(e){}
    var html = B.innerHTML;
    if(html === _lastSaved) return;                 /* 달라진 게 없으면 보내지 않는다 */
    clearTimeout(_saveT);
    _saveT = setTimeout(function(){
      try{
        var B2 = document.getElementById('pgBodyTx');
        if(!B2) return;
        var h2 = B2.innerHTML;
        if(h2 === _lastSaved) return;
        _lastSaved = h2;
        if(typeof window.wlBodySave === 'function') window.wlBodySave(h2);
      }catch(e){ console.warn('[자동 정리] 본문 저장 실패', e); }
    }, 1500);
  }
  window.wlSumForget = function(){ _lastSaved = ''; };   /* 다른 기록을 열면 기억을 비운다 */

  /* 본문 옆에 켜고 끄는 단추 */
  function btn(){
    var wrap = document.getElementById('pgSumWrap');
    if(!wrap || document.getElementById('pgAutoSum')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'pgAutoSum'; b.className = 'pg-xb';
    b.title = '채워진 묶음을 본문 맨 위에 한 줄씩 쌓습니다';
    b.addEventListener('click', function(){ setOn(!isOn()); paintBtn(); });
    wrap.insertBefore(b, wrap.firstChild);
    paintBtn();
  }
  function paintBtn(){
    var b = document.getElementById('pgAutoSum');
    if(!b) return;
    var on = isOn();
    b.textContent = on ? '🧾 자동 정리 켬' : '🧾 자동 정리 끔';
    b.className = 'pg-xb' + (on ? ' on' : '');
  }

  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:70, n:'묶음 한 줄 정리', f:function(){
    try{ btn(); run(); }catch(e){ console.warn('[자동 정리] 실패', e); } } });

  /* v145 — 달님 : 「언제 본문에 한 줄로 들어갈지 정의도 있어야 할 듯」
        규칙을 못박는다 :
          ▸ 칸(날짜·층·분야·금액·자재·업체·시각…)을 고치면 → 그 자리에서 곧바로
          ▸ 본문에 쓰는 글은 정리와 무관하다 (정리는 「칸」에서만 나온다)
        예전에는 화면이 다시 그려질 때까지 기다려서 언제 바뀌는지 알 수 없었다. */
  var _t = null;
  function soon(){
    clearTimeout(_t);
    _t = setTimeout(function(){ try{ run(); }catch(e){ console.warn('[자동 정리] 실패', e); } }, 250);
  }
  function fromProps(t){
    if(!t || t.nodeType !== 1 || typeof t.closest !== 'function') return false;
    return !!(t.closest('.lf-page .pg-props') || t.closest('.lf-page .pg-side'));
  }
  document.addEventListener('change',   function(ev){ if(fromProps(ev.target)) soon(); }, true);
  document.addEventListener('focusout', function(ev){ if(fromProps(ev.target)) soon(); }, true);
  /* 자재 담기·사진처럼 코드가 값을 바꾸는 길도 있다 — 그때도 곧바로 */
  window.wlSumNow = function(){ try{ run(); }catch(e){ console.warn('[자동 정리] 실패', e); } };

  window.wlAutoSum = {
    on:  function(){ setOn(true);  return '켰습니다'; },
    off: function(){ setOn(false); return '껐습니다'; },
    now: function(){ var r = recOf(ridNow()); return r ? lines(r).map(function(l){ return l.t; }) : '기록을 먼저 여세요'; }
  };
  console.log('[자동 정리] v137 준비됨 — 채워진 묶음이 본문 맨 위에 한 줄씩 쌓입니다');
})();


/* ============================================================
   📷 본문에서 사진 떼어내기 · 확대 · 삭제 (wlPics)  v137-0830-1150

   달님 : 「본문 내용과 사진 넣는건 분리해서 사진칸 만들어서 정리되게.
           사진은 확대 삭제 기능이 있어야 하고」

   ▸ 본문에 끌어다 놓은 사진을 「📷 사진」 칸으로 옮긴다 (본문은 글만)
   ▸ 사진을 누르면 크게 보인다 (앱에 있던 zimg 뷰어를 그대로 쓴다)
   ▸ 사진마다 ✕ — 한 번 물어보고 지운다
   되돌리기 : wlPics.off()  (사진을 본문에 그대로 둔다)
   ============================================================ */
(function(){
  'use strict';

  var LS = 'wl_pics_split';

  function isOn(){ try{ return localStorage.getItem(LS) !== '0'; }catch(e){ return true; } }
  function setOn(v){ try{ localStorage.setItem(LS, v?'1':'0'); }catch(e){}
    if(typeof window.wlAfterPaint === 'function') window.wlAfterPaint();
    if(typeof toast === 'function') toast(v ? '📷 사진을 사진칸으로 모읍니다' : '📷 사진을 본문에 그대로 둡니다'); }
  function ridNow(){
    try{ var m = String(location.hash||'').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function recOf(id){
    try{ return (entries||[]).filter(function(x){ return x && x.id === id; })[0] || null; }
    catch(e){ return null; }
  }

  /* ① 본문 안 사진 → photos 로 옮기기 */
  function split(){
    if(!isOn()) return;
    var B = document.getElementById('pgBodyTx'); if(!B) return;
    var imgs = B.querySelectorAll('img'); if(!imgs.length) return;
    var rid = ridNow(); if(!rid) return;
    var r = recOf(rid); if(!r) return;

    var cur = Array.isArray(r.photos) ? r.photos.slice() : [];
    var add = 0;
    [].forEach.call(imgs, function(im){
      var src = im.getAttribute('src') || '';
      if(src && cur.indexOf(src) < 0){ cur.push(src); add++; }
      im.remove();
    });
    try{
      if(typeof updateRecord === 'function') updateRecord(rid, { photos: cur });
      if(typeof window.wlBodySave === 'function') window.wlBodySave(B.innerHTML);
      if(add && typeof toast === 'function') toast('📷 사진 ' + add + '장을 사진칸으로 옮겼어요');
      setTimeout(function(){
        try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid); }catch(e){}
      }, 160);
    }catch(e){ console.warn('[사진] 옮기기 실패', e); }
  }

  /* ② 사진마다 「순서 바꾸기 · 지우기」 손잡이를 단다
        달님 : 「닫기 버튼이 너무 작잖아. 잘 보이는 곳에 잘 보이는 크기로.
                사진은 내가 중요도 순으로 재배치할 수 있게」
        ▸ 단추는 사진 아래 줄에 크게 (터치 40px) — 사진을 가리지 않는다
        ▸ ◀ ▶ 로 순서를 바꾼다 (첫 장은 「대표」)
        ▸ 끌어서 옮기기도 된다 (컴퓨터) */
  function photosOf(rid){
    var r = recOf(rid);
    return (r && Array.isArray(r.photos)) ? r.photos.slice() : [];
  }
  function capsOf(rid){
    var r = recOf(rid);
    return (r && Array.isArray(r.photoCaps)) ? r.photoCaps.slice() : [];
  }
  function saveOrder(rid, arr, caps){
    try{
      var patch = { photos: arr };
      if(caps) patch.photoCaps = caps;
      if(typeof updateRecord === 'function') updateRecord(rid, patch);
      setTimeout(function(){
        try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid); }catch(e){}
      }, 140);
    }catch(e){ console.error('[사진] 순서 저장 실패', e); }
  }
  /* 사진을 옮기면 그 사진의 설명도 같은 자리로 따라간다 */
  function shift(rid, i, to){
    var arr = photosOf(rid), caps = capsOf(rid);
    while(caps.length < arr.length) caps.push('');
    if(i < 0 || to < 0 || to >= arr.length || i === to) return;
    arr.splice(to, 0, arr.splice(i, 1)[0]);
    caps.splice(to, 0, caps.splice(i, 1)[0]);
    saveOrder(rid, arr, caps);
  }
  function move(rid, src, dir){
    var i = photosOf(rid).indexOf(src);
    if(i < 0) return;
    shift(rid, i, i + dir);
  }
  function moveTo(rid, src, to){
    var i = photosOf(rid).indexOf(src);
    if(i < 0) return;
    shift(rid, i, to);
  }
  /* ✎ 사진 설명 — 보고서에 그대로 옮겨 쓸 수 있게 */
  function cap(rid, src){
    var arr = photosOf(rid), caps = capsOf(rid);
    var i = arr.indexOf(src); if(i < 0) return;
    while(caps.length < arr.length) caps.push('');
    var now = String(caps[i] || '');
    var ask = (window.wlAsk && window.wlAsk.text)
      ? window.wlAsk.text('사진 설명', now, { sub:'비우면 설명을 지웁니다', ph:'예) 배전반 앞면' })
      : Promise.resolve(prompt('이 사진의 설명을 적어 주세요 (비우면 지웁니다)', now));
    ask.then(function(v){
      if(v === null || v === undefined) return;
      caps[i] = String(v).trim();
      saveOrder(rid, arr, caps);
    });
  }

  var _dragSrc = '';

  function marks(){
    var page = document.querySelector('.lf-page'); if(!page) return;
    var box = page.querySelector('.pg-pics'); if(!box) return;
    var rid = ridNow(); if(!rid) return;
    var mine = photosOf(rid);

    [].forEach.call(box.querySelectorAll('img'), function(im){
      if(im._pw) return;
      im._pw = 1;
      var src = im.getAttribute('src') || '';
      var idx = mine.indexOf(src);            /* -1 이면 스캔앱 사진 — 순서를 못 바꾼다 */

      var w = document.createElement('div');
      w.className = 'pic-w';
      im.parentNode.insertBefore(w, im);
      w.appendChild(im);

      if(idx === 0){
        var lead = document.createElement('span');
        lead.className = 'pic-lead'; lead.textContent = '대표';
        w.appendChild(lead);
      }else if(idx > 0){
        var no = document.createElement('span');
        no.className = 'pic-no'; no.textContent = String(idx + 1);
        w.appendChild(no);
      }

      var bar = document.createElement('div');
      bar.className = 'pic-bar';
      if(idx >= 0){
        bar.innerHTML =
            '<button type="button" class="pic-b" data-mv="-1"' + (idx === 0 ? ' disabled' : '')
          +   ' title="앞으로 (더 중요하게)">◀</button>'
          + '<button type="button" class="pic-b" data-mv="1"' + (idx === mine.length-1 ? ' disabled' : '')
          +   ' title="뒤로">▶</button>'
          + '<button type="button" class="pic-b" data-cap="1" title="이 사진에 설명을 답니다">✎ 설명</button>'
          + '<button type="button" class="pic-b pic-del" data-del="1" title="이 사진을 지웁니다">🗑 지우기</button>';
      }else{
        bar.innerHTML = '<span class="pic-note">스캔앱 사진</span>';
      }
      w.appendChild(bar);

      var caps = capsOf(rid);
      var ct = (idx >= 0 && caps[idx]) ? String(caps[idx]) : '';
      if(ct){
        var cd = document.createElement('div');
        cd.className = 'pic-cap'; cd.textContent = ct; cd.title = ct;
        w.insertBefore(cd, bar);
      }

      bar.addEventListener('click', function(ev){
        var b = ev.target.closest && ev.target.closest('button');
        if(!b) return;
        ev.preventDefault(); ev.stopPropagation();
        if(b.hasAttribute('data-del'))      drop(rid, src);
        else if(b.hasAttribute('data-cap'))  cap(rid, src);
        else move(rid, src, Number(b.getAttribute('data-mv')) || 0);
      });

      /* 끌어서 옮기기 (컴퓨터) */
      if(idx >= 0){
        w.setAttribute('draggable', 'true');
        w.addEventListener('dragstart', function(){ _dragSrc = src; w.classList.add('pic-drag'); });
        w.addEventListener('dragend',   function(){ _dragSrc = ''; w.classList.remove('pic-drag'); });
        w.addEventListener('dragover',  function(ev){ ev.preventDefault(); w.classList.add('pic-over'); });
        w.addEventListener('dragleave', function(){ w.classList.remove('pic-over'); });
        w.addEventListener('drop', function(ev){
          ev.preventDefault(); w.classList.remove('pic-over');
          if(!_dragSrc || _dragSrc === src) return;
          var to = photosOf(rid).indexOf(src);
          moveTo(rid, _dragSrc, to);
        });
      }
    });
  }

  function drop(rid, src){
    if(!src) return;
    var ask = (window.wlAsk && window.wlAsk.ok)
      ? window.wlAsk.ok('이 사진을 지울까요?', { sub:'되돌릴 수 없습니다', ok:'지우기', danger:1 })
      : Promise.resolve(confirm('이 사진을 지울까요?'));
    ask.then(function(yes){ if(yes) dropNow(rid, src); });
  }
  function dropNow(rid, src){
    var r = recOf(rid); if(!r) return;
    try{
      var all = Array.isArray(r.photos) ? r.photos.slice() : [];
      var caps = Array.isArray(r.photoCaps) ? r.photoCaps.slice() : [];
      var i = all.indexOf(src);
      if(i >= 0){ all.splice(i, 1); if(i < caps.length) caps.splice(i, 1); }
      var p = all;
      if(typeof updateRecord === 'function') updateRecord(rid, { photos: p, photoCaps: caps });
      if(typeof toast === 'function') toast('🗑 사진을 지웠어요');
      setTimeout(function(){
        try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid); }catch(e){}
      }, 160);
    }catch(e){
      console.error('[사진] 지우기 실패', e);
      if(typeof toast === 'function') toast('사진을 못 지웠어요: ' + (e.message || e));
    }
  }

  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:72, n:'사진 떼어내기', f:function(){
    try{ split(); marks(); }catch(e){ console.warn('[사진] 실패', e); } } });

  /* v140 — 달님 : 「사진은 본문에 그냥 들어가는데 따로 칸 만들라 했잖아」
        그리기 차례를 기다리면 사진이 본문에 한동안 남아 있는다.
        본문에 <img> 가 생기는 순간 바로 옮긴다. */
  try{
    var mo = new MutationObserver(function(m){
      var hit = false;
      for(var i=0;i<m.length && !hit;i++){
        var add = m[i].addedNodes; if(!add) continue;
        for(var j=0;j<add.length;j++){
          var n = add[j];
          if(!n || n.nodeType !== 1) continue;
          if(n.tagName === 'IMG'){ hit = true; break; }
          if(n.querySelector && n.querySelector('img')){ hit = true; break; }
        }
      }
      if(!hit) return;
      var B = document.getElementById('pgBodyTx');
      if(!B || !B.querySelector('img')) return;
      setTimeout(function(){ try{ split(); }catch(e){ console.warn('[사진] 옮기기 실패', e); } }, 120);
    });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }catch(e){ console.warn('[사진] 감시 시작 실패', e); }

  window.wlPics = {
    on:  function(){ setOn(true);  return '사진을 사진칸으로 모읍니다'; },
    off: function(){ setOn(false); return '사진을 본문에 그대로 둡니다'; },
    list:function(){ var r = recOf(ridNow()); return r ? (r.photos||[]).length + '장' : '기록을 먼저 여세요'; }
  };
  console.log('[사진] v137 준비됨 — 본문 사진을 사진칸으로 · 누르면 확대 · ✕ 로 삭제');
})();


/* ============================================================
   🖼 목록에 대표 사진 미리보기 (wlThumb)  v142-0830-1330

   달님 응용 : 「대표 사진을 목록·카드에 작은 미리보기로 띄우면
                어떤 기록인지 열지 않고도 알아본다」

   ▸ 카드(.lf-card) · 리스트(.lf-lsi) 앞에 첫 사진을 작게 붙인다
   ▸ 사진이 없는 기록은 아무것도 붙이지 않는다 (자리를 안 쓴다)
   ▸ 표(테이블)는 열이 어긋나므로 건드리지 않는다
   ▸ 「대표」로 올려 둔 사진이 곧 미리보기다 — ◀▶ 로 바꾼 순서가 그대로 반영된다
   되돌리기 : wlThumb.off()
   ============================================================ */
(function(){
  'use strict';

  var LS = 'wl_thumb';

  function isOn(){ try{ return localStorage.getItem(LS) !== '0'; }catch(e){ return true; } }
  function setOn(v){
    try{ localStorage.setItem(LS, v?'1':'0'); }catch(e){}
    if(!v) clear();
    else run();
    if(typeof toast === 'function') toast(v ? '🖼 목록에 대표 사진을 보여 줍니다' : '🖼 목록 사진을 껐어요');
  }
  function recOf(id){
    try{ return (entries||[]).filter(function(x){ return x && x.id === id; })[0] || null; }
    catch(e){ return null; }
  }
  /* 대표 사진 — 직접 넣은 것 먼저, 없으면 스캔앱 사진 */
  function lead(r){
    try{
      if(r && Array.isArray(r.photos) && r.photos.length) return String(r.photos[0] || '');
      if(r && Array.isArray(r.scanRefs)){
        for(var i=0;i<r.scanRefs.length;i++){
          var u = r.scanRefs[i] && r.scanRefs[i].data && r.scanRefs[i].data.photoUrl;
          if(u) return String(u);
        }
      }
    }catch(e){}
    return '';
  }
  function clear(){
    try{ [].forEach.call(document.querySelectorAll('.wl-th'), function(x){ x.remove(); }); }catch(e){}
  }

  var SPOTS = [
    { sel:'.lf-card[data-lid]',  at:'data-lid'  },
    { sel:'.lf-lsi[data-lsid]',  at:'data-lsid' }
  ];

  function run(){
    if(!isOn()) return;
    SPOTS.forEach(function(sp){
      [].forEach.call(document.querySelectorAll(sp.sel), function(el){
        var id = el.getAttribute(sp.at);
        if(!id) return;
        var have = el.querySelector(':scope > .wl-th');
        var src = lead(recOf(id));
        if(!src){ if(have) have.remove(); return; }
        if(have){
          if(have.getAttribute('src') !== src) have.setAttribute('src', src);
          return;
        }
        var im = document.createElement('img');
        im.className = 'wl-th';
        im.setAttribute('src', src);
        im.alt = '';
        im.loading = 'lazy';
        el.insertBefore(im, el.firstChild);
      });
    });
  }

  /* 목록은 자주 다시 그려진다 — 그려진 뒤에 따라 붙는다 */
  var t = null;
  function later(){ clearTimeout(t); t = setTimeout(function(){ try{ run(); }catch(e){ console.warn('[목록 사진]', e); } }, 160); }
  try{
    var mo = new MutationObserver(function(m){
      for(var i=0;i<m.length;i++){
        var add = m[i].addedNodes; if(!add || !add.length) continue;
        for(var j=0;j<add.length;j++){
          var n = add[j];
          if(!n || n.nodeType !== 1) continue;
          if(n.classList && n.classList.contains('wl-th')) continue;   /* 내가 붙인 것은 무시 */
          later(); return;
        }
      }
    });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }catch(e){ console.warn('[목록 사진] 감시 실패', e); }
  setTimeout(run, 1800);
  setTimeout(run, 4200);

  window.wlThumb = {
    on:  function(){ setOn(true);  return '목록에 대표 사진을 보여 줍니다'; },
    off: function(){ setOn(false); return '목록 사진을 껐습니다'; },
    now: run
  };
  console.log('[목록 사진] v142 준비됨 — 카드·리스트 앞에 대표 사진');
})();


/* ============================================================
   💬 앱 안에서 묻기 (wlAsk)  v145-0830-1430

   달님 : 「무언가를 칠 때 인터넷창 위에 나오게 하지 말고 pop 스타일로」

   브라우저가 띄우는 prompt/confirm 은 주소창 아래 붙어 나와 앱과 따로 논다.
   같은 일을 앱 한가운데 팝업으로 한다.

     await wlAsk.text('설명을 적어 주세요', '지금 값')   → 글자 또는 null(취소)
     await wlAsk.ok('지울까요?', {ok:'지우기', danger:1}) → true / false

   ⚠ 브라우저 confirm/alert 은 「멈춰서 답을 기다리는」 방식이라
     앱 전체를 한 번에 바꿀 수 없다. 새로 만드는 곳부터 이걸 쓴다.
   ============================================================ */
(function(){
  'use strict';

  function ES(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function build(){
    var ov = document.getElementById('wlAskOv');
    if(ov) return ov;
    ov = document.createElement('div');
    ov.id = 'wlAskOv'; ov.className = 'wlask-ov';
    ov.innerHTML =
        '<div class="wlask" role="dialog" aria-modal="true">'
      +   '<div class="wlask-t"></div>'
      +   '<div class="wlask-s"></div>'
      +   '<input type="text" class="wlask-in" autocomplete="off">'
      +   '<div class="wlask-b">'
      +     '<button type="button" class="wlask-no">취소</button>'
      +     '<button type="button" class="wlask-yes">확인</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(ov);
    return ov;
  }

  function open(opt){
    return new Promise(function(done){
      var ov = build();
      var box  = ov.querySelector('.wlask');
      var tEl  = ov.querySelector('.wlask-t');
      var sEl  = ov.querySelector('.wlask-s');
      var inEl = ov.querySelector('.wlask-in');
      var yes  = ov.querySelector('.wlask-yes');
      var no   = ov.querySelector('.wlask-no');

      tEl.textContent = opt.title || '';
      sEl.textContent = opt.sub || '';
      sEl.style.display = opt.sub ? 'block' : 'none';

      var isText = (opt.kind === 'text');
      inEl.style.display = isText ? 'block' : 'none';
      inEl.value = isText ? String(opt.value == null ? '' : opt.value) : '';
      if(opt.ph) inEl.placeholder = opt.ph;

      yes.textContent = opt.ok || '확인';
      no.textContent  = opt.no || '취소';
      yes.className = 'wlask-yes' + (opt.danger ? ' danger' : '');

      var closed = false;
      function fin(v){
        if(closed) return; closed = true;
        ov.classList.remove('on');
        document.removeEventListener('keydown', onKey, true);
        setTimeout(function(){ done(v); }, 10);
      }
      function onKey(ev){
        if(ev.key === 'Escape'){ ev.preventDefault(); fin(isText ? null : false); }
        else if(ev.key === 'Enter' && (isText || document.activeElement === yes)){
          ev.preventDefault(); fin(isText ? inEl.value : true);
        }
      }
      yes.onclick = function(){ fin(isText ? inEl.value : true); };
      no.onclick  = function(){ fin(isText ? null : false); };
      ov.onmousedown = function(ev){ if(ev.target === ov) fin(isText ? null : false); };
      document.addEventListener('keydown', onKey, true);

      ov.classList.add('on');
      setTimeout(function(){
        try{ if(isText){ inEl.focus(); inEl.select(); } else yes.focus(); }catch(e){}
      }, 40);
    });
  }

  window.wlAsk = {
    text: function(title, value, opt){
      opt = opt || {};
      return open({ kind:'text', title:title, sub:opt.sub, value:value, ph:opt.ph,
                    ok:opt.ok || '저장', no:opt.no || '취소' });
    },
    ok: function(title, opt){
      opt = opt || {};
      return open({ kind:'ok', title:title, sub:opt.sub,
                    ok:opt.ok || '확인', no:opt.no || '취소', danger:opt.danger });
    }
  };
  console.log('[묻기 창] v145 준비됨 — 브라우저 창 대신 앱 안 팝업 (wlAsk)');
})();


/* ============================================================
   📱 핸드폰에서 탭으로 나눠 보기 (wlMobTab)  v148-0830-1600

   달님 : 「핸드폰에서 하나씩 세로로 나열돼 스크롤만 내려야 해」

   실측(아이폰 폭 390) : 페이지 높이가 화면의 4.1배였다.
   ▸ 칸을 한 줄로 세우고 2열로 놓아 2.8배까지 줄였다 (CSS)
   ▸ 여기서 「칸 · 본문 · 첨부」를 탭으로 나눠 한 번에 하나만 보여 준다

   ⚠ 숨기는 것은 클래스로만 한다 — 다른 모듈이 style.display 를 만지므로
     같은 걸 건드리면 서로 지운다 (v137 wlFold 에서 겪은 것과 같은 함정)
   되돌리기 : wlMobTab.off()
   ============================================================ */
(function(){
  'use strict';

  var LS = 'wl_mobtab';
  var W  = 640;                       /* 이 폭 아래에서만 나눈다 */

  var TABS = [
    { k:'p', i:'📋', n:'칸' },
    { k:'b', i:'📝', n:'본문' },
    { k:'a', i:'📎', n:'첨부' }
  ];

  function isOn(){ try{ return localStorage.getItem(LS) !== '0'; }catch(e){ return true; } }
  function setOn(v){
    try{ localStorage.setItem(LS, v?'1':'0'); }catch(e){}
    clear(); if(v) run();
    if(typeof toast === 'function') toast(v ? '📱 핸드폰에서 탭으로 나눠 봅니다' : '📱 예전처럼 쭉 이어 봅니다');
  }
  function narrow(){ try{ return (window.innerWidth || 0) <= W; }catch(e){ return false; } }
  function cur(){ try{ return sessionStorage.getItem('wl_mobtab_cur') || 'p'; }catch(e){ return 'p'; } }
  function setCur(k){ try{ sessionStorage.setItem('wl_mobtab_cur', k); }catch(e){} }

  function clear(){
    try{
      var bar = document.getElementById('pgMobTab');
      if(bar) bar.remove();
      [].forEach.call(document.querySelectorAll('.mt-hide'), function(el){ el.classList.remove('mt-hide'); });
    }catch(e){}
  }

  /* 오른쪽 칸의 자식들을 「본문 것 / 첨부 것」으로 가른다 */
  function sortRight(list){
    var out = { b:[], a:[] };
    var mode = 'a';
    list.forEach(function(el){
      var t = (el.textContent || '');
      if(el.classList && el.classList.contains('pg-sec')){
        if(/본문/.test(t)) mode = 'b';
        else mode = 'a';                       /* 사진·하위 항목·파일 링크 */
      }
      out[mode].push(el);
    });
    return out;
  }

  function run(){
    if(!isOn() || !narrow()){ clear(); return; }
    var page = document.querySelector('.lf-page');
    if(!page) return;
    var body = page.querySelector('.pg-body');
    if(!body) return;

    /* 어떤 요소가 어느 탭인가 */
    var left = [], right = [];
    var two = body.querySelector('.pg-2col');
    if(two){
      var L = two.querySelector('.pg-2l'), R = two.querySelector('.pg-2r');
      if(L) left  = [].slice.call(L.children);
      if(R) right = [].slice.call(R.children);
    }else{
      var props = body.querySelector(':scope > .pg-props');
      if(!props) return;
      left = [props];
      var n = props.nextElementSibling;
      if(n && n.id === 'pgSecBar'){ left.push(n); n = n.nextElementSibling; }
      while(n){ right.push(n); n = n.nextElementSibling; }
    }
    if(!right.length){ clear(); return; }

    var g = sortRight(right);
    var side = page.querySelector('.pg-side');
    if(side && g.b.indexOf(side) >= 0){ /* 곁상자(시각)는 칸 쪽으로 */
      g.b = g.b.filter(function(x){ return x !== side; });
      left.push(side);
    }else if(side && g.a.indexOf(side) >= 0){
      g.a = g.a.filter(function(x){ return x !== side; });
      left.push(side);
    }

    var k = cur();
    var map = { p:left, b:g.b, a:g.a };

    /* 탭 줄 만들기 (제목 바로 아래) */
    var bar = document.getElementById('pgMobTab');
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'pgMobTab'; bar.className = 'pg-mobtab';
      var ttl = body.querySelector('.pg-title');
      if(ttl && ttl.nextSibling) body.insertBefore(bar, ttl.nextSibling);
      else body.insertBefore(bar, body.firstChild);
      bar.addEventListener('click', function(ev){
        var b2 = ev.target.closest && ev.target.closest('[data-mt]');
        if(!b2) return;
        setCur(b2.getAttribute('data-mt'));
        run();
        try{ window.scrollTo({ top:0, behavior:'smooth' }); }catch(e){}
      });
    }
    var cnt = { p:left.length, b:g.b.length, a:g.a.length };
    var html = TABS.map(function(t){
      return '<button type="button" data-mt="' + t.k + '"'
           + (k === t.k ? ' class="on"' : '') + (cnt[t.k] ? '' : ' disabled')
           + '>' + t.i + ' ' + t.n + '</button>';
    }).join('');
    if(bar.innerHTML !== html) bar.innerHTML = html;

    /* 고른 탭만 남기고 나머지는 클래스로 감춘다 */
    ['p','b','a'].forEach(function(key){
      (map[key] || []).forEach(function(el){
        if(!el || !el.classList) return;
        el.classList.toggle('mt-hide', key !== k);
      });
    });
  }

  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:80, n:'핸드폰 탭', f:function(){
    try{ run(); }catch(e){ console.warn('[핸드폰 탭] 실패', e); } } });

  var rz = null;
  window.addEventListener('resize', function(){
    clearTimeout(rz);
    rz = setTimeout(function(){ try{ run(); }catch(e){} }, 250);
  });

  window.wlMobTab = {
    on:  function(){ setOn(true);  return '핸드폰에서 탭으로 나눠 봅니다'; },
    off: function(){ setOn(false); return '예전처럼 쭉 이어 봅니다'; },
    go:  function(k){ setCur(k); run(); return k; }
  };
  console.log('[핸드폰 탭] v148 준비됨 — 좁은 화면에서 칸 · 본문 · 첨부를 탭으로');
})();


/* ============================================================
   💰 데이터 탭 지출에도 월별 합계 (wlExpStats)  v149-0830-1700

   달님 : 「지출 월별 합계 표를 데이터 탭으로 옮기자」

   v130에서 위 줄 지출 탭을 데이터 탭으로 보내면서, 지출 탭에만 있던
   「이번 달 개인지출 / 세금계산서」 요약 카드가 안 보이게 됐다.
   그래서 「탭 하나로」를 껐다 켰다 해야 했다. 그 카드를 여기에도 그린다.

   ▸ 데이터 탭에서 「💰 지출」 을 보고 있을 때만 목록 위에 나온다
   ▸ 계산은 원래 함수(renderExpenseStats)를 그대로 쓴다 — 숫자가 갈리지 않게
   되돌리기 : wlExpStats.off()
   ============================================================ */
(function(){
  'use strict';

  var LS = 'wl_expstats';
  var ID = 'wlExpStatsBox';

  function isOn(){ try{ return localStorage.getItem(LS) !== '0'; }catch(e){ return true; } }
  function setOn(v){
    try{ localStorage.setItem(LS, v?'1':'0'); }catch(e){}
    run();
    if(typeof toast === 'function') toast(v ? '💰 데이터 탭 지출에 월별 합계를 보여 줍니다' : '💰 월별 합계를 껐어요');
  }

  /* 지금 데이터 탭에서 지출을 보고 있나 */
  function onExpense(){
    try{
      var host = document.getElementById('dataHost');
      if(!host || !host.innerHTML) return false;
      if(host.offsetParent === null) return false;              /* 화면에 없으면 아니다 */
      var k = '';
      try{ k = (window.wlUser && window.wlUser.kind) ? (window.wlUser.kind() || '') : ''; }catch(e){}
      if(!k){ try{ k = String(localStorage.getItem('wl_ds_last') || '').replace(/^["'\\]+|["'\\]+$/g,'').trim(); }catch(e){} }
      return k === 'expense';
    }catch(e){ return false; }
  }

  function run(){
    var old = document.getElementById(ID);
    if(!isOn() || !onExpense()){ if(old) old.remove(); return; }

    var host = document.getElementById('dataHost');
    if(!host) return;

    var box = old;
    if(!box || box.parentNode !== host.parentNode){
      if(box) box.remove();
      box = document.createElement('div');
      box.id = ID; box.className = 'wl-expstats';
      host.parentNode.insertBefore(box, host);                  /* 목록 바로 위 */
    }
    try{
      if(typeof renderExpenseStats === 'function') renderExpenseStats(box);
      else if(typeof window.renderExpenseStats === 'function') window.renderExpenseStats(box);
      else { box.remove(); return; }
    }catch(e){
      console.warn('[지출 합계] 그리기 실패', e);
      box.remove();
    }
  }

  /* 목록이 다시 그려질 때 따라 붙는다 */
  var t = null;
  function later(){ clearTimeout(t); t = setTimeout(function(){ try{ run(); }catch(e){ console.warn('[지출 합계]', e); } }, 200); }
  try{
    var mo = new MutationObserver(function(m){
      for(var i=0;i<m.length;i++){
        var add = m[i].addedNodes; if(!add || !add.length) continue;
        for(var j=0;j<add.length;j++){
          var n = add[j];
          if(!n || n.nodeType !== 1) continue;
          if(n.id === ID || (n.closest && n.closest('#' + ID))) continue;   /* 내가 만든 것은 무시 */
          later(); return;
        }
      }
    });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }catch(e){ console.warn('[지출 합계] 감시 실패', e); }
  document.addEventListener('click', function(ev){
    try{ if(ev.target.closest && ev.target.closest('[data-dsk],[data-v43tab]')) later(); }catch(e){}
  }, true);
  setTimeout(run, 2000);
  setTimeout(run, 4500);

  window.wlExpStats = {
    on:  function(){ setOn(true);  return '데이터 탭 지출에 월별 합계를 보여 줍니다'; },
    off: function(){ setOn(false); return '월별 합계를 껐습니다'; },
    now: run
  };
  console.log('[지출 합계] v149 준비됨 — 데이터 탭 「지출」 위에 이번 달 요약');
})();


/* ============================================================
   📦 덩치 큰 종류를 별도 컬렉션으로 — 옮기기 도구 (wlSplit)  v149-0830-1700

   달님 : 「kind 26종 중 지출·자재·입출고를 별도 컬렉션으로. 이건 해야 해」

   ⚠ 데이터를 옮기는 일이라 절대 저절로 하지 않는다. 달님이 눌러야 움직인다.
     그리고 「복사 → 대조 → 지우기」 순서를 어기지 않는다.
     복사만 해 두면 두 곳에 다 있어 아무것도 잃지 않는다.

     1걸음 (이미 켜짐) : 새 기록은 새 컬렉션에, 읽기는 네 곳을 합쳐서
     2걸음 wlSplit.copy()  : 옛 자리의 지출·자재·입출고를 새 컬렉션으로 복사
     3걸음 wlSplit.check() : 양쪽 숫자 대조
     4걸음 wlSplit.clean() : 대조가 맞을 때만 옛 자리에서 지움

   되돌리기 : wlSplit.off()  → 전부 예전 한 곳만 쓴다 (복사본은 남아 있어 무해)
   ============================================================ */
(function(){
  'use strict';

  var KINDS = ['expense','item','stock'];

  function on(){ try{ return localStorage.getItem('wl_col_split') !== '0'; }catch(e){ return true; } }
  function ready(){
    if(typeof db === 'undefined' || !db){ console.warn('[나누기] 클라우드가 아직 준비되지 않았습니다'); return false; }
    if(typeof online === 'undefined' || !online){ console.warn('[나누기] 인터넷이 연결돼야 합니다'); return false; }
    return true;
  }

  /* 옛 자리(worklog_entries)에 남아 있는 옮길 것들 */
  function oldOnes(){
    try{
      return (entries||[]).filter(function(e){ return e && KINDS.indexOf(e.kind) >= 0; });
    }catch(e){ return []; }
  }

  /* ── 2걸음 : 복사 (지우지 않는다) ── */
  async function copy(){
    if(!ready()) return '준비 안 됨';
    var src = COL;
    var moved = 0, fail = 0, skip = 0;
    var snap;
    try{ snap = await db.collection(src).get(); }
    catch(e){ console.error('[나누기] 옛 자리를 못 읽었어요', e); return '옛 자리를 못 읽었습니다'; }

    var rows = snap.docs.map(function(d){ return { id:d.id, data:d.data() }; });
    var todo = rows.filter(function(r){ return KINDS.indexOf(String(r.data.kind||'')) >= 0; });
    if(!todo.length) return '옮길 것이 없습니다 (옛 자리에 지출·자재·입출고가 없음)';

    console.log('[나누기] 옮길 것 ' + todo.length + '건 — 복사를 시작합니다 (지우지 않습니다)');
    for(var i = 0; i < todo.length; i++){
      var r = todo[i];
      var to = COL_SPLIT[String(r.data.kind)];
      if(!to){ skip++; continue; }
      try{
        await db.collection(to).doc(r.id).set(r.data);
        moved++;
      }catch(e){
        fail++;
        console.warn('[나누기] ' + r.id + ' 복사 실패', e);
      }
      if(i % 25 === 24) await new Promise(function(ok){ setTimeout(ok, 400); });  /* 몰아치지 않게 쉬어 간다 */
    }
    var msg = '복사 끝 — 옮김 ' + moved + '건 · 실패 ' + fail + '건 · 건너뜀 ' + skip + '건';
    console.log('[나누기] ' + msg + ' / 옛 자리는 그대로 있습니다. wlSplit.check() 로 대조하세요');
    if(typeof toast === 'function') toast('📦 ' + msg);
    return msg;
  }

  /* ── 3걸음 : 대조 ── */
  async function check(){
    if(!ready()) return '준비 안 됨';
    var out = [];
    var okAll = true;
    for(var i = 0; i < KINDS.length; i++){
      var k = KINDS[i], to = COL_SPLIT[k];
      var a = 0, b = 0;
      try{
        var s1 = await db.collection(COL).get();
        a = s1.docs.filter(function(d){ return String((d.data()||{}).kind||'') === k; }).length;
      }catch(e){ console.warn('[나누기] 옛 자리 세기 실패', e); okAll = false; }
      try{
        var s2 = await db.collection(to).get();
        b = s2.docs.length;
      }catch(e){ console.warn('[나누기] ' + to + ' 세기 실패', e); okAll = false; }
      if(b < a) okAll = false;
      out.push({ 종류:k, 옛자리:a, 새자리:b, 상태:(b >= a ? '✅ 다 옮겨짐' : '⚠ 모자람 — 복사를 다시') });
    }
    try{ console.table(out); }catch(e){ console.log(out); }
    console.log(okAll ? '[나누기] 대조 통과 — wlSplit.clean() 으로 옛 자리를 정리할 수 있습니다'
                      : '[나누기] 아직 맞지 않습니다 — wlSplit.copy() 를 다시 하세요');
    return out;
  }

  /* ── 4걸음 : 옛 자리 정리 (대조가 맞을 때만) ── */
  async function clean(force){
    if(!ready()) return '준비 안 됨';
    var res = await check();
    var bad = (res || []).filter(function(r){ return r.새자리 < r.옛자리; });
    if(bad.length && !force){
      console.warn('[나누기] 아직 다 안 옮겨졌습니다 — 정리하지 않습니다', bad);
      return '아직 다 안 옮겨졌습니다 — 먼저 wlSplit.copy()';
    }
    var ask = (window.wlAsk && window.wlAsk.ok)
      ? await window.wlAsk.ok('옛 자리에서 지출·자재·입출고를 지울까요?',
          { sub:'새 자리에 복사가 끝난 것만 지웁니다 · 되돌릴 수 없습니다', ok:'정리하기', danger:1 })
      : confirm('옛 자리에서 지울까요? 되돌릴 수 없습니다.');
    if(!ask) return '그만두었습니다';

    var snap;
    try{ snap = await db.collection(COL).get(); }
    catch(e){ console.error('[나누기] 옛 자리를 못 읽었어요', e); return '못 읽었습니다'; }
    var todo = snap.docs.filter(function(d){ return KINDS.indexOf(String((d.data()||{}).kind||'')) >= 0; });
    var done = 0, fail = 0;
    for(var i = 0; i < todo.length; i++){
      var d = todo[i];
      var to = COL_SPLIT[String((d.data()||{}).kind)];
      try{
        var chk = await db.collection(to).doc(d.id).get();
        if(!chk.exists){ fail++; console.warn('[나누기] 새 자리에 없어 안 지웁니다: ' + d.id); continue; }
        await db.collection(COL).doc(d.id).delete();
        done++;
      }catch(e){ fail++; console.warn('[나누기] ' + d.id + ' 정리 실패', e); }
      if(i % 25 === 24) await new Promise(function(ok){ setTimeout(ok, 400); });
    }
    var msg = '옛 자리 정리 끝 — 지움 ' + done + '건 · 남김 ' + fail + '건';
    console.log('[나누기] ' + msg);
    if(typeof toast === 'function') toast('📦 ' + msg);
    return msg;
  }

  window.wlSplit = {
    on:  function(){ try{ localStorage.setItem('wl_col_split','1'); }catch(e){}
                     return '지출·자재·입출고를 별도 컬렉션에 씁니다 (새로고침 뒤 적용)'; },
    off: function(){ try{ localStorage.setItem('wl_col_split','0'); }catch(e){}
                     return '예전처럼 한 곳만 씁니다 (새로고침 뒤 적용) — 복사본은 남아 있어 무해합니다'; },
    state: function(){
      var o = oldOnes();
      return { 나누기:on()?'켜짐':'꺼짐', 지금기록:(entries||[]).length,
               옛자리에남은_지출자재입출고:o.length,
               다음: o.length ? 'wlSplit.copy() → wlSplit.check() → wlSplit.clean()' : '옮길 것 없음' };
    },
    copy:  copy,
    check: check,
    clean: clean
  };
  console.log('[나누기] v149 준비됨 — ' + (on()?'켜짐':'꺼짐') + ' / wlSplit.state() 로 지금 상태를 봅니다');
})();

/* ============================================================
   📏 문서용 실측표 (wlDocStat)  v151-0830-1725

   달님 : 「문서가 자꾸 밀리니, 앱이 스스로 세서 표로 뽑아줘」

   앱이 자기 파일 3개를 직접 읽어서
     ▸ 행수·용량        ▸ HTML 블록 지도(줄번호)
     ▸ worklog.js 모듈 지도(줄번호)   ▸ 창구(window.wlXxx) 목록
   를 세고, 구조설명서에 그대로 붙여넣을 수 있는 표를 만든다.

   쓰는 법
     wlDocStat()        → 콘솔에 표로 본다
     wlDocStat.md()     → 붙여넣기용 글을 만들고 클립보드에 복사
     wlDocStat.panel()  → 화면에 창으로 띄우고 [복사] 단추

   ⚠ 파일을 읽기만 한다. 아무것도 고치지 않는다.
   ============================================================ */
(function(){
  'use strict';

  var CACHE = null;

  function ver(){ try{ return String(window.APP_VERSION || ''); }catch(e){ return ''; } }

  /* 파일 3개의 실제 주소 — 화면이 쓰고 있는 것 그대로 (캐시를 타서 빠르다) */
  function urls(){
    var js = '', css = '', html = location.pathname || 'worklog.html';
    try{
      var t = document.querySelector('script[src*="worklog.js"]');
      if(t) js = t.getAttribute('src');
    }catch(e){}
    try{
      var l = document.getElementById('main-css') ||
              document.querySelector('link[href*="worklog.css"]');
      if(l) css = l.getAttribute('href');
    }catch(e){}
    return { html: html, js: js || 'worklog.js', css: css || 'worklog.css' };
  }

  function grab(u){
    return fetch(u, { cache:'force-cache' })
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); })
      .catch(function(){ return fetch(u).then(function(r){ return r.text(); }); });
  }

  function kb(n){ return Math.round(n/1024); }
  function mb(n){ return Math.round(n/1024/1024*100)/100; }
  /* 파일이 실제로 차지하는 바이트 — 한글은 한 글자가 3바이트라 .length 로 세면 작게 나온다 */
  function bytes(t){ try{ return new Blob([t]).size; }catch(e){ return t.length; } }

  /* 글자 위치 → 줄 번호 */
  function lineIndex(txt){
    var at = [0], i = 0;
    while(true){ i = txt.indexOf('\n', i); if(i < 0) break; i++; at.push(i); }
    return function(pos){
      var lo = 0, hi = at.length - 1;
      while(lo < hi){ var mid = (lo + hi + 1) >> 1; if(at[mid] <= pos) lo = mid; else hi = mid - 1; }
      return lo + 1;
    };
  }

  /* 배너 주석에서 이름 한 줄 뽑기 */
  function bannerName(body){
    var m = body.slice(0, 4000).match(/\/\*[\s\S]{0,600}?\*\//);
    if(m){
      var ls = m[0].replace(/^\/\*+|\*+\/$/g, '').split('\n');
      for(var i = 0; i < ls.length; i++){
        var s = ls[i].replace(/^[\s*]+/, '').replace(/[\s*]+$/, '');
        if(!s) continue;
        if(/^[=═─\-_]+$/.test(s)) continue;
        if(s.length < 3) continue;
        return s.slice(0, 70);
      }
    }
    var c = body.slice(0, 1500).match(/\/\/\s*(.{4,70})/);
    return c ? c[1].trim() : '';
  }

  /* ── HTML 안 블록 지도 ── */
  function htmlBlocks(html){
    var ln = lineIndex(html), out = [], re = /<(script|style)([^>]*)>/gi, m;
    while((m = re.exec(html))){
      var tag = m[1].toLowerCase(), attrs = m[2] || '';
      if(/\bsrc\s*=/.test(attrs)) continue;                 /* 바깥 파일은 뺀다 */
      var end = html.indexOf('</' + tag + '>', m.index + m[0].length);
      if(end < 0) continue;
      var body = html.slice(m.index + m[0].length, end);
      out.push({
        시작: ln(m.index), 끝: ln(end), 행수: ln(end) - ln(m.index),
        종류: (tag === 'style' ? '스타일' : '기능'),
        이름: bannerName(body)
      });
    }
    return out;
  }

  /* ── worklog.js 모듈 지도 (배너로 나뉜 구역) ── */
  function jsBlocks(js){
    var lines = js.split('\n'), starts = [], i;
    for(i = 0; i < lines.length; i++){
      if(/^\/\*\s*[=═]{6,}/.test(lines[i])) starts.push(i);
    }
    var out = [];
    for(i = 0; i < starts.length; i++){
      var a = starts[i], b = (i + 1 < starts.length ? starts[i + 1] : lines.length);
      var t = '';
      for(var k = a + 1; k < Math.min(a + 6, lines.length); k++){
        var s = lines[k].replace(/^[\s*]+/, '').replace(/[\s*]+$/, '');
        if(s && !/^[=═─\-_]+$/.test(s)){ t = s; break; }
      }
      out.push({ 시작: a + 1, 끝: b, 행수: b - a, 이름: t.slice(0, 70) });
    }
    return out;
  }

  /* ── 밖으로 열어 둔 창구 ── */
  function exports_(js){
    /* ⚠ =(대입) 만 센다.  ===(비교) 와 =>(화살표) 를 대입으로 세면
          「window.wlSumNow === 'function'」 같은 확인문이 창구로 잡혀
          엉뚱한 줄 번호가 나온다 (v150 에서 실제로 그랬다). */
    var ln = lineIndex(js), out = [], re = /window\.(wl[A-Za-z0-9_]+)\s*=(?![=>])/g, m, seen = {};
    while((m = re.exec(js))){
      if(seen[m[1]]){ seen[m[1]]++; continue; }
      seen[m[1]] = 1;
      out.push({ 창구: m[1], 줄: ln(m.index) });
    }
    /* 같은 이름에 두 번 이상 대입 — 일부러 감싼 것일 수도, 앞의 것이 죽은 것일 수도 있다.
          (openEditor · wlSelfCheck 처럼 일부러 겹친 것은 정상이다 — 눈으로 한 번 확인만) */
    out.forEach(function(r){ if(seen[r.창구] > 1) r.겹침 = seen[r.창구] + '겹 (감싼 것인지 확인)'; });
    out.sort(function(a, b){ return a.줄 - b.줄; });
    return out;
  }

  /* ── 중괄호 짝 (CSS 가 죽지 않았나) ── */
  function braces(html, css){
    var out = [], re = /<style([^>]*)>([\s\S]*?)<\/style>/gi, m, n = 0;
    while((m = re.exec(html))){
      n++;
      var b = m[2];
      var o = (b.match(/\{/g) || []).length, c = (b.match(/\}/g) || []).length;
      if(!o && !c) continue;                       /* 빈 블록은 뺀다 */
      out.push({ 곳: 'html style ' + n, 여는것: o, 닫는것: c, 상태: (o === c ? '✅' : '🔴 안 맞음') });
    }
    var o2 = (css.match(/\{/g) || []).length, c2 = (css.match(/\}/g) || []).length;
    out.push({ 곳: 'worklog.css', 여는것: o2, 닫는것: c2, 상태: (o2 === c2 ? '✅' : '🔴 안 맞음') });
    return out;
  }

  /* ── 다 모으기 ── */
  function collect(){
    var u = urls();
    return Promise.all([grab(u.html), grab(u.js), grab(u.css)]).then(function(r){
      var html = r[0], js = r[1], css = r[2];
      var hb = htmlBlocks(html);
      var inl = hb.filter(function(x){ return x.종류 === '기능'; }).length;
      var sty = hb.filter(function(x){ return x.종류 === '스타일' && x.행수 > 1; }).length;
      var L = function(s){ return s.split('\n').length; };
      var Bh = bytes(html), Bj = bytes(js), Bc = bytes(css);
      CACHE = {
        버전: ver(),
        잰때: (function(){ try{ return kstNow().toISOString().slice(0,16).replace('T',' '); }
                          catch(e){ return new Date().toISOString().slice(0,16).replace('T',' '); } })(),
        규모: [
          { 파일:'worklog.html', 행수:L(html), 용량KB:kb(Bh), 비고:'인라인 기능 '+inl+'개 · 스타일 '+sty+'개' },
          { 파일:'worklog.js',   행수:L(js),   용량KB:kb(Bj), 비고:'모듈 구역 '+jsBlocks(js).length+'개' },
          { 파일:'worklog.css',  행수:L(css),  용량KB:kb(Bc), 비고:'' },
          { 파일:'합계',         행수:L(html)+L(js)+L(css),
            용량KB:kb(Bh+Bj+Bc),
            비고:'약 '+mb(Bh+Bj+Bc)+'MB' }
        ],
        html구역: hb,
        js구역: jsBlocks(js),
        창구: exports_(js),
        중괄호: braces(html, css)
      };
      return CACHE;
    });
  }

  /* ── 붙여넣기용 글 ── */
  function toMd(d){
    var s = [];
    s.push('<!-- ' + d.버전 + ' · ' + d.잰때 + ' 실측 (wlDocStat) -->');
    s.push('');
    s.push('## 1. 한눈에 보는 규모');
    s.push('');
    s.push('| 파일 | 행수 | 용량 | 비고 |');
    s.push('|---|---|---|---|');
    d.규모.forEach(function(r){
      s.push('| ' + r.파일 + ' | ' + r.행수.toLocaleString() + '행 | ' + r.용량KB + 'KB | ' + r.비고 + ' |');
    });
    s.push('');
    s.push('## 3-A. worklog.html 구역 지도');
    s.push('');
    s.push('| 줄 번호 | 크기 | 구역 이름 |');
    s.push('|---|---|---|');
    d.html구역.forEach(function(r){
      if(r.행수 < 30) return;
      s.push('| ' + r.시작 + '–' + r.끝 + ' | ' + r.행수.toLocaleString() +
             ' | ' + (r.종류 === '스타일' ? '(스타일) ' : '') + r.이름 + ' |');
    });
    s.push('');
    s.push('## 3-B. worklog.js 모듈 지도');
    s.push('');
    s.push('| 줄 번호 | 크기 | 모듈 |');
    s.push('|---|---|---|');
    d.js구역.forEach(function(r){
      if(r.행수 < 30) return;
      s.push('| ' + r.시작 + '–' + r.끝 + ' | ' + r.행수.toLocaleString() + ' | ' + r.이름 + ' |');
    });
    s.push('');
    s.push('## 창구 (window.wlXxx) ' + d.창구.length + '개');
    s.push('');
    s.push(d.창구.map(function(r){ return r.창구 + '(' + r.줄 + ')' + (r.겹침 ? '📎' : ''); }).join(' · '));
    var dup = d.창구.filter(function(r){ return r.겹침; });
    if(dup.length){
      s.push('');
      s.push('> 📎 두 번 이상 대입된 창구 — 일부러 감싼 것이면 정상, 아니면 앞의 것이 죽습니다: ' +
             dup.map(function(r){ return r.창구 + ' ' + r.겹침; }).join(' · '));
    }
    s.push('');
    s.push('## 중괄호 짝');
    s.push('');
    s.push(d.중괄호.map(function(r){ return r.곳 + ' ' + r.여는것 + '/' + r.닫는것 + ' ' + r.상태; }).join(' · '));
    return s.join('\n');
  }

  function copyText(t){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        return navigator.clipboard.writeText(t).then(function(){ return true; }).catch(function(){ return false; });
      }
    }catch(e){}
    return Promise.resolve(false);
  }

  /* ── 콘솔에 보기 ── */
  function run(){
    return collect().then(function(d){
      console.log('%c📏 ' + d.버전 + ' 실측 (' + d.잰때 + ')', 'font-weight:bold;font-size:13px');
      try{
        console.table(d.규모);
        console.table(d.html구역.filter(function(r){ return r.행수 >= 30; }));
        console.table(d.js구역.filter(function(r){ return r.행수 >= 30; }));
        console.table(d.중괄호);
      }catch(e){ console.log(d); }
      var bad = d.중괄호.filter(function(r){ return r.상태.indexOf('🔴') === 0; });
      if(bad.length) console.warn('[실측] 🔴 중괄호 짝이 안 맞습니다 — 디자인이 죽었을 수 있어요', bad);
      console.log('[실측] 창구 ' + d.창구.length + '개 · 붙여넣기용은 wlDocStat.md() / 창으로 보려면 wlDocStat.panel()');
      return d;
    });
  }

  /* ── 화면 창 (달님용) ── */
  function panel(){
    return collect().then(function(d){
      var md = toMd(d);
      var old = document.getElementById('wlDocStatOv');
      if(old) old.remove();
      var ov = document.createElement('div');
      ov.id = 'wlDocStatOv';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(20,24,32,.45);z-index:99999;' +
        'display:flex;align-items:center;justify-content:center;padding:16px';
      var bx = document.createElement('div');
      bx.style.cssText = 'background:#fff;border-radius:16px;max-width:900px;width:100%;max-height:88vh;' +
        'display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.28);overflow:hidden';
      var hd = document.createElement('div');
      hd.style.cssText = 'padding:16px 18px;border-bottom:1px solid #e8ecf2;display:flex;' +
        'align-items:center;gap:10px;flex-wrap:wrap';
      hd.innerHTML = '<b style="font-size:16px">📏 문서용 실측표</b>' +
        '<span style="color:#7b8794;font-size:13px">' + d.버전 + ' · ' + d.잰때 + '</span>';
      var sp = document.createElement('div'); sp.style.cssText = 'flex:1';
      var bCopy = document.createElement('button');
      bCopy.textContent = '📋 복사';
      bCopy.style.cssText = 'border:none;background:#3f7cb8;color:#fff;border-radius:10px;' +
        'padding:11px 18px;font-size:14px;font-family:inherit;cursor:pointer;min-height:44px';
      var bClose = document.createElement('button');
      bClose.textContent = '닫기';
      bClose.style.cssText = 'border:1px solid #d7dee8;background:#f7f9fc;border-radius:10px;' +
        'padding:11px 18px;font-size:14px;font-family:inherit;cursor:pointer;min-height:44px';
      hd.appendChild(sp); hd.appendChild(bCopy); hd.appendChild(bClose);
      var ta = document.createElement('textarea');
      ta.value = md;
      ta.readOnly = true;
      ta.style.cssText = 'flex:1;border:none;outline:none;padding:16px 18px;font-size:13px;' +
        'line-height:1.6;font-family:ui-monospace,Menlo,Consolas,monospace;resize:none;background:#fbfcfe';
      bClose.addEventListener('click', function(){ ov.remove(); });
      ov.addEventListener('click', function(e){ if(e.target === ov) ov.remove(); });
      bCopy.addEventListener('click', function(){
        copyText(md).then(function(ok){
          if(!ok){ ta.select(); try{ document.execCommand('copy'); ok = true; }catch(e){} }
          bCopy.textContent = ok ? '✅ 복사됨' : '⚠ 직접 선택해 주세요';
          setTimeout(function(){ bCopy.textContent = '📋 복사'; }, 1800);
        });
      });
      bx.appendChild(hd); bx.appendChild(ta); ov.appendChild(bx);
      document.body.appendChild(ov);
      return '창을 띄웠습니다';
    });
  }

  var API = function(){ return run(); };
  API.md = function(){
    return collect().then(function(d){
      var t = toMd(d);
      console.log(t);
      return copyText(t).then(function(ok){
        console.log(ok ? '[실측] 클립보드에 복사했습니다 — 문서에 그대로 붙여넣으세요'
                       : '[실측] 위 글을 직접 복사하세요 (wlDocStat.panel() 이면 복사 단추가 있습니다)');
        return t;
      });
    });
  };
  API.panel = panel;
  API.raw   = function(){ return CACHE; };

  window.wlDocStat = API;
})();

/* ============================================================
   🖼 사진을 기록 밖으로 — 축소 · Storage 이관 (wlPhoto)  v150-0830-1657

   달님 : 「사진 자동 축소 + Storage 이관」

   지금 무슨 일이 벌어지고 있나
     사진이 기록 문서 안에 base64 글자로 통째 들어간다.
     한 장이 200~600KB 이고, 파이어스토어 문서 한 건 상한이 1MB 라
     사진 두세 장이면 기록 하나가 꽉 찬다. 목록을 열 때 사진까지 전부 딸려 온다.
     (2026-08-28 연락처 앱이 같은 이유로 저장소 4.07MB 를 먹었다)

   두 가지를 한다
     ① 축소 — 이미 있는 compressImage 를 「Storage 기준」으로 다시 잡는다
              (이관을 마치면 문서 크기 제한이 사라지므로 화질을 올릴 수 있다)
     ② 이관 — 기록 안 base64 → Storage 에 올리고 주소만 남긴다

   ⚠ 데이터를 옮기는 일이라 wlSplit 과 똑같이 네 걸음으로 나눈다.
      복사(올리기)만 해 두면 원본이 그대로 있어 아무것도 잃지 않는다.

     wlPhoto.state()   지금 사진이 몇 장 · 얼마나 무거운가
     wlPhoto.test()    Storage 에 올릴 권한이 있나 (작은 파일 하나로 시험)
     wlPhoto.copy()    base64 → Storage 업로드, 주소를 photosUrl 에 적어 둔다 (원본 그대로)
     wlPhoto.check()   적어 둔 주소가 진짜로 열리는지 한 장씩 확인
     wlPhoto.backup()  옮길 기록의 원본을 JSON 파일로 내려받기
     wlPhoto.clean()   확인된 것만 photos ← photosUrl  (백업 뒤에만)

   화면 창 : wlPhoto.panel()      화질 바꾸기 : wlPhoto.q('high')
   ============================================================ */
(function(){
  'use strict';

  var SDK  = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js';
  var BASE = 'worklog/photos/';
  var LSQ  = 'wl_photo_q';

  /* ── 거들기 ── */
  function recs(){
    try{ return (entries || []).filter(function(e){ return e && Array.isArray(e.photos) && e.photos.length; }); }
    catch(e){ return []; }
  }
  function isUrl(s){ return typeof s === 'string' && /^https?:\/\//.test(s); }
  function isB64(s){ return typeof s === 'string' && s.indexOf('data:image') === 0; }
  function kb(n){ return Math.round(n/1024); }
  function mb(n){ return Math.round(n/1024/1024*100)/100; }
  function say(m){ console.log('[사진] ' + m); try{ if(typeof toast === 'function') toast('🖼 ' + m); }catch(e){} }
  function rest(ms){ return new Promise(function(ok){ setTimeout(ok, ms); }); }

  function ready(){
    if(typeof db === 'undefined' || !db){ console.warn('[사진] 클라우드가 아직 준비되지 않았습니다'); return false; }
    if(typeof online === 'undefined' || !online){ console.warn('[사진] 인터넷이 연결돼야 합니다'); return false; }
    return true;
  }

  /* Storage 는 평소에 안 쓰므로, 필요할 때만 불러온다 (HTML 은 안 건드린다) */
  var _st = null;
  function storage(){
    if(_st) return Promise.resolve(_st);
    return new Promise(function(res){
      function done(){
        try{
          if(window.firebase && firebase.storage){ _st = firebase.storage(); return res(_st); }
        }catch(e){ console.warn('[사진] Storage 준비 실패', e); }
        res(null);
      }
      try{
        if(window.firebase && firebase.storage) return done();
        var s = document.createElement('script');
        s.src = SDK;
        s.onload  = done;
        s.onerror = function(){ console.warn('[사진] Storage 라이브러리를 못 불러왔습니다 (인터넷 확인)'); res(null); };
        document.head.appendChild(s);
      }catch(e){ console.warn('[사진] Storage 불러오기 실패', e); res(null); }
    });
  }

  /* ── ① 지금 상태 ── */
  function state(){
    var rs = recs();
    var nB = 0, nU = 0, bytes = 0, big = [];
    rs.forEach(function(r){
      var sz = 0;
      r.photos.forEach(function(p){
        if(isB64(p)){ nB++; sz += p.length; }
        else if(isUrl(p)){ nU++; }
      });
      bytes += sz;
      if(sz > 0) big.push({ id:r.id, 종류:r.kind, 날짜:r.date || '', 제목:String(r.title || '').slice(0,24), KB:kb(sz), 장수:r.photos.length });
    });
    big.sort(function(a,b){ return b.KB - a.KB; });
    var pend = 0;
    rs.forEach(function(r){ if(Array.isArray(r.photosUrl) && r.photosUrl.length) pend++; });
    var out = {
      사진있는기록: rs.length,
      기록안에든사진: nB,
      이미주소인사진: nU,
      기록이먹는용량: mb(bytes) + 'MB',
      주소적어둔기록: pend,
      화질: qName(),
      다음: nB ? 'wlPhoto.test() → wlPhoto.copy() → wlPhoto.check() → wlPhoto.backup() → wlPhoto.clean()'
               : '옮길 것 없음 (사진이 전부 주소입니다)'
    };
    console.log('[사진]', out);
    if(big.length){ try{ console.table(big.slice(0, 12)); }catch(e){} }
    return out;
  }

  /* ── ② 올릴 권한이 있나 ── */
  function test(){
    return storage().then(function(st){
      if(!st) return '❌ Storage 라이브러리를 못 불러왔습니다';
      var p = BASE + '_test/' + Date.now() + '.txt';
      var ref = st.ref(p);
      return ref.putString('ok').then(function(){
        return ref.getDownloadURL();
      }).then(function(u){
        return ref.delete().catch(function(){}).then(function(){
          console.log('[사진] ✅ 올릴 수 있습니다 — wlPhoto.copy() 로 진행하세요');
          return '✅ 올릴 수 있습니다';
        });
      }).catch(function(e){
        console.error('[사진] ❌ 올리지 못했습니다 — 구글이 준 원문:', e && (e.code || e.message), e);
        console.log('[사진] 파이어베이스 콘솔 → Storage → Rules 에서 쓰기 권한을 확인해야 합니다.');
        return '❌ 올리지 못했습니다 (' + (e && e.code ? e.code : '원인은 위 오류 참고') + ')';
      });
    });
  }

  /* ── ③ 올리기 (원본은 그대로 둔다) ── */
  async function copy(limit){
    if(!ready()) return '준비 안 됨';
    var st = await storage();
    if(!st) return 'Storage 라이브러리를 못 불러왔습니다';

    var todo = recs().filter(function(r){
      if(Array.isArray(r.photosUrl) && r.photosUrl.length === r.photos.length) return false;  /* 이미 적어 둠 */
      return r.photos.some(isB64);
    });
    if(limit) todo = todo.slice(0, limit);
    if(!todo.length) return '올릴 것이 없습니다';

    console.log('[사진] 올릴 기록 ' + todo.length + '건 — 원본은 지우지 않습니다');
    var okN = 0, failN = 0, upN = 0;

    for(var i = 0; i < todo.length; i++){
      var r = todo[i];
      var urls = [], bad = 0;
      for(var j = 0; j < r.photos.length; j++){
        var p = r.photos[j];
        if(isUrl(p)){ urls.push(p); continue; }
        if(!isB64(p)){ urls.push(p); continue; }
        try{
          var ext = (p.slice(0, 30).indexOf('image/png') > 0) ? 'png' : 'jpg';
          var ref = st.ref(BASE + r.id + '/' + j + '_' + Date.now() + '.' + ext);
          await ref.putString(p, 'data_url');
          urls.push(await ref.getDownloadURL());
          upN++;
        }catch(e){
          bad++;
          console.warn('[사진] ' + r.id + ' 의 ' + (j+1) + '번째 올리기 실패', e && (e.code || e.message));
          break;                                   /* 한 장이라도 실패하면 이 기록은 건너뛴다 */
        }
      }
      if(bad || urls.length !== r.photos.length){ failN++; }
      else{
        try{ updateRecord(r.id, { photosUrl: urls, photoMigAt: Date.now() }); okN++; }
        catch(e){ failN++; console.warn('[사진] ' + r.id + ' 주소 적기 실패', e); }
      }
      if(i % 5 === 4) await rest(500);             /* 몰아치지 않게 쉬어 간다 */
    }
    var msg = '올리기 끝 — 기록 ' + okN + '건 (사진 ' + upN + '장) · 실패 ' + failN + '건 / 원본은 그대로';
    say(msg);
    console.log('[사진] 다음은 wlPhoto.check() 로 주소가 진짜 열리는지 확인하세요');
    return msg;
  }

  /* ── ④ 주소가 진짜 열리나 ── */
  function loadOne(u){
    return new Promise(function(res){
      var im = new Image(), done = false;
      var t = setTimeout(function(){ if(!done){ done = true; res(false); } }, 12000);
      im.onload  = function(){ if(!done){ done = true; clearTimeout(t); res(true);  } };
      im.onerror = function(){ if(!done){ done = true; clearTimeout(t); res(false); } };
      im.src = u;
    });
  }
  async function check(){
    var rs = recs().filter(function(r){ return Array.isArray(r.photosUrl) && r.photosUrl.length; });
    if(!rs.length) return '확인할 것이 없습니다 — 먼저 wlPhoto.copy()';
    var rows = [], okAll = 0, ng = 0;
    for(var i = 0; i < rs.length; i++){
      var r = rs[i], good = 0;
      for(var j = 0; j < r.photosUrl.length; j++){
        var u = r.photosUrl[j];
        if(isUrl(u) ? await loadOne(u) : false) good++;
      }
      var ok = (good === r.photosUrl.length && r.photosUrl.length === r.photos.length);
      if(ok) okAll++; else ng++;
      rows.push({ id:r.id, 제목:String(r.title||'').slice(0,20),
                  원본:r.photos.length, 주소:r.photosUrl.length, 열림:good,
                  상태: ok ? '✅' : '⚠ 다시 올리기' });
      if(i % 8 === 7) await rest(200);
    }
    try{ console.table(rows); }catch(e){ console.log(rows); }
    console.log(ng ? '[사진] ⚠ ' + ng + '건이 아직 안 됩니다 — wlPhoto.copy() 를 다시 하세요'
                   : '[사진] ✅ 전부 확인 — wlPhoto.backup() 뒤에 wlPhoto.clean() 하세요');
    _lastCheck = { at: Date.now(), ok: okAll, ng: ng, ids: rows.filter(function(x){ return x.상태 === '✅'; }).map(function(x){ return x.id; }) };
    return rows;
  }
  var _lastCheck = null;

  /* ── ⑤ 원본 내려받기 (지우기 전 안전망) ── */
  function backup(){
    var rs = recs().filter(function(r){ return Array.isArray(r.photosUrl) && r.photosUrl.length && r.photos.some(isB64); });
    if(!rs.length) return '백업할 것이 없습니다';
    var data = rs.map(function(r){
      return { id:r.id, kind:r.kind, date:r.date, title:r.title, photos:r.photos, photosUrl:r.photosUrl };
    });
    var txt = JSON.stringify({ 만든때: new Date().toISOString(), 버전: String(window.APP_VERSION||''), 기록: data });
    var size = txt.length;
    try{
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type:'application/json' }));
      a.download = '사진원본백업_' + new Date().toISOString().slice(0,10) + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }catch(e){ console.error('[사진] 백업 파일 만들기 실패', e); return '백업 실패'; }
    _backupAt = Date.now();
    var msg = '원본 백업 내려받음 — 기록 ' + rs.length + '건 · ' + mb(size) + 'MB';
    say(msg);
    return msg;
  }
  var _backupAt = 0;

  /* ── ⑥ 원본 비우기 (확인·백업이 끝난 것만) ── */
  async function clean(force){
    if(!ready()) return '준비 안 됨';
    if(!_lastCheck || (Date.now() - _lastCheck.at) > 30*60*1000){
      console.warn('[사진] 먼저 wlPhoto.check() 로 확인하세요 (30분 안에 한 것만 인정합니다)');
      return '먼저 wlPhoto.check()';
    }
    if(!_backupAt && !force){
      console.warn('[사진] 먼저 wlPhoto.backup() 으로 원본을 내려받으세요');
      return '먼저 wlPhoto.backup()';
    }
    var okIds = {}; (_lastCheck.ids || []).forEach(function(id){ okIds[id] = 1; });
    var rs = recs().filter(function(r){ return okIds[r.id] && r.photos.some(isB64); });
    if(!rs.length) return '비울 것이 없습니다';

    var ask = (window.wlAsk && window.wlAsk.ok)
      ? await window.wlAsk.ok('기록 안의 사진 원본을 비울까요?',
          { sub: rs.length + '건 · 사진은 Storage 에 있고 주소로 그대로 보입니다 · 되돌릴 수 없습니다',
            ok:'비우기', danger:1 })
      : confirm('기록 안의 사진 원본을 비울까요? 되돌릴 수 없습니다.');
    if(!ask) return '그만두었습니다';

    var done = 0, fail = 0, freed = 0;
    for(var i = 0; i < rs.length; i++){
      var r = rs[i];
      var was = r.photos.reduce(function(s,p){ return s + (isB64(p) ? p.length : 0); }, 0);
      try{
        updateRecord(r.id, { photos: r.photosUrl.slice(), photosUrl: [], photoMigAt: Date.now() });
        done++; freed += was;
      }catch(e){ fail++; console.warn('[사진] ' + r.id + ' 비우기 실패', e); }
      if(i % 10 === 9) await rest(400);
    }
    var msg = '원본 비움 — ' + done + '건 · 줄어든 용량 ' + mb(freed) + 'MB · 실패 ' + fail + '건';
    say(msg);
    return msg;
  }

  /* ── 화질 ── */
  var QN = { low:'표준 (많이 담기)', mid:'선명 (권장)', high:'최고 (글씨까지)' };
  function qName(){ try{ return QN[localStorage.getItem(LSQ) || 'mid'] || QN.mid; }catch(e){ return QN.mid; } }
  function q(k){
    if(!k) return { 지금: qName(), 고를수있는것: ['low','mid','high'],
                    쓰는법: "wlPhoto.q('high')", 참고:'Storage 이관을 마치면 high 를 써도 됩니다' };
    if(!QN[k]) return "low · mid · high 중에 고르세요";
    try{ localStorage.setItem(LSQ, k); }catch(e){}
    say('사진 화질 — ' + QN[k]);
    return QN[k];
  }

  /* ── 화면 창 ── */
  function panel(){
    var old = document.getElementById('wlPhotoOv'); if(old) old.remove();
    var s = state();
    var ov = document.createElement('div');
    ov.id = 'wlPhotoOv';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(20,24,32,.45);z-index:99999;' +
      'display:flex;align-items:center;justify-content:center;padding:16px';
    var bx = document.createElement('div');
    bx.style.cssText = 'background:#fff;border-radius:16px;max-width:620px;width:100%;max-height:88vh;' +
      'overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.28);padding:20px';
    var rows = [
      ['사진 있는 기록', s.사진있는기록 + '건'],
      ['기록 안에 든 사진', s.기록안에든사진 + '장'],
      ['이미 주소인 사진', s.이미주소인사진 + '장'],
      ['기록이 먹는 용량', s.기록이먹는용량],
      ['화질', s.화질]
    ];
    bx.innerHTML =
      '<div style="font-size:17px;font-weight:700;margin-bottom:4px">🖼 사진을 기록 밖으로</div>' +
      '<div style="color:#7b8794;font-size:13px;margin-bottom:14px">아래 순서대로 하나씩 누르세요. ' +
      '3번까지는 아무것도 지우지 않습니다.</div>' +
      '<div style="background:#f7f9fc;border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:14px">' +
      rows.map(function(r){
        return '<div style="display:flex;justify-content:space-between;padding:4px 0">' +
               '<span style="color:#5b6672">' + r[0] + '</span><b>' + r[1] + '</b></div>';
      }).join('') + '</div>' +
      '<div id="wlPhotoBtns"></div>' +
      '<div id="wlPhotoLog" style="margin-top:14px;font-size:13px;color:#3f7cb8;min-height:20px"></div>';
    var steps = [
      ['① 올릴 수 있나 확인', test,   '#eef4fb'],
      ['② Storage 에 올리기 (안 지움)', function(){ return copy(); }, '#eef4fb'],
      ['③ 주소가 열리는지 확인', check, '#eef4fb'],
      ['④ 원본 백업 내려받기', function(){ return Promise.resolve(backup()); }, '#fff7e6'],
      ['⑤ 기록 안 원본 비우기', function(){ return clean(); }, '#fdeeee']
    ];
    ov.appendChild(bx); document.body.appendChild(ov);
    var host = bx.querySelector('#wlPhotoBtns'), log = bx.querySelector('#wlPhotoLog');
    steps.forEach(function(st){
      var b = document.createElement('button');
      b.textContent = st[0];
      b.style.cssText = 'display:block;width:100%;margin-bottom:8px;border:1px solid #d7dee8;' +
        'background:' + st[2] + ';border-radius:12px;padding:14px 16px;font-size:15px;' +
        'font-family:inherit;cursor:pointer;text-align:left;min-height:48px';
      b.addEventListener('click', function(){
        b.disabled = true; log.textContent = st[0] + ' 하는 중…';
        Promise.resolve(st[1]()).then(function(r){
          log.textContent = (typeof r === 'string') ? r : '끝났습니다 — 콘솔에 표가 있어요';
          b.disabled = false;
        }).catch(function(e){
          log.textContent = '실패: ' + (e && e.message || e); b.disabled = false;
        });
      });
      host.appendChild(b);
    });
    var c = document.createElement('button');
    c.textContent = '닫기';
    c.style.cssText = 'display:block;width:100%;margin-top:8px;border:none;background:#eef1f5;' +
      'border-radius:12px;padding:13px;font-size:14px;font-family:inherit;cursor:pointer;min-height:44px';
    c.addEventListener('click', function(){ ov.remove(); });
    host.appendChild(c);
    ov.addEventListener('click', function(e){ if(e.target === ov) ov.remove(); });
    return '창을 띄웠습니다';
  }

  /* 사진 한 장을 Storage 에 올리고 주소를 돌려준다 (실패하면 null)
        — v152 「새 사진 자동 올리기」가 이걸 쓴다 */
  async function up(dataUrl, path){
    if(!isB64(dataUrl)) return null;
    var st = await storage();
    if(!st) return null;
    try{
      var ref = st.ref(path || (BASE + '_new/' + Date.now() + '_' +
                Math.random().toString(36).slice(2,8) + '.jpg'));
      await ref.putString(dataUrl, 'data_url');
      return await ref.getDownloadURL();
    }catch(e){
      console.warn('[사진] 올리기 실패 — 기록 안에 담습니다', e && (e.code || e.message));
      return null;
    }
  }

  window.wlPhoto = {
    state: state, test: test, copy: copy, check: check,
    backup: backup, clean: clean, q: q, panel: panel,
    up: up, base: BASE
  };
  console.log('[사진] v150 준비됨 — wlPhoto.panel() 또는 wlPhoto.state()');
})();

/* ============================================================
   ⬆ 새 사진도 자동으로 Storage 에 (wlPhotoAuto)  v152-0830-1810

   달님 : 「1·2 진행해」
          ① 사진 상한·화질 풀기   ② 새 사진도 자동으로 Storage 로

   왜 필요한가
     v150 에서 기존 사진 20장(2.42MB)을 Storage 로 옮겼지만,
     **새로 넣는 사진은 여전히 기록 안에 base64 로 쌓인다.**
     그대로 두면 몇 달 뒤 같은 이관을 또 해야 한다. 여기서 끊는다.

   무엇을 하나
     ① 사진을 넣는 순간 Storage 에 올리고 **주소만** 기록에 담는다
     ② 주소로 담기면 파이어스토어 1MB 상한과 무관해지므로
        900KB 총량 제한을 **주소로 담을 때만** 푼다
        (올리기 실패로 기록 안에 담을 때는 옛 상한을 그대로 지킨다)
     ③ 화질 기본값을 「최고」로 올린다 — 계량기 숫자·명판 글씨용
        (달님이 한 번이라도 직접 고른 적이 있으면 그 선택을 존중한다)
     ④ 본문(노션식 페이지)에 끌어다 놓은 사진처럼 다른 길로 들어온 것도
        그물(o:90)로 훑어서 조용히 올린다

   되돌리기 : wlPhoto.auto.off()   → 예전처럼 기록 안에 base64 로 담는다
   지금 상태 : wlPhoto.auto.state()
   ============================================================ */
(function(){
  'use strict';

  var LS_AUTO = 'wl_photo_auto';     /* 자동 올리기 켜짐/꺼짐 */
  var LS_QSET = 'wl_photo_q_set';    /* 달님이 화질을 직접 고른 적이 있나 */
  var LS_Q    = 'wl_photo_q';

  function autoOn(){ try{ return localStorage.getItem(LS_AUTO) !== '0'; }catch(e){ return true; } }
  function isB64(s){ return typeof s === 'string' && s.indexOf('data:image') === 0; }
  function isUrl(s){ return typeof s === 'string' && /^https?:\/\//.test(s); }
  function netOK(){ try{ return !!online; }catch(e){ return false; } }
  function ready(){ return !!(window.wlPhoto && typeof window.wlPhoto.up === 'function'); }
  function say(m){ try{ if(typeof toast === 'function') toast('🖼 ' + m); }catch(e){} }

  /* ── ③ 화질 기본값을 「최고」로 (한 번만) ──
        달님이 wlPhoto.q(...) 로 직접 고른 적이 있으면 건드리지 않는다. */
  (function raiseQuality(){
    try{
      if(localStorage.getItem(LS_QSET) === '1') return;   /* 직접 고른 적 있음 */
      if(!autoOn()) return;
      localStorage.setItem(LS_Q, 'high');
      console.log('[사진] 화질 기본값을 「최고 (글씨까지)」로 올렸습니다 — 주소로 저장하므로 문서 크기 제한이 없습니다');
    }catch(e){}
  })();

  /* 달님이 직접 고르면 그때부터 존중한다 */
  if(window.wlPhoto && typeof window.wlPhoto.q === 'function'){
    var _origQ = window.wlPhoto.q;
    window.wlPhoto.q = function(k){
      if(k){ try{ localStorage.setItem(LS_QSET, '1'); }catch(e){} }
      return _origQ.call(window.wlPhoto, k);
    };
  }

  /* ── 사진 한 장 올리기 ── */
  async function upOne(dataUrl, rid){
    if(!ready() || !netOK()) return null;
    var base = (window.wlPhoto.base || 'worklog/photos/');
    var dir  = rid ? (base + rid + '/') : (base + '_new/');
    var path = dir + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg';
    try{ return await window.wlPhoto.up(dataUrl, path); }
    catch(e){ return null; }
  }

  /* ── ①② 사진 담기 — 기존 addPhotos 를 대신한다 ──
        원래 것은 압축 → 900KB 검사 → 기록 안에 담기 순서였다.
        여기서는 압축 → **올리기** → 주소 담기. 실패할 때만 옛 방식으로 물러난다. */
  var _origAdd = (typeof window.addPhotos === 'function') ? window.addPhotos : null;

  window.addPhotos = async function(files, arr, rerender){
    if(!autoOn() || !ready()){
      if(_origAdd) return _origAdd.call(null, files, arr, rerender);
      return;
    }
    var list = [].slice.call(files || []);
    var up = 0, keep = 0, bad = 0;

    for(var i = 0; i < list.length; i++){
      var f = list[i];
      if(!f || !f.type || f.type.indexOf('image/') !== 0) continue;

      var data = null;
      try{ data = await compressImage(f); }
      catch(e){ bad++; console.warn('[사진] 처리 실패', e); continue; }
      if(!data) { bad++; continue; }

      var url = await upOne(data, ridNow());
      if(url){ arr.push(url); up++; continue; }

      /* 올리기 실패 — 예전처럼 기록 안에 담는다. 이때만 900KB 상한을 지킨다. */
      var cur = 0;
      for(var j = 0; j < arr.length; j++) if(isB64(arr[j])) cur += arr[j].length;
      if(cur + data.length > MAX_TOTAL){
        say('인터넷이 없어 기록 안에 담는 중인데 용량이 찼어요 — 연결 뒤 다시 넣어주세요');
        break;
      }
      arr.push(data); keep++;
    }

    try{ if(typeof rerender === 'function') rerender(); }catch(e){}

    if(up && !keep) say('사진 ' + up + '장을 올렸어요');
    else if(up && keep) say('사진 ' + up + '장 올림 · ' + keep + '장은 기록 안에 (인터넷 확인)');
    else if(keep) say('사진 ' + keep + '장을 기록 안에 담았어요 (나중에 자동으로 올립니다)');
    if(bad) console.warn('[사진] 처리 못한 파일 ' + bad + '장');
  };

  /* ── ④ 그물 — 다른 길로 들어온 사진도 훑는다 ──
        노션식 본문에 끌어다 놓은 사진은 wlPics(o:72) 가 r.photos 로 옮긴다.
        그 뒤(o:90)에 여기서 base64 를 발견하면 조용히 올린다. */
  function ridNow(){
    try{ var m = String(location.hash || '').match(/^#lp=([^&]+)/); return m ? decodeURIComponent(m[1]) : ''; }
    catch(e){ return ''; }
  }
  function recOf(id){
    try{ return (entries || []).filter(function(x){ return x && x.id === id; })[0] || null; }
    catch(e){ return null; }
  }

  var busy = {};          /* 지금 올리는 중인 기록 — 두 번 안 돌게 */
  var doneT = 0;

  async function sweepOne(rid){
    if(!rid || busy[rid]) return;
    var r = recOf(rid); if(!r || !Array.isArray(r.photos) || !r.photos.length) return;
    if(!r.photos.some(isB64)) return;
    if(!autoOn() || !ready() || !netOK()) return;

    busy[rid] = 1;
    try{
      var out = r.photos.slice(), n = 0;
      for(var i = 0; i < out.length; i++){
        if(!isB64(out[i])) continue;
        var u = await upOne(out[i], rid);
        if(!u) break;                       /* 한 장이라도 실패하면 이번엔 그만 (다음에 다시) */
        out[i] = u; n++;
      }
      if(n){
        if(typeof updateRecord === 'function') updateRecord(rid, { photos: out, photoMigAt: Date.now() });
        console.log('[사진] 새로 들어온 사진 ' + n + '장을 올렸습니다 (' + rid + ')');
        say('사진 ' + n + '장을 올렸어요');
      }
    }catch(e){ console.warn('[사진] 훑기 실패', e); }
    finally{ delete busy[rid]; }
  }

  function sweepSoon(){
    clearTimeout(doneT);
    doneT = setTimeout(function(){ sweepOne(ridNow()); }, 1200);
  }

  (window.__wlPaintQ = window.__wlPaintQ || []).push({ o:90, n:'새 사진 올리기', f:sweepSoon });

  /* ── 창구 ── */
  function state(){
    var b = 0, u = 0;
    try{
      (entries || []).forEach(function(e){
        if(!e || !Array.isArray(e.photos)) return;
        e.photos.forEach(function(p){ if(isB64(p)) b++; else if(isUrl(p)) u++; });
      });
    }catch(e){}
    var q = 'mid';
    try{ q = localStorage.getItem(LS_Q) || 'mid'; }catch(e){}
    return {
      자동올리기: autoOn() ? '켜짐' : '꺼짐',
      인터넷: netOK() ? '연결됨' : '끊김',
      화질: q,
      기록안에남은사진: b,
      주소로된사진: u,
      안내: b ? '기록을 열면 자동으로 올라갑니다 (또는 wlPhoto.copy())' : '전부 주소입니다'
    };
  }

  window.wlPhoto = window.wlPhoto || {};
  window.wlPhoto.auto = {
    on:  function(){ try{ localStorage.setItem(LS_AUTO, '1'); }catch(e){}
                     return '새 사진을 Storage 에 올립니다'; },
    off: function(){ try{ localStorage.setItem(LS_AUTO, '0'); }catch(e){}
                     return '예전처럼 기록 안에 담습니다 (900KB 상한이 다시 걸립니다)'; },
    state: state,
    now:   function(){ return sweepOne(ridNow()); }
  };

  console.log('[사진] 자동 올리기 v152 — ' + (autoOn() ? '켜짐' : '꺼짐') +
              ' / wlPhoto.auto.state() 로 확인');
})();

/* ============================================================
   🗑 휴지통 단추 · 배지 · 여러 건 되살리기 (wlTrashUI)  v153-0830-1930

   달님 : 「응용 만들어」
     ① 머리말에 [🗑 휴지통] 단추 — 🛟 안전 탭까지 안 들어가도 된다
     ② 몇 건 들어 있는지 **빨간 배지** — 실수로 지운 걸 바로 알아챈다
     ③ 체크해서 **여러 건 한 번에** 되살린다

   ⚠ 휴지통 자체는 새로 만들지 않는다. **이미 있다.**
     worklog.html 「🔐 안전 저장소 v47」 블록이 다 갖고 있다 —
       wrapWorklogDelete() 가 deleteRecord 를 감싸 trashPut('worklog', r)
       로컬 wl_trash_v1(200건) + 클라우드 worklog_trash(90일)
       되살리기는 restoreRecord() → forgetDelId 까지 해 준다
     창구도 이미 열려 있다 : wlP.trash / trashSync / trashRestore / trashClear

     (2026-08-30 : worklog.js 의 autoCleanTrash(){ ...미구현... } 만 보고
      「휴지통이 없다」고 판단해 똑같은 것을 새로 만들 뻔했다.
      그건 v44 때의 죽은 껍데기였고, 진짜 휴지통은 **worklog.html 안**에 있었다.
      → 기능을 찾을 때 worklog.js 만 grep 하면 안 된다. 기능의 85%는 html 안에 있다.)

   되돌리기 : wlTrashUI.off()   → 단추만 숨긴다 (휴지통은 그대로 돈다)
   ============================================================ */
(function(){
  'use strict';

  var LS_SHOW = 'wl_trash_btn';
  var BTN_ID  = 'wlTrashBtn';
  var SRC     = 'worklog';
  var DAYS    = 90;                 /* 안전 저장소가 쓰는 보관 기간과 같게 */

  function showOn(){ try{ return localStorage.getItem(LS_SHOW) !== '0'; }catch(e){ return true; } }
  function P(){ return window.wlP || null; }
  function rows(){
    try{ var a = P() && P().trash ? P().trash(SRC) : []; return Array.isArray(a) ? a : []; }
    catch(e){ return []; }
  }
  function nowMs(){ try{ return kstNow().getTime(); }catch(e){ return Date.now(); } }
  function txt(s){ return String(s == null ? '' : s); }

  function when(at){
    if(!at) return '';
    var d = new Date(at), p = function(n){ return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function left(at){
    if(!at) return '';
    var n = Math.ceil((at + DAYS * 24 * 3600 * 1000 - nowMs()) / (24 * 3600 * 1000));
    return n > 0 ? (n + '일 남음') : '곧 사라짐';
  }
  function title(x){
    var r = (x && x.rec) || {};
    return txt(r.title || r.name || r.memo || r.detail || '').slice(0, 44);
  }
  function sub(x){
    var r = (x && x.rec) || {};
    var a = [txt(r.kind), txt(r.date), '지움 ' + when(x.at), left(x.at)];
    if(r._photoN) a.push('📷 ' + r._photoN);
    return a.filter(Boolean).join(' · ');
  }

  /* ── ①② 머리말 단추 + 배지 ── */
  function paintBtn(){
    var b = document.getElementById(BTN_ID);
    if(!showOn()){ if(b) b.remove(); return; }
    var anchor = document.getElementById('btnSafe');
    if(!anchor) return;
    if(!b){
      b = document.createElement('button');
      b.id = BTN_ID;
      b.className = 'nav-btn';
      b.title = '휴지통 — 지운 것을 ' + DAYS + '일 동안 되살릴 수 있어요';
      b.style.cssText = 'background:#fff;border:1.5px solid #dbe6f4;color:#444;border-radius:10px;' +
        'padding:6px 12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;' +
        'display:inline-flex;align-items:center;gap:6px;min-height:32px';
      b.addEventListener('click', function(){ panel(); });
      anchor.insertAdjacentElement('afterend', b);
    }
    var n = rows().length;
    b.innerHTML = '🗑 휴지통' + (n
      ? '<span style="background:#e8542f;color:#fff;border-radius:9px;min-width:18px;height:18px;' +
        'display:inline-flex;align-items:center;justify-content:center;font-size:11px;' +
        'font-weight:800;padding:0 5px">' + (n > 99 ? '99+' : n) + '</span>'
      : '');
  }

  /* 지우면 배지를 바로 고친다 (안전 저장소가 담은 뒤에) */
  if(typeof window.deleteRecord === 'function' && !window.deleteRecord._trBadge){
    var _od = window.deleteRecord;
    var f = function(){
      var r = _od.apply(this, arguments);
      setTimeout(paintBtn, 300);
      return r;
    };
    f._trBadge = 1;
    window.deleteRecord = f;
    try{ deleteRecord = f; }catch(e){}
  }

  /* ── ③ 창 ── */
  function panel(){
    var old = document.getElementById('wlTrashOv'); if(old) old.remove();
    var list = rows();

    var ov = document.createElement('div');
    ov.id = 'wlTrashOv';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(20,24,32,.45);z-index:99999;' +
      'display:flex;align-items:center;justify-content:center;padding:16px';
    var bx = document.createElement('div');
    bx.style.cssText = 'background:#fff;border-radius:16px;max-width:760px;width:100%;max-height:88vh;' +
      'display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.28);overflow:hidden';

    /* 머리 */
    var hd = document.createElement('div');
    hd.style.cssText = 'padding:16px 18px;border-bottom:1px solid #e8ecf2;display:flex;' +
      'align-items:center;gap:10px;flex-wrap:wrap';
    var cnt = document.createElement('span');
    cnt.style.cssText = 'color:#7b8794;font-size:13px';
    cnt.textContent = list.length + '건 · ' + DAYS + '일 보관';
    hd.innerHTML = '<b style="font-size:17px">🗑 휴지통</b>';
    hd.appendChild(cnt);
    var sp = document.createElement('div'); sp.style.cssText = 'flex:1';
    var bSync = document.createElement('button');
    bSync.textContent = '↻ 새로 받기';
    bSync.style.cssText = 'border:1px solid #d7dee8;background:#f7f9fc;border-radius:10px;' +
      'padding:10px 14px;font-size:13px;font-family:inherit;cursor:pointer;min-height:44px';
    var bClose = document.createElement('button');
    bClose.textContent = '닫기';
    bClose.style.cssText = bSync.style.cssText;
    hd.appendChild(sp); hd.appendChild(bSync); hd.appendChild(bClose);

    /* 도구줄 */
    var tb = document.createElement('div');
    tb.style.cssText = 'padding:8px 18px;border-bottom:1px solid #f0f3f7;display:flex;' +
      'align-items:center;gap:8px;flex-wrap:wrap;background:#fbfcfe';
    var lab = document.createElement('label');
    lab.style.cssText = 'display:flex;align-items:center;gap:7px;font-size:14px;cursor:pointer;min-height:44px';
    lab.innerHTML = '<input type="checkbox" id="wlTrAll" style="width:20px;height:20px;cursor:pointer">전체 선택';
    var pick = document.createElement('span');
    pick.style.cssText = 'color:#7b8794;font-size:13px';
    var sp2 = document.createElement('div'); sp2.style.cssText = 'flex:1';
    var bBack = document.createElement('button');
    bBack.textContent = '선택한 것 되살리기';
    bBack.disabled = true; bBack.style.opacity = '.5';
    bBack.style.cssText += 'border:none;background:#3f7cb8;color:#fff;border-radius:10px;' +
      'padding:11px 18px;font-size:14px;font-family:inherit;cursor:pointer;min-height:44px;opacity:.5';
    var bClear = document.createElement('button');
    bClear.textContent = '비우기';
    bClear.style.cssText = 'border:1px solid #f0c9c9;background:#fdeeee;color:#b4534f;border-radius:10px;' +
      'padding:11px 16px;font-size:14px;font-family:inherit;cursor:pointer;min-height:44px';
    tb.appendChild(lab); tb.appendChild(pick); tb.appendChild(sp2);
    tb.appendChild(bBack); tb.appendChild(bClear);

    var body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow:auto;padding:4px 14px 16px';
    var log = document.createElement('div');
    log.style.cssText = 'padding:0 18px 14px;font-size:13px;color:#3f7cb8;min-height:18px';

    function draw(){
      list = rows();
      cnt.textContent = list.length + '건 · ' + DAYS + '일 보관';
      body.innerHTML = '';
      if(!list.length){
        tb.style.display = 'none';
        body.innerHTML = '<div style="padding:44px 10px;text-align:center;color:#8b95a1;font-size:15px">' +
          '비어 있습니다<br><span style="font-size:13px">지운 것은 ' + DAYS +
          '일 동안 여기서 되살릴 수 있어요</span></div>';
        return;
      }
      tb.style.display = 'flex';
      list.slice(0, 300).forEach(function(x){
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #f0f3f7';
        var cb = document.createElement('input');
        cb.type = 'checkbox'; cb.className = 'wlTrCb';
        cb.setAttribute('data-at', String(x.at));
        cb.style.cssText = 'width:20px;height:20px;flex:none;cursor:pointer';
        var t = document.createElement('div');
        t.style.cssText = 'flex:1;min-width:0;cursor:pointer';
        t.innerHTML = '<div style="font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;' +
          'text-overflow:ellipsis">' + (title(x) ||
          '<span style="color:#a0a8b3">(제목없음)</span>') + '</div>' +
          '<div style="font-size:12px;color:#8b95a1;margin-top:3px">' + sub(x) + '</div>';
        t.addEventListener('click', function(){ cb.checked = !cb.checked; sync(); });
        var one = document.createElement('button');
        one.textContent = '되살리기';
        one.style.cssText = 'border:none;background:#eef4fb;color:#3f7cb8;border-radius:10px;' +
          'padding:11px 16px;font-size:14px;font-family:inherit;cursor:pointer;min-height:44px;flex:none';
        one.addEventListener('click', function(){ run([x.at]); });
        row.appendChild(cb); row.appendChild(t); row.appendChild(one);
        body.appendChild(row);
      });
      sync();
    }

    function boxes(){ return [].slice.call(body.querySelectorAll('.wlTrCb')); }
    function sync(){
      var on = boxes().filter(function(c){ return c.checked; });
      pick.textContent = on.length ? (on.length + '건 선택') : '';
      bBack.disabled = !on.length;
      bBack.style.opacity = on.length ? '1' : '.5';
      var all = tb.querySelector('#wlTrAll');
      if(all) all.checked = on.length > 0 && on.length === boxes().length;
    }
    body.addEventListener('change', function(e){
      if(e.target && e.target.classList && e.target.classList.contains('wlTrCb')) sync();
    });
    tb.querySelector('#wlTrAll').addEventListener('change', function(e){
      boxes().forEach(function(c){ c.checked = e.target.checked; }); sync();
    });

    function run(ats){
      if(!P() || !P().trashRestore){ log.textContent = '안전 저장소를 찾을 수 없습니다'; return; }
      var ok = 0, ng = 0;
      ats.forEach(function(at){
        var r = false;
        try{ r = P().trashRestore(SRC, at); }catch(e){ console.warn('[휴지통] 되살리기 실패', e); }
        if(r) ok++; else ng++;
      });
      try{ if(typeof renderAll === 'function') renderAll(); }catch(e){}
      try{ if(typeof window.v43Refresh === 'function') window.v43Refresh(); }catch(e){}
      log.textContent = '되살림 ' + ok + '건' + (ng ? (' · 실패 ' + ng + '건') : '');
      if(ok && typeof toast === 'function') toast('🗑 ' + ok + '건을 되살렸어요');
      draw(); paintBtn();
    }

    bBack.addEventListener('click', function(){
      var ats = boxes().filter(function(c){ return c.checked; })
                       .map(function(c){ return Number(c.getAttribute('data-at')); });
      if(ats.length) run(ats);
    });
    bClear.addEventListener('click', async function(){
      var n = rows().length;
      if(!n){ log.textContent = '이미 비어 있습니다'; return; }
      var ask = (window.wlAsk && window.wlAsk.ok)
        ? await window.wlAsk.ok('휴지통을 비울까요?',
            { sub: n + '건 · 되돌릴 수 없습니다', ok:'비우기', danger:1 })
        : confirm('휴지통 ' + n + '건을 비울까요? 되돌릴 수 없습니다.');
      if(!ask) return;
      try{ P().trashClear(SRC); }catch(e){ console.warn('[휴지통] 비우기 실패', e); }
      log.textContent = '휴지통을 비웠습니다';
      draw(); paintBtn();
    });
    bSync.addEventListener('click', function(){
      if(!P() || !P().trashSync){ log.textContent = '새로 받을 수 없습니다'; return; }
      bSync.disabled = true; log.textContent = '클라우드에서 받는 중…';
      Promise.resolve(P().trashSync()).then(function(){
        log.textContent = '다른 기기에서 지운 것까지 합쳤습니다';
        bSync.disabled = false; draw(); paintBtn();
      }).catch(function(){ log.textContent = '못 받았습니다'; bSync.disabled = false; });
    });
    bClose.addEventListener('click', function(){ ov.remove(); paintBtn(); });
    ov.addEventListener('click', function(e){ if(e.target === ov){ ov.remove(); paintBtn(); } });

    bx.appendChild(hd); bx.appendChild(tb); bx.appendChild(body); bx.appendChild(log);
    ov.appendChild(bx); document.body.appendChild(ov);
    draw();

    /* 열자마자 클라우드도 한 번 맞춘다 (다른 기기에서 지운 것) */
    try{ if(P() && P().trashSync) Promise.resolve(P().trashSync()).then(function(){ draw(); paintBtn(); }); }
    catch(e){}
    return '창을 띄웠습니다';
  }

  /* ── 붙이기 — 화면이 늦게 그려져도 따라간다 ── */
  function boot(){ [0, 1200, 4000, 9000].forEach(function(ms){ setTimeout(paintBtn, ms); }); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.wlTrashUI = {
    panel:   panel,
    count:   function(){ return rows().length; },
    list:    function(){
      var a = rows();
      try{
        console.table(a.slice(0, 40).map(function(x){
          return { 지운때: when(x.at), 제목: title(x), 종류: (x.rec||{}).kind || '',
                   날짜: (x.rec||{}).date || '', 보관: left(x.at), at: x.at };
        }));
      }catch(e){ console.log(a); }
      return a;
    },
    sync:    function(){ return P() && P().trashSync ? P().trashSync() : null; },
    refresh: paintBtn,
    on:  function(){ try{ localStorage.setItem(LS_SHOW,'1'); }catch(e){} paintBtn(); return '단추를 보입니다'; },
    off: function(){ try{ localStorage.setItem(LS_SHOW,'0'); }catch(e){} paintBtn(); return '단추만 숨깁니다 (휴지통은 그대로)'; }
  };
  /* 예전 이름으로 불러도 열리게 */
  window.wlTrash = window.wlTrash || {};
  window.wlTrash.panel = panel;
  window.wlTrash.list  = window.wlTrashUI.list;

  console.log('[휴지통] 단추·배지 v153 — 머리말 「🛟 안전」 옆 [🗑 휴지통] / 휴지통 본체는 안전 저장소(v47)가 이미 하고 있습니다');
})();
