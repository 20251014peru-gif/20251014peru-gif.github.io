/* ═══════════════════════════════════════════════════════════════
   habits.js — ✅ 습관 체크리스트 (개인일지)                    v341-1022-2100
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
  var st=document.createElement('style');st.id='hbCss';st.textContent="#hbRoot{--bg:#f3eefa; --page:#fffdff; --surface:#ffffff; --surface2:#efe8f7; --line:#ddd2ea; --dot:#e9e0f2;\n  --fg:#35294a; --muted:#6f6086;\n  --accent:#d9468a; --accent-ink:#a3205f; --accent-soft:#ffe1ee; --on-accent:#ffffff;\n  --lt3:#35294a; --lt4:#ffffff; --on-strong:#ffffff;\n  --ok:#13794c; --bad:#b4233a; --shadow:rgba(80,50,110,.14);\n  --p1:#ffe1ee; --p2:#ffe7d3; --p3:#fff1bf; --p4:#d9f4e4; --p5:#dbeeff; --p6:#e8e0ff; --p7:#f5ddff; --p8:#e4efd3;\n  --s1:#d6407c; --s2:#de6b25; --s3:#a87c00; --s4:#1b9561; --s5:#2c78c8; --s6:#6a44cc; --s7:#a83fc7; --s8:#598a27;\n  --w1:var(--p1); --w2:var(--p2); --w3:var(--p3); --w4:var(--p4); --w5:var(--p5); --w6:var(--p6);\n  --w1s:var(--s1); --w2s:var(--s2); --w3s:var(--s3); --w4s:var(--s4); --w5s:var(--s5); --w6s:var(--s6);\n  font-family:'Noto Sans KR',system-ui,-apple-system,'Malgun Gothic',sans-serif;}\n#hbRoot *{box-sizing:border-box}\n#hbRoot{margin:0;background:var(--bg);color:var(--fg);padding-block:0 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));line-height:1.5}\n#hbRoot button,#hbRoot select,#hbRoot input,#hbRoot textarea{font:inherit;color:inherit}\n#hbRoot button{cursor:pointer}\n#hbRoot button:focus-visible,#hbRoot select:focus-visible,#hbRoot input:focus-visible,#hbRoot textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}\n#hbRoot .hbwrap{max-width:none;margin:0 auto}\n#hbRoot .top{position:sticky;top:env(safe-area-inset-top,0px);z-index:9;background:var(--bg);display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-block:10px 8px}\n#hbRoot .top h1{margin:0;font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:30px;font-weight:700;letter-spacing:.01em;line-height:1}\n#hbRoot .chip{font-size:12px;font-weight:700;color:var(--accent-ink);background:var(--accent-soft);border-radius:999px;padding:3px 10px;border:0}\n#hbRoot button.chip:hover{filter:brightness(.97)}\n#hbRoot .tabs{margin-left:auto;display:grid;grid-template-columns:repeat(8,1fr);gap:3px;background:var(--surface2);border-radius:12px;padding:3px;width:min(100%,640px)}\n#hbRoot .tabs button{border:0;background:transparent;border-radius:9px;padding:7px 2px;white-space:nowrap;font-size:14px;font-weight:700;color:var(--muted)}\n#hbRoot .tabs button[aria-selected=\"true\"]{background:var(--accent);color:var(--on-accent)}\n#hbRoot #hbView{display:flex;flex-direction:column;gap:14px;padding-top:4px}\n#hbRoot #hbView.narrow{max-width:980px;margin:0 auto;width:100%}\n#hbRoot .card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;min-width:0}\n#hbRoot .card h2{margin:0 0 10px;font-size:15px;font-weight:800}\n#hbRoot .note{font-size:12.5px;color:var(--muted)}\n#hbRoot .btn{border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700}\n#hbRoot .btn:hover{background:var(--surface2)}\n#hbRoot .btn.pri{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}\n#hbRoot .btn.warn{border-color:var(--bad);color:var(--bad)}\n#hbRoot .btn.sm{padding:5px 10px;font-size:12px}\n#hbRoot .nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n#hbRoot .nb{width:38px;height:38px;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;font-size:18px;font-weight:700;line-height:1;flex:none}\n#hbRoot .nav .nl{flex:1;min-width:150px;text-align:center;font-weight:800;font-size:16px}\n#hbRoot .nav .nl small{display:block;font-size:12px;font-weight:500;color:var(--muted)}\n#hbRoot .nav select{height:38px;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:0 8px;font-weight:700}\n#hbRoot .sum{display:flex;gap:18px;align-items:center;flex-wrap:wrap}\n#hbRoot .sum .facts{display:grid;gap:4px;font-size:13px;min-width:0}\n#hbRoot .donut .d-bg{stroke:var(--surface2)}\n#hbRoot .donut .d-fg{stroke:var(--accent)}\n#hbRoot .donut .d-t{fill:var(--fg);font-weight:800}\n#hbRoot .c1{--hp:var(--p1);--hs:var(--s1)}\n#hbRoot .c2{--hp:var(--p2);--hs:var(--s2)}\n#hbRoot .c3{--hp:var(--p3);--hs:var(--s3)}\n#hbRoot .c4{--hp:var(--p4);--hs:var(--s4)}\n#hbRoot .c5{--hp:var(--p5);--hs:var(--s5)}\n#hbRoot .c6{--hp:var(--p6);--hs:var(--s6)}\n#hbRoot .c7{--hp:var(--p7);--hs:var(--s7)}\n#hbRoot .c8{--hp:var(--p8);--hs:var(--s8)}\n#hbRoot .book{display:grid;grid-template-columns:minmax(290px,370px) 1fr;background:var(--page);border:1px solid var(--line);border-radius:24px;box-shadow:0 12px 32px var(--shadow);position:relative;overflow:hidden;min-height:0}\n#hbRoot .page{position:relative;min-width:0;min-height:0;padding:24px 22px 18px;background-image:radial-gradient(var(--dot) 1.1px,transparent 1.3px);background-size:18px 18px}\n#hbRoot .page.left{display:flex;flex-direction:column;gap:14px;overflow:auto}\n#hbRoot .page.right{display:flex;flex-direction:column;gap:10px;border-left:2px dashed var(--line)}\n#hbRoot .page.right::before{content:\"\";position:absolute;left:-8px;top:22px;bottom:22px;width:14px;background:radial-gradient(circle,var(--bg) 4.5px,transparent 5.5px) 0 0/14px 36px repeat-y}\n#hbRoot .tape{position:absolute;top:-7px;left:50%;width:120px;height:26px;transform:translateX(-50%) rotate(-3deg);border-radius:4px;background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--accent) 38%,transparent) 0 8px,color-mix(in srgb,var(--accent) 20%,transparent) 8px 16px);opacity:.85}\n#hbRoot .dnav{display:flex;align-items:center;gap:8px;margin-top:6px}\n#hbRoot .dnav .dt{flex:1;text-align:center;min-width:0}\n#hbRoot .bigd{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:46px;font-weight:700;line-height:1;color:var(--accent-ink)}\n#hbRoot .dsub{font-size:13px;color:var(--muted);font-weight:500;margin-top:2px}\n#hbRoot .back{align-self:center}\n#hbRoot .ringrow{display:flex;gap:14px;align-items:center;background:var(--surface);border:1.5px dashed var(--line);border-radius:18px;padding:12px 14px}\n#hbRoot .ringrow .rt{min-width:0}\n#hbRoot .ringrow .rt b{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:22px;line-height:1.2;display:block}\n#hbRoot .faces{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}\n#hbRoot .faces button{border:1.5px solid var(--line);background:var(--surface);border-radius:14px;font-size:24px;line-height:1;padding:8px 0}\n#hbRoot .faces button[aria-pressed=\"true\"]{background:var(--accent-soft);border-color:var(--accent);transform:translateY(-2px)}\n#hbRoot .lab{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:18px;font-weight:700;margin:0 0 4px}\n#hbRoot textarea,#hbRoot input[type=text],#hbRoot input[type=number],#hbRoot input[type=time],#hbRoot select.f{width:100%;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:8px 11px;font-size:14px}\n#hbRoot textarea{min-height:56px;resize:none}\n#hbRoot .wk7{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}\n#hbRoot .wd{border:0;background:transparent;display:grid;justify-items:center;gap:3px;padding:6px 0;border-radius:14px;font-size:12px;color:var(--muted)}\n#hbRoot .wd b{font-size:14px;color:var(--fg)}\n#hbRoot .wd.sel{background:var(--accent-soft)}\n#hbRoot .wd.today b{color:var(--accent-ink);text-decoration:underline}\n#hbRoot .mr{position:relative;width:26px;height:26px;border-radius:50%;background:conic-gradient(var(--accent) calc(var(--p)*1%),var(--surface2) 0)}\n#hbRoot .mr::after{content:\"\";position:absolute;inset:5px;border-radius:50%;background:var(--page)}\n#hbRoot .mr.na{background:transparent;border:1.5px dotted var(--line)}\n#hbRoot .mr.na::after{display:none}\n#hbRoot .cards{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));grid-auto-rows:minmax(190px,270px);gap:16px 14px;align-content:start;padding:8px 6px 10px}\n#hbRoot .hcard{position:relative;background:var(--hp);border:1.5px dashed color-mix(in srgb,var(--hs) 45%,transparent);border-radius:20px;padding:12px 12px 10px;display:flex;flex-direction:column;gap:8px;min-width:0;box-shadow:0 2px 0 color-mix(in srgb,var(--hs) 22%,transparent)}\n#hbRoot .hcard:nth-child(3n+1){transform:rotate(-.5deg)}\n#hbRoot .hcard:nth-child(3n+2){transform:rotate(.4deg)}\n#hbRoot .hh{display:flex;gap:9px;align-items:center;min-width:0}\n#hbRoot .hico{flex:none;width:40px;height:40px;border-radius:50%;background:var(--surface);display:grid;place-items:center;font-size:22px;box-shadow:0 1px 0 color-mix(in srgb,var(--hs) 35%,transparent)}\n#hbRoot .hnm{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:20px;font-weight:700;line-height:1.1;word-break:keep-all;overflow-wrap:break-word}\n#hbRoot .hsub{font-size:11.5px;color:var(--muted);line-height:1.3;word-break:keep-all;overflow-wrap:break-word}\n#hbRoot .hhw{min-width:0;flex:1}\n#hbRoot .stamps{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:flex-start}\n#hbRoot .stamp{border:0;background:transparent;padding:0;display:grid;justify-items:center;gap:2px;min-width:44px}\n#hbRoot .stamp i{width:44px;height:44px;border-radius:50%;border:2px dashed var(--hs);background:color-mix(in srgb,var(--hs) 10%,var(--surface));display:grid;place-items:center;color:var(--hs);font-style:normal;font-size:20px;font-weight:800;line-height:1}\n#hbRoot .stamp small{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;min-height:15px;line-height:15px;white-space:nowrap}\n#hbRoot .stamp.done i{background:var(--hs);border-style:solid;color:var(--on-strong)}\n#hbRoot .stamp.done small{color:var(--fg);font-weight:700}\n#hbRoot .stamp.late small{color:var(--bad);font-weight:700}\n#hbRoot .stamp:disabled{opacity:.4;cursor:default}\n#hbRoot .stamps.sm .stamp{min-width:34px}\n#hbRoot .stamps.sm .stamp i{width:32px;height:32px;font-size:15px}\n#hbRoot .stamps.sm .stamp small{font-size:10px}\n@keyframes hbpop{0%{transform:scale(.6) rotate(-12deg)}60%{transform:scale(1.18) rotate(4deg)}100%{transform:scale(1) rotate(0)}}\n@media (prefers-reduced-motion: no-preference){#hbRoot .stamp.pop i{animation:hbpop .38s ease-out}}\n#hbRoot .hft{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-top:auto}\n#hbRoot .d7{display:flex;gap:4px;align-items:center}\n#hbRoot .d7 b{width:10px;height:10px;border-radius:50%;border:1.5px solid var(--hs);display:block}\n#hbRoot .d7 b.on{background:var(--hs)}\n#hbRoot .d7 b.part{background:linear-gradient(90deg,var(--hs) 50%,transparent 50%)}\n#hbRoot .d7 b.na{border-style:dotted;opacity:.35}\n#hbRoot .stk{font-size:12px;font-weight:700}\n#hbRoot .mbtn{position:relative;border:0;background:var(--surface);border-radius:999px;width:30px;height:30px;font-size:14px;line-height:1;padding:0;flex:none}\n#hbRoot .mbtn.has::after{content:\"\";position:absolute;top:3px;right:3px;width:8px;height:8px;border-radius:50%;background:var(--bad)}\n#hbRoot .hint{margin:0;font-size:12px;color:var(--muted)}\n#hbRoot .page.left .grow{flex:1 1 0;min-height:76px;max-height:190px;display:flex;flex-direction:column}\n#hbRoot .page.left .grow textarea{flex:1;min-height:0}\n#hbRoot textarea.lined{line-height:1.75;padding:6px 8px;background-color:var(--surface)}\n#hbRoot .tlw{flex:none}\n#hbRoot .tlw .lab{margin-bottom:0}\n#hbRoot .tl{position:relative;height:130px;margin:4px 14px 0}\n#hbRoot .tl .axis{position:absolute;left:0;right:0;top:98px;height:2px;background:var(--line);border-radius:1px}\n#hbRoot .tl .tk{position:absolute;top:104px;transform:translateX(-50%);font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}\n#hbRoot .tl .tk::before{content:\"\";position:absolute;left:50%;top:-8px;height:6px;border-left:1.5px solid var(--line)}\n#hbRoot .tl .tm{position:absolute;transform:translateX(-50%);width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:15px;line-height:1;background:var(--hs);border:2px solid var(--hs);box-shadow:0 2px 0 color-mix(in srgb,var(--hs) 30%,transparent)}\n#hbRoot .tl .tm.plan{background:var(--surface);border-style:dashed;opacity:.8}\n#hbRoot .tl .tm::after{content:\"\";position:absolute;left:50%;top:100%;height:var(--stem,10px);border-left:1.5px solid color-mix(in srgb,var(--hs) 60%,transparent)}\n#hbRoot .tl .now{position:absolute;top:2px;bottom:32px;border-left:2px solid var(--accent);opacity:.7}\n#hbRoot .tl .now span{position:absolute;top:-2px;left:4px;font-size:11px;font-weight:700;color:var(--accent-ink);white-space:nowrap}\n#hbRoot .tl-empty{padding:18px 0;text-align:center}\n#hbRoot .cdone{background:var(--accent-soft);color:var(--accent-ink);border-radius:12px;padding:6px 12px;font-weight:700;font-size:13px}\n#hbRoot .mdl{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(30,20,40,.5);padding:16px}\n#hbRoot .msheet{position:relative;width:min(460px,100%);max-height:92dvh;overflow:auto;background:var(--hp,var(--page));border:2px dashed var(--hs,var(--accent));border-radius:22px;padding:22px 18px 16px;display:grid;gap:10px;box-shadow:0 18px 40px var(--shadow)}\n#hbRoot .mh{display:flex;gap:10px;align-items:center}\n#hbRoot .mh .hhw{flex:1}\n#hbRoot .msheet h3{margin:6px 0 0;font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:18px}\n#hbRoot .drow{display:flex;gap:8px;align-items:center}\n#hbRoot .drow span{min-width:54px;font-size:13px;font-weight:700}\n#hbRoot .drow input{flex:1;min-width:0}\n#hbRoot .chips{display:flex;flex-wrap:wrap;gap:6px}\n#hbRoot .chips button{border:1.5px solid var(--line);background:var(--surface);border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:700}\n#hbRoot .chips button[aria-pressed=\"true\"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}\n#hbRoot .scroll{overflow-x:auto;max-width:100%}\n#hbRoot table{border-collapse:separate;border-spacing:0;font-size:12.5px}\n#hbRoot th,#hbRoot td{padding:0;text-align:center}\n#hbRoot .tbl th.hl{position:sticky;left:0;z-index:1;background:var(--surface);text-align:left;min-width:124px;max-width:124px;padding:5px 8px 5px 0;font-weight:700;border-bottom:1px solid var(--line)}\n#hbRoot .tbl th.hl small{display:block;font-weight:500;color:var(--muted);font-size:11px}\n#hbRoot .tbl td{padding:4px 2px;border-bottom:1px solid var(--line)}\n#hbRoot .tbl thead th{padding:3px 2px;font-weight:700;color:var(--muted)}\n#hbRoot .tbl thead th button{border:0;background:transparent;font-weight:700;color:inherit;padding:2px 0;min-width:24px}\n#hbRoot .tbl thead th.today button{color:var(--accent-ink);text-decoration:underline}\n#hbRoot .tbl .rt{padding-left:8px;min-width:76px;text-align:left;white-space:nowrap}\n#hbRoot .tbl .rt b{font-weight:800}\n#hbRoot .bar-mini{display:block;height:5px;border-radius:3px;background:var(--surface2);margin-top:3px;overflow:hidden}\n#hbRoot .bar-mini i{display:block;height:100%;background:var(--accent)}\n#hbRoot .cell{width:24px;height:24px;border:1.5px solid var(--line);border-radius:7px;background:var(--surface);color:transparent;font-size:12px;font-weight:800;padding:0;line-height:1}\n#hbRoot .cell.lg{width:34px;height:34px;font-size:15px;border-radius:9px}\n#hbRoot .cell.on{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}\n#hbRoot .cell:disabled{opacity:.35;cursor:default}\n#hbRoot .cell.part{color:var(--fg);border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--surface))}\n#hbRoot .cell.num{color:var(--fg);font-size:11px}\n#hbRoot .cell.num.on{color:var(--on-accent)}\n#hbRoot .cell.bad{background:#e5484d;border-color:#e5484d;color:#fff}\n#hbRoot .mbody{display:flex;flex-direction:column;gap:6px;flex:1 1 auto;justify-content:center}\n#hbRoot .mbig{display:flex;align-items:baseline;gap:6px}\n#hbRoot .mbig b{font-size:34px;line-height:1;font-family:'Gaegu','Noto Sans KR',sans-serif}\n#hbRoot .mbig span{font-size:12px;color:var(--muted)}\n#hbRoot .mbig.ok b{color:var(--accent-ink)}\n#hbRoot .mbig.bad b{color:#d93a3f}\n#hbRoot .mflag{font-size:12px;color:var(--muted)}\n#hbRoot .mflag.ok{color:#2a8f5a;font-weight:700}\n#hbRoot .mflag.bad{color:#d93a3f;font-weight:800}\n#hbRoot .mact{display:flex;gap:6px;flex-wrap:wrap;align-items:center}\n#hbRoot .mbtn2{border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:5px 12px;font-size:13px;font-weight:800;cursor:pointer;color:var(--fg)}\n#hbRoot .mbtn2:disabled{opacity:.4;cursor:default}\n#hbRoot .mbtn2.ok{border-color:#2a8f5a;color:#2a8f5a}\n#hbRoot .mbtn2.ok.on{background:#2a8f5a;color:#fff}\n#hbRoot .mbtn2.bad{border-color:#d93a3f;color:#d93a3f}\n#hbRoot .amin{width:84px;padding:5px 8px;border:1.5px solid var(--line);border-radius:10px;font-size:14px}\n#hbRoot .mlist{display:flex;gap:4px;flex-wrap:wrap}\n#hbRoot .mchip{display:inline-flex;align-items:center;gap:3px;font-size:11.5px;background:var(--surface2);border-radius:999px;padding:1px 4px 1px 8px}\n#hbRoot .mchip button{border:0;background:transparent;cursor:pointer;color:var(--muted);font-size:11px;padding:0 3px}\n#hbRoot .cell.hasm{position:relative}\n#hbRoot .cell.hasm::after{content:\"\";position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:var(--bad)}\n#hbRoot td.na{color:var(--line)}\n#hbRoot .wk1.cell.on{background:var(--w1s);border-color:var(--w1s);color:var(--on-strong)}\n#hbRoot .wk2.cell.on{background:var(--w2s);border-color:var(--w2s);color:var(--on-strong)}\n#hbRoot .wk3.cell.on{background:var(--w3s);border-color:var(--w3s);color:var(--on-strong)}\n#hbRoot .wk4.cell.on{background:var(--w4s);border-color:var(--w4s);color:var(--on-strong)}\n#hbRoot .wk5.cell.on{background:var(--w5s);border-color:var(--w5s);color:var(--on-strong)}\n#hbRoot .wk6.cell.on{background:var(--w6s);border-color:var(--w6s);color:var(--on-strong)}\n#hbRoot th.wk1{background:var(--w1)}\n#hbRoot th.wk2{background:var(--w2)}\n#hbRoot th.wk3{background:var(--w3)}\n#hbRoot th.wk4{background:var(--w4)}\n#hbRoot th.wk5{background:var(--w5)}\n#hbRoot th.wk6{background:var(--w6)}\n#hbRoot .l0{--lv:var(--surface2);--lt:var(--muted)}\n#hbRoot .l1{--lv:color-mix(in srgb,var(--accent) 22%,var(--surface));--lt:var(--fg)}\n#hbRoot .l2{--lv:color-mix(in srgb,var(--accent) 45%,var(--surface));--lt:var(--fg)}\n#hbRoot .l3{--lv:color-mix(in srgb,var(--accent) 75%,var(--surface));--lt:var(--lt3)}\n#hbRoot .l4{--lv:var(--accent);--lt:var(--lt4)}\n#hbRoot .hc{background:var(--lv);color:var(--lt);font-weight:700;min-width:40px;height:28px;border-radius:6px;font-size:12px}\n#hbRoot .rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px 16px}\n#hbRoot .heat td{padding:2px;border:0}\n#hbRoot .heat th{padding:2px;font-weight:700;color:var(--muted);font-size:12px}\n#hbRoot .heat th.hl{min-width:124px;max-width:124px;text-align:left;position:sticky;left:0;background:var(--surface);z-index:1;color:var(--fg)}\n#hbRoot .sq{fill:var(--lv)}\n#hbRoot .chart{display:block;max-width:100%}\n#hbRoot .chart .gl{stroke:var(--line);stroke-width:1}\n#hbRoot .chart .ax{fill:var(--muted);font-size:10.5px}\n#hbRoot .chart .vl{fill:var(--fg);font-size:10.5px;font-weight:700}\n#hbRoot .chart .bar{fill:var(--accent)}\n#hbRoot .chart .ln{fill:none;stroke:var(--accent);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}\n#hbRoot .chart .ar{fill:color-mix(in srgb,var(--accent) 20%,transparent);stroke:none}\n#hbRoot .chart .dot{fill:var(--accent);stroke:var(--surface);stroke-width:2}\n#hbRoot .chart .wb1{fill:var(--w1)}\n#hbRoot .chart .wb2{fill:var(--w2)}\n#hbRoot .chart .wb3{fill:var(--w3)}\n#hbRoot .chart .wb4{fill:var(--w4)}\n#hbRoot .chart .wb5{fill:var(--w5)}\n#hbRoot .chart .wb6{fill:var(--w6)}\n#hbRoot .legend{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted);margin-top:8px}\n#hbRoot .legend i{width:14px;height:14px;border-radius:4px;display:inline-block;background:var(--lv)}\n#hbRoot .tag{font-size:11.5px;font-weight:700;color:var(--ok);border:1px solid var(--ok);border-radius:999px;padding:1px 8px;white-space:nowrap}\n#hbRoot .list{display:grid;gap:8px}\n#hbRoot .fgrid{display:grid;gap:10px}\n#hbRoot label.fl{display:grid;gap:4px;font-size:12.5px;font-weight:700;color:var(--muted)}\n#hbRoot .icons{display:flex;flex-wrap:wrap;gap:4px}\n#hbRoot .icons button{width:38px;height:38px;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;font-size:20px;padding:0}\n#hbRoot .icons button[aria-pressed=\"true\"]{border-color:var(--accent);background:var(--accent-soft)}\n#hbRoot .cdots{display:flex;gap:6px;flex-wrap:wrap}\n#hbRoot .cdot{width:26px;height:26px;border-radius:50%;border:2px solid transparent;background:var(--hs);padding:0}\n#hbRoot .cdot[aria-pressed=\"true\"]{border-color:var(--fg)}\n#hbRoot .mrow{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:12px 0;border-bottom:1px solid var(--line)}\n#hbRoot .mrow:last-child{border-bottom:0}\n#hbRoot .mrow .big{font-size:24px;line-height:1.2}\n#hbRoot .mrow .ctl{display:flex;gap:8px;flex-wrap:wrap;align-items:center}\n#hbRoot .mrow input[type=text]{flex:1 1 160px;min-width:0}\n#hbRoot .mrow select{border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:8px}\n#hbRoot .mrow input[type=number]{width:64px}\n#hbRoot .mrow input.tin{flex:0 0 90px;width:90px;text-align:center;font-variant-numeric:tabular-nums}\n#hbRoot input.tin{font-variant-numeric:tabular-nums}\n#hbRoot input[aria-invalid=\"true\"]{border-color:var(--bad);background:color-mix(in srgb,var(--bad) 8%,var(--surface))}\n#hbRoot .mrow input.u{flex:0 0 96px;min-width:0}\n#hbRoot .mrow .acts{display:flex;gap:6px;flex-wrap:wrap}\n#hbRoot .empty{text-align:center;padding:28px 8px;color:var(--muted)}\n#hbRoot pre.json{margin:0;max-height:200px;overflow:auto;font-size:12px;background:var(--surface2);border-radius:10px;padding:10px;white-space:pre-wrap;word-break:break-all}\n#hbRoot .fitbox{display:flex;flex-direction:column;gap:12px;min-width:0;position:relative}\n#hbRoot .lay{display:grid;gap:14px;align-items:start;min-width:0}\n#hbRoot .lay.w{grid-template-columns:minmax(0,1fr) minmax(300px,440px)}\n#hbRoot .lay.y{grid-template-columns:minmax(300px,460px) minmax(0,1fr)}\n#hbRoot .lay.m{grid-template-columns:minmax(240px,320px) minmax(360px,540px) minmax(0,1fr)}\n#hbRoot .lay.m .tc{grid-column:1/-1}\n#hbRoot .lay.w .tbl{width:100%;table-layout:fixed}\n#hbRoot .lay.w .tbl th.hl{width:150px;min-width:150px;max-width:150px}\n#hbRoot .lay.w .tbl .rt{width:120px}\n#hbRoot .lay.w .cell.lg{width:100%;max-width:76px;height:42px;font-size:17px}\n#hbRoot .lay.m .tbl th.hl small{display:none}\n#hbRoot .lay.m .tbl td{padding:2px}\n#hbRoot .lay.m .tbl th.hl{padding:2px 8px 2px 0}\n#hbRoot .rline{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:5px}\n#hbRoot .rline b{font-size:13px}\n#hbRoot .rcm{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#hbRoot .aside,#hbRoot .col{display:flex;flex-direction:column;gap:14px;min-width:0}\n#hbRoot .fitbox .card.nav{padding:8px 12px}\n@media (min-width:900px) and (min-height:520px){#hbRoot.fit,#hbRoot.fit{height:100%}\n#hbRoot.fit{padding-bottom:12px;overflow:hidden}\n#hbRoot.fit .hbwrap{height:100%;display:flex;flex-direction:column}\n#hbRoot.fit #hbView{flex:1;min-height:0;padding-top:2px;position:relative;overflow:hidden;display:block}\n#hbRoot.fit .fitbox{position:absolute;left:0;top:0;width:calc(100% / var(--k,1));height:calc(100% / var(--k,1));transform:scale(var(--k,1));transform-origin:0 0}\n#hbRoot.fit .fitbox>.book,#hbRoot.fit .fitbox>.lay{flex:1;min-height:0}}\n@media (max-width:899px){#hbRoot .lay{grid-template-columns:1fr !important}}\n@media (max-width:899px){#hbRoot .book{grid-template-columns:1fr}\n#hbRoot .page.right{border-left:0;border-top:2px dashed var(--line)}\n#hbRoot .page.right::before{display:none}\n#hbRoot .tabs{margin-left:0;width:100%}}\n@media (max-width:480px){#hbRoot .top h1{font-size:26px}\n#hbRoot .bigd{font-size:38px}\n#hbRoot .tbl th.hl,#hbRoot .heat th.hl{min-width:104px;max-width:104px}\n#hbRoot .cards{grid-template-columns:1fr}}\n#hbRoot .sumcard{flex:none}\n#hbRoot .cfx{display:flex;flex-direction:column;min-height:0;min-width:0}\n#hbRoot .chartbox{flex:1 1 0;min-height:100px;overflow:hidden;position:relative}\n#hbRoot .tc{display:flex;flex-direction:column;min-height:0;min-width:0}\n#hbRoot .tc .scroll{flex:1 1 auto;min-height:0}\n#hbRoot .tc .scroll .tbl{height:100%}\n#hbRoot .hwrap{flex:1 1 0;min-height:0;overflow-x:auto}\n#hbRoot .hgrid{display:grid;grid-template-columns:minmax(110px,170px) repeat(13,minmax(30px,1fr));grid-template-rows:auto;grid-auto-rows:minmax(22px,1fr);gap:3px;height:100%;min-width:520px}\n#hbRoot .hgrid .hh2{font-size:12px;font-weight:700;color:var(--muted);text-align:center;align-self:end;padding-bottom:2px}\n#hbRoot .hgrid .hl2{display:flex;align-items:center;font-size:12.5px;font-weight:700;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#hbRoot .hgrid .hcell{background:var(--lv);color:var(--lt);border-radius:8px;display:grid;place-items:center;font-weight:700;font-size:12.5px;min-height:0}\n#hbRoot .hgrid .hcell.empty{background:transparent}\n#hbRoot .hgrid .hcell.yr{font-weight:800}\n#hbRoot .lay.m{grid-template-columns:minmax(220px,260px) minmax(0,1.15fr) minmax(300px,1fr);grid-template-areas:\"sum rsn rsn\" \"tbl tbl cht\"}\n#hbRoot .lay.m .sumc{grid-area:sum}\n#hbRoot .lay.m .rsn{grid-area:rsn}\n#hbRoot .lay.m .tc{grid-area:tbl}\n#hbRoot .lay.m .chc{grid-area:cht}\n#hbRoot .lay.m .tbl{width:100%;table-layout:fixed}\n#hbRoot .lay.m .tbl th.hl{width:150px;min-width:150px;max-width:150px}\n#hbRoot .lay.m .tbl .rt{width:96px;min-width:0}\n#hbRoot .lay.m .cell{width:100%;max-width:38px}\n#hbRoot .chart .fut{fill:none;stroke:var(--line);stroke-width:1}\n@media (min-width:900px) and (min-height:520px){#hbRoot.fit .lay{align-items:stretch}\n#hbRoot.fit .lay.w,#hbRoot.fit .lay.y{grid-template-rows:minmax(0,1fr)}\n#hbRoot.fit .lay.m{grid-template-rows:auto minmax(0,1fr)}\n#hbRoot.fit .aside>.cfx{flex:1 1 0}\n#hbRoot.fit .col>.cfx.a{flex:1.6 1 0}\n#hbRoot.fit .col>.cfx.b{flex:1 1 0}\n#hbRoot.fit .cards{align-content:stretch}\n#hbRoot .ghostcard{border:2px dashed #e8b8cf;border-radius:18px;background:transparent;color:#c0618f;font:inherit;font-weight:800;font-size:15px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:80px;opacity:.75}\n#hbRoot .ghostcard:hover{opacity:1;background:#fff0f6}\n#hbRoot .ghostcard::first-line{font-size:30px}}\n@media (max-width:899px){#hbRoot .lay.m{grid-template-areas:none !important}\n#hbRoot .lay.m>*{grid-area:auto !important}\n#hbRoot .cfx,#hbRoot .hwrap{flex:none !important}\n#hbRoot .chartbox{height:170px;flex:none}\n#hbRoot .hgrid{height:auto}}\n#hbRoot .fitbox[data-dn=\"1\"] .lay.m .cell{height:19px;max-width:30px;font-size:10.5px;border-radius:6px}\n#hbRoot .fitbox[data-dn=\"1\"] .lay.m .tbl td{padding:1px}\n#hbRoot .fitbox[data-dn=\"1\"] .lay.m .tbl th.hl{font-size:11.5px;padding:1px 6px 1px 0}\n#hbRoot .fitbox[data-dn=\"1\"] .lay.m .tbl .rt{font-size:11px}\n#hbRoot .fitbox[data-dn=\"1\"] .lay.m .tbl .bar-mini{margin-top:1px}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .cell{height:14px;max-width:26px;font-size:9px;border-radius:4px;border-width:1px}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tbl td{padding:0 1px}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tbl th.hl{font-size:10.5px;padding:0 6px 0 0}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tbl .rt{font-size:10px}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tbl thead th{font-size:10px}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tbl thead th button{font-size:10px;padding:0}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tc .note{display:none}\n#hbRoot .fitbox[data-dn=\"2\"] .lay.m .tc h2{margin-bottom:4px}\n#hbRoot .dy{display:flex;flex-direction:column;gap:10px;min-width:0}\n#hbRoot .dy .col1,#hbRoot .dy .col2,#hbRoot .dy .col3{display:flex;flex-direction:column;gap:14px;min-width:0;min-height:0}\n#hbRoot .dy>.d3,#hbRoot .dy>.cfx{flex:1 1 0;min-height:0}\n#hbRoot .dy>.iv{flex:1 1 0;min-height:0}\n#hbRoot .dnav{padding:6px 12px;gap:10px;flex-wrap:wrap}\n#hbRoot .dnav .bigd2{font-size:24px}\n#hbRoot .dnav .dtags{margin-left:auto}\n#hbRoot .dsl{flex:0 0 clamp(130px,22vh,200px);display:flex;flex-direction:column;min-height:0;padding:10px 14px}\n#hbRoot .bigd2{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:30px;font-weight:700;color:var(--accent-ink);line-height:1;display:block}\n#hbRoot .dauto{flex:1 1 0;min-height:104px;overflow:auto;white-space:pre-wrap;font-size:12.5px;line-height:1.55;background:var(--surface2);border-radius:10px;padding:8px 10px;margin-bottom:8px}\n#hbRoot .sheet{gap:12px}\n#hbRoot .sg{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n#hbRoot .sf{display:flex;flex-direction:column;gap:4px;min-height:0;min-width:0}\n#hbRoot .sf>span{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:18px;font-weight:700}\n#hbRoot .sf textarea{flex:1;min-height:56px;resize:none}\n#hbRoot .sg .sf textarea{min-height:64px}\n#hbRoot .sf.grow{flex:1 1 0}\n#hbRoot .sf.grow textarea{min-height:90px}\n#hbRoot .dmain{flex:1 1 0;min-height:140px;resize:none;font-size:16px;line-height:1.85}\n#hbRoot .dcnt{text-align:right;margin:0}\n#hbRoot .dtags,#hbRoot .iv .chips{display:flex;flex-wrap:wrap;gap:6px}\n#hbRoot .dwrap{flex:1 1 0;min-height:0;display:flex;align-items:stretch;gap:6px;margin-top:8px}\n#hbRoot .dwrap .nb{align-self:center;flex:0 0 auto}\n#hbRoot .dslides{flex:1 1 0;min-width:0;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:thin;gap:10px}\n#hbRoot .dslide{flex:0 0 100%;scroll-snap-align:start;display:flex;flex-direction:column;gap:6px;background:var(--surface);border:1.5px solid var(--line);border-radius:14px;padding:8px 14px;min-width:0;min-height:0;box-sizing:border-box;overflow-y:auto}\n#hbRoot .dslide.empty{align-items:center;justify-content:center;text-align:center}\n#hbRoot .dslide header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n#hbRoot .dslide header b{font-family:'Gaegu','Noto Sans KR',sans-serif;font-size:18px;color:var(--accent-ink)}\n#hbRoot .dno{margin-left:auto;font-size:12px;color:var(--muted)}\n#hbRoot .dbody3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;min-height:0}\n#hbRoot .dbody3 section{min-width:0;border-left:3px solid var(--accent-soft);padding-left:10px}\n#hbRoot .dbody3 h4{margin:0 0 4px;font-size:13px;color:var(--accent-ink)}\n#hbRoot .dtx{white-space:pre-wrap;font-size:13.5px;line-height:1.75;overflow-wrap:anywhere}\n#hbRoot .d3{flex:1 1 0;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}\n#hbRoot .dcol{display:flex;flex-direction:column;gap:6px;min-height:0;min-width:0;padding:10px 14px}\n#hbRoot .dcol h2{margin:0;font-size:17px}\n#hbRoot .dcol .dmain{flex:1 1 0;min-height:120px}\n#hbRoot .itabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}\n#hbRoot .itabs button{border:1.5px solid var(--line);background:var(--surface);border-radius:12px 12px 0 0;padding:6px 14px;font-size:14px;font-weight:800;color:var(--muted);cursor:pointer}\n#hbRoot .itabs button i{font-style:normal;font-size:11.5px;opacity:.75;margin-left:2px}\n#hbRoot .itabs button[aria-selected=\"true\"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}\n#hbRoot .dslide footer{display:flex;justify-content:flex-end}\n#hbRoot .dtg{font-size:11.5px;background:var(--accent-soft);color:var(--accent-ink);border-radius:999px;padding:1px 8px;white-space:nowrap}\n#hbRoot .lkwarn{background:#fff4d6;border:1.5px solid #f0c75e;color:#7a5200;border-radius:10px;padding:7px 10px;font-size:12.5px}\n#hbRoot .lnk{border:0;background:none;color:inherit;font:inherit;font-weight:800;text-decoration:underline;cursor:pointer;padding:0}\n#hbRoot .iv{display:flex;flex-direction:column;gap:10px;min-width:0}\n#hbRoot .ncol1{display:none}\n#hbRoot .rtewrap{flex:1 1 0;min-height:0;overflow:hidden;overflow:clip;position:relative}\n#hbRoot .rte3{--lh:1.6;column-count:auto;column-fill:auto;outline:none;padding:6px 0;font-size:16px;line-height:var(--lh);box-sizing:border-box;white-space:pre-wrap;overflow-wrap:anywhere;overflow:visible;position:relative}\n#hbRoot .rte3 .ln{text-align:justify;text-justify:inter-character;orphans:1;widows:1;--d:0;position:relative;padding-left:calc(7px + var(--d)*24px);border-left:3px solid transparent;min-height:calc(var(--lh)*1em)}\n#hbRoot .rte3 .ln[data-d=\"1\"]{--d:1}\n#hbRoot .rte3 .ln[data-d=\"2\"]{--d:2}\n#hbRoot .rte3 .ln[data-d=\"3\"]{--d:3}\n#hbRoot .rte3 .ln[data-l]{padding-left:calc(7px + var(--d)*24px + 1.4em)}\n#hbRoot .rte3 .ln[data-l]::before{position:absolute;left:calc(7px + var(--d)*24px);font-weight:700}\n#hbRoot .rte3 .ln[data-l=\"b\"]::before{content:'•'}\n#hbRoot .rte3 .ln[data-l=\"b\"][data-d=\"1\"]::before{content:'◦'}\n#hbRoot .rte3 .ln[data-l=\"b\"][data-d=\"2\"]::before{content:'▪'}\n#hbRoot .rte3 .ln[data-l=\"b\"][data-d=\"3\"]::before{content:'–'}\n#hbRoot .rte3 .ln[data-l=\"b1\"]::before{content:'○'}\n#hbRoot .rte3 .ln[data-l=\"b2\"]::before{content:'■';font-size:.7em;top:.18em}\n#hbRoot .rte3 .ln[data-l=\"b3\"]::before{content:'➤';font-size:.85em}\n#hbRoot .rte3 .ln[data-l=\"b4\"]::before{content:'✔'}\n#hbRoot .rte3 .ln[data-l=\"b5\"]::before{content:'–'}\n#hbRoot .rte3 .ln[data-l=\"b6\"]::before{content:'★';font-size:.9em}\n#hbRoot .rte3 .ln[data-l=\"n\"]::before{content:attr(data-n);font-variant-numeric:tabular-nums}\n#hbRoot .rtb2{display:inline-flex;gap:4px;margin-right:6px}\n#hbRoot .rtb2 button{border:1.5px solid var(--line);background:var(--surface);border-radius:8px;padding:2px 9px;font-size:12.5px;font-weight:800;cursor:pointer;color:var(--fg)}\n#hbRoot .rte3 .ln.s{color:#1d4ed8;border-left-color:#93c5fd}\n#hbRoot .rte3 .ln.m{color:#be185d;font-weight:600;border-left-color:#f9a8d4}\n#hbRoot .rte3 .ln.c{color:#15803d;border-left-color:#86efac}\n#hbRoot .rte3 .ln.n{color:var(--fg);border-left-color:#cbd5e1}\n#hbRoot .rte3 .ln.m{font-weight:inherit}\n#hbRoot .rte3 .ln:has(>br:only-child){border-left-color:transparent !important}\n#hbRoot .rte3 .t0{color:var(--fg)}\n#hbRoot .rte3 .t1{color:#1d4ed8}\n#hbRoot .rte3 .t2{color:#be185d}\n#hbRoot .rte3 .t3{color:#15803d}\n#hbRoot .rte3 mark{background:#fff3a3;color:inherit;padding:0 1px;border-radius:3px}\n#hbRoot .rte3 .ln[data-s=\"h1\"]{font-size:1.6em;font-weight:800;line-height:1.35;padding-top:.2em}\n#hbRoot .rte3 .ln[data-s=\"h2\"]{font-size:1.32em;font-weight:800;line-height:1.4}\n#hbRoot .rte3 .ln[data-s=\"h3\"]{font-size:1.12em;font-weight:800}\n#hbRoot .rte3 .hr{position:relative;break-inside:avoid;padding:9px 0}\n#hbRoot .rte3 .hr hr{border:0;border-top:2px solid var(--line);margin:0}\n#hbRoot .rte3 .hr .ix{position:absolute;right:0;top:0;width:20px;height:20px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:10px;cursor:pointer;line-height:1;padding:0;opacity:0}\n#hbRoot .rte3 .hr:hover .ix{opacity:1}\n#hbRoot .rte3[contenteditable=\"false\"] .hr .ix{display:none}\n#hbRoot .rtw{display:inline-flex;align-items:center;gap:1px;flex-wrap:wrap;border:1.5px solid var(--line);border-radius:10px;background:var(--surface);padding:0 4px}\n#hbRoot .rtw button{border:0;background:transparent;border-radius:8px;min-width:26px;height:26px;padding:0 5px;font-size:15px;font-weight:700;cursor:pointer;color:var(--muted)}\n#hbRoot .rtw button:hover{background:var(--surface2);color:var(--fg)}\n#hbRoot .rtw .rts{width:1px;height:18px;background:var(--line);margin:0 4px;display:inline-block}\n#hbRoot .rtw select.rtbulsel{padding:0 2px;margin-left:-2px;border-color:transparent;background:transparent;font-size:13px}\n#hbRoot .rtw select{width:auto;flex:none;height:26px;border:1.5px solid var(--line);border-radius:8px;background:var(--surface);font-size:13px;font-weight:700;padding:0 6px}\n#hbRoot .rtw .fb{color:var(--fg)}\n#hbRoot .rtw .fi{color:var(--fg)}\n#hbRoot .rtw .fs{color:var(--fg)}\n#hbRoot .rtw .fh span{background:#fff3a3;border-radius:4px;padding:0 5px;color:#333}\n#hbRoot .rtcs{display:inline-flex;gap:1px}\n#hbRoot .rtcb span{display:inline-block;font-weight:800;padding:0 1px;border-bottom:3px solid currentColor;line-height:1.15}\n#hbRoot .rtcb.c0 span{color:#222}\n#hbRoot .rtcb.c1 span{color:#1d4ed8}\n#hbRoot .rtcb.c2 span{color:#be185d}\n#hbRoot .rtcb.c3 span{color:#15803d}\n#hbRoot .rte3[contenteditable=\"false\"] figure.im .ix{display:none}\n#hbRoot .rte3[contenteditable=\"false\"]{cursor:default}\n#hbRoot input[readonly].ititle,#hbRoot input[readonly].iurl,#hbRoot input[readonly].mnin{border-color:transparent;background:transparent;box-shadow:none}\n#hbRoot .rtb button#rtk-c{color:#15803d}\n#hbRoot .rtb button[aria-pressed=\"true\"]#rtk-c{background:#22c55e;border-color:#22c55e;color:#fff}\n#hbRoot .rte3 .ln[data-l=\"k\"]::before{content:'☐';font-size:1.05em;cursor:pointer}\n#hbRoot .rte3 .ln[data-l=\"kx\"]::before{content:'☑';font-size:1.05em;color:#15803d;cursor:pointer}\n#hbRoot .rte3 .ln[data-l=\"kx\"]{color:var(--muted);text-decoration:line-through}\n#hbRoot .rte3 .ln[data-a=\"c\"]{text-align:center}\n#hbRoot .rte3 .ln[data-a=\"r\"]{text-align:right}\n#hbRoot .rte3 .ln[data-s=\"q\"]{margin:3px 0;padding-top:.2em;padding-bottom:.2em;border-left:4px solid #94a3b8;background:rgba(148,163,184,.16);font-style:italic;border-radius:0 8px 8px 0}\n#hbRoot .rte3 .ln[data-s^=\"h\"]::after{content:'▾';position:absolute;right:3px;top:.15em;font-size:.55em;font-style:normal;font-weight:700;color:var(--muted);cursor:pointer;line-height:1.6}\n#hbRoot .rte3 .ln[data-s^=\"h\"][data-fold=\"1\"]::after{content:'▸ 접힘';font-size:.5em;background:var(--surface2);border-radius:999px;padding:0 8px}\n#hbRoot .rte3 .fh{display:none!important}\n#hbRoot .rte3 .ln[data-cb=\"1\"]{break-before:column;-webkit-column-break-before:always}\n#hbRoot .rte3[contenteditable=\"true\"] .ln[data-bad=\"1\"]{box-shadow:inset 0 2px 0 #dc2626,inset 4px 0 0 #dc2626}\n#hbRoot .rte3 .ln[data-bx=\"1\"]{background:#eef2f9;border-left:5px solid #475569!important;padding-right:8px}\n#hbRoot .rte3 [data-sp=\"1\"]{column-span:all}\n#hbRoot .rte3 .ln[data-sp=\"1\"]{background:#eef2f9;border-left:5px solid #475569!important;padding-right:10px}\n#hbRoot .rte3 .tbl[data-sp=\"1\"]{margin:0;padding:6px 10px 8px 14px;background:#eef2f9;border-left:5px solid #475569}\n#hbRoot .rte3 .tbl[data-sp=\"1\"] td{background:var(--surface)}\n#hbRoot .rte3 .tbl{margin:6px 0;break-inside:avoid;position:relative}\n#hbRoot .rte3 .tbl table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.94em;line-height:1.5}\n#hbRoot .rte3 .tbl td{border:1.5px solid var(--line);padding:5px 8px;vertical-align:top;min-height:1.6em;word-break:break-word;white-space:pre-wrap}\n#hbRoot .rte3 .tbl tr:first-child td{background:var(--surface2);font-weight:800}\n#hbRoot .rte3 .tbl .tbar{display:flex;gap:4px;margin-top:3px;opacity:.85}\n#hbRoot .rte3 .tbl .tbar button{border:1.5px solid var(--line);background:var(--surface);border-radius:999px;font-size:11px;padding:1px 9px;cursor:pointer}\n#hbRoot .rte3[contenteditable=\"false\"] .tbl .tbar{display:none}\n#hbRoot .rtw .rtz{width:48px;height:26px;border:1.5px solid var(--line);border-radius:8px;background:var(--surface);font-size:13px;font-weight:700;padding:0 4px;text-align:center}\n#hbRoot .rtw svg{display:block}\n#hbRoot .itagsel{border:1.5px solid var(--line);border-radius:999px;background:var(--surface);font-size:12px;font-weight:700;padding:2px 8px;height:26px}\n#hbRoot .newpick{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center}\n#hbRoot .rtfr{flex-wrap:wrap;gap:6px;padding:2px 0}\n#hbRoot .rtfr input{flex:1 1 130px;min-width:0;padding:4px 9px;font-size:13px;border:1.5px solid var(--line);border-radius:8px;background:var(--surface)}\n#hbRoot .rtw button[aria-pressed=\"true\"]{background:var(--accent-soft);color:var(--accent-ink)}\n#hbRoot .rtstage{flex:1 1 0;min-height:0;position:relative;overflow:hidden}\n#hbRoot .rtpaper{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column}\n#hbRoot .rtph{display:none}\n#hbRoot .rtph b{font-size:15px;margin-right:12px}\n#hbRoot .rtph span{font-size:11px;color:var(--muted)}\n#hbRoot .rtph span.dt,#hbRoot .pph span.dt{font-size:15px;font-weight:800;color:#d9480f;margin-right:10px}\n#hbRoot .rtstage.pm{background:var(--surface2);border-radius:10px}\n#hbRoot .rtstage.pm .rtpaper{right:auto;bottom:auto;left:50%;width:1123px;height:794px;margin-left:-561.5px;padding:45px 26px 31px 57px;box-sizing:border-box;transform-origin:50% 0;background:#fff;border:1px solid var(--line);box-shadow:0 2px 14px rgba(0,0,0,.18)}\n#hbRoot .rtstage.pm .rtph{display:block;height:30px;margin-bottom:8px;border-bottom:1px solid #aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:28px;color:#111}\n#hbRoot .rtstage.pm .rtewrap{flex:none;width:1040px;height:680px}\n#hbRoot .rtstage.pm .rtewrap{background:linear-gradient(#cfd5dd,#cfd5dd) var(--d1,340px) 0/1px 100% no-repeat,linear-gradient(#cfd5dd,#cfd5dd) var(--d2,695px) 0/1px 100% no-repeat}\n#hbRoot .ppb{background:linear-gradient(#cfd5dd,#cfd5dd) 340px 0/1px 100% no-repeat,linear-gradient(#cfd5dd,#cfd5dd) 695px 0/1px 100% no-repeat}\n#hbRoot #hbPrint{display:none}\n#hbRoot #hbPrint.mea{display:block;position:fixed;left:-20000px;top:0;width:1123px;visibility:hidden}\n#hbRoot .pp{width:100%;box-sizing:border-box;padding:7mm 0 0 10mm;position:relative;background:#fff;color:#111}\n#hbRoot .pph{width:1040px;height:30px;margin-bottom:8px;border-bottom:1px solid #888;white-space:nowrap;overflow:hidden;line-height:28px}\n#hbRoot .pph b{font-size:15px;margin-right:12px}\n#hbRoot .pph span{font-size:11px;color:#555}\n#hbRoot .pph i{float:right;font-style:normal;font-size:11px;color:#555}\n#hbRoot .ppb{width:1040px;height:680px;overflow:hidden;position:relative}\n#hbRoot .rte3p{cursor:default}\n#hbRoot .rte3p.one .ln{min-height:1.5em}\n#hbRoot .rte3p .ln[data-s^=\"h\"]::after{content:none!important}\n#hbRoot .trrow{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line)}\n#hbRoot .trrow .trt{flex:1;min-width:0;display:grid;gap:2px}\n#hbRoot .trrow .trt b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#hbRoot .qcard{display:flex;flex-direction:column;gap:6px;align-items:flex-start;margin:16px 0 4px;padding:12px 14px;border:1.5px dashed var(--line);border-radius:14px;background:var(--surface)}\n#hbRoot .rtpg{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:800}\n#hbRoot .rtpg .btn:disabled{opacity:.35}\n#hbRoot .rp.c i{color:#15803d}\n#hbRoot .rp.c{color:#15803d}\n#hbRoot .rte3 figure.im{margin:6px 0;position:relative;break-inside:avoid;display:block;-webkit-column-break-inside:avoid}\n#hbRoot .rte3 figure.im img{width:100%;max-width:100%;height:auto;object-fit:cover;box-sizing:border-box;border-radius:10px;border:1.5px solid var(--line);cursor:zoom-in;display:block}\n#hbRoot .rte3 figure.im img.wait{width:100%;height:100px;background:var(--surface2)}\n#hbRoot .rte3 figure.im .rh{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);background:rgba(0,0,0,.6);color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:999px;cursor:ns-resize;user-select:none;touch-action:none;opacity:.85}\n#hbRoot .rte3 figure.im .rhr{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.6);color:#fff;border:0;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;cursor:pointer;opacity:.85}\n#hbRoot .rte3[contenteditable=\"false\"] figure.im .rh,#hbRoot .rte3[contenteditable=\"false\"] figure.im .rhr,#hbRoot .rte3p figure.im .rh,#hbRoot .rte3p figure.im .rhr,#hbRoot .rte3p figure.im .ix{display:none}\n#hbRoot .rte3 figure.im .ix{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:11px;cursor:pointer;line-height:1;padding:0}\n#hbRoot .rte3.isempty::before{content:attr(data-ph);position:absolute;left:10px;top:8px;right:10px;color:var(--muted);pointer-events:none}\n#hbRoot .rtb{display:inline-flex;gap:4px;margin-right:6px}\n#hbRoot .rtb button{border:1.5px solid var(--line);background:var(--surface);border-radius:999px;padding:2px 12px;font-size:12.5px;font-weight:800;cursor:pointer}\n#hbRoot .rtb button#rtk-s{color:#1d4ed8}\n#hbRoot .rtb button#rtk-m{color:#be185d}\n#hbRoot .rtb button[aria-pressed=\"true\"]#rtk-s{background:#3b82f6;border-color:#3b82f6;color:#fff}\n#hbRoot .rtb button[aria-pressed=\"true\"]#rtk-m{background:#ec4899;border-color:#ec4899;color:#fff}\n#hbRoot .n3{flex:1 1 0;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}\n#hbRoot .ncol{display:flex;flex-direction:column;gap:4px;min-height:0;min-width:0}\n#hbRoot .ncol h3{margin:0;font-size:14px;color:var(--accent-ink)}\n#hbRoot .ncol textarea{flex:1 1 0;min-height:110px;resize:none;font-size:15px;line-height:1.8}\n#hbRoot .nph{display:flex;gap:8px;overflow-x:auto;flex:none;padding:2px}\n#hbRoot .ith{position:relative;flex:0 0 auto}\n#hbRoot .ith img{height:70px;width:auto;border-radius:10px;border:1.5px solid var(--line);cursor:zoom-in;display:block}\n#hbRoot .ith img.wait{width:100px;background:var(--surface2)}\n#hbRoot .ith .ix{position:absolute;top:-5px;right:-5px;width:20px;height:20px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font-size:11px;cursor:pointer;line-height:1;padding:0}\n#hbRoot .iact2{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}\n#hbRoot .recmod{position:absolute;inset:0;z-index:40;background:rgba(40,25,60,.38);display:flex;padding:12px;box-sizing:border-box}\n#hbRoot .recsheet{flex:1;min-width:0;min-height:0;background:var(--page);border-radius:18px;display:flex;flex-direction:column;gap:10px;padding:12px 16px;box-sizing:border-box;border:1.5px solid var(--line)}\n#hbRoot .rech2{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n#hbRoot .rech2 h2{margin:0;font-size:17px}\n#hbRoot .rech2 h2 i{font-style:normal;font-size:12.5px;color:var(--muted)}\n#hbRoot .rech2 input{flex:1 1 180px;max-width:320px;min-width:120px;padding:6px 10px}\n#hbRoot .rv{display:inline-flex;gap:2px;background:var(--surface2);border-radius:12px;padding:3px}\n#hbRoot .rv button{border:0;background:transparent;border-radius:9px;padding:5px 12px;font-size:13px;font-weight:800;color:var(--muted);cursor:pointer}\n#hbRoot .rv button[aria-pressed=\"true\"]{background:var(--accent);color:var(--on-accent)}\n#hbRoot .recbody{flex:1 1 0;min-height:0;overflow:auto}\n#hbRoot .rgridc{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;align-content:start}\n#hbRoot .rcard{display:flex;flex-direction:column;gap:5px;text-align:left;border:1.5px solid var(--line);background:var(--surface);border-radius:14px;padding:10px 12px;min-height:150px;cursor:pointer}\n#hbRoot .rcard:hover{border-color:var(--accent)}\n#hbRoot .rch{display:flex;justify-content:space-between;gap:8px;align-items:baseline}\n#hbRoot .rch b{font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#hbRoot .rdate{font-size:11.5px;color:var(--muted);white-space:nowrap}\n#hbRoot .rbd{display:flex;gap:4px;flex-wrap:wrap}\n#hbRoot .rp{font-size:12.5px;line-height:1.5;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#hbRoot .rp i{font-style:normal;font-weight:800;color:var(--accent-ink)}\n#hbRoot .rimg{margin-top:auto;height:64px;width:auto;max-width:100%;object-fit:cover;border-radius:8px;align-self:flex-start}\n#hbRoot .rimg.wait{width:90px;background:var(--surface2)}\n#hbRoot .rbigl{display:flex;flex-direction:column;gap:8px}\n#hbRoot .rbig{display:flex;flex-direction:column;gap:4px;text-align:left;border:1.5px solid var(--line);background:var(--surface);border-radius:14px;padding:12px 16px;cursor:pointer}\n#hbRoot .rbig:hover{border-color:var(--accent)}\n#hbRoot .rbd0{display:flex;justify-content:space-between;gap:10px;align-items:baseline}\n#hbRoot .rbd0 b{font-size:16px}\n#hbRoot .rbig .rp{white-space:normal;font-size:13.5px;line-height:1.6}\n#hbRoot .rgal{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}\n#hbRoot .rgi{position:relative;border:0;padding:0;border-radius:12px;overflow:hidden;background:var(--surface2);cursor:pointer;aspect-ratio:4/3}\n#hbRoot .rgi img{width:100%;height:100%;object-fit:cover;display:block}\n#hbRoot .rgi img.wait{background:var(--surface2)}\n#hbRoot .rgi span{position:absolute;left:0;right:0;bottom:0;padding:14px 8px 5px;background:linear-gradient(transparent,rgba(0,0,0,.6));color:#fff;font-size:12px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#hbRoot .rcalh{display:flex;align-items:center;gap:10px;margin-bottom:8px}\n#hbRoot .rcalh b{font-size:16px;min-width:110px;text-align:center}\n#hbRoot .rcal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}\n#hbRoot .rcw{text-align:center;font-size:12px;font-weight:800;color:var(--muted);padding:2px}\n#hbRoot .rcd{min-height:64px;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:4px 6px;display:flex;flex-direction:column;align-items:flex-start;gap:1px;text-align:left}\n#hbRoot .rcd.off{border-color:transparent;background:transparent}\n#hbRoot .rcd .dn{font-size:12px;font-weight:800;color:var(--muted)}\n#hbRoot .rcd.has{cursor:pointer;border-color:var(--accent)}\n#hbRoot .rcd.has .dn{color:var(--accent-ink)}\n#hbRoot .rcd .cn{font-size:11.5px;font-weight:800;color:var(--accent-ink)}\n#hbRoot .rcd .ct{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}\n#hbRoot .rcd.today{box-shadow:inset 0 0 0 2px var(--accent)}\n#hbRoot .rcd.sel{background:var(--accent-soft)}\n#hbRoot .rcd:disabled{opacity:1;cursor:default}\n#hbRoot .rdayl{margin-top:10px;display:flex;flex-direction:column;gap:6px}\n#hbRoot .rrow.day{grid-template-columns:minmax(120px,.8fr) minmax(0,3fr)}\n#hbRoot .rlist{display:flex;flex-direction:column;gap:4px}\n#hbRoot .rrow{display:grid;grid-template-columns:96px minmax(120px,1.1fr) minmax(120px,.9fr) minmax(0,2.4fr);gap:10px;align-items:center;text-align:left;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:7px 12px;cursor:pointer}\n#hbRoot .rrow:hover{border-color:var(--accent)}\n#hbRoot .rrow.head{background:var(--surface2);font-size:12px;font-weight:800;color:var(--muted);cursor:default;border-color:transparent;position:sticky;top:0}\n#hbRoot .rrow b,#hbRoot .rrow em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-style:normal}\n#hbRoot .rrow em{color:var(--muted);font-size:12.5px}\n#hbRoot .rrow .rd{font-size:12.5px;color:var(--muted)}\n#hbRoot .rrow .rb{display:flex;gap:4px;flex-wrap:wrap}\n#hbRoot .ihl{font-size:15px;white-space:nowrap}\n#hbRoot .bsum{font-size:12.5px;color:var(--muted);font-weight:700}\n#hbRoot .irx{grid-column:1/-1;display:flex;gap:4px;flex-wrap:wrap}\n#hbRoot .dtg.done{background:#dff5e7;color:#1d7a46}\n#hbRoot .mnl{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:700}\n#hbRoot .mnin{width:74px;padding:3px 8px;border:1.5px solid var(--line);border-radius:10px;font-size:13px}\n#hbRoot .chk{border:1.5px solid var(--line);background:var(--surface);border-radius:999px;padding:2px 12px;font-size:12.5px;font-weight:800;cursor:pointer;color:var(--fg)}\n#hbRoot .chk.on{background:#2a8f5a;border-color:#2a8f5a;color:#fff}\n#hbRoot .ipage{max-width:200px}\n#hbRoot .iv>.cfx{flex:1 1 0;min-height:0}\n#hbRoot .ihdr{flex:none;padding:10px 12px}\n#hbRoot .ihdr .dwrap{flex:none;margin-top:6px}\n#hbRoot .ihead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n#hbRoot .ihead h2{margin:0;font-size:15px}\n#hbRoot .ihead input{flex:1 1 160px;min-width:120px;max-width:320px;padding:6px 10px}\n#hbRoot .islides{flex:1 1 0;min-width:0;display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:thin}\n#hbRoot .irow{flex:0 0 200px;scroll-snap-align:start;display:grid;grid-template-columns:1fr auto;gap:2px 8px;text-align:left;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:7px 10px;align-content:start}\n#hbRoot .irow.on{border-color:var(--accent);background:var(--accent-soft)}\n#hbRoot .irow b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}\n#hbRoot .irow em{grid-column:1/-1;font-style:normal;color:var(--muted);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#hbRoot .irow small{grid-column:1/-1;color:var(--muted);font-size:11px}\n#hbRoot .iempty{align-items:center;justify-content:center;text-align:center;gap:6px}\n#hbRoot .ied{gap:5px;padding:6px 10px}\n#hbRoot .irow2.itop{flex-wrap:wrap;gap:6px}\n#hbRoot .irow2.r2{flex-wrap:wrap;gap:6px 8px}\n#hbRoot .irow2.itop .ititle{flex:2 1 220px}\n#hbRoot .irow2.itop .iurl{flex:1 1 150px}\n#hbRoot .irow2.r2 .imsg{font-size:11px;white-space:nowrap}\n#hbRoot .irow2{display:flex;gap:8px;align-items:center}\n#hbRoot .ititle{flex:2 1 0;min-width:0;font-size:16px;font-weight:800;padding:6px 10px}\n#hbRoot .iurl{flex:1 1 0;min-width:0;padding:6px 10px;font-size:13px}\n#hbRoot .isp{flex:1}\n#hbRoot .chips.sm{display:flex;flex-wrap:wrap;gap:4px;align-items:center}\n#hbRoot .chips.sm button{padding:2px 9px;font-size:12px;min-height:0}\n#hbRoot .btn.xs{padding:2px 9px;font-size:12px;min-height:0;border-radius:999px}\n#hbRoot .iedit{flex:1 1 0;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px}\n#hbRoot .ibt{display:block;width:100%;box-sizing:border-box;resize:none;overflow:hidden;border:0;background:transparent;font:inherit;font-size:15px;line-height:1.8;padding:2px 4px;min-height:32px;color:inherit;outline:none;background-image:repeating-linear-gradient(transparent,transparent 26px,var(--line) 27px)}\n#hbRoot .ibt:last-child{flex:1 1 auto;min-height:260px}\n#hbRoot .ibt:focus{background-color:rgba(255,255,255,.55)}\n#hbRoot .ibi{position:relative;align-self:flex-start;max-width:100%}\n#hbRoot .ibi img{max-width:100%;max-height:300px;border-radius:10px;border:1.5px solid var(--line);cursor:zoom-in;display:block}\n#hbRoot .ibi img.wait{width:160px;height:100px;background:var(--surface2)}\n#hbRoot .ibi .ix{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:11px;cursor:pointer;line-height:1;padding:0}\n#hbRoot .imsg{margin:0;font-size:11.5px}\n#hbRoot .ibig{position:absolute;inset:0;z-index:50;background:rgba(0,0,0,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:zoom-out}\n#hbRoot .ibig img{max-width:94vw;max-height:86vh;border-radius:8px}\n#hbRoot .ibig span{color:#fff;font-size:13px}\n#hbRoot .dlist{flex:1 1 0;min-height:60px;overflow:auto;display:grid;gap:6px;align-content:start;margin-top:8px}\n#hbRoot .drow2{display:grid;grid-template-columns:auto auto 1fr;gap:8px;align-items:center;text-align:left;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:7px 10px}\n#hbRoot .drow2.on{border-color:var(--accent);background:var(--accent-soft)}\n#hbRoot .drow2 b{font-size:12.5px;white-space:nowrap}\n#hbRoot .drow2 em{font-style:normal;color:var(--muted);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}\n@media (min-width:900px) and (min-height:520px){#hbRoot.fit .fitbox>.dy,#hbRoot.fit .fitbox>.iv{flex:1;min-height:0}}\n@media (max-width:899px){#hbRoot .d3{grid-template-columns:1fr}\n#hbRoot .dbody3{grid-template-columns:1fr}\n#hbRoot .n3{grid-template-columns:1fr}\n#hbRoot .rrow{grid-template-columns:80px 1fr}\n#hbRoot .rrow .rb,#hbRoot .rrow em,#hbRoot .rrow.head span:nth-child(n+3){display:none}\n#hbRoot .dmain{min-height:200px}\n#hbRoot .dsl{flex-basis:260px}\n#hbRoot .dlist{max-height:280px}\n#hbRoot .sf.grow textarea{min-height:150px}}\n@page{size:A4 landscape;margin:5mm}\n@media print{\n  html,body{height:auto !important;overflow:visible !important;background:#fff !important}\n  html body>*:not(#hbRoot){display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important}\n  html body>#v43FabHeader,html body>#v43FabDiary{display:none !important;visibility:hidden !important}\n  html body>#hbRoot.open{position:static !important;display:block !important;overflow:visible !important;background:#fff !important;padding:0 !important;inset:auto !important}\n  html body>#hbRoot.open .hbwrap>*:not(#hbPrint){display:none !important}\n  html body>#hbRoot.open .hbwrap{padding:0 !important;margin:0 !important;height:auto !important;min-height:0 !important;display:block !important}\n  html body{margin:0 !important;padding:0 !important}\n  html body>#hbRoot.open #hbPrint{display:block !important}\n  html body>#hbRoot.open #hbPrint *{-webkit-print-color-adjust:exact;print-color-adjust:exact}\n  html body>#hbRoot.open .pp{page-break-after:always;break-after:page}\n  html body>#hbRoot.open .pp:last-child{page-break-after:auto;break-after:auto}\n}\n\n#hbRoot .hbnav{font-weight:800;font-size:15px;padding:7px 16px;border-radius:999px;line-height:1.2}\n#hbRoot .hbnav.hbq{background:#fef3c7;color:#92400e}\n#hbRoot .hbnav.hbdiary{background:#ede9fe;color:#6d28d9}\n#hbRoot .hbnav.hbdiary.on{background:#7c3aed;color:#fff;box-shadow:0 2px 6px rgba(124,58,237,.35)}\n#hbRoot #hbSync{margin-left:6px}\n#hbRoot .irow2.r2{flex-wrap:nowrap}\n#hbRoot .irow2.r2 .imsg{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;min-width:40px;flex:0 1 auto}\n#hbRoot .irow2.r2 .rtw{flex:0 1 auto;min-width:0;flex-wrap:wrap}\n#hbRoot .rtpg select{width:auto;font-size:12px;padding:2px 4px}\n#hbRoot .bchips{flex:none}\n#hbRoot .rtpg{white-space:nowrap;flex:none}\n#hbRoot .mnl{white-space:nowrap}#hbRoot .mnin{width:74px!important;flex:none}\n#hbRoot .hbnav[data-v=\"work\"]{background:#dbeafe;color:#1e40af}\n#hbRoot .hbnav[data-v=\"personal\"]{background:#fde1ef;color:#be185d}\n#hbRoot{position:fixed;inset:0;z-index:2147483200;display:none;overflow:auto;margin:0}\n#hbRoot.open{display:block}\n#hbRoot [hidden]{display:none !important}\n#hbRoot .hbbanner{background:var(--accent-soft);color:var(--accent-ink);border-radius:12px;padding:8px 14px;font-size:13px;font-weight:600;margin-bottom:8px;flex:none}\n#hbRoot #hbSync.bad{background:color-mix(in srgb,var(--bad) 14%,var(--surface));color:var(--bad)}\n#hbRoot .hbclose{margin-left:6px}\n#hbRoot .lockbox{max-width:360px;margin:10vh auto 0;text-align:center;display:grid;gap:10px}\n#hbRoot .lockic{font-size:44px;line-height:1}\n#hbRoot .lockbox input{text-align:center;font-size:22px;letter-spacing:.25em}\n#hbRoot .lkpanel{display:grid;gap:10px;background:var(--surface2);border-radius:12px;padding:12px}\n#hbRoot .lkin{letter-spacing:.2em}\n";
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
   자료실 글은 코드를 켜면 코드로 암호화해서 저장한다(AES-GCM, 키는 PBKDF2 로 코드에서 만든다).
   습관 이름·횟수·시각은 암호화하지 않는다. */
