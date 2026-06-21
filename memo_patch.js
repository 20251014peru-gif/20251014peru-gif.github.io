/* =====================================================
   worklog v44 PATCH — memo_patch.js
   적용: worklog.html의 </body> 바로 앞에 삽입
   ===================================================== */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────
     1. 기록 탭 진입 시 항상 '업무' 카테고리 고정
  ────────────────────────────────────────────── */
  // v43 탭 전환 함수를 후킹 — 'main' 탭으로 올 때마다 업무 강제 선택
  const _origActivate = window.v43ActivateTab;
  window.v43ActivateTab = function (name) {
    if (_origActivate) _origActivate(name);
    if (name === 'main') {
      setTimeout(function () {
        const sel = document.getElementById('v43CatSelect');
        if (sel && sel.value !== 'work') {
          sel.value = 'work';
          sel.dispatchEvent(new Event('change'));
        }
      }, 30);
    }
  };

  // 페이지 최초 로드 시에도 업무 고정
  window.addEventListener('load', function () {
    setTimeout(function () {
      const sel = document.getElementById('v43CatSelect');
      if (sel) {
        sel.value = 'work';
        try { localStorage.setItem('v43_cat_sel', 'work'); } catch (e) {}
        sel.dispatchEvent(new Event('change'));
      }
    }, 600);
  });


  /* ──────────────────────────────────────────────
     2. 메모 팝업 HTML 삽입
  ────────────────────────────────────────────── */
  const POPUP_HTML = `
<!-- ===== 메모 상세보기 팝업 ===== -->
<div id="memoViewPopup" style="
  display:none; position:fixed; inset:0;
  background:rgba(0,0,0,.45); z-index:8000;
  align-items:center; justify-content:center; padding:16px;
">
  <div id="memoViewBox" style="
    background:#fff9c4; border-radius:20px;
    width:100%; max-width:520px; max-height:88vh;
    display:flex; flex-direction:column;
    box-shadow:0 12px 40px rgba(0,0,0,.25);
    overflow:hidden;
  ">
    <!-- 헤더 -->
    <div style="display:flex;align-items:center;gap:10px;padding:16px 18px 12px;border-bottom:1.5px solid rgba(0,0,0,.07);flex-shrink:0">
      <div id="memoViewTitle" style="flex:1;font-size:17px;font-weight:800;color:#1a2f45;word-break:break-word"></div>
      <button id="memoViewEditBtn" style="
        background:#3f7cb8;color:#fff;border:none;border-radius:10px;
        padding:7px 16px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;flex-shrink:0
      ">✏️ 수정</button>
      <button id="memoViewCloseBtn" style="
        background:#f0f4f8;border:none;border-radius:10px;
        width:36px;height:36px;font-size:18px;cursor:pointer;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
      ">✕</button>
    </div>
    <!-- 본문 -->
    <div id="memoViewBody" style="
      flex:1;overflow-y:auto;padding:16px 18px;
      font-size:14px;color:#333;line-height:1.7;word-break:break-word;
    "></div>
    <!-- 사진 -->
    <div id="memoViewPhotos" style="display:none;padding:0 18px 10px;display:flex;flex-wrap:wrap;gap:6px"></div>
    <!-- 푸터 -->
    <div style="padding:12px 18px;border-top:1.5px solid rgba(0,0,0,.07);display:flex;align-items:center;gap:8px;flex-shrink:0;background:rgba(255,255,255,.5)">
      <span id="memoViewDate" style="font-size:12px;color:#aab8c8;flex:1"></span>
      <button id="memoViewDelBtn" style="
        background:#fde8e8;color:#b52929;border:none;border-radius:10px;
        padding:7px 16px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer
      ">🗑 삭제</button>
    </div>
  </div>
</div>

<!-- ===== 메모 수정 팝업 ===== -->
<div id="memoEditPopup" style="
  display:none; position:fixed; inset:0;
  background:rgba(0,0,0,.50); z-index:8001;
  align-items:center; justify-content:center; padding:16px;
">
  <div id="memoEditBox" style="
    background:#fff9c4; border-radius:20px;
    width:100%; max-width:520px; max-height:92vh;
    display:flex; flex-direction:column;
    box-shadow:0 12px 40px rgba(0,0,0,.28);
    overflow:hidden;
  ">
    <!-- 헤더 -->
    <div style="display:flex;align-items:center;padding:16px 18px 12px;border-bottom:1.5px solid rgba(0,0,0,.07);flex-shrink:0">
      <span style="font-size:16px;font-weight:800;color:#1a2f45;flex:1">📝 메모 수정</span>
      <button id="memoEditCloseBtn" style="background:#f0f4f8;border:none;border-radius:10px;width:36px;height:36px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
    <!-- 입력 영역 -->
    <div style="flex:1;overflow-y:auto;padding:16px 18px">
      <input type="text" id="memoEditTitle" placeholder="제목 (선택)" style="
        width:100%;box-sizing:border-box;border:none;
        border-bottom:2px solid rgba(0,0,0,.12);
        background:transparent;font-size:15px;font-weight:700;
        font-family:inherit;outline:none;padding:4px 0;
        color:#222;margin-bottom:12px;
      ">
      <div id="memoEditBody" contenteditable="true" style="
        min-height:140px;outline:none;font-size:14px;
        color:#333;line-height:1.7;white-space:pre-wrap;
        word-break:break-word;padding:4px 0;
      "></div>
      <!-- 색상 선택 -->
      <div style="display:flex;gap:8px;margin-top:14px;align-items:center">
        <span style="font-size:12px;color:#999;font-weight:600">색상:</span>
        <button class="me-color" data-color="yellow" style="width:24px;height:24px;border-radius:50%;background:#fff9c4;border:2.5px solid #555;cursor:pointer;padding:0" title="노랑"></button>
        <button class="me-color" data-color="blue"   style="width:24px;height:24px;border-radius:50%;background:#dbeafe;border:2px solid #dbe6f4;cursor:pointer;padding:0" title="파랑"></button>
        <button class="me-color" data-color="green"  style="width:24px;height:24px;border-radius:50%;background:#dcfce7;border:2px solid #dbe6f4;cursor:pointer;padding:0" title="초록"></button>
        <button class="me-color" data-color="pink"   style="width:24px;height:24px;border-radius:50%;background:#fce7f3;border:2px solid #dbe6f4;cursor:pointer;padding:0" title="핑크"></button>
        <button class="me-color" data-color="orange" style="width:24px;height:24px;border-radius:50%;background:#ffedd5;border:2px solid #dbe6f4;cursor:pointer;padding:0" title="주황"></button>
      </div>
    </div>
    <!-- 푸터 -->
    <div style="padding:12px 18px;border-top:1.5px solid rgba(0,0,0,.07);display:flex;gap:8px;flex-shrink:0;background:rgba(255,255,255,.5)">
      <button id="memoEditDelBtn" style="background:#fde8e8;color:#b52929;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">🗑 삭제</button>
      <div style="flex:1"></div>
      <button id="memoEditCancelBtn" style="background:#f0f4f8;color:#7a92a8;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">취소</button>
      <button id="memoEditSaveBtn" style="background:#3f7cb8;color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">💾 저장</button>
    </div>
  </div>
</div>
`;

  // body 끝에 팝업 HTML 삽입
  document.body.insertAdjacentHTML('beforeend', POPUP_HTML);


  /* ──────────────────────────────────────────────
     3. 팝업 공통 유틸
  ────────────────────────────────────────────── */
  const COLOR_BG  = { yellow:'#fff9c4', blue:'#dbeafe', green:'#dcfce7', pink:'#fce7f3', orange:'#ffedd5' };
  const COLOR_BR  = { yellow:'#f0e060', blue:'#93c5fd',  green:'#86efac', pink:'#f9a8d4', orange:'#fdba74' };

  function getEntry(id) {
    if (typeof entries !== 'undefined') return entries.find(function (x) { return x.id === id; });
    return null;
  }

  function getColor(en) {
    const COLORS = ['yellow','blue','green','pink','orange'];
    return COLORS.includes(en.stickyColor) ? en.stickyColor : 'yellow';
  }

  // 체크리스트 포함 본문 렌더 (XSS 방어)
  function safeRenderBody(html) {
    if (!html) return '';
    if (html.indexOf('checklist-row') >= 0) {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      // 위험 태그/속성 제거
      tmp.querySelectorAll('script,style,iframe,object,embed').forEach(function (n) { n.remove(); });
      tmp.querySelectorAll('*').forEach(function (el) {
        [].slice.call(el.attributes).forEach(function (a) {
          if (a.name.toLowerCase().startsWith('on')) el.removeAttribute(a.name);
        });
      });
      return tmp.innerHTML;
    }
    // 일반 텍스트 — escape 후 줄바꿈 처리
    return (html || '').replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    }).replace(/\n/g, '<br>');
  }

  /* ──────────────────────────────────────────────
     4. 상세보기 팝업
  ────────────────────────────────────────────── */
  let _viewId = null;

  window.openStickyView = function (id) {
    const en = getEntry(id);
    if (!en) return;
    _viewId = id;

    const color = getColor(en);
    const box = document.getElementById('memoViewBox');
    if (box) {
      box.style.background = COLOR_BG[color] || '#fff9c4';
      box.style.borderTop  = '4px solid ' + (COLOR_BR[color] || '#f0e060');
    }

    const titleEl = document.getElementById('memoViewTitle');
    if (titleEl) titleEl.textContent = en.title || '';

    const bodyEl = document.getElementById('memoViewBody');
    if (bodyEl) bodyEl.innerHTML = safeRenderBody(en.body || '');

    // 체크박스 토글 (상세보기 안에서도 가능)
    if (bodyEl) {
      bodyEl.querySelectorAll('.checklist-cb').forEach(function (cb) {
        cb.addEventListener('click', function (e) {
          e.preventDefault();
          const row = cb.closest('.checklist-row');
          if (!row) return;
          row.classList.toggle('done');
          // 저장
          if (typeof updateRecord === 'function') {
            const tmp2 = document.createElement('div');
            tmp2.innerHTML = en.body || '';
            const rows2 = tmp2.querySelectorAll('.checklist-row');
            const liveRows = bodyEl.querySelectorAll('.checklist-row');
            rows2.forEach(function (sr, i) {
              if (liveRows[i]) {
                if (liveRows[i].classList.contains('done')) sr.classList.add('done');
                else sr.classList.remove('done');
              }
            });
            en.body = tmp2.innerHTML;
            updateRecord(id, { body: en.body });
            setTimeout(function () {
              if (typeof renderStickyGrid === 'function') renderStickyGrid();
            }, 200);
          }
        });
      });
    }

    // 사진
    const photosEl = document.getElementById('memoViewPhotos');
    if (photosEl) {
      if (en.photos && en.photos.length) {
        photosEl.style.display = 'flex';
        photosEl.innerHTML = en.photos.map(function (p) {
          return '<img src="' + p + '" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid rgba(255,255,255,.8);cursor:pointer" onclick="document.getElementById(\'imgFull\').src=this.src;document.getElementById(\'imgOverlay\').style.display=\'flex\'">';
        }).join('');
      } else {
        photosEl.style.display = 'none';
        photosEl.innerHTML = '';
      }
    }

    const dateEl = document.getElementById('memoViewDate');
    if (dateEl) dateEl.textContent = en.date || '';

    const popup = document.getElementById('memoViewPopup');
    if (popup) { popup.style.display = 'flex'; }
  };

  // 닫기
  document.getElementById('memoViewCloseBtn').addEventListener('click', function () {
    document.getElementById('memoViewPopup').style.display = 'none';
    _viewId = null;
  });
  document.getElementById('memoViewPopup').addEventListener('click', function (e) {
    if (e.target === document.getElementById('memoViewPopup')) {
      document.getElementById('memoViewPopup').style.display = 'none';
      _viewId = null;
    }
  });

  // 수정 버튼 → 상세보기 닫고 수정 팝업 열기
  document.getElementById('memoViewEditBtn').addEventListener('click', function () {
    const id = _viewId;
    document.getElementById('memoViewPopup').style.display = 'none';
    _viewId = null;
    setTimeout(function () { window.openStickyEdit(id); }, 100);
  });

  // 삭제
  document.getElementById('memoViewDelBtn').addEventListener('click', function () {
    if (!_viewId) return;
    if (!confirm('이 메모를 삭제할까요?')) return;
    if (typeof deleteWithUndo === 'function') deleteWithUndo(_viewId, '메모');
    document.getElementById('memoViewPopup').style.display = 'none';
    _viewId = null;
    setTimeout(function () { if (typeof renderStickyGrid === 'function') renderStickyGrid(); }, 300);
  });


  /* ──────────────────────────────────────────────
     5. 수정 팝업
  ────────────────────────────────────────────── */
  let _editId = null;
  let _editColor = 'yellow';

  window.openStickyEdit = function (id) {
    const en = getEntry(id);
    if (!en) return;
    _editId = id;
    _editColor = getColor(en);

    // 팝업 배경색 적용
    const box = document.getElementById('memoEditBox');
    if (box) {
      box.style.background = COLOR_BG[_editColor] || '#fff9c4';
      box.style.borderTop  = '4px solid ' + (COLOR_BR[_editColor] || '#f0e060');
    }

    // 제목
    const titleEl = document.getElementById('memoEditTitle');
    if (titleEl) titleEl.value = en.title || '';

    // 본문 — 체크리스트는 HTML 그대로, 일반은 텍스트
    const bodyEl = document.getElementById('memoEditBody');
    if (bodyEl) {
      if ((en.body || '').indexOf('checklist-row') >= 0) {
        bodyEl.innerHTML = en.body || '';
      } else {
        bodyEl.innerText = en.body || '';
      }
    }

    // 색상 버튼 active 표시
    document.querySelectorAll('.me-color').forEach(function (btn) {
      const isActive = btn.dataset.color === _editColor;
      btn.style.border = isActive ? '3px solid #333' : '2px solid #dbe6f4';
      btn.style.transform = isActive ? 'scale(1.2)' : 'scale(1)';
    });

    const popup = document.getElementById('memoEditPopup');
    if (popup) { popup.style.display = 'flex'; }

    setTimeout(function () {
      if (bodyEl) { bodyEl.focus(); }
    }, 200);
  };

  // 색상 버튼 클릭
  document.querySelectorAll('.me-color').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _editColor = btn.dataset.color;
      const box = document.getElementById('memoEditBox');
      if (box) {
        box.style.background = COLOR_BG[_editColor] || '#fff9c4';
        box.style.borderTop  = '4px solid ' + (COLOR_BR[_editColor] || '#f0e060');
      }
      document.querySelectorAll('.me-color').forEach(function (b) {
        const isActive = b.dataset.color === _editColor;
        b.style.border = isActive ? '3px solid #333' : '2px solid #dbe6f4';
        b.style.transform = isActive ? 'scale(1.2)' : 'scale(1)';
      });
    });
  });

  // 닫기 / 취소
  function closeMemoEdit() {
    document.getElementById('memoEditPopup').style.display = 'none';
    _editId = null;
  }
  document.getElementById('memoEditCloseBtn').addEventListener('click', closeMemoEdit);
  document.getElementById('memoEditCancelBtn').addEventListener('click', closeMemoEdit);
  document.getElementById('memoEditPopup').addEventListener('click', function (e) {
    if (e.target === document.getElementById('memoEditPopup')) closeMemoEdit();
  });

  // Ctrl+Enter 로 저장
  document.getElementById('memoEditBody').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      document.getElementById('memoEditSaveBtn').click();
    }
  });

  // 저장
  document.getElementById('memoEditSaveBtn').addEventListener('click', function () {
    if (!_editId) return;
    const titleEl = document.getElementById('memoEditTitle');
    const bodyEl  = document.getElementById('memoEditBody');
    const title = (titleEl ? titleEl.value : '').trim();
    const hasChecklist = bodyEl && bodyEl.querySelector('.checklist-row');
    const body = hasChecklist
      ? (bodyEl ? bodyEl.innerHTML.trim() : '')
      : (bodyEl ? (bodyEl.innerText || bodyEl.textContent || '').trim() : '');

    if (!body) {
      if (typeof toast === 'function') toast('내용을 입력해주세요');
      return;
    }
    if (typeof updateRecord === 'function') {
      updateRecord(_editId, { title: title, body: body, stickyColor: _editColor });
    }
    if (typeof toast === 'function') toast('저장됐어요');
    closeMemoEdit();
    setTimeout(function () {
      if (typeof renderStickyGrid === 'function') renderStickyGrid();
      if (typeof v43Refresh === 'function') v43Refresh();
    }, 200);
  });

  // 삭제
  document.getElementById('memoEditDelBtn').addEventListener('click', function () {
    if (!_editId) return;
    if (!confirm('이 메모를 삭제할까요?')) return;
    if (typeof deleteWithUndo === 'function') deleteWithUndo(_editId, '메모');
    closeMemoEdit();
    setTimeout(function () { if (typeof renderStickyGrid === 'function') renderStickyGrid(); }, 300);
  });


  /* ──────────────────────────────────────────────
     6. renderStickyGrid 후킹
        — 카드/목록 클릭 → 상세보기 팝업
        — 수정 버튼 → 수정 팝업
        — 목록형 본문 HTML 태그 노출 수정
  ────────────────────────────────────────────── */
  const _origRenderGrid = window.renderStickyGrid;

  window.renderStickyGrid = function () {
    if (_origRenderGrid) _origRenderGrid();
    bindMemoPopupEvents();
  };

  function bindMemoPopupEvents() {
    /* ---- 카드형 ---- */
    const grid = document.getElementById('stickyGrid');
    if (grid) {
      // 카드 클릭 → 상세보기 (수정/삭제 버튼 제외)
      grid.querySelectorAll('.sticky-note').forEach(function (card) {
        // 기존 리스너 중복 방지
        if (card._popupBound) return;
        card._popupBound = true;
        card.addEventListener('click', function (e) {
          if (e.target.closest('[data-sedit],[data-sdel],[data-ssave],[data-scancel],[data-scopy],a,.checklist-cb,.sn-edit')) return;
          window.openStickyView(card.dataset.sid);
        });
      });

      // 수정 버튼 → 수정 팝업 (인라인 편집 대신)
      grid.querySelectorAll('[data-sedit]').forEach(function (btn) {
        if (btn._editBound) return;
        btn._editBound = true;
        // 기존 인라인 편집 이벤트를 override
        btn.addEventListener('click', function (e) {
          e.stopImmediatePropagation();
          window.openStickyEdit(btn.dataset.sedit);
        }, true); // capture phase — 기존 이벤트보다 먼저
      });
    }

    /* ---- 목록형 ---- */
    const list = document.getElementById('stickyList');
    if (list) {
      // 목록 아이템 클릭 → 상세보기
      list.querySelectorAll('.sticky-list-item').forEach(function (item) {
        if (item._popupBound) return;
        item._popupBound = true;
        item.addEventListener('click', function (e) {
          if (e.target.closest('button')) return;
          window.openStickyView(item.dataset.sid);
        });
        item.style.cursor = 'pointer';
      });

      // 수정 버튼 (data-sedit2) → 수정 팝업
      list.querySelectorAll('[data-sedit2]').forEach(function (btn) {
        if (btn._editBound) return;
        btn._editBound = true;
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          window.openStickyEdit(btn.dataset.sedit2);
        });
      });

      /* ── 목록형 본문 HTML 태그 노출 수정 ──
         sticky-list-content 에 raw HTML 대신 안전하게 렌더 */
      list.querySelectorAll('.sticky-list-item').forEach(function (item) {
        const contentEl = item.querySelector('.sticky-list-content');
        if (!contentEl) return;
        const id = item.dataset.sid;
        const en = getEntry(id);
        if (!en || !en.body) return;

        const body = en.body;
        if (body.indexOf('checklist-row') >= 0) {
          // 체크리스트: 체크박스 상태 요약 텍스트로 표시
          const tmp = document.createElement('div');
          tmp.innerHTML = body;
          const rows = tmp.querySelectorAll('.checklist-row');
          const doneRows = tmp.querySelectorAll('.checklist-row.done');
          const texts = [];
          rows.forEach(function (r) {
            const t = r.querySelector('.checklist-text');
            const isDone = r.classList.contains('done');
            if (t) texts.push((isDone ? '✅ ' : '☐ ') + (t.innerText || t.textContent || '').trim());
          });
          contentEl.textContent = texts.join('  ');
          // 완료 현황 뱃지
          if (rows.length > 0) {
            const badge = document.createElement('span');
            badge.style.cssText = 'display:inline-block;margin-left:8px;padding:1px 7px;background:#e6f9f0;color:#1a7a4a;border-radius:8px;font-size:10px;font-weight:700;flex-shrink:0';
            badge.textContent = doneRows.length + '/' + rows.length;
            const titleEl = item.querySelector('.sticky-list-title');
            if (titleEl && !titleEl.querySelector('.cl-badge')) {
              badge.className += ' cl-badge';
              titleEl.appendChild(badge);
            }
          }
        } else {
          // 일반 텍스트 (태그 제거)
          const tmp2 = document.createElement('div');
          tmp2.innerHTML = body;
          contentEl.textContent = (tmp2.innerText || tmp2.textContent || '').trim().replace(/\n/g, ' ');
        }
      });
    }
  }

  // 최초 렌더 후 바인딩 (DOM 준비 대기)
  setTimeout(function () { bindMemoPopupEvents(); }, 1200);

  // 탭 전환 시에도 바인딩
  document.querySelectorAll('.v43-tab[data-v43tab="memo"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setTimeout(function () { bindMemoPopupEvents(); }, 350);
    });
  });

  console.log('[memo_patch] 로드 완료');
})();
