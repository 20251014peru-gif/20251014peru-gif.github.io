/* ============================================================
   부동산 프로젝트 관리 v3.0
   - 파일 분리(HTML/CSS/JS)
   - USD↔KRW 환율 자동 환산
   - 모든 셀렉트 "+ 직접 추가" 옵션 시스템 (Firestore: realestate_options)
   - 자재 재고 + 사용 이력
   - 견적 비교, 부동산 방문 관리
   - 주말 빠른 입력 (가스/톨비/식비 세트)
   - 백업/복원
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
const PROJECTS="realestate_projects", ENTRIES="realestate_entries",
      VENDORS="realestate_vendors", MATERIALS="realestate_materials",
      QUOTES="realestate_quotes", AGENTS="realestate_agents",
      OPTIONS="realestate_options";
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
  kinds:["자재비","공사비","사진","연락","서류","문제","메모","기타비용"],
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
    "자재 관련","하자·문제","계약·잔금 현장","참고 사진","기타 사진"
  ],
  doc_folders:[
    "매매계약서","등기 관련 서류","세금계산서","영수증·이체확인증",
    "취득세·세금 납부","관리비·공과금","대출 서류","인감·신분 서류",
    "견적서·계약서(공사)","양도소득세 자료","기타 서류"
  ],
  mat_spaces:["거실","주방","안방","작은방","드레스룸","욕실(공용)","욕실(안방)","현관","발코니/베란다","복도","전체/공용","기타"],
  mat_cats:["타일","도배(벽지)","바닥재(마루/장판)","페인트/도장","필름","싱크대/주방가구","붙박이장/가구","조명/등기구","스위치/콘센트","위생기구(양변기/세면대)","수전/밸브","문/도어","창호/샷시","몰딩/걸레받이","실리콘/방수","단열/보온재","목자재(합판/석고)","철물/하드웨어","기타"],
  mat_units:["EA(개)","㎡","평","m(미터)","box(박스)","롤","통","set(세트)","장","자","포","말"]
};

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
/* 옵션 추가 모달 */
let _addOptKey=null, _addOptTarget=null;
function openAddOpt(optKey, selectId){
  _addOptKey=optKey; _addOptTarget=selectId;
  document.getElementById("addOptTitle").textContent="새 옵션 추가";
  document.getElementById("addOptHint").textContent= optKey.startsWith('stage_cat_')
    ? ('"'+optKey.replace('stage_cat_','')+'" 공정의 세부 항목을 추가합니다.')
    : OPT_LABELS[optKey] ? (OPT_LABELS[optKey]+"에 항목을 추가합니다.") : "이 목록에 항목을 추가합니다.";
  document.getElementById("addOptInput").value="";
  openModal("addOptModal");
  setTimeout(()=>document.getElementById("addOptInput").focus(),120);
}
async function confirmAddOpt(){
  const v=document.getElementById("addOptInput").value.trim();
  if(!v){ alert("이름을 입력하세요."); return; }
  if(!userOpts[_addOptKey]) userOpts[_addOptKey]=[];
  if(!userOpts[_addOptKey].includes(v) && !opts(_addOptKey).includes(v)){
    userOpts[_addOptKey].push(v);
    await saveUserOpts(_addOptKey);
  }
  // 호출한 셀렉트를 새 옵션이 선택된 상태로 다시 채움
  if(_addOptTarget){
    const sel=document.getElementById(_addOptTarget);
    if(sel){
      const headOpt = sel.options[0] && sel.options[0].value==="" ? sel.options[0].text : null;
      buildOptSelect(_addOptTarget, _addOptKey, v, headOpt);
      // 셀렉트가 onchange를 트리거해서 의존 셀렉트를 갱신할 수 있게 이벤트 발생
      sel.dispatchEvent(new Event('change'));
    }
  }
  closeModal("addOptModal");
}
/* 카테고리별 한글 라벨 (옵션 모달 안내 문구용) */
const OPT_LABELS={
  stages:"공정 단계", kinds:"기록 종류", pays:"결제 수단",
  etc_cats:"기타 비용 항목", vendor_roles:"업체 공종/역할",
  photo_folders:"사진 폴더", doc_folders:"서류 폴더",
  mat_spaces:"자재 공간", mat_cats:"자재 분류", mat_units:"자재 단위"
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
let entries=[], vendors=[], materials=[], quotes=[], agents=[];
let activeTab="대시보드";
let costFilter={stage:"전체",kind:"전체",pay:"전체",q:""};
let searchQ="";
let chatHistory=[];

/* ===== 유틸 ===== */
function val(id){return document.getElementById(id).value;}
function today(){return new Date().toISOString().slice(0,10);}
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
    window._quoteSort={key:"krw",dir:1}; window._agentSort={key:"visits",dir:-1};
  }
  currentProjectId=id;
  await reloadCurrent();
}
async function reloadCurrent(){
 try{
  renderProjectList();
  const id=currentProjectId; if(!id) return;
  const [eSnap,vSnap,mSnap,qSnap,aSnap]=await Promise.all([
    db.collection(ENTRIES).where("projectId","==",id).get(),
    db.collection(VENDORS).where("projectId","==",id).get(),
    db.collection(MATERIALS).where("projectId","==",id).get(),
    db.collection(QUOTES).where("projectId","==",id).get(),
    db.collection(AGENTS).where("projectId","==",id).get()
  ]);
  entries=eSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  vendors=vSnap.docs.map(d=>({id:d.id,...d.data()}));
  materials=mSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  quotes=qSnap.docs.map(d=>({id:d.id,...d.data()}));
  agents=aSnap.docs.map(d=>({id:d.id,...d.data()}));
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
  const tabs=["대시보드","공정","자재","비용","견적·부동산","주말 비용","사진","업체·연락","서류","검색"];
  main.innerHTML=`
    <div class="proj-head">
      <div><h2>${esc(p.name)}</h2>
        <div class="sub">${esc(p.address||'')} ${p.startDate?'· 시작 '+p.startDate:''}</div></div>
      <div class="acts">
        <button class="btn btn-line btn-sm" onclick="openProjectModal('${p.id}')">✏ 정보 수정</button>
        <button class="btn btn-primary btn-sm" onclick="openEntryModal()">+ 기록 추가</button>
      </div>
    </div>
    <div class="tabs">
      ${tabs.map(t=>`<button class="tab ${t===activeTab?'active':''}" onclick="setTab('${t}')">${tabIcon(t)} ${t}</button>`).join("")}
    </div>
    <div id="tabContent"></div>`;
  renderTab(p);
}
function tabIcon(t){return {"대시보드":"📊","공정":"🔨","자재":"🧱","비용":"💰","견적·부동산":"📞","주말 비용":"🚗","사진":"📷","업체·연락":"📇","서류":"📁","검색":"🔍"}[t]||"";}
function setTab(t){activeTab=t; renderMain();}
function renderTab(p){
  try{
    const c=document.getElementById("tabContent");
    const map={
      "대시보드":viewDashboard,"공정":viewStages,"자재":viewMaterials,"비용":viewCost,
      "견적·부동산":viewQuotesAgents,"주말 비용":viewWeekend,"사진":viewPhotos,
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
    return `<div class="logrow">
      <span class="lr-tag">${esc(kindTag)}</span>
      <span class="lr-title">${esc(e.title)}</span>
      <span class="lr-vendor">${esc(e.vendor||'')}</span>
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
  const tags=[
    e.kind==="문제"?`<span class="l-tag 문제">문제·하자</span>`:'',
    e.kind==="사진"?`<span class="l-tag 사진">사진</span>`:'',
    e.kind==="자재비"?`<span class="l-tag">자재비</span>`:'',
    e.kind==="공사비"?`<span class="l-tag">공사비</span>`:'',
    e.kind==="기타비용"?`<span class="l-tag">${esc(e.cat||'기타비용')}${e.sub?' · '+esc(e.sub):''}</span>`:'',
    e.kind==="연락"?`<span class="l-tag">연락</span>`:'',
    e.kind==="서류"?`<span class="l-tag">서류</span>`:'',
    e.kind==="메모"?`<span class="l-tag">메모</span>`:'',
    e.stage?`<span class="l-tag 공정">${esc(e.stage)}</span>`:'',
    ((e.kind==="자재비"||e.kind==="공사비")&&e.cat)?`<span class="l-tag">${esc(e.cat)}</span>`:'',
    (e.pay&&e.amount)?`<span class="l-tag">${esc(e.pay)}</span>`:'',
    (e.currency==="USD")?`<span class="l-tag" style="background:#e7eafb;color:var(--blue)">USD $${Number(e.amountOrig||0).toLocaleString()}</span>`:''
  ].join("");
  const editBtn = (opts.noEdit||!(e.kind==="자재비"||e.kind==="공사비"||e.kind==="기타비용"))? '' : `<button class="l-del" style="color:var(--accent)" onclick="editCost('${e.id}')">수정</button>`;
  const delBtn = opts.noDelete? '' : `<button class="l-del" onclick="deleteEntry('${e.id}')">삭제</button>`;
  return `<div class="log">
    <div class="l-top">${tags}<span class="l-title">${esc(e.title)}</span><span class="l-date">${e.date||''}</span>${editBtn}${delBtn}</div>
    ${(e.vendor||e.amount)?`<div class="l-meta">${e.vendor?'거래처 '+esc(e.vendor):''}${e.vendor&&e.amount?' · ':''}${e.amount?'<b>'+Number(e.amount).toLocaleString()+'원</b>':''}</div>`:''}
    ${e.memo?`<div class="l-memo">${esc(e.memo)}</div>`:''}
    ${files?`<div class="files">${files}</div>`:''}</div>`;
}
function renderVendor(v,spent){
  return `<div class="vendor">
    <span class="vtrade">${esc(v.trade||'기타')}</span>
    <div><div class="vname">${esc(v.name)}</div>${v.memo?`<div class="vmemo">${esc(v.memo)}</div>`:''}${spent?`<div class="vspent">지출 ${spent.toLocaleString()}원</div>`:''}</div>
    <div class="vright"><a class="tel" href="tel:${(v.phone||'').replace(/[^0-9+]/g,'')}">${esc(v.phone||'')}</a>
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
(async function init(){
  await loadUserOpts();
  loadFxRate();           // 비동기, 결과는 배지에 반영
  await loadProjects();
})();
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
      ${(unitKRW||m.qty)?`단가 <b>${unitKRW?unitKRW.toLocaleString():'-'}</b>원${m.currency==="USD"&&m.unitPrice?` <small>($${Number(m.unitPrice).toLocaleString()})</small>`:''} × 수량 <b>${m.qty?Number(m.qty).toLocaleString():'-'}</b>${m.unit?' '+esc(m.unit):''}<br>`:''}
      ${stockShow?`📦 재고 <span class="mat-stock ${stockClass(m)}">${Number(m.stock).toLocaleString()}${m.unit?esc(m.unit):''}</span>${m.stockLoc?' · '+esc(m.stockLoc):''}<br>`:''}
      ${m.supplier?`공급처 <b>${esc(m.supplier)}</b>`:''}${m.supplier&&m.contact?' · ':''}${m.contact?`<a href="tel:${(m.contact||'').replace(/[^0-9+]/g,'')}" style="color:var(--accent);text-decoration:none">${esc(m.contact)}</a>`:''}
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
    if(fi && fi.files.length){
      for(let i=0;i<fi.files.length;i++){ showUploading("사진 올리는 중… ("+(i+1)+"/"+fi.files.length+")"); newFiles.push(await processFile(fi.files[i])); }
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
  const byEtc={}; withAmt.filter(e=>e.kind==="기타비용").forEach(e=>{const k=e.cat||"기타"; byEtc[k]=(byEtc[k]||0)+Number(e.amount);});
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
    <div class="panel"><div class="panel-h">🧾 비용 입력 <span class="cnt">엑셀·빠른입력·반복·주말세트</span></div>
      <div class="panel-body" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="openExcelImport()">📥 엑셀 가져오기</button>
        <button class="btn btn-ghost btn-sm" onclick="openWeekend()">🚗 주말 세트 입력</button>
        <button class="btn btn-ghost btn-sm" onclick="openQuickEtc()">⚡ 빠른 연속 입력</button>
        <button class="btn btn-ghost btn-sm" onclick="openRepeatEtc()">🔁 반복 비용 생성</button>
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
        <button class="mini-chip ${(window._costView||'card')==='card'?'on':''}" onclick="window._costView='card';renderTab(projects.find(x=>x.id===currentProjectId))">카드형</button>
        <button class="mini-chip ${window._costView==='list'?'on':''}" onclick="window._costView='list';renderTab(projects.find(x=>x.id===currentProjectId))">목록형</button>
      </span></div><div class="panel-body">
      <div class="filterbar">
        <select onchange="costFilter.stage=this.value;renderTab(projects.find(x=>x.id===currentProjectId))">${stageOptsHtml}</select>
        <select onchange="costFilter.kind=this.value;renderTab(projects.find(x=>x.id===currentProjectId))">
          ${["전체","자재비","공사비","기타비용"].map(k=>`<option ${costFilter.kind===k?'selected':''}>${k}</option>`).join("")}</select>
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
  if(window._costView==='list'){
    const head=`<div class="logrow head"><span class="lr-tag">분류</span><span class="lr-title">항목</span><span class="lr-vendor">거래처</span><span class="lr-amt">금액</span><span class="lr-date">날짜</span><span style="width:84px"></span></div>`;
    return head+list.map(e=>renderLog(e,{compact:true})).join("");
  }
  return list.map(e=>renderLog(e)).join("");
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
      <div class="hint" style="margin-bottom:10px">‘방문 +1’로 데려온 손님을 기록합니다. 많이 데려온 순으로 자동 정렬돼, 실적 좋은 부동산 위주로 관리할 수 있습니다.</div>
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
      <td>${esc(q.vendor||'')}${q.phone?`<br><a href="tel:${(q.phone||'').replace(/[^0-9+]/g,'')}" style="color:var(--accent);text-decoration:none;font-size:12px">${esc(q.phone)}</a>`:''}</td>
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
function agentVisits(a){ return (a.visits||[]).reduce((s,v)=>s+(Number(v.count)||0),0); }
function sortAgents(key){
  const s=window._agentSort||{key:"visits",dir:-1};
  if(s.key===key) s.dir=-s.dir; else { s.key=key; s.dir=-1; }
  window._agentSort=s; renderTab(projects.find(x=>x.id===currentProjectId));
}
function aSortHeader(label,key,cur){
  const on=cur.key===key; const ic=on?(cur.dir>0?'▲':'▼'):'⇅';
  return `<th class="sortable" onclick="sortAgents('${key}')">${esc(label)}<span class="sort-ic">${ic}</span></th>`;
}
function renderAgentTable(){
  if(!agents.length) return '<div class="ai-empty">등록된 부동산이 없습니다. ‘+ 부동산 추가’로 입력하세요.</div>';
  const s=window._agentSort||{key:"visits",dir:-1};
  const getv={
    name:a=>a.name||"", visits:a=>agentVisits(a),
    last:a=>{ const vs=(a.visits||[]).map(v=>v.date).sort(); return vs.length?vs[vs.length-1]:""; },
    price:a=>Number(a.price)||0
  }[s.key]||(a=>agentVisits(a));
  let rows=agents.slice();
  rows.sort((a,b)=>{ const va=getv(a), vb=getv(b);
    if(typeof va==='number') return (va-vb)*s.dir;
    return String(va).localeCompare(String(vb))*s.dir; });
  const body=rows.map((a,i)=>{
    const tv=agentVisits(a);
    const vs=(a.visits||[]).map(v=>v.date).sort();
    const last=vs.length?vs[vs.length-1]:"";
    const rankCls = (s.key==='visits'&&s.dir<0&&i<3&&tv>0)?'top':'';
    return `<tr>
      <td><span class="agent-rank ${rankCls}">${i+1}</span></td>
      <td><b>${esc(a.name||'')}</b>${a.agent?`<br><span class="hint">${esc(a.agent)}</span>`:''}</td>
      <td>${a.phone?`<a href="tel:${(a.phone||'').replace(/[^0-9+]/g,'')}" style="color:var(--accent);text-decoration:none">${esc(a.phone)}</a>`:''}</td>
      <td class="num">${a.price?Number(a.price).toLocaleString()+'만':''}</td>
      <td><span class="visit-pill ${tv?'':'zero'}">${tv}명</span>${a.visits&&a.visits.length?`<br><span class="hint">${a.visits.length}회</span>`:''}</td>
      <td>${last||'<span class="hint">방문 없음</span>'}</td>
      <td>
        <button class="lr-btn" onclick="openVisit('${a.id}')">방문 +</button>
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
      ${aSortHeader('내놓은가','price',s)}
      ${aSortHeader('데려온 인원','visits',s)}
      ${aSortHeader('최근 방문','last',s)}
      <th></th>
    </tr></thead><tbody>${body}</tbody></table></div>`;
}
function openAgentModal(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  document.getElementById("agentModalTitle").textContent="부동산 추가";
  document.getElementById("af_id").value="";
  ["af_name","af_agent","af_phone","af_price","af_memo"].forEach(id=>document.getElementById(id).value="");
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
  document.getElementById("af_memo").value=a.memo||"";
  openModal("agentModal");
}
async function saveAgent(){
  const name=val("af_name").trim(), phone=val("af_phone").trim();
  if(!name){alert("부동산 이름을 입력하세요.");return;}
  if(!phone){alert("전화번호를 입력하세요.");return;}
  const data={projectId:currentProjectId,name,agent:val("af_agent").trim(),phone,
    price:val("af_price")?Number(val("af_price")):null,memo:val("af_memo").trim()};
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
  document.getElementById("vs_hint").textContent=(a.name||"")+" — 지금까지 "+agentVisits(a)+"명 데려옴 ("+((a.visits||[]).length)+"회)";
  document.getElementById("vs_date").value=today();
  document.getElementById("vs_count").value="1";
  document.getElementById("vs_memo").value="";
  openModal("visitModal");
}
async function saveVisit(){
  const id=document.getElementById("vs_id").value;
  const a=agents.find(x=>x.id===id); if(!a) return;
  const count=Number(val("vs_count"))||1;
  const visit={date:val("vs_date")||today(), count, memo:val("vs_memo").trim()};
  const visits=(a.visits||[]).concat([visit]);
  try{
    await db.collection(AGENTS).doc(id).update({visits});
    closeModal("visitModal"); await reloadCurrent();
  }catch(err){ showError("방문 기록", err); }
}

/* ===== 주말 빠른 입력 (가스/톨비/식비 세트) ===== */
let _wkDates=[]; // [{date, rows:{...}}]
const WK_MEAL=["아침","점심","저녁","간식"];
function openWeekend(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  _wkDates=[];
  // 가장 가까운 토요일을 기본으로
  const d=new Date(); const day=d.getDay();
  const sat=new Date(d); sat.setDate(d.getDate()+((6-day+7)%7));
  document.getElementById("wk_date").value=today();
  addWkDate(sat.toISOString().slice(0,10));
  openModal("weekendModal");
}
function syncWeekendDates(){ /* placeholder: 단일 날짜 입력칸은 '추가' 버튼 대용 */ }
function addWkDate(dateStr){
  const ds=dateStr||val("wk_date")||today();
  if(_wkDates.some(x=>x.date===ds)) return;
  _wkDates.push({date:ds});
  renderWeekend();
}
function removeWkDate(ds){ _wkDates=_wkDates.filter(x=>x.date!==ds); renderWeekend(); }
function weekendDayHtml(item){
  const ds=item.date;
  const dow=["일","월","화","수","목","금","토"][new Date(ds+"T00:00:00").getDay()];
  const mealRows=WK_MEAL.map(meal=>{
    const homemade = meal==="간식";
    return `<div class="wk-row" data-d="${ds}" data-g="식비" data-k="${meal}">
      <span class="wk-lab">${meal}</span>
      <input type="text" class="wk-memo" placeholder="${meal==='간식'?'예: 집에서 김밥 준비':'장소/메뉴'}">
      <select class="wk-pay">${opts("pays").map(p=>`<option ${p==='현금'?'selected':''}>${esc(p)}</option>`).join("")}</select>
      <input type="number" class="wk-amt" placeholder="${homemade?'0 가능':'금액'}">
    </div>`;
  }).join("");
  const tollRows=["상행","하행"].map(dir=>`
    <div class="wk-row" data-d="${ds}" data-g="톨비(통행료)" data-k="${dir}">
      <span class="wk-lab">톨비 ${dir}</span>
      <input type="text" class="wk-memo" placeholder="노선(선택)">
      <select class="wk-pay">${opts("pays").map(p=>`<option ${p==='카드'?'selected':''}>${esc(p)}</option>`).join("")}</select>
      <input type="number" class="wk-amt" placeholder="금액">
    </div>`).join("");
  const gasRows=["상행","하행","충전"].map(dir=>`
    <div class="wk-row" data-d="${ds}" data-g="교통/주유비" data-k="${dir}">
      <span class="wk-lab">주유/가스 ${dir}</span>
      <input type="text" class="wk-memo" placeholder="주유소(선택)">
      <select class="wk-pay">${opts("pays").map(p=>`<option ${p==='카드'?'selected':''}>${esc(p)}</option>`).join("")}</select>
      <input type="number" class="wk-amt" placeholder="금액">
    </div>`).join("");
  return `<div class="wk-day">
    <h4>📅 ${ds} (${dow}) <button class="wk-remove" onclick="removeWkDate('${ds}')">날짜 제거</button></h4>
    <div class="wk-section"><div class="wk-section-title">🍚 식비 (아침·점심·저녁·간식 / 간식은 집에서 준비 시 0원·메모만)</div>${mealRows}</div>
    <div class="wk-section"><div class="wk-section-title">🛣 톨비 (상행/하행)</div>${tollRows}</div>
    <div class="wk-section"><div class="wk-section-title">⛽ 주유·가스 (상행/하행/충전)</div>${gasRows}</div>
  </div>`;
}
function renderWeekend(){
  const dateChips=_wkDates.map(it=>`<span class="mini-chip on">${it.date} ✕ <a href="#" onclick="removeWkDate('${it.date}');return false;" style="color:inherit;text-decoration:none">제거</a></span>`).join("")
    + `<button class="btn btn-ghost btn-sm" onclick="addWkDate()">+ 위 날짜 추가</button>`;
  document.getElementById("wk_dates").innerHTML=dateChips;
  document.getElementById("wk_grid").innerHTML=_wkDates.length? _wkDates.map(weekendDayHtml).join("") : '<div class="ai-empty">날짜를 추가하세요. (날짜 입력 후 ‘위 날짜 추가’)</div>';
}
async function saveWeekendSet(){
  // 그리드에서 금액>0 또는 (간식+메모있음) 인 행만 수집
  const rows=[...document.querySelectorAll('#wk_grid .wk-row')];
  const toSave=[];
  rows.forEach(r=>{
    const d=r.getAttribute('data-d'), g=r.getAttribute('data-g'), k=r.getAttribute('data-k');
    const memo=(r.querySelector('.wk-memo')||{}).value||"";
    const pay=(r.querySelector('.wk-pay')||{}).value||"현금";
    const amt=Number((r.querySelector('.wk-amt')||{}).value||0);
    const homemade = (g==="식비" && k==="간식" && amt===0 && memo.trim());
    if(amt>0 || homemade){
      const titleParts=[g==="식비"?k:(g.replace(/\(.*?\)/,'')+" "+k)];
      if(memo.trim()) titleParts.push(memo.trim());
      toSave.push({
        projectId:currentProjectId, kind:"기타비용",
        title:titleParts.join(' - '), date:d, stage:null, cat:g, sub:k,
        vendor:"", amount:amt||0, pay, memo: homemade?("집에서 준비 / "+memo.trim()):memo.trim(),
        files:[]
      });
    }
  });
  if(!toSave.length){ alert("저장할 항목이 없습니다. 금액을 입력하거나, 간식에 '집에서 준비' 메모를 남기세요."); return; }
  const btn=document.getElementById("wk_save"); btn.disabled=true; btn.textContent="저장 중...";
  try{
    const batch=db.batch();
    toSave.forEach(o=>{ const ref=db.collection(ENTRIES).doc(); batch.set(ref, Object.assign({},o,{createdAt:firebase.firestore.FieldValue.serverTimestamp()})); });
    await batch.commit();
    btn.disabled=false; btn.textContent="한 번에 저장";
    closeModal("weekendModal");
    alert(toSave.length+"건을 저장했습니다.");
    await reloadCurrent();
  }catch(err){ btn.disabled=false; btn.textContent="한 번에 저장"; showError("주말 세트 저장", err); }
}
/* 주말 비용 탭 (요약 + 빠른 진입) */
function viewWeekend(p){
  const wk=entries.filter(e=>e.kind==="기타비용" && ["식비","톨비(통행료)","교통/주유비","가스충전비"].includes(e.cat));
  const total=wk.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const byCat={}; wk.forEach(e=>{const k=e.cat||"기타"; byCat[k]=(byCat[k]||0)+(Number(e.amount)||0);});
  const catRows=Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]).map(k=>barRow(k,byCat[k],total)).join("");
  // 날짜별 묶음
  const byDate={}; wk.forEach(e=>{ (byDate[e.date]=byDate[e.date]||[]).push(e); });
  const dates=Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
  const dateBlocks=dates.slice(0,12).map(d=>{
    const list=byDate[d]; const sum=list.reduce((s,e)=>s+(Number(e.amount)||0),0);
    const dow=["일","월","화","수","목","금","토"][new Date(d+"T00:00:00").getDay()];
    return `<div class="ph-group"><div class="ph-gh"><b>${d} (${dow})</b> <span class="cnt">${list.length}건 · ${sum.toLocaleString()}원</span></div>
      ${list.map(e=>renderLog(e,{compact:true})).join("")}</div>`;
  }).join("");
  return `
    <div class="stats">
      <div class="stat"><div class="label">주말 비용 합계</div><div class="value">${total.toLocaleString()}<small> 원</small></div></div>
      <div class="stat"><div class="label">기록 건수</div><div class="value">${wk.length}<small> 건</small></div></div>
      <div class="stat"><div class="label">이동 일수</div><div class="value">${dates.length}<small> 일</small></div></div>
      <div class="stat"><div class="label">하루 평균</div><div class="value">${dates.length?Math.round(total/dates.length).toLocaleString():0}<small> 원</small></div></div>
    </div>
    <div class="panel"><div class="panel-h">🚗 주말 출퇴근 비용 <span class="cnt">가스·톨비·식비</span>
      <button class="btn btn-primary btn-sm add" onclick="openWeekend()">+ 주말 세트 입력</button></div>
      <div class="panel-body">
        <div class="hint">주말마다 반복되는 상행/하행 톨비·주유, 끼니별 식비(집에서 준비 간식 포함)를 한 번에 입력하세요.</div>
        ${total?`<table class="ctable" style="margin-top:10px"><thead><tr><th>항목</th><th class="num">합계(원)</th></tr></thead><tbody>${catRows}<tr class="sum"><td>합계</td><td class="num">${total.toLocaleString()}</td></tr></tbody></table>`:''}
      </div></div>
    <div class="panel"><div class="panel-h">📅 날짜별 주말 비용 <span class="cnt">최근 12일</span></div>
      <div class="panel-body">${dateBlocks||'<div class="ai-empty">아직 주말 비용 기록이 없습니다.</div>'}</div></div>`;
}

/* ===== 사진 ===== */
function photoFolderOf(e){ return e.photoFolder || "기타 사진"; }
function viewPhotos(p){
  const photos=entries.filter(e=>e.kind==="사진" && (e.files||[]).some(f=>(f.type||"").startsWith("image/")));
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
      <button class="btn btn-line btn-sm" onclick="window._photoOpenId=null;window._photoSelMode=false;renderTab(projects.find(x=>x.id===currentProjectId))">← 폴더 목록</button>
      <span style="margin-left:6px">📷 ${esc(cat)}</span><span class="cnt">${all.length}장</span>${toolbar}</div>
      <div class="panel-body">${inCat.length?groups:'<div class="ai-empty">이 폴더에 사진이 없습니다.</div>'}</div></div>`;
  }
  const folders=opts("photo_folders").map(cat=>{
    const inCat=photos.filter(e=>photoFolderOf(e)===cat);
    let cnt=0, cover=null;
    inCat.forEach(e=>(e.files||[]).forEach(f=>{ if((f.type||"").startsWith("image/")){ cnt++; if(!cover)cover=f; }}));
    return `<div class="folder" onclick="window._photoOpenId='${jsstr(cat)}';renderTab(projects.find(x=>x.id===currentProjectId))">
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
      <button class="btn btn-line btn-sm" onclick="window._docOpenId=null;renderTab(projects.find(x=>x.id===currentProjectId))">← 폴더 목록</button>
      <span style="margin-left:6px">📁 ${esc(cat)}</span><span class="cnt">${inCat.length}건</span>
      ${cat!=="체크리스트 첨부"?`<button class="btn btn-ghost btn-sm add" onclick="addDocToFolder('${jsstr(cat)}')">+ 서류 추가</button>`:''}</div>
      <div class="panel-body">${inCat.length?groups:'<div class="ai-empty">이 폴더에 서류가 없습니다.</div>'}</div></div>`;
  }
  const cats=opts("doc_folders").slice();
  if(docs.some(e=>docFolderOf(e)==="체크리스트 첨부")) cats.push("체크리스트 첨부");
  const folders=cats.map(cat=>{
    const inCat=docs.filter(e=>docFolderOf(e)===cat);
    const cnt=inCat.reduce((s,e)=>s+((e.files||[]).length),0);
    return `<div class="folder" onclick="window._docOpenId='${jsstr(cat)}';renderTab(projects.find(x=>x.id===currentProjectId))">
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
function viewSearch(p){
  return `<div class="panel"><div class="panel-h">🔍 통합 검색 <span class="cnt" id="searchCount"></span></div><div class="panel-body">
    <div class="filterbar"><input type="text" id="searchInput" autofocus
      placeholder="제목·메모·거래처·공정·자재·견적 검색 (예: 타일, 김부장)"
      value="${esc(searchQ)}" oninput="onSearchInput(this.value)"></div>
    <div id="searchResult"></div></div></div>`;
}
/* ============================================================
   JS 3/3 — 기록 CRUD · 이미지뷰어 · AI · 빠른입력/엑셀/반복 · 백업 · 프로젝트 · 진단
   ============================================================ */

/* ===== 기록(Entry) ===== */
function onKindChange(){
  const k=val("ef_kind"); const isMoney=(k==="자재비"||k==="공사비"||k==="기타비용");
  show("g_amount",isMoney); show("g_pay",isMoney);
  show("g_photofolder",k==="사진"); show("g_docfolder",k==="서류");
  show("g_stage", k!=="기타비용");
  document.getElementById("g_cat").style.display=isMoney?"block":"none";
  fillCatSelect();
}
function fillStageSelect(preset){
  buildOptSelect("ef_stage","stages",preset||"","(공정 선택 안 함)");
}
function fillCatSelect(){
  const k=val("ef_kind");
  const stage=val("ef_stage");
  const sel=document.getElementById("ef_cat");
  if(k==="기타비용"){
    buildOptSelect("ef_cat","etc_cats","");
    return;
  }
  // 자재비/공사비: 공정별 세부항목 (stage_cat_<stage>). 공정 미선택 시 공통 키 사용
  const key = stage? ("stage_cat_"+stage) : "stage_cat_공통";
  buildOptSelect("ef_cat", key, "");
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
  document.getElementById("vendorList").innerHTML=vendors.map(v=>`<option value="${esc(v.name)}">`).join("");
  fillStageSelect(presetStage||"");
  document.getElementById("ef_stage").onchange=fillCatSelect;
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
  const k=val("ef_kind"); const isMoney=(k==="자재비"||k==="공사비"||k==="기타비용");
  const cur=val("ef_currency")||"KRW";
  const amtOrig= isMoney&&val("ef_amount")?Number(val("ef_amount")):null;
  let amtKRW=amtOrig;
  if(isMoney && cur==="USD" && amtOrig!=null){
    if(!_fxRate){ alert("USD 금액인데 환율이 없습니다. 상단 배지에서 환율을 입력하세요."); return; }
    amtKRW=Math.round(amtOrig*_fxRate);
  }
  const btn=document.getElementById("entrySaveBtn"); btn.disabled=true; btn.textContent="저장 중...";
 try{
  let files=[]; const fi=document.getElementById("ef_files");
  if(fi.files.length){
    for(let i=0;i<fi.files.length;i++){ showUploading("파일 올리는 중… ("+(i+1)+"/"+fi.files.length+")"); files.push(await processFile(fi.files[i])); }
    hideUploading();
  }
  const photoFolder = k==="사진" ? val("ef_photofolder") : null;
  const docFolder = k==="서류" ? val("ef_docfolder") : null;
  await db.collection(ENTRIES).add({
    projectId:currentProjectId, kind:k, title, date:val("ef_date"),
    stage:(k!=="기타비용"&&val("ef_stage"))?val("ef_stage"):null,
    cat:isMoney?val("ef_cat"):null,
    photoFolder, docFolder,
    vendor:val("ef_vendor").trim(),
    amount: isMoney? (amtKRW||null) : null,
    amountOrig: (isMoney&&cur==="USD")?amtOrig:null,
    currency: isMoney?cur:null,
    fxRate: (isMoney&&cur==="USD")?_fxRate:null,
    pay:isMoney?val("ef_pay"):null,
    memo:val("ef_memo").trim(), files,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
  if(k==="사진" && files.some(f=>(f.type||"").startsWith("image/"))){ activeTab="사진"; window._photoOpenId=photoFolder; }
  else if(k==="서류" && files.length){ activeTab="서류"; window._docOpenId=docFolder; }
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
function ceFillCat(){
  const k=document.getElementById("ce_kind").value;
  const stage=document.getElementById("ce_stage").value;
  const sel=document.getElementById("ce_cat");
  let list=[];
  if(k==="자재비"||k==="공사비"){ list= stage? opts("stage_cat_"+stage):COMMON_CATS; }
  else { list=opts("etc_cats"); }
  const cur=sel.value;
  sel.innerHTML=list.map(o=>`<option ${o===cur?'selected':''}>${esc(o)}</option>`).join("");
}
function ceKindChange(){
  const k=document.getElementById("ce_kind").value;
  document.getElementById("ce_g_stage").style.display = (k==="자재비"||k==="공사비")?"block":"none";
  ceFillCat();
}
function editCost(id){
  const e=entries.find(x=>x.id===id); if(!e) return;
  document.getElementById("ce_id").value=id;
  document.getElementById("ce_title").value=e.title||"";
  document.getElementById("ce_date").value=e.date||"";
  document.getElementById("ce_amount").value=e.amount!=null?e.amount:"";
  document.getElementById("ce_kind").value=(e.kind==="기타비용")?"기타비용":(e.kind==="공사비"?"공사비":"자재비");
  document.getElementById("ce_stage").innerHTML='<option value="">(미지정)</option>'+opts("stages").map(s=>`<option ${e.stage===s?'selected':''}>${esc(s)}</option>`).join("");
  document.getElementById("ce_vendor").value=e.vendor||"";
  document.getElementById("vendorList").innerHTML=vendors.map(v=>`<option value="${esc(v.name)}">`).join("");
  document.getElementById("ce_pay").innerHTML=opts("pays").map(p=>`<option ${e.pay===p?'selected':''}>${esc(p)}</option>`).join("");
  document.getElementById("ce_memo").value=e.memo||"";
  ceKindChange();
  if(e.cat){ const sel=document.getElementById("ce_cat"); if(![...sel.options].some(o=>o.value===e.cat)){ sel.innerHTML+=`<option>${esc(e.cat)}</option>`; } sel.value=e.cat; }
  openModal("costEditModal");
}
async function saveCostEdit(){
  const id=document.getElementById("ce_id").value;
  const title=document.getElementById("ce_title").value.trim();
  if(!title){ alert("항목명을 입력하세요."); return; }
  const k=document.getElementById("ce_kind").value;
  const upd={
    title, date:document.getElementById("ce_date").value||today(),
    kind:k, amount:Number(document.getElementById("ce_amount").value)||null,
    stage:(k==="자재비"||k==="공사비")?(document.getElementById("ce_stage").value||null):null,
    cat:document.getElementById("ce_cat").value||null,
    vendor:document.getElementById("ce_vendor").value.trim(),
    pay:document.getElementById("ce_pay").value,
    memo:document.getElementById("ce_memo").value.trim()
  };
  try{ await db.collection(ENTRIES).doc(id).update(upd); closeModal("costEditModal"); await reloadCurrent(); }
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

/* ===== 빠른 연속 입력 ===== */
let quickRows=[]; let qeOpt="";
const QE_OPTIONS={
  "식비":["아침","점심","저녁","간식"],
  "톨비(통행료)":["상행","하행"],
  "교통/주유비":["상행","하행","주유"],
  "가스충전비":["상행","하행","충전"]
};
function openQuickEtc(){
  if(!currentProjectId){alert("프로젝트를 먼저 선택하세요.");return;}
  quickRows=[];
  document.getElementById("qe_date").value=today();
  buildOptSelect("qe_cat","etc_cats","");
  document.getElementById("qe_cat").onchange=onQeCatChange;
  buildOptSelect("qe_pay","pays","현금");
  document.getElementById("qe_amount").value=""; document.getElementById("qe_memo").value="";
  onQeCatChange(); renderQuickList(); openModal("quickEtcModal");
}
function onQeCatChange(){
  const cat=val("qe_cat"); const o=QE_OPTIONS[cat];
  const wrap=document.getElementById("qe_optwrap"), box=document.getElementById("qe_opts"), label=document.getElementById("qe_optlabel");
  qeOpt = o? o[0] : "";
  if(o){ label.textContent=(cat==="식비")?"끼니":"방향/구분";
    box.innerHTML=o.map(x=>`<button type="button" class="mini-chip ${x===qeOpt?'on':''}" onclick="setQeOpt('${jsstr(x)}')">${x}</button>`).join(""); wrap.style.display="block";
  } else wrap.style.display="none";
}
function setQeOpt(o){ qeOpt=o; document.querySelectorAll('#qe_opts .mini-chip').forEach(b=>b.classList.toggle('on', b.textContent===o)); }
function addQuickRow(){
  const amount=Number(val("qe_amount")); if(!amount){alert("금액을 입력하세요.");return;}
  quickRows.push({date:val("qe_date"),cat:val("qe_cat"),opt:qeOpt,amount,pay:val("qe_pay"),memo:val("qe_memo").trim()});
  document.getElementById("qe_amount").value=""; document.getElementById("qe_memo").value=""; document.getElementById("qe_amount").focus(); renderQuickList();
}
function removeQuickRow(i){ quickRows.splice(i,1); renderQuickList(); }
function renderQuickList(){
  const box=document.getElementById("quickList");
  if(!quickRows.length){ box.innerHTML='<div class="ai-empty">추가된 항목이 없습니다.</div>'; return; }
  const sum=quickRows.reduce((s,r)=>s+r.amount,0);
  box.innerHTML='<table class="ctable"><tbody>'+quickRows.map((r,i)=>
    `<tr><td>${r.date}</td><td>${esc(r.cat)}${r.opt?' · '+esc(r.opt):''}</td><td class="num">${r.amount.toLocaleString()}원</td><td>${esc(r.pay)}</td><td>${esc(r.memo||'')}</td><td class="num"><button class="l-del" onclick="removeQuickRow(${i})">삭제</button></td></tr>`).join("")
    +`</tbody></table><div style="text-align:right;font-weight:700;margin-top:6px">${quickRows.length}건 · ${sum.toLocaleString()}원</div>`;
}
async function saveQuickEtc(){
  if(!quickRows.length){alert("추가된 항목이 없습니다.");return;}
  const btn=document.getElementById("quickSaveBtn"); btn.disabled=true; btn.textContent="저장 중...";
  try{
    const batch=db.batch();
    quickRows.forEach(r=>{ const ref=db.collection(ENTRIES).doc();
      const t=[r.cat]; if(r.opt) t.push(r.opt); if(r.memo) t.push(r.memo);
      batch.set(ref,{projectId:currentProjectId,kind:"기타비용",title:t.join(' - '),date:r.date,stage:null,cat:r.cat,sub:r.opt||null,vendor:"",amount:r.amount,pay:r.pay,memo:r.memo,files:[],createdAt:firebase.firestore.FieldValue.serverTimestamp()}); });
    await batch.commit();
    btn.disabled=false; btn.textContent="전체 저장"; closeModal("quickEtcModal"); await reloadCurrent();
  }catch(err){ btn.disabled=false; btn.textContent="전체 저장"; showError("빠른 비용 저장", err); }
}

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
  openModal("vendorModal");
}
function editVendor(id){
  const v=vendors.find(x=>x.id===id); if(!v) return;
  editingVendorId=id;
  document.getElementById("vendorModalTitle").textContent="업체 / 연락처 수정";
  buildOptSelect("vf_trade","vendor_roles",v.trade||"");
  document.getElementById("vf_name").value=v.name||""; document.getElementById("vf_phone").value=v.phone||""; document.getElementById("vf_memo").value=v.memo||"";
  openModal("vendorModal");
}
async function saveVendor(){
  const name=val("vf_name").trim(), phone=val("vf_phone").trim();
  if(!name||!phone){alert("업체명과 전화번호를 입력하세요.");return;}
  try{
    const data={projectId:currentProjectId,name,trade:val("vf_trade"),phone,memo:val("vf_memo").trim()};
    if(editingVendorId){ await db.collection(VENDORS).doc(editingVendorId).update(data); }
    else { data.createdAt=firebase.firestore.FieldValue.serverTimestamp(); await db.collection(VENDORS).add(data); }
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
    const [e,v,m,q,a]=await Promise.all([
      db.collection(ENTRIES).where("projectId","==",currentProjectId).get(),
      db.collection(VENDORS).where("projectId","==",currentProjectId).get(),
      db.collection(MATERIALS).where("projectId","==",currentProjectId).get(),
      db.collection(QUOTES).where("projectId","==",currentProjectId).get(),
      db.collection(AGENTS).where("projectId","==",currentProjectId).get()
    ]);
    const all=[...e.docs,...v.docs,...m.docs,...q.docs,...a.docs];
    for(let i=0;i<all.length;i+=400){
      const batch=db.batch();
      all.slice(i,i+400).forEach(d=>batch.delete(d.ref));
      if(i+400>=all.length) batch.delete(db.collection(PROJECTS).doc(currentProjectId));
      await batch.commit();
    }
    if(!all.length){ await db.collection(PROJECTS).doc(currentProjectId).delete(); }
    currentProjectId=null; entries=[]; vendors=[]; materials=[]; quotes=[]; agents=[];
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
    const [e,v,m,q,a]=await Promise.all([
      db.collection(ENTRIES).where("projectId","==",currentProjectId).get(),
      db.collection(VENDORS).where("projectId","==",currentProjectId).get(),
      db.collection(MATERIALS).where("projectId","==",currentProjectId).get(),
      db.collection(QUOTES).where("projectId","==",currentProjectId).get(),
      db.collection(AGENTS).where("projectId","==",currentProjectId).get()
    ]);
    const data={ _type:"realestate-project-backup", _version:3, _exportedAt:new Date().toISOString(),
      options:userOpts,
      project:stripId(p),
      entries:e.docs.map(d=>stripId({id:d.id,...d.data()})),
      vendors:v.docs.map(d=>stripId({id:d.id,...d.data()})),
      materials:m.docs.map(d=>stripId({id:d.id,...d.data()})),
      quotes:q.docs.map(d=>stripId({id:d.id,...d.data()})),
      agents:a.docs.map(d=>stripId({id:d.id,...d.data()}))
    };
    hideUploading();
    downloadJson(data, (p.name||"프로젝트").replace(/[^\w가-힣]/g,"_")+"_백업_"+today()+".json");
  }catch(err){ hideUploading(); showError("프로젝트 백업", err); }
}
async function backupAll(){
  try{
    showUploading("전체 백업 만드는 중…");
    const [pS,eS,vS,mS,qS,aS]=await Promise.all([
      db.collection(PROJECTS).get(), db.collection(ENTRIES).get(), db.collection(VENDORS).get(),
      db.collection(MATERIALS).get(), db.collection(QUOTES).get(), db.collection(AGENTS).get()
    ]);
    const data={ _type:"realestate-full-backup", _version:3, _exportedAt:new Date().toISOString(),
      options:userOpts,
      projects:pS.docs.map(d=>stripId({id:d.id,...d.data()})),
      entries:eS.docs.map(d=>({id:d.id,...d.data()})),
      vendors:vS.docs.map(d=>({id:d.id,...d.data()})),
      materials:mS.docs.map(d=>({id:d.id,...d.data()})),
      quotes:qS.docs.map(d=>({id:d.id,...d.data()})),
      agents:aS.docs.map(d=>({id:d.id,...d.data()}))
    };
    hideUploading();
    downloadJson(data, "부동산_전체백업_"+today()+".json");
  }catch(err){ hideUploading(); showError("전체 백업", err); }
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
async function restoreOneProject(projData, e, v, m, q, a){
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
        await restoreOneProject(data.project, data.entries||[], data.vendors||[], data.materials||[], data.quotes||[], data.agents||[]);
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
            (data.agents||[]).filter(by(proj.id)));
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
  row('info', "현재 데이터", `프로젝트 ${projects.length}개 / 기록 ${entries.length} · 자재 ${materials.length} · 견적 ${quotes.length} · 부동산 ${agents.length} · 업체 ${vendors.length}`);
  row('info', "점검 완료", new Date().toLocaleString('ko-KR'));
}
