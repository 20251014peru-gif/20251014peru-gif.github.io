/* =============================================================
   worklog_patch_v44.js  ★ 통합 패치
   PART 1: renderStickyGrid 완전 재정의
     - 카드 클릭 → 확인 모달 (openViewer)
     - 수정 버튼 → 수정 모달 (체크박스 포함)
     - 목록형 미리보기 → HTML 태그 제거, 체크박스 텍스트 추출
   PART 2: 지출 모달 전면 개편 + 업무↔지출 양방향 연계
   PART 3: openStickyEdit + 검색 파일 바로 열기
   ============================================================= */

/* ─────────────────────────────────────────
   PART 1: renderStickyGrid 완전 재정의
───────────────────────────────────────── */
(function patchMemo() {
  'use strict';

  /* ── 체크리스트 HTML → 텍스트 미리보기 ── */
  function bodyPreview(body) {
    if (!body) return '';
    if (body.indexOf('checklist-row') >= 0) {
      var tmp = document.createElement('div');
      tmp.innerHTML = body;
      var texts = [];
      tmp.querySelectorAll('.checklist-row').forEach(function(row) {
        var t = row.querySelector('.checklist-text');
        var txt = (t ? (t.innerText || t.textContent || '') : '').trim();
        if (txt) texts.push((row.classList.contains('done') ? '✅ ' : '☐ ') + txt);
      });
      return texts.join(' · ') || '';
    }
    return body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /* ── HTML 이스케이프 ── */
  function esc(s) {
    return (s || '').toString().replace(/[&<>"]/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }

  /* ── HTML 안전 정제 ── */
  function sanitize(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('script,iframe,object,embed').forEach(function(n) { n.remove(); });
    tmp.querySelectorAll('*').forEach(function(el) {
      [].slice.call(el.attributes).forEach(function(a) {
        if (a.name.toLowerCase().startsWith('on')) el.removeAttribute(a.name);
      });
    });
    return tmp;
  }

  /* ── 메모 본문 렌더 (카드 보기용, 완료 분리 포함) ── */
  function renderMemoBodySafe(body, splitDone) {
    if (!body) return '';
    if (body.indexOf('checklist-row') >= 0) {
      var tmp = sanitize(body);
      if (splitDone) {
        var doneRows = tmp.querySelectorAll('.checklist-row.done');
        if (doneRows.length) {
          var doneSection = document.createElement('div');
          doneSection.className = 'checklist-done-section';
          var doneList = document.createElement('div');
          doneList.className = 'checklist-done-list';
          doneRows.forEach(function(r) { doneList.appendChild(r); });
          var toggle = document.createElement('div');
          toggle.className = 'checklist-done-toggle';
          toggle.innerHTML = '<span class="arrow">▼</span> ✅ 완료 (' + doneRows.length + ')';
          doneSection.appendChild(toggle);
          doneSection.appendChild(doneList);
          tmp.appendChild(doneSection);
        }
      }
      return tmp.innerHTML;
    }
    return esc(body).replace(/\n/g, '<br>');
  }

  /* ── 색상 목록 ── */
  var COLORS = ['yellow', 'blue', 'green', 'pink', 'orange'];
  var COLOR_BG2 = { yellow: '#f0c520', blue: '#3b82f6', green: '#22c55e', pink: '#ec4899', orange: '#f97316' };

  function getColor(en) {
    return COLORS.indexOf(en.stickyColor) >= 0 ? en.stickyColor : 'yellow';
  }

  /* ── 수정 모달 열기 ── */
  window.openStickyEditModal = function(id) {
    if (typeof entries === 'undefined') return;
    var en = entries.find(function(x) { return x.id === id; });
    if (!en) return;

    /* 기존 수정 모달 재사용 또는 생성 */
    var ov = document.getElementById('stickyV44EditOv');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'stickyV44EditOv';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9000;display:none;align-items:center;justify-content:center';
      ov.innerHTML = [
        '<div id="stickyV44EditModal" style="background:#fff9c4;border-radius:20px;padding:20px;width:90%;max-width:460px;',
          'box-shadow:0 8px 32px rgba(0,0,0,.18);max-height:90vh;overflow-y:auto;',
          'transform:scale(.92);transition:transform .2s cubic-bezier(.34,1.56,.64,1)">',
          '<input type="text" id="stickyV44EditTitle" style="width:100%;box-sizing:border-box;border:none;border-bottom:1.5px solid #e0d060;',
            'background:transparent;font-size:15px;font-weight:700;font-family:inherit;color:#222;outline:none;padding:4px 0;margin-bottom:6px">',
          '<div style="margin-bottom:8px">',
            '<button type="button" id="stickyV44AddCb" style="padding:5px 12px;border:1.5px solid #e0d060;border-radius:8px;background:rgba(255,255,255,.6);',
              'font-size:13px;font-family:inherit;cursor:pointer;color:#666">☑ 항목 추가</button>',
          '</div>',
          '<div id="stickyV44EditBody" class="sn-edit-body" contenteditable="true" style="min-height:120px;outline:none;font-size:14px;color:#444;',
            'line-height:1.6;word-break:break-word;padding:4px 0"></div>',
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">',
            '<button id="stickyV44EditDel" style="padding:8px 16px;border-radius:10px;border:none;background:#fde8e8;color:#b52929;',
              'font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">🗑 삭제</button>',
            '<button id="stickyV44EditCancel" style="padding:8px 16px;border-radius:10px;border:none;background:#f0f4f8;color:#666;',
              'font-size:13px;font-weight:600;font-family:inherit;cursor:pointer">취소</button>',
            '<button id="stickyV44EditSave" style="padding:8px 18px;border-radius:10px;border:none;background:#3f7cb8;color:#fff;',
              'font-size:14px;font-weight:700;font-family:inherit;cursor:pointer">💾 저장</button>',
          '</div>',
        '</div>'
      ].join('');
      document.body.appendChild(ov);

      /* 모달 이벤트 */
      ov.addEventListener('click', function(e) {
        if (e.target === ov) closeEditModal();
      });
      document.getElementById('stickyV44EditCancel').addEventListener('click', closeEditModal);
      document.getElementById('stickyV44EditSave').addEventListener('click', function() {
        var id2 = ov.dataset.editId;
        var titleEl = document.getElementById('stickyV44EditTitle');
        var bodyEl  = document.getElementById('stickyV44EditBody');
        if (!bodyEl || !id2) return;
        var t = titleEl ? titleEl.value.trim() : '';
        var hasChecklist = !!bodyEl.querySelector('.checklist-row');
        var b = hasChecklist ? bodyEl.innerHTML.trim() : (bodyEl.innerText || '').trim();
        if (!b) { if (typeof toast === 'function') toast('내용을 입력해주세요'); return; }
        if (typeof updateRecord === 'function') updateRecord(id2, { title: t, body: b });
        if (typeof toast === 'function') toast('저장됐어요');
        closeEditModal();
        setTimeout(function() {
          if (typeof renderStickyGrid === 'function') renderStickyGrid();
          if (typeof v43Refresh === 'function') v43Refresh();
        }, 200);
      });
      document.getElementById('stickyV44EditDel').addEventListener('click', function() {
        var id2 = ov.dataset.editId;
        if (!id2 || !confirm('이 메모를 삭제할까요?')) return;
        if (typeof deleteWithUndo === 'function') deleteWithUndo(id2, '메모');
        closeEditModal();
        setTimeout(function() {
          if (typeof renderStickyGrid === 'function') renderStickyGrid();
          if (typeof v43Refresh === 'function') v43Refresh();
        }, 300);
      });

      /* 체크박스 클릭 — 토글 */
      document.getElementById('stickyV44EditBody').addEventListener('click', function(e) {
        var cb = e.target.closest('.checklist-cb');
        if (!cb) return;
        e.preventDefault();
        var row = cb.closest('.checklist-row');
        if (row) row.classList.toggle('done');
      });

      /* Enter 키 — 체크리스트 행 안에서 새 행 추가 */
      document.getElementById('stickyV44EditBody').addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        var bodyEl = document.getElementById('stickyV44EditBody');
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        var node = sel.anchorNode;
        var row = null;
        var cur = node;
        while (cur && cur !== bodyEl) {
          if (cur.classList && cur.classList.contains('checklist-row')) { row = cur; break; }
          cur = cur.parentElement;
        }
        if (!row) return; /* 체크리스트 행이 아니면 기본 동작 */
        e.preventDefault();
        /* 현재 행 텍스트가 비어있으면 → 체크리스트 탈출 */
        var textEl = row.querySelector('.checklist-text');
        var txt = textEl ? (textEl.innerText || '').trim() : '';
        if (!txt) {
          row.remove();
          var p = document.createElement('div'); p.innerHTML = '<br>';
          bodyEl.appendChild(p);
          var r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
          sel.removeAllRanges(); sel.addRange(r);
          return;
        }
        /* 새 체크리스트 행 삽입 */
        var newRow = document.createElement('div');
        newRow.className = 'checklist-row';
        newRow.contentEditable = 'false';
        newRow.dataset.indent = row.dataset.indent || '0';
        newRow.innerHTML = '<span class="checklist-cb" contenteditable="false"></span><span class="checklist-text" contenteditable="true"></span>';
        row.after(newRow);
        var newText = newRow.querySelector('.checklist-text');
        if (newText) {
          newText.focus();
          var r2 = document.createRange(); r2.selectNodeContents(newText); r2.collapse(true);
          sel.removeAllRanges(); sel.addRange(r2);
        }
      });
    }

    /* 내용 채우기 */
    ov.dataset.editId = id;
    var titleEl = document.getElementById('stickyV44EditTitle');
    var bodyEl  = document.getElementById('stickyV44EditBody');
    if (titleEl) titleEl.value = en.title || '';
    if (bodyEl) {
      if (en.body && en.body.indexOf('checklist-row') >= 0) {
        var tmp = sanitize(en.body);
        bodyEl.innerHTML = tmp.innerHTML;
        /* 체크박스 contenteditable 활성화 */
        bodyEl.querySelectorAll('.checklist-text').forEach(function(t) {
          t.contentEditable = 'true';
        });
      } else {
        /* 일반 텍스트도 줄바꿈 보존해서 표시 */
        bodyEl.innerHTML = (en.body || '').replace(/[&<>"]/g, function(m) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
        }).replace(/[\r\n]/g, '<br>');
      }
    }

    ov.style.display = 'flex';
    setTimeout(function() {
      var modal = document.getElementById('stickyV44EditModal');
      if (modal) modal.style.transform = 'scale(1)';
    }, 10);
    document.body.style.overflow = 'hidden';
    if (titleEl) titleEl.focus();
  };

  function closeEditModal() {
    var ov = document.getElementById('stickyV44EditOv');
    if (!ov) return;
    var modal = document.getElementById('stickyV44EditModal');
    if (modal) modal.style.transform = 'scale(.92)';
    setTimeout(function() {
      ov.style.display = 'none';
      document.body.style.overflow = '';
    }, 180);
  }

  /* ── openStickyEdit: 목록형 수정 버튼 호출 ── */
  window.openStickyEdit = function(id) {
    window.openStickyEditModal(id);
  };

  /* ── renderStickyGrid 완전 재정의 ── */
  function doRenderStickyGrid() {
    /* 기존 변수들 참조 */
    var MEMO_FILTER_KEY = '_v44memoFilter';
    var STICKY_VIEW_KEY = 'sticky_view';
    var memoFilter = window._v44memoFilter || 'all';
    var stickyViewMode = localStorage.getItem(STICKY_VIEW_KEY) || 'card';
    var stickySearch = window._v44stickySearch || '';

    var grid    = document.getElementById('stickyGrid');
    var listBox = document.getElementById('stickyList');
    if (!grid) return;

    /* entries에서 메모 목록 */
    if (typeof entries === 'undefined') return;
    var list = entries.filter(function(e) { return e.kind === 'memo'; })
      .sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

    /* 검색 필터 */
    if (stickySearch.trim()) {
      var q = stickySearch.trim().toLowerCase();
      list = list.filter(function(e) {
        return (e.title || '').toLowerCase().indexOf(q) >= 0 ||
               (e.body || '').toLowerCase().indexOf(q) >= 0 ||
               bodyPreview(e.body).toLowerCase().indexOf(q) >= 0;
      });
    }

    /* 완료/미완료 필터 */
    if (memoFilter === 'done' || memoFilter === 'todo') {
      list = list.filter(function(e) {
        if (!e.body || e.body.indexOf('checklist-row') < 0) return false;
        var tmp = document.createElement('div');
        tmp.innerHTML = e.body;
        var rows = tmp.querySelectorAll('.checklist-row');
        if (!rows.length) return false;
        var doneCount = tmp.querySelectorAll('.checklist-row.done').length;
        var todoCount = rows.length - doneCount;
        if (memoFilter === 'done') return doneCount > 0;
        return todoCount > 0;
      });
    }

    var cnt = document.getElementById('stickyCount');
    if (cnt) cnt.textContent = list.length + '개';

    /* ── 카드형 ── */
    if (!list.length) {
      grid.innerHTML = '<div class="v43-empty" style="grid-column:1/-1"><div class="ei">📝</div>' +
        (stickySearch ? '검색 결과가 없어요' : memoFilter !== 'all' ? '해당 항목이 없어요' : '메모를 추가해보세요!') + '</div>';
    } else {
      grid.innerHTML = list.map(function(en) {
        var color = getColor(en);
        var preview = bodyPreview(en.body || '');
        var bodyHtml = renderMemoBodySafe(en.body || '', true);
        var photosHtml = '';
        if (en.photos && en.photos.length) {
          photosHtml = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">' +
            en.photos.slice(0, 3).map(function(p) {
              return '<img src="' + p + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:2px solid rgba(255,255,255,.8)">';
            }).join('') +
            (en.photos.length > 3 ? '<span style="font-size:11px;color:#999;align-self:center">+' + (en.photos.length - 3) + '</span>' : '') +
            '</div>';
        }
        return '<div class="sticky-note ' + color + '" data-sid="' + esc(en.id) + '" style="cursor:pointer">' +
          (en.title ? '<div class="sticky-note-title">' + esc(en.title) + '</div>' : '') +
          '<div class="sticky-note-body">' + bodyHtml + '</div>' +
          photosHtml +
          '<div class="sn-card-btns">' +
            '<span class="sticky-note-date">' + esc(en.date || '') + '</span>' +
            '<div style="display:flex;gap:4px">' +
              '<button class="sn-btn-edit" data-sedit="' + esc(en.id) + '" title="수정">✏️</button>' +
              '<button class="sn-btn-copy" data-scopy="' + esc(en.id) + '" title="복사">📋</button>' +
              '<button class="sn-btn-del" data-sdel="' + esc(en.id) + '" title="삭제">🗑</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    /* 카드형 이벤트 */
    grid.querySelectorAll('.sticky-note').forEach(function(card) {
      /* 카드 클릭 → 확인 모달 (openViewer) */
      card.addEventListener('click', function(e) {
        if (e.target.closest('[data-sedit],[data-scopy],[data-sdel]')) return;
        var id = card.dataset.sid;
        if (typeof openViewer === 'function') openViewer('memo', id);
      });
    });

    /* 수정 버튼 → 수정 모달 */
    grid.querySelectorAll('[data-sedit]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        window.openStickyEditModal(btn.dataset.sedit);
      });
    });

    /* 복사 버튼 */
    grid.querySelectorAll('[data-scopy]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var en = entries.find(function(x) { return x.id === btn.dataset.scopy; });
        if (!en) return;
        var txt = [en.title, bodyPreview(en.body)].filter(Boolean).join('\n');
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function() {
          if (typeof toast === 'function') toast('복사됐어요');
        });
      });
    });

    /* 삭제 버튼 */
    grid.querySelectorAll('[data-sdel]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!confirm('이 메모를 삭제할까요?')) return;
        if (typeof deleteWithUndo === 'function') deleteWithUndo(btn.dataset.sdel, '메모');
        setTimeout(function() { doRenderStickyGrid(); }, 300);
      });
    });

    /* 완료 영역 토글 */
    grid.querySelectorAll('.checklist-done-toggle').forEach(function(toggle) {
      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        var section = toggle.closest('.checklist-done-section');
        if (section) section.classList.toggle('expanded');
      });
    });

    /* 체크박스 클릭 (카드 보기) */
    grid.querySelectorAll('.sticky-note-body .checklist-cb').forEach(function(cb) {
      cb.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var row = cb.closest('.checklist-row');
        if (!row) return;
        row.classList.toggle('done');
        var card = cb.closest('.sticky-note');
        if (!card) return;
        var id = card.dataset.sid;
        var en = entries.find(function(x) { return x.id === id; });
        if (!en || !en.body) return;
        var tmp = document.createElement('div');
        tmp.innerHTML = en.body;
        var liveRows = card.querySelectorAll('.checklist-row');
        var savedRows = tmp.querySelectorAll('.checklist-row');
        if (savedRows.length === liveRows.length) {
          liveRows.forEach(function(lr, i) {
            if (savedRows[i]) {
              if (lr.classList.contains('done')) savedRows[i].classList.add('done');
              else savedRows[i].classList.remove('done');
            }
          });
          if (typeof updateRecord === 'function') updateRecord(id, { body: tmp.innerHTML });
          setTimeout(function() { doRenderStickyGrid(); }, 250);
        }
      });
    });

    /* ── 목록형 ── */
    if (listBox) {
      if (!list.length) {
        listBox.innerHTML = '<div class="v43-empty" style="width:100%;padding:40px 0;text-align:center"><div class="ei">📝</div>' +
          (stickySearch ? '검색 결과가 없어요' : '메모를 추가해보세요!') + '</div>';
      } else {
        listBox.innerHTML = '<div class="sticky-list-wrap">' + list.map(function(en) {
          var color = getColor(en);
          var preview = bodyPreview(en.body || '');  /* ← HTML 태그 없는 텍스트 */
          return '<div class="sticky-list-item" data-sid="' + esc(en.id) + '">' +
            '<div class="sticky-list-color" style="background:' + (COLOR_BG2[color] || '#f0c520') + '"></div>' +
            '<div class="sticky-list-body">' +
              (en.title ? '<div class="sticky-list-title">' + esc(en.title) + '</div>' : '') +
              '<div class="sticky-list-content">' + esc(preview) + '</div>' +
              '<div class="sticky-list-date">' + esc(en.date || '') + '</div>' +
            '</div>' +
            '<div class="sticky-list-actions">' +
              '<button class="sticky-list-btn" data-scopy2="' + esc(en.id) + '" title="복사">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3f7cb8" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
              '</button>' +
              '<button class="sticky-list-btn" data-sedit2="' + esc(en.id) + '" title="수정">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3f7cb8" stroke-width="2.2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
              '</button>' +
              '<button class="sticky-list-btn" data-sdel2="' + esc(en.id) + '" title="삭제" style="border-color:#fde8e8">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>';

        /* 목록형 이벤트 */
        listBox.querySelectorAll('.sticky-list-item').forEach(function(item) {
          /* 아이템 클릭 → 확인 모달 */
          item.addEventListener('click', function(e) {
            if (e.target.closest('button')) return;
            var id = item.dataset.sid;
            if (typeof openViewer === 'function') openViewer('memo', id);
          });
        });
        listBox.querySelectorAll('[data-scopy2]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var en = entries.find(function(x) { return x.id === btn.dataset.scopy2; });
            if (!en) return;
            var txt = [en.title, bodyPreview(en.body)].filter(Boolean).join('\n');
            if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function() {
              if (typeof toast === 'function') toast('복사됐어요');
            });
          });
        });
        listBox.querySelectorAll('[data-sedit2]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            window.openStickyEditModal(btn.dataset.sedit2);
          });
        });
        listBox.querySelectorAll('[data-sdel2]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!confirm('이 메모를 삭제할까요?')) return;
            if (typeof deleteWithUndo === 'function') deleteWithUndo(btn.dataset.sdel2, '메모');
            setTimeout(function() { doRenderStickyGrid(); }, 300);
          });
        });
      }

      /* 보기 전환 */
      listBox.style.display = stickyViewMode === 'list' ? 'flex' : 'none';
      grid.style.display    = stickyViewMode === 'card' ? '' : 'none';
    }

    /* 버튼 활성 상태 */
    var cb2 = document.getElementById('memoViewCard');
    var lb2 = document.getElementById('memoViewList');
    if (cb2) cb2.classList.toggle('memo-view-active', stickyViewMode === 'card');
    if (lb2) lb2.classList.toggle('memo-view-active', stickyViewMode === 'list');
  }

  /* ── 전역 renderStickyGrid 교체 ── */
  function hookRenderStickyGrid() {
    if (window._v44stickyHooked) return;
    /* 기존 함수 저장 (checklist 기능 등은 유지) */
    window._origRenderStickyGrid = window.renderStickyGrid;
    window.renderStickyGrid = doRenderStickyGrid;
    window._v44stickyHooked = true;
  }

  /* ── 보기 전환 버튼 재바인딩 ── */
  function rebindViewBtns() {
    var cardBtn = document.getElementById('memoViewCard');
    var listBtn = document.getElementById('memoViewList');
    if (cardBtn && !cardBtn._v44bound) {
      cardBtn._v44bound = true;
      cardBtn.addEventListener('click', function() {
        localStorage.setItem('sticky_view', 'card');
        window._v44stickyView = 'card';
        doRenderStickyGrid();
      });
    }
    if (listBtn && !listBtn._v44bound) {
      listBtn._v44bound = true;
      listBtn.addEventListener('click', function() {
        localStorage.setItem('sticky_view', 'list');
        window._v44stickyView = 'list';
        doRenderStickyGrid();
      });
    }
  }

  /* ── 검색 필터 바인딩 ── */
  function bindStickySearch() {
    var searchEl = document.getElementById('stickySearch');
    if (searchEl && !searchEl._v44bound) {
      searchEl._v44bound = true;
      var t;
      searchEl.addEventListener('input', function() {
        clearTimeout(t);
        t = setTimeout(function() {
          window._v44stickySearch = searchEl.value;
          doRenderStickyGrid();
        }, 200);
      });
    }
  }

  /* ── 필터 버튼 바인딩 ── */
  function bindMemoFilter() {
    document.querySelectorAll('.memo-filter-btn').forEach(function(btn) {
      if (btn._v44bound) return;
      btn._v44bound = true;
      btn.addEventListener('click', function() {
        document.querySelectorAll('.memo-filter-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        window._v44memoFilter = btn.dataset.mfilter || 'all';
        doRenderStickyGrid();
      });
    });
  }

  /* ── 초기화 ── */
  function init() {
    hookRenderStickyGrid();
    hookOpenViewer();
    rebindViewBtns();
    bindStickySearch();
    bindMemoFilter();
    doRenderStickyGrid();

    document.querySelectorAll('.v43-tab[data-v43tab="memo"]').forEach(function(btn) {
      if (btn._v44memoBound) return;
      btn._v44memoBound = true;
      btn.addEventListener('click', function() {
        setTimeout(function() {
          rebindViewBtns();
          bindStickySearch();
          bindMemoFilter();
          doRenderStickyGrid();
        }, 150);
      });
    });

    /* v43Refresh 훅 */
    var origRefresh = window.v43Refresh;
    if (origRefresh && !origRefresh._v44stickyHooked) {
      window.v43Refresh = function() {
        origRefresh();
        doRenderStickyGrid();
      };
      window.v43Refresh._v44stickyHooked = true;
    }
  }

  /* openViewer 완전 재정의 — body 필드의 checklist HTML을 제대로 렌더링 */
  function hookOpenViewer() {
    if (window._v44viewerHooked) return;
    if (!window.openViewer) return;

    var origOpenViewer = window.openViewer;
    window.openViewer = function(kind, id) {
      if (kind !== 'memo') { origOpenViewer(kind, id); return; }

      var data = (typeof entries !== 'undefined') ? entries.find(function(x){return x.id===id;}) : null;
      if (!data) { origOpenViewer(kind, id); return; }

      /* 원본 openViewer 호출 (모달 틀 세팅) */
      origOpenViewer(kind, id);

      /* body 필드를 즉시(0ms) 체크박스로 교체 — 깜빡임 방지 */
      setTimeout(function() {
        var vBody = document.getElementById('vBody');
        if (vBody && data.body && data.body.indexOf('checklist-row') >= 0) {
          var rows = vBody.querySelectorAll('.vrow');
          rows.forEach(function(row) {
            var keyEl = row.querySelector('.vk');
            var valEl = row.querySelector('.vv');
            if (!keyEl || !valEl) return;
            if ((keyEl.textContent || '').trim() !== '내용') return;
            var tmp = sanitize(data.body);
            var wrapper = document.createElement('div');
            wrapper.className = 'sticky-note-body';
            wrapper.innerHTML = tmp.innerHTML;
            valEl.innerHTML = '';
            valEl.appendChild(wrapper);
            valEl.querySelectorAll('.checklist-cb').forEach(function(cb) {
              cb.addEventListener('click', function(e) {
                e.preventDefault(); e.stopPropagation();
                var r = cb.closest('.checklist-row');
                if (r) r.classList.toggle('done');
              });
            });
          });
        }
      }, 0);

      /* 뷰어 모달의 "수정" 버튼 → openStickyEditModal로 교체 (매 호출마다 갱신) */
      setTimeout(function() {
        var vEditBtn = document.getElementById('vEdit');
        if (!vEditBtn) return;
        /* 기존 훅 핸들러 제거 후 재등록 */
        if (vEditBtn._v44handler) {
          vEditBtn.removeEventListener('click', vEditBtn._v44handler, true);
        }
        vEditBtn._v44handler = function(e) {
          e.stopImmediatePropagation();
          e.preventDefault();
          var overlay = document.getElementById('viewOverlay');
          if (overlay) overlay.classList.remove('show');
          window.openStickyEditModal(id);
        };
        vEditBtn.addEventListener('click', vEditBtn._v44handler, true);
      }, 30);


    };
    window.openViewer._v44hooked = true;
    window._v44viewerHooked = true;
  }

  /* entries 로드 대기 */
  var _wait = 0;
  function waitAndInit() {
    if (typeof entries !== 'undefined') {
      init();
      /* openViewer는 늦게 로드될 수 있어서 별도 재시도 */
      setTimeout(hookOpenViewer, 500);
      setTimeout(hookOpenViewer, 1500);
    } else if (_wait++ < 30) {
      setTimeout(waitAndInit, 300);
    }
  }
  setTimeout(waitAndInit, 800);
  setTimeout(waitAndInit, 2000);

  console.log('[worklog_patch_v44] PART1 메모 패치 로드');
})();


