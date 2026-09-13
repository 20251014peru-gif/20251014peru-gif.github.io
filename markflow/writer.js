/* MarkFlow 4.0 — local writing, outline and small video attachments. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'markflow_writer_v4', LEGACY = 'markflow_wysiwyg_v1';
  const paths = {
    panel:'M4 3h16v18H4z M9 3v18', focus:'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',
    export:'M12 15V3 M8 7l4-4 4 4 M4 13v7h16v-7', search:'M20 20l-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    folder:'M3 6h7l2 2h9v12H3z M16 11v6 M13 14h6', plus:'M12 5v14 M5 12h14',
    undo:'M8 4L3 9l5 5 M3 9h11a6 6 0 0 1 0 12', redo:'M16 4l5 5-5 5 M21 9H10a6 6 0 0 0 0 12',
    list:'M8 6h13 M8 12h13 M8 18h13 M3 6h.1 M3 12h.1 M3 18h.1', quote:'M4 5h6v8H4z M10 13c0 4-2 6-5 6 M14 5h6v8h-6z M20 13c0 4-2 6-5 6',
    link:'M10 14l4-4 M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0 M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
    video:'M3 5h13v14H3z M16 10l5-3v10l-5-3', check:'M4 5h11 M4 10h8 M4 15h5 M12 17l3 3 6-7',
    more:'M5 12h.1 M12 12h.1 M19 12h.1', close:'M6 6l12 12 M18 6L6 18', doc:'M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h6'
  };
  function icon(name) { const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.doc);s.append(p);return s; }
  document.querySelectorAll('[data-icon]').forEach(el=>el.append(icon(el.dataset.icon)));
  const uid=()=>crypto.randomUUID ? crypto.randomUUID() : 'd'+Date.now().toString(36)+Math.random().toString(36).slice(2);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state, editor, db, dirty=false, serial=0, timer, saveChain=Promise.resolve(), readOnly=false, initializing=true;
  let tocSignature=null, lastFocus, titleEditing=false, mediaBusy=false;
  const blobURLs=new Map();
  function toast(message) { $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3800); }
  function notice(message) { $('notice').textContent=message;$('notice').hidden=!message; }
  function status(message,error=false) { $('save-status').textContent=message;$('save-status').classList.toggle('error',error); }
  function localRead(key) { try{return localStorage.getItem(key);}catch{return null;} }
  function parse(raw) { if(!raw)return null;const s=typeof raw==='string'?JSON.parse(raw):raw;if(!s||!Array.isArray(s.docs)||s.docs.some(d=>!d||typeof d.content!=='string'||typeof d.id!=='string'))throw Error('저장 형식을 읽을 수 없습니다');return s; }
  function openDB() { return new Promise((resolve,reject)=>{const r=indexedDB.open('markflow_db',2);r.onupgradeneeded=()=>{for(const n of ['kv','media'])if(!r.result.objectStoreNames.contains(n))r.result.createObjectStore(n);};r.onsuccess=()=>{db=r.result;db.onversionchange=()=>db.close();resolve(db);};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('다른 창에서 저장소를 사용 중입니다'));}); }
  function get(store,key) { return new Promise((resolve,reject)=>{if(!db)return resolve(null);const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); }
  function put(store,key,value) { return new Promise((resolve,reject)=>{if(!db)return reject(Error('기기 저장소를 사용할 수 없습니다'));const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error||Error('저장 실패'));}); }
  const current=()=>state.docs.find(d=>d.id===state.currentId);
  function newDoc(title='',content='',folder='') {return {id:uid(),title,content,folder,updated:Date.now()};}
  function normalize(s,legacy=false) {
    const docs=s.docs.map(d=>{let title=typeof d.title==='string'?d.title:'',content=d.content;
      if(legacy){const m=content.match(/^#\s+([^\n]+)\n?/);if(m){title=m[1];content=content.slice(m[0].length).replace(/^\n/,'');}else title=content.split('\n').find(l=>l.trim()&&!/^⟦vid/.test(l))?.replace(/^#+\s*|[*_`]/g,'').slice(0,80)||'';}
      return {...d,title,content,folder:typeof d.folder==='string'?d.folder:'',updated:Number(d.updated)||0};});
    if(!docs.length)docs.push(newDoc());
    return {...s,version:4,docs,currentId:docs.some(d=>d.id===s.currentId)?s.currentId:docs[0].id,folders:[...new Set([...(s.folders||[]).filter(f=>typeof f==='string'),...docs.map(d=>d.folder).filter(Boolean)])]};
  }
  // Full text snapshots are synchronous; IndexedDB writes remain ordered and report transaction completion.
  function cacheSnapshot() {try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{return false;} }
  function changed() {if(readOnly||initializing)return;dirty=true;serial++;state.savedAt=Date.now();cacheSnapshot();status('저장 중…');clearTimeout(timer);timer=setTimeout(persist,400);}
  function persist() {
    clearTimeout(timer);if(!state||readOnly||initializing||!dirty)return saveChain;
    const seq=serial,snapshot=JSON.stringify(state),localOK=cacheSnapshot();
    saveChain=saveChain.catch(()=>{}).then(async()=>{let ok=localOK;try{await put('kv',KEY,snapshot);ok=true;}catch{}
      if(seq!==serial)return;
      if(ok){dirty=false;status('자동 저장됨');}else{status('저장 실패',true);notice('저장 공간이 부족하거나 저장이 차단되었습니다. 내보내기로 글을 보관해 주세요.');}
    });return saveChain;
  }
  const cleanMD=md=>md.replace(/\$\$widget\d+ (⟦(?:vid [^⟧]+|vidfile:[\w-]+)⟧)\$\$/g,'$1');
  function capture() {if(editor&&!readOnly&&!initializing){current().content=cleanMD(editor.getMarkdown());current().title=$('document-title').value;} }
  function flush() {if(!dirty)return;capture();cacheSnapshot();persist();}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
  window.addEventListener('pagehide',flush);
  window.addEventListener('beforeunload',e=>{flush();if(dirty){e.preventDefault();e.returnValue='';}});
  function sidebar(open) {document.body.classList.toggle('sidebar-closed',!open);$('sidebar-toggle').setAttribute('aria-expanded',String(open));$('backdrop').hidden=!(open&&innerWidth<=760);}
  function tab(name) {for(const n of ['documents','outline']){$(n+'-tab').setAttribute('aria-selected',String(n===name));$(n+'-panel').hidden=n!==name;}}
  $('sidebar-toggle').onclick=()=>{document.body.classList.remove('focus-mode');$('focus-toggle').setAttribute('aria-pressed','false');sidebar(document.body.classList.contains('sidebar-closed'));};
  $('backdrop').onclick=()=>sidebar(false);
  $('documents-tab').onclick=()=>tab('documents');$('outline-tab').onclick=()=>{tab('outline');renderOutline();};
  $('focus-toggle').onclick=()=>{const on=document.body.classList.toggle('focus-mode');$('focus-toggle').setAttribute('aria-pressed',String(on));$('sidebar-toggle').setAttribute('aria-expanded',String(!on&&!document.body.classList.contains('sidebar-closed')));};
  window.addEventListener('resize',()=>{$('backdrop').hidden=innerWidth>760||document.body.classList.contains('sidebar-closed');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('export-menu').open=false;if(innerWidth<=760)sidebar(false);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();flush();}});
  document.addEventListener('click',e=>{if(!$('export-menu').contains(e.target))$('export-menu').open=false;});
  function renderFolders() {const filter=$('folder-filter'),v=filter.value;filter.replaceChildren();for(const [value,label]of [['*','모든 글'],['','미분류'],...state.folders.map(f=>[f,f])]){const o=new Option(label,value);filter.add(o);}filter.value=[...filter.options].some(o=>o.value===v)?v:'*';$('folder-name').textContent=current().folder||'미분류';}
  function renderDocs() {
    $('doc-count').textContent=state.docs.length;const q=$('search').value.trim().toLocaleLowerCase(),folder=$('folder-filter').value;
    const docs=state.docs.filter(d=>(folder==='*'||d.folder===folder)&&(!q||(d.title+'\n'+d.content).toLocaleLowerCase().includes(q))).sort((a,b)=>b.updated-a.updated);
    $('document-list').replaceChildren();
    if(!docs.length){const p=document.createElement('p');p.className='empty-state';p.textContent='찾는 글이 없습니다.';$('document-list').append(p);}
    docs.forEach(d=>{const row=document.createElement('div');row.className='doc-row'+(d.id===state.currentId?' active':'');row.dataset.id=d.id;const b=document.createElement('button');b.className='doc-open';b.title=(d.title||'제목 없는 글')+(d.folder?' · '+d.folder:'');b.setAttribute('aria-current',String(d.id===state.currentId));const tx=document.createElement('span');tx.className='doc-title';tx.textContent=d.title||'제목 없는 글';b.append(icon('doc'),tx);b.onclick=()=>openDoc(d.id);const menu=document.createElement('button');menu.className='icon-button';menu.setAttribute('aria-label',(d.title||'제목 없는 글')+' 관리');menu.append(icon('more'));menu.onclick=()=>docOptions(d.id);row.append(b,menu);$('document-list').append(row);});
  }
  $('search').oninput=renderDocs;$('folder-filter').onchange=renderDocs;
  function openDialog(title,body,actions=[]) {lastFocus=document.activeElement;$('dialog-title').textContent=title;$('dialog-body').replaceChildren();if(typeof body==='string')$('dialog-body').innerHTML=body;else $('dialog-body').append(body);$('dialog-actions').replaceChildren();actions.forEach(a=>{const b=document.createElement('button');b.type=a.submit?'submit':'button';b.textContent=a.label;b.className=a.className||'';if(a.submit)$('dialog-form').onsubmit=e=>{e.preventDefault();a.run();};else b.onclick=a.run;$('dialog-actions').append(b);});if(!actions.some(a=>a.submit))$('dialog-form').onsubmit=e=>e.preventDefault();$('dialog').showModal();}
  const closeDialog=()=>$('dialog').close();$('dialog-close').onclick=closeDialog;$('dialog').addEventListener('close',()=>lastFocus?.focus());
  function allowEdit(){if(readOnly){toast('다른 MarkFlow 창을 닫고 새로고침하면 편집할 수 있습니다.');return false;}return !!editor;}
  function addDoc() {if(!allowEdit())return;capture();const d=newDoc('','',$('folder-filter').value==='*'?'':$('folder-filter').value);state.docs.push(d);openDoc(d.id);changed();$('document-title').focus();}
  $('new-document').onclick=addDoc;
  $('folder-add').title='폴더 만들기 / 관리';$('folder-add').setAttribute('aria-label','폴더 만들기 / 관리');
  $('folder-add').onclick=()=>{if(!allowEdit())return;const selected=$('folder-filter').value,existing=selected&&selected!=='*';const actions=[];
    if(existing)actions.push({label:'선택 폴더 삭제',className:'danger',run:()=>{closeDialog();openDialog('폴더를 삭제할까요?','<p>'+esc(selected)+' 폴더의 글은 미분류로 이동하며 삭제되지 않습니다.</p>',[{label:'취소',run:closeDialog},{label:'폴더 삭제',className:'danger',run:()=>{state.folders=state.folders.filter(f=>f!==selected);state.docs.forEach(d=>{if(d.folder===selected)d.folder='';});renderFolders();renderDocs();changed();closeDialog();}}]);}});
    actions.push({label:'만들기',className:'primary',submit:true,run:()=>{const name=$('folder-input').value.trim();if(!name)return;if(name==='*'||state.folders.includes(name)){toast('다른 폴더 이름을 입력해 주세요.');return;}state.folders.push(name);renderFolders();$('folder-filter').value=name;renderDocs();changed();closeDialog();}});
    openDialog('폴더 만들기 / 관리','<label for="folder-input">새 폴더 이름</label><input id="folder-input" maxlength="60" required autofocus>'+(existing?'<p>현재 선택: '+esc(selected)+'</p>':'<p>폴더를 지우려면 목록에서 해당 폴더를 선택한 뒤 이 창을 여세요.</p>'),actions);
  };
  function docOptions(id) {if(!allowEdit())return;const d=state.docs.find(d=>d.id===id);openDialog('글 관리','<label for="rename-input">글 제목</label><input id="rename-input" maxlength="240" value="'+esc(d.title)+'"><label for="move-folder">폴더</label><select id="move-folder"><option value="">미분류</option>'+state.folders.map(f=>'<option value="'+esc(f)+'"'+(f===d.folder?' selected':'')+'>'+esc(f)+'</option>').join('')+'</select>',[
      {label:'삭제',className:'danger',run:()=>{closeDialog();openDialog('이 글을 삭제할까요?','<p>'+esc(d.title||'제목 없는 글')+'</p><p>삭제 직후 아래 알림에서 복원할 수 있습니다.</p>',[{label:'취소',run:closeDialog},{label:'삭제',className:'danger',run:()=>{state.docs=state.docs.filter(x=>x.id!==id);if(!state.docs.length)state.docs.push(newDoc());if(state.currentId===id){state.currentId=state.docs[0].id;mountEditor();}renderFolders();renderDocs();changed();closeDialog();$('toast').replaceChildren(document.createTextNode('글을 삭제했습니다. '));const undo=document.createElement('button');undo.textContent='복원';undo.style.color='white';undo.style.textDecoration='underline';undo.onclick=()=>{state.docs.push(d);renderDocs();changed();$('toast').hidden=true;};$('toast').append(undo);$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,15000);}}]);}},
      {label:'저장',className:'primary',submit:true,run:()=>{d.title=$('rename-input').value.trim();d.folder=$('move-folder').value;d.updated=Date.now();if(d.id===state.currentId)$('document-title').value=d.title;renderFolders();renderDocs();changed();closeDialog();}}
    ]); }
  $('document-options').onclick=()=>docOptions(state.currentId);
  function openDoc(id) {if(id===state.currentId){if(innerWidth<=760)sidebar(false);return;}capture();state.currentId=id;mountEditor();renderFolders();renderDocs();changed();if(innerWidth<=760)sidebar(false);}
  function mediaURL(text) {const m=text.match(/^⟦vid ([^⟧]+)⟧$/);if(!m)return '';try{return decodeURIComponent(escape(atob(m[1])));}catch{return '';}}
  function youtube(url) {try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))return null;let id;if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)){id=u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];}else if(u.hostname==='youtu.be')id=u.pathname.slice(1);return /^[\w-]{11}$/.test(id||'')?id:null;}catch{return null;}}
  function safeURL(url) {try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
  async function blobURL(id) {if(blobURLs.has(id))return blobURLs.get(id);const blob=await get('media',id);if(!blob)return null;const url=URL.createObjectURL(blob);blobURLs.set(id,url);return url;}
  function mediaWidget(text) {
    const card=document.createElement('span');card.className='media-card';card.contentEditable='false';card.dataset.marker=text;
    const local=text.match(/^⟦vidfile:([\w-]+)⟧$/),url=mediaURL(text),yt=youtube(url);
    const caption=document.createElement('span');caption.className='media-caption';caption.textContent=local?'첨부 영상 · 이 기기에 저장':yt?'YouTube':'영상 링크';
    const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';remove.disabled=readOnly;remove.onclick=e=>{e.preventDefault();removeMarker(text);};caption.append(remove);card.append(caption);
    if(local){const label=document.createElement('span');label.textContent='영상을 불러오는 중…';card.append(label);blobURL(local[1]).then(src=>{label.remove();if(!src){const p=document.createElement('span');p.textContent='이 기기에 영상 파일이 없습니다. 원래 기기의 전체 백업으로 가져올 수 있습니다.';card.append(p);return;}const v=document.createElement('video');v.src=src;v.controls=true;v.playsInline=true;v.preload='metadata';v.onerror=()=>{v.title='이 브라우저가 재생하지 못하는 영상 형식입니다.';};card.append(v);const a=document.createElement('a');a.href=src;a.download='video-'+local[1]+'.mp4';a.textContent='영상 파일 저장';card.append(a);}).catch(()=>{label.textContent='영상 저장소를 열 수 없습니다.';});}
    else if(yt){const play=document.createElement('button');play.type='button';play.textContent='▶ 여기서 재생';play.onclick=e=>{e.preventDefault();const f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+yt;f.title='YouTube 영상';f.allow='encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';card.append(f);play.remove();};card.append(play);const a=document.createElement('a');a.href='https://www.youtube.com/watch?v='+yt;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' YouTube에서 보기';card.append(a);}
    else if(safeURL(url)){const a=document.createElement('a');a.href=safeURL(url);a.target='_blank';a.rel='noopener noreferrer';a.textContent=url;card.append(a);}else card.append(document.createTextNode('영상 주소를 확인해 주세요.'));
    return card;
  }
  function removeMarker(text) {if(!allowEdit())return;const v=editor.wwEditor.view;let range=null;v.state.doc.descendants((n,pos)=>{if(!range&&n.type.name==='widget'&&cleanMD(n.textContent)===text){range=[pos,pos+n.nodeSize];return false;}});if(!range)v.state.doc.descendants((n,pos)=>{if(!range&&n.isTextblock&&n.textContent===text){range=[pos,pos+n.nodeSize];return false;}});if(range){v.dispatch(v.state.tr.delete(...range));toast('영상을 글에서 지웠습니다. 실행취소로 되돌릴 수 있습니다.');}}
  function mountEditor() {
    initializing=true;editor?.destroy();for(const u of blobURLs.values())URL.revokeObjectURL(u);blobURLs.clear();$('editor').replaceChildren();
    $('document-title').value=current().title;$('document-title').disabled=readOnly;
    editor=new toastui.Editor({el:$('editor'),height:'auto',minHeight:'320px',initialEditType:'wysiwyg',hideModeSwitch:true,toolbarItems:[],usageStatistics:false,autofocus:false,initialValue:current().content,placeholder:'여기에 글을 써 보세요…',linkAttributes:{target:'_blank',rel:'noopener noreferrer'},widgetRules:[{rule:/⟦(?:vid [^⟧]+|vidfile:[\w-]+)⟧/,toDOM:mediaWidget}],hooks:{addImageBlobHook:()=>{toast('사진은 기존 글에서만 표시합니다. 새 첨부는 영상 버튼을 이용하세요.');return false;}}});
    const pm=$('editor').querySelector('.toastui-editor-ww-container .ProseMirror');pm.setAttribute('spellcheck','true');pm.setAttribute('lang','ko');pm.setAttribute('aria-label','글 본문');if(readOnly)editor.wwEditor.view.setProps({editable:()=>false});
    editor.on('change',()=>{if(initializing||readOnly)return;current().content=cleanMD(editor.getMarkdown());current().updated=Date.now();changed();updateTextInfo();});
    // Loading a document is not an undoable edit; retain only this document's subsequent edits.
    const view=editor.wwEditor.view,plugins=view.state.plugins;
    const histories=plugins.filter(p=>{const s=p.getState?.(view.state);return s&&s.done&&s.undone;});
    if(histories.length){view.updateState(view.state.reconfigure({plugins:plugins.filter(p=>!histories.includes(p))}));view.updateState(view.state.reconfigure({plugins}));}
    editor.on('caretChange',updateToolbar);initializing=false;tocSignature=null;updateTextInfo();$('page-scroll').scrollTop=0;
  }
  $('document-title').oninput=()=>{if(!allowEdit())return;current().title=$('document-title').value;current().updated=Date.now();changed();renderDocs();};
  $('document-title').onfocus=()=>titleEditing=true;$('document-title').onblur=()=>titleEditing=false;
  $('toolbar').addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault();});
  document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{if(!allowEdit())return;if(titleEditing&&['undo','redo'].includes(b.dataset.command)){document.execCommand(b.dataset.command);return;}editor.exec(b.dataset.command);editor.focus();updateToolbar();});
  $('block-style').onchange=()=>{if(!allowEdit())return;const level=Number($('block-style').value);editor.exec(level?'heading':'paragraph',level?{level}:undefined);editor.focus();};
  function updateToolbar() {if(!editor)return;const s=editor.wwEditor.view.state,from=s.selection.$from,n=from.parent;$('block-style').value=n.type.name==='heading'?String(n.attrs.level):'0';for(const b of document.querySelectorAll('[data-command]'))b.disabled=readOnly;}
  function updateTextInfo() {const txt=cleanMD(editor.wwEditor.view.state.doc.textContent).replace(/⟦[^⟧]+⟧/g,'');$('char-count').textContent=(current().title.length+txt.length).toLocaleString()+'자';renderOutline();const active=$('document-list').querySelector('.active .doc-title');if(active)active.textContent=current().title||'제목 없는 글';}
  function headings() {return [...$('editor').querySelectorAll('.toastui-editor-ww-container .ProseMirror h1,.toastui-editor-ww-container .ProseMirror h2,.toastui-editor-ww-container .ProseMirror h3')];}
  function renderOutline() {const hs=headings(),sig=hs.map(h=>h.tagName+':'+h.textContent).join('|');hs.forEach((h,i)=>h.id='section-'+i);if(sig===tocSignature)return;tocSignature=sig;$('outline').replaceChildren();if(!hs.length){const p=document.createElement('p');p.className='empty-state';p.textContent='아직 목차가 없습니다. 본문에서 문단 서식을 제목 1·2·3으로 바꿔 보세요.';$('outline').append(p);}hs.forEach((h,i)=>{const a=document.createElement('a');a.href='#section-'+i;a.className='toc-entry level-'+h.tagName.slice(1);a.textContent=h.textContent||'빈 제목';a.onclick=e=>{e.preventDefault();h.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});if(innerWidth<=760)sidebar(false);};$('outline').append(a);});}
  $('page-scroll').addEventListener('scroll',()=>{const hs=headings(),top=$('page-scroll').getBoundingClientRect().top+60;let index=0;hs.forEach((h,i)=>{if(h.getBoundingClientRect().top<=top)index=i;});$('outline').querySelectorAll('a').forEach((a,i)=>a.classList.toggle('active',i===index));},{passive:true});
  $('link-button').onclick=()=>{if(!allowEdit())return;const selection=editor.getSelection();openDialog('링크 넣기','<label for="link-text">표시할 글</label><input id="link-text" value="'+esc(editor.getSelectedText())+'"><label for="link-url">주소</label><input id="link-url" type="url" placeholder="https://" required>',[{label:'넣기',className:'primary',submit:true,run:()=>{const u=safeURL($('link-url').value);if(!u){toast('http 또는 https 주소를 입력하세요.');return;}const text=$('link-text').value||u;closeDialog();editor.setSelection(...selection);editor.exec('addLink',{linkText:text,linkUrl:u});editor.focus();}}]);};
  function insertMarker(marker) {const v=editor.wwEditor.view,$f=v.state.selection.$from;const pos=$f.depth?$f.after(1):v.state.doc.content.size;const schema=v.state.schema,paragraph=schema.nodes.paragraph,widget=schema.nodes.widget.create({info:'widget0'},schema.text('$$widget0 '+marker+'$$'));v.dispatch(v.state.tr.insert(pos,[paragraph.create(null,widget),paragraph.create()]));editor.focus();}
  $('video-button').onclick=()=>{if(!allowEdit())return;openDialog('영상 넣기','<label for="youtube-url">유튜브 링크</label><input id="youtube-url" type="url" placeholder="https://youtu.be/…"><p>유튜브는 본문에서 눌러 재생할 수 있습니다.</p><hr><button id="choose-video" class="dialog-button" type="button">기기에서 짧은 영상 첨부</button><p>파일당 50MB까지 · 이 브라우저에 저장됩니다.<br>다른 기기로 옮길 때는 전체 글 백업을 이용하세요.</p>',[{label:'유튜브 넣기',className:'primary',submit:true,run:()=>{const id=youtube($('youtube-url').value.trim());if(!id){toast('올바른 유튜브 영상 주소를 입력하세요.');return;}closeDialog();insertMarker('⟦vid '+btoa('https://www.youtube.com/watch?v='+id)+'⟧');}}]);$('choose-video').onclick=()=>{$('video-file').value='';$('video-file').click();};};
  $('video-file').onchange=async()=>{const file=$('video-file').files[0];if(!file||!allowEdit())return;if(!file.type.startsWith('video/')){toast('영상 파일을 선택하세요.');return;}if(file.size>50*1024*1024){toast('50MB 이하의 짧은 영상을 선택하세요.');return;}if(mediaBusy)return;mediaBusy=true;const id='v'+uid().replace(/-/g,''),docId=state.currentId;closeDialog();toast('영상을 기기에 저장하는 중…');try{await put('media',id,file);if(state.currentId===docId)insertMarker('⟦vidfile:'+id+'⟧');else{const target=state.docs.find(d=>d.id===docId);if(target){target.content+='\n\n⟦vidfile:'+id+'⟧\n';changed();}}toast('영상을 저장했습니다.');}catch{toast('영상 저장에 실패했습니다. 저장 공간을 확인해 주세요.');}finally{mediaBusy=false;}};
  // Deliberately small, deterministic suggestions. No paid API, automatic rewrites or remote text submission.
  const spellingRules=[['몇일','며칠'],['왠만','웬만'],['오랫만','오랜만'],['금새','금세'],['설레임','설렘'],['어의없','어이없'],['희안','희한'],['되요','돼요'],['됬','됐'],['뵈요','봬요'],['역활','역할'],['어떻해','어떡해'],['일일히','일일이'],['꼼꼼이','꼼꼼히'],['곰곰히','곰곰이'],['웬지','왠지']];
  $('spelling-button').onclick=()=>{if(!allowEdit())return;const wrap=document.createElement('div');const intro=document.createElement('p');intro.textContent='무료 기본 점검 · 흔한 오타만 제안합니다. 문맥·띄어쓰기 전체 검사는 아니며, 본문을 외부로 보내지 않습니다. 브라우저 맞춤법 밑줄은 언어 설정에 따라 달라집니다.';wrap.append(intro);let count=0;
    editor.wwEditor.view.state.doc.descendants((n,pos)=>{if(!n.isText||n.marks.some(m=>['code','link'].includes(m.type.name)))return;for(const [bad,good]of spellingRules){let at=n.text.indexOf(bad);while(at>=0&&count<80){const from=pos+at,to=from+bad.length;count++;const row=document.createElement('div');row.className='spell-item';const text=document.createElement('span');text.textContent=bad+' → '+good;const context=document.createElement('small');context.textContent=n.text.slice(Math.max(0,at-12),at+bad.length+16);text.append(context);const b=document.createElement('button');b.textContent='적용';b.onclick=()=>{const v=editor.wwEditor.view;if(v.state.doc.textBetween(from,to)!==bad){closeDialog();toast('글이 바뀌었습니다. 맞춤법을 다시 점검해 주세요.');return;}v.dispatch(v.state.tr.insertText(good,from,to));closeDialog();toast('수정했습니다. 실행취소로 되돌릴 수 있습니다.');};row.append(text,b);wrap.append(row);at=n.text.indexOf(bad,at+bad.length);}}});
    if(!count){const p=document.createElement('p');p.textContent='기본 점검에서 제안할 오타를 찾지 못했습니다. 모든 맞춤법이 정확하다는 뜻은 아닙니다.';wrap.append(p);}openDialog('기본 맞춤법',wrap);};
  function download(name,content,type) {const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  const fileName=()=> (current().title||'제목 없는 글').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,100);
  const fullMD=()=> '# '+(current().title||'제목 없는 글')+'\n\n'+cleanMD(editor.getMarkdown());
  const toDataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
  async function portableMarkdown() {let md=fullMD();const files=[...new Set([...md.matchAll(/⟦vidfile:([\w-]+)⟧/g)].map(m=>m[1]))];for(const id of files){const blob=await get('media',id);if(!blob)throw Error('첨부 영상이 없어 내보내기를 완료할 수 없습니다.');const name='video-'+id+'.'+(blob.type.includes('webm')?'webm':blob.type.includes('quicktime')?'mov':'mp4');download(name,blob);md=md.split('⟦vidfile:'+id+'⟧').join('[첨부 영상]('+name+')');}md=md.replace(/⟦vid ([^⟧]+)⟧/g,m=>'[영상 보기]('+safeURL(mediaURL(m))+')');return md;}
  async function exportHTML(portable) {const host=document.createElement('div');host.innerHTML=editor.getHTML();host.querySelectorAll('.media-card').forEach(card=>card.replaceWith(document.createTextNode(card.dataset.marker||'')));host.querySelectorAll('.tui-widget').forEach(w=>w.replaceWith(document.createTextNode(cleanMD(w.textContent))));
    // getHTML emits widget text; replace only text nodes, never arbitrary HTML from a stored URL.
    const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())if(/⟦(?:vid |vidfile:)/.test(walker.currentNode.textContent))nodes.push(walker.currentNode);
    for(const node of nodes){const frag=document.createDocumentFragment();const parts=node.textContent.split(/(⟦(?:vid [^⟧]+|vidfile:[\w-]+)⟧)/g);for(const part of parts){if(!/^⟦(?:vid |vidfile:)/.test(part)){frag.append(document.createTextNode(part));continue;}const local=part.match(/^⟦vidfile:([\w-]+)⟧$/);const card=document.createElement('span');card.className='media-card';if(local){if(portable){const blob=await get('media',local[1]);if(!blob)throw Error('첨부 영상 파일이 없습니다.');const v=document.createElement('video');v.controls=true;v.setAttribute('playsinline','');v.src=await toDataURL(blob);card.append(v);}const note=document.createElement('span');note.textContent='첨부 영상'+(portable?'':' · 영상은 HTML 내보내기에서 재생할 수 있습니다.');card.append(note);}else{const url=safeURL(mediaURL(part));if(url){const a=document.createElement('a');a.href=url;a.textContent='영상 보기 — '+url;card.append(a);if(portable&&youtube(url)){const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/'+youtube(url);iframe.title='YouTube 영상';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;card.append(iframe);}}}frag.append(card);}node.replaceWith(frag);}
    const hs=[...host.querySelectorAll('h1,h2,h3')];const toc=document.createElement('nav');toc.className='export-toc';const heading=document.createElement('p');heading.textContent='목차';toc.append(heading);hs.forEach((h,i)=>{h.id='heading-'+i;const a=document.createElement('a');a.href='#heading-'+i;a.textContent=h.textContent;a.style.paddingLeft=(Number(h.tagName.slice(1))-1)*16+'px';toc.append(a);});
    return '<h1>'+esc(current().title||'제목 없는 글')+'</h1>'+(hs.length?toc.outerHTML:'')+host.innerHTML;
  }
  const exportStyle='body{font:16px/1.85 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:800px;margin:45px auto;padding:0 24px;color:#273345}h1,h2,h3{line-height:1.5}img,video{max-width:100%;height:auto}iframe{width:100%;aspect-ratio:16/9;border:0}pre{white-space:pre-wrap}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}.export-toc{padding:16px 0;border-bottom:1px solid #ddd}.export-toc a{display:block}a{color:#3976cd}.media-card{display:block;margin:20px 0}video{display:block}@media print{iframe,video{display:none}}';
  document.querySelectorAll('[data-export]').forEach(b=>b.onclick=async()=>{if(!editor)return;$('export-menu').open=false;capture();try{if(b.dataset.export==='md'){download(fileName()+'.md',await portableMarkdown(),'text/markdown;charset=utf-8');toast('Markdown을 내보냈습니다. 첨부 영상 파일도 함께 보관하세요.');}else if(b.dataset.export==='html'){toast('HTML을 준비하고 있습니다…');const html=await exportHTML(true);download(fileName()+'.html','<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(current().title)+'</title><style>'+exportStyle+'</style><body>'+html+'</body></html>','text/html;charset=utf-8');toast('HTML을 내보냈습니다.');}else{$('print-area').innerHTML=await exportHTML(false);window.print();}}catch(e){toast(e.message||'내보내기에 실패했습니다.');}});
  $('backup-all').onclick=async()=>{if(!state)return;$('export-menu').open=false;capture();const snapshot=JSON.parse(JSON.stringify(state));try{toast('영상과 글을 백업하는 중…');const ids=[...new Set(snapshot.docs.flatMap(d=>[...d.content.matchAll(/⟦vidfile:([\w-]+)⟧/g)].map(m=>m[1])))],media={};for(const id of ids){const blob=await get('media',id);if(!blob)throw Error('첨부 영상이 없는 글이 있습니다. 원래 기기에서 전체 백업을 해 주세요.');media[id]=await toDataURL(blob);}download('MarkFlow-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'markflow-backup-v4',state:snapshot,media}),'application/json');toast('전체 글과 영상을 백업했습니다.');}catch(e){toast(e.message||'백업 실패');}};
  $('import-button').onclick=()=>{if(!allowEdit())return;$('export-menu').open=false;$('import-file').value='';$('import-file').click();};
  $('import-file').onchange=async()=>{const file=$('import-file').files[0];if(!file||!allowEdit())return;try{if(file.size>200*1024*1024)throw Error('200MB 이하의 파일을 선택하세요.');const text=await file.text();if(file.name.toLowerCase().endsWith('.json')){const data=JSON.parse(text);const s=normalize(parse(data.state||data),data.format!=='markflow-backup-v4'&&data.version!==4);const map=new Map();for(const [oldId,value]of Object.entries(data.media||{})){if(typeof value!=='string'||!/^data:video\/[\w.+-]+;base64,/.test(value))throw Error('영상 백업 형식이 올바르지 않습니다.');const id='v'+uid().replace(/-/g,''),[meta,b64]=value.split(',');const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));await put('media',id,new Blob([bytes],{type:meta.slice(5).split(';')[0]}));map.set(oldId,id);}const added=s.docs.map(d=>({...d,id:uid(),updated:Date.now(),content:d.content.replace(/⟦vidfile:([\w-]+)⟧/g,(m,id)=>map.has(id)?'⟦vidfile:'+map.get(id)+'⟧':m)}));state.docs.push(...added);state.folders=[...new Set([...state.folders,...s.folders])];renderFolders();openDoc(added[0].id);changed();toast(added.length+'개 글을 추가로 가져왔습니다.');}else{const m=text.match(/^#\s+([^\n]+)\n?/);const d=newDoc(m?m[1]:file.name.replace(/\.[^.]+$/,''),m?text.slice(m[0].length).replace(/^\n/,''):text);state.docs.push(d);openDoc(d.id);changed();toast('글을 가져왔습니다.');}}catch(e){toast(e.message||'파일을 읽을 수 없습니다.');}};
  async function start() {
    // A second tab stays readable; it cannot overwrite a concurrently edited whole-library snapshot.
    if(navigator.locks){await new Promise(resolve=>{navigator.locks.request('markflow-writer-v4',{ifAvailable:true},lock=>{readOnly=!lock;resolve();if(lock)return new Promise(()=>{});}).catch(()=>resolve());});}
    if(readOnly)notice('다른 MarkFlow 창에서 편집 중입니다. 이 창은 읽기 전용입니다. 다른 창을 닫은 후 새로고침하세요.');
    let idbError=false;try{await openDB();}catch{idbError=true;}
    const errors=[];function readValid(raw){try{return parse(raw);}catch(e){errors.push(e);return null;}}
    const local=readValid(localRead(KEY));let saved=null;try{saved=readValid(await get('kv',KEY));}catch{idbError=true;}
    if(local||saved){state=normalize((local?.savedAt||0)>(saved?.savedAt||0)?local:saved||local);if(errors.length)notice('저장 사본 하나를 읽지 못해 다른 사본으로 글을 복구했습니다. 전체 글 백업을 권장합니다.');}
    else{if(errors.length)throw Error('저장된 글을 읽지 못했습니다. 기존 저장소는 변경하지 않았습니다.');let legacyLocal=readValid(localRead(LEGACY)),legacyDB=null;try{legacyDB=readValid(await get('kv','state'));}catch{idbError=true;}
      if(legacyLocal||legacyDB){const source=(legacyLocal?.savedAt||0)>(legacyDB?.savedAt||0)?legacyLocal:legacyDB||legacyLocal;state=normalize(source,true);if(!readOnly&&db)await put('kv','writer-v4-original-backup',JSON.stringify({local:legacyLocal,idb:legacyDB}));notice('기존 글을 가져왔습니다. 이전 버전의 저장 데이터도 그대로 남겨 두었습니다.');}
      else{if(errors.length||idbError)throw Error('기존 저장소를 확인할 수 없습니다. 다른 MarkFlow 창을 닫고 새로고침해 주세요.');const d=newDoc();state={version:4,docs:[d],folders:[],currentId:d.id,savedAt:0};}
    }
    mountEditor();renderFolders();renderDocs();initializing=false;if(!readOnly){changed();await persist();}else status('읽기 전용');
    if(idbError)notice('기기 저장소를 열지 못해 브라우저의 작은 저장 공간을 사용합니다. 영상 첨부는 사용할 수 없습니다.');
    sidebar(innerWidth>760);
    // Minimal read-only diagnostics, useful when reporting a storage error.
    window.markflowDiagnostics=()=>({version:'4.0.0',documents:state.docs.length,indexedDB:!!db,readOnly,unsaved:dirty});
  }
  start().catch(e=>{readOnly=true;initializing=false;status('불러오기 실패',true);notice(e.message||'글을 불러오지 못했습니다. 새로고침해 주세요.');});
})();
