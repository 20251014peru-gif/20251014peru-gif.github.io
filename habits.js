/* ═══════════════════════════════════════════════════════════════
   habits.js — ✅ 습관 체크리스트 (개인일지)                    v302-1021-0300
   · 개인 → 「✅ 체크리스트」 탭을 누르면 창 전체를 쓰는 화면이 열린다
   · 저장: Firestore (이 앱이 이미 쓰는 db)
       habit_defs/{습관id}        습관 정의 (이름·주기·하루 횟수·예정 시각·색·시작일·종료일)
       habit_logs/{YYYY-MM-DD}    그날의 기록 {counts, times, memo, mood, note}
     바뀐 칸만 합쳐서 올리고(set merge), 다른 기기에서 바뀐 것은 실시간으로 받는다.
     이 기기(localStorage)는 임시 보관일 뿐 기준본이 아니다.
   · 일괄 삭제·덮어쓰기 단추는 두지 않았다 (보관만 가능, 영구 삭제는 습관 단위 + 확인 단추)
   🔴 Firestore 보안 규칙에서 habit_defs / habit_logs 읽기·쓰기가 허용돼야 저장된다.
   되돌리기 : worklog.html 에서 <script src="habits.js…"> 한 줄만 지우면 원래대로.
   ═══════════════════════════════════════════════════════════════ */
