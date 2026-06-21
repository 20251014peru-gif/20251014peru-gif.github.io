/* =====================================================
   worklog v44 PATCH — expense_link_patch.js
   업무 모달에서 지출종류 선택 시 지출내역 입력창 연동
   - 지출종류 ≠ 없음 이면 지출 모달 필드 항상 표시
   - 수정 시에도 기존 지출내역 불러와서 표시
   ===================================================== */

(function () {
  'use strict';

  /* ── 지출 입력 영역 HTML (업무 모달 안에 동적 삽입) ── */
  const EXP_AREA_ID = 'wl-exp-inline-area';

  function buildExpArea() {
    const div = document.createElement('div');
    div.id = EXP_AREA_ID;
    div.style.cssText = 'margin-top:16px;padding:14px;background:#fff8f0;border:2px solid #f39c12;border-radius:14px;display:none';
    div.innerHTML = `
      <div style="font-size:13px;font-weight:800;color:#c0720a;margin-bottom:12px">💰 지출 내역 연동</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field">
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">업체명</label>
          <input type="text" id="exp-inline-vendor" placeholder="예: 한국전기안전공사"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none">
        </div>
        <div class="field">
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">자재명</label>
          <input type="text" id="exp-inline-material" placeholder="예: 형광등, 소화기"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none">
        </div>
        <div class="field">
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">규격/사양</label>
          <input type="text" id="exp-inline-spec" placeholder="예: 36W, 3.3kg"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none">
        </div>
        <div class="field">
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">수량</label>
          <input type="number" id="exp-inline-qty" value="" placeholder="0" min="0"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;text-align:right">
        </div>
        <div class="field">
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">단가 (원)</label>
          <input type="number" id="exp-inline-price" value="" placeholder="0" min="0"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;text-align:right">
        </div>
        <div class="field">
          <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">합계 (원)</label>
          <input type="number" id="exp-inline-total" value="" placeholder="0" min="0"
            style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;text-align:right;font-weight:700;color:#c0720a">
        </div>
      </div>
      <div style="margin-top:10px">
        <label style="font-size:12px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">비고</label>
        <input type="text" id="exp-inline-note" placeholder="간단한 메모"
          style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none">
      </div>`;

    /* 단가×수량 → 합계 자동 계산 */
    function calcTotal() {
      const qty   = parseFloat(div.querySelector('#exp-inline-qty').value)   || 0;
      const price = parseFloat(div.querySelector('#exp-inline-price').value) || 0;
      if (qty > 0 && price > 0) {
        div.querySelector('#exp-inline-total').value = qty * price;
      }
    }
    div.querySelector('#exp-inline-qty').addEventListener('input', calcTotal);
    div.querySelector('#exp-inline-price').addEventListener('input', calcTotal);

    /* 포커스 시 0 제거 */
    div.querySelectorAll('input[type=number]').forEach(function (inp) {
      inp.addEventListener('focus', function () {
        if (inp.value === '0') inp.value = '';
      });
      inp.addEventListener('blur', function () {
        if (inp.value === '') inp.value = '';
      });
    });

    return div;
  }

  /* ── 업무 모달 안에 지출 영역 삽입 ── */
  function injectExpArea() {
    const modal = document.querySelector('#overlay .modal');
    if (!modal) return;
    if (modal.querySelector('#' + EXP_AREA_ID)) return; // 이미 있음

    /* mBtnRow 바로 위에 삽입 */
    const btnRow = document.getElementById('mBtnRow');
    if (!btnRow) return;
    const area = buildExpArea();
    modal.insertBefore(area, btnRow);
  }

  /* ── 지출종류 select 감지 → 영역 표시/숨김 ── */
  function watchExpTypeSelect() {
    /* worklog.js가 만드는 지출종류 select: id="m-cost" 영역 위의 select */
    const modal = document.querySelector('#overlay .modal');
    if (!modal) return;

    /* 지출종류 select 찾기 — label 텍스트로 탐색 */
    let expSel = null;
    modal.querySelectorAll('select').forEach(function (sel) {
      const label = modal.querySelector('label[for="' + sel.id + '"]') ||
                    sel.previousElementSibling ||
                    sel.closest('.field')?.querySelector('label');
      const labelText = (label ? label.textContent : '') + (sel.id || '') + (sel.name || '');
      if (labelText.indexOf('지출') >= 0 || labelText.indexOf('expType') >= 0 ||
          sel.id === 'm-exptype' || sel.id === 'm-dtype' || sel.name === 'dtype') {
        expSel = sel;
      }
    });

    /* label 텍스트 "지출종류" 기준으로도 탐색 */
    if (!expSel) {
      modal.querySelectorAll('label').forEach(function (lbl) {
        if (lbl.textContent.trim().indexOf('지출') >= 0) {
          const field = lbl.closest('.field');
          if (field) expSel = field.querySelector('select');
        }
      });
    }

    if (!expSel || expSel._expLinked) return;
    expSel._expLinked = true;

    function toggleExpArea() {
      const area = document.getElementById(EXP_AREA_ID);
      if (!area) return;
      const v = expSel.value || '';
      const isEmpty = (v === '' || v === '없음' || v === 'none' || v === '0');
      area.style.display = isEmpty ? 'none' : 'block';
    }

    expSel.addEventListener('change', toggleExpArea);

    /* 수정 모드: 기존 값으로 초기 표시 결정 */
    setTimeout(toggleExpArea, 80);
  }

  /* ── 저장 버튼 후킹: 지출 인라인 데이터를 레코드에 포함 ── */
  function hookSaveBtn() {
    const saveBtn = document.getElementById('mSave');
    if (!saveBtn || saveBtn._expSaveHooked) return;
    saveBtn._expSaveHooked = true;

    saveBtn.addEventListener('click', function () {
      const area = document.getElementById(EXP_AREA_ID);
      if (!area || area.style.display === 'none') return;

      /* 인라인 지출 데이터 수집 */
      const vendor   = (document.getElementById('exp-inline-vendor')   || {}).value || '';
      const material = (document.getElementById('exp-inline-material') || {}).value || '';
      const spec     = (document.getElementById('exp-inline-spec')     || {}).value || '';
      const qty      = (document.getElementById('exp-inline-qty')      || {}).value || '';
      const price    = (document.getElementById('exp-inline-price')    || {}).value || '';
      const total    = (document.getElementById('exp-inline-total')    || {}).value || '';
      const note     = (document.getElementById('exp-inline-note')     || {}).value || '';

      /* worklog.js가 저장할 때 쓰는 전역 임시 저장소에 주입 */
      window._expInlineData = { vendor, material, spec, qty, price, total, note };
    }, true); /* capture — worklog.js 저장보다 먼저 실행 */
  }

  /* ── 수정 모드: 기존 데이터 복원 ── */
  function fillExpAreaFromEntry(en) {
    if (!en) return;
    setTimeout(function () {
      const area = document.getElementById(EXP_AREA_ID);
      if (!area) return;
      const set = function (id, val) {
        const el = document.getElementById(id);
        if (el && val) el.value = val;
      };
      set('exp-inline-vendor',   en.vendor   || en.company  || '');
      set('exp-inline-material', en.material || en.mat      || '');
      set('exp-inline-spec',     en.spec     || en.size     || '');
      set('exp-inline-qty',      en.qty      || en.quantity || '');
      set('exp-inline-price',    en.price    || en.unitCost || '');
      set('exp-inline-total',    en.total    || en.cost     || '');
      set('exp-inline-note',     en.expNote  || en.bigoExp  || '');
    }, 150);
  }

  /* ── openEditor 후킹 (worklog.js 함수) ── */
  function hookOpenEditor() {
    if (typeof window.openEditor !== 'function' || window.openEditor._expHooked) return;
    const orig = window.openEditor;
    window.openEditor = function (kind, id) {
      orig.apply(this, arguments);
      if (kind !== 'work') return;
      setTimeout(function () {
        injectExpArea();
        watchExpTypeSelect();
        hookSaveBtn();
        /* 수정 모드: 기존 데이터 복원 */
        if (id && typeof entries !== 'undefined') {
          const en = entries.find(function (x) { return x.id === id; });
          fillExpAreaFromEntry(en);
        }
      }, 200);
    };
    window.openEditor._expHooked = true;
  }

  /* ── MutationObserver: 업무 모달 열림 감지 ── */
  const overlay = document.getElementById('overlay');
  if (overlay) {
    new MutationObserver(function () {
      const isOpen = overlay.classList.contains('open') ||
                     overlay.style.display === 'flex' ||
                     overlay.style.display === 'block' ||
                     getComputedStyle(overlay).display !== 'none';
      if (isOpen) {
        setTimeout(function () {
          /* 업무 모달인지 확인 (제목에 '업무' 포함) */
          const title = document.getElementById('mTitle');
          if (!title || title.textContent.indexOf('업무') < 0) return;
          injectExpArea();
          watchExpTypeSelect();
          hookSaveBtn();
        }, 150);
      }
    }).observe(overlay, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  /* 초기 훅 시도 */
  setTimeout(hookOpenEditor, 800);
  setTimeout(hookOpenEditor, 2000);

  console.log('[expense_link_patch] 로드 완료');
})();
