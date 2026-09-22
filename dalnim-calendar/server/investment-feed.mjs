// One-way, read-only projection of the separate "투자 기록보관실" app
// (github.com/20251014peru-gif/invest, records.html) into calendar-shaped events.
// Same Firebase project, different app's own collections (records, records_todos).
// Nothing here writes back to those collections, and projected events never enter
// the calendar's own events store — they are merged into the response only.
const KIND_LABEL = {stock:'종목', youtube:'영상', news:'뉴스', idea:'아이디어', chart:'차트', memo:'메모', study:'공부노트'};
const isDateStr = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
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

export function mapTodoToEvent(doc) {
  if (!doc || !isDateStr(doc.date) || typeof doc.text !== 'string' || !doc.text.trim()) return null;
  return {
    id: 'investment-todo:' + doc.id,
    title: doc.text.trim().slice(0, 160),
    start: doc.date, end: dayAfter(doc.date), allDay: true, timeZone: 'Asia/Seoul',
    category: 'investment', module: 'investment', status: doc.done ? 'done' : 'planned', repeat: 'none', reminder: -1,
    visibility: 'personal', notes: '', location: '', details: {}, readOnly: true, revision: 1,
    source: {app: 'investment-archive', recordId: doc.id, kind: 'todo'},
  };
}
