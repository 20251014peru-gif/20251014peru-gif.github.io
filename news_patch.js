/* news_patch.js — 뉴스레이더 보강 패치 v12 (2026-08-30)
 *
 * v12 에서 한 것
 *   ① 말줄임표(…) 를 화면 어디에서도 쓰지 않는다.
 *      제목·5줄요약은 모든 탭에서 딱 두 줄까지 보이고, 잘려도 … 을 붙이지 않는다.
 *      (크롬의 -webkit-line-clamp 는 … 을 강제로 붙이므로 줄높이×2 방식으로 바꿈)
 *   ② 브리핑에 '내가 만든 5줄 요약' 전체가 실린다. 요약해 둔 기사가 앞으로 정렬되고,
 *      내 요약이 없으면 수집기가 준 한 줄이라도 싣는다. (제목만 나오던 문제)
 *   ③ 이슈·테마 보드를 '새 뉴스' 화면에서 빼고, 스크랩과 용어집 사이 전용 탭으로 옮김.
 *
 * ↓ v11 원본 설명
 *
 * v11 에서 고친 것 (폰 화면 깨짐)
 *   · 폰에서 검색창·[검색]·[AI로 뉴스검색] 이 세로로 길게 늘어나던 문제.
 *     원인: news.html 은 폰(≤760px)에서 .controls 를 flex-direction:column 으로 세우는데,
 *           v9·v10 이 넣은 .searchbar{flex:0 1 420px} 의 420px 이 세로 방향에서는
 *           '너비'가 아니라 '높이'로 해석돼 검색줄이 420px 이상 늘어났다.
 *     조치: 한 줄 레이아웃 규칙을 @media(min-width:761px) 안으로 옮기고,
 *           폰에는 세로 배치 + 입력창 높이 44px 을 따로 못박았다.
 *   · 폰에서 헤더 '뉴스레이더' 가 두 줄로 접히던 것도 같이 잡음.
 *
 * ↓ v10 원본 설명
 *
 * 삼단(사실은 사단) 이동식 구조
 *   ⚡속보  →  🆕새 뉴스  →  📖읽음  →  🔖스크랩
 *   · 프로그램을 켜면 ⚡속보 화면이 먼저 뜬다.
 *   · 제목을 눌러 읽으면 속보/새 뉴스에서 빠지고 📖읽음 으로 간다.
 *   · 읽음에서 [📝 요약] 을 누르면 5줄 요약이 만들어지고 🔖스크랩 으로 옮겨진다.
 *   · 요약 칸은 '핵심 한 줄'만 보이고, 누르면 5줄 전체가 팝업으로 뜬다.
 *
 * 되돌리기
 *   · 읽음 → 새 뉴스 : 왼쪽 ✓ 동그라미를 다시 누르면 안읽음으로 돌아간다.
 *   · 스크랩 → 읽음 : 맨 오른쪽 ★ 를 다시 누르면 스크랩에서 빠진다.
 *
 * v2 에서 이어받은 것
 *   · 읽음·스크랩 판정을 기사 번호가 아니라 URL 기준으로 (안 본 기사에 ✓ 뜨던 버그 해결)
 *   · 만든 요약은 새로고침해도 남는다
 *
 * v3 에서 새로 한 것
 *   ① 탭 순서 재배치 + 이름 '전체' → '🆕새 뉴스' + 탭마다 건수 배지
 *   ② 읽기만 해도 스크랩되던 것 제거 (이제 요약해야 스크랩)
 *   ③ 요약 프롬프트 수정 — 1번째 줄이 '가장 중요한 핵심 한 줄'이 되게
 *   ④ 수집기가 넣어준 1줄 요약은 '요약 완료'로 치지 않고 📝 버튼을 계속 띄운다
 *   ⑤ 스크랩에 메모 한 줄 (왜 남겼는지)
 *   ⑥ 속보가 0건인 날엔 최근 🔴중요 뉴스로 첫 화면을 채운다
 *
 * v4 에서 새로 한 것
 *   ⑦ 표 칸에 뜨는 한 줄은 '5줄 요약을 한 줄로 압축한 문장' (기사 제목이 아님)
 *   ⑧ 그 한 줄은 잘리지 않고 줄바꿈되어 전부 보인다
 *   ⑨ 표 머리글 '한 줄 요약' → '5줄 요약'
 *   ⑩ 아직 요약 안 한 기사는 수집기 문장 대신 [📝 요약] 버튼만 보인다
 *
 * v5 에서 새로 한 것
 *   ⑪ 컴↔폰 동기화에 '내가 만든 5줄 요약'과 '지운 목록'을 포함시킴
 *      (원래 userdata.json 동기화는 스크랩·읽음·키워드만 담고 요약은 빠져 있었다)
 *   ⑫ 화면을 다시 켤 때 자동으로 최신 내용을 받아온다
 *   ⑬ 읽음·스크랩에서 뉴스를 지울 수 있다 — 줄마다 🗑 + 여러 건 선택 삭제 + 모두 지우기
 *   ⑭ 폰(화면 760px 이하)에서는 제목과 요약이 두 줄까지만 보인다
 *
 * v6 에서 새로 한 것
 *   ⑮ 읽기창과 요약 팝업에 [📤 공유] — 제목 + 5줄 요약 + 원문 링크를 한 번에.
 *      폰에서는 카톡·문자 등 공유창이 뜨고, 컴에서는 클립보드로 복사된다.
 *
 * v7 에서 새로 한 것
 *   ⑯ 표에서 제목·요약이 '…' 로 잘리지 않고 전부 보인다
 *   ⑰ 공유 링크가 광고 많은 원문이 아니라 '깔끔히 정리된 읽기 화면' 으로 바뀐다
 *      (받는 사람이 눌러도 바로 정리본이 열린다 — news.html#a=원문주소)
 *   ⑱ 여러 건 골라서 한 번에 공유 [📤 선택 공유]
 *   ⑲ [🖨️ 브리핑] — 지금 보는 목록을 A4 2열/3열 한 장으로 인쇄
 *
 * v8 에서 고친 것
 *   ⑳ 제목·요약 칸을 가로로 길게(표는 좌우 스크롤) + 각각 두 줄까지만
 *   ㉑ 공유가 '뉴스레이더 링크'가 아니라 뉴스 내용 자체가 가게 바꿈 —
 *      제목·출처·5줄 요약·본문 전문이 글로 담기고, 맨 끝에 기사 원문 주소
 *
 * v9 에서 고친 것
 *   ㉒ 윗줄(검색·버튼) 정리 — 검색창은 적당한 길이로 한 줄, 버튼은 그 아래 한 줄.
 *      브리핑 버튼이 'AI로 뉴스검색' 위에 겹쳐 뭉개지던 문제 해결
 *   ㉓ 폰에서는 칸 폭을 조금 줄여 가로 스크롤이 덜 하게
 *
 * v10 에서 고친 것
 *   ㉔ 윗줄을 한 줄로 되돌림 — 검색·버튼이 모두 한 줄에 들어가고, 좁으면 버튼 줄만
 *      좌우로 밀린다(스크롤막대는 숨김). 세로로 길어지지 않는다.
 *   ㉕ 제목·요약을 딱 두 줄로, 문장 가운데에서 나뉘게 (text-wrap:balance)
 *      + 한국어는 낱말 중간에서 안 끊기게 (word-break:keep-all)
 *   ㉖ 공유에서 기사 원문 주소를 완전히 뺐다 — 정리된 내용만 나간다
 *
 * news.html 본문은 건드리지 않는다.
 * 문제가 생기면 news.html 의 <script src="news_patch.js"> 한 줄만 지우면 원래대로 돌아온다.
 */
