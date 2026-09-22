import {attachWorklog} from '../src/core/worklog-contract.js';
import {validateEvent} from '../src/core/model.js';
export const canRead=(event,uid,role)=>Boolean(role)&&(event.ownerId===uid||event.visibility==='family');
export const canWrite=(event,uid,role)=>['owner','editor'].includes(role)&&(!event||event.ownerId===uid||event.visibility==='family');
export function cleanEvent(raw,old,uid,worklogRecord){
 const e=validateEvent(raw),details={};
 for(const [k,v]of Object.entries(e.details||{}).slice(0,30)){if(/^[\w-]{1,60}$/.test(k)&&['string','number','boolean'].includes(typeof v))details[k]=typeof v==='string'?v.slice(0,2000):v;}
 const clean={id:e.id,title:e.title,start:e.start,end:e.end,allDay:!!e.allDay,category:e.category,module:e.module,status:e.status,repeat:e.repeat,reminder:e.reminder,visibility:e.visibility,notes:e.notes,location:e.location,timeZone:e.timeZone,details,schemaVersion:1,ownerId:old?.ownerId||uid,revision:(old?.revision||0)+1,createdAt:old?.createdAt||Date.now(),updatedAt:Date.now(),deletedAt:e.deletedAt?Date.now():null,demo:false};
 if(e.source)clean.source={app:String(e.source.app).slice(0,80),recordId:String(e.source.recordId).slice(0,160)};
 return attachWorklog(clean,old,worklogRecord);
}
export function validSubscription(s){
 if(!s||typeof s.endpoint!=='string'||s.endpoint.length>4096||!s.keys?.auth||!s.keys?.p256dh)return false;
 try{const u=new URL(s.endpoint),h=u.hostname;return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com'));}catch{return false;}
}

