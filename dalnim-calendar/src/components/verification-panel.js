import {esc} from '../ui.js';
import {config} from '../config.js';
import {planFor,planFields,comparisons,judgments,safeEvidenceURL} from '../core/verification.js';
const text=(name,label,value='',placeholder='',max=20000)=>'<label class="field full"><span>'+label+'</span><textarea name="'+name+'" maxlength="'+max+'" placeholder="'+esc(placeholder)+'">'+esc(value)+'</textarea></label>';
const select=(name,label,value,options)=>'<label class="field"><span>'+label+'</span><select name="'+name+'">'+Object.entries(options).map(([k,v])=>'<option value="'+k+'" '+(k===value?'selected':'')+'>'+v+'</option>').join('')+'</select></label>';
const link=(url,title)=>safeEvidenceURL(url)?'<a class="evidence-link" target="_blank" rel="noopener noreferrer" href="'+esc(safeEvidenceURL(url))+'">'+esc(title||url)+' ↗</a>':'';
const section=(n,title,body)=>'<section class="verification-section"><h3><span>'+n+'</span>'+title+'</h3>'+body+'</section>';
const stamp=value=>{if(!value)return '날짜 미기록';const d=new Date(value);return Number.isNaN(d.getTime())?'날짜 미기록':d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});};
function caseCard(row,history=false){
 const fields=[['당시 주장',row.verificationPlan?.claim],['당시 예상',row.expectation],['실제 결과',row.result],['관찰한 변화',row.observedChange],['판단 변경 이유',row.changeReason],['교훈',row.lesson],['다음 행동',row.nextAction]];
 return '<article class="evidence-case"><p class="quiet small">'+esc(stamp(row.recordedAt))+(history?' · 저장 '+row.revision+'회차':'')+'</p><strong>'+esc(row.question)+'</strong><p class="evidence-verdict">'+esc(comparisons[row.comparison]||'비교 미기록')+' · '+esc(judgments[row.judgment]||'아직 판단 안 함')+'</p>'+fields.filter(([,v])=>v).map(([label,value])=>'<p><b>'+label+'</b><span>'+esc(value)+'</span></p>').join('')+(row.verificationPlan?.targetPeriod?'<p><b>대상 기간</b><span>'+esc(row.verificationPlan.targetPeriod)+'</span></p>':'')+'<p class="quiet small">자료 기준일: '+esc(row.basisDate||'미기록')+'</p>'+(row.links||[]).map(l=>link(l.url,l.title)).join('')+(history&&row.verificationPlan?'<details><summary>당시 확인 지침</summary>'+['findWhat','whereToLook','compareWith','criteria','patternKey'].map(k=>'<p>'+esc(row.verificationPlan[k]||'')+'</p>').join('')+'</details>':'')+(!history&&row.sourceIds?.[0]?link(config.investmentArchiveUrl+'#record='+encodeURIComponent(row.sourceIds[0]),'이 사례의 원본'):'')+'</article>';
}
export function verificationPanel(record,evidence,editable){
 const i=record.integration,p=planFor(record);
 const sourceHTML=(evidence?.sources||[]).map(s=>'<details class="evidence-source"><summary>'+esc(s.title||'연결 원본')+(s.missing?' · 원본 없음':'')+'</summary><p class="quiet small">'+esc(s.date||'작성일 미기록')+' · 현재 원본 내용</p><div class="evidence-prose">'+esc(s.body||'본문이 없거나 이 화면에서 읽을 수 없는 형식입니다. 원본 열기에서 확인해 주세요.')+'</div>'+link(s.url,'원문 자료')+'</details>').join('');
 const original=section('01','당시 무엇을 보고 판단했나',
  '<div class="evidence-original"><span class="integration-label">저장된 확인 질문</span><p>'+esc(i.question||record.title)+'</p><span class="integration-label">당시 예상 · 대응 계획</span><p>'+esc(i.expectation||'예상 내용이 없습니다. 원문에서 확인해 아래에 적어 주세요.')+'</p></div>'+sourceHTML+
  (editable?text('plan.claim','당시 핵심 주장 · 근거 문장',p.claim,'원문에서 확인한 주장 한 문장과 이유를 적어 주세요. 영상은 발언 시각도 함께 적습니다.',4000):'')+'<p class="form-note">제목·예상과 실제 원문을 구분해 남깁니다. 아래 안내는 주제에 따른 확인 초안이며, 원문에서 추출하거나 검증한 사실이 아닙니다.</p>');
 const plan=section('02','이번에는 이것을 찾아 확인',
  (editable?text('plan.targetPeriod','확인할 대상 · 기간',p.targetPeriod,'예: 해당 회의 날짜와 직전 회의 날짜 / 종목과 회계분기. 미정이면 먼저 확인합니다.',4000):'')+
  '<div class="evidence-guide">'+[['findWhat','무엇을 찾나'],['whereToLook','어디에서 찾나'],['compareWith','무엇과 비교하나'],['criteria','어떻게 결과를 구분하나']].map(([key,label])=>'<div><strong>'+label+'</strong><p data-guide="'+key+'">'+esc(p[key])+'</p></div>').join('')+'</div><div class="evidence-links">'+p.sources.map(s=>link(s.url,s.title)).join('')+'</div>'+
  (editable?'<details class="evidence-edit"><summary>확인 지침을 내 기준에 맞게 수정</summary>'+[['findWhat','찾을 수치·발언'],['whereToLook','확인할 자료·위치'],['compareWith','비교할 이전 값·기간'],['criteria','같음·다름·유보 판단 기준']].map(([key,label])=>text('plan.'+key,label,p[key],'',4000)).join('')+'</details>':''));
 const results=editable?section('03','찾은 사실과 결과를 남기기',
  '<div class="form-grid"><label class="field"><span>확인 예정일</span><input type="date" name="dueAt" value="'+esc(i.dueAt)+'"></label>'+select('state','진행 상태',i.state,{open:'미확인',working:'확인 중',done:'완료',paused:'보류'})+
  text('result','실제 확인 결과 · 보류 이유',i.result,'대상과 날짜 → 찾은 수치·발언 → 원래 주장과 같은 점·다른 점. 확인하지 못했다면 빠진 자료와 이유를 적습니다.')+
  '<label class="field"><span>자료 기준일</span><input type="date" name="basisDate" value="'+esc(i.basisDate)+'"></label>'+select('comparison','예상과 실제 비교',i.comparison||'',comparisons)+
  text('evidenceLinks','근거 자료 주소 · 한 줄에 하나',(i.links||[]).map(l=>l.url).join('\n'),'실제로 확인한 자료의 주소를 붙여 주세요. 영상은 가능하면 발언 시각이 포함된 링크를 사용합니다.')+
  text('observedChange','그 이후 실제로 어떤 변화가 있었나',i.observedChange,'관찰한 종목·지표 / 시작일과 종료일 / 전후 값과 단위. 아직 관찰하지 않았다면 미관찰로 적습니다.')+'</div>'):section('03','저장된 결과',caseCard({...i,id:record.id}));
 const learning=editable?section('04','다음에 같은 상황이 오면',
  '<div class="form-grid">'+select('judgment','내 판단 변화',i.judgment||'pending',judgments)+
  '<label class="field"><span>같은 사례를 모을 패턴 이름</span><input name="plan.patternKey" maxlength="120" value="'+esc(p.patternKey)+'" placeholder="예: FOMC · 정책 발언"></label>'+
  text('changeReason','판단을 유지·수정·철회한 이유',i.changeReason,'어떤 근거가 내 판단에 영향을 주었는지 적습니다.')+
  text('lesson','다음에 재사용할 확인 기준 · 교훈',i.lesson,'다음에 같은 주장이 나오면 먼저 확인할 조건과, 이번 사례만으로 일반화할 수 없는 점을 적습니다.')+
  text('nextAction','다음 확인 행동',i.nextAction,'아직 부족한 자료, 다시 볼 날짜, 추가로 확인할 질문을 적습니다.')+'</div><p class="form-note">완료는 확인 업무의 종료입니다. 적중 여부·실제 시장 변화는 위 결과와 비교에 따로 남깁니다. 완료·보류하면 남아 있는 다시 알림도 취소됩니다.</p>'):'';
 const cases=evidence?.cases,history=evidence?.history;
 return '<div class="verification-intro"><strong>원문 → 확인 → 결과 → 다음 기준</strong><span>하나의 확인이 다음 판단의 근거가 되도록</span></div>'+(evidence?.warnings||[]).map(w=>'<p class="form-error">'+esc(w)+'</p>').join('')+original+plan+results+learning+
  section('05','쌓인 사례와 저장 이력','<details class="evidence-collection"><summary>같은 패턴의 완료 사례'+(cases?' · '+cases.total+'건':'')+'</summary><p class="form-note">'+esc(p.patternKey?'현재 저장 기준: '+p.patternKey:'패턴 이름을 적고 저장하면 같은 이름의 사례를 모읍니다.')+' · 결과가 있는 완료 항목만 표시합니다. 새 패턴 이름은 저장 후 다시 열면 반영됩니다. 같은 분류여도 시장 조건은 다를 수 있습니다.</p>'+(cases?cases.items.map(x=>caseCard(x)).join('')||'<p class="evidence-empty">아직 비교할 완료 사례가 없습니다. 실제 결과를 남기면 이후 같은 패턴에서 볼 수 있어요.</p>':'<p>사례를 불러오지 못했습니다.</p>')+(cases?.total>20?'<p class="form-note">최근 완료 사례 20건을 표시합니다.</p>':'')+'</details><details class="evidence-collection"><summary>이 항목의 저장 이력'+(history?' · '+history.total+'건':'')+'</summary>'+(history?history.items.map(x=>caseCard(x,true)).join('')||'<p class="evidence-empty">첫 저장부터 당시 지침과 결과가 함께 남습니다.</p>':'<p>저장 이력을 불러오지 못했습니다.</p>')+(history?.total>20?'<p class="form-note">최근 저장 이력 20건을 표시합니다.</p>':'')+'</details>');
}
export function collectVerification(form,info){
 const entries=Object.fromEntries(new FormData(form)),patch={verificationPlan:{schemaVersion:1}};
 for(const k of planFields)patch.verificationPlan[k]=entries['plan.'+k]||'';
 for(const k of ['dueAt','state','result','basisDate','comparison','observedChange','judgment','changeReason','lesson','nextAction'])patch[k]=entries[k]||'';
 const urls=entries.evidenceLinks.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 // Preserve titles and metadata from the source application for unchanged URLs.
 patch.links=urls.map(url=>info.links?.find(l=>l.url===url)||{url});
 return patch;
}
export function conflictSummary(info){
 const labels={dueAt:'날짜',state:'상태',result:'결과',basisDate:'자료 기준일',comparison:'예상과 비교',observedChange:'실제 변화',judgment:'판단',changeReason:'판단 이유',lesson:'교훈',nextAction:'다음 행동'};
 return Object.entries(labels).map(([key,label])=>label+': '+(info[key]||'미기록')).join('\n')+'\n근거 링크: '+(info.links||[]).map(l=>l.url).join('\n')+'\n확인 지침:\n'+planFields.map(k=>k+': '+(info.verificationPlan?.[k]||'미기록')).join('\n');
}
