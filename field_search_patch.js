/* =====================================================
   worklog v44 PATCH — field_search_patch.js
   분야 검색: 클릭 시 전체 목록 먼저 표시
   적용: worklog.html의 </body> 바로 앞에 삽입
   ===================================================== */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────
     화면 구조 분석:
     [분야 인풋] [X] [⚙]
       └─ 드롭다운:
            [전기 ㅈㄱ]  ← 초성칩
            [업체명 검색...] ← 검색 인풋
            (리스트 아이템들 — 현재 안 보임)

     worklog.js는 분야 드롭다운을 열 때
     검색 인풋에 포커스 + 빈 값이면 리스트를 숨기거나
     초성칩만 보여주는 것으로 추정.

     해결: "업체명 검색..." 인풋이 활성화될 때
           → input 이벤트 + keyup 이벤트를 공백(' ')으로 발화
           → 그래도 안 되면 모든 li를 강제 display:''
  ────────────────────────────────────────────────────── */

  /* 전체 목록 강제 표시 */
  function forceShowAll(inp) {
    /* 드롭다운 컨테이너 탐색 (인풋 기준 위로 3단계) */
    let container = inp.parentElement;
    for (let i = 0; i < 4 && container; i++) {
      const items = container.querySelectorAll('li, [data-field], .field-item');
      if (items.length > 0) {
        items.forEach(function (el) {
          el.style.display = '';
          el.style.visibility = '';
          el.style.opacity = '1';
        });
        return;
      }
      container = container.parentElement;
    }
  }

  /* 검색 인풋에 이벤트 연결 */
  function bindSearchInput(inp) {
    if (inp._fsBound) return;
    inp._fsBound = true;

    function trigger() {
      /* 1. input 이벤트 (worklog.js 필터 트리거) */
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      /* 2. keyup 이벤트 */
      inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
      /* 3. 강제 DOM 표시 */
      setTimeout(function () { forceShowAll(inp); }, 30);
      setTimeout(function () { forceShowAll(inp); }, 120);
    }

    inp.addEventListener('focus', function () { setTimeout(trigger, 40); });
    inp.addEventListener('click', function (e) { e.stopPropagation(); setTimeout(trigger, 40); });
    inp.addEventListener('input', function () {
      if (!inp.value.trim()) setTimeout(function () { forceShowAll(inp); }, 30);
    });
  }

  /* DOM 스캔하여 분야 검색 인풋 찾아 바인딩 */
  function scanAndBind() {
    document.querySelectorAll('input').forEach(function (inp) {
      /* placeholder 기준 */
      if (inp.placeholder && inp.placeholder.indexOf('업체명') >= 0) {
        bindSearchInput(inp);
      }
      /* class 기준 */
      if (inp.className && inp.className.indexOf('field-search') >= 0) {
        bindSearchInput(inp);
      }
    });
  }

  /* MutationObserver: 모달/드롭다운이 동적으로 생성될 때 감지 */
  new MutationObserver(function (mutations) {
    let needScan = false;
    mutations.forEach(function (m) {
      if (m.addedNodes.length) needScan = true;
    });
    if (needScan) setTimeout(scanAndBind, 60);
  }).observe(document.body, { childList: true, subtree: true });

  /* 이벤트 위임 (가장 안정적) */
  document.addEventListener('focusin', function (e) {
    const inp = e.target;
    if (!inp || inp.tagName !== 'INPUT') return;
    const ph = inp.placeholder || '';
    const cn = inp.className || '';
    if (ph.indexOf('업체명') < 0 && cn.indexOf('field-search') < 0) return;
    bindSearchInput(inp);
    setTimeout(function () {
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      forceShowAll(inp);
    }, 50);
  }, true);

  document.addEventListener('click', function (e) {
    const inp = e.target;
    if (!inp || inp.tagName !== 'INPUT') return;
    const ph = inp.placeholder || '';
    if (ph.indexOf('업체명') < 0) return;
    setTimeout(function () {
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      forceShowAll(inp);
    }, 40);
  }, true);

  /* 초기 + 지연 스캔 */
  setTimeout(scanAndBind, 600);
  setTimeout(scanAndBind, 2000);

  console.log('[field_search_patch] 로드 완료');
})();
