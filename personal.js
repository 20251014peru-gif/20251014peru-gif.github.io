/* ===== 전역 에러 감지 ===== */
var ERR_KEY='personal-errorlog';
function logErr(msg){
  try{var arr=JSON.parse(localStorage.getItem(ERR_KEY)||'[]');
    arr.unshift(new Date().toLocaleString('ko-KR')+'  '+msg);
    localStorage.setItem(ERR_KEY,JSON.stringify(arr.slice(0,30)));}catch(e){}
}
window.onerror=function(m,src,line,col){ logErr(m+' ('+line+':'+col+')'); };
window.addEventListener('unhandledrejection',function(e){ logErr('Promise: '+(e.reason&&e.reason.message||e.reason)); });

/* ===== 잠금 (PIN + 지문) ===== */
var PIN_KEY='personal-pin';
var sessionPin='';   // 현재 세션 PIN (보관함 암호화 열쇠)
var BIO_KEY='personal-bio-enabled';
var pinBuffer='',pinMode='enter'; // enter | set | confirm
var pinFirst='';
function hashPin(s){var h=5381;for(var i=0;i<s.length;i++)h=((h<<5)+h)+s.charCodeAt(i);return 'p'+(h>>>0);}
function hasPin(){return !!localStorage.getItem(PIN_KEY);}
function buildPad(){
  var pad=document.getElementById('pinPad');if(!pad)return;
  var keys=['1','2','3','4','5','6','7','8','9','bio','0','del'];
  pad.innerHTML=keys.map(function(k){
    if(k==='bio')return '<button class="pin-key blank" id="padBio"></button>';
    if(k==='del')return '<button class="pin-key" ontouchstart="pinPress(event,\'del\')" onclick="pinPress(event,\'del\')">⌫</button>';
    return '<button class="pin-key" ontouchstart="pinPress(event,\''+k+'\')" onclick="pinPress(event,\''+k+'\')">'+k+'</button>';
  }).join('');
}
function renderDots(){
  var d=document.getElementById('pinDots');if(!d)return;
  var h='';for(var i=0;i<4;i++)h+='<div class="pin-dot'+(i<pinBuffer.length?' on':'')+'"></div>';
  d.innerHTML=h;
}
function lockMsg(t){var el=document.getElementById('lockMsg');if(el)el.textContent=t||'';}
function setLockText(title,sub){document.getElementById('lockTitle').textContent=title;document.getElementById('lockSub').textContent=sub;}
function pinPress(ev,k){
  // 모바일: touchstart로 즉시 반응 + click 중복 방지
  if(ev){if(ev.type==='touchstart'){ev.preventDefault();window._lastPinTouch=Date.now();}
    else if(ev.type==='click'&&window._lastPinTouch&&Date.now()-window._lastPinTouch<500)return;}
  if(k==='del'){pinBuffer=pinBuffer.slice(0,-1);renderDots();return;}
  if(pinBuffer.length>=4)return;
  pinBuffer+=k;renderDots();
  if(pinBuffer.length===4)setTimeout(pinComplete,40);
}
function pinComplete(){
  if(pinMode==='set'){
    pinFirst=pinBuffer;pinBuffer='';renderDots();pinMode='confirm';
    setLockText('PIN 확인','한 번 더 입력하세요');return;
  }
  if(pinMode==='confirm'){
    if(pinBuffer===pinFirst){
      localStorage.setItem(PIN_KEY,hashPin(pinBuffer));
      sessionPin=pinBuffer;
      unlock();tryEnableBio();
    }else{
      pinBuffer='';pinFirst='';renderDots();pinMode='set';
      setLockText('PIN 설정','맞지 않아요. 새 PIN 4자리를 입력하세요');lockMsg('다시 설정해 주세요');
    }
    return;
  }
  // enter
  if(hashPin(pinBuffer)===localStorage.getItem(PIN_KEY)){sessionPin=pinBuffer;unlock();}
  else{pinBuffer='';renderDots();lockMsg('PIN이 틀렸어요');}
}
function unlock(){
  pinBuffer='';lockMsg('');
  document.getElementById('lockScreen').classList.add('hidden');
}
function startLock(){
  buildPad();renderDots();
  if(!hasPin()){
    pinMode='set';setLockText('PIN 설정','처음이에요. 사용할 PIN 4자리를 정하세요');
  }else{
    pinMode='enter';setLockText('개인 관리 잠금','PIN 4자리를 입력하세요');
    if(localStorage.getItem(BIO_KEY)==='1'&&window.PublicKeyCredential){
      document.getElementById('lockBio').style.display='inline-block';
      // 자동 지문 시도 제거: 사용자가 직접 지문 버튼을 눌러야 시도 (구글 PIN 창 충돌 방지)
    }
  }
}
/* 지문 (WebAuthn) — 지원 기기에서만, 실패하면 PIN으로 */
function tryEnableBio(){
  if(!window.PublicKeyCredential)return;
  PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function(ok){
    if(ok&&confirm('지문/얼굴로도 열 수 있게 등록할까요?')){
      var cred={publicKey:{challenge:new Uint8Array(16),rp:{name:'개인관리'},
        user:{id:new Uint8Array(16),name:'me',displayName:'me'},
        pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
        authenticatorSelection:{userVerification:'required',authenticatorAttachment:'platform'},timeout:30000}};
      navigator.credentials.create(cred).then(function(){localStorage.setItem(BIO_KEY,'1');toast('지문 등록됨');})
        .catch(function(){});
    }
  }).catch(function(){});
}
function bioUnlock(){
  if(!window.PublicKeyCredential){lockMsg('이 기기는 지문을 지원하지 않아요');return;}
  var opt={publicKey:{challenge:new Uint8Array(16),userVerification:'required',timeout:30000}};
  navigator.credentials.get(opt).then(function(){unlock();})
    .catch(function(){lockMsg('지문 인식 실패 — PIN을 입력하세요');});
}
function disableBio(){
  if(!confirm('지문 잠금을 끕니다. (앱 PIN은 그대로 작동) 진행할까요?'))return;
  localStorage.removeItem(BIO_KEY);
  toast('🚫 지문 잠금 해제됨 — PIN으로만 열려요');
}
function changePin(){
  if(!confirm('PIN을 새로 설정할까요? 잠금 화면으로 이동합니다.'))return;
  localStorage.removeItem(PIN_KEY);localStorage.removeItem(BIO_KEY);
  document.getElementById('lockScreen').classList.remove('hidden');
  document.getElementById('lockBio').style.display='none';
  pinBuffer='';pinFirst='';startLock();
}

/* ===== 설정 ===== */
var REC_KEY='personal-records-v1';
var API_KEY='anthropic-apikey';
var AI_MODEL='claude-sonnet-4-6';
var FB_KEY='AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY';
var FB_BASE='https://firestore.googleapis.com/v1/projects/my-system-25497/databases/(default)/documents';
var COL='personal';        // 기록(텍스트)
var COL_PHOTO='personal_photos'; // 사진(base64)


/* ===== 카테고리 순서 관리 (드래그) ===== */
var LS_CAT_ORDER='personal_cat_order_v1';
function getCatOrder(){
  try{
    var s=localStorage.getItem(LS_CAT_ORDER);
    if(s){var a=JSON.parse(s);if(Array.isArray(a)&&a.length)return a;}
  }catch(e){}
  return CATS.map(function(c){return c.k;});
}
function saveCatOrder(arr){try{localStorage.setItem(LS_CAT_ORDER,JSON.stringify(arr));}catch(e){}}
function getOrderedCats(){
  var order=getCatOrder();
  var map={};CATS.forEach(function(c){map[c.k]=c;});
  var result=[];
  order.forEach(function(k){if(map[k])result.push(map[k]);});
  CATS.forEach(function(c){if(!map[c.k+'_done']&&result.indexOf(c)<0)result.push(c);});
  return result;
}
/* 카테고리 정의 + 카테고리별 입력 필드 스키마 */
var CATS=[
  /* 가나다순 · 통화+가족+약속 → 사람 통합 · 아이디어→생각 통합 */
  {k:'건강',  i:'💊', c:'#14B8A6', bg:'#CCFBF1', custom:'health'},
  {k:'구매',  i:'🛒', c:'#0EA5E9', bg:'#E0F2FE', custom:'buy'},
  {k:'기타',  i:'📌', c:'#64748B', bg:'#F1F5F9', fields:[
    {key:'title',label:'제목',ph:'세무서 서류 제출'},
    {key:'who',label:'관련 인물/장소',ph:'김재현 세무사',opt:true},
    {key:'amount',label:'금액(원)',ph:'50000',num:true,opt:true},
    {key:'phone',label:'전화번호',ph:'010-1234-5678',opt:true},
    {key:'addr',label:'주소',ph:'주소 (눌러서 지도)',opt:true},
    {key:'detail',label:'내용',ph:'자세한 내용',area:true,opt:true}]},
  {k:'독서',  i:'📖', c:'#7C3AED', bg:'#EDE9FE', custom:'book'},
  {k:'맛집',  i:'🍜', c:'#FB923C', bg:'#FFEDD5', custom:'food'},
  {k:'사람',  i:'👤', c:'#10B981', bg:'#D1FAE5', custom:'person'},
  {k:'생각',  i:'💭', c:'#8B5CF6', bg:'#EDE9FE', custom:'think'},
  {k:'여행',  i:'✈️', c:'#F59E0B', bg:'#FEF3C7', custom:'trip'},
  {k:'일상',  i:'📔', c:'#EC4899', bg:'#FCE7F3', custom:'daily'},
  {k:'차계부',  i:'🚗', c:'#0891B2', bg:'#CFFAFE', custom:'car'}
];
function catOf(k){for(var i=0;i<CATS.length;i++)if(CATS[i].k===k)return CATS[i];return CATS[CATS.length-1];}
/* 달력 이벤트 색: 차계부는 차량별로 구분, 그 외는 카테고리 색 */
var CAR_COLORS={'쏘나타':'#0891B2','스타렉스':'#EA580C'};
/* ===== 차량 목록 (사용자 관리) ===== */
var LS_CARS='personal_cars_v1';
var LS_PAY='personal_pay_v1';
var CAR_COLOR_POOL=['#0891B2','#EA580C','#16A34A','#9333EA','#D97706','#DB2777','#0284C7','#65A30D'];
function getCars(){
  try{var s=localStorage.getItem(LS_CARS);if(s){var a=JSON.parse(s);if(Array.isArray(a)&&a.length)return a;}}catch(e){}
  return [{name:'쏘나타',color:'#0891B2'},{name:'스타렉스',color:'#EA580C'}];
}
function saveCars(arr){
  localStorage.setItem(LS_CARS,JSON.stringify(arr));
  arr.forEach(function(c){CAR_COLORS[c.name]=c.color;});
}
function getPayMethods(){
  try{var s=localStorage.getItem(LS_PAY);if(s){var a=JSON.parse(s);if(Array.isArray(a)&&a.length)return a;}}catch(e){}
  return ['카드','현금','계좌이체'];
}
function savePayMethods(arr){localStorage.setItem(LS_PAY,JSON.stringify(arr));}
function carSelectHtml(selVal){
  return getCars().map(function(c){return '<option'+(c.name===selVal?' selected':'')+'>'+c.name+'</option>';}).join('');
}
function paySelectHtml(selVal){
  var opts='<option value=""'+(selVal?'':' selected')+'>-</option>';
  getPayMethods().forEach(function(p){opts+='<option'+(p===selVal?' selected':'')+'>'+p+'</option>';});
  return opts;
}
function payIcon(p){return p==='카드'?'💳':(p==='현금'?'💵':(p==='계좌이체'?'🏦':'💰'));}
/* 관리 모달 공통 */
function closeMgr(){$('mgrModal').classList.remove('open');}
/* 차량 관리 */
function openCarMgr(){
  var cars=getCars();
  var rows=cars.map(function(c,i){
    return '<div class="mgr-row">'+
      '<span class="mgr-dot" style="background:'+c.color+'"></span>'+
      '<span class="mgr-name">'+esc(c.name)+'</span>'+
      '<button class="mgr-del" onclick="delCar('+i+')">✕</button></div>';
  }).join('');
  $('mgrTitle').textContent='🚗 차량 목록 관리';
  $('mgrBody').innerHTML=rows+
    '<div class="mgr-add-row"><input id="mgrCarName" placeholder="차량 이름 (예: 레이)" class="mgr-input">'+
    '<button class="mgr-add-btn" onclick="addCar()">＋ 추가</button></div>';
  $('mgrModal').classList.add('open');
}
function addCar(){
  var name=($('mgrCarName')||{}).value||'';name=name.trim();if(!name)return;
  var cars=getCars();
  if(cars.some(function(c){return c.name===name;})){toast('이미 있어요');return;}
  var col=CAR_COLOR_POOL[cars.length%CAR_COLOR_POOL.length];
  cars.push({name:name,color:col});saveCars(cars);openCarMgr();
  // 차계부 폼 새로고침
  if(selectedCat==='차계부'){var cur=collectFields();renderCustomForm('car',cur);}
  toast('✅ '+name+' 추가됨');
}
function delCar(i){
  var cars=getCars();
  if(!confirm('"'+cars[i].name+'" 삭제할까요?'))return;
  cars.splice(i,1);saveCars(cars);openCarMgr();
  if(selectedCat==='차계부'){var cur=collectFields();renderCustomForm('car',cur);}
  toast('삭제됨');
}
/* 결제수단 관리 */
function openPayMgr(){
  var arr=getPayMethods();
  var rows=arr.map(function(p,i){
    return '<div class="mgr-row">'+
      '<span class="mgr-name">'+payIcon(p)+' '+esc(p)+'</span>'+
      '<button class="mgr-del" onclick="delPay('+i+')">✕</button></div>';
  }).join('');
  $('mgrTitle').textContent='💳 결제수단 관리';
  $('mgrBody').innerHTML=rows+
    '<div class="mgr-add-row"><input id="mgrPayName" placeholder="예: 네이버페이" class="mgr-input">'+
    '<button class="mgr-add-btn" onclick="addPay()">＋ 추가</button></div>';
  $('mgrModal').classList.add('open');
}
function addPay(){
  var name=($('mgrPayName')||{}).value||'';name=name.trim();if(!name)return;
  var arr=getPayMethods();
  if(arr.indexOf(name)>=0){toast('이미 있어요');return;}
  arr.push(name);savePayMethods(arr);openPayMgr();toast('✅ '+name+' 추가됨');
}
function delPay(i){
  var arr=getPayMethods();arr.splice(i,1);savePayMethods(arr);openPayMgr();toast('삭제됨');
}
/* CAR_COLORS 초기화 */
(function(){var cars=getCars();cars.forEach(function(c){CAR_COLORS[c.name]=c.color;});})();

function evtColor(r){
  if(r.cat==='차계부'&&r.who&&CAR_COLORS[r.who])return CAR_COLORS[r.who];
  return catOf(r.cat).c;
}
/* 달력 칸에 표시할 짧고 정보 풍부한 라벨 (compact=true는 연간용 더 짧게) */
function calEventLabel(r,compact){
  var t=r.title||r.cat;
  // 차계부 — 주유: "주유 40L 68,000원" / 정비: "정비 - 엔진오일 ..."
  if(r.cat==='차계부'){
    if(t==='주유'){
      var p=['⛽'];
      if(r.liters)p.push(r.liters+'L');
      if(!compact&&r.amount)p.push(won(r.amount)+'원');
      return esc(p.join(' '));
    }
    if(t==='정비'){
      var firstItem=(r.items&&r.items[0]&&r.items[0].name)||'';
      return esc('🔧 정비'+(firstItem?' - '+firstItem:'')+(r.items&&r.items.length>1?' 외 '+(r.items.length-1):''));
    }
    return esc(t);
  }
  // 맛집 — "원조명동 (서면)"
  if(r.cat==='맛집'){
    var loc=r.who?'('+r.who+')':'';
    return esc(t)+(loc?' <span style="color:#9CA3AF;font-size:.92em">'+esc(loc)+'</span>':'');
  }
  // 구매 — "믹서기 170,000원"
  if(r.cat==='구매'){
    if(compact)return esc(t);
    return esc(t)+(r.amount?' <span style="color:#9CA3AF;font-size:.92em">'+won(r.amount)+'원</span>':'');
  }
  // 사람 — 구분별 표시
  if(r.cat==='사람'){
    var sub=r.subtype||'';
    if(sub==='약속')return esc(t)+(r.time2&&!compact?' <span style="color:#9CA3AF;font-size:.92em">'+esc(r.time2)+'</span>':'');
    if(r.who)return esc(t)+' <span style="color:#9CA3AF;font-size:.92em">- '+esc(r.who)+'</span>';
    return esc(t);
  }
  // 건강 — "감기 진료 (서울내과)"
  if(r.cat==='건강'&&r.who&&!compact){return esc(t)+' <span style="color:#9CA3AF;font-size:.92em">('+esc(r.who)+')</span>';}
  return esc(t);
}

var selectedCat='일상';
var pendingPhotos=[];   // 새/수정 중인 사진 base64 배열
var editingId=null;     // 수정 중인 기록 id (null이면 새 기록)
var photoMem={};        // 클라우드에서 받아온 사진 캐시 (메모리)

function $(id){return document.getElementById(id);}
function toast(t){var el=$('toast');el.textContent=t;el.classList.add('show');setTimeout(function(){el.classList.remove('show');},1800);}
function getRecords(){try{return JSON.parse(localStorage.getItem(REC_KEY)||'[]');}catch(e){logErr('기록 읽기 실패: '+e.message);return [];}}
function setRecords(r){try{localStorage.setItem(REC_KEY,JSON.stringify(r));}catch(e){logErr('저장 실패(용량초과 가능): '+e.message);toast('⚠️ 저장 실패 - 진단 탭 확인');}}
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function won(n){return Number(n).toLocaleString('ko-KR');}

/* ===== 탭 ===== */
function tab(name,el){
  var ps=document.querySelectorAll('.panel');for(var i=0;i<ps.length;i++)ps[i].classList.remove('active');
  $('p-'+name).classList.add('active');
  var ts=document.querySelectorAll('.tab');for(var j=0;j<ts.length;j++)ts[j].classList.remove('active');
  el.classList.add('active');
  if(name==='write'){renderWriteList();renderCats();}
  if(name==='list')renderList();
  if(name==='cal')renderCal();
  if(name==='stats')renderStats();
  if(name==='diag')backupStatusText();
  if(name==='vault'){renderVault();}
  if(name==='contacts'){refreshCtCatSelect();loadContacts();setTimeout(attachCtNameAc,400);}
}

/* ===== 카테고리 칩 + 동적 폼 ===== */
function renderCats(){
  var recs=getRecords();
  var cnt={};recs.forEach(function(r){cnt[r.cat]=(cnt[r.cat]||0)+1;});
  var ordered=getOrderedCats();
  /* toolbar용 칩 (드래그 가능) */
  var allSel=(wrFilter==='전체');
  var h='<div class="cat-chip-wrap">'+
    '<div class="cat-chip'+(allSel?' sel':'')+'" style="'+(allSel?'background:#6B7280;color:#fff;':'')+'" onclick="setWrFilter(\'전체\')">전체</div>'+
  '</div>';
  ordered.forEach(function(c){
    var sel=c.k===selectedCat;
    var n=cnt[c.k]||0;
    h+='<div class="cat-chip-wrap" draggable="true" data-cat="'+c.k+'"'+
      ' ondragstart="catDragStart(event)"'+
      ' ondragover="catDragOver(event)"'+
      ' ondrop="catDrop(event)"'+
      ' ondragend="catDragEnd(event)"'+
      ' ontouchstart="catTouchStart(event)"'+
      ' ontouchmove="catTouchMove(event)"'+
      ' ontouchend="catTouchEnd(event)">'+
      '<div class="cat-chip'+(sel?' sel':'')+((wrFilter===c.k&&!sel)?' wr-active':'')+'" style="'+(sel?'background:'+c.c+';':(wrFilter===c.k?'border-color:'+c.c+';color:'+c.c+';':'')+'')+'" onclick="setWrFilter(\''+c.k+'\')">'+
        '<span class="cat-drag-handle" title="드래그로 순서 변경">⠿</span>'+
        c.i+' '+c.k+
      '</div>'+
      (n?'<span class="cat-peek-btn" onclick="openCatPane(\''+c.k+'\')" title="'+c.k+' 내역">'+n+'</span>':'')+
    '</div>';
  });
  var cc=$('catChips');if(cc)cc.innerHTML=h;
  /* 모달용 칩 (드래그 없음, 심플) */
  var hm='';ordered.forEach(function(c){
    var sel=c.k===selectedCat;
    hm+='<div class="cat-chip'+(sel?' sel':'')+'" style="'+(sel?'background:'+c.c+';':'')+'" onclick="pickCat(\''+c.k+'\')">'+c.i+' '+c.k+'</div>';
  });
  var cm=$('catChipsModal');if(cm)cm.innerHTML=hm;
}

