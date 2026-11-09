/* Arrange existing actions without removing features or replacing the editor. */
window.installMarkflowUsability=function(api){
  const $=id=>document.getElementById(id), top=document.querySelector('.topbar');
  document.documentElement.dataset.markflowUi='3.9.6';
  let anchor=null;
  document.addEventListener('pointerdown',e=>{const b=e.target.closest('button,.dd,.fmenu,.mf-handle');if(b)anchor=b.getBoundingClientRect();},true);
  function place(el){
    if(el.dataset.popoverReady)return;el.dataset.popoverReady='1';el.classList.remove('sheet');el.classList.add('mf-near-menu');
    el.querySelector('.mf-menu-close')?.remove();const close=document.createElement('button');close.type='button';close.className='mf-menu-close';close.textContent='✕';close.setAttribute('aria-label','메뉴 닫기');
    close.addEventListener('mousedown',e=>e.preventDefault());close.onclick=e=>{e.stopPropagation();if(el.id==='ai-menu'){el.style.display='none';$('ai-backdrop')?.classList.remove('show');}else el.remove();};el.prepend(close);
    const savedAnchor=anchor;function position(){const v=window.visualViewport, vh=v?v.height:innerHeight,vy=v?v.offsetTop:0,w=Math.min(350,innerWidth-20);const r=savedAnchor||{left:innerWidth/2-w/2,bottom:100,top:100};let y=r.bottom+7;
      if(vy+vh-y<200)y=Math.max(vy+10,r.top-Math.min(420,vh-24)-7);y=Math.max(vy+10,Math.min(y,vy+vh-190));
      el.style.setProperty('left',Math.max(10,Math.min(r.left,innerWidth-w-10))+'px','important');el.style.setProperty('top',y+'px','important');el.style.setProperty('width',w+'px','important');el.style.setProperty('max-height',Math.max(150,vy+vh-y-10)+'px','important');
    }
    el._mfPosition=position;position();requestAnimationFrame(position);
  }
  function reposition(){document.querySelectorAll('.mf-near-menu').forEach(el=>el._mfPosition?.());}window.visualViewport?.addEventListener('resize',reposition);window.addEventListener('resize',reposition);
  const selectors='.slash.sheet,.mfpop.sheet,.mf-tbmore.sheet,.mf-emoji.sheet,.mf-hlpick.sheet,.mf-capedit.sheet,.mf-tblpick.sheet,#ai-menu.sheet';
  new MutationObserver(records=>{for(const r of records){if(r.type==='attributes'&&r.target.matches?.(selectors)){delete r.target.dataset.popoverReady;place(r.target);}for(const n of r.addedNodes||[]){if(n.nodeType!==1)continue;if(n.matches(selectors))place(n);n.querySelectorAll?.(selectors).forEach(place);}}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.mf-near-menu').forEach(el=>{if(el.id==='ai-menu')el.style.display='none';else el.remove();});settings.hidden=true;settingsButton.setAttribute('aria-expanded','false');api.closeMenus();}});
  const brand=document.createElement('span');brand.className='mf-app-name';brand.textContent='노트플로우';$('btn-side').after(brand);
  const settingsButton=document.createElement('button');settingsButton.className='tb';settingsButton.id='mf-settings-button';settingsButton.textContent='⚙';settingsButton.title='설정 · 동기화 · 테마';settingsButton.setAttribute('aria-label','설정');settingsButton.setAttribute('aria-expanded','false');top.append(settingsButton);
  const settings=document.createElement('div');settings.className='mf-settings';settings.hidden=true;top.append(settings);
  [['btn-sync','동기화'],['btn-theme','테마 바꾸기'],['btn-refresh','최신 버전 새로고침'],['btn-home','홈으로']].forEach(([id,label])=>{const el=$(id);el.title=label;el.setAttribute('aria-label',label);const tx=document.createElement('span');tx.className='mf-settings-label';tx.textContent=label;const row=document.createElement('div');row.className='mf-setting-row';row.append(el,tx);tx.onclick=()=>el.click();settings.append(row);el.addEventListener('click',()=>{settings.hidden=true;settingsButton.setAttribute('aria-expanded','false');});});
  // 메모 ↔ 마크다운 모드: +더보기를 없애고 설정(⚙) 안으로 옮김
  (function(){const mb=document.createElement('button');mb.className='tb';mb.id='mf-memo-toggle';mb.textContent='✍️';mb.title='메모 ↔ 마크다운 모드';mb.setAttribute('aria-label','메모 모드');const tx=document.createElement('span');tx.className='mf-settings-label';tx.textContent='메모 ↔ 마크다운 모드';const row=document.createElement('div');row.className='mf-setting-row';row.append(mb,tx);const act=()=>{if(api.memoToggle)api.memoToggle();settings.hidden=true;settingsButton.setAttribute('aria-expanded','false');};mb.onclick=act;tx.onclick=act;settings.append(row);})();
  settingsButton.onclick=()=>{settings.hidden=!settings.hidden;settingsButton.setAttribute('aria-expanded',String(!settings.hidden));};document.addEventListener('mousedown',e=>{if(!settings.contains(e.target)&&!settingsButton.contains(e.target)){settings.hidden=true;settingsButton.setAttribute('aria-expanded','false');}});
  const wrap=document.querySelector('.editor-wrap'),column=document.createElement('div');column.className='mf-writing-column';wrap.before(column);column.append(wrap);
  const toolbar=document.createElement('div');toolbar.className='mf-organized-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','글쓰기 도구');column.prepend(toolbar);
  function group(label){const el=document.createElement('div');el.className='mf-tool-group';el.setAttribute('role','group');el.setAttribute('aria-label',label);toolbar.append(el);return el;}
  const history=group('되돌리기');history.append($('btn-undo'),$('btn-redo'));
  // 목차·집중모드를 상단 바에서 도구막대(기능 쪽)로 옮긴다 (DOM만 이동 — 기존 클릭 동작 유지)
  const view=group('보기·이동'); ['btn-toc','btn-focus'].forEach(id=>{const el=$(id); if(el){ el.classList.add('mf-action'); view.append(el); }});
  const format=group('글 서식'), structure=group('목록과 구조'), insert=group('넣기 도구');
  function button(parent,label,content,fn,cls=''){const b=document.createElement('button');b.type='button';b.className='mf-action '+cls;b.title=label;b.setAttribute('aria-label',label);b.innerHTML=content;b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=()=>{if(api.isReadOnly()){api.toast('읽기 모드를 끄면 편집할 수 있습니다.');return;}fn(b);};parent.append(b);return b;}
  const style=document.createElement('select');style.id='mf-paragraph-style';style.setAttribute('aria-label','문단 형식');[['p','본문'],['h1','제목 1'],['h2','제목 2'],['h3','제목 3'],['h4','제목 4']].forEach(([v,l])=>style.add(new Option(l,v)));format.append(style);style.onchange=()=>{if(api.isReadOnly())return;api.setBlock(style.value);};

  /* 비슷한 글자 기능을 드롭다운으로 묶는다 (제목 드롭다운처럼). 선택 보존 위해 mousedown preventDefault 사용. */
  const dstyle=document.createElement('style');dstyle.textContent='.mf-dropdown{display:inline-flex;align-items:center;gap:4px;}.mf-caret-dn{font-size:10px;opacity:.65;}.mf-tooldrop{background:var(--bg-elev,#fff);border:1px solid var(--border,#dcdfe4);border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.2);padding:6px;display:flex;flex-direction:column;min-width:168px;}.mf-tooldrop-item{text-align:left;background:transparent;border:0;color:var(--text,#222);font-family:inherit;font-size:14.5px;padding:11px 13px;border-radius:8px;cursor:pointer;white-space:nowrap;}.mf-tooldrop-item:hover{background:var(--bg-soft,#f3f4f6);}#side-listset,#side-diary{display:none!important;}';document.head.append(dstyle);
  function openToolDrop(anchorBtn,items){
    document.querySelector('.mf-tooldrop')?.remove();
    const r=anchorBtn.getBoundingClientRect();
    const m=document.createElement('div');m.className='mf-tooldrop';
    items.forEach(it=>{const row=document.createElement('button');row.type='button';row.className='mf-tooldrop-item';row.textContent=it[0];row.addEventListener('mousedown',e=>{e.preventDefault();m.remove();it[1](r);});m.append(row);});
    // 먼저 fixed로 화면 밖에 붙여 '내용 폭'을 정확히 잰 뒤 버튼 아래로 위치시킨다(안 그러면 전체폭으로 측정돼 항상 왼쪽에 뜸).
    m.style.cssText='position:fixed;z-index:240;left:-9999px;top:0;visibility:hidden;';
    document.body.append(m);
    const w=m.offsetWidth||188,h=m.offsetHeight||200;let left=Math.max(8,Math.min(r.left,innerWidth-w-8));let top=r.bottom+6;if(top+h>innerHeight-8)top=Math.max(8,r.top-h-6);
    m.style.left=left+'px';m.style.top=top+'px';m.style.visibility='';
    setTimeout(()=>{const close=e=>{if(!m.contains(e.target)&&!anchorBtn.contains(e.target)){m.remove();document.removeEventListener('mousedown',close);}};document.addEventListener('mousedown',close);},0);
  }
  function dropdown(parent,label,items){const b=document.createElement('button');b.type='button';b.className='mf-action mf-dropdown';b.title=label;b.setAttribute('aria-label',label);b.innerHTML='<span>'+label+'</span><span class="mf-caret-dn">▾</span>';b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=()=>{if(api.isReadOnly()){api.toast('읽기 모드를 끄면 편집할 수 있습니다.');return;}openToolDrop(b,items);};parent.append(b);return b;}
  // 자주 쓰는 순서대로: 서식 · 색 · 목록 · 넣기 · 장식선
  dropdown(format,'서식',[['굵게',()=>api.exec('bold')],['기울임',()=>api.exec('italic')],['취소선',()=>api.exec('strike')],['이모지',r=>api.emoji&&api.emoji(r)]]);
  dropdown(format,'색',[['형광펜',r=>api.highlight(r)],['글자색',r=>api.textColor&&api.textColor(r)],['글자 크기·인용색',r=>api.textSize&&api.textSize(r)]]);

  // 목록 드롭다운 (사이드바에서 툴바로 이동): 글머리·체크박스·번호·인용·번호 모양
  dropdown(structure,'목록',[['글머리 목록',()=>api.bulletList?api.bulletList():api.bullet()],['체크박스',()=>api.checklist&&api.checklist()],['번호 목록',()=>api.numberList&&api.numberList()],['인용',()=>api.quote&&api.quote()],['목록 번호 모양…',()=>api.listSettings&&api.listSettings(document.querySelector('.mf-organized-toolbar [aria-label="목록"]'))]]);
  button(structure,'내어쓰기','⇤',api.outdent);button(structure,'들여쓰기','⇥',api.indent);button(structure,'모두 접기 / 펼치기','⌃⌄',api.fold);

  // 넣기 드롭다운: 사진·링크·콜아웃·표·동영상
  dropdown(insert,'넣기',[['사진',()=>api.photos()],['링크',()=>api.link()],['콜아웃',r=>api.callout&&api.callout(r)],['표',r=>api.table&&api.table(r)],['동영상',()=>api.video()]]);
  // 장식선 드롭다운: 구분선·가운데 장식선·장식 구분선
  dropdown(insert,'장식선',[['구분선',()=>api.divider&&api.divider()],['가운데 장식선',()=>api.centerLine&&api.centerLine()],['장식 구분선',()=>api.decoLine&&api.decoLine()]]);
  // +더보기 버튼은 제거(줄 형식은 제목·목록 드롭다운과 중복, 메모 모드는 ⚙설정으로 이동). 새 기능이 필요하면 다시 만든다.
  const draw=paths=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
  settingsButton.innerHTML=draw('<path d="m9 3-1 3-3 1v4l-2 1 2 1v4l3 1 1 3h6l1-3 3-1v-4l2-1-2-1V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>');
  api.onCaret(()=>{style.value=api.blockType();});
  $('btn-view').addEventListener('click',()=>setTimeout(()=>{toolbar.querySelectorAll('button,select').forEach(b=>b.disabled=api.isReadOnly());},0));
  document.querySelectorAll('.topbar .tb').forEach(el=>{if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',el.title||el.textContent);});
  window.markflowCosts?.mount();
  const version=document.querySelector('.status');if(version){const nodes=[...version.querySelectorAll('*')];const old=nodes.find(el=>el.children.length===0&&el.textContent.trim()==='v3.8');if(old)old.textContent='v3.9.2';}
};
