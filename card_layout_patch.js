/* =====================================================
   worklog v44 PATCH — card_layout_patch.js
   - 층 뱃지: 제목 왼쪽
   - 세부내용: 제목 옆 (줄바꿈 허용)
   - 업체(파랑) · 자재(보라): 왼쪽 하단
   - 날짜 / 완료+분야: 항상 오른쪽 고정
   - '업무' 태그 제거
   ===================================================== */

(function () {
  'use strict';

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

  function rewriteCard(el) {
    el._cardRewritten = false;
    if (el._cardRewriting) return;
    el._cardRewriting = true;

    const id   = el.dataset.id || '';
    const kind = el.dataset.kind || '';

    let en = null;
    if (typeof entries !== 'undefined' && id) {
      en = entries.find(function (x) { return x.id === id; });
    }
    if (!en) { el._cardRewriting = false; return; }

    const floor    = en.floor    || '';
    const title    = en.title    || '';
    const detail   = en.detail   || en.body || '';
    const vendor   = en.vendor   || en.company || '';
    const material = en.material || en.mat || '';
    const status   = en.status   || '';
    const field    = en.field    || en.loc || '';
    const date     = en.date     || '';

    const ICON = {
      work:'🛠', call:'📞', meeting:'💼', deliver:'📢',
      vacation:'🌴', expense:'💰', schedule:'📅', plan:'✅'
    };
    const icon = ICON[kind] || '📄';
    const ss = STATUS_STYLE[status] || { bg:'#f0f0f0', color:'#888' };

    /* 층 뱃지 */
    const floorBadge = floor
      ? `<span style="background:#e8f0fa;color:#3f7cb8;padding:1px 7px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;flex-shrink:0">${esc(floor)}</span>`
      : '';

    /* 세부내용: 줄바꿈 허용 (white-space:normal) */
    const detailSpan = detail
      ? `<span style="font-size:12px;color:#7a92a8;word-break:break-all;line-height:1.5">· ${esc(detail)}</span>`
      : '';

    /* 업체·자재 */
    const vendorBadge = vendor
      ? `<span style="background:#f0f6ff;color:#2563a8;padding:1px 8px;border-radius:8px;font-size:11px;font-weight:600;white-space:nowrap">${esc(vendor)}</span>`
      : '';
    const matBadge = material
      ? `<span style="background:#f5f0ff;color:#6d28d9;padding:1px 8px;border-radius:8px;font-size:11px;font-weight:600;white-space:nowrap">${esc(material)}</span>`
      : '';
    const row2 = (vendor || material)
      ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">${vendorBadge}${matBadge}</div>`
      : '';

    /* 완료+분야 */
    const statusBadge = status
      ? `<span style="background:${ss.bg};color:${ss.color};padding:1px 7px;border-radius:8px;font-size:11px;font-weight:600;white-space:nowrap">${esc(status)}</span>`
      : '';
    const fieldBadge = field
      ? `<span style="background:#f0f6ff;color:#3f7cb8;padding:1px 7px;border-radius:8px;font-size:11px;white-space:nowrap">${esc(field)}</span>`
      : '';
    const rightRow2 = (status || field)
      ? `<div style="display:flex;gap:4px;align-items:center;justify-content:flex-end;flex-wrap:nowrap">${statusBadge}${fieldBadge}</div>`
      : '';

    /* ── 핵심: 오른쪽 영역 width 고정 → 절대 밀리지 않음 ── */
    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;width:100%">

        <span style="font-size:19px;margin-top:1px;flex-shrink:0">${icon}</span>

        <!-- 왼쪽: 제목+내용 / 업체+자재 -->
        <div style="flex:1;min-width:0;overflow:hidden">
          <div style="display:flex;align-items:baseline;gap:5px;flex-wrap:wrap">
            ${floorBadge}
            <span style="font-size:14px;font-weight:600;color:#1a2f45;word-break:keep-all">${esc(title)}</span>
            ${detailSpan}
          </div>
          ${row2}
        </div>

        <!-- 오른쪽: 고정 너비 → 항상 오른쪽 끝 -->
        <div style="flex:0 0 auto;width:90px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;margin-left:8px">
          <span style="font-size:11px;color:#9aaab8;white-space:nowrap">${esc(date)}</span>
          ${rightRow2}
        </div>

      </div>`;

    el._cardRewriting = false;
  }

  function rewriteAllCards() {
    const list = document.getElementById('v43List');
    if (!list) return;
    list.querySelectorAll('.v43-item').forEach(function (el) {
      el._cardRewritten = false;
      rewriteCard(el);
    });
  }

  /* renderV43List / v43Refresh 후킹 */
  function hookRenders() {
    if (typeof window.v43Refresh === 'function' && !window.v43Refresh._layoutPatched) {
      const orig = window.v43Refresh;
      window.v43Refresh = function () {
        orig.apply(this, arguments);
        setTimeout(rewriteAllCards, 60);
      };
      window.v43Refresh._layoutPatched = true;
    }
  }

  /* v43List 변경 감지 */
  function startObserver() {
    const list = document.getElementById('v43List');
    if (!list) { setTimeout(startObserver, 400); return; }
    new MutationObserver(function () {
      setTimeout(rewriteAllCards, 40);
    }).observe(list, { childList: true });
    rewriteAllCards();
  }

  setTimeout(function () { hookRenders(); startObserver(); }, 800);
  setTimeout(function () { hookRenders(); rewriteAllCards(); }, 2200);

  /* 탭·필터 변경 시 재적용 */
  document.addEventListener('click', function (e) {
    if (e.target.closest('.v43-tab[data-v43tab="main"]')) setTimeout(rewriteAllCards, 200);
  });
  document.addEventListener('change', function (e) {
    if (e.target && ['v43CatSelect','v43From','v43To'].includes(e.target.id)) {
      setTimeout(rewriteAllCards, 150);
    }
  });

  console.log('[card_layout_patch] 로드 완료');
})();
