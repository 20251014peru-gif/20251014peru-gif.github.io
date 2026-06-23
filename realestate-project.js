/* ============================================================
   부동산 프로젝트 관리 v6.6 — 파일드롭/Ctrl+V 첨부, 링크필드, 전화자동입력, 자동완성Tab
   ------------------------------------------------------------
   [v5.5] 7일마다 백업 파일 자동 제안(개인관리 장점 이식) — 7일 지나면 앱 열 때 백업 만들지 물어봄
   [v5.4] 사라졌던 급한메모 슬라이드 패널 HTML 복구(메모 오류 해결)
   [v5.3] 1) 달력 '전체 켜기/끄기' 동작 거꾸로였던 것 수정
          2) 필터 칩 겹침 정리(전체켜기·끄기·메모를 라벨 옆으로)
          3) 메모 상태 표시 null 가드 (textContent 오류 방지)
   [v5.2] init 실행순서 버그픽스(PIN_KEY)
   [v5.1] 달력 표시 필터  [v5.0] 달력 통합(7기둥 완성)
   [v4.8] 코드정리·DATA MODEL 문서화
   [v4.0~4.7] 입력통일·식비메뉴·자재공정·인건비·메모인라인·검색통합
   [v3.x] 분류통일·전화주소·작업일지·할일·커스텀칸·영수증·파일분리·환율·백업
   ------------------------------------------------------------
   ===== DATA MODEL (Firestore 저장 구조) =====
   [projects] 프로젝트
     {name, address, startDate, status, stageStatus{공정:상태},
      quickMemo(텍스트), quickMemoHtml(글+인라인이미지 HTML)}
   [entries] 모든 비용·기록 (이 앱의 핵심)
     공통: {projectId, kind, title, date, amount, vendor, pay,
            cat, sub, stage, memo, files[], phone, addr, custom{}}
     - kind 저장 규칙:
        자재비/공사비 → kind 그대로, stage=공정, cat=세부
        그 외 비용(식비/주유·가스/톨비/주차/택배/매수/매도/관리비…)
          → kind="기타비용", cat=종류(통계호환), sub=세부
            (예: 식비 점심 → kind=기타비용,cat=식비,sub=점심)
            (주유·가스 → cat="교통/주유비")
        사진/연락/서류/문제/메모 → kind 그대로
     - 종류별 특수필드:
        자재비: spec(규격), unitPrice(단가), qty(수량), vat(별도/포함/없음)
        식비:   menus[{name,price}], menu(이름들), rest(식당), people(인원)
        공사비: workers[{name,pay}]  (인건비 인부 개별)
        주유·가스: dist(주행 km)
     - 표시 종류 복원: displayKindOf(e) — 저장된 cat을 보고 식비/주유 등
       원래 종류로 되돌려 비용수정창에 표시
   [vendors] 업체  {projectId,name,trade,phone,memo}
   [materials] 자재 재고  {projectId,name,space,cat,brand,spec,supplier,...}
   [quotes] 견적  [agents] 부동산 중개
   [worklog] 작업일지  {projectId,date,side,vendor,hours,memo,files[]}
   [todos] 준비·할일  {projectId,title,memo,done,due,tag,files[]}
   [options] 사용자 추가 옵션  doc id=옵션키, {items:[...]}
     (stages, kinds, pays, etc_cats, stage_cat_<공정>, sub_<종류> 등)
   ------------------------------------------------------------
   [핵심 함수 지도]
     입력:  openEntryModal → onKindChange(종류별 칸 표시)
            → fillCatSelect(세부) → saveEntry(표준화 저장)
     수정:  editCost → displayKindOf/displaySubOf → saveCostEdit
     분류:  COST_KINDS, SUB_CATS, CONSTRUCTION_CATS, subCatsFor()
     집계:  viewCost (자재/공사=공정별, 그 외=cat별)
     메모:  openMemoBoard(오른쪽 패널) — 인라인 편집·자동저장
   ============================================================ */

/* ===== Firebase ===== */
const firebaseConfig = {
  apiKey: "AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY",
  authDomain: "my-system-25497.firebaseapp.com",
  projectId: "my-system-25497",
  storageBucket: "my-system-25497.firebasestorage.app"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const CM_VENDOR="re_cm_vendor", CM_PRICE="re_cm_price",
      CM_CHK="re_cm_chk", CM_DOC="re_cm_doc", CM_REF="re_cm_ref";
const PROJECTS="realestate_projects", ENTRIES="realestate_entries",
      VENDORS="realestate_vendors", MATERIALS="realestate_materials",
      QUOTES="realestate_quotes", AGENTS="realestate_agents",
      OPTIONS="realestate_options",
      WORKLOG="realestate_worklog", TODOS="realestate_todos";
const AI_MODEL = "claude-sonnet-4-6";

/* ===== 기본 옵션값 (Firestore의 사용자 추가분이 합쳐짐) ===== */
const DEFAULT_OPTS = {
  stages:[
    "임장(현장조사)","계약·잔금(매수)",
    "철거","페인트(도장)","샷시/창호","목공","설비·배관",
    "타일·방수","전기·조명","필름","도배","바닥(마루/장판)·전기마감",
    "싱크대·가구","기타",
    "매도(계약·잔금)"
  ],
  kinds:["자재비","공사비","식비","톨비(통행료)","주유·가스","주차비","사진","연락","서류","문제","메모","기타비용"],
  pays:["세금계산서","은행이체","카드","현금","기타"],
  etc_cats:[
    "식비","교통/주유비","톨비(통행료)","가스충전비",
    "관리비","도시가스","대출이자",
    "등기비","등기 수수료(법무)","취득세","중개 수수료",
    "보험료","예비비","기타"
  ],
  vendor_roles:[
    "임장(현장조사)","계약·잔금(매수)","철거","페인트(도장)","샷시/창호","목공",
    "설비·배관","타일·방수","전기·조명","필름","도배","바닥(마루/장판)·전기마감",
    "싱크대·가구","기타","매도(계약·잔금)","중개","법무"
  ],
  photo_folders:[
    "임장 사진","인테리어 전","인테리어 중","인테리어 후",
    "자재 관련","하자·문제","계약·잔금 현장","영수증·증빙","참고 사진","기타 사진"
  ],
  doc_folders:[
    "매매계약서","등기 관련 서류","세금계산서","영수증·이체확인증",
    "취득세·세금 납부","관리비·공과금","대출 서류","인감·신분 서류",
    "견적서·계약서(공사)","양도소득세 자료","기타 서류"
  ],
  mat_spaces:["거실","주방","안방","작은방","드레스룸","욕실(공용)","욕실(안방)","현관","발코니/베란다","복도","전체/공용","기타"],
  mat_cats:["타일","도배(벽지)","바닥재(마루/장판)","페인트/도장","필름","싱크대/주방가구","붙박이장/가구","조명/등기구","스위치/콘센트","위생기구(양변기/세면대)","수전/밸브","문/도어","창호/샷시","몰딩/걸레받이","실리콘/방수","단열/보온재","목자재(합판/석고)","철물/하드웨어","기타"],
  mat_units:["EA(개)","㎡","평","m(미터)","box(박스)","롤","통","set(세트)","장","자","포","말"],
  wk_kinds:["식비","톨비(통행료)","주유·가스","주차비","숙박비","기타"]
};

/* ===== 비용 종류 통일 체계 =====
   세 곳(기록추가 / 주말세트 / 비용수정)이 모두 이 체계를 사용.
   - 종류(kind): 자재비/공사비 + 아래 기타 종류들
   - 종류별 세부항목(sub): SUB_CATS 매핑. (자재비/공사비는 공정별 stage_cat) */
const COST_KINDS = ["자재비","공사비","부동산 매수비용","부동산 매도비용","식비","주유·가스","톨비(통행료)","주차비","택배비","관리비","도시가스","대출이자","등기비","취득세","중개 수수료","보험료","숙박비","예비비","기타비용"];
const SUB_CATS = {
  "부동산 매수비용":["매매대금(계약금)","매매대금(중도금)","매매대금(잔금)","취득세","지방교육세","농어촌특별세","국민주택채권","법무사 수수료","중개 수수료","인지세","이사비","기타"],
  "부동산 매도비용":["받은 계약금","받은 중도금","받은 잔금","양도소득세","지방소득세","중개 수수료","법무사/대행 비용","퇴거합의금","기타"],
  "식비":["아침","점심","저녁","집간식","현장간식","기타"],
  "톨비(통행료)":["상행","하행"],
  "주유·가스":["휘발유 상행","휘발유 하행","휘발유 충전","가스 상행","가스 하행","가스 충전"],
  "주차비":["현장","기타"],
  "택배비":["자재 배송","택배","퀵/화물","기타"],
  "관리비":[], "도시가스":[], "대출이자":[], "등기비":["취득세","국민주택채권","법무사 수수료","인지세"], "취득세":[],
  "중개 수수료":["매수","매도"], "보험료":[], "숙박비":[], "예비비":[], "기타비용":[]
};
/* 공사비(인건비·시공·장비·폐기물 등) 세부 — 공정 무관 공통 */
const CONSTRUCTION_CATS = ["인건비/일당","시공비(공임)","장비/사다리차","폐기물 처리","운반/상하차","철거 인건비","보양 작업","부대 공사","기타"];
/* 종류에 맞는 세부항목 목록 반환
   - 자재비: 공정별 자재 목록 (DEFAULT_STAGE_CATS / 사용자 추가 stage_cat_*)
   - 공사비: 인건비·시공비 등 (CONSTRUCTION_CATS / 사용자 추가 sub_공사비) */
function subCatsFor(kind, stage){
  if(kind==="자재비"){
    if(stage){ return opts("stage_cat_"+stage); }
    // 공정 미선택: 전체 자재를 한 번에 보여주기보다 공통 안내
    return opts("stage_cat_공통");
  }
  if(kind==="공사비"){
    const extra = userOpts["sub_공사비"] || [];
    const out=[]; const seen=new Set();
    CONSTRUCTION_CATS.concat(extra).forEach(v=>{ if(v&&!seen.has(v)){ seen.add(v); out.push(v); }});
    return out;
  }
  const base = SUB_CATS[kind] || [];
  const extra = userOpts["sub_"+kind] || [];
  const out=[]; const seen=new Set();
  base.concat(extra).forEach(v=>{ if(v && !seen.has(v)){ seen.add(v); out.push(v); }});
  return out;
}
/* 주말 비용으로 저장할 때 통계 분류(cat)를 표준화 */
function statCatOf(kind){
  if(kind==="주유·가스") return "교통/주유비";
  return kind;
}

/* 공정별 자재(세부 항목) — 기본값. 사용자 추가분은 stage_cats[stage] 키로 합쳐짐 */
const COMMON_CATS = ["인건비/일당","장비/사다리차","폐기물 처리","자재 배송비","부속/잡자재","기타"];
const DEFAULT_STAGE_CATS = {
  "임장(현장조사)": ["교통/주유비","톨비(통행료)","식비","감정/조사 비용","중개 상담비","기타"],
  "계약·잔금(매수)": ["계약금","중도금","잔금","중개 수수료","법무사 비용","취득세","인지세","채권 매입","기타"],
  "매도(계약·잔금)": ["받은 계약금","받은 중도금","받은 잔금","중개 수수료","양도소득세","법무사/대행 비용","기타"],
  "철거": ["철거 인건비","폐기물 처리","종량제봉투","보양재(엘베/바닥)","사다리차"],
  "페인트(도장)": ["수성페인트","유성페인트","젯소/프라이머","퍼티","롤러/붓/트레이","마스킹테이프","사포"],
  "샷시/창호": ["샷시(하이/시스템)","유리","방충망","실리콘/우레탄폼","창호 부속"],
  "목공": ["석고보드(9.5T)","합판(4.5T)","MDF(9T/18T)","각재(다루끼/한치)","투바이(2x4)","도어/도어틀","몰딩","걸레받이","피스/타카핀","목공본드"],
  "설비·배관": ["급수/배수 배관","분배기","방통(방바닥)","미장 몰탈","방수재","양변기/세면대 부속","트랩"],
  "타일·방수": ["타일(벽/바닥)","압착시멘트/드라이픽스","에폭시 접착제","메지(줄눈)","방수액/방수페인트","실리콘","타일 스페이서","배수트랩","프라이머"],
  "전기·조명": ["조명(등기구)","스위치/콘센트","전선/케이블","차단기/분전반","배관/배선몰드","인터넷/통신선"],
  "필름": ["인테리어 필름","프라이머","헤라/스퀴지","필름 부자재"],
  "도배": ["합지 벽지","실크 벽지","도배풀/본드","초배지","부직포","퍼티(벽면)"],
  "바닥(마루/장판)·전기마감": ["강마루/강화마루","원목마루","장판","바닥 본드/접착제","걸레받이","확장 프로파일","보양재","전기 마감(스위치/조명 설치)"],
  "싱크대·가구": ["싱크대","상부장/하부장","상판(인조대리석/세라믹)","붙박이장","신발장","손잡이/경첩","실리콘 마감"],
  "기타": ["입주청소 용역","청소용품/소모품","폐기물 추가처리","보수/하자처리","기타 비용"]
};

/* 임장·계약·매도 체크리스트 — 기존 유지 */
const STAGE_CHECKLIST = {
  "임장(현장조사)": [
    {t:"입지·교통·역세권", f:["memo"]},
    {t:"단지 규모·세대수", f:["sedae"]},
    {t:"연식(준공연도)", f:["year"]},
    {t:"층/향/조망·일조량", f:["memo"]},
    {t:"누수·결로·곰팡이", f:["memo"], doc:true},
    {t:"수압·배수·난방", f:["memo"]},
    {t:"주차 (대수/세대수)", f:["parking"]},
    {t:"학군·편의시설 거리", f:["dist"]},
    {t:"채광·소음·층간소음", f:["memo"]},
    {t:"최근 실거래가·매물 시세", f:["price3"], doc:true},
    {t:"향후 개발 호재/악재", f:["memo"]},
    {t:"종합 메모", f:["memo"]}
  ],
  "계약·잔금(매수)": [
    {t:"【계약】 등기부등본 발급·확인", f:["memo"], doc:true},
    {t:"【계약】 소유자=계약자 신분 대조", f:["memo"]},
    {t:"【계약】 근저당·가압류 등 권리관계", f:["memo"]},
    {t:"【계약】 부동산 표시 등기부 일치", f:["memo"]},
    {t:"【계약】 대금·지급일정 명시", f:["memo"]},
    {t:"【계약】 계약금 입금·영수증·특약", f:["amount","date"], doc:true},
    {t:"【잔금】 잔금 직전 등기부 재발급", f:["date"], doc:true},
    {t:"【잔금】 등기권리증·인감증명서 수령", f:["memo"], doc:true},
    {t:"【잔금】 중도금", f:["amount","date"]},
    {t:"【잔금】 잔금 지급·열쇠 인수", f:["amount","date"], doc:true},
    {t:"【잔금】 관리비·공과금 정산", f:["memo"], doc:true},
    {t:"【잔금】 중개수수료", f:["amount"], doc:true},
    {t:"【등기】 취득세·인지세 납부", f:["amount","date"], doc:true},
    {t:"【등기】 60일내 이전등기 신청", f:["date"], doc:true},
    {t:"【등기】 법무사 비용", f:["amount"], doc:true},
    {t:"【기타】 전입신고·확정일자", f:["date"]},
    {t:"【기타】 대출 실행", f:["amount","date"]},
    {t:"【기타】 화재보험·이사일정", f:["memo"]}
  ],
  "매도(계약·잔금)": [
    {t:"【준비】 매도가·주변 시세 확인", f:["price3"]},
    {t:"【준비】 등기권리증 보관 확인", f:["memo"]},
    {t:"【준비】 대출(근저당) 잔액·상환", f:["amount"]},
    {t:"【계약】 매수인 신분확인·계약서", f:["memo"], doc:true},
    {t:"【계약】 계약금 수령·영수증·특약", f:["amount","date"], doc:true},
    {t:"【계약】 30일내 실거래가 신고", f:["date"], doc:true},
    {t:"【잔금】 잔금 직전 등기부 재발급", f:["date"], doc:true},
    {t:"【잔금】 잔고증명·권리관계 해제", f:["memo"], doc:true},
    {t:"【잔금】 신분증·등기권리증·인감도장", f:["memo"]},
    {t:"【잔금】 매도용 인감증명서 발급", f:["memo"], doc:true},
    {t:"【잔금】 주민등록초본 준비", f:["memo"]},
    {t:"【잔금】 세금·공과금·관리비 정산", f:["memo"], doc:true},
    {t:"【잔금】 잔금 수령·열쇠 인계", f:["amount","date"], doc:true},
    {t:"【잔금】 중개수수료 지급", f:["amount"], doc:true},
    {t:"【등기】 이전등기 서류 교부", f:["memo"]},
    {t:"【세금】 양도세 예정신고(2개월내)", f:["amount","date"], doc:true},
    {t:"【세금】 양도차익·필요경비 정리", f:["memo"], doc:true},
    {t:"【기타】 관리사무소 명의변경 통보", f:["memo"]}
  ]
};

/* ===== 사용자 추가 옵션 (Firestore에 저장) =====
   문서 ID = 카테고리 키, 데이터 = {items:[...]} */
let userOpts = {};   // 예: { stages:[...], kinds:[...], 'stage_cat_도배':[...] }
async function loadUserOpts(){
  try{
    const snap=await db.collection(OPTIONS).get();
    snap.forEach(d=>{ userOpts[d.id]=(d.data().items||[]); });
  }catch(err){ console.warn("옵션 로드 실패", err); }
}
async function saveUserOpts(key){
  try{
    await db.collection(OPTIONS).doc(key).set({items:userOpts[key]||[]});
  }catch(err){ showError("옵션 저장 ("+key+")", err); }
}
/* 어떤 카테고리의 최종 목록 = 기본값 + 사용자 추가값 (중복 제거) */
function opts(key){
  let base=[];
  if(key.startsWith("stage_cat_")){
    const stage=key.replace("stage_cat_","");
    base=(DEFAULT_STAGE_CATS[stage]||[]).concat(COMMON_CATS);
  } else {
    base=DEFAULT_OPTS[key]||[];
  }
  const extra=userOpts[key]||[];
  const out=[]; const seen=new Set();
  base.concat(extra).forEach(v=>{ if(v && !seen.has(v)){ seen.add(v); out.push(v); }});
  return out;
}

/* ===== 셀렉트 + "+ 직접 추가" 통합 위젯 ===== */
/* 컨테이너 div 안에 <select id=...> + 옆에 + 버튼을 채워준다.
   optKey 는 userOpts의 키. extraTail 은 매번 마지막에 붙는 옵션(예: '(공정 선택 안 함)') */
function buildOptSelect(selectId, optKey, selectedVal, extraHead){
  const list=opts(optKey);
  const sel=document.getElementById(selectId);
  if(!sel) return;
  let html="";
  if(extraHead){ html+=`<option value="">${esc(extraHead)}</option>`; }
  list.forEach(v=>{ html+=`<option ${v===selectedVal?'selected':''}>${esc(v)}</option>`; });
  // 선택값이 목록에 없을 때 살려두기
  if(selectedVal && !list.includes(selectedVal)){
    html+=`<option selected>${esc(selectedVal)}</option>`;
  }
  sel.innerHTML=html;
  // 옆에 + 버튼을 부모에 자동으로 끼움 (없으면 생성, 있으면 키만 갱신)
  const wrap=sel.parentElement;
  if(wrap && wrap.classList.contains('opt-row')){
    const btn=wrap.querySelector('.opt-add');
    if(btn) btn.onclick=()=>openAddOpt(optKey, selectId);
  } else if(wrap && wrap.classList.contains('field')){
    const row=document.createElement('div'); row.className='opt-row';
    sel.parentNode.insertBefore(row, sel);
    row.appendChild(sel);
    const btn=document.createElement('button'); btn.type='button'; btn.className='opt-add';
    btn.textContent='+ 직접 추가';
    btn.onclick=()=>openAddOpt(optKey, selectId);
    row.appendChild(btn);
  }
}
/* 옵션 추가/삭제 모달 */
let _addOptKey=null, _addOptTarget=null;
function optLabelOf(optKey){
  if(optKey.startsWith('stage_cat_')) return '"'+optKey.replace('stage_cat_','')+'" 공정의 세부 항목';
  return OPT_LABELS[optKey] || "이 목록";
}
function openAddOpt(optKey, selectId){
  _addOptKey=optKey; _addOptTarget=selectId;
  document.getElementById("addOptTitle").textContent=optLabelOf(optKey)+" 관리";
  document.getElementById("addOptHint").textContent="새 항목을 추가하거나, 직접 추가한 항목을 삭제할 수 있습니다.";
  document.getElementById("addOptInput").value="";
  renderAddOptList();
  openModal("addOptModal");
  setTimeout(()=>document.getElementById("addOptInput").focus(),120);
}
/* 내가 추가한 항목 목록 (각각 삭제 버튼) */
function renderAddOptList(){
  const box=document.getElementById("addOptList"); if(!box) return;
  const mine=(userOpts[_addOptKey]||[]);
  if(!mine.length){ box.innerHTML='<div class="hint" style="margin:2px 0">아직 직접 추가한 항목이 없습니다.</div>'; return; }
  box.innerHTML=mine.map(v=>`<div class="opt-manage-row">
    <span>${esc(v)}</span>
    <button class="opt-del-btn" title="삭제" onclick="deleteUserOpt('${jsstr(v)}')">삭제</button>
  </div>`).join("");
}
async function deleteUserOpt(v){
  if(!_addOptKey) return;
  if(!confirm('"'+v+'" 항목을 삭제할까요?\n\n이미 이 값으로 저장된 기록은 그대로 남습니다.')) return;
  userOpts[_addOptKey]=(userOpts[_addOptKey]||[]).filter(x=>x!==v);
  await saveUserOpts(_addOptKey);
  renderAddOptList();
  // 이 옵션을 쓰는 select(모달 안 단위 등)를 다시 그림
  if(_addOptTarget){
    const sel=document.getElementById(_addOptTarget);
    if(sel){
      const headOpt = sel.options[0] && sel.options[0].value==="" ? sel.options[0].text : null;
      const curVal = (sel.value===v) ? "" : sel.value;  // 지운 값이 선택돼 있었으면 비움
      buildOptSelect(_addOptTarget, _addOptKey, curVal, headOpt);
    }
  }
  refreshOptConsumers(); // 화면의 셀렉트/탭 갱신
}
async function confirmAddOpt(){
  const v=document.getElementById("addOptInput").value.trim();
  if(!v){ alert("이름을 입력하세요."); return; }
  if(!userOpts[_addOptKey]) userOpts[_addOptKey]=[];
  if(userOpts[_addOptKey].includes(v) || opts(_addOptKey).includes(v)){
    alert("이미 있는 항목입니다.");
  } else {
    userOpts[_addOptKey].push(v);
    await saveUserOpts(_addOptKey);
  }
  document.getElementById("addOptInput").value="";
  document.getElementById("addOptInput").focus();
  renderAddOptList();
  // 호출한 셀렉트를 새 옵션이 선택된 상태로 다시 채움
  if(_addOptTarget){
    const sel=document.getElementById(_addOptTarget);
    if(sel){
      const headOpt = sel.options[0] && sel.options[0].value==="" ? sel.options[0].text : null;
      buildOptSelect(_addOptTarget, _addOptKey, v, headOpt);
      sel.dispatchEvent(new Event('change'));
    }
  }
  refreshOptConsumers();
}
/* 옵션 변경 후 화면 갱신 (현재 탭) */
function refreshOptConsumers(){
  if(OPT_REFRESH_TAB[_addOptKey] && currentProjectId){
    const p=projects.find(x=>x.id===currentProjectId); if(p) renderTab(p);
  }
}
/* 옵션 추가/삭제 직후, 현재 탭에 바로 반영이 필요한 키들 */
const OPT_REFRESH_TAB={ stages:true, photo_folders:true, doc_folders:true };
/* 카테고리별 한글 라벨 (옵션 모달 안내 문구용) */
const OPT_LABELS={
  stages:"공정 단계", kinds:"기록 종류", pays:"결제 수단",
  etc_cats:"기타 비용 항목", vendor_roles:"업체 공종/역할",
  photo_folders:"사진 폴더", doc_folders:"서류 폴더",
  mat_spaces:"자재 공간", mat_cats:"자재 분류", mat_units:"자재 단위",
  wk_kinds:"주말 비용 종류"
};

/* ===== 환율 (USD → KRW) ===== */
let _fxRate=null, _fxDate=null;
async function loadFxRate(){
  // 캐시: localStorage 'fx_usdkrw' = {rate, date(YYYY-MM-DD)}
  const today_=today();
  try{
    const cached=JSON.parse(localStorage.getItem('fx_usdkrw')||"null");
    if(cached && cached.date===today_ && cached.rate>0){
      _fxRate=cached.rate; _fxDate=cached.date; updateFxBadge(); return;
    }
  }catch(_){}
  // 우선 시도: open.er-api.com (인증 필요 없음). 실패 시 다른 무료 소스로 폴백.
  const tryUrls=[
    "https://open.er-api.com/v6/latest/USD",     // resp.rates.KRW
    "https://api.exchangerate-api.com/v4/latest/USD"
  ];
  for(const url of tryUrls){
    try{
      const r=await fetch(url);
      if(!r.ok) continue;
      const d=await r.json();
      const k=(d.rates && d.rates.KRW) || (d.conversion_rates && d.conversion_rates.KRW);
      if(k && k>0){
        _fxRate=Number(k); _fxDate=today_;
        try{ localStorage.setItem('fx_usdkrw', JSON.stringify({rate:_fxRate, date:_fxDate})); }catch(_){}
        updateFxBadge();
        return;
      }
    }catch(_){}
  }
  // 모두 실패 시 직전 캐시라도 사용
  try{
    const cached=JSON.parse(localStorage.getItem('fx_usdkrw')||"null");
    if(cached && cached.rate>0){ _fxRate=cached.rate; _fxDate=cached.date; updateFxBadge(); return; }
  }catch(_){}
  updateFxBadge();
}
function updateFxBadge(){
  const b=document.getElementById("fxBadge");
  if(!b) return;
  if(_fxRate){
    b.textContent="$1 = "+Math.round(_fxRate).toLocaleString()+"원";
    b.title="환율 ("+ (_fxDate||'') +" 기준) · 클릭해서 수동 입력";
  } else {
    b.textContent="$1 = 입력 필요";
    b.title="환율을 가져오지 못했습니다. 클릭해서 수동 입력하세요.";
  }
  b.onclick=()=>{
    const cur=_fxRate||1350;
    const v=prompt("USD→KRW 환율을 수동으로 입력하세요.\n(원/달러)", cur);
    if(v===null) return;
    const n=Number(v);
    if(!n||n<=0){ alert("숫자를 입력하세요."); return; }
    _fxRate=n; _fxDate=today();
    try{ localStorage.setItem('fx_usdkrw', JSON.stringify({rate:_fxRate, date:_fxDate})); }catch(_){}
    updateFxBadge();
  };
}
/* 입력 금액을 KRW로 환산 (currency가 USD면 환율 곱하기) */
function toKRW(amount, currency){
  const a=Number(amount)||0;
  if(currency==="USD"){
    if(!_fxRate) return null;  // 환율 없으면 null
    return Math.round(a*_fxRate);
  }
  return a;
}
/* 자재 모달 환산 표시 */
function updateMatAmount(){
  const up=Number(val("mf_unitprice"))||0;
  const q=Number(val("mf_qty"))||0;
  const cur=val("mf_currency")||"KRW";
  let amtKRW;
  if(cur==="USD"){
    if(!_fxRate){ document.getElementById("mf_amount").textContent="환율 입력 필요"; document.getElementById("mf_fxhint").textContent="상단 $1=… 배지를 눌러 환율을 입력하세요."; return; }
    amtKRW = Math.round(up*_fxRate)*q;
    document.getElementById("mf_fxhint").textContent="$"+up.toLocaleString()+" × "+_fxRate.toLocaleString()+"원 = "+Math.round(up*_fxRate).toLocaleString()+"원/단위";
  } else {
    amtKRW = up*q;
    document.getElementById("mf_fxhint").textContent="";
  }
  document.getElementById("mf_amount").textContent=amtKRW.toLocaleString()+"원";
}
/* 기록 모달 환산 표시 */
function updateEntryFx(){
  const a=Number(val("ef_amount"))||0;
  const cur=val("ef_currency")||"KRW";
  const hint=document.getElementById("ef_fxhint");
  if(cur==="USD"){
    if(!_fxRate){ hint.textContent="환율 없음 — 상단 $1=… 배지를 눌러 입력하세요."; return; }
    const krw=Math.round(a*_fxRate);
    hint.textContent="$"+a.toLocaleString()+" → "+krw.toLocaleString()+"원 (환율 "+_fxRate.toLocaleString()+")";
  } else hint.textContent="";
}
/* 견적 모달 환산 표시 */
function updateQuoteFx(){
  const a=Number(val("qf_amount"))||0;
  const cur=val("qf_currency")||"KRW";
  const hint=document.getElementById("qf_fxhint");
  if(cur==="USD"){
    if(!_fxRate){ hint.textContent="환율 없음 — 상단 배지에서 입력하세요."; return; }
    hint.textContent="$"+a.toLocaleString()+" → "+Math.round(a*_fxRate).toLocaleString()+"원";
  } else hint.textContent="";
}

/* ===== 상태 ===== */
let projects=[], currentProjectId=null;
let entries=[], vendors=[], materials=[], quotes=[], agents=[], worklogs=[], todos=[];
let activeTab="대시보드";
let costFilter={stage:"전체",kind:"전체",pay:"전체",q:""};
let searchQ="";
let chatHistory=[];

/* ===== 유틸 ===== */
function val(id){return document.getElementById(id).value;}
function today(){return new Date().toISOString().slice(0,10);}

/* ================================================================
   📂 공통자료 — 5개 섹션 (프로젝트 무관, 공통 Firebase 컬렉션)
   ================================================================ */
let _cmTab = "vendor";
let _cmEditId = null, _cmEditCol = null;
let _cmVendors=[], _cmPrices=[], _cmChks=[], _cmDocs=[], _cmRefs=[];
let _cmRefFiles=[];   // 현재 서브모달에서 임시 보관 중인 첨부파일 [{name,url,type,path}]
let _cmRefDelFiles=[]; // 수정 시 삭제할 파일 경로 목록
let _cmLoaded = false;
let _cmChkStage="임장", _cmDocStage="매수";
let _cmVendorFilter="전체";

/* 기본 데이터 */
const CM_CHK_DEFAULTS=[
  {stage:"임장",text:"등기부등본 확인 (근저당·가압류)",done:false},
  {stage:"임장",text:"건축물대장 확인 (위반건축물 여부)",done:false},
  {stage:"임장",text:"실측 면적 확인",done:false},
  {stage:"임장",text:"주변 시세 비교 (3개 이상)",done:false},
  {stage:"임장",text:"누수·결로·곰팡이 점검",done:false},
  {stage:"계약",text:"계약서 특약사항 확인",done:false},
  {stage:"계약",text:"계약금 10% 이체",done:false},
  {stage:"계약",text:"잔금일 협의",done:false},
  {stage:"공사",text:"인테리어 업체 견적 3곳 이상",done:false},
  {stage:"공사",text:"공사 일정표 작성",done:false},
  {stage:"공사",text:"중간 점검 (타일·목공 완료 후)",done:false},
  {stage:"공사",text:"준공 점검 (입주 청소 전)",done:false},
  {stage:"매도",text:"매도 호가 설정",done:false},
  {stage:"매도",text:"공인중개사 3곳 이상 내놓기",done:false},
  {stage:"매도",text:"양도세 신고 준비",done:false},
];
const CM_DOC_DEFAULTS=[
  {stage:"매수",text:"등기부등본",done:false},
  {stage:"매수",text:"건축물대장",done:false},
  {stage:"매수",text:"매매계약서 원본",done:false},
  {stage:"매수",text:"인감증명서 (매도인)",done:false},
  {stage:"매도",text:"등기권리증",done:false},
  {stage:"매도",text:"인감도장·인감증명",done:false},
  {stage:"매도",text:"주민등록등본",done:false},
  {stage:"대출",text:"소득증빙서류",done:false},
  {stage:"대출",text:"재직증명서",done:false},
  {stage:"공통",text:"신분증 사본",done:false},
  {stage:"공통",text:"통장 사본",done:false},
];
const VENDOR_CATS=["전체","목공","타일","도배","설비","전기","페인트","샷시","청소","철거","기타"];

/* ---- 모달 열기/닫기 ---- */
async function openCommonData(){
  document.getElementById("commonDataModal").classList.add("open");
  if(!_cmLoaded){ await loadCmData(); _cmLoaded=true; }
  renderCmContent();
}
function closeCommonData(){ document.getElementById("commonDataModal").classList.remove("open"); }
function closeCmSubModal(){
  document.getElementById("cmSubModal").classList.remove("open");
  // 임시 object URL 해제
  _cmRefFiles.forEach(f=>{if(f._pending&&f.url)try{URL.revokeObjectURL(f.url);}catch(_){}});
  _cmRefFiles=[]; _cmRefDelFiles=[];
  _cmEditId=null; _cmEditCol=null;
}

/* ---- 데이터 로드 ---- */
async function loadCmData(){
  try{
    const [v,p,c,d,r]=await Promise.all([
      db.collection(CM_VENDOR).get(),
      db.collection(CM_PRICE).get(),
      db.collection(CM_CHK).get(),
      db.collection(CM_DOC).get(),
      db.collection(CM_REF).get(),
    ]);
    _cmVendors=v.docs.map(d=>({id:d.id,...d.data()}));
    _cmPrices=p.docs.map(d=>({id:d.id,...d.data()}));
    _cmChks=c.docs.map(d=>({id:d.id,...d.data()}));
    _cmDocs=d.docs.map(d=>({id:d.id,...d.data()}));
    _cmRefs=r.docs.map(d=>({id:d.id,...d.data()}));
    // 기본 데이터 삽입 (최초 1회)
    if(!_cmChks.length){ for(const x of CM_CHK_DEFAULTS){ const ref=db.collection(CM_CHK).doc(); await ref.set({...x,createdAt:Date.now()}); _cmChks.push({id:ref.id,...x,createdAt:Date.now()}); } }
    if(!_cmDocs.length){ for(const x of CM_DOC_DEFAULTS){ const ref=db.collection(CM_DOC).doc(); await ref.set({...x,createdAt:Date.now()}); _cmDocs.push({id:ref.id,...x,createdAt:Date.now()}); } }
  }catch(e){ showError("공통자료 로드",e); }
}

/* ---- 탭 전환 ---- */
function setCmTab(tab, btn){
  _cmTab=tab;
  document.querySelectorAll("#cmTabRow .cm-tab").forEach(b=>b.classList.remove("active"));
  if(btn) btn.classList.add("active");
  renderCmContent();
}
function renderCmContent(){
  const el=document.getElementById("cmContent"); if(!el)return;
  if(_cmTab==="vendor") el.innerHTML=renderCmVendorHtml();
  else if(_cmTab==="price") el.innerHTML=renderCmPriceHtml();
  else if(_cmTab==="checklist") el.innerHTML=renderCmChkHtml();
  else if(_cmTab==="doc") el.innerHTML=renderCmDocHtml();
  else if(_cmTab==="ref") el.innerHTML=renderCmRefHtml();
}

/* ================================================================
   ① 업체 연락처
   ================================================================ */
function renderCmVendorHtml(){
  const q=(document.getElementById("cmVSearch")?.value||"").toLowerCase();
  let arr=_cmVendors.filter(v=>{
    if(_cmVendorFilter!=="전체"&&v.field!==_cmVendorFilter)return false;
    if(q&&!((v.name+v.phone+v.field+v.note||"").toLowerCase().includes(q)))return false;
    return true;
  }).sort((a,b)=>(a.field||"").localeCompare(b.field||""));

  const chips=VENDOR_CATS.map(c=>`<button class="cm-chip${_cmVendorFilter===c?" on":""}" onclick="_cmVendorFilter='${c}';renderCmContent()">${c}</button>`).join("");
  const rows=arr.length?arr.map(v=>`
    <tr onclick="cmVendorEdit('${v.id}')" style="cursor:pointer">
      <td><span class="cm-field-badge">${esc(v.field||"기타")}</span></td>
      <td style="font-weight:600">${esc(v.name||"")}</td>
      <td><a href="tel:${esc(v.phone||"")}" onclick="event.stopPropagation()" style="color:var(--accent);text-decoration:none">${esc(v.phone||"")}</a></td>
      <td>${v.stars?"⭐".repeat(Math.min(5,v.stars)):""}</td>
      <td style="color:#888;font-size:12px">${esc(v.note||"")}</td>
    </tr>`).join("")
    :`<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px">업체가 없어요</td></tr>`;

  return `<div style="margin-bottom:10px;display:flex;gap:6px;justify-content:space-between;align-items:center">
    <div style="display:flex;gap:6px;flex-wrap:wrap">${chips}</div>
    <button class="btn btn-primary btn-sm" onclick="cmVendorAdd()">＋ 업체 추가</button>
  </div>
  <input id="cmVSearch" placeholder="🔍 업체명·전화·분야 검색" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;margin-bottom:10px" oninput="renderCmContent()">
  <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13.5px">
    <thead><tr style="background:var(--row-even)">
      <th style="padding:8px 10px;text-align:left;font-size:12px;border-bottom:1px solid var(--line)">분야</th>
      <th style="padding:8px 10px;text-align:left">상호명</th>
      <th style="padding:8px 10px;text-align:left">전화</th>
      <th style="padding:8px 10px;text-align:left">평점</th>
      <th style="padding:8px 10px;text-align:left">메모</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}
function cmVendorAdd(){
  _cmEditId=null; _cmEditCol=CM_VENDOR;
  document.getElementById("cmSubTitle").textContent="📞 업체 추가";
  document.getElementById("cmSubDelBtn").style.display="none";
  document.getElementById("cmSubBody").innerHTML=cmVendorForm({});
  document.getElementById("cmSubModal").classList.add("open");
}
function cmVendorEdit(id){
  const v=_cmVendors.find(x=>x.id===id); if(!v)return;
  _cmEditId=id; _cmEditCol=CM_VENDOR;
  document.getElementById("cmSubTitle").textContent="📞 업체 수정";
  document.getElementById("cmSubDelBtn").style.display="";
  document.getElementById("cmSubBody").innerHTML=cmVendorForm(v);
  document.getElementById("cmSubModal").classList.add("open");
}
function cmVendorForm(v){
  const starsOpts=[1,2,3,4,5].map(n=>`<option value="${n}"${v.stars==n?" selected":""}>${"⭐".repeat(n)}</option>`).join("");
  const fieldOpts=VENDOR_CATS.filter(c=>c!=="전체").map(c=>`<option${v.field===c?" selected":""}>${c}</option>`).join("");
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div><label style="font-size:12px;color:#888">분야</label><select id="cmv-field" style="width:100%;padding:7px;border:1px solid var(--line);border-radius:8px"><option value="">선택</option>${fieldOpts}</select></div>
    <div><label style="font-size:12px;color:#888">상호명 *</label><input id="cmv-name" value="${esc(v.name||"")}" placeholder="홍길동 목공" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px"></div>
    <div><label style="font-size:12px;color:#888">전화번호</label><input id="cmv-phone" type="tel" value="${esc(v.phone||"")}" placeholder="010-1234-5678" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px"></div>
    <div><label style="font-size:12px;color:#888">평점</label><select id="cmv-stars" style="width:100%;padding:7px;border:1px solid var(--line);border-radius:8px"><option value="">-</option>${starsOpts}</select></div>
    <div style="grid-column:1/-1"><label style="font-size:12px;color:#888">메모</label><input id="cmv-note" value="${esc(v.note||"")}" placeholder="특기사항, 단가 정보 등" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px"></div>
  </div>`;
}

/* ================================================================
   ② 단가 기준표
   ================================================================ */
const PRICE_GROUPS=["이동/생활","공사/시공","자재/용품","법무/행정","기타"];
let _cmPriceFilter="전체";
function renderCmPriceHtml(){
  let arr=_cmPrices.filter(p=>_cmPriceFilter==="전체"||p.cat===_cmPriceFilter).sort((a,b)=>(a.cat||"").localeCompare(b.cat||""));
  const chips=["전체",...PRICE_GROUPS].map(c=>`<button class="cm-chip${_cmPriceFilter===c?" on":""}" onclick="_cmPriceFilter='${c}';renderCmContent()">${c}</button>`).join("");
  const rows=arr.length?arr.map(p=>`
    <tr onclick="cmPriceEdit('${p.id}')" style="cursor:pointer">
      <td><span class="cm-field-badge">${esc(p.cat||"기타")}</span></td>
      <td style="font-weight:600">${esc(p.item)}</td>
      <td style="color:#888">${esc(p.unit||"")}</td>
      <td style="text-align:right;font-weight:700;color:var(--accent)">${p.minPrice?(Number(p.minPrice)||0).toLocaleString()+"원":"-"}</td>
      <td style="text-align:right;font-weight:700;color:var(--accent)">${p.maxPrice?(Number(p.maxPrice)||0).toLocaleString()+"원":"-"}</td>
      <td style="color:#888;font-size:12px">${esc(p.note||"")}</td>
    </tr>`).join("")
    :`<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px">단가 기준이 없어요</td></tr>`;
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div style="display:flex;gap:6px;flex-wrap:wrap">${chips}</div>
    <button class="btn btn-primary btn-sm" onclick="cmPriceAdd()">＋ 항목 추가</button>
  </div>
  <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13.5px">
    <thead><tr style="background:var(--row-even)">
      <th style="padding:8px 10px;font-size:12px;border-bottom:1px solid var(--line)">카테고리</th>
      <th style="padding:8px 10px">항목</th><th style="padding:8px 10px">단위</th>
      <th style="padding:8px 10px;text-align:right">최저</th>
      <th style="padding:8px 10px;text-align:right">최고</th>
      <th style="padding:8px 10px">메모</th>
    </tr></thead><tbody>${rows}</tbody>
  </table></div>`;
}
function cmPriceAdd(){
  _cmEditId=null; _cmEditCol=CM_PRICE;
  document.getElementById("cmSubTitle").textContent="💰 단가 추가";
  document.getElementById("cmSubDelBtn").style.display="none";
  document.getElementById("cmSubBody").innerHTML=cmPriceForm({});
  document.getElementById("cmSubModal").classList.add("open");
}
function cmPriceEdit(id){
  const p=_cmPrices.find(x=>x.id===id); if(!p)return;
  _cmEditId=id; _cmEditCol=CM_PRICE;
  document.getElementById("cmSubTitle").textContent="💰 단가 수정";
  document.getElementById("cmSubDelBtn").style.display="";
  document.getElementById("cmSubBody").innerHTML=cmPriceForm(p);
  document.getElementById("cmSubModal").classList.add("open");
}
function cmPriceForm(p){
  const catOpts=PRICE_GROUPS.map(c=>`<option${p.cat===c?" selected":""}>${c}</option>`).join("");
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div><label style="font-size:12px;color:#888">카테고리</label><select id="cmp-cat" style="width:100%;padding:7px;border:1px solid var(--line);border-radius:8px">${catOpts}</select></div>
    <div><label style="font-size:12px;color:#888">항목명 *</label><input id="cmp-item" value="${esc(p.item||"")}" placeholder="도배(합지)" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px"></div>
    <div><label style="font-size:12px;color:#888">단위</label><input id="cmp-unit" value="${esc(p.unit||"")}" placeholder="평당, m²" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px"></div>
    <div><label style="font-size:12px;color:#888">최저 단가(원)</label><input id="cmp-min" type="number" value="${p.minPrice||""}" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px"></div>
    <div><label style="font-size:12px;color:#888">최고 단가(원)</label><input id="cmp-max" type="number" value="${p.maxPrice||""}" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px"></div>
    <div><label style="font-size:12px;color:#888">메모</label><input id="cmp-note" value="${esc(p.note||"")}" placeholder="지역·시기 기준 등" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px"></div>
  </div>`;
}

/* ================================================================
   ③ 체크리스트 템플릿
   ================================================================ */
function renderCmChkHtml(){
  const stages=["임장","계약","공사","매도","기타"];
  const tabs=stages.map(s=>`<button class="cm-chip${_cmChkStage===s?" on":""}" onclick="_cmChkStage='${s}';renderCmContent()">${s}</button>`).join("");
  const arr=_cmChks.filter(c=>c.stage===_cmChkStage).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const rows=arr.length?arr.map(c=>`
    <div style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--line)">
      <input type="checkbox" ${c.done?"checked":""} onchange="toggleCmChk('${c.id}')" style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent)">
      <span style="flex:1;font-size:14px;${c.done?"text-decoration:line-through;color:#aaa":""}">${esc(c.text||"")}</span>
      <button onclick="cmChkEdit('${c.id}')" style="background:none;border:none;cursor:pointer;color:#aaa;font-size:13px;padding:2px 6px">✏️</button>
    </div>`).join("")
    :`<div style="text-align:center;color:#aaa;padding:20px">항목이 없어요</div>`;
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div style="display:flex;gap:6px;flex-wrap:wrap">${tabs}</div>
    <button class="btn btn-primary btn-sm" onclick="cmChkAdd()">＋ 항목 추가</button>
  </div>${rows}`;
}
function toggleCmChk(id){
  const c=_cmChks.find(x=>x.id===id); if(!c)return;
  c.done=!c.done;
  db.collection(CM_CHK).doc(id).update({done:c.done}).catch(e=>showError("체크",e));
  renderCmContent();
}
function cmChkAdd(){
  _cmEditId=null; _cmEditCol=CM_CHK;
  document.getElementById("cmSubTitle").textContent="✅ 체크 항목 추가";
  document.getElementById("cmSubDelBtn").style.display="none";
  document.getElementById("cmSubBody").innerHTML=cmChkForm({stage:_cmChkStage});
  document.getElementById("cmSubModal").classList.add("open");
}
function cmChkEdit(id){
  const c=_cmChks.find(x=>x.id===id); if(!c)return;
  _cmEditId=id; _cmEditCol=CM_CHK;
  document.getElementById("cmSubTitle").textContent="✅ 항목 수정";
  document.getElementById("cmSubDelBtn").style.display="";
  document.getElementById("cmSubBody").innerHTML=cmChkForm(c);
  document.getElementById("cmSubModal").classList.add("open");
}
function cmChkForm(c){
  const stages=["임장","계약","공사","매도","기타"];
  const opts=stages.map(s=>`<option${c.stage===s?" selected":""}>${s}</option>`).join("");
  return `<div style="display:grid;gap:10px">
    <div><label style="font-size:12px;color:#888">단계</label><select id="cmchk-stage" style="width:100%;padding:7px;border:1px solid var(--line);border-radius:8px">${opts}</select></div>
    <div><label style="font-size:12px;color:#888">내용 *</label><input id="cmchk-text" value="${esc(c.text||"")}" placeholder="확인할 내용" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px"></div>
  </div>`;
}

/* ================================================================
   ④ 서류 목록
   ================================================================ */
function renderCmDocHtml(){
  const stages=["매수","매도","대출","공통"];
  const tabs=stages.map(s=>`<button class="cm-chip${_cmDocStage===s?" on":""}" onclick="_cmDocStage='${s}';renderCmContent()">${s}</button>`).join("");
  const arr=_cmDocs.filter(d=>d.stage===_cmDocStage).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const rows=arr.length?arr.map(d=>`
    <div style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--line)">
      <input type="checkbox" ${d.done?"checked":""} onchange="toggleCmDoc('${d.id}')" style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent)">
      <span style="flex:1;font-size:14px;${d.done?"text-decoration:line-through;color:#aaa":""}">${esc(d.text||"")}</span>
      <button onclick="cmDocEdit('${d.id}')" style="background:none;border:none;cursor:pointer;color:#aaa;font-size:13px">✏️</button>
    </div>`).join("")
    :`<div style="text-align:center;color:#aaa;padding:20px">서류 항목이 없어요</div>`;
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div style="display:flex;gap:6px;flex-wrap:wrap">${tabs}</div>
    <button class="btn btn-primary btn-sm" onclick="cmDocAdd()">＋ 서류 추가</button>
  </div>${rows}`;
}
function toggleCmDoc(id){
  const d=_cmDocs.find(x=>x.id===id); if(!d)return;
  d.done=!d.done;
  db.collection(CM_DOC).doc(id).update({done:d.done}).catch(e=>showError("서류체크",e));
  renderCmContent();
}
function cmDocAdd(){
  _cmEditId=null; _cmEditCol=CM_DOC;
  document.getElementById("cmSubTitle").textContent="📋 서류 추가";
  document.getElementById("cmSubDelBtn").style.display="none";
  document.getElementById("cmSubBody").innerHTML=cmDocForm({stage:_cmDocStage});
  document.getElementById("cmSubModal").classList.add("open");
}
function cmDocEdit(id){
  const d=_cmDocs.find(x=>x.id===id); if(!d)return;
  _cmEditId=id; _cmEditCol=CM_DOC;
  document.getElementById("cmSubTitle").textContent="📋 서류 수정";
  document.getElementById("cmSubDelBtn").style.display="";
  document.getElementById("cmSubBody").innerHTML=cmDocForm(d);
  document.getElementById("cmSubModal").classList.add("open");
}
function cmDocForm(d){
  const stages=["매수","매도","대출","공통"];
  const opts=stages.map(s=>`<option${d.stage===s?" selected":""}>${s}</option>`).join("");
  return `<div style="display:grid;gap:10px">
    <div><label style="font-size:12px;color:#888">단계</label><select id="cmdoc-stage" style="width:100%;padding:7px;border:1px solid var(--line);border-radius:8px">${opts}</select></div>
    <div><label style="font-size:12px;color:#888">서류명 *</label><input id="cmdoc-text" value="${esc(d.text||"")}" placeholder="등기부등본" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px"></div>
  </div>`;
}