/* ===== 카테고리 드래그 앤 드롭 (PC) ===== */
var _dragSrc=null;
function catDragStart(e){
  _dragSrc=e.currentTarget;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',e.currentTarget.dataset.cat);
}
function catDragOver(e){
  e.preventDefault();e.dataTransfer.dropEffect='move';
  var wrap=e.currentTarget;
  if(wrap===_dragSrc)return;
  wrap.classList.add('drag-over');
}
function catDrop(e){
  e.preventDefault();
  var from=e.dataTransfer.getData('text/plain');
  var to=e.currentTarget.dataset.cat;
  if(!from||from===to)return;
  _applyCatReorder(from,to);
}
function catDragEnd(e){
  document.querySelectorAll('.cat-chip-wrap').forEach(function(el){
    el.classList.remove('dragging','drag-over');
  });
}
/* ===== 카테고리 터치 드래그 (모바일) ===== */
var _touchSrc=null,_touchClone=null,_touchCat='';
function catTouchStart(e){
  if(e.touches.length!==1)return;
  var wrap=e.currentTarget;
  _touchSrc=wrap;_touchCat=wrap.dataset.cat;
  wrap.classList.add('dragging');
  /* 클론 만들어 손가락 따라다니게 */
  _touchClone=wrap.cloneNode(true);
  _touchClone.style.cssText='position:fixed;opacity:.8;pointer-events:none;z-index:9999;transform:scale(1.05);';
  var r=wrap.getBoundingClientRect();
  _touchClone.style.left=r.left+'px';_touchClone.style.top=r.top+'px';
  _touchClone.style.width=r.width+'px';
  document.body.appendChild(_touchClone);
}
function catTouchMove(e){
  if(!_touchClone)return;
  e.preventDefault();
  var t=e.touches[0];
  _touchClone.style.left=(t.clientX-_touchClone.offsetWidth/2)+'px';
  _touchClone.style.top=(t.clientY-20)+'px';
  /* 아래 요소 찾기 */
  _touchClone.style.display='none';
  var el=document.elementFromPoint(t.clientX,t.clientY);
  _touchClone.style.display='';
  document.querySelectorAll('.cat-chip-wrap').forEach(function(w){w.classList.remove('drag-over');});
  if(el){var wrap=el.closest('.cat-chip-wrap');if(wrap&&wrap!==_touchSrc)wrap.classList.add('drag-over');}
}
function catTouchEnd(e){
  if(!_touchClone){return;}
  var t=e.changedTouches[0];
  _touchClone.style.display='none';
  var el=document.elementFromPoint(t.clientX,t.clientY);
  _touchClone.style.display='';
  if(el){
    var wrap=el.closest('.cat-chip-wrap');
    if(wrap&&wrap!==_touchSrc&&wrap.dataset.cat)_applyCatReorder(_touchCat,wrap.dataset.cat);
  }
  document.querySelectorAll('.cat-chip-wrap').forEach(function(w){w.classList.remove('dragging','drag-over');});
  if(_touchClone.parentNode)_touchClone.parentNode.removeChild(_touchClone);
  _touchClone=null;_touchSrc=null;_touchCat='';
}
function _applyCatReorder(fromK,toK){
  var order=getCatOrder();
  var fi=order.indexOf(fromK),ti=order.indexOf(toK);
  if(fi<0||ti<0)return;
  order.splice(fi,1);order.splice(ti,0,fromK);
  saveCatOrder(order);
  renderCats();renderWriteList();
}
function pickCat(k){
  var cur=collectFields();
  selectedCat=k; renderCats(); renderForm(cur);
  // 모달 타이틀 갱신
  var mt=$('addModalTitle');if(mt&&!editingId)mt.textContent='✏️ '+k+' 기록 추가';
}
function renderForm(vals){
  vals=vals||{};
  var c=catOf(selectedCat);
  if(c.custom){renderCustomForm(c.custom,vals);return;}
  var h='<div class="form-grid">';
  c.fields.forEach(function(f){
    var v=vals[f.key]!=null?esc(String(vals[f.key])):'';
    var full=f.full?' full':'';
    h+='<div class="fg-item'+full+'">';
    h+='<label>'+f.label+(f.opt?' <span class="opt">(선택)</span>':'')+'</label>';
    if(f.sel){
      h+='<select id="f-'+f.key+'">';
      f.sel.forEach(function(o){h+='<option'+(v===o?' selected':'')+'>'+o+'</option>';});
      h+='</select>';
    }
    else if(f.area) h+='<textarea id="f-'+f.key+'" placeholder="'+f.ph+'">'+v+'</textarea>';
    else h+='<input type="'+(f.num?'number':'text')+'" id="f-'+f.key+'" placeholder="'+f.ph+'" value="'+v+'">';
    h+='</div>';
  });
  h+='</div>';

/* ===== 이름→연락처 전화번호 자동완성 ===== */
function attachWhoAutocomplete(inputId, phoneId){
  var el=$(inputId);if(!el)return;
  var dlId='dl_ac_'+inputId;
  var dl=document.getElementById(dlId);
  if(!dl){dl=document.createElement('datalist');dl.id=dlId;document.body.appendChild(dl);}
  el.setAttribute('list',dlId);
  dl.innerHTML=contactsCache.map(function(c){
    return '<option value="'+esc(c.name)+'">'+(c.phone?' ('+esc(c.phone)+')':'')+'</option>';
  }).join('');
  el.oninput=function(){
    var name=el.value.trim();
    var ct=contactsCache.find(function(c){return c.name===name;});
    var ph=$(phoneId);
    if(ct&&ct.phone&&ph&&!ph.value){ph.value=ct.phone;}
  };
}
  $('formFields').innerHTML=h;
  if($('f-who')&&$('f-phone'))attachWhoAutocomplete('f-who','f-phone');
}
/* ===== 카테고리별 맞춤 폼 ===== */
var formItems=[];
function renderCustomForm(kind,v){
  v=v||{};formItems=(v.items&&v.items.slice())||[];
  var h='';
  if(kind==='think'){
    var thinkSub=v.subtype||'생각';
    var thinkOpts=['생각','아이디어'].map(function(s){return '<option'+(s===thinkSub?' selected':'')+'>'+s+'</option>';}).join('');
    var ph=thinkSub==='아이디어'?'실행 가능한 아이디어':'요즘 드는 생각';
    var lbl=thinkSub==='아이디어'?'아이디어 ↔ 실행방법':'생각 ↔ 자세히';
    var addLbl=thinkSub==='아이디어'?'＋ 아이디어 추가':'＋ 생각 추가';
    h='<div class="form-grid">'+
      fgItem('종류','<select id="f-subtype" onchange="reloadThinkForm()">'+thinkOpts+'</select>')+
      fgItem('제목','<input type="text" id="f-title" placeholder="'+ph+'" value="'+ev(v.title)+'">',true)+
      '</div>'+
      '<label style="margin-top:10px">'+lbl+' (추가 가능)</label>'+
      '<div id="itemRows"></div>'+
      '<button type="button" class="add-row-btn" onclick="addItem(\'think\')">'+addLbl+'</button>'+
      fgWrap('전체 메모','<textarea id="f-detail" placeholder="추가 메모">'+ev(v.detail)+'</textarea>');
    $('formFields').innerHTML=h;renderItems('think');return;
  }
  if(kind==='buy'){
    h='<div class="form-grid">'+
      fgItem('품목','<input type="text" id="f-title" placeholder="무선 청소기" value="'+ev(v.title)+'">',true)+
      fgItem('쇼핑몰/구입처','<input type="text" id="f-who" placeholder="쿠팡 / 아마존" value="'+ev(v.who)+'">')+
      fgItem('쇼핑몰 링크','<input type="url" id="f-link" placeholder="https://..." value="'+ev(v.link)+'">')+
      fgItem('통화','<select id="f-cur" onchange="calcBuy()"><option value="원"'+(v.cur!=='달러'?' selected':'')+'>🇰🇷 원(₩)</option><option value="달러"'+(v.cur==='달러'?' selected':'')+'>🇺🇸 달러($)</option></select>')+
      fgItem('<span id="lblUnit">단가(원)</span>','<input type="number" id="f-unit" placeholder="150000" value="'+ev(v.unit)+'" oninput="calcBuy()">')+
      fgItem('개수','<input type="number" id="f-qty" placeholder="1" value="'+(v.qty||'')+'" oninput="calcBuy()">')+
      fgItem('<span id="lblShip">택배비(원)</span>','<input type="number" id="f-ship" placeholder="3000" value="'+ev(v.ship)+'" oninput="calcBuy()">')+
      fgItem('택배비 포함 여부','<select id="f-shipinc" onchange="calcBuy()"><option value="별도"'+(v.shipinc==='별도'?' selected':'')+'>합계에 더하기(별도)</option><option value="포함"'+(v.shipinc==='포함'?' selected':'')+'>단가에 이미 포함</option></select>')+
      fgItem('결제수단','<select id="f-pay">'+paySelectHtml(v.pay)+'</select><button type="button" class="mgr-inline-btn" onclick="openPayMgr()">⚙️</button>')+
      '<div class="fg-item full" id="rateBox" style="display:none"><label>환율 (1달러 = ? 원)</label><div class="rate-row"><input type="number" id="f-rate" placeholder="예: 1380" value="'+ev(v.rate)+'" oninput="calcBuy()"><button type="button" class="rate-btn" onclick="fetchRate()">📡 그날 환율</button></div><div class="rate-note" id="rateNote"></div></div>'+
      fgItem('합계(원화)','<input type="text" id="f-amtview" readonly style="font-weight:800;color:#0EA5E9;background:#F0F9FF" value="">',true)+
      fgItem('메모','<textarea id="f-detail" placeholder="산 이유·후기">'+ev(v.detail)+'</textarea>')+
      '</div>';
    $('formFields').innerHTML=h;calcBuy();return;
  }
  if(kind==='trip'){
    h='<div class="form-grid">'+
      fgItem('장소/여행명','<input type="text" id="f-title" placeholder="제주도 가족여행" value="'+ev(v.title)+'">',true)+
      fgItem('누구와','<input type="text" id="f-who" placeholder="가족 4명" value="'+ev(v.who)+'">')+
      fgItem('주소','<input type="text" id="f-addr" placeholder="주소(눌러서 지도)" value="'+ev(v.addr)+'">')+
      fgItem('전화번호','<input type="text" id="f-phone" placeholder="064-123-4567" value="'+ev(v.phone)+'">')+
      '</div>'+
      '<label style="margin-top:10px">경비 (항목별 추가)</label>'+
      '<div id="itemRows"></div>'+
      '<button type="button" class="add-row-btn" onclick="addItem(\'trip\')">＋ 경비 추가</button>'+
      '<div class="item-total" id="itemTotal"></div>'+
      fgWrap('일정·메모','<textarea id="f-detail" placeholder="한 일·좋았던 것">'+ev(v.detail)+'</textarea>');
    $('formFields').innerHTML=h;renderItems('trip');return;
  }
  if(kind==='food'){
    h='<div class="form-grid">'+
      fgItem('가게 이름','<input type="text" id="f-title" placeholder="할매국밥" value="'+ev(v.title)+'">',true)+
      fgItem('위치/지역','<input type="text" id="f-who" placeholder="부산 서면" value="'+ev(v.who)+'">')+
      fgItem('주소','<input type="text" id="f-addr" placeholder="주소(눌러서 지도)" value="'+ev(v.addr)+'">')+
      fgItem('전화번호','<input type="text" id="f-phone" placeholder="051-123-4567" value="'+ev(v.phone)+'">')+
      fgItem('별점','<select id="f-stars"><option value="">-</option>'+starOpts(v.stars)+'</select>')+
      '</div>'+
      '<label style="margin-top:10px">먹은 메뉴 (메뉴·가격·인원, 추가 가능)</label>'+
      '<div id="itemRows"></div>'+
      '<button type="button" class="add-row-btn" onclick="addItem(\'food\')">＋ 메뉴 추가</button>'+
      '<div class="item-total" id="itemTotal"></div>'+
      fgWrap('메모','<textarea id="f-detail" placeholder="맛 평가·재방문 여부">'+ev(v.detail)+'</textarea>');
    $('formFields').innerHTML=h;renderItems('food');return;
  }
  if(kind==='car'){
    h='<div class="form-grid">'+
      fgItem('차량','<select id="f-who">'+carSelectHtml(v.who)+'</select><button type="button" class="mgr-inline-btn" onclick="openCarMgr()">⚙️</button>')+
      fgItem('구분','<select id="f-title" onchange="toggleCarType()"><option'+(v.title==='주유'?' selected':'')+'>주유</option><option'+(v.title==='정비'?' selected':'')+'>정비</option><option'+(v.title==='보험'?' selected':'')+'>보험</option><option'+(v.title==='기타'?' selected':'')+'>기타</option></select>')+
      fgItem('주행거리(㎞)','<input type="number" id="f-odo" placeholder="45200" value="'+ev(v.odo)+'">')+
      fgItem('주유소/정비소','<input type="text" id="f-addr" placeholder="GS칼텍스 OO점" value="'+ev(v.addr)+'">')+
      '</div>'+
      '<div id="carFuel">'+
        '<div class="form-grid">'+
          fgItem('주유량(L)','<input type="number" id="f-liters" placeholder="40" value="'+ev(v.liters)+'" oninput="calcFuel()">')+
          fgItem('단가(원/L)','<input type="number" id="f-fuelunit" placeholder="1700" value="'+ev(v.fuelunit)+'" oninput="calcFuel()">')+
          fgItem('금액(원)','<input type="number" id="f-amount" placeholder="68000" value="'+ev(v.amount)+'" oninput="syncFuelAmt()">',true)+
        '</div>'+
      '</div>'+
      '<div id="carParts">'+
        '<label style="margin-top:10px">정비 내역 (항목·단가, 추가 가능)</label>'+
        '<div id="itemRows"></div>'+
        '<button type="button" class="add-row-btn" onclick="addItem(\'car\')">＋ 정비 항목 추가</button>'+
        '<div class="item-total" id="itemTotal"></div>'+
      '</div>'+
      fgWrap('메모','<textarea id="f-detail" placeholder="특이사항">'+ev(v.detail)+'</textarea>');
    $('formFields').innerHTML=h;renderItems('car');toggleCarType();calcFuel();return;
  }
  if(kind==='health'){
    h='<div class="form-grid">'+
      fgItem('증상/검진','<input type="text" id="f-title" placeholder="감기 진료" value="'+ev(v.title)+'">',true)+
      fgItem('병원/의사','<input type="text" id="f-who" placeholder="서울내과" value="'+ev(v.who)+'">')+
      fgItem('전화번호','<input type="text" id="f-phone" placeholder="02-123-4567" value="'+ev(v.phone)+'">')+
      fgItem('주소','<input type="text" id="f-addr" placeholder="주소(눌러서 지도)" value="'+ev(v.addr)+'">')+
      fgItem('보험 청구','<select id="f-insur"><option value="해당없음"'+(v.insur==='해당없음'?' selected':'')+'>해당없음</option><option value="청구예정"'+(v.insur==='청구예정'?' selected':'')+'>청구 예정</option><option value="청구완료"'+(v.insur==='청구완료'?' selected':'')+'>청구 완료</option></select>')+
      '</div>'+
      '<label style="margin-top:10px">진료비 / 약값 (추가 가능)</label>'+
      '<div id="itemRows"></div>'+
      '<button type="button" class="add-row-btn" onclick="addItem(\'health\')">＋ 비용 항목 추가</button>'+
      '<div class="item-total" id="itemTotal"></div>'+
      fgWrap('처방·메모','<textarea id="f-detail" placeholder="처방 내용·메모">'+ev(v.detail)+'</textarea>');
    $('formFields').innerHTML=h;renderItems('health');return;
  }
  if(kind==='person'){
    /* 만남+약속 통합 → 만남(시간·장소·준비물 포함) */
    var subtypes=['통화','만남','가족'];
    var sub=v.subtype||'통화';
    /* 기존 약속 → 만남으로 이관 */
    if(sub==='약속')sub='만남';
    var subOpts=subtypes.map(function(s){return '<option'+(s===sub?' selected':'')+'>'+s+'</option>';}).join('');
    h='<div class="form-grid">'+
      fgItem('구분','<select id="f-subtype" onchange="togglePersonType()">'+subOpts+'</select>')+
      fgItem('상대','<input type="text" id="f-who" placeholder="홍길동 / 아내 / 가족" value="'+ev(v.who)+'" oninput="acPersonWho()">')+
      fgItem('전화번호','<input type="tel" id="f-phone" placeholder="010-1234-5678" value="'+ev(v.phone)+'">')+
      '</div>'+
      '<div id="personSub">'+
      /* 통화 */
      '<div id="pSub_통화" class="person-sub">'+
        '<div class="form-grid">'+
          fgItem('통화 주제','<input type="text" id="f-title" placeholder="계약 일정 조율" value="'+ev(v.title)+'">',true)+
        '</div>'+
        fgWrap('통화 내용·결정사항','<textarea id="f-detail" placeholder="무슨 얘기를 했는지">'+ev(v.detail)+'</textarea>')+
      '</div>'+
      /* 만남 (약속+만남 통합: 시간·장소·준비물·비용) */
      '<div id="pSub_만남" class="person-sub" style="display:none">'+
        '<div class="form-grid">'+
          fgItem('내용','<input type="text" id="f-title" placeholder="거래처 미팅 / 점심 식사" value="'+ev(v.title)+'">',true)+
          fgItem('시간','<input type="time" id="f-time2" value="'+ev(v.time2)+'">')+
          fgItem('장소','<input type="text" id="f-place" placeholder="강남역 2번 출구" value="'+ev(v.place)+'">')+
          fgItem('준비물 <span class="opt">(선택)</span>','<input type="text" id="f-prep" placeholder="계약서, 도장" value="'+ev(v.prep)+'">')+
        '</div>'+
        '<label style="margin-top:10px">비용 <span class="opt">(선택)</span></label>'+
        '<div id="itemRows"></div>'+
        '<button type="button" class="add-row-btn" onclick="addItem(\'person\')">＋ 비용 추가</button>'+
        '<div class="item-total" id="itemTotal"></div>'+
        fgWrap('메모','<textarea id="f-detail" placeholder="있었던 일·기타 메모">'+ev(v.detail)+'</textarea>')+
      '</div>'+
      /* 가족 */
      '<div id="pSub_가족" class="person-sub" style="display:none">'+
        '<div class="form-grid">'+
          fgItem('무슨 일','<input type="text" id="f-title" placeholder="가족 외식·여행" value="'+ev(v.title)+'">',true)+
          fgItem('장소 <span class="opt">(선택)</span>','<input type="text" id="f-place" placeholder="어디서" value="'+ev(v.place)+'">')+
        '</div>'+
        fgWrap('내용·느낀 점','<textarea id="f-detail" placeholder="있었던 일">'+ev(v.detail)+'</textarea>')+
      '</div>'+
      '</div>';
    $('formFields').innerHTML=h;
    togglePersonType();
    if($('f-who')&&$('f-phone'))attachWhoAutocomplete('f-who','f-phone');
    if(sub==='만남')renderItems('person');
    return;
  }

  if(kind==='daily'){
    var moods=['😊 좋음','😐 보통','😔 나쁨','😤 화남','😌 평온','🥳 신남','😴 피곤'];
    var weathers=['☀️ 맑음','⛅ 흐림','🌧️ 비','❄️ 눈','💨 바람','🌤️ 구름 조금'];
    var mOpts=moods.map(function(m){return '<option'+(m===v.mood?' selected':'')+'>'+m+'</option>';}).join('');
    var wOpts=weathers.map(function(w){return '<option'+(w===v.weather?' selected':'')+'>'+w+'</option>';}).join('');
    h='<div class="form-grid">'+
      fgItem('오늘 한 마디','<input type="text" id="f-title" placeholder="오늘을 한 단어로 표현한다면?" value="'+ev(v.title)+'" style="font-size:16px;font-weight:600">',true)+
      fgItem('날씨','<select id="f-weather">'+wOpts+'</select>')+
      fgItem('기분','<select id="f-mood">'+mOpts+'</select>')+
      '</div>'+
      fgWrap('오늘 있었던 일','<textarea id="f-detail" placeholder="오늘 무슨 일이 있었나요? 자유롭게 적어요." style="min-height:90px">'+ev(v.detail)+'</textarea>')+
      '<div style="margin-top:12px"><label>감사한 것 <span class=\"opt\">(추가 가능)</span></label>'+
      '<div id="itemRows"></div>'+
      '<button type="button" class="add-row-btn" onclick="addItem(\'daily\')">＋ 감사한 것 추가</button></div>'+
      fgWrap('내일 할 일','<textarea id="f-tomorrow" placeholder="내일 꼭 해야 할 것." style="min-height:60px">'+ev(v.tomorrow)+'</textarea>');
    $('formFields').innerHTML=h;renderItems('daily');return;
  }
  if(kind==='book'){
    h='<div class="form-grid">'+
      fgItem('책 제목','<input type="text" id="f-title" placeholder="사피엔스" value="'+ev(v.title)+'">',true)+
      fgItem('저자','<input type="text" id="f-who" placeholder="유발 하라리" value="'+ev(v.who)+'">')+
      fgItem('종류','<select id="f-booktype"><option value="종이책"'+(v.booktype==='종이책'?' selected':'')+'>📕 종이책</option><option value="전자책"'+(v.booktype==='전자책'?' selected':'')+'>📱 전자책</option></select>')+
      fgItem('별점 · 진행률','<div class="star-prog"><select id="f-stars"><option value="">별점</option>'+starOpts(v.stars)+'</select><input type="text" id="f-progview" readonly class="prog-mini" value=""></div>',true)+
      fgItem('전체 페이지','<input type="number" id="f-totalpg" placeholder="480" value="'+ev(v.totalpg)+'" oninput="calcBook()">')+
      fgItem('읽은 페이지','<input type="number" id="f-readpg" placeholder="이어볼 쪽" value="'+ev(v.readpg)+'" oninput="calcBook()">')+
      '</div>'+
      '<label style="margin-top:10px">핵심 문장 ↔ 내 생각 (추가 가능)</label>'+
      '<div id="itemRows"></div>'+
      '<button type="button" class="add-row-btn" onclick="addItem(\'book\')">＋ 핵심 문장 추가</button>'+
      fgWrap('전체 메모','<textarea id="f-detail" placeholder="책 전체 감상">'+ev(v.detail)+'</textarea>');
    $('formFields').innerHTML=h;renderItems('book');calcBook();return;
  }
}

