import {eventFromWorklog,worklogFromEvent,worklogEventId} from '../src/core/worklog-contract.js';
// Both views use one record and one revision. There is no background copy loop.
export class WorklogClient {
 constructor(store){this.store=store;}
 async list({includeDeleted=false}={}){return (await this.store.list()).filter(e=>e.worklogRecord&&(includeDeleted||!e.deletedAt)).map(e=>({...worklogFromEvent(e,e.worklogRecord),calendarId:e.id,calendarRevision:e.revision}));}
 async save(record,expectedRevision){
  const {calendarRevision,calendarId,...raw}=record;
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)throw Error('읽었던 버전 번호가 필요합니다.');
  if(this.store.request){const result=await this.store.request('/worklog','POST',{record:raw,expectedRevision});await this.store.reload?.({fresh:true});return result.record;}
  const old=(await this.store.list()).find(e=>e.id===worklogEventId(raw.id));
  const e=await this.store.save(eventFromWorklog(raw,old),expectedRevision,{worklogRecord:raw});
  return {...worklogFromEvent(e,e.worklogRecord),calendarId:e.id,calendarRevision:e.revision};
 }
 async remove(record){return this.save({...record,deletedAt:Date.now()},record.calendarRevision);}
 async restore(record){return this.save({...record,deletedAt:null},record.calendarRevision);}
 subscribe(fn){return this.store.subscribe(fn);}
}
