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
  return e;
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
      if(+new Date(o.end)>lo) out.push({...e,...o,occurrenceId:`${e.id}@${o.start}`});
    }
  }
  return out;
}
export function safeURL(value) { try { const u=new URL(value,location.href); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch { return ''; } }