/* ================================================================
   ⑤ 참고자료
   ================================================================ */
function renderCmRefHtml(){
  const q=(document.getElementById("cmRefQ")?.value||"").toLowerCase();
  const arr=_cmRefs.filter(r=>!q||(r.title+(r.body||"")).toLowerCase().includes(q)).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  const cards=arr.length?arr.map(r=>{
    // 첨부파일 썸네일
    const files=r.files||[];
    const fileThumbs=files.map(f=>{
      const isImg=(f.type||"").startsWith("image/");
      if(isImg) return `<div class="cmref-thumb" onclick="event.stopPropagation();cmRefViewImg('${f.url}')"><img src="${esc(f.url)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px"></div>`;
      const ext=(f.name||"").split(".").pop().toUpperCase()||"FILE";
      return `<div class="cmref-thumb cmref-file" onclick="event.stopPropagation();window.open('${esc(f.url)}','_blank')"><div class="cmref-ext">${esc(ext)}</div><div class="cmref-fname">${esc(f.name||"")}</div></div>`;
    }).join("");
    return `<div class="cmref-card" onclick="cmRefEdit('${r.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div>
          <div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(r.title||"")}</div>
          ${r.body?`<div style="font-size:13px;color:#888;white-space:pre-wrap;line-height:1.5">${esc(r.body)}</div>`:""}
        </div>
        ${files.length?`<span style="font-size:11px;color:#aaa;white-space:nowrap;flex-shrink:0">📎 ${files.length}개</span>`:""}
      </div>
      ${fileThumbs?`<div class="cmref-thumbs" onclick="event.stopPropagation()">${fileThumbs}</div>`:""}
    </div>`;
  }).join("")
    :`<div style="text-align:center;color:#aaa;padding:20px">참고자료가 없어요 — 위 버튼으로 추가하세요</div>`;
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <input id="cmRefQ" placeholder="🔍 제목·내용 검색" style="flex:1;margin-right:10px;padding:7px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px" oninput="renderCmContent()">
    <button class="btn btn-primary btn-sm" onclick="cmRefAdd()">＋ 추가</button>
  </div>${cards}`;
}
function cmRefViewImg(url){
  const ov=document.getElementById("cmRefImgOverlay")||createCmImgOverlay();
  ov.querySelector("img").src=url;
  ov.style.display="flex";
}
function createCmImgOverlay(){
  const ov=document.createElement("div");
  ov.id="cmRefImgOverlay";
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:99999;display:none;align-items:center;justify-content:center;cursor:zoom-out";
  ov.innerHTML=`<img style="max-width:94vw;max-height:92vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5)">`;
  ov.addEventListener("click",()=>ov.style.display="none");
  document.body.appendChild(ov);
  return ov;
}
function cmRefAdd(){
  _cmEditId=null; _cmEditCol=CM_REF;
  document.getElementById("cmSubTitle").textContent="📁 참고자료 추가";
  document.getElementById("cmSubDelBtn").style.display="none";
  document.getElementById("cmSubBody").innerHTML=cmRefForm({});
  document.getElementById("cmSubModal").classList.add("open");
}
function cmRefEdit(id){
  const r=_cmRefs.find(x=>x.id===id); if(!r)return;
  _cmEditId=id; _cmEditCol=CM_REF;
  document.getElementById("cmSubTitle").textContent="📁 참고자료 수정";
  document.getElementById("cmSubDelBtn").style.display="";
  document.getElementById("cmSubBody").innerHTML=cmRefForm(r);
  document.getElementById("cmSubModal").classList.add("open");
}
function cmRefForm(r){
  // 기존 첨부파일 초기화
  _cmRefFiles=(r.files||[]).slice();
  _cmRefDelFiles=[];
  setTimeout(()=>{ cmRefRenderPreviews(); cmRefBindDrop(); },50);
  return `<div style="display:grid;gap:10px">
    <div><label style="font-size:12px;color:#888">제목 *</label>
      <input id="cmref-title" value="${esc(r.title||"")}" placeholder="예: 도배 시공 참고 / 계약서 사본" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:14px">
    </div>
    <div><label style="font-size:12px;color:#888">메모·URL (선택)</label>
      <textarea id="cmref-body" rows="3" placeholder="참고 링크, 메모, 업체 정보 등" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-family:inherit;resize:vertical;font-size:14px">${esc(r.body||"")}</textarea>
    </div>
    <div>
      <label style="font-size:12px;color:#888">첨부파일 (사진·PDF·문서)</label>
      <div id="cmRefDropZone" class="cmref-dropzone">
        <div class="cmref-dz-inner">
          <div style="font-size:28px;margin-bottom:6px">📎</div>
          <div style="font-size:14px;font-weight:600;color:#666">여기에 파일을 드래그하거나</div>
          <label class="btn btn-line btn-sm" style="cursor:pointer;margin-top:8px">
            클릭해서 파일 선택
            <input type="file" id="cmRefFileInput" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.txt" style="display:none" onchange="cmRefHandleFiles(this.files)">
          </label>
          <div style="font-size:11px;color:#aaa;margin-top:6px">사진·PDF·문서 등 모든 파일 가능</div>
        </div>
      </div>
      <div id="cmRefPreviews" class="cmref-previews"></div>
    </div>
  </div>`;
}
function cmRefBindDrop(){
  const dz=document.getElementById("cmRefDropZone"); if(!dz)return;
  dz.addEventListener("dragover",e=>{e.preventDefault();dz.classList.add("drag-over");});
  dz.addEventListener("dragleave",e=>{if(!dz.contains(e.relatedTarget))dz.classList.remove("drag-over");});
  dz.addEventListener("drop",e=>{
    e.preventDefault();dz.classList.remove("drag-over");
    const files=e.dataTransfer.files; if(files&&files.length)cmRefHandleFiles(files);
  });
}
function cmRefHandleFiles(files){
  const arr=Array.from(files);
  // 미리보기 즉시 표시 (아직 업로드 전, File 객체 보관)
  arr.forEach(f=>{
    _cmRefFiles.push({_file:f, name:f.name, type:f.type, url:URL.createObjectURL(f), _pending:true});
  });
  cmRefRenderPreviews();
}
function cmRefRenderPreviews(){
  const box=document.getElementById("cmRefPreviews"); if(!box)return;
  if(!_cmRefFiles.length){box.innerHTML="";return;}
  box.innerHTML=_cmRefFiles.map((f,i)=>{
    const isImg=(f.type||"").startsWith("image/");
    const ext=(f.name||"").split(".").pop().toUpperCase()||"FILE";
    const pending=f._pending?"<div class='cmref-pending'>업로드 대기</div>":"";
    const thumb=isImg
      ?`<img src="${esc(f.url)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`
      :`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px"><div style="font-size:22px">📄</div><div style="font-size:10px;font-weight:700;color:var(--accent)">${esc(ext)}</div></div>`;
    return `<div class="cmref-prev-item" title="${esc(f.name||"")}">
      <div class="cmref-prev-img" onclick="${isImg?"cmRefViewImg('"+esc(f.url)+"')":"window.open('"+esc(f.url)+"','_blank')"}">${thumb}</div>
      <div style="font-size:10px;color:#888;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((f.name||"").length>14?(f.name||"").slice(0,12)+"..":f.name||"")}</div>
      ${pending}
      <button onclick="cmRefRemoveFile(${i})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
    </div>`;
  }).join("");
}
function cmRefRemoveFile(i){
  const f=_cmRefFiles[i];
  if(f&&!f._pending&&f.path)_cmRefDelFiles.push(f.path); // 실제 삭제 예약
  _cmRefFiles.splice(i,1);
  cmRefRenderPreviews();
}

/* ================================================================
   공통 저장/삭제
   ================================================================ */
