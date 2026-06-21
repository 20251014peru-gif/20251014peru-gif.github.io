/* =====================================================
   worklog v44 PATCH — expense_link_patch.js
   v2: 타이밍 문제 해결
   - overlay 열림을 style 변화로 감지 → 즉시 주입
   - 저장 2번 문제: capture 이벤트 제거, 훅 중복 방지
   ===================================================== */

(function () {
  'use strict';

  const EXP_AREA_ID = 'wl-exp-inline-area';
  let _currentEditId = null;  /* 현재 수정 중인 entry id */

  /* ══════════════════════════════════════
     지출 입력 영역 HTML 생성
  ══════════════════════════════════════ */
  function buildExpArea() {
    const div = document.createElement('div');
    div.id = EXP_AREA_ID;
    div.style.cssText = [
      'margin-top:14px',
      'padding:14px',
      'background:#fff8f0',
      'border:2px solid #f39c12',
      'border-radius:14px',
      'display:none'
    ].join(';');

    div.innerHTML = `
      <div style="font-size:13px;font-weight:800;color:#c0720a;margin-bottom:12px">💰 지출 내역 연동</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">업체명</label>
          <input id="exp-v" type="text" placeholder="예: 한국전기안전공사"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;outline:none">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">자재명</label>
          <input id="exp-m" type="text" placeholder="예: 형광등, 소화기"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;outline:none">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">규격/사양</label>
          <input id="exp-s" type="text" placeholder="예: 36W, 3.3kg"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;outline:none">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">수량</label>
          <input id="exp-q" type="number" placeholder="0" min="0"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;outline:none;text-align:right">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">단가 (원)</label>
          <input id="exp-p" type="number" placeholder="0" min="0"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;outline:none;text-align:right">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">합계 (원)</label>
          <input id="exp-t" type="number" placeholder="0" min="0"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;outline:none;text-align:right;font-weight:700;color:#c0720a">
        </div>
      </div>
      <div style="margin-top:10px">
        <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">비고</label>
        <input id="exp-n" type="text" placeholder="간단한 메모"
          style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;outline:none">
      </div>`;

    /* 단가×수량 → 합계 자동계산 */
    function calc() {
      var q = parseFloat(div.querySelector('#exp-q').value) || 0;
      var p = parseFloat(div.querySelector('#exp-p').value) || 0;
      if (q > 0 && p > 0) div.querySelector('#exp-t').value = q * p;
    }
    div.querySelector('#exp-q').addEventListener('input', calc);
    div.querySelector('#exp-p').addEventListener('input', calc);

    /* 포커스 시 0 제거 */
    div.querySelectorAll('input[type=number]').forEach(function(inp){
      inp.addEventListener('focus', function(){ if(inp.value==='0') inp.value=''; });
    });

    return div;
  }

  /* ══════════════════════════════════════
     지출종류 select → 영역 show/hide
  ══════════════════════════════════════ */
  function getExpTypeSelect() {
    var modal = document.querySelector('#overlay .modal');
    if (!modal) return null;
    var found = null;
    modal.querySelectorAll('label').forEach(function(lbl){
      if (lbl.textContent.replace(/\s/g,'').indexOf('지출종류') >= 0 ||
          lbl.textContent.replace(/\s/g,'').indexOf('지출유형') >= 0) {
        var f = lbl.closest('.field') || lbl.parentElement;
        if (f) { var s = f.querySelector('select'); if (s) found = s; }
      }
    });
    /* id/name 기반 폴백 */
    if (!found) {
      ['#m-dtype','#m-exptype','[name="dtype"],[name="expType"]'].forEach(function(sel){
        if (!found) found = document.querySelector(sel);
      });
    }
    return found;
  }

  function toggleExpArea(sel) {
    var area = document.getElementById(EXP_AREA_ID);
    if (!area || !sel) return;
    var v = (sel.value || '').trim();
    var hide = (v === '' || v === '없음' || v === 'none' || v === '0' || v === '-');
    area.style.display = hide ? 'none' : 'block';
  }

  /* ══════════════════════════════════════
     업무 모달에 지출 영역 주입 + 이벤트 연결
  ══════════════════════════════════════ */
  function setupExpArea() {
    var modal = document.querySelector('#overlay .modal');
    if (!modal) return;

    /* 업무 모달인지 확인 */
    var title = document.getElementById('mTitle');
    if (!title) return;
    var titleText = title.textContent || title.innerText || '';
    if (titleText.indexOf('업무') < 0) return;

    /* 이미 있으면 skip */
    if (modal.querySelector('#' + EXP_AREA_ID)) {
      /* 이미 있으면 지출종류 select만 다시 연결 */
      bindExpTypeSelect();
      fillFromEntry();
      return;
    }

    /* mBtnRow 바로 앞에 삽입 */
    var btnRow = document.getElementById('mBtnRow');
    if (!btnRow) return;
    var area = buildExpArea();
    modal.insertBefore(area, btnRow);

    bindExpTypeSelect();
    fillFromEntry();
  }

  function bindExpTypeSelect() {
    var sel = getExpTypeSelect();
    if (!sel || sel._expToggleBound) return;
    sel._expToggleBound = true;
    sel.addEventListener('change', function(){ toggleExpArea(sel); });
    /* 현재 값으로 초기 표시 */
    setTimeout(function(){ toggleExpArea(sel); }, 50);
  }

  /* ══════════════════════════════════════
     수정 모드: 기존 데이터 복원
  ══════════════════════════════════════ */
  function fillFromEntry() {
    if (!_currentEditId) return;
    var en = null;
    if (typeof entries !== 'undefined') {
      en = entries.find(function(x){ return x.id === _currentEditId; });
    }
    if (!en) return;

    setTimeout(function(){
      function set(id, val){ var el=document.getElementById(id); if(el&&val) el.value=val; }
      set('exp-v', en.vendor   || en.company  || '');
      set('exp-m', en.material || en.mat      || '');
      set('exp-s', en.spec     || en.size     || '');
      set('exp-q', en.qty      || en.quantity || '');
      set('exp-p', en.price    || en.unitCost || '');
      set('exp-t', en.total    || en.cost     || '');
      set('exp-n', en.expNote  || '');

      /* 지출 데이터가 있으면 영역 강제 표시 */
      var hasExp = (en.vendor||en.material||en.spec||en.qty||en.price||en.total);
      if (hasExp) {
        var area = document.getElementById(EXP_AREA_ID);
        if (area) area.style.display = 'block';
      }
    }, 120);
  }

  /* ══════════════════════════════════════
     저장 버튼 — 지출 데이터를 entry에 merge
     ※ capture 없이 worklog.js 저장 완료 후 updateRecord로 추가 저장
  ══════════════════════════════════════ */
  function hookSaveBtn() {
    var btn = document.getElementById('mSave');
    if (!btn || btn._expHooked) return;
    btn._expHooked = true;

    btn.addEventListener('click', function(){
      var area = document.getElementById(EXP_AREA_ID);
      if (!area || area.style.display === 'none') return;

      /* worklog.js 저장이 끝난 뒤 실행 (300ms 대기) */
      setTimeout(function(){
        var vendor   = (document.getElementById('exp-v')||{}).value||'';
        var material = (document.getElementById('exp-m')||{}).value||'';
        var spec     = (document.getElementById('exp-s')||{}).value||'';
        var qty      = (document.getElementById('exp-q')||{}).value||'';
        var price    = (document.getElementById('exp-p')||{}).value||'';
        var total    = (document.getElementById('exp-t')||{}).value||'';
        var note     = (document.getElementById('exp-n')||{}).value||'';

        if (!vendor && !material && !total) return; /* 비어있으면 skip */

        /* 방금 저장된 entry 찾기 (editId 또는 가장 최근 work) */
        if (typeof entries === 'undefined' || typeof updateRecord !== 'function') return;

        var target = null;
        if (_currentEditId) {
          target = entries.find(function(x){ return x.id === _currentEditId; });
        }
        if (!target) {
          /* 신규: 가장 최근 work entry */
          var works = entries.filter(function(x){ return x.kind==='work'; });
          works.sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
          target = works[0];
        }
        if (!target) return;

        updateRecord(target.id, {
          vendor: vendor, material: material, spec: spec,
          qty: qty, price: price, total: total, expNote: note
        });

        /* 카드 레이아웃 재렌더 */
        if (typeof v43Refresh === 'function') setTimeout(v43Refresh, 200);

      }, 300);
    });
  }

  /* ══════════════════════════════════════
     openEditor 후킹 — id 캡처 목적
  ══════════════════════════════════════ */
  function hookOpenEditor() {
    if (typeof window.openEditor !== 'function') return;
    if (window.openEditor._expIdHooked) return;
    var orig = window.openEditor;
    window.openEditor = function(kind, id){
      _currentEditId = (kind === 'work') ? (id || null) : null;
      orig.apply(this, arguments);
    };
    window.openEditor._expIdHooked = true;
  }

  /* ══════════════════════════════════════
     overlay 열림 감지 — MutationObserver
     style/class 변화 → setup 실행
  ══════════════════════════════════════ */
  function watchOverlay() {
    var overlay = document.getElementById('overlay');
    if (!overlay) { setTimeout(watchOverlay, 500); return; }

    var lastOpen = false;

    new MutationObserver(function(){
      var style = overlay.getAttribute('style') || '';
      var cls   = overlay.getAttribute('class') || '';
      var isOpen = style.indexOf('display: flex') >= 0 ||
                   style.indexOf('display:flex')  >= 0 ||
                   cls.indexOf('open') >= 0;

      if (isOpen && !lastOpen) {
        /* 막 열렸을 때 */
        lastOpen = true;
        /* worklog.js가 모달 내용을 채울 시간을 주고 실행 */
        setTimeout(function(){
          setupExpArea();
          hookSaveBtn();
        }, 180);
      } else if (!isOpen) {
        lastOpen = false;
        _currentEditId = null;
      }
    }).observe(overlay, { attributes: true, attributeFilter: ['style','class'] });
  }

  /* ══════════════════════════════════════
     초기화
  ══════════════════════════════════════ */
  setTimeout(function(){
    hookOpenEditor();
    watchOverlay();
  }, 600);

  setTimeout(function(){
    hookOpenEditor(); /* 재시도 */
  }, 1800);

  console.log('[expense_link_patch v2] 로드 완료');
})();