function reloadThinkForm(){
  var cur=collectFields();
  renderCustomForm('think',cur);
}
function starOpts(cur){return [1,2,3,4,5].map(function(n){return '<option value="'+n+'"'+(String(cur)===String(n)?' selected':'')+'>'+'⭐'.repeat(n)+'</option>';}).join('');}
function ev(x){return x!=null?esc(String(x)):'';}
function fgItem(label,inner,full){return '<div class="fg-item'+(full?' full':'')+'"><label>'+label+'</label>'+inner+'</div>';}
function fgWrap(label,inner){return '<div style="margin-top:10px"><label>'+label+'</label>'+inner+'</div>';}
/* 그날 환율 자동 가져오기 (Frankfurter API, 키 불필요) */
function fetchRate(){
  var date=($('f-date')||{}).value||new Date().toISOString().slice(0,10);
  var note=$('rateNote');if(note){note.textContent='환율 불러오는 중…';note.style.color='#9CA3AF';}
  // 주말/공휴일이면 그 이전 영업일 환율을 줌
  fetch('https://api.frankfurter.dev/v1/'+date+'?base=USD&symbols=KRW')
    .then(function(r){if(!r.ok)throw new Error('응답 오류');return r.json();})
    .then(function(d){
      var rate=d&&d.rates&&d.rates.KRW;
      if(!rate)throw new Error('환율 없음');
      var rounded=Math.round(rate*100)/100;
      var el=$('f-rate');if(el){el.value=rounded;calcBuy();}
      if(note){note.textContent='✅ '+(d.date||date)+' 기준 1달러 = '+won(Math.round(rate))+'원 (ECB)';note.style.color='#16A34A';}
    })
    .catch(function(e){
      if(note){note.textContent='⚠️ 자동 실패 — 직접 입력하세요 ('+e.message+')';note.style.color='#EF4444';}
    });
}
/* 구매 합계 */
function calcBuy(){
  var cur=($('f-cur')||{}).value||'원';
  var isUsd=cur==='달러';
  // 라벨·환율칸 토글
  var lu=$('lblUnit'),ls=$('lblShip'),rb=$('rateBox');
  if(lu)lu.textContent=isUsd?'단가($)':'단가(원)';
  if(ls)ls.textContent=isUsd?'배송료($)':'택배비(원)';
  if(rb)rb.style.display=isUsd?'':'none';
  var unit=Number(($('f-unit')||{}).value||0),qty=Number(($('f-qty')||{}).value||0),ship=Number(($('f-ship')||{}).value||0);
  var inc=($('f-shipinc')||{}).value||'별도';
  var base=unit*(qty||1),sub=base+(inc==='별도'?ship:0);
  var el=$('f-amtview');if(!el)return;
  if(isUsd){
    var rate=Number(($('f-rate')||{}).value||0);
    if(sub&&rate){var krw=Math.round(sub*rate);el.value=won(krw)+'원  ($'+sub.toLocaleString()+' × '+won(rate)+')';}
    else if(sub){el.value='$'+sub.toLocaleString()+' (환율 입력 시 원화 자동계산)';}
    else el.value='';
  }else{
    el.value=sub?won(sub)+'원'+(ship&&inc==='별도'?' (택배비 '+won(ship)+' 포함)':''):'';
  }
}
/* 주유: 주유량×단가=금액 자동 */
function calcFuel(){
  var l=Number(($('f-liters')||{}).value||0),u=Number(($('f-fuelunit')||{}).value||0);
  if(l&&u){var amt=Math.round(l*u);var el=$('f-amount');if(el)el.value=amt;}
}
function syncFuelAmt(){/* 사용자가 금액 직접 수정 시 그대로 둠 */}
/* 차계부 구분에 따라 주유/정비 영역 토글 */
function toggleCarType(){
  var t=($('f-title')||{}).value;
  var fuel=$('carFuel'),parts=$('carParts');
  if(!fuel||!parts)return;
  if(t==='주유'){fuel.style.display='';parts.style.display='none';}
  else if(t==='정비'){fuel.style.display='none';parts.style.display='';}
  else{fuel.style.display='none';parts.style.display='none';}
}
/* 독서 진행률 */
function calcBook(){
  var t=Number(($('f-totalpg')||{}).value||0),r=Number(($('f-readpg')||{}).value||0);
  var el=$('f-progview');if(!el)return;
  if(t>0){var pct=Math.min(100,Math.round(r/t*100));el.value=r+'/'+t+'쪽 '+pct+'%';}else el.value='';
}
/* ===== 반복 항목 (컬럼 정의형) ===== */
function addItem(kind){
  if(kind==='think')formItems.push({quote:'',thought:''});
  else if(kind==='book')formItems.push({quote:'',thought:''});
  else if(kind==='food')formItems.push({name:'',price:'',people:''});
  else if(kind==='health')formItems.push({type:'진료비',name:'',price:''});
  else if(kind==='trip')formItems.push({name:'',price:''});
  else if(kind==='person')formItems.push({name:'',price:''});
  else if(kind==='car')formItems.push({name:'',price:''});
  else if(kind==='daily')formItems.push({quote:''});
  renderItems(kind);
}
function delItem(kind,i){formItems.splice(i,1);renderItems(kind);}
function updItem(i,key,val){if(formItems[i])formItems[i][key]=val;}
function renderItems(kind){
  var box=$('itemRows');if(!box)return;
  var h='';
  formItems.forEach(function(it,i){
    if(kind==='think'||kind==='book'||kind==='daily'){
      var t1=kind==='book'?'📜 핵심 문장':'💭 생각';
      var t2=kind==='book'?'💡 내 생각':'📝 자세히';
      h+='<div class="quote-row"><div class="quote-head"><span class="quote-no">'+(i+1)+'</span><button type="button" class="item-del" onclick="delItem(\''+kind+'\','+i+')">×</button></div>'+
        '<div class="quote-cols"><div class="quote-col"><div class="quote-tag">'+t1+'</div><textarea placeholder="" oninput="updItem('+i+',\'quote\',this.value)">'+ev(it.quote)+'</textarea></div>'+
        '<div class="quote-col"><div class="quote-tag think">'+t2+'</div><textarea placeholder="" oninput="updItem('+i+',\'thought\',this.value)">'+ev(it.thought)+'</textarea></div></div></div>';
    }else if(kind==='food'){
      h+='<div class="item-row"><input type="text" placeholder="메뉴" value="'+ev(it.name)+'" oninput="updItem('+i+',\'name\',this.value)">'+
        '<input type="number" placeholder="가격" value="'+(it.price||'')+'" oninput="updItem('+i+',\'price\',this.value);sumItems(\'food\')" class="item-price">'+
        '<input type="number" placeholder="인원" value="'+(it.people||'')+'" oninput="updItem('+i+',\'people\',this.value);sumItems(\'food\')" class="item-people">'+
        '<button type="button" class="item-del" onclick="delItem(\'food\','+i+')">×</button></div>';
    }else if(kind==='health'){
      h+='<div class="item-row"><select onchange="updItem('+i+',\'type\',this.value)" class="item-type"><option'+(it.type==='진료비'?' selected':'')+'>진료비</option><option'+(it.type==='약값'?' selected':'')+'>약값</option></select>'+
        '<input type="text" placeholder="내용" value="'+ev(it.name)+'" oninput="updItem('+i+',\'name\',this.value)" class="item-name-sm">'+
        '<input type="number" placeholder="가격" value="'+(it.price||'')+'" oninput="updItem('+i+',\'price\',this.value);sumItems(\'health\')" class="item-price-lg">'+
        '<button type="button" class="item-del" onclick="delItem(\'health\','+i+')">×</button></div>';
    }else{ /* trip, appt, car: 항목 + 단가 */
      var ph=kind==='car'?'정비 항목':(kind==='person'?'어디에':'항목');
      h+='<div class="item-row"><input type="text" placeholder="'+ph+'" value="'+ev(it.name)+'" oninput="updItem('+i+',\'name\',this.value)">'+
        '<input type="number" placeholder="금액" value="'+(it.price||'')+'" oninput="updItem('+i+',\'price\',this.value);sumItems(\''+kind+'\')" class="item-price">'+
        '<button type="button" class="item-del" onclick="delItem(\''+kind+'\','+i+')">×</button></div>';
    }
  });
  box.innerHTML=h;
  if(kind!=='think'&&kind!=='book')sumItems(kind);
}
function sumItems(kind){
  var el=$('itemTotal');if(!el)return;
  var sum=formItems.reduce(function(s,it){return s+(Number(it.price)||0);},0);
  var extra='';
  if(kind==='food'){var ppl=formItems.reduce(function(s,it){return s+(Number(it.people)||0);},0);if(ppl)extra=' · '+ppl+'명';}
  el.textContent=sum?('합계 '+won(sum)+'원'+extra):'';
}

/* ===== 사람 카테고리: 구분별 필드 토글 ===== */
function togglePersonType(){
  var sub=($('f-subtype')||{}).value||'통화';
  ['통화','만남','가족'].forEach(function(s){
    var el=document.getElementById('pSub_'+s);
    if(el)el.style.display=(s===sub?'':'none');
  });
  if(sub==='만남')renderItems('person');
  var ph=$('f-phone');
  if(ph){
    ph.style.opacity=(sub==='만남'||sub==='가족')?'0.5':'1';
    ph.placeholder=sub==='통화'?'010-1234-5678':'010-1234-5678 (선택)';
  }
}
function acPersonWho(){
  var el=$('f-who'),ph=$('f-phone');if(!el||!ph)return;
  var name=el.value.trim();
  var ct=contactsCache.find(function(c){return c.name===name;});
  if(ct&&ct.phone&&!ph.value)ph.value=ct.phone;
}
function collectFields(){
  var o={};['title','detail','who','amount','odo','liters','phone','addr','link','unit','qty','ship','shipinc','stars','insur','time2','place','prep','booktype','totalpg','readpg','fuelunit','cur','rate','pay','subtype','mood','weather','tomorrow'].forEach(function(k){var el=$('f-'+k);if(el)o[k]=el.value;});
  return o;
}

/* ===== 사진 (압축 후 base64) — 고정 입력 + 타임아웃 안전장치 ===== */
function setPhotoStatus(msg){var el=$('photoStatus');if(el)el.textContent=msg||'';}
/* PC: 클립보드 이미지 붙여넣기 */
function handlePaste(e){
  var items=(e.clipboardData||window.clipboardData);
  if(!items)return;
  var files=[];
  if(items.items){
    for(var i=0;i<items.items.length;i++){
      var it=items.items[i];
      if(it.kind==='file'&&it.type.indexOf('image')>-1){var f=it.getAsFile();if(f)files.push(f);}
    }
  }
  if(items.files&&items.files.length){
    for(var j=0;j<items.files.length;j++){if(items.files[j].type.indexOf('image')>-1)files.push(items.files[j]);}
  }
  if(!files.length){setPhotoStatus('⚠️ 붙여넣은 것에서 이미지를 찾지 못했어요 (사진을 복사한 뒤 붙여넣어 주세요)');return;}
  e.preventDefault();
  var box=$('pasteBox');if(box)box.innerHTML='';
  var i2=0,ok=0,last='';
  setPhotoStatus(files.length+'장 붙여넣는 중…');
  (function next(){
    if(i2>=files.length){
      setPhotoStatus(ok?('✅ 붙여넣기 '+ok+'장 추가됨 (총 '+pendingPhotos.length+'장)'):'⚠️ 추가 실패: '+last);
      return;
    }
    var f=files[i2++];
    readAndCompress(f).then(function(d){pendingPhotos.push(d);ok++;renderPending();next();})
    .catch(function(err){last=err.message;logErr('붙여넣기 실패: '+err.message);next();});
  })();
}
function onPhotoInput(ev){
  var fl=ev.target.files; var list=fl?Array.prototype.slice.call(fl):[];
  ev.target.value='';            // 파일 참조 잡은 뒤 초기화(순서 중요)
  if(!list.length){setPhotoStatus('');return;}
  setPhotoStatus(list.length>1?(list.length+'장 처리 중…'):'사진 읽는 중…');
  var i=0,ok=0,lastErr='';
  (function next(){
    if(i>=list.length){
      if(ok)setPhotoStatus('✅ 사진 '+ok+'장 추가됨 (총 '+pendingPhotos.length+'장)');
      else setPhotoStatus('⚠️ 추가 실패: '+(lastErr||'알 수 없는 오류')+' — 진단 탭 확인');
      return;
    }
    var f=list[i++];
    readAndCompress(f).then(function(data){pendingPhotos.push(data);ok++;renderPending();
      setPhotoStatus('처리 중… ('+i+'/'+list.length+')');next();})
    .catch(function(e){lastErr=e.message;logErr('사진 첨부 실패: '+e.message+' [type='+(f.type||'없음')+', size='+(f.size||0)+']');next();});
  })();
}
function readAndCompress(file){
  return new Promise(function(resolve,reject){
    var typeInfo=' ('+(file.type||'형식정보없음')+', '+Math.round((file.size||0)/1024)+'KB)';
    var done=false;
    var timer=setTimeout(function(){if(!done){done=true;reject(new Error('처리 지연'+typeInfo));}},30000);
    function finish(data){if(done)return;done=true;clearTimeout(timer);resolve(data);}
    function fail(msg){if(done)return;done=true;clearTimeout(timer);reject(new Error(msg+typeInfo));}

    var triedBitmap=false,triedHeic=false;
    var isHeic=(/heic|heif/i).test(file.type||'')||(/\.(heic|heif)$/i).test(file.name||'');

    // HEIC/HEIF면 변환 라이브러리부터 시도
    if(isHeic){ tryHeic(); } else { tryReader(); }

    // 0순위) heic2any 로 HEIC → JPEG 변환
    function tryHeic(){
      triedHeic=true;
      setPhotoStatus('HEIC 사진 변환 중… (잠시 걸려요)');
      loadHeicLib().then(function(){
        return window.heic2any({blob:file,toType:'image/jpeg',quality:0.6});
      }).then(function(blob){
        var reader=new FileReader();
        reader.onload=function(e){
          var img=new Image();
          img.onload=function(){try{finish(drawToJpeg(img,img.naturalWidth||img.width,img.naturalHeight||img.height,1600,0.6));}catch(err){tryReader();}};
          img.onerror=function(){tryReader();};
          img.src=e.target.result;
        };
        reader.onerror=function(){tryReader();};
        reader.readAsDataURL(blob);
      }).catch(function(){ tryReader(); });  // 변환 실패하면 일반 경로로
    }

    // 1순위) FileReader → Image
    function tryReader(){
      var reader=new FileReader();
      reader.onerror=function(){tryBitmap();};
      reader.onload=function(e){
        var img=new Image();
        img.onload=function(){
          try{finish(drawToJpeg(img,img.naturalWidth||img.width,img.naturalHeight||img.height,1600,0.6));}
          catch(err){tryBitmap();}
        };
        img.onerror=function(){tryBitmap();};
        img.src=e.target.result;
      };
      try{reader.readAsDataURL(file);}catch(err){tryBitmap();}
    }
    // 2순위) createImageBitmap
    function tryBitmap(){
      if(done)return;
      if(triedBitmap||!window.createImageBitmap){ failFinal(); return; }
      triedBitmap=true;
      createImageBitmap(file).then(function(bmp){
        try{finish(drawToJpeg(bmp,bmp.width,bmp.height,1600,0.6));}
        catch(e){failFinal();}
      }).catch(function(){ failFinal(); });
    }
    function failFinal(){
      // HEIC인데 아직 변환 라이브러리를 안 써봤으면 마지막으로 시도
      if(isHeic&&!triedHeic){triedHeic=true;tryHeic();return;}
      fail(isHeic?'HEIC 변환 실패 — 폰 카메라를 JPEG로 설정하거나 다른 사진으로':'이 사진 형식은 변환할 수 없어요');
    }
  });
}
/* heic2any 라이브러리를 처음 필요할 때만 불러오기 */
var _heicLib=null;
function loadHeicLib(){
  if(window.heic2any)return Promise.resolve();
  if(_heicLib)return _heicLib;
  _heicLib=new Promise(function(resolve,reject){
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
    s.onload=function(){resolve();};
    s.onerror=function(){_heicLib=null;reject(new Error('HEIC 라이브러리 로드 실패'));};
    document.head.appendChild(s);
  });
  return _heicLib;
}
function drawToJpeg(src,w,h,max,q){
  if(!w||!h)throw new Error('크기 없음');
  if(w>max||h>max){if(w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;}}
  var cv=document.createElement('canvas');cv.width=w;cv.height=h;
  cv.getContext('2d').drawImage(src,0,0,w,h);
  var data=cv.toDataURL('image/jpeg',q);
  // Firestore 1MB 한도 대비 추가 압축
  if(data.length>900000) data=cv.toDataURL('image/jpeg',0.45);
  if(data.length>900000){var m2=1100,w2=w,h2=h;if(w>h){h2=Math.round(h*m2/w);w2=m2;}else{w2=Math.round(w*m2/h);h2=m2;}
    cv.width=w2;cv.height=h2;cv.getContext('2d').drawImage(src,0,0,w2,h2);data=cv.toDataURL('image/jpeg',0.5);}
  return data;
}
function renderPending(){
  var row=$('photoRow');row.innerHTML='';
  pendingPhotos.forEach(function(p,i){
    var d=document.createElement('div');d.className='photo-thumb';
    d.innerHTML='<img src="'+p+'"><button class="photo-del">×</button>';
    d.querySelector('img').onclick=function(){showImg(p);};
    d.querySelector('.photo-del').onclick=function(){pendingPhotos.splice(i,1);renderPending();setPhotoStatus('');};
    row.appendChild(d);
  });
}
function showImg(src){$('viewerImg').src=src;$('viewer').classList.add('open');}

/* ===== 저장 / 수정 ===== */

/* ===== 기록 추가 모달 ===== */
var wrFilter='전체';
var wrDateFrom='',wrDateTo='';
function openAddModal(cat){
  if(cat)pickCat(cat);
  $('addModalBg').classList.add('open');
  $('addModalTitle').textContent=editingId?'✏️ 수정':'✏️ 기록 추가';
  setTimeout(function(){
    var fi=$('formFields');if(fi){var inp=fi.querySelector('input[type=text]');if(inp)inp.focus();}
  },200);
}
function closeAddModal(){
  $('addModalBg').classList.remove('open');
  if(!editingId)cancelEdit();
}
/* pickCat 에서 모달이 열려있으면 catChipsModal도 갱신 */
function renderCatsModal(){renderCats();}

