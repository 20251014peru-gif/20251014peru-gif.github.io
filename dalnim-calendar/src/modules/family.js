import {esc, addressPhoneFieldsHtml, wireAddressPhoneLinks} from '../ui.js';
const fields = [{key:'with',label:'함께하는 사람',placeholder:'가족 이름'},{key:'prepare',label:'준비할 것',placeholder:'출발 전 챙길 내용'}];
const KINDS = [['','일반'],['travel','여행'],['event','행사'],['gathering','모임']];
function renderEditor(host, draft) {
  const field = (label, body, full = false) => '<label class="field' + (full ? ' full' : '') + '"><span>' + label + '</span>' + body + '</label>';
  host.innerHTML = '<div class="extra-label">가족 일정 상세</div><div class="form-grid">'
    + field('종류', '<select data-detail="kind">' + KINDS.map(([v, l]) => '<option value="' + v + '" ' + ((draft.kind || '') === v ? 'selected' : '') + '>' + l + '</option>').join('') + '</select>')
    + field('함께하는 사람', '<input data-detail="with" maxlength="200" placeholder="가족 이름" value="' + esc(draft.with ?? '') + '">')
    + addressPhoneFieldsHtml(draft, field)
    + field('준비할 것', '<textarea data-detail="prepare" maxlength="4000" style="min-height:120px" placeholder="출발 전 챙길 것, 예약 확인, 역할 분담 등">' + esc(draft.prepare ?? '') + '</textarea>', true)
    + '</div>';
  wireAddressPhoneLinks(host);
}
export default {id:'family', label:'가족 일정', description:'함께할 약속·여행·행사를 일정에 기록합니다. 실제 가족 공유는 클라우드 연결 후 가능합니다.', icon:'people', color:'#bc7296', fields, renderEditor};
