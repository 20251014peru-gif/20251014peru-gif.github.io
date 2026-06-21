/* =====================================================
   worklog v44 PATCH — field_search_patch.js
   1. 분야 검색창 항상 빈 값으로 시작 → 목록 바로 표시
   2. 지출유형 추가/수정/삭제 관리
   3. 개인비용/후불청구 선택 시 비용 입력창 유지
   4. 금액 입력창 기본값 0 → 빈 칸
   ===================================================== */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════
     1. 분야 검색창 — 항상 빈 값으로 시작
  ═══════════════════════════════════════════════ */
  function clearFieldInput(inp) {
    if (!inp || inp._fsBound) return;
    inp._fsBound = true;

    function showAll() {
      /* 값 비우고 input 이벤트 발화 → worklog.js 전체 목록 렌더 */
      if (inp.value.trim() !== '') {
        inp.value = '';
      }
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      /* 혹시 li가 숨겨져 있으면 강제 표시 */
      setTimeout(function () {
        let c = inp.parentElement;
        for (let i = 0; i < 5 && c; i++) {
          c.querySelectorAll('li,[data-field],.field-item').forEach(function (el) {
            el.style.display = '';
          });
          c = c.parentElement;
        }
      }, 50);
    }

    inp.addEventListener('focus', function () { setTimeout(showAll, 30); });
    inp.addEventListener('click', function (e) { e.stopPropagation(); setTimeout(showAll, 30); });
  }

  /* 이벤트 위임으로 분야 인풋 감지 */
  document.addEventListener('focusin', function (e) {
    const inp = e.target;
    if (!inp || inp.tagName !== 'INPUT') return;
    const ph = inp.placeholder || '';
    if (ph.indexOf('업체명') >= 0 || ph.indexOf('분야') >= 0 ||
        inp.className.indexOf('field-search') >= 0) {
      clearFieldInput(inp);
      setTimeout(function () {
        if (inp.value.trim() !== '') inp.value = '';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }, 40);
    }
  }, true);

  /* MutationObserver로 동적 생성 감지 */
  new MutationObserver(function () {
    document.querySelectorAll('input[placeholder*="업체명"],input[placeholder*="분야"],.field-search-input').forEach(clearFieldInput);
  }).observe(document.body, { childList: true, subtree: true });

  setTimeout(function () {
    document.querySelectorAll('input[placeholder*="업체명"],input[placeholder*="분야"]').forEach(clearFieldInput);
  }, 800);


  /* ═══════════════════════════════════════════════
     2. 금액 입력창 기본값 0 → 빈 칸
  ═══════════════════════════════════════════════ */
  function patchNumberInputs() {
    /* 지출 모달 안의 number 입력 + 합계 필드 */
    const targets = ['#m-cost','#m-qty','#m-unit','#m-delivery',
                     '[name="cost"],[name="qty"],[name="amount"]'];
    document.querySelectorAll(targets.join(',')).forEach(function (inp) {
      if (inp._zeroPatch) return;
      inp._zeroPatch = true;
      /* 포커스 시 0이면 비우기 */
      inp.addEventListener('focus', function () {
        if (inp.value === '0' || inp.value === '0.00') inp.value = '';
      });
      /* 블러 시 빈 값이면 0 복원 */
      inp.addEventListener('blur', function () {
        if (inp.value === '') inp.value = '0';
      });
    });
    /* number 타입 전체도 동일 처리 */
    document.querySelectorAll('#expenseOverlay input[type=number], #overlay input[type=number]').forEach(function (inp) {
      if (inp._zeroPatch) return;
      inp._zeroPatch = true;
      inp.addEventListener('focus', function () {
        if (inp.value === '0' || inp.value === '0.00') inp.value = '';
      });
      inp.addEventListener('blur', function () {
        if (inp.value === '') inp.value = '0';
      });
    });
  }

  /* 지출 모달 열릴 때마다 적용 */
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.target && m.target.classList &&
          (m.target.id === 'expenseOverlay' || m.target.id === 'overlay')) {
        setTimeout(patchNumberInputs, 100);
      }
    });
  }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class','style'] });

  setTimeout(patchNumberInputs, 1000);
  document.addEventListener('click', function () { setTimeout(patchNumberInputs, 200); });


  /* ═══════════════════════════════════════════════
     3. 개인비용/후불청구 선택 시 비용 입력창 강제 표시
  ═══════════════════════════════════════════════ */
  function patchExpenseTypeVisibility() {
    /* 정산종류 select 감지 */
    const selectors = ['#m-expType','#m-settleType','select[name="expType"]',
                       'select[name="settleType"]','#expSettleType'];
    selectors.forEach(function (sel) {
      const el = document.querySelector(sel);
      if (!el || el._expTypePatch) return;
      el._expTypePatch = true;
      el.addEventListener('change', function () {
        const v = el.value || '';
        const isExpense = v.indexOf('개인') >= 0 || v.indexOf('후불') >= 0 ||
                          v.indexOf('지출') >= 0 || v.indexOf('청구') >= 0;
        /* 비용 입력 영역 찾아서 표시 */
        const costArea = document.querySelector('#mCostArea,#m-cost-area,.cost-area,[data-cost-area]');
        if (costArea) costArea.style.display = isExpense ? '' : 'none';
        /* 금액 필드 직접 찾기 */
        ['#m-cost','#m-amount','input[name="cost"]'].forEach(function (cs) {
          const c = document.querySelector(cs);
          if (c) {
            const wrap = c.closest('.field,.form-group,[class*="field"]');
            if (wrap) wrap.style.display = isExpense ? '' : '';
          }
        });
      });
    });
  }

  new MutationObserver(function () { patchExpenseTypeVisibility(); })
    .observe(document.body, { childList: true, subtree: true });
  setTimeout(patchExpenseTypeVisibility, 800);


  /* ═══════════════════════════════════════════════
     4. 지출유형 관리 — 추가/수정/삭제
  ═══════════════════════════════════════════════ */
  const EXP_TYPE_LS = 'wl_expense_types_v44';
  const DEFAULT_TYPES = ['자재구매','용역/외주','공사','수선비','소모품','기타'];

  function loadExpTypes() {
    try { return JSON.parse(localStorage.getItem(EXP_TYPE_LS) || 'null') || DEFAULT_TYPES.slice(); }
    catch (e) { return DEFAULT_TYPES.slice(); }
  }
  function saveExpTypes(arr) {
    try { localStorage.setItem(EXP_TYPE_LS, JSON.stringify(arr)); } catch (e) {}
  }

  /* 지출유형 select 옵션 채우기 */
  function fillExpTypeSelect(sel) {
    if (!sel) return;
    const cur = sel.value;
    const types = loadExpTypes();
    sel.innerHTML = types.map(function (t) {
      return '<option value="' + t + '"' + (t === cur ? ' selected' : '') + '>' + t + '</option>';
    }).join('');
    if (cur && types.includes(cur)) sel.value = cur;
  }

  /* 지출유형 관리 모달 열기 */
  function openExpTypeMgr() {
    let ov = document.getElementById('expTypeMgrOv');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'expTypeMgrOv';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10010;display:flex;align-items:center;justify-content:center;padding:20px';

    ov.innerHTML = `
      <div style="background:#fff;border-radius:18px;width:100%;max-width:400px;padding:22px;box-shadow:0 12px 40px rgba(0,0,0,.2);max-height:85vh;overflow:auto">
        <div style="display:flex;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;font-size:17px;font-weight:800;color:#1a2f45;flex:1">💰 지출유형 관리</h3>
          <button id="etmClose" style="background:#f0f4f8;border:none;border-radius:8px;width:32px;height:32px;font-size:16px;cursor:pointer">✕</button>
        </div>
        <div id="etmList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px"></div>
        <div style="display:flex;gap:8px">
          <input type="text" id="etmNewName" placeholder="새 유형 이름" style="flex:1;height:40px;padding:0 12px;border:2px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">
          <button id="etmAdd" style="height:40px;padding:0 16px;background:#3f7cb8;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">➕ 추가</button>
        </div>
      </div>`;

    document.body.appendChild(ov);

    function renderList() {
      const list = document.getElementById('etmList');
      const types = loadExpTypes();
      list.innerHTML = types.map(function (t, i) {
        return `<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#f7faff;border-radius:10px;border:1.5px solid #e8f0fa">
          <input type="text" data-ei="${i}" value="${t}" style="flex:1;border:none;background:transparent;font-size:14px;font-weight:600;color:#1a2f45;outline:none;font-family:inherit">
          <button data-esave="${i}" style="background:#eaf1fb;border:none;border-radius:7px;padding:4px 10px;font-size:12px;font-weight:700;color:#3f7cb8;cursor:pointer;font-family:inherit">저장</button>
          <button data-edel="${i}" style="background:#fde8e8;border:none;border-radius:7px;padding:4px 10px;font-size:12px;font-weight:700;color:#b52929;cursor:pointer;font-family:inherit">삭제</button>
        </div>`;
      }).join('');

      list.querySelectorAll('[data-esave]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = +btn.dataset.esave;
          const inp = list.querySelector('[data-ei="' + i + '"]');
          const v = (inp.value || '').trim();
          if (!v) return;
          const arr = loadExpTypes();
          arr[i] = v;
          saveExpTypes(arr);
          refreshAllExpTypeSelects();
          renderList();
          if (typeof toast === 'function') toast('저장됐어요');
        });
      });

      list.querySelectorAll('[data-edel]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = +btn.dataset.edel;
          const arr = loadExpTypes();
          if (!confirm('"' + arr[i] + '" 유형을 삭제할까요?')) return;
          arr.splice(i, 1);
          saveExpTypes(arr);
          refreshAllExpTypeSelects();
          renderList();
          if (typeof toast === 'function') toast('삭제됐어요');
        });
      });
    }

    renderList();

    document.getElementById('etmAdd').addEventListener('click', function () {
      const inp = document.getElementById('etmNewName');
      const v = (inp.value || '').trim();
      if (!v) return;
      const arr = loadExpTypes();
      if (arr.includes(v)) { if (typeof toast === 'function') toast('이미 있는 유형이에요'); return; }
      arr.push(v);
      saveExpTypes(arr);
      inp.value = '';
      refreshAllExpTypeSelects();
      renderList();
      if (typeof toast === 'function') toast('추가됐어요');
    });
    document.getElementById('etmNewName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('etmAdd').click();
    });
    document.getElementById('etmClose').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  }

  /* 모든 지출유형 select 갱신 */
  function refreshAllExpTypeSelects() {
    document.querySelectorAll('#expType,#m-expType,select[name="expType"],[data-exp-type]').forEach(fillExpTypeSelect);
  }

  /* 지출 모달 열릴 때 유형 select 채우고 관리 버튼 추가 */
  function patchExpTypeSelect() {
    const selectors = ['#expType','#m-expType','select[name="expType"]'];
    selectors.forEach(function (s) {
      const sel = document.querySelector(s);
      if (!sel || sel._expTypeFilled) return;
      sel._expTypeFilled = true;
      fillExpTypeSelect(sel);

      /* 관리 버튼 삽입 (select 옆) */
      if (!sel.parentElement.querySelector('.exp-type-mgr-btn')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'exp-type-mgr-btn';
        btn.textContent = '⚙ 관리';
        btn.style.cssText = 'margin-left:6px;padding:4px 10px;background:#f0f6ff;color:#3f7cb8;border:1.5px solid #3f7cb8;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0';
        btn.addEventListener('click', function (e) { e.preventDefault(); openExpTypeMgr(); });
        /* select의 부모를 flex로 */
        sel.parentElement.style.display = 'flex';
        sel.parentElement.style.alignItems = 'center';
        sel.parentElement.appendChild(btn);
      }
    });
  }

  new MutationObserver(function () { patchExpTypeSelect(); patchExpenseTypeVisibility(); patchNumberInputs(); })
    .observe(document.body, { childList: true, subtree: true });

  setTimeout(patchExpTypeSelect, 600);
  setTimeout(patchExpTypeSelect, 1500);

  console.log('[field_search_patch] 로드 완료');
})();
