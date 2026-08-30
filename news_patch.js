/* news_patch.js — 뉴스레이더 보강 패치  v2  (2026-08-30)
 *
 *  v2에서 고친 것
 *   ① 요약을 만들면 [📝 요약] 버튼이 사라지고, 그 자리에 요약 첫 줄이 남는다.
 *      → 칸을 누르면 5줄 전체가 팝업으로 뜬다. (이전엔 버튼이 계속 남아 있었음)
 *   ② 읽은 기사(제목 클릭)는 자동으로 ★ 스크랩에 들어간다. AI 요약을 안 해도 된다.
 *      → "스크랩한 기사만 요약합니다" 제한도 없앴다.
 *   ③ 읽지도 않은 기사에 ✓ 가 뜨던 문제 해결.
 *      원인: 기사 id 가 수집할 때마다 1,2,3… 으로 다시 매겨져서(collector.py)
 *            어제 읽은 번호가 오늘 다른 기사에 붙었다. news.json + archive 를 합칠 때
 *            같은 번호가 여러 건 생기기도 했다.
 *      해결: 읽음·스크랩 판정을 번호가 아니라 기사 URL 기준으로 바꿨다.
 *            기존 읽음 기록은 처음 한 번 현재 목록 기준으로 URL 로 옮긴다.
 *
 *  news.html 본문은 건드리지 않는다.
 *  문제가 생기면 news.html 의 <script src="news_patch.js"> 한 줄만 지우면 원래대로 돌아온다.
 */
