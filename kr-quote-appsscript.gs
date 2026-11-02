/**
 * 한국 주식 시세 중계 (Google Apps Script 웹 앱)
 *
 * 쓰는 법
 *  1) https://script.google.com → 새 프로젝트 → 이 파일 내용을 전부 붙여넣고 저장
 *  2) 배포 → 새 배포 → 유형 「웹 앱」 → 실행 계정 「나」, 액세스 권한 「모든 사용자」 → 배포
 *  3) 나온 「웹 앱 URL」(…/exec)을 습관 화면 주식 칸의 ✎ 종목 → 「시세 주소」 칸에 붙여넣고 저장
 *
 * 호출: <웹앱URL>?codes=005930,000660&us=AAPL,NVDA  →  {"datas":[{itemCode,closePrice,compareToPreviousClosePrice,fluctuationsRatio,compareToPreviousPrice:{name}}]}
 * 한국(codes): 네이버 모바일 증권을 먼저, 안 되면 야후. 미국(us): 야후. 모두 서버(구글) 쪽에서 대신 불러온다.
 * (v6: 네이버 해외주식 폐장후(주간거래 포함) 가격 우선 / v5: 일반 미국 종목은 시간외·프리 가격과 시간외 포함 그래프 / v4: ?chart=코드&range=1d|5d|1mo|3mo|1y 그래프용 시계열 추가 / v3: ^TNX·CL=F·^SOX 같은 지수·금리·원자재 허용 / v2: 미국 종목 us= 추가 — 이 파일로 바꾼 뒤 「배포 관리 → 수정 → 새 버전」으로 올려야 반영된다)
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.chart) return chartOut_(String(e.parameter.chart), String(e.parameter.range || '1d'), e.parameter.ext === '1');
  var codes = String((e && e.parameter && e.parameter.codes) || '').split(',')
    .filter(function (c) { return /^\d{6}$/.test(c); }).slice(0, 20);
  var us = String((e && e.parameter && e.parameter.us) || '').split(',')
    .filter(function (c) { return /^[\^A-Za-z][A-Za-z0-9.\-=]{0,11}$/.test(c); }).slice(0, 20);   // ^TNX(10년물) · CL=F(유가) · ^SOX 같은 지수·선물도 허용
  var out = [];
  codes.forEach(function (c) {
    var o = fromNaver_(c) || fromYahoo_(c);
    if (o) out.push(o);
  });
  us.forEach(function (sym) {
    var o = fromYahooUS_(sym);
    if (o) out.push(o);
  });
  return ContentService.createTextOutput(JSON.stringify({ datas: out }))
    .setMimeType(ContentService.MimeType.JSON);
}

function fromNaver_(c) {
  try {
    var r = UrlFetchApp.fetch('https://m.stock.naver.com/api/stock/' + c + '/basic',
      { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (r.getResponseCode() !== 200) return null;
    var j = JSON.parse(r.getContentText());
    if (!j || j.closePrice == null) return null;
    return {
      itemCode: c, stockName: j.stockName,
      closePrice: j.closePrice,
      compareToPreviousClosePrice: j.compareToPreviousClosePrice,
      fluctuationsRatio: j.fluctuationsRatio,
      compareToPreviousPrice: j.compareToPreviousPrice
    };
  } catch (err) { return null; }
}

function fromYahoo_(c) {
  var sfx = ['.KS', '.KQ'];
  for (var i = 0; i < sfx.length; i++) {
    try {
      var r = UrlFetchApp.fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + c + sfx[i] + '?range=1d&interval=1d',
        { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.getResponseCode() !== 200) continue;
      var m = JSON.parse(r.getContentText()).chart.result[0].meta;
      var p = m.regularMarketPrice, pv = m.chartPreviousClose;
      if (p == null || pv == null) continue;
      var d = p - pv;
      return {
        itemCode: c, closePrice: String(p), compareToPreviousClosePrice: String(Math.abs(d)),
        fluctuationsRatio: pv ? String(Math.abs(d / pv * 100).toFixed(2)) : '0',
        compareToPreviousPrice: { name: d > 0 ? 'RISING' : d < 0 ? 'FALLING' : 'UNCHANGED' }
      };
    } catch (err) { /* 다음 시도 */ }
  }
  return null;
}