async function cmSubSave(){
  try{
    if(_cmEditCol===CM_VENDOR){
      const name=(document.getElementById("cmv-name")?.value||"").trim();
      if(!name){alert("상호명을 입력하세요");return;}
      const data={field:document.getElementById("cmv-field")?.value||"기타",name,
        phone:(document.getElementById("cmv-phone")?.value||"").trim(),
        stars:Number(document.getElementById("cmv-stars")?.value)||0,
        note:(document.getElementById("cmv-note")?.value||"").trim(),updatedAt:Date.now()};
      if(_cmEditId){ await db.collection(CM_VENDOR).doc(_cmEditId).update(data); const i=_cmVendors.findIndex(x=>x.id===_cmEditId); if(i>=0)_cmVendors[i]={..._cmVendors[i],...data}; }
      else{ const ref=await db.collection(CM_VENDOR).add({...data,createdAt:Date.now()}); _cmVendors.push({id:ref.id,...data,createdAt:Date.now()}); }
    }else if(_cmEditCol===CM_PRICE){
      const item=(document.getElementById("cmp-item")?.value||"").trim();
      if(!item){alert("항목명을 입력하세요");return;}
      const data={cat:document.getElementById("cmp-cat")?.value||"기타",item,
        unit:(document.getElementById("cmp-unit")?.value||"").trim(),
        minPrice:Number(document.getElementById("cmp-min")?.value)||0,
        maxPrice:Number(document.getElementById("cmp-max")?.value)||0,
        note:(document.getElementById("cmp-note")?.value||"").trim(),updatedAt:Date.now()};
      if(_cmEditId){ await db.collection(CM_PRICE).doc(_cmEditId).update(data); const i=_cmPrices.findIndex(x=>x.id===_cmEditId); if(i>=0)_cmPrices[i]={..._cmPrices[i],...data}; }
      else{ const ref=await db.collection(CM_PRICE).add({...data,createdAt:Date.now()}); _cmPrices.push({id:ref.id,...data,createdAt:Date.now()}); }
    }else if(_cmEditCol===CM_CHK){
      const text=(document.getElementById("cmchk-text")?.value||"").trim();
      if(!text){alert("내용을 입력하세요");return;}
      const data={stage:document.getElementById("cmchk-stage")?.value||_cmChkStage,text,done:false,updatedAt:Date.now()};
      if(_cmEditId){ await db.collection(CM_CHK).doc(_cmEditId).update(data); const i=_cmChks.findIndex(x=>x.id===_cmEditId); if(i>=0)_cmChks[i]={..._cmChks[i],...data}; }
      else{ const ref=await db.collection(CM_CHK).add({...data,createdAt:Date.now()}); _cmChks.push({id:ref.id,...data,createdAt:Date.now()}); }
    }else if(_cmEditCol===CM_DOC){
      const text=(document.getElementById("cmdoc-text")?.value||"").trim();
      if(!text){alert("서류명을 입력하세요");return;}
      const data={stage:document.getElementById("cmdoc-stage")?.value||_cmDocStage,text,done:false,updatedAt:Date.now()};
      if(_cmEditId){ await db.collection(CM_DOC).doc(_cmEditId).update(data); const i=_cmDocs.findIndex(x=>x.id===_cmEditId); if(i>=0)_cmDocs[i]={..._cmDocs[i],...data}; }
      else{ const ref=await db.collection(CM_DOC).add({...data,createdAt:Date.now()}); _cmDocs.push({id:ref.id,...data,createdAt:Date.now()}); }
    }else if(_cmEditCol===CM_REF){
      const title=(document.getElementById("cmref-title")?.value||"").trim();
      if(!title){alert("제목을 입력하세요");return;}
      const saveBtn=document.getElementById("cmModalSave")||document.querySelector("#cmSubModal .btn-primary");
      if(saveBtn){saveBtn.disabled=true;saveBtn.textContent="업로드 중…";}
      try{
        // 대기 중인 파일 업로드
        const uploaded=[];
        for(const f of _cmRefFiles){
          if(f._pending&&f._file){
            const safe=(f.name||"file").replace(/[^\w.\-가-힣]/g,"_");
            const path=`realestate/common_ref/${Date.now()}_${Math.random().toString(36).slice(2,6)}_${safe}`;
            const ref=storage.ref(path);
            await ref.put(f._file,{contentType:f.type||"application/octet-stream"});
            const url=await ref.getDownloadURL();
            uploaded.push({name:f.name,url,type:f.type||"",path});
          }else if(!f._pending){
            uploaded.push({name:f.name,url:f.url,type:f.type||"",path:f.path||""});
          }
        }
        // 삭제 예약된 파일 실제 삭제
        for(const p of _cmRefDelFiles){ try{ await storage.ref(p).delete(); }catch(_){} }
        _cmRefDelFiles=[];
        const data={title,body:(document.getElementById("cmref-body")?.value||"").trim(),files:uploaded,updatedAt:Date.now()};
        if(_cmEditId){
          await db.collection(CM_REF).doc(_cmEditId).update(data);
          const i=_cmRefs.findIndex(x=>x.id===_cmEditId); if(i>=0)_cmRefs[i]={..._cmRefs[i],...data};
        }else{
          const ref=await db.collection(CM_REF).add({...data,createdAt:Date.now()});
          _cmRefs.push({id:ref.id,...data,createdAt:Date.now()});
        }
      }finally{
        if(saveBtn){saveBtn.disabled=false;saveBtn.textContent="저장";}
      }
    }
    closeCmSubModal(); renderCmContent();
  }catch(e){ showError("공통자료 저장",e); }
}
async function cmSubDel(){
  if(!_cmEditId||!_cmEditCol)return;
  if(!confirm("삭제할까요?"))return;
  try{
    await db.collection(_cmEditCol).doc(_cmEditId).delete();
    if(_cmEditCol===CM_VENDOR)_cmVendors=_cmVendors.filter(x=>x.id!==_cmEditId);
    else if(_cmEditCol===CM_PRICE)_cmPrices=_cmPrices.filter(x=>x.id!==_cmEditId);
    else if(_cmEditCol===CM_CHK)_cmChks=_cmChks.filter(x=>x.id!==_cmEditId);
    else if(_cmEditCol===CM_DOC)_cmDocs=_cmDocs.filter(x=>x.id!==_cmEditId);
    else if(_cmEditCol===CM_REF){
      const r=_cmRefs.find(x=>x.id===_cmEditId);
      if(r&&r.files){ for(const f of r.files){ if(f.path){ try{ await storage.ref(f.path).delete(); }catch(_){} } } }
      _cmRefs=_cmRefs.filter(x=>x.id!==_cmEditId);
    }
    closeCmSubModal(); renderCmContent();
  }catch(e){ showError("공통자료 삭제",e); }
}
/* ================================================================ */
function esc(s){return (s==null?"":String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function jsstr(s){return String(s).replace(/'/g,"\\'");}
function show(id,on){const el=document.getElementById(id); if(el) el.style.display=on?'block':'none';}
function openModal(id){document.getElementById(id).classList.add("open");}
function closeModal(id){document.getElementById(id).classList.remove("open");}
function showUploading(msg){ const o=document.getElementById("uploadOverlay"); const m=document.getElementById("upMsg"); if(m)m.textContent=msg||"업로드 중…"; if(o)o.classList.add("show"); }
function hideUploading(){ const o=document.getElementById("uploadOverlay"); if(o)o.classList.remove("show"); }
function autoGrow(t){ t.style.height='auto'; t.style.height=(t.scrollHeight)+'px'; }

/* ===== 로딩 ===== */
async function loadProjects(){
 try{
  const snap=await db.collection(PROJECTS).orderBy("createdAt","desc").get();
  projects=snap.docs.map(d=>({id:d.id,...d.data()}));
  try{
    const all=await db.collection(ENTRIES).get();
    const sum={}, last={};
    all.forEach(doc=>{ const e=doc.data(); const pid=e.projectId; if(!pid) return;
      if(Number(e.amount)>0) sum[pid]=(sum[pid]||0)+Number(e.amount);
      if(e.date && (!last[pid] || e.date>last[pid])) last[pid]=e.date;
    });
    projects.forEach(p=>{ p._spent=sum[p.id]||0; p._last=last[p.id]||null; });
  }catch(_){}
  renderProjectList();
 }catch(err){ showError("프로젝트 목록 불러오기", err); }
}
function renderProjectList(){
  const box=document.getElementById("projList");
  if(!projects.length){box.innerHTML='<div style="color:var(--ink-soft);font-size:13px;padding:8px 6px;">아직 프로젝트가 없습니다.</div>';return;}
  box.innerHTML=projects.map(p=>{
    const pct=progressPct(p);
    return `<div class="proj-item ${p.id===currentProjectId?'active':''}" onclick="selectProject('${p.id}')">
      <div class="pname">${esc(p.name)}</div>
      ${p.address?`<div class="paddr">${esc(p.address)}</div>`:''}
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <span class="pstatus ${p.status||''}">${p.status||'진행중'} · ${pct}%</span>
      ${(p._spent||p._last)?`<div class="pmeta">${p._spent?'💰 '+p._spent.toLocaleString()+'원':''}${p._spent&&p._last?' · ':''}${p._last?'🕓 '+p._last:''}</div>`:''}
    </div>`;}).join("");
}
async function selectProject(id){
  if(id!==currentProjectId){
    activeTab="대시보드"; costFilter={stage:"전체",kind:"전체",pay:"전체",q:""}; searchQ="";
    chatHistory=[]; window._photoOpenId=null; window._docOpenId=null;
    window._photoSelMode=false; window._photoSel={};
    window._matFilter=""; window._matGroup="space";
    window._quoteSort={key:"krw",dir:1}; window._agentSort={key:"count",dir:-1};
    window._wlFilter="전체"; navStack=[]; navFwd=[];
  }
  currentProjectId=id;
  await reloadCurrent();
}
async function reloadCurrent(){
 try{
  renderProjectList();
  const id=currentProjectId; if(!id) return;
  const [eSnap,vSnap,mSnap,qSnap,aSnap,wSnap,tSnap]=await Promise.all([
    db.collection(ENTRIES).where("projectId","==",id).get(),
    db.collection(VENDORS).where("projectId","==",id).get(),
    db.collection(MATERIALS).where("projectId","==",id).get(),
    db.collection(QUOTES).where("projectId","==",id).get(),
    db.collection(AGENTS).where("projectId","==",id).get(),
    db.collection(WORKLOG).where("projectId","==",id).get(),
    db.collection(TODOS).where("projectId","==",id).get()
  ]);
  entries=eSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  vendors=vSnap.docs.map(d=>({id:d.id,...d.data()}));
  materials=mSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  quotes=qSnap.docs.map(d=>({id:d.id,...d.data()}));
  agents=aSnap.docs.map(d=>({id:d.id,...d.data()}));
  worklogs=wSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  todos=tSnap.docs.map(d=>({id:d.id,...d.data()}));
  renderMain();
 }catch(err){ showError("데이터 새로고침", err); }
}

/* ===== 진행률 / 비용 ===== */
function stageStatus(p,stage){return ((p.stageStatus)||{})[stage]||"대기";}
function progressPct(p){
  const stages=opts("stages");
  if(!stages.length) return 0;
  const d=stages.filter(s=>stageStatus(p,s)==="완료").length;
  return Math.round(d/stages.length*100);
}
function checkAmounts(p){
  let loan=0, buyCost=0, sellIncome=0, sellCost=0;
  const cstate=p.checkState||{};
  Object.keys(cstate).forEach(stage=>{
    const items=STAGE_CHECKLIST[stage]||[];
    Object.keys(cstate[stage]||{}).forEach(idx=>{
      const cell=cstate[stage][idx]; if(!cell||cell.amount==null) return;
      const amt=Number(cell.amount)||0; if(!amt) return;
      const item=items[idx]; const label=item?(item.t||''):'';
      if(/대출/.test(label)) loan+=amt;
      else if(stage==="매도(계약·잔금)"){
        if(/받은|수령/.test(label)) sellIncome+=amt;
        else sellCost+=amt;
      } else buyCost+=amt;
    });
  });
  return {loan, buyCost, sellIncome, sellCost};
}
function costBreakdown(p){
  const entSpent=entries.filter(e=>Number(e.amount)>0).reduce((s,e)=>s+Number(e.amount),0);
  const ck=checkAmounts(p);
  const totalSpent = entSpent + ck.buyCost + ck.sellCost;
  const realInvest = totalSpent - ck.loan;
  return {entSpent, loan:ck.loan, buyCost:ck.buyCost, sellCost:ck.sellCost, sellIncome:ck.sellIncome, totalSpent, realInvest};
}

/* ===== 메인 / 탭 ===== */
function renderMain(){
  const p=projects.find(x=>x.id===currentProjectId);
  const main=document.getElementById("main");
  if(!p){main.innerHTML='<div class="empty">프로젝트를 선택하세요.</div>';return;}
  const tabs=["대시보드","달력","공정","자재","비용","견적·부동산","작업일지","준비·할일","사진","업체·연락","서류"];
  main.innerHTML=`
    <div class="proj-head">
      <div><h2>${esc(p.name)}</h2>
        <div class="sub">${esc(p.address||'')} ${p.startDate?'· 시작 '+p.startDate:''}</div></div>
      <div class="acts">
        ${navStack.length?`<button class="btn btn-line btn-sm" onclick="navBack()" title="이전 화면으로">← 뒤로</button>`:''}
        ${navFwd.length?`<button class="btn btn-line btn-sm" onclick="navForward()" title="다음 화면으로">앞으로 →</button>`:''}
        <button class="btn btn-line btn-sm" onclick="openProjectModal('${p.id}')">✏ 정보 수정</button>
        <button class="btn btn-primary btn-sm" onclick="openEntryModal()">+ 기록 추가</button>
      </div>
    </div>
    <div class="topbar">
      <div class="topsearch">
        <span class="ts-icon">🔍</span>
        <input id="topSearchInput" placeholder="전체 검색 — 제목·거래처·메모·금액·공정·자재…" value="${esc(window._topSearchQ||'')}"
          oninput="onTopSearch(this.value)" onkeydown="if(event.key==='Enter')gotoSearch(this.value)">
        ${window._topSearchQ?`<button class="ts-clear" onclick="clearTopSearch()">✕</button>`:''}
      </div>
      <button class="btn btn-line memo-btn" onclick="openMemoBoard()" title="급한 메모">⚡ 급한메모${((p.quickMemo&&p.quickMemo.trim())||(p.quickMemoFiles&&p.quickMemoFiles.length))?' <span class="memo-cnt">•</span>':''}</button>
    </div>
    <div id="topSearchResult"></div>
    <div class="tabs">
      ${tabs.map(t=>`<button class="tab ${t===activeTab?'active':''}" onclick="setTab('${t}')">${tabIcon(t)} ${t}</button>`).join("")}
    </div>
    <div id="tabContent"></div>`;
  renderTab(p);
}
/* ===== 상단 전체 검색 ===== */
function onTopSearch(q){
  window._topSearchQ=q;
  const box=document.getElementById("topSearchResult");
  const clearBtn=document.querySelector(".ts-clear");
  if(!box) return;
  const query=(q||"").trim().toLowerCase();
  if(!query){ box.innerHTML=""; if(clearBtn) clearBtn.style.display="none"; return; }
  const hits=entries.filter(e=>{
    const hay=[e.title,e.vendor,e.memo,e.cat,e.sub,e.stage,e.kind,(e.amount!=null?String(e.amount):"")].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(query);
  }).slice(0,40);
  if(!hits.length){ box.innerHTML='<div class="topsearch-result"><div class="ai-empty">검색 결과가 없습니다.</div></div>'; return; }
  box.innerHTML='<div class="topsearch-result"><div class="tsr-head">🔍 검색 결과 '+hits.length+'건</div>'+hits.map(e=>renderLog(e,{compact:true})).join("")+'</div>';
}
function clearTopSearch(){ window._topSearchQ=""; const i=document.getElementById("topSearchInput"); if(i) i.value=""; const box=document.getElementById("topSearchResult"); if(box) box.innerHTML=""; }
function gotoSearch(q){ window._topSearchQ=q; onTopSearch(q); }
/* ===== 급한 메모 (오른쪽 슬라이드 패널, 자동 저장 + 사진) ===== */
let _memoSaveTimer=null;
function openMemoBoard(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  const ed=document.getElementById("memoEditor");
  if(ed) ed.innerHTML = p.quickMemoHtml || (p.quickMemo? esc(p.quickMemo).replace(/\n/g,'<br>') : "");
  const _st0=document.getElementById("memoStatus"); if(_st0) _st0.textContent="";
  const panel=document.getElementById("memoPanel"); if(panel) panel.classList.add("open");
  const bd=document.getElementById("memoBackdrop"); if(bd) bd.classList.add("open");
  setTimeout(()=>{const t=document.getElementById("memoEditor"); if(t) t.focus();},150);
}
function closeMemoPanel(){
  const p=document.getElementById("memoPanel"); if(p) p.classList.remove("open");
  const bd=document.getElementById("memoBackdrop"); if(bd) bd.classList.remove("open");
}
/* 편집 중 자동 저장 (디바운스) */
function memoOnInput(){
  const st=document.getElementById("memoStatus"); if(st) st.textContent="작성 중…";
  if(_memoSaveTimer) clearTimeout(_memoSaveTimer);
  _memoSaveTimer=setTimeout(saveMemoText, 800);
}
async function saveMemoText(){
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  const ed=document.getElementById("memoEditor"); if(!ed) return;
  const html=ed.innerHTML;
  const plain=ed.innerText||"";
  try{
    await db.collection(PROJECTS).doc(p.id).update({quickMemoHtml:html, quickMemo:plain});
    p.quickMemoHtml=html; p.quickMemo=plain;
    const st=document.getElementById("memoStatus"); if(st) st.textContent="💾 자동 저장됨";
  }catch(err){ const st=document.getElementById("memoStatus"); if(st) st.textContent="⚠ 저장 실패"; }
}
/* 커서 위치에 이미지 삽입 */
function memoInsertImage(url){
  const ed=document.getElementById("memoEditor"); if(!ed) return;
  ed.focus();
  const img=document.createElement("img");
  img.src=url; img.className="memo-inline-img";
  const sel=window.getSelection();
  if(sel && sel.rangeCount && ed.contains(sel.anchorNode)){
    const range=sel.getRangeAt(0); range.deleteContents();
    range.insertNode(img);
    // 이미지 뒤로 커서 이동 + 줄바꿈
    const br=document.createElement("br");
    img.after(br);
    range.setStartAfter(br); range.collapse(true);
    sel.removeAllRanges(); sel.addRange(range);
  } else {
    ed.appendChild(img); ed.appendChild(document.createElement("br"));
  }
  memoOnInput();
}
/* 에디터 안 이미지 클릭 → 삭제 */
function memoEditorClick(e){
  const t=e.target;
  if(t && t.tagName==="IMG" && t.classList.contains("memo-inline-img")){
    if(confirm("이 사진을 메모에서 지울까요?")){
      const src=t.getAttribute("src");
      // 바로 뒤 <br>도 같이 정리
      const next=t.nextSibling;
      t.remove();
      if(next && next.nodeName==="BR") next.remove();
      memoOnInput();
      saveMemoText();
      // Storage에서도 삭제 시도 (url로 path 추정 불가하면 그대로 둠)
      if(src) memoDeleteStorageByUrl(src);
    }
  }
}
/* url에 해당하는 Storage 파일 삭제 (가능할 때만) */
async function memoDeleteStorageByUrl(url){
  try{
    // Firebase Storage download URL에서 path 추출: /o/{encodedPath}?
    const m=/\/o\/([^?]+)/.exec(url);
    if(m && m[1]){ const path=decodeURIComponent(m[1]); await storage.ref(path).delete(); }
  }catch(_){ /* 무시 (이미 삭제되었거나 외부 url) */ }
}
/* 사진 첨부 버튼 */
async function addMemoPhoto(){
  const fi=document.getElementById("memoFileInput");
  if(!fi||!fi.files||!fi.files.length) return;
  await uploadMemoInline(Array.from(fi.files));
  fi.value="";
}
/* 붙여넣기(Ctrl+V) → 커서 위치에 이미지 인라인 삽입 */
async function memoPasteHandler(e){
  const items=(e.clipboardData||window.clipboardData)?.items;
  if(!items) return;
  const imgs=[];
  for(const it of items){ if(it.kind==="file" && (it.type||"").startsWith("image/")){ const f=it.getAsFile(); if(f) imgs.push(f); } }
  if(!imgs.length) return; // 텍스트는 기본 동작
  e.preventDefault();
  const named=imgs.map((f,i)=>{ try{ return new File([f], f.name||("붙여넣기_"+Date.now()+"_"+i+".png"), {type:f.type||"image/png"}); }catch(_){ return f; } });
  await uploadMemoInline(named);
}
async function uploadMemoInline(fileList){
  if(!fileList||!fileList.length) return;
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  try{
    for(let i=0;i<fileList.length;i++){
      showUploading("사진 올리는 중… ("+(i+1)+"/"+fileList.length+")");
      const meta=await processFile(fileList[i]);
      if((meta.type||"").startsWith("image/")) memoInsertImage(meta.url);
      else { // 이미지가 아니면 링크로 삽입
        const ed=document.getElementById("memoEditor");
        if(ed){ const a=document.createElement("a"); a.href=meta.url; a.target="_blank"; a.textContent="📄 "+(meta.name||"파일"); ed.appendChild(a); ed.appendChild(document.createElement("br")); }
      }
    }
    hideUploading();
    await saveMemoText();
  }catch(err){ hideUploading(); showError("메모 사진 추가", err); }
}
async function clearMemo(){
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  if(!confirm("메모 내용을 모두 지울까요?")) return;
  try{
    await db.collection(PROJECTS).doc(p.id).update({quickMemo:"", quickMemoHtml:""});
    p.quickMemo=""; p.quickMemoHtml="";
    const ed=document.getElementById("memoEditor"); if(ed) ed.innerHTML="";
    const st=document.getElementById("memoStatus"); if(st) st.textContent="🗑 지웠습니다";
  }catch(err){ showError("메모 지우기", err); }
}
function tabIcon(t){return {"대시보드":"📊","달력":"📅","공정":"🔨","자재":"🧱","비용":"💰","견적·부동산":"📞","주말 비용":"🚗","작업일지":"📒","준비·할일":"✅","사진":"📷","업체·연락":"📇","서류":"📁","검색":"🔍"}[t]||"";}
/* ===== 달력 (칸 안에 내용+금액 직접 표시) ===== */
function calCursor(){
  if(!window._calYM){ const n=new Date(); window._calYM={y:n.getFullYear(), m:n.getMonth()}; }
  return window._calYM;
}
function calMove(delta){
  const c=calCursor(); let m=c.m+delta, y=c.y;
  if(m<0){ m=11; y--; } if(m>11){ m=0; y++; }
  window._calYM={y,m};
  renderTab(projects.find(x=>x.id===currentProjectId));
}
function calToday(){ const n=new Date(); window._calYM={y:n.getFullYear(),m:n.getMonth()}; renderTab(projects.find(x=>x.id===currentProjectId)); }
function calIcon(k){ return {"식비":"🍚","주유·가스":"⛽","톨비(통행료)":"🛣","주차비":"🅿","택배비":"📦","자재비":"🧱","공사비":"🔨","부동산 매수비용":"🏠","부동산 매도비용":"💵","사진":"📷","연락":"📞","서류":"📁","문제":"⚠","메모":"📝","기타비용":"💰","대출이자":"🏦","관리비":"🏢","등기비":"📋","취득세":"🧾","중개수수료":"🤝","수리비":"🛠","공과금":"🧾","보험료":"🛡"}[k]||"💠"; }
function calItemLabel(e){
  const k=displayKindOf(e);
  const icon=calIcon(k);
  const amt=e.amount?Number(e.amount).toLocaleString()+"원":"";
  // 제목 + (켜져 있으면) 메모 한 줄
  const showMemo=window._calShowMemo!==false;
  let sub="";
  if(showMemo && e.memo){ const m=e.memo.replace(/\s+/g,' ').trim(); if(m) sub=`<span class="cal-i-memo">${esc(m.length>18?m.slice(0,18)+'…':m)}</span>`; }
  const title=esc(e.title||k||"");
  return `<div class="cal-item" onclick="event.stopPropagation(); editCost('${e.id}')" title="${title} ${amt} ${esc(e.memo||'')}">
    <span class="cal-i-ic">${icon}</span><span class="cal-i-t">${title}${sub}</span>${amt?`<span class="cal-i-amt">${amt}</span>`:''}</div>`;
}
/* 달력에 표시할 종류 필터 */
function calFilterSet(){ if(!window._calFilter) window._calFilter={}; return window._calFilter; }
function calKindOn(k){ const f=calFilterSet(); return f[k]!==false; } // 기본 켜짐
function calToggleKind(k){ const f=calFilterSet(); f[k]=(f[k]===false); renderTab(projects.find(x=>x.id===currentProjectId)); }
function calToggleMemo(){ window._calShowMemo=(window._calShowMemo===false); renderTab(projects.find(x=>x.id===currentProjectId)); }
function calAllKinds(on){ const f=calFilterSet(); calPresentKinds().forEach(k=>{ f[k]=on?true:false; }); renderTab(projects.find(x=>x.id===currentProjectId)); }
/* 현재 프로젝트 기록에 등장하는 종류 목록 */
function calPresentKinds(){
  const set=new Set();
  entries.forEach(e=>{ if(e.date) set.add(displayKindOf(e)); });
  // 보기 좋은 순서로 정렬
  const order=[
    // 비용 그룹 (돈 나가는 것)
    "식비","주유·가스","톨비(통행료)","주차비","택배비","자재비","공사비",
    "수리비","관리비","공과금","보험료","대출이자","등기비","취득세","중개수수료","기타비용",
    // 부동산 그룹
    "부동산 매수비용","부동산 매도비용",
    // 기록 그룹
    "사진","서류","연락","문제","메모"
  ];
  return [...set].sort((a,b)=>{ const ia=order.indexOf(a), ib=order.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });
}
function viewCalendar(p){
  const c=calCursor();
  const first=new Date(c.y,c.m,1);
  const startDow=first.getDay();
  const daysInMonth=new Date(c.y,c.m+1,0).getDate();
  const f=calFilterSet();
  // 날짜별 기록 묶기 (필터 적용)
  const byDate={};
  entries.forEach(e=>{ if(!e.date) return; if(!calKindOn(displayKindOf(e))) return; (byDate[e.date]=byDate[e.date]||[]).push(e); });
  const ym=c.y+"-"+String(c.m+1).padStart(2,"0");
  let monthSum=0, monthCnt=0;
  Object.keys(byDate).forEach(d=>{ if(d.startsWith(ym)) byDate[d].forEach(e=>{ if(e.amount){monthSum+=Number(e.amount);} monthCnt++; }); });
  const todayStr=today();
  const dow=["일","월","화","수","목","금","토"];
  let cells="";
  for(let i=0;i<startDow;i++) cells+=`<div class="cal-cell empty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const ds=ym+"-"+String(d).padStart(2,"0");
    const list=(byDate[ds]||[]).slice().sort((a,b)=>(b.amount||0)-(a.amount||0));
    const daySum=list.reduce((s,e)=>s+(Number(e.amount)||0),0);
    const wd=(startDow+d-1)%7;
    const cls=["cal-cell"];
    if(ds===todayStr) cls.push("today");
    if(wd===0) cls.push("sun"); if(wd===6) cls.push("sat");
    const items=list.slice(0,5).map(calItemLabel).join("");
    const more=list.length>5?`<div class="cal-more">+${list.length-5}건 더</div>`:"";
    cls.push(list.length?"has":"");
    cells+=`<div class="${cls.join(' ')}" onclick="calDayOpen('${ds}')">
      <div class="cal-d"><span>${d}</span>${daySum?`<span class="cal-dsum">${daySum.toLocaleString()}</span>`:''}</div>
      <div class="cal-items">${items}${more}</div>
    </div>`;
  }
  const headDows=dow.map((w,i)=>`<div class="cal-h ${i===0?'sun':''} ${i===6?'sat':''}">${w}</div>`).join("");
  // 종류 필터 칩 — 7개씩 줄로 나눔, 맨 앞에 메모 표시 토글
  const kinds=calPresentKinds();
  const memoOn=window._calShowMemo!==false;
  function chipHtml(k){ return `<button class="cal-chip ${calKindOn(k)?'on':''}" onclick="calToggleKind('${jsstr(k)}')">${calIcon(k)} ${esc(k==="톨비(통행료)"?"톨비":k==="부동산 매수비용"?"매수":k==="부동산 매도비용"?"매도":k)}</button>`; }
  const memoChip=`<button class="cal-chip ${memoOn?'on':''}" onclick="calToggleMemo()">📝 메모</button>`;
  let kindRows="";
  if(kinds.length){
    const cells=[memoChip].concat(kinds.map(chipHtml));  // 메모를 맨 앞에
    for(let i=0;i<cells.length;i+=7){
      kindRows+=`<div class="cal-filter-row">${cells.slice(i,i+7).join("")}</div>`;
    }
  } else {
    kindRows=`<div class="cal-filter-row">${memoChip}<span class="hint" style="margin-left:6px">표시할 기록이 없습니다.</span></div>`;
  }
  return `<div class="panel">
    <div class="cal-top">
      <div class="cal-nav">
        <button class="btn btn-line btn-sm" onclick="calMove(-1)">‹ 이전</button>
        <button class="btn btn-line btn-sm" onclick="calToday()">오늘</button>
        <button class="btn btn-line btn-sm" onclick="calMove(1)">다음 ›</button>
      </div>
      <div class="cal-title">${c.y}년 ${c.m+1}월</div>
      <div class="cal-sum">${monthCnt}건 · 합계 <b>${monthSum.toLocaleString()}원</b></div>
    </div>
    <div class="cal-filter">
      <div class="cal-filter-row cal-filter-ctrl">
        <span class="cal-filter-lab">표시 설정 :</span>
        <button class="cal-chip cal-ctrl" onclick="calAllKinds(true)">전체 켜기</button>
        <button class="cal-chip cal-ctrl" onclick="calAllKinds(false)">전체 끄기</button>
      </div>
      ${kindRows}
    </div>
    <div class="cal-grid-h">${headDows}</div>
    <div class="cal-grid">${cells}</div>
  </div>`;
}
/* 날짜 칸 클릭 → 그날 기록 목록 + 그날 기록추가 */
function calDayOpen(ds){
  const list=entries.filter(e=>e.date===ds).sort((a,b)=>(b.amount||0)-(a.amount||0));
  const sum=list.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const box=document.getElementById("calDayBody");
  const t=document.getElementById("calDayTitle");
  if(t) t.textContent=ds+" ("+["일","월","화","수","목","금","토"][new Date(ds+"T00:00:00").getDay()]+")";
  if(box){
    box.innerHTML=(list.length?list.map(e=>renderLog(e,{compact:true})).join(""):'<div class="ai-empty">이 날짜에 기록이 없습니다.</div>')
      + (sum?`<div class="cal-day-sum">합계 ${sum.toLocaleString()}원</div>`:'');
  }
  window._calDayDate=ds;
  openModal("calDayModal");
}
function calDayAdd(){
  const ds=window._calDayDate;
  closeModal("calDayModal");
  openEntryModal();
  // 날짜를 그날로 세팅
  setTimeout(()=>{ const el=document.getElementById("ef_date"); if(el&&ds) el.value=ds; },150);
}
/* ===== 네비게이션 스택 — 뒤로/앞으로 (각 최대 10단계) ===== */
let navStack=[];   // 뒤로 갈 화면들
let navFwd=[];     // 앞으로 갈 화면들
function navSnapshot(){
  return { tab:activeTab,
    photoOpenId:window._photoOpenId||null, docOpenId:window._docOpenId||null,
    costView:window._costView||null, wkView:window._wkView||null };
}
function navApply(s){
  activeTab=s.tab;
  window._photoOpenId=s.photoOpenId; window._docOpenId=s.docOpenId;
  if(s.costView!=null) window._costView=s.costView;
  if(s.wkView!=null) window._wkView=s.wkView;
  window._photoSelMode=false; window._photoSel={};
}
function navPush(){
  navStack.push(navSnapshot());
  if(navStack.length>10) navStack.shift();
  navFwd=[]; // 새 이동을 하면 앞으로 기록은 사라짐(브라우저와 동일)
}
function navBack(){
  if(!navStack.length) return;
  navFwd.push(navSnapshot());
  if(navFwd.length>10) navFwd.shift();
  navApply(navStack.pop());
  renderMain();
}
function navForward(){
  if(!navFwd.length) return;
  navStack.push(navSnapshot());
  if(navStack.length>10) navStack.shift();
  navApply(navFwd.pop());
  renderMain();
}
function setTab(t){ if(t===activeTab) return; navPush(); activeTab=t; window._photoOpenId=null; window._docOpenId=null; renderMain(); }
/* 폴더 등 하위 화면 진입용 (뒤로가기 기록) */
function navOpenPhoto(cat){ navPush(); window._photoOpenId=cat; renderTab(projects.find(x=>x.id===currentProjectId)); }
function navOpenDoc(cat){ navPush(); window._docOpenId=cat; renderTab(projects.find(x=>x.id===currentProjectId)); }
function navClosePhoto(){ navPush(); window._photoOpenId=null; window._photoSelMode=false; renderTab(projects.find(x=>x.id===currentProjectId)); }
function navCloseDoc(){ navPush(); window._docOpenId=null; renderTab(projects.find(x=>x.id===currentProjectId)); }
function renderTab(p){
  try{
    const c=document.getElementById("tabContent");
    const map={
      "대시보드":viewDashboard,"달력":viewCalendar,"공정":viewStages,"자재":viewMaterials,"비용":viewCost,
      "견적·부동산":viewQuotesAgents,"작업일지":viewWorklog,
      "준비·할일":viewTodos,"사진":viewPhotos,
      "업체·연락":viewVendors,"서류":viewDocs,"검색":viewSearch
    };
    c.innerHTML = (map[activeTab]||viewDashboard)(p);
    if(activeTab==="검색") renderSearchResult();
    if(activeTab==="대시보드" && chatHistory.length) renderChat();
    if(activeTab==="공정"){ document.querySelectorAll('.ck-memo').forEach(autoGrow); }
  }catch(err){ showError("화면 표시("+activeTab+" 탭)", err); }
}

/* ===== 대시보드 ===== */
function viewDashboard(p){
  const stages=opts("stages");
  const cb=costBreakdown(p);
  const total=cb.totalSpent;
  const fileCount=entries.reduce((s,e)=>s+(e.files?e.files.length:0),0);
  const pct=progressPct(p);
  const doneCnt=stages.filter(s=>stageStatus(p,s)==="완료").length;
  const recent=entries.slice(0,6);
  const tl=stages.map((s,i)=>{const st=stageStatus(p,s);
    return `<div class="tl-step ${st==='완료'?'done':st==='진행'?'doing':''}">
      <div class="tl-dot">${st==='완료'?'✓':i+1}</div><div class="tl-label">${esc(s)}</div></div>`;}).join("");
  const profit = cb.sellIncome>0 ? (cb.sellIncome - cb.totalSpent) : null;
  const investPanel = `<div class="panel"><div class="panel-h">💵 투자 요약</div>
    <div class="panel-body"><div class="invest-grid">
      <div class="iv"><span>총 사용 비용</span><b>${cb.totalSpent.toLocaleString()}원</b><small>임장·계약·세금·등기·인테리어·기타 전부</small></div>
      <div class="iv"><span>대출금</span><b>${cb.loan.toLocaleString()}원</b><small>자금조달 (비용 아님)</small></div>
      <div class="iv hi"><span>실투자금</span><b>${cb.realInvest.toLocaleString()}원</b><small>총비용 − 대출금</small></div>
      ${cb.sellIncome>0?`<div class="iv"><span>매도 수령액</span><b>${cb.sellIncome.toLocaleString()}원</b><small>받은 계약금·잔금</small></div>
      <div class="iv ${profit>=0?'profit':'loss'}"><span>예상 손익</span><b>${profit>=0?'+':''}${profit.toLocaleString()}원</b><small>매도액 − 총비용</small></div>`:''}
    </div></div></div>`;
  return `
    <div class="stats">
      <div class="stat"><div class="label">공정 진행률</div><div class="value">${pct}<small>%</small></div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
        <div class="label" style="margin-top:6px">${doneCnt} / ${stages.length} 단계 완료</div></div>
      <div class="stat"><div class="label">총 사용 비용${p.budget?' / 예산':''}</div><div class="value">${total.toLocaleString()}<small> 원</small></div>
        ${p.budget?`<div class="progress-wrap"><div class="progress-bar" style="width:${Math.min(100,Math.round(total/p.budget*100))}%;background:${total>p.budget?'var(--danger)':'var(--accent)'}"></div></div>
        <div class="label" style="margin-top:6px;color:${total>p.budget?'var(--danger)':'var(--ink-soft)'}">예산 ${p.budget.toLocaleString()}원 · ${total>p.budget?'초과 '+(total-p.budget).toLocaleString()+'원':'잔여 '+(p.budget-total).toLocaleString()+'원'}</div>`:''}</div>
      <div class="stat"><div class="label">실투자금</div><div class="value">${cb.realInvest.toLocaleString()}<small> 원</small></div></div>
      <div class="stat"><div class="label">기록 / 첨부</div><div class="value">${entries.length}<small>건 / ${fileCount}개</small></div></div>
    </div>
    ${investPanel}
    <div class="panel"><div class="panel-h">🗺️ 공정 타임라인</div><div class="panel-body"><div class="timeline">${tl}</div></div></div>
    <div class="panel ai"><div class="panel-h">🤖 AI 프로젝트 분석 <span class="cnt">${p.analyzedAt?'· 최근 '+p.analyzedAt:'· 아직 분석 전'}</span>
        <button class="btn btn-ai btn-sm add" onclick="runAnalysis()">분석 실행</button></div>
      <div class="panel-body">
        <div id="aiResult">${p.lastAnalysis? mdLite(p.lastAnalysis) : '<div class="ai-empty">‘분석 실행’을 누르면 공정 진행·지출·문제기록을 AI가 점검합니다.</div>'}</div>
        <div class="ai-foot"><a href="#" onclick="runAnalysis();return false;">↻ 다시 분석</a>
          <a href="#" onclick="resetKey();return false;">🔑 API 키 변경</a></div>
      </div></div>
    <div class="panel ai"><div class="panel-h">💬 AI 챗봇 <span class="cnt">이 프로젝트에 대해 무엇이든</span></div>
      <div class="panel-body">
        <div id="chatLog" class="chat-log"></div>
        <div class="chat-input">
          <input type="text" id="chatInput" placeholder="예: 지금까지 어디에 돈을 제일 많이 썼어?" onkeydown="if(event.key==='Enter')sendChat()">
          <button class="btn btn-ai btn-sm" onclick="sendChat()">전송</button>
        </div>
        <div class="ai-foot"><a href="#" onclick="clearChat();return false;">🗑 대화 지우기</a></div>
      </div></div>
    <div class="panel"><div class="panel-h">🕓 최근 활동 <span class="cnt">${entries.length}건 중 최신</span></div>
      <div class="panel-body">${recent.length? recent.map(e=>renderLog(e,{noDelete:true})).join("") : '<div class="ai-empty">기록이 없습니다.</div>'}</div></div>
    <div class="panel danger-zone"><div class="panel-h" style="color:var(--danger)">⚠️ 위험 구역</div>
      <div class="panel-body" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span class="hint" style="margin:0">프로젝트와 그 안의 모든 기록·사진·업체·자재·견적이 영구 삭제됩니다.</span>
        <button class="btn btn-line btn-sm" onclick="backupCurrentProject()">💾 먼저 백업</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProject()">프로젝트 삭제</button>
      </div></div>`;
}

/* ===== 공정 ===== */
function viewStages(p){
  const stages=opts("stages");
  const pct=progressPct(p);
  const cards=stages.map((stage,i)=>{
    const st=stageStatus(p,stage);
    const logs=entries.filter(e=>e.stage===stage);
    const amt=logs.filter(e=>Number(e.amount)>0).reduce((s,e)=>s+Number(e.amount),0);
    const probs=logs.filter(e=>e.kind==="문제").length;
    return `
    <div class="stage s${st}" id="stage_${i}">
      <div class="stage-h" onclick="toggleStage(${i})">
        <div class="stage-no">${st==='완료'?'✓':i+1}</div>
        <div><div class="stage-name">${esc(stage)}</div>
          <div class="stage-sub">${logs.length}건${probs?` · ⚠️ 문제 ${probs}`:''}</div></div>
        <div class="stage-right">${amt?`<span class="stage-amt">${amt.toLocaleString()}원</span>`:''}
          <span class="stage-badge ${st}">${st}</span></div>
      </div>
      <div class="stage-body">
        <div class="stage-statusrow">
          ${["대기","진행","완료"].map(s=>`<button class="mini-chip ${st===s?'on':''}" onclick="setStageStatus('${jsstr(stage)}','${s}')">${s}</button>`).join("")}
          <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="openEntryModal('${jsstr(stage)}')">+ 이 공정에 기록</button>
        </div>
        ${STAGE_CHECKLIST[stage]?renderChecklist(p,stage):''}
        <div style="margin-top:10px">${logs.length? logs.map(renderLog).join("") : '<div style="color:var(--ink-soft);font-size:13px;padding:8px 0">기록 없음</div>'}</div>
      </div>
    </div>`;}).join("");
  return `
    <div class="panel"><div class="panel-body" style="padding:15px 17px">
      <div style="display:flex;align-items:center;gap:12px"><b>전체 진행률 ${pct}%</b>
        <div class="progress-wrap" style="flex:1;margin-top:0"><div class="progress-bar" style="width:${pct}%"></div></div>
        <button class="btn btn-ghost btn-sm" onclick="openAddOpt('stages',null)">+ 공정 단계 추가</button></div>
      <div class="hint" style="margin-top:8px">단계를 눌러 상태를 바꾸고, 자재 항목은 자재 모달에서, 공정별 세부 항목은 기록 모달의 ‘세부 항목’ + 버튼에서 추가합니다.</div>
    </div></div>${cards}`;
}
function toggleStage(i){document.getElementById('stage_'+i).classList.toggle('open');}
async function setStageStatus(stage,status){
  const p=projects.find(x=>x.id===currentProjectId);
  const ss=Object.assign({},p.stageStatus||{}); ss[stage]=status;
  await db.collection(PROJECTS).doc(currentProjectId).update({stageStatus:ss});
  p.stageStatus=ss; renderProjectList(); renderTab(p);
}

/* ===== 체크리스트 (기존 유지, 일부 단축) ===== */
function getCheck(p,stage,idx){ return ((p.checkState||{})[stage]||{})[idx]||null; }
function stageId(stage){ return stage.replace(/[^a-zA-Z0-9가-힣]/g,'_'); }
function ckField(stage,i,cs,type){
  const S=jsstr(stage); const sid=stageId(stage);
  if(type==="memo") return `<textarea class="ck-memo" rows="2" placeholder="메모…" oninput="autoGrow(this)" onchange="saveCheckField('${S}',${i},'memo',this.value)">${esc(cs.memo||'')}</textarea>`;
  if(type==="date") return `<label class="ck-mini">📅 <input type="date" value="${esc(cs.date||'')}" onchange="saveCheckField('${S}',${i},'date',this.value)"></label>`;
  if(type==="amount") return `<label class="ck-mini">💰 <input type="number" placeholder="금액" value="${cs.amount!=null?cs.amount:''}" oninput="saveCheckAmount('${S}',${i},this.value)"><span class="ck-tag" id="ckamt_${sid}_${i}">${cs.amount?Number(cs.amount).toLocaleString()+'원':''}</span></label>`;
  if(type==="year") return `<label class="ck-mini">🏗 준공 <input type="number" placeholder="2005" value="${esc(cs.year||'')}" onchange="saveCheckField('${S}',${i},'year',this.value)">년</label>`;
  if(type==="sedae") return `<label class="ck-mini">🏢 <input type="number" placeholder="총 세대수" value="${esc(cs.sedae||'')}" onchange="saveCheckField('${S}',${i},'sedae',this.value)">세대</label>`;
  if(type==="dist") return `<div class="ck-grid2">
    <label class="ck-mini">🏫 학교 <input type="number" placeholder="m" value="${esc(cs.distSchool||'')}" onchange="saveCheckField('${S}',${i},'distSchool',this.value)">m</label>
    <label class="ck-mini">🛒 마트 <input type="number" placeholder="m" value="${esc(cs.distMart||'')}" onchange="saveCheckField('${S}',${i},'distMart',this.value)">m</label>
    <label class="ck-mini">🚇 역 <input type="number" placeholder="m" value="${esc(cs.distStation||'')}" onchange="saveCheckField('${S}',${i},'distStation',this.value)">m</label>
    <label class="ck-mini">🏥 병원 <input type="number" placeholder="m" value="${esc(cs.distHosp||'')}" onchange="saveCheckField('${S}',${i},'distHosp',this.value)">m</label></div>`;
  if(type==="parking"){
    const ratio=(cs.parkTotal&&cs.sedaeP)?Math.round(cs.parkTotal/cs.sedaeP*100):null;
    return `<div class="ck-grid2">
      <label class="ck-mini">🅿 주차 <input type="number" placeholder="대수" value="${esc(cs.parkTotal||'')}" oninput="saveParkRatio('${S}',${i})" id="pk_${sid}_${i}_t">대</label>
      <label class="ck-mini">🏢 세대 <input type="number" placeholder="세대수" value="${esc(cs.sedaeP||'')}" oninput="saveParkRatio('${S}',${i})" id="pk_${sid}_${i}_s">세대</label>
      <span class="ck-tag" id="pk_${sid}_${i}_r">${ratio!=null?'세대당 '+(cs.parkTotal/cs.sedaeP).toFixed(2)+'대 ('+ratio+'%)':''}</span></div>`;
  }
  if(type==="price3") return `<div class="ck-grid2">
    <label class="ck-mini">📉 저가 <input type="number" placeholder="만원" value="${esc(cs.priceLow||'')}" onchange="saveCheckField('${S}',${i},'priceLow',this.value)">만</label>
    <label class="ck-mini">📊 중간 <input type="number" placeholder="만원" value="${esc(cs.priceMid||'')}" onchange="saveCheckField('${S}',${i},'priceMid',this.value)">만</label>
    <label class="ck-mini">📈 고가 <input type="number" placeholder="만원" value="${esc(cs.priceHigh||'')}" onchange="saveCheckField('${S}',${i},'priceHigh',this.value)">만</label>
    <label class="ck-mini">🏷 실거래 <input type="number" placeholder="만원" value="${esc(cs.priceReal||'')}" onchange="saveCheckField('${S}',${i},'priceReal',this.value)">만</label></div>`;
  return '';
}
function renderChecklist(p,stage){
  const items=STAGE_CHECKLIST[stage]||[];
  const done=items.filter((_,i)=>{const c=getCheck(p,stage,i);return c&&c.done;}).length;
  const sid=stageId(stage);
  let amtSum=0;
  const cards=items.map((item,i)=>{
    const cs=getCheck(p,stage,i)||{};
    const fields=item.f||[];
    if(fields.includes("amount") && cs.amount) amtSum+=Number(cs.amount)||0;
    const docs=entries.filter(e=>e.stage===stage && e.checkRef===i);
    const files=docs.flatMap(e=>e.files||[]);
    const fileHtml=files.map((f)=>{
      const isImg=(f.type||"").startsWith("image/");
      return `<a class="ck-file" href="${isImg?'javascript:void(0)':f.url}" ${isImg?`onclick="openViewer('${jsstr(f.url)}','${jsstr(f.name)}');return false;"`:'target="_blank" rel="noopener"'}>${isImg?'🖼':'📄'} ${esc(f.name)}</a>`;
    }).join("");
    const inputs=fields.map(t=>ckField(stage,i,cs,t)).join("");
    const docBtn=item.doc?`<button class="ck-add" onclick="addCheckDoc('${jsstr(stage)}',${i})" title="서류/사진 첨부">📎</button>`:'';
    return `<div class="ck-card ${cs.done?'on':''}" id="ck_${sid}_${i}">
      <label class="ck-row"><input type="checkbox" ${cs.done?'checked':''} onchange="toggleCheck('${jsstr(stage)}',${i},this.checked)"><span>${esc(item.t)}</span>${docBtn}</label>
      ${inputs?`<div class="ck-fields">${inputs}</div>`:''}
      ${fileHtml?`<div class="ck-files">${fileHtml}</div>`:''}
    </div>`;
  }).join("");
  const sumHtml = amtSum>0 ? `<div class="ck-sum">이 단계 입력 금액 합계: <b>${amtSum.toLocaleString()}원</b></div>` : '';
  return `<div class="checklist"><div class="checklist-h">✔ 점검 체크리스트 <span id="ckcount_${sid}" style="font-weight:500;color:var(--ink-soft)">(${done}/${items.length})</span></div>
    <div class="ck-board">${cards}</div>${sumHtml}</div>`;
}
let _amtTimer=null;
async function saveParkRatio(stage,idx){
  const sid=stageId(stage);
  const tot=Number(document.getElementById('pk_'+sid+'_'+idx+'_t').value)||0;
  const sed=Number(document.getElementById('pk_'+sid+'_'+idx+'_s').value)||0;
  const rEl=document.getElementById('pk_'+sid+'_'+idx+'_r');
  if(rEl) rEl.textContent=(tot&&sed)?('세대당 '+(tot/sed).toFixed(2)+'대 ('+Math.round(tot/sed*100)+'%)'):'';
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  const cs=JSON.parse(JSON.stringify(p.checkState||{}));
  cs[stage]=cs[stage]||{}; cs[stage][idx]=Object.assign({},cs[stage][idx],{parkTotal:tot||null,sedaeP:sed||null});
  p.checkState=cs;
  clearTimeout(_amtTimer); _amtTimer=setTimeout(()=>db.collection(PROJECTS).doc(currentProjectId).update({checkState:cs}).catch(e=>showError("저장",e)),500);
}
async function toggleCheck(stage,idx,done){
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  const cs=JSON.parse(JSON.stringify(p.checkState||{}));
  cs[stage]=cs[stage]||{}; cs[stage][idx]=Object.assign({},cs[stage][idx],{done});
  p.checkState=cs;
  const el=document.getElementById('ck_'+stageId(stage)+'_'+idx); if(el) el.classList.toggle('on', done);
  const items=STAGE_CHECKLIST[stage]||[];
  const cnt=items.filter((_,i)=>(cs[stage]||{})[i] && cs[stage][i].done).length;
  const cEl=document.getElementById('ckcount_'+stageId(stage)); if(cEl) cEl.textContent='('+cnt+'/'+items.length+')';
  try{ await db.collection(PROJECTS).doc(currentProjectId).update({checkState:cs}); }
  catch(err){ showError("체크 저장", err); }
}
async function saveCheckField(stage,idx,field,value){
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  const cs=JSON.parse(JSON.stringify(p.checkState||{}));
  cs[stage]=cs[stage]||{}; cs[stage][idx]=Object.assign({},cs[stage][idx],{[field]:value});
  p.checkState=cs;
  try{ await db.collection(PROJECTS).doc(currentProjectId).update({checkState:cs}); }
  catch(err){ showError("저장", err); }
}
function saveCheckAmount(stage,idx,value){
  const tag=document.getElementById('ckamt_'+stageId(stage)+'_'+idx);
  if(tag) tag.textContent = value? Number(value).toLocaleString()+'원' : '';
  clearTimeout(_amtTimer);
  _amtTimer=setTimeout(()=>{ saveCheckField(stage,idx,'amount', value?Number(value):null); },500);
}
function addCheckDoc(stage,idx){
  const inp=document.getElementById("addToFolderInput"); inp.value="";
  inp.onchange=async function(){
    if(!inp.files.length) return;
    try{
      showUploading("파일 올리는 중…");
      const files=[];
      for(let i=0;i<inp.files.length;i++){ showUploading("파일 올리는 중… ("+(i+1)+"/"+inp.files.length+")"); files.push(await processFile(inp.files[i])); }
      const item=(STAGE_CHECKLIST[stage]||[])[idx]||{};
      const label=(typeof item==='string'?item:(item.t||"체크 항목"));
      const exist=entries.find(e=>e.stage===stage && e.checkRef===idx);
      if(exist){
        const newFiles=(exist.files||[]).concat(files);
        await db.collection(ENTRIES).doc(exist.id).update({files:newFiles});
      }else{
        await db.collection(ENTRIES).add({
          projectId:currentProjectId, kind:"서류", title:label.replace(/^【.*?】\s*/,''),
          date:today(), stage:stage, checkRef:idx, cat:null, vendor:"", amount:null, pay:null,
          memo:"체크리스트 첨부", files, createdAt:firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      hideUploading();
      await reloadCurrent();
    }catch(err){ hideUploading(); showError("체크 서류 첨부", err); }
  };
  inp.click();
}

/* ===== 공통 렌더 ===== */
function renderLog(e, opts){
  opts=opts||{};
  if(opts.compact){
    const kindTag = (e.kind==="자재비"||e.kind==="공사비") ? (e.stage||e.kind) : (e.cat||e.kind||'');
    const midCol = opts.payAsVendor ? (e.pay||'') : (e.vendor||'');
    return `<div class="logrow">
      <span class="lr-tag">${esc(kindTag)}</span>
      <span class="lr-title">${esc(e.title)}</span>
      <span class="lr-vendor">${esc(midCol)}</span>
      <span class="lr-amt">${e.amount?Number(e.amount).toLocaleString()+'원':''}</span>
      <span class="lr-date">${e.date||''}</span>
      ${opts.noEdit?'':`<button class="lr-btn" onclick="editCost('${e.id}')">수정</button>`}
      ${opts.noDelete?'':`<button class="lr-btn del" onclick="deleteEntry('${e.id}')">삭제</button>`}
    </div>`;
  }
  const files=(e.files||[]).map(f=>{
    const isImg=(f.type||"").startsWith("image/");
    if(isImg) return `<a class="file" href="javascript:void(0)" onclick="openViewer('${jsstr(f.url)}','${jsstr(f.name)}')"><img src="${f.url}"><span class="fname">${esc(f.name)}</span></a>`;
    return `<a class="file" href="${f.url}" target="_blank" rel="noopener"><div class="fi">PDF</div><span class="fname">${esc(f.name)}</span></a>`;
  }).join("");
  const KNOWN_KINDS=["문제","사진","자재비","공사비","기타비용","연락","서류","메모"];
  const tags=[
    e.kind==="문제"?`<span class="l-tag 문제">문제·하자</span>`:'',
    e.kind==="사진"?`<span class="l-tag 사진">사진</span>`:'',
    e.kind==="자재비"?`<span class="l-tag">자재비</span>`:'',
    e.kind==="공사비"?`<span class="l-tag">공사비</span>`:'',
    e.kind==="기타비용"?`<span class="l-tag">${esc(e.cat||'기타비용')}${e.sub?' · '+esc(e.sub):''}</span>`:'',
    e.kind==="연락"?`<span class="l-tag">연락</span>`:'',
    e.kind==="서류"?`<span class="l-tag">서류</span>`:'',
    e.kind==="메모"?`<span class="l-tag">메모</span>`:'',
    (!KNOWN_KINDS.includes(e.kind)&&e.kind)?`<span class="l-tag">${esc(e.kind)}${e.cat?' · '+esc(e.cat):''}</span>`:'',
    e.stage?`<span class="l-tag 공정">${esc(e.stage)}</span>`:'',
    ((e.kind==="자재비"||e.kind==="공사비")&&e.cat)?`<span class="l-tag">${esc(e.cat)}</span>`:'',
    (e.pay&&e.amount)?`<span class="l-tag">${esc(e.pay)}</span>`:'',
    (e.currency==="USD")?`<span class="l-tag" style="background:#e7eafb;color:var(--blue)">USD $${Number(e.amountOrig||0).toLocaleString()}</span>`:''
  ].join("");
  // 금액이 있는 기록(모든 종류)은 수정 가능
  const editBtn = (opts.noEdit||!(Number(e.amount)>0||e.kind==="자재비"||e.kind==="공사비"||e.kind==="기타비용"))? '' : `<button class="l-del" style="color:var(--accent)" onclick="editCost('${e.id}')">수정</button>`;
  const delBtn = opts.noDelete? '' : `<button class="l-del" onclick="deleteEntry('${e.id}')">삭제</button>`;
  const customHtml = (e.custom && Object.keys(e.custom).length)
    ? `<div class="l-meta">${Object.keys(e.custom).map(nm=>`${esc(nm)} <b>${esc(e.custom[nm])}</b>`).join(' · ')}</div>` : '';
  const matHtml = (e.spec||e.unitPrice||e.qty||(e.vat&&e.vat!=='없음'))
    ? `<div class="l-meta">${e.spec?'규격 '+esc(e.spec):''}${e.spec&&(e.unitPrice||e.qty)?' · ':''}${(e.unitPrice||e.qty)?((e.unitPrice?Number(e.unitPrice).toLocaleString():'?')+'원 × '+(e.qty||'?')):''}${e.vat?` · 부가세 ${esc(e.vat)}`:''}</div>` : '';
  const menuHtml = (e.menus && e.menus.length)
    ? `<div class="l-meta">🍚 ${e.menus.map(m=>esc(m.name)+(m.price?' '+Number(m.price).toLocaleString()+'원':'')).join(' · ')}</div>` : '';
  const workerHtml = (e.workers && e.workers.length)
    ? `<div class="l-meta">👷 ${e.workers.map(w=>esc(w.name)+(w.pay?' '+Number(w.pay).toLocaleString()+'원':'')).join(' · ')} (${e.workers.length}명)</div>` : '';
  const distHtml = (e.dist)
    ? `<div class="l-meta">🚗 주행 ${Number(e.dist).toLocaleString()}km</div>` : '';
  const contactHtml = (e.phone||e.addr||e.link)
    ? `<div class="l-meta" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${e.phone?telLink(e.phone):''}${e.addr?mapLink(e.addr):''}${e.link?`<a class="field-cfg" href="${esc(e.link)}" target="_blank" rel="noopener" style="color:var(--accent)">🔗 링크</a>`:''}</div>` : '';
  return `<div class="log">
    <div class="l-top">${tags}<span class="l-title">${esc(e.title)}</span><span class="l-date">${e.date||''}</span>${editBtn}${delBtn}</div>
    ${(e.vendor||e.amount)?`<div class="l-meta">${e.vendor?'거래처 '+esc(e.vendor):''}${e.vendor&&e.amount?' · ':''}${e.amount?'<b>'+Number(e.amount).toLocaleString()+'원</b>':''}</div>`:''}
    ${matHtml}
    ${menuHtml}
    ${workerHtml}
    ${distHtml}
    ${customHtml}
    ${contactHtml}
    ${e.memo?`<div class="l-memo">${esc(e.memo)}</div>`:''}
    ${files?`<div class="files">${files}</div>`:''}</div>`;
}
function renderVendor(v,spent){
  return `<div class="vendor">
    <span class="vtrade">${esc(v.trade||'기타')}</span>
    <div><div class="vname">${esc(v.name)}</div>${v.memo?`<div class="vmemo">${esc(v.memo)}</div>`:''}${spent?`<div class="vspent">지출 ${spent.toLocaleString()}원</div>`:''}</div>
    <div class="vright"><a class="tel" href="tel:${(v.phone||'').replace(/[^0-9+]/g,'')}">📞 ${esc(v.phone||'')}</a>
      <button class="vedit" onclick="editVendor('${v.id}')">수정</button>
      <button class="vdel" onclick="deleteVendor('${v.id}')">삭제</button></div></div>`;
}
function barRow(label,amt,sum){
  const w=sum?Math.round(amt/sum*100):0;
  return `<tr><td class="bar-cell"><i style="width:${w}%"></i><span>${esc(label)}</span></td><td class="num">${amt.toLocaleString()}</td></tr>`;
}

/* ===== 오류 ===== */
function showError(where, err){
  const b=document.getElementById("errBanner");
  const msg=document.getElementById("errMsg"), ex=document.getElementById("errEx");
  let detail=(err&&(err.message||err.toString()))||"알 수 없는 오류";
  if(/permission|insufficient|PERMISSION_DENIED/i.test(detail)){
    detail += "  →  Firebase 콘솔에서 Firestore/Storage 규칙을 'allow read, write: if true'로 게시하세요.";
  }
  if(msg) msg.textContent = " — 위치: "+where;
  if(ex) ex.textContent = detail;
  if(b) b.classList.add("show");
  console.error("["+where+"]", err);
}
window.addEventListener("error", function(e){ showError("스크립트", e.error||e.message); });
window.addEventListener("unhandledrejection", function(e){ showError("비동기 처리", e.reason); });

/* === 시작 === */
/* init()은 파일 맨 끝에서 실행 — 모든 const/function 선언 후에 호출해야
   'Cannot access PIN_KEY before initialization' 오류가 안 남 */

/* ===== PWA 서비스워커 등록 ===== */
function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('realestate-sw.js').catch(function(){});
  }
}

/* ===== 잠금 (PIN/지문) — 개인관리 패턴 이식 ===== */
const PIN_KEY='re-pin', BIO_KEY='re-bio';
let pinBuffer='', pinMode='enter', pinFirst='';
function hashPin(s){ let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h+s.charCodeAt(i))|0; } return 'h'+h; }
function hasPin(){ return !!localStorage.getItem(PIN_KEY); }
function lockText(t,d){ const a=document.getElementById('lockTitle'),b=document.getElementById('lockDesc'); if(a)a.textContent=t; if(b)b.textContent=d; }
function lockMsg(m){ const e=document.getElementById('lockMsg'); if(e)e.textContent=m||''; }
function renderDots(){ const e=document.getElementById('lockDots'); if(!e)return; e.innerHTML=''; for(let i=0;i<4;i++){ const d=document.createElement('span'); d.className='lock-dot'+(i<pinBuffer.length?' on':''); e.appendChild(d);} }
function buildPad(){
  const pad=document.getElementById('lockPad'); if(!pad||pad.childElementCount)return;
  const keys=['1','2','3','4','5','6','7','8','9','','0','⌫'];
  keys.forEach(k=>{
    const b=document.createElement('button'); b.className='lock-key'; b.textContent=k;
    if(k==='') b.style.visibility='hidden';
    else b.onclick=()=>pinPress(k);
    pad.appendChild(b);
  });
}
function pinPress(k){
  if(k==='⌫'){ pinBuffer=pinBuffer.slice(0,-1); renderDots(); return; }
  if(pinBuffer.length>=4) return;
  pinBuffer+=k; renderDots();
  if(pinBuffer.length===4) setTimeout(pinComplete,120);
}
function pinComplete(){
  if(pinMode==='set'){
    pinFirst=pinBuffer; pinBuffer=''; renderDots();
    pinMode='confirm'; lockText('PIN 확인','한 번 더 입력하세요'); lockMsg('');
    return;
  }
  if(pinMode==='confirm'){
    if(pinBuffer===pinFirst){ localStorage.setItem(PIN_KEY,hashPin(pinBuffer)); unlock(); tryEnableBio(); }
    else { pinBuffer=''; pinFirst=''; renderDots(); pinMode='set'; lockText('PIN 설정','다시 설정해 주세요'); lockMsg('두 번 입력이 달라요'); }
    return;
  }
  // enter
  if(hashPin(pinBuffer)===localStorage.getItem(PIN_KEY)){ unlock(); }
  else { pinBuffer=''; renderDots(); lockMsg('PIN이 틀렸어요'); }
}
function unlock(){ pinBuffer=''; lockMsg(''); const s=document.getElementById('lockScreen'); if(s)s.classList.add('hidden'); setTimeout(()=>{ if(typeof checkBackupReminder==='function') checkBackupReminder(); }, 1200); }
function startLock(){
  // 잠금을 설정하지 않았으면 잠금화면을 건너뜀(기존 사용자 방해 안 함)
  if(!hasPin()){ const s=document.getElementById('lockScreen'); if(s)s.classList.add('hidden'); return; }
  const s=document.getElementById('lockScreen'); if(s)s.classList.remove('hidden');
  buildPad(); renderDots();
  pinMode='enter'; lockText('🔒 부동산 관리 잠금','PIN 4자리를 입력하세요');
  if(localStorage.getItem(BIO_KEY)==='1' && window.PublicKeyCredential){
    const b=document.getElementById('lockBio'); if(b)b.style.display='inline-block';
    setTimeout(bioUnlock,300);
  }
}
/* 설정에서 호출: PIN 새로 만들기/변경 */
function setupPin(){
  const s=document.getElementById('lockScreen'); if(s)s.classList.remove('hidden');
  buildPad(); pinBuffer=''; pinFirst=''; renderDots();
  pinMode='set'; lockText('PIN 설정','앱을 열 때 쓸 PIN 4자리를 정하세요'); lockMsg('');
}
function removePin(){
  if(!hasPin()){ alert('설정된 PIN이 없습니다.'); return; }
  if(confirm('잠금(PIN)을 해제할까요?')){ localStorage.removeItem(PIN_KEY); localStorage.removeItem(BIO_KEY); alert('잠금이 해제되었습니다.'); }
}
function tryEnableBio(){
  if(!window.PublicKeyCredential) return;
  PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function(ok){
    if(ok && confirm('지문/얼굴로도 열 수 있게 등록할까요?')){
      const cred={publicKey:{challenge:new Uint8Array(16),rp:{name:'부동산관리'},
        user:{id:new Uint8Array(16),name:'me',displayName:'me'},
        pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
        authenticatorSelection:{userVerification:'required',authenticatorAttachment:'platform'},timeout:30000}};
      navigator.credentials.create(cred).then(function(){ localStorage.setItem(BIO_KEY,'1'); }).catch(function(){});
    }
  }).catch(function(){});
}
function bioUnlock(){
  if(!window.PublicKeyCredential){ lockMsg('이 기기는 지문을 지원하지 않아요'); return; }
  const opt={publicKey:{challenge:new Uint8Array(16),userVerification:'required',timeout:30000}};
  navigator.credentials.get(opt).then(function(){ unlock(); }).catch(function(){ lockMsg('지문 인식 실패 — PIN을 입력하세요'); });
}
/* ============================================================
   JS 2/3 — 자재·재고·비용·견적/부동산·주말입력·사진·서류
   ============================================================ */

/* ===== 자재 ===== */
function matAmount(m){ return (Number(m.unitPriceKRW!=null?m.unitPriceKRW:m.unitPrice)||0)*(Number(m.qty)||0); }
function matPhotos(m){ return (m.files||[]).filter(f=>(f.type||"").startsWith("image/")); }
function matFilter(list,q){
  q=(q||"").trim().toLowerCase(); if(!q) return list;
  return list.filter(m=>[m.name,m.brand,m.spec,m.cat,m.space,m.stage,m.supplier,m.memo].join(' ').toLowerCase().includes(q));
}
function stockClass(m){
  if(m.stock==null||m.stock==="") return "";
  const n=Number(m.stock)||0;
  if(n<=0) return "zero";
  if(n<=2) return "low";
  return "";
}
function matCardHtml(m){
  const amt=matAmount(m);
  const unitKRW=Number(m.unitPriceKRW!=null?m.unitPriceKRW:m.unitPrice)||0;
  const thumbs=(m.files||[]).map((f,i)=>{
    const isImg=(f.type||"").startsWith("image/");
    if(isImg) return `<div class="mat-thumb" onclick="openMatPhotos('${m.id}',${i})"><img src="${f.url}"><button class="mt-del" title="사진 삭제" onclick="event.stopPropagation();deleteMaterialPhoto('${m.id}',${i})">×</button></div>`;
    return `<a class="mat-thumb" style="display:grid;place-items:center;text-decoration:none;color:var(--accent);font-size:11px;font-weight:700" href="${f.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">PDF<button class="mt-del" onclick="event.stopPropagation();deleteMaterialPhoto('${m.id}',${i})">×</button></a>`;
  }).join("");
  const useLog=(m.useLog||[]).slice().reverse().map(u=>`<div class="mat-useline">▸ ${esc(u.date||'')} −${u.qty}${m.unit?esc(m.unit):''} ${u.memo?'· '+esc(u.memo):''}</div>`).join("");
  const stockShow = (m.stock!=null && m.stock!=="");
  const qtyN = Number(m.qty)||0;
  const stockN = stockShow ? (Number(m.stock)||0) : 0;
  const totalHold = qtyN + stockN; // 구매량 + 재고 = 총 보유
  const unitTxt = m.unit?esc(m.unit):'';
  return `<div class="mat-card">
    <div class="mat-top">
      ${m.space?`<span class="l-tag 공정">${esc(m.space)}</span>`:''}
      ${m.cat?`<span class="l-tag">${esc(m.cat)}</span>`:''}
      ${m.stage?`<span class="l-tag 사진">${esc(m.stage)}</span>`:''}
      ${amt?`<span class="mat-amt">${amt.toLocaleString()}원</span>`:''}
    </div>
    <div class="mat-name">${esc(m.name||'')}${m.brand?`<small>${esc(m.brand)}</small>`:''}</div>
    ${m.spec?`<div class="mat-spec">📐 ${esc(m.spec)}</div>`:''}
    <div class="mat-meta">
      ${(unitKRW||m.qty)?`단가 <b>${unitKRW?unitKRW.toLocaleString():'-'}</b>원${m.currency==="USD"&&m.unitPrice?` <small>($${Number(m.unitPrice).toLocaleString()})</small>`:''} × 구매수량 <b>${m.qty?Number(m.qty).toLocaleString():'-'}</b>${unitTxt}<br>`:''}
      ${stockShow?`📦 재고 <span class="mat-stock ${stockClass(m)}">${stockN.toLocaleString()}${unitTxt}</span>${m.stockLoc?' · '+esc(m.stockLoc):''}<br>`:''}
      ${(qtyN>0 && stockShow)?`🧮 총 보유 <b>${totalHold.toLocaleString()}${unitTxt}</b> <small>(구매 ${qtyN.toLocaleString()} + 재고 ${stockN.toLocaleString()})</small><br>`:''}
      ${m.supplier?`공급처 <b>${esc(m.supplier)}</b>`:''}${m.supplier&&m.contact?' · ':''}${m.contact?telLink(m.contact):''}${m.link?` <a href="${esc(m.link)}" target="_blank" rel="noopener" style="color:var(--accent);font-size:12px">🔗 링크</a>`:''}
      ${m.date?`${(m.supplier||m.contact)?'<br>':''}🗓 ${esc(m.date)}`:''}
    </div>
    ${m.memo?`<div class="mat-memo">${esc(m.memo)}</div>`:''}
    <div class="mat-thumbs">${thumbs}<button class="mat-addphoto" onclick="addMaterialPhotos('${m.id}')">＋<br>사진</button></div>
    ${useLog?`<div class="mat-uselog">${useLog}</div>`:''}
    <div class="mat-acts">
      ${stockShow?`<button onclick="openStockUse('${m.id}')">📤 재고 사용</button><button onclick="addStock('${m.id}')">📥 입고</button>`:`<button onclick="addStock('${m.id}')">📦 재고 등록</button>`}
      <button onclick="editMaterial('${m.id}')">✏ 수정</button>
      <button class="mdel" onclick="deleteMaterial('${m.id}')">🗑 삭제</button>
    </div>
  </div>`;
}
function viewMaterials(p){
  const total=materials.reduce((s,m)=>s+matAmount(m),0);
  const photoCnt=materials.reduce((s,m)=>s+matPhotos(m).length,0);
  const stockItems=materials.filter(m=>m.stock!=null&&m.stock!=="").length;
  const lowItems=materials.filter(m=>m.stock!=null&&m.stock!==""&&Number(m.stock)<=2).length;
  const group=window._matGroup||"space";
  const list=matFilter(materials.slice(), window._matFilter||"");
  const groupKey=m=>group==="cat"?(m.cat||"미분류"):group==="stage"?(m.stage||"미지정"):(m.space||"미지정");
  const sums={}; materials.forEach(m=>{const k=groupKey(m); sums[k]=(sums[k]||0)+matAmount(m);});
  const sumRows=Object.keys(sums).sort((a,b)=>sums[b]-sums[a]).map(k=>{
    const w=total?Math.round(sums[k]/total*100):0;
    return `<tr><td class="bar-cell"><i style="width:${w}%"></i><span>${esc(k)}</span></td><td class="num">${sums[k].toLocaleString()}</td></tr>`;
  }).join("");
  const groupLabel = group==='cat'?'분류':group==='stage'?'공정':'공간';
  return `
  <div class="stats">
    <div class="stat"><div class="label">자재 종류</div><div class="value">${materials.length}<small> 종</small></div></div>
    <div class="stat"><div class="label">총 자재비 <small>(단가×수량)</small></div><div class="value">${total.toLocaleString()}<small> 원</small></div></div>
    <div class="stat"><div class="label">재고 관리 품목</div><div class="value">${stockItems}<small> 종 ${lowItems?'· ⚠️부족 '+lowItems:''}</small></div></div>
    <div class="stat"><div class="label">자재 사진</div><div class="value">${photoCnt}<small> 장</small></div></div>
  </div>
  <div class="panel"><div class="panel-h">🧱 자재 사양·단가·재고 관리
    <button class="btn btn-primary btn-sm add" onclick="openMaterialModal()">+ 자재 추가</button></div>
    <div class="panel-body" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <span class="hint" style="margin:0">제품·규격·단가(USD 가능)·재고를 사진과 함께 관리합니다. 재고 사용/입고 버튼으로 수량을 바로 조정하세요.</span>
      <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="exportMaterials()">📥 엑셀 내보내기</button>
    </div></div>
  ${total?`<div class="panel"><div class="panel-h">📊 ${groupLabel}별 자재비
    <span style="margin-left:auto;display:inline-flex;gap:4px">
      <button class="mini-chip ${group==='space'?'on':''}" onclick="window._matGroup='space';renderTab(projects.find(x=>x.id===currentProjectId))">공간별</button>
      <button class="mini-chip ${group==='cat'?'on':''}" onclick="window._matGroup='cat';renderTab(projects.find(x=>x.id===currentProjectId))">분류별</button>
      <button class="mini-chip ${group==='stage'?'on':''}" onclick="window._matGroup='stage';renderTab(projects.find(x=>x.id===currentProjectId))">공정별</button>
    </span></div>
    <div class="panel-body"><table class="ctable"><thead><tr><th>${groupLabel}</th><th class="num">금액(원)</th></tr></thead>
    <tbody>${sumRows}<tr class="sum"><td>합계</td><td class="num">${total.toLocaleString()}</td></tr></tbody></table></div></div>`:''}
  <div class="panel"><div class="panel-h">📋 자재 목록 <span class="cnt" id="matListCnt">${materials.length}종</span></div>
    <div class="panel-body">
      <div class="filterbar"><input type="text" id="matSearchInput" placeholder="제품명·브랜드·규격·공급처·메모 검색" value="${esc(window._matFilter||'')}" oninput="onMatSearch(this.value)"></div>
      <div id="matList">${list.length? '<div class="mat-list">'+list.map(matCardHtml).join("")+'</div>' : '<div class="ai-empty">등록된 자재가 없습니다. ‘+ 자재 추가’로 입력하세요.</div>'}</div>
    </div></div>`;
}
function onMatSearch(v){
  window._matFilter=v;
  const list=matFilter(materials.slice(), v);
  const box=document.getElementById("matList");
  if(box) box.innerHTML = list.length? '<div class="mat-list">'+list.map(matCardHtml).join("")+'</div>' : '<div class="ai-empty">조건에 맞는 자재가 없습니다.</div>';
  const cnt=document.getElementById("matListCnt"); if(cnt) cnt.textContent=list.length+"종";
}
let editingMaterialId=null;
function openMaterialModal(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  editingMaterialId=null;
  document.getElementById("materialModalTitle").textContent="자재 추가";
  buildOptSelect("mf_space","mat_spaces","");
  buildOptSelect("mf_cat","mat_cats","");
  buildOptSelect("mf_unit","mat_units","");
  buildOptSelect("mf_stage","stages","","(공정 선택 안 함)");
  ["mf_name","mf_brand","mf_spec","mf_unitprice","mf_qty","mf_supplier","mf_contact","mf_memo","mf_stock","mf_stockloc"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("mf_currency").value="KRW";
  document.getElementById("mf_files").value="";
  document.getElementById("mf_filehint").textContent="";
  document.getElementById("mf_date").value=today();
  // 링크·드롭 초기화
  const mflk=document.getElementById("mf_link"); if(mflk) mflk.value="";
  const mflkb=document.getElementById("mf_linkBtn"); if(mflkb) mflkb.style.display="none";
  const mfdp=document.getElementById("mf_dropPreview"); if(mfdp) mfdp.innerHTML="";
  window._mfDropFiles=[];
  updateMatAmount();
  openModal("materialModal");
}
function editMaterial(id){
  const m=materials.find(x=>x.id===id); if(!m) return;
  editingMaterialId=id;
  document.getElementById("materialModalTitle").textContent="자재 수정";
  buildOptSelect("mf_space","mat_spaces",m.space||"");
  buildOptSelect("mf_cat","mat_cats",m.cat||"");
  buildOptSelect("mf_unit","mat_units",m.unit||"");
  buildOptSelect("mf_stage","stages",m.stage||"","(공정 선택 안 함)");
  document.getElementById("mf_name").value=m.name||"";
  document.getElementById("mf_brand").value=m.brand||"";
  document.getElementById("mf_spec").value=m.spec||"";
  document.getElementById("mf_unitprice").value=m.unitPrice!=null?m.unitPrice:"";
  document.getElementById("mf_currency").value=m.currency||"KRW";
  document.getElementById("mf_qty").value=m.qty!=null?m.qty:"";
  document.getElementById("mf_stock").value=m.stock!=null?m.stock:"";
  document.getElementById("mf_stockloc").value=m.stockLoc||"";
  document.getElementById("mf_supplier").value=m.supplier||"";
  document.getElementById("mf_contact").value=m.contact||"";
  document.getElementById("mf_date").value=m.date||today();
  document.getElementById("mf_memo").value=m.memo||"";
  document.getElementById("mf_files").value="";
  const pc=(m.files||[]).length;
  document.getElementById("mf_filehint").textContent= pc? ("이미 사진/파일 "+pc+"개 첨부됨 — 여기서 고르면 추가됩니다.") : "";
  // 링크 불러오기 + 드롭 초기화
  const emflk=document.getElementById("mf_link"); if(emflk){ emflk.value=m.link||""; mfLinkHint(); }
  const emfdp=document.getElementById("mf_dropPreview"); if(emfdp) emfdp.innerHTML="";
  window._mfDropFiles=[];
  updateMatAmount();
  openModal("materialModal");
}
async function saveMaterial(){
  const name=val("mf_name").trim(); if(!name){alert("제품명을 입력하세요.");return;}
  const cur=val("mf_currency")||"KRW";
  const unitOrig=val("mf_unitprice")?Number(val("mf_unitprice")):null;
  let unitKRW=unitOrig;
  if(cur==="USD" && unitOrig!=null){
    if(!_fxRate){ alert("USD 단가인데 환율이 없습니다. 상단 $1=… 배지를 눌러 환율을 입력하세요."); return; }
    unitKRW=Math.round(unitOrig*_fxRate);
  }
  const btn=document.getElementById("matSaveBtn"); btn.disabled=true; btn.textContent="저장 중...";
  try{
    let newFiles=[];
    const fi=document.getElementById("mf_files");
    const allMfFiles=[...Array.from(fi?.files||[]),...(window._mfDropFiles||[])];
    if(allMfFiles.length){
      for(let i=0;i<allMfFiles.length;i++){ showUploading("사진 올리는 중… ("+(i+1)+"/"+allMfFiles.length+")"); newFiles.push(await processFile(allMfFiles[i])); }
      hideUploading();
    }
    const data={
      projectId:currentProjectId,
      space:val("mf_space"), stage:val("mf_stage")||null, cat:val("mf_cat"),
      name, brand:val("mf_brand").trim(), spec:val("mf_spec").trim(),
      unitPrice:unitOrig, currency:cur, unitPriceKRW:unitKRW,
      fxRate: cur==="USD"?_fxRate:null,
      qty:val("mf_qty")?Number(val("mf_qty")):null,
      unit:val("mf_unit"),
      stock: val("mf_stock")!==""?Number(val("mf_stock")):null,
      stockLoc:val("mf_stockloc").trim(),
      supplier:val("mf_supplier").trim(), contact:val("mf_contact").trim(),
      link:val("mf_link")?.trim()||null,
      date:val("mf_date"), memo:val("mf_memo").trim()
    };
    if(editingMaterialId){
      const m=materials.find(x=>x.id===editingMaterialId);
      data.files=((m&&m.files)?m.files:[]).concat(newFiles);
      data.useLog=(m&&m.useLog)?m.useLog:[];
      await db.collection(MATERIALS).doc(editingMaterialId).update(data);
    }else{
      data.files=newFiles; data.useLog=[];
      data.createdAt=firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(MATERIALS).add(data);
    }
    editingMaterialId=null;
    btn.disabled=false; btn.textContent="저장";
    closeModal("materialModal");
    await reloadCurrent();
  }catch(err){ hideUploading(); btn.disabled=false; btn.textContent="저장"; showError("자재 저장", err); }
}
async function deleteMaterial(id){
  const m=materials.find(x=>x.id===id);
  if(!confirm('이 자재를 삭제할까요?\n\n"'+((m&&m.name)||'')+'"\n\n첨부 사진도 함께 삭제됩니다.'))return;
  try{
    if(m&&m.files) for(const f of m.files){ if(f.path){ try{ await storage.ref(f.path).delete(); }catch(_){} } }
    await db.collection(MATERIALS).doc(id).delete(); await reloadCurrent();
  }catch(err){ showError("자재 삭제", err); }
}
function addMaterialPhotos(id){
  const m=materials.find(x=>x.id===id); if(!m) return;
  const inp=document.getElementById("addToFolderInput"); inp.value="";
  inp.onchange=async function(){
    if(!inp.files.length) return;
    try{
      showUploading("사진 올리는 중…");
      const added=[];
      for(let i=0;i<inp.files.length;i++){ showUploading("사진 올리는 중… ("+(i+1)+"/"+inp.files.length+")"); added.push(await processFile(inp.files[i])); }
      const newFiles=(m.files||[]).concat(added);
      await db.collection(MATERIALS).doc(id).update({files:newFiles});
      hideUploading(); await reloadCurrent();
    }catch(err){ hideUploading(); showError("자재 사진 추가", err); }
  };
  inp.click();
}
async function deleteMaterialPhoto(id, idx){
  const m=materials.find(x=>x.id===id); if(!m||!m.files) return;
  const f=m.files[idx]; if(!f) return;
  if(!confirm('이 사진을 삭제할까요?\n\n'+(f.name||'')))return;
  try{
    if(f.path){ try{ await storage.ref(f.path).delete(); }catch(_){} }
    const newFiles=m.files.filter((_,i)=>i!==idx);
    await db.collection(MATERIALS).doc(id).update({files:newFiles});
    await reloadCurrent();
  }catch(err){ showError("자재 사진 삭제", err); }
}
function openMatPhotos(id, idx){
  const m=materials.find(x=>x.id===id); if(!m) return;
  const imgs=(m.files||[]).map((f,i)=>({f,i})).filter(o=>(o.f.type||"").startsWith("image/"));
  if(!imgs.length) return;
  window._ivList=imgs.map(o=>({url:o.f.url, cap:(m.name||'')+(m.spec?' · '+m.spec:'')+' · '+o.f.name}));
  let gi=imgs.findIndex(o=>o.i===idx); if(gi<0) gi=0;
  openViewerList(gi);
}
/* 재고 입고(+) */
async function addStock(id){
  const m=materials.find(x=>x.id===id); if(!m) return;
  const cur=(m.stock!=null&&m.stock!=="")?Number(m.stock):0;
  const v=prompt('입고(추가)할 수량을 입력하세요.'+(m.unit?' (단위: '+m.unit+')':'')+'\n현재 재고: '+cur, "");
  if(v===null) return;
  const add=Number(v); if(isNaN(add)){ alert("숫자를 입력하세요."); return; }
  const newStock=cur+add;
  const log=(m.useLog||[]).concat([{date:today(), qty:-add, memo:"입고(+"+add+")"}]); // 음수 qty = 입고 표시
  try{
    await db.collection(MATERIALS).doc(id).update({stock:newStock, useLog:log});
    await reloadCurrent();
  }catch(err){ showError("재고 입고", err); }
}
/* 재고 사용(-) 모달 */
function openStockUse(id){
  const m=materials.find(x=>x.id===id); if(!m) return;
  document.getElementById("su_id").value=id;
  document.getElementById("stockUseTitle").textContent=(m.name||"자재")+" 재고 사용";
  document.getElementById("su_hint").textContent="현재 재고 "+(Number(m.stock)||0)+(m.unit?m.unit:"")+" — 사용한 수량만큼 차감합니다.";
  document.getElementById("su_qty").value="";
  document.getElementById("su_date").value=today();
  document.getElementById("su_memo").value="";
  openModal("stockUseModal");
}
async function saveStockUse(){
  const id=document.getElementById("su_id").value;
  const m=materials.find(x=>x.id===id); if(!m) return;
  const useQty=Number(val("su_qty"));
  if(!useQty||useQty<=0){ alert("사용 수량을 입력하세요."); return; }
  const cur=Number(m.stock)||0;
  const newStock=Math.max(0, cur-useQty);
  if(useQty>cur && !confirm("현재 재고("+cur+")보다 많이 사용합니다. 재고를 0으로 처리할까요?")) return;
  const log=(m.useLog||[]).concat([{date:val("su_date")||today(), qty:useQty, memo:val("su_memo").trim()}]);
  try{
    await db.collection(MATERIALS).doc(id).update({stock:newStock, useLog:log});
    closeModal("stockUseModal");
    await reloadCurrent();
  }catch(err){ showError("재고 사용", err); }
}
function exportMaterials(){
  if(typeof XLSX==="undefined"){ alert("엑셀 라이브러리 로딩 중입니다."); return; }
  if(!materials.length){ alert("내보낼 자재가 없습니다."); return; }
  const p=projects.find(x=>x.id===currentProjectId);
  const rows=materials.map(m=>({
    "공간":m.space||"", "공정":m.stage||"", "분류":m.cat||"",
    "제품명":m.name||"", "브랜드":m.brand||"", "규격·사양":m.spec||"",
    "단가(원)":Number(m.unitPriceKRW!=null?m.unitPriceKRW:m.unitPrice)||0,
    "통화":m.currency||"KRW", "원래단가":Number(m.unitPrice)||0,
    "수량":Number(m.qty)||0, "단위":m.unit||"", "금액(원)":matAmount(m),
    "재고":m.stock!=null?Number(m.stock):"", "재고위치":m.stockLoc||"",
    "공급처":m.supplier||"", "연락처":m.contact||"",
    "구매/시공일":m.date||"", "사진수":matPhotos(m).length, "메모":m.memo||""
  }));
  const total=materials.reduce((s,m)=>s+matAmount(m),0);
  rows.push({"제품명":"합계","금액(원)":total});
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"자재명세");
  XLSX.writeFile(wb, ((p&&p.name)||"프로젝트").replace(/[^\w가-힣]/g,"_")+"_자재명세.xlsx");
}

/* ===== 비용 ===== */
function viewCost(p){
  const withAmt=entries.filter(e=>Number(e.amount)>0);
  const total=withAmt.reduce((s,e)=>s+Number(e.amount),0);
  const stages=opts("stages");
  const byStage={}; withAmt.filter(e=>e.kind==="자재비"||e.kind==="공사비").forEach(e=>{const k=e.stage||"미지정"; byStage[k]=(byStage[k]||0)+Number(e.amount);});
  const stageSum=Object.values(byStage).reduce((a,b)=>a+b,0);
  const stageRows=stages.filter(s=>byStage[s]).map(s=>barRow(s,byStage[s],stageSum)).join("")
    +(byStage["미지정"]?barRow("미지정",byStage["미지정"],stageSum):"");
  const byEtc={}; withAmt.filter(e=>e.kind!=="자재비"&&e.kind!=="공사비").forEach(e=>{const k=e.cat||e.kind||"기타"; byEtc[k]=(byEtc[k]||0)+Number(e.amount);});
  const etcSum=Object.values(byEtc).reduce((a,b)=>a+b,0);
  const etcRows=Object.keys(byEtc).sort((a,b)=>byEtc[b]-byEtc[a]).map(k=>barRow(k,byEtc[k],etcSum)).join("");
  const byPay={}; withAmt.forEach(e=>{const k=e.pay||"미지정"; byPay[k]=(byPay[k]||0)+Number(e.amount);});
  const payRows=Object.keys(byPay).sort((a,b)=>byPay[b]-byPay[a]).map(k=>`<tr><td>${esc(k)}</td><td class="num">${byPay[k].toLocaleString()}</td></tr>`).join("");
  const byVen={}; withAmt.forEach(e=>{if(e.vendor){byVen[e.vendor]=(byVen[e.vendor]||0)+Number(e.amount);}});
  const venRows=Object.keys(byVen).sort((a,b)=>byVen[b]-byVen[a]).slice(0,12).map(k=>`<tr><td>${esc(k)}</td><td class="num">${byVen[k].toLocaleString()}</td></tr>`).join("");
  const list=costFiltered();
  const listSum=list.reduce((s,e)=>s+Number(e.amount),0);
  const cb=costBreakdown(p);
  const stageOptsHtml = ['전체'].concat(stages).map(s=>`<option ${costFilter.stage===s?'selected':''}>${esc(s)}</option>`).join("");
  return `
    <div class="stats">
      <div class="stat"><div class="label">총 사용 비용</div><div class="value">${cb.totalSpent.toLocaleString()}<small> 원</small></div><div class="label" style="margin-top:6px">기록+체크리스트 합산</div></div>
      <div class="stat"><div class="label">기록 지출</div><div class="value">${total.toLocaleString()}<small> 원</small></div></div>
      <div class="stat"><div class="label">계약·세금·등기</div><div class="value">${cb.buyCost.toLocaleString()}<small> 원</small></div></div>
      <div class="stat"><div class="label">실투자금</div><div class="value">${cb.realInvest.toLocaleString()}<small> 원</small></div></div>
    </div>
    <div class="panel"><div class="panel-h">🧾 비용 입력 <span class="cnt">기록 추가로 통일</span></div>
      <div class="panel-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="openEntryModal()">+ 기록 추가</button>
          <button class="btn btn-ghost btn-sm" onclick="openExcelImport()">📥 엑셀 가져오기</button>
          <button class="btn btn-ghost btn-sm" onclick="openRepeatEtc()">🔁 반복 비용 생성</button>
        </div>
        <div class="hint" style="margin-top:8px">자주 쓰는 항목 바로 입력:</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          <button class="btn btn-ghost btn-sm" onclick="openEntryModal(null,'식비')">🍚 식비</button>
          <button class="btn btn-ghost btn-sm" onclick="openEntryModal(null,'주유·가스')">⛽ 주유·가스</button>
          <button class="btn btn-ghost btn-sm" onclick="openEntryModal(null,'톨비(통행료)')">🛣 톨비</button>
          <button class="btn btn-ghost btn-sm" onclick="openEntryModal(null,'주차비')">🅿 주차비</button>
          <button class="btn btn-ghost btn-sm" onclick="openEntryModal(null,'택배비')">📦 택배비</button>
          <button class="btn btn-ghost btn-sm" onclick="openEntryModal(null,'부동산 매수비용')">🏠 매수비용</button>
          <button class="btn btn-ghost btn-sm" onclick="openEntryModal(null,'부동산 매도비용')">💵 매도비용</button>
        </div>
      </div></div>
    <div class="cost-cols">
      <div class="panel"><div class="panel-h">🔨 공정별 자재·공사비</div><div class="panel-body">
        <table class="ctable"><thead><tr><th>공정</th><th class="num">금액(원)</th></tr></thead>
        <tbody>${stageRows||'<tr><td colspan="2" style="color:var(--ink-soft)">기록 없음</td></tr>'}
        ${stageSum?`<tr class="sum"><td>소계</td><td class="num">${stageSum.toLocaleString()}</td></tr>`:''}</tbody></table></div></div>
      <div class="panel"><div class="panel-h">🧾 기타 비용</div><div class="panel-body">
        <table class="ctable"><thead><tr><th>항목</th><th class="num">금액(원)</th></tr></thead>
        <tbody>${etcRows||'<tr><td colspan="2" style="color:var(--ink-soft)">기록 없음</td></tr>'}
        ${etcSum?`<tr class="sum"><td>소계</td><td class="num">${etcSum.toLocaleString()}</td></tr>`:''}</tbody></table></div></div>
    </div>
    <div class="cost-cols">
      <div class="panel"><div class="panel-h">💳 결제수단별</div><div class="panel-body">
        <table class="ctable"><thead><tr><th>결제수단</th><th class="num">금액(원)</th></tr></thead>
        <tbody>${payRows||'<tr><td colspan="2" style="color:var(--ink-soft)">기록 없음</td></tr>'}
        ${total?`<tr class="sum"><td>합계</td><td class="num">${total.toLocaleString()}</td></tr>`:''}</tbody></table></div></div>
      <div class="panel"><div class="panel-h">🏢 거래처별 지출 <span class="cnt">상위 12</span></div><div class="panel-body">
        <table class="ctable"><thead><tr><th>거래처</th><th class="num">금액(원)</th></tr></thead>
        <tbody>${venRows||'<tr><td colspan="2" style="color:var(--ink-soft)">없음</td></tr>'}</tbody></table></div></div>
    </div>
    <div class="panel"><div class="panel-h">📋 지출 내역
      <span style="margin-left:auto;display:inline-flex;gap:4px">
        <button class="mini-chip ${(window._costView||'list')==='list'?'on':''}" onclick="window._costView='list';renderTab(projects.find(x=>x.id===currentProjectId))">목록형</button>
        <button class="mini-chip ${window._costView==='card'?'on':''}" onclick="window._costView='card';renderTab(projects.find(x=>x.id===currentProjectId))">카드형</button>
      </span></div><div class="panel-body">
      <div class="filterbar">
        <select onchange="costFilter.stage=this.value;renderTab(projects.find(x=>x.id===currentProjectId))">${stageOptsHtml}</select>
        <select onchange="costFilter.kind=this.value;renderTab(projects.find(x=>x.id===currentProjectId))">
          ${(()=>{ const used=[...new Set(withAmt.map(e=>e.kind).filter(Boolean))]; const base=["자재비","공사비","기타비용"]; const all=["전체"].concat(base.filter(b=>used.includes(b))).concat(used.filter(u=>!base.includes(u))); return all.map(k=>`<option ${costFilter.kind===k?'selected':''}>${esc(k)}</option>`).join(""); })()}</select>
        <select onchange="costFilter.pay=this.value;renderTab(projects.find(x=>x.id===currentProjectId))">
          ${["전체"].concat(opts("pays")).map(k=>`<option ${costFilter.pay===k?'selected':''}>${esc(k)}</option>`).join("")}</select>
        <input type="text" id="costSearchInput" placeholder="제목·거래처·메모 검색" value="${esc(costFilter.q)}" oninput="onCostSearch(this.value)">
        <b style="margin-left:auto" id="costListSum">${list.length}건 · ${listSum.toLocaleString()}원</b>
      </div>
      <div id="costList">${renderCostList(list)}</div>
    </div></div>`;
}
function renderCostList(list){
  if(!list.length) return '<div class="ai-empty">조건에 맞는 지출이 없습니다.</div>';
  if(window._costView==='card'){
    return list.map(e=>renderLog(e)).join("");
  }
  const head=`<div class="logrow head"><span class="lr-tag">분류</span><span class="lr-title">항목</span><span class="lr-vendor">거래처</span><span class="lr-amt">금액</span><span class="lr-date">날짜</span><span style="width:84px"></span></div>`;
  return head+list.map(e=>renderLog(e,{compact:true})).join("");
}
function costFiltered(){
  const withAmt=entries.filter(e=>Number(e.amount)>0);
  return withAmt.filter(e=>
    (costFilter.stage==="전체"||e.stage===costFilter.stage) &&
    (costFilter.kind==="전체"||e.kind===costFilter.kind) &&
    (costFilter.pay==="전체"||e.pay===costFilter.pay) &&
    (!costFilter.q || (e.title+' '+(e.vendor||'')+' '+(e.cat||'')+' '+(e.memo||'')).toLowerCase().includes(costFilter.q.toLowerCase()))
  );
}
function onCostSearch(v){
  costFilter.q=v;
  const list=costFiltered();
  const box=document.getElementById("costList"), sum=document.getElementById("costListSum");
  if(box) box.innerHTML = renderCostList(list);
  if(sum) sum.textContent = list.length+"건 · "+list.reduce((s,e)=>s+Number(e.amount),0).toLocaleString()+"원";
}

/* ===== 견적 · 부동산 ===== */
function quoteKRW(q){ return Number(q.amountKRW!=null?q.amountKRW:q.amount)||0; }
function viewQuotesAgents(p){
  return `
  <div class="panel"><div class="panel-h">📞 견적 비교 <span class="cnt">${quotes.length}건</span>
    <button class="btn btn-primary btn-sm add" onclick="openQuoteModal()">+ 견적 추가</button></div>
    <div class="panel-body">
      <div class="hint" style="margin-bottom:10px">여러 업체 견적을 입력하면 같은 공정끼리 묶어 <b>최저가(초록)·최고가(빨강)</b>로 표시합니다. 헤더를 눌러 정렬하세요.</div>
      ${renderQuoteTable()}
    </div></div>
  <div class="panel"><div class="panel-h">🏢 부동산 관리 <span class="cnt">${agents.length}곳</span>
    <button class="btn btn-primary btn-sm add" onclick="openAgentModal()">+ 부동산 추가</button></div>
    <div class="panel-body">
      <div class="hint" style="margin-bottom:10px">‘방문 +1’을 누를 때마다 방문 1회로 쌓입니다. <b>방문 횟수가 많은 부동산</b>이 위로 정렬돼, 자주 오는 곳 위주로 관리할 수 있습니다. 전화번호를 누르면 바로 전화가 걸립니다.</div>
      ${renderAgentTable()}
    </div></div>`;
}
function qSortHeader(label,key,cur){
  const on=cur.key===key;
  const ic=on?(cur.dir>0?'▲':'▼'):'⇅';
  return `<th class="sortable" onclick="sortQuotes('${key}')">${esc(label)}<span class="sort-ic">${ic}</span></th>`;
}
function sortQuotes(key){
  const s=window._quoteSort||{key:"krw",dir:1};
  if(s.key===key) s.dir=-s.dir; else { s.key=key; s.dir= (key==='krw'?1:1); }
  window._quoteSort=s; renderTab(projects.find(x=>x.id===currentProjectId));
}
function renderQuoteTable(){
  if(!quotes.length) return '<div class="ai-empty">등록된 견적이 없습니다. 전화로 받은 견적을 ‘+ 견적 추가’로 입력하세요.</div>';
  const s=window._quoteSort||{key:"krw",dir:1};
  // 공정별 최저/최고 표시용
  const byStage={};
  quotes.forEach(q=>{ const k=q.stage||"기타"; (byStage[k]=byStage[k]||[]).push(quoteKRW(q)); });
  const minOf={}, maxOf={};
  Object.keys(byStage).forEach(k=>{ minOf[k]=Math.min(...byStage[k]); maxOf[k]=Math.max(...byStage[k]); });
  let rows=quotes.slice();
  const getv={
    stage:q=>q.stage||"", title:q=>q.title||"", vendor:q=>q.vendor||"",
    krw:q=>quoteKRW(q), days:q=>Number(q.days)||0, date:q=>q.date||""
  }[s.key]||(q=>quoteKRW(q));
  rows.sort((a,b)=>{ const va=getv(a), vb=getv(b);
    if(typeof va==='number') return (va-vb)*s.dir;
    return String(va).localeCompare(String(vb))*s.dir; });
  const body=rows.map(q=>{
    const k=q.stage||"기타"; const amt=quoteKRW(q);
    const cnt=byStage[k].length;
    let cls=""; if(cnt>1){ if(amt===minOf[k]) cls="qrow-best"; else if(amt===maxOf[k]) cls="qrow-worst"; }
    return `<tr class="${cls}">
      <td>${esc(q.stage||'')}</td>
      <td>${esc(q.title||'')}${q.memo?`<br><span class="hint">${esc(q.memo)}</span>`:''}</td>
      <td>${esc(q.vendor||'')}${q.phone?`<br>${telLink(q.phone)}`:''}</td>
      <td class="num"><b>${amt.toLocaleString()}</b>${q.currency==="USD"?`<br><span class="hint">$${Number(q.amount).toLocaleString()}</span>`:''}</td>
      <td class="num">${q.days?Number(q.days)+'일':''}</td>
      <td>${q.date||''}${q.valid?`<br><span class="hint">~${q.valid}</span>`:''}</td>
      <td><button class="lr-btn" onclick="editQuote('${q.id}')">수정</button> <button class="lr-btn del" onclick="deleteQuote('${q.id}')">삭제</button></td>
    </tr>`;
  }).join("");
  return `<div style="overflow-x:auto"><table class="ctable quote-table">
    <thead><tr>
      ${qSortHeader('공정/분류','stage',s)}
      ${qSortHeader('견적 내용','title',s)}
      ${qSortHeader('업체','vendor',s)}
      ${qSortHeader('금액(원)','krw',s)}
      ${qSortHeader('기간','days',s)}
      ${qSortHeader('받은날','date',s)}
      <th></th>
    </tr></thead><tbody>${body}</tbody></table></div>`;
}
let editingQuoteId=null;
function openQuoteModal(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  editingQuoteId=null;
  document.getElementById("quoteModalTitle").textContent="견적 추가";
  document.getElementById("qf_id").value="";
  buildOptSelect("qf_stage","stages","","(공정 선택)");
  rebuildQuoteCat("");
  document.getElementById("qf_stage").addEventListener('change',()=>rebuildQuoteCat(""),{once:true});
  document.getElementById("qf_stage").onchange=()=>rebuildQuoteCat("");
  ["qf_title","qf_vendor","qf_phone","qf_amount","qf_days","qf_memo"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("qf_currency").value="KRW";
  document.getElementById("qf_date").value=today();
  document.getElementById("qf_valid").value="";
  document.getElementById("qf_fxhint").textContent="";
  document.getElementById("vendorList").innerHTML=vendors.map(v=>`<option value="${esc(v.name)}">`).join("");
  openModal("quoteModal");
}
function rebuildQuoteCat(selected){
  const stage=val("qf_stage");
  const key = stage? ("stage_cat_"+stage) : null;
  const sel=document.getElementById("qf_cat");
  if(!key){ sel.innerHTML='<option value="">(세부 항목 없음)</option>'; return; }
  const list=opts(key);
  sel.innerHTML='<option value="">(선택 안 함)</option>'+list.map(c=>`<option ${c===selected?'selected':''}>${esc(c)}</option>`).join("");
}
function editQuote(id){
  const q=quotes.find(x=>x.id===id); if(!q) return;
  editingQuoteId=id;
  document.getElementById("quoteModalTitle").textContent="견적 수정";
  document.getElementById("qf_id").value=id;
  buildOptSelect("qf_stage","stages",q.stage||"","(공정 선택)");
  document.getElementById("qf_stage").onchange=()=>rebuildQuoteCat("");
  rebuildQuoteCat(q.cat||"");
  document.getElementById("qf_title").value=q.title||"";
  document.getElementById("qf_vendor").value=q.vendor||"";
  document.getElementById("qf_phone").value=q.phone||"";
  document.getElementById("qf_amount").value=q.amount!=null?q.amount:"";
  document.getElementById("qf_currency").value=q.currency||"KRW";
  document.getElementById("qf_date").value=q.date||today();
  document.getElementById("qf_valid").value=q.valid||"";
  document.getElementById("qf_days").value=q.days||"";
  document.getElementById("qf_memo").value=q.memo||"";
  updateQuoteFx();
  openModal("quoteModal");
}
async function saveQuote(){
  const title=val("qf_title").trim(); const vendor=val("qf_vendor").trim();
  if(!title){alert("견적 내용을 입력하세요.");return;}
  if(!vendor){alert("업체명을 입력하세요.");return;}
  const cur=val("qf_currency")||"KRW";
  const amtOrig=val("qf_amount")?Number(val("qf_amount")):0;
  let amtKRW=amtOrig;
  if(cur==="USD"){
    if(!_fxRate){ alert("USD 견적인데 환율이 없습니다. 상단 배지에서 입력하세요."); return; }
    amtKRW=Math.round(amtOrig*_fxRate);
  }
  const data={
    projectId:currentProjectId, stage:val("qf_stage")||null, cat:val("qf_cat")||null,
    title, vendor, phone:val("qf_phone").trim(),
    amount:amtOrig, currency:cur, amountKRW:amtKRW, fxRate: cur==="USD"?_fxRate:null,
    date:val("qf_date"), valid:val("qf_valid")||null, days:val("qf_days")?Number(val("qf_days")):null,
    memo:val("qf_memo").trim()
  };
  try{
    const id=document.getElementById("qf_id").value;
    if(id){ await db.collection(QUOTES).doc(id).update(data); }
    else { data.createdAt=firebase.firestore.FieldValue.serverTimestamp(); await db.collection(QUOTES).add(data); }
    closeModal("quoteModal"); await reloadCurrent();
  }catch(err){ showError("견적 저장", err); }
}
async function deleteQuote(id){
  const q=quotes.find(x=>x.id===id);
  if(!confirm('이 견적을 삭제할까요?\n\n"'+((q&&q.title)||'')+'"'))return;
  try{ await db.collection(QUOTES).doc(id).delete(); await reloadCurrent(); }
  catch(err){ showError("견적 삭제", err); }
}

/* 부동산 */
function agentVisits(a){ return (a.visits||[]).reduce((s,v)=>s+(Number(v.count)||0),0); } // 데려온 인원 합
function agentVisitCount(a){ return (a.visits||[]).length; } // 방문 횟수
function sortAgents(key){
  const s=window._agentSort||{key:"count",dir:-1};
  if(s.key===key) s.dir=-s.dir; else { s.key=key; s.dir=-1; }
  window._agentSort=s; renderTab(projects.find(x=>x.id===currentProjectId));
}
function aSortHeader(label,key,cur){
  const on=cur.key===key; const ic=on?(cur.dir>0?'▲':'▼'):'⇅';
  return `<th class="sortable" onclick="sortAgents('${key}')">${esc(label)}<span class="sort-ic">${ic}</span></th>`;
}
function telLink(phone, cls){
  if(!phone) return '';
  const num=(phone||'').replace(/[^0-9+]/g,'');
  return `<a class="tel-link ${cls||''}" href="tel:${num}">📞 ${esc(phone)}</a>`;
}
function naverMapUrl(addr){ return "https://map.naver.com/p/search/"+encodeURIComponent(addr); }
function mapLink(addr, cls){
  if(!addr) return '';
  return `<a class="map-link ${cls||''}" href="${naverMapUrl(addr)}" target="_blank" rel="noopener">📍 ${esc(addr)}</a>`;
}
function renderAgentTable(){
  if(!agents.length) return '<div class="ai-empty">등록된 부동산이 없습니다. ‘+ 부동산 추가’로 입력하세요.</div>';
  const s=window._agentSort||{key:"count",dir:-1};
  const lastDate=a=>{ const vs=(a.visits||[]).map(v=>v.date).filter(Boolean).sort(); return vs.length?vs[vs.length-1]:""; };
  const getv={
    name:a=>a.name||"",
    count:a=>agentVisitCount(a),
    people:a=>agentVisits(a),
    last:a=>lastDate(a),
    price:a=>Number(a.price)||0,
    nego:a=>Number(a.nego)||0
  }[s.key]||(a=>agentVisitCount(a));
  let rows=agents.slice();
  rows.sort((a,b)=>{ const va=getv(a), vb=getv(b);
    if(typeof va==='number') return (va-vb)*s.dir;
    return String(va).localeCompare(String(vb))*s.dir; });
  const body=rows.map((a,i)=>{
    const vc=agentVisitCount(a);
    const ppl=agentVisits(a);
    const last=lastDate(a);
    const rankCls = (s.key==='count'&&s.dir<0&&i<3&&vc>0)?'top':'';
    // 방문 이력 (날짜 + 인원 + 메모) — 펼침
    const hist=(a.visits||[]).slice().sort((x,y)=>(y.date||"").localeCompare(x.date||"")).map((v,vi)=>
      `<div class="visit-hist-line">▸ ${esc(v.date||'')}${v.count?(' · '+v.count+'명'):''}${v.memo?(' · '+esc(v.memo)):''}
        <button class="visit-del" title="이 방문 삭제" onclick="deleteVisit('${a.id}',${(a.visits||[]).indexOf(v)})">×</button></div>`).join("");
    return `<tr>
      <td><span class="agent-rank ${rankCls}">${i+1}</span></td>
      <td><b>${esc(a.name||'')}</b>${a.agent?`<br><span class="hint">${esc(a.agent)}</span>`:''}
        ${a.memo?`<br><span class="hint">📝 ${esc(a.memo)}</span>`:''}</td>
      <td>${telLink(a.phone)}</td>
      <td class="num">${a.price?Number(a.price).toLocaleString()+'만':''}${a.nego?`<br><span class="hint">네고 ${Number(a.nego).toLocaleString()}만</span>`:''}</td>
      <td><span class="visit-pill ${vc?'':'zero'}">${vc}회</span>${ppl?`<br><span class="hint">손님 ${ppl}명</span>`:''}
        ${hist?`<div class="visit-hist">${hist}</div>`:''}</td>
      <td>${last||'<span class="hint">방문 없음</span>'}</td>
      <td>
        <button class="lr-btn" onclick="openVisit('${a.id}')">방문 +1</button>
        <button class="lr-btn" onclick="editAgent('${a.id}')">수정</button>
        <button class="lr-btn del" onclick="deleteAgent('${a.id}')">삭제</button>
      </td>
    </tr>`;
  }).join("");
  return `<div style="overflow-x:auto"><table class="ctable agent-table">
    <thead><tr>
      <th>#</th>
      ${aSortHeader('부동산','name',s)}
      <th>전화</th>
      ${aSortHeader('내놓은가/네고','price',s)}
      ${aSortHeader('방문 횟수','count',s)}
      ${aSortHeader('최근 방문','last',s)}
      <th></th>
    </tr></thead><tbody>${body}</tbody></table></div>
    <div class="hint" style="margin-top:8px">‘방문 횟수’ 헤더로 정렬하면 자주 오는(=적극적인) 부동산이 위로 올라옵니다. 한 번이라도 방문한 곳을 우선 관리하세요.</div>`;
}
function openAgentModal(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  document.getElementById("agentModalTitle").textContent="부동산 추가";
  document.getElementById("af_id").value="";
  ["af_name","af_agent","af_phone","af_price","af_nego","af_memo"].forEach(id=>document.getElementById(id).value="");
  openModal("agentModal");
}
function editAgent(id){
  const a=agents.find(x=>x.id===id); if(!a) return;
  document.getElementById("agentModalTitle").textContent="부동산 수정";
  document.getElementById("af_id").value=id;
  document.getElementById("af_name").value=a.name||"";
  document.getElementById("af_agent").value=a.agent||"";
  document.getElementById("af_phone").value=a.phone||"";
  document.getElementById("af_price").value=a.price!=null?a.price:"";
  document.getElementById("af_nego").value=a.nego!=null?a.nego:"";
  document.getElementById("af_memo").value=a.memo||"";
  openModal("agentModal");
}
async function saveAgent(){
  const name=val("af_name").trim(), phone=val("af_phone").trim();
  if(!name){alert("부동산 이름을 입력하세요.");return;}
  if(!phone){alert("전화번호를 입력하세요.");return;}
  const data={projectId:currentProjectId,name,agent:val("af_agent").trim(),phone,
    price:val("af_price")?Number(val("af_price")):null,
    nego:val("af_nego")?Number(val("af_nego")):null,
    memo:val("af_memo").trim()};
  try{
    const id=document.getElementById("af_id").value;
    if(id){ await db.collection(AGENTS).doc(id).update(data); }
    else { data.visits=[]; data.createdAt=firebase.firestore.FieldValue.serverTimestamp(); await db.collection(AGENTS).add(data); }
    closeModal("agentModal"); await reloadCurrent();
  }catch(err){ showError("부동산 저장", err); }
}
async function deleteAgent(id){
  const a=agents.find(x=>x.id===id);
  if(!confirm('이 부동산을 삭제할까요?\n\n"'+((a&&a.name)||'')+'"'))return;
  try{ await db.collection(AGENTS).doc(id).delete(); await reloadCurrent(); }
  catch(err){ showError("부동산 삭제", err); }
}
function openVisit(id){
  const a=agents.find(x=>x.id===id); if(!a) return;
  document.getElementById("vs_id").value=id;
  document.getElementById("vs_hint").textContent=(a.name||"")+" — 지금까지 "+agentVisitCount(a)+"회 방문"+(agentVisits(a)?(" · 손님 "+agentVisits(a)+"명"):"");
  document.getElementById("vs_date").value=today();
  document.getElementById("vs_count").value="0";
  document.getElementById("vs_memo").value="";
  openModal("visitModal");
}
async function saveVisit(){
  const id=document.getElementById("vs_id").value;
  const a=agents.find(x=>x.id===id); if(!a) return;
  const count=Number(val("vs_count"))||0;
  const visit={date:val("vs_date")||today(), count, memo:val("vs_memo").trim()};
  const visits=(a.visits||[]).concat([visit]);
  try{
    await db.collection(AGENTS).doc(id).update({visits});
    closeModal("visitModal"); await reloadCurrent();
  }catch(err){ showError("방문 기록", err); }
}
async function deleteVisit(id, idx){
  const a=agents.find(x=>x.id===id); if(!a||!a.visits) return;
  const v=a.visits[idx]; if(!v) return;
  if(!confirm('이 방문 기록을 삭제할까요?\n\n'+(v.date||'')+(v.memo?(' · '+v.memo):'')))return;
  try{
    const visits=a.visits.filter((_,i)=>i!==idx);
    await db.collection(AGENTS).doc(id).update({visits});
    await reloadCurrent();
  }catch(err){ showError("방문 삭제", err); }
}

/* (주말 빠른 입력·주말 비용 탭은 v3.8~v3.9에서 기록 추가로 통합되어 제거됨) */

/* ===== 사진 ===== */
function photoFolderOf(e){ return e.photoFolder || "기타 사진"; }
function viewPhotos(p){
  const photos=entries.filter(e=>(e.kind==="사진"||e.photoFolder) && (e.files||[]).some(f=>(f.type||"").startsWith("image/")));
  if(window._photoOpenId){
    const cat=window._photoOpenId;
    const inCat=photos.filter(e=>photoFolderOf(e)===cat).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    const all=[];
    inCat.forEach(e=>(e.files||[]).forEach((f,oi)=>{ if((f.type||"").startsWith("image/")) all.push({f,oi,e}); }));
    window._ivList=all.map(({f,oi,e})=>({url:f.url, cap:cat+' · '+(e.title||'')+' · '+f.name, entryId:e.id, fileIdx:oi}));
    const selMode=window._photoSelMode;
    if(!window._photoSel) window._photoSel={};
    const groups=inCat.map(e=>{
      const imgs=[]; (e.files||[]).forEach((f,oi)=>{ if((f.type||"").startsWith("image/")) imgs.push({f,oi}); });
      return `<div class="ph-group">
        <div class="ph-gh"><b>${esc(e.title||'(제목 없음)')}</b> <span class="cnt">${e.date||''} · ${imgs.length}장</span>
          <button class="btn btn-line btn-sm" onclick="addFilesToFolder('${e.id}')">+ 추가</button>
          <button class="btn btn-line btn-sm" onclick="editEntryMeta('${e.id}')">✏ 제목·메모</button></div>
        ${e.memo?`<div class="hint" style="margin:4px 0 8px">${esc(e.memo)}</div>`:''}
        <div class="gallery">${imgs.map(({f,oi})=>{
          const gi=all.findIndex(a=>a.f===f);
          const key=e.id+'_'+oi;
          if(selMode){
            const on=window._photoSel[key]?'on':'';
            return `<div class="gphoto sel ${on}" onclick="togglePhotoSel('${e.id}',${oi})"><img src="${f.url}"><div class="cap">${esc(f.name)}</div><span class="gcheck">${window._photoSel[key]?'✓':''}</span></div>`;
          }
          return `<div class="gphoto"><a href="javascript:void(0)" onclick="openViewerList(${gi})"><img src="${f.url}"><div class="cap">${esc(f.name)}</div></a><button class="gdel" onclick="deletePhoto('${e.id}',${oi})">×</button></div>`;
        }).join("")}</div></div>`;
    }).join("");
    const selCount=Object.keys(window._photoSel).filter(k=>window._photoSel[k]).length;
    const toolbar = selMode
      ? `<button class="btn btn-danger btn-sm" onclick="deleteSelectedPhotos()">선택 삭제 (${selCount})</button>
         <button class="btn btn-line btn-sm" onclick="window._photoSelMode=false;window._photoSel={};renderTab(projects.find(x=>x.id===currentProjectId))">취소</button>`
      : `<button class="btn btn-ghost btn-sm add" onclick="addPhotoToFolder('${jsstr(cat)}')">+ 사진 추가</button>
         ${all.length?`<button class="btn btn-line btn-sm" onclick="window._photoSelMode=true;window._photoSel={};renderTab(projects.find(x=>x.id===currentProjectId))">☑ 여러장 선택</button>`:''}`;
    return `<div class="panel"><div class="panel-h">
      <button class="btn btn-line btn-sm" onclick="navClosePhoto()">← 폴더 목록</button>
      <span style="margin-left:6px">📷 ${esc(cat)}</span><span class="cnt">${all.length}장</span>${toolbar}</div>
      <div class="panel-body">${inCat.length?groups:'<div class="ai-empty">이 폴더에 사진이 없습니다.</div>'}</div></div>`;
  }
  const folders=opts("photo_folders").map(cat=>{
    const inCat=photos.filter(e=>photoFolderOf(e)===cat);
    let cnt=0, cover=null;
    inCat.forEach(e=>(e.files||[]).forEach(f=>{ if((f.type||"").startsWith("image/")){ cnt++; if(!cover)cover=f; }}));
    return `<div class="folder" onclick="navOpenPhoto('${jsstr(cat)}')">
      <div class="folder-cover">${cover?`<img src="${cover.url}">`:'📷'}<span class="folder-cnt">${cnt}장</span></div>
      <div class="folder-name">${esc(cat)}</div><div class="folder-date">${cnt?cnt+'장':'비어있음'}</div></div>`;
  }).join("");
  return `<div class="panel"><div class="panel-h">📷 사진 폴더 <span class="cnt">기본 분류</span>
    <button class="btn btn-line btn-sm" onclick="openAddOpt('photo_folders',null)">+ 폴더 추가</button>
    <button class="btn btn-ghost btn-sm add" onclick="addPhotoToFolder('')">+ 사진 추가</button></div>
    <div class="panel-body"><div class="folders">${folders}</div></div></div>`;
}
function addPhotoToFolder(cat){
  openEntryModal(null,'사진');
  if(cat){ const sel=document.getElementById("ef_photofolder"); if(sel) sel.value=cat; }
}

/* ===== 서류 ===== */
function docEntries(){
  const seen=new Set(), list=[];
  entries.forEach(e=>{if(e.kind==="서류"){list.push(e);seen.add(e.id);}});
  entries.forEach(e=>{if(!seen.has(e.id)&&e.files&&e.files.some(f=>!(f.type||'').startsWith('image/'))) list.push(e);});
  return list.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
}
function docFolderOf(e){
  if(e.checkRef!=null && e.stage) return "체크리스트 첨부";
  return e.docFolder || "기타 서류";
}
function viewDocs(p){
  const docs=docEntries();
  if(window._docOpenId){
    const cat=window._docOpenId;
    const inCat=docs.filter(e=>docFolderOf(e)===cat).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    const groups=inCat.map(e=>{
      const files=e.files||[];
      return `<div class="ph-group">
        <div class="ph-gh"><b>${esc(e.title||'(제목 없음)')}</b> <span class="cnt">${e.date||''} · ${files.length}개${e.stage?' · '+esc(e.stage):''}</span>
          <button class="btn btn-line btn-sm" onclick="addFilesToFolder('${e.id}')">+ 추가</button>
          <button class="btn btn-line btn-sm" onclick="editEntryMeta('${e.id}')">✏ 제목·메모</button></div>
        ${e.memo?`<div class="hint" style="margin:4px 0 8px">${esc(e.memo)}</div>`:''}
        <div class="files" style="flex-direction:column;align-items:stretch">
          ${files.length? files.map((f,oi)=>{
            const isImg=(f.type||"").startsWith("image/");
            const open=isImg?`onclick="openViewer('${jsstr(f.url)}','${jsstr(f.name)}');return false;"`:'';
            return `<div class="docfile"><a href="${isImg?'javascript:void(0)':f.url}" ${isImg?open:'target="_blank" rel="noopener"'}>
              ${isImg?`<img src="${f.url}">`:`<div class="fi">${(f.name||'').toLowerCase().endsWith('.pdf')?'PDF':'파일'}</div>`}
              <span class="fname">${esc(f.name)}</span></a>
              <button class="gdel" style="position:static;display:inline-block;flex:0 0 auto" onclick="deletePhoto('${e.id}',${oi})">×</button></div>`;
          }).join("") : '<div class="ai-empty">첨부된 파일이 없습니다.</div>'}
        </div></div>`;
    }).join("");
    return `<div class="panel"><div class="panel-h">
      <button class="btn btn-line btn-sm" onclick="navCloseDoc()">← 폴더 목록</button>
      <span style="margin-left:6px">📁 ${esc(cat)}</span><span class="cnt">${inCat.length}건</span>
      ${cat!=="체크리스트 첨부"?`<button class="btn btn-ghost btn-sm add" onclick="addDocToFolder('${jsstr(cat)}')">+ 서류 추가</button>`:''}</div>
      <div class="panel-body">${inCat.length?groups:'<div class="ai-empty">이 폴더에 서류가 없습니다.</div>'}</div></div>`;
  }
  const cats=opts("doc_folders").slice();
  if(docs.some(e=>docFolderOf(e)==="체크리스트 첨부")) cats.push("체크리스트 첨부");
  const folders=cats.map(cat=>{
    const inCat=docs.filter(e=>docFolderOf(e)===cat);
    const cnt=inCat.reduce((s,e)=>s+((e.files||[]).length),0);
    return `<div class="folder" onclick="navOpenDoc('${jsstr(cat)}')">
      <div class="folder-cover" style="font-size:38px">${cat==="체크리스트 첨부"?'✔':'📄'}<span class="folder-cnt">${cnt}개</span></div>
      <div class="folder-name">${esc(cat)}</div><div class="folder-date">${cnt?cnt+'개 파일':'비어있음'}</div></div>`;
  }).join("");
  return `<div class="panel"><div class="panel-h">📁 서류 폴더 <span class="cnt">기본 분류</span>
    <button class="btn btn-line btn-sm" onclick="openAddOpt('doc_folders',null)">+ 폴더 추가</button>
    <button class="btn btn-ghost btn-sm add" onclick="addDocToFolder('')">+ 서류 추가</button></div>
    <div class="panel-body"><div class="folders">${folders}</div></div></div>`;
}
function addDocToFolder(cat){
  openEntryModal(null,'서류');
  if(cat){ const sel=document.getElementById("ef_docfolder"); if(sel) sel.value=cat; }
}

/* ===== 업체 ===== */
function viewVendors(p){
  const calls=entries.filter(e=>e.kind==="연락");
  const spentBy={}; entries.filter(e=>Number(e.amount)>0&&e.vendor).forEach(e=>{spentBy[e.vendor]=(spentBy[e.vendor]||0)+Number(e.amount);});
  return `
    <div class="panel"><div class="panel-h">📇 업체 연락처 <span class="cnt">${vendors.length}곳</span>
      <button class="btn btn-ghost btn-sm add" onclick="openVendorModal()">+ 업체 추가</button></div>
      <div class="panel-body">${vendors.length? vendors.map(v=>renderVendor(v,spentBy[v.name])).join("") : '<div class="ai-empty">등록된 업체가 없습니다.</div>'}</div></div>
    <div class="panel"><div class="panel-h">📞 연락 기록 <span class="cnt">${calls.length}건</span>
      <button class="btn btn-ghost btn-sm add" onclick="openEntryModal(null,'연락')">+ 연락 기록</button></div>
      <div class="panel-body">${calls.length? calls.map(renderLog).join("") : '<div class="ai-empty">통화·문자·방문 기록을 남기세요.</div>'}</div></div>`;
}

/* ===== 검색 ===== */
function searchEntries(q){
  q=(q||"").trim().toLowerCase(); if(!q) return null;
  return entries.filter(e=>[e.title,e.memo,e.vendor,e.cat,e.stage,e.kind,e.pay,e.amount].join(' ').toLowerCase().includes(q));
}
function searchChecklist(q){
  q=(q||"").trim().toLowerCase(); if(!q) return [];
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return [];
  const cstate=p.checkState||{}; const out=[];
  Object.keys(cstate).forEach(stage=>{
    const items=STAGE_CHECKLIST[stage]||[];
    Object.keys(cstate[stage]||{}).forEach(i=>{
      const c=cstate[stage][i]; const item=items[i]; if(!item) return;
      const hay=[item.t,c.memo,c.amount,c.date].join(' ').toLowerCase();
      if(hay.includes(q)) out.push({stage,t:item.t,c});
    });
  });
  return out;
}
function searchMaterials(q){
  q=(q||"").trim().toLowerCase(); if(!q) return [];
  return materials.filter(m=>[m.name,m.brand,m.spec,m.cat,m.space,m.stage,m.supplier,m.memo].join(' ').toLowerCase().includes(q));
}
function searchQuotes(q){
  q=(q||"").trim().toLowerCase(); if(!q) return [];
  return quotes.filter(x=>[x.title,x.vendor,x.stage,x.cat,x.memo].join(' ').toLowerCase().includes(q));
}
function renderSearchResult(){
  const cnt=document.getElementById("searchCount");
  const box=document.getElementById("searchResult");
  if(!box) return;
  const res=searchEntries(searchQ);
  if(res===null){
    if(cnt) cnt.textContent="";
    box.innerHTML='<div class="ai-empty">찾을 단어를 입력하세요. 기록·비용·자재·견적·체크리스트에서 한 번에 찾습니다.</div>';
    return;
  }
  const ckRes=searchChecklist(searchQ), matRes=searchMaterials(searchQ), qRes=searchQuotes(searchQ);
  if(cnt) cnt.textContent=(res.length+ckRes.length+matRes.length+qRes.length)+"건";
  const ckHtml=ckRes.map(r=>{
    const parts=[]; if(r.c.memo)parts.push(esc(r.c.memo)); if(r.c.amount)parts.push(Number(r.c.amount).toLocaleString()+'원'); if(r.c.date)parts.push(r.c.date);
    return `<div class="log"><div class="l-top"><span class="l-tag 공정">${esc(r.stage)}</span><span class="l-title">✔ ${esc(r.t)}</span></div>${parts.length?`<div class="l-memo">${parts.join(' · ')}</div>`:''}</div>`;
  }).join("");
  const matHtml=matRes.map(m=>`<div class="log"><div class="l-top"><span class="l-tag">🧱 자재</span>${m.space?`<span class="l-tag 공정">${esc(m.space)}</span>`:''}<span class="l-title">${esc(m.name)}</span>${matAmount(m)?`<span class="l-date">${matAmount(m).toLocaleString()}원</span>`:''}</div><div class="l-meta">${[m.cat,m.brand,m.spec,m.supplier].filter(Boolean).map(esc).join(' · ')}</div></div>`).join("");
  const qHtml=qRes.map(x=>`<div class="log"><div class="l-top"><span class="l-tag">📞 견적</span>${x.stage?`<span class="l-tag 공정">${esc(x.stage)}</span>`:''}<span class="l-title">${esc(x.title)}</span><span class="l-date">${quoteKRW(x).toLocaleString()}원</span></div><div class="l-meta">${esc(x.vendor||'')}${x.memo?' · '+esc(x.memo):''}</div></div>`).join("");
  const entHtml = res.length? res.map(renderLog).join("") : '';
  box.innerHTML = (ckHtml+matHtml+qHtml+entHtml) || '<div class="ai-empty">검색 결과가 없습니다.</div>';
}
function onSearchInput(v){ searchQ=v; renderSearchResult(); }
function onSearchTabActivated(){ requestAnimationFrame(()=>{ applyStdSearchStyle('searchInput'); }); }
function viewSearch(p){
  return `<div class="panel"><div class="panel-h">🔍 통합 검색 <span class="cnt" id="searchCount"></span></div><div class="panel-body">
    <div class="filterbar"><input type="text" id="searchInput" autofocus
      placeholder="제목·메모·거래처·공정·자재·견적 검색 (예: 타일, 김부장)"
      value="${esc(searchQ)}" oninput="onSearchInput(this.value)"></div>
    <div id="searchResult"></div></div></div>`;
}

/* ============================================================
   작업일지 (주중=업체 작업 / 주말=내 작업)
   ============================================================ */
function isWeekendDate(ds){ const d=new Date(ds+"T00:00:00").getDay(); return d===0||d===6; }
function wlSide(w){ return w.side || (isWeekendDate(w.date)?"내작업":"업체작업"); }
function viewWorklog(p){
  const filt=window._wlFilter||"전체";
  let list=worklogs.slice();
  if(filt!=="전체") list=list.filter(w=>wlSide(w)===filt);
  const mine=worklogs.filter(w=>wlSide(w)==="내작업").length;
  const vend=worklogs.filter(w=>wlSide(w)==="업체작업").length;
  const dates=[...new Set(worklogs.map(w=>w.date))];
  // 날짜별 그룹
  const byDate={}; list.forEach(w=>{ (byDate[w.date]=byDate[w.date]||[]).push(w); });
  const sortedDates=Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
  const blocks=sortedDates.map(d=>{
    const dow=["일","월","화","수","목","금","토"][new Date(d+"T00:00:00").getDay()];
    const items=byDate[d];
    return `<div class="wl-day">
      <div class="wl-date">📅 ${d} (${dow}) <span class="cnt">${items.length}건</span></div>
      ${items.map(w=>{
        const side=wlSide(w);
        const photos=(w.files||[]).filter(f=>(f.type||"").startsWith("image/"));
        return `<div class="wl-item ${side==='내작업'?'mine':'vendor'}">
          <div class="wl-top">
            <span class="wl-side ${side==='내작업'?'mine':'vendor'}">${side==='내작업'?'🙋 내 작업':'🏢 업체'}</span>
            ${w.vendor?`<span class="wl-vendor">${esc(w.vendor)}</span>`:''}
            ${w.hours?`<span class="wl-hours">⏱ ${esc(w.hours)}</span>`:''}
            <span class="wl-acts">
              <button class="lr-btn" onclick="editWorklog('${w.id}')">수정</button>
              <button class="lr-btn del" onclick="deleteWorklog('${w.id}')">삭제</button>
            </span>
          </div>
          <div class="wl-title">${esc(w.title||'')}</div>
          ${w.memo?`<div class="wl-memo">${esc(w.memo)}</div>`:''}
          ${photos.length?`<div class="wl-photos">${photos.map((f,i)=>{const gi=(w.files||[]).indexOf(f);return `<div class="wl-thumb" onclick="openWorklogPhotos('${w.id}',${gi})"><img src="${f.url}"></div>`;}).join("")}</div>`:''}
          <div class="wl-files">${(w.files||[]).map((f,oi)=>{
            const isImg=(f.type||"").startsWith("image/"); if(isImg) return '';
            return `<a class="ck-file" href="${f.url}" target="_blank" rel="noopener">📄 ${esc(f.name)}</a>`;
          }).join("")}</div>
        </div>`;
      }).join("")}
    </div>`;
  }).join("");
  return `
    <div class="stats">
      <div class="stat"><div class="label">작업일지</div><div class="value">${worklogs.length}<small> 건</small></div></div>
      <div class="stat"><div class="label">🙋 내 작업(주말)</div><div class="value">${mine}<small> 건</small></div></div>
      <div class="stat"><div class="label">🏢 업체 작업(주중)</div><div class="value">${vend}<small> 건</small></div></div>
      <div class="stat"><div class="label">작업한 날</div><div class="value">${dates.length}<small> 일</small></div></div>
    </div>
    <div class="panel"><div class="panel-h">📒 작업일지 <span class="cnt">주중=업체 / 주말=내 작업</span>
      <button class="btn btn-primary btn-sm add" onclick="openWorklog()">+ 작업 기록</button></div>
      <div class="panel-body">
        <div class="filterbar">
          ${["전체","내작업","업체작업"].map(f=>`<button class="mini-chip ${filt===f?'on':''}" onclick="window._wlFilter='${f}';renderTab(projects.find(x=>x.id===currentProjectId))">${f==='내작업'?'🙋 내 작업':f==='업체작업'?'🏢 업체 작업':'전체'}</button>`).join("")}
        </div>
        ${blocks||'<div class="ai-empty">작업 기록이 없습니다. ‘+ 작업 기록’으로 오늘 한 일을 남기세요.</div>'}
      </div></div>`;
}
function openWorklog(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  document.getElementById("wl_id").value="";
  document.getElementById("worklogModalTitle").textContent="작업 기록 추가";
  document.getElementById("wl_date").value=today();
  document.getElementById("wl_side").value = isWeekendDate(today())?"내작업":"업체작업";
  buildOptSelect("wl_vendor_sel","vendor_roles","","(역할 선택 안 함)");
  ["wl_title","wl_vendor","wl_hours","wl_memo"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("wl_files").value="";
  const wldp=document.getElementById("wl_dropPreview"); if(wldp) wldp.innerHTML=""; window._wlDropFiles=[];
  document.getElementById("vendorList").innerHTML=vendors.map(v=>`<option value="${esc(v.name)}">`).join("");
  openModal("worklogModal");
}
function editWorklog(id){
  const w=worklogs.find(x=>x.id===id); if(!w) return;
  document.getElementById("wl_id").value=id;
  document.getElementById("worklogModalTitle").textContent="작업 기록 수정";
  document.getElementById("wl_date").value=w.date||today();
  document.getElementById("wl_side").value=wlSide(w);
  document.getElementById("wl_title").value=w.title||"";
  document.getElementById("wl_vendor").value=w.vendor||"";
  document.getElementById("wl_hours").value=w.hours||"";
  document.getElementById("wl_memo").value=w.memo||"";
  document.getElementById("wl_files").value="";
  const ewldp=document.getElementById("wl_dropPreview"); if(ewldp) ewldp.innerHTML=""; window._wlDropFiles=[];
  document.getElementById("vendorList").innerHTML=vendors.map(v=>`<option value="${esc(v.name)}">`).join("");
  openModal("worklogModal");
}
async function saveWorklog(){
  const title=val("wl_title").trim(); if(!title){ alert("한 일(제목)을 입력하세요."); return; }
  const btn=document.getElementById("wl_saveBtn"); btn.disabled=true; btn.textContent="저장 중...";
  try{
    let newFiles=[]; const fi=document.getElementById("wl_files");
    const allWlFiles=[...Array.from(fi?.files||[]),...(window._wlDropFiles||[])];
    if(allWlFiles.length){ for(let i=0;i<allWlFiles.length;i++){ showUploading("사진 올리는 중… ("+(i+1)+"/"+allWlFiles.length+")"); newFiles.push(await processFile(allWlFiles[i])); } hideUploading(); }
    const data={ projectId:currentProjectId, date:val("wl_date"), side:val("wl_side"),
      title, vendor:val("wl_vendor").trim(), hours:val("wl_hours").trim(), memo:val("wl_memo").trim() };
    const id=document.getElementById("wl_id").value;
    if(id){
      const w=worklogs.find(x=>x.id===id);
      data.files=((w&&w.files)||[]).concat(newFiles);
      await db.collection(WORKLOG).doc(id).update(data);
    } else {
      data.files=newFiles; data.createdAt=firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(WORKLOG).add(data);
    }
    btn.disabled=false; btn.textContent="저장"; closeModal("worklogModal"); await reloadCurrent();
  }catch(err){ hideUploading(); btn.disabled=false; btn.textContent="저장"; showError("작업일지 저장", err); }
}
async function deleteWorklog(id){
  const w=worklogs.find(x=>x.id===id);
  if(!confirm('이 작업 기록을 삭제할까요?\n\n"'+((w&&w.title)||'')+'"'))return;
  try{
    if(w&&w.files) for(const f of w.files){ if(f.path){ try{ await storage.ref(f.path).delete(); }catch(_){} } }
    await db.collection(WORKLOG).doc(id).delete(); await reloadCurrent();
  }catch(err){ showError("작업일지 삭제", err); }
}
function openWorklogPhotos(id, idx){
  const w=worklogs.find(x=>x.id===id); if(!w) return;
  const imgs=(w.files||[]).map((f,i)=>({f,i})).filter(o=>(o.f.type||"").startsWith("image/"));
  if(!imgs.length) return;
  window._ivList=imgs.map(o=>({url:o.f.url, cap:(w.title||'')+' · '+o.f.name, entryId:null}));
  let gi=imgs.findIndex(o=>o.i===idx); if(gi<0) gi=0;
  openViewerList(gi);
}

/* ============================================================
   준비·할일 (체크박스 겸용 메모, 다음 주 준비 통합)
   ============================================================ */
function viewTodos(p){
  const open=todos.filter(t=>!t.done);
  const done=todos.filter(t=>t.done);
  const sortFn=(a,b)=>{ const da=a.due||"9999", db_=b.due||"9999"; if(da!==db_) return da.localeCompare(db_); return (a.createdOrder||0)-(b.createdOrder||0); };
  open.sort(sortFn);
  const card=t=>{
    const photos=(t.files||[]).filter(f=>(f.type||"").startsWith("image/"));
    const overdue = t.due && !t.done && t.due < today();
    return `<div class="todo-item ${t.done?'done':''}">
      <label class="todo-check"><input type="checkbox" ${t.done?'checked':''} onchange="toggleTodo('${t.id}',this.checked)"></label>
      <div class="todo-body">
        <div class="todo-title">${esc(t.title||'')}</div>
        ${t.memo?`<div class="todo-memo">${esc(t.memo)}</div>`:''}
        <div class="todo-meta">
          ${t.due?`<span class="todo-due ${overdue?'over':''}">📅 ${t.due}${overdue?' (지남)':''}</span>`:''}
          ${t.tag?`<span class="l-tag">${esc(t.tag)}</span>`:''}
        </div>
        ${photos.length?`<div class="wl-photos">${photos.map((f)=>{const gi=(t.files||[]).indexOf(f);return `<div class="wl-thumb" onclick="openTodoPhotos('${t.id}',${gi})"><img src="${f.url}"></div>`;}).join("")}</div>`:''}
        ${(t.files||[]).some(f=>!(f.type||'').startsWith('image/'))?`<div class="wl-files">${(t.files||[]).map((f,oi)=>{const isImg=(f.type||"").startsWith("image/");if(isImg)return'';return `<a class="ck-file" href="${f.url}" target="_blank" rel="noopener">📄 ${esc(f.name)}</a>`;}).join("")}</div>`:''}
      </div>
      <div class="todo-acts">
        <button class="lr-btn" onclick="editTodo('${t.id}')">수정</button>
        <button class="lr-btn del" onclick="deleteTodo('${t.id}')">삭제</button>
      </div>
    </div>`;
  };
  return `
    <div class="stats">
      <div class="stat"><div class="label">할 일</div><div class="value">${open.length}<small> 건 남음</small></div></div>
      <div class="stat"><div class="label">완료</div><div class="value">${done.length}<small> 건</small></div></div>
      <div class="stat"><div class="label">기한 지남</div><div class="value" style="${open.some(t=>t.due&&t.due<today())?'color:var(--danger)':''}">${open.filter(t=>t.due&&t.due<today()).length}<small> 건</small></div></div>
      <div class="stat"><div class="label">이번 주</div><div class="value">${open.filter(t=>t.due&&t.due>=today()&&t.due<=weekLater()).length}<small> 건</small></div></div>
    </div>
    <div class="panel"><div class="panel-h">✅ 준비·할일 <span class="cnt">다음 주 준비사항·메모</span>
      <button class="btn btn-primary btn-sm add" onclick="openTodo()">+ 할일 / 메모 추가</button></div>
      <div class="panel-body">
        ${open.length? open.map(card).join("") : '<div class="ai-empty">할 일이 없습니다. 다음 주 준비사항이나 메모를 추가하세요.</div>'}
      </div></div>
    ${done.length?`<div class="panel"><div class="panel-h">✔ 완료됨 <span class="cnt">${done.length}건</span>
      <button class="btn btn-line btn-sm add" onclick="clearDoneTodos()">완료 항목 비우기</button></div>
      <div class="panel-body">${done.map(card).join("")}</div></div>`:''}`;
}
function weekLater(){ const d=new Date(); d.setDate(d.getDate()+7); return d.toISOString().slice(0,10); }
function openTodo(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  document.getElementById("td_id").value="";
  document.getElementById("todoModalTitle").textContent="할일 / 메모 추가";
  ["td_title","td_memo","td_due","td_tag"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("td_files").value="";
  const tddp=document.getElementById("td_dropPreview"); if(tddp) tddp.innerHTML=""; window._tdDropFiles=[];
  openModal("todoModal");
}
function editTodo(id){
  const t=todos.find(x=>x.id===id); if(!t) return;
  document.getElementById("td_id").value=id;
  document.getElementById("todoModalTitle").textContent="할일 / 메모 수정";
  document.getElementById("td_title").value=t.title||"";
  document.getElementById("td_memo").value=t.memo||"";
  document.getElementById("td_due").value=t.due||"";
  document.getElementById("td_tag").value=t.tag||"";
  document.getElementById("td_files").value="";
  openModal("todoModal");
}
async function saveTodo(){
  const title=val("td_title").trim(); if(!title){ alert("할 일/메모 내용을 입력하세요."); return; }
  const btn=document.getElementById("td_saveBtn"); btn.disabled=true; btn.textContent="저장 중...";
  try{
    let newFiles=[]; const fi=document.getElementById("td_files");
    const allTdFiles=[...Array.from(fi?.files||[]),...(window._tdDropFiles||[])];
    if(allTdFiles.length){ for(let i=0;i<allTdFiles.length;i++){ showUploading("사진 올리는 중… ("+(i+1)+"/"+allTdFiles.length+")"); newFiles.push(await processFile(allTdFiles[i])); } hideUploading(); }
    const data={ projectId:currentProjectId, title, memo:val("td_memo").trim(),
      due:val("td_due")||null, tag:val("td_tag").trim() };
    const id=document.getElementById("td_id").value;
    if(id){
      const t=todos.find(x=>x.id===id);
      data.files=((t&&t.files)||[]).concat(newFiles);
      await db.collection(TODOS).doc(id).update(data);
    } else {
      data.files=newFiles; data.done=false;
      data.createdOrder=Date.now();
      data.createdAt=firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(TODOS).add(data);
    }
    btn.disabled=false; btn.textContent="저장"; closeModal("todoModal"); await reloadCurrent();
  }catch(err){ hideUploading(); btn.disabled=false; btn.textContent="저장"; showError("할일 저장", err); }
}
async function toggleTodo(id, done){
  try{ await db.collection(TODOS).doc(id).update({done}); const t=todos.find(x=>x.id===id); if(t)t.done=done; renderTab(projects.find(x=>x.id===currentProjectId)); }
  catch(err){ showError("할일 체크", err); }
}
async function deleteTodo(id){
  const t=todos.find(x=>x.id===id);
  if(!confirm('이 항목을 삭제할까요?\n\n"'+((t&&t.title)||'')+'"'))return;
  try{
    if(t&&t.files) for(const f of t.files){ if(f.path){ try{ await storage.ref(f.path).delete(); }catch(_){} } }
    await db.collection(TODOS).doc(id).delete(); await reloadCurrent();
  }catch(err){ showError("할일 삭제", err); }
}
async function clearDoneTodos(){
  const done=todos.filter(t=>t.done); if(!done.length) return;
  if(!confirm("완료된 "+done.length+"건을 모두 삭제할까요?"))return;
  try{
    showUploading("삭제 중…");
    for(const t of done){ if(t.files) for(const f of t.files){ if(f.path){ try{ await storage.ref(f.path).delete(); }catch(_){} } } }
    const batch=db.batch(); done.forEach(t=>batch.delete(db.collection(TODOS).doc(t.id))); await batch.commit();
    hideUploading(); await reloadCurrent();
  }catch(err){ hideUploading(); showError("완료 항목 비우기", err); }
}
function openTodoPhotos(id, idx){
  const t=todos.find(x=>x.id===id); if(!t) return;
  const imgs=(t.files||[]).map((f,i)=>({f,i})).filter(o=>(o.f.type||"").startsWith("image/"));
  if(!imgs.length) return;
  window._ivList=imgs.map(o=>({url:o.f.url, cap:(t.title||'')+' · '+o.f.name, entryId:null}));
  let gi=imgs.findIndex(o=>o.i===idx); if(gi<0) gi=0;
  openViewerList(gi);
}
/* ============================================================
   JS 3/3 — 기록 CRUD · 이미지뷰어 · AI · 빠른입력/엑셀/반복 · 백업 · 프로젝트 · 진단
   ============================================================ */

/* ===== 기록(Entry) ===== */
/* ===== 종류별 표시 칸 설정 =====
   기본: 사진/서류는 폴더칸, 그 외(자재비·공사비·기타비용 + 사용자 추가 종류)는 금액·결제·거래처·공정·세부 표시.
   사용자가 종류별로 칸을 켜고 끌 수 있고, realestate_options 의 kindcfg_<종류> 키에 저장됨. */
const ALL_FIELDS=["amount","pay","vendor","stage","cat","photofolder","docfolder"];
const FIELD_LABELS={amount:"금액",pay:"결제수단",vendor:"거래처",stage:"공정 단계",cat:"세부 항목",photofolder:"사진 폴더",docfolder:"서류 폴더"};
function defaultKindFields(k){
  if(k==="사진") return ["stage","photofolder","vendor"];
  if(k==="서류") return ["stage","docfolder","vendor"];
  if(k==="연락") return ["stage","vendor"];
  if(k==="메모") return ["stage"];
  if(k==="문제") return ["stage","vendor"];
  // 자재비/공사비/기타비용 및 사용자 추가 종류 → 돈 항목으로 간주
  return ["amount","pay","vendor","stage","cat"];
}
function kindFields(k){
  const saved=userOpts["kindcfg_"+k];
  if(Array.isArray(saved) && saved.length) return saved;
  return defaultKindFields(k);
}
function kindIsMoney(k){ return kindFields(k).includes("amount"); }
function onKindChange(){
  const k=val("ef_kind");
  const f=kindFields(k);
  show("g_amount", f.includes("amount"));
  show("g_pay", f.includes("pay"));
  show("g_photofolder", f.includes("photofolder"));
  show("g_docfolder", f.includes("docfolder"));
  show("g_stage", f.includes("stage"));
  document.getElementById("g_cat").style.display = f.includes("cat")?"block":"none";
  // 거래처 칸 표시
  const gv=document.getElementById("ef_vendor"); if(gv){ const fld=gv.closest('.field'); if(fld) fld.style.display=f.includes("vendor")?"block":"none"; }
  if(f.includes("cat")) fillCatSelect();
  // 라벨 동적 안내: 자재비/공사비는 "공정 먼저 → 세부"
  const labStage=document.getElementById("lab_stage");
  const labCat=document.getElementById("lab_cat");
  if(labStage&&labCat){
    if(k==="자재비"){ labStage.innerHTML='① 공정 단계 <b style="color:var(--accent)">먼저 선택</b>'; labCat.textContent='② 공정 세부 (자재)'; }
    else if(k==="공사비"){ labStage.textContent='① 공정 단계'; labCat.textContent='② 세부 (인건비·시공비 등)'; }
    else { labStage.textContent='공정 단계'; labCat.textContent='세부 항목'; }
  }
  // 자재비만 규격·단가·부가세 (공사비는 인건비라 제외)
  show("g_matspec", k==="자재비");
  if(k==="자재비") fillMatPick();
  // 식비 메뉴, 주유 거리 그룹
  show("g_meals", k==="식비");
  show("g_dist", k==="주유·가스");
  if(k==="식비") renderEfMeals();
  // 공사비 인건비: 인부 개별 입력 그룹
  efWorkerToggle();
  renderCustomFields(); // 종류별 커스텀 입력칸
  renderQuickKinds(); // 빠른 선택 칩 강조 갱신
}
/* ===== 공사비 인건비: 인부 개별(이름+일당) + 합계 ===== */
let _efWorkers=[]; let _efWorkerSeq=1;
function efWorkerToggle(){
  const k=val("ef_kind");
  const cat=val("ef_cat");
  const on = (k==="공사비" && /인건비|일당/.test(cat||""));
  show("g_workers", on);
  if(on) renderEfWorkers();
}
function efAddWorker(){
  const nm=(val("ef_workerName")||"").trim();
  const pay=Number(val("ef_workerPay"))||0;
  if(!nm && !pay){ alert("인부 이름이나 일당을 입력하세요."); return; }
  _efWorkers.push({id:_efWorkerSeq++, name:nm||"(인부)", pay});
  document.getElementById("ef_workerName").value="";
  document.getElementById("ef_workerPay").value="";
  document.getElementById("ef_workerName").focus();
  renderEfWorkers();
}
function efRemoveWorker(id){ _efWorkers=_efWorkers.filter(w=>w.id!==id); renderEfWorkers(); }
function efWorkerSum(){ return _efWorkers.reduce((s,w)=>s+(Number(w.pay)||0),0); }
function renderEfWorkers(){
  const box=document.getElementById("ef_workerList"); if(!box) return;
  if(!_efWorkers.length){ box.innerHTML='<div class="hint" style="margin:4px 0">인부를 한 명씩 추가하면(이름+일당) 자동 합산되어 금액에 들어갑니다.</div>'; }
  else {
    box.innerHTML=_efWorkers.map(w=>`<div class="wk-menu-row">
      <span class="wk-menu-name">👷 ${esc(w.name)}</span>
      <span class="wk-menu-price">${w.pay.toLocaleString()}원</span>
      <button type="button" class="opt-del-btn" onclick="efRemoveWorker(${w.id})">삭제</button>
    </div>`).join("");
  }
  const sum=efWorkerSum();
  const sumEl=document.getElementById("ef_workerSum");
  if(sumEl) sumEl.textContent= sum? (_efWorkers.length+"명 · 합계 "+sum.toLocaleString()+"원"):"";
  if(sum){ const amtEl=document.getElementById("ef_amount"); if(amtEl){ amtEl.value=sum; updateEntryFx&&updateEntryFx(); } }
}
/* ===== 식비 메뉴 여러 개 + 합계 (기록추가) ===== */
let _efMeals=[]; let _efMealSeq=1;
function efAddMeal(){
  const nm=(val("ef_mealName")||"").trim();
  const pr=Number(val("ef_mealPrice"))||0;
  if(!nm && !pr){ alert("메뉴 이름이나 가격을 입력하세요."); return; }
  _efMeals.push({id:_efMealSeq++, name:nm||"(메뉴)", price:pr});
  document.getElementById("ef_mealName").value="";
  document.getElementById("ef_mealPrice").value="";
  document.getElementById("ef_mealName").focus();
  renderEfMeals();
}
function efRemoveMeal(id){ _efMeals=_efMeals.filter(m=>m.id!==id); renderEfMeals(); }
function efMealSum(){ return _efMeals.reduce((s,m)=>s+(Number(m.price)||0),0); }
function renderEfMeals(){
  const box=document.getElementById("ef_mealList"); if(!box) return;
  if(!_efMeals.length){ box.innerHTML='<div class="hint" style="margin:4px 0">메뉴를 여러 개 추가하면 자동 합산되어 금액에 들어갑니다.</div>'; }
  else {
    box.innerHTML=_efMeals.map(m=>`<div class="wk-menu-row">
      <span class="wk-menu-name">${esc(m.name)}</span>
      <span class="wk-menu-price">${m.price.toLocaleString()}원</span>
      <button type="button" class="opt-del-btn" onclick="efRemoveMeal(${m.id})">삭제</button>
    </div>`).join("");
  }
  const sum=efMealSum();
  const sumEl=document.getElementById("ef_mealSum"); if(sumEl) sumEl.textContent= sum? ("메뉴 합계: "+sum.toLocaleString()+"원"):"";
  if(sum){ const amtEl=document.getElementById("ef_amount"); if(amtEl){ amtEl.value=sum; updateEntryFx&&updateEntryFx(); } }
}
/* 자재 단가×수량×부가세 → 금액 자동 계산 */
function calcMatAmount(){
  const up=Number(val("ef_unitprice"))||0;
  const qty=Number(val("ef_qty"))||0;
  const ship=Number(val("ef_shipping"))||0;
  if(!up || !qty){
    // 단가·수량이 없어도 택배비만 있으면 그것만 반영
    if(ship){ const amtEl=document.getElementById("ef_amount"); if(amtEl){ amtEl.value=ship; updateEntryFx&&updateEntryFx(); } const h0=document.getElementById("ef_vatHint"); if(h0) h0.textContent="택배비 "+ship.toLocaleString()+"원"; }
    else { const h=document.getElementById("ef_vatHint"); if(h) h.textContent=""; }
    return;
  }
  const vatEl=document.querySelector('input[name="ef_vat"]:checked');
  const vat=vatEl?vatEl.value:"포함";
  let total=up*qty;
  let note="";
  if(vat==="별도"){ const supply=total; total=Math.round(total*1.1); note="공급가 "+supply.toLocaleString()+"원 + 부가세 "+(total-supply).toLocaleString()+"원"; }
  else if(vat==="포함"){ const supply=Math.round(total/1.1); note="공급가 "+supply.toLocaleString()+"원 (부가세 "+(total-supply).toLocaleString()+"원 포함)"; }
  else { note="부가세 없음"; }
  if(ship){ total+=ship; note+=" + 택배비 "+ship.toLocaleString()+"원"; }
  const amtEl=document.getElementById("ef_amount"); if(amtEl){ amtEl.value=total; updateEntryFx&&updateEntryFx(); }
  const h=document.getElementById("ef_vatHint"); if(h) h.textContent=note+" · 합계 "+total.toLocaleString()+"원";
}
/* 자재비 입력 — 재고에서 불러오기 */
function fillMatPick(){
  const sel=document.getElementById("ef_matpick"); if(!sel) return;
  const list=materials.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  sel.innerHTML='<option value="">— 등록된 자재 선택 (규격·단가 자동 입력) —</option>'
    + list.map(m=>{
        const price=(m.unitPriceKRW!=null?m.unitPriceKRW:m.unitPrice);
        const stk=(m.stock!=null?` · 재고 ${m.stock}${m.unit||''}`:'');
        return `<option value="${m.id}">${esc(m.name)}${m.spec?' ('+esc(m.spec)+')':''}${price?' · '+Number(price).toLocaleString()+'원':''}${stk}</option>`;
      }).join("");
  window._efMatId=null;
  const h=document.getElementById("ef_matpickHint"); if(h) h.textContent= list.length? "" : "아직 등록된 자재가 없습니다. 자재 탭에서 먼저 등록하면 여기서 불러올 수 있어요.";
}
function pickMaterial(){
  const id=val("ef_matpick");
  window._efMatId = id || null;
  const h=document.getElementById("ef_matpickHint");
  if(!id){ if(h) h.textContent=""; return; }
  const m=materials.find(x=>x.id===id); if(!m){ if(h) h.textContent=""; return; }
  // 규격·단가 자동 채움 (단가는 '최근 단가' 참고값 — 바뀌었으면 그대로 고치면 됨)
  if(m.spec){ const s=document.getElementById("ef_spec"); if(s) s.value=m.spec; }
  const price=(m.unitPriceKRW!=null?m.unitPriceKRW:m.unitPrice);
  if(price!=null){ const u=document.getElementById("ef_unitprice"); if(u) u.value=price; }
  // 제목이 비어있으면 자재명으로 채움
  const t=document.getElementById("ef_title"); if(t && !t.value.trim()) t.value=m.name||"";
  calcMatAmount();
  if(h) h.innerHTML=`✅ <b>${esc(m.name)}</b> 불러옴 · 단가는 <b>최근 산 가격</b>이에요. 이번에 값이 다르면 단가만 고치세요 (재고에 자동 반영).` + (m.stock!=null?` · 현재 재고 ${m.stock}${m.unit||''}`:'');
}

const QUICK_KINDS=[["식비","🍚"],["주유·가스","⛽"],["톨비(통행료)","🛣"],["주차비","🅿"],["택배비","📦"],["자재비","🧱"],["공사비","🔨"],["부동산 매수비용","🏠"],["부동산 매도비용","💵"],["사진","📷"]];
function renderQuickKinds(){
  const box=document.getElementById("ef_quickKinds"); if(!box) return;
  const cur=val("ef_kind");
  const shortLabel=(k)=>{ if(k==="톨비(통행료)")return"톨비"; if(k==="부동산 매수비용")return"매수비용"; if(k==="부동산 매도비용")return"매도비용"; return k; };
  box.innerHTML=QUICK_KINDS.map(([k,ic])=>`<button type="button" class="qk-chip ${k===cur?'on':''}" onclick="pickKind('${jsstr(k)}')">${ic} ${esc(shortLabel(k))}</button>`).join("");
}
function pickKind(k){
  const sel=document.getElementById("ef_kind");
  if(!sel) return;
  // 종류 목록에 없으면(혹시) 추가
  if(![...sel.options].some(o=>o.value===k)){ sel.innerHTML+=`<option>${esc(k)}</option>`; }
  sel.value=k;
  onKindChange();
}
/* ===== 커스텀 입력칸 (종류별, realestate_options: customfields_<종류>) ===== */
function customFieldKey(){ return "customfields_"+(val("ef_kind")||""); }
function customFieldNames(){ return userOpts[customFieldKey()]||[]; }
let _efCustomValues={}; // 현재 모달의 커스텀 값 임시 보관(수정 시 채움)
function renderCustomFields(){
  const wrap=document.getElementById("ef_customWrap"); if(!wrap) return;
  const names=customFieldNames();
  wrap.innerHTML=names.map((nm,i)=>`
    <div class="field">
      <label>${esc(nm)} <a href="#" class="field-cfg" style="background:#f6e2de;color:var(--danger)" onclick="removeCustomField('${jsstr(nm)}');return false;">✕ 칸 삭제</a></label>
      <input type="text" class="ef-custom" data-name="${esc(nm)}" value="${esc(_efCustomValues[nm]||'')}" placeholder="${esc(nm)} 입력">
    </div>`).join("");
}
function readCustomFields(){
  const out={};
  document.querySelectorAll('#ef_customWrap .ef-custom').forEach(inp=>{
    const nm=inp.getAttribute('data-name'); const v=inp.value.trim();
    if(v) out[nm]=v;
  });
  return out;
}
async function addCustomField(){
  const k=val("ef_kind"); if(!k){ alert("먼저 종류를 선택하세요."); return; }
  const nm=prompt('"'+k+'" 종류에 추가할 입력칸 이름을 적으세요.\n예: 현장 담당자, 차량번호, 보증기간');
  if(nm===null) return;
  const name=nm.trim(); if(!name){ alert("이름을 입력하세요."); return; }
  const key=customFieldKey();
  if(!userOpts[key]) userOpts[key]=[];
  if(userOpts[key].includes(name)){ alert("이미 있는 칸입니다."); return; }
  // 현재 입력값 보존
  _efCustomValues=Object.assign({}, _efCustomValues, readCustomFields());
  userOpts[key].push(name);
  await saveUserOpts(key);
  renderCustomFields();
}
async function removeCustomField(name){
  const k=val("ef_kind");
  if(!confirm('"'+name+'" 입력칸을 삭제할까요?\n("'+k+'" 종류에서 사라집니다. 이미 저장된 기록의 값은 유지됩니다.)')) return;
  const key=customFieldKey();
  _efCustomValues=Object.assign({}, _efCustomValues, readCustomFields());
  delete _efCustomValues[name];
  userOpts[key]=(userOpts[key]||[]).filter(x=>x!==name);
  await saveUserOpts(key);
  renderCustomFields();
}
function fillStageSelect(preset){
  buildOptSelect("ef_stage","stages",preset||"","(공정 선택 안 함)");
}
function efMapHint(){
  const addr=(val("ef_addr")||"").trim();
  const a=document.getElementById("ef_mapBtn");
  if(a){ if(addr){ a.style.display="inline-block"; a.href=naverMapUrl(addr); } else { a.style.display="none"; } }
}
function fillCatSelect(){
  const k=val("ef_kind");
  const stage=val("ef_stage");
  const sel=document.getElementById("ef_cat");
  if(!sel) return;
  const g_cat=document.getElementById("g_cat");
  // 자재비: 공정을 먼저 골라야 그 공정의 자재가 뜸
  if(k==="자재비" && !stage){
    if(g_cat) g_cat.style.display="block";
    sel.innerHTML='<option value="">↑ 공정 단계를 먼저 선택하세요</option>';
    return;
  }
  // 통일 체계: 종류별 세부항목 (subCatsFor로 일원화)
  let list;
  if(k==="기타비용"){
    list=opts("etc_cats");
  } else {
    list=subCatsFor(k, stage);
  }
  if(g_cat){ const f=kindFields(k); g_cat.style.display = (f.includes("cat")&&list.length)?"block":"none"; }
  const cur=sel.value;
  sel.innerHTML=list.map(o=>`<option ${o===cur?'selected':''}>${esc(o)}</option>`).join("");
}
/* 종류별 칸 설정 모달 */
let _kindCfgKind=null;
function openKindConfig(){
  const k=val("ef_kind"); if(!k){ alert("먼저 종류를 선택하세요."); return; }
  _kindCfgKind=k;
  const cur=kindFields(k);
  document.getElementById("kindCfgTitle").textContent='"'+k+'" 종류에 표시할 칸';
  document.getElementById("kindCfgList").innerHTML = ALL_FIELDS.map(f=>
    `<label class="kindcfg-row"><input type="checkbox" value="${f}" ${cur.includes(f)?'checked':''}> ${esc(FIELD_LABELS[f])}</label>`
  ).join("");
  openModal("kindConfigModal");
}
async function saveKindConfig(){
  if(!_kindCfgKind) return;
  const checked=[...document.querySelectorAll('#kindCfgList input:checked')].map(c=>c.value);
  userOpts["kindcfg_"+_kindCfgKind]=checked;
  await saveUserOpts("kindcfg_"+_kindCfgKind);
  closeModal("kindConfigModal");
  onKindChange(); // 즉시 반영
}
function resetKindConfig(){
  if(!_kindCfgKind) return;
  const def=defaultKindFields(_kindCfgKind);
  document.querySelectorAll('#kindCfgList input').forEach(c=>{ c.checked=def.includes(c.value); });
}
function openEntryModal(presetStage,presetKind){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  document.getElementById("ef_date").value=today();
  ["ef_title","ef_vendor","ef_amount","ef_memo"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("ef_files").value="";
  document.getElementById("ef_currency").value="KRW";
  document.getElementById("ef_fxhint").textContent="";
  buildOptSelect("ef_kind","kinds",presetKind||"자재비");
  document.getElementById("ef_kind").onchange=onKindChange;
  buildOptSelect("ef_photofolder","photo_folders","");
  buildOptSelect("ef_docfolder","doc_folders","");
  buildOptSelect("ef_pay","pays","");
  document.getElementById("vendorList").innerHTML=vendors.map(v=>`<option value="${esc(v.name)}">`).join("");
  fillStageSelect(presetStage||"");
  document.getElementById("ef_stage").onchange=fillCatSelect;
  const ph=document.getElementById("ef_phone"); if(ph) ph.value="";
  const ad=document.getElementById("ef_addr"); if(ad) ad.value="";
  ["ef_spec","ef_unitprice","ef_qty","ef_shipping"].forEach(id=>{const el=document.getElementById(id); if(el) el.value="";});
  // 링크·드롭 초기화
  const lk=document.getElementById("ef_link"); if(lk) lk.value="";
  const lkb=document.getElementById("ef_linkBtn"); if(lkb) lkb.style.display="none";
  const dp=document.getElementById("ef_dropPreview"); if(dp) dp.innerHTML="";
  window._efDropFiles=[];
  window._efManualPhone=false;
  window._efMatId=null;
  const _mp=document.getElementById("ef_matpick"); if(_mp) _mp.value="";
  const _mph=document.getElementById("ef_matpickHint"); if(_mph) _mph.textContent="";
  _efMeals=[]; _efMealSeq=1;
  _efWorkers=[]; _efWorkerSeq=1;
  ["ef_mealName","ef_mealPrice","ef_dist","ef_workerName","ef_workerPay"].forEach(id=>{const el=document.getElementById(id); if(el) el.value="";});
  const mealList=document.getElementById("ef_mealList"); if(mealList) mealList.innerHTML="";
  const mealSum=document.getElementById("ef_mealSum"); if(mealSum) mealSum.textContent="";
  const wkList=document.getElementById("ef_workerList"); if(wkList) wkList.innerHTML="";
  const wkSum=document.getElementById("ef_workerSum"); if(wkSum) wkSum.textContent="";
  const vatDef=document.querySelector('input[name="ef_vat"][value="포함"]'); if(vatDef) vatDef.checked=true;
  const vh=document.getElementById("ef_vatHint"); if(vh) vh.textContent="";
  efMapHint();
  _efCustomValues={};
  onKindChange();
  document.getElementById("entryModalTitle").textContent = presetStage? presetStage+" 기록 추가" : "기록 추가";
  openModal("entryModal");
}
function blobFromCanvas(c,q){ return new Promise(res=>c.toBlob(res,"image/jpeg",q)); }
async function prepareUpload(f){
  const isImg=(f.type||"").startsWith("image/");
  if(!isImg) return {blob:f, name:f.name, type:f.type||"application/octet-stream"};
  if(f.size<=4*1024*1024) return {blob:f, name:f.name, type:f.type||"image/jpeg"};
  return await new Promise((resolve)=>{
    const img=new Image(); const url=URL.createObjectURL(f);
    img.onload=async function(){
      URL.revokeObjectURL(url);
      const maxW=3200; let w=img.width, h=img.height;
      if(w>maxW){ h=Math.round(h*maxW/w); w=maxW; }
      const c=document.createElement("canvas"); c.width=w; c.height=h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      const blob=await blobFromCanvas(c,0.95);
      const base=(f.name||"photo").replace(/\.[^.]+$/,"");
      resolve({blob:blob||f, name:base+".jpg", type:"image/jpeg"});
    };
    img.onerror=function(){ URL.revokeObjectURL(url); resolve({blob:f, name:f.name, type:f.type}); };
    img.src=url;
  });
}
async function processFile(f){
  const prepared=await prepareUpload(f);
  const safe=(prepared.name||"file").replace(/[^\w.\-가-힣]/g,"_");
  const path=`realestate/${currentProjectId}/${Date.now()}_${Math.random().toString(36).slice(2,7)}_${safe}`;
  const ref=storage.ref(path);
  await ref.put(prepared.blob, {contentType:prepared.type});
  const url=await ref.getDownloadURL();
  return {name:prepared.name, url, type:prepared.type, path};
}
async function saveEntry(){
  const title=val("ef_title").trim(); if(!title){alert("제목을 입력하세요.");return;}
  const k=val("ef_kind");
  const f=kindFields(k);
  const isMoney=f.includes("amount");
  const cur=val("ef_currency")||"KRW";
  const amtOrig= isMoney&&val("ef_amount")?Number(val("ef_amount")):null;
  let amtKRW=amtOrig;
  if(isMoney && cur==="USD" && amtOrig!=null){
    if(!_fxRate){ alert("USD 금액인데 환율이 없습니다. 상단 배지에서 환율을 입력하세요."); return; }
    amtKRW=Math.round(amtOrig*_fxRate);
  }
  const btn=document.getElementById("entrySaveBtn"); btn.disabled=true; btn.textContent="저장 중...";
 try{
  let files=[];
  // 기본 파일선택 + 드롭/붙여넣기 파일 합산
  const fi=document.getElementById("ef_files");
  const allEfFiles=[...Array.from(fi.files||[]),...(window._efDropFiles||[])];
  if(allEfFiles.length){
    for(let i=0;i<allEfFiles.length;i++){ showUploading("파일 올리는 중… ("+(i+1)+"/"+allEfFiles.length+")"); files.push(await processFile(allEfFiles[i])); }
    hideUploading();
  }
  // 통일 분류 표준화: 자재비/공사비/사진/연락/서류/문제/메모를 제외한 비용 종류는
  // kind=기타비용 + cat=종류(통계호환) + sub=세부 로 저장
  const photoFolder = f.includes("photofolder") ? val("ef_photofolder") : null;
  const docFolder = f.includes("docfolder") ? val("ef_docfolder") : null;
  const customData=readCustomFields();
  const selCat = f.includes("cat") ? val("ef_cat") : null;
  let kindToSave=k, catToSave=selCat, subToSave=null, stageToSave=(f.includes("stage")&&val("ef_stage"))?val("ef_stage"):null;
  const NON_ETC = ["자재비","공사비","사진","연락","서류","문제","메모","기타비용"];
  const ETC_AS_KIND = COST_KINDS.filter(x=>!NON_ETC.includes(x));
  if(ETC_AS_KIND.includes(k)){
    kindToSave="기타비용"; catToSave=statCatOf(k); subToSave=selCat; stageToSave=null;
  }
  await db.collection(ENTRIES).add({
    projectId:currentProjectId, kind:kindToSave, title, date:val("ef_date"),
    stage:stageToSave,
    cat: catToSave,
    sub: subToSave,
    photoFolder, docFolder,
    vendor: f.includes("vendor")?val("ef_vendor").trim():"",
    amount: isMoney? (amtKRW||null) : null,
    amountOrig: (isMoney&&cur==="USD")?amtOrig:null,
    currency: isMoney?cur:null,
    fxRate: (isMoney&&cur==="USD")?_fxRate:null,
    pay: f.includes("pay")?val("ef_pay"):null,
    spec: (k==="자재비"||k==="공사비")?(val("ef_spec")||"").trim()||null:null,
    unitPrice: (k==="자재비"||k==="공사비")&&val("ef_unitprice")?Number(val("ef_unitprice")):null,
    qty: (k==="자재비"||k==="공사비")&&val("ef_qty")?Number(val("ef_qty")):null,
    shipping: (k==="자재비"&&val("ef_shipping"))?Number(val("ef_shipping")):null,
    vat: (k==="자재비"||k==="공사비")?((document.querySelector('input[name="ef_vat"]:checked')||{}).value||null):null,
    menus: (k==="식비"&&_efMeals.length)?_efMeals.map(m=>({name:m.name,price:m.price})):null,
    menu: (k==="식비"&&_efMeals.length)?_efMeals.map(m=>m.name).join(", "):null,
    workers: (k==="공사비"&&_efWorkers.length)?_efWorkers.map(w=>({name:w.name,pay:w.pay})):null,
    dist: (k==="주유·가스"&&val("ef_dist"))?Number(val("ef_dist")):null,
    phone: val("ef_phone")?val("ef_phone").trim():null,
    addr: val("ef_addr")?val("ef_addr").trim():null,
    link: val("ef_link")?val("ef_link").trim():null,
    custom: Object.keys(customData).length?customData:null,
    memo:val("ef_memo").trim(), files,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
  if(f.includes("photofolder") && files.some(f2=>(f2.type||"").startsWith("image/"))){ activeTab="사진"; window._photoOpenId=photoFolder; }
  else if(f.includes("docfolder") && files.length){ activeTab="서류"; window._docOpenId=docFolder; }
  // 자재비 + 재고에서 불러온 경우: 재고 수량 +, 최근 단가 갱신
  if(k==="자재비" && window._efMatId){
    try{
      const m=materials.find(x=>x.id===window._efMatId);
      const buyQty=Number(val("ef_qty"))||0;
      const buyUnit=Number(val("ef_unitprice"))||null;
      if(m){
        const upd={};
        if(buyQty){ upd.stock=(Number(m.stock)||0)+buyQty; }        // 사면 재고 증가
        if(buyUnit){ upd.unitPrice=buyUnit; upd.unitPriceKRW=buyUnit; upd.currency="KRW"; } // 최근 단가 갱신
        // 입고 기록 남기기
        const log=(m.useLog||[]).slice();
        log.push({type:"in", qty:buyQty||null, unitPrice:buyUnit||null, date:val("ef_date")||today(), memo:"자재비 기록에서 입고"});
        upd.useLog=log;
        if(Object.keys(upd).length) await db.collection(MATERIALS).doc(m.id).update(upd);
      }
    }catch(_){}
    window._efMatId=null;
  }
  btn.disabled=false; btn.textContent="저장";
  closeModal("entryModal"); await reloadCurrent();
 }catch(err){ btn.disabled=false; btn.textContent="저장"; hideUploading(); showError("기록 저장", err); }
}
async function deleteEntry(id){
  const e=entries.find(x=>x.id===id);
  if(!confirm('이 기록을 삭제할까요?\n\n"'+((e&&e.title)||'')+'"\n\n되돌릴 수 없습니다.'))return;
  try{
    if(e&&e.files) for(const f of e.files){ if(f.path){ try{ await storage.ref(f.path).delete(); }catch(_){} } }
    await db.collection(ENTRIES).doc(id).delete(); await reloadCurrent();
  }catch(err){ showError("기록 삭제", err); }
}
function togglePhotoSel(entryId, fileIdx){
  if(!window._photoSel) window._photoSel={};
  window._photoSel[entryId+'_'+fileIdx]=!window._photoSel[entryId+'_'+fileIdx];
  renderTab(projects.find(x=>x.id===currentProjectId));
}
async function deleteSelectedPhotos(){
  const sel=window._photoSel||{};
  const keys=Object.keys(sel).filter(k=>sel[k]);
  if(!keys.length){ alert("선택된 사진이 없습니다."); return; }
  if(!confirm(keys.length+"장의 사진을 삭제할까요?"))return;
  try{
    showUploading("삭제 중…");
    const byEntry={};
    keys.forEach(k=>{ const idx=k.lastIndexOf('_'); const eid=k.slice(0,idx); const fi=Number(k.slice(idx+1)); (byEntry[eid]=byEntry[eid]||[]).push(fi); });
    for(const eid of Object.keys(byEntry)){
      const e=entries.find(x=>x.id===eid); if(!e||!e.files) continue;
      const removeSet=new Set(byEntry[eid]);
      for(const fi of byEntry[eid]){ const f=e.files[fi]; if(f&&f.path){ try{ await storage.ref(f.path).delete(); }catch(_){} } }
      await db.collection(ENTRIES).doc(eid).update({files:e.files.filter((_,i)=>!removeSet.has(i))});
    }
    window._photoSel={}; window._photoSelMode=false; hideUploading(); await reloadCurrent();
  }catch(err){ hideUploading(); showError("사진 일괄 삭제", err); }
}
async function deletePhoto(entryId, fileIdx){
  const e=entries.find(x=>x.id===entryId); if(!e||!e.files) return;
  const f=e.files[fileIdx]; if(!f) return;
  if(!confirm('이 파일을 삭제할까요?\n\n'+(f.name||'')))return;
  try{
    if(f.path){ try{ await storage.ref(f.path).delete(); }catch(_){} }
    await db.collection(ENTRIES).doc(entryId).update({files:e.files.filter((_,i)=>i!==fileIdx)});
    await reloadCurrent();
  }catch(err){ showError("파일 삭제", err); }
}
function addFilesToFolder(entryId){
  const inp=document.getElementById("addToFolderInput"); inp.value="";
  inp.onchange=async function(){
    if(!inp.files.length) return;
    const e=entries.find(x=>x.id===entryId); if(!e) return;
    try{
      showUploading("파일 올리는 중…");
      const added=[];
      for(let i=0;i<inp.files.length;i++){ showUploading("파일 올리는 중… ("+(i+1)+"/"+inp.files.length+")"); added.push(await processFile(inp.files[i])); }
      await db.collection(ENTRIES).doc(entryId).update({files:(e.files||[]).concat(added)});
      hideUploading(); await reloadCurrent();
    }catch(err){ hideUploading(); showError("파일 추가", err); }
  };
  inp.click();
}
async function editEntryMeta(entryId){
  const e=entries.find(x=>x.id===entryId); if(!e) return;
  const t=prompt("제목을 입력하세요.", e.title||""); if(t===null) return;
  if(!t.trim()){ alert("제목은 비울 수 없습니다."); return; }
  const memo=prompt("메모를 입력하세요. (선택)", e.memo||""); if(memo===null) return;
  try{ await db.collection(ENTRIES).doc(entryId).update({title:t.trim(), memo:memo.trim()}); await reloadCurrent(); }
  catch(err){ showError("제목·메모 수정", err); }
}

/* ===== 비용 수정 ===== */
/* 저장된 기록의 '표시용 종류'를 구함.
   - 자재비/공사비: 그대로
   - 기타비용으로 저장됐지만 cat이 식비/톨비 등 표준 종류면: 그 cat을 종류로 승격
   - 주말 저장분의 cat="교통/주유비"는 "주유·가스"로 역매핑 */
function displayKindOf(e){
  if(e.kind==="자재비"||e.kind==="공사비") return e.kind;
  if(e.kind==="기타비용"){
    if(e.cat==="교통/주유비") return "주유·가스";
    if(e.cat && COST_KINDS.includes(e.cat)) return e.cat;
    return "기타비용";
  }
  return e.kind || "기타비용";
}
/* 표시 종류 기준의 현재 세부값 */
function displaySubOf(e, dispKind){
  if(dispKind==="자재비"||dispKind==="공사비") return e.cat||"";
  // 식비/톨비/주유 등: sub에 저장돼 있음
  return e.sub||"";
}
function ceFillCat(){
  const k=document.getElementById("ce_kind").value;
  const stage=document.getElementById("ce_stage").value;
  const sel=document.getElementById("ce_cat");
  const list=subCatsFor(k, stage);
  const cur=sel.value;
  const g_cat=document.getElementById("ce_g_cat");
  if(g_cat) g_cat.style.display = list.length? "block":"none";
  sel.innerHTML=list.map(o=>`<option ${o===cur?'selected':''}>${esc(o)}</option>`).join("");
}
function ceKindChange(){
  const k=document.getElementById("ce_kind").value;
  document.getElementById("ce_g_stage").style.display = (k==="자재비"||k==="공사비")?"block":"none";
  ceFillCat();
}
function editCost(id){
  const e=entries.find(x=>x.id===id); if(!e) return;
  const dispKind=displayKindOf(e);
  const dispSub=displaySubOf(e, dispKind);
  document.getElementById("ce_id").value=id;
  document.getElementById("ce_title").value=e.title||"";
  document.getElementById("ce_date").value=e.date||"";
  document.getElementById("ce_amount").value=e.amount!=null?e.amount:"";
  // 종류 셀렉트: 통일 목록(COST_KINDS) + 현재 표시종류가 목록에 없으면 추가
  const kinds = COST_KINDS.includes(dispKind)? COST_KINDS.slice() : COST_KINDS.concat([dispKind]);
  document.getElementById("ce_kind").innerHTML = kinds.map(k=>`<option ${k===dispKind?'selected':''}>${esc(k)}</option>`).join("");
  document.getElementById("ce_stage").innerHTML='<option value="">(미지정)</option>'+opts("stages").map(s=>`<option ${e.stage===s?'selected':''}>${esc(s)}</option>`).join("");
  document.getElementById("ce_vendor").value=e.vendor||"";
  document.getElementById("vendorList").innerHTML=vendors.map(v=>`<option value="${esc(v.name)}">`).join("");
  document.getElementById("ce_pay").innerHTML=opts("pays").map(p=>`<option ${e.pay===p?'selected':''}>${esc(p)}</option>`).join("");
  document.getElementById("ce_phone").value=e.phone||"";
  document.getElementById("ce_addr").value=e.addr||"";
  document.getElementById("ce_memo").value=e.memo||"";
  ceKindChange();
  // 세부값 선택 (목록에 없으면 추가)
  if(dispSub){ const sel=document.getElementById("ce_cat"); if(![...sel.options].some(o=>o.value===dispSub)){ sel.innerHTML+=`<option>${esc(dispSub)}</option>`; } sel.value=dispSub; }
  ceMapHint();
  // 🔗 scan-app 첨부 항목 로드
  _ceScanRefs = [];
  renderCeScanAttached();
  if(e.scanRefs && e.scanRefs.length){
    (async ()=>{
      for(const ref of e.scanRefs){
        const data = await fetchScanItem(ref.type, ref.id);
        if(data) _ceScanRefs.push({ type:ref.type, id:ref.id, data });
      }
      renderCeScanAttached();
    })();
  }
  openModal("costEditModal");
}
// 비용 추가 모드 진입점 (기존 함수가 있다면 이걸로 reset 호출)
function resetCostEditScanRefs(){
  _ceScanRefs = [];
  renderCeScanAttached();
}
function ceMapHint(){
  const addr=document.getElementById("ce_addr").value.trim();
  const a=document.getElementById("ce_mapBtn");
  if(a){ if(addr){ a.style.display="inline-block"; a.href=naverMapUrl(addr); } else { a.style.display="none"; } }
}
/* ════════════════════════════════════════════════════════
   🔗 scan-app 통합 (영수증·명함 데이터 허브)
   ════════════════════════════════════════════════════════ */
const SCAN_APP_URL = 'https://20251014peru-gif.github.io/scan-app.html';
const SCAN_USER_ID = '달님';  // scan-app의 user ID와 동일하게

let _ceScanRefs = [];   // 비용 모달 현재 첨부 항목 [{type, id, data}]
let _vfScanRefs = [];   // VENDOR 모달 현재 명함 [{type, id, data}]
let _scanPickerCtx = null; // 현재 picker 컨텍스트

// scan-app에서 영수증/명함 단건 조회 (Firestore 직접 읽기)
async function fetchScanItem(type, id){
  try{
    const coll = type + 's';
    const doc = await db.collection('scanapp').doc(SCAN_USER_ID).collection(coll).doc(id).get();
    if(doc.exists){
      const data = doc.data();
      if(data.deletedAt) return null;
      return data;
    }
  }catch(e){console.error('[scan fetch]',e);}
  return null;
}

// picker iframe 열기
function openScanPicker(type, linkedTo, onSelect){
  _scanPickerCtx = { type, onSelect };
  const url = `${SCAN_APP_URL}?mode=picker&type=${type}&linkedTo=${encodeURIComponent(linkedTo||'')}`;
  document.getElementById('scanPickerFrame').src = url;
  document.getElementById('scanPickerModal').classList.add('open');
}
function closeScanPicker(){
  document.getElementById('scanPickerModal').classList.remove('open');
  document.getElementById('scanPickerFrame').src = 'about:blank';
  _scanPickerCtx = null;
}

// scan-app에서 보내는 메시지 받기
window.addEventListener('message', (e) => {
  if(!e.data || e.data.source !== 'scan-app') return;
  const { action, payload } = e.data;
  if(action === 'selected' && _scanPickerCtx){
    _scanPickerCtx.onSelect(payload.type, payload.id, payload.data);
    closeScanPicker();
  }
});

// 비용 모달 - 영수증/명함 선택 버튼
function openScanPickerForCost(type){
  const id = document.getElementById('ce_id').value;
  const linkedTo = `realestate:entry_${id||'new'}`;
  openScanPicker(type, linkedTo, (selType, selId, data) => {
    if(!data) return;
    // 중복 방지
    if(_ceScanRefs.some(r => r.type===selType && r.id===selId)){
      alert('이미 첨부됐어요'); return;
    }
    _ceScanRefs.push({ type:selType, id:selId, data });
    // 빈 칸만 자동 채움
    autofillCostFields(selType, data);
    renderCeScanAttached();
  });
}

// 영수증/명함 → 비용 필드 자동 채움 (빈 칸만)
function autofillCostFields(type, data){
  const setIfEmpty = (id, val) => {
    const el = document.getElementById(id);
    if(el && !el.value.trim() && val) el.value = val;
  };
  if(type === 'receipt'){
    setIfEmpty('ce_title', data.place || '');
    setIfEmpty('ce_date', data.date || '');
    setIfEmpty('ce_amount', data.amount || '');
    setIfEmpty('ce_vendor', data.place || '');
    setIfEmpty('ce_phone', data.phone || '');
    setIfEmpty('ce_addr', data.addr || '');
    // 메모에 품목 추가
    const memoEl = document.getElementById('ce_memo');
    if(memoEl && data.items && data.items.length){
      const itemTxt = data.items.map(it => `${it.name||''}${it.qty>1?' x'+it.qty:''}`).filter(Boolean).join(', ');
      if(itemTxt && !memoEl.value.includes(itemTxt)){
        memoEl.value = (memoEl.value ? memoEl.value + '\n' : '') + '🛒 ' + itemTxt;
      }
    }
  }else if(type === 'card'){
    setIfEmpty('ce_vendor', data.company || data.name || '');
    setIfEmpty('ce_phone', data.mobile || data.phone || '');
    setIfEmpty('ce_addr', data.addr || '');
  }
  ceMapHint();
}

// 비용 모달 - 첨부된 영수증/명함 카드 렌더
function renderCeScanAttached(){
  const wrap = document.getElementById('ce_scanAttached');
  if(!wrap) return;
  if(!_ceScanRefs.length){
    wrap.innerHTML = '<div style="font-size:11px;color:var(--ink-faint);padding:6px 4px">아직 첨부된 항목 없음</div>';
    return;
  }
  wrap.innerHTML = _ceScanRefs.map((r, idx) => {
    const d = r.data || {};
    const icon = r.type==='receipt' ? '🧾' : '💼';
    const title = r.type==='receipt' ? (d.place||'영수증') : (d.name||'명함');
    const sub = r.type==='receipt' 
      ? `${d.date||''} · ${d.amount?d.amount.toLocaleString()+'원':''}` 
      : `${d.company||''}${d.mobile?' · '+d.mobile:''}`;
    const photoUrl = d.photoUrl||'';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#fff;border:1.5px solid var(--blue-bd);border-radius:8px">
      ${photoUrl?`<img src="${photoUrl}" style="width:42px;height:42px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="openViewer('${photoUrl}','${esc(title)}')">`:'<div style="width:42px;height:42px;background:var(--blue-lt);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px">'+icon+'</div>'}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${icon} ${esc(title)}</div>
        <div style="font-size:11px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="removeCeScanRef(${idx})" style="padding:4px 8px">×</button>
    </div>`;
  }).join('');
}
function removeCeScanRef(idx){
  _ceScanRefs.splice(idx, 1);
  renderCeScanAttached();
}

// VENDOR 모달 - 명함 선택
function openScanPickerForVendor(){
  const linkedTo = `realestate:vendor_${editingVendorId||'new'}`;
  openScanPicker('card', linkedTo, (selType, selId, data) => {
    if(!data) return;
    if(_vfScanRefs.some(r => r.id===selId)){
      alert('이미 연결됐어요'); return;
    }
    _vfScanRefs.push({ type:'card', id:selId, data });
    // 빈 칸만 자동 채움
    const setIfEmpty = (id, val) => {
      const el = document.getElementById(id);
      if(el && !el.value.trim() && val) el.value = val;
    };
    setIfEmpty('vf_name', data.company || data.name || '');
    setIfEmpty('vf_phone', data.mobile || data.phone || '');
    // 메모 자동 추가
    const memoEl = document.getElementById('vf_memo');
    if(memoEl){
      const lines = [];
      if(data.name && data.company && data.name!==data.company) lines.push(`담당: ${data.name}`);
      if(data.position) lines.push(`직책: ${data.position}`);
      if(data.email) lines.push(`이메일: ${data.email}`);
      if(data.fax) lines.push(`팩스: ${data.fax}`);
      const newTxt = lines.join(' / ');
      if(newTxt && !memoEl.value.includes(newTxt)){
        memoEl.value = (memoEl.value ? memoEl.value + '\n' : '') + newTxt;
      }
    }
    renderVfScanAttached();
  });
}

function renderVfScanAttached(){
  const wrap = document.getElementById('vf_scanAttached');
  if(!wrap) return;
  if(!_vfScanRefs.length){
    wrap.innerHTML = '<div style="font-size:11px;color:var(--ink-faint);padding:6px 4px">scan-app 명함과 연결되지 않음</div>';
    return;
  }
  wrap.innerHTML = _vfScanRefs.map((r, idx) => {
    const d = r.data || {};
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#fff;border:1.5px solid var(--blue-bd);border-radius:8px">
      ${d.photoUrl?`<img src="${d.photoUrl}" style="width:42px;height:42px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="openViewer('${d.photoUrl}','${esc(d.name||'')}')">`:'<div style="width:42px;height:42px;background:var(--blue-lt);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px">💼</div>'}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">💼 ${esc(d.name||'명함')} <span style="font-weight:500;color:var(--ink-soft);font-size:11px">${esc(d.position||'')}</span></div>
        <div style="font-size:11px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.company||'')}${d.mobile?' · '+esc(d.mobile):''}${d.fax?' · 📠'+esc(d.fax):''}</div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="removeVfScanRef(${idx})" style="padding:4px 8px">×</button>
    </div>`;
  }).join('');
}
function removeVfScanRef(idx){
  _vfScanRefs.splice(idx, 1);
  renderVfScanAttached();
}

// scan-app 영수증/명함에 양방향 링크 추가
async function linkScanItemBack(type, id, linkedTo){
  try{
    const coll = type + 's';
    const docRef = db.collection('scanapp').doc(SCAN_USER_ID).collection(coll).doc(id);
    const doc = await docRef.get();
    if(doc.exists){
      const data = doc.data();
      const linkedArr = data.linkedTo || [];
      if(!linkedArr.includes(linkedTo)){
        linkedArr.push(linkedTo);
        await docRef.update({ linkedTo: linkedArr, updated: Date.now() });
      }
    }
  }catch(e){console.warn('[link back]',e);}
}

async function saveCostEdit(){
  const id=document.getElementById("ce_id").value;
  const title=document.getElementById("ce_title").value.trim();
  if(!title){ alert("항목명을 입력하세요."); return; }
  const dispKind=document.getElementById("ce_kind").value;
  const sub=document.getElementById("ce_cat").value||null;
  const isStageKind=(dispKind==="자재비"||dispKind==="공사비");
  // 저장 형태 표준화: 자재비/공사비는 그대로, 그 외는 kind=기타비용 + cat=종류(통계호환) + sub=세부
  let kindToSave, catToSave, subToSave, stageToSave;
  if(isStageKind){
    kindToSave=dispKind; catToSave=sub; subToSave=null;
    stageToSave=document.getElementById("ce_stage").value||null;
  } else {
    kindToSave="기타비용";
    catToSave=statCatOf(dispKind); // 식비→식비, 주유·가스→교통/주유비
    subToSave=sub; stageToSave=null;
  }
  const upd={
    title, date:document.getElementById("ce_date").value||today(),
    kind:kindToSave, amount:Number(document.getElementById("ce_amount").value)||null,
    stage:stageToSave, cat:catToSave, sub:subToSave,
    vendor:document.getElementById("ce_vendor").value.trim(),
    pay:document.getElementById("ce_pay").value,
    phone:document.getElementById("ce_phone").value.trim()||null,
    addr:document.getElementById("ce_addr").value.trim()||null,
    memo:document.getElementById("ce_memo").value.trim(),
    // 🔗 scan-app 참조
    scanRefs: _ceScanRefs.map(r => ({type:r.type, id:r.id}))
  };
  try{
    await db.collection(ENTRIES).doc(id).update(upd);
    // scan-app 영수증/명함에 양방향 링크 자동 추가
    const linkedTo = `realestate:entry_${id}`;
    for(const r of _ceScanRefs){
      await linkScanItemBack(r.type, r.id, linkedTo).catch(()=>{});
    }
    closeModal("costEditModal"); await reloadCurrent();
  }
  catch(err){ showError("비용 수정", err); }
}

/* ===== 이미지 뷰어 ===== */
let ivScale=1, ivX=0, ivY=0, ivDragging=false, ivStartX=0, ivStartY=0, ivPinchDist=0, ivIndex=0;
window._ivList = window._ivList || [];
function ivApply(){ const img=document.getElementById("ivImg"); img.style.transform=`translate(${ivX}px,${ivY}px) scale(${ivScale})`; }
function ivReset(){ ivScale=1; ivX=0; ivY=0; ivApply(); }
function ivZoom(d){ ivScale=Math.min(6,Math.max(0.5,ivScale+d)); ivApply(); }
function ivShow(){
  const list=window._ivList||[]; const cur=list[ivIndex]; if(!cur) return;
  ivReset();
  document.getElementById("ivImg").src=cur.url;
  document.getElementById("ivCap").textContent=cur.cap||"";
  const multi=list.length>1;
  document.getElementById("ivPrev").style.display=multi?"block":"none";
  document.getElementById("ivNext").style.display=multi?"block":"none";
  document.getElementById("ivCount").textContent=multi?((ivIndex+1)+" / "+list.length):"";
  document.getElementById("ivDel").style.display=(cur.entryId!=null)?"inline-block":"none";
}
async function ivDelete(){
  const list=window._ivList||[]; const cur=list[ivIndex]; if(!cur||cur.entryId==null) return;
  await deletePhoto(cur.entryId, cur.fileIdx); closeViewer();
}
function ivStep(d){ const list=window._ivList||[]; if(list.length<2) return; ivIndex=(ivIndex+d+list.length)%list.length; ivShow(); }
function openViewerList(idx){ ivIndex=idx||0; document.getElementById("imgViewer").classList.add("open"); ivShow(); }
function openViewer(url, cap){ window._ivList=[{url, cap:cap||""}]; ivIndex=0; document.getElementById("imgViewer").classList.add("open"); ivShow(); }
function closeViewer(){ document.getElementById("imgViewer").classList.remove("open"); document.getElementById("ivImg").src=""; }
(function initViewer(){
  const v=document.getElementById("imgViewer"); const img=document.getElementById("ivImg");
  document.getElementById("ivClose").onclick=closeViewer;
  v.addEventListener("click",e=>{ if(e.target.id==="imgViewer") closeViewer(); });
  img.addEventListener("mousedown",e=>{ e.preventDefault(); ivDragging=true; ivStartX=e.clientX-ivX; ivStartY=e.clientY-ivY; img.classList.add("grabbing"); });
  window.addEventListener("mousemove",e=>{ if(!ivDragging) return; ivX=e.clientX-ivStartX; ivY=e.clientY-ivStartY; ivApply(); });
  window.addEventListener("mouseup",()=>{ ivDragging=false; img.classList.remove("grabbing"); });
  img.addEventListener("dblclick",()=>{ ivScale=ivScale>1?1:2.2; if(ivScale===1){ivX=0;ivY=0;} ivApply(); });
  v.addEventListener("wheel",e=>{ if(!v.classList.contains("open")) return; e.preventDefault(); ivZoom(e.deltaY<0?0.2:-0.2); },{passive:false});
  let sx=0, sy=0, st=0;
  img.addEventListener("touchstart",e=>{
    if(e.touches.length===1){ ivDragging=true; ivStartX=e.touches[0].clientX-ivX; ivStartY=e.touches[0].clientY-ivY; sx=e.touches[0].clientX; sy=e.touches[0].clientY; st=Date.now(); }
    else if(e.touches.length===2){ ivDragging=false; ivPinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); }
  },{passive:false});
  img.addEventListener("touchmove",e=>{
    e.preventDefault();
    if(e.touches.length===1 && ivDragging){ ivX=e.touches[0].clientX-ivStartX; ivY=e.touches[0].clientY-ivStartY; ivApply(); }
    else if(e.touches.length===2){ const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); if(ivPinchDist){ ivScale=Math.min(6,Math.max(0.5,ivScale*(d/ivPinchDist))); ivApply(); } ivPinchDist=d; }
  },{passive:false});
  img.addEventListener("touchend",e=>{
    if(ivScale<=1.05 && st){ const dx=(e.changedTouches[0].clientX-sx), dy=(e.changedTouches[0].clientY-sy); if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)){ ivStep(dx<0?1:-1); } }
    ivDragging=false; ivPinchDist=0; st=0;
  });
  window.addEventListener("keydown",e=>{
    if(!v.classList.contains("open")) return;
    if(e.key==="Escape") closeViewer(); else if(e.key==="ArrowLeft") ivStep(-1); else if(e.key==="ArrowRight") ivStep(1);
  });
})();

/* ===== AI ===== */
function getApiKey(){
  let k=localStorage.getItem('anthropic_key');
  if(!k){k=prompt("Anthropic API 키를 입력하세요.\n(이 브라우저에만 저장됩니다)");
    if(k&&k.trim()){k=k.trim(); localStorage.setItem('anthropic_key',k);} else return null;}
  return k;
}
function resetKey(){localStorage.removeItem('anthropic_key'); if(getApiKey()) alert("API 키가 변경되었습니다.");}
function projectSummary(p){
  const withAmt=entries.filter(e=>Number(e.amount)>0);
  const total=withAmt.reduce((s,e)=>s+Number(e.amount),0);
  const stages=opts("stages");
  const stageInfo=stages.map(s=>{const st=stageStatus(p,s);
    const amt=entries.filter(e=>e.stage===s&&Number(e.amount)>0).reduce((a,e)=>a+Number(e.amount),0);
    return `${s}[${st}${amt?' '+amt.toLocaleString()+'원':''}]`;}).join(" → ");
  const cb=costBreakdown(p);
  const matTotal=materials.reduce((s,m)=>s+matAmount(m),0);
  const qInfo=quotes.length? quotes.map(q=>`- ${q.stage||''} ${q.title}: ${q.vendor} ${quoteKRW(q).toLocaleString()}원`).join("\n"):'없음';
  const aInfo=agents.length? agents.map(a=>`- ${a.name}: ${agentVisits(a)}명 데려옴`).join("\n"):'없음';
  return `[개요] ${p.name} / ${p.address||'-'} / ${p.status||'-'} / 진행률 ${progressPct(p)}%${p.budget?' / 예산 '+p.budget.toLocaleString()+'원':''}
[공정] ${stageInfo}
[투자] 총비용 ${cb.totalSpent.toLocaleString()}원 / 대출 ${cb.loan.toLocaleString()}원 / 실투자 ${cb.realInvest.toLocaleString()}원
[기록지출] ${total.toLocaleString()}원 (${withAmt.length}건)
[자재] ${materials.length}종 / 자재비 ${matTotal.toLocaleString()}원
[견적]\n${qInfo}
[부동산]\n${aInfo}
[업체 ${vendors.length}곳] ${vendors.map(v=>v.name).join(', ')||'없음'}`;
}
function buildPrompt(p){
  return `당신은 아파트 인테리어/매입 프로젝트를 점검하는 현장 관리자입니다. 아래 "${p.name}" 데이터에 근거해서만 분석하세요.

${projectSummary(p)}

다음 형식(마크다운)으로 한국어로 간결하게:
## 진행 상황
## ⚠️ 문제점 / 리스크
## 💡 다음 할 일
## 💰 비용 점검`;
}
async function runAnalysis(){
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  if(entries.length===0 && progressPct(p)===0){alert("분석할 기록이 없습니다.");return;}
  const key=getApiKey(); if(!key) return;
  const box=document.getElementById('aiResult'); if(box) box.innerHTML='<div class="ai-empty">🤖 분석 중…</div>';
  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:AI_MODEL,max_tokens:1500,messages:[{role:"user",content:buildPrompt(p)}]})});
    const data=await res.json();
    if(data.error) throw new Error(data.error.message||'API 오류');
    const text=(data.content||[]).filter(c=>c.type==='text').map(c=>c.text).join("\n").trim();
    if(!text) throw new Error('빈 응답');
    const now=new Date().toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    await db.collection(PROJECTS).doc(currentProjectId).update({lastAnalysis:text,analyzedAt:now});
    p.lastAnalysis=text; p.analyzedAt=now; if(activeTab==="대시보드") renderTab(p);
  }catch(err){ if(box) box.innerHTML='<div class="ai-empty" style="color:var(--danger)">분석 실패: '+esc(err.message)+'<br>API 키·크레딧·모델명을 확인하세요.</div>';}
}
function mdLite(t){let h=esc(t).replace(/^#{2,3}\s*(.*)$/gm,'<div class="ai-h">$1</div>')
  .replace(/^\s*[-*]\s+(.*)$/gm,'<div class="ai-li">• $1</div>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
  .replace(/\n/g,'<br>').replace(/(<\/div>)<br>/g,'$1'); return '<div class="ai-text">'+h+'</div>';}
function renderChat(){
  const box=document.getElementById("chatLog"); if(!box) return;
  box.innerHTML=chatHistory.map(m=>`<div class="chat-msg ${m.role==='user'?'me':'ai'}"><div class="chat-bubble">${m.role==='assistant'?mdLite(m.content):esc(m.content)}</div></div>`).join("");
  box.scrollTop=box.scrollHeight;
}
function clearChat(){ chatHistory=[]; renderChat(); }
async function sendChat(){
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  const inp=document.getElementById("chatInput"); const q=inp.value.trim(); if(!q) return;
  const key=getApiKey(); if(!key) return;
  inp.value=""; chatHistory.push({role:"user",content:q}); chatHistory.push({role:"assistant",content:"…"}); renderChat();
  try{
    const sys=`당신은 "${p.name}" 프로젝트를 돕는 비서입니다. 아래 데이터에 근거해 한국어로 간결히 답하세요.\n\n${projectSummary(p)}`;
    const msgs=chatHistory.slice(0,-1).slice(-8).map(m=>({role:m.role,content:m.content}));
    const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:AI_MODEL,max_tokens:1000,system:sys,messages:msgs})});
    const data=await res.json();
    if(data.error) throw new Error(data.error.message||'API 오류');
    const text=(data.content||[]).filter(c=>c.type==='text').map(c=>c.text).join("\n").trim()||"(빈 응답)";
    chatHistory[chatHistory.length-1]={role:"assistant",content:text}; renderChat();
  }catch(err){ chatHistory[chatHistory.length-1]={role:"assistant",content:"오류: "+(err.message||err)}; renderChat(); }
}

