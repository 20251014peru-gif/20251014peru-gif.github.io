import {esc} from '../ui.js';
const fields = [{key:'symbol',label:'종목 / 주제',placeholder:'종목 코드 또는 관찰할 주제'},{key:'market',label:'시장',placeholder:'한국 · 미국 · 글로벌'},{key:'nextCheck',label:'확인할 내용',placeholder:'발표 이후 확인할 근거'}];
function renderEditor(host, draft) {
  const field = (label, body, full = false) => '<label class="field' + (full ? ' full' : '') + '"><span>' + label + '</span>' + body + '</label>';
  host.innerHTML = '<div class="extra-label">종목 상세</div><div class="form-grid">'
    + field('종목 / 주제', '<input data-detail="symbol" maxlength="80" placeholder="종목 코드 또는 관찰할 주제" value="' + esc(draft.symbol ?? '') + '">')
    + field('시장', '<input data-detail="market" maxlength="40" placeholder="한국 · 미국 · 글로벌" value="' + esc(draft.market ?? '') + '">')
    + field('참고 링크', '<input data-detail="link" type="url" maxlength="500" placeholder="공시·기사·리포트 주소" value="' + esc(draft.link ?? '') + '">', true)
    + field('확인할 내용', '<textarea data-detail="nextCheck" maxlength="4000" style="min-height:150px" placeholder="발표 이후 확인할 근거, 목표가·매수 이유, 반증 조건 등을 자유롭게 적어 주세요.">' + esc(draft.nextCheck ?? '') + '</textarea>', true)
    + '</div>'
    + (draft.link ? '<p class="form-note"><a href="' + esc(draft.link) + '" target="_blank" rel="noopener">' + esc(draft.link) + ' 열기 ↗</a></p>' : '');
}
export default {id:'investment', label:'투자 노트', description:'종목과 확인할 근거를 일정에 연결합니다. 시세 자동 수집·사진 첨부는 별도 연결이 필요합니다.', icon:'chart', color:'#378e86', fields, renderEditor};