/* ===== 기록 탭 목록 렌더 ===== */
function renderWriteList(){
  var recs=getRecords();
  /* 날짜 필터 */
  var df=($('wrDateFrom')||{}).value||'';
  var dt=($('wrDateTo')||{}).value||'';
  recs=recs.filter(function(r){
    if(wrFilter!=='전체'&&r.cat!==wrFilter)return false;
    if(df&&r.date<df)return false;
    if(dt&&r.date>dt)return false;
    return true;
  });
  recs.sort(function(a,b){return (b.date+(b.time||'')).localeCompare(a.date+(a.time||''));});
  var cnt=$('wrCount');if(cnt)cnt.textContent=recs.length+'건';
  var el=$('writeList');if(!el)return;
  if(!recs.length){el.innerHTML='<div class="empty" style="padding:30px 0">기록이 없어요 — 위 버튼으로 추가하세요</div>';return;}
  /* 날짜 그룹 */
  var html='',cur='';
  recs.forEach(function(r){
    if(r.date!==cur){
      cur=r.date;
      html+='<div class="wr-day-band">📅 '+fmtDateK(r.date)+'</div>';
    }
    var c=catOf(r.cat);
    var col=evtColor(r);
    var amt='';
    if(r.amount)amt='<span class="wr-amt">'+won(r.amount)+'원</span>';
    if(r.cat==='독서'&&r.stars)amt='<span class="wr-amt star">'+'⭐'.repeat(Math.min(5,Math.round(r.stars)))+'</span>';
    var sub=rowSummary(r);
    var badge=(r.cat==='사람'&&r.subtype?r.subtype:r.cat);
    html+='<div class="wr-row">'+
      '<span class="wr-badge" style="background:'+col+'22;color:'+col+'">'+c.i+' '+esc(badge)+'</span>'+
      '<span class="wr-title" onclick="openDetail(\''+r.id+'\')">'+
        (esc(r.title)||esc(r.cat))+photoMark(r)+
      '</span>'+
      (sub?'<span class="wr-sub">'+sub+'</span>':'')+
      amt+
      '<span class="wr-acts">'+
        '<button class="wr-edit" onclick="wrEdit(\''+r.id+'\')">✏️</button>'+
        '<button class="wr-del" onclick="wrDel(\''+r.id+'\')">🗑</button>'+
      '</span>'+
    '</div>';
  });
  el.innerHTML=html;
  hydratePhotos();
}
function wrEdit(id){
  startEdit(id);
  openAddModal();
}
function wrDel(id){
  if(!confirm('삭제할까요?'))return;
  realDel(id);
  renderWriteList();renderCats();
}
function clearWrDate(){
  var f=$('wrDateFrom'),t=$('wrDateTo');
  if(f)f.value='';if(t)t.value='';
  renderWriteList();
}
function setWrFilter(k){
  wrFilter=k;
  renderWriteList();
  renderCats();  // 선택 카테고리 하이라이트
}
function startEdit(id){
  var r=getRecords().filter(function(x){return x.id===id;})[0];if(!r)return;
  editingId=id;selectedCat=r.cat;
  renderCats();
  renderForm(r);   // 전체 레코드 전달 (맞춤 폼이 추가 필드·items 복원)
  $('f-date').value=r.date;
  pendingPhotos=(r.photos&&r.photos.slice())||[];
  // 클라우드에만 있는 사진도 불러와서 편집 가능하게
  if((!r.photos||!r.photos.length)&&r.photoIds&&r.photoIds.length){
    r.photoIds.forEach(function(pid){fetchPhoto(pid).then(function(d){if(d){pendingPhotos.push(d);renderPending();}});});
  }
  renderPending();
  $('editBanner').classList.add('show');
  $('editBannerText').textContent='✏️ 수정 중 — '+(r.title||r.cat);
  $('saveBtn').textContent='✅ 수정 완료';
  // 기록 탭이 아니면 이동
  var writeTab=document.querySelector('.tab');
  if(writeTab&&!document.getElementById('p-write').classList.contains('active'))writeTab.click();
}
function cancelEdit(){
  editingId=null;pendingPhotos=[];formItems=[];
  $('editBanner').classList.remove('show');
  $('saveBtn').textContent='💾 저장하기';
  renderForm({});renderPending();
  var n=new Date();$('f-date').value=n.toISOString().slice(0,10);
}
function saveRecord(){
  var v=collectFields();
  var title=(v.title||'').trim(),detail=(v.detail||'').trim();
  var hasItems=formItems&&formItems.length;
  if(!title&&!detail&&!hasItems){toast('제목이나 내용을 입력하세요');return;}
  var records=getRecords();
  var id=editingId||String(Date.now());
  var photoIds=pendingPhotos.map(function(_,i){return id+'_'+i;});
  var amount=null;
  // 카테고리별 금액 계산
  if(selectedCat==='구매'){
    var unit=Number(v.unit||0),qty=Number(v.qty||0),ship=Number(v.ship||0);
    var base=unit*(qty||1)+(v.shipinc==='별도'?ship:0);
    if(v.cur==='달러'){var rate=Number(v.rate||0);amount=(base&&rate)?Math.round(base*rate):null;}
    else amount=base||null;
  }else if(selectedCat==='맛집'||selectedCat==='건강'||selectedCat==='여행'||selectedCat==='약속'){
    var s=formItems.reduce(function(a,it){return a+(Number(it.price)||0);},0);amount=s||null;
  }else if(selectedCat==='차계부'){
    if(v.title==='주유'){amount=v.amount?Number(v.amount):null;}
    else{var sc=formItems.reduce(function(a,it){return a+(Number(it.price)||0);},0);amount=sc||(v.amount?Number(v.amount):null);}
  }else if(v.amount){amount=Number(v.amount);}
  // 별점은 amount와 별개로 stars에
  var rec={
    id:id,cat:selectedCat,title:title,detail:detail,
    who:(v.who||'').trim(),amount:amount,
    odo:v.odo?Number(v.odo):null,liters:v.liters?Number(v.liters):null,
    phone:(v.phone||'').trim(),addr:(v.addr||'').trim(),
    date:$('f-date').value||new Date().toISOString().slice(0,10),
    time:'',
    photoIds:photoIds,
    created:editingId?(records.filter(function(x){return x.id===id;})[0]||{}).created||new Date().toISOString():new Date().toISOString(),
    updated:new Date().toISOString()
  };
  // 추가 필드 (있을 때만 저장)
  if(v.link)rec.link=v.link.trim();
  if(v.unit)rec.unit=Number(v.unit);
  if(v.qty)rec.qty=Number(v.qty);
  if(v.ship)rec.ship=Number(v.ship);
  if(v.shipinc)rec.shipinc=v.shipinc;
  if(v.stars)rec.stars=Number(v.stars);
  if(v.insur)rec.insur=v.insur;
  if(v.time2)rec.time2=v.time2;
  if(v.place)rec.place=v.place.trim();
  if(v.prep)rec.prep=v.prep.trim();
  if(v.booktype)rec.booktype=v.booktype;
  if(v.totalpg)rec.totalpg=Number(v.totalpg);
  if(v.readpg)rec.readpg=Number(v.readpg);
  if(v.fuelunit)rec.fuelunit=Number(v.fuelunit);
  if(v.cur)rec.cur=v.cur;
  if(v.rate)rec.rate=Number(v.rate);
  if(v.pay)rec.pay=v.pay;
  if(hasItems)rec.items=formItems.filter(function(it){
    return (it.name&&it.name.trim())||(it.price)||(it.quote&&it.quote.trim())||(it.thought&&it.thought.trim());
  });
  records=records.filter(function(x){return x.id!==id;});
  computeCar(rec,records);
  records.unshift(rec);setRecords(records);
  fbPush(rec);
  pendingPhotos.forEach(function(p,i){var pid=id+'_'+i;photoMem[pid]=p;fbPushPhoto(pid,p);});
  toast(editingId?'✏️ 수정됨':'✅ 저장됨');
  renderApptBanner();
  cancelEdit();
  closeAddModal();
  renderWriteList();
  renderCats();
}
/* 차계부: 같은 차량의 직전 주행거리 기록과 비교해 주행거리·연비 계산 */
function computeCar(rec,records){
  rec.trip=null;rec.kmpl=null;
  if(rec.cat!=='차계부'||!rec.odo)return;
  var prev=null,key=rec.date+rec.time;
  records.forEach(function(x){
    if(x.cat!=='차계부'||x.who!==rec.who||!x.odo)return;
    var k=x.date+x.time;
    if(k<key){if(!prev||k>(prev.date+prev.time))prev=x;}
  });
  if(prev&&rec.odo>prev.odo){
    rec.trip=rec.odo-prev.odo;
    if(rec.liters>0)rec.kmpl=Math.round((rec.trip/rec.liters)*10)/10;
  }
}


