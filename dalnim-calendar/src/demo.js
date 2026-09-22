import {dayKey,atDay,shiftDay} from './core/model.js';
export function demoEvents(){
 const today=new Date(), monday=shiftDay(today,-((today.getDay()+6)%7));
 const rows=[
 ['전기실 정기 점검',0,9,90,'worklog','전기실',{floor:'지하 1층',field:'전기',assignee:'나'},'분전반 상태와 계량기 수치를 확인하고 점검 내용을 남깁니다.'],
 ['이번 주 시장 흐름 정리',0,14,90,'investment','',{symbol:'시장 관찰',market:'한국 · 미국',nextCheck:'지난주 기록과 비교'},'실제 발표 일정이 아닌 화면 체험용 예시입니다.'],
 ['3층 공용부 시설 점검',1,9,90,'worklog','서희타워',{floor:'3층',field:'시설',assignee:'나'},'조명 상태와 공용부 시설을 확인합니다.'],
 ['분석 노트 업데이트',1,13,60,'investment','',{symbol:'관심 종목',market:'한국'},'관찰한 내용과 다음 확인할 항목을 기록합니다.'],
 ['가족과 저녁 식사',1,18,90,'family','집',{with:'가족',prepare:'저녁 메뉴 정하기'},'함께하는 시간을 미리 비워 두세요.'],
 ['소방 설비 확인',2,10,90,'worklog','관리실',{floor:'전체',field:'소방'},'점검 체크리스트와 기존 업무 기록을 확인합니다.'],
 ['집중해서 기록 정리',2,15,120,'personal','',{},'이번 주 미뤄 둔 기록을 정리하는 시간.'],
 ['관심 종목 자료 읽기',3,9,90,'investment','',{symbol:'관심 종목',nextCheck:'공식 자료의 변경점'},'실제 시장 데이터가 없는 예시 일정입니다.'],
 ['시설 보수 일정 확인',3,13,60,'worklog','관리실',{field:'시설'},'작업 범위를 확인하고 필요한 자재를 정리합니다.'],
 ['주간 업무 마무리',4,10,90,'worklog','관리실',{field:'업무 정리'},'진행 중인 업무와 다음 주 일정을 확인합니다.'],
 ['주말 산책',5,10,120,'family','공원',{with:'가족'},'주말에는 조금 천천히.'],
 ];
 return rows.map((r,i)=>{const [title,offset,h,dur,module,location,details,notes]=r,start=atDay(dayKey(shiftDay(monday,offset)),h);return {id:`demo-${dayKey(monday)}-${i}`,title,start:start.toISOString(),end:new Date(+start+dur*60000).toISOString(),allDay:false,category:module,module,location,details,notes,visibility:'personal',status:i===0?'done':'planned',repeat:'none',reminder:10,demo:true};});
}
