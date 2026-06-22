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

      /* vBody의 body 필드 셀을 체크리스트로 교체 */
      setTimeout(function() {
        var vBody = document.getElementById('vBody');
        if (!vBody || !data.body || data.body.indexOf('checklist-row') < 0) return;

        /* vrow 행에서 "내용" 또는 body 라벨을 찾아서 값 셀 교체 */
        var rows = vBody.querySelectorAll('.vrow');
        rows.forEach(function(row) {
          var keyEl = row.querySelector('.vk');
          var valEl = row.querySelector('.vv');
          if (!keyEl || !valEl) return;
          var keyTxt = (keyEl.textContent || '').trim();
          /* SCHEMA memo의 body 필드 라벨 = "내용" */
          if (keyTxt !== '내용') return;
          /* 현재 vv에 HTML 태그가 텍스트로 들어있으면 교체 */
          var rawTxt = valEl.textContent || '';
          if (rawTxt.indexOf('checklist-row') < 0 && rawTxt.indexOf('<div') < 0) return;
          var tmp = sanitize(data.body);
          var wrapper = document.createElement('div');
          wrapper.className = 'sticky-note-body';
          wrapper.innerHTML = tmp.innerHTML;
          valEl.innerHTML = '';
          valEl.appendChild(wrapper);
          /* 체크박스 클릭 토글 (확인 모달에서도 체크 가능) */
          valEl.querySelectorAll('.checklist-cb').forEach(function(cb) {
            cb.addEventListener('click', function(e) {
              e.preventDefault(); e.stopPropagation();
              var row2 = cb.closest('.checklist-row');
              if (row2) row2.classList.toggle('done');
            });
          });
        });
      }, 60);
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

  var DEFAULT_PURPOSES = [
    { icon: '🔩', label: '자재구매' },
    { icon: '🍽', label: '식대' },
    { icon: '🚗', label: '교통/주차' },
    { icon: '🧹', label: '소모품' },
    { icon: '📋', label: '기타' }
  ];
  var PAY_METHODS = ['💳 카드', '🏦 은행이체', '💵 현금'];
  var EXP_TYPES   = ['없음', '💸 개인비용', '📃 후불청구'];

  function loadExp()        { try { return JSON.parse(localStorage.getItem(EXP_LS) || '[]'); } catch(e) { return []; } }
  function saveExp(arr)     { try { localStorage.setItem(EXP_LS, JSON.stringify(arr)); } catch(e) {} }
  function loadPurposes()   { try { return JSON.parse(localStorage.getItem(PURPOSE_LS) || 'null') || DEFAULT_PURPOSES.slice(); } catch(e) { return DEFAULT_PURPOSES.slice(); } }
  function savePurposes(a)  { try { localStorage.setItem(PURPOSE_LS, JSON.stringify(a)); } catch(e) {} }
  function genId()          { return 'exp6_' + Date.now() + '_' + Math.floor(Math.random() * 9999); }
  function fmt(n)           { return n > 0 ? '₩' + Math.round(n).toLocaleString('ko-KR') : '₩0'; }
  function esc(s)           { return (s||'').toString().replace(/[&<>"]/g, function(m){ return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]); }); }
  function g(id)            { return document.getElementById(id); }
  function todayStr()       { var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

  var _editId    = null;
  var _expType   = '없음';
  var _payMethod = '💳 카드';
  var _selPurpose = {};
  var _matItems  = [];
  var _purposes  = [];
  var _expFilter = 'all';
  var _linkedWorkId = null;
  var _fromWorkData = null;

  function injectModal() {
    if (g(MODAL_ID)) return;
    var div = document.createElement('div');
    div.id = MODAL_ID;
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10010;display:none;align-items:flex-end;justify-content:center';
    div.innerHTML = '<div id="expV6Sheet" style="background:#fff;width:100%;max-width:540px;max-height:92vh;overflow-y:auto;border-radius:22px 22px 0 0;padding:20px 18px 36px;box-shadow:0 -4px 32px rgba(0,0,0,.18);font-family:-apple-system,BlinkMacSystemFont,\'Pretendard\',sans-serif">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><span id="expV6Title" style="font-size:16px;font-weight:700;color:#1a2f45">지출 등록</span><button id="expV6Close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#7a92a8">✕</button></div>'
      +'<div id="expV6WorkLink" style="display:none;margin-bottom:12px;padding:10px 12px;background:#f0f6ff;border:1.5px solid #93c5fd;border-radius:10px;cursor:pointer"><div style="font-size:11px;font-weight:700;color:#185FA5;margin-bottom:3px">🔗 연결된 업무</div><div id="expV6WorkLinkText" style="font-size:13px;font-weight:600;color:#1a2f45"></div></div>'
      +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">날짜</label><input type="date" id="expV6Date" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"></div>'
      +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">지출 종류</label><div id="expV6TypeBtns" style="display:flex;gap:6px"></div></div>'
      +'<div style="height:1px;background:#f0f4f8;margin:14px 0"></div>'
      +'<div id="expV6PersonalArea" style="display:none">'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">결제 수단</label><div id="expV6PayBtns" style="display:flex;gap:6px"></div></div>'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">업체명</label><input type="text" id="expV6Vendor" placeholder="예: 성신철물" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"></div>'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">내역</label><input type="text" id="expV6Desc" placeholder="예: 형광등 4개" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"></div>'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">용도</label><div id="expV6PurposeWrap" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"></div><div id="expV6PurposeAddRow" style="display:none;gap:6px;margin-top:8px;align-items:center"><input type="text" id="expV6PurposeInp" placeholder="용도 이름" style="flex:1;height:34px;padding:0 10px;border:1.5px solid #3f7cb8;border-radius:20px;font-size:13px;font-family:inherit;outline:none;background:#fff;color:#1a2f45;min-width:0"><button id="expV6PurposeConfirm" style="height:34px;padding:0 14px;background:#3f7cb8;color:#fff;border:none;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0">추가</button><button id="expV6PurposeCancel" style="height:34px;padding:0 12px;background:#f0f4f8;color:#7a92a8;border:none;border-radius:20px;font-size:13px;cursor:pointer;font-family:inherit;flex-shrink:0">취소</button></div></div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px"><div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">금액 (원)</label><input type="number" id="expV6Amount" placeholder="0" min="0" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #3f7cb8;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;background:#f7faff;outline:none;color:#185FA5;text-align:right"></div><div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:6px">영수증</label><div style="display:flex;gap:6px"><button data-receipt="있음" class="expReceiptBtn" style="flex:1;height:40px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;background:#f7faff;color:#7a92a8">있음</button><button data-receipt="없음" class="expReceiptBtn" style="flex:1;height:40px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;background:#f7faff;color:#7a92a8">없음</button></div></div></div>'
        +'<div id="expV6MatArea" style="display:none;margin-bottom:12px"><div style="background:#f0f6ff;border:1.5px solid #93c5fd;border-radius:12px;padding:12px"><div style="font-size:12px;font-weight:700;color:#185FA5;margin-bottom:10px">📦 자재 목록</div><div style="display:grid;grid-template-columns:1fr 52px 76px 32px;gap:5px;margin-bottom:5px"><div style="font-size:10px;font-weight:700;color:#7a92a8">품명·규격</div><div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:center">수량</div><div style="font-size:10px;font-weight:700;color:#7a92a8;text-align:right">단가(원)</div><div></div></div><div id="expV6MatList"></div><button id="expV6MatAdd" style="width:100%;height:34px;border:1.5px dashed #93c5fd;border-radius:10px;background:transparent;font-size:13px;font-weight:600;color:#3f7cb8;cursor:pointer;font-family:inherit;margin-top:4px">➕ 품목 추가</button><div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:8px 12px;background:#fff;border:1.5px solid #93c5fd;border-radius:10px"><span style="font-size:13px;font-weight:700;color:#185FA5">합계</span><span id="expV6MatTotal" style="font-size:18px;font-weight:800;color:#0C447C">₩0</span></div></div></div>'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">품의서 상태</label><select id="expV6BillStatus" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"><option>대기</option><option>제출</option><option>완료</option></select></div>'
      +'</div>'
      +'<div id="expV6DeferArea" style="display:none">'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">업체명</label><input type="text" id="expV6DeferVendor" placeholder="예: 고려이엔알" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #fdba74;border-radius:10px;font-size:14px;font-family:inherit;background:#fff7ed;outline:none;color:#1a2f45"></div>'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">청구 내역</label><input type="text" id="expV6DeferDesc" placeholder="예: 대형폐기물 처리" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"></div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px"><div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">청구금액 (원)</label><input type="number" id="expV6DeferAmount" placeholder="0" min="0" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #fdba74;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;background:#fff7ed;outline:none;color:#c2410c;text-align:right"></div><div><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">세금계산서</label><select id="expV6TaxInvoice" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"><option value="">선택</option><option value="발행">✅ 발행</option><option value="발행예정">⏳ 발행예정</option><option value="미발행">❌ 미발행</option></select></div></div>'
        +'<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">관리비 포함 상태</label><select id="expV6MgmtStatus" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"><option>미포함</option><option>포함</option><option>수금완료</option></select></div>'
      +'</div>'
      +'<div style="margin-bottom:12px"><button id="expV6LinkWorkBtn" style="width:100%;height:40px;border:1.5px dashed #dbe6f4;border-radius:10px;background:#f7faff;font-size:13px;font-weight:600;color:#7a92a8;cursor:pointer;font-family:inherit">🔗 업무와 연결하기</button></div>'
      +'<div style="margin-bottom:16px"><label style="font-size:11px;font-weight:700;color:#7a92a8;display:block;margin-bottom:4px">메모</label><input type="text" id="expV6Memo" placeholder="간단한 메모" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"></div>'
      +'<div style="display:flex;gap:8px"><button id="expV6Del" style="flex:1;height:48px;border-radius:12px;border:none;background:#fde8e8;color:#b52929;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;display:none">삭제</button><button id="expV6Save" style="flex:2;height:48px;border-radius:12px;border:none;background:#3f7cb8;color:#fff;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer">저장</button></div>'
      +'</div>';
    document.body.appendChild(div);

    /* 체크박스 스타일 인라인 주입 — sn-edit-body가 overlay 밖이라 CSS 미적용 문제 해결 */
    if (!document.getElementById('v44ChecklistStyle')) {
      var st = document.createElement('style');
      st.id = 'v44ChecklistStyle';
      st.textContent = [
        '#stickyV44EditBody .checklist-row{display:flex;align-items:flex-start;gap:8px;padding:3px 0;min-height:26px}',
        '#stickyV44EditBody .checklist-cb{flex:0 0 20px;width:20px;height:20px;border:1.5px solid #888;border-radius:4px;',
          'background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;',
          'font-size:14px;font-weight:700;color:transparent;flex-shrink:0;user-select:none;margin-top:2px}',
        '#stickyV44EditBody .checklist-row.done .checklist-cb{background:#3f7cb8;border-color:#3f7cb8;color:#fff}',
        '#stickyV44EditBody .checklist-cb::before{content:""}',
        '#stickyV44EditBody .checklist-row.done .checklist-cb::before{content:"✓"}',
        '#stickyV44EditBody .checklist-text{flex:1;outline:none;line-height:1.5;font-size:14px;',
          'word-break:break-word;min-height:20px}',
        '#stickyV44EditBody .checklist-row.done .checklist-text{text-decoration:line-through;color:#999}',
        '#stickyV44EditBody .checklist-done-section{margin-top:6px;padding-top:6px;border-top:1px dashed #dbe6f4}',
        '#stickyV44EditBody .checklist-done-toggle{display:flex;align-items:center;gap:4px;cursor:pointer;',
          'font-size:12px;color:#7a8fa8;padding:4px 2px;user-select:none}',
        '#stickyV44EditBody .checklist-done-list{display:none}',
        '#stickyV44EditBody .checklist-done-section.expanded .checklist-done-list{display:block}',
      ].join('');
      document.head.appendChild(st);
    }

    bindModalEvents();
  }

  function injectLinkModal() {
    if (g(LINK_MODAL_ID)) return;
    var div = document.createElement('div');
    div.id = LINK_MODAL_ID;
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10020;display:none;align-items:flex-end;justify-content:center';
    div.innerHTML = '<div style="background:#fff;width:100%;max-width:540px;max-height:70vh;display:flex;flex-direction:column;border-radius:20px 20px 0 0;box-shadow:0 -4px 24px rgba(0,0,0,.15)">'
      +'<div style="padding:16px 18px 10px;border-bottom:1px solid #f0f4f8;flex-shrink:0"><div style="font-size:15px;font-weight:700;color:#1a2f45;margin-bottom:10px">🔗 연결할 업무 선택</div><input type="text" id="expV6LinkSearch" placeholder="🔍 날짜·제목 검색..." style="width:100%;box-sizing:border-box;height:40px;padding:0 14px;border:1.5px solid #dbe6f4;border-radius:10px;font-size:14px;font-family:inherit;background:#f7faff;outline:none;color:#1a2f45"></div>'
      +'<div id="expV6LinkList" style="overflow:auto;flex:1;padding:8px 0"></div>'
      +'<div style="padding:12px 18px;border-top:1px solid #f0f4f8;flex-shrink:0;display:flex;gap:8px"><button id="expV6LinkClear" style="flex:1;height:40px;border:1.5px solid #fde8e8;border-radius:10px;background:#fff;color:#b52929;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">연결 해제</button><button id="expV6LinkCancel" style="flex:1;height:40px;border:1.5px solid #dbe6f4;border-radius:10px;background:#f7faff;color:#7a92a8;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button></div>'
      +'</div>';
    document.body.appendChild(div);
    g('expV6LinkCancel').addEventListener('click', function() { div.style.display='none'; });
    g('expV6LinkClear').addEventListener('click', function() { _linkedWorkId=null; updateWorkLinkUI(); div.style.display='none'; });
    div.addEventListener('click', function(e) { if(e.target===div) div.style.display='none'; });
    var t;
    g('expV6LinkSearch').addEventListener('input', function(e) { clearTimeout(t); t=setTimeout(function(){renderLinkList(e.target.value);},200); });
  }

  function renderLinkList(q) {
    var box = g('expV6LinkList'); if(!box) return;
    if(typeof entries==='undefined') return;
    var works = entries.filter(function(e) {
      if(e.kind!=='work') return false;
      if(!q) return true;
      var txt=[e.date,e.title,e.field,e.floor].filter(Boolean).join(' ').toLowerCase();
      return txt.indexOf(q.toLowerCase())>=0;
    }).sort(function(a,b){return(b.date||'').localeCompare(a.date||'');}).slice(0,40);
    if(!works.length){box.innerHTML='<div style="padding:30px;text-align:center;color:#aab8c8;font-size:14px">업무가 없습니다</div>';return;}
    box.innerHTML=works.map(function(w){
      var isLinked=_linkedWorkId===w.id;
      return '<div data-wid="'+esc(w.id)+'" style="display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid #f0f6ff;cursor:pointer;background:'+(isLinked?'#e8f0fa':'#fff')+'">'
        +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:#1a2f45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(w.title||'(제목없음)')+'</div>'
        +'<div style="font-size:11px;color:#7a92a8;margin-top:2px">'+esc(w.date||'')+(w.field?' · '+esc(w.field):'')+'</div></div>'
        +(isLinked?'<span style="font-size:11px;font-weight:700;color:#3f7cb8;background:#e8f0fa;padding:3px 8px;border-radius:6px">연결됨</span>':'')
        +'</div>';
    }).join('');
    box.querySelectorAll('[data-wid]').forEach(function(el){
      el.addEventListener('click',function(){_linkedWorkId=el.dataset.wid;updateWorkLinkUI();g(LINK_MODAL_ID).style.display='none';if(typeof toast==='function')toast('업무와 연결됐어요');});
    });
  }

  function updateWorkLinkUI() {
    var area=g('expV6WorkLink'),text=g('expV6WorkLinkText'),btn=g('expV6LinkWorkBtn');
    if(!area) return;
    if(_linkedWorkId&&typeof entries!=='undefined'){
      var w=entries.find(function(e){return e.id===_linkedWorkId;});
      if(w){area.style.display='';if(text)text.textContent=(w.date||'')+' · '+(w.title||'')+(w.field?' ['+w.field+']':'');if(btn){btn.textContent='🔗 연결 업무 변경';btn.style.color='#185FA5';}return;}
    }
    area.style.display='none';
    if(btn){btn.textContent='🔗 업무와 연결하기';btn.style.color='#7a92a8';}
  }

  function openExpV6(id, fromWork) {
    _editId=id||null; _matItems=[]; _selPurpose={}; _purposes=loadPurposes(); _fromWorkData=fromWork||null;
    _linkedWorkId=fromWork?(fromWork.workId||null):null;
    var modal=g(MODAL_ID); if(!modal) return;
    var today=todayStr();
    var en=null;
    if(_editId){en=loadExp().find(function(x){return x.id===_editId;});if(en)_linkedWorkId=en.workId||null;}
    g('expV6Date').value=en?(en.date||today):(fromWork?(fromWork.date||today):today);
    g('expV6Vendor').value=en?(en.vendor||''):(fromWork?(fromWork.vendor||''):'');
    g('expV6Desc').value=en?(en.desc||''):(fromWork?(fromWork.title||''):'');
    g('expV6Amount').value=en?(en.amount||''):'';
    g('expV6DeferVendor').value=en?(en.deferVendor||''):(fromWork?(fromWork.vendor||''):'');
    g('expV6DeferDesc').value=en?(en.deferDesc||''):(fromWork?(fromWork.title||''):'');
    g('expV6DeferAmount').value=en?(en.deferAmount||''):'';
    g('expV6TaxInvoice').value=en?(en.taxInvoice||''):'';
    g('expV6MgmtStatus').value=en?(en.mgmtStatus||'미포함'):'미포함';
    g('expV6BillStatus').value=en?(en.billStatus||'대기'):'대기';
    g('expV6Memo').value=en?(en.memo||''):(fromWork?(fromWork.memo||''):'');
    _expType=en?(en.expType||'없음'):(fromWork?(fromWork.expType||'없음'):'없음');
    _payMethod=en?(en.payMethod||'💳 카드'):'💳 카드';
    if(en&&en.purposes)en.purposes.forEach(function(p){_selPurpose[p]=true;});
    _matItems=en&&en.matItems?JSON.parse(JSON.stringify(en.matItems)):[];
    var defReceipt=en?(en.receipt||'없음'):'없음';
    document.querySelectorAll('.expReceiptBtn').forEach(function(b){var on=b.dataset.receipt===defReceipt;b.style.background=on?'#e8f0fa':'#f7faff';b.style.borderColor=on?'#3f7cb8':'#dbe6f4';b.style.color=on?'#1a4a8a':'#7a92a8';});
    g('expV6Del').style.display=_editId?'':'none';
    g('expV6Title').textContent=_editId?'지출 수정':'지출 등록';
    renderTypeBtns();renderPayBtns();renderPurposeChips();renderMatList();updateAreaVisibility();updateWorkLinkUI();
    modal.style.display='flex';document.body.style.overflow='hidden';
    if(fromWork&&typeof toast==='function')toast('💡 업무 정보가 자동으로 채워졌어요');
  }

  function closeExpV6(){var modal=g(MODAL_ID);if(modal)modal.style.display='none';document.body.style.overflow='';_fromWorkData=null;}

  function renderTypeBtns(){var wrap=g('expV6TypeBtns');if(!wrap)return;wrap.innerHTML='';EXP_TYPES.forEach(function(t){var btn=document.createElement('button');var on=_expType===t;btn.textContent=t;btn.style.cssText='flex:1;height:40px;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;border:1.5px solid '+(on?'#3f7cb8':'#dbe6f4')+';background:'+(on?'#3f7cb8':'#f7faff')+';color:'+(on?'#fff':'#7a92a8');btn.addEventListener('click',function(){_expType=t;renderTypeBtns();updateAreaVisibility();});wrap.appendChild(btn);});}

  function renderPayBtns(){var wrap=g('expV6PayBtns');if(!wrap)return;wrap.innerHTML='';PAY_METHODS.forEach(function(m){var btn=document.createElement('button');var on=_payMethod===m;btn.textContent=m;btn.style.cssText='flex:1;height:40px;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;border:1.5px solid '+(on?'#3f7cb8':'#dbe6f4')+';background:'+(on?'#e8f0fa':'#f7faff')+';color:'+(on?'#1a4a8a':'#7a92a8');btn.addEventListener('click',function(){_payMethod=m;renderPayBtns();});wrap.appendChild(btn);});}

  function renderPurposeChips(){
    var wrap=g('expV6PurposeWrap');if(!wrap)return;wrap.innerHTML='';
    _purposes.forEach(function(p,i){
      var on=!!_selPurpose[p.label];var chip=document.createElement('span');
      chip.style.cssText='display:inline-flex;align-items:center;gap:4px;font-size:13px;padding:5px 11px;border-radius:20px;border:1.5px solid '+(on?'#3f7cb8':'#dbe6f4')+';background:'+(on?'#e8f0fa':'#f7faff')+';color:'+(on?'#1a4a8a':'#7a92a8')+';cursor:pointer;user-select:none;font-family:inherit';
      var icon=document.createElement('span');icon.textContent=p.icon;
      var lbl=document.createElement('span');lbl.textContent=p.label;
      var del=document.createElement('span');del.textContent='✕';del.style.cssText='font-size:10px;width:14px;height:14px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .1s;margin-left:2px';
      chip.addEventListener('mouseenter',function(){del.style.opacity='1';});chip.addEventListener('mouseleave',function(){del.style.opacity='0';});
      del.addEventListener('click',function(e){e.stopPropagation();if(!confirm('"'+p.label+'" 용도를 삭제할까요?'))return;delete _selPurpose[p.label];_purposes.splice(i,1);savePurposes(_purposes);renderPurposeChips();updateMatArea();});
      chip.addEventListener('click',function(){if(_selPurpose[p.label])delete _selPurpose[p.label];else _selPurpose[p.label]=true;renderPurposeChips();updateMatArea();});
      chip.appendChild(icon);chip.appendChild(lbl);chip.appendChild(del);wrap.appendChild(chip);
    });
    var addChip=document.createElement('span');addChip.innerHTML='➕ 추가';addChip.style.cssText='display:inline-flex;align-items:center;gap:3px;font-size:13px;padding:5px 11px;border-radius:20px;border:1.5px dashed #dbe6f4;color:#7a92a8;background:transparent;cursor:pointer;font-family:inherit';
    addChip.addEventListener('click',function(){var row=g('expV6PurposeAddRow');if(row)row.style.display='flex';var inp=g('expV6PurposeInp');if(inp){inp.value='';inp.focus();}addChip.style.display='none';});
    wrap.appendChild(addChip);
  }

  function doAddPurpose(){var val=(g('expV6PurposeInp').value||'').trim();if(!val)return;if(_purposes.find(function(p){return p.label===val;})){if(typeof toast==='function')toast('이미 있는 용도예요');return;}_purposes.push({icon:'📌',label:val});savePurposes(_purposes);_selPurpose[val]=true;var row=g('expV6PurposeAddRow');if(row)row.style.display='none';renderPurposeChips();updateMatArea();}

  function updateMatArea(){var area=g('expV6MatArea');if(area)area.style.display=_selPurpose['자재구매']?'':'none';}

  function renderMatList(){
    var list=g('expV6MatList');if(!list)return;list.innerHTML='';
    _matItems.forEach(function(it,i){
      var row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr 52px 76px 32px;gap:5px;align-items:center;margin-bottom:6px';
      var nameInp=mkMatInp('text',it.name,'품명·규격');
      var qtyInp=mkMatInp('number',it.qty,'0');qtyInp.style.textAlign='center';
      var priceInp=mkMatInp('number',it.price,'0');priceInp.style.textAlign='right';
      nameInp.addEventListener('input',function(e){_matItems[i].name=e.target.value;});
      qtyInp.addEventListener('input',function(e){_matItems[i].qty=parseFloat(e.target.value)||0;calcMatTotal();});
      priceInp.addEventListener('input',function(e){_matItems[i].price=parseFloat(e.target.value)||0;calcMatTotal();});
      var delBtn=document.createElement('button');delBtn.innerHTML='🗑';delBtn.style.cssText='width:32px;height:34px;border:1.5px solid #dbe6f4;border-radius:8px;background:#f7faff;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center';
      (function(idx){delBtn.addEventListener('click',function(){_matItems.splice(idx,1);renderMatList();calcMatTotal();});})(i);
      row.appendChild(nameInp);row.appendChild(qtyInp);row.appendChild(priceInp);row.appendChild(delBtn);list.appendChild(row);
    });
    calcMatTotal();
  }

  function mkMatInp(type,val,ph){var inp=document.createElement('input');inp.type=type;inp.value=val||'';inp.placeholder=ph;inp.style.cssText='width:100%;box-sizing:border-box;height:34px;padding:0 8px;border:1.5px solid #dbe6f4;border-radius:8px;font-size:13px;font-family:inherit;background:#fff;outline:none;color:#1a2f45';inp.addEventListener('focus',function(){inp.style.borderColor='#3f7cb8';});inp.addEventListener('blur',function(){inp.style.borderColor='#dbe6f4';});return inp;}

  function calcMatTotal(){var total=_matItems.reduce(function(s,it){return s+((it.qty||0)*(it.price||0));},0);var el=g('expV6MatTotal');if(el)el.textContent=fmt(total);if(total>0){var a=g('expV6Amount');if(a&&!a._manual)a.value=total;}}

  function updateAreaVisibility(){var isP=_expType==='💸 개인비용',isD=_expType==='📃 후불청구';g('expV6PersonalArea').style.display=isP?'':'none';g('expV6DeferArea').style.display=isD?'':'none';var sheet=g('expV6Sheet');if(sheet)sheet.style.borderTop=isP?'3px solid #378ADD':isD?'3px solid #D85A30':'3px solid #dbe6f4';if(isP)updateMatArea();}

  function saveExpV6(){
    var isP=_expType==='💸 개인비용',isD=_expType==='📃 후불청구';
    var receipt='없음';document.querySelectorAll('.expReceiptBtn').forEach(function(b){if(b.style.borderColor==='rgb(63, 124, 184)')receipt=b.dataset.receipt;});
    var data={id:_editId||genId(),date:g('expV6Date').value||'',expType:_expType,memo:g('expV6Memo').value.trim(),workId:_linkedWorkId||null,updatedAt:Date.now()};
    if(isP){Object.assign(data,{payMethod:_payMethod,vendor:g('expV6Vendor').value.trim(),desc:g('expV6Desc').value.trim(),purposes:Object.keys(_selPurpose).filter(function(k){return _selPurpose[k];}),amount:parseFloat(g('expV6Amount').value)||0,receipt:receipt,matItems:_matItems.slice(),billStatus:g('expV6BillStatus').value});if(!data.vendor&&!data.desc&&!data.amount){if(typeof toast==='function')toast('업체명이나 내역을 입력해주세요');return;}}
    if(isD){Object.assign(data,{deferVendor:g('expV6DeferVendor').value.trim(),deferDesc:g('expV6DeferDesc').value.trim(),deferAmount:parseFloat(g('expV6DeferAmount').value)||0,taxInvoice:g('expV6TaxInvoice').value,mgmtStatus:g('expV6MgmtStatus').value});if(!data.deferVendor&&!data.deferDesc&&!data.deferAmount){if(typeof toast==='function')toast('업체명이나 청구내역을 입력해주세요');return;}}
    if(_expType==='없음'&&!g('expV6Memo').value.trim()){if(typeof toast==='function')toast('내용을 입력해주세요');return;}
    var exps=loadExp();
    if(_editId){var idx=exps.findIndex(function(x){return x.id===_editId;});if(idx>=0){data.createdAt=exps[idx].createdAt;exps[idx]=data;}else exps.push(data);}else{data.createdAt=Date.now();exps.push(data);}
    saveExp(exps);closeExpV6();if(typeof toast==='function')toast('저장됐어요');renderExpV6Tab();if(typeof v43Refresh==='function')setTimeout(v43Refresh,200);
  }

  function deleteExpV6(){if(!_editId||!confirm('이 지출 항목을 삭제할까요?'))return;saveExp(loadExp().filter(function(x){return x.id!==_editId;}));closeExpV6();if(typeof toast==='function')toast('삭제됐어요');renderExpV6Tab();if(typeof v43Refresh==='function')setTimeout(v43Refresh,200);}

  function bindModalEvents(){
    g('expV6Close').addEventListener('click',closeExpV6);
    g('expV6Save').addEventListener('click',saveExpV6);
    g('expV6Del').addEventListener('click',deleteExpV6);
    g('expV6MatAdd').addEventListener('click',function(){_matItems.push({name:'',qty:'',price:''});renderMatList();var rows=g('expV6MatList').querySelectorAll('input[type=text]');if(rows.length)rows[rows.length-1].focus();});
    g('expV6PurposeConfirm').addEventListener('click',doAddPurpose);
    g('expV6PurposeCancel').addEventListener('click',function(){var row=g('expV6PurposeAddRow');if(row)row.style.display='none';renderPurposeChips();});
    g('expV6PurposeInp').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();doAddPurpose();}});
    document.querySelectorAll('.expReceiptBtn').forEach(function(btn){btn.addEventListener('click',function(){document.querySelectorAll('.expReceiptBtn').forEach(function(b){b.style.background='#f7faff';b.style.borderColor='#dbe6f4';b.style.color='#7a92a8';});btn.style.background='#e8f0fa';btn.style.borderColor='#3f7cb8';btn.style.color='#1a4a8a';});});
    var amtEl=g('expV6Amount');if(amtEl)amtEl.addEventListener('input',function(){amtEl._manual=true;});
    g('expV6LinkWorkBtn').addEventListener('click',openLinkModal);
    g(MODAL_ID).addEventListener('click',function(e){if(e.target===g(MODAL_ID))closeExpV6();});
  }

  function openLinkModal(){var modal=g(LINK_MODAL_ID);if(!modal)return;var inp=g('expV6LinkSearch');if(inp)inp.value='';renderLinkList('');modal.style.display='flex';}

  function hookOpenExpenseFromWork(){
    if(window._expV6WorkHooked)return;
    window.openExpenseFromWork=function(info){
      var w=info.workObj||{};
      var expType=info.expType||'개인비용';
      openExpV6(null,{date:w.date||'',vendor:w.workVendor||'',title:w.title||'',memo:(w.floor||'')+(w.field?' ['+w.field+']':''),expType:expType==='개인비용'?'💸 개인비용':'📃 후불청구',workId:info.workId||null});
    };
    window._expV6WorkHooked=true;
  }

  function renderExpV6Tab(){
    var exps=loadExp().sort(function(a,b){return(b.date||'').localeCompare(a.date||'')||(b.createdAt||0)-(a.createdAt||0);});
    var now=new Date(),ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    var personalThis=exps.filter(function(e){return e.expType==='💸 개인비용'&&(e.date||'').startsWith(ym);});
    var personalTotal=personalThis.reduce(function(s,e){return s+(e.amount||0);},0);
    var personalPending=exps.filter(function(e){return e.expType==='💸 개인비용'&&e.billStatus==='대기';}).length;
    var deferPending=exps.filter(function(e){return e.expType==='📃 후불청구'&&e.mgmtStatus==='미포함';});
    var deferTotal=deferPending.reduce(function(s,e){return s+(e.deferAmount||0);},0);
    var dash=g('expV6Dashboard');
    if(dash)dash.innerHTML='<div style="background:#fff;border:1.5px solid #e8f0fa;border-left:3px solid #378ADD;border-radius:12px;padding:12px 14px"><div style="font-size:11px;color:#7a92a8;margin-bottom:3px">이달 개인비용</div><div style="font-size:20px;font-weight:800;color:#185FA5">'+fmt(personalTotal)+'</div><div style="font-size:11px;color:#7a92a8;margin-top:3px">품의서 대기 <span style="color:#e74c3c;font-weight:700">'+personalPending+'건</span></div></div>'
      +'<div style="background:#fff;border:1.5px solid #e8f0fa;border-left:3px solid #D85A30;border-radius:12px;padding:12px 14px"><div style="font-size:11px;color:#7a92a8;margin-bottom:3px">미처리 후불청구</div><div style="font-size:20px;font-weight:800;color:#712B13">'+fmt(deferTotal)+'</div><div style="font-size:11px;color:#7a92a8;margin-top:3px">관리비 미포함 <span style="color:#e74c3c;font-weight:700">'+deferPending.length+'건</span></div></div>';
    var warn=g('expV6WarnBar');
    if(warn){if(deferPending.length>0){warn.style.display='';warn.textContent='⚠️ 후불청구 '+deferPending.length+'건이 아직 관리비에 포함되지 않았어요';}else{warn.style.display='none';}}
    var fw=g('expV6Filters');
    if(fw){var filters=[{key:'all',label:'전체'},{key:'personal',label:'💸 개인비용'},{key:'defer',label:'📃 후불청구'},{key:'pending',label:'🔴 미처리만'}];fw.innerHTML='';filters.forEach(function(f){var btn=document.createElement('button');var on=_expFilter===f.key;btn.textContent=f.label;btn.style.cssText='font-size:12px;padding:5px 12px;border-radius:20px;border:1.5px solid '+(on?'#3f7cb8':'#dbe6f4')+';background:'+(on?'#3f7cb8':'#fff')+';color:'+(on?'#fff':'#7a92a8')+';cursor:pointer;font-family:inherit;font-weight:600';btn.addEventListener('click',function(){_expFilter=f.key;renderExpV6Tab();});fw.appendChild(btn);});}
    var list=exps;
    if(_expFilter==='personal')list=exps.filter(function(e){return e.expType==='💸 개인비용';});
    if(_expFilter==='defer')list=exps.filter(function(e){return e.expType==='📃 후불청구';});
    if(_expFilter==='pending')list=exps.filter(function(e){return(e.expType==='💸 개인비용'&&e.billStatus==='대기')||(e.expType==='📃 후불청구'&&e.mgmtStatus==='미포함');});
    var listEl=g('expV6List');if(!listEl)return;
    if(!list.length){listEl.innerHTML='<div style="text-align:center;padding:48px 20px;color:#aab8c8"><div style="font-size:36px;margin-bottom:10px">💰</div><div style="font-size:14px">등록된 지출이 없어요</div></div>';return;}
    listEl.innerHTML='<div style="background:#fff;border:1.5px solid #e8f0fa;border-radius:14px;overflow:hidden">'+list.map(renderExpItem).join('')+'</div>';
    listEl.querySelectorAll('[data-expid]').forEach(function(el){el.addEventListener('click',function(){openExpV6(el.dataset.expid);});});
  }

  function renderExpItem(e){
    var isP=e.expType==='💸 개인비용',isD=e.expType==='📃 후불청구';
    var borderL=isP?'#378ADD':isD?'#D85A30':'#dbe6f4';
    var typeBg=isP?'#E6F1FB':isD?'#FAECE7':'#f0f4f8',typeC=isP?'#185FA5':isD?'#712B13':'#7a92a8';
    var title=isP?(e.desc||e.vendor||'(내역없음)'):isD?(e.deferDesc||e.deferVendor||'(내역없음)'):(e.memo||'(메모없음)');
    var vendor=isP?e.vendor:isD?e.deferVendor:'';
    var amount=isP?e.amount:isD?e.deferAmount:0;
    var statusBadge='';
    if(isP&&e.billStatus){var mp={'대기':'#faeeda|#633806|#EF9F27','제출':'#E6F1FB|#0C447C|#378ADD','완료':'#EAF3DE|#27500A|#639922'},sc=mp[e.billStatus];if(sc){var p=sc.split('|');statusBadge='<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:'+p[0]+';color:'+p[1]+'"><span style="width:5px;height:5px;border-radius:50%;background:'+p[2]+';display:inline-block"></span>품의서 '+esc(e.billStatus)+'</span>';}}
    if(isD&&e.mgmtStatus){var mp2={'미포함':'#FCEBEB|#791F1F|#E24B4A','포함':'#E6F1FB|#0C447C|#378ADD','수금완료':'#EAF3DE|#27500A|#639922'},sc2=mp2[e.mgmtStatus];if(sc2){var p2=sc2.split('|');statusBadge='<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:'+p2[0]+';color:'+p2[1]+'"><span style="width:5px;height:5px;border-radius:50%;background:'+p2[2]+';display:inline-block"></span>'+esc(e.mgmtStatus)+'</span>';}}
    var workLink='';
    if(e.workId&&typeof entries!=='undefined'){var w=entries.find(function(x){return x.id===e.workId;});if(w)workLink='<span style="font-size:10px;color:#3f7cb8;background:#e8f0fa;padding:2px 6px;border-radius:5px;margin-left:4px">🔗'+esc((w.title||'').slice(0,12))+'</span>';}
    return '<div data-expid="'+esc(e.id)+'" style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid #f0f6ff;cursor:pointer;border-left:3px solid '+borderL+'" onmouseenter="this.style.background=\'#f7faff\'" onmouseleave="this.style.background=\'\'">'
      +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#1a2f45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(title)+workLink+'</div>'
      +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px"><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:'+typeBg+';color:'+typeC+'">'+esc(e.expType||'없음')+'</span>'+statusBadge+(vendor?'<span style="font-size:11px;color:#7a92a8">'+esc(vendor)+'</span>':'')+(e.payMethod?'<span style="font-size:10px;color:#aab8c8">'+esc(e.payMethod)+'</span>':'')+'</div></div>'
      +'<div style="text-align:right;flex-shrink:0"><div style="font-size:14px;font-weight:800;color:'+(isP?'#185FA5':isD?'#712B13':'#1a2f45')+'">'+(amount>0?fmt(amount):'')+'</div><div style="font-size:11px;color:#aab8c8;margin-top:2px">'+esc(e.date||'')+'</div></div></div>';
  }

  function buildExpTabPanel(){
    var tabBar=document.getElementById('v43Tabs');
    if(tabBar&&!document.querySelector('.v43-tab[data-v43tab="expv6"]')){
      var tab=document.createElement('button');tab.className='v43-tab';tab.dataset.v43tab='expv6';tab.textContent='💰 지출';tabBar.appendChild(tab);
      tab.addEventListener('click',function(){if(typeof v43ActivateTab==='function')v43ActivateTab('expv6');renderExpV6Tab();});
    }
    var main=document.querySelector('main.wrap');
    if(main&&!g('v43-expv6')){
      var panel=document.createElement('div');panel.className='v43-panel';panel.id='v43-expv6';
      panel.innerHTML='<div style="margin-top:14px"><div id="expV6Dashboard" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"></div><div id="expV6WarnBar" style="display:none;background:#fff3cd;border:1.5px solid #ffd54f;border-radius:10px;padding:9px 13px;margin-bottom:10px;font-size:13px;font-weight:700;color:#7c5e1a"></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px" id="expV6Filters"></div><div id="expV6List"></div><button id="expV6AddBtn" style="width:100%;height:48px;margin-top:12px;background:#3f7cb8;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer">➕ 지출 등록</button></div>';
      main.appendChild(panel);
      g('expV6AddBtn').addEventListener('click',function(){openExpV6(null);});
    }
  }

  function hookActivateTab(){
    if(window._expV6TabHooked)return;
    var orig=window.v43ActivateTab;if(!orig)return;
    window.v43ActivateTab=function(name){orig(name);if(name==='expv6'){var panel=g('v43-expv6');if(panel){document.querySelectorAll('.v43-panel').forEach(function(p){p.classList.remove('active');});panel.classList.add('active');}renderExpV6Tab();}};
    window._expV6TabHooked=true;
  }

  function addExpToFab(){
    var catOverlay=g('v43CatOverlay'),catGrid=catOverlay&&catOverlay.querySelector('.v43-cat-grid');
    if(catGrid&&!catGrid.querySelector('[data-add="expv6"]')){
      var btn=document.createElement('button');btn.className='v43-cat-btn';btn.dataset.add='expv6';btn.innerHTML='<span class="ci">💰</span><span class="cl">지출</span>';
      btn.addEventListener('click',function(){catOverlay.classList.remove('show');setTimeout(function(){openExpV6(null);},200);});
      catGrid.appendChild(btn);
    }
  }

  function init(){
    injectModal();injectLinkModal();buildExpTabPanel();hookActivateTab();hookOpenExpenseFromWork();addExpToFab();
    window.openExpV6Modal=openExpV6;window.renderExpV6Tab=renderExpV6Tab;
  }

  setTimeout(init,600);setTimeout(init,2000);
  console.log('[worklog_patch_v44] PART2 지출 패치 로드');
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
