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
            /* 상세보기: 체크박스 클릭 가능, 텍스트 수정 불가 */
            /* 저장 버튼 동적 추가 */
            var vBtnRow = document.querySelector('#viewOverlay .btn-row');
            if (vBtnRow && !vBtnRow.querySelector('#vMemoSave')) {
              var saveBtn = document.createElement('button');
              saveBtn.id = 'vMemoSave';
              saveBtn.className = 'btn btn-primary';
              saveBtn.textContent = '💾 저장';
              saveBtn.style.display = 'none';
              saveBtn.addEventListener('click', function() {
                if (typeof updateRecord === 'function' && data && data.id) {
                  var wrapper = valEl.querySelector('.sticky-note-body');
                  if (wrapper) {
                    updateRecord(data.id, { body: wrapper.innerHTML });
                    if (typeof toast === 'function') toast('저장됐어요');
                    saveBtn.style.display = 'none';
                  }
                }
              });
              vBtnRow.insertBefore(saveBtn, vBtnRow.firstChild);
            }

            valEl.querySelectorAll('.checklist-cb').forEach(function(cb) {
              cb.addEventListener('click', function(e) {
                e.preventDefault(); e.stopPropagation();
                var r = cb.closest('.checklist-row');
                if (!r) return;
                r.classList.toggle('done');
                /* 저장 버튼 표시 */
                var sb = document.getElementById('vMemoSave');
                if (sb) sb.style.display = '';
              });
            });
            /* 텍스트 수정 불가 + 엔터로 새 항목 추가 가능 */
            valEl.querySelectorAll('.checklist-text').forEach(function(t) {
              t.contentEditable = 'true';
              /* 기존 텍스트 변경 감지 — 원복 */
              var origText = t.innerText || '';
              t.addEventListener('blur', function() {
                if ((t.innerText || '') !== origText) t.innerText = origText;
              });
              t.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  /* 새 체크박스 행 추가 */
                  var row = t.closest('.checklist-row');
                  if (!row) return;
                  var newRow = document.createElement('div');
                  newRow.className = 'checklist-row';
                  newRow.contentEditable = 'false';
                  newRow.dataset.indent = row.dataset.indent || '0';
                  newRow.innerHTML = '<span class="checklist-cb" contenteditable="false"></span>'
                    + '<span class="checklist-text" contenteditable="true"></span>';
                  row.after(newRow);
                  var newText = newRow.querySelector('.checklist-text');
                  if (newText) {
                    newText.focus();
                    newText.addEventListener('blur', function() {
                      var sb = document.getElementById('vMemoSave');
                      if (sb) sb.style.display = '';
                    });
                  }
                } else if (e.key !== 'Tab' && e.key !== 'Escape') {
                  /* 일반 타이핑 막기 */
                  e.preventDefault();
                }
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


/* ===== 지출 모달 용도별 동적 필드 (worklog.html 직접 삽입용) ===== */
(function() {

var _expData = null;
var _expPhoto = null;
var _matItems = [];   // [{name, qty, price, delivery}]
var _mealItems = [];  // [{menu, people, price}]
var _wasteItems = []; // [{desc, amount}]
var _selPurpose = {};

var DEFAULT_PURPOSES = ['자재구매','소모품','식대','폐기물 처리','기타'];
var PURPOSE_LS = 'wl_expense_purposes_v6';

function loadPurposes() {
  try { return JSON.parse(localStorage.getItem(PURPOSE_LS)||'null') || DEFAULT_PURPOSES.slice(); } catch(e) { return DEFAULT_PURPOSES.slice(); }
}

var fmt = function(n) { return Math.round(Number(n)||0).toLocaleString('ko-KR'); };
var g = function(id) { return document.getElementById(id); };
var esc = function(s) { return (s||'').replace(/[&<>"]/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]);}); };

function inp(type, val, ph, style) {
  var el = document.createElement('input');
  el.type = type; el.value = val||''; el.placeholder = ph||'';
  el.style.cssText = (style||'') + 'width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45';
  return el;
}

/* ── 자재목록 ── */
function renderMatList() {
  var list = g('expV2MatList'); if(!list) return;
  list.innerHTML = '';
  _matItems.forEach(function(it, i) {
    var row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 52px 76px 64px 28px;gap:4px;margin-bottom:4px;align-items:center';
    var nameInp  = inp('text',   it.name||'',     '품명·규격');
    var qtyInp   = inp('number', it.qty||'',      '수량');
    var priceInp = inp('number', it.price||'',    '단가');
    var delivInp = inp('number', it.delivery||'', '택배비');
    qtyInp.style.textAlign = priceInp.style.textAlign = delivInp.style.textAlign = 'right';
    var delBtn = document.createElement('button');
    delBtn.textContent = '🗑'; delBtn.type = 'button';
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
  var total = _matItems.reduce(function(s,it){ return s+((it.qty||0)*(it.price||0))+(it.delivery||0); }, 0);
  var el = g('expV2MatTotal'); if(el) el.textContent = fmt(total)+'원';
  var a = g('expV2Amount'); if(a && total>0 && !a._manual) a.value = total;
}

/* ── 식대목록 ── */
function renderMealList() {
  var list = g('expV2MealList'); if(!list) return;
  list.innerHTML = '';
  _mealItems.forEach(function(it, i) {
    var row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 52px 80px 28px;gap:4px;margin-bottom:4px;align-items:center';
    var menuInp   = inp('text',   it.menu||'',   '메뉴명');
    var peopleInp = inp('number', it.people||'', '인원');
    var priceInp  = inp('number', it.price||'',  '1인 단가');
    peopleInp.style.textAlign = priceInp.style.textAlign = 'right';
    var delBtn = document.createElement('button');
    delBtn.textContent = '🗑'; delBtn.type = 'button';
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
  var total = _mealItems.reduce(function(s,it){ return s+((it.people||0)*(it.price||0)); }, 0);
  var el = g('expV2MealTotal'); if(el) el.textContent = fmt(total)+'원';
  var a = g('expV2Amount'); if(a && total>0 && !a._manual) a.value = total;
}

/* ── 폐기물목록 ── */
function renderWasteList() {
  var list = g('expV2WasteList'); if(!list) return;
  list.innerHTML = '';
  _wasteItems.forEach(function(it, i) {
    var row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 100px 28px;gap:4px;margin-bottom:4px;align-items:center';
    var descInp   = inp('text',   it.desc||'',   '항목명 (예: 대형폐기물)');
    var amountInp = inp('number', it.amount||'', '금액');
    amountInp.style.textAlign = 'right';
    var delBtn = document.createElement('button');
    delBtn.textContent = '🗑'; delBtn.type = 'button';
    delBtn.style.cssText = 'border:none;background:none;font-size:14px;cursor:pointer;padding:0';
    descInp.addEventListener('input',   function(){ _wasteItems[i].desc   = descInp.value; });
    amountInp.addEventListener('input', function(){ _wasteItems[i].amount = parseFloat(amountInp.value)||0; calcWasteTotal(); });
    (function(idx){ delBtn.addEventListener('click', function(){ _wasteItems.splice(idx,1); renderWasteList(); calcWasteTotal(); }); })(i);
    row.appendChild(descInp); row.appendChild(amountInp); row.appendChild(delBtn);
    list.appendChild(row);
  });
}
function calcWasteTotal() {
  var total = _wasteItems.reduce(function(s,it){ return s+(it.amount||0); }, 0);
  var el = g('expV2WasteTotal'); if(el) el.textContent = fmt(total)+'원';
  var a = g('expV2Amount'); if(a && total>0 && !a._manual) a.value = total;
}

/* ── 용도별 섹션 표시/숨김 ── */
function updatePurposeAreas() {
  var matOn   = !!(_selPurpose['자재구매'] || _selPurpose['소모품']);
  var mealOn  = !!_selPurpose['식대'];
  var wasteOn = !!_selPurpose['폐기물 처리'];
  var matArea   = g('expV2MatArea');
  var mealArea  = g('expV2MealArea');
  var wasteArea = g('expV2WasteArea');
  if(matArea)   matArea.style.display   = matOn   ? '' : 'none';
  if(mealArea)  mealArea.style.display  = mealOn  ? '' : 'none';
  if(wasteArea) wasteArea.style.display = wasteOn ? '' : 'none';
}

/* ── 용도칩 렌더 ── */
function renderPurposeChips() {
  var wrap = g('expV2PurposeWrap'); if(!wrap) return;
  var purposes = loadPurposes();
  wrap.innerHTML = '';
  purposes.forEach(function(p) {
    var chip = document.createElement('button');
    chip.type = 'button';
    var active = !!_selPurpose[p];
    chip.textContent = p;
    chip.style.cssText = 'padding:6px 14px;border-radius:18px;border:1.5px solid '+(active?'#3f7cb8':'#dbe6f4')+';background:'+(active?'#3f7cb8':'#f7faff')+';color:'+(active?'#fff':'#7a92a8')+';font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s';
    chip.addEventListener('click', function() {
      if(_selPurpose[p]) delete _selPurpose[p]; else _selPurpose[p] = true;
      renderPurposeChips();
      updatePurposeAreas();
    });
    wrap.appendChild(chip);
  });
}

/* ── 모달 HTML 생성 ── */
function buildExpenseModalHTML() {
  return '<div style="margin-bottom:12px">'
    +'<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">날짜 *</label>'
    +'<input type="date" id="expV2Date" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">'
    +'</div>'
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">정산종류</label>'
    +'<div style="display:flex;gap:6px">'
    +'<button type="button" data-etype="개인지출" class="expV2TypeBtn" style="flex:1;height:40px;border-radius:10px;border:1.5px solid #3f7cb8;background:#3f7cb8;color:#fff;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">💸 개인지출</button>'
    +'<button type="button" data-etype="세금계산서" class="expV2TypeBtn" style="flex:1;height:40px;border-radius:10px;border:1.5px solid #dbe6f4;background:#f7faff;color:#7a92a8;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">📃 세금계산서</button>'
    +'</div>'
    +'</div>'
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">업체명</label>'
    +'<input type="text" id="expV2Vendor" placeholder="예: 성신철물, 서브원" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">'
    +'</div>'
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">내역 *</label>'
    +'<input type="text" id="expV2TitleInput" placeholder="예: 형광등 교체, 엘리베이터 점검" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">'
    +'</div>'
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:8px">용도</label>'
    +'<div id="expV2PurposeWrap" style="display:flex;flex-wrap:wrap;gap:6px"></div>'
    +'</div>'

    /* 자재/소모품 섹션 */
    +'<div id="expV2MatArea" style="display:none;margin-bottom:12px">'
    +'<div style="background:#f0f6ff;border:1.5px solid #93c5fd;border-radius:12px;padding:12px">'
    +'<div style="font-size:12px;font-weight:700;color:#185FA5;margin-bottom:8px">📦 자재 / 소모품 목록</div>'
    +'<div style="display:grid;grid-template-columns:1fr 52px 76px 64px 28px;gap:4px;margin-bottom:4px">'
    +'<div style="font-size:10px;font-weight:700;color:#7a92a8">품명·규격</div>'
    +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:center">수량</div>'
    +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">단가(원)</div>'
    +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">택배비</div>'
    +'<div></div>'
    +'</div>'
    +'<div id="expV2MatList"></div>'
    +'<button type="button" id="expV2MatAdd" style="width:100%;height:32px;border:1.5px dashed #93c5fd;border-radius:8px;background:transparent;font-size:13px;font-weight:600;color:#3f7cb8;cursor:pointer;font-family:inherit;margin-top:4px">➕ 품목 추가</button>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:6px 10px;background:#fff;border-radius:8px;border:1px solid #93c5fd">'
    +'<span style="font-size:12px;font-weight:700;color:#185FA5">합계</span>'
    +'<span id="expV2MatTotal" style="font-size:16px;font-weight:800;color:#0C447C">0원</span>'
    +'</div>'
    +'</div></div>'

    /* 식대 섹션 */
    +'<div id="expV2MealArea" style="display:none;margin-bottom:12px">'
    +'<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:12px">'
    +'<div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:8px">🍽 식대 내역</div>'
    +'<div style="display:grid;grid-template-columns:1fr 52px 80px 28px;gap:4px;margin-bottom:4px">'
    +'<div style="font-size:10px;font-weight:700;color:#7a92a8">메뉴</div>'
    +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:center">인원</div>'
    +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">1인 단가</div>'
    +'<div></div>'
    +'</div>'
    +'<div id="expV2MealList"></div>'
    +'<button type="button" id="expV2MealAdd" style="width:100%;height:32px;border:1.5px dashed #86efac;border-radius:8px;background:transparent;font-size:13px;font-weight:600;color:#166534;cursor:pointer;font-family:inherit;margin-top:4px">➕ 메뉴 추가</button>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:6px 10px;background:#fff;border-radius:8px;border:1px solid #86efac">'
    +'<span style="font-size:12px;font-weight:700;color:#166534">합계</span>'
    +'<span id="expV2MealTotal" style="font-size:16px;font-weight:800;color:#166534">0원</span>'
    +'</div>'
    +'</div></div>'

    /* 폐기물 섹션 */
    +'<div id="expV2WasteArea" style="display:none;margin-bottom:12px">'
    +'<div style="background:#fff7ed;border:1.5px solid #fdba74;border-radius:12px;padding:12px">'
    +'<div style="font-size:12px;font-weight:700;color:#c2410c;margin-bottom:8px">🗑 폐기물 처리 청구 항목</div>'
    +'<div style="display:grid;grid-template-columns:1fr 100px 28px;gap:4px;margin-bottom:4px">'
    +'<div style="font-size:10px;font-weight:700;color:#7a92a8">항목명</div>'
    +'<div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">금액(원)</div>'
    +'<div></div>'
    +'</div>'
    +'<div id="expV2WasteList"></div>'
    +'<button type="button" id="expV2WasteAdd" style="width:100%;height:32px;border:1.5px dashed #fdba74;border-radius:8px;background:transparent;font-size:13px;font-weight:600;color:#c2410c;cursor:pointer;font-family:inherit;margin-top:4px">➕ 항목 추가</button>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:6px 10px;background:#fff;border-radius:8px;border:1px solid #fdba74">'
    +'<span style="font-size:12px;font-weight:700;color:#c2410c">합계</span>'
    +'<span id="expV2WasteTotal" style="font-size:16px;font-weight:800;color:#c2410c">0원</span>'
    +'</div>'
    +'</div></div>'

    /* 금액 */
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">금액 (원) *</label>'
    +'<input type="number" id="expV2Amount" placeholder="0" min="0" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #3f7cb8;border-radius:10px;font-size:16px;font-weight:800;font-family:inherit;background:#f7faff;outline:none;color:#185FA5;text-align:right">'
    +'</div>'
    /* 메모 */
    +'<div style="margin-bottom:16px">'
    +'<label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">메모</label>'
    +'<input type="text" id="expV2Memo" placeholder="간단한 메모" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none">'
    +'</div>';
}

/* ── 오버레이 생성 ── */
function ensureOverlay() {
  if(g('expV2Overlay')) return;
  var ov = document.createElement('div');
  ov.id = 'expV2Overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:none;align-items:flex-end;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Pretendard",sans-serif';
  ov.innerHTML = '<div id="expV2Sheet" style="background:#fff;width:100%;max-width:540px;max-height:92vh;overflow-y:auto;border-radius:22px 22px 0 0;padding:20px 18px 36px;box-shadow:0 -4px 32px rgba(0,0,0,.18);border-top:3px solid #3f7cb8">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
    +'<span id="expV2TitleSpan" style="font-size:16px;font-weight:700;color:#1a2f45">지출 등록</span>'
    +'<button type="button" id="expV2Close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#7a92a8">✕</button>'
    +'</div>'
    +'<div id="expV2Fields"></div>'
    +'<div style="display:flex;gap:8px">'
    +'<button type="button" id="expV2Del" style="flex:1;height:48px;border-radius:12px;border:none;background:#fde8e8;color:#b52929;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;display:none">🗑 삭제</button>'
    +'<button type="button" id="expV2Save" style="flex:2;height:48px;border-radius:12px;border:none;background:#3f7cb8;color:#fff;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer">💾 저장</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(ov);

  g('expV2Close').addEventListener('click', closeOverlay);
  ov.addEventListener('click', function(e){ if(e.target===ov) closeOverlay(); });
  g('expV2Save').addEventListener('click', saveExpenseV2);
  g('expV2Del').addEventListener('click', deleteExpenseV2);
}

function closeOverlay() {
  var ov = g('expV2Overlay'); if(ov) ov.style.display = 'none';
}

/* ── 열기 ── */
var _editId = null;
var _expType = '개인지출';

function openExpV2(id) {
  ensureOverlay();
  _editId = id || null;
  _matItems = []; _mealItems = []; _wasteItems = []; _selPurpose = {};
  _expType = '개인지출';

  var en = id ? (typeof entries !== 'undefined' ? entries.find(function(x){return x.id===id;}) : null) : null;

  var titleSpan=g('expV2TitleSpan'); if(titleSpan) titleSpan.textContent = id ? '지출 수정' : '지출 등록';
  g('expV2Del').style.display = id ? '' : 'none';
  g('expV2Fields').innerHTML = buildExpenseModalHTML();

  /* 초기값 */
  var today = new Date();
  var todayStr = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  g('expV2Date').value  = en ? (en.date||todayStr) : todayStr;
  g('expV2Vendor').value = en ? (en.vendor||'') : '';
  g('expV2Memo').value  = en ? (en.memo||'') : '';

  // expV2Title is the sheet title — fix: get the input
  var titleInp = g('expV2Title'); // this is the sheet title span, not input
  // The content input is expV2TitleInp — but we named it expV2Title in buildHTML
  // Actually we have id="expV2Title" as input inside fields
  // Wait - there's a conflict: expV2Title is used for both sheet title span AND inner input
  // Let's fix: the sheet title is a span with id="expV2Title", inner input has no id conflict... 
  // Actually in buildHTML I didn't give the title input an id — let me check
  // In buildHTML: id="expV2Title" is the inner input. The sheet title is expV2TitleSpan
  // I need to fix this naming conflict
  
  if(en) {
    _expType = en.expType === '세금계산서' ? '세금계산서' : '개인지출';
    if(en.matItems) _matItems = JSON.parse(JSON.stringify(en.matItems));
    if(en.mealItems) _mealItems = JSON.parse(JSON.stringify(en.mealItems));
    if(en.wasteItems) _wasteItems = JSON.parse(JSON.stringify(en.wasteItems));
    if(en.purposes) en.purposes.forEach(function(p){ _selPurpose[p]=true; });
  }

  /* 금액 */
  var amtEl = g('expV2Amount');
  if(amtEl) {
    amtEl.value = en ? (en.amount||0) : 0;
    amtEl.addEventListener('input', function(){ amtEl._manual = true; });
  }

  /* 내역 input */
  var tInp = g('expV2TitleInput'); if(tInp) tInp.value = en ? (en.title||'') : '';

  /* 정산종류 버튼 */
  updateTypeButtons();
  document.querySelectorAll('.expV2TypeBtn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _expType = btn.dataset.etype;
      updateTypeButtons();
    });
  });

  /* 용도칩 */
  renderPurposeChips();
  updatePurposeAreas();

  /* 자재/식대/폐기물 추가 버튼 */
  var matAdd = g('expV2MatAdd');
  if(matAdd) matAdd.addEventListener('click', function() {
    _matItems.push({name:'',qty:'',price:'',delivery:''});
    renderMatList();
    var rows = g('expV2MatList').querySelectorAll('input[type=text]');
    if(rows.length) rows[rows.length-1].focus();
  });
  var mealAdd = g('expV2MealAdd');
  if(mealAdd) mealAdd.addEventListener('click', function() {
    _mealItems.push({menu:'',people:'',price:''});
    renderMealList();
    var rows = g('expV2MealList').querySelectorAll('input[type=text]');
    if(rows.length) rows[rows.length-1].focus();
  });
  var wasteAdd = g('expV2WasteAdd');
  if(wasteAdd) wasteAdd.addEventListener('click', function() {
    _wasteItems.push({desc:'',amount:''});
    renderWasteList();
  });

  /* 기존 데이터 렌더 */
  renderMatList(); calcMatTotal();
  renderMealList(); calcMealTotal();
  renderWasteList(); calcWasteTotal();

  var ov = g('expV2Overlay');
  ov.style.display = 'flex';
  var sheet = g('expV2Sheet');
  if(sheet) sheet.scrollTop = 0;
}

function updateTypeButtons() {
  document.querySelectorAll('.expV2TypeBtn').forEach(function(btn) {
    var active = btn.dataset.etype === _expType;
    btn.style.background = active ? '#3f7cb8' : '#f7faff';
    btn.style.color = active ? '#fff' : '#7a92a8';
    btn.style.borderColor = active ? '#3f7cb8' : '#dbe6f4';
  });
  var sheet = g('expV2Sheet');
  if(sheet) sheet.style.borderTopColor = _expType==='세금계산서' ? '#c2410c' : '#3f7cb8';
}

function saveExpenseV2() {
  var title = (g('expV2TitleInput')||{value:''}).value.trim();

  var date   = (g('expV2Date')||{value:''}).value;
  var amount = parseFloat((g('expV2Amount')||{value:0}).value)||0;
  var vendor = ((g('expV2Vendor')||{value:''}).value||'').trim();
  var memo   = ((g('expV2Memo')||{value:''}).value||'').trim();

  if(!title) { if(typeof toast==='function') toast('내역을 입력하세요'); return; }
  if(!amount) { if(typeof toast==='function') toast('금액을 입력하세요'); return; }

  var purposes = Object.keys(_selPurpose).filter(function(k){return _selPurpose[k];});

  var obj = {
    kind: 'expense',
    date: date,
    expType: _expType,
    title: title,
    amount: amount,
    vendor: vendor,
    memo: memo,
    purposes: purposes,
    matItems: _matItems.slice(),
    mealItems: _mealItems.slice(),
    wasteItems: _wasteItems.slice()
  };

  if(_editId) {
    if(typeof updateRecord==='function') updateRecord(_editId, obj);
  } else {
    obj.createdAt = Date.now();
    if(typeof addRecord==='function') addRecord(obj);
  }

  closeOverlay();
  if(typeof renderAll==='function') renderAll();
  if(typeof toast==='function') toast(_editId ? '수정되었습니다' : '저장되었습니다');
}

function deleteExpenseV2() {
  if(!_editId) return;
  if(!confirm('이 지출 내역을 삭제할까요?')) return;
  if(typeof deleteWithUndo==='function') deleteWithUndo(_editId, '지출');
  closeOverlay();
}

/* ── openExpenseEditor 교체 ── */
function patchExpenseEditor() {
  window.openExpenseEditor = function(id) { openExpV2(id); };

  /* FAB/카테고리 시트의 expense 버튼 */
  document.querySelectorAll('[data-add="expense"]').forEach(function(btn) {
    btn.addEventListener('click', function() { openExpV2(null); });
  });

  /* v43 메인목록의 expense 클릭 */
  var origOpenViewer = window.openViewer;
  if(origOpenViewer && !origOpenViewer._expV2hooked) {
    window.openViewer = function(kind, id) {
      if(kind === 'expense') { openExpV2(id); return; }
      origOpenViewer(kind, id);
    };
    window.openViewer._expV2hooked = true;
  }

  /* btnAddExpense */
  var btn = document.getElementById('btnAddExpense');
  if(btn && !btn._expV2) {
    btn._expV2 = true;
    btn.addEventListener('click', function(){ openExpV2(null); });
  }

  /* v43CatOverlay expense 버튼 */
  document.querySelectorAll('.v43-cat-btn[data-add]').forEach(function(b) {
    if(b.dataset.add === 'expense') {
      if(!b._expV2) { b._expV2 = true; b.addEventListener('click', function(){ openExpV2(null); }); }
    }
  });
}

/* DOM 준비 후 실행 */
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', patchExpenseEditor);
} else {
  patchExpenseEditor();
}
setTimeout(patchExpenseEditor, 1000);
setTimeout(patchExpenseEditor, 3000);

console.log('[expenseV2] 지출 모달 패치 로드');
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
