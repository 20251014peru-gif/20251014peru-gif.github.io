import {esc, addressPhoneFieldsHtml, wireAddressPhoneLinks} from '../ui.js';
const KINDS = [['event','일정'],['task','할 일'],['appointment','약속']];
function renderEditor(host, draft) {
  const field = (label, body, full = false) => '<label class="field' + (full ? ' full' : '') + '"><span>' + label + '</span>' + body + '</label>';
  host.innerHTML = '<div class="form-grid">'
    + field('종류', '<select data-detail="kind">' + KINDS.map(([v, l]) => '<option value="' + v + '" ' + ((draft.kind || 'event') === v ? 'selected' : '') + '>' + l + '</option>').join('') + '</select>')
    + addressPhoneFieldsHtml(draft, field)
    + '</div>';
  wireAddressPhoneLinks(host);
}
export default {id:'personal', label:'나의 일정', description:'일정·할 일·약속을 구분하고, 필요할 때만 주소·전화번호를 남깁니다.', icon:'calendar', color:'#8a829e', fields:[], renderEditor};
