// One-way, read-only projection of the separate "투자 기록보관실" app
// (github.com/20251014peru-gif/invest, records.html) into calendar-shaped events.
// Same Firebase project, different app's own `records` collection. Nothing here writes
// back, and projected events never enter the calendar's own events store — they are
// merged into the response only.
//
// This mirrors exactly what records.html's own calendar view (calHTML in that file)
// shows for a given month: (1) each record on its own `date`, (2) each entry of that
// record's `checks[]` array on its own `date` (a "나중에 볼 것" follow-up reminder,
// e.g. "이 종목 실적 발표일 확인"), and (3) `reviewAt` on 공부노트(study) records. The
// separate `records_todos` collection is NOT part of that calendar view in the source
// app (it backs an unrelated "오늘의 체크리스트" widget and check-completion markers),
// so it is deliberately not read here.
const KIND_LABEL = {stock:'종목', youtube:'영상', news:'뉴스', idea:'아이디어', chart:'차트', memo:'메모', study:'공부노트'};
const FOLLOWUP_LABEL = {lookup:'🔎 알아보기', think:'💭 더 생각하기', reread:'📖 다시 읽기'};
const isDateStr = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isStudyRecord = r => Boolean(r) && (r.kind === 'study' || r.contentFormat === 'tiptap-json');
const dayAfter = s => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

export function mapRecordToEvent(doc) {
  if (!doc || !isDateStr(doc.date)) return null;
  const label = KIND_LABEL[doc.kind] || '기록';
  return {
    id: 'investment-record:' + doc.id,
    title: String(doc.title || doc.oneLiner || label + ' 기록').slice(0, 160),
    start: doc.date, end: dayAfter(doc.date), allDay: true, timeZone: 'Asia/Seoul',
    category: 'investment', module: 'investment', status: 'done', repeat: 'none', reminder: -1,
    visibility: 'personal', notes: String(doc.body || doc.oneLiner || '').slice(0, 20000),
    location: Array.isArray(doc.stocks) && doc.stocks.length ? doc.stocks.join(', ').slice(0, 300) : '',
    details: {}, readOnly: true, revision: 1,
    source: {app: 'investment-archive', recordId: doc.id, kind: doc.kind || 'record'},
  };
}

// One event per checks[] entry — a follow-up reminder attached to a record
// ({id, date, what, action, followUpType}). Indexed by array position as a fallback id
// for older entries saved before each check item carried its own `id`.
export function mapCheckToEvent(record, check, index) {
  if (!record || !check || !isDateStr(check.date)) return null;
  const label = FOLLOWUP_LABEL[check.followUpType] || '확인할 것';
  return {
    id: 'investment-check:' + record.id + ':' + (check.id || index),
    title: String(check.what || label).slice(0, 160),
    start: check.date, end: dayAfter(check.date), allDay: true, timeZone: 'Asia/Seoul',
    category: 'investment', module: 'investment', status: 'planned', repeat: 'none', reminder: -1,
    visibility: 'personal', notes: String(check.action || '').slice(0, 20000),
    location: String(record.title || '').slice(0, 300),
    details: {}, readOnly: true, revision: 1,
    source: {app: 'investment-archive', recordId: record.id, kind: 'check'},
  };
}

// 공부노트(study note) spaced-repetition review date.
export function mapReviewToEvent(record) {
  if (!isStudyRecord(record) || !isDateStr(record.reviewAt)) return null;
  return {
    id: 'investment-review:' + record.id,
    title: '재검토: ' + String(record.title || '기록').slice(0, 140),
    start: record.reviewAt, end: dayAfter(record.reviewAt), allDay: true, timeZone: 'Asia/Seoul',
    category: 'investment', module: 'investment', status: 'planned', repeat: 'none', reminder: -1,
    visibility: 'personal', notes: '', location: '',
    details: {}, readOnly: true, revision: 1,
    source: {app: 'investment-archive', recordId: record.id, kind: 'review'},
  };
}
