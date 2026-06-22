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
