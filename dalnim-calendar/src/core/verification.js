// Deterministic research prompts, not extracted claims or verified market facts.
// Shared by the detail view and case matching so grouping stays explainable.
export const comparisons={'':'아직 비교 안 함',same:'예상과 같음',partial:'일부 다름',different:'예상과 다름',unknown:'자료 부족 · 판단 유보'};
export const judgments={pending:'아직 판단 안 함',keep:'기존 판단 유지',change:'기존 판단 수정',withdraw:'기존 판단 철회'};
export const planFields=['claim','targetPeriod','findWhat','whereToLook','compareWith','criteria','patternKey'];
export function safeEvidenceURL(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
const fed={title:'연준 회의별 성명·기자회견',url:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'};
const sec={title:'SEC 기업 공시 검색',url:'https://www.sec.gov/search-filings'};
export function verificationGuide(item){
 const q=String(item.question||item.integration?.question||item.title||'');
 let guide={patternKey:'',findWhat:'아래 확인 질문에서 대상·사건·확인할 수치 또는 발언을 하나로 좁혀 적습니다. 현재 항목: '+q,
  whereToLook:'원본 열기에서 해당 주장의 문장과 출처를 확인합니다. 영상이면 영상 날짜·채널·발언 시각, 자료이면 발행 기관·문서명·발표일을 적습니다.',
  compareWith:'원본이 말한 예상과 실제 자료를 같은 대상·기간·단위로 나란히 적습니다. 이전 값이나 비교 기준이 없으면 미기록으로 남깁니다.',
  criteria:'주장의 어느 부분이 확인되었는지, 다른 부분은 무엇인지 근거 문장으로 설명합니다. 아직 발표되지 않았거나 근거가 없으면 판단을 유보합니다.',sources:[]};
 if(/파월|FOMC|연준.*(?:발언|기자회견|금리)|통화정책.*발언/i.test(q))guide={patternKey:'FOMC · 정책 발언',
  findWhat:'해당 FOMC 회의의 금리 결정과 기자회견에서 ① 물가·고용 평가 ② 추가 긴축 또는 완화 조건 ③ 향후 결정에 관한 문장을 찾습니다. 말한 날짜와 원문 문장, 영상이면 시각을 함께 기록합니다.',
  whereToLook:'연준 회의별 자료에서 대상 회의 날짜를 선택하고 Statement와 Press Conference를 엽니다. 직전 회의 자료도 함께 열어 같은 주제의 문장을 찾습니다. 확인 예정일을 회의 날짜로 간주하지 않습니다.',
  compareWith:'직전 회의의 문장 → 이번 회의의 문장을 나란히 옮기고, 추가·삭제·유지된 표현을 표시합니다. 원본 영상의 해석과 공식 발언이 일치하는지도 따로 비교합니다.',
  criteria:'실제 정책 결정과 조건부 발언을 구분합니다. “데이터 의존”이라는 단어 하나로 완화 전환을 단정하지 않습니다. 근거 문장이 원래 주장과 같음 / 일부 다름 / 다름 / 판단 유보 중 어디에 해당하는지 설명합니다.',sources:[fed]};
 else if(/\bCPI\b|소비자물가|\bPPI\b|생산자물가/i.test(q)){
  const ppi=/\bPPI\b|생산자물가/i.test(q),name=ppi?'PPI':'CPI';
  guide={patternKey:name+' · 물가 발표',findWhat:`${name} 발표에서 대상 월, 총지수와 원본이 언급한 세부 지표의 전월 대비·전년 대비 수치를 찾습니다. 발표일·단위·계절조정 여부와 수정된 이전 값도 함께 적습니다.`,
   whereToLook:`미국 지표라면 BLS ${name}의 해당 월 News Release와 표를 확인합니다. 다른 나라 지표라면 해당 국가 통계기관의 같은 기간 발표를 사용합니다. 시장 예상치는 원본에 출처가 있을 때만 별도로 기록합니다.`,
   compareWith:'원본 예상치 / 실제 발표치 / 직전 발표치를 같은 지표·단위로 나란히 적습니다. 전월 대비와 전년 대비를 섞지 않고, 예상치 출처가 없으면 예상 대비 차이를 계산하지 않습니다.',
   criteria:'원본이 예상한 상승·둔화 방향과 실제 수치를 비교합니다. 물가 발표 결과와 이후 주가 반응은 별개의 결과로 적고, 주가를 확인할 때는 종목과 관찰 기간을 지정합니다.',
   sources:[{title:'BLS '+name+' 공식 자료',url:ppi?'https://www.bls.gov/ppi/news-release/home.htm':'https://www.bls.gov/cpi/'}]};
 }else if(/EPS|실적|가이던스|매출|리비전/i.test(q))guide={patternKey:'기업 실적 · 전망 변화',
  findWhat:'대상 기업의 해당 분기 매출·EPS 또는 원본이 언급한 전망 지표를 찾습니다. 실제 실적과 다음 분기 전망을 구분하고, EPS는 GAAP·조정 EPS 중 무엇인지 표시합니다.',
  whereToLook:'기업 IR의 해당 분기 실적 발표와 공시를 엽니다. 미국 상장사라면 SEC에서 종목명으로 공시를 찾습니다. 애널리스트 전망 수정이라면 같은 제공처의 이전·현재 추정치와 기준일을 찾습니다.',
  compareWith:'원본에 기록된 예상 / 실제 발표 / 직전 전망을 같은 회계기간·통화·지표로 비교합니다. 컨센서스나 리비전은 제공처·조회일이 없으면 비교 불가로 적습니다.',
  criteria:'어느 수치가 예상과 달랐는지와 그 근거를 적습니다. 실적 개선, 전망 상향, 이후 주가 상승을 각각 구분하고 하나가 다른 결과를 보장한다고 판단하지 않습니다.',sources:[sec]};
 else if(/미국채|미국 국채|미국채권|미 국채|TIC/i.test(q))guide={patternKey:'미 국채 · 해외 보유 변화',
  findWhat:'원본이 지목한 국가의 해당 월 미 국채 보유 잔액과 전월 잔액을 찾습니다. 국가·월·금액 단위와 표의 분류를 함께 적습니다.',
  whereToLook:'미 재무부 TIC 자료에서 해당 월의 국가별 미 국채 보유 표와 주석을 확인합니다. 거래를 주장한 원문이라면 잔액 표와 별도로 매입·매도 거래 자료를 찾습니다.',
  compareWith:'같은 국가·같은 표의 전월 잔액 → 이번 잔액 → 차이를 적습니다. 원본이 예상한 증가·감소 방향과 비교하고 수정 여부를 확인합니다.',
  criteria:'보유 잔액 감소만으로 순매도를 확정하지 않습니다. 원문이 주장한 매도 전환을 뒷받침할 거래 자료가 있는지 구분하고 없으면 그 부분은 판단 유보로 남깁니다.',sources:[{title:'미 재무부 TIC 자료',url:'https://home.treasury.gov/data/treasury-international-capital-tic-system/'}]};
 if(/\bADI\b|아날로그\s*디바이스/i.test(q)){
  const range=q.match(/(\d+(?:\.\d+)?)\s*[~～–-]\s*(\d+(?:\.\d+)?)\s*달러/),level=range?range[1]+'~'+range[2]+'달러':'원문에 기록된 가격 구간';
  guide={...guide,
   findWhat:'① ADI 공식 실적 발표일과 회계분기 ② 그 분기의 실제 EPS와 원문 예상의 차이 ③ 관찰 날짜의 종가와 당시 저항 구간 '+level+'의 관계를 각각 확인합니다.',
   whereToLook:'ADI 공식 일정·분기별 실적에서 해당 발표를 선택합니다. 가격은 사용 중인 차트에서 ADI를 열고 거래일·종가를 적습니다. EMA는 원문과 같은 기간 설정인지 확인합니다.',
   compareWith:'원문에 적힌 저항 구간 '+level+'을 기준으로 확인 날짜의 종가를 비교합니다. 장중 돌파와 종가 돌파를 구분하고, 현재 EMA 값은 당시 가격 구간과 별도로 적습니다. EPS는 같은 분기의 예상치 출처·발표치를 비교합니다.',
   criteria:'실적 발표 일정 확인 / EPS 예상 대비 결과 / 가격 구간 돌파 여부를 따로 기록합니다. 확인 예정일을 실적 발표일로 보지 않으며, 한 조건만 확인됐다면 나머지는 미확인으로 남깁니다.',
   sources:[{title:'ADI 공식 실적 발표 일정',url:'https://investor.analog.com/events'},{title:'ADI 분기별 실적·EPS 자료',url:'https://investor.analog.com/financial-info/quarterly-results'}]};
 }
 const prediction=item.integration?.type==='youtube-prediction'?item.integration:null;
 if(prediction){
  guide.findWhat='대상: '+q+'\n'+guide.findWhat;
  if(prediction.invalidation)guide.criteria='원본의 반증 조건: '+prediction.invalidation+'\n이 조건의 충족 여부와 확인 근거를 먼저 적습니다.\n'+guide.criteria;
  guide.compareWith+=' EPS·매출 전망과 주가 기준선을 섞지 않습니다. 서로 다른 지표이면 각각 비교합니다.';
 }
 return {claim:'',targetPeriod:'',...guide};
}
export function planFor(item){const base=verificationGuide(item),saved=item.verificationPlan||item.integration?.verificationPlan;return {...base,...saved,sources:base.sources};}
export function matchingCases(current,rows){
 const key=planFor(current).patternKey.trim();if(!key)return [];
 return rows.filter(x=>x.id!==current.id&&x.state==='done'&&String(x.result||'').trim()&&planFor(x).patternKey.trim()===key)
  .sort((a,b)=>(b.completedAt||b.updatedAt||0)-(a.completedAt||a.updatedAt||0));
}
