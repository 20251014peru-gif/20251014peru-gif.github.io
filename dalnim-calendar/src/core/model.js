export const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const atDay = (key, h = 9, m = 0) => { const d = new Date(`${key}T00:00:00`); d.setHours(h,m,0,0); return d; };
export const shiftDay = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
export const newId = () => crypto.randomUUID();
export function validateEvent(input) {
  const e = structuredClone(input);
  if (!e.id || typeof e.id !== 'string' || !/^[\w:.-]{1,160}$/.test(e.id)) throw Error('일정 ID가 올바르지 않습니다.');
  if (typeof e.title !== 'string' || !e.title.trim()) throw Error('일정 이름을 입력해 주세요.');
  if (e.title.length > 160) throw Error('일정 이름은 160자 이내로 입력해 주세요.');
  if (!e.start || !e.end || !Number.isFinite(+new Date(e.start)) || !Number.isFinite(+new Date(e.end)) || +new Date(e.end) <= +new Date(e.start)) throw Error('종료는 시작보다 늦어야 합니다.');
  if (e.allDay && (!/^\d{4}-\d{2}-\d{2}$/.test(e.start) || !/^\d{4}-\d{2}-\d{2}$/.test(e.end))) throw Error('종일 일정의 날짜가 올바르지 않습니다.');
  if (!['none','daily','weekly','monthly','yearly'].includes(e.repeat || 'none')) throw Error('지원하지 않는 반복 규칙입니다.');
  if (!['planned','progress','done'].includes(e.status)) throw Error('진행 상태가 올바르지 않습니다.');
  if (!['personal','family'].includes(e.visibility)) throw Error('공개 범위가 올바르지 않습니다.');
  if (!Number.isInteger(e.reminder) || e.reminder < -1 || e.reminder > 10080) throw Error('알림 시간이 올바르지 않습니다.');
  if(e.allDay){for(const key of ['start','end']){const d=new Date(e[key]+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==e[key])throw Error('존재하지 않는 날짜입니다.');}}
  try{new Intl.DateTimeFormat('ko-KR',{timeZone:e.timeZone||ZONE});}catch{throw Error('시간대가 올바르지 않습니다.');}
  e.title = e.title.trim(); e.notes = String(e.notes || '').slice(0,20000);
  e.category = String(e.category || 'personal').slice(0,80); e.module = String(e.module || 'personal').slice(0,80);
  e.location = String(e.location || '').slice(0,300); e.repeat = e.repeat || 'none';
  e.timeZone = e.timeZone || ZONE; e.schemaVersion = 1;
  if (e.source && (!e.source.app || !e.source.recordId)) throw Error('연결 원본 정보가 올바르지 않습니다.');
  e.exceptions = sanitizeExceptions(e.exceptions, e.allDay);
  e.checklist = sanitizeChecklist(e.checklist);
  e.photos = sanitizePhotos(e.photos);
  return e;
}
// Photo metadata only — the bytes live in Firebase Storage (uploaded via a dedicated endpoint, never
// through this field). `data:image/` is accepted too, but only ever produced by the local/offline demo
// store (LocalStore), which has no Storage to upload to; the real cloud path always writes a Storage URL.
export const MAX_PHOTOS = 8;
export function sanitizePhotos(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_PHOTOS)
    .filter(x => x && typeof x.id === 'string' && typeof x.url === 'string' && x.url.length <= 2000000 &&
      (x.url.startsWith('https://firebasestorage.googleapis.com/') || x.url.startsWith('data:image/')))
    .map(x => ({id: x.id.slice(0, 80), url: x.url, createdAt: Number.isFinite(x.createdAt) ? x.createdAt : Date.now()}));
}
// A real, structured to-do list — separate from the free-text notes field, so a checkbox is an
// actual <input type=checkbox> the whole way through, not text inside notes that only looks like one.
export function sanitizeChecklist(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 50)
    .filter(x => x && typeof x.text === 'string' && x.text.trim())
    .map(x => ({text: x.text.trim().slice(0, 200), done: !!x.done, kind: x.kind === 'bullet' ? 'bullet' : 'check'}));
}
// A single-occurrence override, keyed by the occurrence's original (pre-override) start.
// Editing "this event only" on a repeating event writes here instead of moving the whole series.
export function sanitizeExceptions(input, allDay) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(input).slice(0, 366)) {
    if (allDay ? !/^\d{4}-\d{2}-\d{2}$/.test(key) : !Number.isFinite(+new Date(key))) continue;
    const raw = input[key]; if (!raw || typeof raw !== 'object') continue;
    if (raw.deletedAt) { out[key] = { deletedAt: Number(raw.deletedAt) || Date.now() }; continue; }
    const o = {};
    if (typeof raw.title === 'string' && raw.title.trim()) o.title = raw.title.trim().slice(0, 160);
    if (typeof raw.notes === 'string') o.notes = raw.notes.slice(0, 20000);
    if (typeof raw.location === 'string') o.location = raw.location.slice(0, 300);
    if (['planned', 'progress', 'done'].includes(raw.status)) o.status = raw.status;
    if (Number.isInteger(raw.reminder) && raw.reminder >= -1 && raw.reminder <= 10080) o.reminder = raw.reminder;
    if (raw.start && raw.end) {
      const s = +new Date(raw.start), e2 = +new Date(raw.end);
      if (Number.isFinite(s) && Number.isFinite(e2) && e2 > s) { o.start = raw.start; o.end = raw.end; }
    }
    if (Object.keys(o).length) out[key] = o;
  }
  return out;
}
// Keep the anchor date when stepping months: Jan 31 skips February instead of drifting.
export function occurrenceAt(e, n) {
  const start = e.allDay ? atDay(e.start,0) : new Date(e.start);
  const d = new Date(start);
  if (e.repeat === 'daily') d.setDate(start.getDate()+n);
  if (e.repeat === 'weekly') d.setDate(start.getDate()+7*n);
  if (e.repeat === 'monthly') { d.setDate(1); d.setMonth(start.getMonth()+n); d.setDate(start.getDate()); if(d.getDate()!==start.getDate() || d.getMonth()!==((start.getMonth()+n)%12)) return null; }
  if (e.repeat === 'yearly') { d.setFullYear(start.getFullYear()+n); if(d.getMonth()!==start.getMonth()) return null; }
  const duration = +new Date(e.end) - +new Date(e.start);
  return { start: e.allDay ? dayKey(d) : d.toISOString(), end: e.allDay ? dayKey(shiftDay(d, Math.round(duration/86400000))) : new Date(+d+duration).toISOString() };
}
export function expandEvents(events, from, to) {
  const out=[]; const lo=+new Date(from), hi=+new Date(to);
  for (const e of events) {
    if (e.deletedAt) continue;
    if (!e.repeat || e.repeat==='none') { if(+new Date(e.start)<hi && +new Date(e.end)>lo) out.push({...e, occurrenceId:e.id}); continue; }
    const base = new Date(e.start); const low = new Date(lo);
    let startIndex = e.repeat==='daily' ? Math.floor((lo-+base)/86400000)-3 : e.repeat==='weekly' ? Math.floor((lo-+base)/604800000)-2 : e.repeat==='monthly' ? (low.getFullYear()-base.getFullYear())*12+low.getMonth()-base.getMonth()-2 : low.getFullYear()-base.getFullYear()-2;
    for (let n=Math.max(0,startIndex), count=0; count<400; n++,count++) {
      const o=occurrenceAt(e,n); if(!o) continue;
      if(+new Date(o.start)>=hi) break;
      const ex=e.exceptions?.[o.start]; if(ex?.deletedAt) continue;
      const occ=ex?{...o,...ex}:o;
      if(+new Date(occ.end)>lo) out.push({...e,...occ,occurrenceId:`${e.id}@${o.start}`,isException:Boolean(ex)});
    }
  }
  return out;
}
export function safeURL(value) { try { const u=new URL(value,location.href); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch { return ''; } }
