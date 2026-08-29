/* news_patch.js — 뉴스레이더 보강 패치 (요약 5줄 + 전체보기 팝업)
 *
 *  하는 일
 *   1) [요약] 버튼 → 스크랩(⭐)한 기사만, 5줄로 요약해서 저장
 *   2) 표의 요약 칸에는 첫 줄만 표시 (칸이 좁아 잘리는 문제 해결)
 *   3) 요약 칸을 누르면 5줄 전체가 팝업으로 뜸
 *
 *  news.html 본문은 건드리지 않는다.
 *  문제가 생기면 news.html 의 <script src="news_patch.js"> 한 줄만 지우면 원래대로 돌아온다.
 */
(function () {
  "use strict";
  if (window.__nrPatch) return;
  window.__nrPatch = 1;

  var LINES = 5;

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
    "white-space:nowrap;cursor:pointer}","tbody tr.read{opacity:1!important}","tbody tr.read .rdot{background:transparent!important;position:relative}","tbody tr.read .rdot::after{content:'✓';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:13px;line-height:1;font-weight:700;color:#9aa3af}"
  ].join("");
  var st = document.createElement("style");
  st.id = "nrPatchCss";
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- 팝업 ---------- */
  function closePop() {
    var e = document.getElementById("nrpopBg");
    if (e) e.remove();
  }
  function popup(title, text) {
    closePop();
    var bg = document.createElement("div");
    bg.id = "nrpopBg";
    var box = document.createElement("div");
    box.id = "nrpop";
    var t = document.createElement("div");
    t.className = "t";
    t.textContent = title || "";
    var b = document.createElement("div");
    b.className = "b";
    b.textContent = text || "";
    var x = document.createElement("button");
    x.className = "x";
    x.textContent = "닫기";
    x.onclick = closePop;
    box.appendChild(t);
    box.appendChild(b);
    box.appendChild(x);
    bg.appendChild(box);
    bg.addEventListener("click", function (e) {
      if (e.target === bg) closePop();
    });
    document.body.appendChild(bg);
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closePop();
  });

  /* ---------- 도우미 ---------- */
  function byId(id) {
    if (!window.NEWS || !NEWS.length) return null;
    for (var i = 0; i < NEWS.length; i++) {
      if (NEWS[i].id === id) return NEWS[i];
    }
    return null;
  }
  function say(m) {
    if (window.toast) toast(m);
    else alert(m);
  }

  /* ---------- 1) 요약 생성 : 스크랩한 기사만, 5줄 ---------- */
  window.rowSummarize = function (id, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();

    var n = byId(id);
    if (!n) return;

    var saved = window.manSum ? manSum[n.url] : null;
    if (saved) {                       // 이미 요약이 있으면 새로 만들지 않고 보여주기만
      popup(n.title || "", saved);
      return;
    }

    if (window.scrapOf && !scrapOf(n.id)) {
      say("⭐ 스크랩한 기사만 요약합니다");
      return;
    }
    if (!window.AI_KEY) {
      if (window.openKey) openKey();
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

    callClaude([{ role: "user", content: src }], sys, function (txt, err) {
      if (btn) { btn.disabled = false; btn.textContent = "요약"; }
      if (err || !txt) {
        say("요약 실패: " + (err || "응답이 비었습니다"));
        return;
      }
      var clean = String(txt).trim();
      if (window.manSum) {
        manSum[n.url] = clean;
        if (window.lsSet) lsSet("nr_mansum", manSum);
      }
      if (window.renderRows) renderRows();
      popup(n.title || "", clean);
    });
  };

  /* ---------- 2) 요약 칸은 첫 줄만 보이게 ---------- */
  function firstLineOnly() {
    var cells = document.querySelectorAll("tbody td.summary");
    for (var i = 0; i < cells.length; i++) {
      var td = cells[i];
      if (td.querySelector(".miniai")) continue;   // 아직 요약 전 (버튼만 있는 칸)
      if (td.querySelector(".sumline")) continue;  // 이미 처리됨
      var raw = (td.textContent || "").trim();
      if (!raw) continue;
      var one = raw.split("\n")[0].replace(/^[·\-•]\s*/, "").trim();
      if (!one) continue;
      td.textContent = "";
      var sp = document.createElement("span");
      sp.className = "sumline";
      sp.textContent = one;
      sp.title = "눌러서 5줄 전체 보기";
      td.appendChild(sp);
    }
  }

  /* ---------- 3) 요약 칸 클릭 → 전체 보기 ---------- */
  document.addEventListener("click", function (e) {
    if (!e.target.closest) return;
    if (e.target.closest(".miniai")) return;            // 요약 버튼은 원래대로
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
    var s = window.manSum ? manSum[n.url] : null;
    if (!s) return;                                    // 요약이 없으면 원래 동작 유지
    e.preventDefault();
    e.stopPropagation();
    popup(n.title || "", s);
  }, true);

  /* 표가 다시 그려질 때마다 첫 줄만 남기기 */
  function watch() {
    var tb = document.querySelector("tbody");
    if (!tb) { setTimeout(watch, 500); return; }
    new MutationObserver(function () { firstLineOnly(); })
      .observe(tb, { childList: true, subtree: true });
    firstLineOnly();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watch);
  } else {
    watch();
  }
})();
