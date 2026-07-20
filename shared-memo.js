/* =========================================================================
   공유 급한 메모 (shared-memo.js)  v20260720
   - 나의 시스템(index.html) · 업무일지(worklog.html) · 개인일지(personal.html)
     세 앱이 이 파일 하나를 <script src>로 똑같이 불러온다 → 어디서나 동일 동작.
   - 저장: Firebase 'dash_memo' 컬렉션 (실시간 공유). 실패 시 localStorage 폴백.
   - 폼은 업무일지 메모폼 기준: 본문 글 + 사진 인라인(붙여넣기·첨부) 가능.
   - 목록은 카드, 클릭하면 상세 팝업. 삭제는 상세 팝업 안에서만. 복사 버튼 포함.
   사용: 화면 우하단 ⚡ 버튼 또는  window.SharedMemo.open()
   ========================================================================= */
(function(){
  if(window.__SHARED_MEMO__){ return; }
  window.__SHARED_MEMO__ = true;

  var COL = 'dash_memo';
  var FB = {
    apiKey:"AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY",
    authDomain:"my-system-25497.firebaseapp.com",
    projectId:"my-system-25497",
    storageBucket:"my-system-25497.firebasestorage.app"
  };
  var LSK = 'shared_dash_memo_cache';

  var db = null;
  try{
    if(window.firebase && firebase.firestore){
      if(!firebase.apps || !firebase.apps.length){ firebase.initializeApp(FB); }
      db = firebase.firestore();
    }
  }catch(e){ console.warn('[급한메모] Firebase 초기화 실패 — 로컬 저장으로 동작', e); }

  var memos = [];
  var editingId = null;   /* 작성/수정 중인 메모 id (신규면 임시 id) */
  var detailId = null;    /* 상세 팝업에 열려있는 메모 id */

  /* ---------- 유틸 ---------- */
  function uid(){ return 'm_'+Date.now()+'_'+Math.floor(Math.random()*99999); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function elFrom(html){ var d=document.createElement('div'); d.innerHTML=html||''; return d; }
  function plain(m){
    if(m && typeof m.text==='string' && m.text.trim() && !(m.html)) return m.text.trim();
    var d=elFrom(m ? (m.html||m.text||'') : ''); return (d.innerText||d.textContent||'').trim();
  }
  function firstImg(m){ var d=elFrom(m ? (m.html||'') : ''); var im=d.querySelector('img'); return im?im.getAttribute('src'):''; }
  function fmtTs(ts){
    if(!ts) return '';
    var d=new Date(ts), n=new Date();
    var same = d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
    var hh=('0'+d.getHours()).slice(-2), mm=('0'+d.getMinutes()).slice(-2);
    if(same) return hh+':'+mm;
    return (d.getMonth()+1)+'/'+d.getDate()+' '+hh+':'+mm;
  }
  function toast(msg){
    try{
      if(typeof window.toast==='function' && window.toast!==arguments.callee){ window.toast(msg); return; }
    }catch(e){}
    var t=document.getElementById('sm-toast');
    if(!t){ t=document.createElement('div'); t.id='sm-toast'; document.body.appendChild(t); }
    t.textContent=msg; t.className='sm-show';
    clearTimeout(t._t); t._t=setTimeout(function(){ t.className=''; }, 1900);
  }

  /* 이미지 압축 (자체 포함 — 앱마다 함수명이 달라서 의존 안 함) */
  function compress(file, max, q){
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onload=function(e){
        var img=new Image();
        img.onload=function(){
          var w=img.width, h=img.height, s=Math.min(1, max/Math.max(w,h));
          var cv=document.createElement('canvas'); cv.width=Math.round(w*s); cv.height=Math.round(h*s);
          cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
          res(cv.toDataURL('image/jpeg', q||0.7));
        };
        img.onerror=rej; img.src=e.target.result;
      };
      r.onerror=rej; r.readAsDataURL(file);
    });
  }

  /* ---------- 저장/구독 ---------- */
  function saveLocal(){ try{ localStorage.setItem(LSK, JSON.stringify(memos)); }catch(e){} }
  function loadLocal(){ try{ memos=JSON.parse(localStorage.getItem(LSK)||'[]'); }catch(e){ memos=[]; } }
  function sortMemos(){ memos.sort(function(a,b){ return (b.ts||0)-(a.ts||0); }); }

  function subscribe(){
    if(db){
      db.collection(COL).onSnapshot(function(snap){
        memos=[]; snap.forEach(function(d){ memos.push(Object.assign({id:d.id}, d.data())); });
        sortMemos(); saveLocal(); renderList(); updateCount(); refreshDetail();
      }, function(e){ console.warn('[급한메모] 실시간 구독 오류', e); loadLocal(); sortMemos(); renderList(); updateCount(); });
    } else {
      loadLocal(); sortMemos(); renderList(); updateCount();
    }
  }
  function put(id, rec){
    if(db){ db.collection(COL).doc(id).set(rec, {merge:true}).catch(function(e){ console.warn(e); toast('저장 오류: '+(e.message||e)); }); }
    else {
      var i=-1; memos.forEach(function(x,j){ if(x.id===id) i=j; });
      if(i>=0) memos[i]=Object.assign(memos[i], rec); else memos.unshift(Object.assign({id:id}, rec));
      sortMemos(); saveLocal(); renderList(); updateCount();
    }
  }
  function removeMemo(id){
    if(db){ db.collection(COL).doc(id).delete().catch(function(e){ console.warn(e); toast('삭제 오류'); }); }
    else { memos=memos.filter(function(x){ return x.id!==id; }); saveLocal(); renderList(); updateCount(); }
  }
  function getMemo(id){ for(var i=0;i<memos.length;i++){ if(memos[i].id===id) return memos[i]; } return null; }

  /* ---------- DOM 만들기 ---------- */
  function buildDOM(){
    var style=document.createElement('style');
    style.textContent = [
      '#sm-fab{position:fixed;left:16px;bottom:18px;z-index:99000;width:54px;height:54px;border-radius:50%;border:none;background:linear-gradient(135deg,#f5b301,#f39c12);color:#fff;font-size:24px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center}',
      '#sm-fab:active{transform:scale(.94)}',
      '#sm-fab .sm-fab-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#e74c3c;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff}',
      '.sm-ov{position:fixed;inset:0;z-index:99010;background:rgba(20,30,45,.42);display:none;align-items:flex-end;justify-content:center}',
      '.sm-ov.show{display:flex}',
      '@media(min-width:640px){.sm-ov{align-items:center}}',
      '#sm-panel{background:#fff;width:100%;max-width:640px;max-height:86vh;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -8px 30px rgba(0,0,0,.2)}',
      '@media(min-width:640px){#sm-panel{border-radius:18px}}',
      '.sm-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1.5px solid #eef1f4;background:#fffdf5}',
      '.sm-head b{font-size:16px;color:#1a2f45}',
      '.sm-head .sm-cnt{font-size:12px;font-weight:700;color:#f39c12;margin-left:6px}',
      '.sm-x{background:none;border:none;font-size:20px;cursor:pointer;color:#888;line-height:1}',
      '.sm-newbtn{margin:12px 16px 4px;height:44px;border:none;border-radius:12px;background:linear-gradient(135deg,#f5b301,#f39c12);color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit}',
      '.sm-list{flex:1;overflow-y:auto;padding:8px 16px 16px;display:grid;grid-template-columns:1fr;gap:8px}',
      '@media(min-width:560px){.sm-list{grid-template-columns:1fr 1fr}}',
      '.sm-card{border:1.5px solid #e8ecf1;border-left:4px solid #f39c12;border-radius:12px;padding:10px 12px;cursor:pointer;background:#fff;transition:box-shadow .12s,border-color .12s;display:flex;gap:10px;align-items:flex-start;min-width:0}',
      '.sm-card:hover{box-shadow:0 3px 12px rgba(0,0,0,.09);border-left-color:#e67e22}',
      '.sm-card .sm-thumb{width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;border:1px solid #eee}',
      '.sm-card .sm-cbody{flex:1;min-width:0}',
      '.sm-card .sm-ctext{font-size:14px;color:#243447;line-height:1.45;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
      '.sm-card .sm-ctext.empty{color:#aab4c0;font-weight:500}',
      '.sm-card .sm-ctime{font-size:11px;color:#9aa7b4;margin-top:4px}',
      '.sm-empty{grid-column:1/-1;text-align:center;color:#aab4c0;font-size:14px;padding:36px 10px}',
      '.sm-foot{font-size:11px;color:#9aa7b4;text-align:center;padding:8px 10px;border-top:1px solid #f0f2f5}',
      /* 상세 / 편집 */
      '.sm-detail{background:#fff;width:100%;max-width:640px;max-height:88vh;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden}',
      '@media(min-width:640px){.sm-detail{border-radius:18px}}',
      '.sm-dtop{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1.5px solid #eef1f4;background:#fffdf5}',
      '.sm-dtop b{font-size:16px;color:#1a2f45}',
      '.sm-dbody{flex:1;overflow-y:auto;padding:16px}',
      '.sm-dtext{font-size:15px;line-height:1.65;color:#222;white-space:pre-wrap;word-break:break-word}',
      '.sm-dtext img{max-width:100%;border-radius:10px;margin:6px 0;display:block}',
      '.sm-dtime{font-size:12px;color:#9aa7b4;margin-top:12px}',
      '.sm-dbtns{display:flex;gap:8px;padding:12px 16px;border-top:1.5px solid #eef1f4;flex-wrap:wrap}',
      '.sm-btn{flex:1;min-width:92px;height:44px;border-radius:12px;border:1.5px solid #dfe4ea;background:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;color:#33475b}',
      '.sm-btn.sm-copy{border-color:#bcdff5;color:#2578b5;background:#f2f9ff}',
      '.sm-btn.sm-del{border-color:#f6c9c4;color:#c0392b;background:#fff5f4}',
      '.sm-btn.sm-primary{border:none;background:linear-gradient(135deg,#f5b301,#f39c12);color:#fff}',
      /* 편집기 */
      '.sm-editwrap{flex:1;overflow-y:auto;padding:16px}',
      '#sm-editor{min-height:180px;border:1.5px solid #dfe4ea;border-radius:12px;padding:12px 14px;font-size:15px;line-height:1.6;outline:none;background:#fafbfc;color:#222;word-break:break-word}',
      '#sm-editor:focus{border-color:#f39c12;background:#fff}',
      '#sm-editor:empty:before{content:attr(data-ph);color:#aab4c0}',
      '#sm-editor img{max-width:100%;border-radius:10px;margin:6px 0}',
      '.sm-inline-img-wrap{position:relative;display:inline-block;max-width:100%}',
      '.sm-inline-img-wrap .sm-img-rm{position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:15px;cursor:pointer;line-height:1}',
      '.sm-edittools{display:flex;gap:8px;align-items:center;margin-top:10px}',
      '.sm-photo-btn{display:inline-flex;align-items:center;gap:5px;height:38px;padding:0 14px;border:1.5px dashed #dfe4ea;border-radius:10px;font-size:13px;font-weight:700;color:#5a6b7b;cursor:pointer;background:#fff}',
      '.sm-editstatus{font-size:12px;color:#9aa7b4;margin-left:auto}',
      '#sm-zoom{position:fixed;inset:0;z-index:99030;background:rgba(0,0,0,.86);display:none;align-items:center;justify-content:center}',
      '#sm-zoom.show{display:flex}',
      '#sm-zoom img{max-width:94%;max-height:94%;border-radius:10px}',
      '#sm-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(20px);z-index:99040;background:#243447;color:#fff;padding:10px 18px;border-radius:22px;font-size:13px;font-weight:700;opacity:0;pointer-events:none;transition:all .2s;max-width:90%}',
      '#sm-toast.sm-show{opacity:1;transform:translateX(-50%) translateY(0)}'
    ].join('\n');
    document.head.appendChild(style);

    var wrap=document.createElement('div');
    wrap.innerHTML = [
      '<button id="sm-fab" title="공유메모 (Ctrl+Shift+M)">⚡<span class="sm-fab-badge" id="sm-badge" style="display:none">0</span></button>',
      '<div class="sm-ov" id="sm-panelOv">',
      '  <div id="sm-panel">',
      '    <div class="sm-head"><b>⚡ 공유메모<span class="sm-cnt" id="sm-headcnt"></span></b><button class="sm-x" id="sm-panelClose">✕</button></div>',
      '    <button class="sm-newbtn" id="sm-new">✏️ 새 메모</button>',
      '    <div class="sm-list" id="sm-list"></div>',
      '    <div class="sm-foot">어느 앱(나의 시스템·업무일지·개인일지)에서든 같은 메모가 실시간으로 보여요</div>',
      '  </div>',
      '</div>',
      '<div class="sm-ov" id="sm-detailOv">',
      '  <div class="sm-detail">',
      '    <div class="sm-dtop"><b>📌 공유메모</b><button class="sm-x" id="sm-detailClose">✕</button></div>',
      '    <div class="sm-dbody"><div class="sm-dtext" id="sm-detailText"></div><div class="sm-dtime" id="sm-detailTime"></div></div>',
      '    <div class="sm-dbtns">',
      '      <button class="sm-btn sm-copy" id="sm-copy">📋 복사</button>',
      '      <button class="sm-btn" id="sm-edit">✏️ 수정</button>',
      '      <button class="sm-btn sm-del" id="sm-del">🗑 삭제</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '<div class="sm-ov" id="sm-editOv">',
      '  <div class="sm-detail">',
      '    <div class="sm-dtop"><b id="sm-editTitle">✏️ 새 메모</b><button class="sm-x" id="sm-editClose">✕</button></div>',
      '    <div class="sm-editwrap">',
      '      <div id="sm-editor" contenteditable="true" data-ph="여기에 급하게 적어두세요… 사진은 붙여넣기(Ctrl+V) 또는 아래 버튼"></div>',
      '      <div class="sm-edittools">',
      '        <label class="sm-photo-btn">📷 사진<input type="file" id="sm-photo" accept="image/*" multiple style="display:none"></label>',
      '        <span class="sm-editstatus" id="sm-editStatus"></span>',
      '      </div>',
      '    </div>',
      '    <div class="sm-dbtns">',
      '      <button class="sm-btn sm-primary" id="sm-save">💾 저장</button>',
      '      <button class="sm-btn" id="sm-editCancel">취소</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '<div id="sm-zoom"><img id="sm-zoomImg" src=""></div>'
    ].join('');
    document.body.appendChild(wrap);
  }

  function $(id){ return document.getElementById(id); }

  /* ---------- 렌더 ---------- */
  function renderList(){
    var host=$('sm-list'); if(!host) return;
    if(!memos.length){ host.innerHTML='<div class="sm-empty">아직 메모가 없어요.<br>“✏️ 새 메모”로 급하게 적어두세요.</div>'; return; }
    host.innerHTML = memos.map(function(m){
      var txt=plain(m); var img=firstImg(m);
      var body = txt ? esc(txt) : (img ? '(사진 메모)' : '(빈 메모)');
      return '<div class="sm-card" data-id="'+esc(m.id)+'">'
        + (img ? '<img class="sm-thumb" src="'+esc(img)+'">' : '')
        + '<div class="sm-cbody"><div class="sm-ctext'+(txt?'':' empty')+'">'+body+'</div>'
        + '<div class="sm-ctime">'+fmtTs(m.ts)+'</div></div></div>';
    }).join('');
    Array.prototype.forEach.call(host.querySelectorAll('.sm-card'), function(c){
      c.addEventListener('click', function(){ openDetail(c.getAttribute('data-id')); });
    });
  }
  function updateCount(){
    var n=memos.length;
    var b=$('sm-badge'); if(b){ b.textContent=n; b.style.display=n?'flex':'none'; }
    var hc=$('sm-headcnt'); if(hc){ hc.textContent = n?(' '+n+'개'):''; }
  }

  /* ---------- 상세 ---------- */
  function openDetail(id){
    var m=getMemo(id); if(!m) return;
    detailId=id;
    $('sm-detailText').innerHTML = m.html ? m.html : esc(m.text||'');
    $('sm-detailTime').textContent = m.ts ? ('🕒 '+new Date(m.ts).toLocaleString('ko-KR')) : '';
    bindDetailImgs();
    $('sm-detailOv').classList.add('show');
  }
  function refreshDetail(){ if(detailId && $('sm-detailOv').classList.contains('show')){ var m=getMemo(detailId); if(!m){ closeDetail(); } else { $('sm-detailText').innerHTML=m.html?m.html:esc(m.text||''); bindDetailImgs(); } } }
  function bindDetailImgs(){
    Array.prototype.forEach.call($('sm-detailText').querySelectorAll('img'), function(im){
      im.style.cursor='zoom-in';
      im.onclick=function(){ $('sm-zoomImg').src=im.src; $('sm-zoom').classList.add('show'); };
    });
  }
  function closeDetail(){ $('sm-detailOv').classList.remove('show'); detailId=null; }

  /* ---------- 편집기 (업무일지 폼 기준) ---------- */
  var saveTimer=null;
  function openEditor(id){
    editingId = id || uid();
    var m = id ? getMemo(id) : null;
    $('sm-editTitle').textContent = m ? '✏️ 메모 수정' : '✏️ 새 메모';
    var ed=$('sm-editor');
    ed.innerHTML = m ? (m.html || esc(m.text||'')) : '';
    $('sm-editStatus').textContent='';
    bindEditorImgs();
    $('sm-editOv').classList.add('show');
    setTimeout(function(){ ed.focus(); placeCaretEnd(ed); }, 180);
  }
  function closeEditor(){ $('sm-editOv').classList.remove('show'); editingId=null; }
  function placeCaretEnd(el){
    try{ var r=document.createRange(); r.selectNodeContents(el); r.collapse(false); var s=window.getSelection(); s.removeAllRanges(); s.addRange(r); }catch(e){}
  }
  function insertImageAtCursor(dataUrl){
    var html='<div class="sm-inline-img-wrap" contenteditable="false"><img src="'+dataUrl+'"><button type="button" class="sm-img-rm" title="이 사진 삭제">×</button></div><br>';
    var ed=$('sm-editor');
    var sel=window.getSelection();
    if(sel && sel.rangeCount){
      var range=sel.getRangeAt(0);
      if(ed.contains(range.startContainer)){
        range.deleteContents();
        var tmp=document.createElement('div'); tmp.innerHTML=html;
        var frag=document.createDocumentFragment(); while(tmp.firstChild) frag.appendChild(tmp.firstChild);
        range.insertNode(frag); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
        bindEditorImgs(); return;
      }
    }
    ed.insertAdjacentHTML('beforeend', html); bindEditorImgs();
  }
  function bindEditorImgs(){
    var ed=$('sm-editor');
    Array.prototype.forEach.call(ed.querySelectorAll('.sm-img-rm'), function(btn){
      btn.onclick=function(e){ e.preventDefault(); var w=btn.closest('.sm-inline-img-wrap'); if(w){ w.remove(); } };
    });
    Array.prototype.forEach.call(ed.querySelectorAll('.sm-inline-img-wrap img'), function(im){
      im.onclick=function(){ $('sm-zoomImg').src=im.src; $('sm-zoom').classList.add('show'); };
    });
  }
  function saveEditor(){
    var ed=$('sm-editor');
    var html=ed.innerHTML.trim();
    var text=(ed.innerText||ed.textContent||'').trim();
    var hasImg=!!ed.querySelector('img');
    if(!text && !hasImg){ toast('내용을 입력하세요'); return; }
    var rec={ html:html, text:text, ts:(getMemo(editingId)? (getMemo(editingId).ts||Date.now()) : Date.now()), updatedAt:Date.now() };
    /* 신규는 항상 새 ts로 위에 오게 */
    if(!getMemo(editingId)) rec.ts=Date.now();
    put(editingId, rec);
    closeEditor();
    toast('저장됐어요');
  }

  /* ---------- 사진 처리 ---------- */
  function handlePhotoFiles(files){
    var arr=Array.prototype.slice.call(files||[]);
    (function next(i){
      if(i>=arr.length){ return; }
      var f=arr[i];
      if(!f.type || f.type.indexOf('image/')!==0){ next(i+1); return; }
      compress(f,1400,0.75).then(function(url){ insertImageAtCursor(url); $('sm-editStatus').textContent='📷 사진 추가됨'; next(i+1); })
        .catch(function(){ next(i+1); });
    })(0);
  }

  /* ---------- 공개 API ---------- */
  function open(){ $('sm-panelOv').classList.add('show'); renderList(); }
  function close(){ $('sm-panelOv').classList.remove('show'); }
  window.SharedMemo = { open:open, close:close, newMemo:function(){ open(); openEditor(null); } };

  /* ---------- 이벤트 ---------- */
  function wire(){
    $('sm-fab').addEventListener('click', open);
    $('sm-panelClose').addEventListener('click', close);
    $('sm-panelOv').addEventListener('click', function(e){ if(e.target===$('sm-panelOv')) close(); });
    $('sm-new').addEventListener('click', function(){ openEditor(null); });

    $('sm-detailClose').addEventListener('click', closeDetail);
    $('sm-detailOv').addEventListener('click', function(e){ if(e.target===$('sm-detailOv')) closeDetail(); });
    $('sm-copy').addEventListener('click', function(){
      var m=getMemo(detailId); if(!m) return;
      var txt=plain(m) || '(사진 메모)';
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(function(){ toast('📋 복사됐어요'); }).catch(function(){ fallbackCopy(txt); });
      } else { fallbackCopy(txt); }
    });
    $('sm-edit').addEventListener('click', function(){ if(detailId){ var id=detailId; closeDetail(); openEditor(id); } });
    $('sm-del').addEventListener('click', function(){
      if(!detailId) return;
      if(!confirm('이 메모를 삭제할까요? (되돌릴 수 없음)')) return;
      removeMemo(detailId); closeDetail(); toast('삭제됐어요');
    });

    $('sm-editClose').addEventListener('click', closeEditor);
    $('sm-editCancel').addEventListener('click', closeEditor);
    $('sm-save').addEventListener('click', saveEditor);
    $('sm-photo').addEventListener('change', function(e){ handlePhotoFiles(e.target.files); e.target.value=''; });

    /* 편집기 붙여넣기 — 이미지는 인라인, 텍스트는 순수 텍스트 */
    $('sm-editor').addEventListener('paste', function(e){
      var cd=e.clipboardData||window.clipboardData; if(!cd) return;
      var items=cd.items;
      if(items){
        for(var i=0;i<items.length;i++){
          var it=items[i];
          if(it.type && it.type.indexOf('image/')===0){
            e.preventDefault();
            var blob=it.getAsFile(); if(!blob) continue;
            compress(blob,1400,0.75).then(function(url){ insertImageAtCursor(url); $('sm-editStatus').textContent='📷 사진이 본문에 들어갔어요'; }).catch(function(){});
            return;
          }
        }
      }
      e.preventDefault();
      var text=cd.getData('text/plain')||'';
      document.execCommand('insertText', false, text);
    });

    $('sm-zoom').addEventListener('click', function(){ $('sm-zoom').classList.remove('show'); });

    document.addEventListener('keydown', function(e){
      if((e.ctrlKey||e.metaKey) && e.shiftKey && (e.key==='M'||e.key==='m')){ e.preventDefault(); if($('sm-panelOv').classList.contains('show')) close(); else open(); }
      if(e.key==='Escape'){
        if($('sm-editOv').classList.contains('show')) closeEditor();
        else if($('sm-detailOv').classList.contains('show')) closeDetail();
        else if($('sm-panelOv').classList.contains('show')) close();
      }
    });
  }

  function fallbackCopy(txt){
    try{ var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('📋 복사됐어요'); }
    catch(e){ toast('복사 실패'); }
  }

  /* ---------- 시작 ---------- */
  function init(){ buildDOM(); wire(); subscribe(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