(function(){
  if(window.__wlHabitsCss)return;window.__wlHabitsCss=true;
  var st=document.createElement('style');st.id='hbCss';st.textContent="#hbRoot{--bg:#f3eefa; --page:#fffdff; --surface:#ffffff; --surface2:#efe8f7; --line:#ddd2ea; --dot:#e9e0f2;\n  --fg:#35294a; --muted:#6f6086;\n  --accent:#d9468a; --accent-ink:#a3205f; --accent-soft:#ffe1ee; --on-accent:#ffffff;\n  --lt3:#35294a; --lt4:#ffffff; --on-strong:#ffffff;\n  --ok:#13794c; --bad:#b4233a; --shadow:rgba(80,50,110,.14);\n  --p1:#ffe1ee; --p2:#ffe7d3; --p3:#fff1bf; --p4:#d9f4e4; --p5:#dbeeff; --p6:#e8e0ff; --p7:#f5ddff; --p8:#e4efd3;\n  --s1:#d6407c; --s2:#de6b25; --s3:#a87c00; --s4:#1b9561; --s5:#2c78c8; --s6:#6a44cc; --s7:#a83fc7; --s8:#598a27;\n  --w1:var(--p1); --w2:var(--p2); --w3:var(--p3); --w4:var(--p4); --w5:var(--p5); --w6:var(--p6);\n  --w1s:var(--s1); --w2s:var(--s2); --w3s:var(--s3); --w4s:var(--s4); --w5s:var(--s5); --w6s:var(--s6);\n  font-family:'Noto Sans KR',system-ui,-apple-system,'Malgun Gothic',sans-serif;}\n#hbRoot *{box-sizing:border-box}\n#hbRoot{margin:0;background:var(--bg);color:var(--fg);padding-block:0 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));line-height:1.5}\n#hbRoot button,#hbRoot select,#hbRoot input,#hbRoot textarea{font:inherit;color:inherit}\n#hbRoot button{cursor:pointer}\n#hbRoot button:focus-visible,#hbRoot select:focus-visible,#hbRoot input:focus-visible,#hbRoot textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}\n#hbRoot .hbwrap{max-width:none;margin:0 auto}\n#hbRoot .top{position:sticky;top:env(safe-area-inset-top,0px);z-index:9;background:var(--bg);display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-block:10px 8px}\n#hbRoot .top h1{margin:0;font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:30px;font-weight:700;letter-spacing:.01em;line-height:1}\n#hbRoot .chip{font-size:12px;font-weight:700;color:var(--accent-ink);background:var(--accent-soft);border-radius:999px;padding:3px 10px;border:0}\n#hbRoot button.chip:hover{filter:brightness(.97)}\n#hbRoot .tabs{margin-left:auto;display:grid;grid-template-columns:repeat(6,1fr);gap:3px;background:var(--surface2);border-radius:12px;padding:3px;width:min(100%,460px)}\n#hbRoot .tabs button{border:0;background:transparent;border-radius:9px;padding:7px 2px;font-size:14px;font-weight:700;color:var(--muted)}\n#hbRoot .tabs button[aria-selected=\"true\"]{background:var(--accent);color:var(--on-accent)}\n#hbRoot #hbView{display:flex;flex-direction:column;gap:14px;padding-top:4px}\n#hbRoot #hbView.narrow{max-width:980px;margin:0 auto;width:100%}\n#hbRoot .card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;min-width:0}\n#hbRoot .card h2{margin:0 0 10px;font-size:15px;font-weight:800}\n#hbRoot .note{font-size:12.5px;color:var(--muted)}\n#hbRoot .btn{border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700}\n#hbRoot .btn:hover{background:var(--surface2)}\n#hbRoot .btn.pri{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}\n#hbRoot .btn.warn{border-color:var(--bad);color:var(--bad)}\n#hbRoot .btn.sm{padding:5px 10px;font-size:12px}\n#hbRoot .nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n#hbRoot .nb{width:38px;height:38px;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;font-size:18px;font-weight:700;line-height:1;flex:none}\n#hbRoot .nav .nl{flex:1;min-width:150px;text-align:center;font-weight:800;font-size:16px}\n#hbRoot .nav .nl small{display:block;font-size:12px;font-weight:500;color:var(--muted)}\n#hbRoot .nav select{height:38px;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:0 8px;font-weight:700}\n#hbRoot .sum{display:flex;gap:18px;align-items:center;flex-wrap:wrap}\n#hbRoot .sum .facts{display:grid;gap:4px;font-size:13px;min-width:0}\n#hbRoot .donut .d-bg{stroke:var(--surface2)}\n#hbRoot .donut .d-fg{stroke:var(--accent)}\n#hbRoot .donut .d-t{fill:var(--fg);font-weight:800}\n#hbRoot .c1{--hp:var(--p1);--hs:var(--s1)}\n#hbRoot .c2{--hp:var(--p2);--hs:var(--s2)}\n#hbRoot .c3{--hp:var(--p3);--hs:var(--s3)}\n#hbRoot .c4{--hp:var(--p4);--hs:var(--s4)}\n#hbRoot .c5{--hp:var(--p5);--hs:var(--s5)}\n#hbRoot .c6{--hp:var(--p6);--hs:var(--s6)}\n#hbRoot .c7{--hp:var(--p7);--hs:var(--s7)}\n#hbRoot .c8{--hp:var(--p8);--hs:var(--s8)}\n#hbRoot .book{display:grid;grid-template-columns:minmax(290px,370px) 1fr;background:var(--page);border:1px solid var(--line);border-radius:24px;box-shadow:0 12px 32px var(--shadow);position:relative;overflow:hidden;min-height:0}\n#hbRoot .page{position:relative;min-width:0;min-height:0;padding:24px 22px 18px;background-image:radial-gradient(var(--dot) 1.1px,transparent 1.3px);background-size:18px 18px}\n#hbRoot .page.left{display:flex;flex-direction:column;gap:14px;overflow:auto}\n#hbRoot .page.right{display:flex;flex-direction:column;gap:10px;border-left:2px dashed var(--line)}\n#hbRoot .page.right::before{content:\"\";position:absolute;left:-8px;top:22px;bottom:22px;width:14px;background:radial-gradient(circle,var(--bg) 4.5px,transparent 5.5px) 0 0/14px 36px repeat-y}\n#hbRoot .tape{position:absolute;top:-7px;left:50%;width:120px;height:26px;transform:translateX(-50%) rotate(-3deg);border-radius:4px;background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--accent) 38%,transparent) 0 8px,color-mix(in srgb,var(--accent) 20%,transparent) 8px 16px);opacity:.85}\n#hbRoot .dnav{display:flex;align-items:center;gap:8px;margin-top:6px}\n#hbRoot .dnav .dt{flex:1;text-align:center;min-width:0}\n#hbRoot .bigd{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:46px;font-weight:700;line-height:1;color:var(--accent-ink)}\n#hbRoot .dsub{font-size:13px;color:var(--muted);font-weight:500;margin-top:2px}\n#hbRoot .back{align-self:center}\n#hbRoot .ringrow{display:flex;gap:14px;align-items:center;background:var(--surface);border:1.5px dashed var(--line);border-radius:18px;padding:12px 14px}\n#hbRoot .ringrow .rt{min-width:0}\n#hbRoot .ringrow .rt b{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:22px;line-height:1.2;display:block}\n#hbRoot .faces{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}\n#hbRoot .faces button{border:1.5px solid var(--line);background:var(--surface);border-radius:14px;font-size:24px;line-height:1;padding:8px 0}\n#hbRoot .faces button[aria-pressed=\"true\"]{background:var(--accent-soft);border-color:var(--accent);transform:translateY(-2px)}\n#hbRoot .lab{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:18px;font-weight:700;margin:0 0 4px}\n#hbRoot textarea,#hbRoot input[type=text],#hbRoot input[type=number],#hbRoot input[type=time],#hbRoot select.f{width:100%;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:8px 11px;font-size:14px}\n#hbRoot textarea{min-height:56px;resize:none}\n#hbRoot .wk7{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}\n#hbRoot .wd{border:0;background:transparent;display:grid;justify-items:center;gap:3px;padding:6px 0;border-radius:14px;font-size:12px;color:var(--muted)}\n#hbRoot .wd b{font-size:14px;color:var(--fg)}\n#hbRoot .wd.sel{background:var(--accent-soft)}\n#hbRoot .wd.today b{color:var(--accent-ink);text-decoration:underline}\n#hbRoot .mr{position:relative;width:26px;height:26px;border-radius:50%;background:conic-gradient(var(--accent) calc(var(--p)*1%),var(--surface2) 0)}\n#hbRoot .mr::after{content:\"\";position:absolute;inset:5px;border-radius:50%;background:var(--page)}\n#hbRoot .mr.na{background:transparent;border:1.5px dotted var(--line)}\n#hbRoot .mr.na::after{display:none}\n#hbRoot .cards{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));grid-auto-rows:minmax(190px,270px);gap:16px 14px;align-content:start;padding:8px 6px 10px}\n#hbRoot .hcard{position:relative;background:var(--hp);border:1.5px dashed color-mix(in srgb,var(--hs) 45%,transparent);border-radius:20px;padding:12px 12px 10px;display:flex;flex-direction:column;gap:8px;min-width:0;box-shadow:0 2px 0 color-mix(in srgb,var(--hs) 22%,transparent)}\n#hbRoot .hcard:nth-child(3n+1){transform:rotate(-.5deg)}\n#hbRoot .hcard:nth-child(3n+2){transform:rotate(.4deg)}\n#hbRoot .hh{display:flex;gap:9px;align-items:center;min-width:0}\n#hbRoot .hico{flex:none;width:40px;height:40px;border-radius:50%;background:var(--surface);display:grid;place-items:center;font-size:22px;box-shadow:0 1px 0 color-mix(in srgb,var(--hs) 35%,transparent)}\n#hbRoot .hnm{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:20px;font-weight:700;line-height:1.1;word-break:keep-all;overflow-wrap:break-word}\n#hbRoot .hsub{font-size:11.5px;color:var(--muted);line-height:1.3;word-break:keep-all;overflow-wrap:break-word}\n#hbRoot .hhw{min-width:0;flex:1}\n#hbRoot .stamps{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:flex-start}\n#hbRoot .stamp{border:0;background:transparent;padding:0;display:grid;justify-items:center;gap:2px;min-width:44px}\n#hbRoot .stamp i{width:44px;height:44px;border-radius:50%;border:2px dashed var(--hs);background:color-mix(in srgb,var(--hs) 10%,var(--surface));display:grid;place-items:center;color:var(--hs);font-style:normal;font-size:20px;font-weight:800;line-height:1}\n#hbRoot .stamp small{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;min-height:15px;line-height:15px;white-space:nowrap}\n#hbRoot .stamp.done i{background:var(--hs);border-style:solid;color:var(--on-strong)}\n#hbRoot .stamp.done small{color:var(--fg);font-weight:700}\n#hbRoot .stamp.late small{color:var(--bad);font-weight:700}\n#hbRoot .stamp:disabled{opacity:.4;cursor:default}\n#hbRoot .stamps.sm .stamp{min-width:34px}\n#hbRoot .stamps.sm .stamp i{width:32px;height:32px;font-size:15px}\n#hbRoot .stamps.sm .stamp small{font-size:10px}\n@keyframes hbpop{0%{transform:scale(.6) rotate(-12deg)}60%{transform:scale(1.18) rotate(4deg)}100%{transform:scale(1) rotate(0)}}\n@media (prefers-reduced-motion: no-preference){#hbRoot .stamp.pop i{animation:hbpop .38s ease-out}}\n#hbRoot .hft{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-top:auto}\n#hbRoot .d7{display:flex;gap:4px;align-items:center}\n#hbRoot .d7 b{width:10px;height:10px;border-radius:50%;border:1.5px solid var(--hs);display:block}\n#hbRoot .d7 b.on{background:var(--hs)}\n#hbRoot .d7 b.part{background:linear-gradient(90deg,var(--hs) 50%,transparent 50%)}\n#hbRoot .d7 b.na{border-style:dotted;opacity:.35}\n#hbRoot .stk{font-size:12px;font-weight:700}\n#hbRoot .mbtn{position:relative;border:0;background:var(--surface);border-radius:999px;width:30px;height:30px;font-size:14px;line-height:1;padding:0;flex:none}\n#hbRoot .mbtn.has::after{content:\"\";position:absolute;top:3px;right:3px;width:8px;height:8px;border-radius:50%;background:var(--bad)}\n#hbRoot .hint{margin:0;font-size:12px;color:var(--muted)}\n#hbRoot .page.left .grow{flex:1 1 0;min-height:76px;max-height:190px;display:flex;flex-direction:column}\n#hbRoot .page.left .grow textarea{flex:1;min-height:0}\n#hbRoot textarea.lined{line-height:26px;padding-top:1px;background-color:var(--surface);background-image:repeating-linear-gradient(to bottom,transparent 0 25px,color-mix(in srgb,var(--line) 75%,transparent) 25px 26px);background-attachment:local}\n#hbRoot .tlw{flex:none}\n#hbRoot .tlw .lab{margin-bottom:0}\n#hbRoot .tl{position:relative;height:130px;margin:4px 14px 0}\n#hbRoot .tl .axis{position:absolute;left:0;right:0;top:98px;height:2px;background:var(--line);border-radius:1px}\n#hbRoot .tl .tk{position:absolute;top:104px;transform:translateX(-50%);font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}\n#hbRoot .tl .tk::before{content:\"\";position:absolute;left:50%;top:-8px;height:6px;border-left:1.5px solid var(--line)}\n#hbRoot .tl .tm{position:absolute;transform:translateX(-50%);width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:15px;line-height:1;background:var(--hs);border:2px solid var(--hs);box-shadow:0 2px 0 color-mix(in srgb,var(--hs) 30%,transparent)}\n#hbRoot .tl .tm.plan{background:var(--surface);border-style:dashed;opacity:.8}\n#hbRoot .tl .tm::after{content:\"\";position:absolute;left:50%;top:100%;height:var(--stem,10px);border-left:1.5px solid color-mix(in srgb,var(--hs) 60%,transparent)}\n#hbRoot .tl .now{position:absolute;top:2px;bottom:32px;border-left:2px solid var(--accent);opacity:.7}\n#hbRoot .tl .now span{position:absolute;top:-2px;left:4px;font-size:11px;font-weight:700;color:var(--accent-ink);white-space:nowrap}\n#hbRoot .tl-empty{padding:18px 0;text-align:center}\n#hbRoot .cdone{background:var(--accent-soft);color:var(--accent-ink);border-radius:12px;padding:6px 12px;font-weight:700;font-size:13px}\n#hbRoot .mdl{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(30,20,40,.5);padding:16px}\n#hbRoot .msheet{position:relative;width:min(460px,100%);max-height:92dvh;overflow:auto;background:var(--hp,var(--page));border:2px dashed var(--hs,var(--accent));border-radius:22px;padding:22px 18px 16px;display:grid;gap:10px;box-shadow:0 18px 40px var(--shadow)}\n#hbRoot .mh{display:flex;gap:10px;align-items:center}\n#hbRoot .mh .hhw{flex:1}\n#hbRoot .msheet h3{margin:6px 0 0;font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:18px}\n#hbRoot .drow{display:flex;gap:8px;align-items:center}\n#hbRoot .drow span{min-width:54px;font-size:13px;font-weight:700}\n#hbRoot .drow input{flex:1;min-width:0}\n#hbRoot .chips{display:flex;flex-wrap:wrap;gap:6px}\n#hbRoot .chips button{border:1.5px solid var(--line);background:var(--surface);border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:700}\n#hbRoot .chips button[aria-pressed=\"true\"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}\n#hbRoot .scroll{overflow-x:auto;max-width:100%}\n#hbRoot table{border-collapse:separate;border-spacing:0;font-size:12.5px}\n#hbRoot th,#hbRoot td{padding:0;text-align:center}\n#hbRoot .tbl th.hl{position:sticky;left:0;z-index:1;background:var(--surface);text-align:left;min-width:124px;max-width:124px;padding:5px 8px 5px 0;font-weight:700;border-bottom:1px solid var(--line)}\n#hbRoot .tbl th.hl small{display:block;font-weight:500;color:var(--muted);font-size:11px}\n#hbRoot .tbl td{padding:4px 2px;border-bottom:1px solid var(--line)}\n#hbRoot .tbl thead th{padding:3px 2px;font-weight:700;color:var(--muted)}\n#hbRoot .tbl thead th button{border:0;background:transparent;font-weight:700;color:inherit;padding:2px 0;min-width:24px}\n#hbRoot .tbl thead th.today button{color:var(--accent-ink);text-decoration:underline}\n#hbRoot .tbl .rt{padding-left:8px;min-width:76px;text-align:left;white-space:nowrap}\n#hbRoot .tbl .rt b{font-weight:800}\n#hbRoot .bar-mini{display:block;height:5px;border-radius:3px;background:var(--surface2);margin-top:3px;overflow:hidden}\n#hbRoot .bar-mini i{display:block;height:100%;background:var(--accent)}\n#hbRoot .cell{width:24px;height:24px;border:1.5px solid var(--line);border-radius:7px;background:var(--surface);color:transparent;font-size:12px;font-weight:800;padding:0;line-height:1}\n#hbRoot .cell.lg{width:34px;height:34px;font-size:15px;border-radius:9px}\n#hbRoot .cell.on{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}\n#hbRoot .cell:disabled{opacity:.35;cursor:default}\n#hbRoot .cell.part{color:var(--fg);border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--surface))}\n#hbRoot .cell.hasm{position:relative}\n#hbRoot .cell.hasm::after{content:\"\";position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:var(--bad)}\n#hbRoot td.na{color:var(--line)}\n#hbRoot .wk1.cell.on{background:var(--w1s);border-color:var(--w1s);color:var(--on-strong)}\n#hbRoot .wk2.cell.on{background:var(--w2s);border-color:var(--w2s);color:var(--on-strong)}\n#hbRoot .wk3.cell.on{background:var(--w3s);border-color:var(--w3s);color:var(--on-strong)}\n#hbRoot .wk4.cell.on{background:var(--w4s);border-color:var(--w4s);color:var(--on-strong)}\n#hbRoot .wk5.cell.on{background:var(--w5s);border-color:var(--w5s);color:var(--on-strong)}\n#hbRoot .wk6.cell.on{background:var(--w6s);border-color:var(--w6s);color:var(--on-strong)}\n#hbRoot th.wk1{background:var(--w1)}\n#hbRoot th.wk2{background:var(--w2)}\n#hbRoot th.wk3{background:var(--w3)}\n#hbRoot th.wk4{background:var(--w4)}\n#hbRoot th.wk5{background:var(--w5)}\n#hbRoot th.wk6{background:var(--w6)}\n#hbRoot .l0{--lv:var(--surface2);--lt:var(--muted)}\n#hbRoot .l1{--lv:color-mix(in srgb,var(--accent) 22%,var(--surface));--lt:var(--fg)}\n#hbRoot .l2{--lv:color-mix(in srgb,var(--accent) 45%,var(--surface));--lt:var(--fg)}\n#hbRoot .l3{--lv:color-mix(in srgb,var(--accent) 75%,var(--surface));--lt:var(--lt3)}\n#hbRoot .l4{--lv:var(--accent);--lt:var(--lt4)}\n#hbRoot .hc{background:var(--lv);color:var(--lt);font-weight:700;min-width:40px;height:28px;border-radius:6px;font-size:12px}\n#hbRoot .rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px 16px}\n#hbRoot .heat td{padding:2px;border:0}\n#hbRoot .heat th{padding:2px;font-weight:700;color:var(--muted);font-size:12px}\n#hbRoot .heat th.hl{min-width:124px;max-width:124px;text-align:left;position:sticky;left:0;background:var(--surface);z-index:1;color:var(--fg)}\n#hbRoot .sq{fill:var(--lv)}\n#hbRoot .chart{display:block;max-width:100%}\n#hbRoot .chart .gl{stroke:var(--line);stroke-width:1}\n#hbRoot .chart .ax{fill:var(--muted);font-size:10.5px}\n#hbRoot .chart .vl{fill:var(--fg);font-size:10.5px;font-weight:700}\n#hbRoot .chart .bar{fill:var(--accent)}\n#hbRoot .chart .ln{fill:none;stroke:var(--accent);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}\n#hbRoot .chart .ar{fill:color-mix(in srgb,var(--accent) 20%,transparent);stroke:none}\n#hbRoot .chart .dot{fill:var(--accent);stroke:var(--surface);stroke-width:2}\n#hbRoot .chart .wb1{fill:var(--w1)}\n#hbRoot .chart .wb2{fill:var(--w2)}\n#hbRoot .chart .wb3{fill:var(--w3)}\n#hbRoot .chart .wb4{fill:var(--w4)}\n#hbRoot .chart .wb5{fill:var(--w5)}\n#hbRoot .chart .wb6{fill:var(--w6)}\n#hbRoot .legend{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted);margin-top:8px}\n#hbRoot .legend i{width:14px;height:14px;border-radius:4px;display:inline-block;background:var(--lv)}\n#hbRoot .tag{font-size:11.5px;font-weight:700;color:var(--ok);border:1px solid var(--ok);border-radius:999px;padding:1px 8px;white-space:nowrap}\n#hbRoot .list{display:grid;gap:8px}\n#hbRoot .fgrid{display:grid;gap:10px}\n#hbRoot label.fl{display:grid;gap:4px;font-size:12.5px;font-weight:700;color:var(--muted)}\n#hbRoot .icons{display:flex;flex-wrap:wrap;gap:4px}\n#hbRoot .icons button{width:38px;height:38px;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;font-size:20px;padding:0}\n#hbRoot .icons button[aria-pressed=\"true\"]{border-color:var(--accent);background:var(--accent-soft)}\n#hbRoot .cdots{display:flex;gap:6px;flex-wrap:wrap}\n#hbRoot .cdot{width:26px;height:26px;border-radius:50%;border:2px solid transparent;background:var(--hs);padding:0}\n#hbRoot .cdot[aria-pressed=\"true\"]{border-color:var(--fg)}\n#hbRoot .mrow{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:12px 0;border-bottom:1px solid var(--line)}\n#hbRoot .mrow:last-child{border-bottom:0}\n#hbRoot .mrow .big{font-size:24px;line-height:1.2}\n#hbRoot .mrow .ctl{display:flex;gap:8px;flex-wrap:wrap;align-items:center}\n#hbRoot .mrow input[type=text]{flex:1 1 160px;min-width:0}\n#hbRoot .mrow select{border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:8px}\n#hbRoot .mrow input[type=number]{width:64px}\n#hbRoot .mrow input.tin{flex:0 0 90px;width:90px;text-align:center;font-variant-numeric:tabular-nums}\n#hbRoot input.tin{font-variant-numeric:tabular-nums}\n#hbRoot input[aria-invalid=\"true\"]{border-color:var(--bad);background:color-mix(in srgb,var(--bad) 8%,var(--surface))}\n#hbRoot .mrow input.u{flex:0 0 96px;min-width:0}\n#hbRoot .mrow .acts{display:flex;gap:6px;flex-wrap:wrap}\n#hbRoot .empty{text-align:center;padding:28px 8px;color:var(--muted)}\n#hbRoot pre.json{margin:0;max-height:200px;overflow:auto;font-size:12px;background:var(--surface2);border-radius:10px;padding:10px;white-space:pre-wrap;word-break:break-all}\n#hbRoot .fitbox{display:flex;flex-direction:column;gap:12px;min-width:0}\n#hbRoot .lay{display:grid;gap:14px;align-items:start;min-width:0}\n#hbRoot .lay.w{grid-template-columns:minmax(0,1fr) minmax(300px,440px)}\n#hbRoot .lay.y{grid-template-columns:minmax(300px,460px) minmax(0,1fr)}\n#hbRoot .lay.m{grid-template-columns:minmax(240px,320px) minmax(360px,540px) minmax(0,1fr)}\n#hbRoot .lay.m .tc{grid-column:1/-1}\n#hbRoot .lay.w .tbl{width:100%;table-layout:fixed}\n#hbRoot .lay.w .tbl th.hl{width:150px;min-width:150px;max-width:150px}\n#hbRoot .lay.w .tbl .rt{width:120px}\n#hbRoot .lay.w .cell.lg{width:100%;max-width:76px;height:42px;font-size:17px}\n#hbRoot .lay.m .tbl th.hl small{display:none}\n#hbRoot .lay.m .tbl td{padding:2px}\n#hbRoot .lay.m .tbl th.hl{padding:2px 8px 2px 0}\n#hbRoot .rline{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:5px}\n#hbRoot .rline b{font-size:13px}\n#hbRoot .rcm{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#hbRoot .aside,#hbRoot .col{display:flex;flex-direction:column;gap:14px;min-width:0}\n#hbRoot .fitbox .card.nav{padding:8px 12px}\n@media (min-width:900px) and (min-height:520px){#hbRoot.fit,#hbRoot.fit{height:100%}\n#hbRoot.fit{padding-bottom:12px;overflow:hidden}\n#hbRoot.fit .hbwrap{height:100%;display:flex;flex-direction:column}\n#hbRoot.fit #hbView{flex:1;min-height:0;padding-top:2px;position:relative;overflow:hidden;display:block}\n#hbRoot.fit .fitbox{position:absolute;left:0;top:0;width:calc(100% / var(--k,1));height:calc(100% / var(--k,1));transform:scale(var(--k,1));transform-origin:0 0}\n#hbRoot.fit .fitbox>.book,#hbRoot.fit .fitbox>.lay{flex:1;min-height:0}}\n@media (max-width:899px){#hbRoot .lay{grid-template-columns:1fr !important}}\n@media (max-width:899px){#hbRoot .book{grid-template-columns:1fr}\n#hbRoot .page.right{border-left:0;border-top:2px dashed var(--line)}\n#hbRoot .page.right::before{display:none}\n#hbRoot .tabs{margin-left:0;width:100%}}\n@media (max-width:480px){#hbRoot .top h1{font-size:26px}\n#hbRoot .bigd{font-size:38px}\n#hbRoot .tbl th.hl,#hbRoot .heat th.hl{min-width:104px;max-width:104px}\n#hbRoot .cards{grid-template-columns:1fr}}\n#hbRoot .sumcard{flex:none}\n#hbRoot .cfx{display:flex;flex-direction:column;min-height:0;min-width:0}\n#hbRoot .chartbox{flex:1 1 0;min-height:100px;overflow:hidden;position:relative}\n#hbRoot .tc{display:flex;flex-direction:column;min-height:0;min-width:0}\n#hbRoot .tc .scroll{flex:1 1 auto;min-height:0}\n#hbRoot .tc .scroll .tbl{height:100%}\n#hbRoot .hwrap{flex:1 1 0;min-height:0;overflow-x:auto}\n#hbRoot .hgrid{display:grid;grid-template-columns:minmax(110px,170px) repeat(13,minmax(30px,1fr));grid-template-rows:auto;grid-auto-rows:minmax(22px,1fr);gap:3px;height:100%;min-width:520px}\n#hbRoot .hgrid .hh2{font-size:12px;font-weight:700;color:var(--muted);text-align:center;align-self:end;padding-bottom:2px}\n#hbRoot .hgrid .hl2{display:flex;align-items:center;font-size:12.5px;font-weight:700;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#hbRoot .hgrid .hcell{background:var(--lv);color:var(--lt);border-radius:8px;display:grid;place-items:center;font-weight:700;font-size:12.5px;min-height:0}\n#hbRoot .hgrid .hcell.empty{background:transparent}\n#hbRoot .hgrid .hcell.yr{font-weight:800}\n#hbRoot .lay.m{grid-template-columns:minmax(220px,260px) minmax(0,1.15fr) minmax(300px,1fr);grid-template-areas:\"sum rsn rsn\" \"tbl tbl cht\"}\n#hbRoot .lay.m .sumc{grid-area:sum}\n#hbRoot .lay.m .rsn{grid-area:rsn}\n#hbRoot .lay.m .tc{grid-area:tbl}\n#hbRoot .lay.m .chc{grid-area:cht}\n#hbRoot .lay.m .tbl{width:100%;table-layout:fixed}\n#hbRoot .lay.m .tbl th.hl{width:150px;min-width:150px;max-width:150px}\n#hbRoot .lay.m .tbl .rt{width:96px;min-width:0}\n#hbRoot .lay.m .cell{width:100%;max-width:38px}\n#hbRoot .chart .fut{fill:none;stroke:var(--line);stroke-width:1}\n@media (min-width:900px) and (min-height:520px){#hbRoot.fit .lay{align-items:stretch}\n#hbRoot.fit .lay.w,#hbRoot.fit .lay.y{grid-template-rows:minmax(0,1fr)}\n#hbRoot.fit .lay.m{grid-template-rows:auto minmax(0,1fr)}\n#hbRoot.fit .aside>.cfx{flex:1 1 0}\n#hbRoot.fit .col>.cfx.a{flex:1.6 1 0}\n#hbRoot.fit .col>.cfx.b{flex:1 1 0}\n#hbRoot.fit .cards{align-content:stretch}\n#hbRoot .ghostcard{border:2px dashed #e8b8cf;border-radius:18px;background:transparent;color:#c0618f;font:inherit;font-weight:800;font-size:15px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:80px;opacity:.75}\n#hbRoot .ghostcard:hover{opacity:1;background:#fff0f6}\n#hbRoot .ghostcard::first-line{font-size:30px}}\n@media (max-width:899px){#hbRoot .lay.m{grid-template-areas:none !important}\n#hbRoot .lay.m>*{grid-area:auto !important}\n#hbRoot .cfx,#hbRoot .hwrap{flex:none !important}\n#hbRoot .chartbox{height:170px;flex:none}\n#hbRoot .hgrid{height:auto}}\n#hbRoot .fitbox[data-dn=\"1\"] .lay.m .cell{height:19px;max-width:30px;font-size:10.5px;border-radius:6px}\n#hbRoot .fitbox[data-dn=\"1\"] .lay.m .tbl td{padding:1px}\n#hbRoot .fitbox[data-dn=\"1\"] .lay.m .tbl th.hl{font-size:11.5px;padding:1px 6px 1px 0}\n#hbRoot .fitbox[data-dn=\"1\"] .lay.m .tbl .rt{font-size:11px}\n#hbRoot .fitbox[data-dn=\"1\"] .lay.m .tbl .bar-mini{margin-top:1px}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .cell{height:14px;max-width:26px;font-size:9px;border-radius:4px;border-width:1px}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tbl td{padding:0 1px}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tbl th.hl{font-size:10.5px;padding:0 6px 0 0}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tbl .rt{font-size:10px}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tbl thead th{font-size:10px}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tbl thead th button{font-size:10px;padding:0}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tc .note{display:none}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tc h2{margin-bottom:4px}\n#hbRoot .dy{display:grid;grid-template-columns:minmax(250px,340px) minmax(0,1fr) minmax(230px,340px);gap:14px;align-items:stretch;min-width:0}\n#hbRoot .dy .col1,#hbRoot .dy .col2,#hbRoot .dy .col3{display:flex;flex-direction:column;gap:14px;min-width:0;min-height:0}\n#hbRoot .dy .col1>.cfx,#hbRoot .dy .col2>.sheet,#hbRoot .dy .col3>.cfx{flex:1 1 0}\n#hbRoot .bigd2{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:30px;font-weight:700;color:var(--accent-ink);line-height:1;display:block}\n#hbRoot .dauto{flex:1 1 0;min-height:104px;overflow:auto;white-space:pre-wrap;font-size:12.5px;line-height:1.55;background:var(--surface2);border-radius:10px;padding:8px 10px;margin-bottom:8px}\n#hbRoot .sheet{background-image:radial-gradient(var(--dot) 1.1px,transparent 1.3px);background-size:18px 18px;gap:12px}\n#hbRoot .sg{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n#hbRoot .sf{display:flex;flex-direction:column;gap:4px;min-height:0;min-width:0}\n#hbRoot .sf>span{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:18px;font-weight:700}\n#hbRoot .sf textarea{flex:1;min-height:56px;resize:none}\n#hbRoot .sg .sf textarea{min-height:64px}\n#hbRoot .sf.grow{flex:1 1 0}\n#hbRoot .sf.grow textarea{min-height:90px}\n#hbRoot .dlist{flex:1 1 0;min-height:60px;overflow:auto;display:grid;gap:6px;align-content:start;margin-top:8px}\n#hbRoot .drow2{display:grid;grid-template-columns:auto auto 1fr;gap:8px;align-items:center;text-align:left;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:7px 10px}\n#hbRoot .drow2.on{border-color:var(--accent);background:var(--accent-soft)}\n#hbRoot .drow2 b{font-size:12.5px;white-space:nowrap}\n#hbRoot .drow2 em{font-style:normal;color:var(--muted);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}\n@media (min-width:900px) and (min-height:520px){#hbRoot.fit .fitbox>.dy{flex:1;min-height:0;grid-template-rows:minmax(0,1fr)}}\n@media (max-width:899px){#hbRoot .dy{grid-template-columns:1fr}\n#hbRoot .dlist{max-height:280px}\n#hbRoot .sf.grow textarea{min-height:150px}}\n#hbRoot{position:fixed;inset:0;z-index:2147483200;display:none;overflow:auto;margin:0}\n#hbRoot.open{display:block}\n#hbRoot [hidden]{display:none !important}\n#hbRoot .hbbanner{background:var(--accent-soft);color:var(--accent-ink);border-radius:12px;padding:8px 14px;font-size:13px;font-weight:600;margin-bottom:8px;flex:none}\n#hbRoot #hbSync.bad{background:color-mix(in srgb,var(--bad) 14%,var(--surface));color:var(--bad)}\n#hbRoot .hbclose{margin-left:6px}\n#hbRoot .lockbox{max-width:360px;margin:10vh auto 0;text-align:center;display:grid;gap:10px}\n#hbRoot .lockic{font-size:44px;line-height:1}\n#hbRoot .lockbox input{text-align:center;font-size:22px;letter-spacing:.25em}\n#hbRoot .lkpanel{display:grid;gap:10px;background:var(--surface2);border-radius:12px;padding:12px}\n#hbRoot .lkin{letter-spacing:.2em}\n";
  document.head.appendChild(st);
  var lk=document.createElement('link');lk.rel='stylesheet';lk.href='https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Noto+Sans+KR:wght@400;500;700;800&display=swap';document.head.appendChild(lk);
})();

