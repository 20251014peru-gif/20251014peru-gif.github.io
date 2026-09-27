// Active calendar scope. Stable IDs keep all existing records and bookmarks intact.
const retired=new Set(['family','worklog']);
export const defaultCategories=[{id:'investment',label:'투자 노트',color:'#378e86'},{id:'personal',label:'나의 기록',color:'#8a829e'}];
export const isArchivedEvent=e=>retired.has(e?.category)||retired.has(e?.module)||e?.source?.app==='worklog'||Boolean(e?.worklogRecord);
export function scopeCategories(saved=[]){
 const list=(Array.isArray(saved)?saved:[]).filter(c=>c&&typeof c.id==='string'&&!retired.has(c.id)).map(c=>({...c,label:c.id==='personal'&&c.label==='나의 일정'?'나의 기록':c.label}));
 for(const c of defaultCategories)if(!list.some(x=>x.id===c.id))list.push({...c});
 return list;
}
export const mergeCategories=(saved,active)=>[...active,...(saved||[]).filter(c=>retired.has(c.id))];
export function calendarBackupRecords(data){
 const records=Array.isArray(data)?data:data?.events;
 if(!Array.isArray(records)||!records.every(e=>e?.schemaVersion===1))throw Error('달님 캘린더에서 내보낸 백업 JSON을 선택해 주세요.');
 return records;
}
