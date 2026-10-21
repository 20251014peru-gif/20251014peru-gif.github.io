/* ═══════════════════════════════════════════════════════════════
   mode-bar.js — 🛠 업무일지 ↔ 🏠 개인일지 전환 바            v315-1021-1000
   달님 : 「개인일지가 있다는 걸 자꾸 잊는다 / 윗줄 아이콘이 구별이 안 된다」

   ① 맨 위에 늘 붙어 있는 큰 전환 바 (어느 탭에서도 보인다)
   ② 개인일지에 들어가면 화면 전체가 분홍빛으로 바뀐다 (업무 = 파랑)
   ③ 윗줄 바로가기 단추(연락처·직원·일지·월보고·안전…)는 모양을 하나로 통일

   🔴 기존 코드는 건드리지 않는다. 전환은 이미 있는 함수를 그대로 부른다.
      - 개인  : window.wlOpenData('personal')   (없으면 v43ActivateTab('life'))
      - 업무  : 마지막에 보던 업무 탭으로 (없으면 「기록」)
   🔴 개인일지인지 아닌지는 #v43-life 패널이 열려 있는지로만 판단한다.
   되돌리기 : worklog.html 에서 <script src="mode-bar.js…"> 한 줄만 지우면 원래대로.
   ═══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.__wlModeBar) return;
  window.__wlModeBar = true;

  var LS_LAST = 'wl_last_work_tab';
  var root = document.documentElement;

  /* ── 스타일 ─────────────────────────────────────────────── */
  var css = ''
  + '#wlModeBar{position:sticky;top:0;z-index:1500;display:flex;align-items:stretch;gap:8px;'
  +   'padding:8px 16px;background:#fff;border-bottom:1px solid #d6e0ec;box-shadow:0 2px 8px rgba(26,47,69,.06)}'
  + '#wlModeBar .wlm-seg{display:flex;flex:0 1 460px;min-width:0;gap:8px}'
  + '#wlModeBar .wlm-btn{flex:1;min-width:0;border:2px solid transparent;border-radius:14px;background:transparent;cursor:pointer;font-family:inherit;'
  +   'padding:9px 10px;font-size:16px;font-weight:800;color:#6b7f95;line-height:1.2;touch-action:manipulation;'
  +   'display:flex;flex-direction:column;align-items:center;gap:1px}'
  + '#wlModeBar .wlm-btn small{font-size:11px;font-weight:600;opacity:.85}'
  /* 선택 안 된 쪽도 흐리게 두지 않는다 — 각자 자기 색을 진하게 */
  + '#wlModeBar .wlm-btn[data-wlmode="work"]{background:#dbeafe;color:#1e40af;border-color:#7fb0f0}'
  + '#wlModeBar .wlm-btn[data-wlmode="personal"]{background:#fde1ef;color:#be185d;border-color:#f08cbc}'
  + '#wlModeBar .wlm-btn[data-wlmode="work"].on{background:#1d4ed8;color:#fff;border-color:#1e3a8a;box-shadow:0 2px 6px rgba(29,78,216,.4)}'
  + '#wlModeBar .wlm-btn[data-wlmode="personal"].on{background:#db2777;color:#fff;border-color:#9d174d;box-shadow:0 2px 6px rgba(219,39,119,.4)}'
  + '#wlModeBar .wlm-btn:not(.on):hover{filter:brightness(.96)}'
  + 'html[data-wl-mode="personal"] header .brand h1{color:#be185d !important}'
  + '#wlModeBar .wlm-now{flex:1;min-width:0;align-self:center;font-size:13px;font-weight:700;line-height:1.35;'
  +   'padding-left:4px;overflow:hidden;text-overflow:ellipsis}'
  + 'html[data-wl-mode="work"] #wlModeBar .wlm-now{color:#2563a8}'
  + 'html[data-wl-mode="personal"] #wlModeBar .wlm-now{color:#be185d}'
  /* 개인일지 화면 전체 색 */
  + 'html[data-wl-mode="personal"] #wlModeBar{border-bottom:4px solid #db2777;background:#fff0f6}'
  + 'html[data-wl-mode="work"] #wlModeBar{border-bottom:4px solid #2563a8}'
  + 'html[data-wl-mode="personal"] body{background:#fff5f9 !important}'
  + 'html[data-wl-mode="personal"] header{background:linear-gradient(135deg,#fde7f1 0%,#fff0f6 60%,#fdeaf6 100%) !important}'
  + 'html[data-wl-mode="personal"] .v43-tab.active{background:#db2777 !important;border-color:#db2777 !important;color:#fff !important}'
  + 'html[data-wl-mode="personal"] .lf-tab.on{background:#db2777 !important;border-color:#db2777 !important;color:#fff !important}'
  /* 윗줄 바로가기 단추 — 색을 하나로 (색은 모드 표시에만 쓴다) */
  + 'header .nav-btn:not(#btnGCal):not(#btnGcalPull):not(#btnGcalPullCfg):not(.nav-back){'
  +   'background:#fff !important;color:#1e3a5f !important;border:1.5px solid #b9cde3 !important;'
  +   'border-radius:10px !important;font-weight:700 !important;box-shadow:none !important}'
  + 'header .nav-btn:not(#btnGCal):not(#btnGcalPull):not(#btnGcalPullCfg):not(.nav-back):hover{background:#eaf2fb !important}'
  /* 🌱 습관 만들기 — 매일 쓰는 단추라 크게, 개인일지 바로 옆에 */
  + '#wlModeBar .wlm-habit{flex:0 0 auto;min-width:200px;border:2px solid #16a34a;border-radius:14px;background:#16a34a;color:#fff;'
  +   'cursor:pointer;font-family:inherit;padding:9px 22px;font-size:18px;font-weight:800;line-height:1.2;touch-action:manipulation;'
  +   'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 2px 6px rgba(22,163,74,.35)}'
  + '#wlModeBar .wlm-habit small{font-size:11px;font-weight:600;opacity:.92}'
  + '#wlModeBar .wlm-habit:hover{background:#15803d;border-color:#15803d}'
  + '#wlModeBar .wlm-habit.diary{min-width:150px;background:#7c3aed;border-color:#7c3aed;box-shadow:0 2px 6px rgba(124,58,237,.35)}'
  + '#wlModeBar .wlm-habit.diary:hover{background:#6d28d9;border-color:#6d28d9}'
  + '#wlModeBar .wlm-habit.inv{min-width:150px;background:#d97706;border-color:#d97706;box-shadow:0 2px 6px rgba(217,119,6,.35)}'
  + '#wlModeBar .wlm-habit.inv:hover{background:#b45309;border-color:#b45309}'
  /* 개인일지에서는 업무용 줄(점검일지~폴더탭관리·업무 검색)을 감춘다 */
  + 'html[data-wl-mode="personal"] #v43Tabs,html[data-wl-mode="personal"] #v43TabsRow2Wrap,'
  +   'html[data-wl-mode="personal"] #wlTopRow,html[data-wl-mode="personal"] .v43-search-wrap{display:none !important}'
  /* 여섯 단추는 모두 같은 크기·한 줄 — 글자 크기에 가깝게 작게 */
  + '#wlModeBar{align-items:center;gap:6px;padding:6px 16px}'
  + '#wlModeBar .wlm-seg{display:contents}'
  + '#wlModeBar .wlm-btn,#wlModeBar .wlm-habit{flex:0 0 118px;width:118px;min-width:0;box-sizing:border-box;height:38px;padding:0 6px;font-size:15px;font-weight:800;'
  +   'border-radius:12px;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:4px;white-space:nowrap;box-shadow:none;line-height:1}'
  + '#wlModeBar .wlm-btn small,#wlModeBar .wlm-habit small{display:none}'
  + '#wlModeBar .wlm-habit.inv{min-width:0}#wlModeBar .wlm-habit.diary{min-width:0}'
  + '#wlModeBar .wlm-habit.book{background:#0f766e;border-color:#0f766e}'
  + '#wlModeBar .wlm-habit.book:hover{background:#115e59;border-color:#115e59}'
  + '@media (max-width:640px){'
  +   '#wlModeBar{display:grid;grid-template-columns:repeat(3,1fr);padding:6px 8px;gap:6px}'
  +   '#wlModeBar .wlm-btn,#wlModeBar .wlm-habit{flex:none;width:auto;font-size:14px;height:40px;padding:0 2px}'
  +   '#wlModeBar .wlm-now{display:none}'
  + '}';
  var st = document.createElement('style');
  st.id = 'wlModeBarCss';
  st.textContent = css;
  document.head.appendChild(st);

  /* ── 지금 모드 ───────────────────────────────────────────── */
  function panelOn(id){
    var p = document.getElementById(id);
    return !!(p && p.classList.contains('active'));
  }
  function curMode(){ return panelOn('v43-life') ? 'personal' : 'work'; }

  function activePanelTab(){
    var ps = document.querySelectorAll('.v43-panel.active');
    for(var i=0;i<ps.length;i++){
      var id = ps[i].id || '';
      if(id.indexOf('v43-')===0 && id!=='v43-life') return id.slice(4);
    }
    return '';
  }

  /* ── 화면 그리기 ─────────────────────────────────────────── */
  var bar = null;
  function build(){
    var hd = document.querySelector('header');
    if(!hd || !hd.parentNode) return false;
    bar = document.createElement('div');
    bar.id = 'wlModeBar';
    bar.innerHTML =
        '<div class="wlm-seg" role="tablist" aria-label="일지 전환">'
      +   '<button type="button" class="wlm-btn" data-wlmode="work" role="tab">🛠 업무일지<small>시설관리 업무</small></button>'
      +   '<button type="button" class="wlm-btn" data-wlmode="personal" role="tab">🏠 개인일지<small>나만의 기록</small></button>'
      + '</div>'
      + '<button type="button" class="wlm-habit" id="wlmHabit">🌱 습관 만들기<small>매일 체크</small></button>'
      + '<button type="button" class="wlm-habit diary" id="wlmDiary">📓 일기<small>하루 정리</small></button>'
      + '<button type="button" class="wlm-habit inv" id="wlmInv">💹 투자<small>생각 · 자료 · 사진</small></button>'
      + '<button type="button" class="wlm-habit book" id="wlmBook">📚 독서<small>읽은 책 기록</small></button>'
      + '<div class="wlm-now" id="wlModeNow"></div>';
    hd.parentNode.insertBefore(bar, hd);
    bar.addEventListener('click', function(ev){
      if(ev.target.closest && ev.target.closest('#wlmHabit')){
        if(typeof window.wlHabitsOpen==='function') window.wlHabitsOpen('day');
        return;
      }
      if(ev.target.closest && ev.target.closest('#wlmBook')){
        if(typeof window.wlHabitsOpen==='function') window.wlHabitsOpen('book');
        return;
      }
      if(ev.target.closest && ev.target.closest('#wlmInv')){
        if(typeof window.wlHabitsOpen==='function') window.wlHabitsOpen('inv');
        return;
      }
      if(ev.target.closest && ev.target.closest('#wlmDiary')){
        if(typeof window.wlHabitsOpen==='function') window.wlHabitsOpen('diary');
        return;
      }
      var b = ev.target.closest && ev.target.closest('.wlm-btn');
      if(!b) return;
      go(b.getAttribute('data-wlmode'));
    });
    return true;
  }

  function paint(){
    var m = curMode();
    root.setAttribute('data-wl-mode', m);
    if(!bar) return;
    bar.querySelectorAll('.wlm-btn').forEach(function(b){
      var on = b.getAttribute('data-wlmode')===m;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    /* 오른쪽 고정 단추(기록추가·일지)는 업무일지에서만 */
    ['v43FabHeader','v43FabDiary'].forEach(function(id){
      var f = document.getElementById(id);
      if(!f) return;
      if(m==='personal'){ f.setAttribute('data-wlhid','1'); f.style.setProperty('display','none','important'); }
      else if(f.getAttribute('data-wlhid')){ f.removeAttribute('data-wlhid'); f.style.setProperty('display','flex','important'); }
    });
    /* 머리 제목: 개인일지에서는 '개인일지'로 */
    var h1 = document.querySelector('header .brand h1'), sub = document.querySelector('header .brand .sub');
    if(h1){
      if(!h1.getAttribute('data-wlorig')) h1.setAttribute('data-wlorig', h1.textContent);
      var wantT = (m==='personal') ? '개인일지' : h1.getAttribute('data-wlorig');
      if(h1.textContent !== wantT) h1.textContent = wantT;
    }
    if(sub && sub.firstChild && sub.firstChild.nodeType===3){
      if(!sub.getAttribute('data-wlorig')) sub.setAttribute('data-wlorig', sub.firstChild.nodeValue);
      var wantS = (m==='personal') ? '나만의 기록 ' : sub.getAttribute('data-wlorig');
      if(sub.firstChild.nodeValue !== wantS) sub.firstChild.nodeValue = wantS;
    }
    var now = document.getElementById('wlModeNow');
    if(now) now.textContent = (m==='personal')
      ? '🏠 지금은 개인일지예요 — 업무일지와 따로 저장됩니다'
      : '🛠 지금은 업무일지예요';
    if(m==='work'){
      var t = activePanelTab();
      if(t){ try{ localStorage.setItem(LS_LAST, t); }catch(e){} }
    }
  }

  /* ── 전환 ────────────────────────────────────────────────── */
  function go(mode){
    if(mode===curMode()) return;
    try{
      if(mode==='personal'){
        if(typeof window.wlOpenData==='function') window.wlOpenData('personal');
        else if(typeof window.v43ActivateTab==='function') window.v43ActivateTab('life');
      } else {
        var t = 'main';
        try{ t = localStorage.getItem(LS_LAST) || 'main'; }catch(e){}
        if(t==='data' && typeof window.wlOpenData==='function'){
          var k = 'work';
          try{ k = localStorage.getItem('wl_ds_last') || 'work'; }catch(e){}
          window.wlOpenData(k);
        } else if(typeof window.v43ActivateTab==='function'){
          window.v43ActivateTab(t);
        }
      }
    }catch(e){ console.warn('[모드 바] 전환 실패', e); }
    setTimeout(paint, 120);
  }

  /* ── 시작 ────────────────────────────────────────────────── */
  function start(){
    if(!build()){ setTimeout(start, 300); return; }
    paint();
    /* 탭이 바뀌면(패널의 active 가 바뀌면) 다시 칠한다 */
    try{
      var mo = new MutationObserver(function(){ paint(); });
      document.querySelectorAll('.v43-panel').forEach(function(p){
        mo.observe(p, {attributes:true, attributeFilter:['class']});
      });
    }catch(e){ setInterval(paint, 800); }
    /* 패널이 나중에 생길 때를 대비한 안전망 */
    setInterval(paint, 2000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