/* ===== 카테고리 내역 슬라이드 패널 ===== */
var cpCurCat='';
function openCatPane(k){
  cpCurCat=k;
  var c=catOf(k);
  var pane=$('catPane');if(!pane)return;
  pane.classList.add('open');
  pane.style.setProperty('--cp-accent',c.c);
  renderCatPane();
  function onKey(e){if(e.key==='Escape'){closeCatPane();document.removeEventListener('keydown',onKey);}}
  document.addEventListener('keydown',onKey);
  setTimeout(function(){
    document.addEventListener('click',function oCPO(e){
      var pn=$('catPane');if(!pn)return;
      if(pn.contains(e.target)||e.target.classList.contains('cat-peek-btn'))return;
      closeCatPane();document.removeEventListener('click',oCPO,true);
    },true);
  },50);
}
function renderCatPane(){
  var k=cpCurCat;
  var c=catOf(k);
  var arr=getRecords().filter(function(r){return r.cat===k;});
  arr.sort(function(a,b){return (b.date+(b.time||'')).localeCompare(a.date+(a.time||''));});
  /* 헤더 */
  $('catPaneTitle').innerHTML=c.i+' '+esc(k)+' <span class="cp-cnt">'+arr.length+'건</span>';
  /* 빠른 입력 폼 */
  var today=new Date().toISOString().slice(0,10);
  var qf='<div class="cp-quick-form" id="cpQuickForm">'+
    '<div class="cp-qf-row">'+
      '<input type="date" id="cpDate" value="'+today+'" class="cp-qinput cp-date-in">'+
      '<input type="text" id="cpTitle" placeholder="제목 (필수)" class="cp-qinput" style="flex:1">'+
      '<input type="text" id="cpWho" placeholder="관련" class="cp-qinput cp-who-in">'+
      '<input type="number" id="cpAmt" placeholder="금액" class="cp-qinput cp-amt-in">'+
    '</div>'+
    '<textarea id="cpDetail" placeholder="내용 (선택)" class="cp-qtextarea" rows="2"></textarea>'+
    '<button class="cp-qsave" onclick="saveCatQuick()">＋ '+esc(k)+' 저장</button>'+
  '</div>';
  /* 목록 */
  var list=arr.length?arr.map(function(r){
    var amt='';
    if(r.cat==='독서'&&r.stars){amt='<span class="cp-amt-tag">'+'⭐'.repeat(Math.min(5,Math.round(r.stars)))+'</span>';}
    else if(r.amount){amt='<span class="cp-amt-tag">'+won(r.amount)+'원</span>';}
    return '<div class="cp-row2" id="cpr_'+r.id+'">'+
      '<div class="cp-row2-main" onclick="openDetail(\''+r.id+'\')">'+
        '<span class="cp-date2">'+r.date.slice(5).replace('-','/')+'</span>'+
        '<span class="cp-title2">'+(esc(r.title)||esc(k))+(photoMark(r)||'')+'</span>'+
        '<span class="cp-sub2">'+rowSummary(r)+'</span>'+
        amt+
      '</div>'+
      '<div class="cp-row2-acts">'+
        '<button class="cp-edit-btn" onclick="cpEditRow(\''+r.id+'\')">✏️</button>'+
        '<button class="cp-del-btn" onclick="cpDelRow(\''+r.id+'\')">🗑</button>'+
      '</div>'+
      '<div class="cp-inline-edit" id="cpe_'+r.id+'" style="display:none">'+
        '<div class="cp-qf-row">'+
          '<input type="date" id="cped_date_'+r.id+'" value="'+r.date+'" class="cp-qinput cp-date-in">'+
          '<input type="text" id="cped_title_'+r.id+'" value="'+esc(r.title||'')+'" placeholder="제목" class="cp-qinput" style="flex:1">'+
          '<input type="text" id="cped_who_'+r.id+'" value="'+esc(r.who||'')+'" placeholder="관련" class="cp-qinput cp-who-in">'+
          '<input type="number" id="cped_amt_'+r.id+'" value="'+(r.amount||'')+'" placeholder="금액" class="cp-qinput cp-amt-in">'+
        '</div>'+
        '<textarea id="cped_detail_'+r.id+'" class="cp-qtextarea" rows="2">'+esc(r.detail||'')+'</textarea>'+
        '<div class="cp-edit-btns">'+
          '<button class="cp-qsave" onclick="cpSaveRow(\''+r.id+'\')">✅ 저장</button>'+
          '<button class="cp-qcancel" onclick="cpCancelRow(\''+r.id+'\')">취소</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join(''):'<div class="cp-empty">기록이 없어요 — 위에서 바로 추가하세요</div>';
  $('catPaneList').innerHTML=qf+'<div class="cp-list-inner">'+list+'</div>';
}
function saveCatQuick(){
  var title=($('cpTitle')||{}).value||'';title=title.trim();
  if(!title){$('cpTitle').focus();$('cpTitle').style.borderColor='#EF4444';return;}
  $('cpTitle').style.borderColor='';
  var id=String(Date.now());
  var rec={id:id,cat:cpCurCat,date:($('cpDate')||{}).value||new Date().toISOString().slice(0,10),
    title:title,who:($('cpWho')||{}).value||'',
    amount:Number(($('cpAmt')||{}).value||0)||undefined,
    detail:($('cpDetail')||{}).value||'',
    created:new Date().toISOString()};
  if(!rec.amount)delete rec.amount;
  var recs=getRecords();recs.unshift(rec);setRecords(recs);
  fbPush(rec);
  toast('✅ '+esc(cpCurCat)+' 저장됨');
  renderCatPane();renderCats();
}
function cpEditRow(id){
  // 다른 열린 수정 닫기
  document.querySelectorAll('.cp-inline-edit').forEach(function(el){el.style.display='none';});
  var el=document.getElementById('cpe_'+id);if(el)el.style.display='block';
}
function cpCancelRow(id){var el=document.getElementById('cpe_'+id);if(el)el.style.display='none';}
function cpSaveRow(id){
  var recs=getRecords();var r=recs.find(function(x){return x.id===id;});if(!r)return;
  r.date=($('cped_date_'+id)||{}).value||r.date;
  r.title=($('cped_title_'+id)||{}).value||r.title;
  r.who=($('cped_who_'+id)||{}).value||'';
  r.amount=Number(($('cped_amt_'+id)||{}).value||0)||undefined;
  if(!r.amount)delete r.amount;
  r.detail=($('cped_detail_'+id)||{}).value||'';
  setRecords(recs);fbPush(r);
  toast('✏️ 수정됨');renderCatPane();renderCats();
}
function cpDelRow(id){
  if(!confirm('이 기록을 삭제할까요?'))return;
  var recs=getRecords().filter(function(x){return x.id!==id;});setRecords(recs);
  fbDelete(COL,id);
  toast('🗑 삭제됨');renderCatPane();renderCats();
}
function closeCatPane(){var p=$('catPane');if(p)p.classList.remove('open');cpCurCat='';}
/* ===== 모아보기 ===== */
var listFilter='전체';
var carFilter='전체';
var viewMode='list';   // 기본을 목록으로
function setView(m){
  viewMode=m;
  try{localStorage.setItem('personal_viewMode',m);}catch(e){}
  $('vtList').className='vt-btn'+(m==='list'?' sel':'');
  $('vtCard').className='vt-btn'+(m==='card'?' sel':'');
  renderList();
}

/* ===== 구 카테고리 → 사람 마이그레이션 (1회) ===== */
function migratePersonCat(){
  var MIG_KEY='personal_person_migrated_v1';
  if(localStorage.getItem(MIG_KEY))return;
  var recs=getRecords();var changed=false;
  var MAP={'통화':'통화','가족':'가족','약속':'약속'};
  recs.forEach(function(r){
    if(MAP[r.cat]){
      r.subtype=MAP[r.cat]; // 구분 보존
      // 가족 제목이 없으면 who를 title로
      if(r.cat==='가족'&&!r.title&&r.who){r.title=r.who;}
      r.cat='사람'; changed=true;
    }
    // 아이디어 → 생각
    if(r.cat==='아이디어'){r.cat='생각';changed=true;}
  });
  if(changed)setRecords(recs);
  localStorage.setItem(MIG_KEY,'1');
}
function initViewMode(){
  try{var s=localStorage.getItem('personal_viewMode');if(s==='card'||s==='list')viewMode=s;}catch(e){}
}
function renderFilters(){
  var recs=getRecords();
  var cnt={};recs.forEach(function(r){cnt[r.cat]=(cnt[r.cat]||0)+1;});
  var h='<div class="filter-chip'+(listFilter==='전체'?' sel':'')+'" onclick="setFilter(\'전체\')">전체 <b>'+recs.length+'</b></div>';
  // 기록 많은 순으로 정렬, 0건은 뒤로+흐리게
  var sorted=CATS.slice().sort(function(a,b){return (cnt[b.k]||0)-(cnt[a.k]||0);});
  sorted.forEach(function(c){
    var n=cnt[c.k]||0;
    var cls='filter-chip'+(listFilter===c.k?' sel':'')+(n===0?' empty':'');
    h+='<div class="'+cls+'" onclick="setFilter(\''+c.k+'\')">'+c.i+' '+c.k+(n?' <b>'+n+'</b>':'')+'</div>';
  });
  $('filterRow').innerHTML=h;
  var carRow=document.getElementById('carFilterRow');
  if(carRow){
    if(listFilter==='차계부'){
      var carCnt={};recs.forEach(function(r){if(r.cat==='차계부'&&r.who)carCnt[r.who]=(carCnt[r.who]||0)+1;});
      var cars=['전체'];getRecords().forEach(function(r){if(r.cat==='차계부'&&r.who&&cars.indexOf(r.who)<0)cars.push(r.who);});
      carRow.innerHTML=cars.map(function(v){
        var col=(CAR_COLORS[v]||'#0891B2');
        var on=carFilter===v;
        var n=v==='전체'?Object.keys(carCnt).reduce(function(s,k){return s+carCnt[k];},0):(carCnt[v]||0);
        var dot=v==='전체'?'🚗 ':'<span class="lg-dot" style="background:'+col+'"></span>';
        var style=on?('background:'+col+';color:#fff;border-color:'+col):'';
        return '<div class="filter-chip car-chip'+(on?' sel':'')+'" style="'+style+'" onclick="setCarFilter(\''+v+'\')">'+dot+v+' <b>'+n+'</b></div>';
      }).join('');
      carRow.style.display='flex';
    }else{carRow.style.display='none';}
  }
}
function setFilter(k){listFilter=k;carFilter='전체';renderFilters();renderList();}
function setCarFilter(v){carFilter=v;renderFilters();renderList();}
function renderList(){
  renderFilters();
  var arr=getRecords().filter(function(r){
    if(listFilter!=='전체'&&r.cat!==listFilter)return false;
    if(listFilter==='차계부'&&carFilter!=='전체'&&r.who!==carFilter)return false;
    return true;
  });
  $('listArea').innerHTML=arr.length?groupByDate(arr):'<div class="empty">아직 기록이 없어요</div>';
  hydratePhotos();
}
function copyListExcel(){
  var arr=getRecords().filter(function(r){
    if(listFilter!=='전체'&&r.cat!==listFilter)return false;
    if(listFilter==='차계부'&&carFilter!=='전체'&&r.who!==carFilter)return false;
    return true;
  });
  if(!arr.length){toast('복사할 기록이 없어요');return;}
  arr.sort(function(a,b){return (b.date+(b.time||'')).localeCompare(a.date+(a.time||''));});
  var rows=[['날짜','분류','제목','상세','관련','금액'].join('\t')];
  arr.forEach(function(r){
    var detail=(r.detail||'').replace(/\s+/g,' ').trim();
    if(r.items&&r.items.length){
      var its=r.items.map(function(it){
        if(it.quote!=null)return (it.quote||'')+(it.thought?' / '+it.thought:'');
        return (it.type?it.type+' ':'')+(it.name||'')+(it.price?' '+it.price+'원':'')+(it.people?' '+it.people+'명':'');
      }).join(' | ');
      detail=(detail?detail+' | ':'')+its;
    }
    var cell=function(x){return String(x==null?'':x).replace(/\t/g,' ').replace(/\n/g,' ');};
    rows.push([r.date,r.cat,cell(r.title),cell(detail),cell(r.who||r.addr||''),(r.amount||'')].join('\t'));
  });
  var tsv=rows.join('\n');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(tsv).then(function(){toast('📋 '+arr.length+'건 복사됨 — 엑셀에 붙여넣기');}).catch(function(){fallbackCopy(tsv,arr.length);});
  }else fallbackCopy(tsv,arr.length);
}
function fallbackCopy(text,n){
  var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');toast('📋 '+n+'건 복사됨 — 엑셀에 붙여넣기');}catch(e){toast('복사 실패');}
  document.body.removeChild(ta);
}
function groupByDate(arr){
  arr.sort(function(a,b){return (b.date+b.time).localeCompare(a.date+a.time);});
  if(viewMode==='list')return tableView(arr);
  var html='',curr='';
  arr.forEach(function(r){if(r.date!==curr){curr=r.date;html+='<div class="date-group">'+fmtDate(r.date)+'</div>';}html+=recCard(r);});
  return html;
}
/* 날짜별로 묶기 (헤더 밴드 + 행) */
function groupRows(arr,rowFn){
  arr.sort(function(a,b){return (b.date+(b.time||'')).localeCompare(a.date+(a.time||''));});
  var html='',curr=null,bucket=[];
  function flush(){
    if(!bucket.length)return;
    html+='<div class="day-band">📅 '+fmtDateK(curr)+' <span class="day-cnt">'+bucket.length+'건</span></div>';
    html+='<div class="tbl">'+bucket.map(rowFn).join('')+'</div>';
    bucket=[];
  }
  arr.forEach(function(r){if(r.date!==curr){flush();curr=r.date;}bucket.push(r);});
  flush();
  return html||'<div class="empty">기록이 없어요</div>';
}
function catBadge(r){
  var col=evtColor(r),c=catOf(r.cat);
  var label=(r.cat==='차계부'&&r.who)?r.who:(r.cat==='사람'&&r.subtype?r.subtype:c.k);
  return '<span class="cat-badge" style="background:'+col+'1A;color:'+col+'">'+c.i+' '+esc(label)+'</span>';
}
/* 표 목록 (날짜 그룹 + 한 줄 행) */
function tableView(arr){
  return groupRows(arr,function(r){
    var amt='';
    if(r.cat==='독서'){amt=r.stars?('⭐'+r.stars):'';}
    else if(r.amount){amt=won(r.amount)+'원';}
    return '<div class="lrow1" onclick="openDetail(\''+r.id+'\')">'+
      '<span class="l1-date">'+r.date.slice(5).replace('-','/')+'</span>'+
      catBadge(r)+
      '<span class="l1-title">'+(esc(r.title)||r.cat)+photoMark(r)+'</span>'+
      '<span class="l1-sub">'+rowSummary(r)+'</span>'+
      '<span class="l1-amt'+(r.cat==='독서'?' star':'')+'">'+amt+'</span></div>';
  });
}
/* 한 줄 요약: 그 기록의 핵심 정보를 카테고리별로 */
function rowSummary(r){
  var s=[];
  function items(){return (r.items||[]).map(function(it){
    if(it.quote!=null)return null;
    return (it.name||'')+(it.price?' '+won(it.price)+'원':'')+(it.people?'('+it.people+'명)':'');
  }).filter(Boolean);}
  if(r.cat==='차계부'){
    if(r.who)s.push(r.who);
    if(r.odo)s.push('📍'+won(r.odo)+'㎞');
    if(r.title==='주유'){
      if(r.liters)s.push('⛽'+r.liters+'L');
      if(r.fuelunit)s.push('@'+won(r.fuelunit)+'원');
      if(r.kmpl)s.push(r.kmpl+'㎞/L');
    }else{
      var its=items();if(its.length)s.push(its.join(', '));
    }
    if(r.addr)s.push('🔧'+esc(r.addr));
  }else if(r.cat==='구매'){
    if(r.who)s.push(esc(r.who));
    if(r.cur==='달러'){
      if(r.unit)s.push('$'+won(r.unit)+(r.qty?'×'+r.qty:''));
      if(r.rate)s.push('환율'+won(r.rate));
    }else{
      if(r.unit&&r.qty)s.push(won(r.unit)+'원×'+r.qty);
    }
    if(r.ship)s.push('택배'+(r.cur==='달러'?'$':'')+won(r.ship));
    if(r.pay)s.push(payIcon(r.pay));
    if(r.link)s.push('🔗링크');
  }else if(r.cat==='맛집'){
    if(r.who)s.push(esc(r.who));
    var its2=items();if(its2.length)s.push(its2.join(', '));
    if(r.stars)s.push('⭐'+r.stars);
  }else if(r.cat==='건강'){
    if(r.who)s.push(esc(r.who));
    var its3=(r.items||[]).map(function(it){return (it.type||'')+(it.name?' '+it.name:'')+(it.price?' '+won(it.price)+'원':'');}).filter(Boolean);
    if(its3.length)s.push(its3.join(', '));
    if(r.insur&&r.insur!=='해당없음')s.push('🏥'+r.insur);
  }else if(r.cat==='여행'){
    if(r.who)s.push(esc(r.who));
    var its4=items();if(its4.length)s.push(its4.join(', '));
  }else if(r.cat==='사람'){
    var sub=(r.subtype==='약속'?'만남':r.subtype)||'';
    if(r.who)s.push(esc(r.who));
    if(sub==='만남'||sub==='가족'){if(r.time2)s.push('🕐'+esc(r.time2));if(r.place)s.push('📍'+esc(r.place));if(r.prep)s.push('🎒'+esc(r.prep));}
    else{if(r.phone)s.push('📞'+esc(r.phone));}
    if(sub)s.push('['+sub+']');
  }else if(r.cat==='독서'){
    if(r.who)s.push(esc(r.who));
    if(r.booktype)s.push(r.booktype);
    if(r.totalpg)s.push((r.readpg||0)+'/'+r.totalpg+'쪽('+Math.min(100,Math.round((r.readpg||0)/r.totalpg*100))+'%)');
    if(r.items&&r.items.length)s.push('📜'+r.items.length+'개');
  }else if(r.cat==='생각'){
    if(r.items&&r.items.length)s.push('💭'+r.items.length+'개');
    else if(r.detail)s.push(esc(r.detail.replace(/\n/g,' ')));
  }else{
    if(r.who)s.push(esc(r.who));
    if(r.detail)s.push(esc(r.detail.replace(/\n/g,' ')));
    if(r.phone)s.push('📞'+esc(r.phone));
  }
  return s.join(' · ');
}
function photoMark(r){return ((r.photoIds&&r.photoIds.length)||(r.photos&&r.photos.length))?' <span class="pmark">📷</span>':'';}
function fmtDateK(d){var dd=['일','월','화','수','목','금','토'];var t=new Date(d+'T00:00');var mo=parseInt(d.slice(5,7),10),da=parseInt(d.slice(8,10),10);return mo+'월 '+da+'일 ('+dd[t.getDay()]+')';}
function fmtDate(d){var dd=['일','월','화','수','목','금','토'];var t=new Date(d+'T00:00');return d+' ('+dd[t.getDay()]+')';}
function metaHtml(r){
  var m='';
  if(r.who)m+='<span>'+(r.cat==='차계부'?'🚗':(r.cat==='독서'?'✍️':'👤'))+' <b>'+esc(r.who)+'</b></span>';
  if(r.stars){var n=Math.max(0,Math.min(5,Math.round(r.stars)));m+='<span>'+'⭐'.repeat(n)+'</span>';}
  if(r.amount&&r.cat!=='독서')m+='<span>💰 <b>'+won(r.amount)+'원</b></span>';
  if(r.cat==='독서'){
    if(r.booktype)m+='<span>'+(r.booktype==='전자책'?'📱':'📕')+' '+r.booktype+'</span>';
    if(r.totalpg)m+='<span>📖 <b>'+(r.readpg||0)+'/'+r.totalpg+'쪽</b> ('+Math.min(100,Math.round((r.readpg||0)/r.totalpg*100))+'%)</span>';
  }
  if(r.cat==='사람'&&r.subtype==='약속'){
    if(r.time2)m+='<span>🕐 <b>'+esc(r.time2)+'</b></span>';
    if(r.place)m+='<span>📍 <b>'+esc(r.place)+'</b></span>';
  }
  if(r.cat==='건강'&&r.insur&&r.insur!=='해당없음')m+='<span>🏥 보험 '+esc(r.insur)+'</span>';
  if(r.cat==='차계부'){
    if(r.odo)m+='<span>📍 <b>'+won(r.odo)+'㎞</b></span>';
    if(r.trip)m+='<span>주행 <b>'+won(r.trip)+'㎞</b></span>';
    if(r.kmpl)m+='<span>⛽ <b>'+r.kmpl+'㎞/L</b></span>';
  }
  return m;
}
/* 상세보기 카테고리별 추가 블록 */
function detailExtra(r){
  var h='';
  if(r.cat==='구매'){
    var parts=[];
    var unitLbl=r.cur==='달러'?'$':'';var unitSuf=r.cur==='달러'?'':'원';
    if(r.unit)parts.push('단가 '+unitLbl+won(r.unit)+unitSuf);
    if(r.qty)parts.push('×'+r.qty+'개');
    if(r.ship)parts.push('택배비 '+unitLbl+won(r.ship)+unitSuf+(r.shipinc==='포함'?'(포함)':''));
    if(r.cur==='달러'&&r.rate)parts.push('환율 '+won(r.rate)+'원');
    if(parts.length)h+='<div class="dx-line">🧮 '+parts.join(' · ')+(r.cur==='달러'&&r.amount?'  →  '+won(r.amount)+'원':'')+'</div>';
    if(r.pay)h+='<div class="dx-line">'+payIcon(r.pay)+' 결제수단: '+esc(r.pay)+'</div>';
    if(r.link)h+='<a href="'+esc(r.link)+'" target="_blank" class="dx-link">🔗 쇼핑몰에서 보기 ›</a>';
  }
  if(r.cat==='차계부'&&r.title==='주유'){
    var fp=[];
    if(r.liters)fp.push('주유량 '+r.liters+'L');
    if(r.fuelunit)fp.push('단가 '+won(r.fuelunit)+'원/L');
    if(r.amount)fp.push('금액 '+won(r.amount)+'원');
    if(fp.length)h+='<div class="dx-line">⛽ '+fp.join(' · ')+'</div>';
  }
  // 항목 리스트가 있는 카테고리 (맛집/건강/여행/약속/정비)
  if((r.cat==='맛집'||r.cat==='건강'||r.cat==='여행'||(r.cat==='사람'&&(r.subtype==='만남'||r.subtype==='약속'))||r.cat==='차계부')&&r.items&&r.items.length){
    h+='<div class="dx-items">';
    r.items.forEach(function(it){
      var left=(it.type?'<span class="dx-type">'+esc(it.type)+'</span> ':'')+esc(it.name||'');
      var right=(it.price?won(it.price)+'원':'');
      if(r.cat==='맛집'&&it.people)right=(it.price?won(it.price)+'원':'')+' <span class="dx-ppl">'+it.people+'명</span>';
      h+='<div class="dx-item"><span class="dx-iname">'+left+'</span><span class="dx-price">'+right+'</span></div>';
    });
    if(r.amount)h+='<div class="dx-item dx-sum"><span>합계</span><span class="dx-price">'+won(r.amount)+'원</span></div>';
    h+='</div>';
  }
  if(r.cat==='사람'&&(r.subtype==='만남'||r.subtype==='약속')&&r.prep)h+='<div class="dx-line">🎒 준비물: '+esc(r.prep)+'</div>';
  // 생각/독서 짝 비교
  if((r.cat==='독서'||r.cat==='생각')&&r.items&&r.items.length){
    var tag1=r.cat==='독서'?'📜 핵심':'💭 생각',tag2=r.cat==='독서'?'💡 생각':'📝 자세히';
    h+='<div class="dx-quotes">';
    r.items.forEach(function(it,i){
      h+='<div class="dx-quote"><div class="dx-q"><span class="dx-qtag">'+tag1+' '+(i+1)+'</span>'+esc(it.quote||'')+'</div>'+
        (it.thought?'<div class="dx-t"><span class="dx-qtag think">'+tag2+'</span>'+esc(it.thought)+'</div>':'')+'</div>';
    });
    h+='</div>';
  }
  return h;
}
function recCard(r){
  var c=catOf(r.cat);
  var photos='';
  if(r.photos&&r.photos.length){
    photos='<div class="rec-photos">'+r.photos.map(function(p){return '<img src="'+p+'" onclick="event.stopPropagation();showImg(this.src)">';}).join('')+'</div>';
  } else if(r.photoIds&&r.photoIds.length){
    photos='<div class="rec-photos" data-photoids="'+r.photoIds.join(',')+'">'+r.photoIds.map(function(){return '<div class="ph-load">…</div>';}).join('')+'</div>';
  }
  var meta=metaHtml(r);
  return '<div class="rec" style="border-left-color:'+c.c+';cursor:pointer" onclick="openDetail(\''+r.id+'\')">'+
    '<div class="rec-top"><span class="rec-cat" style="background:'+c.bg+';color:'+c.c+'">'+c.i+' '+r.cat+'</span><span class="rec-time">'+(r.time?r.time+' ':'')+'›</span></div>'+
    (r.title?'<div class="rec-title">'+esc(r.title)+'</div>':'')+
    (r.detail?'<div class="rec-detail">'+esc(r.detail)+'</div>':'')+
    (meta?'<div class="rec-meta">'+meta+'</div>':'')+photos+
    '<div class="rec-actions"><button class="rec-act rec-edit" onclick="event.stopPropagation();startEdit(\''+r.id+'\')">✏️ 수정</button>'+
    '<button class="rec-act rec-del" onclick="event.stopPropagation();delRec(\''+r.id+'\')">🗑 삭제</button></div></div>';
}
/* ===== 상세 보기 ===== */
function openDetail(id){
  var r=getRecords().filter(function(x){return x.id===id;})[0];if(!r)return;
  var c=catOf(r.cat);
  var meta=metaHtml(r);
  var photosHtml='';
  if(r.photos&&r.photos.length){
    photosHtml='<div class="detail-photos">'+r.photos.map(function(p){return '<img src="'+p+'" onclick="showImg(this.src)">';}).join('')+'</div>';
  } else if(r.photoIds&&r.photoIds.length){
    photosHtml='<div class="detail-photos" data-photoids="'+r.photoIds.join(',')+'">'+r.photoIds.map(function(){return '<div class="ph-load">사진 불러오는 중…</div>';}).join('')+'</div>';
  }
  $('detailCard').innerHTML=
    '<span class="detail-cat" style="background:'+c.bg+';color:'+c.c+'">'+c.i+' '+r.cat+'</span>'+
    '<h2>'+(esc(r.title)||'(제목 없음)')+'</h2>'+
    '<div class="detail-when">'+fmtDate(r.date)+(r.time?' · '+r.time:'')+'</div>'+
    (meta?'<div class="detail-meta" style="margin-top:12px">'+meta+'</div>':'')+
    contactBlock(r)+
    detailExtra(r)+
    (r.detail?'<div class="detail-body">'+esc(r.detail)+'</div>':'')+
    photosHtml+
    mapBtn(r)+
    '<div class="btn-row" style="margin-top:18px">'+
      '<button class="btn btn-ghost" onclick="closeDetail();startEdit(\''+r.id+'\')">✏️ 수정</button>'+
      '<button class="btn btn-ghost" style="color:#EF4444" onclick="if(confirm(\'삭제할까요?\')){realDel(\''+r.id+'\');closeDetail();}">🗑 삭제</button>'+
    '</div>'+
    '<button class="btn btn-primary" onclick="closeDetail()">닫기</button>';
  $('detailBg').classList.add('open');
  var holder=$('detailCard').querySelector('.detail-photos[data-photoids]');
  if(holder){
    var ids=holder.getAttribute('data-photoids').split(',');holder.removeAttribute('data-photoids');
    ids.forEach(function(pid,idx){fetchPhoto(pid).then(function(d){
      if(d&&holder.children[idx]){var im=document.createElement('img');im.src=d;im.onclick=function(){showImg(d);};holder.replaceChild(im,holder.children[idx]);}
    });});
  }
}
function closeDetail(){$('detailBg').classList.remove('open');}
/* 전화·주소 블록 (눌러서 전화걸기 / 지도) */
function contactBlock(r){
  var h='';
  if(r.phone)h+='<a href="tel:'+esc(r.phone.replace(/[^0-9+]/g,''))+'" class="contact-row">📞 <b>'+esc(r.phone)+'</b><span class="contact-go">전화걸기 ›</span></a>';
  if(r.addr)h+='<div class="contact-row" onclick="openMap(\''+encodeURIComponent(r.addr).replace(/'/g,"%27")+'\')" style="cursor:pointer">📍 <b>'+esc(r.addr)+'</b><span class="contact-go">지도 ›</span></div>';
  return h;
}
/* 맛집·여행 등: 주소 우선, 없으면 가게명+위치로 네이버지도 */
function mapBtn(r){
  if(r.addr)return '';  // 주소가 있으면 위 contactBlock의 지도 링크로 충분
  if(r.cat!=='맛집'&&r.cat!=='여행')return '';
  var q=[r.title,r.who].filter(Boolean).join(' ').trim();
  if(!q)return '';
  return '<button class="btn btn-ghost" style="color:#03C75A;margin-top:12px" onclick="openMap(\''+encodeURIComponent(q).replace(/'/g,"%27")+'\')">🗺️ 네이버지도에서 보기</button>';
}
function openMap(enc){
  var q=decodeURIComponent(enc);
  window.open('https://map.naver.com/p/search/'+encodeURIComponent(q),'_blank');
}
function delRec(id){
  if(!confirm('이 기록을 삭제할까요?'))return;
  realDel(id);
}
function realDel(id){
  var records=getRecords();
  var r=records.filter(function(x){return x.id===id;})[0];
  setRecords(records.filter(function(x){return x.id!==id;}));
  fbDelete(COL,id);
  if(r&&r.photoIds)r.photoIds.forEach(function(pid){fbDelete(COL_PHOTO,pid);});
  renderList();
  toast('삭제됨');
}
/* 클라우드 전용 사진 lazy 로딩 */
function hydratePhotos(){
  var holders=document.querySelectorAll('.rec-photos[data-photoids]');
  holders.forEach(function(h){
    var ids=h.getAttribute('data-photoids').split(',');h.removeAttribute('data-photoids');
    ids.forEach(function(pid,idx){
      fetchPhoto(pid).then(function(d){
        if(d&&h.children[idx]){var img=document.createElement('img');img.src=d;img.onclick=function(){showImg(d);};h.replaceChild(img,h.children[idx]);}
      });
    });
  });
}

/* ===== 검색 ===== */
function doSearch(){globalSearch();}
function globalSearch(){
  var inp=$('gSearchInput'); if(!inp)return;
  var q=inp.value.trim().toLowerCase();
  var area=$('gSearchDrop'); if(!area)return;
  var clr=$('gSearchClear'); if(clr)clr.style.display=q?'flex':'none';
  if(!q){area.classList.remove('open');return;}
  var hit=getRecords().filter(function(r){
    return ([r.title,r.detail,r.who,r.cat,r.date,r.addr,r.phone,r.place].join(' ')).toLowerCase().indexOf(q)>-1;
  });
  area.innerHTML=hit.length
    ?('<div class="gs-hdr">🔍 <b>'+hit.length+'건</b> 찾음<button class="gs-close" onclick="clearGSearch()">✕</button></div>'+groupByDate(hit))
    :'<div class="gs-hdr">🔍 <b>"'+esc(q)+'"</b> — 결과 없음<button class="gs-close" onclick="clearGSearch()">✕</button></div>';
  area.classList.add('open');
  hydratePhotos();
}
function clearGSearch(){
  var inp=$('gSearchInput');if(inp)inp.value='';
  var area=$('gSearchDrop');if(area)area.classList.remove('open');
  var clr=$('gSearchClear');if(clr)clr.style.display='none';
}

/* ===== Firebase REST ===== */
function toFS(o){var f={};Object.keys(o).forEach(function(k){var v=o[k];
  if(v===null||v===undefined)f[k]={nullValue:null};
  else if(typeof v==='number')f[k]={doubleValue:v};
  else if(typeof v==='boolean')f[k]={booleanValue:v};
  else if(typeof v==='object')f[k]={stringValue:'§JSON§'+JSON.stringify(v)};
  else f[k]={stringValue:String(v)};});return {fields:f};}
function fsVal(v){if(!v)return null;
  if('stringValue'in v){var s=v.stringValue;if(s&&s.indexOf('§JSON§')===0){try{return JSON.parse(s.slice(6));}catch(e){return null;}}return s;}
  if('doubleValue'in v)return Number(v.doubleValue);if('integerValue'in v)return Number(v.integerValue);if('booleanValue'in v)return v.booleanValue;if('nullValue'in v)return null;return null;}
function fromFS(doc){if(!doc||!doc.fields)return null;var o={};Object.keys(doc.fields).forEach(function(k){o[k]=fsVal(doc.fields[k]);});return o;}

function fbPush(rec){try{
  var copy={id:rec.id,cat:rec.cat,title:rec.title,detail:rec.detail,who:rec.who,amount:rec.amount,date:rec.date,time:rec.time,
    odo:rec.odo,liters:rec.liters,trip:rec.trip,kmpl:rec.kmpl,
    phone:rec.phone,addr:rec.addr,
    photoIds:(rec.photoIds||[]).join(','),created:rec.created,updated:rec.updated};
  fetch(FB_BASE+'/'+COL+'/'+rec.id+'?key='+FB_KEY,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(toFS(copy))})
    .catch(function(e){logErr('Firebase 기록 동기화 실패: '+e.message);});
}catch(e){logErr('fbPush: '+e.message);}}

function fbPushPhoto(pid,data){try{
  fetch(FB_BASE+'/'+COL_PHOTO+'/'+pid+'?key='+FB_KEY,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(toFS({data:data}))})
    .catch(function(e){logErr('사진 업로드 실패: '+e.message);});
}catch(e){logErr('fbPushPhoto: '+e.message);}}

function fbDelete(col,id){try{fetch(FB_BASE+'/'+col+'/'+id+'?key='+FB_KEY,{method:'DELETE'}).catch(function(){});}catch(e){}}

function fetchPhoto(pid){
  if(photoMem[pid])return Promise.resolve(photoMem[pid]);
  return fetch(FB_BASE+'/'+COL_PHOTO+'/'+pid+'?key='+FB_KEY).then(function(r){return r.json();}).then(function(d){
    var o=fromFS(d);if(o&&o.data){photoMem[pid]=o.data;return o.data;}return null;
  }).catch(function(e){logErr('사진 조회 실패: '+e.message);return null;});
}

/* 다른 기기 기록 불러와 병합 */
function pullRecords(){
  return fetch(FB_BASE+'/'+COL+'?key='+FB_KEY+'&pageSize=300').then(function(r){return r.json();}).then(function(d){
    if(!d.documents)return;
    var local=getRecords(),map={};local.forEach(function(r){map[r.id]=r;});
    d.documents.forEach(function(doc){
      var o=fromFS(doc);if(!o||!o.id)return;
      if(!map[o.id]){ // 로컬에 없는 것만 추가 (사진은 photoIds로 lazy 로딩)
        o.photoIds=o.photoIds?String(o.photoIds).split(',').filter(Boolean):[];
        o.photos=[];o.amount=o.amount||null;map[o.id]=o;
      }
    });
    var merged=Object.keys(map).map(function(k){return map[k];});
    setRecords(merged);
  }).catch(function(e){logErr('기록 불러오기 실패: '+e.message);});
}

/* 연결 상태 표시 */
function pingFB(){
  fetch(FB_BASE+'/'+COL+'?key='+FB_KEY+'&pageSize=1').then(function(r){
    if(r.ok){$('fbDot').className='dot on';$('fbText').textContent='클라우드 연결됨';}
    else{$('fbDot').className='dot off';$('fbText').textContent='연결 오류 '+r.status;}
  }).catch(function(){$('fbDot').className='dot off';$('fbText').textContent='오프라인';});
}

/* ===== AI (Claude) ===== */
function isKey(){return !!localStorage.getItem(API_KEY);}
function setApiBtn(){var b=$('apiBtn');var on=isKey();b.textContent=on?'AI ON':'AI';b.className='api-btn '+(on?'on':'off');}
function openApi(){$('apiInput').value=localStorage.getItem(API_KEY)||'';$('apiModal').classList.add('open');}
function closeApi(){$('apiModal').classList.remove('open');}
function saveApi(){var k=$('apiInput').value.trim();if(k)localStorage.setItem(API_KEY,k);else localStorage.removeItem(API_KEY);setApiBtn();closeApi();toast('AI 키 저장됨');}

function recContext(limit){
  return getRecords().slice(0,limit||90).map(function(r){
    var car=r.cat==='차계부'?((r.odo?' [주행 '+r.odo+'㎞]':'')+(r.trip?' [구간 '+r.trip+'㎞]':'')+(r.kmpl?' [연비 '+r.kmpl+'㎞/L]':'')+(r.liters?' [주유 '+r.liters+'L]':'')):'';
    return '['+r.date+' '+r.time+'] '+r.cat+' | '+r.title+(r.detail?' - '+r.detail:'')+(r.who?' (대상:'+r.who+')':'')+(r.amount?' (금액:'+r.amount+'원)':'')+car;
  }).join('\n');
}
async function askAI(prompt){
  var key=localStorage.getItem(API_KEY);
  if(!key){openApi();throw new Error('AI 키 없음');}
  var res=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:AI_MODEL,max_tokens:1000,messages:[{role:'user',content:prompt}]})
  });
  var d=await res.json();
  if(d.error)throw new Error((d.error.message||'API 오류'));
  var t=d.content&&d.content[0]&&d.content[0].text;
  if(!t)throw new Error('빈 응답');
  return t;
}
async function runAnalysis(){
  if(!isKey()){openApi();return;}
  var out=$('aiOut');out.style.display='block';out.textContent='분석 중...';
  var ctx=recContext(120);
  if(!ctx){out.textContent='기록이 없어요.';return;}
  var prompt='다음은 사용자의 개인 생활 기록이야. 따뜻하고 간결하게 분석해줘.\n\n'+ctx+
    '\n\n다음을 정리해줘:\n1. 요즘 반복되는 패턴이나 관심사\n2. 챙겨야 할 일/잊은 것 같은 일\n3. 지출 흐름(금액 기록이 있으면)\n4. 제안 1~2가지\n짧고 명확하게.';
  try{out.textContent=await askAI(prompt);}catch(e){out.textContent='⚠️ '+e.message;logErr('분석 실패: '+e.message);}
}
var chatHistory=[];
function pushMsg(role,text){var el=document.createElement('div');el.className='msg '+(role==='me'?'me':'ai');el.textContent=text;$('chatArea').appendChild(el);$('chatArea').scrollTop=$('chatArea').scrollHeight;return el;}
async function sendChat(){
  var q=$('chatInput').value.trim();if(!q)return;
  if(!isKey()){openApi();return;}
  $('chatInput').value='';pushMsg('me',q);chatHistory.push('사용자: '+q);
  var thinking=pushMsg('ai','...');
  var ctx=recContext(140);
  var prompt='너는 사용자의 개인 비서야. 아래는 사용자의 생활 기록이야. 이걸 근거로 답해. 기록에 없으면 "그건 기록에 없어요"라고 말해. 날짜·구체적 내용을 인용해 친근하게 답해.\n\n=== 기록 ===\n'+ctx+'\n\n=== 대화 ===\n'+chatHistory.slice(-6).join('\n')+'\n비서:';
  try{var ans=await askAI(prompt);thinking.textContent=ans;chatHistory.push('비서: '+ans);}
  catch(e){thinking.textContent='⚠️ '+e.message;logErr('대화 실패: '+e.message);}
}