function fromYahooUS_(sym) {
  try {
    var u = sym.toUpperCase();
    var y = /[\^=]/.test(u) ? u : u.replace('.', '-');
    var plain = !/[\^=]/.test(u);   // 일반 미국 종목·ETF만 프리/시간외 가격을 함께 본다
    var r = UrlFetchApp.fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(y) + (plain ? '?range=1d&interval=5m&includePrePost=true' : '?range=1d&interval=1d'),
      { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (r.getResponseCode() !== 200) return null;
    var m = JSON.parse(r.getContentText()).chart.result[0].meta;
    var p = m.regularMarketPrice, pv = m.chartPreviousClose;
    if (p == null || pv == null) return null;
    if (u === '^TNX' && p > 20) { p = p / 10; pv = pv / 10; }   // 예전 표기(금리×10) 대비
    var regP = p, session = '';
    if (plain) {                       // 마지막 정규장 거래 이후의 값이 있으면 시간외(POST)·프리마켓(PRE) 가격으로 본다
      var res = JSON.parse(r.getContentText()).chart.result[0], ts = res.timestamp || [], cl = res.indicators.quote[0].close || [];
      for (var k = ts.length - 1; k >= 0; k--) {
        if (cl[k] == null) continue;
        var rt = m.regularMarketTime;
        if (rt && ts[k] > rt + 60) { session = (ts[k] - rt < 6 * 3600) ? 'POST' : 'PRE'; p = cl[k]; }
        break;
      }
    }
    var d = p - pv, dec = Math.abs(p) < 20 ? 3 : 2;
    var ratio = pv ? Math.abs(d / pv * 100) : 0, base = pv;
    if (plain) {                       // 네이버 해외주식의 「폐장후」(한국 낮 주간거래 포함) 가격이 있으면 그것을 우선한다 — 정규장 종가 대비 등락
      var nv = naverOver_(u);
      if (nv && (nv.status === 'OPEN' || session)) {
        session = /PRE/i.test(nv.type) ? 'PRE' : 'POST';
        regP = nv.reg != null ? nv.reg : regP;
        p = nv.price; d = nv.chg != null ? nv.chg : (p - regP); ratio = nv.ratio != null ? Math.abs(nv.ratio) : (regP ? Math.abs(d / regP * 100) : 0);
        if (nv.dir) d = nv.dir === 'FALLING' ? -Math.abs(d) : nv.dir === 'RISING' ? Math.abs(d) : d;
      }
    }
    var o = {
      itemCode: sym.toUpperCase(), stockName: m.shortName || sym,
      closePrice: String(p), compareToPreviousClosePrice: String(Math.abs(d).toFixed(dec)),
      fluctuationsRatio: String(ratio.toFixed(2)),
      compareToPreviousPrice: { name: d > 0 ? 'RISING' : d < 0 ? 'FALLING' : 'UNCHANGED' }
    };
    if (session) { o.session = session; o.regularClose = String(regP); }
    return o;
  } catch (err) { return null; }
}

// ───── v6: 네이버 해외주식 「폐장후」 가격(overMarketPriceInfo) ─────
function num_(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : null; }
function naverOver_(sym) {
  var sfx = ['.O', '.K', '.N'];   // 나스닥 · NYSE Arca · NYSE (네이버 종목코드 끝글자)
  var reqs = sfx.map(function (s) { return { url: 'https://api.stock.naver.com/stock/' + sym + s + '/basic', muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } }; });
  try {
    var rs = UrlFetchApp.fetchAll(reqs);
    for (var i = 0; i < rs.length; i++) {
      if (rs[i].getResponseCode() !== 200) continue;
      var j = JSON.parse(rs[i].getContentText());
      if (!j || j.closePrice == null) continue;
      var o = j.overMarketPriceInfo;
      if (!o || o.overPrice == null) return null;
      return {
        price: num_(o.overPrice), chg: num_(o.compareToPreviousClosePrice), ratio: num_(o.fluctuationsRatio),
        dir: (o.compareToPreviousPrice || {}).name || '', type: String(o.tradingSessionType || ''), status: String(o.overMarketStatus || ''),
        reg: num_(j.closePrice)
      };
    }
  } catch (err) { /* 네이버 실패 → 야후 값 사용 */ }
  return null;
}

