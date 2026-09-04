/* ══════════════════════════════════════════════════════════════
   personal.js — 🏠 개인 + 🧩 속성 엔진 + 📄 노션식 화면
   v192-0901 : worklog.html 20273~29020행(8,748행)에서 통째로 옮겨 왔다.
   🔴 옮기기만 했다. 코드는 한 글자도 고치지 않았다.
   🔴 worklog.js 다음, 원래 있던 자리에서 읽힌다 — 순서를 바꾸지 말 것.
   되돌리기 : _backup/worklog_v191.html 로 덮어쓰면 원래대로 인라인이 된다.
   ══════════════════════════════════════════════════════════════ */

/* v200 — 이 파일이 GitHub 에 올라갔는지 알아보는 표식.
   worklog.js 의 JS_BUILD 와 같은 구실을 한다. wlVer 가 이것도 견준다.
   🔴 안 올리면 아무 경고 없이 옛 화면이 뜬다 — 그래서 표식을 붙였다. */
window.PERSONAL_BUILD = 'v265-0904-1156';
/* ══════════════════════════════════════════════════════════
   🏠 개인 — 기록 · 차계부 · 연락처 · 결산                v47
   데이터: entries 안에 kind:'personal' / kind:'pcontact'
   → 구글 캘린더로 안 나감 (GCAL_IDS 에 없는 kind)
   ══════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var LS_TAB = 'wl_life_tab', LS_CAT = 'wl_life_cat', LS_CARS = 'wl_life_cars';
  var LS_CTC = 'wl_life_ctcats', LS_SEED = 'wl_life_seed_v1', LS_CAR = 'wl_life_car';

  function esc(s){ return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function won(n){ n=Number(n)||0; return n.toLocaleString('ko-KR'); }
  function num(v){ var n=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; }
  function today(){
    /* 🔴 v178 — kstNow() 는 「UTC 로 읽어야」 한국 시각이 나오는 객체다.
       getFullYear/getMonth/getDate(지역 게터)로 읽으면 한국에서 +9시간이 더해져
       오후 3시가 넘으면 날짜가 하루 앞선다. 반드시 getUTC… 로 읽는다. */
    try{ if(typeof kstNow==='function'){ var d=kstNow();
      return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0'); } }catch(e){}
    var t=new Date(Date.now()+9*3600000); return t.toISOString().slice(0,10);
  }
  function dday(d){ if(!d) return null;
    var a=new Date(today()+'T00:00:00'), b=new Date(d+'T00:00:00');
    return Math.round((b-a)/86400000); }
  function esr(a){ try{ return Array.isArray(a)?a:(a?JSON.parse(a):[]); }catch(e){ return []; } }
  function lsGet(k,d){ try{ var s=localStorage.getItem(k); if(s) return JSON.parse(s); }catch(e){} return d; }
  function lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

  /* ══ v238 — 달님 : 「지울까요? 를 브라우저 창 말고 앱 팝업으로」 ══
     브라우저 confirm 은 주소창 아래에 붙어 앱과 따로 놀고, 글꼴·단추도 제각각이다.
     앱 안 팝업(wlAsk / wlAskDel)은 이미 있으니 그걸 쓴다.
     🔴 팝업은 「기다렸다 답을 주는」 방식이라 반드시 .then( ) 안에서 일한다.
        wlAsk 를 못 쓰는 상황(옛 worklog.js)이면 예전 창으로 조용히 내려간다. */
  function askDel(msg, sub){
    try{
      if(typeof window.wlAskDel === 'function') return window.wlAskDel(msg, sub);
      if(window.wlAsk && typeof window.wlAsk.ok === 'function')
        return window.wlAsk.ok(msg, { sub: sub || '휴지통에서 되살릴 수 있어요', ok:'삭제', danger:1 });
    }catch(e){ console.warn('[삭제 확인] 앱 팝업을 못 써서 기본 창으로', e); }
    try{ return Promise.resolve(window.confirm(msg)); }
    catch(e2){ return Promise.resolve(false); }
  }

  /* v239 — 「이름을 지어주세요」 같은 물음도 앱 팝업으로.
     결과: 글자(확인) 또는 null(취소). 브라우저 prompt 와 답이 똑같은 모양이라
     부르는 쪽 코드를 거의 안 바꿔도 된다. */
  function askText(title, value, opt){
    opt = opt || {};
    try{
      if(window.wlAsk && typeof window.wlAsk.text === 'function')
        return window.wlAsk.text(title, value==null?'':String(value),
                 { sub:opt.sub, ph:opt.ph, ok:opt.ok||'확인', no:opt.no||'취소' });
    }catch(e){ console.warn('[물어보기] 앱 팝업을 못 써서 기본 창으로', e); }
    try{ return Promise.resolve(window.prompt(title, value==null?'':String(value))); }
    catch(e2){ return Promise.resolve(null); }
  }

  /* ══ v240 — 브라우저 alert 을 두 갈래로 나눈다 ══
     달님 : 「알림은 토스트가 덜 성가시고, 막아야 하는 건 팝업이 맞다」

     noteMsg(글)      → 아래쪽 토스트. 그냥 알려만 주는 것 (실패·못 찾음)
     askInfo(글, 덧말) → 화면 한가운데 팝업, 「확인」 하나.
                        멈춰 세워야 하거나 설명이 붙는 것 (「꼭 넣어주세요」 등)

     🔴 둘 다 기다리지 않는다 — 예전 alert 자리에 그대로 끼워 넣어도
        뒤따르는 return 이 원래대로 돈다 (코드 흐름을 안 건드린다). */
  function noteMsg(msg){
    var m = String(msg==null?'':msg).replace(/\n+/g, ' · ');
    try{ if(typeof toast==='function'){ toast(m); return; } }catch(e){}
    try{ window.alert(m); }catch(e2){}
  }
  function askInfo(msg, sub){
    var m = String(msg==null?'':msg);
    var i = m.indexOf('\n');
    var head = (i>=0) ? m.slice(0,i) : m;
    var rest = (i>=0) ? m.slice(i+1).replace(/\n+/g, ' · ').trim() : '';
    try{
      if(window.wlAsk && typeof window.wlAsk.info === 'function'){
        window.wlAsk.info(head, { sub: sub || rest });
        return;
      }
    }catch(e){ console.warn('[알림] 앱 팝업을 못 써서 기본 창으로', e); }
    try{ window.alert(m); }catch(e2){}
  }

  /* ── 차량 ── */
  function cars(){ var a=lsGet(LS_CARS,null);
    return (Array.isArray(a)&&a.length)?a:[{n:'쏘나타',c:'#0891b2'},{n:'스타렉스',c:'#ea580c'}]; }
  function carsSave(a){ lsSet(LS_CARS,a); }
  var CARPOOL=['#0891b2','#ea580c','#16a34a','#9333ea','#d97706','#db2777','#0284c7','#65a30d'];
  function carColor(n){ var a=cars(); for(var i=0;i<a.length;i++) if(a[i].n===n) return a[i].c; return '#94a3b8'; }

  /* ── 유종 → 차량 자동 연결 ──
     주유 영수증에 LPG 라고 찍혀 있으면 스타렉스, 휘발유면 쏘나타.
     차를 바꾸거나 늘리면 [⚙️ 차량 관리] 에서 고칠 수 있다. */
  var LS_FUELMAP='wl_life_fuelmap';
  var FUEL_DEF={ 'LPG':'스타렉스', '휘발유':'쏘나타', '고급휘발유':'쏘나타', '경유':'스타렉스', '전기':'' };
  function fuelMap(){ var m=lsGet(LS_FUELMAP,null); return (m&&typeof m==='object')?m:FUEL_DEF; }
  function fuelMapSave(m){ lsSet(LS_FUELMAP,m); }
  /* 글자에서 유종 알아내기 — 영수증·품목·메모 어디에 있어도 잡는다 */
  function sniffFuel(txt){
    var t=String(txt||'').toUpperCase().replace(/\s/g,'');
    if(/LPG|L\.P\.G|엘피지|부탄/.test(t))            return 'LPG';
    if(/고급휘발유|고급유/.test(t))                     return '고급휘발유';
    if(/휘발유|가솔린|GASOLINE|무연/.test(t))           return '휘발유';
    if(/경유|디젤|DIESEL/.test(t))                      return '경유';
    if(/충전|전기|EV|KWH/.test(t))                      return '전기';
    return '';
  }
  function carForFuel(f){
    if(!f) return '';
    var m=fuelMap(), want=m[f]||'';
    if(!want) return '';
    return cars().some(function(c){ return c.n===want; }) ? want : '';
  }

  /* ── 연락처 분류 ── */
  var CTC_DEF=['가족','친구','거래처','병원','식당','관공서','업무','기타'];
  function ctCats(){ var a=lsGet(LS_CTC,null); return (Array.isArray(a)&&a.length)?a:CTC_DEF.slice(); }
  function ctColor(k){ return {'가족':'#f43f5e','친구':'#8b5cf6','거래처':'#0ea5e9','병원':'#14b8a6',
    '식당':'#fb923c','관공서':'#64748b','업무':'#6366f1','기타':'#9ca3af'}[k]||'#9ca3af'; }

  var PAY=['카드','현금','계좌이체','간편결제','법인카드','기타'];

  /* ══════ 카테고리 · 입력 서식 ══════
     t: text num date time area sel star map tel rows calc chk
     w: full(전체) half(2칸) — 없으면 1칸                       */
  var CAT_P = {
    todo: { i:'🔔', n:'챙길 일', c:'#f59e0b', f:[
      {k:'date',   l:'예정일', t:'date', req:1},
      {k:'repeat', l:'반복',   t:'sel', o:['없음','매주','매월','매년']},
      {k:'title',  l:'무엇을', t:'text', w:'half', req:1, p:'예: 자동차 보험 갱신'},
      {k:'amount', l:'예상 금액(원)', t:'num'},
      {k:'where',  l:'어디서', t:'text'},
      {k:'detail', l:'메모',   t:'area', w:'full'}
    ]},
    buy: { i:'🛒', n:'구매', c:'#0ea5e9', f:[
      {k:'link',   l:'인터넷몰 링크', t:'link', w:'full', p:'https://... 붙여넣고 🤖 를 누르면 자동으로 채워요'},
      {k:'date',   l:'날짜',   t:'date', req:1},
      {k:'cur',    l:'통화',   t:'sel', o:['원','달러','엔','유로'], reload:1},
      {k:'title',  l:'품목명', t:'text', w:'half', req:1, p:'예: 무선 드릴'},
      {k:'brand',  l:'브랜드', t:'text', p:'삼성, 애플...'},
      {k:'where',  l:'구매처', t:'text', p:'쿠팡, 아마존...'},
      {k:'unit',   l:'단가',   t:'num', p:'150000', link:'buy'},
      {k:'qty',    l:'개수',   t:'num', p:'1', link:'buy'},
      {k:'ship',   l:'배송비', t:'num', p:'3000', link:'buy'},
      {k:'shipinc',l:'배송비 처리', t:'sel', o:['합계에 더하기','단가에 이미 포함'], reload:0, link:'buy'},
      {k:'rate',   l:'환율 (1 = ? 원)', t:'rate', w:'half', fx:1},
      {k:'amount', l:'합계 (원)', t:'calc', w:'half', calc:'buy'},
      {k:'pay',    l:'결제수단', t:'sel', o:PAY},
      {k:'warranty',l:'보증 만료일', t:'date'},
      {k:'items',  l:'품목 목록', t:'rows', w:'full',
        cols:[{k:'name',p:'품목명'},{k:'qty',p:'수량',n:1,w:'80px'},{k:'price',p:'단가',n:1,w:'110px'},{k:'note',p:'옵션·메모'}]},
      {k:'detail', l:'메모 · 후기', t:'area', w:'full'}
    ]},
    food: { i:'🍜', n:'맛집', c:'#fb923c', f:[
      {s:'📍 기본 정보'},
      {k:'title',  l:'상호명', t:'text', w:'half', req:1, p:'예: 밀양돼지국밥'},
      {k:'ftype',  l:'음식 종류', t:'sel', o:['','한식','중식','일식','양식','분식','고기','국밥·탕','면','카페·디저트','술집','기타']},
      {k:'sido',   l:'시/도',  t:'text', p:'경남'},
      {k:'gugun',  l:'구/군',  t:'text', p:'창원시 성산구'},
      {k:'addr',   l:'상세 주소', t:'map', w:'half', p:'도로명 주소'},
      {k:'phone',  l:'전화번호', t:'tel', p:'055-123-4567'},
      {s:'🕐 운영 정보'},
      {k:'open',   l:'오픈 시간', t:'time'},
      {k:'close',  l:'클로즈 시간', t:'time'},
      {k:'off',    l:'휴무일',  t:'text', p:'매주 월요일 / 연중무휴'},
      {k:'park',   l:'주차',    t:'sel', o:['','가능','불가','발렛','인근 공영']},
      {s:'🍽 방문 기록'},
      {k:'date',   l:'방문일',  t:'date', req:1},
      {k:'rating', l:'별점',    t:'star'},
      {k:'amount', l:'지출 금액(원)', t:'num'},
      {k:'with',   l:'동행',    t:'text', p:'가족, 친구...'},
      {k:'menus',  l:'메뉴별 평가', t:'rows', w:'full',
        cols:[{k:'name',p:'메뉴명'},{k:'price',p:'가격',n:1,w:'90px'},
              {k:'score',p:'맛평가',sel:['맛평가','⭐5 최고','⭐4 좋음','⭐3 보통','⭐2 별로','⭐1 실망'],w:'110px'},
              {k:'note',p:'한줄평'}], sum:'price'},
      {k:'detail', l:'메모 · 재방문 여부', t:'area', w:'full'}
    ]},
    health: { i:'💊', n:'건강', c:'#14b8a6', f:[
      {k:'date',   l:'날짜',   t:'date', req:1},
      {k:'title',  l:'증상 · 검진', t:'text', w:'half', req:1, p:'예: 감기 진료'},
      {k:'who',    l:'병원 · 의사', t:'text', p:'서울내과'},
      {k:'phone',  l:'전화번호', t:'tel'},
      {k:'addr',   l:'주소',   t:'map', w:'half'},
      {k:'insur',  l:'보험 청구', t:'sel', o:['해당없음','청구 예정','청구 완료']},
      {k:'next',   l:'다음 예약일', t:'date'},
      {k:'costs',  l:'진료비 · 약값', t:'rows', w:'full',
        cols:[{k:'name',p:'항목 (진료비·약값·검사)'},{k:'price',p:'금액',n:1,w:'110px'}], sum:'price'},
      {k:'detail', l:'처방 · 메모', t:'area', w:'full'}
    ]},
    book: { i:'📖', n:'독서', c:'#7c3aed', f:[
      {k:'date',   l:'날짜',   t:'date', req:1},
      {k:'title',  l:'책 제목', t:'text', w:'half', req:1, p:'예: 사피엔스'},
      {k:'who',    l:'저자',   t:'text'},
      {k:'btype',  l:'종류',   t:'sel', o:['📕 종이책','📱 전자책','🎧 오디오북']},
      {k:'rating', l:'별점',   t:'star'},
      {k:'totalpg',l:'전체 페이지', t:'num', p:'480'},
      {k:'readpg', l:'읽은 페이지', t:'num', p:'이어볼 쪽'},
      {k:'prog',   l:'진행률',  t:'calc', calc:'book'},
      {k:'quotes', l:'핵심 문장 ↔ 내 생각', t:'rows', w:'full',
        cols:[{k:'name',p:'핵심 문장 (p.쪽)'},{k:'note',p:'내 생각'}]},
      {k:'detail', l:'전체 감상', t:'area', w:'full'}
    ]},
    person: { i:'👤', n:'사람', c:'#10b981', f:[
      {k:'date',   l:'날짜',   t:'date', req:1},
      {k:'ptype2', l:'구분',   t:'sel', o:['통화','만남','가족','경조사']},
      {k:'who',    l:'상대',   t:'text', w:'half', p:'홍길동 / 아내'},
      {k:'phone',  l:'전화번호', t:'tel'},
      {k:'title',  l:'무슨 일', t:'text', w:'half', req:1, p:'계약 일정 조율 / 점심 식사'},
      {k:'time',   l:'시간',   t:'time'},
      {k:'place',  l:'장소',   t:'text'},
      {k:'amount', l:'쓴 돈(원)', t:'num'},
      {k:'prep',   l:'준비물',  t:'text', w:'half', p:'계약서, 도장'},
      {k:'detail', l:'내용 · 결정사항', t:'area', w:'full'}
    ]},
    think: { i:'💭', n:'생각', c:'#8b5cf6', f:[
      {k:'date',   l:'날짜',   t:'date', req:1},
      {k:'ptype2', l:'종류',   t:'sel', o:['생각','아이디어','배운 것','반성']},
      {k:'title',  l:'제목',   t:'text', w:'half', req:1, p:'요즘 드는 생각'},
      {k:'items',  l:'생각 ↔ 자세히', t:'rows', w:'full',
        cols:[{k:'name',p:'한 줄로'},{k:'note',p:'자세히 · 실행 방법'}]},
      {k:'detail', l:'전체 메모', t:'area', w:'full'}
    ]},
    trip: { i:'✈️', n:'여행', c:'#f59e0b', f:[
      {k:'date',   l:'출발일', t:'date', req:1},
      {k:'end',    l:'도착일', t:'date'},
      {k:'title',  l:'장소 · 여행명', t:'text', w:'half', req:1, p:'제주도 가족여행'},
      {k:'who',    l:'누구와', t:'text', p:'가족 4명'},
      {k:'addr',   l:'주소',   t:'map', w:'half'},
      {k:'phone',  l:'전화번호', t:'tel'},
      {k:'rating', l:'별점',   t:'star'},
      {k:'costs',  l:'경비',   t:'rows', w:'full',
        cols:[{k:'name',p:'항목 (숙박·교통·식비)'},{k:'price',p:'금액',n:1,w:'110px'},{k:'note',p:'메모'}], sum:'price'},
      {k:'detail', l:'일정 · 좋았던 것', t:'area', w:'full'}
    ]},
    daily: { i:'📔', n:'일상', c:'#ec4899', f:[
      {k:'date',   l:'날짜',   t:'date', req:1},
      {k:'weather',l:'날씨',   t:'sel', o:['☀️ 맑음','⛅ 흐림','🌧️ 비','❄️ 눈','💨 바람','🌤️ 구름 조금']},
      {k:'mood',   l:'기분',   t:'sel', o:['😊 좋음','😐 보통','😔 나쁨','😤 화남','😌 평온','🥳 신남','😴 피곤']},
      {k:'title',  l:'오늘 한 마디', t:'text', w:'full', req:1, p:'오늘을 한 단어로 표현한다면?'},
      {k:'detail', l:'오늘 있었던 일', t:'area', w:'full'},
      {k:'thanks', l:'감사한 것', t:'rows', w:'full', cols:[{k:'name',p:'감사한 일'}]},
      {k:'tomorrow',l:'내일 할 일', t:'area', w:'full'}
    ]},
    etc: { i:'📌', n:'기타', c:'#64748b', f:[
      {k:'date',   l:'날짜',   t:'date', req:1},
      {k:'title',  l:'제목',   t:'text', w:'half', req:1, p:'세무서 서류 제출'},
      {k:'who',    l:'관련 인물 · 장소', t:'text'},
      {k:'amount', l:'금액(원)', t:'num'},
      {k:'phone',  l:'전화번호', t:'tel'},
      {k:'addr',   l:'주소',   t:'map', w:'half'},
      {k:'detail', l:'내용',   t:'area', w:'full'}
    ]}
  };
  /* ══ v256 — 달님 : 「일상 첫째, 차계부 둘째, 구매·맛집·독서·생각 … 건강·사람은 잘 안 써」
     순서만 바꾼다. 저장된 기록의 열쇠(buy·food…)는 그대로라 옛 기록에 아무 영향 없다.
     ⚠ 열쇠 이름을 바꾸면 옛 기록이 「기타」로 보이므로 이름은 절대 안 바꾼다.
     차계부(car)는 CAT_P 밖의 별도 종류라 고르기 창에서 이 순서표로 끼워 넣는다. */
  var CAT_ORDER = ['daily','car','buy','food','book','think','todo','trip','etc','health','person'];
  (function reorder(o){
    var keep = {}; Object.keys(o).forEach(function(k){ keep[k]=o[k]; delete o[k]; });
    CAT_ORDER.forEach(function(k){ if(keep[k]){ o[k]=keep[k]; delete keep[k]; } });
    Object.keys(keep).forEach(function(k){ o[k]=keep[k]; });          /* 표에 없는 것은 뒤에 */
  })(CAT_P);
  /* 고르기 창용 — 차계부까지 끼운 순서 */
  function catPickList(){
    var c = cats(), out = [], seen = {};
    CAT_ORDER.forEach(function(k){
      if(k==='car'){ out.push({k:'car', i:'🚗', n:'차계부'}); seen.car=1; }
      else if(c[k]){ out.push({k:k, i:c[k].i, n:c[k].n}); seen[k]=1; }
    });
    Object.keys(c).forEach(function(k){ if(!seen[k]) out.push({k:k, i:c[k].i, n:c[k].n}); });
    if(!seen.car) out.push({k:'car', i:'🚗', n:'차계부'});
    return out;
  }

  /* ── 차계부: 구분별로 서식이 달라진다 ── */
  var CARF = {
    base:[
      {k:'car',   l:'차량',  t:'sel', o:[], car:1, req:1},
      {k:'ctype', l:'구분',  t:'sel', o:['주유','정비','보험','세차','검사','주차·통행료','기타'], req:1, reload:1},
      {k:'date',  l:'날짜',  t:'date', req:1},
      {k:'odo',   l:'주행거리(km)', t:'num', p:'계기판 숫자', last:1}
    ],
    주유:[
      {s:'⛽ 주유 내역'},
      {k:'amount',l:'총 금액(원)', t:'num', p:'80000', link:'fuel'},
      {k:'liter', l:'주유량 (L)',  t:'num', p:'47.5', link:'fuel'},
      {k:'unit',  l:'리터당 단가(원)', t:'num', p:'1680', link:'fuel'},
      {k:'fuel',  l:'유종',  t:'sel', o:['휘발유','경유','LPG','고급휘발유','전기']},
      {k:'pay',   l:'결제',  t:'sel', o:PAY},
      {s:'📍 주유소 정보'},
      {k:'place', l:'주유소명', t:'text', w:'half', p:'예: GS칼텍스 강남점'},
      {k:'addr',  l:'주소',   t:'map',  w:'half', p:'도로명 주소'},
      {k:'phone', l:'전화번호', t:'tel', p:'055-123-4567'},
      {k:'open',  l:'오픈 시간', t:'time'},
      {k:'close', l:'클로즈 시간', t:'time'},
      {k:'off',   l:'휴무일', t:'text', p:'연중무휴 / 매주 월요일'},
      {k:'detail',l:'메모',   t:'area', w:'full', p:'특이사항'}
    ],
    정비:[
      {s:'🔧 정비 내역'},
      {k:'title', l:'정비 제목', t:'text', w:'half', p:'예: 엔진오일 교체'},
      {k:'place', l:'정비소',   t:'text', p:'공임나라 하안점'},
      {k:'phone', l:'전화번호', t:'tel'},
      {k:'addr',  l:'주소',     t:'map', w:'half'},
      {k:'nextodo',l:'다음 정비 주행거리(km)', t:'num', p:'175000'},
      {k:'parts', l:'정비 항목', t:'rows', w:'full',
        cols:[{k:'name',p:'항목 (엔진오일·에어컨필터)'},{k:'price',p:'금액',n:1,w:'110px'}], sum:'price', to:'amount'},
      {k:'amount',l:'총 금액(원)', t:'num'},
      {k:'detail',l:'메모', t:'area', w:'full'}
    ],
    보험:[
      {s:'🛡 보험'},
      {k:'title', l:'보험사 · 상품', t:'text', w:'half', p:'삼성화재 자동차보험'},
      {k:'amount',l:'보험료(원)', t:'num'},
      {k:'phone', l:'전화번호', t:'tel'},
      {k:'end',   l:'만기일',  t:'date'},
      {k:'detail',l:'메모', t:'area', w:'full'}
    ],
    검사:[
      {s:'📋 검사'},
      {k:'title', l:'검사 종류', t:'text', w:'half', p:'정기 검사 / 종합 검사'},
      {k:'place', l:'검사소',   t:'text'},
      {k:'amount',l:'금액(원)', t:'num'},
      {k:'end',   l:'다음 검사일', t:'date'},
      {k:'detail',l:'메모', t:'area', w:'full'}
    ],
    기본:[
      {k:'title', l:'내용',   t:'text', w:'half'},
      {k:'place', l:'어디서', t:'text'},
      {k:'amount',l:'금액(원)', t:'num'},
      {k:'pay',   l:'결제',   t:'sel', o:PAY},
      {k:'detail',l:'메모',   t:'area', w:'full'}
    ]
  };
  function carFields(ct){
    var ext = CARF[ct] || CARF['기본'];
    if(ct==='세차'||ct==='주차·통행료'||ct==='기타') ext = CARF['기본'];
    return CARF.base.concat(ext);
  }

  /* ── 연락처 서식 ── */
  var CTF=[
    {k:'name',  l:'이름 · 상호', t:'text', w:'half', req:1},
    {k:'cat',   l:'분류',   t:'sel', o:[], ctc:1},
    {k:'phone', l:'전화번호', t:'tel', p:'010-1234-5678'},
    {k:'phone2',l:'전화번호 2', t:'tel', p:'사무실 · 팩스'},
    {k:'person',l:'담당자',  t:'text', p:'김과장'},
    {k:'email', l:'이메일',  t:'text'},
    {k:'addr',  l:'주소',    t:'map', w:'half'},
    {k:'birth', l:'생일 · 기념일', t:'date'},
    {k:'memo',  l:'메모',    t:'area', w:'full'}
  ];

  /* ══════ 데이터 접근 ══════ */
  /* ══════════════════════════════════════════════════════════
     🗃 데이터셋 — 같은 엔진으로 개인일지·업무일지를 함께 다룬다
     ══════════════════════════════════════════════════════════ */
  var DS = null;                                   /* 지금 보고 있는 데이터셋 */
  function ent(){ try{ return DS.all(); }catch(e){ return []; } }
  function pAdd(o){ try{ return DS.add(o); }catch(e){ return null; } }
  function pUpd(id,o){ try{ return DS.upd(id,o); }catch(e){ return null; } }
  function pDel(id){ try{ DS.del(id); }catch(e){} }
  function cats(){ return (DS && DS.cats) || CAT_P; }
  function catEtc(){ var c=cats(); return c.etc || c[Object.keys(c)[0]] || {i:'📌',n:'기타',c:'#64748b',f:[]}; }
  function isPersonal(){ return !DS || DS.key==='personal'; }
  var LS_SUBSHOW='wl_life_showsub';
  function showSub(){ return !!lsGet(LS_SUBSHOW,false); }
  function recs(pt){ return ent().filter(function(e){
    if(!e || !DS.mine(e)) return false;
    if(e.parentId && !showSub()) return false;        /* 하위 항목은 목록에서 숨김 */
    return (!pt || DS.ptypeOf(e)===pt); }); }
  function contacts(){ try{ return (window.wlP&&window.wlP.list()||[]).filter(function(e){ return e && e.kind==='pcontact'; }); }catch(e){ return []; } }
  function byDate(a){ return a.slice().sort(function(x,y){
    return String(y.date||'').localeCompare(String(x.date||'')) ||
           ((y.createdAt||0)-(x.createdAt||0)); }); }
  function hit(e,q){ if(!q) return true;
    var s=q.toLowerCase();
    var stamp = (e.updatedAt||e.createdAt||0) + '|' + String(e.body||'').length;
    if(!e._sx || e._sxn!==stamp){
      var c={}; Object.keys(e).forEach(function(k){
        if(k==='photos'||k==='scanRefs'||k==='_sx'||k==='_sxn') return;
        if(k==='body'){
          /* 본문은 글자만 — 붙여넣은 사진(base64)은 색인에서 뺀다 */
          c[k] = String(e[k]||'')
            .replace(/<img[^>]*>/gi,' ')
            .replace(/data:[^"')\s]{40,}/g,' ')
            .replace(/<[^>]+>/g,' ')
            .slice(0, 4000);
          return;
        }
        var v=e[k];
        if(typeof v==='string' && v.length>4000) v=v.slice(0,4000);
        c[k]=v;
      });
      try{ e._sx=JSON.stringify(c).toLowerCase(); }catch(x){ e._sx=''; }
      e._sxn=stamp;
    }
    return e._sx.indexOf(s)>=0; }

  /* 항목합계 */
  function rowSum(rows, key){ var t=0; esr(rows).forEach(function(r){ t+=num(r[key]); }); return t; }
  /* 그 기록의 실제 지출액 */
  function money(e){
    if(isPersonal() && e.ptype==='todo') return 0;          /* 챙길 일은 '예정' 금액 — 지출 합계 제외 */
    if(e.ptype==='car' && e.ctype==='정비' && esr(e.parts).length && !num(e.amount)) return rowSum(e.parts,'price');
    if(!isPersonal()){
      var bmm=(DS.bmap&&DS.bmap._amount)||[];
      for(var mi=0; mi<bmm.length; mi++){ var mv=num(e[bmm[mi]]); if(mv) return mv; }
      return num(e.amount||e.cost||e.total||e.price||0);
    }
    if(num(e.amount)) return num(e.amount);
    if(esr(e.costs).length) return rowSum(e.costs,'price');
    if(esr(e.menus).length) return rowSum(e.menus,'price');
    if(esr(e.parts).length) return rowSum(e.parts,'price');
    return 0;
  }

  var cur='rec', curCat='전체', curCar='', curQ='', curMonth='', curCtype='';

  /* ══════ 카드 ══════ */
  function stars(n){ n=parseInt(n,10)||0; return n? '★'.repeat(n)+'☆'.repeat(5-n) : ''; }

  /* ══ v214 — 제목 앞에 [대상년도][대상월][해당층] ══════════════
     달님 : 「제목 앞에 대상년도 대상월 해당층 순으로, 셀에 데이터가 있으면 나오게」
     🔴 저장된 제목은 건드리지 않는다 — 보이기만 한다 (제0원칙-13).
     카드·달력·목록이 모두 이 창구 하나만 쓴다 → 한 곳만 고치면 전부 따라온다. */
  function wlTitlePfx(e){
    try{
      if(!e) return '';
      var out=[];
      var y=String(e.refYear==null?'':e.refYear).trim();
      var m=String(e.refMonth==null?'':e.refMonth).trim();
      var f=String(e.floor==null?'':e.floor).trim();
      if(y) out.push(/년$/.test(y) ? y : (y+'년'));
      if(m) out.push(/월$/.test(m) ? m : (m+'월'));
      if(f) out.push(f);
      return out.join(' ');
    }catch(err){ console.warn('[제목 앞머리] 실패', err); return ''; }
  }
  window.wlTitlePfx = wlTitlePfx;
  /* 화면에 붙일 모양 — 제목보다 옅게 해서 제목이 묻히지 않게 */
  function pfxHTML(e){
    var t = wlTitlePfx(e);
    return t ? ('<span style="color:#6b86a3;font-weight:700;font-size:.86em">' + esc(t) + '</span> ') : '';
  }

  /* v250 — 카드 오른쪽 아래 날짜. 올해면 「09-02 (수)」, 다른 해면 「2025-11-12」 */
  function cardDateHTML(e){
    var d='';
    try{ d = String(pget(e,'_date')||e.date||'').slice(0,10); }catch(_d){ d = String(e.date||'').slice(0,10); }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    var p=d.split('-'), dt=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));
    var wd='일월화수목금토'.charAt(dt.getUTCDay());
    var txt = (p[0]===today().slice(0,4)) ? (p[1]+'-'+p[2]+' ('+wd+')') : d;
    return '<span class="lf-date" title="'+d+'">📅 '+txt+'</span>';
  }
  function card(e){
    var pty = DS.ptypeOf(e);
    var d = (isPersonal() && pty==='car') ? {i:'🚗',n:'차계부',c:carColor(e.car)} : (cats()[pty]||catEtc());
    var col = d.c, ttl='', tags='', note='', mo=money(e);

    if(isPersonal() && pty==='car'){
      ttl = (e.ctype||'기타') + (e.place? ' · '+e.place : (e.title? ' · '+e.title : ''));
      tags = '<span class="lf-tag" style="background:'+col+'1f;color:'+col+'">'+esc(e.car||'차량')+'</span>';
      if(e.odo) tags += '<span style="color:#c026d3;font-weight:800">📍 '+won(e.odo)+'km</span>';
      if(e.liter) tags += '<span>'+num(e.liter)+'L</span>';
      note = e.detail||'';
    } else if(isPersonal() && pty==='todo'){
      ttl = e.title||'';
      var dd = dday(e.date);
      if(e.done) tags='<span class="lf-tag" style="background:#d1fae5;color:#065f46">완료</span>';
      else if(dd===null) tags='';
      else if(dd<0) tags='<span class="lf-tag" style="background:#fee2e2;color:#991b1b">'+(-dd)+'일 지남</span>';
      else if(dd===0) tags='<span class="lf-tag" style="background:#fef3c7;color:#92400e">오늘</span>';
      else tags='<span class="lf-tag" style="background:#dbeafe;color:#1e40af">D-'+dd+'</span>';
      if(e.repeat && e.repeat!=='없음') tags+='<span class="lf-tag" style="background:#ede9fe;color:#5b21b6">🔁 '+esc(e.repeat)+'</span>';
      note = e.detail||'';
    } else {
      /* 제목 — 종류마다 제목이 담기는 칸이 다르다 (오늘계획은 text, 통화는 content …) */
      ttl = e.title || e.who || '';
      if(!ttl && !isPersonal()){ try{ ttl = String(pget(e,'_title')||''); }catch(_t){} }
      /* v196 — 달님 : 「입고의 제목이 이상하게 나와」
            입출고는 제목 자리가 품목 **id**(Uml1oEcU…) 라 알아볼 수 없었다.
            품목명을 먼저 쓰고, 없으면 자재 목록에서 이름을 찾아온다. */
      /* v207 — 품목 이름 찾기는 titleFix 한 곳에서만 한다 (v196 의 덩어리를 여기서 뺐다) */
      try{ ttl = titleFix(e, ttl); }catch(_s){ console.warn('[카드] 제목 다듬기 실패', _s); }
      if(!ttl) ttl = d.n;
      /* v196 — 달님 : 「카드에 메모라고 써있는건 지워도 되잔아 메모인지 다 아니까」
            지금 그 종류 하나만 보고 있으면 같은 배지를 카드마다 또 붙이지 않는다.
            「전체」로 볼 때는 종류를 알아야 하므로 그대로 붙인다.
            🌐 사이트는 「눌러서 여는 단추」를 겸하므로 남긴다. */
      var _sameKind = false;
      try{
        _sameKind = isPersonal() ? (curCat !== '전체' && curCat === pty)
                                 : !!(DS && DS.kind === pty);
      }catch(_sk){}
      /* v193 — 🌐 사이트는 배지를 누르면 바로 인터넷 창으로 (카드는 안 열린다) */
      if(pty==='site' && e.url){
        tags = '<span class="lf-tag" data-siteurl="'+esc(e.url)+'" title="눌러서 인터넷으로 열기"'
             + ' style="background:'+col+'1f;color:'+col+';cursor:pointer;font-weight:800;'
             + 'text-decoration:underline">'+d.i+' '+d.n+' ↗</span>';
      }else if(_sameKind){
        tags = '';                                   /* v196 — 같은 종류만 볼 때는 생략 */
      }else{
        tags = '<span class="lf-tag" style="background:'+col+'1f;color:'+col+'">'+d.i+' '+d.n+'</span>';
      }
      /* v214 — 달님 : 「95% 이상이 완료다」
         완료는 굳이 안 적는다. 아직 안 끝난 것만 눈에 띄게 (미완료·진행중…). */
      try{ if(String(statVal(e, pty)||'') !== '완료') tags += statTag(e, pty); }
      catch(_st){ tags += statTag(e, pty); }                         /* 상태·구분을 한눈에 */
      /* v217 — 📅 예정은 카드에서 바로 완료로 (누르면 sStatus='완료') */
      if(pty==='schedule' && String(e.sStatus||'') !== '완료'){
        tags += '<span class="lf-tag" data-schdone="'+esc(e.id)+'" title="눌러서 완료로 바꾸기"'
              + ' style="background:#eefaf4;color:#0f7a4a;border:1px solid #a7e3c8;'
              + 'cursor:pointer;font-weight:800">✅ 완료로</span>';
      }
      if(pty==='plan' && Number(e.carryN)>0 && statVal(e,'plan')!=='완료')
        tags += '<span class="lf-tag" style="background:#fef3c7;color:#92400e">⏭ '+Number(e.carryN)+'일째</span>';
      var vd = (typeof vendorOf==='function') ? vendorOf(e) : '';
      if(vd) tags += '<span class="lf-tag" style="background:#eaf1fb;color:#2563a8">'+esc(String(vd).slice(0,14))+'</span>';
      /* v214 — 해당층은 제목 앞으로 옮겼다 (pfxHTML) */
      if(e.ptype2) tags += '<span class="lf-tag" style="background:#f1f5f9;color:#475569">'+esc(e.ptype2)+'</span>';
      if(e.rating) tags += '<span style="color:#f4b942;font-weight:800">'+stars(e.rating)+'</span>';
      if(pty==='book' && num(e.totalpg)) tags += '<span class="lf-tag" style="background:#ede9fe;color:#5b21b6">'
        + Math.min(100,Math.round(num(e.readpg)/num(e.totalpg)*100)) + '%</span>';
      if(pty==='buy' && e.warranty){ var wd=dday(e.warranty);
        if(wd!==null && wd>=0 && wd<=60) tags += '<span class="lf-tag" style="background:#fee2e2;color:#991b1b">보증 D-'+wd+'</span>'; }
      if(pty==='daily'){ if(e.mood) tags+='<span>'+esc(e.mood)+'</span>'; if(e.weather) tags+='<span>'+esc(e.weather)+'</span>'; }
      if(e.who && pty!=='person') tags += '<span>'+esc(e.who)+'</span>';
      if(e.where) tags += '<span>'+esc(e.where)+'</span>';
      note = e.detail || e.memo || '';
      /* v197 — 달님 : 「일반메모는 제목과 내용이 같이 나오게」
            종류마다 「내용」이 담기는 칸이 다르다 (메모는 body · 전달·통화는 content …).
            제목과 마찬가지로 지도(BMAP)를 따라간다. */
      if(!note && !isPersonal()){
        try{ note = String(pget(e,'_memo')||''); }catch(_m){}
      }
      /* 제목과 내용이 같은 글이면(제목이 없어 내용을 제목으로 쓴 경우) 한 번만 보여 준다 */
      if(note && ttl && String(note).trim() === String(ttl).trim()) note = '';
      /* v198 — 달님 : 「사이트 주소는 지우고 내용만 나오게, 없으면 빈 상태」
            주소는 배지 ↗ 로 열면 되므로 카드에는 넣지 않는다.
            달님 : 「소분류와 관련처가 안 나오는 듯」 → 태그로 보여 준다. */
      if(pty==='site'){
        if(e.subcategory)
          tags += '<span class="lf-tag" style="background:#f1f5f9;color:#475569">'
                + esc(e.subcategory) + '</span>';
      }
    }
    var nR=esr(e.scanRefs).filter(function(r){return r.type==='receipt';}).length;
    var nC=esr(e.scanRefs).filter(function(r){return r.type==='card';}).length;
    if(nR) tags += '<span class="lf-tag" style="background:#fef3c7;color:#92400e">\ud83e\uddfe '+nR+'</span>';
    if(nC) tags += '<span class="lf-tag" style="background:#e0e7ff;color:#3730a3">\ud83d\udcbc '+nC+'</span>';
    if(e.cur && e.cur!=='\uc6d0') tags += '<span class="lf-tag" style="background:#dcfce7;color:#166534">'+esc(e.cur)+'</span>';
    var ph='';
    var pics = esr(e.photos).concat(esr(e.scanRefs).map(function(r){ return (r.data&&r.data.photoUrl)||''; }).filter(Boolean));
    /* v251 — 달님 : 「사진이 있으면 카드에 두 장 나와 카드만 커져 — 한 장만」
       대표 사진(wlThumb, worklog.js)이 제목 옆에 이미 붙으므로 아래 사진띠는 그게 꺼져 있을 때만, 그것도 1장만 */
    var _thumbOn = true; try{ _thumbOn = localStorage.getItem('wl_thumb') !== '0'; }catch(_t){}
    if(pics.length && !_thumbOn) ph = '<div class="lf-ph">' + pics.slice(0,1).map(function(u){
      return '<img src="'+esc(u)+'">'; }).join('') + '</div>';

    var chC = colorHit(e, pty);
    /* 구분 기준이 상태라면 카드 테두리도 그 색으로 — 눈으로 바로 갈린다 */
    try{
      var sv0 = statVal(e, pty);
      if(sv0 && effGrp(pty)==='_stat') col = statColor(sv0, pty);
    }catch(_e){}
    return '<div class="lf-card" data-lid="'+esc(e.id)+'" style="border-left-color:'+col
      + (e.done?';opacity:.58':'') + (chC? (';background:'+colorOf(chC.color).bg+'66'):'') + '">'
      + '<button class="lf-del" data-ldel="'+esc(e.id)+'" title="삭제">🗑</button>'
      /* ══ v208 — 카드 모양을 통일한다 ══
            달님 : 「사이트 카드가 다 서로 틀리게 나오는 거 왜 그런지 파악하고 통일시켜」
            ▶ 원인 두 가지
              ① v207 에서 넣은 `.lf-m:last-child{margin-top:auto}` — 내용이 있는 카드는
                 배지 줄이 위에, 없는 카드는 바닥에 붙어 **줄 차례가 카드마다 달랐다**.
                 (v208 에서 그 규칙을 뺐다)
              ② 날짜가 없는 종류(🌐 사이트·📦 자재…)도 「📅 」 만 찍혀 자리를 먹었다.
            ▶ 이제 모든 카드가 **제목 / 배지 줄 / 내용 두 줄 자리** 로 똑같이 생긴다.
               내용이 없어도 자리는 지킨다 (.lf-note 의 min-height). */
      + '<div class="lf-t">'+pfxHTML(e)+esc(ttl)+'</div>'
      /* v214 — 달님 : 「카드 가운데 줄 없애줘, 제목과 내용이 나오게」
         날짜는 위의 묶음 이름표에 이미 있고, 층은 제목 앞으로, 완료는 안 적는다.
         그래서 대개 이 줄이 통째로 사라진다. 남을 것이 있을 때만 그린다. */
      /* v250 — 달님 : 「카드에 날짜 나오게 해줘」 배지 줄 오른쪽 끝에 날짜 (올해면 월-일(요일), 아니면 연-월-일) */
      + ((tags || cardDateHTML(e)) ? ('<div class="lf-m">' + tags + cardDateHTML(e) + '</div>') : '')
      + (mo? '<div class="lf-money">💰 '+won(mo)+'원</div>':'')
      /* v250 — 달님 : 「내용 없는데도 자리 차지해 창이 좁아 보여」 내용 있을 때만 그린다 (v208 의 '자리 지키기' 는 접음) */
      + (note ? ('<div class="lf-note">'+esc(note)+'</div>') : '')
      + ph
      + '</div>';
  }

  /* v217 — ✅ 예정 완료. 카드 열기보다 먼저 잡는다(capture) */
  document.addEventListener('click', function(ev){
    var el = ev.target && ev.target.closest && ev.target.closest('[data-schdone]');
    if(!el) return;
    ev.preventDefault(); ev.stopPropagation();
    var id = el.getAttribute('data-schdone');
    if(!id) return;
    try{
      try{ updateRecord(id, { sStatus:'완료' }); }
      catch(_u){ pUpd(id, { sStatus:'완료' }); }
      if(typeof toast==='function') toast('✅ 완료로 바꿨어요');
      setTimeout(function(){ try{ safeRender(); }catch(e){} }, 220);
    }catch(err){
      console.error('[예정 완료]', err);
      if(typeof toast==='function') toast('오류: ' + (err.message || err));
    }
  }, true);

  /* v193 — 🌐 사이트 배지 누르면 인터넷 창으로. 카드 열기보다 먼저 잡는다(capture) */
  document.addEventListener('click', function(ev){
    var el = ev.target && ev.target.closest && ev.target.closest('[data-siteurl]');
    if(!el) return;
    ev.preventDefault(); ev.stopPropagation();
    var u = String(el.getAttribute('data-siteurl') || '').trim();
    if(!u){ if(typeof toast==='function') toast('이 사이트에는 주소가 없어요'); return; }
    if(!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try{ window.open(u, '_blank', 'noopener'); }
    catch(e){ console.warn('[사이트] 열기 실패', e); if(typeof toast==='function') toast('창을 못 열었어요'); }
  }, true);

  function sBox(k,v,n){ return '<div class="lf-s"><div class="k">'+k+'</div><div class="v">'+v+'</div>'
    + (n?'<div class="n">'+n+'</div>':'') + '</div>'; }

  /* ── 보기 방식: 카드 / 표(노션) ── */
  var LS_VIEW='wl_life_view';
  /* ══════════════════════════════════════════════════════════
     🗃 데이터셋 정의
        · personal — 개인일지 (wlP 저장소)
        · work:<종류> — 업무일지 (entries 저장소, SCHEMA 서식)
     ══════════════════════════════════════════════════════════ */
  var HOST_ID = 'lifeHost';
  var DS_PERSONAL = {
    key:'personal', name:'개인', icon:'🏠', chips:true,
    cats: null,                                   /* 아래에서 CAT_P 로 채움 */
    all:  function(){ try{ return (window.wlP && window.wlP.list()) || []; }catch(e){ return []; } },
    mine: function(e){ return e && e.kind==='personal'; },
    ptypeOf: function(e){ return e && e.ptype; },
    add:  function(o){ return window.wlP ? window.wlP.add(o) : null; },
    upd:  function(id,o){ return window.wlP ? window.wlP.update(id,o) : null; },
    del:  function(id){ if(window.wlP) window.wlP.del(id); },
    newRec: function(pt){ return { kind:'personal', ptype:pt }; },
    fieldsOf: function(pt){ var c=CAT_P[pt]; return (c&&c.f)||[]; }
  };

  /* 업무일지 종류 — 이름·색·아이콘 */
  /* 아이콘·이름은 앱이 원래 쓰던 KIND_ICON / 탭 이름과 똑같이 맞춘다 —
     같은 것이 화면마다 다른 그림이면 헷갈린다 */
  var WORK_KINDS = {
    work:     {i:'🛠', n:'업무',     c:'#2563a8'},
    expense:  {i:'💰', n:'지출',     c:'#0f7a4a'},
    memo:     {i:'📝', n:'메모',     c:'#f4b942'},
    call:     {i:'📞', n:'통화',     c:'#0891b2'},
    schedule: {i:'📅', n:'예정',     c:'#7c3aed'},
    deliver:  {i:'📢', n:'전달',     c:'#ea580c'},
    vacation: {i:'🌴', n:'휴가',     c:'#16a34a'},
    meeting:  {i:'💼', n:'회의',     c:'#6366f1'},
    accident: {i:'🚨', n:'사고',     c:'#dc2626'},
    progress: {i:'🚧', n:'진행업무', c:'#b26b00'},
    item:     {i:'📦', n:'자재',     c:'#8b5cf6'},
    stock:    {i:'🔄', n:'입출고',   c:'#0284c7'},
    plan:     {i:'✅', n:'오늘계획', c:'#65a30d'},
    site:     {i:'🌐', n:'사이트',   c:'#64748b'},
    /* ══ v206 — 🧹 청소를 15번째 종류로 ══
          달님 : 「청소를 정식 종류로 올려」
          🔴 여기에 넣어도 「🧹 청소」 탭과 📊 월보고는 그대로다.
             그쪽은 entries 를 직접 읽는 자기 코드(renderCleaning·renderCleaningStats)를 쓰고,
             기록을 누르면 여전히 전용 창(openCleaningEditor)이 열린다
             (wlOpenAs 의 KINDS 에는 일부러 안 넣었다).
             여기에 넣는 것은 「🗃 데이터 탭에서 다른 기록처럼 다루기」 뿐이다. */
    cleaning: {i:'🧹', n:'청소',     c:'#0d9488'}
  };
  /* SCHEMA 안의 보조 서식까지 합쳐 온전한 속성 목록을 만든다 */
  /* SCHEMA 에는 없지만 입력창(모달)이 실제로 쓰는 칸들 —
     페이지와 입력창의 항목을 똑같이 맞추기 위해 여기에 적어 둔다 */
  /* ★ v119 — 지출 등록 창을 따로 열지 않고 업무 기록 안에서 끝내기 위한 칸들.
        달님 : 「지출등록 모달 따로 안나오게 하는거야」
        여기 적은 값은 저장할 때 지출 기록(expense)으로 저절로 옮겨진다
        — 지출 탭·월보고가 지출 기록을 세기 때문에 그쪽이 비면 통계가 어긋난다. */
  var WORK_EXTRA = {
    /* ══ v217 — 📅 예정에 「상태」 칸 ══
          달님 : 「예정업무에는 완료 버튼이 없어」
          조사해 보니 정말로 없었다 — 색을 칠하는 코드(scheduleStatusColor)는
          sStatus 를 보는데 그 값을 넣을 칸이 어디에도 없었다.
          🔴 SCHEMA 는 건드리지 않는다 (옛 창·CSV·보고서가 함께 읽는다 · 제0원칙-27). */
    schedule: [
      {k:'sStatus', label:'상태', type:'select', opts:['예정','진행중','완료','연기']}
    ],
    /* ══ v206 — 🧹 청소 ══
          🔴 `SCHEMA` 에는 넣지 않는다. SCHEMA 는 옛 입력창·CSV·보고서가 함께 읽으므로
             건드리면 어디가 흔들릴지 모른다. 여기(WORK_EXTRA)만 채우면
             노션식 페이지에만 칸이 생기고 옛 코드는 전혀 영향이 없다.
          목록 6종(소장지시·지시사항·특이사항·청소원작업·입고·출고)은
          칸이 아니라 표라서 `wlCleanEdit`(worklog.js) 가 맡는다. */
    cleaning: [
      {k:'foreman',   label:'반장',        type:'text'},
      {k:'tissueIn',  label:'점보롤 입고', type:'number'},
      {k:'tissueOut', label:'점보롤 출고', type:'number'},
      {k:'towelIn',   label:'핸드타월 입고', type:'number'},
      {k:'towelOut',  label:'핸드타월 출고', type:'number'}
    ],
    work: [
      {k:'purpose',     label:'용도',         type:'select',
       opts:(function(){ try{ return JSON.parse(localStorage.getItem('wl_exp_purposes_v44')||'null')
                              || ['자재구매','소모품','식대','폐기물 처리','기타']; }
                         catch(e){ return ['자재구매','소모품','식대','폐기물 처리','기타']; } })()},
      {k:'expSubType',  label:'하위 구분',      type:'select',   /* v185 — 업무 창과 같은 말로 */
       opts:['공사성','전기','수도','유선방송','전화','정수기','기타']},
      {k:'supplyAmt',   label:'공급가액 (원)', type:'number'},
      {k:'taxAmt',      label:'부가세 (원)',   type:'number'},
      {k:'isIssued',    label:'발급 완료',     type:'checkbox'},
      {k:'workVendor',  label:'업체',         type:'text'},
      {k:'spec',        label:'규격 · 사양',   type:'text'},
      {k:'matCost',     label:'자재 합계 (원)', type:'number'},   /* v135 — 자재 값은 여기 (비용 합계와 분리) */
      {k:'workContact', label:'담당자',       type:'text'},
      {k:'workRole',    label:'직책',         type:'text'},
      {k:'workPhone',   label:'전화',         type:'tel'},
      {k:'startTime',   label:'시작 시각',    type:'time'},
      {k:'endTime',     label:'끝난 시각',    type:'time'},
      {k:'refYear',     label:'대상년도',     type:'select'},
      {k:'refMonth',    label:'대상월',       type:'select'},
      {k:'workMemo',    label:'업체 메모',    type:'textarea', full:true}
    ],
    expense: [
      {k:'vendor',      label:'업체',          type:'text'},
      {k:'purpose',     label:'용도',          type:'select'},
      /* v242 — 고를 목록은 창구(wlExpSubs)가 준다. 달님이 관리 창에서 고칠 수 있다 */
      {k:'expSubType',  label:'하위 구분',      type:'select',
       get opts(){ try{ return (window.wlExpSubs ? window.wlExpSubs.all() : []); }catch(e){ return []; } } },
      {k:'supplyAmt',   label:'공급가액 (원)',  type:'number'},
      {k:'taxAmt',      label:'부가세 (원)',    type:'number'},
      {k:'isIssued',    label:'계산서 발행',    type:'checkbox'},
      {k:'isJeonpyo',   label:'전표',          type:'checkbox'},
      /* v241 — 업체를 넣으면 연락처에서 저절로 채워질 자리 (비어 있으면 「빈 항목」 안에 숨는다) */
      {k:'workContact', label:'담당자',        type:'text'},
      {k:'workRole',    label:'직책',          type:'text'},
      {k:'workPhone',   label:'전화',          type:'tel'}
    ],
    item: [
      {k:'lastBuyDate', label:'마지막 구매일 (자동)', type:'date'}
    ],
    stock: [
      {k:'itemName',    label:'품목명 (자동)',  type:'text'}
    ],
    plan: [
      {k:'status',      label:'상태',          type:'select', opts:['미완료','보류','완료']},
      {k:'planFrom',    label:'처음 적은 날',   type:'date'}
    ]
  };

  function workFields(kind){
    var out=[], seen={};
    function push(arr){
      (arr||[]).forEach(function(f){
        if(!f || !f.k || seen[f.k]) return; seen[f.k]=1;
        var lb = f.label||f.k;
        if(f.type==='alertbefore') lb += ' (분 전)';
        out.push({ k:f.k, l:lb, t:wfType(f), o:f.opts,
                   w:(f.full?'full':''), p:f.ph });
      });
    }
    try{
      push(SCHEMA[kind]);
      ['_simple_more','_full','_full_more','_more'].forEach(function(sfx){
        if(SCHEMA[kind+sfx]) push(SCHEMA[kind+sfx]); });
      push(WORK_EXTRA[kind]);
    }catch(e){}
    return out;
  }
  function wfType(f){
    var t=f.type||'text';
    if(t==='number') return 'num';
    if(t==='textarea') return 'area';
    if(t==='select'||t==='status'||t==='field'||t==='floor'||t==='dir'||t==='vtype') return 'sel';
    if(t==='date') return 'date';
    if(t==='time'||t==='timepick') return 'time';       /* 🕐 시계로 고르기 */
    if(t==='alertbefore') return 'num';                  /* 몇 분 전 */
    if(t==='tel'||t==='phone') return 'tel';
    if(t==='link'||t==='url') return 'link';        /* v194 — 눌러서 열린다 */
    if(t==='map'||t==='addr') return 'map';         /* v194 — 네이버 지도 */
    if(t==='checkbox'||t==='check') return 'check';
    /* 이름으로도 알아본다 — 새 칸이 생겨도 알맞은 입력이 저절로 뜬다 */
    var nm = String(f.k||'') + ' ' + String(f.label||'');
    if(/시각|시간|Time/i.test(nm) && !/시간대|기간/.test(nm)) return 'time';
    if(/날짜|일자|Date/i.test(nm)) return 'date';
    /* v194 — 달님 : 「전화번호를 누르면 바로 전화, 주소를 누르면 네이버 지도」
          SCHEMA 를 손대지 않고 이름만으로 알아본다 (저장 값은 그대로).
          ▸ 연락처(ownerPhone) · 당사자 연락처(partyPhone) 처럼 type 이 text 인 칸도 걸린다 */
    if(/URL|링크|Link/i.test(nm)) return 'link';
    if(/전화|연락처|휴대폰|Phone|Tel(?!e)/i.test(nm) && !/메모|기록/.test(nm)) return 'tel';
    if(/주소|소재지|Address/i.test(nm) && !/링크|url/i.test(nm)) return 'map';
    return 'text';
  }
  /* select 후보값 — SCHEMA 에 opts 가 없으면 실제 데이터에서 모은다 */
  /* 층 순서 — 위에서 아래로 (앱의 FLOORS 와 같은 차례) */
  function floorSort(a, b){
    var i=FLOOR_ORDER.indexOf(String(a||'')), j=FLOOR_ORDER.indexOf(String(b||''));
    if(i<0 && j<0) return String(a)<String(b)? -1 : 1;
    if(i<0) return 1;
    if(j<0) return -1;
    return i-j;
  }
  function workOpts(kind, k, given){
    /* 앱이 이미 갖고 있는 목록을 그대로 쓴다 — 차례가 뒤죽박죽이면 안 된다 */
    try{
      if(k==='floor'){
        /* v136 — 달님 : 「영어 층은 없애. 10F 이런거 말야」
              예전 기록에 남아 있는 10F·B1F 같은 영어 표기가 목록에 딸려 나왔다.
              같은 층을 두 이름으로 고르게 되니 통계도 갈린다.
              ▸ 한글로 바꿔 보고 이미 있는 층이면 버린다
              ▸ 짝이 없는 영어 표기도 목록에는 넣지 않는다 (저장된 값은 그대로 둔다) */
        var fl = (typeof FLOORS!=='undefined' ? FLOORS : []).filter(Boolean).slice();
        var extra=[];
        (entries||[]).forEach(function(e){
          var v=e && e[k]; if(!v) return; v=String(v).trim();
          if(/^B\s*\d+\s*F$/i.test(v) || /^\d+\s*F$/i.test(v)) return;   /* 10F · B1F 등은 안 넣는다 */
          if(fl.indexOf(v)<0 && extra.indexOf(v)<0) extra.push(v);
        });
        return [''].concat(fl.concat(extra).sort(floorSort));
      }
      if(k==='status' && kind==='work' && typeof STATUSES!=='undefined' && STATUSES.length)
        return [''].concat(STATUSES.slice());
      if(k==='dir' && typeof CALLDIR!=='undefined' && CALLDIR.length)
        return [''].concat(CALLDIR.slice());
      if(k==='vtype' && typeof VTYPES!=='undefined' && VTYPES.length)
        return [''].concat(VTYPES.slice());
      if(k==='field' && typeof FIELDS!=='undefined' && FIELDS.length){
        var fd = FIELDS.filter(Boolean).slice();
        (entries||[]).forEach(function(e){
          if(e && e.kind===kind && e[k] && fd.indexOf(String(e[k]))<0) fd.push(String(e[k]));
        });
        return [''].concat(fd);
      }
      if(k==='purpose'){            /* 지출 용도 — 관리 화면에서 정한 목록 */
        try{
          var pu=JSON.parse(localStorage.getItem('wl_exp_purposes_v44')||'null');
          if(Array.isArray(pu) && pu.length) return [''].concat(pu);
        }catch(e){}
      }
      if(k==='expSubType' && kind==='expense')
        return ['','공사성','전기','수도','유선방송','전화','정수기','기타'];
      if(k==='expType' && kind==='expense')
        return ['','개인지출','세금계산서','전표','급여'];
      if(k==='refYear'){            /* v129 — 올해부터 2030년까지 (달님 요청) */
        var y = Number(String(today()).slice(0,4)) || 2026, ys=[];
        var last = Math.max(2030, y + 1);
        for(var yy=y; yy<=last; yy++) ys.push(String(yy));
        return [''].concat(ys);
      }
      if(k==='refMonth'){
        var ms=[]; for(var m=1; m<=12; m++) ms.push(String(m));
        return [''].concat(ms);
      }
    }catch(e){}
    if(Array.isArray(given) && given.length) return [''].concat(given);
    var seen={}, out=[];
    try{
      entries.forEach(function(e){
        if(e.kind!==kind) return;
        var v=e[k]; if(v==null||v==='') return;
        v=String(v); if(seen[v]) return; seen[v]=1; out.push(v);
      });
    }catch(e){}
    /* 모은 값도 보기 좋게 — 숫자면 숫자순, 아니면 가나다순 */
    out.sort(function(a,b){
      var na=parseFloat(a), nb=parseFloat(b);
      if(!isNaN(na) && !isNaN(nb) && String(na)===a && String(nb)===b) return na-nb;
      return a.localeCompare(b, 'ko');
    });
    return out.length ? [''].concat(out.slice(0,60)) : [''];
  }

  /* 업무 기록의 어느 칸이 기본 칸(날짜·내용·관련처·금액·메모)인지 */
  var BMAP = {
    work:     {_date:['date'], _title:['title'], _sub:['workVendor','owner','vendor'], _amount:['cost'], _memo:['detail']},
    expense:  {_date:['date'], _title:['title'], _sub:['vendor','payee'],            _amount:['amount'],     _memo:['memo']},
    accident: {_date:['date'], _title:['title'], _sub:['partyName','location'],      _amount:['repairCost','compensation'], _memo:['detail']},
    progress: {_date:['date'], _title:['title'], _sub:['owner'],                     _amount:['finalCost','estCost'],       _memo:['detail','memo']},
    /* v217 — 달님 : 「통화도 제목 내용 분리해서 나오게」
       제목도 내용, 메모도 내용이라 카드에 같은 글이 한 번만 나왔다.
       이제 제목은 「누구와」(이름 → 업체), 내용은 통화 내용이다. */
    call:     {_date:['date'], _title:['name','company','content'], _sub:['company'], _amount:[],             _memo:['content']},
    memo:     {_date:['date'], _title:['title','body'], _sub:[],                     _amount:[],             _memo:['body']},
    schedule: {_date:['date'], _title:['title'], _sub:[],                            _amount:[],             _memo:['memo']},
    /* v197 — 달님 : 「전달에 즉시전달·주간전달 고르는 게 없네 (구버전엔 있는데)」
          SCHEMA 에는 있었다. 그런데 _sub(관련처) 가 dtype 을 먹어 **글자 칸**으로 바뀌어
          고르는 목록이 사라졌다. _sub 를 비워 f:dtype 이 제 모습(고르기)으로 나오게 한다. */
    deliver:  {_date:['date'], _title:['title','content'], _sub:[],                 _amount:[],             _memo:['content']},
    meeting:  {_date:['date'], _title:['title'], _sub:['attendees'],                 _amount:[],             _memo:['body']},
    /* v197 — 휴가도 같은 이유로 「종류」가 글자 칸이 되어 있었다.
          f:vtype 은 「고른 값이 부르는 칸」의 스위치이기도 하다 (SWITCH.vacation). */
    vacation: {_date:['start'],_title:['name'], _sub:[],                            _amount:[],             _memo:['note']},
    item:     {_date:[],       _title:['itemName'], _sub:['vendor','maker'],         _amount:['unitPrice'],  _memo:['memo']},
    stock:    {_date:['date'], _title:['itemId'], _sub:['vendor'],                   _amount:['amount'],     _memo:['memo']},
    plan:     {_date:['date'], _title:['text'], _sub:[],                             _amount:[],             _memo:[]},
    site:     {_date:[],       _title:['name'], _sub:['category'],                   _amount:[],             _memo:['memo']},
    /* v206 — 청소. 반장(foreman)은 「관련처」로 먹지 않고 제 이름 그대로 칸에 둔다
          (v197 교훈 : _sub 가 먹으면 그 칸이 사라진 것처럼 보인다) */
    cleaning: {_date:['date'],  _title:['title'], _sub:[],                            _amount:[],             _memo:['memo']}
  };
  /* v115 — 「칸 ↔ 데이터 지도」가 읽을 수 있게 밖으로 낸다.
        화면의 칸 하나가 데이터 칸 여럿을 물고 있다는 사실이 어디에도 안 보여서
        2026-08-29 「업체를 지워도 옛 이름이 되살아나는」 사고가 났다. */
  try{ window.wlBMAP = BMAP; }catch(e){}

  /* 새로 만들 때 기본으로 넣어 둘 값 — 입력창에서 만든 것과 모양을 맞춘다 */
  var WORK_DEFAULT = {
    work:     { workMode:'simple', status:'완료', expType:'없음', cost:0, qty:0, materials:[] },
    expense:  { expType:'개인지출' },
    accident: { status:'⏳ 접수' },
    progress: { status:'검토중' },
    stock:    { stockType:'입고', qty:1 },
    schedule: { scheduleType:'일회성' },
    call:     { dir:'수신' },
    plan:     { status:'미완료', done:false },
    /* v206 — 옛 청소 창(openCleaningEditor)이 만드는 모양과 똑같이 맞춘다.
          모양이 다르면 「옛 창에서 연 것」과 「데이터 탭에서 만든 것」이 달라진다. */
    /* 🔴 함수로 둔다 — 반장·청소원 명단은 나중에 바뀔 수 있다.
          지금 값을 통째로 굳혀 두면 명단을 고쳐도 새 기록이 옛 명단으로 만들어진다. */
    cleaning: function(){
      var d = { directorOrders:[], directives:[], specials:[],
                inItems:[], outItems:[],
                tissueIn:0, tissueOut:0, towelIn:0, towelOut:0, photo:null };
      try{ d.foreman = CLEAN_FOREMAN; }catch(e){ d.foreman = ''; }
      try{
        d.staffWork = (CLEAN_STAFF||[]).map(function(x){
          return { name:x.name, floors:x.floors, tissue:0, towel:0, special:'' }; });
      }catch(e){ d.staffWork = []; }
      return d;
    }
  };
  /* v206 — 기본값이 함수면 그때 불러서 쓴다 (아니면 그대로) */
  function defaultOf(kind){
    var d = WORK_DEFAULT[kind];
    if(typeof d === 'function'){
      try{ return d() || {}; }catch(e){ console.warn('[기본값] ' + kind + ' 만들기 실패', e); return {}; }
    }
    return d || {};
  }

  function dsWork(kind){
    var meta = WORK_KINDS[kind] || {i:'📄', n:kind, c:'#64748b'};
    var fields = workFields(kind).map(function(f){
      if(f.t==='sel') f.o = workOpts(kind, f.k, f.o);
      return f;
    });
    var cm = {}; cm[kind] = { i:meta.i, n:meta.n, c:meta.c, f:fields };
    return {
      key:'work:'+kind, name:meta.n, icon:meta.i, chips:false, kind:kind,
      bmap: BMAP[kind] || {},
      cats: cm,
      all:  function(){ try{ return entries||[]; }catch(e){ return []; } },
      mine: function(e){ return e && e.kind===kind; },
      ptypeOf: function(){ return kind; },
      add:  function(o){ try{ return addRecord(o); }catch(e){ return null; } },
      upd:  function(id,o){ try{ updateRecord(id,o); }catch(e){} 
             try{ if(typeof renderAll==='function') setTimeout(renderAll,80); }catch(e){}
             return null; },
      del:  function(id){ try{ deleteRecord(id); if(typeof renderAll==='function') setTimeout(renderAll,80); }catch(e){} },
      newRec: function(){ return Object.assign({ kind:kind }, defaultOf(kind)); },
      fieldsOf: function(){ return fields; }
    };
  }
  DS_PERSONAL.cats = CAT_P;
  DS = DS_PERSONAL;

  var VWS=['card','table','list','board','cal','floor','time','gal'];
  var vw = (function(){ var v=lsGet(LS_VIEW,null); return (VWS.indexOf(v)>=0)?v:'card'; })();
  function vwSet(v){ vw=v; lsSet(LS_VIEW,v); safeRender(); }
  /* v224 — 달님 : 「여기도 줄여줘」
     보기 단추 8개가 글자까지 달고 있어 도구줄이 두 줄로 넘쳤다.
     지금 보고 있는 것만 이름을 보이고 나머지는 그림만 둔다 (마우스를 올리면 이름이 뜬다).
     🔴 단추 자체는 그대로다 — data-vw 도, 눌렀을 때 하는 일도 안 바뀐다. */
  function vwBtn(k, ico, name){
    var on = (vw === k);
    return '<button type="button" data-vw="'+k+'"'+(on?' class="on"':'')
         + ' title="'+esc(name)+'">' + ico + (on ? (' ' + esc(name)) : '') + '</button>';
  }
  function vwBtns(){
    var ptV = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    return '<div class="lf-vw">'
      + vwBtn('card','▦','카드')
      + vwBtn('table','☰','목록')
      + vwBtn('list','≣','리스트')
      + vwBtn('board','▥','보드')
      + vwBtn('cal','📅','달력')
      + (hasFloors(ptV) ? vwBtn('floor','🏢','층별') : '')
      + vwBtn('time','⏱','타임라인')
      + vwBtn('gal','📸','갤러리')
      + '</div>';
  }

  /* 한 줄 요약 — 표에서 두 번째 줄에 쓰는 짧은 설명 */
  function subOf(e){
    var p=[];
    if(isPersonal() && DS.ptypeOf(e)==='car'){ if(e.place) p.push(e.place); if(e.liter) p.push(num(e.liter)+'L'); }
    else { if(e.who) p.push(e.who); if(e.where) p.push(e.where); if(e.place) p.push(e.place); }
    var d=e.detail||e.memo||'';
    if(d) p.push(String(d).replace(/\s+/g,' ').slice(0,60));
    return p.join(' · ');
  }
  /* ── 상태 — 종류마다 정해진 「차례」와 「색」이 있다 ──────────────
     가나다순으로 늘어놓으면 검토중 다음에 견적중이 아니라 공사중이 온다.
     그래서 진짜 일 순서를 여기에 적어 둔다. */
  var STAT = {
    progress: { k:'status',
      order:['검토중','견적중','품의중','발주완료','공사중','완료','보류'],
      color:{'검토중':'#64748b','견적중':'#0891b2','품의중':'#7c3aed','발주완료':'#2563a8',
             '공사중':'#ea580c','완료':'#0f7a4a','보류':'#94a3b8'} },
    work:     { k:'status',
      order:['미완료','진행중','완료'],
      color:{'미완료':'#dc2626','진행중':'#ea580c','완료':'#0f7a4a'} },
    accident: { k:'status',
      order:['⏳ 접수','🔍 조사중','⚙ 처리중','✅ 완료','📋 종결'],
      color:{'⏳ 접수':'#dc2626','🔍 조사중':'#ea580c','⚙ 처리중':'#2563a8',
             '✅ 완료':'#0f7a4a','📋 종결':'#64748b'} },
    expense:  { k:'expType',
      order:['개인지출','세금계산서','전표','급여'],
      color:{'개인지출':'#3f7cb8','세금계산서':'#c2410c','전표':'#7c3aed','급여':'#16a34a'} },
    stock:    { k:'stockType', order:['입고','출고'],
      color:{'입고':'#0f7a4a','출고':'#c2410c'} },
    call:     { k:'dir', order:['수신','발신','부재중'],
      color:{'수신':'#0891b2','발신':'#2563a8','부재중':'#dc2626'} },
    vacation: { k:'vtype', order:[], color:{} },
    deliver:  { k:'dtype', order:[], color:{} },
    /* v217 — 반복유형이 아니라 「상태」로 묶고 색을 칠한다 */
    schedule: { k:'sStatus',
      order:['예정','진행중','완료','연기'],
      color:{'예정':'#0891b2','진행중':'#b45309','완료':'#0f7a4a','연기':'#94a3b8'} },
    item:     { k:'field',  order:[], color:{} },
    site:     { k:'category', order:[], color:{} },
    plan:     { k:'status', order:['미완료','보류','완료'],
      color:{'미완료':'#ea580c','보류':'#94a3b8','완료':'#0f7a4a'} }
  };
  /* 종류 이름이 안 넘어와도(전체 보기 등) 지금 보고 있는 데이터셋으로 알아낸다 */
  function statKind(kind){
    if(kind && STAT[kind]) return kind;
    try{ if(DS && DS.kind && STAT[DS.kind]) return DS.kind; }catch(e){}
    return kind;
  }
  function statInfo(kind){ return STAT[statKind(kind)] || null; }
  function statVal(e, kind){
    var si=statInfo(kind); if(!si) return '';
    kind=statKind(kind);
    if(kind==='plan'){
      var ps=String(e.status||'');
      if(['미완료','보류','완료'].indexOf(ps)<0) return e.done? '완료':'미완료';
      return ps;
    }
    var v=e && e[si.k];
    return (v==null)? '' : String(v);
  }
  function statRank(v, kind){
    var si=statInfo(kind); if(!si) return 0;
    kind=statKind(kind);
    var i=si.order.indexOf(String(v||''));
    return i<0 ? 900 : i;
  }
  function statColor(v, kind){
    var si=statInfo(kind); if(!si) return '#64748b';
    kind=statKind(kind);
    if(si.color && si.color[v]) return si.color[v];
    /* 정해 둔 색이 없으면 글자로 고르게 뽑는다 — 매번 같은 색이 나온다 */
    var PAL=['#2563a8','#0891b2','#7c3aed','#ea580c','#0f7a4a','#c2410c','#4f46e5','#b45309'];
    var n=0, str=String(v||'');
    for(var i=0;i<str.length;i++) n=(n*31+str.charCodeAt(i))>>>0;
    return PAL[n % PAL.length];
  }
  function statTag(e, kind){
    var v=statVal(e, kind); if(!v) return '';
    var c=statColor(v, kind);
    return '<span class="lf-tag" style="background:'+c+'1f;color:'+c+';border:1px solid '+c+'33">'
         + esc(v) + '</span>';
  }

  function tagOf(e){
    var pty2=DS.ptypeOf(e);
    if(isPersonal() && pty2==='car'){ var c=carColor(e.car);
      return '<span class="lf-tag" style="background:'+c+'1f;color:'+c+'">🚗 '+esc(e.car||'차계부')+'</span>'
        + (e.ctype? ' <span class="lf-tag" style="background:#f1f5f9;color:#475569">'+esc(e.ctype)+'</span>':''); }
    if(isPersonal() && pty2==='todo'){
      var dd=dday(e.date);
      if(e.done) return '<span class="lf-tag" style="background:#d1fae5;color:#065f46">완료</span>';
      if(dd===null) return '';
      if(dd<0)  return '<span class="lf-tag" style="background:#fee2e2;color:#991b1b">'+(-dd)+'일 지남</span>';
      if(dd===0)return '<span class="lf-tag" style="background:#fef3c7;color:#92400e">오늘</span>';
      return '<span class="lf-tag" style="background:#dbeafe;color:#1e40af">D-'+dd+'</span>';
    }
    var d2=cats()[pty2]||catEtc();
    return '<span class="lf-tag" style="background:'+d2.c+'1f;color:'+d2.c+'">'+d2.i+' '+d2.n+'</span>';
  }


  /* ══════════════════════════════════════════════════════════
     🧩 속성 엔진 — 속성을 코드가 아니라 "데이터" 로 다룬다
     · 기본 속성  : cats()[ptype].f 에서 유도  (id = 'f:필드키')
     · 공통 속성  : 날짜·분류·내용·금액·메모·첨부 (id = '_xxx')
     · 내 속성    : 사용자가 만든 것        (id = 'c:숫자')
     값은 이름이 아니라 id 로 찾는다 → 이름을 바꿔도 데이터가 안 깨진다.
     지우기는 archived:true → 되살리기가 체크 하나.
     ══════════════════════════════════════════════════════════ */
  var LS_PROPS='wl_life_props', LS_COLS='wl_life_cols';
  /* 페이지에서 끌어 옮긴 속성 순서 · 숨긴 속성 (종류별로 따로 기억) */
  var LS_PORD='wl_life_pord', LS_PHIDE='wl_life_phide';

  /* ── 타입 한 표가 모달·목록·필터를 전부 먹여살린다 ── */
  var T = {
    text:   { i:'🔤', w:'170px' },
    area:   { i:'📝', w:'220px' },
    num:    { i:'🔢', w:'110px', right:1 },
    date:   { i:'📅', w:'104px' },
    time:   { i:'🕐', w:'82px'  },
    sel:    { i:'🏷', w:'120px' },
    check:  { i:'☑',  w:'62px',  center:1 },
    tel:    { i:'📞', w:'138px' },
    map:    { i:'📍', w:'190px' },
    star:   { i:'⭐', w:'104px' },
    link:   { i:'🔗', w:'150px' },
    rate:   { i:'💱', w:'96px', right:1 },
    calc:   { i:'∑',  w:'110px', right:1, ro:1 },
    rows:   { i:'☰',  w:'150px', ro:1 },
    tag:    { i:'🏷', w:'150px', ro:1 },
    att:    { i:'📎', w:'58px',  center:1, ro:1 },
    rel:    { i:'🔗', w:'170px' },                    /* 관계 — 다른 기록·연락처와 연결 */
    formula:{ i:'\u2211', w:'120px', right:1, ro:1 },/* 수식 — 다른 칸으로 계산 */
    multi:  { i:'🏷', w:'180px' },                    /* 다중 선택 — 태그 여러 개 */
    rollup: { i:'\u03a3', w:'120px', right:1, ro:1 },/* 롤업 — 연결된 것들 합계 */
    head:   { i:'📋', w:'0', ro:1, disp:1 },          /* 구분 제목 — 값 없이 표시만 */
    desc:   { i:'💬', w:'0', ro:1, disp:1 }           /* 설명 문구 — 값 없이 표시만 */
  };
  function tinfo(t){ return T[t] || T.text; }
  /* 값 없이 화면에 표시만 하는 속성(구분 제목·설명) — 필터·열·정렬에서 뺀다 */
  function isDisp(t){ return !!(T[t] && T[t].disp); }

  /* ── 공통 속성 ── */
  var BASE = [
    { id:'_date',   name:'날짜',   type:'date',  base:1 },
    { id:'_cat',    name:'분류',   type:'tag',   base:1 },
    { id:'_title',  name:'제목',   type:'text',  base:1, w:'auto' },
    { id:'_sub',    name:'관련처', type:'text',  base:1 },   /* 업체·상대·장소 */
    { id:'_amount', name:'금액',   type:'num',   base:1 },
    { id:'_memo',   name:'내용',   type:'area',  base:1 },
    { id:'_att',    name:'첨부',   type:'att',   base:1 }
  ];
  var DEF_COLS = ['_date','_cat','_title','_sub','_amount','_att'];

  /* ── 칸 이름 바꾸기 — 공통 칸·종류 기본칸도 내 말로 고쳐 쓴다 ──
     종류마다 따로 기억한다 (업무의 '내용' 과 지출의 '내역' 을 따로 둘 수 있게) */
  var LS_PNAME='wl_life_pname';
  function pnameAll(){ var o=lsGet(LS_PNAME,null); return (o&&typeof o==='object')?o:{}; }
  function pnameOf(pt){ var o=pnameAll()[dsk(pt)]; return (o&&typeof o==='object')?o:{}; }
  function pnameSet(pt, pid, nm){
    var all=pnameAll(), m=all[dsk(pt)]||{};
    nm=String(nm==null?'':nm).trim();
    if(nm) m[pid]=nm; else delete m[pid];
    if(Object.keys(m).length) all[dsk(pt)]=m; else delete all[dsk(pt)];
    lsSet(LS_PNAME, all);
  }
  function pnameReset(pt){ var all=pnameAll(); delete all[dsk(pt)]; lsSet(LS_PNAME, all); }

  /* ── 내 속성 저장소 ── */
  function customAll(){ var o=lsGet(LS_PROPS,null); return (o&&typeof o==='object')?o:{}; }
  function dsk(pt){ return (isPersonal()? '' : (DS.key+':')) + (pt||'_all'); }
  function customOf(pt){ var a=customAll()[dsk(pt)]; return Array.isArray(a)?a:[]; }
  function customSave(pt, arr){
    var o=customAll(); o[dsk(pt)]=arr; o._at=Date.now(); lsSet(LS_PROPS,o);
    schemaPush(o);
  }
  /* ── 속성 순서 (페이지에서 끌어 옮긴 결과) ── */
  function pordOf(pt){ var o=lsGet(LS_PORD,null)||{}; var a=o[dsk(pt)]; return Array.isArray(a)?a.slice():[]; }
  function pordSave(pt, ids){ var o=lsGet(LS_PORD,null)||{}; var seen={}, cl=[];
    (ids||[]).forEach(function(x){ if(x && !seen[x]){ seen[x]=1; cl.push(x); } });  /* v81 — 중복 제거 */
    o[dsk(pt)]=cl; lsSet(LS_PORD,o); }
  /* ── 페이지에서 숨긴 속성 (기본 칸은 지울 수 없으니 숨김으로) ── */
  function phideOf(pt){ var o=lsGet(LS_PHIDE,null)||{}; var a=o[dsk(pt)]; return Array.isArray(a)?a.slice():[]; }
  function phideSave(pt, ids){ var o=lsGet(LS_PHIDE,null)||{}; o[dsk(pt)]=ids; lsSet(LS_PHIDE,o); }
  /* 속성 정의(스키마)는 기록과 같이 클라우드에 둔다 → 폰에서도 같은 칸이 보인다 */
  function schemaPush(o){
    try{ if(window.wlP && window.wlP.schemaSave) window.wlP.schemaSave(o); }catch(e){}
  }
  /* 클라우드 스키마가 더 새것이면 받아온다 */
  window.wlLifeSchemaPull = function(cloud){
    if(!cloud || typeof cloud!=='object') return false;
    var mine=customAll();
    if((cloud._at||0) <= (mine._at||0)) return false;
    lsSet(LS_PROPS, cloud);
    return true;
  };
  function customAdd(pt, p){ var a=customOf(pt); a.push(p); customSave(pt,a); }
  function customPatch(pt, id, patch){
    var a=customOf(pt);
    a.forEach(function(x){ if(x.id===id){ for(var k in patch) x[k]=patch[k]; } });
    customSave(pt,a);
  }



  /* ══════════════════════════════════════════════════════════
     🕐 시계 다이얼 — 바늘을 돌려서 시간을 맞춘다
     ══════════════════════════════════════════════════════════ */
  function tdPad(n){ return (n<10?'0':'')+n; }
  function tdParse(v){
    var m=String(v||'').match(/^(\d{1,2}):(\d{2})/);
    if(!m) return {h:9, mi:0};
    return { h:Math.min(23,parseInt(m[1],10)||0), mi:Math.min(59,parseInt(m[2],10)||0) };
  }
  function openTimeDial(initial, onPick, onCancel){
    var _picked = false;
    var st = tdParse(initial);
    var H = st.h, MI = Math.round(st.mi/5)*5; if(MI>=60){ MI=0; H=(H+1)%24; }
    var mode = 'h';                                   /* h → m */
    var R = 108, CX = 130, CY = 130;

    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9900';
    ov.innerHTML='<div class="lf-mod td-mod" style="max-width:330px;padding:18px 18px 20px">'
      + '<div class="td-head">'
      +   '<button type="button" class="td-hm" id="tdH"></button>'
      +   '<span class="td-colon">:</span>'
      +   '<button type="button" class="td-hm" id="tdM"></button>'
      +   '<div class="td-ap"><button type="button" id="tdAM">오전</button>'
      +     '<button type="button" id="tdPM">오후</button></div>'
      + '</div>'
      + '<div class="td-face" id="tdFace">'
      +   '<svg viewBox="0 0 260 260" id="tdSvg">'
      +     '<circle cx="130" cy="130" r="122" class="td-bg"/>'
      +     '<line x1="130" y1="130" x2="130" y2="30" class="td-hand" id="tdHand"/>'
      +     '<circle cx="130" cy="130" r="5" class="td-pin"/>'
      +     '<circle cx="130" cy="30" r="19" class="td-knob" id="tdKnob"/>'
      +     '<g id="tdNums"></g>'
      +   '</svg>'
      + '</div>'
      + '<div class="td-dur" id="tdDur"></div>'
      + '<div class="lf-mbtn" style="margin-top:14px">'
      +   '<button type="button" id="tdNow" class="lf-radd" style="height:42px">지금</button>'
      /* v186 — 넣어 둔 시각을 지우는 길 (달님 요청) */
      +   '<button type="button" id="tdClr" style="height:42px;padding:0 14px;margin-left:6px;'
      +     'border:1.5px dashed #e2b6b6;border-radius:10px;background:#fff;color:#b52929;'
      +     'font-size:13px;font-weight:700;cursor:pointer;font-family:inherit"'
      +     ' title="이 칸의 시각을 비웁니다">🗑 시간 지움</button>'
      +   '<div style="flex:1"></div>'
      +   '<button type="button" id="tdC" style="height:42px;padding:0 16px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">취소</button>'
      +   '<button type="button" id="tdOk" style="height:42px;padding:0 22px;border:none;border-radius:10px;background:#2563a8;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">확인</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); if(!_picked && onCancel){ try{ onCancel(); }catch(e){ console.warn('[시간칸] 취소 처리 실패', e); } } }

    var svg=document.getElementById('tdSvg'), hand=document.getElementById('tdHand'),
        knob=document.getElementById('tdKnob'), nums=document.getElementById('tdNums');

    function paint(){
      var hb=document.getElementById('tdH'), mb=document.getElementById('tdM');
      hb.textContent=tdPad(H); mb.textContent=tdPad(MI);
      hb.className='td-hm'+(mode==='h'?' on':''); mb.className='td-hm'+(mode==='m'?' on':'');
      document.getElementById('tdAM').className = H<12 ? 'on':'';
      document.getElementById('tdPM').className = H>=12? 'on':'';

      /* 숫자판 */
      var h='';
      if(mode==='h'){
        for(var i=0;i<12;i++){
          var lbl = (H<12) ? (i===0?12:i) : (i===0?12:i)+12;
          if(H>=12 && lbl===24) lbl=12;
          var real = (H<12) ? i : (i===0?12:i+12);
          if(H>=12 && i===0) real=12;
          var a=(i*30-90)*Math.PI/180;
          var x=CX+Math.cos(a)*R, y=CY+Math.sin(a)*R;
          h+='<text x="'+x.toFixed(1)+'" y="'+(y+5).toFixed(1)+'" class="td-n'+(real===H?' sel':'')+'">'
            + (H<12 ? (i===0?12:i) : (i===0?12:i)) + '</text>';
        }
      } else {
        for(var j=0;j<12;j++){
          var mv=j*5, a2=(j*30-90)*Math.PI/180;
          var x2=CX+Math.cos(a2)*R, y2=CY+Math.sin(a2)*R;
          h+='<text x="'+x2.toFixed(1)+'" y="'+(y2+5).toFixed(1)+'" class="td-n'+(mv===MI?' sel':'')+'">'
            + tdPad(mv) + '</text>';
        }
      }
      nums.innerHTML=h;

      /* 바늘 */
      var deg = (mode==='h') ? ((H%12)*30) : (MI*6);
      var ra=(deg-90)*Math.PI/180;
      var ex=CX+Math.cos(ra)*R, ey=CY+Math.sin(ra)*R;
      hand.setAttribute('x2', ex.toFixed(1)); hand.setAttribute('y2', ey.toFixed(1));
      knob.setAttribute('cx', ex.toFixed(1)); knob.setAttribute('cy', ey.toFixed(1));
    }

    function fromPoint(clientX, clientY){
      var r=svg.getBoundingClientRect();
      var x=(clientX-r.left)/r.width*260 - CX;
      var y=(clientY-r.top)/r.height*260 - CY;
      var deg=Math.atan2(y,x)*180/Math.PI + 90;
      while(deg<0) deg+=360; while(deg>=360) deg-=360;
      if(mode==='h'){
        var idx=Math.round(deg/30)%12;                 /* 0~11 */
        var pm = H>=12;
        H = pm ? (idx===0?12:idx+12) : idx;
        if(pm && idx===0) H=12;
        if(!pm && idx===0) H=0;
      } else {
        MI = (Math.round(deg/30)%12)*5;                /* 5분 단위 */
      }
      paint();
    }
    var dragging=false;
    function down(e){ dragging=true; var t=e.touches?e.touches[0]:e; fromPoint(t.clientX,t.clientY); e.preventDefault(); }
    function move(e){ if(!dragging) return; var t=e.touches?e.touches[0]:e; fromPoint(t.clientX,t.clientY); e.preventDefault(); }
    function up(){ if(!dragging) return; dragging=false;
      if(mode==='h'){ mode='m'; paint(); } }
    svg.addEventListener('mousedown',down); svg.addEventListener('touchstart',down,{passive:false});
    window.addEventListener('mousemove',move); svg.addEventListener('touchmove',move,{passive:false});
    window.addEventListener('mouseup',up);     svg.addEventListener('touchend',up);

    document.getElementById('tdH').addEventListener('click', function(){ mode='h'; paint(); });
    document.getElementById('tdM').addEventListener('click', function(){ mode='m'; paint(); });
    document.getElementById('tdAM').addEventListener('click', function(){ if(H>=12) H-=12; paint(); });
    document.getElementById('tdPM').addEventListener('click', function(){ if(H<12) H+=12; paint(); });
    document.getElementById('tdNow').addEventListener('click', function(){
      var d = (typeof kstNow==='function') ? kstNow() : new Date(Date.now()+9*3600000);
      /* v178 — kstNow() 는 UTC 게터로 읽어야 한국 시각이다 (지역 게터면 +9시간 어긋남) */
      H=d.getUTCHours(); MI=Math.round(d.getUTCMinutes()/5)*5; if(MI>=60){MI=0;H=(H+1)%24;} paint(); });

    /* ── 분 단위 · ± · 소요 시간 (v105) ── */
    var STEP = 10;          /* 분 단위 — 5·10·15·30 */
    var DUR  = 0;           /* 소요 시간(분) — 0 이면 끝난 시각 안 채움 */
    function shift(min){
      var t = H*60 + MI + min;
      t = ((t % 1440) + 1440) % 1440;
      H = Math.floor(t/60); MI = t%60;
      paint(); drawStep();
    }
    function endOf(){
      if(!DUR) return '';
      var t = (H*60 + MI + DUR) % 1440;
      return tdPad(Math.floor(t/60)) + ':' + tdPad(t%60);
    }
    function durLabel(m){
      if(!m) return '안 넣음';
      var h = Math.floor(m/60), mm = m%60;
      return (h ? h + '시간' : '') + (mm ? (h?' ':'') + mm + '분' : '');
    }
    function drawDur(){
      var el = document.getElementById('tdDur'); if(!el) return;
      var DL = [['안 넣음',0]];   /* v183 — 30분~4시간 단추는 없앴다 (달님 요청) */
      el.innerHTML =
        '<div class="td-dlbl">얼마나 걸렸나요? <span class="td-dhint">끝난 시각이 저절로 채워집니다</span></div>'
        /* v186 — 한 줄에 다섯 칸 균등. 줄바꿈되어 들쑥날쑥하던 것을 바로잡았다 */
        + '<div class="td-drow" style="flex-wrap:nowrap;gap:4px;margin-bottom:7px;width:100%">'
        +   DL.map(function(d){
              return '<button type="button" class="td-d'+(d[1]===DUR?' on':'')+'" data-tdd="'+d[1]+'"'
                   + ' style="flex:1;min-width:0;padding:0 2px;font-size:11.5px;'
                   + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+d[0]+'</button>';
            }).join('')
        +   [5,10,15,30].map(function(n){
              return '<button type="button" class="td-d'+(n===STEP&&DUR?' on':'')+'" data-tdadd="'+n+'"'
                   + ' style="flex:1;min-width:0;padding:0 2px;font-size:11.5px;'
                   + 'white-space:nowrap">＋'+n+'</button>';
            }).join('')
        + '</div>'
        /* 결과 줄 — 양옆에 −/＋ 를 두어 가운데 글씨와 균형을 맞춘다 */
        + '<div class="td-srow" style="flex-wrap:nowrap;gap:8px;justify-content:space-between;width:100%">'
        +   '<button type="button" class="td-pm" data-tdm="-1" title="방금 누른 단위만큼 줄이기">−</button>'
        +   '<div class="td-res" style="flex:1;margin-top:0">' + (DUR
              ? '<b>' + durLabel(DUR) + '</b> 걸림 · 끝 <b>' + endOf() + '</b>'
              : '끝난 시각은 넣지 않습니다') + '</div>'
        +   '<button type="button" class="td-pm" data-tdm="1" title="방금 누른 단위만큼 늘리기">＋</button>'
        + '</div>';
      el.querySelectorAll('[data-tdd]').forEach(function(b){
        b.addEventListener('click', function(){ DUR = +b.getAttribute('data-tdd'); drawDur(); });
      });
      /* v183 — 5·10·15·30분은 「단위 고르기」가 아니라 「누를수록 쌓이는」 단추다.
         방금 누른 값이 ＋/− 단추가 움직일 폭도 함께 정한다. */
      el.querySelectorAll('[data-tdadd]').forEach(function(b){
        b.addEventListener('click', function(){
          var n = +b.getAttribute('data-tdadd');
          STEP = n;
          DUR = Math.max(0, Math.min(24*60-5, DUR + n));
          drawDur();
        });
      });
      el.querySelectorAll('[data-tdm]').forEach(function(b){
        b.addEventListener('click', function(){
          DUR = Math.max(0, Math.min(24*60-5, DUR + STEP * (+b.getAttribute('data-tdm'))));
          drawDur();
        });
      });
    }
    drawDur();
    var _paint0 = paint;
    paint = function(){ _paint0(); try{ drawDur(); }catch(e){} };

    document.getElementById('tdC').addEventListener('click', cl);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    /* Esc 로도 닫히게 — 안 그러면 갇힌다 */
    (function(){
      function onEsc(ev){ if(ev.key==='Escape'){ ev.stopPropagation(); cl(); } }
      document.addEventListener('keydown', onEsc, true);
      var _cl0 = cl;
      cl = function(){ document.removeEventListener('keydown', onEsc, true); _cl0(); };
    })();
    /* v186 — 지움: 시각도 끝난 시각도 넣지 않는다 */
    document.getElementById('tdClr').addEventListener('click', function(){
      _picked = true; cl();
      try{ if(onPick) onPick('', ''); }
      catch(e){ console.warn('[시간칸] 지우기 실패', e); }
    });
    document.getElementById('tdOk').addEventListener('click', function(){
      var val = tdPad(H)+':'+tdPad(MI);
      var ev  = endOf();
      _picked = true; cl(); if(onPick) onPick(val, ev);
    });
    paint();
  }
  window.wlTimeDial = openTimeDial;

  /* 시간칸을 다이얼로 연결 */
  function bindDial(root){
    if(!root) return;
    root.querySelectorAll('[data-tdial]').forEach(function(el){
      if(el._dialBound) return; el._dialBound=true;
      var open=function(){
        var tgt=document.getElementById(el.getAttribute('data-tdial'));
        if(!tgt) return;
        /* ★ 다이얼이 뜨면 입력칸이 blur 되어 「빈 값으로 저장하고 닫기」가 먼저 일어난다.
              그러면 다이얼에서 고른 값이 갈 곳을 잃는다 → 여는 동안 저장을 막는다 */
        tgt._dialOpen = 1;
        /* ★ v112 근본 수정 — 시간칸은 readonly 라서 focus() 가 안 먹는다.
              그래서 focus→blur 로 저장하던 예전 방식은 blur 가 아예 안 나가
              「확인」을 눌러도 값이 사라졌다. (2026-08-29 실측: focus 0회 / blur 0회)
              → 편집기 쪽에서 넘겨준 저장 함수(_dialDone)를 직접 부른다. */
        var finish = function(){
          tgt._dialOpen = 0;
          if(typeof tgt._dialDone === 'function'){
            try{ tgt._dialDone(); return; }
            catch(e){ console.warn('[시각] 저장 함수 실패 — 예전 방식으로', e); }
          }
          try{ tgt.focus(); tgt.blur(); }catch(e){}
        };
        openTimeDial(tgt.value, function(v, endV){
          tgt.value=v;
          tgt._dialOpen = 0;
          tgt.dispatchEvent(new Event('input',{bubbles:true}));
          tgt.dispatchEvent(new Event('change',{bubbles:true}));
          /* 소요 시간을 골랐으면 「끝난 시각」 칸도 함께 채운다 (v105) */
          if(endV){
            try{
              var box = tgt.closest('.lf-page,.pg-body,#mFields,#overlay,tr,form') || document;
              var et = box.querySelector('[data-prow="f:endTime"] .lf-ie,[data-ppid="f:endTime"] .lf-ie,[data-pid="f:endTime"] .lf-ie')
                    || document.querySelector('[data-prow="f:endTime"] .lf-ie')
                    || document.getElementById('m-workEnd')
                    || document.getElementById('m-endTime');
              if(et && et !== tgt){
                et.value = endV;
                et.dispatchEvent(new Event('input',{bubbles:true}));
                et.dispatchEvent(new Event('change',{bubbles:true}));
                if(typeof toast==='function') toast('끝난 시각도 ' + endV + ' 로 넣었어요');
              }else{
                /* v108: 그 칸이 편집 상태가 아니면 입력칸 자체가 없다 → 데이터에 바로 쓴다 */
                var rid = '';
                try{
                  var mm = String(location.hash || '').match(/^#lp=([^&]+)/);
                  if(mm) rid = decodeURIComponent(mm[1]);
                }catch(e){}
                if(rid && typeof updateRecord === 'function'){
                  try{
                    updateRecord(rid, { endTime: endV });
                    if(typeof toast === 'function') toast('끝난 시각 ' + endV + ' 로 저장했어요');
                    setTimeout(function(){
                      try{ if(typeof window.wlGoPage === 'function') window.wlGoPage(rid, true); }catch(e){}
                    }, 150);
                  }catch(e){
                    console.warn('[시각] 끝난 시각 저장 실패', e);
                    if(typeof toast === 'function') toast('끝난 시각을 저장하지 못했어요');
                  }
                }else{
                  window.__wlPendEnd = endV;
                  if(typeof toast === 'function') toast('끝난 시각 ' + endV + ' — 넣을 곳을 찾지 못했어요');
                }
              }
            }catch(e){ console.warn('[시각] 끝난 시각 넣기 실패', e); }
          }
          finish();
        }, finish);
      };
      el.addEventListener('click', open);
    });
  }

  /* ══════════════════════════════════════════════════════════
     🔢 숫자 칸 — 글자 못 넣고, 세 자리마다 쉼표
     ══════════════════════════════════════════════════════════ */
  function numFmt(v){
    if(v===''||v==null) return '';
    var s=String(v).replace(/[^0-9.\-]/g,'');
    if(s===''||s==='-') return s;
    var neg = s.charAt(0)==='-';
    s = s.replace(/-/g,'');
    var p = s.split('.');
    var i = p[0].replace(/^0+(?=\d)/,'');
    i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg?'-':'') + i + (p.length>1 ? '.'+p[1].slice(0,4) : '');
  }
  function numRaw(v){ return String(v==null?'':v).replace(/,/g,''); }
  /* 숫자칸에 쉼표를 살아있게 붙인다 */
  function bindNum(el){
    if(!el || el._numBound) return; el._numBound=true;
    el.setAttribute('inputmode','decimal');
    el.addEventListener('keydown', function(e){
      if(e.ctrlKey||e.metaKey||e.altKey) return;
      if(e.key.length>1) return;                                  /* 방향키·백스페이스 등 */
      if(/[0-9]/.test(e.key)) return;
      if(e.key==='.' && el.value.indexOf('.')<0) return;
      if(e.key==='-' && el.selectionStart===0 && el.value.indexOf('-')<0) return;
      e.preventDefault();                                          /* 글자는 아예 막는다 */
    });
    el.addEventListener('input', function(){
      var pos = el.selectionStart, before = el.value.length;
      el.value = numFmt(el.value);
      var after = el.value.length;
      try{ el.setSelectionRange(Math.max(0,pos + (after-before)), Math.max(0,pos + (after-before))); }catch(e){}
    });
    el.addEventListener('paste', function(e){
      e.preventDefault();
      var t=(e.clipboardData||window.clipboardData).getData('text')||'';
      el.value = numFmt(t); el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    if(el.value) el.value = numFmt(el.value);
  }
  function bindNumsIn(root){
    if(!root) return;
    root.querySelectorAll('[data-num="1"]').forEach(bindNum);
  }

  /* ══════════════════════════════════════════════════════════
     🔎 연산자 표 — 타입 하나당 쓸 수 있는 조건
     ══════════════════════════════════════════════════════════ */
  var OPS = {
    '포함':     function(v,x){ return String(v==null?'':v).toLowerCase().indexOf(String(x||'').toLowerCase())>=0; },
    '미포함':   function(v,x){ return String(v==null?'':v).toLowerCase().indexOf(String(x||'').toLowerCase())<0; },
    '같음':     function(v,x){ return String(v==null?'':v)===String(x==null?'':x); },
    '아님':     function(v,x){ return String(v==null?'':v)!==String(x==null?'':x); },
    '비어있음': function(v){ return v===''||v==null||(Array.isArray(v)&&!v.length); },
    '있음':     function(v){ return !(v===''||v==null||(Array.isArray(v)&&!v.length)); },
    '=':        function(v,x){ return num(v)===num(x); },
    '>':        function(v,x){ return num(v)>num(x); },
    '<':        function(v,x){ return num(v)<num(x); },
    '이상':     function(v,x){ return num(v)>=num(x); },
    '이하':     function(v,x){ return num(v)<=num(x); },
    '이전':     function(v,x){ return String(v||'') && String(v)<String(x||''); },
    '이후':     function(v,x){ return String(v||'') && String(v)>String(x||''); },
    '체크됨':   function(v){ return v===true||v==='true'; },
    '안됨':     function(v){ return !(v===true||v==='true'); }
  };
  var TYPE_OPS = {
    text:   ['포함','미포함','같음','비어있음','있음'],
    area:   ['포함','미포함','비어있음','있음'],
    num:    ['=','>','<','이상','이하','비어있음','있음'],
    rate:   ['=','>','<','이상','이하'],
    formula:['=','>','<','이상','이하'],
    date:   ['같음','이전','이후','비어있음','있음'],
    time:   ['같음','이전','이후','비어있음'],
    sel:    ['같음','아님','비어있음','있음'],
    check:  ['체크됨','안됨'],
    tel:    ['포함','비어있음','있음'],
    map:    ['포함','비어있음','있음'],
    link:   ['포함','비어있음','있음'],
    star:   ['=','이상','이하','비어있음'],
    tag:    ['같음','아님'],
    att:    ['=','>','비어있음','있음'],
    rel:    ['포함','비어있음','있음'],
    multi:  ['포함','미포함','비어있음','있음'],
    rollup: ['=','>','<','이상','이하'],
    rows:   ['비어있음','있음']
  };
  function opsOf(t){ return TYPE_OPS[t] || TYPE_OPS.text; }
  function opNeedsVal(op){ return ['비어있음','있음','체크됨','안됨'].indexOf(op)<0; }

  /* ══════════════════════════════════════════════════════════
     ∑ 수식 — {속성이름} 으로 다른 칸을 가져다 계산
        예)  {단가} * {개수}        {최종 금액} - {초기 견적비}
             DAYS({도착일}, {출발일})
     ══════════════════════════════════════════════════════════ */
  function formulaCalc(e, expr, pt){
    if(!expr) return '';
    try{
      var list = propsOf(pt);
      var src = String(expr);
      /* {이름} → 값으로 치환 */
      src = src.replace(/\{([^}]+)\}/g, function(_, nm){
        nm = nm.trim();
        var hit = null;
        list.forEach(function(p){ if(!hit && (p.name===nm || p.id===nm)) hit=p; });
        if(!hit) return '0';
        if(hit.type==='formula') return '0';                 /* 수식끼리 물리는 것 방지 */
        if(hit.type==='rollup'){                              /* 합계 칸도 수식에서 쓸 수 있게 */
          var rv=num(rollupCalc(e, hit, pt));
          return isNaN(rv)? '0' : String(rv);
        }
        var v = pget(e, hit.id);
        if(hit.type==='date'||hit.type==='time') return '"'+String(v||'')+'"';
        var n = num(v);
        return isNaN(n)? '0' : String(n);
      });
      /* 날짜 차이 */
      src = src.replace(/DAYS\(\s*("(?:[^"]*)")\s*,\s*("(?:[^"]*)")\s*\)/g, function(_,a,b){
        var d1=Date.parse(a.slice(1,-1)+'T00:00:00'), d2=Date.parse(b.slice(1,-1)+'T00:00:00');
        if(isNaN(d1)||isNaN(d2)) return '0';
        return String(Math.round((d1-d2)/86400000));
      });
      /* 허용된 글자만 — 안전장치 */
      if(!/^[\s0-9+\-*/().,]*$/.test(src)) return '';
      if(!src.trim()) return '';
      var r = Function('"use strict";return ('+src+')')();
      if(typeof r!=='number' || !isFinite(r)) return '';
      return Math.round(r*10000)/10000;
    }catch(err){ return ''; }
  }

  /* ══════ Σ 롤업 — 연결된 기록들을 모아 계산 ══════
     p = { relPid: 관계칸id, tgtPid: 그쪽 칸id, agg:'sum|count|avg|max|min', dir:'fwd|rev' } */
  function rollupCalc(e, p, pt){
    try{
      var agg=p.agg||'sum', rows=[];
      if((p.dir||'fwd')==='rev'){
        /* 나를 가리키는 기록들 — 개인·업무 어느 쪽이든 */
        var rsrc = p.revSrc||'', rpid = p.relPid||'';
        var isF  = rpid.slice(0,2)==='f:', fk = isF ? rpid.slice(2) : '';
        rows = allRecs().filter(function(x){
          if(!x) return false;
          if(rsrc && rsrc!=='personal' && x.kind!==rsrc) return false;
          if(rsrc==='personal' && x.kind!=='personal') return false;
          var v = isF ? x[fk] : (x.props||{})[rpid];
          return relArr(v).indexOf(e.id)>=0;
        });
      } else {
        var ids = relArr(pget(e, p.relPid));
        rows = ids.map(function(id){ return anyRec(id); }).filter(Boolean);
      }
      /* 조건 — 이 값일 때만 센다 */
      if(p.wPid && p.wVal!=null && p.wVal!==''){
        rows = rows.filter(function(r){
          return asRec(r, function(){
            var rv = pget(r, p.wPid);
            if(Array.isArray(rv)) return rv.indexOf(p.wVal)>=0;
            if(typeof rv==='boolean') return rv === (String(p.wVal)==='true'||String(p.wVal)==='O'||String(p.wVal)==='체크');
            return String(rv==null?'':rv) === String(p.wVal);
          });
        });
      }
      if(agg==='count') return rows.length;
      if(agg==='list')  return rows.map(function(r){ return r.id; });
      if(!rows.length) return '';
      var tp = p.tgtPid || '_amount';
      var vals = rows.map(function(r){
        return asRec(r, function(){
          var rp = DS.ptypeOf(r)||'';
          var q = propById(rp, tp);
          if(q && q.type==='formula') return num(formulaCalc(r, q.expr, rp));
          return num(pget(r, tp));
        });
      }).filter(function(n){ return !isNaN(n); });
      if(!vals.length) return '';
      if(agg==='sum') return vals.reduce(function(a,b){return a+b;},0);
      if(agg==='avg') return Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length*100)/100;
      if(agg==='max') return Math.max.apply(null, vals);
      if(agg==='min') return Math.min.apply(null, vals);
      return '';
    }catch(err){ return ''; }
  }

  /* ══════ 🎨 색상 규칙 — 조건에 맞으면 색을 입힌다 ══════ */
  var LS_RULESC='wl_life_colors';
  var COLORS = [
    {k:'red',    n:'빨강', bg:'#fee2e2', fg:'#991b1b'},
    {k:'orange', n:'주황', bg:'#ffedd5', fg:'#9a3412'},
    {k:'yellow', n:'노랑', bg:'#fef3c7', fg:'#92400e'},
    {k:'green',  n:'초록', bg:'#dcfce7', fg:'#166534'},
    {k:'blue',   n:'파랑', bg:'#dbeafe', fg:'#1e40af'},
    {k:'purple', n:'보라', bg:'#ede9fe', fg:'#5b21b6'},
    {k:'pink',   n:'분홍', bg:'#fce7f3', fg:'#9d174d'},
    {k:'gray',   n:'회색', bg:'#f1f5f9', fg:'#475569'}
  ];
  function colorOf(k){ for(var i=0;i<COLORS.length;i++) if(COLORS[i].k===k) return COLORS[i]; return COLORS[7]; }
  function colorRulesAll(){ var o=lsGet(LS_RULESC,null); return (o&&typeof o==='object')?o:{}; }
  function colorRules(pt){ var a=colorRulesAll()[dsk(pt)]; return Array.isArray(a)?a:[]; }
  function colorRulesSave(pt, a){ var o=colorRulesAll(); o[dsk(pt)]=a; lsSet(LS_RULESC,o); }
  /* 이 기록에 맞는 규칙 찾기 */
  function colorHit(e, pt){
    var rs = colorRules(null).concat(pt? colorRules(pt) : []);
    for(var i=0;i<rs.length;i++){
      var r=rs[i];
      try{ if(ruleCheck(e, r, pt)) return r; }catch(x){}
    }
    return null;
  }



  /* ── 어떤 종류의 속성 목록 ── */
  /* ── 기본 칸 종류 바꾸기 (v104) ─────────────────────────
     기본 칸의 종류는 코드에서 오므로, 바꾼 값을 따로 적어두고 읽을 때 덮어씌운다.
     계산·정렬에 쓰이는 칸은 바꾸면 계산이 깨지므로 잠가 둔다. */
  var LS_FTYPE = 'wl_ftype';
  /* 바꾸면 안 되는 칸 — 금액 계산 · 달력 · 정렬 · 소요시간이 이 칸을 쓴다 */
  var FTYPE_LOCK = {
    date:1, amount:1, qty:1, unitPrice:1, cost:1, price:1,
    startTime:1, endTime:1, start:1, end:1,
    supplyAmt:1, taxAmt:1, estCost:1, finalCost:1, repairCost:1
  };
  function ftypeLocked(pid){
    if(pid.slice(0,2) !== 'f:') return true;          /* 공통칸(_date·_title…)은 잠금 */
    return !!FTYPE_LOCK[pid.slice(2)];
  }
  function ftypeAll(){
    try{ var o = JSON.parse(localStorage.getItem(LS_FTYPE) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch(e){ console.warn('[칸 종류] 읽기 실패', e); return {}; }
  }
  function ftypeOf(pt, pid){ var m = ftypeAll()[dsk(pt)]; return (m && m[pid]) || ''; }
  function ftypeSet(pt, pid, ty){
    try{
      var o = ftypeAll(); var k = dsk(pt);
      if(!o[k]) o[k] = {};
      if(ty) o[k][pid] = ty; else delete o[k][pid];
      localStorage.setItem(LS_FTYPE, JSON.stringify(o));
    }catch(e){ console.warn('[칸 종류] 저장 실패', e); }
  }
  window.wlFieldTypeReset = function(){
    try{ localStorage.removeItem(LS_FTYPE); }catch(e){}
    return '기본 칸 종류를 원래대로 되돌렸습니다 — 화면을 새로고침하세요';
  };

  function propsOf(pt){
    var out, def = null, bmp = null;
    if(isPersonal()){
      out = BASE.slice();
      def = (pt && pt!=='car') ? (cats()[pt] && cats()[pt].f) : null;
      if(pt==='car') def = carFields('주유').concat(CARF['정비']);
    } else {
      /* 업무일지 — 그 종류에 실제로 있는 기본칸만 남긴다 */
      bmp = (DS.bmap||{});
      out = BASE.filter(function(p){
        if(p.id==='_cat') return false;
        if(p.id==='_att') return true;
        return ((bmp[p.id]||[]).length > 0);
      });
      def = DS.fieldsOf(pt);
    }
    if(def){
      var seen={};
      if(bmp){ for(var mk in bmp) (bmp[mk]||[]).forEach(function(n){ seen[n]=1; }); }
      def.forEach(function(f, fi){
        /* v259 — 달님 : 「예전 입력창처럼 구역 제목(⛽ 주유 내역 · 📍 주유소 정보)이 눈에 띄게」
           개인 서식의 구역 표시 {s:'…'} 를 제목 줄(head)로 페이지에도 낸다. 값이 없는 표시용 줄이라 저장과 무관. */
        if(f.s && !bmp){ out.push({ id:'s:'+fi, name:String(f.s), type:'head', from:'기본' }); return; }
        if(f.s || !f.k) return;
        if(seen[f.k]) return; seen[f.k]=1;
        if(!bmp && (f.k==='date'||f.k==='title'||f.k==='detail'||f.k==='amount')) return;  /* 공통과 겹침 */
        var ty = (f.t==='number'?'num':(f.t||'text'));
        /* 이름이 시간·날짜면 알맞은 입력으로 — 개인일지 칸도 함께 */
        if(ty==='text'){
          var nm2 = String(f.k||'')+' '+String(f.l||'');
          if(/시각|시간|Time/i.test(nm2) && !/시간대|기간/.test(nm2)) ty='time';
          else if(/날짜|일자|Date/i.test(nm2)) ty='date';
        }
        var _ov = ftypeOf(pt, 'f:'+f.k);          /* 달님이 바꾼 종류가 있으면 그것으로 */
        if(_ov) ty = _ov;
        out.push({ id:'f:'+f.k, name:f.l, type:ty,
                   opts:f.o, k:f.k, from:'기본' });
      });
    }
    /* 공통 + 그 종류의 내 속성 */
    customOf(null).concat(pt?customOf(pt):[]).forEach(function(p){
      if(p.archived) return; out.push(p);
    });
    /* '관련처' 는 종류마다 부르는 말이 다르다 — 기본 이름을 알맞게 바꾼다 */
    try{
      if(!isPersonal()){
        /* v113 — 업무·지출의 금액은 자재·항목을 더한 값이므로 「합계」가 맞다 */
        var AMTN = { work:'합계', expense:'합계', stock:'합계' };
        var an = AMTN[DS.kind];
        if(an) out = out.map(function(p){
          return (p.id==='_amount' && p.name==='금액') ? Object.assign({}, p, {name:an}) : p; });
        var SUBN = { work:'업체', expense:'업체', item:'업체', stock:'거래처',
                     progress:'담당 업체', accident:'당사자', call:'상대',
                     deliver:'대상', meeting:'참석자', schedule:'관련처', memo:'관련처' };
        var sn = SUBN[DS.kind];
        if(sn) out = out.map(function(p){
          return (p.id==='_sub' && p.name==='관련처') ? Object.assign({}, p, {name:sn}) : p; });
      }
    }catch(e){ console.warn('[관련처 이름]', e); }
    /* 내가 바꿔 놓은 이름이 있으면 그것으로 */
    try{
      var nmm = pnameOf(pt);
      if(Object.keys(nmm).length) out = out.map(function(p){
        return nmm[p.id] ? Object.assign({}, p, {name:nmm[p.id], _renamed:1}) : p; });
    }catch(e){}
    /* 페이지에서 끌어 옮긴 순서가 있으면 그대로 따른다 (없으면 지금까지 순서 그대로) */
    /* 시각 칸은 날짜 바로 뒤에 두는 게 읽기 편하다.
       단, 직접 순서를 정해 둔 적이 있으면 그쪽을 존중한다 */
    try{
      if(!pordOf(pt).length){
        var tms = out.filter(function(p){ return p.type==='time'; });
        if(tms.length){
          var rest = out.filter(function(p){ return p.type!=='time'; });
          var di = -1;
          for(var q=0;q<rest.length;q++){ if(rest[q].id==='_date' || rest[q].type==='date'){ di=q; break; } }
          out = (di<0) ? tms.concat(rest)
                       : rest.slice(0,di+1).concat(tms, rest.slice(di+1));
        }
      }
    }catch(e){ console.warn('[시각 칸 위로]', e); }
    /* ★ v113 — 상태·해당층·분야는 「어디서 무슨 일이 있었나」를 한눈에 알려주는
          기본 성격이라 위쪽에 있어야 한다. 예전엔 내용(_memo) 밑으로 밀려 있었다.
          직접 차례를 정해 둔 적이 있으면 손대지 않는다. */
    try{
      var ord = pordOf(pt);
      if(ord.length){
        var pos={}; ord.forEach(function(pid,i){ pos[pid]=i; });
        out = out.map(function(p,i){ return {p:p, r:(pos[p.id]==null ? 1000000+i : pos[p.id])}; })
                 .sort(function(a,b){ return a.r-b.r; })
                 .map(function(x){ return x.p; });
      }
    }catch(e){}
    /* ★ v116 — 앞자리 차례는 「맨 마지막에」 정한다.
          예전에는 이 정리를 저장된 차례보다 먼저 해서, 뒤에 오는 정렬이 다시 흩어 놓았다.
          그래서 「해당층·분야를 위로」가 계속 안 먹었다. (달님 신고 3회)

          달님이 정한 자리 :
            날짜 · 대상년도 · 대상월 · 해당층 · 분야 · 상태 …  (언제 · 어디서 · 무엇)
            지출종류 · 합계                                   (돈은 돈끼리)
            시작 시각 · 끝난 시각 · 업체                        (그다음) */
    try{
      var FRONT = ['_date','f:refYear','f:refMonth','f:floor','f:field',
                   'f:status',
                   '_memo',                                   /* v133 — 「내용」은 기본 바로 밑 */
                   'f:accType','f:stockType','f:dir','f:vtype',
                   'f:expType','f:expSubType','f:purpose',
                   'f:supplyAmt','f:taxAmt','_amount','f:isIssued',
                   'f:material','f:spec','f:qty','f:matCost',   /* v135 — 자재는 한 덩어리로 */
                   'f:startTime','f:endTime','_sub'];
      var fr = [], rest3 = [];
      out.forEach(function(p){ (FRONT.indexOf(p.id) >= 0 ? fr : rest3).push(p); });
      if(fr.length){
        fr.sort(function(a,b){ return FRONT.indexOf(a.id) - FRONT.indexOf(b.id); });
        out = fr.concat(rest3);
      }
    }catch(e){ console.warn('[앞자리 차례]', e); }
    /* v133 — 달님 : 「견적 메모는 없애」
          화면에서만 뺀다. 예전에 적어 둔 값은 데이터에 그대로 남는다. */
    try{ out = out.filter(function(p){ return p.id !== 'f:estimateMemo'; }); }
    catch(e){ console.warn('[견적 메모 빼기]', e); }
    return out;
  }
  function propById(pt, id){
    var a=propsOf(pt); for(var i=0;i<a.length;i++) if(a[i].id===id) return a[i];
    return null;
  }

  /* ── 값 읽기 / 쓰기 (id 기준) ── */
  function bmf(pid){ try{ return (DS && DS.bmap && DS.bmap[pid]) || null; }catch(e){ return null; } }

  /* ══ v207 — 🔄 입출고 제목이 암호처럼 나오던 것 【근본 수정】 ══
        달님 : 「입출고 제목이 이상해. 카드형으로는 정상으로 나와」

        BMAP.stock 의 _title 은 `itemId` 다. 품목 기록을 가리키는 열쇠라
        그대로 내보내면 `Nyn5Ra1zfAv3u8ElENDN` 같은 글자가 제목으로 나온다.
        v196 에서 **카드 그리는 곳에만** 이름 찾기를 넣었더니
        표·목록·리스트·보드·달력·타임라인·갤러리에서는 여전히 id 가 나왔다.
        → 이제 **값이 나가는 문(pget)** 에서 한 번에 바꾼다. 그리는 곳은 손댈 필요가 없다.
        덤 : 검색·정렬도 품목 이름으로 된다 (예전에는 id 로 찾아야 했다). */
  var _itmMap = null, _itmAt = 0;
  function itemNameOf(id){
    if(!id) return '';
    var now = Date.now();
    if(!_itmMap || (now - _itmAt) > 3000){          /* 3초마다 한 번만 다시 만든다 */
      _itmMap = {}; _itmAt = now;
      try{
        (ent() || []).forEach(function(x){
          if(x && x.kind === 'item' && x.id) _itmMap[x.id] = String(x.itemName || '').trim();
        });
      }catch(e){ console.warn('[품목 이름] 표 만들기 실패', e); }
    }
    return _itmMap[id] || '';
  }
  function titleFix(e, v){
    try{
      if(!e || e.kind !== 'stock') return v;
      var nm = String(e.itemName || '').trim() || itemNameOf(e.itemId);
      if(nm) return nm;
      /* 이름을 못 찾았는데 제목 자리에 열쇠(itemId)가 그대로 들어 있으면 암호처럼 보인다 */
      if(v && e.itemId && String(v) === String(e.itemId)) return '(품목 없음)';
      if(v && /^[A-Za-z0-9_-]{16,}$/.test(String(v)))     return '(품목 없음)';
    }catch(x){ console.warn('[제목] 품목 이름 찾기 실패', x); }
    return v;
  }
  try{ window.wlRecTitle = function(e){ return titleFix(e, pget(e, '_title')); }; }catch(e){}

  function pget(e, pid){
    if(!e) return '';
    if(!isPersonal()){
      if(pid==='_cat') return DS.kind || '';
      if(pid==='_att') return esr(e.photos).length + esr(e.scanRefs).length;
      if(pid.slice(0,2)==='f:') return e[pid.slice(2)];
      var bf = bmf(pid);
      if(bf){
        for(var bi=0; bi<bf.length; bi++){
          var bv = e[bf[bi]];
          if(bv!=null && bv!==''){
            if(pid==='_amount') return num(bv);
            return (pid==='_title') ? titleFix(e, bv) : bv;   /* v207 */
          }
        }
        return (pid==='_amount') ? 0 : (pid==='_title' ? titleFix(e, '') : '');
      }
      if(['_date','_title','_sub','_memo'].indexOf(pid)>=0) return '';
      if(pid==='_amount') return 0;
      return (e.props||{})[pid];
    }
    if(pid==='_date')   return e.date||'';
    if(pid==='_title')  return e.title||e.who||'';
    if(pid==='_memo')   return e.detail||e.memo||'';
    if(pid==='_sub')    return e.who||e.where||e.place||'';
    if(pid==='_amount') return money(e);
    if(pid==='_cat')    return e.ptype||'';
    if(pid==='_att')    return esr(e.photos).length + esr(e.scanRefs).length;
    if(pid.slice(0,2)==='f:') return e[pid.slice(2)];
    return (e.props||{})[pid];
  }
  function ppatch(e, pid, v){
    if(!isPersonal()){
      if(pid.slice(0,2)==='f:'){ var fo={}; fo[pid.slice(2)]=v; return fo; }
      var bf2 = bmf(pid);
      if(bf2 && bf2.length){
        var bo={}; bo[bf2[0]] = (pid==='_amount') ? (v===''?'':num(v)) : v;
        /* ★ v114 — 「업체」 한 칸이 데이터 칸 셋(workVendor·owner·vendor)을 물고 있다.
              쓸 때는 첫 칸에만 쓰고, 읽을 때는 셋 중 값 있는 것을 읽는다.
              그래서 업체를 지우면 뒤에 숨어 있던 옛 값이 올라와
              「지우고 다시 넣어도 옛 이름이 나오는」 일이 생겼다. (달님 신고 2026-08-29)
              → 뒤에 숨은 칸도 함께 정리한다. 단, 다른 기본칸이 쓰는 칸은 건드리지 않는다
                (메모의 제목·본문이 같은 body 를 쓰는 경우 등). */
        try{
          var _prev = pget(e, pid);
          var _used = {};
          var _bm = (DS && DS.bmap) || {};
          for(var _ok in _bm){ if(_ok !== pid) (_bm[_ok]||[]).forEach(function(k){ _used[k]=1; }); }
          for(var _i=1; _i<bf2.length; _i++){
            var _k = bf2[_i];
            if(_used[_k]) continue;
            var _cv = e[_k];
            if(_cv == null || _cv === '') continue;
            var _same = (String(_cv) === String(_prev));
            if(_same || (v === '' && pid !== '_amount')) bo[_k] = '';
          }
        }catch(_e){ console.warn('[기본칸] 숨은 칸 정리 실패', _e); }
        return bo;
      }
      var wpr={}; for(var wk in (e.props||{})) wpr[wk]=e.props[wk];
      wpr[pid]=v; return {props:wpr};
    }
    if(pid==='_date')   return {date:v};
    if(pid==='_title')  return {title:v};
    if(pid==='_memo')   return {detail:v};
    if(pid==='_sub'){
      if(e.who!==undefined && e.who!=='')     return {who:v};
      if(e.where!==undefined && e.where!=='') return {where:v};
      if(e.place!==undefined && e.place!=='') return {place:v};
      return (e.ptype==='car') ? {place:v} : {who:v};
    }
    if(pid==='_amount') return {amount:(v===''?'':num(v))};
    if(pid.slice(0,2)==='f:'){ var o={}; o[pid.slice(2)]=v; return o; }
    var pr={}; for(var k in (e.props||{})) pr[k]=e.props[k];
    pr[pid]=v; return {props:pr};
  }
  /* 금액이 항목표에서 계산되는 기록은 직접 못 고친다 */
  function amountLocked(e){
    return !!(esr(e.costs).length || esr(e.menus).length || esr(e.parts).length
      || (e.ptype==='buy' && esr(e.items).filter(function(r){return num(r.price)>0;}).length>=2));
  }

  /* ── 관계(rel) 대상 ── */
  /* 개인·업무 어느 쪽 저장소든 뒤져서 찾는다 */
  function allRecs(){
    var a=[];
    try{ a = a.concat((window.wlP && window.wlP.list()) || []); }catch(e){}
    try{ a = a.concat(entries || []); }catch(e){}
    return a;
  }
  function anyRec(id){
    var a=allRecs();
    for(var i=0;i<a.length;i++) if(a[i] && a[i].id===id) return a[i];
    return null;
  }
  /* 업무 기록의 보기 이름 */
  function workLabel(x){
    try{
      var bm=(BMAP[x.kind]||{});
      var d = (bm._date||[]).map(function(k){ return x[k]; }).filter(Boolean)[0] || '';
      var t = (bm._title||[]).map(function(k){ return x[k]; }).filter(Boolean)[0] || '(제목없음)';
      return (d? d+' ':'') + String(t).slice(0,40);
    }catch(e){ return x.title || '(제목없음)'; }
  }

  /* 다른 종류의 기록을 읽을 땐 그 종류의 규칙으로 잠깐 바꿔서 읽는다 */
  var _DSC = {}, _DSCn = -1;
  function dsWorkC(kind){
    var n = 0; try{ n = (entries||[]).length; }catch(e){}
    if(n !== _DSCn){ _DSC = {}; _DSCn = n; }
    if(!_DSC[kind]) { try{ _DSC[kind]=dsWork(kind); }catch(e){ return null; } }
    return _DSC[kind];
  }
  function dsForRec(r){
    if(!r || !r.kind) return DS;
    if(r.kind==='personal' || r.kind==='pcontact') return DS_PERSONAL;
    if(DS && DS.kind===r.kind) return DS;
    return dsWorkC(r.kind) || DS;
  }
  function asRec(r, fn){
    var d=dsForRec(r);
    if(d===DS) return fn();
    var old=DS; DS=d;
    try{ return fn(); } finally { DS=old; }
  }

  function relWorkOpts(){
    try{
      return Object.keys(WORK_KINDS).map(function(k){
        var m=WORK_KINDS[k];
        return '<option value="w:'+k+'">'+m.i+' '+m.n+'</option>'; }).join('');
    }catch(e){ return ''; }
  }
  function relTargets(p){
    var t=(p&&p.target)||'pcontact';
    if(t==='pcontact') return contacts().map(function(c){
      return {id:c.id, label:(c.name||'')+(c.person?(' · '+c.person):''), kind:'pcontact'}; });
    /* 업무일지 — target 이 'w:종류' 또는 'w:*' */
    if(t.slice(0,2)==='w:'){
      var wk=t.slice(2), out=[];
      try{
        (entries||[]).forEach(function(x){
          if(!x || !x.kind || x.kind==='personal' || x.kind==='pcontact') return;
          if(wk!=='*' && x.kind!==wk) return;
          var m=(typeof WORK_KINDS!=='undefined' && WORK_KINDS[x.kind]) || null;
          out.push({ id:x.id, label:(m?m.i+' ':'')+workLabel(x), kind:x.kind });
        });
      }catch(e){}
      out.sort(function(a,b){ return a.label<b.label?1:-1; });
      return out.slice(0,400);
    }
    return ent().filter(function(x){
      return x.kind==='personal' && (t==='personal' || x.ptype===t); })
      .map(function(x){ return {id:x.id, label:(x.date||'')+' '+(x.title||''), kind:'personal'}; });
  }
  function relLabel(id){
    var r=anyRec(id);
    if(!r) return '(없어진 항목)';
    if(r.kind==='pcontact') return r.name||'(이름없음)';
    if(r.kind==='personal') return r.title||r.who||'(제목없음)';
    return workLabel(r);
  }
  function relArr(v){ return Array.isArray(v)? v : (v? [v] : []); }

  /* ── 셀 그리기 ── */
  function cellHTML(e, p){
    var v = pget(e, p.id), t = p.type;
    /* v185 — 업무 「지출종류」는 보이는 이름만 통일한다 (저장 값은 그대로) */
    if(p.id==='f:expType' && v && typeof wlExpTypeLabel==='function')
      return '<span>'+esc(wlExpTypeLabel(v))+'</span>';
    if(p.id==='_cat')   return tagOf(e);
    if(p.id==='_att')   return v ? '<span style="color:#8ba0b6;font-size:11.5px">📎'+v+'</span>' : '';
    if(p.id==='_title'){
      /* 노션처럼 — 제목 칸에는 제목만. 나머지는 각자 칸으로 */
      return '<div class="tt">'+esc(v||'(제목없음)')
        + (e.rating? ' <span style="color:#f4b942">'+stars(e.rating)+'</span>':'')
        + (e.body? ' <span class="pg-mark" title="본문이 있어요">📝</span>':'')
        + '<button type="button" class="tt-open" data-lpage="'+esc(e.id)+'" title="페이지로 열기">📄 열기</button>'
        + '</div>';
    }
    if(p.id==='_amount'){
      var lk=amountLocked(e);
      return '<span style="color:'+(v?'#0f7a4a':'#c8d4e0')+'">'+(v? numFmt(v)+'원':'—')
        + (lk? ' <span style="font-size:10px;color:#c8d4e0" title="항목 합계로 자동 계산돼요">∑</span>':'') + '</span>';
    }
    if(t==='check')  return v ? '☑' : '<span style="color:#c8d4e0">☐</span>';
    if(t==='formula'){
      var fv=formulaCalc(e, p.expr, e.ptype);
      return fv===''? '<span style="color:#c8d4e0">—</span>'
        : '<span style="color:#7c3aed;font-weight:800">'+numFmt(fv)+(p.unit?(' '+esc(p.unit)):'')+'</span>';
    }
    if(t==='multi'){
      var ms=Array.isArray(v)?v:(v?String(v).split(','):[]);
      if(!ms.length) return '';
      return ms.slice(0,4).map(function(x){
        var c=colorOf((p.colors||{})[x]||'gray');
        return '<span class="lf-tag" style="background:'+c.bg+';color:'+c.fg+';margin-right:3px">'+esc(x)+'</span>'; }).join('')
        + (ms.length>4? '<span style="color:#8ba0b6;font-size:11px">+'+(ms.length-4)+'</span>':'');
    }
    if(t==='rollup'){
      var rv=rollupCalc(e, p, e.ptype);
      if(Array.isArray(rv)){                                   /* 목록 — 눌러서 그 기록으로 */
        if(!rv.length) return '<span style="color:#c8d4e0">—</span>';
        return rv.slice(0,3).map(function(id){
          return '<span class="lf-relchip" data-relgo="'+esc(id)+'">'+esc(relLabel(id))+'</span>'; }).join('')
          + (rv.length>3? '<span style="color:#8ba0b6;font-size:11px"> +'+(rv.length-3)+'</span>':'');
      }
      return rv===''? '<span style="color:#c8d4e0">—</span>'
        : '<span style="color:#0891b2;font-weight:800">'+numFmt(rv)+(p.unit?(' '+esc(p.unit)):'')+'</span>';
    }
    if(t==='rel'){
      var ids=relArr(v);
      if(!ids.length) return '';
      return ids.slice(0,3).map(function(id){
        return '<span class="lf-relchip" data-relgo="'+esc(id)+'">'+esc(relLabel(id))+'</span>'; }).join('')
        + (ids.length>3? '<span style="color:#8ba0b6;font-size:11px"> +'+(ids.length-3)+'</span>':'');
    }
    if(t==='num'||t==='rate') return v===''||v==null ? '<span style="color:#c8d4e0">—</span>'
      : '<span style="color:#1a2f45">'+numFmt(v)+'</span>';
    if(t==='star')   return v ? '<span style="color:#f4b942">'+stars(v)+'</span>' : '';
    if(t==='tel')    return v ? '<a href="tel:'+esc(String(v).replace(/[^0-9+]/g,''))
      +'" onclick="event.stopPropagation()" style="color:#2563a8;font-weight:700">'+esc(v)+'</a>' : '';
    if(t==='map')    return v ? '<a href="https://map.naver.com/p/search/'+encodeURIComponent(v)
      +'" target="_blank" onclick="event.stopPropagation()" style="color:#03c75a;font-weight:700">'+esc(v)+'</a>' : '';
    if(t==='link'){
      /* v194 — 「↗ 링크」만 뜨던 것을 실제 주소가 보이게. http 를 안 적어도 열린다 */
      if(!v) return '';
      var _lv = String(v).trim();
      var _lh = /^https?:\/\//i.test(_lv) ? _lv : ('https://' + _lv);
      var _ls = _lv.replace(/^https?:\/\//i,'');
      if(_ls.length > 46) _ls = _ls.slice(0,46) + '…';
      return '<a href="'+esc(_lh)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()"'
           + ' title="'+esc(_lv)+'" style="color:#7c3aed;font-weight:700">↗ '+esc(_ls)+'</a>';
    }
    if(t==='rows'){ var n2=esr(v).length; return n2? '<span style="color:#8ba0b6;font-size:11.5px">☰ '+n2+'줄</span>':''; }
    if(t==='sel'&&v) return '<span class="lf-tag" style="background:#eef2f7;color:#475569">'+esc(v)+'</span>';
    if(t==='area')   return v ? '<span class="sub" style="display:block">'+esc(String(v).replace(/\s+/g,' ').slice(0,70))+'</span>' : '';
    return esc(v==null?'':String(v));
  }

  /* ── 보이는 열 ── */
  function colsAll(){ var o=lsGet(LS_COLS,null); return (o&&typeof o==='object')?o:{}; }
  /* ── 칸 폭 (사람이 끌어서 정한 값) ── */
  var LS_COLW='wl_life_colw';
  function colwAll(){ var o=lsGet(LS_COLW,null); return (o&&typeof o==='object')?o:{}; }
  function colwOf(pt){ var o=colwAll()[dsk(pt)]; return (o&&typeof o==='object')?o:{}; }
  function colwSet(pt, pid, px){
    var all=colwAll(), k=dsk(pt);
    if(!all[k] || typeof all[k]!=='object') all[k]={};
    if(px) all[k][pid]=Math.max(56, Math.round(px)); else delete all[k][pid];
    lsSet(LS_COLW, all);
  }
  function colwReset(pt){ var all=colwAll(); delete all[dsk(pt)]; lsSet(LS_COLW, all); }
  /* 틀고정 켜짐 여부 */
  var LS_FRZ='wl_life_frz';
  function frzOn(){ var v=lsGet(LS_FRZ,null); return v===null ? true : !!v; }
  function frzSet(v){ lsSet(LS_FRZ, !!v); safeRender(); }

  function colsOf(pt){
    var o=colsAll(), k=dsk(pt);
    var a=o[k]; if(Array.isArray(a)&&a.length) return a;
    return defCols(pt);
  }
  /* 처음 볼 때 보여줄 칸 — 업무일지는 그 종류의 서식 앞쪽 칸을 같이 보여준다 */
  function defCols(pt){
    if(isPersonal()) return DEF_COLS.slice();
    var bm = (DS.bmap||{});
    var out = [];
    if((bm._date||[]).length)   out.push('_date');
    out.push('_title');
    if((bm._sub||[]).length)    out.push('_sub');
    if((bm._amount||[]).length) out.push('_amount');
    try{
      var fs = DS.fieldsOf(pt) || [];
      var skip = {};
      for(var bk in bm) (bm[bk]||[]).forEach(function(n){ skip[n]=1; });
      fs.forEach(function(f){
        if(out.length>=8) return;
        if(skip[f.k] || f.t==='area') return;
        out.push('f:'+f.k);
      });
    }catch(e){}
    out.push('_att');
    return out;
  }
  function colsSave(pt, arr){ var o=colsAll(); o[dsk(pt)]=arr.slice(); lsSet(LS_COLS,o); }
  function colsToggle(pt, pid){
    var a=colsOf(pt), i=a.indexOf(pid);
    if(i>=0){ if(a.length<=1) return; a.splice(i,1); }
    else a.push(pid);
    colsSave(pt,a); safeRender();
  }

  /* ══════ 열 고르기 창 ══════ */
  function colPicker(pt){
    var all=propsOf(pt), cur=colsOf(pt);
    function grp(from){
      return all.filter(function(p){
        if(from==='base')   return p.base;
        if(from==='field')  return p.from==='기본';
        return !p.base && p.from!=='기본';
      });
    }
    function block(title, arr, hint){
      if(!arr.length) return '';
      return '<div style="margin-top:12px"><div style="font-size:11.5px;font-weight:900;color:#8ba0b6;margin-bottom:6px">'
        + title + (hint? ' <span style="font-weight:600;color:#c8d4e0">'+hint+'</span>':'') + '</div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px">'
        + arr.map(function(p){
            var on=cur.indexOf(p.id)>=0;
            return '<label class="lf-ck cpit" data-cpid="'+esc(p.id)+'" style="position:relative;padding:7px 30px 7px 10px;border:1.5px solid '
              + (on?'#bcd2ea':'#e8f0fa')+';border-radius:9px;background:'+(on?'#f0f6ff':'#fff')+'">'
              + '<input type="checkbox"'+(on?' checked':'')+'> '
              + '<span style="color:#8ba0b6">'+tinfo(p.type).i+'</span> '
              + '<span class="cpnm" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
              +   (p._renamed? ';color:#7c3aed':'')+'">'+esc(p.name)+'</span>'
              + '<button type="button" class="cpren" data-cpren="'+esc(p.id)+'" title="이름 바꾸기"'
              +   ' style="position:absolute;right:5px;top:50%;transform:translateY(-50%);border:none;background:none;'
              +   'font-size:12px;color:#b9c7d6;cursor:pointer;padding:3px 4px;line-height:1">✏️</button>'
              + '</label>';
          }).join('') + '</div></div>';
    }
    var ov=document.createElement('div'); ov.className='lf-ov';
    ov.innerHTML='<div class="lf-mod" style="max-width:720px">'
      + '<div class="lf-mh"><b>⚙️ 목록에 보일 항목 고르기</b>'
      +   '<button type="button" id="lfCX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div style="font-size:12.5px;color:#7a92a8;line-height:1.6">'
      +   '체크한 것만 목록에 칸으로 나옵니다. 칸을 눌러 <b>그 자리에서 바로 고칠</b> 수 있어요.'
      +   '<br>항목 오른쪽 <b>✏️</b> 를 누르면 <b>이름을 내 말로 바꿀</b> 수 있습니다 — 공통·기본 항목도 됩니다.'
      +   (pt? '' : '<br><span style="color:#a8b8c8">지금은 <b>전체</b> 보기라 공통 항목만 고를 수 있어요. 위에서 종류를 하나 고르면 그 종류의 항목도 나옵니다.</span>')
      + '</div>'
      + block('공통', grp('base'))
      + block('이 종류의 항목', grp('field'), pt?('· '+((cats()[pt]&&cats()[pt].n)||'차계부')):'')
      + block('내가 만든 항목', grp('custom'))
      + colOrderHTML(pt)
      + '<div class="lf-mbtn">'
      +   '<button type="button" id="lfPAdd" class="lf-radd" style="height:42px">＋ 속성 추가</button>'
      +   '<button type="button" id="lfPMgr" class="lf-radd" style="height:42px">⋯ 내 속성 관리</button>'
      +   (isPersonal()? '' : '<button type="button" id="lfPRec" class="lf-radd" style="height:42px;border-color:#c4b5fd;color:#7c3aed">📌 자주 쓰는 연결</button>')
      +   '<div style="flex:1"></div>'
      +   (Object.keys(pnameOf(pt)).length
             ? '<button type="button" id="lfNReset" class="lf-radd" style="height:42px;border-color:#e2d5f8;color:#7c3aed">이름 되돌리기</button>' : '')
      +   '<button type="button" id="lfCReset" class="lf-radd" style="height:42px">기본값으로</button>'
      +   '<button type="button" id="lfCOk" style="height:42px;padding:0 24px;border:none;border-radius:10px;background:#2563a8;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">확인</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfCX').addEventListener('click', cl);
    document.getElementById('lfCOk').addEventListener('click', function(){ cl(); safeRender(); });
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    ov.querySelectorAll('[data-cpid]').forEach(function(l){
      l.addEventListener('click', function(e){
        e.preventDefault();
        var pid=l.getAttribute('data-cpid'), a=colsOf(pt), i=a.indexOf(pid);
        if(i>=0){ if(a.length<=1){ askInfo('칸이 하나는 있어야 해요'); return; } a.splice(i,1); }
        else {
          /* 공통 칸이면 원래 자리 근처에 끼워넣는다 */
          var bo={}; BASE.forEach(function(x,k){ bo[x.id]=k; });
          if(bo[pid]!=null){
            var at=a.length;
            for(var k2=0;k2<a.length;k2++){ if(bo[a[k2]]!=null && bo[a[k2]]>bo[pid]){ at=k2; break; } }
            a.splice(at,0,pid);
          } else a.push(pid);
        }
        colsSave(pt,a);
        var on=a.indexOf(pid)>=0;
        l.querySelector('input').checked=on;
        l.style.borderColor=on?'#bcd2ea':'#e8f0fa';
        l.style.background=on?'#f0f6ff':'#fff';
      });
    });
    document.getElementById('lfCReset').addEventListener('click', function(){
      colsSave(pt, defCols(pt)); cl(); safeRender(); });
    var nrb=document.getElementById('lfNReset');
    if(nrb) nrb.addEventListener('click', function(){
      if(!confirm('바꿔 둔 칸 이름을 모두 원래대로 되돌릴까요?')) return;
      pnameReset(pt); cl(); safeRender(); setTimeout(function(){ colPicker(pt); }, 60); });

    /* ✏️ 이름 바꾸기 — 그 자리에서 */
    ov.querySelectorAll('[data-cpren]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.preventDefault(); ev.stopPropagation();
        var pid=b.getAttribute('data-cpren');
        var lab=b.closest('.cpit'), nm=lab.querySelector('.cpnm');
        if(!nm || lab.querySelector('.cprin')) return;
        var was=nm.textContent;
        var inp=document.createElement('input');
        inp.type='text'; inp.className='cprin'; inp.value=was;
        inp.style.cssText='flex:1;min-width:0;height:24px;padding:0 6px;border:1.5px solid #2563a8;'
          + 'border-radius:6px;font-size:12.5px;font-family:inherit;outline:none';
        inp.addEventListener('click', function(e2){ e2.preventDefault(); e2.stopPropagation(); });
        inp.addEventListener('mousedown', function(e2){ e2.stopPropagation(); });
        nm.style.display='none';
        nm.parentNode.insertBefore(inp, nm);
        inp.focus(); inp.select();
        var done=false;
        function fin(save){
          if(done) return; done=true;
          if(save){
            var v=inp.value.trim();
            pnameSet(pt, pid, v);
            nm.textContent = v || (function(){
              /* 빈 값이면 원래 이름으로 되돌린다 */
              var q=propsOf(pt).filter(function(x){ return x.id===pid; })[0];
              return q? q.name : was; })();
            nm.style.color = v? '#7c3aed' : '';
            try{ safeRender(); }catch(e){}
          }
          inp.remove(); nm.style.display='';
        }
        inp.addEventListener('keydown', function(e2){
          e2.stopPropagation();
          if(e2.key==='Enter'){ e2.preventDefault(); fin(true); }
          else if(e2.key==='Escape'){ e2.preventDefault(); fin(false); }
        });
        inp.addEventListener('blur', function(){ fin(true); });
      });
    });
    bindColOrder(ov, pt);
    document.getElementById('lfPAdd').addEventListener('click', function(){ cl(); propAdd(pt); });
    document.getElementById('lfPMgr').addEventListener('click', function(){ cl(); propMgr(pt); });
    var rcb=document.getElementById('lfPRec');
    if(rcb) rcb.addEventListener('click', function(){ cl(); recipeMgr(pt); });
  }

  /* ══════════════════════════════════════════════════════════
     📌 자주 쓰는 연결 — 한 번 누르면 관계·롤업·수식을 통째로 만든다
     ══════════════════════════════════════════════════════════ */
  var RECIPES = {
    work: [{
      key:'work_expense', name:'업무 ↔ 지출',
      desc:'업무 한 건에 지출 여러 건을 묶고, 합계를 자동으로 냅니다.',
      make:'🔗 관련 지출 · Σ 지출 합계 · Σ 지출 건수',
      props:function(){
        var rid='c'+Date.now()+'a';
        return [
          {id:rid, name:'관련 지출', type:'rel',    target:'w:expense', order:Date.now(),   archived:false},
          {id:rid+'s', name:'지출 합계', type:'rollup', relPid:rid, tgtPid:'_amount', agg:'sum',   dir:'fwd', unit:'원', order:Date.now()+1, archived:false},
          {id:rid+'c', name:'지출 건수', type:'rollup', relPid:rid, tgtPid:'_amount', agg:'count', dir:'fwd', unit:'건', order:Date.now()+2, archived:false}
        ];
      }
    }],
    accident: [{
      key:'acc_progress', name:'사고 ↔ 진행업무',
      desc:'누수 사고에 방수공사를 묶어두면, 사고에서 공사 상황이 같이 보입니다.',
      make:'🔗 관련 진행업무 · Σ 공사비 합계',
      props:function(){
        var rid='c'+Date.now()+'a';
        return [
          {id:rid, name:'관련 진행업무', type:'rel', target:'w:progress', order:Date.now(), archived:false},
          {id:rid+'s', name:'공사비 합계', type:'rollup', relPid:rid, tgtPid:'_amount', agg:'sum', dir:'fwd', unit:'원', order:Date.now()+1, archived:false}
        ];
      }
    }],
    expense: [{
      key:'exp_work', name:'지출 ← 업무 (거꾸로)',
      desc:'업무 쪽에서 걸어둔 「관련 지출」을 지출 쪽에서도 거꾸로 봅니다.',
      make:'Σ 딸린 업무(이름) · Σ 딸린 업무 수',
      need:function(){
        var c=revCands().filter(function(x){ return x.v.indexOf('rev|work|')===0; });
        return c.length ? null : '먼저 🔧 업무 화면에서 「업무 ↔ 지출」 연결을 만들어 주세요';
      },
      props:function(){
        var c=revCands().filter(function(x){ return x.v.indexOf('rev|work|')===0; })[0];
        var rv=revParse(c.v);
        var t=Date.now();
        return [
          { id:'c'+t+'r', name:'딸린 업무', type:'rollup',
            revSrc:rv.src, relPid:rv.pid, tgtPid:'_title', agg:'list', dir:'rev',
            order:t, archived:false },
          { id:'c'+t+'n', name:'딸린 업무 수', type:'rollup',
            revSrc:rv.src, relPid:rv.pid, tgtPid:'_amount', agg:'count', dir:'rev',
            unit:'건', order:t+1, archived:false }
        ];
      }
    }],
    item: [{
      key:'item_stock', name:'자재 ↔ 재고 (현재고 자동계산)',
      desc:'입출고 기록의 「품목」을 거꾸로 따라가 입고·출고를 세고, 현재고를 냅니다.',
      make:'Σ 총 입고 · Σ 총 출고 · ƒ 현재고',
      props:function(){
        var t=Date.now();
        return [
          {id:'c'+t+'i', name:'총 입고', type:'rollup', revSrc:'stock', relPid:'f:itemId',
           tgtPid:'f:qty', agg:'sum', dir:'rev', wPid:'f:stockType', wVal:'입고', unit:'개', order:t,   archived:false},
          {id:'c'+t+'o', name:'총 출고', type:'rollup', revSrc:'stock', relPid:'f:itemId',
           tgtPid:'f:qty', agg:'sum', dir:'rev', wPid:'f:stockType', wVal:'출고', unit:'개', order:t+1, archived:false},
          {id:'c'+t+'n', name:'현재고', type:'formula', expr:'{총 입고} - {총 출고}', unit:'개', order:t+2, archived:false}
        ];
      }
    }]
  };

  function recipeMgr(pt){
    var list = RECIPES[DS.kind] || [];
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9800';
    ov.innerHTML='<div class="lf-mod" style="max-width:620px">'
      + '<div class="lf-mh"><b>📌 자주 쓰는 연결</b>'
      +   '<button type="button" id="lfRcX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div style="font-size:12.5px;color:#7a92a8;line-height:1.6;margin-bottom:4px">'
      +   '한 번 누르면 필요한 <b>관계·합계·수식 칸</b> 을 한꺼번에 만들어 드려요.<br>'
      +   '만든 뒤에는 여느 속성과 똑같이 이름을 바꾸거나 지울 수 있습니다.</div>'
      + (list.length ? list.map(function(r){
          var blocked = r.need ? r.need() : null;
          return '<div style="border:1.5px solid #e8f0fa;border-radius:12px;padding:12px 14px;margin-top:10px">'
            + '<div style="font-size:14px;font-weight:900;color:#1a2f45">'+esc(r.name)+'</div>'
            + '<div style="font-size:12.5px;color:#7a92a8;line-height:1.6;margin-top:3px">'+esc(r.desc)+'</div>'
            + '<div style="font-size:12px;color:#7c3aed;font-weight:800;margin-top:6px">'+esc(r.make)+'</div>'
            + (blocked
               ? '<div style="font-size:12px;color:#b45309;background:#fffbea;border-radius:8px;padding:7px 10px;margin-top:8px">⚠ '+esc(blocked)+'</div>'
               : '<div style="margin-top:9px"><button type="button" class="lf-radd" data-rcp="'+esc(r.key)+'"'
                 + ' style="height:38px;border-color:#c4b5fd;color:#7c3aed;font-weight:800">＋ 이대로 만들기</button></div>')
            + '</div>';
        }).join('')
        : '<div style="text-align:center;color:#a8b8c8;padding:30px">이 화면에 준비된 연결이 아직 없어요</div>')
      + '<div class="lf-mbtn"><div style="flex:1"></div>'
      +   '<button type="button" id="lfRcC" style="height:42px;padding:0 20px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfRcX').addEventListener('click', cl);
    document.getElementById('lfRcC').addEventListener('click', function(){ cl(); safeRender(); });
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    ov.querySelectorAll('[data-rcp]').forEach(function(b){
      b.addEventListener('click', function(){
        var k=b.getAttribute('data-rcp');
        var r=(RECIPES[DS.kind]||[]).filter(function(x){ return x.key===k; })[0];
        if(!r) return;
        var made=r.props();
        var cus=customOf(null).slice();
        var have={}; cus.forEach(function(x){ have[x.name]=1; });
        var add=made.filter(function(x){ return !have[x.name]; });
        if(!add.length){ noteMsg('이미 만들어져 있어요'); return; }
        customSave(null, cus.concat(add));
        /* 새로 만든 칸은 목록에도 바로 보이게 */
        var cs=colsOf(pt).slice();
        add.forEach(function(x){ if(cs.indexOf(x.id)<0) cs.push(x.id); });
        colsSave(pt, cs);
        if(typeof toast==='function') toast('📌 '+add.length+'개 칸을 만들었어요');
        cl(); safeRender();
      });
    });
  }



  /* ══════ 🎨 색상 규칙 창 ══════ */
  function colorMgr(pt){
    var scope = pt || '_all';
    function rows(){
      var a=colorRules(scope);
      if(!a.length) return '<tr><td colspan="3" style="text-align:center;color:#a8b8c8;padding:24px">'
        + '아직 규칙이 없어요<div style="font-size:12px;margin-top:6px">＋ 로 만들어보세요</div></td></tr>';
      return a.map(function(r,i){
        var p=propById(pt,r.pid), c=colorOf(r.color);
        return '<tr><td><span class="lf-tag" style="background:'+c.bg+';color:'+c.fg+'">'+esc(c.n)+'</span></td>'
          + '<td>'+tinfo(p?p.type:'text').i+' <b>'+esc(p?p.name:r.pid)+'</b> '+esc(r.op)
          + (opNeedsVal(r.op)? ' <b>'+esc(r.val)+'</b>':'')+'</td>'
          + '<td class="r"><button type="button" class="lf-fx" data-cup="'+i+'">▲</button> '
          + '<button type="button" class="lf-fx" data-cdn="'+i+'">▼</button> '
          + '<button type="button" class="lf-fx" data-cdel="'+i+'" style="color:#b52929">🗑</button></td></tr>'; }).join('');
    }
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9760';
    ov.innerHTML='<div class="lf-mod" style="max-width:660px">'
      + '<div class="lf-mh"><b>🎨 색상 규칙</b>'
      +   '<button type="button" id="lfCoX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div style="font-size:12.5px;color:#7a92a8;line-height:1.6">'
      +   '조건에 맞는 줄에 색이 칠해집니다. <b>위에 있는 규칙이 먼저</b> 적용돼요.</div>'
      + '<table class="lf-tbl" style="margin-top:10px"><tr><th style="width:80px">색</th><th>조건</th><th style="width:150px"></th></tr>'
      +   rows() + '</table>'
      + '<div class="lf-mbtn">'
      +   '<button type="button" id="lfCoAdd" class="lf-radd" style="height:42px">＋ 규칙 추가</button>'
      +   '<div style="flex:1"></div>'
      +   '<button type="button" id="lfCoC" style="height:42px;padding:0 20px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    function again(){ cl(); colorMgr(pt); }
    document.getElementById('lfCoX').addEventListener('click', cl);
    document.getElementById('lfCoC').addEventListener('click', function(){ cl(); safeRender(); });
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    ov.querySelectorAll('[data-cdel]').forEach(function(b){
      b.addEventListener('click', function(){
        var a=colorRules(scope); a.splice(+b.getAttribute('data-cdel'),1); colorRulesSave(scope,a); again(); }); });
    ov.querySelectorAll('[data-cup]').forEach(function(b){
      b.addEventListener('click', function(){
        var i=+b.getAttribute('data-cup'); if(i<=0) return;
        var a=colorRules(scope); var t=a[i-1]; a[i-1]=a[i]; a[i]=t; colorRulesSave(scope,a); again(); }); });
    ov.querySelectorAll('[data-cdn]').forEach(function(b){
      b.addEventListener('click', function(){
        var i=+b.getAttribute('data-cdn'); var a=colorRules(scope);
        if(i>=a.length-1) return; var t=a[i+1]; a[i+1]=a[i]; a[i]=t; colorRulesSave(scope,a); again(); }); });
    document.getElementById('lfCoAdd').addEventListener('click', function(){
      cl(); colorAdd(pt, function(){ colorMgr(pt); }); });
  }

  function colorAdd(pt, after){
    var all = propsOf(pt).filter(function(p){ return p.type!=='rows' && !isDisp(p.type); });
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9800';
    ov.innerHTML='<div class="lf-mod" style="max-width:560px">'
      + '<div class="lf-mh"><b>＋ 색상 규칙 추가</b>'
      +   '<button type="button" id="lfCaX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div class="lf-mf" style="grid-template-columns:1fr">'
      +   '<div class="lf-f"><label>어느 칸이</label><select id="lfCaP">'
      +     all.map(function(p){ return '<option value="'+esc(p.id)+'">'+tinfo(p.type).i+' '+esc(p.name)+'</option>'; }).join('')
      +   '</select></div>'
      +   '<div class="lf-f"><label>조건</label><select id="lfCaO"></select></div>'
      +   '<div class="lf-f" id="lfCaVW"><label>값</label><span id="lfCaVBox"></span></div>'
      +   '<div class="lf-f"><label>그러면 이 색으로</label><div class="lf-colors" id="lfCaC">'
      +     COLORS.map(function(c,i){ return '<button type="button" data-col="'+c.k+'"'+(i===0?' class="on"':'')
            +' style="background:'+c.bg+';color:'+c.fg+'">'+c.n+'</button>'; }).join('')
      +   '</div></div>'
      + '</div>'
      + '<div class="lf-mbtn"><div style="flex:1"></div>'
      +   '<button type="button" id="lfCaC2" style="height:44px;padding:0 18px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">취소</button>'
      +   '<button type="button" id="lfCaOk" style="height:44px;padding:0 22px;border:none;border-radius:10px;background:#2563a8;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">＋ 만들기</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfCaX').addEventListener('click', cl);
    document.getElementById('lfCaC2').addEventListener('click', cl);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    var PS=document.getElementById('lfCaP'), OS=document.getElementById('lfCaO'), pick='red';
    ov.querySelectorAll('[data-col]').forEach(function(b){
      b.addEventListener('click', function(){
        pick=b.getAttribute('data-col');
        ov.querySelectorAll('[data-col]').forEach(function(x){ x.className=''; });
        b.className='on'; }); });
    function curP(){ return propById(pt, PS.value); }
    function fillO(){ var p=curP(); if(!p) return;
      OS.innerHTML=opsOf(p.type).map(function(o){ return '<option>'+esc(o)+'</option>'; }).join(''); fillV(); }
    function fillV(){
      var p=curP(), box=document.getElementById('lfCaVBox'), w=document.getElementById('lfCaVW');
      if(!p) return;
      if(!opNeedsVal(OS.value)){ w.style.display='none'; box.innerHTML=''; return; }
      w.style.display='';
      if(p.type==='sel'||p.type==='multi'){
        var o=p.opts||p.o||[''];
        box.innerHTML='<select id="lfCaV">'+o.map(function(x){ return '<option value="'+esc(x)+'">'+esc(x||'—')+'</option>'; }).join('')+'</select>';
      } else if(p.type==='date'){ box.innerHTML='<input type="date" id="lfCaV">'; }
      else if(['num','rate','star','formula','rollup','att'].indexOf(p.type)>=0){
        box.innerHTML='<input type="text" id="lfCaV" data-num="1" placeholder="숫자만">';
        setTimeout(function(){ bindNum(document.getElementById('lfCaV')); },0);
      } else { box.innerHTML='<input type="text" id="lfCaV" placeholder="찾을 말">'; }
    }
    PS.addEventListener('change', fillO); OS.addEventListener('change', fillV); fillO();
    document.getElementById('lfCaOk').addEventListener('click', function(){
      var p=curP(); if(!p) return;
      var vEl=document.getElementById('lfCaV');
      var val = vEl ? (vEl.getAttribute('data-num')==='1'? numRaw(vEl.value) : vEl.value) : '';
      if(opNeedsVal(OS.value) && String(val).trim()===''){ askInfo('값을 넣어주세요'); return; }
      var scope = pt || '_all';
      var a=colorRules(scope); a.push({pid:p.id, op:OS.value, val:val, color:pick});
      colorRulesSave(scope, a);
      cl(); if(after) after(); else safeRender();
    });
  }

  /* ══════ ↕ 칸 순서 바꾸기 ══════ */
  function colOrderHTML(pt){
    var cur2=colsOf(pt);
    return '<div style="margin-top:14px"><div style="font-size:11.5px;font-weight:900;color:#8ba0b6;margin-bottom:6px">'
      + '↕ 보이는 칸 순서 <span style="font-weight:600;color:#c8d4e0">끌어서 옮기거나 ▲▼ 로</span></div>'
      + '<div id="lfColOrd" class="lf-ord">'
      + cur2.map(function(id,i){
          var p=propById(pt,id); if(!p) return '';
          return '<div class="lf-ordi" draggable="true" data-oid="'+esc(id)+'" data-oi="'+i+'">'
            + '<span class="gg">⋮⋮</span>'+tinfo(p.type).i+' '+esc(p.name)
            + '<span style="flex:1"></span>'
            + '<button type="button" data-oup="'+i+'">▲</button>'
            + '<button type="button" data-odn="'+i+'">▼</button></div>'; }).join('')
      + '</div></div>';
  }
  function bindColOrder(ov, pt){
    function mv(from,to){
      var a=colsOf(pt); if(to<0||to>=a.length) return;
      var it=a.splice(from,1)[0]; a.splice(to,0,it); colsSave(pt,a);
      ov.remove(); colPicker(pt);
    }
    ov.querySelectorAll('[data-oup]').forEach(function(b){
      b.addEventListener('click', function(){ mv(+b.getAttribute('data-oup'), +b.getAttribute('data-oup')-1); }); });
    ov.querySelectorAll('[data-odn]').forEach(function(b){
      b.addEventListener('click', function(){ mv(+b.getAttribute('data-odn'), +b.getAttribute('data-odn')+1); }); });
    var dragI=-1;
    ov.querySelectorAll('.lf-ordi').forEach(function(el){
      el.addEventListener('dragstart', function(){ dragI=+el.getAttribute('data-oi'); el.classList.add('drag'); });
      el.addEventListener('dragend',   function(){ el.classList.remove('drag'); });
      el.addEventListener('dragover',  function(e){ e.preventDefault(); el.classList.add('over'); });
      el.addEventListener('dragleave', function(){ el.classList.remove('over'); });
      el.addEventListener('drop', function(e){
        e.preventDefault(); el.classList.remove('over');
        var to=+el.getAttribute('data-oi');
        if(dragI>=0 && dragI!==to) mv(dragI, to);
      });
    });
  }

  /* ══════ 조건 추가 창 ══════ */
  function ruleAdd(pt){
    var all = propsOf(pt).filter(function(p){ return p.type!=='rows' && !isDisp(p.type); });
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9750';
    ov.innerHTML='<div class="lf-mod" style="max-width:560px">'
      + '<div class="lf-mh"><b>＋ 조건 추가</b>'
      +   '<button type="button" id="lfRX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div class="lf-mf" style="grid-template-columns:1fr">'
      +   '<div class="lf-f"><label>어느 칸을</label><select id="lfRP">'
      +     all.map(function(p){ return '<option value="'+esc(p.id)+'">'+tinfo(p.type).i+' '+esc(p.name)+'</option>'; }).join('')
      +   '</select></div>'
      +   '<div class="lf-f"><label>조건</label><select id="lfRO"></select></div>'
      +   '<div class="lf-f" id="lfRVW"><label>값</label><span id="lfRVBox"></span></div>'
      + '</div>'
      + '<div class="lf-mbtn"><div style="flex:1"></div>'
      +   '<button type="button" id="lfRC" style="height:44px;padding:0 18px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">취소</button>'
      +   '<button type="button" id="lfROk" style="height:44px;padding:0 24px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">＋ 걸기</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfRX').addEventListener('click', cl);
    document.getElementById('lfRC').addEventListener('click', cl);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });

    var PS=document.getElementById('lfRP'), OS=document.getElementById('lfRO');
    function curProp(){ return propById(pt, PS.value); }
    function fillOps(){
      var p=curProp(); if(!p) return;
      OS.innerHTML = opsOf(p.type).map(function(o){ return '<option>'+esc(o)+'</option>'; }).join('');
      fillVal();
    }
    function fillVal(){
      var p=curProp(), box=document.getElementById('lfRVBox'), w=document.getElementById('lfRVW');
      if(!p||!box) return;
      if(!opNeedsVal(OS.value)){ w.style.display='none'; box.innerHTML=''; return; }
      w.style.display='';
      if(p.type==='sel'){
        var o=p.opts||p.o||[''];
        box.innerHTML='<select id="lfRV">'+o.map(function(x){
          return '<option value="'+esc(x)+'">'+esc(x||'—')+'</option>'; }).join('')+'</select>';
      } else if(p.type==='date'){
        box.innerHTML='<input type="date" id="lfRV">';
      } else if(p.type==='num'||p.type==='rate'||p.type==='star'||p.type==='formula'||p.type==='att'){
        box.innerHTML='<input type="text" id="lfRV" data-num="1" placeholder="숫자만">';
        setTimeout(function(){ bindNum(document.getElementById('lfRV')); },0);
      } else if(p.type==='rel'){
        var tg=relTargets(p);
        box.innerHTML='<select id="lfRV">'+tg.map(function(t){
          return '<option value="'+esc(t.id)+'">'+esc(t.label)+'</option>'; }).join('')+'</select>';
      } else {
        box.innerHTML='<input type="text" id="lfRV" placeholder="찾을 말">';
      }
    }
    PS.addEventListener('change', fillOps);
    OS.addEventListener('change', fillVal);
    fillOps();
    document.getElementById('lfROk').addEventListener('click', function(){
      var p=curProp(); if(!p) return;
      var vEl=document.getElementById('lfRV');
      var val = vEl ? (vEl.getAttribute('data-num')==='1' ? numRaw(vEl.value) : vEl.value) : '';
      if(opNeedsVal(OS.value) && String(val).trim()===''){ askInfo('값을 넣어주세요'); return; }
      (flt.rules=flt.rules||[]).push({ pid:p.id, op:OS.value, val:val });
      lsSet(LS_FLT, flt);
      cl(); safeRender();
    });
  }

  /* ══════ 보기 저장 · 관리 ══════ */
  function viewSaveNow(pt){
    askText('이 보기의 이름을 지어주세요', '',
            { sub:'예) 올해 5만원 이상 구매', ph:'보기 이름', ok:'저장' }).then(function(nm){
    if(nm===null) return; nm=String(nm).trim(); if(!nm) return;
    var vs=viewsOf(pt);
    var v={ id:'v'+Date.now(), name:nm, scope:pt||'',
            cols:colsOf(pt).slice(), srt:{k:srt.k,d:srt.d},
            vw:vw, q:curQ||'',
            flt:JSON.parse(JSON.stringify(flt)) };
    vs.push(v); viewsSave(pt, vs);
    curView=v.id; lsSet('wl_life_curview', curView);
    if(typeof toast==='function') toast('👁 "'+nm+'" 보기를 저장했어요');
    safeRender();
    });
  }
  function viewMgr(pt){
    var vs=viewsOf(pt);
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9750';
    ov.innerHTML='<div class="lf-mod" style="max-width:600px">'
      + '<div class="lf-mh"><b>⋯ 저장된 보기 관리</b>'
      +   '<button type="button" id="lfVX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<table class="lf-tbl"><tr><th>이름</th><th style="width:170px">조건</th><th style="width:150px"></th></tr>'
      + (vs.length? vs.map(function(v){
          var n=(v.flt&&v.flt.rules?v.flt.rules.length:0);
          var per=[]; if(v.flt&&(v.flt.from||v.flt.to)) per.push('기간');
          if(v.flt&&v.flt.money) per.push('금액만'); if(n) per.push('조건 '+n+'개');
          return '<tr><td><b>'+esc(v.name)+'</b></td>'
            + '<td style="color:#8ba0b6;font-size:12px">'+(per.join(' · ')||'없음')+'</td>'
            + '<td class="r"><button type="button" class="lf-fx" data-vfav="'+esc(v.id)+'"'
            +   (v.fav? ' style="color:#f59e0b;font-weight:900"':'') + ' title="켜 두면 이 화면을 열 때 이 보기로 시작합니다">'
            +   (v.fav? '⭐ 첫 화면':'☆ 첫 화면') + '</button> '
            + '<button type="button" class="lf-fx" data-vren="'+esc(v.id)+'">✏️ 이름</button> '
            + '<button type="button" class="lf-fx" data-vdel="'+esc(v.id)+'" style="color:#b52929">🗑</button></td></tr>'; }).join('')
        : '<tr><td colspan="3" style="text-align:center;color:#a8b8c8;padding:26px">저장된 보기가 없어요</td></tr>')
      + '</table>'
      + '<div class="lf-mbtn"><div style="flex:1"></div>'
      +   '<button type="button" id="lfVC" style="height:42px;padding:0 20px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfVX').addEventListener('click', cl);
    document.getElementById('lfVC').addEventListener('click', function(){ cl(); safeRender(); });
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    ov.querySelectorAll('[data-vren]').forEach(function(b){
      b.addEventListener('click', function(){
        var id=b.getAttribute('data-vren'), a=viewsOf(pt);
        var hit=a.filter(function(x){return x.id===id;})[0];
        askText('보기 이름 바꾸기', hit?hit.name:'', { ph:'새 이름', ok:'저장' }).then(function(nm){
          if(nm===null) return; nm=String(nm).trim(); if(!nm) return;
          a.forEach(function(x){ if(x.id===id) x.name=nm; }); viewsSave(pt,a); cl(); viewMgr(pt);
        }); }); });
    ov.querySelectorAll('[data-vdel]').forEach(function(b){
      b.addEventListener('click', function(){
        askDel('이 보기를 지울까요?', '기록은 안 지워집니다').then(function(ok){
          if(!ok) return;
          var id=b.getAttribute('data-vdel');
          viewsSave(pt, viewsOf(pt).filter(function(x){ return x.id!==id; }));
          if(curView===id){ curView=''; lsSet('wl_life_curview',''); }
          cl(); viewMgr(pt);
        }); }); });
    /* ⭐ 첫 화면 — 이 화면을 열 때 자동으로 걸리는 보기 (한 화면에 하나) */
    ov.querySelectorAll('[data-vfav]').forEach(function(b){
      b.addEventListener('click', function(){
        var id=b.getAttribute('data-vfav'), a=viewsOf(pt);
        var was=a.filter(function(x){return x.id===id;})[0];
        var on = !(was && was.fav);
        a.forEach(function(x){ x.fav = (on && x.id===id); });
        viewsSave(pt,a);
        if(typeof toast==='function') toast(on? '⭐ 이 화면을 열면 이 보기로 시작해요' : '☆ 첫 화면 지정을 껐어요');
        cl(); viewMgr(pt); }); });
  }
  /* 이 화면(데이터셋)의 첫 화면 보기 */
  function favView(pt){
    var a=viewsOf(pt);
    for(var i=0;i<a.length;i++) if(a[i] && a[i].fav) return a[i];
    return null;
  }
  /* 화면을 새로 열 때 첫 화면 보기를 걸어준다 */
  function applyFav(pt){
    var v=favView(pt);
    if(!v) return false;
    if(curView===v.id) return false;
    try{
      if(v.cols) colsSave(v.scope||'', v.cols);
      if(v.srt){ srt={k:v.srt.k, d:v.srt.d}; lsSet(LS_SORT,srt); }
      if(v.flt){ flt=JSON.parse(JSON.stringify(v.flt)); if(!Array.isArray(flt.rules)) flt.rules=[]; lsSet(LS_FLT,flt); }
      if(v.vw && VWS.indexOf(v.vw)>=0){ vw=v.vw; lsSet(LS_VIEW,vw); }
      curQ = v.q || '';
      curView = v.id; lsSet('wl_life_curview', curView);
      return true;
    }catch(e){ return false; }
  }

  /* ══════ 거꾸로 롤업 — 나를 가리키는 기록 찾기 ══════
     · 다른 종류에 만들어 둔 🔗 관계 칸
     · 원래부터 다른 기록을 가리키는 붙박이 칸 (재고의 품목 등) */
  var REV_BUILTIN = [
    { src:'stock', pid:'f:itemId', label:'📊 재고 · 품목' }
  ];
  function revCands(){
    var out = [];
    REV_BUILTIN.forEach(function(b){ out.push({ v:'rev|'+b.src+'|'+b.pid, label:b.label }); });
    try{
      var all = customAll();
      Object.keys(all).forEach(function(k){
        (all[k]||[]).forEach(function(x){
          if(!x || x.type!=='rel' || x.archived) return;
          /* 저장키 모양: 'work:종류:_all' 또는 '_all' (개인) */
          var src='', m=String(k).match(/^work:([a-z]+):/);
          if(m) src=m[1];
          var nm = src && typeof WORK_KINDS!=='undefined' && WORK_KINDS[src]
                 ? (WORK_KINDS[src].i+' '+WORK_KINDS[src].n) : '🏠 개인';
          out.push({ v:'rev|'+(src||'personal')+'|'+x.id, label:nm+' · '+x.name });
        });
      });
    }catch(e){}
    return out;
  }
  /* rev 값 풀기 → {src, pid} */
  function revParse(v){
    var a=String(v||'').split('|');
    return (a[0]==='rev') ? { src:a[1]||'', pid:a[2]||'' } : null;
  }

  /* ══════ 속성 추가 ══════ */
  function propAdd(pt, after){
    var TYPES=[['text','글자'],['area','긴 글'],['num','숫자'],['date','날짜'],['time','시간'],
               ['sel','선택'],['check','체크'],['tel','전화번호'],['map','주소'],['star','별점'],['link','링크'],
               ['multi','다중 선택 — 태그 여러 개'],
               ['rel','관계 — 다른 기록 연결'],['formula','수식 — 자동 계산'],
               ['rollup','롤업 — 연결된 것들 합계'],
               ['head','구분 제목 — 값 없이 제목만 (예: 계약 정보)'],
               ['desc','설명 문구 — 값 없이 안내만']];
    var RU_REL = propsOf(pt).filter(function(x){ return x.type==='rel'; })
      .map(function(x){ return '<option value="'+esc(x.id)+'">🔗 '+esc(x.name)+'</option>'; }).join('');
    if(!RU_REL) RU_REL='<option value="">(관계 속성이 없어요)</option>';
    var RU_REV = revCands().map(function(c){
      return '<option value="'+esc(c.v)+'">'+esc(c.label)+'</option>'; }).join('');
    if(!RU_REV) RU_REV='<option value="">(거꾸로 볼 연결이 없어요)</option>';
    var RU_TGT = propsOf(pt).filter(function(x){
        return ['num','rate','formula'].indexOf(x.type)>=0 || x.id==='_amount'; })
      .map(function(x){ return '<option value="'+esc(x.id)+'">'+tinfo(x.type).i+' '+esc(x.name)+'</option>'; }).join('');
    /* 연결 대상이 다른 종류일 수 있으니 공통칸(금액·첨부)은 늘 고를 수 있게 */
    if(RU_TGT.indexOf('value="_amount"')<0) RU_TGT = '<option value="_amount">🔢 금액</option>' + RU_TGT;
    if(!RU_TGT) RU_TGT='<option value="_amount">🔢 금액</option>';
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9800';
    ov.innerHTML='<div class="lf-mod" style="max-width:520px">'
      + '<div class="lf-mh"><b>＋ 속성 추가</b>'
      +   '<button type="button" id="lfAX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div class="lf-mf" style="grid-template-columns:1fr">'
      +   '<div class="lf-f"><label>이름 <i>*</i></label><input type="text" id="lfPName" placeholder="예: 계약면적(평)"></div>'
      +   '<div class="lf-f"><label>종류</label><select id="lfPType">'
      +     TYPES.map(function(t){ return '<option value="'+t[0]+'">'+tinfo(t[0]).i+' '+t[1]+'</option>'; }).join('')
      +   '</select></div>'
      +   '<div class="lf-f" id="lfPOptWrap" style="display:none"><label>고를 값 (쉼표로 구분)</label>'
      +     '<input type="text" id="lfPOpts" placeholder="계약중, 만료, 해지"></div>'
      +   '<div class="lf-f" id="lfPRelWrap" style="display:none"><label>무엇과 연결할까요</label>'
      +     '<select id="lfPRel">'
      +     (isPersonal()
          ? ('<option value="pcontact">📞 개인 연락처</option>'
             + '<option value="personal">🏠 개인 기록 전체</option>'
             + Object.keys(cats()).map(function(k){ return '<option value="'+k+'">'+cats()[k].i+' '+cats()[k].n+'</option>'; }).join('')
             + '<option value="car">🚗 차계부</option>')
          : '')
      +     '<optgroup label="📊 업무일지">'
      +       '<option value="w:*">📊 업무일지 전체</option>'
      +       relWorkOpts()
      +     '</optgroup>'
      +     (isPersonal() ? '' :
            ('<optgroup label="🏠 개인일지">'
             + '<option value="pcontact">📞 개인 연락처</option>'
             + '<option value="personal">🏠 개인 기록 전체</option>'
             + '</optgroup>'))
      +     '</select></div>'
      +   '<div class="lf-f" id="lfPFxWrap" style="display:none"><label>계산식</label>'
      +     '<input type="text" id="lfPFx" placeholder="{단가} * {개수}">'
      +     '<div style="font-size:11.5px;color:#8ba0b6;line-height:1.6;margin-top:4px">'
      +       '중괄호 안에 <b>칸 이름</b>을 그대로 쓰세요.<br>'
      +       '· <code>{단가} * {개수}</code><br>'
      +       '· <code>{최종 금액} - {초기 견적비}</code><br>'
      +       '· <code>DAYS({도착일}, {출발일})</code> — 며칠 차이</div></div>'
      +   '<div class="lf-f" id="lfPRuWrap" style="display:none">'
      +     '<label>방향</label>'
      +     '<select id="lfPRuDir"><option value="fwd">내가 연결한 것들</option>'
      +       '<option value="rev">나를 가리키는 것들 (거꾸로)</option></select>'
      +     '<div id="lfPRuFwd">'
      +       '<label style="margin-top:8px">어느 관계 칸을 따라갈까요</label>'
      +       '<select id="lfPRuRel">' + RU_REL + '</select>'
      +     '</div>'
      +     '<div id="lfPRuRev" style="display:none">'
      +       '<label style="margin-top:8px">어느 연결로 나를 가리키나요</label>'
      +       '<select id="lfPRuRev2">' + RU_REV + '</select>'
      +     '</div>'
      +     '<label style="margin-top:8px">그쪽의 어느 칸을</label>'
      +     '<select id="lfPRuTgt">' + RU_TGT + '</select>'
      +     '<label style="margin-top:8px">어떻게</label>'
      +     '<select id="lfPRuAgg"><option value="sum">합계</option><option value="count">개수</option>'
      +       '<option value="list">목록 — 이름을 그대로 보여주기</option>'
      +       '<option value="avg">평균</option><option value="max">가장 큰 값</option><option value="min">가장 작은 값</option></select>'
      +     '<label style="margin-top:8px">조건 (선택) — 이 값일 때만 셈</label>'
      +     '<div style="display:flex;gap:6px">'
      +       '<select id="lfPRuWP" style="flex:1"><option value="">— 조건 없음 —</option></select>'
      +       '<input type="text" id="lfPRuWV" placeholder="예: 입고" style="flex:1">'
      +     '</div>'
      +     '<div style="font-size:11.5px;color:#8ba0b6;line-height:1.6;margin-top:5px">'
      +       '예) 품목에서 <b>재고 · 품목</b> 을 거꾸로 보고, <b>수량</b> 을 <b>합계</b>,<br>'
      +       '조건에 <b>구분 = 입고</b> 를 넣으면 <b>총 입고 수량</b> 이 됩니다.</div>'
      +   '</div>'
      +   '<div class="lf-f" id="lfPUnitWrap" style="display:none"><label>단위 (선택)</label>'
      +     '<input type="text" id="lfPUnit" placeholder="원 / 일 / 개"></div>'
      +   '<div class="lf-f"><label>어디에 붙일까요</label><select id="lfPScope">'
      +     (isPersonal()
          ? ('<option value="_all">모든 개인 기록에</option>'
             + (pt? '<option value="'+esc(pt)+'" selected>'+esc((cats()[pt]&&cats()[pt].n)||'차계부')+' 에만</option>':''))
          : ('<option value="_all">'+esc(DS.icon+' '+DS.name)+' 전체에</option>'))
      +   '</select></div>'
      + '</div>'
      + '<div style="font-size:12px;color:#8ba0b6;margin-top:9px;line-height:1.6">'
      +   '추가하면 <b>입력 모달·목록 칸·필터</b> 에 자동으로 나타납니다.<br>'
      +   '나중에 이름을 바꿔도 이미 넣은 값은 그대로 남아요.</div>'
      + '<div class="lf-mbtn"><div style="flex:1"></div>'
      +   '<button type="button" id="lfAC" style="height:44px;padding:0 18px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">취소</button>'
      +   '<button type="button" id="lfAOk" style="height:44px;padding:0 24px;border:none;border-radius:10px;background:#2563a8;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">＋ 추가</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfAX').addEventListener('click', cl);
    document.getElementById('lfAC').addEventListener('click', cl);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    var ts=document.getElementById('lfPType');
    function syncType(){
      document.getElementById('lfPOptWrap').style.display  = (ts.value==='sel'||ts.value==='multi') ? '' : 'none';
      document.getElementById('lfPRuWrap').style.display   = (ts.value==='rollup')  ? '' : 'none';
      document.getElementById('lfPRelWrap').style.display  = (ts.value==='rel')     ? '' : 'none';
      document.getElementById('lfPFxWrap').style.display   = (ts.value==='formula') ? '' : 'none';
      document.getElementById('lfPUnitWrap').style.display =
        (ts.value==='formula'||ts.value==='num'||ts.value==='rollup') ? '' : 'none';
    }
    ts.addEventListener('change', syncType); syncType();

    /* 롤업 — 방향에 따라 고를 것이 달라진다 */
    var ruDir=document.getElementById('lfPRuDir');
    var ruRev=document.getElementById('lfPRuRev2');
    var ruWP =document.getElementById('lfPRuWP');
    var ruTgt=document.getElementById('lfPRuTgt');
    function ruSrcKind(){
      if(ruDir.value!=='rev') return null;
      var r=revParse(ruRev.value); return r ? r.src : null;
    }
    function ruFill(){
      var isRev = (ruDir.value==='rev');
      document.getElementById('lfPRuFwd').style.display = isRev ? 'none' : '';
      document.getElementById('lfPRuRev').style.display = isRev ? '' : 'none';
      var k=ruSrcKind();
      /* 거꾸로일 땐 그쪽 종류의 칸 목록으로 채운다 */
      if(k && k!=='personal'){
        var d=dsWorkC(k);
        if(d){
          var old=DS; DS=d;
          try{
            var ps=propsOf(k);
            ruTgt.innerHTML = ps.filter(function(x){
                return ['num','rate','formula'].indexOf(x.type)>=0 || x.id==='_amount'; })
              .map(function(x){ return '<option value="'+esc(x.id)+'">'+tinfo(x.type).i+' '+esc(x.name)+'</option>'; }).join('')
              || '<option value="_amount">🔢 금액</option>';
            ruWP.innerHTML = '<option value="">— 조건 없음 —</option>'
              + ps.filter(function(x){ return ['sel','text','tag','check','multi'].indexOf(x.type)>=0; })
                  .map(function(x){ return '<option value="'+esc(x.id)+'">'+tinfo(x.type).i+' '+esc(x.name)+'</option>'; }).join('');
          } finally { DS=old; }
          return;
        }
      }
      ruTgt.innerHTML = RU_TGT;
      ruWP.innerHTML = '<option value="">— 조건 없음 —</option>'
        + propsOf(pt).filter(function(x){ return ['sel','text','tag','check','multi'].indexOf(x.type)>=0; })
            .map(function(x){ return '<option value="'+esc(x.id)+'">'+tinfo(x.type).i+' '+esc(x.name)+'</option>'; }).join('');
    }
    ruDir.addEventListener('change', ruFill);
    ruRev.addEventListener('change', ruFill);
    ruFill();

    document.getElementById('lfAOk').addEventListener('click', function(){
      var nm=(document.getElementById('lfPName').value||'').trim();
      if(!nm){ askInfo('이름을 넣어주세요'); return; }
      var ty=ts.value, sc=document.getElementById('lfPScope').value;
      var p={ id:'c'+Date.now()+Math.floor(Math.random()*1000), name:nm, type:ty,
              order:Date.now(), archived:false };
      if(ty==='multi'){
        p.o=(document.getElementById('lfPOpts').value||'').split(',')
          .map(function(x){ return x.trim(); }).filter(Boolean);
        if(!p.o.length){ askInfo('고를 값을 쉼표로 넣어주세요\n예) 현장용, 소모품, 급함'); return; }
        p.colors={}; var CK=['blue','green','orange','purple','pink','yellow','red','gray'];
        p.o.forEach(function(x,i){ p.colors[x]=CK[i%CK.length]; });
      }
      if(ty==='rollup'){
        p.dir = document.getElementById('lfPRuDir').value;
        if(p.dir==='rev'){
          var rv=revParse(document.getElementById('lfPRuRev2').value);
          if(!rv){ askInfo('거꾸로 볼 연결을 골라 주세요'); return; }
          p.revSrc = rv.src; p.relPid = rv.pid;
        } else {
          var rr=document.getElementById('lfPRuRel');
          if(!rr || !rr.value){ askInfo('먼저 🔗 관계 속성을 하나 만들어 주세요'); return; }
          p.relPid = rr.value;
        }
        p.tgtPid = document.getElementById('lfPRuTgt').value;
        p.agg    = document.getElementById('lfPRuAgg').value;
        var wp=document.getElementById('lfPRuWP').value;
        var wv=(document.getElementById('lfPRuWV').value||'').trim();
        if(wp && wv){ p.wPid=wp; p.wVal=wv; }
      }
      if(ty==='sel'){
        p.o=(document.getElementById('lfPOpts').value||'').split(',')
          .map(function(x){ return x.trim(); }).filter(Boolean);
        if(!p.o.length) p.o=[''];
        else p.o.unshift('');
      }
      if(ty==='rel') p.target = document.getElementById('lfPRel').value;
      if(ty==='formula'){
        p.expr = (document.getElementById('lfPFx').value||'').trim();
        if(!p.expr){ askInfo('계산식을 넣어주세요\n예) {단가} * {개수}'); return; }
      }
      var uv=(document.getElementById('lfPUnit')||{}).value;
      if(uv && uv.trim()) p.unit = uv.trim();
      customAdd(sc, p);
      /* 새로 만든 것은 바로 목록에도 보이게 */
      var a=colsOf(sc==='_all'?pt:sc); if(a.indexOf(p.id)<0){ a.push(p.id); colsSave(sc==='_all'?pt:sc, a); }
      cl();
      if(typeof toast==='function') toast('＋ "'+nm+'" 속성을 만들었어요');
      if(after) after(p); else safeRender();
    });
    setTimeout(function(){ var n=document.getElementById('lfPName'); if(n) n.focus(); },120);
  }

  /* ══════ 내 속성 관리 (이름 · 선택지 · 순서 · 삭제 · 되살리기) ══════ */

  /* 이 값을 실제로 쓰고 있는 기록이 몇 건인지 — 지우기 전에 알려주려고 센다 */
  function countPropVal(pid, val){
    var n=0;
    try{
      var arr = (typeof entries!=='undefined' && entries) ? entries : (window.entries||[]);
      for(var i=0;i<arr.length;i++){
        var pv=(arr[i]&&arr[i].props)||{}, v=pv[pid];
        if(Array.isArray(v)){ if(v.indexOf(val)>=0) n++; }
        else if(v!=null && v!=='' && String(v)===String(val)) n++;
      }
    }catch(e){}
    return n;
  }

  /* 속성 순서 바꾸기 — 저장된 배열 순서를 그대로 옮긴다 */
  function propMove(scope, id, dir){
    var a=customOf(scope), i=-1;
    for(var k=0;k<a.length;k++) if(a[k].id===id){ i=k; break; }
    if(i<0) return false;
    var j=i+dir; if(j<0||j>=a.length) return false;
    var t=a[i]; a[i]=a[j]; a[j]=t;
    customSave(scope,a); return true;
  }

  /* 선택 · 다중 선택의 「고를 값」 편집 */
  function propOpts(scope, id, back){
    var p=(customOf(scope)||[]).filter(function(x){return x.id===id;})[0];
    if(!p) return;
    var list=(p.o||p.opts||[]).slice();

    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9850';
    function cl(){ ov.remove(); }
    function draw(){
      ov.innerHTML='<div class="lf-mod" style="max-width:520px">'
        + '<div class="lf-mh"><b>🏷 고를 값 — '+esc(p.name)+'</b>'
        +   '<button type="button" id="lfOX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
        + '<div style="font-size:12.5px;color:#7a92a8;line-height:1.6;margin-bottom:8px">'
        +   '값을 고치면 <b>이미 그 값을 쓰던 기록도 함께 바뀝니다.</b> 지울 때는 몇 건이 쓰는지 먼저 알려드려요.</div>'
        + '<div style="max-height:46vh;overflow:auto">'
        + (list.length
            ? list.map(function(v,i){
                var used=countPropVal(id, v);
                return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
                  + '<input type="text" data-ov="'+i+'" value="'+esc(v)+'" style="flex:1;height:40px;padding:0 10px;border:1.5px solid #dbe6f4;border-radius:9px;font-family:inherit;font-size:13.5px">'
                  + '<span style="flex:0 0 auto;font-size:11.5px;color:'+(used?'#0f7a4a':'#a8b8c8')+';min-width:44px;text-align:right">'+(used?used+'건':'—')+'</span>'
                  + '<button type="button" data-oup="'+i+'" title="위로" style="width:36px;height:40px;border:1.5px solid #dbe6f4;border-radius:9px;background:#fff;cursor:pointer;font-size:13px">▲</button>'
                  + '<button type="button" data-odn="'+i+'" title="아래로" style="width:36px;height:40px;border:1.5px solid #dbe6f4;border-radius:9px;background:#fff;cursor:pointer;font-size:13px">▼</button>'
                  + '<button type="button" data-odel="'+i+'" title="지우기" style="width:40px;height:40px;border:1.5px solid #fbdcd8;border-radius:9px;background:#fff;color:#b52929;cursor:pointer;font-size:13px">🗑</button>'
                  + '</div>'; }).join('')
            : '<div style="text-align:center;color:#a8b8c8;padding:26px">아직 고를 값이 없어요</div>')
        + '</div>'
        + '<div class="lf-mbtn">'
        +   '<button type="button" id="lfOAdd" class="lf-radd" style="height:42px">＋ 값 추가</button>'
        +   '<div style="flex:1"></div>'
        +   '<button type="button" id="lfOC" style="height:42px;padding:0 18px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">취소</button>'
        +   '<button type="button" id="lfOS" style="height:42px;padding:0 22px;border:none;border-radius:10px;background:#3f7cb8;color:#fff;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit;margin-left:8px">저장</button>'
        + '</div></div>';

      function sync(){ ov.querySelectorAll('[data-ov]').forEach(function(el){ list[+el.getAttribute('data-ov')]=el.value; }); }
      ov.querySelector('#lfOX').addEventListener('click', cl);
      ov.querySelector('#lfOC').addEventListener('click', cl);
      ov.querySelector('#lfOAdd').addEventListener('click', function(){ sync(); list.push(''); draw(); });
      ov.querySelectorAll('[data-oup]').forEach(function(b){ b.addEventListener('click', function(){
        sync(); var i=+b.getAttribute('data-oup'); if(i<=0) return;
        var t=list[i-1]; list[i-1]=list[i]; list[i]=t; draw(); }); });
      ov.querySelectorAll('[data-odn]').forEach(function(b){ b.addEventListener('click', function(){
        sync(); var i=+b.getAttribute('data-odn'); if(i>=list.length-1) return;
        var t=list[i+1]; list[i+1]=list[i]; list[i]=t; draw(); }); });
      ov.querySelectorAll('[data-odel]').forEach(function(b){ b.addEventListener('click', function(){
        sync(); var i=+b.getAttribute('data-odel'); var v=list[i]; var used=countPropVal(id, v);
        if(used && !confirm('「'+v+'」 을(를) 목록에서 뺍니다.\n\n이 값을 쓰는 기록이 '+used+'건 있습니다.\n기록의 값은 그대로 남지만 목록에서는 더 고를 수 없게 됩니다.\n\n계속할까요?')) return;
        list.splice(i,1); draw(); }); });
      ov.querySelector('#lfOS').addEventListener('click', function(){
        sync();
        var out=[], seen={};
        for(var i=0;i<list.length;i++){
          var v=String(list[i]||'').trim();
          if(!v || seen[v]) continue;
          seen[v]=1; out.push(v);
        }
        customPatch(scope, id, {o:out, opts:out});
        cl(); if(back) back();
      });
    }
    draw();
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
  }

  function propMgr(pt){
    function rows(scope, label){
      var a=customOf(scope)||[];
      if(!a.length) return '';
      return '<div style="font-size:11.5px;font-weight:900;color:#8ba0b6;margin:12px 0 6px">'+label+'</div>'
        + '<table class="lf-tbl"><tr><th>이름</th><th style="width:92px">종류</th><th style="width:78px">순서</th><th style="width:190px"></th></tr>'
        + a.map(function(p,i){
            var canOpt = (p.type==='sel'||p.type==='multi');
            return '<tr'+(p.archived?' style="opacity:.5"':'')+'>'
              + '<td>'+tinfo(p.type).i+' '+esc(p.name)+(p.archived?' <span style="color:#b52929;font-size:11px">(지움)</span>':'')+'</td>'
              + '<td style="color:#8ba0b6">'+esc(tname(p.type))+'</td>'
              + '<td class="r" style="white-space:nowrap">'
              +   (i>0 ? '<button type="button" class="lf-fx" data-pup="'+esc(scope)+'|'+esc(p.id)+'" title="위로">▲</button>' : '<span style="display:inline-block;width:26px"></span>')
              +   (i<a.length-1 ? '<button type="button" class="lf-fx" data-pdn="'+esc(scope)+'|'+esc(p.id)+'" title="아래로">▼</button>' : '')
              + '</td>'
              + '<td class="r" style="white-space:nowrap">'
              +   (canOpt ? '<button type="button" class="lf-fx" data-popt="'+esc(scope)+'|'+esc(p.id)+'" style="color:#7c3aed">🏷 값</button> ' : '')
              +   '<button type="button" class="lf-fx" data-pren="'+esc(scope)+'|'+esc(p.id)+'">✏️ 이름</button> '
              +   (p.archived
                    ? '<button type="button" class="lf-fx" data-pres="'+esc(scope)+'|'+esc(p.id)+'" style="color:#0f7a4a">↩ 되살리기</button>'
                    : '<button type="button" class="lf-fx" data-pdel="'+esc(scope)+'|'+esc(p.id)+'" style="color:#b52929">🗑 지우기</button>')
              + '</td></tr>'; }).join('')
        + '</table>';
    }
    function tname(t){
      var M={text:'글자',area:'긴 글',num:'숫자',date:'날짜',time:'시간',sel:'선택',check:'체크',
             tel:'전화번호',map:'주소',star:'별점',link:'링크',multi:'다중 선택',rel:'관계',
             formula:'수식',rollup:'롤업',head:'구분 제목',desc:'설명 문구'};
      return M[t]||t;
    }
    var body = rows('_all','모든 기록에 붙은 속성') + (pt? rows(pt, ((cats()[pt]&&cats()[pt].n)||'차계부')+' 전용 속성'):'');
    if(!body) body='<div style="text-align:center;color:#a8b8c8;padding:34px">아직 만든 속성이 없어요<div style="font-size:12px;margin-top:6px">＋ 속성 추가 로 만들어보세요</div></div>';
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9800';
    ov.innerHTML='<div class="lf-mod" style="max-width:760px">'
      + '<div class="lf-mh"><b>⋯ 내 속성 관리</b>'
      +   '<button type="button" id="lfMX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div style="font-size:12.5px;color:#7a92a8;line-height:1.6">'
      +   '<b>▲▼</b> 로 순서를 바꾸면 데이터 화면과 입력창에 같은 순서로 나옵니다 · '
      +   '<b>🏷 값</b> 은 선택 속성의 고를 값을 고칩니다 · '
      +   '지워도 <b>값은 남아 있습니다</b> — 되살리면 그대로 다시 보여요.</div>'
      + '<div style="max-height:52vh;overflow:auto">'+body+'</div>'
      + '<div class="lf-mbtn">'
      +   '<button type="button" id="lfMAdd" class="lf-radd" style="height:42px">＋ 속성 추가</button>'
      +   '<div style="flex:1"></div>'
      +   '<button type="button" id="lfMC" style="height:42px;padding:0 20px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    function again(){ cl(); propMgr(pt); }
    document.getElementById('lfMX').addEventListener('click', cl);
    document.getElementById('lfMC').addEventListener('click', function(){ cl(); safeRender(); });
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    document.getElementById('lfMAdd').addEventListener('click', function(){ cl(); propAdd(pt); });
    function sp(v){ var i=v.indexOf('|'); return [v.slice(0,i), v.slice(i+1)]; }
    ov.querySelectorAll('[data-pup]').forEach(function(b){
      b.addEventListener('click', function(){ var x=sp(b.getAttribute('data-pup'));
        if(propMove(x[0], x[1], -1)) again(); }); });
    ov.querySelectorAll('[data-pdn]').forEach(function(b){
      b.addEventListener('click', function(){ var x=sp(b.getAttribute('data-pdn'));
        if(propMove(x[0], x[1], 1)) again(); }); });
    ov.querySelectorAll('[data-popt]').forEach(function(b){
      b.addEventListener('click', function(){ var x=sp(b.getAttribute('data-popt'));
        cl(); propOpts(x[0], x[1], function(){ propMgr(pt); }); }); });
    ov.querySelectorAll('[data-pren]').forEach(function(b){
      b.addEventListener('click', function(){
        var x=sp(b.getAttribute('data-pren'));
        var old=(customOf(x[0])||[]).filter(function(p){return p.id===x[1];})[0];
        askText('칸 이름 바꾸기', old?old.name:'', { ph:'새 이름', ok:'저장' }).then(function(nm){
          if(nm===null) return; nm=String(nm).trim(); if(!nm) return;
          customPatch(x[0], x[1], {name:nm}); again();
        }); }); });
    ov.querySelectorAll('[data-pdel]').forEach(function(b){
      b.addEventListener('click', function(){
        var x=sp(b.getAttribute('data-pdel'));
        if(!confirm('이 속성을 목록에서 뺄까요?\n넣어둔 값은 그대로 남고, 되살리면 다시 보입니다.')) return;
        customPatch(x[0], x[1], {archived:true}); again(); }); });
    ov.querySelectorAll('[data-pres]').forEach(function(b){
      b.addEventListener('click', function(){
        var x=sp(b.getAttribute('data-pres'));
        customPatch(x[0], x[1], {archived:false}); again(); }); });
  }

  /* ══════ 표에서 바로 고치기 ══════ */
  var EDIT=null;   /* {id, pid} */
  function editorHTML(p, v){
    var t=p.type;
    if(t==='area') return '<textarea class="lf-ie" rows="3">'+esc(v==null?'':v)+'</textarea>';
    if(t==='sel'){
      var o=(p.opts||p.o||['']).slice();
      if(o.indexOf('')<0) o=[''].concat(o);
      /* ★ v113 — 지금 저장된 값이 목록에 없으면 목록에 넣어 준다.
            업무 「지출종류」 기본값 '없음' 이 목록에 없어서, 칸을 열면 빈 칸으로 뜨고
            그냥 다른 데를 누르면 원래 값까지 지워졌다. (2026-08-29 실측)
            기본지침 「저장·수정·삭제 3원칙」 — 있는 값을 잃지 않는다. */
      var _cv = (v == null ? '' : String(v));
      if(_cv && o.indexOf(_cv) < 0){
        o = [''].concat([_cv]).concat(o.filter(function(x){ return x !== ''; }));
      }
      return '<select class="lf-ie">'+o.map(function(x){
        return '<option value="'+esc(x)+'"'+(String(v||'')===String(x)?' selected':'')+'>'+esc(x||'—')+'</option>'; }).join('')+'</select>';
    }
    if(t==='check') return '<input type="checkbox" class="lf-ie" style="width:18px;height:18px"'+(v?' checked':'')+'>';
    if(t==='star')  return '<select class="lf-ie">'+[0,1,2,3,4,5].map(function(n){
        return '<option value="'+n+'"'+(num(v)===n?' selected':'')+'>'+(n?stars(n):'—')+'</option>'; }).join('')+'</select>';
    if(t==='num'||t==='rate')
      return '<input type="text" class="lf-ie" data-num="1" value="'+esc(numFmt(v))+'">';
    if(t==='multi'){
      var opt=p.opts||p.o||[], sel=Array.isArray(v)?v:(v?String(v).split(','):[]);
      return '<div class="lf-multi" tabindex="0">' + opt.map(function(x){
        var on=sel.indexOf(x)>=0, c=colorOf((p.colors||{})[x]||'gray');
        return '<span class="lf-mt'+(on?' on':'')+'" data-mv="'+esc(x)+'"'
          + (on?' style="background:'+c.bg+';color:'+c.fg+';border-color:'+c.fg+'44"':'')+'>'+esc(x)+'</span>'; }).join('')
        + '<input type="hidden" class="lf-ie" value="'+esc(sel.join(','))+'"></div>';
    }
    if(t==='rollup') return '<span style="color:#8ba0b6;font-size:12px">연결된 것들로 자동 계산돼요</span>';
    if(t==='rel'){
      var ids=relArr(v), tg=relTargets(p);
      return '<select class="lf-ie"><option value="">—</option>'
        + tg.map(function(o){ return '<option value="'+esc(o.id)+'"'+(ids.indexOf(o.id)>=0?' selected':'')
            +'>'+esc(o.label)+'</option>'; }).join('') + '</select>';
    }
    if(t==='formula') return '<span style="color:#8ba0b6;font-size:12px">수식 칸은 자동 계산돼요</span>';
    if(t==='time') return '<input type="text" class="lf-ie" readonly value="'+esc(v==null?'':v)
      + '" data-tdial="lfIeTime" id="lfIeTime" style="cursor:pointer">';
    var ty = (t==='date'?'date':(t==='tel'?'tel':'text'));
    return '<input type="'+ty+'" class="lf-ie" value="'+esc(v==null?'':v)+'"'+(t==='time'?' step="300"':'')+'>';
  }
  function editCommit(pt, id, pid, el){
    var p=propById(pt,pid); if(!p) return;
    var v;
    if(p.type==='formula'||p.type==='rollup') return;    /* 자동 계산 — 못 고침 */
    if(p.type==='multi'){
      var raw=String(el.value||'');
      var arr=raw? raw.split(',').filter(Boolean) : [];
      var rec0 = ent().filter(function(x){ return x.id===id; })[0];
      if(rec0) pUpd(id, ppatch(rec0, pid, arr));
      if(typeof toast==='function') toast('고쳤어요');
      return;
    }
    if(p.type==='check') v = el.checked;
    else if(p.type==='num'||p.type==='rate'||p.type==='star') v = (numRaw(el.value)===''?'':num(numRaw(el.value)));
    else if(p.type==='rel') v = el.value ? [el.value] : [];
    else v = el.value;
    var rec = ent().filter(function(x){ return x.id===id; })[0];
    if(!rec) return;
    var patch = ppatch(rec, pid, v);
    if(pid==='_amount' && amountLocked(rec)){
      askInfo('이 금액은 항목 표에서 자동으로 계산돼요.\n항목을 고치려면 줄을 눌러 창을 열어주세요.');
      return;
    }
    pUpd(id, patch);
    if(typeof toast==='function') toast('고쳤어요');

    var K = p.k || String(pid).replace(/^f:/,'');

    /* ══ v241 ⑤ 공급가액 · 부가세를 고치면 합계를 저절로 맞춘다 ══
       달님 : 「공급가액 부가세 넣어도 합계가 안 나와」
       🔴 항목 표(자재·중식·폐기물)가 금액을 정하고 있으면 건드리지 않는다. */
    try{
      if(K==='supplyAmt' || K==='taxAmt'){
        var r2 = ent().filter(function(x){ return x.id===id; })[0];
        if(r2 && !amountLocked(r2)){
          var sup = num(r2.supplyAmt)||0, tax = num(r2.taxAmt)||0;
          if(sup || tax){
            var sum2 = sup + tax;
            if(num(r2.amount) !== sum2){
              pUpd(id, { amount: sum2 });
              if(typeof toast==='function') toast('🧮 합계 ' + numFmt(sum2) + '원');
              pgCellRefresh(pt, id, '_amount');
            }
          }
        }
      }
    }catch(e){ console.warn('[합계 자동]', e); }

    /* ══ v241 ① 업체를 넣으면 연락처에서 담당자 · 직책 · 전화를 가져온다 ══
       달님 : 「업체 넣어도 이름 전화 등등 정보가 안 나와」
       🔴 빈 칸만 채운다 — 이미 적어 둔 값은 절대 덮어쓰지 않는다. */
    try{
      /* 🔴 업체 칸은 BASE 의 「_sub」 하나가 workVendor·owner·vendor 를 함께 물고 있다
         (BMAP 참고). 그래서 pid 로도 잡아 준다 — 이걸 몰라 처음에 안 먹었다. */
      if((K==='vendor' || K==='workVendor' || pid==='_sub') && String(v||'').trim()){
        var nm2 = String(v).trim();
        var cs2 = [];
        try{ cs2 = (typeof contactsCache!=='undefined' && contactsCache) ? contactsCache : []; }catch(e0){}
        var hit2 = cs2.filter(function(c){ return c && String(c.name||'').trim()===nm2; })[0];
        if(hit2){
          var r3 = ent().filter(function(x){ return x.id===id; })[0];
          var map2 = { workContact: hit2.person, workRole: (hit2.role||hit2.position||hit2.title),
                       workPhone: hit2.phone };
          var pc2 = {}, cnt2 = 0;
          Object.keys(map2).forEach(function(k2){
            if(!map2[k2]) return;
            if(!propById(pt, 'f:'+k2)) return;                 /* 그 칸이 없는 종류면 건너뛴다 */
            var cur2 = r3 ? r3[k2] : '';
            if(cur2!=null && String(cur2).trim()!=='') return;  /* 이미 적혀 있으면 그대로 */
            pc2[k2] = map2[k2]; cnt2++;
          });
          if(cnt2){
            pUpd(id, pc2);
            try{ if(typeof window.wlAutoMark==='function') window.wlAutoMark(id, pc2); }catch(e1){}
            if(typeof toast==='function') toast('📇 ' + nm2 + ' — ' + cnt2 + '개 칸을 채웠어요');
            Object.keys(pc2).forEach(function(k3){ pgCellRefresh(pt, id, 'f:'+k3); });
          }
        } else if(cs2.length===0){
          try{ if(typeof loadContactsCache==='function') loadContactsCache(); }catch(e2){}
        }
      }
    }catch(e){ console.warn('[업체 자동채움]', e); }
  }

  /* v241 — 열려 있는 페이지의 칸 하나만 다시 그린다 (창 전체를 다시 열지 않는다) */
  function pgCellRefresh(pt, id, pid){
    try{
      var ov2 = document.getElementById('lfPageOv'); if(!ov2) return;
      var box2 = ov2.querySelector('[data-ppid="'+pid+'"]'); if(!box2) return;
      var p2 = propById(pt, pid); if(!p2) return;
      var r4 = ent().filter(function(x){ return x.id===id; })[0]; if(!r4) return;
      box2.innerHTML = cellHTML(r4, p2);
    }catch(e){ console.warn('[칸 다시 그리기]', e); }
  }

  /* ── 목록 정렬·필터 상태 ── */
  var LS_SORT='wl_life_sort', LS_FLT='wl_life_flt';
  var srt = (function(){ var v=lsGet(LS_SORT,null);
    return (v&&v.k)? v : {k:'date', d:-1}; })();
  var flt = (function(){ var v=lsGet(LS_FLT,null);
    v = (v&&typeof v==='object')? v : {from:'', to:'', money:false, min:''};
    if(!Array.isArray(v.rules)) v.rules=[];
    return v; })();
  /* 입력칸에 커서가 있는 채로 다시 그리면 blur 중에 DOM 이 사라져 오류가 난다.
     커서를 먼저 빼고, 다음 차례에 그린다. */
  function safeRender(){
    try{ var a=document.activeElement;
      var h=document.getElementById(HOST_ID);
      if(a && h && h.contains(a) && typeof a.blur==='function') a.blur();
    }catch(e){}
    setTimeout(render, 0);
  }
  function srtSet(k){
    if(srt.k===k) srt.d = -srt.d; else { srt.k=k; srt.d = (k==='title')?1:-1; }
    lsSet(LS_SORT,srt); safeRender();
  }
  function fltSet(p){ for(var k in p) flt[k]=p[k]; lsSet(LS_FLT,flt); safeRender(); }
  function fltOn(){
    var pt = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    return !!(flt.from||flt.to||flt.money||num(flt.min)||(flt.rules&&flt.rules.length)
              || colfCount(pt));
  }
  function ruleCheck(e, r, pt){
    var p = propById(pt, r.pid); if(!p) return true;
    var v = (p.type==='formula') ? formulaCalc(e, p.expr, e.ptype) : pget(e, r.pid);
    var f = OPS[r.op]; if(!f) return true;
    return !!f(v, r.val);
  }
  function applyFlt(a){
    var pt = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    a = applyColF(a, pt);                       /* 칸 이름에서 건 거르개 */
    return a.filter(function(e){
      if(EDIT && EDIT.id===e.id) return true;      /* 지금 쓰는 줄은 안 감춘다 */
      var d=String(e.date||'');
      if(flt.from && d < flt.from) return false;
      if(flt.to   && d > flt.to)   return false;
      var m=money(e);
      if(flt.money && !m) return false;
      if(num(flt.min) && m < num(flt.min)) return false;
      var rs=flt.rules||[];
      for(var i=0;i<rs.length;i++){ if(!ruleCheck(e, rs[i], pt)) return false; }
      return true;
    });
  }
  function applySrt(a){
    var k=srt.k, d=srt.d;
    if(k && k.slice(0,2)==='p:'){
      var pid=k.slice(2);
      return a.slice().sort(function(x,y){
        var vx=pget(x,pid), vy=pget(y,pid);
        var nx=num(vx), ny=num(vy);
        if(String(vx||'')!=='' && String(vy||'')!=='' && !isNaN(nx) && !isNaN(ny)
           && /^[0-9.\-]+$/.test(String(vx)) && /^[0-9.\-]+$/.test(String(vy))) return d*(nx-ny);
        return d * String(vx==null?'':vx).localeCompare(String(vy==null?'':vy),'ko');
      });
    }
    return a.slice().sort(function(x,y){
      var vx, vy;
      if(k==='amount'){ vx=money(x); vy=money(y); }
      else if(k==='title'){ vx=String(x.title||x.who||''); vy=String(y.title||y.who||'');
        return d * vx.localeCompare(vy,'ko'); }
      else if(k==='cat'){ vx=(x.ptype==='car'?('car:'+(x.car||'')):(x.ptype||'')); vy=(y.ptype==='car'?('car:'+(y.car||'')):(y.ptype||''));
        return d * vx.localeCompare(vy,'ko'); }
      else { vx=String(x.date||''); vy=String(y.date||'');
        if(vx===vy) return (y.createdAt||0)-(x.createdAt||0);
        return d * (vx<vy?-1:1); }
      if(vx===vy) return String(y.date||'').localeCompare(String(x.date||''));
      return d * (vx-vy);
    });
  }

  /* ══════════════════════════════════════════════════════════
     🔽 칸 거르개 — 목록의 칸 이름에서 바로 거른다
        · 날짜 칸  → [오늘][어제][2일전][3일전][이번주][이번달][지난달] + 직접 기간
        · 숫자 칸  → 최소 ~ 최대
        · 그 밖    → 값 목록에서 골라 담기 (건수까지 보여 준다)
        종류마다 따로 기억한다 — 업무에서 건 것이 지출에 따라붙지 않게.
     ══════════════════════════════════════════════════════════ */
  var LS_COLF='wl_life_colf';
  function colfAll(){ var o=lsGet(LS_COLF,null); return (o&&typeof o==='object')?o:{}; }
  function colfOf(pt){ var o=colfAll()[dsk(pt)]; return (o&&typeof o==='object')?o:{}; }
  function colfSave(pt, m){
    var o=colfAll();
    if(!m || !Object.keys(m).length) delete o[dsk(pt)]; else o[dsk(pt)]=m;
    lsSet(LS_COLF,o);
  }
  function colfSet(pt, pid, v){
    var m=colfOf(pt);
    if(!v) delete m[pid]; else m[pid]=v;
    colfSave(pt,m); safeRender();
  }
  function colfClear(pt){ colfSave(pt,null); safeRender(); }
  if(!window._lfCfBound){
    window._lfCfBound = true;
    document.addEventListener('mousedown', function(){ colfClose(); });
    document.addEventListener('keydown', function(ev){
      if(ev.key==='Escape' && document.getElementById('lfCfPop')){ ev.stopPropagation(); colfClose(); } }, true);
    window.addEventListener('resize', function(){ colfClose(); });
  }
  function colfCount(pt){ return Object.keys(colfOf(pt)).length; }

  /* 값 하나를 거르개가 읽는 글자로 */
  function colfVal(e, p, pt){
    var v = (p.type==='formula') ? formulaCalc(e,p.expr,e.ptype)
          : (p.type==='rollup')  ? rollupCalc(e,p,e.ptype)
          : pget(e, p.id);
    if(Array.isArray(v)) return v.map(function(x){ return String(x); });
    if(p.type==='check') return v? '☑ 예' : '☐ 아니오';
    if(p.id==='_cat'){
      var d=(cats()[e.ptype]||catEtc());
      return (e.ptype==='car') ? '🚗 차계부' : (d.i+' '+d.n);
    }
    return v==null? '' : String(v);
  }
  function colfKind(p){
    if(p.id==='_date' || p.type==='date') return 'date';
    if(p.type==='num' || p.type==='rate' || p.type==='formula' || p.id==='_amount') return 'num';
    return 'pick';
  }
  /* 날짜 빠른 고르기 → 실제 기간 */
  function colfRange(q){
    var t=today();
    /* v165 — 한국 시간대에서 하루 밀리던 것을 고침 (UTC 고정 연산 · 사고이력 ⑬) */
    function shift(n){ var q=t.slice(0,10).split('-');
      var d=new Date(Date.UTC(+q[0], +q[1]-1, +q[2]));
      d.setUTCDate(d.getUTCDate()+n);
      return d.toISOString().slice(0,10); }
    if(q==='d0')  return {from:t, to:t};
    if(q==='d1')  return {from:shift(-1), to:shift(-1)};
    if(q==='d2')  return {from:shift(-2), to:shift(-2)};
    if(q==='d3')  return {from:shift(-3), to:shift(-3)};
    if(q==='d7')  return {from:shift(-6), to:t};
    if(q==='m')   return {from:t.slice(0,7)+'-01', to:t};
    if(q==='pm'){
      var y=+t.slice(0,4), mo=+t.slice(5,7)-1;
      if(mo===0){ y--; mo=12; }
      var mm=String(mo).padStart(2,'0');
      var last=new Date(Date.UTC(mo===12?y:y, mo, 0)).getUTCDate();
      return {from:y+'-'+mm+'-01', to:y+'-'+mm+'-'+String(last).padStart(2,'0')};
    }
    if(q==='y')   return {from:t.slice(0,4)+'-01-01', to:t};
    return null;
  }
  var COLF_QUICK = [['d0','오늘'],['d1','어제'],['d2','2일전'],['d3','3일전'],
                    ['d7','이번 주'],['m','이번 달'],['pm','지난 달'],['y','올해']];

  /* 거르개를 실제로 적용한다 — 모든 보기(카드·목록·리스트·보드…)에 함께 걸린다 */
  function applyColF(a, pt, skipPid){
    var m=colfOf(pt);
    var keys=Object.keys(m).filter(function(k){ return k!==skipPid; });
    if(!keys.length) return a;
    return a.filter(function(e){
      if(EDIT && EDIT.id===e.id) return true;         /* 지금 쓰는 줄은 안 감춘다 */
      for(var i=0;i<keys.length;i++){
        var pid=keys[i], f=m[pid], p=propById(pt,pid);
        if(!p || !f) continue;
        var k=colfKind(p);
        if(k==='date'){
          var d=String(colfVal(e,p,pt)||'').slice(0,10);
          if(f.from && (!d || d<f.from)) return false;
          if(f.to   && (!d || d>f.to))   return false;
        } else if(k==='num'){
          var n=num(colfVal(e,p,pt));
          if(f.min!=='' && f.min!=null && n<num(f.min)) return false;
          if(f.max!=='' && f.max!=null && n>num(f.max)) return false;
        } else {
          var vs=colfVal(e,p,pt);
          if(!Array.isArray(vs)) vs=[vs];
          var want=f.vals||[];
          if(!want.length) continue;
          var hitAny=false;
          for(var j=0;j<vs.length;j++){ if(want.indexOf(String(vs[j]))>=0){ hitAny=true; break; } }
          if(!hitAny) return false;
        }
      }
      return true;
    });
  }

  /* 걸려 있는 거르개를 한눈에 — 어느 보기에서든 보인다 */
  function colfLabel(p, f){
    var k=colfKind(p);
    if(k==='date'){
      if(f.q){ var lb=''; COLF_QUICK.forEach(function(x){ if(x[0]===f.q) lb=x[1]; }); if(lb) return lb; }
      return (f.from||'처음') + ' ~ ' + (f.to||'끝');
    }
    if(k==='num') return (f.min===''||f.min==null?'':numFmt(f.min)) + ' ~ '
                       + (f.max===''||f.max==null?'':numFmt(f.max));
    var v=f.vals||[];
    return v.length<=2 ? v.join(', ') : (v[0]+' 외 '+(v.length-1)+'개');
  }
  function colfChips(pt){
    var m=colfOf(pt), keys=Object.keys(m);
    if(!keys.length) return '';
    var h='<span class="lf-fchips">';
    keys.forEach(function(pid){
      var p=propById(pt,pid); if(!p) return;
      h += '<span class="fc">'+tinfo(p.type).i+' <b>'+esc(p.name)+'</b> '
         + esc(colfLabel(p, m[pid]))
         + '<button type="button" data-cfdrop="'+esc(pid)+'" title="이 거르개 풀기">✕</button></span>';
    });
    h += '<button type="button" class="all" data-cfall="1">✕ 전부</button></span>';
    return h;
  }

  /* 어떤 칸으로 거를지 먼저 고르는 작은 차림표 (카드·리스트·보드용) */
  function colfPick(pt, anchor){
    colfClose();
    var ps = propsOf(pt).filter(function(p){
      return ['att','rows','rel'].indexOf(p.type)<0 && p.id!=='_title'; });
    var m = colfOf(pt);
    var pop=document.createElement('div');
    pop.className='lf-cfp'; pop.id='lfCfPop';
    pop.innerHTML = '<div class="hd">🔽 어느 칸으로 거를까요'
      + '<button type="button" class="x" data-cfx="1">✕</button></div>'
      + '<div class="bd">' + ps.map(function(p){
          return '<label class="it" data-pick="'+esc(p.id)+'">'
            + '<span style="width:16px;text-align:center">'+tinfo(p.type).i+'</span>'
            + '<span class="nm">'+esc(p.name)+'</span>'
            + (m[p.id]? '<span class="n" style="color:#2563a8">거르는 중</span>':'')
            + '</label>'; }).join('') + '</div>';
    document.body.appendChild(pop);
    var r=anchor.getBoundingClientRect(), w=pop.offsetWidth||272, hh=pop.offsetHeight||300;
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth-w-8))+'px';
    pop.style.top  = (r.bottom+6+hh > window.innerHeight)
      ? Math.max(8, window.innerHeight-hh-8)+'px' : (r.bottom+6)+'px';
    pop.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
    pop.querySelector('[data-cfx]').addEventListener('click', colfClose);
    pop.querySelectorAll('[data-pick]').forEach(function(el){
      el.addEventListener('click', function(){ colfOpen(el.getAttribute('data-pick'), pt, anchor); });
    });
  }

  /* ── 팝업 ── */
  function colfClose(){ var o=document.getElementById('lfCfPop'); if(o) o.remove(); }
  function colfOpen(pid, pt, anchor){
    colfClose();
    var p=propById(pt,pid); if(!p) return;
    var cur0 = colfOf(pt)[pid] || {};
    var k = colfKind(p);
    var pop=document.createElement('div');
    pop.className='lf-cfp'; pop.id='lfCfPop';

    var body='';
    if(k==='date'){
      body = '<div class="ch">'
        + COLF_QUICK.map(function(q){
            return '<button type="button" data-q="'+q[0]+'"'+(cur0.q===q[0]?' class="on"':'')+'>'+q[1]+'</button>'; }).join('')
        + '</div>'
        + '<div class="dt"><input type="date" id="cfF1" value="'+esc(cur0.from||'')+'">'
        + '<span style="color:#c8d4e0">~</span>'
        + '<input type="date" id="cfF2" value="'+esc(cur0.to||'')+'"></div>';
    } else if(k==='num'){
      body = '<div class="dt"><input type="number" id="cfN1" placeholder="최소" value="'+esc(cur0.min==null?'':cur0.min)+'">'
        + '<span style="color:#c8d4e0">~</span>'
        + '<input type="number" id="cfN2" placeholder="최대" value="'+esc(cur0.max==null?'':cur0.max)+'"></div>';
    } else {
      /* 지금 목록에 실제로 있는 값만 모은다 (건수까지) */
      var base = applyColF(baseList(pt), pt, pid);
      var cnt={}, order=[];
      base.forEach(function(e){
        var vs=colfVal(e,p,pt); if(!Array.isArray(vs)) vs=[vs];
        vs.forEach(function(v){ v=String(v==null?'':v);
          if(!(v in cnt)){ cnt[v]=0; order.push(v); } cnt[v]++; });
      });
      var ord=(p.opts||p.o||null);
      order.sort(function(a,b){
        if(ord){ var ia=ord.indexOf(a), ib=ord.indexOf(b);
          if(ia<0) ia=900; if(ib<0) ib=900; if(ia!==ib) return ia-ib; }
        if(a==='') return 1; if(b==='') return -1;
        var na=parseFloat(a), nb=parseFloat(b);
        if(!isNaN(na)&&!isNaN(nb)&&String(na)===a&&String(nb)===b) return nb-na;
        return String(a).localeCompare(String(b),'ko');
      });
      var sel=cur0.vals||[];
      body = '<input type="text" class="q" id="cfQ" placeholder="🔍 값 찾기">'
        + '<div class="ch"><button type="button" id="cfAll">전체 고르기</button>'
        + '<button type="button" id="cfNone">모두 풀기</button>'
        + '<span style="margin-left:auto;font-size:11px;color:#a8b8c8;align-self:center">'+order.length+'가지</span></div>'
        + '<div id="cfList">'
        + (order.length? order.map(function(v){
            return '<label class="it" data-v="'+esc(v)+'"><input type="checkbox"'+(sel.indexOf(v)>=0?' checked':'')+'>'
              + '<span class="nm">'+esc(v===''?'(비어있음)':v)+'</span>'
              + '<span class="n">'+cnt[v]+'</span></label>'; }).join('')
           : '<div style="padding:10px;color:#a8b8c8;font-size:12.5px">고를 값이 없어요</div>')
        + '</div>';
    }

    pop.innerHTML = '<div class="hd">'+tinfo(p.type).i+' '+esc(p.name)+' 거르기'
      + '<button type="button" class="x" data-cfx="1">✕</button></div>'
      + '<div class="bd">'+body+'</div>'
      + '<div class="ft"><button type="button" data-cfoff="1">거르개 풀기</button>'
      + '<button type="button" class="go" data-cfgo="1">적용</button></div>';
    document.body.appendChild(pop);

    /* 자리 잡기 */
    var r = anchor.getBoundingClientRect();
    var w = pop.offsetWidth || 272, hh = pop.offsetHeight || 300;
    pop.style.left = Math.max(8, Math.min(r.left-8, window.innerWidth-w-8))+'px';
    pop.style.top  = (r.bottom+6+hh > window.innerHeight)
      ? Math.max(8, r.top-hh-6)+'px' : (r.bottom+6)+'px';

    /* 배선 */
    pop.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
    pop.querySelector('[data-cfx]').addEventListener('click', colfClose);
    pop.querySelector('[data-cfoff]').addEventListener('click', function(){
      colfClose(); colfSet(pt, pid, null); });

    if(k==='date'){
      pop.querySelectorAll('[data-q]').forEach(function(b){
        b.addEventListener('click', function(){
          var q=b.getAttribute('data-q');
          var on=b.classList.contains('on');
          pop.querySelectorAll('[data-q]').forEach(function(x){ x.classList.remove('on'); });
          if(on){ document.getElementById('cfF1').value=''; document.getElementById('cfF2').value=''; return; }
          b.classList.add('on');
          var rg=colfRange(q)||{from:'',to:''};
          document.getElementById('cfF1').value=rg.from;
          document.getElementById('cfF2').value=rg.to;
        });
      });
    }
    var ca=pop.querySelector('#cfAll'), cn=pop.querySelector('#cfNone');
    function setAll(v){
      pop.querySelectorAll('#cfList .it').forEach(function(it){
        if(it.style.display==='none') return;          /* 찾기로 걸러진 건 그대로 */
        it.querySelector('input').checked=v; });
    }
    if(ca) ca.addEventListener('click', function(){ setAll(true); });
    if(cn) cn.addEventListener('click', function(){ setAll(false); });
    var q0=pop.querySelector('#cfQ');
    if(q0) q0.addEventListener('input', function(){
      var t=q0.value.trim();
      pop.querySelectorAll('#cfList .it').forEach(function(it){
        it.style.display = (!t || it.getAttribute('data-v').indexOf(t)>=0) ? '' : 'none'; });
    });

    pop.querySelector('[data-cfgo]').addEventListener('click', function(){
      var v=null;
      if(k==='date'){
        var f1=document.getElementById('cfF1').value, f2=document.getElementById('cfF2').value;
        var qs=(pop.querySelector('[data-q].on')||{}).getAttribute
             ? pop.querySelector('[data-q].on').getAttribute('data-q') : '';
        if(f1||f2) v={from:f1,to:f2,q:qs||''};
      } else if(k==='num'){
        var n1=document.getElementById('cfN1').value, n2=document.getElementById('cfN2').value;
        if(n1!==''||n2!=='') v={min:n1===''?null:n1, max:n2===''?null:n2};
      } else {
        var picked=[];
        pop.querySelectorAll('#cfList .it').forEach(function(it){
          if(it.querySelector('input').checked) picked.push(it.getAttribute('data-v')); });
        if(picked.length) v={vals:picked};
      }
      colfClose(); colfSet(pt, pid, v);
    });
    if(q0) setTimeout(function(){ try{ q0.focus(); }catch(e){} }, 40);
  }

  /* 거르개 걸기 전 원본 목록 — 팝업의 값·건수를 여기서 센다 */
  function baseList(pt){
    try{ return recs(pt || null); }catch(e){ return []; }
  }


  /* ── 저장된 보기(뷰) ── */
  var LS_VIEWS='wl_life_views';
  function viewsAll(){ var o=lsGet(LS_VIEWS,null); return (o&&typeof o==='object')?o:{}; }
  function viewsOf(pt){ var a=viewsAll()[dsk(pt)]; return Array.isArray(a)?a:[]; }
  function viewsSave(pt, arr){ var o=viewsAll(); o[dsk(pt)]=arr; lsSet(LS_VIEWS,o); }
  function viewApply(v){
    if(v.cols) colsSave(v.scope||'', v.cols);
    if(v.srt){ srt={k:v.srt.k, d:v.srt.d}; lsSet(LS_SORT,srt); }
    if(v.flt){ flt=JSON.parse(JSON.stringify(v.flt)); if(!Array.isArray(flt.rules)) flt.rules=[]; lsSet(LS_FLT,flt); }
    if(v.vw && VWS.indexOf(v.vw)>=0){ vw=v.vw; lsSet(LS_VIEW,vw); }
    curQ = v.q || '';
    curView = v.id; lsSet('wl_life_curview', curView);
    safeRender();
  }
  var curView = lsGet('wl_life_curview', '') || '';
  /* ── 조건(규칙) 줄 ── */
  function ruleBar(pt){
    var rs=flt.rules||[];
    if(!rs.length) return '';
    var h='<span class="lf-rchips">';
    rs.forEach(function(r,i){
      var p=propById(pt,r.pid);
      h+='<span class="lf-rule">'+tinfo(p?p.type:'text').i+' <b>'+esc(p?p.name:r.pid)+'</b> '
        + esc(r.op) + (opNeedsVal(r.op)? ' <b>'+esc(r.val)+'</b>':'')
        + '<button type="button" data-rdrop="'+i+'">✕</button></span>';
    });
    h+='<button type="button" class="lf-fx" data-rclr="1">조건 지우기</button>';
    return h+'</span>';
  }

  /* ── 도구 줄 — 한 줄로 끝낸다 ─────────────────────────────
     v163 정리 — 겹치던 버튼을 걷어냈다.
       · 「칸 거르기」는 목록 보기의 칸 이름 ▾ 와 완전히 겹쳐서 목록에서는 안 낸다
         (카드·리스트·보드에는 칸 이름이 없으므로 「🔽 조건 걸기」로 남긴다)
       · 「✕ 필터 풀기 N」 을 ⚙ 밖으로 꺼냈다 — 걸렸을 때만 빨갛게 나온다
       · 걸린 조건 칩은 줄에 늘어놓지 않고 그 버튼을 눌러 펼친다 */
  /* ── 📅 날짜 빠르게 고르기 (v165) — 기록 탭과 같은 칩 + 「N일 전」 칸 ───────
     칩은 기존 colfRange() 를 그대로 쓴다 (기록 탭과 계산이 어긋나지 않게). */
  var DAY_Q = [['d0','오늘'],['d1','어제'],['d2','2일전'],['d3','3일전'],
               ['d7','이번 주'],['m','이번 달'],['pm','지난 달']];
  function dayNow(){                    /* 지금 걸린 기간이 어느 칩인지 */
    if(!flt.from && !flt.to) return '';
    for(var i=0;i<DAY_Q.length;i++){
      var r=colfRange(DAY_Q[i][0]);
      if(r && r.from===flt.from && r.to===flt.to) return DAY_Q[i][0];
    }
    return '';
  }
  function dAgo(n){                     /* 오늘에서 n 일 전 — UTC 고정 (사고이력 ⑬) */
    var t=today(), p=t.slice(0,10).split('-');
    var d=new Date(Date.UTC(+p[0], +p[1]-1, +p[2]));
    d.setUTCDate(d.getUTCDate()-n);
    return d.toISOString().slice(0,10);
  }
  function dayAgoN(){                   /* 「N일 전」 칸에 되비쳐 줄 숫자 */
    if(!flt.from || flt.from!==flt.to) return '';
    var t=today(), p=t.slice(0,10).split('-'), q=String(flt.from).split('-');
    if(q.length<3) return '';
    var a=Date.UTC(+p[0],+p[1]-1,+p[2]), b=Date.UTC(+q[0],+q[1]-1,+q[2]);
    var n=Math.round((a-b)/86400000);
    return (n>=0 && n<=3650)? String(n) : '';
  }
  /* ── 📅 날짜 — 「N일 전」 칸 하나로 (v167에서 칩 줄을 없앴다) ───────────
     칩은 [기간 해제] 하나로 대신할 수 있어서 뺐다. 도구 줄 안에 한 덩이로 들어간다. */
  var LS_DRNG='wl_life_dayrange';
  function dayRange(){ return lsGet(LS_DRNG,'0')==='1'; }
  function dAgo(n){                     /* 오늘에서 n 일 전 — UTC 고정 (사고이력 ⑬) */
    var t=today(), p=t.slice(0,10).split('-');
    var d=new Date(Date.UTC(+p[0], +p[1]-1, +p[2]));
    d.setUTCDate(d.getUTCDate()-n);
    return d.toISOString().slice(0,10);
  }
  function dayAgoN(){                   /* 「N일 전」 칸에 되비쳐 줄 숫자 */
    if(!flt.from) return '';
    var t=today(), p=t.slice(0,10).split('-'), q=String(flt.from).split('-');
    if(q.length<3) return '';
    var a=Date.UTC(+p[0],+p[1]-1,+p[2]), b=Date.UTC(+q[0],+q[1]-1,+q[2]);
    var n=Math.round((a-b)/86400000);
    if(n<0 || n>3650) return '';
    if(dayRange()) return (flt.to===t)? String(n) : '';
    return (flt.to===flt.from)? String(n) : '';
  }
  function applyDayN(n){
    var s2=dAgo(n);
    if(dayRange()) fltSet({from:s2, to:today()});
    else fltSet({from:s2, to:s2});
  }
  function dayInline(){
    var rng=dayRange(), on=(flt.from||flt.to);
    return '<span style="display:inline-flex;align-items:center;gap:5px">'
      + '<span style="font-size:12.5px;font-weight:800;color:#5b7794">📅</span>'
      + '<input type="number" min="0" max="3650" id="lfDayN" value="'+esc(dayAgoN())+'"'
      +   ' placeholder="숫자" title="숫자를 넣고 엔터 — 0이면 오늘, 1이면 어제"'
      +   ' style="width:74px;height:34px;border:1.5px solid #dbe6f4;border-radius:8px;'
      +     'padding:0 8px;font-size:13px;font-family:inherit;text-align:center;background:#fffbea">'
      + '<span style="font-size:12.5px;font-weight:800;color:#5b7794">일 전</span>'
      + '<label title="켜면 그 날부터 오늘까지 모두 봅니다" style="display:inline-flex;align-items:center;gap:4px;'
      +   'height:34px;padding:0 9px;border:1.5px solid '+(rng?'#2563a8':'#dbe6f4')+';border-radius:8px;'
      +   'background:'+(rng?'#eaf3fd':'#fff')+';cursor:pointer;font-size:12.5px;font-weight:800;'
      +   'color:'+(rng?'#2563a8':'#5b7794')+'">'
      +   '<input type="checkbox" id="lfDayRng"'+(rng?' checked':'')+' style="width:16px;height:16px;cursor:pointer">'
      +   '~오늘</label>'
      + (on ? '<button type="button" class="lf-fx" id="lfDayClr" title="'+esc(String(flt.from||'처음')+' ~ '+String(flt.to||'끝'))+'"'
            + ' style="height:34px;padding:0 11px;font-size:12.5px;font-weight:800;'
            + 'color:#b52929;border-color:#f0c9c9;background:#fff6f6">✕ 기간</button>' : '')
      + '</span>';
  }

  /* ── 🔁 정기점검 · 📅 반복업무 — 단추를 누르면 아래로 펼친다 (v166) ─────
     둘 중 하나만 열린다. 기록 탭 위젯은 옮기지 않는다 (id 가 둘이면 먹통 · 사고이력 ⑮). */
  var LS_PANEL='wl_life_panel';
  var panelOpen = lsGet(LS_PANEL,'') || '';
  function ddLab(dd){ return (dd==null)?'날짜 미정':(dd<0?(-dd)+'일 지남':dd===0?'오늘':'D-'+dd); }
  function ddCol(dd){ return (dd==null)?'#5b7794':(dd<0?'#991b1b':(dd<=7?'#9a3412':'#5b7794')); }
  function ckRowsSafe(){
    try{ return (window.wlChk && window.wlChk.rows)? window.wlChk.rows() : []; }
    catch(e){ console.warn('[노션] 정기점검 요약 실패:', e && e.message); return []; }
  }
  function rcInfo(){
    try{
      var R=window.wlRecur;
      if(!R || !R.list) return null;
      var all=R.list(), done=all.filter(R.done).length;
      var mn=String(R.month()||'').slice(5,7);
      return { all:all, done:done, mLab:(+mn)? (+mn)+'월 ' : '' };
    }catch(e){ console.warn('[노션] 반복업무 요약 실패:', e && e.message); return null; }
  }

  function ckPanel(rows){
    var names=(window.wlChk && window.wlChk.names) || {};
    var body = rows.length
      ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px">'
        + rows.map(function(r){
            var dd=r.dd, bg=(dd!=null&&dd<0)?'#fee2e2':((dd!=null&&dd<=7)?'#fff4e0':'#fff');
            return '<div style="border:1.5px solid #e8f0fa;border-radius:11px;background:'+bg+';padding:9px 11px'
              + (r.t.off?';opacity:.5':'')+'">'
              + '<div style="display:flex;align-items:center;gap:6px">'
              +   '<b style="font-size:13.5px;color:#1a2f45;flex:1;overflow:hidden;'
              +     'text-overflow:ellipsis;white-space:nowrap">'+esc(r.t.name)+'</b>'
              +   '<span style="font-size:11.5px;font-weight:900;color:'+ddCol(dd)+'">'+ddLab(dd)+'</span>'
              + '</div>'
              + '<div style="font-size:11.5px;color:#8ba0b6;margin-top:3px">'
              +   esc(names[r.t.cycle]||'') + (r.d? ' · '+esc(r.d) : '')
              +   (r.t.lastDone? ' · 마지막 '+esc(r.t.lastDone) : '')
              + '</div>'
              + '<button type="button" class="lf-fx" data-ckdone="'+esc(String(r.t.id))+'"'
              +   ' style="margin-top:7px;height:32px;width:100%;font-size:12.5px;font-weight:800;'
              +   'color:#0f7a4a;border-color:#a7e3c8;background:#eefaf4">✅ 오늘 점검함</button>'
              + '</div>'; }).join('')
        + '</div>'
      : '<div style="color:#a8b8c8;font-size:13px;padding:10px 2px">등록된 정기점검이 없어요</div>';
    return '<div style="border:1.5px solid #dbe6f4;border-radius:12px;background:#f7fafd;padding:11px 13px;margin:8px 0 0">'
      + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:9px">'
      +   '<b style="font-size:13.5px;color:#33567d">🔁 정기점검</b>'
      +   '<span style="font-size:11.5px;color:#aab8c8;flex:1">기한이 다가오면 📅 예정에 저절로 올라갑니다</span>'
      +   '<button type="button" class="lf-fx" data-ckmgr="1" style="height:31px;padding:0 11px;font-size:12px;font-weight:800">⚙️ 관리</button>'
      + '</div>' + body + '</div>';
  }

  function rcPanel(all){
    var R=window.wlRecur;
    var body = all.length
      ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:6px">'
        + all.slice().sort(function(a,b){ return (Number(a.day)||99)-(Number(b.day)||99); })
            .map(function(t){
              var done=false; try{ done=!!R.done(t); }catch(e){}
              return '<label style="display:flex;align-items:center;gap:9px;background:#fff;'
                + 'border:1.5px solid #e8f0fa;border-radius:10px;padding:8px 11px;cursor:pointer">'
                + '<input type="checkbox" data-rcchk="'+esc(String(t.id))+'"'+(done?' checked':'')
                +   ' style="width:19px;height:19px;cursor:pointer;flex-shrink:0">'
                + '<span style="flex:1;min-width:0;font-size:13.5px;color:#1a2f45;overflow:hidden;'
                +   'text-overflow:ellipsis;white-space:nowrap'+(done?';text-decoration:line-through;color:#7a92a8':'')+'">'
                +   esc(String(t.name||''))+'</span>'
                + (t.day? '<span style="font-size:11.5px;color:#aab8c8;flex-shrink:0">매월 '+esc(String(t.day))+'일</span>':'')
                + '</label>'; }).join('')
        + '</div>'
      : '<div style="color:#a8b8c8;font-size:13px;padding:10px 2px">등록된 반복업무가 없어요</div>';
    return '<div style="border:1.5px solid #dbe6f4;border-radius:12px;background:#f7fafd;padding:11px 13px;margin:8px 0 0">'
      + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:9px">'
      +   '<b style="font-size:13.5px;color:#33567d">📅 반복업무</b>'
      +   '<span style="font-size:11.5px;color:#aab8c8;flex:1">체크하면 이번 달 완료로 남습니다</span>'
      +   '<button type="button" class="lf-fx" data-rcmgr="1" style="height:31px;padding:0 11px;font-size:12px;font-weight:800">⚙️ 관리</button>'
      + '</div>' + body + '</div>';
  }

  /* 도구 줄 안에 들어가는 🔁 📅 단추 두 개 */
  function chkBtns(rows, rc){
    if(isPersonal()) return '';
    var ckOn=(panelOpen==='ck'), rcOn=(panelOpen==='rc'), r0=rows[0], h='';
    h += '<button type="button" class="lf-fx" data-panel="ck"'
      + ' style="height:34px;padding:0 11px;font-size:12.5px;font-weight:800'
      +   (ckOn? ';background:#eaf3fd;border-color:#2563a8;color:#2563a8':'')+'"'
      + ' title="눌러서 정기점검 목록 펼치기">'
      + (ckOn?'▾':'▸')+' 🔁 '
      /* v225 — 이름이 길면 도구줄이 두 줄로 넘친다. 8글자까지만 (전체는 마우스를 올리면) */
      + (r0? ('<b style="color:#1a2f45" title="'+esc(r0.t.name)+'">'
              + esc(String(r0.t.name||'').length > 8 ? (String(r0.t.name).slice(0,8)+'…') : r0.t.name)
              + '</b> <b style="color:'+ddCol(r0.dd)+'">'+ddLab(r0.dd)+'</b>')
           : '<span style="color:#8ba0b6;font-weight:700">정기점검</span>')
      + '</button>';
    h += '<button type="button" class="lf-fx" data-panel="rc"'
      + ' style="height:34px;padding:0 11px;font-size:12.5px;font-weight:800'
      +   (rcOn? ';background:#eaf3fd;border-color:#2563a8;color:#2563a8':'')+'"'
      + ' title="눌러서 반복업무 목록 펼치기">'
      + (rcOn?'▾':'▸')+' 📅 '+(rc? esc(rc.mLab):'')
      /* v211 — 달님 : 「반복업무가 안 나온다」
         등록된 것이 있으면 이름이 사라지고 숫자만 남았다. 항상 적는다. */
      + (rc && rc.all.length
         ? '<b style="color:#1a2f45">반복업무</b> <b style="color:'+(rc.done===rc.all.length?'#0f7a4a':'#9a3412')+'">'+rc.done+'/'+rc.all.length+'</b>'
         : '<span style="color:#8ba0b6;font-weight:700">반복업무</span>')
      + '</button>';
    return h;
  }

  function fltNum(pt){
    return colfCount(pt) + ((flt.rules||[]).length) + (flt.money?1:0)
         + ((flt.from||flt.to)?1:0) + (num(flt.min)?1:0);
  }
  /* 지금 걸린 조건을 펼쳐 보여주고 하나씩 푸는 쪽지 (v163) */
  function fltPop(pt, anchor){
    colfClose();
    var m=colfOf(pt), rs=flt.rules||[], rows='';
    Object.keys(m).forEach(function(pid){
      var p=propById(pt,pid); if(!p) return;
      rows += '<label class="it" data-fpcf="'+esc(pid)+'">'
        + '<span style="width:16px;text-align:center">'+tinfo(p.type).i+'</span>'
        + '<span class="nm"><b>'+esc(p.name)+'</b> '+esc(colfLabel(p, m[pid]))+'</span>'
        + '<span class="n" style="color:#b52929;font-weight:900">✕</span></label>';
    });
    rs.forEach(function(r,i){
      var p=propById(pt,r.pid);
      rows += '<label class="it" data-fprule="'+i+'">'
        + '<span style="width:16px;text-align:center">'+tinfo(p?p.type:'text').i+'</span>'
        + '<span class="nm"><b>'+esc(p?p.name:r.pid)+'</b> '+esc(r.op)
        +   (opNeedsVal(r.op)? (' '+esc(r.val)) : '')+'</span>'
        + '<span class="n" style="color:#b52929;font-weight:900">✕</span></label>';
    });
    if(flt.from||flt.to) rows += '<label class="it" data-fpday="1">'
      + '<span style="width:16px;text-align:center">📅</span>'
      + '<span class="nm"><b>기간</b> '+esc(flt.from||'처음')+' ~ '+esc(flt.to||'끝')+'</span>'
      + '<span class="n" style="color:#b52929;font-weight:900">✕</span></label>';
    if(flt.money) rows += '<label class="it" data-fpmoney="1">'
      + '<span style="width:16px;text-align:center">💰</span>'
      + '<span class="nm"><b>금액 있는 것만</b></span>'
      + '<span class="n" style="color:#b52929;font-weight:900">✕</span></label>';
    if(num(flt.min)) rows += '<label class="it" data-fpmin="1">'
      + '<span style="width:16px;text-align:center">🔢</span>'
      + '<span class="nm"><b>최소 금액</b> '+esc(flt.min)+'</span>'
      + '<span class="n" style="color:#b52929;font-weight:900">✕</span></label>';
    if(!rows) rows = '<div style="padding:16px;color:#a8b8c8;font-size:12.5px">걸린 조건이 없어요</div>';

    var pop=document.createElement('div');
    pop.className='lf-cfp'; pop.id='lfCfPop';
    pop.innerHTML = '<div class="hd">지금 걸러내고 있는 조건'
      + '<button type="button" class="x" data-cfx="1">✕</button></div>'
      + '<div class="bd">'+rows+'</div>'
      + '<div style="padding:8px;border-top:1px solid #eef2f7">'
      +   '<button type="button" class="lf-fx" data-fpall="1"'
      +   ' style="width:100%;height:34px;color:#b52929;border-color:#f0c9c9;background:#fff6f6;font-weight:800">'
      +   '✕ 전부 풀기</button></div>';
    document.body.appendChild(pop);
    var r0=anchor.getBoundingClientRect(), w=pop.offsetWidth||272, hh=pop.offsetHeight||240;
    pop.style.left = Math.max(8, Math.min(r0.left, window.innerWidth-w-8))+'px';
    pop.style.top  = (r0.bottom+6+hh > window.innerHeight)
      ? Math.max(8, window.innerHeight-hh-8)+'px' : (r0.bottom+6)+'px';
    pop.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
    pop.querySelector('[data-cfx]').addEventListener('click', colfClose);
    pop.querySelectorAll('[data-fpcf]').forEach(function(el){
      el.addEventListener('click', function(){
        colfClose(); colfSet(pt, el.getAttribute('data-fpcf'), null); }); });
    pop.querySelectorAll('[data-fprule]').forEach(function(el){
      el.addEventListener('click', function(){
        colfClose();
        flt.rules.splice(parseInt(el.getAttribute('data-fprule'),10),1);
        lsSet(LS_FLT,flt); safeRender(); }); });
    var dq=pop.querySelector('[data-fpday]');
    if(dq) dq.addEventListener('click', function(){ colfClose(); fltSet({from:'',to:''}); });
    var mq=pop.querySelector('[data-fpmoney]');
    if(mq) mq.addEventListener('click', function(){ colfClose(); fltSet({money:false}); });
    var nq=pop.querySelector('[data-fpmin]');
    if(nq) nq.addEventListener('click', function(){ colfClose(); fltSet({min:''}); });
    pop.querySelector('[data-fpall]').addEventListener('click', function(){
      colfClose(); colfSave(pt,null); flt.rules=[];
      fltSet({from:'',to:'',money:false,min:''}); });
  }
  /* ── 도구 줄 — v167에서 한 줄로 합쳤다 ────────────────────────────
     늘 보이는 것 : 🔁 정기점검 · 📅 반복업무 · 날짜 · 묶기 · 걸린 필터 · 건수
     가끔 쓰는 것 : ⚙ 안으로 (보기 저장·보기 관리·조건 걸기·색상 규칙·틀고정…)
     저장해 둔 보기는 **있을 때만** 칩으로 나온다. */
  function viewChips(pt){
    var vs=viewsOf(pt);
    var h='<span class="lf-vchips">';
    h+='<div class="lf-chip'+(curView?'':' on')+'"'+(curView?'':' style="background:#2563a8"')
      + ' data-vgo="" title="정렬·필터·묶기·칸을 처음 상태로">↺<span class="t"> 처음</span></div>';
    vs.forEach(function(v){
      var on=(curView===v.id);
      h+='<div class="lf-chip'+(on?' on':'')+'"'+(on?' style="background:#7c3aed"':'')+' data-vgo="'+esc(v.id)+'">'
        + (v.fav?'⭐ ':'👁 ')+esc(v.name)+'</div>';
    });
    return h+'</span>';
  }

  /* v234 — 달님 : 「세로로 떨어지는 목록 말고 옆으로 펼쳐지게」
     머리줄 「안전」 오른쪽에 분류 칩을 그대로 편다. 작게 만들어 한 줄에 들어가게 하고,
     화면이 좁아 넘치면 그 줄만 옆으로 밀린다 (줄이 늘어나지 않는다). */
  function catChipsP(){
    try{
      var all = recs().filter(function(e){ return e.ptype!=='car'; });
      var cnt = {}; all.forEach(function(e){ cnt[e.ptype] = (cnt[e.ptype]||0) + 1; });
      var h = '<div class="lf-pcats">';
      h += '<div class="lf-chip'+(curCat==='전체'?' on':'')+'" data-lc="전체"'
         + (curCat==='전체'?' style="background:#2563a8"':'') + '>전체 <b>'+all.length+'</b></div>';
      var cc = cats();
      Object.keys(cc).forEach(function(k){
        var d = cc[k] || {}, m = cnt[k] || 0, on = (curCat===k);
        h += '<div class="lf-chip'+(on?' on':'')+(m?'':' dim')+'" data-lc="'+esc(k)+'"'
           + (on?' style="background:'+(d.c||'#2563a8')+'"':'') + ' title="'+esc(d.n||k)+'">'
           + (d.i||'') + ' ' + esc(d.n||k) + (m? ' <b>'+m+'</b>' : '') + '</div>';
      });
      return h + '</div>';
    }catch(e){ console.warn('[분류 칩]', e); return ''; }
  }

  /* v233 — 쓰지 않음(v234에서 칩으로 되돌림). 좁은 화면용으로 남겨 둔다 */
  function catSelP(){
    try{
      var all = recs().filter(function(e){ return e.ptype!=='car'; });
      var cnt = {}; all.forEach(function(e){ cnt[e.ptype] = (cnt[e.ptype]||0) + 1; });
      var h = '<select id="lfCatSel" class="lf-in" title="분류로 골라 보기" style="max-width:170px">';
      h += '<option value="전체"'+(curCat==='전체'?' selected':'')+'>🏠 전체 '+all.length+'</option>';
      var cc = cats();
      Object.keys(cc).forEach(function(k){
        var d = cc[k] || {}, m = cnt[k] || 0;
        h += '<option value="'+esc(k)+'"'+(curCat===k?' selected':'')+'>'
           + esc((d.i||'')+' '+(d.n||k)) + (m? ' '+m : '') + '</option>';
      });
      return h + '</select>';
    }catch(e){ console.warn('[분류 고르개]', e); return ''; }
  }

  function fltBar(n, tot){
    var pt0 = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    var nF  = fltNum(pt0);
    var rows= isPersonal()? [] : ckRowsSafe();
    var rc  = isPersonal()? null : rcInfo();
    var sep = '<span class="lf-fbsep"></span>';
    var vs  = viewsOf(pt0);
    return '<div class="lf-fb">'
      + '<div class="lf-fbwrap"><div class="lf-fbmid" style="flex-wrap:wrap;row-gap:6px">'
      /* v212 — 달님 : 「갤러리까지가 보기 부분이니 정기점검 왼쪽이 맞다」
         검색줄(lf-bar)에 있던 보기 단추를 도구줄 맨 앞으로 옮긴다. */
      +   vwBtns()
      +   sep
      +   chkBtns(rows, rc)
      +   (isPersonal()? '' : sep)
      +   dayInline()
      +   sep
      +   ((vw==='table'||vw==='list'||vw==='card') ? grpOptions(pt0) : '')
      +   (nF ? '<button type="button" class="lf-fx" id="lfFpop"'
             + ' style="height:34px;color:#b52929;border-color:#f0c9c9;background:#fff6f6;font-weight:800"'
             + ' title="눌러서 걸린 조건을 보고 하나씩 풀 수 있어요">✕ 필터 '
             + '<b style="background:#b52929;color:#fff;border-radius:9px;padding:1px 6px;margin-left:3px">'+nF+'</b></button>' : '')
      +   sep
      +   viewChips(pt0)
      /* v188 — 달님 : 「노션 보기에는 복사가 없어」
            있기는 있었다(⚙ 도구 안 lfCopyXls). 눈에 보이는 줄에도 하나 둔다.
            누르는 일은 하나 — 아래 doCopyXls() 한 곳에서만 한다. */
      /* v224 — 달력을 보고 있을 때만 「함께 보기」 접기 단추를 여기 둔다 */
      +   ((!isPersonal() && vw==='cal') ? (sep + calKindToggle()) : '')
      +   (isPersonal()? '' :
           '<button type="button" class="lf-fx" id="lfCopyXls2"'
           + ' title="지금 걸린 기간의 업무를 엑셀에 붙여넣을 수 있게 복사합니다"'
           + ' style="color:#0f7a4a;border-color:#b7e4c7;background:#f0f9f4;font-weight:800">📋</button>')
      /* v218 — 달님 : 「세 단추만 남은 줄이 아깝다」
         업무일지에서는 검색줄을 통째로 없애고 이 셋을 여기로 옮겼다.
         🔴 개인일지는 검색칸(lfQ)이 있어 그대로 둔다 — 같은 id 가 둘이면 안 된다 (지침 ⑮). */
      +   (isPersonal()
           /* v231 — 개인 기록 화면도 도구줄에서 템플릿을 쓴다 (윗줄 검색줄을 없앴으므로) */
           ? ((cur==='rec') ? (sep + '<button type="button" id="lfTpl" class="lf-fx" title="📑 템플릿 — 자주 쓰는 기록을 미리 만들어 두기">📑</button>') : '')
           : (sep
           /* v225 — 그림만 둔다. 「기록 추가」가 같은 줄에 들어오게 (마우스를 올리면 이름) */
           + '<button type="button" id="lfVend" class="lf-fx" title="📇 업체 — 업체 하나에 얽힌 모든 것 보기">📇</button>'
           + '<button type="button" id="lfTpl" class="lf-fx" title="📑 템플릿 — 자주 쓰는 기록을 미리 만들어 두기">📑</button>'))
      + '</div></div>'
      /* ══ v228 🔴 「기록 추가」를 스크롤되는 가운데 칸 밖으로 꺼냈다 ══
         예전에는 가운데 칸(lf-fbmid) 안에 있었다. 그 칸은 내용이 넘치면
         줄을 바꾸게 돼 있어서, 화면이 조금만 좁아도 「기록 추가」만 아래로
         떨어지고 ⚙ · 건수는 윗줄에 남아 줄이 어긋나 보였다.
         이제 ⚙ · 건수와 형제(줄바꿈 없는 lf-fb 바로 밑)라 늘 한 줄이다. */
      /* v231 — 개인 「📋 기록」 에서도 여기에 둔다.
         🔴 차계부·연락처는 자기 화면에 ➕ 차계부 추가 · ➕ 연락처 추가 가 따로 있으니 넣지 않는다
            (같은 뜻의 단추가 한 화면에 둘이면 헷갈린다) */
      + ((isPersonal() && cur!=='rec') ? '' :
         '<button type="button" id="lfAdd" class="lf-add" style="height:34px;flex:0 0 auto">➕ 기록 추가</button>')
      + '<div class="lf-more" id="lfMore">'
      +   '<button type="button" class="lf-fx" id="lfMoreBtn" title="그 밖의 도구">⚙'
      +     (nF? '<b class="dot">'+nF+'</b>':'') + '</button>'
      +   '<div class="lf-morep" id="lfMoreP">'
      +     '<button type="button" class="lf-fx" data-vsave="1" style="border-style:dashed">💾 지금 보기 저장</button>'
      +     (vs.length? '<button type="button" class="lf-fx" data-vmgr="1" style="border-style:dashed">⋯ 보기 관리</button>' : '')
      +     (vw==='table' ? '' :
             '<button type="button" class="lf-fx'+(colfCount(pt0)?' on':'')+'" id="lfColF"'
             + ' title="어느 칸의 값으로 골라 볼지 고릅니다">🔽 조건 걸기</button>')
      +     '<div class="sep"></div>'
      +     (vw==='table'
             ? '<label class="lf-ck" title="옆으로 밀어도 첫 칸과 칸 이름이 붙어 있게"><input type="checkbox" id="lfFrz"'+(frzOn()?' checked':'')+'> 칸 이름 틀고정</label>'
             : '')
      +     '<label class="lf-ck"><input type="checkbox" id="lfFm"'+(flt.money?' checked':'')+'> 금액 있는 것만</label>'
      +     '<label class="lf-ck"><input type="checkbox" id="lfSubShow"'+(showSub()?' checked':'')+'> 하위 항목도</label>'
      +     '<div class="sep"></div>'
      +     '<button type="button" class="lf-fx" id="lfRuleAdd" style="border-style:dashed;color:#7c3aed">＋ 조건 추가</button>'
      +     '<button type="button" class="lf-fx" id="lfColorBtn" style="border-style:dashed">🎨 색상 규칙</button>'
      +     (vw==='table'? '<button type="button" class="lf-fx" id="lfColwR" title="끌어서 바꾼 칸 폭을 처음으로">↔ 폭 초기화</button>':'')
      /* ── v171 「도구」 — 탭 1행을 없애도 여기서 다 갈 수 있게 ── */
      +     '<div class="sep"></div>'
      +     '<div style="font-size:11px;font-weight:800;color:#8ba0b6;padding:1px 3px">도구</div>'
      /* v233 — 개인일지: 띠 대신 여기 넣었다 */
      +     (isPersonal()
             ? '<button type="button" class="lf-fx" id="lfOldGo"'
               + ' title="쓰시던 개인일지 앱의 기록·연락처를 한 번에 가져옵니다 · 예전 앱 기록은 그대로 남습니다">'
               + '📥 예전 개인일지 가져오기</button>' : '')
      +     ((!isPersonal() && DS && DS.key==='work:expense')
             ? '<button type="button" class="lf-fx" id="lfSubMgr" title="선납부 · 기타정산 · 수도광열비 의 하위 구분 목록을 고칩니다">🏷 하위 구분 관리</button>'
             : '')
      +     '<button type="button" class="lf-fx" data-gotab="password" title="비밀번호 화면">🔐 비번</button>'
      +     '<button type="button" class="lf-fx" data-gotab="diag" title="진단 · 자가 점검">🔧 진단</button>'
      +     '<button type="button" class="lf-fx" data-gotab="ai" title="AI 화면">🤖 AI</button>'
      +     (isPersonal()? ''
             : '<button type="button" class="lf-fx" id="lfCopyXls"'
               + ' title="지금 걸린 기간의 업무를 엑셀에 붙여넣을 수 있게 복사합니다">📋 복사(엑셀)</button>'
               /* v172 — 청소일지는 달력에서만 열리던 것. 여기서도 갈 수 있게 */
               + '<button type="button" class="lf-fx" id="lfClnNew"'
               + ' title="청소일지를 바로 새로 씁니다">🧹 청소일지 쓰기</button>'
               + '<button type="button" class="lf-fx" data-gotab="calendar"'
               + ' title="달력 화면 — 청소일지 목록이 여기 있습니다">📅 달력(청소일지)</button>'
               /* v174 — 위 줄 탭 숨기기 */
               + '<button type="button" class="lf-fx" id="lfTabHide"'
               + ' title="맨 윗줄 탭을 감춥니다 — 코드는 그대로라 언제든 되살아납니다">🗂 위 줄 탭 숨기기</button>')
      +     ((!isPersonal() && DS && DS.key==='work:expense')
             ? '<button type="button" class="lf-fx" data-expsub="meal" title="지출 화면의 중식이용내역">🍚 중식</button>'
               + '<button type="button" class="lf-fx" data-expsub="labor" title="지출 화면의 도급비 산출">👷 인건비</button>'
             : '')
      +   '</div>'
      + '</div>'
      + '<span class="lf-cnt">'+won(n)+'건'+(n!==tot? ' / '+won(tot):'')+'</span>'
      + '</div>'
      + (panelOpen==='ck' ? ckPanel(rows) : (panelOpen==='rc' ? rcPanel(rc? rc.all : []) : ''));
  }
  function th(k, label, w, right){
    var on = srt.k===k;
    return '<th class="s'+(on?' on':'')+'"'+(w?' style="width:'+w+(right?';text-align:right':'')+'"':(right?' style="text-align:right"':''))
      + ' data-srt="'+k+'">'+label+(on? '<span class="ar">'+(srt.d>0?'▲':'▼')+'</span>':'')+'</th>';
  }


  /* ══════════════════════════════════════════════════════════
     📊 그룹 묶기 — 아무 칸으로나 묶고 소계
     ══════════════════════════════════════════════════════════ */
  var LS_GRP='wl_life_grp';
  var grp = lsGet(LS_GRP,'') || '';
  function grpSet(v){ grp=v; lsSet(LS_GRP,v); safeRender(); }
  /* 지금 실제로 쓰이는 구분 기준 — 고른 게 없으면 종류에 맞게 알아서 */
  function effGrp(pt){ return grp || (statInfo(pt) ? '_stat' : '_month'); }
  /* v218 — 주별로 묶기. 그 주의 「월요일 날짜」를 열쇠로 쓴다.
     🔴 날짜 연산은 Date.UTC 로만 (KST 에서 하루 밀린다 · 지침 ⑬) */
  function weekKey(d){
    try{
      var p2=String(d||'').slice(0,10).split('-');
      if(p2.length!==3 || !p2[0]) return '';
      var dt=new Date(Date.UTC(+p2[0], +p2[1]-1, +p2[2]));
      var w=dt.getUTCDay();
      dt.setUTCDate(dt.getUTCDate() + (w===0 ? -6 : 1-w));
      return dt.toISOString().slice(0,10);
    }catch(e){ console.warn('[주별 묶기] 계산 실패', e); return ''; }
  }
  function weekLab(k){
    try{
      if(!k) return '날짜 없음';
      var p2=k.split('-');
      var s=new Date(Date.UTC(+p2[0], +p2[1]-1, +p2[2]));
      var e2=new Date(s.getTime()); e2.setUTCDate(e2.getUTCDate()+6);
      var nth=Math.floor((s.getUTCDate()-1)/7)+1;
      return k + ' ~ ' + String(e2.getUTCMonth()+1).padStart(2,'0') + '-'
           + String(e2.getUTCDate()).padStart(2,'0')
           + '  (' + (s.getUTCMonth()+1) + '월 ' + nth + '주)';
    }catch(e){ console.warn('[주별 묶기] 이름표 실패', e); return String(k||''); }
  }

  function grpKey(e, pt){
    var g=effGrp(pt);
    if(g==='_day')   return String(e.date||'').slice(0,10);   /* v211 */
    if(g==='_week')  return weekKey(e.date);                  /* v218 */
    if(g==='_month') return String(e.date||'').slice(0,7);
    if(g==='_stat')  return statVal(e, pt);
    var p=propById(pt, g); if(!p) return '';
    var v = p.type==='formula' ? formulaCalc(e,p.expr,e.ptype)
          : p.type==='rollup'  ? rollupCalc(e,p,e.ptype) : pget(e,g);
    if(Array.isArray(v)) return v.length? String(v[0]) : '';
    if(p.type==='check') return v? '☑ 체크됨' : '☐ 안 됨';
    if(p.id==='_cat') return (e.ptype==='car') ? '🚗 차계부' : ((cats()[e.ptype]||catEtc()).i+' '+(cats()[e.ptype]||catEtc()).n);
    return String(v==null?'':v);
  }
  /* v211 — 일별 묶기의 이름표. 기본 보기와 같은 모양으로.
     🔴 날짜 연산은 Date.UTC 로만 한다 (KST 에서 하루 밀린다) */
  var DAY_NAME=['일','월','화','수','목','금','토'];
  function dayLab(k){
    try{
      if(!k) return '날짜 없음';
      var p=String(k).slice(0,10).split('-');
      if(p.length!==3) return String(k);
      var d=new Date(Date.UTC(+p[0], +p[1]-1, +p[2]));
      var w=DAY_NAME[d.getUTCDay()]||'';
      var t=today(), pt2=t.split('-');
      var t0=new Date(Date.UTC(+pt2[0], +pt2[1]-1, +pt2[2]));
      var diff=Math.round((t0-d)/86400000);
      var head = diff===0? '오늘 ' : (diff===1? '어제 ' : (diff===2? '2일전 ' : (diff===-1? '내일 ' : '')));
      return head + String(k).slice(0,10) + ' (' + w + ')';
    }catch(e){ console.warn('[일별 묶기] 이름표 실패', e); return String(k||''); }
  }
  function grpLabel(k, pt){
    var g=effGrp(pt);
    if(g==='_day')  return dayLab(k);    /* v211 */
    if(g==='_week') return weekLab(k);   /* v218 */
    if(g==='_month') return k? k.replace('-','년 ')+'월' : '날짜 없음';
    if(g==='_stat')  return k===''? '구분 없음' : k;
    return k===''? '(비어있음)' : k;
  }
  /* 구분 차례대로 줄 세우기 — 상태는 일 순서, 월은 최근 것부터 */
  function grpRank(k, pt, g){
    if(g==='_stat') return statRank(k, pt);
    if(g==='_month' || g==='_day' || g==='_week') return 0;   /* v211·v218 */
    var p=propById(pt, g), ord=(p && (p.opts||p.o)) || null;
    if(ord){ var i=ord.indexOf(k); return i<0?900:i; }
    return 0;
  }
  /* 그룹 값이 날짜처럼 생겼나 — 2026 / 2026-08 / 2026-08-31 (v166) */
  function keysDateLike(keys){
    var n=0;
    for(var i=0;i<keys.length;i++){
      var k=String(keys[i]==null?'':keys[i]); if(!k) continue;
      n++;
      if(!/^\d{4}([-.\/]\d{1,2}){0,2}$/.test(k)) return false;
      if(n>=60) break;
    }
    return n>0;
  }
  function grpSort(arr, pt, g){
    /* v166 — 「대상년도」·「대상월」처럼 날짜성 칸으로 묶으면 최근 것이 위로 온다 */
    var dl = (g!=='_stat') && keysDateLike(arr.map(function(x){ return grpKey(x,pt); }));
    return arr.slice().sort(function(x,y){
      var a=grpKey(x,pt), b=grpKey(y,pt);
      if(a===b) return 0;
      if(a==='') return 1; if(b==='') return -1;          /* 빈 값은 항상 맨 아래 */
      if(g==='_month' || g==='_day' || g==='_week' || dl) return String(b).localeCompare(String(a));   /* v211·v218 */
      var ra=grpRank(a,pt,g), rb=grpRank(b,pt,g);
      if(ra!==rb) return ra-rb;
      return String(a).localeCompare(String(b),'ko');
    });
  }
  function grpOptions(pt){
    /* v163 — 금액·숫자 칸과 날짜 칸은 뺀다. 그룹이 수백 개가 되어 쓸모가 없다.
       (월별로 묶기가 이미 있으므로 날짜별 묶기는 겹친다) */
    var ok=['sel','tag','multi','rel'];   /* v164 — 체크·글자·전화 칸은 뺀다 */
    var ALSO=/^(업체|거래처)$/;            /* v165 — 「업체」만 되살린다 */
    var a=propsOf(pt).filter(function(p){
      return (ok.indexOf(p.type)>=0 || ALSO.test(p.name||'')) && p.id!=='_title'; });
    var si=statInfo(pt);
    var siName = si ? (({status:'상태',expType:'종류',stockType:'입고/출고',dir:'통화 구분',
                         vtype:'휴가 종류',dtype:'전달 종류',scheduleType:'반복',
                         field:'분야',category:'분류'})[si.k] || '상태') : '';
    /* v225 — 폭이 넓어 「기록 추가」가 다음 줄로 밀렸다. 최대 폭을 정한다. */
    return '<select id="lfGrp" class="lf-in" style="height:32px;font-size:12.5px;max-width:150px" title="어떤 기준으로 갈라서 볼지">'
      + '<option value=""'+(grp===''?' selected':'')+'>'
        + (si? ('\u2728 '+siName+'별로 묶기 (기본)') : '\uD83D\uDCC5 월별로 묶기 (기본)') + '</option>'
      + '<option value="_none"'+(grp==='_none'?' selected':'')+'>\uD83D\uDEAB 묶지 않기 — 최신순으로 쭉</option>'
      + '<option value="_day"'+(grp==='_day'?' selected':'')+'>\uD83D\uDCC5 일별로 묶기</option>'
      + '<option value="_week"'+(grp==='_week'?' selected':'')+'>\uD83D\uDCC5 주별로 묶기</option>'
      + '<option value="_month"'+(grp==='_month'?' selected':'')+'>\uD83D\uDCC5 월별로 묶기</option>'
      + a.map(function(p){ return '<option value="'+esc(p.id)+'"'+(grp===p.id?' selected':'')
          +'>'+tinfo(p.type).i+' '+esc(p.name)+' 로 묶기</option>'; }).join('')
      + '</select>';
  }

  /* ══════════════════════════════════════════════════════════
     🗂 보드(칸반) 보기
     ══════════════════════════════════════════════════════════ */
  var LS_BRD='wl_life_board';
  var brdPid = lsGet(LS_BRD,'') || '';
  function brdCandidates(pt){
    return propsOf(pt).filter(function(p){
      return p.type==='sel' || p.type==='check' || p.id==='_cat'; });
  }
  function brdCols(pt, arr){
    if(brdPid==='_cat' || !brdPid){
      var seen={}, out=[];
      arr.forEach(function(e){ var k=(e.ptype==='car')?'car':(e.ptype||'etc'); if(!seen[k]){ seen[k]=1; out.push(k); } });
      return out.map(function(k){
        var d = k==='car'? {i:'🚗',n:'차계부',c:'#0891b2'} : (cats()[k]||catEtc());
        return {v:k, label:d.i+' '+d.n, color:d.c}; });
    }
    var p=propById(pt, brdPid);
    var opts = p ? (p.opts||p.o||[]) : [];
    if(p && p.type==='check') opts=['☑ 체크됨','☐ 안 됨'];
    if(!opts.length){
      var s2={}, o2=[];
      arr.forEach(function(e){ var v=String(pget(e,brdPid)||''); if(!s2[v]){ s2[v]=1; o2.push(v); } });
      opts=o2;
    }
    return opts.map(function(o){ return {v:o, label:(o||'(비어있음)'), color:'#94a3b8'}; });
  }
  function brdValOf(e, pt){
    if(brdPid==='_cat' || !brdPid) return (e.ptype==='car')?'car':(e.ptype||'etc');
    var p=propById(pt, brdPid);
    if(p && p.type==='check') return pget(e,brdPid)? '☑ 체크됨':'☐ 안 됨';
    return String(pget(e,brdPid)||'');
  }
  function boardHTML(arr, pt){
    var cands=brdCandidates(pt);
    if(!brdPid) brdPid = (cands.filter(function(c){return c.type==='sel';})[0]||{}).id || '_cat';
    var tot=arr.length;
    arr = applySrt(applyFlt(arr));
    var bar = fltBar(arr.length, tot);
    var cols = brdCols(pt, arr);
    var h = bar
      + '<div class="lf-bar" style="margin-bottom:10px">'
      +   '<span class="lb" style="font-size:11.5px;font-weight:800;color:#8ba0b6">세로줄 기준</span>'
      +   '<select id="lfBrd" class="lf-in" style="height:32px;font-size:12.5px">'
      +     cands.map(function(c){ return '<option value="'+esc(c.id)+'"'+(brdPid===c.id?' selected':'')
            +'>'+tinfo(c.type).i+' '+esc(c.name)+'</option>'; }).join('')
      +   '</select>'
      +   '<span style="font-size:12px;color:#a8b8c8">카드를 끌어서 옮기면 값이 바뀝니다</span>'
      + '</div>'
      + '<div class="lf-board">';
    cols.forEach(function(c){
      var mine = arr.filter(function(e){ return brdValOf(e,pt)===c.v; });
      if(!mine.length && String(c.v||'')==='') return;   /* 빈 값 줄은 비었으면 감춤 */
      var sum=0; mine.forEach(function(e){ sum+=money(e); });
      h+='<div class="lf-bcol" data-bcol="'+esc(c.v)+'">'
        + '<div class="lf-bhead"><span class="dot" style="background:'+c.color+'"></span>'
        +   '<b>'+esc(c.label)+'</b><span class="n">'+mine.length+'</span>'
        +   (sum? '<span class="s">'+numFmt(sum)+'원</span>':'') + '</div>'
        + '<div class="lf-blist">'
        + mine.map(function(e){
            var ch=colorHit(e,pt);
            return '<div class="lf-bcard" draggable="true" data-bid="'+esc(e.id)+'"'
              + (ch? ' style="background:'+colorOf(ch.color).bg+'"':'') + '>'
              + '<div class="t">'+esc(pget(e,'_title')||'(제목없음)')+'</div>'
              + '<div class="m">'+esc(e.date||'')+(subOf(e)? ' · '+esc(subOf(e).slice(0,26)):'')+'</div>'
              + (money(e)? '<div class="a">'+numFmt(money(e))+'원</div>':'')
              + '</div>'; }).join('')
        + (mine.length? '' : '<div class="lf-bempty">비어 있음</div>')
        + '</div></div>';
    });
    return h+'</div>';
  }

  /* ══════════════════════════════════════════════════════════
     🏢 층별 보기 — 건물 단면도처럼 위에서 아래로
     ══════════════════════════════════════════════════════════ */
  var FLOOR_ORDER = ["옥탑층","옥상","20층","19층","18층","17층","16층","15층","14층","13층","12층","11층","10층",
    "9층","8층","7층","6층","5층","4층","3층","2층","1층",
    "지하1층","B1","지하2층","B2","지하3층","B3","지하4층","B4","지하5층","B5","지하6층","B6"];
  /* 이 화면에 층 칸이 있나 */
  function floorPid(pt){
    var a=propsOf(pt);
    for(var i=0;i<a.length;i++){
      var p=a[i];
      if(p.id==='f:floor' || p.id==='f:location') return p.id;
      if(/층/.test(p.name||'') && p.type!=='num') return p.id;
    }
    return null;
  }
  function hasFloors(pt){ return !isPersonal() && !!floorPid(pt); }
  function floorHTML(arr, pt){
    var fp=floorPid(pt);
    if(!fp) return '<div class="lf-grid"><div class="lf-empty"><div class="ei">🏢</div>이 화면에는 층 항목이 없어요</div></div>';
    var tot=arr.length;
    arr = applySrt(applyFlt(arr));
    var bar = fltBar(arr.length, tot);

    /* 층 목록 — 정해진 순서 + 데이터에 있는 낯선 층 */
    var seen={}, extra=[];
    arr.forEach(function(e){
      var v=String(pget(e,fp)||'');
      if(!v){ seen['']=1; return; }
      seen[v]=1;
      if(FLOOR_ORDER.indexOf(v)<0 && extra.indexOf(v)<0) extra.push(v);
    });
    var flrs = FLOOR_ORDER.filter(function(f){ return seen[f]; }).concat(extra.sort());
    if(seen['']) flrs.push('');

    if(!flrs.length) return bar + '<div class="lf-grid"><div class="lf-empty"><div class="ei">🏢</div>보여줄 기록이 없어요</div></div>';

    var h = bar
      + '<div class="lf-bldbar">'
      +   '<span style="font-size:13px;font-weight:900;color:#1a2f45">🏢 건물 단면</span>'
      +   '<span style="font-size:11.5px;color:#a8b8c8">층을 누르면 그 층만 걸러 봅니다 · 이름을 누르면 그 기록으로</span>'
      + '</div>'
      + '<div class="lf-bld">';

    flrs.forEach(function(f, i){
      var mine = arr.filter(function(e){ return String(pget(e,fp)||'')===f; });
      var open = 0;
      mine.forEach(function(e){
        var st=String(pget(e,'f:status')||'');
        if(st && !/완료|종결/.test(st)) open++;
      });
      var cls = 'lf-flr' + (i===0?' roof':'') + (i===flrs.length-1?' base':'');
      h += '<div class="'+cls+'">'
        + '<div class="fl" data-flrgo="'+esc(f)+'">'
        +   '<b>'+esc(f||'층 없음')+'</b>'
        +   '<span class="c">'+mine.length+'건</span>'
        +   (open? '<span class="warn">미완료 '+open+'</span>':'')
        + '</div>'
        + '<div class="fb">'
        + (mine.length
           ? mine.slice(0,24).map(function(e){
               var ch=colorHit(e,pt), d=dsColor(e);
               return '<span class="lf-fp" data-lpage="'+esc(e.id)+'"'+(ch?' style="background:'+colorOf(ch.color).bg+'"':'')+'>'
                 + '<span class="d" style="background:'+d+'"></span>'
                 + '<span class="t">'+esc(pget(e,'_title')||'(제목없음)')+'</span>'
                 + '<span class="s">'+esc(String(pget(e,'_date')||'').slice(5))+'</span>'
                 + '</span>'; }).join('')
             + (mine.length>24? '<span class="lf-fempty">+'+(mine.length-24)+'건 더</span>':'')
           : '<span class="lf-fempty">비어 있음</span>')
        + '</div></div>';
    });
    return h + '</div>';
  }
  /* 상태에 따라 점 색 */
  function dsColor(e){
    var st=String(pget(e,'f:status')||'');
    if(/완료|종결/.test(st)) return '#22c55e';
    if(/보류/.test(st))     return '#94a3b8';
    if(st)                  return '#f59e0b';
    return (DS && DS.cats && DS.cats[DS.kind] && DS.cats[DS.kind].c) || '#2563a8';
  }

  /* ══════════════════════════════════════════════════════════
     ⏱ 타임라인 — 시작~끝을 가로 막대로
     ══════════════════════════════════════════════════════════ */
  var LS_TLM='wl_life_tlm';
  var tlYM = lsGet(LS_TLM,'') || today().slice(0,7);
  function tlShift(n){
    var y=+tlYM.slice(0,4), m=+tlYM.slice(5,7)+n;
    while(m<1){ m+=12; y--; } while(m>12){ m-=12; y++; }
    tlYM = y+'-'+String(m).padStart(2,'0'); lsSet(LS_TLM,tlYM); safeRender();
  }
  /* 이 기록의 시작·끝 날짜 */
  function tlRange(e){
    var s = String(pget(e,'_date')||'');
    var en = String(e.end || e.doneDate || e.endDate || '') || s;
    if(!s) return null;
    if(en < s) en = s;
    return {s:s, e:en};
  }
  function timelineHTML(arr, pt){
    var tot=arr.length;
    arr = applySrt(applyFlt(arr));
    var bar = fltBar(arr.length, tot);
    var y=+tlYM.slice(0,4), m=+tlYM.slice(5,7);
    var days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var mStart = tlYM+'-01', mEnd = tlYM+'-'+String(days).padStart(2,'0');

    var rows = arr.map(function(e){ var r=tlRange(e); return r? {e:e, r:r} : null; })
      .filter(function(x){ return x && x.r.e>=mStart && x.r.s<=mEnd; })
      .sort(function(a,b){ return a.r.s<b.r.s? -1 : (a.r.s>b.r.s? 1 : 0); });

    var head = '<div class="lf-bldbar">'
      + '<button type="button" id="lfTlPrev" class="lf-fx">‹</button>'
      + '<b style="font-size:14px;color:#1a2f45">'+y+'년 '+m+'월</b>'
      + '<button type="button" id="lfTlNext" class="lf-fx">›</button>'
      + '<button type="button" id="lfTlNow" class="lf-fx">이번 달</button>'
      + '<span style="font-size:11.5px;color:#a8b8c8">막대를 누르면 그 기록으로 · 끝 날짜가 없으면 하루짜리</span>'
      + '</div>';

    if(!rows.length) return bar + head
      + '<div class="lf-grid"><div class="lf-empty"><div class="ei">⏱</div>이 달에 걸친 기록이 없어요</div></div>';

    var ticks='';
    for(var d=1; d<=days; d++) ticks += '<span>'+(d%5===0||d===1? d : '')+'</span>';
    var grid=''; for(var g=0; g<days; g++) grid += '<i></i>';

    var trackW = 190 + days*36;      /* 머리줄과 각 줄의 폭을 똑같이 맞춘다 */
    var h = bar + head + '<div class="lf-tl">'
      + '<div class="lf-tlin" style="min-width:'+trackW+'px">'
      + '<div class="lf-tlh"><div class="n">이름</div><div class="g">'+ticks+'</div></div>';

    rows.forEach(function(x){
      var s = x.r.s < mStart ? mStart : x.r.s;
      var en= x.r.e > mEnd   ? mEnd   : x.r.e;
      var d1= +s.slice(8,10), d2= +en.slice(8,10);
      var left = ((d1-1)/days*100), wid = ((d2-d1+1)/days*100);
      var c = dsColor(x.e);
      h += '<div class="lf-tlr">'
        + '<div class="n" data-lpage="'+esc(x.e.id)+'">'+esc(pget(x.e,'_title')||'(제목없음)')+'</div>'
        + '<div class="g"><div class="lf-tlgrid">'+grid+'</div>'
        +   '<div class="lf-tlbar" data-lpage="'+esc(x.e.id)+'" style="left:'+left.toFixed(2)+'%;width:'+Math.max(wid,2.4).toFixed(2)+'%;background:'+c+'" title="'+esc(x.r.s+' ~ '+x.r.e)+'">'
        +     esc(String(pget(x.e,'f:status')||'').slice(0,8))
        +   '</div>'
        + '</div></div>';
    });
    return h+'</div></div>';
  }

  /* ══════════════════════════════════════════════════════════
     📸 갤러리 — 사진을 격자로
     ══════════════════════════════════════════════════════════ */
  function firstPic(e){
    var ph=esr(e.photos);
    for(var i=0;i<ph.length;i++){
      var u = (typeof ph[i]==='string') ? ph[i] : (ph[i] && (ph[i].url||ph[i].src||ph[i].dataUrl));
      if(u) return u;
    }
    var sr=esr(e.scanRefs);
    for(var j=0;j<sr.length;j++){
      var v=sr[j]; var u2 = v && (v.photoUrl||v.url||v.src);
      if(u2) return u2;
    }
    if(e.body){
      var bs=String(e.body);
      var mi=bs.indexOf('<img');
      if(mi>=0){
        var m=bs.slice(mi, mi+400000).match(/<img[^>]+src="([^"]+)"/);
        if(m) return m[1];
      }
    }
    return null;
  }
  function galleryHTML(arr, pt){
    var tot=arr.length;
    arr = applySrt(applyFlt(arr));
    var bar = fltBar(arr.length, tot);
    var onlyPic = !!flt._pic;
    var head = '<div class="lf-bldbar">'
      + '<span style="font-size:13px;font-weight:900;color:#1a2f45">📸 갤러리</span>'
      + '<label class="lf-ck" style="padding:5px 10px;border:1.5px solid #e8f0fa;border-radius:9px">'
      +   '<input type="checkbox" id="lfGalPic"'+(onlyPic?' checked':'')+'> 사진 있는 것만</label>'
      + '<span style="font-size:11.5px;color:#a8b8c8">카드를 누르면 그 기록으로</span>'
      + '</div>';
    var list = onlyPic ? arr.filter(function(e){ return !!firstPic(e); }) : arr;
    if(!list.length) return bar + head
      + '<div class="lf-grid"><div class="lf-empty"><div class="ei">📸</div>보여줄 기록이 없어요</div></div>';
    /* 사진은 무거워서 한 번에 너무 많이 그리지 않는다 */
    var CAP=120, cut=list.length>CAP;
    var shown = cut ? list.slice(0,CAP) : list;
    var h = bar + head
      + (cut? '<div style="font-size:12px;color:#8ba0b6;background:#fffbea;border-radius:9px;padding:7px 11px;margin-bottom:9px">'
             + '사진이 많아 앞의 '+CAP+'건만 보여드려요 (전체 '+list.length+'건) — 검색이나 조건으로 좁혀 보세요</div>' : '')
      + '<div class="lf-gal">';
    shown.forEach(function(e){
      var u=firstPic(e), n=esr(e.photos).length+esr(e.scanRefs).length;
      h += '<div class="lf-gc" data-lpage="'+esc(e.id)+'">'
        + '<div class="im">'+(u? '<img src="'+esc(u)+'" alt="">' : '🖼')+'</div>'
        + '<div class="bd"><div class="t">'+esc(pget(e,'_title')||'(제목없음)')+'</div>'
        +   '<div class="m"><span>'+esc(String(pget(e,'_date')||''))+'</span>'
        +   (n? '<span class="n">📎 '+n+'</span>':'')
        +   (pget(e,'f:status')? '<span class="n">'+esc(String(pget(e,'f:status')).slice(0,8))+'</span>':'')
        +   '</div></div></div>';
    });
    return h+'</div>';
  }

  /* ══════════════════════════════════════════════════════════
     📅 달력 보기
     ══════════════════════════════════════════════════════════ */
  var LS_CALM='wl_life_calm';
  var calYM = lsGet(LS_CALM,'') || today().slice(0,7);
  function calShift(n){
    var y=+calYM.slice(0,4), m=+calYM.slice(5,7)+n;
    while(m<1){ m+=12; y--; } while(m>12){ m-=12; y++; }
    calYM = y+'-'+String(m).padStart(2,'0'); lsSet(LS_CALM, calYM); safeRender();
  }
  /* ══ v216 — 달력에서 여러 종류를 겹쳐 보기 ═══════════════════
     달님 : 「한 곳에서 필터로 여러 조합을 보는 게 편하다」
     🔴 기본은 「지금 보고 있는 종류만」 — 아무것도 안 고르면 v215 와 똑같다.
        고른 것이 있을 때만 entries 에서 그 종류를 더 얹는다. */
  var LS_CALK='wl_cal_kinds';
  function calKinds(){
    try{
      var a = lsGet(LS_CALK, null);
      if(!Array.isArray(a)) return [];
      /* 받는 쪽에서 화이트리스트 검사 (지침 ⑭) */
      return a.filter(function(k){ return !!(WORK_KINDS && WORK_KINDS[k]); });
    }catch(e){ console.warn('[달력 종류] 읽기 실패', e); return []; }
  }
  /* v219 — 달님 : 「업무가 527건이라 얹은 게 묻힌다. 다른 걸 켰으면 업무도 끌 수 있게」
     🔴 얹은 종류가 하나도 없으면 끌 수 없다 — 달력이 통째로 비어 버린다. */
  var LS_CALOFF='wl_cal_curoff';
  function curOff(){
    try{ return !!lsGet(LS_CALOFF, false) && calKinds().length > 0; }
    catch(e){ return false; }
  }
  function curOffSet(v){ lsSet(LS_CALOFF, !!v); safeRender(); }
  function calKindsSet(a){
    a = a || [];
    lsSet(LS_CALK, a);
    if(!a.length) lsSet(LS_CALOFF, false);   /* 얹은 게 없어지면 지금 종류는 도로 켠다 */
    safeRender();
  }

  /* 종류마다 제목이 담기는 칸이 다르다 — 그 종류의 지도(BMAP)를 따라간다.
     지금 보는 종류는 기존대로 pget 을 쓰고, 얹은 종류만 이 함수를 쓴다. */
  function calKTitle(e){
    try{
      var bm = (window.wlBMAP || {})[(e && e.kind) || ''];
      var fs = bm && bm._title;
      if(fs) for(var i=0;i<fs.length;i++){
        var v = e[fs[i]];
        if(v!=null && v!=='') return String(v);
      }
    }catch(err){ console.warn('[달력] 제목 찾기 실패', err); }
    return String((e && (e.title || e.who || e.name)) || '');
  }

  function calMerge(arr){
    var on = calKinds();
    if(isPersonal() || !on.length) return arr;
    var curK = (DS && DS.kind) || '';
    var seen = {};
    arr.forEach(function(e){ if(e && e.id) seen[e.id] = 1; });
    var out = curOff() ? [] : arr.slice();   /* v219 — 지금 종류를 끄면 얹은 것만 */
    try{
      (entries || []).forEach(function(e){
        if(!e || !e.id || seen[e.id]) return;
        if(!e.kind || e.kind === curK) return;
        if(on.indexOf(e.kind) < 0) return;
        if(String(e.date || '').slice(0,7) !== calYM) return;   /* 그 달만 */
        out.push(e);
      });
    }catch(err){ console.warn('[달력] 다른 종류 모으기 실패', err); }
    return out;
  }

  /* 표시: [업무][청소][메모]… 눌러서 켜고 끈다 */
  /* v224 — 칩 16개가 늘 한 줄을 먹는다. 평소엔 접어 두고 눌렀을 때만 펼친다. */
  var LS_CALKOPEN='wl_cal_kopen';
  function kOpen(){ try{ return !!lsGet(LS_CALKOPEN, false); }catch(e){ return false; } }
  function kOpenSet(v){ lsSet(LS_CALKOPEN, !!v); safeRender(); }

  /* v224 — 펴고 접는 단추. 도구줄(fltBar)과 칩줄이 이 하나를 함께 쓴다.
     🔴 fltBar 보다 뒤에 있어도 된다 — function 선언이라 먼저 읽힌다(같은 구역). */
  function calKindToggle(){
    if(isPersonal()) return '';
    var on = calKinds(), off = curOff(), open = kOpen();
    return '<button type="button" class="lf-fx" data-calkopen="1"'
         + ' title="달력에 다른 종류를 얹어서 함께 봅니다"'
         + ' style="height:32px;padding:0 11px;font-size:12.5px;font-weight:800'
         + (on.length ? ';background:#eaf3fd;border-color:#2563a8;color:#2563a8' : '') + '">'
         + (open ? '\u25BE' : '\u25B8') + ' \uD83D\uDCC5 함께 보기'
         + (on.length ? ('<b style="margin-left:4px">'+on.length+'</b>') : '')
         + (off ? '<span style="color:#b52929;margin-left:5px">\u00B7 이 종류 감춤</span>' : '')
         + '</button>';
  }

  function calKindChips(){
    if(isPersonal()) return '';
    /* v224 — 접혀 있으면 여기서는 아무것도 안 그린다.
       접기 단추는 도구줄 안에 있으므로 줄 하나를 통째로 아낀다. */
    if(!kOpen()) return '';
    var on = calKinds(), curK = (DS && DS.kind) || '', off = curOff();
    var h = '<div class="lf-fb" style="margin-top:8px"><div class="lf-fbwrap">'
          + '<div class="lf-fbmid" style="flex-wrap:wrap;row-gap:6px">'
          + calKindToggle()
          + '<span class="lf-fbsep"></span>';
    DS_ORDER.forEach(function(k){
      var w = WORK_KINDS[k]; if(!w) return;
      var isCur = (k === curK);
      var act   = isCur ? !off : (on.indexOf(k) >= 0);
      h += '<button type="button" class="lf-fx" data-calk="'+esc(k)+'"'
         + ' title="' + (isCur
             ? (on.length ? '지금 보고 있는 종류 \u2014 눌러서 잠깐 감출 수 있어요'
                          : '지금 보고 있는 종류 \u2014 다른 종류를 하나 켜면 감출 수 있어요')
             : '눌러서 달력에 얹기') + '"'
         + ' style="height:32px;padding:0 10px;font-size:12.5px;font-weight:800'
         + (act ? (';background:'+w.c+'1f;border-color:'+w.c+';color:'+w.c) : '')
         + (isCur && !act ? ';opacity:.55;text-decoration:line-through' : '')
         + '">' + w.i + ' ' + esc(w.n) + '</button>';
    });
    h += '<button type="button" class="lf-fx" data-calk="__none"'
      +  ' title="얹은 종류를 모두 끄고 지금 종류만 봅니다"'
      +  ' style="height:32px;padding:0 10px;font-size:12.5px;font-weight:800;'
      +  'color:#b52929;border-color:#f0c9c9;background:#fff6f6">✕ 이 종류만</button>';
    return h + '</div></div></div>';
  }

  function calHTML(arr, pt){
    var tot=arr.length;
    arr = applyFlt(arr);
    var bar = fltBar(arr.length, tot);
    arr = calMerge(arr);                     /* v216 — 고른 종류를 얹는다 */
    var y=+calYM.slice(0,4), m=+calYM.slice(5,7);
    var first=new Date(y, m-1, 1), start=first.getDay();
    var days=new Date(y, m, 0).getDate();
    var byDay={};
    arr.forEach(function(e){ var d=String(e.date||''); if(d.slice(0,7)===calYM){ var k=+d.slice(8,10); (byDay[k]=byDay[k]||[]).push(e); } });
    var mSum=0; arr.forEach(function(e){ if(String(e.date||'').slice(0,7)===calYM) mSum+=money(e); });

    var h = bar
      + calKindChips()                       /* v216 */
      + '<div class="lf-calhead">'
      +   '<button type="button" id="lfCalPrev">‹</button>'
      +   '<b>'+y+'년 '+m+'월</b>'
      +   '<button type="button" id="lfCalNext">›</button>'
      +   '<button type="button" id="lfCalNow" class="lf-fx" style="margin-left:8px">이번 달</button>'
      +   (mSum? '<span style="margin-left:auto;font-size:13px;font-weight:900;color:#0f7a4a">'+numFmt(mSum)+'원</span>':'')
      + '</div>'
      + '<div class="lf-cal">';
    ['일','월','화','수','목','금','토'].forEach(function(d,i){
      h+='<div class="lf-cdow"'+(i===0?' style="color:#dc2626"':(i===6?' style="color:#2563a8"':''))+'>'+d+'</div>'; });
    for(var i=0;i<start;i++) h+='<div class="lf-cday off"></div>';
    for(var d=1;d<=days;d++){
      var list=byDay[d]||[];
      var isT = (calYM+'-'+String(d).padStart(2,'0'))===today();
      h+='<div class="lf-cday'+(isT?' today':'')+'" data-cday="'+d+'">'
        + '<div class="dn">'+d+'</div>'
        + list.map(function(e){
            /* v216 — 얹은 종류인가? 그렇다면 그 종류의 색·아이콘·제목을 쓴다 */
            var otherK = (!isPersonal() && DS && e.kind && e.kind !== DS.kind) ? e.kind : '';
            var wk = otherK ? (WORK_KINDS[otherK] || null) : null;
            var dd = e.ptype==='car' ? {c:carColor(e.car)}
                   : (wk ? {c:wk.c} : (cats()[e.ptype]||catEtc()));
            var ch=colorHit(e,pt);
            var inner = wk ? (wk.i + ' ' + esc(calKTitle(e)))
                           : (pfxHTML(e) + esc(String(pget(e,'_title')||'')));
            return '<div class="ev" data-cid="'+esc(e.id)+'"'
              + (otherK ? (' data-ckind="'+esc(otherK)+'"') : '')
              + ' style="border-left-color:'+dd.c
              + (ch? ';background:'+colorOf(ch.color).bg:'') + '" title="'+esc(e.title||'')+'">'
              + inner + '</div>'; }).join('')
        + (list.length>1? '<div class="more">'+list.length+'건</div>':'')
        + '</div>';
    }
    return h+'</div>';
  }



  /* ══════════════════════════════════════════════════════════
     📝 본문 서식 — 굵게 · 목록 · 체크박스 · 구분선
     ══════════════════════════════════════════════════════════ */
  var PGBODY_MAX = 700000;      /* 클라우드 한 건 1MB — 여유 두고 경고 */

  /* 옛날에 저장한 순수 글자를 HTML 로 */
  function bodyToHTML(v){
    var s=String(v==null?'':v);
    if(!s) return '';
    if(/<(p|div|ul|ol|li|br|h[1-3]|hr|img|b|i|u|s|blockquote)\b/i.test(s)) return s;   /* 이미 HTML */
    return s.split(/\n{2,}/).map(function(par){
      return '<div>'+esc(par).replace(/\n/g,'<br>')+'</div>';
    }).join('<div><br></div>');
  }
  function htmlSize(h){ return (h||'').length; }

  var PGTOOLS = [
    {c:'bold',        i:'<b>B</b>',        t:'굵게 (Ctrl+B)'},
    {c:'italic',      i:'<i>I</i>',        t:'기울임 (Ctrl+I)'},
    {c:'underline',   i:'<u>U</u>',        t:'밑줄 (Ctrl+U)'},
    {c:'strikeThrough',i:'<s>S</s>',       t:'취소선'},
    {sep:1},
    {c:'h',           i:'H',               t:'제목'},
    {c:'quote',       i:'❝',               t:'인용'},
    {sep:1},
    {c:'insertUnorderedList', i:'• 목록',  t:'글머리 목록'},
    {c:'insertOrderedList',   i:'1. 번호',  t:'번호 목록'},
    {c:'todo',        i:'☑ 체크',          t:'체크박스 목록'},
    {sep:1},
    {c:'hr',          i:'—',               t:'구분선'},
    {c:'pic',         i:'📷',              t:'사진 넣기'},
    {sep:1},
    {c:'clearBody',   i:'✕',               t:'본문 내용을 전부 지웁니다'}
  ];
  function pgToolbarHTML(){
    return '<div class="pg-tb">' + PGTOOLS.map(function(t){
      if(t.sep) return '<span class="sp"></span>';
      return '<button type="button" data-pgc="'+t.c+'" title="'+esc(t.t)+'">'+t.i+'</button>';
    }).join('') + '</div>';
  }

  /* 서식 넣기 */
  function pgExec(cmd, ed){
    ed.focus();
    try{
      if(cmd==='h'){
        var blk = document.queryCommandValue('formatBlock');
        document.execCommand('formatBlock', false, (/h2/i.test(blk)) ? 'div' : 'h2');
      }
      else if(cmd==='quote'){
        var b2 = document.queryCommandValue('formatBlock');
        document.execCommand('formatBlock', false, (/blockquote/i.test(b2)) ? 'div' : 'blockquote');
      }
      else if(cmd==='hr'){ document.execCommand('insertHTML', false, '<hr><div><br></div>'); }
      else if(cmd==='todo'){
        document.execCommand('insertUnorderedList');
        /* 방금 만든 목록을 체크박스 목록으로 */
        var s=window.getSelection(); if(!s.rangeCount) return;
        var n=s.anchorNode; while(n && n!==ed && !(n.tagName==='UL'||n.tagName==='OL')) n=n.parentNode;
        if(n && n!==ed){
          if(n.classList.contains('pgck')) n.classList.remove('pgck');
          else { n.classList.add('pgck');
            [].forEach.call(n.children, function(li){ if(!li.hasAttribute('data-c')) li.setAttribute('data-c','0'); }); }
        }
      }
      else document.execCommand(cmd, false, null);
    }catch(e){ console.warn('[본문]', e); }
  }

  /* 사진을 본문에 넣기 */
  function pgInsertPics(files, ed, done){
    var imgs = [].filter.call(files, function(f){ return /^image\//.test(f.type); });
    var others = [].filter.call(files, function(f){ return !/^image\//.test(f.type); });
    if(others.length && !imgs.length){
      askInfo('본문에는 사진만 넣을 수 있어요.\n\n영수증·서류는 [✏️ 전체 서식] 의 🧾 영수증·명함 첨부를 쓰세요.');
      return;
    }
    if(!imgs.length) return;
    var i=0;
    (function next(){
      if(i>=imgs.length){ if(done) done(); return; }
      shrink(imgs[i++]).then(function(u){
        if(u){ ed.focus();
          try{ document.execCommand('insertHTML', false, '<img src="'+u+'"><div><br></div>'); }catch(e){}
        }
        next();
      }).catch(next);
    })();
  }

  /* 본문 편집기 붙이기 */
  function pgBindBody(ed, getRec, save){
    /* 체크박스 토글 — 왼쪽 표식 영역을 누르면 */
    ed.addEventListener('click', function(e){
      var li=e.target.closest && e.target.closest('.pgck > li');
      if(!li) return;
      var r=li.getBoundingClientRect();
      if(e.clientX - r.left > 26) return;                 /* 글자 영역은 그냥 커서 */
      e.preventDefault();
      li.setAttribute('data-c', li.getAttribute('data-c')==='1' ? '0':'1');
      save(ed.innerHTML);
    });
    /* ── 본문 사진 — 눌러서 고르고 🗑 로 지운다 ── */
    function pgImgBarOff(){ var b=document.getElementById('pgImgBar'); if(b) b.remove(); }
    function pgImgClear(){ [].forEach.call(ed.querySelectorAll('img.pgsel'), function(x){ x.classList.remove('pgsel'); }); pgImgBarOff(); }
    ed.addEventListener('click', function(e){
      var t=e.target;
      pgImgClear();
      if(!t || t.tagName!=='IMG') return;
      t.classList.add('pgsel');
      var r=t.getBoundingClientRect();
      var b=document.createElement('button');
      b.type='button'; b.id='pgImgBar';
      b.textContent='🗑 이 사진 지우기';
      b.style.cssText='position:fixed;z-index:99999;background:#b52929;color:#fff;border:none;'
        + 'border-radius:10px;padding:10px 15px;font-size:13.5px;font-weight:800;cursor:pointer;'
        + 'font-family:inherit;box-shadow:0 5px 18px rgba(0,0,0,.28);min-height:44px';
      b.style.left = Math.max(8, Math.min(window.innerWidth-170, r.left+10)) + 'px';
      b.style.top  = Math.max(8, r.top+10) + 'px';
      b.addEventListener('click', function(ev){
        ev.preventDefault(); ev.stopPropagation();
        t.remove(); pgImgBarOff(); save(ed.innerHTML);
      });
      document.body.appendChild(b);
    });
    /* 고른 사진은 Delete·Backspace 로도 지운다 */
    ed.addEventListener('keydown', function(e){
      if(e.key!=='Delete' && e.key!=='Backspace') return;
      var s=ed.querySelector('img.pgsel'); if(!s) return;
      e.preventDefault(); s.remove(); pgImgBarOff(); save(ed.innerHTML);
    });
    ed.addEventListener('blur', function(){ setTimeout(pgImgBarOff, 250); });
    window.addEventListener('scroll', pgImgBarOff, true);

    /* 붙여넣기 — 서식 없는 글자 + 사진 */
    ed.addEventListener('paste', function(e){
      var dt=e.clipboardData; if(!dt) return;
      var fs=[].filter.call(dt.files||[], function(f){ return /^image\//.test(f.type); });
      if(fs.length){ e.preventDefault(); pgInsertPics(fs, ed, function(){ save(ed.innerHTML); }); return; }
      e.preventDefault();
      var t=dt.getData('text/plain')||'';
      document.execCommand('insertText', false, t);
    });
    /* 끌어놓기 */
    ['dragenter','dragover'].forEach(function(ev){
      ed.addEventListener(ev, function(e){ e.preventDefault(); ed.classList.add('drop'); }); });
    ['dragleave','dragend'].forEach(function(ev){
      ed.addEventListener(ev, function(){ ed.classList.remove('drop'); }); });
    ed.addEventListener('drop', function(e){
      e.preventDefault(); ed.classList.remove('drop');
      var fs=(e.dataTransfer&&e.dataTransfer.files)||[];
      if(fs.length){ pgInsertPics(fs, ed, function(){ save(ed.innerHTML); }); }
    });
    /* 단축키 */
    ed.addEventListener('keydown', function(e){
      if(!(e.ctrlKey||e.metaKey)) return;
      var k=e.key.toLowerCase();
      if(k==='b'||k==='i'||k==='u'){ /* 브라우저 기본 동작이 처리 */ }
      if(k==='s'){ e.preventDefault(); save(ed.innerHTML); }
    });
  }

  /* ══════════════════════════════════════════════════════════
     📄 페이지 보기 — 목록의 한 줄을 한 장의 페이지로
        · 위: 제목 + 속성들 (그 자리에서 고침)
        · 아래: 본문 — 자유롭게 길게 쓰는 곳
     ══════════════════════════════════════════════════════════ */
  var PGLIST = [];        /* ◀ ▶ 이동용 — 지금 목록 순서 */
  var PGEDIT = false;     /* 속성 정리 모드 — 켜야만 ⋮⋮ · ✕ 가 나온다 */
  var PGASMOD = false;    /* true 면 페이지를 창(모달)으로 띄운다 */
  var PGASMOD_PEND = null;/* 입구에서 정해 준 값 — 새로 열 때 딱 한 번 쓴다 */
  /* 진단 탭 「기록을 누르면」 설정을 그대로 따른다.
     worklog.js 가 옛 파일이라 wlOpenStyle 이 없으면 예전대로 전체 페이지 */
  /* v258 — 달님 : 「페이지 보기와 창으로 보기는 별 차이가 없다」 → 사람이 고르지 않는다.
     PC(1180px 이상)는 창(뒤에 목록이 보임), 휴대폰·좁은 화면은 전체 페이지(뒤로가기로 복귀).
     wlPageStyle('page') 로 억지로 정한 경우만 그 값을 따른다. */
  function pgWantModal(){
    /* v261 — 예전에 [📄 페이지로] 를 눌러 남은 'page' 값이 창을 못 뜨게 했다 (달님 PC 실측). 저장값은 더 안 본다.
       v263 — 달님 : 「노션 보기는 전체 창으로」 → 📋 서식 보기 = 절반 창(PC) / 📄 노션 보기 = 전체 페이지 */
    try{
      var compact = localStorage.getItem('wl_pg_compact') === '1';
      if(!compact) return false;
      return (window.innerWidth || 1400) >= 1180;
    }catch(e){ return false; }
  }
  /* 창 모드일 때만 오른쪽 떠다니는 단추를 잠시 감춘다.
     인라인 display:flex !important 라 CSS 로는 못 이겨서 여기서 처리한다.
     ⚠ innerHTML 은 절대 건드리지 않는다 (버튼 기능이 깨진다) */
  /* 페이지가 떠 있는 동안 뒤쪽 본문 스크롤을 잠근다 —
     안 잠그면 스크롤바가 두 개 생기고 머리말 고정이 어긋나 보인다 */
  function pgLock(on){
    try{
      var b=document.body, e=document.documentElement;
      if(on){
        if(b._pgOv==null){ b._pgOv = b.style.overflow||''; e._pgOv = e.style.overflow||''; }
        b.style.overflow='hidden'; e.style.overflow='hidden';
      }else if(b._pgOv!=null){
        b.style.overflow=b._pgOv; e.style.overflow=e._pgOv||'';
        b._pgOv=null; e._pgOv=null;
      }
    }catch(err){ console.warn('[페이지 스크롤 잠금]', err); }
  }
  function pgFab(hide){
    try{
      ['v43FabHeader','v43FabDiary'].forEach(function(fid){
        var f=document.getElementById(fid); if(!f) return;
        if(hide){ if(f._pgD==null) f._pgD = f.style.display || 'flex';
                  f.style.setProperty('display','none','important'); }
        else if(f._pgD!=null){ f.style.setProperty('display', f._pgD, 'important'); f._pgD=null; }
      });
    }catch(e){ console.warn('[FAB 감추기]', e); }
  }

  function pgAutoGrow(el){
    if(!el) return;
    el.style.height='auto';
    el.style.height=(el.scrollHeight+4)+'px';
  }

  /* v178 — 정산표 등 바깥에서도 노션식 상세 창을 열 수 있게 (지침 2-2 · 창구 노출) */
  try{ window.wlOpenPage = function(id){ return openPage(id); }; }catch(e){}
  function openPage(id){
    var rec = ent().filter(function(x){ return x.id===id; })[0];
    if(!rec){ noteMsg('기록을 못 찾았어요'); return; }
    var pt = DS.ptypeOf(rec) || 'etc';
    var d  = (isPersonal() && pt==='car') ? {i:'🚗', n:'차계부', c:carColor(rec.car)} : (cats()[pt]||catEtc());

    var ov = document.getElementById('lfPageOv');
    /* ★ v113 — 이미 떠 있어도 입구에서 「이 모양으로 열어라」고 정해 줬으면 그대로 따른다.
          예전에는 이 줄이 아래 if(!ov) 안에만 있어서, 창이 떠 있는 동안
          [📄 페이지로] 를 눌러도 저장값만 바뀌고 화면은 창 그대로였다. (2026-08-29 실측) */
    if(ov && PGASMOD_PEND != null) PGASMOD = PGASMOD_PEND;
    if(!ov){
      /* 새로 여는 것 → 입구에서 정해 준 값, 없으면 설정을 따른다.
         이미 떠 있으면(다시 그리기) 지금 모드를 그대로 지킨다 */
      PGASMOD = (PGASMOD_PEND==null) ? pgWantModal() : PGASMOD_PEND;
      ov=document.createElement('div'); ov.id='lfPageOv'; ov.className='lf-page-ov';
      document.body.appendChild(ov);
    }
    PGASMOD_PEND = null;
    /* 다시 그릴 때마다 창/전체 모드를 유지한다 */
    ov.className = 'lf-page-ov' + (PGASMOD ? ' as-modal' : '');
    pgFab(true); pgLock(true);   /* v92: 전체 페이지에서도 FAB 이 내용을 가려서 항상 숨긴다 */
    var idx = PGLIST.indexOf(id);

    /* 속성 줄 하나 */
    function propRow(p){
      /* 값 없이 표시만 하는 속성 — 한 줄 전체를 제목/안내로 쓴다 */
      if(p.type==='head') return '<div class="pg-prow wide pg-sechd" data-prow="'+esc(p.id)+'">'
        + '<span class="pg-drag" title="끌어서 옮기기">⋮⋮</span>'
        + '<span class="pg-sect">'+esc(p.name)+'</span>'
        + '<button type="button" class="pg-pdel" data-ppdel="'+esc(p.id)+'" title="이 속성 빼기">✕</button></div>';
      if(p.type==='desc') return '<div class="pg-prow wide pg-sechd" data-prow="'+esc(p.id)+'" style="border-top:none;margin-top:0;padding-top:0">'
        + '<span class="pg-drag" title="끌어서 옮기기">⋮⋮</span>'
        + '<span class="pg-sect" style="font-weight:600;color:#7a92a8;font-size:12.5px;line-height:1.6">'+esc(p.name)+'</span>'
        + '<button type="button" class="pg-pdel" data-ppdel="'+esc(p.id)+'" title="이 속성 빼기">✕</button></div>';
      var v = pget(rec, p.id);
      var ti = tinfo(p.type);
      var ro = (ti.ro && p.type!=='rows') || (p.id==='_amount' && amountLocked(rec));
      var body;
      if(p.type==='rows'){
        body = pgRowsHTML(p, esr(rec[p.k||p.id.slice(2)]));
      } else if(p.type==='formula'){
        var fv=formulaCalc(rec, p.expr, pt);
        body='<span class="pg-ro">'+(fv===''?'—':numFmt(fv)+(p.unit?(' '+esc(p.unit)):''))+'</span>';
      } else if(p.type==='rollup'){
        var rv=rollupCalc(rec, p, pt);
        body = Array.isArray(rv)
          ? '<span class="pg-ro">'+(rv.length
              ? rv.map(function(id){ return '<span class="lf-relchip" data-relgo="'+esc(id)+'">'+esc(relLabel(id))+'</span>'; }).join('')
              : '—')+'</span>'
          : '<span class="pg-ro" style="color:#0891b2">'+(rv===''?'—':numFmt(rv)+(p.unit?(' '+esc(p.unit)):''))+'</span>';
      } else if(ro){
        body='<span class="pg-ro">'+cellHTML(rec,p)+'</span>'
          + (p.id==='_amount' && amountLocked(rec)
             ? '<div style="font-size:11.5px;color:#a8b8c8;padding:0 10px">아래 항목 합계로 자동 계산돼요</div>':'');
      } else {
        body='<div class="pg-val" data-ppid="'+esc(p.id)+'">'+cellHTML(rec,p)+'</div>';
      }
      /* 긴 글·표·연결 같은 것은 한 줄 통째로 쓴다 */
      var wide = (['area','rows','rel','multi','att','map','link'].indexOf(p.type)>=0);
      return '<div class="pg-prow'+(wide?' wide':'')+'" data-prow="'+esc(p.id)+'">'
        + '<div class="pg-pk">'
        +   '<span class="pg-drag" title="끌어서 옮기기">⋮⋮</span>'
        +   '<span class="pg-pnm">'+ti.i+' '+esc(p.name)+'</span>'
        +   (ftypeLocked(p.id) && p.id.slice(0,2)==='f:'
              ? ''
              : (p.base && p.id.slice(0,2)!=='f:'
                  ? ''
                  : '<button type="button" class="pg-ptype" data-pptype="'+esc(p.id)+'" title="종류 바꾸기">'+ti.i+'</button>'))
        +   '<button type="button" class="pg-pdel" data-ppdel="'+esc(p.id)+'" title="이 속성 빼기">✕</button>'
        + '</div>'
        + '<div class="pg-pv">'+body+'</div></div>';
    }

    /* 반복 항목(메뉴·정비항목 등) */
    function pgRowsHTML(p, rows){
      var key = p.k || p.id.slice(2);
      var f = null;
      var base = isPersonal()
        ? ((pt==='car') ? carFields(rec.ctype||'주유') : ((cats()[pt]||catEtc()).f||[]))
        : (DS.fieldsOf(pt)||[]);
      base.forEach(function(x){ if(x.k===key) f=x; });
      if(!f) return '<span class="pg-ro">—</span>';
      var tot=0;
      var h='<table class="pg-rows"><tbody>';
      rows.forEach(function(r,i){
        h+='<tr>'+f.cols.map(function(c){
          var val=r[c.k]==null?'':String(r[c.k]);
          if(c.n) tot+= (c.k===f.sum? num(val):0);
          if(c.sel) return '<td><select data-prk="'+key+'|'+i+'|'+c.k+'">'
            + c.sel.map(function(o){ return '<option'+(val===o?' selected':'')+'>'+esc(o)+'</option>'; }).join('')+'</select></td>';
          return '<td><input type="text" data-prk="'+key+'|'+i+'|'+c.k+'"'+(c.n?' data-num="1"':'')
            + ' value="'+esc(c.n?numFmt(val):val)+'" placeholder="'+esc(c.p||'')+'"></td>'; }).join('')
          + '<td style="width:30px"><button type="button" class="pg-rx" data-prdel="'+key+'|'+i+'">✕</button></td></tr>';
      });
      h+='</tbody></table>'
        + '<div style="display:flex;gap:8px;align-items:center;margin-top:6px">'
        + '<button type="button" class="lf-radd" style="height:30px;font-size:12px" data-pradd="'+key+'">＋ 줄 추가</button>'
        + (f.sum && tot? '<span style="font-size:12.5px;font-weight:900;color:#0f7a4a">합계 '+numFmt(tot)+'원</span>':'')
        + '</div>';
      return h;
    }

    /* ── 하위 항목 ── */
    function subHTML(r){
      var kids = ent().filter(function(x){ return DS.mine(x) && x.parentId===r.id; })
        .sort(function(a,b){ return String(a.date||'').localeCompare(String(b.date||'')); });
      var doneN = kids.filter(function(k){ return k.done; }).length;
      return '<div class="pg-div"></div>'
        + '<div class="pg-sec">🧷 하위 항목'
        + (kids.length? ' <span>'+doneN+' / '+kids.length+' 완료</span>' : ' <span>이 기록에 딸린 세부 항목</span>') + '</div>'
        + '<div class="pg-subs">'
        + (kids.length ? kids.map(function(k){
            var dd=dday(k.date);
            return '<div class="pg-sub'+(k.done?' done':'')+'" data-subid="'+esc(k.id)+'">'
              + '<button type="button" class="ck" data-subck="'+esc(k.id)+'">'+(k.done?'☑':'☐')+'</button>'
              + '<span class="tt" data-subgo="'+esc(k.id)+'">'+esc(k.title||'(제목없음)')+'</span>'
              + (k.date? '<span class="dt">'+esc(k.date)
                  + (!k.done && dd!==null && dd<=7 ? ' <b style="color:'+(dd<0?'#dc2626':'#b26b00')+'">'
                      + (dd<0? (-dd)+'일 지남' : (dd===0?'오늘':'D-'+dd)) + '</b>' : '') + '</span>':'')
              + (money(k)? '<span class="am">'+numFmt(money(k))+'원</span>':'')
              + '<button type="button" class="rm" data-subdel="'+esc(k.id)+'">✕</button>'
              + '</div>'; }).join('')
           : '<div class="pg-none" style="padding:6px 2px">아직 없어요 — 아래에서 추가하세요</div>')
        + '</div>'
        + '<div class="pg-subadd">'
        +   '<input type="text" id="pgSubIn" placeholder="＋ 하위 항목 — 쓰고 Enter">'
        +   '<button type="button" id="pgSubGo">추가</button>'
        + '</div>';
    }

    var _phd = phideOf(pt);
    /* ── 📦 자재 · 📎 파일·폴더 · ⏱ 소요 — 예전 입력창에만 있던 것들 ── */
    /* 자재 합계 = Σ 단가 × 수량 (단가가 등록된 자재만) */
    function matSum(arr){
      try{ return (arr||[]).reduce(function(a,m){
        return a + (Number(m && m.price)||0) * (Number(m && m.qty)||1); }, 0); }
      catch(e){ return 0; }
    }
    /* ★ v113 — 자재를 넣고 뺄 때마다 「합계」 칸을 자재 합계로 맞춘다.
          달님 : 「금액 부분은 합계로 고치고 합계금액 전체가 들어가게」
          단가가 하나도 없으면(합계 0) 손으로 적은 금액을 지우지 않는다. */
    function matPatch(arr){
      var patch = { materials: arr };
      /* v135 — 달님 : 「자재쪽 합계는 자재쪽 칸에 저장되게」
            예전에는 자재 값이 비용의 「합계」(cost) 를 덮어써서,
            외주비를 적어 두면 자재를 담는 순간 사라졌다. 이제 따로 담는다. */
      try{ patch.matCost = matSum(arr); }
      catch(e){ console.warn('[자재 합계] 계산 실패', e); }
      return patch;
    }
    /* 금액 칸이 비어 있을 때만 자재 합계를 넣는다. force 면 덮어쓴다 */
    function amountPatch(sum2, force){
      try{
        if(!(sum2>0)) return null;
        if(amountLocked(rec)) return null;          /* 아래 항목 합계로 자동 계산되는 기록은 건드리지 않는다 */
        if(!propById(pt,'_amount')) return null;
        var cur = Number(pget(rec,'_amount'))||0;
        if(cur && !force) return null;
        return ppatch(rec, '_amount', sum2);
      }catch(e){ console.warn('[금액 자동]', e); return null; }
    }
    function extrasHTML(r){
      var h2='';
      /* 🔗 업무에서 가져온 기록이면 원본으로 가는 칩을 보여준다 */
      if(r && r.workRef){
        var lw = null;
        try{ lw = (entries||[]).filter(function(x){ return x.id===r.workRef; })[0]; }catch(e){}
        h2 += '<div class="pg-div"></div>'
          + '<div class="pg-sec">🔗 연결된 업무</div>'
          + '<div class="pg-extra">'
          + (lw ? '<span class="lf-relchip" data-relgo="'+esc(lw.id)+'">'
                  + esc((lw.date||'') + ' · ' + (lw.title||'(제목 없음)')) + '</span>'
                : '<span class="pg-none">원본 업무를 못 찾았어요 (지워졌을 수 있어요)</span>')
          + '<button type="button" class="pg-xb" data-unlink="1">연결 끊기</button>'
          + '</div>';
      }
      var tps = (typeof props!=='undefined' ? props : []).filter(function(p){ return p.type==='time'; });
      if(tps.length>=2){
        h2 += '<div class="pg-div"></div>'
          + '<div class="pg-sec">⏱ 소요 시간 <span>누르면 「'+esc(tps[1].name)+'」 이 저절로 채워집니다</span></div>'
          + '<div class="pg-extra">'
          + [[30,'30분'],[60,'1시간'],[90,'1시간반'],[120,'2시간'],[180,'3시간'],[240,'4시간']].map(function(x){
              return '<button type="button" class="pg-xb" data-dur="'+x[0]+'">'+x[1]+'</button>'; }).join('')
          + '<button type="button" class="pg-xb" data-duradd="10">+10분</button>'
          + '<button type="button" class="pg-xb" data-duradd="-10">−10분</button>'
          + '</div>';
      }
      var mats = esr(r.materials);
      var mSum = matSum(mats);
      h2 += '<div class="pg-div"></div>'
        + '<div class="pg-sec">📦 자재 사용 내역 <span>이 기록에 쓴 자재</span></div>'
        + '<div class="pg-subs">'
        + (mats.length ? mats.map(function(m,i){
            var line = (Number(m.price)||0) * (Number(m.qty)||1);
            return '<div class="pg-sub"><span class="tt">'+esc(m.name||'')
              + (m.spec? ' <span style="color:#8ba0b6;font-weight:600">'+esc(m.spec)+'</span>':'')
              + ' <span style="color:#3f7cb8">× '+(Number(m.qty)||1)+'</span>'
              + (line? ' <span style="color:#b45309;font-weight:700">'+numFmt(line)+'원</span>':'')
              + '</span>'
              + '<button type="button" class="x" data-matdel="'+i+'" title="빼기">✕</button></div>'; }).join('')
           : '<div class="pg-none">아직 없어요 — 아래에서 추가하세요</div>')
        + '</div>'
        /* v118 — 「💰 금액 칸에 넣기」 단추를 없앴다.
              자재를 넣고 뺄 때마다 합계가 저절로 들어가므로 누를 일이 없다.
              달님 : 「금액칸도 따로 넣기 말고 자동으로 들어가게 하면 화면이 작아지잔아」 */
        + (mSum>0 ? '<div class="pg-extra" style="align-items:center">'
            + '<span style="font-size:13.5px;font-weight:800;color:#b45309">자재 합계 '+numFmt(mSum)+'원</span>'
            + '<span style="font-size:12px;color:#a8b8c8">합계 칸에 저절로 들어갑니다</span></div>' : '')
        + '<div class="pg-extra">'
        +   '<button type="button" id="pgMatPick" class="pg-xb on">📦 자재에서 고르기</button>'
        +   '<input type="text" id="pgMatN" placeholder="자재명 (직접 입력)" style="flex:2;min-width:120px">'
        +   '<input type="text" id="pgMatS" placeholder="규격 (선택)" style="flex:1.3;min-width:90px">'
        +   '<input type="number" id="pgMatQ" placeholder="수량" value="1" min="0" style="flex:0 0 78px">'
        +   '<input type="number" id="pgMatP" placeholder="단가" min="0" style="flex:0 0 92px">'
        +   '<button type="button" id="pgMatAdd" class="pg-xb">추가</button>'
        + '</div>';
      var atts = esr(r.attachments);
      h2 += '<div class="pg-div"></div>'
        + '<div class="pg-sec">📎 파일 · 폴더 링크 <span>내 컴퓨터 경로를 적어두는 곳</span></div>'
        + '<div class="pg-subs">'
        + (atts.length ? atts.map(function(a,i){
            return '<div class="pg-sub"><span class="tt">'+esc(a.label||'(별칭 없음)')
              + ' <span style="color:#8ba0b6;font-weight:600;font-size:12.5px">'+esc(a.path||'')+'</span></span>'
              + '<button type="button" class="x" data-attcopy="'+i+'" title="경로 복사">📋</button>'
              + '<button type="button" class="x" data-attdel="'+i+'" title="빼기">✕</button></div>'; }).join('')
           : '<div class="pg-none">아직 없어요</div>')
        + '</div>'
        + '<div class="pg-extra">'
        +   '<input type="text" id="pgAttL" placeholder="별칭 (예: 품의서 원본)" style="flex:1.2;min-width:110px">'
        +   '<input type="text" id="pgAttP" placeholder="C:\\경로\\파일명.확장자" style="flex:2;min-width:150px">'
        +   '<button type="button" id="pgAttAdd" class="pg-xb on">추가</button>'
        + '</div>';
      return h2;
    }

    /* ★ v117 — 「언제·어디서·무엇」 앞자리 칸은 비어 있어도 늘 보인다.
          예전에는 값이 있는 칸이 먼저 오고 빈 칸은 뒤로 밀려서,
          「해당층·분야를 날짜 옆으로」가 아무리 고쳐도 안 됐다. (달님 신고 4회)
          숨김 목록에 들어 있어도 되살린다 — 기본 칸이라 감춰 두면 안 된다. */
    var ALWAYS = { '_date':1, 'f:refYear':1, 'f:refMonth':1, 'f:floor':1, 'f:field':1, 'f:status':1,
                   '_memo':1,     /* v133 — 「내용」은 비어 있어도 기본 바로 밑에 (달님 요청) */
                   'f:dtype':1, 'f:vtype':1 };   /* v197 — 전달 종류 · 휴가 종류도 늘 보이게 */
    /* ══ v199 — 달님 : 「기존 모달에는 있고 노션식에는 없는 걸 같은 상황으로 만들어줘」 ══
          14종을 전부 재어 보니 **노션식에 빠진 칸은 없었다** (오히려 더 많다).
          진짜 차이는 이것 — 옛 입력창은 빈 칸도 늘 보여 주는데,
          페이지는 비어 있으면 「빈 항목」에 접혀 안 보였다.
          → 옛 입력창의 기본 칸(SCHEMA[종류])은 비어 있어도 늘 보이게 맞춘다.
             그 밖의 덧칸(WORK_EXTRA)은 예전처럼 「빈 항목」에 접어 둔다. */
    try{
      if(!isPersonal() && typeof SCHEMA === 'object' && SCHEMA && SCHEMA[pt]){
        SCHEMA[pt].forEach(function(f){ if(f && f.k) ALWAYS['f:' + f.k] = 1; });
      }
    }catch(e){ console.warn('[늘 보이는 칸] SCHEMA 읽기 실패', e); }
    /* v119 — 지금 고른 모드(지출종류 등)가 요구하는 칸도 늘 보인다.
          비어 있다고 「빈 항목」 뒤로 밀리면 합계와 따로 떨어져 보기 나쁘다. */
    try{
      if(typeof window.wlModeProps === 'function' && typeof window.wlModeSwitch === 'function'){
        var _sw = window.wlModeSwitch(pt);
        if(_sw){
          var _cv = rec[_sw.slice(2)];
          window.wlModeProps(pt, _cv).forEach(function(k){ ALWAYS[k] = 1; });
        }
      }
    }catch(e){ console.warn('[모드 칸] 읽기 실패', e); }
    var props = propsOf(pt).filter(function(p){
      if(p.id==='_title' || p.id==='_att' || p.id==='_cat') return false;
      if(ALWAYS[p.id]) return true;                      /* 앞자리 칸은 숨기지 않는다 */
      return _phd.indexOf(p.id)<0; });
    /* 값이 있는 것 먼저, 빈 것은 접어둔다 */
    function hasVal(p){
      if(p.type==='formula') return formulaCalc(rec,p.expr,pt)!=='';
      if(p.type==='rollup')  return rollupCalc(rec,p,pt)!=='';
      var v=pget(rec,p.id);
      if(Array.isArray(v)) return v.length>0;
      if(p.type==='check') return !!v;
      return v!=='' && v!=null;
    }
    var shown  = props.filter(function(p){ return ALWAYS[p.id] || isDisp(p.type) || hasVal(p); });
    var hidden = props.filter(function(p){ return !ALWAYS[p.id] && !isDisp(p.type) && !hasVal(p); });
    /* 종류마다 따로 기억한다 — 사고에서 펼쳤다고 업무까지 펼쳐지면 안 된다 */
    var pgKey = dsk(pt);
    var openAll = (function(){
      var o=lsGet('wl_life_pgopen2',null);
      if(o && typeof o==='object') return !!o[pgKey];
      return lsGet('wl_life_pgopen','')===pt;      /* 예전 방식 이어받기 */
    })();
    var pics = esr(rec.photos).concat(esr(rec.scanRefs).map(function(r){ return (r.data&&r.data.photoUrl)||''; }).filter(Boolean));

    ov.innerHTML =
      '<div class="lf-page">'
      + '<div class="pg-top">'
      +   '<button type="button" id="pgBack">← 목록</button>'
      +   '<div class="pg-nav">'
      +     '<button type="button" id="pgPrev"'+(idx<=0?' disabled':'')+' title="이전">◀</button>'
      +     '<span>'+(idx>=0? (idx+1)+' / '+PGLIST.length : '')+'</span>'
      +     '<button type="button" id="pgNext"'+(idx<0||idx>=PGLIST.length-1?' disabled':'')+' title="다음">▶</button>'
      +   '</div>'
      +   '<div style="flex:1"></div>'
      +   (isPersonal() ? '' : '<button type="button" id="pgScan" title="스캔앱에서 영수증·서류를 가져옵니다">📎 스캔앱</button>')
      +   '<button type="button" id="pgTplSave" title="이 기록 모양을 템플릿으로 저장">📑 템플릿으로</button>'
      +   (isPersonal()? '' : (vendorOf(rec)? '<button type="button" id="pgVend" title="이 업체의 모든 기록 보기">📇 '+esc(String(vendorOf(rec)).slice(0,10))+'</button>':''))
      +   ((!isPersonal() && (pt==='accident'||pt==='progress'))
            ? '<button type="button" id="pgImpW" title="업무 기록에서 날짜·제목·업체 등을 가져옵니다">📋 업무에서 가져오기</button>' : '')
      +   '<button type="button" id="pgPEdit"'+(PGEDIT?' class="on"':'')+' title="속성 순서 바꾸기 / 빼기">'+(PGEDIT?'✓ 정리 끝':'⚙ 속성 정리')+'</button>'
      +   '<button type="button" id="pgForm" title="원래 입력 창으로">✏️ 전체 서식</button>'
      +   '<button type="button" id="pgDel" class="del" title="삭제">🗑</button>'
      +   '<button type="button" id="pgX" title="닫기">✕</button>'
      + '</div>'
      + '<div class="pg-body">'
      +   '<div class="pg-badge" style="background:'+d.c+'1f;color:'+d.c+'">'+d.i+' '+esc(d.n)+'</div>'
      +   '<textarea id="pgTitle" class="pg-title" rows="1" placeholder="제목 없음">'+esc(rec.title||'')+'</textarea>'
      +   '<div class="pg-props'+(PGEDIT?' pg-edit':'')+'">' + shown.map(propRow).join('')
      +     (hidden.length
              ? '<div id="pgHidden" style="display:'+(openAll?'contents':'none')+'">' + hidden.map(propRow).join('') + '</div>'
              : '')
      +     '<div class="pg-foot">'
      +       (hidden.length
                ? '<button type="button" id="pgMore" class="pg-more">'
                  + (openAll? '▾ 빈 항목 '+hidden.length+'개 접기' : '▸ 빈 항목 '+hidden.length+'개 더 보기') + '</button>'
                : '')
      +       '<button type="button" id="pgAddProp" class="pg-addp">＋ 속성 추가</button>'
      +       (_phd.length ? '<button type="button" id="pgUnhide" class="pg-addp">👁 숨긴 항목 '+_phd.length+'개 되살리기</button>' : '')
      +       (PGEDIT ? '<button type="button" id="pgTimeUp" class="pg-addp">⏱ 시각 칸을 날짜 뒤로</button>' : '')
      +     '</div>'
      +   '</div>'
      +   subHTML(rec)
      +   extrasHTML(rec)
      +   '<div class="pg-div"></div>'
      +   '<div class="pg-sec">📝 본문 <span>글자를 고르고 서식을 누르세요 · 사진은 끌어다 놓으면 됩니다</span></div>'
      +   pgToolbarHTML()
      +   '<div id="pgBodyTx" class="pg-text" contenteditable="true" spellcheck="false"'
      +     ' data-ph="여기에 자유롭게 쓰세요. 회의 내용, 확인할 것, 나중에 볼 메모 …">'
      +     bodyToHTML(rec.body) + '</div>'
      +   '<input type="file" id="pgPicIn" accept="image/*" multiple style="display:none">'
      +   '<div id="pgBodyNote" class="pg-note"></div>'
      /* v132 — 달님 : 「맨 밑에 사진 첨부 안내문은 없애줘」
            사진이 있을 때만 보여 준다. 없으면 제목도 안 만든다. */
      +   (pics.length
            ? ('<div class="pg-sec" style="margin-top:22px">📷 사진 · 첨부</div>'
               + '<div class="pg-pics">'
               + pics.map(function(u){ return '<img src="'+esc(u)+'" class="zimg">'; }).join('')
               + '</div>')
            : '')
      + '</div></div>';

    /* ── 저장 ── */
    function save(patch){ pUpd(id, patch); rec = ent().filter(function(x){ return x.id===id; })[0] || rec; }

    /* 📇 연락처에서 업체를 고르면 담당자·직책·전화를 여기로 넣어 준다 (빈 칸만) */
    window.wlPagePatch = function(obj){
      try{
        var cur = ent().filter(function(x){ return x.id===id; })[0] || rec;
        var pc = {}, n = 0;
        Object.keys(obj||{}).forEach(function(k){
          var v = cur[k];
          if(v==null || String(v).trim()===''){ pc[k]=obj[k]; n++; }
        });
        if(!n) return;
        save(pc);
        /* v113 — 「자동으로 넣은 것」을 적어 둔다. 나중에 그것만 골라 되돌릴 수 있게 */
        try{ if(typeof window.wlAutoMark === 'function') window.wlAutoMark(id, pc); }
        catch(e){ console.warn('[자동채움] 기록 실패', e); }
        if(typeof toast==='function') toast('📇 ' + n + '개 칸을 자동으로 채웠어요');
        openPage(id);
      }catch(e){ console.error('[페이지 자동채움]', e); }
    };

    /* v256 — 달님 : 「구매로 넣은 걸 차계부로 못 바꾸네」 종류 배지를 누르면 다른 종류로 옮긴다.
       제목·날짜·금액·메모·본문·사진처럼 공통 칸은 그대로 남고, 옛 종류만의 칸은 기록 안에 남되 화면에서만 안 보인다(되돌리면 다시 보임). */
    (function(){
      if(!isPersonal()) return;
      var bd = ov.querySelector('.pg-badge'); if(!bd) return;
      bd.style.cursor='pointer'; bd.title='눌러서 종류 바꾸기';
      bd.addEventListener('click', function(){
        var cv=document.createElement('div'); cv.className='lf-ov'; cv.style.zIndex='9800';
        cv.innerHTML='<div class="lf-mod" style="max-width:600px">'
          + '<div class="lf-mh"><b>어떤 종류로 바꿀까요?</b> <span style="font-size:12px;color:#8ba0b6;font-weight:600">지금: '+d.i+' '+esc(d.n)+'</span>'
          +   '<button type="button" id="lfCatX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
          + '<div class="lf-cats">' + catPickList().map(function(x){
              return '<button type="button" class="lf-cb'+(x.k===pt?' on':'')+'" data-ck="'+x.k+'"'+(x.k===pt?' disabled style="opacity:.45"':'')+'><span class="i">'+x.i+'</span><span class="l">'+x.n+'</span></button>'; }).join('')
          + '</div></div>';
        document.body.appendChild(cv);
        function cl(){ cv.remove(); }
        cv.querySelector('#lfCatX').addEventListener('click', cl);
        cv.addEventListener('mousedown', function(e){ if(e.target===cv) cl(); });
        cv.querySelectorAll('[data-ck]').forEach(function(b){
          b.addEventListener('click', function(){
            var k=b.getAttribute('data-ck'); cl(); if(!k || k===pt) return;
            var patch={ ptype:k };
            if(k==='car'){ patch.car = rec.car || curCar || (cars()[0]||{}).n || ''; patch.ctype = rec.ctype || '주유'; }
            if(!rec.date) patch.date = today();
            try{ pUpd(id, patch); }catch(e2){ console.error('[종류 바꾸기]', e2); noteMsg('바꾸지 못했어요: '+e2); return; }
            if(typeof toast==='function') toast('🔁 종류를 바꿨어요 → '+(k==='car'?'🚗 차계부':(cats()[k].i+' '+cats()[k].n)));
            setTimeout(function(){ try{ openPage(id); }catch(e3){} try{ render(); }catch(e4){} }, 60);
          });
        });
      });
    })();

    /* 제목 */
    var T=document.getElementById('pgTitle');
    pgAutoGrow(T);
    T.addEventListener('input', function(){ pgAutoGrow(T); });
    T.addEventListener('blur', function(){ if((rec.title||'')!==T.value){ save({title:T.value}); } });

    function toast2(m){ try{ if(typeof toast==='function') toast(m); }catch(e){} }

    /* 본문 — 서식 편집기 */
    var B=document.getElementById('pgBodyTx');
    var noteEl=document.getElementById('pgBodyNote');
    function bodySave(html){
      if(html==null) html=B.innerHTML;
      if(html==='<br>' || html==='<div><br></div>') html='';
      if(htmlSize(html) > PGBODY_MAX){
        if(noteEl){ noteEl.textContent='⚠️ 본문이 너무 큽니다 — 사진을 좀 줄여주세요 (한 건 1MB 제한)';
          noteEl.style.color='#c0392b'; }
        return;
      }
      if((rec.body||'')===html) return;
      save({body:html});
      if(noteEl){ var kb=Math.round(htmlSize(html)/1024);
        noteEl.textContent = '저장됨' + (kb>50? (' · '+kb+'KB'):'');
        noteEl.style.color='#a8b8c8'; }
    }
    B.addEventListener('blur', function(){ bodySave(); });
    /* v113 — 밖에서 본문을 고쳤을 때 저장을 직접 부를 수 있게 열어 둔다.
          (blur 로만 저장하면, 코드로 고친 경우 blur 가 안 나가 저장이 안 된다
           — 시계창에서 겪은 것과 같은 병) */
    window.wlBodySave = function(html){ try{ bodySave(html); }catch(e){ console.warn('[본문] 저장 실패', e); } };
    pgBindBody(B, function(){ return rec; }, bodySave);
    function phSync(){ B.classList.toggle('empty', !B.textContent.trim() && !B.querySelector('img,hr')); }
    B.addEventListener('input', phSync); phSync();

    /* 서식 버튼 */
    ov.querySelectorAll('[data-pgc]').forEach(function(b){
      b.addEventListener('mousedown', function(e){ e.preventDefault(); });
      b.addEventListener('click', function(){
        var c=b.getAttribute('data-pgc');
        if(c==='pic'){ document.getElementById('pgPicIn').click(); return; }
        /* v135 — 달님 : 「본문 내용에 x를 누르면 기존 내용 지워지게」
              한 번 물어본 뒤 본문을 통째로 비운다 (실수로 날리지 않게) */
        if(c==='clearBody'){
          var _has = String((B.textContent||'')).trim().length > 0 || /<img/i.test(B.innerHTML||'');
          if(!_has){ if(typeof toast==='function') toast('본문이 이미 비어 있어요'); return; }
          /* v145 — 브라우저 창 대신 앱 안 팝업으로 묻는다 */
          var _ask = (window.wlAsk && window.wlAsk.ok)
            ? window.wlAsk.ok('본문 내용을 전부 지울까요?', { sub:'되돌릴 수 없습니다', ok:'지우기', danger:1 })
            : Promise.resolve(confirm('본문 내용을 전부 지울까요?'));
          _ask.then(function(yes){
            if(!yes) return;
            B.innerHTML = '';
            try{ B.focus(); }catch(e){}
            phSync(); bodySave();
            if(typeof toast==='function') toast('🧹 본문을 비웠어요');
          });
          return;
        }
        pgExec(c, B); phSync(); bodySave();
      });
    });
    /* v255 — 본문 칸을 클릭하지 않은 상태에서 Ctrl+V 해도 사진이 본문 끝에 들어간다 (본문 안 붙여넣기는 pgBindBody 가 처리) */
    ov.addEventListener('paste', function(e){
      try{
        if(B.contains(e.target)) return;
        var ae=document.activeElement; if(ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) return;
        var dt=e.clipboardData; if(!dt) return;
        var fs=[].filter.call(dt.files||[], function(f){ return /^image\//.test(f.type); });
        if(!fs.length) return;
        e.preventDefault();
        pgInsertPics(fs, B, function(){ phSync(); bodySave(); });
        if(typeof toast==='function') toast('📋 클립보드 사진을 본문에 넣었어요');
      }catch(err){ console.warn('[페이지 붙여넣기]', err); }
    });
    document.getElementById('pgPicIn').addEventListener('change', function(ev){
      pgInsertPics(ev.target.files, B, function(){ ev.target.value=''; phSync(); bodySave(); }); });

    /* 속성 값 클릭 → 그 자리에서 고치기 */
    ov.querySelectorAll('[data-ppid]').forEach(function(box){
      box.addEventListener('click', function(ev){
        if(ev.target.closest('a, button, input, select, textarea')) return;
        var pid=box.getAttribute('data-ppid'), p=propById(pt,pid); if(!p) return;
        /* 📦 자재명은 자재 탭에 저장된 자재에서 고르게 한다 — 규격·수량이 함께 채워진다 */
        if((pid==='f:material' || pid==='f:itemName') && typeof window.wlPickItem==='function'){
          ev.preventDefault(); ev.stopPropagation();
          window.wlPickItem(function(r){
            try{
                var patch = {};
              patch[p.k || pid.slice(2)] = r.name;
              if(propById(pt,'f:spec')) patch.spec = r.spec;
              if(propById(pt,'f:qty'))  patch.qty  = r.qty;
              var s1 = (Number(r.price)||0) * (Number(r.qty)||1);
              if(s1 > 0) patch.matCost = s1;          /* v135 — 자재 값은 자재 합계 칸으로 */
              save(patch);
              /* v113 — 저절로 따라 들어온 칸만 적어 둔다 (자재명은 사람이 고른 것) */
              try{
                if(typeof window.wlAutoMark === 'function'){
                  var am = {};
                  Object.keys(patch).forEach(function(k){
                    if(k !== (p.k || pid.slice(2))) am[k] = patch[k]; });
                  window.wlAutoMark(id, am);
                }
              }catch(e){ console.warn('[자재 자동채움] 기록 실패', e); }
              if(typeof toast==='function') toast('📦 '+r.name+(r.spec?(' · '+r.spec):'')+' · '+r.qty+'개'
                + (s1>0 ? (' · 자재 합계 '+numFmt(s1)+'원') : ''));
              openPage(id);
            }catch(e){ console.error('[자재 고르기]', e); noteMsg('자재를 못 넣었어요: '+(e.message||e)); }
          }, pget(rec, pid) || '');
          return;
        }
        /* v241 — 달님 : 「계산서 발행 체크가 한 번에 안 돼」
           예전에는 첫 번째 누름이 「고치기 칸 열기」, 두 번째가 「체크」였다.
           예/아니오 뿐인 칸은 고치기 칸을 열 까닭이 없다 — 바로 뒤집는다. */
        if(p.type==='check'){
          ev.preventDefault(); ev.stopPropagation();
          var nv = !pget(rec, pid);
          save(ppatch(rec, pid, nv));
          box.innerHTML = cellHTML(rec, p);
          if(typeof toast==='function') toast(nv ? '☑ 켰어요' : '☐ 껐어요');
          return;
        }
        box.innerHTML = editorHTML(p, pget(rec,pid));
        var el=box.querySelector('.lf-ie'); if(!el) return;
        if(el.getAttribute('data-num')==='1') bindNum(el);
        if(el.getAttribute('data-tdial')){ bindDial(box); setTimeout(function(){ el.click(); },50); }
        if(p.type==='multi'){
          box.querySelectorAll('[data-mv]').forEach(function(t){
            t.addEventListener('click', function(){
              var hid=box.querySelector('.lf-ie');
              var arr=(hid.value||'').split(',').filter(Boolean);
              var mv=t.getAttribute('data-mv'), i2=arr.indexOf(mv);
              if(i2>=0){ arr.splice(i2,1); t.classList.remove('on'); t.removeAttribute('style'); }
              else { arr.push(mv); t.classList.add('on');
                var cc=colorOf((p.colors||{})[mv]||'gray'); t.style.background=cc.bg; t.style.color=cc.fg; }
              hid.value=arr.join(',');
              save(ppatch(rec, pid, arr));
            });
          });
          return;
        }
        try{ if(el.type!=='hidden'){ el.focus(); if(el.select) el.select(); } }catch(e){}
        var done=false;
        function fin(ok){
          if(done) return; done=true;
          if(ok){ try{ editCommit(pt, id, pid, el); }catch(e){} }
          rec = ent().filter(function(x){ return x.id===id; })[0] || rec;
          box.innerHTML = cellHTML(rec, p);
        }
        el._dialDone = function(){ fin(true); };   /* v112 시계창이 직접 저장을 부른다 */
        el.addEventListener('blur', function(){ if(el._dialOpen) return; fin(true); });
        el.addEventListener('change', function(){ if(el.tagName==='SELECT'||el.type==='checkbox') fin(true); });
        el.addEventListener('keydown', function(e2){
          if(e2.key==='Enter' && el.tagName!=='TEXTAREA'){ e2.preventDefault(); fin(true); }
          else if(e2.key==='Escape'){ e2.preventDefault(); fin(false); }
        });
      });
    });

    /* 반복 항목 편집 */
    function rowsSave(key){
      var out=[], seen={};
      ov.querySelectorAll('[data-prk^="'+key+'|"]').forEach(function(el){
        var pr=el.getAttribute('data-prk').split('|');
        var i=+pr[1], k=pr[2];
        if(!out[i]) out[i]={};
        out[i][k] = (el.getAttribute('data-num')==='1') ? numRaw(el.value) : el.value;
        seen[i]=1;
      });
      out = out.filter(function(r){ return r && Object.keys(r).some(function(k){
        var v=String(r[k]||'').trim(); return v && !/^(맛평가|선택)$/.test(v); }); });
      var patch={}; patch[key]=out; save(patch);
    }
    ov.querySelectorAll('[data-prk]').forEach(function(el){
      if(el.getAttribute('data-num')==='1') bindNum(el);
      el.addEventListener('change', function(){ rowsSave(el.getAttribute('data-prk').split('|')[0]); });
    });
    ov.querySelectorAll('[data-prdel]').forEach(function(b){
      b.addEventListener('click', function(){
        var pr=b.getAttribute('data-prdel').split('|'), key=pr[0], i=+pr[1];
        var a=esr(rec[key]); a.splice(i,1);
        var patch={}; patch[key]=a; save(patch); openPage(id);
      });
    });
    ov.querySelectorAll('[data-unlink]').forEach(function(b){
      b.addEventListener('click', function(){
        if(!confirm('연결된 업무를 끊을까요?\n\n가져온 내용은 그대로 남습니다.')) return;
        save({ workRef:'', workRefKind:'' }); openPage(id);
      });
    });
    ov.querySelectorAll('[data-pradd]').forEach(function(b){
      b.addEventListener('click', function(){
        var key=b.getAttribute('data-pradd');
        var a=esr(rec[key]); a.push({});
        var patch={}; patch[key]=a; save(patch); openPage(id);
      });
    });

    /* 버튼 */
    function close(){
      /* 입력 중이던 값을 먼저 확정하고 닫는다 */
      try{ var a=document.activeElement; if(a && a.blur) a.blur(); }catch(e){}
      var o=document.getElementById('lfPageOv'); if(o) o.remove();
      PGASMOD = false; pgFab(false); pgLock(false); window.wlPagePatch = null; window.wlBodySave = null;
      document.removeEventListener('keydown', esc2);
      try{ if(/^#lp=/.test(location.hash||'')) history.pushState({}, '', location.pathname+location.search); }catch(e){}
      /* 아무것도 안 쓴 새 기록이면 남기지 않는다 */
      setTimeout(function(){ try{ draftDrop(); }catch(e){} render(); }, 60);
    }
    function esc2(e){ if(e.key==='Escape' && !document.querySelector('.lf-ov')) close(); }
    document.addEventListener('keydown', esc2);
    document.getElementById('pgX').addEventListener('click', close);
    document.getElementById('pgBack').addEventListener('click', close);
    if(PGASMOD){
      /* v236 — mousedown 이면 배경을 「누르는 순간」 닫혀서, 배경에서 시작해
         안쪽으로 끌어오려던 것까지 닫혔다. click 으로 바꾸고, 반대 방향(안→배경)
         드래그는 위 「드래그 지킴이」가 막는다. 양쪽 다 안 닫힌다. */
      ov.addEventListener('click', function(e){ if(e.target===ov) close(); });
      var bk=document.getElementById('pgBack'); if(bk) bk.textContent='✕ 닫기';
    }
    var pts=document.getElementById('pgTplSave');
    if(pts) pts.addEventListener('click', function(){ tplFromRec(pt, rec); });
    var pvd=document.getElementById('pgVend');
    if(pvd) pvd.addEventListener('click', function(){ vendorHub(vendorOf(rec)); });
    document.getElementById('pgForm').addEventListener('click', function(){
      window._wlForceOld = true;        /* 이번 한 번은 일부러 예전 입력창을 연다 */
      var o=document.getElementById('lfPageOv'); if(o) o.remove();
      PGASMOD = false; pgFab(false); pgLock(false); window.wlPagePatch = null; window.wlBodySave = null;
      document.removeEventListener('keydown', esc2);
      try{ if(/^#lp=/.test(location.hash||'')) history.pushState({}, '', location.pathname+location.search); }catch(e){}
      if(!isPersonal()){
        /* 업무일지는 원래 쓰던 입력창을 그대로 연다 */
        try{
          /* 지출은 전용 입력창(업체·유형·단가·수량)이 따로 있다 */
          if(DS.kind==='expense' && typeof window.openExpenseEditor==='function'){
            window.openExpenseEditor(id); return; }
          if(typeof window.openEditor==='function'){ window.openEditor(DS.kind, id); return; }
        }catch(e){ console.error('[전체 서식]', e); }
      }
      try{ DRAFT=null; }catch(e){}
      openRec(pt, id);
    });
    document.getElementById('pgDel').addEventListener('click', function(){
      askDel('이 기록을 지울까요?', '휴지통에서 되살릴 수 있어요').then(function(ok){
        if(!ok) return;
        try{ pDel(id); close(); toast2('🗑 삭제했어요'); }
        catch(e){ console.error('[삭제]', e); if(typeof toast==='function') toast('삭제 실패: '+(e.message||e)); }
      });
    });
    var pv=document.getElementById('pgPrev'), nx=document.getElementById('pgNext');
    if(pv) pv.addEventListener('click', function(){ if(idx>0) openPage(PGLIST[idx-1]); });
    if(nx) nx.addEventListener('click', function(){ if(idx>=0 && idx<PGLIST.length-1) openPage(PGLIST[idx+1]); });
    document.getElementById('pgAddProp').addEventListener('click', function(){
      propAdd(pt, function(){ openPage(id); }); });
    var unh=document.getElementById('pgUnhide');
    if(unh) unh.addEventListener('click', function(){ phideSave(pt, []); openPage(id); });

    /* ── 속성 줄 끌어서 순서 바꾸기 (마우스·손가락 둘 다) ── */
    /* 📋 업무 기록에서 가져오기 — 빈 칸만 채우고 linkedTo 를 남긴다 */
    (function(){
      var ib = document.getElementById('pgImpW'); if(!ib) return;
      ib.addEventListener('click', function(){
        if(typeof window.wlPickWork !== 'function'){
          askInfo('가져오기 기능을 못 불러왔어요 — worklog.js 를 올렸는지 확인해 주세요'); return;
        }
        window.wlPickWork(function(w){
          try{
            var src = window.wlWorkToFields(w, pt) || {};
            var patch = {}, filled = [], skipped = [];
            Object.keys(src).forEach(function(k){
              var val = src[k];
              if(val===''||val==null||val===0) return;
              var cur = rec[k];
              var empty = (cur==null || cur==='' || cur===0);
              /* 새로 만든 기록이면 '오늘' 기본 날짜는 빈 칸으로 본다 */
              if(!empty && k==='date'){
                try{ if(window.wlDraftId && window.wlDraftId()===id && cur===today()) empty = true; }catch(e2){}
              }
              if(!empty){ skipped.push(k); return; }
              patch[k] = val; filled.push(k);
            });
            patch.workRef = w.id; patch.workRefKind = 'work';
            save(patch);
            if(typeof toast==='function') toast(filled.length
              ? ('가져왔어요 — ' + filled.length + '개 칸을 채웠습니다'
                 + (skipped.length? (' / 이미 쓴 '+skipped.length+'개는 그대로') : ''))
              : '채울 빈 칸이 없었어요 — 연결만 해뒀습니다');
            openPage(id);
          }catch(e){ console.error('[업무 가져오기]', e); noteMsg('가져오지 못했어요: '+(e.message||e)); }
        });
      });
    })();

    /* ⏱ 시각 칸을 날짜 바로 뒤로 — 이미 순서를 정해 둔 종류를 위한 한 번 누르기 */
    (function(){
      var tu = document.getElementById('pgTimeUp'); if(!tu) return;
      tu.addEventListener('click', function(){
        try{
          var ps = props.slice();
          var tms = ps.filter(function(x){ return x.type==='time'; });
          if(!tms.length){ if(typeof toast==='function') toast('시각 칸이 없어요'); return; }
          var rest = ps.filter(function(x){ return x.type!=='time'; });
          var di=-1;
          for(var q=0;q<rest.length;q++){ if(rest[q].id==='_date' || rest[q].type==='date'){ di=q; break; } }
          var nx = (di<0) ? tms.concat(rest) : rest.slice(0,di+1).concat(tms, rest.slice(di+1));
          pordSave(pt, nx.map(function(x){ return x.id; }));
          if(typeof toast==='function') toast('⏱ 시각 칸을 날짜 뒤로 옮겼어요');
          openPage(id);
        }catch(e){ console.error('[시각 칸 옮기기]', e); }
      });
    })();

    (function(){
      var pe = document.getElementById('pgPEdit');
      if(pe) pe.addEventListener('click', function(){ PGEDIT = !PGEDIT; openPage(id); });
      /* 📎 스캔앱에서 가져오기 (v104) — 옛 입력창에만 있던 것을 여기에도 */
      var sc = ov.querySelector('#pgScan');
      if(sc && !sc._bound){
        sc._bound = 1;
        sc.addEventListener('click', function(){
          try{
            window._wlScanTargetId = id;            /* 어느 기록에 붙일지 알려둔다 */
            if(typeof openScanPickerOfType === 'function'){ openScanPickerOfType('doc'); }
            else if(typeof window._openScanPickerOfType === 'function'){ window._openScanPickerOfType('doc'); }
            else { noteMsg('스캔앱 창구를 찾지 못했어요'); }
          }catch(e){
            console.error('[스캔앱]', e);
            noteMsg('스캔앱을 열지 못했어요: ' + (e.message || e));
          }
        });
      }
    })();

    /* ── 속성 종류 바꾸기 (v102) — 내가 만든 속성만, 사라질 값을 먼저 알려준다 ── */
    (function(){
      var host0 = ov.querySelector('.pg-props'); if(!host0) return;
      var TYPES = [
        {t:'text', n:'🔤 글자'},  {t:'area', n:'📝 여러 줄'}, {t:'num',  n:'🔢 숫자'},
        {t:'date', n:'📅 날짜'},  {t:'time', n:'🕐 시각'},    {t:'sel',  n:'🏷 선택'},
        {t:'multi',n:'🏷 여러 선택'}, {t:'check',n:'☑ 체크'}, {t:'star', n:'⭐ 별점'},
        {t:'tel',  n:'📞 전화'},  {t:'link', n:'🔗 주소'},    {t:'map',  n:'📍 지도'}
      ];
      /* 값이 새 종류로 옮겨갈 수 있나 — 못 옮기는 값을 세어 돌려준다 */
      function checkLoss(pid, nt){
        var bad = [], seen = 0;
        try{
          ent().forEach(function(e){
            var v = pget(e, pid);
            if(v == null || v === '' ) return;
            seen++;
            var sv = String(v).trim();
            var ok = true;
            if(nt === 'num' || nt === 'star' || nt === 'rate'){
              ok = /^-?[0-9,]+(\.[0-9]+)?$/.test(sv);
            }else if(nt === 'date'){
              ok = /^\d{4}-\d{2}-\d{2}/.test(sv);
            }else if(nt === 'time'){
              ok = /^\d{1,2}:\d{2}/.test(sv);
            }else if(nt === 'check'){
              ok = true;
            }
            if(!ok && bad.length < 12) bad.push(sv);
            else if(!ok) bad.push(null);
          });
        }catch(err){ console.warn('[종류 바꾸기] 값 검사 실패', err); }
        return { total: seen, bad: bad.filter(function(x){ return x !== null; }), badN: bad.length };
      }
      function openTypeWin(pid){
        var p = propById(pt, pid); if(!p){ noteMsg('속성을 찾지 못했어요'); return; }
        var cur = p.type || 'text';
        var pick = cur;
        var ov2 = document.createElement('div'); ov2.className = 'ptw';
        function draw(){
          var chk = (pick === cur) ? null : checkLoss(pid, pick);
          var msg = '';
          if(chk){
            if(chk.badN > 0){
              msg = '<div class="ptw-warn"><b>⚠ ' + chk.badN + '건이 비워집니다</b><br>'
                  + '이 값들은 새 종류로 옮길 수 없어요:<br>'
                  + chk.bad.slice(0,8).map(function(x){ return '· ' + esc(x); }).join('<br>')
                  + (chk.badN > 8 ? '<br>· … 외 ' + (chk.badN - 8) + '건' : '')
                  + '<br><br>바꾸기 전에 <b>백업</b>을 받아 두세요.</div>';
            }else{
              msg = '<div class="ptw-ok">✅ 값 ' + chk.total + '건이 모두 그대로 옮겨집니다</div>';
            }
          }
          ov2.innerHTML = '<div class="ptw-box">'
            + '<div class="ptw-h">「' + esc(p.name) + '」 종류 바꾸기</div>'
            + '<div class="ptw-s">지금은 <b>' + esc((TYPES.filter(function(x){return x.t===cur;})[0]||{n:cur}).n) + '</b> 입니다. '
            + '바꿀 종류를 고르면 사라질 값을 먼저 알려드려요.'
            + (pid.slice(0,2)==='f:'
                ? '<br><b style="color:#b45309">이 칸은 앱이 원래 갖고 있던 칸입니다.</b> '
                  + '바꾼 뒤 이상하면 콘솔에 <code>wlFieldTypeReset()</code> 로 되돌릴 수 있어요.'
                : '')
            + '</div>'
            + '<div class="ptw-grid">' + TYPES.map(function(x){
                return '<button type="button" class="ptw-t' + (x.t===pick?' on':'') + '" data-pt="' + x.t + '">' + x.n + '</button>';
              }).join('') + '</div>'
            + msg
            + '<div class="ptw-btns">'
            +   '<button type="button" id="ptwC" style="flex:1;border:1.5px solid #dbe6f4;background:#f7faff;color:#7a92a8">취소</button>'
            +   '<button type="button" id="ptwOK" style="flex:2;background:' + (pick===cur?'#cbd5e1':'#2563a8') + ';color:#fff"'
            +     (pick===cur?' disabled':'') + '>바꾸기</button>'
            + '</div></div>';
          [].forEach.call(ov2.querySelectorAll('[data-pt]'), function(btn){
            btn.addEventListener('click', function(){ pick = btn.getAttribute('data-pt'); draw(); });
          });
          ov2.querySelector('#ptwC').addEventListener('click', function(){ ov2.remove(); });
          var ok = ov2.querySelector('#ptwOK');
          if(ok) ok.addEventListener('click', function(){
            var chk2 = checkLoss(pid, pick);
            if(chk2.badN > 0 && !confirm(chk2.badN + '건이 비워집니다. 정말 바꿀까요?\n\n되돌리려면 백업에서 복구해야 합니다.')) return;
            try{
              if(pid.slice(0,2) === 'f:'){          /* 기본 칸 — 재정의로 저장 */
                if(ftypeLocked(pid)){ askInfo('이 칸은 계산·달력에 쓰여서 종류를 바꿀 수 없어요'); return; }
                ftypeSet(pt, pid, pick);
              }else{                                 /* 내가 만든 속성 */
                var arr = customOf(pt).slice();
                var hit = false;
                for(var i = 0; i < arr.length; i++){
                  if(arr[i] && arr[i].id === pid){ arr[i] = Object.assign({}, arr[i], {type: pick}); hit = true; break; }
                }
                if(!hit){ noteMsg('속성을 찾지 못했어요'); return; }
                customSave(pt, arr);
              }
              ov2.remove();
              if(typeof toast === 'function') toast('종류를 바꿨습니다 — ' + p.name);
              openPage(id);
            }catch(err){
              console.error('[종류 바꾸기]', err);
              noteMsg('바꾸지 못했어요: ' + (err.message || err));
            }
          });
        }
        draw();
        ov2.addEventListener('mousedown', function(e){ if(e.target === ov2) ov2.remove(); });
        document.body.appendChild(ov2);
      }
      [].forEach.call(host0.querySelectorAll('[data-pptype]'), function(btn){
        btn.addEventListener('click', function(ev){
          ev.preventDefault(); ev.stopPropagation();
          if(!PGEDIT) return;
          openTypeWin(btn.getAttribute('data-pptype'));
        });
      });
    })();

    (function(){
      var host = ov.querySelector('.pg-props'); if(!host) return;
      function saveOrder(){
        var ids = [].map.call(host.querySelectorAll('[data-prow]'), function(x){
          return x.getAttribute('data-prow'); });
        if(ids.length) pordSave(pt, ids);
      }
      [].forEach.call(host.querySelectorAll('.pg-drag'), function(hd){
        hd.addEventListener('pointerdown', function(e){
          if(!PGEDIT) return;
          var row = hd.parentNode;
          while(row && !(row.classList && row.classList.contains('pg-prow'))) row = row.parentNode;
          if(!row) return;
          e.preventDefault();
          row.classList.add('pg-dragging');
          try{ hd.setPointerCapture(e.pointerId); }catch(err){}
          function move(ev){
            var el = document.elementFromPoint(ev.clientX, ev.clientY);
            var tgt = el;
            while(tgt && !(tgt.classList && tgt.classList.contains('pg-prow'))) tgt = tgt.parentNode;
            if(!tgt || tgt===row || tgt.parentNode!==row.parentNode) return;
            var r = tgt.getBoundingClientRect();
            var before = (ev.clientY < r.top + r.height/2);
            tgt.parentNode.insertBefore(row, before ? tgt : tgt.nextSibling);
          }
          function up(){
            try{ hd.releasePointerCapture(e.pointerId); }catch(err){}
            hd.removeEventListener('pointermove', move);
            hd.removeEventListener('pointerup', up);
            hd.removeEventListener('pointercancel', up);
            row.classList.remove('pg-dragging');
            saveOrder();
          }
          hd.addEventListener('pointermove', move);
          hd.addEventListener('pointerup', up);
          hd.addEventListener('pointercancel', up);
        });
      });
      /* ── 속성 빼기 ── */
      [].forEach.call(host.querySelectorAll('[data-ppdel]'), function(b){
        b.addEventListener('click', function(e){
          e.preventDefault(); e.stopPropagation();
          if(!PGEDIT) return;
          var pid = b.getAttribute('data-ppdel');
          var p = propById(pt, pid); if(!p) return;
          var inAll = (customOf(null)||[]).some(function(x){ return x.id===pid; });
          var inPt  = pt ? (customOf(pt)||[]).some(function(x){ return x.id===pid; }) : false;
          if(inAll || inPt){
            if(!confirm('「'+p.name+'」 속성을 뺄까요?\n\n넣어둔 값은 그대로 남고, ⋯ 내 속성 관리에서 되살릴 수 있습니다.')) return;
            customPatch(inAll ? null : pt, pid, {archived:true});
          } else {
            if(!confirm('「'+p.name+'」 은 기본 칸이라 지울 수 없어요.\n\n이 화면에서 숨길까요? (아래 [👁 숨긴 항목 되살리기] 로 다시 보입니다)')) return;
            var hd2 = phideOf(pt); if(hd2.indexOf(pid)<0) hd2.push(pid); phideSave(pt, hd2);
          }
          openPage(id);
        });
      });
    })();

    /* 속성 접기 */
    var more=document.getElementById('pgMore');
    if(more) more.addEventListener('click', function(){
      var box=document.getElementById('pgHidden');
      var nowOpen = box.style.display!=='none';
      box.style.display = nowOpen ? 'none' : 'contents';
      var mo=lsGet('wl_life_pgopen2',null); if(!mo || typeof mo!=='object') mo={};
      if(nowOpen) delete mo[pgKey]; else mo[pgKey]=1;
      lsSet('wl_life_pgopen2', mo);
      more.textContent = nowOpen ? ('▸ 빈 항목 '+hidden.length+'개 더 보기')
                                 : ('▾ 빈 항목 '+hidden.length+'개 접기');
    });

    /* 하위 항목 */
    function subAdd(){
      var inp=document.getElementById('pgSubIn');
      var t=(inp.value||'').trim(); if(!t) return;
      var o=DS.newRec(isPersonal()?'todo':pt); o.parentId=id; o.title=t;
      o.date = rec.date || today(); o.createdAt = Date.now();
      pAdd(o); inp.value=''; openPage(id);
      setTimeout(function(){ var n=document.getElementById('pgSubIn'); if(n) n.focus(); }, 80);
    }
    var si=document.getElementById('pgSubIn');
    if(si){ si.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); subAdd(); } }); }
    var sg=document.getElementById('pgSubGo'); if(sg) sg.addEventListener('click', subAdd);
    ov.querySelectorAll('[data-subck]').forEach(function(b){
      b.addEventListener('click', function(){
        var kid=b.getAttribute('data-subck');
        var k=ent().filter(function(x){ return x.id===kid; })[0]; if(!k) return;
        pUpd(kid, {done: !k.done}); openPage(id); }); });
    ov.querySelectorAll('[data-subgo]').forEach(function(b){
      b.addEventListener('click', function(){ openPage(b.getAttribute('data-subgo')); }); });

    /* ── ⏱ 소요 · 📦 자재 · 📎 파일링크 ── */
    (function(){
      function m2s(m){ m=((m%1440)+1440)%1440;
        return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
      function s2m(s){ var p=String(s||'').split(':'); if(p.length<2) return null;
        var a=parseInt(p[0],10), b=parseInt(p[1],10);
        return (isNaN(a)||isNaN(b)) ? null : a*60+b; }
      var tps = props.filter(function(p){ return p.type==='time'; });
      function setEnd(mins, add){
        if(tps.length<2) return;
        var s = s2m(pget(rec, tps[0].id));
        if(s===null){ toast2('먼저 「'+tps[0].name+'」 을 넣어주세요'); return; }
        var cur = s2m(pget(rec, tps[1].id));
        var nv = add ? ((cur===null? s : cur) + mins) : (s + mins);
        if(nv < s) nv = s;
        pUpd(id, ppatch(rec, tps[1].id, m2s(nv)));
        openPage(id);
      }
      ov.querySelectorAll('[data-dur]').forEach(function(b){
        b.addEventListener('click', function(){ setEnd(parseInt(b.getAttribute('data-dur'),10), false); }); });
      ov.querySelectorAll('[data-duradd]').forEach(function(b){
        b.addEventListener('click', function(){ setEnd(parseInt(b.getAttribute('data-duradd'),10), true); }); });

      /* 자재 — 저장된 자재에서 여러 개 담기 */
      var mPick=document.getElementById('pgMatPick');
      if(mPick) mPick.addEventListener('click', function(){
        if(typeof window.wlPickMats!=='function'){
          askInfo('자재 고르기를 못 불러왔어요 — worklog.js 를 올렸는지 확인해 주세요'); return;
        }
        window.wlPickMats(function(list){
          try{
            var patch = matPatch(list);
            var s = matSum(list);
            var ap = amountPatch(s, false);
            if(ap) for(var k in ap){ patch[k] = ap[k]; }
            pUpd(id, patch);
            rec = ent().filter(function(x){ return x.id===id; })[0] || rec;
            if(typeof toast==='function') toast(
              list.length ? ('📦 자재 '+list.length+'종'
                             + (s>0? (' · 합계 '+numFmt(s)+'원'+(ap?' → 금액 칸에 넣었어요':'')) : ''))
                          : '자재를 모두 비웠어요');
            openPage(id);
          }catch(e){ console.error('[자재 담기]', e); noteMsg('자재를 못 넣었어요: '+(e.message||e)); }
        }, esr(rec.materials));
      });
      /* 자재 합계를 금액 칸에 넣기 (이미 적힌 금액도 덮어쓴다 — 사용자가 직접 누른 경우) */
      var mSumB=document.getElementById('pgMatSum');
      if(mSumB) mSumB.addEventListener('click', function(){
        var s = matSum(esr(rec.materials));
        if(amountLocked(rec)){ toast2('이 기록의 금액은 아래 항목 합계로 자동 계산돼요'); return; }
        var ap = amountPatch(s, true);
        if(!ap){ toast2('넣을 금액이 없어요 — 자재에 단가가 있어야 합니다'); return; }
        save(ap);
        if(typeof toast==='function') toast('💰 금액 '+numFmt(s)+'원을 넣었어요');
        openPage(id);
      });

      /* 자재 */
      var mAdd=document.getElementById('pgMatAdd');
      if(mAdd) mAdd.addEventListener('click', function(){
        var nm=(document.getElementById('pgMatN').value||'').trim();
        if(!nm){ toast2('자재명을 넣어주세요'); return; }
        var arr=esr(rec.materials).slice();
        arr.push({ name:nm,
                   spec:(document.getElementById('pgMatS').value||'').trim(),
                   qty: Number(document.getElementById('pgMatQ').value)||1,
                   price: Number(document.getElementById('pgMatP').value)||0 });
        pUpd(id, matPatch(arr)); openPage(id);
      });
      ov.querySelectorAll('[data-matdel]').forEach(function(b){
        b.addEventListener('click', function(){
          var i=+b.getAttribute('data-matdel');
          var arr=esr(rec.materials).slice(); arr.splice(i,1);
          pUpd(id, matPatch(arr)); openPage(id); }); });

      /* 파일·폴더 링크 */
      var aAdd=document.getElementById('pgAttAdd');
      if(aAdd) aAdd.addEventListener('click', function(){
        var pth=(document.getElementById('pgAttP').value||'').trim();
        if(!pth){ toast2('경로를 넣어주세요'); return; }
        var arr=esr(rec.attachments).slice();
        arr.push({ label:(document.getElementById('pgAttL').value||'').trim(), path:pth });
        pUpd(id, {attachments:arr}); openPage(id);
      });
      ov.querySelectorAll('[data-attdel]').forEach(function(b){
        b.addEventListener('click', function(){
          var i=+b.getAttribute('data-attdel');
          var arr=esr(rec.attachments).slice(); arr.splice(i,1);
          pUpd(id, {attachments:arr}); openPage(id); }); });
      ov.querySelectorAll('[data-attcopy]').forEach(function(b){
        b.addEventListener('click', function(){
          var a=esr(rec.attachments)[+b.getAttribute('data-attcopy')]||{};
          try{
            if(navigator.clipboard && navigator.clipboard.writeText)
              navigator.clipboard.writeText(a.path||'').then(function(){ toast2('📋 경로를 복사했어요'); })
                .catch(function(){ askText('경로 복사', a.path||'', { sub:'아래 글자를 골라 복사하세요', ok:'닫기' }); });
            else askText('경로 복사', a.path||'', { sub:'아래 글자를 골라 복사하세요', ok:'닫기' });
          }catch(e){ askText('경로 복사', a.path||'', { sub:'아래 글자를 골라 복사하세요', ok:'닫기' }); }
        }); });
    })();
    ov.querySelectorAll('[data-subdel]').forEach(function(b){
      b.addEventListener('click', function(){
        askDel('이 하위 항목을 지울까요?').then(function(ok){
          if(!ok) return;
          pDel(b.getAttribute('data-subdel')); openPage(id);
        }); }); });

    /* 하위 항목이면 부모로 올라가는 길 */
    if(rec.parentId){
      var par=ent().filter(function(x){ return x.id===rec.parentId; })[0];
      if(par){
        var bar=document.createElement('div'); bar.className='pg-parent';
        bar.innerHTML='↰ <b>'+esc(par.title||'(제목없음)')+'</b> 의 하위 항목';
        bar.addEventListener('click', function(){ openPage(par.id); });
        var bd=ov.querySelector('.pg-body'); if(bd) bd.insertBefore(bar, bd.firstChild);
      }
    }

    /* 주소창에 남긴다 — 새로고침해도 이 페이지로 */
    try{
      var want='#lp='+id + (isPersonal()? '' : ('&ds='+DS.kind));
      if(location.hash!==want) history.pushState({lp:id}, '', want);
    }catch(e){}

    ov.scrollTop=0;
    setTimeout(function(){ pgAutoGrow(document.getElementById('pgTitle')); }, 30);
  }
  window.wlLifePage = openPage;
  /* 어느 화면에 있든 그 기록의 페이지를 연다 (모달의 [📄 페이지로] 용) */
  window.wlGoPage = function(id, asModal){
    try{
      PGASMOD_PEND = (asModal===undefined || asModal===null) ? null : !!asModal;
      var r = anyRec(id);
      if(!r){ noteMsg('기록을 못 찾았어요'); return; }
      var want = (r.kind==='personal'||r.kind==='pcontact') ? 'personal' : r.kind;
      var cur2 = DS ? (DS.key==='personal' ? 'personal' : DS.kind) : '';
      if(want!==cur2){
        if(typeof window.wlOpenData==='function') window.wlOpenData(want);
        setTimeout(function(){ try{ openPage(id); }catch(e){ console.error('[페이지로]',e); } }, 320);
      } else {
        try{ if(typeof window.v43ActivateTab==='function') window.v43ActivateTab(isPersonal()?'life':'data'); }catch(e){}
        setTimeout(function(){ try{ openPage(id); }catch(e){ console.error('[페이지로]',e); } }, 120);
      }
    }catch(e){ console.error('[페이지로]', e); }
  };

  /* ＋ 새로 만들기 — 빈 기록을 만들고 곧바로 페이지(창)로 연다.
     아무것도 안 쓰고 닫으면 draftDrop() 이 조용히 지운다. */
  window.wlNewPage = function(kind, asModal){
    try{
      PGASMOD_PEND = (asModal==null) ? null : (asModal !== false);   /* v261 — null 이면 화면 폭으로 자동 */
      var want = (kind==='personal'||kind==='pcontact') ? 'personal' : (kind||'work');
      var cur2 = DS ? (DS.key==='personal' ? 'personal' : DS.kind) : '';
      function go(){ try{ newRowAsk(null, true); }catch(e){ console.error('[새 기록]', e); PGASMOD_PEND=null; } }
      if(want!==cur2){
        if(typeof window.wlOpenData==='function') window.wlOpenData(want);
        setTimeout(go, 340);
      } else {
        try{ if(typeof window.v43ActivateTab==='function') window.v43ActivateTab(isPersonal()?'life':'data'); }catch(e){}
        setTimeout(go, 120);
      }
    }catch(e){ console.error('[새 기록]', e); PGASMOD_PEND=null; }
  };
  /* 보기는 전체 화면으로 — wlGoPage 가 창 모드를 물려받지 않게 */
  window.wlPageModal = function(on){ PGASMOD_PEND = !!on; };

  /* 주소로 페이지 열기 */
  function pageFromHash(){
    var m=String(location.hash||'').match(/^#lp=([^&]+)(?:&ds=(.+))?$/);
    if(!m) return false;
    var id=decodeURIComponent(m[1]);
    var dk=m[2]?decodeURIComponent(m[2]):'';
    /* 업무일지 페이지면 그 데이터셋으로 먼저 옮긴다 */
    if(dk && (!DS || DS.key!=='work:'+dk)){
      try{ DS=dsWork(dk); HOST_ID='dataHost'; cur='rec'; curQ=''; curCat='전체'; EDIT=null;
        if(typeof window.v43ActivateTab==='function') window.v43ActivateTab('data');
        setTimeout(function(){ render(); setTimeout(function(){ openPage(id); }, 120); }, 60);
        return true;
      }catch(e){}
    }
    if(!dk && DS && DS.key!=='personal'){ DS=DS_PERSONAL; HOST_ID='lifeHost'; }
    var r=ent().filter(function(x){ return x.id===id; })[0];
    if(!r) return false;
    if(!PGLIST.length) PGLIST=[id];
    if(typeof window.v43ActivateTab==='function'){ try{ window.v43ActivateTab(isPersonal()?'life':'data'); }catch(e){} }
    openPage(id); return true;
  }
  window.addEventListener('popstate', function(){
    var open=document.getElementById('lfPageOv');
    if(/^#lp=/.test(location.hash||'')){ pageFromHash(); }
    else if(open){ open.remove(); setTimeout(render,0); }
  });
  /* 켤 때 주소에 페이지가 있으면 연다 */
  setTimeout(function(){
    var t=0;
    (function w(){
      if(!/^#lp=/.test(location.hash||'')) return;
      var wk=/&ds=/.test(location.hash||'');
      if(wk){ if(pageFromHash()) return; }
      else if(window.wlP && window.wlP.ready() && ent().length){ pageFromHash(); return; }
      if(t++<24) setTimeout(w, 500);
    })();
  }, 1200);

  /* ══════════════════════════════════════════════════════════
     🏷 업체 허브 — 업체 하나에 얽힌 모든 것을 한 화면에
     ══════════════════════════════════════════════════════════ */
  var VENDOR_KEYS = ['vendor','owner','company','payee','maker','who','place'];
  function vendorOf(e){
    if(!e) return '';
    for(var i=0;i<VENDOR_KEYS.length;i++){
      var v=e[VENDOR_KEYS[i]];
      if(v && String(v).trim()) return String(v).trim();
    }
    return '';
  }
  function vendorRows(name){
    var n=String(name||'').trim(); if(!n) return [];
    var out=[];
    try{
      (entries||[]).forEach(function(x){
        if(!x || !x.kind || x.kind==='personal' || x.kind==='pcontact') return;
        if(vendorOf(x)===n) out.push(x);
      });
    }catch(e){}
    return out.sort(function(a,b){
      var da=String(a.date||a.start||''), db=String(b.date||b.start||'');
      return da<db?1:(da>db?-1:0);
    });
  }
  function vendorContact(name){
    var n=String(name||'').trim(); if(!n) return null;
    try{
      var cs = (typeof loadContactsCacheList==='function') ? loadContactsCacheList() : (window.contactsCache||[]);
      for(var i=0;i<(cs||[]).length;i++){
        var c=cs[i]; if(!c) continue;
        if(String(c.company||c.name||'').trim()===n) return c;
      }
    }catch(e){}
    return null;
  }
  function vendorHub(name){
    var n=String(name||'').trim();
    if(!n){ noteMsg('업체 이름이 없어요'); return; }
    var rows=vendorRows(n);
    var ct=vendorContact(n);

    /* 종류별로 묶기 */
    var byKind={}; rows.forEach(function(x){ (byKind[x.kind]=byKind[x.kind]||[]).push(x); });
    var order=['work','progress','expense','stock','call','accident','meeting','deliver','memo','schedule','item','site','plan','vacation'];
    var kinds=order.filter(function(k){ return byKind[k]; })
      .concat(Object.keys(byKind).filter(function(k){ return order.indexOf(k)<0; }));

    /* 돈 계산 */
    var spend=0, open=0, noTax=0;
    rows.forEach(function(x){
      spend += asRec(x, function(){ return money(x); });
      var st=String(x.status||'');
      if(st && !/완료|종결/.test(st)) open++;
      if(x.kind==='expense' && /미발행|발행예정/.test(String(x.taxStatus||x.expType||''))) noTax++;
    });

    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9820';
    ov.innerHTML='<div class="lf-mod" style="max-width:880px">'
      + '<div class="lf-mh"><b>📇 '+esc(n)+'</b>'
      +   '<button type="button" id="lfVhX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div class="lf-sum" style="margin-bottom:2px">'
      +   sBox('거래 건수', rows.length+'건', kinds.length+'가지')
      +   sBox('총 지출',  numFmt(spend)+'원', '이 업체에 준 돈')
      +   sBox('진행 중',  open+'건', open? '아직 안 끝난 일':'없음')
      +   sBox('세금계산서', noTax? noTax+'건 미발행':'—', noTax? '확인 필요':'문제 없음')
      + '</div>'
      + (ct
         ? '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#f7fafd;border:1.5px solid #e8f0fa;border-radius:11px;padding:9px 12px;margin-top:10px">'
           + '<b style="font-size:13px;color:#1a2f45">📇 '+esc(ct.person||ct.name||'담당자')+'</b>'
           + (ct.mobile||ct.phone||ct.tel
              ? '<a href="tel:'+esc(String(ct.mobile||ct.phone||ct.tel).replace(/[^0-9+]/g,''))+'" style="color:#2563a8;font-weight:800;font-size:13px">📞 '+esc(ct.mobile||ct.phone||ct.tel)+'</a>':'')
           + (ct.addr? '<a href="https://map.naver.com/p/search/'+encodeURIComponent(ct.addr)+'" target="_blank" style="color:#0891b2;font-weight:700;font-size:12.5px">📍 '+esc(ct.addr)+'</a>':'')
           + '</div>'
         : '')
      + '<div style="max-height:52vh;overflow:auto;margin-top:10px">'
      + (rows.length
         ? kinds.map(function(k){
             var m=(typeof WORK_KINDS!=='undefined' && WORK_KINDS[k]) || {i:'📄', n:k};
             var list=byKind[k];
             var sub=0; list.forEach(function(x){ sub += asRec(x, function(){ return money(x); }); });
             return '<div style="margin-top:12px">'
               + '<div style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:900;color:#33567d;margin-bottom:5px">'
               +   '<span>'+m.i+' '+esc(m.n)+'</span>'
               +   '<span style="background:#dbe6f4;color:#5b7794;border-radius:9px;padding:1px 7px;font-size:11px">'+list.length+'</span>'
               +   (sub? '<span style="margin-left:auto;color:#0f7a4a;font-weight:900">'+numFmt(sub)+'원</span>':'')
               + '</div>'
               + '<table class="lf-tbl"><tbody>'
               + list.slice(0,40).map(function(x){
                   return '<tr><td style="width:96px;color:#8ba0b6;font-size:12px">'
                     + esc(asRec(x, function(){ return String(pget(x,'_date')||''); }))+'</td>'
                     + '<td><span class="lf-relchip" data-vhgo="'+esc(x.id)+'">'
                     +   esc(asRec(x, function(){ return pget(x,'_title')||'(제목없음)'; }))+'</span></td>'
                     + '<td style="width:110px;text-align:right;font-weight:800;color:#25405c">'
                     +   (function(){ var mm=asRec(x, function(){ return money(x); }); return mm? numFmt(mm)+'원':''; })()+'</td>'
                     + '<td style="width:86px;color:#8ba0b6;font-size:11.5px">'+esc(String(x.status||'').slice(0,8))+'</td></tr>';
                 }).join('')
               + '</tbody></table>'
               + (list.length>40? '<div style="font-size:11.5px;color:#a8b8c8;padding:4px 2px">+'+(list.length-40)+'건 더</div>':'')
               + '</div>';
           }).join('')
         : '<div style="text-align:center;color:#a8b8c8;padding:34px">이 업체로 된 기록이 아직 없어요</div>')
      + '</div>'
      + '<div class="lf-mbtn"><div style="flex:1"></div>'
      +   '<button type="button" id="lfVhC" style="height:42px;padding:0 20px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfVhX').addEventListener('click', cl);
    document.getElementById('lfVhC').addEventListener('click', cl);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    ov.querySelectorAll('[data-vhgo]').forEach(function(b){
      b.addEventListener('click', function(){ var id=b.getAttribute('data-vhgo'); cl(); openPage(id); }); });
  }
  window.wlVendorHub = vendorHub;

  /* 업체 고르기 — 이 화면에 나온 업체들 */
  function vendorPick(){
    var seen={}, list=[];
    try{
      (entries||[]).forEach(function(x){
        if(!x || !x.kind || x.kind==='personal' || x.kind==='pcontact') return;
        var v=vendorOf(x); if(!v) return;
        if(!seen[v]){ seen[v]={n:0, m:0}; list.push(v); }
        seen[v].n++;
        seen[v].m += asRec(x, function(){ return money(x); });
      });
    }catch(e){}
    list.sort(function(a,b){ return seen[b].m-seen[a].m || seen[b].n-seen[a].n; });
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9810';
    ov.innerHTML='<div class="lf-mod" style="max-width:640px">'
      + '<div class="lf-mh"><b>📇 업체 고르기</b>'
      +   '<button type="button" id="lfVpX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<input type="text" id="lfVpQ" class="lf-in" placeholder="🔍 업체 이름" style="width:100%;margin-bottom:8px">'
      + '<div id="lfVpL" style="max-height:56vh;overflow:auto"></div>'
      + '</div>';
    document.body.appendChild(ov);
    function draw(q){
      var s=String(q||'').toLowerCase();
      var f=list.filter(function(v){ return !s || v.toLowerCase().indexOf(s)>=0; });
      document.getElementById('lfVpL').innerHTML = f.length
        ? '<table class="lf-tbl"><tbody>' + f.slice(0,200).map(function(v){
            return '<tr><td><span class="lf-relchip" data-vp="'+esc(v)+'" style="font-size:13px">'+esc(v)+'</span></td>'
              + '<td style="width:80px;color:#8ba0b6;font-size:12px">'+seen[v].n+'건</td>'
              + '<td style="width:120px;text-align:right;font-weight:800;color:#25405c">'
              + (seen[v].m? numFmt(seen[v].m)+'원':'')+'</td></tr>'; }).join('')
          + '</tbody></table>'
        : '<div style="text-align:center;color:#a8b8c8;padding:30px">찾는 업체가 없어요</div>';
      document.getElementById('lfVpL').querySelectorAll('[data-vp]').forEach(function(b){
        b.addEventListener('click', function(){ var v=b.getAttribute('data-vp'); ov.remove(); vendorHub(v); }); });
    }
    draw('');
    var q=document.getElementById('lfVpQ');
    q.addEventListener('input', function(){ draw(q.value); });
    document.getElementById('lfVpX').addEventListener('click', function(){ ov.remove(); });
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) ov.remove(); });
    setTimeout(function(){ try{ q.focus(); }catch(e){} }, 60);
  }

  /* ══════════════════════════════════════════════════════════
     📋 템플릿 — 자주 쓰는 기록을 미리 만들어 두고 한 번에
     ══════════════════════════════════════════════════════════ */
  var LS_TPL='wl_life_tpl';
  function tplAll(){ var o=lsGet(LS_TPL,null); return (o&&typeof o==='object')?o:{}; }
  function tplKey(pt){ return isPersonal() ? dsk(pt) : dsk(''); }
  function tplOf(pt){ var a=tplAll()[tplKey(pt)]; return Array.isArray(a)?a:[]; }
  function tplSave(pt,arr){ var o=tplAll(); o[tplKey(pt)]=arr.slice(); lsSet(LS_TPL,o); }

  /* 템플릿으로 새 줄 만들기 */
  function newRowTpl(pt, tpl){
    var o = DS.newRec(pt||'etc');
    if(isPersonal()){
      o.date = o.date || today(); if(o.title==null) o.title='';
    } else {
      var bd=(DS.bmap&&DS.bmap._date)||[], bt=(DS.bmap&&DS.bmap._title)||[];
      if(bd.length && !o[bd[0]]) o[bd[0]] = today();
      if(bt.length && o[bt[0]]==null) o[bt[0]] = '';
      o.date = o.date || today();
    }
    o.createdAt = Date.now();
    Object.keys(tpl.vals||{}).forEach(function(pid){
      var v=tpl.vals[pid];
      if(v==null || v==='') return;
      var patch = ppatch(o, pid, v);
      for(var k in patch){ if(k==='props') o.props=Object.assign({}, o.props||{}, patch.props); else o[k]=patch[k]; }
    });
    if(tpl.body) o.body = tpl.body;
    var rec = pAdd(o);
    if(!rec){ noteMsg('추가하지 못했어요'); return; }
    if(!(srt.k==='date' && srt.d<0)){ srt={k:'date', d:-1}; lsSet(LS_SORT, srt); }
    if(typeof toast==='function') toast('📑 "'+tpl.name+'" 으로 새 기록을 만들었어요');
    setTimeout(function(){ render(); setTimeout(function(){ openPage(rec.id); }, 120); }, 0);
  }

  /* 지금 보고 있는 기록을 템플릿으로 */
  function tplFromRec(pt, rec){
    if(!rec) return;
    askText('템플릿 이름을 지어주세요', String(pget(rec,'_title')||'').slice(0,20),
            { sub:'예) 누수 사고 · 월간 소방점검', ph:'템플릿 이름', ok:'저장' }).then(function(nm){
    if(nm===null) return; nm=String(nm).trim(); if(!nm) return;
    var skip={_att:1, _date:1};
    var vals={};
    propsOf(pt).forEach(function(p){
      if(skip[p.id]) return;
      if(['formula','rollup','att'].indexOf(p.type)>=0) return;
      var v=pget(rec,p.id);
      if(v==null || v==='' || (Array.isArray(v)&&!v.length)) return;
      vals[p.id]=v;
    });
    var a=tplOf(pt);
    a.push({ id:'t'+Date.now(), name:nm, icon:'📑', vals:vals, body:rec.body||'' });
    tplSave(pt,a);
    if(typeof toast==='function') toast('📑 "'+nm+'" 템플릿을 저장했어요');
    safeRender();
    });
  }

  function tplPick(pt){
    var a=tplOf(pt);
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9790';
    ov.innerHTML='<div class="lf-mod" style="max-width:640px">'
      + '<div class="lf-mh"><b>📑 템플릿으로 만들기</b>'
      +   '<button type="button" id="lfTpX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div style="font-size:12.5px;color:#7a92a8;line-height:1.6">'
      +   '자주 쓰는 기록을 미리 만들어 두면, 누르는 순간 내용이 채워진 채로 열립니다.<br>'
      +   '<b>목록에서 기록 하나를 열고 「📑 템플릿으로」</b> 를 누르면 그 모양 그대로 저장돼요.</div>'
      + (a.length
         ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:12px">'
           + a.map(function(t){
               var cnt=Object.keys(t.vals||{}).length;
               return '<div style="border:1.5px solid #e8f0fa;border-radius:11px;padding:10px 12px;background:#fff">'
                 + '<div style="font-size:13.5px;font-weight:900;color:#1a2f45">'+esc(t.icon||'📑')+' '+esc(t.name)+'</div>'
                 + '<div style="font-size:11.5px;color:#8ba0b6;margin-top:3px">'+cnt+'개 칸이 미리 채워져요</div>'
                 + '<div style="display:flex;gap:6px;margin-top:8px">'
                 +   '<button type="button" class="lf-radd" data-tpgo="'+esc(t.id)+'" style="height:32px;flex:1">＋ 만들기</button>'
                 +   '<button type="button" class="lf-fx" data-tpdel="'+esc(t.id)+'" style="color:#b52929">🗑</button>'
                 + '</div></div>'; }).join('')
           + '</div>'
         : '<div style="text-align:center;color:#a8b8c8;padding:30px">저장된 템플릿이 없어요<br>'
           + '<span style="font-size:12px">기록 하나를 페이지로 열고 「📑 템플릿으로」 를 눌러 보세요</span></div>')
      + '<div class="lf-mbtn"><div style="flex:1"></div>'
      +   '<button type="button" id="lfTpC" style="height:42px;padding:0 20px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfTpX').addEventListener('click', cl);
    document.getElementById('lfTpC').addEventListener('click', cl);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    ov.querySelectorAll('[data-tpgo]').forEach(function(b){
      b.addEventListener('click', function(){
        var t=tplOf(pt).filter(function(x){ return x.id===b.getAttribute('data-tpgo'); })[0];
        cl(); if(t) newRowTpl(pt, t); }); });
    ov.querySelectorAll('[data-tpdel]').forEach(function(b){
      b.addEventListener('click', function(){
        askDel('이 템플릿을 지울까요?', '이미 만든 기록은 그대로 남습니다').then(function(ok){
          if(!ok) return;
          var id=b.getAttribute('data-tpdel');
          tplSave(pt, tplOf(pt).filter(function(x){ return x.id!==id; }));
          cl(); tplPick(pt);
        }); }); });
  }

  /* ══════════════════════════════════════════════════════════
     🧹 아무것도 안 쓴 기록은 남기지 않는다
        · [＋ 기록 추가] 로 만든 빈 껍데기를 '임시(DRAFT)' 로 표시
        · 페이지를 닫을 때 여전히 비어 있으면 조용히 지운다
     ══════════════════════════════════════════════════════════ */
  var DRAFT = null;
  var EMPTY_SKIP = { _cat:1, _date:1, _att:1 };
  function isBlank(rec){
    if(!rec) return false;
    if(String(rec.body||'').replace(/<[^>]*>/g,'').trim()) return false;
    if(esr(rec.photos).length || esr(rec.scanRefs).length) return false;
    var pt = DS.ptypeOf(rec) || '';
    var ps;
    try{ ps = propsOf(pt); }catch(e){ return false; }
    for(var i=0;i<ps.length;i++){
      var p=ps[i];
      if(EMPTY_SKIP[p.id]) continue;
      if(['formula','rollup'].indexOf(p.type)>=0) continue;
      var v;
      try{ v = pget(rec, p.id); }catch(e){ continue; }
      if(v==null || v===false) continue;
      if(Array.isArray(v)){ if(v.length) return false; continue; }
      if(typeof v==='number'){ if(v!==0) return false; continue; }
      if(String(v).trim()!=='') return false;
    }
    /* 표(반복 항목)도 확인 */
    var rowKeys=['costs','menus','parts','items','steps'];
    for(var k=0;k<rowKeys.length;k++) if(esr(rec[rowKeys[k]]).length) return false;
    return true;
  }
  /* 임시 기록이 아직 비어 있으면 지운다 */
  function draftDrop(){
    if(!DRAFT) return false;
    var id=DRAFT;
    var rec=ent().filter(function(x){ return x.id===id; })[0];
    if(!rec){ DRAFT=null; return false; }
    if(!isBlank(rec)) { DRAFT=null; return false; }
    DRAFT=null;
    try{ pDel(id); }catch(e){ return false; }
    if(typeof toast==='function') toast('아무것도 안 써서 저장하지 않았어요');
    return true;
  }
  window.wlDraftDrop = draftDrop;
  window.wlDraftId   = function(){ return DRAFT; };

  /* ── 목록 안에서 바로 새 줄 만들기 ── */
  function newRow(pt, preset, asPage){
    var o = DS.newRec(pt||'etc');
    if(isPersonal()){
      o.date = o.date || today(); if(o.title==null) o.title='';
    } else {
      var bd=(DS.bmap&&DS.bmap._date)||[], bt=(DS.bmap&&DS.bmap._title)||[];
      if(bd.length && !o[bd[0]]) o[bd[0]] = today();
      if(bt.length && o[bt[0]]==null) o[bt[0]] = '';
      o.date = o.date || today();
    }
    o.createdAt = Date.now();
    if(isPersonal() && pt==='car'){ o.car = curCar || (cars()[0]||{}).n || ''; o.ctype = curCtype || '주유'; }
    /* 기간 필터가 걸려 있으면 그 안의 날짜로 */
    if(flt.from && o.date < flt.from) o.date = flt.from;
    if(flt.to   && o.date > flt.to)   o.date = flt.to;
    /* 지금 걸린 조건 중 '같음' 은 미리 채워준다 */
    (flt.rules||[]).forEach(function(r){
      if(r.op!=='같음' && r.op!=='체크됨') return;
      var pp=propById(pt, r.pid); if(!pp || pp.base && pp.id==='_cat') return;
      var pv = (r.op==='체크됨') ? true : r.val;
      var patch = ppatch(o, r.pid, pv);
      for(var k in patch){ if(k==='props'){ o.props=Object.assign({}, o.props||{}, patch.props); } else o[k]=patch[k]; }
    });
    /* 묶은 그룹 값도 미리 채움 */
    if(preset && preset.pid && preset.val!=null && preset.pid!=='_cat' && preset.pid!=='_month'){
      var pp2=propById(pt, preset.pid);
      if(pp2 && ['formula','rollup','att','tag'].indexOf(pp2.type)<0){
        var v2 = (pp2.type==='check') ? (String(preset.val).indexOf('☑')>=0) : preset.val;
        var pt2 = ppatch(o, preset.pid, v2);
        for(var k2 in pt2){ if(k2==='props'){ o.props=Object.assign({}, o.props||{}, pt2.props); } else o[k2]=pt2[k2]; }
      }
    }
    var rec = pAdd(o);
    if(!rec){ noteMsg('추가하지 못했어요'); return; }
    /* 방금 만든 것이 눈에 보이게 — 최근 날짜가 맨 위로 오도록 정렬을 돌려놓는다 */
    if(!(srt.k==='date' && srt.d<0)){
      srt={k:'date', d:-1}; lsSet(LS_SORT, srt);
    }
    if(asPage){
      DRAFT = rec.id;                       /* 아무것도 안 쓰고 닫으면 지운다 */
      if(typeof toast==='function') toast('새 기록을 만들었어요 — 바로 채워 보세요');
      setTimeout(function(){ render(); setTimeout(function(){ openPage(rec.id); }, 120); }, 0);
      return;
    }
    EDIT = { id: rec.id, pid: '_title' };
    if(typeof toast==='function') toast('새 줄이 생겼어요 — 바로 쓰세요');
    setTimeout(function(){
      render();
      setTimeout(function(){
        try{
          var el=document.getElementById(HOST_ID);
          var tr=el && (el.querySelector('tr[data-rid="'+rec.id+'"]') || el.querySelector('[data-lsid="'+rec.id+'"]'));
          if(tr) tr.scrollIntoView({block:'center'});
        }catch(e){}
      }, 60);
    }, 0);
  }
  /* 전체 보기일 땐 종류부터 고른다 */
  function newRowAsk(preset, asPage){
    var pt = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    if(!isPersonal()) { newRow(DS.kind, preset, asPage); return; }
    if(pt) { newRow(pt, preset, asPage); return; }
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9700';
    ov.innerHTML='<div class="lf-mod" style="max-width:600px">'
      + '<div class="lf-mh"><b>어떤 기록을 추가할까요?</b>'
      +   '<button type="button" id="lfNX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div class="lf-cats">' + catPickList().map(function(d){
          return '<button type="button" class="lf-cb" data-nk="'+d.k+'"><span class="i">'+d.i+'</span><span class="l">'+d.n+'</span></button>'; }).join('')
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfNX').addEventListener('click', cl);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
    ov.querySelectorAll('[data-nk]').forEach(function(b){
      b.addEventListener('click', function(){ var k=b.getAttribute('data-nk'); cl(); newRow(k, preset, asPage); }); });
  }

  /* ══════════════════════════════════════════════════════════
     ≣ 리스트 보기 — 표와 같은 칸을 쓰되 폭을 고르게 나눈다
        · 가로 스크롤 없음 · 좁으면 두 줄로 접힘
     ══════════════════════════════════════════════════════════ */
  /* 리스트는 '날짜 + 제목' 만 — 대신 여러 칸으로 촘촘히 */
  var LS_LSCOL='wl_life_lscol';
  function lsColN(){
    var n = +lsGet(LS_LSCOL, 0);
    if(n>=1 && n<=6) return n;
    var w = (typeof window!=='undefined' ? window.innerWidth : 1200);
    if(w>=1500) return 5;
    if(w>=1200) return 4;
    if(w>=900)  return 3;
    if(w>=620)  return 2;
    return 1;
  }
  function lsColSet(n){ lsSet(LS_LSCOL, n); safeRender(); }
  function listHTML(arr, emptyIcon, emptyMsg){
    var pt = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    var tot=arr.length;
    arr = applySrt(applyFlt(arr));
    var bar = fltBar(arr.length, tot);
    if(!arr.length) return bar + '<div class="lf-grid"><div class="lf-empty"><div class="ei">'+emptyIcon+'</div>'
      + (fltOn()? '조건에 걸리는 기록이 없어요' : emptyMsg)
      + '<div style="margin-top:14px"><button type="button" class="lf-add" data-newrow="1" style="height:38px">＋ 여기서 바로 추가</button></div>'
      + '</div></div>';

    PGLIST = arr.map(function(e){ return e.id; });
    var N = lsColN();

    var eg = effGrp(pt);
    var grouped = (grp!=='_none') && ((srt.k==='date') || !!grp);
    if(eg!=='_month' && grouped){
      arr = grpSort(arr, pt, eg);
    }

    var h = bar
      + '<div class="lf-bldbar">'
      +   '<span style="font-size:13px;font-weight:900;color:#1a2f45">≣ 리스트</span>'
      +   '<span style="font-size:11.5px;color:#a8b8c8">날짜와 제목만 — 한눈에 훑기</span>'
      +   '<span class="lb" style="font-size:11.5px;font-weight:800;color:#8ba0b6;margin-left:auto">칸 수</span>'
      +   '<div class="lf-vw" id="lfLsN">'
      +     [1,2,3,4,5,6].map(function(n){
            return '<button type="button" data-lsn="'+n+'"'+(n===N?' class="on"':'')+'>'+n+'</button>'; }).join('')
      +   '</div>'
      + '</div>'
      + '<div class="lf-ls">';

    function chunk(list){
      var out='';
      list.forEach(function(e){
        var ch=colorHit(e,pt);
        var d = String(pget(e,'_date')||'');
        out += '<div class="lf-lsi" data-lsid="'+esc(e.id)+'"'+(ch?' style="background:'+colorOf(ch.color).bg+'"':'')+'>'
          + '<span class="d">'+esc(d.slice(5) || '—')+'</span>'
          + '<span class="t">'+esc(pget(e,'_title')||'(제목없음)')+'</span>'
          + (e.body? '<span class="m" title="본문이 있어요">📝</span>':'')
          + (esr(e.photos).length? '<span class="m" title="사진">📷</span>':'')
          + '<button type="button" class="x" data-ldel="'+esc(e.id)+'" title="삭제">🗑</button>'
          + '</div>';
      });
      return '<div class="lf-lsgrid" style="grid-template-columns:repeat('+N+',minmax(0,1fr))">'+out+'</div>';
    }

    if(grouped){
      var buckets=[], seen={};
      arr.forEach(function(e){
        var m=grpKey(e, pt);
        if(!seen[m]){ seen[m]={k:m, list:[]}; buckets.push(seen[m]); }
        seen[m].list.push(e);
      });
      buckets.forEach(function(b2){
        var gs=0; b2.list.forEach(function(x){ gs+=money(x); });
        h += '<div class="lf-lsg"><span>'+esc(grpLabel(b2.k, pt))+'</span>'
           + '<span style="color:#8ba0b6;font-weight:800">'+b2.list.length+'건</span>'
           + (gs? '<span class="s">'+numFmt(gs)+'원</span>':'') + '</div>'
           + chunk(b2.list);
      });
    } else {
      h += chunk(arr);
    }
    h += '<div class="lf-lsadd" data-newrow="1">＋ 새 줄 추가</div>';
    return h + '</div>';
  }

  function tableHTML(arr, emptyIcon, emptyMsg){
    var pt = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    var tot=arr.length;
    arr = applySrt(applyFlt(arr));
    var bar = fltBar(arr.length, tot);
    if(!arr.length) return bar + '<div class="lf-grid"><div class="lf-empty"><div class="ei">'+emptyIcon+'</div>'
      + (fltOn()? '필터에 걸리는 기록이 없어요<div style="font-size:12px;margin-top:6px">✕ 필터 해제를 눌러보세요</div>' : emptyMsg)
      + '<div style="margin-top:14px"><button type="button" class="lf-add" data-newrow="1" style="height:38px">＋ 여기서 바로 추가</button></div>'
      + '</div></div>';

    /* 칸 순서는 [⚙ → 칸 순서] 에서 정한 그대로 쓴다 */
    var sel = colsOf(pt);
    var cols = sel.map(function(id){ return propById(pt,id); }).filter(Boolean);
    if(!cols.length) cols = BASE.filter(function(p){ return DEF_COLS.indexOf(p.id)>=0; });
    var iAmt = -1; cols.forEach(function(p,i){ if(p.id==='_amount') iAmt=i; });
    var nCol = cols.length + 1;
    var CW = colwOf(pt), TOTW = 66;                 /* 66 = ⚙ 칸 */
    function defW(p){
      if(p.id==='_title') return 280;
      var w = String(p.w || tinfo(p.type).w || '120px');
      var n = parseInt(w,10);
      return isNaN(n) ? 120 : n;
    }

    var sumAll=0; arr.forEach(function(e){ sumAll+=money(e); });
    var egT = effGrp(pt);
    var grouped = (grp!=='_none') && ((srt.k==='date') || !!grp);
    if(egT!=='_month' && grouped) arr = grpSort(arr, pt, egT);
    PGLIST = arr.map(function(e){ return e.id; });        /* ◀ ▶ 이동용 */

    var CF = colfOf(pt);
    var h=bar+'<div class="lf-tvwrap"><table class="lf-tv{{FRZ}}" style="min-width:{{MINW}}px"><thead><tr>';
    cols.forEach(function(p){
      var ti=tinfo(p.type);
      var srtKey = p.id==='_date'?'date' : p.id==='_amount'?'amount' : p.id==='_title'?'title' : p.id==='_cat'?'cat' : ('p:'+p.id);
      var on = (srt.k===srtKey);
      var wpx = CW[p.id] || defW(p);
      TOTW += wpx;
      var fon = !!CF[p.id];
      h+='<th class="s'+(on?' on':'')+(fon?' fon':'')+'" data-srt="'+esc(srtKey)+'"'
        + ' draggable="true" data-thid="'+esc(p.id)+'" title="⋮⋮ 끌면 자리 이동 · 오른쪽 끝을 끌면 폭 조절 (두 번 누르면 원래대로)"'
        + ' style="width:'+wpx+'px'+(ti.right?';text-align:right':(ti.center?';text-align:center':''))+'">'
        + '<span class="thg">⋮⋮</span>'
        + ti.i+' '+esc(p.name)+(on? '<span class="ar">'+(srt.d>0?'▲':'▼')+'</span>':'')
        + '<button type="button" class="thf'+(fon?' on':'')+'" data-colf="'+esc(p.id)+'"'
        +   ' title="'+(fon? '거르는 중 — 눌러서 고치기':'이 칸으로 거르기')+'">▾</button>'
        + '<span class="thrs" data-thrs="'+esc(p.id)+'"></span></th>';
    });
    h+='<th style="width:66px;text-align:center"><button type="button" id="lfColBtn" class="lf-fx" style="height:26px;padding:0 8px" title="보일 칸 고르기">⚙</button></th>';
    h+='</tr></thead><tbody>';
    h = h.replace('{{FRZ}}', frzOn()? ' frz':'').replace('{{MINW}}', TOTW);

    var last=null, first=true;
    /* v166 🔴 여기서 다시 정렬하면 위의 grpSort() 결과가 통째로 죽는다.
       (단순 오름차순이라 빈 값이 맨 위로 올라오고 날짜가 뒤죽박죽이 됐다)
       묶을지 말지만 켜고, 줄 세우기는 grpSort() 에 맡긴다. */
    if(grp && grp!=='_none') grouped = true;
    arr.forEach(function(e){
      if(grouped){
        var m=grpKey(e, pt);
        if(m!==last || first){
          if(!first && last!==null){
            h+='<tr class="lf-newrow"><td colspan="'+nCol+'" data-newrow="1"'
              + ' data-ngpid="'+esc(grp||'')+'" data-ngval="'+esc(String(last))+'">＋ 새 줄</td></tr>';
          }
          last=m; first=false;
          var gs=0, gn=0;
          arr.forEach(function(x){ if(grpKey(x,pt)===m){ gs+=money(x); gn++; } });
          var lft = Math.max(1, (iAmt>=0? iAmt : nCol-1));
          h+='<tr class="lf-grp"><td colspan="'+lft+'" style="padding:5px 11px">'
            + esc(grpLabel(m, pt))
            + ' <span style="font-weight:700;color:#7a92a8">'+gn+'건</span></td>'
            + '<td colspan="'+(nCol-lft)+'" style="padding:5px 11px;text-align:right;color:'+(gs?'#0f7a4a':'#a8b8c8')+'">'
            + (gs? numFmt(gs)+'원':'') + '</td></tr>'; }
      }
      var ch = colorHit(e, pt);
      var rowSty = (e.done?'opacity:.55;':'') + (ch? ('background:'+colorOf(ch.color).bg+'99;'):'');
      h+='<tr data-rid="'+esc(e.id)+'"'+(rowSty?' style="'+rowSty+'"':'')+'>';
      cols.forEach(function(p){
        var ti=tinfo(p.type);
        var ro = ti.ro || (p.id==='_amount' && amountLocked(e));
        var editing = EDIT && EDIT.id===e.id && EDIT.pid===p.id;
        var cls = (p.id==='_date'?'dt ':'') + (ti.right?'r ':'') + (ti.center?'c ':'');
        h+='<td class="'+cls.trim()+(ro?'':' ce')+'" data-pid="'+esc(p.id)+'"'
          + (ro?'':' title="눌러서 바로 고치기"')+'>'
          + (editing ? editorHTML(p, pget(e,p.id)) : cellHTML(e,p))
          + '</td>';
      });
      h+='<td class="c" style="white-space:nowrap">'
        + '<button type="button" class="xd" data-lopenr="'+esc(e.id)+'" title="창 열기" style="background:#eef5fd;color:#2563a8;margin-right:3px">↗</button>'
        + '<button type="button" class="xd" data-ldel="'+esc(e.id)+'" title="삭제">🗑</button></td>';
      h+='</tr>';
    });
    /* 마지막 그룹 뒤에도 ＋ 줄 */
    if(grouped && last!==null){
      h+='<tr class="lf-newrow"><td colspan="'+nCol+'" data-newrow="1"'
        + ' data-ngpid="'+esc(grp||'')+'" data-ngval="'+esc(String(last))+'">＋ 새 줄</td></tr>';
    }
    h+='<tr class="lf-newrow big"><td colspan="'+nCol+'" data-newrow="1">＋ 새 줄 추가</td></tr>';
    if(sumAll){
      var lft2 = Math.max(1, (iAmt>=0? iAmt : nCol-1));
      h+='<tr class="lf-sum2"><td colspan="'+lft2+'">합계 · '+won(arr.length)+'건</td>'
       + '<td class="r" style="color:#0f7a4a">'+numFmt(sumAll)+'원</td>'
       + (nCol-lft2-1>0? '<td colspan="'+(nCol-lft2-1)+'"></td>':'') + '</tr>';
    }
    return h+'</tbody></table></div>';
  }

  /* 날짜 그룹 붙여서 그리기 */
  function gridHTML(arr, emptyIcon, emptyMsg){
    var ptG = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    if(vw==='table') return tableHTML(arr, emptyIcon, emptyMsg);
    if(vw==='list')  return listHTML(arr, emptyIcon, emptyMsg);
    if(vw==='board') return boardHTML(arr, ptG);
    if(vw==='cal')   return calHTML(arr, ptG);
    if(vw==='floor') return hasFloors(ptG) ? floorHTML(arr, ptG) : cardsHTML(arr, emptyIcon, emptyMsg);
    if(vw==='time')  return timelineHTML(arr, ptG);
    if(vw==='gal')   return galleryHTML(arr, ptG);
    return cardsHTML(arr, emptyIcon, emptyMsg);
  }
  /* ── 카드 보기의 「구분 기준」 ──────────────────────────────
     사용자가 고른 게 있으면 그것, 없으면 그 종류에 가장 자연스러운 것.
     · 업무·진행업무·사고 → 상태   · 지출 → 종류   · 입출고 → 입고/출고
     · 그 밖에는 월별 */
  function cardGrp(pt){ return effGrp(pt); }
  function cardKey(e, pt, g){ return grpKey(e, pt); }
  function cardHead(k, pt, g, list){
    var sum=0, n=list.length;
    list.forEach(function(x){ sum += money(x); });
    var name, icon, col;
    if(g==='_stat'){
      name = k || '구분 없음';
      col  = k ? statColor(k, pt) : '#94a3b8';
      icon = k ? '' : '·';
      /* 아이콘이 앞에 붙은 상태(⏳ 접수)는 그 이모지를 그대로 쓴다 */
      var mm = /^([\u2000-\u3300\u2190-\u21FF\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF]+)\s*(.*)$/.exec(name||'');
      if(mm && mm[1]){ icon = mm[1]; name = mm[2] || name; }
      else if(!icon) icon = '\u25CF';
    } else if(g==='_month'){
      name = k ? (k.replace('-','년 ')+'월') : '날짜 없음';
      icon = '\uD83D\uDCC5'; col = '#5b7794';
    } else {
      name = grpLabel(k, pt) || '(비어있음)';
      var p0 = propById(pt, g);
      icon = p0 ? tinfo(p0.type).i : '\uD83C\uDFF7';
      col  = '#5b7794';
    }
    return '<div class="lf-ghd" style="--gc:'+col+'">'
      + '<span class="gi">'+icon+'</span>'
      + '<span class="gn">'+esc(name)+'</span>'
      + '<span class="gsp"></span>'
      + (sum? '<span class="gs">'+numFmt(sum)+'원</span>':'')
      + '<span class="gc">'+n+'건</span>'
      + '</div>';
  }
  function cardsHTML(arr, emptyIcon, emptyMsg){
    var pt = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    var tot0=arr.length;
    arr = applySrt(applyFlt(arr));
    var bar = fltBar(arr.length, tot0);
    if(!arr.length) return bar + '<div class="lf-grid"><div class="lf-empty"><div class="ei">'+emptyIcon+'</div>'
      + (fltOn()? '조건에 걸리는 기록이 없어요' : emptyMsg) + '</div></div>';
    PGLIST = arr.map(function(e){ return e.id; });
    var g  = cardGrp(pt);

    /* 구분별로 담는다 */
    var buckets=[], seen={};
    arr.forEach(function(e){
      var k = cardKey(e, pt, g);
      if(!seen[k]){ seen[k]={k:k, list:[]}; buckets.push(seen[k]); }
      seen[k].list.push(e);
    });

    /* 구분의 차례 — 상태는 일 순서대로, 날짜성 값은 최근 것부터 (v166) */
    var dlC = (g!=='_stat') && keysDateLike(buckets.map(function(x){ return x.k; }));
    buckets.sort(function(a,b){
      if(a.k==='') return 1; if(b.k==='') return -1;      /* 빈 값은 항상 맨 아래 */
      if(g==='_month' || dlC) return String(b.k).localeCompare(String(a.k));
      var ra=grpRank(a.k,pt,g), rb=grpRank(b.k,pt,g);
      if(ra!==rb) return ra-rb;
      return String(a.k).localeCompare(String(b.k),'ko');
    });

    var h=bar + '<div class="lf-grid">';
    buckets.forEach(function(b2){
      if(g!=='_none') h += cardHead(b2.k, pt, g, b2.list);
      b2.list.forEach(function(e){ h += card(e); });
    });
    return h+'</div>';
  }

  /* ══════ ① 기록 탭 ══════ */
  function viewRec(){
    var all = recs().filter(function(e){ return e.ptype!=='car'; });
    var cnt={}; all.forEach(function(e){ cnt[e.ptype]=(cnt[e.ptype]||0)+1; });

    var chips = '<div class="lf-chip'+(curCat==='전체'?' on':'')+'" data-lc="전체"'
      + (curCat==='전체'?' style="background:#2563a8"':'') + '>전체 <b>'+all.length+'</b></div>';
    Object.keys(cats()).forEach(function(k){
      var d=cats()[k], n=cnt[k]||0, on=curCat===k;
      chips += '<div class="lf-chip'+(on?' on':'')+(n?'':' dim')+'" data-lc="'+k+'"'
        + (on?' style="background:'+d.c+'"':'') + '>'+d.i+' '+d.n+(n?' <b>'+n+'</b>':'')+'</div>';
    });

    var list = byDate(all.filter(function(e){
      return (curCat==='전체'||e.ptype===curCat) && hit(e,curQ); }));
    // 챙길 일: 안 끝난 것 위로
    if(curCat==='todo') list.sort(function(a,b){ return (a.done?1:0)-(b.done?1:0); });

    var spend=0, thisMonth=today().slice(0,7), mSpend=0;
    all.forEach(function(e){ var m=money(e); spend+=m;
      if(String(e.date||'').slice(0,7)===thisMonth) mSpend+=m; });
    var todos = recs('todo').filter(function(e){ return !e.done && e.date; });
    var urgent = todos.map(function(e){ return {e:e,d:dday(e.date)}; })
      .filter(function(x){ return x.d!==null; }).sort(function(a,b){ return a.d-b.d; })[0];

    var sum = '<div class="lf-sum">'
      + sBox('이번 달 지출', won(mSpend)+'원', thisMonth.replace('-','년 ')+'월')
      + sBox('전체 지출', won(spend)+'원', all.length+'건 기록')
      + sBox('챙길 일', todos.length+'건', urgent? (urgent.e.title+' · '+(urgent.d<0?(-urgent.d)+'일 지남':urgent.d===0?'오늘':'D-'+urgent.d)) : '없음')
      + sBox('예정 지출', won(todos.reduce(function(a,e){ return a+num(e.amount); },0))+'원', '챙길 일에 적어둔 금액')
      + '</div>';

    /* 업무일지 데이터셋은 개인 전용 요약·분류칩·안내띠를 안 쓴다 */
    var showP = isPersonal();
    /* v231 — 달님 : 「개인은 돈 쓴 것보다 기록에 뜻을 두니 지출 요약은 없어도 된다」
       ① 큰 요약 카드 4장(이번 달 지출·전체 지출·챙길 일·예정 지출) 제거
       ② 분류 칩 줄과 검색칸을 한 줄로 합침 (검색줄 lf-bar 통째로 없앰)
       ③ 📑 템플릿 · ➕ 기록 추가는 아래 도구줄로 내려보냄 — fltBar 안에 있다
       🔴 요약을 다시 보고 싶으면 📊 결산 탭에 그대로 다 있다.
          sum 은 지우지 않고 남겨 둔다 (되살릴 때 한 줄이면 된다). */
    /* v233 — 분류 칩 줄은 도구줄의 「분류 고르개」 로 옮겼다 (catSelP)
       chips 변수는 지우지 않고 남겨 둔다 — 되살릴 때 한 줄이면 된다 */
    return blankBar()
      + (showP ? oldBanner() : '')
      + gridHTML(list, (cats()[curCat]||{i:'🏠'}).i, (curQ?'검색 결과가 없어요':'아직 기록이 없어요<div style="font-size:12px;margin-top:6px">➕ 를 눌러 시작하세요</div>'));
  }

  /* 예전 개인일지에서 아직 안 가져왔으면 안내 */
  var LS_OLDBN='wl_life_oldbanner';
  function oldBanner(){
    /* v233 — 달님 : 「두 줄로」
       띠를 아예 안 띄운다. 하는 일은 ⚙ 도구 안 「📥 예전 개인일지 가져오기」 로 옮겼다.
       다시 띠로 보고 싶으면 아래 return ''; 한 줄만 지우면 된다. */
    return '';
    /* eslint-disable no-unreachable */
    try{ if(localStorage.getItem(LS_OLDBN)==='off') return ''; }catch(e){}
    if(ent().some(function(e){ return e.fromOld; })) return '';
    /* v231 — 두 줄짜리 큰 띠였다. 하는 일은 그대로 두고 한 줄로 줄인다 */
    return '<div id="lfOldBn" style="background:#f8f6ff;border:1px solid #e3daf7;border-radius:9px;'
      + 'padding:6px 11px;margin-bottom:9px;display:flex;align-items:center;gap:9px;flex-wrap:wrap">'
      + '<span style="flex:1;min-width:180px;font-size:12px;color:#6b5aa0"'
      +   ' title="쓰시던 개인일지 앱의 기록·연락처를 한 번에 가져옵니다. 예전 앱 기록은 그대로 남습니다.">'
      +   '📥 예전 개인일지 기록 가져오기</span>'
      + '<button type="button" id="lfOldGo" style="height:26px;padding:0 11px;border:none;border-radius:7px;'
      +   'background:#7c3aed;color:#fff;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit">가져오기</button>'
      + '<button type="button" id="lfOldNo" style="height:26px;padding:0 9px;border:1px solid #e3daf7;border-radius:7px;'
      +   'background:#fff;color:#a99bc9;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">숨기기</button>'
      + '</div>';
  }

  /* ══════ ② 차계부 탭 ══════ */
  function viewCar(){
    var all = recs('car');
    var cl = cars();
    if(!curCar || !cl.some(function(c){ return c.n===curCar; })){
      var sv = lsGet(LS_CAR, null);
      if(sv && cl.some(function(c){ return c.n===sv; })) curCar = sv;
      else {
        var cc={}; all.forEach(function(e){ if(e.car) cc[e.car]=(cc[e.car]||0)+1; });
        var best='', bn=-1;
        cl.forEach(function(c){ var n=cc[c.n]||0; if(n>bn){ bn=n; best=c.n; } });
        curCar = best || (cl[0]||{}).n || '';
      }
    }

    var chips='';
    cl.forEach(function(c){
      var n=all.filter(function(e){ return e.car===c.n; }).length;
      chips += '<div class="lf-chip'+(curCar===c.n?' on':'')+'" data-lcar="'+esc(c.n)+'"'
        + (curCar===c.n?' style="background:'+c.c+'"':'') + '>🚗 '+esc(c.n)+(n?' <b>'+n+'</b>':'')+'</div>';
    });
    chips += '<div class="lf-chip" data-lcarmgr="1" style="border-style:dashed">⚙️ 차량 관리</div>';

    var mine = all.filter(function(e){ return e.car===curCar; });
    var months = {}; mine.forEach(function(e){ var m=String(e.date||'').slice(0,7); if(m) months[m]=1; });
    var mopt = '<option value="">전체 월</option>' + Object.keys(months).sort().reverse().map(function(m){
      return '<option value="'+m+'"'+(curMonth===m?' selected':'')+'>'+m.replace('-','년 ')+'월</option>'; }).join('');
    var CT=['주유','정비','보험','세차','검사','주차·통행료','기타'];
    var copt = '<option value="">전체 종류</option>' + CT.map(function(c){
      return '<option value="'+c+'"'+(curCtype===c?' selected':'')+'>'+c+'</option>'; }).join('');

    var f = mine.filter(function(e){
      if(curMonth && String(e.date||'').slice(0,7)!==curMonth) return false;
      if(curCtype && e.ctype!==curCtype) return false;
      return hit(e,curQ); });
    var list = byDate(f);

    /* 요약 — 연비는 연속된 주유 2건의 주행거리 차 / 나중 주유량 */
    var tot=0; f.forEach(function(e){ tot+=money(e); });
    var fuels = mine.filter(function(e){ return e.ctype==='주유' && num(e.odo)>0; })
      .sort(function(a,b){ return num(a.odo)-num(b.odo); });
    var kpl=[], lastKpl=null;
    for(var i=1;i<fuels.length;i++){
      var dist = num(fuels[i].odo)-num(fuels[i-1].odo), L = num(fuels[i].liter);
      if(dist>0 && dist<3000 && L>0){ var v=dist/L; kpl.push(v); lastKpl=v; }
    }
    var avg = kpl.length ? (kpl.reduce(function(a,b){return a+b;},0)/kpl.length) : null;
    var odoMax = 0; mine.forEach(function(e){ if(num(e.odo)>odoMax) odoMax=num(e.odo); });
    var nFuel = f.filter(function(e){ return e.ctype==='주유'; }).length;
    var totL = 0; f.forEach(function(e){ if(e.ctype==='주유') totL+=num(e.liter); });

    var sum='<div class="lf-sum">'
      + sBox('총지출', won(tot)+'원', (curMonth? curMonth.replace('-','년 ')+'월':'전체')+(curCtype? ' · '+curCtype:''))
      + sBox('주유', nFuel+'회', totL? won(Math.round(totL*10)/10)+'L':'')
      + sBox('평균 연비', avg? (Math.round(avg*10)/10)+' km/L':'—', kpl.length? '주유 '+(kpl.length+1)+'회 기준':'주유 2회부터 계산')
      + sBox('최근 연비', lastKpl? (Math.round(lastKpl*10)/10)+' km/L':'—', odoMax? '현재 '+won(odoMax)+'km':'')
      + '</div>';

    /* 다음 정비 · 검사 알림 */
    var alerts=[];
    mine.forEach(function(e){
      if(e.nextodo && odoMax && num(e.nextodo)-odoMax <= 2000)
        alerts.push('🔧 '+(e.title||'정비')+' — '+won(num(e.nextodo)-odoMax)+'km 남음');
      if(e.end){ var d2=dday(e.end); if(d2!==null && d2<=45)
        alerts.push((e.ctype==='보험'?'🛡 ':'📋 ')+(e.title||e.ctype)+' — '+(d2<0?(-d2)+'일 지남':'D-'+d2)); }
    });
    var abox = alerts.length ? '<div style="background:#fff7e6;border:1.5px solid #fcd34d;border-radius:11px;'
      + 'padding:10px 14px;margin-bottom:12px;font-size:13px;font-weight:700;color:#92400e">'
      + alerts.slice(0,4).map(function(a){ return esc(a); }).join('<br>') + '</div>' : '';

    return '<div class="lf-chips">'+chips+'</div>' + sum + abox
      + '<div class="lf-bar">'
      +   '<input type="text" id="lfQ" class="lf-in" placeholder="🔍 검색" value="'+esc(curQ)+'" style="width:200px;max-width:100%">'
      +   '<select id="lfMonth" class="lf-in">'+mopt+'</select>'
      +   '<select id="lfCtype" class="lf-in">'+copt+'</select>'
      +   '<div class="lf-sp"></div>'
      +   '<button type="button" id="lfAddCar" class="lf-add">➕ 차계부 추가</button>'
      + '</div>'
      + gridHTML(list, '🚗', curCar? ('"'+esc(curCar)+'" 기록이 없어요'):'차량을 먼저 등록하세요');
  }

  /* ══════ ③ 연락처 탭 ══════ */
  function viewCt(){
    var all = contacts();
    var cnt={}; all.forEach(function(c){ cnt[c.cat]=(cnt[c.cat]||0)+1; });
    var chips = '<div class="lf-chip'+(curCat==='전체'?' on':'')+'" data-lc="전체"'
      + (curCat==='전체'?' style="background:#2563a8"':'') + '>전체 <b>'+all.length+'</b></div>';
    ctCats().forEach(function(k){
      var n=cnt[k]||0, on=curCat===k, c=ctColor(k);
      chips += '<div class="lf-chip'+(on?' on':'')+(n?'':' dim')+'" data-lc="'+esc(k)+'"'
        + (on?' style="background:'+c+'"':'') + '>'+esc(k)+(n?' <b>'+n+'</b>':'')+'</div>';
    });
    chips += '<div class="lf-chip" data-lctmgr="1" style="border-style:dashed">⚙️ 분류 관리</div>';
    chips += '<div class="lf-chip" data-lctauto="1" style="border-style:dashed">'
      + (autoCtOn()?'\u2611\ufe0f':'\u2b1c') + ' \uba85\ud568 \uc790\ub3d9 \uc800\uc7a5</div>';

    var list = all.filter(function(c){
      if(curCat!=='전체' && c.cat!==curCat) return false;
      return hit(c,curQ); }).sort(function(a,b){ return String(a.name||'').localeCompare(String(b.name||''),'ko'); });

    var bday = all.map(function(c){ if(!c.birth) return null;
        var md=String(c.birth).slice(5), y=today().slice(0,4), d2=dday(y+'-'+md);
        if(d2!==null && d2<0) d2=dday((parseInt(y,10)+1)+'-'+md);
        return d2===null?null:{c:c,d:d2}; }).filter(Boolean).sort(function(a,b){ return a.d-b.d; })[0];

    var sum='<div class="lf-sum">'
      + sBox('연락처', all.length+'명', '업무 연락처와 따로 저장돼요')
      + sBox('분류', ctCats().length+'개', ctCats().slice(0,4).join(' · '))
      + sBox('전화번호 있음', all.filter(function(c){ return c.phone; }).length+'명','')
      + sBox('다가오는 기념일', bday? bday.c.name : '—', bday? (bday.d===0?'오늘!':'D-'+bday.d)+' · '+bday.c.birth : '생일을 넣어보세요')
      + '</div>';

    var cards = list.length ? '<div class="lf-grid">' + list.map(function(c){
      var pc=String(c.phone||'').replace(/[^0-9+]/g,'');
      var mu=c.addr? 'https://map.naver.com/p/search/'+encodeURIComponent(c.addr) : '';
      return '<div class="lf-ct" data-lct="'+esc(c.id)+'" style="border-left-color:'+ctColor(c.cat)+'">'
        + '<button class="lf-del" data-lctdel="'+esc(c.id)+'">🗑</button>'
        + '<div class="n">'+esc(c.name||'(이름없음)')+(c.person?'<span class="p">'+esc(c.person)+'</span>':'')
        + ' <span class="lf-tag" style="background:'+ctColor(c.cat)+'1f;color:'+ctColor(c.cat)+'">'+esc(c.cat||'기타')+'</span></div>'
        + (c.phone? '<a href="tel:'+esc(pc)+'">📞 '+esc(c.phone)+'</a>':'')
        + (c.phone2?'<a href="tel:'+esc(String(c.phone2).replace(/[^0-9+]/g,''))+'">📠 '+esc(c.phone2)+'</a>':'')
        + (c.addr? '<a href="'+esc(mu)+'" target="_blank">📍 '+esc(c.addr)+'</a>':'')
        + (c.birth?'<a style="color:#db2777">🎂 '+esc(c.birth)+'</a>':'')
        + (c.memo? '<div class="mm">'+esc(c.memo)+'</div>':'')
        + (c.fromCard? '<div style="font-size:11px;color:#a8b8c8;margin-top:4px">\ud83d\udcbc \uba85\ud568\uc5d0\uc11c \uc790\ub3d9 \uc800\uc7a5</div>':'')
        + '<div class="acts"><button data-lctedit="'+esc(c.id)+'">✏️ 수정</button>'
        + (c.phone? '<button data-lctcall="'+esc(pc)+'">📞 전화</button>':'') + '</div>'
        + '</div>'; }).join('') + '</div>'
      : '<div class="lf-grid"><div class="lf-empty"><div class="ei">📞</div>'
        + (curQ?'검색 결과가 없어요':'개인 연락처가 없어요<div style="font-size:12px;margin-top:6px">가족·친구·단골집 번호를 모아두세요</div>')+'</div></div>';

    return sum + '<div class="lf-chips">'+chips+'</div>'
      + '<div class="lf-bar">'
      +   '<input type="text" id="lfQ" class="lf-in" placeholder="🔍 이름·번호·주소" value="'+esc(curQ)+'" style="width:260px;max-width:100%">'
      +   '<div class="lf-sp"></div>'
      +   '<button type="button" id="lfAddCt" class="lf-add">➕ 연락처 추가</button>'
      + '</div>' + cards;
  }

  /* ══════ ④ 결산 탭 ══════ */
  function viewSum(){
    var all = recs();
    var y = curMonth ? curMonth.slice(0,4) : today().slice(0,4);
    var years={}; all.forEach(function(e){ var yy=String(e.date||'').slice(0,4); if(yy) years[yy]=1; });
    if(!years[y]) years[y]=1;
    var yopt = Object.keys(years).sort().reverse().map(function(v){
      return '<option value="'+v+'"'+(v===y?' selected':'')+'>'+v+'년</option>'; }).join('');

    var mine = all.filter(function(e){ return String(e.date||'').slice(0,4)===y; });
    var byCat={}, byMon={}, tot=0;
    mine.forEach(function(e){
      var m=money(e); if(!m) return;
      var key = e.ptype==='car' ? 'car' : e.ptype;
      byCat[key]=(byCat[key]||0)+m;
      var mo=String(e.date).slice(5,7); byMon[mo]=(byMon[mo]||0)+m;
      tot+=m;
    });
    /* v229 🔴 여기서 var cats 라고 이름을 지어 버려서, 같은 함수 안의
       cats() (분류표를 주는 함수) 가 통째로 가려졌다 → 「cats is not a function」.
       📊 결산 단추가 안 눌리던 진짜 원인. 이름만 바꾼다. */
    var catKeys = Object.keys(byCat).sort(function(a,b){ return byCat[b]-byCat[a]; });
    var mx = catKeys.length? byCat[catKeys[0]] : 1;

    var rowsC = catKeys.map(function(k){
      var d = k==='car'? {i:'🚗',n:'차계부',c:'#0891b2'} : (cats()[k]||catEtc());
      var v=byCat[k], p=Math.round(v/tot*100);
      return '<tr><td style="white-space:nowrap">'+d.i+' '+d.n+'</td>'
        + '<td><div class="lf-bar2"><i style="width:'+Math.round(v/mx*100)+'%;background:'+d.c+'"></i></div></td>'
        + '<td class="r" style="white-space:nowrap">'+won(v)+'원</td>'
        + '<td class="r" style="color:#8ba0b6">'+p+'%</td></tr>'; }).join('');

    var mxM = 1; Object.keys(byMon).forEach(function(m){ if(byMon[m]>mxM) mxM=byMon[m]; });
    var rowsM='';
    for(var i=1;i<=12;i++){
      var mm=String(i).padStart(2,'0'), v=byMon[mm]||0;
      rowsM += '<tr><td style="white-space:nowrap">'+i+'월</td>'
        + '<td><div class="lf-bar2"><i style="width:'+Math.round(v/mxM*100)+'%;background:#2563a8"></i></div></td>'
        + '<td class="r" style="white-space:nowrap'+(v?'':';color:#c8d4e0')+'">'+(v?won(v)+'원':'—')+'</td></tr>';
    }

    var carSpend = mine.filter(function(e){ return e.ptype==='car'; }).reduce(function(a,e){ return a+money(e); },0);
    var foodN = mine.filter(function(e){ return e.ptype==='food'; }).length;
    var avgM = tot? Math.round(tot/12) : 0;

    return '<div class="lf-sum">'
      + sBox(y+'년 총지출', won(tot)+'원', mine.length+'건 기록')
      + sBox('월 평균', won(avgM)+'원','')
      + sBox('차량 지출', won(carSpend)+'원', tot? Math.round(carSpend/tot*100)+'%':'')
      + sBox('외식', foodN+'회', '')
      + '</div>'
      + '<div class="lf-bar"><select id="lfYear" class="lf-in">'+yopt+'</select>'
      + '<span style="font-size:12px;color:#8ba0b6">기록에 금액을 넣은 것만 합산돼요</span></div>'
      + '<div style="display:grid;gap:14px;grid-template-columns:1fr">'
      + '<div><div style="font-size:13px;font-weight:900;color:#33567d;margin-bottom:7px">📊 카테고리별</div>'
      + '<table class="lf-tbl">'+(rowsC||'<tr><td colspan="4" style="text-align:center;color:#a8b8c8;padding:26px">금액이 들어간 기록이 없어요</td></tr>')+'</table></div>'
      + '<div><div style="font-size:13px;font-weight:900;color:#33567d;margin-bottom:7px">📅 월별</div>'
      + '<table class="lf-tbl">'+rowsM+'</table></div>'
      + '</div>';
  }

  /* ══════ 입력 서식 엔진 ══════ */
  function fieldHTML(f, v){
    if(f.s) return '<div class="lf-sec">'+f.s+'</div>';
    var w = f.w==='full' ? ' full' : (f.w==='half' ? ' half' : '');
    var val = v[f.k]==null ? '' : String(v[f.k]);
    var id = 'lf-'+f.k, inner='';

    if(f.t==='sel'){
      var opts = f.o||[];
      if(f.car)  opts = cars().map(function(c){ return c.n; });
      if(f.ctc)  opts = ctCats();
      inner = '<select id="'+id+'"'+(f.reload?' data-lreload="1"':'')+'>'
        + opts.map(function(o){ return '<option value="'+esc(o)+'"'+(val===String(o)?' selected':'')+'>'+esc(o||'선택')+'</option>'; }).join('')
        + '</select>';
    }
    else if(f.t==='area'){
      inner = '<textarea id="'+id+'" placeholder="'+esc(f.p||'')+'">'+esc(val)+'</textarea>';
    }
    else if(f.t==='star'){
      inner = '<div class="lf-star" id="lf-star">'+[1,2,3,4,5].map(function(i){
        return '<span data-st="'+i+'">'+(i<=(parseInt(val,10)||0)?'★':'☆')+'</span>'; }).join('')
        + '</div><input type="hidden" id="'+id+'" value="'+(parseInt(val,10)||0)+'">';
    }
    else if(f.t==='map'){
      inner = '<div class="lf-with"><input type="text" id="'+id+'" value="'+esc(val)+'" placeholder="'+esc(f.p||'도로명 주소')+'">'
        + '<button type="button" class="lf-ib n" data-lmap="'+id+'" title="네이버 지도">N</button></div>';
    }
    else if(f.t==='tel'){
      inner = '<div class="lf-with"><input type="tel" id="'+id+'" value="'+esc(val)+'" placeholder="'+esc(f.p||'010-0000-0000')+'">'
        + '<button type="button" class="lf-ib t" data-ltel="'+id+'" title="전화 걸기">📞</button></div>';
    }
    else if(f.t==='calc'){
      inner = '<input type="text" id="'+id+'" readonly value="">';
    }
    else if(f.t==='check'){
      inner = '<label style="display:flex;align-items:center;height:40px;gap:8px;cursor:pointer;font-size:13.5px;color:#33567d">'
        + '<input type="checkbox" id="'+id+'" style="width:18px;height:18px"'+(val&&val!=='false'?' checked':'')+'> 예</label>';
    }
    else if(f.t==='link'){
      inner = '<div class="lf-with"><input type="url" id="'+id+'" value="'+esc(val)+'" placeholder="'+esc(f.p||'https://...')+'">'
        + '<button type="button" class="lf-ib" style="flex:0 0 auto;padding:0 13px;background:#7c3aed;white-space:nowrap;font-size:12.5px" data-lai="'+id+'">🤖 링크 분석</button>'
        + (val? '<button type="button" class="lf-ib" style="flex:0 0 42px;background:#64748b" data-lopen="'+id+'" title="열기">↗</button>':'')
        + '</div><div id="lfAiNote" style="font-size:11.5px;color:#8ba0b6;margin-top:3px"></div>';
    }
    else if(f.t==='rate'){
      inner = '<div class="lf-with"><input type="number" id="'+id+'" value="'+esc(val)+'" placeholder="예: 1380" data-llink="buy">'
        + '<button type="button" class="lf-ib" style="flex:0 0 auto;padding:0 12px;background:#0891b2;white-space:nowrap;font-size:12px" data-lfx="1">📡 그날 환율</button>'
        + '</div><div id="lfFxNote" style="font-size:11.5px;color:#8ba0b6;margin-top:3px"></div>';
    }
    else if(f.t==='rows'){
      return '<div class="lf-rows" data-lrows="'+f.k+'"><label>'+f.l+' <span style="color:#a8b8c8;font-weight:600">(＋로 추가)</span></label>'
        + '<div id="lfrow-'+f.k+'"></div>'
        + '<button type="button" class="lf-radd" data-lradd="'+f.k+'">＋ 추가</button>'
        + (f.sum? '<div class="lf-rtot" id="lftot-'+f.k+'"></div>':'') + '</div>';
    }
    else if(f.t==='multi'){
      var mo=f.o||[], msel=Array.isArray(val)?val:(val?String(val).split(','):[]);
      inner = '<div class="lf-multi lf-multi-f" id="'+id+'-box" data-for="'+id+'">'
        + mo.map(function(x){
            var on=msel.indexOf(x)>=0, c=colorOf((f.colors||{})[x]||'gray');
            return '<span class="lf-mt'+(on?' on':'')+'" data-mv="'+esc(x)+'"'
              + (on?' style="background:'+c.bg+';color:'+c.fg+'"':'')+'>'+esc(x)+'</span>'; }).join('')
        + '</div><input type="hidden" id="'+id+'" value="'+esc(msel.join(','))+'">';
    }
    else if(f.t==='rollup'){
      inner = '<input type="text" id="'+id+'" readonly value="" data-ru="1"'
        + ' style="background:#ecfeff;color:#0891b2;font-weight:800">';
    }
    else if(f.t==='time'){
      inner = '<div class="lf-with"><input type="text" id="'+id+'" readonly value="'+esc(val)+'"'
        + ' placeholder="시간 선택" data-tdial="'+id+'" style="cursor:pointer;background:#f9fcff">'
        + '<button type="button" class="lf-ib" style="background:#6366f1" data-tdial="'+id+'" title="시계로 맞추기">🕐</button></div>';
    }
    else if(f.t==='rel'){
      var rp={target:f.target||f.tg||'pcontact'};
      var rids=(Array.isArray(val)?val:(val?[val]:[]));
      var tgs=relTargets(rp);
      inner = '<select id="'+id+'"><option value="">— 없음 —</option>'
        + tgs.map(function(o){ return '<option value="'+esc(o.id)+'"'+(rids.indexOf(o.id)>=0?' selected':'')
            +'>'+esc(o.label)+'</option>'; }).join('') + '</select>';
    }
    else if(f.t==='formula'){
      inner = '<input type="text" id="'+id+'" readonly value="" data-fx="'+esc(f.expr||'')+'"'
        + (f.unit? ' data-unit="'+esc(f.unit)+'"':'')
        + ' style="background:#f6f2ff;color:#7c3aed;font-weight:800">';
    }
    else {
      var isNum = (f.t==='num'||f.t==='number');
      var ty = isNum?'text':(f.t==='date'?'date':(f.t==='time'?'time':'text'));
      var ph = f.p||'';
      if(f.last && v._lastodo) ph = '직전 '+numFmt(v._lastodo)+'km';
      inner = '<input type="'+ty+'" id="'+id+'" value="'+esc(isNum?numFmt(val):val)+'" placeholder="'+esc(ph)+'"'
        + (isNum?' data-num="1" inputmode="decimal"':'')
        + (f.t==='time'?' step="300"':'') + (f.link?' data-llink="'+f.link+'"':'') + '>';
    }
    return '<div class="lf-f'+w+'"><label>'+esc(f.l)+(f.req?' <i>*</i>':'')+'</label>'+inner+'</div>';
  }

  /* 반복행 */
  var ROWS = {};
  function rowsRender(f){
    var host = document.getElementById('lfrow-'+f.k); if(!host) return;
    var arr = ROWS[f.k] || [];
    host.innerHTML = arr.map(function(r,i){
      return '<div class="lf-row" data-ri="'+i+'">' + f.cols.map(function(c){
        var v = r[c.k]==null?'':String(r[c.k]);
        if(c.sel) return '<select data-rk="'+c.k+'" style="flex:0 0 '+(c.w||'110px')+'">'
          + c.sel.map(function(o){ return '<option'+(v===o?' selected':'')+'>'+esc(o)+'</option>'; }).join('') + '</select>';
        return '<input type="text" data-rk="'+c.k+'"'+(c.n?' data-num="1" inputmode="decimal"':'')
          + ' value="'+esc(c.n?numFmt(v):v)+'" placeholder="'+esc(c.p||'')+'"'
          + (c.w?' style="flex:0 0 '+c.w+'"':'') + '>';
      }).join('') + '<button type="button" class="lf-rx" data-rdel="'+i+'">✕</button></div>';
    }).join('');
    bindNumsIn(host);
    rowsTotal(f);
    if(f.k==='items' && document.getElementById('lf-cur')) calcBuy();
  }
  /* 화면의 행을 그대로 담는다 — 빈 행도 유지 (추가 중에 사라지면 안 됨) */
  function rowsCollect(f){
    var host=document.getElementById('lfrow-'+f.k); if(!host) return;
    var out=[];
    host.querySelectorAll('.lf-row').forEach(function(row){
      var o={};
      row.querySelectorAll('[data-rk]').forEach(function(el){
        o[el.getAttribute('data-rk')] = (el.getAttribute('data-num')==='1') ? numRaw(el.value) : el.value; });
      out.push(o);
    });
    ROWS[f.k]=out;
  }
  /* 저장할 때만 빈 행을 버린다 */
  function rowsClean(arr){
    return esr(arr).filter(function(o){
      var any=false;
      Object.keys(o).forEach(function(k){
        var v=String(o[k]==null?'':o[k]).trim();
        if(v && !/^(맛평가|선택)$/.test(v)) any=true; });
      return any;
    });
  }
  function rowsTotal(f){
    if(!f.sum) return;
    var el=document.getElementById('lftot-'+f.k); if(!el) return;
    var t=0, host=document.getElementById('lfrow-'+f.k);
    if(host) host.querySelectorAll('.lf-row').forEach(function(row){
      var i=row.querySelector('[data-rk="'+f.sum+'"]'); if(i) t+=num(numRaw(i.value)); });
    el.textContent = t? '합계 '+numFmt(t)+'원' : '';
    if(f.to){ var tg=document.getElementById('lf-'+f.to); if(tg && t && !tg._touched) tg.value=numFmt(t); }
  }

  /* ── 통화 기호 ── */
  var CURSYM={'원':'\u20a9','달러':'$','엔':'\u00a5','유로':'\u20ac'};
  var CURCODE={'달러':'USD','엔':'JPY','유로':'EUR'};

  /* 구매 합계 (원화) */
  function calcBuy(){
    var C=document.getElementById('lf-cur'); if(!C) return;
    var cur=C.value||'원', foreign=(cur!=='원');
    var gv=function(id){ var e=document.getElementById(id); return e? numRaw(e.value) : ''; };
    var unit=num(gv('lf-unit')),
        qty =num(gv('lf-qty'))||1,
        ship=num(gv('lf-ship')),
        inc =((document.getElementById('lf-shipinc')||{}).value||'').indexOf('포함')>=0,
        rate=num(gv('lf-rate'));
    /* 품목 목록이 2건 이상이면 장바구니로 보고 그 합계를 쓴다 */
    var rowsT=0, rowsN=0, hostI=document.getElementById('lfrow-items');
    if(hostI) hostI.querySelectorAll('.lf-row').forEach(function(r){
      var pe=r.querySelector('[data-rk="price"]'), qe=r.querySelector('[data-rk="qty"]');
      var pv=num(pe&&numRaw(pe.value)), qv=num(qe&&numRaw(qe.value))||1;
      if(pv>0){ rowsT+=pv*qv; rowsN++; } });
    var base = (rowsN>=2) ? rowsT : unit*qty;
    var sub = base + (inc?0:ship);
    var krw = foreign ? Math.round(sub*(rate||0)) : Math.round(sub);
    var out=document.getElementById('lf-amount');
    if(out){
      out.value = foreign
        ? ((rate? numFmt(krw)+'\uc6d0' : '\ud658\uc728\uc744 \ub123\uc73c\uc138\uc694')
           + '   ('+(CURSYM[cur]||'')+ (Math.round(sub*100)/100).toLocaleString('en-US') +')')
        : (sub? numFmt(krw)+'\uc6d0' : '');
      out.dataset.krw = krw;
      var lb2=out.closest('.lf-f'); lb2=lb2&&lb2.querySelector('label');
      if(lb2) lb2.textContent = '\ud569\uacc4 (\uc6d0)' + (rowsN>=2? '  \u00b7 \ud488\ubaa9 \ubaa9\ub85d '+rowsN+'\uac74 \uae30\uc900':'');
    }
    /* 환율칸은 외화일 때만 */
    var rf=document.getElementById('lf-rate');
    if(rf){ var box=rf.closest('.lf-f'); if(box) box.style.display = foreign? '' : 'none';
      var lb=box&&box.querySelector('label'); if(lb) lb.textContent='\ud658\uc728 (1'+(CURSYM[cur]||'')+' = ? \uc6d0)'; }
  }

  /* 그날 환율 (Frankfurter — 키 불필요) */
  function fetchFx(){
    var C=document.getElementById('lf-cur'), N=document.getElementById('lfFxNote');
    var code=CURCODE[(C&&C.value)||'']; if(!code){ if(N) N.textContent='\uc6d0\ud654\ub294 \ud658\uc728\uc774 \ud544\uc694 \uc5c6\uc5b4\uc694'; return; }
    var d=((document.getElementById('lf-date')||{}).value)||today();
    if(N){ N.textContent='\ud658\uc728 \ubd88\ub7ec\uc624\ub294 \uc911...'; N.style.color='#8ba0b6'; }
    fetch('https://api.frankfurter.dev/v1/'+d+'?base='+code+'&symbols=KRW')
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(j){
        var v=j&&j.rates&&j.rates.KRW; if(!v) throw new Error('\ud658\uc728 \uc5c6\uc74c');
        var R=document.getElementById('lf-rate'); if(R){ R.value=Math.round(v*100)/100; calcBuy(); }
        if(N){ N.textContent='\u2705 '+(j.date||d)+' \uae30\uc900 1'+(CURSYM[C.value]||'')+' = '+won(Math.round(v))+'\uc6d0 (ECB)'; N.style.color='#16a34a'; }
      })
      .catch(function(e){ if(N){ N.textContent='\u26a0\ufe0f \uc790\ub3d9 \uc2e4\ud328 \u2014 \uc9c1\uc811 \ub123\uc5b4\uc8fc\uc138\uc694 ('+e.message+')'; N.style.color='#dc2626'; } });
  }

  var MODPT='';                      /* 지금 열려 있는 모달의 종류 */
  /* 모달 안 수식 칸 — 입력할 때마다 다시 계산 */
  function fxCalc(){
    var box=document.getElementById('lfFields'); if(!box) return;
    var fx=box.querySelectorAll('[data-fx]'); if(!fx.length) return;
    /* 지금 화면의 값으로 임시 기록을 만들어 계산 */
    var tmp={}, pr={};
    box.querySelectorAll('[id^="lf-"]').forEach(function(el){
      var k=el.id.slice(3); if(!k) return;
      var val = (el.type==='checkbox') ? el.checked
              : (el.getAttribute('data-num')==='1' ? numRaw(el.value) : el.value);
      if(k.slice(0,3)==='P__') pr[k.slice(3)]=val; else tmp[k]=val;
    });
    tmp.props=pr;
    tmp.ptype = MODPT;
    tmp.date=tmp.date||''; tmp.title=tmp.title||''; tmp.detail=tmp.detail||'';
    if(tmp.amount==null) tmp.amount='';
    fx.forEach(function(el){
      var r=formulaCalc(tmp, el.getAttribute('data-fx'), MODPT);
      el.value = (r===''? '—' : (numFmt(r) + (el.getAttribute('data-unit')? (' '+el.getAttribute('data-unit')):'')));
    });
  }

  /* 자동 계산 — 주유 3칸 / 독서 진행률 / 구매 합계 */
  function autoCalc(){
    try{ fxCalc(); }catch(e){}
    if(document.getElementById('lf-cur')) calcBuy();
    var A=document.getElementById('lf-amount'), L=document.getElementById('lf-liter'), U=document.getElementById('lf-unit');
    if(A&&L&&U && !document.getElementById('lf-cur')){
      var a=num(numRaw(A.value)), l=num(numRaw(L.value)), u=num(numRaw(U.value));
      if(a&&l&&!u) U.value=numFmt(Math.round(a/l));
      else if(l&&u&&!a) A.value=numFmt(Math.round(l*u));
      else if(a&&u&&!l) L.value=numFmt(Math.round(a/u*100)/100);
    }
    var P=document.getElementById('lf-prog'), T=document.getElementById('lf-totalpg'), R=document.getElementById('lf-readpg');
    if(P&&T&&R){ var t=num(numRaw(T.value)), r=num(numRaw(R.value));
      P.value = t? (Math.min(100,Math.round(r/t*100))+'%  ('+numFmt(r)+' / '+numFmt(t)+'쪽)') : ''; }
  }

  /* 사진 압축 */
  function shrink(file){
    return new Promise(function(res){
      var fr=new FileReader();
      fr.onload=function(){
        var img=new Image();
        img.onload=function(){
          var mx=1100, w=img.width, h=img.height;
          if(w>mx||h>mx){ var r=Math.min(mx/w,mx/h); w=Math.round(w*r); h=Math.round(h*r); }
          var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
          cv.getContext('2d').drawImage(img,0,0,w,h);
          res(cv.toDataURL('image/jpeg',0.72));
        };
        img.onerror=function(){ res(null); };
        img.src=fr.result;
      };
      fr.onerror=function(){ res(null); };
      fr.readAsDataURL(file);
    });
  }


  /* ══════════════════════════════════════════════
     🤖 인터넷몰 링크 → AI 분석 → 구매 칸 자동 채움
     ────────────────────────────────────────────── */
  var AI_KEY_LS2='wl_anthropic_key', AI_MODEL2='claude-sonnet-4-6';
  function aiKey(){ try{ return localStorage.getItem(AI_KEY_LS2)||''; }catch(e){ return ''; } }

  /* 쇼핑몰 페이지 본문 가져오기 — 브라우저는 CORS 때문에 직접 못 읽는다.
     텍스트 추출 중계(r.jina.ai)를 쓰고, 막히면 붙여넣기로 넘어간다. */
  /* 막힘·오류 페이지인지 가려낸다 — 이걸 AI 에 넘기면 엉뚱한 값이 들어온다 */
  var BLOCK_RE = /(403\s*forbidden|access\s*denied|접근\s*(?:이\s*)?(?:불가|거부|제한)|권한이\s*없|잘못된\s*접근|error\s*40[0-9]|502\s*bad\s*gateway|서비스\s*점검|잠시\s*후\s*다시|비정상적인\s*접근|자동화된?\s*(?:요청|접근)|are you (?:a )?human|captcha|robot check|cloudflare|請稍候|just a moment)/i;
  function looksBlocked(t){
    var s=String(t||'');
    if(s.length<400) return true;                          /* 내용이 거의 없다 */
    var head=s.slice(0,1500);
    if(BLOCK_RE.test(head)) return true;
    /* 한글·상품스러운 단서가 하나도 없으면 의심 */
    if(!/[0-9]{3,}/.test(s)) return true;
    return false;
  }
  function fetchPage(url){
    var tries=[
      'https://r.jina.ai/'+url,
      'https://api.allorigins.win/raw?url='+encodeURIComponent(url)
    ];
    var i=0, lastWhy='';
    function next(){
      if(i>=tries.length) return Promise.reject(new Error(lastWhy||'페이지를 못 읽었어요'));
      var u=tries[i++];
      return fetch(u).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
        .then(function(t){
          if(looksBlocked(t)) throw new Error('쇼핑몰이 자동 읽기를 막았어요');
          return t;
        })
        .catch(function(e){ lastWhy=e.message||''; return next(); });
    }
    return next();
  }

  function aiParse(text, url){
    var key=aiKey();
    if(!key) return Promise.reject(new Error('AI 키가 없어요 — 🤖 AI 탭에서 API 키를 먼저 저장하세요'));
    var body=String(text||'').slice(0, 24000);
    var sys='너는 쇼핑몰 상품 페이지를 읽고 구매 기록을 만드는 도우미다. '
      + '아래 내용에서 정보를 뽑아 JSON 만 출력해라. 설명·마크다운·코드펜스 금지.\n'
      + '★ 가장 중요한 규칙 ★\n'
      + '· 내용이 오류·차단·로그인·로봇확인 페이지이거나 상품 정보가 없으면 '
      + '  반드시 {"error":"이유"} 만 출력해라. 다른 칸은 절대 넣지 마라.\n'
      + '· 확인되지 않은 값은 절대 지어내지 마라. 모르면 빈 문자열 "" 또는 0.\n'
      + '· 오류 설명을 title 이나 detail 에 적지 마라.\n\n'
      + '정상일 때 형식:\n'
      + '{"title":"대표 품목명","brand":"브랜드","where":"쇼핑몰 이름","cur":"원|달러|엔|유로",'
      + '"unit":숫자(단가, 통화기호·쉼표 없이),"qty":숫자,"ship":숫자(배송비, 모르면 0),'
      + '"items":[{"name":"품목명","qty":숫자,"price":숫자,"note":"옵션"}],"detail":"한 줄 요약"}\n'
      + '· 장바구니·주문내역처럼 여러 품목이면 items 에 모두 넣고 title 은 "OO 외 N건" 으로.\n'
      + '· 상품이 하나면 items 에도 그 하나를 넣어라.\n'
      + '· 가격은 할인 적용된 최종 판매가를 써라.';
    return fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,
        'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({ model:AI_MODEL2, max_tokens:1600, system:sys,
        messages:[{role:'user',content:(url?('URL: '+url+'\n\n'):'')+'[페이지 내용]\n'+body}] })
    }).then(function(r){
      if(!r.ok) return r.json().catch(function(){return null;}).then(function(j){
        throw new Error((j&&j.error&&j.error.message)||('HTTP '+r.status)); });
      return r.json();
    }).then(function(d){
      var t=(d.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('').trim();
      t=t.replace(/^```(json)?/i,'').replace(/```$/,'').trim();
      var m=t.match(/\{[\s\S]*\}/); if(m) t=m[0];
      return JSON.parse(t);
    });
  }

  /* 결과를 빈 칸에만 채운다 (기존 입력 덮어쓰기 금지) */
  function applyAI(o){
    if(!o || typeof o!=='object') throw new Error('AI 응답을 못 읽었어요');
    if(o.error) throw new Error(String(o.error).slice(0,80));
    /* 품목명도 값도 없으면 실패로 본다 — 빈 껍데기를 채우지 않는다 */
    var hasAny = String(o.title||'').trim() || num(o.unit) || (Array.isArray(o.items)&&o.items.length);
    if(!hasAny) throw new Error('상품 정보를 찾지 못했어요');
    /* 오류 문구가 섞여 들어온 경우 버린다 */
    if(BLOCK_RE.test(String(o.title||'')+' '+String(o.detail||'')))
      throw new Error('쇼핑몰이 자동 읽기를 막았어요');
    var set=function(id,v){ var e=document.getElementById(id);
      if(e && v!=='' && v!=null && !String(e.value||'').trim()) e.value=v; };
    set('lf-title', o.title||''); set('lf-brand', o.brand||''); set('lf-where', o.where||'');
    if(o.cur){ var C=document.getElementById('lf-cur');
      if(C && ['원','달러','엔','유로'].indexOf(o.cur)>=0 && C.value==='원') C.value=o.cur; }
    if(num(o.unit)) set('lf-unit', numFmt(num(o.unit)));
    if(num(o.qty))  set('lf-qty',  numFmt(num(o.qty)));
    if(num(o.ship)) set('lf-ship', numFmt(num(o.ship)));
    set('lf-detail', o.detail||'');
    var its=Array.isArray(o.items)?o.items:[];
    if(its.length){
      ROWS['items']=(ROWS['items']||[]).filter(function(r){
        return String(r.name||'').trim(); });
      its.forEach(function(it){ ROWS['items'].push({
        name:String(it.name||''), qty:it.qty||'', price:it.price||'', note:String(it.note||'') }); });
      var fd=null; (CAT_P.buy.f).forEach(function(f){ if(f.k==='items') fd=f; });
      if(fd) rowsRender(fd);
      /* 단가가 비어 있고 품목이 하나면 그 값을 올려준다 */
      if(its.length===1 && !num((document.getElementById('lf-unit')||{}).value)){
        var U=document.getElementById('lf-unit'); if(U && num(its[0].price)) U.value=num(its[0].price);
      }
    }
    calcBuy();
  }

  /* 링크 분석 버튼 동작 */
  function runLinkAI(inputId){
    var el=document.getElementById(inputId), note=document.getElementById('lfAiNote');
    var url=(el&&el.value||'').trim();
    function say(t,c){ if(note){ note.textContent=t; note.style.color=c||'#8ba0b6'; } }
    if(!aiKey()){ say('⚠️ AI 키가 없어요 — 🤖 AI 탭에서 API 키를 저장한 뒤 다시 눌러주세요','#dc2626'); return; }
    if(!/^https?:\/\//i.test(url)){ pasteFallback(''); return; }
    say('🔎 페이지 읽는 중…');
    fetchPage(url)
      .then(function(txt){ say('🤖 AI 가 정리하는 중…'); return aiParse(txt, url); })
      .then(function(o){ applyAI(o); say('✅ 자동으로 채웠어요 — 틀린 곳은 고쳐주세요','#16a34a'); })
      .catch(function(e){
        say('⚠️ '+e.message+' — 아무것도 넣지 않았어요. 페이지 내용을 붙여넣어 주세요','#dc2626');
        pasteFallback(url);
      });
  }

  /* 자동으로 못 읽을 때: 페이지 복사 → 붙여넣기 */
  function pasteFallback(url){
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.style.zIndex='9700';
    ov.innerHTML='<div class="lf-mod" style="max-width:640px">'
      + '<div class="lf-mh"><b>📋 상품 페이지 붙여넣기</b>'
      +   '<button type="button" id="lfPX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div style="font-size:12.5px;color:#7a92a8;line-height:1.6;margin-bottom:10px">'
      +   '쇼핑몰이 자동 읽기를 막는 경우가 많아요.<br>'
      +   '상품 페이지에서 <b>Ctrl+A → Ctrl+C</b> 로 전체 복사한 뒤 아래에 붙여넣고 [분석] 을 누르세요.</div>'
      + '<textarea id="lfPasteBox" style="width:100%;box-sizing:border-box;min-height:190px;padding:11px;'
      +   'border:1.5px solid #dbe6f4;border-radius:10px;font-size:13px;font-family:inherit;line-height:1.5" '
      +   'placeholder="여기에 붙여넣기 (Ctrl+V)"></textarea>'
      + '<div id="lfPasteNote" style="font-size:12px;color:#8ba0b6;margin-top:7px"></div>'
      + '<div class="lf-mbtn"><div style="flex:1"></div>'
      +   '<button type="button" id="lfPCancel" style="height:44px;padding:0 18px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">취소</button>'
      +   '<button type="button" id="lfPGo" style="height:44px;padding:0 24px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">🤖 분석</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfPX').addEventListener('click', cl);
    document.getElementById('lfPCancel').addEventListener('click', cl);
    document.getElementById('lfPGo').addEventListener('click', function(){
      var t=document.getElementById('lfPasteBox').value.trim();
      var n=document.getElementById('lfPasteNote');
      if(t.length<30){ n.textContent='내용이 너무 짧아요'; n.style.color='#dc2626'; return; }
      n.textContent='🤖 AI 가 정리하는 중…'; n.style.color='#8ba0b6';
      aiParse(t, url)
        .then(function(o){ applyAI(o); cl();
          var nt=document.getElementById('lfAiNote');
          if(nt){ nt.textContent='✅ 붙여넣은 내용으로 채웠어요 — 틀린 곳은 고쳐주세요'; nt.style.color='#16a34a'; } })
        .catch(function(e){ n.textContent='⚠️ '+e.message+' — 아무것도 넣지 않았어요'; n.style.color='#dc2626'; });
    });
    setTimeout(function(){ var b=document.getElementById('lfPasteBox'); if(b) b.focus(); }, 100);
  }

  /* ══════════════════════════════════════════════
     🧾 scan-app 영수증 · 명함 첨부
     ────────────────────────────────────────────── */
  var SCANREFS=[];
  var LS_AUTOCT='wl_life_autoct';
  function autoCtOn(){ var v=lsGet(LS_AUTOCT,null); return v===null? true : !!v; }

  function scanBox(){
    var w=document.getElementById('lfScanBox'); if(!w) return;
    if(!SCANREFS.length){
      w.innerHTML='<div style="font-size:11.5px;color:#aab8c8;padding:3px 2px">아직 첨부된 영수증·명함이 없어요</div>';
      return;
    }
    w.innerHTML = SCANREFS.map(function(r,i){
      var d=r.data||{}, isR=(r.type==='receipt');
      var ic = isR?'🧾':'💼';
      var ti = isR ? (d.place||'영수증') : (d.name||d.company||'명함');
      var sb = isR ? ((d.date||'')+(d.amount?(' · '+won(d.amount)+'원'):''))
                   : ((d.company||'')+(d.mobile?(' · '+d.mobile):''));
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px;background:#fff;border:1.5px solid #dbe6f4;border-radius:9px;margin-bottom:6px">'
        + (d.photoUrl? '<img src="'+esc(d.photoUrl)+'" style="width:40px;height:40px;object-fit:cover;border-radius:7px" loading="lazy">'
                     : '<div style="width:40px;height:40px;background:#f0f6ff;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:19px">'+ic+'</div>')
        + '<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ic+' '+esc(ti)+'</div>'
        + '<div style="font-size:11px;color:#7a92a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(sb)+'</div></div>'
        + '<button type="button" data-sref="'+i+'" style="background:#fde8e8;border:none;border-radius:7px;padding:6px 10px;font-size:12px;color:#b52929;cursor:pointer;font-family:inherit">✕</button></div>';
    }).join('');
    w.querySelectorAll('[data-sref]').forEach(function(b){
      b.addEventListener('click', function(){ SCANREFS.splice(parseInt(b.getAttribute('data-sref'),10),1); scanBox(); }); });
  }

  /* 영수증·명함 → 빈 칸만 채움 */
  function scanFill(type, d){
    var set=function(id,v){ var e=document.getElementById(id);
      if(e && v && !String(e.value||'').trim()) e.value=v; };
    if(type==='receipt'){
      /* ⛽ 주유 영수증이면 차계부 칸을 채운다 (유종 → 차량 자동 선택) */
      var FF=document.getElementById('lf-fuel');
      if(FF){
        var blob=[d.place,d.category,d.memo,d.note,
          (d.items||[]).map(function(it){ return (it.name||'')+' '+(it.unit||''); }).join(' ')].join(' ');
        var fu=sniffFuel(blob) || sniffFuel(d.fuel||'');
        if(fu && FF.value!==fu){
          var has=false; for(var oi=0;oi<FF.options.length;oi++) if(FF.options[oi].value===fu) has=true;
          if(has){
            FF.value=fu;
            var CC=document.getElementById('lf-car'), want=carForFuel(fu);
            if(CC && want && CC.value!==want){
              var hs=false; for(var ci=0;ci<CC.options.length;ci++) if(CC.options[ci].value===want) hs=true;
              if(hs){ CC.value=want;
                if(typeof toast==='function') toast('⛽ '+fu+' → '+want+' 로 맞췄어요'); }
            }
          }
        }
        /* 리터·단가 — 영수증 품목에서 뽑아본다 */
        var L=document.getElementById('lf-liter'), U2=document.getElementById('lf-unit');
        (d.items||[]).forEach(function(it){
          var nm=String(it.name||'');
          var lm=nm.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:L|리터|ℓ)/i);
          if(lm && L && !num(L.value)) L.value=parseFloat(lm[1]);
          if(it.qty && L && !num(L.value) && /주유|유류|가스|LPG|휘발|경유/i.test(nm)) L.value=num(it.qty);
          if(it.price && U2 && !num(U2.value) && /단가|원\/L/i.test(nm)) U2.value=num(it.price);
        });
        if(d.liter && L && !num(L.value)) L.value=num(d.liter);
        if(d.unitPrice && U2 && !num(U2.value)) U2.value=num(d.unitPrice);
      }
      var D=document.getElementById('lf-date');
      if(D && d.date && (!D.value || D.value===today())) D.value=d.date;   /* 오늘(기본값)이면 영수증 날짜로 */
      set('lf-title', d.place||''); set('lf-place', d.place||'');
      set('lf-where', d.place||''); set('lf-phone', d.phone||d.tel||''); set('lf-addr', d.addr||d.address||'');
      var A=document.getElementById('lf-amount');
      if(A && !A.readOnly && !num(A.value) && d.amount) A.value=d.amount;
      /* 구매 모달일 때만 단가에 총액을 넣는다 (차계부의 '리터당 단가'와 혼동 금지) */
      var U=document.getElementById('lf-unit'), isBuy=!!document.getElementById('lf-cur');
      if(isBuy && U && !num(U.value) && d.amount && !(d.items&&d.items.length>1)){
        U.value=d.amount;
        var Q=document.getElementById('lf-qty'); if(Q && !num(Q.value)) Q.value=1;
      }
      /* 영수증 품목 → 품목 목록 행으로 */
      if(d.items && d.items.length && ROWS['items']!==undefined){
        ROWS['items']=(ROWS['items']||[]).filter(function(r){ return String(r.name||'').trim(); });
        d.items.forEach(function(it){ ROWS['items'].push({
          name:String(it.name||''), qty:it.qty||'', price:it.price||it.amount||'', note:'' }); });
        var fd=null; (CAT_P.buy.f).forEach(function(f){ if(f.k==='items') fd=f; });
        if(fd) rowsRender(fd);
      }
      /* 맛집 메뉴로 */
      if(d.items && d.items.length && ROWS['menus']!==undefined){
        ROWS['menus']=(ROWS['menus']||[]).filter(function(r){ return String(r.name||'').trim(); });
        d.items.forEach(function(it){ ROWS['menus'].push({
          name:String(it.name||''), price:it.price||it.amount||'', score:'맛평가', note:'' }); });
        var fm=null; (CAT_P.food.f).forEach(function(f){ if(f.k==='menus') fm=f; });
        if(fm) rowsRender(fm);
      }
    } else {
      set('lf-title', d.company||d.name||''); set('lf-who', d.name||d.company||'');
      set('lf-where', d.company||''); set('lf-place', d.company||'');
      set('lf-phone', d.mobile||d.tel||d.phone||''); set('lf-addr', d.addr||d.address||'');
      set('lf-name', d.name||d.company||''); set('lf-person', d.name||'');
      set('lf-email', d.email||'');
    }
    autoCalc();
  }

  /* 명함 → 개인 연락처 저장 (선택) */
  function cardToContact(d){
    var name=(d.company||d.name||'').trim(); if(!name) return false;
    var already=contacts().some(function(c){
      return c.name===name || (c.phone && d.mobile && String(c.phone).replace(/\D/g,'')===String(d.mobile).replace(/\D/g,'')); });
    if(already) return 'dup';
    var o={ kind:'pcontact', name:name, person:(d.name&&d.name!==name)?d.name:(d.position||''),
      phone:d.mobile||d.tel||d.phone||'', phone2:(d.mobile&&d.tel&&d.mobile!==d.tel)?d.tel:'',
      email:d.email||'', addr:d.addr||d.address||'', cat:'거래처',
      memo:['명함에서 자동 저장', d.position||'', d.fax?('팩스 '+d.fax):''].filter(Boolean).join(' · '),
      date:today(), title:name, createdAt:Date.now(), fromCard:1 };
    try{ pAdd(o); }catch(e){ return false; }
    return true;
  }

  /* picker 열기 */
  function pickScan(type, pt, recId){
    if(typeof window._openScanPicker!=='function'){
      askInfo('scan-app 연결을 못 찾았어요.\n페이지를 새로고침(Ctrl+Shift+R) 한 뒤 다시 해보세요.'); return;
    }
    var linkedTo='worklog:personal_'+(recId||'new');
    window._openScanPicker(type, linkedTo, function(selType, selId, d){
      if(!d) return;
      if(SCANREFS.some(function(r){ return r.type===selType && r.id===selId; })){
        if(typeof toast==='function') toast('이미 첨부됐어요'); return; }
      SCANREFS.push({type:selType, id:selId, data:d});
      scanFill(selType, d);
      scanBox();
      if(selType==='card'){
        var cb=document.getElementById('lfAutoCt');
        if(cb && cb.checked){
          var r=cardToContact(d);
          if(r===true && typeof toast==='function') toast('📞 개인 연락처에도 저장했어요');
          else if(r==='dup' && typeof toast==='function') toast('이미 있는 연락처예요');
        }
      }
    });
  }

  /* ══════ 모달 열기 ══════ */
  var PHOTOS = [];

  function openRec(pt, id, preset){
    var rec = id ? ent().filter(function(e){ return e.id===id; })[0] : null;
    var v = rec ? JSON.parse(JSON.stringify(rec)) : (preset||{});
    if(!v.date) v.date = today();
    var isCar = (pt==='car');
    if(isCar && !v.ctype) v.ctype='주유';
    if(isCar && !v.car) v.car = curCar || (cars()[0]||{}).n || '';
    /* 새 차계부 — 같은 차·같은 구분의 직전 기록에서 반복 항목 자동 채움 */
    if(isCar && !rec){
      var prev = byDate(recs('car').filter(function(e){ return e.car===v.car && e.ctype===v.ctype; }))[0];
      if(prev){ ['fuel','pay','place','addr','phone','open','close','off'].forEach(function(k){
        if(!v[k] && prev[k]) v[k]=prev[k]; }); }
      if(!v.odo){ var mx=0; recs('car').forEach(function(e){ if(e.car===v.car && num(e.odo)>mx) mx=num(e.odo); });
        if(mx) v._lastodo = mx; }
    }
    var d = isCar ? {i:'🚗', n:'차계부', c:'#0891b2'} : (cats()[pt]||catEtc());

    MODPT = pt;
    PHOTOS = esr(v.photos);
    SCANREFS = esr(v.scanRefs);
    ROWS = {};

    var ov = document.createElement('div');
    ov.className='lf-ov'; ov.id='lfOv';
    ov.innerHTML = '<div class="lf-mod">'
      + '<div class="lf-mh"><b>'+d.i+' '+d.n+' '+(rec?'수정':'추가')+'</b>'
      +   '<button type="button" id="lfX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<form id="lfForm" onsubmit="return false">'
      +   '<div class="lf-mf" id="lfFields"></div>'
      +   '<div style="margin-top:14px">'
      +     '<label style="font-size:11.5px;font-weight:800;color:#7a92a8">📷 사진</label>'
      +     '<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">'
      +       '<button type="button" id="lfCam" class="lf-radd">📷 카메라</button>'
      +       '<button type="button" id="lfPick" class="lf-radd">🖼 앨범에서 선택</button>'
      +       '<button type="button" id="lfPaste" class="lf-radd" title="복사해 둔 사진을 붙여넣습니다 (PC 는 Ctrl+V 도 됩니다)">📋 붙여넣기</button>'
      +       '<input type="file" id="lfF1" accept="image/*" capture="environment" style="display:none">'
      +       '<input type="file" id="lfF2" accept="image/*" multiple style="display:none">'
      +     '</div><div id="lfPhotos" class="lf-ph" style="margin-top:8px"></div>'
      +   '</div>'
      +   '<div style="margin-top:14px;padding:11px 13px;background:#f7faff;border:1.5px solid #e3ecf6;border-radius:11px">'
      +     '<label style="font-size:11.5px;font-weight:800;color:#3f7cb8">\ud83e\uddfe \uc601\uc218\uc99d \u00b7 \uba85\ud568 \uccb8\ubd80 <span style="font-weight:600;color:#8ba0b6">(scan-app)</span></label>'
      +     '<div style="display:flex;gap:8px;margin:7px 0;flex-wrap:wrap">'
      +       '<button type="button" id="lfPickR" class="lf-radd">\ud83e\uddfe \uc601\uc218\uc99d \uc120\ud0dd</button>'
      +       '<button type="button" id="lfPickC" class="lf-radd">\ud83d\udcbc \uba85\ud568 \uc120\ud0dd</button>'
      +     '</div>'
      +     '<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#5b7794;cursor:pointer;margin-bottom:8px">'
      +       '<input type="checkbox" id="lfAutoCt" style="width:17px;height:17px"'+(autoCtOn()?' checked':'')+'>'
      +       '\uba85\ud568\uc744 \uace0\ub974\uba74 <b style="color:#2563a8">\uac1c\uc778 \uc5f0\ub77d\ucc98</b>\uc5d0\ub3c4 \uc790\ub3d9 \uc800\uc7a5</label>'
      +     '<div id="lfScanBox"></div>'
      +   '</div>'
      +   (pt==='todo' ? '<label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:13.5px;font-weight:800;color:#33567d;cursor:pointer">'
      +     '<input type="checkbox" id="lf-done" style="width:18px;height:18px"'+(v.done?' checked':'')+'> 다 했어요</label>' : '')
      +   '<div class="lf-mbtn">'
      +     (rec? '<button type="button" id="lfDel" style="height:44px;padding:0 16px;border:none;border-radius:10px;background:#fde8e8;color:#b52929;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit">🗑 삭제</button>':'')
      +     '<div style="flex:1"></div>'
      +     '<button type="button" id="lfCancel" style="height:44px;padding:0 18px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">취소</button>'
      +     '<button type="button" id="lfSave" style="height:44px;padding:0 28px;border:none;border-radius:10px;background:#2563a8;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">💾 저장</button>'
      +   '</div></form></div>';
    document.body.appendChild(ov);

    var FIELDS = [];
    /* 내가 만든 속성을 서식 뒤에 붙인다 (공통 + 이 종류 전용) */
    function myProps(){
      return customOf('_all').concat(customOf(pt)).filter(function(p){ return !p.archived; })
        .map(function(p){ return { k:'P__'+p.id, l:p.name, t:(p.type==='num'?'number':p.type),
                                   o:p.o||p.opts, target:p.target, expr:p.expr, unit:p.unit,
                                   colors:p.colors, relPid:p.relPid, tgtPid:p.tgtPid, agg:p.agg, dir:p.dir,
                                   w:((p.type==='area'||p.type==='formula')?'full':''), my:1, pid:p.id }; });
    }
    function build(){
      var base = isCar ? carFields(v.ctype||'주유') : (cats()[pt]||catEtc()).f;
      var mine = myProps();
      FIELDS = mine.length ? base.concat([{s:'🧩 내가 만든 항목'}]).concat(mine) : base.slice();
      /* 내 속성 값은 props 안에 있다 → 임시로 꺼내서 그린다 */
      mine.forEach(function(f){ v[f.k] = (v.props||{})[f.pid]; });
      document.getElementById('lfFields').innerHTML = FIELDS.map(function(f){ return fieldHTML(f, v); }).join('')
        + '<div class="lf-f full" style="align-items:flex-start"><button type="button" id="lfAddProp" class="lf-radd" style="height:34px">＋ 속성 추가</button></div>';
      var ap=document.getElementById('lfAddProp');
      if(ap) ap.addEventListener('click', function(){
        v = Object.assign({}, v, collect());
        propAdd(pt, function(){ build(); });
      });
      FIELDS.forEach(function(f){ if(f.t==='rows'){ ROWS[f.k]=esr(v[f.k]); rowsRender(f); } });
      bindNumsIn(document.getElementById('lfFields'));
      bindDial(document.getElementById('lfFields'));
      document.getElementById('lfFields').querySelectorAll('.lf-multi-f').forEach(function(mb){
        var hid=document.getElementById(mb.getAttribute('data-for'));
        mb.querySelectorAll('[data-mv]').forEach(function(t){
          t.addEventListener('click', function(){
            var arr=(hid.value||'').split(',').filter(Boolean);
            var v3=t.getAttribute('data-mv'), i3=arr.indexOf(v3);
            if(i3>=0){ arr.splice(i3,1); t.classList.remove('on'); t.removeAttribute('style'); }
            else { arr.push(v3); t.classList.add('on'); }
            hid.value=arr.join(',');
            if(i3<0){ var cc=colorOf(((FIELDS.filter(function(f){return f.k===mb.getAttribute('data-for').slice(3);})[0]||{}).colors||{})[v3]||'gray');
              t.style.background=cc.bg; t.style.color=cc.fg; }
          });
        });
      });
      autoCalc(); drawPhotos(); scanBox(); fxCalc();
      var st=document.getElementById('lf-star');
      if(st) st.querySelectorAll('[data-st]').forEach(function(sp){
        sp.addEventListener('click', function(){
          var n=parseInt(sp.getAttribute('data-st'),10);
          var hid=document.getElementById('lf-rating'); if(hid) hid.value=n;
          st.querySelectorAll('[data-st]').forEach(function(o){
            o.textContent = parseInt(o.getAttribute('data-st'),10)<=n ? '★':'☆'; });
        });
      });
    }
    build();

    function collect(){
      var o = {}, pr = {};
      for(var k0 in (v.props||{})) pr[k0]=v.props[k0];
      FIELDS.forEach(function(f){
        if(f.s) return;
        if(f.t==='rows'){ rowsCollect(f); o[f.k]=rowsClean(ROWS[f.k]); return; }
        if(f.t==='calc') return;
        var el=document.getElementById('lf-'+f.k); if(!el) return;
        if(f.t==='formula'||f.t==='rollup') return;               /* 자동 계산 — 저장 안 함 */
        if(f.t==='multi'){
          var mv2=(el.value||'').split(',').filter(Boolean);
          if(f.my){ pr[f.pid]=mv2; o[f.k]=mv2; } else o[f.k]=mv2;
          return;
        }
        var val = (f.t==='num'||f.t==='number'||f.t==='rate')
                    ? (numRaw(el.value)===''?'':num(numRaw(el.value)))
                : (f.t==='check' ? !!el.checked
                : (f.t==='rel'   ? (el.value? [el.value] : [])
                : el.value));
        if(f.my){ pr[f.pid]=val; o[f.k]=val; return; }   /* 내 속성은 props 로 */
        o[f.k] = val;
      });
      o.props = pr;
      return o;
    }
    function drawPhotos(){
      var h=document.getElementById('lfPhotos'); if(!h) return;
      h.innerHTML = PHOTOS.map(function(u,i){
        return '<span style="position:relative;display:inline-block">'
          + '<img src="'+esc(u)+'">'
          + '<button type="button" data-pdel="'+i+'" style="position:absolute;top:-5px;right:-5px;width:19px;height:19px;'
          + 'border:none;border-radius:50%;background:#c0392b;color:#fff;font-size:10px;cursor:pointer;line-height:1;padding:0">✕</button></span>'; }).join('');
      h.querySelectorAll('[data-pdel]').forEach(function(b){
        b.addEventListener('click', function(){ PHOTOS.splice(parseInt(b.getAttribute('data-pdel'),10),1); drawPhotos(); }); });
    }

    /* ── 이벤트 위임 ── */
    ov.addEventListener('input', function(e){
      var t=e.target;
      try{ fxCalc(); }catch(x){}
      if(t.hasAttribute && t.hasAttribute('data-llink')) autoCalc();
      if(t.id==='lf-totalpg'||t.id==='lf-readpg') autoCalc();
      if(t.hasAttribute && t.hasAttribute('data-rk')){
        var rw=t.closest('.lf-rows'); if(rw){ var k=rw.getAttribute('data-lrows');
          FIELDS.forEach(function(f){ if(f.k===k) rowsTotal(f); });
          if(k==='items') calcBuy(); }
      }
      if(t.id==='lf-amount') t._touched=true;
    });
    ov.addEventListener('change', function(e){
      if(e.target.hasAttribute && e.target.hasAttribute('data-lreload')){
        v = Object.assign({}, v, collect()); build();
      }
    });
    ov.addEventListener('click', function(e){
      var t=e.target.closest('button'); if(!t) return;
      if(t.hasAttribute('data-lmap')){
        var a=document.getElementById(t.getAttribute('data-lmap'));
        if(a && a.value.trim()) window.open('https://map.naver.com/p/search/'+encodeURIComponent(a.value.trim()),'_blank');
        else askInfo('주소를 먼저 입력하세요'); return;
      }
      if(t.hasAttribute('data-ltel')){
        var p=document.getElementById(t.getAttribute('data-ltel'));
        if(p && p.value.trim()) location.href='tel:'+p.value.replace(/[^0-9+]/g,'');
        else askInfo('전화번호를 먼저 입력하세요'); return;
      }
      if(t.hasAttribute('data-lai')){ runLinkAI(t.getAttribute('data-lai')); return; }
      if(t.hasAttribute('data-lfx')){ fetchFx(); return; }
      if(t.hasAttribute('data-lopen')){
        var lk=document.getElementById(t.getAttribute('data-lopen'));
        if(lk && /^https?:\/\//i.test(lk.value.trim())) window.open(lk.value.trim(),'_blank'); return;
      }
      if(t.hasAttribute('data-lradd')){
        var k=t.getAttribute('data-lradd');
        FIELDS.forEach(function(f){ if(f.k===k){ rowsCollect(f); (ROWS[k]=ROWS[k]||[]).push({}); rowsRender(f); } });
        return;
      }
      if(t.hasAttribute('data-rdel')){
        var rw=t.closest('.lf-rows'); if(!rw) return;
        var k2=rw.getAttribute('data-lrows'), i=parseInt(t.getAttribute('data-rdel'),10);
        FIELDS.forEach(function(f){ if(f.k===k2){ rowsCollect(f); ROWS[k2].splice(i,1); rowsRender(f); } });
        return;
      }
    });

    document.getElementById('lfPickR').addEventListener('click', function(){ pickScan('receipt', pt, id); });
    document.getElementById('lfPickC').addEventListener('click', function(){ pickScan('card', pt, id); });
    document.getElementById('lfAutoCt').addEventListener('change', function(){ lsSet(LS_AUTOCT, this.checked); });
    document.getElementById('lfCam').addEventListener('click', function(){ document.getElementById('lfF1').click(); });
    document.getElementById('lfPick').addEventListener('click', function(){ document.getElementById('lfF2').click(); });
    ['lfF1','lfF2'].forEach(function(fid){
      document.getElementById(fid).addEventListener('change', async function(ev){
        var fs=Array.from(ev.target.files||[]);
        for(var i=0;i<fs.length && PHOTOS.length<8;i++){
          var u=await shrink(fs[i]); if(u) PHOTOS.push(u);
        }
        ev.target.value=''; drawPhotos();
      });
    });
    /* v255 — 달님 : 「사진 붙여넣기 방식이 없더라」 업무 입력창(worklog.js 4338행)과 같은 방식.
       ① Ctrl+V(창 어디서나)  ② 📋 붙여넣기 단추(휴대폰 — 클립보드 읽기 권한을 물어본다)  ③ 끌어놓기 */
    async function addPhotoFiles(fs, how){
      var n=0;
      for(var i=0;i<fs.length && PHOTOS.length<8;i++){
        if(!/^image\//.test(fs[i].type||'')) continue;
        var u=await shrink(fs[i]); if(u){ PHOTOS.push(u); n++; }
      }
      drawPhotos();
      if(typeof toast==='function') toast(n ? (how+' 사진 '+n+'장 추가됨') : '사진이 없어요 — 사진을 복사한 뒤 눌러 주세요');
    }
    ov.addEventListener('paste', function(e){
      var dt=e.clipboardData; if(!dt) return;
      var fs=[].filter.call(dt.files||[], function(f){ return /^image\//.test(f.type); });
      if(!fs.length) return;                      /* 글자 붙여넣기는 그대로 둔다 */
      e.preventDefault(); addPhotoFiles(fs, '📋 클립보드에서');
    });
    document.getElementById('lfPaste').addEventListener('click', async function(){
      try{
        if(!(navigator.clipboard && navigator.clipboard.read)){ if(typeof toast==='function') toast('이 브라우저는 단추 붙여넣기를 지원하지 않아요 — Ctrl+V 를 써 주세요'); return; }
        var items=await navigator.clipboard.read(), fs=[];
        for(var a=0;a<items.length;a++){ var ts=items[a].types.filter(function(t){ return /^image\//.test(t); });
          for(var b=0;b<ts.length;b++){ var bl=await items[a].getType(ts[b]); fs.push(new File([bl], 'paste.'+ts[b].split('/')[1], {type:ts[b]})); } }
        addPhotoFiles(fs, '📋 클립보드에서');
      }catch(err){ console.warn('[붙여넣기]', err); if(typeof toast==='function') toast('클립보드를 못 읽었어요 — 권한을 허용했는지 확인해 주세요'); }
    });
    ['dragenter','dragover'].forEach(function(ev){ ov.addEventListener(ev, function(e){ e.preventDefault(); }); });
    ov.addEventListener('drop', function(e){
      var fs=(e.dataTransfer&&e.dataTransfer.files)||[]; if(!fs.length) return;
      e.preventDefault(); addPhotoFiles([].slice.call(fs), '끌어놓은');
    });

    function close(){ ov.remove(); }
    document.getElementById('lfX').addEventListener('click', close);
    document.getElementById('lfCancel').addEventListener('click', close);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) close(); });

    var db=document.getElementById('lfDel');
    if(db) db.addEventListener('click', function(){
      askDel('이 기록을 지울까요?').then(function(ok){
        if(!ok) return;
        try{ pDel(id); }catch(e2){ console.error('[삭제]', e2); if(typeof toast==='function') toast('삭제 실패: '+e2); return; }
        close(); if(typeof toast==='function') toast('🗑 삭제됐어요'); setTimeout(render, 250);
      });
    });

    document.getElementById('lfSave').addEventListener('click', function(){
      var o = collect();
      var miss = FIELDS.filter(function(f){ return f.req && !String(o[f.k]||'').trim(); });
      if(miss.length){ askInfo(miss[0].l+' 은(는) 꼭 넣어주세요'); 
        var me=document.getElementById('lf-'+miss[0].k); if(me) me.focus(); return; }
      Object.keys(o).forEach(function(k){ if(k.slice(0,3)==='P__') delete o[k]; });
      o.kind='personal'; o.ptype=pt; o.photos=PHOTOS.slice();
      o.scanRefs = SCANREFS.map(function(r){ return {type:r.type, id:r.id, data:r.data}; });
      var ac=document.getElementById('lf-amount');
      if(ac && ac.readOnly && ac.dataset && ac.dataset.krw) o.amount = num(ac.dataset.krw);
      if(o.amount==='' || o.amount==null){ var ae=document.getElementById('lf-amount');
        if(ae && !ae.readOnly && numRaw(ae.value)!=='') o.amount = num(numRaw(ae.value)); }
      if(pt==='todo'){ var dc=document.getElementById('lf-done'); o.done = dc? dc.checked : false; }
      if(!o.title){ o.title = o.who || o.place || o.name || (isCar? (o.ctype||'차계부') : d.n); }
      try{
        if(rec){ pUpd(id, o); }
        else { o.createdAt=Date.now(); pAdd(o); }
      }catch(e3){ noteMsg('저장 실패: '+e3); return; }
      close(); if(typeof toast==='function') toast('저장됐어요');
      try{ if(typeof window._linkScanItemBack==='function'){
        var lt='worklog:personal_'+(id||'new');
        SCANREFS.forEach(function(r){ window._linkScanItemBack(r.type, r.id, lt); }); } }catch(eL){}
      if(isCar && o.car){ curCar=o.car; lsSet(LS_CAR,o.car); }
      setTimeout(render, 250);
    });

    setTimeout(function(){
      var first=document.querySelector('#lfFields input:not([type=hidden]):not([readonly]), #lfFields textarea');
      if(first && window.innerWidth>820) try{ first.focus(); }catch(e4){}
    }, 120);
  }

  /* ── 연락처 모달 ── */
  function openCt(id){
    var rec = id ? ent().filter(function(e){ return e.id===id; })[0] : null;
    var v = rec ? JSON.parse(JSON.stringify(rec)) : {cat: (curCat!=='전체'? curCat : '기타')};
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.id='lfOv';
    ov.innerHTML='<div class="lf-mod" style="max-width:720px">'
      + '<div class="lf-mh"><b>📞 개인 연락처 '+(rec?'수정':'추가')+'</b>'
      +   '<button type="button" id="lfX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div class="lf-mf">'+CTF.map(function(f){ return fieldHTML(f,v); }).join('')+'</div>'
      + '<div class="lf-mbtn">'
      +   (rec?'<button type="button" id="lfDel" style="height:44px;padding:0 16px;border:none;border-radius:10px;background:#fde8e8;color:#b52929;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit">🗑 삭제</button>':'')
      +   '<div style="flex:1"></div>'
      +   '<button type="button" id="lfCancel" style="height:44px;padding:0 18px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">취소</button>'
      +   '<button type="button" id="lfSave" style="height:44px;padding:0 28px;border:none;border-radius:10px;background:#2563a8;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">💾 저장</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){
      var t=e.target.closest('button'); if(!t) return;
      if(t.hasAttribute('data-lmap')){ var a=document.getElementById(t.getAttribute('data-lmap'));
        if(a&&a.value.trim()) window.open('https://map.naver.com/p/search/'+encodeURIComponent(a.value.trim()),'_blank'); return; }
      if(t.hasAttribute('data-ltel')){ var p=document.getElementById(t.getAttribute('data-ltel'));
        if(p&&p.value.trim()) location.href='tel:'+p.value.replace(/[^0-9+]/g,''); return; }
    });
    function close(){ ov.remove(); }
    document.getElementById('lfX').addEventListener('click', close);
    document.getElementById('lfCancel').addEventListener('click', close);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) close(); });
    var db=document.getElementById('lfDel');
    if(db) db.addEventListener('click', function(){
      askDel('이 연락처를 지울까요?').then(function(ok){
        if(!ok) return;
        try{ pDel(id); }catch(e2){ console.error('[삭제]', e2); if(typeof toast==='function') toast('삭제 실패: '+e2); return; }
        close(); if(typeof toast==='function') toast('🗑 삭제됐어요'); setTimeout(render,250);
      });
    });
    document.getElementById('lfSave').addEventListener('click', function(){
      var o={};
      CTF.forEach(function(f){ var el=document.getElementById('lf-'+f.k); if(el) o[f.k]=el.value; });
      if(!String(o.name||'').trim()){ askInfo('이름을 꼭 넣어주세요'); return; }
      o.kind='pcontact'; o.date = v.date || today(); o.title = o.name;
      try{
        if(rec){ pUpd(id,o); }
        else { o.createdAt=Date.now(); pAdd(o); }
      }catch(e3){ noteMsg('저장 실패: '+e3); return; }
      close(); if(typeof toast==='function') toast('저장됐어요'); setTimeout(render,250);
    });
    setTimeout(function(){ var n=document.getElementById('lf-name'); if(n&&window.innerWidth>820) try{n.focus();}catch(e){} },120);
  }

  /* ── 카테고리 선택 시트 ── */
  function openCatSheet(preDate){
    var ov=document.createElement('div'); ov.className='lf-ov';
    ov.innerHTML='<div class="lf-mod" style="max-width:640px">'
      + '<div class="lf-mh"><b>무엇을 기록할까요?</b>'
      +   '<button type="button" id="lfX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div class="lf-cats">' + catPickList().map(function(d){
          return '<button type="button" class="lf-cb" data-lcat="'+d.k+'"><span class="i">'+d.i+'</span><span class="l">'+d.n+'</span></button>'; }).join('')
      + '</div></div>';
    document.body.appendChild(ov);
    function close(){ ov.remove(); }
    document.getElementById('lfX').addEventListener('click', close);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) close(); });
    ov.querySelectorAll('[data-lcat]').forEach(function(b){
      b.addEventListener('click', function(){ var k=b.getAttribute('data-lcat'); close();
        openRec(k, null, preDate? {date:preDate} : null); }); });
  }



  /* ══════════════════════════════════════════════════════════
     📥 예전 개인일지(personal / personal_contacts) 가져오기
     같은 파이어베이스 프로젝트 안에 있으므로 그대로 읽어온다.
     기록은 새 서식으로 옮기고, 이미 있는 것은 건드리지 않는다.
     ══════════════════════════════════════════════════════════ */
  var OLD_REC='personal', OLD_CT='personal_contacts', OLD_PH='personal_photos';
  var CATMAP={ '건강':'health','구매':'buy','기타':'etc','독서':'book','맛집':'food',
               '사람':'person','생각':'think','여행':'trip','일상':'daily','차계부':'car',
               '통화':'person','가족':'person','약속':'person','아이디어':'think' };

  function n_(v){ var x=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,'')); return isNaN(x)?'':x; }
  function t_(v){ return String(v==null?'':v).trim(); }

  /* 예전 항목행 → 새 항목행 */
  function mapItems(pt, ctype, items){
    var a=Array.isArray(items)?items:[];
    if(!a.length) return null;
    if(pt==='book' || pt==='think')
      return { key:(pt==='book'?'quotes':'items'),
               rows:a.map(function(it){ return { name:t_(it.quote||it.name), note:t_(it.thought) }; })
                     .filter(function(r){ return r.name||r.note; }) };
    if(pt==='daily')
      return { key:'thanks',
               rows:a.map(function(it){ return { name:t_(it.quote||it.thought||it.name) }; })
                     .filter(function(r){ return r.name; }) };
    if(pt==='food')
      return { key:'menus',
               rows:a.map(function(it){ return { name:t_(it.name), price:n_(it.price), score:'맛평가',
                        note:(it.people? (it.people+'명'):'') }; })
                     .filter(function(r){ return r.name||r.price; }) };
    if(pt==='health')
      return { key:'costs',
               rows:a.map(function(it){ return { name:[t_(it.type),t_(it.name)].filter(Boolean).join(' '), price:n_(it.price) }; })
                     .filter(function(r){ return r.name||r.price; }) };
    if(pt==='trip')
      return { key:'costs',
               rows:a.map(function(it){ return { name:t_(it.name), price:n_(it.price), note:'' }; })
                     .filter(function(r){ return r.name||r.price; }) };
    if(pt==='car' && ctype!=='주유')
      return { key:'parts',
               rows:a.map(function(it){ return { name:t_(it.name), price:n_(it.price) }; })
                     .filter(function(r){ return r.name||r.price; }) };
    if(pt==='buy')
      return { key:'items',
               rows:a.map(function(it){ return { name:t_(it.name), qty:'', price:n_(it.price), note:'' }; })
                     .filter(function(r){ return r.name||r.price; }) };
    return { key:'items',
             rows:a.map(function(it){ return { name:t_(it.name), note:t_(it.thought) }; })
                   .filter(function(r){ return r.name||r.note; }) };
  }

  /* 예전 기록 1건 → 새 기록 1건 */
  function mapRec(o){
    var pt = CATMAP[t_(o.cat)] || 'etc';
    var r = { kind:'personal', ptype:pt, oldId:String(o.id||''), fromOld:1,
              date: t_(o.date) || today(),
              title: t_(o.title), detail: t_(o.detail),
              createdAt: o.created ? Date.parse(o.created)||Date.now() : Date.now() };

    if(pt==='car'){
      /* 예전: who=차량, title=구분(주유/정비/보험/기타), addr=주유소·정비소 */
      r.car   = t_(o.who) || (cars()[0]||{}).n || '';
      r.ctype = t_(o.title) || '기타';
      if(['주유','정비','보험','세차','검사','기타'].indexOf(r.ctype)<0) r.ctype='기타';
      r.place = t_(o.addr);
      r.title = (r.ctype==='주유' ? (r.place||'주유') : (t_(o.detail).split('\n')[0].slice(0,40) || r.ctype));
      if(o.odo)      r.odo   = n_(o.odo);
      if(o.liters)   r.liter = n_(o.liters);
      if(o.fuelunit) r.unit  = n_(o.fuelunit);
      if(o.amount)   r.amount= n_(o.amount);
      if(o.pay)      r.pay   = t_(o.pay);
      /* 차 이름이 목록에 없으면 자동 추가 */
      if(r.car){ var cl=cars();
        if(!cl.some(function(c){ return c.n===r.car; })){
          cl.push({n:r.car, c:CARPOOL[cl.length % CARPOOL.length]}); carsSave(cl); } }
    } else {
      if(o.who)   r.who   = t_(o.who);
      if(o.addr)  r.addr  = t_(o.addr);
      if(o.place) r.place = t_(o.place);
      if(o.amount) r.amount = n_(o.amount);
    }
    if(o.phone)  r.phone  = t_(o.phone);
    if(o.stars)  r.rating = n_(o.stars);
    if(o.subtype)r.ptype2 = t_(o.subtype)==='약속' ? '만남' : t_(o.subtype);
    if(o.time2)  r.time   = t_(o.time2);
    if(o.prep)   r.prep   = t_(o.prep);
    if(o.insur)  r.insur  = t_(o.insur)==='청구예정'?'청구 예정':(t_(o.insur)==='청구완료'?'청구 완료':t_(o.insur));
    if(o.booktype)r.btype = t_(o.booktype).indexOf('전자')>=0 ? '📱 전자책' : '📕 종이책';
    if(o.totalpg)r.totalpg= n_(o.totalpg);
    if(o.readpg) r.readpg = n_(o.readpg);
    if(o.link)   r.link   = t_(o.link);
    if(o.cur)    r.cur    = t_(o.cur);
    if(o.unit)   r.unit   = n_(o.unit);
    if(o.qty)    r.qty    = n_(o.qty);
    if(o.ship)   r.ship   = n_(o.ship);
    if(o.shipinc)r.shipinc= (t_(o.shipinc)==='포함' ? '단가에 이미 포함' : '합계에 더하기');
    if(o.rate)   r.rate   = n_(o.rate);
    if(o.pay && pt!=='car') r.pay = t_(o.pay);
    if(o.mood)   r.mood   = t_(o.mood);
    if(o.weather)r.weather= t_(o.weather);
    if(o.tomorrow)r.tomorrow=t_(o.tomorrow);
    if(pt==='daily' && !r.title) r.title = t_(o.detail).split('\n')[0].slice(0,40) || '일상';

    var mi = mapItems(pt, r.ctype, o.items);
    if(mi && mi.rows.length) r[mi.key]=mi.rows;

    if(Array.isArray(o.photoIds) && o.photoIds.length) r.oldPhotoIds=o.photoIds.slice();
    if(!r.title) r.title = t_(o.detail).split('\n')[0].slice(0,40) || (cats()[pt]||catEtc()).n;
    return r;
  }

  function mapCt(o){
    return { kind:'pcontact', fromOld:1, oldId:String(o.id||''),
      name: t_(o.name)||'(이름없음)', cat: t_(o.cat)||'기타',
      phone: t_(o.phone), person: t_(o.person), addr: t_(o.addr),
      memo: t_(o.memo), date: today(), title: t_(o.name)||'(이름없음)',
      createdAt: Date.now() };
  }

  /* 진행상황 창 */
  function impPop(){
    var ov=document.createElement('div'); ov.className='lf-ov'; ov.id='lfImpOv';
    ov.innerHTML='<div class="lf-mod" style="max-width:620px">'
      + '<div class="lf-mh"><b>📥 예전 개인일지 가져오기</b>'
      +   '<button type="button" id="lfIX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div id="lfImpBody" style="font-size:13px;color:#33567d;line-height:1.75"></div>'
      + '<div class="lf-mbtn"><div style="flex:1"></div>'
      +   '<button type="button" id="lfIGo" style="height:44px;padding:0 24px;border:none;border-radius:10px;background:#2563a8;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">🔍 찾아보기</button>'
      +   '<button type="button" id="lfIC" style="height:44px;padding:0 18px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    document.getElementById('lfIX').addEventListener('click', cl);
    document.getElementById('lfIC').addEventListener('click', cl);
    function say(h){ var e=document.getElementById('lfImpBody'); if(e) e.innerHTML=h; }
    say('예전에 쓰시던 <b>개인일지 앱</b>의 기록을 여기로 가져옵니다.<br>'
      + '같은 구글 계정 안에 있어서 바로 읽어올 수 있어요.<br><br>'
      + '· 이미 여기 있는 것은 <b>건드리지 않습니다</b><br>'
      + '· 예전 앱의 기록도 <b>그대로 남습니다</b> (복사만 해옵니다)<br>'
      + '· 차계부·맛집·구매 같은 서식에 맞춰 옮깁니다<br><br>'
      + '<b>[🔍 찾아보기]</b> 를 누르면 몇 건이 있는지 먼저 알려드립니다.');

    var FOUND=null;
    document.getElementById('lfIGo').addEventListener('click', function(){
      var btn=document.getElementById('lfIGo');
      if(FOUND){ doImport(FOUND, say, btn, cl); return; }
      btn.disabled=true; btn.textContent='🔍 찾는 중…';
      scanOld().then(function(f){
        FOUND=f; btn.disabled=false;
        if(!f.rec.length && !f.ct.length){
          say('예전 개인일지에서 <b>기록을 찾지 못했습니다.</b><br><br>'
            + '· 이미 다 가져왔거나<br>· 예전 앱이 다른 계정을 쓰고 있을 수 있어요.<br><br>'
            + '<span style="color:#8ba0b6;font-size:12px">확인한 곳: <code>personal</code> · <code>personal_contacts</code></span>');
          btn.style.display='none'; return;
        }
        var lines=[];
        var byCat={};
        f.rec.forEach(function(o){ var c=t_(o.cat)||'기타'; byCat[c]=(byCat[c]||0)+1; });
        Object.keys(byCat).sort(function(a,b){ return byCat[b]-byCat[a]; }).forEach(function(c){
          lines.push('· '+esc(c)+' <b>'+byCat[c]+'건</b>'); });
        say('찾았습니다!<br><br>'
          + '<div style="background:#f0f9f4;border:1.5px solid #b7e4c7;border-radius:10px;padding:12px 15px">'
          +   '<b style="font-size:15px">기록 '+f.rec.length+'건 · 연락처 '+f.ct.length+'건</b><br>'
          +   '<div style="font-size:12.5px;color:#166534;margin-top:6px;columns:2">'+lines.join('<br>')+'</div>'
          + '</div><br>'
          + (f.skip? '<span style="color:#8ba0b6">이미 가져온 '+f.skip+'건은 건너뜁니다.</span><br><br>':'')
          + '<b>[📥 가져오기]</b> 를 누르면 시작합니다.');
        btn.textContent='📥 가져오기';
      }).catch(function(e){
        btn.disabled=false; btn.textContent='🔍 다시 찾기';
        say('<span style="color:#c0392b">⚠️ 읽지 못했습니다 — '+esc(e.message||e)+'</span><br><br>'
          + '· 인터넷 연결을 확인해 주세요<br>'
          + '· 파이어베이스 규칙이 <code>personal</code> 을 막고 있을 수 있어요');
      });
    });
  }

  function scanOld(){
    if(!(typeof online!=='undefined' && online && typeof db!=='undefined' && db))
      return Promise.reject(new Error('지금 오프라인이에요'));
    var haveOld={}; ent().forEach(function(e){ if(e.oldId) haveOld[e.kind+':'+e.oldId]=1; });
    return Promise.all([
      db.collection(OLD_REC).get().catch(function(){ return {docs:[]}; }),
      db.collection(OLD_CT).get().catch(function(){ return {docs:[]}; })
    ]).then(function(r){
      var skip=0;
      var rec=r[0].docs.map(function(d){ var o=d.data()||{}; o.id=o.id||d.id; return o; })
        .filter(function(o){ if(o.deletedAt) return false;
          if(haveOld['personal:'+o.id]){ skip++; return false; } return true; });
      var ct=r[1].docs.map(function(d){ var o=d.data()||{}; o.id=o.id||d.id; return o; })
        .filter(function(o){ if(haveOld['pcontact:'+o.id]){ skip++; return false; } return true; });
      return { rec:rec, ct:ct, skip:skip };
    });
  }

  /* 사진까지 같이 가져온다 (있으면) */
  function fetchOldPhotos(ids){
    if(!ids || !ids.length) return Promise.resolve([]);
    return Promise.all(ids.slice(0,8).map(function(pid){
      return db.collection(OLD_PH).doc(String(pid)).get()
        .then(function(d){ var v=d.exists?d.data():null; return (v&&v.data)?v.data:null; })
        .catch(function(){ return null; });
    })).then(function(a){ return a.filter(Boolean); });
  }

  function doImport(F, say, btn, close){
    btn.disabled=true;
    var total=F.rec.length+F.ct.length, done=0, okR=0, okC=0, ph=0;
    function tick(){ done++;
      say('<b>가져오는 중… '+done+' / '+total+'</b>'
        + '<div style="height:9px;background:#e8f0fa;border-radius:5px;margin-top:9px;overflow:hidden">'
        + '<div style="height:100%;width:'+Math.round(done/total*100)+'%;background:#2563a8"></div></div>'
        + '<div style="font-size:12px;color:#8ba0b6;margin-top:7px">기록 '+okR+'건 · 연락처 '+okC+'건 · 사진 '+ph+'장</div>'); }
    tick(); done=0;

    var i=0;
    function nextRec(){
      if(i>=F.rec.length) return doCt();
      var o=F.rec[i++];
      var r;
      try{ r=mapRec(o); }catch(e){ tick(); return nextRec(); }
      var pids=r.oldPhotoIds; delete r.oldPhotoIds;
      var go=function(photos){
        if(photos && photos.length){ r.photos=photos; ph+=photos.length; }
        try{ pAdd(r); okR++; }catch(e){}
        tick();
        setTimeout(nextRec, 0);
      };
      if(pids && pids.length) fetchOldPhotos(pids).then(go).catch(function(){ go(null); });
      else go(null);
    }
    var j=0;
    function doCt(){
      if(j>=F.ct.length) return finish();
      var o=F.ct[j++];
      try{ pAdd(mapCt(o)); okC++; }catch(e){}
      tick();
      setTimeout(doCt, 0);
    }
    function finish(){
      say('<div style="background:#f0f9f4;border:1.5px solid #b7e4c7;border-radius:10px;padding:14px 16px">'
        + '<b style="font-size:15px;color:#166534">✅ 다 가져왔습니다</b><br><br>'
        + '· 기록 <b>'+okR+'건</b><br>· 연락처 <b>'+okC+'건</b><br>· 사진 <b>'+ph+'장</b>'
        + '</div><br>'
        + '<span style="font-size:12.5px;color:#8ba0b6">예전 앱의 기록은 그대로 남아 있습니다.<br>'
        + '옮겨온 것들은 서식이 조금 달라졌을 수 있으니, 중요한 건 한 번씩 열어서 확인해 주세요.</span>');
      btn.style.display='none';
      if(typeof toast==='function') toast('📥 '+(okR+okC)+'건 가져왔어요');
      setTimeout(function(){ render(); }, 400);
    }
    nextRec();
  }
  window.wlLifeImportOld = impPop;

  /* ══════ ⑤ 안전 탭 — 휴지통 · 스냅샷 · 내보내기 ══════ */
  var safeSrc='personal', SNAPS=[], snapsLoaded=false, snapsBusy=false;
  var cloudInfo={ online:false, col:'personal_entries', project:'my-system-25497' };
  try{ if(typeof firebaseConfig!=='undefined' && firebaseConfig.projectId) cloudInfo.project=firebaseConfig.projectId; }catch(e){}
  function P_(){ return window.wlP; }

  function viewSafe(){
    if(!P_()) return '<div class="lf-empty"><div class="ei">⏳</div>저장소를 준비하는 중이에요…</div>';
    try{ cloudInfo.online = P_().isOnline(); cloudInfo.col = P_().colName(); }catch(e){}
    var noteCol = cloudInfo.online ? '#0f7a4a' : '#b26b00';
    var noteTxt = cloudInfo.online
      ? '🟢 지금 클라우드에 연결돼 있어요 — 저장하면 폰에도 바로 반영됩니다'
      : '🟡 지금은 오프라인 — 이 기기에 먼저 저장하고, 연결되면 자동으로 올라갑니다';
    var tr = P_().trash(safeSrc) || [];
    var nP = ent().length;
    var nW = 0; try{ nW = (typeof entries!=='undefined'? entries.length : 0); }catch(e){}

    var rows = tr.length ? tr.slice(0,60).map(function(t){
      var r=t.rec||{}, isP=(safeSrc==='personal');
      var d = isP ? (r.ptype==='car' ? {i:'🚗',n:'차계부'} : (r.kind==='pcontact'? {i:'📞',n:'연락처'} : (cats()[r.ptype]||catEtc())))
                  : {i:'📋', n:(r.kind||'기록')};
      var when=new Date(t.at), ago=Math.floor((Date.now()-t.at)/86400000);
      return '<tr><td style="white-space:nowrap">'+d.i+' '+esc(d.n)+'</td>'
        + '<td>'+esc(r.title||r.name||r.detail||'(제목없음)').slice(0,44)+'</td>'
        + '<td style="white-space:nowrap;color:#8ba0b6">'+esc(r.date||'')+'</td>'
        + '<td style="white-space:nowrap;color:#a8b8c8">'+(ago===0?'오늘':(ago+'일 전'))
        + '<div style="font-size:10.5px">'+when.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+'</div></td>'
        + '<td class="r"><button type="button" data-trs="'+t.at+'" style="height:30px;padding:0 12px;border:1.5px solid #bcd2ea;border-radius:8px;background:#f0f6ff;color:#2563a8;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">↩ 되살리기</button></td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:#a8b8c8;padding:28px">휴지통이 비어 있어요</td></tr>';

    var snapRows = SNAPS.length ? SNAPS.map(function(x){
      var tag = x.tag.indexOf('personal')===0 ? '🏠 개인일지' : '📋 업무일지';
      if(x.tag.indexOf('이사전')>=0) tag='📦 이사 직전';
      var ago=Math.floor((Date.now()-x.at)/86400000);
      return '<tr><td style="white-space:nowrap">'+tag+'</td>'
        + '<td style="white-space:nowrap">'+esc(x.day)+'</td>'
        + '<td class="r" style="white-space:nowrap">'+won(x.n)+'건</td>'
        + '<td style="white-space:nowrap;color:#a8b8c8">'+(ago===0?'오늘':(ago+'일 전'))+'</td>'
        + '<td class="r"><button type="button" data-snv="'+esc(x.k)+'" style="height:30px;padding:0 11px;border:1.5px solid #dbe6f4;border-radius:8px;background:#fff;color:#5b7794;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">👁 보기</button>'
        + ' <button type="button" data-snd="'+esc(x.k)+'" style="height:30px;padding:0 11px;border:1.5px solid #f0d5d5;border-radius:8px;background:#fff;color:#b52929;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">🗑</button></td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:#a8b8c8;padding:22px">아직 스냅샷이 없어요 — [지금 스냅샷] 을 눌러보세요</td></tr>';

    return '<div class="lf-sum">'
      + sBox('개인일지', won(nP)+'건', '별도 저장소 personal_entries')
      + sBox('업무일지', won(nW)+'건', '기존 저장소 worklog_entries')
      + sBox('휴지통', won((P_().trash('personal')||[]).length + (P_().trash('worklog')||[]).length)+'건', '90일 보관 후 사라짐')
      + sBox('스냅샷', won(SNAPS.length)+'개', '하루 1회 자동 · 최근 14개')
      + '</div>'

      + drvHTML()          /* ← 맨 위로 올림 (v88) — 아래에 묻혀 있어 못 찾으셨다 */

      + '<div style="background:#eef5fd;border:1.5px solid #bcd2ea;border-radius:12px;padding:13px 16px;margin-bottom:12px;font-size:12.5px;color:#1a2f45;line-height:1.7">'
      +   '<div style="font-size:13.5px;font-weight:900;margin-bottom:7px">☁️ 개인일지는 어디에 저장되나요?</div>'
      +   '<table style="width:100%;border-collapse:collapse;font-size:12.5px">'
      +     '<tr><td style="padding:4px 0;white-space:nowrap;color:#5b7794;width:120px">구글 클라우드</td>'
      +       '<td><b>Firebase / ' + esc(cloudInfo.project||'my-system-25497') + '</b> · <code style="background:#fff;padding:1px 6px;border-radius:5px">' + esc(cloudInfo.col||'personal_entries') + '</code>'
      +       '<div style="color:#0f7a4a;font-weight:800">✅ 폰 · PC · 태블릿 어디서 열어도 같은 내용입니다</div></td></tr>'
      +     '<tr><td style="padding:4px 0;white-space:nowrap;color:#5b7794">이 기기 사본</td>'
      +       '<td>브라우저 저장소 — 인터넷이 끊겨도 보고 쓸 수 있게 두는 <b>복사본</b>입니다<div style="color:#8ba0b6">다시 연결되면 클라우드와 맞춰집니다</div></td></tr>'
      +     '<tr><td style="padding:4px 0;white-space:nowrap;color:#5b7794">휴지통</td>'
      +       '<td>클라우드 <code style="background:#fff;padding:1px 6px;border-radius:5px">personal_trash</code> · <code style="background:#fff;padding:1px 6px;border-radius:5px">worklog_trash</code>'
      +       '<div style="color:#0f7a4a;font-weight:800">✅ 폰에서 지운 것도 PC에서 되살릴 수 있습니다</div></td></tr>'
      +     '<tr><td style="padding:4px 0;white-space:nowrap;color:#5b7794">스냅샷</td>'
      +       '<td><b style="color:#b26b00">이 기기에만</b> 있습니다 (브라우저 안)'
      +       '<div style="color:#8ba0b6">기기를 넘나드는 대비는 아래 <b>☁️ 구글 드라이브 자동 백업</b> 을 켜두세요</div></td></tr>'
      +   '</table>'
      +   '<div style="margin-top:9px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      +     '<button type="button" id="lfCloudChk" class="lf-radd" style="height:36px">🔍 클라우드 연결 확인</button>'
      +     '<span id="lfCloudNote" style="font-size:12px;font-weight:700;color:' + noteCol + '">' + noteTxt + '</span>'
      +   '</div>'
      + '</div>'

      + '<div style="background:#f0f9f4;border:1.5px solid #b7e4c7;border-radius:12px;padding:12px 15px;margin-bottom:14px;font-size:12.5px;color:#166534;line-height:1.65">'
      +   '<b>🛡 개인일지와 업무일지는 서로 완전히 분리돼 있어요.</b><br>'
      +   '· 클라우드 저장 칸이 다릅니다 — 한쪽에 문제가 생겨도 다른 쪽은 그대로예요<br>'
      +   '· 개인 기록은 업무 목록·달력·검색·백업·AI·구글 캘린더 어디에도 안 나옵니다<br>'
      +   '· 지운 것은 바로 없어지지 않고 <b>클라우드 휴지통에 90일</b> 보관됩니다 (어느 기기에서 지워도)<br>'
      +   '· 하루 한 번 <b>통째 스냅샷</b>을 이 기기에 남깁니다 (사진 포함, 용량 제한 없음)<br>'
      +   '· 하루/주 1회 <b>구글 드라이브</b>에 파일로 자동 백업합니다<br>'
      +   '· 기록이 갑자기 절반 이하로 줄면 저장 전에 한 번 물어봅니다'
      + '</div>'

      + '<div class="lf-bar">'
      +   '<button type="button" id="lfExpAll" class="lf-add" style="background:#0f7a4a">⬇ 전체 내려받기</button>'
      +   '<button type="button" id="lfExpP" class="lf-add" style="background:#3f7cb8">⬇ 개인일지만</button>'
      +   '<button type="button" id="lfImpOld" class="lf-add" style="height:40px;background:#7c3aed">📥 예전 개인일지 가져오기</button>'
      +   '<button type="button" id="lfImpP" class="lf-radd" style="height:40px">⬆ 파일에서 가져오기</button>'
      +   '<button type="button" id="lfSnapNow" class="lf-radd" style="height:40px">📸 지금 스냅샷</button>'
      +   '<input type="file" id="lfImpF" accept="application/json,.json" style="display:none">'
      + '</div>'

      + '<div style="font-size:13.5px;font-weight:900;color:#33567d;margin:16px 0 8px">🗑 휴지통 '
      +   '<span style="font-size:11.5px;font-weight:700;color:#0f7a4a">☁️ 클라우드 보관 — 폰에서 지운 것도 여기서 되살립니다</span></div>'
      + '<div class="lf-chips">'
      +   '<div class="lf-chip'+(safeSrc==='personal'?' on':'')+'" data-tsrc="personal"'+(safeSrc==='personal'?' style="background:#2563a8"':'')+'>🏠 개인일지 <b>'+((P_().trash('personal')||[]).length)+'</b></div>'
      +   '<div class="lf-chip'+(safeSrc==='worklog'?' on':'')+'" data-tsrc="worklog"'+(safeSrc==='worklog'?' style="background:#2563a8"':'')+'>📋 업무일지 <b>'+((P_().trash('worklog')||[]).length)+'</b></div>'
      +   (tr.length? '<div class="lf-chip" data-tclr="1" style="border-style:dashed;color:#b52929">비우기</div>':'')
      + '</div>'
      + '<div style="overflow-x:auto"><table class="lf-tbl"><tr><th>종류</th><th>내용</th><th>날짜</th><th>지운 때</th><th></th></tr>'+rows+'</table></div>'

      + '<div style="font-size:13.5px;font-weight:900;color:#33567d;margin:18px 0 8px">📸 스냅샷 (이 기기)</div>'
      + '<div style="overflow-x:auto"><table class="lf-tbl"><tr><th>대상</th><th>날짜</th><th>건수</th><th>언제</th><th></th></tr>'+snapRows+'</table></div>'
      + '<div style="font-size:11.5px;color:#a8b8c8;margin-top:8px;line-height:1.6">'
      +   '스냅샷은 이 브라우저 안(IndexedDB)에만 있습니다. 기기를 바꾸거나 브라우저 데이터를 지우면 사라지니,<br>'
      +   '중요한 시점에는 <b>⬇ 전체 내려받기</b> 로 파일을 따로 보관해 두세요.</div>';
  }

  /* ── 구글 드라이브 백업 칸 ── */
  function drvHTML(){
    var D=window.wlDrive; if(!D) return '';
    var c=D.cfg(), conn=D.connected();
    var last = c.lastAt ? (new Date(c.lastAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})) : '아직 없음';
    var freq = {daily:'매일 1회', weekly:'주 1회', off:'끔'}[c.every||'daily'];
    return '<div style="background:#fff8ec;border:1.5px solid #fcd9a0;border-radius:12px;padding:13px 16px;margin-bottom:14px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'
      +   '<div style="font-size:13.5px;font-weight:900;color:#8a5a00">☁️ 구글 드라이브 자동 백업</div>'
      +   '<div style="font-size:12px;font-weight:800;color:'+(c.on&&conn?'#0f7a4a':'#b26b00')+'">'
      +     (c.on&&conn ? '🟢 켜짐 · '+freq : (c.on ? '🟠 켜짐 (권한 다시 필요)' : '⚪ 꺼짐')) + '</div>'
      + '</div>'
      + '<div style="font-size:12.5px;color:#7a5a2a;line-height:1.65;margin-top:6px">'
      +   '내 구글 드라이브 <b>「'+esc('업무일지 백업')+'」</b> 폴더에 업무+개인 전체를 파일로 올립니다.<br>'
      +   '파이어베이스에 문제가 생겨도 이 파일로 되살릴 수 있어요. 최근 20개만 남기고 자동 정리합니다.<br>'
      +   '<b>마지막 백업:</b> '+esc(last)+(c.lastName?(' <span style="color:#a08050">'+esc(c.lastName)+'</span>'):'')
      + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">'
      +   '<button type="button" id="lfDrvOn" class="lf-add" style="height:38px;background:'+(c.on?'#b26b00':'#0f7a4a')+'">'
      +     (c.on?'⏸ 자동 백업 끄기':'▶ 자동 백업 켜기')+'</button>'
      +   '<select id="lfDrvEvery" class="lf-in" style="height:38px">'
      +     '<option value="daily"'+(c.every==='daily'?' selected':'')+'>매일 1회</option>'
      +     '<option value="weekly"'+(c.every==='weekly'?' selected':'')+'>주 1회</option>'
      +   '</select>'
      +   '<button type="button" id="lfDrvNow" class="lf-radd" style="height:38px">☁️ 지금 백업</button>'
      +   '<button type="button" id="lfDrvList" class="lf-radd" style="height:38px">📂 백업 목록</button>'
      + '</div>'
      + '<div id="lfDrvNote" style="font-size:12px;color:'+((_drvMsg&&_drvMsg.c)||'#8a7050')+';margin-top:7px">'
      +   ((_drvMsg&&_drvMsg.t)||'') + '</div>'
      + '</div>';
  }

  var _drvMsg=null;
  function drvNote(t,c,keep){
    _drvMsg = (t && keep) ? {t:t,c:c} : null;
    var e=document.getElementById('lfDrvNote'); if(e){ e.innerHTML=t; e.style.color=c||'#8a7050'; }
  }

  function bindDrive(){
    var D=window.wlDrive; if(!D) return;
    var b1=document.getElementById('lfDrvOn');
    if(b1) b1.addEventListener('click', function(){
      var c=D.cfg();
      if(c.on){
        if(!confirm('자동 백업을 끌까요?\n\n이미 올라간 파일은 그대로 남습니다.')) return;
        D.off(); render(); return;
      }
      drvNote('구글 권한 창을 여는 중… 계정을 고르고 [허용] 을 눌러주세요');
      D.auth(false).then(function(ok){
        if(!ok){ drvNote('❌ 권한을 못 받았어요 — 팝업 차단을 풀고 다시 시도해주세요','#c0392b'); return; }
        c=D.cfg(); c.on=true; D.save(c);
        drvNote('✅ 연결됐어요 — 첫 백업을 올리는 중…','#0f7a4a');
        D.upload().then(function(f){
          drvNote('✅ 백업 완료 — '+esc(f.name),'#0f7a4a',1);
          if(typeof toast==='function') toast('☁️ 구글 드라이브에 백업했어요');
          render();
        }).catch(function(e){ drvNote('⚠️ '+esc(e.message),'#c0392b',1); render(); });
      });
    });
    var sel=document.getElementById('lfDrvEvery');
    if(sel) sel.addEventListener('change', function(){ var c=D.cfg(); c.every=sel.value; D.save(c);
      if(typeof toast==='function') toast('백업 주기를 바꿨어요'); render(); });
    var b2=document.getElementById('lfDrvNow');
    if(b2) b2.addEventListener('click', function(){
      b2.disabled=true; drvNote('☁️ 올리는 중…');
      D.auth(false).then(function(ok){
        if(!ok){ b2.disabled=false; drvNote('❌ 권한을 못 받았어요','#c0392b'); return; }
        return D.upload().then(function(f){
          b2.disabled=false; drvNote('✅ 백업 완료 — '+esc(f.name),'#0f7a4a',1);
          if(typeof toast==='function') toast('☁️ 백업했어요'); render();
        });
      }).catch(function(e){ b2.disabled=false; drvNote('⚠️ '+esc(e.message),'#c0392b'); });
    });
    var b3=document.getElementById('lfDrvList');
    if(b3) b3.addEventListener('click', function(){
      drvNote('📂 목록을 불러오는 중…');
      D.auth(false).then(function(ok){
        if(!ok){ drvNote('❌ 권한을 못 받았어요','#c0392b'); return; }
        return D.list().then(function(fs){ drvNote(''); drvPop(fs); });
      }).catch(function(e){ drvNote('⚠️ '+esc(e.message),'#c0392b'); });
    });
  }

  /* 드라이브 백업 목록 창 */
  function drvPop(fs){
    var D=window.wlDrive;
    var rows = fs.length ? fs.map(function(f){
      var kb = f.size ? Math.round(f.size/1024) : 0;
      var d = f.createdTime ? new Date(f.createdTime).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
      return '<tr><td style="white-space:nowrap">'+esc(f.name)+'</td>'
        + '<td style="white-space:nowrap;color:#8ba0b6">'+esc(d)+'</td>'
        + '<td style="white-space:nowrap;color:#8ba0b6">'+esc(f.description||'')+'</td>'
        + '<td class="r" style="white-space:nowrap;color:#a8b8c8">'+(kb?won(kb)+'KB':'')+'</td>'
        + '<td class="r" style="white-space:nowrap">'
        +   '<button type="button" data-dvr="'+esc(f.id)+'" style="height:29px;padding:0 10px;border:1.5px solid #bcd2ea;border-radius:8px;background:#f0f6ff;color:#2563a8;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit">↩ 되살리기</button> '
        +   '<button type="button" data-dvd="'+esc(f.id)+'" style="height:29px;padding:0 9px;border:1.5px solid #f0d5d5;border-radius:8px;background:#fff;color:#b52929;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit">🗑</button></td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:#a8b8c8;padding:26px">백업 파일이 없어요</td></tr>';

    var ov=document.createElement('div'); ov.className='lf-ov';
    ov.innerHTML='<div class="lf-mod" style="max-width:860px">'
      + '<div class="lf-mh"><b>📂 구글 드라이브 백업 — '+fs.length+'개</b>'
      +   '<button type="button" id="lfDX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
      + '<div style="font-size:12.5px;color:#7a92a8;line-height:1.6;margin-bottom:10px">'
      +   '<b>↩ 되살리기</b> 는 <u>지금 없는 기록만</u> 다시 넣습니다. 지금 있는 것은 건드리지 않아요.</div>'
      + '<div style="max-height:52vh;overflow:auto"><table class="lf-tbl">'
      +   '<tr><th>파일</th><th>만든 때</th><th>내용</th><th class="r">크기</th><th></th></tr>'+rows+'</table></div>'
      + '<div id="lfDvNote" style="font-size:12.5px;color:#8ba0b6;margin-top:9px"></div>'
      + '<div class="lf-mbtn"><div style="flex:1"></div>'
      +   '<button type="button" id="lfDC" style="height:44px;padding:0 18px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cl(){ ov.remove(); }
    function note(t,c){ var e=document.getElementById('lfDvNote'); if(e){ e.textContent=t; e.style.color=c||'#8ba0b6'; } }
    document.getElementById('lfDX').addEventListener('click', cl);
    document.getElementById('lfDC').addEventListener('click', cl);
    ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });

    ov.querySelectorAll('[data-dvd]').forEach(function(b){
      b.addEventListener('click', function(){
        askDel('이 백업 파일을 지울까요?', '구글 드라이브에서 지웁니다').then(function(ok){
          if(!ok) return;
          note('지우는 중…');
          D.del(b.getAttribute('data-dvd')).then(function(){ cl(); D.list().then(drvPop); })
            .catch(function(e){ note('⚠️ '+e.message,'#c0392b'); });
        });
      });
    });
    ov.querySelectorAll('[data-dvr]').forEach(function(b){
      b.addEventListener('click', function(){
        note('📥 파일을 읽는 중…');
        D.get(b.getAttribute('data-dvr')).then(function(j){
          var pw=(j.personal&&j.personal.entries)||[], ww=(j.worklog&&j.worklog.entries)||[];
          var haveP={}; ent().forEach(function(e){ haveP[e.id]=1; });
          var missP=pw.filter(function(e){ return e&&e.id&&!haveP[e.id]; });
          var haveW={}; try{ entries.forEach(function(e){ haveW[e.id]=1; }); }catch(e){}
          var missW=ww.filter(function(e){ return e&&e.id&&!haveW[e.id]; });
          if(!missP.length && !missW.length){ note('✅ 없어진 기록이 없어요 — 지금이 백업보다 온전합니다','#0f7a4a'); return; }
          if(!confirm('되살릴 항목\n\n· 개인일지 '+missP.length+'건\n· 업무일지 '+missW.length+'건\n\n'
            +'지금 있는 기록은 그대로 두고, 없어진 것만 다시 넣습니다.\n진행할까요?')) { note(''); return; }
          missP.forEach(function(e){ try{ P_().restore(e); }catch(x){} });
          missW.forEach(function(e){ try{ if(typeof restoreRecord==='function') restoreRecord(e); }catch(x){} });
          cl();
          if(typeof toast==='function') toast('↩ 개인 '+missP.length+'건 · 업무 '+missW.length+'건 되살렸어요');
          try{ if(typeof renderAll==='function') renderAll(); }catch(e){}
          render();
        }).catch(function(e){ note('⚠️ '+e.message,'#c0392b'); });
      });
    });
  }

  function bindSafe(host){
    bindDrive();
    host.querySelectorAll('[data-tsrc]').forEach(function(b){
      b.addEventListener('click', function(){ safeSrc=b.getAttribute('data-tsrc'); render(); }); });
    var tc=host.querySelector('[data-tclr]');
    if(tc) tc.addEventListener('click', function(){
      askDel('휴지통을 비울까요?', '비우면 정말로 되살릴 수 없어요').then(function(ok){
        if(!ok) return;
        P_().trashClear(safeSrc); if(typeof toast==='function') toast('휴지통을 비웠어요'); render();
      }); });
    host.querySelectorAll('[data-trs]').forEach(function(b){
      b.addEventListener('click', function(){
        var ok=P_().trashRestore(safeSrc, parseInt(b.getAttribute('data-trs'),10));
        if(typeof toast==='function') toast(ok? '↩ 되살렸어요':'되살리기 실패');
        if(ok && safeSrc==='worklog'){ try{ if(typeof renderAll==='function') renderAll(); }catch(e){} }
        render(); }); });

    var cc=document.getElementById('lfCloudChk'), cn=document.getElementById('lfCloudNote');
    if(cc) cc.addEventListener('click', function(){
      cc.disabled=true; cc.textContent='🔍 확인 중…';
      if(cn){ cn.textContent='클라우드에 시험 저장 → 읽기 → 지우기 하는 중…'; cn.style.color='#8ba0b6'; }
      P_().selfTest().then(function(r){
        cc.disabled=false; cc.textContent='🔍 클라우드 연결 확인';
        if(!cn) return;
        if(r.write && r.read && r.del){
          cn.innerHTML='✅ <b>정상</b> — 저장·읽기·삭제 모두 됩니다. 폰에서도 같은 내용이 보입니다.';
          cn.style.color='#0f7a4a';
        } else if(!r.online){
          cn.innerHTML='🟡 지금 오프라인이라 확인할 수 없어요. 인터넷 연결 후 다시 눌러주세요.';
          cn.style.color='#b26b00';
        } else {
          cn.innerHTML='❌ <b>클라우드 저장이 막혀 있어요</b> ('+esc(r.err||'원인 불명')+')<br>'
            + '<span style="font-weight:600">지금은 이 기기에만 저장됩니다. Firebase 콘솔 → Firestore → 규칙에서 '
            + '<code>'+esc(r.col)+'</code> 컬렉션을 허용해 주세요.</span>';
          cn.style.color='#c0392b';
        }
      });
    });
    var io=document.getElementById('lfImpOld'); if(io) io.addEventListener('click', impPop);
    var ea=document.getElementById('lfExpAll'); if(ea) ea.addEventListener('click', function(){ P_().exportAll(); });
    var ep=document.getElementById('lfExpP');   if(ep) ep.addEventListener('click', function(){ P_().exportPersonal(); });
    var sn=document.getElementById('lfSnapNow');
    if(sn) sn.addEventListener('click', function(){
      sn.textContent='📸 저장 중…';
      P_().snapNow().then(function(){ if(typeof toast==='function') toast('📸 스냅샷을 남겼어요'); loadSnaps(true); }); });
    var ib=document.getElementById('lfImpP'), inp=document.getElementById('lfImpF');
    if(ib && inp){
      ib.addEventListener('click', function(){ inp.click(); });
      inp.addEventListener('change', function(){
        var f=inp.files&&inp.files[0]; if(!f) return;
        var fr=new FileReader();
        fr.onload=function(){
          try{
            var j=JSON.parse(fr.result);
            var mode=confirm('같은 기록이 이미 있으면 어떻게 할까요?\n\n[확인] 파일 내용으로 덮어쓰기\n[취소] 그대로 두고 새 것만 추가');
            var r=P_().importPersonal(j, mode?'overwrite':'skip');
            askInfo('가져오기 완료\n\n새로 추가 '+r.add+'건\n덮어씀 '+r.upd+'건\n(파일 안 '+r.total+'건)');
            render();
          }catch(e){ noteMsg('가져오기 실패: '+e.message); }
          inp.value='';
        };
        fr.readAsText(f);
      });
    }
    host.querySelectorAll('[data-snv]').forEach(function(b){
      b.addEventListener('click', function(){ snapView(b.getAttribute('data-snv')); }); });
    host.querySelectorAll('[data-snd]').forEach(function(b){
      b.addEventListener('click', function(){
        askDel('이 스냅샷을 지울까요?').then(function(ok){
          if(!ok) return;
          P_().snapDel(b.getAttribute('data-snd')).then(function(){ loadSnaps(true); });
        }); }); });
  }

  function loadSnaps(force){
    if(!P_() || snapsBusy) return;
    if(snapsLoaded && !force) return;
    snapsBusy=true;
    P_().snapList().then(function(a){
      var changed = force || (a||[]).length!==SNAPS.length;
      SNAPS=a||[]; snapsLoaded=true; snapsBusy=false;
      if(changed && cur==='safe') render();
    }).catch(function(){ snapsLoaded=true; snapsBusy=false; });
  }

  /* 스냅샷 열어보기 + 되살리기 */
  function snapView(k){
    P_().snapGet(k).then(function(arr){
      if(!arr){ noteMsg('스냅샷을 못 읽었어요'); return; }
      var isP = k.indexOf('personal')===0;
      var head = arr.slice(0,40).map(function(e){
        return '<tr><td style="white-space:nowrap;color:#8ba0b6">'+esc(e.date||'')+'</td>'
          + '<td>'+esc(e.title||e.name||e.detail||'(제목없음)').slice(0,50)+'</td>'
          + '<td style="white-space:nowrap;color:#a8b8c8">'+esc(e.ptype||e.kind||'')+'</td></tr>'; }).join('');
      var ov=document.createElement('div'); ov.className='lf-ov';
      ov.innerHTML='<div class="lf-mod" style="max-width:760px">'
        + '<div class="lf-mh"><b>📸 '+(isP?'개인일지':'업무일지')+' 스냅샷 — '+esc(k.split('|')[1]||'')+' · '+won(arr.length)+'건</b>'
        +   '<button type="button" id="lfSX" style="border:none;background:none;font-size:21px;color:#94a3b8;cursor:pointer">✕</button></div>'
        + '<div style="font-size:12.5px;color:#7a92a8;line-height:1.6;margin-bottom:10px">'
        +   '앞 40건만 보여줍니다. <b>지금 없는 기록만 되살리기</b> 는 현재 기록을 건드리지 않고, '
        +   '스냅샷에만 있는 것을 다시 넣습니다. 안전합니다.</div>'
        + '<div style="max-height:46vh;overflow-y:auto"><table class="lf-tbl">'+head+'</table></div>'
        + '<div class="lf-mbtn">'
        +   '<button type="button" id="lfSDl" class="lf-radd" style="height:44px">⬇ 파일로 내려받기</button>'
        +   '<div style="flex:1"></div>'
        +   (isP? '<button type="button" id="lfSRes" style="height:44px;padding:0 20px;border:none;border-radius:10px;background:#0f7a4a;color:#fff;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit">↩ 지금 없는 기록만 되살리기</button>':'')
        +   '<button type="button" id="lfSC" style="height:44px;padding:0 18px;border:1.5px solid #dbe6f4;border-radius:10px;background:#fff;color:#7a92a8;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>'
        + '</div></div>';
      document.body.appendChild(ov);
      function cl(){ ov.remove(); }
      document.getElementById('lfSX').addEventListener('click', cl);
      document.getElementById('lfSC').addEventListener('click', cl);
      ov.addEventListener('mousedown', function(e){ if(e.target===ov) cl(); });
      document.getElementById('lfSDl').addEventListener('click', function(){
        try{
          var b=new Blob([JSON.stringify(arr,null,2)],{type:'application/json'});
          var u=URL.createObjectURL(b), a=document.createElement('a');
          a.href=u; a.download=k.replace(/\|/g,'_')+'.json'; document.body.appendChild(a); a.click();
          setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); },1500);
        }catch(e){ noteMsg('내려받기 실패: '+e); }
      });
      var rs=document.getElementById('lfSRes');
      if(rs) rs.addEventListener('click', function(){
        var have={}; ent().forEach(function(e){ have[e.id]=1; });
        var miss=arr.filter(function(e){ return e && e.id && !have[e.id]; });
        if(!miss.length){ noteMsg('없어진 기록이 없어요 — 지금 목록이 스냅샷보다 온전합니다'); return; }
        if(!confirm(miss.length+'건을 되살릴까요?\n\n지금 있는 기록은 그대로 두고, 없어진 것만 다시 넣습니다.')) return;
        miss.forEach(function(e){ try{ P_().restore(e); }catch(x){} });
        cl(); if(typeof toast==='function') toast('↩ '+miss.length+'건을 되살렸어요');
        render();
      });
    });
  }

  /* ── 차량 · 분류 관리 ── */
  function mgrCars(){
    var a=cars(), fm=fuelMap();
    var cur='현재 차량: '+a.map(function(c){return c.n;}).join(', ')+'\n'
      + '유종 자동 연결: '+Object.keys(fm).filter(function(k){return fm[k];}).map(function(k){return k+'\u2192'+fm[k];}).join(', ');
    askText('차량 관리', '', { ph:'차 이름',
      sub:'새 이름 → 추가 · 있는 이름 → 삭제 · 「유종」 → 유종 연결 고치기\n'+cur }).then(function(n){
      if(!n) return; n=String(n).trim(); if(!n) return;
      if(n==='유종'||n==='연료'){ mgrFuelMap(); return; }
      var i=-1; a.forEach(function(c,j){ if(c.n===n) i=j; });
      if(i>=0){
        askDel('"'+n+'" 차량을 목록에서 뺄까요?', '기록은 그대로 남아요').then(function(ok){
          if(!ok) return;
          a.splice(i,1); if(curCar===n) curCar=(a[0]||{}).n||'';
          carsSave(a); render();
        });
        return;
      }
      a.push({n:n, c:CARPOOL[a.length % CARPOOL.length]});
      carsSave(a); render();
    });
  }
  /* 유종 ↔ 차량 연결 고치기 */
  function mgrFuelMap(){
    var m=fuelMap(), a=cars(), names=a.map(function(c){return c.n;});
    var keys=['LPG','휘발유','고급휘발유','경유','전기'];
    var out={}; var changed=false;
    /* v239 — 팝업은 기다렸다 답을 주므로 for 문 대신 한 칸씩 되풀이한다 */
    (function step(i){
      if(i >= keys.length){
        fuelMapSave(out);
        if(typeof toast==='function') toast('⛽ 유종 연결을 저장했어요');
        render(); return;
      }
      var k=keys[i];
      askText('['+(i+1)+'/'+keys.length+'] "'+k+'" 로 주유하면 어느 차인가요?', m[k]||'',
        { sub:'차량: '+names.join(', ')+' · 비워두면 자동 연결 안 함', ph:'차 이름', ok:'다음' })
      .then(function(v){
        if(v===null){ if(changed) fuelMapSave(out); return; }
        v=String(v).trim();
        if(v && names.indexOf(v)<0){
          if(typeof toast==='function') toast('"'+v+'" 는 등록된 차가 아니에요 — 건너뜁니다');
          v='';
        }
        out[k]=v; if(v!==(m[k]||'')) changed=true;
        step(i+1);
      });
    })(0);
  }

  function mgrCtCats(){
    var a=ctCats();
    askText('연락처 분류 관리', '', { ph:'분류 이름',
      sub:'새 이름 → 추가 · 있는 이름 → 삭제\n현재: '+a.join(', ') }).then(function(n){
      if(!n) return; n=String(n).trim(); if(!n) return;
      var i=a.indexOf(n);
      if(i>=0){
        askDel('"'+n+'" 분류를 지울까요?', '연락처는 그대로 남아요').then(function(ok){
          if(!ok) return;
          a.splice(i,1); if(curCat===n) curCat='전체';
          lsSet(LS_CTC,a); render();
        });
        return;
      }
      a.push(n); lsSet(LS_CTC,a); render();
    });
  }

  /* ══════ 렌더 ══════ */
  var TABS=[['rec','📋 기록'],['car','🚗 차계부'],['ct','📞 연락처'],['stat','📊 결산'],['safe','🛟 안전']];

  function render(){
    var host=document.getElementById(HOST_ID); if(!host) return;
    /* 안 쓰는 화면은 비운다 — 같은 id 가 두 곳에 있으면 버튼·검색이 안 먹는다 */
    try{
      var other=document.getElementById(HOST_ID==='lifeHost' ? 'dataHost' : 'lifeHost');
      if(other && other.innerHTML) other.innerHTML='';
    }catch(e){}
    if(!isPersonal()) return renderDS(host);
    var body = cur==='car'  ? viewCar()
             : cur==='ct'   ? viewCt()
             : cur==='stat' ? viewSum()
             : cur==='safe' ? viewSafe()
             : viewRec();

    /* ══ v233 — 달님 : 「최대한 줄을 줄여 두 줄로. 크기도 줄이고」 ══
       예전엔 머리말 / 하위탭 / 분류칩+검색 / 도구줄 = 네 줄이었다.
       ① 이 한 줄  : 🏠 개인 · 하위탭 5개 · 검색 · 🗃 업무일지 · 🧪
       ② 아래 도구줄 : 분류 고르개 · 보기 · 날짜 · 묶기 · ➕ 기록 추가 · ⚙ · 건수
       🔴 검색칸(lfQ)은 「📋 기록」일 때만 여기 둔다.
          차계부·연락처는 자기 화면에 lfQ 가 따로 있어, 여기도 두면 같은 id 가 둘이 된다 (지침 ⑮). */
    host.innerHTML =
      '<div class="lf-wrap">'
      + '<div class="lf-phead">'
      +   '<div class="lf-ptitle">'
      +     (cur==='safe' ? '🛟 안전' : '🏠 개인') + '</div>'
      /* 🔴 하위탭은 어느 화면에서나 늘 그린다.
         v233 처음 판에서 🛟 안전일 때만 빼 봤더니 그 화면에서 다른 탭으로 못 갔다.
         「← 개인 기록으로」 단추는 📋 기록 탭이 대신하므로 없앤다. */
      +   '<div class="lf-tabs lf-ptabs">' + TABS.map(function(t){
            return '<button type="button" class="lf-tab'+(t[0]===cur?' on':'')+'" data-lt="'+t[0]+'">'+t[1]+'</button>'; }).join('')
      +   '</div>'
      +   (cur==='rec' ? catChipsP() : '')
      +   (cur==='rec'
             ? '<input type="text" id="lfQ" class="lf-in lf-pq" placeholder="🔍 검색" value="'+esc(curQ)+'">'
             : '<span style="flex:1 1 auto"></span>')
      +   (cur==='safe' ? '<span class="lf-pnote">업무일지 · 개인일지 모두</span>' : '')
      /* v234 — 분류 칩이 한 줄에 들어가도록 그림만 (마우스를 올리면 이름) */
      +   '<button type="button" id="lfGoData" class="lf-pbtn" title="🗃 업무일지 화면으로">🗃</button>'
      +   '<button type="button" id="lfSeedBtn" class="lf-pbtn dash" title="맛보기 샘플 넣기 · 지우기">🧪</button>'
      + '</div>'
      + body + '</div>';
    bindRender(host);
  }

  /* ══════ 📊 업무일지 데이터 화면 ══════
     개인일지와 똑같은 엔진(표·보드·달력·페이지·속성추가·필터·수식·롤업)을
     업무일지 종류(업무/지출/사고/…)에 그대로 붙인다. */
  /* v193 — 달님 : 「오늘 계획을 업무 왼쪽에, 사이트는 업무 오른쪽으로」 */
  /* 🗃 데이터 탭의 칩 차례. WORK_KINDS 에 있어도 여기 없으면 칩이 안 나온다 (v206에서 걸림) */
  var DS_ORDER = ['plan','work','site','expense','accident','progress','call','memo',
                  'schedule','deliver','meeting','vacation','item','stock','cleaning'];

  /* v168 — 맨 앞에 「🏠 개인」 을 넣었다.
     윗줄(기록·개인·데이터…)을 없애도 이 줄 하나로 개인 ↔ 업무를 오갈 수 있다. */
  /* v225 — 달님 : 「종류 칩 16개가 두 줄을 먹는다」
     기록이 많은 종류 7개 + 지금 보고 있는 것만 보이고, 나머지는 「⋯」 로 접는다.
     🔴 차례(DS_ORDER)는 그대로 둔다 — 자리가 바뀌면 손이 헷갈린다. */
  var LS_DSMORE = 'wl_ds_more';
  var DS_TOP_N  = 7;
  /* ══ v232 — 달님 : 「업무 화면 종류 칩도 접힘이 기본」 ══
     코드 기본값은 원래부터 접힘(false) 이었다. 그런데 「⋯ 8개 더」 를 한 번 누르면
     그 값이 기기에 남아, 그 뒤로는 늘 펼쳐진 채로 열렸다.
     → 이 판으로 올라올 때 딱 한 번만 접어 준다.
       그 뒤에 다시 펼치시면 그 선택은 그대로 지킨다 (다시 강제로 접지 않는다).
     되돌리기: localStorage.removeItem('wl_ds_more_r232')  ← 다음에 열 때 한 번 더 접힘 */
  try{
    if(localStorage.getItem('wl_ds_more_r232') !== '1'){
      localStorage.setItem('wl_ds_more_r232','1');
      lsSet(LS_DSMORE, false);
      console.log('[종류 칩] 접힘을 기본으로 되돌렸어요 — 「⋯ 더」 를 누르면 다시 다 보입니다');
    }
  }catch(e){ console.warn('[종류 칩] 기본값 되돌리기 실패', e); }
  /* v226 - 달님 : 「접었을 때 이 일곱은 늘 보이게」
     기록 수로 뽑으면 그날그날 자리가 바뀌어 손이 헷갈렸다 - 붙박이로 고정한다.
     차례는 DS_ORDER 를 따른다. */
  var DS_KEEP = ['plan','work','site','expense','accident','progress','memo'];
  function dsMore(){ try{ return !!lsGet(LS_DSMORE, false); }catch(e){ return false; } }
  function dsMoreSet(v){ lsSet(LS_DSMORE, !!v); safeRender(); }
  function dsCounts(){
    var c = {};
    try{ (entries||[]).forEach(function(e){ if(e && e.kind) c[e.kind] = (c[e.kind]||0) + 1; }); }
    catch(e){ console.warn('[종류 칩] 세기 실패', e); }
    return c;
  }

  function dsChips(){
    var cw = (typeof WORK_KINDS==='object') ? WORK_KINDS : {};
    var more = dsMore();
    /* 접혀 있을 때 보일 것 고르기 — 기록이 많은 차례로 7개 + 지금 보는 것 */
    var keep = {};
    if(!more){
      DS_KEEP.forEach(function(k){ keep[k] = 1; });
      try{ if(DS && DS.kind) keep[DS.kind] = 1; }catch(e){}
    }
    var hidden = 0;
    var h = '<div class="lf-tabs lf-dstabs lf-phcats">';
    h += '<button type="button" class="lf-tab'+(isPersonal()?' on':'')+'" data-dsk="personal"'
       + ' title="개인일지 — 업무일지와 따로 저장됩니다">🏠 개인</button>'
       + '<span style="display:inline-block;width:1px;height:22px;background:#dbe6f4;margin:0 6px;vertical-align:middle"></span>';
    DS_ORDER.forEach(function(k){
      var m = cw[k]; if(!m) return;
      if(!more && !keep[k]){ hidden++; return; }
      var on = (DS && DS.key==='work:'+k);
      h += '<button type="button" class="lf-tab'+(on?' on':'')+'" data-dsk="'+k+'">'+m.i+' '+m.n+'</button>';
    });
    if(more || hidden){
      h += '<button type="button" class="lf-tab" data-dsmore="1"'
         + ' title="' + (more ? '자주 쓰는 것만 보기' : '나머지 종류도 보기') + '"'
         + ' style="color:#8ba0b6">' + (more ? '\u25B4 접기' : ('\u22EF ' + hidden + '개 더')) + '</button>';
    }
    h += '</div>';
    return h;
  }

  /* 예전에 빈 채로 저장된 기록이 있으면 한 번에 정리할 수 있게 */
  function blankList(){
    var out=[];
    try{ ent().filter(DS.mine).forEach(function(e){ if(isBlank(e)) out.push(e.id); }); }catch(err){}
    return out;
  }
  function blankBar(){
    var n=0; try{ n=blankList().length; }catch(e){}
    if(!n) return '';
    return '<div id="lfBlankBar" style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;'
      + 'background:#fffbea;border:1.5px solid #f3e3b3;border-radius:11px;padding:9px 13px;margin-bottom:10px">'
      + '<b style="font-size:13px;color:#8a6d1f">🧹 아무것도 안 적힌 기록이 '+n+'건 있어요</b>'
      + '<span style="font-size:11.5px;color:#b59a5c;flex:1;min-width:120px">실수로 만들어진 빈 껍데기예요 · 지워도 다른 기록은 그대로예요</span>'
      + '<button type="button" id="lfBlankGo" class="lf-fx" style="border-color:#e0c98a;color:#8a6d1f">한 번에 정리</button>'
      + '<button type="button" id="lfBlankNo" class="lf-fx">나중에</button>'
      + '</div>';
  }

  function renderDS(host){
    /* v170 — 머리말 건수를 「목록에 실제로 나오는 수」로 맞춘다.
       예전에는 하위 항목까지 세어서, 아래 목록보다 머리말이 더 커 보였다. */
    var cnt = 0, sub = 0;
    try{
      var mineAll = ent().filter(DS.mine);
      cnt = mineAll.filter(function(e){ return !e.parentId; }).length;
      sub = mineAll.length - cnt;
      if(showSub()){ cnt = mineAll.length; sub = 0; }
    }catch(e){}
    /* ══ v235 — 달님 : 「업무도 개인처럼」 ══
       예전엔 머리말 / 종류 칩 / 도구줄 = 세 줄이었다. 개인과 똑같이 두 줄로 맞춘다.
       ① 이 한 줄  : 🛠 업무 527 · | · 종류 칩 (넘치면 그 줄만 옆으로 밀림)
       ② 아래 도구줄
       - 「🏠 개인일지」 단추는 뺐다 — 칩 줄 맨 앞의 「🏠 개인」 이 같은 일을 한다
       - 「기록 탭과 같은 데이터…」 안내글은 제목 도움말(title)로 옮겼다 */
    host.innerHTML =
      '<div class="lf-wrap">'
      + '<div class="lf-phead">'
      +   '<div class="lf-ptitle" title="기록 탭과 같은 데이터 · 보는 방식만 다릅니다">'
      +     DS.icon+' '+DS.name+' <span class="lf-pn">'+cnt+'</span></div>'
      +   (sub? '<span class="lf-psub" title="⚙ 안의 「하위 항목도」 를 켜면 함께 보입니다">하위 '+sub+'</span>' : '')
      /* v179 — 목록 부분만 따로 감쌌다. 「지출 관리 보기」 에서 이 구역만 접는다 (종류 칩은 남긴다) */
      +   dsChips()
      + '</div>'
      + '<div id="dsListZone">' + viewRec() + '</div>' + '</div>';
    bindRender(host);
    var g = host.querySelector('#dsGoLife');
    if(g) g.addEventListener('click', function(){ window.wlOpenData('personal'); });
  }

  /* v169 — 위 「💸 개인 지출 / 📃 세금계산서」 요약 카드를 누르면 부른다.
     지출 화면으로 가서 그 종류만 걸러 본다. 같은 걸 다시 누르면 풀린다.
     위 카드와 아래 목록이 늘 같은 것을 보게 하려는 장치다. */
  window.wlExpFilter = function(expType){
    var PID='f:expType';
    try{
      window.wlOpenData('expense');
      setTimeout(function(){
        try{
          var pt = (curCat!=='전체' ? curCat : '');
          var cur0 = colfOf(pt)[PID];
          var same = !!(cur0 && Array.isArray(cur0.vals) && cur0.vals.length===1 && cur0.vals[0]===expType);
          var m = null;
          if(!same){ m={}; m[PID]={vals:[expType]}; }
          colfSave(pt, m);                       /* 다른 거르개는 함께 걷어낸다 */
          safeRender();
          if(typeof toast==='function') toast(same? '거르개를 풀었어요' : '「'+expType+'」 만 보여드려요');
        }catch(e2){ console.error('[지출 거르기]', e2); }
      }, 240);
    }catch(e){ console.error('[지출 거르기]', e); }
  };
  /* 지금 걸려 있는 지출종류 — 요약 카드가 자기가 켜졌는지 알려고 묻는다 */
  window.wlExpFilterNow = function(){
    try{
      if(isPersonal() || !DS || DS.key!=='work:expense') return '';
      var pt = (curCat!=='전체' ? curCat : '');
      var c = colfOf(pt)['f:expType'];
      return (c && Array.isArray(c.vals) && c.vals.length===1) ? String(c.vals[0]) : '';
    }catch(e){ return ''; }
  };

  /* 개인 ↔ 업무 데이터셋 전환 */
  window.wlOpenData = function(kind){
    try{
      /* 예전 버전이 따옴표째 저장해 둔 값이 있을 수 있다 — 씻어서 받는다 */
      kind = String(kind==null?'':kind).replace(/^["'\\]+|["'\\]+$/g,'').trim();
      if(kind && kind!=='personal' && !(typeof WORK_KINDS==='object' && WORK_KINDS[kind])) kind='work';
      if(!kind || kind==='personal'){
        DS = DS_PERSONAL; HOST_ID='lifeHost'; cur='rec';
        try{ if(typeof window.v43ActivateTab==='function') window.v43ActivateTab('life'); }catch(e){}
      } else {
        DS = dsWork(kind); HOST_ID='dataHost'; cur='rec';
        try{ localStorage.setItem('wl_ds_last', kind); }catch(e){}
        try{ if(typeof window.v43ActivateTab==='function') window.v43ActivateTab('data'); }catch(e){}
      }
      curQ=''; curCat='전체'; EDIT=null; curView='';
      try{ var _ov=document.getElementById('lfPageOv'); if(_ov) _ov.classList.remove('on'); }catch(e){}
      /* ⭐ 첫 화면으로 지정한 보기가 있으면 그걸로 시작 */
      try{ applyFav(''); }catch(e){}
      setTimeout(render, 60);
    }catch(e){ console.error('[데이터셋]', e); }
  };

  function bindRender(host){

    /* v168 — 종류 칩(🏠 개인 + 업무 14종). 개인 화면·데이터 화면 양쪽에서 먹는다 */
    host.querySelectorAll('[data-dsk]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        try{ window.wlOpenData(b.getAttribute('data-dsk')); }
        catch(err){ console.error('[데이터셋]', err); }
      });
    });

    /* 하위 탭 */
    host.querySelectorAll('[data-lt]').forEach(function(b){
      b.addEventListener('click', function(){
        cur=b.getAttribute('data-lt'); curQ=''; curCat='전체'; EDIT=null;
        lsSet(LS_TAB,cur); render();
      });
    });
    /* 칩 */
    host.querySelectorAll('[data-lc]').forEach(function(b){
      b.addEventListener('click', function(){ curCat=b.getAttribute('data-lc'); lsSet(LS_CAT,curCat); EDIT=null; render(); }); });
    host.querySelectorAll('[data-lcar]').forEach(function(b){
      b.addEventListener('click', function(){ curCar=b.getAttribute('data-lcar'); lsSet(LS_CAR,curCar); render(); }); });
    var cm=host.querySelector('[data-lcarmgr]'); if(cm) cm.addEventListener('click', mgrCars);
    if(cur==='safe'){
      bindSafe(host); loadSnaps(false);
      if(!window._lfTSynced){ window._lfTSynced=true;
        try{ P_().trashSync().then(function(ch){ if(ch && cur==='safe') render(); }); }catch(e){} }
    }
    var tm=host.querySelector('[data-lctmgr]'); if(tm) tm.addEventListener('click', mgrCtCats);
    var ta=host.querySelector('[data-lctauto]'); if(ta) ta.addEventListener('click', function(){
      lsSet(LS_AUTOCT, !autoCtOn());
      if(typeof toast==='function') toast(autoCtOn()? '\uba85\ud568\uc744 \uace0\ub974\uba74 \uc5f0\ub77d\ucc98\uc5d0 \uc790\ub3d9 \uc800\uc7a5\ub3fc\uc694' : '\uba85\ud568 \uc790\ub3d9 \uc800\uc7a5\uc744 \uaebc\ub450\uc5c8\uc5b4\uc694');
      render(); });
    var br=document.getElementById('lfBackRec');
    if(br) br.addEventListener('click', function(){ cur='rec'; lsSet(LS_TAB,'rec'); render(); });
    var gd=document.getElementById('lfGoData');
    if(gd) gd.addEventListener('click', function(){
      var last='work';
      try{ last=String(localStorage.getItem('wl_ds_last')||'work').replace(/^["'\\]+|["'\\]+$/g,'').trim()||'work'; }catch(e){}
      if(!/^[a-z]{2,12}$/.test(last)) last='work';
      try{ window.wlOpenData(last); }catch(e){ console.error('[업무일지로]', e); }
    });
    var sb=document.getElementById('lfSeedBtn');
    if(sb) sb.addEventListener('click', function(){
      var has = ent().some(function(e){ return e.sample && (e.kind==='personal'||e.kind==='pcontact'); });
      if(has){ if(confirm('샘플 데이터를 지울까요?\n(직접 넣은 기록은 그대로 남아요)')) window.wlLifeSeedClear(); }
      else   { if(confirm('맛보기 샘플 데이터를 넣을까요?\n(차계부·맛집·구매·연락처 등 26건)')) window.wlLifeSeed(); }
    });

    /* 추가 버튼 */
    var ob=document.getElementById('lfOldGo'); if(ob) ob.addEventListener('click', impPop);
    var on2=document.getElementById('lfOldNo');
    if(on2) on2.addEventListener('click', function(){
      try{ localStorage.setItem(LS_OLDBN,'off'); }catch(e){}
      var el=document.getElementById('lfOldBn'); if(el) el.remove(); });
    var a1=document.getElementById('lfAdd');    if(a1) a1.addEventListener('click', function(){
      if(!isPersonal()){ newRow(DS.kind, null, true); return; }
      if(curCat!=='전체' && cats()[curCat]) openRec(curCat); else openCatSheet(); });
    var tb=document.getElementById('lfTpl');  if(tb) tb.addEventListener('click', function(){
      tplPick((cur==='car')?'car':(curCat!=='전체'?curCat:'')); });
    var vb=document.getElementById('lfVend'); if(vb) vb.addEventListener('click', function(){ vendorPick(); });
    var sm=document.getElementById('lfSubMgr');
    if(sm) sm.addEventListener('click', function(){
      try{ if(window.wlExpSubs && window.wlExpSubs.manage) window.wlExpSubs.manage('선납부');
           else noteMsg('하위 구분 관리를 못 불러왔어요 — worklog.js 를 올렸는지 확인해 주세요'); }
      catch(e){ console.error('[하위 구분 관리]', e); noteMsg('오류: '+(e.message||e)); }
    });
    var a2=document.getElementById('lfAddCar'); if(a2) a2.addEventListener('click', function(){ openRec('car'); });
    var a3=document.getElementById('lfAddCt');  if(a3) a3.addEventListener('click', function(){ openCt(); });

    /* 필터 */
    host.querySelectorAll('[data-vw]').forEach(function(b){
      b.addEventListener('click', function(){ vwSet(b.getAttribute('data-vw')); }); });
    /* 목록 정렬 헤더 */
    host.querySelectorAll('[data-srt]').forEach(function(t){
      t.addEventListener('click', function(ev){
        if(ev.target.closest('[data-colf],[data-thrs]')) return;   /* ▾·폭조절은 정렬 아님 */
        srtSet(t.getAttribute('data-srt')); }); });
    /* ▾ 칸 거르개 */
    var ptCF = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    host.querySelectorAll('[data-colf]').forEach(function(b){
      b.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
      b.addEventListener('click', function(ev){
        ev.preventDefault(); ev.stopPropagation();
        colfOpen(b.getAttribute('data-colf'), ptCF, b);
      });
    });
    host.querySelectorAll('[data-cfdrop]').forEach(function(b){
      b.addEventListener('click', function(){ colfSet(ptCF, b.getAttribute('data-cfdrop'), null); }); });
    host.querySelectorAll('[data-cfall]').forEach(function(b){
      b.addEventListener('click', function(){ colfClear(ptCF); }); });
    var cfb=document.getElementById('lfColF');
    if(cfb) cfb.addEventListener('click', function(ev){ ev.stopPropagation(); colfPick(ptCF, cfb); });
    var fpb=document.getElementById('lfFpop');   /* v163 — 걸린 조건 펼쳐보기 */
    if(fpb) fpb.addEventListener('click', function(ev){ ev.stopPropagation(); fltPop(ptCF, fpb); });
    /* ── 📅 「N일 전」 칸 · 「~오늘」 (v167 — 칩 줄은 없앴다) ── */
    var dn=document.getElementById('lfDayN');
    if(dn && !dn._bound){
      dn._bound = true;
      var applyN = function(){
        var v=String(dn.value||'').trim();
        if(v===''){ if(flt.from||flt.to) fltSet({from:'', to:''}); return; }
        var n=parseInt(v,10);
        if(isNaN(n) || n<0 || n>3650) return;
        applyDayN(n);
      };
      dn.addEventListener('change', applyN);
      dn.addEventListener('keydown', function(ev){
        if(ev.key==='Enter'){ ev.preventDefault(); applyN(); } });
    }
    var drg=document.getElementById('lfDayRng');
    if(drg) drg.addEventListener('change', function(){
      lsSet(LS_DRNG, drg.checked?'1':'0');
      var v=String((document.getElementById('lfDayN')||{}).value||'').trim();
      var n=parseInt(v,10);
      if(v!=='' && !isNaN(n) && n>=0 && n<=3650) applyDayN(n);
      else safeRender();
    });
    var dcl=document.getElementById('lfDayClr');
    if(dcl) dcl.addEventListener('click', function(ev){
      ev.stopPropagation(); fltSet({from:'', to:''}); });

    /* ── 🛠 도구 (v171) — 탭 1행 없이도 가는 길 ── */
    host.querySelectorAll('[data-gotab]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        try{
          if(typeof window.v43ActivateTab==='function') window.v43ActivateTab(b.getAttribute('data-gotab'));
          else toast('그 화면을 열지 못했어요');
        }catch(err){ console.error('[도구]', err); toast('오류: '+(err.message||err)); }
      });
    });
    var thb=document.getElementById('lfTabHide');
    if(thb) thb.addEventListener('click', function(ev){
      ev.stopPropagation();
      try{
        if(window.wlTabHide && window.wlTabHide.panel) window.wlTabHide.panel();
        else toast('탭 숨기기 창을 열지 못했어요');
      }catch(err){ console.error('[탭 숨기기]', err); toast('오류: '+(err.message||err)); }
    });
    var clnb=document.getElementById('lfClnNew');
    if(clnb) clnb.addEventListener('click', function(ev){
      ev.stopPropagation();
      try{
        if(typeof window.openCleaningEditor==='function') window.openCleaningEditor(null);
        else if(typeof openCleaningEditor==='function') openCleaningEditor(null);
        else toast('청소일지 창을 열지 못했어요 — 📅 달력에서 열어 주세요');
      }catch(err){ console.error('[청소일지]', err); toast('오류: '+(err.message||err)); }
    });
    /* v188 — 복사는 한 곳에서만 한다. 단추는 둘(⚙ 도구 안 · 잘 보이는 줄) */
    function doCopyXls(ev){
      if(ev) ev.stopPropagation();
      try{
        /* 기록 탭의 기간 칸에 지금 걸린 기간을 넣고 원래 복사 함수를 그대로 쓴다 */
        var f=document.getElementById('v43From'), t=document.getElementById('v43To');
        if(f) f.value = flt.from || '';
        if(t) t.value = flt.to   || '';
        if(typeof window.v43CopyWorkExcel==='function') window.v43CopyWorkExcel();
        else if(typeof v43CopyWorkExcel==='function') v43CopyWorkExcel();
        else toast('복사 기능을 찾지 못했어요');
      }catch(err){ console.error('[복사]', err); toast('오류: '+(err.message||err)); }
    }
    ['lfCopyXls','lfCopyXls2'].forEach(function(cid){
      var b=document.getElementById(cid);
      if(b && !b._cxBound){ b._cxBound=1; b.addEventListener('click', doCopyXls); }
    });
    host.querySelectorAll('[data-expsub]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        var which=b.getAttribute('data-expsub');
        try{
          if(typeof window.v43ActivateTab==='function') window.v43ActivateTab('expense');
          setTimeout(function(){
            var el=document.getElementById(which==='meal'?'expSubTabMeal':'expSubTabLabor');
            if(el) el.click(); else toast('그 화면을 못 찾았어요');
          }, 320);
        }catch(err){ console.error('[지출 하위]', err); toast('오류: '+(err.message||err)); }
      });
    });

    /* ── 🔁 정기점검 · 📅 반복업무 펼치기 (v166) ── */
    host.querySelectorAll('[data-panel]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        var v=b.getAttribute('data-panel');
        panelOpen = (panelOpen===v)? '' : v;      /* 둘 중 하나만 열린다 */
        lsSet(LS_PANEL, panelOpen);
        safeRender();
      });
    });
    host.querySelectorAll('[data-ckdone]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        var id=b.getAttribute('data-ckdone');
        if(!confirm('오늘 점검한 것으로 넘길까요?\n다음 회차가 오늘부터 다시 계산됩니다.')) return;
        try{
          var ok = (window.wlChk && window.wlChk.doneNow) ? window.wlChk.doneNow(id) : false;
          if(ok){ toast('✅ 완료로 넘겼어요'); setTimeout(function(){
                    try{ if(window.wlChk && window.wlChk.render) window.wlChk.render(); }catch(e){}
                    safeRender(); }, 260); }
          else toast('완료 처리를 못 했어요');
        }catch(err){ console.error('[정기점검]', err); toast('오류: '+(err.message||err)); }
      });
    });
    host.querySelectorAll('[data-rcchk]').forEach(function(b){
      b.addEventListener('click', function(ev){ ev.stopPropagation(); });
      b.addEventListener('change', function(){
        var id=b.getAttribute('data-rcchk');
        try{
          var R=window.wlRecur;
          if(R && R.toggle){ R.toggle(id, b.checked);
            setTimeout(function(){
              try{ if(R.render) R.render(); }catch(e){}
              safeRender(); }, 260); }
          else toast('반복업무를 고치지 못했어요 — 기록 탭에서 해 주세요');
        }catch(err){ console.error('[반복업무]', err); toast('오류: '+(err.message||err)); }
      });
    });
    host.querySelectorAll('[data-ckmgr]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        try{ if(window.wlChk && window.wlChk.mgr) window.wlChk.mgr();
             else toast('정기점검 창을 열지 못했어요 — 기록 탭에서 열어 주세요'); }
        catch(err){ console.error('[정기점검]', err); toast('오류: '+(err.message||err)); }
      });
    });
    host.querySelectorAll('[data-rcmgr]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        try{ if(typeof window.openRecurManage==='function') window.openRecurManage();
             else toast('반복업무 창을 열지 못했어요 — 기록 탭에서 열어 주세요'); }
        catch(err){ console.error('[반복업무]', err); toast('오류: '+(err.message||err)); }
      });
    });
    /* ⚙ 그 밖의 도구 */
    var mb=document.getElementById('lfMoreBtn'), mw=document.getElementById('lfMore');
    if(mb && mw){
      mb.addEventListener('click', function(ev){ ev.stopPropagation(); mw.classList.toggle('on'); });
      mw.addEventListener('click', function(ev){ ev.stopPropagation(); });
      if(!window._lfMoreBound){
        window._lfMoreBound = true;
        document.addEventListener('click', function(){
          document.querySelectorAll('.lf-more.on').forEach(function(x){ x.classList.remove('on'); }); });
      }
    }
    /* 목록 필터 */
    var fm=document.getElementById('lfFm');
    if(fm) fm.addEventListener('change', function(){ fltSet({money:fm.checked}); });
    var fc=document.getElementById('lfFclr');
    if(fc) fc.addEventListener('click', function(){
      var pt0=(cur==='car')?'car':(curCat!=='전체'?curCat:'');
      colfSave(pt0,null);
      flt.rules=[]; fltSet({from:'',to:'',money:false,min:''}); });
    var ptF = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    var ra=document.getElementById('lfRuleAdd');
    if(ra) ra.addEventListener('click', function(){ ruleAdd(ptF); });
    host.querySelectorAll('[data-rdrop]').forEach(function(b){
      b.addEventListener('click', function(){
        flt.rules.splice(parseInt(b.getAttribute('data-rdrop'),10),1);
        lsSet(LS_FLT,flt); safeRender(); }); });
    var gs2=document.getElementById('lfGrp');
    if(gs2) gs2.addEventListener('change', function(){ grpSet(gs2.value); });
    var ss=document.getElementById('lfSubShow');
    if(ss) ss.addEventListener('change', function(){ lsSet(LS_SUBSHOW, ss.checked); safeRender(); });
    var cbn=document.getElementById('lfColorBtn');
    if(cbn) cbn.addEventListener('click', function(){ colorMgr(ptF); });
    /* 보드 */
    var bsel=document.getElementById('lfBrd');
    if(bsel) bsel.addEventListener('change', function(){ brdPid=bsel.value; lsSet(LS_BRD,brdPid); safeRender(); });
    var dragId=null;
    host.querySelectorAll('.lf-bcard').forEach(function(c){
      c.addEventListener('dragstart', function(){ dragId=c.getAttribute('data-bid'); c.classList.add('drag'); });
      c.addEventListener('dragend',   function(){ c.classList.remove('drag'); });
      c.addEventListener('click', function(){
        PGLIST = [].map.call(host.querySelectorAll('.lf-bcard'), function(x){ return x.getAttribute('data-bid'); });
        openPage(c.getAttribute('data-bid')); });
    });
    host.querySelectorAll('.lf-bcol').forEach(function(col){
      col.addEventListener('dragover', function(e){ e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', function(){ col.classList.remove('over'); });
      col.addEventListener('drop', function(e){
        e.preventDefault(); col.classList.remove('over');
        if(!dragId) return;
        var val=col.getAttribute('data-bcol');
        var rec=ent().filter(function(x){ return x.id===dragId; })[0];
        if(!rec){ dragId=null; return; }
        if(!brdPid || brdPid==='_cat'){
          if(typeof toast==='function') toast('분류는 창을 열어 바꿔주세요'); dragId=null; return; }
        var pp=propById(ptF, brdPid);
        var nv = (pp && pp.type==='check') ? (val.indexOf('☑')>=0) : val;
        pUpd(dragId, ppatch(rec, brdPid, nv));
        dragId=null;
        if(typeof toast==='function') toast('옮겼어요');
        safeRender();
      });
    });
    /* 달력 */
    /* 🧹 빈 기록 정리 — 개인일지·데이터 화면 공통 */
    var fz = host.querySelector('#lfFrz');
    if(fz) fz.addEventListener('change', function(){ frzSet(fz.checked); });
    var cwr = host.querySelector('#lfColwR');
    if(cwr) cwr.addEventListener('click', function(){
      colwReset((cur==='car') ? 'car' : (curCat!=='전체' ? curCat : ''));
      if(typeof toast==='function') toast('↔ 칸 폭을 처음으로 되돌렸어요');
      safeRender();
    });
    var bg = host.querySelector('#lfBlankGo');
    if(bg) bg.addEventListener('click', function(){
      var a=blankList();
      if(!a.length){ var el0=document.getElementById('lfBlankBar'); if(el0) el0.remove(); return; }
      askDel('아무것도 안 적힌 기록 '+a.length+'건을 지울까요?', '휴지통에서 되살릴 수 있어요').then(function(ok){
      if(!ok) return;
      a.forEach(function(id){ try{ pDel(id); }catch(e){} });
      if(typeof toast==='function') toast('🧹 '+a.length+'건을 정리했어요');
      /* 지우는 데 잠깐 걸릴 수 있어 두 번 그린다 */
      setTimeout(render, 300);
      setTimeout(render, 1100);
      });
    });
    var bn = host.querySelector('#lfBlankNo');
    if(bn) bn.addEventListener('click', function(){
      var el=document.getElementById('lfBlankBar'); if(el) el.remove(); });

    /* ① 머리줄 가장자리 끌어서 칸 폭 바꾸기 */
    (function(){
      var ptW = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
      host.querySelectorAll('.lf-tv th [data-thrs]').forEach(function(hd){
        var th = hd.parentElement, pid = hd.getAttribute('data-thrs');
        var startX=0, startW=0, moving=false;
        function move(ev){
          if(!moving) return;
          var x = (ev.touches? ev.touches[0].clientX : ev.clientX);
          var w = Math.max(56, startW + (x-startX));
          th.style.width = w+'px';
          ev.preventDefault();
        }
        function up(){
          if(!moving) return;
          moving=false;
          document.body.classList.remove('lf-resizing');
          hd.classList.remove('on');
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          document.removeEventListener('touchmove', move);
          document.removeEventListener('touchend', up);
          colwSet(ptW, pid, parseInt(th.style.width,10));
        }
        function down(ev){
          ev.preventDefault(); ev.stopPropagation();
          startX = (ev.touches? ev.touches[0].clientX : ev.clientX);
          startW = th.getBoundingClientRect().width;
          moving = true;
          document.body.classList.add('lf-resizing');
          hd.classList.add('on');
          document.addEventListener('mousemove', move);
          document.addEventListener('mouseup', up);
          document.addEventListener('touchmove', move, {passive:false});
          document.addEventListener('touchend', up);
        }
        hd.addEventListener('mousedown', down);
        hd.addEventListener('touchstart', down, {passive:false});
        /* 두 번 누르면 원래 폭으로 */
        hd.addEventListener('dblclick', function(ev){
          ev.preventDefault(); ev.stopPropagation();
          colwSet(ptW, pid, 0);
          if(typeof toast==='function') toast('칸 폭을 원래대로 돌렸어요');
          safeRender();
        });
        /* 손잡이에서는 자리 이동(드래그)이 시작되지 않게 */
        hd.addEventListener('dragstart', function(ev){ ev.preventDefault(); ev.stopPropagation(); });
      });
    })();

    /* ② 머리줄 끌어서 칸 순서 바꾸기 */
    (function(){
      var ptD = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
      var ths = host.querySelectorAll('.lf-tv th[data-thid]');
      if(!ths.length) return;
      var srcId = null;
      function clr(){ ths.forEach(function(x){ x.classList.remove('thdrag','thover','thover-r'); }); }
      ths.forEach(function(th){
        th.addEventListener('dragstart', function(ev){
          srcId = th.getAttribute('data-thid');
          th.classList.add('thdrag');
          try{ ev.dataTransfer.effectAllowed='move'; ev.dataTransfer.setData('text/plain', srcId); }catch(e){}
        });
        th.addEventListener('dragend', clr);
        th.addEventListener('dragover', function(ev){
          if(!srcId || th.getAttribute('data-thid')===srcId) return;
          ev.preventDefault();
          try{ ev.dataTransfer.dropEffect='move'; }catch(e){}
          var r=th.getBoundingClientRect();
          var right = (ev.clientX - r.left) > r.width/2;
          th.classList.toggle('thover', !right);
          th.classList.toggle('thover-r', right);
        });
        th.addEventListener('dragleave', function(){ th.classList.remove('thover','thover-r'); });
        th.addEventListener('drop', function(ev){
          ev.preventDefault(); ev.stopPropagation();
          var dstId = th.getAttribute('data-thid');
          if(!srcId || dstId===srcId){ clr(); return; }
          var r=th.getBoundingClientRect();
          var right = (ev.clientX - r.left) > r.width/2;
          var a = colsOf(ptD).slice();
          var from = a.indexOf(srcId); if(from<0){ clr(); return; }
          a.splice(from,1);
          var to = a.indexOf(dstId); if(to<0) to = a.length-1;
          a.splice(right? to+1 : to, 0, srcId);
          colsSave(ptD, a);
          srcId=null; clr();
          if(typeof toast==='function') toast('칸 순서를 바꿨어요');
          safeRender();
        });
      });
    })();

    /* ≣ 리스트 보기 — 줄 클릭·칸 수 */
    host.querySelectorAll('.lf-lsi[data-lsid]').forEach(function(rw){
      rw.addEventListener('click', function(ev){
        if(ev.target.closest('[data-ldel]')) return;
        PGLIST = [].map.call(host.querySelectorAll('.lf-lsi[data-lsid]'), function(x){ return x.getAttribute('data-lsid'); });
        openPage(rw.getAttribute('data-lsid'));
      });
    });
    host.querySelectorAll('[data-lsn]').forEach(function(b){
      b.addEventListener('click', function(){ lsColSet(+b.getAttribute('data-lsn')); });
    });

    /* ⏱ 타임라인 달 이동 */
    var tp=document.getElementById('lfTlPrev'); if(tp) tp.addEventListener('click', function(){ tlShift(-1); });
    var tn=document.getElementById('lfTlNext'); if(tn) tn.addEventListener('click', function(){ tlShift(1); });
    var tw=document.getElementById('lfTlNow');
    if(tw) tw.addEventListener('click', function(){ tlYM=today().slice(0,7); lsSet(LS_TLM,tlYM); safeRender(); });
    /* 📸 갤러리 — 사진 있는 것만 */
    var gp=document.getElementById('lfGalPic');
    if(gp) gp.addEventListener('change', function(){ flt._pic = gp.checked; lsSet(LS_FLT, flt); safeRender(); });
    /* 🏢 층별 — 층 머리를 누르면 그 층만 */
    host.querySelectorAll('[data-flrgo]').forEach(function(b){
      b.addEventListener('click', function(){
        var f=b.getAttribute('data-flrgo');
        var fp=floorPid((cur==='car')?'car':(curCat!=='전체'?curCat:''));
        if(!fp) return;
        flt.rules = (flt.rules||[]).filter(function(r){ return r.pid!==fp; });
        if(f) flt.rules.push({ pid:fp, op:'같음', val:f });
        lsSet(LS_FLT, flt);
        vw='table'; lsSet(LS_VIEW, vw);
        if(typeof toast==='function') toast('🏢 '+(f||'층 없음')+' 만 봅니다');
        safeRender();
      });
    });
    var cp=document.getElementById('lfCalPrev'); if(cp) cp.addEventListener('click', function(){ calShift(-1); });
    var cn=document.getElementById('lfCalNext'); if(cn) cn.addEventListener('click', function(){ calShift(1); });
    var cw=document.getElementById('lfCalNow');
    if(cw) cw.addEventListener('click', function(){ calYM=today().slice(0,7); lsSet(LS_CALM,calYM); safeRender(); });
    host.querySelectorAll('[data-cid]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        /* v216 — 얹어 놓은 다른 종류면 그 종류로 옮겨서 연다 (창구 하나: wlGoPage) */
        var ok = b.getAttribute('data-ckind');
        if(ok){
          try{
            if(typeof window.wlGoPage === 'function'){ window.wlGoPage(b.getAttribute('data-cid'), true); return; }
          }catch(e){ console.warn('[달력] 다른 종류 열기 실패', e); }
        }
        PGLIST = [].map.call(host.querySelectorAll('[data-cid]'), function(x){ return x.getAttribute('data-cid'); });
        openPage(b.getAttribute('data-cid')); }); });
    /* v225 — 종류 칩 ⋯ 더보기 */
    host.querySelectorAll('[data-dsmore]').forEach(function(b){
      b.addEventListener('click', function(){
        try{ dsMoreSet(!dsMore()); }catch(e){ console.warn('[종류 칩] 펼치기 실패', e); }
      });
    });
    /* v224 — 「함께 보기」 접기·펴기 */
    host.querySelectorAll('[data-calkopen]').forEach(function(b){
      b.addEventListener('click', function(){
        try{ kOpenSet(!kOpen()); }catch(e){ console.warn('[함께 보기] 펼치기 실패', e); }
      });
    });
    /* v216 — 달력 종류 칩 */
    host.querySelectorAll('[data-calk]').forEach(function(b){
      b.addEventListener('click', function(){
        try{
          var k = b.getAttribute('data-calk');
          if(k === '__none'){ lsSet(LS_CALOFF, false); calKindsSet([]); return; }
          if(DS && k === DS.kind){
            /* v219 — 얹은 종류가 있을 때만 감출 수 있다 */
            if(!calKinds().length){
              if(typeof toast === 'function') toast('다른 종류를 하나 켜면 이것도 감출 수 있어요');
              return;
            }
            var willOff = !curOff();
            curOffSet(willOff);
            if(typeof toast === 'function')
              toast(willOff ? '🙈 지금 종류를 잠깐 감췄어요' : '👀 지금 종류를 다시 켰어요');
            return;
          }
          var on = calKinds(), i = on.indexOf(k);
          if(i >= 0) on.splice(i,1); else on.push(k);
          calKindsSet(on);
        }catch(e){ console.warn('[달력 종류] 누르기 실패', e); }
      });
    });
    host.querySelectorAll('[data-cday]').forEach(function(d){
      d.addEventListener('click', function(ev){
        if(ev.target.closest('[data-cid]')) return;
        var dd=calYM+'-'+String(d.getAttribute('data-cday')).padStart(2,'0');
        if(curCat!=='전체' && cats()[curCat]) openRec(curCat, null, {date:dd});
        else openCatSheet(dd); }); });
    var rc=host.querySelector('[data-rclr]');
    if(rc) rc.addEventListener('click', function(){ flt.rules=[]; lsSet(LS_FLT,flt); safeRender(); });
    /* 저장된 보기 */
    host.querySelectorAll('[data-vgo]').forEach(function(b){
      b.addEventListener('click', function(){
        var id=b.getAttribute('data-vgo');
        if(!id){
          curView=''; lsSet('wl_life_curview','');
          colsSave(ptF, defCols(ptF));
          srt={k:'date', d:-1}; lsSet(LS_SORT, srt);
          flt={from:'', to:'', money:false, min:'', rules:[]}; lsSet(LS_FLT, flt);
          colfSave(ptF, null);            /* v163 — 칸 거르개도 함께 푼다 */
          grp=''; lsSet(LS_GRP, '');      /* v163 — 묶기도 기본으로 */
          curQ='';
          safeRender(); return;
        }
        var v=viewsOf(ptF).filter(function(x){ return x.id===id; })[0];
        if(v) viewApply(v); }); });
    host.querySelectorAll('[data-vsave]').forEach(function(b){
      b.addEventListener('click', function(ev){ ev.stopPropagation(); viewSaveNow(ptF); }); });
    host.querySelectorAll('[data-vmgr]').forEach(function(b){
      b.addEventListener('click', function(ev){ ev.stopPropagation(); viewMgr(ptF); }); });
    /* 관계 칩 클릭 → 그 기록 열기 */
    host.querySelectorAll('[data-relgo]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        var id=b.getAttribute('data-relgo');
        var r=ent().filter(function(x){ return x.id===id; })[0];
        if(!r) return;
        if(r.kind==='pcontact') openCt(id); else openRec(r.ptype||'etc', id); }); });
    /* 숫자칸 쉼표 */
    bindNumsIn(host);
    var fq=document.getElementById('lfFq');
    if(fq) fq.addEventListener('change', function(){
      var v=fq.value; if(!v) return;
      var t=today(), y=+t.slice(0,4), m=+t.slice(5,7);
      function ym(yy,mm){ while(mm<1){ mm+=12; yy--; } while(mm>12){ mm-=12; yy++; }
        return yy+'-'+String(mm).padStart(2,'0'); }
      function last(yy,mm){ return new Date(yy, mm, 0).getDate(); }
      if(v==='m')      fltSet({from:ym(y,m)+'-01', to:ym(y,m)+'-'+last(y,m)});
      else if(v==='pm'){ var p=ym(y,m-1); var py=+p.slice(0,4), pm=+p.slice(5,7);
                         fltSet({from:p+'-01', to:p+'-'+last(py,pm)}); }
      else if(v==='y') fltSet({from:y+'-01-01', to:y+'-12-31'});
      else if(v==='3m')fltSet({from:ym(y,m-2)+'-01', to:ym(y,m)+'-'+last(y,m)});
      else if(v==='12m')fltSet({from:ym(y,m-11)+'-01', to:ym(y,m)+'-'+last(y,m)});
    });
    var cs=document.getElementById('lfCatSel');
    if(cs) cs.addEventListener('change', function(){
      curCat = cs.value; lsSet(LS_CAT, curCat); EDIT=null; safeRender(); });
    var mo=document.getElementById('lfMonth'); if(mo) mo.addEventListener('change', function(){ curMonth=mo.value; safeRender(); });
    var ct=document.getElementById('lfCtype'); if(ct) ct.addEventListener('change', function(){ curCtype=ct.value; safeRender(); });
    var yr=document.getElementById('lfYear');  if(yr) yr.addEventListener('change', function(){ curMonth=yr.value+'-01'; safeRender(); });

    /* 검색 — 한글 IME 보호: 입력창 DOM 유지, 결과만 다시 그림 */
    var q=document.getElementById('lfQ');
    if(q){
      q.addEventListener('input', function(){
        clearTimeout(window._lfQT);
        window._lfQT=setTimeout(function(){
          var pos=q.selectionStart, val=q.value;
          curQ=val; render();
          var n2=document.getElementById('lfQ');
          if(n2){ n2.value=val; try{ n2.focus(); n2.setSelectionRange(pos,pos); }catch(e){} }
        }, 260);
      });
    }

    /* 카드 클릭 */
    host.querySelectorAll('[data-ldel]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        wlAskDel('이 기록을 지울까요?').then(function(ok){
          if(!ok) return;
          try{ pDel(b.getAttribute('data-ldel')); }
          catch(e){ console.error('[삭제]', e); if(typeof toast==='function') toast('삭제 실패: '+(e.message||e)); return; }
          if(typeof toast==='function') toast('🗑 삭제됐어요');
          setTimeout(render, 220);
          /* v169 — 위 지출 요약 카드도 함께 다시 센다 (v217 — 지운 뒤에 센다) */
          setTimeout(function(){
            try{ if(window.wlExpStats && window.wlExpStats.now) window.wlExpStats.now(); }
            catch(e){ console.warn('[지출 합계] 갱신 실패', e); }
          }, 460);
        });
      });
    });
    host.querySelectorAll('[data-lid]').forEach(function(c){
      c.addEventListener('click', function(){
        var id=c.getAttribute('data-lid');
        if(!PGLIST.length) PGLIST = [].map.call(host.querySelectorAll('[data-lid]'), function(x){ return x.getAttribute('data-lid'); });
        /* v258 — 달님 : 「차계부는 추가는 예전 창, 수정은 노션식으로 나와」 → 차계부는 둘 다 예전 창.
           예전 창에만 총금액·주유량·리터당 단가 자동계산과 직전 주행거리 채우기가 있다. 노션 페이지는 [📄 열기] 로. */
        try{ var _r = anyRec(id); if(isPersonal() && _r && _r.ptype==='car'){ openRec('car', id); return; } }catch(_c){}
        openPage(id);
      });
    });

    /* ── 목록: ↗ 창 열기 ── */
    host.querySelectorAll('[data-lopenr]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        openPage(b.getAttribute('data-lopenr'));
      });
    });
    /* 제목 칸의 📄 를 누르면 페이지로 */
    host.querySelectorAll('[data-lpage]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        openPage(b.getAttribute('data-lpage'));
      });
    });
    /* ── 목록: 칸 눌러서 바로 고치기 ── */
    var ptNow = (cur==='car') ? 'car' : (curCat!=='전체' ? curCat : '');
    host.querySelectorAll('td.ce').forEach(function(td){
      td.addEventListener('click', function(ev){
        if(ev.target.closest('a, button')) return;
        if(td.querySelector('.lf-ie')) return;
        var tr=td.closest('tr'); if(!tr) return;
        EDIT={ id:tr.getAttribute('data-rid'), pid:td.getAttribute('data-pid') };
        safeRender();
      });
    });
    var ie=host.querySelector('.lf-ie');
    if(ie && EDIT){
      var eid=EDIT.id, epid=EDIT.pid;
      var done=false;
      if(ie.getAttribute && ie.getAttribute('data-num')==='1') bindNum(ie);
      var mw = host.querySelector('.lf-multi');
      if(mw){
        mw.querySelectorAll('[data-mv]').forEach(function(t){
          t.addEventListener('mousedown', function(e){ e.preventDefault(); });
          t.addEventListener('click', function(e){
            e.stopPropagation();
            var hid=mw.querySelector('.lf-ie');
            var arr=(hid.value||'').split(',').filter(Boolean);
            var v2=t.getAttribute('data-mv'), i2=arr.indexOf(v2);
            if(i2>=0) arr.splice(i2,1); else arr.push(v2);
            hid.value=arr.join(',');
            t.classList.toggle('on', i2<0);
            if(i2<0){ var pp=propById(ptNow, epid);
              var cc=colorOf(((pp&&pp.colors)||{})[v2]||'gray');
              t.style.background=cc.bg; t.style.color=cc.fg; }
            else t.removeAttribute('style');
            /* 누를 때마다 바로 저장 — 숨은 칸이라 blur 가 안 온다 */
            try{ editCommit(ptNow, eid, epid, hid); }catch(x){}
          });
        });
        /* 바깥을 누르면 편집 끝 */
        setTimeout(function(){
          var off=function(ev){
            if(mw.contains(ev.target)) return;
            document.removeEventListener('mousedown', off, true);
            EDIT=null; setTimeout(render,0);
          };
          document.addEventListener('mousedown', off, true);
        }, 50);
        done=true;                       /* blur 로 다시 저장하지 않게 */
      }
      if(ie.getAttribute && ie.getAttribute('data-tdial')){
        bindDial(ie.parentNode||host);
        setTimeout(function(){ try{ ie.click(); }catch(x){} }, 60);
      }
      try{ if(ie.type!=='hidden'){ ie.focus(); if(ie.select) ie.select(); } }catch(e){}
      var fin=function(save){
        if(done) return; done=true;
        if(save) try{ editCommit(ptNow, eid, epid, ie); }catch(e){ noteMsg('저장 실패: '+e); }
        EDIT=null; setTimeout(render, 0);
      };
      ie._dialDone = function(){ fin(true); };    /* v112 시계창이 직접 저장을 부른다 */
      ie.addEventListener('blur', function(){ if(ie._dialOpen) return; fin(true); });
      ie.addEventListener('change', function(){ if(ie.type==='checkbox'||ie.tagName==='SELECT') fin(true); });
      ie.addEventListener('keydown', function(ev){
        if(ev.key==='Enter' && ie.tagName!=='TEXTAREA'){ ev.preventDefault(); fin(true); }
        else if(ev.key==='Escape'){ ev.preventDefault(); fin(false); }
      });
    }
    /* 목록 안 ＋ 새 줄 */
    host.querySelectorAll('[data-newrow]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        var gp=b.getAttribute('data-ngpid'), gv=b.getAttribute('data-ngval');
        newRowAsk((gp!==null && gp!=='') ? {pid:gp, val:gv} : null);
      });
    });
    var cb=document.getElementById('lfColBtn');
    if(cb) cb.addEventListener('click', function(ev){ ev.stopPropagation(); colPicker(ptNow); });
    host.querySelectorAll('[data-lctdel]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        askDel('이 연락처를 지울까요?').then(function(ok){
          if(!ok) return;
          try{ pDel(b.getAttribute('data-lctdel')); }
          catch(e){ console.error('[삭제]', e); if(typeof toast==='function') toast('삭제 실패: '+e); return; }
          if(typeof toast==='function') toast('🗑 삭제됐어요'); setTimeout(render,220);
        });
      });
    });
    host.querySelectorAll('[data-lctcall]').forEach(function(b){
      b.addEventListener('click', function(ev){ ev.stopPropagation(); location.href='tel:'+b.getAttribute('data-lctcall'); }); });
    host.querySelectorAll('[data-lctedit]').forEach(function(b){
      b.addEventListener('click', function(ev){ ev.stopPropagation(); openCt(b.getAttribute('data-lctedit')); }); });
    host.querySelectorAll('[data-lct]').forEach(function(c){
      c.addEventListener('click', function(){ openCt(c.getAttribute('data-lct')); }); });
  }

  /* ══════ 샘플 데이터 ══════ */
  function seed(force){
    if(!force){ try{ if(localStorage.getItem(LS_SEED)) return; }catch(e){} }
    if(!force && recs().length) { try{ localStorage.setItem(LS_SEED,'1'); }catch(e){} return; }
    if(!window.wlP || !window.wlP.ready()){ setTimeout(function(){ seed(force); }, 1500); return; }

    var S=[
      /* 🚗 스타렉스 */
      {ptype:'car',car:'스타렉스',ctype:'정비',date:'2026-07-25',odo:172100,title:'에어컨 콤프레샤 교체',place:'공임나라',amount:750000,
       parts:[{name:'에어컨 콤프레샤',price:620000},{name:'공임',price:130000}],detail:'에어컨 안 시원해서 교체'},
      {ptype:'car',car:'스타렉스',ctype:'주유',date:'2026-07-19',odo:171438,amount:42312,liter:25.19,unit:1680,fuel:'경유',pay:'카드',place:'청우충전소'},
      {ptype:'car',car:'스타렉스',ctype:'주유',date:'2026-06-19',odo:168255,amount:63894,liter:38.03,unit:1680,fuel:'경유',pay:'카드',place:'선산하행 주유소'},
      {ptype:'car',car:'스타렉스',ctype:'주유',date:'2026-06-18',odo:167922,amount:40786,liter:24.28,unit:1680,fuel:'경유',pay:'카드',place:'SK주유소'},
      {ptype:'car',car:'스타렉스',ctype:'정비',date:'2026-06-18',odo:167894,title:'하체 점검 · 부품 교체',place:'공임나라 하안점',amount:218000,
       parts:[{name:'부품비',price:160000},{name:'공임',price:58000}],nextodo:175000},
      {ptype:'car',car:'스타렉스',ctype:'검사',date:'2026-04-21',odo:160573,title:'정기 검사',amount:80000,end:'2028-04-21',place:'자동차검사소'},
      {ptype:'car',car:'스타렉스',ctype:'정비',date:'2026-04-04',odo:158516,title:'엔진오일 교체 및 냉각수',amount:60000,
       parts:[{name:'엔진오일',price:45000},{name:'냉각수',price:15000}]},
      {ptype:'car',car:'스타렉스',ctype:'정비',date:'2026-03-07',odo:155112,title:'엔진오일 2.5리터 보충',amount:25000},
      /* 🍜 맛집 */
      {ptype:'food',date:'2026-07-17',title:'미스사이공(신도림점)',ftype:'기타',sido:'서울',gugun:'구로구',rating:4,amount:28000,
       menus:[{name:'쌀국수',price:11000,score:'⭐4 좋음',note:'국물 깔끔'},{name:'분짜',price:14000,score:'⭐4 좋음',note:''}],detail:'베트남 음식점'},
      {ptype:'food',date:'2026-07-17',title:'탕탕탕',ftype:'고기',rating:4,amount:23000,
       menus:[{name:'탕수육',price:23000,score:'⭐4 좋음',note:''}]},
      {ptype:'food',date:'2026-07-17',title:'광명홍두깨칼국수',ftype:'면',sido:'경기',gugun:'광명시',rating:5,amount:9000,
       menus:[{name:'칼국수',price:9000,score:'⭐5 최고',note:'면발 좋음'}],detail:'재방문 의사 있음'},
      {ptype:'food',date:'2026-07-16',title:'전주명가콩나물국밥옥',ftype:'국밥·탕',rating:4,amount:9000,
       menus:[{name:'콩나물국밥',price:9000,score:'⭐4 좋음',note:'해장에 좋음'}]},
      {ptype:'food',date:'2026-07-14',title:'숙이네 국수방',ftype:'면',rating:4,amount:8000,
       menus:[{name:'잔치국수',price:8000,score:'⭐4 좋음',note:''}]},
      {ptype:'food',date:'2026-06-20',title:'밀양돼지국밥',ftype:'국밥·탕',rating:5,amount:11000,
       menus:[{name:'돼지국밥',price:11000,score:'⭐5 최고',note:'국물 진함'}],detail:'단골'},
      /* 🔔 챙길 일 */
      {ptype:'todo',date:'2026-09-05',title:'자동차 보험 갱신',repeat:'매년',amount:780000,where:'삼성화재'},
      {ptype:'todo',date:'2026-08-31',title:'관리비 납부',repeat:'매월'},
      {ptype:'todo',date:'2026-10-15',title:'건강검진 예약',where:'서희내과'},
      /* 🛒 구매 */
      {ptype:'buy',date:'2026-08-10',title:'작업화',amount:78000,where:'철물점',pay:'카드',brand:'K2'},
      {ptype:'buy',date:'2026-07-02',title:'무선 드릴',amount:145000,where:'쿠팡',pay:'카드',brand:'보쉬',warranty:'2027-07-02',detail:'현장용'},
      /* 💊 건강 */
      {ptype:'health',date:'2026-08-05',title:'감기 진료',who:'서희내과',insur:'해당없음',
       costs:[{name:'진료비',price:6500},{name:'약값',price:4200}],detail:'3일치 처방'},
      /* 📖 독서 */
      {ptype:'book',date:'2026-08-01',title:'사피엔스',who:'유발 하라리',btype:'📕 종이책',rating:5,totalpg:636,readpg:280,
       quotes:[{name:'인지혁명 (p.42)',note:'허구를 믿는 능력이 협력을 만든다'}]},
      /* 📔 일상 */
      {ptype:'daily',date:'2026-08-25',title:'무난한 하루',weather:'☀️ 맑음',mood:'😌 평온',
       detail:'오전에 배관 점검, 오후에 서류 정리.',thanks:[{name:'큰 사고 없이 지나간 것'}],tomorrow:'승강기 점검 입회'}
    ];
    var C=[
      {name:'공임나라 하안점',cat:'거래처',phone:'02-2611-8253',addr:'경기 광명시 하안로',person:'정비 담당',memo:'스타렉스 정비'},
      {name:'서희내과',cat:'병원',phone:'055-123-4567',memo:'감기·건강검진'},
      {name:'밀양돼지국밥',cat:'식당',phone:'055-354-1234',memo:'단골 · 국물 진함'},
      {name:'삼성화재',cat:'거래처',phone:'1588-5114',memo:'자동차 보험 · 매년 9월 갱신'}
    ];
    if(ent().some(function(e){ return e.sample && (e.kind==='personal'||e.kind==='pcontact'); })){
      try{ localStorage.setItem(LS_SEED,'1'); }catch(e){}
      if(force) askInfo('샘플이 이미 들어가 있어요.\n다시 넣으려면 먼저 [샘플 지우기] 를 하세요.');
      return;
    }
    var n=0;
    S.forEach(function(s){ s.kind='personal'; s.createdAt=Date.now()+(n++); s.sample=1; try{ pAdd(s); }catch(e){} });
    C.forEach(function(c){ c.kind='pcontact'; c.date=today(); c.title=c.name; c.createdAt=Date.now()+(n++); c.sample=1; try{ pAdd(c); }catch(e){} });
    try{ localStorage.setItem(LS_SEED,'1'); }catch(e){}
    setTimeout(render, 500);
  }
  window.wlLifeSeed = function(){ seed(true); };
  window.wlLifeSeedClear = function(){
    var s=ent().filter(function(e){ return e.sample && (e.kind==='personal'||e.kind==='pcontact'); });
    if(!s.length){ noteMsg('샘플 데이터가 없어요'); return; }
    if(!confirm('샘플 '+s.length+'건을 모두 지울까요?\n(직접 넣은 기록은 안 지워집니다)')) return;
    s.forEach(function(e){ try{ pDel(e.id); }catch(x){} });
    if(typeof toast==='function') toast('🗑 샘플 '+s.length+'건 삭제');
    setTimeout(render, 400);
  };

  /* 어디서든 안전 화면 열기 — 헤더 [🛟 안전] 버튼이 부른다 */
  window.wlSafeOpen = function(src){
    cur='safe'; safeSrc = (src==='worklog'||src==='personal') ? src : 'personal';
    lsSet(LS_TAB,'safe');
    try{ if(typeof window.v43ActivateTab==='function') window.v43ActivateTab('life'); }catch(e){}
    setTimeout(function(){
      render();
      try{ P_().trashSync().then(function(ch){ if(ch && cur==='safe') render(); }); }catch(e){}
      var h=document.getElementById('lifeHost');
      HOST_ID='lifeHost';
      if(h) try{ h.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
    }, 120);
  };

  window.wlDSCur = function(){ try{ return DS ? DS.key : null; }catch(e){ return null; } };
  /* 🏠 개인 탭을 직접 눌렀을 때 — 업무 데이터셋이 걸려 있으면 개인으로 되돌린다 */
  window.wlDSReset = function(){
    try{
      if(!DS || DS.key==='personal'){ HOST_ID='lifeHost'; return; }
      DS = DS_PERSONAL; HOST_ID='lifeHost';
      cur='rec'; curQ=''; curCat='전체'; EDIT=null; curView='';
      try{ var _o=document.getElementById('lfPageOv'); if(_o) _o.remove(); }catch(e){}
      try{ applyFav(''); }catch(e){}
    }catch(e){ console.error('[데이터셋 되돌리기]', e); }
  };
  window.wlLifeRender = render;
  window.wlWorkFields = workFields;      /* 대조표·점검용 */
  window.wlWorkKinds  = WORK_KINDS;
  window.wlLifeOpen   = openRec;
  window.wlLifeOpenCt = openCt;

  try{
    var sv=lsGet(LS_TAB,null); if(sv && ['rec','car','ct','stat','safe'].indexOf(sv)>=0) cur=sv;
    var sc=lsGet(LS_CAR,null); if(sc) curCar=sc;
  }catch(e){}

  setTimeout(function(){ seed(false); }, 2500);
  console.log('[개인] 기록·차계부·연락처·결산 로드');
})();