/* ===== 달력 (worklog 스타일: 월간 + 연간 계획표) ===== */
var calYear,calMonth,calSelDate=null,calView='month';
function setCalView(v){
  calView=v;
  $('calVMonth').className=(v==='month'?'sel':'');
  $('calVYear').className=(v==='year'?'sel':'');
  renderCal();
}
function calGoToday(){var n=new Date();calYear=n.getFullYear();calMonth=n.getMonth();calSelDate=null;renderCal();}
var calCatFilter='전체';
var calCarFilter='전체';
function setCalCat(k){
  calCatFilter=(calCatFilter===k?'전체':k);
  calCarFilter='전체';
  renderCal();
  renderCalDay();   // 안전장치: 확실히 다시 그리기
}
function setCalCar(v){calCarFilter=v;renderCal();renderCalDay();}
function calLegendHtml(){
  // 기록이 있는 카테고리만 — 눌러서 필터
  var used={};getRecords().forEach(function(r){used[r.cat]=1;});
  var list=CATS.filter(function(c){return used[c.k];});
  if(!list.length)return '<span style="color:#9CA3AF">기록이 쌓이면 색깔 필터가 보여요</span>';
  var h='<span class="lg-chip'+(calCatFilter==='전체'?' on':'')+'" onclick="setCalCat(\'전체\')">전체</span>';
  h+=list.map(function(c){
    var on=calCatFilter===c.k;
    return '<span class="lg-chip'+(on?' on':'')+'" onclick="setCalCat(\''+c.k+'\')" style="'+(on?'background:'+c.c+';color:#fff;border-color:'+c.c:'')+'"><span class="lg-dot" style="background:'+c.c+'"></span>'+c.k+'</span>';
  }).join('');
  return h;
}
function calCarLegendHtml(){
  // 차계부 선택 시 차량 하위 필터
  var cars=['전체'];
  getRecords().forEach(function(r){if(r.cat==='차계부'&&r.who&&cars.indexOf(r.who)<0)cars.push(r.who);});
  if(cars.length<=1)return '';
  return cars.map(function(v){
    var on=calCarFilter===v;
    var col=CAR_COLORS[v]||'#0891B2';
    var dot=(v==='전체')?'🚗 ':'<span class="lg-dot" style="background:'+col+'"></span>';
    var style=on?('background:'+col+';color:#fff;border-color:'+col):'';
    return '<span class="lg-chip car'+(on?' on':'')+'" onclick="setCalCar(\''+v+'\')" style="'+style+'">'+dot+v+'</span>';
  }).join('');
}
function recsByDate(){
  // 카테고리/차량 필터 적용 (달력 그리드 + 하단 목록 모두)
  var map={};
  getRecords().forEach(function(r){
    if(!r.date)return;
    if(calCatFilter!=='전체'&&r.cat!==calCatFilter)return;
    if(calCatFilter==='차계부'&&calCarFilter!=='전체'&&r.who!==calCarFilter)return;
    (map[r.date]=map[r.date]||[]).push(r);
  });
  return map;
}
function renderCal(){
  if(calYear===undefined){var n=new Date();calYear=n.getFullYear();calMonth=n.getMonth();}
  $('calLegend').innerHTML=calLegendHtml();
  // 차계부 선택 시 차량 하위 필터 표시
  var carLeg=$('calCarLegend');
  if(calCatFilter==='차계부'){
    var ch=calCarLegendHtml();
    if(ch){carLeg.innerHTML=ch;carLeg.style.display='flex';}else{carLeg.style.display='none';}
  }else{carLeg.style.display='none';}
  if(calView==='year'){
    $('calTitle').textContent=calYear+'년';
    $('calGrid').style.display='none';
    $('calDayList').style.display='none';
    $('calYearGrid').style.display='block';
    $('calFullBtn').style.display='';
    renderYear();
    return;
  }
  $('calFullBtn').style.display='none';
  $('calTitle').textContent=calYear+'년 '+(calMonth+1)+'월';
  $('calGrid').style.display='grid';
  $('calDayList').style.display='block';
  $('calYearGrid').style.display='none';
  var first=new Date(calYear,calMonth,1),startDow=first.getDay();
  var days=new Date(calYear,calMonth+1,0).getDate();
  var byDate=recsByDate();
  var todayStr=new Date().toISOString().slice(0,10);
  var dows=['일','월','화','수','목','금','토'];
  var h='';dows.forEach(function(d,i){h+='<div class="cal-dow" style="'+(i===0?'color:#EF4444':(i===6?'color:#3B82F6':''))+'">'+d+'</div>';});
  for(var i=0;i<startDow;i++)h+='<div class="cal-cell empty"></div>';
  for(var d=1;d<=days;d++){
    var ds=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var dow=new Date(ds+'T00:00').getDay();
    var list=byDate[ds]||[];
    var cls='cal-cell'+(ds===todayStr?' today':'')+(ds===calSelDate?' sel':'')+(dow===0?' sun':'')+(dow===6?' sat':'');
    var evts='';
    list.forEach(function(r){
      var col=evtColor(r);
      evts+='<div class="cal-evt" style="color:'+col+'"><span class="ev-dot" style="background:'+col+'"></span>'+calEventLabel(r)+'</div>';
    });
    h+='<div class="'+cls+'" onclick="calPick(\''+ds+'\')"><span class="cal-num">'+d+'</span>'+evts+'</div>';
  }
  $('calGrid').innerHTML=h;
  renderCalDay();
}
function buildYearTable(year,full){
  var byDate=recsByDate();
  var cls=full?'year-tbl year-tbl-full':'year-tbl';
  var h='<table class="'+cls+'"><thead><tr><th class="year-corner">일\\월</th>';
  for(var m=1;m<=12;m++)h+='<th class="year-mh">'+m+'월</th>';
  h+='</tr></thead><tbody>';
  for(var d=1;d<=31;d++){
    h+='<tr><td class="year-dh">'+d+'</td>';
    for(var m=1;m<=12;m++){
      var daysIn=new Date(year,m,0).getDate();
      if(d>daysIn){h+='<td class="year-empty"></td>';continue;}
      var ds=year+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      var dow=new Date(ds+'T00:00').getDay();
      var list=byDate[ds]||[];
      var cell='';
      list.forEach(function(r){
        var col=evtColor(r);
        cell+='<div class="year-evt" style="color:'+col+'"><span class="ev-dot" style="background:'+col+'"></span>'+calEventLabel(r,true)+'</div>';
      });
      var cc='year-cell'+(dow===0?' sun':'')+(dow===6?' sat':'');
      h+='<td class="'+cc+'" onclick="calPickYear(\''+ds+'\')">'+cell+'</td>';
    }
    h+='</tr>';
  }
  h+='</tbody></table>';
  return h;
}
function renderYear(){
  $('calYearGrid').innerHTML='<div class="year-scroll">'+buildYearTable(calYear,false)+'</div>';
}
/* 연간 전체화면 팝업 */
var yearFullY;
function openYearFull(){
  yearFullY=calYear;
  $('yearFullBg').classList.add('open');
  renderYearFull();
  document.body.style.overflow='hidden';
}
function closeYearFull(){
  $('yearFullBg').classList.remove('open');
  document.body.style.overflow='';
  // 팝업에서 연도를 바꿨으면 본 화면도 반영
  if(yearFullY!==calYear){calYear=yearFullY;renderCal();}
}
function yearFullMove(dir){yearFullY+=dir;renderYearFull();}
function renderYearFull(){
  $('yearFullTitle').textContent=yearFullY+'년';
  $('yearFullLegend').innerHTML=calLegendHtml();
  var saved=calYear;calYear=yearFullY;
  $('yearFullBody').innerHTML=buildYearTable(yearFullY,true);
  calYear=saved;
}
function calPickYear(ds){
  // 연간에서 날짜 누르면 그 달 월간으로 이동
  if($('yearFullBg').classList.contains('open')){$('yearFullBg').classList.remove('open');document.body.style.overflow='';}
  calYear=parseInt(ds.slice(0,4),10);calMonth=parseInt(ds.slice(5,7),10)-1;calSelDate=ds;setCalView('month');
}
function calMove(dir){
  if(calView==='year'){calYear+=dir;calSelDate=null;renderCal();return;}
  calMonth+=dir;if(calMonth<0){calMonth=11;calYear--;}if(calMonth>11){calMonth=0;calYear++;}calSelDate=null;renderCal();
}
function calPick(ds){calSelDate=(calSelDate===ds?null:ds);renderCal();}
function renderCalDay(){
  if(!calSelDate){$('calDayList').innerHTML='<div class="empty" style="padding:20px 0">날짜를 누르면 그날 기록이 보여요</div>';return;}
  var arr=getRecords().filter(function(r){return r.date===calSelDate&&(calCatFilter==='전체'||r.cat===calCatFilter)&&!(calCatFilter==='차계부'&&calCarFilter!=='전체'&&r.who!==calCarFilter);});
  $('calDayList').innerHTML='<div class="date-group">'+fmtDate(calSelDate)+'</div>'+(arr.length?calRows(arr):'<div class="empty">기록 없음</div>');
}
function calRows(arr){
  return arr.map(function(r){
    var col=evtColor(r);
    var amt='';
    if(r.cat==='독서'){amt=r.stars?('⭐'+r.stars):'';}
    else if(r.amount){amt=won(r.amount)+'원';}
    return '<div class="lrow1" style="border-left:3px solid '+col+'" onclick="openDetail(\''+r.id+'\')">'+
      catBadge(r)+
      '<span class="l1-title">'+(esc(r.title)||r.cat)+photoMark(r)+'</span>'+
      '<span class="l1-sub">'+rowSummary(r)+'</span>'+
      '<span class="l1-amt'+(r.cat==='독서'?' star':'')+'">'+amt+'</span></div>';
  }).join('');
}

/* ===== 통계 ===== */
function renderStats(){
  var recs=getRecords();
  if(!recs.length){$('statsArea').innerHTML='<div class="empty">기록이 쌓이면 통계가 보여요</div>';return;}
  var now=new Date(),ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var thisMonth=recs.filter(function(r){return (r.date||'').slice(0,7)===ym;});
  var spend=0;thisMonth.forEach(function(r){if(r.amount&&r.cat!=='독서')spend+=Number(r.amount);});
  var totalSpend=0;recs.forEach(function(r){if(r.amount&&r.cat!=='독서')totalSpend+=Number(r.amount);});
  var h='';
  h+='<div class="stat-card"><h3>📅 이번 달 ('+(now.getMonth()+1)+'월)</h3><div class="stat-big">'+
     '<div class="stat-box"><div class="stat-num">'+thisMonth.length+'</div><div class="stat-lbl">기록</div></div>'+
     '<div class="stat-box"><div class="stat-num">'+won(spend)+'</div><div class="stat-lbl">이번 달 지출(원)</div></div>'+
     '<div class="stat-box"><div class="stat-num">'+recs.length+'</div><div class="stat-lbl">전체 기록</div></div>'+
     '</div></div>';

  function barRow(label,fillPct,color,valText){
    return '<div class="stat-bar-row"><span class="stat-bar-lbl">'+label+'</span>'+
      '<span class="stat-bar-track"><span class="stat-bar-fill" style="width:'+fillPct+'%;background:'+color+'"></span></span>'+
      '<span class="stat-bar-val">'+valText+'</span></div>';
  }

  // ★ 카테고리별 지출(돈) — 핵심
  var spendCat={};
  recs.forEach(function(r){if(r.amount&&r.cat!=='독서')spendCat[r.cat]=(spendCat[r.cat]||0)+Number(r.amount);});
  var spendKeys=Object.keys(spendCat);
  if(spendKeys.length){
    var maxS=Math.max.apply(null,spendKeys.map(function(k){return spendCat[k];}));
    h+='<div class="stat-card"><h3>💰 카테고리별 지출 (전체 '+won(totalSpend)+'원)</h3>';
    CATS.filter(function(c){return spendCat[c.k];}).sort(function(a,b){return spendCat[b.k]-spendCat[a.k];}).forEach(function(c){
      var pct=Math.round(spendCat[c.k]/maxS*100);
      h+=barRow(c.i+' '+c.k, pct, c.c, won(spendCat[c.k])+'원');
    });
    h+='</div>';
  }

  // 차량별 지출 (차계부)
  var carSpend={};
  recs.forEach(function(r){if(r.cat==='차계부'&&r.amount&&r.who)carSpend[r.who]=(carSpend[r.who]||0)+Number(r.amount);});
  var carKeys=Object.keys(carSpend);
  if(carKeys.length){
    var maxC=Math.max.apply(null,carKeys.map(function(k){return carSpend[k];}));
    h+='<div class="stat-card"><h3>🚗 차량별 정비·주유 지출</h3>';
    carKeys.sort(function(a,b){return carSpend[b]-carSpend[a];}).forEach(function(car){
      var col=(CAR_COLORS[car]||'#0891B2');
      h+=barRow(car, Math.round(carSpend[car]/maxC*100), col, won(carSpend[car])+'원');
    });
    h+='</div>';
  }

  // 카테고리별 기록 수
  var byCat={};recs.forEach(function(r){byCat[r.cat]=(byCat[r.cat]||0)+1;});
  var maxN=Math.max.apply(null,Object.keys(byCat).map(function(k){return byCat[k];}));
  h+='<div class="stat-card"><h3>📊 카테고리별 기록 수</h3>';
  CATS.filter(function(c){return byCat[c.k];}).sort(function(a,b){return byCat[b.k]-byCat[a.k];}).forEach(function(c){
    h+=barRow(c.i+' '+c.k, Math.round(byCat[c.k]/maxN*100), c.c, byCat[c.k]+'건');
  });
  h+='</div>';

  // 차량별 연비 추이
  var cars={};recs.forEach(function(r){if(r.cat==='차계부'&&r.kmpl){(cars[r.who]=cars[r.who]||[]).push(r);}});
  Object.keys(cars).forEach(function(car){
    var list=cars[car].sort(function(a,b){return (a.date).localeCompare(b.date);});
    var avg=Math.round(list.reduce(function(s,r){return s+r.kmpl;},0)/list.length*10)/10;
    var col=(CAR_COLORS[car]||'#0891B2');
    h+='<div class="stat-card"><h3>⛽ '+esc(car)+' 연비 (평균 '+avg+'㎞/L)</h3>';
    list.slice(-6).forEach(function(r){
      var pct=Math.min(100,Math.round(r.kmpl/Math.max(avg,r.kmpl)*100));
      h+=barRow(r.date.slice(5), pct, col, r.kmpl+'㎞/L');
    });
    h+='</div>';
  });
  $('statsArea').innerHTML=h;
}

/* ===== 약속 알림 배너 ===== */
function renderApptBanner(){
  var el=$('apptBanner');if(!el)return;
  var today=new Date();today.setHours(0,0,0,0);
  var soon=getRecords().filter(function(r){
    if(!(r.cat==='사람'&&(r.subtype==='만남'||r.subtype==='약속')))return false;
    var d=new Date(r.date+'T00:00');var diff=Math.round((d-today)/86400000);
    return diff>=0&&diff<=7;
  }).sort(function(a,b){return a.date.localeCompare(b.date);});
  if(!soon.length){el.innerHTML='';return;}
  var rows=soon.slice(0,3).map(function(r){
    var d=new Date(r.date+'T00:00');var diff=Math.round((d-today)/86400000);
    var when=diff===0?'오늘':(diff===1?'내일':diff+'일 뒤');
    return '<div class="appt-row"><span><b>'+esc(r.title||'약속')+'</b>'+(r.who?' · '+esc(r.who):'')+'</span><span class="appt-d">'+when+'</span></div>';
  }).join('');
  el.innerHTML='<div class="appt-banner" onclick="setFilter(\'사람\');document.querySelectorAll(\'.tab\')[1].click();">📅 다가오는 약속'+rows+'</div>';
}

