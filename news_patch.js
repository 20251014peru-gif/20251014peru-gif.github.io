/* news_patch.js — 뉴스레이더 보강 패치 v18 (2026-08-30)
 *
 * v18 : 읽음·스크랩 이동이 되돌아가던 문제 (동기화가 덮어쓰고 있었다)
 *   증상 : 뉴스를 읽고 요약했는데 잠시 뒤 스크랩에 없다.
 *   원인 : 1분에 한 번 도는 syncPull 이 받아온 내용으로 scraps 를 통째로 갈아치웠다.
 *          방금 이 기기에서 넣은 스크랩이 아직 안 올라간 상태면 그대로 사라진다.
 *          실제 userdata.json 에 내 요약 5건 / 스크랩 4건 으로 1건이 빠져 있었다.
 *   해결 : 읽음·스크랩을 '켠 시각(nr_on)' 과 '끈 시각(nr_off)' 으로 도장 찍어 두고,
 *          받아온 내용과 합칠 때 항목마다 늦게 누른 쪽이 이기게 했다.
 *          내 요약·지운 목록도 덮어쓰기가 아니라 합치기로 바꿨다.
 *
 * ↓ v17 원본 설명
 *
 * v17 : 실제 요약 결과 4건을 보고 요약 틀을 다듬음
 *   ① 사건 틀 4번 칸 '시장 반응' → '영향받는 곳'.
 *      정치·정책·채권발행 기사에는 시장 반응이 아예 없어서 칸이 늘 비었고,
 *      AI 가 그 빈칸을 엉뚱한 내용(발언자의 추가 주장)으로 메우고 있었다.
 *   ② 모든 줄에 '· 칸이름: 내용' 형태를 강제. 어느 칸이 비었는지 눈으로 바로 보이게.
 *   ③ 투자 관련성 판정 기준을 구체화 — 살 것·팔 것·지켜볼 것이 떠오르지 않으면
 *      유형이 무관이 아니어도 마지막 칸에 '(투자 관련성 낮음 — 이유)' 를 붙인다.
 *      정치 공방·인사·행정·행사 기사가 여기 해당한다.
 *
 * ↓ v16 원본 설명
 *
 * v16 : 폰에서 칸 순서를 바꿔 좌우 스크롤 없이 제목이 보이게
 *   원래 : [체크] ● 시간 출처 키워드 | 제목 요약 | 메모 신호 원문 ⭐
 *   폰   : [체크] ● | 제목 요약 | 시간 출처 키워드 메모 신호 원문 ⭐
 *   시간·출처·키워드가 왼쪽에서 280px 을 먹어 제목이 화면 밖으로 밀리던 문제.
 *   표가 table-layout:fixed 라 <td> 뿐 아니라 <th> 와 colgroup 의 <col> 도 같이 옮긴다.
 *   컴(761px 이상)에서는 원래 순서 그대로. 화면을 돌리면 자동으로 다시 맞춘다.
 *
 * ↓ v15 원본 설명
 *
 * v15 : 5줄 요약을 '기사 종류별 틀' 로 다시 정의
 *   뉴스는 종류마다 쓰이는 방식이 다르다.
 *     사건 기사 = 역피라미드(중요한 것부터), 해설·칼럼 = 논증(결론과 근거),
 *     시황 기사 = 수치 나열. 한 가지 틀로 찍으면 억지 문장이 나온다.
 *   그래서 AI 가 먼저 유형(사건/시황/종목/해설/무관)을 가리고,
 *   그 유형에 맞는 5칸을 채운다. ▶ 줄 앞에 [유형] 이 붙고 표에서는 색 칩으로 보인다.
 *   투자와 관계없는 기사는 [무관] 으로 표시되고 이유가 함께 나온다.
 *   칸 내용이 기사에 없으면 지어내지 말고 '기사에 언급 없음' 이라고 쓰게 했다.
 *
 * ↓ v14 원본 설명
 *
 * v14 에서 한 것
 *   ① 5줄 요약을 '한 줄 쓰고 한 줄 띄우기' 로 — 팝업·공유·브리핑 모두 적용
 *   ② 제목·요약이 두 줄 안에 '다' 나오게 (잘려나가던 문제)
 *      - 제목칸 470px / 요약칸 620px 로 넓힘 (표가 화면보다 넓어지면 좌우 스크롤)
 *      - 제목 끝의 " - 언론사" 꼬리 제거 (원제목은 마우스 올리면 나옴)
 *      - 그래도 두 줄을 넘치면 그 칸만 글자 크기를 자동으로 줄인다 (13px → 최소 9.5px)
 *
 * ↓ v13 원본 설명
 *
 * v13 : v12 가 만든 사고 하나 수습
 *   · 읽기창(제목 눌러 열리는 화면) 헤더의 기사 제목이 한 글자씩 세로로 쌓이던 문제.
 *     v12 에서 말줄임표를 없애려고 white-space:normal 을 준 것이 원인 — 헤더는
 *     [목록][기사/AI][지금 저장][공유] 가 폭을 다 차지해 제목 칸이 0 에 가깝게 눌린다.
 *     한 줄 유지로 되돌리고, 폰에서는 헤더 제목을 감췄다(바로 아래 큰 글씨로 다시 나옴).
 *
 * ↓ v12 원본 설명
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
  if (window.__nrPatch >= 18) return;
  window.__nrPatch = 18;

  var LINES = 5;
  var VER = "v18";
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
    "text-wrap:balance;max-width:100%}",
    "tbody td.summary .sumline{display:block!important;line-height:1.4;max-height:2.8em!important;",
    "overflow:hidden;text-overflow:clip!important;",
    "white-space:normal;word-break:keep-all;overflow-wrap:break-word;",
    "text-wrap:balance;max-width:100%}",
    /* 제목·요약 칸을 넓게 — 두 줄에 글이 다 들어가게 한다.
       표가 화면보다 넓어지지만 .tablewrap 이 overflow-x:auto 라 좌우로 밀린다. */
    "table{min-width:1700px!important}",
    "col.c-title{width:470px!important} col.c-sum{width:620px!important}",
    "@media(max-width:760px){table{min-width:1240px!important}",
    "col.c-title{width:318px!important} col.c-sum{width:430px!important}}",
    /* 말줄임표는 어디서도 쓰지 않는다 */
    "tbody td{text-overflow:clip!important}",
    /* 읽기창 헤더 제목 : 한 줄 유지(말줄임표는 안 붙임).
       white-space:normal 로 두면 버튼들이 폭을 다 먹어 제목이 한 글자씩 세로로 쌓인다(v12 사고). */
    ".r-head .rt h2{text-overflow:clip!important;white-space:nowrap!important;overflow:hidden}",
    /* 폰에서는 헤더에 제목을 아예 넣지 않는다 — 바로 아래 큰 글씨로 다시 나오므로 중복이다 */
    "@media(max-width:760px){.r-head .rt{display:none!important}",
    ".r-head{gap:8px}}",
    /* 폰에서도 칸 폭을 그대로 다 쓴다 (예전 250/300px 제한이 글을 잘라먹었다) */
    "@media(max-width:760px){",
    "tbody .title{max-width:100%}",
    "tbody td.summary .sumline{max-width:100%}",
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
    ".nrmemochip.empty{background:transparent;color:#b3b9c4;font-weight:600}",
    /* 요약 앞의 기사 유형 표시 */
    ".nrtype{display:inline-block;margin-right:5px;padding:1px 6px;border-radius:6px;",
    "font-size:10.5px;font-weight:800;vertical-align:1px;white-space:nowrap}",
    ".nrtype.t-사건{background:#FDE8EC;color:#c2274a}",
    ".nrtype.t-시황{background:#E7F0FF;color:#2a4bb8}",
    ".nrtype.t-종목{background:#E6F6EC;color:#1c7a45}",
    ".nrtype.t-해설{background:#F3EAFD;color:#6b34b5}",
    ".nrtype.t-무관{background:#F1F2F5;color:#8b919b}"
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
  /* ── 기기 사이 합치기용 도장 ──
     읽음·스크랩을 '켠 시각' 과 '끈 시각' 으로 각각 기록해 둔다.
     기기 두 대가 각자 바꾼 내용을 합칠 때, 항목마다 마지막에 누른 쪽이 이긴다.
     예전에는 받아온 내용으로 통째로 덮어써서, 방금 스크랩한 게 1분 뒤 사라졌다. */
  var onTs = get("nr_on", {});
  var offTs = get("nr_off", {});
  function tsKey(kind, k) { return kind + "|" + k; }
  function stampOn(kind, k) {
    if (!k) return;
    onTs[tsKey(kind, k)] = Date.now();
    put("nr_on", onTs);
  }
  function stampOff(kind, k) {
    if (!k) return;
    offTs[tsKey(kind, k)] = Date.now();
    put("nr_off", offTs);
  }
  function isOn(kind, k) {
    return (onTs[tsKey(kind, k)] || 0) >= (offTs[tsKey(kind, k)] || 0) &&
           (onTs[tsKey(kind, k)] || 0) > 0;
  }

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
  function markRead(k) {
    if (!k) return;
    if (!readSet[k]) { readSet[k] = 1; saveRead(); }
    stampOn("r", k);
  }
  window.toggleRead = function (id) {
    var k = keyById(id);
    if (!k) return;
    if (readSet[k]) { delete readSet[k]; stampOff("r", k); say("안읽음으로 되돌렸어요"); }
    else { readSet[k] = 1; stampOn("r", k); }
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
    stampOn("s", k);
    if (window.syncSoon) window.syncSoon();
    return ex;
  }
  window.toggleScrap = function (id) {
    var k = keyById(id);
    if (!k) return;
    if (scrapByKey(k)) {
      window.scraps = window.scraps.filter(function (s) { return !(s && s.n && keyOf(s.n) === k); });
      put("nr_scrap", window.scraps);
      stampOff("s", k);
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
    /* 한 줄 쓰고 한 줄 띄워서 읽기 쉽게 (팝업·공유·브리핑 공통) */
    return String(text || "").split("\n").filter(function (l) {
      return l.trim() && l.trim().indexOf("▶") !== 0;
    }).join("\n\n");
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

    /* 기사 종류를 먼저 가리고, 그 종류에 맞는 5칸으로 요약한다.
       뉴스는 종류마다 쓰는 방식이 달라서(사건=역피라미드, 해설=논증, 시황=수치나열)
       한 가지 틀로 찍으면 억지 문장이 나온다. */
    var sys =
      "너는 한국투자자를 위한 뉴스 요약가다. 아래 형식으로만 답한다. 다른 말은 절대 붙이지 않는다.\n\n" +
      "형식:\n" +
      "▶ [유형] 기사 전체를 한 문장으로 압축 (45자 내외)\n" +
      "· (1번 칸)\n· (2번 칸)\n· (3번 칸)\n· (4번 칸)\n· (5번 칸)\n\n" +

      "1단계 — 유형을 하나 고른다:\n" +
      "  사건 : 무슨 일이 실제로 일어났다 (발표·결정·발언·계약·규제·사고)\n" +
      "  시황 : 지수·환율·금리·유가의 그날 움직임과 마감\n" +
      "  종목 : 특정 기업의 실적·수주·목표주가·투자의견\n" +
      "  해설 : 필자나 기관의 주장과 근거가 중심인 칼럼·전망·분석\n" +
      "  무관 : 투자 판단과 관계없는 기사 (지자체 소식, 홍보, 생활, 연예, 스포츠)\n\n" +

      "2단계 — 고른 유형의 5칸을 채운다:\n" +
      "  사건 → 1 무슨 일 / 2 수치 / 3 배경 / 4 영향받는 곳 / 5 다음 확인\n" +
      "         4번은 시장 반응이 기사에 있으면 그것을 쓰고, 없으면 이 일로 어느 업종·자산·정책이 " +
      "걸려 있는지를 기사에 나온 범위 안에서 쓴다. 정치·정책·발행 기사는 시장 반응이 없는 것이 보통이다.\n" +
      "  시황 → 1 지수·가격이 얼마나 움직였나 / 2 누가 사고 팔았나(수급) / " +
      "3 오른 업종·종목 / 4 내린 업종·종목 / 5 다음 장의 변수\n" +
      "  종목 → 1 어느 회사에 무슨 일이 / 2 실적·수주 수치 / 3 그렇게 된 이유 / " +
      "4 주가·목표주가·투자의견에 준 영향 / 5 다음에 확인할 일정\n" +
      "  해설 → 1 필자의 결론(주장) / 2 근거 하나 / 3 근거 둘 / " +
      "4 이 주장이 성립하려면 필요한 전제나 반대 논리 / 5 누가 한 말인지(필자·기관)\n" +
      "  무관 → 1 무슨 내용인지 한 줄 / 2~5 는 '· 투자 관련성 낮음 — (이유)' 를 2번 칸에만 쓰고 " +
      "3·4·5번 칸은 만들지 않는다 (이 경우에만 줄 수가 2줄이다)\n\n" +

      "지켜야 할 것:\n" +
      "- ▶ 줄은 반드시 ▶ 로 시작하고 그 뒤에 [사건] [시황] [종목] [해설] [무관] 중 하나를 대괄호로 붙인다.\n" +
      "- ▶ 줄은 기사 제목을 그대로 옮기지 말고, 내용을 압축한 문장으로 새로 쓴다.\n" +
      "- 아래 줄은 각각 '· ' 로 시작하고, 한 줄에 한 가지만 담는다.\n" +
      "- 모든 줄은 반드시 '· 칸이름: 내용' 형태로 쓴다. 칸 이름을 빠뜨리지 않는다.\n" +
      "  (예: '· 수치: 코스피 0.7% 상승' / '· 배경: 물가 둔화가 확인되지 않았다고 판단')\n" +
      "- 기사에 없는 내용은 절대 지어내지 않는다. 해당 칸의 내용이 기사에 없으면 " +
      "그 칸에 '· (칸 이름): 기사에 언급 없음' 이라고 쓴다.\n" +
      "- 투자 관련성 판정: 이 기사를 읽고 살 것·팔 것·지켜볼 것이 하나도 떠오르지 않으면 " +
      "유형이 무관이 아니더라도 마지막 칸 끝에 '(투자 관련성 낮음 — 이유)' 를 반드시 붙인다.\n" +
      "  정치 공방·인사·행정 소식·수상·행사 기사는 시장에 걸린 것이 분명하지 않으면 여기에 해당한다.\n" +
      "- 숫자·회사명·인명·날짜는 기사에 나온 그대로 옮긴다. 반올림하거나 바꾸지 않는다.\n" +
      "- 추천·매수·매도 같은 투자 권유는 하지 않는다. 기사에 있는 기관 의견은 '누가 그렇게 말했다' 로만 옮긴다.";

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
        var htxt = headline(mine);
        var tm = htxt.match(/^\[(사건|시황|종목|해설|무관)\]\s*/);
        if (tm) {
          var chip = document.createElement("span");
          chip.className = "nrtype t-" + tm[1];
          chip.textContent = tm[1];
          sp.appendChild(chip);
          sp.appendChild(document.createTextNode(htxt.slice(tm[0].length)));
        } else {
          sp.textContent = htxt;
        }
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

  /* ── 두 줄에 글이 다 들어가도록 글자 크기 자동 맞춤 ──
     한글은 글자폭이 대략 글자크기와 같고, 영문·숫자·공백은 그 절반쯤이다.
     그래서 '가중 글자수' 를 세어 두 줄에 들어갈 최대 크기를 계산한다.
     칸 폭은 열마다 같으므로 한 번만 재고(레이아웃 계산 1회) 전부에 적용한다. */
  var FS_BASE = 13, FS_MIN = 9.5;
  function weighted(t) {
    var w = 0, i, c;
    for (i = 0; i < t.length; i++) {
      c = t.charCodeAt(i);
      if (c >= 0x1100 && c <= 0xd7ff) w += 1.02;        /* 한글·한자 */
      else if (c >= 0x3000 && c <= 0x30ff) w += 1.02;   /* 일본어·전각기호 */
      else if (c === 32) w += 0.3;                      /* 공백 */
      else if (c >= 48 && c <= 57) w += 0.58;           /* 숫자 */
      else if (c >= 65 && c <= 90) w += 0.68;           /* 영문 대문자 */
      else w += 0.52;                                   /* 그 외 */
    }
    return w || 1;
  }
  function fitOne(el, boxW) {
    if (!el || !boxW) return;
    var t = el.textContent || "";
    var need = weighted(t);
    /* 두 줄 = 2 × 칸폭. 0.94 는 줄 끝에서 낱말이 넘어가며 생기는 여백 몫. */
    var fs = (2 * boxW * 0.94) / need;
    if (fs > FS_BASE) fs = FS_BASE;
    if (fs < FS_MIN) fs = FS_MIN;
    fs = Math.floor(fs * 10) / 10;
    if (el.dataset.nrfs !== String(fs)) {
      el.style.fontSize = fs + "px";
      el.dataset.nrfs = String(fs);
    }
  }
  function shrinkOverflow(els) {
    for (var i = 0; i < els.length; i++) {
      var el = els[i], guard = 0;
      var fs = parseFloat(el.dataset.nrfs || FS_BASE);
      while (el.scrollHeight > el.clientHeight + 1 && fs > FS_MIN && guard < 10) {
        fs = Math.round((fs - 0.5) * 10) / 10;
        if (fs < FS_MIN) fs = FS_MIN;
        el.style.fontSize = fs + "px";
        el.dataset.nrfs = String(fs);
        guard++;
      }
    }
  }
  /* ── 폰에서 칸 순서 바꾸기 ──
     원래 순서 : [체크] ● 시간 출처 키워드 | 제목 요약 | 메모 신호 원문 ⭐
     폰 순서   : [체크] ● | 제목 요약 | 시간 출처 키워드 메모 신호 원문 ⭐
     제목이 화면 왼쪽에서 바로 시작해 좌우로 밀지 않고 읽을 수 있다.
     표는 table-layout:fixed 라 colgroup 의 <col> 도 같은 순서로 옮겨야 폭이 따라온다. */
  var COLNAMES = ["chk", "dot", "date", "src", "kw", "title", "sum", "note", "sig", "link", "star"];
  function isPhone() { return window.innerWidth <= 760; }

  function moveAfter(ref, node) {
    if (!ref || !node || ref === node) return false;
    if (ref.nextSibling === node) return false;
    ref.parentNode.insertBefore(node, ref.nextSibling);
    return true;
  }

  function reorderHeader() {
    var tr = document.getElementById("theadRow");
    var table = document.querySelector(".tablewrap table");
    if (!tr || !table) return;
    var ths = tr.children, i;
    if (!tr.dataset.nrtag) {                       /* 첫 실행 때 칸 이름표를 달아둔다 */
      for (i = 0; i < ths.length && i < COLNAMES.length; i++) ths[i].dataset.nrc = COLNAMES[i];
      var cols0 = table.querySelectorAll("colgroup col");
      for (i = 0; i < cols0.length && i < COLNAMES.length; i++) cols0[i].dataset.nrc = COLNAMES[i];
      tr.dataset.nrtag = "1";
    }
    function pick(root, name) { return root.querySelector('[data-nrc="' + name + '"]'); }
    var cg = table.querySelector("colgroup");
    var want = isPhone() ? "dot" : "kw";           /* 이 칸 뒤에 제목·요약을 놓는다 */
    [tr, cg].forEach(function (root) {
      if (!root) return;
      var ref = pick(root, want), t = pick(root, "title"), u = pick(root, "sum");
      if (ref && t) { moveAfter(ref, t); if (u) moveAfter(t, u); }
    });
  }

  function reorderRows() {
    var rows = document.querySelectorAll("tbody tr");
    var phone = isPhone();
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      var dotSpan = tr.querySelector(".rdot");
      var kwSpan = tr.querySelector(".kwtag");
      var titleSpan = tr.querySelector(".title");
      var sumTd = tr.querySelector("td.summary");
      if (!titleSpan || !sumTd) continue;
      var titleTd = titleSpan.parentNode;
      var ref = phone ? (dotSpan ? dotSpan.parentNode : null)
                      : (kwSpan ? kwSpan.parentNode : null);
      if (!ref || ref === titleTd) continue;
      moveAfter(ref, titleTd);
      moveAfter(titleTd, sumTd);
    }
  }

  function reorderPhone() {
    try { reorderHeader(); reorderRows(); } catch (e) {}
  }

  function autoFitCells() {
    try {
      var titles = document.querySelectorAll("tbody .title");
      var sums = document.querySelectorAll("tbody td.summary .sumline");
      var tw = titles.length ? titles[0].clientWidth : 0;
      var sw = sums.length ? sums[0].clientWidth : 0;
      var i;
      for (i = 0; i < titles.length; i++) fitOne(titles[i], tw);
      for (i = 0; i < sums.length; i++) fitOne(sums[i], sw);
      /* 계산은 어림값이므로, 그래도 두 줄을 넘친 칸만 실제로 재서 더 줄인다 */
      shrinkOverflow(titles);
      shrinkOverflow(sums);
    } catch (e) {}
  }

  /* 제목 끝의 " - 언론사" 꼬리를 떼서 두 줄 안에 들어갈 여유를 만든다 */
  function trimTitles() {
    try {
      var els = document.querySelectorAll("tbody .title");
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.dataset.nrtt) continue;
        var raw = el.textContent || "";
        var cut = raw.replace(/\s+-\s+[^-]{1,24}$/, "").trim();
        if (cut && cut !== raw) { el.textContent = cut; el.title = raw; }
        el.dataset.nrtt = "1";
      }
    } catch (e) {}
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
      d.on = onTs;
      d.off = offTs;
      d.pv = 6;
    } catch (e) {}
    return d;
  };

  var _apply = window.applyPayload;
  function maxMerge(local, remote) {
    if (!remote) return;
    for (var k in remote) {
      if (!remote.hasOwnProperty(k)) continue;
      if ((remote[k] || 0) > (local[k] || 0)) local[k] = remote[k];
    }
  }

  window.applyPayload = function (d) {
    /* 받아온 내용을 그대로 덮어쓰면 방금 여기서 한 일이 지워진다.
       그래서 원래 함수를 부르기 전에 지금 상태를 챙겨두고, 부른 뒤 합친다. */
    var mineRead = get("nr_read", []);
    var mineScrap = get("nr_scrap", []);
    var mineSum = get("nr_mansum", {});
    var mineGone = get("nr_dismiss", []);
    if (_apply) _apply(d);
    try {
      var rts = (d && d.ts) || 1;   /* 도장이 없는 옛 기기 자료는 보낸 시각으로 친다 */
      /* 도장 합치기 : 항목마다 늦게 누른 쪽이 이긴다 */
      maxMerge(onTs, d && d.on);
      maxMerge(offTs, d && d.off);

      /* 읽음 : 양쪽을 합친 뒤, 끈 적이 더 나중인 것만 뺀다 */
      var rd = {}, i, u;
      function addRead(arr) {
        if (Object.prototype.toString.call(arr) !== "[object Array]") return;
        for (var j = 0; j < arr.length; j++) {
          if (typeof arr[j] !== "string") continue;
          rd[arr[j]] = 1;
          if (!onTs[tsKey("r", arr[j])]) onTs[tsKey("r", arr[j])] = rts;
        }
      }
      addRead(mineRead);
      addRead(d && d.read);
      var outRead = [];
      for (u in rd) if (rd.hasOwnProperty(u) && isOn("r", u)) outRead.push(u);
      put("nr_read", outRead);

      /* 스크랩 : url 기준으로 합치고, 메모·리서치가 있는 쪽을 남긴다 */
      var bag = {}, arr2 = [].concat(
        Object.prototype.toString.call(mineScrap) === "[object Array]" ? mineScrap : [],
        (d && Object.prototype.toString.call(d.scraps) === "[object Array]") ? d.scraps : []);
      for (i = 0; i < arr2.length; i++) {
        var sc = arr2[i];
        if (!sc || !sc.n) continue;
        var k = keyOf(sc.n);
        if (!k) continue;
        if (!onTs[tsKey("s", k)]) onTs[tsKey("s", k)] = rts;
        var old = bag[k];
        if (!old) { bag[k] = sc; continue; }
        var wNew = ((sc.notes || []).length ? 2 : 0) + (sc.memo ? 1 : 0);
        var wOld = ((old.notes || []).length ? 2 : 0) + (old.memo ? 1 : 0);
        if (wNew > wOld) bag[k] = sc;
      }
      var outScrap = [];
      for (u in bag) if (bag.hasOwnProperty(u) && isOn("s", u)) outScrap.push(bag[u]);
      window.scraps = outScrap;
      put("nr_scrap", outScrap);

      /* 내 요약 : 합치되 이 기기 것이 우선 */
      var sum = {};
      if (d && d.mansum) for (u in d.mansum) if (d.mansum.hasOwnProperty(u)) sum[u] = d.mansum[u];
      for (u in mineSum) if (mineSum.hasOwnProperty(u)) sum[u] = mineSum[u];
      put("nr_mansum", sum);
      window.manSum = sum;

      /* 지운 목록 : 합집합 */
      var gm = {};
      function addGone(arr) {
        if (Object.prototype.toString.call(arr) !== "[object Array]") return;
        for (var j = 0; j < arr.length; j++) if (typeof arr[j] === "string") gm[arr[j]] = 1;
      }
      addGone(mineGone);
      addGone(d && d.dismiss);
      var outGone = [];
      for (u in gm) if (gm.hasOwnProperty(u)) outGone.push(u);
      put("nr_dismiss", outGone);

      put("nr_on", onTs);
      put("nr_off", offTs);

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
      trimTitles();
      reorderPhone();
      autoFitCells();
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
      trimTitles();
      reorderPhone();
      autoFitCells();
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

  var _rsT = null;
  window.addEventListener("resize", function () {
    if (_rsT) clearTimeout(_rsT);
    _rsT = setTimeout(function () {
      reorderPhone();
      autoFitCells();
    }, 180);
  });

  if (window.console) console.log("[news_patch] " + VER + " 적용됨 — 정리본 공유 · 선택 공유 · A4 브리핑");
})();
