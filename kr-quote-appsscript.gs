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
 * (v3: ^TNX·CL=F·^SOX 같은 지수·금리·원자재 허용 / v2: 미국 종목 us= 추가 — 이 파일로 바꾼 뒤 「배포 관리 → 수정 → 새 버전」으로 올려야 반영된다)
 */
function doGet(e) {
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
    var r = UrlFetchApp.fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(y) + '?range=1d&interval=1d',
      { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (r.getResponseCode() !== 200) return null;
    var m = JSON.parse(r.getContentText()).chart.result[0].meta;
    var p = m.regularMarketPrice, pv = m.chartPreviousClose;
    if (p == null || pv == null) return null;
    if (u === '^TNX' && p > 20) { p = p / 10; pv = pv / 10; }   // 예전 표기(금리×10) 대비
    var d = p - pv, dec = Math.abs(p) < 20 ? 3 : 2;
    return {
      itemCode: sym.toUpperCase(), stockName: m.shortName || sym,
      closePrice: String(p), compareToPreviousClosePrice: String(Math.abs(d).toFixed(dec)),
      fluctuationsRatio: pv ? String(Math.abs(d / pv * 100).toFixed(2)) : '0',
      compareToPreviousPrice: { name: d > 0 ? 'RISING' : d < 0 ? 'FALLING' : 'UNCHANGED' }
    };
  } catch (err) { return null; }
}

function test() {
  var r = doGet({ parameter: { codes: '005930', us: 'AAPL,NVDA,^TNX,CL=F,^SOX' } });
  Logger.log(r.getContent());
}