var CACHE_KEY='hb_cache_v1',COL_DEFS='habit_defs',COL_LOGS='habit_logs',COL_META='habit_meta',COL_INV='habit_invest',COL_IMG='habit_invest_img';
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
function mapTexts(fn,withMemo){
  var jobs=[];
  Object.keys(S.note).forEach(function(d){var n=S.note[d];TEXTF.forEach(function(f){if(typeof n[f]==='string')jobs.push(fn(n[f]).then(function(v){n[f]=v;}));});});
  if(withMemo)Object.keys(S.memo).forEach(function(d){Object.keys(S.memo[d]).forEach(function(id){var m=S.memo[d][id];if(typeof m.t==='string')jobs.push(fn(m.t).then(function(v){m.t=v;}));});});
  Object.keys(SY.note).forEach(function(d){
    var n=JSON.parse(SY.note[d]),pend=[];
    TEXTF.forEach(function(f){if(typeof n[f]==='string')pend.push(fn(n[f]).then(function(v){n[f]=v;}));});
    jobs.push(Promise.all(pend).then(function(){SY.note[d]=JS(n);}));
  });
  if(withMemo)Object.keys(SY.m).forEach(function(d){Object.keys(SY.m[d]).forEach(function(id){
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
  },true);
}
/* 예전에 암호화돼 올라간 습관 메모가 있는지(지금은 습관 메모는 암호화하지 않는다) */
function hasEncMemo(){
  var f=false;
  Object.keys(S.memo).forEach(function(d){Object.keys(S.memo[d]).forEach(function(id){if(isEnc(S.memo[d][id].t))f=true;});});
  return f;
}
/* 풀린 습관 메모를 평문으로 클라우드에 다시 쓴다(한 번만) */
function migrateMemos(){
  if(!hasDb())return Promise.resolve();
  var patches={};
  Object.keys(S.memo).forEach(function(d){Object.keys(S.memo[d]).forEach(function(id){
    var t=S.memo[d][id].t;if(typeof t==='string'&&t!==''&&!isEnc(t)){var p=patches[d]=patches[d]||{memo:{}};p.memo[id]={t:t};}
  });});
  var dates=Object.keys(patches),chunks=[],i;
  for(i=0;i<dates.length;i+=400)chunks.push(dates.slice(i,i+400));
  return chunks.reduce(function(p,ch){
    return p.then(function(){
      var b=db.batch(),ts=FV().serverTimestamp();
      ch.forEach(function(d){b.set(db.collection(COL_LOGS).doc(d),Object.assign({date:d,updatedAt:ts},patches[d]),{merge:true});});
      return b.commit();
    });
  },Promise.resolve());
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
  Object.keys(y2.note).forEach(function(d){var n=JSON.parse(y2.note[d]);cleanNote(n);if(Object.keys(n).length)y2.note[d]=JS(n);else delete y2.note[d];});
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
function defOf(h){return {mode:h.mode||'',lim:h.lim||0,goal:h.goal||0,name:h.name,icon:h.icon,color:h.color||0,type:h.type,n:h.n||1,perDay:h.perDay||1,unit:h.unit||'',at:h.at||'',every:h.every||0,start:h.start,end:h.end||'',order:h.order==null?0:h.order};}
function habitFrom(id,d){return {id:id,mode:d.mode||'',lim:d.lim||0,goal:d.goal||0,name:d.name||'',icon:d.icon||'✨',color:d.color||0,type:d.type||'daily',n:d.n||1,perDay:d.perDay||1,unit:d.unit||'',at:d.at||'',every:d.every||0,start:d.start||TODAY,end:d.end||null,order:d.order==null?0:d.order};}

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
  var lb=$('#hbLockBtn');if(lb)lb.hidden=!(LK.enabled&&LK.key&&ui.sp==='diary');
}
function errText(e){
  var c=(e&&e.code)||'';
  if(c==='permission-denied')return '권한 없음: Firestore 규칙에서 habit_defs · habit_logs · habit_meta · habit_invest · habit_invest_img 컬렉션이 막혀 있어요. 규칙을 확인해 주세요.';
  if(c==='unavailable')return '인터넷 연결을 확인해 주세요. 연결되면 자동으로 다시 올려요.';
  return String((e&&e.message)||e||'알 수 없는 오류').slice(0,120);
}

/* 바뀐 칸 계산 */
/* 병합 저장(merge)은 '없어진 칸'을 지워 주지 않는다 — 지운 칸은 DELM 으로 따로 표시해서 보낸다 */
function fieldDiff(cur,old){
  var out={},keys={};
  Object.keys(cur).concat(Object.keys(old||{})).forEach(function(k){keys[k]=1;});
  Object.keys(keys).forEach(function(k){
    if(cur[k]===undefined)out[k]=DELM;
    else if(JS(cur[k])!==JS((old||{})[k]))out[k]=cur[k];
  });
  return out;
}
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
        var pv;
        if(cj===undefined)pv=DELM;
        else if(f[0]==='memo'&&old[id]!==undefined)pv=fieldDiff(cur[id],JSON.parse(old[id]));
        else pv=cur[id];
        (patch[f[2]]=patch[f[2]]||{})[id]=pv;
        apply.push([f[1],d,id,cj]);
      });
    });
    var mj=S.mood[d]===undefined?undefined:JS(S.mood[d]);
    if(mj!==SY.mood[d]){patch.mood=mj===undefined?DELM:S.mood[d];apply.push(['mood',d,null,mj]);}
    var nj=S.note[d]===undefined?undefined:JS(S.note[d]);
    if(nj!==SY.note[d]){
      patch.note=nj===undefined?DELM:(SY.note[d]===undefined?S.note[d]:fieldDiff(S.note[d],JSON.parse(SY.note[d])));
      apply.push(['note',d,null,nj]);
    }
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
  return plain;
}
function encPatch(patch,key){
  var out=JSON.parse(JS(patch)),jobs=[];
  function enc(o,k){var v=o&&o[k];if(typeof v==='string'&&v!==DELM&&v!==''&&!isEnc(v))jobs.push(encStr(key,v).then(function(c){o[k]=c;}));}
  if(out.note&&typeof out.note==='object')TEXTF.forEach(function(f){enc(out.note,f);});
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
  if(a&&r.contains(a)&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.isContentEditable)){ST.pendingRender=true;return;}
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
  db.collection(COL_INV).onSnapshot(function(snap){
    INVERR='';
    Promise.all(snap.docChanges().map(function(c){
      var id=c.doc.id;
      if(INVP[id])return Promise.resolve();
      if(c.type==='removed'){delete INVR[id];delete INV[id];return Promise.resolve();}
      var raw=c.doc.data();raw.id=id;delete raw.updatedAt;INVR[id]=raw;
      if(INV[id]&&(INV[id].m||0)>=(raw.m||0))return Promise.resolve();      /* 내가 방금 올린 글이 돌아온 것 — 화면을 다시 그리지 않는다 */
      return invDecode(raw).then(function(n){INV[id]=n;});
    })).then(function(){softRender();});
  },function(e){INVERR='투자 메모를 불러오지 못했어요: '+errText(e);softRender();});
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
  if(mode!=='enc')Object.keys(S.memo).forEach(function(d){Object.keys(S.memo[d]).forEach(function(id){
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
/* 코드를 켜거나 끌 때 자료실 일기 사진도 같이 암호화/평문으로 바꿔 다시 쓴다 */
function dyImgIds(){
  var ids={};
  Object.keys(S.note).forEach(function(d){
    var bx=S.note[d].bx;if(typeof bx!=='string'||isEnc(bx))return;
    var o=null;try{o=JSON.parse(bx);}catch(e){return;}
    ((o&&o.im)||[]).forEach(function(i){if(i&&!/^data:/.test(i))ids[i]=1;});
    ((o&&o.bl)||[]).forEach(function(x){if(x&&x.k==='i'&&x.v&&!/^data:/.test(x.v))ids[x.v]=1;});
  });
  return Object.keys(ids);
}
function dyImgRewrite(mode){
  if(!hasDb())return Promise.resolve();
  return dyImgIds().reduce(function(p,id){
    return p.then(function(){
      return db.collection(COL_IMG).doc(id).get().then(function(d){
        if(!d||!d.exists)return;
        var x=d.data(),v=x.d;
        if(mode==='enc'){
          if(isEnc(v))return;
          return encStr(LK.key,v).then(function(c){return db.collection(COL_IMG).doc(id).set({id:id,d:c,updatedAt:FV().serverTimestamp()});});
        }
        if(!isEnc(v))return;
        return decStr(LK.key,v).then(function(u){return db.collection(COL_IMG).doc(id).set({id:id,d:u,updatedAt:FV().serverTimestamp()});});
      });
    });
  },Promise.resolve());
}
function enableLock(code,type){
  var salt=b64e(crypto.getRandomValues(new Uint8Array(16))),iter=210000;
  ST.hold=true;
  return deriveKey(code,salt,iter).then(function(key){
    return encStr(key,'hb-check').then(function(check){
      return loadAll().then(function(){
        LK.salt=salt;LK.type=type;LK.iter=iter;LK.check=check;LK.key=key;LK.enabled=true;
        return db.collection(COL_META).doc('security').set({enabled:true,type:type,salt:salt,iter:iter,check:check,updatedAt:FV().serverTimestamp()}).catch(function(e){LK.enabled=false;LK.key=null;throw e;});
      }).then(function(){return rewriteTexts('enc');}).then(function(){return dyImgRewrite('enc');});
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
      return rewriteTexts('plain').then(function(){return dyImgRewrite('plain');});
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
    Object.keys(INV).forEach(function(id){if(INV[id]&&INV[id].k==='diary')delete INV[id];});   /* 풀려 있던 일기 글·사진은 메모리에서 지운다 */
    Object.keys(DYIMG).forEach(function(id){delete IMGC[id];});
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
    var enc0=hasEncMemo();
    return decryptAllMemory().then(invDecodeAll).then(function(){return enc0?migrateMemos():null;});
  }).then(function(){
    LK.busy=false;LK.msg='';touchIdle();updateSync();render();
    ST.pendingFlush=true;clearTimeout(ST.timer);ST.timer=setTimeout(flush,200);
  }).catch(function(){
    LK.busy=false;LK.key=null;LK.fails++;
    if(LK.fails>=5)LK.until=Date.now()+Math.min(300000,30000*Math.pow(2,LK.fails-5));
    msg('접속 코드가 맞지 않아요'+(LK.fails>=5?' · '+Math.ceil((LK.until-Date.now())/1000)+'초 기다려 주세요':''));
    var i=$('#hbCode');if(i){i.value='';i.focus();}
  });
}

/* 잠금 화면 / 설정 카드 */
function lockHtml(){
  return '<div class="card lockbox"><div class="lockic">🔑</div><h2>접속 코드</h2><p class="note" style="margin:0">'+(LK.type==='pin'?'숫자 6자리 코드를 입력하세요':'코드를 입력하세요')+'</p>'
    +'<input type="password" id="hbCode" data-f="code" autocomplete="off" '+(LK.type==='pin'?'inputmode="numeric" maxlength="6" placeholder="● ● ● ● ● ●"':'placeholder="비밀번호"')+'>'
    +'<button class="btn pri" type="button" data-act="unlock">들어가기</button><div class="note" id="hbLockMsg" style="min-height:1.4em">'+esc(LK.msg||'')+'</div></div>';
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
    +'<div class="acts"><button class="btn sm pri" type="button" data-act="lkgo">'+(m==='on'?'코드 켜기':m==='off'?'코드 끄기':'코드 바꾸기')+'</button><button class="btn sm" type="button" data-act="lkcancel">취소</button></div></div>';
  return s;
}
function lockCardHtml(){
  var s='<div class="card fgrid"><h2 style="margin:0">접속 코드 설정</h2>';
  if(LK.enabled){
    s+='<p class="note" style="margin:0">접속 코드가 <b>켜져 있어요</b> ('+(LK.type==='pin'?'숫자 6자리':'글자 코드')+'). 이 화면의 글은 이 코드로 암호화돼서 저장돼요.</p>'
      +'<div style="display:flex;gap:10px;flex-wrap:wrap"><label class="fl" style="flex:1 1 150px">자동 종료<select class="f" data-f="lkidle">'
      +[[0,'끔'],[1,'1분'],[5,'5분'],[15,'15분']].map(function(o){return '<option value="'+o[0]+'"'+(LK.idleMin===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')
      +'</select></label><label class="fl" style="flex:1 1 150px">이 화면을 닫을 때<select class="f" data-f="lkclose"><option value="1"'+(LK.lockOnClose?' selected':'')+'>바로 나가기</option><option value="0"'+(LK.lockOnClose?'':' selected')+'>유지하기</option></select></label></div>'
      +(ui.lkpanel?'':'<div class="acts"><button class="btn sm" type="button" data-act="lknow">지금 나가기</button><button class="btn sm" type="button" data-act="lkchange">코드 바꾸기</button><button class="btn sm warn" type="button" data-act="lkoff">코드 끄기</button></div>');
  }else{
    s+='<p class="note" style="margin:0">코드를 켜면 이 화면에 들어올 때마다 코드를 묻고, 글을 암호화해서 저장해요.</p>'+(ui.lkpanel?'':'<div class="acts"><button class="btn sm pri" type="button" data-act="lkon"> 코드 켜기</button></div>');
  }
  if(ui.lkpanel)s+=lkPanelHtml();
  else if(ui.lkmsg)s+='<p class="note" style="margin:0;color:var(--ok)">'+esc(ui.lkmsg)+'</p>';
  return s+'<p class="note" style="margin:0">⚠ 코드를 잊으면 암호화된 글은 되살릴 수 없어요. 습관·메모는 암호화되지 않아요. 클라우드 접근 자체를 막으려면 Firebase 로그인과 규칙이 따로 필요해요.</p></div>';
}
function lockAct(a,b){
  if(a==='unlock'){var inp=$('#hbCode');doUnlock(inp?inp.value:'');return true;}
  if(a==='lknow'){lockNow();return true;}
  if(a==='lkon'||a==='lkchange'||a==='lkoff'){ui.lkpanel=a.slice(2);ui.lkmsg='';ui.lktype=ui.lktype||'pin';render();return true;}
  if(a==='lkset'){ui.lkopen=!ui.lkopen;ui.lkpanel=null;ui.lkmsg='';render();return true;}
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
    LK.busy=false;ui.lkpanel=null;ui.lkmsg=mode==='off'?'코드를 껐어요':mode==='change'?'코드를 바꿨어요':'코드를 켰어요';
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



/* ───────── 💹 투자 메모 — 일기와 따로, 메모 한 건 = 문서 한 개(habit_invest) ─────────
   투자 메모는 코드 잠금과 상관없이 암호화하지 않고 저장한다(달님 결정). 이 기기에는 따로 저장하지 않는다(사진이 커서). 문서 하나는 약 1MB 한도라 사진을 줄여서 넣는다. */
var INV={},INVR={},INVP={},INVV={},INVERR='',invTimer=null,INVF=['t','b','u','g'],INV_MAX=900000;
function invDec(v,strict){
  if(!isEnc(v))return Promise.resolve(v==null?'':v);
  if(!LK.key)return strict?Promise.reject(new Error('잠겨 있어요')):Promise.resolve('');
  return decStr(LK.key,v).catch(function(e){if(strict)throw new Error('풀지 못한 투자 메모가 있어요');return '';});
}
function invDecode(raw,strict){
  return Promise.all(INVF.map(function(f){return invDec(raw[f],strict);}).concat([Promise.all((raw.im||[]).map(function(x){return invDec(x,strict);}))])).then(function(r){
    var n={id:raw.id,c:raw.c||0,m:raw.m||0,k:raw.k||'',mn:raw.mn>0?+raw.mn:0,dn:!!raw.dn};
    if(raw.del>0)n.del=+raw.del;
    ['x1','x2','x3'].forEach(function(f){if(raw[f]!==undefined)n[f]=raw[f];});
    INVF.forEach(function(f,i){n[f]=r[i];});
    n.im=r[INVF.length].filter(Boolean);
    n.bl=(Array.isArray(raw.bl)&&raw.bl.length)?raw.bl.map(function(x){return Object.assign({},x);}):null;
    return n;
  });
}
function invEncField(v){
  if(typeof v!=='string'||v===''||isEnc(v))return Promise.resolve(v==null?'':v);
  return encStr(LK.key,v);
}
function invToRaw(n,encrypt){
  encrypt=false;   /* 투자 메모는 잠금과 상관없이 암호화하지 않는다(달님 결정) */
  var doc={id:n.id,c:n.c||Date.now(),m:n.m||Date.now(),k:n.k||'',mn:n.mn>0?+n.mn:0,dn:!!n.dn};
  if(n.del>0)doc.del=+n.del;
  ['x1','x2','x3'].forEach(function(f){if(n[f]!==undefined)doc[f]=String(n[f]);});
  if(!encrypt){INVF.forEach(function(f){doc[f]=n[f]||'';});doc.im=(n.im||[]).slice();doc.bl=(n.bl||[]).map(function(x){return Object.assign({},x);});return Promise.resolve(doc);}
  return Promise.all(INVF.map(function(f){return invEncField(n[f]||'');}).concat([Promise.all((n.im||[]).map(invEncField))])).then(function(r){
    INVF.forEach(function(f,i){doc[f]=r[i];});doc.im=r[INVF.length];return doc;
  });
}
function invPrepare(id){
  var n=INV[id];
  if(!n)return Promise.reject(new Error('없는 메모'));
  return invToRaw(n,false);
}
function invDecodeAll(){
  return Promise.all(Object.keys(INVR).filter(function(id){return !INVP[id];}).map(function(id){
    return invDecode(INVR[id]).then(function(n){INV[id]=n;});
  }));
}
function invSave(id,f){
  if((INV[id]&&INV[id].k==='diary')||(f&&f.k==='diary'))return dySave(id,f);   /* 자료실 일기는 그날 기록(habit_logs)에 저장 */
  INV[id]=Object.assign({id:id,c:Date.now(),im:[]},INV[id],f,{m:Date.now()});
  INVP[id]=true;INVV[id]=(INVV[id]||0)+1;
  if(ST.state!=='error')setState('dirty');
  clearTimeout(invTimer);invTimer=setTimeout(invFlushAll,900);
}
function invDelete(id){
  ((INV[id]&&INV[id].im)||(INVR[id]&&INVR[id].im)||[]).forEach(invImgDrop);
  delete INV[id];delete INVP[id];
  var had=INVR[id];delete INVR[id];
  if(had&&hasDb())db.collection(COL_INV).doc(id).delete().catch(function(e){setState('error',errText(e));});
}
/* 휴지통: 지운 메모는 30일 동안 보관(del = 지운 때). 30일이 지나면 그때 완전히 지운다 */
var TRASH_MS=30*86400000;
function invTrashIt(id){if(INV[id])invSave(id,{del:Date.now()});}
function invRestore(id){if(INV[id])invSave(id,{del:0});}
function invPurge(){
  var now=Date.now();
  Object.keys(INV).forEach(function(id){var n=INV[id];if(n&&n.del>0&&now-n.del>TRASH_MS)invDelete(id);});
}
function invFlushOne(id){
  var v=INVV[id];
  return (INV[id]?invPrepare(id):Promise.resolve(INVR[id])).then(function(raw){
    if(!raw)return;
    if(JS(raw).length>INV_MAX){var e=new Error('이 메모가 너무 커서 저장하지 못했어요. 사진을 줄여 주세요.');throw e;}
    INVR[id]=raw;
    if(!hasDb())return;
    return db.collection(COL_INV).doc(id).set(Object.assign({updatedAt:FV().serverTimestamp()},raw)).then(function(){if(INVV[id]===v)delete INVP[id];});
  });
}
function invFlushAll(){
  clearTimeout(invTimer);
  var ids=Object.keys(INVP);
  if(!ids.length)return Promise.resolve();
  if(!hasDb()){setState('local');return Promise.resolve();}
  return ids.reduce(function(p,id){return p.then(function(){return invFlushOne(id);});},Promise.resolve()).then(function(){
    if(!Object.keys(INVP).length&&!computeOps().length)setState('saved');
    else if(Object.keys(INVP).length){invTimer=setTimeout(invFlushAll,900);}
  }).catch(function(e){
    setState('error',errText(e));
    clearTimeout(invTimer);invTimer=setTimeout(invFlushAll,15000);
  });
}
/* 잠그기 직전: 아직 못 올린 메모는 암호화해서 보관해 두고(INVR), 평문은 메모리에서 지운다 */
function invStash(){
  return Promise.all(Object.keys(INVP).filter(function(id){return INV[id];}).map(function(id){
    return invPrepare(id).then(function(raw){INVR[id]=raw;}).catch(function(){});
  }));
}
/* 잠금을 켜거나 끌 때, 클라우드에 있는 모든 투자 메모를 다시 쓴다. mode 'enc' | 'plain' */
function invRewrite(mode){
  if(!hasDb())return Promise.resolve();
  return db.collection(COL_INV).get().then(function(snap){
    var arr=[];snap.forEach(function(d){var r=d.data();r.id=d.id;delete r.updatedAt;arr.push(r);});
    return arr.reduce(function(p,raw){
      return p.then(function(){
        return invDecode(raw,true).then(function(n){return invToRaw(n,mode==='enc');});
      }).then(function(doc){
        INVR[doc.id]=doc;
        return db.collection(COL_INV).doc(doc.id).set(Object.assign({updatedAt:FV().serverTimestamp()},doc));
      });
    },Promise.resolve());
  });
}

/* 사진은 메모 문서와 따로, 한 장이 문서 하나(habit_invest_img). 메모에는 사진 번호표만 적어서 메모 하나에 사진을 여러 장 넣을 수 있다.
   (예전 방식으로 메모 안에 직접 들어 있는 사진도 그대로 보인다) */
var IMGC={},IMGQ={};
function imgSrc(x){return /^data:/.test(x||'')?x:(IMGC[x]||'');}
var DYIMG={};   /* 자료실 일기 사진 번호(잠글 때 메모리에서 지운다) */
function invImgPut(url){
  var id='i'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),dy=ui.tab==='diary';
  IMGC[id]=url;if(dy)DYIMG[id]=1;
  if(!hasDb())return Promise.resolve(id);
  var enc=dy&&LK.enabled&&LK.key;
  return (enc?encStr(LK.key,url):Promise.resolve(url)).then(function(d){
    return db.collection(COL_IMG).doc(id).set({id:id,d:d,updatedAt:FV().serverTimestamp()});
  }).then(function(){return id;});
}
function invImgDrop(id){
  if(!id||/^data:/.test(id))return;
  delete IMGC[id];
  if(hasDb())db.collection(COL_IMG).doc(id).delete().catch(function(){});
}
/* 화면에 나온 사진 중 아직 안 받은 것만 받아서, 그 자리의 그림만 바꿔 끼운다(글 쓰던 칸은 건드리지 않는다) */
function invImgEnsure(ids){
  if(!hasDb())return;
  (ids||[]).forEach(function(id){
    if(!id||/^data:/.test(id)||IMGC[id]||IMGQ[id])return;
    IMGQ[id]=1;
    db.collection(COL_IMG).doc(id).get().then(function(d){
      delete IMGQ[id];
      if(!d||!d.exists)return;
      var x=d.data();
      var show=function(u){
        IMGC[id]=u;
        var els=document.querySelectorAll('img[data-iid="'+id+'"]'),i;
        for(i=0;i<els.length;i++){els[i].src=u;els[i].classList.remove('wait');}
      };
      if(isEnc(x.d)){                                   /* 잠긴 일기 사진: 코드가 풀려 있을 때만 풀어서 보여 준다 */
        if(!LK.key)return;
        DYIMG[id]=1;
        return decStr(LK.key,x.d).then(show,function(){});
      }
      show(x.d);
    }).catch(function(){delete IMGQ[id];});
  });
}

/* ───────── 습관 모델 도우미 ───────── */
var modeOf=function(h){return h.mode==='avoid'||h.mode==='count'||h.mode==='amount'?h.mode:'do';};
var perDay=function(h){return modeOf(h)!=='do'?1:(h.perDay>1?h.perDay:1);};
var limOf=function(h){return h.lim>0?h.lim:0;};
var goalOf=function(h){return h.goal>0?h.goal:0;};
var isTrack=function(h){var m=modeOf(h);return (m==='count'||m==='amount')&&!goalOf(h);};
var colOf=function(h){return h.color>=1&&h.color<=8?h.color:(S.habits.indexOf(h)%8)+1;};
function planned(h){
  if(!/^\d\d:\d\d$/.test(h.at||''))return null;
  var b=hm2min(h.at),st=(h.every>0?h.every:0)*60,n=perDay(h),a=[];
  for(var i=0;i<n;i++)a.push(i===0||st>0?min2hm(b+i*st):'');
  return a;
}

/* ───────── 계산 ───────── */
var isAct=function(h,d){return d>=h.start&&(!h.end||d<=h.end);};
var rawN=function(h,d){return (S.logs[d]&&S.logs[d][h.id])||0;};   /* -1 = 참기 습관을 '오늘 안 했어요'로 확인함 */
var getN=function(h,d){var v=rawN(h,d);return v>0?v:0;};
var decided=function(h,d){return rawN(h,d)!==0;};
var chk=function(h,d){
  var m=modeOf(h),n=getN(h,d);
  if(m==='avoid')return rawN(h,d)===-1||(n>0&&n<=limOf(h));
  if(m==='count'||m==='amount')return goalOf(h)?n>=goalOf(h):n>0;
  return n>=perDay(h);
};
var frac=function(h,d){
  var m=modeOf(h),n=getN(h,d);
  if(m==='avoid')return chk(h,d)?1:0;
  if(m==='count'||m==='amount')return goalOf(h)?Math.min(n,goalOf(h))/goalOf(h):(n>0?1:0);
  return Math.min(n,perDay(h))/perDay(h);
};
var getT=function(h,d){return (S.times[d]&&S.times[d][h.id])||[];};
function setT(h,d,arr){
  var m=S.times[d]=S.times[d]||{};
  if(arr.length)m[h.id]=arr;else{delete m[h.id];if(!Object.keys(m).length)delete S.times[d];}
}
function addDose(h,d){
  var L=S.logs[d]=S.logs[d]||{},n=getN(h,d),t=getT(h,d).slice();
  L[h.id]=Math.min(n+1,99);
  while(t.length<n)t.push('');
  var pl=modeOf(h)==='do'?planned(h):null;
  t.push(d===TODAY?nowHM():((pl&&pl[n])||''));
  setT(h,d,t);
}
function addAmount(h,d,min){
  min=Math.max(1,Math.min(1440,Math.round(+min)||0));
  var L=S.logs[d]=S.logs[d]||{},n=getN(h,d),t=getT(h,d).slice();
  L[h.id]=Math.min(n+min,9999);
  t.push((d===TODAY?nowHM():'00:00')+'*'+min);
  setT(h,d,t);
}
function removeDose(h,d,idx){
  var L=S.logs[d];if(!L||!(L[h.id]>0))return;
  var n=L[h.id],t=getT(h,d).slice();
  if(modeOf(h)==='amount'){
    var k=idx==null?t.length-1:idx,m=parseInt(String(t[k]||'').split('*')[1],10)||0;
    t.splice(k,1);n=Math.max(0,n-m);
  }else{
    while(t.length<n)t.push('');
    t.splice(idx==null?n-1:idx,1);n--;
  }
  if(n<=0)delete L[h.id];else L[h.id]=n;
  if(!Object.keys(L).length)delete S.logs[d];
  setT(h,d,t);
}
function toggleClean(h,d){
  var L=S.logs[d]=S.logs[d]||{};
  if(L[h.id]===-1)delete L[h.id];else if(!getN(h,d))L[h.id]=-1;
  if(!Object.keys(L).length)delete S.logs[d];
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
  var hs=S.habits.filter(function(h){return openOn(h,d)&&!isTrack(h);});
  var fr=0,full=0;
  hs.forEach(function(h){fr+=frac(h,d);if(chk(h,d))full++;});
  return {done:full,total:hs.length,rate:hs.length?fr/hs.length:null};
}
function hStat(h,from,to){
  if(isTrack(h))return {done:0,goal:0,rate:null};
  var hi=to<TODAY?to:TODAY,done=0,goal=0;
  var lo=from>h.start?from:h.start,end=(h.end&&h.end<hi)?h.end:hi;
  if(modeOf(h)==='avoid'&&end===TODAY&&!decided(h,TODAY))end=addDays(TODAY,-1);
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
var freqText=function(h){var m=modeOf(h);if(m==='avoid')return limOf(h)?'참기 · 하루 '+limOf(h)+(h.unit||'번')+' 이하':'참기 · 한 번도 안 하기';if(m==='count')return '횟수 세기'+(goalOf(h)?' · 하루 '+goalOf(h)+(h.unit||'번')+' 이상':'');if(m==='amount')return '시간 재기'+(goalOf(h)?' · 하루 '+goalOf(h)+'분 이상':'');return (h.type==='daily'?'매일':h.type==='week'?'주 '+h.n+'회':'월 '+h.n+'회')+(perDay(h)>1?' · 하루 '+perDay(h)+(h.unit||'회'):'');};
function subText(h){
  if(modeOf(h)!=='do')return freqText(h);
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
var ui={sp:'habit',tab:'day',date:TODAY,month:TODAY.slice(0,7),year:+TODAY.slice(0,4),armed:null,icon:'✨',color:1,showExport:false,modal:null,pop:null,focusModal:false};
var TABS=[['diary','🗂 자료실'],['book','📚 독서'],['inv','💹 투자'],['day','하루'],['week','주간'],['month','월간'],['year','년간'],['manage','관리']];
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
function bodyHtml(x,d,future){
  var m=modeOf(x);if(m==='do')return stampsHtml(x,d,future);
  var n=getN(x,d),u=m==='amount'?'분':(x.unit||'번'),ts=getT(x,d),dis=future?' disabled':'';
  var at=' data-id="'+x.id+'" data-date="'+d+'"';
  var s='<div class="mbody">';
  if(m==='avoid'){
    var lim=limOf(x),bad=n>lim,clean=rawN(x,d)===-1;
    s+='<div class="mbig'+(bad?' bad':(n>0||clean)?' ok':'')+'"><b>'+n+'</b><span>/ 한도 '+lim+u+'</span></div>'
      +(bad?'<div class="mflag bad">⚠ 한도를 넘었어요</div>':clean?'<div class="mflag ok">✓ 안 했다고 확인했어요</div>':n>0?'<div class="mflag ok">한도 안이에요</div>':'<div class="mflag">'+(d===TODAY?'아직 확인 전이에요':future?'':'확인 안 한 날')+'</div>')
      +'<div class="mact"><button type="button" class="mbtn2 bad" data-act="avplus"'+at+dis+'>＋ 했어요</button>'
      +(n===0?'<button type="button" class="mbtn2 ok'+(clean?' on':'')+'" data-act="avclean"'+at+dis+'>'+(clean?'✓ 확인함 (취소)':'✓ 오늘 안 했어요')+'</button>':'')+'</div>';
  }else if(m==='count'){
    var g=goalOf(x);
    s+='<div class="mbig'+(g&&n>=g?' ok':'')+'"><b>'+n+'</b><span>'+(g?'/ 목표 '+g+u:u)+'</span></div>'
      +'<div class="mact"><button type="button" class="mbtn2 ok" data-act="cplus"'+at+dis+'>＋ 1</button><button type="button" class="mbtn2" data-act="cminus"'+at+(n&&!future?'':' disabled')+'>− 1</button></div>';
  }else{
    var g2=goalOf(x);
    s+='<div class="mbig'+(g2&&n>=g2?' ok':'')+'"><b>'+n+'</b><span>'+(g2?'/ 목표 '+g2+'분':'분')+'</span></div>'
      +'<div class="mact"><input type="number" class="amin" min="1" max="1440" inputmode="numeric" placeholder="몇 분" id="am-'+x.id+'"'+at+dis+'><button type="button" class="mbtn2 ok" data-act="amadd"'+at+dis+'>＋ 추가</button></div>'
      +'<div class="mlist">'+ts.map(function(t,i){var p=String(t).split('*');return '<span class="mchip">'+(p[0]&&p[0]!=='00:00'?p[0]+' · ':'')+(p[1]||'?')+'분<button type="button" data-act="dose-del"'+at+' data-i="'+i+'" aria-label="기록 삭제">✕</button></span>';}).join('')+'</div>';
  }
  return s+'</div>';
}
function rbKey_unused(e){
  var t=e.target;
  if(e.key!=='Enter'||!(e.ctrlKey||e.metaKey)||!t||!t.classList||!t.classList.contains('ibt2'))return;
  e.preventDefault();
  var n=INV[ui.inv];if(!n)return;
  var bl=rbOf(n),i=+t.dataset.i;if(!bl[i])return;
  bl.splice(i+1,0,{k:bl[i].k==='s'?'m':'s',v:''});rbSave(ui.inv,bl);render();
  var ta=document.querySelectorAll('.ibt2');if(ta[i+1])ta[i+1].focus();
}
function amAdd(inp){
  var h=habitById(inp.dataset.id),d=inp.dataset.date,v=parseInt(inp.value,10);
  if(!h||d>TODAY||!(v>0)){inp.focus();return;}
  addAmount(h,d,v);save();render();
}
function cardHtml(x,d,future){
  var sk=x.type==='month'?null:streak(x),mm=memoGet(d,x.id),has=!!(mm.r||mm.t);
  var sub=subText(x);
  if(x.type!=='daily')sub+=' · '+(x.type==='week'?'이 주 ':'이 달 ')+cnt(x,pStart(x,d),pEnd(x,d))+'/'+x.n;
  return '<article class="hcard c'+colOf(x)+'"><div class="hh"><span class="hico">'+esc(x.icon)+'</span><div class="hhw"><div class="hnm">'+esc(x.name)+'</div><div class="hsub">'+esc(sub)+'</div></div></div>'
    +bodyHtml(x,d,future)
    +'<div class="hft">'+dots7(x,d)+'<span class="stk">'+(sk&&sk.c>1?'🔥 '+sk.c+sk.u:'')+'</span>'
    +'<button class="mbtn'+(has?' has':'')+'" data-act="detail" data-id="'+x.id+'" data-date="'+d+'" title="'+esc(has?memoText(mm):'시간 수정 · 메모')+'" aria-label="'+esc(x.name)+' 시간 수정·메모">💬</button></div></article>';
}

/* 상세 메모지 */
function modalHtml(){
  if(!ui.modal)return '';
  var x=habitById(ui.modal.id);if(!x){ui.modal=null;return '';}
  var d=ui.modal.date,n=getN(x,d),ts=getT(x,d),mm=memoGet(d,x.id),on=chk(x,d),am=modeOf(x)==='amount';
  var h='<div class="mdl" id="mdl" data-act="mclose-bg"><div class="msheet c'+colOf(x)+'" role="dialog" aria-modal="true" aria-label="'+esc(x.name)+' 상세"><div class="tape"></div>'
    +'<div class="mh"><span class="hico">'+esc(x.icon)+'</span><div class="hhw"><div class="hnm">'+esc(x.name)+'</div><div class="hsub">'+fmtDay(d)+'</div></div><button class="btn sm mclose" data-act="mclose">닫기</button></div>';
  h+='<h3>기록한 시간</h3>';
  if(!n)h+='<p class="note" style="margin:0">아직 기록이 없어요. 카드의 단추를 누르면 지금 시각이 기록돼요.</p>';
  if(am)ts.forEach(function(t,i){var p=String(t).split('*');h+='<div class="drow"><span>'+(i+1)+'번째</span><b>'+(p[0]&&p[0]!=='00:00'?p[0]+' · ':'')+(p[1]||'?')+'분</b><button class="btn sm warn" data-act="dose-del" data-id="'+x.id+'" data-date="'+d+'" data-i="'+i+'">삭제</button></div>';});
  else for(var i=0;i<n;i++)h+='<div class="drow"><span>'+(i+1)+'번째</span><input type="text" class="tin" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="예: 0820" value="'+esc(ts[i]||'')+'" data-f="doseT" data-id="'+x.id+'" data-date="'+d+'" data-i="'+i+'" aria-label="'+(i+1)+'번째 시각"><button class="btn sm warn" data-act="dose-del" data-id="'+x.id+'" data-date="'+d+'" data-i="'+i+'">취소</button></div>';
  h+='<h3>'+(on?'메모':'못한 이유')+'</h3>';
  if(!on)h+='<div class="chips" role="group" aria-label="못한 이유">'+REASONS.map(function(rn){return '<button type="button" data-act="reason" data-id="'+x.id+'" data-date="'+d+'" data-v="'+rn+'" aria-pressed="'+(mm.r===rn)+'">'+rn+'</button>';}).join('')+'</div>';
  h+='<input type="text" id="mdlText" data-f="memoT" data-id="'+x.id+'" data-date="'+d+'" maxlength="120" value="'+esc(tx(mm.t))+'" placeholder="'+(on?'한 줄 메모':'무엇 때문에 못 했나요? 한 줄 메모')+'">';
  return h+'</div></div>';
}

/* 하루 흐름: 기록한 시각은 채운 원, 아직 안 한 예정 시각은 점선 원 */
function timelineHtml(d,hs){
  var ev=[];
  hs.forEach(function(x){
    var n=getN(x,d),ts=getT(x,d),pl=modeOf(x)==='do'?planned(x):null,pd=perDay(x),i,ne=modeOf(x)==='amount'?ts.length:n;
    for(i=0;i<ne;i++){var tt=String(ts[i]||'').split('*')[0];if(/^\d\d:\d\d$/.test(tt)&&!(modeOf(x)==='amount'&&tt==='00:00'))ev.push({m:hm2min(tt),x:x,done:true,t:tt});}
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
    +'<div class="qcard"><button type="button" class="btn pri" data-act="hbquick">⚡ 급한 메모 쓰기</button><span class="note">쓰는 동안 자동 저장 · 아래 📋 메모로 를 누르면 업무일지 메모 탭에 남아요</span></div>'
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
  var m=modeOf(x),mm=memoGet(d,x.id),has=!!(mm.r||mm.t),n=getN(x,d);
  if(m!=='do'){
    var clean=rawN(x,d)===-1,bad=m==='avoid'&&n>limOf(x),ok=chk(x,d);
    var lab=m==='avoid'?(bad?String(n):clean?'✓':n>0?String(n):''):(n>0?String(n):'');
    var tip2=esc(x.name+' '+d+(m==='avoid'?(bad?' · 한도 초과 '+n:clean?' · 안 했어요':n>0?' · '+n:''):' · '+n+(m==='amount'?'분':'')));
    return '<button class="cell num '+cls+(ok?' on':'')+(bad?' bad':'')+(has&&!ok?' hasm':'')+'" data-act="toggle" data-id="'+x.id+'" data-date="'+d+'" aria-pressed="'+ok+'" title="'+tip2+'" aria-label="'+tip2+'"'+(d>TODAY?' disabled':'')+'>'+(lab||'·')+'</button>';
  }
  var pd=perDay(x),on=n>=pd,part=n>0&&!on;
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
var TEXTF=['d','h','k','w','g','r','c','th','sc','bx'];
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
var DCOLS=[['th','📌 하나','여기에 적어요'],['d','📄 둘','여기에 적어요'],['sc','📎 셋','여기에 적어요']];
var DLAB={h:'하이라이트',k:'잘한 점',w:'아쉬운 점',g:'감사',r:'내일의 나에게'};
function dayD(n){
  var t=tx(n.d),o=[];
  Object.keys(DLAB).forEach(function(f){var v=tx(n[f]);if(v)o.push(DLAB[f]+': '+v);});
  return t+(t&&o.length?'\n\n':'')+o.join('\n');
}
function dyPlain(n){
  var o=null;if(!n||!n.bx||isEnc(n.bx))return '';
  try{o=JSON.parse(n.bx);}catch(e){return '';}
  var t=[];((o&&o.bl)||[]).forEach(function(x){if(x.k==='tb')t.push((x.c||[]).filter(Boolean).join(' | '));else if(x.k!=='i'&&x.k!=='hr'&&x.v)t.push(x.v);});
  return t.join('\n');
}
function dyHasImg(n){var o=null;if(!n||!n.bx||isEnc(n.bx))return false;try{o=JSON.parse(n.bx);}catch(e){return false;}return !!(o&&o.im&&o.im.length);}
function dayAny(n){return n&&n.bx&&!isEnc(n.bx)?(dyPlain(n)||(dyHasImg(n)?'📷':'')):(tx(n&&n.th)+tx(n&&n.sc)+dayD(n||{}));}
function diaryListHtml(){
  var q=(ui.dq||'').trim().toLowerCase();
  var ds=Object.keys(S.note).filter(function(d){return d!==ui.date&&dayAny(S.note[d]);}).sort().reverse();
  if(q)ds=ds.filter(function(d){var n=S.note[d];return (tx(n.th)+' '+tx(n.sc)+' '+dayD(n)).toLowerCase().indexOf(q)>=0;});
  if(!ds.length)return '<article class="dslide empty"><p class="note">'+(q?'찾는 기록이 없어요.':'지난 기록이 아직 없어요.')+'</p></article>';
  var lim=ui.dlimit||60;
  return ds.slice(0,lim).map(function(d,i){
    var n=S.note[d];
    var cols=[['th','📌 하나',tx(n.th)],['d','📄 둘',dayD(n)],['sc','📎 셋',tx(n.sc)]].map(function(c){
      return '<section><h4>'+c[1]+'</h4><div class="dtx">'+(c[2]?esc(c[2]):'<span class="note">—</span>')+'</div></section>';
    }).join('');
    return '<article class="dslide"><header><b>'+d.slice(0,4)+'.'+d.slice(5,7)+'.'+d.slice(8)+' ('+DOWN[dow(d)]+')</b><span class="dno">'+(i+1)+' / '+Math.min(ds.length,lim)+'</span><button type="button" class="btn xs" data-act="dgoto" data-date="'+d+'">이 날 열어 고치기</button></header>'
      +'<div class="dbody3">'+cols+'</div></article>';
  }).join('')+(ds.length>lim?'<article class="dslide empty"><button type="button" class="btn" data-act="dmore">더 보기</button></article>':'');
}
function sf(label,f,d,ph,cls,ro){
  var v=(S.note[d]||{})[f],enc=isEnc(v);
  return '<label class="sf'+(cls?' '+cls:'')+'"><span>'+label+'</span><textarea class="lined" data-f="note:'+f+'" placeholder="'+(enc?'읽을 수 없어요':ph)+'"'+(enc||ro?' readonly':'')+'>'+esc(tx(v))+'</textarea></label>';
}
function lockWarn(){return '';}

/* ───────── 🗂 자료실 일기: 투자와 같은 A4 3단 종이(하루 한 장). 글은 그날 기록의 bx(JSON 글자, 코드가 켜져 있으면 암호화)에 저장한다 ───────── */
function dyId(d){return 'dy'+d;}
function dyMs(d){var a=d.split('-').map(Number);return new Date(a[0],a[1]-1,a[2],12).getTime();}
function dySpacer(){return {k:'n',v:'',cs:1,cb:1};}
/* 예전 일기(하나·둘·셋 세 칸)는 열 때 세 단에 그대로 나눠 보여 준다. 고치기 전에는 예전 글을 건드리지 않는다 */
function dyLegacy(raw){
  var cols=[tx(raw.th),dayD(raw),tx(raw.sc)],out=[],last=-1,c;
  cols.forEach(function(t,i){if(t)last=i;});
  for(c=0;c<=last;c++){
    var ls=cols[c]?rteLines(cols[c],'n'):[];
    if(!ls.length){var el0={k:'n',v:'',l:'',d:0,h:'',s:''};if(c>0){el0.cb=1;el0.ct=c;}out.push(el0);continue;}
    if(c>0){ls[0].cb=1;ls[0].ct=c;}
    ls.forEach(function(l){out.push(l);});
  }
  return out;
}
function dyNote(d){
  var raw=S.note[d]||{},id=dyId(d);
  if(isEnc(raw.bx)||isEnc(raw.th)||isEnc(raw.d)||isEnc(raw.sc))return null;
  var cur=INV[id];
  if(cur&&cur.bxs===(raw.bx||''))return cur;
  var o=null;if(raw.bx){try{o=JSON.parse(raw.bx);}catch(e){o=null;}}
  var a=d.split('-').map(Number);
  INV[id]={id:id,k:'diary',dd:d,t:a[1]+'월 '+a[2]+'일 ('+DOWN[dow(d)]+') 일기',b:'',u:'',g:'',c:dyMs(d),m:dyMs(d),
    bl:(o&&Array.isArray(o.bl))?o.bl:dyLegacy(raw),im:(o&&Array.isArray(o.im))?o.im:[],bxs:raw.bx||''};
  return INV[id];
}
function dyLegacyAny(raw){return !!(raw&&(tx(raw.th)||tx(raw.sc)||dayD(raw)));}
function dyHas(n){
  return (n.im||[]).length>0||(n.bl||[]).some(function(x){return x.k==='tb'?(x.c||[]).some(Boolean):x.k==='i'||(x.k!=='hr'&&!!x.v);});
}
function dySave(id,f){
  var n=INV[id];if(!n||!n.dd)return;
  if(f&&f.bl)n.bl=f.bl;
  if(f&&f.im)n.im=f.im;
  var d=n.dd,json=(dyHas(n)||dyLegacyAny(S.note[d]))?JSON.stringify({bl:n.bl||[],im:n.im||[]}):'';
  n.bxs=json;
  noteSet(d,'bx',json);save();
}
function vDiary(){
  if(ui.lkopen&&typeof lockCardHtml==='function')return '<div class="dy">'+lockCardHtml()+vInv('diary')+'</div>';
  return '<div class="dy">'+vInv('diary')+'</div>';
}

/* ───────── 💹 투자 메모 (일기와 따로) ───────── */
var MEMO_TAG='📝 아이디어·계획·복기';
var ITAGS=['📈 종목','📰 뉴스','▶ 유튜브 요약',MEMO_TAG];
function tagN(g){return /아이디어|계획|복기/.test(g||'')?MEMO_TAG:(g||'');}   /* 예전 💡/📋/🔍 꼬리표는 한 탭으로 합쳐서 본다(저장값은 그대로) */
var IMG_MAX=40,IMG_BYTES=650000;
function isBookN(n){return n&&n.k==='book';}
function isPlainN(n){return n&&(n.k==='book'||n.k==='diary');}
function fmtMin(m){m=Math.round(+m||0);var h=Math.floor(m/60),r=m%60;return h?(r?h+'시간 '+r+'분':h+'시간'):r+'분';}
function bookSummary(){
  var by={};
  invSorted('book').forEach(function(n){
    var k=String(n.t||'').trim().toLowerCase()||'(제목 없음)',g=by[k]=by[k]||{mn:0,dn:false};
    g.mn+=n.mn>0?+n.mn:0;if(n.dn)g.dn=true;
  });
  var ks=Object.keys(by),mn=0,dn=0;ks.forEach(function(k){mn+=by[k].mn;if(by[k].dn)dn++;});
  return {books:ks.length,done:dn,min:mn};
}
function curKind(){return ui.tab==='book'?'book':'inv';}
function invTrash(kind){var bk=kind==='book';return Object.keys(INV).map(function(k){return INV[k];}).filter(function(n){return n.k!=='diary'&&n.del>0&&(isBookN(n)===bk);}).sort(function(a,b){return b.del-a.del;});}
function invSorted(kind){var bk=kind==='book';return Object.keys(INV).map(function(k){return INV[k];}).filter(function(n){return n.k!=='diary'&&!n.del&&(kind===undefined||(isBookN(n)===bk));}).sort(function(a,b){return (b.m||0)-(a.m||0);});}
function fmtTs(ms){if(!ms)return '';var d=new Date(ms);return d.getFullYear()+'.'+pad(d.getMonth()+1)+'.'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());}
function safeUrl(u){u=String(u||'').trim();return /^https?:\/\//i.test(u)?u:'';}
function invListHtml(kind){
  var bk=(kind||curKind())==='book';
  var q=(ui.invq||'').trim().toLowerCase(),ft=bk?'':(ui.invtag||'');
  var arr=invSorted(bk?'book':'inv').filter(function(n){
    if(ft&&tagN(n.g)!==ft)return false;
    return !q||((n.t||'')+' '+(n.b||'')+' '+(n.u||'')+' '+(n.g||'')).toLowerCase().indexOf(q)>=0;
  });
  if(!arr.length)return '<p class="note" style="padding:6px">'+(q||ft?'찾는 기록이 없어요.':bk?'아직 독서 기록이 없어요. ＋ 새 독서 기록을 눌러 시작하세요.':'아직 메모가 없어요. ＋ 새 메모를 눌러 시작하세요.')+'</p>';
  return arr.map(function(n){
    var sn=String(n.b||'').replace(/\s+/g,' ').slice(0,50),ic=(n.im||[]).length;
    var tg=bk?(n.u?'<span class="dtg">'+esc(n.u)+(/쪽|p|P|페이지/.test(n.u)?'':'쪽')+'</span>':''):(n.g?'<span class="dtg">'+esc(tagN(n.g))+'</span>':'');
    var bx=bk?((n.dn?'<span class="dtg done">✅ 완독</span>':'')+(n.mn>0?'<span class="dtg">⏱ '+fmtMin(n.mn)+'</span>':'')):'';
    return '<button type="button" class="irow'+(n.id===ui.inv?' on':'')+'" data-act="invsel" data-id="'+n.id+'"><b>'+esc(n.t||(bk?'(책 제목 없음)':'(제목 없음)'))+'</b>'+tg+(bx?'<span class="irx">'+bx+'</span>':'')+'<em>'+esc(sn)+'</em><small>'+fmtTs(n.m).slice(0,10)+(ic?' · 📷 '+ic:'')+'</small></button>';
  }).join('');
}
function invDropEmpty(){var n=INV[ui.inv];if(n&&n.k!=='diary'&&!n.t&&!n.b&&!n.u&&!n.x1&&!n.x2&&!n.x3&&!n.mn&&!n.dn&&!(n.im||[]).length&&!(Array.isArray(n.bl)&&n.bl.some(function(x){return x.v;})))invDelete(ui.inv);}
/* 본문은 [글, 사진, 글, 사진 …] 순서로 쌓이는 조각들. 예전 메모(글 한 덩어리 + 사진 목록)도 그대로 읽는다 */
/* 독서·투자: 글은 세 칸(x1·x2·x3), 사진은 아래 한 줄. 예전 메모(글 한 덩어리·글/사진 조각)는 첫 칸으로 읽는다 */
function legacyText(n){
  if(Array.isArray(n.bl)&&n.bl.length)return n.bl.filter(function(x){return x.k==='t';}).map(function(x){return x.v;}).filter(Boolean).join('\n');
  return n.b||'';
}
/* 독서: 읽은 내용 한 칸. 예전 3칸(느낀 점·인용·메모)에 쓴 글은 이어 붙여 보여 준다 */
function bookText(n){
  var c=(n.x1===undefined&&n.x2===undefined&&n.x3===undefined)?[legacyText(n),'','']:[n.x1||'',n.x2||'',n.x3||''];
  return c[0]+(c[1]?(c[0]?'\n\n':'')+'💭 느낀 점\n'+c[1]:'')+(c[2]?((c[0]||c[1])?'\n\n':'')+'✍ 인용·메모\n'+c[2]:'');
}
function bookSave(nid,val){invSave(nid,{x1:val,x2:'',x3:'',b:val,bl:[]});}
/* 투자: 자료(파랑)와 내 생각(분홍)을 블록으로 나눠 쌓는다. 예전 메모는 자료/생각 블록으로 옮겨 읽는다 */
/* 글 색: 기본(검정) + 파랑(s)·분홍(m)·초록(c) 딱 3가지. 이름은 독서/투자가 다르다 */
var RKN={inv:{n:'📝 본문',s:'📰 자료',m:'💭 내 생각',c:'📋 계획·행동'},book:{n:'📝 본문',s:'📖 읽은 내용',m:'💭 느낀 점',c:'✍ 인용·메모'}};
var RK=RKN.inv;
var RCOL={n:0,s:1,m:2,c:3},RKIND=['n','s','m','c'];
function rkDef(bk){return bk?(ui.rkb||'n'):(ui.rki||'n');}   /* 새로 쓰는 글의 기본 색(줄 단위) */
function rteLines(txt,k,l,d,h,st){return String(txt==null?'':txt).split('\n').map(function(v){return {k:k,v:v,l:l||'',d:d||0,h:h||'',s:st||''};});}
function TW(v){v=+v;return v===3?3:v===4?4:2;}
function rteLn(x){
  var o={k:x.k==='t'?'s':x.k,v:x.v||'',l:x.l||'',d:x.d||0,h:x.h||'',s:x.s||''};
  if(x.a==='c'||x.a==='r')o.a=x.a;
  if(x.z>=10&&x.z<=48)o.z=Math.round(x.z);
  if(x.f)o.f=1;
  if(x.sp)o.sp=1;
  if(x.cb)o.cb=1;
  if(x.cs){o.cs=1;o.cb=1;}
  if(x.bx)o.bx=1;
  if(x.ct===1||x.ct===2)o.ct=x.ct;
  return o;
}
function rteBlocks(n,bk){
  var raw=Array.isArray(n.bl)?n.bl:[],out=[],seen={};
  var has=raw.some(function(x){return x.k==='s'||x.k==='m'||x.k==='c'||x.k==='n'||x.k==='t'||x.k==='i'||x.k==='hr'||x.k==='tb';});
  if(has){
    raw.forEach(function(x){
      if(x.k==='i'){var io={k:'i',v:x.v};if(x.h>=40&&x.h<=1200)io.h=Math.round(x.h);out.push(io);seen[x.v]=1;}
      else if(x.k==='hr'){out.push({k:'hr',v:''});}
      else if(x.k==='tb'){var tw=TW(x.w),tc=Array.isArray(x.c)?x.c.map(String):[];while(tc.length<tw*2||tc.length%tw)tc.push('');var tbo={k:'tb',w:tw,c:tc};if(x.sp)tbo.sp=1;out.push(tbo);}
      else if(x.k==='s'||x.k==='m'||x.k==='c'||x.k==='n'||x.k==='t'){
        if(String(x.v||'').indexOf('\n')>=0)rteLines(x.v,x.k==='t'?'s':x.k,x.l,x.d).forEach(function(l){out.push(l);});
        else out.push(rteLn(x));
      }
    });
  }else if(bk){rteLines(bookText(n),'n').forEach(function(l){out.push(l);});}
  else{
    var hx=n.x1!==undefined||n.x2!==undefined||n.x3!==undefined;
    if(hx){[['x1','s'],['x2','m'],['x3','c']].forEach(function(p){if(n[p[0]])rteLines(n[p[0]],p[1]).forEach(function(l){out.push(l);});});}
    else{var t=legacyText(n);if(t)rteLines(t,'s').forEach(function(l){out.push(l);});}
  }
  (n.im||[]).forEach(function(id){if(!seen[id])out.push({k:'i',v:id});});
  var dk=rkDef(bk);
  if(!out.some(function(x){return x.k!=='i'&&x.k!=='hr'&&x.k!=='tb';}))out.push({k:dk,v:''});
  var lk=out[out.length-1].k;
  if(lk==='i'||lk==='hr'||lk==='tb')out.push({k:dk,v:''});
  return out;
}
function rteSave(nid,bl){
  var txt=bl.filter(function(x){return x.k!=='i'&&x.k!=='hr'&&x.k!=='tb';}).map(function(x){return x.v;}).filter(Boolean).join('\n');
  invSave(nid,{bl:bl,b:txt,im:bl.filter(function(x){return x.k==='i';}).map(function(x){return x.v;}),x1:'',x2:'',x3:''});
}
/* 줄 안의 서식(굵게·기울임·취소선·형광펜·글 색)만 남기고 나머지는 버린다 */
function rteColIdx(c){
  if(!c)return -1;
  var m=/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c);
  if(!m){var h=/^#([0-9a-f]{6})$/i.exec(c);if(!h)return -1;m=[0,parseInt(h[1].slice(0,2),16),parseInt(h[1].slice(2,4),16),parseInt(h[1].slice(4,6),16)];}
  var r=+m[1],g=+m[2],b=+m[3];
  if(r<=2&&g<=2&&b<=3)return 0;
  var pal=[[29,78,216],[190,24,93],[21,128,61]],best=-1,bd=9999;
  pal.forEach(function(p,i){var d=Math.abs(p[0]-r)+Math.abs(p[1]-g)+Math.abs(p[2]-b);if(d<bd){bd=d;best=i+1;}});
  return bd<60?best:-1;
}
function rteClean(node){
  var out='';
  Array.prototype.forEach.call(node.childNodes,function(n){
    if(n.nodeType===3){out+=esc(n.nodeValue);return;}
    if(n.nodeType!==1)return;
    var tg=n.tagName.toLowerCase();
    if(tg==='br')return;
    var inner=rteClean(n);if(!inner)return;
    var st=n.style||{},w=[];
    if(tg==='b'||tg==='strong'||st.fontWeight==='bold'||+st.fontWeight>=600)w.push('b');
    if(tg==='i'||tg==='em'||st.fontStyle==='italic')w.push('i');
    var td=(st.textDecorationLine||st.textDecoration||'');
    if(tg==='s'||tg==='strike'||tg==='del'||td.indexOf('line-through')>=0)w.push('s');
    var bg=st.backgroundColor;
    if(tg==='mark'||(bg&&bg!=='transparent'&&bg!=='rgba(0, 0, 0, 0)'))w.push('mark');
    var ci=-1;
    if(tg==='font')ci=rteColIdx(n.getAttribute('color'));
    else if(st.color)ci=rteColIdx(st.color);
    else if(n.classList){for(var q=0;q<4;q++)if(n.classList.contains('t'+q))ci=q;}
    var html=inner;
    w.forEach(function(t){html='<'+t+'>'+html+'</'+t+'>';});
    if(ci>=0)html='<span class="t'+ci+'">'+html+'</span>';
    out+=html;
  });
  return out;
}
function rteHtml(bl){
  return bl.map(function(x){
    if(x.k==='i'){var src=imgSrc(x.v),ih=x.h>=40?x.h:0;return '<figure class="im" contenteditable="false" data-iid="'+x.v+'"'+(ih?' data-h="'+ih+'"':'')+'><img'+(src?' src="'+src+'"':' class="wait"')+(ih?' style="height:'+ih+'px"':'')+' data-iid="'+x.v+'" alt="첨부 사진" data-act="invbig" data-iid2="'+x.v+'"><button type="button" class="ix" data-act="rtimgdel" data-iid2="'+x.v+'" aria-label="사진 삭제">✕</button><span class="rh" title="끌어서 세로 크기 조절">⇕ 세로 조절</span><button type="button" class="rhr" data-act="rtimgreset" title="원래 비율로">원본 비율</button></figure>';}
    if(x.k==='hr')return '<div class="hr" contenteditable="false"><hr><button type="button" class="ix" data-act="rthrdel" aria-label="구분선 삭제">✕</button></div>';
    if(x.k==='tb'){
      var tw=TW(x.w),rows='',r,c2,cells=x.c||[];
      for(r=0;r*tw<cells.length;r++){rows+='<tr>';for(c2=0;c2<tw;c2++){var tv=cells[r*tw+c2]||'';rows+='<td>'+(tv?esc(tv):'<br>')+'</td>';}rows+='</tr>';}
      return '<div class="tbl" data-w="'+tw+'"'+(x.sp?' data-sp="1"':'')+'><table><tbody>'+rows+'</tbody></table><div class="tbar" contenteditable="false"><button type="button" data-act="tbrow">＋ 행</button><button type="button" data-act="tbrowdel">− 행</button><button type="button" data-act="tbdel">🗑 표 지우기</button></div></div>';
    }
    return '<div class="ln '+x.k+'"'+(x.l?' data-l="'+x.l+'"':'')+(x.d?' data-d="'+x.d+'"':'')+(x.s?' data-s="'+x.s+'"':'')+(x.a?' data-a="'+x.a+'"':'')+(x.f?' data-fold="1"':'')+(x.sp?' data-sp="1"':'')+(x.cb?' data-cb="1"':'')+(x.cs?' data-cs="1"':'')+(x.bx?' data-bx="1"':'')+(x.ct?' data-ct="'+x.ct+'"':'')+(x.z?' data-z="'+x.z+'" style="font-size:'+x.z+'px"':'')+'>'+(x.h?x.h:(x.v?esc(x.v):'<br>'))+'</div>';
  }).join('');
}
var rkOf=function(c){return c.classList.contains('m')?'m':c.classList.contains('c')?'c':c.classList.contains('s')?'s':'n';};
function rteParse(el){
  var out=[];
  Array.prototype.forEach.call(el.children,function(c){
    if(c.classList.contains('im')){var ib={k:'i',v:c.getAttribute('data-iid')},ih=+c.getAttribute('data-h')||0;if(ih>=40&&ih<=1200)ib.h=ih;out.push(ib);}
    else if(c.classList.contains('hr'))out.push({k:'hr',v:''});
    else if(c.classList.contains('tbl')){
      var tw=TW(c.getAttribute('data-w')),cs=[];
      Array.prototype.forEach.call(c.querySelectorAll('td'),function(td){cs.push(td.textContent.replace(/\s+/g,' ').trim());});
      while(cs.length<tw*2||cs.length%tw)cs.push('');
      var tbp={k:'tb',w:tw,c:cs};if(c.getAttribute('data-sp')==='1')tbp.sp=1;out.push(tbp);
    }
    else{
      var h=rteClean(c),v=c.textContent;
      var ob={k:rkOf(c),v:v,l:c.getAttribute('data-l')||'',d:+c.getAttribute('data-d')||0,h:(h&&h!==esc(v))?h:'',s:c.getAttribute('data-s')||''},za=+c.getAttribute('data-z')||0,aa=c.getAttribute('data-a');
      if(aa==='c'||aa==='r')ob.a=aa;
      if(za>=10&&za<=48)ob.z=za;
      if(c.getAttribute('data-fold')==='1'&&/^h/.test(ob.s))ob.f=1;
      if(c.getAttribute('data-sp')==='1')ob.sp=1;
      if(c.getAttribute('data-cs')==='1'&&!(c.textContent||'').replace(/\u200b/g,'').trim()){ob.cs=1;ob.cb=1;}else if(c.getAttribute('data-cs')==='1'||c.getAttribute('data-cb')==='1')ob.cb=1;
      if(c.getAttribute('data-bx')==='1')ob.bx=1;
      var cta=+c.getAttribute('data-ct');if(ob.cb&&!ob.cs&&(cta===1||cta===2))ob.ct=cta;
      out.push(ob);
    }
  });
  return out;
}
/* 엔터·붙여넣기로 생긴 군더더기를 [줄 div / 사진 figure / 구분선] 모양으로 정리 */
function rteNormalize(el,bk){
  var kind=rkDef(bk),prev=null;
  Array.prototype.slice.call(el.childNodes).forEach(function(nd){
    var d;
    if(nd.nodeType===3){d=document.createElement('div');d.className='ln '+(prev||kind);el.insertBefore(d,nd);d.appendChild(nd);prev=prev||kind;return;}
    if(nd.nodeType!==1)return;
    if(nd.classList.contains('im')||nd.classList.contains('hr')||nd.classList.contains('tbl')){return;}
    if(nd.tagName==='DIV'){
      var nest;while((nest=nd.querySelector('div'))){nd.parentNode.insertBefore(nest,nd.nextSibling);}
      var kk=(nd.classList.contains('m')||nd.classList.contains('c')||nd.classList.contains('s')||nd.classList.contains('n'))?rkOf(nd):(prev||kind);
      nd.className='ln '+kk;prev=kk;
      return;
    }
    d=document.createElement('div');d.className='ln '+(prev||kind);el.insertBefore(d,nd);d.appendChild(nd);
  });
  if(!el.firstChild){var f=document.createElement('div');f.className='ln '+kind;f.innerHTML='<br>';el.appendChild(f);}
}
function rteIdxOf(el,nd){while(nd&&nd.parentNode!==el)nd=nd.parentNode;return nd?Array.prototype.indexOf.call(el.children,nd):-1;}
function rtePos(el,container,offset){
  if(container===el)return {li:Math.max(0,Math.min(offset,el.children.length-1)),off:0};
  var n=container;while(n&&n.parentNode!==el)n=n.parentNode;if(!n)return null;
  var li=Array.prototype.indexOf.call(el.children,n),off=0;
  if(n.classList&&n.classList.contains('ln')){var rr=document.createRange();rr.selectNodeContents(n);try{rr.setEnd(container,offset);off=rr.toString().length;}catch(e){}}
  return {li:li,off:off};
}
function rteCaretOf(el){
  var sel=window.getSelection();if(!sel||!sel.rangeCount)return null;
  var r=sel.getRangeAt(0);if(!el.contains(r.startContainer))return null;
  return rtePos(el,r.startContainer,r.startOffset);
}
function rteSelGet(el){
  var sel=window.getSelection();if(!sel||!sel.rangeCount)return ui.rsel||null;
  var r=sel.getRangeAt(0);if(!el.contains(r.startContainer)||!el.contains(r.endContainer))return ui.rsel||null;
  var a=rtePos(el,r.startContainer,r.startOffset),b=rtePos(el,r.endContainer,r.endOffset);
  return (a&&b)?{a:a,b:b}:null;
}
function rtePoint(el,li,off){
  var c=el.children[li];if(!c)return null;
  if(!c.classList.contains('ln'))return {n:el,o:Math.min(li+1,el.childNodes.length)};
  var walker=document.createTreeWalker(c,NodeFilter.SHOW_TEXT,null),node,acc=0;
  while((node=walker.nextNode())){var l=node.nodeValue.length;if(acc+l>=off)return {n:node,o:off-acc};acc+=l;}
  return {n:c,o:0};
}
function rteSelSet(el,s){
  if(!s)return;
  var a=rtePoint(el,s.a.li,s.a.off),b=rtePoint(el,s.b.li,s.b.off);if(!a||!b)return;
  el.focus({preventScroll:true});
  var r=document.createRange(),sel=window.getSelection();
  r.setStart(a.n,a.o);r.setEnd(b.n,b.o);sel.removeAllRanges();sel.addRange(r);
}
function rteSetCaret(el,li,off){rteSelSet(el,{a:{li:li,off:off},b:{li:li,off:off}});}
/* 쪽 넘김: 3단이 꽉 차면 다음 쪽(가로로 이어 붙여 놓고 한 쪽씩 보여 줌). 스크롤은 없다 */
var PAPER={W:1123,H:794,BW:1040,BH:680};      /* A4 가로(96dpi) · 철할 여백: 왼쪽 15mm·위 12mm, 오른쪽 6mm·아래 5mm · 머리줄 38px */
function rteK(el){var st=el&&el.closest?el.closest('.rtstage.pm'):null;return st?(+st.getAttribute('data-k')||1):1;}
function rteGeom(el){
  var pm=!!(el.closest&&el.closest('.rtstage.pm'));
  var stg=pm?el.closest('.rtstage.pm'):null,Wf=pm?(+(stg&&stg.getAttribute('data-bw'))||PAPER.BW):(el.getBoundingClientRect().width||el.clientWidth),W=Math.floor(Wf),wide=pm||Wf>=600,cols=wide?3:1,gap=wide?30:0;
  return {W:W,cols:cols,gap:gap,cw:Math.floor((Wf-(cols-1)*gap)/cols)-1,pw:Wf+gap};
}
function rtePagerUpdate(){
  var n=$('#rtpgn');if(n)n.textContent=((ui.rpage||0)+1)+' / '+(ui.rpages||1);
  var a=$('#rtpg-prev'),b=$('#rtpg-next');
  if(a)a.disabled=(ui.rpage||0)<=0;if(b)b.disabled=(ui.rpage||0)>=(ui.rpages||1)-1;
}
/* 번호 매기기: 이어지는 번호 줄만 1,2,3… (들여쓴 단계마다 따로) */
/* 제목 줄 접기: 접힌 제목 아래, 다음 같은(또는 더 큰) 제목 전까지 숨긴다 */
function rteFolds(el){
  var lim=0;
  Array.prototype.forEach.call(el.children,function(c){
    var lv=c.classList.contains('ln')?(/^h([123])$/.exec(c.getAttribute('data-s')||'')||[0,0])[1]:0;
    lv=+lv;
    if(lim&&lv&&lv<=lim)lim=0;
    c.classList.toggle('fh',!!lim&&!lv||!!lim&&lv>lim);
    if(lv&&!lim&&c.getAttribute('data-fold')==='1')lim=lv;
  });
}
function rteNums(el){
  var cnt=[0,0,0,0],i;
  Array.prototype.forEach.call(el.children,function(c){
    if(!c.classList.contains('ln')){cnt=[0,0,0,0];return;}
    var l=c.getAttribute('data-l'),d=Math.min(3,+c.getAttribute('data-d')||0);
    if(l==='n'){cnt[d]++;for(i=d+1;i<4;i++)cnt[i]=0;c.setAttribute('data-n',cnt[d]+'.');}
    else{c.removeAttribute('data-n');for(i=(l&&l.charAt(0)==='b')?d+1:0;i<4;i++)cnt[i]=0;}
  });
}
function rteSelLines(el){
  var s=rteSelGet(el),a,b;
  if(s){a=s.a.li;b=s.b.li;}else{a=b=el.children.length-1;}
  var out=[];for(var i=Math.min(a,b);i<=Math.max(a,b);i++){var c=el.children[i];if(c&&c.classList.contains('ln'))out.push(c);}
  return out;
}
/* 되돌리기/다시 실행: 우리가 직접 관리 */
var RU={nid:'',undo:[],redo:[],cur:null,t:0};
function rteSnap(el){return {html:el.innerHTML,sel:rteSelGet(el)};}
function rteUndoInit(el){
  if(RU.nid!==ui.inv){RU.nid=ui.inv;RU.undo=[];RU.redo=[];}
  RU.cur=rteSnap(el);RU.t=0;
}
function rteUndoPush(){if(RU.cur){RU.undo.push(RU.cur);if(RU.undo.length>100)RU.undo.shift();RU.redo=[];}}
function rteApplySnap(el,sn){
  el.innerHTML=sn.html;
  if(INV[ui.inv])rteSave(ui.inv,rteParse(el));
  rteFit(el);rteSelSet(el,sn.sel);rteSyncPage(el);
}
function rteUndo(el){
  if(!RU.undo.length)return;
  RU.redo.push(rteSnap(el));
  var sn=RU.undo.pop();RU.cur=sn;rteApplySnap(el,sn);
}
function rteRedo(el){
  if(!RU.redo.length)return;
  RU.undo.push(rteSnap(el));
  var sn=RU.redo.pop();RU.cur=sn;rteApplySnap(el,sn);
}
/* 서식 작업: 작업 전 상태를 되돌리기에 넣고, 끝나면 줄을 깨끗이 다시 만든다(선택은 유지) */
function rteOp(el,fn){
  if(!el||el.getAttribute('contenteditable')!=='true')return;
  var pre=rteSelGet(el)||ui.rsel,n0=el.children.length;
  rteSelSet(el,pre);
  rteUndoPush();
  fn();
  rteReload(el,(pre&&el.children.length===n0)?pre:null);
}
function rteReload(el,pre){
  var sel=rteSelGet(el),bk=el.getAttribute('data-bk')==='1';
  /* execCommand 뒤 선택이 줄 맨앞으로 접히는 경우가 있어, 글자 수가 그대로인 서식 작업은 작업 전 선택을 되살린다 */
  if(pre&&sel&&sel.a.li===sel.b.li&&sel.a.off===sel.b.off&&!(pre.a.li===pre.b.li&&pre.a.off===pre.b.off))sel=pre;
  var bl=rteParse(el);
  el.innerHTML=rteHtml(bl);
  rteNormalize(el,bk);
  if(INV[ui.inv])rteSave(ui.inv,rteParse(el));
  rteFit(el);rteSelSet(el,sel);rteSyncPage(el);
  RU.cur=rteSnap(el);RU.t=0;
}
var RF={t:0,tm:0},FONT={MIN:14.67,MAX:18.7,BASE:16};
/* 단 높이를 줄 높이의 정수배로 맞춰, 세 단의 맨 아랫줄 높이가 가지런히 같아지게 한다 */
function rteLH(){var v=1.6;try{v=parseFloat(localStorage.getItem('hb_lh'))||1.6;}catch(e){}return Math.max(1.2,Math.min(2,v));}
function rteSnapH(px,lh,full){var u=px*lh,n=Math.max(1,Math.floor((full-12)/u));return (n*u+12+1).toFixed(2)+'px';}
function rteApplyPx(el,px){
  el.style.fontSize=px+'px';el.style.setProperty('--lh',rteLH());
  if(el.closest&&el.closest('.rtstage.pm'))el.style.height=rteSnapH(px,rteLH(),PAPER.BH);
  Array.prototype.forEach.call(el.querySelectorAll('[data-z]'),function(l){l.style.fontSize=(+l.getAttribute('data-z')*px/FONT.BASE).toFixed(2)+'px';});
}
function rteWide(){try{return localStorage.getItem('hb_wide')!=='0';}catch(e){return true;}}
function rteFit(el){
  if(!el)return;
  rteSpanFix(el);
  var host=el.parentNode,stage=el.closest('.rtstage'),pm=false;
  rteNums(el);rteFolds(el);
  if(stage){                                   /* 화면 = 인쇄 모양: A4 한 장을 화면에 맞춰 줄여서 보여 준다 */
    var sw=stage.clientWidth,sh=stage.clientHeight,k=Math.min(sw/PAPER.W,sh/PAPER.H,1.3);
    pm=sw>0&&sh>0&&k>=0.55;
    stage.classList.toggle('pm',pm);stage.setAttribute('data-k',k.toFixed(4));
    stage.firstElementChild.style.transform=pm?'scale('+k+')':'';
    /* 화면 가로 넓게: 세로는 A4 높이 그대로, 가로는 화면 폭만큼 늘린다(인쇄는 언제나 A4) */
    var ww=pm?(rteWide()?Math.max(PAPER.W,Math.min(2200,Math.floor(sw/k))):PAPER.W):PAPER.W,bw=ww-(PAPER.W-PAPER.BW),cw0=Math.floor((bw-60)/3)-1,pp=stage.firstElementChild,rw=pp.querySelector('.rtewrap');
    stage.setAttribute('data-bw',String(bw));
    if(pm){pp.style.width=ww+'px';pp.style.marginLeft=(-ww/2)+'px';if(rw)rw.style.width=bw+'px';stage.style.setProperty('--d1',(cw0+15)+'px');stage.style.setProperty('--d2',(2*cw0+45)+'px');}
    else{pp.style.width='';pp.style.marginLeft='';if(rw)rw.style.width='';}
  }
  if(pm)el.style.height=rteSnapH(ui.rpx||FONT.MIN,rteLH(),PAPER.BH);else el.style.height=Math.max(host.clientHeight,180)+'px';
  var g=rteGeom(el);
  el.style.columnWidth=g.cw+'px';el.style.columnGap=g.gap+'px';
  /* 글자 크기 자동 맞춤(최소 11pt ~ 최대 14pt): 11pt 로 필요한 쪽 수 안에서 가장 큰 글자. 인쇄도 같은 방식 */
  var cnt=function(){return Math.max(1,Math.ceil((el.scrollWidth+g.gap-3)/g.pw));},nowT=Date.now();
  if(nowT-RF.t>450||!ui.rpx){
    RF.t=nowT;rteApplyPx(el,FONT.MIN);var need=cnt(),best=FONT.MIN;
    for(var ft=FONT.MAX;ft>FONT.MIN+0.05;ft-=0.5){rteApplyPx(el,ft);if(cnt()<=need){best=ft;break;}}
    ui.rpx=best;
  }else{
    clearTimeout(RF.tm);RF.tm=setTimeout(function(){RF.t=0;var e=$('.rte3');if(e){rteFit(e);if(document.activeElement===e)rteSyncPage(e);}},520);
  }
  rteApplyPx(el,ui.rpx);
  var pages=cnt();
  if(stage&&pm)rteColCheck(el);
  ui.rpages=pages;
  if((ui.rpage||0)>=pages)ui.rpage=pages-1;
  rteShift(el,ui.rpage||0);
  var txt=el.textContent.replace(/\s+/g,'');
  el.classList.toggle('isempty',!txt&&!el.querySelector('figure,.hr'));
  rtePagerUpdate();
}
/* 쪽 넘기기: 스크롤 대신 통째로 옮긴다(마지막 쪽이 앞 쪽 내용으로 밀려 보이던 문제 방지) */
function rteShift(el,p){
  var g=rteGeom(el);
  el.style.transform=p?'translateX('+(-p*g.pw)+'px)':'';
  if(el.parentNode){el.parentNode.scrollLeft=0;el.parentNode.scrollTop=0;}
  el.scrollLeft=0;
}
function rteFitAll(){var e=$('.rte3');if(e){rteFit(e);if(!RU.cur||RU.nid!==ui.inv)rteUndoInit(e);}}
function rtePageTo(el,p){
  var g=rteGeom(el);
  p=Math.max(0,Math.min(p,(ui.rpages||1)-1));
  ui.rpage=p;rteShift(el,p);rtePagerUpdate();
}
function rteSyncPage(el){
  var sel=window.getSelection();if(!sel||!sel.rangeCount)return;
  var r=sel.getRangeAt(0);if(!el.contains(r.startContainer))return;
  var rc=r.getBoundingClientRect(),er=el.getBoundingClientRect();
  if(!rc||(!rc.width&&!rc.height)){var n=r.startContainer;n=n.nodeType===1?n:n.parentNode;var ln=n&&n.closest?n.closest('.ln,figure,.hr'):null;if(ln)rc=ln.getBoundingClientRect();}
  var g=rteGeom(el),x=(rc.left-er.left)/rteK(el),p=Math.max(0,Math.floor((x+2)/g.pw));
  if(p!==(ui.rpage||0))rtePageTo(el,p);else rteShift(el,p);
}
function rteInCell(){
  var sel=window.getSelection();if(!sel||!sel.rangeCount)return null;
  var n=sel.anchorNode;n=n&&(n.nodeType===1?n:n.parentElement);
  return n&&n.closest?n.closest('.rte3 td'):null;
}
function rteInput(el){
  var bk=el.getAttribute('data-bk')==='1',c=rteCaretOf(el),now=Date.now();
  if(RF.enter){                                   /* 엔터로 줄이 나뉠 때, 새 줄이 「단 나눔」 표시까지 물려받지 않게 */
    RF.enter=false;
    var cl0=c?el.children[c.li]:null,pv0=cl0?cl0.previousElementSibling:null;
    if(cl0&&cl0.getAttribute('data-cb')==='1'&&pv0&&pv0.getAttribute('data-cb')==='1'&&pv0.getAttribute('data-cs')!=='1'){cl0.removeAttribute('data-cb');cl0.removeAttribute('data-ct');}
  }
  if(RU.cur&&now-RU.t>600){rteUndoPush();}      /* 타이핑은 잠깐 쉬었다 쓸 때마다 한 단계 */
  if(rteInCell()){                              /* 표 칸 안에서 쓰는 중: 줄 정리·커서 되돌림 없이 저장만 */
    if(INV[ui.inv])rteSave(ui.inv,rteParse(el));
    rteFit(el);RU.cur=rteSnap(el);RU.t=now;return;
  }
  rteNormalize(el,bk);
  if(c){var cl=el.children[c.li];
    if(cl&&cl.classList.contains('ln')&&!cl.getAttribute('data-l')){
      var tx0=cl.textContent,m1=/^([-*•])\s/.exec(tx0),m2=/^(\d{1,3})[.)]\s/.exec(tx0),m=m1||m2;
      if(m&&c.off===m[0].length){
        cl.setAttribute('data-l',m1?'b':'n');
        var tn=cl.firstChild;
        if(tn&&tn.nodeType===3){tn.nodeValue=tn.nodeValue.slice(m[0].length);if(!tn.nodeValue)cl.innerHTML='<br>';}
        c.off=0;
      }
    }
  }
  if(c)rteSetCaret(el,Math.min(c.li,el.children.length-1),c.off);
  var nid=ui.inv;if(!INV[nid])return;
  rteSave(nid,rteParse(el));rteFit(el);rteSyncPage(el);
  RU.cur=rteSnap(el);RU.t=now;
}
/* 붙여넣은 글: 투자는 파랑(자료), 독서는 기본색. 서식은 버리고 글만 */
function rteInsertText(el,text){
  var bk=el.getAttribute('data-bk')==='1',bl=rteParse(el),c=rteCaretOf(el)||{li:bl.length-1,off:0},li=c.li;
  rteUndoPush();
  var lines=String(text).replace(/\r/g,'').replace(/\n+$/,'').split('\n'),pk=bk?'n':'s';
  if(bl[li]&&(bl[li].k==='i'||bl[li].k==='hr'||bl[li].k==='tb')){bl.splice(li+1,0,{k:rkDef(bk),v:''});li=li+1;c.off=0;}
  var cur=bl[li]||{k:'n',v:''},off=Math.min(c.off,cur.v.length),before=cur.v.slice(0,off),after=cur.v.slice(off);
  var mid=lines.map(function(l){return {k:pk,v:l,l:'',d:0};}),rep=[];
  if(before)rep.push({k:cur.k,v:before,l:cur.l||'',d:cur.d||0,s:cur.s||''});
  rep=rep.concat(mid);
  if(after)rep.push({k:cur.k,v:after,l:cur.l||'',d:cur.d||0,s:cur.s||''});
  bl.splice.apply(bl,[li,1].concat(rep));
  var endLi=li+(before?1:0)+mid.length-1,endOff=mid[mid.length-1].v.length;
  var lk=bl[bl.length-1].k;if(!bl.length||lk==='i'||lk==='hr'||lk==='tb')bl.push({k:rkDef(bk),v:''});
  el.innerHTML=rteHtml(bl);rteNormalize(el,bk);
  if(INV[ui.inv])rteSave(ui.inv,rteParse(el));
  rteFit(el);rteSetCaret(el,endLi,endOff);rteSyncPage(el);
  RU.cur=rteSnap(el);RU.t=0;
}
function rteInsertImgs(nid,ids){
  var n=INV[nid];if(!n||!ids.length)return;
  var bk=isPlainN(n),el=$('.rte3'),bl=el?rteParse(el):rteBlocks(n,bk);
  var c=ui.rcar,li=(c&&bl[c.li]&&bl[c.li].k!=='i'&&bl[c.li].k!=='hr'&&bl[c.li].k!=='tb')?c.li:-1,off;
  if(li<0){li=bl.length-1;while(li>0&&(bl[li].k==='i'||bl[li].k==='hr'||bl[li].k==='tb'))li--;off=bl[li]?bl[li].v.length:0;}else off=Math.min(c.off,bl[li].v.length);
  var cur=bl[li]||{k:rkDef(bk),v:''};
  var rep=[{k:cur.k,v:cur.v.slice(0,off),l:cur.l||'',d:cur.d||0,s:cur.s||''}].concat(ids.map(function(i){return {k:'i',v:i};}),[{k:cur.k,v:cur.v.slice(off),l:'',d:cur.d||0}]);
  bl.splice.apply(bl,[Math.max(li,0),bl[li]?1:0].concat(rep));
  rteSave(nid,bl);
}
function rteSetDef(el,k){if(el.getAttribute('data-bk')==='1')ui.rkb=k;else ui.rki=k;}
function rteTrack(){
  var el=$('.rte3');if(!el)return;
  var s=rteSelGet(el);
  if(s){ui.rsel=s;ui.rcar=s.a;}
  var c=s?s.a:null;if(!c)return;
  var ch=el.children[c.li];
  if(ch&&ch.classList.contains('ln')){
    rteSetDef(el,rkOf(ch));
    var sz=$('#rtz');if(sz&&document.activeElement!==sz)sz.value=ch.getAttribute('data-z')||16;
    var stl=$('#rtstyle');if(stl&&document.activeElement!==stl)stl.value=ch.getAttribute('data-s')||'';
  }
  if(el.getAttribute('contenteditable')==='true'&&!RF.dn)rteSyncPage(el);      /* 마우스로 끌어 고르는 동안엔 쪽을 바꾸지 않는다 */
}
/* ── 서식 단추들 ── */
function rteFmt(el,cmd){rteOp(el,function(){document.execCommand('styleWithCSS',false,true);document.execCommand(cmd,false,null);});}
function rteColor(el,idx){
  var sel=window.getSelection(),collapsed=!sel||!sel.rangeCount||sel.getRangeAt(0).collapsed;
  var s=rteSelGet(el);
  if(s&&s.a.li===s.b.li&&s.a.off===s.b.off)collapsed=true;
  if(collapsed){
    rteOp(el,function(){rteSelLines(el).forEach(function(c){c.classList.remove('n','s','m','c');c.classList.add(RKIND[idx]);var spans=c.querySelectorAll('[class^="t"],span[style]');});rteSetDef(el,RKIND[idx]);});
  }else{
    rteOp(el,function(){
      document.execCommand('styleWithCSS',false,true);
      document.execCommand('foreColor',false,['#000001','#1d4ed8','#be185d','#15803d'][idx]);
    });
  }
}
function rteHl(el){
  rteOp(el,function(){
    var sel=window.getSelection(),r=sel&&sel.rangeCount?sel.getRangeAt(0):null,on=false;
    if(r){
      var nd=r.startContainer;nd=nd.nodeType===1?nd:nd.parentElement;
      if(nd&&nd.closest&&nd.closest('mark'))on=true;
      if(!on&&!r.collapsed)on=Array.prototype.some.call(el.querySelectorAll('mark'),function(m){return r.intersectsNode(m);});
    }
    if(on&&r){
      Array.prototype.slice.call(el.querySelectorAll('mark')).forEach(function(m){
        if(r.intersectsNode(m)||m.contains(r.startContainer)){while(m.firstChild)m.parentNode.insertBefore(m.firstChild,m);m.parentNode.removeChild(m);}
      });
    }else{
      document.execCommand('styleWithCSS',false,true);
      document.execCommand('hiliteColor',false,'#fff3a3');
    }
  });
}
function rteStyle(el,v){
  rteOp(el,function(){rteSelLines(el).forEach(function(c){if(v)c.setAttribute('data-s',v);else c.removeAttribute('data-s');});});
}
var BULS={b:'•',b1:'○',b2:'■',b3:'➤',b4:'✔',b5:'–',b6:'★'};
function rteBullet(el,v){
  rteOp(el,function(){rteSelLines(el).forEach(function(c){c.setAttribute('data-l',v);});});
}
function rteList(el,type){
  if(type==='b')type=ui.rbs||'b';
  rteOp(el,function(){
    var ls=rteSelLines(el);if(!ls.length)return;
    var all=ls.every(function(c){return c.getAttribute('data-l')===type;});
    ls.forEach(function(c){if(all)c.removeAttribute('data-l');else c.setAttribute('data-l',type);});
  });
}
function rteIndent(el,dlt){
  rteOp(el,function(){
    rteSelLines(el).forEach(function(c){
      var d=Math.max(0,Math.min(2,(+c.getAttribute('data-d')||0)+dlt));   /* 들여쓰기는 두 번까지 */
      if(d)c.setAttribute('data-d',d);else c.removeAttribute('data-d');
    });
  });
}
function rteHr(el){
  if(!el||el.getAttribute('contenteditable')!=='true')return;
  var bk=el.getAttribute('data-bk')==='1',bl=rteParse(el),c=rteCaretOf(el)||ui.rcar||{li:bl.length-1,off:0},li=Math.min(c.li,bl.length-1);
  rteUndoPush();
  bl.splice(li+1,0,{k:'hr',v:''},{k:rkDef(bk),v:''});
  el.innerHTML=rteHtml(bl);rteNormalize(el,bk);
  if(INV[ui.inv])rteSave(ui.inv,rteParse(el));
  rteFit(el);rteSetCaret(el,li+2,0);rteSyncPage(el);
  RU.cur=rteSnap(el);RU.t=0;
}

/* ── 정렬 · 글자 크기 · 체크박스 · 인용 · 표 · 접기 · 찾기/바꾸기 ── */
function rteAlign(el,v){
  rteOp(el,function(){rteSelLines(el).forEach(function(c){if(v)c.setAttribute('data-a',v);else c.removeAttribute('data-a');});});
}
function rteSize(el,n){
  n=Math.round(+n);
  rteOp(el,function(){rteSelLines(el).forEach(function(c){
    if(n>=10&&n<=48&&n!==16){c.setAttribute('data-z',n);c.style.fontSize=n+'px';}
    else{c.removeAttribute('data-z');c.style.fontSize='';if(!c.getAttribute('style'))c.removeAttribute('style');}
  });});
}
/* 전체 폭 칸(3단을 가로지름)은 글 맨 위에서만: 위쪽에서부터 이어진 칸만 인정한다 */
function rteSpanFix(el){
  var ok=true;
  Array.prototype.forEach.call(el.children,function(c){
    if(c.getAttribute&&c.getAttribute('data-sp')==='1'){
      if(!ok||!(c.classList.contains('ln')||c.classList.contains('tbl')))c.removeAttribute('data-sp');
    }else ok=false;
  });
}
function rteSpan(el){
  if(!el||el.getAttribute('contenteditable')!=='true')return;
  var kids=Array.prototype.slice.call(el.children),cell=rteInCell(),s=rteSelGet(el)||ui.rsel,a,b;
  if(cell){a=b=kids.indexOf(cell.closest('.tbl'));}else if(s){a=Math.min(s.a.li,s.b.li);b=Math.max(s.a.li,s.b.li);}else{a=b=kids.length-1;}
  var lead=0;while(lead<kids.length&&kids[lead].getAttribute('data-sp')==='1')lead++;
  var allOn=true,i;for(i=a;i<=b;i++){if(!kids[i]||kids[i].getAttribute('data-sp')!=='1')allOn=false;}
  var say=function(t){ui.invmsg=t;var im=$('#imsg');if(im)im.textContent=t;};
  if(!allOn&&a>lead){say('전체 폭 칸은 글 맨 위에서만 쓸 수 있어요. 맨 위 줄에서 눌러 주세요.');return;}
  rteOp(el,function(){
    var k2=Array.prototype.slice.call(el.children),j;
    if(allOn){for(j=a;j<k2.length;j++)k2[j].removeAttribute('data-sp');}      /* 끄면 그 아래 전체 폭 칸도 같이 끈다(위에서부터 이어져야 하므로) */
    else{for(j=a;j<=b;j++){var c=k2[j];if(c&&(c.classList.contains('ln')||c.classList.contains('tbl')))c.setAttribute('data-sp','1');}}
  });
}
/* 예전에 잠깐 있던 📄 템플릿으로 바뀐 메모를 원래대로 되돌린다.
   템플릿 틀이 비어 있으면 틀을 지우고 「📥 원본 받아쓰기」 아래의 원래 글만 남기고, 틀에 글을 쓴 적이 있으면 틀은 두고 원본을 펼쳐 둔다. */
function tplRepair(n){
  var raw=Array.isArray(n.bl)?n.bl:[],mi=-1,i;
  for(i=0;i<raw.length;i++){var x=raw[i];if(x&&x.k!=='i'&&x.k!=='hr'&&x.k!=='tb'&&/^📥 원본 받아쓰기/.test(x.v||'')){mi=i;break;}}
  if(mi<0)return false;
  var pre=raw.slice(0,mi),post=raw.slice(mi+1).map(function(y){var z=Object.assign({},y);delete z.sp;return z;});
  var labelRe=/^(🎯|📌|📊|①|②|③|④|⑤|💭|✅|🔁|📰|❓)/,lbRe=/^(누가|언제|어디서|무엇을|왜|어떻게|출처|1차 자료인가) —$/;
  var pristine=pre.every(function(y){
    if(y.k==='tb')return (y.c||[]).slice(y.w).every(function(c){return !c;});
    if(y.k==='i'||y.k==='hr')return false;
    var v=String(y.v||'').trim();
    return !v||labelRe.test(v)||lbRe.test(v)||v==='다른 곳에서도 확인했다';
  });
  var nb;
  if(pristine){nb=post.length?post:[{k:'n',v:''}];}
  else{nb=raw.map(function(y,j){if(j!==mi)return y;var z=Object.assign({},y);delete z.f;return z;});}
  rteSave(n.id,nb);
  return true;
}
/* ── 단 시작: 1·2·3단 맨 위에서 글 시작 / 빈 단을 눌러 거기서 시작 / 요약 박스 ── */
function rteColumnOf(el,node){
  var rs=node.getClientRects(),r=rs[0];if(!r)return 0;
  var k=rteK(el),er=el.getBoundingClientRect(),g=rteGeom(el),cwA=(el.offsetWidth-(g.cols-1)*g.gap)/g.cols,stride=cwA+g.gap;
  return Math.floor(((r.left-er.left)/k+4)/stride);
}
function rteColStride(el){var g=rteGeom(el);return ((el.offsetWidth-(g.cols-1)*g.gap)/g.cols)+g.gap;}
function rteColCheck(el){
  var g=rteGeom(el),bad=false;
  Array.prototype.forEach.call(el.querySelectorAll('.ln[data-cb="1"][data-ct]'),function(l){
    if(l.getAttribute('data-cs')==='1'||l.classList.contains('fh')||l.getAttribute('data-sp')==='1'){l.removeAttribute('data-bad');return;}
    var ct=+l.getAttribute('data-ct'),col=rteColumnOf(el,l)%g.cols;
    if(g.cols>1&&col!==ct){l.setAttribute('data-bad','1');bad=true;}else l.removeAttribute('data-bad');
  });
  var im=$('#imsg');
  if(bad&&im){ui.invmsg='⚠ 앞 글이 한 단을 넘쳐서 단 시작 줄이 밀렸어요(빨간 선). 앞 글을 줄이거나 단 시작을 풀어 주세요.';im.textContent=ui.invmsg;}
  else if(im&&ui.invmsg&&ui.invmsg.indexOf('⚠ 앞 글이')===0){ui.invmsg='';im.textContent='';}
}
function rteMkSpacer(){var d=document.createElement('div');d.className='ln n';d.setAttribute('data-cs','1');d.setAttribute('data-cb','1');d.innerHTML='<br>';return d;}
function rteColStart(el,t){
  if(!el||el.getAttribute('contenteditable')!=='true')return;
  var g=rteGeom(el);if(g.cols<2){ui.invmsg='화면이 좁아 한 단으로 보여요. 단 시작은 3단 화면에서 쓸 수 있어요.';var im0=$('#imsg');if(im0)im0.textContent=ui.invmsg;return;}
  var sl=rteSelGet(el)||ui.rsel,line=sl?el.children[sl.a.li]:null;
  if(!line||!line.classList.contains('ln')||line.getAttribute('data-cs')==='1')return;
  rteOp(el,function(){
    line.removeAttribute('data-cb');line.removeAttribute('data-ct');            /* 먼저 강제로 넘겨 둔 것을 풀고, 자연스러운 자리에서 다시 계산한다 */
    var pv=line.previousElementSibling;
    while(pv&&pv.getAttribute('data-cs')==='1'){var pp=pv.previousElementSibling;pv.parentNode.removeChild(pv);pv=pp;}
    var w=rteColumnOf(el,line)%g.cols;
    if(t>w){
      var need=t-w-(line.previousElementSibling?1:0);                /* 글 맨 앞 줄이면 자리 채울 빈 줄이 하나 더 필요하다 */
      for(var i=0;i<need;i++)line.parentNode.insertBefore(rteMkSpacer(),line);
      line.setAttribute('data-cb','1');line.setAttribute('data-ct',String(t));
    }
  });
}
/* 글이 끝난 곳보다 오른쪽 빈 단을 눌렀을 때: 거기서부터 글이 시작되게 빈 단을 건너뛴다 */
function rteBlankClick(e){
  var host=e.target;
  if(!host||!host.classList||!host.classList.contains('rte3')||host.getAttribute('contenteditable')!=='true')return false;
  if(RF.md!==host)return false;
  var g=rteGeom(host);if(g.cols<2)return false;
  var k=rteK(host),er=host.getBoundingClientRect(),stride=rteColStride(host);
  var C=Math.floor(((e.clientX-er.left)/k)/stride);
  var kids=Array.prototype.slice.call(host.children),last=null,i;
  for(i=kids.length-1;i>=0;i--){if(kids[i].getAttribute('data-cs')!=='1'&&!kids[i].classList.contains('fh')){last=kids[i];break;}}
  if(!last)return false;
  var rs=last.getClientRects(),lr=rs[rs.length-1];if(!lr)return false;
  var L=Math.floor((((lr.left-er.left)/k)+4)/stride);
  if(C<=L||C>L+g.cols*3)return false;
  var bk=host.getAttribute('data-bk')==='1',bl=rteParse(host);
  rteUndoPush();
  var lastB=bl[bl.length-1],need=C-L,reuse=lastB&&lastB.k!=='tb'&&lastB.k!=='i'&&lastB.k!=='hr'&&!lastB.v&&!lastB.cs&&!lastB.sp&&!lastB.l;
  var base=reuse?bl.pop():{k:rkDef(bk),v:''},j;
  for(j=0;j<need-1;j++)bl.push({k:'n',v:'',cs:1,cb:1});
  base.cb=1;base.ct=((C%g.cols)===1||(C%g.cols)===2)?(C%g.cols):0;if(!base.ct)delete base.ct;bl.push(base);
  host.innerHTML=rteHtml(bl);rteNormalize(host,bk);
  if(INV[ui.inv])rteSave(ui.inv,rteParse(host));
  rteFit(host);rteSetCaret(host,host.children.length-1,0);rteSyncPage(host);
  RU.cur=rteSnap(host);RU.t=0;
  e.preventDefault();return true;
}
function rteSummaryBox(el){
  if(!el||el.getAttribute('contenteditable')!=='true')return;
  var bk=el.getAttribute('data-bk')==='1',sl=rteSelGet(el)||ui.rsel,li=sl?sl.a.li:el.children.length-1,kids=Array.prototype.slice.call(el.children),cur=kids[li];
  if(cur&&cur.getAttribute('data-bx')==='1'){            /* 박스 안에서 누르면 박스를 풀어 준다 */
    rteOp(el,function(){var a=li,b=li,k2=Array.prototype.slice.call(el.children);
      while(a>0&&k2[a-1].getAttribute('data-bx')==='1')a--;while(b<k2.length-1&&k2[b+1].getAttribute('data-bx')==='1')b++;
      for(var j=a;j<=b;j++)k2[j].removeAttribute('data-bx');});
    return;
  }
  var bl=rteParse(el);
  var H=function(t){return {k:'n',v:t,h:'<b>'+esc(t)+'</b>',s:'h3',bx:1};},BX=function(o){return Object.assign({k:'n',v:'',bx:1},o||{});};
  rteUndoPush();
  var at=Math.max(0,Math.min(li+1,bl.length));
  bl.splice(at,0,H('🎯 결론'),BX(),H('📌 핵심 3줄'),BX({l:'b2'}),BX({l:'b2'}),BX({l:'b2'}));
  el.innerHTML=rteHtml(bl);rteNormalize(el,bk);rteSpanFix(el);
  if(INV[ui.inv])rteSave(ui.inv,rteParse(el));
  rteFit(el);rteSetCaret(el,at+1,0);rteSyncPage(el);
  RU.cur=rteSnap(el);RU.t=0;
}
function rteTableNew(el,w){
  if(!el||el.getAttribute('contenteditable')!=='true')return;
  w=TW(w);
  var bk=el.getAttribute('data-bk')==='1',bl=rteParse(el),c=rteCaretOf(el)||ui.rcar||{li:bl.length-1,off:0},li=Math.min(c.li,bl.length-1);
  rteUndoPush();
  var cells=[];for(var i=0;i<w*3;i++)cells.push('');
  bl.splice(li+1,0,{k:'tb',w:w,c:cells},{k:rkDef(bk),v:''});
  el.innerHTML=rteHtml(bl);rteNormalize(el,bk);
  if(INV[ui.inv])rteSave(ui.inv,rteParse(el));
  rteFit(el);
  var tb=el.children[li+1];if(tb){var td=tb.querySelector('td');if(td){el.focus({preventScroll:true});rteCellFocus(td);}}
  rteSyncPage(el);
  RU.cur=rteSnap(el);RU.t=0;
}
function rteTableOp(el,tb,op){
  if(!el||!tb)return;
  rteUndoPush();
  var w=TW(tb.getAttribute('data-w')),body=tb.querySelector('tbody');
  if(op==='tbdel'){tb.parentNode.removeChild(tb);}
  else if(op==='tbrow'){var tr=document.createElement('tr');for(var k=0;k<w;k++){var c=document.createElement('td');c.innerHTML='<br>';tr.appendChild(c);}body.appendChild(tr);}
  else if(op==='tbrowdel'){if(body.rows.length>1)body.removeChild(body.lastElementChild);}
  rteReload(el);
}
/* 줄 왼쪽의 ☐/☑ 칸이나 제목 오른쪽 ▾ 를 눌렀을 때(보기·편집 모두) */
function rteHandleDown(e){
  var h=e.target&&e.target.closest?e.target.closest('.rh'):null;if(!h)return;
  var fig=h.closest('figure.im'),host=fig&&fig.closest('.rte3'),img=fig&&fig.querySelector('img');
  if(!host||host.getAttribute('contenteditable')!=='true'||!img)return;
  e.preventDefault();rteUndoPush();
  var k=rteK(host),y0=e.clientY,h0=img.getBoundingClientRect().height/k,maxH=Math.max(60,host.clientHeight-24);
  var mv=function(ev){var nh=Math.max(40,Math.min(maxH,h0+(ev.clientY-y0)/k));img.style.height=nh+'px';fig.setAttribute('data-h',Math.round(nh));};
  var up=function(){
    document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);
    if(INV[ui.inv])rteSave(ui.inv,rteParse(host));
    rteFit(host);RU.cur=rteSnap(host);RU.t=0;
  };
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
}
function rteMarkClick(e){
  var ln=e.target&&e.target.closest?e.target.closest('.rte3 .ln'):null;if(!ln)return false;
  var host=ln.closest('.rte3'),rc=ln.getBoundingClientRect(),l=ln.getAttribute('data-l')||'',st=ln.getAttribute('data-s')||'',hit=false;
  if(l==='k'||l==='kx'){var pad=parseFloat(getComputedStyle(ln).paddingLeft)||0;var kk=rteK(host);if((e.clientX-rc.left)/kk<pad&&e.clientX>=rc.left)hit='chk';}
  if(!hit&&/^h[123]$/.test(st)&&e.clientX>rc.right-30*rteK(host))hit='fold';
  if(!hit)return false;
  var edit=host.getAttribute('contenteditable')==='true';
  if(edit)rteUndoPush();
  if(hit==='chk')ln.setAttribute('data-l',l==='k'?'kx':'k');
  else{if(ln.getAttribute('data-fold')==='1')ln.removeAttribute('data-fold');else ln.setAttribute('data-fold','1');}
  if(edit)rteReload(host);
  else{if(INV[ui.inv])rteSave(ui.inv,rteParse(host));rteFit(host);}
  e.preventDefault();return true;
}
function rteTextNodes(host){
  var out=[],w=document.createTreeWalker(host,NodeFilter.SHOW_TEXT,null),nd;
  while((nd=w.nextNode())){var pe=nd.parentElement;if(pe&&pe.closest('.tbar,.ix,.fh'))continue;if(nd.nodeValue)out.push(nd);}
  return out;
}
function rteMatches(host,q){
  var out=[];if(!q)return out;var lq=q.toLowerCase();
  rteTextNodes(host).forEach(function(nd){var t=nd.nodeValue.toLowerCase(),i=-1;while((i=t.indexOf(lq,i+1))>=0)out.push({n:nd,i:i,len:q.length});});
  return out;
}
function rteFindUpdate(){
  var host=$('.rte3'),o=$('#rtfcnt');if(!host||!o)return;
  var m=rteMatches(host,ui.rfq||'');o.textContent=ui.rfq?(m.length?((Math.min(ui.rfi||0,m.length-1)+1)+' / '+m.length+'개'):'없음'):'';
}
function rteFindGo(dir){
  var host=$('.rte3');if(!host)return;
  var m=rteMatches(host,ui.rfq||'');if(!m.length){rteFindUpdate();return;}
  var i=ui.rfn?(ui.rfi||0):((ui.rfi||0)+(dir||1));ui.rfn=false;
  i=((i%m.length)+m.length)%m.length;ui.rfi=i;
  var x=m[i],r=document.createRange();r.setStart(x.n,x.i);r.setEnd(x.n,x.i+x.len);
  var sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);
  rteSyncPage(host);rteFindUpdate();
}
function rteReplaceOne(){
  var host=$('.rte3');if(!host||host.getAttribute('contenteditable')!=='true')return;
  var m=rteMatches(host,ui.rfq||'');if(!m.length)return;
  var i=Math.min(ui.rfi||0,m.length-1),x=m[i];
  rteUndoPush();
  x.n.nodeValue=x.n.nodeValue.slice(0,x.i)+(ui.rfr||'')+x.n.nodeValue.slice(x.i+x.len);
  ui.rfn=true;rteReload(host);rteFindGo(0);
}
function rteReplaceAll(){
  var host=$('.rte3');if(!host||host.getAttribute('contenteditable')!=='true'||!ui.rfq)return;
  var re=new RegExp(ui.rfq.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),cnt=0,rp=ui.rfr||'';
  rteUndoPush();
  rteTextNodes(host).forEach(function(nd){nd.nodeValue=nd.nodeValue.replace(re,function(){cnt++;return rp;});});
  rteReload(host);ui.rfi=0;ui.invmsg=cnt?(cnt+'곳을 바꿨어요'):'바꿀 글이 없어요';
  var im=$('#imsg');if(im)im.textContent=ui.invmsg;rteFindUpdate();
}
function rteCellFocus(td){
  var r=document.createRange();r.selectNodeContents(td);r.collapse(false);
  var sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);
}
function rteCellMove(el,td,dir){
  var tb=td.closest('.tbl'),w=TW(tb.getAttribute('data-w')),cells=Array.prototype.slice.call(tb.querySelectorAll('td')),i=cells.indexOf(td),j=dir==='down'?i+w:i+dir;
  if(j<0)j=0;
  if(j>=cells.length){                    /* 끝 칸에서 한 번 더 → 새 줄 */
    rteUndoPush();
    var tr=document.createElement('tr');for(var k=0;k<w;k++){var c=document.createElement('td');c.innerHTML='<br>';tr.appendChild(c);}
    tb.querySelector('tbody').appendChild(tr);
    cells=Array.prototype.slice.call(tb.querySelectorAll('td'));j=Math.min(cells.length-w+(dir==='down'?i%w:0),cells.length-1);
    if(INV[ui.inv])rteSave(ui.inv,rteParse(el));rteFit(el);RU.cur=rteSnap(el);RU.t=0;
  }
  rteCellFocus(cells[j]);
}
function rteKey(e){
  var t=e.target;
  if(e.key==='Enter'&&t&&t.id==='rtfq'){e.preventDefault();rteFindGo(e.shiftKey?-1:1);return;}
  if(!t||!t.classList||!t.classList.contains('rte3')||t.getAttribute('contenteditable')!=='true')return;
  if(e.key==='Enter'&&!e.shiftKey)RF.enter=true;
  var mod=e.ctrlKey||e.metaKey;
  if(mod&&(e.key==='z'||e.key==='Z')){e.preventDefault();if(e.shiftKey)rteRedo(t);else rteUndo(t);return;}
  if(mod&&(e.key==='y'||e.key==='Y')){e.preventDefault();rteRedo(t);return;}
  if(mod&&(e.key==='b'||e.key==='B')){e.preventDefault();rteFmt(t,'bold');return;}
  if(mod&&(e.key==='i'||e.key==='I')){e.preventDefault();rteFmt(t,'italic');return;}
  if(mod&&(e.key==='1'||e.key==='2'||e.key==='3')){e.preventDefault();rteColor(t,+e.key);return;}
  var cell=rteInCell();
  if(cell&&(e.key==='Tab'||e.key==='Enter')){e.preventDefault();rteCellMove(t,cell,e.key==='Enter'?(e.shiftKey?-1:'down'):(e.shiftKey?-1:1));return;}
  if(e.key==='Tab'){e.preventDefault();rteIndent(t,e.shiftKey?-1:1);return;}
  if(e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey){
    var c=rteCaretOf(t),ln=c?t.children[c.li]:null;
    if(ln&&ln.classList.contains('ln')&&ln.getAttribute('data-l')&&!ln.textContent.length){
      e.preventDefault();
      if(+ln.getAttribute('data-d')>0)rteIndent(t,-1);else rteOp(t,function(){ln.removeAttribute('data-l');});
    }
  }
}
function rteBeforeInput(e){
  var t=e.target;
  if(t&&t.classList&&t.classList.contains('rte3')&&(e.inputType==='historyUndo'||e.inputType==='historyRedo')){e.preventDefault();if(e.inputType==='historyUndo')rteUndo(t);else rteRedo(t);}
}
document.addEventListener('mouseup',function(){RF.dn=false;},true);
document.addEventListener('pointerup',function(){RF.dn=false;},true);
function rteMouseDown(e){RF.md=e.target;RF.dn=true;if(e.target&&e.target.closest&&e.target.closest('.rtw button'))e.preventDefault();}
function rtbHtml(bk){
  var L=RKN[bk?'book':'inv'];
  var sw=[['0','기본(검정)','n'],['1',L.s,'s'],['2',L.m,'m'],['3',L.c,'c']].map(function(x){return '<button type="button" class="rtcb c'+x[0]+'" data-act="rtcolor" data-v="'+x[0]+'" title="글 색: '+x[1]+' (Ctrl+'+x[0]+')" aria-label="글 색 '+x[1]+'"><span>가</span></button>';}).join('');
  var ic=function(d){return '<svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true"><path d="'+d+'" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';};
  return '<div class="rtw" role="toolbar" aria-label="글 서식">'
    +'<button type="button" data-act="rtundo" title="실행 취소 (Ctrl+Z)" aria-label="실행 취소">↶</button><button type="button" data-act="rtredo" title="다시 실행 (Ctrl+Y)" aria-label="다시 실행">↷</button><i class="rts"></i>'
    +'<select id="rtstyle" data-f="rtstyle" aria-label="문단 스타일"><option value="">본문</option><option value="h1">제목 1</option><option value="h2">제목 2</option><option value="h3">제목 3</option><option value="q">인용</option></select>'
    +'<input type="number" id="rtz" class="rtz" data-f="rtsize" min="10" max="48" step="1" value="16" title="글자 크기(숫자, 기본 16 = 12pt)" aria-label="글자 크기">'
    +'<button type="button" class="fb" data-act="rtfmt" data-v="bold" title="굵게 (Ctrl+B)"><b>B</b></button><button type="button" class="fi" data-act="rtfmt" data-v="italic" title="기울임 (Ctrl+I)"><i>I</i></button><button type="button" class="fs" data-act="rtfmt" data-v="strikeThrough" title="취소선"><s>S</s></button><button type="button" class="fh" data-act="rthl" title="형광펜"><span>가</span></button>'
    +'<i class="rts"></i><span class="rtcs" title="글 색">'+sw+'</span><i class="rts"></i>'
    +'<button type="button" data-act="rtalign" data-v="" title="왼쪽 정렬" aria-label="왼쪽 정렬">'+ic('M1 2h14M1 6h9M1 10h12')+'</button><button type="button" data-act="rtalign" data-v="c" title="가운데 정렬" aria-label="가운데 정렬">'+ic('M1 2h14M4 6h8M2 10h12')+'</button><button type="button" data-act="rtalign" data-v="r" title="오른쪽 정렬" aria-label="오른쪽 정렬">'+ic('M1 2h14M6 6h9M3 10h12')+'</button><i class="rts"></i>'
    +'<button type="button" data-act="rtlist" data-v="b" title="글머리 기호(고른 모양으로)">☰ •</button><select id="rtbul" data-f="rtbul" class="rtbulsel" title="글머리 기호 모양 고르기" aria-label="글머리 기호 모양">'+Object.keys(BULS).map(function(k){return '<option value="'+k+'"'+((ui.rbs||'b')===k?' selected':'')+'>'+BULS[k]+'</option>';}).join('')+'</select><button type="button" data-act="rtlist" data-v="n" title="번호 매기기">1.</button><button type="button" data-act="rtlist" data-v="k" title="체크박스 줄(☐ 을 눌러 체크)">☑</button><button type="button" data-act="rtindent" data-v="-1" title="내어쓰기 (Shift+Tab)">⇤</button><button type="button" data-act="rtindent" data-v="1" title="들여쓰기 (Tab, 두 번까지)">⇥</button><i class="rts"></i>'
    +'<button type="button" data-act="rthr" title="구분선 넣기">― 구분선</button><button type="button" data-act="rtsum" title="요약 박스(결론 + 핵심 3줄)를 커서 아래 단 안에 넣어요. 박스 안에서 다시 누르면 박스를 풀어요">🎯 요약 박스</button><button type="button" data-act="rtspan" title="맨 위 전체 폭 칸으로(3단을 가로지르는 큰 칸, 요약·큰 표용)">▭ 전체 폭</button><select id="rttbl" data-f="rttbl" class="rtbulsel" title="표 넣기" aria-label="표 넣기"><option value="">▦ 표</option><option value="2">2열 표</option><option value="3">3열 표</option><option value="4">4열 표(넓게)</option></select><button type="button" data-act="rtfind" title="찾기 / 바꾸기" aria-pressed="'+(!!ui.rfind)+'">🔍</button></div>';
}
function rtfHtml(){
  return '<div class="irow2 rtfr"><input type="text" id="rtfq" data-f="rtfq" placeholder="찾을 말" value="'+esc(ui.rfq||'')+'"><input type="text" id="rtfr" data-f="rtfr" placeholder="바꿀 말" value="'+esc(ui.rfr||'')+'"><button type="button" class="btn xs" data-act="rtfprev">▲</button><button type="button" class="btn xs" data-act="rtfnext">▼ 다음</button><button type="button" class="btn xs" data-act="rtfrep">바꾸기</button><button type="button" class="btn xs" data-act="rtfall">모두 바꾸기</button><span class="note" id="rtfcnt"></span><span class="isp"></span><button type="button" class="btn xs" data-act="rtfind">닫기</button></div>';
}
function growTA(){}
function growAll(){}
function vBook(){return vInv('book');}
function vInv(kind){
  var dk=kind==='diary',bk=kind==='book'||dk,kd=dk?'diary':bk?'book':'inv',all=dk?[]:invSorted(kd);
  var sel=dk?dyNote(ui.date):(ui.inv&&INV[ui.inv]&&!INV[ui.inv].del&&INV[ui.inv].k!=='diary'&&(isBookN(INV[ui.inv])===bk)?INV[ui.inv]:null);
  if(dk){ui.inv=sel?sel.id:'';ui.redit=!ui.dview;}                  /* 일기는 열면 바로 쓸 수 있다(완료를 누르면 읽기 화면) */
  else if(!sel&&all.length){sel=all[0];ui.inv=sel.id;ui.redit=false;ui.rpage=0;}     /* 닫았다 열어도 가장 최근 기록이 그대로 보인다 */
  var editing=!!ui.redit&&!!sel;
  var pick=(!bk&&ui.newpick)?'<span class="newpick" role="group" aria-label="새 메모 분류">'+ITAGS.map(function(t){return '<button type="button" class="btn xs" data-act="invnewtag" data-v="'+esc(t)+'">'+t+'</button>';}).join('')+'<button type="button" class="btn xs" data-act="invnewtag" data-v="">분류 없이</button><button type="button" class="btn xs" data-act="invnewcancel" aria-label="취소">✕</button></span>':'';
  var dyn=dk?(function(){var a0=ui.date.split('-').map(Number);return '<button class="btn xs" data-act="nav" data-v="-1" aria-label="전날">‹ 전날</button><b class="dyd">'+a0[1]+'월 '+a0[2]+'일 ('+DOWN[dow(ui.date)]+')'+(ui.date===TODAY?' · 오늘':'')+'</b><button class="btn xs" data-act="nav" data-v="1" aria-label="다음 날">다음 날 ›</button><button class="btn xs" data-act="today">오늘</button><button type="button" class="btn sm" data-act="recopen" data-v="diary">📂 저장된 기록 ('+Object.keys(S.note).filter(function(k){return dayAny(S.note[k]);}).length+')</button><button type="button" class="btn xs" data-act="lkset" aria-pressed="'+(!!ui.lkopen)+'" title="접속 코드 설정">⚙ 설정</button><button type="button" class="btn xs hbclose" data-act="hbclose">닫기 ✕</button>';})():'';
  var newb=dk?dyn:'<button type="button" class="btn pri sm" data-act="invnew">＋ 새 '+(bk?'독서 기록':'메모')+'</button>'+pick+'<button type="button" class="btn sm" data-act="recopen" data-v="'+kd+'">📂 저장된 기록 ('+all.length+')</button>';
  var ed;
  if(!sel){
    ed='<div class="card cfx iempty"><p style="font-size:16px"><b>'+(bk?'📚 독서 기록':'💹 투자 메모')+'</b>가 아직 없어요.</p><div class="iact2">'+newb+'</div>'+(INVERR?'<p class="lkwarn">⚠ '+esc(INVERR)+'</p>':'')+'</div>';
  }else{
    if(tplRepair(sel)){sel=INV[sel.id]||sel;}
    var im=sel.im||[],u=safeUrl(sel.u),bl=rteBlocks(sel,bk);invImgEnsure(im);
    var ro=editing?'':' readonly';
    var cols='<div class="rtstage"><div class="rtpaper"><div class="rtph" id="rtph">'+rtHeadHtml(sel)+'</div><div class="rtewrap"><div class="rte3" id="rte" contenteditable="'+(editing?'true':'false')+'" spellcheck="true" lang="ko" data-f="rte" data-bk="'+(bk?1:0)+'" data-ph="'+(dk?'오늘 하루를 적어 보세요. 사진은 붙여넣거나 📷 사진으로 글 사이에 넣을 수 있어요.':bk?'읽은 내용을 적어 보세요. 글 중간에 커서를 두고 📷 사진을 넣으면 그 자리에 들어가요.':'복사해 온 자료는 붙여넣고(자동으로 파랑), 내 생각은 그냥 쓰세요(분홍). 사진도 글 사이에 넣을 수 있어요.')+'">'+rteHtml(bl)+'</div></div></div>';
    var bchips=(bk&&!dk)?('<label class="mnl" title="읽은 시간(분)">⏱ 읽은 시간 <input type="number" class="mnin" min="0" max="9999" inputmode="numeric" data-f="inv:mn" placeholder="0" value="'+(sel.mn>0?sel.mn:'')+'"'+ro+'> 분</label><button type="button" class="chk'+(sel.dn?' on':'')+'" data-act="bookdone" aria-pressed="'+(!!sel.dn)+'">'+(sel.dn?'✅ 완독':'☐ 완독')+'</button>'):'';
    var row2=dk?'':(!bk?(editing?'<select class="itagsel" data-f="invtagsel" aria-label="분류"><option value="">분류 없음</option>'+ITAGS.map(function(t){return '<option value="'+esc(t)+'"'+(tagN(sel.g)===t?' selected':'')+'>'+t+'</option>';}).join('')+'</select>':(sel.g?'<span class="dtg">'+esc(tagN(sel.g))+'</span>':'')):'');
    var tools=(editing
      ?'<label class="btn xs" title="사진 추가">📷 사진<input type="file" accept="image/*" multiple hidden data-f="invfile"></label>'
      :'')+'<button type="button" class="btn xs" data-act="invprint" title="A4 용지로 인쇄">🖨 인쇄</button><button type="button" class="btn xs" data-act="invprint1" title="무조건 A4 한 장에 맞춰 인쇄(글자를 줄여서)">🖨 한 장</button>'+(editing?'<button type="button" class="btn xs pri" data-act="invdone">✔ 완료</button>':'<button type="button" class="btn xs pri" data-act="invedit">✏ 편집</button>');
    var pager='<span class="rtpg"><select id="rtlh" data-f="rtlh" class="rtbulsel" title="줄 간격" aria-label="줄 간격">'+[['1.35','줄 촘촘'],['1.6','줄 보통'],['1.85','줄 넓게']].map(function(o){return '<option value="'+o[0]+'"'+(Math.abs(rteLH()-o[0])<0.01?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select><button type="button" class="btn xs" data-act="rtwide" title="종이를 화면 가로 폭만큼 넓게 / A4 비율로 보기(인쇄는 언제나 A4)" aria-pressed="'+rteWide()+'">↔</button><button type="button" class="btn xs" id="rtpg-prev" data-act="rtpg" data-v="-1" aria-label="이전 쪽">‹</button><span id="rtpgn">1 / 1</span><button type="button" class="btn xs" id="rtpg-next" data-act="rtpg" data-v="1" aria-label="다음 쪽">›</button></span>';
    ed='<div class="card cfx ied'+(editing?' editing':' viewing')+'">'+(INVERR?'<div class="lkwarn">⚠ '+esc(INVERR)+'</div>':'')
      +'<div class="irow2 itop">'+newb
      +(dk?'<span class="isp"></span>':'<input type="text" class="ititle" data-f="inv:t" spellcheck="true" lang="ko" placeholder="'+(bk?'책 제목':'제목 (예: 삼성전자 실적 메모)')+'" value="'+esc(sel.t||'')+'"'+ro+'>')
      +(dk?'':(bk?'<input type="text" class="iurl ipage" data-f="inv:u" placeholder="읽은 쪽 (예: 45~60)" value="'+esc(sel.u||'')+'"'+ro+'>':'<input type="text" class="iurl" data-f="inv:u" placeholder="출처 링크(선택)" value="'+esc(sel.u||'')+'"'+ro+'><a class="btn xs" id="urlGo" href="'+esc(u||'#')+'" target="_blank" rel="noopener noreferrer"'+(u?'':' hidden')+'>열기 ↗</a>'))
      +(bchips?'<span class="chips sm bchips" role="group" aria-label="독서 정보">'+bchips+'</span>':'')
      +tools+(dk?'':'<button type="button" class="btn xs'+(ui.armed==='invdel'?' danger':'')+'" data-act="invdel">'+(ui.armed==='invdel'?'휴지통으로 보내기':'🗑 삭제')+'</button>')+'</div>'
      +'<div class="irow2 r2">'+(row2?'<div class="chips sm" role="group" aria-label="'+(bk?'독서 정보':'분류')+'">'+row2+'</div>':'')+(editing?rtbHtml(bk):'')+'<span class="isp"></span><span class="note imsg" id="imsg">'+esc(ui.invmsg||((editing?'편집 중 · ':'')+'사진 '+im.length+'장 · '+fmtTs(sel.m)))+'</span>'+pager+'</div>'
      +(editing&&ui.rfind?rtfHtml():'')+cols+'</div>';
  }
  var big=(ui.invbig&&imgSrc(ui.invbig))?'<div class="ibig" data-act="invbigclose"><img src="'+imgSrc(ui.invbig)+'" alt="확대한 사진"><span>눌러서 닫기</span></div>':'';
  return '<div class="iv">'+ed+'</div>'+recHtml()+big;
}

/* ───────── 🖨 인쇄: A4 가로 한 장 = 3단 한 쪽 ───────── */
function rtHeadHtml(n){
  var bk=isPlainN(n),meta=[];
  if(bk){if(n.u)meta.push(n.u+(/쪽|p|P|페이지/.test(n.u)?'':'쪽'));if(n.mn>0)meta.push('⏱ '+fmtMin(n.mn));if(n.dn)meta.push('완독');}
  else{if(n.g)meta.push(tagN(n.g));}          /* 출처 링크는 인쇄·용지 머리줄에 넣지 않는다 */
  return '<b>'+esc(n.t||(bk?'(책 제목 없음)':'(제목 없음)'))+'</b><span class="dt">'+esc(recDate(n.m))+'</span>'+(meta.length?'<span>'+meta.map(esc).join(' · ')+'</span>':'');
}
function invPrint(one){
  var n=INV[ui.inv];if(!n)return;
  var LH=one?1.5:0;window.__hbImgScale=1;
  var bk=isPlainN(n),el=$('.rte3'),bl=el?rteParse(el):rteBlocks(n,bk);
  var host=(document.querySelector('#hbRoot .hbwrap'))||document.body;
  var old=document.getElementById('hbPrint');if(old)old.parentNode.removeChild(old);
  var area=document.createElement('div');area.id='hbPrint';area.className='mea';
  host.appendChild(area);
  var P=PAPER,gap=30,cols=3,cw=Math.floor((P.BW-(cols-1)*gap)/cols)-1,pw=P.BW+gap;
  var tmp=document.createElement('div');tmp.innerHTML=rteHtml(bl);rteNums(tmp);
  Array.prototype.forEach.call(tmp.querySelectorAll('.ix,.tbar,.rh,.rhr'),function(x){x.parentNode.removeChild(x);});
  var html=tmp.innerHTML;
  var mk=function(i,total){
    var pg=document.createElement('div');pg.className='pp';
    pg.innerHTML='<div class="pph">'+rtHeadHtml(n)+'<i>'+(i+1)+' / '+total+'</i></div><div class="ppb"><div class="rte3 rte3p'+(one?' one':'')+'" style="'+(one?'line-height:'+LH+';--lh:'+LH+';':'--lh:'+rteLH()+';')+'width:'+P.BW+'px;height:'+P.BH+'px;column-width:'+cw+'px;column-gap:'+gap+'px;transform:'+(i?'translateX('+(-i*pw)+'px)':'none')+'">'+html+'</div></div>';
    return pg;
  };
  /* 글자 크기 자동 맞춤: 11pt 이상 14pt 이하. 11pt 로 필요한 쪽 수 안에서 가장 큰 글자를 쓴다(화면과 같은 방식) */
  var BASE=FONT.BASE,MINPX=FONT.MIN,MAXPX=FONT.MAX,probe=mk(0,1);area.appendChild(probe);
  var pe=probe.querySelector('.rte3p');
  var fit=function(px){
    pe.style.fontSize=px+'px';pe.style.height=rteSnapH(px,one?LH:rteLH(),P.BH);
    Array.prototype.forEach.call(pe.querySelectorAll('[data-z]'),function(l){l.style.fontSize=(+l.getAttribute('data-z')*px/BASE).toFixed(2)+'px';});
    rteFolds(pe);
    return Math.max(1,Math.ceil((pe.scrollWidth+gap-3)/pw));
  };
  var need,px;
  if(one){                                   /* 한 장 인쇄: 무조건 1쪽 — 줄 간격을 줄이고, 1쪽에 들어가는 가장 큰 글자를 찾는다 */
    px=0;
    for(var t1=MAXPX;t1>=3;t1-=0.25){if(fit(t1)<=1){px=t1;break;}}
    if(!px){                                 /* 글자 3px 로도 넘치면(큰 사진·표) 사진을 줄인다 */
      px=3;
      for(var sc=0.9;sc>=0.25&&fit(px)>1;sc-=0.1){Array.prototype.forEach.call(pe.querySelectorAll('figure.im img'),function(im){im.style.width=Math.round(sc*100)+'%';});}
      window.__hbImgScale=sc;
    }
  }else{
    need=fit(MINPX);px=MINPX;
    for(var t=MAXPX;t>MINPX+0.05;t-=0.5){if(fit(t)<=need){px=t;break;}}
  }
  var pages=fit(px);
  area.innerHTML='';
  for(var i=0;i<pages;i++){
    var q=mk(i,pages),qe=q.querySelector('.rte3p');
    qe.style.fontSize=px+'px';qe.style.height=rteSnapH(px,one?LH:rteLH(),P.BH);
    if(one&&window.__hbImgScale&&window.__hbImgScale<1)Array.prototype.forEach.call(qe.querySelectorAll('figure.im img'),function(im){im.style.width=Math.round(window.__hbImgScale*100)+'%';});
    Array.prototype.forEach.call(qe.querySelectorAll('[data-z]'),function(l){l.style.fontSize=(+l.getAttribute('data-z')*px/BASE).toFixed(2)+'px';});
    area.appendChild(q);rteFolds(qe);
  }
  window.__hbPrintPx=px;window.__hbPrintOne=!!one;
  ui.invmsg=(one?'한 장 인쇄: 글자 ':'인쇄: 글자 ')+(Math.round(px*0.75*10)/10)+'pt · '+pages+'쪽'+(one&&px*0.75<6?' · 글자가 아주 작아요(글이 너무 길어요)':'');var im0=$('#imsg');if(im0)im0.textContent=ui.invmsg;
  area.className='';
  var done=function(){var a=document.getElementById('hbPrint');if(a&&a.parentNode)a.parentNode.removeChild(a);window.removeEventListener('afterprint',done);};
  window.addEventListener('afterprint',done);
  window.__hbPrintPages=pages;
  setTimeout(function(){
    var imgs=Array.prototype.slice.call(area.querySelectorAll('img')),left=imgs.length,go=function(){try{window.print();}catch(e){}};
    if(!left){go();return;}
    var dn=function(){if(--left<=0)go();};
    imgs.forEach(function(im){if(im.complete)dn();else{im.onload=dn;im.onerror=dn;}});
  },60);
}
/* ───────── 📂 저장된 기록 (업무일지의 보기 방식: 카드 · 목록) ───────── */
function recDate(ms){var d=new Date(ms||0);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function partsOf(n,bk){
  var out=[],cur=null;
  rteBlocks(n,bk).forEach(function(x){
    if(x.k==='tb'){var tt=(x.c||[]).filter(Boolean).join(' | ');if(tt){cur=null;out.push([RKN[bk?'book':'inv'].n||'▦ 표',tt,'n']);}return;}
    if(x.k==='i'||!x.v){return;}
    var tv=(x.l&&x.l.charAt(0)==='b'?(BULS[x.l]||'•')+' ':x.l==='n'?'▸ ':'')+x.v;
    if(cur&&cur[2]===x.k)cur[1]+='\n'+tv;
    else{cur=[RKN[bk?'book':'inv'][x.k],tv,x.k];out.push(cur);}
  });
  return out;
}
function recItems(kind){
  var r=ui.rec,q=(r.q||'').trim().toLowerCase(),out=[];
  if(kind==='diary'){
    Object.keys(S.note).sort().reverse().forEach(function(d){
      var n=S.note[d];if(!dayAny(n))return;
      var dyx=n.bx&&!isEnc(n.bx),dyim=[];
      if(dyx){try{dyim=(JSON.parse(n.bx).im||[]).slice();}catch(e){}}
      var parts=dyx?[['📝 일기',dyPlain(n)]]:[['📌 하나',tx(n.th)],['📄 둘',dayD(n)],['📎 셋',tx(n.sc)]],txt=parts.map(function(p){return p[1];}).join(' ');
      if(q&&txt.toLowerCase().indexOf(q)<0&&d.indexOf(q)<0)return;
      out.push({id:d,date:d,title:d.slice(0,4)+'.'+d.slice(5,7)+'.'+d.slice(8)+' ('+DOWN[dow(d)]+')',sub:'',tag:'',parts:parts,snip:txt.replace(/\s+/g,' ').slice(0,100),img:dyim[0]||'',imgs:dyim,mn:0,dn:false});
    });
  }else{
    var bk=kind==='book',ft=bk?'':(r.tag||'');
    invSorted(kind).forEach(function(n){
      if(ft&&tagN(n.g)!==ft)return;if(bk&&r.done&&!n.dn)return;
      var parts=partsOf(n,bk),txt=(n.t||'')+' '+parts.map(function(p){return p[1];}).join(' ')+' '+(n.u||'')+' '+(n.g||'');
      if(q&&txt.toLowerCase().indexOf(q)<0)return;
      out.push({id:n.id,imgs:(n.im||[]).slice(),date:recDate(n.m),title:n.t||(bk?'(책 제목 없음)':'(제목 없음)'),sub:bk?(n.u?n.u+(/쪽|p|P|페이지/.test(n.u)?'':'쪽'):''):(n.u||''),tag:bk?'':tagN(n.g),parts:parts,snip:parts.map(function(p){return p[1];}).join(' ').replace(/\s+/g,' ').slice(0,100),img:(n.im||[])[0]||'',mn:n.mn>0?+n.mn:0,dn:!!n.dn});
    });
  }
  return out;
}
var RVIEWS=[['card','▦ 카드'],['big','☰ 리스트'],['list','≣ 목록'],['cal','📅 달력'],['gal','📷 갤러리']];
function recBody(items,view,kind){
  var r=ui.rec;
  if(view==='cal')return recCal(items,kind);
  if(!items.length)return '<p class="note" style="padding:12px">'+(r.q||r.tag||r.done?'찾는 기록이 없어요.':'저장된 기록이 아직 없어요.')+'</p>';
  var at=function(it){return ' data-act="recgo" data-id="'+it.id+'" data-date="'+it.date+'" data-kind="'+kind+'"';};
  var bad=function(it){return (it.dn?'<span class="dtg done">✅ 완독</span>':'')+(it.mn>0?'<span class="dtg">⏱ '+fmtMin(it.mn)+'</span>':'')+(it.tag?'<span class="dtg">'+esc(it.tag)+'</span>':'')+(it.sub?'<span class="dtg">'+esc(it.sub)+'</span>':'');};
  var prev=function(it,n,len){return it.parts.slice(0,n).map(function(p){return p[1]?'<div class="rp '+(p[2]||'')+'"><i>'+p[0]+'</i> '+esc(String(p[1]).replace(/\s+/g,' ').slice(0,len))+'</div>':'';}).join('');};
  if(view==='list'){
    return '<div class="rlist"><div class="rrow head"><span>날짜</span><span>제목</span><span>정보</span><span>미리보기</span></div>'+items.map(function(it){
      return '<button type="button" class="rrow"'+at(it)+'><span class="rd">'+it.date+'</span><b>'+esc(it.title)+'</b><span class="rb">'+bad(it)+'</span><em>'+esc(it.snip)+'</em></button>';
    }).join('')+'</div>';
  }
  if(view==='big'){
    return '<div class="rbigl">'+items.map(function(it){
      return '<button type="button" class="rbig"'+at(it)+'><div class="rbd0"><b>'+esc(it.title)+'</b><span class="rdate">'+it.date+'</span></div><div class="rbd">'+bad(it)+'</div>'+prev(it,4,200)+'</button>';
    }).join('')+'</div>';
  }
  if(view==='gal'){
    var ph=[];
    items.forEach(function(it){(it.imgs||[]).forEach(function(id){ph.push({id:id,it:it});});});
    if(!ph.length)return '<p class="note" style="padding:12px">'+(kind==='diary'?'여기에는 사진이 없어요.':'사진이 있는 기록이 아직 없어요.')+'</p>';
    var shown=ph.slice(0,80);invImgEnsure(shown.map(function(x){return x.id;}));
    return '<div class="rgal">'+shown.map(function(x){var src=imgSrc(x.id);
      return '<button type="button" class="rgi"'+at(x.it)+' title="'+esc(x.it.title)+'"><img'+(src?' src="'+src+'"':' class="wait"')+' data-iid="'+x.id+'" alt=""><span>'+esc(x.it.title)+'</span></button>';}).join('')+'</div>'+(ph.length>80?'<p class="note">사진 '+ph.length+'장 중 80장만 보여 줘요. 검색으로 좁혀 보세요.</p>':'');
  }
  var ids=[];
  var h='<div class="rgridc">'+items.map(function(it,i){
    if(it.img&&i<30)ids.push(it.img);
    var src=it.img?imgSrc(it.img):'';
    return '<button type="button" class="rcard"'+at(it)+'><div class="rch"><b>'+esc(it.title)+'</b><span class="rdate">'+it.date+'</span></div><div class="rbd">'+bad(it)+'</div>'+prev(it,4,60)
      +(it.img?'<img class="rimg'+(src?'':' wait')+'"'+(src?' src="'+src+'"':'')+' data-iid="'+it.img+'" alt="">':'')+'</button>';
  }).join('')+'</div>';
  invImgEnsure(ids);
  return h;
}
function recCal(items,kind){
  var r=ui.rec,ym=r.month||TODAY.slice(0,7),first=ym+'-01',last=lastOfMonth(first),lead=dow(first),by={};
  items.forEach(function(it){(by[it.date]=by[it.date]||[]).push(it);});
  var a=ym.split('-').map(Number);
  var h='<div class="rcalh"><button type="button" class="nb" data-act="recmon" data-v="-1" aria-label="이전 달">‹</button><b>'+a[0]+'년 '+a[1]+'월</b><button type="button" class="nb" data-act="recmon" data-v="1" aria-label="다음 달">›</button><button type="button" class="btn xs" data-act="recmon" data-v="0">이번 달</button></div>';
  h+='<div class="rcal">'+DOWN.map(function(d){return '<div class="rcw">'+d+'</div>';}).join('');
  for(var i=0;i<lead;i++)h+='<div class="rcd off"></div>';
  days(first,last).forEach(function(d){
    var its=by[d]||[],n=its.length;
    h+='<button type="button" class="rcd'+(n?' has':'')+(d===TODAY?' today':'')+(r.day===d?' sel':'')+'" data-act="recday" data-date="'+d+'"'+(n?'':' disabled')+'><span class="dn">'+parseInt(d.slice(8),10)+'</span>'+(n?'<span class="cn">'+n+'건</span><span class="ct">'+esc(its[0].title.slice(0,10))+'</span>':'')+'</button>';
  });
  h+='</div>';
  var sel=r.day&&by[r.day]?by[r.day]:null;
  if(sel){
    h+='<div class="rdayl"><b>'+r.day+' ('+DOWN[dow(r.day)]+') · '+sel.length+'건</b>'+sel.map(function(it){
      return '<button type="button" class="rrow day" data-act="recgo" data-id="'+it.id+'" data-date="'+it.date+'" data-kind="'+kind+'"><b>'+esc(it.title)+'</b><em>'+esc(it.snip)+'</em></button>';}).join('')+'</div>';
  }else h+='<p class="note" style="padding:8px">기록이 있는 날을 누르면 그날 기록이 아래에 나와요.</p>';
  return h;
}
function recTrashHtml(k,ttl){
  var arr=invTrash(k),now=Date.now();
  var rows=arr.length?arr.map(function(n){
    var left=Math.max(0,Math.ceil((n.del+TRASH_MS-now)/86400000)),bk=k==='book';
    return '<div class="trrow"><div class="trt"><b>'+esc(n.t||(bk?'(책 제목 없음)':'(제목 없음)'))+'</b><span class="note">'+fmtTs(n.del)+' 삭제 · '+left+'일 뒤 완전히 지워져요'+((n.im||[]).length?' · 사진 '+(n.im||[]).length+'장':'')+'</span></div>'
      +'<button type="button" class="btn xs pri" data-act="trrestore" data-id="'+n.id+'">↩ 되살리기</button>'
      +'<button type="button" class="btn xs'+(ui.armed==='trdel:'+n.id?' danger':'')+'" data-act="trdel" data-id="'+n.id+'">'+(ui.armed==='trdel:'+n.id?'정말 완전 삭제':'완전 삭제')+'</button></div>';
  }).join(''):'<p class="note" style="padding:12px">휴지통이 비어 있어요. 지운 메모는 여기에 30일 동안 보관돼요.</p>';
  return '<div class="recmod" data-act="recbg"><div class="recsheet" role="dialog" aria-label="휴지통">'
    +'<div class="rech2"><h2>🗑 휴지통 · '+ttl+' <i>'+arr.length+'건</i></h2><span class="isp"></span><button type="button" class="btn sm" data-act="rectrash">← 저장된 기록</button><button type="button" class="btn sm" data-act="recclose">닫기 ✕</button></div>'
    +'<div class="recbody" id="recbody">'+rows+'</div></div></div>';
}
function recHtml(){
  if(!ui.rec)return '';
  var r=ui.rec,k=r.kind,items=recItems(k);
  var ttl=k==='diary'?'🗂 자료실':k==='book'?'📚 독서':'💹 투자';
  if(r.trash&&k!=='diary')return recTrashHtml(k,ttl);
  var extra=k==='inv'?'<div class="chips sm"><button type="button" data-act="rectag" data-v="" aria-pressed="'+(!r.tag)+'">전체</button>'+ITAGS.map(function(t){return '<button type="button" data-act="rectag" data-v="'+t+'" aria-pressed="'+(r.tag===t)+'">'+t+'</button>';}).join('')+'</div>':k==='book'?'<button type="button" class="chk'+(r.done?' on':'')+'" data-act="recdone" aria-pressed="'+(!!r.done)+'">✅ 완독만</button>'+(function(){var bs=bookSummary();return '<span class="bsum">'+bs.books+'권 · ✅ 완독 '+bs.done+'권 · ⏱ 총 '+fmtMin(bs.min)+'</span>';})():'';
  return '<div class="recmod" data-act="recbg"><div class="recsheet" role="dialog" aria-label="저장된 기록">'
    +'<div class="rech2"><h2>📂 저장된 기록 · '+ttl+' <i>'+items.length+'건</i></h2>'
    +'<div class="rv" role="group" aria-label="보기 방식">'+RVIEWS.map(function(v){return '<button type="button" data-act="recview" data-v="'+v[0]+'" aria-pressed="'+((r.view||'card')===v[0])+'">'+v[1]+'</button>';}).join('')+'</div>'
    +'<input type="text" id="recq" data-f="recq" placeholder="🔍 검색" value="'+esc(r.q||'')+'">'+extra+'<span class="isp"></span>'+(k==='diary'?'':'<button type="button" class="btn sm" data-act="rectrash">🗑 휴지통 ('+invTrash(k).length+')</button>')+'<button type="button" class="btn sm" data-act="recclose">닫기 ✕</button></div>'
    +'<div class="recbody" id="recbody">'+recBody(items,r.view,k)+'</div></div></div>';
}
function shrinkImg(file,max,q){
  return new Promise(function(res,rej){
    var fr=new FileReader();
    fr.onerror=rej;
    fr.onload=function(){var im=new Image();im.onerror=rej;im.onload=function(){
      var k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));
      var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);
      res(c.toDataURL('image/jpeg',q));};im.src=fr.result;};
    fr.readAsDataURL(file);
  });
}
function invAddFiles(files){
  var n=INV[ui.inv];if(!n||!files||!files.length)return;
  var list=Array.prototype.slice.call(files).filter(function(f){return /^image\//.test(f.type);});
  if(!list.length)return;
  var added=[],skipped=0,failed=0,nid=ui.inv;
  var have=function(){return ((INV[nid]&&INV[nid].im)||[]).length+added.length;};
  list.reduce(function(p,f){
    return p.then(function(){
      if(have()>=IMG_MAX){skipped++;return;}
      var tries=[[1000,.62],[760,.5],[560,.4]];
      return tries.reduce(function(q,t){
        return q.then(function(u){return (u&&u.length<=IMG_BYTES)?u:shrinkImg(f,t[0],t[1]);});
      },Promise.resolve(null)).then(function(u){
        if(!u||u.length>IMG_BYTES){skipped++;return;}
        return invImgPut(u).then(function(id){added.push(id);}).catch(function(){failed++;});
      });
    });
  },Promise.resolve()).then(function(){
    ui.invmsg=failed?('사진 '+failed+'장을 클라우드에 올리지 못했어요. 연결을 확인해 주세요.'):skipped?('기록 한 건에 사진은 '+IMG_MAX+'장까지예요. '+skipped+'장은 넣지 못했어요.'):'';
    if(INV[nid]&&added.length)rteInsertImgs(nid,added);
    if(ui.inv===nid)render();
  }).catch(function(){ui.invmsg='사진을 읽지 못했어요.';render();});
}
function invPaste(e){
  if((ui.tab!=='inv'&&ui.tab!=='book'&&ui.tab!=='diary')||!ui.inv||!INV[ui.inv]||!ui.redit)return;   /* 읽기 화면에서는 붙여넣어도 사진이 들어가지 않는다 */
  var cd=e.clipboardData;if(!cd)return;
  var files=[];if(cd.items)for(var i=0;i<cd.items.length;i++){var it=cd.items[i];if(it.kind==='file'&&/^image\//.test(it.type)){var f=it.getAsFile();if(f)files.push(f);}}
  var host=e.target&&e.target.closest?e.target.closest('.rte3'):null;
  if(host)ui.rcar=rteCaretOf(host)||ui.rcar;
  if(files.length){e.preventDefault();invAddFiles(files);return;}
  if(host){e.preventDefault();var t=cd.getData('text/plain');if(t){if(rteInCell())document.execCommand('insertText',false,t.replace(/\s*\n\s*/g,' '));else rteInsertText(host,t);}}
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
    +'<label class="fl">이름<input type="text" id="newName" placeholder="예: 비타민 먹기 · 커피 참기 · 독서" maxlength="30"></label>'
    +'<label class="fl">종류<select class="f" id="newMode" data-f="newMode"><option value="do">하기 — 정한 횟수만큼 하면 달성</option><option value="avoid">참기 — 하지 말아야 할 것 (마신 만큼 +1)</option><option value="count">횟수 세기 — 몇 번 했는지 기록</option><option value="amount">시간 재기 — 몇 분 했는지 숫자로 기록</option></select></label>'
    +'<div id="newModeWrap" style="display:flex;gap:10px;flex-wrap:wrap" hidden><label class="fl" style="flex:1 1 160px"><span id="newLimLab">하루 한도 (0 = 아예 안 하기)</span><input type="number" id="newLim" min="0" max="99" value="0"></label><label class="fl" style="flex:1 1 100px" id="newUnit2Wrap">단위<input type="text" id="newUnit2" placeholder="잔, 번" maxlength="6"></label></div>'
    +'<div id="newDoWrap"><div style="display:flex;gap:10px;flex-wrap:wrap"><label class="fl" style="flex:1 1 140px">주기<select class="f" id="newType" data-f="newType"><option value="daily">매일</option><option value="week">주 N회</option><option value="month">월 N회</option></select></label>'
    +'<label class="fl" id="newNWrap" style="flex:1 1 100px" hidden>횟수<input type="number" id="newN" min="1" max="31" value="2"></label>'
    +'<label class="fl" style="flex:1 1 100px">하루에 몇 번<input type="number" id="newPer" min="1" max="30" value="1"></label>'
    +'<label class="fl" style="flex:1 1 100px">단위<input type="text" id="newUnit" placeholder="잔, 회, 분" maxlength="6"></label></div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap"><label class="fl" style="flex:1 1 140px">첫 시각(선택, 숫자로)<input type="text" class="tin" id="newAt" data-f="newAt" inputmode="numeric" autocomplete="off" placeholder="예: 0800" maxlength="5"></label>'
    +'<label class="fl" style="flex:1 1 140px">몇 시간마다(선택)<input type="number" id="newEvery" min="1" max="12" placeholder="예: 6"></label></div></div>'
    +'<p class="note" style="margin:0">하루에 여러 번 하는 습관은 「하루에 몇 번」을 2 이상으로 정하세요. 비타민을 8시부터 6시간마다 3번 먹는다면 3번, 첫 시각 0800, 6시간마다로 두면 08:00·14:00·20:00 예정 시각이 카드에 표시되고, 스탬프를 찍을 때 실제 시각이 기록돼요. 시각은 숫자만 치면 됩니다(800, 0800, 830 모두 가능).</p>'
    +'<div><button class="btn pri" data-act="add">추가</button> <span class="note">추가한 날부터 달성률에 반영돼요. 지난 기록은 바뀌지 않습니다.</span></div></div>';
  h+='<div class="card"><h2>내 습관 ('+act.length+')</h2>';
  if(!act.length)h+='<p class="note">진행 중인 습관이 없어요.</p>';
  act.forEach(function(x,i){
    h+='<div class="mrow"><div class="big">'+esc(x.icon)+'</div><div><div class="ctl"><input type="text" value="'+esc(x.name)+'" data-f="hname" data-id="'+x.id+'" maxlength="30" aria-label="이름">'
      +(modeOf(x)!=='do'?'<span class="note">'+({avoid:'참기',count:'횟수 세기',amount:'시간 재기'})[modeOf(x)]+'</span>':'<select data-f="htype" data-id="'+x.id+'" aria-label="주기"><option value="daily"'+(x.type==='daily'?' selected':'')+'>매일</option><option value="week"'+(x.type==='week'?' selected':'')+'>주 N회</option><option value="month"'+(x.type==='month'?' selected':'')+'>월 N회</option></select>')
      +(x.type!=='daily'?'<input type="number" min="1" max="31" value="'+x.n+'" data-f="hn" data-id="'+x.id+'" aria-label="횟수">':'')+'</div>'
      +(modeOf(x)!=='do'?'<div class="ctl" style="margin-top:6px"><span class="note">'+(modeOf(x)==='avoid'?'하루 한도(0=안 하기)':'하루 목표(0=없음)')+'</span><input type="number" min="0" max="'+(modeOf(x)==='amount'?1440:99)+'" value="'+(modeOf(x)==='avoid'?limOf(x):goalOf(x))+'" data-f="'+(modeOf(x)==='avoid'?'hlim':'hgoal')+'" data-id="'+x.id+'" aria-label="한도 또는 목표">'+(modeOf(x)==='amount'?'<span class="note">분</span>':'<input type="text" class="u" value="'+esc(x.unit||'')+'" data-f="hunit" data-id="'+x.id+'" placeholder="단위" maxlength="6">')+'</div>':
      '<div class="ctl" style="margin-top:6px"><span class="note">하루</span><input type="number" min="1" max="30" value="'+perDay(x)+'" data-f="hper" data-id="'+x.id+'" aria-label="하루 횟수"><input type="text" class="u" value="'+esc(x.unit||'')+'" data-f="hunit" data-id="'+x.id+'" placeholder="단위(잔·회)" maxlength="6" aria-label="단위">'
      +'<span class="note">첫 시각</span><input type="text" class="tin" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="0800" value="'+esc(x.at||'')+'" data-f="hat" data-id="'+x.id+'" aria-label="첫 시각(숫자로)"><input type="number" min="1" max="12" value="'+(x.every||'')+'" data-f="hevery" data-id="'+x.id+'" placeholder="간격" aria-label="몇 시간마다"><span class="note">시간마다</span></div>')
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
  h+='<div class="card"><h2>데이터</h2><p class="note" style="margin:0 0 8px">기록은 Firebase(클라우드)에 저장돼서 휴대폰과 PC가 같은 기록을 씁니다. 이 기기에는 임시로만 보관돼요.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="export">'+(ui.showExport?'내보내기 닫기':'JSON 내보내기')+'</button></div>';
  if(ui.showExport)h+='<div style="margin-top:10px"><pre class="json" id="exportBox">'+esc(JSON.stringify({habits:S.habits,logs:S.logs,times:S.times,mood:S.mood,memo:S.memo}))+'</pre><div style="margin-top:6px"><button class="btn sm" data-act="copy">복사</button> <span class="note" id="copyMsg"></span></div></div>';
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
  rteFitAll();
  var fit=FIT_MQ&&FIT_MQ.matches&&ROOT().classList.contains('fit');
  if(!fit){fb.style.removeProperty('--k');fb.removeAttribute('data-dn');layoutCards();drawCharts();return;}
  var kmax=(ui.tab==='inv'||ui.tab==='book'||ui.tab==='diary')?1:1.5,start=Math.min(kmax,(kmemo[ui.tab]||kmax)+0.09),k;
  if(ui.tab==='month'){
    /* 체크 표는 체크만 보면 되니, 전체를 줄이기 전에 표만 먼저 촘촘하게 줄인다 */
    for(var d=0;d<=2;d++){fb.setAttribute('data-dn',d);k=searchK(fb,d===0?start:1.5);if(k>=0.95||d===2)break;}
  }else k=searchK(fb,start);
  kmemo[ui.tab]=k;
  drawCharts();
}
function tabsNow(){return TABS.filter(function(t){return t[0]!=='diary';});}
function render(){
  var t0=ymd(new Date());if(t0!==TODAY){TODAY=t0;}                          /* 화면을 켜 둔 채 날짜가 바뀌면 오늘을 새로 잡는다 */
  ui.sp=ui.tab==='diary'?'diary':'habit';
  var h1=$('.top h1');if(h1)h1.textContent=ui.sp==='diary'?'자료실':'습관 체크리스트';
  var dpb=$('#hbDiaryBtn');if(dpb)dpb.classList.toggle('on',ui.tab==='diary');
  var tcl=document.querySelector('#hbRoot .top .hbclose');if(tcl)tcl.hidden=(ui.tab==='diary'&&!(typeof isLocked==='function'&&isLocked()));   /* 일기에서는 닫기를 저장된 기록·설정 옆으로 옮긴다 */
  if(typeof updateSync==='function')updateSync();
  if(!ROOT())return;
  ensureFrom(viewStart());
  ROOT().classList.toggle('fit',ui.tab!=='manage');
  updateSync();
  $('#hbTabs').innerHTML=tabsNow().map(function(t){return '<button role="tab" data-act="tab" data-v="'+t[0]+'" aria-selected="'+(ui.tab===t[0])+'">'+t[1]+'</button>';}).join('');
  CH={};
  var fn=(isLocked()&&ui.tab==='diary')?lockHtml:(!ST.ready&&!S.habits.length&&ui.tab!=='manage'&&ui.tab!=='diary')?function(){return '<div class="card empty"><p>클라우드에서 불러오는 중…</p></div>';}:{day:vDay,diary:vDiary,book:vBook,inv:vInv,week:vWeek,month:vMonth,year:vYear,manage:vManage}[ui.tab];
  var v=$('#hbView');
  v.className=ui.tab==='manage'?'narrow':'';
  v.innerHTML='<div class="fitbox">'+fn()+(ui.tab==='manage'?'<p class="note">습관과 기록은 클라우드(Firebase)에 저장되고, 이 기기에는 임시로만 보관됩니다.</p>':'')+'</div>'+modalHtml();
  ui.pop=null;
  autofit();
  if(isLocked()&&ui.tab==='diary'){var ci=$('#hbCode');if(ci&&document.activeElement!==ci)ci.focus();}
  if(ui.focusModal){ui.focusModal=false;var c=$('#mdl .mclose');if(c)c.focus();}
}

/* ───────── 동작 ───────── */
function shiftMonth(ym,n){var a=ym.split('-').map(Number),d=new Date(a[0],a[1]-1+n,1);return d.getFullYear()+'-'+pad(d.getMonth()+1);}
function arm(key){ui.armed=key;render();setTimeout(function(){if(ui.armed===key){ui.armed=null;render();}},3500);}

var onClick=function(e){
  if(rteMarkClick(e))return;
  if(rteBlankClick(e))return;
  var b=e.target.closest&&e.target.closest('[data-act]');if(!b||b.disabled)return;
  var a=b.dataset.act,id=b.dataset.id,v=b.dataset.v,h=id?habitById(id):null;
  if(lockAct(a,b))return;
  if(a==='hbclose'){window.wlHabitsClose();return;}
  if(a==='hbsync'){if(ST.state==='error'||ST.state==='local'){startCloud();flush();}return;}
  if(a==='quick'){var q=QUICK[+v];if(q){S.habits.push({id:uid(),name:q.name,icon:q.icon,color:(S.habits.length%8)+1,type:q.type,n:q.n,perDay:q.perDay,unit:q.unit||'',at:q.at||'',every:q.every||0,start:TODAY,end:null});save();render();}return;}
  if(a==='mclose-bg'){if(e.target===b){ui.modal=null;render();}return;}
  if(a==='mclose'){ui.modal=null;render();return;}
  if(a==='tab'){if(ui.tab==='inv'||ui.tab==='book')invDropEmpty();ui.dview=false;ui.rec=null;ui.redit=false;ui.rpage=0;ui.tab=v;ui.armed=null;ui.modal=null;render();return;}
  if(a==='dslide'){var sl=$('#dlist');if(sl)sl.scrollBy({left:(+v)*sl.clientWidth,behavior:'smooth'});return;}
  if(a==='invnew'||a==='invnewtag'){
    if(a==='invnew'&&ui.tab!=='book'){ui.newpick=!ui.newpick;render();return;}
    ui.newpick=false;
    invDropEmpty();var nid='n'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);invSave(nid,{id:nid,t:'',b:'',u:'',g:a==='invnewtag'?(v||''):'',k:ui.tab==='book'?'book':'',x1:'',x2:'',x3:'',bl:[],im:[]});ui.inv=nid;ui.invmsg='';ui.armed=null;ui.rec=null;ui.redit=true;ui.rpage=0;render();var ti=$('.ititle');if(ti)ti.focus();return;}
  if(a==='invnewcancel'){ui.newpick=false;render();return;}
  if(a==='rtalign'){var ha=$('.rte3');if(ha)rteAlign(ha,v);return;}
  if(a==='rtfind'){ui.rfind=!ui.rfind;render();if(ui.rfind){var fq=$('#rtfq');if(fq)fq.focus();}return;}
  if(a==='rtfnext'){rteFindGo(1);return;}
  if(a==='rtfprev'){rteFindGo(-1);return;}
  if(a==='rtfrep'){rteReplaceOne();return;}
  if(a==='rtfall'){rteReplaceAll();return;}
  if(a==='tbrow'||a==='tbrowdel'||a==='tbdel'){var ht=$('.rte3');if(ht)rteTableOp(ht,b.closest('.tbl'),a);return;}
  if(a==='invedit'){ui.redit=true;ui.dview=false;ui.armed=null;render();var he0=$('.rte3');if(he0){var l0=he0.children.length-1;rteSetCaret(he0,l0,(he0.children[l0].textContent||'').length);}return;}
  if(a==='invdone'){ui.redit=false;if(ui.tab==='diary')ui.dview=true;invDropEmpty();if(ui.tab!=='diary'&&!INV[ui.inv])ui.inv='';ui.armed=null;render();return;}
  if(a==='rtwide'){try{localStorage.setItem('hb_wide',rteWide()?'0':'1');}catch(e){}render();return;}
  if(a==='rtcol'){var hcl=$('.rte3');if(hcl)rteColStart(hcl,+v);return;}
  if(a==='rtsum'){var hsm=$('.rte3');if(hsm)rteSummaryBox(hsm);return;}
  if(a==='rtspan'){var hsp=$('.rte3');if(hsp)rteSpan(hsp);return;}
  if(a==='invprint'){invPrint();return;}
  if(a==='invprint1'){invPrint(true);return;}
  if(a==='hbmode'){if(window.wlHabitsClose)window.wlHabitsClose();var mb=document.querySelector('#wlModeBar [data-wlmode="'+v+'"]');if(mb)mb.click();return;}
  if(a==='hbquick'){
    var qs=document.getElementById('quickMemoSide');
    if(qs&&typeof toggleQuickMemo==='function'){qs.style.zIndex='2147483300';setTimeout(function(){if(!qs.classList.contains('show'))toggleQuickMemo();else{var qt=document.getElementById('qmText');if(qt)qt.focus();}},0);}   /* 업무일지의 '패널 밖 클릭하면 닫힘' 보다 한 박자 늦게 연다 */
    else if(window.SharedMemo&&window.SharedMemo.open)window.SharedMemo.open();
    else alert('급한 메모는 업무일지 화면에서 쓸 수 있어요.');
    return;
  }
  if(a==='rtpg'){var he9=$('.rte3');if(he9)rtePageTo(he9,(ui.rpage||0)+(+v));return;}
  if(a==='recopen'){ui.rec={kind:v,view:(ui.recview||'card'),q:'',tag:'',done:false,month:TODAY.slice(0,7),day:''};render();var rq=$('#recq');if(rq)rq.focus();return;}
  if(a==='rectrash'){ui.rec.trash=!ui.rec.trash;ui.armed=null;try{invPurge();}catch(e){}render();return;}
  if(a==='trrestore'){invRestore(id);ui.invmsg='되살렸어요';render();return;}
  if(a==='trdel'){if(ui.armed!=='trdel:'+id){arm('trdel:'+id);return;}ui.armed=null;invDelete(id);render();return;}
  if(a==='recclose'||(a==='recbg'&&e.target===b)){ui.rec=null;render();return;}
  if(a==='recbg')return;
  if(a==='recview'){ui.rec.view=v;ui.recview=v;render();return;}
  if(a==='recmon'){var rm=ui.rec.month||TODAY.slice(0,7);ui.rec.month=(+v===0)?TODAY.slice(0,7):shiftMonth(rm,+v);ui.rec.day='';render();return;}
  if(a==='recday'){ui.rec.day=ui.rec.day===b.dataset.date?'':b.dataset.date;render();return;}
  if(a==='rectag'){ui.rec.tag=v;render();return;}
  if(a==='recdone'){ui.rec.done=!ui.rec.done;render();return;}
  if(a==='recgo'){
    invDropEmpty();var kd=b.dataset.kind||(ui.rec&&ui.rec.kind);
    if(kd==='diary'){ui.date=b.dataset.date;ui.tab='diary';ui.dview=false;ui.rpage=0;}
    else{ui.inv=b.dataset.id;ui.tab=kd==='book'?'book':'inv';ui.invmsg='';ui.invbig='';ui.redit=false;ui.rpage=0;}
    ui.rec=null;ui.armed=null;render();return;}
  if(a==='rtundo'){var hu=$('.rte3');if(hu)rteUndo(hu);return;}
  if(a==='rtredo'){var hr0=$('.rte3');if(hr0)rteRedo(hr0);return;}
  if(a==='rtfmt'){var hf=$('.rte3');if(hf)rteFmt(hf,v);return;}
  if(a==='rthl'){var hh=$('.rte3');if(hh)rteHl(hh);return;}
  if(a==='rtcolor'){var hc=$('.rte3');if(hc)rteColor(hc,+v);return;}
  if(a==='rthr'){var hz=$('.rte3');if(hz)rteHr(hz);return;}
  if(a==='rthrdel'){var hd=$('.rte3');if(hd){var bx=b.closest('.hr');if(bx){rteUndoPush();bx.parentNode.removeChild(bx);rteReload(hd);}}return;}
  if(a==='rtlist'){var hl=$('.rte3');if(hl)rteList(hl,v);return;}
  if(a==='rtindent'){var hi=$('.rte3');if(hi)rteIndent(hi,+v);return;}
  if(a==='rtimgreset'){var hr1=$('.rte3'),fg1=b.closest('figure.im');if(hr1&&fg1){rteUndoPush();fg1.removeAttribute('data-h');var im1=fg1.querySelector('img');if(im1)im1.style.height='';rteReload(hr1);}return;}
  if(a==='rtimgdel'){var gid=b.dataset.iid2,he2=$('.rte3');invImgDrop(gid);if(he2){var fg=he2.querySelector('figure[data-iid="'+gid+'"]');if(fg)fg.parentNode.removeChild(fg);rteInput(he2);}render();return;}
  if(a==='bookdone'){var nb=INV[ui.inv];if(!nb)return;invSave(ui.inv,{dn:!nb.dn});render();return;}
  if(a==='invtag'){if(!INV[ui.inv])return;invSave(ui.inv,{g:tagN(INV[ui.inv].g)===v?'':v});render();return;}
  if(a==='invbig'){ui.invbig=b.dataset.iid2;render();return;}
  if(a==='islide'){var si=$('#ilist');if(si)si.scrollBy({left:(+v)*si.clientWidth*.8,behavior:'smooth'});return;}
  if(a==='invbigclose'){ui.invbig='';render();return;}
  if(a==='invimgdel'){
    var nn=INV[ui.inv];if(!nn)return;
    var gone=b.dataset.iid2;invImgDrop(gone);
    ui.invmsg='';invSave(ui.inv,{im:(nn.im||[]).filter(function(x){return x!==gone;})});render();return;}
  if(a==='invdel'){if(ui.armed!=='invdel'){arm('invdel');return;}ui.armed=null;invTrashIt(ui.inv);ui.invmsg='휴지통으로 옮겼어요 (30일 보관 · 저장된 기록 › 휴지통에서 되살릴 수 있어요)';ui.inv='';ui.redit=false;ui.rpage=0;render();return;}
  if(a==='invpaste'){
    var nn2=INV[ui.inv];if(!nn2)return;
    if(!navigator.clipboard||!navigator.clipboard.readText){ui.invmsg='이 브라우저는 단추 붙여넣기를 막아요. 글칸을 눌러 Ctrl+V(폰은 길게 눌러 붙여넣기)를 쓰세요.';var m1=$('#imsg');if(m1)m1.textContent=ui.invmsg;return;}
    var hostB=$('.rte3');
    navigator.clipboard.readText().then(function(t){if(t&&hostB&&document.body.contains(hostB)){if(!rteCaretOf(hostB)&&ui.rcar)rteSetCaret(hostB,Math.min(ui.rcar.li,hostB.children.length-1),ui.rcar.off);rteInsertText(hostB,t);}}).catch(function(){var m2=$('#imsg');if(m2)m2.textContent='붙여넣기 권한이 없어요. 글칸에서 Ctrl+V를 쓰세요.';});
    return;}
  if(a==='stamp'){var d0=b.dataset.date;if(d0>TODAY||!h)return;addDose(h,d0);ui.pop=id+'|'+d0+'|'+(getN(h,d0)-1);save();render();return;}
  if(a==='detail'){ui.modal={id:id,date:b.dataset.date};ui.focusModal=true;render();return;}
  if(a==='dose-del'){removeDose(h,b.dataset.date,+b.dataset.i);save();render();return;}
  if(a==='avplus'||a==='cplus'){var d1=b.dataset.date;if(d1>TODAY||!h)return;addDose(h,d1);save();render();return;}
  if(a==='cminus'){var d2=b.dataset.date;if(d2>TODAY||!h)return;removeDose(h,d2);save();render();return;}
  if(a==='avclean'){var d3=b.dataset.date;if(d3>TODAY||!h)return;toggleClean(h,d3);save();render();return;}
  if(a==='amadd'){var inp=document.getElementById('am-'+id);if(inp)amAdd(inp);return;}
  if(a==='toggle'){
    var d=b.dataset.date;if(d>TODAY||!h)return;
    var md=modeOf(h);
    if(md==='avoid'){if(!getN(h,d)){toggleClean(h,d);save();render();}else{ui.modal={id:id,date:d};ui.focusModal=true;render();}return;}
    if(md==='count'){addDose(h,d);save();render();return;}
    if(md==='amount'){ui.modal={id:id,date:d};ui.focusModal=true;render();return;}
    var n0=getN(h,d),pd=perDay(h);
    if(pd===1){if(n0)clearDay(h,d);else addDose(h,d);}else{if(n0>=pd)clearDay(h,d);else addDose(h,d);}
    save();render();return;}
  if(a==='nav'){var n=+v;
    if(ui.tab==='day'||ui.tab==='diary'){ui.date=addDays(ui.date,n);ui.dview=false;ui.rpage=0;}
    else if(ui.tab==='week')ui.date=addDays(ui.date,7*n);
    else if(ui.tab==='month')ui.month=shiftMonth(ui.month,n);
    else if(ui.tab==='year')ui.year+=n;
    render();return;}
  if(a==='dgoto'){ui.date=b.dataset.date;ui.dview=false;ui.rpage=0;render();return;}
  if(a==='dmore'){ui.dlimit=(ui.dlimit||60)+60;render();return;}
  if(a==='dfill-unused'){var cur0=(S.note[ui.date]||{}).d,sm=autoSummary(ui.date);if(isEnc(cur0))return;noteSet(ui.date,'d',cur0?cur0+'\n\n'+sm:sm);save();render();return;}
  if(a==='today'){ui.date=TODAY;ui.dview=false;ui.rpage=0;ui.month=TODAY.slice(0,7);ui.year=+TODAY.slice(0,4);render();return;}
  if(a==='goto'){ui.date=b.dataset.date;ui.tab='day';render();return;}
  if(a==='mood'){var m=+v;if(S.mood[ui.date]===m)delete S.mood[ui.date];else S.mood[ui.date]=m;save();render();return;}
  if(a==='reason'){var cur=memoGet(b.dataset.date,id).r;memoSet(b.dataset.date,id,{r:cur===v?'':v});
    b.parentNode.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.v===v&&cur!==v));});return;}
  if(a==='pick-icon'){ui.icon=v;document.querySelectorAll('#iconPick button').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.v===v));});return;}
  if(a==='pick-color'){ui.color=+v;document.querySelectorAll('#colorPick .cdot').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.v===v));});return;}
  if(a==='hcolor'){if(h){h.color=+v;save();render();}return;}
  if(a==='add'){
    var name=($('#newName').value||'').trim();if(!name){$('#newName').focus();return;}
    var mode=$('#newMode').value;
    if(mode!=='do'){
      var lim0=Math.max(0,Math.min(99,parseInt($('#newLim').value,10)||0)),un0=($('#newUnit2').value||'').trim().slice(0,6);
      S.habits.push({id:uid(),name:name,icon:ui.icon,color:ui.color,type:'daily',n:1,perDay:1,unit:mode==='amount'?'분':un0,at:'',every:0,mode:mode,lim:mode==='avoid'?lim0:0,goal:mode==='avoid'?0:lim0,start:TODAY,end:null});
      ui.color=(ui.color%8)+1;save();render();return;
    }
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
  if(a==='restart'){S.habits.push({id:uid(),name:h.name,icon:h.icon,color:colOf(h),type:h.type,n:h.n,perDay:h.perDay||1,unit:h.unit||'',at:h.at||'',every:h.every||0,mode:h.mode||'',lim:h.lim||0,goal:h.goal||0,start:TODAY,end:null});save();render();return;}
  if(a==='del'){
    if(ui.armed!=='d:'+id){arm('d:'+id);return;}
    ui.armed=null;S.habits.splice(S.habits.indexOf(h),1);
    Object.keys(S.logs).forEach(function(dd){delete S.logs[dd][id];if(!Object.keys(S.logs[dd]).length)delete S.logs[dd];});
    Object.keys(S.times).forEach(function(dd){delete S.times[dd][id];if(!Object.keys(S.times[dd]).length)delete S.times[dd];});
    Object.keys(S.memo).forEach(function(dd){delete S.memo[dd][id];if(!Object.keys(S.memo[dd]).length)delete S.memo[dd];});
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
  if(f==='invfile'){invAddFiles(el.files);el.value='';return;}
  if(f==='recq'){ui.rec.q=el.value;var rb=$('#recbody');if(rb)rb.innerHTML=recBody(recItems(ui.rec.kind),ui.rec.view,ui.rec.kind);var rc=$('.rech2 i');if(rc)rc.textContent=recItems(ui.rec.kind).length+'건';return;}
  if(f==='rte'){rteInput(el);return;}
  if(f==='rtsize'){if(e.type==='change'){var hz=$('.rte3');if(hz)rteSize(hz,el.value);}return;}
  if(f==='rttbl'){if(e.type==='change'&&el.value){var ht2=$('.rte3'),w2=el.value;el.value='';if(ht2)rteTableNew(ht2,w2);}return;}
  if(f==='rtfq'){ui.rfq=el.value;ui.rfi=0;ui.rfn=true;rteFindUpdate();return;}
  if(f==='rtfr'){ui.rfr=el.value;return;}
  if(f==='invtagsel'){if(INV[ui.inv]){invSave(ui.inv,{g:el.value});render();}return;}
  if(f==='rtlh'){try{localStorage.setItem('hb_lh',el.value);}catch(e){}RF.t=0;ui.rpx=0;render();return;}
  if(f==='rtbul'){var hb=$('.rte3');ui.rbs=el.value;if(hb)rteBullet(hb,el.value);return;}
  if(f==='rtstyle'){var hs=$('.rte3');if(hs)rteStyle(hs,el.value);return;}
  if(f.indexOf('inv:')===0){
    if(!INV[ui.inv])return;
    var o={};o[f.slice(4)]=f==='inv:mn'?Math.max(0,Math.min(9999,parseInt(el.value,10)||0)):el.value;invSave(ui.inv,o);
    if(f==='inv:mn'){var sm=$('.bsum');if(sm){var bs2=bookSummary();sm.textContent=bs2.books+'권 · ✅ 완독 '+bs2.done+'권 · ⏱ 총 '+fmtMin(bs2.min);}}
    
    var phh=$('#rtph');if(phh&&INV[ui.inv])phh.innerHTML=rtHeadHtml(INV[ui.inv]);
    if(f==='inv:u'){var ug=$('#urlGo'),su=safeUrl(el.value);if(ug){ug.hidden=!su;ug.href=su||'#';}}
    return;}
  if(f.indexOf('note:')===0){
    noteSet(ui.date,f.slice(5),el.value);save();
    var dc=el.parentNode&&el.parentNode.querySelector('.dcnt');if(dc)dc.textContent=el.value.length+'자 · 자동 저장';
    return;}
  if(f==='dsearch'){ui.dq=el.value;var dl2=$('#dlist');if(dl2)dl2.innerHTML=diaryListHtml();return;}
  if(f==='memoT'){memoSet(el.dataset.date,el.dataset.id,{t:el.value});return;}
  if(e.type!=='change')return;
  if(f==='selY'||f==='selM'){var y=+$('#selY').value,m=+$('#selM').value;ui.month=y+'-'+pad(m);render();return;}
  if(f==='newType'){$('#newNWrap').hidden=el.value==='daily';return;}
  if(f==='newMode'){
    var mv=el.value;$('#newDoWrap').hidden=mv!=='do';$('#newModeWrap').hidden=mv==='do';
    $('#newLimLab').textContent=mv==='avoid'?'하루 한도 (0 = 아예 안 하기)':mv==='count'?'하루 목표 (0 = 목표 없이 세기만)':'하루 목표 분 (0 = 목표 없이 기록만)';
    $('#newUnit2Wrap').hidden=mv==='amount';return;}
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
  else if(f==='hlim'){h.lim=Math.max(0,Math.min(99,parseInt(el.value,10)||0));}
  else if(f==='hgoal'){h.goal=Math.max(0,Math.min(1440,parseInt(el.value,10)||0));}
  else if(f==='hat'){h.at=el.value||'';}
  else if(f==='hevery'){h.every=Math.max(0,Math.min(12,parseInt(el.value,10)||0));}
  save();render();
}
document.addEventListener('pointerdown',rteHandleDown);
/* ───────── 화면 열기·닫기 ───────── */
function build(){
  if(ROOT())return;
  var root=document.createElement('div');
  root.id='hbRoot';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','습관 체크리스트');
  root.innerHTML='<div class="hbwrap"><div class="top"><h1>습관 체크리스트</h1>'
    +'<button class="chip hbnav hbq" id="hbQuick" data-act="hbquick" type="button" title="급한 메모 (Ctrl+Shift+M)">⚡ 급한 메모</button>'
    +'<button class="chip hbnav" data-act="hbmode" data-v="work" type="button" title="업무일지로 가기">🛠 업무일지</button><button class="chip hbnav" data-act="hbmode" data-v="personal" type="button" title="개인일지로 가기">🏠 개인일지</button>'
    +'<button class="chip hbnav hbdiary" id="hbDiaryBtn" data-act="tab" data-v="diary" type="button" title="자료실(접속 코드)">🗂 자료실</button>'
    +'<button class="chip" id="hbLockBtn" data-act="lknow" type="button" hidden>🔑 나가기</button>'
    +'<div class="tabs" id="hbTabs" role="tablist"></div>'
    +'<button class="chip" id="hbSync" data-act="hbsync" type="button"></button>'
    +'<button class="btn sm hbclose" data-act="hbclose" type="button">닫기 ✕</button></div>'
    +'<div class="hbbanner" id="hbBanner" hidden></div><div id="hbView"></div></div>';
  document.body.appendChild(root);
  root.addEventListener('click',onClick);
  root.addEventListener('input',onField);
  root.addEventListener('change',onField);
  root.addEventListener('paste',invPaste);
  root.addEventListener('mousedown',rteMouseDown);
  root.addEventListener('beforeinput',rteBeforeInput);
  document.addEventListener('selectionchange',rteTrack);
  root.addEventListener('focusout',function(){if(ST.pendingRender){ST.pendingRender=false;setTimeout(softRender,0);}});
  root.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target&&e.target.id==='hbCode')doUnlock(e.target.value);if(e.key==='Enter'&&e.target&&e.target.classList&&e.target.classList.contains('amin'))amAdd(e.target);rteKey(e);});
  ['pointerdown','keydown','input'].forEach(function(ev){root.addEventListener(ev,touchIdle,true);});
}
window.wlHabitsOpen=function(v){
  build();
  if(typeof v==='string'&&/^(day|diary|book|inv|week|month|year|manage)$/.test(v))ui.tab=v;
  ui.sp=ui.tab==='diary'?'diary':'habit';ui.lkopen=false;
  var hd=ROOT().querySelector('.top h1');if(hd)hd.textContent=ui.sp==='diary'?'자료실':'습관 체크리스트';
  ui.redit=false;ui.rpage=0;
  var r=ROOT();
  if(!r.classList.contains('open')){ST.prevOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
  r.classList.add('open');
  startCloud();
  render();
  setTimeout(function(){try{invPurge();}catch(e){}},2500);
  touchIdle();
  try{if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if(isOpen())autofit();});}catch(e){}
  var c=r.querySelector(isLocked()&&ui.sp==='diary'?'#hbCode':'.hbclose');if(c)c.focus();
};
window.wlHabitsClose=function(){
  var r=ROOT();if(!r)return;
  var qs0=document.getElementById('quickMemoSide');if(qs0)qs0.style.zIndex='';
  r.classList.remove('open');
  document.body.style.overflow=ST.prevOverflow||'';
  ui.modal=null;ui.rec=null;ui.redit=false;ui.rpage=0;
  try{invDropEmpty();invFlushAll();}catch(e){}
  if(LK.enabled&&LK.lockOnClose)lockNow();
};
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape'||!isOpen())return;
  if(ui.rec){ui.rec=null;render();}else if(ui.modal){ui.modal=null;render();}else window.wlHabitsClose();
});
var rz=null;
window.addEventListener('resize',function(){if(!isOpen())return;clearTimeout(rz);rz=setTimeout(function(){kmemo={};autofit();},100);});

window.addEventListener('pagehide',function(){try{invFlushAll();if(hasDb()&&computeOps().length)flush();}catch(e){}});
document.addEventListener('visibilitychange',function(){try{if(document.visibilityState==='hidden'&&hasDb()&&computeOps().length)flush();}catch(e){}});
prefLoad();
cacheLoad();
S.memo=S.memo||{};S.times=S.times||{};
/* 닫기 전에 못 올린 수정이 있으면 페이지를 열 때 다시 올린다 */
setTimeout(function(){try{if(hasDb()&&computeOps().length)flush();}catch(e){}},4000);
if(window.__HB_TEST)window.__hb={get LK(){return LK;},get S(){return S;},get SY(){return SY;},get ST(){return ST;},get INV(){return INV;},get RU(){return RU;},lockNow:lockNow};
})();

