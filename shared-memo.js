/* =========================================================================
   공유메모 (shared-memo.js)  v20260720b — 한 칸 메모장(업무일지 방식) 통합판
   - 나의 시스템(index.html) · 업무일지(worklog.html) · 개인일지(personal.html)
     세 앱이 이 파일 하나를 <script src>로 똑같이 불러온다.
   - "한 칸에 쭉 적는 메모장" 하나를 세 앱이 Firebase 로 실시간 공유한다.
     → 어디서 적든 세 곳 모두 같은 내용이 보인다.
   - 새 플로팅 버튼(⚡)을 따로 두지 않는다. 각 앱의 기존 메모 버튼으로 열린다.
     (개인일지는 여는 버튼이 없어서, 없을 때만 작은 여는 버튼 하나를 만든다.)
   - 저장: Firebase 'dash_memo' 컬렉션의 단일 문서 '__note__'. 실패 시 localStorage.
   - 사진: 붙여넣기(Ctrl+V) 또는 📷 버튼으로 본문 안에 인라인 삽입 (업무일지와 동일).
   여는 법: 기존 메모 버튼 / 우측 작은 버튼 / 단축키 Ctrl+Shift+M / window.SharedMemo.open()
   ========================================================================= */
(function(){
  if(window.__SHARED_MEMO__){ return; }
  window.__SHARED_MEMO__ = true;

  var COL='dash_memo', DOCID='__note__';
  var FB={ apiKey:"AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY", authDomain:"my-system-25497.firebaseapp.com", projectId:"my-system-25497", storageBucket:"my-system-25497.firebasestorage.app" };
  var LSK='shared_note_cache';

  var db=null, docRef=null;
  try{
    if(window.firebase && firebase.firestore){
      if(!firebase.apps || !firebase.apps.length){ firebase.initializeApp(FB); }
      db=firebase.firestore();
      docRef=db.collection(COL).doc(DOCID);
    }
  }catch(e){ console.warn('[공유메모] Firebase 초기화 실패 — 로컬 저장으로 동작', e); }

  var applyingRemote=false;   /* 원격 반영 중엔 저장 트리거 막기 */
  var lastLocalEdit=0;        /* 내가 마지막으로 친 시각 (타이핑 중 원격 덮어쓰기 방지) */
  var saveTimer=null;

  /* ---------- 유틸 ---------- */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function $(id){ return document.getElementById(id); }
  function ed(){ return $('smNoteText'); }
  function status(t){ var s=$('smNoteStatus'); if(s) s.textContent=t; }
  function toast(msg){
    var t=$('sm-toast'); if(!t){ t=document.createElement('div'); t.id='sm-toast'; document.body.appendChild(t); }
    t.textContent=msg; t.className='sm-show'; clearTimeout(t._t); t._t=setTimeout(function(){ t.className=''; }, 1800);
  }
  function compress(file,max,q){
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onload=function(e){ var img=new Image(); img.onload=function(){
        var w=img.width,h=img.height,s=Math.min(1,max/Math.max(w,h));
        var cv=document.createElement('canvas'); cv.width=Math.round(w*s); cv.height=Math.round(h*s);
        cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
        res(cv.toDataURL('image/jpeg',q||0.72));
      }; img.onerror=rej; img.src=e.target.result; };
      r.onerror=rej; r.readAsDataURL(file);
    });
  }

  /* ---------- DOM ---------- */
  function buildDOM(){
    var style=document.createElement('style');
    style.textContent=[
      '#smNoteOv{position:fixed;inset:0;z-index:99010;background:rgba(20,30,45,.38);display:none}',
      '#smNoteOv.show{display:block}',
      '#smNote{position:fixed;top:0;right:0;height:100%;width:380px;max-width:92vw;background:#fff;box-shadow:-6px 0 26px rgba(0,0,0,.18);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .25s cubic-bezier(.34,1.4,.64,1)}',
      '#smNoteOv.show #smNote{transform:translateX(0)}',
      '.smn-head{display:flex;align-items:center;gap:8px;padding:14px 14px;border-bottom:1.5px solid #eef1f4;background:#fffdf5;flex-shrink:0}',
      '.smn-head b{font-size:16px;color:#1a2f45;flex:1}',
      '.smn-btn{border:1.5px solid #e2e7ec;background:#fff;border-radius:9px;padding:6px 11px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;color:#41546a}',
      '.smn-btn.copy{border-color:#bcdff5;color:#2578b5;background:#f2f9ff}',
      '.smn-x{border:none;background:none;font-size:20px;cursor:pointer;color:#8a97a4;line-height:1;padding:2px 4px}',
      '#smNoteText{flex:1;overflow-y:auto;padding:16px;font-size:15px;line-height:1.65;outline:none;color:#20303f;word-break:break-word;-webkit-overflow-scrolling:touch}',
      '#smNoteText:empty:before{content:attr(data-ph);color:#aab4c0}',
      '#smNoteText img{max-width:100%;border-radius:10px;margin:6px 0;display:block}',
      '.smn-inline-wrap{position:relative;display:inline-block;max-width:100%}',
      '.smn-inline-wrap .smn-img-rm{position:absolute;top:5px;right:5px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:15px;line-height:1;cursor:pointer}',
      '.smn-foot{display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1.5px solid #eef1f4;flex-shrink:0}',
      '.smn-photo{display:inline-flex;align-items:center;gap:5px;height:38px;padding:0 13px;border:1.5px dashed #dfe4ea;border-radius:10px;font-size:13px;font-weight:700;color:#5a6b7b;cursor:pointer;background:#fff}',
      '.smn-status{font-size:12px;color:#9aa7b4;margin-left:auto;text-align:right}',
      '#smOpenBtn{position:fixed;right:14px;bottom:16px;z-index:98000;height:44px;padding:0 16px;border:none;border-radius:22px;background:linear-gradient(135deg,#f5b301,#f39c12);color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 5px 16px rgba(0,0,0,.22);font-family:inherit;display:none}',
      '#smZoom{position:fixed;inset:0;z-index:99030;background:rgba(0,0,0,.86);display:none;align-items:center;justify-content:center}',
      '#smZoom.show{display:flex}','#smZoom img{max-width:94%;max-height:94%;border-radius:10px}',
      '#sm-toast{position:fixed;left:50%;bottom:70px;transform:translateX(-50%) translateY(16px);z-index:99050;background:#243447;color:#fff;padding:10px 18px;border-radius:22px;font-size:13px;font-weight:700;opacity:0;pointer-events:none;transition:all .2s;max-width:90%}',
      '#sm-toast.sm-show{opacity:1;transform:translateX(-50%) translateY(0)}'
    ].join('\n');
    document.head.appendChild(style);

    var wrap=document.createElement('div');
    wrap.innerHTML=[
      '<div id="smNoteOv">',
      '  <div id="smNote">',
      '    <div class="smn-head"><b>⚡ 공유메모</b><button class="smn-btn copy" id="smNoteCopy">📋 복사</button><button class="smn-x" id="smNoteClose">✕</button></div>',
      '    <div id="smNoteText" contenteditable="true" data-ph="여기에 급하게 적어두세요… 세 앱(나의 시스템·업무일지·개인일지) 어디서나 같이 보여요. 사진은 붙여넣기 또는 📷"></div>',
      '    <div class="smn-foot"><label class="smn-photo">📷 사진<input type="file" id="smNotePhoto" accept="image/*" multiple style="display:none"></label><span class="smn-status" id="smNoteStatus">☁ 실시간 공유</span></div>',
      '  </div>',
      '</div>',
      '<button id="smOpenBtn">📝 공유메모</button>',
      '<div id="smZoom"><img id="smZoomImg" src=""></div>'
    ].join('');
    document.body.appendChild(wrap);
  }

  /* ---------- 열기/닫기 ---------- */
  function open(){ $('smNoteOv').classList.add('show'); setTimeout(function(){ var e=ed(); if(e) e.focus(); }, 220); }
  function close(){ $('smNoteOv').classList.remove('show'); flush(); }
  window.SharedMemo={ open:open, close:close };
  /* 기존 코드 호환 — 나의 시스템 등에서 openMemo() 를 부르면 공유메모가 열리게 */
  window.openMemo=open;

  /* ---------- 사진 인라인 ---------- */
  function insertImage(dataUrl){
    var html='<div class="smn-inline-wrap" contenteditable="false"><img src="'+dataUrl+'"><button type="button" class="smn-img-rm" title="이 사진 삭제">×</button></div><br>';
    var e=ed(), sel=window.getSelection();
    if(sel && sel.rangeCount){
      var range=sel.getRangeAt(0);
      if(e.contains(range.startContainer)){
        range.deleteContents();
        var tmp=document.createElement('div'); tmp.innerHTML=html;
        var frag=document.createDocumentFragment(); while(tmp.firstChild) frag.appendChild(tmp.firstChild);
        range.insertNode(frag); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
        bindImgs(); scheduleSave(); return;
      }
    }
    e.insertAdjacentHTML('beforeend', html); bindImgs(); scheduleSave();
  }
  function bindImgs(){
    var e=ed(); if(!e) return;
    Array.prototype.forEach.call(e.querySelectorAll('.smn-img-rm'), function(b){ b.onclick=function(ev){ ev.preventDefault(); var w=b.closest('.smn-inline-wrap'); if(w){ w.remove(); scheduleSave(); } }; });
    Array.prototype.forEach.call(e.querySelectorAll('.smn-inline-wrap img'), function(im){ im.onclick=function(){ $('smZoomImg').src=im.src; $('smZoom').classList.add('show'); }; });
  }

  /* ---------- 저장/동기화 ---------- */
  function scheduleSave(){
    lastLocalEdit=Date.now();
    if(applyingRemote) return;
    status('저장 중…');
    clearTimeout(saveTimer); saveTimer=setTimeout(save, 500);
  }
  function flush(){ if(saveTimer){ clearTimeout(saveTimer); save(); } }
  function save(){
    var e=ed(); if(!e) return;
    var html=e.innerHTML, text=(e.innerText||e.textContent||'').trim();
    if(docRef){
      docRef.set({ html:html, text:text, updatedAt:Date.now() }, {merge:true})
        .then(function(){ status('☁ 저장됨 '+hhmm()); })
        .catch(function(err){ console.warn(err); status('⚠ 저장 오류'); try{ localStorage.setItem(LSK, html); }catch(e2){} });
    } else {
      try{ localStorage.setItem(LSK, html); status('💾 저장됨(로컬) '+hhmm()); }catch(e2){ status('⚠ 저장 실패'); }
    }
  }
  function hhmm(){ var d=new Date(); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
  function applyRemote(html){
    var e=ed(); if(!e) return;
    /* 내가 지금 타이핑 중이면(포커스+최근 편집) 덮어쓰지 않는다 */
    if(document.activeElement===e && (Date.now()-lastLocalEdit)<4000) return;
    if(e.innerHTML===html) return;
    applyingRemote=true;
    e.innerHTML=html||'';
    bindImgs();
    applyingRemote=false;
    status('☁ 공유됨 '+hhmm());
  }
  function subscribe(){
    if(docRef){
      docRef.onSnapshot(function(snap){
        var d=snap.exists ? (snap.data()||{}) : {};
        applyRemote(d.html||'');
      }, function(err){ console.warn('[공유메모] 구독 오류', err); try{ applyRemote(localStorage.getItem(LSK)||''); }catch(e){} });
    } else {
      try{ applyRemote(localStorage.getItem(LSK)||''); }catch(e){}
    }
  }

  /* ---------- 여는 버튼 연결 (기존 버튼 재활용) ---------- */
  function wireOpeners(){
    /* 업무일지 #btnQuickMemo, 개인일지 #qmBtn, data-sharedmemo 표시 요소 — 동적 생성돼도 잡히게 캡처 위임 */
    document.addEventListener('click', function(e){
      var t = e.target.closest && e.target.closest('#btnQuickMemo,#qmBtn,[data-sharedmemo]');
      if(t){ e.stopImmediatePropagation(); e.preventDefault(); open(); }
    }, true);
    /* 단축키 */
    document.addEventListener('keydown', function(e){
      if((e.ctrlKey||e.metaKey) && e.shiftKey && (e.key==='M'||e.key==='m')){ e.preventDefault(); if($('smNoteOv').classList.contains('show')) close(); else open(); }
      if(e.key==='Escape' && $('smNoteOv').classList.contains('show')) close();
    });
    /* 여는 버튼이 하나도 없으면(개인일지) 작은 버튼을 우하단에 만든다 */
    setTimeout(function(){
      var hasExisting = document.getElementById('btnQuickMemo') || document.getElementById('qmBtn') || document.querySelector('[onclick*="SharedMemo"],[onclick*="openMemo"],[data-sharedmemo]');
      if(!hasExisting){ var b=$('smOpenBtn'); if(b){ b.style.display='block'; b.addEventListener('click', open); } }
    }, 1500);
  }

  /* ---------- 옛 메모 UI 숨김 (중복 방지) ---------- */
  function hideOldUI(){
    var css=document.createElement('style');
    /* 나의 시스템의 옛 급한메모 목록 모달(memoOv), 업무일지·개인일지의 옛 스크래치패드(quickMemoSide) 숨김.
       버튼은 위 wireOpeners 가 공유메모로 가로챈다. */
    css.textContent='#memoOv{display:none!important} #quickMemoSide{display:none!important}';
    document.head.appendChild(css);
  }

  /* ---------- 이벤트 ---------- */
  function wire(){
    $('smNoteClose').addEventListener('click', close);
    $('smNoteOv').addEventListener('click', function(e){ if(e.target===$('smNoteOv')) close(); });
    $('smNoteCopy').addEventListener('click', function(){
      var e=ed(); var txt=(e.innerText||e.textContent||'').trim();
      if(!txt){ toast('복사할 내용이 없어요'); return; }
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){ toast('📋 복사됐어요'); }).catch(function(){ fallbackCopy(txt); }); }
      else fallbackCopy(txt);
    });
    $('smNotePhoto').addEventListener('change', function(e){ handlePhotos(e.target.files); e.target.value=''; });
    var e=ed();
    e.addEventListener('input', scheduleSave);
    e.addEventListener('paste', function(ev){
      var cd=ev.clipboardData||window.clipboardData; if(!cd) return;
      var items=cd.items;
      if(items){ for(var i=0;i<items.length;i++){ var it=items[i];
        if(it.type && it.type.indexOf('image/')===0){ ev.preventDefault(); var blob=it.getAsFile(); if(blob){ compress(blob,1400,0.75).then(insertImage).catch(function(){}); } return; }
      } }
      ev.preventDefault(); var text=cd.getData('text/plain')||''; document.execCommand('insertText', false, text);
    });
    $('smZoom').addEventListener('click', function(){ $('smZoom').classList.remove('show'); });
  }
  function handlePhotos(files){
    var arr=Array.prototype.slice.call(files||[]);
    (function next(i){ if(i>=arr.length) return; var f=arr[i];
      if(!f.type || f.type.indexOf('image/')!==0){ next(i+1); return; }
      compress(f,1400,0.75).then(function(u){ insertImage(u); next(i+1); }).catch(function(){ next(i+1); });
    })(0);
  }
  function fallbackCopy(txt){ try{ var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('📋 복사됐어요'); }catch(e){ toast('복사 실패'); } }

  /* ---------- 시작 ---------- */
  function init(){ buildDOM(); hideOldUI(); wire(); wireOpeners(); subscribe(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
