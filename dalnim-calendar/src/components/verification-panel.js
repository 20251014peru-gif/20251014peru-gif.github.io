import {esc} from '../ui.js';
import {config} from '../config.js';
import {renderSourceFocus} from './source-panel.js';
import {planFor,planFields,comparisons,judgments,safeEvidenceURL} from '../core/verification.js';
const text=(name,label,value='',placeholder='',max=20000)=>'<label class="field full"><span>'+label+'</span><textarea name="'+name+'" maxlength="'+max+'" placeholder="'+esc(placeholder)+'">'+esc(value)+'</textarea></label>';
const select=(name,label,value,options)=>'<label class="field"><span>'+label+'</span><select name="'+name+'">'+Object.entries(options).map(([k,v])=>'<option value="'+k+'" '+(k===value?'selected':'')+'>'+v+'</option>').join('')+'</select></label>';
const link=(url,title)=>safeEvidenceURL(url)?'<a class="evidence-link" target="_blank" rel="noopener noreferrer" href="'+esc(safeEvidenceURL(url))+'">'+esc(title||url)+' ↗</a>':'';
const section=(n,title,body)=>'<section class="verification-section"><h3><span>'+n+'</span>'+title+'</h3>'+body+'</section>';
const stamp=value=>{if(!value)return '날짜 미기록';const d=new Date(value);return Number.isNaN(d.getTime())?'날짜 미기록':d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});};
function caseCard(row,history=false){
 const fields=[['당시 주장',row.verificationPlan?.claim],['당시 예상',row.expectation],['실제 결과',row.result],['관찰한 변화',row.observedChange],['판단 변경 이유',row.changeReason],['교훈',row.lesson],['다음 행동',row.nextAction]];
 return '<article class="evidence-case"><p class="quiet small">'+esc(stamp(row.recordedAt))+(history?' · 저장 '+row.revision+'회차':'')+'</p><strong>'+esc(row.question)+'</strong><p class="evidence-verdict">'+(row.predictionVerdict?esc(row.predictionVerdict)+' · ':'')+esc(comparisons[row.comparison]||'비교 미기록')+' · '+esc(judgments[row.judgment]||'아직 판단 안 함')+'</p>'+fields.filter(([,v])=>v).map(([label,value])=>'<p><b>'+label+'</b><span>'+esc(value)+'</span></p>').join('')+(row.verificationPlan?.targetPeriod?'<p><b>대상 기간</b><span>'+esc(row.verificationPlan.targetPeriod)+'</span></p>':'')+'<p class="quiet small">자료 기준일: '+esc(row.basisDate||'미기록')+'</p>'+(row.links||[]).map(l=>link(l.url,l.title)).join('')+(history&&row.verificationPlan?'<details><summary>당시 확인 지침</summary>'+['findWhat','whereToLook','compareWith','criteria','patternKey'].map(k=>'<p>'+esc(row.verificationPlan[k]||'')+'</p>').join('')+'</details>':'')+(!history&&row.sourceIds?.[0]?link(config.investmentArchiveUrl+'#record='+encodeURIComponent(row.sourceIds[0]),'이 사례의 원본'):'')+'</article>';
}
export function verificationPanel(record,evidence,editable){
 const i=record.integration,p=planFor(record),cases=evidence?.cases,history=evidence?.history,prediction=i.type==='youtube-prediction';
 const states=prediction?{대기중:'대기중',적중:'적중',빗나감:'빗나감',판정불가:'판정불가'}:{open:'미확인',working:'확인 중',done:'완료',paused:'보류'};
 const learning=editable?'<details class="evidence-learning"'+(prediction?' open':'')+'><summary>판단 변화 · 패턴 분류 · 입력 3개</summary><div class="form-grid">'+select('judgment','내 판단 변화',i.judgment||'pending',judgments)+
  '<label class="field"><span>같은 사례를 모을 패턴 이름</span><input name="plan.patternKey" maxlength="120" value="'+esc(p.patternKey)+'" placeholder="예: FOMC · 정책 발언"></label>'+
  text('changeReason','판단을 유지·수정·철회한 이유',i.changeReason,'어떤 근거가 판단에 영향을 주었는지 적습니다.')+'</div></details>':'';
 const original=section('01','관련 발언 · 당시 판단',
  (record.location?'<p class="investment-source">'+esc(record.location)+'</p>':'')+
  renderSourceFocus(record,evidence,editable)+
  '<details class="evidence-expectation"'+(prediction?' open':'')+'><summary>당시 예상 · 대응 계획</summary><p class="evidence-prose">'+esc(i.expectation||'미기록')+'</p></details>'+
  (editable?text('plan.claim','당시 핵심 주장 · 근거 문장',p.claim,'위 관련 문장에서 ‘당시 주장에 넣기’를 누르거나 직접 적습니다.',4000):'')+(prediction?learning:''));
 const plan=section('02','무엇을 찾아 확인할까',
  '<div class="evidence-links">'+p.sources.map(s=>link(s.url,s.title)).join('')+'</div>'+
  '<div class="evidence-guide"'+(prediction&&editable?' hidden':'')+'>'+[['findWhat','찾을 것'],['whereToLook','찾을 자료'],['compareWith','비교할 기준'],['criteria','결과를 구분할 기준']].map(([key,label])=>'<div><strong>'+label+'</strong><p data-guide="'+key+'">'+esc(p[key])+'</p></div>').join('')+'</div>'+
  (editable?text('plan.targetPeriod','확인할 대상 · 기간',p.targetPeriod,'회의 날짜 / 종목·회계분기 / 가격 관찰 기간',4000)+'<details class="evidence-edit"'+(prediction?' open':'')+'><summary>확인 지침 수정 · 입력 4개</summary>'+[['findWhat','찾을 수치·발언'],['whereToLook','확인할 자료·위치'],['compareWith','비교할 이전 값·기간'],['criteria','같음·다름·유보 판단 기준']].map(([key,label])=>text('plan.'+key,label,p[key],'',4000)).join('')+'</details>':'')+
  '<details class="evidence-collection"><summary>같은 패턴의 완료 사례'+(cases?' · '+cases.total+'건':'')+'</summary><p class="form-note">'+esc(p.patternKey||'패턴 이름 미지정')+' · 같은 패턴 이름의 결과 있는 완료 항목입니다. 시장 조건은 서로 다를 수 있습니다.</p>'+(cases?cases.items.map(x=>caseCard(x)).join('')||'<p class="evidence-empty">첫 결과를 남기면 다음 사례에서 비교할 수 있어요.</p>':'<p>사례를 불러오지 못했습니다.</p>')+(cases?.total>20?'<p class="form-note">최근 완료 20건 표시</p>':'')+'</details>');
 const results=editable?section('03','확인 결과 · 다음 행동',
  '<div class="form-grid"><label class="field"><span>'+(prediction?'검증 기한':'확인 예정일')+'</span><input type="date" name="dueAt" value="'+esc(i.dueAt)+'"></label>'+select('state',prediction?'예측 판정':'진행 상태',i.state,states)+
  text('result',prediction?'실제 확인 결과 · 판정 근거':'실제 확인 결과 · 보류 이유',i.result,'발표일 / 찾은 수치·문장 / 원래 주장과 달랐던 점')+
  text('evidenceLinks','근거 자료 주소 · 한 줄에 하나',(i.links||[]).map(l=>l.url).join('\n'),'실제로 확인한 문서·영상 시점의 주소')+
  '<label class="field"><span>자료 기준일</span><input type="date" name="basisDate" value="'+esc(i.basisDate)+'"></label>'+select('comparison','예상과 실제 비교',i.comparison||'',comparisons)+
  text('observedChange','이후 관찰한 변화',i.observedChange,'관찰 기간 / 종목·지표 / 전후 값과 단위').replace('field full','field')+
  text('lesson','다음에 재사용할 확인 기준 · 교훈',i.lesson,'다음에 같은 주장을 만나면 먼저 확인할 조건').replace('field full','field')+
  text('nextAction','다음 확인 행동',i.nextAction,'부족한 자료 / 다시 볼 날짜 / 다음 질문')+
  '</div>'+(prediction?'':learning)):
  section('03','저장된 결과',caseCard({...i,id:record.id}));
 const saved='<details class="evidence-collection"><summary>이 항목의 저장 이력'+(history?' · '+history.total+'건':'')+'</summary>'+(history?history.items.map(x=>caseCard(x,true)).join('')||'<p class="evidence-empty">저장할 때 지침과 결과가 함께 남습니다.</p>':'<p>저장 이력을 불러오지 못했습니다.</p>')+(history?.total>20?'<p class="form-note">최근 저장 20건 표시</p>':'')+'</details>';
 return '<div class="verification-workspace">'+
  '<div class="verification-column source-column">'+original+'</div>'+
  '<div class="verification-column guide-column">'+plan+'<p class="form-note">확인 지침은 수정 가능한 초안입니다. 실제 발언·수치는 원문 근거로 판단해 주세요.</p></div>'+
  '<div class="verification-column result-column">'+(evidence?.warnings||[]).map(w=>'<p class="form-error">'+esc(w)+'</p>').join('')+results+saved+'<p class="form-note">'+(prediction?'검증 기한·판정·근거는 유튜브 예측 원본과 공유합니다. 추가 검증 내용과 이력도 저장합니다. 판정 완료 시 남은 다시 알림을 취소합니다.':'원본의 같은 항목에 저장합니다. 완료는 확인 업무의 종료이며, 완료·보류 시 남은 다시 알림을 취소합니다.')+'</p></div></div>';
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
 return Object.entries(labels).map(([key,label])=>label+': '+((key==='comparison'?comparisons[info[key]]:key==='judgment'?judgments[info[key]]:key==='state'?{open:'미확인',working:'확인 중',done:'완료',paused:'보류'}[info[key]]||info[key]:info[key])||'미기록')).join('\n')+'\n근거 링크: '+(info.links||[]).map(l=>l.url).join('\n')+'\n확인 지침:\n'+planFields.map(k=>({claim:'당시 핵심 주장',targetPeriod:'대상·기간',findWhat:'찾을 내용',whereToLook:'자료 위치',compareWith:'비교 기준',criteria:'판단 기준',patternKey:'패턴 이름'}[k])+': '+(info.verificationPlan?.[k]||'미기록')).join('\n');
}
