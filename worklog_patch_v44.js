/* =============================================================
   worklog_patch_v44.js
   ✅ 메모 수정 모달 — 체크박스(checklist-row) 정상 표시
   ✅ 지출 등록 — 개인비용/후불청구 전면 개편
      · 결제수단 (카드/은행이체/현금)
      · 용도 칩 추가·삭제 가능
      · 자재 목록 행 추가·수정·삭제 + 합계 자동계산
      · 품의서 상태 / 관리비 포함 상태
      · 지출 탭 — 미처리 현황 대시보드 + 통합 목록
   사용법: worklog.js 다음 줄에 <script src="worklog_patch_v44.js"></script>
   ============================================================= */

/* ─────────────────────────────────────────
   PART 1: 메모 수정 모달 체크박스 수정
───────────────────────────────────────── */
(function patchMemoEdit() {
  'use strict';

  function doMemoEditPatch() {
    const grid = document.getElementById('stickyGrid');
    if (!grid || grid._v44memoPatch) return;
    grid._v44memoPatch = true;

    // 이벤트 위임 — capture 단계에서 먼저 처리해 기존 핸들러보다 앞섬
    grid.addEventListener('click', function (e) {

      /* ── 수정 버튼 ── */
      const editBtn = e.target.closest('[data-sedit]');
      if (editBtn) {
        const id = editBtn.dataset.sedit;
        const card = editBtn.closest('.sticky-note');
        if (!card) return;

        const viewEl = card.querySelector('.sn-view');
        const editEl = card.querySelector('.sn-edit');
        const titleInp = editEl && editEl.querySelector('.sn-edit-title');
        const bodyEl   = editEl && editEl.querySelector('.sn-edit-body');

        if (typeof entries !== 'undefined') {
          const en = entries.find(function (x) { return x.id === id; });
          if (en) {
            if (titleInp) titleInp.value = en.title || '';
            if (bodyEl) {
              if (en.body && en.body.indexOf('checklist-row') >= 0) {
                /* HTML 그대로 삽입 — 체크박스 구조 보존 */
                var tmp = document.createElement('div');
                tmp.innerHTML = en.body;
                tmp.querySelectorAll('script,iframe,object,embed').forEach(function (n) { n.remove(); });
                tmp.querySelectorAll('*').forEach(function (el) {
                  [].slice.call(el.attributes).forEach(function (a) {
                    if (a.name.toLowerCase().startsWith('on')) el.removeAttribute(a.name);
                  });
                });
                bodyEl.innerHTML = tmp.innerHTML;
                /* 체크박스 클릭 이벤트 재바인딩 */
                bodyEl.querySelectorAll('.checklist-cb').forEach(function (cb) {
                  cb.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    var row = cb.closest('.checklist-row');
                    if (row) row.classList.toggle('done');
                  });
                });
                bodyEl.querySelectorAll('.checklist-text').forEach(function (t) {
                  t.contentEditable = 'true';
                });
              } else {
                bodyEl.innerText = en.body || '';
              }
            }
          }
        }

        if (viewEl) viewEl.style.display = 'none';
        if (editEl) editEl.style.display = '';
        if (bodyEl) {
          bodyEl.focus();
          try {
            var r = document.createRange();
            r.selectNodeContents(bodyEl);
            r.collapse(false);
            var s = window.getSelection();
            s.removeAllRanges();
            s.addRange(r);
          } catch (_) {}
        }

        e.stopImmediatePropagation();
        return;
      }

      /* ── 저장 버튼 ── */
      const saveBtn = e.target.closest('[data-ssave]');
      if (saveBtn) {
        const id = saveBtn.dataset.ssave;
        const card = saveBtn.closest('.sticky-note');
        if (!card) return;

        const titleInp = card.querySelector('.sn-edit-title');
        const bodyEl   = card.querySelector('.sn-edit-body');
        if (!bodyEl) return;

        var t = titleInp ? (titleInp.value || '') : '';
        var hasChecklist = !!bodyEl.querySelector('.checklist-row');
        var b = hasChecklist ? bodyEl.innerHTML.trim() : (bodyEl.innerText || '').trim();

        if (!b) { if (typeof toast === 'function') toast('내용을 입력해주세요'); return; }
        if (typeof updateRecord === 'function') updateRecord(id, { title: t.trim(), body: b });
        if (typeof toast === 'function') toast('저장됐어요');

        var viewEl = card.querySelector('.sn-view');
        var editEl = card.querySelector('.sn-edit');
        if (viewEl) viewEl.style.display = '';
        if (editEl) editEl.style.display = 'none';

        setTimeout(function () {
          if (typeof renderStickyGrid === 'function') renderStickyGrid();
          if (typeof v43Refresh === 'function') v43Refresh();
        }, 200);

        e.stopImmediatePropagation();
      }
    }, true);
  }

  /* renderStickyGrid 훅 — 그리드가 다시 그려질 때마다 재적용 */
  function hookRenderStickyGrid() {
    if (window._v44memoHooked) return;
    var orig = window.renderStickyGrid;
    if (!orig) return;
    window.renderStickyGrid = function () {
      orig.apply(this, arguments);
      setTimeout(doMemoEditPatch, 50);
    };
    window.renderStickyGrid._v44memoHooked = true;
    window._v44memoHooked = true;
  }

  function init() {
    hookRenderStickyGrid();
    doMemoEditPatch();
    /* 메모 탭 전환 시 재적용 */
    document.querySelectorAll('.v43-tab[data-v43tab="memo"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTimeout(doMemoEditPatch, 300);
      });
    });
  }

  setTimeout(init, 800);
  setTimeout(init, 2000);
})();


