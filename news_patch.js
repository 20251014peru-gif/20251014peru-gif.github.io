/* news_patch.js — 뉴스레이더 보강 패치 v4 (2026-08-30)
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
 * news.html 본문은 건드리지 않는다.
 * 문제가 생기면 news.html 의 <script src="news_patch.js"> 한 줄만 지우면 원래대로 돌아온다.
 */
(function () {
  "use strict";
  if (window.__nrPatch >= 4) return;
  window.__nrPatch = 4;

  var LINES = 5;
  var VER = "v4";
  var FALLBACK_MAX = 20;   /* 속보 0건일 때 대신 채울 중요 뉴스 최대 건수 */

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
    "tbody tr.read{opacity:1!important}",
    "tbody tr.read .rdot{background:transparent!important;position:relative}",
    "tbody tr.read .rdot::after{content:'\\2713';position:absolute;left:50%;top:50%;",
    "transform:translate(-50%,-50%);font-size:13px;line-height:1;font-weight:700;color:#9aa3af}",
    "#nrNote{margin:0 0 10px;padding:9px 12px;border-radius:10px;background:rgba(59,87,201,.08);",
    "color:#3b57c9;font-size:12.5px;font-weight:700;line-height:1.5}",
    ".nrmemochip{display:inline-block;max-width:120px;overflow:hidden;text-overflow:ellipsis;",
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
  function popup(title, text) {
    closePop();
    var bg = document.createElement("div"); bg.id = "nrpopBg";
    var box = document.createElement("div"); box.id = "nrpop";
    var t = document.createElement("div"); t.className = "t"; t.textContent = title || "";
    var b = document.createElement("div"); b.className = "b"; b.textContent = text || "";
    var x = document.createElement("button"); x.className = "x"; x.textContent = "닫기"; x.onclick = closePop;
    box.appendChild(t); box.appendChild(b); box.appendChild(x);
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
    try { fixReaderSum(n); } catch (e) {}
    if (window.renderRows) window.renderRows();
  };

  /* ================= 요약 : 5줄, 첫 줄이 핵심 ================= */
  function applySummary(n, text) {
    var k = keyOf(n);
    var txt = clean(text);
    n.summary = txt;
    if (n.url && window.manSum) { window.manSum[n.url] = txt; put("nr_mansum", window.manSum); }
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
    popup(n && n.title ? n.title : "", h ? (h + "\n\n" + b) : b);
  }

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
      if (isReadN(n) || isScrapN(n)) continue;
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

  /* ================= 탭 : 순서·이름·건수 배지 ================= */
  var ORDER = ["breaking", "all", "read", "scrap", "gloss"];
  function tabBtn(v) { return document.querySelector('.tabbar button[data-view="' + v + '"]'); }

  function setupTabs() {
    var bar = document.querySelector(".tabbar");
    if (!bar || bar.dataset.nr3) return;
    var i, b;
    /* 이름 바꾸기 : 전체 → 🆕 새 뉴스 */
    b = tabBtn("all");
    if (b) b.innerHTML = '<span class="ic">🆕</span>새 뉴스';
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

  /* ================= 렌더 감싸기 ================= */
  var _renderRows = window.renderRows;
  var _inRender = 0;
  window.renderRows = function () {
    if (_inRender) return;
    _inRender = 1;
    try {
      loadRead();
      reindex();
      if (_renderRows) _renderRows();
      decorateSummaryCells();
      decorateMemoCells();
      setupTabs();
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
    }).observe(tb, { childList: true, subtree: true });

    setupTabs();
    fixHead();
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

  if (window.console) console.log("[news_patch] " + VER + " 적용됨 — 5줄 요약 · 압축 한 줄 표시");
})();