/* (빠른 연속 입력은 v3.8에서 기록 추가로 통합되어 제거됨) */

/* ===== 반복 비용 ===== */
const WEEKDAYS=["일","월","화","수","목","금","토"];
let repeatDays={};
function openRepeatEtc(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  buildOptSelect("re_cat","etc_cats","관리비");
  buildOptSelect("re_pay","pays","은행이체");
  document.getElementById("re_amount").value="";
  document.getElementById("re_freq").value="monthly";
  document.getElementById("re_start").value=today();
  document.getElementById("re_end").value="";
  document.getElementById("re_title").value="";
  document.getElementById("re_monthday").value="25";
  repeatDays={6:true};
  document.getElementById("re_days").innerHTML=WEEKDAYS.map((d,i)=>`<button type="button" class="mini-chip ${repeatDays[i]?'on':''}" id="rd_${i}" onclick="toggleRepeatDay(${i})">${d}</button>`).join("");
  ["re_start","re_end","re_amount","re_monthday"].forEach(id=>document.getElementById(id).oninput=updateRepeatPreview);
  document.getElementById("re_cat").onchange=updateRepeatPreview;
  onFreqChange(); openModal("repeatEtcModal");
}
function onFreqChange(){
  const f=val("re_freq");
  document.getElementById("re_weekwrap").style.display = f==="weekly"?"block":"none";
  document.getElementById("re_monthwrap").style.display = f==="monthly"?"block":"none";
  updateRepeatPreview();
}
function toggleRepeatDay(i){ repeatDays[i]=!repeatDays[i]; document.getElementById("rd_"+i).classList.toggle("on"); updateRepeatPreview(); }
function repeatDates(){
  const s=val("re_start"), e=val("re_end"); if(!s||!e) return [];
  const out=[]; const end=new Date(e+"T00:00:00");
  if(val("re_freq")==="weekly"){
    const days=Object.keys(repeatDays).filter(k=>repeatDays[k]).map(Number); if(!days.length) return [];
    let d=new Date(s+"T00:00:00"); let g=0;
    while(d<=end && g<800){ if(days.includes(d.getDay())) out.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); g++; }
  } else {
    let day=Number(val("re_monthday"))||1; let cur=new Date(s+"T00:00:00"); cur.setDate(1); let g=0;
    while(cur<=end && g<240){ const y=cur.getFullYear(), m=cur.getMonth(); const last=new Date(y,m+1,0).getDate(); const dd=Math.min(day,last); const dt=new Date(y,m,dd);
      if(dt>=new Date(s+"T00:00:00") && dt<=end) out.push(dt.toISOString().slice(0,10)); cur.setMonth(cur.getMonth()+1); g++; }
  }
  return out;
}
function updateRepeatPreview(){
  const dates=repeatDates(); const amt=Number(val("re_amount"))||0;
  const box=document.getElementById("re_preview");
  if(!dates.length){ box.textContent="기간·주기·금액을 입력하면 생성 건수가 표시됩니다."; return; }
  box.innerHTML=`→ <b>${dates.length}건</b> 생성 · 합계 <b>${(dates.length*amt).toLocaleString()}원</b> (${dates[0]} ~ ${dates[dates.length-1]})`;
}
async function saveRepeatEtc(){
  const dates=repeatDates(); const amount=Number(val("re_amount"));
  if(!dates.length){alert("기간과 주기를 확인하세요.");return;}
  if(!amount){alert("금액을 입력하세요.");return;}
  if(dates.length>200){alert("생성 건수가 너무 많습니다(200건 초과).");return;}
  const cat=val("re_cat"), pay=val("re_pay"), title=val("re_title").trim()||cat;
  if(!confirm(dates.length+"건을 생성할까요? (합계 "+(dates.length*amount).toLocaleString()+"원)"))return;
  const btn=document.getElementById("repeatSaveBtn"); btn.disabled=true; btn.textContent="생성 중...";
  try{
    const batch=db.batch();
    dates.forEach(dt=>{ const ref=db.collection(ENTRIES).doc();
      batch.set(ref,{projectId:currentProjectId,kind:"기타비용",title,date:dt,stage:null,cat,vendor:"",amount,pay,memo:"반복 생성",files:[],createdAt:firebase.firestore.FieldValue.serverTimestamp()}); });
    await batch.commit();
    btn.disabled=false; btn.textContent="생성"; closeModal("repeatEtcModal"); await reloadCurrent();
  }catch(err){ btn.disabled=false; btn.textContent="생성"; showError("반복 비용 생성", err); }
}

