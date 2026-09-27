import {esc} from '../ui.js';
const kinds=[['note','메모'],['observation','관찰'],['learning','학습'],['review','복기']];
function renderEditor(host,draft){
 const selected=draft.kind||'note';
 const options=kinds.some(([v])=>v===selected)?kinds:[...kinds,[selected,({event:'일정',task:'할 일',appointment:'약속'})[selected]||'기존 분류']];
 host.innerHTML='<div class="form-grid"><label class="field"><span>기록 종류</span><select data-detail="kind">'+options.map(([v,l])=>'<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label><label class="field"><span>주제</span><input data-detail="topic" maxlength="200" placeholder="이번 기록의 핵심 주제" value="'+esc(draft.topic||'')+'"></label></div>';
}
export default {id:'personal',label:'나의 기록',description:'메모·관찰·학습·복기를 날짜별로 쌓습니다.',icon:'list',color:'#8a829e',fields:[],renderEditor};