(function(){
'use strict';
if(window.__wlHabits)return;
window.__wlHabits=true;
var ROOT=function(){return document.getElementById('hbRoot');};
var $=function(s,r){return (r||ROOT()||document).querySelector(s);};
var pad=function(n){return String(n).padStart(2,'0');};
var ymd=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
var parse=function(s){var a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2]);};
var addDays=function(s,n){var d=parse(s);d.setDate(d.getDate()+n);return ymd(d);};
var TODAY=ymd(new Date());
var dow=function(s){return (parse(s).getDay()+6)%7;};
var weekStart=function(s){return addDays(s,-dow(s));};
var DOWN=['월','화','수','목','금','토','일'];
var dim=function(y,m){return new Date(y,m,0).getDate();};
var lastOfMonth=function(s){var a=s.split('-').map(Number);return a[0]+'-'+pad(a[1])+'-'+pad(dim(a[0],a[1]));};
var firstOfMonth=function(s){return s.slice(0,7)+'-01';};
var days=function(f,t){var a=[];for(var x=f;x<=t;x=addDays(x,1))a.push(x);return a;};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var pct=function(r){return r==null?'–':Math.round(r*100)+'%';};
var lvl=function(r){return r==null?0:r<=0?0:r<.34?1:r<.67?2:r<1?3:4;};
var fmtDay=function(d){var a=d.split('-').map(Number);return a[0]+'년 '+a[1]+'월 '+a[2]+'일 ('+DOWN[dow(d)]+')';};
var uid=function(){return 'h'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);};
var nowHM=function(){var d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes());};
var hm2min=function(t){var a=String(t).split(':');return (+a[0])*60+(+a[1]);};
var min2hm=function(m){m=((m%1440)+1440)%1440;return pad(Math.floor(m/60))+':'+pad(m%60);};
/* 시계 입력: 숫자만 쳐도 된다. 800, 0800, 8:00, 830 → 08:00, 08:30. 맞지 않으면 null, 비어 있으면 '' */
function normTime(s){
  s=String(s==null?'':s).trim();
  if(!s)return '';
  var h,mi,p;
  if(s.indexOf(':')>=0){p=s.split(':');if(p.length!==2||!/^\d{1,2}$/.test(p[0])||!/^\d{1,2}$/.test(p[1]))return null;h=+p[0];mi=+p[1];}
  else{
    var d=s.replace(/\D/g,'');
    if(d.length===1||d.length===2){h=+d;mi=0;}
    else if(d.length===3){h=+d.slice(0,1);mi=+d.slice(1);}
    else if(d.length===4){h=+d.slice(0,2);mi=+d.slice(2);}
    else return null;
  }
  if(h>23||mi>59)return null;
  return pad(h)+':'+pad(mi);
}
function fmtDigits(v){var d=String(v).replace(/\D/g,'').slice(0,4);return d.length>2?d.slice(0,d.length-2)+':'+d.slice(-2):d;}

/* ───────── 저장: 클라우드(Firestore)가 기준본, 이 기기는 임시 보관 ─────────
   일기·메모 글은 잠금을 켜면 코드로 암호화해서 저장한다(AES-GCM, 키는 PBKDF2 로 코드에서 만든다).
   습관 이름·횟수·시각은 암호화하지 않는다. */
var CACHE_KEY='hb_cache_v1',COL_DEFS='habit_defs',COL_LOGS='habit_logs',COL_META='habit_meta';
var S={habits:[],logs:{},times:{},mood:{},note:{},memo:{}};
/* SY = 서버에 올라간(또는 서버에서 받은) 상태의 「글자 그대로」 모습. S 와 비교해 바뀐 칸만 올린다 */
var SY={def:{},c:{},t:{},m:{},mood:{},note:{}};
var ST={state:'init',msg:'',from:null,ready:false,metaReady:false,inflight:false,again:false,hold:false,timer:null,retry:null,fetching:false,pendingRender:false,listening:false,err:null,prevOverflow:''};
var JS=JSON.stringify;
var hasDb=function(){try{return typeof db!=='undefined'&&!!db&&typeof firebase!=='undefined';}catch(e){return false;}};
var FV=function(){return firebase.firestore.FieldValue;};
var DELM='__DEL__';

/* ── 암호화 도구 ── */
var isEnc=function(v){return typeof v==='string'&&v.slice(0,5)==='enc1:';};
var tx=function(v){return isEnc(v)?'':(v==null?'':v);};
var cryptoOk=function(){return !!(window.crypto&&window.crypto.subtle&&window.TextEncoder);};
function b64e(buf){var a=new Uint8Array(buf),s='',i;for(i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s);}
function b64d(s){var b=atob(s),a=new Uint8Array(b.length),i;for(i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
function deriveKey(code,saltB64,iter){
  return crypto.subtle.importKey('raw',new TextEncoder().encode(code),'PBKDF2',false,['deriveKey']).then(function(base){
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(saltB64),iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  });
}
function encStr(key,plain){
  var iv=crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(plain)).then(function(ct){return 'enc1:'+b64e(iv)+'.'+b64e(ct);});
}
function decStr(key,s){
  var p=s.slice(5).split('.');
  return crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(p[0])},key,b64d(p[1])).then(function(pt){return new TextDecoder().decode(pt);});
}

