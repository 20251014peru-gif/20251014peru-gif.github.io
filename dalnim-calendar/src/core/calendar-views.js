import {isInvestmentReminder} from './investment-snooze.js';

// Display-only calendars: never rewrite the category/ID saved by a source app.
export const linkedCalendars=[
 {id:'linked:research',label:'지표·자료 확인',short:'지표·자료',color:'#4f70b5',description:'지수·가격·공시 등 자료를 찾아 확인할 항목'},
 {id:'linked:youtube',label:'유튜브 결과 확인',short:'유튜브 확인',color:'#b65c83',description:'영상·직전 영상 표시가 있는 후속 확인 항목'},
 {id:'linked:predictions',label:'예측 검증',short:'예측 검증',color:'#8670b4',description:'유튜브 예측 대장과 자동 채점 예측의 검증 기한'},
];
export function calendarId(event,sourceEvents=[]){
 let e=event;
 if(isInvestmentReminder(e)){
  const d=e.details;
  e=sourceEvents.find(x=>!isInvestmentReminder(x)&&(x.id===d.investmentItemId||x.aliases?.includes(d.investmentItemId)))
   ||{id:d.investmentItemId,title:d.originTitle,source:{app:'investment-archive',kind:d.originKind}};
 }
 if(e?.source?.app!=='investment-archive')return e?.category||event.category;
 const kind=e.integration?.type||e.source.kind,id=e.id||'';
 if(['youtube-prediction','prediction'].includes(kind)||/^(youtube|investment)-prediction:/.test(id))return 'linked:predictions';
 if(['followup','check','review'].includes(kind)||/^investment-(followup|check|review):/.test(id)){
  // These are explicit labels already present in the source question, not topic keywords.
  const question=String(e.title||'').replace(/^🔔\s*/u,'').trim();
  return /^(?:📺\uFE0F?\s*(?:영상|유튜브)|[🔄🔁]\uFE0F?\s*직전|\[(?:영상|직전 영상)\])/u.test(question)?'linked:youtube':'linked:research';
 }
 return 'investment';
}
export function displayCalendars(categories){
 return [...linkedCalendars,...categories.map(c=>c.id==='investment'&&c.label==='투자 노트'?{...c,label:'투자 기록',short:'투자 기록'}:c)];
}
export function matchesCalendar(e,{hidden=new Set(),hideDone=false,sources=[]}={}){
 return !hidden.has(calendarId(e,sources))&&(!hideDone||e.status!=='done');
}
export function readViewPreferences(storage,key){
 try{const p=JSON.parse(storage.getItem(key)||'{}');return {hidden:new Set(Array.isArray(p.hidden)?p.hidden.filter(x=>typeof x==='string'&&x.length<=160):[]),hideDone:p.hideDone===true};}
 catch{return {hidden:new Set(),hideDone:false};}
}
