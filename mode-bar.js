/* ═══════════════════════════════════════════════════════════════
   mode-bar.js — 🛠 업무일지 ↔ 🏠 개인일지 전환 바            v360-1024-0700
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
      + '<button type="button" class="wlm-habit book" id="wlmBook">📚 독서<small>읽은 책 기록</small></button>'
      + '<button type="button" class="wlm-habit inv" id="wlmInv">💹 투자<small>생각 · 자료 · 사진</small></button>'
      + '<button type="button" class="wlm-habit diary" id="wlmDiary">🗂 자료실<small>기록 모음</small></button>'
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

/* ✍ 맞춤법 표시: 업무일지 전체의 글 쓰는 곳(글상자·한 줄 입력·편집 영역)에 브라우저 맞춤법 표시(빨간 줄)를 켠다.
   비밀번호·숫자 코드 칸은 제외. 끄고 싶은 칸은 data-nospell 을 붙인다.
   ※ 한국어 표시는 크롬 설정 › 언어 › 맞춤법 검사 에서 한국어가 켜져 있어야 보인다. */
(function(){
  if(window.__wlSpellOn) return; window.__wlSpellOn=true;
  var SEL='textarea,input[type=text],input[type=search],input:not([type]),[contenteditable=""],[contenteditable="true"]';
  function fix(e){
    try{
      if(!e||e.nodeType!==1) return;
      if(e.matches('[type=password],[data-nospell],[inputmode=numeric],[inputmode=tel],[type=tel],[type=number],[type=email],[type=url]')) return;
      if(e.getAttribute('spellcheck')!=='true') e.setAttribute('spellcheck','true');
      if(!e.getAttribute('lang')) e.setAttribute('lang','ko');
    }catch(_){}
  }
  function scan(root){
    if(!root||root.nodeType!==1) return;
    if(root.matches&&root.matches(SEL)) fix(root);
    var l=root.querySelectorAll?root.querySelectorAll(SEL):[];
    for(var i=0;i<l.length;i++) fix(l[i]);
  }
  function start(){
    scan(document.body);
    new MutationObserver(function(ms){
      ms.forEach(function(m){
        if(m.type==='childList') m.addedNodes.forEach(scan);
        else if(m.type==='attributes') fix(m.target);
      });
    }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['contenteditable']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();

/* ✍ 자동 맞춤법·어색한 표현 검사 (업무일지 전체의 글 입력 칸)
   - 글쓰기를 멈추고 잠시(기본 3.5초) 지나면, 업무일지에 저장한 AI 키로 검사한다. 고칠 곳이 있으면 칸 오른쪽 아래에 ✍ 단추가 뜬다.
   - 단추를 누르면 수정 제안 목록이 나오고, 체크한 것만 고친다. 글은 사용자가 누르기 전에는 절대 바뀌지 않는다.
   - 🗂 자료실(개인 글) 칸·비밀번호·검색 칸은 검사하지 않는다(외부로 보내지 않음).
   - 끄기: 제안 창의 [자동 검사 끄기] 또는 콘솔에서 wlSpellAuto(false) */
(function(){
  if(window.__wlSpellAI) return; window.__wlSpellAI=true;
  var LSK='wl_spell_auto', CFG=window.wlSpellCfg={idle:3500,min:12,max:6000,gap:6000};
  var timers=new WeakMap(), lastTxt=new WeakMap(), lastCall=0, chip=null, pop=null;
  function isOn(){ try{return localStorage.getItem(LSK)!=='0';}catch(e){return true;} }
  window.wlSpellAuto=function(on){ try{localStorage.setItem(LSK,on?'1':'0');}catch(e){} hideChip(); return on; };
  function aiKey(){ try{return (typeof aiGetKey==='function')?aiGetKey():'';}catch(e){return '';} }
  var FIELD='textarea,input[type=text],input:not([type]),[contenteditable=""],[contenteditable="true"]';
  function okField(t){
    try{
      if(!t||t.nodeType!==1||!t.matches||!t.matches(FIELD)) return false;
      if(t.matches('[type=password],[type=search],[data-nospell],[inputmode=numeric],[type=number],[type=tel]')) return false;
      if(t.closest('.dy,.dcol,#hbCode,#hbSpellPop,#spellCheckOv')) return false;      // 자료실(개인 글)은 제외
      return true;
    }catch(e){ return false; }
  }
  function textOf(t){ return (t.tagName==='TEXTAREA'||t.tagName==='INPUT')?(t.value||''):(t.innerText||''); }
  function hideChip(){ if(chip&&chip.parentNode) chip.parentNode.removeChild(chip); chip=null; }
  function closePop(){ if(pop&&pop.parentNode) pop.parentNode.removeChild(pop); pop=null; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  document.addEventListener('input',function(e){
    var t=e.target; if(!okField(t)) return;
    hideChip(); clearTimeout(timers.get(t));
    if(!isOn()||!aiKey()) return;
    timers.set(t,setTimeout(function(){check(t);},CFG.idle));
  },true);
  window.addEventListener('scroll',hideChip,true); window.addEventListener('resize',hideChip);
  function check(t){
    if(!document.body.contains(t)||document.hidden||!isOn()) return;
    var key=aiKey(); if(!key) return;
    var txt=textOf(t).trim(); if(txt.length<CFG.min) return;
    txt=txt.slice(0,CFG.max); if(lastTxt.get(t)===txt) return;
    var wait=CFG.gap-(Date.now()-lastCall);
    if(wait>0){ clearTimeout(timers.get(t)); timers.set(t,setTimeout(function(){check(t);},wait)); return; }
    lastCall=Date.now(); lastTxt.set(t,txt);
    var prompt='다음 글의 맞춤법, 띄어쓰기, 어색하거나 이상한 표현을 검사해 주세요.\n고칠 곳이 있으면 JSON 으로만 응답하고, 없으면 {"ok":true} 만 응답하세요.\n"original" 은 아래 글에 있는 문장 조각을 한 글자도 바꾸지 말고 그대로(10~40자) 옮기세요. 고유명사·숫자·영어 약어·전문용어는 건드리지 마세요.\n\n'+txt+'\n\n응답 형식: {"ok":false,"items":[{"original":"글 속 조각","corrected":"고친 조각","reason":"짧은 이유"}]}';
    fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1500,messages:[{role:'user',content:prompt}]})})
    .then(function(r){return r.json();}).then(function(d){
      var raw=(d.content||[]).map(function(x){return x.text||'';}).join('').trim(),res=null;
      try{res=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){}
      if(!res||res.ok) return;
      var now=textOf(t);
      var items=(res.items||[]).filter(function(it){return it&&it.original&&it.corrected&&it.original!==it.corrected&&now.indexOf(it.original)>=0;}).slice(0,30);
      if(items.length) showChip(t,items);
    }).catch(function(){});
  }
  function showChip(t,items){
    hideChip();
    var r=t.getBoundingClientRect(); if(!r.width||!r.height) return;
    chip=document.createElement('button'); chip.type='button'; chip.id='wlSpellChip';
    chip.textContent='✍ 맞춤법 '+items.length+'곳';
    chip.style.cssText='position:fixed;z-index:2147483500;right:'+Math.max(8,Math.round(innerWidth-r.right+6))+'px;top:'+Math.max(8,Math.min(innerHeight-40,Math.round(r.bottom-34)))+'px;background:#fff3cd;border:1.5px solid #f0b429;color:#7a4b00;border-radius:999px;padding:5px 12px;font:700 12.5px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.2)';
    chip.addEventListener('mousedown',function(e){e.preventDefault();});
    chip.addEventListener('click',function(){ openPop(t,items); });
    document.body.appendChild(chip);
  }
  function openPop(t,items){
    hideChip(); closePop();
    pop=document.createElement('div'); pop.id='hbSpellPop';
    pop.style.cssText='position:fixed;inset:0;z-index:2147483600;background:rgba(20,20,40,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif';
    pop.innerHTML='<div style="background:#fff;color:#1a2f45;border-radius:16px;max-width:560px;width:100%;max-height:80vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.3)">'
      +'<div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:800">✍ 맞춤법 · 표현 제안 <span style="font-weight:600;color:#64748b;font-size:12px">'+items.length+'곳</span></div>'
      +'<div style="padding:12px 16px;display:grid;gap:8px">'+items.map(function(it,i){return '<label style="display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;line-height:1.5;cursor:pointer"><input type="checkbox" class="spk" data-i="'+i+'" checked style="margin-top:4px"><span><s style="color:#c0392b">'+esc(it.original)+'</s> → <b style="color:#0f7a4b">'+esc(it.corrected)+'</b><em style="display:block;font-style:normal;font-size:12px;color:#64748b">💡 '+esc(it.reason||'')+'</em></span></label>';}).join('')+'</div>'
      +'<div style="padding:0 16px 16px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="spOk" style="flex:1 1 140px;height:42px;border:0;border-radius:10px;background:#3f7cb8;color:#fff;font:800 14px system-ui;cursor:pointer">✅ 체크한 것 고치기</button><button type="button" id="spNo" style="height:42px;padding:0 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#f8fafc;color:#475569;font:700 13px system-ui;cursor:pointer">닫기</button><button type="button" id="spOff" style="height:42px;padding:0 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;color:#94a3b8;font:700 12px system-ui;cursor:pointer">자동 검사 끄기</button></div></div>';
    document.body.appendChild(pop);
    pop.querySelector('#spNo').onclick=closePop;
    pop.querySelector('#spOff').onclick=function(){ window.wlSpellAuto(false); closePop(); };
    pop.querySelector('#spOk').onclick=function(){
      var picks=[].slice.call(pop.querySelectorAll('.spk:checked')).map(function(c){return items[+c.getAttribute('data-i')];});
      apply(t,picks); closePop();
    };
  }
  function apply(t,picks){
    if(!document.body.contains(t)) return;
    var isForm=(t.tagName==='TEXTAREA'||t.tagName==='INPUT');
    picks.forEach(function(it){
      if(isForm){
        var at=t.value.indexOf(it.original);
        if(at>=0) t.value=t.value.slice(0,at)+it.corrected+t.value.slice(at+it.original.length);
      }else{
        var w=document.createTreeWalker(t,NodeFilter.SHOW_TEXT,null),nd;
        while((nd=w.nextNode())){
          var k=nd.nodeValue.indexOf(it.original);
          if(k>=0){ nd.nodeValue=nd.nodeValue.slice(0,k)+it.corrected+nd.nodeValue.slice(k+it.original.length); break; }
        }
      }
    });
    t.dispatchEvent(new Event('input',{bubbles:true})); t.dispatchEvent(new Event('change',{bubbles:true}));
  }
})();