/* ===== 엑셀 가져오기 ===== */
const XL_MAP = {
  "욕실":{kind:"자재비", stage:"타일·방수"},"목공사":{kind:"자재비", stage:"목공"},"목공":{kind:"자재비", stage:"목공"},
  "시트지":{kind:"자재비", stage:"필름"},"필름":{kind:"자재비", stage:"필름"},"샷시":{kind:"자재비", stage:"샷시/창호"},
  "전등":{kind:"자재비", stage:"전기·조명"},"전기":{kind:"자재비", stage:"전기·조명"},"도배":{kind:"자재비", stage:"도배"},
  "철거":{kind:"자재비", stage:"철거"},"페인트":{kind:"자재비", stage:"페인트(도장)"},"바닥":{kind:"자재비", stage:"바닥(마루/장판)·전기마감"},
  "싱크대":{kind:"자재비", stage:"싱크대·가구"},"인테리어":{kind:"자재비", stage:null},"공구":{kind:"자재비", stage:null},
  "교통비":{kind:"기타비용", cat:"교통/주유비"},"식비":{kind:"기타비용", cat:"식비"},"등기":{kind:"기타비용", cat:"등기비"},
  "은행이자":{kind:"기타비용", cat:"대출이자"},"관리비":{kind:"기타비용", cat:"관리비"},"도시가스":{kind:"기타비용", cat:"도시가스"},"보험":{kind:"기타비용", cat:"보험료"}
};
function mapGubun(g){ g=(g||"").trim(); if(XL_MAP[g]) return XL_MAP[g]; for(const k of Object.keys(XL_MAP)){ if(g.includes(k)) return XL_MAP[k]; } return {kind:"기타비용", cat:"기타"}; }
function refineCat(base, name){ name=(name||""); if(base.kind==="기타비용" && base.cat==="교통/주유비"){ if(/톨비|통행/.test(name)) return "톨비(통행료)"; } return base.cat; }
function excelSerialToDate(v){ if(v==null||v==="") return null; if(typeof v==="string" && /\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10); const n=Number(v); if(!n||isNaN(n)) return null; const d=new Date(Math.round((n-25569)*86400*1000)); if(isNaN(d.getTime())) return null; return d.toISOString().slice(0,10); }
let _xlRows=null;
function openExcelImport(){
  if(typeof XLSX==="undefined"){ alert("엑셀 라이브러리 로딩 중입니다."); return; }
  _xlRows=null; document.getElementById("xl_file").value=""; document.getElementById("xl_preview").innerHTML=""; document.getElementById("xl_btn").style.display="none"; openModal("excelModal");
}
function onExcelPick(ev){
  const f=ev.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const wb=XLSX.read(e.target.result,{type:"binary"}); let rows=null;
      for(const sn of wb.SheetNames){
        const arr=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:""});
        const headRow=arr.findIndex(r=>r.some(c=>String(c).includes("목록")||String(c).includes("합계")||String(c).includes("구분")));
        if(headRow>=0){ rows=parseXlRows(arr, headRow); break; }
      }
      if(!rows||!rows.length){ document.getElementById("xl_preview").innerHTML='<div class="ai-empty">인식할 데이터를 찾지 못했습니다.</div>'; return; }
      _xlRows=rows; renderXlPreview(rows);
    }catch(err){ showError("엑셀 읽기", err); }
  };
  reader.readAsBinaryString(f);
}
function parseXlRows(arr, headRow){
  const head=arr[headRow].map(c=>String(c).trim());
  const col=(name)=>head.findIndex(h=>h.includes(name));
  const ci={date:col("날짜"), name:col("목록"), amount:col("합계"), amount2:col("비용"), buyer:col("구매처"), gubun:col("구분")};
  const out=[]; let lastDate=null;
  for(let i=headRow+1;i<arr.length;i++){
    const r=arr[i]; if(!r||!r.length) continue;
    const name=String(r[ci.name]||"").trim();
    let amount=Number(r[ci.amount]|| (ci.amount2>=0?r[ci.amount2]:0))||0;
    if(!name) continue; if(/^(합계|총계|소계|총합|계)$/.test(name)) continue; if(!amount) continue;
    let date=excelSerialToDate(r[ci.date]); if(date) lastDate=date; else date=lastDate;
    const gubun=String(r[ci.gubun]||"").trim(); const buyer=String(r[ci.buyer]||"").trim();
    const m=mapGubun(gubun); const cat=m.kind==="기타비용"?refineCat(m,name):null;
    out.push({date:date||today(), name, amount, gubun, buyer, kind:m.kind, stage:m.stage||null, cat});
  }
  return out;
}
function renderXlPreview(rows){
  const total=rows.reduce((s,r)=>s+r.amount,0);
  const body=rows.slice(0,40).map(r=>`<tr><td>${r.date}</td><td>${esc(r.name)}</td><td class="num">${r.amount.toLocaleString()}</td><td>${esc(r.gubun)}</td><td>${r.kind==="자재비"?('자재·'+(r.stage||'미지정')):('기타·'+r.cat)}</td></tr>`).join("");
  document.getElementById("xl_preview").innerHTML=`<div class="hint">총 <b>${rows.length}건</b> · 합계 <b>${total.toLocaleString()}원</b></div>
    <div style="max-height:300px;overflow:auto;margin-top:8px;border:1px solid var(--line);border-radius:8px"><table class="tbl"><thead><tr><th>날짜</th><th>목록</th><th>금액</th><th>구분</th><th>분류</th></tr></thead><tbody>${body}</tbody></table></div>
    ${rows.length>40?`<div class="hint" style="margin-top:6px">… 외 ${rows.length-40}건</div>`:''}`;
  document.getElementById("xl_btn").style.display="inline-block";
}
async function runExcelImport(){
  if(!_xlRows||!_xlRows.length) return;
  if(!confirm(_xlRows.length+"건을 가져올까요?")) return;
  const btn=document.getElementById("xl_btn"); btn.disabled=true; btn.textContent="가져오는 중…";
  try{
    showUploading("비용 가져오는 중…"); let n=0; const chunk=400;
    for(let i=0;i<_xlRows.length;i+=chunk){
      const batch=db.batch();
      _xlRows.slice(i,i+chunk).forEach(r=>{ const ref=db.collection(ENTRIES).doc();
        batch.set(ref,{projectId:currentProjectId, kind:r.kind, title:r.name||r.gubun||"비용", date:r.date, stage:r.stage, cat:r.cat, vendor:r.buyer||"", amount:r.amount||null, pay:r.kind==="기타비용"?"기타":null, memo:"엑셀 가져오기", files:[], createdAt:firebase.firestore.FieldValue.serverTimestamp()}); n++; });
      showUploading("비용 가져오는 중… ("+n+"/"+_xlRows.length+")"); await batch.commit();
    }
    hideUploading(); btn.disabled=false; btn.textContent="가져오기"; closeModal("excelModal"); alert(n+"건을 가져왔습니다."); await reloadCurrent();
  }catch(err){ hideUploading(); btn.disabled=false; btn.textContent="가져오기"; showError("엑셀 가져오기", err); }
}

