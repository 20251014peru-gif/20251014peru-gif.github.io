import {esc,icon} from '../ui.js';
import {config} from '../config.js';
import {mountRemindLater} from './remind-later.js';
import {verificationPanel,collectVerification,conflictSummary} from './verification-panel.js';

const followupStates={open:'미확인',working:'확인 중',done:'완료',paused:'보류'};
const sourceLink=e=>e.integration?.type==='youtube-prediction'?config.youtubeUrl:e.integration?.type==='prediction'?config.predictionUrl:config.investmentArchiveUrl+(e.integration?.sourceIds?.[0]?'#record='+encodeURIComponent(e.integration.sourceIds[0]):e.id.startsWith('investment-record:')?'#record='+encodeURIComponent(e.source.recordId):'');
export async function openInvestmentDetail({dialog:d,store,record,onChange,onSettings,notify}){
 let alive=true,busy=false,dirty=false,reminderUI,saveOperation=null,savePayload=null,conflict=false;
 const close=()=>{if(busy)return;if(dirty&&!confirm('저장하지 않은 입력을 닫을까요?'))return;d.close();};
 const onCancel=e=>{e.preventDefault();close();};d.addEventListener('cancel',onCancel);
 d.addEventListener('close',()=>{alive=false;reminderUI?.dispose();d.removeEventListener('cancel',onCancel);},{once:true});
 d.innerHTML='<div class="dialog-head"><h2 id="editor-title">'+esc(record.title)+'</h2><button data-close aria-label="닫기">'+icon('close')+'</button></div><div class="dialog-body"><p role="status">최신 원본을 확인하고 있어요…</p></div>';
 d.querySelector('[data-close]').onclick=close;if(!d.open)d.showModal();
 let sourceError='',evidence;
 if(store.isCloud){try{const r=await store.request('/investment-items/detail','POST',{id:record.id});if(!alive)return;evidence=r.evidence;if(r.event)record=r.event;else sourceError='원본 항목이 삭제되었거나 없습니다.';}catch(e){sourceError=e.message;}}
 if(!alive)return;
 const isFollowup=record.integration?.type==='followup';
 const info=record.integration,editable=!!info?.editable&&store.isCloud&&!sourceError;
 const options=info?.type==='followup'?followupStates:{대기중:'대기중',적중:'적중',빗나감:'빗나감',판정불가:'판정불가'};
 const kind=info?.type==='followup'?'확인·복기':info?'예측 검증':'투자 기록';
 const sourceNote=info?.type==='followup'?'날짜·상태·결과는 기록보관실의 같은 항목에 저장됩니다. 완료는 확인 업무의 종료이며 예측 적중을 뜻하지 않습니다.':info?.type==='youtube-prediction'?'검증 날짜와 판정 근거를 유튜브 예측 원본에 함께 저장합니다. 검증일은 다시 살펴볼 기한이며 실제 사건의 확정일을 뜻하지 않습니다.':info?.type==='prediction'?'자동 채점 원본의 검증일과 결과입니다. 원본 프로그램에서 관리하며, 여기서는 다시 알림을 예약할 수 있습니다.':'원본 내용은 투자 기록보관실에서 수정합니다.';
 d.innerHTML='<div class="dialog-head"><div><span class="integration-label">'+kind+'</span><h2 id="editor-title">'+esc(record.title)+'</h2></div><button type="button" data-close aria-label="닫기">'+icon('close')+'</button></div><form class="investment-detail-form '+(isFollowup?'with-verification':'')+'"><div class="dialog-body"><p class="form-note">'+sourceNote+'</p>'+(sourceError?'<p class="form-error">최신 상태 확인 실패 · '+esc(sourceError)+'<br>아래는 이전에 가져온 내용입니다. 다시 열어 연결을 확인해 주세요.</p>':'')+(isFollowup?verificationPanel(record,evidence,editable):(record.location?'<p class="investment-source">'+esc(record.location)+'</p>':'')+(info?.sourceTitles?'<p class="quiet small">'+esc(info.sourceTitles)+'</p>':'')+(record.notes?'<div class="investment-context">'+esc(record.notes)+'</div>':'')+
  (editable?'<div class="form-grid"><label class="field"><span>'+(info.type==='followup'?'확인 날짜':'검증 기한')+'</span><input type="date" name="dueAt" value="'+esc(info.dueAt)+'" '+(info.type==='followup'?'':'required')+'></label><label class="field"><span>'+(info.type==='followup'?'진행 상태':'예측 판정')+'</span><select name="state">'+Object.entries(options).map(([v,l])=>'<option value="'+v+'" '+(info.state===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><label class="field full"><span>'+(info.type==='followup'?'확인 결과 · 보류 이유':'판정 근거')+'</span><textarea name="result" maxlength="20000" placeholder="확인한 사실과 근거를 적어 주세요.">'+esc(info.result)+'</textarea></label>'+(info.type==='followup'?'<label class="field full"><span>다음 행동</span><textarea name="nextAction" maxlength="20000" placeholder="이어서 할 일을 적어 주세요.">'+esc(info.nextAction)+'</textarea></label>':'')+'</div><p class="form-note">완료·보류 또는 판정 완료 시 남아 있는 다시 알림도 취소됩니다.</p>':'<p class="quiet small">'+esc(info?.dueAt||record.start?.slice(0,10)||'날짜 없음')+' · '+esc(info?options[info.state]||info.state:record.status==='done'?'기록됨':'예정')+'</p>'+(info?.result?'<div class="investment-result">'+esc(info.result)+'</div>':'')))+
  '<p class="form-error" role="alert" data-save-error></p><div class="integration-conflict" hidden><strong>다른 화면의 최신 내용</strong><pre></pre><button type="button" class="soft" data-use-latest>내 입력을 유지하고 최신 버전에 저장 준비</button><p class="form-note">두 내용을 비교하고 필요한 부분을 직접 합친 뒤 저장하세요.</p></div><div id="remind-later-host"></div></div><div class="dialog-actions investment-actions"><a class="soft archive-link" href="'+esc(sourceLink(record))+'" target="_blank" rel="noopener">원본 열기 ↗</a><button class="soft" type="button" id="remind-later-toggle">'+icon('clock')+'나중에 다시 알림</button>'+(editable?'<button class="primary" type="submit">변경 저장</button>':'')+'<button class="soft" type="button" data-close>닫기</button></div></form>';
 const form=d.querySelector('form'),error=d.querySelector('[data-save-error]');
 d.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
 const setBusy=value=>{busy=value;form.querySelectorAll('input,select,textarea,button').forEach(el=>{if(!el.closest('#remind-later-host')&&el.id!=='remind-later-toggle')el.disabled=value;});d.querySelector('.dialog-head button').disabled=value;};
 reminderUI=mountRemindLater({host:d.querySelector('#remind-later-host'),button:d.querySelector('#remind-later-toggle'),store,record,onChange,onBusy:setBusy,onSettings:()=>{if(dirty){error.textContent='입력한 변경을 저장한 뒤 알림 설정을 열어 주세요.';return;}d.close();onSettings();}});
 if(sourceError){d.querySelector('#remind-later-host').hidden=true;d.querySelector('#remind-later-toggle').hidden=true;}
 form.addEventListener('input',ev=>{dirty=true;const key=ev.target.name?.replace('plan.','');const preview=[...form.querySelectorAll('[data-guide]')].find(x=>x.dataset.guide===key);if(preview)preview.textContent=ev.target.value;});
 form.onsubmit=ev=>ev.preventDefault();
 if(editable)form.onsubmit=async ev=>{
  ev.preventDefault();if(busy)return;if(conflict){error.textContent='아래 최신 내용을 비교한 뒤 저장 준비 버튼을 눌러 주세요.';return;}
  const patch=isFollowup?collectVerification(form,record.integration):Object.fromEntries(new FormData(form));
  const request=JSON.stringify(patch);if(request!==savePayload){saveOperation=crypto.randomUUID();savePayload=request;}
  reminderUI.setBusy(true);error.textContent='';
  try{
   const result=await store.request('/investment-items/save','POST',{id:record.id,patch,expectedRevision:record.integration.revision,operationId:saveOperation});
   record=result.event;dirty=false;
   if(store.cache){const replacements=new Map((result.cancelled||[]).map(e=>[e.id,e]));store.cache=store.cache.map(e=>replacements.get(e.id)||e);}
   await onChange(record);notify('원본에 저장했습니다.');d.close();
  }catch(e){
   error.textContent=e.message;error.scrollIntoView({block:'center'});
   if(e.status===409){conflict=true;const box=d.querySelector('.integration-conflict');box.hidden=false;
    try{const latest=await store.request('/investment-items/resolve','POST',{id:record.id});if(!latest.event?.integration)throw Error('원본 항목이 없습니다.');
     const value=latest.event.integration;box.querySelector('pre').textContent=conflictSummary(value);
     box.querySelector('button').onclick=()=>{record=latest.event;conflict=false;saveOperation=null;savePayload=null;box.hidden=true;error.textContent='최신 버전으로 준비했습니다. 비교한 입력을 확인하고 저장하세요.';};
    }catch(err){box.querySelector('pre').textContent=err.message;box.querySelector('button').hidden=true;}
   }
  }finally{reminderUI.setBusy(false);}
 };
}