/* ===== CSV 내보내기 ===== */
function exportCSV(){
  var recs=getRecords();
  if(!recs.length){toast('내보낼 기록이 없어요');return;}
  var cols=['date','cat','title','detail','who','phone','addr','amount','odo','liters','trip','kmpl'];
  var head=['날짜','카테고리','제목','내용','누구/장소','전화번호','주소','금액','주행거리','주유량','구간','연비'];
  function cell(v){v=(v==null?'':String(v));if(/[",\n]/.test(v))v='"'+v.replace(/"/g,'""')+'"';return v;}
  var lines=[head.join(',')];
  recs.sort(function(a,b){return (b.date||'').localeCompare(a.date||'');}).forEach(function(r){
    lines.push(cols.map(function(k){return cell(r[k]);}).join(','));
  });
  var csv='\uFEFF'+lines.join('\n');  // BOM for Excel 한글
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download='개인관리_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
  toast('📥 CSV 내보냄');
}

/* ===== 전체 백업 / 복구 (사진 포함, 복구 가능) ===== */
var LASTBK_KEY='personal-lastbackup';
function backupStatusText(){
  var el=document.getElementById('backupStatus');if(!el)return;
  var last=localStorage.getItem(LASTBK_KEY);
  if(!last){el.innerHTML='<span class="warn">아직 백업한 적이 없어요. 전체 백업을 권장해요.</span>';return;}
  var days=Math.floor((Date.now()-Number(last))/86400000);
  var when=new Date(Number(last)).toLocaleDateString('ko-KR');
  if(days>=7)el.innerHTML='<span class="warn">마지막 백업: '+when+' ('+days+'일 전) — 백업할 때가 됐어요</span>';
  else el.innerHTML='<span class="ok">마지막 백업: '+when+' ('+(days===0?'오늘':days+'일 전')+')</span>';
}
async function fullBackup(){
  var recs=getRecords();
  if(!recs.length){toast('백업할 기록이 없어요');return;}
  toast('백업 준비 중… (사진 포함)');
  // 사진을 클라우드에서 모아 담기
  var photos={};
  for(var i=0;i<recs.length;i++){
    var r=recs[i];
    if(r.photoIds&&r.photoIds.length){
      for(var j=0;j<r.photoIds.length;j++){
        var pid=r.photoIds[j];
        try{var d=await fetchPhoto(pid);if(d)photos[pid]=d;}catch(e){}
      }
    }
  }
  var backup={app:'개인관리',version:12,exported:new Date().toISOString(),records:recs,photos:photos};
  var blob=new Blob([JSON.stringify(backup)],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download='개인관리_백업_'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
  localStorage.setItem(LASTBK_KEY,String(Date.now()));
  backupStatusText();
  toast('📦 전체 백업 완료');
}
function restoreBackup(ev){
  var file=ev.target.files&&ev.target.files[0];ev.target.value='';
  if(!file)return;
  if(!confirm('백업 파일로 복구할까요?\n현재 기록과 합쳐지며, 같은 기록은 백업 내용으로 덮어써요.'))return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var bk=JSON.parse(e.target.result);
      if(!bk.records||!Array.isArray(bk.records))throw new Error('형식이 올바른 백업 파일이 아니에요');
      var cur=getRecords(),map={};
      cur.forEach(function(r){map[r.id]=r;});
      bk.records.forEach(function(r){map[r.id]=r;});  // 백업 우선
      var merged=Object.keys(map).map(function(k){return map[k];});
      setRecords(merged);
      // 기록은 클라우드로 다시 올리고, 사진도 복원 업로드
      merged.forEach(function(r){fbPush(r);});
      if(bk.photos){Object.keys(bk.photos).forEach(function(pid){photoMem[pid]=bk.photos[pid];fbPushPhoto(pid,bk.photos[pid]);});}
      toast('✅ 복구 완료 ('+bk.records.length+'건)');
      renderApptBanner();
    }catch(err){logErr('복구 실패: '+err.message);toast('⚠️ 복구 실패: '+err.message);}
  };
  reader.onerror=function(){toast('⚠️ 파일을 읽지 못했어요');};
  reader.readAsText(file);
}

/* ===== 진단 ===== */
function storageSize(){var t=0;for(var k in localStorage){if(localStorage.hasOwnProperty(k))t+=(localStorage[k].length+k.length);}return t;}

/* ===== 보관함 저장 테스트 (진단용) ===== */
async function testVaultSave(){
  var out=document.getElementById('vaultDiagOut');
  if(!out)return;
  out.style.display='block';
  function log(msg){out.textContent+=msg+'\n';console.log('[VaultTest]',msg);}
  out.textContent='=== 보관함 저장 테스트 시작 ===\n';

  // 1. crypto.subtle 사용 가능?
  try{
    if(!window.crypto||!window.crypto.subtle){throw new Error('crypto.subtle 없음');}
    log('✅ 1. crypto.subtle 사용 가능');
  }catch(e){log('❌ 1. '+e.message);return;}

  // 2. PIN 확인
  var pin=sessionPin;
  if(!pin){log('⚠️ 2. sessionPin 없음 — PIN 재입력 시도');
    pin=vaultKeyPin();
  }
  if(!pin){log('❌ 2. PIN 없음 — 먼저 앱에 PIN으로 로그인하세요');return;}
  log('✅ 2. PIN 있음 (길이:'+pin.length+')');

  // 3. 암호화 테스트
  try{
    var enc=await vaultEncrypt('{"memo":"테스트","files":[]}',pin);
    log('✅ 3. 암호화 성공 (enc 길이:'+enc.length+')');
    // 복호화 검증
    var dec=await vaultDecrypt(enc,pin);
    log('✅ 3b. 복호화 검증 성공: '+dec.slice(0,30));
  }catch(e){log('❌ 3. 암호화 실패: '+e.message);return;}

  // 4. Firestore PATCH 테스트
  try{
    var testId='__vault_test_'+Date.now();
    var testEnc=await vaultEncrypt('{"memo":"진단테스트","files":[]}',pin);
    var url=FB_BASE+'/'+COL_VAULT+'/'+testId+'?key='+FB_KEY;
    log('🔄 4. Firestore PATCH 요청: '+url.slice(0,80)+'…');
    var res=await fetch(url,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(toFS({enc:testEnc,title:'[진단테스트]',nfile:0,nimg:0,ndoc:0,created:new Date().toISOString()}))
    });
    var txt=await res.text();
    log('HTTP 응답: '+res.status+' '+res.statusText);
    if(res.ok){
      log('✅ 4. Firestore 저장 성공!');
      log('응답 앞 200자: '+txt.slice(0,200));
      // 테스트 문서 삭제
      await fetch(FB_BASE+'/'+COL_VAULT+'/'+testId+'?key='+FB_KEY,{method:'DELETE'});
      log('✅ 4b. 테스트 문서 삭제 완료');
      log('\n=== 결과: 보관함 저장 정상 작동 ===');
      log('→ 실제 저장이 안 된다면 아래를 확인하세요:');
      log('  - 제목이 비어있지 않은지');
      log('  - vaultFiles에 data가 있는지 (파일 선택 후 미리보기 확인)');
    }else{
      log('❌ 4. Firestore 실패: '+txt.slice(0,300));
    }
  }catch(e){log('❌ 4. fetch 오류: '+e.message);}

  log('\n=== 테스트 완료 ===');
}
function runDiag(){
  var rows=[];
  var lsOk=true;try{localStorage.setItem('__t','1');localStorage.removeItem('__t');}catch(e){lsOk=false;}
  rows.push(['브라우저 저장소',lsOk?'<span class="ok">정상 ✅</span>':'<span class="bad">사용 불가 ❌</span>']);
  rows.push(['저장된 기록',getRecords().length+'건']);
  var kb=Math.round(storageSize()/1024);var sc=kb>4500?'bad':(kb>3000?'warn':'ok');
  rows.push(['사용 용량','<span class="'+sc+'">'+kb+' KB / 약 5000 KB</span>']);
  rows.push(['AI(Claude) 키',isKey()?'<span class="ok">설정됨 ✅</span>':'<span class="warn">미설정</span>']);
  rows.push(['AI 모델','<span class="ok">'+AI_MODEL+'</span>']);
  var html='<div class="card" style="margin:0">';
  rows.forEach(function(r){html+='<div class="diag-item"><span class="diag-label">'+r[0]+'</span><span class="diag-val">'+r[1]+'</span></div>';});
  html+='<div class="diag-item"><span class="diag-label">Firebase 연결</span><span class="diag-val" id="fbStat">확인 중...</span></div></div>';
  var errs=[];try{errs=JSON.parse(localStorage.getItem(ERR_KEY)||'[]');}catch(e){}
  if(errs.length)html+='<div style="font-size:12px;font-weight:700;color:#991B1B;margin-top:14px">최근 에러 '+errs.length+'건</div><div class="err-log">'+errs.map(esc).join('\n')+'</div>';
  else html+='<div class="diag-item" style="padding-top:12px"><span class="diag-label">에러 기록</span><span class="diag-val ok">없음 ✅</span></div>';
  $('diagOut').innerHTML=html;
  fetch(FB_BASE+'/'+COL+'?key='+FB_KEY+'&pageSize=1').then(function(r){
    $('fbStat').innerHTML=r.ok?'<span class="ok">정상 ✅</span>':'<span class="bad">오류 '+r.status+' ❌</span>';
  }).catch(function(e){$('fbStat').innerHTML='<span class="bad">연결 실패 ❌</span>';logErr('FB ping: '+e.message);});
}
function clearErrors(){localStorage.removeItem(ERR_KEY);toast('에러 기록 삭제됨');runDiag();}

/* ===== 초기화 ===== */
/* ===== 보관함 (PIN 암호화 금고) v52 ===== */
var COL_VAULT='personal_vault';
/* ===== 보관함 파일 처리 (부동산과 동일한 Firebase Storage SDK 방식) ===== */
var vaultFiles = [];   // [{kind, name, mime, blob(File객체, 미업로드), url(업로드후), path, data(이미지base64)}]
var vaultCache = {};
var editingVaultId = null;

function vaultKeyPin(){
  if(sessionPin)return sessionPin;
  var p=prompt('보관함을 열려면 PIN 4자리를 입력하세요');
  if(p&&hashPin(p)===localStorage.getItem(PIN_KEY)){sessionPin=p;return p;}
  if(p)toast('PIN이 맞지 않아요');
  return '';
}
function deriveVaultKey(pin,saltU8){
  return crypto.subtle.importKey('raw',new TextEncoder().encode(pin),{name:'PBKDF2'},false,['deriveKey'])
    .then(function(km){return crypto.subtle.deriveKey({name:'PBKDF2',salt:saltU8,iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);});
}
function u8b64(u8){var s='';for(var i=0;i<u8.length;i++)s+=String.fromCharCode(u8[i]);return btoa(s);}
function b64u8(b){var s=atob(b),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
function vaultEncrypt(plain,pin){
  var salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  return deriveVaultKey(pin,salt).then(function(key){
    return crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(plain));
  }).then(function(ct){
    var all=new Uint8Array(16+12+ct.byteLength);all.set(salt,0);all.set(iv,16);all.set(new Uint8Array(ct),28);
    return u8b64(all);
  });
}
function vaultDecrypt(b64,pin){
  var all=b64u8(b64),salt=all.slice(0,16),iv=all.slice(16,28),ct=all.slice(28);
  return deriveVaultKey(pin,salt).then(function(key){
    return crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,ct);
  }).then(function(pt){return new TextDecoder().decode(pt);});
}

/* ---- 부동산과 동일: Storage SDK로 업로드 ---- */
function vaultUploadOne(fileObj){
  // fileObj: File 객체
  return new Promise(function(resolve, reject){
    var safe=(fileObj.name||'file').replace(/[^\w.\-가-힣]/g,'_');
    var path='personal_vault/'+Date.now()+'_'+Math.random().toString(36).slice(2,6)+'_'+safe;
    var ref=fbStorage.ref(path);
    var task=ref.put(fileObj,{contentType:fileObj.type||'application/octet-stream'});
    task.on('state_changed',
      function(snap){vSetStatus('업로드 '+Math.round(snap.bytesTransferred/snap.totalBytes*100)+'%…');},
      function(err){reject(err);},
      function(){ref.getDownloadURL().then(function(url){resolve({url:url,path:path});}).catch(reject);}
    );
  });
}
function vaultDeleteStorageFile(path){
  try{fbStorage.ref(path).delete().catch(function(){});}catch(e){}
}

/* ---- 파일 선택/드롭 처리 ---- */
function vSetStatus(m){var el=$('vPhotoStatus');if(el)el.textContent=m||'';}

function vHandleFiles(files){
  var list=Array.prototype.slice.call(files);
  if(!list.length)return;
  var total=list.length, done=0;
  vSetStatus('읽는 중… (0/'+total+')');
  list.forEach(function(f){
    if(f.type.startsWith('image/')){
      // 이미지: 압축 base64 (미리보기 + Firestore 직접 저장)
      readAndCompress(f).then(function(b64){
        vaultFiles.push({kind:'image', name:f.name, mime:f.type, data:b64});
        done++;
        if(done===total){vSetStatus('✅ '+total+'개 추가됨');vRenderPreviews();}
      }).catch(function(e){
        done++;
        vSetStatus('⚠️ '+f.name+': '+e.message);
        if(done===total)vRenderPreviews();
      });
    }else{
      // 문서/PDF: File 객체 보관 → 저장 시 Storage 업로드
      vaultFiles.push({kind:'file', name:f.name, mime:f.type||'application/octet-stream', blob:f});
      done++;
      if(done===total){vSetStatus('✅ '+total+'개 추가됨');vRenderPreviews();}
    }
  });
}

function vOnPhoto(ev){vHandleFiles(ev.target.files);ev.target.value='';}
function vOnDoc(ev){vHandleFiles(ev.target.files);ev.target.value='';}

function vHandlePaste(e){
  var items=(e.clipboardData||window.clipboardData);if(!items||!items.items)return;
  var files=[];
  for(var i=0;i<items.items.length;i++){
    var it=items.items[i];
    if(it.kind==='file'&&it.type.indexOf('image/')>-1){var f=it.getAsFile();if(f)files.push(f);}
  }
  if(!files.length)return;
  e.preventDefault();
  var bx=$('vPasteBox');if(bx)bx.innerHTML='';
  vHandleFiles(files);
}

function vaultBindDrop(){
  var dz=$('vaultDropZone');if(!dz)return;
  dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('dz-over');});
  dz.addEventListener('dragleave',function(e){if(!dz.contains(e.relatedTarget))dz.classList.remove('dz-over');});
  dz.addEventListener('drop',function(e){
    e.preventDefault();dz.classList.remove('dz-over');
    if(e.dataTransfer.files&&e.dataTransfer.files.length)vHandleFiles(e.dataTransfer.files);
  });
}

function vRenderPreviews(){
  var box=$('vaultPreviews');if(!box)return;
  if(!vaultFiles.length){box.innerHTML='';return;}
  box.innerHTML=vaultFiles.map(function(f,i){
    var isImg=f.kind==='image';
    var ext=(f.name||'').split('.').pop().toUpperCase()||'FILE';
    var icon=ext==='PDF'?'📕':ext==='DOCX'||ext==='DOC'?'📘':ext==='XLSX'||ext==='XLS'?'📗':'📄';
    var thumb=isImg
      ?('<img src="'+f.data+'" style="width:100%;height:100%;object-fit:cover;border-radius:6px;cursor:zoom-in" onclick="showImg(this.src)">')
      :('<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px">'+
        '<div style="font-size:24px">'+icon+'</div>'+
        '<div style="font-size:10px;font-weight:800;color:#6366F1;background:#EEF2FF;padding:1px 5px;border-radius:3px">'+esc(ext)+'</div>'+
        '</div>');
    var shortName=(f.name||'').length>13?(f.name||'').slice(0,11)+'..':f.name||'';
    return '<div class="vault-prev-item" title="'+esc(f.name||'')+'">'+
      '<div class="vault-prev-img">'+thumb+'</div>'+
      '<div style="font-size:10px;color:#6B7280;margin-top:3px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:72px">'+esc(shortName)+'</div>'+
      '<button onclick="vRemoveFile('+i+')" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1">✕</button>'+
    '</div>';
  }).join('');
}

function vRemoveFile(i){
  var f=vaultFiles[i];
  if(f.path)vaultDeleteStorageFile(f.path); // 이미 업로드된 파일 삭제
  vaultFiles.splice(i,1);
  vRenderPreviews();
}
/* ---- 저장 ---- */
async function saveVault(){
  var title=($('v-title').value||'').trim();
  var memo=($('v-memo').value||'').trim();
  if(!title&&!memo&&!vaultFiles.length){toast('제목이나 내용을 넣으세요');return;}
  /* PIN: sessionPin 우선, 없으면 직접 입력 */
  var pin=sessionPin;
  if(!pin){
    var p=prompt('PIN 4자리를 입력하세요');
    if(!p){toast('PIN이 필요해요');return;}
    if(hashPin(p)!==localStorage.getItem(PIN_KEY)){toast('PIN이 맞지 않아요');return;}
    sessionPin=p; pin=p;
  }

  var btn=$('vSaveBtn');
  btn.disabled=true;btn.textContent='저장 중…';

  try{
    /* 1. 문서 파일 Storage 업로드 (부동산 방식: fbStorage.ref().put()) */
    var uploadedFiles=[];
    for(var i=0;i<vaultFiles.length;i++){
      var f=vaultFiles[i];
      if(f.kind==='image'){
        // 이미지는 base64 그대로
        uploadedFiles.push({kind:'image',name:f.name,mime:f.mime||'',data:f.data||''});
      }else if(f.kind==='file'&&f.blob){
        // 문서: Storage 업로드
        vSetStatus('📤 업로드 중: '+f.name);
        var result=await vaultUploadOne(f.blob);
        uploadedFiles.push({kind:'file',name:f.name,mime:f.mime||'',url:result.url,path:result.path});
      }else if(f.kind==='file'&&f.url){
        // 이미 업로드된 파일 (수정 시)
        uploadedFiles.push({kind:'file',name:f.name,mime:f.mime||'',url:f.url,path:f.path||''});
      }
    }

    /* 2. payload → 암호화 */
    var payload=JSON.stringify({memo:memo,files:uploadedFiles});
    vSetStatus('🔒 암호화 중… ('+Math.round(payload.length/1024)+'KB)');
    var enc=await vaultEncrypt(payload,pin);

    /* 3. Firestore PATCH */
    var wasEdit=editingVaultId;
    var id=editingVaultId||String(Date.now());
    var nImg=uploadedFiles.filter(function(f){return f.kind==='image';}).length;
    var nDoc=uploadedFiles.filter(function(f){return f.kind==='file';}).length;
    vSetStatus('💾 Firestore 저장 중…');
    var res=await fetch(FB_BASE+'/'+COL_VAULT+'/'+id+'?key='+FB_KEY,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(toFS({
        enc:enc,title:title,
        nfile:uploadedFiles.length,nimg:nImg,ndoc:nDoc,
        created:new Date().toISOString()
      }))
    });
    if(!res.ok){
      var t=await res.text();
      throw new Error('Firestore '+res.status+': '+t.slice(0,150));
    }
    vSetStatus('✅ 저장 완료');
    toast(wasEdit?'✏️ 수정됨':'🔒 저장됨');
    closeVaultModal();
    renderVault();
  }catch(err){
    var msg=err&&err.message?err.message:String(err);
    vSetStatus('❌ '+msg);
    logErr('[보관함] '+msg);
    toast('⚠️ 저장 실패');
    btn.disabled=false;
    btn.textContent='🔒 암호화하여 저장';
  }
}

function openVaultModal(){
  editingVaultId=null;vaultFiles=[];
  var ti=$('v-title');if(ti)ti.value='';
  var me=$('v-memo');if(me)me.value='';
  vRenderPreviews();vSetStatus('');
  var b=$('vSaveBtn');if(b){b.disabled=false;b.textContent='🔒 암호화하여 저장';}
  var mt=$('vModalTitle');if(mt)mt.textContent='보관 추가';
  var eb=$('vEditBanner');if(eb)eb.style.display='none';
  var modal=$('vaultModal');if(modal)modal.classList.add('open');
  setTimeout(function(){var ti=$('v-title');if(ti)ti.focus();},100);
  vaultBindDrop();
}
function closeVaultModal(){
  var modal=$('vaultModal');if(modal)modal.classList.remove('open');
  cancelVaultEdit();
}
function cancelVaultEdit(){
  editingVaultId=null;vaultFiles=[];
  var ti=$('v-title');if(ti)ti.value='';
  var me=$('v-memo');if(me)me.value='';
  vRenderPreviews();vSetStatus('');
  var b=$('vSaveBtn');if(b){b.disabled=false;b.textContent='🔒 암호화하여 저장';}
  var eb=$('vEditBanner');if(eb)eb.style.display='none';
}

function editVault(id){
  var pin=vaultKeyPin();if(!pin){toast('PIN이 필요해요');return;}
  var vs=vaultStore[id]||{};var enc=vs.enc||'';var title=vs.title||'';
  if(!enc){toast('데이터 없음');return;}
  vaultDecrypt(enc,pin).then(function(plain){
    var o=JSON.parse(plain);
    editingVaultId=id;
    var ti=$('v-title');if(ti)ti.value=title||'';
    var me=$('v-memo');if(me)me.value=o.memo||'';
    // 파일 복원
    vaultFiles=(o.files||[]).map(function(f){
      // 구형: photos 배열 호환
      if(!o.files&&o.photos)return {kind:'image',name:'photo',data:f,mime:'image/jpeg'};
      return f;
    });
    // 구형 photos 배열 호환
    if(!o.files&&o.photos){
      vaultFiles=o.photos.map(function(p){return {kind:'image',name:'photo.jpg',data:p,mime:'image/jpeg'};});
    }
    vRenderPreviews();
    var b=$('vSaveBtn');if(b){b.disabled=false;b.textContent='✏️ 수정 저장';}
    var eb=$('vEditBanner');if(eb)eb.style.display='flex';
    var mt=$('vModalTitle');if(mt)mt.textContent='보관 수정';
    var modal=$('vaultModal');if(modal)modal.classList.add('open');
    vaultBindDrop();
    toast('수정 모드 — 고치고 저장하세요');
  }).catch(function(){toast('복호화 실패 — PIN 확인');});
}

/* vaultStore: id → {enc, title} 맵 (onclick에 enc 직접 안 씀) */
var vaultStore={};
function renderVault(){
  var box=$('vaultList');box.innerHTML='<div class="empty">불러오는 중…</div>';
  fetch(FB_BASE+'/'+COL_VAULT+'?key='+FB_KEY+'&pageSize=200').then(function(r){return r.json();}).then(function(d){
    if(!d.documents||!d.documents.length){box.innerHTML='<div class="empty">아직 보관한 문서가 없어요</div>';return;}
    var items=d.documents.map(function(doc){var o=fromFS(doc);o.id=doc.name.split('/').pop();return o;})
      .sort(function(a,b){return (b.created||'').localeCompare(a.created||'');});
    vaultStore={};
    items.forEach(function(it){vaultStore[it.id]={enc:it.enc,title:it.title||''};});
    box.innerHTML=items.map(function(it){
      var sub='🔒 내용 잠김';
      if(it.nfile>0){var parts=[];if(it.nimg)parts.push('📷'+it.nimg+'장');if(it.ndoc)parts.push('📄'+it.ndoc+'개');sub+=' · '+parts.join(' ');}
      else if(it.nphoto){sub+=' · 📷'+it.nphoto+'장';}
      return '<div class="vault-card" id="vault-'+it.id+'">'+
        '<div class="vault-head">'+
          '<div class="vault-titlebar">'+
            '<span class="vault-name">'+(esc(it.title)||'(제목 없음)')+'</span>'+
            '<span class="vault-sub">'+sub+'</span>'+
          '</div>'+
          '<div class="vault-acts">'+
            '<button class="rec-act" style="color:#6366F1" onclick="unlockVault(\''+it.id+'\')">👁 열기</button>'+
            '<button class="rec-act" style="color:#F59E0B" onclick="editVault(\''+it.id+'\')">✏️ 수정</button>'+
            '<button class="rec-act rec-del" onclick="delVault(\''+it.id+'\')">🗑 삭제</button>'+
          '</div>'+
        '</div>'+
        '<div class="vault-body" id="vbody-'+it.id+'"></div>'+
      '</div>';
    }).join('');
  }).catch(function(e){logErr('보관함 조회 실패: '+e.message);box.innerHTML='<div class="empty">불러오기 실패</div>';});
}