/* ─────────────────────────────────────────
   PART 2: 지출 등록 모달 전면 개편
───────────────────────────────────────── */
(function patchExpenseModal() {
  'use strict';

  /* ── 상수 ── */
  var EXP_LS      = 'wl_expense_v6';
  var PURPOSE_LS  = 'wl_expense_purposes_v6';
  var DEFAULT_PURPOSES = [
    { icon: '🔩', label: '자재구매' },
    { icon: '🍽', label: '식대' },
    { icon: '🚗', label: '교통/주차' },
    { icon: '🧹', label: '소모품' },
    { icon: '📋', label: '기타' }
  ];
  var PAY_METHODS = ['💳 카드', '🏦 은행이체', '💵 현금'];
  var EXP_TYPES   = ['없음', '💸 개인비용', '📃 후불청구'];
  var MODAL_ID    = 'expV6Modal';

  /* ── 데이터 ── */
  function loadExp() { try { return JSON.parse(localStorage.getItem(EXP_LS) || '[]'); } catch(e) { return []; } }
  function saveExp(arr) { try { localStorage.setItem(EXP_LS, JSON.stringify(arr)); } catch(e) {} }
  function loadPurposes() { try { return JSON.parse(localStorage.getItem(PURPOSE_LS) || 'null') || DEFAULT_PURPOSES; } catch(e) { return DEFAULT_PURPOSES.slice(); } }
  function savePurposes(arr) { try { localStorage.setItem(PURPOSE_LS, JSON.stringify(arr)); } catch(e) {} }
  function genId() { return 'exp6_' + Date.now() + '_' + Math.floor(Math.random() * 9999); }
  function fmt(n) { return n > 0 ? '₩' + Math.round(n).toLocaleString('ko-KR') : '₩0'; }
  function esc(s) { return (s || '').toString().replace(/[&<>"]/g, function(m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  /* ── 상태 ── */
  var _editId     = null;
  var _expType    = '없음';
  var _payMethod  = '💳 카드';
  var _selPurpose = {};   // Set 대신 객체로 (구버전 호환)
  var _matItems   = [];
  var _purposes   = [];
  var _expFilter  = 'all';

  function g(id) { return document.getElementById(id); }

  /* ── 모달 HTML 주입 ── */
  function injectModal() {
    if (g(MODAL_ID)) return;
    var div = document.createElement('div');
    div.id = MODAL_ID;
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10010;display:none;align-items:flex-end;justify-content:center';
    div.innerHTML = [
      '<div id="expV6Sheet" style="background:#fff;width:100%;max-width:540px;max-height:92vh;overflow-y:auto;',
        'border-radius:22px 22px 0 0;padding:20px 18px 36px;',
        'box-shadow:0 -4px 32px rgba(0,0,0,.18);font-family:-apple-system,BlinkMacSystemFont,\'Pretendard\',sans-serif">',

        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">',
          '<span id="expV6Title" style="font-size:16px;font-weight:700;color:#1a2f45">지출 등록</span>',
          '<button id="expV6Close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#7a92a8">✕</button>',
        '</div>',

        '<div style="margin-bottom:12px">',
          '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">날짜</label>',
          '<input type="date" id="expV6Date" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">',
        '</div>',

        '<div style="margin-bottom:12px">',
          '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">지출 종류</label>',
          '<div id="expV6TypeBtns" style="display:flex;gap:6px"></div>',
        '</div>',

        '<div style="height:1px;background:#f0f4f8;margin:14px 0"></div>',

        /* 개인비용 영역 */
        '<div id="expV6PersonalArea" style="display:none">',
          '<div style="margin-bottom:12px">',
            '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">결제 수단</label>',
            '<div id="expV6PayBtns" style="display:flex;gap:6px"></div>',
          '</div>',
          '<div style="margin-bottom:12px">',
            '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">업체명</label>',
            '<input type="text" id="expV6Vendor" placeholder="예: 성신철물, 다이소" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">',
          '</div>',
          '<div style="margin-bottom:12px">',
            '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">내역</label>',
            '<input type="text" id="expV6Desc" placeholder="예: 형광등 4개, 청소 소모품" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">',
          '</div>',
          '<div style="margin-bottom:12px">',
            '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">용도</label>',
            '<div id="expV6PurposeWrap" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"></div>',
            '<div id="expV6PurposeAddRow" style="display:none;gap:6px;margin-top:8px;align-items:center">',
              '<input type="text" id="expV6PurposeInp" placeholder="용도 이름" style="flex:1;height:34px;padding:0 10px;border:1.5px solid #3f7cb8;border-radius:20px;font-size:13px;font-family:inherit;outline:none;background:#fff;color:#1a2f45;min-width:0">',
              '<button id="expV6PurposeConfirm" style="height:34px;padding:0 14px;background:#3f7cb8;color:#fff;border:none;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0">추가</button>',
              '<button id="expV6PurposeCancel" style="height:34px;padding:0 12px;background:#f0f4f8;color:#7a92a8;border:none;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0">취소</button>',
            '</div>',
          '</div>',
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">',
            '<div>',
              '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">금액 (원)</label>',
              '<input type="number" id="expV6Amount" placeholder="0" min="0" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #3f7cb8;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;background:#f7faff;outline:none;color:#185FA5;text-align:right">',
            '</div>',
            '<div>',
              '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">영수증</label>',
              '<div style="display:flex;gap:6px">',
                '<button data-receipt="있음" class="expReceiptBtn" style="flex:1;height:40px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;background:#f7faff;color:#7a92a8">있음</button>',
                '<button data-receipt="없음" class="expReceiptBtn" style="flex:1;height:40px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;background:#f7faff;color:#7a92a8">없음</button>',
              '</div>',
            '</div>',
          '</div>',
          /* 자재 목록 */
          '<div id="expV6MatArea" style="display:none;margin-bottom:12px">',
            '<div style="background:#f0f6ff;border:1.5px solid #93c5fd;border-radius:12px;padding:12px">',
              '<div style="font-size:12px;font-weight:700;color:#185FA5;margin-bottom:10px">📦 자재 목록</div>',
              '<div style="display:grid;grid-template-columns:1fr 52px 76px 32px;gap:5px;margin-bottom:5px;padding:0 2px">',
                '<div style="font-size:10px;font-weight:700;color:#7a92a8">품명 · 규격</div>',
                '<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:center">수량</div>',
                '<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">단가(원)</div>',
                '<div></div>',
              '</div>',
              '<div id="expV6MatList"></div>',
              '<button id="expV6MatAdd" style="width:100%;height:34px;border:1.5px dashed #93c5fd;border-radius:10px;background:transparent;font-size:13px;font-weight:600;color:#3f7cb8;cursor:pointer;font-family:inherit;margin-top:4px">➕ 품목 추가</button>',
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:8px 12px;background:#fff;border:1.5px solid #93c5fd;border-radius:10px">',
                '<span style="font-size:13px;font-weight:700;color:#185FA5">합계</span>',
                '<span id="expV6MatTotal" style="font-size:18px;font-weight:800;color:#0C447C">₩0</span>',
              '</div>',
            '</div>',
          '</div>',
          '<div style="margin-bottom:12px">',
            '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">품의서 상태</label>',
            '<select id="expV6BillStatus" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">',
              '<option>대기</option><option>제출</option><option>완료</option>',
            '</select>',
          '</div>',
        '</div>',

        /* 후불청구 영역 */
        '<div id="expV6DeferArea" style="display:none">',
          '<div style="margin-bottom:12px">',
            '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">업체명</label>',
            '<input type="text" id="expV6DeferVendor" placeholder="예: 고려이엔알" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #fdba74;border-radius:10px;font-size:14px;font-family:inherit;background:#fff7ed;outline:none;color:#1a2f45">',
          '</div>',
          '<div style="margin-bottom:12px">',
            '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">청구 내역</label>',
            '<input type="text" id="expV6DeferDesc" placeholder="예: 대형폐기물 처리" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">',
          '</div>',
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">',
            '<div>',
              '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">청구금액 (원)</label>',
              '<input type="number" id="expV6DeferAmount" placeholder="0" min="0" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #fdba74;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;background:#fff7ed;outline:none;color:#c2410c;text-align:right">',
            '</div>',
            '<div>',
              '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">세금계산서</label>',
              '<select id="expV6TaxInvoice" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">',
                '<option value="">선택</option><option value="발행">✅ 발행</option><option value="발행예정">⏳ 발행예정</option><option value="미발행">❌ 미발행</option>',
              '</select>',
            '</div>',
          '</div>',
          '<div style="margin-bottom:12px">',
            '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">관리비 포함 상태</label>',
            '<select id="expV6MgmtStatus" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">',
              '<option>미포함</option><option>포함</option><option>수금완료</option>',
            '</select>',
          '</div>',
        '</div>',

        /* 공통 메모 */
        '<div style="margin-bottom:16px">',
          '<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">메모</label>',
          '<input type="text" id="expV6Memo" placeholder="간단한 메모" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">',
        '</div>',

        '<div style="display:flex;gap:8px">',
          '<button id="expV6Del" style="flex:1;height:48px;border-radius:12px;border:none;background:#fde8e8;color:#b52929;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;display:none">삭제</button>',
          '<button id="expV6Save" style="flex:2;height:48px;border-radius:12px;border:none;background:#3f7cb8;color:#fff;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer">저장</button>',
        '</div>',

      '</div>'
    ].join('');
    document.body.appendChild(div);
    bindModalEvents();
  }

  /* ── 열기/닫기 ── */
  function openExpV6(id) {
    _editId = id || null;
    _matItems = [];
    _selPurpose = {};
    _purposes = loadPurposes();

    var modal = g(MODAL_ID);
    if (!modal) return;

    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

    var en = null;
    if (_editId) {
      var exps = loadExp();
      en = exps.find(function(x) { return x.id === _editId; });
    }

    g('expV6Date').value       = en ? (en.date || todayStr) : todayStr;
    g('expV6Vendor').value     = en ? (en.vendor || '') : '';
    g('expV6Desc').value       = en ? (en.desc || '') : '';
    g('expV6Amount').value     = en ? (en.amount || '') : '';
    g('expV6DeferVendor').value  = en ? (en.deferVendor || '') : '';
    g('expV6DeferDesc').value    = en ? (en.deferDesc || '') : '';
    g('expV6DeferAmount').value  = en ? (en.deferAmount || '') : '';
    g('expV6TaxInvoice').value   = en ? (en.taxInvoice || '') : '';
    g('expV6MgmtStatus').value   = en ? (en.mgmtStatus || '미포함') : '미포함';
    g('expV6BillStatus').value   = en ? (en.billStatus || '대기') : '대기';
    g('expV6Memo').value         = en ? (en.memo || '') : '';

    _expType   = en ? (en.expType || '없음') : '없음';
    _payMethod = en ? (en.payMethod || '💳 카드') : '💳 카드';
    if (en && en.purposes) en.purposes.forEach(function(p) { _selPurpose[p] = true; });
    _matItems  = en && en.matItems ? JSON.parse(JSON.stringify(en.matItems)) : [];

    /* 영수증 버튼 초기화 */
    var defReceipt = en ? (en.receipt || '없음') : '없음';
    document.querySelectorAll('.expReceiptBtn').forEach(function(b) {
      var on = b.dataset.receipt === defReceipt;
      b.style.background  = on ? '#e8f0fa' : '#f7faff';
      b.style.borderColor = on ? '#3f7cb8' : '#dbe6f4';
      b.style.color       = on ? '#1a4a8a' : '#7a92a8';
    });

    g('expV6Del').style.display = _editId ? '' : 'none';
    g('expV6Title').textContent = _editId ? '지출 수정' : '지출 등록';

    renderTypeBtns();
    renderPayBtns();
    renderPurposeChips();
    renderMatList();
    updateAreaVisibility();

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeExpV6() {
    var modal = g(MODAL_ID);
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  /* ── 종류 버튼 ── */
  function renderTypeBtns() {
    var wrap = g('expV6TypeBtns');
    if (!wrap) return;
    wrap.innerHTML = '';
    EXP_TYPES.forEach(function(t) {
      var btn = document.createElement('button');
      var on = _expType === t;
      btn.textContent = t;
      btn.style.cssText = 'flex:1;height:40px;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;border:1.5px solid ' + (on ? '#3f7cb8' : '#dbe6f4') + ';background:' + (on ? '#3f7cb8' : '#f7faff') + ';color:' + (on ? '#fff' : '#7a92a8');
      btn.addEventListener('click', function() {
        _expType = t;
        renderTypeBtns();
        updateAreaVisibility();
      });
      wrap.appendChild(btn);
    });
  }

  /* ── 결제수단 버튼 ── */
  function renderPayBtns() {
    var wrap = g('expV6PayBtns');
    if (!wrap) return;
    wrap.innerHTML = '';
    PAY_METHODS.forEach(function(m) {
      var btn = document.createElement('button');
      var on = _payMethod === m;
      btn.textContent = m;
      btn.style.cssText = 'flex:1;height:40px;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;border:1.5px solid ' + (on ? '#3f7cb8' : '#dbe6f4') + ';background:' + (on ? '#e8f0fa' : '#f7faff') + ';color:' + (on ? '#1a4a8a' : '#7a92a8');
      btn.addEventListener('click', function() { _payMethod = m; renderPayBtns(); });
      wrap.appendChild(btn);
    });
  }

  /* ── 용도 칩 ── */
  function renderPurposeChips() {
    var wrap = g('expV6PurposeWrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    _purposes.forEach(function(p, i) {
      var on = !!_selPurpose[p.label];
      var chip = document.createElement('span');
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:13px;padding:5px 11px;border-radius:20px;border:1.5px solid ' + (on ? '#3f7cb8' : '#dbe6f4') + ';background:' + (on ? '#e8f0fa' : '#f7faff') + ';color:' + (on ? '#1a4a8a' : '#7a92a8') + ';cursor:pointer;user-select:none;font-family:inherit';

      var icon = document.createElement('span'); icon.textContent = p.icon;
      var lbl  = document.createElement('span'); lbl.textContent = p.label;

      var del  = document.createElement('span');
      del.textContent = '✕';
      del.style.cssText = 'font-size:10px;width:14px;height:14px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .1s;margin-left:2px';
      chip.addEventListener('mouseenter', function() { del.style.opacity = '1'; });
      chip.addEventListener('mouseleave', function() { del.style.opacity = '0'; });

      del.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!confirm('"' + p.label + '" 용도를 삭제할까요?')) return;
        delete _selPurpose[p.label];
        _purposes.splice(i, 1);
        savePurposes(_purposes);
        renderPurposeChips();
        updateMatArea();
      });

      chip.addEventListener('click', function() {
        if (_selPurpose[p.label]) delete _selPurpose[p.label];
        else _selPurpose[p.label] = true;
        renderPurposeChips();
        updateMatArea();
      });

      chip.appendChild(icon); chip.appendChild(lbl); chip.appendChild(del);
      wrap.appendChild(chip);
    });

    /* ➕ 추가 칩 */
    var addChip = document.createElement('span');
    addChip.innerHTML = '➕ 추가';
    addChip.style.cssText = 'display:inline-flex;align-items:center;gap:3px;font-size:13px;padding:5px 11px;border-radius:20px;border:1.5px dashed #dbe6f4;color:#7a92a8;background:transparent;cursor:pointer;font-family:inherit';
    addChip.addEventListener('click', function() {
      var row = g('expV6PurposeAddRow');
      if (row) { row.style.display = 'flex'; addChip.style.display = 'none'; }
      var inp = g('expV6PurposeInp');
      if (inp) { inp.value = ''; inp.focus(); }
    });
    wrap.appendChild(addChip);
  }

  function doAddPurpose() {
    var val = (g('expV6PurposeInp').value || '').trim();
    if (!val) return;
    if (_purposes.find(function(p) { return p.label === val; })) {
      if (typeof toast === 'function') toast('이미 있는 용도예요'); return;
    }
    _purposes.push({ icon: '📌', label: val });
    savePurposes(_purposes);
    _selPurpose[val] = true;
    var row = g('expV6PurposeAddRow');
    if (row) row.style.display = 'none';
    renderPurposeChips();
    updateMatArea();
  }

  /* ── 자재 목록 ── */
  function updateMatArea() {
    var area = g('expV6MatArea');
    if (area) area.style.display = _selPurpose['자재구매'] ? '' : 'none';
  }

  function renderMatList() {
    var list = g('expV6MatList');
    if (!list) return;
    list.innerHTML = '';
    _matItems.forEach(function(it, i) {
      var row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr 52px 76px 32px;gap:5px;align-items:center;margin-bottom:6px';

      var nameInp  = mkMatInp('text',   it.name,  '품명·규격');
      var qtyInp   = mkMatInp('number', it.qty,   '0'); qtyInp.style.textAlign = 'center';
      var priceInp = mkMatInp('number', it.price, '0'); priceInp.style.textAlign = 'right';

      nameInp.addEventListener('input',  function(e) { _matItems[i].name  = e.target.value; });
      qtyInp.addEventListener('input',   function(e) { _matItems[i].qty   = parseFloat(e.target.value) || 0; calcMatTotal(); });
      priceInp.addEventListener('input', function(e) { _matItems[i].price = parseFloat(e.target.value) || 0; calcMatTotal(); });

      var delBtn = document.createElement('button');
      delBtn.innerHTML = '🗑';
      delBtn.style.cssText = 'width:32px;height:34px;border:1.5px solid #dbe6f4;border-radius:8px;background:#f7faff;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center';
      (function(idx) {
        delBtn.addEventListener('click', function() {
          _matItems.splice(idx, 1);
          renderMatList();
          calcMatTotal();
        });
      })(i);

      row.appendChild(nameInp); row.appendChild(qtyInp); row.appendChild(priceInp); row.appendChild(delBtn);
      list.appendChild(row);
    });
    calcMatTotal();
  }

  function mkMatInp(type, val, ph) {
    var inp = document.createElement('input');
    inp.type = type; inp.value = val || ''; inp.placeholder = ph;
    inp.style.cssText = 'width:100%;box-sizing:border-box;height:34px;padding:0 8px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#fff;outline:none;color:#1a2f45';
    inp.addEventListener('focus', function() { inp.style.borderColor = '#3f7cb8'; });
    inp.addEventListener('blur',  function() { inp.style.borderColor = '#dbe6f4'; });
    return inp;
  }

  function calcMatTotal() {
    var total = _matItems.reduce(function(s, it) { return s + ((it.qty || 0) * (it.price || 0)); }, 0);
    var el = g('expV6MatTotal');
    if (el) el.textContent = fmt(total);
    if (total > 0) {
      var amtEl = g('expV6Amount');
      if (amtEl && !amtEl._manual) amtEl.value = total;
    }
  }

  /* ── 영역 표시 ── */
  function updateAreaVisibility() {
    var isP = _expType === '💸 개인비용';
    var isD = _expType === '📃 후불청구';
    g('expV6PersonalArea').style.display = isP ? '' : 'none';
    g('expV6DeferArea').style.display    = isD ? '' : 'none';
    var sheet = g('expV6Sheet');
    if (sheet) sheet.style.borderTop = isP ? '3px solid #378ADD' : isD ? '3px solid #D85A30' : '3px solid #dbe6f4';
    if (isP) updateMatArea();
  }

  /* ── 저장 ── */
  function saveExpV6() {
    var isP = _expType === '💸 개인비용';
    var isD = _expType === '📃 후불청구';

    var receipt = '없음';
    document.querySelectorAll('.expReceiptBtn').forEach(function(b) {
      if (b.style.borderColor === 'rgb(63, 124, 184)' || b.style.background === 'rgb(232, 240, 250)') receipt = b.dataset.receipt;
    });

    var data = {
      id:        _editId || genId(),
      date:      g('expV6Date').value || '',
      expType:   _expType,
      memo:      g('expV6Memo').value.trim(),
      updatedAt: Date.now()
    };

    if (isP) {
      Object.assign(data, {
        payMethod:  _payMethod,
        vendor:     g('expV6Vendor').value.trim(),
        desc:       g('expV6Desc').value.trim(),
        purposes:   Object.keys(_selPurpose).filter(function(k) { return _selPurpose[k]; }),
        amount:     parseFloat(g('expV6Amount').value) || 0,
        receipt:    receipt,
        matItems:   _matItems.slice(),
        billStatus: g('expV6BillStatus').value
      });
      if (!data.vendor && !data.desc && !data.amount) {
        if (typeof toast === 'function') toast('업체명이나 내역을 입력해주세요'); return;
      }
    }

    if (isD) {
      Object.assign(data, {
        deferVendor: g('expV6DeferVendor').value.trim(),
        deferDesc:   g('expV6DeferDesc').value.trim(),
        deferAmount: parseFloat(g('expV6DeferAmount').value) || 0,
        taxInvoice:  g('expV6TaxInvoice').value,
        mgmtStatus:  g('expV6MgmtStatus').value
      });
      if (!data.deferVendor && !data.deferDesc && !data.deferAmount) {
        if (typeof toast === 'function') toast('업체명이나 청구내역을 입력해주세요'); return;
      }
    }

    if (_expType === '없음' && !g('expV6Memo').value.trim()) {
      if (typeof toast === 'function') toast('내용을 입력해주세요'); return;
    }

    var exps = loadExp();
    if (_editId) {
      var idx = exps.findIndex(function(x) { return x.id === _editId; });
      if (idx >= 0) { data.createdAt = exps[idx].createdAt; exps[idx] = data; }
      else exps.push(data);
    } else {
      data.createdAt = Date.now();
      exps.push(data);
    }
    saveExp(exps);
    closeExpV6();
    if (typeof toast === 'function') toast('저장됐어요');
    renderExpV6Tab();
    if (typeof v43Refresh === 'function') setTimeout(v43Refresh, 200);
  }

  function deleteExpV6() {
    if (!_editId || !confirm('이 지출 항목을 삭제할까요?')) return;
    var exps = loadExp().filter(function(x) { return x.id !== _editId; });
    saveExp(exps);
    closeExpV6();
    if (typeof toast === 'function') toast('삭제됐어요');
    renderExpV6Tab();
    if (typeof v43Refresh === 'function') setTimeout(v43Refresh, 200);
  }

  /* ── 이벤트 바인딩 ── */
  function bindModalEvents() {
    g('expV6Close').addEventListener('click', closeExpV6);
    g('expV6Save').addEventListener('click',  saveExpV6);
    g('expV6Del').addEventListener('click',   deleteExpV6);

    g('expV6MatAdd').addEventListener('click', function() {
      _matItems.push({ name: '', qty: '', price: '' });
      renderMatList();
      var rows = g('expV6MatList').querySelectorAll('input[type=text]');
      if (rows.length) rows[rows.length - 1].focus();
    });

    g('expV6PurposeConfirm').addEventListener('click', doAddPurpose);
    g('expV6PurposeCancel').addEventListener('click', function() {
      var row = g('expV6PurposeAddRow');
      if (row) row.style.display = 'none';
      renderPurposeChips();
    });
    g('expV6PurposeInp').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); doAddPurpose(); }
    });

    document.querySelectorAll('.expReceiptBtn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.expReceiptBtn').forEach(function(b) {
          b.style.background  = '#f7faff';
          b.style.borderColor = '#dbe6f4';
          b.style.color       = '#7a92a8';
        });
        btn.style.background  = '#e8f0fa';
        btn.style.borderColor = '#3f7cb8';
        btn.style.color       = '#1a4a8a';
      });
    });

    var amtEl = g('expV6Amount');
    if (amtEl) amtEl.addEventListener('input', function() { amtEl._manual = true; });

    g(MODAL_ID).addEventListener('click', function(e) {
      if (e.target === g(MODAL_ID)) closeExpV6();
    });
  }

  /* ── 지출 탭 렌더 ── */
  function renderExpV6Tab() {
    var exps = loadExp().sort(function(a, b) {
      return (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0);
    });

    var now = new Date();
    var thisMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    var personalThisMonth = exps.filter(function(e) { return e.expType === '💸 개인비용' && (e.date || '').startsWith(thisMonth); });
    var personalTotal     = personalThisMonth.reduce(function(s, e) { return s + (e.amount || 0); }, 0);
    var personalPending   = exps.filter(function(e) { return e.expType === '💸 개인비용' && e.billStatus === '대기'; }).length;
    var deferPending      = exps.filter(function(e) { return e.expType === '📃 후불청구' && e.mgmtStatus === '미포함'; });
    var deferTotal        = deferPending.reduce(function(s, e) { return s + (e.deferAmount || 0); }, 0);

    /* 대시보드 */
    var dash = g('expV6Dashboard');
    if (dash) {
      dash.innerHTML = [
        '<div style="background:#fff;border:1.5px solid #e8f0fa;border-left:3px solid #378ADD;border-radius:12px;padding:12px 14px">',
          '<div style="font-size:11px;color:#7a92a8;margin-bottom:3px">이달 개인비용</div>',
          '<div style="font-size:20px;font-weight:800;color:#185FA5">' + fmt(personalTotal) + '</div>',
          '<div style="font-size:11px;color:#7a92a8;margin-top:3px">품의서 대기 <span style="color:#e74c3c;font-weight:700">' + personalPending + '건</span></div>',
        '</div>',
        '<div style="background:#fff;border:1.5px solid #e8f0fa;border-left:3px solid #D85A30;border-radius:12px;padding:12px 14px">',
          '<div style="font-size:11px;color:#7a92a8;margin-bottom:3px">미처리 후불청구</div>',
          '<div style="font-size:20px;font-weight:800;color:#712B13">' + fmt(deferTotal) + '</div>',
          '<div style="font-size:11px;color:#7a92a8;margin-top:3px">관리비 미포함 <span style="color:#e74c3c;font-weight:700">' + deferPending.length + '건</span></div>',
        '</div>'
      ].join('');
    }

    /* 경고바 */
    var warn = g('expV6WarnBar');
    if (warn) {
      if (deferPending.length > 0) {
        warn.style.display = '';
        warn.textContent = '⚠️ 후불청구 ' + deferPending.length + '건이 아직 관리비에 포함되지 않았어요';
      } else {
        warn.style.display = 'none';
      }
    }

    /* 필터 칩 */
    var fw = g('expV6Filters');
    if (fw) {
      var filters = [
        { key: 'all',      label: '전체' },
        { key: 'personal', label: '💸 개인비용' },
        { key: 'defer',    label: '📃 후불청구' },
        { key: 'pending',  label: '🔴 미처리만' }
      ];
      fw.innerHTML = '';
      filters.forEach(function(f) {
        var btn = document.createElement('button');
        var on = _expFilter === f.key;
        btn.textContent = f.label;
        btn.style.cssText = 'font-size:12px;padding:5px 12px;border-radius:20px;border:1.5px solid ' + (on ? '#3f7cb8' : '#dbe6f4') + ';background:' + (on ? '#3f7cb8' : '#fff') + ';color:' + (on ? '#fff' : '#7a92a8') + ';cursor:pointer;font-family:inherit;font-weight:600';
        btn.addEventListener('click', function() { _expFilter = f.key; renderExpV6Tab(); });
        fw.appendChild(btn);
      });
    }

    /* 목록 */
    var list = exps;
    if (_expFilter === 'personal') list = exps.filter(function(e) { return e.expType === '💸 개인비용'; });
    if (_expFilter === 'defer')    list = exps.filter(function(e) { return e.expType === '📃 후불청구'; });
    if (_expFilter === 'pending')  list = exps.filter(function(e) {
      return (e.expType === '💸 개인비용' && e.billStatus === '대기') ||
             (e.expType === '📃 후불청구' && e.mgmtStatus === '미포함');
    });

    var listEl = g('expV6List');
    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:48px 20px;color:#aab8c8"><div style="font-size:36px;margin-bottom:10px">💰</div><div style="font-size:14px">등록된 지출이 없어요</div></div>';
      return;
    }

    listEl.innerHTML = '<div style="background:#fff;border:1.5px solid #e8f0fa;border-radius:14px;overflow:hidden">' + list.map(renderExpItem).join('') + '</div>';
    listEl.querySelectorAll('[data-expid]').forEach(function(el) {
      el.addEventListener('click', function() { openExpV6(el.dataset.expid); });
    });
  }

  function renderExpItem(e) {
    var isP = e.expType === '💸 개인비용';
    var isD = e.expType === '📃 후불청구';
    var borderL = isP ? '#378ADD' : isD ? '#D85A30' : '#dbe6f4';
    var typeBg  = isP ? '#E6F1FB' : isD ? '#FAECE7' : '#f0f4f8';
    var typeC   = isP ? '#185FA5' : isD ? '#712B13' : '#7a92a8';

    var title  = isP ? (e.desc || e.vendor || '(내역없음)') : isD ? (e.deferDesc || e.deferVendor || '(내역없음)') : (e.memo || '(메모없음)');
    var vendor = isP ? e.vendor : isD ? e.deferVendor : '';
    var amount = isP ? e.amount : isD ? e.deferAmount : 0;

    var statusBadge = '';
    if (isP && e.billStatus) {
      var map = { '대기': '#faeeda|#633806|#EF9F27', '제출': '#E6F1FB|#0C447C|#378ADD', '완료': '#EAF3DE|#27500A|#639922' };
      var sc = map[e.billStatus];
      if (sc) { var p = sc.split('|'); statusBadge = '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:' + p[0] + ';color:' + p[1] + '"><span style="width:5px;height:5px;border-radius:50%;background:' + p[2] + ';display:inline-block"></span>품의서 ' + esc(e.billStatus) + '</span>'; }
    }
    if (isD && e.mgmtStatus) {
      var map2 = { '미포함': '#FCEBEB|#791F1F|#E24B4A', '포함': '#E6F1FB|#0C447C|#378ADD', '수금완료': '#EAF3DE|#27500A|#639922' };
      var sc2 = map2[e.mgmtStatus];
      if (sc2) { var p2 = sc2.split('|'); statusBadge = '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:' + p2[0] + ';color:' + p2[1] + '"><span style="width:5px;height:5px;border-radius:50%;background:' + p2[2] + ';display:inline-block"></span>' + esc(e.mgmtStatus) + '</span>'; }
    }

    return '<div data-expid="' + esc(e.id) + '" style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid #f0f6ff;cursor:pointer;border-left:3px solid ' + borderL + '" onmouseenter="this.style.background=\'#f7faff\'" onmouseleave="this.style.background=\'\'">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:14px;font-weight:700;color:#1a2f45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(title) + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px">' +
          '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:' + typeBg + ';color:' + typeC + '">' + esc(e.expType || '없음') + '</span>' +
          statusBadge +
          (vendor ? '<span style="font-size:11px;color:#7a92a8">' + esc(vendor) + '</span>' : '') +
          (e.payMethod ? '<span style="font-size:10px;color:#aab8c8">' + esc(e.payMethod) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
        '<div style="font-size:14px;font-weight:800;color:' + (isP ? '#185FA5' : isD ? '#712B13' : '#1a2f45') + '">' + (amount > 0 ? fmt(amount) : '') + '</div>' +
        '<div style="font-size:11px;color:#aab8c8;margin-top:2px">' + esc(e.date || '') + '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── 지출 탭 패널 생성 ── */
  function buildExpTabPanel() {
    /* 탭 버튼 추가 */
    var tabBar = document.getElementById('v43Tabs');
    if (tabBar && !document.querySelector('.v43-tab[data-v43tab="expv6"]')) {
      var tab = document.createElement('button');
      tab.className = 'v43-tab';
      tab.dataset.v43tab = 'expv6';
      tab.textContent = '💰 지출';
      tabBar.appendChild(tab);
      tab.addEventListener('click', function() {
        if (typeof v43ActivateTab === 'function') v43ActivateTab('expv6');
        renderExpV6Tab();
      });
    }

    /* 패널 생성 */
    var main = document.querySelector('main.wrap');
    if (main && !g('v43-expv6')) {
      var panel = document.createElement('div');
      panel.className = 'v43-panel';
      panel.id = 'v43-expv6';
      panel.innerHTML = [
        '<div style="margin-top:14px">',
          '<div id="expV6Dashboard" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"></div>',
          '<div id="expV6WarnBar" style="display:none;background:#fff3cd;border:1.5px solid #ffd54f;border-radius:10px;padding:9px 13px;margin-bottom:10px;font-size:13px;font-weight:700;color:#7c5e1a"></div>',
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px" id="expV6Filters"></div>',
          '<div id="expV6List"></div>',
          '<button id="expV6AddBtn" style="width:100%;height:48px;margin-top:12px;background:#3f7cb8;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer">➕ 지출 등록</button>',
        '</div>'
      ].join('');
      main.appendChild(panel);
      g('expV6AddBtn').addEventListener('click', function() { openExpV6(null); });
    }
  }

  /* ── v43ActivateTab 훅 ── */
  function hookActivateTab() {
    if (window._expV6TabHooked) return;
    var orig = window.v43ActivateTab;
    if (!orig) return;
    window.v43ActivateTab = function(name) {
      orig(name);
      if (name === 'expv6') {
        var panel = g('v43-expv6');
        if (panel) {
          document.querySelectorAll('.v43-panel').forEach(function(p) { p.classList.remove('active'); });
          panel.classList.add('active');
        }
        renderExpV6Tab();
      }
    };
    window.v43ActivateTab._expV6Hooked = true;
    window._expV6TabHooked = true;
  }

  /* ── 기록탭 FAB에 지출 항목 추가 ── */
  function addExpToFab() {
    var catOverlay = g('v43CatOverlay');
    var catGrid = catOverlay && catOverlay.querySelector('.v43-cat-grid');
    if (catGrid && !catGrid.querySelector('[data-add="expv6"]')) {
      var btn = document.createElement('button');
      btn.className = 'v43-cat-btn';
      btn.dataset.add = 'expv6';
      btn.innerHTML = '<span class="ci">💰</span><span class="cl">지출</span>';
      btn.addEventListener('click', function() {
        catOverlay.classList.remove('show');
        setTimeout(function() { openExpV6(null); }, 200);
      });
      catGrid.appendChild(btn);
    }
  }

  /* ── 초기화 ── */
  function init() {
    injectModal();
    buildExpTabPanel();
    hookActivateTab();
    addExpToFab();
    /* 전역 노출 */
    window.openExpV6Modal  = openExpV6;
    window.renderExpV6Tab  = renderExpV6Tab;
  }

  setTimeout(init, 600);
  setTimeout(init, 2000);

  console.log('[worklog_patch_v44] 지출 모달 패치 로드 완료');
})();