/* ===== 업체 ===== */
let editingVendorId=null;
function openVendorModal(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  editingVendorId=null;
  document.getElementById("vendorModalTitle").textContent="업체 / 연락처 추가";
  buildOptSelect("vf_trade","vendor_roles","");
  ["vf_name","vf_phone","vf_memo"].forEach(id=>document.getElementById(id).value="");
  // 🔗 scan-app 명함 연결 reset
  _vfScanRefs = [];
  renderVfScanAttached();
  openModal("vendorModal");
}
function editVendor(id){
  const v=vendors.find(x=>x.id===id); if(!v) return;
  editingVendorId=id;
  document.getElementById("vendorModalTitle").textContent="업체 / 연락처 수정";
  buildOptSelect("vf_trade","vendor_roles",v.trade||"");
  document.getElementById("vf_name").value=v.name||""; document.getElementById("vf_phone").value=v.phone||""; document.getElementById("vf_memo").value=v.memo||"";
  // 🔗 scan-app 명함 연결 로드
  _vfScanRefs = [];
  renderVfScanAttached();
  if(v.scanRefs && v.scanRefs.length){
    (async ()=>{
      for(const ref of v.scanRefs){
        const data = await fetchScanItem(ref.type, ref.id);
        if(data) _vfScanRefs.push({ type:ref.type, id:ref.id, data });
      }
      renderVfScanAttached();
    })();
  }
  openModal("vendorModal");
}
function resetVendorScanRefs(){
  _vfScanRefs = [];
  renderVfScanAttached();
}
async function saveVendor(){
  const name=val("vf_name").trim(), phone=val("vf_phone").trim();
  if(!name||!phone){alert("업체명과 전화번호를 입력하세요.");return;}
  try{
    const data={
      projectId:currentProjectId, name, trade:val("vf_trade"), phone,
      memo:val("vf_memo").trim(),
      scanRefs: _vfScanRefs.map(r => ({type:r.type, id:r.id}))
    };
    let savedId;
    if(editingVendorId){
      await db.collection(VENDORS).doc(editingVendorId).update(data);
      savedId = editingVendorId;
    } else {
      data.createdAt=firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection(VENDORS).add(data);
      savedId = ref.id;
    }
    // 🔗 scan-app 명함에 양방향 링크 자동 추가
    const linkedTo = `realestate:vendor_${savedId}`;
    for(const r of _vfScanRefs){
      await linkScanItemBack(r.type, r.id, linkedTo).catch(()=>{});
    }
    editingVendorId=null; closeModal("vendorModal"); await reloadCurrent();
  }catch(err){ showError("업체 저장", err); }
}
async function deleteVendor(id){
  const v=vendors.find(x=>x.id===id);
  if(!confirm('이 업체를 삭제할까요?\n\n"'+((v&&v.name)||'')+'"'))return;
  try{ await db.collection(VENDORS).doc(id).delete(); await reloadCurrent(); }
  catch(err){ showError("업체 삭제", err); }
}

