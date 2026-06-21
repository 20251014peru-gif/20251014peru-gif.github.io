/* =====================================================
   worklog v44 PATCH — card_layout_patch.js
   기록 카드 레이아웃 변경:
   - 제목 왼쪽에 층 뱃지
   - 제목 옆(같은 줄)에 · 세부내용
   - 2줄: 업체(파랑) · 자재(보라)
   - 오른쪽 1줄: 날짜
   - 오른쪽 2줄: 완료상태 + 분야 (같은 줄)
   - '업무' 태그 제거
   적용: worklog.html의 </body> 바로 앞에 삽입
   ===================================================== */

(function () {
  'use strict';

  /* ── 상태/분야 색상 ── */
  const STATUS_STYLE = {
    '완료':   { bg:'#e6f9f0', color:'#1a7a4a' },
    '진행중': { bg:'#fff7e0', color:'#a07000' },
    '미완료': { bg:'#fde8e8', color:'#b52929' },
    '보류':   { bg:'#f0f0f0', color:'#888888' }
  };

  function esc(s) {
    return (s || '').replace(/[&<>"]/g, function (m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m];
    });
  }

  /* ── 카드 1개 재렌더 ── */
  function rewriteCard(el) {
    if (el._cardRewritten) return;
    el._cardRewritten = true;

    /* worklog.js가 data-* 속성이나 내부 span에 데이터를 심어둠
       → 기존 DOM에서 값 추출 */
    const id   = el.dataset.id || '';
    const kind = el.dataset.kind || '';

    /* entries 전역에서 직접 꺼내는 게 가장 안정적 */
    let en = null;
    if (typeof entries !== 'undefined' && id) {
      en = entries.find(function (x) { return x.id === id; });
    }
    if (!en) return;

    /* 필요한 필드 추출 */
    const floor   = en.floor   || '';          // 층
    const title   = en.title   || '';          // 제목
    const detail  = en.detail  || en.body || ''; // 세부내용
    const vendor  = en.vendor  || en.company || ''; // 업체
    const material= en.material|| en.mat    || ''; // 자재
    const status  = en.status  || '';          // 완료상태
    const field   = en.field   || en.loc    || ''; // 분야
    const date    = en.date    || '';          // 날짜

    /* 아이콘 */
    const ICON = {
      work:'🛠', call:'📞', meeting:'💼', deliver:'📢',
      vacation:'🌴', expense:'💰', schedule:'📅', plan:'✅'
    };
    const icon = ICON[kind] || '📄';

    /* 상태 스타일 */
    const ss = STATUS_STYLE[status] || { bg:'#f0f0f0', color:'#888' };

    /* ── 왼쪽 1줄: 층뱃지 + 제목 · 세부내용 ── */
    const floorBadge = floor
      ? `<span style="background:#e8f0fa;color:#3f7cb8;padding:1px 7px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;flex-shrink:0;align-self:center">${esc(floor)}</span>`
      : '';

    const detailSpan = detail
      ? `<span style="font-size:12px;color:#7a92a8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">· ${esc(detail)}</span>`
      : '';

    /* ── 왼쪽 2줄: 업체 · 자재 ── */
    const vendorBadge = vendor
      ? `<span style="background:#f0f6ff;color:#2563a8;padding:1px 8px;border-radius:8px;font-size:11px;font-weight:600;white-space:nowrap">${esc(vendor)}</span>`
      : '';
    const matBadge = material
      ? `<span style="background:#f5f0ff;color:#6d28d9;padding:1px 8px;border-radius:8px;font-size:11px;font-weight:600;white-space:nowrap">${esc(material)}</span>`
      : '';
    const row2 = (vendor || material)
      ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">${vendorBadge}${matBadge}</div>`
      : '';

    /* ── 오른쪽: 날짜 / 완료+분야 ── */
    const statusBadge = status
      ? `<span style="background:${ss.bg};color:${ss.color};padding:1px 7px;border-radius:8px;font-size:11px;font-weight:600;white-space:nowrap">${esc(status)}</span>`
      : '';
    const fieldBadge = field
      ? `<span style="background:#f0f6ff;color:#3f7cb8;padding:1px 7px;border-radius:8px;font-size:11px;white-space:nowrap">${esc(field)}</span>`
      : '';
    const rightRow2 = (status || field)
      ? `<div style="display:flex;gap:4px;align-items:center;justify-content:flex-end">${statusBadge}${fieldBadge}</div>`
      : '';

    /* ── 최종 HTML ── */
    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px">
        <span style="font-size:19px;margin-top:1px;flex-shrink:0">${icon}</span>
        <div style="flex:1;min-width:0;overflow:hidden">
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:nowrap;min-width:0;overflow:hidden">
            ${floorBadge}
            <span style="font-size:14px;font-weight:600;color:#1a2f45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:1">${esc(title)}</span>
            ${detailSpan}
          </div>
          ${row2}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;min-width:70px">
          <span style="font-size:11px;color:#9aaab8;white-space:nowrap">${esc(date)}</span>
          ${rightRow2}
        </div>
      </div>`;
  }

  /* ── v43List 안의 카드들 재렌더 ── */
  function rewriteAllCards() {
    const list = document.getElementById('v43List');
    if (!list) return;
    list.querySelectorAll('.v43-item').forEach(function (el) {
      el._cardRewritten = false; // 매번 새로 그리기 (데이터 갱신 반영)
      rewriteCard(el);
    });
  }

  /* ── renderV43List 후킹 ── */
  let _hookTried = false;
  function hookRenderV43List() {
    if (_hookTried) return;
    _hookTried = true;

    /* 방법1: window.renderV43List가 노출된 경우 */
    if (typeof window.renderV43List === 'function' && !window.renderV43List._layoutPatched) {
      const orig = window.renderV43List;
      window.renderV43List = function () {
        orig.apply(this, arguments);
        setTimeout(rewriteAllCards, 30);
      };
      window.renderV43List._layoutPatched = true;
    }

    /* 방법2: v43Refresh 후킹 */
    if (typeof window.v43Refresh === 'function' && !window.v43Refresh._layoutPatched) {
      const origR = window.v43Refresh;
      window.v43Refresh = function () {
        origR.apply(this, arguments);
        setTimeout(rewriteAllCards, 60);
      };
      window.v43Refresh._layoutPatched = true;
    }
  }

  /* ── MutationObserver: v43List DOM 변경 감지 ── */
  function startObserver() {
    const list = document.getElementById('v43List');
    if (!list) { setTimeout(startObserver, 400); return; }

    new MutationObserver(function () {
      setTimeout(rewriteAllCards, 40);
    }).observe(list, { childList: true, subtree: false });

    rewriteAllCards();
  }

  /* ── 초기화 ── */
  setTimeout(function () {
    hookRenderV43List();
    startObserver();
  }, 800);

  setTimeout(function () {
    hookRenderV43List();
    rewriteAllCards();
  }, 2000);

  /* 탭 클릭 시 재적용 */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.v43-tab[data-v43tab="main"]');
    if (btn) setTimeout(rewriteAllCards, 200);
  });

  /* 카테고리/날짜 필터 변경 시 재적용 */
  document.addEventListener('change', function (e) {
    if (e.target && (e.target.id === 'v43CatSelect' ||
        e.target.id === 'v43From' || e.target.id === 'v43To')) {
      setTimeout(rewriteAllCards, 150);
    }
  });

  console.log('[card_layout_patch] 로드 완료');
})();