/* ─────────────────────────────────────────
   PART 2: 지출 모달 전면 개편 + 업무↔지출 양방향 연계
───────────────────────────────────────── */
(function patchExpense() {
  'use strict';

  var EXP_LS     = 'wl_expense_v6';
  var PURPOSE_LS = 'wl_expense_purposes_v6';
  var MODAL_ID   = 'expV6Modal';
  var LINK_MODAL_ID = 'expV6LinkModal';

  var EXP_TYPES   = ['없음', '💸 개인비용', '📃 후불청구'];
  var PAY_METHODS = ['💳 카드', '🏦 은행이체', '💵 현금'];
  var DEFAULT_PURPOSES = [
    { icon: '🔩', label: '자재구매' },
    { icon: '🍽', label: '식대' },
    { icon: '✏️', label: '소모품' },
    { icon: '📋', label: '폐기물 처리' },
    { icon: '🚛', label: '기타' },
  ];

  var fmt = function(n) { return '₩' + Math.round(Number(n)||0).toLocaleString('ko-KR'); };
  var g   = function(id) { return document.getElementById(id); };

  /* ── 상태 ── */
  var _expType   = '없음';
  var _payMethod = '💳 카드';
  var _receipt   = '없음';
  var _editId    = null;
  var _matItems  = [];   /* [{name,qty,price,delivery}] 자재/소모품 */
  var _mealItems = [];   /* [{menu,people,price}] 식대 */
  var _wasteItems= [];   /* [{desc,amount}] 폐기물 (후불청구) */
  var _personalWasteItems = []; /* [{desc,amount}] 폐기물 (개인비용) */
  var _selPurpose= {};
  var _purposes  = [];
  var _linkedWorkId = null;
  var _fromWorkData = null;
  var _expData   = {};

  function loadExpenses()  { try { return JSON.parse(localStorage.getItem(EXP_LS)||'[]'); } catch(e){ return []; } }
  function saveExpenses(a) { try { localStorage.setItem(EXP_LS, JSON.stringify(a)); } catch(e){} }
  function loadPurposes()  { try { return JSON.parse(localStorage.getItem(PURPOSE_LS)||'null')||DEFAULT_PURPOSES.slice(); } catch(e){ return DEFAULT_PURPOSES.slice(); } }
  function savePurposes(a) { try { localStorage.setItem(PURPOSE_LS, JSON.stringify(a)); } catch(e){} }

  /* ── 모달 HTML 생성 (최초 1회) ── */
  function ensureModal() {
    if (g(MODAL_ID)) return;
    var div = document.createElement('div');
    div.id = MODAL_ID;
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:none;align-items:flex-end;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Pretendard",sans-serif';
    div.innerHTML =
      '<div id="expV6Sheet" style="background:#fff;width:100%;max-width:540px;max-height:92vh;overflow-y:auto;border-radius:22px 22px 0 0;padding:20px 18px 36px;box-shadow:0 -4px 32px rgba(0,0,0,.18);border-top:3px solid #dbe6f4">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><span id="expV6Title" style="font-size:16px;font-weight:700;color:#1a2f45">지출 등록</span><button id="expV6Close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#7a92a8">✕</button></div>'
      +'<div id="expV6WorkLink" style="display:none;margin-bottom:12px;padding:10px 12px;background:#f0f6ff;border:1.5px solid #93c5fd;border-radius:10px;cursor:pointer"><div style="font-size:11px;font-weight:700;color:#185FA5;margin-bottom:3px">🔗 연결된 업무</div><div id="expV6WorkLinkText" style="font-size:13px;font-weight:600;color:#1a2f45"></div></div>'
      +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">날짜</label><input type="date" id="expV6Date" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"></div>'
      +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">지출 종류</label><div id="expV6TypeBtns" style="display:flex;gap:6px"></div></div>'

      /* 개인비용 영역 */
      +'<div id="expV6PersonalArea" style="display:none">'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">결제 수단</label><div id="expV6PayBtns" style="display:flex;gap:6px"></div></div>'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">업체명</label><input type="text" id="expV6Vendor" placeholder="예: 성신철물" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"></div>'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">내역</label><input type="text" id="expV6Desc" placeholder="예: 형광등 4개" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"></div>'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">용도</label><div id="expV6PurposeWrap" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"></div><div id="expV6PurposeAddRow" style="display:none;gap:6px;margin-top:8px;align-items:center"><input type="text" id="expV6PurposeInp" placeholder="용도 이름" style="flex:1;height:34px;padding:0 10px;border:1.5px solid #3f7cb8;border-radius:20px;font-size:13px;font-family:inherit;outline:none;background:#fff;color:#1a2f45;min-width:0"><button id="expV6PurposeConfirm" style="height:34px;padding:0 14px;background:#3f7cb8;color:#fff;border:none;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0">추가</button><button id="expV6PurposeCancel" style="height:34px;padding:0 12px;background:#f0f4f8;color:#7a92a8;border:none;border-radius:20px;font-size:13px;cursor:pointer;font-family:inherit;flex-shrink:0">취소</button></div></div>'

        /* 자재/소모품 영역 */
        +'<div id="expV6MatArea" style="display:none;margin-bottom:12px"><div style="background:#f0f6ff;border:1.5px solid #93c5fd;border-radius:12px;padding:12px"><div style="font-size:12px;font-weight:700;color:#185FA5;margin-bottom:10px">📦 자재 / 소모품 목록</div>'
          +'<div style="display:grid;grid-template-columns:1fr 48px 72px 64px 28px;gap:4px;margin-bottom:5px">'
            +'<div style="font-size:10px;font-weight:700;color:#7a92a8">품명·규격</div>'
            +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:center">수량</div>'
            +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">단가(원)</div>'
            +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">택배비</div>'
            +'<div></div>'
          +'</div>'
          +'<div id="expV6MatList"></div>'
          +'<button id="expV6MatAdd" style="width:100%;height:34px;border:1.5px dashed #93c5fd;border-radius:10px;background:transparent;font-size:13px;font-weight:600;color:#3f7cb8;cursor:pointer;font-family:inherit;margin-top:4px">➕ 품목 추가</button>'
          +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:8px 12px;background:#fff;border:1.5px solid #93c5fd;border-radius:10px"><span style="font-size:13px;font-weight:700;color:#185FA5">합계</span><span id="expV6MatTotal" style="font-size:18px;font-weight:800;color:#0C447C">₩0</span></div>'
        +'</div></div>'

        /* 식대 영역 */
        +'<div id="expV6MealArea" style="display:none;margin-bottom:12px"><div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:12px"><div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:10px">🍽 식대 내역</div>'
          +'<div style="display:grid;grid-template-columns:1fr 48px 80px 28px;gap:4px;margin-bottom:5px">'
            +'<div style="font-size:10px;font-weight:700;color:#7a92a8">메뉴</div>'
            +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:center">인원</div>'
            +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">1인 단가</div>'
            +'<div></div>'
          +'</div>'
          +'<div id="expV6MealList"></div>'
          +'<button id="expV6MealAdd" style="width:100%;height:34px;border:1.5px dashed #86efac;border-radius:10px;background:transparent;font-size:13px;font-weight:600;color:#166534;cursor:pointer;font-family:inherit;margin-top:4px">➕ 메뉴 추가</button>'
          +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:8px 12px;background:#fff;border:1.5px solid #86efac;border-radius:10px"><span style="font-size:13px;font-weight:700;color:#166534">합계</span><span id="expV6MealTotal" style="font-size:18px;font-weight:800;color:#166534">₩0</span></div>'
        +'</div></div>'

        /* 폐기물 처리 영역 (개인비용) */
        +'<div id="expV6PersonalWasteArea" style="display:none;margin-bottom:12px">'
          +'<div style="background:#fff7ed;border:1.5px solid #fdba74;border-radius:12px;padding:12px">'
            +'<div style="font-size:12px;font-weight:700;color:#c2410c;margin-bottom:10px">🗑 폐기물 처리 청구 항목</div>'
            +'<div style="display:grid;grid-template-columns:1fr 100px 28px;gap:4px;margin-bottom:5px">'
              +'<div style="font-size:10px;font-weight:700;color:#7a92a8">항목명</div>'
              +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">금액(원)</div>'
              +'<div></div>'
            +'</div>'
            +'<div id="expV6PersonalWasteList"></div>'
            +'<button id="expV6PersonalWasteAdd" style="width:100%;height:34px;border:1.5px dashed #fdba74;border-radius:10px;background:transparent;font-size:13px;font-weight:600;color:#c2410c;cursor:pointer;font-family:inherit;margin-top:4px">➕ 항목 추가</button>'
            +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:8px 12px;background:#fff;border:1.5px solid #fdba74;border-radius:10px">'
              +'<span style="font-size:13px;font-weight:700;color:#c2410c">합계</span>'
              +'<span id="expV6PersonalWasteTotal" style="font-size:18px;font-weight:800;color:#c2410c">₩0</span>'
            +'</div>'
          +'</div>'
        +'</div>'

        /* 금액 + 영수증 */
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px"><div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">금액 (원)</label><input type="number" id="expV6Amount" placeholder="0" min="0" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #3f7cb8;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;background:#f7faff;outline:none;color:#185FA5;text-align:right"></div><div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">영수증</label><div style="display:flex;gap:6px"><button data-receipt="있음" class="expReceiptBtn" style="flex:1;height:40px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;background:#f7faff;color:#7a92a8">있음</button><button data-receipt="없음" class="expReceiptBtn" style="flex:1;height:40px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;background:#f7faff;color:#7a92a8">없음</button></div></div></div>'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">품의서 상태</label><select id="expV6BillStatus" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"><option>대기</option><option>제출</option><option>완료</option></select></div>'
      +'</div>'

      /* 후불청구 영역 */
      +'<div id="expV6DeferArea" style="display:none">'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">업체명</label><input type="text" id="expV6DeferVendor" placeholder="예: 고려이엔알" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #fdba74;border-radius:10px;font-size:14px;font-family:inherit;background:#fff7ed;outline:none;color:#1a2f45"></div>'

        /* 폐기물 처리 등 청구항목 다중 */
        +'<div style="margin-bottom:12px"><div style="background:#fff7ed;border:1.5px solid #fdba74;border-radius:12px;padding:12px"><div style="font-size:12px;font-weight:700;color:#c2410c;margin-bottom:10px">📋 청구 항목</div>'
          +'<div style="display:grid;grid-template-columns:1fr 100px 28px;gap:4px;margin-bottom:5px">'
            +'<div style="font-size:10px;font-weight:700;color:#7a92a8">항목명</div>'
            +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">금액(원)</div>'
            +'<div></div>'
          +'</div>'
          +'<div id="expV6WasteList"></div>'
          +'<button id="expV6WasteAdd" style="width:100%;height:34px;border:1.5px dashed #fdba74;border-radius:10px;background:transparent;font-size:13px;font-weight:600;color:#c2410c;cursor:pointer;font-family:inherit;margin-top:4px">➕ 항목 추가</button>'
          +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:8px 12px;background:#fff;border:1.5px solid #fdba74;border-radius:10px"><span style="font-size:13px;font-weight:700;color:#c2410c">청구 합계</span><span id="expV6WasteTotal" style="font-size:18px;font-weight:800;color:#c2410c">₩0</span></div>'
        +'</div></div>'

        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px"><div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">세금계산서</label><select id="expV6TaxInvoice" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"><option value="">선택</option><option value="발행">✅ 발행</option><option value="발행예정">⏳ 발행예정</option><option value="미발행">❌ 미발행</option></select></div><div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">관리비 포함 상태</label><select id="expV6MgmtStatus" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"><option>미포함</option><option>포함</option><option>수금완료</option></select></div></div>'
      +'</div>'

      +'<div style="margin-bottom:12px"><button id="expV6LinkWorkBtn" style="width:100%;height:40px;border:1.5px dashed #dbe6f4;border-radius:10px;background:#f7faff;font-size:13px;font-weight:600;color:#7a92a8;cursor:pointer;font-family:inherit">🔗 업무와 연결하기</button></div>'
      +'<div style="margin-bottom:16px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">메모</label><input type="text" id="expV6Memo" placeholder="간단한 메모" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"></div>'
      +'<div style="display:flex;gap:8px"><button id="expV6Del" style="flex:1;height:48px;border-radius:12px;border:none;background:#fde8e8;color:#b52929;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;display:none">삭제</button><button id="expV6Save" style="flex:2;height:48px;border-radius:12px;border:none;background:#3f7cb8;color:#fff;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer">저장</button></div>'
    +'</div>';
    document.body.appendChild(div);

    /* 업무연결 팝업 */
    var ldiv = document.createElement('div');
    ldiv.id = LINK_MODAL_ID;
    ldiv.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9500;display:none;align-items:center;justify-content:center;padding:20px';
    ldiv.innerHTML =
      '<div style="background:#fff;border-radius:18px;width:100%;max-width:500px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.2)">'
        +'<div style="padding:16px 18px 10px;border-bottom:1px solid #f0f4f8;flex-shrink:0">'
          +'<div style="font-size:15px;font-weight:700;color:#1a2f45;margin-bottom:10px">🔗 연결할 업무 선택</div>'
          /* 날짜 범위 필터 */
          +'<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap">'
            +'<input type="date" id="expV6LinkFrom" style="flex:1;min-width:120px;height:36px;padding:0 8px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">'
            +'<span style="font-size:13px;color:#7a92a8">~</span>'
            +'<input type="date" id="expV6LinkTo" style="flex:1;min-width:120px;height:36px;padding:0 8px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">'
            +'<button id="expV6LinkDateClear" style="height:36px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;background:#f7faff;font-size:12px;color:#7a92a8;cursor:pointer;font-family:inherit;white-space:nowrap">초기화</button>'
          +'</div>'
          +'<input type="text" id="expV6LinkSearch" placeholder="🔍 제목·분야 검색..." style="width:100%;box-sizing:border-box;height:40px;padding:0 14px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45">'
        +'</div>'
        +'<div id="expV6LinkList" style="overflow:auto;flex:1;padding:8px 0"></div>'
        +'<div style="padding:12px 18px;border-top:1px solid #f0f4f8;flex-shrink:0;display:flex;gap:8px">'
          +'<button id="expV6LinkClear" style="flex:1;height:40px;border:1.5px solid #fde8e8;border-radius:10px;background:#fff;color:#b52929;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">연결 해제</button>'
          +'<button id="expV6LinkCancel" style="flex:1;height:40px;border:1.5px solid #dbe6f4;border-radius:10px;background:#f7faff;color:#7a92a8;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>'
        +'</div>'
      +'</div>';
    document.body.appendChild(ldiv);

    /* 이벤트 바인딩 */
    g('expV6LinkCancel').addEventListener('click', function() { ldiv.style.display='none'; });
    g('expV6LinkClear').addEventListener('click', function() { _linkedWorkId=null; updateWorkLinkUI(); ldiv.style.display='none'; });

    var t = null;
    function triggerLinkSearch() {
      clearTimeout(t);
      t = setTimeout(function(){ renderLinkList(g('expV6LinkSearch').value); }, 200);
    }
    g('expV6LinkSearch').addEventListener('input', triggerLinkSearch);
    g('expV6LinkFrom').addEventListener('change', triggerLinkSearch);
    g('expV6LinkTo').addEventListener('change', triggerLinkSearch);
    g('expV6LinkDateClear').addEventListener('click', function() {
      g('expV6LinkFrom').value = '';
      g('expV6LinkTo').value = '';
      triggerLinkSearch();
    });
    ldiv.addEventListener('click', function(e) { if (e.target === ldiv) ldiv.style.display='none'; });

    bindSheetEvents();
  }

  /* ── 업무연결 목록 렌더 ── */
  function renderLinkList(q) {
    var list = g('expV6LinkList'); if (!list) return;
    var from = (g('expV6LinkFrom')||{}).value || '';
    var to   = (g('expV6LinkTo')||{}).value   || '';
    var ql   = (q||'').trim().toLowerCase();
    var works = (typeof entries !== 'undefined' ? entries : [])
      .filter(function(e) {
        if (e.kind !== 'work') return false;
        if (from && (e.date||'') < from) return false;
        if (to   && (e.date||'') > to)   return false;
        if (ql) {
          var s = [e.title, e.field, e.floor, e.date, e.detail].filter(Boolean).join(' ').toLowerCase();
          if (s.indexOf(ql) < 0) return false;
        }
        return true;
      })
      .sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); })
      .slice(0, 50);

    if (!works.length) {
      list.innerHTML = '<div style="text-align:center;padding:30px;color:#aab8c8;font-size:14px">조건에 맞는 업무가 없어요</div>';
      return;
    }
    list.innerHTML = works.map(function(e) {
      var isLinked = e.id === _linkedWorkId;
      return '<div data-wid="'+e.id+'" style="display:flex;align-items:center;gap:10px;padding:11px 18px;border-bottom:1px solid #f0f6ff;cursor:pointer;background:'+(isLinked?'#f0f6ff':'')+';" onmouseenter="this.style.background=\'#f7faff\'" onmouseleave="this.style.background=\''+(isLinked?'#f0f6ff':'')+'\';">'
        +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:13px;font-weight:700;color:#1a2f45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(isLinked?'✅ ':'')+escHtml(e.title||'')+'</div>'
          +'<div style="font-size:11px;color:#aab8c8;margin-top:2px">'+escHtml(e.date||'')+' · '+escHtml(e.floor||'')+' '+escHtml(e.field||'')+'</div>'
        +'</div>'
        +(e.cost?'<div style="font-size:13px;font-weight:700;color:#3f7cb8;white-space:nowrap">'+Math.round(Number(e.cost)||0).toLocaleString('ko-KR')+'원</div>':'')
      +'</div>';
    }).join('');

    list.querySelectorAll('[data-wid]').forEach(function(el) {
      el.addEventListener('click', function() {
        _linkedWorkId = el.dataset.wid;
        updateWorkLinkUI();
        g(LINK_MODAL_ID).style.display = 'none';
        if (typeof toast === 'function') toast('🔗 업무 연결됐어요');
      });
    });
  }

  function escHtml(s) { return (s||'').replace(/[&<>"]/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]);}); }

  /* ── 업무 연결 UI 갱신 ── */
  function updateWorkLinkUI() {
    var box = g('expV6WorkLink');
    var txt = g('expV6WorkLinkText');
    if (!box || !txt) return;
    if (!_linkedWorkId) { box.style.display = 'none'; return; }
    var work = (typeof entries !== 'undefined') ? entries.find(function(e){ return e.id===_linkedWorkId; }) : null;
    box.style.display = work ? '' : 'none';
    if (work) txt.textContent = (work.date||'') + ' · ' + (work.title||'');
  }

  /* ── 용도칩 렌더 ── */
  function renderPurposeChips() {
    var wrap = g('expV6PurposeWrap'); if (!wrap) return;
    wrap.innerHTML = '';
    _purposes.forEach(function(p, i) {
      var chip = document.createElement('div');
      var active = !!_selPurpose[p.label];
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid '+(active?'#3f7cb8':'#dbe6f4')+';background:'+(active?'#3f7cb8':'#f7faff')+';color:'+(active?'#fff':'#7a92a8')+';font-family:inherit;transition:all .15s;user-select:none';
      chip.textContent = p.icon + ' ' + p.label;
      var del = document.createElement('span');
      del.textContent = '×';
      del.style.cssText = 'font-size:14px;opacity:.6;margin-left:2px';
      del.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!confirm('"'+p.label+'" 용도를 삭제할까요?')) return;
        delete _selPurpose[p.label];
        _purposes.splice(i, 1);
        savePurposes(_purposes);
        renderPurposeChips();
        updatePurposeAreas();
      });
      chip.appendChild(del);
      chip.addEventListener('click', function() {
        if (_selPurpose[p.label]) delete _selPurpose[p.label];
        else _selPurpose[p.label] = true;
        renderPurposeChips();
        updatePurposeAreas();
      });
      wrap.appendChild(chip);
    });

    /* ➕ 추가 버튼 */
    var addChip = document.createElement('button');
    addChip.textContent = '＋ 추가';
    addChip.style.cssText = 'padding:6px 12px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;border:1.5px dashed #dbe6f4;background:transparent;color:#7a92a8;font-family:inherit';
    addChip.addEventListener('click', function() {
      var row = g('expV6PurposeAddRow'); if (row) row.style.display='flex';
      var inp = g('expV6PurposeInp'); if (inp) { inp.value=''; inp.focus(); }
      addChip.style.display = 'none';
    });
    wrap.appendChild(addChip);
  }

  function doAddPurpose() {
    var val = (g('expV6PurposeInp').value||'').trim();
    if (!val) return;
    if (_purposes.find(function(p){ return p.label===val; })) { if (typeof toast==='function') toast('이미 있는 용도예요'); return; }
    _purposes.push({icon:'📌', label:val});
    savePurposes(_purposes);
    _selPurpose[val] = true;
    var row = g('expV6PurposeAddRow'); if (row) row.style.display='none';
    renderPurposeChips();
    updatePurposeAreas();
  }

  /* ── 용도별 섹션 표시/숨김 ── */
  function updatePurposeAreas() {
    var matOn   = !!(_selPurpose['자재구매'] || _selPurpose['소모품']);
    var mealOn  = !!_selPurpose['식대'];
    var wasteOn = !!_selPurpose['폐기물 처리'];
    var matArea   = g('expV6MatArea');
    var mealArea  = g('expV6MealArea');
    var wasteArea = g('expV6PersonalWasteArea');
    if (matArea)   matArea.style.display   = matOn   ? '' : 'none';
    if (mealArea)  mealArea.style.display  = mealOn  ? '' : 'none';
    if (wasteArea) wasteArea.style.display = wasteOn ? '' : 'none';
    syncTotalToAmount();
  }

  /* ── 자재 목록 렌더 ── */
  function renderMatList() {
    var list = g('expV6MatList'); if (!list) return;
    list.innerHTML = '';
    _matItems.forEach(function(it, i) {
      var row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr 48px 72px 64px 28px;gap:4px;margin-bottom:4px;align-items:center';

      var nameInp = inp('text', it.name||'', '품명·규격');
      var qtyInp  = inp('number', it.qty||'', '수량');
      var priceInp= inp('number', it.price||'', '단가');
      var delivInp= inp('number', it.delivery||'', '택배비');
      qtyInp.style.textAlign = priceInp.style.textAlign = delivInp.style.textAlign = 'right';

      var delBtn = document.createElement('button');
      delBtn.textContent = '🗑';
      delBtn.style.cssText = 'border:none;background:none;font-size:14px;cursor:pointer;padding:0';

      nameInp.addEventListener('input',  function(){ _matItems[i].name     = nameInp.value; });
      qtyInp.addEventListener('input',   function(){ _matItems[i].qty      = parseFloat(qtyInp.value)||0;   calcMatTotal(); });
      priceInp.addEventListener('input', function(){ _matItems[i].price    = parseFloat(priceInp.value)||0; calcMatTotal(); });
      delivInp.addEventListener('input', function(){ _matItems[i].delivery = parseFloat(delivInp.value)||0; calcMatTotal(); });
      (function(idx){ delBtn.addEventListener('click', function(){ _matItems.splice(idx,1); renderMatList(); calcMatTotal(); }); })(i);

      row.appendChild(nameInp); row.appendChild(qtyInp); row.appendChild(priceInp); row.appendChild(delivInp); row.appendChild(delBtn);
      list.appendChild(row);
    });
  }
  function calcMatTotal() {
    var total = _matItems.reduce(function(s,it){ return s + ((it.qty||0)*(it.price||0)) + (it.delivery||0); }, 0);
    var el = g('expV6MatTotal'); if (el) el.textContent = fmt(total);
    syncTotalToAmount();
  }

  /* ── 식대 목록 렌더 ── */
  function renderMealList() {
    var list = g('expV6MealList'); if (!list) return;
    list.innerHTML = '';
    _mealItems.forEach(function(it, i) {
      var row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr 48px 80px 28px;gap:4px;margin-bottom:4px;align-items:center';

      var menuInp   = inp('text',   it.menu||'',  '메뉴');
      var peopleInp = inp('number', it.people||'','인원');
      var priceInp  = inp('number', it.price||'', '1인단가');
      peopleInp.style.textAlign = priceInp.style.textAlign = 'right';

      var delBtn = document.createElement('button');
      delBtn.textContent = '🗑';
      delBtn.style.cssText = 'border:none;background:none;font-size:14px;cursor:pointer;padding:0';

      menuInp.addEventListener('input',   function(){ _mealItems[i].menu   = menuInp.value; });
      peopleInp.addEventListener('input', function(){ _mealItems[i].people = parseFloat(peopleInp.value)||0; calcMealTotal(); });
      priceInp.addEventListener('input',  function(){ _mealItems[i].price  = parseFloat(priceInp.value)||0; calcMealTotal(); });
      (function(idx){ delBtn.addEventListener('click', function(){ _mealItems.splice(idx,1); renderMealList(); calcMealTotal(); }); })(i);

      row.appendChild(menuInp); row.appendChild(peopleInp); row.appendChild(priceInp); row.appendChild(delBtn);
      list.appendChild(row);
    });
  }
  function calcMealTotal() {
    var total = _mealItems.reduce(function(s,it){ return s + ((it.people||0)*(it.price||0)); }, 0);
    var el = g('expV6MealTotal'); if (el) el.textContent = fmt(total);
    syncTotalToAmount();
  }

  /* ── 폐기물/청구항목 렌더 ── */
  function renderWasteList() {
    var list = g('expV6WasteList'); if (!list) return;
    list.innerHTML = '';
    _wasteItems.forEach(function(it, i) {
      var row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr 100px 28px;gap:4px;margin-bottom:4px;align-items:center';

      var descInp   = inp('text',   it.desc||'',   '항목명');
      var amountInp = inp('number', it.amount||'', '금액');
      amountInp.style.textAlign = 'right';

      var delBtn = document.createElement('button');
      delBtn.textContent = '🗑';
      delBtn.style.cssText = 'border:none;background:none;font-size:14px;cursor:pointer;padding:0';

      descInp.addEventListener('input',   function(){ _wasteItems[i].desc   = descInp.value; });
      amountInp.addEventListener('input', function(){ _wasteItems[i].amount = parseFloat(amountInp.value)||0; calcWasteTotal(); });
      (function(idx){ delBtn.addEventListener('click', function(){ _wasteItems.splice(idx,1); renderWasteList(); calcWasteTotal(); }); })(i);

      row.appendChild(descInp); row.appendChild(amountInp); row.appendChild(delBtn);
      list.appendChild(row);
    });
  }
  function calcWasteTotal() {
    var total = _wasteItems.reduce(function(s,it){ return s + (it.amount||0); }, 0);
    var el = g('expV6WasteTotal'); if (el) el.textContent = fmt(total);
    /* 후불청구 금액란에 자동 채움 */
    /* 후불청구는 deferAmount 없이 wasteItems 합계로만 계산 */
  }

  /* ── 개인비용 폐기물 목록 렌더 ── */
  function renderPersonalWasteList() {
    var list = g('expV6PersonalWasteList'); if (!list) return;
    list.innerHTML = '';
    _personalWasteItems.forEach(function(it, i) {
      var row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr 100px 28px;gap:4px;margin-bottom:4px;align-items:center';
      var descInp   = inp('text',   it.desc||'',   '항목명');
      var amountInp = inp('number', it.amount||'', '금액');
      amountInp.style.textAlign = 'right';
      var delBtn = document.createElement('button');
      delBtn.textContent = '🗑';
      delBtn.style.cssText = 'border:none;background:none;font-size:14px;cursor:pointer;padding:0';
      descInp.addEventListener('input',   function(){ _personalWasteItems[i].desc   = descInp.value; });
      amountInp.addEventListener('input', function(){ _personalWasteItems[i].amount = parseFloat(amountInp.value)||0; calcPersonalWasteTotal(); });
      (function(idx){ delBtn.addEventListener('click', function(){ _personalWasteItems.splice(idx,1); renderPersonalWasteList(); calcPersonalWasteTotal(); }); })(i);
      row.appendChild(descInp); row.appendChild(amountInp); row.appendChild(delBtn);
      list.appendChild(row);
    });
  }
  function calcPersonalWasteTotal() {
    var total = _personalWasteItems.reduce(function(s,it){ return s+(it.amount||0); }, 0);
    var el = g('expV6PersonalWasteTotal'); if (el) el.textContent = fmt(total);
    syncTotalToAmount();
  }

  /* ── 합계 → 금액란 자동채움 ── */
  function syncTotalToAmount() {
    var matTotal   = _matItems.reduce(function(s,it){ return s+((it.qty||0)*(it.price||0))+(it.delivery||0); }, 0);
    var mealTotal  = _mealItems.reduce(function(s,it){ return s+((it.people||0)*(it.price||0)); }, 0);
    var wasteTotal = _personalWasteItems.reduce(function(s,it){ return s+(it.amount||0); }, 0);
    var auto = matTotal + mealTotal + wasteTotal;
    if (auto > 0) {
      var a = g('expV6Amount');
      if (a && !a._manual) a.value = auto;
    }
  }

  /* ── 공통 input 스타일 ── */
  function inp(type, val, ph) {
    var el = document.createElement('input');
    el.type = type; el.value = val; el.placeholder = ph;
    el.style.cssText = 'width:100%;box-sizing:border-box;height:36px;padding:0 8px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45';
    return el;
  }

  /* ── 영역 표시/숨김 ── */
  function updateAreaVisibility() {
    var isP = _expType==='💸 개인비용', isD = _expType==='📃 후불청구';
    g('expV6PersonalArea').style.display = isP ? '' : 'none';
    g('expV6DeferArea').style.display    = isD ? '' : 'none';
    var sheet = g('expV6Sheet');
    if (sheet) sheet.style.borderTop = isP ? '3px solid #378ADD' : isD ? '3px solid #D85A30' : '3px solid #dbe6f4';
    if (isP) updatePurposeAreas();
  }

  /* ── 시트 이벤트 바인딩 (ensureModal에서 호출) ── */
  function bindSheetEvents() {
    /* 닫기 */
    g('expV6Close').addEventListener('click', close);
    g(MODAL_ID).addEventListener('click', function(e){ if(e.target===g(MODAL_ID)) close(); });

    /* 지출 종류 버튼 */
    var typeBtns = g('expV6TypeBtns');
    EXP_TYPES.forEach(function(t) {
      var btn = document.createElement('button');
      btn.textContent = t;
      btn.style.cssText = 'flex:1;height:40px;border-radius:10px;border:1.5px solid #dbe6f4;background:#f7faff;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;color:#7a92a8;transition:all .15s';
      btn.addEventListener('click', function() {
        _expType = t;
        typeBtns.querySelectorAll('button').forEach(function(b){ b.style.background='#f7faff'; b.style.color='#7a92a8'; b.style.borderColor='#dbe6f4'; });
        btn.style.background = t==='💸 개인비용'?'#3f7cb8':t==='📃 후불청구'?'#c2410c':'#64748b';
        btn.style.color = '#fff'; btn.style.borderColor = btn.style.background;
        updateAreaVisibility();
      });
      typeBtns.appendChild(btn);
    });

    /* 결제수단 버튼 */
    var payBtns = g('expV6PayBtns');
    PAY_METHODS.forEach(function(m) {
      var btn = document.createElement('button');
      btn.textContent = m;
      btn.style.cssText = 'flex:1;height:40px;border-radius:10px;border:1.5px solid #dbe6f4;background:#f7faff;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;color:#7a92a8;transition:all .15s';
      btn.addEventListener('click', function() {
        _payMethod = m;
        payBtns.querySelectorAll('button').forEach(function(b){ b.style.background='#f7faff'; b.style.color='#7a92a8'; b.style.borderColor='#dbe6f4'; });
        btn.style.background = '#0369a1'; btn.style.color='#fff'; btn.style.borderColor='#0369a1';
      });
      payBtns.appendChild(btn);
    });

    /* 영수증 버튼 */
    g(MODAL_ID).querySelectorAll('.expReceiptBtn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _receipt = btn.dataset.receipt;
        g(MODAL_ID).querySelectorAll('.expReceiptBtn').forEach(function(b){ b.style.background='#f7faff'; b.style.color='#7a92a8'; b.style.borderColor='#dbe6f4'; });
        btn.style.background='#0369a1'; btn.style.color='#fff'; btn.style.borderColor='#0369a1';
      });
    });

    /* 금액 수동입력 감지 */
    var amtEl = g('expV6Amount');
    if (amtEl) amtEl.addEventListener('input', function(){ amtEl._manual = true; });

    /* 용도 추가 */
    g('expV6PurposeConfirm').addEventListener('click', doAddPurpose);
    g('expV6PurposeCancel').addEventListener('click', function(){ var row=g('expV6PurposeAddRow'); if(row)row.style.display='none'; renderPurposeChips(); });
    g('expV6PurposeInp').addEventListener('keydown', function(e){ if(e.key==='Enter'){e.preventDefault();doAddPurpose();} });

    /* 자재 추가 */
    g('expV6MatAdd').addEventListener('click', function() {
      _matItems.push({name:'',qty:'',price:'',delivery:''});
      renderMatList();
      var rows = g('expV6MatList').querySelectorAll('input[type=text]');
      if (rows.length) rows[rows.length-1].focus();
    });

    /* 식대 추가 */
    g('expV6MealAdd').addEventListener('click', function() {
      _mealItems.push({menu:'',people:'',price:''});
      renderMealList();
      var rows = g('expV6MealList').querySelectorAll('input[type=text]');
      if (rows.length) rows[rows.length-1].focus();
    });

    /* 개인비용 폐기물 추가 버튼 */
    g('expV6PersonalWasteAdd').addEventListener('click', function() {
      _personalWasteItems.push({desc:'',amount:''});
      renderPersonalWasteList();
      var rows = g('expV6PersonalWasteList').querySelectorAll('input[type=text]');
      if (rows.length) rows[rows.length-1].focus();
    });

    /* 폐기물 항목 추가 (후불청구) */
    g('expV6WasteAdd').addEventListener('click', function() {
      _wasteItems.push({desc:'',amount:''});
      renderWasteList();
    });

    /* 업무연결 */
    g('expV6LinkWorkBtn').addEventListener('click', function() {
      var ldiv = g(LINK_MODAL_ID); if (!ldiv) return;
      ldiv.style.display = 'flex';
      /* 기본값: 이번달 */
      var now = new Date();
      var ym = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
      var fromEl = g('expV6LinkFrom'), toEl = g('expV6LinkTo');
      if (fromEl && !fromEl.value) fromEl.value = ym+'-01';
      if (toEl   && !toEl.value)   toEl.value   = ym+'-'+String(new Date(now.getFullYear(),now.getMonth()+1,0).getDate()).padStart(2,'0');
      renderLinkList('');
    });

    /* 저장 */
    g('expV6Save').addEventListener('click', function() { saveExpense(); });

    /* 삭제 */
    g('expV6Del').addEventListener('click', function() {
      if (!_editId) return;
      if (!confirm('이 지출 내역을 삭제할까요?')) return;
      /* entries에서 삭제 */
      if (typeof deleteRecord === 'function') deleteRecord(_editId);
      else {
        var arr = loadExpenses().filter(function(e){ return e.id!==_editId; });
        saveExpenses(arr);
      }
      close();
      if (typeof renderAll === 'function') renderAll();
      if (typeof toast === 'function') toast('삭제되었습니다');
    });
  }

  /* ── 열기 ── */
  function open(id, fromWork) {
    ensureModal();
    _editId = id||null;
    _matItems=[]; _mealItems=[]; _wasteItems=[]; _personalWasteItems=[];
    _selPurpose={}; _purposes=loadPurposes(); _fromWorkData=fromWork||null;
    _linkedWorkId=null; _expType='없음'; _payMethod='💳 카드'; _receipt='없음';

    var en = (id && typeof entries!=='undefined') ? entries.find(function(e){return e.id===id;}) : null;
    _expData = en ? JSON.parse(JSON.stringify(en)) : {};

    /* 날짜 */
    g('expV6Date').value = (_expData.date) || (typeof todayStr==='function'?todayStr():'');
    g('expV6Title').textContent = id ? '지출 수정' : '지출 등록';
    g('expV6Del').style.display = id ? '' : 'none';

    /* 업무연동 데이터 적용 */
    if (fromWork) {
      g('expV6Date').value = fromWork.date || g('expV6Date').value;
      if (g('expV6Vendor'))  g('expV6Vendor').value  = fromWork.workVendor||'';
      if (g('expV6Desc'))    g('expV6Desc').value    = fromWork.title||'';
      if (g('expV6Memo'))    g('expV6Memo').value    = fromWork.workNote||'';
      _linkedWorkId = fromWork._workId||null;
      _expType = fromWork.expType==='개인비용' ? '💸 개인비용' : fromWork.expType==='후불청구' ? '📃 후불청구' : '없음';
    }

    /* 기존 데이터 복원 */
    if (en) {
      _expType    = en.expType2||en.expType||'없음';
      _payMethod  = en.payMethod||'💳 카드';
      _receipt    = en.receipt||'없음';
      _linkedWorkId = en.workId||null;
      _matItems   = en.matItems   ? JSON.parse(JSON.stringify(en.matItems))   : [];
      _mealItems  = en.mealItems  ? JSON.parse(JSON.stringify(en.mealItems))  : [];
      _wasteItems = en.wasteItems ? JSON.parse(JSON.stringify(en.wasteItems)) : [];
      if (en.purposes) en.purposes.forEach(function(p){ _selPurpose[p]=true; });
      if (g('expV6Vendor'))  g('expV6Vendor').value  = en.vendor||'';
      if (g('expV6Desc'))    g('expV6Desc').value    = en.desc||'';
      if (g('expV6Memo'))    g('expV6Memo').value    = en.memo||'';
      if (g('expV6Amount'))  { g('expV6Amount').value=en.amount||0; g('expV6Amount')._manual=true; }
      if (g('expV6BillStatus')) g('expV6BillStatus').value = en.billStatus||'대기';
      if (g('expV6DeferVendor')) g('expV6DeferVendor').value = en.deferVendor||'';
      if (g('expV6TaxInvoice'))  g('expV6TaxInvoice').value  = en.taxInvoice||'';
      if (g('expV6MgmtStatus'))  g('expV6MgmtStatus').value  = en.mgmtStatus||'미포함';
    }

    /* 버튼 초기화 */
    /* 지출종류 버튼 */
    g('expV6TypeBtns').querySelectorAll('button').forEach(function(btn) {
      var match = btn.textContent === _expType;
      btn.style.background  = match ? (_expType==='💸 개인비용'?'#3f7cb8':_expType==='📃 후불청구'?'#c2410c':'#64748b') : '#f7faff';
      btn.style.color       = match ? '#fff' : '#7a92a8';
      btn.style.borderColor = match ? btn.style.background : '#dbe6f4';
    });
    /* 결제수단 버튼 */
    g('expV6PayBtns').querySelectorAll('button').forEach(function(btn) {
      var match = btn.textContent === _payMethod;
      btn.style.background  = match ? '#0369a1' : '#f7faff';
      btn.style.color       = match ? '#fff' : '#7a92a8';
      btn.style.borderColor = match ? '#0369a1' : '#dbe6f4';
    });
    /* 영수증 버튼 */
    g(MODAL_ID).querySelectorAll('.expReceiptBtn').forEach(function(btn) {
      var match = btn.dataset.receipt === _receipt;
      btn.style.background  = match ? '#0369a1' : '#f7faff';
      btn.style.color       = match ? '#fff' : '#7a92a8';
      btn.style.borderColor = match ? '#0369a1' : '#dbe6f4';
    });

    /* 금액 수동 플래그 초기화 */
    var amtEl = g('expV6Amount');
    if (amtEl) amtEl._manual = !!en;

    renderPurposeChips();
    renderMatList();
    calcMatTotal();
    renderMealList();
    calcMealTotal();
    renderWasteList();
    calcWasteTotal();
    updateAreaVisibility();
    updateWorkLinkUI();

    g(MODAL_ID).style.display = 'flex';
    var sheet = g('expV6Sheet');
    if (sheet) { sheet.scrollTop=0; setTimeout(function(){ sheet.style.transform='translateY(0)'; },10); }
  }

  /* ── 닫기 ── */
  function close() {
    var m = g(MODAL_ID); if (m) m.style.display='none';
  }

  /* ── 저장 ── */
  function saveExpense() {
    var date = g('expV6Date').value;
    if (!date) { if(typeof toast==='function') toast('날짜를 입력하세요'); return; }
    var isP = _expType==='💸 개인비용', isD = _expType==='📃 후불청구';
    var wasteTotal = _wasteItems.reduce(function(s,it){return s+(it.amount||0);},0);

    var data = {
      kind:     'expense',
      date:     date,
      expType2: _expType,
      /* worklog.js renderExpense가 읽는 expType 호환 */
      expType:  isP ? '개인지출' : isD ? '세금계산서' : '개인지출',
      workId:   _linkedWorkId||null,
      memo:     (g('expV6Memo')||{value:''}).value||'',
    };

    if (isP) {
      var desc = (g('expV6Desc')||{value:''}).value.trim();
      var vendor = (g('expV6Vendor')||{value:''}).value.trim();
      var amount = parseFloat((g('expV6Amount')||{value:0}).value)||0;
      if (!desc && !vendor && !amount) { if(typeof toast==='function') toast('내역이나 금액을 입력하세요'); return; }
      Object.assign(data, {
        title:      desc || vendor,
        vendor:     vendor,
        desc:       desc,
        purposes:   Object.keys(_selPurpose).filter(function(k){return _selPurpose[k];}),
        amount:     amount,
        payMethod:  _payMethod,
        receipt:    _receipt,
        matItems:   _matItems.slice(),
        mealItems:  _mealItems.slice(),
        billStatus: (g('expV6BillStatus')||{value:'대기'}).value,
      });
    }
    if (isD) {
      var dVendor = (g('expV6DeferVendor')||{value:''}).value.trim();
      if (!dVendor && !_wasteItems.length) { if(typeof toast==='function') toast('업체명이나 청구항목을 입력하세요'); return; }
      Object.assign(data, {
        title:       dVendor || ((_wasteItems[0]||{}).desc||'후불청구'),
        vendor:      dVendor,
        deferVendor: dVendor,
        wasteItems:  _wasteItems.slice(),
        amount:      wasteTotal||0,
        taxInvoice:  (g('expV6TaxInvoice')||{value:''}).value,
        mgmtStatus:  (g('expV6MgmtStatus')||{value:'미포함'}).value,
      });
    }

    if (_editId) {
      if (typeof updateRecord==='function') updateRecord(_editId, data);
    } else {
      data.createdAt = Date.now();
      if (typeof addRecord==='function') addRecord(data);
    }

    close();
    if (typeof renderAll==='function') renderAll();
    if (typeof toast==='function') toast(_editId?'수정되었습니다':'저장되었습니다');
  }

  /* ── 외부 연결 ── */
  function init() {
    /* openExpenseEditor 교체 */
    window.openExpenseEditor = function(id) { open(id, null); };

    /* 지출 탭은 worklog.html에 이미 있으므로 동적 추가 안 함 */
    /* panel-expense — 기존 버튼만 교체 (패널은 worklog.html에 이미 있음) */
    var existPanel = document.getElementById('panel-expense');
    if (existPanel) {
      /* btnAddExpense 버튼을 새 open() 로 교체 */
      var addBtn = document.getElementById('btnAddExpense');
      if (addBtn) {
        var newBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newBtn, addBtn);
        newBtn.addEventListener('click', function(){ open(null, null); });
      }
      /* btnAddExpV6 도 연결 (혹시 있으면) */
      var addBtn2 = document.getElementById('btnAddExpV6');
      if (addBtn2) addBtn2.addEventListener('click', function(){ open(null, null); });
    }

    /* openExpenseFromWork 교체 */
    window.openExpenseFromWork = function(info) {
      var w = info.workObj||{};
      open(null, {
        date:       w.date,
        workVendor: w.workVendor||'',
        title:      w.title||'',
        workNote:   w.workNote||'',
        expType:    info.expType||'없음',
        _workId:    info.workId,
      });
    };

    /* 지출 탭 대시보드 — 이번달 요약 */
    try {
      var origRenderExpenseStats = window.renderExpenseStats;
      if (typeof origRenderExpenseStats === 'function') {
        /* 기존 통계 그대로 사용 */
      }
    } catch(e) {}
  }

  var _wait = 0;
  function waitAndInit() {
    if (typeof entries !== 'undefined' && typeof addRecord !== 'undefined') { init(); return; }
    if (_wait++ < 40) setTimeout(waitAndInit, 500);
  }
  waitAndInit();
  setTimeout(init, 2000);
  console.log('[worklog_patch_v44] PART2 지출 패치 로드');
})();


