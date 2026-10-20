/* ═══════════════════════════════════════════════════════════════
   mode-bar.js — 🛠 업무일지 ↔ 🏠 개인일지 전환 바            v299-1020-2309
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
  + '#wlModeBar .wlm-seg{display:flex;flex:0 1 460px;min-width:0;border:2px solid #cbd8e8;border-radius:14px;overflow:hidden;background:#f4f8fd}'
  + '#wlModeBar .wlm-btn{flex:1;min-width:0;border:0;background:transparent;cursor:pointer;font-family:inherit;'
  +   'padding:9px 10px;font-size:16px;font-weight:800;color:#6b7f95;line-height:1.2;touch-action:manipulation;'
  +   'display:flex;flex-direction:column;align-items:center;gap:1px}'
  + '#wlModeBar .wlm-btn small{font-size:11px;font-weight:600;opacity:.85}'
  + '#wlModeBar .wlm-btn[data-wlmode="work"].on{background:#2563a8;color:#fff}'
  + '#wlModeBar .wlm-btn[data-wlmode="personal"].on{background:#db2777;color:#fff}'
  + '#wlModeBar .wlm-btn:not(.on):hover{background:#e6eef8}'
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
  + '@media (max-width:640px){'
  +   '#wlModeBar{padding:6px 10px;gap:6px}'
  +   '#wlModeBar .wlm-seg{flex:1 1 100%}'
  +   '#wlModeBar .wlm-now{display:none}'
  +   '#wlModeBar .wlm-btn{font-size:15px;padding:9px 4px}'
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
      + '<div class="wlm-now" id="wlModeNow"></div>';
    hd.parentNode.insertBefore(bar, hd);
    bar.addEventListener('click', function(ev){
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
