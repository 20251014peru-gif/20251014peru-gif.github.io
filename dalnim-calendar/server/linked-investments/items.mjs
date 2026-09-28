import {createHash} from 'node:crypto';
import {saveTransition} from './followup-contract.mjs';
import {comparisons,judgments,planFields,safeEvidenceURL} from '../../src/core/verification.js';

export const fail=(status,message)=>Object.assign(Error(message),{status});
export const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const nextDay=s=>new Date(Date.parse(s)+86400000).toISOString().slice(0,10);
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const fingerprint=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const base=(id,title,date,status,kind,sourceId)=>({id,title:String(title).slice(0,160),start:date,end:validDate(date)?nextDay(date):'',allDay:true,timeZone:'Asia/Seoul',category:'investment',module:'investment',status,repeat:'none',reminder:-1,visibility:'personal',readOnly:true,revision:1,notes:'',location:'',details:{},source:{app:'investment-archive',kind,recordId:sourceId}});

export function followupAliases(f){
 const record=f.sourceIds?.[0],legacy=f.legacy;
 if(!record||!legacy)return [];
 if(legacy.reviewAt!==undefined)return ['investment-review:'+record];
 if(Number.isInteger(legacy.index))return [...new Set(['investment-check:'+record+':'+(legacy.check?.id||legacy.index),'investment-check:'+record+':'+legacy.index])];
 return [];
}
export function mapFollowup(f){
 const date=validDate(f.dueAt)?f.dueAt:'';
 return {...base('investment-followup:'+f.id,'🔔 '+(f.question||'확인·복기'),date,f.state==='done'?'done':f.state==='working'?'progress':'planned','followup',f.id),
  revision:f.revision||0,notes:f.expectation||'',location:(f.stocks||[]).join(', '),
  calendarVisible:!!date&&f.state!=='paused',aliases:followupAliases(f),
  integration:{type:'followup',state:f.state||'open',dueAt:f.dueAt||'',result:f.result||'',nextAction:f.nextAction||'',expectation:f.expectation||'',revision:f.revision||0,editable:true,sourceIds:f.sourceIds||[],sourceTitles:(f.sourceSnapshots||[]).map(r=>r.title||'').join(' · '),
   question:f.question||'',basisDate:f.basisDate||'',comparison:f.comparison||'',judgment:f.judgment||'pending',observedChange:f.observedChange||'',lesson:f.lesson||'',changeReason:f.changeReason||'',links:f.links||[],verificationPlan:f.verificationPlan||null}};
}
const predictionStates=['대기중','적중','빗나감','판정불가'];
export function mapYoutubePrediction(p){
 const date=validDate(p.검증기한)?p.검증기한:'',state=p.상태||'대기중',v=p.calendarVerification||{};
 return {...base('youtube-prediction:'+p.id,'🎯 '+(p.대상||p.영상제목||'예측 검증'),date,state==='대기중'?'planned':'done','youtube-prediction',p.id),calendarVisible:!!date,
  location:[p.티커,p.채널].filter(Boolean).join(' · '),notes:[p.방향&&'예측 방향: '+p.방향,p.기준선&&'기준선: '+p.기준선,p.반증조건&&'반증 조건: '+p.반증조건,p.원문].filter(Boolean).join('\n'),
  integration:{type:'youtube-prediction',state,dueAt:p.검증기한||'',result:p.판정근거||'',revision:fingerprint(p),editable:true,verificationEditable:true,sourceTitles:p.영상제목||'',sourceIds:[],
   question:p.대상||'',expectation:[p.방향&&'예측 방향: '+p.방향,p.기준선&&'기준선: '+p.기준선,p.반증조건&&'반증 조건: '+p.반증조건].filter(Boolean).join('\n'),originalClaim:p.원문||'',baseline:p.기준선||'',invalidation:p.반증조건||'',publishedAt:p.게시일||'',
   nextAction:v.nextAction||'',basisDate:v.basisDate||'',comparison:v.comparison||'',judgment:v.judgment||'pending',observedChange:v.observedChange||'',lesson:v.lesson||'',changeReason:v.changeReason||'',links:v.links||[],verificationPlan:v.verificationPlan||null,reviewRevision:v.revision||0}};
}
export function mapPrediction(p,score){
 const date=validDate(p.due)?p.due:'',state=p.status==='withdrawn'?'철회':score?.status||'대기중';
 return {...base('investment-prediction:'+p.id,'🎯 '+(p.target||p.ticker||'투자 예측'),date,state==='대기중'?'planned':'done','prediction',p.id),calendarVisible:!!date,
  location:[p.ticker,p.source?.name].filter(Boolean).join(' · '),notes:[p.direction&&'예측 방향: '+p.direction,p.baseline&&'기준선: '+p.baseline,p.invalidation&&'반증 조건: '+p.invalidation,p.reason].filter(Boolean).join('\n'),
  integration:{type:'prediction',state,dueAt:p.due||'',result:score?.basis||'',editable:false,sourceTitles:p.source?.name||'',sourceIds:[]}};
}
export const actionable=e=>e&&(!e.integration||['open','working','대기중'].includes(e.integration.state));
export function dueItems(events,today){return events.filter(e=>e.integration&&e.start===today&&actionable(e));}
export function digestItems(events,today,reminders,now=Date.now()){
 return dueItems(events,today).filter(e=>!reminders.some(r=>r.source?.app==='dalnim-investment-reminder'&&!r.deletedAt&&r.status!=='done'&&r.reminder>=0&&Date.parse(r.start)>now&&[e.id,...(e.aliases||[])].includes(r.details?.investmentItemId)));
}
function validatedEvidence(current,patch){
 const clean={};
 for(const k of ['dueAt','result','nextAction','state','basisDate','comparison','judgment','observedChange','lesson','changeReason','links'])if(patch[k]!==undefined)clean[k]=patch[k];
 if(clean.dueAt!==undefined&&clean.dueAt!==''&&!validDate(clean.dueAt))throw fail(400,'확인 날짜가 올바르지 않습니다.');
 if(clean.basisDate!==undefined&&clean.basisDate!==''&&!validDate(clean.basisDate))throw fail(400,'자료 기준일이 올바르지 않습니다.');
 for(const k of ['result','nextAction','observedChange','lesson','changeReason'])if(clean[k]!==undefined&&(typeof clean[k]!=='string'||clean[k].length>20000))throw fail(400,'입력 내용은 20,000자 이내로 적어 주세요.');
 if(clean.comparison!==undefined&&!Object.hasOwn(comparisons,clean.comparison))throw fail(400,'예상과 비교 항목을 확인해 주세요.');
 if(clean.judgment!==undefined&&!Object.hasOwn(judgments,clean.judgment))throw fail(400,'판단 변화 항목을 확인해 주세요.');
 if(clean.links!==undefined&&(!Array.isArray(clean.links)||clean.links.length>30||clean.links.some(l=>!l||typeof l.url!=='string'||l.url.length>2000||!safeEvidenceURL(l.url)||l.title!==undefined&&(typeof l.title!=='string'||l.title.length>500))))throw fail(400,'근거 링크는 http(s) 주소로 30개까지 적어 주세요.');
 let plan;
 if(patch.verificationPlan!==undefined){
  const input=patch.verificationPlan;
  if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400,'확인 지침 형식이 올바르지 않습니다.');
  plan={...(current.verificationPlan||{}),schemaVersion:1};
  for(const key of planFields)if(input[key]!==undefined){if(typeof input[key]!=='string'||input[key].length>(key==='patternKey'?120:4000))throw fail(400,'확인 지침은 항목별 4,000자, 패턴 이름은 120자 이내로 적어 주세요.');plan[key]=input[key].trim();}
 }
 return {clean,plan};
}
export function followupChange(current,patch,expected,operationId,now=Date.now()){
 if(!current)throw fail(404,'확인 항목이 삭제되었거나 없습니다.');
 // Return the stored snapshot on retries before considering a different draft.
 if(current.operationId===operationId&&operationId)return {item:current,repeated:true};
 const {clean,plan}=validatedEvidence(current,patch);
 try{
  const change=saveTransition(current,clean,{expected,operationId,id:current.id,now});
  if(plan){change.item.verificationPlan=plan;change.review.verificationPlan=plan;}
  if(new TextEncoder().encode(JSON.stringify(change.item)).length>750000)throw Error('TOO_LARGE');
  return change;
 }
 catch(e){throw fail(e.message==='CONFLICT'?409:400,({CONFLICT:'다른 화면에서 수정되었습니다. 입력은 유지됩니다. 최신 내용을 확인해 주세요.',RESULT_REQUIRED:'완료하려면 확인 결과를 적어 주세요.',PAUSE_REASON_REQUIRED:'보류 이유를 결과에 적어 주세요.',BAD_STATE:'확인 상태가 올바르지 않습니다.'})[e.message]||'입력 내용을 확인해 주세요.');}
}
export function predictionChange(current,patch,expected){
 if(!current)throw fail(404,'예측이 삭제되었거나 없습니다.');
 if(fingerprint(current)!==expected)throw fail(409,'다른 화면에서 예측이 수정되었습니다. 입력은 유지됩니다. 최신 내용을 확인해 주세요.');
 if(!validDate(patch.dueAt))throw fail(400,'검증 날짜를 선택해 주세요.');
 if(!predictionStates.includes(patch.state))throw fail(400,'예측 판정이 올바르지 않습니다.');
 if(typeof patch.result!=='string'||patch.result.length>20000)throw fail(400,'판정 근거는 20,000자 이내로 적어 주세요.');
 if(patch.state!=='대기중'&&!patch.result.trim())throw fail(400,'판정 근거를 적어 주세요.');
 const fields=['basisDate','comparison','judgment','observedChange','lesson','changeReason','nextAction','links','verificationPlan'];
 const hasReview=fields.some(k=>patch[k]!==undefined);
 // Reuse the validated evidence contract while retaining prediction verdict semantics.
 // Only explicitly supplied review fields are merged, so older clients preserve detail.
 let calendarVerification;
 if(hasReview){
  const previous=current.calendarVerification||{},reviewPatch=Object.fromEntries(fields.filter(k=>patch[k]!==undefined).map(k=>[k,patch[k]]));
  const {clean,plan}=validatedEvidence(previous,reviewPatch),validated={...clean,...(plan?{verificationPlan:plan}:{})};
  calendarVerification={...previous,...Object.fromEntries(fields.filter(k=>validated[k]!==undefined).map(k=>[k,validated[k]])),schemaVersion:1,revision:(previous.revision||0)+1,updatedAt:Date.now()};
 }
 const result={검증기한:patch.dueAt,상태:patch.state,판정근거:patch.result,...(hasReview?{calendarVerification}:{})};
 if(new TextEncoder().encode(JSON.stringify({...current,...result})).length>750000)throw fail(400,'저장 내용이 너무 큽니다. 근거 자료를 링크로 남겨 주세요.');
 return result;
}