function unlockVault(id){
  var pin=vaultKeyPin();if(!pin){toast('PIN이 필요해요');return;}
  var enc=(vaultStore[id]||{}).enc||'';if(!enc){toast('데이터 없음');return;}
  var body=$('vbody-'+id);if(body.innerHTML){body.innerHTML='';return;}
  body.innerHTML='<div style="font-size:12px;color:#9CA3AF;padding:6px 0">복호화 중…</div>';
  vaultDecrypt(enc,pin).then(function(plain){
    var o=JSON.parse(plain);
    var html='';
    if(o.memo)html+='<div class="vault-memo">'+esc(o.memo)+'</div>';
    // 신형: files 배열
    var files=o.files||[];
    if(!files.length&&o.photos)files=o.photos.map(function(p){return {kind:'image',data:p,name:'photo.jpg'};});
    files.forEach(function(f){
      if(f.kind==='image'&&f.data){
        html+='<img src="'+f.data+'" onclick="showImg(this.src)" style="max-width:100%;border-radius:10px;margin-top:8px;cursor:zoom-in;display:block">';
      }else if(f.kind==='file'&&f.url){
        // Storage URL로 저장된 문서
        var ext=(f.name||'').split('.').pop().toUpperCase()||'FILE';
        var isImg=/^(JPG|JPEG|PNG|GIF|WEBP)$/.test(ext);
        if(isImg){
          html+='<img src="'+esc(f.url)+'" onclick="showImg(this.src)" style="max-width:100%;border-radius:10px;margin-top:8px;cursor:zoom-in;display:block">';
        }else{
          var icon=ext==='PDF'?'📕':ext==='DOCX'||ext==='DOC'?'📘':ext==='XLSX'||ext==='XLS'?'📗':'📄';
          html+='<a href="'+esc(f.url)+'" target="_blank" class="vault-file-link">'+
            '<span style="font-size:20px">'+icon+'</span>'+
            '<span class="vault-file-ext">'+esc(ext)+'</span>'+
            '<span class="vault-file-name">'+esc(f.name||'파일')+'</span>'+
            '<span style="font-size:11px;color:#9CA3AF">↗ 열기</span></a>';
        }
      }
    });
    body.innerHTML=html||'<div style="font-size:12px;color:#9CA3AF;padding:6px 0">내용 없음</div>';
    var head=$('vault-'+id).querySelector('.vault-sub');if(head)head.textContent='🔓 열림';
  }).catch(function(){body.innerHTML='<div style="color:#EF4444;font-size:12px;padding:6px 0">⚠️ 복호화 실패 — PIN이 다를 수 있어요</div>';});
}

function delVault(id){
  if(!confirm('이 보관 문서를 삭제할까요?'))return;
  fetch(FB_BASE+'/'+COL_VAULT+'/'+id+'?key='+FB_KEY,{method:'DELETE'})
    .then(function(){toast('삭제됨');renderVault();})
    .catch(function(){toast('삭제 실패');});
}

/* ===== 급한 메모 (worklog 표준) ===== */
var QM_LS_TEXT='personal_quickmemo_text_v1';
var qmSaveTimer=null;
function wireQuickMemo(){
  var btn=$('btnQuickMemo');if(btn)btn.addEventListener('click',toggleQuickMemo);
  // 단축키 Ctrl+Shift+M
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key&&e.key.toLowerCase()==='m'){e.preventDefault();toggleQuickMemo();}
    if(e.key==='Escape'&&$('quickMemoSide').classList.contains('show'))closeQuickMemo();
  });
  $('qmClose').addEventListener('click',closeQuickMemo);
  $('qmClear').addEventListener('click',clearQuickMemo);
  $('qmFile').addEventListener('change',handleQmPhoto);
  // 클립보드 paste — 사진은 인라인 삽입
  $('qmText').addEventListener('paste',function(e){
    var cd=e.clipboardData||window.clipboardData;if(!cd)return;
    var items=cd.items;if(!items)return;
    for(var i=0;i<items.length;i++){
      var it=items[i];
      if(it.type&&it.type.indexOf('image/')===0){
        e.preventDefault();
        var blob=it.getAsFile();if(!blob)continue;
        readAndCompress(blob).then(function(dataUrl){
          insertImageAtCursor(dataUrl);
          $('qmStatus').textContent='📷 사진이 본문에 들어갔어요';
          scheduleQmSave();
        }).catch(function(){});
        return;
      }
    }
    // 이미지 없으면 일반 텍스트 (스타일 제거)
    e.preventDefault();
    var text=cd.getData('text/plain')||'';
    document.execCommand('insertText',false,text);
  });
  $('qmText').addEventListener('input',scheduleQmSave);
  // 사진 삭제·확대 클릭
  $('qmText').addEventListener('click',function(e){
    var rm=e.target.closest('.qm-inline-img-rm');
    if(rm){e.preventDefault();e.stopPropagation();var wrap=rm.closest('.qm-inline-img-wrap');if(wrap){wrap.remove();scheduleQmSave();}setTimeout(function(){var t=$('qmText');if(t)t.focus();},10);return;}
    var img=e.target.closest('.qm-inline-img-wrap img');
    if(img){e.preventDefault();openQmZoom(img.src);}
  });
  $('qmZoomOverlay').addEventListener('click',function(){$('qmZoomOverlay').classList.remove('show');});
  // 패널 밖 클릭으로 닫기
  document.addEventListener('click',function(e){
    var side=$('quickMemoSide');
    if(!side||!side.classList.contains('show'))return;
    // 클릭이 패널 내부면 무시
    if(side.contains(e.target))return;
    // 메모 열기 버튼 자체 클릭이면 무시 (toggleQuickMemo가 처리)
    if(e.target.closest('#btnQuickMemo'))return;
    // 사진 확대 오버레이 클릭이면 무시
    if(e.target.closest('#qmZoomOverlay'))return;
    closeQuickMemo();
  });
  loadQuickMemo();
}
function insertImageAtCursor(dataUrl){
  var wrapHtml='<div class="qm-inline-img-wrap" contenteditable="false"><img src="'+dataUrl+'"><button type="button" class="qm-inline-img-rm" title="이 사진 삭제">×</button></div><br>';
  var sel=window.getSelection();
  if(sel&&sel.rangeCount){
    var range=sel.getRangeAt(0),editor=$('qmText');
    if(editor.contains(range.startContainer)){
      range.deleteContents();
      var tmp=document.createElement('div');tmp.innerHTML=wrapHtml;
      var frag=document.createDocumentFragment();
      while(tmp.firstChild)frag.appendChild(tmp.firstChild);
      range.insertNode(frag);
      range.collapse(false);sel.removeAllRanges();sel.addRange(range);
      return;
    }
  }
  $('qmText').insertAdjacentHTML('beforeend',wrapHtml);
}
function openQmZoom(src){$('qmZoomImg').src=src;$('qmZoomOverlay').classList.add('show');}
function scheduleQmSave(){
  clearTimeout(qmSaveTimer);
  qmSaveTimer=setTimeout(function(){
    try{localStorage.setItem(QM_LS_TEXT,$('qmText').innerHTML);}catch(err){toast('⚠️ 메모 저장 실패 — 사진을 줄여주세요');}
    var s=$('qmStatus');if(s)s.textContent='💾 자동 저장됨 '+new Date().toLocaleTimeString('ko-KR').slice(0,8);
    qmemoUpdateFab();
  },400);
}
function loadQuickMemo(){
  try{var t=localStorage.getItem(QM_LS_TEXT)||'';$('qmText').innerHTML=t;}catch(e){}
  qmemoUpdateFab();
}
function toggleQuickMemo(){
  var side=$('quickMemoSide');
  if(side.classList.contains('show'))closeQuickMemo();
  else{side.classList.add('show');setTimeout(function(){$('qmText').focus();},200);}
}
function closeQuickMemo(){
  // 닫기 전 즉시 저장
  if(qmSaveTimer){clearTimeout(qmSaveTimer);qmSaveTimer=null;}
  try{localStorage.setItem(QM_LS_TEXT,$('qmText').innerHTML);}catch(e){}
  $('quickMemoSide').classList.remove('show');
  qmemoUpdateFab();
}
function clearQuickMemo(){
  if(!confirm('급한 메모 내용을 모두 지울까요? (되돌릴 수 없음)'))return;
  $('qmText').innerHTML='';
  try{localStorage.removeItem(QM_LS_TEXT);}catch(e){}
  $('qmStatus').textContent='🗑 지워졌습니다';
  qmemoUpdateFab();
}
function handleQmPhoto(e){
  var files=Array.prototype.slice.call(e.target.files||[]);e.target.value='';
  var i=0;(function next(){
    if(i>=files.length){scheduleQmSave();$('qmText').focus();return;}
    readAndCompress(files[i++]).then(function(dataUrl){insertImageAtCursor(dataUrl);next();}).catch(function(){next();});
  })();
}
function qmemoUpdateFab(){
  var t=localStorage.getItem(QM_LS_TEXT)||'';
  // HTML 태그 제외하고 실제 내용이 있는지
  var has=t.replace(/<[^>]+>/g,'').trim().length>0||t.indexOf('<img')>=0;
  var fab=$('btnQuickMemo');if(fab)fab.classList.toggle('has-content',has);
}

/* ===== 연락처 (personal_contacts) ===== */
var COL_CONTACTS='personal_contacts';
var contactsCache=[];
var editingContactId=null;
var ctFilter='전체';
var CT_CATS_KEY='personal_ct_cats';
var CT_CATS_DEFAULT=['가족','친구','거래처','병원','식당','관공서','업무','기타'];
function ctCatsLoad(){
  try{var s=localStorage.getItem(CT_CATS_KEY);if(s){var a=JSON.parse(s);if(Array.isArray(a)&&a.length)return a;}}catch(e){}
  return CT_CATS_DEFAULT.slice();
}
function ctCatsSave(arr){localStorage.setItem(CT_CATS_KEY,JSON.stringify(arr));}
function ctCatAdd(){
  var n=prompt('새 카테고리 이름:');if(!n)return;n=n.trim();if(!n)return;
  var arr=ctCatsLoad();if(arr.indexOf(n)>=0){toast('이미 있어요');return;}
  arr.push(n);ctCatsSave(arr);
  refreshCtCatSelect();renderContacts();toast('✅ "'+n+'" 추가됨');
}
function ctCatDel(){
  var arr=ctCatsLoad();
  var name=prompt('지울 카테고리 이름 (현재: '+arr.join(', ')+')');
  if(!name)return;name=name.trim();
  var i=arr.indexOf(name);if(i<0){toast('없는 이름이에요');return;}
  if(!confirm('"'+name+'" 카테고리를 지울까요?\n(이 카테고리의 연락처들은 그대로 남고, 카테고리 이름만 사라져요)'))return;
  arr.splice(i,1);ctCatsSave(arr);
  refreshCtCatSelect();renderContacts();toast('🗑 삭제됨');
}
function refreshCtCatSelect(){
  var sel=$('ct-cat');if(!sel)return;
  var cur=sel.value;
  var arr=ctCatsLoad();
  sel.innerHTML=arr.map(function(k){return '<option'+(k===cur?' selected':'')+'>'+esc(k)+'</option>';}).join('');
}

function loadContacts(){
  fetch(FB_BASE+'/'+COL_CONTACTS+'?key='+FB_KEY+'&pageSize=500').then(function(r){return r.json();})
    .then(function(d){
      contactsCache=(d.documents||[]).map(function(doc){var o=fromFS(doc);o.id=doc.name.split('/').pop();return o;});
      renderContacts();
    }).catch(function(e){logErr('연락처 조회 실패: '+e.message);$('contactList').innerHTML='<div class="empty">불러오기 실패</div>';});
}

function renderContacts(){
  // 필터 칩
  var fcnt={};contactsCache.forEach(function(c){fcnt[c.cat]=(fcnt[c.cat]||0)+1;});
  var hf='<div class="filter-chip'+(ctFilter==='전체'?' sel':'')+'" onclick="setCtFilter(\'전체\')">전체 <b>'+contactsCache.length+'</b></div>';
  var CT_CATS=ctCatsLoad();
  CT_CATS.forEach(function(k){
    var n=fcnt[k]||0;
    hf+='<div class="filter-chip'+(ctFilter===k?' sel':'')+(n===0?' empty':'')+'" onclick="setCtFilter(\''+k+'\')">'+k+(n?' <b>'+n+'</b>':'')+'</div>';
  });
  $('ctFilterRow').innerHTML=hf;
  // 목록
  var q=($('ctSearch').value||'').trim().toLowerCase();
  var arr=contactsCache.filter(function(c){
    if(ctFilter!=='전체'&&c.cat!==ctFilter)return false;
    if(!q)return true;
    return ((c.name||'').toLowerCase().indexOf(q)>=0)
      ||((c.phone||'').replace(/\s/g,'').indexOf(q.replace(/\s/g,''))>=0)
      ||((c.addr||'').toLowerCase().indexOf(q)>=0)
      ||((c.person||'').toLowerCase().indexOf(q)>=0)
      ||((c.memo||'').toLowerCase().indexOf(q)>=0);
  }).sort(function(a,b){return (a.name||'').localeCompare(b.name||'','ko');});
  if(!arr.length){$('contactList').innerHTML='<div class="empty">'+(contactsCache.length?'검색 결과 없음':'아직 연락처가 없어요')+'</div>';return;}
  $('contactList').innerHTML=arr.map(function(c){
    var phoneClean=(c.phone||'').replace(/[^0-9+]/g,'');
    var mapUrl=c.addr?('https://map.naver.com/p/search/'+encodeURIComponent(c.addr)):'';
    return '<div class="ct-card">'+
      '<div class="ct-row1">'+
        '<span class="ct-name">'+esc(c.name||'(이름없음)')+(c.person?' <span class="ct-person">'+esc(c.person)+'</span>':'')+'</span>'+
        '<span class="ct-badge" style="background:'+ctCatColor(c.cat)+'1A;color:'+ctCatColor(c.cat)+'">'+esc(c.cat||'기타')+'</span>'+
      '</div>'+
      (c.phone?'<div class="ct-line"><a class="ct-phone" href="tel:'+esc(phoneClean)+'">📞 '+esc(c.phone)+'</a></div>':'')+
      (c.addr?'<div class="ct-line"><a class="ct-addr" href="'+mapUrl+'" target="_blank">📍 '+esc(c.addr)+'</a></div>':'')+
      (c.memo?'<div class="ct-memo">'+esc(c.memo)+'</div>':'')+
      '<div class="ct-acts">'+
        '<button class="rec-act rec-edit" onclick="editContact(\''+c.id+'\')">✏️ 수정</button>'+
        '<button class="rec-act rec-del" onclick="delContact(\''+c.id+'\')">🗑 삭제</button>'+
      '</div></div>';
  }).join('');
}

function ctCatColor(k){
  var m={'가족':'#F43F5E','친구':'#8B5CF6','거래처':'#0EA5E9','병원':'#14B8A6','식당':'#FB923C','관공서':'#64748B','업무':'#6366F1','기타':'#9CA3AF'};
  return m[k]||'#9CA3AF';
}
function setCtFilter(k){ctFilter=k;renderContacts();}


/* 연락처 이름 입력 → 기존 번호 자동채움 */
function attachCtNameAc(){
  var el=$('ct-name'), ph=$('ct-phone');
  if(!el||!ph||el._acDone)return;
  el._acDone=true;
  el.addEventListener('input',function(){
    if(editingContactId)return;          // 수정 중엔 기존 값 유지
    var name=el.value.trim();
    if(!name)return;
    var ct=contactsCache.find(function(c){return c.name===name;});
    if(ct&&ct.phone&&!ph.value){ph.value=ct.phone;}
  });
}
function saveContact(){
  var name=($('ct-name').value||'').trim();
  var phone=($('ct-phone').value||'').trim();
  if(!name&&!phone){toast('⚠️ 이름이나 전화번호를 입력하세요');return;}
  var id=editingContactId||String(Date.now());
  var rec={
    name:name,phone:phone,
    addr:($('ct-addr').value||'').trim(),
    cat:$('ct-cat').value||'기타',
    person:($('ct-person').value||'').trim(),
    memo:($('ct-memo').value||'').trim(),
    updated:new Date().toISOString()
  };
  if(!editingContactId)rec.created=new Date().toISOString();
  fetch(FB_BASE+'/'+COL_CONTACTS+'/'+id+'?key='+FB_KEY,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(toFS(rec))})
    .then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error('HTTP '+r.status);});return r.json();})
    .then(function(){toast(editingContactId?'✏️ 수정됨':'✅ 저장됨');cancelContactEdit();loadContacts();})
    .catch(function(e){logErr('연락처 저장 실패: '+e.message);toast('⚠️ '+e.message);});
}

function editContact(id){
  var c=contactsCache.filter(function(x){return x.id===id;})[0];if(!c)return;
  editingContactId=id;
  $('ct-name').value=c.name||'';
  $('ct-phone').value=c.phone||'';
  $('ct-addr').value=c.addr||'';
  $('ct-cat').value=c.cat||'기타';
  $('ct-person').value=c.person||'';
  $('ct-memo').value=c.memo||'';
  $('ctEditBadge').textContent='— 수정 중';
  $('ctSaveBtn').textContent='💾 수정 저장';
  $('ctCancelBtn').style.display='';
  $('ct-name').scrollIntoView({behavior:'smooth',block:'center'});
}

function cancelContactEdit(){
  editingContactId=null;
  ['ct-name','ct-phone','ct-addr','ct-person','ct-memo'].forEach(function(k){$(k).value='';});
  $('ct-cat').value='가족';
  $('ctEditBadge').textContent='';
  $('ctSaveBtn').textContent='💾 저장';
  $('ctCancelBtn').style.display='none';
}

function delContact(id){
  if(!confirm('이 연락처를 삭제할까요?'))return;
  fetch(FB_BASE+'/'+COL_CONTACTS+'/'+id+'?key='+FB_KEY,{method:'DELETE'})
    .then(function(){toast('삭제됨');loadContacts();})
    .catch(function(){toast('삭제 실패');});
}

(function init(){
  try{
    startLock();
    var n=new Date(),d=['일','월','화','수','목','금','토'];
    $('f-date').value=n.toISOString().slice(0,10);
    // 시간은 비워둠 (선택사항 — 방문일 위주)
    // 주소 끝 #카테고리 가 있으면 그 카테고리로 시작 (예: personal.html#독서)
    var hash=decodeURIComponent((location.hash||'').replace('#',''));
    if(hash&&catOf(hash).k===hash)selectedCat=hash;
    migratePersonCat();initViewMode();renderCats();renderForm({});renderPending();setApiBtn();renderWriteList();
    // 용량 절약: localStorage에 남아있는 사진 원본 데이터 제거 (사진은 클라우드에 있음)
    try{
      var recs=getRecords(),changed=false;
      recs.forEach(function(r){
        if(r.photos&&r.photos.length){
          if(!r.photoIds||!r.photoIds.length){r.photoIds=r.photos.map(function(_,i){return r.id+'_'+i;});}
          r.photos.forEach(function(p,i){var pid=r.id+'_'+i;if(!photoMem[pid])photoMem[pid]=p;}); // 화면 표시용 캐시
          delete r.photos;changed=true;
        }
      });
      if(changed)setRecords(recs);
    }catch(e){logErr('사진 정리 실패: '+e.message);}
    $('camInput').onchange=onPhotoInput;
    $('pickInput').onchange=onPhotoInput;
    var vc=$('vCamInput');if(vc)vc.onchange=vOnPhoto;
    var vp=$('vPickInput');if(vp)vp.onchange=vOnPhoto;
    var vd=$('vDocInput');if(vd)vd.onchange=vOnDoc;
    var vpb=$('vPasteBox');if(vpb)vpb.addEventListener('paste',vHandlePaste);
    vaultBindDrop();
    var pb=$('pasteBox');if(pb)pb.addEventListener('paste',handlePaste);
    // 급한 메모 (worklog 표준)
    wireQuickMemo();
    // 기록 탭이 활성일 때 화면 어디서 붙여넣어도 받기 (PC 편의)
    document.addEventListener('paste',function(e){
      if(document.getElementById('p-write').classList.contains('active')){
        var t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return; // 글자 입력 중엔 무시
        handlePaste(e);
      }
    });
    pushMsg('ai','안녕하세요! 기록을 남기면 "지난주에 뭐 샀지?" 같은 질문에 답해드려요.');
    renderApptBanner();
    pingFB();
    pullRecords().then(function(){renderApptBanner();});
  }catch(e){logErr('초기화 실패: '+e.message);}
})();