/* ── 잠금 상태 ── */
var LK={enabled:false,type:'pin',salt:'',iter:210000,check:'',key:null,fails:0,until:0,idleMin:5,lockOnClose:true,idleTimer:null,busy:false,msg:''};
var PREF_KEY='hb_lockpref';
function prefLoad(){try{var o=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');if(o.idleMin!=null)LK.idleMin=+o.idleMin;if(o.lockOnClose!=null)LK.lockOnClose=!!o.lockOnClose;}catch(e){}}
function prefSave(){try{localStorage.setItem(PREF_KEY,JS({idleMin:LK.idleMin,lockOnClose:LK.lockOnClose}));}catch(e){}}
var isLocked=function(){return LK.enabled&&!LK.key;};

/* 글 칸을 한꺼번에 돌린다(S 와 SY 모두). fn(문자열) → Promise<문자열> */
function mapTexts(fn){
  var jobs=[];
  Object.keys(S.note).forEach(function(d){var n=S.note[d];TEXTF.forEach(function(f){if(typeof n[f]==='string')jobs.push(fn(n[f]).then(function(v){n[f]=v;}));});});
  Object.keys(S.memo).forEach(function(d){Object.keys(S.memo[d]).forEach(function(id){var m=S.memo[d][id];if(typeof m.t==='string')jobs.push(fn(m.t).then(function(v){m.t=v;}));});});
  Object.keys(SY.note).forEach(function(d){
    var n=JSON.parse(SY.note[d]),pend=[];
    TEXTF.forEach(function(f){if(typeof n[f]==='string')pend.push(fn(n[f]).then(function(v){n[f]=v;}));});
    jobs.push(Promise.all(pend).then(function(){SY.note[d]=JS(n);}));
  });
  Object.keys(SY.m).forEach(function(d){Object.keys(SY.m[d]).forEach(function(id){
    var m=JSON.parse(SY.m[d][id]);
    if(typeof m.t==='string')jobs.push(fn(m.t).then(function(v){m.t=v;SY.m[d][id]=JS(m);}));
  });});
  return Promise.all(jobs);
}
function encryptAllMemory(){
  var key=LK.key,memo={};
  return mapTexts(function(v){
    if(isEnc(v)||v==='')return Promise.resolve(v);
    if(!memo[v])memo[v]=encStr(key,v);
    return memo[v];
  });
}
function decryptAllMemory(){
  var key=LK.key;
  return mapTexts(function(v){
    if(!isEnc(v))return Promise.resolve(v);
    return decStr(key,v).catch(function(){return v;});
  });
}
function countEnc(){
  var c=0;
  Object.keys(S.note).forEach(function(d){TEXTF.forEach(function(f){if(isEnc(S.note[d][f]))c++;});});
  Object.keys(S.memo).forEach(function(d){Object.keys(S.memo[d]).forEach(function(id){if(isEnc(S.memo[d][id].t))c++;});});
  return c;
}
/* 이 기기에 남기는 임시 보관에는 평문 글을 넣지 않는다(잠금이 켜져 있을 때) */
function stripPlain(){
  var s2=JSON.parse(JS(S)),y2=JSON.parse(JS(SY));
  function cleanNote(n){TEXTF.forEach(function(f){if(n[f]!==undefined&&!isEnc(n[f]))delete n[f];});}
  Object.keys(s2.note).forEach(function(d){cleanNote(s2.note[d]);if(!Object.keys(s2.note[d]).length)delete s2.note[d];});
  Object.keys(s2.memo).forEach(function(d){
    Object.keys(s2.memo[d]).forEach(function(id){var m=s2.memo[d][id];if(m.t!==undefined&&!isEnc(m.t))delete m.t;if(!Object.keys(m).length)delete s2.memo[d][id];});
    if(!Object.keys(s2.memo[d]).length)delete s2.memo[d];
  });
  Object.keys(y2.note).forEach(function(d){var n=JSON.parse(y2.note[d]);cleanNote(n);if(Object.keys(n).length)y2.note[d]=JS(n);else delete y2.note[d];});
  Object.keys(y2.m).forEach(function(d){
    Object.keys(y2.m[d]).forEach(function(id){var m=JSON.parse(y2.m[d][id]);if(m.t!==undefined&&!isEnc(m.t))delete m.t;if(Object.keys(m).length)y2.m[d][id]=JS(m);else delete y2.m[d][id];});
    if(!Object.keys(y2.m[d]).length)delete y2.m[d];
  });
  return {S:s2,SY:y2};
}

function cacheLoad(){
  try{
    var r=localStorage.getItem(CACHE_KEY);if(!r)return;
    var o=JSON.parse(r);
    if(o&&o.S&&o.SY){
      S=o.S;SY=o.SY;ST.from=o.from||null;
      S.habits=S.habits||[];['logs','times','mood','note','memo'].forEach(function(k){S[k]=S[k]||{};});
      ['def','c','t','m','mood','note'].forEach(function(k){SY[k]=SY[k]||{};});
      if(o.meta&&o.meta.enabled){LK.enabled=true;LK.type=o.meta.type||'pin';LK.salt=o.meta.salt||'';LK.iter=o.meta.iter||210000;LK.check=o.meta.check||'';ST.metaReady=true;}
    }
  }catch(e){}
}
function cacheSave(){
  try{
    var snap=LK.enabled?stripPlain():{S:S,SY:SY};
    localStorage.setItem(CACHE_KEY,JS({S:snap.S,SY:snap.SY,from:ST.from,meta:LK.enabled?{enabled:true,type:LK.type,salt:LK.salt,iter:LK.iter,check:LK.check}:null}));
  }catch(e){}
}
function sortHabits(){S.habits.sort(function(a,b){var ao=a.order==null?1e9:a.order,bo=b.order==null?1e9:b.order;return (ao-bo)||(a.start<b.start?-1:a.start>b.start?1:0);});}
function defOf(h){return {name:h.name,icon:h.icon,color:h.color||0,type:h.type,n:h.n||1,perDay:h.perDay||1,unit:h.unit||'',at:h.at||'',every:h.every||0,start:h.start,end:h.end||'',order:h.order==null?0:h.order};}
function habitFrom(id,d){return {id:id,name:d.name||'',icon:d.icon||'✨',color:d.color||0,type:d.type||'daily',n:d.n||1,perDay:d.perDay||1,unit:d.unit||'',at:d.at||'',every:d.every||0,start:d.start||TODAY,end:d.end||null,order:d.order==null?0:d.order};}

/* 상태 표시 */
function setState(s,msg){ST.state=s;ST.msg=msg||'';updateSync();}
function updateSync(){
  var b=$('#hbSync');if(!b)return;
  var T={init:'☁ 불러오는 중…',saved:'☁ 저장됨',dirty:'☁ 저장 대기…',saving:'☁ 저장 중…',error:'⚠ 저장 실패 · 눌러서 다시',local:'⚠ 이 기기에만 저장돼요'};
  b.textContent=T[ST.state]||'';
  b.title=ST.msg||'';
  b.classList.toggle('bad',ST.state==='error'||ST.state==='local');
  var bn=$('#hbBanner');
  if(bn){
    var t=ST.state==='error'?(ST.msg||'저장하지 못했어요. 15초 뒤 다시 시도해요.'):ST.state==='local'?'클라우드(Firebase)에 연결되지 않아 이 기기에만 저장돼요. 연결되면 자동으로 올라갑니다.':'';
    bn.textContent=t;bn.hidden=!t;
  }
  var lb=$('#hbLockBtn');if(lb)lb.hidden=!(LK.enabled&&LK.key);
}
function errText(e){
  var c=(e&&e.code)||'';
  if(c==='permission-denied')return '권한 없음: Firestore 규칙에서 habit_defs · habit_logs · habit_meta 컬렉션이 막혀 있어요. 규칙을 확인해 주세요.';
  if(c==='unavailable')return '인터넷 연결을 확인해 주세요. 연결되면 자동으로 다시 올려요.';
  return String((e&&e.message)||e||'알 수 없는 오류').slice(0,120);
}

/* 바뀐 칸 계산 */
function computeOps(){
  var ops=[],seen={};
  S.habits.forEach(function(h){
    seen[h.id]=1;var d=defOf(h),j=JS(d);
    if(SY.def[h.id]!==j)ops.push({k:'def',id:h.id,data:d,j:j});
  });
  Object.keys(SY.def).forEach(function(id){if(!seen[id])ops.push({k:'defdel',id:id});});
  var dates={};
  [S.logs,S.times,S.memo,S.mood,S.note,SY.c,SY.t,SY.m,SY.mood,SY.note].forEach(function(o){Object.keys(o).forEach(function(d){dates[d]=1;});});
  Object.keys(dates).forEach(function(d){
    var patch={},apply=[];
    [['logs','c','counts'],['times','t','times'],['memo','m','memo']].forEach(function(f){
      var cur=S[f[0]][d]||{},old=SY[f[1]][d]||{},ids={};
      Object.keys(cur).concat(Object.keys(old)).forEach(function(id){ids[id]=1;});
      Object.keys(ids).forEach(function(id){
        var cj=cur[id]===undefined?undefined:JS(cur[id]);
        if(cj===old[id])return;
        (patch[f[2]]=patch[f[2]]||{})[id]=cj===undefined?DELM:cur[id];
        apply.push([f[1],d,id,cj]);
      });
    });
    var mj=S.mood[d]===undefined?undefined:JS(S.mood[d]);
    if(mj!==SY.mood[d]){patch.mood=mj===undefined?DELM:S.mood[d];apply.push(['mood',d,null,mj]);}
    var nj=S.note[d]===undefined?undefined:JS(S.note[d]);
    if(nj!==SY.note[d]){patch.note=nj===undefined?DELM:S.note[d];apply.push(['note',d,null,nj]);}
    if(apply.length)ops.push({k:'day',d:d,patch:patch,apply:apply});
  });
  return ops;
}
function setSY(f,d,id,j){
  if(f==='mood'||f==='note'){if(j===undefined)delete SY[f][d];else SY[f][d]=j;return;}
  var o=SY[f][d]=SY[f][d]||{};
  if(j===undefined){delete o[id];if(!Object.keys(o).length)delete SY[f][d];}else o[id]=j;
}
function setLocal(f,d,id,v){
  if(f==='mood'||f==='note'){if(v===undefined)delete S[f][d];else S[f][d]=v;return;}
  var o=S[f][d]=S[f][d]||{};
  if(v===undefined){delete o[id];if(!Object.keys(o).length)delete S[f][d];}else o[id]=v;
}
function applyOp(op){
  if(op.k==='def')SY.def[op.id]=op.j;
  else if(op.k==='defdel')delete SY.def[op.id];
  else op.apply.forEach(function(a){setSY(a[0],a[1],a[2],a[3]);});
}
function materialize(x){
  if(x===DELM)return FV().delete();
  if(x&&typeof x==='object'&&!Array.isArray(x)){var o={};Object.keys(x).forEach(function(k){o[k]=materialize(x[k]);});return o;}
  return x;
}
/* 올릴 때: 잠금이 켜져 있고 코드가 풀려 있으면 글 칸을 암호화한다 */
function patchHasPlain(patch){
  var plain=false;
  function chk(v){if(typeof v==='string'&&v!==DELM&&v!==''&&!isEnc(v))plain=true;}
  if(patch.note&&typeof patch.note==='object')TEXTF.forEach(function(f){chk(patch.note[f]);});
  if(patch.memo)Object.keys(patch.memo).forEach(function(id){var m=patch.memo[id];if(m&&typeof m==='object')chk(m.t);});
  return plain;
}
function encPatch(patch,key){
  var out=JSON.parse(JS(patch)),jobs=[];
  function enc(o,k){var v=o&&o[k];if(typeof v==='string'&&v!==DELM&&v!==''&&!isEnc(v))jobs.push(encStr(key,v).then(function(c){o[k]=c;}));}
  if(out.note&&typeof out.note==='object')TEXTF.forEach(function(f){enc(out.note,f);});
  if(out.memo)Object.keys(out.memo).forEach(function(id){if(out.memo[id]&&typeof out.memo[id]==='object')enc(out.memo[id],'t');});
  return Promise.all(jobs).then(function(){return out;});
}
function commit(chunk){
  var key=LK.enabled?LK.key:null;
  return Promise.all(chunk.map(function(op){
    if(op.k==='day'&&key)return encPatch(op.patch,key).then(function(p){return {op:op,patch:p};});
    return Promise.resolve({op:op,patch:op.patch});
  })).then(function(items){
    var batch=db.batch(),ts=FV().serverTimestamp();
    items.forEach(function(it){
      var op=it.op;
      if(op.k==='def')batch.set(db.collection(COL_DEFS).doc(op.id),Object.assign({},op.data,{updatedAt:ts}));
      else if(op.k==='defdel')batch.delete(db.collection(COL_DEFS).doc(op.id));
      else batch.set(db.collection(COL_LOGS).doc(op.d),Object.assign({date:op.d,updatedAt:ts},materialize(it.patch)),{merge:true});
    });
    return batch.commit();
  });
}
function flush(){
  if(ST.inflight||ST.hold){ST.again=true;return;}
  var ops=computeOps();
  /* 잠겨 있는 동안에는 평문 글을 올리지 않는다(코드가 풀리면 올린다) */
  if(LK.enabled&&!LK.key)ops=ops.filter(function(op){return !(op.k==='day'&&patchHasPlain(op.patch));});
  if(!ops.length){setState(hasDb()?(ST.state==='init'?'init':'saved'):'local');return;}
  if(!hasDb()){setState('local');return;}
  ST.inflight=true;setState('saving');
  var chunks=[],i;for(i=0;i<ops.length;i+=400)chunks.push(ops.slice(i,i+400));
  var p=Promise.resolve();
  chunks.forEach(function(ch){p=p.then(function(){return commit(ch).then(function(){ch.forEach(applyOp);cacheSave();});});});
  p.then(function(){
    ST.inflight=false;ST.err=null;
    if(ST.again){ST.again=false;flush();}else setState(computeOps().length?'dirty':'saved');
  }).catch(function(e){
    ST.inflight=false;ST.err=e;setState('error',errText(e));
    clearTimeout(ST.retry);ST.retry=setTimeout(flush,15000);
  });
}
function save(){
  S.habits.forEach(function(h,i){h.order=i;});
  cacheSave();
  clearTimeout(ST.timer);ST.timer=setTimeout(flush,400);
  if(ST.state==='saved')setState('dirty');
}

/* 받을 때: 코드가 풀려 있으면 암호문을 풀어서 적용한다 */
function decData(data){
  if(!LK.key||!data)return Promise.resolve(data);
  var key=LK.key,out=JSON.parse(JS(data)),jobs=[];
  function dec(o,k){var v=o&&o[k];if(isEnc(v))jobs.push(decStr(key,v).then(function(p){o[k]=p;},function(){}));}
  if(out.note)TEXTF.forEach(function(f){dec(out.note,f);});
  if(out.memo)Object.keys(out.memo).forEach(function(id){dec(out.memo[id],'t');});
  return Promise.all(jobs).then(function(){return out;});
}
/* 다른 기기에서 바뀐 것 받기 — 아직 못 올린 내 수정은 그대로 둔다 */
function applyDay(d,data){
  [['logs','c','counts'],['times','t','times'],['memo','m','memo']].forEach(function(f){
    var remote=data[f[2]]||{},cur=S[f[0]][d]||{},old=SY[f[1]][d]||{},ids={};
    Object.keys(remote).concat(Object.keys(cur)).concat(Object.keys(old)).forEach(function(id){ids[id]=1;});
    Object.keys(ids).forEach(function(id){
      var cj=cur[id]===undefined?undefined:JS(cur[id]);
      if(cj!==old[id])return;
      var rv=remote[id];
      setSY(f[1],d,id,rv===undefined?undefined:JS(rv));
      setLocal(f[0],d,id,rv===undefined?undefined:JSON.parse(JS(rv)));
    });
  });
  ['mood','note'].forEach(function(f){
    var cur=S[f][d],cj=cur===undefined?undefined:JS(cur);
    if(cj!==SY[f][d])return;
    var rv=data[f];
    setSY(f,d,null,rv===undefined?undefined:JS(rv));
    setLocal(f,d,null,rv===undefined?undefined:JSON.parse(JS(rv)));
  });
}
function applyDef(id,data){
  var idx=-1;S.habits.forEach(function(h,i){if(h.id===id)idx=i;});
  var clean=idx<0?SY.def[id]===undefined:SY.def[id]===JS(defOf(S.habits[idx]));
  if(!clean)return;
  if(!data){if(idx>=0)S.habits.splice(idx,1);delete SY.def[id];return;}
  var h=habitFrom(id,data);
  if(idx>=0)S.habits[idx]=h;else S.habits.push(h);
  SY.def[id]=JS(defOf(h));
}
function applyMeta(data){
  var was=LK.enabled,prevSalt=LK.salt;
  if(data&&data.enabled){
    LK.enabled=true;LK.type=data.type||'pin';LK.salt=data.salt||'';LK.iter=data.iter||210000;LK.check=data.check||'';
    if(LK.key&&LK.salt!==prevSalt){LK.key=null;}                         // 다른 기기에서 코드를 바꿨다
    if(!was||!LK.key){var t=stripPlain();S=t.S;SY=t.SY;}                 // 평문 글은 비우고 코드를 묻는다
  }else{
    LK.enabled=false;LK.key=null;clearTimeout(LK.idleTimer);
  }
  ST.metaReady=true;cacheSave();
}
function isOpen(){var r=ROOT();return !!(r&&r.classList.contains('open'));}
function softRender(){
  if(!isOpen())return;
  var a=document.activeElement,r=ROOT();
  if(a&&r.contains(a)&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA')){ST.pendingRender=true;return;}
  render();
}
function onErr(e){ST.ready=true;ST.metaReady=true;setState('error',errText(e));softRender();}
function startCloud(){
  if(ST.listening)return;
  if(!hasDb()){ST.ready=true;ST.metaReady=true;setState('local');softRender();return;}
  ST.listening=true;
  var base=addDays(TODAY,-400),from=(ST.from&&ST.from<base)?ST.from:base;
  ST.from=from;
  var need={defs:1,logs:1,meta:1},DID=firebase.firestore.FieldPath.documentId();
  function got(k){
    delete need[k];
    if(!Object.keys(need).length){ST.ready=true;ST.metaReady=true;if(ST.state==='init')setState('saved');}
    softRender();
  }
  setTimeout(function(){if(!ST.ready){ST.ready=true;ST.metaReady=true;if(ST.state==='init')setState('saved');softRender();}},8000);
  var firstDefs=true,firstLogs=true,firstMeta=true;
  db.collection(COL_META).onSnapshot(function(snap){
    snap.docChanges().forEach(function(ch){if(ch.doc.id==='security')applyMeta(ch.type==='removed'?null:ch.doc.data());});
    if(firstMeta){
      firstMeta=false;var has=false;snap.docs.forEach(function(d){if(d.id==='security')has=true;});
      if(!has&&LK.enabled)applyMeta(null);                               // 서버에 잠금 문서가 없으면(다른 기기에서 껐으면) 끈 것으로
    }
    got('meta');
  },onErr);
  db.collection(COL_DEFS).onSnapshot(function(snap){
    snap.docChanges().forEach(function(ch){applyDef(ch.doc.id,ch.type==='removed'?null:ch.doc.data());});
    if(firstDefs){
      firstDefs=false;var all={};snap.docs.forEach(function(d){all[d.id]=1;});
      S.habits.slice().forEach(function(h){if(!all[h.id])applyDef(h.id,null);});
    }
    sortHabits();cacheSave();got('defs');
  },onErr);
  db.collection(COL_LOGS).where(DID,'>=',from).onSnapshot(function(snap){
    var ch=snap.docChanges();
    Promise.all(ch.map(function(c){
      if(c.type==='removed')return Promise.resolve({id:c.doc.id,data:{}});
      return decData(c.doc.data()).then(function(x){return {id:c.doc.id,data:x};});
    })).then(function(items){
      items.forEach(function(it){applyDay(it.id,it.data);});
      if(firstLogs){
        firstLogs=false;var have={},ds={};snap.docs.forEach(function(d){have[d.id]=1;});
        [S.logs,S.times,S.memo,S.mood,S.note,SY.c,SY.t,SY.m,SY.mood,SY.note].forEach(function(o){Object.keys(o).forEach(function(d){if(d>=from)ds[d]=1;});});
        Object.keys(ds).forEach(function(d){if(!have[d])applyDay(d,{});});
      }
      cacheSave();got('logs');
    });
  },onErr);
}
function viewStart(){
  if(ui.tab==='day'||ui.tab==='diary')return ui.date;
  if(ui.tab==='week')return weekStart(ui.date);
  if(ui.tab==='month')return ui.month+'-01';
  if(ui.tab==='year')return ui.year+'-01-01';
  return TODAY;
}
function ensureFrom(date){
  if(!hasDb()||!ST.from||date>=ST.from||ST.fetching)return;
  ST.fetching=true;
  var upto=ST.from,target=date,DID=firebase.firestore.FieldPath.documentId();
  db.collection(COL_LOGS).where(DID,'>=',target).where(DID,'<',upto).get().then(function(snap){
    var arr=[];snap.forEach(function(d){arr.push(d);});
    return Promise.all(arr.map(function(d){return decData(d.data()).then(function(x){return {id:d.id,data:x};});}));
  }).then(function(items){
    items.forEach(function(it){applyDay(it.id,it.data);});
    ST.from=target;ST.fetching=false;cacheSave();softRender();
  }).catch(function(e){ST.fetching=false;setState('error',errText(e));});
}

/* ───────── 잠금: 켜기 · 끄기 · 풀기 · 잠그기 ───────── */
function loadAll(){
  if(!hasDb())return Promise.reject(new Error('클라우드에 연결된 뒤에 할 수 있어요'));
  return db.collection(COL_LOGS).get().then(function(snap){
    var arr=[];snap.forEach(function(d){arr.push(d);});
    return Promise.all(arr.map(function(d){return decData(d.data()).then(function(x){return {id:d.id,data:x};});}));
  }).then(function(items){
    items.forEach(function(it){applyDay(it.id,it.data);});
    var m=items.map(function(i){return i.id;}).sort()[0];
    if(m&&(!ST.from||m<ST.from))ST.from=m;
    cacheSave();
  });
}
/* 모든 날의 글 칸을 지금 상태로 다시 쓴다. mode 'enc' = 암호화해서, 'plain' = 평문으로 */
function rewriteTexts(mode){
  var key=LK.key,patches={},jobs=[];
  function conv(v){
    if(typeof v!=='string'||v==='')return Promise.resolve(undefined);
    if(mode==='enc')return isEnc(v)?Promise.resolve(undefined):encStr(key,v);
    return Promise.resolve(v);
  }
  Object.keys(S.note).forEach(function(d){TEXTF.forEach(function(f){
    jobs.push(conv(S.note[d][f]).then(function(x){if(x===undefined)return;var p=patches[d]=patches[d]||{};(p.note=p.note||{})[f]=x;}));
  });});
  Object.keys(S.memo).forEach(function(d){Object.keys(S.memo[d]).forEach(function(id){
    jobs.push(conv(S.memo[d][id].t).then(function(x){if(x===undefined)return;var p=patches[d]=patches[d]||{};p.memo=p.memo||{};(p.memo[id]=p.memo[id]||{}).t=x;}));
  });});
  return Promise.all(jobs).then(function(){
    var dates=Object.keys(patches),chunks=[],i;
    for(i=0;i<dates.length;i+=400)chunks.push(dates.slice(i,i+400));
    return chunks.reduce(function(p,ch){
      return p.then(function(){
        var b=db.batch(),ts=FV().serverTimestamp();
        ch.forEach(function(d){b.set(db.collection(COL_LOGS).doc(d),Object.assign({date:d,updatedAt:ts},patches[d]),{merge:true});});
        return b.commit();
      });
    },Promise.resolve());
  });
}
function verifyCode(code){
  return deriveKey(code,LK.salt,LK.iter).then(function(key){
    return decStr(key,LK.check).then(function(p){if(p!=='hb-check')throw 0;return key;});
  }).catch(function(){var e=new Error('코드가 맞지 않아요');e.wrong=true;throw e;});
}
function enableLock(code,type){
  var salt=b64e(crypto.getRandomValues(new Uint8Array(16))),iter=210000;
  ST.hold=true;
  return deriveKey(code,salt,iter).then(function(key){
    return encStr(key,'hb-check').then(function(check){
      return loadAll().then(function(){
        LK.salt=salt;LK.type=type;LK.iter=iter;LK.check=check;LK.key=key;LK.enabled=true;
        return db.collection(COL_META).doc('security').set({enabled:true,type:type,salt:salt,iter:iter,check:check,updatedAt:FV().serverTimestamp()}).catch(function(e){LK.enabled=false;LK.key=null;throw e;});
      }).then(function(){return rewriteTexts('enc');});
    });
  }).then(function(){ST.hold=false;LK.fails=0;cacheSave();flush();}).catch(function(e){ST.hold=false;flush();throw e;});
}
function disableLock(code){
  ST.hold=true;
  return verifyCode(code).then(function(key){
    LK.key=key;
    return loadAll().then(function(){
      var n=countEnc();
      if(n>0)throw new Error('풀지 못한 글이 '+n+'개 있어요. 코드가 맞는지 확인해 주세요.');
      return rewriteTexts('plain');
    }).then(function(){
      return db.collection(COL_META).doc('security').set({enabled:false,updatedAt:FV().serverTimestamp()});
    }).then(function(){LK.enabled=false;LK.key=null;clearTimeout(LK.idleTimer);cacheSave();});
  }).then(function(){ST.hold=false;flush();}).catch(function(e){ST.hold=false;flush();throw e;});
}
function changeCode(oldCode,newCode,type){
  return disableLock(oldCode).then(function(){
    return enableLock(newCode,type).catch(function(e){e.message='잠금이 꺼진 상태예요. 다시 켜 주세요. ('+e.message+')';throw e;});
  });
}
function lockNow(){
  if(!LK.enabled||!LK.key)return Promise.resolve();
  return encryptAllMemory().then(function(){
    LK.key=null;clearTimeout(LK.idleTimer);ui.modal=null;ui.dq='';LK.msg='';
    cacheSave();updateSync();if(isOpen())render();
  });
}
function touchIdle(){
  if(!LK.enabled||!LK.key||!(LK.idleMin>0))return;
  clearTimeout(LK.idleTimer);LK.idleTimer=setTimeout(lockNow,LK.idleMin*60000);
}
function doUnlock(code){
  if(LK.busy||!LK.enabled||LK.key)return;
  var now=Date.now(),msg=function(t){LK.msg=t;var m=$('#hbLockMsg');if(m)m.textContent=t;};
  if(now<LK.until){msg('잠시 후 다시 해 주세요 ('+Math.ceil((LK.until-now)/1000)+'초)');return;}
  if(!code){msg('코드를 입력해 주세요');return;}
  if(!cryptoOk()){msg('이 브라우저에서는 암호화를 쓸 수 없어요 (https 주소에서만 가능)');return;}
  LK.busy=true;msg('확인 중…');
  verifyCode(code).then(function(key){
    LK.key=key;LK.fails=0;
    return decryptAllMemory();
  }).then(function(){
    LK.busy=false;LK.msg='';touchIdle();updateSync();render();
    ST.pendingFlush=true;clearTimeout(ST.timer);ST.timer=setTimeout(flush,200);
  }).catch(function(){
    LK.busy=false;LK.key=null;LK.fails++;
    if(LK.fails>=5)LK.until=Date.now()+Math.min(300000,30000*Math.pow(2,LK.fails-5));
    msg('코드가 맞지 않아요'+(LK.fails>=5?' · '+Math.ceil((LK.until-Date.now())/1000)+'초 기다려 주세요':''));
    var i=$('#hbCode');if(i){i.value='';i.focus();}
  });
}

/* 잠금 화면 / 설정 카드 */
function lockHtml(){
  return '<div class="card lockbox"><div class="lockic">🔒</div><h2>잠겨 있어요</h2><p class="note" style="margin:0">'+(LK.type==='pin'?'숫자 6자리 코드를 입력하세요':'비밀번호를 입력하세요')+'</p>'
    +'<input type="password" id="hbCode" data-f="code" autocomplete="off" '+(LK.type==='pin'?'inputmode="numeric" maxlength="6" placeholder="● ● ● ● ● ●"':'placeholder="비밀번호"')+'>'
    +'<button class="btn pri" type="button" data-act="unlock">열기</button><div class="note" id="hbLockMsg" style="min-height:1.4em">'+esc(LK.msg||'')+'</div></div>';
}
function lkPanelHtml(){
  var m=ui.lkpanel,type=ui.lktype||'pin',s='<div class="lkpanel">';
  if(m==='on'||m==='change'){
    s+='<div class="chips" role="group" aria-label="코드 종류"><button type="button" data-act="lktype" data-v="pin" aria-pressed="'+(type==='pin')+'">숫자 6자리</button><button type="button" data-act="lktype" data-v="pw" aria-pressed="'+(type==='pw')+'">비밀번호(6자 이상)</button></div>';
  }
  if(m==='change'||m==='off')s+='<label class="fl">지금 쓰는 코드<input type="password" class="lkin" id="lkOld" data-f="lkold" autocomplete="off"'+(LK.type==='pin'?' inputmode="numeric" maxlength="6"':'')+'></label>';
  if(m==='on'||m==='change'){
    var ia=type==='pin'?' inputmode="numeric" maxlength="6"':'';
    s+='<label class="fl">'+(m==='change'?'새 코드':'코드')+'<input type="password" class="lkin" id="lkNew" data-f="lknew" autocomplete="off"'+ia+'></label>'
      +'<label class="fl">한 번 더<input type="password" class="lkin" id="lkNew2" data-f="lknew" autocomplete="off"'+ia+'></label>';
    if(type==='pin')s+='<p class="note" style="margin:0">숫자 6자리는 짐작하기 쉬워요. 가능하면 글자가 섞인 6자 이상 비밀번호를 쓰세요.</p>';
  }
  s+='<p class="note" id="lkMsg" style="margin:0;min-height:1.3em">'+esc(ui.lkmsg||'')+'</p>'
    +'<div class="acts"><button class="btn sm pri" type="button" data-act="lkgo">'+(m==='on'?'잠금 켜기':m==='off'?'잠금 끄기':'코드 바꾸기')+'</button><button class="btn sm" type="button" data-act="lkcancel">취소</button></div></div>';
  return s;
}
function lockCardHtml(){
  var s='<div class="card fgrid"><h2 style="margin:0">잠금 (보안)</h2>';
  if(LK.enabled){
    s+='<p class="note" style="margin:0">잠금이 <b>켜져 있어요</b> ('+(LK.type==='pin'?'숫자 6자리':'비밀번호')+'). 일기·메모 글은 이 코드로 암호화돼서 저장돼요.</p>'
      +'<div style="display:flex;gap:10px;flex-wrap:wrap"><label class="fl" style="flex:1 1 150px">자동 잠금<select class="f" data-f="lkidle">'
      +[[0,'끔'],[1,'1분'],[5,'5분'],[15,'15분']].map(function(o){return '<option value="'+o[0]+'"'+(LK.idleMin===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')
      +'</select></label><label class="fl" style="flex:1 1 150px">이 화면을 닫을 때<select class="f" data-f="lkclose"><option value="1"'+(LK.lockOnClose?' selected':'')+'>바로 잠그기</option><option value="0"'+(LK.lockOnClose?'':' selected')+'>잠그지 않기</option></select></label></div>'
      +(ui.lkpanel?'':'<div class="acts"><button class="btn sm" type="button" data-act="lknow">지금 잠그기</button><button class="btn sm" type="button" data-act="lkchange">코드 바꾸기</button><button class="btn sm warn" type="button" data-act="lkoff">잠금 끄기</button></div>');
  }else{
    s+='<p class="note" style="margin:0">잠금을 켜면 열 때마다 코드를 묻고, 일기·메모 글을 암호화해서 저장해요.</p>'+(ui.lkpanel?'':'<div class="acts"><button class="btn sm pri" type="button" data-act="lkon">잠금 켜기</button></div>');
  }
  if(ui.lkpanel)s+=lkPanelHtml();
  else if(ui.lkmsg)s+='<p class="note" style="margin:0;color:var(--ok)">'+esc(ui.lkmsg)+'</p>';
  return s+'<p class="note" style="margin:0">⚠ 코드를 잊으면 암호화된 글은 되살릴 수 없어요. 습관 이름·횟수·시각은 암호화되지 않아요. 클라우드 접근 자체를 막으려면 Firebase 로그인과 규칙이 따로 필요해요.</p></div>';
}
function lockAct(a,b){
  if(a==='unlock'){var inp=$('#hbCode');doUnlock(inp?inp.value:'');return true;}
  if(a==='lknow'){lockNow();return true;}
  if(a==='lkon'||a==='lkchange'||a==='lkoff'){ui.lkpanel=a.slice(2);ui.lkmsg='';ui.lktype=ui.lktype||'pin';render();return true;}
  if(a==='lkcancel'){ui.lkpanel=null;ui.lkmsg='';render();return true;}
  if(a==='lktype'){ui.lktype=b.dataset.v;render();return true;}
  if(a==='lkgo'){lockGo();return true;}
  return false;
}
function lockGo(){
  var mode=ui.lkpanel,type=ui.lktype||'pin';
  var val=function(id){var e=$('#'+id);return e?e.value:'';};
  var old=val('lkOld'),c1=val('lkNew'),c2=val('lkNew2');
  var setMsg=function(t,bad){ui.lkmsg=t;var m=$('#lkMsg');if(m){m.textContent=t;m.style.color=bad?'var(--bad)':'var(--ok)';}};
  if(LK.busy)return;
  if(mode==='on'||mode==='change'){
    if(type==='pin'&&!/^\d{6}$/.test(c1))return setMsg('숫자 6자리를 입력해 주세요',1);
    if(type==='pw'&&c1.length<6)return setMsg('비밀번호는 6자 이상으로 해 주세요',1);
    if(c1!==c2)return setMsg('두 번 입력한 코드가 달라요',1);
  }
  if((mode==='change'||mode==='off')&&!old)return setMsg('지금 쓰는 코드를 입력해 주세요',1);
  if(!cryptoOk())return setMsg('이 브라우저에서는 암호화를 쓸 수 없어요 (https 주소에서만 가능)',1);
  if(!hasDb())return setMsg('클라우드에 연결된 뒤에 설정할 수 있어요',1);
  LK.busy=true;setMsg('처리 중… 글이 많으면 잠시 걸려요');
  var p=mode==='on'?enableLock(c1,type):mode==='off'?disableLock(old):changeCode(old,c1,type);
  p.then(function(){
    LK.busy=false;ui.lkpanel=null;ui.lkmsg=mode==='off'?'잠금을 껐어요':mode==='change'?'코드를 바꿨어요':'잠금을 켰어요';
    touchIdle();updateSync();render();
  }).catch(function(e){LK.busy=false;setMsg(e&&e.wrong?'지금 코드가 맞지 않아요':errText(e),1);});
}
function lockField(el,f,e){
  var digits=function(v){return String(v).replace(/\D/g,'').slice(0,6);};
  if(f==='code'){
    if(e.type==='input'&&LK.type==='pin'){el.value=digits(el.value);if(el.value.length===6)doUnlock(el.value);}
    return true;
  }
  if(f==='lknew'||f==='lkold'){
    var pinMode=(f==='lkold')?LK.type==='pin':(ui.lktype||'pin')==='pin';
    if(e.type==='input'&&pinMode)el.value=digits(el.value);
    return true;
  }
  if(f==='lkidle'&&e.type==='change'){LK.idleMin=+el.value;prefSave();touchIdle();return true;}
  if(f==='lkclose'&&e.type==='change'){LK.lockOnClose=el.value==='1';prefSave();return true;}
  return false;
}


/* ───────── 습관 모델 도우미 ───────── */
var perDay=function(h){return h.perDay>1?h.perDay:1;};
var colOf=function(h){return h.color>=1&&h.color<=8?h.color:(S.habits.indexOf(h)%8)+1;};
function planned(h){
  if(!/^\d\d:\d\d$/.test(h.at||''))return null;
  var b=hm2min(h.at),st=(h.every>0?h.every:0)*60,n=perDay(h),a=[];
  for(var i=0;i<n;i++)a.push(i===0||st>0?min2hm(b+i*st):'');
  return a;
}

/* ───────── 계산 ───────── */
var isAct=function(h,d){return d>=h.start&&(!h.end||d<=h.end);};
var getN=function(h,d){return (S.logs[d]&&S.logs[d][h.id])||0;};
var chk=function(h,d){return getN(h,d)>=perDay(h);};
var frac=function(h,d){return Math.min(getN(h,d),perDay(h))/perDay(h);};
var getT=function(h,d){return (S.times[d]&&S.times[d][h.id])||[];};
function setT(h,d,arr){
  var m=S.times[d]=S.times[d]||{};
  if(arr.length)m[h.id]=arr;else{delete m[h.id];if(!Object.keys(m).length)delete S.times[d];}
}
function addDose(h,d){
  var L=S.logs[d]=S.logs[d]||{},n=L[h.id]||0,t=getT(h,d).slice();
  L[h.id]=Math.min(n+1,99);
  while(t.length<n)t.push('');
  var pl=planned(h);
  t.push(d===TODAY?nowHM():((pl&&pl[n])||''));
  setT(h,d,t);
}
function removeDose(h,d,idx){
  var L=S.logs[d];if(!L||!L[h.id])return;
  var n=L[h.id],t=getT(h,d).slice();
  while(t.length<n)t.push('');
  t.splice(idx==null?n-1:idx,1);n--;
  if(n<=0)delete L[h.id];else L[h.id]=n;
  if(!Object.keys(L).length)delete S.logs[d];
  setT(h,d,t);
}
function clearDay(h,d){
  var L=S.logs[d];if(L){delete L[h.id];if(!Object.keys(L).length)delete S.logs[d];}
  setT(h,d,[]);
}
function cnt(h,f,t){var c=0;for(var x=f;x<=t;x=addDays(x,1))if(chk(h,x))c++;return c;}
function fsum(h,f,t){var c=0;for(var x=f;x<=t;x=addDays(x,1))c+=frac(h,x);return c;}
function pStart(h,d){return h.type==='week'?weekStart(d):firstOfMonth(d);}
function pEnd(h,d){return h.type==='week'?addDays(weekStart(d),6):lastOfMonth(d);}
function openOn(h,d){
  if(!isAct(h,d))return false;
  if(h.type==='daily'||chk(h,d))return true;
  return cnt(h,pStart(h,d),addDays(d,-1))<h.n;
}
function dayStat(d){
  var hs=S.habits.filter(function(h){return openOn(h,d);});
  var fr=0,full=0;
  hs.forEach(function(h){fr+=frac(h,d);if(chk(h,d))full++;});
  return {done:full,total:hs.length,rate:hs.length?fr/hs.length:null};
}
function hStat(h,from,to){
  var hi=to<TODAY?to:TODAY,done=0,goal=0;
  var lo=from>h.start?from:h.start,end=(h.end&&h.end<hi)?h.end:hi;
  if(lo>end)return {done:0,goal:0,rate:null};
  if(h.type==='daily'){done=fsum(h,lo,end);goal=days(lo,end).length;}
  else if(h.type==='week'){
    for(var ws=weekStart(from);ws<=hi;ws=addDays(ws,7)){
      var th=addDays(ws,3);if(th<from||th>to)continue;
      var we=addDays(ws,6),a0=ws>h.start?ws:h.start,a1=(h.end&&h.end<we)?h.end:we;
      if(a0>a1)continue;
      var g=Math.min(h.n,days(a0,a1).length);done+=Math.min(cnt(h,a0,a1),g);goal+=g;
    }
  }else{
    for(var ms=firstOfMonth(from);ms<=hi;ms=addDays(lastOfMonth(ms),1)){
      var me=lastOfMonth(ms);if(me<from||ms>to)continue;
      var b0=ms>h.start?ms:h.start,b1=(h.end&&h.end<me)?h.end:me;
      if(b0>b1)continue;
      var g2=Math.min(h.n,days(b0,b1).length);done+=Math.min(cnt(h,b0,b1),g2);goal+=g2;
    }
  }
  return {done:done,goal:goal,rate:goal?done/goal:null};
}
function overall(from,to){
  var done=0,goal=0;
  S.habits.forEach(function(h){var s=hStat(h,from,to);done+=s.done;goal+=s.goal;});
  return {done:done,goal:goal,rate:goal?done/goal:null};
}
function streak(h){
  var c=0,d,ws;
  if(h.type==='month')return null;
  if(h.type==='daily'){d=chk(h,TODAY)?TODAY:addDays(TODAY,-1);while(d>=h.start&&chk(h,d)){c++;d=addDays(d,-1);}return {c:c,u:'일'};}
  ws=weekStart(TODAY);if(cnt(h,ws,addDays(ws,6))>=h.n)c++;
  ws=addDays(ws,-7);
  while(addDays(ws,6)>=h.start&&cnt(h,ws,addDays(ws,6))>=h.n){c++;ws=addDays(ws,-7);}
  return {c:c,u:'주'};
}
var freqText=function(h){return (h.type==='daily'?'매일':h.type==='week'?'주 '+h.n+'회':'월 '+h.n+'회')+(perDay(h)>1?' · 하루 '+perDay(h)+(h.unit||'회'):'');};
function subText(h){
  var pd=perDay(h);
  if(pd===1)return freqText(h)+(h.at?' · '+h.at:'');
  var s=(h.type==='daily'?'':(h.type==='week'?'주 '+h.n+'회 · ':'월 '+h.n+'회 · '))+'하루 '+pd+(h.unit||'회');
  if(h.at)s+=' · '+h.at+'부터'+(h.every>0?' '+h.every+'시간마다':'');
  else if(h.every>0)s+=' · '+h.every+'시간마다';
  return s;
}
var weekLabel=function(ws){var th=addDays(ws,3),a=th.split('-').map(Number);return a[1]+'월 '+Math.ceil(a[2]/7)+'주차';};
var wkIdx=function(d,first){return Math.floor((parseInt(d.slice(8),10)-1+dow(first))/7)+1;};
var habitById=function(id){return S.habits.filter(function(z){return z.id===id;})[0];};

/* ───────── 메모 ───────── */
var REASONS=['시간 없음','깜빡함','몸 상태','일정·약속','의욕 없음','기타'];
function memoGet(d,id){return (S.memo[d]||{})[id]||{};}
function memoSet(d,id,patch){
  var m=S.memo[d]=S.memo[d]||{};
  var o=Object.assign({},m[id],patch);
  if(!o.r)delete o.r;if(!o.t)delete o.t;
  if(!o.r&&!o.t){delete m[id];if(!Object.keys(m).length)delete S.memo[d];}else m[id]=o;
  save();
}
function memoText(mm){return (mm.r?'['+mm.r+'] ':'')+tx(mm.t);}

/* ───────── 그림 ───────── */
var CH={};
function chartBox(id,fn,minH){CH[id]=fn;return '<div class="chartbox" data-c="'+id+'" style="min-height:'+(minH||140)+'px"></div>';}
function drawCharts(){
  ROOT().querySelectorAll('.chartbox').forEach(function(b){
    var fn=CH[b.dataset.c];if(!fn)return;
    var W=Math.max(120,Math.floor(b.clientWidth)),H=Math.max(90,Math.floor(b.clientHeight));
    b.innerHTML=fn(W,H);
  });
}
function calSvg(y,W,H){
  var first=y+'-01-01',last=y+'-12-31',ds=days(first,last),off=dow(first),cols=Math.ceil((ds.length+off)/7);
  var top=16,cell=Math.max(4,Math.min((W-4)/cols,(H-top-2)/7)),sz=cell*.84;
  var g='<svg class="chart" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="하루 완료율 달력">';
  ds.forEach(function(d,i){
    var c=Math.floor((i+off)/7),r=(i+off)%7,x=2+c*cell,yy=top+r*cell,st=d<=TODAY?dayStat(d):{rate:null,done:0,total:0};
    if(d.slice(8)==='01')g+='<text class="ax" x="'+x+'" y="11">'+parseInt(d.slice(5,7),10)+'월</text>';
    g+=st.rate==null?'<rect class="fut" x="'+x+'" y="'+yy+'" width="'+sz+'" height="'+sz+'" rx="'+(sz*.22)+'"/>'
      :'<rect class="sq l'+lvl(st.rate)+'" x="'+x+'" y="'+yy+'" width="'+sz+'" height="'+sz+'" rx="'+(sz*.22)+'"><title>'+d+' · '+st.done+'/'+st.total+' ('+pct(st.rate)+')</title></rect>';
  });
  return g+'</svg>';
}
function donut(r,size,sw){
  var R=(size-sw)/2,C=2*Math.PI*R,v=r==null?0:r,c=size/2;
  return '<svg class="donut" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" role="img" aria-label="달성률 '+pct(r)+'">'
   +'<circle class="d-bg" cx="'+c+'" cy="'+c+'" r="'+R+'" fill="none" stroke-width="'+sw+'"/>'
   +'<circle class="d-fg" cx="'+c+'" cy="'+c+'" r="'+R+'" fill="none" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+(C*v)+' '+C+'" transform="rotate(-90 '+c+' '+c+')"/>'
   +'<text class="d-t" x="'+c+'" y="'+c+'" text-anchor="middle" dominant-baseline="central" style="font-size:'+Math.round(size*.22)+'px">'+pct(r)+'</text></svg>';
}
function barsSvg(items,W,H,aria){
  var pl=32,pr=6,pt=16,pb=22,cw=W-pl-pr,ch=H-pt-pb,n=items.length,bw=Math.min(64,cw/n*.62);
  var s='<svg class="chart" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(aria)+'">';
  [0,.5,1].forEach(function(v){var y=pt+ch*(1-v);s+='<line class="gl" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'"/><text class="ax" x="'+(pl-6)+'" y="'+y+'" text-anchor="end" dominant-baseline="central">'+(v*100)+'</text>';});
  items.forEach(function(it,i){
    var cx=pl+(i+.5)*cw/n;
    if(it.rate!=null){var hh=Math.max(1,ch*it.rate);
      s+='<rect class="bar" x="'+(cx-bw/2)+'" y="'+(pt+ch-hh)+'" width="'+bw+'" height="'+hh+'" rx="3" fill="currentColor"/>';
      if(bw>=24)s+='<text class="vl" x="'+cx+'" y="'+(pt+ch-hh-4)+'" text-anchor="middle">'+Math.round(it.rate*100)+'</text>';}
    s+='<text class="ax" x="'+cx+'" y="'+(H-6)+'" text-anchor="middle">'+it.label+'</text>';
  });
  return s+'</svg>';
}
function areaSvg(first,ds,W,H){
  var pl=32,pr=8,pt=12,pb=22,cw=W-pl-pr,ch=H-pt-pb,n=ds.length,sx=cw/n;
  var X=function(i){return pl+(i+.5)*sx;},Y=function(v){return pt+ch*(1-v);};
  var s='<svg class="chart" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="일별 달성률 추이">';
  var i0=0;
  while(i0<n){var k=wkIdx(ds[i0],first),i1=i0;while(i1+1<n&&wkIdx(ds[i1+1],first)===k)i1++;
    s+='<rect class="wb'+k+'" x="'+(pl+i0*sx)+'" y="'+pt+'" width="'+((i1-i0+1)*sx)+'" height="'+ch+'" opacity=".55"/>';i0=i1+1;}
  [0,.5,1].forEach(function(v){s+='<line class="gl" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text class="ax" x="'+(pl-6)+'" y="'+Y(v)+'" text-anchor="end" dominant-baseline="central">'+(v*100)+'</text>';});
  var seg=[],cur=[];
  ds.forEach(function(d,i){var r=d<=TODAY?dayStat(d).rate:null;if(r==null){if(cur.length)seg.push(cur);cur=[];}else cur.push([X(i),Y(r)]);});
  if(cur.length)seg.push(cur);
  seg.forEach(function(p){
    var line=p.map(function(a,i){return (i?'L':'M')+a[0].toFixed(1)+' '+a[1].toFixed(1);}).join(' ');
    s+='<path class="ar" d="'+line+' L'+p[p.length-1][0].toFixed(1)+' '+Y(0)+' L'+p[0][0].toFixed(1)+' '+Y(0)+' Z" fill="currentColor"/>';
    s+='<path class="ln" d="'+line+'"/>';
  });
  var lp=seg.length?seg[seg.length-1]:null;
  if(lp)s+='<circle class="dot" cx="'+lp[lp.length-1][0]+'" cy="'+lp[lp.length-1][1]+'" r="4.5"/>';
  ds.forEach(function(d,i){var dd=i+1;if(dd===1||dd%5===0)s+='<text class="ax" x="'+X(i)+'" y="'+(H-6)+'" text-anchor="middle">'+dd+'</text>';});
  return s+'</svg>';
}

/* ───────── 화면 ───────── */
var ui={tab:'day',date:TODAY,month:TODAY.slice(0,7),year:+TODAY.slice(0,4),armed:null,icon:'✨',color:1,showExport:false,modal:null,pop:null,focusModal:false};
var TABS=[['day','하루'],['diary','일기'],['week','주간'],['month','월간'],['year','년간'],['manage','관리']];
var FACES=['😣','😕','😐','🙂','😆'];
var FACE_L=['최악','별로','보통','좋음','최상'];

var QUICK=[
  {name:'물 마시기',icon:'💧',type:'daily',n:1,perDay:8,unit:'잔'},
  {name:'비타민·약 챙기기',icon:'💊',type:'daily',n:1,perDay:3,unit:'회',at:'08:00',every:6},
  {name:'아침 스트레칭',icon:'🧘',type:'daily',n:1,perDay:1,at:'07:30'},
  {name:'책 20분 읽기',icon:'📖',type:'daily',n:1,perDay:1},
  {name:'운동하기',icon:'💪',type:'week',n:3,perDay:1},
  {name:'가계부 정리',icon:'🧾',type:'month',n:1,perDay:1}
];
function emptyHtml(){
  return '<div class="card empty"><p>아직 습관이 없어요. 하나 골라서 바로 시작해 보세요.</p><div class="chips" style="justify-content:center;margin:10px 0">'
    +QUICK.map(function(q,i){return '<button type="button" data-act="quick" data-v="'+i+'">'+esc(q.icon+' '+q.name)+'</button>';}).join('')
    +'</div><button class="btn pri" data-act="tab" data-v="manage">직접 추가하기</button></div>';
}
function navHtml(label,sub,extra){
  return '<div class="card nav"><button class="nb" data-act="nav" data-v="-1" aria-label="이전">‹</button><div class="nl">'+label+(sub?'<small>'+sub+'</small>':'')+'</div><button class="nb" data-act="nav" data-v="1" aria-label="다음">›</button>'+(extra||'')+'<button class="btn" data-act="today">오늘</button></div>';
}

/* 습관 카드 */
function stampsHtml(x,d,future){
  var n=getN(x,d),pd=perDay(x),pl=planned(x),ts=getT(x,d),total=Math.max(pd,n),out='';
  var nowM=hm2min(nowHM());
  for(var i=0;i<total;i++){
    var done=i<n,t=done?(ts[i]||''):((pl&&pl[i])||'');
    var late=!done&&d===TODAY&&pl&&pl[i]&&hm2min(pl[i])<nowM;
    var lab=done?(t||'시간 –'):(t?t+' 예정':'');
    var nm=x.name+' '+(i+1)+'번째 '+(done?'기록함 '+(t||''):'기록하기');
    out+='<button type="button" class="stamp'+(done?' done':'')+(late?' late':'')+(ui.pop===x.id+'|'+d+'|'+i?' pop':'')+'" data-act="'+(done?'detail':'stamp')+'" data-id="'+x.id+'" data-date="'+d+'" aria-label="'+esc(nm)+'"'+(future&&!done?' disabled':'')+'><i>'+(done?'✓':'＋')+'</i><small>'+esc(lab)+'</small></button>';
  }
  return '<div class="stamps'+(total>4?' sm':'')+'">'+out+'</div>';
}
function dots7(x,d){
  var s='';
  for(var i=6;i>=0;i--){
    var dd=addDays(d,-i);
    if(!isAct(x,dd)||dd>TODAY){s+='<b class="na" title="'+dd.slice(5).replace('-','/')+'"></b>';continue;}
    var f=frac(x,dd);
    s+='<b class="'+(f>=1?'on':f>0?'part':'')+'" title="'+dd.slice(5).replace('-','/')+(f>=1?' 완료':f>0?' 일부':' 못함')+'"></b>';
  }
  return '<span class="d7" role="img" aria-label="최근 7일 기록">'+s+'</span>';
}
function cardHtml(x,d,future){
  var sk=x.type==='month'?null:streak(x),mm=memoGet(d,x.id),has=!!(mm.r||mm.t);
  var sub=subText(x);
  if(x.type!=='daily')sub+=' · '+(x.type==='week'?'이 주 ':'이 달 ')+cnt(x,pStart(x,d),pEnd(x,d))+'/'+x.n;
  return '<article class="hcard c'+colOf(x)+'"><div class="hh"><span class="hico">'+esc(x.icon)+'</span><div class="hhw"><div class="hnm">'+esc(x.name)+'</div><div class="hsub">'+esc(sub)+'</div></div></div>'
    +stampsHtml(x,d,future)
    +'<div class="hft">'+dots7(x,d)+'<span class="stk">'+(sk&&sk.c>1?'🔥 '+sk.c+sk.u:'')+'</span>'
    +'<button class="mbtn'+(has?' has':'')+'" data-act="detail" data-id="'+x.id+'" data-date="'+d+'" title="'+esc(has?memoText(mm):'시간 수정 · 메모')+'" aria-label="'+esc(x.name)+' 시간 수정·메모">💬</button></div></article>';
}

/* 상세 메모지 */
function modalHtml(){
  if(!ui.modal)return '';
  var x=habitById(ui.modal.id);if(!x){ui.modal=null;return '';}
  var d=ui.modal.date,n=getN(x,d),ts=getT(x,d),mm=memoGet(d,x.id),on=n>=perDay(x);
  var h='<div class="mdl" id="mdl" data-act="mclose-bg"><div class="msheet c'+colOf(x)+'" role="dialog" aria-modal="true" aria-label="'+esc(x.name)+' 상세"><div class="tape"></div>'
    +'<div class="mh"><span class="hico">'+esc(x.icon)+'</span><div class="hhw"><div class="hnm">'+esc(x.name)+'</div><div class="hsub">'+fmtDay(d)+'</div></div><button class="btn sm mclose" data-act="mclose">닫기</button></div>';
  h+='<h3>기록한 시간</h3>';
  if(!n)h+='<p class="note" style="margin:0">아직 기록이 없어요. 카드의 스탬프를 누르면 지금 시각이 기록돼요.</p>';
  for(var i=0;i<n;i++)h+='<div class="drow"><span>'+(i+1)+'번째</span><input type="text" class="tin" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="예: 0820" value="'+esc(ts[i]||'')+'" data-f="doseT" data-id="'+x.id+'" data-date="'+d+'" data-i="'+i+'" aria-label="'+(i+1)+'번째 시각"><button class="btn sm warn" data-act="dose-del" data-id="'+x.id+'" data-date="'+d+'" data-i="'+i+'">취소</button></div>';
  h+='<h3>'+(on?'메모':'못한 이유')+'</h3>';
  if(!on)h+='<div class="chips" role="group" aria-label="못한 이유">'+REASONS.map(function(rn){return '<button type="button" data-act="reason" data-id="'+x.id+'" data-date="'+d+'" data-v="'+rn+'" aria-pressed="'+(mm.r===rn)+'">'+rn+'</button>';}).join('')+'</div>';
  h+='<input type="text" id="mdlText" data-f="memoT" data-id="'+x.id+'" data-date="'+d+'" maxlength="120" value="'+esc(tx(mm.t))+'" placeholder="'+(on?'한 줄 메모':'무엇 때문에 못 했나요? 한 줄 메모')+'">';
  return h+'</div></div>';
}

/* 하루 흐름: 기록한 시각은 채운 원, 아직 안 한 예정 시각은 점선 원 */
function timelineHtml(d,hs){
  var ev=[];
  hs.forEach(function(x){
    var n=getN(x,d),ts=getT(x,d),pl=planned(x),pd=perDay(x),i;
    for(i=0;i<n;i++)if(/^\d\d:\d\d$/.test(ts[i]||''))ev.push({m:hm2min(ts[i]),x:x,done:true,t:ts[i]});
    if(pl)for(i=n;i<pd;i++)if(pl[i])ev.push({m:hm2min(pl[i]),x:x,done:false,t:pl[i]});
  });
  var s='<div class="tlw"><p class="lab">하루 흐름</p>';
  if(!ev.length)return s+'<p class="note tl-empty">스탬프를 찍으면 시각이 이 줄에 그려져요.</p></div>';
  ev.sort(function(a,b){return a.m-b.m;});
  var lastP=-99,lane=0,out='',TOPS=[66,36,6],STEMS=[6,36,66];
  ev.forEach(function(e){
    var p=e.m/14.4;
    lane=(p-lastP<3)?(lane+1)%3:0;lastP=p;
    var top=TOPS[lane],stem=STEMS[lane];
    out+='<span class="tm c'+colOf(e.x)+(e.done?'':' plan')+'" style="left:'+p.toFixed(2)+'%;top:'+top+'px;--stem:'+stem+'px" title="'+esc(e.x.name+' '+e.t+(e.done?' 기록':' 예정'))+'">'+esc(e.x.icon)+'</span>';
  });
  var ticks='';
  [0,3,6,9,12,15,18,21,24].forEach(function(hh){ticks+='<span class="tk" style="left:'+(hh/24*100)+'%">'+pad(hh%24)+':00</span>';});
  var now=d===TODAY?'<span class="now" style="left:'+(hm2min(nowHM())/14.4).toFixed(2)+'%"><span>지금</span></span>':'';
  return s+'<div class="tl" role="img" aria-label="하루 흐름">'+now+'<span class="axis"></span>'+ticks+out+'</div></div>';
}
function vDay(){
  var d=ui.date,hs=S.habits.filter(function(h){return isAct(h,d);}),st=dayStat(d),future=d>TODAY;
  var ws=weekStart(d),a=d.split('-').map(Number),remain=st.total-st.done;
  var msg=!st.total?'오늘 할 습관이 없어요':remain===0?'모두 마쳤어요':'남은 습관 '+remain+'개';
  var sub2=!st.total?'':remain===0?'오늘도 해냈어요':(d<TODAY?'못한 습관엔 💬 로 이유를 남겨 보세요':future?'':'하나만 먼저 찍어 볼까요?');
  var nt=S.note[d]||{},mood=S.mood[d];
  var L='<section class="page left"><div class="tape"></div>'
    +'<div class="dnav"><button class="nb" data-act="nav" data-v="-1" aria-label="전날">‹</button><div class="dt"><div class="bigd">'+a[1]+'월 '+a[2]+'일</div><div class="dsub">'+DOWN[dow(d)]+'요일 · '+weekLabel(ws)+(d===TODAY?' · 오늘':future?' · 아직 오지 않은 날':'')+'</div></div><button class="nb" data-act="nav" data-v="1" aria-label="다음 날">›</button></div>'
    +(d!==TODAY?'<button class="btn sm back" data-act="today">오늘로 돌아가기</button>':'')
    +'<div class="ringrow">'+donut(st.rate,84,10)+'<div class="rt"><b>'+msg+'</b><span class="note">'+st.done+'/'+st.total+' 완료'+(sub2?' · '+sub2:'')+'</span></div></div>'
    +'<div><p class="lab">오늘 기분</p><div class="faces">'+FACES.map(function(f,i){return '<button data-act="mood" data-v="'+(i+1)+'" aria-pressed="'+(mood===i+1)+'" aria-label="'+(i+1)+'점 '+FACE_L[i]+'" title="'+FACE_L[i]+'">'+f+'</button>';}).join('')+'</div></div>'
    +'<div class="grow"><p class="lab">한 줄 일기 <button type="button" class="btn sm" data-act="tab" data-v="diary" style="float:right">일기장 ›</button></p><textarea class="lined" id="noteH" data-f="note:h" rows="2" placeholder="오늘 만족스러웠던 일"'+(isEnc(nt.h)?' readonly':'')+'>'+esc(tx(nt.h))+'</textarea></div>'
    +'<div class="grow"><p class="lab">내일의 나에게</p><textarea class="lined" id="noteR" data-f="note:r" rows="2" placeholder="아쉬운 점, 내일 바꿀 것"'+(isEnc(nt.r)?' readonly':'')+'>'+esc(tx(nt.r))+'</textarea></div>'
    +'<div style="margin-top:auto"><p class="lab">이번 주</p><div class="wk7">'+days(ws,addDays(ws,6)).map(function(dd){
        var r=dd<=TODAY?dayStat(dd).rate:null;
        return '<button class="wd'+(dd===d?' sel':'')+(dd===TODAY?' today':'')+'" data-act="goto" data-date="'+dd+'" aria-label="'+fmtDay(dd)+' '+pct(r)+'">'+DOWN[dow(dd)]+'<span class="mr'+(r==null?' na':'')+'" style="--p:'+Math.round((r||0)*100)+'"></span><b>'+parseInt(dd.slice(8),10)+'</b></button>';
      }).join('')+'</div></div></section>';
  var R='<section class="page right">';
  if(!S.habits.length)R+=emptyHtml();
  else{
    R+='<div class="cards">'+(hs.length?hs.map(function(x){return cardHtml(x,d,future);}).join('')+'<button type="button" class="ghostcard" data-act="tab" data-v="manage">＋<span>습관 추가</span></button>':'<p class="note">이 날 진행 중인 습관이 없어요.</p>')+'</div>';
    R+=timelineHtml(d,hs);
    R+='<p class="hint">스탬프를 누르면 지금 시각이 기록돼요 · 찍은 스탬프를 누르면 시간 수정·취소 · 💬 로 못한 이유 메모'+(future?' · 지나지 않은 날은 기록할 수 없어요':'')+'</p>';
  }
  return '<div class="book">'+L+R+'</section></div>';
}

function cellHtml(x,d,cls){
  var n=getN(x,d),pd=perDay(x),on=n>=pd,part=n>0&&!on,mm=memoGet(d,x.id),has=!!(mm.r||mm.t);
  var tip=esc(x.name+' '+d+(pd>1?' '+n+'/'+pd:'')+(has?' · '+memoText(mm):''));
  return '<button class="cell '+cls+(on?' on':'')+(part?' part':'')+(has&&!on?' hasm':'')+'" data-act="toggle" data-id="'+x.id+'" data-date="'+d+'" aria-pressed="'+on+'" title="'+tip+'" aria-label="'+tip+'"'+(d>TODAY?' disabled':'')+'>'+(part?n:'✓')+'</button>';
}
function reasonCard(first,last){
  var by={},recent=[],end=last<TODAY?last:TODAY,s='<div class="card rsn"><h2>못한 이유 모아보기</h2>';
  days(first,end).forEach(function(d){
    var m=S.memo[d];if(!m)return;
    Object.keys(m).forEach(function(id){
      var hh=habitById(id);if(!hh||chk(hh,d))return;
      var o=m[id];if(o.r){by[id]=by[id]||{};by[id][o.r]=(by[id][o.r]||0)+1;}
      recent.push({d:d,h:hh,o:o});
    });
  });
  if(!recent.length)return s+'<p class="note">하루 화면에서 못 한 습관의 💬 에 적으면 이유가 여기에 모여요.</p></div>';
  s+='<div class="rgrid">'+Object.keys(by).slice(0,6).map(function(id){
    var hh=habitById(id),ks=Object.keys(by[id]).sort(function(a,b){return by[id][b]-by[id][a];});
    return '<div class="rline"><b>'+esc(hh.icon+' '+hh.name)+'</b><span class="chips">'+ks.map(function(k){return '<span class="tag" style="color:var(--accent-ink);border-color:var(--accent)">'+esc(k)+' '+by[id][k]+'회</span>';}).join('')+'</span></div>';
  }).join('')+'</div>';
  recent.sort(function(a,b){return a.d<b.d?1:-1;});
  return s+'<div class="note" style="margin:8px 0 4px">최근 코멘트</div><div class="rgrid">'+recent.slice(0,6).map(function(q){return '<div class="rcm">'+q.d.slice(5).replace('-','/')+' '+esc(q.h.icon+' '+q.h.name)+(q.o.r?' · '+esc(q.o.r):'')+(q.o.t?' — '+esc(tx(q.o.t)):'')+'</div>';}).join('')+'</div></div>';
}

/* ───────── 일기장: 하루 정리 + 글쓰기 ───────── */
function noteSet(d,f,v){var n=S.note[d]=S.note[d]||{};if(v)n[f]=v;else delete n[f];if(!Object.keys(n).length)delete S.note[d];}
var TEXTF=['d','h','k','w','g','r'];
function autoSummary(d){
  var a=d.split('-').map(Number),hs=S.habits.filter(function(h){return isAct(h,d);}),st=dayStat(d),lines=[],ok=[],miss=[];
  lines.push(a[1]+'/'+a[2]+' ('+DOWN[dow(d)]+') 하루 정리');
  lines.push('· 습관 '+st.done+'/'+st.total+' 완료 ('+pct(st.rate)+')'+(S.mood[d]?' · 기분 '+S.mood[d]+'/5':''));
  hs.forEach(function(h){
    var n=getN(h,d),pd=perDay(h),ts=getT(h,d).filter(Boolean),mm=memoGet(d,h.id);
    if(n>=pd)ok.push(h.name+(pd>1?' '+n+'/'+pd+(h.unit||'회'):'')+(ts.length?' ('+ts.join(', ')+')':''));
    else if(openOn(h,d))miss.push(h.name+(pd>1&&n?' '+n+'/'+pd:'')+((mm.r||mm.t)?' ('+[mm.r,tx(mm.t)].filter(Boolean).join(' — ')+')':''));
  });
  if(ok.length)lines.push('· 한 것: '+ok.join(', '));
  if(miss.length)lines.push('· 못한 것: '+miss.join(', '));
  return lines.join('\n');
}
function diaryListHtml(){
  var q=(ui.dq||'').trim().toLowerCase();
  var ds=Object.keys(S.note).filter(function(d){var n=S.note[d];return TEXTF.some(function(f){return n[f];});}).sort().reverse();
  if(q)ds=ds.filter(function(d){var n=S.note[d];return TEXTF.some(function(f){return tx(n[f]).toLowerCase().indexOf(q)>=0;});});
  if(!ds.length)return '<p class="note">'+(q?'찾는 일기가 없어요.':'아직 쓴 일기가 없어요.')+'</p>';
  var lim=ui.dlimit||60;
  return ds.slice(0,lim).map(function(d){
    var n=S.note[d],t=tx(n.d||n.h||n.k||n.w||n.g||n.r||''),m=S.mood[d];
    return '<button type="button" class="drow2'+(d===ui.date?' on':'')+'" data-act="dgoto" data-date="'+d+'"><b>'+d.slice(5).replace('-','/')+' ('+DOWN[dow(d)]+')</b><span>'+(m?FACES[m-1]:'')+'</span><em>'+esc(String(t).replace(/\s+/g,' ').slice(0,70))+'</em></button>';
  }).join('')+(ds.length>lim?'<button type="button" class="btn sm" data-act="dmore">더 보기</button>':'');
}
function sf(label,f,d,ph,cls,ro){
  var v=(S.note[d]||{})[f],enc=isEnc(v);
  return '<label class="sf'+(cls?' '+cls:'')+'"><span>'+label+'</span><textarea class="lined" data-f="note:'+f+'" placeholder="'+(enc?'🔒 읽을 수 없어요':ph)+'"'+(enc||ro?' readonly':'')+'>'+esc(tx(v))+'</textarea></label>';
}
function vDiary(){
  var d=ui.date,a=d.split('-').map(Number),st=dayStat(d),mood=S.mood[d],future=d>TODAY;
  var miss=S.habits.filter(function(h){return openOn(h,d)&&!chk(h,d);}).length;
  var c1='<div class="card nav"><button class="nb" data-act="nav" data-v="-1" aria-label="전날">‹</button><div class="nl"><span class="bigd2">'+a[1]+'월 '+a[2]+'일</span><small>'+DOWN[dow(d)]+'요일'+(d===TODAY?' · 오늘':future?' · 아직 오지 않은 날':'')+'</small></div><button class="nb" data-act="nav" data-v="1" aria-label="다음 날">›</button><button class="btn" data-act="today">오늘</button></div>'
    +'<div class="card sum sumcard">'+donut(st.rate,84,10)+'<div class="facts"><div>습관 <b>'+st.done+'/'+st.total+'</b> 완료</div><div>못한 것 <b>'+miss+'개</b></div></div></div>'
    +'<div class="card sumcard"><h2>이날 기분</h2><div class="faces">'+FACES.map(function(f,i){return '<button data-act="mood" data-v="'+(i+1)+'" aria-pressed="'+(mood===i+1)+'" aria-label="'+(i+1)+'점 '+FACE_L[i]+'" title="'+FACE_L[i]+'">'+f+'</button>';}).join('')+'</div></div>'
    +'<div class="card cfx"><h2>하루 정리</h2><div class="dauto">'+esc(autoSummary(d))+'</div>'+(future?'':'<button class="btn sm pri" type="button" data-act="dfill">일기에 넣기</button>')+'</div>';
  var c2='<div class="card sheet cfx"><div class="sg">'
    +sf('오늘의 하이라이트','h',d,'오늘 가장 좋았던 일','',future)+sf('잘한 점','k',d,'스스로 칭찬하고 싶은 것','',future)
    +sf('아쉬운 점','w',d,'다음에 바꾸고 싶은 것','',future)+sf('감사한 일','g',d,'고마웠던 사람·일','',future)+'</div>'
    +sf('자유 일기','d',d,'오늘 하루는 어땠나요? 편하게 적어 보세요.','grow',future)
    +sf('내일의 나에게','r',d,'내일 바꿀 것, 다짐','',future)+'</div>';
  var c3='<div class="card cfx"><h2>지난 일기</h2><input type="text" id="dq" data-f="dsearch" placeholder="🔍 일기 검색" value="'+esc(ui.dq||'')+'"><div class="dlist" id="dlist">'+diaryListHtml()+'</div></div>';
  return '<div class="dy"><div class="col1">'+c1+'</div><div class="col2">'+c2+'</div><div class="col3">'+c3+'</div></div>';
}

function vWeek(){
  var ws=weekStart(ui.date),we=addDays(ws,6),ds=days(ws,we);
  var hs=S.habits.filter(function(h){return h.start<=we&&(!h.end||h.end>=ws);});
  var h=navHtml(weekLabel(ws),ws.slice(5).replace('-','/')+' – '+we.slice(5).replace('-','/'));
  if(!hs.length)return h+emptyHtml();
  var t='<table class="tbl"><thead><tr><th class="hl"></th>';
  ds.forEach(function(d){t+='<th'+(d===TODAY?' class="today"':'')+'><button data-act="goto" data-date="'+d+'" title="이 날의 하루 화면으로">'+DOWN[dow(d)]+'<br>'+parseInt(d.slice(8),10)+'</button></th>';});
  t+='<th class="rt">주간 달성</th></tr></thead><tbody>';
  hs.forEach(function(x){
    t+='<tr><th class="hl">'+esc(x.icon)+' '+esc(x.name)+'<small>'+esc(freqText(x))+'</small></th>';
    ds.forEach(function(d){
      if(!isAct(x,d))t+='<td class="na">·</td>';
      else t+='<td>'+cellHtml(x,d,'lg')+'</td>';
    });
    var rs=x.type==='month'?hStat(x,firstOfMonth(ws),lastOfMonth(ws)):hStat(x,ws,we);
    var lab=x.type==='month'?'이 달 '+rs.done+'/'+rs.goal:Math.round(rs.done*10)/10+'/'+rs.goal;
    t+='<td class="rt"><b>'+lab+'</b><span class="bar-mini"><i style="width:'+Math.round((rs.rate||0)*100)+'%"></i></span></td></tr>';
  });
  t+='</tbody></table>';
  var items=ds.map(function(d){return {label:DOWN[dow(d)],rate:d<=TODAY?dayStat(d).rate:null};});
  var ov=overall(ws,we);
  var elapsed=ds.filter(function(d){return d<=TODAY;}).length;
  var rec=ds.filter(function(d){return d<=TODAY&&S.habits.some(function(x){return getN(x,d)>0;});}).length;
  var mv=ds.map(function(d){return S.mood[d];}).filter(function(v){return v;});
  var avg=mv.length?(mv.reduce(function(a,b){return a+b;},0)/mv.length).toFixed(1):'–';
  return h+'<div class="lay w"><div class="card tc"><div class="scroll">'+t+'</div></div>'
    +'<div class="aside"><div class="card sum sumcard">'+donut(ov.rate,96,11)+'<div class="facts"><div>이 주 목표 달성 <b>'+pct(ov.rate)+'</b></div><div>체크한 날 <b>'+rec+'/'+elapsed+'일</b></div><div>평균 기분 <b>'+avg+'</b> / 5</div></div></div>'
    +'<div class="card cfx"><h2>요일별 완료율 <span class="note">(%)</span></h2>'+chartBox('wk',function(W,H){return barsSvg(items,W,H,'요일별 완료율');},150)+'</div></div></div>';
}

function vMonth(){
  var first=ui.month+'-01',last=lastOfMonth(first),ds=days(first,last),ym=ui.month.split('-').map(Number);
  var hs=S.habits.filter(function(h){return h.start<=last&&(!h.end||h.end>=first);});
  var y0=Math.min.apply(null,S.habits.map(function(h){return +h.start.slice(0,4);}).concat([+TODAY.slice(0,4)]));
  var ys='',ms='';
  for(var y=y0;y<=+TODAY.slice(0,4)+1;y++)ys+='<option value="'+y+'"'+(y===ym[0]?' selected':'')+'>'+y+'년</option>';
  for(var m=1;m<=12;m++)ms+='<option value="'+m+'"'+(m===ym[1]?' selected':'')+'>'+m+'월</option>';
  var h=navHtml(ym[0]+'년 '+ym[1]+'월','','<select id="selY" data-f="selY" aria-label="연도">'+ys+'</select><select id="selM" data-f="selM" aria-label="월">'+ms+'</select>');
  if(!hs.length)return h+emptyHtml();
  var ov=overall(first,last);
  var recDays=ds.filter(function(d){return d<=TODAY&&S.habits.some(function(x){return getN(x,d)>0;});}).length;
  var elapsed=ds.filter(function(d){return d<=TODAY;}).length;
  var mv=ds.map(function(d){return S.mood[d];}).filter(function(v){return v;});
  var avg=mv.length?(mv.reduce(function(a,b){return a+b;},0)/mv.length).toFixed(1):'–';
  var best=null;hs.forEach(function(x){var s=hStat(x,first,last);if(s.rate!=null&&(!best||s.rate>best.r))best={n:x.icon+' '+x.name,r:s.rate};});
  var sumc='<div class="card sum sumc">'+donut(ov.rate,104,12)+'<div class="facts"><div>체크한 날 <b>'+recDays+'/'+elapsed+'일</b></div><div>평균 기분 <b>'+avg+'</b> / 5</div>'+(best?'<div>가장 잘 지킨 습관 <b>'+esc(best.n)+'</b> '+pct(best.r)+'</div>':'')+'</div></div>';
  var chc='<div class="card cfx chc"><h2>일별 달성률 <span class="note">(%) · 배경 색은 주 구분</span></h2>'+chartBox('mo',function(W,H){return areaSvg(first,ds,W,H);},160)+'</div>';
  var t='<table class="tbl"><thead><tr><th class="hl"></th>';
  ds.forEach(function(d){var k=wkIdx(d,first);t+='<th class="wk'+k+(d===TODAY?' today':'')+'"><button data-act="goto" data-date="'+d+'" title="이 날의 하루 화면으로">'+parseInt(d.slice(8),10)+'</button></th>';});
  t+='<th class="rt">달성</th></tr><tr><th class="hl"></th>';
  ds.forEach(function(d){t+='<th class="wk'+wkIdx(d,first)+'" style="font-size:10.5px;font-weight:500">'+DOWN[dow(d)]+'</th>';});
  t+='<th></th></tr></thead><tbody>';
  hs.forEach(function(x){
    t+='<tr><th class="hl">'+esc(x.icon)+' '+esc(x.name)+'<small>'+esc(freqText(x))+'</small></th>';
    ds.forEach(function(d){
      if(!isAct(x,d))t+='<td class="na">·</td>';
      else t+='<td>'+cellHtml(x,d,'wk'+wkIdx(d,first))+'</td>';
    });
    var s=hStat(x,first,last);
    t+='<td class="rt"><b>'+pct(s.rate)+'</b><span class="bar-mini"><i style="width:'+Math.round((s.rate||0)*100)+'%"></i></span></td></tr>';
  });
  t+='<tr><th class="hl" style="font-size:11.5px;color:var(--muted)">하루 완료율</th>';
  ds.forEach(function(d){var r=d<=TODAY?dayStat(d).rate:null;t+='<td style="font-size:10px;color:var(--muted)">'+(r==null?'':Math.round(r*100))+'</td>';});
  t+='<td></td></tr></tbody></table>';
  return h+'<div class="lay m">'+sumc+reasonCard(first,last)+'<div class="card tc"><h2>체크 현황</h2><div class="scroll">'+t+'</div><p class="note" style="margin-top:8px">주 단위·월 단위 습관은 목표 횟수를 채우면 100%로 계산해요. 하루 여러 번 하는 습관은 횟수 비율만큼 부분 점수로 계산하고, 칸의 숫자는 그날 한 횟수입니다. 빨간 점은 메모가 있다는 표시예요. 아직 오지 않은 날은 계산에서 빠집니다.</p></div>'+chc+'</div>';
}

function vYear(){
  var y=ui.year,first=y+'-01-01',last=y+'-12-31';
  var hs=S.habits.filter(function(h){return h.start<=last&&(!h.end||h.end>=first);});
  var h=navHtml(y+'년','','').replace('<button class="btn" data-act="today">오늘</button>','<button class="btn" data-act="today">올해</button>');
  if(!hs.length)return h+emptyHtml();
  var ov=overall(first,last),mr=[];
  for(var m=1;m<=12;m++){var f=y+'-'+pad(m)+'-01',l=lastOfMonth(f);mr.push({m:m,from:f,to:l,ov:f>TODAY?{rate:null}:overall(f,l)});}
  var bestM=null;mr.forEach(function(x){if(x.ov.rate!=null&&(!bestM||x.ov.rate>bestM.ov.rate))bestM=x;});
  var sum='<div class="card sum sumcard">'+donut(ov.rate,104,12)+'<div class="facts"><div>올해 목표 달성 <b>'+pct(ov.rate)+'</b></div>'+(bestM?'<div>가장 꾸준했던 달 <b>'+bestM.m+'월</b> '+pct(bestM.ov.rate)+'</div>':'')+'<div>진행한 습관 <b>'+hs.length+'개</b></div></div></div>';
  var bars='<div class="card cfx"><h2>월별 달성률 <span class="note">(%)</span></h2>'+chartBox('yr',function(W,H){return barsSvg(mr.map(function(x){return {label:x.m+'월',rate:x.ov.rate};}),W,H,'월별 달성률');},160)+'</div>';
  var g='<div class="hgrid"><span></span>';
  for(var k=1;k<=12;k++)g+='<span class="hh2">'+k+'월</span>';
  g+='<span class="hh2">연간</span>';
  hs.forEach(function(x){
    g+='<span class="hl2">'+esc(x.icon)+' '+esc(x.name)+'</span>';
    mr.forEach(function(q){var st=hStat(x,q.from,q.to);
      g+=st.rate==null?'<span class="hcell empty"></span>':'<span class="hcell l'+lvl(st.rate)+'" title="'+esc(x.name)+' '+q.m+'월 '+(Math.round(st.done*10)/10)+'/'+st.goal+'">'+Math.round(st.rate*100)+'</span>';});
    var ys=hStat(x,first,last);
    g+='<span class="hcell yr l'+lvl(ys.rate)+'">'+pct(ys.rate)+'</span>';
  });
  g+='</div>';
  var heat='<div class="card cfx a"><h2>습관별 월 달성률</h2><div class="hwrap">'+g+'</div><div class="legend">낮음 <i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> 높음</div></div>';
  var cal='<div class="card cfx b"><h2>하루 완료율 달력</h2>'+chartBox('cal',function(W,H){return calSvg(y,W,H);},110)+'<div class="legend">낮음 <i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> 높음 · 칸에 마우스를 올리면 날짜별 수치가 보여요</div></div>';
  return h+'<div class="lay y"><div class="aside">'+sum+bars+'</div><div class="col">'+heat+cal+'</div></div>';
}

var ICONS=['💧','🧘','📖','🛏','💪','🚶','🧾','🦷','🥗','💊','😴','🏃','✍️','🧹','☀️','🧴','🎧','📵','🍎','🪥'];
function cdotsHtml(cur,act,id){
  var s='';
  for(var i=1;i<=8;i++)s+='<button type="button" class="cdot c'+i+'" data-act="'+act+'" data-v="'+i+'"'+(id?' data-id="'+id+'"':'')+' aria-pressed="'+(i===cur)+'" aria-label="색 '+i+'"></button>';
  return '<div class="cdots">'+s+'</div>';
}
function vManage(){
  var act=S.habits.filter(function(h){return !h.end;}),arch=S.habits.filter(function(h){return h.end;});
  var h='<div class="card fgrid"><h2 style="margin:0">습관 추가</h2><div><div class="note" style="margin-bottom:6px">아이콘</div><div class="icons" id="iconPick">'
    +ICONS.map(function(i){return '<button type="button" data-act="pick-icon" data-v="'+i+'" aria-pressed="'+(i===ui.icon)+'">'+i+'</button>';}).join('')+'</div></div>'
    +'<div><div class="note" style="margin-bottom:6px">카드 색</div><div id="colorPick">'+cdotsHtml(ui.color,'pick-color')+'</div></div>'
    +'<label class="fl">이름<input type="text" id="newName" placeholder="예: 비타민 먹기" maxlength="30"></label>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap"><label class="fl" style="flex:1 1 140px">주기<select class="f" id="newType" data-f="newType"><option value="daily">매일</option><option value="week">주 N회</option><option value="month">월 N회</option></select></label>'
    +'<label class="fl" id="newNWrap" style="flex:1 1 100px" hidden>횟수<input type="number" id="newN" min="1" max="31" value="2"></label>'
    +'<label class="fl" style="flex:1 1 100px">하루에 몇 번<input type="number" id="newPer" min="1" max="30" value="1"></label>'
    +'<label class="fl" style="flex:1 1 100px">단위<input type="text" id="newUnit" placeholder="잔, 회, 분" maxlength="6"></label></div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap"><label class="fl" style="flex:1 1 140px">첫 시각(선택, 숫자로)<input type="text" class="tin" id="newAt" data-f="newAt" inputmode="numeric" autocomplete="off" placeholder="예: 0800" maxlength="5"></label>'
    +'<label class="fl" style="flex:1 1 140px">몇 시간마다(선택)<input type="number" id="newEvery" min="1" max="12" placeholder="예: 6"></label></div>'
    +'<p class="note" style="margin:0">하루에 여러 번 하는 습관은 「하루에 몇 번」을 2 이상으로 정하세요. 비타민을 8시부터 6시간마다 3번 먹는다면 3번, 첫 시각 0800, 6시간마다로 두면 08:00·14:00·20:00 예정 시각이 카드에 표시되고, 스탬프를 찍을 때 실제 시각이 기록돼요. 시각은 숫자만 치면 됩니다(800, 0800, 830 모두 가능).</p>'
    +'<div><button class="btn pri" data-act="add">추가</button> <span class="note">추가한 날부터 달성률에 반영돼요. 지난 기록은 바뀌지 않습니다.</span></div></div>';
  h+='<div class="card"><h2>내 습관 ('+act.length+')</h2>';
  if(!act.length)h+='<p class="note">진행 중인 습관이 없어요.</p>';
  act.forEach(function(x,i){
    h+='<div class="mrow"><div class="big">'+esc(x.icon)+'</div><div><div class="ctl"><input type="text" value="'+esc(x.name)+'" data-f="hname" data-id="'+x.id+'" maxlength="30" aria-label="이름">'
      +'<select data-f="htype" data-id="'+x.id+'" aria-label="주기"><option value="daily"'+(x.type==='daily'?' selected':'')+'>매일</option><option value="week"'+(x.type==='week'?' selected':'')+'>주 N회</option><option value="month"'+(x.type==='month'?' selected':'')+'>월 N회</option></select>'
      +(x.type!=='daily'?'<input type="number" min="1" max="31" value="'+x.n+'" data-f="hn" data-id="'+x.id+'" aria-label="횟수">':'')+'</div>'
      +'<div class="ctl" style="margin-top:6px"><span class="note">하루</span><input type="number" min="1" max="30" value="'+perDay(x)+'" data-f="hper" data-id="'+x.id+'" aria-label="하루 횟수"><input type="text" class="u" value="'+esc(x.unit||'')+'" data-f="hunit" data-id="'+x.id+'" placeholder="단위(잔·회)" maxlength="6" aria-label="단위">'
      +'<span class="note">첫 시각</span><input type="text" class="tin" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="0800" value="'+esc(x.at||'')+'" data-f="hat" data-id="'+x.id+'" aria-label="첫 시각(숫자로)"><input type="number" min="1" max="12" value="'+(x.every||'')+'" data-f="hevery" data-id="'+x.id+'" placeholder="간격" aria-label="몇 시간마다"><span class="note">시간마다</span></div>'
      +'<div style="margin-top:8px">'+cdotsHtml(colOf(x),'hcolor',x.id)+'</div>'
      +'<div class="note" style="margin:6px 0">시작일 '+x.start+' · 주기를 바꾸면 지난 달성률도 새 기준으로 다시 계산돼요</div>'
      +'<div class="acts"><button class="btn sm" data-act="up" data-id="'+x.id+'"'+(i===0?' disabled':'')+'>▲ 위로</button><button class="btn sm" data-act="down" data-id="'+x.id+'"'+(i===act.length-1?' disabled':'')+'>▼ 아래로</button>'
      +'<button class="btn sm warn" data-act="archive" data-id="'+x.id+'">'+(ui.armed==='a:'+x.id?'정말 보관할까요?':'보관')+'</button></div></div></div>';
  });
  h+='<p class="note" style="margin-top:8px">보관하면 목록에서 빠지지만 지금까지의 기록과 달성률은 그대로 남아요.</p></div>';
  if(arch.length){
    h+='<div class="card"><h2>보관한 습관 ('+arch.length+')</h2>';
    arch.forEach(function(x){
      h+='<div class="mrow"><div class="big">'+esc(x.icon)+'</div><div><b>'+esc(x.name)+'</b><div class="note">'+esc(freqText(x))+' · '+x.start+' ~ '+x.end+'</div><div class="acts" style="margin-top:6px"><button class="btn sm" data-act="restart" data-id="'+x.id+'">오늘부터 다시 시작</button><button class="btn sm warn" data-act="del" data-id="'+x.id+'">'+(ui.armed==='d:'+x.id?'기록까지 영구 삭제?':'영구 삭제')+'</button></div></div></div>';
    });
    h+='</div>';
  }
  h+=lockCardHtml();
  h+='<div class="card"><h2>데이터</h2><p class="note" style="margin:0 0 8px">기록은 Firebase(클라우드)에 저장돼서 휴대폰과 PC가 같은 기록을 씁니다. 이 기기에는 임시로만 보관돼요.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="export">'+(ui.showExport?'내보내기 닫기':'JSON 내보내기')+'</button></div>';
  if(ui.showExport)h+='<div style="margin-top:10px"><pre class="json" id="exportBox">'+esc(JSON.stringify({habits:S.habits,logs:S.logs,times:S.times,mood:S.mood,note:S.note,memo:S.memo}))+'</pre><div style="margin-top:6px"><button class="btn sm" data-act="copy">복사</button> <span class="note" id="copyMsg"></span></div></div>';
  h+='</div>';
  return h;
}

/* 창 크기에 맞추기: 넘치면 전체를 조금씩 줄이고(가로는 그만큼 더 넓게 써서 열이 늘어난다), 여유가 있으면 최대 1.5배까지 키운다 */
var kmemo={};
var FIT_MQ=window.matchMedia?window.matchMedia('(min-width:900px) and (min-height:520px)'):null;
function overflows(fb){
  if(fb.scrollHeight>fb.clientHeight+1||fb.scrollWidth>fb.clientWidth+1)return true;
  var els=fb.querySelectorAll('.cards,.page,.scroll,.hcard,.card,.hwrap');
  for(var i=0;i<els.length;i++){var e=els[i],tol=e.classList.contains('hwrap')?24:1;if(e.scrollHeight>e.clientHeight+tol||e.scrollWidth>e.clientWidth+1)return true;}
  return false;
}
/* 하루 카드: 칸 크기를 재서 열×행을 정한다. 줄마다 개수가 같고 칸이 빈틈없이 채워지도록(8개면 4열×2행), 개수가 많으면 칸이 작아진다 */
function layoutCards(){
  var c=$('.cards');if(!c)return;
  var ar=c.querySelectorAll('article'),n=ar.length,gh=c.querySelector('.ghostcard');
  var fit=FIT_MQ&&FIT_MQ.matches&&ROOT().classList.contains('fit');
  if(!fit||!n){c.style.gridTemplateColumns='';c.style.gridTemplateRows='';if(gh)gh.style.display='';return;}
  /* 기본은 4열 × 2행 칸. 습관이 늘면 열이 5,6열로 늘고(2행 유지), 그 이상이면 행이 늘어난다 */
  var rows=2;while(Math.ceil(n/rows)>6)rows++;
  var cols=Math.max(4,Math.ceil(n/rows));
  c.style.gridTemplateColumns='repeat('+cols+',minmax(0,1fr))';
  c.style.gridTemplateRows='repeat('+rows+',minmax(0,1fr))';
  if(gh)gh.style.display=(n>=cols*rows)?'none':'';
}
function searchK(fb,start){
  var k=start;
  fb.style.setProperty('--k',k);layoutCards();
  while(overflows(fb)&&k>0.5){k=Math.round((k-0.03)*100)/100;fb.style.setProperty('--k',k);layoutCards();}
  return k;
}
function autofit(){
  var fb=$('.fitbox');if(!fb)return;
  var fit=FIT_MQ&&FIT_MQ.matches&&ROOT().classList.contains('fit');
  if(!fit){fb.style.removeProperty('--k');fb.removeAttribute('data-dn');layoutCards();drawCharts();return;}
  var start=Math.min(1.5,(kmemo[ui.tab]||1.5)+0.09),k;
  if(ui.tab==='month'){
    /* 체크 표는 체크만 보면 되니, 전체를 줄이기 전에 표만 먼저 촘촘하게 줄인다 */
    for(var d=0;d<=2;d++){fb.setAttribute('data-dn',d);k=searchK(fb,d===0?start:1.5);if(k>=0.95||d===2)break;}
  }else k=searchK(fb,start);
  kmemo[ui.tab]=k;
  drawCharts();
}
function render(){
  if(!ROOT())return;
  ensureFrom(viewStart());
  ROOT().classList.toggle('fit',ui.tab!=='manage');
  updateSync();
  $('#hbTabs').innerHTML=isLocked()?'':TABS.map(function(t){return '<button role="tab" data-act="tab" data-v="'+t[0]+'" aria-selected="'+(ui.tab===t[0])+'">'+t[1]+'</button>';}).join('');
  CH={};
  var fn=isLocked()?lockHtml:(!ST.ready&&!S.habits.length&&ui.tab!=='manage')?function(){return '<div class="card empty"><p>클라우드에서 불러오는 중…</p></div>';}:{day:vDay,diary:vDiary,week:vWeek,month:vMonth,year:vYear,manage:vManage}[ui.tab];
  var v=$('#hbView');
  v.className=ui.tab==='manage'?'narrow':'';
  v.innerHTML='<div class="fitbox">'+fn()+(ui.tab==='manage'?'<p class="note">습관과 기록은 클라우드(Firebase)에 저장되고, 이 기기에는 임시로만 보관됩니다.</p>':'')+'</div>'+modalHtml();
  ui.pop=null;
  autofit();
  if(isLocked()){var ci=$('#hbCode');if(ci&&document.activeElement!==ci)ci.focus();}
  if(ui.focusModal){ui.focusModal=false;var c=$('#mdl .mclose');if(c)c.focus();}
}

/* ───────── 동작 ───────── */
function shiftMonth(ym,n){var a=ym.split('-').map(Number),d=new Date(a[0],a[1]-1+n,1);return d.getFullYear()+'-'+pad(d.getMonth()+1);}
function arm(key){ui.armed=key;render();setTimeout(function(){if(ui.armed===key){ui.armed=null;render();}},3500);}

var onClick=function(e){
  var b=e.target.closest&&e.target.closest('[data-act]');if(!b||b.disabled)return;
  var a=b.dataset.act,id=b.dataset.id,v=b.dataset.v,h=id?habitById(id):null;
  if(lockAct(a,b))return;
  if(a==='hbclose'){window.wlHabitsClose();return;}
  if(a==='hbsync'){if(ST.state==='error'||ST.state==='local'){startCloud();flush();}return;}
  if(a==='quick'){var q=QUICK[+v];if(q){S.habits.push({id:uid(),name:q.name,icon:q.icon,color:(S.habits.length%8)+1,type:q.type,n:q.n,perDay:q.perDay,unit:q.unit||'',at:q.at||'',every:q.every||0,start:TODAY,end:null});save();render();}return;}
  if(a==='mclose-bg'){if(e.target===b){ui.modal=null;render();}return;}
  if(a==='mclose'){ui.modal=null;render();return;}
  if(a==='tab'){ui.tab=v;ui.armed=null;ui.modal=null;render();return;}
  if(a==='stamp'){var d0=b.dataset.date;if(d0>TODAY||!h)return;addDose(h,d0);ui.pop=id+'|'+d0+'|'+(getN(h,d0)-1);save();render();return;}
  if(a==='detail'){ui.modal={id:id,date:b.dataset.date};ui.focusModal=true;render();return;}
  if(a==='dose-del'){removeDose(h,b.dataset.date,+b.dataset.i);save();render();return;}
  if(a==='toggle'){
    var d=b.dataset.date;if(d>TODAY||!h)return;
    var n0=getN(h,d),pd=perDay(h);
    if(pd===1){if(n0)clearDay(h,d);else addDose(h,d);}else{if(n0>=pd)clearDay(h,d);else addDose(h,d);}
    save();render();return;}
  if(a==='nav'){var n=+v;
    if(ui.tab==='day'||ui.tab==='diary')ui.date=addDays(ui.date,n);
    else if(ui.tab==='week')ui.date=addDays(ui.date,7*n);
    else if(ui.tab==='month')ui.month=shiftMonth(ui.month,n);
    else if(ui.tab==='year')ui.year+=n;
    render();return;}
  if(a==='dgoto'){ui.date=b.dataset.date;render();return;}
  if(a==='dmore'){ui.dlimit=(ui.dlimit||60)+60;render();return;}
  if(a==='dfill'){var cur0=(S.note[ui.date]||{}).d,sm=autoSummary(ui.date);if(isEnc(cur0))return;noteSet(ui.date,'d',cur0?cur0+'\n\n'+sm:sm);save();render();return;}
  if(a==='today'){ui.date=TODAY;ui.month=TODAY.slice(0,7);ui.year=+TODAY.slice(0,4);render();return;}
  if(a==='goto'){ui.date=b.dataset.date;ui.tab='day';render();return;}
  if(a==='mood'){var m=+v;if(S.mood[ui.date]===m)delete S.mood[ui.date];else S.mood[ui.date]=m;save();render();return;}
  if(a==='reason'){var cur=memoGet(b.dataset.date,id).r;memoSet(b.dataset.date,id,{r:cur===v?'':v});
    b.parentNode.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.v===v&&cur!==v));});return;}
  if(a==='pick-icon'){ui.icon=v;document.querySelectorAll('#iconPick button').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.v===v));});return;}
  if(a==='pick-color'){ui.color=+v;document.querySelectorAll('#colorPick .cdot').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.v===v));});return;}
  if(a==='hcolor'){if(h){h.color=+v;save();render();}return;}
  if(a==='add'){
    var name=($('#newName').value||'').trim();if(!name){$('#newName').focus();return;}
    var type=$('#newType').value,n2=Math.max(1,Math.min(type==='week'?7:31,parseInt($('#newN').value,10)||1));
    var per=Math.max(1,Math.min(30,parseInt($('#newPer').value,10)||1)),unit=($('#newUnit').value||'').trim().slice(0,6);
    var at=normTime($('#newAt').value);
    if(at===null){$('#newAt').setAttribute('aria-invalid','true');$('#newAt').focus();return;}
    var ev=Math.max(0,Math.min(12,parseInt($('#newEvery').value,10)||0));
    S.habits.push({id:uid(),name:name,icon:ui.icon,color:ui.color,type:type,n:type==='daily'?1:n2,perDay:per,unit:unit,at:at,every:per>1?ev:0,start:TODAY,end:null});
    ui.color=(ui.color%8)+1;save();render();return;}
  if(a==='up'||a==='down'){
    var i=S.habits.indexOf(h),j=i+(a==='up'?-1:1);
    while(j>=0&&j<S.habits.length&&S.habits[j].end)j+=(a==='up'?-1:1);
    if(j>=0&&j<S.habits.length){var t=S.habits[i];S.habits[i]=S.habits[j];S.habits[j]=t;save();render();}return;}
  if(a==='archive'){
    if(ui.armed!=='a:'+id){arm('a:'+id);return;}
    ui.armed=null;
    var hasLog=Object.keys(S.logs).some(function(dd){return S.logs[dd][id];});
    var lastDay=chk(h,TODAY)?TODAY:addDays(TODAY,-1);
    if(lastDay<h.start){if(hasLog)h.end=h.start;else S.habits.splice(S.habits.indexOf(h),1);}else h.end=lastDay;
    save();render();return;}
  if(a==='restart'){S.habits.push({id:uid(),name:h.name,icon:h.icon,color:colOf(h),type:h.type,n:h.n,perDay:h.perDay||1,unit:h.unit||'',at:h.at||'',every:h.every||0,start:TODAY,end:null});save();render();return;}
  if(a==='del'){
    if(ui.armed!=='d:'+id){arm('d:'+id);return;}
    ui.armed=null;S.habits.splice(S.habits.indexOf(h),1);
    Object.keys(S.logs).forEach(function(dd){delete S.logs[dd][id];if(!Object.keys(S.logs[dd]).length)delete S.logs[dd];});
    Object.keys(S.times).forEach(function(dd){delete S.times[dd][id];if(!Object.keys(S.times[dd]).length)delete S.times[dd];});
    Object.keys(S.memo).forEach(function(dd){delete S.memo[dd][id];if(!Object.keys(S.memo[dd]).length)delete S.memo[dd];});
    save();render();return;}
  if(a==='export'){ui.showExport=!ui.showExport;render();return;}
  if(a==='copy'){var box=$('#exportBox'),msg=$('#copyMsg'),txt=box.textContent;
    var sel=function(){var r=document.createRange();r.selectNodeContents(box);var s=window.getSelection();s.removeAllRanges();s.addRange(r);msg.textContent='선택했어요. 복사해 주세요.';};
    try{navigator.clipboard.writeText(txt).then(function(){msg.textContent='복사했어요.';},sel);}catch(err){sel();}return;}
};