function testNaverWorld() {          // 로그에 네이버 원본과 해석 결과가 나온다(항목 이름이 다르면 이 로그를 알려 주세요)
  ['SOXS.O', 'SOXS.K', 'SOXS.N'].forEach(function (c) {
    var r = UrlFetchApp.fetch('https://api.stock.naver.com/stock/' + c + '/basic', { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
    Logger.log(c + ' → ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 1800));
  });
  Logger.log('해석: ' + JSON.stringify(naverOver_('SOXS')));
}

function test() {
  var r = doGet({ parameter: { codes: '005930', us: 'AAPL,NVDA,SOXS,^TNX,CL=F,^SOX,NQ=F' } });
  Logger.log(r.getContent());
}

// ───── v4: 그래프용 시계열 (?chart=NQ%3DF&range=1d) ─────
function chartOut_(sym, range, ext) {
  var RG = { '1d': ['1d', '5m'], '5d': ['5d', '30m'], '1mo': ['1mo', '1d'], '3mo': ['3mo', '1d'], '1y': ['1y', '1wk'] };
  var rg = RG[range] || RG['1d'];
  var u = sym.toUpperCase(), cands;
  if (/^\d{6}$/.test(u)) cands = [u + '.KS', u + '.KQ'];
  else if (/^[\^A-Z][A-Z0-9.\-=]{0,11}$/.test(u)) cands = [/[\^=]/.test(u) ? u : u.replace('.', '-')];
  else return json_({ chart: { err: 'bad' } });
  for (var i = 0; i < cands.length; i++) {
    try {
      var r = UrlFetchApp.fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(cands[i]) + '?range=' + rg[0] + '&interval=' + rg[1] + (ext && /^[A-Z]{1,5}$/.test(u) ? '&includePrePost=true' : ''),
        { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.getResponseCode() !== 200) continue;
      var res = JSON.parse(r.getContentText()).chart.result[0], ts = res.timestamp || [], cl = res.indicators.quote[0].close || [], pts = [];
      for (var k = 0; k < ts.length; k++) if (cl[k] != null) pts.push([ts[k], cl[k]]);
      if (pts.length < 2) continue;
      var step = Math.ceil(pts.length / 240), out = [];
      for (var q = 0; q < pts.length; q += step) out.push(pts[q]);
      if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
      var prev = res.meta.chartPreviousClose;
      if (cands[i] === '^TNX' && out[0][1] > 20) { out = out.map(function (x) { return [x[0], x[1] / 10]; }); if (prev) prev = prev / 10; }
      var reg = null, cp = res.meta.currentTradingPeriod;           // 정규장 시간대(시간외 구간을 연하게 칠하는 데 씀)
      if (ext && cp && cp.regular) {
        var tEnd = pts[pts.length - 1][0];
        if (tEnd >= cp.pre.start && tEnd <= cp.post.end) reg = [cp.regular.start, cp.regular.end];
        else if (res.meta.regularMarketTime) reg = [res.meta.regularMarketTime - 23400, res.meta.regularMarketTime];
      }
      return json_({ chart: { sym: sym, pts: out, prev: prev == null ? null : prev, name: res.meta.shortName || sym, reg: reg } });
    } catch (err) { /* 다음 후보 */ }
  }
  return json_({ chart: { err: 'none' } });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function testChart() {
  Logger.log(chartOut_('NQ=F', '1d').getContent().slice(0, 300));
}