;


/* ─────────────────────────────────────────
   PART 3: 검색 파일 바로 열기
───────────────────────────────────────── */
(function patchSearch(){
  'use strict';

  function patchGlobalSearch(){
    if(window._v44searchPatched)return;
    /* 전체검색 결과에서 파일/사이트 클릭 이벤트 위임 */
    var gsResults=document.getElementById('gsResults');
    if(!gsResults){setTimeout(patchGlobalSearch,500);return;}
    gsResults.addEventListener('click',function(e){
      var item=e.target.closest('.gs-item');
      if(!item)return;
      var kind=item.dataset.kind;
      if(kind!=='filelink'&&kind!=='site')return;
      var id=item.dataset.id;
      if(!id||typeof entries==='undefined')return;
      var entry=entries.find(function(x){return x.id===id;});
      if(!entry)return;
      if(kind==='filelink'&&entry.path){
        e.preventDefault();e.stopPropagation();
        var url='localfile://'+encodeURI(entry.path.replace(/\\/g,'/'));
        window.open(url,'_self');
        var ov=document.getElementById('globalSearchOverlay');if(ov)ov.classList.remove('show');
      } else if(kind==='site'&&entry.url){
        e.preventDefault();e.stopPropagation();
        var surl=entry.url;if(!/^https?:\/\//i.test(surl))surl='https://'+surl;
        window.open(surl,'_blank','noopener');
        var ov2=document.getElementById('globalSearchOverlay');if(ov2)ov2.classList.remove('show');
      }
    },true);
    window._v44searchPatched=true;
  }

  setTimeout(patchGlobalSearch,1000);
  console.log('[worklog_patch_v44] PART3 검색 패치 로드');
})();