(function () {
  "use strict";
  if (window.__nrPatch >= 2) return;
  window.__nrPatch = 2;

  var LINES = 5;
  var VER = "v2";

  /* ---------- 스타일 ---------- */
  var css = [
    "#nrpopBg{position:fixed;inset:0;background:rgba(15,20,30,.55);z-index:99999;",
    "display:flex;align-items:center;justify-content:center;padding:16px}",
    "#nrpop{background:#fff;color:#1c1c1e;width:100%;max-width:560px;max-height:82vh;",
    "overflow:auto;border-radius:16px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.32);",
    "font-size:15px;line-height:1.75;font-family:inherit}",
    "#nrpop .t{font-weight:700;font-size:15.5px;line-height:1.5;margin-bottom:12px}",
    "#nrpop .b{white-space:pre-wrap;word-break:break-word}",
    "#nrpop .x{margin-top:16px;width:100%;min-height:46px;border:0;border-radius:12px;",
    "background:#3b57c9;color:#fff;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}",
    "tbody td.summary .sumline{display:block;overflow:hidden;text-overflow:ellipsis;",
    "white-space:nowrap;cursor:pointer}",
    "tbody tr.read{opacity:1!important}",
    "tbody tr.read .rdot{background:transparent!important;position:relative}",
    "tbody tr.read .rdot::after{content:'✓';position:absolute;left:50%;top:50%;",
    "transform:translate(-50%,-50%);font-size:13px;line-height:1;font-weight:700;color:#9aa3af}"
  ].join("");
  var st = document.createElement("style");
  st.id = "nrPatchCss";
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- 작은 도우미 ---------- */
  function say(m) { if (window.toast) window.toast(m); else alert(m); }
  function get(k, d) { return window.lsGet ? window.lsGet(k, d) : d; }
  function put(k, v) { if (window.lsSet) window.lsSet(k, v); }

  /* 기사 한 건을 가리키는 고정 열쇠 — URL 우선, 없으면 번호(예시 데이터용) */
  function keyOf(n) { return n ? (n.url && n.url !== "#" ? n.url : "id:" + n.id) : ""; }

  function newsList() { return (window.NEWS && window.NEWS.length) ? window.NEWS : []; }
  function scrapList() { return (window.scraps && window.scraps.length) ? window.scraps : []; }

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

  /* ---------- 번호 정리 : 합쳐진 목록에서 번호가 겹치지 않게 ---------- */
  /* news.json + archive 를 합치면 같은 id 가 여러 건 생긴다.
     화면에서 엉뚱한 기사가 열리거나 별표가 붙는 원인이라 매 렌더 전에 다시 매긴다. */
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

  /* ---------- 읽음 : URL 기준 ---------- */
  /* localStorage 열쇠는 그대로 "nr_read" 를 쓴다(기기간 동기화 코드 유지).
     담기는 값만 번호 배열 → URL 배열로 바뀐다. */
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

  /* 기존 번호 기록 → URL 로 한 번만 옮기기 (현재 화면에 로드된 목록 기준) */
  function migrateRead(arr) {
    if (get("nr_read_mig", 0)) return;
    var old = get("nr_read", []);
    var ids = [];
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

  window.isRead = function (id) { var k = keyById(id); return k ? !!readSet[k] : false; };
  function markRead(k) { if (k && !readSet[k]) { readSet[k] = 1; saveRead(); } }
  window.toggleRead = function (id) {
    var k = keyById(id);
    if (!k) return;
    if (readSet[k]) delete readSet[k]; else readSet[k] = 1;
    saveRead();
    if (window.renderRows) window.renderRows();
    if (window.syncSoon) window.syncSoon();
  };

  /* ---------- 스크랩 : URL 기준 ---------- */
  function scrapByKey(k) {
    var S = scrapList();
    for (var i = 0; i < S.length; i++) if (S[i] && S[i].n && keyOf(S[i].n) === k) return S[i];
    return null;
  }
  window.isScrap = function (id) { return !!scrapByKey(keyById(id)); };
  window.scrapOf = function (id) { return scrapByKey(keyById(id)) || undefined; };

  function addScrap(n) {
    if (!n) return null;
    var k = keyOf(n);
    if (!k) return null;
    var ex = scrapByKey(k);
    if (ex) return ex;
    if (!window.scraps) return null;
    ex = { n: JSON.parse(JSON.stringify(n)), notes: [], at: new Date().toISOString().slice(0, 10) };
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
    } else {
      addScrap(byId(id));
    }
    if (window.renderRows) window.renderRows();
  };

  /* ---------- 목록 로드 때 : 번호 다시 매기고, 읽음 기록 옮기기 ---------- */
  var _normalize = window.normalizeNews;
  window.normalizeNews = function (arr) {
    var out = _normalize ? _normalize(arr) : arr;
    try { migrateRead(out); } catch (e) {}
    try {
      var L = out || [], i;
      for (i = 0; i < L.length; i++) {
        L[i].id = i + 1;
        /* 새로고침해도 만들어 둔 요약이 살아 있게 (manSum → 스크랩 순서로 복원) */
        if (!L[i].summary) {
          var k = keyOf(L[i]);
          if (L[i].url && window.manSum && window.manSum[L[i].url]) L[i].summary = window.manSum[L[i].url];
          else { var sc = scrapByKey(k); if (sc && sc.n && sc.n.summary) L[i].summary = sc.n.summary; }
        }
      }
    } catch (e) {}
    return out;
  };

  /* ---------- 팝업 ---------- */
  function closePop() { var e = document.getElementById("nrpopBg"); if (e) e.remove(); }
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

  /* ---------- 읽기창 열기 = 읽음 + 자동 스크랩 ---------- */
  var _openReader = window.openReader;
  window.openReader = function (id) {
    var n = byId(id);
    if (n) {
      markRead(keyOf(n));   /* 먼저 읽음 처리 → 원래 함수의 번호 기반 저장이 실행되지 않음 */
      addScrap(n);          /* 읽은 기사는 자동으로 ★ 스크랩 */
    }
    if (_openReader) _openReader(id);
    saveRead();             /* 혹시 원래 코드가 덮어썼으면 되돌리기 */
    if (window.renderRows) window.renderRows();
  };

  /* ---------- 요약 생성 : 5줄, 만들고 나면 버튼 없애기 ---------- */
  function applySummary(n, text) {
    var k = keyOf(n);
    n.summary = text;
    if (n.url && window.manSum) { window.manSum[n.url] = text; put("nr_mansum", window.manSum); }
    var L = newsList(), i;
    for (i = 0; i < L.length; i++) if (keyOf(L[i]) === k) L[i].summary = text;
    var sc = scrapByKey(k);
    if (sc) { sc.n.summary = text; put("nr_scrap", window.scraps); }
    /* 읽기창이 열려 있으면 그 안의 "한 줄 요약"도 바꿔주기 */
    try {
      if (window.curArticle && keyOf(window.curArticle) === k) {
        window.curArticle.summary = text;
        var box = document.getElementById("aSum");
        if (box) {
          var one = String(text).split("\n")[0].replace(/^[·\-•]\s*/, "").trim();
          box.innerHTML = '<b>한 줄 요약</b> · ' + one +
            (n.url ? ' &nbsp;<a href="' + n.url + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:800;white-space:nowrap">🔗 기사 원문 열기 ↗</a>' : '');
        }
      }
    } catch (e) {}
  }

  window.rowSummarize = function (id, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();

    var n = byId(id);
    if (!n) return;

    var saved = (n.url && window.manSum) ? window.manSum[n.url] : null;
    if (!saved && n.summary) saved = n.summary;
    if (saved) {                       /* 이미 요약이 있으면 새로 만들지 않고 보여주기만 */
      applySummary(n, saved);
      if (window.renderRows) window.renderRows();
      popup(n.title || "", saved);
      return;
    }

    if (!window.AI_KEY) {
      if (window.openKey) window.openKey();
      else say("AI 키를 먼저 넣어주세요");
      return;
    }

    var btn = ev && ev.target && ev.target.closest ? ev.target.closest(".miniai") : null;
    if (btn) { btn.disabled = true; btn.textContent = "요약 중…"; }

    var sys =
      "너는 한국어 뉴스 요약가다. 반드시 " + LINES + "줄로 요약한다. " +
      "각 줄은 '· ' 로 시작하고, 한 줄에 한 가지 사실만 담는다. " +
      "기사에 없는 내용은 절대 추측해서 쓰지 않는다. " +
      "숫자·회사명·인명은 기사에 나온 그대로 옮긴다. 군더더기 인사말은 쓰지 않는다.";

    var src = (n.title || "") + "\n\n" + String(n.body || n.orig_title || "").slice(0, 6000);

    window.callClaude([{ role: "user", content: src }], sys, function (txt, err) {
      if (btn) { btn.disabled = false; btn.textContent = "📝 요약"; }
      if (err || !txt) { say("요약 실패: " + (err || "응답이 비었습니다")); return; }
      var clean = String(txt).trim();
      applySummary(n, clean);
      addScrap(n);                       /* 요약한 기사도 스크랩에 남기기 */
      if (window.renderRows) window.renderRows();
      popup(n.title || "", clean);
    });
  };

  /* ---------- 요약 칸은 첫 줄만 보이게 ---------- */
  function firstLineOnly() {
    var cells = document.querySelectorAll("tbody td.summary");
    for (var i = 0; i < cells.length; i++) {
      var td = cells[i];
      if (td.querySelector(".miniai")) continue;   /* 아직 요약 전 (버튼만 있는 칸) */
      if (td.querySelector(".sumline")) continue;  /* 이미 처리됨 */
      var raw = (td.textContent || "").trim();
      if (!raw) continue;
      var one = raw.split("\n")[0].replace(/^[·\-•]\s*/, "").trim();
      if (!one) continue;
      td.textContent = "";
      var sp = document.createElement("span");
      sp.className = "sumline";
      sp.textContent = one;
      sp.title = "눌러서 전체 보기";
      td.appendChild(sp);
    }
  }

  /* ---------- 요약 칸 클릭 → 전체 보기 ---------- */
  document.addEventListener("click", function (e) {
    if (!e.target.closest) return;
    if (e.target.closest(".miniai")) return;            /* 요약 버튼은 원래대로 */
    var cell = e.target.closest("tbody td.summary");
    if (!cell) return;
    var tr = cell.closest("tr");
    if (!tr) return;
    var holder = tr.querySelector("[onclick*='openReader']");
    var oc = holder ? holder.getAttribute("onclick") || "" : "";
    var m = oc.match(/openReader\((\d+)\)/);
    if (!m) return;
    var n = byId(parseInt(m[1], 10));
    if (!n) return;
    var s = (n.url && window.manSum && window.manSum[n.url]) ? window.manSum[n.url] : n.summary;
    if (!s) return;                                    /* 요약이 없으면 원래 동작 유지 */
    e.preventDefault();
    e.stopPropagation();
    popup(n.title || "", s);
  }, true);

  /* ---------- 렌더 감싸기 : 번호 정리 + 읽음 최신화 + 첫 줄 처리 ---------- */
  var _renderRows = window.renderRows;
  var _inRender = 0;
  window.renderRows = function () {
    if (_inRender) return;
    _inRender = 1;
    try {
      loadRead();
      reindex();
      if (_renderRows) _renderRows();
      firstLineOnly();
    } catch (e) {
      if (window.console) console.error("[news_patch] renderRows", e);
    }
    _inRender = 0;
  };

  /* 표가 다시 그려질 때마다 첫 줄만 남기기 */
  function watch() {
    var tb = document.querySelector("tbody");
    if (!tb) { setTimeout(watch, 500); return; }
    new MutationObserver(function () { firstLineOnly(); })
      .observe(tb, { childList: true, subtree: true });
    firstLineOnly();
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

  if (window.console) console.log("[news_patch] " + VER + " 적용됨 — 읽음/스크랩 URL 기준");
})();