(function () {
  "use strict";
  if (window.__nrPatch >= 12) return;
  window.__nrPatch = 12;

  var LINES = 5;
  var VER = "v12";
  var FALLBACK_MAX = 20;   /* 속보 0건일 때 대신 채울 중요 뉴스 최대 건수 */
  var BODY_MAX = 1500;     /* 공유할 때 함께 보내는 본문 최대 글자수 */

  /* ================= 스타일 ================= */
  var css = [
    "#nrpopBg,#nrmemoBg{position:fixed;inset:0;background:rgba(15,20,30,.55);z-index:99999;",
    "display:flex;align-items:center;justify-content:center;padding:16px}",
    "#nrpop,#nrmemo{background:#fff;color:#1c1c1e;width:100%;max-width:560px;max-height:82vh;",
    "overflow:auto;border-radius:16px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.32);",
    "font-size:15px;line-height:1.75;font-family:inherit}",
    "#nrpop .t,#nrmemo .t{font-weight:700;font-size:15.5px;line-height:1.5;margin-bottom:12px}",
    "#nrpop .b{white-space:pre-wrap;word-break:break-word}",
    "#nrpop .x,#nrmemo .x{margin-top:16px;width:100%;min-height:46px;border:0;border-radius:12px;",
    "background:#3b57c9;color:#fff;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}",
    "#nrmemo textarea{width:100%;min-height:96px;border:1px solid #d9dde5;border-radius:12px;",
    "padding:12px;font-size:15px;line-height:1.6;font-family:inherit;resize:vertical;box-sizing:border-box}",
    "#nrmemo .row{display:flex;gap:8px;margin-top:12px}",
    "#nrmemo .row button{flex:1;min-height:46px;border:0;border-radius:12px;font-size:15px;",
    "font-weight:600;font-family:inherit;cursor:pointer}",
    "#nrmemo .ok{background:#3b57c9;color:#fff}",
    "#nrmemo .no{background:#eceef3;color:#41474f}",
    "tbody td.summary{white-space:normal!important;vertical-align:top;padding-top:9px;padding-bottom:9px}",
    "tbody td.summary .sumline{display:block;white-space:normal;word-break:break-word;",
    "line-height:1.55;cursor:pointer}",
    "tbody td.summary .sumline:hover{text-decoration:underline dotted}",
    "body:has(.tabbar button.on[data-view=\"scrap\"]) col.c-note{width:132px}",
    /* 이슈·테마 보드를 '새 뉴스' 화면에서 빼고, 전용 탭에서만 보이게 */
    "html body:has(.tabbar button.on[data-view=\"all\"]) #boardWrap{display:none!important}",
    "html body:has(.tabbar button.on[data-view=\"board\"]) #boardWrap{display:block!important}",
    "html body:has(.tabbar button.on[data-view=\"board\"]) #tablewrap,",
    "html body:has(.tabbar button.on[data-view=\"board\"]) #controls,",
    "html body:has(.tabbar button.on[data-view=\"board\"]) #filters,",
    "html body:has(.tabbar button.on[data-view=\"board\"]) #moreBox,",
    "html body:has(.tabbar button.on[data-view=\"board\"]) #emptyBox,",
    "html body:has(.tabbar button.on[data-view=\"board\"]) #selbar{display:none!important}",
    /* 탭이 7개가 되므로 폰에서 글자를 살짝 줄인다 */
    "@media(max-width:760px){.tabbar button{font-size:9.5px;letter-spacing:-.04em}",
    ".tabbar button .ic{font-size:18px}}",
    ".nrdel{cursor:pointer;margin-left:6px;opacity:.5;font-size:13px}",
    "#nrpop .sh{margin-top:12px;width:100%;min-height:46px;border:1px solid #d9dde5;border-radius:12px;",
    "background:#fff;color:#3b57c9;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer}",
    "#nrpop .cp{width:100%;min-height:150px;margin-top:12px;border:1px solid #d9dde5;border-radius:12px;",
    "padding:12px;font-size:14px;line-height:1.6;font-family:inherit;box-sizing:border-box}",
    ".nrdel:hover{opacity:1}",
    "#selbar .nrall{background:var(--line-2);color:var(--ink-2)}",
    /* 윗줄 : 컴에서는 한 줄로. 좁으면 버튼 줄만 좌우로 밀린다.
       ※ 폰(≤760px)에서는 news.html 이 .controls 를 flex-direction:column 으로 세운다.
          세로 방향에서는 flex-basis 가 '높이'가 되므로 아래 420px 지정이 검색창을
          420px 높이로 늘려버린다(v9·v10 폰 화면 깨짐의 원인). 그래서 컴에서만 적용한다. */
    "@media(min-width:761px){",
    ".controls{flex-wrap:wrap!important;align-items:center;gap:10px}",
    ".controls .searchbar{flex:0 1 420px!important;min-width:260px!important;max-width:520px!important}",
    ".controls .actbar{flex:1 1 auto!important;flex-wrap:nowrap!important;overflow-x:auto;scrollbar-width:none}",
    ".controls .actbar>*{flex:0 0 auto}",
    ".controls .actbar .seg{margin-left:auto}",
    "}",
    ".controls .actbar::-webkit-scrollbar{display:none}",
    /* 폰 : 검색창 한 줄(가로 꽉), 버튼줄은 좌우 스크롤 — 세로로 늘어나지 않게 못박는다 */
    "@media(max-width:760px){",
    ".controls{flex-direction:column!important;align-items:stretch!important;gap:8px!important}",
    ".controls .searchbar{flex:none!important;width:100%!important;min-width:0!important;max-width:none!important}",
    ".controls .searchbar input{flex:1 1 auto!important;min-width:0!important;height:44px!important}",
    ".controls .searchbar button{flex:0 0 auto!important;height:44px!important;align-self:auto!important}",
    ".controls .actbar{flex:none!important;width:100%!important;flex-wrap:nowrap!important;",
    "overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}",
    ".controls .actbar>*{flex:0 0 auto!important;align-self:center}",
    ".controls .actbar .seg{margin-left:0!important;width:auto!important}",
    ".brand h1{flex:0 0 auto;white-space:nowrap;font-size:18px}",
    ".hmeta{font-size:11px;line-height:1.35}",
    "}",
    ".nrbrief{white-space:nowrap}",
    /* 제목·요약 : 딱 두 줄, 문장 가운데에서 나뉘게, 낱말은 안 끊기게 */
    /* 제목·요약 : 딱 두 줄. -webkit-line-clamp 는 크롬이 끝에 '…' 를 자동으로 붙이므로
       쓰지 않고, 줄높이×2 만큼만 보여주고 잘라낸다(말줄임표 없음). */
    "tbody .title{display:block!important;line-height:1.4;max-height:2.8em!important;",
    "overflow:hidden;text-overflow:clip!important;",
    "white-space:normal;word-break:keep-all;overflow-wrap:break-word;",
    "text-wrap:balance;max-width:340px}",
    "tbody td.summary .sumline{display:block!important;line-height:1.4;max-height:2.8em!important;",
    "overflow:hidden;text-overflow:clip!important;",
    "white-space:normal;word-break:keep-all;overflow-wrap:break-word;",
    "text-wrap:balance;max-width:420px}",
    /* 말줄임표는 어디서도 쓰지 않는다 */
    "tbody td{text-overflow:clip!important}",
    ".r-head .rt h2{text-overflow:clip!important;white-space:normal!important;line-height:1.35}",
    "@media(max-width:760px){",
    "tbody .title{max-width:250px}",
    "tbody td.summary .sumline{max-width:300px}",
    "}",
    "tbody td{vertical-align:top}",
    "#selbar .nrsh{background:#3b57c9;color:#fff}",
    "tbody tr.read{opacity:1!important}",
    "tbody tr.read .rdot{background:transparent!important;position:relative}",
    "tbody tr.read .rdot::after{content:'\\2713';position:absolute;left:50%;top:50%;",
    "transform:translate(-50%,-50%);font-size:13px;line-height:1;font-weight:700;color:#9aa3af}",
    "#nrNote{margin:0 0 10px;padding:9px 12px;border-radius:10px;background:rgba(59,87,201,.08);",
    "color:#3b57c9;font-size:12.5px;font-weight:700;line-height:1.5}",
    ".nrmemochip{display:inline-block;max-width:120px;overflow:hidden;text-overflow:clip;",
    "white-space:nowrap;vertical-align:middle;cursor:pointer;font-size:11.5px;font-weight:700;",
    "padding:2px 7px;border-radius:8px;background:rgba(59,87,201,.10);color:#3b57c9}",
    ".nrmemochip.empty{background:transparent;color:#b3b9c4;font-weight:600}"
  ].join("");
  var st = document.createElement("style");
  st.id = "nrPatchCss";
  st.textContent = css;
  document.head.appendChild(st);

  /* ================= 작은 도우미 ================= */
  function say(m) { if (window.toast) window.toast(m); else alert(m); }
  function get(k, d) { return window.lsGet ? window.lsGet(k, d) : d; }
  function put(k, v) { if (window.lsSet) window.lsSet(k, v); }
  function clean(s) { return String(s == null ? "" : s).replace(/[<>]/g, " ").trim(); }

  /* 기사 한 건을 가리키는 고정 열쇠 — URL 우선, 없으면 번호(예시 데이터용) */
  function keyOf(n) { return n ? (n.url && n.url !== "#" ? n.url : "id:" + n.id) : ""; }

  function newsList() { return (window.NEWS && window.NEWS.length) ? window.NEWS : []; }
  function scrapList() { return (window.scraps && window.scraps.length) ? window.scraps : []; }
  function curView() { return (typeof window.view === "string") ? window.view : "all"; }

  function byId(id) {
    var i, L = newsList();
    for (i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
    var S = scrapList();
    for (i = 0; i < S.length; i++) if (S[i] && S[i].n && S[i].n.id === id) return S[i].n;
    if (window.liveItems && window.liveItems.length) {
      var V = window.liveItems;
      for (i = 0; i < V.length; i++) if (V[i].id === id) return V[i];
    }
    return null;
  }
  function keyById(id) { return keyOf(byId(id)); }

  /* 행(tr) 에서 기사 찾기 — onclick="openReader(숫자)" 를 읽는다 */
  function newsOfRow(tr) {
    if (!tr) return null;
    var holder = tr.querySelector("[onclick*='openReader']");
    var oc = holder ? (holder.getAttribute("onclick") || "") : "";
    var m = oc.match(/openReader\((\d+)\)/);
    return m ? byId(parseInt(m[1], 10)) : null;
  }

  /* ================= 번호 정리 ================= */
  /* news.json + archive 를 합치면 같은 id 가 여러 건 생긴다. 매 렌더 전에 다시 매긴다. */
  function reindex() {
    try {
      var L = newsList(), i, seen = {};
      for (i = 0; i < L.length; i++) { L[i].id = i + 1; seen[keyOf(L[i])] = L[i].id; }
      var S = scrapList(), next = 900001;
      for (i = 0; i < S.length; i++) {
        if (!S[i] || !S[i].n) continue;
        var k = keyOf(S[i].n);
        S[i].n.id = (seen[k] !== undefined) ? seen[k] : next++;
      }
    } catch (e) {}
  }

  /* ================= 읽음 : URL 기준 ================= */
  var readSet = {};
  function loadRead() {
    var a = get("nr_read", []);
    readSet = {};
    if (Object.prototype.toString.call(a) === "[object Array]") {
      for (var i = 0; i < a.length; i++) if (typeof a[i] === "string") readSet[a[i]] = 1;
    }
  }
  function saveRead() {
    var out = [], k;
    for (k in readSet) if (readSet.hasOwnProperty(k)) out.push(k);
    put("nr_read", out);
    if (window.readIds) { try { window.readIds = out; } catch (e) {} }
  }
  loadRead();

  /* 기존 번호 기록 → URL 로 한 번만 옮기기 */
  function migrateRead(arr) {
    if (get("nr_read_mig", 0)) return;
    var old = get("nr_read", []), ids = [];
    if (Object.prototype.toString.call(old) === "[object Array]") {
      for (var i = 0; i < old.length; i++) if (typeof old[i] === "number") ids.push(old[i]);
    }
    if (ids.length && arr && arr.length) {
      for (var j = 0; j < arr.length; j++) {
        if (ids.indexOf(arr[j].id) >= 0) { var k = keyOf(arr[j]); if (k) readSet[k] = 1; }
      }
    }
    saveRead();
    put("nr_read_mig", 1);
  }

  function isReadN(n) { var k = keyOf(n); return k ? !!readSet[k] : false; }
  window.isRead = function (id) { return isReadN(byId(id)); };
  function markRead(k) { if (k && !readSet[k]) { readSet[k] = 1; saveRead(); } }
  window.toggleRead = function (id) {
    var k = keyById(id);
    if (!k) return;
    if (readSet[k]) { delete readSet[k]; say("안읽음으로 되돌렸어요"); }
    else { readSet[k] = 1; }
    saveRead();
    if (window.renderRows) window.renderRows();
    if (window.syncSoon) window.syncSoon();
  };

  /* ================= 지운 뉴스 : URL 기준 ================= */
  /* 읽음/스크랩에서 🗑 로 지운 기사. 새 뉴스·읽음·속보 어디에도 다시 안 나온다. */
  var gone = {};
  function loadGone() {
    var a = get("nr_dismiss", []);
    gone = {};
    if (Object.prototype.toString.call(a) === "[object Array]") {
      for (var i = 0; i < a.length; i++) if (typeof a[i] === "string") gone[a[i]] = 1;
    }
  }
  function saveGone() {
    var out = [], k;
    for (k in gone) if (gone.hasOwnProperty(k)) out.push(k);
    put("nr_dismiss", out);
    if (window.syncSoon) window.syncSoon();
  }
  function isGone(n) { var k = keyOf(n); return k ? !!gone[k] : false; }
  loadGone();

  /* ================= 스크랩 : URL 기준 ================= */
  function scrapByKey(k) {
    var S = scrapList();
    for (var i = 0; i < S.length; i++) if (S[i] && S[i].n && keyOf(S[i].n) === k) return S[i];
    return null;
  }
  function scrapOfN(n) { return scrapByKey(keyOf(n)); }
  function isScrapN(n) { return !!scrapOfN(n); }
  window.isScrap = function (id) { return !!scrapByKey(keyById(id)); };
  window.scrapOf = function (id) { return scrapByKey(keyById(id)) || undefined; };

  function addScrap(n) {
    if (!n) return null;
    var k = keyOf(n);
    if (!k) return null;
    var ex = scrapByKey(k);
    if (ex) return ex;
    if (!window.scraps) return null;
    ex = { n: JSON.parse(JSON.stringify(n)), notes: [], memo: "", at: new Date().toISOString().slice(0, 10) };
    window.scraps.push(ex);
    put("nr_scrap", window.scraps);
    if (window.syncSoon) window.syncSoon();
    return ex;
  }
  window.toggleScrap = function (id) {
    var k = keyById(id);
    if (!k) return;
    if (scrapByKey(k)) {
      window.scraps = window.scraps.filter(function (s) { return !(s && s.n && keyOf(s.n) === k); });
      put("nr_scrap", window.scraps);
      if (window.syncSoon) window.syncSoon();
      say("스크랩에서 뺐어요 — 📖읽음 으로 돌아갑니다");
    } else {
      addScrap(byId(id));
    }
    if (window.renderRows) window.renderRows();
  };

  /* ================= 목록 로드 때 ================= */
  var _normalize = window.normalizeNews;
  window.normalizeNews = function (arr) {
    var out = _normalize ? _normalize(arr) : arr;
    try { migrateRead(out); } catch (e) {}
    try {
      var L = out || [], i;
      for (i = 0; i < L.length; i++) {
        L[i].id = i + 1;
        /* 새로고침해도 만들어 둔 요약이 살아 있게 */
        if (L[i].url && window.manSum && window.manSum[L[i].url]) L[i].summary = window.manSum[L[i].url];
        else if (!L[i].summary) {
          var sc = scrapByKey(keyOf(L[i]));
          if (sc && sc.n && sc.n.summary) L[i].summary = sc.n.summary;
        }
      }
    } catch (e) {}
    return out;
  };

  /* ================= 팝업 ================= */
  function closePop() {
    var a = document.getElementById("nrpopBg"); if (a) a.remove();
    var b = document.getElementById("nrmemoBg"); if (b) b.remove();
  }
  function popup(title, text, shareN) {
    closePop();
    var bg = document.createElement("div"); bg.id = "nrpopBg";
    var box = document.createElement("div"); box.id = "nrpop";
    var t = document.createElement("div"); t.className = "t"; t.textContent = title || "";
    var b = document.createElement("div"); b.className = "b"; b.textContent = text || "";
    var x = document.createElement("button"); x.className = "x"; x.textContent = "닫기"; x.onclick = closePop;
    box.appendChild(t); box.appendChild(b);
    if (shareN) {
      var sh = document.createElement("button");
      sh.className = "sh"; sh.textContent = "📤 공유하기";
      sh.onclick = function () { doShare(shareN); };
      box.appendChild(sh);
    }
    box.appendChild(x);
    bg.appendChild(box);
    bg.addEventListener("click", function (e) { if (e.target === bg) closePop(); });
    document.body.appendChild(bg);
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });

  /* ================= 스크랩 메모 한 줄 ================= */
  function openMemo(n) {
    var sc = scrapOfN(n);
    if (!sc) { say("스크랩된 기사만 메모할 수 있어요"); return; }
    closePop();
    var bg = document.createElement("div"); bg.id = "nrmemoBg";
    var box = document.createElement("div"); box.id = "nrmemo";
    var t = document.createElement("div"); t.className = "t"; t.textContent = "✏️ 왜 남겼나요 — " + (n.title || "");
    var ta = document.createElement("textarea");
    ta.placeholder = "예) 하이닉스 HBM 가격 협상 근거 / 다음 주 실적 발표 전 확인";
    ta.value = sc.memo || "";
    var row = document.createElement("div"); row.className = "row";
    var ok = document.createElement("button"); ok.className = "ok"; ok.textContent = "저장";
    var no = document.createElement("button"); no.className = "no"; no.textContent = "닫기";
    ok.onclick = function () {
      sc.memo = ta.value.trim();
      put("nr_scrap", window.scraps);
      if (window.syncSoon) window.syncSoon();
      closePop();
      if (window.renderRows) window.renderRows();
      say(sc.memo ? "메모 저장됨" : "메모 비움");
    };
    no.onclick = closePop;
    row.appendChild(ok); row.appendChild(no);
    box.appendChild(t); box.appendChild(ta); box.appendChild(row);
    bg.appendChild(box);
    bg.addEventListener("click", function (e) { if (e.target === bg) closePop(); });
    document.body.appendChild(bg);
    setTimeout(function () { ta.focus(); }, 120);
  }

  /* ================= 읽기창 열기 = 읽음 처리 (자동 스크랩 없음) ================= */
  var _openReader = window.openReader;
  window.openReader = function (id) {
    var n = byId(id);
    if (n) markRead(keyOf(n));         /* 먼저 읽음 처리 → 원래 함수의 번호 저장이 무의미해짐 */
    if (_openReader) _openReader(id);
    saveRead();                        /* 원래 코드가 덮어썼으면 되돌리기 */
    try { fixReaderSum(n); setupShareBtn(); } catch (e) {}
    if (window.renderRows) window.renderRows();
  };

  /* ================= 요약 : 5줄, 첫 줄이 핵심 ================= */
  function applySummary(n, text) {
    var k = keyOf(n);
    var txt = clean(text);
    n.summary = txt;
    if (n.url && window.manSum) {
      window.manSum[n.url] = txt;
      put("nr_mansum", window.manSum);
      if (window.syncSoon) window.syncSoon();   /* 요약도 컴↔폰 동기화 */
    }
    var L = newsList(), i;
    for (i = 0; i < L.length; i++) if (keyOf(L[i]) === k) L[i].summary = txt;
    var sc = scrapByKey(k);
    if (sc) { sc.n.summary = txt; put("nr_scrap", window.scraps); }
    /* 읽기창이 열려 있으면 그 안의 요약 줄도 바꿔주기 */
    try {
      if (window.curArticle && keyOf(window.curArticle) === k) {
        window.curArticle.summary = txt;
        fixReaderSum(n);
      }
    } catch (e) {}
  }

  /* 표에 보여줄 한 줄 = 5줄 요약을 한 줄로 압축한 문장(▶ 줄). 없으면 첫 줄. */
  function headline(text) {
    var ls = String(text || "").split("\n"), i, l;
    for (i = 0; i < ls.length; i++) {
      l = ls[i].trim();
      if (l.indexOf("▶") === 0) return l.replace(/^▶\s*/, "").trim();
    }
    for (i = 0; i < ls.length; i++) {
      l = ls[i].trim();
      if (l) return l.replace(/^[·\-•]\s*/, "").trim();
    }
    return "";
  }

  /* 팝업에 보여줄 5줄 본문 (▶ 압축 줄은 뺀다) */
  function fiveLines(text) {
    return String(text || "").split("\n").filter(function (l) {
      return l.trim() && l.trim().indexOf("▶") !== 0;
    }).join("\n");
  }

  function popupSummary(n, text) {
    var h = headline(text), b = fiveLines(text);
    popup(n && n.title ? n.title : "", h ? (h + "\n\n" + b) : b, n);
  }

  /* ================= 공유 ================= */
  /* 제목 + 5줄 요약 + 원문 링크를 한 덩어리로 만든다 */
  /* 광고 없는 '깔끔 정리본' 주소 — 받는 사람이 눌러도 바로 정리된 화면이 열린다 */
  function cleanLink(n) {
    if (!n || !n.url || n.url === "#") return "";
    return location.origin + location.pathname + "#a=" + encodeURIComponent(n.url);
  }

  function srcName(n) {
    return n.origin || (n.src === "naver" ? "네이버" : n.src === "google" ? "구글" : "외신");
  }

  function shareText(n) {
    if (!n) return "";
    var out = [];
    out.push("📰 " + (n.title || ""));
    var meta = [srcName(n), n.date || ""].filter(Boolean).join(" · ");
    if (meta) out.push(meta);
    var sum = mySummary(n) || "";
    if (sum) {
      out.push("");
      var h = headline(sum);
      if (h) out.push("▶ " + h);
      var b = fiveLines(sum);
      if (b) out.push(b);
    }
    /* 본문 전문 — 링크를 안 눌러도 뉴스 자체를 읽을 수 있게 */
    var body = String(n.body || "").trim();
    if (body) {
      out.push("");
      out.push(body.length > BODY_MAX ? (body.slice(0, BODY_MAX).trim() + " …(이하 생략)") : body);
    }
    return out.join("\n");   /* 링크는 넣지 않는다 — 정리된 내용만 보낸다 */
  }

  /* 여러 건 한 번에 */
  function shareTextMany(list) {
    var day = "";
    try { day = new Date(Date.now() + 9 * 3600000).toISOString().slice(5, 10).replace("-", "/"); } catch (e) {}
    var out = ["📰 뉴스 정리 " + list.length + "건" + (day ? " (" + day + ")" : ""), ""];
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      out.push((i + 1) + ") " + (n.title || ""));
      var sum = mySummary(n);
      if (sum) { var h = headline(sum); if (h) out.push("   ▶ " + h); }
      /* 여러 건도 링크 없이 제목 + 핵심 한 줄만 */
      out.push("");
    }
    return out.join("\n").trim();
  }

  /* 복사도 공유도 막혔을 때 : 직접 긁어갈 수 있게 보여주기 */
  function shareFallback(n, text) {
    closePop();
    var bg = document.createElement("div"); bg.id = "nrpopBg";
    var box = document.createElement("div"); box.id = "nrpop";
    var t = document.createElement("div"); t.className = "t"; t.textContent = "📤 아래 내용을 복사해서 보내세요";
    var ta = document.createElement("textarea"); ta.className = "cp"; ta.value = text;
    var x = document.createElement("button"); x.className = "x"; x.textContent = "닫기"; x.onclick = closePop;
    box.appendChild(t); box.appendChild(ta); box.appendChild(x);
    bg.appendChild(box);
    bg.addEventListener("click", function (e) { if (e.target === bg) closePop(); });
    document.body.appendChild(bg);
    setTimeout(function () { ta.focus(); ta.select(); }, 120);
  }

  function doShare(n, forcedText, forcedTitle) {
    if (!n && !forcedText) return;
    var text = forcedText || shareText(n);
    if (!text) { say("공유할 내용이 없어요"); return; }
    /* 폰이면 카톡·문자 등 공유창, 컴이면 복사가 더 편하다 */
    var isPhone = false;
    try {
      isPhone = (navigator.maxTouchPoints > 0) && (window.innerWidth <= 900);
    } catch (e) {}
    if (isPhone && navigator.share) {
      var data = { title: forcedTitle || (n && n.title) || "뉴스", text: text };
      navigator.share(data).catch(function (err) {
        if (err && err.name === "AbortError") return;   /* 사용자가 닫은 것 */
        copyShare(n, text);
      });
      return;
    }
    copyShare(n, text);
  }

  function copyShare(n, text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        say("복사했어요 — 붙여넣기 하세요");
      }).catch(function () { shareFallback(n, text); });
      return;
    }
    shareFallback(n, text);
  }

  /* 고른 것 여러 건 공유 */
  window.nrShareSel = function () {
    var sel = window.selected || {};
    var ids = Object.keys(sel).map(Number).filter(function (x) { return !isNaN(x); });
    if (!ids.length) { say("먼저 공유할 뉴스를 선택하세요"); return; }
    var list = [];
    for (var i = 0; i < ids.length; i++) { var n = byId(ids[i]); if (n) list.push(n); }
    if (!list.length) { say("선택한 뉴스를 찾지 못했어요"); return; }
    doShare(null, shareTextMany(list), "뉴스 정리 " + list.length + "건");
  };

  /* ================= 깔끔 정리본 열기 (#a=원문주소) ================= */
  function openByUrl(u) {
    var L = newsList(), i;
    for (i = 0; i < L.length; i++) if (L[i].url === u) { window.openReader(L[i].id); return true; }
    var S = scrapList();
    for (i = 0; i < S.length; i++) if (S[i] && S[i].n && S[i].n.url === u) { window.openReader(S[i].n.id); return true; }
    return false;
  }

  var _deepTries = 0;
  function handleDeepLink() {
    var h = location.hash || "";
    if (h.indexOf("#a=") !== 0) return;
    var u = "";
    try { u = decodeURIComponent(h.slice(3)); } catch (e) { return; }
    if (!u) return;
    if (openByUrl(u)) { _deepTries = 0; return; }
    /* 아직 뉴스가 안 불러와졌을 수 있으니 잠깐 기다렸다 다시 */
    if (_deepTries++ < 20) { setTimeout(handleDeepLink, 800); return; }
    popup("이 뉴스는 지금 목록에 없어요",
      "정리본은 최근 며칠치만 보관돼요.\n아래 주소로 원문을 볼 수 있어요.\n\n" + u);
  }
  window.addEventListener("hashchange", function () { _deepTries = 0; handleDeepLink(); });

  window.nrShare = function (id, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    doShare(byId(id) || window.curArticle);
  };

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* 내가 만든 5줄 요약이 있는가 (수집기가 넣어준 1줄은 여기 안 들어감) */
  function mySummary(n) {
    if (!n || !n.url || !window.manSum) return null;
    return window.manSum[n.url] || null;
  }

  window.rowSummarize = function (id, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();

    var n = byId(id);
    if (!n) return;

    var mine = mySummary(n);
    if (mine) {                        /* 이미 내 요약이 있으면 보여주기만 */
      applySummary(n, mine);
      addScrap(n);
      if (window.renderRows) window.renderRows();
      popupSummary(n, mine);
      return;
    }

    if (!window.AI_KEY) {
      if (window.openKey) window.openKey();
      else say("AI 키를 먼저 넣어주세요");
      return;
    }

    var btn = ev && ev.target && ev.target.closest ? ev.target.closest(".miniai") : null;
    var label = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "요약 중…"; }

    var sys =
      "너는 한국어 뉴스 요약가다. 아래 형식으로만 답한다. 다른 말은 절대 붙이지 않는다.\n\n" +
      "▶ (5줄 요약 전체를 한 문장으로 압축한 한 줄, 45자 내외)\n" +
      "· (핵심 사실 1)\n· (핵심 사실 2)\n· (핵심 사실 3)\n· (핵심 사실 4)\n· (핵심 사실 5)\n\n" +
      "규칙:\n" +
      "- 맨 윗줄은 반드시 ▶ 로 시작하고, 아래 " + LINES + "줄을 다 읽지 않아도 기사를 알 수 있게 압축한다.\n" +
      "- ▶ 줄은 기사 제목을 그대로 옮기지 말고, 내용을 요약한 문장으로 새로 쓴다.\n" +
      "- 그 아래는 정확히 " + LINES + "줄이며 각 줄은 '· ' 로 시작하고 한 줄에 한 가지 사실만 담는다.\n" +
      "- 기사에 없는 내용은 절대 추측해서 쓰지 않는다. 숫자·회사명·인명은 기사에 나온 그대로 옮긴다.";

    var src = (n.title || "") + "\n\n" + String(n.body || n.orig_title || "").slice(0, 6000);

    window.callClaude([{ role: "user", content: src }], sys, function (txt, err) {
      if (btn) { btn.disabled = false; btn.textContent = label || "📝 요약"; }
      if (err || !txt) { say("요약 실패: " + (err || "응답이 비었습니다")); return; }
      var out = clean(txt);
      markRead(keyOf(n));
      applySummary(n, out);
      addScrap(n);                     /* 요약한 기사만 스크랩으로 이동 */
      if (window.renderRows) window.renderRows();
      popupSummary(n, out);
      say("🔖 스크랩으로 옮겼어요");
    });
  };

  /* ================= 삼단 이동 : 목록 걸러내기 ================= */
  var _fallback = false;
  var _currentRows = window.currentRows;

  function importantFallback() {
    var L = newsList(), out = [], i, n;
    for (i = 0; i < L.length; i++) {
      n = L[i];
      if (isReadN(n) || isScrapN(n) || isGone(n)) continue;
      if (n.sig !== "red") continue;
      out.push(n);
    }
    if (window._tval) out.sort(function (a, b) { return window._tval(b) - window._tval(a); });
    return out.slice(0, FALLBACK_MAX);
  }

  window.currentRows = function () {
    var list = _currentRows ? _currentRows() : [];
    _fallback = false;
    try {
      if (window.liveMode) return list;
      var v = curView();
      if (v === "scrap" || v === "gloss") return list;
      /* 검색 중일 때는 이미 읽은/스크랩한 것도 다 보여준다 (안 그러면 검색이 안 됨) */
      if (window.search) return list;
      list = list.filter(function (n) { return !isGone(n); });
      if (v === "all") {
        list = list.filter(function (n) { return !isReadN(n) && !isScrapN(n); });
      } else if (v === "read") {
        list = list.filter(function (n) { return !isScrapN(n); });
      } else if (v === "breaking") {
        list = list.filter(function (n) { return !isReadN(n) && !isScrapN(n); });
        if (!list.length && !window.filterKw && !window.groupFilter) {
          list = importantFallback(); _fallback = list.length > 0;
        }
      }
    } catch (e) {
      if (window.console) console.error("[news_patch] currentRows", e);
    }
    return list;
  };

  /* board 탭에서는 표를 안 그리므로 목록 계산도 건너뛴다 */
  var _curRowsBoard = window.currentRows;
  window.currentRows = function () {
    if (curView() === "board") return [];
    return _curRowsBoard ? _curRowsBoard() : [];
  };

  /* ================= 탭 : 순서·이름·건수 배지 ================= */
  var ORDER = ["breaking", "all", "read", "scrap", "board", "gloss"];
  function tabBtn(v) { return document.querySelector('.tabbar button[data-view="' + v + '"]'); }

  function setupTabs() {
    var bar = document.querySelector(".tabbar");
    if (!bar || bar.dataset.nr3) return;
    var i, b;
    /* 이름 바꾸기 : 전체 → 🆕 새 뉴스 */
    b = tabBtn("all");
    if (b) b.innerHTML = '<span class="ic">🆕</span>새 뉴스';
    /* 이슈·테마 탭 새로 만들기 (스크랩과 용어집 사이에 놓인다) */
    if (!tabBtn("board")) {
      var nb = document.createElement("button");
      nb.setAttribute("data-view", "board");
      nb.innerHTML = '<span class="ic">📰</span>이슈·테마';
      nb.onclick = function () { window.setView("board"); };
      bar.appendChild(nb);
    }
    /* 순서 재배치 : 속보 · 새 뉴스 · 읽음 · 스크랩 · 용어집 · AI */
    for (i = 0; i < ORDER.length; i++) {
      b = tabBtn(ORDER[i]);
      if (b) bar.appendChild(b);
    }
    var ai = document.getElementById("aiTabBtn");
    if (ai) bar.appendChild(ai);
    /* 배지 자리 만들어 두기 */
    for (i = 0; i < ORDER.length; i++) {
      b = tabBtn(ORDER[i]);
      if (b && !b.querySelector(".tb")) {
        var s = document.createElement("span");
        s.className = "tb"; s.style.display = "none";
        b.appendChild(s);
      }
    }
    bar.dataset.nr3 = "1";
  }

  function setBadge(v, num) {
    var b = tabBtn(v);
    if (!b) return;
    var t = b.querySelector(".tb");
    if (!t) return;
    if (num > 0) { t.textContent = num > 99 ? "99+" : String(num); t.style.display = "grid"; }
    else { t.style.display = "none"; }
  }

  function updateBadges() {
    try {
      var L = newsList(), i, n, k;
      var unread = 0, brk = 0, readOnly = 0;
      for (i = 0; i < L.length; i++) {
        n = L[i]; k = keyOf(n);
        if (gone[k]) continue;
        if (scrapByKey(k)) continue;
        if (readSet[k]) { readOnly++; continue; }
        unread++;
        if (window.isBreaking && window.isBreaking(n)) brk++;
      }
      setBadge("breaking", brk);
      setBadge("all", unread);
      setBadge("read", readOnly);
      setBadge("scrap", scrapList().length);
    } catch (e) {}
  }

  /* ================= 안내 줄 (속보 0건일 때) ================= */
  function noteBox() {
    var el = document.getElementById("nrNote");
    if (el) return el;
    var wrap = document.getElementById("tablewrap");
    if (!wrap || !wrap.parentNode) return null;
    el = document.createElement("div");
    el.id = "nrNote";
    el.style.display = "none";
    wrap.parentNode.insertBefore(el, wrap);
    return el;
  }
  function showNote(text) {
    var el = noteBox();
    if (!el) return;
    if (text) { el.textContent = text; el.style.display = "block"; }
    else { el.style.display = "none"; }
  }

  /* ================= 요약 칸 : 5줄 요약을 압축한 한 줄 ================= */
  function decorateSummaryCells() {
    var rows = document.querySelectorAll("tbody tr");
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      var td = tr.querySelector("td.summary");
      if (!td) continue;
      var n = newsOfRow(tr);
      if (!n) continue;
      var mine = mySummary(n);
      var state = keyOf(n) + "|" + (mine ? "1" : "0");
      if (td.dataset.nrk === state) continue;   /* 이미 이 상태로 그려짐 */
      td.dataset.nrk = state;
      td.textContent = "";
      if (mine) {
        var sp = document.createElement("span");
        sp.className = "sumline";
        sp.textContent = headline(mine);
        sp.title = "눌러서 5줄 요약 보기";
        td.appendChild(sp);
      } else {
        /* 아직 내 요약이 없으면 수집기 문장 대신 버튼만 */
        var b = document.createElement("button");
        b.className = "miniai";
        b.textContent = "📝 요약";
        b.setAttribute("onclick", "rowSummarize(" + n.id + ",event)");
        td.appendChild(b);
      }
    }
  }

  /* 읽기창(오른쪽 패널)의 요약 줄 */
  function fixReaderSum(n) {
    var box = document.getElementById("aSum");
    if (!box || !n) return;
    var mine = mySummary(n);
    var link = n.url ? ' &nbsp;<a href="' + n.url + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:800;white-space:nowrap">🔗 기사 원문 열기 ↗</a>' : '';
    if (mine) {
      box.innerHTML = '<b>5줄 요약</b> · <span class="nrsum" style="cursor:pointer;text-decoration:underline dotted">' +
        escHtml(headline(mine)) + '</span>' + link;
      var sp = box.querySelector(".nrsum");
      if (sp) sp.onclick = function () { popupSummary(n, mine); };
    } else {
      box.innerHTML = '<b>5줄 요약</b> · <button class="miniai" onclick="rowSummarize(' + n.id + ',event)">📝 요약 만들기</button>' + link;
    }
  }

  /* ================= 🖨️ 브리핑 : A4 한 장 인쇄 ================= */
  function briefHTML(list, cols) {
    var day = "";
    try { day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); } catch (e) {}
    var css = [
      "@page{size:A4;margin:10mm}",
      "*{box-sizing:border-box}",
      "body{margin:0;padding:10mm;font-family:-apple-system,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#16181d}",
      ".bar{position:sticky;top:0;display:flex;gap:8px;align-items:center;padding:10px 0 14px;background:#fff}",
      ".bar button{border:1px solid #d9dde5;background:#fff;border-radius:9px;padding:8px 13px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}",
      ".bar .go{background:#3b57c9;color:#fff;border-color:#3b57c9}",
      ".bar .sp{flex:1}",
      "h1{font-size:15pt;margin:0 0 2mm}",
      ".sub{font-size:9pt;color:#6b7280;margin:0 0 5mm;padding-bottom:3mm;border-bottom:1.5px solid #16181d}",
      ".wrap{column-gap:8mm}",
      ".c2{column-count:2}.c3{column-count:3}",
      ".it{break-inside:avoid;-webkit-column-break-inside:avoid;page-break-inside:avoid;margin:0 0 4.5mm}",
      ".t{font-size:9.8pt;font-weight:700;line-height:1.35;margin:0 0 1mm}",
      ".hd{font-size:8.8pt;font-weight:700;line-height:1.4;color:#16181d;margin:0 0 1mm}",
      ".s{font-size:8.6pt;line-height:1.45;color:#2b2f36;margin:0 0 1mm;white-space:pre-wrap}",
      ".s.sub{color:#6b7280}",
      ".m{font-size:7.6pt;color:#8b919b}",
      ".sig{font-size:8pt;margin-right:2px}",
      ".it{position:relative}",
      ".x{position:absolute;top:-1mm;right:-2mm;border:0;background:none;color:#c2c7d0;font-size:11pt;",
      "cursor:pointer;line-height:1;padding:2px 4px;font-family:inherit}",
      ".x:hover{color:#e0294a}",
      "@media print{.bar{display:none}.x{display:none}body{padding:0}}"
    ].join("");

    var items = list.map(function (n, i) {
      var sum = mySummary(n);
      var head = sum ? headline(sum) : "";
      var body = sum ? fiveLines(sum) : "";
      /* 내 요약이 없으면 수집기가 준 한 줄이라도 싣는다 (제목만 나오던 문제) */
      var sub = "";
      if (!sum && n.summary) sub = String(n.summary).trim();
      var sig = n.sig === "red" ? "🔴" : n.sig === "orange" ? "🟠" : "";
      var meta = [srcName(n), (window.fmtDate ? window.fmtDate(n.date, n) : (n.date || ""))].filter(Boolean).join(" · ");
      var ttl = String(n.title || "").replace(/\s+-\s+[^-]{1,24}$/, "");   /* 제목 끝의 " - 출처" 떼기 */
      return '<div class="it" data-s="' + (head || body || sub ? "1" : "0") + '">' +
        '<button class="x" onclick="del(this)" title="이 뉴스 빼기">✕</button>' +
        '<div class="t"><span class="sig">' + sig + "</span>" + escHtml(ttl) + "</div>" +
        (head ? '<div class="hd">' + escHtml(head) + "</div>" : "") +
        (body ? '<div class="s">' + escHtml(body) + "</div>" : "") +
        (sub ? '<div class="s sub">' + escHtml(sub) + "</div>" : "") +
        '<div class="m">' + escHtml(meta) + "</div>" +
        "</div>";
    }).join("");

    return "<!doctype html><html lang='ko'><head><meta charset='utf-8'>" +
      "<title>뉴스 브리핑 " + day + "</title><style>" + css + "</style></head><body>" +
      '<div class="bar">' +
      '<button class="go" onclick="window.print()">🖨️ 인쇄</button>' +
      "<button onclick=\"document.getElementById('w').className='wrap c2'\">2열</button>" +
      "<button onclick=\"document.getElementById('w').className='wrap c3'\">3열</button>" +
      "<button id=\"onlys\" onclick=\"onlySum()\">📝 요약된 것만</button>" +
      '<span class="sp"></span><span style="font-size:12px;color:#8b919b">인쇄 전에 열 수를 골라보세요</span>' +
      "</div>" +
      "<h1>📰 뉴스 브리핑</h1>" +
      '<div class="sub">' + day + ' · 총 <b id="cnt">' + list.length + "</b>건 " +
      '<span style="color:#b3b9c4">· 빼고 싶은 건 ✕</span></div>' +
      '<div id="w" class="wrap c' + cols + '">' + items + "</div>" +
      "<script>function cnt(){document.getElementById('cnt').textContent=" +
      "document.querySelectorAll('.it:not([hidden])').length;}" +
      "function del(b){b.parentNode.remove();cnt();}" +
      "var only=false;function onlySum(){only=!only;" +
      "document.querySelectorAll('.it').forEach(function(e){" +
      "e.hidden = only && e.getAttribute('data-s')!=='1';});" +
      "document.getElementById('onlys').textContent = only? '📄 전체 보기':'📝 요약된 것만';cnt();}<\/script>" +
      "</body></html>";
  }

  window.nrBrief = function () {
    var list = [], picked = [];
    /* 체크해 둔 게 있으면 그것만, 없으면 지금 보고 있는 목록 전부 */
    try {
      var sel = window.selected || {};
      Object.keys(sel).forEach(function (k) { var n = byId(Number(k)); if (n) picked.push(n); });
    } catch (e) {}
    if (picked.length) list = picked;
    else {
      try {
        var all = (window.currentRows() || []).slice();
        /* 내가 요약해 둔 기사를 앞으로 — 브리핑에 제목만 줄줄이 나오던 문제 */
        var withSum = [], noSum = [];
        all.forEach(function (n) { (mySummary(n) ? withSum : noSum).push(n); });
        list = withSum.concat(noSum).slice(0, 60);
      } catch (e) {}
    }
    if (!list.length) { say("브리핑에 담을 뉴스가 없어요"); return; }
    var w = window.open("", "_blank");
    if (!w) { say("팝업이 막혔어요 — 주소창 옆 팝업 허용을 켜주세요"); return; }
    w.document.open();
    w.document.write(briefHTML(list, 2));
    w.document.close();
    say(list.length + "건으로 브리핑을 만들었어요" + (picked.length ? " (선택한 것만)" : ""));
  };

  /* 상단에 [🖨️ 브리핑] 버튼 달기 + 최신/중요를 버튼줄로 옮겨 한 줄 유지 */
  function setupBriefBtn() {
    var bar = document.querySelector(".actbar");
    if (!bar) return;
    try {
      var seg = document.querySelector(".controls > .seg");
      if (seg) bar.appendChild(seg);
    } catch (e) {}
    if (bar.querySelector(".nrbrief")) return;
    var anchor = null;
    var bs = bar.querySelectorAll("button");
    for (var i = 0; i < bs.length; i++) {
      if ((bs[i].getAttribute("onclick") || "").indexOf("openSummary") >= 0) { anchor = bs[i]; break; }
    }
    var b = document.createElement("button");
    b.className = "sumbtn nrbrief";
    b.textContent = "🖨️ 브리핑";
    b.title = "지금 보는 목록을 A4 한 장으로 인쇄";
    b.onclick = function () { window.nrBrief(); };
    if (anchor && anchor.nextSibling) bar.insertBefore(b, anchor.nextSibling);
    else bar.appendChild(b);
  }

  /* 읽기창 헤더에 [📤 공유] 버튼 (원문 버튼 앞에) */
  function setupShareBtn() {
    var host = document.querySelector("#reader .r-actions");
    if (!host || host.querySelector(".nrshare")) return;
    var b = document.createElement("button");
    b.className = "r-btn nrshare";
    b.textContent = "📤 공유";
    b.title = "제목 + 5줄 요약 + 원문 링크를 공유";
    b.onclick = function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      var n = window.curArticle;
      if (!n) { say("기사를 먼저 열어주세요"); return; }
      doShare(n);
    };
    var orig = document.getElementById("rOrig");
    if (orig && orig.parentNode === host) host.insertBefore(b, orig);
    else host.appendChild(b);
  }

  /* 표 머리글 : 한 줄 요약 → 5줄 요약 */
  function fixHead() {
    try {
      var ths = document.querySelectorAll("#theadRow th");
      for (var i = 0; i < ths.length; i++) {
        if ((ths[i].textContent || "").trim() === "한 줄 요약") { ths[i].textContent = "5줄 요약"; return; }
      }
    } catch (e) {}
  }

  /* 요약 칸 클릭 → 전체 보기 */
  document.addEventListener("click", function (e) {
    if (!e.target.closest) return;
    if (e.target.closest(".miniai")) return;        /* 요약 버튼은 원래대로 */
    if (e.target.closest(".nrmemochip")) return;    /* 메모 칩은 따로 */
    var cell = e.target.closest("tbody td.summary");
    if (!cell) return;
    var n = newsOfRow(cell.closest("tr"));
    if (!n) return;
    var s = mySummary(n);
    if (!s) return;
    e.preventDefault();
    e.stopPropagation();
    popupSummary(n, s);
  }, true);

  /* ================= 스크랩 메모 칸 ================= */
  function decorateMemoCells() {
    if (curView() !== "scrap") return;
    var rows = document.querySelectorAll("tbody tr");
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      var sum = tr.querySelector("td.summary");
      if (!sum) continue;
      var td = sum.nextElementSibling;              /* 요약 칸 다음이 메모(💬) 칸 */
      if (!td || td.querySelector(".nrmemochip")) continue;
      var n = newsOfRow(tr);
      if (!n) continue;
      var sc = scrapOfN(n);
      if (!sc) continue;
      var noteN = (sc.notes && sc.notes.length) ? sc.notes.length : 0;
      td.innerHTML = "";
      var chip = document.createElement("span");
      chip.className = "nrmemochip" + (sc.memo ? "" : " empty");
      chip.textContent = sc.memo ? ("✏️ " + sc.memo) : "✏️";
      chip.title = sc.memo || "메모 남기기";
      chip.onclick = function (nn) {
        return function (ev) { ev.stopPropagation(); openMemo(nn); };
      }(n);
      td.appendChild(chip);
      if (noteN) {
        var p = document.createElement("span");
        p.className = "notepill";
        p.textContent = "💬" + noteN;
        p.style.marginLeft = "4px";
        td.appendChild(p);
      }
    }
  }

  /* ================= 컴 ↔ 폰 동기화 보강 ================= */
  /* 원래 userdata.json 에는 스크랩·읽음·키워드만 담겨서, 내가 만든 5줄 요약은
     다른 기기에서 안 보였다. 요약(nr_mansum)과 지운 목록(nr_dismiss)을 함께 싣는다. */
  var _payload = window.syncPayload;
  window.syncPayload = function () {
    var d = _payload ? _payload() : { v: 1, ts: Date.now() };
    try {
      d.mansum = get("nr_mansum", {});
      d.dismiss = get("nr_dismiss", []);
      d.pv = 5;
    } catch (e) {}
    return d;
  };

  var _apply = window.applyPayload;
  window.applyPayload = function (d) {
    if (_apply) _apply(d);
    try {
      if (d && d.mansum) { put("nr_mansum", d.mansum); window.manSum = d.mansum; }
      if (d && d.dismiss) { put("nr_dismiss", d.dismiss); }
      loadRead();
      loadGone();
      /* 받아온 요약을 지금 목록에 다시 입히기 */
      var L = newsList(), i, u;
      for (i = 0; i < L.length; i++) {
        u = L[i].url;
        if (u && window.manSum && window.manSum[u]) L[i].summary = window.manSum[u];
      }
      if (window.renderRows) window.renderRows();
    } catch (e) {
      if (window.console) console.error("[news_patch] applyPayload", e);
    }
  };

  /* 저장(push)이 왜 실패했는지 알려주기 —
     원래 코드는 실패해도 작은 뱃지만 바뀌어서 몇 달을 모르고 지나갈 수 있었다. */
  function syncFile() { return window.SYNC_FILE || "userdata.json"; }
  var _pushBusy = false;
  var _pulledOnce = false;
  var _lastPull = 0;

  /* 받아오기가 끝났는지 표시 — 새 기기(폰)가 빈 내용으로 컴 자료를 덮어쓰는 사고를 막는다 */
  var _pull = window.syncPull;
  window.syncPull = function (cb) {
    if (!_pull) { if (cb) cb(false); return; }
    _pull(function (ok, d) {
      _pulledOnce = true;
      _lastPull = Date.now();
      if (cb) cb(ok, d);
    });
  };

  window.syncPush = function () {
    if (!window.GH_TOKEN || !window.GH_REPO) { say("동기화하려면 ⚙️ 에서 GitHub 토큰을 넣어주세요"); return; }
    if (_pushBusy) return;
    if (!_pulledOnce) {                     /* 아직 한 번도 안 받아왔으면 받아온 뒤에 저장 */
      _pulledOnce = true;
      window.syncPull(function () { setTimeout(window.syncPush, 400); });
      return;
    }
    _pushBusy = true;
    var badge = document.getElementById("syncBadge");
    if (badge) { badge.textContent = "⏳ 동기화 중"; badge.style.opacity = "1"; }

    var body = JSON.stringify(window.syncPayload(), null, 2);
    var content = btoa(unescape(encodeURIComponent(body)));
    var url = "https://api.github.com/repos/" + window.GH_REPO + "/contents/" + syncFile();
    var payload = { message: "sync userdata", content: content };
    if (window._syncSha) payload.sha = window._syncSha;

    fetch(url, { method: "PUT", headers: window._ghHeaders(), body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (o) {
        _pushBusy = false;
        if (o.j && o.j.content) {
          window._syncSha = o.j.content.sha;
          if (badge) { badge.textContent = "✅ 저장됨"; setTimeout(function () { badge.style.opacity = "0"; }, 1500); }
          return;
        }
        if (badge) { badge.textContent = "🟠 실패"; badge.style.opacity = "1"; }
        if (o.s === 401) say("동기화 실패: 토큰이 만료됐거나 잘못됐어요 (⚙️에서 다시 넣기)");
        else if (o.s === 403) say("동기화 실패: 토큰에 Contents 쓰기 권한이 없어요");
        else if (o.s === 404) say("동기화 실패: 저장소를 못 찾아요 — 토큰 권한(Contents) 확인");
        else if (o.s === 409 || o.s === 422) {
          say("다른 기기 내용과 겹쳐요 — 불러온 뒤 다시 저장할게요");
          if (window.syncPull) window.syncPull(function () { setTimeout(window.syncPush, 600); });
        } else say("동기화 실패 (" + o.s + ")");
      })
      .catch(function () {
        _pushBusy = false;
        if (badge) { badge.textContent = "🟠 실패"; badge.style.opacity = "1"; }
        say("동기화 실패: 네트워크 오류");
      });
  };

  /* 화면을 다시 켜면(폰에서 앱 전환 후 복귀 등) 최신 내용 받아오기 */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - _lastPull < 60000) return;      /* 1분에 한 번까지만 */
    if (!window.GH_TOKEN || !window.GH_REPO) return;
    _lastPull = Date.now();
    try { if (window.syncPull) window.syncPull(); } catch (e) {}
  });

  /* ================= 지우기 ================= */
  function killOne(n, silent) {
    if (!n) return;
    var k = keyOf(n);
    if (!k) return;
    /* 스크랩이면 스크랩에서도 빼고, 다시 안 나오게 지운 목록에 넣는다 */
    if (scrapByKey(k) && window.scraps) {
      window.scraps = scrapList().filter(function (s) { return !(s && s.n && keyOf(s.n) === k); });
      put("nr_scrap", window.scraps);
    }
    gone[k] = 1;
    saveGone();
    if (!silent) say("지웠어요");
  }

  window.nrKill = function (id, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    killOne(byId(id));
    if (window.renderRows) window.renderRows();
  };

  /* 여러 건 선택 삭제 (읽음·스크랩 공용) */
  window.selDelete = function () {
    var sel = window.selected || {};
    var ids = Object.keys(sel).map(Number).filter(function (x) { return !isNaN(x); });
    if (!ids.length) { say("선택된 항목이 없어요"); return; }
    if (!window.confirm(ids.length + "건을 지울까요?\n(새 뉴스·읽음·스크랩 어디에도 다시 안 나와요)")) return;
    for (var i = 0; i < ids.length; i++) killOne(byId(ids[i]), true);
    window.selected = {};
    if (window.setSelUI) window.setSelUI();
    if (window.renderRows) window.renderRows();
    say(ids.length + "건 지웠어요");
  };

  /* 지금 탭에 보이는 것 전부 지우기 */
  window.nrKillAll = function () {
    var list = [];
    try { list = window.currentRows() || []; } catch (e) {}
    if (!list.length) { say("지울 게 없어요"); return; }
    var v = curView();
    var name = (v === "scrap") ? "스크랩" : (v === "read") ? "읽음" : "이 목록";
    if (!window.confirm(name + "에 있는 " + list.length + "건을 모두 지울까요?")) return;
    for (var i = 0; i < list.length; i++) killOne(list[i], true);
    window.selected = {};
    if (window.setSelUI) window.setSelUI();
    if (window.renderRows) window.renderRows();
    say(list.length + "건 지웠어요");
  };

  /* 읽음 탭에서도 선택 삭제 툴바를 쓸 수 있게 + '모두 지우기' 버튼 달기 */
  var _setView = window.setView;
  window.setView = function (v) {
    if (_setView) _setView(v);
    try {
      /* 이슈·테마 탭 : 표·검색·필터를 감추고 보드만 보여준다 */
      if (v === "board") {
        var bw = document.getElementById("boardWrap");
        if (bw) bw.style.display = "block";
        var gv = document.getElementById("glossView");
        if (gv) gv.style.display = "none";
        var sg = document.getElementById("surge");
        if (sg) sg.style.display = "flex";
        ["tablewrap", "controls", "filters", "moreBox", "emptyBox"].forEach(function (id) {
          var e = document.getElementById(id);
          if (e) e.style.display = "none";
        });
        var sb0 = document.getElementById("selbar");
        if (sb0) sb0.classList.remove("on");
      }
    } catch (e) {}
    try {
      var sb = document.getElementById("selbar");
      if (v === "read") {
        window.selMode = true;
        window.selected = {};
        if (sb) sb.classList.add("on");
        if (window.setSelUI) window.setSelUI();
        if (window.toggleChkCol) window.toggleChkCol();
        if (window.renderRows) window.renderRows();
      }
      if (sb) {
        var shb = sb.querySelector(".nrsh");
        if (v === "read" || v === "scrap") {
          if (!shb) {
            shb = document.createElement("button");
            shb.className = "clr nrsh";
            shb.textContent = "📤 선택 공유";
            shb.onclick = function () { window.nrShareSel(); };
            sb.appendChild(shb);
          }
          shb.style.display = "";
        } else if (shb) { shb.style.display = "none"; }
        var all = sb.querySelector(".nrall");
        if (v === "read" || v === "scrap") {
          if (!all) {
            all = document.createElement("button");
            all.className = "clr nrall";
            all.textContent = "🧹 모두 지우기";
            all.onclick = function () { window.nrKillAll(); };
            sb.appendChild(all);
          }
          all.style.display = "";
        } else if (all) { all.style.display = "none"; }
      }
    } catch (e) {
      if (window.console) console.error("[news_patch] setView", e);
    }
  };

  /* 줄마다 🗑 (읽음·스크랩 탭에서만) */
  function decorateDeleteButtons() {
    var v = curView();
    if (v !== "read" && v !== "scrap") return;
    var rows = document.querySelectorAll("tbody tr");
    for (var i = 0; i < rows.length; i++) {
      var act = rows[i].querySelector(".rowact");
      if (!act || act.querySelector(".nrdel")) continue;
      var n = newsOfRow(rows[i]);
      if (!n) continue;
      var b = document.createElement("span");
      b.className = "nrdel";
      b.textContent = "🗑";
      b.title = "이 뉴스 지우기";
      b.setAttribute("onclick", "nrKill(" + n.id + ",event)");
      act.appendChild(b);
    }
  }

  /* ================= 렌더 감싸기 ================= */
  var _renderRows = window.renderRows;
  var _inRender = 0;
  window.renderRows = function () {
    if (_inRender) return;
    _inRender = 1;
    try {
      loadRead();
      loadGone();
      reindex();
      if (_renderRows) _renderRows();
      decorateSummaryCells();
      decorateMemoCells();
      decorateDeleteButtons();
      setupTabs();
      setupBriefBtn();
      fixHead();
      updateBadges();
      showNote(_fallback ? "⚡ 지금 새 속보는 없어요 — 대신 아직 안 읽은 🔴 중요 뉴스를 보여드립니다." : "");
    } catch (e) {
      if (window.console) console.error("[news_patch] renderRows", e);
    }
    _inRender = 0;
  };

  /* 표가 다시 그려질 때마다 다시 손보기 */
  function watch() {
    var tb = document.querySelector("tbody");
    if (!tb) { setTimeout(watch, 500); return; }
    new MutationObserver(function () {
      decorateSummaryCells();
      decorateMemoCells();
      decorateDeleteButtons();
    }).observe(tb, { childList: true, subtree: true });

    setupTabs();
    fixHead();
    setupShareBtn();
    setupBriefBtn();
    handleDeepLink();
    decorateSummaryCells();
    updateBadges();

    /* 켜면 ⚡속보 화면부터 */
    if (!window.__nrLanded) {
      window.__nrLanded = 1;
      setTimeout(function () {
        try { if (window.setView && !window.liveMode) window.setView("breaking"); } catch (e) {}
      }, 400);
    }

    /* 헤더 버전 표시 */
    try {
      var sp = document.querySelectorAll(".hmeta span");
      for (var i = 0; i < sp.length; i++) {
        if (/^v\d/.test((sp[i].textContent || "").trim()) && sp[i].textContent.indexOf("patch") < 0) {
          sp[i].textContent = sp[i].textContent.trim() + " · patch " + VER;
          break;
        }
      }
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();

  if (window.console) console.log("[news_patch] " + VER + " 적용됨 — 정리본 공유 · 선택 공유 · A4 브리핑");
})();
