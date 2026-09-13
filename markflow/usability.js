/* Arrange existing actions without removing features or replacing the editor. */
window.installMarkflowUsability=function(api){
  const $=id=>document.getElementById(id), top=document.querySelector('.topbar');
  document.documentElement.dataset.markflowUi='3.9.1';
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
  const brand=document.createElement('span');brand.className='mf-app-name';brand.textContent='MarkFlow';$('btn-side').after(brand);
  const settingsButton=document.createElement('button');settingsButton.className='tb';settingsButton.id='mf-settings-button';settingsButton.textContent='⚙';settingsButton.title='설정 · 동기화 · 테마';settingsButton.setAttribute('aria-label','설정');settingsButton.setAttribute('aria-expanded','false');top.append(settingsButton);
  const settings=document.createElement('div');settings.className='mf-settings';settings.hidden=true;top.append(settings);
  [['btn-sync','동기화'],['btn-theme','테마 바꾸기'],['btn-refresh','최신 버전 새로고침'],['btn-home','홈으로']].forEach(([id,label])=>{const el=$(id);el.title=label;el.setAttribute('aria-label',label);const tx=document.createElement('span');tx.className='mf-settings-label';tx.textContent=label;const row=document.createElement('div');row.className='mf-setting-row';row.append(el,tx);tx.onclick=()=>el.click();settings.append(row);el.addEventListener('click',()=>{settings.hidden=true;settingsButton.setAttribute('aria-expanded','false');});});
  settingsButton.onclick=()=>{settings.hidden=!settings.hidden;settingsButton.setAttribute('aria-expanded',String(!settings.hidden));};document.addEventListener('mousedown',e=>{if(!settings.contains(e.target)&&!settingsButton.contains(e.target)){settings.hidden=true;settingsButton.setAttribute('aria-expanded','false');}});
  const wrap=document.querySelector('.editor-wrap'),column=document.createElement('div');column.className='mf-writing-column';wrap.before(column);column.append(wrap);
  const toolbar=document.createElement('div');toolbar.className='mf-organized-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','글쓰기 도구');column.prepend(toolbar);
  function group(label){const el=document.createElement('div');el.className='mf-tool-group';el.setAttribute('role','group');el.setAttribute('aria-label',label);toolbar.append(el);return el;}
  const history=group('되돌리기');history.append($('btn-undo'),$('btn-redo'));
  const format=group('글 서식'), list=group('목록과 구조'),insert=group('첨부와 추가');
  function button(parent,label,content,fn,cls=''){const b=document.createElement('button');b.type='button';b.className='mf-action '+cls;b.title=label;b.setAttribute('aria-label',label);b.innerHTML=content;b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=()=>{if(api.isReadOnly()){api.toast('읽기 모드를 끄면 편집할 수 있습니다.');return;}fn(b);};parent.append(b);return b;}
  const style=document.createElement('select');style.id='mf-paragraph-style';style.setAttribute('aria-label','문단 형식');[['p','본문'],['h1','제목 1'],['h2','제목 2'],['h3','제목 3']].forEach(([v,l])=>style.add(new Option(l,v)));format.append(style);style.onchange=()=>{if(api.isReadOnly())return;api.setBlock(style.value);};
  button(format,'굵게','<b>B</b>',()=>api.exec('bold'));button(format,'기울임','<i>I</i>',()=>api.exec('italic'));button(format,'취소선','<s>S</s>',()=>api.exec('strike'));button(format,'형광펜','<span class="mf-highlight-icon">가</span>',b=>api.highlight(b.getBoundingClientRect()));
  button(list,'글머리 목록','☷',api.bullet);button(list,'내어쓰기','⇤',api.outdent);button(list,'들여쓰기','⇥',api.indent);button(list,'모두 접기 / 펼치기','⌃⌄',api.fold);
  button(insert,'사진 넣기','▧',api.photos);button(insert,'동영상 넣기','▷',api.video);button(insert,'링크 넣기','↗',api.link);button(insert,'더보기 · 표·아이콘·추가 서식','<span>＋</span><span class="mf-more-label">더보기</span>',b=>api.more(b.getBoundingClientRect(),b),'mf-more-action');
  const iconPairs=[['글머리 목록','.mf-tbtn.bullet'],['내어쓰기','.mf-tbtn.outdent'],['들여쓰기','.mf-tbtn.indent'],['모두 접기 / 펼치기','.mf-tbtn.foldall'],['사진 넣기','[aria-label="사진 넣기"]']];
  iconPairs.forEach(([label,selector])=>{const src=document.querySelector('#editor '+selector);const dst=[...toolbar.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label);if(src&&dst)dst.innerHTML=src.innerHTML;});
  const draw=paths=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
  toolbar.querySelector('[aria-label="동영상 넣기"]').innerHTML=draw('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4Z"/>');
  toolbar.querySelector('[aria-label="링크 넣기"]').innerHTML=draw('<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M13 17a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" transform="translate(1 -1) scale(.9)"/>');
  settingsButton.innerHTML=draw('<path d="m9 3-1 3-3 1v4l-2 1 2 1v4l3 1 1 3h6l1-3 3-1v-4l2-1-2-1V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>');
  api.onCaret(()=>{style.value=api.blockType();});
  $('btn-view').addEventListener('click',()=>setTimeout(()=>{toolbar.querySelectorAll('button,select').forEach(b=>b.disabled=api.isReadOnly());},0));
  document.querySelectorAll('.topbar .tb').forEach(el=>{if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',el.title||el.textContent);});
  window.markflowCosts?.mount();
  const version=document.querySelector('.status');if(version){const nodes=[...version.querySelectorAll('*')];const old=nodes.find(el=>el.children.length===0&&el.textContent.trim()==='v3.8');if(old)old.textContent='v3.9.1';}
};