/* ===== 프로젝트 ===== */
function openProjectModal(id){
  if(id){
    const p=projects.find(x=>x.id===id); if(!p) return;
    document.getElementById("projectModalTitle").textContent="프로젝트 정보 수정";
    document.getElementById("pf_id").value=id;
    document.getElementById("pf_name").value=p.name||"";
    document.getElementById("pf_addr").value=p.address||"";
    document.getElementById("pf_status").value=p.status||"진행중";
    document.getElementById("pf_date").value=p.startDate||today();
    document.getElementById("pf_budget").value=p.budget!=null?p.budget:"";
    document.getElementById("pf_memo").value=p.memo||"";
  } else {
    document.getElementById("projectModalTitle").textContent="새 프로젝트";
    document.getElementById("pf_id").value="";
    document.getElementById("pf_date").value=today();
    ["pf_name","pf_addr","pf_memo","pf_budget"].forEach(x=>document.getElementById(x).value="");
    document.getElementById("pf_status").value="진행중";
  }
  openModal("projectModal");
}
async function saveProject(){
  const name=val("pf_name").trim(); if(!name){alert("프로젝트명을 입력하세요.");return;}
  const data={name,address:val("pf_addr").trim(),status:val("pf_status"),startDate:val("pf_date"),
    budget:val("pf_budget")?Number(val("pf_budget")):null,memo:val("pf_memo").trim()};
  try{
    const id=document.getElementById("pf_id").value;
    if(id){ await db.collection(PROJECTS).doc(id).update(data); closeModal("projectModal"); await loadProjects(); if(currentProjectId===id) await reloadCurrent(); }
    else { data.stageStatus={}; data.createdAt=firebase.firestore.FieldValue.serverTimestamp(); await db.collection(PROJECTS).add(data); closeModal("projectModal"); await loadProjects(); }
  }catch(err){ showError("프로젝트 저장", err); }
}
async function deleteProject(){
  if(!currentProjectId) return;
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  const typed=prompt('정말 삭제하려면 프로젝트 이름을 정확히 입력하세요.\n\n"'+p.name+'"');
  if(typed===null) return;
  if(typed.trim()!==p.name){ alert("이름이 일치하지 않아 취소했습니다."); return; }
  try{
    const [e,v,m,q,a,w,t]=await Promise.all([
      db.collection(ENTRIES).where("projectId","==",currentProjectId).get(),
      db.collection(VENDORS).where("projectId","==",currentProjectId).get(),
      db.collection(MATERIALS).where("projectId","==",currentProjectId).get(),
      db.collection(QUOTES).where("projectId","==",currentProjectId).get(),
      db.collection(AGENTS).where("projectId","==",currentProjectId).get(),
      db.collection(WORKLOG).where("projectId","==",currentProjectId).get(),
      db.collection(TODOS).where("projectId","==",currentProjectId).get()
    ]);
    const all=[...e.docs,...v.docs,...m.docs,...q.docs,...a.docs,...w.docs,...t.docs];
    for(let i=0;i<all.length;i+=400){
      const batch=db.batch();
      all.slice(i,i+400).forEach(d=>batch.delete(d.ref));
      if(i+400>=all.length) batch.delete(db.collection(PROJECTS).doc(currentProjectId));
      await batch.commit();
    }
    if(!all.length){ await db.collection(PROJECTS).doc(currentProjectId).delete(); }
    currentProjectId=null; entries=[]; vendors=[]; materials=[]; quotes=[]; agents=[]; worklogs=[]; todos=[];
    await loadProjects();
    document.getElementById("main").innerHTML='<div class="empty">프로젝트를 선택하세요.</div>';
  }catch(err){ showError("프로젝트 삭제", err); }
}

