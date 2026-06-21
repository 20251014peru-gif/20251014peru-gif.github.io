/* =====================================================
   worklog v44 PATCH — expense_link_patch.js v3
   업무 모달 지출 연동 — 단순하고 안정적인 방식
   ===================================================== */

(function () {
  'use strict';

  const AREA_ID = 'wl-exp-area';
  let _editId = null;

  /* ── 지출 입력 영역 생성 ── */
  function makeArea() {
    const d = document.createElement('div');
    d.id = AREA_ID;
    d.style.cssText = 'margin-top:14px;padding:14px;background:#fff8f0;border:2px solid #f39c12;border-radius:14px;display:none';
    d.innerHTML = `
      <div style="font-size:13px;font-weight:800;color:#c0720a;margin-bottom:12px">💰 지출 내역</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:3px">업체명</label>
          <input id="ex-v" type="text" placeholder="예: 한국전기" style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;outline:none"></div>
        <div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:3px">자재명</label>
          <input id="ex-m" type="text" placeholder="예: 형광등" style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;outline:none"></div>
        <div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:3px">규격/사양</label>
          <input id="ex-s" type="text" placeholder="예: 36W" style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;outline:none"></div>
        <div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:3px">수량</label>
          <input id="ex-q" type="number" placeholder="" min="0" style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;outline:none;text-align:right"></div>
        <div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:3px">단가 (원)</label>
          <input id="ex-p" type="number" placeholder="" min="0" style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;outline:none;text-align:right"></div>
        <div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:3px">합계 (원)</label>
          <input id="ex-t" type="number" placeholder="" min="0" style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;outline:none;text-align:right;font-weight:700;color:#c0720a"></div>
      </div>
      <div style="margin-top:8px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:3px">비고</label>
        <input id="ex-n" type="text" placeholder="간단한 메모" style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;outline:none"></div>`;

    /* 단가×수량 자동계산 */
    d.querySelector('#ex-q').addEventListener('input', autoCalc);
    d.querySelector('#ex-p').addEventListener('input', autoCalc);
    function autoCalc() {
      const q = parseFloat(d.querySelector('#ex-q').value)||0;
      const p = parseFloat(d.querySelector('#ex-p').value)||0;
      if (q>0 && p>0) d.querySelector('#ex-t').value = q*p;
    }
    return d;
  }

  /* ── 지출종류 label로 select 찾기 ── */
  function findExpSel() {
    let sel = null;
    document.querySelectorAll('#overlay .modal label').forEach(function(lbl){
      const t = lbl.textContent.replace(/\s/g,'');
      if (t.indexOf('지출종류')>=0 || t.indexOf('지출유형')>=0) {
        const f = lbl.closest('.field') || lbl.parentElement;
        if (f) { const s = f.querySelector('select'); if (s) sel = s; }
      }
    });
    if (!sel) sel = document.querySelector('#overlay #m-dtype, #overlay [name="dtype"]');
    return sel;
  }

  /* ── 지출종류 값에 따라 영역 표시/숨김 ── */
  function syncArea(sel) {
    const area = document.getElementById(AREA_ID);
    if (!area) return;
    const v = sel ? (sel.value||'').trim() : '';
    const empty = !v || v==='없음' || v==='none' || v==='-' || v==='0';
    area.style.display = empty ? 'none' : 'block';
  }

  /* ── 기존 데이터 복원 ── */
  function fillArea() {
    if (!_editId || typeof entries==='undefined') return;
    const en = entries.find(function(x){ return x.id===_editId; });
    if (!en) return;
    function sv(id,v){ const el=document.getElementById(id); if(el&&v) el.value=v; }
    sv('ex-v', en.vendor   || en.company  || '');
    sv('ex-m', en.material || en.mat      || '');
    sv('ex-s', en.spec     || '');
    sv('ex-q', en.qty      || '');
    sv('ex-p', en.price    || '');
    sv('ex-t', en.total    || en.cost     || '');
    sv('ex-n', en.expNote  || '');
    /* 지출 데이터 있으면 강제 표시 */
    if (en.vendor||en.material||en.total||en.cost) {
      const area = document.getElementById(AREA_ID);
      if (area) area.style.display = 'block';
    }
  }

  /* ── 모달 셋업 ── */
  function setup() {
    const modal = document.querySelector('#overlay .modal');
    if (!modal) return;

    /* 업무 모달인지 확인 */
    const title = document.getElementById('mTitle');
    if (!title || (title.textContent||'').indexOf('업무')<0) return;

    /* 지출 영역 삽입 */
    if (!document.getElementById(AREA_ID)) {
      const btnRow = document.getElementById('mBtnRow');
      if (btnRow) modal.insertBefore(makeArea(), btnRow);
    }

    /* 지출종류 select 연결 */
    const sel = findExpSel();
    if (sel && !sel._expBound) {
      sel._expBound = true;
      sel.addEventListener('change', function(){ syncArea(sel); });
    }
    syncArea(sel);
    fillArea();
  }

  /* ── 저장 시 지출 데이터 추가 저장 ── */
  function onSave() {
    const area = document.getElementById(AREA_ID);
    if (!area || area.style.display==='none') return;

    const get = function(id){ return (document.getElementById(id)||{}).value||''; };
    const vendor   = get('ex-v');
    const material = get('ex-m');
    const spec     = get('ex-s');
    const qty      = get('ex-q');
    const price    = get('ex-p');
    const total    = get('ex-t');
    const note     = get('ex-n');
    if (!vendor && !material && !total) return;

    /* worklog.js 저장 완료 대기 후 updateRecord */
    setTimeout(function(){
      if (typeof entries==='undefined' || typeof updateRecord!=='function') return;
      let target = null;
      if (_editId) target = entries.find(function(x){ return x.id===_editId; });
      if (!target) {
        const works = entries.filter(function(x){ return x.kind==='work'; })
          .sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
        target = works[0];
      }
      if (!target) return;
      updateRecord(target.id, { vendor:vendor, material:material, spec:spec,
        qty:qty, price:price, total:total, expNote:note });
      if (typeof v43Refresh==='function') setTimeout(v43Refresh, 200);
    }, 400);
  }

  /* ── openEditor 후킹 (editId 캡처) ── */
  function hookOpenEditor() {
    if (typeof window.openEditor!=='function' || window.openEditor._expHk) return;
    const orig = window.openEditor;
    window.openEditor = function(kind, id){
      _editId = (kind==='work') ? (id||null) : null;
      orig.apply(this, arguments);
      if (kind==='work') setTimeout(setup, 200);
    };
    window.openEditor._expHk = true;
  }

  /* ── 저장 버튼 후킹 ── */
  function hookSave() {
    const btn = document.getElementById('mSave');
    if (!btn || btn._expSvHk) return;
    btn._expSvHk = true;
    btn.addEventListener('click', onSave); /* bubble — worklog.js 저장과 충돌 없음 */
  }

  /* ── overlay style 변화 감지 ── */
  function watchOverlay() {
    const ov = document.getElementById('overlay');
    if (!ov) { setTimeout(watchOverlay, 500); return; }

    let wasOpen = false;
    new MutationObserver(function(){
      const st = ov.getAttribute('style')||'';
      const cl = ov.getAttribute('class')||'';
      const open = st.indexOf('display: flex')>=0 || st.indexOf('display:flex')>=0 || cl.indexOf('open')>=0;
      if (open && !wasOpen) {
        wasOpen = true;
        setTimeout(function(){ setup(); hookSave(); }, 250);
      }
      if (!open) { wasOpen = false; _editId = null; }
    }).observe(ov, { attributes:true, attributeFilter:['style','class'] });
  }

  /* ── 초기화 ── */
  setTimeout(function(){
    hookOpenEditor();
    watchOverlay();
  }, 500);

  setTimeout(hookOpenEditor, 1500);

  console.log('[expense_link_patch v3] 로드 완료');
})();