function onField(e){
  var el=e.target,f=el.dataset&&el.dataset.f;if(!f)return;
  if(lockField(el,f,e))return;
  if(el.classList&&el.classList.contains('tin')){
    if(e.type==='input'){el.value=fmtDigits(el.value);el.removeAttribute('aria-invalid');return;}
    var nt=normTime(el.value);
    if(nt===null){el.setAttribute('aria-invalid','true');return;}
    el.value=nt;el.removeAttribute('aria-invalid');
    if(f==='newAt')return;
  }
  if(f.indexOf('note:')===0){
    noteSet(ui.date,f.slice(5),el.value);save();
    var dl=$('#dlist');if(dl&&ui.tab==='diary')dl.innerHTML=diaryListHtml();
    return;}
  if(f==='dsearch'){ui.dq=el.value;var dl2=$('#dlist');if(dl2)dl2.innerHTML=diaryListHtml();return;}
  if(f==='memoT'){memoSet(el.dataset.date,el.dataset.id,{t:el.value});return;}
  if(e.type!=='change')return;
  if(f==='selY'||f==='selM'){var y=+$('#selY').value,m=+$('#selM').value;ui.month=y+'-'+pad(m);render();return;}
  if(f==='newType'){$('#newNWrap').hidden=el.value==='daily';return;}
  var h=habitById(el.dataset.id);if(!h)return;
  if(f==='doseT'){
    var d=el.dataset.date,i=+el.dataset.i,t=getT(h,d).slice();
    while(t.length<getN(h,d))t.push('');
    t[i]=el.value;setT(h,d,t);save();render();return;}
  if(f==='hname'){var nm=el.value.trim();if(nm)h.name=nm;}
  else if(f==='htype'){h.type=el.value;if(h.type==='daily')h.n=1;else if(h.n<2&&h.type==='week')h.n=2;}
  else if(f==='hn'){h.n=Math.max(1,Math.min(h.type==='week'?7:31,parseInt(el.value,10)||1));}
  else if(f==='hper'){h.perDay=Math.max(1,Math.min(30,parseInt(el.value,10)||1));}
  else if(f==='hunit'){h.unit=el.value.trim().slice(0,6);}
  else if(f==='hat'){h.at=el.value||'';}
  else if(f==='hevery'){h.every=Math.max(0,Math.min(12,parseInt(el.value,10)||0));}
  save();render();
}
/* ───────── 화면 열기·닫기 ───────── */
function build(){
  if(ROOT())return;
  var root=document.createElement('div');
  root.id='hbRoot';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','습관 체크리스트');
  root.innerHTML='<div class="hbwrap"><div class="top"><h1>습관 체크리스트</h1><span class="chip">개인일지</span>'
    +'<button class="chip" id="hbSync" data-act="hbsync" type="button"></button>'
    +'<button class="chip" id="hbLockBtn" data-act="lknow" type="button" hidden>🔒 잠그기</button>'
    +'<div class="tabs" id="hbTabs" role="tablist"></div>'
    +'<button class="btn sm hbclose" data-act="hbclose" type="button">닫기 ✕</button></div>'
    +'<div class="hbbanner" id="hbBanner" hidden></div><div id="hbView"></div></div>';
  document.body.appendChild(root);
  root.addEventListener('click',onClick);
  root.addEventListener('input',onField);
  root.addEventListener('change',onField);
  root.addEventListener('focusout',function(){if(ST.pendingRender){ST.pendingRender=false;setTimeout(softRender,0);}});
  root.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target&&e.target.id==='hbCode')doUnlock(e.target.value);});
  ['pointerdown','keydown','input'].forEach(function(ev){root.addEventListener(ev,touchIdle,true);});
}
window.wlHabitsOpen=function(v){
  build();
  if(typeof v==='string'&&/^(day|diary|week|month|year|manage)$/.test(v))ui.tab=v;
  var r=ROOT();
  if(!r.classList.contains('open')){ST.prevOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
  r.classList.add('open');
  startCloud();
  render();
  touchIdle();
  try{if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if(isOpen())autofit();});}catch(e){}
  var c=r.querySelector(isLocked()?'#hbCode':'.hbclose');if(c)c.focus();
};
window.wlHabitsClose=function(){
  var r=ROOT();if(!r)return;
  r.classList.remove('open');
  document.body.style.overflow=ST.prevOverflow||'';
  ui.modal=null;
  if(LK.enabled&&LK.lockOnClose)lockNow();
};
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape'||!isOpen())return;
  if(ui.modal){ui.modal=null;render();}else window.wlHabitsClose();
});
var rz=null;
window.addEventListener('resize',function(){if(!isOpen())return;clearTimeout(rz);rz=setTimeout(function(){kmemo={};autofit();},100);});

prefLoad();
cacheLoad();
S.memo=S.memo||{};S.times=S.times||{};
/* 닫기 전에 못 올린 수정이 있으면 페이지를 열 때 다시 올린다 */
setTimeout(function(){try{if(hasDb()&&computeOps().length)flush();}catch(e){}},4000);
if(window.__HB_TEST)window.__hb={get LK(){return LK;},get S(){return S;},get SY(){return SY;},get ST(){return ST;},lockNow:lockNow};
})();

