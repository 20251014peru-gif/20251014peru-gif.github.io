/* =========================================================
   contacts.html v9 → v10 수정 내용
   
   [수정 1] contacts.html <script> 안에서 CATS 상수 수정:
   
   기존:  const CATS = ["전기","설비",...,"기타"];
   교체:  const DEFAULT_CATS = ["전기","설비",...,"기타"];
          let CATS = DEFAULT_CATS.slice();
   
   [수정 2] 헤더 버튼 영역에 분야 관리 버튼 추가 (HTML):
   <button class="btn btn-ghost btn-sm" id="btnCatMgr">⚙ 분야 관리</button>
   
   [수정 3] init() 함수 안 맨 끝에 추가:
   await loadContactCatsSync();
   
   [수정 4] 아래 전체 코드를 </script> 바로 위에 붙여넣기
   ========================================================= */

/* ── contact_cats Firebase 공유 분야 동기화 ─────────────── */
const CC_COL = "contact_cats";

async function loadContactCatsSync(){
  if(!online || !db) return;
  try{
    const snap = await db.collection(CC_COL).doc("list").get();
    if(snap.exists){
      const d = snap.data();
      if(Array.isArray(d.cats) && d.cats.length){
        CATS = d.cats;
        // 분야 select 갱신
        const sel = document.getElementById("c-cat");
        if(sel) sel.innerHTML = CATS.map(c=>`<option>${c}</option>`).join("");
        // 필터 칩 갱신
        renderChips();
      }
    } else {
      // 최초: 현재 CATS를 Firebase에 저장
      await db.collection(CC_COL).doc("list").set({cats: CATS, updatedAt: Date.now()});
    }
  }catch(e){ console.warn("contact_cats 로드 실패:", e); }
}

async function saveContactCatsSync(){
  try{ localStorage.setItem("ct_contact_cats", JSON.stringify(CATS)); }catch(e){}
  if(!online || !db){
    toast("오프라인 — 분야를 저장할 수 없습니다"); return;
  }
  try{
    await db.collection(CC_COL).doc("list").set({cats: CATS, updatedAt: Date.now()});
    toast("✅ 분야 목록 저장 완료 (worklog와 공유됨)");
  }catch(e){ toast("분야 저장 실패: "+(e.message||e)); }
}

/* ── 분야 관리 모달 ──────────────────────────────────────── */
// 기존 catMgrOverlay가 없으므로 contacts.html에 간단 모달 추가
function openCatManagerModal(){
  // 동적으로 모달 생성 (없으면)
  let modal = document.getElementById("contactsCatModal");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "contactsCatModal";
    modal.className = "overlay";
    modal.innerHTML = `<div class="modal" style="max-width:420px">
      <h3>⚙ 분야 관리 (worklog와 공유)</h3>
      <p style="font-size:12.5px;color:var(--ink-soft);margin-bottom:12px">분야를 추가·삭제할 수 있습니다. 저장하면 업무일지(worklog)와 공유됩니다.</p>
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <input type="text" id="ccNewCat" placeholder="새 분야 이름" style="flex:1;font-size:15px;border:1px solid var(--line);border-radius:10px;padding:10px 12px">
        <button class="btn btn-primary btn-sm" onclick="ccAddCat()">➕ 추가</button>
      </div>
      <div id="ccCatList" style="max-height:320px;overflow:auto;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-primary" onclick="ccSaveAndClose()">저장</button>
        <button class="btn btn-ghost" onclick="document.getElementById('contactsCatModal').classList.remove('show')">취소</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e=>{ if(e.target===modal) modal.classList.remove("show"); });
  }
  renderCCList();
  modal.classList.add("show");
}

function renderCCList(){
  const box = document.getElementById("ccCatList"); if(!box) return;
  box.innerHTML = CATS.map((c,i)=>`
    <div style="display:flex;align-items:center;gap:7px;padding:8px 4px;border-bottom:1px solid var(--bg2)">
      <span style="flex:1;font-size:15px">${esc(c)}</span>
      <button onclick="ccMove(${i},-1)" style="background:none;border:1px solid var(--line);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:13px">▲</button>
      <button onclick="ccMove(${i},1)" style="background:none;border:1px solid var(--line);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:13px">▼</button>
      <button onclick="ccDel(${i})" style="background:none;border:1px solid var(--peach-soft);color:var(--peach);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:13px">🗑</button>
    </div>`).join("");
}

function ccMove(i, dir){
  const j=i+dir; if(j<0||j>=CATS.length) return;
  [CATS[i],CATS[j]]=[CATS[j],CATS[i]]; renderCCList();
}
function ccDel(i){
  if(!confirm(`"${CATS[i]}" 분야를 삭제할까요?`)) return;
  CATS.splice(i,1); renderCCList();
}
function ccAddCat(){
  const inp=document.getElementById("ccNewCat"); if(!inp) return;
  const v=inp.value.trim(); if(!v){ toast("분야 이름을 입력하세요"); return; }
  if(CATS.includes(v)){ toast("이미 있는 분야입니다"); return; }
  CATS.push(v); inp.value=""; renderCCList(); toast(`"${v}" 추가됨`);
}
async function ccSaveAndClose(){
  document.getElementById("contactsCatModal").classList.remove("show");
  await saveContactCatsSync();
  // UI 전체 갱신
  const sel=document.getElementById("c-cat");
  if(sel) sel.innerHTML=CATS.map(c=>`<option>${c}</option>`).join("");
  renderChips(); render();
}

// btnCatMgr 버튼 연결
document.addEventListener("DOMContentLoaded", ()=>{
  const btn=document.getElementById("btnCatMgr");
  if(btn) btn.addEventListener("click", openCatManagerModal);
});
