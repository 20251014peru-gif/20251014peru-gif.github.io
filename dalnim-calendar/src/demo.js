import {dayKey,atDay,shiftDay} from './core/model.js';
export function demoEvents(){
 const sunday=shiftDay(new Date(),-new Date().getDay());
 const rows=[
 ['이번 주 시장 관찰',1,9,60,'investment',{symbol:'시장 관찰',market:'한국 · 미국'},'공식 자료와 지난 기록의 차이를 살펴보는 예시입니다.'],
 ['읽은 자료에서 남길 질문',1,14,60,'personal',{kind:'learning',topic:'자료 읽기'},'무엇을 확인했고, 무엇이 아직 불확실한지 기록합니다.'],
 ['관심 주제 확인 예정',2,10,45,'investment',{symbol:'관심 주제',nextCheck:'새로운 근거와 반대 근거 비교'},'실제 시장 일정이 아닌 화면 체험용 예시입니다.'],
 ['나의 관찰 메모',3,13,60,'personal',{kind:'observation',topic:'관찰'},'사실과 해석을 구분해서 남깁니다.'],
 ['투자 기록 다시 읽기',4,9,60,'investment',{symbol:'기록 복기',nextCheck:'이전 판단 이후 달라진 점'},'과거 기록을 읽고 다음 확인 항목을 정리합니다.'],
 ['한 주의 기록 돌아보기',5,16,60,'personal',{kind:'review',topic:'주간 복기'},'남은 질문과 다음 주에 살펴볼 내용을 적습니다.'],
 ];
 return rows.map(([title,offset,h,dur,category,details,notes],i)=>{const start=atDay(dayKey(shiftDay(sunday,offset)),h);return {id:`demo-investment-${dayKey(sunday)}-${i}`,title,start:start.toISOString(),end:new Date(+start+dur*60000).toISOString(),allDay:false,category,module:category,location:'',details,notes,visibility:'personal',status:i===1?'done':'planned',repeat:'none',reminder:-1,demo:true};});
}
