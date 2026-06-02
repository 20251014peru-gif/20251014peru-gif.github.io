/* =========================================================
   worklog.js v41 수정 가이드
   
   [수정 1] SCHEMA.call 배열에서 {k:"phone"...} 줄 다음에 추가:
   
   {k:"callField",label:"분야",type:"callfield"},
   
   [수정 2] function fieldHTML(f){ 함수 맨 앞(let inner; 다음)에 추가:

   if(f.type==="callfield"){
     const _cats = (typeof CONTACT_CATS!=="undefined") ? CONTACT_CATS : ["전기","설비","기타"];
     const opts = _cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
     return `<div class="field ${f.full?"full":""}"><label>${esc(f.label||"분야")}</label>
       <div style="display:flex;gap:6px;align-items:stretch">
         <select id="m-${f.k}" style="flex:1">${opts}</select>
         <button type="button" class="btn btn-ghost btn-sm" onclick="openContactCatMgrFromModal()" style="flex:0 0 auto;padding:0 10px" title="분야 추가/삭제">⚙</button>
       </div></div>`;
   }
   
   [수정 3] worklog.js 맨 끝 init(); 바로 위에 아래 전체 코드 붙여넣기
   ========================================================= */
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
  try{
    const lsVal = JSON.parse(localStorage.getItem(CONTACT_CATS_LS)||"null");
    if(Array.isArray(lsVal) && lsVal.length) CONTACT_CATS = lsVal;
  }catch(e){}
  if(!online||!db) return;
  try{
    const snap = await db.collection(CONTACT_CATS_COL).doc("list").get();
    if(snap.exists){
      const d = snap.data();
      if(Array.isArray(d.cats) && d.cats.length){
        CONTACT_CATS = d.cats;
        try{ localStorage.setItem(CONTACT_CATS_LS, JSON.stringify(CONTACT_CATS)); }catch(e){}
      }
    } else {
      await db.collection(CONTACT_CATS_COL).doc("list").set({cats:DEFAULT_CONTACT_CATS, updatedAt:Date.now()});
    }
  }catch(e){ console.warn("contact_cats 로드 실패:", e); }
}

async function saveContactCats(){
  try{ localStorage.setItem(CONTACT_CATS_LS, JSON.stringify(CONTACT_CATS)); }catch(e){}
  if(!online||!db) return;
  try{
    await db.collection(CONTACT_CATS_COL).doc("list").set({cats:CONTACT_CATS, updatedAt:Date.now()});
  }catch(e){ toast("분야 저장 실패: "+(e.message||e)); }
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
const _origCatAddNew = catAddNew;
function catAddNew(){
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
  _origCatAddNew();
}

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
const STAFF_LIST = [
  "조태경","김대환","정지환","마재곤","구자경",
  "배옥식","김태경","한광희","정은지","오희성","차민자","박일월"
];

async function loadContactsCache(){
  if(!online||!db) return;
  try{
    const snap = await db.collection("contacts").get();
    contactsCache = snap.docs.map(d=>({id:d.id,...d.data()}));
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
      results.push({
        label: c.name+(c.person?" / "+c.person:"")+(c.cat?" ["+c.cat+"]":""),
        phone: c.phone||"",
        name: c.name||c.person||""
      });
    }
  });
  // 직원 명단 (이름 매칭)
  STAFF_LIST.forEach(s=>{
    if(s.includes(q) && !results.find(r=>r.name===s)){
      results.push({label: s+" [직원]", phone:"", name:s});
    }
  });
  return results.slice(0,8);
}

/* ── 통화 모달 — 이름 자동완성 + 전화번호 자동 채움 ─────── */
function wireCallNameAutocomplete(){
  const nameEl = $("m-name");
  const phoneEl = $("m-phone");
  if(!nameEl||!phoneEl) return;

  // 기존 드롭다운이 있으면 제거
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
        const h = hits[Number(el.dataset.aci)];
        nameEl.value = h.name;
        if(h.phone && !phoneEl.value.trim()) phoneEl.value = h.phone;
        acBox.style.display = "none";
      });
    });
  };
  nameEl.addEventListener("input", showAC);
  nameEl.addEventListener("focus", showAC);
  nameEl.addEventListener("blur", ()=>setTimeout(()=>{ acBox.style.display="none"; }, 180));
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

/* ── mSave 클릭 인터셉트 (capture phase) ────────────────── */
$("mSave").addEventListener("click", ()=>{
  if(mKind==="call"){
    const name  = ($("m-name" )||{value:""}).value.trim();
    const phone = ($("m-phone")||{value:""}).value.trim();
    const cat   = ($("m-callField")||{value:"기타"}).value||"기타";
    if(phone) _pendingCallContact = {name, phone, cat};
  }
}, true); // capture:true → 기존 저장 핸들러보다 먼저 실행

/* ── openEditor 패치 — call 열릴 때 추가 기능 연결 ─────── */
const _origOpenEditorV41 = openEditor;
function openEditor(kind, id){
  _origOpenEditorV41(kind, id);
  if(kind==="call"){
    setTimeout(()=>{
      wireCallNameAutocomplete();
      // 기존 값으로 분야 복원
      if(id){
        const rec = entries.find(e=>e.id===id);
        const sel = $("m-callField");
        if(rec && sel && rec.callField){
          if(CONTACT_CATS.includes(rec.callField)) sel.value = rec.callField;
        }
      }
    }, 90);
  }
}

/* ── renderCall 테이블에 분야 열 추가 ──────────────────────── */
// (기존 renderCall 함수에 callField 컬럼을 추가로 표시)
const _origRenderCall = renderCall;
function renderCall(){
  _origRenderCall();
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
const _origFieldHTMLV41 = fieldHTML;
function fieldHTML(f){
  if(f.type==="callfield"){
    const opts = CONTACT_CATS.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
    return `<div class="field ${f.full?"full":""}"><label>${esc(f.label||"분야")}</label>
      <div style="display:flex;gap:6px;align-items:stretch">
        <select id="m-${f.k}" style="flex:1">${opts}</select>
        <button type="button" class="btn btn-ghost btn-sm" onclick="openContactCatMgrFromModal()" style="flex:0 0 auto;padding:0 10px" title="분야 추가/삭제">⚙</button>
      </div></div>`;
  }
  return _origFieldHTMLV41(f);
}

/* ── init 패치 ──────────────────────────────────────────── */
const _origInitV41 = init;
async function init(){
  await _origInitV41();
  await Promise.all([loadContactCats(), loadContactsCache()]);
  console.log("✅ v41: contact_cats 로드 완료, contacts 캐시:", contactsCache.length+"건");
}