/* ===== 백업 / 복원 ===== */
function openBackupModal(){ const h=document.getElementById("restoreHint"); if(h) h.textContent=""; openModal("backupModal"); }
function downloadJson(obj, filename){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function stripId(o){ const c=Object.assign({},o); delete c.id; delete c._spent; delete c._last; return c; }
async function backupCurrentProject(){
  if(!currentProjectId){ alert("백업할 프로젝트를 먼저 선택하세요."); return; }
  const p=projects.find(x=>x.id===currentProjectId); if(!p) return;
  try{
    showUploading("백업 만드는 중…");
    const [e,v,m,q,a,w,t]=await Promise.all([
      db.collection(ENTRIES).where("projectId","==",currentProjectId).get(),
      db.collection(VENDORS).where("projectId","==",currentProjectId).get(),
      db.collection(MATERIALS).where("projectId","==",currentProjectId).get(),
      db.collection(QUOTES).where("projectId","==",currentProjectId).get(),
      db.collection(AGENTS).where("projectId","==",currentProjectId).get(),
      db.collection(WORKLOG).where("projectId","==",currentProjectId).get(),
      db.collection(TODOS).where("projectId","==",currentProjectId).get()
    ]);
    const data={ _type:"realestate-project-backup", _version:4, _exportedAt:new Date().toISOString(),
      options:userOpts,
      project:stripId(p),
      entries:e.docs.map(d=>stripId({id:d.id,...d.data()})),
      vendors:v.docs.map(d=>stripId({id:d.id,...d.data()})),
      materials:m.docs.map(d=>stripId({id:d.id,...d.data()})),
      quotes:q.docs.map(d=>stripId({id:d.id,...d.data()})),
      agents:a.docs.map(d=>stripId({id:d.id,...d.data()})),
      worklogs:w.docs.map(d=>stripId({id:d.id,...d.data()})),
      todos:t.docs.map(d=>stripId({id:d.id,...d.data()}))
    };
    hideUploading();
    downloadJson(data, (p.name||"프로젝트").replace(/[^\w가-힣]/g,"_")+"_백업_"+today()+".json");
  }catch(err){ hideUploading(); showError("프로젝트 백업", err); }
}
async function backupAll(){
  try{
    showUploading("전체 백업 만드는 중…");
    const [pS,eS,vS,mS,qS,aS,wS,tS]=await Promise.all([
      db.collection(PROJECTS).get(), db.collection(ENTRIES).get(), db.collection(VENDORS).get(),
      db.collection(MATERIALS).get(), db.collection(QUOTES).get(), db.collection(AGENTS).get(),
      db.collection(WORKLOG).get(), db.collection(TODOS).get()
    ]);
    const data={ _type:"realestate-full-backup", _version:4, _exportedAt:new Date().toISOString(),
      options:userOpts,
      projects:pS.docs.map(d=>stripId({id:d.id,...d.data()})),
      entries:eS.docs.map(d=>({id:d.id,...d.data()})),
      vendors:vS.docs.map(d=>({id:d.id,...d.data()})),
      materials:mS.docs.map(d=>({id:d.id,...d.data()})),
      quotes:qS.docs.map(d=>({id:d.id,...d.data()})),
      agents:aS.docs.map(d=>({id:d.id,...d.data()})),
      worklogs:wS.docs.map(d=>({id:d.id,...d.data()})),
      todos:tS.docs.map(d=>({id:d.id,...d.data()}))
    };
    hideUploading();
    downloadJson(data, "부동산_전체백업_"+today()+".json");
    localStorage.setItem("re-lastBackup", String(Date.now()));  // 7일 알림용
  }catch(err){ hideUploading(); showError("전체 백업", err); }
}
/* ===== 7일마다 자동 백업 제안 ===== */
function checkBackupReminder(){
  try{
    const last=Number(localStorage.getItem("re-lastBackup")||0);
    const week=7*24*60*60*1000;
    const now=Date.now();
    if(now-last < week) return;                 // 7일 안 지났으면 조용히
    if(!projects.length) return;                // 데이터 없으면 굳이 안 함
    const days = last? Math.floor((now-last)/(24*60*60*1000)) : null;
    const msg = days!=null
      ? ("마지막 백업이 "+days+"일 전입니다.\n지금 전체 백업 파일을 만들까요?")
      : ("아직 백업한 적이 없습니다.\n만일을 대비해 전체 백업 파일을 만들까요?\n(데이터는 클라우드에 저장돼 있지만, 한 벌 더 빼두면 안전합니다)");
    if(confirm(msg)){ backupAll(); }
    else { localStorage.setItem("re-lastBackup", String(now)); } // 미루면 다음 주에 다시
  }catch(_){}
}
function cleanForWrite(o){ const c=Object.assign({},o); delete c.id; delete c.projectId; delete c.createdAt; delete c._spent; delete c._last; return c; }
async function batchAdd(collName, items, projectId){
  const chunk=400;
  for(let i=0;i<items.length;i+=chunk){
    const batch=db.batch();
    items.slice(i,i+chunk).forEach(it=>{ const ref=db.collection(collName).doc();
      batch.set(ref, Object.assign({}, cleanForWrite(it), {projectId, createdAt:firebase.firestore.FieldValue.serverTimestamp()})); });
    await batch.commit();
    showUploading("복원 중… ("+Math.min(i+chunk,items.length)+"/"+items.length+" "+collName+")");
  }
}
async function restoreOneProject(projData, e, v, m, q, a, w, t){
  const pClean=cleanForWrite(projData);
  pClean.name=(projData.name||"복원 프로젝트")+" (복원본)";
  if(!pClean.stageStatus) pClean.stageStatus={};
  pClean.createdAt=firebase.firestore.FieldValue.serverTimestamp();
  const pRef=await db.collection(PROJECTS).add(pClean); const newId=pRef.id;
  if(e&&e.length) await batchAdd(ENTRIES, e, newId);
  if(v&&v.length) await batchAdd(VENDORS, v, newId);
  if(m&&m.length) await batchAdd(MATERIALS, m, newId);
  if(q&&q.length) await batchAdd(QUOTES, q, newId);
  if(a&&a.length) await batchAdd(AGENTS, a, newId);
  if(w&&w.length) await batchAdd(WORKLOG, w, newId);
  if(t&&t.length) await batchAdd(TODOS, t, newId);
  return newId;
}
async function mergeOptions(opt){
  if(!opt) return;
  for(const key of Object.keys(opt)){
    const incoming=opt[key]||[];
    const cur=userOpts[key]||[];
    const merged=cur.slice();
    incoming.forEach(v=>{ if(!merged.includes(v)) merged.push(v); });
    userOpts[key]=merged;
    await saveUserOpts(key);
  }
}
document.getElementById("restoreInput").onchange=function(){
  const f=this.files[0]; if(!f) return;
  const hint=document.getElementById("restoreHint");
  const reader=new FileReader();
  reader.onload=async function(e){
    let data;
    try{ data=JSON.parse(e.target.result); }
    catch(_){ if(hint) hint.textContent="❌ JSON 파일을 읽지 못했습니다."; return; }
    try{
      if(data._type==="realestate-project-backup" && data.project){
        if(!confirm('"'+(data.project.name||'')+'" 를 새 프로젝트로 복원할까요?')) { document.getElementById("restoreInput").value=""; return; }
        showUploading("복원 중…");
        await mergeOptions(data.options);
        await restoreOneProject(data.project, data.entries||[], data.vendors||[], data.materials||[], data.quotes||[], data.agents||[], data.worklogs||[], data.todos||[]);
        hideUploading(); document.getElementById("restoreInput").value=""; closeModal("backupModal"); await loadProjects();
        alert("복원이 완료되었습니다.");
      }else if(data._type==="realestate-full-backup" && Array.isArray(data.projects)){
        if(!confirm(data.projects.length+"개 프로젝트를 모두 복원할까요?")) { document.getElementById("restoreInput").value=""; return; }
        showUploading("전체 복원 중…");
        await mergeOptions(data.options);
        const by=id=>x=>x.projectId===id;
        for(const proj of data.projects){
          await restoreOneProject(proj,
            (data.entries||[]).filter(by(proj.id)),
            (data.vendors||[]).filter(by(proj.id)),
            (data.materials||[]).filter(by(proj.id)),
            (data.quotes||[]).filter(by(proj.id)),
            (data.agents||[]).filter(by(proj.id)),
            (data.worklogs||[]).filter(by(proj.id)),
            (data.todos||[]).filter(by(proj.id)));
        }
        hideUploading(); document.getElementById("restoreInput").value=""; closeModal("backupModal"); await loadProjects();
        alert(data.projects.length+"개 프로젝트 복원 완료.");
      }else{ if(hint) hint.textContent="❌ 이 앱의 백업 파일 형식이 아닙니다."; }
    }catch(err){ hideUploading(); document.getElementById("restoreInput").value=""; showError("복원", err); }
  };
  reader.readAsText(f);
};

/* ===== 진단 ===== */
async function runDiagnostics(){
  openModal("diagModal");
  const box=document.getElementById("diagResult"); const rows=[];
  function row(state, name, detail){
    const ic={ok:'✅',warn:'⚠️',fail:'❌',info:'ℹ️'}[state]||'•';
    const cls={ok:'diag-ok',warn:'diag-warn',fail:'diag-fail'}[state]||'';
    rows.push(`<div class="diag-row"><div class="diag-ic">${ic}</div><div><div class="diag-name ${cls}">${name}</div>${detail?`<div class="diag-detail">${detail}</div>`:''}</div></div>`);
    box.innerHTML=rows.join("");
  }
  box.innerHTML='<div class="ai-empty">점검 중…</div>'; rows.length=0;
  row(navigator.onLine?'ok':'fail', "인터넷 연결", navigator.onLine?'온라인':'오프라인');
  row('info', "Firebase 설정", `프로젝트 <code>${esc(firebaseConfig.projectId)}</code><br>Storage <code>${esc(firebaseConfig.storageBucket)}</code>`);
  row(_fxRate?'ok':'warn', "환율(USD→KRW)", _fxRate? (Math.round(_fxRate).toLocaleString()+"원 ("+(_fxDate||'')+")") : "가져오지 못함 — 상단 배지에서 수동 입력 가능");
  try{ await db.collection(PROJECTS).limit(1).get(); row('ok', "Firestore 읽기", "정상"); }
  catch(err){ row('fail', "Firestore 읽기 실패", esc(err.message||err)); }
  try{ const ref=await db.collection("_diag_test").add({t:Date.now()}); await ref.delete(); row('ok', "Firestore 쓰기", "정상"); }
  catch(err){ row('fail', "Firestore 쓰기 실패", esc(err.message||err)); }
  try{ const ref=storage.ref("_diag_test/"+Date.now()+".txt"); await ref.putString("diag"); await ref.getDownloadURL(); await ref.delete(); row('ok', "Storage 업로드", "정상"); }
  catch(err){ row('fail', "Storage 업로드 실패", esc((err&&err.code)||'')+" "+esc(err.message||err)); }
  const hasKey=!!localStorage.getItem('anthropic_key');
  row(hasKey?'ok':'warn', "AI API 키", hasKey? "저장됨" : "없음 — AI 처음 사용 시 입력");
  row('info', "현재 데이터", `프로젝트 ${projects.length}개 / 기록 ${entries.length} · 자재 ${materials.length} · 견적 ${quotes.length} · 부동산 ${agents.length} · 업체 ${vendors.length} · 작업일지 ${worklogs.length} · 할일 ${todos.length}`);
  row('info', "점검 완료", new Date().toLocaleString('ko-KR'));
}

/* ── 헤더 ⚡ 전역 급한메모 (프로젝트 미선택시에도 열림) ── */
const _GLOBAL_MEMO_KEY = 're_global_quickmemo';
function openGlobalMemo(){
  // 프로젝트 선택됐으면 기존 프로젝트 메모로
  if(currentProjectId){ openMemoBoard(); return; }
  // 없으면 localStorage 기반 전역 메모
  const panel=document.getElementById('memoPanel'); if(!panel) return;
  const ed=document.getElementById('memoEditor');
  if(ed) ed.innerHTML = localStorage.getItem(_GLOBAL_MEMO_KEY)||'';
  const st=document.getElementById('memoStatus'); if(st) st.textContent='';
  document.getElementById('memoPanel').classList.add('open');
  document.getElementById('memoBackdrop').classList.add('open');
  setTimeout(()=>{ if(ed) ed.focus(); },150);
}
// Ctrl+Shift+M 단축키
document.addEventListener('keydown', e=>{
  if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()==='m'){
    e.preventDefault();
    const panel=document.getElementById('memoPanel');
    if(panel && panel.classList.contains('open')) closeMemoPanel();
    else openGlobalMemo();
  }
  if(e.key==='Escape'){
    const panel=document.getElementById('memoPanel');
    if(panel && panel.classList.contains('open')){ closeMemoPanel(); }
  }
});

/* ===== 앱 시작 (모든 선언 이후 맨 끝에서 실행) ===== */
(async function init(){
  startLock();              // 잠금 (PIN 미설정 시 자동 통과)
  registerSW();             // PWA 서비스워커 등록
  await loadUserOpts();
  loadFxRate();
  await loadProjects();
  // PIN이 없으면(잠금화면 안 뜸) 바로 백업 체크. PIN 있으면 unlock 후 체크됨.
  if(!hasPin()) setTimeout(checkBackupReminder, 1500);
})();


/* ============================================================
   v6.6 NEW: 드래그앤드롭·Ctrl+V 첨부 / 링크 필드 / 전화자동입력 / 자동완성Tab
   ============================================================ */

/* ── 드롭존 초기화 (모달 열릴 때 한 번씩 호출) ── */
function initDropZone(zoneId, previewId, storeKey){
  const zone = document.getElementById(zoneId);
  if(!zone || zone._dzInited) return;
  zone._dzInited = true;
  const input = zone.querySelector('input[type="file"]');

  // 드래그 시각 표시
  zone.addEventListener('dragover', e=>{ e.preventDefault(); zone.classList.add('dz-hover'); });
  zone.addEventListener('dragleave', ()=>zone.classList.remove('dz-hover'));
  zone.addEventListener('drop', e=>{
    e.preventDefault(); zone.classList.remove('dz-hover');
    addDropFiles(Array.from(e.dataTransfer.files), previewId, storeKey);
  });

  // Ctrl+V (모달이 열려있을 때 전역 paste)
  zone._pasteHandler = (e)=>{
    // 해당 모달이 열려있을 때만
    const modal = zone.closest('.modal-bg');
    if(!modal || !modal.classList.contains('open')) return;
    // 메모 에디터 안에 포커스 있으면 무시
    if(document.activeElement && document.activeElement.contentEditable==='true') return;
    const items = (e.clipboardData||window.clipboardData)?.items;
    if(!items) return;
    const files=[];
    for(const it of items){ if(it.kind==='file') { const f=it.getAsFile(); if(f) files.push(f); } }
    if(!files.length) return;
    e.preventDefault();
    addDropFiles(files, previewId, storeKey);
  };
  document.addEventListener('paste', zone._pasteHandler);
}

function addDropFiles(files, previewId, storeKey){
  if(!files||!files.length) return;
  if(!window[storeKey]) window[storeKey]=[];
  window[storeKey].push(...files);
  renderDropPreview(previewId, storeKey);
}

function renderDropPreview(previewId, storeKey){
  const box = document.getElementById(previewId); if(!box) return;
  const files = window[storeKey]||[];
  box.innerHTML = files.map((f,i)=>{
    const isImg = (f.type||'').startsWith('image/');
    const icon = isImg ? '🖼' : '📄';
    return `<div class="dp-item" data-i="${i}" data-key="${storeKey}">
      ${icon} <span class="dp-name">${esc(f.name||'파일')}</span>
      <button type="button" class="dp-del" onclick="removeDropFile('${storeKey}',${i},'${previewId}')">✕</button>
    </div>`;
  }).join('');
}

function removeDropFile(storeKey, idx, previewId){
  if(!window[storeKey]) return;
  window[storeKey].splice(idx,1);
  renderDropPreview(previewId, storeKey);
}

/* ── 링크 힌트 함수 ── */
function efLinkHint(){
  const v=(document.getElementById('ef_link')||{}).value||'';
  const btn=document.getElementById('ef_linkBtn');
  if(btn){ if(v.startsWith('http')){ btn.style.display='inline-block'; btn.href=v; } else { btn.style.display='none'; } }
}
function mfLinkHint(){
  const v=(document.getElementById('mf_link')||{}).value||'';
  const btn=document.getElementById('mf_linkBtn');
  if(btn){ if(v.startsWith('http')){ btn.style.display='inline-block'; btn.href=v; } else { btn.style.display='none'; } }
}

/* ── 거래처 입력 시 업체연락처에서 전화번호 자동 입력 ── */
function setupVendorAutoPhone(){
  const efVendor = document.getElementById('ef_vendor');
  if(efVendor && !efVendor._autoPhoneInited){
    efVendor._autoPhoneInited = true;

    // 자동완성 Tab 선택 지원
    efVendor.addEventListener('keydown', e=>{
      if(e.key==='Tab'){
        const dl = document.getElementById('vendorList');
        if(!dl) return;
        const v = efVendor.value.trim().toLowerCase();
        if(!v) return;
        const match = Array.from(dl.options).find(o=>o.value.toLowerCase().startsWith(v));
        if(match && match.value !== efVendor.value){
          e.preventDefault();
          efVendor.value = match.value;
          efVendor.dispatchEvent(new Event('input'));
          efVendor.dispatchEvent(new Event('change'));
        }
      }
    });

    // 값 변경 시 전화번호 자동 채우기
    efVendor.addEventListener('input', ()=>{
      if(window._efManualPhone) return;
      fillPhoneFromVendor('ef_vendor','ef_phone');
    });
    efVendor.addEventListener('change', ()=>{
      if(window._efManualPhone) return;
      fillPhoneFromVendor('ef_vendor','ef_phone');
    });

    // 사람이 직접 전화번호 입력하면 자동입력 중단
    const efPhone = document.getElementById('ef_phone');
    if(efPhone) efPhone.addEventListener('input', ()=>{ window._efManualPhone=true; });
  }

  // 공정/세부항목 입력 시 단가기준표 자동완성 — 업체 선택도 자동화
  const efStage = document.getElementById('ef_stage');
  const efCat = document.getElementById('ef_cat');
  if(efStage && !efStage._autoVendorInited){
    efStage._autoVendorInited=true;
    const suggest = ()=>{
      const stage=(efStage.value||'').trim();
      const cat=(efCat?efCat.value:'').trim();
      const term=(cat||stage).toLowerCase();
      if(!term) return;
      // 업체연락처에서 해당 공종 매칭
      const match = _cmVendors.find(v=>((v.field||'')+(v.note||'')).toLowerCase().includes(term));
      if(match){
        const ev=document.getElementById('ef_vendor');
        if(ev && !ev.value.trim()){ ev.value=match.name||''; }
        const ph=document.getElementById('ef_phone');
        if(ph && !ph.value.trim() && !window._efManualPhone){ ph.value=match.phone||''; }
      }
    };
    efStage.addEventListener('change', suggest);
    if(efCat) efCat.addEventListener('change', suggest);
  }
}

function fillPhoneFromVendor(vendorInputId, phoneInputId){
  const nameEl=document.getElementById(vendorInputId);
  const phoneEl=document.getElementById(phoneInputId);
  if(!nameEl||!phoneEl) return;
  const name=(nameEl.value||'').trim().toLowerCase();
  if(!name) return;
  // 프로젝트 업체 목록 먼저
  const pv=vendors.find(v=>(v.name||'').toLowerCase()===name);
  if(pv && pv.phone){ phoneEl.value=pv.phone; return; }
  // 공통자료 업체연락처
  const cv=_cmVendors.find(v=>(v.name||'').toLowerCase()===name);
  if(cv && cv.phone){ phoneEl.value=cv.phone; return; }
}

/* 자재 공급처 → 연락처 자동 입력 */
function setupMfSupplierAutoPhone(){
  const mfSupplier=document.getElementById('mf_supplier');
  if(mfSupplier && !mfSupplier._autoPhoneInited){
    mfSupplier._autoPhoneInited=true;
    mfSupplier.addEventListener('input', ()=>{
      const name=(mfSupplier.value||'').trim().toLowerCase();
      if(!name) return;
      const pv=vendors.find(v=>(v.name||'').toLowerCase()===name);
      const cv=_cmVendors.find(v=>(v.name||'').toLowerCase()===name);
      const found=pv||cv;
      const contactEl=document.getElementById('mf_contact');
      if(found&&found.phone&&contactEl&&!contactEl.value.trim()) contactEl.value=found.phone;
    });

    // Tab 자동완성
    mfSupplier.addEventListener('keydown', e=>{
      if(e.key!=='Tab') return;
      const allNames=[...vendors,..._cmVendors].map(v=>v.name||'').filter(Boolean);
      const v=mfSupplier.value.trim().toLowerCase();
      if(!v) return;
      const match=allNames.find(n=>n.toLowerCase().startsWith(v));
      if(match && match!==mfSupplier.value){ e.preventDefault(); mfSupplier.value=match; mfSupplier.dispatchEvent(new Event('input')); }
    });
  }
}

/* ── 검색창 표준 스타일 (동적 렌더 후 적용) ── */
function applyStdSearchStyle(inputId){
  const el=document.getElementById(inputId); if(!el) return;
  if(el._stdStyled) return; el._stdStyled=true;
  const wrap=el.parentElement;
  if(!wrap.style.position) wrap.style.position='relative';
  // 🔍 아이콘 삽입
  if(!wrap.querySelector('.std-search-icon')){
    const ic=document.createElement('span');
    ic.className='std-search-icon';
    ic.textContent='🔍';
    wrap.insertBefore(ic, el);
  }
  el.style.cssText+='padding-left:44px;height:48px;font-size:15px;font-weight:600;'+
    'border:2.5px solid var(--primary,#7d8fd0);border-radius:14px;'+
    'background:#f0f6ff;box-shadow:0 2px 12px rgba(63,124,184,.15);width:100%;box-sizing:border-box;';
}

/* ── 모달 열릴 때 드롭존+자동입력 활성화 ── */
const _origOpenModal = window.openModal;
window.openModal = function(id){
  _origOpenModal(id);
  requestAnimationFrame(()=>{
    if(id==='entryModal'){
      initDropZone('ef_dropZone','ef_dropPreview','_efDropFiles');
      setupVendorAutoPhone();
    }
    if(id==='materialModal'){
      initDropZone('mf_dropZone','mf_dropPreview','_mfDropFiles');
      setupMfSupplierAutoPhone();
    }
    if(id==='worklogModal'){
      initDropZone('wl_dropZone','wl_dropPreview','_wlDropFiles');
    }
    if(id==='todoModal'){
      initDropZone('td_dropZone','td_dropPreview','_tdDropFiles');
    }
  });
};

/* ── ef_vendor에 Tab 자동완성 (비용수정 모달) ── */
document.addEventListener('DOMContentLoaded', ()=>{
  ['ce_vendor','qf_vendor','wl_vendor'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('keydown', e=>{
      if(e.key!=='Tab') return;
      const dl=document.getElementById('vendorList'); if(!dl) return;
      const v=el.value.trim().toLowerCase(); if(!v) return;
      const match=Array.from(dl.options).find(o=>o.value.toLowerCase().startsWith(v));
      if(match&&match.value!==el.value){ e.preventDefault(); el.value=match.value; el.dispatchEvent(new Event('input')); }
    });
    // 거래처 → 전화번호 자동
    if(id==='ce_vendor'){
      el.addEventListener('input', ()=>fillPhoneFromVendor('ce_vendor','ce_phone'));
    }
  });
});
